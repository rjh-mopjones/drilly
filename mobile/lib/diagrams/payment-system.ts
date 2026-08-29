import type { Diagram } from "./types";

export const PAYMENT_SYSTEM: Diagram = {
  id: "payment-system",
  title: "Payment System",
  question: "Design a Payment System",
  sourceId: "patterns",
  itemId: 23,
  overview: {
    shape:
      "A durable workflow in front of an external processor you cannot roll back, an append-only double-entry ledger as the internal source of truth, and a nightly reconciliation against the processor's own settlement report.",
    beats: [
      "Nothing external happens until something durable is written. The charge arrives with a client-generated idempotency key scoped to one purchase attempt, and the API commits a row holding that key, a hash of the request body and a recovery point before the first outbound call. Same key with the same body returns the stored response; same key with a different body is a 422, because a recycled key is a client bug and charging silently under it is worse than failing loudly.",
      "The orchestrator runs the saga in order: risk score, authorize, paired ledger entries, capture. Each recovery point commits in the same database transaction as the work it describes, so recorded progress can lag reality but can never lead it. A resumed workflow reading psp_authorized knows the hold exists; one reading risk_scored knows nothing about authorize, which is exactly the right amount of doubt.",
      "Two-phase commit is not available, so failures unwind with compensations instead. The number of external participants exposing a prepare-and-commit call is zero: Visa, Mastercard and every PSP layered on them offer authorize, capture and void and nothing else. Compensations run backwards, are extra ledger entries rather than edits, and are keyed on charge_id and step so running one twice is a no-op.",
      "The hard branch is a capture that times out after 4s, where you genuinely cannot tell whether money moved. The charge moves into requires_verification, a real state rather than an error bucket, and a worker queries the PSP by the same key on a backoff until the outcome is known. Only then does the workflow confirm or compensate, because voiding a charge the PSP already captured wedges the saga with live money on one side.",
      "The ledger is paired debits and credits, append only, with balances derived and checkpointed rather than a column you overwrite. That is what lets you reconstruct any account as at any instant across a 7-year retention window, and it costs roughly 3 entries at 500B per payment. Webhooks arrive at-least-once and unordered, so handlers only enqueue transition requests that the orchestrator validates against the state machine.",
      "Reconciliation is a designed component, not an operational afterthought. A daily job joins the processor's settlement rows against your charges on psp_charge_id and alerts on anything unmatched, which bounds how long a silent discrepancy can hide to 24 hours. A row in their report with no row in yours means a card was charged and you have no record of it.",
    ],
    crux:
      "The external world can succeed while your write fails, and you cannot tell that case apart from the call never arriving. Every serious decision here follows from that: idempotency keys so a repeat is absorbed, recovery points so progress never overstates reality, verification before compensation so you never unwind a state you did not observe, and reconciliation because some fraction will still slip through.",
    numbers: [
      "1B payments/yr, ~2.3k/s peak, provision 3k/s",
      "PSP authorize p99 1.2s inside a 3s checkout budget",
      "idempotency TTL 24h vs a 120-day chargeback window",
    ],
  },
  nodes: [
    {
      id: "saga-zone",
      label: "Durable saga",
      kind: "zone",
      detail: {
        what: "The workflow engine and its verification worker: the only components allowed to transition a charge.",
        why: "Every other box either hands work in or is called by the saga. Concentrating state transitions in one owner is what stops a webhook handler and a retry from both deciding the outcome of the same charge.",
        numbers: ["recovery points: started, risk_scored, psp_authorized, ledger_recorded, captured, finished"],
        breaks:
          "If anything outside this zone writes charge status directly, the state machine stops being a guarantee and late events start unwinding terminal states.",
      },
    },
    {
      id: "client",
      label: "Client checkout",
      sub: "PSP-hosted fields, own key",
      kind: "external",
      col: 0,
      row: 0,
      detail: {
        what: "The browser or app: it tokenises the card directly with the PSP and generates one idempotency key per purchase attempt.",
        why: "Two things have to happen out here rather than on your servers. Card data must never touch your backend, and the key must survive a retry, which means it belongs to the purchase attempt and not to the HTTP request.",
        numbers: ["one UUID per purchase attempt", "retry factor ~1.15 keys per charge"],
        breaks:
          "A user who taps Pay again after a cold app start gets a fresh key, so two valid authorizations exist for what the human considers one purchase and every rule in this design is satisfied.",
        choice: {
          pick: "Tokenise in PSP-hosted fields so only an opaque token reaches your servers",
          instead: "Accept the raw card number at your API and forward it to the PSP.",
          decider:
            "PCI-DSS scope. Never seeing a PAN keeps you at SAQ-A; a single 16-digit number reaching your logs or an unencrypted backup pushes you to SAQ-D, whose audit cost is roughly an order of magnitude higher and whose remediation runs to months.",
          flips:
            "You are the processor. If you run your own card rails you are in full scope regardless, and the vault is a first-class component rather than something to avoid.",
        },
      },
    },
    {
      id: "api",
      label: "Payment API",
      sub: "validate, key + request hash",
      kind: "service",
      col: 1,
      row: 0,
      detail: {
        what: "The HTTP tier: validates the request, commits the idempotency row, and starts or resumes the workflow.",
        why: "This is the boundary where a retry has to be made harmless. Committing the key and the body hash before any outbound call is what turns an at-least-once network into an at-most-one-charge system.",
        numbers: ["checkout p99 target 3s", "~1.8s of budget left after a 1.2s authorize"],
        breaks:
          "Without the body hash, a client that recycles a key silently receives some other charge's response and believes its new purchase succeeded.",
        choice: {
          pick: "Idempotency-Key header required on every write, stored with a request hash",
          instead: "Server-side deduplication on a natural key such as customer, amount and a time window.",
          decider:
            "Whether two legitimate identical purchases are distinguishable. A fuzzy window of roughly 5 minutes on customer, merchant and amount cannot tell a retry from a second coffee, so it can only ever flag for review. A client-supplied key states intent exactly and makes the third case, same key with a different body, a detectable 422.",
          flips:
            "Clients you do not control and cannot force to send a key, where a heuristic duplicate detector plus self-serve refund is the only thing left.",
        },
      },
    },
    {
      id: "orchestrator",
      label: "Payment orchestrator",
      sub: "saga steps, compensations",
      kind: "service",
      col: 1,
      row: 1,
      parent: "saga-zone",
      detail: {
        what: "A durable state machine running risk score, authorize, ledger write and capture, each with a compensating action.",
        why: "The steps cannot share a transaction, so the workflow has to be able to say which ones already happened after a crash. It also owns the charge state machine, which is why webhook handlers request transitions rather than applying them.",
        numbers: ["4 forward steps, 4 compensations", "terminal states are sticky"],
        breaks:
          "Compensation without verification. Voiding straight after a timeout can try to void a charge the PSP already captured, which it rejects, wedging the workflow with live money on one side and a permanently failing compensation on the other.",
        choice: {
          pick: "Compensating saga on a durable workflow engine such as Temporal or Step Functions",
          instead: "Two-phase commit spanning the ledger and the processor, so no intermediate state is ever visible.",
          decider:
            "The number of external participants exposing a prepare-and-commit interface, which is 0. Authorize p99 is around 1.2s and a hung call can sit for 30s; 2PC would need a card network to hold a lock for that window and obey your coordinator, and no such API exists.",
          flips:
            "Every participant is a datastore you own, in one region, committing in under 10ms. That is the internal-transfer path, where 2PC or its TCC cousin wins and the intermediate states a saga exposes buy nothing.",
        },
      },
    },
    {
      id: "verifier",
      label: "Verification worker",
      sub: "requires_verification state",
      kind: "service",
      col: 1,
      row: 2,
      parent: "saga-zone",
      detail: {
        what: "The worker that resolves ambiguous outcomes by querying the PSP with the same idempotency key until it answers.",
        why: "A capture timeout has three indistinguishable explanations and both naive answers cost real money: void a landed capture and you have refunded funds you collected, skip it and you have shipped for free. So the doubt gets its own state and its own worker instead of a guess on the hot path.",
        numbers: ["capture timeout at 4s", "poll on backoff until the state is known"],
        breaks:
          "If verification cannot resolve within N minutes the charge has to be frozen and escalated, so a long PSP outage means a partial stop for the in-flight set rather than a graceful degrade.",
        choice: {
          pick: "requires_verification as a real state, resolved by querying the PSP before any compensation",
          instead: "Retry the capture on a backoff, or assume failure and void immediately.",
          decider:
            "The 3 outcomes a 4s timeout leaves open are indistinguishable from the caller's side, and 2 of them mean money already moved. A blind retry is the double-charge path; a blind void refunds collected funds. Only the PSP knows, so ask it.",
          flips:
            "A rail that offers neither deduplication nor a queryable reference, such as some older ACH gateways. Then exactly-once effect is not available at all and the recovery is a human with a settlement file.",
        },
      },
    },
    {
      id: "webhook-queue",
      label: "Webhook ingest",
      sub: "HMAC verify, dedupe on event_id",
      kind: "queue",
      col: 3,
      row: 1,
      detail: {
        what: "The queue that absorbs PSP callbacks: signature checked at the edge, deduplicated, then handed to the orchestrator as transition requests.",
        why: "The webhook is where the real outcome arrives, especially for anything the synchronous call could not resolve. It is queued rather than applied inline because delivery is at-least-once and unordered, so the handler must never be the thing that decides state.",
        numbers: ["~1.2 delivered events per payment", "~2.8k events/s at peak, ~2.8MB/s", "24h dedupe TTL"],
        breaks:
          "Out-of-order delivery: succeeded then failed for the same charge. Without a state-machine guard a late event unwinds a terminal state, and without dedupe a replayed refund webhook inflates the refunded total.",
        choice: {
          pick: "Queue every event, dedupe on charge_id, event_type and event_id, persist the raw payload on receipt",
          instead: "Apply the webhook to the ledger directly in the handler and return 200.",
          decider:
            "At-least-once delivery with no ordering guarantee at ~2.8k events/s peak. Direct application double-applies on the first duplicate and finalises in the wrong state on the first reordering, and both are money errors. Persisting the raw event separately from charge state is what makes the forensics possible afterwards.",
          flips:
            "A PSP that guarantees exactly-once ordered delivery, which none of them do, so in practice this does not flip.",
        },
      },
    },
    {
      id: "recon",
      label: "Daily reconciliation",
      sub: "line-by-line, alert on drift",
      kind: "service",
      col: 2,
      row: 3,
      detail: {
        what: "A nightly job that joins the processor's settlement rows against your charges and ledger, one line at a time.",
        why: "This is the control that catches whatever the code missed, and running it daily bounds how long a silent discrepancy can hide to 24 hours. It is designed in rather than bolted on because the failure it catches, money moved with no record of it, has no other detector.",
        numbers: ["2.74M rows/day, ~550MB raw, ~110MB Parquet", "peak day 27.4M rows, 5.5GB", "~200GB compressed over 7 years"],
        breaks:
          "Drift below the alert threshold. Three cents of daily FX rounding noise becomes a ten thousand dollar unexplained gap inside a year, which is why a weekly trend report sits alongside the daily threshold.",
        choice: {
          pick: "Alert and freeze on any diff above a per-merchant tolerance, correct only by explicit adjustment entries",
          instead: "Auto-correct diffs to make the books balance and log the change.",
          decider:
            "Silently correcting is how money disappears without anybody noticing. Only known patterns auto-resolve, such as sub-half-cent FX rounding, and even those write an audit-trailed adjustment entry; everything else escalates to a human within 24h.",
          flips:
            "Nothing about money. For a non-financial counter where drift has no liability attached, auto-healing is fine and a human queue is pure cost.",
        },
      },
    },
    {
      id: "idem",
      label: "Idempotency store",
      sub: "Postgres, key to recovery point",
      kind: "database",
      col: 2,
      row: 0,
      detail: {
        what: "Rows of key, request_hash, recovery_point, response and status, with a 24h TTL.",
        why: "A boolean in_progress flag tells a retry only that somebody started, which leaves replaying everything or polling the PSP without knowing what to ask about. A named recovery point tells it exactly which step last committed, so the retry resumes rather than replays.",
        numbers: ["31.5M keys on a peak day", "~1KB per entry, ~32GB, ~64GB with a replica", "TTL 24h"],
        breaks:
          "The 24h TTL matches what PSPs honour, not what your liability requires. Past it the key is meaningless on both sides and the only handle on the payment is psp_charge_id.",
        choice: {
          pick: "PostgreSQL rows with a read-through cache, so the recovery point commits in the same transaction as its step",
          instead: "Redis with a TTL, which is the natural fit for a 24h key-value store.",
          decider:
            "Whether the recovery point can be written atomically with the work it describes. The ledger entries and ledger_recorded must land together or neither lands; a separate cache makes that impossible and recorded progress could then lead reality. 31.5M keys/day at ~1KB is only ~32GB, so the relational store is not the constraint.",
          flips:
            "A workflow with no local database write to pair the recovery point with, where the key is pure request deduplication and Redis is simpler and cheaper.",
        },
      },
    },
    {
      id: "psp",
      label: "PSP",
      sub: "Stripe / Adyen, auth + capture",
      kind: "external",
      col: 2,
      row: 1,
      detail: {
        what: "The outside company holding the connection to the card networks. It authorizes, captures, voids and refunds, and nothing else.",
        why: "It is drawn explicitly because it sets every constraint the rest of the design answers to: no prepare or commit call, no lock you can hold, side effects visible in a cardholder's banking app within seconds, and an undo that is not free.",
        numbers: ["authorize p99 ~1.2s, hung calls up to 30s", "honours a caller-supplied key for 24h", "auth hold valid roughly 7 days"],
        breaks:
          "A hard outage splits the in-flight set. Charges that provably never left your building can be queued or routed to a fallback; anything already sent cannot be resent anywhere, because your key is namespaced to one provider and failing it over discards the only protection you had.",
        choice: {
          pick: "Integrate a PSP and model authorize and capture as two distinct steps",
          instead: "Build directly onto card rails through an acquirer.",
          decider:
            "PCI scope and time to first payment. A PSP keeps card data out of your estate entirely, which holds you at SAQ-A, and it deduplicates a repeated call on a caller-supplied key for 24 hours, which is one of the two defences against a crash between the call and the commit.",
          flips:
            "Volume where per-transaction PSP fees dominate, or a rail no PSP covers, at which point the card vault and full PCI scope come in-house along with the interchange savings.",
        },
      },
    },
    {
      id: "ledger",
      label: "Ledger",
      sub: "double-entry, append-only",
      kind: "database",
      col: 2,
      row: 2,
      detail: {
        what: "An append-only log of paired debit and credit entries. Balances are derived and periodically checkpointed, never a column you overwrite.",
        why: "This is the internal source of truth, and it is the one thing in the picture that does not move when the processor does. Pairing every movement keeps sum(debits) equal to sum(credits) at all times, which is how an error announces itself rather than hiding.",
        numbers: ["~3 entries per payment at ~500B", "1.5KB of ledger per payment, 1.5TB/yr", "7-year retention"],
        breaks:
          "A hot merchant account. Thousands of charges/s all contending on one balance row serialises on the row lock and caps out at a few hundred TPS, which is why the account is sharded into sub-accounts and summed.",
        choice: {
          pick: "Append-only paired entries with derived balances",
          instead: "One balance column per account updated in place, with a best-effort event log alongside.",
          decider:
            "Whether you must reconstruct any account's balance as at any past instant across a 7-year window. Entries make that a bounded scan; a column mutated in place makes it impossible, because the intermediate values are gone. The price is 3 extra writes and 1.5KB per charge, or 1.5TB/yr at 1B payments.",
          flips:
            "The balance is not money you owe anybody, such as loyalty points or in-game currency, and no auditor will ask for a historical reconstruction. A single-row read at ~0.2ms then beats summing, and this is a defensible choice rather than a shortcut.",
        },
      },
    },
    {
      id: "charges",
      label: "Charges table",
      sub: "state machine, psp_charge_id",
      kind: "database",
      col: 0,
      row: 1,
      detail: {
        what: "One row per charge carrying status, amount, currency, psp_charge_id and the idempotency key it was created under.",
        why: "The status here is the state machine, and psp_charge_id is the only join back to the processor once the 24h key has expired. That value goes onto the row the instant authorize returns, because it is what reconciliation matches on months later.",
        numbers: ["~2KB per charge record, 2TB/yr", "3.5TB/yr combined with the ledger, ~74TB at RF=3 over 7 years"],
        breaks:
          "An out-of-order transition is a programming error, not something to tolerate. Terminal states are sticky, so a late webhook claiming failed on an already-succeeded charge is dropped with an alert rather than applied.",
        choice: {
          pick: "PostgreSQL, strongly consistent, tiered to columnar object storage after 12 months",
          instead: "A wide-column store sized for the full 7-year footprint up front.",
          decider:
            "Peak write rate is ~2.3k/s and the hot set is one year, which is 3.5TB or roughly 10TB at RF=3. That fits comfortably on a relational primary, and strong consistency matters more here than headroom you are not using. The cold 7-year tail compresses about 5x in columnar storage where nothing transacts against it.",
          flips:
            "Multi-region active-active writes on the charge row, which a single relational primary cannot serve and which a quorum store can.",
        },
      },
    },
    {
      id: "settlement",
      label: "PSP settlement report",
      sub: "their book, daily file",
      kind: "external",
      col: 3,
      row: 2,
      detail: {
        what: "The processor's own daily record of what it actually moved, delivered as a file you did not write.",
        why: "It is the independent witness. Your ledger can only tell you what you believe happened, so the only way to catch a charge that landed at the network while your write failed is to compare against a book somebody else keeps.",
        numbers: ["one row per settled transaction", "joined on psp_charge_id", "kept 7 years for audit"],
        breaks:
          "A row in their report with no match in yours means a card was charged and you have no record of it. That is the serious direction of the mismatch and it needs a human the same day.",
      },
    },
  ],
  edges: [
    {
      id: "e1",
      from: "client",
      to: "api",
      tier: "hot",
      label: "POST /charge + key",
      detail: {
        what: "The charge request carrying a payment-method token, an amount, and an Idempotency-Key header.",
        why: "The key is generated out here rather than server-side because it has to identify the purchase attempt, not the HTTP request. A phone that dies mid-request and retries must send the same value or the whole scheme is decorative.",
        numbers: ["one key per purchase attempt", "retry factor ~1.15"],
        breaks:
          "A client that reuses a key across genuinely different purchases gets a 422 rather than a charge, which is correct but shows up as a support ticket rather than an error the client notices.",
      },
    },
    {
      id: "e2",
      from: "api",
      to: "idem",
      tier: "data",
      label: "commit key + body hash",
      detail: {
        what: "Inserting the idempotency row, or reading back an existing one to decide between resume, replay and reject.",
        why: "This write happens before any external call, which is the whole point. It is what makes a crash between here and the PSP recoverable rather than a mystery.",
        numbers: ["3 cases: unseen, hash match, hash differs", "TTL 24h"],
        breaks:
          "A row left stuck in progress after a crash needs an aging detector, or it sits there forever and the retry path never resolves it.",
      },
    },
    {
      id: "e3",
      from: "api",
      to: "orchestrator",
      tier: "hot",
      label: "start or resume saga",
      detail: {
        what: "Handing the charge to the workflow engine, either as a fresh saga or as a resume from the stored recovery point.",
        why: "Splitting the API from the workflow is what lets the charge outlive the request. The user waits for authorize, but capture and everything after it has nobody waiting on it and therefore no latency budget.",
        numbers: ["authorize synchronous, capture off the request path"],
        breaks:
          "If the API returns before the workflow is durably started, an accepted payment can be lost, and lost payments are the one failure this system is not allowed to have.",
      },
    },
    {
      id: "e4",
      from: "orchestrator",
      to: "psp",
      tier: "hot",
      label: "authorize, capture",
      detail: {
        what: "The outbound money calls, with the client's idempotency key passed straight through to the far side.",
        why: "Passing the key through is the first of two defences against dying between the call and the commit: the PSP absorbs the repeat and returns the first result instead of creating a second hold. It works only because the far side deduplicates, which not every rail does.",
        numbers: ["authorize p99 ~1.2s", "PSP honours the key for 24h", "hold valid roughly 7 days"],
        breaks:
          "Rails that do not deduplicate, such as most ACH gateways, treat a resubmission as a fresh instruction. There the handle is a deterministic reference derived from charge_id, and looking it up before sending has to be a mandatory step rather than an error path.",
      },
    },
    {
      id: "e5",
      from: "orchestrator",
      to: "ledger",
      tier: "hot",
      label: "paired debit + credit",
      detail: {
        what: "Writing both halves of the movement, debit the card account and credit the merchant payable, in one transaction with the recovery point.",
        why: "Two entries rather than one balance update is what makes the books provable, and committing the recovery point alongside them is what makes the workflow resumable. Neither works without the other.",
        numbers: ["2 entries minimum, ~3 weighted across the refund mix", "~500B per entry"],
        breaks:
          "Authorize succeeded and this write failed. The ledger is on the success path, so the workflow has to compensate with a void and mark an internal failure rather than leave a hold nobody recorded.",
      },
    },
    {
      id: "e6",
      from: "orchestrator",
      to: "idem",
      tier: "data",
      label: "recovery point, same txn",
      detail: {
        what: "Advancing the recovery point through started, risk_scored, psp_authorized, ledger_recorded, captured, finished.",
        why: "Each point commits in the same database transaction as its own step, which buys the one property the retry path depends on: recorded progress can lag reality but can never lead it. A resumed workflow therefore has doubt only about the step it is currently attempting.",
        numbers: ["6 recovery points"],
        breaks:
          "The external call is the gap this cannot close. The PSP authorizes, the orchestrator dies before committing psp_authorized, and the record says risk_scored while a live hold exists.",
      },
    },
    {
      id: "e7",
      from: "orchestrator",
      to: "charges",
      tier: "data",
      label: "state transition",
      detail: {
        what: "The only writer of charge status, validating each transition against the state machine before applying it.",
        why: "Concentrating transitions in one owner is what stops a webhook and a retry from disagreeing about a charge. It is also where psp_charge_id lands the instant authorize returns, because that value outlives the idempotency key.",
        numbers: ["terminal states: succeeded, failed, refunded, disputed_lost"],
        breaks:
          "An illegal transition is dropped with an alert rather than applied, which means a genuine bug shows up as a metric rather than as corrupted money state, and somebody has to be watching that metric.",
      },
    },
    {
      id: "e8",
      from: "orchestrator",
      to: "verifier",
      tier: "hot",
      label: "requires_verification",
      detail: {
        what: "Handing off a charge whose outcome is genuinely unknown, typically a capture that timed out at 4s.",
        why: "The doubt gets a state rather than an exception because it can last longer than a request and it must not be resolved by guessing. Making it a real state also means it is countable, and the unknown-PSP-state rate is the single most important operational risk metric in payments.",
        numbers: ["capture timeout 4s", "3 indistinguishable outcomes"],
        breaks:
          "Charges that pile up here during a PSP outage are stuck by design, not by accident, and the backlog is customer-visible while it lasts.",
      },
    },
    {
      id: "e9",
      from: "verifier",
      to: "psp",
      tier: "hot",
      label: "GET by idempotency key",
      detail: {
        what: "Asking the processor what actually happened, keyed by the same value the original call carried.",
        why: "This is the second defence, you skipping the repeat rather than the far side absorbing it. It is also the step people leave out, and leaving it out is what turns an ambiguous timeout into a wedged workflow.",
        numbers: ["polled on backoff", "valid only inside the 24h key window"],
        breaks:
          "Past 24h the key is gone from both sides and the only remaining handle is psp_charge_id through reconciliation and human judgement.",
      },
    },
    {
      id: "e10",
      from: "verifier",
      to: "orchestrator",
      tier: "hot",
      label: "confirm or compensate",
      detail: {
        what: "Returning an observed state so the saga either fast-forwards its recovery point or unwinds from the last committed step.",
        why: "Every compensation is then issued against a state you saw rather than one you assumed. Void the authorization, write a reversing ledger entry, release the risk hold, each keyed on charge_id and step so a repeat is a no-op.",
        numbers: ["compensations run in reverse order"],
        breaks:
          "Compensations are additional entries, never edits or deletes, so a bug here adds a wrong entry rather than destroying a right one. That is deliberate, and it means the ledger grows even on the failure path.",
      },
    },
    {
      id: "e11",
      from: "psp",
      to: "webhook-queue",
      tier: "control",
      label: "auth, capture, dispute",
      detail: {
        what: "Asynchronous callbacks carrying the real outcome, including events with no synchronous counterpart such as disputes and late 3DS challenges.",
        why: "The synchronous response tells you what the PSP believed at that instant; the webhook tells you what settled. Anything that resolves after the request has ended, which includes every dispute, can only arrive this way.",
        numbers: ["~1.2 events per payment after batching", "~2.8k/s at peak, ~1KB each"],
        breaks:
          "Delivery is at-least-once and unordered, so succeeded can arrive after failed for the same charge, and succeeded can arrive twice.",
      },
    },
    {
      id: "e12",
      from: "webhook-queue",
      to: "orchestrator",
      tier: "control",
      label: "transition request",
      detail: {
        what: "A deduplicated, signature-checked event proposed to the orchestrator as a state transition rather than applied directly.",
        why: "The handler has no idea what else is in flight for that charge, so it is not allowed to decide. Routing every external event through the same validator is what keeps webhook state and workflow state from drifting apart.",
        numbers: ["dedupe on charge_id, event_type, event_id", "24h TTL set"],
        breaks:
          "A webhook claiming succeeded while the orchestrator still reads authorized is a legal race; one claiming failed on a finalised charge is dropped and alerted, and confusing the two categories loses real outcomes.",
      },
    },
    {
      id: "e13",
      from: "psp",
      to: "settlement",
      tier: "control",
      label: "nightly settlement file",
      detail: {
        what: "The processor publishing its own record of what actually settled, one row per transaction.",
        why: "It is produced entirely outside your system, which is the only reason it is worth comparing against. A witness that shares your code shares your bugs.",
        numbers: ["daily cadence", "~200B per row"],
        breaks:
          "A late or partial file silently skips a day of reconciliation, so the job has to alert on a missing file as loudly as it alerts on a mismatch.",
      },
    },
    {
      id: "e14",
      from: "settlement",
      to: "recon",
      tier: "data",
      label: "their rows",
      detail: {
        what: "Loading the settlement rows for the day as one side of the comparison.",
        why: "This is the direction that catches the expensive failure: a charge that exists in their book and not in yours means money moved that you never recorded, and no internal check can find it.",
        numbers: ["2.74M rows on a normal day, 27.4M on a peak day"],
        breaks:
          "Timing. Partial captures and refunds settle on a different day from the charge, so a naive same-day join reports mismatches that are just calendar noise.",
      },
    },
    {
      id: "e15",
      from: "ledger",
      to: "recon",
      tier: "data",
      label: "your rows",
      detail: {
        what: "Reading your own entries for the period as the other side of the join, matched on psp_charge_id.",
        why: "Comparing against the ledger rather than the charge table is deliberate: the ledger is the thing that must balance, and an entry that exists with no settlement behind it is as much a problem as the reverse.",
        numbers: ["~3 entries per payment", "join column psp_charge_id"],
        breaks:
          "Sub-cent FX rounding and dispute fees produce a small permanent diff, and treating that noise as normal is how a real gap hides inside it.",
      },
    },
    {
      id: "e16",
      from: "charges",
      to: "recon",
      tier: "data",
      label: "status + psp_charge_id",
      detail: {
        what: "Supplying the charge status and the processor's own identifier so unmatched rows can be attributed to a specific charge.",
        why: "Once the 24h idempotency window has closed, psp_charge_id is the only handle left. Reconciliation is where that matters, because chargebacks and partial-refund disputes surface weeks to months after the payment.",
        numbers: ["chargeback window up to 120 days", "7-year settlement archive"],
        breaks:
          "There is no automatic path from a four-month-old dispute back to the workflow that created it. What exists is an audit trail and an operator, and pretending otherwise in an interview is worse than conceding it.",
      },
    },
  ],
};
