import type { Diagram } from "./types";

export const DIGITAL_WALLET: Diagram = {
  id: "digital-wallet",
  title: "Digital Wallet",
  question: "Design a Digital Wallet",
  sourceId: "patterns",
  itemId: 24,
  overview: {
    shape:
      "A wallet is a double-entry ledger with a cache in front of it. Every movement writes a debit and a matching credit, and the balance the user sees is a materialised sum rebuildable from those entries.",
    forces: [
      {
        constraint: "two users in one transfer share a shard under 1% of the time, at 10k transfers/s",
        decision: "Cross-shard transfers use TCC (Try-Confirm-Cancel): reserve on both sides, then confirm, instead of one distributed transaction",
        lights: ["orchestrator", "shard-a", "shard-b", "e4", "e5"],
      },
      {
        constraint: "two concurrent debits can both read a balance as sufficient, then both write",
        decision: "The check and the deduction are one conditional UPDATE statement, so double-spend is structurally impossible, not merely unlikely",
        lights: ["shard-a", "e4"],
      },
      {
        constraint: "a coordinator that dies mid-transfer would otherwise freeze money for longer than a 30s deadline",
        decision: "Every reservation carries a 30s deadline and a lease id, so a sweeper can safely release it without a human",
        lights: ["sweeper", "e6", "e7"],
      },
      {
        constraint: "a five-year-old account holds ~15,000 entries, and at 12k reads/s that is 180M row reads/s to sum live",
        decision: "accounts.balance is a materialised sum, reconciled hourly against the ledger rather than recomputed on every read",
        lights: ["ledger", "reconciler", "e12", "e13"],
      },
      {
        constraint: "a single balance row commits only 500-1,000 writes/s, but one merchant can take 3,000 credits/s",
        decision: "A hot account's balance is split into 16 sub-balance rows, each absorbing its own share of writes",
        lights: ["hot-account", "e10"],
      },
    ],
    naive: {
      text: "Move money with a single UPDATE against each account's balance column, decided by a plain SELECT then a write, and use a distributed transaction to make the two-shard update atomic. Two concurrent debits can both read the balance as sufficient before either writes. A $100 account can take an $80 and a $70 debit at once and go $50 overdrawn. A distributed transaction across shards also holds locks over the network for however long the coordinator takes, and a stalled coordinator freezes both accounts until someone intervenes. The design instead makes the check and the deduction one conditional UPDATE, and replaces the distributed transaction with reserve-then-confirm, so a lock is never held across a network hop.",
      lights: ["shard-a", "orchestrator"],
    },
    beats: [
      {
        text: "Balances are never authoritative. The ledger is append-only, rows are inserted and never updated or deleted, and accounts.balance is a materialised sum of it. That inversion is the whole answer, and it is why reversals, disputes and a seven-year audit are answerable at all.",
        lights: ["ledger", "shard-a", "e8", "e9"],
      },
      {
        text: "Accounts are sharded by user_id % 128, which is what makes 10k transfers/s possible and is also what creates the problem. A random pair shares a shard under 1% of the time, so cross-shard is the design rather than the exception. Every latency and capacity number should be quoted for that path.",
        lights: ["shard-cluster", "shard-a", "shard-b"],
      },
      {
        text: "Same shard is one local ACID transaction and the fast path at roughly 5ms. It is a conditional update that deducts only if the funds exist, plus the two ledger rows, committed together. The predicate lives inside the UPDATE, which is what makes double-spend structurally impossible rather than merely unlikely.",
        lights: ["shard-a", "orchestrator"],
      },
      {
        text: "Cross shard is reserve-then-confirm, the pattern known as TCC. Try moves money from available into reserved on the sender and into pending on the receiver, writing no ledger entry. Confirm clears the hold and inserts the entry in the same local transaction. Four small local transactions in two rounds, about 20ms.",
        lights: ["orchestrator", "shard-a", "shard-b", "e4", "e5", "e8", "e9"],
      },
      {
        text: "Every reservation carries a 30s deadline and the orchestrator's lease id. A coordinator that dies leaves a row that expires rather than a frozen account. A stale Confirm arriving after the sweeper matches zero rows instead of half-applying the transfer.",
        lights: ["orchestrator", "sweeper", "shard-a", "e6", "e7"],
      },
      {
        text: "Hourly per-shard reconciliation proves that the sum of entries equals the balance row. Drift freezes the account and pages a human, and never self-corrects, because an auto-corrector is a background job with unreviewed write access to every balance in the system.",
        lights: ["reconciler", "ledger", "shard-a", "e12", "e13"],
      },
    ],
    crux: {
      problem:
        "Making one transfer atomic across two shards without a coordinator that can freeze somebody's money.",
      handled:
        "A distributed transaction holds locks across the network, and a stalled coordinator freezes both accounts until someone intervenes. A plain compensating saga instead exposes a window where the money is in neither account, and a balance read in that window returns a number that was never true. Reserve-then-confirm closes that window: a hold is visible and accounted for at every instant.",
    },
    numbers: [
      {
        value: "10k transfers/s peak, >90% cross-shard",
        explain: "128 shards means two random users share a shard under 1% of the time, so the cross-shard TCC path is the normal case, not the exception.",
      },
      {
        value: "480M ledger entries/day, ~370TB over 7 years",
        explain: "Two rows per movement, a debit and a credit, at the platform's transfer volume, retained for the audit window regulators require.",
      },
      {
        value: "one balance row absorbs 500-1,000 writes/s",
        explain: "The single-row commit ceiling at ~1-2ms per transaction, the figure that forces a popular merchant's account to split into sub-balances.",
      },
    ],
  },
  nodes: [
    {
      id: "shard-cluster",
      label: "128 Postgres shards, user_id % 128",
      kind: "zone",
      detail: {
        what: "The transactional core: account rows and their ledger entries, split across 128 shards by user id.",
        why: "Sharding is what makes 10k transfers/s reachable, and it is also the source of the entire problem. Two users in one transfer usually live on two servers with no shared transaction between them.",
        numbers: [
          { value: "128 shards", explain: "The partition count this whole system's write throughput and cross-shard rate are both derived from." },
          { value: "P(same shard) = 1/128 = 0.8%", explain: "The chance a random pair of users lands on the same shard, which is why cross-shard is the norm rather than an edge case." },
          { value: "~450GB account state at RF=3", explain: "The total account data this cluster holds, replicated three ways for durability." },
        ],
      },
    },
    {
      id: "client",
      label: "Client",
      sub: "app, terminal, transit gate",
      kind: "external",
      col: 0,
      row: 0,
      detail: {
        what: "The app or terminal that submits a transfer and renders a balance.",
        why: "It is drawn because it sets two constraints the rest of the design answers to. It retries on any network blip, so every request needs a key. It shows a number to a human, so a balance that reads high is a different category of defect from one that reads low.",
        numbers: [
          { value: "~10 balance checks per active user per day", explain: "The typical read frequency one user generates, the figure the balance-read path is sized against." },
          { value: "30M daily active users", explain: "The scale of the user base this whole system serves." },
        ],
        breaks: {
          failure: "A retried POST that the client believes failed but the server committed.",
          handled: "Without an idempotency key that retry is a second transfer, and the user is debited twice, which is exactly what the idempotency store exists to prevent.",
        },
      },
    },
    {
      id: "wallet-svc",
      label: "Wallet service",
      sub: "idempotency, caps, balance reads",
      kind: "service",
      col: 1,
      row: 0,
      detail: {
        what: "The stateless API tier: deduplicates on the idempotency key, enforces the O(1) hard rules, and serves balance reads from the shard leader.",
        why: "Everything statistical has to stay off the hot path at 10k/s, so this tier enforces only blocked-account checks and per-user daily caps. A velocity_counters row is bumped in the same transaction as the balance, so the count cannot drift from reality.",
        numbers: [
          { value: "~10k transfers/s peak", explain: "The write throughput this tier is horizontally scaled to sustain." },
          { value: "~12k balance reads/s peak", explain: "The read throughput served alongside transfers, from the same stateless tier." },
          { value: "<100 leader reads/s per shard", explain: "How thin that peak read load actually is once spread across 128 shard leaders." },
        ],
        breaks: {
          failure: "Putting a fraud model inline. Its outage becomes a wallet outage.",
          handled: "Anything scored inline needs a fail-open default and a budget under 5ms, so heavier fraud checks run off the event stream instead of on this path.",
        },
        choice: {
          pick: "Strongly consistent balance reads from the shard leader, shown as three numbers: available (balance - reserved), pending in, and total",
          instead: "Follower or cache reads at 100-500ms staleness, with the spend path re-checking authoritatively at write time anyway.",
          decider:
            "Not cost, and that is the point: 300M reads/day is ~3.5k/s average and ~12k/s peak, which across 128 shards is under 100 reads/s per leader. What remains is direction: a stale read after a debit shows money that is already gone.",
          flips: "Reads outnumber writes by more than roughly 100:1, or the reader sits 80ms from the leader and the number is decoration. Never where the read is the authorisation, such as an offline transit gate.",
        },
      },
    },
    {
      id: "idempotency",
      label: "Idempotency store",
      sub: "replicated KV, 24h TTL",
      kind: "database",
      col: 2,
      row: 0,
      detail: {
        what: "One key per transfer request, holding the stored response, deduplicated for 24 hours.",
        why: "A client that times out cannot tell a lost request from a committed one, so it retries. Collapsing retries to one logical movement is what makes the API safe to call twice, and the window has to outlive a client's whole retry schedule.",
        numbers: [
          { value: "10k/s x 86,400 = 864M keys/day", explain: "The write volume this store absorbs at peak transfer rate." },
          { value: "~500B stored response", explain: "The typical size of the cached response kept behind each key." },
          { value: "~430GB peak", explain: "The total footprint of this store at any moment, bounded by the 24h TTL." },
        ],
        breaks: {
          failure: "Expiring the key before the client stops retrying.",
          handled: "A retry arriving at hour 25 is indistinguishable from a new transfer and moves the money a second time. The TTL is set well past any realistic client retry schedule to avoid that.",
        },
        choice: {
          pick: "A replicated key-value store with a 24h TTL on every key",
          instead: "A unique index on idempotency_key in the account shard itself.",
          decider:
            "Where the key lives relative to the transaction it protects. A unique index is free correctness for same-shard transfers. But 864M keys/day of dead rows land in the OLTP store, and a cross-shard transfer has no single shard to own the key.",
          flips: "Same-shard-only wallets at a few hundred transfers per second, where the unique index is one less system to run.",
        },
      },
    },
    {
      id: "orchestrator",
      label: "Transfer orchestrator",
      sub: "same shard -> ACID, else TCC",
      kind: "service",
      col: 1,
      row: 1,
      detail: {
        what: "The durable three-phase state machine: Try on both sides, then Confirm on both sides, with Cancel as the failure branch. It runs on a durable workflow engine rather than an ad-hoc state column, with the same-shard case short-circuited to one local transaction.",
        why: "This is the only place that knows a transfer is one thing rather than two independent writes. Its state is persisted between phases, so a crash resumes from the last phase rather than restarting. Confirm and Cancel are idempotent on (transfer_id, side), so a resumed run cannot double-apply.",
        numbers: [
          { value: "4 local transactions in 2 rounds, ~20ms", explain: "The full cost of a cross-shard transfer, two rounds of Try then Confirm on each side." },
          { value: "same-shard fast path ~5ms", explain: "The much cheaper cost when both accounts happen to share a shard." },
          { value: ">90% of transfers take the TCC path", explain: "How dominant the cross-shard case is, given a 0.8% same-shard probability at scale." },
        ],
        breaks: {
          failure: "Dying between Try and Confirm.",
          handled: "The reservation TTL is the backstop for a genuinely dead orchestrator, not the primary recovery path. The lease id exists to settle the case where a dead orchestrator and the sweeper race.",
        },
        choice: {
          pick: "Application-level TCC, whose locks are held only inside each Try for 1-2ms and whose durable state is a column with a deadline",
          instead: "Put every shard in one distributed-SQL cluster and write the transfer as a single begin/commit, letting the store run two-phase commit internally.",
          decider:
            "How long a lock may be held across the network, and what happens when the coordinator stalls. Cross-region the same round trip is 60-150ms, capping a hot account at roughly 16 transfers/s.",
          flips: "All shards in one cluster in one region, peak of a few thousand transfers/s, and no account above a few hundred writes/s. Then take the distributed transaction; it is strictly less code.",
        },
      },
    },
    {
      id: "sweeper",
      label: "Reservation sweeper",
      sub: "30s TTL, lease-aware cancel",
      kind: "service",
      col: 0,
      row: 1,
      detail: {
        what: "The background job that cancels reservations whose deadline has passed, returning reserved money to the sender's available balance.",
        why: "It is what makes the design operable at 3am. A crashed orchestrator leaves behind a row with a deadline rather than a permanently frozen account, and nobody has to be woken to unfreeze a user's funds.",
        numbers: [
          { value: "30s TTL for retail transfers", explain: "The window a reservation is allowed to sit unconfirmed before this job reclaims it." },
          { value: "alert on any reservation older than 5x TTL", explain: "The threshold that flags something the sweeper itself has failed to clean up." },
          { value: "~30MB of rows even in a full stall", explain: "The worst-case footprint of open reservations, small enough to never be a capacity concern." },
        ],
        breaks: {
          failure: "Racing a late Confirm.",
          handled: "The sweeper cancels at TTL, the stalled orchestrator wakes and confirms a reservation that no longer exists. Done naively that credits the receiver against money already returned.",
        },
        choice: {
          pick: "Cancel only leases provably expired, and make Confirm run WHERE reservation_id = ? AND lease_id = ?",
          instead: "A plain expires_at sweep with no lease, relying on the TTL being longer than any possible stall.",
          decider:
            "What a late Confirm does. With a 30s TTL and no lease, a stalled orchestrator's Confirm half-applies the transfer silently; with the lease in the predicate it matches zero rows and fails cleanly.",
          flips: "Never inside a wallet. A fencing token is the more rigorous version of the same rule: the losing party must fail loudly, not silently succeed.",
        },
      },
    },
    {
      id: "shard-a",
      label: "Shard A (sender)",
      sub: "balance, reserved, pending",
      kind: "database",
      col: 0,
      row: 2,
      parent: "shard-cluster",
      detail: {
        what: "The sender's shard: one row per (user_id, currency) carrying balance, reserved, pending and a version for optimistic concurrency.",
        why: "Reserved and pending are the entire cross-shard coordination mechanism, and there is no distributed lock anywhere. Reserved is money committed but not sent, pending is money about to arrive and not yet spendable, and available is balance - reserved.",
        numbers: [
          { value: "~500B per row", explain: "150GB / 300M rows (100M users x 3 currencies) = exactly 500B; small enough that the full RF=3 table is still under 450GB." },
          { value: "100M users x 3 currency rows = ~150GB", explain: "The base storage this table needs before replication." },
          { value: "~450GB at RF=3", explain: "The replicated footprint that gives this table its durability." },
        ],
        breaks: {
          failure: "Concurrent double-spend if the check is separated from the deduction.",
          handled: "Two $80 and $70 debits against $100 both read the balance, both conclude there is enough, and the account goes $50 overdrawn, which the conditional UPDATE structurally prevents.",
        },
        choice: {
          pick: "UPDATE accounts SET available = available - 80, reserved = reserved + 80 WHERE user_id = ? AND available >= 80",
          instead: "Read the balance, decide in application code, then write; or take a row lock with SELECT FOR UPDATE first.",
          decider:
            "Whether a window exists between the check and the deduction. As one statement there is no between: the second concurrent transfer sees available = 20, the predicate fails, 0 rows update and the Try fails cleanly.",
          flips: "Sustained contention on one account, where the optimistic retries themselves become the problem and that account moves to a pessimistic SELECT FOR UPDATE path or gets split.",
        },
      },
    },
    {
      id: "shard-b",
      label: "Shard B (receiver)",
      sub: "Try writes pending, no entry",
      kind: "database",
      col: 1,
      row: 2,
      parent: "shard-cluster",
      detail: {
        what: "The receiver's shard. Try increments pending and writes no ledger entry; Confirm moves pending into balance and inserts the credit in the same local transaction.",
        why: "Putting the entry at Confirm rather than Try is the whole trick. The funds were checked and set aside at Try, so Confirm cannot fail for business reasons and the only reason it retries is infrastructure.",
        numbers: [
          { value: "Try and Confirm are 1-2ms local transactions", explain: "5-10x faster than the saga alternative's 10-20ms exposure window; two fast local transactions replace one open-ended one." },
          { value: "idempotent: 1 write per (transfer_id, side)", explain: "The guarantee that a resumed or retried Confirm cannot double-apply." },
        ],
        breaks: {
          failure: "A receiver whose account is frozen fails its Try, which forces a Cancel of the sender's already-successful Try.",
          handled: "That branch is the one worth testing, because it is the only place Cancel runs against a shard that did nothing wrong.",
        },
        choice: {
          pick: "Reserve then confirm (TCC): pending on the receiver, entries written only at Confirm",
          instead: "A plain compensating saga: credit the receiver, and write a reversing entry if it fails.",
          decider:
            "Where the money sits between the two steps. A saga has a real window, roughly 10-20ms and unbounded if the credit is retried, where the amount is in neither account.",
          flips: "When one side is a system you do not control and reservation is impossible, such as a card rail. There the compensating saga is correct.",
        },
      },
    },
    {
      id: "ledger",
      label: "Ledger entries",
      sub: "append-only, no DELETE grant",
      kind: "database",
      col: 0,
      row: 3,
      parent: "shard-cluster",
      detail: {
        what: "The system of record: two rows per movement, a debit and a matching credit sharing a reference, never edited and never deleted.",
        why: "The invariant sum(debits) == sum(credits) holds by construction because no code path writes one entry alone. Deposits and withdrawals are not exceptions either; they are transfers against a system account.",
        numbers: [
          { value: "480M entries/day", explain: "480M x 300B = ~145GB/day, matching the sibling figure; the volume the downstream relay has to keep up with without falling behind." },
          { value: "~300B/entry, ~145GB/day raw", explain: "The daily write footprint at that entry volume." },
          { value: "7-year retention, ~370TB raw, ~75TB cold", explain: "The regulatory retention window and the storage it costs, most of it eventually moved to cold storage." },
        ],
        breaks: {
          failure: "Any grant that lets an application role update or delete a row.",
          handled: "The moment history is mutable, the audit trail is an opinion rather than a record, which is why write permissions here are deliberately narrower than everywhere else in the system.",
        },
        choice: {
          pick: "Append-only entries with a materialised accounts.balance, reconciled hourly",
          instead: "Summing the entries on every read, so the balance is derived rather than stored.",
          decider:
            "Arithmetic. A five-year-old account holds on the order of 15,000 entries, and at 12k balance reads/s that is 180M row reads/s to compute a number you could have stored.",
          flips: "Low-volume or short-lived accounts, where the entry count per account stays small. The middle ground is a periodic checkpoint entry so a rebuild sums only entries since it.",
        },
      },
    },
    {
      id: "hot-account",
      label: "Hot account sub-balances",
      sub: "merchant split 16 ways",
      kind: "database",
      col: 1,
      row: 3,
      parent: "shard-cluster",
      detail: {
        what: "A popular merchant's balance split into 16 rows, merchant_X:0 through merchant_X:15, with each credit hashed onto one and reads summing all sixteen.",
        why: "A single balance row is a single-row write, so its ceiling is roughly one committed transaction per transaction duration. Past that, optimistic retries thrash: every retry re-reads a version that has already moved.",
        numbers: [
          { value: "one row absorbs 500-1,000 writes/s at 1-2ms", explain: "The commit ceiling of a single balance row, the figure that forces splitting past this threshold." },
          { value: "a 3,000 credits/s merchant needs N >= 6", explain: "The minimum split count needed just to keep up with a busy merchant's write rate." },
          { value: "N = 16 gives ~190/s per row", explain: "The comfortable headroom this design's chosen split factor actually provides." },
        ],
        breaks: {
          failure: "Debits. A single large payout may exceed any one sub-balance.",
          handled: "Debits route through a designated row and a background rebalancer levels the sixteen with internal transfers, keeping every row's headroom similar.",
        },
        choice: {
          pick: "Split the hot account into 16 sub-balances, raised automatically once contention crosses a threshold",
          instead: "A write-behind aggregator accumulating that account's credits in memory and flushing one transaction every 50ms.",
          decider:
            "The single-row write ceiling of 1/(transaction duration), so 500-1,000 writes/s at 1-2ms. A 3,000/s merchant is 3-6x over, and the aggregator holds committed-to-the-user money in one process's memory.",
          flips: "Credit-only accounts that are rarely read, such as a platform fee or treasury float, where splitting is actively wrong because spread debits need a rebalancer nobody wants to own.",
        },
      },
    },
    {
      id: "reconciler",
      label: "Reconciliation job",
      sub: "hourly per shard, freeze drift",
      kind: "service",
      col: 0,
      row: 4,
      detail: {
        what: "The hourly per-shard check that sum(ledger_entries.amount) equals accounts.balance, that debits equal credits globally, and that every committed entry reached the event stream.",
        why: "The balance is a cache, so this is the job that turns 'probably correct' into 'proven correct on a schedule'. The invariant is deliberately not balance + reserved: reserved money has no entries because it has not moved.",
        numbers: [
          { value: "hourly window = 20M entries", explain: "The volume this check processes on every run, across all 128 shards combined." },
          { value: "100M account rows across 128 shards", explain: "The scale of the account base this check ultimately covers." },
          { value: "even $0.01 of drift is incident-grade", explain: "The zero-tolerance threshold this job is held to, since any drift means the invariant has actually broken somewhere." },
        ],
        breaks: {
          failure: "Freezing a real person out of their own money on a false positive.",
          handled: "A check that races an in-flight Confirm sees a mismatch that would have resolved itself. The job re-runs after a short delay and freezes debits only, degrading rather than killing the account.",
        },
        choice: {
          pick: "Freeze the account and page, correcting only with an audited adjustment entry and human sign-off",
          instead: "Auto-correct the balance to match the entries, since the entries are known to be truth.",
          decider:
            "What the corrector would be. A job that rewrites balances without review has unreviewed write access to all 100M accounts and a mandate to change them. That describes the worst possible bug in this system.",
          flips: "Never for balances. The cheap half does flip: keep a running per-account entry total updated in the same transaction as the insert so the hourly check is a column comparison.",
        },
      },
    },
    {
      id: "event-log",
      label: "Event stream",
      sub: "Kafka, fed by logical decoding",
      kind: "queue",
      col: 1,
      row: 4,
      detail: {
        what: "A partitioned durable log carrying one domain event per committed ledger entry to fraud scoring, notifications, analytics and the archive.",
        why: "It keeps every non-transactional consumer off the OLTP path. Statistical fraud detection, graph anomalies and device clustering all run here and escalate to step-up auth or a hold, rather than adding latency to all 10k/s.",
        numbers: [
          { value: "480M events/day x ~400B = ~190GB/day", explain: "The daily volume this stream carries out of the ledger." },
          { value: "7-day hot retention = ~1.3TB, ~4TB at RF=3", explain: "How much of that stream stays quickly replayable before falling to cold storage." },
          { value: "archive to columnar storage after 90 days", explain: "Where this stream's data lives once it is no longer needed for near-real-time consumers." },
        ],
        breaks: {
          failure: "Consumer lag exactly when freshness matters.",
          handled: "Fraud and notification consumers see a stale world during the load spike that produced the fraud, so consumer lag is measured at the consumer itself, not inferred from relay health.",
        },
        choice: {
          pick: "Stream from the write-ahead log via logical decoding",
          instead: "An outbox table written in the transaction and forwarded by a polling relay.",
          decider:
            "What bounds the delay. Polling makes it a function of the poll interval, and at 480M entries/day the relay is the thing that falls behind under exactly the load you care about.",
          flips: "Stores with no usable logical decoding, or event volumes low enough that a poll every 100ms is free.",
        },
      },
    },
  ],
  edges: [
    {
      id: "e1",
      from: "client",
      to: "wallet-svc",
      tier: "hot",
      step: 1,
      label: "POST /transfer",
      detail: {
        what: "A transfer request carrying from, to, amount, currency and an idempotency-key header.",
        why: "The key is on the request rather than generated server-side because only the client knows that its second attempt is a retry of its first. Without it, a network timeout on a committed transfer becomes a duplicate payment.",
        numbers: [
          { value: "~10k requests/s peak", explain: "The peak rate this hot edge is provisioned to handle." },
          { value: "240M money movements/day", explain: "The daily volume this front door ultimately drives into the rest of the system." },
        ],
        breaks: {
          failure: "A client that generates a fresh key per retry defeats the whole mechanism.",
          handled: "Key generation belongs to the logical operation, not to the HTTP attempt, which is why the client is required to reuse it across retries of the same transfer.",
        },
      },
    },
    {
      id: "e2",
      from: "wallet-svc",
      to: "idempotency",
      tier: "data",
      label: "key claim, 24h TTL",
      detail: {
        what: "Claiming the idempotency key before any money moves, and replaying the stored response if it is already present.",
        why: "This has to happen before validation and before the orchestrator, because the whole point is that a duplicate never reaches the state machine. A key already claimed returns the original result rather than starting a second transfer.",
        numbers: [
          { value: "864M keys/day", explain: "The write volume this hop generates against the idempotency store." },
          { value: "~430GB peak", explain: "The store's peak footprint under this claim rate." },
        ],
        breaks: {
          failure: "A claim that succeeds and then a crash before the transfer is recorded leaves a key with no response behind it.",
          handled: "The stored value has to include the transfer's terminal state, not just the key, so a later replay always has something meaningful to return.",
        },
      },
    },
    {
      id: "e3",
      from: "wallet-svc",
      to: "orchestrator",
      tier: "hot",
      step: 2,
      label: "validated transfer",
      detail: {
        what: "A deduplicated, cap-checked transfer handed to the state machine that will actually move the money.",
        why: "The split exists so the API tier stays stateless and horizontally scalable while the phase state lives somewhere durable. Everything upstream of this arrow is cheap and repeatable; everything downstream is not.",
        breaks: {
          failure: "If the orchestrator accepts before the transfer row is durable, a crash here loses a request the client believes was accepted.",
          handled: "Only the client's retry recovers it in that case, which is why the transfer row must be durable before this hop returns success.",
        },
      },
    },
    {
      id: "e4",
      from: "orchestrator",
      to: "shard-a",
      tier: "hot",
      step: 3,
      label: "Try: available -> reserved",
      detail: {
        what: "The sender-side Try: one local transaction moving the amount out of available and into reserved, incrementing version.",
        why: "This is the conditional update that prevents double-spend, and it writes no ledger entry because no money has moved yet. The funds are set aside here so that Confirm later cannot fail for any business reason.",
        numbers: [
          { value: "1-2ms local transaction", explain: "The typical latency of this hop, a small local commit rather than a network round trip." },
          { value: "0 rows updated means insufficient funds", explain: "How this hop signals failure: the conditional predicate simply matches nothing." },
        ],
        breaks: {
          failure: "If this succeeds and the receiver's Try then fails, the sender is holding a reservation that must be cancelled.",
          handled: "That is the one branch where Cancel runs against a shard that did nothing wrong, which is why it is specifically tested rather than assumed rare.",
        },
      },
    },
    {
      id: "e5",
      from: "orchestrator",
      to: "shard-b",
      tier: "hot",
      step: 4,
      label: "Try: pending += amount",
      detail: {
        what: "The receiver-side Try: one local transaction incrementing pending, run in parallel with the sender's Try.",
        why: "Pending is money the receiver is about to get but cannot spend, which is what lets the transfer be visible and honest before it is final. Two independent local transactions in one round is the whole reason no distributed lock is needed.",
        numbers: [{ value: "both Trys in one round, ~20ms end to end", explain: "The transactions themselves are 1-2ms each; the other ~18ms is network RTT in one parallel round, not coordination cost." }],
        breaks: {
          failure: "A frozen or closed receiving account fails here after the sender's Try succeeded.",
          handled: "This arrow is the trigger for the Cancel branch rather than a simple abort, since the sender's reservation now needs to be released.",
        },
      },
    },
    {
      id: "e6",
      from: "orchestrator",
      to: "sweeper",
      tier: "control",
      label: "lease id + 30s deadline",
      detail: {
        what: "The reservation rows the orchestrator writes, each carrying its lease id and expires_at, which is what the sweeper reads.",
        why: "Making the deadline a column rather than a timer in the orchestrator's memory is what lets a completely dead process still release money. The durable state cleans itself up without anyone being paged.",
        numbers: [
          { value: "30s TTL for retail transfers", explain: "The default window a reservation is given before it is eligible for cancellation." },
          { value: "quote TTL of 5-30s for cross-currency", explain: "A tighter, market-sensitive window used when the transfer involves a currency conversion quote." },
        ],
        breaks: {
          failure: "Binding a cross-currency reservation to the default 30s rather than the quote's TTL hands the user a free option.",
          handled: "They can confirm when the market moved their way and abandon when it did not, which is why quote-bound transfers use their own, tighter deadline.",
        },
      },
    },
    {
      id: "e7",
      from: "sweeper",
      to: "shard-a",
      tier: "control",
      label: "cancel expired holds",
      detail: {
        what: "Returning reserved money to available for reservations whose lease is provably expired, stamping cancelled_by so it is distinguishable later.",
        why: "This is the backstop that makes a crashed orchestrator survivable without a human. It emits nothing to the ledger, because a reservation is an application-level hold and no money ever moved.",
        numbers: [
          { value: "cancels only after the 30s deadline", explain: "The bound that keeps this job from racing a healthy, still-in-progress transfer." },
          { value: "alert on reservations older than 5x TTL", explain: "The threshold this job itself is monitored against, in case it falls behind." },
        ],
        breaks: {
          failure: "Cancelling a lease that is still live races a delayed Confirm.",
          handled: "The lease id in Confirm's WHERE clause is what makes the loser fail loudly instead of half-applying the transfer.",
        },
      },
    },
    {
      id: "e8",
      from: "shard-a",
      to: "ledger",
      tier: "hot",
      step: 5,
      label: "Confirm: debit entry",
      detail: {
        what: "Confirm on the sender: clear the reservation and insert the debit row in the same local transaction.",
        why: "The entry lands at Confirm, not at Try, and that placement is the trick. The instant a reservation stops existing its entry exists, so there is no window where a hold is gone and the ledger has not caught up.",
        numbers: [{ value: "idempotent: 1 write per (transfer_id, side)", explain: "The guarantee that prevents this Confirm from ever double-writing on retry." }],
        breaks: {
          failure: "Splitting the hold-clear and the insert into two transactions reintroduces exactly the window the design removed.",
          handled: "It would be invisible until reconciliation caught it an hour later, which is why both writes are required to land in the same local transaction.",
        },
      },
    },
    {
      id: "e9",
      from: "shard-b",
      to: "ledger",
      tier: "hot",
      step: 6,
      label: "Confirm: credit entry",
      detail: {
        what: "Confirm on the receiver: move pending into balance and insert the matching credit sharing the debit's reference.",
        why: "Paired rows with one reference are what make sum(debits) == sum(credits) true by construction rather than by discipline. There is no code path anywhere that writes one entry without the other.",
        breaks: {
          failure: "A half-confirmed transfer leaves one entry committed.",
          handled: "That is fine only because the other side's reservation is still live and will either confirm or expire, never left in an ambiguous state.",
        },
      },
    },
    {
      id: "e10",
      from: "shard-b",
      to: "hot-account",
      tier: "data",
      label: "credits hashed 16 ways",
      detail: {
        what: "Credits to a popular merchant routed onto one of sixteen sub-balance rows instead of a single account row.",
        why: "One row commits 500-1,000 writes/s and a 3,000/s merchant does not queue gracefully past that, it thrashes. Splitting the row is the fix that leaves the ledger untouched: entries are still one per movement, still referencing the logical account.",
        numbers: [
          { value: "3,000 credits/s peak", explain: "The write rate a busy merchant can drive against this account." },
          { value: "N = 16 gives ~190/s per row", explain: "The resulting per-row load once traffic is spread across sixteen sub-balances." },
          { value: "reads sum 16 rows", explain: "The read-side cost of this split: any balance query must aggregate all sixteen." },
        ],
        breaks: {
          failure: "Debits do not spread the same way.",
          handled: "A payout larger than any one sub-balance needs a designated debit row and a background rebalancer moving money between rows the merchant already owns.",
        },
      },
    },
    {
      id: "e11",
      from: "ledger",
      to: "event-log",
      tier: "data",
      label: "committed entries",
      detail: {
        what: "One domain event per committed entry, captured from the write-ahead log rather than polled from a table.",
        why: "It is how fraud scoring, notifications and analytics see money movement without any of them sitting on the transfer's critical path. Capture is from the log so the delay is bounded by replication rather than by a poll interval.",
        numbers: [
          { value: "480M events/day", explain: "480M x 400B ≈ 190GB/day, matching the sibling figure; the volume fraud scoring, notifications and analytics read instead of the ledger." },
          { value: "~190GB/day at ~400B per event", explain: "The daily bandwidth this stream generates from ledger activity." },
        ],
        breaks: {
          failure: "Publication lagging the commit means consumers see a stale world.",
          handled: "Reconciliation catches it by diffing committed entry counts against stream offsets per shard, rather than trusting the stream blindly.",
        },
      },
    },
    {
      id: "e12",
      from: "ledger",
      to: "reconciler",
      tier: "control",
      label: "running entry totals",
      detail: {
        what: "The per-account running total of entries, maintained in the same transaction as each insert, read hourly by the check.",
        why: "Aggregating 20M entries an hour across 128 shards is the naive version and it does not stay cheap. Keeping the total as a column makes the hourly check a comparison, and a full scan runs nightly as a check on the running total itself.",
        numbers: [
          { value: "20M entries per hourly window", explain: "The volume the reconciler would otherwise have to sum from scratch every hour." },
          { value: "1 full scan per night, nothing hourly", explain: "The much cheaper cadence this running-total design allows for the hourly check itself." },
        ],
        breaks: {
          failure: "If the running total is maintained anywhere other than the entry's own transaction, it becomes a third thing that can drift.",
          handled: "The check no longer proves anything in that case, which is why the total is written exclusively inside the same transaction as the entry insert.",
        },
      },
    },
    {
      id: "e13",
      from: "shard-a",
      to: "reconciler",
      tier: "control",
      label: "balance column",
      detail: {
        what: "The materialised balance read back and compared against the ledger's total for that account.",
        why: "This is the comparison that catches a materialisation bug. Entries are truth and the balance is a cache, so any disagreement means the balance is wrong, never the entries.",
        numbers: [
          { value: "128 shards checked hourly", explain: "The scope this comparison runs across on every cycle." },
          { value: "any non-zero drift is incident-grade", explain: "The strict threshold this comparison is held to." },
        ],
        breaks: {
          failure: "The check racing an in-flight Confirm produces a false positive.",
          handled: "Acting on the first mismatch freezes accounts that were about to be fine, so the job re-runs after a delay and freezes debits only on genuine drift.",
        },
      },
    },
    {
      id: "e14",
      from: "wallet-svc",
      to: "shard-a",
      tier: "data",
      label: "leader balance read",
      detail: {
        what: "A balance query answered from the shard leader, returning available (balance - reserved), pending in, and total as three separate numbers.",
        why: "Leader reads are affordable here, so the argument is not cost but direction: a stale read shows money that is already gone, and pending must never be presented as spendable.",
        numbers: [
          { value: "~12k reads/s peak", explain: "12k / 128 shard leaders ≈ 94 reads/s each, matching the sibling figure — thin enough that reading the leader directly is affordable." },
          { value: "<100 reads/s per shard leader", explain: "How thin that load is once spread across the 128 shard leaders." },
        ],
        breaks: {
          failure: "Collapsing the three numbers into one.",
          handled: "A user who sees pending folded into their balance will try to spend it, and the spend correctly fails against available, so the three figures are kept visibly separate.",
        },
      },
    },
  ],
};
