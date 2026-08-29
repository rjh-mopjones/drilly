import type { Diagram } from "./types";

export const PAYMENT_SYSTEM: Diagram = {
  id: "payment-system",
  title: "Payment System",
  question: "Design a Payment System",
  sourceId: "patterns",
  itemId: 23,
  overview: {
    shape:
      "A durable workflow sits in front of an external processor you cannot roll back, backed by an append-only ledger and nightly reconciliation.",
    forces: [
      {
        constraint: "the external world can succeed while your write fails, and the two cases look identical",
        decision: "commit an idempotency row with a recovery point before any outbound PSP call",
        lights: ["idem", "api"],
      },
      {
        constraint: "0 of the 3 major PSPs expose a prepare-and-commit call; only authorize, capture and void",
        decision: "run a compensating saga instead of two-phase commit; failures unwind backwards through extra ledger entries",
        lights: ["orchestrator", "psp"],
      },
      {
        constraint: "a capture can time out at 4s with money genuinely unknown to have moved or not",
        decision: "hold the charge in requires_verification and query the PSP by key before ever compensating",
        lights: ["verifier", "e9"],
      },
      {
        constraint: "webhooks arrive at-least-once and unordered, with disputes surfacing weeks to months later",
        decision: "queue every webhook and route it through the same state machine as a transition request, never applied inline",
        lights: ["webhook-queue", "orchestrator"],
      },
      {
        constraint: "1B payments/yr means even a rare silent-write failure produces real unrecorded charges",
        decision: "run a daily job joining the PSP's settlement file against the ledger, bounding a silent gap to 24h",
        lights: ["recon", "settlement"],
      },
    ],
    naive: {
      text: "A reader defaults to one synchronous call: charge the card, then write your own records if it succeeds. That breaks the moment the PSP call succeeds but your write fails, or the network drops the response before you see it. You cannot tell those two cases apart, and a retry then risks a second charge. The Payment orchestrator replaces the single call with a durable saga. A recovery point commits before anything external happens, so a resumed workflow always knows exactly how much doubt it is carrying.",
      lights: ["orchestrator", "idem", "api"],
    },
    beats: [
      {
        text: "The charge arrives with a client-generated idempotency key scoped to one purchase attempt. The API commits a row holding that key, a hash of the request body and a recovery point before the first outbound call. Same key with the same body returns the stored response. Same key with a different body is a 422, because a recycled key is a client bug and charging silently under it is worse than failing loudly.",
        lights: ["client", "api", "idem", "e1", "e2"],
      },
      {
        text: "The orchestrator runs the saga in order: risk score, authorize, paired ledger entries, capture. Risk score runs locally, checking fraud signals, velocity, device fingerprint, and address/card-code matches, with no outbound PSP call. A decline there skips straight to the unwind path before authorize ever runs. Each recovery point commits in the same database transaction as the work it describes, so recorded progress can lag reality but can never lead it. A resumed workflow reading psp_authorized knows the hold exists; one reading risk_scored knows nothing about authorize, exactly the right amount of doubt.",
        lights: ["orchestrator", "e3"],
      },
      {
        text: "Two-phase commit is not available, so failures unwind with compensations instead. The number of external participants exposing a prepare-and-commit call is zero: Visa, Mastercard and every PSP layered on them offer authorize, capture and void and nothing else. Compensations run backwards, are extra ledger entries rather than edits, and are keyed on charge_id and step so running one twice is a no-op.",
        lights: ["orchestrator", "psp", "e4"],
      },
      {
        text: "The hard branch is a capture that times out after 4s, where you genuinely cannot tell whether money moved. The charge moves into requires_verification, a real state rather than an error bucket. A worker queries the PSP by the same key on a backoff until the outcome is known. Only then does the workflow confirm or compensate, because voiding a charge the PSP already captured wedges the saga with live money on one side.",
        lights: ["verifier", "psp", "e8", "e9", "e10"],
      },
      {
        text: "The ledger is paired debits and credits, append only, with balances derived and checkpointed rather than a column you overwrite. That is what lets you reconstruct any account as at any instant across a 7-year retention window, and it costs roughly 3 entries at 500B per payment. Webhooks arrive at-least-once and unordered, so handlers only enqueue transition requests that the orchestrator validates against the state machine.",
        lights: ["ledger", "webhook-queue", "e5", "e11", "e12"],
      },
      {
        text: "Reconciliation is a designed component, not an operational afterthought. A daily job joins the processor's settlement rows against your charges on psp_charge_id and alerts on anything unmatched, which bounds how long a silent discrepancy can hide to 24 hours. A row in their report with no row in yours means a card was charged and you have no record of it.",
        lights: ["recon", "settlement", "e13", "e14", "e15", "e16"],
      },
    ],
    crux: {
      problem: "The external world can succeed while your write fails, and you cannot tell that case apart from the call never arriving.",
      handled:
        "Every serious decision here follows from that. Idempotency keys absorb a repeat, and recovery points keep progress from ever overstating reality. Verification runs before compensation, so nothing unwinds a state that was never observed. Reconciliation catches whatever fraction still slips through.",
    },
    numbers: [
      {
        value: "1B payments/yr, ~2.3k/s peak, provision 3k/s",
        explain: "The annual volume and its peak rate size every hot-path component; the provisioned figure leaves headroom above the observed peak.",
      },
      {
        value: "PSP authorize p99 1.2s inside a 3s checkout budget",
        explain: "The single synchronous external call dominates checkout latency, leaving under two seconds for everything else in the request.",
      },
      {
        value: "idempotency TTL 24h vs a 120-day chargeback window",
        explain: "The idempotency key stops protecting a charge long before a dispute can arrive, which is why psp_charge_id, not the key, is what reconciliation keys on later.",
      },
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
        numbers: [
          {
            value: "6 recovery points: started, risk_scored, psp_authorized, ledger_recorded, captured, finished",
            explain: "The named waypoints a resumed workflow checks against, each one telling it exactly how much of the saga is known to have happened.",
          },
        ],
        breaks: {
          failure: "If anything outside this zone writes charge status directly, the state machine stops being a guarantee.",
          handled: "Late events would then start unwinding terminal states, so every other component is limited to proposing a transition rather than applying one.",
        },
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
        numbers: [
          { value: "one UUID per purchase attempt", explain: "The key's scope: tied to the attempt the user made, not to any single HTTP request that attempt might retry." },
          { value: "retry factor ~1.15 keys per charge", explain: "On average, 15% more keys are generated than charges actually complete, the overhead client-side retries add." },
        ],
        breaks: {
          failure: "A user who taps Pay again after a cold app start gets a fresh key.",
          handled: "Two valid authorizations then exist for what the human considers one purchase. Every rule in this design is satisfied, yet the outcome is wrong; client-side dedupe on recent purchase intent is the actual fix.",
        },
        choice: {
          pick: "Tokenise in PSP-hosted fields so only an opaque token reaches your servers",
          instead: "Accept the raw card number at your API and forward it to the PSP.",
          decider:
            "PCI-DSS scope. Never seeing a PAN keeps you at SAQ-A. A single 16-digit number reaching your logs or an unencrypted backup pushes you to SAQ-D instead. That audit costs roughly an order of magnitude more, and remediation runs to months.",
          flips: "You are the processor. If you run your own card rails you are in full scope regardless, and the vault is a first-class component rather than something to avoid.",
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
        numbers: [
          { value: "checkout p99 target 3s", explain: "The end-to-end latency budget the whole synchronous path, client through authorize, is held to." },
          { value: "~1.8s of budget left after a 1.2s authorize", explain: "What remains for validation, the idempotency write, network and everything else once the single external call is accounted for." },
        ],
        breaks: {
          failure: "Without the body hash, a client that recycles a key silently receives some other charge's response.",
          handled: "It believes its new purchase succeeded when it actually got someone else's result back. The request-hash check on the same key exists exactly to catch this and reject it as a 422.",
        },
        choice: {
          pick: "Idempotency-Key header required on every write, stored with a request hash",
          instead: "Server-side deduplication on a natural key such as customer, amount and a time window.",
          decider:
            "Whether two legitimate identical purchases are distinguishable. A fuzzy window of roughly 5 minutes on customer, merchant and amount cannot tell a retry from a second coffee, so it can only ever flag for review. A client-supplied key states intent exactly and makes the third case, same key with a different body, a detectable 422.",
          flips: "Clients you do not control and cannot force to send a key, where a heuristic duplicate detector plus self-serve refund is the only thing left.",
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
        why: "The steps cannot share a transaction, so the workflow has to be able to say which ones already happened after a crash. Risk score, the first step, is entirely in-process: fraud signals such as velocity, device fingerprint and AVS/CVV match are evaluated against a threshold with no outbound call. A decline there costs nothing but the check itself and skips straight to compensation before authorize runs. It also owns the charge state machine, which is why webhook handlers request transitions rather than applying them.",
        numbers: [
          { value: "4 forward steps, 4 compensations", explain: "The full saga: one compensating action exists for each forward step, so any prefix of the workflow can be unwound." },
          { value: "4 terminal states, all sticky", explain: "Once a charge reaches any of these, no further transition is ever accepted." },
        ],
        breaks: {
          failure: "Compensation without verification.",
          handled: "Voiding straight after a timeout can try to void a charge the PSP already captured, which it rejects. That wedges the workflow with live money on one side and a permanently failing compensation on the other.",
        },
        choice: {
          pick: "Compensating saga on a durable workflow engine such as Temporal or Step Functions",
          instead: "Two-phase commit spanning the ledger and the processor, so no intermediate state is ever visible.",
          decider:
            "The number of external participants exposing a prepare-and-commit interface, which is 0. Authorize p99 is around 1.2s, and a hung call can sit for 30s. 2PC would need a card network to hold a lock for that window and obey your coordinator, and no such API exists.",
          flips: "Every participant is a datastore you own, in one region, committing in under 10ms. That is the internal-transfer path, where 2PC or its TCC cousin wins and the intermediate states a saga exposes buy nothing.",
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
        why: "A capture timeout has three indistinguishable explanations, and both naive answers cost real money. Void a landed capture and you have refunded funds you collected; skip it and you have shipped for free. So the doubt gets its own state and its own worker instead of a guess on the hot path.",
        numbers: [
          { value: "capture timeout at 4s", explain: "The threshold past which a capture call is treated as ambiguous rather than simply slow." },
          { value: "polls on backoff for up to 24h, the key window", explain: "The verifier keeps asking as long as the idempotency key the PSP recognises is still valid; past that window the key itself is gone." },
        ],
        breaks: {
          failure: "If verification cannot resolve within N minutes the charge has to be frozen and escalated.",
          handled: "A long PSP outage then means a partial stop for the in-flight set rather than a graceful degrade, the accepted cost of never guessing at an unresolved outcome.",
        },
        choice: {
          pick: "requires_verification as a real state, resolved by querying the PSP before any compensation",
          instead: "Retry the capture on a backoff, or assume failure and void immediately.",
          decider:
            "The 3 outcomes a 4s timeout leaves open are indistinguishable from the caller's side, and 2 of them mean money already moved. A blind retry is the double-charge path; a blind void refunds collected funds. Only the PSP knows, so ask it.",
          flips: "A rail that offers neither deduplication nor a queryable reference, such as some older ACH gateways. Then exactly-once effect is not available at all and the recovery is a human with a settlement file.",
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
        numbers: [
          { value: "~1.2 delivered events per payment", explain: "The average webhook fan-out per charge, since a single payment can generate several distinct lifecycle events." },
          { value: "~2.8k events/s at peak, ~2.8MB/s", explain: "The ingest rate this queue absorbs at peak checkout volume, well within a queue's normal capacity." },
          { value: "24h dedupe TTL", explain: "The window a duplicate event id is remembered for, matched to the idempotency key's own lifetime." },
        ],
        breaks: {
          failure: "Out-of-order delivery: succeeded then failed for the same charge.",
          handled: "Without a state-machine guard a late event unwinds a terminal state, and without dedupe a replayed refund webhook inflates the refunded total. Both are why every event is validated against the state machine rather than applied directly.",
        },
        choice: {
          pick: "Queue every event, dedupe on charge_id, event_type and event_id, persist the raw payload on receipt",
          instead: "Apply the webhook to the ledger directly in the handler and return 200.",
          decider:
            "At-least-once delivery with no ordering guarantee at ~2.8k events/s peak. Direct application double-applies on the first duplicate and finalises in the wrong state on the first reordering, and both are money errors. Persisting the raw event separately from charge state is what makes the forensics possible afterwards.",
          flips: "A PSP that guarantees exactly-once ordered delivery, which none of them do, so in practice this does not flip.",
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
        numbers: [
          { value: "2.74M rows/day, ~550MB raw, ~110MB Parquet", explain: "The daily reconciliation volume at 1B payments/yr, and how much it compresses once archived in columnar format." },
          { value: "peak day 27.4M rows, 5.5GB", explain: "The busiest single day's volume, roughly ten times normal, which the job has to complete within its overnight window regardless." },
          { value: "~200GB compressed over 7 years", explain: "The accumulated archive size for the full audit retention period, small enough that storage is never the constraint." },
        ],
        breaks: {
          failure: "Drift below the alert threshold.",
          handled: "Three cents of daily FX rounding noise becomes a ten thousand dollar unexplained gap inside a year, which is why a weekly trend report sits alongside the daily threshold.",
        },
        choice: {
          pick: "Alert and freeze on any diff above a per-merchant tolerance, correct only by explicit adjustment entries",
          instead: "Auto-correct diffs to make the books balance and log the change.",
          decider:
            "Silently correcting is how money disappears without anybody noticing. Only known patterns auto-resolve, such as sub-half-cent FX rounding, and even those write an audit-trailed adjustment entry; everything else escalates to a human within 24h.",
          flips: "Nothing about money. For a non-financial counter where drift has no liability attached, auto-healing is fine and a human queue is pure cost.",
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
        numbers: [
          { value: "31.5M keys on a peak day", explain: "The peak daily volume this store has to hold, driven directly by peak checkout traffic." },
          { value: "~1KB per entry, ~32GB, ~64GB with a replica", explain: "The per-key storage cost times peak daily volume, small enough to run comfortably on a relational primary." },
          { value: "TTL 24h", explain: "How long a key and its recovery point remain queryable before expiring, matched to what PSPs themselves honour." },
        ],
        breaks: {
          failure: "The 24h TTL matches what PSPs honour, not what your liability requires.",
          handled: "Past it the key is meaningless on both sides, and the only handle on the payment is psp_charge_id. That value is copied onto the charges row before the key ever expires.",
        },
        choice: {
          pick: "PostgreSQL rows with a read-through cache, so the recovery point commits in the same transaction as its step",
          instead: "Redis with a TTL, which is the natural fit for a 24h key-value store.",
          decider:
            "Whether the recovery point can be written atomically with the work it describes. The ledger entries and ledger_recorded must land together or neither lands; a separate cache makes that impossible and recorded progress could then lead reality. 31.5M keys/day at ~1KB is only ~32GB, so the relational store is not the constraint.",
          flips: "A workflow with no local database write to pair the recovery point with, where the key is pure request deduplication and Redis is simpler and cheaper.",
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
        why: "It is drawn explicitly because it sets every constraint the rest of the design answers to. There is no prepare or commit call, and no lock you can hold. Side effects are visible in a cardholder's banking app within seconds, and an undo is not free.",
        numbers: [
          { value: "authorize p99 ~1.2s, hung calls up to 30s", explain: "The typical and worst-case latency of the single synchronous external call the whole checkout path waits on." },
          { value: "honours a caller-supplied key for 24h", explain: "How long the PSP itself deduplicates a repeated call on the same key, one of the two defences against a crash mid-call." },
          { value: "auth hold valid roughly 7 days", explain: "How long an authorization hold stays live on the cardholder's account before it must be captured or it expires." },
        ],
        breaks: {
          failure: "A hard outage splits the in-flight set.",
          handled: "Charges that provably never left your building can be queued or routed to a fallback. Anything already sent cannot be resent anywhere, because your key is namespaced to one provider and failing it over discards the only protection you had.",
        },
        choice: {
          pick: "Integrate a PSP and model authorize and capture as two distinct steps",
          instead: "Build directly onto card rails through an acquirer.",
          decider:
            "PCI scope and time to first payment. A PSP keeps card data out of your estate entirely, which holds you at SAQ-A. It also deduplicates a repeated call on a caller-supplied key for 24 hours, one of the two defences against a crash between the call and the commit.",
          flips: "Volume where per-transaction PSP fees dominate, or a rail no PSP covers, at which point the card vault and full PCI scope come in-house along with the interchange savings.",
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
        why: "This is the internal source of truth, and it is the one thing here that does not move when the processor does. Pairing every movement keeps sum(debits) equal to sum(credits) at all times, which is how an error announces itself rather than hiding.",
        numbers: [
          { value: "~3 entries per payment at ~500B", explain: "The weighted average entry count once refunds and reversals are included, each entry sized around 500 bytes." },
          { value: "1.5KB of ledger per payment, 1.5TB/yr", explain: "The per-payment ledger footprint at the full entry count, multiplied out to the annual storage volume at 1B payments." },
          { value: "7-year retention", explain: "The compliance window this append-only design has to keep every entry reconstructable across, without ever overwriting a value." },
        ],
        breaks: {
          failure: "A hot merchant account.",
          handled: "Thousands of charges/s all contending on one balance row serialises on the row lock and caps out at a few hundred TPS. The account is sharded into sub-accounts and summed instead of kept as one row.",
        },
        choice: {
          pick: "Append-only paired entries with derived balances",
          instead: "One balance column per account updated in place, with a best-effort event log alongside.",
          decider:
            "Whether you must reconstruct any account's balance as at any past instant across a 7-year window. Entries make that a bounded scan; a column mutated in place makes it impossible, because the intermediate values are gone. The price is 3 extra writes and 1.5KB per charge, or 1.5TB/yr at 1B payments.",
          flips: "The balance is not money you owe anybody, such as loyalty points or in-game currency, and no auditor will ask for a historical reconstruction. A single-row read at ~0.2ms then beats summing, and this is a defensible choice rather than a shortcut.",
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
        numbers: [
          { value: "~2KB per charge record, 2TB/yr", explain: "The per-record size at 1B payments/yr, the volume that sizes the hot relational tier before archival." },
          { value: "3.5TB/yr combined with the ledger, ~74TB at RF=3 over 7 years", explain: "The combined footprint of charges and ledger together, replicated and accumulated across the full retention window." },
        ],
        breaks: {
          failure: "An out-of-order transition is a programming error, not something to tolerate.",
          handled: "Terminal states are sticky, so a late webhook claiming failed on an already-succeeded charge is dropped with an alert rather than applied. A real bug then shows up as a metric, not as corrupted money state.",
        },
        choice: {
          pick: "PostgreSQL, strongly consistent, tiered to columnar object storage after 12 months",
          instead: "A wide-column store sized for the full 7-year footprint up front.",
          decider:
            "Peak write rate is ~2.3k/s and the hot set is one year, which is 3.5TB or roughly 10TB at RF=3. That fits comfortably on a relational primary, and strong consistency matters more here than headroom you are not using. The cold 7-year tail compresses about 5x in columnar storage where nothing transacts against it.",
          flips: "Multi-region active-active writes on the charge row, which a single relational primary cannot serve and which a quorum store can.",
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
        why: "It is the independent witness. Your ledger can only tell you what you believe happened. The only way to catch a charge that landed at the network while your write failed is to compare against a book somebody else keeps.",
        numbers: [
          { value: "one row per settled transaction", explain: "The granularity of the file, fine enough to match one-to-one against a single charge." },
          { value: "1 join column: psp_charge_id", explain: "The only field both sides of the comparison share, why that value is captured onto the charges row the instant authorize returns." },
          { value: "kept 7 years for audit", explain: "The retention period this independent record is preserved for, matching the ledger's own compliance window." },
        ],
        breaks: {
          failure: "A row in their report with no match in yours means a card was charged and you have no record of it.",
          handled: "That is the serious direction of the mismatch, and it needs a human the same day rather than waiting for the next scheduled review.",
        },
      },
    },
  ],
  edges: [
    {
      id: "e1",
      from: "client",
      to: "api",
      tier: "hot",
      step: 1,
      label: "POST /charge + key",
      detail: {
        what: "The charge request carrying a payment-method token, an amount, and an Idempotency-Key header.",
        why: "The key is generated out here rather than server-side because it has to identify the purchase attempt, not the HTTP request. A phone that dies mid-request and retries must send the same value or the whole scheme is decorative.",
        numbers: [
          { value: "one key per purchase attempt", explain: "The scope the key is generated at, tied to a single attempt rather than to any individual HTTP request within it." },
          { value: "retry factor ~1.15", explain: "The average overhead of extra keys generated by client-side retries, above the number of charges that actually complete." },
        ],
        breaks: {
          failure: "A client that reuses a key across genuinely different purchases gets a 422 rather than a charge.",
          handled: "That is correct, but it shows up as a support ticket rather than an error the client itself notices. The client has no way to distinguish legitimate reuse from a bug in its own key generation.",
        },
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
        numbers: [
          { value: "3 cases: unseen, hash match, hash differs", explain: "The three outcomes this lookup can return, each routed to a different response: proceed fresh, replay the stored result, or reject with a 422." },
          { value: "TTL 24h", explain: "How long this row remains authoritative before expiring, matched to what the PSP itself honours on the same key." },
        ],
        breaks: {
          failure: "A row left stuck in progress after a crash needs an aging detector.",
          handled: "Without one it sits there forever and the retry path never resolves it, so a background sweep flags any row still in_progress well past a normal request's lifetime.",
        },
      },
    },
    {
      id: "e3",
      from: "api",
      to: "orchestrator",
      tier: "hot",
      step: 2,
      label: "start or resume saga",
      detail: {
        what: "Handing the charge to the workflow engine, either as a fresh saga or as a resume from the stored recovery point.",
        why: "Splitting the API from the workflow is what lets the charge outlive the request. The user waits for authorize, but capture and everything after it has nobody waiting on it and therefore no latency budget.",
        numbers: [{ value: "1 synchronous call (authorize), capture off the request path", explain: "Only the first external call sits inside the user's wait; everything after it runs asynchronously with no request holding it open." }],
        breaks: {
          failure: "If the API returns before the workflow is durably started, an accepted payment can be lost.",
          handled: "Lost payments are the one failure this system is not allowed to have, so the workflow's durable start is confirmed before the API ever returns success to the client.",
        },
      },
    },
    {
      id: "e4",
      from: "orchestrator",
      to: "psp",
      tier: "hot",
      step: 3,
      label: "authorize, capture",
      detail: {
        what: "The outbound money calls, with the client's idempotency key passed straight through to the far side.",
        why: "Passing the key through is the first of two defences against dying between the call and the commit. The PSP absorbs the repeat and returns the first result instead of creating a second hold. It works only because the far side deduplicates, which not every rail does.",
        numbers: [
          { value: "authorize p99 ~1.2s", explain: "The typical latency of this call, the dominant share of the whole checkout latency budget." },
          { value: "PSP honours the key for 24h", explain: "How long a repeat of this exact call is safely absorbed by the far side rather than creating a duplicate hold." },
          { value: "hold valid roughly 7 days", explain: "How long the resulting authorization stays live before it must be captured or expires on its own." },
        ],
        breaks: {
          failure: "Rails that do not deduplicate, such as most ACH gateways, treat a resubmission as a fresh instruction.",
          handled: "There the handle is a deterministic reference derived from charge_id, and looking it up before sending has to be a mandatory step rather than an error path.",
        },
      },
    },
    {
      id: "e5",
      from: "orchestrator",
      to: "ledger",
      tier: "hot",
      step: 4,
      label: "paired debit + credit",
      detail: {
        what: "Writing both halves of the movement, debit the card account and credit the merchant payable, in one transaction with the recovery point.",
        why: "Two entries rather than one balance update is what makes the books provable, and committing the recovery point alongside them is what makes the workflow resumable. Neither works without the other.",
        numbers: [
          { value: "2 entries minimum, ~3 weighted across the refund mix", explain: "The base pair of debit and credit, plus the extra entries refunds and reversals add on average." },
          { value: "~500B per entry", explain: "The storage cost of one paired ledger entry, small enough that even the full annual volume stays manageable." },
        ],
        breaks: {
          failure: "Authorize succeeded and this write failed.",
          handled: "The ledger is on the success path, so the workflow has to compensate with a void and mark an internal failure rather than leave a hold nobody recorded.",
        },
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
        why: "Each point commits in the same database transaction as its own step. That buys the one property the retry path depends on: recorded progress can lag reality but can never lead it. A resumed workflow therefore has doubt only about the step it is currently attempting.",
        numbers: [{ value: "6 recovery points", explain: "The full set of named waypoints a workflow's progress can be pinned to, from started through finished." }],
        breaks: {
          failure: "The external call is the gap this cannot close.",
          handled: "The PSP authorizes, the orchestrator dies before committing psp_authorized, and the record says risk_scored while a live hold exists; verification, not the recovery point, is what eventually closes that gap.",
        },
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
        numbers: [{ value: "4 terminal states: succeeded, failed, refunded, disputed_lost", explain: "The states from which no further transition is ever accepted, each one sticky once reached." }],
        breaks: {
          failure: "An illegal transition is dropped with an alert rather than applied.",
          handled: "A genuine bug then shows up as a metric rather than as corrupted money state, and somebody has to be watching that metric for the safeguard to mean anything.",
        },
      },
    },
    {
      id: "e8",
      from: "orchestrator",
      to: "verifier",
      tier: "hot",
      step: 5,
      label: "requires_verification",
      detail: {
        what: "Handing off a charge whose outcome is genuinely unknown, typically a capture that timed out at 4s.",
        why: "The doubt gets a state rather than an exception because it can last longer than a request and it must not be resolved by guessing. Making it a real state also means it is countable, and the unknown-PSP-state rate is the single most important operational risk metric in payments.",
        numbers: [
          { value: "capture timeout 4s", explain: "The threshold that routes a slow capture into this ambiguous state instead of letting the caller keep waiting indefinitely." },
          { value: "3 indistinguishable outcomes", explain: "The capture may have succeeded, failed, or the response was simply lost, three cases a timeout alone cannot tell apart." },
        ],
        breaks: {
          failure: "Charges that pile up here during a PSP outage are stuck by design, not by accident.",
          handled: "The backlog is customer-visible while it lasts, accepted as the honest alternative to guessing at an outcome nobody has actually observed.",
        },
      },
    },
    {
      id: "e9",
      from: "verifier",
      to: "psp",
      tier: "hot",
      step: 6,
      label: "GET by idempotency key",
      detail: {
        what: "Asking the processor what actually happened, keyed by the same value the original call carried.",
        why: "This is the second defence, you skipping the repeat rather than the far side absorbing it. It is also the step people leave out, and leaving it out is what turns an ambiguous timeout into a wedged workflow.",
        numbers: [
          { value: "polled on backoff, up to 24h", explain: "How long the verifier keeps asking, matched to the window the PSP still recognises the original idempotency key." },
          { value: "valid only inside the 24h key window", explain: "This lookup only works while the key is still honoured by the PSP; past that, the query has nothing to match against." },
        ],
        breaks: {
          failure: "Past 24h the key is gone from both sides.",
          handled: "The only remaining handle is psp_charge_id through reconciliation and human judgement, since the PSP no longer recognises the key well enough to answer a repeat lookup by it.",
        },
      },
    },
    {
      id: "e10",
      from: "verifier",
      to: "orchestrator",
      tier: "hot",
      step: 7,
      label: "confirm or compensate",
      detail: {
        what: "Returning an observed state so the saga either fast-forwards its recovery point or unwinds from the last committed step.",
        why: "Every compensation is then issued against a state you saw rather than one you assumed. Void the authorization, write a reversing ledger entry, release the risk hold, each keyed on charge_id and step so a repeat is a no-op.",
        numbers: [{ value: "up to 4 compensations, run in reverse order", explain: "The maximum unwind a saga can require, one compensating action for each forward step already taken." }],
        breaks: {
          failure: "Compensations are additional entries, never edits or deletes.",
          handled: "A bug here adds a wrong entry rather than destroying a right one, which is deliberate; the ledger grows even on the failure path so nothing is ever silently erased.",
        },
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
        numbers: [
          { value: "~1.2 events per payment after batching", explain: "The average webhook fan-out per payment once the PSP's own batching is accounted for." },
          { value: "~2.8k/s at peak, ~1KB each", explain: "The peak ingest rate and per-event size this queue absorbs during the busiest checkout traffic." },
        ],
        breaks: {
          failure: "Delivery is at-least-once and unordered, so succeeded can arrive after failed for the same charge.",
          handled: "succeeded can also arrive twice, exactly why every event is deduplicated and validated against the state machine rather than trusted at face value.",
        },
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
        numbers: [
          { value: "dedupe on 3 fields: charge_id, event_type, event_id", explain: "The composite key duplicate detection runs against, precise enough to distinguish genuinely different events for the same charge." },
          { value: "24h TTL set", explain: "How long a seen event_id is remembered before the dedupe window itself expires." },
        ],
        breaks: {
          failure: "A webhook claiming succeeded while the orchestrator still reads authorized is a legal race.",
          handled: "One claiming failed on a finalised charge is dropped and alerted instead. Confusing the two categories loses real outcomes, so each has its own explicit rule in the validator.",
        },
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
        numbers: [
          { value: "1 file/day", explain: "The delivery cadence this whole reconciliation process depends on." },
          { value: "~200B per row", explain: "200B × 27.4M peak-day rows ≈ 5.5GB, matching the peak-day figure elsewhere — small enough that even the busiest file is trivial to move and diff." },
        ],
        breaks: {
          failure: "A late or partial file silently skips a day of reconciliation.",
          handled: "The job has to alert on a missing file as loudly as it alerts on a mismatch. A day with no comparison run looks identical to a day with nothing wrong.",
        },
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
        why: "This is the direction that catches the expensive failure. A charge that exists in their book and not in yours means money moved that you never recorded, and no internal check can find it.",
        numbers: [{ value: "2.74M rows on a normal day, 27.4M on a peak day", explain: "The daily comparison volume, roughly ten times higher on the busiest day of the year." }],
        breaks: {
          failure: "Timing. Partial captures and refunds settle on a different day from the charge.",
          handled: "A naive same-day join reports mismatches that are just calendar noise, so the join window spans several days rather than comparing strictly same-day rows.",
        },
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
        why: "Comparing against the ledger rather than the charge table is deliberate. The ledger is the thing that must balance, and an entry that exists with no settlement behind it is as much a problem as the reverse.",
        numbers: [
          { value: "~3 entries per payment", explain: "The weighted average ledger entries per payment this comparison reads, matching the ledger's own entry count." },
          { value: "1 join column: psp_charge_id", explain: "The single field both the ledger and the settlement file share, the only thing this comparison can actually match on." },
        ],
        breaks: {
          failure: "Sub-cent FX rounding and dispute fees produce a small permanent diff.",
          handled: "Treating that noise as normal is how a real gap hides inside it, so the tolerance threshold is set from measured historical noise rather than an arbitrary round number.",
        },
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
        numbers: [
          { value: "chargeback window up to 120 days", explain: "How long after a payment a dispute can still arrive, far beyond the idempotency key's own 24-hour lifetime." },
          { value: "7-year settlement archive", explain: "How long the independent settlement record is kept, matching the ledger's own compliance retention." },
        ],
        breaks: {
          failure: "There is no automatic path from a four-month-old dispute back to the workflow that created it.",
          handled: "What exists is an audit trail and an operator. Any design claiming otherwise describes a system that does not exist; psp_charge_id on this row is the operator's actual starting point.",
        },
      },
    },
  ],
  figures: {
    "recovery-point": {
      title: "The recovery point never lies ahead of the work",
      nodes: [
        { id: "started", label: "started", kind: "service", col: 0, row: 0 },
        { id: "risk-scored", label: "risk_scored", kind: "service", col: 0, row: 1 },
        {
          id: "psp-authorized",
          label: "psp_authorized",
          sub: "recovery point reads here",
          kind: "service",
          col: 0,
          row: 2,
          detail: {
            what: "The last step whose work and whose recovery-point row committed together, in one transaction.",
            why: "A resumed workflow reading this value knows authorize definitely ran and knows nothing about ledger_recorded, exactly the amount of doubt a recovery point should leave.",
          },
        },
        {
          id: "ledger-recorded",
          label: "ledger_recorded",
          sub: "not yet committed",
          kind: "database",
          col: 0,
          row: 3,
        },
        { id: "captured", label: "captured", kind: "service", col: 0, row: 4 },
      ],
      edges: [
        { id: "e1", from: "started", to: "risk-scored", tier: "hot", step: 1, label: "committed together" },
        { id: "e2", from: "risk-scored", to: "psp-authorized", tier: "hot", step: 2, label: "committed together" },
        { id: "e3", from: "psp-authorized", to: "ledger-recorded", tier: "control", label: "not reached yet" },
        { id: "e4", from: "ledger-recorded", to: "captured", tier: "data", label: "not reached yet" },
      ],
    },
    verification: {
      title: "One query replaces three guesses",
      nodes: [
        { id: "timeout", label: "Capture timeout", kind: "client", col: 0, row: 0 },
        {
          id: "possibilities",
          label: "3 possible outcomes",
          sub: "never arrived, succeeded, ack lost",
          kind: "external",
          col: 0,
          row: 1,
          detail: {
            what: "The request never arrived, arrived and succeeded, or arrived, succeeded, and the response was lost in transit.",
            why: "Nothing at the caller distinguishes these three, and guessing wrong in either direction, assuming failure or assuming success, costs real money.",
          },
        },
        {
          id: "verify",
          label: "Verification state",
          sub: "queries the PSP directly",
          kind: "service",
          col: 0,
          row: 2,
          detail: {
            what: "A worker that asks the PSP directly, by the same idempotency key, rather than picking the statistically likelier guess.",
            why: "This is the only place the ambiguity actually gets resolved, so nothing downstream ever confirms or compensates on a guess.",
          },
        },
        { id: "resolve", label: "Confirm or compensate", kind: "service", col: 0, row: 3 },
      ],
      edges: [
        { id: "e1", from: "timeout", to: "possibilities", tier: "hot", step: 1, label: "ambiguous" },
        { id: "e2", from: "possibilities", to: "verify", tier: "hot", step: 2, label: "query PSP, don't guess" },
        { id: "e3", from: "verify", to: "resolve", tier: "hot", step: 3, label: "actual answer" },
      ],
    },
  },
};
