import type { Diagram } from "./types";

export const DIGITAL_WALLET: Diagram = {
  id: "digital-wallet",
  title: "Digital Wallet",
  question: "Design a Digital Wallet",
  sourceId: "patterns",
  itemId: 24,
  overview: {
    shape:
      "A wallet is a double-entry ledger with a cache in front of it: every movement writes a debit and a matching credit, and the balance the user sees is a materialised sum that can always be rebuilt from those entries.",
    beats: [
      "Balances are never authoritative. The ledger is append-only, rows are inserted and never updated or deleted, and accounts.balance is a materialised sum of it. That inversion is the whole answer, and it is why reversals, disputes and a seven-year audit are answerable at all.",
      "Accounts are sharded by user_id % 128, which is what makes 10k transfers/s possible and is also what creates the problem. A random pair shares a shard under 1% of the time, so cross-shard is the design rather than the exception, and every latency and capacity number should be quoted for that path.",
      "Same shard is one local ACID transaction and the fast path at roughly 5ms: a conditional update that deducts only if the funds exist, plus the two ledger rows, committed together. The predicate lives inside the UPDATE, which is what makes double-spend structurally impossible rather than merely unlikely.",
      "Cross shard is reserve-then-confirm, the pattern known as TCC. Try moves money from available into reserved on the sender and into pending on the receiver, writing no ledger entry; Confirm clears the hold and inserts the entry in the same local transaction. Four small local transactions in two rounds, about 20ms.",
      "Every reservation carries a 30s deadline and the orchestrator's lease id, so a coordinator that dies leaves a row that expires rather than a frozen account, and a stale Confirm arriving after the sweeper matches zero rows instead of half-applying the transfer.",
      "Hourly per-shard reconciliation proves that the sum of entries equals the balance row. Drift freezes the account and pages a human, and never self-corrects, because an auto-corrector is a background job with unreviewed write access to every balance in the system.",
    ],
    crux:
      "Making one transfer atomic across two shards without a coordinator that can freeze somebody's money. A distributed transaction holds locks across the network; a plain compensating saga exposes a window where the money is in neither account, and a balance read in that window returns a number that was never true.",
    numbers: [
      "10k transfers/s peak, >90% cross-shard",
      "480M ledger entries/day, ~370TB over 7 years",
      "one balance row absorbs 500-1,000 writes/s",
    ],
  },
  nodes: [
    {
      id: "shard-cluster",
      label: "128 Postgres shards, user_id % 128",
      kind: "group",
      x: 24,
      y: 324,
      w: 672,
      h: 248,
      detail: {
        what: "The transactional core: account rows and their ledger entries, split across 128 shards by user id.",
        why: "Sharding is what makes 10k transfers/s reachable and it is also the source of the entire problem, because two users in one transfer usually live on two servers with no shared transaction between them.",
        numbers: ["128 shards", "P(same shard) = 1/128 = 0.8%", "~450GB account state at RF=3"],
      },
    },
    {
      id: "client",
      label: "Client",
      sub: "app, terminal, transit gate",
      kind: "external",
      x: 40,
      y: 0,
      w: 280,
      detail: {
        what: "The app or terminal that submits a transfer and renders a balance.",
        why: "It is drawn because it sets two constraints the rest of the design answers to: it retries on any network blip, so every request needs a key, and it shows a number to a human, so a balance that reads high is a different category of defect from one that reads low.",
        numbers: ["~10 balance checks per active user per day", "30M daily active users"],
        breaks:
          "A retried POST that the client believes failed but the server committed. Without an idempotency key that retry is a second transfer, and the user is debited twice.",
      },
    },
    {
      id: "wallet-svc",
      label: "Wallet service",
      sub: "idempotency, caps, balance reads",
      kind: "compute",
      x: 40,
      y: 100,
      w: 280,
      detail: {
        what: "The stateless API tier: deduplicates on the idempotency key, enforces the O(1) hard rules, and serves balance reads from the shard leader.",
        why: "Everything statistical has to stay off the hot path at 10k/s, so this tier enforces only blocked-account checks and per-user daily caps, plus a velocity_counters row bumped in the same transaction as the balance so the count cannot drift from reality.",
        numbers: ["~10k transfers/s peak", "~12k balance reads/s peak", "<100 leader reads/s per shard"],
        breaks:
          "Putting a fraud model inline. Its outage becomes a wallet outage, so anything scored inline needs a fail-open default and a budget under 5ms.",
        choice: {
          pick: "Strongly consistent balance reads from the shard leader, shown as three numbers: available (balance - reserved), pending in, and total",
          instead: "Follower or cache reads at 100-500ms staleness, with the spend path re-checking authoritatively at write time anyway.",
          decider:
            "Not cost, and that is the point: 300M reads/day is ~3.5k/s average and ~12k/s peak, which across 128 shards is under 100 reads/s per leader against the write load. What remains is direction. A stale read after a debit shows money that is already gone, and a balance that reads high is a different category of defect to users and regulators.",
          flips:
            "Reads outnumber writes by more than roughly 100:1, or the reader sits 80ms from the leader and the number is decoration. Never where the read is the authorisation, such as an offline transit gate.",
        },
      },
    },
    {
      id: "idempotency",
      label: "Idempotency store",
      sub: "replicated KV, 24h TTL",
      kind: "store",
      x: 440,
      y: 100,
      w: 240,
      detail: {
        what: "One key per transfer request, holding the stored response, deduplicated for 24 hours.",
        why: "A client that times out cannot tell a lost request from a committed one, so it retries. Collapsing retries to one logical movement is what makes the API safe to call twice, and the window has to be long enough to outlive a client's whole retry schedule.",
        numbers: ["10k/s x 86,400 = 864M keys/day", "~500B stored response", "~430GB peak"],
        breaks:
          "Expiring the key before the client stops retrying. A retry arriving at hour 25 is indistinguishable from a new transfer and moves the money a second time.",
        choice: {
          pick: "A replicated key-value store with a 24h TTL on every key",
          instead: "A unique index on idempotency_key in the account shard itself.",
          decider:
            "Where the key lives relative to the transaction it protects. A unique index is free correctness for same-shard transfers, but 864M keys/day of dead rows land in the OLTP store that is already carrying 10k transfers/s, and a cross-shard transfer has no single shard to own the key. A separate store with a TTL expires them for you.",
          flips:
            "Same-shard-only wallets at a few hundred transfers per second, where the unique index is one less system to run and the transaction that inserts the key is the transaction that moves the money.",
        },
      },
    },
    {
      id: "orchestrator",
      label: "Transfer orchestrator",
      sub: "same shard -> ACID, else TCC",
      kind: "compute",
      x: 40,
      y: 200,
      w: 280,
      detail: {
        what: "The durable three-phase state machine: Try on both sides, then Confirm on both sides, with Cancel as the failure branch.",
        why: "This is the only place that knows a transfer is one thing rather than two independent writes. Its state is persisted between phases so a crash resumes from the last phase rather than restarting, and Confirm and Cancel are idempotent on (transfer_id, side) so a resumed run cannot double-apply.",
        numbers: ["4 local transactions in 2 rounds, ~20ms", "same-shard fast path ~5ms", ">90% of transfers take the TCC path"],
        breaks:
          "Dying between Try and Confirm. The reservation TTL is the backstop for a genuinely dead orchestrator, not the primary recovery path, and the two racing is a real failure the lease id exists to settle.",
        choice: {
          pick: "A durable workflow engine such as Temporal driving TCC, with the same-shard case short-circuited to one local transaction",
          instead: "An ad-hoc state column plus a cron job re-driving stuck transfers.",
          decider:
            "Whether the state machine survives its own process. With >90% of transfers crossing shards at 10k/s, a resumable phase log is the difference between a crash costing one transfer and a crash costing every transfer in flight; ~200 reservations are open at any instant in steady state and 300k in a full fleet stall.",
          flips:
            "Same-shard-only or single-node wallets, where there is no second phase to orchestrate and the whole transfer is one begin/commit.",
        },
      },
    },
    {
      id: "sweeper",
      label: "Reservation sweeper",
      sub: "30s TTL, lease-aware cancel",
      kind: "compute",
      x: 440,
      y: 200,
      w: 240,
      detail: {
        what: "The background job that cancels reservations whose deadline has passed, returning reserved money to the sender's available balance.",
        why: "It is what makes the design operable at 3am: a crashed orchestrator leaves behind a row with a deadline rather than a permanently frozen account, and nobody has to be woken to unfreeze a user's funds.",
        numbers: ["30s TTL for retail transfers", "alert on any reservation older than 5x TTL", "~30MB of rows even in a full stall"],
        breaks:
          "Racing a late Confirm. The sweeper cancels at TTL, the stalled orchestrator wakes and confirms a reservation that no longer exists, and done naively that credits the receiver against money already returned.",
        choice: {
          pick: "Cancel only leases provably expired, and make Confirm run WHERE reservation_id = ? AND lease_id = ?",
          instead: "A plain expires_at sweep with no lease, relying on the TTL being longer than any possible stall.",
          decider:
            "What a late Confirm does. With a 30s TTL and no lease, a stalled orchestrator's Confirm half-applies the transfer silently; with the lease in the predicate it matches zero rows and fails into the transfer's failure path. A cancelled_by column keeps sweeper cancellations distinguishable during a post-mortem.",
          flips:
            "Never inside a wallet. A fencing token is the more rigorous version of the same rule, and the rule itself does not flip: the losing party must fail loudly, not silently succeed.",
        },
      },
    },
    {
      id: "shard-a",
      label: "Account shard A (sender)",
      sub: "balance, reserved, pending, version",
      kind: "store",
      x: 40,
      y: 340,
      w: 280,
      detail: {
        what: "The sender's shard: one row per (user_id, currency) carrying balance, reserved, pending and a version for optimistic concurrency.",
        why: "Reserved and pending are the entire cross-shard coordination mechanism, and there is no distributed lock anywhere. Reserved is money committed but not sent, pending is money about to arrive and not yet spendable, and available is balance - reserved.",
        numbers: ["~500B per row", "100M users x 3 currency rows = ~150GB", "~450GB at RF=3"],
        breaks:
          "Concurrent double-spend if the check is separated from the deduction. Two $80 and $70 debits against $100 both read the balance, both conclude there is enough, and the account goes $50 overdrawn.",
        choice: {
          pick: "UPDATE accounts SET available = available - 80, reserved = reserved + 80 WHERE user_id = ? AND available >= 80",
          instead: "Read the balance, decide in application code, then write; or take a row lock with SELECT FOR UPDATE first.",
          decider:
            "Whether a window exists between the check and the deduction. As one statement there is no between: the second concurrent transfer sees available = 20, the predicate fails, 0 rows update and the Try fails cleanly. A read-then-write version of the same logic is broken under any concurrency at all, and this needs no explicit lock at 1-2ms per commit.",
          flips:
            "Sustained contention on one account, where the optimistic retries themselves become the problem and that account moves to a pessimistic SELECT FOR UPDATE path or gets split.",
        },
      },
    },
    {
      id: "shard-b",
      label: "Account shard B (receiver)",
      sub: "Try writes pending, no entry",
      kind: "store",
      x: 440,
      y: 340,
      w: 240,
      detail: {
        what: "The receiver's shard. Try increments pending and writes no ledger entry; Confirm moves pending into balance and inserts the credit in the same local transaction.",
        why: "Putting the entry at Confirm rather than Try is the whole trick. The funds were checked and set aside at Try, so Confirm cannot fail for business reasons and the only reason it retries is infrastructure.",
        numbers: ["Try and Confirm are 1-2ms local transactions", "idempotent on (transfer_id, side)"],
        breaks:
          "A receiver whose account is frozen fails its Try, which forces a Cancel of the sender's already-successful Try. That branch is the one worth testing, because it is the only place Cancel runs on the happy shard.",
        choice: {
          pick: "Reserve then confirm (TCC): pending on the receiver, entries written only at Confirm",
          instead: "A plain compensating saga: credit the receiver, and write a reversing entry if it fails.",
          decider:
            "Where the money sits between the two steps. A saga has a real window, roughly the 10-20ms between the debit and the credit and unbounded if the credit is retried, where the amount is in neither account, and any of the 12k balance reads/s landing in it returns a number that was never true. A hold is visible, non-spendable and accounted for at every instant, which is what sum(debits) == sum(credits) at every instant actually requires.",
          flips:
            "When one side is a system you do not control and reservation is impossible, such as a card rail. That is a different question, and there the compensating saga is correct.",
        },
      },
    },
    {
      id: "ledger",
      label: "Ledger entries",
      sub: "append-only, no DELETE grant",
      kind: "store",
      x: 40,
      y: 460,
      w: 280,
      detail: {
        what: "The system of record: two rows per movement, a debit and a matching credit sharing a reference, never edited and never deleted.",
        why: "The invariant sum(debits) == sum(credits) holds by construction because no code path writes one entry alone. Deposits and withdrawals are not exceptions either; they are transfers against a system account, so nothing enters or leaves without a counterparty row.",
        numbers: ["480M entries/day", "~300B/entry, ~145GB/day raw", "7-year retention, ~370TB raw, ~75TB cold"],
        breaks:
          "Any grant that lets an application role update or delete a row. The moment history is mutable, the audit trail is an opinion rather than a record.",
        choice: {
          pick: "Append-only entries with a materialised accounts.balance, reconciled hourly",
          instead: "Summing the entries on every read, so the balance is derived rather than stored.",
          decider:
            "Arithmetic. A five-year-old account holds on the order of 15,000 entries, and at 12k balance reads/s that is 180M row reads/s to compute a number you could have stored. So the balance is a cache, and the design's job is to make it provably correct rather than hopefully correct.",
          flips:
            "Low-volume or short-lived accounts, where the entry count per account stays small. The middle ground is a periodic checkpoint entry recording balance_after, so a rebuild sums only entries since the checkpoint.",
        },
      },
    },
    {
      id: "hot-account",
      label: "Hot account sub-balances",
      sub: "merchant split 16 ways",
      kind: "store",
      x: 440,
      y: 460,
      w: 240,
      detail: {
        what: "A popular merchant's balance split into 16 rows, merchant_X:0 through merchant_X:15, with each credit hashed onto one and reads summing all sixteen.",
        why: "A single balance row is a single-row write, so its ceiling is roughly one committed transaction per transaction duration. Past that, optimistic retries thrash: every retry re-reads a version that has already moved, so goodput falls as offered load rises rather than plateauing.",
        numbers: ["one row absorbs 500-1,000 writes/s at 1-2ms", "a 3,000 credits/s merchant needs N >= 6", "N = 16 gives ~190/s per row"],
        breaks:
          "Debits. A single large payout may exceed any one sub-balance, so debits route through a designated row and a background rebalancer levels the sixteen with internal transfers.",
        choice: {
          pick: "Split the hot account into 16 sub-balances, raised automatically once contention crosses a threshold",
          instead: "A write-behind aggregator accumulating that account's credits in memory and flushing one transaction every 50ms.",
          decider:
            "The single-row write ceiling of 1/(transaction duration), so 500-1,000 writes/s at 1-2ms. A 3,000/s merchant is 3-6x over. The aggregator gets a larger reduction, collapsing 150 writes into one, but it holds committed-to-the-user money in one process's memory and is a second write path with its own failure modes.",
          flips:
            "Credit-only accounts that are rarely read, such as a platform fee or treasury float, where nobody notices 50ms of lag. Splitting is actively wrong there, because a treasury account is also debited and spread debits need a rebalancer nobody wants to own.",
        },
      },
    },
    {
      id: "reconciler",
      label: "Reconciliation job",
      sub: "hourly per shard, freeze on drift",
      kind: "compute",
      x: 40,
      y: 580,
      w: 280,
      detail: {
        what: "The hourly per-shard check that sum(ledger_entries.amount) equals accounts.balance, that debits equal credits globally, and that every committed entry reached the event stream.",
        why: "The balance is a cache, so this is the job that turns 'probably correct' into 'proven correct on a schedule'. The invariant is deliberately not balance + reserved: reserved money has no entries because it has not moved.",
        numbers: ["hourly window = 20M entries", "100M account rows across 128 shards", "drift is incident-grade at any magnitude"],
        breaks:
          "Freezing a real person out of their own money on a false positive, because a check that races an in-flight Confirm sees a mismatch that would have resolved itself. Re-run after a short delay, and freeze debits only so the account is degraded rather than dead.",
        choice: {
          pick: "Freeze the account and page, correcting only with an audited adjustment entry and human sign-off",
          instead: "Auto-correct the balance to match the entries, since the entries are known to be truth.",
          decider:
            "What the corrector would be. A job that rewrites balances without review has unreviewed write access to all 100M accounts and a mandate to change them, which is a description of the worst possible bug in this system. A silent corrector is a silent thief.",
          flips:
            "Never for balances. The cheap half does flip: keep a running per-account entry total updated in the same transaction as the insert so the hourly check is a column comparison, and full-scan only nightly.",
        },
      },
    },
    {
      id: "dist-sql",
      label: "Distributed SQL (2PC)",
      sub: "the alternative, not deployed",
      kind: "store",
      x: 440,
      y: 580,
      w: 240,
      detail: {
        what: "The road not taken: put every shard in one Spanner, CockroachDB or Yugabyte cluster and write the transfer as a single begin/commit, letting the store run two-phase commit internally.",
        why: "It is drawn because it is genuinely the better answer under conditions many wallets actually meet, and because the reflex that 2PC is always wrong is itself wrong. It is strictly less code, with no sweeper to operate and no three-phase state machine to test.",
        numbers: ["one region: rows locked ~2-5ms, ~50 locked rows at 10k/s", "cross-region: 60-150ms per transfer", "a hot row caps at 1/0.06 = ~16 transfers/s"],
        breaks:
          "A stalled coordinator holds row locks on both shards until an operator intervenes, queueing everything that touches those two accounts behind it.",
        choice: {
          pick: "Application-level TCC, whose locks are held only inside each Try for 1-2ms and whose durable state is a column with a deadline",
          instead: "The store's internal two-phase commit across one distributed-SQL cluster.",
          decider:
            "How long a lock may be held across the network, and what happens when the coordinator stalls. Single region, 2PC adds about one consensus round trip, so ~50 rows out of 300M are locked at any instant, which is nothing. Cross-region the same round trip is 60-150ms, capping a hot account at ~16 transfers/s, and a stalled coordinator needs a human.",
          flips:
            "All shards in one cluster in one region, peak of a few thousand transfers/s, and no account above a few hundred writes/s. Then take the distributed transaction. It stops winning the day you go multi-region or a merchant gets popular.",
        },
      },
    },
    {
      id: "event-log",
      label: "Event stream",
      sub: "Kafka, fed by logical decoding",
      kind: "bus",
      x: 40,
      y: 700,
      w: 640,
      detail: {
        what: "A partitioned durable log carrying one domain event per committed ledger entry to fraud scoring, notifications, analytics and the archive.",
        why: "It keeps every non-transactional consumer off the OLTP path. Statistical fraud detection, graph anomalies and device clustering all run here and escalate to step-up auth or a hold, rather than adding latency to all 10k/s.",
        numbers: ["480M events/day x ~400B = ~190GB/day", "7-day hot retention = ~1.3TB, ~4TB at RF=3", "archive to columnar storage after 90 days"],
        breaks:
          "Consumer lag exactly when freshness matters. Fraud and notification consumers see a stale world during the load spike that produced the fraud, and relay health proves nothing about it.",
        choice: {
          pick: "Stream from the write-ahead log via logical decoding",
          instead: "An outbox table written in the transaction and forwarded by a polling relay.",
          decider:
            "What bounds the delay. Polling makes it a function of the poll interval, and at 480M entries/day the relay is the thing that falls behind under exactly the load you care about; log-based capture makes it a function of replication throughput. Note this moves the bound rather than removing it, so the alert is consumer lag measured at the consumer, not relay lag.",
          flips:
            "Stores with no usable logical decoding, or event volumes low enough that a poll every 100ms is free. The outbox is also easier to reason about when the event payload is not a row image.",
        },
      },
    },
  ],
  edges: [
    {
      id: "e1",
      from: "client",
      to: "wallet-svc",
      label: "POST /transfer",
      animated: true,
      detail: {
        what: "A transfer request carrying from, to, amount, currency and an idempotency-key header.",
        why: "The key is on the request rather than generated server-side because only the client knows that its second attempt is a retry of its first. Without it, a network timeout on a committed transfer becomes a duplicate payment.",
        numbers: ["~10k requests/s peak", "240M money movements/day"],
        breaks:
          "A client that generates a fresh key per retry defeats the whole mechanism, so key generation belongs to the logical operation, not to the HTTP attempt.",
      },
    },
    {
      id: "e2",
      from: "wallet-svc",
      to: "idempotency",
      label: "key claim, 24h TTL",
      dashed: true,
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "Claiming the idempotency key before any money moves, and replaying the stored response if it is already present.",
        why: "This has to happen before validation and before the orchestrator, because the whole point is that a duplicate never reaches the state machine. A key already claimed returns the original result rather than starting a second transfer.",
        numbers: ["864M keys/day", "~430GB peak"],
        breaks:
          "A claim that succeeds and then a crash before the transfer is recorded leaves a key with no response behind it, so the stored value has to include the transfer's terminal state, not just the key.",
      },
    },
    {
      id: "e3",
      from: "wallet-svc",
      to: "orchestrator",
      label: "validated transfer",
      animated: true,
      detail: {
        what: "A deduplicated, cap-checked transfer handed to the state machine that will actually move the money.",
        why: "The split exists so the API tier stays stateless and horizontally scalable while the phase state lives somewhere durable. Everything upstream of this arrow is cheap and repeatable; everything downstream is not.",
        breaks:
          "If the orchestrator accepts before the transfer row is durable, a crash here loses a request the client believes was accepted, and only the client's retry recovers it.",
      },
    },
    {
      id: "e4",
      from: "orchestrator",
      to: "shard-a",
      label: "Try: available -> reserved",
      animated: true,
      detail: {
        what: "The sender-side Try: one local transaction moving the amount out of available and into reserved, incrementing version.",
        why: "This is the conditional update that prevents double-spend, and it writes no ledger entry because no money has moved yet. The funds are set aside here so that Confirm later cannot fail for any business reason.",
        numbers: ["1-2ms local transaction", "0 rows updated means insufficient funds"],
        breaks:
          "If this succeeds and the receiver's Try then fails, the sender is holding a reservation that must be cancelled, which is the one branch where Cancel runs against a shard that did nothing wrong.",
      },
    },
    {
      id: "e5",
      from: "orchestrator",
      to: "shard-b",
      label: "Try: pending += amount",
      animated: true,
      fromSide: "right",
      toSide: "top",
      detail: {
        what: "The receiver-side Try: one local transaction incrementing pending, run in parallel with the sender's Try.",
        why: "Pending is money the receiver is about to get but cannot spend, which is what lets the transfer be visible and honest before it is final. Two independent local transactions in one round is the whole reason no distributed lock is needed.",
        numbers: ["both Trys in one round, ~20ms end to end"],
        breaks:
          "A frozen or closed receiving account fails here after the sender's Try succeeded, so this arrow is the trigger for the Cancel branch rather than a simple abort.",
      },
    },
    {
      id: "e6",
      from: "orchestrator",
      to: "sweeper",
      label: "lease id + 30s deadline",
      dashed: true,
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "The reservation rows the orchestrator writes, each carrying its lease id and expires_at, which is what the sweeper reads.",
        why: "Making the deadline a column rather than a timer in the orchestrator's memory is what lets a completely dead process still release money. The durable state cleans itself up without anyone being paged.",
        numbers: ["30s TTL for retail transfers", "quote TTL of 5-30s for cross-currency"],
        breaks:
          "Binding a cross-currency reservation to the default 30s rather than the quote's TTL hands the user a free option: confirm when the market moved their way, abandon when it did not.",
      },
    },
    {
      id: "e7",
      from: "sweeper",
      to: "shard-a",
      label: "cancel expired holds",
      dashed: true,
      fromSide: "bottom",
      toSide: "right",
      detail: {
        what: "Returning reserved money to available for reservations whose lease is provably expired, stamping cancelled_by so it is distinguishable later.",
        why: "This is the backstop that makes a crashed orchestrator survivable without a human. It emits nothing to the ledger, because a reservation is an application-level hold and no money ever moved.",
        numbers: ["cancels only after the 30s deadline", "alert on reservations older than 5x TTL"],
        breaks:
          "Cancelling a lease that is still live races a delayed Confirm. The lease id in Confirm's WHERE clause is what makes the loser fail loudly instead of half-applying.",
      },
    },
    {
      id: "e8",
      from: "shard-a",
      to: "ledger",
      label: "Confirm: debit entry",
      animated: true,
      detail: {
        what: "Confirm on the sender: clear the reservation and insert the debit row in the same local transaction.",
        why: "The entry lands at Confirm, not at Try, and that placement is the trick. The instant a reservation stops existing its entry exists, so there is no window where a hold is gone and the ledger has not caught up.",
        numbers: ["idempotent on (transfer_id, side)"],
        breaks:
          "Splitting the hold-clear and the insert into two transactions reintroduces exactly the window the design removed, and it would be invisible until reconciliation caught it an hour later.",
      },
    },
    {
      id: "e9",
      from: "shard-b",
      to: "ledger",
      label: "Confirm: credit entry",
      animated: true,
      fromSide: "bottom",
      toSide: "right",
      detail: {
        what: "Confirm on the receiver: move pending into balance and insert the matching credit sharing the debit's reference.",
        why: "Paired rows with one reference are what make sum(debits) == sum(credits) true by construction rather than by discipline. There is no code path anywhere that writes one entry without the other.",
        breaks:
          "A half-confirmed transfer leaves one entry committed, and that is fine only because the other side's reservation is still live and will either confirm or expire.",
      },
    },
    {
      id: "e10",
      from: "shard-b",
      to: "hot-account",
      label: "credits hashed 16 ways",
      detail: {
        what: "Credits to a popular merchant routed onto one of sixteen sub-balance rows instead of a single account row.",
        why: "One row commits 500-1,000 writes/s and a 3,000/s merchant does not queue gracefully past that, it thrashes. Splitting the row is the fix that leaves the ledger untouched: entries are still one per movement, still referencing the logical account.",
        numbers: ["3,000 credits/s peak", "N = 16 gives ~190/s per row", "reads sum 16 rows"],
        breaks:
          "Debits do not spread the same way. A payout larger than any one sub-balance needs a designated debit row and a background rebalancer moving money between rows the merchant already owns.",
      },
    },
    {
      id: "e11",
      from: "ledger",
      to: "event-log",
      label: "committed entries",
      detail: {
        what: "One domain event per committed entry, captured from the write-ahead log rather than polled from a table.",
        why: "It is how fraud scoring, notifications and analytics see money movement without any of them sitting on the transfer's critical path. Capture is from the log so the delay is bounded by replication rather than by a poll interval.",
        numbers: ["480M events/day", "~190GB/day at ~400B per event"],
        breaks:
          "Publication lagging the commit means consumers see a stale world. Reconciliation catches it by diffing committed entry counts against stream offsets per shard.",
      },
    },
    {
      id: "e12",
      from: "ledger",
      to: "reconciler",
      label: "running entry totals",
      dashed: true,
      detail: {
        what: "The per-account running total of entries, maintained in the same transaction as each insert, read hourly by the check.",
        why: "Aggregating 20M entries an hour across 128 shards is the naive version and it does not stay cheap. Keeping the total as a column makes the hourly check a comparison, and the full scan runs nightly as a check on the running total itself.",
        numbers: ["20M entries per hourly window", "full scan nightly only"],
        breaks:
          "If the running total is maintained anywhere other than the entry's own transaction, it becomes a third thing that can drift, and the check no longer proves anything.",
      },
    },
    {
      id: "e13",
      from: "shard-a",
      to: "reconciler",
      label: "balance column",
      dashed: true,
      fromSide: "left",
      toSide: "left",
      offset: 90,
      detail: {
        what: "The materialised balance read back and compared against the ledger's total for that account.",
        why: "This is the comparison that catches a materialisation bug. Entries are truth and the balance is a cache, so any disagreement means the balance is wrong, never the entries.",
        numbers: ["hourly, per shard", "any non-zero drift is incident-grade"],
        breaks:
          "The check racing an in-flight Confirm produces a false positive, so acting on the first mismatch freezes accounts that were about to be fine. Re-run after a delay, and freeze debits only.",
      },
    },
    {
      id: "e14",
      from: "wallet-svc",
      to: "shard-a",
      label: "leader balance read",
      dashed: true,
      fromSide: "left",
      toSide: "left",
      offset: 160,
      detail: {
        what: "A balance query answered from the shard leader, returning available (balance - reserved), pending in, and total as three separate numbers.",
        why: "Leader reads are affordable here, so the argument is not cost but direction: a stale read shows money that is already gone, and pending must never be presented as spendable.",
        numbers: ["~12k reads/s peak", "<100 reads/s per shard leader"],
        breaks:
          "Collapsing the three numbers into one. A user who sees pending folded into their balance will try to spend it, and the spend correctly fails against available.",
      },
    },
    {
      id: "e15",
      from: "orchestrator",
      to: "dist-sql",
      label: "alternative: one commit",
      dashed: true,
      fromSide: "right",
      toSide: "right",
      offset: 130,
      detail: {
        what: "The design branch not taken: hand the whole transfer to one distributed-SQL cluster as a single begin/commit and let it run 2PC internally.",
        why: "It removes the orchestrator, the sweeper and the reservation columns entirely, which is a lot of code and operational surface for a system whose only job is to be correct. Worth stating out loud rather than dismissing by reflex.",
        numbers: ["one region: ~2-5ms of lock per transfer", "cross-region: 60-150ms, ~16 transfers/s per hot row"],
        breaks:
          "The coordinator. A stall holds locks on both shards until an operator intervenes, whereas a TCC reservation holds nothing and expires on its own.",
      },
    },
  ],
};
