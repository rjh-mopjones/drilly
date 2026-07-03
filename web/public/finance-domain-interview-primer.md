---
type: interview-prep
---

# Finance Domain Interview Primer — 333 Questions

Comprehensive Q+A primer on the **finance domain knowledge a software engineer needs** to build trading, banking, asset-management, and fintech systems. The first primer in the Computational Finance category, expanding the folded Finance Domain cheat sheet. Its stance: **fluency, not depth** — for every concept, *what it is → why an engineer cares → what it means for the data/system* — with **no trading-strategy or pricing mathematics**. It is the domain layer that ties the System Design, SQL, and OOD primers together, leading with the data model and its invariants.

Covers domain fundamentals, financial instruments & asset classes, equities & corporate actions, fixed income, derivatives, FX & multi-currency, identifiers & the security master, the trade lifecycle (order → execution → clearing → settlement), positions/PnL/NAV, counterparties/custody/reconciliation, treasury/cash/payments, market structure, market-vs-reference data, portfolio accounting, risk & regulation vocabulary, money & ledgers in software, financial-systems engineering patterns, fintech/payments/crypto, the false-friend vocabulary, and design playbooks.

The recurring engineer insight, threaded throughout: a **trade is an immutable event**, a **position is derived state** (a fold over trades), and a **balance is a point-in-time aggregate** — never conflate them. Each answer ends on the data/system angle, with schema sketches, event→fold flows, and comparison tables. Warm-up ("equity vs bond", "what is T+2", "long vs short") to senior ("design a real-time position-keeping service from a trade stream", "design an intraday-queryable EOD NAV/PnL", "why never use float for money").

1. [[#Finance Domain Fundamentals for Engineers]]
2. [[#Financial Instruments & Asset Classes]]
3. [[#Equities & Corporate Actions]]
4. [[#Fixed Income & Money Markets]]
5. [[#Derivatives: Futures, Options & Swaps]]
6. [[#FX, Currencies & Multi-Currency Systems]]
7. [[#Identifiers & the Security Master]]
8. [[#Trade Lifecycle: Order to Execution]]
9. [[#Trade Lifecycle: Clearing & Settlement]]
10. [[#Positions, PnL & NAV]]
11. [[#Counterparties, Custody & Reconciliation]]
12. [[#Treasury, Cash & Payments]]
13. [[#Market Structure & Trading Venues]]
14. [[#Market Data vs Reference Data]]
15. [[#Portfolio Management, Accounting & NAV]]
16. [[#Risk & Regulation Vocabulary]]
17. [[#Money, Accounting & Ledgers in Software]]
18. [[#Financial-Systems Engineering Patterns]]
19. [[#Fintech, Payments & Crypto/DeFi]]
20. [[#Speaking the Language: False Friends & Data Modeling]]
21. [[#Finance Domain Scenario & Interview Playbooks]]

## Finance Domain Fundamentals for Engineers

### Summary

**What this topic covers**

This topic is the on-ramp for an engineer who has to build software inside a financial firm — a bank, a hedge fund, an asset manager, an exchange, or a fintech — and needs the domain fluency to not build the wrong thing. It is deliberately *not* a finance course. You will not price an option or compute a yield curve here; that is a quant's job. What you need is the *shape* of the business: who the players are, how money and data move through a firm, and the handful of mental models that make financial systems make sense. The 16 questions in this topic cover the **buy-side vs sell-side** split, the **front / middle / back office** structure, the money-and-data flow through a firm, the recurring engineer mental model (**trade is an event, position is derived, balance is an aggregate**), core direction jargon (**long / short / the book**, notional), and — critically — how finance systems differ from the CRUD apps most engineers cut their teeth on. Get this topic right and every later topic (instruments, trade lifecycle, positions, reconciliation) has somewhere to attach.

**Mental model**

Picture a financial firm as a **pipeline that turns intent into settled money, and leaves an immutable paper trail at every step**. Someone decides to trade (front office), someone checks and values it (middle office), someone makes the cash and securities actually move and proves the books are right (back office). Underneath all of it is one data insight that engineers repeatedly miss: the firm records **events** (a trade happened), and everything else — your position, your P&L, your balance — is *derived* from those events, not stored as an independent source of truth. A trade is a fact that occurred at an instant and never changes. A position is what you get when you fold all the trades for one instrument together. A balance is that fold evaluated at a specific point in time. If you internalise `trade = event, position = derived, balance = aggregate` on day one, you will design append-only, auditable, reconstructable systems by default — which is exactly what this domain demands and what regulators require.

**Key terms**

- **Buy-side** — firms that invest capital (asset managers, hedge funds, pension funds); they *buy* research and execution.
- **Sell-side** — firms that create and sell products and services (investment banks, brokers, market makers); they *sell* to the buy-side.
- **Front office** — revenue-generating: traders, sales, portfolio managers. Where trades originate.
- **Middle office** — risk, P&L, trade validation, compliance. Checks and values what the front office does.
- **Back office** — settlement, reconciliation, books-and-records, corporate actions. Makes money actually move and proves the books.
- **Trade** — an immutable event: a done deal to buy/sell a quantity of an instrument at a price and time.
- **Position** — derived state: your net holding in one instrument, computed by folding trades. Not stored as truth.
- **Balance** — a point-in-time aggregate (cash or quantity) as it stood at instant *t*.
- **Long** — you own it / bet the price goes up. Direction, not duration.
- **Short** — you sold something you borrowed / bet the price goes down. Direction, not brevity.
- **The book** — a portfolio, a set of positions a desk runs. NOT a database table or ledger.
- **Notional** — the face/contract amount an exposure is calculated on; not the same as market value.

**Why interviewers ask this**

For a fintech or finance-engineering role, domain fluency is a hiring signal on its own. A junior candidate talks about the technology in a vacuum — "I'd store trades in Postgres and compute a running total." A senior candidate frames the *business invariants first* — "trades are immutable events, positions are a derived fold, so I'd model an append-only event log and materialise positions as a read model; and because this is regulated, audit and lineage are requirements, not features." Interviewers ask about buy-side/sell-side and office structure to check you know *who you're building for* — an ops-dev team automating back-office reconciliation has completely different constraints than a front-office low-latency execution team. Getting the vocabulary right (order vs trade, position vs balance, long as direction) signals you can talk to traders and ops without your schema quietly lying to them. Getting it wrong is a fast junior tell.

**Common confusions**

- **"Long means long-term, short means short-term."** No — both are *direction*. A short can be held for months; a long can be closed in seconds.
- **"The book is a database table."** It's a *portfolio* — a business grouping of positions, not a storage concept.
- **"Position is a column I update."** Position is *derived* — a fold over trades. Storing it as an editable field is the classic mistake that breaks audit and reconciliation.
- **"Buy-side buys stocks, sell-side sells stocks."** No — it's about the business model. Both sides buy and sell securities; the buy-side *consumes* execution/research, the sell-side *provides* it.
- **"Trade and settlement are the same moment."** A trade is agreed today; the cash and securities move days later (T+1/T+2). Trade done ≠ settled.
- **"Finance apps are just CRUD."** They're append-only, immutable, exact-decimal, audit-heavy, reconstructable-as-of-any-date systems. Update-in-place thinking gets you fired in this domain.

**What follows from this topic**

Everything. The office structure tells you which systems you'll build (front-office execution, middle-office risk/P&L, back-office settlement/recon). The instrument types you'll meet are in **Financial Instruments & Asset Classes**. The event→position→balance model drives **Positions, P&L & NAV** and the event-sourcing patterns. The "trade done ≠ settled" gap opens up the **Trade Lifecycle** topic. And the audit/immutability requirement that separates finance from CRUD is the through-line of **Risk & Regulation** and **Financial-Systems Patterns**. This topic is the map; the rest fill in the territory.

### Q1. Explain buy-side vs sell-side to an engineer, and why it changes what you build.

The split is about *business model*, not about who buys or sells securities (both do plenty of both).

**Sell-side** = firms that *create and sell* financial products and services: investment banks, brokers, market makers, exchanges. They provide execution, research, liquidity, and structured products. Their systems are tuned for **throughput and latency** — order routing, matching engines, market-making, client-facing pricing.

**Buy-side** = firms that *invest capital*: asset managers, hedge funds, pension funds, insurers. They *consume* the sell-side's execution and research. Their systems are tuned for **portfolio management, position-keeping, risk, and reporting to end investors**.

**Why an engineer cares:** the same word means different systems on each side. "Order management" on the sell-side is a matching/routing problem; on the buy-side it's a portfolio-construction and compliance problem. A custodian, a NAV calc, an IBOR (investment book of record) are buy-side concerns; a matching engine and market-maker quoting are sell-side. Knowing which side you're on tells you the dominant non-functional requirement — ultra-low latency (sell-side execution) vs correctness/auditability/point-in-time reporting (buy-side books). Build the wrong one and you've optimised the wrong axis.

### Q2. What are the front, middle, and back office, and which one does an ops-dev team usually build for?

Three functional layers, split by how close you are to the money-making decision:

| Office | Does | Systems you'd build |
|---|---|---|
| **Front** | Trading, sales, portfolio management — generates revenue | Execution, order management, pricing, market-making |
| **Middle** | Risk, P&L, trade validation, compliance | Risk engines' data feeds, P&L calc, limit checks, trade capture validation |
| **Back** | Settlement, reconciliation, books-and-records, corporate actions | Recon pipelines, settlement instruction generation, ledger, security master |

The flow is front → middle → back: the front office does a deal, the middle office validates and values it, the back office settles it and proves the books agree.

**Ops-dev teams almost always sit in the middle/back office.** That's where the bread-and-butter engineering lives: reconciliation, settlement automation, position-keeping, corporate-actions processing, regulatory reporting. It's less glamorous than the front-office latency arms race but it's where most finance engineers actually work, and it's dominated by data-quality, idempotency, and audit concerns — not microseconds.

### Q3. Walk me through how money and data flow through a firm when a trade happens.

Two flows run in parallel: the **data/event flow** and the **actual money/asset flow**, and they happen at different times.

**Data flow (fast, front-to-back):**
1. Front office decides and places an **order** (intent).
2. It's executed in the market → one or more **fills** → a **trade** (a done deal, an immutable event).
3. Middle office **validates** the trade, updates **risk and P&L**, checks limits.
4. Back office **enriches** it with settlement details (which custodian, which account, settlement date/currency), sends **confirmations**, and books it to the ledger.

**Money flow (slow, days later):**
5. **Clearing** — a central counterparty nets obligations and guarantees them.
6. **Settlement** — cash and securities actually change hands, typically **T+1 or T+2** (one or two business days after trade date), delivery-versus-payment.
7. Back office **reconciles** internal records against the custodian/counterparty to prove both sides agree; mismatches are **breaks** to investigate.

**Engineer angle:** the data event exists days before the money moves, so your systems must model *pending, unsettled, failed* states explicitly — settlement is a state machine, not a boolean. And every step appends to an audit trail; nothing is overwritten.

### Q4. What is the "trade = event, position = derived, balance = aggregate" mental model, and why does it matter?

It's the single most useful mental model in finance engineering, and engineers conflate the three constantly.

- **Trade = event.** A trade is an immutable fact: "bought 100 ACME at 10 at 14:32 on 2026-07-01." It happened; it never changes. Append-only.
- **Position = derived state.** Your position in ACME is the *fold* (reduce) over all ACME trades: net quantity, average cost. It is *computed*, not stored as a source of truth.
- **Balance = point-in-time aggregate.** A balance is that fold evaluated at an instant: "as of end-of-day 2026-07-01, cash balance = X, ACME position = 120 shares."

```text
trades (events, append-only):
  +100 @ 10   -->  position 100
  +50  @ 11   -->  position 150
  -30  @ 12   -->  position 120  (balance as-of now)
```

**Why it matters:** if you store position as an editable column and `UPDATE` it on each trade, you have no audit trail, you can't answer "what was my position as of last Tuesday," and any bug corrupts truth irrecoverably. If instead trades are the source of truth and position is a derived fold, you can rebuild state from the log, run as-of queries, and corrections become new compensating events rather than destructive edits. This is event sourcing, and finance is its natural home. See **Positions, P&L & NAV** for the full treatment.

### Q5. What does "long" and "short" mean, and what's the classic misconception?

**Long** = you own the asset (or otherwise profit if the price rises). If you buy 100 shares of ACME, you're *long* 100 ACME.

**Short** = you've sold something you don't own — typically borrowed it to sell — and profit if the price *falls*; you buy it back cheaper later to return it. A short position is a *negative* holding.

**The classic misconception:** long/short is about *duration*. It is not. It is about **direction** — which way you're betting. A short position can be held for months ("a long-term short"); a long position can be flipped in seconds. The words describe your exposure sign, not your time horizon.

**Engineer angle:** in your data model, direction is just the *sign of the quantity*. Long 100 = `+100`, short 100 = `-100`. Don't invent a separate `direction` enum column that can contradict the sign — that's two sources of truth for one fact. Net position naturally falls out of summing signed quantities: three buys and a sell fold to a signed net. Getting the sign convention consistent across trades, positions, and P&L is a real source of bugs.

### Q6. What is "the book" and why is it a false-friend for engineers?

**The book** is a **portfolio** — the set of positions a trading desk or strategy runs. "My book is long tech, short energy" means the portfolio holds long positions in tech and short positions in energy. Desks are often organised as books ("the rates book," "the credit book").

**Why it's a false-friend:** to an engineer, "book" screams *ledger* or *database table*. It is neither. It's a *business grouping* of positions — a dimension you partition and aggregate by, not a storage structure. The related verb "to book a trade" (to record it) adds to the confusion, but "the book" (noun) is the portfolio.

**Engineer angle:** the book is your natural **partition key**. Positions are computed *per book* (per portfolio); trade streams are keyed and ordered *per book* for correctness; P&L and risk are aggregated *per book*. When you hear "the book," think `portfolioId` — the grouping that everything folds up to. See **Financial-Systems Patterns** for why per-portfolio ordering matters and how it lets you parallelise across books.

### Q7. Why is "domain fluency, not pricing maths" the right bar for a finance engineer?

Because the maths and the engineering are *different jobs owned by different people*. Quants and pricing desks own the models — option pricing, the Greeks, yield curves, VaR computation. You don't need to derive Black-Scholes to build a great trading system. What you *do* need is fluency: knowing what an option *is* (a right, not an obligation), what data it requires (strike, expiry, call/put, underlying), and that its price and sensitivities are *numbers your system stores and serves*, computed elsewhere.

Concretely, the engineer's job is: model the instrument correctly, store the numbers with their provenance (which model, which timestamp, which source), move them around exactly (never as floats), keep them auditable, and reconcile them. The "Greeks" are just more columns to persist and display — you never compute them.

**Why the bar matters:** engineers who think they need to be quants either freeze up ("I don't know the maths so I can't design this") or over-reach (reimplementing a pricing model badly instead of consuming the desk's). The right stance is: *I own the system, the correctness, the audit, the data flow; the desk owns the numbers.* Fluency lets you have the conversation; you don't need the PhD.

### Q8. How do financial systems differ from typical CRUD apps?

They look like CRUD apps and are emphatically not. Four differences dominate:

1. **Immutability / append-only.** You don't `UPDATE` a booked trade or `DELETE` a settled transaction. Corrections are *new compensating entries* so the original and the fix both survive. State is rebuilt from an event log, not mutated in place.

2. **Audit trail and lineage are non-negotiable.** Regulators and auditors must reconstruct *who did what, when, from what input* — sometimes years later. Every figure must trace back to its source. `who / when / source` are mandatory fields, not nice-to-haves.

3. **Exactness.** Money is never a float. Binary floating point can't represent 0.10; errors compound and break reconciliation. You use exact decimals or integer minor units, with explicit rounding rules, and always store the currency alongside the amount.

4. **Derived-not-stored state and as-of queries.** Positions and balances are computed folds, and you routinely need "what was true as of date X" (point-in-time / bitemporal) — not just "what's true now" (last-write-wins).

**Engineer angle:** if you bring CRUD instincts — mutate rows, floats for money, last-write-wins, delete freely — you will build a system that fails its first audit and can't be reconciled. Finance rewards event-sourced, append-only, exact-decimal, bitemporal design from day one; retrofitting it is brutal.

### Q9. A junior proposes a `positions` table with a `quantity` column they `UPDATE` on every trade. What's wrong and what would you do instead?

**What's wrong:** they've made *derived state* the *source of truth*. Problems cascade:

- **No audit trail.** After ten trades the row shows `120` and you have no idea how you got there — regulators can't reconstruct it.
- **No as-of queries.** "What was my position last Tuesday?" is unanswerable; the history is gone.
- **Corrections are destructive.** A wrong trade means editing the total by hand — untraceable, and easy to get wrong.
- **Concurrency hazards.** Concurrent updates to one row need careful locking and are a contention hotspot.
- **A single bug corrupts truth irrecoverably** — there's no log to rebuild from.

**What to do instead:** make **trades the append-only source of truth** and treat position as a **derived read model** — a fold over the trade events for `(instrument, portfolio)`:

```sql
-- source of truth: immutable events
-- position is a query, not a stored column
SELECT portfolio_id, instrument_id,
       SUM(signed_qty)                       AS net_qty,
       SUM(signed_qty * price) / SUM(signed_qty) AS avg_cost
FROM trades
WHERE portfolio_id = :p
GROUP BY portfolio_id, instrument_id;
```

For performance, materialise the position as a **snapshot** and replay only the delta since the snapshot — `snapshot + delta`, not full history every time. Corrections are new compensating trades, never edits. This is event sourcing; it's the default in this domain.

### Q10. What's the difference between a trade and a position — precisely?

They're different *kinds* of thing, not just different granularities.

- A **trade** is an **event** — a discrete, immutable fact with a timestamp: "bought 50 ACME at 11." It is atomic and never changes once booked.
- A **position** is **derived state** — the *net result* of folding all trades for one `(instrument, portfolio)`: net quantity and average cost. It changes only because new trades arrive, and it's *computed*, not independently stored.

Analogy for an engineer: trades are the **event log**; the position is the **materialised aggregate** you get by reducing the log. Same relationship as a Git commit history (immutable events) to the current working tree state (derived).

**Why interviewers push on this:** conflating them produces the broken "update a quantity column" design. Keeping them distinct produces an event-sourced design that's auditable and reconstructable. It also clarifies conversations: a trader means a *transaction* when they say "trade" and a *net holding* when they say "position" — if your API uses the words loosely, it lies. Related: a **balance** is the position (or cash) evaluated *as of a specific instant* — the point-in-time slice.

### Q11. Why is exactness — never using floats for money — so central to this domain?

Because binary floating point literally cannot represent common decimal money values. `0.1 + 0.2 != 0.3` in IEEE-754 double. In a firm processing millions of transactions, those tiny representation errors **compound**, and — worse — they cause **reconciliation to fail**: your number and the custodian's number differ by a fraction of a cent, and now an ops person is chasing a phantom break.

**What you do instead:**
- Use an **exact decimal type** (`BigDecimal` in Java, `decimal` in C#, `NUMERIC/DECIMAL` in SQL), or store **integer minor units** (cents, pence).
- **Define rounding explicitly** — e.g. banker's rounding (HALF_EVEN) — never rely on a language default.
- **Always store the currency with the amount.** `Money = (amount, currency, scale)`. A bare number is meaningless: is `100` dollars or yen? Is it dollars or cents?
- **Mind the minor-unit count** — it's per-currency (ISO 4217 exponent). USD has 2 decimal places, JPY has 0. Hard-coding "divide by 100" corrupts JPY.

**Engineer angle:** this isn't pedantry — it's the difference between books that reconcile and books that don't. Exact money is a hard requirement, and it's the first thing a finance interviewer checks you won't get wrong. See the **Treasury, Cash & FX** and money-handling patterns for more.

### Q12. What is "notional" and why isn't it the same as market value?

**Notional** is the **face/contract amount** an instrument's exposure is calculated on — the headline size of the deal. A "$10m interest-rate swap" has a $10m *notional*: that's the principal the interest payments are computed on.

**Market value** is what the position is actually *worth right now* — quantity times current price, or the present value of future cash flows.

They can be wildly different. That $10m-notional swap might have a present value of near **zero** at inception (both legs are worth the same) and only drift to a few thousand dollars as rates move. The notional never changes; the market value moves every day.

**Engineer angle:** these are **two different columns** and you must never reuse one for the other. Risk limits are often set on *notional* (exposure size); P&L and NAV use *market value*. If your schema stores one and labels it the other, your risk reports and your valuations both lie. Store notional as a static attribute of the deal and market value as a time-varying, mark-dependent figure with its price source and timestamp. Same discipline as never conflating trade (event) with position (derived).

### Q13. Why does this domain reuse ordinary English words (order, fill, book, long) with precise meanings — and why should an engineer care?

Because finance grew its own jargon on top of everyday words, and each word has a *precise* technical meaning that differs from the casual one. "Order" isn't a request in general — it's a specific lifecycle entity (intent to trade, not yet done). "Fill" is a quantity executed. "Book" is a portfolio. "Long" is direction. "Trade" is a done deal, distinct from the order that spawned it.

**Why an engineer must care:** your **schema and API names are a contract with the business**. If you model `order` and `trade` as the same table because they "seem the same," your data model lies — a trader asking "how many of my orders filled" gets a nonsense answer. If you call a portfolio a "ledger" you'll confuse everyone in ops. Using the words *exactly* as the business does means your types, tables, and endpoints map cleanly onto how traders and ops actually think — which is the whole point of domain-driven design.

The remedy is a shared glossary and disciplined naming: one entity per business concept, named the business's way. When in doubt, ask a trader what a word means *here* — the casual meaning is often wrong. The **Trade Lifecycle** topic drills the order/execution/fill/trade distinctions specifically.

### Q14. What's the difference between clearing and settlement, and why can't they be one step in your model?

They're distinct post-trade stages that happen at different times and mean different things.

- **Clearing** — after a trade is agreed, a **central counterparty (CCP)** steps in, **nets** offsetting obligations across participants, and **guarantees** the trade (so if one side defaults, the CCP makes the other whole). No cash or securities have moved yet; clearing is about *establishing and de-risking the obligation*.
- **Settlement** — the **actual exchange** of cash for securities (delivery-versus-payment), typically **T+1 or T+2** business days after the trade. This is when ownership and money genuinely change hands.

**Why they can't be one step:** between execution and settlement, a trade lives in intermediate states — *cleared but not settled*, or *failed to settle*. If your model collapses "trade done" into "money moved," you can't represent a settlement **fail** (securities didn't arrive on time) or a pending obligation, and your cash projections will be wrong.

**Engineer angle:** model settlement as an explicit **state machine** — `executed → cleared → settled`, with `pending` and `failed` branches — not a boolean `settled` flag. And **T+2 uses *business* days**: you need a holiday calendar per market, not `trade_date + INTERVAL '2 days'`, or you'll settle on a weekend that doesn't exist.

### Q15. Design the top-level data flow for a middle-office trade-capture system. What are the invariants?

Restating: the middle office receives trades from front-office execution systems, validates and enriches them, and feeds risk/P&L and the back office. Sketch:

```text
front office (execution)
        | trade events (FIX / message bus)
        v
[capture] -- idempotent ingest, dedupe on source trade id
        v
[validate] -- economics sane? instrument known in security master?
        v
[enrich]  -- resolve to canonical instrument id, book, counterparty
        v
[publish] -- append to immutable trade log
        |            \
        v             v
   risk / P&L     back office (settlement, recon)
   (fold -> positions)
```

**Invariants I'd hold:**
- **Idempotent ingest** on a *business* key (the source trade id), not a transport/message id — the same trade will be redelivered and must not double-book.
- **Append-only.** The trade log is immutable; corrections are compensating events, never edits.
- **Per-book ordering.** Trades for one portfolio must apply in order (a buy then a sell can't reorder); trades across portfolios can process in parallel — partition the stream by `portfolioId`.
- **Everything resolves through the security master** to a canonical instrument id; never key business data on a raw ticker.
- **Audit fields mandatory** — `who / when / source` on every record.

**Engineer angle:** positions and P&L are *derived read models* folded off the published trade log (CQRS), not computed inline. This gives you rebuild-from-log, as-of queries, and a clean audit trail — the non-negotiables of this domain.

### Q16. If you had to give a new finance engineer one piece of domain advice, what would it be and why?

**"Model events, derive everything else, and never destroy history."**

Everything hard about finance systems flows from this. Trades are events; positions, balances, P&L, and NAV are *derived* from them. If you make the events your source of truth and keep them append-only:

- **Audit and lineage come for free** — you can always reconstruct who did what, when, from what input, which regulators require.
- **As-of / point-in-time queries become possible** — "what was my position last Tuesday" is just replaying the log to that timestamp.
- **Corrections are safe** — a compensating event, not a destructive edit, so the original and the fix both survive.
- **Reconciliation has something to match against** — an immutable record, not a mutated guess.

The anti-pattern — the CRUD instinct to mutate a row in place, store derived totals as truth, use floats, and delete freely — is precisely what fails audits and breaks reconciliation in this domain. New engineers reach for it constantly because it's what every other app taught them. Unlearning it is the single highest-leverage thing you can do. Everything else in this primer — instruments, lifecycle, positions, recon, regulation — is a specific application of "events are truth, the rest is derived, history is sacred."

## Financial Instruments & Asset Classes

### Summary

**What this topic covers**

An **instrument** is a tradable financial contract — a share, a bond, a future, an option, a swap, a lump of cash, a currency pair. This topic gives an engineer just enough fluency in the core instrument types to model them correctly, without wandering into pricing maths. The 16 questions cover the five workhorse instruments — **equity** (ownership), **bond** (a loan with a coupon and par), **future** (an exchange contract to trade later), **option** (a *right*, not an obligation), and **swap** (an exchange of cash flows) — plus **cash** and **FX**. The organising idea is the **derivative**: an instrument whose value is *derived* from an underlying (futures, options, and swaps all qualify). For each instrument the lens is the same: *what it is → why an engineer cares → what data you must store*. Because different instruments carry radically different attributes (a bond has a coupon and maturity; an option has a strike and expiry and a call/put flag; an equity has neither), how you model instrument reference data — one table or many, shared vs type-specific attributes — is a real design question this topic sets up. Crucially: the **Greeks, pricing, and valuation are quant concerns**, not yours. You store the numbers; you don't compute them.

**Mental model**

Think of an instrument as a **contract with a payoff and a set of attributes your system must persist**. The five types differ mainly in *what obligates whom, when, and how the payoff is computed* — and therefore in *what columns you need*. Equity: you own a slice of a company; store issuer, share class, currency. Bond: you lent money; store issuer, coupon, coupon frequency, maturity, par — payoff is scheduled cash flows plus principal back. Future: you're locked into buying/selling an underlying at a set price on a set date; store underlying, contract size, expiry, exchange. Option: you *bought the right* (not obligation) to buy (call) or sell (put) at a strike before/at expiry; store underlying, strike, expiry, call/put, exercise style. Swap: you agreed to exchange streams of cash flows (e.g. fixed-for-floating interest); store the two legs, notional, reset schedule. The **derivative** thread ties futures/options/swaps together: their value comes from something *else* (the underlying), which means your data model must link the derivative to its underlying instrument. The engineer's recurring question is never "what's it worth" (a quant answers that) but "what attributes uniquely define this contract, and how do I store its identity and terms."

**Key terms**

- **Instrument** — any tradable financial contract (equity, bond, future, option, swap, cash, FX).
- **Asset class** — a grouping of instruments with similar characteristics (equities, fixed income, rates, credit, FX, commodities).
- **Equity** — an ownership share in a company; may pay dividends.
- **Bond** — a loan to an issuer; pays periodic **coupons** and repays **par** (face value) at **maturity**.
- **Future** — an exchange-traded, standardised contract to buy/sell an underlying at a set price on a set future date.
- **Option** — the *right, not the obligation*, to buy (**call**) or sell (**put**) an underlying at a **strike** price by **expiry**.
- **Swap** — an agreement to exchange streams of cash flows (e.g. fixed interest for floating); mostly **OTC**.
- **Underlying** — the asset a derivative's value is derived from.
- **Derivative** — an instrument whose value is *derived* from an underlying (futures, options, swaps).
- **Strike** — the fixed price at which an option can be exercised.
- **Coupon** — the periodic interest a bond pays.
- **Par / face value** — the principal amount a bond repays at maturity.

**Why interviewers ask this**

Because you cannot model what you don't understand. An engineer who can't distinguish a bond from a swap will design a security master that can't hold both, or will cram type-specific attributes (strike, coupon, maturity) into a soup of nullable columns with no integrity. Interviewers use instrument questions to check two things: (1) **fluency** — can you explain call vs put, long vs short a future, coupon vs par, in plain terms; and (2) **data-modelling instinct** — given that a bond and an option have almost disjoint attribute sets, how do you structure reference data? The senior signal is framing every instrument in terms of *the data it forces you to store and the invariants it implies* (an option with no strike is invalid; a bond with no maturity is invalid), and knowing where the boundary is — that pricing and the Greeks live on the quant side of a clean interface, and your job is identity, terms, and exact persistence.

**Common confusions**

- **"A future and an option are basically the same."** No — a future *obligates* both sides to transact; an option is a *right* the holder may decline. Different payoff, different data (options need a strike and call/put flag).
- **"Buying an option means I have to exercise it."** You don't — it's a right. You exercise only if it's favourable; otherwise it expires worthless.
- **"Notional is what the swap is worth."** No — notional is the reference amount cash flows are computed on; the swap's market value can be near zero.
- **"A derivative is exotic/risky by definition."** A derivative just means *value derived from an underlying*. A plain future on an index is a derivative and utterly standard.
- **"Bonds are safe, equities are risky, so model them the same."** Their *data* is what differs to an engineer: bonds have coupons/maturity/par and a schedule; equities have share class and dividends. Risk is a separate concern (columns/limits).
- **"I need to compute the option price."** You don't. Pricing and the Greeks are quant-owned; you store and serve the numbers.

**What follows from this topic**

These instrument types are the entities your **security master** models (see **Equities & Corporate Actions** for the equity slice and how corporate actions rewrite reference data). The identifiers that name them (ISIN, CUSIP, ticker, FIGI) and the reason a security master exists belong to the identifiers/security-master topic. How each instrument's *trades* flow through order → execution → settlement is **Trade Lifecycle**. How holdings in them fold into **positions and P&L** is **Positions, P&L & NAV**. And the exchange-vs-OTC distinction (futures/options are exchange-traded; most swaps are OTC and bespoke) sets up **Market Structure & Data**. This topic is the noun catalogue; the rest describe what happens to the nouns.

### Q1. Explain the five core instrument types to an engineer, and what data each forces you to store.

The lens for an engineer is always *what attributes uniquely define this contract*:

| Instrument | What it is | Key data to store |
|---|---|---|
| **Equity** | Ownership share in a company | issuer, share class, currency, listing exchange |
| **Bond** | A loan to an issuer | issuer, coupon rate, coupon frequency, maturity date, par value, currency |
| **Future** | Exchange contract to buy/sell an underlying later | underlying, contract size, expiry date, exchange, tick size |
| **Option** | *Right* (not obligation) to buy (call)/sell (put) | underlying, strike, expiry, call/put flag, exercise style |
| **Swap** | Exchange of cash-flow streams | leg 1 + leg 2 terms, notional, reset/payment schedule, currency |

Two observations that drive the data model:

1. **The attribute sets barely overlap.** A bond has a coupon and maturity; an option has a strike and call/put; an equity has neither. A single flat table would be a swamp of nullable columns with no integrity.

2. **Derivatives reference an underlying.** Futures, options, and swaps all derive value from *something else*, so their rows must link to the underlying instrument.

**Engineer angle:** this is exactly why security-master design is non-trivial. You typically model a shared "instrument" core (id, type, currency, issuer) plus type-specific attributes (single-table-inheritance with type discrimination, class-table-inheritance with per-type tables, or a typed attributes model). What you never do is pretend they're interchangeable. Pricing each of these is a quant job; you store the terms.

### Q2. What is a bond, in engineer terms — coupon, par, and maturity?

A **bond is a loan** to an issuer (a government or company). You lend them money; in return they promise two things: periodic interest, and your principal back at the end.

- **Par (face value)** — the principal that gets repaid at the end, e.g. $1,000. It's the reference amount, not the price you paid.
- **Coupon** — the periodic interest, quoted as a rate on par. A 5% annual coupon on $1,000 par pays $50/year, often split into semi-annual $25 payments.
- **Maturity** — the date the bond ends and par is repaid.

So a bond's payoff is a **schedule of cash flows**: coupons on set dates, then par at maturity.

**Engineer angle:** the defining data is the **schedule**. To hold a bond correctly you store issuer, coupon rate, coupon frequency, day-count convention, maturity, par, and currency — and you often materialise the *cash-flow schedule* (which dates pay what). Note the false-friend: **par ≠ market price**. A bond trades above or below par depending on rates, but par is a fixed contractual attribute. Store par as a static term and price as a time-varying mark. And the coupon payment dates need a **business-day calendar** — payments roll off weekends/holidays.

### Q3. What's the difference between a future and an option — and why does it change the data you store?

The core difference is **obligation vs right**:

- A **future** *obligates* both parties: at expiry, the buyer *must* buy and the seller *must* sell the underlying at the agreed price. There's no choice.
- An **option** gives the holder a **right, not an obligation**: a **call** is the right to *buy* at the strike; a **put** is the right to *sell* at the strike. The holder exercises only if it's favourable; otherwise it expires worthless. The seller (writer) is obligated if the holder exercises.

**Why the data differs:**

```text
Future:  underlying, expiry, contract size, exchange, agreed price
Option:  underlying, expiry, contract size, exchange,
         STRIKE, CALL/PUT flag, EXERCISE STYLE (American/European)
```

An option needs a **strike**, a **call/put flag**, and an **exercise style** (American = exercise any time before expiry; European = only at expiry) — a future needs none of those. An option row with a null strike or missing call/put flag is *invalid by construction*; enforce that.

**Engineer angle:** this is a concrete case where "an instrument is just an instrument" breaks down. Options carry attributes and integrity constraints that futures don't. And note: *whether* to exercise, and what the option is *worth*, is pricing (quant); your job is to store strike/expiry/type correctly and record exercise *events* when they happen.

### Q4. What is a swap, and why is notional such a trap for engineers?

A **swap** is an agreement between two parties to **exchange streams of cash flows** over time. The classic is an **interest-rate swap**: one party pays a **fixed** rate, the other pays a **floating** rate, both computed on the same **notional** principal, exchanged on a schedule. Neither party lends the notional — it's just the reference amount the payments are calculated on.

**Why notional is a trap:** the **$10m notional never changes hands and is not what the swap is worth.** At inception, both legs are worth the same, so the swap's market value (present value) is roughly **zero**. As rates move, one leg becomes worth more than the other and the swap drifts to a positive or negative value — but that value might be a few thousand dollars on a $10m notional.

**Engineer angle:**
- Store **notional** and **market value** as *separate columns*; never reuse one for the other. Risk limits often key on notional; P&L keys on market value.
- Model the swap as **two legs**, each with its own rate basis, schedule, and payment convention — not a single row.
- Swaps are mostly **OTC** (bilateral, bespoke), so terms vary per deal; your model must be flexible, not assume exchange-standardised contracts.

Pricing the swap (discounting the legs) is a quant job. You store the legs, notional, and schedule.

### Q5. What does "derivative" actually mean, and give the canonical examples.

A **derivative** is an instrument whose **value is *derived* from an underlying** asset or reference — it has no intrinsic value of its own; its worth depends on something else.

The canonical examples:
- **Future** — value derives from the price of the underlying (an index, a commodity, a stock).
- **Option** — value derives from the underlying's price relative to the strike.
- **Swap** — value derives from reference rates or prices (interest rates, FX, etc.).

Contrast with a **cash instrument** like an equity or a bond, whose value is intrinsic (ownership of a company, a claim on repayment).

**Engineer angle:** "derivative" is a *data-model relationship*, not a risk label. The defining feature for you is that a derivative row must **link to its underlying** — you can't fully describe a call option without pointing at the stock it's on. That's a foreign key from the derivative to another instrument (or to a market reference like an index or rate). Common confusion to correct: derivative does **not** mean "exotic" or "dangerous" — a plain vanilla index future is a derivative and is completely standard. And, as ever: how much the derivative is *worth* given its underlying is the quant's pricing problem; your job is to store the linkage and the contract terms.

### Q6. Build a comparison table of equity vs bond vs future vs option vs swap for a data model.

Here's the engineer's cheat sheet — same five instruments, viewed as *what you store and what constraints hold*:

| | Equity | Bond | Future | Option | Swap |
|---|---|---|---|---|---|
| **Nature** | Ownership | Loan | Obligation to trade later | Right to trade | Exchange of cash flows |
| **Derivative?** | No | No | Yes | Yes | Yes |
| **Venue** | Exchange | Exchange/OTC | Exchange | Exchange/OTC | Mostly OTC |
| **Defining attrs** | share class | coupon, maturity, par | underlying, expiry, size | underlying, strike, expiry, call/put | two legs, notional, schedule |
| **Links to underlying?** | No | No | Yes | Yes | Yes |
| **Income** | dividends | coupons | none | none | net cash flows |
| **Standardised?** | Yes | Semi | Yes | Yes | Bespoke |

**Reading it as a designer:**
- The **derivatives** (future/option/swap) all need an underlying link; the **cash instruments** (equity/bond) don't.
- The **defining attributes are nearly disjoint** — this is the argument against one flat nullable table and for a typed model.
- **Venue** matters for how the instrument is identified and traded (exchange = standardised contract with a symbol; OTC = bespoke terms you store in full).

**Engineer angle:** this table is the skeleton of your security master. A shared instrument core plus type-specific attribute sets, with integrity rules per type (an option must have a strike; a bond must have a maturity). None of the columns here are prices or Greeks — those live on the quant/market-data side.

### Q7. Where do cash and FX fit as "instruments," and what's special about them?

**Cash** is the simplest instrument: a holding of money in a currency. But "simple" hides the trap — **cash is meaningless without its currency**. A cash position isn't "1,000"; it's "1,000 USD" or "1,000 JPY," which are completely different amounts of value. Money is always `(amount, currency, scale)`.

**FX (foreign exchange)** is trading one currency for another. An FX instrument is a **currency pair** like EUR/USD. A quote `EUR/USD = 1.10` means 1 EUR = 1.10 USD. FX spans spot (exchange now/T+2), forwards (agree a rate for a future date), and swaps.

What's special for an engineer:

- **Multi-currency is unavoidable.** The moment you hold cash in more than one currency, every balance, P&L, and NAV needs an FX rate to express it in a base currency — and each rate has a *direction, a timestamp, and a source* you must store.
- **Quote inversion is a classic silent bug.** Using EUR/USD when you needed USD/EUR flips a conversion; it's silent and off by roughly the square of the rate.
- **Trade currency vs settlement currency can differ** — a deal priced in one currency may settle in another.

**Engineer angle:** cash and FX force the money-handling discipline from **Treasury, Cash & FX**: exact decimals, currency always attached, per-currency minor units (USD 2dp, JPY 0dp), and FX rates stored with provenance. Never treat a cash amount as a bare number.

### Q8. How would you model instrument reference data given that a bond and an option share almost no attributes?

The tension: all instruments share a small common core (id, type, currency, issuer, name) but each type has a **disjoint set of type-specific attributes** (bonds: coupon/maturity/par; options: strike/expiry/call-put). Three standard approaches:

1. **Single-table inheritance** — one wide `instrument` table with a `type` discriminator and *all* possible columns, most nullable per row. Simple joins, but a swamp of nullables and no DB-level integrity (nothing stops an equity row having a strike).

2. **Class-table inheritance** — a shared `instrument` table plus one table per type (`bond_details`, `option_details`) joined by instrument id. Clean integrity and non-null constraints per type; more joins.

3. **Typed attribute / EAV model** — a shared core plus a key-value attributes table. Maximally flexible for exotic instruments; weak typing and awkward queries.

```sql
-- class-table inheritance sketch
-- instrument: shared core (canonical id, type, ccy, issuer)
-- bond_details(instrument_id PK/FK, coupon, freq, maturity, par)
-- option_details(instrument_id PK/FK, underlying_id, strike, expiry, call_put, style)
```

**My default:** class-table inheritance for the well-known types (you get real integrity — an option row *must* have a strike, a bond *must* have a maturity), with a typed-attribute escape hatch for genuinely exotic OTC instruments. The canonical instrument id is the foreign key everywhere; type-specific detail hangs off it.

**Engineer angle:** the design goal is *type-specific integrity* — invalid instruments (option with no strike) should be unrepresentable — while keeping a stable canonical id that trades and positions reference. Prices and Greeks are *not* in this model; they live in market data.

### Q9. A teammate wants one nullable-heavy `instruments` table for everything. What do you push back on?

I'd push back on **loss of integrity and the nullable swamp**, while acknowledging the pull toward simplicity.

**The problems with one flat table:**
- **No type-specific integrity.** Nothing at the DB level stops an equity row from carrying a strike, or a bond row from missing its maturity. Invalid instruments become representable, and bad data leaks into positions and pricing.
- **A wall of nullable columns.** With five-plus types each contributing disjoint attributes, most columns are null for most rows — confusing, error-prone, and hard to constrain.
- **Ambiguous meaning.** A null could mean "not applicable to this type" or "unknown/missing" — you can't tell them apart, which matters in a regulated, audited domain.

**What I'd propose instead:** a shared instrument core plus per-type detail tables (class-table inheritance), so each type carries *only* its attributes with proper `NOT NULL` constraints. If they want simpler reads, add a **view** that joins core + detail per type — you get ergonomic queries without sacrificing integrity.

**Where I'd concede:** for a small system with two similar instrument types, one table with a type discriminator is fine — don't over-engineer. And for truly unpredictable exotic OTC instruments, a typed-attribute escape hatch beats endless schema migrations. The judgement call is *how many types, how disjoint, how much integrity you need* — but "one nullable table for everything" as a blanket default trades away exactly the integrity this domain demands.

### Q10. Explain call vs put, and long vs short an option, without any pricing maths.

Two independent axes; keep them separate.

**Call vs put** — what right the option gives:
- A **call** is the right to **buy** the underlying at the strike.
- A **put** is the right to **sell** the underlying at the strike.

**Long vs short** — which side of the contract you're on:
- **Long an option** = you *bought* it; you *hold the right* and choose whether to exercise. Your downside is limited to what you paid.
- **Short an option** = you *sold/wrote* it; you took the premium and are *obligated* if the holder exercises.

So there are four combinations: long call, long put, short call, short put — each a different exposure. "Long a call" = you hold the right to buy. "Short a put" = you're obligated to buy if the holder exercises their right to sell.

**Engineer angle:** these are **two separate fields** in your model — `call_put` (a property of the *instrument*) and the sign/direction of your *position* (long/short, a property of your *holding*). Don't collapse them. The instrument is "an ACME call, strike 50, expiry Dec"; your position is "+10" (long) or "−10" (short) of that instrument. Conflating the option type with the position direction is a classic modelling error. Whether exercising is worthwhile — that's pricing, which is a quant concern.

### Q11. What does "the value of a derivative is derived from an underlying" mean for your foreign keys?

It means a derivative row is **incomplete without a link to its underlying**, so your schema needs that relationship as a first-class foreign key.

Consider a call option on ACME stock. The option's terms are strike, expiry, call/put — but none of those *identify what it's an option on*. Without a pointer to ACME, the row is meaningless. So:

```sql
-- option_details references BOTH the option instrument and its underlying
-- option_details(
--   instrument_id   FK -> instrument(id),   -- the option itself
--   underlying_id   FK -> instrument(id),   -- the ACME stock
--   strike, expiry, call_put, style )
```

The underlying might be another instrument (a stock, a bond) or a market reference (an index, an interest-rate benchmark) — so sometimes the FK points at another `instrument`, sometimes at a reference-data entity.

**Engineer angle:**
- **Derivatives form a graph, not a flat list.** An option on a future on an index is a chain of links. Model the edges explicitly.
- **Lifecycle events cascade.** If the underlying has a corporate action (a stock split), the derivative's terms may need adjusting — you can't process that correctly if you don't know the linkage. See **Equities & Corporate Actions**.
- The *valuation* that flows across that link (how the underlying's price drives the derivative's price) is the quant's pricing model; your job is to maintain the linkage so the quant's engine and your reports agree on *what's linked to what*.

### Q12. Why are the Greeks and option pricing explicitly not your problem as an engineer?

Because they belong to a **different discipline behind a clean interface**. The **Greeks** (delta, gamma, vega, theta, and friends) are sensitivities — how an option's price moves as the underlying, volatility, or time change. Computing them, and pricing the option in the first place, requires models (Black-Scholes and its many descendants), calibration, and quantitative expertise owned by **quants and the pricing desk**.

Your job stops at the interface:
- You **store the instrument's terms** correctly (strike, expiry, call/put, underlying).
- You **consume and persist the numbers** the pricing engine emits — price, delta, gamma — *with their provenance*: which model, which market snapshot, which timestamp.
- You **serve and aggregate** those numbers (sum deltas across a book, show them on a risk report).

You do **not** derive them.

**Engineer angle:** treat pricing outputs like any other data feed — with a source, a timestamp, and exactness requirements. Store them; don't recompute them. The failure mode is an engineer who, not understanding the boundary, either freezes ("I can't build the risk report because I don't know the maths") or over-reaches (reimplementing a pricing formula badly, creating a second, wrong source of truth). The right stance: *the desk owns the numbers; I own storing, moving, and displaying them exactly and auditably.* Same discipline as any other computed figure — record what value, from which source, at what time.

### Q13. Spot the domain bug: a system stores a swap's `notional` in the `market_value` column for P&L. What breaks?

**The bug:** notional and market value are *different quantities*, and using notional as market value overstates the position's worth by orders of magnitude.

Recall: **notional** is the reference principal the swap's cash flows are computed on (say $10m). **Market value** is what the swap is actually worth right now — its present value, which is near **zero** at inception and typically a small fraction of notional thereafter.

**What breaks:**
- **P&L is grossly wrong.** A swap worth ~$0 shows up as a $10m gain in the book's P&L. Every aggregation up to the portfolio and fund level is now inflated.
- **NAV is wrong.** Net asset value includes this fictitious $10m, misstating the fund to investors — a serious, potentially regulatory problem.
- **Risk reports mislead.** If risk *also* reads this column, exposure looks the same as value, hiding the real risk profile.
- **Reconciliation breaks** against any external source that has the correct market value.

**The fix:** notional and market value are **separate columns with separate meanings and sources**. Notional is a *static contractual term* stored on the instrument/deal; market value is a *time-varying mark* from the pricing/market-data side, stamped with source and timestamp. Never route one into the other.

**Engineer angle:** this is the instrument-level version of the "trade vs position" confusion — two distinct concepts sharing a column so the data lies. The false-friend (both are "big dollar numbers about the swap") is exactly what makes it a silent, dangerous bug.

### Q14. How do you store the "numbers a quant computes" (prices, Greeks) alongside instruments correctly?

Treat them as **time-varying, sourced market/analytics data — separate from the static instrument reference data — and never as authoritative facts you own**.

Principles:
- **Separate store, separate lifecycle.** Instrument *terms* (strike, coupon, maturity) are slow-changing reference data. Prices and Greeks are frequently-updated, high-volume, time-series values. Don't jam them into the instrument row; they have opposite update profiles (see **Market Structure & Data**).
- **Always stamp provenance.** Every price/Greek gets `source` (which pricing engine or vendor), `as_of` timestamp, and often `model/version`. The same option has different values from different models and snapshots — the number alone is meaningless.
- **Exact types.** Prices are money-adjacent — exact decimals, currency attached where applicable.
- **Bitemporal where it matters.** You often need "what price did we *use* for last Tuesday's NAV" (as-of), which differs from "the latest price now." Store valuation-date alongside knowledge-date.

```sql
-- instrument_valuation(
--   instrument_id, as_of_ts, source, model_version,
--   price NUMERIC, delta NUMERIC, gamma NUMERIC, ... )   -- time-series
```

**Engineer angle:** you're the *custodian* of these numbers, not their author. Store them with enough context that any figure on a report can be traced back to *which model, which market data, which moment* produced it — the lineage requirement the domain imposes. The quant owns the formula; you own that it's stored exactly, sourced, and reconstructable.

### Q15. Design the instrument side of a security master that must hold equities, bonds, and options.

Restating: a canonical store of instrument reference data spanning three types with disjoint attributes, keyed by a stable internal id, feeding trades/positions/pricing.

**Shape — shared core + per-type detail (class-table inheritance):**

```sql
-- instrument (shared core)
--   id            PK   -- internal CANONICAL id, the FK everywhere
--   type          -- EQUITY | BOND | OPTION
--   currency, issuer, name, status, effective dates

-- equity_details(instrument_id PK/FK, share_class, listing_exchange)
-- bond_details(instrument_id PK/FK, coupon, coupon_freq, day_count,
--              maturity, par)
-- option_details(instrument_id PK/FK, underlying_id FK -> instrument,
--              strike, expiry, call_put, exercise_style)

-- instrument_identifier (many external ids -> one canonical id)
--   instrument_id FK, id_type (ISIN|CUSIP|TICKER|FIGI), id_value,
--   effective_from, effective_to
```

**Key design points:**
- **One internal canonical id** is the foreign key across the firm; business data (trades, positions) never keys on a raw ticker.
- **A mapping table** relates the many external identifiers (ISIN, CUSIP, ticker, FIGI) to the canonical id — because no external id is universal and symbols get reused/renamed. Model it with **effective dates** (mappings change over time), not one static row.
- **Per-type integrity:** options require a strike/expiry/call-put; bonds require coupon/maturity/par. Enforce non-null per detail table.
- **Effective-dated / append-only core** so you can answer "what were this instrument's attributes as of date X" — corporate actions and reclassifications rewrite reference data over time.

**Engineer angle:** the security master is *reference data* — slow-changing, read-everywhere, hot — so it's a cache/CDC candidate, kept strictly separate from the high-volume market-data (price) store. No prices or Greeks live here.

### Q16. Warm-up: explain equity vs bond in one breath, then say what each means for your schema.

**Equity vs bond in one breath:** an **equity** makes you a part-**owner** of a company (you share in its upside via price appreciation and dividends, and rank last if it fails); a **bond** makes you a **lender** to an issuer (you get fixed coupons and your principal — par — back at maturity, and rank ahead of shareholders). Ownership vs loan.

**What each means for your schema:**

- **Equity:** minimal type-specific data — issuer, share class (common vs preferred, voting rights), listing exchange, currency. The complexity comes *later*, from **corporate actions** (splits, dividends, mergers) that rewrite the position and reference data over time — see **Equities & Corporate Actions**.

- **Bond:** far more structural data up front — coupon rate, coupon frequency, day-count convention, maturity date, par value, currency — because a bond is fundamentally a **schedule of cash flows** you must be able to reconstruct. And **par ≠ price**: par is a fixed contractual term; the traded price varies.

**Engineer angle:** even at the warm-up level, the point is that *different instruments force different schemas and different invariants*. An equity's model is thin but its lifecycle (corporate actions) is rich; a bond's model is rich up front (the cash-flow schedule) with a natural end date (maturity). Neither fits a one-size flat table cleanly, which is the whole argument for a typed security master. Pricing either one is a quant concern; you store ownership-vs-loan terms exactly.

## Equities & Corporate Actions

### Summary

**What this topic covers**

Equities are the instrument most engineers meet first — shares of stock, ownership in a company. This topic covers the equity slice in depth: **shares/stock**, **share classes**, **dividends**, and — the meat of it — **corporate actions**: splits, reverse splits, mergers, spin-offs, symbol changes, and the like. The organising insight for an engineer is that **corporate actions are DATA EVENTS that rewrite positions and reference data**. A stock split doesn't just "happen in the market"; it means every position in that stock must be adjusted (twice the shares at half the price), historical prices may need restating, and the security master's identifiers may change. The 16 questions cover what these events are, the critical **date model** (**ex-date, record-date, pay-date**), why corporate actions are a *notorious* source of position and security-master bugs, and — most importantly — the engineer's actual job: **apply them correctly and keep the history**, so that yesterday's numbers still reconcile and you can answer "what did I hold, and what was it worth, as of any past date." This is where the append-only, event-sourced, bitemporal instincts from earlier topics get their hardest real-world workout.

**Mental model**

Think of a corporate action as an **external event that mutates your reference data and rewrites your positions — and that you must apply without destroying history**. A share is a unit of ownership; a position is a count of shares folded from your trades. A corporate action changes the *rules* underneath that count: a 2-for-1 split says "every 1 share is now 2, each worth half." Naively you'd `UPDATE positions SET qty = qty * 2` — and instantly you've broken every historical report, because last week's position and prices are now inconsistent with today's basis. The correct model treats the corporate action as a **first-class, dated event** with an effective (ex-)date, applied as an **adjustment** that both transforms current holdings *and* preserves what was true before. Prices split into "as-reported" and "adjusted" series. Identifiers get effective-dated so a symbol change doesn't orphan history. The recurring tension is *keep current positions correct* **and** *keep the past reconstructable* — you cannot sacrifice either, which is exactly why naive mutation fails and event-sourced, bitemporal modelling wins. Corporate actions are the canonical case study for "never destroy history."

**Key terms**

- **Share / stock** — a unit of ownership in a company; a holding is a count of shares.
- **Share class** — different types of a company's shares (e.g. Class A vs Class B) with different voting rights or economics.
- **Dividend** — a cash (or stock) distribution to shareholders out of company profits.
- **Corporate action** — an event initiated by the issuer that changes its securities: split, dividend, merger, spin-off, symbol change, etc.
- **Stock split** — each share becomes N shares, price divided by N; total value unchanged.
- **Reverse split** — N shares become 1, price multiplied by N.
- **Merger** — two companies combine; holders' shares convert to the acquirer's (cash and/or stock).
- **Spin-off** — a company carves out a subsidiary; holders receive shares in the new entity.
- **Symbol change** — the ticker/identifier changes (rename, re-listing) though the underlying holding persists.
- **Ex-date (ex-dividend/ex-date)** — the date from which a buyer is *not* entitled to the action; the price adjusts on this date.
- **Record date** — the date on which you must be a holder of record to be entitled.
- **Pay date** — the date the cash/shares are actually distributed.

**Why interviewers ask this**

Corporate actions are where finance engineering gets *hard*, so they're a favourite senior-signal question. A junior treats a split as "multiply the quantity" and never thinks about the past. A senior immediately raises the hard parts: *which date governs the adjustment (ex-date), how do I keep historical positions and prices consistent, how do I not orphan trade history when a symbol changes, and how do I make the whole thing idempotent so a re-sent corporate-action feed doesn't double-adjust.* Interviewers ask because corporate actions expose whether you truly understand the domain's core discipline — **append-only, dated, reconstructable data** — or whether you'll reach for the destructive `UPDATE` that quietly corrupts the books. They're also just operationally notorious: a huge share of real position and security-master bugs trace to a mishandled corporate action, so any team running books-and-records cares deeply that you get them right.

**Common confusions**

- **"A split changes the value of my holding."** No — a 2-for-1 split doubles shares and halves price; total value is unchanged. It's a re-denomination, not a gain.
- **"Just multiply the quantity column."** That corrupts history and breaks every past report and reconciliation. Corporate actions must be applied as dated, reversible, history-preserving events.
- **"Ex-date, record date, and pay date are the same."** They're three distinct dates governing entitlement and when the price adjusts; conflating them mis-attributes dividends and positions.
- **"A symbol change is just renaming a string."** The ticker changing must not orphan trade/position history — the canonical id persists; the identifier is effective-dated.
- **"Adjusted prices are the real prices."** Both as-reported and adjusted series are needed; using the wrong one silently corrupts P&L and charts.
- **"Corporate actions are the issuer's problem, not mine."** They land as feeds you must ingest, validate, and apply correctly to positions and reference data — squarely your problem.

**What follows from this topic**

Corporate actions are the applied capstone of the primer's core discipline. They lean directly on the **event-sourcing / append-only** patterns (apply as dated events, never mutate), the **security master** design (effective-dated identifiers, canonical id persistence) from the instruments topic, and the **bitemporal / as-of** thinking behind **Positions, P&L & NAV**. A mishandled corporate action is a leading cause of the **reconciliation** breaks covered elsewhere — your position won't match the custodian's because one of you adjusted and the other didn't, or you adjusted differently. And the exactness discipline (dividends are money; split ratios need exact arithmetic) ties back to money handling. If you can model corporate actions correctly, you've demonstrated the whole domain's engineering ethos in one hard problem.

### Q1. Explain shares, stock, and share classes to an engineer.

**Shares / stock** — a **share** is a single unit of ownership in a company; **stock** is the collective term for shares. If a company has issued 1,000,000 shares and you hold 1,000, you own 0.1% of it. As a holder you get economic rights (a claim on profits via dividends and on the residual value) and often voting rights. To an engineer, a holding is simply a **count of shares** of a given instrument in a portfolio — a signed quantity, positive if long.

**Share classes** — a company can issue **multiple classes** of shares (commonly "Class A" and "Class B") that differ in **voting rights and/or economics**. A classic pattern: founders hold a class with extra votes, the public holds a class with one vote each; both may pay the same dividend, or they may differ.

**Engineer angle:** share classes are **distinct instruments** in your security master — different identifiers, potentially different prices, different rights — even though they belong to the same issuer. A common bug is treating "the company" as the instrument and losing the class distinction, so Class A and Class B positions get merged. Model the **issuer** and the **instrument (share class)** as separate entities: many share-class instruments roll up to one issuer. Voting rights and class economics are attributes on the instrument. A position is always in a *specific share class*, never in "the company" abstractly.

### Q2. What is a dividend, and what are the ex-date, record-date, and pay-date?

A **dividend** is a distribution — usually cash, sometimes additional stock — that a company pays its shareholders out of profits. If you hold 1,000 shares and the dividend is $0.50/share, you receive $500 (cash dividend).

The **three dates** govern *who gets it and when*:

- **Ex-date (ex-dividend date)** — the cutoff. If you **buy on or after** the ex-date, you are **not** entitled to this dividend; the seller keeps it. On the ex-date, the share **price drops** by roughly the dividend amount (the value leaves the company).
- **Record date** — the date on which you must be a **holder of record** on the company's books to be entitled. Set by settlement timing relative to the ex-date.
- **Pay date** — the date the cash (or stock) is **actually distributed** to entitled holders.

```text
buy before ex-date  --> entitled --> on record date you're a holder --> paid on pay date
buy on/after ex-date --> NOT entitled (price already dropped)
```

**Engineer angle:** these are three *different* dates and you must model all three. Entitlement is determined by the **ex-date/record-date** (based on when you held), but the **cash movement** happens on the **pay-date** — so your ledger accrues a receivable at ex-date and settles it at pay-date. Conflating them mis-attributes dividends (paying the wrong holder) and mis-times cash. And the ex-date price drop is *expected* — don't flag it as a P&L loss.

### Q3. What is a corporate action, and why is it fundamentally a data event for engineers?

A **corporate action** is an event **initiated by the issuer** that changes its securities or the holdings in them — a stock split, a dividend, a merger, a spin-off, a symbol change, a rights issue, and so on. The company does something; every holder's position and/or the instrument's reference data must change in response.

**Why it's fundamentally a data event for you:** a corporate action arrives as a **feed** (from a data vendor, exchange, or custodian) describing *what changed, to which instrument, effective when, and by what ratio/terms*. Your system must **ingest it, validate it, and apply it** — transforming positions and reference data — while **preserving history**. A 2-for-1 split is, to your system, an instruction: "for instrument X, effective ex-date D, multiply share quantities by 2 and divide the cost basis and price by 2."

```text
corporate action feed --> validate --> apply (adjust positions + reference data)
                                    --> keep pre-action history intact
```

**Engineer angle:** the mental frame is exactly the primer's core discipline: a corporate action is a **dated, external event** that you apply as an adjustment, *not* a spontaneous mutation you sneak into current rows. It touches two things at once — **positions** (your holdings) and **reference/security-master data** (identifiers, prices, even the instrument's existence, in a merger). Getting both right, idempotently and reversibly, is the job. This is why corporate actions are the hardest, most bug-prone corner of books-and-records.

### Q4. Walk through a 2-for-1 stock split as a data operation. What changes and what doesn't?

A **2-for-1 split**: every 1 share becomes 2, and the price halves. Crucially, **total value is unchanged** — it's a re-denomination, not a gain or loss. Holding 100 shares at $50 (= $5,000) becomes 200 shares at $25 (= $5,000).

**What changes:**
- **Position quantity** — multiplied by the split ratio (×2). 100 → 200 shares.
- **Cost basis per share** — divided by the ratio (÷2), so total cost is preserved. Avg cost $50 → $25.
- **Price series** — going forward the market price is the split-adjusted price; historical prices are typically kept in *two* forms (as-reported and split-adjusted) so charts and returns stay continuous.

**What does NOT change:**
- **Total market value** of the holding.
- **Total cost basis** (only per-share changes).
- **Your percentage ownership** of the company.
- **The instrument's identity / canonical id** (a plain split doesn't change the security itself, though the ticker can occasionally be affected).

```text
before: 100 sh @ avg cost 50, price 50  --> value 5,000
apply 2-for-1 (ratio 2)
after:  200 sh @ avg cost 25, price 25  --> value 5,000   (unchanged)
```

**Engineer angle:** apply the split as a **dated adjustment event** at the ex-date, using **exact arithmetic** (ratios can be non-integer, e.g. 3-for-2 → ×1.5 → fractional shares you must handle per policy). Never a blind `UPDATE qty = qty*2` that loses the pre-split truth. And a **reverse split** is the inverse: N shares → 1, price ×N (used to lift a low share price).

### Q5. Why is "just multiply the quantity column" the wrong way to apply a split?

Because it **destroys history and breaks everything that depends on the past** — which, in this domain, is a lot.

Concretely, `UPDATE positions SET qty = qty * 2 WHERE instrument = X` fails on every axis:

- **Historical reports become inconsistent.** Last week's position report said 100 shares; today's says 200 with no recorded reason. Anyone reconstructing "what did I hold on that date" gets a number that doesn't match the contemporaneous record.
- **Reconciliation breaks.** Your position now shows 200; a system (or a prior snapshot) that hasn't applied the split — or applied it differently — shows 100. Instant break.
- **P&L and returns corrupt.** If historical *prices* aren't adjusted consistently with the quantity, the return series shows a fake 50% drop on the split date.
- **No audit trail.** Regulators require you to reconstruct *what changed, when, and why*. A bare `UPDATE` records none of that.
- **Not idempotent.** If the corporate-action feed is re-sent (they are), you double-adjust to 400 shares.

**The right way:** record the corporate action as a **first-class, dated event** (instrument, type=split, ratio, ex-date, source), apply it as an **adjustment** that transforms the current position *while preserving the pre-action state*, keep both as-reported and adjusted price series, and make application **idempotent** on the action's business key. Then "as of last Tuesday" still returns 100 shares, today returns 200, and both are correct and reconcilable.

### Q6. What are ex-date, record-date, and pay-date, and which one governs when you adjust?

The three dates recur across dividends and other corporate actions, and they mean different things:

- **Ex-date** — the date **from which a new buyer is *not* entitled** to the action. This is the date the market **price adjusts** to reflect the action (e.g. drops by the dividend, or re-bases for a split). It's the pivot for *entitlement* and *price adjustment*.
- **Record date** — the date you must be a **holder of record** on the books to qualify. Driven by settlement timing relative to the ex-date.
- **Pay-date** — the date the **cash or shares are actually distributed/settled**.

**Which governs adjustment?** The **ex-date** governs when you **adjust the position and price basis** — that's when entitlement crystallises and the market re-prices. The **pay-date** governs when the **cash/shares actually move** in your ledger (for a dividend, you accrue a receivable at ex-date and settle it at pay-date; for a split, quantities re-denominate effective ex-date).

```text
ex-date:    entitlement fixed + price/position adjusts (basis change)
record date: who-qualifies snapshot (holder of record)
pay-date:   actual cash/share movement (ledger settlement)
```

**Engineer angle:** model all three explicitly; never collapse them into one "action date." Using pay-date where you needed ex-date (or vice versa) mis-times the adjustment, mis-attributes entitlement across a buy/sell straddling the ex-date, and produces breaks against the custodian, who *will* use the correct dates.

### Q7. How do you model a symbol change so you don't orphan trade and position history?

The key insight: a **symbol change is not a rename of a string** — the *identifier* changes but the *underlying security and your holding persist*. If you key anything on the ticker, you orphan all the history the moment the ticker changes.

**The correct model** (this is exactly why the security master exists):
- Business data — **trades, positions** — key on the **internal canonical instrument id**, which **does not change** across a symbol change.
- The **ticker/identifier** lives in an **effective-dated mapping table**: the old symbol is valid until the change date, the new symbol from the change date.

```sql
-- instrument_identifier
--   instrument_id   -- canonical id, STABLE across the symbol change
--   id_type         -- TICKER
--   id_value        -- 'OLD' then 'NEW'
--   effective_from, effective_to
-- OLD: effective_to = change_date
-- NEW: effective_from = change_date
```

So a trade booked last year under the old ticker still points at the same canonical id; a query "show all history for this security" joins through the canonical id and finds everything, regardless of which symbol was current at the time.

**Engineer angle:** this is the payoff of *never keying business data on a raw ticker*. Symbol changes (and reused/recycled tickers — an old symbol later assigned to a *different* company) are precisely why a security master with effective-dated identifiers is mandatory. Orphaned history from a naive ticker-keyed schema is one of the classic security-master bugs; the canonical-id + effective-dated-mapping pattern is the standard fix.

### Q8. Explain mergers and spin-offs as position-rewriting events.

Both are corporate actions that **restructure what you hold** — they rewrite positions and reference data, not just adjust a quantity.

**Merger** — two companies combine. Holders of the acquired company's shares have them **converted** into the acquirer's shares, cash, or a mix, per the deal terms (e.g. "1 ACME share → 0.5 BIGCO shares + $10 cash"). To your system:
- The acquired instrument may become **inactive/delisted**.
- Each holder's position in the old instrument is **replaced** by a new position in the acquirer (at the conversion ratio) plus any cash.
- History of the old holding must remain reconstructable.

**Spin-off** — a company carves out a subsidiary into a separate listed entity. Existing holders **receive shares in the new entity** while keeping their original shares, per a distribution ratio (e.g. "1 new SPINCO share per 4 ACME shares held"). To your system:
- A **new instrument** appears in the security master.
- Positions **gain** a holding in the new entity; the original position's cost basis is typically **split** between parent and spun-off entity.

**Engineer angle:** these are **multi-instrument, terms-driven transformations** — far richer than a split. Model them as **dated events with structured terms** (source instrument, target instrument(s), ratios, cash component), applied as adjustments that create/retire positions and instruments while preserving history. They touch the security master (new/retired instruments) *and* positions *and* cash — the hardest corporate actions to get right, and a top source of breaks when one system applies the terms differently from another.

### Q9. Why are corporate actions such a notorious source of position and security-master bugs?

Because they combine every hard property of the domain at once, and any single mistake corrupts the books:

- **They touch multiple systems simultaneously** — positions, cash/ledger, prices, *and* the security master (identifiers, instrument lifecycle). A split that's applied to positions but not to the price series produces a fake return; applied to prices but not positions, a fake value change.
- **They're date-sensitive.** The wrong date (pay-date instead of ex-date) mis-times the adjustment and mis-attributes entitlement across trades straddling the ex-date.
- **They must preserve history.** The naive `UPDATE` corrupts every past report and reconciliation — and the temptation to just mutate is strong.
- **Idempotency is easy to get wrong.** Feeds get re-sent; a non-idempotent apply double-adjusts (200 → 400 shares).
- **Terms are complex and varied.** Mergers and spin-offs carry ratios, cash components, and multi-instrument effects — lots of surface area for a mis-parse.
- **Two systems can adjust differently.** If you and the custodian apply slightly different ratios, rounding, or dates, positions diverge — a **reconciliation break** that's painful to diagnose.

**Engineer angle:** the fix is the whole primer in miniature — model corporate actions as **dated, idempotent, history-preserving events** with **exact arithmetic** and explicit **as-of** semantics, applied consistently across positions, prices, cash, and reference data. Corporate actions are notorious precisely because they punish every shortcut the domain warns against; do them right and you've demonstrated the discipline everywhere.

### Q10. What's the difference between as-reported and adjusted prices, and why keep both?

When a corporate action re-bases a stock (a split, or a dividend), you end up needing **two price series**:

- **As-reported (raw) prices** — the actual traded prices on each historical date, *as they were quoted at the time*. Pre-split, the stock really traded at $50.
- **Adjusted prices** — historical prices **restated** to be continuous with today's basis, so a split doesn't show up as a discontinuity. After a 2-for-1 split, the historical $50 is shown as $25 in the adjusted series.

**Why keep both:**
- **Adjusted prices** are what you need for **continuous return/performance calculations and charts** — otherwise the split date shows a fake 50% drop that isn't a real loss.
- **As-reported prices** are the **historical truth** — what actually traded, what a contemporaneous report showed, what regulators/auditors expect when reconstructing a past date. You cannot discard them.

```text
date        as-reported   adjusted (post 2-for-1)
pre-split   50.00         25.00
split date  25.00         25.00
```

**Engineer angle:** store **both series** (or store as-reported plus the adjustment factors needed to derive adjusted on demand). Using the wrong one silently corrupts results: as-reported in a return calc creates a phantom crash; adjusted where you needed the historical truth misstates what actually happened. The false-friend — "adjusted prices are the *real* prices" — causes real bugs. Both are real; they answer different questions.

### Q11. Design an idempotent corporate-actions processing pipeline.

Restating: ingest corporate-action feeds, validate, and apply them to positions/prices/reference data exactly once, preserving history. Sketch:

```text
CA feed (vendor/custodian)
   | 
[ingest]   -- dedupe on CA business key (source id + instrument + ex-date + type)
   v
[validate] -- known instrument? sane ratio/terms? dates present & ordered?
   v
[store]    -- append CA as an immutable, dated event (never mutate)
   v
[apply]    -- effective at ex-date: adjust positions, basis, prices,
   |          create/retire instruments (merger/spin-off), accrue cash
   v
[publish]  -- downstream: positions read model, ledger, reporting
```

**Key design points:**
- **Idempotency on a business key**, not a transport/message id. The same corporate action *will* be redelivered; a persisted seen-keys set makes re-application a **no-op**, so you never double-adjust.
- **Append-only event store.** The corporate action is a first-class immutable event; applying it *derives* new position/reference state without destroying the old — so as-of queries still work.
- **Ex-date drives application**; pay-date drives cash settlement. Model both.
- **Exact arithmetic** for ratios and cash; explicit rounding and fractional-share policy.
- **Validation gate** rejects malformed actions (unknown instrument, missing ex-date, nonsensical ratio) before they corrupt positions.
- **Reversibility.** If a corporate action is cancelled/amended (they are), you post a **compensating** event, never edit the original.

**Engineer angle:** this is event sourcing plus business-key idempotency plus bitemporal history — the domain's core patterns applied to its hardest workflow. The output feeds the same reconciliation that will catch any divergence from the custodian's application.

### Q12. A dividend was applied on the pay-date instead of the ex-date. What breaks?

**The bug:** entitlement and price adjustment are governed by the **ex-date**, but the code used the **pay-date** (typically days or weeks later) as the effective date. Several things break:

- **Wrong holders get the dividend.** Entitlement is fixed at the ex-date/record-date based on *who held then*. Using the pay-date, someone who **bought after the ex-date** (and is *not* entitled) can be credited, and someone who **sold after the ex-date** (but is entitled) can be missed. The dividend is mis-attributed.
- **Straddling trades are mishandled.** Anyone who traded between ex-date and pay-date is on the wrong side of the entitlement cutoff.
- **The price-adjustment timing is wrong.** The market drops the price on the ex-date; if your system expects the drop at pay-date, positions look mis-valued in the interim and you may flag a phantom P&L move.
- **Reconciliation breaks against the custodian**, who uses the correct ex-date/record-date — your entitlement and cash timing won't match theirs.

**The fix:** model **all three dates** and use each for its purpose — **ex-date** for entitlement and price/basis adjustment, **record-date** for the holder-of-record snapshot, **pay-date** only for the actual cash settlement (accrue a receivable at ex-date, settle it at pay-date).

**Engineer angle:** classic date false-friend. The dates *look* interchangeable and are all "about the dividend," so a careless model collapses them — and produces silent entitlement and reconciliation bugs that ops then has to untangle trade-by-trade.

### Q13. How do corporate actions on an underlying affect derivatives, and why must your model know the linkage?

A corporate action on a stock doesn't only affect holders of the stock — it affects **derivatives on that stock**, because their terms reference the underlying. A 2-for-1 split on ACME means an ACME option's **strike and contract size get adjusted** so the option's economics are preserved (e.g. strike halves, contracts double). A merger where ACME becomes BIGCO means ACME options must be **re-referenced** to the new deliverable per the adjustment terms.

**Why your model must know the linkage:** if the derivative's row doesn't point at its underlying (the FK from **Financial Instruments & Asset Classes**), you **can't propagate the corporate action** to it. The split adjusts the stock, but the option — with no recorded connection — keeps its old strike and is now economically wrong. That's a silent, serious bug: mispriced, mis-hedged, and out of line with the exchange's official contract adjustment.

```text
ACME 2-for-1 split (ex-date D)
  --> ACME stock positions: qty x2, basis /2
  --> ACME options: strike adjusted, contract size adjusted  (via underlying link)
```

**Engineer angle:** this is why derivatives must carry an explicit **underlying foreign key**, and why corporate-action processing must **walk the instrument graph** — apply the action to the underlying *and* cascade the mandated adjustments to linked derivatives. The exchange publishes the official contract-adjustment terms; you apply them, you don't invent the maths. But you can only apply them to instruments your model knows are linked.

### Q14. What is the engineer's actual job when it comes to corporate actions?

Stripped to essentials, the job is: **apply corporate actions correctly and keep the history** — and everything else follows from those two obligations.

**Apply them correctly means:**
- **Ingest and validate** the corporate-action feed (right instrument, sane terms, dates present and ordered).
- **Apply the mandated transformation** — the split ratio, the merger conversion, the spin-off distribution — with **exact arithmetic** and the right **effective date (ex-date)**, to **positions, cost basis, prices, cash, reference data, and linked derivatives**.
- **Idempotently**, so a re-sent feed doesn't double-apply.

**Keep the history means:**
- **Never destroy the pre-action state.** Apply as a dated, append-only event so "as of any past date" still returns the contemporaneous truth.
- **Preserve both as-reported and adjusted prices.**
- **Keep identifiers effective-dated** so symbol changes don't orphan history.
- **Handle amendments/cancellations** as compensating events, never edits.

**What is *not* your job:** deciding the *economics* of the action (the issuer sets the ratio/terms) or *pricing* the adjusted instruments (quant/market-data). You **apply** the issuer's terms and **preserve** the record.

**Engineer angle:** corporate actions are the domain's discipline made concrete — dated events, exact arithmetic, idempotency, append-only history, effective-dated reference data, and reconciliation against the custodian who applied the same action. Do those, and your books stay correct *and* reconstructable through the messiest events a security throws at them.

### Q15. Design a position store that stays correct across corporate actions and supports as-of queries.

Restating: positions must reflect today's reality *and* let you ask "what did I hold, on what basis, as of date X" — through splits, symbol changes, mergers. The answer is an **event-sourced, bitemporal** model.

```text
event log (append-only, immutable):
  trades              (buy/sell events)
  corporate_actions   (split/merger/spin-off/dividend, dated by ex-date)

position = fold(trades + corporate_actions) for (instrument, portfolio)

as-of query: replay events up to date X --> position as it stood then
```

**Key design points:**
- **Two event types fold into position:** trades change quantity; corporate actions transform quantity/basis/identity. Both are **immutable, dated events** in one ordered log per `(portfolio, instrument-lineage)`.
- **Fold, don't mutate.** Current position is the fold of all events up to now; an as-of position is the fold up to date X. No destructive `UPDATE` anywhere.
- **Instrument lineage via canonical id.** Because business data keys on the stable canonical id (not the ticker), a symbol change or split keeps the position's identity continuous; a merger links old→new instruments so lineage is traceable.
- **Snapshots to bound replay.** Periodic position snapshots + delta replay = `O(delta)`, not `O(full history)`.
- **Bitemporal where needed.** Distinguish *valuation date* (as-of the world) from *knowledge date* (when you learned it) so a late-arriving or amended corporate action is handled without rewriting the past.
- **Exact arithmetic** for basis and split ratios; both as-reported and adjusted price linkage for valuation.

**Engineer angle:** this is the primer's spine — trade-as-event, position-as-fold, append-only, as-of — extended to absorb corporate actions as just another kind of event. Correct today, reconstructable for any past date, and reconcilable against the custodian through every corporate action.

### Q16. Warm-up: why is a stock split *not* a gain, and what's the one-line engineering takeaway?

**Why it's not a gain:** a stock split is a **re-denomination**, not value creation. A 2-for-1 split gives you twice as many shares each worth half as much — 100 shares at $50 becomes 200 shares at $25, and $5,000 is still $5,000. Your percentage ownership of the company is unchanged; you're no richer. (A reverse split is the same in reverse: fewer shares, proportionally higher price, same total.) Companies split to adjust the *nominal* share price — a low price for accessibility, a reverse split to lift a price off the floor — not to hand shareholders money.

**The one-line engineering takeaway:** **apply the split as a dated, history-preserving adjustment — never a bare `UPDATE qty = qty * 2` — so total value stays constant, past reports still reconcile, and you can still answer "what did I hold as of any past date."**

**Engineer angle:** the warm-up smuggles in the whole discipline. If a split isn't a gain, then total market value and total cost basis must be *invariant* across the adjustment — a correctness check your code should assert. And if history must survive, the corporate action has to be a first-class dated event folded into positions, not a mutation. Get this smallest corporate action right — invariant value, preserved history, exact arithmetic, idempotent apply — and the same pattern scales to the merger and spin-off monsters.
## Fixed Income & Money Markets

### Summary

**What this topic covers**

Bonds and the short-term funding markets, from an engineer's seat rather than a trader's. A bond is a loan to an issuer: you lend the **face/par** amount, collect periodic **coupons**, and get par back at **maturity**. That single sentence hides the three things that make fixed-income systems bug-prone: **price and yield move inversely**, **interest accrues continuously between coupon dates**, and **the number of days between two dates depends on a convention you have to look up, not compute naively**. This topic has 16 questions. They cover the bond data model (issuer, coupon, par, maturity, frequency), the price-vs-yield relationship (conceptually — no curve maths, that's the quant desk), **accrued interest** and **clean vs dirty price**, **day-count conventions** (30/360, ACT/360, ACT/ACT) and why they cause off-by-a-day money errors, the **money markets** (T-bills, commercial paper, deposits) and **repo**, and the settlement/accrual **events** an engineer actually stores and schedules. The recurring lesson: a bond position is not one row — it is a stream of scheduled cash-flow events, and most fixed-income bugs are date bugs or precision bugs.

**Mental model**

Think of a bond as a **schedule generator**, not a static instrument. Given issue date, maturity, coupon rate, and payment frequency, you can generate every future cash flow: coupon on each payment date, plus par at maturity. Your system stores the *terms* (reference data) and *derives* the schedule; it does not hand-key each coupon. Between two coupon dates the bondholder is continuously *earning* interest they haven't been paid yet — **accrued interest** — so when a bond changes hands mid-period the buyer pays the seller for the accrued portion. That is why quoted price (**clean**) and settlement amount (**dirty** = clean + accrued) differ. Every accrual and every day-count is a **date-arithmetic** problem, and dates in finance are hostile: business-day calendars, holiday centres, month-end rules, and multiple day-count conventions that each answer "how many days is a year" differently. Treat the schedule as derived-and-replayable, treat money as exact decimal, and treat every date calc as convention-driven — never `(end - start).days / 365`.

**Key terms**

- **Coupon** — the periodic interest a bond pays, quoted as an annual rate on par (a 5% coupon on 1,000 par pays 50/yr).
- **Par / face value** — the amount repaid at maturity and the base the coupon is calculated on; not the market price.
- **Maturity** — the date the issuer repays par and the bond ceases to exist.
- **Yield** — the return implied by the current price; moves **inversely** to price.
- **Clean price** — quoted price excluding accrued interest.
- **Dirty price** — clean price **plus accrued interest**; what actually settles.
- **Accrued interest** — coupon earned but not yet paid, from last coupon date to settlement.
- **Day-count convention** — the rule for counting days in a period (30/360, ACT/360, ACT/ACT); determines accrual and coupon amounts.
- **Issuer** — the borrower (government, corporate, agency) whose credit you hold.
- **Money market** — the market for short-dated (< 1yr) instruments: T-bills, commercial paper, CDs, deposits.
- **Repo** — a repurchase agreement: sell a security now, buy it back later at a set price; economically a collateralised loan.
- **Discount instrument** — issued below par, redeemed at par, no coupon (e.g. T-bill); the "interest" is the price gap.

**Why interviewers ask this**

Fixed income is where domain fluency separates a junior from a senior in fintech/banking eng. A junior models a bond as a price and a quantity and calls it done. A senior knows the position is a **cash-flow schedule with accrual**, knows that **clean vs dirty** is a settlement-amount trap, and — the big one — knows that **day-count conventions and business-day calendars are the classic source of silent money bugs**. Interviewers probe this because a wrong day-count or a naive `date + 2 days` doesn't crash — it quietly pays the wrong amount, and you find out at reconciliation weeks later. Being able to say "which day-count convention?" and "is that a business-day calendar?" unprompted is a strong senior signal. It also tests whether you reach for exact-decimal money and derived-schedule modelling instead of floats and hand-keyed rows.

**Common confusions**

- **Par vs market price** — par is fixed (what's repaid); price floats with yield. They coincide only when the bond trades "at par".
- **Coupon rate vs yield** — coupon is fixed at issue on par; yield reflects current price. A 5% coupon bond can yield 6%.
- **Clean vs dirty price** — the screen shows clean; the buyer pays dirty (clean + accrued). Settling on the clean price underpays the seller.
- **"A bond is one holding"** — it's a stream of scheduled cash-flow events; model the schedule, not a single amount.
- **Day-count is just `days/365`** — no. 30/360 pretends every month has 30 days; ACT/360 counts real days over a 360 base. Wrong convention = wrong accrual.
- **Repo is a trade** — economically it's a secured loan; the security is collateral, not a change of long-term ownership.

**What follows from this topic**

Fixed income leans hard on the invariants introduced elsewhere in this primer: a trade is an immutable event, a **position is a derived fold** (here, over cash-flow and trade events), and money must be **exact decimal with a currency** (see the FX & multi-currency topic). The schedule-generation and accrual-event model is a natural event-sourcing problem — coupons are scheduled events your system materialises and later reconciles against the custodian. Day-count and settlement-date logic connects to the **trade lifecycle** (T+1/T+2, business-day calendars) and to **reconciliation** (accrual breaks are common). Repo and money markets connect to the **treasury/cash** topic. Get the "store terms, derive schedule, exact money, convention-driven dates" discipline here and the derivatives and FX topics inherit it directly.

### Q1. Explain what a bond is to an engineer building the system that holds it.

A bond is a loan to an issuer with fixed terms. You lend the **par** (face) amount, receive periodic **coupons** (interest), and get par back at **maturity**. The issuer is the borrower whose credit you're exposed to.

For the system, the important reframe is: a bond is not a static holding, it's a **cash-flow schedule generator**. From five terms — issuer, par, coupon rate, payment frequency, maturity — you can derive every future payment: a coupon on each payment date and par at maturity.

So your reference data stores the *terms*, and your system *derives* the schedule of dated cash-flow events. You don't hand-key each coupon. The engineer's job is generating that schedule correctly (dates, day-counts) and reconciling the actual payments against it.

### Q2. Coupon, par, maturity, issuer, price — define each and say which are fixed.

| Term | What | Fixed at issue? |
|---|---|---|
| `Issuer` | The borrower whose credit you hold | Yes |
| `Par / face` | Amount repaid at maturity; coupon base | Yes |
| `Coupon` | Periodic interest rate on par | Yes (for fixed-rate) |
| `Maturity` | Date par is repaid | Yes |
| `Price` | What it trades at today | No — floats |
| `Yield` | Return implied by price | No — floats |

The trap: **par and coupon are fixed; price and yield float.** A 1,000-par bond with a 5% coupon always pays 50/yr and repays 1,000 — regardless of whether it's trading at 980 or 1,020 today. Engineers who store "price" as if it were the instrument's defining attribute get this wrong; price is market data (a time series), the terms are reference data.

### Q3. Why do bond price and yield move inversely?

Conceptually: a bond's future cash flows are fixed (coupons + par). **Yield** is just the return those fixed cash flows represent given what you pay today. If the price you pay goes **down**, the same fixed cash flows represent a **higher** return — yield up. If price goes up, yield down. They're two ways of quoting the same thing.

No maths needed for the engineering angle — the point is that **price and yield are inverse views of one instrument**, so your system should store one authoritative number (usually price, as market data) and treat yield as derived, or vice versa. Storing both as independent editable fields invites them to disagree.

The pricing/curve maths that turns a yield into a price is the quant desk's concern, not yours. You store and serve the numbers.

### Q4. What is accrued interest and why does it matter for settlement?

Between coupon dates the bondholder is continuously *earning* coupon they haven't been paid yet. That earned-but-unpaid amount is **accrued interest**.

It matters because when a bond is sold mid-period, the seller has earned part of the upcoming coupon but the buyer will receive the whole coupon on the next payment date. To make it fair, the **buyer pays the seller the accrued portion at settlement**.

So the amount that actually moves is not the quoted price. It's:

```
settlement amount = clean price + accrued interest   (= dirty price)
```

For the engineer: accrued interest is a **date-arithmetic + day-count** calculation done at settlement, in exact decimal. It's a classic reconciliation break source — if your accrual uses a different day-count than the custodian's, the settlement amounts disagree by a small, silent amount.

### Q5. Clean price vs dirty price — what's the difference and which settles?

- **Clean price** — the quoted price you see on screen, *excluding* accrued interest.
- **Dirty price** — clean price **plus accrued interest**; this is what actually settles.

The screen and most analytics show clean because it's the price stripped of the "time since last coupon" noise, so it moves more smoothly. But the cash that changes hands is dirty.

```
dirty = clean + accrued_interest
```

Engineer angle: store the clean price as the market/quoted number, compute accrued from the schedule and day-count at settlement, and settle on dirty. The bug is settling on the clean price (underpaying the seller by the accrued amount) or double-counting accrued. Keep clean, accrued, and dirty as distinct, auditable fields — don't collapse them.

### Q6. What are day-count conventions and why are they a classic source of bugs?

A **day-count convention** is the rule for answering "how many days of interest is this period, and what's a year?" Different markets use different rules:

| Convention | Day count | Year basis | Typical use |
|---|---|---|---|
| `30/360` | Every month = 30 days | 360 | Many corporate bonds |
| `ACT/360` | Actual days | 360 | Money markets, many floating |
| `ACT/365` | Actual days | 365 | Some govvt/GBP |
| `ACT/ACT` | Actual days | Actual days in year | Many govt bonds |

They're a bug factory because:
- They **don't crash** — a wrong convention just computes a slightly wrong accrual, so you pay the wrong amount silently.
- `30/360` deliberately *lies* about the calendar (Feb 28 → 30), so you cannot use ordinary date subtraction.
- The right convention is a **property of the instrument**, so it must live in reference data and be threaded into every accrual calc.

Rule: never hardcode `days/365`. Store the instrument's convention and use a library that implements it exactly, in exact decimal.

### Q7. Walk through the accrued-interest data flow for a bond trade.

```
Reference data:  bond terms (coupon, par, freq, day_count, maturity)
       │
       ▼
Schedule:  derive coupon dates + amounts (coupon events)
       │
       ▼
On a trade at settlement date S:
   last_coupon = latest coupon date <= S
   days = day_count_convention(last_coupon, S)
   accrued = par * coupon_rate * (days / year_basis)   // exact decimal
       │
       ▼
Settlement amount = clean_price_amount + accrued
```

The engineer's responsibilities: derive the coupon schedule from terms (don't hand-key), pick the day-count from the instrument's reference data (don't assume), do the arithmetic in exact decimal with an explicit rounding rule, and persist accrued as its own field for audit and reconciliation. Later, when the actual coupon pays, reconcile it against the scheduled event.

### Q8. How would you model a bond and its cash flows in a schema?

Terms as reference data, cash flows as a derived, dated schedule:

```sql
-- reference data (slow-changing)
CREATE TABLE bond (
  instrument_id   BIGINT PRIMARY KEY,   -- canonical id from security master
  issuer_id       BIGINT NOT NULL,
  par             NUMERIC(20,6) NOT NULL,
  currency        CHAR(3)       NOT NULL,
  coupon_rate     NUMERIC(12,8) NOT NULL,   -- e.g. 0.05000000
  frequency       SMALLINT      NOT NULL,   -- coupons/yr
  day_count       TEXT          NOT NULL,   -- '30/360','ACT/360',...
  issue_date      DATE          NOT NULL,
  maturity_date   DATE          NOT NULL
);

-- derived schedule of dated cash-flow events
CREATE TABLE bond_cashflow (
  instrument_id   BIGINT NOT NULL REFERENCES bond,
  pay_date        DATE   NOT NULL,
  kind            TEXT   NOT NULL,          -- 'COUPON' | 'REDEMPTION'
  amount          NUMERIC(20,6) NOT NULL,
  currency        CHAR(3) NOT NULL,
  PRIMARY KEY (instrument_id, pay_date, kind)
);
```

Money is `NUMERIC`, never float; currency lives beside every amount; `day_count` is stored, not assumed. The cash-flow table is regenerable from terms — treat it as a materialised view you can rebuild, and reconcile actual payments against it.

### Q9. What are money markets and how do they differ from bond markets?

**Money markets** are where short-dated instruments (maturity under ~1 year) trade: Treasury bills, commercial paper, certificates of deposit, and interbank deposits. Bond ("capital") markets are longer-dated.

Two engineering-relevant differences:
- Many money-market instruments are **discount instruments** — issued below par, redeemed at par, **no coupon**. The "interest" is the price gap, so there's no coupon schedule, just an issue amount and a redemption.
- They commonly use **ACT/360** day-count, another convention to get right.

For treasury and cash-management systems, money markets are where short-term funding and liquidity are managed (see the Treasury/cash material), so the data leans toward maturities, rollovers, and rates rather than long coupon schedules.

### Q10. Explain repo to an engineer. Is it a trade or a loan?

A **repo** (repurchase agreement) is: sell a security now for cash, with a commitment to buy it back later at a slightly higher agreed price. Economically it's a **collateralised loan** — you're borrowing cash and posting the security as collateral; the price difference is the interest.

So although it *looks* like two trades (a sale and a repurchase), you should model it as **one financing arrangement with two legs and a rate**, not as an outright change of long-term ownership. The security is collateral: it moves, but the economic risk often stays with the borrower.

Engineer angle: track the two legs (near and far), the repo rate, the collateral instrument and haircut, and the open/closed state. Getting this wrong — booking it as an outright sale — corrupts the position because you'd show the collateral as gone when economically it isn't.

### Q11. Why can't you compute a coupon date as `last_date + 6 months`?

Because "the same day six months on" is ambiguous and calendar-hostile:
- **Month-end roll**: a bond paying on the 31st has no 31st in some months; conventions define whether it rolls to month-end, forward, or back.
- **Business-day adjustment**: if the computed date lands on a weekend or holiday, it shifts per a convention (Following, Modified Following, Preceding) using a **holiday calendar** for the relevant centre.
- **Leap years / actual days** interact with the day-count.

So a naive `date + 6 months` produces payment dates that disagree with the market's, which then produce wrong accruals and settlement amounts — and, at reconciliation, breaks. Use a proper schedule generator that takes the roll convention, business-day convention, and holiday calendar as inputs. Dates in finance are convention-driven, not arithmetic.

### Q12. Where do precision bugs creep into fixed-income calculations?

Three places, all silent:
1. **Float money.** Binary floating point can't represent 0.10 exactly, and accrual multiplies rate × par × day-fraction repeatedly. Errors compound and break reconciliation. Use exact decimal (`BigDecimal` / `decimal`) or integer minor units.
2. **Day-fraction rounding.** `days / basis` and the accrual product need an **explicit rounding rule and scale** (e.g. HALF_EVEN to the currency's minor unit). Relying on a language default gives you a different answer than the counterparty.
3. **Currency minor units.** Rounding to 2 dp is wrong for JPY (0 dp) and for instruments quoted in pence vs pounds. Round to the currency's ISO 4217 exponent, never a hardcoded 2.

The theme: fixed income is arithmetic on money and dates, and both have exact, convention-defined answers. Floats and default rounding turn "exact" into "approximately, and differently from everyone else."

### Q13. How do you reconcile a bond coupon payment against your system?

You have a **scheduled** coupon (derived from terms) and an **actual** payment (from the custodian feed). Reconciliation matches them:

```
scheduled cashflow (instrument, pay_date, amount, ccy)
      vs
custodian payment  (instrument, value_date, amount, ccy)
      │  match on instrument + date (± tolerance)
      ▼
matched            → mark coupon received
break: amount      → often a day-count / accrual mismatch
break: date        → business-day-calendar mismatch
break: missing     → payment failed or not yet received
```

The common breaks are exactly the domain traps: a small amount break usually means your **day-count convention** differs from theirs; a date break usually means a **holiday-calendar** difference. So bond recon is a join-and-diff on imperfect data (see the reconciliation material), and the breaks are diagnostic — they point straight at which convention was wrong.

### Q14. A bond's coupon is 5%, it's trading at 98, and yields 5.4%. Reconcile those numbers conceptually.

They're consistent, and confusing them is a classic junior error:
- **5% coupon** — fixed at issue, on par. A 1,000-par bond pays 50/yr, always, regardless of price.
- **Trading at 98** — the market price is 98% of par (980 on 1,000 par). Below par.
- **5.4% yield** — because you pay only 980 for cash flows sized on 1,000 par, the return is higher than the 5% coupon.

So: price below par → yield above coupon. Price above par → yield below coupon. Price equals par → yield equals coupon.

Engineer angle: store one authoritative price (market data), treat yield as derived, and never let a user edit coupon, price, and yield as three independent fields — they'd drift out of the relationship and your data would lie.

### Q15. What's the difference between a bond's trade date, settlement date, and value date, and why store all three?

- **Trade date** — when the deal was agreed (the economic event; the trade is immutable as of here).
- **Settlement date** — when cash and the security actually change hands (T+1/T+2, business days).
- **Value date** — the date from which interest/cash is considered effective for accrual and balances.

Store all three because they answer different questions: trade date drives position and PnL "as-of" logic, settlement date drives when the custodian expects movement (and thus fails), and value date drives accrual. Collapsing them into one "date" column is a frequent bug — your accrued interest, your settled-position, and your traded-position all key off different dates. This is bitemporal-ish reality: what you traded vs when it's effective vs when it settles.

### Q16. Design a service that generates and maintains bond cash-flow schedules.

Restate: given bond terms, produce every future dated cash flow, keep it correct through corporate actions, and let downstream systems query "what's due and when."

Data model: terms in reference data (with `day_count`, `frequency`, roll + business-day conventions, holiday-centre); the schedule as a derived, regenerable table of dated events.

Generation:
- Pure function `terms → [cashflow events]` using a real schedule generator (roll convention, business-day adjustment, holiday calendar).
- Money in exact decimal with explicit rounding to the currency's minor unit.
- Regeneration is idempotent and keyed on `(instrument_id, pay_date, kind)` so re-running never duplicates.

Change handling: corrections and corporate actions (call, partial redemption, coupon change) are **new events / new versions**, not in-place mutation — keep the old schedule for audit (append-only, lineage). Downstream, coupon events feed accrual and expected-cash; actuals reconcile against them, and breaks flag convention mismatches.

Tradeoffs to flag: the schedule is derived, so treat terms as the source of truth and the schedule as a rebuildable read model; store the convention and calendar version used, so an as-of regeneration reproduces exactly what you computed at the time.

## Derivatives: Futures, Options & Swaps

### Summary

**What this topic covers**

Derivatives — instruments whose value is *derived* from an underlying (a stock, rate, index, currency, commodity) — from the data-modelling seat, with **zero pricing maths**. This topic has 16 questions covering the three families an engineer meets constantly: **futures/forwards** (an agreement to trade something later at a set price, with **daily margin** and **mark-to-market**), **options** (the *right, not the obligation* to buy (**call**) or sell (**put**) at a **strike** by an **expiry** — modelled as data), and **swaps** (an exchange of cash-flow streams, e.g. **fixed-for-floating**, with schedules and periodic **resets**). The through-line is what the *system* must track: contract terms, **legs**, cash-flow **schedules**, resets, **margin/collateral**, and clearing state. Two confusions get their own attention because they cause real bugs: **notional vs market value** (a large-notional swap can be worth near zero) and the idea that the **Greeks** are something you compute — they're numbers a pricing engine hands you and your system stores and serves. Derivatives are where "model the contract and its cash-flow schedule, not a single price" matters most.

**Mental model**

Stop thinking "an instrument with a price" and start thinking **"a contract with terms, legs, and a schedule of future cash flows and events."** A future is a promise to exchange at a date, revalued and cash-settled *every day* via margin — so it generates a daily mark-to-market event, not a one-off. An option is asymmetric: the holder chooses whether to exercise, so your data must capture right-vs-obligation, call-vs-put, strike, expiry, and exercise style — the *terms*, not a valuation. A swap is two **legs** (e.g. pay-fixed, receive-floating), each a schedule of periodic payments; the floating leg's rate **resets** each period against a reference. So the engineer's model is: contract → legs → schedules → scheduled cash-flow and reset events → daily margin/valuation events. Valuation numbers (present value, the Greeks) arrive *from a pricing engine*; you store them with their source and timestamp. Your invariants are the same as everywhere else: the trade is an immutable event, the position/exposure is derived, money is exact decimal with a currency, and margin movements are cash events you must reconcile.

**Key terms**

- **Derivative** — an instrument whose value derives from an underlying; futures, options, swaps qualify.
- **Underlying** — the thing the derivative references (stock, index, rate, FX, commodity).
- **Future / forward** — agreement to buy/sell later at a set price; future = exchange-traded & standardised, forward = OTC & bespoke.
- **Margin** — collateral posted to cover potential loss; **initial** at open, **variation** daily as the mark moves.
- **Mark-to-market** — revaluing the contract at the current price; for futures, settled in cash daily.
- **Option** — the right, not the obligation, to buy (**call**) or sell (**put**) at a strike.
- **Strike** — the agreed price in an option contract.
- **Expiry** — the date the option's right ends.
- **Exercise style** — American (any time to expiry) vs European (at expiry only).
- **Swap** — exchange of two cash-flow streams (e.g. fixed-for-floating).
- **Leg** — one side of a swap/multi-leg trade (the pay leg, the receive leg).
- **Notional** — the face amount cash flows are calculated on; **not** what the contract is worth.
- **Reset** — periodically fixing a floating leg's rate against a reference for the next period.
- **Greeks** — price sensitivities (delta, gamma, ...) produced by a pricing engine; to you, numbers to store.

**Why interviewers ask this**

Derivatives are the fastest domain-fluency filter in a finance eng interview. A junior treats a future or option like a stock — one instrument, one price, one quantity. A senior knows a derivative is a **contract with legs, schedules, resets, and daily margin**, and can say what fields the system must persist without ever touching a pricing formula. The single most revealing probe is **notional vs market value**: candidates who think a $100m-notional swap is "worth $100m" don't understand derivatives, and they'll build schemas that reuse one column for both and mislead risk and PnL. Interviewers also check that you know the Greeks and present values are **inputs from a pricing engine**, not something your booking system computes — mistaking that boundary means you'd build the wrong service. Fluency here signals you can model the most schema-hostile instruments in finance correctly.

**Common confusions**

- **Notional vs market value** — notional is the face amount cash flows are sized on; market value is what the contract is currently worth. A big-notional swap can be worth ~0.
- **Future vs forward** — same idea (trade later at a set price), but future = exchange-traded, standardised, daily-margined; forward = OTC, bespoke, settled at the end.
- **Option = obligation** — no. The *holder* has a right; only the *writer* has an obligation. Model the asymmetry.
- **"Greeks are computed by my system"** — they come from a pricing engine; you store and serve them.
- **A swap is one cash flow** — it's two legs, each a schedule; the floating leg **resets** each period.
- **Margin = the trade price** — margin is collateral posted against potential loss, moved daily; it's separate cash movement to track and reconcile.

**What follows from this topic**

Derivatives compound every invariant in this primer. The **leg/schedule** model is the fixed-income cash-flow schedule generalised to two-sided contracts, so it inherits the day-count, business-day-calendar, and exact-money discipline from the Fixed Income topic. Daily **margin** movements are cash events that feed the Treasury/collateral and reconciliation material — margin breaks are common. **Notional vs market value** is the same "store both, never reuse one column" lesson the false-friends material stresses. And the pricing-engine boundary (Greeks and PV are inputs you store with source + timestamp) is the accept-and-reconcile, store-the-source pattern applied to valuations. If you can model a swap's two legs and resets, and a future's daily margin, as scheduled events over an immutable trade, the rest of the derivatives universe is variations on that theme.

### Q1. What is a derivative, and why does that change how you model it?

A **derivative** is an instrument whose value is *derived* from an **underlying** — a stock, index, interest rate, currency, or commodity. Futures, options, and swaps are the common families.

It changes the model because a derivative isn't "a thing you own outright with a price" — it's a **contract with terms and future obligations**. So instead of `(instrument_id, quantity, price)`, you store the contract: the underlying it references, the terms (strike/expiry/fixed rate/notional), the **legs**, and the **schedule** of future cash flows and events.

Practically: a derivative row points at an underlying, carries contract terms, and spawns scheduled events (payments, resets, daily margin). Valuation — present value, sensitivities — comes from a **pricing engine**; your booking system stores those numbers, it doesn't derive them.

### Q2. Explain a future to an engineer. What events does it generate?

A **future** is a standardised, exchange-traded agreement to buy or sell an underlying at a set price on a future date. Because it's exchange-traded, it's **margined and marked-to-market daily**: rather than waiting until the end, the exchange revalues your position every day and moves cash (**variation margin**) to reflect the gain or loss.

So a single future generates a **stream of daily events**, not one settlement:

```
open  → post initial margin
each day → mark-to-market → variation margin cash movement (in or out)
close/expiry → final settlement, release margin
```

Engineer angle: you must track the contract terms, the daily marks (with price source + timestamp), and the resulting margin cash movements — which are real cash you reconcile against the clearing broker. Modelling a future as a static holding misses the daily margin flow entirely.

### Q3. Future vs forward — what's the difference and does it matter to the system?

| | Future | Forward |
|---|---|---|
| Venue | Exchange-traded | OTC (bilateral) |
| Terms | Standardised | Bespoke |
| Margin | Daily variation margin | Usually settled at end |
| Clearing | Central counterparty (CCP) | Bilateral (or cleared) |
| Counterparty risk | Mutualised via CCP | Direct to the other party |

Same core idea — agree now to trade later at a set price — but the system implications differ. A **future** generates daily margin events and faces a CCP, so you track marks and margin flows and clearing state. A **forward** is bespoke and typically settles once at maturity, so you carry direct counterparty exposure and bilateral settlement. That means different fields (clearing house vs counterparty, daily margin vs single settlement) and different risk columns. The economics rhyme; the plumbing doesn't.

### Q4. Model an option as data. What must the system capture?

An option is the **right, not the obligation**, to buy (**call**) or sell (**put**) the underlying at a **strike** price by an **expiry**. The asymmetry is the whole point and must be in the data.

```json
{
  "instrument_id": 90210,
  "type": "OPTION",
  "underlying_id": 12345,
  "call_put": "CALL",
  "strike": "150.00",
  "strike_ccy": "USD",
  "expiry": "2026-12-18",
  "exercise_style": "EUROPEAN",
  "contract_size": 100,
  "side_role": "HOLDER"      // holder has the right; writer has the obligation
}
```

The system captures **terms**: call/put, strike, expiry, exercise style (American = any time, European = at expiry), contract size, and whether this party is the **holder** (has the right) or the **writer** (has the obligation). It does **not** compute the option's value or its Greeks — those come from a pricing engine and are stored with source + timestamp. Booking an option as if it were a stock loses the strike, expiry, and right/obligation asymmetry that define it.

### Q5. Call vs put, holder vs writer — get the four combinations straight.

- **Call** — right to **buy** the underlying at the strike.
- **Put** — right to **sell** the underlying at the strike.
- **Holder (long the option)** — *paid* a premium, *has the right*, can choose to exercise or walk away.
- **Writer (short the option)** — *received* the premium, *has the obligation* to deliver if the holder exercises.

So:

| | Holder | Writer |
|---|---|---|
| Call | right to buy | must sell if exercised |
| Put | right to sell | must buy if exercised |

Engineer angle: this is why an option is asymmetric and can't be modelled with a signed quantity alone. Your data must record call/put *and* holder/writer, because the obligations differ entirely. A frequent bug is treating "short a call" and "long a put" as interchangeable — they're different contracts with different payoffs and different exercise mechanics.

### Q6. What is a swap, and how do you model its legs?

A **swap** is an agreement to exchange two streams of cash flows. The classic is an **interest-rate swap**: one party pays a **fixed** rate, the other pays a **floating** rate, both on the same **notional**, on a schedule.

Model it as a contract with **two legs**, each a cash-flow schedule:

```
Swap
 ├─ Leg A (PAY, FIXED)    notional, fixed_rate, freq, day_count, schedule[...]
 └─ Leg B (RECEIVE, FLOAT) notional, reference_index, spread, freq, day_count,
                            schedule[...], reset[...]
```

Each leg generates dated payment events (like a bond's coupons). The floating leg additionally has **reset** events: before each period its rate is fixed against a reference index. Net settlement is often the difference between the two legs on each date.

Engineer angle: legs and their schedules are first-class. You store the terms, derive the schedules, and materialise reset and payment events — then reconcile actuals against them. One flat row can't represent a two-legged, scheduled, resetting contract.

### Q7. Explain notional vs market value. Why is confusing them a classic bug?

- **Notional** — the face amount the cash flows are *calculated on*. A "100m notional" swap sizes its interest payments on 100m.
- **Market value** — what the contract is currently *worth* (its present value), which can be positive, negative, or near zero.

The trap: **notional is not what the contract is worth.** A 100m-notional interest-rate swap can have a market value of a few hundred thousand — or essentially zero at inception. Notional measures *exposure scale*; market value measures *current worth*.

Why it's a classic bug: engineers reuse one "amount" or "value" column for both, so risk reports show 100m where they mean PV, or PnL sums notionals. Store them as **separate, clearly named fields** (`notional` vs `market_value`), never collapse them, and know that risk/exposure metrics key off notional while PnL and balance-sheet value key off market value.

### Q8. What are margin and collateral, and what must your system track?

**Margin/collateral** is assets posted to cover potential loss on a derivative position. Two kinds:
- **Initial margin** — posted at open, sized to cover a worst-case move.
- **Variation margin** — posted/received **daily** as the position marks to market.

What the system tracks:

```
per position / per clearing relationship:
  initial_margin_required     (reference/limit)
  variation_margin_flows[]    (dated cash movements, in/out)
  collateral_posted[]         (what asset, haircut, currency)
  margin_call events          (demand to top up)
```

These are **real cash and asset movements**, so they're events you persist and **reconcile** against the clearing broker or counterparty — margin breaks are common ops work. Collateral also has its own currency and a **haircut** (a discount on the collateral's value). Engineer angle: margin is separate from the trade price; treating it as an afterthought means your cash ledger and the broker's disagree.

### Q9. What is clearing, and how does a CCP change what you store?

**Clearing** is the step after execution where a **central counterparty (CCP)** steps between the two sides: it becomes buyer to every seller and seller to every buyer, **nets** offsetting obligations, and **guarantees** them.

It changes your data because your counterparty is no longer the other trader — it's the **CCP**. So you store the clearing house, the clearing member/broker, the netted obligations, and the **margin** the CCP demands (initial + daily variation). Positions in the same contract net down at the CCP, so your gross trades and your cleared/netted exposure differ — both matter and both are stored.

Engineer angle: clearing state is part of the trade's lifecycle state machine (executed → cleared → settled). Model it explicitly; "cleared" is not a boolean bolted onto the trade but a stage with its own events (novation to CCP, margin postings).

### Q10. What is a reset on a floating leg, and why model it as an event?

A **reset** is fixing a floating leg's rate for the upcoming period against a **reference index**. A floating leg doesn't know its next payment amount until the reset happens — before then, the rate for that period is undetermined.

Model it as a distinct **event** because:
- It has its own date (the reset/fixing date), distinct from the payment date.
- It consumes external data (the reference rate on that date), which must be captured with source + timestamp.
- Between reset and payment, the amount is *known but not yet paid* — an accrual, like a bond coupon.

```
reset_date → observe reference rate → rate fixed for period
                                    → payment_date → cash flow
```

Engineer angle: resets are scheduled events your system materialises and later reconciles (did we capture the right fixing?). A missed or wrong reset silently produces a wrong payment — another convention/data bug, not a crash.

### Q11. The Greeks — should your booking system compute them?

No. The **Greeks** (delta, gamma, vega, theta, ...) are **price sensitivities** produced by a **pricing/risk engine**. To your booking or position system they are just more **numbers you store and serve**, alongside present value.

The engineering boundary: the pricing engine owns the maths and the models; your system owns the trades, positions, schedules, and the *storage* of the numbers the engine returns. When you store a Greek or a PV, store it **with its source and timestamp** (which model, which market snapshot, when) — same discipline as storing a mark price.

Getting this boundary wrong means building the wrong service: candidates who think their trade-capture system should compute vega are conflating the pricing desk's job with the ops/eng job. Store, serve, reconcile — don't derive the valuation.

### Q12. Design the schema for a vanilla interest-rate swap.

Contract plus legs plus schedules, all money exact-decimal with currency:

```sql
CREATE TABLE swap (
  trade_id      BIGINT PRIMARY KEY,   -- immutable trade event id
  counterparty  BIGINT NOT NULL,
  clearing_house BIGINT,              -- null if uncleared/OTC
  notional      NUMERIC(20,6) NOT NULL,
  notional_ccy  CHAR(3)       NOT NULL,
  start_date    DATE NOT NULL,
  maturity_date DATE NOT NULL
);

CREATE TABLE swap_leg (
  trade_id    BIGINT NOT NULL REFERENCES swap,
  leg_no      SMALLINT NOT NULL,        -- 1, 2
  direction   TEXT NOT NULL,            -- 'PAY' | 'RECEIVE'
  leg_type    TEXT NOT NULL,            -- 'FIXED' | 'FLOAT'
  fixed_rate  NUMERIC(12,8),            -- for FIXED
  ref_index   TEXT,                     -- for FLOAT
  spread      NUMERIC(12,8),            -- for FLOAT
  frequency   SMALLINT NOT NULL,
  day_count   TEXT NOT NULL,
  PRIMARY KEY (trade_id, leg_no)
);

CREATE TABLE swap_cashflow (
  trade_id  BIGINT NOT NULL,
  leg_no    SMALLINT NOT NULL,
  pay_date  DATE NOT NULL,
  reset_date DATE,                      -- float legs
  amount    NUMERIC(20,6),              -- null until reset fixes it
  currency  CHAR(3) NOT NULL,
  PRIMARY KEY (trade_id, leg_no, pay_date)
);
```

Notional and market value are separate concerns (market value comes from pricing, stored elsewhere with source). Legs are first-class; the cash-flow schedule is derived and carries reset dates. `day_count` is stored per leg, never assumed.

### Q13. Spot the bug: a report sums the notionals of all swaps and labels it "portfolio value."

That's the **notional-vs-market-value** bug. Notional is the face amount cash flows are calculated on, **not** what the contracts are worth. Summing notionals produces a number that can be orders of magnitude larger than the portfolio's actual value — a book of 100m-notional swaps might be worth a few million in market value, or net to near zero.

The fix: **portfolio value uses market value (present value), not notional.** Notional belongs in *exposure* metrics; market value belongs in *value/PnL* metrics. They're different columns with different meanings.

Root cause is usually schema: one "amount" column reused for both, or a developer who assumed notional ≈ value. Store `notional` and `market_value` as distinct, named fields, source market value from the pricing engine with a timestamp, and make sure reports pick the right one for the question being asked.

### Q14. How does an option's lifecycle differ from a stock trade, in data terms?

A stock trade is essentially born and settled: execute, settle T+2, you hold shares. An option carries **future optionality and a decision point**:

```
trade (buy/sell the option) → immutable event
   │  (holder now has a right until expiry)
   ▼
at/through expiry:
   exercise  → converts into the underlying trade/cash settlement
   expire    → right lapses worthless (no exercise)
```

So the data must track: the option terms (strike, expiry, call/put, style), the **holder/writer** role, and the **exercise-or-expire** outcome — which itself generates a *further* event (a resulting stock trade or a cash settlement). A stock has no equivalent of "the position may transform itself at a future date depending on a decision."

Engineer angle: model expiry/exercise as scheduled lifecycle events with explicit states, not a boolean. The option position is derived from the trade plus its exercise outcome.

### Q15. Where do derivatives break the "one instrument, one price, one quantity" model?

Everywhere — that model is for cash equities. Derivatives break it because:
- **Two legs** (swaps) — there isn't one quantity; there's a pay leg and a receive leg, each with its own schedule.
- **Schedules and resets** — value and cash flows unfold over many dated events, not a single price.
- **Daily margin** (futures) — cash moves every day, not once at settlement.
- **Notional ≠ value** — the "size" number and the "worth" number are different columns.
- **Right vs obligation** (options) — a signed quantity can't express asymmetric payoff and exercise.
- **Valuation is external** — PV and Greeks come from a pricing engine, stored with source + timestamp.

So the correct base model is **contract → legs → schedules → dated events over an immutable trade**, with valuation numbers stored (not computed) and margin/collateral tracked as their own cash events. Any schema that forces a derivative into `(instrument, price, qty)` will lie about at least one of these.

### Q16. Design a service that tracks derivative positions and their margin.

Restate: from a stream of derivative trades and market data, maintain positions, daily marks, and margin — queryable and reconcilable.

Data model: trades are immutable events; contracts carry legs and schedules; positions/exposure are **derived** folds over trades; margin flows and marks are dated events. Money is exact decimal with currency; notional and market value are distinct fields.

Flow:
- **Ingest trades** idempotently on the business trade id (not a transport id), partitioned per portfolio so ordering holds where it matters.
- **Generate schedules** (legs, coupons, resets) from terms; materialise reset and payment events.
- **Daily cycle**: take marks and PV/Greeks *from the pricing engine* (store each with source + timestamp — accept-and-reconcile, don't block), compute variation margin movements, record collateral posted.
- **Reconcile** margin cash and marks against the clearing broker/CCP; classify breaks (amount, date, missing) — margin breaks are routine ops.
- **Query**: position and exposure as-of any time by replaying events to a snapshot; keep append-only history for audit and lineage.

Tradeoffs to flag: the pricing engine is upstream and authoritative for valuations — your service stores and serves, never recomputes; keep ordering per portfolio, not global; snapshot to bound replay. The invariants (immutable trade, derived position, exact money, reconciled margin) are the same as the rest of the primer — derivatives just add legs, schedules, resets, and daily margin on top.

## FX, Currencies & Multi-Currency Systems

### Summary

**What this topic covers**

Foreign exchange and the discipline of building systems that hold more than one currency — the topic where a single misread quote silently corrupts every amount downstream. This topic has 16 questions. They cover **currency pairs** and the **base/quote** convention (EUR/USD = 1.10 means 1 EUR = 1.10 USD), **quote inversion** as a whole class of silent bugs, **spot vs forward** FX, **cross rates**, and the fact that a trade's **currency can differ from its settlement currency**. The larger half is engineering: representing money as **(amount, currency, scale)** so an amount without a currency is meaningless, always storing the currency, converting in the correct direction with a rate that has a **source and timestamp**, rounding correctly across currencies with different minor units (USD 2dp, JPY 0dp), and recognising a "spot the FX bug" when you see one. The recurring lesson: FX bugs don't crash — they produce plausible-looking wrong numbers, off by the rate or its square, found weeks later at reconciliation.

**Mental model**

Every monetary value is a **pair**: an amount *and* a currency. A bare number is not money — `100` is meaningless until it's `100 USD`. So the atomic type in a multi-currency system is `Money = (amount, currency, scale)`, and the cardinal rule is **never let a currency get separated from its amount**. A rate is directional: **EUR/USD = 1.10** is priced as "USD per 1 EUR," so to go EUR→USD you *multiply*, and USD→EUR you *divide* — invert that and you're off by the square of the rate. A rate is also a *reading at a moment from a source*, so store its timestamp and source, never treat it as a constant. Converting isn't just arithmetic: you must convert in the right direction, then round to the **target currency's** minor units (which vary by currency), and persist the rate you used for audit. Treat FX conversion like any external, imperfect input: stamp what you used, when, and from where — because you'll have to prove the number later.

**Key terms**

- **Currency pair** — two currencies quoted together, e.g. `EUR/USD`.
- **Base currency** — the first/left currency in the pair; the "1 unit of" side.
- **Quote (counter) currency** — the second/right currency; the price is expressed in it.
- **Exchange rate** — units of quote currency per 1 unit of base (`EUR/USD = 1.10` → 1 EUR = 1.10 USD).
- **Quote inversion** — flipping a rate (using USD/EUR where you needed EUR/USD); a classic silent bug.
- **Spot FX** — exchange at (near) the current rate, settling in ~T+2.
- **Forward FX** — agreement to exchange at a set rate on a future date.
- **Cross rate** — a rate between two currencies derived via a common third (e.g. via USD).
- **Trade currency** — the currency a deal is priced/denominated in.
- **Settlement currency** — the currency actually paid/received; can differ from the trade currency.
- **Minor unit / scale** — decimal places for a currency (USD 2, JPY 0), per ISO 4217.
- **Money** — the value type: `(amount, currency, scale)` — never a bare number.

**Why interviewers ask this**

FX is the purest test of whether a candidate builds money systems safely. The junior tell is treating amounts as plain numbers and rates as scalars you "just multiply by," with no attention to direction, currency, or rounding. The senior signal is instinctively pairing every amount with a currency, asking "which way does this rate go?" before converting, and knowing that different currencies have different minor units so a hardcoded 2dp is a bug. Interviewers love FX because its failures are **silent and directional**: a quote-inversion bug produces a number that looks reasonable but is off by the rate (or its square), and it survives until reconciliation. Being able to spot such a bug on sight, and to state the `Money = (amount, currency, scale)` discipline and "store the rate's source + timestamp" rule without prompting, marks someone who has actually built or debugged a multi-currency ledger.

**Common confusions**

- **Which side is base?** In `EUR/USD` the base is EUR (left); the rate is USD per 1 EUR. Reading it backwards inverts every conversion.
- **Rate is a scalar you multiply by** — direction matters. EUR→USD multiplies; USD→EUR divides. Wrong direction = off by the rate squared.
- **All currencies have 2 decimals** — no. JPY has 0, most have 2, a few have 3. Round to the currency's ISO 4217 exponent.
- **An amount is just a number** — it's meaningless without its currency; store them together, always.
- **Trade currency = settlement currency** — they can differ; a deal priced in one currency may settle in another.
- **A rate is a constant** — it's a reading from a source at a time; store both, because the same pair differs by venue and snapshot.

**What follows from this topic**

FX is the connective tissue of the whole primer. The `Money = (amount, currency, scale)` and never-float rules are the exact-money discipline the Fixed Income and Derivatives topics assume for every coupon, accrual, and margin flow. Storing a rate's **source and timestamp** is the same accept-and-reconcile, store-the-source pattern used for mark prices and valuations. Trade-vs-settlement currency plugs into the trade-lifecycle and treasury/cash material (nostro accounts are per-currency), and FX conversion errors are a leading cause of **reconciliation** breaks — a small, silent amount difference is very often a quote-inversion or rounding-direction bug. Master the "store the currency, convert in the right direction, round to the target's minor units, stamp the rate" loop here and every other money movement in a financial system inherits its correctness.

### Q1. Explain currency pairs and base/quote to an engineer.

A **currency pair** quotes two currencies together, e.g. `EUR/USD`. The **base** currency is the left one (EUR); the **quote** (or counter) currency is the right one (USD). The rate is expressed as **units of the quote currency per 1 unit of the base**.

So **EUR/USD = 1.10** means **1 EUR = 1.10 USD**. The base is always the "1 unit of" side; the number is priced in the quote currency.

Why the engineer cares: the pair's *orientation* determines the direction of every conversion. If you store or read the pair the wrong way round, every amount you convert is wrong. So a rate is never just a number in your system — it's a number *plus which pair and which direction it applies to*.

### Q2. EUR/USD = 1.10. Convert 200 EUR to USD and 200 USD to EUR. Show the directions.

`EUR/USD = 1.10` means 1 EUR = 1.10 USD. EUR is base, USD is quote.

- **EUR → USD** (base → quote): **multiply**. `200 EUR × 1.10 = 220 USD`.
- **USD → EUR** (quote → base): **divide**. `200 USD ÷ 1.10 = 181.82 EUR`.

The trap is doing it the other way — dividing when you should multiply — which gives `200 / 1.10 = 181.82` "USD" that's actually wrong by a factor of the rate squared (about 1.21x off). It looks like a plausible number, which is exactly why it survives to production.

Rule of thumb: to convert *from the base*, multiply by the rate; to convert *to the base*, divide. Always check which currency is the base before touching the arithmetic.

### Q3. What is quote inversion and why is it a whole class of silent bugs?

**Quote inversion** is using a rate in the wrong direction (or using USD/EUR where you needed EUR/USD). Because a rate and its inverse are both plausible small numbers, the mistake doesn't throw — it just produces a wrong amount.

It's a *class* of bugs, not one bug, because it shows up wherever a rate is applied:
- Multiplying when you should divide (or vice versa) → off by the **square** of the rate.
- Fetching `USD/EUR` and treating it as `EUR/USD` → off by using `1/rate`.
- Mislabelling which side is base in stored reference data → every downstream conversion inherits the error.

Defence: make direction explicit in the type system. Don't pass bare `rate: number`; pass something like `Rate(from=EUR, to=USD, value=1.10)` and have `convert(money, rate)` refuse a currency mismatch. Then an inverted rate is a compile/runtime error, not a silent 21%-off number found at month-end reconciliation.

### Q4. Why is Money = (amount, currency, scale) and not just a number?

Because a bare amount is meaningless. `100` isn't money — it could be 100 USD, 100 JPY, or 100 pence. The **currency** gives the amount meaning, and the **scale** (minor-unit decimals) tells you how to store and round it exactly.

```
Money {
  amount:   BigDecimal / integer minor units   // exact, never float
  currency: 'USD' | 'JPY' | ...                 // ISO 4217
  scale:    2 (USD) | 0 (JPY) | 3 (...)         // ISO 4217 exponent
}
```

Consequences of the discipline:
- **Never separate amount from currency** — no "amount" column without a "currency" column beside it.
- **Never add two Moneys of different currencies** — that's a bug, not arithmetic; convert first.
- **Never use float** — binary FP can't represent 0.10; errors compound and break reconciliation.

This single type prevents most multi-currency bugs by construction: you physically can't have a naked number that someone converts in the wrong direction or adds across currencies.

### Q5. Why must you always store the currency alongside the amount?

Because without it the number is ambiguous and every downstream operation is a guess. Storing `amount = 1000` with no currency means nobody can safely convert it, sum it, or display it — is it 1000 USD or 1000 JPY (a ~100x difference in value)?

Concretely, an amount-without-currency column causes:
- **Wrong aggregation** — summing a column that secretly mixes currencies produces a meaningless total.
- **Wrong conversion** — you can't pick the right pair/direction if you don't know the source currency.
- **Wrong rounding** — you can't round to the right minor unit if you don't know the currency.

So in schemas, `amount NUMERIC` and `currency CHAR(3)` travel together, always — ideally as a reusable composite. In code, they're one `Money` value. The rule is absolute because violations are silent: the data still looks like numbers, it just lies about what they're worth.

### Q6. Spot the FX bug in this conversion code.

```
# rate table stores EUR/USD = 1.10  (USD per 1 EUR)
def to_usd(amount_eur, rate):
    return amount_eur / rate      # <-- bug
```

The bug is **direction (quote inversion)**. `EUR/USD = 1.10` means 1 EUR = 1.10 USD, so EUR→USD should **multiply**: `amount_eur * rate`. Dividing gives roughly `amount / 1.10`, which is wrong by the square of the rate (~21% off for 1.10) — and it returns a number that looks perfectly plausible.

Two further smells:
- The function takes a bare `rate` with no idea which pair or direction it is — no protection against passing an inverted or wrong-pair rate.
- No currency travels with `amount_eur`, and no rounding to USD's 2 minor units is applied.

Fix: pass a typed `Money` and a directional `Rate(from, to)`, multiply base→quote, round to the target currency's minor unit, and stamp the rate's source + timestamp for audit.

### Q7. Spot vs forward FX — what's the difference to the system?

- **Spot FX** — exchange at (near) today's rate, settling almost immediately (typically ~T+2).
- **Forward FX** — an agreement to exchange a set amount at a **set rate on a future date**.

To the system:
- A **spot** deal is a near-term conversion/settlement; you capture the pair, rate (with source + timestamp), amounts on each side, and settlement date.
- A **forward** is a contract with a **future settlement date and a locked rate** — closer to the derivatives model: terms now, cash flow later. You track the agreed rate, the value date, and the two currency legs until it settles.

Same core `Money` and rate-direction discipline applies to both; the forward just adds a future value date and a rate fixed in advance rather than at market.

### Q8. What is a cross rate and how do you compute one safely?

A **cross rate** is the rate between two currencies derived through a common third (usually USD). If you have EUR/USD and USD/JPY, the EUR/JPY cross combines them.

The engineering risks are all about **direction and consistency**:
- Each leg must be oriented correctly (which is base?) before you chain them, or you invert one and the cross is wildly wrong.
- Both legs should come from the **same snapshot/source** (same timestamp), or you're mixing rates from different moments.
- Round only at the **end**, to the target currency's minor unit — not at each intermediate step, which accumulates error.

Practically: model each leg as a directional `Rate(from, to)`, chain them with a `convert` that enforces currency matching (EUR→USD→JPY), keep intermediate values in exact decimal at full precision, and stamp the composite with the source snapshot. Never eyeball-multiply two rates without checking each one's orientation.

### Q9. Trade currency vs settlement currency — how can they differ and why store both?

- **Trade currency** — the currency a deal is priced/denominated in.
- **Settlement currency** — the currency you actually pay or receive.

They can differ: a trade priced in one currency may, by agreement, settle in another (converted at an agreed FX rate). For example a deal denominated in EUR but settled in USD.

Store both because they answer different questions and drive different systems:
- Trade currency drives PnL and how the position is denominated.
- Settlement currency drives the **cash movement**, which **nostro account** (per-currency) is used, and what the custodian expects.

Collapsing them into one "currency" field is a bug: your books say one thing and your cash ledger another, and the FX conversion between them — with its rate, direction, and timestamp — goes unrecorded, which is exactly what you need for audit and reconciliation.

### Q10. How do you round correctly across currencies with different minor units?

Round to **the target currency's** minor units, from ISO 4217 — not a hardcoded 2.

| Currency | Minor units (scale) | Note |
|---|---|---|
| `USD`, `EUR`, `GBP` | 2 | cents/pence |
| `JPY` | 0 | no minor unit — `÷100` corrupts it |
| `BHD`, `KWD` | 3 | |

Rules:
- Look up the scale per currency; **never assume 2**. Dividing a JPY amount by 100 to "get cents" destroys it.
- Define the **rounding mode explicitly** (e.g. HALF_EVEN) — don't rely on a language default, or you and the counterparty round differently and break reconciliation.
- Round **once, at the end**, to the target currency's scale; keep intermediate arithmetic at full precision.
- Watch **pounds vs pence** (GBP vs GBp) and similar vendor conventions — a factor-of-100 trap.

The `scale` in `Money = (amount, currency, scale)` exists precisely so rounding is currency-correct and can't default to a wrong fixed precision.

### Q11. Why does an FX rate need a source and timestamp?

Because a rate is a **reading from a source at a moment**, not a constant. The same pair (EUR/USD) differs by venue, by snapshot, and by the second. If you store just `1.10`, you can never answer "which 1.10?" — which is exactly what auditors and reconciliation ask.

Storing source + timestamp gives you:
- **Auditability** — prove which rate you applied to a given conversion, and where it came from.
- **Reconciliation** — when your converted amount differs from a counterparty's, comparing rate + timestamp shows whether you used a different snapshot.
- **Reproducibility** — an as-of recalculation uses the rate as it stood then, not today's.

This is the same accept-and-reconcile, store-the-source discipline used for mark prices and valuations: stamp the value, its source, and its time, then proceed — don't block the hot path, but keep the evidence.

### Q12. Design a multi-currency cash ledger with point-in-time balances.

Restate: hold cash in many currencies, record every movement immutably, and answer "what was the balance in currency C as of time T."

Data model:
- **Movements are immutable events** (append-only): `(account, currency, amount, value_date, source, ...)`. Never mutate a posted row.
- **Balance is a derived aggregate** — a fold over movements up to a point in time, **per (account, currency)**. You don't store a mutable balance as truth.
- **Money is exact decimal with currency**; each currency's sub-ledger is kept separate — you don't add across currencies without an explicit FX conversion event.

```sql
CREATE TABLE cash_movement (
  account_id BIGINT NOT NULL,
  currency   CHAR(3) NOT NULL,
  amount     NUMERIC(20,6) NOT NULL,   -- signed, exact
  value_date DATE NOT NULL,
  fx_rate_id BIGINT,                   -- if this arose from a conversion
  source     TEXT NOT NULL,
  event_id   BIGINT PRIMARY KEY        -- idempotency on business key
);
-- balance(account, ccy, as_of) = SUM(amount) WHERE value_date <= as_of
```

FX conversions are themselves **paired movements** (out of one currency, into another) stamped with the rate used, its source and timestamp. Balances per currency are `GROUP BY` folds; snapshots bound replay for as-of queries. Double-entry keeps debits = credits.

### Q13. What breaks if you sum a mixed-currency amount column?

You get a **meaningless number**. Adding 100 USD + 100 JPY + 100 EUR as if they were `300` sums three different things — it's like adding metres to seconds. The result isn't a small error; it's nonsense that happens to be a number.

This breaks because someone stored `amount` without treating `currency` as part of the value:
- Reports show totals that are arithmetically "correct" but financially garbage.
- Aggregations silently mix currencies and nobody notices until the figure is challenged.

The fix is structural: you can only sum amounts **within a single currency**, or after converting all to a common currency (each conversion stamped with its rate + timestamp). A well-designed `Money` type refuses `add` across currencies, turning this from a silent wrong total into an explicit error at the point of the mistake.

### Q14. How do FX errors show up in reconciliation, and how do you diagnose them?

FX errors are a leading cause of **small, silent amount breaks**. Because they don't crash, they surface at reconciliation as a mismatch between your figure and a counterparty's/custodian's.

Diagnostic signatures:
- **Off by the rate (or its square)** → quote **inversion**: multiplied instead of divided, or used `1/rate`.
- **Off by ~100x** → **minor-unit** error: treated JPY as if it had 2 decimals, or pounds vs pence.
- **Small, jittery differences** → **rounding** mode/order mismatch, or the two sides used **different rate snapshots** (different timestamps/sources).
- **Off by a clean factor** → wrong pair used, or trade vs settlement currency confused.

This is exactly why you store the **rate, its source, and its timestamp** on every conversion, and round to the target currency's minor unit: when a break appears, you compare those fields against the other system and the cause is usually obvious. FX recon breaks are a data-and-direction problem, not an arithmetic-magnitude problem.

### Q15. Where should currency conversion live in a system, and why not scatter it?

Conversion should live in **one place** — a single `convert(Money, targetCurrency, rate) → Money` (or a small FX service) — not sprinkled across the codebase. Scattering it guarantees inconsistency: different call sites invert the rate differently, round differently, or forget the currency.

Centralising gives you one place that enforces every rule:
- Direction is checked (rate must match source→target; mismatch is an error).
- Rounding is applied to the **target** currency's minor unit with an explicit mode.
- The **rate, source, and timestamp** are recorded on the resulting movement for audit.
- Cross rates are chained consistently from one snapshot.

Everywhere else just calls it with typed `Money` and a directional `Rate`. This turns "did we convert correctly?" from a question you ask of every call site into an invariant guaranteed by one well-tested component — the same reason you never hand-roll money arithmetic inline.

### Q16. Design the FX-conversion layer for a trading system.

Restate: any part of the system that needs to convert money should get correct, auditable conversions, with direction, rounding, and rate provenance handled once.

Types and invariants:
- `Money = (amount exact-decimal, currency, scale)` — no bare numbers cross the boundary.
- `Rate = (from, to, value, source, timestamp)` — directional; carries provenance.
- `convert(Money from, Currency to)` fetches the right directional rate, refuses currency mismatches, multiplies base→quote (chaining via a common currency for crosses at full precision), rounds **once** to the target's minor unit with an explicit mode, and returns a new `Money` plus a record of the rate used.

Rate sourcing:
- Rates are **reference/market data** with source + timestamp; store snapshots, don't treat rates as constants.
- **Accept-and-reconcile**: stamp the rate you used and proceed — don't block the hot path waiting for a "perfect" rate; reconcile downstream.

Auditability:
- Every conversion emits an event recording input `Money`, output `Money`, and the exact rate (value, source, time) — so any figure can be reconstructed and any reconciliation break diagnosed (inversion vs minor-unit vs snapshot).

Tradeoffs to flag: centralise conversion so direction and rounding are enforced once; keep rates versioned for as-of recalculation; never float, never assume 2 decimals, never separate amount from currency. The correctness of every downstream PnL, balance, and settlement rides on this layer getting direction, rounding, and provenance right.
## Identifiers & the Security Master

### Summary

**What this topic covers**

How you name a financial instrument in a system that receives data from a dozen vendors, exchanges, and counterparties — none of whom agree on what to call it. This topic covers the common instrument identifiers (**ticker**, **ISIN**, **CUSIP**, **SEDOL**, **FIGI**) and the one entity identifier you'll meet everywhere (**LEI**), why **no identifier is universal**, and the reference-data component that resolves the mess: the **security master**. The 16 questions move from "what is an ISIN and why isn't a ticker enough" through the comparison table interviewers love, to designing the security-master schema, modelling the many-to-many mapping over time, and handling the feed pathologies (reused symbols, renames, exchange suffixes, corporate actions) that make naive symbol-matching a bug factory. This is the reference-data backbone every other finance system joins through — get it wrong and every trade, position, and price row keys on a lie.

**Mental model**

An instrument is a *thing in the world* (Acme Corp's ordinary shares). An identifier is a *name someone gave that thing* in a particular context. The two are not the same, and the fundamental error engineers make is treating a name as the thing. The same share has an ISIN (global), a CUSIP (if US/Canadian), a SEDOL (if it trades in London), a ticker on each exchange it lists on (often *different* tickers), and a FIGI. The same ticker string `ACME` can mean different companies on different exchanges, or the *same* string can be reassigned to a new company after the old one delists. So you invent your own identifier — an internal **canonical id** that you control and that never changes — and you maintain a **mapping table** from that canonical id to every external name. Business data (trades, positions, prices) references the canonical id as a foreign key; external names are resolved *to* the canonical id at ingest and *from* it at export. The security master is that mapping plus the instrument's static attributes. Think of it as your instrument dimension table — slow-changing, read everywhere, the join hub of the whole platform.

**Key terms**

- **Ticker** — short exchange/vendor symbol (`ACME`); human-friendly, **not globally unique**, reused and reassigned.
- **ISIN** — 12-char ISO 6166 identifier; globally unique per security; country prefix + national number + check digit.
- **CUSIP** — 9-char identifier for US/Canadian securities; forms the core of the US ISIN.
- **SEDOL** — 7-char identifier assigned by the London Stock Exchange for UK/Irish (and other) listings.
- **FIGI** — open, free Bloomberg-issued global identifier; unlike ISIN/CUSIP it's un-licensed and identifies down to the exchange-listing level.
- **LEI** — 20-char Legal Entity Identifier; identifies the *legal entity* (issuer, counterparty), not the instrument.
- **Security master** — the reference-data store: one canonical internal id per instrument plus a mapping to every external id and the instrument's static attributes.
- **Canonical id** — your own internal, immutable instrument key; the FK every business table uses.
- **Corporate action** — issuer event (split, merger, ticker change, delisting) that mutates identifiers and requires history.
- **Symbology** — the general problem of mapping one instrument's many symbols/ids across vendors and venues.

**Why interviewers ask this**

Symbology is the single most reliable "have you actually worked in finance" tell. A junior candidate says "just store the ticker" — and has never been paged at 2am because a ticker got reused and yesterday's trades now point at the wrong company. A senior candidate reaches for a canonical internal id and a mapping table *before* being prompted, and knows the mapping is many-to-many *over time* (effective-dated), not a static row. For fintech, market-data, and buy/sell-side engineering roles this is core competence, not trivia: reference data is where most data-quality incidents originate. Interviewers also use it to probe whether you understand the difference between an *instrument* id and an *entity* id (ISIN vs LEI), and whether you'll naively string-match two vendor symbols — the classic mistake that silently corrupts positions.

**Common confusions**

- **Ticker = unique identifier.** It isn't. Tickers are not globally unique (same string, different companies on different venues) and get reassigned after delisting. Never key business data on a ticker.
- **ISIN = ticker.** An ISIN is globally unique and stable; a ticker is neither. An ISIN can also cover an instrument that trades under several different tickers.
- **ISIN identifies a listing.** It identifies the *security*, not a specific exchange listing — one ISIN, many venue listings (that's what FIGI disambiguates).
- **CUSIP and ISIN are unrelated.** A US ISIN is literally `US` + the 9-char CUSIP + a check digit.
- **LEI is an instrument id.** No — LEI names the *legal entity* (the issuer or counterparty). Instrument ids and entity ids are different axes.
- **Two matching symbol strings = same instrument.** Vendor conventions differ (suffixes, share-class notation); string-comparing symbols to decide identity is a bug. Map through the master.

**What follows from this topic**

The canonical id defined here is the foreign key that ties every other finance topic together. Positions and PnL fold trade events keyed by `(canonical_instrument_id, portfolio)`. The trade lifecycle books orders and fills against it. Reconciliation's hardest job is resolving *their* symbology to *your* canonical id before it can even match. Market data vs reference data (the security master *is* the reference side) turns on the opposite storage profiles introduced here. If instrument identity is shaky, everything downstream inherits the corruption — which is why this is the reference-data backbone the rest of the primer assumes.

### Q1. What is a ticker, and why can't you use it as a primary key?

A **ticker** is the short, human-readable symbol an exchange or data vendor uses for an instrument — `ACME` for Acme Corp's shares. It's built for humans reading a screen, not for machines keying a database.

Three reasons it fails as a key:

- **Not globally unique.** The same string can identify different companies on different exchanges. `ACME` on one venue and `ACME` on another may be two unrelated issuers.
- **Reused over time.** When a company delists, its ticker goes back in the pool and can be reassigned to a completely different company months later. A row keyed on `ACME` silently changes meaning.
- **Venue- and vendor-specific spelling.** The same instrument carries different ticker *forms* per vendor (exchange suffixes, share-class notation). There's no canonical spelling.

**Engineer angle:** a ticker is a *display attribute*, never a foreign key. Resolve it to your internal canonical id at ingest and store business data (trades, positions, prices) against that id. If you key a `trades` table on ticker, a reuse event corrupts historical rows and no migration can cleanly undo it.

### Q2. Compare ticker, ISIN, CUSIP, SEDOL, and FIGI.

| Identifier | Scope | Length | Unique? | Notes |
|---|---|---|---|---|
| **Ticker** | Exchange/vendor | short | **No** | Human symbol; reused & reassigned |
| **ISIN** | Global (ISO 6166) | 12 char | Yes, per security | `CC` + national id + check digit |
| **CUSIP** | US / Canada | 9 char | Yes, in region | Forms the core of a US ISIN |
| **SEDOL** | UK / Ireland (+others) | 7 char | Yes, LSE-assigned | Per listing/market |
| **FIGI** | Global, open | 12 char | Yes, per listing | Free/un-licensed; exchange-level granularity |

The axis that matters: **granularity**. ISIN identifies the *security*; FIGI can go down to a specific *exchange listing* of that security. CUSIP/SEDOL are *regional*. Ticker is *local and unstable*.

**Engineer angle:** you'll ingest all of these from different feeds for the *same* instrument. None is present in every feed, and licensing differs (ISIN/CUSIP are licensed; FIGI is open). So none can be *your* primary key. They're all columns in your mapping table pointing at one internal canonical id.

### Q3. What is an ISIN and how is it structured?

An **ISIN** (International Securities Identification Number, ISO 6166) is the closest thing to a global standard instrument id: 12 characters, globally unique per security.

Structure: a **2-letter country code** + a **9-character national identifier** + a **1-digit check digit** (Luhn-style). Example shape: `US` + `<9-char CUSIP>` + `<check>`. The check digit lets you validate an ISIN's *format* cheaply before you trust it.

Two things engineers must internalise:

- An ISIN identifies the *security*, not a specific listing. One ISIN can trade on many exchanges under different tickers. If you need per-listing granularity (which venue, which currency), ISIN alone isn't enough — that's what FIGI or an ISIN+MIC pair gives you.
- ISIN is stable and unique, which is exactly why it's a *great mapping column* — but still not your primary key, because not every feed carries it and some instruments (many OTC/bespoke ones) don't have one.

**Engineer angle:** validate the check digit on ingest, store ISIN as an indexed mapping column, but resolve to your canonical id for all joins.

### Q4. CUSIP vs SEDOL vs FIGI — when does each show up?

- **CUSIP** — 9 characters, US and Canadian securities. If you process US equities/bonds you'll see it constantly; it's the guts of the US ISIN (`US` + CUSIP + check).
- **SEDOL** — 7 characters, assigned by the London Stock Exchange, primarily UK/Irish listings but issued for many markets to give a per-market id. If you touch UK/European trading it's everywhere.
- **FIGI** — 12 characters, open and free (no licence fee), Bloomberg-issued, resolves down to the *exchange-listing* level, so it disambiguates "Acme shares on venue A vs venue B."

**Engineer angle:** which ids you must support is a function of your markets and vendors, but the design lesson is the same regardless: they are all *external* names. FIGI's openness makes it attractive as a *lingua franca* for cross-vendor mapping (no licensing friction), but you still map it to your own canonical id — because the day you add a vendor that doesn't emit FIGI, your key must not break.

### Q5. What is an LEI and how does it differ from an instrument id?

An **LEI** (Legal Entity Identifier) is a 20-character code that identifies a *legal entity* — a company, fund, or counterparty — not an instrument. It answers "*who* is the issuer / *who* is the counterparty," where ISIN answers "*what* is the instrument."

They're different axes and you need both:

- One legal entity (one LEI) issues *many* instruments (many ISINs) — a company issues equity plus several bonds.
- A trade references an **instrument** (ISIN/canonical id) *and* a **counterparty** (LEI). Two foreign keys, two different reference tables.

**Engineer angle:** model entities and instruments as separate reference-data domains — an `instruments` table (keyed on your canonical instrument id, mapping to ISIN/CUSIP/ticker...) and a `counterparties`/`issuers` table (keyed on your canonical entity id, mapping to LEI). Regulators (MiFID II/EMIR trade reporting) require LEIs on reportable trades, so the entity master is not optional. Conflating instrument and entity identity is a schema smell.

### Q6. Why does no single identifier work universally?

Because each id was created by a different body for a different purpose, in a different region, at a different granularity:

- **Regional coverage gaps** — CUSIP is US/Canada, SEDOL is UK-centric; neither covers the world.
- **Granularity mismatch** — ISIN is per-security, FIGI is per-listing, ticker is per-venue. No single one is right for every question.
- **Coverage gaps** — not every instrument has every id. Many OTC/bespoke instruments have no ISIN at all.
- **Licensing** — ISIN/CUSIP are licensed data; you can't always freely redistribute them, which constrains their use as universal keys.
- **Instability** — tickers get reused; even "stable" ids change under corporate actions.

**Engineer angle:** this is precisely *why* you invent a canonical internal id you control. It's stable because you never reassign it, complete because you assign one to *every* instrument you touch, and unlicensed because it's yours. Every external id becomes a mapping *to* it. The universal id doesn't exist in the wild — you build it internally.

### Q7. Design the security-master schema.

A canonical instrument table plus a mapping table plus (usually) an entity table:

```sql
-- the thing itself: your canonical id + static attributes
CREATE TABLE instrument (
  instrument_id   BIGINT PRIMARY KEY,     -- internal canonical id (yours, immutable)
  asset_class     TEXT NOT NULL,          -- EQUITY | BOND | FUTURE | OPTION | SWAP...
  issuer_id       BIGINT REFERENCES entity(entity_id),
  currency        CHAR(3),
  description      TEXT,
  status          TEXT NOT NULL           -- ACTIVE | DELISTED | MATURED
);

-- one instrument -> many external ids, effective-dated
CREATE TABLE instrument_xref (
  instrument_id   BIGINT REFERENCES instrument(instrument_id),
  id_type         TEXT NOT NULL,          -- ISIN | CUSIP | SEDOL | FIGI | TICKER
  id_value        TEXT NOT NULL,
  venue           TEXT,                   -- MIC for venue-scoped ids (ticker/FIGI)
  valid_from      DATE NOT NULL,
  valid_to        DATE,                   -- NULL = still current
  PRIMARY KEY (id_type, id_value, venue, valid_from)
);
```

Business tables (`trades`, `positions`, `prices`) carry `instrument_id` as their FK — **never** a raw ticker or ISIN.

**Engineer angle:** the effective dating on `instrument_xref` is the non-negotiable part — it's what lets a reused ticker point at instrument A until date X and instrument B after, without corrupting history. Lookups join through the xref (`WHERE id_type='ISIN' AND id_value=? AND ? BETWEEN valid_from AND COALESCE(valid_to,'9999-12-31')`). See the SQL primer for the mapping-table join pattern and the System Design primer for distributing this slow-changing reference data.

### Q8. Feed says ticker `ACME` — how do you resolve it to your instrument?

Not by string-matching your `instrument` rows on `ACME`. You resolve through the mapping table *with context*:

- **Use the id type and venue** — a ticker is scoped to a venue, so you need `(ticker='ACME', venue=<MIC from the feed>)`, not `ticker='ACME'` alone.
- **Use the effective date** — resolve `ACME` *as of the trade/observation date*, so a later reassignment doesn't rewrite the past.
- **Fall back deliberately** — if the feed also carries an ISIN/FIGI, prefer resolving on the *more stable* id and use the ticker only to disambiguate.
- **Fail loud on ambiguity** — if the lookup returns zero or more than one active instrument, that's a reference-data exception to route to ops, not a row to silently drop or guess.

**Engineer angle:** this is a *resolution* step at ingest, producing your `instrument_id`, which is what actually gets stored. The rule is "resolve at the boundary, store the canonical id." Never carry a raw ticker into a position calc.

### Q9. A ticker got reused for a different company — what breaks, and how does the master prevent it?

**What breaks without a master:** if trades and positions are keyed on the ticker string, the day `ACME` is reassigned, every historical row for the *old* Acme now reads as belonging to the *new* Acme. Positions merge two unrelated companies; PnL is nonsense; and there's no clean migration because the strings are genuinely identical.

**How the master prevents it:** business data is keyed on a stable `instrument_id`, and the ticker lives in an **effective-dated** `instrument_xref` row. Old-Acme is `instrument_id = 1` with `ticker='ACME'` `valid_to = 2026-03-01`; new-Acme is `instrument_id = 2` with `ticker='ACME'` `valid_from = 2026-03-02`. Resolution is date-scoped, so trades booked before the cutover still resolve to id 1 and after to id 2. History is preserved.

**Engineer angle:** this single scenario is the entire justification for a canonical id plus effective-dated mapping. If an interviewer asks "why not just store the ticker," this is the answer to give.

### Q10. How do exchange suffixes and vendor symbology differ, and why can't you regex them away?

The same instrument is spelled differently by each vendor: one appends an exchange suffix (`ACME.L` for London), another uses a space-and-code convention, a third uses a different share-class notation entirely. It's tempting to strip suffixes with a regex and compare the roots.

Don't. Two reasons:

- **Stripping loses meaning.** The suffix often *is* the disambiguator — `ACME.L` and `ACME.N` may be genuinely different listings (different venue, currency, even different economics for dual-listed names). Regex them to `ACME` and you've merged distinct instruments.
- **Conventions aren't regular.** Vendor formats have exceptions, share-class quirks, and special cases that no clean regex captures; you'll get false positives that silently corrupt data.

**Engineer angle:** map, don't parse. Each vendor's symbol is an `instrument_xref` row with its own `id_type` (e.g. `TICKER_VENDORA`) resolving to your canonical id. Symbology mapping is a *data* problem solved with a maintained table (often vendor-supplied cross-reference files), not a *string* problem solved with a regex. See the SQL primer on messy-identifier cleaning.

### Q11. Model the instrument-to-id mapping over time — why isn't it a static row?

Because identity is not static. Over an instrument's life:

- Tickers change (rebranding, corporate actions).
- New ids get assigned (a security gets a FIGI it didn't have before).
- The instrument delists or matures.
- Under a merger, one instrument's ids get superseded by another's.

A single `instrument(ticker, isin, ...)` row can only hold the *current* state, so any question about the past ("what did `ACME` mean on the trade date?") is unanswerable, and updating it destroys history.

**Engineer angle:** model the mapping as a **many-to-many, effective-dated** relation — the `instrument_xref` table with `valid_from`/`valid_to` (bitemporal if you also need "what did we *believe* on date D"). Lookups are always as-of a date. This mirrors the event-sourcing/temporal theme across the primer: append new mapping rows, close old ones with a `valid_to`, never mutate in place. See the SQL primer for temporal-table modelling.

### Q12. How do corporate actions affect identifiers?

A **corporate action** is an issuer event that changes the instrument or its identity: stock split, ticker/name change, merger, spin-off, delisting, bond maturity. Each can mutate identifiers:

- **Ticker change** — same instrument, new symbol; old ticker may later be *reassigned* to someone else.
- **Merger** — instrument A's holders receive instrument B; A's ids are superseded.
- **Split** — quantities change (2-for-1), identity may or may not; positions must be adjusted.
- **Delisting** — ticker returns to the pool for reuse.

**Engineer angle:** corporate actions are *why* the mapping must be effective-dated and *why* the canonical id must be stable across them (or explicitly superseded by a linked successor id). You model them as **events** that close old xref rows and open new ones, and that may generate position adjustments. Never handle a split by an in-place `UPDATE quantity` — post it as an auditable event so as-of queries before and after both reconstruct correctly. This connects the security master to the event-sourcing and audit-trail themes elsewhere in the primer.

### Q13. Where does the security master sit — reference data or market data?

Firmly **reference data**. Its characteristics are the opposite of market (price) data:

| | Security master (reference) | Market data |
|---|---|---|
| Content | Instrument attrs + id mappings | Prices/quotes/trades |
| Change rate | Slow-changing | High-volume, real-time |
| Write profile | Occasional edits | Append firehose |
| Read profile | Read *everywhere*, hot | Recent + range scans |

**Engineer angle:** because it's slow-changing and read-everywhere, the security master is a prime candidate for **caching plus change-data-capture (CDC)** to propagate edits, and it lives in a normal relational/reference store — *not* in your time-series price store. Jamming instrument attributes into the same table as tick data (or vice versa) fights both access patterns. This is the reference-vs-market-data split covered later; the master is the canonical example of the reference side. See the System Design primer for reference-data distribution.

### Q14. Design instrument lookups for a high-read system.

The master is read on *every* trade, price, and position operation, so lookups must be cheap and correct:

- **Resolve at the edge, cache the result.** On ingest, resolve external id → `instrument_id` once and carry the canonical id through the system; downstream code never re-resolves.
- **Cache the master aggressively.** It's slow-changing, so an in-memory or distributed cache of `instrument_id → attributes` and `(id_type, id_value, date) → instrument_id` is safe, with CDC/invalidations on edits.
- **Index the xref** on `(id_type, id_value, venue)` and range-scan the effective dates.
- **Preload for batch.** For a nightly position/NAV run, load the whole master into memory once rather than doing N point lookups.

**Engineer angle:** the correctness constraint is that lookups are *as-of a date* — a cache keyed only on `(id_type, id_value)` without the date is a latent reuse bug. Cache the resolved id alongside the effective window, or key business data by canonical id so hot-path reads skip resolution entirely.

### Q15. Two vendor feeds disagree on an instrument's ISIN — how do you handle it?

First, don't silently pick one — that's a data-quality decision you must make explicit and auditable.

Options, roughly in order:

- **Golden-source precedence.** Define a ranked source-of-truth per attribute (e.g. vendor A wins for ISIN, vendor B for ratings). Store the winning value *and* which source it came from.
- **Flag the discrepancy.** Raise a reference-data break for ops to investigate — one vendor may simply be stale or wrong.
- **Keep both, mark the conflict.** Persist each vendor's claimed value with provenance; expose the resolved "golden" value plus the conflict flag.

**Engineer angle:** this is reconciliation applied to *reference* data. The pattern is the same as trade recon — ingest, normalise, match, diff, route breaks — and the invariant is **provenance**: every attribute carries which source and when. Never overwrite one vendor's value with another's and lose the trail; store source + timestamp so an auditor can see why the master says what it says. Connects to the reconciliation and audit-trail themes.

### Q16. Design a real-time symbology-resolution service for an order-entry gateway.

A gateway receiving orders quoting arbitrary vendor symbols needs to resolve each to your canonical `instrument_id` in the hot path, correctly and fast.

Shape it as:

- **In-memory resolution index** — `(id_type, id_value, venue) → instrument_id`, loaded from the master and kept warm; sub-millisecond lookups, no DB round-trip per order.
- **CDC-driven updates** — subscribe to master changes so new listings and corporate actions update the index without a restart; the security master is the source of truth, this is a read model of it.
- **As-of correctness** — for live order entry, resolve as-of *now*; the index holds current effective mappings, with the historical xref available for post-trade/replay.
- **Fail closed on ambiguity** — zero or multiple matches rejects the order (or routes to manual) rather than guessing; a mis-resolved instrument is a mis-booked trade.
- **Emit the canonical id** — the order that flows downstream carries `instrument_id`, not the raw symbol, so nothing re-resolves.

**Engineer angle:** this is CQRS over the security master — the master is the write side / source of truth, the resolution index is a materialised read model rebuilt from it and updated via CDC. The design principles (resolve at the edge, store canonical, fail loud, as-of correctness) are the whole topic in one service. See the System Design primer for CQRS and CDC.

## Trade Lifecycle: Order to Execution

### Summary

**What this topic covers**

The front-office half of a trade's life: how an *intent to trade* becomes a *done deal*, and the precise vocabulary along the way. This topic pulls apart four words that engineers use interchangeably and the business does not — **order**, **execution**, **fill**, and **trade** — and shows why each is a *separate entity* in your schema. It covers order types (market, limit, stop), the cardinality that trips people up (**one order → many fills → one trade**), the **FIX** protocol at a high level, the front-office order flow, and how to model all of it in a schema without collapsing distinct concepts into one flat table. The 16 questions run from warm-ups ("what's the difference between an order and a trade") to modelling exercises ("design the order/execution/fill schema") to spot-the-bug ("this system stores an order as a single mutable row — what's wrong"). This is the event-generation stage; the trade events born here are what positions fold over and what settlement later moves.

**Mental model**

Read the lifecycle as **intent → matching → result**. An **order** is *intent*: "I want to buy 1000 ACME at ≤ 50." It is a standing instruction that may live for microseconds or all day. When the order meets liquidity in the market, an **execution** (a match event) occurs — possibly several, because the market rarely fills a large order in one shot. Each execution produces a **fill**: a quantity done at a price. The **trade** is the resulting done deal — the economic fact you book, keep forever, and later settle. The cardinality is the crux: *one order can produce many executions/fills*, which *aggregate into a trade* (or into trades). None of these overwrites the previous; each is an **append-only state change**. The engineer's instinct must be event-shaped: an order is not a row you mutate from PENDING to FILLED — it's an aggregate whose state is derived from an ordered stream of events (placed, partially filled, filled, cancelled). Get that framing and the schema writes itself; miss it and you build a mutable row that lies about history and loses the audit trail regulators require.

**Key terms**

- **Order** — intent to trade: side (buy/sell), instrument, quantity, and constraints (price, time-in-force). Not yet a deal.
- **Execution** — a match event: the order (partially) met liquidity in the market.
- **Fill** — the quantity executed at a price by an execution; may be partial or full.
- **Trade** — the resulting done deal; the immutable economic fact you book and later settle.
- **Market order** — execute immediately at the best available price; prioritises certainty of execution over price.
- **Limit order** — execute only at a specified price or better; prioritises price over certainty.
- **Stop order** — dormant until a trigger price, then becomes a market (or limit) order.
- **Time-in-force** — how long an order stays live (day, GTC = good-till-cancelled, IOC = immediate-or-cancel, FOK = fill-or-kill).
- **FIX** — Financial Information eXchange, the standard messaging protocol for order/execution flow between systems.
- **Front office** — the trading/revenue side that generates orders and executions (vs middle/back office).
- **Partial fill** — an order executed in pieces; the sum of fills reaches the ordered quantity over time.

**Why interviewers ask this**

Order/execution/fill/trade is the canonical finance **false-friend** test. In everyday English these words are near-synonyms; in a trading system they are four distinct entities with a strict one-to-many structure. A candidate who models them as one mutable row — flipping an `order.status` from OPEN to FILLED and stashing a single price — reveals they've never seen a real order fill in three pieces at three prices. A senior candidate reaches for parent/child entities and an append-only event view, mentions partial fills unprompted, and knows FIX is how the messages actually flow. Interviewers use this to gauge domain fluency for any trading, brokerage, or exchange-adjacent engineering role, and to see whether you'll design a schema that *tells the truth* about what happened — which matters because the audit trail is regulatory, not optional.

**Common confusions**

- **Order = trade.** An order is *intent*; a trade is the *done deal*. Many orders never become trades (cancelled, unfilled).
- **One order = one fill.** No — a single order commonly executes in *many* fills at *different* prices. The average price is derived from the fills, not a property of the order.
- **Execution = fill.** Closely related but distinct: the *execution* is the match event; the *fill* is the quantity/price it produced. One execution → one fill; think event vs its economic content.
- **`order.status` is the source of truth.** Status is *derived* from the order's event stream; a single mutable status column loses the history of how it got there.
- **Market order guarantees a price.** It guarantees *execution*, not price. A limit order guarantees *price-or-better*, not execution.
- **FIX is an API you call.** FIX is a *messaging protocol* (session + application messages), not a REST endpoint; order flow is a conversation of messages, not one request/response.

**What follows from this topic**

The trades born here are the immutable events the Positions & PnL topic folds over — a position is a reduce over exactly these trade events. The done deal produced at execution is the *input* to the next topic, Clearing & Settlement, which takes the trade through confirmation, clearing, and the actual cash-vs-security exchange. The append-only, event-shaped modelling introduced here (order as an aggregate over a stream, never a mutable row) is the same event-sourcing discipline that recurs in position-keeping, reconciliation, and the audit-trail requirements throughout the primer.

### Q1. Explain the difference between an order, an execution, a fill, and a trade.

They are four *distinct* things, in strict sequence:

- **Order** — *intent*. "Buy 1000 ACME at ≤ 50." A standing instruction; may never result in a deal.
- **Execution** — a *match event*. The order met liquidity in the market. A large order can generate several executions.
- **Fill** — the *quantity done at a price* by an execution (partial or full). One execution produces one fill.
- **Trade** — the *done deal*: the immutable economic fact you book, report, and settle.

The one-liner: an order *may* produce executions; each execution produces a fill; the fills *aggregate into* a trade.

**Engineer angle:** these are separate entities in your schema, not one row with a changing status. Everyday English treats them as synonyms — that's the false-friend trap. If your data model has a single `orders` table with a `price` and a `status` column, it cannot represent an order that filled in three pieces at three prices, which is the *normal* case. Model the cardinality (below) explicitly.

### Q2. Why is "one order → many fills → one trade" the crux of order modelling?

Because it's the cardinality that a naive schema gets wrong, and getting it wrong makes the data lie.

A single order for 1000 shares rarely fills all at once. The market provides liquidity in pieces:

```
Order: BUY 1000 ACME @ limit 50
  ├─ Fill 1:  400 @ 49.98
  ├─ Fill 2:  350 @ 49.99
  └─ Fill 3:  250 @ 50.00
                         → Trade: 1000 ACME, avg 49.99
```

The order's *executed quantity* and *average price* are **derived** from the fills — they are not attributes you set on the order. If you store one price on the order row, you've lost the three-price reality and can't reconstruct it.

**Engineer angle:** model order (parent) → fills (children) as a 1:N relationship, and treat average price / filled quantity as computed aggregates over the fills. This mirrors the position-as-a-fold theme: derived state comes from summing events, never from a single stored scalar. See the SQL primer for 1:N keys.

### Q3. Model orders, executions, and fills in a schema.

Parent/child entities, append-only:

```sql
CREATE TABLE ord (                      -- the intent (parent)
  order_id      BIGINT PRIMARY KEY,
  instrument_id BIGINT NOT NULL,        -- canonical id from the security master
  side          TEXT NOT NULL,          -- BUY | SELL
  quantity      NUMERIC NOT NULL,       -- ordered qty
  order_type    TEXT NOT NULL,          -- MARKET | LIMIT | STOP
  limit_price   NUMERIC,                -- null for market
  tif           TEXT NOT NULL,          -- DAY | GTC | IOC | FOK
  placed_at     TIMESTAMPTZ NOT NULL
);

CREATE TABLE fill (                      -- executions/fills (children), append-only
  fill_id       BIGINT PRIMARY KEY,
  order_id      BIGINT REFERENCES ord(order_id),
  quantity      NUMERIC NOT NULL,       -- this fill's qty (partial)
  price         NUMERIC NOT NULL,       -- exact decimal, never float
  executed_at   TIMESTAMPTZ NOT NULL,
  venue         TEXT
);
```

Order *state* (working / partially filled / filled / cancelled) is **derived**: `SUM(fill.quantity)` vs `ord.quantity` tells you filled/partial. The trade is the aggregate of an order's fills (or a per-fill trade record, depending on booking convention).

**Engineer angle:** two rules. (1) `fill` is append-only — you never update a fill, you insert new ones. (2) Money columns are exact decimal, never float — average price computed from floats drifts and breaks reconciliation. Note the FK is the canonical `instrument_id`, never a raw ticker.

### Q4. What are the main order types?

| Type | Behaviour | Trades off |
|---|---|---|
| **Market** | Execute immediately at best available price | Certainty of execution *over* price |
| **Limit** | Execute only at a set price or better | Price *over* certainty of execution |
| **Stop** | Dormant until a trigger price, then becomes market (or limit) | Activation on a condition |

A **market** order says "get me done, I'll take the price." A **limit** order says "only at 50 or better, I'll wait." A **stop** order sleeps until the market hits a trigger, then wakes up as a market/limit order (used to cap losses or arm entries).

**Engineer angle:** the order type is an attribute on the order entity and it changes *how* the matching engine treats it, but not the downstream fill/trade structure — all three produce the same fill → trade shape. Your schema stores `order_type` + optional `limit_price`/`stop_price`; the matching logic lives in the exchange/gateway, not your booking model.

### Q5. What's the difference between a market order and a limit order for your system?

Functionally: a **market** order prioritises *certainty of execution* (you'll get filled, price uncertain); a **limit** order prioritises *price* (you'll only fill at your limit or better, execution uncertain).

For your data model and system behaviour, the differences that matter:

- **Fill certainty** — a market order essentially always fills (so expect fills promptly); a limit order may sit unfilled for the whole session or expire, so your model must represent "live, zero fills" cleanly.
- **Price bounds** — a limit order carries a `limit_price` you validate fills against; a market order has none, so you can't sanity-check a fill price the same way (watch for outliers).
- **Lifecycle length** — limit/GTC orders can be long-lived, so their event stream (amend, partial fill, partial fill, cancel) is richer.

**Engineer angle:** both share the order → fills → trade structure; the type only changes *which* states are common and whether a `limit_price` constraint exists. Don't branch your schema by order type — branch the matching behaviour, keep the booking model uniform.

### Q6. Spot the bug: an order is stored as one row whose status flips PENDING → FILLED.

The bug is that a single mutable row **cannot represent reality and destroys the audit trail**.

What it can't represent:

- **Partial fills** — an order that fills 400 then 350 then 250 has no place to record three quantities and three prices; you get one price that's wrong.
- **History** — flipping `status` in place erases the sequence of events (placed → partially filled → filled). You can't answer "what was the state at 10:32?" or "when did the second fill land?"
- **Corrections/cancels** — an amend or bust has nowhere to live except another destructive update.

And it's a regulatory problem: trading systems must reconstruct *who did what, when* — a mutable status column can't.

**Engineer angle:** the fix is the parent/child + append-only model. The order is an aggregate whose current state is *derived* from an ordered stream of immutable events (or fill rows), never a single overwritten column. This is the event-sourcing theme applied to orders: state = fold over events, corrections = new compensating events, never mutation.

### Q7. What is the FIX protocol, at a high level?

**FIX** (Financial Information eXchange) is the industry-standard *messaging protocol* for communicating orders and executions between systems — buy-side to broker, broker to exchange, and so on. It's the lingua franca of front-office order flow.

Key points at the right altitude:

- It's a **message protocol**, not a REST API. Messages are tag=value fields (e.g. a `NewOrderSingle` to place an order, an `ExecutionReport` to report a fill or status change).
- It has two layers: a **session layer** (ordered, reliable, sequence-numbered delivery, heartbeats, resend on gap) and an **application layer** (the business messages: orders, cancels, execution reports).
- Order flow is a **conversation**: you send `NewOrderSingle`; you receive a stream of `ExecutionReport`s as the order is acknowledged, partially filled, filled, or cancelled.

**Engineer angle:** you don't need to memorise tags. You need to know that fills arrive as a *sequence of execution-report messages*, which maps naturally onto the append-only fill model — each report is an event you record, not a row you overwrite. FIX's own sequence numbers and resend also mean you'll get *redelivered* messages, so your consumer must be idempotent (dedupe on the message/execution id). That connects to the idempotency theme in the systems-patterns material.

### Q8. Walk through the front-office order flow.

Intent to done deal:

```
Trader / algo
   │  places
   ▼
Order (intent)  ──FIX NewOrderSingle──►  Broker / Exchange
   │                                         │ matches against the book
   │        ◄──FIX ExecutionReport(s)──       │
   ▼                                         ▼
Executions ──► Fills (partial, partial, ...) ──► Trade (done deal)
```

1. A trader or algo generates an **order** with side, instrument, quantity, type, and constraints.
2. It's sent (typically via **FIX**) to a broker or exchange.
3. The order meets liquidity → one or more **executions**, each producing a **fill**, reported back as execution reports.
4. Fills aggregate into a **trade** — the economic fact that gets booked.
5. The trade flows to the *middle/back office* for validation, clearing, and settlement (next topic).

**Engineer angle:** the front office *generates* the immutable trade events; everything downstream (positions, PnL, settlement) consumes them. Your job at this stage is to capture the order and its fills faithfully and emit a clean trade event. The moment a trade is born, it becomes append-only history.

### Q9. What is a partial fill and why must the schema anticipate it?

A **partial fill** is when an order executes in pieces — 400 now, 350 later, 250 later still — rather than all at once. It's not an edge case; for any order larger than the immediately available liquidity it's the *normal* case.

The schema must anticipate it because:

- The order's **filled quantity** grows over time and may never reach the full ordered quantity (the rest cancels/expires).
- Each piece has its **own price**, so there is no single "the price" for the order — only an average derived from the pieces.
- The order passes through a **PARTIALLY_FILLED** state that a boolean `filled` flag can't express.

**Engineer angle:** this is exactly why fills are child rows, not columns on the order. `SUM(fill.quantity)` gives filled qty; a weighted average of `fill.price` gives the average execution price; `ordered − filled` gives the remaining. All *derived*. A schema that can't represent a partial fill is the single most common order-modelling bug.

### Q10. How do you compute the average execution price of an order?

It's a **quantity-weighted average** over the fills — never a plain mean of the prices, and never a value you store on the order as truth.

```
avg_price = Σ(fill.quantity × fill.price) / Σ(fill.quantity)

Fills: (400 @ 49.98), (350 @ 49.99), (250 @ 50.00)
     = (400·49.98 + 350·49.99 + 250·50.00) / 1000
     = 49.9895
```

A simple average of 49.98, 49.99, 50.00 would be *wrong* — it ignores that the 400-share fill carries more weight.

**Engineer angle:** two rules. (1) Compute with **exact decimal** arithmetic and define rounding explicitly — averaging money in floats accumulates error that later breaks reconciliation. (2) Treat average price as a **derived** value (a fold over the fills), consistent with the position-as-a-fold theme; if you cache it, cache it as a materialised read model you can always rebuild from the fills, not as a source of truth you mutate.

### Q11. When does an order become a trade — and can one order create several trades?

An order becomes a **trade** when it produces executed fills — the trade is the *done deal* the fills aggregate into. An order that's placed and cancelled with zero fills never becomes a trade at all.

Whether one order yields one trade or several depends on booking convention:

- **Aggregated booking** — all of an order's fills roll up into *one* trade (net quantity, average price). Common for a simple buy-side booking.
- **Per-fill booking** — each fill is booked as its *own* trade record. Common where each execution must settle or report independently.

Both are valid; what matters is that the convention is explicit and consistent, because it determines the granularity of everything downstream (settlement instructions, reporting).

**Engineer angle:** decide the order↔trade cardinality deliberately and encode it. If per-fill, `trade` maps 1:1 to `fill`; if aggregated, `trade` is a rollup with a link back to its constituent fills. Either way, keep the link — you must be able to trace a trade back to the executions that produced it for audit and reconciliation.

### Q12. Design order-state tracking as an event stream rather than a status column.

Instead of a mutable `order.status`, record an append-only stream of order events and derive state:

```
order_event (order_id, seq, event_type, qty, price, at)
  1  PLACED            1000  @limit 50
  2  PARTIAL_FILL       400  @49.98
  3  PARTIAL_FILL       350  @49.99
  4  PARTIAL_FILL       250  @50.00
  5  FILLED               -        -
```

Current state = a **fold** over the events: filled qty = Σ fill events; status = FILLED once Σ fills = ordered qty, PARTIALLY_FILLED while `0 < Σ < ordered`, CANCELLED on a cancel event.

**Engineer angle:** benefits are the recurring event-sourcing wins — full history ("state as of seq 3"), a natural audit trail (regulatory), and corrections as *compensating events* (a bust is a new event, never a destructive update). A `status` column, if you keep one, is a materialised read model derived from the stream, not the source of truth. Redelivered FIX execution reports are deduped by their execution id (idempotency on a business key). See the System Design primer for event sourcing and CQRS.

### Q13. Where's the sharp edge between execution and fill?

They're adjacent and often used interchangeably, but they answer different questions:

- **Execution** — the *event*: "a match happened." It's the occurrence — the order met liquidity at a venue at a time.
- **Fill** — the *economic content* of that event: "this quantity at this price." It's the what.

Think event vs its payload. One execution produces one fill (a quantity/price). The distinction rarely forces two separate tables in a simple booking model — a `fill` row often captures both the event and its content — but the *vocabulary* distinction matters when you talk to the business or read a FIX execution report (which carries both the fact of the execution and the fill quantity/price).

**Engineer angle:** in most schemas you'll have one child entity (call it `fill` or `execution`) holding quantity, price, time, venue. Just don't conflate *either* of them with the **order** (intent) or the **trade** (the aggregated done deal) — that's the false-friend line that actually corrupts data.

### Q14. Design idempotent ingestion of execution reports from a FIX feed.

FIX sessions resend on sequence gaps and can redeliver, so the same execution report may arrive more than once. Double-processing means double-booked fills — inflated positions and broken PnL.

Design:

- **Dedupe on a business key.** Each execution report carries an execution id (a business identifier). Persist a *seen-keys* set; on a repeat, no-op. Do **not** dedupe on a transport/sequence number alone — reconnects renumber.
- **Make the write idempotent.** Insert the fill keyed on `exec_id` with a unique constraint; a duplicate insert is a caught conflict, not a second row.
- **Preserve ordering per order.** Apply an order's events in sequence (partition/key the stream by `order_id`) so a fill can't be applied before its placement.
- **Emit trade events exactly once.** The downstream trade/position update also keys on the business id so replays fold to the same state.

**Engineer angle:** this is the idempotency + per-key ordering theme applied to the front office. "At-least-once delivery" is the norm, so the consumer *must* be idempotent — exactly-once is idempotency + dedupe, not magic. See the System Design primer on delivery semantics and keyed partitioning.

### Q15. Model an order that gets amended or cancelled without losing history.

Never mutate the order row. Represent amends and cancels as **new events** in the order's stream:

```
order_event (order_id, seq, event_type, ...)
  1  PLACED      qty 1000 @limit 50
  2  PARTIAL_FILL 400 @49.98
  3  AMEND        limit 50 → 49.99      (reduce/replace remaining)
  4  CANCEL       remaining 600 cancelled
```

- An **amend** is an event that changes the working order's terms going forward; earlier fills stand untouched.
- A **cancel** is an event that closes the remaining unfilled quantity; already-executed fills remain real trades.

Current terms and state are derived by folding the stream up to the latest event.

**Engineer angle:** this is the compensating-event pattern — corrections add events, they don't rewrite the past. It preserves the full audit trail (what the order was, what changed, when, by whom), which is regulatory. A destructive `UPDATE order SET limit_price=...` would erase that history and make the executed-before-amend fills unexplainable. Same discipline as booked-trade corrections elsewhere: never silently overwrite.

### Q16. Design the capture path from FIX order entry to a booked trade event.

End-to-end, event-shaped, at interview altitude:

- **Ingest** — accept FIX `NewOrderSingle`/`ExecutionReport` messages at the gateway; resolve the symbol to your canonical `instrument_id` at the edge (security-master resolution), reject unresolvable symbols.
- **Persist orders and fills append-only** — write the order (intent) once; append each execution report as an immutable fill/event, deduped by execution id (idempotency on a business key).
- **Derive order state** — filled/partial/cancelled as a fold over the fill events, not a mutable status.
- **Book the trade** — when fills complete (or per fill, per booking convention), emit an immutable **trade event** carrying instrument, side, qty, avg price (exact decimal), counterparty, timestamps.
- **Publish per-instrument/per-portfolio** — key the trade-event stream so downstream position-keeping preserves order per key and scales across keys.

The output is a clean, immutable trade event.

**Engineer angle:** this stage is a *producer* of the immutable events the rest of the platform consumes. The invariants — resolve to canonical id at the edge, append-only, idempotent on business keys, exact-decimal money, keyed ordering — are the same ones that recur in position-keeping, reconciliation, and settlement. The trade event you emit here is the exact input the next topic (Clearing & Settlement) takes through to the actual exchange of cash and securities. See the System Design primer for the streaming/CQRS backbone.

## Trade Lifecycle: Clearing & Settlement

### Summary

**What this topic covers**

The post-trade half of a trade's life: everything that happens *after* the done deal is booked, up to the point money and securities actually change hands. This topic covers **confirmation** (both sides agree the economics), **clearing** (a **CCP** nets and guarantees the obligations), **settlement** (the actual exchange of cash for security, under **DVP**), and **custody** (who holds the assets). It covers the settlement timelines (**T+1**, **T+2**), the two failure modes engineers must not conflate — a **FAIL** (the trade didn't settle on time) versus a **BREAK** (two systems' records disagree) — the role of **netting**, and the post-trade data flow modelled as an explicit **state machine**. The 15 questions run from warm-ups ("what does T+2 mean," "trade date vs settlement date") through the who's-who of clearing (CCP, custodian) to modelling exercises ("design the settlement state machine," "model fails and breaks") and the recurring senior theme: *settlement status is a state machine, not a boolean*.

**Mental model**

The key shift from the front office: **a trade being done is not the same as a trade being settled.** Execution creates an *obligation* — you owe cash, they owe securities — and the post-trade lifecycle is the machinery that discharges it. Read it as a pipeline of state transitions: `executed → confirmed → cleared → settled`, with `failed` as a branch, not an endpoint. **Confirmation** is both counterparties agreeing on what was traded. **Clearing** interposes a central counterparty (CCP) that becomes buyer to every seller and seller to every buyer, nets everyone's obligations down, and guarantees them (so one party's default doesn't cascade). **Settlement** is the actual, simultaneous swap of cash for securities — **delivery-versus-payment (DVP)** ensures neither leg happens without the other, killing the risk of paying and getting nothing. It all takes *days* (T+1/T+2 on business-day calendars), so at any instant you have many trades in-flight in different states. The engineer's job is to model those states *explicitly* — because "did this settle?" is a question with five answers, not two.

**Key terms**

- **Confirmation** — both counterparties agree the trade's economics (instrument, qty, price, dates) before settlement.
- **Clearing** — the process, run through a **CCP**, of netting and guaranteeing obligations between execution and settlement.
- **CCP (central counterparty)** — a clearing house that becomes buyer to every seller and seller to every buyer, nets exposures, and guarantees settlement.
- **Settlement** — the actual exchange of cash for securities that discharges the obligation.
- **DVP (delivery-versus-payment)** — settlement mechanism where delivery of securities and payment of cash happen simultaneously, or neither does.
- **Custodian** — the institution that holds your securities and cash and effects settlement on your behalf.
- **T+1 / T+2** — settlement occurs 1 or 2 *business* days after trade date.
- **Netting** — collapsing many gross obligations into one net amount per counterparty/instrument.
- **FAIL** — a trade that did not settle on its due date (securities/cash didn't move).
- **BREAK** — a mismatch between two systems' records of the same trade/position.
- **Settlement date** — the date the exchange is due, distinct from the trade (execution) date.

**Why interviewers ask this**

Post-trade is where "trade done = finished" beginners get exposed. A junior candidate models settlement as a boolean `settled` flag; a senior candidate models an explicit **state machine** with a `failed` branch and knows that on any given day a large fraction of trades are mid-flight in intermediate states. The **FAIL vs BREAK** distinction is a precise false-friend test: they sound similar and mean completely different things (a real-world settlement failure vs a data disagreement between systems), and conflating them means your ops tooling routes the wrong problem to the wrong team. Interviewers also probe whether you understand *why* clearing exists (counterparty risk, netting) and *why* T+2 needs a holiday calendar rather than `+ 2 days`. For any post-trade, ops, clearing, or custody-adjacent engineering role this is bread-and-butter competence.

**Common confusions**

- **Trade done = settled.** No. Execution creates an *obligation*; settlement (days later) discharges it. Status is a state machine, not a boolean.
- **FAIL = BREAK.** A **fail** is a real-world event (the trade didn't settle on time); a **break** is a data disagreement (two systems' records don't match). Different problems, different owners.
- **T+2 = trade date + 2 calendar days.** It's *business* days — needs a holiday calendar per market, not `INTERVAL '2 days'`.
- **Clearing = settlement.** Clearing (net + guarantee) happens *before* settlement (the actual exchange). They're distinct stages.
- **The CCP is a party you chose to trade with.** The CCP *interposes itself* after execution; it becomes your counterparty for clearing so you no longer face the original party's default risk.
- **Custodian = broker.** A broker *executes* orders; a custodian *holds* assets and *settles*. Different roles.

**What follows from this topic**

This topic closes the trade lifecycle that Order-to-Execution opened: the immutable trade event born in the front office is the input here, taken through to the actual movement of cash and securities. The **BREAK** introduced here is the exact object the Reconciliation work exists to detect and resolve — recon is the JOIN+DIFF that surfaces breaks between your records and a custodian/counterparty feed. The explicit **state-machine** modelling, the never-mutate/append-only discipline, and the business-day/exact-money concerns all connect to the event-sourcing, audit-trail, and money-handling themes that run through the whole primer. Settlement is also where **custody**, **nostro/vostro** cash accounts, and DVP tie into the treasury and ledger topics.

### Q1. Walk through the post-trade lifecycle from execution to settlement.

Four stages after the trade is born:

```
Executed ──► Confirmed ──► Cleared ──► Settled
(done deal) (both agree)  (CCP nets   (cash ⇄ securities
                          + guarantees)  actually move, DVP)
                                   └──► Failed (didn't settle on time)
```

1. **Confirmation** — both counterparties agree the economics (instrument, quantity, price, settlement date). No agreement, no progress.
2. **Clearing** — a **CCP** steps between the parties, nets obligations, and guarantees settlement, removing direct counterparty-default risk.
3. **Settlement** — on the settlement date (T+1/T+2), cash and securities actually change hands, simultaneously under **DVP**.
4. A trade can **fail** at settlement if a leg doesn't move on time — a branch, not the end.

**Engineer angle:** the whole thing takes *days*, so at any moment you're holding a population of trades in different states. That's why you model this as an explicit state machine with transitions and a failure branch — not a `settled` boolean. The trade event itself (from the previous topic) is immutable; the *settlement status* is the evolving read model layered on top.

### Q2. What does T+2 actually mean, and why can't you compute it with "+2 days"?

**T+2** means settlement is due **2 business days after the trade date** (T). Many markets have moved to **T+1** (one business day). It's the gap between when you *agree* the trade and when cash and securities actually move.

You can't compute it as `trade_date + INTERVAL '2 days'` because:

- It's **business** days, so it skips weekends.
- It must skip **market holidays**, which differ per country/exchange.
- Cross-border trades may involve *two* holiday calendars.

`2026-07-03` (Friday) + 2 business days is not `2026-07-05` (Sunday) — it's the next Tuesday, and later still if Monday is a holiday.

**Engineer angle:** settlement-date calculation needs a **holiday calendar** service keyed by market, never naive date arithmetic. Getting it wrong misdates settlement, triggers spurious fails, and corrupts cash projections. This is the classic "business days need a calendar" gotcha.

### Q3. What is the difference between clearing and settlement?

They're sequential, distinct stages people conflate:

- **Clearing** — the *preparation*: a CCP nets each party's obligations down to a single figure per counterparty/instrument and *guarantees* them. No cash or securities move yet; this is about determining and de-risking *what* is owed.
- **Settlement** — the *execution*: the actual, final exchange of cash for securities that discharges the obligation, on the settlement date.

Analogy: clearing is agreeing and guaranteeing the bill and working out the net; settlement is the money and goods actually changing hands.

**Engineer angle:** they are separate states in your lifecycle state machine (`cleared` precedes `settled`). Modelling them as one step means you can't represent a trade that's cleared-but-not-yet-settled — which is *every* trade for a day or two. Keep the transition explicit so ops can see exactly where a trade is stuck.

### Q4. What is a CCP and why does clearing through one reduce risk?

A **CCP (central counterparty)** is a clearing house that **interposes itself** between the two sides of a trade after execution: it becomes the buyer to every seller and the seller to every buyer (a process called novation).

Two risk benefits:

- **Counterparty-default insulation** — you no longer face the original counterparty's default risk; you face the CCP, which guarantees settlement. If the far side defaults, the CCP still makes you whole.
- **Netting** — because the CCP faces everyone, it can net each member's many obligations down to a single net figure per instrument, drastically shrinking how much actually needs to move.

The CCP manages the residual risk with **margin/collateral** posted by members and a default fund.

**Engineer angle:** for you the CCP changes *who the counterparty is* on cleared trades (it's the CCP, not the original party) and introduces margin obligations you track. Model the counterparty on a cleared trade as the CCP, and keep the original executing party as a separate attribute — they're different roles. Connects to the counterparty and collateral topics.

### Q5. What is DVP and what risk does it eliminate?

**DVP (delivery-versus-payment)** is a settlement mechanism where the **delivery of securities and the payment of cash happen simultaneously — or neither happens.** The two legs are atomically linked.

The risk it eliminates is **principal risk** (a.k.a. Herstatt / settlement risk): the danger that you *pay* and don't *receive*, or *deliver* and don't get *paid*. Without DVP, one leg could complete while the other fails, and you're out the full principal. DVP makes settlement all-or-nothing.

**Engineer angle:** DVP is a **distributed-atomicity** requirement in business form — the cash leg and the securities leg must commit together. It's the finance analogue of a two-phase, all-or-nothing transaction across two ledgers (cash and securities). When you model settlement, the two legs are not independent updates you fire-and-forget; they're a linked unit that both complete or both roll back. This is why settlement is a coordinated state transition, not two separate writes — see the System Design primer on sagas/atomic commit.

### Q6. Confirmation vs clearing vs settlement — define each precisely.

| Stage | What happens | Moves money? |
|---|---|---|
| **Confirmation** | Both counterparties agree the trade's economics (instrument, qty, price, dates) | No |
| **Clearing** | A CCP nets obligations and guarantees them | No |
| **Settlement** | Cash and securities actually change hands (DVP), discharging the obligation | **Yes** |

The progression is *agree → de-risk & net → exchange*. Confirmation resolves "do we both think we did the same trade?"; clearing resolves "what's the guaranteed net owed?"; settlement resolves "the assets actually moved."

**Engineer angle:** three distinct states, three distinct transitions in your lifecycle model. Each is an append-only state change on the (immutable) trade, never an overwrite. The false-friend risk is treating them as synonyms for "processing the trade" — they're specific, ordered, and each can stall (an unconfirmed trade can't clear; an uncleared trade can't settle). Model the ordering so a stuck trade's exact stage is queryable.

### Q7. FAIL vs BREAK — what's the difference and why does it matter?

They sound alike and are completely different problems:

- **FAIL** — a **real-world settlement event**: the trade did *not* settle on its due date because a leg didn't move (the counterparty didn't deliver securities, or cash wasn't there). The trade is real and agreed; the *movement* failed.
- **BREAK** — a **data disagreement**: two systems' records of the same trade/position don't match (yours says qty 1000, the custodian's feed says 900). Nothing may have failed in the real world — your *records* disagree.

Why it matters: they route to different teams and have different fixes. A **fail** is a settlements/ops problem — chase the counterparty, arrange the movement. A **break** is a data/reconciliation problem — figure out which system is wrong and why.

**Engineer angle:** they're different entities in your tooling. A fail is a *status* on a trade in the settlement state machine (`failed`). A break is an *output of reconciliation* — an unmatched/mismatched item between two feeds. Conflating them means your dashboards and alerts send the wrong problem to the wrong desk. Keep them distinct in the model.

### Q8. What is netting and why does it matter to your system?

**Netting** collapses many gross obligations into a single net figure per counterparty (and often per instrument/currency). If you owe a counterparty 100 and they owe you 70, netting settles a single payment of 30 instead of two gross payments.

Why it matters:

- **Less movement** — far fewer, smaller cash/securities transfers, reducing settlement risk and cost.
- **Lower exposure** — net obligations mean smaller in-flight amounts at risk.
- **CCP core function** — multilateral netting across all members is a primary reason CCPs exist.

**Engineer angle:** netting changes the *grain* at which you settle. Your model must distinguish **gross** trade-level obligations (what you booked, immutable) from the **net** settlement obligation (a derived aggregate per counterparty/instrument/date). The net figure is *computed*, not a source of truth — a fold over the gross obligations, exactly like a position is a fold over trades. Keep both: gross for audit and per-trade tracing, net for what actually settles.

### Q9. Design the settlement state machine.

Model settlement status as explicit states and transitions on the (immutable) trade, not a boolean:

```
   ┌───────────┐   confirm    ┌───────────┐   clear    ┌─────────┐
   │ EXECUTED  │─────────────►│ CONFIRMED │───────────►│ CLEARED │
   └───────────┘              └───────────┘            └────┬────┘
                                                     settle │  ▲
                                              ┌─────────────▼──┴────┐
                                              │      SETTLED        │
                                              └─────────────────────┘
   any pre-settled state that misses its due date ──► FAILED ──(retry)──► settles later
```

- States: `EXECUTED → CONFIRMED → CLEARED → SETTLED`, with `FAILED` reachable from the pre-settled states and recoverable (a fail can settle late).
- Each transition is an **append-only event** with a timestamp and reason, never an in-place status overwrite.
- Guards: can't clear an unconfirmed trade; can't settle an uncleared one.

**Engineer angle:** this is a saga/state-machine, and the reasons to model it explicitly are the recurring ones — auditability (who moved it, when, why), the ability to answer "what's stuck and where," and correct handling of the `failed` branch (a fail isn't terminal). A boolean `settled` throws away every intermediate state and can't represent a fail that later clears. See the System Design primer on saga/state-machine patterns.

### Q10. Why model settlement status as a state machine instead of a boolean?

Because "did it settle?" genuinely has more than two answers, and the *intermediate* states are operationally critical.

A boolean `settled = true/false` can't tell you:

- **Where** a not-yet-settled trade actually is — confirmed? cleared? never confirmed?
- **Why** it hasn't settled — still in-flight on a normal T+2 timeline, or *failed*?
- **The history** — when it confirmed, when it cleared, when the fail occurred.

And on any given day a large share of your trades are legitimately *mid-flight* — a boolean lumps "settling normally" together with "broken" and hides the difference ops needs.

**Engineer angle:** an explicit state machine gives you queryable status (`WHERE status = 'FAILED'`), correct handling of the fail-then-settle path, and an audit trail of transitions. This is the same "status is not a boolean" lesson as the order lifecycle — model the states that actually exist, record transitions as append-only events, and derive the current state from them.

### Q11. Broker vs custodian vs CCP — who does what?

Three distinct roles that beginners merge:

| Role | Does | When |
|---|---|---|
| **Broker** | *Executes* your orders in the market | Front office (pre-trade) |
| **CCP** | *Nets and guarantees* obligations | Clearing (post-trade) |
| **Custodian** | *Holds* your securities/cash and *effects settlement* | Settlement (post-trade) |

A **broker** gets your order done. The **CCP** interposes to clear it. The **custodian** safekeeps your assets and moves them at settlement.

**Engineer angle:** these are different counterparty *roles* on a trade, and your model should capture them separately — the executing broker, the clearing CCP, and the settling custodian are three different entities (three FKs to your entity/counterparty master, each an LEI). Collapsing them into one "counterparty" field loses information you need for settlement instructions and reconciliation. Connects to the counterparty and custody topics.

### Q12. Design the post-trade data flow from booked trade to settled.

A pipeline of state transitions driven by events and external confirmations:

- **Consume the trade event** — the immutable done deal from the front office (previous topic) enters post-trade in state `EXECUTED`.
- **Confirm** — match your trade against the counterparty's confirmation (economics agree) → `CONFIRMED`; a mismatch here is a **break** routed to recon, not a fail.
- **Clear** — submit to the CCP; on acknowledgement → `CLEARED`; capture the net obligation and any margin call.
- **Generate settlement instructions** — compute the settlement date (business-day calendar) and the DVP legs to the custodian.
- **Settle** — on custodian confirmation that both legs moved → `SETTLED`; if the due date passes without movement → `FAILED`, then retry until it settles.

Every transition is an append-only event; the trade itself is never mutated.

**Engineer angle:** this is a long-running, days-spanning saga with external parties, so it must be **idempotent** (confirmations/acks get redelivered — dedupe on business keys), **durable** (state survives restarts), and **explicitly staged** (so stuck trades are visible). The two settlement legs are DVP-atomic. Cash movements touch the ledger and must be exact-decimal, exactly-once. Same discipline as the rest of the primer: append-only, idempotent, state machine, audit trail.

### Q13. Model settlement fails and breaks in your schema.

Keep them as separate concepts, because they are:

```sql
-- FAIL: a settlement status on the trade's lifecycle (real-world non-settlement)
CREATE TABLE settlement_status (
  trade_id       BIGINT NOT NULL,
  status         TEXT NOT NULL,        -- EXECUTED|CONFIRMED|CLEARED|SETTLED|FAILED
  due_date       DATE,
  reason         TEXT,                 -- e.g. COUNTERPARTY_SHORT_SECURITIES
  changed_at     TIMESTAMPTZ NOT NULL, -- append-only: one row per transition
  PRIMARY KEY (trade_id, changed_at)
);

-- BREAK: an output of reconciliation (a data disagreement between two feeds)
CREATE TABLE recon_break (
  break_id       BIGINT PRIMARY KEY,
  match_key      TEXT NOT NULL,        -- trade_id or instrument+date+qty
  our_value      TEXT,
  their_value    TEXT,                 -- custodian/counterparty feed
  break_type     TEXT,                 -- QTY_MISMATCH|MISSING_OURS|MISSING_THEIRS
  status         TEXT,                 -- OPEN|INVESTIGATING|RESOLVED
  aged_days      INT
);
```

- A **fail** lives on the trade's settlement lifecycle (append-only transitions).
- A **break** lives in reconciliation output, keyed on a match key, with both sides' values.

**Engineer angle:** two tables because two owners and two workflows — settlements ops chase fails; data/recon ops resolve breaks. A fail may *cause* a break (your books say settled, custodian says not) or vice versa, but they're distinct records you can link, not one field. This sets up the Reconciliation topic directly.

### Q14. How does settlement connect to the ledger and custody?

Settlement is where the trade finally hits **cash and securities balances**, held at the **custodian**:

- **Securities leg** — the custodian moves the instrument into (buy) or out of (sell) your holdings; your securities position at the custodian changes.
- **Cash leg** — the corresponding cash moves out of / into your cash account (often a **nostro** account in the settlement currency), simultaneously with the securities under **DVP**.
- **Custody** — the custodian is the system of record for what you actually *hold*, which is exactly what you later **reconcile** your internal records against.

**Engineer angle:** the settled trade produces **double-entry** ledger postings (the cash leg debits/credits balance against the securities leg), and both must be exact-decimal with the currency stored. Because the custodian holds the real assets, your internal settled-position is a *claim* you must prove correct by reconciling against the custodian feed — which is why breaks exist. Connects settlement to the treasury/ledger and reconciliation topics: settlement is the event; the ledger records it; recon proves it.

### Q15. Design a system to track and chase settlement fails across many custodians.

A fails-management system for ops:

- **Ingest settlement status** per trade from each custodian feed (they report what settled and what didn't), normalising differing custodian conventions to your internal shape — resolving their instrument symbology to your canonical id.
- **Drive the state machine** — mark trades `SETTLED` or `FAILED` on the due date from custodian confirmation; a fail is a status transition (append-only), with a reason where the custodian supplies one.
- **Age the fails** — compute days-outstanding per failed trade; aged-fail reports are the ops work queue.
- **Idempotent, per-trade ordering** — custodian confirmations get redelivered, so dedupe on a business key (trade/settlement id); apply a given trade's status events in order so a late `settled` can't be overtaken by a stale `failed`.
- **Route and dashboard** — surface open fails by custodian/counterparty/age; link any associated recon **breaks** so ops see whether it's a real fail or a data disagreement.

**Engineer angle:** it's an **event-driven state machine over multiple noisy external feeds** — the recurring finance-systems shape. Idempotent ingestion, per-entity ordering, explicit states with a recoverable `FAILED` branch, and a full audit trail of transitions. It sits right next to reconciliation (fails vs breaks) and consumes the security master (symbology) and settlement model built in this topic. See the System Design primer for idempotent ingestion and state machines.
## Positions, PnL & NAV

### Summary

**What this topic covers**

This is the single most important topic in the primer for an engineer, because it is where the domain's three-way distinction between **event**, **derived state**, and **aggregate** becomes a concrete data-modelling decision you will get wrong if you don't internalise it. The 16 questions here cover: the trade/position/balance trichotomy (a **trade** is an immutable event, a **position** is derived state — a fold over trades, a **balance** is a point-in-time aggregate); why a position is *computed, not stored as truth*; the event-sourcing / CQRS shape that follows from that; **realized vs unrealized PnL** and why one of them changes with zero trades; **mark-to-market** and why you must store the mark's source and timestamp; and **NAV** (net asset value) as an end-of-day struck number. Everything downstream — reconciliation, treasury, risk reporting — reads off the position and PnL your system computes, so the invariants you choose here propagate everywhere.

**Mental model**

Hold three boxes in your head and never let them merge. Box one: **trades** — immutable, append-only facts. "alice bought 100 ACME at 10 on 2026-06-01" happened; it is a row you never UPDATE. Box two: **position** — the *fold* of all trades for one `(instrument, portfolio)`: net quantity and average cost. It is a function of the trade log, not an independent source of truth. If you ever store a position and mutate it in place, you have thrown away your ability to rebuild, audit, or answer "as of last Tuesday". Box three: **balance** — the value of that position (or of cash) at one instant `t`, which needs a *price* as well as the trades. The engineer's reflex: the trade log is the source of truth; position and balance are read models you can always regenerate by replaying the log. Snapshots exist purely to bound replay cost — snapshot + delta, not full history. This is textbook event sourcing; the domain just calls the events "trades" and the fold "position-keeping".

**Key terms**

- **Trade** — an immutable event: a done deal (buy/sell, qty, price, instrument, time). Append-only; never mutated.
- **Position** — derived net holding for one `(instrument, portfolio)`: net qty + average cost. Computed by folding trades.
- **Balance** — a point-in-time aggregate (cash or quantity) at instant `t`; a snapshot, not an event.
- **Long / short** — sign of the position: long = positive (own it), short = negative (sold-borrowed).
- **Average cost** — the cost basis of an open position; the running weighted-average price paid, used to compute realized PnL on a sale.
- **Realized PnL** — profit/loss locked in by *closing* (selling down) a position; a function of trades only.
- **Unrealized PnL** — paper profit/loss on an *open* position at the current mark; a function of position **and** price feed.
- **Mark / mark-to-market (MtM)** — revaluing an open position at a current market price ("the mark").
- **The close / closing price** — the official end-of-day price used to strike marks and NAV.
- **NAV (net asset value)** — assets minus liabilities, per fund/portfolio; typically struck once daily after the close.
- **Lot / tax lot** — an individual purchase parcel kept separately for cost-basis accounting (FIFO/LIFO/specific-lot).
- **As-of query** — "what was the position as it stood at time T", answered by replaying events up to T.

**Why interviewers ask this**

This topic is the fastest way to tell a candidate who has *built* a financial system from one who has only read about one. The junior answer treats position as a column you increment: `UPDATE positions SET qty = qty + 100`. The senior answer treats position as a projection of an immutable event log and can explain *why* — auditability, as-of queries, correction-via-compensation, replayability after a bug. If asked "realized vs unrealized PnL", the junior blurs them; the senior notes that unrealized PnL moves every tick with **zero trades** because it depends on the price feed, which immediately implies your PnL number is only as trustworthy as the mark you stamped on it. For fintech and finance-eng roles this is the load-bearing competency: get the event/derived/aggregate distinction right and the interviewer trusts you with the ledger; get it wrong and nothing else you say lands.

**Common confusions**

- "Position is a stored value I mutate." No — position is *derived*. Storing it as mutable truth destroys audit and as-of. Store trades; fold to position; snapshot only to bound replay.
- "Balance and position are the same thing." A position is a holding (qty + cost); a balance is that holding valued at an instant, and needs a price. Cash has a balance too.
- "PnL is one number." Realized (from trades) and unrealized (from marks) are different, computed differently, and change at different times.
- "NAV is real-time." NAV is normally *struck* once a day after the official close; it's a scheduled batch, not a live ticker.
- "Same position, same PnL." False — PnL depends on *which* mark price you used. Store the price's source and timestamp, or your number is unreproducible.
- "To fix a bad trade, UPDATE the row." Never. Post a compensating/reversing event so the original and the correction both survive.

**What follows from this topic**

Positions and PnL are the numbers everything else checks or moves against. **Counterparties, Custody & Reconciliation** exists to *prove* your computed positions match an external custodian's — recon is a join+diff between your fold and their books. **Treasury, Cash & Payments** treats cash as just another position/ledger with the same event-vs-aggregate discipline. The event-sourcing, idempotency, and per-portfolio-ordering patterns previewed here are the backbone of any real-time position-keeping service. If the trade/position/balance distinction is fuzzy, fix it before anything else — every later topic silently assumes it.

### Q1. Explain the difference between a trade, a position, and a balance.

They live at three different levels and conflating them is the classic domain bug.

| Concept | Nature | Engineer's view |
|---|---|---|
| **Trade** | Event | Immutable fact; append-only row |
| **Position** | Derived state | Fold/reduce over trade events (net qty, avg cost) |
| **Balance** | Point-in-time aggregate | Value/quantity at instant `t` (needs a price for value) |

A **trade** is something that *happened*: "bought 100 ACME at 10". You never change it. A **position** is the running net of all trades for one `(instrument, portfolio)` — after `+100`, `+50`, `-30` you hold 120. It is *computed*, not a source of truth. A **balance** is a snapshot at an instant — your cash balance right now, or your ACME quantity as of yesterday's close.

The engineer's takeaway: only trades are stored as truth. Position is a projection you can always rebuild by replaying trades; balance is that projection sampled at a time. Model position/balance as writable columns and you've thrown away audit, as-of queries, and replay.

### Q2. Why is a position "derived state" and not something you store as truth?

Because the trade log already *is* the truth, and the position is a pure function of it. Anything you can recompute, you should be able to recompute — and in finance you're legally required to.

Three concrete reasons:

- **Auditability.** Regulators and auditors ask "how did this holding come to be?" If you stored only the current number and mutated it, you can't answer. If you stored the trades and folded them, the answer is the log.
- **As-of / point-in-time.** "What was the position on 2026-05-31?" is trivial if you replay trades up to that date, and impossible if you overwrote a single row.
- **Correctness after bugs.** If your fold had a bug, you fix the code and re-fold. If you'd mutated a stored position, the bad value is baked in with no way back.

So you keep trades append-only and treat position as a **materialised read model** (event sourcing / CQRS). You may *cache* the current position for speed — but the cache is derived, regenerable, and never the source of truth.

### Q3. Walk through computing a position as a fold over trade events.

A position is `reduce(trades, seed)` where the seed is a flat, empty holding and each trade updates net quantity and average cost.

```
trades for (ACME, portfolio-1), in order:
  +100 @ 10   ->  qty 100, avg cost 10
  +50  @ 11   ->  qty 150, avg cost (100*10 + 50*11)/150 = 10.333...
  -30  @ 12   ->  qty 120, avg cost 10.333... (sells don't change avg cost;
                                               they realize PnL instead)
```

Buys move the weighted-average cost; sells reduce quantity and *realize* PnL against the average cost, leaving the cost basis of the remainder unchanged (under average-cost accounting).

```sql
-- the fold, as a query over the immutable trade log
SELECT instrument_id,
       SUM(signed_qty)                              AS net_qty,
       SUM(signed_qty * price) / NULLIF(SUM(signed_qty),0) AS avg_price
FROM trades
WHERE portfolio_id = 'portfolio-1'
GROUP BY instrument_id;
```

The engineer angle: this is a `GROUP BY` today, but at scale you don't re-fold all history on every read — you keep a **snapshot** (position as of last night) and fold only *today's* delta on top. `snapshot + delta` is `O(delta)`, not `O(all trades ever)`.

### Q4. Realized vs unrealized PnL — what's the difference, and which one changes with zero trades?

**Realized PnL** is profit/loss you *locked in* by closing part of a position — it's a function of trades only. Sell 30 ACME at 12 that you hold at average cost 10.33, and you realize `30 * (12 - 10.33)` regardless of what the price does afterwards.

**Unrealized PnL** is the paper gain/loss on the *open* position at the current mark: `open_qty * (mark_price - avg_cost)`. It is a function of your position **and** the price feed.

The one that moves with **zero trades** is unrealized PnL — it changes every time the price ticks, even though you did nothing. That single fact has a big engineering consequence: your PnL number is only as good, and as reproducible, as the mark you used. Two systems can hold identical trades and report different unrealized PnL purely because they marked at different prices or times. So you never store a bare PnL number — you store (or can reconstruct) the position, the mark price, its source, and its timestamp.

### Q5. What is mark-to-market, and what must you store besides the number?

Mark-to-market (MtM) is revaluing your open positions at a current market price — "marking" the book. `market_value = qty * mark_price`; unrealized PnL falls out of that against average cost.

The trap: a mark price is not a fact of nature, it's a *choice*. Which venue? Which snapshot — last trade, mid, official close? What time? Two defensible marks give two different PnLs and two different NAVs for the identical position.

So the rule is: **never store just the marked value — store the mark's provenance.**

```json
{
  "instrument_id": "ACME",
  "mark_price": 12.05,
  "source": "EXCHANGE_X_CLOSE",
  "as_of": "2026-06-30T21:00:00Z",
  "quantity": 120,
  "market_value": 1446.00
}
```

With source + timestamp you can reproduce, audit, and reconcile the number. Without them, someone asks "why was PnL 1446 and not 1450?" and you have no answer. This is the *accept-and-reconcile* discipline: stamp the price and time you used, proceed, and resolve disagreements downstream.

### Q6. What is NAV and how does its timing shape the system that computes it?

**NAV (net asset value)** is assets minus liabilities for a fund or portfolio — essentially the total value of everything the fund holds, marked, minus what it owes. For a fund with units, NAV per unit is what investors buy and redeem at.

The key operational fact: NAV is usually **struck once a day, after the official close**, using closing prices. It's a scheduled end-of-day batch, not a real-time ticker. That shapes the system:

- It's a **batch job** with a defined cutoff ("the close"), not a streaming aggregate. You need a clear answer to "what is *the* close price" — official closing print per instrument, from a designated source.
- It must be **reproducible**: the same trades + the same closing marks must always yield the same NAV, so you snapshot the exact marks used.
- Intraday you may serve an *estimated* NAV off live prices, but the *struck* NAV is the end-of-day one that's booked and reported.

Engineer angle: separate the two read paths (CQRS) — a real-time estimated view off the live feed, and a batch-struck official NAV off the close snapshot. Don't pretend a live number is the official one.

### Q7. How would you design a real-time position-keeping service from a trade event stream?

Restate: consume a stream of trade events and maintain current positions per `(portfolio, instrument)`, queryable in real time and rebuildable.

Core design:

- **Source of truth = the append-only trade log.** The service maintains positions as a **materialised read model** (a fold), never as independent truth.
- **Partition the stream by `portfolioId`.** Trades within a portfolio must be applied in order (a buy then a sell can't reorder); different portfolios are independent and process in parallel. Keying by portfolio preserves per-key order and scales throughput across keys.
- **Idempotency on a business key.** The stream is at-least-once, so the same trade can arrive twice. Dedupe on the *source trade id* (a business key), persist seen keys, and no-op on replay — never double-book.
- **Snapshots to bound replay.** Periodically persist each position; on restart or as-of query, load snapshot + replay only the delta.
- **Corrections are compensating events**, never mutations — a cancel or amend is a new event, preserving the audit trail.

```
trade stream (keyed by portfolioId)
        │  at-least-once, in-order per key
        ▼
 [dedupe on source_trade_id] ──► [fold into position] ──► position read model
        │                                                        ▲
        └── periodic snapshot ───────────────────────────────────┘
```

Engineer angle: this is event sourcing with domain vocabulary — immutable events, keyed ordering, idempotent apply, snapshots, compensation.

### Q8. How do you support "as-of" / point-in-time position queries?

An as-of query answers "what was the position as it stood at time T" — not "now". You get it for free *if* you kept the events and never mutated derived state.

Two building blocks:

- **Replay to T.** Fold trades whose effective time `<= T`. Because trades are immutable, this is deterministic and repeatable.
- **Snapshot + delta.** Replaying all history for every as-of query is `O(history)`. Keep periodic snapshots (position as of each night's close) and replay only from the nearest snapshot before T. Cost becomes `O(delta)`.

A subtlety: there are *two* time axes. **Effective/trade time** (when the trade economically happened) and **system/knowledge time** (when your system learned about it). A trade booked late — learned today, effective last week — means "the position as we understood it last week" differs from "the position as we now know it was last week". That's **bitemporal** modelling. Most correct as-of systems track both, so a late correction doesn't silently rewrite history.

Engineer angle: as-of is not "last-write-wins with a WHERE clause" — it's replay over an immutable, ideally bitemporal, log.

### Q9. Spot the domain bug: `UPDATE positions SET qty = qty - 30 WHERE instrument = 'ACME'` when a sale settles.

Multiple bugs, all stemming from treating a derived aggregate as writable truth.

1. **You're mutating derived state.** Position should be the fold of trades, not a directly-updated column. The moment you `UPDATE` it, it can drift from the trade log and you lose the ability to rebuild or audit.
2. **No portfolio scope.** `WHERE instrument = 'ACME'` hits ACME across *every* portfolio. Positions are per `(instrument, portfolio)`.
3. **No idempotency.** If the sale event is redelivered, you subtract 30 twice. There's no business-key dedupe.
4. **No realized-PnL capture.** A sale realizes PnL against average cost; this update silently drops that.
5. **No audit trail.** The prior quantity is gone; a regulator can't reconstruct it.

The fix: **append a trade event** (`-30 ACME @ price, portfolio-1, source_trade_id=…`), dedupe on the source id, and let the position fold recompute — realizing PnL against average cost as part of the fold. Never `UPDATE` a position; you *insert an event* and re-derive.

### Q10. Average-cost vs FIFO/lot accounting — what's the difference and why does it matter to your schema?

Both answer "what was the cost basis of the shares I just sold?", which drives realized PnL and tax — but they track it differently.

- **Average cost** keeps a single weighted-average price for the whole holding. Sell 30 and you realize against that one average. Simple: your position row needs `net_qty` + `avg_cost`.
- **FIFO / lot accounting** keeps each purchase as a separate **lot** (parcel). A sale consumes lots oldest-first (FIFO) — or a specific lot ("specific identification"). Realized PnL depends on *which* lots you relieved.

The schema consequence is real: average cost is one aggregate row; lot accounting needs a **lot table** — each buy creates a lot, each sell *relieves* lots and records which lots were consumed, so you can reconstruct cost basis per lot.

```
positions (avg cost):   (portfolio, instrument, net_qty, avg_cost)
lots (FIFO/specific):   (lot_id, portfolio, instrument, open_qty, remaining_qty, cost, opened_at)
lot_relief:             (sell_trade_id, lot_id, qty_relieved, realized_pnl)
```

Engineer angle: the accounting method is a domain requirement that changes your data model — you can't retrofit lot-level cost basis onto an average-cost design, because the lot history was never stored. Ask which method up front.

### Q11. Why store the price source and timestamp with every mark, not just the price?

Because a mark is a *decision*, not a fact, and finance systems must reproduce every number they ever reported.

The same open position produces different PnL and NAV depending on which price you marked it at — last trade vs mid vs official close, venue A vs venue B, 20:59 vs 21:00. If you store only `mark = 12.05`, and next week someone asks "why was unrealized PnL 1446?", you cannot answer or reproduce it. If you store `{price: 12.05, source: EXCHANGE_X_CLOSE, as_of: 2026-06-30T21:00Z}`, you can.

This is the same **provenance/lineage** principle that governs the whole domain: every figure must trace back to its source inputs. It also makes reconciliation possible — if your NAV and the administrator's NAV differ, the first question is "which marks did each of us use?", answerable only if both sides stamped source + time.

Engineer angle: treat `(source, as_of)` as mandatory columns on every price you consume, not optional metadata. A price without provenance is unreconcilable and unauditable.

### Q12. How do corrections and trade amendments work without breaking the audit trail?

You never edit history — you append to it. A booked trade is immutable; a correction is a *new event* that offsets or supersedes the original.

Three common shapes:

- **Cancel / reversal** — append an equal-and-opposite event (a compensating event) that nets the original to zero. The original and the reversal both survive.
- **Amend** — model as cancel-then-rebook, or as an amendment event that references the original trade id and carries the new economics.
- **Never `UPDATE`** the original row. The whole point is that "what did we book, and what did we later correct it to?" must both be answerable.

```
book:    trade_id=T1  +100 ACME @ 10
correct: trade_id=T2  reverses T1        (compensating event)
rebook:  trade_id=T3  +100 ACME @ 10.50  (references T1)
```

The position fold naturally absorbs this: it just folds the extra events, and the net is correct. Because everything is additive and append-only, the audit trail is intact and as-of queries before and after the correction both return the right answer for their point in time.

Engineer angle: this is the *never-silently-correct* pattern — mutation destroys history; compensation preserves it.

### Q13. What does "long" vs "short" mean, and how does it show up in the position data model?

**Long** means you own it (or bet it goes up); **short** means you sold something you borrowed (or bet it goes down). Crucially, long/short is *direction*, not time horizon — a "short" position can be held for months.

In the data model, direction is just the **sign of the net quantity**:

- Long ACME = positive net qty (`+120`).
- Short ACME = negative net qty (`-120`).
- Flat = zero.

This is why you keep quantities **signed** and let the fold produce a signed net, rather than tracking "buys" and "sells" as separate positive buckets. A buy is `+qty`, a sell is `-qty`; sum them and the sign tells you the direction.

Two engineer gotchas:

- Unrealized PnL flips sign logic: a short position *gains* when price falls (`qty` is negative, so `qty * (mark - cost)` still comes out right if signs are consistent — which is exactly why signed quantities are safer than special-casing).
- "The book" being long or short overall is just the aggregate sign across positions — the book is a *portfolio*, not a ledger table.

### Q14. Design an end-of-day NAV/PnL calc that's also queryable intraday.

Restate: produce the official struck NAV after the close, and also serve a live intraday view, from the same positions.

The tension is *batch official number* vs *live estimate*. Resolve it with CQRS — two read models over the same trade log:

- **Official NAV (batch).** After the official close, snapshot the closing marks per instrument (with source + timestamp), fold trades up to the cutoff, value at those marks, subtract liabilities → struck NAV. This number is booked, reproducible, and reported. It's a scheduled job with a hard cutoff ("the close").
- **Estimated NAV (intraday).** Off the live price feed, continuously revalue the current positions for an *indicative* number. Clearly labelled estimated — it uses live marks, not the official close.

```
trade log ──► position fold ──┬─► [close snapshot marks] ─► OFFICIAL NAV (batch, struck EOD)
                              └─► [live feed marks]       ─► ESTIMATED NAV (intraday, indicative)
```

Key decisions to surface: what *is* "the close" (which venue's official print, what cutoff time); as-of semantics so a late trade correction re-strikes cleanly rather than silently mutating a booked NAV; and storing the exact marks used so the official number is reproducible forever.

Engineer angle: don't let the live number masquerade as the official one — different marks, different guarantees, different consumers.

### Q15. Two systems have identical trades but report different unrealized PnL. What's the likely cause?

Almost certainly **different marks**, not different data. Realized PnL comes from trades alone, so with identical trades it should match. Unrealized PnL depends on the *price* applied to the open position, which is a choice each system made independently.

Likely culprits, in order:

- **Different mark source** — one marked at last-trade, the other at mid or at the official close.
- **Different timestamp** — one marked at 20:59, the other at 21:00; the price moved.
- **Different venue** — the same instrument prints slightly different prices on different exchanges.
- **Stale feed** — one system's price feed lagged and it marked at an old price.
- **FX** — for a non-base-currency instrument, a different FX rate (or rate timestamp) applied on conversion.

The diagnosis is only possible because — if both systems were built right — each *stamped the mark's source and timestamp*. The first reconciliation question is "show me the price, source, and time each of you used". If either side stored a bare PnL number, the break is unresolvable.

Engineer angle: this is exactly why provenance on marks is mandatory. Identical trades + different PnL = a mark disagreement, and you can only close it if both sides recorded where their price came from.

### Q16. Why is event sourcing such a natural fit for positions and PnL?

Because the domain's own invariants *are* the event-sourcing rules — the mapping is almost one-to-one.

| Event sourcing concept | Position/PnL domain |
|---|---|
| Immutable event log | Trades — append-only, never mutated |
| Fold / projection | Position — net qty + avg cost from trades |
| Read model (CQRS) | Position/PnL/NAV views, regenerable |
| Snapshot | Position as of last close, to bound replay |
| Compensating event | Trade cancel/amend — never an in-place edit |
| As-of query | Replay events up to time T |

The domain *requires* an immutable audit trail (regulation), *requires* as-of reconstruction (auditors ask "as it stood on date X"), and *requires* corrections that preserve history (never silently overwrite a booked number). Those are precisely what an append-only event log with folded read models gives you.

The one thing to add on top is domain-flavoured discipline: **idempotency on the business trade id** (streams are at-least-once), and **per-portfolio ordering** (order matters within a book, not across books). Get those two right and a position-keeping service is a textbook event-sourced system that happens to speak finance.

## Counterparties, Custody & Reconciliation

### Summary

**What this topic covers**

This topic names the *parties* around a trade and then digs into the workhorse of operations engineering: **reconciliation**. The 16 questions cover who's who — **counterparty** (the other side of your trade), **broker** (executes your orders), **custodian** (holds your securities and cash, settles trades), **prime broker** (bundles financing, custody and execution for funds) — plus the plumbing of **nostro/vostro** accounts. Then the heart of it: **reconciliation** as the act of matching your internal records against an external source (custodian, counterparty, exchange) to *prove they agree*; **breaks** as the unmatched or mismatched items you must chase; **match keys** and **tolerances**; the recon **pipeline** (ingest → normalise → match+diff → matched/broken); and **aged-break** reporting. The recurring engineer insight: reconciliation is fundamentally a **join + diff on imperfect data from two systems** with different conventions — a data-quality problem in business clothing, not arithmetic.

**Mental model**

Think of every external party as a system that keeps *its own* books about the same economic reality you do — and those books will disagree with yours in small, constant, messy ways. Your custodian thinks you hold 119 ACME; you think 120. Someone's records are wrong, or late, or use a different symbology, timezone, or rounding. **Reconciliation is the process of matching the two sets of records to find and explain every disagreement.** As an engineer, stop hearing "reconciliation" as an accounting ritual and start hearing "a `JOIN` between two datasets, followed by a `DIFF` of the matched rows, over data that doesn't share clean keys". The unmatched-or-mismatched rows are **breaks**, and the whole ops function exists to drive breaks to zero. The pipeline is always the same shape: ingest both sides, normalise them into a common shape (this is where the real work is — dates, symbols, signs, scales), match on the best key you have with tolerances, and classify each item as matched or broken. It's the messy-data problem, in business form.

**Key terms**

- **Counterparty** — the other side of your trade: you buy, they sell. Carries credit risk (they might not pay).
- **Broker** — an agent who executes your orders in the market on your behalf.
- **Custodian** — holds your securities and cash safely and settles your trades; your record of holdings should match theirs.
- **Prime broker** — bundles execution, custody, financing and securities-lending for a fund; a fund's central relationship.
- **Nostro account** — "our" account held at another bank, in that bank's currency/location ("our money, over there").
- **Vostro account** — "your" account that we hold on your behalf ("your money, here with us"). Same account, two viewpoints.
- **Reconciliation (recon)** — matching internal records against an external source to prove they agree.
- **Break** — an unmatched or mismatched item surfaced by recon; the thing ops investigates.
- **Match key** — the field(s) you join on: ideally `trade_id`; failing that `instrument + date + qty`.
- **Tolerance** — an allowed small difference (rounding, fees) below which a near-match still counts as matched.
- **Aged break** — a break that has stayed open for N days; tracked and escalated by age.
- **T+0 recon** — same-day/intraday reconciliation, versus overnight batch.

**Why interviewers ask this**

Reconciliation is the single most common thing an operations-engineering team actually builds, so it's a strong "have you done real finance eng?" probe. The junior candidate treats it as an accounting detail and reaches for arithmetic. The senior candidate immediately reframes it as a **fuzzy join + diff over dirty data** and starts talking about match keys, tolerances, symbology normalisation, timezones, sign conventions, duplicate handling, and idempotent ingestion — i.e. exactly the messy-data engineering that dominates the work. Interviewers also use it to test whether you understand *why* recon is even necessary: two independent systems recording the same reality will always drift, and proving they agree (or explaining every difference) is a control requirement, not a nice-to-have. Being crisp on custodian vs broker vs counterparty, and on nostro vs vostro, is a quick fluency check that separates people who've worked near settlements from people who haven't.

**Common confusions**

- "Broker = counterparty = custodian." Three different roles: the broker *executes*, the counterparty is the *other side*, the custodian *holds and settles*. One firm can play several, but the roles are distinct.
- "Nostro and vostro are different accounts." They're the *same* account seen from two sides — nostro is "our account at your bank", vostro is "your account at our bank".
- "Reconciliation is arithmetic." It's mostly *data cleaning and matching* — the hard part is normalising symbols, dates, signs and scales so a join is even possible.
- "A break means someone made a math error." Usually it's a timing, symbology, rounding, sign, or duplicate issue — imperfect data, not bad arithmetic.
- "Match on exact equality." You match on keys with *tolerances*; insisting on exact equality creates false breaks on legitimate rounding.
- "Recon is a one-off nightly job." It's a controlled, idempotent, auditable pipeline that reruns; breaks are aged and tracked over days.

**What follows from this topic**

Reconciliation only makes sense once you accept that **positions are derived** (see **Positions, PnL & NAV**) — recon is literally checking your folded positions and balances against the custodian's. It leans directly on the exact-money and provenance discipline: you can't reconcile amounts stored as floats, and you can't explain a break without the source and timestamp of each figure. And it flows into **Treasury, Cash & Payments**, where the same matching applies to cash — **nostro reconciliation** proves your expected cash movements match what actually hit the bank. Everything here is the join+diff-on-imperfect-data pattern; the next topic applies it to money moving.

### Q1. Who's who: distinguish counterparty, broker, and custodian.

Three distinct roles around a single trade. One firm can wear several hats, but the roles never merge conceptually.

| Party | Role | You care because |
|---|---|---|
| **Counterparty** | The other side of the trade (you buy, they sell) | They carry **credit risk** — they might fail to deliver/pay |
| **Broker** | An agent who *executes* your order in the market | They route/fill your order; you reconcile fills with them |
| **Custodian** | *Holds* your securities & cash and *settles* trades | Your holdings must match their records — the core recon |

A quick way to keep them straight: the **broker acts** (executes), the **counterparty is opposite** (the seller to your buyer), and the **custodian keeps** (holds and settles). When you buy 100 ACME, a broker may execute the order, an anonymous counterparty is the seller, and your custodian receives the shares and pays the cash on settlement.

Engineer angle: each relationship generates a *feed you reconcile against* — broker fills, counterparty confirmations, custodian holdings/cash statements. Your internal records are one side of each recon; the party's statement is the other.

### Q2. What is a prime broker and what does it bundle?

A **prime broker** is a single firm (typically a big bank) that provides a bundle of services to a fund — most importantly financing (lending cash/margin and securities to short), custody, trade execution/clearing, and consolidated reporting.

The point is *consolidation*: rather than a hedge fund maintaining separate relationships with many brokers and custodians, the prime broker sits at the centre, holds the assets, finances the leverage, lends securities for shorting, and hands the fund one consolidated view.

Engineer angle: for a fund, the prime broker's statement is the **primary external record you reconcile against** — it's effectively the custodian feed plus financing and stock-loan activity. That means recon isn't only "do our positions match" but also "do the financing balances, margin, and borrow fees match". More streams, same join+diff pattern. And because the prime broker is one concentrated relationship, it's also a concentrated *credit* and *operational* dependency — worth noting when the interview turns to risk.

### Q3. Explain nostro vs vostro accounts.

They are the **same account seen from two sides** — the confusion is thinking they're different accounts.

- **Nostro** = "*ours*" — our account held *at another bank*, usually in that bank's home currency. From our books: "our money, over there." e.g. our USD account held at Bank X in New York.
- **Vostro** = "*yours*" — an account we hold *on behalf of another bank*. From our books: "your money, here with us."

If we hold a USD account at Bank X, *we* call it our **nostro**; *Bank X* calls that very same account our **vostro** on their books. Nostro and vostro are viewpoints, not distinct pots of money.

Why it exists: to pay in a currency you don't domestically hold, you keep an account at a bank in that currency's jurisdiction (a nostro), and instruct movements through it.

Engineer angle: nostro accounts are what you run **nostro reconciliation** against — matching your *expected* cash movements against the bank statement of what actually moved. It's cash-side recon: same join+diff, keyed on value date + amount + currency + reference. Getting nostro/vostro backwards in a schema mislabels whose money is whose.

### Q4. What is reconciliation and why is it necessary at all?

Reconciliation is **matching your internal records against an external source of the same facts to prove they agree** — or to surface and explain every place they don't.

It's necessary because **two independent systems recording the same economic reality will always drift.** You book a trade; your custodian books its side of the same trade from its own feed. Timing differences, symbology differences, rounding, fees, duplicates, and outright errors mean the two sets of numbers won't be identical by construction. If you *don't* reconcile, you have no idea whether your positions and cash are real — you're trusting one system's word for it.

So recon is a **control**: prove that your books match the outside world (custodian holdings, counterparty confirmations, exchange trades, bank cash statements), and where they don't, raise a **break** and chase it until it's explained or fixed.

Engineer angle: reframe it immediately as a `JOIN` between two datasets followed by a `DIFF` of the matched rows. The unmatched or mismatched rows are the breaks. Everything else — normalisation, tolerances, ageing — is machinery around that join+diff.

### Q5. Why is reconciliation fundamentally a "join + diff on imperfect data"?

Because that's structurally what it is, and naming it that way tells you where the difficulty lives.

- **Join** — you line up records from the two systems on some key: ideally a shared `trade_id`, but often you don't have one, so you fall back to `instrument + date + quantity` (a fuzzy composite key).
- **Diff** — for the records that matched, you compare the fields that should agree (amount, price, quantity) within tolerances and flag differences.

The word "imperfect" is where all the engineering is. The two systems don't share clean keys or conventions:

- **Symbology** — they call ACME `ACME.L`, you call it your internal id; one uses ISIN, the other a ticker.
- **Dates/timezones** — trade date vs settlement date; their EOD is in a different timezone.
- **Sign conventions** — a buy is `+` for you, `-` for them.
- **Scale/rounding** — pence vs pounds, 2dp vs 4dp, fees included or not.
- **Duplicates** — the same trade appears twice in one feed.

Engineer angle: this is the classic **messy-data** problem in business form. The match logic is easy; the normalisation that makes a join *possible* is the job. Recon systems are 80% data cleaning, 20% comparison.

### Q6. Walk through the stages of a reconciliation pipeline.

Always the same shape, whatever's being reconciled:

| Stage | Does |
|---|---|
| **Ingest** | Read the external feed (CSV, fixed-width file, API) and your internal records |
| **Normalise** | Map both to a common internal shape — fix symbols, dates/timezones, signs, scales |
| **Match** | Join on the best key available (`trade_id`, else `instrument+date+qty`) with tolerances |
| **Diff / classify** | For matched pairs, compare fields; label each item **matched**, **unmatched** (only one side), or **broken** (matched key but field mismatch) |
| **Report** | Emit the break list for ops to investigate; feed aged-break tracking |

```
external feed ──► normalise ──┐
                              ├─► match (keys + tolerances) ──► matched
internal records ─► normalise ┘                            └─► unmatched / broken ──► ops
```

The **normalise** stage is where the real engineering sits — it's what makes an imperfect join possible. **Match** encodes your key strategy and tolerances. **Classify** distinguishes "no counterpart at all" (unmatched — likely a timing or missing-feed issue) from "counterpart exists but disagrees" (broken — likely a value/rounding/sign issue), because they route to different investigations.

Engineer angle: make each stage idempotent and auditable — feeds get redelivered, and every break needs a trail of what was compared.

### Q7. What is a break, and how do you classify and manage them?

A **break** is any item reconciliation couldn't cleanly match — the output that actually matters. Two flavours:

- **Unmatched** — a record on one side with no counterpart on the other. Often a *timing* issue (their feed hasn't arrived, or the trade settled on a different day) or a genuinely missing/extra trade.
- **Mismatched (broken)** — the key matched but a field disagrees beyond tolerance: wrong amount, wrong quantity, wrong price. Often rounding, fees, sign, or a real booking error.

Managing them:

- **Age them.** Track how many business days each break has been open. A one-day-old timing break is routine; a 10-day **aged break** is a problem and gets escalated.
- **Route by type.** Unmatched-due-to-timing often self-clears next cycle; value mismatches need investigation.
- **Audit each break.** Store what was compared (both sides, the key, the tolerance, the diff), who's investigating, and how it resolved.

Engineer angle: model a break as a first-class entity with a *state machine* (open → investigating → resolved/written-off), not a transient log line. Aged-break reports are a `GROUP BY age_bucket` over that table. The system's job is to surface, route, and track breaks to closure — not to make them disappear.

### Q8. How do you choose match keys and tolerances?

**Match keys** — use the strongest identifier both sides share, and degrade gracefully:

1. **Best: a shared business id** — `trade_id` / counterparty reference. Exact, one-to-one, unambiguous.
2. **Fallback: a composite key** — `instrument + trade_date + quantity` (+ side). Used when no shared id exists; fuzzier, can match the wrong pair if two similar trades exist.
3. **Last resort: fuzzy/aggregate matching** — match on totals per instrument per day when line-level keys are hopeless.

**Tolerances** — you rarely want exact equality on values, because legitimate rounding and fee differences would flood you with false breaks:

- Allow a small **absolute or relative tolerance** on price/amount (e.g. within 0.01, or within a few basis points).
- Set tolerance to zero on things that must be exact (quantity, currency).
- Tolerances must be **explicit and auditable** — "we treated a 0.005 difference as matched" is a control decision, not a hidden constant.

Engineer angle: the key strategy and tolerances *are* the recon's business logic. Too loose and you match wrong pairs / hide real breaks; too tight and you drown ops in noise. Make them configurable per recon and log which rule matched each pair.

### Q9. Design a reconciliation system matching internal trades to a custodian feed.

Restate: nightly (and intraday) prove our trades/holdings match the custodian's statement; surface and track every break.

Design:

- **Ingest** both sides idempotently. The custodian file may be redelivered — dedupe on a file/business key so a reload doesn't double-count. Persist the raw feed for audit.
- **Normalise** to a common shape: map custodian symbology to our internal instrument id via the **security master**, convert their timezone/date convention, align sign conventions and currency scale. This is the bulk of the work.
- **Match** on `trade_id` if the custodian echoes it; else composite `instrument + settlement_date + qty` with tolerances on amount/price.
- **Classify** into matched / unmatched / broken, and persist breaks as stateful entities with the compared values.
- **Scale** by chunking: partition the workload by **date and/or counterparty/custodian** so it parallelises — recon is embarrassingly parallel across independent buckets.
- **Report**: break list, aged-break dashboard, and a matched-rate metric.

```
custodian file ─► [idempotent ingest] ─► [normalise via security master] ─┐
internal trades ───────────────────────► [normalise] ────────────────────┤
                                                                          ▼
                                                    [match: key + tolerance] ─► matched
                                                                          └──► breaks (stateful, aged)
```

Engineer angle: the hard parts are symbology normalisation and idempotent ingest, not the compare. Chunk-by-counterparty to scale a slow batch.

### Q10. The custodian says you hold 119 ACME; your system says 120. Walk through diagnosing it.

This is a **quantity break** — key matched (ACME), value disagrees (120 vs 119). Work it as a data problem, not a math problem.

Likely causes, roughly in order:

- **Timing.** A trade of yours (a buy of 1, or a sell) hasn't settled yet or settled on a boundary date, so it's in your position but not yet in the custodian's holdings (or vice versa). Most breaks are timing.
- **A missing or extra trade.** One side booked a trade the other didn't — a genuinely broken booking, a cancelled trade that didn't propagate, or a fail.
- **Corporate action.** A stock split/consolidation, dividend-in-shares, or symbol change applied on one side and not the other — 120 vs 119 could be an un-applied corporate action.
- **Symbology.** You matched the wrong ACME — a reused ticker or an unmapped line — so the "120" and "119" aren't even the same instrument. Check the security-master mapping.
- **Duplicate.** One side double-counted a fill.

Method: pull the trade-level detail on both sides, line them up, and find the one trade that explains the difference of 1. Because positions are a *fold over trades*, the break always resolves to a trade-level discrepancy.

Engineer angle: this is why you keep positions derived and trades immutable — you can drill from the position break down to the exact offending event.

### Q11. Why must a recon pipeline be idempotent, and how do you make it so?

Because feeds get **redelivered** — the custodian resends yesterday's file, a job retries after a crash, an upstream replays a stream. If ingesting the same data twice double-counts holdings or double-creates breaks, the recon lies.

Make it idempotent at each stage:

- **Ingest** — dedupe on a **business key** (the file's date/id, or each row's source id), not a transport id. Persist seen keys; a re-fed file is a no-op, not a second load.
- **Match/classify** — running the recon again over the same normalised inputs must produce the same result and not spawn duplicate break records. Key breaks on `(recon_date, match_key)` so a rerun *updates* the existing break rather than inserting a new one.
- **Break state** — a rerun should move a break along its state machine, not resurrect a resolved one.

Engineer angle: this is the same at-least-once discipline as trade processing (dedupe on business key, persist seen keys, no-op on replay). Recon reruns constantly — after fixes, after late feeds — so "run it again safely" is a hard requirement, not a nicety. A non-idempotent recon manufactures phantom breaks every time ops reprocesses.

### Q12. Timezones, symbology, and sign conventions in recon — give concrete traps.

These live in the **normalise** stage and cause most false breaks.

- **Timezones / date rollover.** Their "trade date" is stamped in a different timezone, so a trade near midnight lands on a different calendar day for each side, making it look unmatched. Also **trade date vs settlement date vs value date** — matching on the wrong date field creates spurious timing breaks. Normalise to an explicit `(date, convention, timezone)` before joining.
- **Symbology.** They send `ACME.L`; you hold internal id `INST-42`; a third feed uses the ISIN. A reused or renamed ticker matches the *wrong* instrument. Never string-compare symbols — map every external id through the **security master** to your canonical id first. (See ISIN vs CUSIP vs ticker vs FIGI.)
- **Sign conventions.** A buy is `+100` to you and `-100` (cash out) or an unsigned `100` with a separate B/S flag to them. Match on unaligned signs and everything breaks. Normalise direction to a single signed convention.
- **Scale.** Pence vs pounds (×100), 2dp vs 4dp price, fees bundled into amount on one side only.

Engineer angle: build a normalisation layer that maps *both* feeds into one canonical shape (canonical instrument id, UTC dates with an explicit convention, signed quantities, currency + scale) *before* the join. Every trap above is a data-cleaning bug, and the join is only correct once cleaning is.

### Q13. Compare intraday (T+0) reconciliation with overnight batch recon.

Two cadences for the same join+diff, chosen by how fast you need to catch breaks.

| | Overnight batch | Intraday / T+0 |
|---|---|---|
| When | Once, after EOD close | Continuously / periodically during the day |
| Input | Full daily statement | Streaming or frequent partial feeds |
| Latency to catch a break | Next morning | Minutes/hours |
| Complexity | Simpler (complete data) | Harder (partial, in-flight data) |

**Overnight batch** is the classic: after the close, both sides have a complete daily picture, you run the recon once, ops works the breaks next morning. Simpler because the data is settled and complete.

**Intraday/T+0** catches breaks faster — important where a late-caught break means a failed settlement or a funding miss. The catch: intraday you're reconciling *in-flight* data, so "unmatched" is often just "not there yet", and you must avoid raising noise on trades that simply haven't propagated. Tolerances and timing windows matter more.

Engineer angle: the pipeline is the same; intraday just runs it more often over partial data and needs smarter unmatched-vs-timing handling. Both must be idempotent because both rerun. Faster recon = less operational and settlement risk, at the cost of handling incomplete feeds.

### Q14. How does reconciliation relate to positions being derived state?

Directly — recon is the *proof* that your derived positions match the outside world.

Your position is a **fold over your trades** (see Positions, PnL & NAV). The custodian independently computes *its* view of your holdings from *its* records. Reconciliation joins the two and diffs them. So recon is literally "does my folded position equal the custodian's holding?" — and when it doesn't, the break drills back down to a **trade-level** discrepancy, because that's the only place your position can come from.

This is exactly *why* the derived-position discipline pays off:

- Because positions are derived from immutable trades, a position break is always explainable by a specific missing/extra/wrong trade — you can drill from aggregate to event.
- Because trades are append-only with provenance, you can show *which* trade and *when* you knew about it.
- If you'd stored positions as mutable truth, a break would be unresolvable — you'd have a number that disagrees and no log to explain it.

Engineer angle: derived positions + immutable trades make reconciliation *tractable*; mutable position rows make it a dead end. Recon and event sourcing are two halves of the same design.

### Q15. What goes into an aged-break report and why does age matter?

An **aged-break report** buckets open breaks by how long they've been unresolved — it's the control that stops breaks from quietly accumulating.

Contents:

- Each open break with its **age** (business days since first raised), type (unmatched/mismatched), the two sides' values, the instrument/counterparty, assigned owner, and status.
- Aggregates: counts and value by **age bucket** (0–1 day, 2–5 days, 5+ days) and by counterparty/custodian.

Why age matters:

- **A fresh break is usually benign** — most are timing and self-clear next cycle. Raising alarms on day-zero breaks is noise.
- **An aged break is a red flag** — a break open for a week is probably a real error (a missing trade, a genuine holdings discrepancy, an unresolved fail) with financial and regulatory exposure. Ageing is how you separate routine timing noise from genuine problems and escalate the latter.

Engineer angle: this is a `GROUP BY age_bucket` over a stateful break table where each break carries a `first_seen` date and a lifecycle. Because recon is idempotent and reruns, a break that persists across runs *accrues age* rather than being re-created fresh each night — which only works if breaks are keyed on `(match_key, recon_stream)`, not re-inserted per run.

### Q16. Spot the domain bug: matching two feeds by stripping symbol suffixes with a regex to decide two rows are the same instrument.

The bug is deciding instrument identity by **string manipulation instead of mapping through the security master**. It looks convenient and is quietly wrong.

Why it breaks:

- **Reused / ambiguous symbols.** A ticker isn't globally unique; `ACME` on one exchange isn't `ACME` on another. Stripping a `.L` suffix can collapse two genuinely different instruments into one — a false match that hides a real break or invents a wrong one.
- **Inconsistent conventions.** Vendors use different suffix/prefix styles (Bloomberg vs Reuters, exchange codes, share-class markers). A regex tuned to one feed silently mismatches another.
- **Renames and corporate actions.** The same instrument's symbol changes over time; string-matching today's symbols misses that history entirely.

The correct approach: map **every external identifier through the security master** to your internal **canonical id**, then match on the canonical id. The security master holds the id↔id mappings (ISIN, CUSIP, ticker, FIGI…) with effective dates; that's the authority on "are these the same instrument", not a regex.

Engineer angle: never key business data or recon on a raw/stripped ticker. Symbology normalisation via the master *is* the normalise stage — the join is only trustworthy once both sides carry canonical ids.

## Treasury, Cash & Payments

### Summary

**What this topic covers**

This topic follows the money — literally the cash side of the business, which engineers often under-model because it looks "simpler" than securities and isn't. The 15 questions cover **cash management** (having the right cash, in the right place, currency and time), **funding** and **liquidity**, **margin and collateral** (assets posted to cover exposure), the settlement of the **cash leg** of trades, and **nostro reconciliation**. Then the payments plumbing at a domain level — **payment rails** (**SWIFT**, **ACH**, **wire**) — and, most importantly for an engineer, the software discipline that cash demands: cash as **just another ledger** (double-entry, append-only), exact amounts with a currency always attached, **idempotent** payment processing, and why **duplicate-payment / double-spend prevention** is non-negotiable when the "row" you're writing moves real money out the door.

**Mental model**

Treat cash as *another position on another ledger*, subject to the exact same event-vs-aggregate discipline as securities — but with sharper consequences when you get it wrong, because a bug here doesn't misreport a number, it moves money. A cash **balance** is a point-in-time aggregate; it's derived from an append-only stream of cash movements (credits and debits), never a directly-mutated field. Every movement is **double-entry**: debits equal credits, so the books always balance and every penny has a counter-entry. Two hard rules dominate: **money is (amount, currency, scale)** — an amount without a currency is meaningless and a wrong scale corrupts it — and **payments must be idempotent**, because payment instructions get retried and redelivered, and processing one twice is a duplicate payment that's genuinely hard to claw back. The engineer's frame: cash is a ledger, a payment is an event that must be applied *exactly once*, and the balance is a fold you can always rebuild and reconcile against the bank (nostro recon).

**Key terms**

- **Cash management** — ensuring the right cash is in the right account, currency, and place at the right time.
- **Funding** — sourcing cash to meet obligations as they fall due (a settlement, a margin call).
- **Liquidity** — how readily you can meet obligations / turn assets into cash without a big loss.
- **Margin** — cash/assets posted to a counterparty or clearing house to cover potential loss on a position.
- **Collateral** — assets pledged to secure an exposure (margin is collateral posted against trades).
- **Cash leg** — the money side of a trade's settlement (versus the securities leg); DVP couples the two.
- **Nostro reconciliation** — matching your *expected* cash movements against the bank statement of what actually moved.
- **Payment rail** — the network a payment travels over: SWIFT, ACH, domestic wire, etc.
- **SWIFT** — global interbank *messaging* network for payment instructions (a message layer, not the money itself).
- **ACH** — domestic, batched, low-cost bulk payments (e.g. payroll); not instant.
- **Wire** — high-value, individually-processed, (near-)real-time bank transfer.
- **Double-entry** — every movement posts equal debits and credits; the ledger always balances.
- **Idempotency key** — a business key on a payment so a retried instruction is applied exactly once.

**Why interviewers ask this**

Cash is where domain fluency turns into "would I trust you to write the code that moves money?" Interviewers probe two things. First, **do you model cash like a ledger** — double-entry, append-only, balance-as-fold, exact decimal with currency — or do you reach for a mutable `balance` float, which is the tell of someone who hasn't built financial software. Second, **do you take idempotency and duplicate-payment prevention seriously**, because at-least-once delivery is the norm and a non-idempotent payment path *will* eventually send money twice. A strong candidate volunteers the (amount, currency, scale) rule, the never-float rule, per-currency minor units, and a business-key dedupe with a persisted seen-set — and can explain why a transport-level id isn't enough. This topic also checks basic plumbing fluency (SWIFT is messaging, not money; ACH is batch, wire is real-time), which quickly reveals whether someone has worked near payments.

**Common confusions**

- "SWIFT moves money." SWIFT moves *messages* (payment instructions) between banks; the money moves via correspondent/nostro accounts and settlement. It's a messaging layer.
- "A balance is a field I update." A balance is a *fold* over append-only cash movements; mutating a stored balance loses history and breaks nostro recon.
- "All currencies have 2 decimal places." No — JPY has 0, some have 3; the ISO 4217 exponent varies. Hard-coding 2 corrupts amounts.
- "An amount is a number." An amount without a **currency** (and scale) is meaningless; always store them together.
- "Retrying a payment is safe." Only if it's idempotent on a business key. Otherwise a retry is a *second* payment.
- "Margin and market value are the same." Margin is collateral *posted* to cover potential loss; it's not the position's value.
- "float is fine for cash." Never — binary FP can't represent 0.10; errors compound and break reconciliation.

**What follows from this topic**

Treasury closes the loop. It reuses **Positions, PnL & NAV**'s event-vs-aggregate discipline (a cash balance is a fold, exactly like a securities position) and its exact-money/provenance rules. It reuses **Counterparties, Custody & Reconciliation** directly — **nostro reconciliation** is that same join+diff applied to cash, matching your expected movements against the bank's statement. The settlement **cash leg** ties back to the trade lifecycle (DVP: cash versus securities). And the idempotency and double-entry patterns here are the sharpest expression of the whole primer's thesis: in financial systems the data model *is* the correctness model, and nowhere is that more literal than when the row you write hands real money to someone else.

### Q1. What is cash management, and why is it more than "how much money do we have"?

**Cash management** is ensuring the **right cash is in the right account, currency, and place at the right time** to meet obligations — settlements, margin calls, redemptions, fees.

It's more than a single balance because cash is fragmented across dimensions:

- **Currency.** You may hold plenty of USD but owe EUR tomorrow; total wealth is irrelevant if it's the wrong currency.
- **Location / account.** Cash sits in specific bank accounts (nostros) at specific banks; money in account A can't settle an obligation drawn on account B without a movement.
- **Time.** An obligation due T+2 needs funds *available* by then; cash tied up or in-transit doesn't count.

So the real question is not "how much money" but "do we have *this* currency, in *this* account, by *this* time". Falling short is a **funding** problem (you must source the cash) or a **liquidity** problem (you can't turn assets into usable cash fast enough).

Engineer angle: this is why cash can't be a single scalar. You model balances **per (account, currency)** as folds over movements, with **value dates** (when funds are actually available), so the system can answer availability by currency and time — not just a lump total.

### Q2. Explain margin and collateral.

**Collateral** is assets pledged to secure an exposure — if you default, the holder keeps the collateral to cover the loss. **Margin** is collateral posted specifically against trading positions to cover *potential* future loss.

Two common contexts:

- **Exchange/cleared trades.** A clearing house requires margin so that if your position moves against you, there's posted collateral to absorb it. As the position's value moves, you get **margin calls** — post more collateral, or have some returned.
- **Bilateral/OTC.** Counterparties post collateral to each other to cover credit exposure on outstanding trades.

Crucially, **margin is not the position's market value** — a $10m-notional position might require only a fraction as margin. Margin sizes the *potential loss to be covered*, set by the risk model; you don't compute that maths (the risk engine does), you *move and track* the collateral.

Engineer angle: from a systems view, margin is a **cash/asset movement and a balance to track** — collateral posted out, collateral received in, calls to settle. It's another ledger of movements with the same discipline: exact amounts, currency attached, append-only, reconciled against the counterparty/clearer. You surface margin as balances and calls; you don't own the sizing model.

### Q3. What is the cash leg of settlement, and how does DVP couple it to securities?

Every securities trade has two legs at settlement: the **securities leg** (shares/bonds move from seller to buyer) and the **cash leg** (money moves from buyer to seller). The **cash leg** is the payment side.

**DVP (delivery versus payment)** is the principle that the two legs happen **simultaneously and conditionally** — securities are delivered *if and only if* cash is paid, and vice versa. It exists to remove **principal risk**: without DVP you might pay and not receive the securities (or deliver and not get paid). DVP couples the legs so neither side can be left short.

Engineer angle: model settlement as a **coupled, atomic-ish transition**, not two independent updates. The cash leg is a payment (subject to all the idempotency and exact-money rules), and its success is tied to the securities leg. A **settlement fail** happens when one leg can't complete on time — model settlement status as a *state machine* (pending → settled / failed), never a boolean, and never mark cash paid unless the coupled delivery also occurred. This is where the trade lifecycle meets the cash ledger: the cash leg is the concrete money movement that the whole lifecycle was building toward.

### Q4. Why model cash as a ledger rather than a mutable balance field?

Because a mutable balance field throws away everything you need for correctness, audit, and reconciliation — the same reasons a position is derived, applied to money.

A **ledger** records every cash movement as an **append-only** entry (a credit or debit) with its counter-entry (**double-entry**). The **balance is a fold** over those entries at a point in time — not a stored, overwritten number.

What you gain versus a mutable field:

- **Audit & lineage.** Every balance traces to the movements that produced it; you can answer "how did we get to this balance?" — a regulatory must.
- **As-of balances.** "What was the EUR balance on 2026-06-30?" is a fold up to that date, not a lost overwritten value.
- **Reconcilability.** You can match your expected movements against the bank statement (nostro recon) line by line, because you kept the lines.
- **Double-entry self-check.** Debits equal credits, so the books balance by construction and a stray movement is detectable.

Engineer angle: `UPDATE accounts SET balance = balance - 100` is the cash equivalent of mutating a position — no history, no audit, no as-of, no recon. Insert a **movement event**; derive the balance. It's event sourcing for money.

### Q5. Explain double-entry bookkeeping to an engineer.

Double-entry is the invariant that **every movement is recorded in two places — a debit and an equal credit — so the total debits always equal the total credits**, and the books always balance.

Money never appears or vanishes; it *moves between accounts*. So paying $100 from your cash account to a counterparty posts two entries: a **credit** (decrease) to your cash account and a **debit** (increase) somewhere on the other side — the entries net to zero across the ledger.

```
pay $100 to Broker X:
  cash account        -100
  broker payable       +100     (debits == credits; ledger stays balanced)
```

Why an engineer should love it:

- **A built-in consistency check.** If debits don't equal credits, you have a bug — the ledger tells you. It's a checksum on every transaction.
- **No money leaks.** Every amount out has a matching amount in; you can't accidentally destroy or conjure cash with a single-sided write.
- **Natural audit trail** when combined with append-only entries.

Engineer angle: enforce "debits equal credits" as an invariant on every posted transaction (ideally atomically), and make entries append-only. A single-sided update to a balance is precisely the anti-pattern double-entry exists to prevent. Balance = sum of an account's entries; the whole-ledger sum is always zero.

### Q6. Why must you never use float/double for money, and what do you use instead?

Because binary floating point **cannot exactly represent most decimal fractions** — `0.10` has no exact binary form — so `0.10 + 0.20` isn't `0.30`. In money, those tiny errors **compound across millions of transactions and break reconciliation**: your ledger and the bank disagree by pennies that don't sum to anything explainable.

Use one of two exact representations:

- **Exact decimal type** — `BigDecimal` (Java), `decimal` (C#), `NUMERIC/DECIMAL` (SQL). Represents decimal fractions exactly.
- **Integer minor units** — store cents/pence as integers (`1050` = £10.50) and do integer arithmetic.

Plus two rules that always ride along:

- **Define rounding explicitly.** Choose a mode (e.g. HALF_EVEN / banker's rounding) — never rely on a language default. Where and how you round is a business decision.
- **Always store the currency and scale** with the amount (next question).

Engineer angle: this isn't pedantry — a float ledger *will* drift and *will* fail nostro recon, and you can't tell whether a break is a real discrepancy or just accumulated FP error. Exact decimal or integer minor units from day one; retrofitting is painful because historic values are already corrupted.

### Q7. Why is "money = (amount, currency, scale)" and where does it bite if you forget?

A bare number is not money. **100 what?** 100 USD and 100 JPY are wildly different values; 100 could be dollars or cents depending on scale. Money is only meaningful as the triple **(amount, currency, scale)**.

Where forgetting bites:

- **No currency.** You add a USD amount to a EUR amount as if they were the same, or convert with the wrong rate — silently wrong totals. Any aggregation across currencies without conversion is a bug.
- **Wrong scale / minor units.** Currencies have different numbers of decimal places (the ISO 4217 exponent): **USD 2, JPY 0, some 3**. Assume 2 everywhere and you divide a JPY amount by 100 — off by 100×. The GBP-vs-pence (GBP vs GBp) trap is the same factor-of-100 corruption from a scale/convention mismatch.

```
{ "amount": 1050, "currency": "GBP", "scale": 2 }   // £10.50 as minor units
{ "amount": 1050, "currency": "JPY", "scale": 0 }   // ¥1050 — dividing by 100 corrupts it
```

Engineer angle: make currency a **mandatory, non-null companion** of every amount in your schema and types — never a nullable afterthought. Derive scale from the currency (ISO 4217 exponent), never hard-code 2. A `Money` value type that bundles amount + currency (+ scale) and refuses cross-currency arithmetic without an explicit conversion is the clean design.

### Q8. Compare the payment rails: SWIFT, ACH, and wire.

Different networks for moving/instructing money, with different speed, cost, and batching — and one of them isn't the money at all.

| Rail | What it is | Speed | Typical use |
|---|---|---|---|
| **SWIFT** | Interbank **messaging** network for payment *instructions* | Message is fast; settlement depends on correspondent banks | Cross-border interbank instructions |
| **ACH** | Domestic **batched** bulk transfer | Slow — batched, settles in 1+ days | Payroll, bills, bulk low-value |
| **Wire** | High-value, **individually** processed transfer | (Near-)real-time | Large, urgent, time-critical payments |

The load-bearing subtlety: **SWIFT moves messages, not money.** It's how banks *tell each other* to pay; the actual cash moves through correspondent/nostro relationships and downstream settlement. Treating a SWIFT message as "money has moved" is a domain error.

**ACH** trades speed for cost — batched and cheap, so ideal for high-volume low-urgency payments, but not instant. **Wire** trades cost for speed and finality — individually handled, fast, used when it must arrive now.

Engineer angle: the rail sets your latency and finality expectations, which shape state modelling. A payment isn't "done" when instructed — it's `instructed → in-transit → settled/failed`, and *when* it's truly final differs per rail. Don't mark cash delivered on message send; confirm settlement (and reconcile it via nostro recon).

### Q9. Why must payment processing be idempotent, and how do you implement it?

Because delivery is **at-least-once** — instructions get retried after timeouts, redelivered by queues, resubmitted by upstreams. If processing the same instruction twice sends money twice, you've made a **duplicate payment**, and unlike a mis-computed report, that's real money out the door that's hard to recover.

Implement idempotency on a **business key**, not a transport id:

- **Choose a business idempotency key** the *originator* controls — a payment instruction id / client-supplied key — so the same logical payment carries the same key across every retry. A transport/message id changes on redelivery and won't dedupe.
- **Persist a seen-keys set** (a unique constraint on the key in the payments table is the simplest form). Before executing, check it; on a repeat, **no-op and return the original result** — never execute again.
- **Make the check-and-execute atomic** so two concurrent retries can't both slip through (unique constraint + insert, or a transactional seen-set).

```sql
-- unique business key makes a duplicate insert fail, not double-pay
INSERT INTO payments (idempotency_key, amount, currency, ...) VALUES (...);
-- on conflict: this instruction was already processed -> return existing outcome
```

Engineer angle: "exactly-once" money movement is really **idempotent processing + dedupe on a business key**, not magic infrastructure. This is the same at-least-once discipline as trade processing, but the cost of getting it wrong is a payment you may never claw back.

### Q10. What is nostro reconciliation and how does it use the recon pattern?

**Nostro reconciliation** matches your **expected** cash movements against the **bank statement** of what actually happened on your nostro account — proving the money that should have moved did move, correctly.

Recall a **nostro** is your account held at another bank (per currency). You *expect* certain credits and debits — settlement cash legs, margin, fees. The bank sends a statement of *actual* movements. Nostro recon joins the two.

It's the **Counterparties, Custody & Reconciliation** join+diff pattern applied to cash:

- **Ingest** the bank statement and your expected-movements ledger.
- **Normalise** — align **value dates**, currency/scale, and references.
- **Match** on a payment reference if present, else `value_date + amount + currency`, with tolerances for fees.
- **Classify** — matched, or a **break**: an expected movement the bank didn't make (a **fail** or delayed payment), or a bank movement you didn't expect (an unexpected debit — investigate immediately).

Engineer angle: this is why cash must be a **ledger of movements**, not a mutable balance — you can only reconcile line-by-line if you kept the expected lines with their references and amounts. An unmatched *unexpected debit* is a priority break: money left the account without a corresponding instruction. Nostro recon is the cash-side control that closes the loop on payment processing.

### Q11. Spot the domain bug: `UPDATE accounts SET balance = balance - :amount WHERE id = :acct` to make a payment.

This is the cash equivalent of mutating a position, and it's dangerous because it moves money.

The bugs:

- **Single-sided / no double-entry.** Money leaves this account with no counter-entry. Nothing enforces debits = credits; you can't tell where the money went, and the ledger no longer self-checks.
- **No idempotency.** If the payment instruction is retried or redelivered, you subtract the amount *again* — a duplicate payment. There's no business-key dedupe.
- **Mutable balance, no history.** You've overwritten the balance; no audit trail, no as-of balance, and nothing to reconcile against the bank statement line by line.
- **No currency/scale guard.** `:amount` had better be the account's currency and scale — nothing here checks, so a cross-currency or wrong-scale amount silently corrupts the balance.
- **No settlement state.** It marks the money gone the instant you write the row, ignoring instructed → in-transit → settled/failed.

The fix: record a **double-entry movement** (append-only) keyed by an **idempotency key**, with amount+currency+scale, and derive the balance as a fold. The payment is an *event applied exactly once*, coupled to a settlement state machine and later confirmed by nostro recon — not an in-place subtraction.

### Q12. Design a multi-currency cash/treasury ledger with point-in-time balances.

Restate: track cash across many currencies and accounts, with append-only history, exact money, and as-of balances — and no double-payments.

Design:

- **Money as (amount, currency, scale).** Every amount stores its currency; scale derives from ISO 4217. Exact decimal or integer minor units — never float.
- **Append-only movement ledger, double-entry.** Each cash event posts balanced debit/credit entries; nothing is mutated. Model per `(account, currency)`.
- **Balance = fold, with value dates.** Current and as-of balances are sums of movements up to a time; use **value date** (funds-available date), not just booking date, so availability is correct. Snapshot per day to bound the fold.
- **FX on conversion is explicit and stamped.** Converting between currencies applies a rate whose **direction (pair), source, and timestamp** you persist (see next Qs). No implicit cross-currency arithmetic.
- **Idempotent payments.** Money-out movements dedupe on a business idempotency key with a persisted seen-set.
- **Nostro recon built in.** Expected movements carry references so they reconcile against bank statements.

```
payment/settlement events ─► [idempotent apply, double-entry] ─► movement ledger (append-only)
                                                                      │
              value-date fold ────────────────────────────────► balance per (account, currency), as-of
```

Engineer angle: it's the position-keeping service for cash — immutable events, derived balances, exact money, idempotency, reconciliation. Same spine, higher stakes.

### Q13. Explain base/quote and the quote-inversion bug in FX.

An FX quote is a **pair** with a **base** and a **quote** currency. `EUR/USD = 1.10` means **1 EUR = 1.10 USD** — the base (EUR) is the unit, the quote (USD) is the price of one unit.

So to convert:

- **EUR → USD:** multiply by 1.10 (100 EUR = 110 USD).
- **USD → EUR:** divide by 1.10 (110 USD = 100 EUR).

The **quote-inversion bug** is applying the rate the wrong way — multiplying when you should divide, or using `1/rate` inadvertently. It's a *classic silent bug*: nothing errors, the number just comes out wrong — and it's off by roughly the *square* of the rate (using 1.10 instead of 1/1.10 ≈ 0.909 is off by ~1.21×), so it's not an obvious factor-of-10 you'd spot. Small rates near 1.0 make it especially easy to miss.

Also: **trade currency vs settlement currency can differ**, and a rate has a **source and timestamp** — the same pair differs by venue and snapshot, so store both.

Engineer angle: never store a bare `rate`. Store `(base, quote, rate, source, as_of)` and convert with an explicit, tested direction — ideally a `Money.convert(to, quote)` helper that knows which side is base and refuses to guess. Quote inversion is one of the most common and most silent FX defects; make direction impossible to get wrong in code.

### Q14. Why store the FX rate (with direction, source, timestamp) used on every conversion?

Because a converted amount is only as trustworthy — and only as *reproducible* — as the rate behind it, and finance must reproduce every figure.

The same conversion at a different rate gives a different result, and rates vary by **venue and snapshot**: `EUR/USD` at 20:59 on venue A differs from 21:00 on venue B. If you store only the converted number, you can't answer "why is this EUR balance 1446 and not 1450?" or reconcile it. If you store the rate, its **pair/direction**, **source**, and **timestamp**, you can reproduce and defend it.

This is the same **provenance/lineage** discipline as marking positions: every derived figure must trace to its inputs, and an FX conversion's input is a specific rate at a specific time from a specific source.

It also makes recon and disputes tractable — if your converted cash figure and a counterparty's disagree, the first question is "which rate did each side apply?", answerable only if both stamped it.

Engineer angle: treat `(rate, base, quote, source, as_of)` as mandatory metadata persisted with any converted amount, not a transient calculation input. A conversion without a stored rate is unauditable, unreconcilable, and — because of quote inversion — quietly one of the easiest things to get wrong.

### Q15. What are funding and liquidity, and how do they show up as data an engineer serves?

**Funding** is sourcing the cash to meet obligations as they fall due — a settlement cash leg, a margin call, a redemption. **Liquidity** is how readily you can meet those obligations: how much usable cash you have, and how quickly you can turn assets into cash without a costly fire-sale.

They matter because being *wealthy* isn't the same as being *able to pay* — you can hold plenty of assets and still fail an obligation if the cash isn't available in the right currency at the right time (a liquidity/funding shortfall). Bridging a gap is a funding action (borrow, sell, move cash); *liquidity risk* is the danger you can't.

As data an engineer serves (you don't compute the risk maths — the treasury/risk engine does), this surfaces as:

- **Projected cash positions** per `(account, currency, value date)` — expected inflows/outflows over a forward horizon, so treasury sees upcoming gaps.
- **Available vs total balances** — cash free to use versus tied up (as margin, unsettled, in-transit).
- **Obligation schedules** — upcoming settlements and margin calls by date and currency.

Engineer angle: this is why the cash ledger must track **value dates** and be foldable to *forward-looking* projections, not just today's balance. You provide the accurate, currency-aware, time-bucketed cash picture; treasury decides how to fund it. Get the ledger's event/aggregate model and value dates right and these projections are a query; get them wrong and treasury is flying blind.
## Market Structure & Trading Venues

### Summary

**What this topic covers**

Where trades actually happen, and the vocabulary that describes a price at the venue. This topic has 16 questions covering three concern areas: (1) the **venue split** — a central regulated **exchange** (an anonymous, matched **order book**) versus **OTC** (over-the-counter: a bilateral, bespoke deal negotiated directly with a counterparty, how most swaps and much of fixed income trade); (2) the **price vocabulary** an engineer's system must model exactly — **bid**, **ask/offer**, **spread**, **mid**, **lot size**, **tick**, and the **order book** with its levels and **depth**; and (3) the **structural distinctions** — **lit** versus **dark** venues, **primary** versus **secondary** markets, and the role of **market makers** in providing liquidity. The recurring engineer insight: an order book is a specific, well-defined data structure, and the **matching engine** that runs it is a distinct system with its own invariants — it is not "just a database query."

**Mental model**

Think of a venue as a place that turns two half-wishes into one trade. A buyer says "I'll pay up to X"; a seller says "I'll take at least Y." On an **exchange**, all these wishes pour into a single shared **order book** — a sorted, two-sided data structure (bids descending, asks ascending) — and a **matching engine** pairs them by strict **price-time priority**. Nobody knows who is on the other side; the exchange is the anonymising intermediary. In **OTC** land there is no shared book: you phone (or RFQ) a dealer, they quote you a bespoke price, and the "venue" is the bilateral relationship. As an engineer you model the exchange world as a **stream of order events folding into book state**, and the OTC world as **negotiated deal records** with counterparty and terms attached. The book is not the trades — it is resting *intent* (unfilled orders); a trade is emitted only at the instant two orders cross. Keep those two things in separate stores.

**Key terms**

- **Exchange** — central, regulated venue; anonymous, order-book-matched trading (e.g. equities, listed futures).
- **OTC (over-the-counter)** — bilateral deal negotiated directly with a counterparty; bespoke terms; no central book (most swaps, much of FX/credit).
- **Order book** — the two-sided, price-sorted list of resting buy and sell orders for one instrument.
- **Bid** — the highest price a buyer is currently willing to pay.
- **Ask / offer** — the lowest price a seller is currently willing to accept.
- **Spread** — `ask − bid`; the cost of immediacy and a liquidity signal.
- **Mid** — `(bid + ask) / 2`; a reference price, not a tradable one.
- **Tick** — the minimum price increment an instrument may move by.
- **Lot size** — the minimum tradable quantity increment.
- **Depth** — how much quantity rests at each price level; "market depth" = the whole book beyond the top.
- **Market maker** — a participant that continuously quotes both bid and ask, supplying liquidity and earning the spread.
- **Lit vs dark** — lit venues publish the book pre-trade; dark venues hide it and print only after execution.
- **Primary vs secondary** — issuance (IPO/new bond) vs subsequent investor-to-investor trading.

**Why interviewers ask this**

For any front-office, exchange-connectivity, or fintech-brokerage role, this is the fluency gate. A junior candidate says "the price of the stock" as if a single number exists; a senior candidate immediately asks *"bid or ask, and at what size?"* — because they know a quote is two-sided and depth-dependent. Interviewers use order-book questions to test whether you can reason about a **live, mutating, ordered data structure under contention** rather than a static row. They also probe whether you understand *why* matching is its own system: strict determinism, price-time priority, and microsecond-sensitive ordering are constraints a generic CRUD service does not have. Getting bid/ask/mid straight, and knowing mid is not tradable, signals you have actually looked at real quotes.

**Common confusions**

- "The price" — there is no single price; there is a **bid** and an **ask**. The *last traded* price is history, the **mid** is a reference, neither is what you'll get.
- "The order book stores trades" — it stores **resting orders (intent)**. Trades are a *separate* output stream emitted when orders cross.
- "OTC means unregulated / shady" — no; OTC just means **bilateral and bespoke**, not centrally matched. Huge, legitimate markets (swaps, FX) are OTC.
- "Dark pool = illegal" — dark venues are regulated; they just don't publish pre-trade quotes, to reduce market impact for large orders.
- "Spread is a fee" — it isn't a charged fee; it's the **gap** between buy and sell prices that a market maker earns and a taker pays.
- "Lot size and tick are the same" — **lot size** is a *quantity* increment; **tick** is a *price* increment. Different axes.

**What follows from this topic**

The prices produced here are exactly the **market data** firehose modelled in the next topic — quotes and trades are the order book's public output. The trades emitted by matching are the immutable events that fold into positions (see the trade-lifecycle and positions topics). OTC's bespoke, negotiated nature is why swaps carry so much reference data and why their identifiers are messy. And the **mark price** used to strike NAV (final topic) is sourced from these venues — usually an official close or a mid off the book.

### Q1. Explain the difference between an exchange and OTC to an engineer.

An **exchange** is a central, regulated venue where every participant's orders meet in one shared **order book** and a matching engine pairs them anonymously by price-time priority. You don't know your counterparty; the exchange (and its clearing house) stands in the middle. Listed equities and futures trade this way.

**OTC (over-the-counter)** is a bilateral deal: you negotiate directly with a specific counterparty (often a dealer), agree bespoke terms, and book the trade against *them*. There is no shared book and no anonymity. Most interest-rate swaps, a lot of credit, and much of FX trade OTC.

The engineer angle is that these produce **different data shapes**. Exchange trading gives you a high-volume stream of anonymous order/quote/trade events folding into book state — you model the *book*. OTC gives you comparatively few, rich, negotiated **deal records** carrying a counterparty id, bespoke economics, and often a confirmation workflow — you model the *contract*. Trying to force both into one "trade" table lies about the domain: one has no counterparty column that matters (anonymous), the other's counterparty is the whole point.

### Q2. What is an order book and how would you model one?

An order book is the two-sided, price-sorted collection of **resting orders** for a single instrument: bids on one side (sorted highest-first), asks on the other (sorted lowest-first). The **top of book** is the best bid and best ask; everything below is **depth**.

A workable model:

```
BidSide: price -> FIFO queue of resting buy orders   (max-heap / sorted map, descending)
AskSide: price -> FIFO queue of resting sell orders  (min-heap / sorted map, ascending)
Order:   { orderId, side, price, qty, remainingQty, ts, participantId }
```

Each **price level** holds a time-ordered queue of orders (price-time priority: better price first, then earlier arrival). An incoming order walks the opposite side from the best price inward, matching until it's filled or can't cross, then any remainder **rests** as a new resting order.

The engineer point: the book is **derived, live state** built by folding an ordered stream of order events (new / cancel / amend). It is not a table you `UPDATE` ad hoc — it's rebuilt deterministically from the event sequence, which is exactly why ordering and determinism matter so much.

### Q3. Why is a matching engine a distinct system rather than "just a database"?

Because its invariants are unlike a CRUD app's. A matching engine must be **deterministic** (same input sequence → identical trades, every time, so it can be audited and replayed), enforce **strict price-time priority**, process events in a **single total order** per instrument, and often do so at **microsecond latency** under heavy contention.

A general database gives you ACID transactions but not free determinism under concurrency, not price-time fairness, and not the latency profile. Matching engines are typically **single-threaded per instrument** (or per book), fed from an ordered log, precisely to make ordering deterministic — concurrency is handled by *partitioning by instrument*, not by locking rows.

The output is also different: a match doesn't "update a balance," it **emits trade events** (plus book-delta events) that everything downstream consumes. So architecturally it's an **event processor over an ordered command stream**, closer to the event-sourcing / per-key-ordering pattern than to request/response CRUD. That's why firms build (or buy) a dedicated engine rather than bolting matching onto a SQL table.

### Q4. Define bid, ask, spread, and mid — and which one can you actually trade at?

- **Bid** — the highest price a buyer will currently pay. If you want to *sell now*, you hit the bid.
- **Ask (offer)** — the lowest price a seller will accept. If you want to *buy now*, you lift the ask.
- **Spread** — `ask − bid`. It's the cost of immediacy and a liquidity gauge: tight spread = liquid, wide = illiquid.
- **Mid** — `(bid + ask) / 2`. A reference/reporting price only.

The catch every engineer must internalise: **you cannot trade at the mid.** A market buy pays the ask; a market sell receives the bid. Mid is convenient for marking and analytics, but if your system quotes a user the mid as an executable price, it's lying — the user will always fill worse. Store bid and ask as **separate fields with sizes and a timestamp**; deriving mid on the fly is fine, but never let mid masquerade as a tradable quote.

### Q5. A colleague models a quote as a single `price` column. What's wrong?

A quote is **two-sided and sized**, so one number throws away most of it. At minimum you're missing whether it's the buy or sell side, the size available, and the timestamp/source.

A quote should look more like:

```sql
CREATE TABLE quote (
  instrument_id BIGINT      NOT NULL,   -- canonical id, not a raw ticker
  bid_px        DECIMAL(18,8) NOT NULL,
  bid_sz        DECIMAL(18,4) NOT NULL,
  ask_px        DECIMAL(18,8) NOT NULL,
  ask_sz        DECIMAL(18,4) NOT NULL,
  venue         TEXT        NOT NULL,   -- same instrument quotes differently per venue
  ts            TIMESTAMPTZ NOT NULL    -- quotes are a time-series; "now" is meaningless without it
);
```

A single `price` also silently assumes there's one venue and one moment. The same instrument quotes differently across venues and changes every tick, so a bare number can't answer "buy or sell, how much, where, when." This is a domain false-friend: colloquial "the price" collapses information the system must keep separate.

### Q6. What are the levels of an order book — L1, L2, L3?

These describe how much of the book a market-data feed exposes:

| Level | What you see | Use |
|---|---|---|
| **L1 (top of book)** | Best bid/ask + their sizes, last trade | Cheapest, most common; enough to price/mark |
| **L2 (market depth)** | Aggregated quantity at *each price level* | Depth analysis, liquidity, smarter routing |
| **L3 (full book)** | Every *individual order* (add/cancel/amend), with queue position | Latency-sensitive trading, exact microstructure |

As you go L1 → L3 the data volume and update rate explode: L1 is a trickle, L3 is a firehose of per-order events. The engineer choice is a **cost/fidelity trade-off** — most systems only need L1 to mark positions, and paying to ingest, store, and replay full L3 depth is justified only for strategies or analytics that genuinely need queue position. Match the subscription level to what the system actually consumes.

### Q7. What is market depth, and why does the "price" depend on your order size?

**Depth** is how much quantity rests at each price level beyond the top of book. It matters because a large order **eats through levels**: you fill the first chunk at the best ask, the next chunk at the second-best (worse) ask, and so on. The average price you achieve is worse than the top-of-book quote — that gap is **slippage / market impact**.

So "the price" is size-dependent. A 100-share buy might fill entirely at the top ask; a 1,000,000-share buy walks the book and pays a **volume-weighted** price across several levels.

For an engineer this means: if you're estimating execution cost or building a smart order router, you cannot just read L1 — you must **walk L2 depth** and compute the fill across levels. Modelling a fill as "qty × top-of-book price" understates cost for anything but tiny orders, and that error shows up directly in PnL and TCA (transaction-cost analysis).

### Q8. Explain lit vs dark venues.

A **lit** venue publishes its order book **pre-trade**: everyone can see the resting bids and asks and the depth. Exchanges are lit — price discovery happens in the open.

A **dark** venue (dark pool) does **not** publish pre-trade quotes. Orders rest hidden; a trade prints publicly only **after** it executes. The purpose is to let large ("block") orders trade with less **market impact** — if the whole market saw a huge resting buy, prices would move against it before it filled.

Dark venues are regulated, not illicit; the "dark" refers only to pre-trade opacity. For an engineer the distinction is about **what market data you receive and when**: from lit venues you get a continuous pre-trade quote/depth stream; from dark venues you mostly get **post-trade prints** and little-to-no pre-trade book. Your data model and any fair-value/mark logic must account for the fact that dark liquidity is invisible until it trades.

### Q9. Distinguish the primary market from the secondary market.

The **primary market** is **issuance**: a company raising capital via an IPO, or an issuer selling a new bond. Cash flows from investors to the **issuer**, and new securities are created.

The **secondary market** is everything after: investors trading those already-issued securities **among themselves**. The issuer gets nothing; ownership just changes hands. The vast majority of daily trading (all the exchange order-book activity) is secondary.

The engineer angle is that they generate **different data and workflows**. Primary events *create instruments* and reference data — a new bond needs a security-master entry (identifiers, coupon, maturity, par) before it can trade. Secondary trading assumes the instrument already exists and just references it. So a primary issuance is often an **upstream reference-data event** that must land in your security master before any secondary trade can be booked against it; get the sequencing wrong and trades arrive for an instrument your system doesn't know yet.

### Q10. What does a market maker do, and why does it matter to my system?

A **market maker** continuously quotes **both** a bid and an ask for an instrument, standing ready to buy or sell. They supply **liquidity** — you can trade immediately because they're always there — and they earn the **spread** as compensation for taking on inventory risk.

Why it matters to an engineer: market makers are the reason a tradable two-sided quote exists at all, and they **update quotes constantly** (as inventory and market conditions change), which is a big source of the market-data firehose's volume. If you're building a market-making or quoting system yourself, you're now the one publishing rapid two-sided quotes and managing inventory, which raises hard latency and risk-limit requirements. Even if you're just consuming, understanding that spreads widen when liquidity dries up helps you interpret your data: a suddenly wide spread isn't necessarily bad data — it may be genuine illiquidity, and your mark/valuation logic should treat it accordingly rather than "correcting" it.

### Q11. How would you design a real-time order-book service from an exchange feed?

Restate the goal: consume the venue's order-event stream and maintain a queryable, correct book per instrument.

- **Ingest** the feed as an **ordered stream** of book events (new / cancel / amend / trade). Ordering is sacred — process per instrument in strict sequence; **partition by instrument** so different books scale across workers while each book stays single-writer.
- **Fold** events into in-memory book state (sorted maps per side, FIFO queue per level). The book is *derived* — you rebuild it deterministically from the event sequence.
- **Snapshots + increments**: feeds send a periodic full **snapshot** then a stream of **increments**; on connect or gap you reload the snapshot and reapply increments from its sequence number. Track sequence numbers and **detect gaps** — a missed increment silently corrupts the book.
- **Serve** top-of-book / depth to consumers, and separately **emit trade prints**.

The recurring insight: this is event-sourcing on a hot path — ordered log, per-key single-writer, snapshot-plus-delta to bound recovery. The book is state folded from events, never authoritative on its own.

### Q12. What are ticks and lot sizes, and why can't the system ignore them?

A **tick** is the minimum **price** increment an instrument may move by (e.g. 0.01). A **lot size** (or lot / round lot) is the minimum **quantity** increment you can trade in. They constrain different axes: tick = price granularity, lot = quantity granularity.

They matter because venues **reject** orders that violate them, and because they define the correct **decimal scale** for storage. If a market ticks in 0.25, storing or generating a price of 100.10 is invalid — it can never trade. If lot size is 100, an order for 150 is malformed.

For an engineer: these belong in **reference data** per instrument/venue, and every order-entry path must **validate against them** before submission. They also inform rounding: round prices to the tick, quantities to the lot, using an explicit rule — never trust a raw computed float to already sit on a valid tick. Ignoring them produces a steady drip of venue rejections that look like mysterious "order failed" bugs.

### Q13. Spot the domain bug: a service caches the "last price" and treats it as the current tradable price.

Two problems, both classic.

First, **last price is history**, not a live quote. It's the price of a *past* trade; the market may have moved since, and there may be no resting liquidity there now. The current tradable prices are the live **bid** (to sell) and **ask** (to buy). Quoting last-price as executable will mislead every downstream consumer.

Second, **caching a single number drops the side, size, venue, and timestamp.** Without a timestamp you can't tell a 50-millisecond-old price from a 50-minute-old stale one — and stale prices in fast markets cause real losses and bad marks.

The fix: model prices as a **timestamped, two-sided, sized time-series**, keep bid/ask separate from last-trade, and stamp every cached value with **source + timestamp** so consumers can reason about staleness (and apply a max-age policy). "Last price" is fine for a chart; it is not a quote, and a bare cached number is a lie about *when* and *which side*.

### Q14. Where do OTC swaps sit, and why do they carry so much more reference data than a listed equity?

A listed equity is fungible and standardised: one ISIN, a handful of attributes, and the exchange defines the rest. An **OTC swap** is a **bespoke bilateral contract** — negotiated terms like notional, the two legs (e.g. fixed vs floating), the floating rate index, payment schedules, day-count conventions, effective and maturity dates, and the specific counterparty. None of that is standardised by a central venue because there is no central venue.

So the **instrument itself is largely reference data**, and a lot of it. Where an equity's economics live in the market (its price), a swap's economics live in its **terms**, which your security/deal master must capture in detail. Swaps also often lack a clean public identifier — another reason they lean on internally-modelled reference data and effective-dated terms.

The engineer consequence: don't model a swap as "an instrument with a price." Model it as a **rich, versioned contract record** (with counterparty and full terms), whose valuation is computed by a pricing engine from those terms — you store and serve the terms and the resulting numbers, you don't derive the price.

### Q15. How does the same instrument end up with different prices across venues, and how should your data model handle it?

An instrument can trade on **multiple venues** simultaneously (multiple exchanges, dark pools, dealers). Each has its own order book, its own liquidity, and its own participants, so at any instant the best bid/ask differ slightly between them — that's normal market fragmentation, not bad data. (The consolidated "best across all venues" is a separate, computed view.)

So price is keyed by **(instrument, venue, timestamp)**, not by instrument alone. Your quote/trade store must carry a **venue** dimension:

```
quote(instrument_id, venue, bid_px, ask_px, ..., ts)
```

If you drop `venue`, you'll get "duplicate" quotes for the same instrument that are actually legitimate different-venue prices, and any dedup logic will silently clobber real data. When you need a single number (to mark a position), you make an **explicit choice** — a primary venue, an official close, or a consolidated best — and you record *which* source you used. This ties straight into the mark-price rule for NAV: store the price **source** alongside the value, because "the price" is always relative to a venue and a moment.

### Q16. Why is anonymity a core property of an exchange, and what does it change downstream?

On an exchange, the order book is **anonymous**: you match against the collective book without knowing (or choosing) who is on the other side. A central counterparty (the clearing house) then steps in as counterparty to both sides after the match. This is a deliberate design property — it enables open price discovery and means you don't take **counterparty credit risk** on a specific unknown participant.

Contrast OTC, where you deliberately face a **named counterparty** and *do* take credit exposure to them specifically.

The downstream data consequence: for exchange trades, the meaningful "counterparty" for risk purposes is the **clearing house / CCP**, not the anonymous other side — so a per-participant counterparty column would be empty or misleading. For OTC, the counterparty **is** the deal and drives credit-risk aggregation, netting, and collateral. Modelling both with the same "counterparty" semantics is a mistake: on-exchange, counterparty exposure collapses to the CCP; OTC, it's per-name and central to the risk picture. Your schema should reflect that these are structurally different relationships, not one nullable field.

## Market Data vs Reference Data

### Summary

**What this topic covers**

The single most important storage distinction in a financial system: **market data** versus **reference data**. This topic has 15 questions. **Market data** is the real-time firehose of prices, quotes, and trades — high-volume, append-mostly time-series, arriving as **ticks** and often aggregated into **OHLC bars**, exposed at **L1/L2/L3** fidelity. **Reference data** is the slow-changing, describe-the-world data — the **security master** (instrument attributes, identifiers), counterparties, calendars, currencies — rows that change rarely but are **read everywhere**. The whole point is that these two have **opposite characteristics**, and opposite characteristics demand **opposite stores**: a time-series/streaming store for market data, a cached/CDC-propagated store for reference data. The topic also covers **snapshots vs increments**, **data vendors**, handling **late and corrected** data, and the engineer's concrete storage and serving choices.

**Mental model**

Ask two questions of any piece of data: *how often does it change*, and *how is it read*. Market data changes constantly (thousands of updates a second per instrument) and is read as **recent values and range scans over time** ("last price," "yesterday's bars"). Reference data changes rarely (a new instrument, a renamed counterparty) but is read **on almost every operation** ("what are this instrument's attributes"). These are near-opposite profiles, so the naive instinct — "put it all in one `instruments` table with a `price` column" — is exactly wrong: you'd be hammering a slow-changing table with a firehose of writes and bloating hot reference reads. Instead: reference data lives in a **read-optimised, cacheable** store, propagated by **change-data-capture** when it does change; market data lives in a **write-optimised time-series** store or stream. The join between them (a trade or position referencing an instrument's canonical id, then decorated with its latest price) happens at read time.

**Key terms**

- **Market data** — real-time prices, quotes, and trades; a high-volume, append-mostly time-series.
- **Reference data** — static/slow-changing descriptive attributes (instruments, counterparties, calendars).
- **Security master** — the canonical reference-data store for instruments (one internal id + external-id mappings).
- **Tick** — a single market-data update (a new quote or trade print).
- **OHLC bar** — open/high/low/close over an interval; ticks aggregated into candles (1m, 1d).
- **L1 / L2 / L3** — top-of-book / aggregated depth / full per-order market-data fidelity.
- **Snapshot** — a full point-in-time image of state (whole book, or all fields).
- **Increment (delta)** — an incremental update applied on top of a snapshot.
- **Data vendor** — a provider of market and/or reference data (feeds, files, APIs).
- **CDC (change data capture)** — propagating reference-data changes to consumers/caches as they occur.
- **Corrected / late data** — a vendor revises or back-fills a previously published value.
- **Time-series store** — a write-optimised store for append-mostly, timestamp-keyed data.

**Why interviewers ask this**

This is the fastest way to tell whether a candidate has built real financial systems. Anyone can say "store the data"; a senior engineer instantly separates the two profiles and reaches for **different stores**, because they've felt the pain of a schema that conflated them. The question tests **data-modelling judgement under opposite access patterns** — a genuinely transferable systems skill (it's CQRS and hot/cold storage in domain clothing). Interviewers also probe the operational edges: late/corrected data, snapshot-vs-increment recovery, and CDC propagation — because those are where naive designs quietly break. Getting the split right, and justifying the store choice with the access pattern, is strong senior signal for any market-data, pricing, or platform role.

**Common confusions**

- "It's all just data, one table" — market and reference data have **opposite** write/read profiles; one table serves neither well.
- "Reference data is static" — it's **slow-changing**, not immutable; instruments get added, counterparties renamed, and those changes must propagate (CDC).
- "Latest price is an attribute of the instrument" — no; price is **market data (a time-series)**, the instrument is reference data. Don't glue a `last_price` column onto the security master and write to it constantly.
- "Market data is immutable once written" — mostly append-only, but vendors issue **corrections**; you must handle revisions without destroying the original.
- "A snapshot and an increment are interchangeable" — a snapshot is a **full image**; increments are **deltas** applied on top. You need both to recover correctly.
- "One vendor = one truth" — vendors disagree; the same instrument's price differs by source, so **store the source**.

**What follows from this topic**

Reference data is the security master from the identifiers topic — the canonical id everything joins through. Market data is the price stream produced by the venues in the previous topic (order-book output) and the input to marking positions in the next topic (NAV/PnL). The "store the source and timestamp" rule here is the same discipline that makes NAV reproducible and reconciliation possible. And the snapshot-plus-increment pattern reappears anywhere state is rebuilt from a stream — order books, event-sourced positions, and as-of queries.

### Q1. Explain the difference between market data and reference data to a new engineer.

**Market data** is the live pulse of the markets: prices, quotes, and trades, streaming in continuously. It's a **high-volume, append-mostly time-series** — thousands of updates per second per instrument, read as "latest" or as ranges over time.

**Reference data** describes the world the market data is *about*: an instrument's attributes (identifiers, currency, maturity), counterparties, holiday calendars. It **changes rarely** but is **read on nearly every operation** — every trade, every position, every valuation joins to it.

The one-line test: *how often does it change, and how is it read?* Market data changes constantly and is read as recent/range; reference data changes seldom and is read everywhere. Because those profiles are **opposite**, the engineer conclusion is that they belong in **different stores** — a write-optimised time-series for market data, a read-optimised cacheable store for reference data. Conflating them (a `last_price` column on the instrument table) means hammering a slow-changing table with a firehose. Keep them separate and join at read time on the canonical id.

### Q2. Why do opposite characteristics demand opposite stores?

Because a storage engine is tuned for a specific access pattern, and these two patterns pull in opposite directions.

**Market data**: enormous write throughput, append-mostly, timestamp-ordered, read as "latest" or time-range scans. That wants a **time-series store** (or a log/stream): cheap appends, time-partitioned, columnar range scans, aggressive retention/rollups. Random updates and rich joins are not the job.

**Reference data**: tiny write volume, but read on almost every request and needing correctness and joins. That wants a **read-optimised, cacheable, relational-ish** store — small, hot, heavily cached, propagated by **CDC** when it changes.

Put reference data in a time-series store and joins/updates are awkward; put market data in a normalised relational table and the write firehose and index churn crush it. This is CQRS/hot-cold thinking in domain clothing: **let the access pattern pick the store.** A single "one big table" compromise serves neither — slow reference reads, throttled market writes — which is why real systems physically split them.

### Q3. What are ticks, and how do OHLC bars relate to them?

A **tick** is a single market-data update — one new quote or one trade print. Ticks are the raw, finest-grained events, and they arrive fast and irregularly.

An **OHLC bar** (a "candle") aggregates all ticks in a fixed interval into four numbers — **open, high, low, close** — plus usually volume. A 1-minute bar summarises every tick in that minute; a daily bar summarises the whole session.

The relationship is **raw vs aggregate**, and it's a storage/serving trade-off. Tick data is complete but huge — expensive to store and scan. Bars are lossy but compact and answer most questions ("draw a chart," "what was the daily high") far cheaper. So systems typically **keep recent ticks hot, roll them up into bars, and retain bars long-term** while aging out or archiving raw ticks. Choosing the bar interval and retention is a classic engineering decision: match granularity to what consumers actually query, because you can always aggregate ticks into bars but never recover ticks from bars.

### Q4. Design the storage for a market-data feed you must query for "latest price" and "last 30 days of daily bars."

Restate: two very different reads — a hot **latest** lookup and a historical **range** scan — over an append-mostly firehose.

- **Ingest** ticks into an append-only **time-series store** (or a log first, then the store), **partitioned by time** and keyed by `(instrument_id, ts)`. Writes are cheap appends; no in-place updates.
- **Latest price**: maintain a small, hot **last-value cache** (`instrument_id -> latest tick`) updated on each tick, so the common read is O(1) and never scans the firehose.
- **Daily bars**: run a **rollup** aggregating ticks into OHLC bars, stored in a separate, compact table. "Last 30 days" is then a cheap indexed range scan over bars, not raw ticks.
- **Retention**: keep raw ticks hot for a short window, archive/age them out, keep bars long-term.

The shape here is CQRS: one write path (append ticks), several **read models** (last-value cache, bar rollups) each tuned to a query. Crucially, `instrument_id` is the **canonical security-master id** — never a raw ticker — so market data joins cleanly to reference data.

### Q5. What are snapshots and increments, and why do you need both?

An **increment (delta)** is an incremental update — "bid moved to 100.05," "add 500 at level 3." Feeds mostly send increments because they're small and frequent. But increments only make sense **relative to a prior state**: apply them from the wrong starting point and you get garbage.

A **snapshot** is a **full point-in-time image** — the entire book, or all current values — with a sequence number. It gives you a known-good base.

You need both because of **recovery and gaps**. Normal operation: load a snapshot, then apply the increment stream from that snapshot's sequence number onward. If you **disconnect or miss an increment** (detected via a sequence-number gap), you can't just resume — the deltas no longer apply to your stale state. You **re-request a fresh snapshot** and replay increments from there.

This is the same snapshot-plus-delta pattern as order books and event-sourced positions: **snapshot bounds the replay cost, increments carry the live changes**, and sequence numbers let you detect corruption. Tracking and validating those sequence numbers is the part naive implementations skip, and it's exactly what silently corrupts the data.

### Q6. Model the security master as reference data. What does it look like?

The security master is the canonical **reference-data** store for instruments: one internal id per instrument plus a mapping to every external identifier, because no external id is universal.

```sql
CREATE TABLE instrument (            -- canonical row, read everywhere
  instrument_id BIGINT PRIMARY KEY,  -- internal canonical id (the FK used by trades/positions)
  asset_class   TEXT NOT NULL,       -- equity | bond | future | option | swap ...
  currency      CHAR(3) NOT NULL,
  -- slow-changing descriptive attributes: name, maturity, coupon, tick, lot ...
);

CREATE TABLE instrument_xref (       -- one instrument -> many external ids
  instrument_id BIGINT NOT NULL,
  id_type       TEXT   NOT NULL,     -- ISIN | CUSIP | SEDOL | FIGI | TICKER
  id_value      TEXT   NOT NULL,
  valid_from    DATE   NOT NULL,     -- mappings change over time (renames, reuse)
  valid_to      DATE
);
```

Key reference-data properties visible here: **read everywhere** (so it's heavily cached), **slow-changing** (so a `valid_from/valid_to` effective-dated model, not last-write-wins), and **the canonical id is the FK** all business data uses. Trades and positions never key on a raw ticker — they key on `instrument_id` and join through the master. There is deliberately **no price column**: price is market data, a separate time-series, joined in at read time.

### Q7. Where should "latest price" live — on the instrument or elsewhere?

Not on the instrument. Latest price is **market data — a point on a time-series** — while the instrument is **reference data**. Gluing a `last_price` column onto the security master forces a slow-changing, read-everywhere table to absorb the market-data firehose: every tick becomes an `UPDATE` on a hot reference row, causing write contention, index churn, and cache invalidation on data that's supposed to change rarely.

Instead, keep the latest price in a **market-data read model** — a last-value cache or a time-series store — keyed by `instrument_id`. Consumers that need "instrument + its latest price" **join** reference and market data at read time on the canonical id.

The deeper point is a modelling one: a `last_price` column silently drops the **timestamp and source** that make a price meaningful, and it entangles two data domains with opposite lifecycles. Keep them physically separate; let each evolve at its own rate; join on the canonical id when a consumer needs both. This is the same separation the topic is built around, applied to the most tempting place to violate it.

### Q8. How do you handle late and corrected market data?

Vendors don't only append — they **revise**. A price arrives late (back-filled for an earlier timestamp) or a previously published value is **corrected**. If you treat market data as strictly immutable-and-final, you'll either drop the correction or overwrite history and lose the original.

Two disciplines:

- **Never destroy the original.** Model corrections as **new, versioned records**, not in-place overwrites — keep the original *and* the revision, each with its own arrival/effective time. This is bitemporal thinking: the value's *event time* (what instant it describes) is distinct from its *ingestion time* (when you learned it). A late tick has an old event time but a new ingestion time.
- **Make downstream recomputation possible.** Anything derived from a corrected value (a mark, a bar, a PnL) must be **recomputable** when the correction lands — so those derivations key off event time and can be replayed.

The engineer takeaway: market data is **append-mostly, not append-only-and-final.** Design for revisions from day one — versioned records, event-vs-ingestion time, and replayable derivations — because retrofitting correction handling onto an overwrite-based store is brutal, and silent overwrites destroy the audit trail regulators expect.

### Q9. What role do data vendors play, and what problems do they push onto you?

**Data vendors** are the external providers of market and/or reference data — via real-time feeds, end-of-day files, and APIs. Most firms buy rather than source raw exchange connectivity for everything, so vendors are a primary input.

The problems they push onto you:

- **Symbology mismatch** — each vendor uses its own symbol conventions and identifiers; the same instrument looks different across vendors, so you must **normalise to your canonical id** at ingest (via the security master), never string-match symbols.
- **Disagreement** — two vendors give different prices for the same instrument at the same time; neither is "wrong," so you must **store the source** and choose deliberately when you need one number.
- **Messiness** — reused tickers, renames, exchange suffixes, gaps, late/corrected values, format changes.
- **Timeliness & entitlement** — feeds have latency, and you're contractually limited in how you may store/redistribute the data.

The engineer conclusion: treat vendor ingest as a **normalisation and data-quality boundary** — map symbols to canonical ids, stamp every value with **source + timestamp**, and expect (and reconcile) disagreement. This is why "store the source" is a recurring rule: with multiple vendors, provenance *is* part of the data.

### Q10. Why is reference data a CDC candidate while market data is a stream?

Both need to reach consumers, but for opposite reasons and at opposite rates.

**Reference data** changes rarely but is **cached everywhere and read hot**. When it *does* change (new instrument, renamed counterparty), every cache holding the old value is now stale. **Change-data-capture (CDC)** solves exactly this: emit a change event when a reference row changes, and consumers/caches update incrementally instead of constantly re-polling a slow-changing table. Low change volume, high read fan-out → propagate the rare change.

**Market data** changes **constantly** and is inherently a **stream** — there's no "occasional change to propagate," it's a continuous firehose, so you model it as a subscription to a time-series/event stream from the start.

So the propagation mechanism follows the change profile: **CDC for the rarely-changing-but-widely-cached** reference data (turn a slow trickle of edits into invalidation/update events), and a **streaming subscription for the always-changing** market data. Same goal — keep consumers current — opposite tools, chosen by how often the underlying data moves.

### Q11. Spot the bug: a design stores quotes and instrument attributes in one `securities` table with a `bid`/`ask` column updated on every tick.

This conflates the two data domains, and it fails on both.

**On the write side**, every incoming tick becomes an `UPDATE` to the `securities` row. That table is meant to be slow-changing reference data (name, currency, maturity), but you've turned it into the target of a market-data firehose — write contention, massive index/WAL churn, and constant cache invalidation on rows that everything reads.

**On the read side**, hot reference reads (every trade/position joins here) now contend with the tick write storm, and you've lost history: overwriting `bid`/`ask` in place means **no time-series** — you can't answer "price at 14:00" or draw a chart, and you've dropped the **timestamp and source** that make a quote meaningful.

The fix is the core split: keep `securities` as **reference data** (slow-changing, cached, no price), and put quotes in a **market-data time-series/last-value store** keyed by `instrument_id`, with `ts` and `source`. Join at read time. One table trying to be both is slow to read, slow to write, and historically lossy — a textbook conflation.

### Q12. How do L1, L2, and L3 fidelity change the storage and cost equation?

They set the **volume** of market data you ingest and store, and volume drives cost.

- **L1 (top of book)** — best bid/ask + last trade. Low volume; enough to mark positions and price most things. Cheap to store, easy to keep hot.
- **L2 (depth)** — aggregated quantity at each price level. Meaningfully more data and update rate; needed for liquidity/impact analysis and routing.
- **L3 (full book)** — every individual order event (add/cancel/amend) with queue position. A firehose — orders of magnitude more than L1, and mostly cancels/amends that never trade.

The engineer decision is a **fidelity-vs-cost trade-off matched to consumption**: don't ingest, store, and replay full L3 depth if the system only marks positions off L1. Higher fidelity multiplies storage, retention, and processing cost, and forces harder choices about how long to keep raw data. Subscribe to the **lowest level that answers your queries**, and if only a few consumers need depth, isolate that expensive stream rather than paying L3 cost system-wide.

### Q13. Two vendors disagree on a price. How does your model cope?

Accept that disagreement is **normal**, not an error — different vendors sample different venues at different instants, so the same instrument legitimately shows different prices. A model that assumes one true price will either drop data or pick arbitrarily and hide the discrepancy.

Cope by making **source a first-class dimension**:

```
price(instrument_id, source, bid, ask, ts)   -- keyed by source, not overwritten across vendors
```

Store each vendor's value **side by side**, each stamped with `source` and `ts`. Nothing is "the" price until a consumer needs a single number, at which point you apply an **explicit policy** — a designated primary source, a hierarchy/fallback, or a rule like "official close for marks" — and you **record which source you used**.

This ties directly to reproducible marks and NAV: because you kept the source, you can later answer "which price did we mark with, and where did it come from," and reconciliation can explain a break as "we used vendor A, custodian used vendor B." **Store the source; choose deliberately; record the choice.** Silently overwriting one vendor with another destroys exactly the provenance you'll be asked to produce.

### Q14. What does "as-of" or point-in-time mean for reference data, and why can't it be last-write-wins?

Reference data changes over time — a counterparty is renamed, an instrument's attributes are updated, an id mapping is reassigned — and you frequently need to know **what it was at a past date**, not just now. That's an **as-of (point-in-time)** query: "what was this instrument's ISIN on the trade date?"

Last-write-wins destroys this: overwriting the row in place keeps only the current value, so historical questions become unanswerable and old trades get **re-decorated with today's attributes**, which is wrong and often non-compliant. A trade booked last year must reconcile and report against the reference data **as it stood then**.

So model reference data with **effective dating** (`valid_from` / `valid_to`) — versioned rows rather than mutation:

```sql
SELECT id_value FROM instrument_xref
WHERE instrument_id = :id AND id_type = 'ISIN'
  AND :as_of BETWEEN valid_from AND COALESCE(valid_to, 'infinity');
```

This is the same append-only, never-mutate discipline used for trades and market-data corrections: keep every version, key reads by the date you care about. "Slow-changing" is not "single static row" — it's **a history of versions**, and getting that wrong quietly corrupts every historical report.

### Q15. Design the end-to-end serving layer: a trade references an instrument and needs its attributes plus a current mark.

Restate: at read time, decorate a trade with **reference data** (instrument attributes) and **market data** (a current mark) — two domains, joined on the canonical id.

- The trade carries `instrument_id` (the **canonical security-master id**), never a raw ticker. That's the join key to both domains.
- **Reference side**: resolve attributes from the security master, served through a **cache** (kept fresh by **CDC** so rare changes propagate). Slow-changing, read-hot — perfect for caching.
- **Market side**: resolve the mark from the **market-data store** — a last-value cache for "current," or a time-series read for "as-of a timestamp." Stamp the result with **source + ts** so the mark is reproducible.
- **Join at read time**: `trade → instrument_id → (ref attributes) + (latest/as-of price)`.

Two subtleties that separate senior answers: use **as-of** semantics on *both* sides for historical/reproducible views (attributes and price *as they stood* at the relevant time, not today's), and always return the **price source and timestamp**, not a bare number. The architecture is CQRS end to end — separate stores tuned to opposite access patterns, stitched together on the canonical id, with provenance carried through so the same query is reproducible tomorrow.

## Portfolio Management, Accounting & NAV

### Summary

**What this topic covers**

How holdings are organised, valued, and accounted for — the layer where positions become a **portfolio**, get measured against a **benchmark**, and are struck into an official **NAV**. This topic has 16 questions covering: the **portfolio / book** as the unit of management; **benchmarks** as the yardstick; the crucial **IBOR vs ABOR** split (**investment** book of record vs **accounting** book of record) at a domain level; **fund accounting** and the daily **NAV strike**; **performance and attribution** treated as **data you store**, not maths you compute; **position-keeping vs accounting views** of the same holdings; how **corporate actions** and **pricing** feed NAV; what "**the close**" actually means; and **reconciling IBOR to ABOR**. The through-line: the same holdings are represented **twice** — a fast, real-time investment view and a slower, authoritative accounting view — and an engineer's job is to keep both correct and reconciled, not to reinvent the valuation maths.

**Mental model**

Picture one set of holdings observed through **two lenses**. The **IBOR** lens is the portfolio manager's: real-time, intraday, "what do I own *right now* so I can make decisions" — timely, position-focused, tolerant of provisional prices. The **ABOR** lens is the accountant's: end-of-day, authoritative, fully reconciled, "what is the official, auditable value of this fund" — the basis for the **NAV** investors transact on. They describe the *same* trades and positions but optimise for opposite things (timeliness vs authority), so firms deliberately maintain **both** and reconcile them. NAV is **struck** once a day: after **the close**, you take official prices, apply any **corporate actions**, value every position, sum assets minus liabilities, and divide by shares outstanding. It's a scheduled **batch** with a hard correctness bar, not a real-time number. Performance and attribution sit on top as **stored, queryable outputs** — you persist and serve them; a separate analytics/quant layer computes them.

**Key terms**

- **Portfolio / book** — a managed set of positions; the unit PMs run and report on (a portfolio, *not* a DB table).
- **Benchmark** — a reference index a portfolio is measured against (out/underperformance).
- **IBOR (Investment Book of Record)** — the real-time, intraday view of positions for investment decisions.
- **ABOR (Accounting Book of Record)** — the authoritative, reconciled accounting view; basis of official NAV.
- **NAV (Net Asset Value)** — assets − liabilities, per fund; per-share NAV = that ÷ shares outstanding.
- **NAV strike** — the daily process of computing official NAV after the close.
- **Fund accounting** — maintaining a fund's official books, positions, and NAV.
- **The close** — the official end-of-day price snapshot used for marks and NAV.
- **Corporate action** — an issuer event (dividend, split, merger) that changes positions/prices.
- **Performance** — return of a portfolio over a period (a number you store and serve).
- **Attribution** — decomposition of performance into contributing factors (stored data, not your maths).
- **Position keeping** — maintaining live positions from the trade stream (the IBOR engine).

**Why interviewers ask this**

This topic separates candidates who've worked in **asset management / fund services** from those who haven't. The IBOR-vs-ABOR distinction in particular is a strong senior signal: understanding *why a firm deliberately maintains two books of the same holdings* — and reconciles them — shows you grasp the real tension between **timeliness and authority**, which is a genuine architectural trade-off (CQRS-flavoured: a fast read model vs an authoritative one). Interviewers also probe whether you know your **lane**: a good engineer stores and serves NAV, performance, and attribution and gets the *data model and reproducibility* right, while leaving the valuation and attribution **maths to the quant/accounting layer**. Claiming to "compute the attribution" is a red flag; saying "I store it with its inputs so it's reproducible and auditable" is the right altitude.

**Common confusions**

- "IBOR and ABOR are the same book" — same *holdings*, two *views* optimised for opposite goals (real-time decisions vs authoritative accounting). Both exist on purpose.
- "NAV is real-time" — NAV is **struck once daily** after the close; it's a scheduled batch with a hard correctness bar, not a live tick.
- "The close is just the last trade" — it's an **official** end-of-day price (often an auction or a defined methodology), the authoritative mark — not merely the last print.
- "A portfolio is a table / the book is a ledger" — a **portfolio/book** is a managed set of positions, a *domain* concept, not a storage object.
- "Engineers compute performance and attribution" — you **store and serve** them (with inputs, for reproducibility); the maths belongs to analytics/quant.
- "Position keeping and accounting are one system" — the fast position-keeping (IBOR) engine and the reconciled accounting (ABOR) books are typically **separate**, then reconciled.

**What follows from this topic**

This is where the whole primer converges. The **positions** folded from immutable trades feed the portfolio; the **mark prices** come from the market-data and venue topics ("the close"); the **corporate actions** and **reference data** that adjust holdings come from the security master; and **reconciling IBOR to ABOR** is the same join-and-diff discipline as custodian reconciliation, applied internally. NAV is the point where prices, positions, corporate actions, and exact-decimal money all have to line up — and be reproducible tomorrow, which is why storing sources and timestamps everywhere finally pays off.

### Q1. What is a portfolio (or "book"), and why isn't it a database table?

A **portfolio** — colloquially a **book** — is a managed set of positions grouped for a purpose: a fund, a strategy, a trading desk's holdings. It's the unit a portfolio manager runs, reports on, and is measured on. "The book" is a classic finance false-friend: it means *a portfolio*, **not** a ledger and **not** a DB table.

Why the distinction matters to an engineer: a portfolio is a **domain grouping**, and the same underlying positions can belong to *overlapping* groupings — by strategy, by legal fund, by desk, by client — simultaneously. If you hard-model "portfolio" as one physical table with a single parent, you can't represent a position that rolls up several ways at once, or a hierarchy of sub-portfolios.

Model it as a **dimension/grouping over positions**, with positions referencing portfolio id(s) and portfolios able to form hierarchies — not as a rigid one-to-one container. And remember positions themselves are **derived** (a fold over trades), so "the book" is a *view* of computed positions grouped a certain way, not a writable table of truth. Getting the vocabulary right keeps your schema from lying to the PMs who live in this language.

### Q2. What is a benchmark and what does it mean for the data you store?

A **benchmark** is a reference — usually an index — that a portfolio is measured **against**. If a fund returns 8% and its benchmark returns 6%, it *outperformed* by 2% (the "excess return" or "active return"). Benchmarks define what "good" means for a portfolio.

For an engineer, a benchmark is **another time-series you must ingest, store, and align** — its levels/returns over time, from a data vendor — and then join to the portfolio's own returns over matching periods to produce relative performance. Two practical points: (1) the benchmark and the portfolio must be compared over **identical, aligned periods** (same dates, same currency, same return convention), or the comparison is meaningless; and (2) a portfolio's benchmark can **change over time**, so the mapping is **effective-dated**, not a static column.

You **store** the benchmark series and the portfolio-to-benchmark mapping; you generally **don't compute** the index yourself (the vendor does). Relative performance is then a stored/served output. As ever, keep the **source and timestamp** of the benchmark data so the comparison is reproducible.

### Q3. Explain IBOR vs ABOR at a domain level.

They are **two books of record over the same holdings**, optimised for opposite goals.

- **IBOR — Investment Book of Record**: the **real-time, intraday** view. "What do I own right now?" Built for the portfolio manager to make decisions during the day. Timely and position-focused; tolerant of provisional prices and not-yet-fully-reconciled data.
- **ABOR — Accounting Book of Record**: the **authoritative, end-of-day accounting** view. "What is the official, auditable value of this fund?" Fully reconciled, the basis of the official **NAV** investors transact on.

They describe the *same* trades and positions but trade off **timeliness vs authority**. IBOR answers fast and early; ABOR answers correctly and late. That's exactly why firms deliberately maintain **both** and reconcile them, rather than picking one.

The engineer framing is CQRS-flavoured: IBOR is a fast, low-latency **read model** for decisions; ABOR is the authoritative, reconciled record for accounting and reporting. Same source events, two materialisations tuned for different consumers. Understanding *why both exist* — not treating one as a redundant copy — is the senior signal here.

### Q4. Why would a firm maintain two books of the same positions instead of one?

Because one store can't be **both maximally timely and maximally authoritative**, and both properties are genuinely required by different consumers.

A portfolio manager trading intraday needs positions **now** — waiting for full reconciliation and official prices would make the data useless for decisions. That's IBOR: fast, intraday, provisional-prices-OK.

Fund accounting and investors need the **official, reconciled, auditable** value that money changes hands on — which requires waiting for the close, official prices, corporate-action processing, and reconciliation. That's ABOR: authoritative but end-of-day.

Forcing one system to serve both means either the fast users wait for accounting-grade rigor (too slow) or the accounting is based on provisional intraday data (not authoritative enough). So you build **two read models over the same underlying trade events**, each tuned for its consumer, and **reconcile** them so discrepancies surface and get explained.

This is the classic timeliness-vs-consistency trade-off in domain form. The engineer's job isn't to collapse them into one — it's to keep both correct from the same source of truth and to **reconcile IBOR to ABOR** so the fast view and the authoritative view agree by end of day.

### Q5. What is fund accounting and the daily NAV strike?

**Fund accounting** is maintaining a fund's **official books** — its positions, cash, income, expenses, and ultimately its **NAV**. It's the ABOR world: authoritative, reconciled, auditable.

The **NAV strike** is the daily process that produces the fund's official Net Asset Value. Conceptually, after **the close**:

1. Take **official closing prices** for every instrument held.
2. Apply any **corporate actions** effective that day (dividends, splits, etc.).
3. **Value** every position (qty × official price, in the right currency, converted at recorded FX rates).
4. Sum **assets − liabilities** (including accrued income/expenses).
5. Divide by **shares outstanding** → **per-share NAV**.

The engineer point: this is a **scheduled end-of-day batch with a hard correctness bar**, not a real-time number. It has clear inputs (positions, official prices, corporate actions, FX), a defined sequence, and a strict output that investors transact on — so it must be **reproducible and auditable**: store which prices, which FX rates, which corporate-action data, and which timestamp fed each strike. If you can't reproduce yesterday's NAV from stored inputs, you can't defend it — and NAV is exactly the number regulators and auditors scrutinise.

### Q6. Why is NAV a batch process and not a real-time value?

Because striking NAV depends on inputs that are **only final after the close** and require **reconciliation**, and NAV must be **authoritative**, not merely current.

- It uses **official closing prices** ("the close"), which don't exist until the session ends.
- It must incorporate the day's **corporate actions**, which have effective dates and defined processing.
- It requires **reconciled** positions and cash (ABOR-grade), not provisional intraday numbers.
- It's the price investors **subscribe and redeem at**, so "roughly right, right now" is unacceptable — it must be correct and defensible.

So NAV is a **scheduled batch** that runs after the close with a hard correctness bar. You *can* compute an intraday, indicative estimate for decision-making — that's what the IBOR/real-time view is for — but that's explicitly **not the official NAV**. Conflating "indicative intraday value" with "struck NAV" is the bug: they have different inputs (provisional vs official prices), different rigor (unreconciled vs reconciled), and different consumers. Model NAV as a reproducible batch output stamped with all its inputs; model intraday value as a separate, clearly-labelled estimate.

### Q7. Design an end-of-day NAV/PnL calculation that's also queryable intraday.

Restate: one authoritative EOD number, plus a live intraday view — two consumers, opposite needs.

- **Source of truth**: the immutable **trade event stream**; positions are a **fold** over it (event-sourcing). Both views derive from the same events.
- **Intraday (IBOR) read model**: fold trades in real time, mark with **provisional/latest prices**, serve an **indicative** intraday PnL/value. Fast, low-latency, explicitly labelled non-official.
- **EOD (ABOR) strike**: a scheduled **batch** after the close using **official prices**, applied **corporate actions**, reconciled positions, recorded FX — producing the authoritative NAV/PnL.
- **As-of / point-in-time**: store snapshots + deltas so you can query "value as it stood at time T," not just now — bitemporal, not last-write-wins.
- **Reproducibility**: stamp each strike with its inputs (price source + ts, FX rates, corporate-action set) so it can be recomputed and audited.

This is **CQRS with two read models over one event log**: a fast indicative view and an authoritative batch view, reconciled to each other. The senior moves are separating provisional from official prices, making the strike reproducible, and supporting as-of queries — plus knowing you **store** the numbers and leave valuation maths to the pricing layer.

### Q8. What does "the close" actually mean, and why store the price source?

**The close** is the **official end-of-day price** for an instrument — the authoritative mark used for EOD valuation and the NAV strike. Critically, it is **not simply the last trade** of the day: exchanges often determine an official close via a **closing auction** or a defined methodology, and for some instruments the "close" is a specified snapshot or vendor-provided official price. It's an *official* number with rules behind it.

Why an engineer must store the **source and timestamp**: the *same position* produces a *different* NAV/PnL depending on **which** close you used (which venue, which vendor, which methodology, what time). If you persist only the number, you can't answer "why did today's NAV differ from the custodian's?" or "what price marked this position?" — and you can't reproduce the strike. A break in NAV reconciliation is frequently just **two different close prices**, and you can only diagnose that if both sides recorded their source.

So: never store a mark as a bare number. Store **(price, source, timestamp, methodology)**. "The close" is a decision about *which official price*, and that decision is part of the data — exactly the provenance discipline the market-data topic insists on, now load-bearing for the number investors transact on.

### Q9. How do corporate actions feed into NAV, and why are they a headache?

A **corporate action** is an issuer event that changes positions and/or prices: a **dividend** (cash or stock), a **stock split**, a **merger**, a spin-off, a rights issue. They feed NAV because they **alter the holdings or their value** on an **effective date**, and the strike must reflect them: a 2-for-1 split doubles the share count and halves the price; a cash dividend adds cash (or a receivable) and drops the price.

They're a headache for several reasons:

- **Effective-dated and sequenced** — they apply on a specific date and must be processed in the right order relative to the close; get the timing wrong and NAV is off.
- **They mutate reference data and positions** — share counts, prices, even identifiers can change, so the security master and positions must be adjusted consistently.
- **Vendor data is messy and sometimes late/corrected** — so you must handle revisions without destroying history.
- **They must never silently overwrite** — apply them as **new adjusting events**, preserving the pre-action state for audit.

The engineer takeaway: model corporate actions as **effective-dated events that adjust positions/prices**, apply them deterministically into the NAV strike, and keep them **auditable and reproducible** — never as an in-place `UPDATE` to a holding. They're one of the main reasons the NAV strike must record exactly which inputs it consumed.

### Q10. How should an engineer treat performance and attribution?

As **data you store and serve** — with their inputs — **not maths you invent**.

**Performance** is a portfolio's return over a period; **attribution** decomposes that return into contributing factors (which holdings, sectors, or decisions drove out/underperformance vs the benchmark). The actual computations — return methodologies, attribution models — belong to the **analytics/quant/accounting** layer. This is the recurring "know your lane" rule: the same way Greeks and VaR are pricing-desk maths you merely store, performance and attribution numbers are outputs you **persist, key, and serve**.

Your engineering job is to get the **data model and reproducibility** right:

- Store the results **keyed by portfolio, period, and (for attribution) factor/bucket**, with currency and return convention explicit.
- Store the **inputs and source** (positions, prices, benchmark series, FX) so any number is **reproducible and auditable** — you can defend "how was this computed" months later.
- Serve them efficiently to reporting/client-facing consumers.

Saying "I'll compute the attribution" is the wrong altitude and a red flag. Saying "I store attribution with its inputs and sources so it's reproducible and reconcilable" is exactly right. You own the pipeline, storage, and provenance; the analytics layer owns the formulas.

### Q11. Distinguish position keeping from the accounting view of the same holdings.

They're **two systems over the same holdings**, matching the IBOR/ABOR split.

**Position keeping** is the **real-time engine** that maintains live positions by folding the trade stream — the IBOR side. Its job is to answer "what do we hold *now*" fast, intraday, as trades flow in. It's optimised for **timeliness and throughput**: per-portfolio ordering, idempotency on retries, snapshots to bound replay.

The **accounting view** is the **authoritative books** — the ABOR side — where the same holdings are recorded for official valuation, NAV, and reporting. It's optimised for **correctness and auditability**: reconciled, official prices, corporate actions applied, full audit trail.

They're typically **separate systems** because the requirements diverge: the position keeper favors low latency and can tolerate provisional data; the accounting books favor rigor and reconciliation and run on an EOD cadence. You build both from the **same trade events**, then **reconcile** them so the fast operational view and the authoritative accounting view agree.

The engineer error is assuming one system does both. It rarely does — and modelling them as one either starves the traders of timeliness or the accountants of rigor. Same events, two materialisations, reconciled.

### Q12. How would you reconcile IBOR to ABOR?

Same discipline as custodian reconciliation — a **join + diff on two representations of the same holdings** — but internal.

- **Ingest** both views for the same as-of point: the IBOR positions (fast, possibly provisional) and the ABOR positions (reconciled, official).
- **Normalise** to a common shape and key — `(portfolio, instrument, as-of date)` — accounting for convention differences (which prices, sign, currency).
- **Match** on the key; **diff** quantity, value, and cash, applying **tolerances** for expected small differences (e.g. provisional vs official price rounding).
- **Classify**: matched vs **break** (a genuine discrepancy to investigate — a missed trade, a late corporate action, a price difference, an unposted cash movement).
- **Report** aged breaks for ops to chase until cleared.

The point of reconciling is to **prove the fast view and the authoritative view agree** by end of day, and to surface anything the intraday system got provisionally wrong once official data lands. Common break causes are exactly the IBOR/ABOR differences: provisional vs official prices, not-yet-applied corporate actions, timing of trade booking.

Engineer-wise this is **idempotent loaders, a match+diff pipeline, tolerances, and aged-break reporting** — the same recon machinery you'd point at a custodian feed, turned inward. It's data-quality work (join and diff on imperfect data), not arithmetic.

### Q13. Model a fund's NAV so yesterday's number is reproducible.

Restate: NAV must be **defensible** — you have to reproduce any past strike exactly from stored inputs.

Store the strike as an **immutable, input-stamped record**, not a bare number:

```sql
CREATE TABLE nav_strike (
  fund_id           BIGINT NOT NULL,
  as_of_date        DATE   NOT NULL,       -- the valuation date
  nav_total         DECIMAL(20,4) NOT NULL,-- assets - liabilities (exact decimal, never float)
  shares_outstanding DECIMAL(20,6) NOT NULL,
  nav_per_share     DECIMAL(20,8) NOT NULL,
  currency          CHAR(3) NOT NULL,
  struck_at         TIMESTAMPTZ NOT NULL,  -- when this strike ran
  PRIMARY KEY (fund_id, as_of_date, struck_at)
);
-- plus the inputs that produced it:
--   position snapshot used, price set (with source+ts per instrument),
--   FX rates used, corporate-action set applied
```

Key moves: **exact-decimal money** with currency (never float — rounding errors compound and break the number investors transact on); **store every input** (positions, official prices *with source and timestamp*, FX rates, corporate actions) so the strike is a pure function of recorded data; and treat corrections as **new versioned strikes** (`struck_at` in the key), never in-place `UPDATE` — so a restated NAV keeps the original *and* the revision for audit.

The recurring insight lands here: NAV is the point where positions, official prices, corporate actions, FX, and exact money all converge — and it must be **append-only, input-stamped, and reproducible**, because it's the most audited number the fund produces.

### Q14. A junior stores only the final NAV number each day. What's the risk?

The number becomes **undefendable and irreproducible**, which for the most-scrutinised figure a fund produces is a serious problem.

Concretely, if you keep only the output:

- You **can't answer "how was this computed"** — which prices, which FX rates, which corporate actions, which positions. Auditors and regulators ask exactly this, sometimes years later.
- You **can't diagnose a reconciliation break** against the custodian or administrator — "our NAV is 100.12, theirs is 100.15" is unresolvable without both sides' inputs.
- You **can't restate correctly** — if a price or corporate action was later corrected, you can't recompute the affected strike, and if you overwrite the old NAV you destroy the original.
- You **lose provenance** — no source/timestamp on the marks that drove the value.

The fix is the reproducibility model: store the NAV **with all its inputs** (positions, prices *with source + ts*, FX, corporate actions) and treat restatements as **new versioned records**, never overwrites. NAV must be a **reproducible function of stored inputs**. A bare daily number is a claim you can't back up — and "we can't reproduce it" is not an acceptable answer for a value investors transacted on.

### Q15. Why are performance figures currency- and period-sensitive, and what must you store?

Because a return is meaningless without saying **in what currency** and **over exactly what period** — change either and the number changes.

**Currency**: a portfolio holding foreign assets returns differently in its base currency than in the local currency, because **FX moves** are part of the return. "8%" in USD is not "8%" in EUR. So a stored performance number is tied to a specific **reporting currency**, and you must record it (and the FX rates used to convert), or the figure is ambiguous.

**Period**: returns are defined over **exact date boundaries** with a specific **return convention** (and how flows/subscriptions are treated). "Last month" vs "last 30 days," inclusive vs exclusive endpoints, gross vs net of fees — each yields a different number. Comparing a portfolio to its **benchmark** requires **identically aligned** periods and currency, or the comparison lies.

So store performance as a number **keyed by portfolio, period boundaries, reporting currency, and convention**, with its **inputs and source** for reproducibility — never a bare percentage. This is the same provenance discipline as NAV and market data: the context (currency, period, convention, source) *is* part of the data, and dropping it makes the figure both non-comparable and indefensible. And remember: you **store and serve** these; the return maths belongs to the analytics layer.

### Q16. How does this topic tie the whole primer together?

This is where every earlier thread converges into one auditable number.

- **Positions** here are the **fold over immutable trades** from the positions/PnL topic — the portfolio is a grouping of those derived positions, not stored truth.
- The **marks** come from the **venues and market-data** topics — "the close" is an official price sourced from an exchange/vendor, with source and timestamp carried through.
- **Corporate actions and identifiers** come from **reference data / the security master** — effective-dated events that adjust holdings before the strike.
- **Reconciling IBOR to ABOR** is the same **join + diff** discipline as **custodian reconciliation**, turned inward.
- **Exact-decimal money with currency**, **FX rates recorded on conversion**, and **append-only, never-overwrite** history are the money and audit rules from the patterns topics — and NAV is precisely where they all have to hold at once.

The unifying engineer insight: NAV is the point where **positions, official prices, corporate actions, FX, and exact money must all line up — and be reproducible tomorrow**. Every "store the source and timestamp," "never float for money," "positions are derived," and "never mutate, post a new event" rule the primer has been repeating exists so that this final number can be computed, defended, and reconciled. Get those invariants right upstream and NAV falls out cleanly; get them wrong and it's unreproducible at the worst possible place.
## Risk & Regulation Vocabulary

### Summary

**What this topic covers**

The vocabulary of risk and regulation as it lands on an engineer's desk — not the maths, the *plumbing*. Three concern areas: (1) the **four canonical risk types** — market, credit, operational, liquidity — and what loss each names; (2) how risk actually shows up in *your* systems — as **columns you store, numbers you serve, and limits you check**, while a separate risk engine (owned by quants) computes the scary figures (VaR, greeks, exposures); and (3) the **regulatory alphabet soup** — MiFID II, EMIR, Dodd-Frank, Basel, KYC/AML, trade/transaction reporting, best execution — and the one structural demand every regulation makes of your architecture: an **immutable, reconstructable audit trail**. The 16 questions here are about fluency, not calculation. You will never be asked to derive a VaR in a fintech engineering interview; you *will* be asked why you can't `UPDATE` a booked trade, what a limit check is, and what "the regulator can reconstruct who did what, when, from what input" means for your schema.

**Mental model**

Draw a line down the middle of the system. On one side is the **risk engine** — a quant-owned service that consumes positions and market data and emits numbers: VaR, greeks (delta, gamma, vega), exposures, sensitivities. On the other side is **everything you build**: the systems that feed it positions, store its outputs, attach those outputs to portfolios, check them against limits, and surface breaches to a human. You are the *transport and storage layer for risk*, not the calculator. This reframes every risk question. "How would you handle VaR?" is not "derive VaR" — it is "store a `(portfolio, measure, value, as_of, source)` row, serve it fast, alert when it crosses a limit." Regulation applies the same reframe: a regulation is rarely a formula, it is a *constraint on how you build* — retain records for N years, prove lineage from any figure back to its inputs, never silently mutate, segregate who-can-change from who-can-approve. Design for append-only history and full lineage on day one; retrofitting it after a regulator asks is brutal.

**Key terms**

- **Market risk** — loss from prices, rates, or FX moving against you.
- **Credit risk** — loss from a counterparty defaulting or failing to pay.
- **Operational risk** — loss from failures in people, process, or systems (bugs, outages, fat-finger).
- **Liquidity risk** — inability to sell or fund a position without taking a big loss.
- **Limit** — a threshold on an exposure/position/loss that must not be breached; a first-class system object.
- **Limit check** — the (often pre-trade) validation that an action keeps you inside a limit.
- **VaR (Value at Risk)** — a headline "how much could I lose" number; you store and serve it, you don't compute it.
- **Greeks** — price sensitivities (delta, gamma, vega...); more numbers your system stores, a pricing concern to derive.
- **MiFID II** — EU markets regulation; drives transaction reporting and best execution.
- **EMIR / Dodd-Frank** — EU / US derivatives regulation; drives trade reporting to repositories and central clearing.
- **Basel** — international bank capital/liquidity framework (Basel III/IV); shapes what banks must hold.
- **KYC / AML** — Know Your Customer / Anti-Money-Laundering; onboarding checks and transaction monitoring.
- **Best execution** — the duty to get the client the best available terms; you must be able to *evidence* it.
- **Audit trail** — the immutable who/what/when/from-what-input record regulators reconstruct from.

**Why interviewers ask this**

For a fintech or bank engineering role this is a fluency-and-instinct check, not a finance exam. The junior tell is treating risk as arithmetic ("I'd calculate the VaR...") — nobody's asking you to. The senior signal is knowing the *system's* relationship to risk: you surface it as columns and limits, you store the source and timestamp of every number, you never let a limit check silently pass on stale data. On regulation, the junior answer is naming acronyms; the senior answer is knowing what each one *makes you build* — MiFID II means a transaction-reporting feed, KYC means an onboarding gate, best execution means you retain the quotes you could have hit. Above all, interviewers want to see that "immutability and audit trail" is a reflex for you: that you'd reach for a compensating entry, not an `UPDATE`, without being told. That instinct is the difference between someone who's shipped in a regulated shop and someone who hasn't.

**Common confusions**

- "Risk = VaR" — VaR is one market-risk *measure*. Credit, operational, and liquidity risk are different loss sources entirely.
- "I compute the risk numbers" — no. A risk engine (quant-owned) computes; you store, serve, and limit-check them.
- "Greeks are my problem" — they're pricing sensitivities; for you they're just more decimals in a row.
- "A limit is a config value" — a limit is a first-class object with an owner, an as-of, a scope (desk/portfolio/counterparty), and an audit history.
- "Fix the bad number with an UPDATE" — never. Post a compensating/reversing entry so the original *and* the correction both survive.
- "Regulation is legal's problem" — regulation dictates your data retention, your immutability, your segregation of duties, your lineage. It is an architectural input.
- "Best execution means cheapest price" — it's best *available terms* (price, cost, speed, likelihood), and you must be able to *prove* it after the fact.

**What follows from this topic**

Risk and regulation are the *why* behind patterns the other topics teach as *how*. The immutability demand here is exactly the event-sourcing model in Financial-Systems Engineering Patterns — trades are append-only, corrections are compensating events. The audit-trail requirement is why the Money, Accounting & Ledgers topic insists on double-entry and derived balances: a ledger is a regulator-friendly audit trail by construction. Limits and exposures ride on top of the position-keeping and reconciliation machinery from the earlier topics. Read this topic as the constraints that make the engineering patterns non-negotiable rather than nice-to-have.

### Q1. Explain the four main types of financial risk to an engineer — and which one is most often *your* fault.

Four canonical buckets, each named by *what loss it describes*:

| Risk | Loss from | Owns the number |
|---|---|---|
| **Market** | Prices/rates/FX moving against you | Risk engine (VaR, greeks) |
| **Credit** | A counterparty defaulting / not paying | Risk engine (exposure, PD) |
| **Operational** | Failures in people, process, systems | *Everyone — including you* |
| **Liquidity** | Can't sell/fund a position without a big loss | Treasury / risk |

The one most often *your* fault is **operational risk** — bugs, outages, a bad deploy, a fat-finger that your UI let through, a rounding error that corrupts a reconciliation. Market/credit/liquidity risk are about the world moving; operational risk is about *your system failing*. That's why regulators care about change control, testing, and audit trails: they're operational-risk controls. When you ship a financial system, you are directly reducing (or creating) operational risk. Frame it that way in an interview — it shows you understand where an engineer sits in the risk picture.

### Q2. VaR and the "greeks" keep coming up. As an engineer, what is your relationship to them?

You **store and serve** them; you do **not** compute them. VaR ("how much could this book lose over a horizon at some confidence") and the greeks (delta, gamma, vega — price sensitivities) are outputs of a **risk/pricing engine** owned by quants. Your systems feed that engine positions and market data, and consume its results.

So the engineering shape of a "VaR" feature is a row, not a formula:

```sql
CREATE TABLE risk_measure (
  portfolio_id  BIGINT       NOT NULL,
  measure       TEXT         NOT NULL,   -- 'VaR_1d_99', 'delta', 'vega'
  value         DECIMAL(28,8) NOT NULL,
  currency      CHAR(3),                 -- for money-valued measures
  as_of         TIMESTAMPTZ  NOT NULL,   -- the snapshot the engine ran on
  source        TEXT         NOT NULL,   -- which engine/run produced it
  PRIMARY KEY (portfolio_id, measure, as_of)
);
```

Note `as_of` and `source`: the *same* portfolio has different VaR depending on which market snapshot and which model produced it, so a bare number is meaningless — store its provenance. Your job is fast serving, correct joins to the portfolio, and limit checks against these values. Never volunteer to derive the maths in an interview; that's not the engineer's lane.

### Q3. What is a limit, and how would you model limits and limit checks as a system concern?

A **limit** is a threshold on some exposure that must not be breached — max position in an instrument, max loss per desk, max exposure to a single counterparty, max notional per trader. A **limit check** validates that a proposed or current state stays inside the limit; the valuable ones are **pre-trade** (block the order before it's sent) as well as post-trade (alert on breach).

Model limits as first-class rows, not config constants:

```sql
CREATE TABLE risk_limit (
  limit_id     BIGINT PRIMARY KEY,
  scope_type   TEXT,          -- 'desk' | 'portfolio' | 'counterparty' | 'trader'
  scope_id     TEXT,
  measure      TEXT,          -- what's being limited
  threshold    DECIMAL(28,8),
  currency     CHAR(3),
  effective_from TIMESTAMPTZ,
  owner        TEXT,          -- who set it (audit)
  updated_by   TEXT
);
```

A check is then: fetch the relevant limit(s) for the scope, compute current exposure (a position fold + a risk measure), compare with the threshold and a tolerance, and on breach either **hard-block** (pre-trade) or **raise an alert + record the breach** (monitoring). Two engineering traps: (1) a limit check on **stale** data is worse than no check — always carry the `as_of` of the exposure you checked; (2) limit *changes* are themselves auditable events (who raised the limit, when, why), so a limit history is append-only like everything else.

### Q4. Why are audit trail and immutability non-negotiable in financial systems?

Because a regulator, an auditor, or your own risk team must be able to **reconstruct who did what, when, and from what input data** — sometimes years after the fact. "The balance is $4.2m" is not an acceptable answer; "here is every entry that produced $4.2m, each stamped with its actor, timestamp, and source input" is.

That single requirement forbids the thing engineers reach for by reflex: mutating a row. If you `UPDATE booked_trade SET quantity = 90 WHERE id = 123`, you have *destroyed* the evidence that it was ever 100 and that someone changed it. The regulatory-safe move is to **never mutate a financial fact** — you append a new event that supersedes or reverses the old one, and both survive.

```text
-- WRONG: evidence destroyed
UPDATE trade SET qty = 90 WHERE id = 123;

-- RIGHT: original + correction both survive
INSERT trade_event (trade_id=123, type='CORRECTION', qty_delta=-10,
                    actor='alice', ts=now(), reason='booking error');
```

Concretely this means: append-only event logs (or bitemporal tables), mandatory `who / when / source` audit columns on every financial record, and full lineage from any output figure back to its inputs. Design it in from day one — bolting immutability onto a mutable schema after a regulator asks is one of the most painful retrofits in the industry.

### Q5. A junior "fixes" a wrongly-booked trade with `UPDATE trade SET quantity = 90 WHERE id = 123`. Spot the domain bug.

The bug isn't SQL — the statement is valid. The bug is **destroying an immutable financial fact**. A booked trade is an event that *happened*; the record said 100, downstream systems (positions, PnL, settlement, the counterparty's confirmation, the custodian's books) already consumed 100. Silently rewriting it to 90:

1. **Erases the audit trail** — there is now no evidence it was ever 100, or that anyone changed it, or why. A regulator reconstructing the day cannot.
2. **Desynchronises downstream state** — positions and PnL folded 100 into their aggregates; an in-place `UPDATE` doesn't retro-fix those, so your books now disagree with reality *and* with each other → a reconciliation break.
3. **Breaks idempotency and replay** — if positions are event-sourced, mutating the source event means replaying the log no longer reproduces the state anyone saw.

The correct fix is a **compensating event**: post a correction (`qty_delta = -10`, or a full reversal + rebook) stamped with actor, timestamp, and reason. Now the original booking, the correction, and the resulting 90 all survive, downstream systems consume the correction like any other event, and the audit trail is intact. "Never silently correct a number — reverse and re-book" is the reflex the interviewer is checking for.

### Q6. What is KYC/AML, and where does it touch the systems an engineer builds?

**KYC (Know Your Customer)** is the onboarding duty to verify who a client actually is — identity documents, ownership structure, sanctions/PEP screening — before you let them transact. **AML (Anti-Money-Laundering)** is the ongoing duty to detect and report suspicious activity once they're onboarded.

For an engineer these are not abstract compliance words, they're concrete system features:

- **Onboarding gate** — a client cannot trade/transact until KYC status is `verified`; that's a state machine and a hard check on the transaction path, not a checkbox.
- **Screening integrations** — calls to sanctions/PEP/watchlist providers, with the results *stored and timestamped* (you must prove you screened, and when).
- **Transaction monitoring** — rules/ML flagging unusual patterns (structuring, velocity, geography) and generating alerts/SARs for a human to review.
- **Immutable records** — every check, every decision, every override, retained for years and reconstructable.

The engineering theme is the same as everywhere else in this primer: it's a state machine plus an append-only audit trail. The domain bug to avoid is treating KYC as a one-time boolean; it's a lifecycle (`pending → verified → under_review → offboarded`) with periodic re-verification.

### Q7. Explain MiFID II, EMIR, Dodd-Frank, and Basel in one line each — and what each makes you build.

These are the regulations most likely to shape a system you touch. You don't need the legal text; you need what each one *demands of your architecture*:

| Regulation | Jurisdiction / scope | What it makes you build |
|---|---|---|
| **MiFID II** | EU markets/investment | Transaction reporting feeds, best-execution evidence, timestamped order/quote records |
| **EMIR** | EU derivatives | Trade reporting to a trade repository; central-clearing routing |
| **Dodd-Frank** | US markets/derivatives | Swap reporting, clearing, position limits |
| **Basel (III/IV)** | Bank capital & liquidity | Capital/liquidity calc inputs; risk-data aggregation (BCBS 239) |

The unifying engineering pattern is **reporting**: several of these boil down to "emit a complete, accurate, timely record of every relevant transaction to an external body, and be able to prove it later." That means an append-only source of trades, a reliable reporting pipeline (with dedup/idempotency so you don't double-report), and retained evidence. In an interview, don't recite legal detail — say "each of these is, from my side, a reporting-and-retention obligation: a feed out plus immutable records I can reconstruct."

### Q8. Explain trade reporting vs transaction reporting — and why the distinction bites an engineer.

They sound like synonyms and engineers conflate them, but they serve different regulators and different purposes:

- **Trade reporting** (e.g. EMIR, Dodd-Frank) — report the *economics of a derivative/trade* to a **trade repository** so regulators can see systemic risk and exposures across the market. Audience: systemic-risk supervisors.
- **Transaction reporting** (e.g. MiFID II) — report the *details of a transaction* (who, what, when, price, venue, client) to a **regulator** for market-abuse surveillance and best-execution oversight. Audience: conduct/market-abuse supervisors.

The bite for an engineer: they have **different fields, different timelines, different destinations, and different reference data**, so you can't serve both from one naive feed. The same executed trade may need to go to a trade repository *and* to a national regulator with different schemas and identifiers (LEIs for parties, ISINs/UPIs for instruments). Build them as separate reporting pipelines off a common append-only trade log, each with its own mapping and its own idempotent delivery. Treating "reporting" as one endpoint is the domain bug.

### Q9. What is best execution, and what does it demand of your data model?

**Best execution** is the duty to obtain the best available *terms* for a client's order — and "terms" is not just headline price; it's price, cost, speed, likelihood of execution and settlement, and size. The regulatory sting is that you must be able to **evidence** it after the fact, sometimes much later.

That last word is the engineering requirement. To prove you got best execution, you must **retain the state of the world you decided against**: the quotes/venues available at decision time, the order's timestamps through its lifecycle, the venue chosen and why. So your data model needs:

- **High-resolution, synchronised timestamps** on every order event (arrival, routing, execution) — clock quality is itself regulated.
- **Captured market context** — the competing quotes/venues at the decision instant, not just the fill you took.
- **Immutable order lifecycle** — order → routing decision → execution → fill, append-only.

The domain bug is storing only the fill ("we traded at 100.2") and discarding the alternatives. Best execution is proved by what you *could* have done and didn't; if you only keep the outcome, you cannot evidence the decision. Capture the decision context, not just the result.

### Q10. How does regulation constrain *how* you build, beyond just "keep records"?

Regulation reaches past data retention into your **process and system design**. Four recurring constraints:

- **Change control** — production changes are reviewed, approved, and logged. No ad-hoc hotfixes to prod data; a change is itself an auditable event.
- **Segregation of duties** — the person who writes/requests a change cannot also be the one who approves it in production. This maps directly to your permission model: `requester != approver` is an enforced invariant, not a policy PDF.
- **Data retention** — records kept for N years; deletion is policy-driven and logged, never a casual `DELETE`.
- **Lineage** — every figure must trace back to its source inputs. A reported number you can't explain is a finding.

For an engineer this means designing systems where **audit is a feature, not an afterthought**: append-only histories over in-place mutation, roles that enforce maker/checker separation, and lineage metadata threaded through the pipeline. If your architecture makes it *technically impossible* to change prod data without an approved, logged, attributable event, you've built the control into the system instead of relying on humans to behave. That's the senior instinct interviewers probe for.

### Q11. Design the audit-trail backbone for a trade-booking system so a regulator can reconstruct any past state.

Two requirements drive the design: **immutability** (nothing is ever destructively changed) and **bitemporality** (you can answer both "what is true now" and "what did we *believe* was true as of date X" — because corrections arrive late).

Sketch:

```sql
CREATE TABLE trade_event (
  event_id     BIGINT PRIMARY KEY,      -- append-only, never updated
  trade_id     BIGINT NOT NULL,         -- business key of the trade
  event_type   TEXT   NOT NULL,         -- BOOK | AMEND | CANCEL | CORRECT
  payload      JSONB  NOT NULL,         -- the economics at this event
  actor        TEXT   NOT NULL,         -- who
  system_ts    TIMESTAMPTZ NOT NULL,    -- when we recorded it (transaction time)
  effective_ts TIMESTAMPTZ NOT NULL,    -- when it applies to (valid time)
  source_ref   TEXT   NOT NULL          -- upstream message / input id (lineage)
);
```

Rules of the backbone:

1. **Insert-only.** No `UPDATE`/`DELETE` on `trade_event`. An amendment or cancel is a *new* event referencing `trade_id`.
2. **Two timestamps.** `effective_ts` (valid time) lets you answer "as-of"; `system_ts` (transaction time) lets you answer "what did we know when." A correction booked today for last week has `system_ts=today, effective_ts=last week`.
3. **Lineage column.** `source_ref` ties each event to the upstream input so you can trace any figure back.
4. **Derived views.** Current trade state, positions, PnL are all *folds/projections* over this log — never the source of truth themselves.

To reconstruct "the trade as we believed it on date D," replay events where `system_ts <= D`. That's the whole point: state is recomputable from an immutable log, which is exactly what a regulator wants.

### Q12. Spot the domain bug: a nightly job runs `DELETE FROM position WHERE as_of < now() - interval '2 years'` to control table growth.

Several bugs, escalating in severity:

1. **Regulatory retention breach.** Financial records typically must be retained for 5–7+ years depending on jurisdiction and record type; two years is very likely below the mandated minimum. A casual `DELETE` on regulated data is exactly the "deletes must be policy-driven, not casual" failure.
2. **Destroying auditability.** If those positions are needed to reconstruct a past state (a dispute, a regulator's as-of query, a reconciliation of a historical break), they're now gone irreversibly.
3. **Wrong target anyway.** Positions are *derived* state — a fold over trades. Deleting the derived rows while keeping (or also deleting) the source trades is incoherent: if trades remain, you can recompute positions, so deleting them saves nothing durable; if the trades are also being purged, you've destroyed the source of truth.

The fix respects the model: keep the **immutable source log** for the full regulatory retention period; control growth of *derived* stores with **snapshots + archival to cheaper tiers**, not deletion; and make any true deletion a **policy-driven, logged, approved** action tied to a retention schedule, never a hard-coded interval in a cron job. Growth is a storage-tiering problem, not a `DELETE`-the-history problem.

### Q13. Market, credit, operational, liquidity — for a payments/fintech company, which risks dominate and how do they surface in the system?

For a payments or fintech (as opposed to a trading desk), the mix shifts toward **operational** and **credit/fraud** risk, with liquidity mattering for anyone holding customer funds:

- **Operational risk** dominates — a bad deploy, a double-charge bug, an outage during a payment run, a webhook you processed twice. Surfaces as: idempotency keys on every money movement, reconciliation against the card network/bank, alerting, and a blameless-but-logged incident trail.
- **Credit/fraud risk** — a customer's card is declined after you've shipped value, a chargeback, account takeover. Surfaces as: authorization checks, fraud-scoring integrations, holds/reserves, and dispute-handling state machines.
- **Liquidity risk** — if you hold a float or settle on a delay, can you meet obligations as they fall due? Surfaces as: cash-position monitoring and funding buffers.
- **Market risk** is usually minor unless you touch FX or crypto — then quote inversion, rate staleness, and holding-period exposure appear.

The engineering point: even without a "risk engine," a fintech is *full* of risk controls — they just wear engineering clothes (idempotency, reconciliation, holds, monitoring). Naming them as risk controls in an interview shows you connect the domain to the code.

### Q14. What does "the regulator can reconstruct who did what, when, from what input" actually require in code?

Decompose the sentence — each clause is a concrete data requirement:

- **"who"** → an `actor` on every state-changing event (a real principal, not `system` or a shared service account where a human acted). Requires authenticated, attributable actions end-to-end.
- **"what"** → the full event payload, not a diff you can't interpret later. Store the resulting economics, and the event type (book/amend/cancel/correct).
- **"when"** → trustworthy timestamps — and often *two* of them (valid time vs transaction time) so late corrections don't rewrite history. Clock quality can itself be regulated.
- **"from what input"** → **lineage**: a reference from each event back to the upstream message/file/decision that caused it, so any output figure traces to its source inputs.

Put together, that's: authenticated actors, append-only events with full payloads, bitemporal timestamps, and a lineage/source reference on every record. Notice none of it is achievable by patching after the fact — you can't invent an actor or an input reference for an event that already happened without capturing it. The reconstruction requirement is really a requirement to **capture context at write time**, which is why "audit as a feature, designed in from day one" keeps being the answer.

### Q15. Design a pre-trade limit-check service that sits on the order path without killing latency.

The tension: limit checks must be *correct* (block real breaches) and *fast* (they're on the hot path before an order is sent). Sketch:

```text
Order -> [Limit Check Service] --pass--> Market
                 |
                 +-- reads: current exposure (position fold) per scope
                 +-- reads: active limits per scope (cached)
                 +-- fail --> reject order + record breach event
```

Design choices:

1. **Keep exposure hot.** Don't recompute a position from full trade history per order. Maintain a live, event-sourced position/exposure read-model (per portfolio/desk/counterparty) updated off the trade stream, so a check is a fast lookup + compare.
2. **Cache limits, invalidate on change.** Limits change rarely (reference-ish data) — cache them, refresh via CDC/events when an owner changes one.
3. **Carry `as_of` on the exposure.** A check against stale exposure is dangerous; stamp what snapshot you checked and have a staleness threshold that fails safe.
4. **Reserve, don't just read.** For pre-trade, a bare read-then-check races concurrent orders. Reserve the exposure (optimistic/atomic increment per scope key) so two orders can't each pass a limit they'd jointly breach.
5. **Record every decision.** Pass or fail, append an auditable check event — regulators (and post-mortems) want to see the limit was evaluated.

The recurring themes tie back to the rest of the primer: derived-and-maintained exposure (event sourcing), per-scope keyed concurrency (ordering per entity), and immutable decision logging (audit trail).

### Q16. Why is "immutability" simultaneously a risk control, a regulatory requirement, and an engineering pattern? Tie it together.

Because all three are the same idea seen from three angles — which is exactly why it's the spine of financial-systems engineering:

- **As a risk control (operational risk):** you cannot corrupt or silently lose a financial fact if you never mutate it. Every "change" is a new, reversible, attributable event, so a bug or bad actor can be *seen and unwound* rather than baked invisibly into a mutated row.
- **As a regulatory requirement:** regulators demand you reconstruct who-did-what-when-from-what-input. An append-only history *is* that reconstruction; a mutable schema destroys the evidence a regulator needs.
- **As an engineering pattern:** it's event sourcing — trades are an append-only log, positions/balances/PnL are folds over that log, corrections are compensating events, and snapshots bound the replay cost. State is *recomputable*, which makes the system testable, auditable, and time-travelable.

So when an interviewer asks any of "how do you handle a correction," "how do you satisfy the auditor," or "how do you keep positions consistent," the *same* answer works: never mutate, append a compensating event, derive state by folding the log. Immutability isn't three separate best practices that happen to agree — it's one invariant that risk, regulation, and engineering all independently force on you. Recognising that unity is the senior signal, and it's the bridge into the Financial-Systems Engineering Patterns topic.

## Money, Accounting & Ledgers in Software

### Summary

**What this topic covers**

How money is *actually represented and moved* in software — the part engineers most often get catastrophically wrong. Three concern areas: (1) **representation** — why you must never use `float`/`double` for money, what you use instead (exact decimal like `BigDecimal`/C# `decimal`, or integer minor units — cents/pence), and why an amount without a currency is meaningless; (2) **rounding** — that it must be explicit (HALF_EVEN, not the language default) and defined per currency; and (3) **the ledger model** — double-entry bookkeeping (debits = credits), journals and ledgers, the T-account, and the crucial engineering consequence that a **balance is derived from immutable ledger entries**, never a mutable column you increment. The 16 questions here are the most portable in the whole primer: every fintech, bank, exchange, and payments company has a ledger, and "how do you represent money" / "design a ledger" / "why never float" are near-universal interview questions.

**Mental model**

Two mental shifts. First, **money is not a number — it's a `(amount, currency, scale)` triple**, and the `amount` must be *exact*. Binary floating point cannot represent `0.10`; `0.1 + 0.2 != 0.3` in every IEEE-754 language. In money that's not a curiosity, it's a defect: errors accumulate across millions of operations and break the one thing a financial system must do — reconcile to the penny. So you use an exact decimal type or store integer minor units and track the currency's scale. Second, **a ledger is an append-only log, and a balance is a fold over it** — the same event-sourcing idea as positions. You never `UPDATE account SET balance = balance + 100`. You *append* balanced entries (double-entry: every debit has an equal credit), and a balance is the sum of an account's entries as of a point in time. This makes the ledger self-auditing (debits must equal credits, always), immutable (corrections are reversing entries), and reconstructable (replay the entries) — exactly what regulation demands.

**Key terms**

- **Double-entry** — every transaction posts equal debits and credits; the books always balance.
- **Debit / credit** — the two sides of every entry; their meaning depends on account type, and total debits = total credits.
- **Journal** — the chronological, append-only record of transactions (entries).
- **Ledger** — entries organised by account; the source of balances.
- **T-account** — the mental model of one account with debits on the left, credits on the right.
- **Account** — a bucket money flows into/out of (asset, liability, equity, revenue, expense).
- **Posting** — the act of writing a balanced set of entries to the ledger.
- **Balance** — a *derived* point-in-time sum of an account's entries; not stored as truth.
- **Exact decimal** — `BigDecimal` (Java) / `decimal` (C#) / `NUMERIC` (SQL); base-10, no representation error.
- **Minor units** — the smallest denomination (cents, pence); store money as an integer count of these.
- **Scale / exponent** — how many minor units per major unit; per-currency (ISO 4217): USD=2, JPY=0, some=3.
- **HALF_EVEN (banker's rounding)** — round-half-to-even; avoids the upward bias of round-half-up over many operations.
- **Idempotent posting** — the same logical transaction, retried, posts exactly once (dedup on a business key).

**Why interviewers ask this**

"How do you store money?" is the single most reliable domain filter in fintech interviews, because the wrong answer (`float`/`double`) is disqualifying and extremely common. The junior answer represents a price as a `double` and rounds "whenever." The senior answer reaches immediately for exact decimal or integer minor units, always pairs the amount with a currency, and defines rounding explicitly. On ledgers, the junior instinct is an `accounts` table with a mutable `balance` column that gets `UPDATE`d; the senior instinct is an append-only entry log with double-entry invariants and a *derived* balance. Interviewers want to see that you treat money with the paranoia it deserves: exactness, currency-awareness, explicit rounding, immutability, and idempotency. Get "never float, always currency, balance is derived" out cleanly and you've signalled you've built real financial software.

**Common confusions**

- "`double` is fine if I round at the end" — no. Errors compound *before* the end; `0.1` isn't representable to begin with, and reconciliation fails by cents.
- "`decimal`/`BigDecimal` are the same as `float`, just slower" — they're base-10 exact; `float` is base-2 and *cannot* represent common decimal fractions. Different kind, not different speed.
- "Everything has 2 decimal places" — JPY has 0, some currencies have 3; hard-coding 2 corrupts amounts by factors of 100.
- "An amount is a number" — an amount without a currency is meaningless; `100` could be $100 or ¥100 (~100x apart).
- "Rounding is automatic" — the default rounding mode varies by language and is usually wrong for money; specify HALF_EVEN (or the mandated mode) explicitly.
- "Balance is a column I update" — balance is derived from immutable entries; a mutable column loses history and invites lost-update races.
- "Double-entry is accountant ceremony" — it's a built-in consistency check (debits = credits) and audit trail; skip it and you lose both.

**What follows from this topic**

This is the concrete mechanics behind several other topics. The "balance is derived from immutable entries" model is the same event-sourcing spine as positions in the earlier position-keeping material and the Financial-Systems Engineering Patterns topic — a ledger *is* an event-sourced system. The immutability and auditability here are exactly what Risk & Regulation Vocabulary demands (a double-entry ledger is a regulator-friendly audit trail by construction). Idempotent postings preview the business-key idempotency pattern in the next topic. And exact-money-with-currency is the same money model that FX and multi-currency work depends on. Master money representation and the ledger fold, and the systems patterns topic is mostly applying them at scale.

### Q1. Why must you never use `float`/`double` for money? Give the concrete failure.

Because binary floating point (IEEE-754) represents numbers in base 2, and most decimal fractions — including `0.10` — **have no exact base-2 representation**. So the value you store isn't the value you meant; it's the nearest representable binary approximation.

The canonical demonstration:

```java
System.out.println(0.1 + 0.2);        // 0.30000000000000004
System.out.println(0.1 + 0.2 == 0.3); // false
```

In money this is not a rounding curiosity, it's a defect that **compounds**. Add a fraction of a cent of error per operation across millions of transactions and interest accruals, and your totals drift. The consequence that actually bites: **reconciliation fails**. Your ledger says the account holds `X`, the custodian/bank says `X + 0.03`, and now an ops person is chasing a "break" that is really just accumulated float error. Financial systems must agree to the penny; a representation that can't even hold `0.10` exactly can't deliver that. The fix is an exact base-10 representation — decimal type or integer minor units — covered in the next questions.

### Q2. What *do* you use for money, and what are the trade-offs between the two main options?

Two exact, base-10 approaches — pick per system, be consistent:

| Approach | Store money as | Pros | Cons |
|---|---|---|---|
| **Exact decimal** | `BigDecimal` / C# `decimal` / SQL `NUMERIC(p,s)` | Readable, arbitrary scale, arithmetic reads naturally | Slower/heavier than ints; must still set rounding + scale |
| **Integer minor units** | `long` count of cents/pence | Fast, unambiguous, no fractional drift | Must track scale per currency; overflow risk at huge magnitudes; less readable |

**Exact decimal** stores `19.99` as an exact base-10 value with a defined scale. **Minor units** stores `$19.99` as the integer `1999` and remembers "this currency has 2 minor units per major." Both eliminate float error. Minor units are common in payments (money is literally an integer of cents) and high-throughput systems; exact decimal is common where you do richer arithmetic (interest, FX, weighted averages) and want readability.

Whichever you choose, the non-negotiables are the same: **exact base-10**, an **explicit scale per currency** (never hard-code 2), and an **explicit rounding mode**. And always store the **currency** alongside the amount — which is the next question.

### Q3. Why is an amount meaningless without its currency, and how do you model "money" as a type?

Because `100` is not money — `$100`, `¥100`, and `£100` differ by up to ~150x, and no arithmetic on the bare number is valid across them. **Money is a `(amount, currency)` pair** (with an implied or explicit scale). Storing the amount alone is the equivalent of storing a length without units.

Model money as a **value object**, not a loose number:

```java
final class Money {
    final BigDecimal amount;   // exact
    final Currency currency;   // ISO 4217
    // + a defined scale/rounding per currency
}
```

Two invariants the type should enforce:

1. **No cross-currency arithmetic without an explicit FX conversion.** `usd.plus(jpy)` must not compile/succeed silently — mixing currencies is a bug, and the conversion needs a rate (with its own timestamp and source).
2. **Currency travels with the amount everywhere** — in the DB (`amount NUMERIC, currency CHAR(3)`), in APIs, in messages. A column of bare amounts is a latent disaster the moment a second currency appears.

In an interview, "money is amount plus currency, as a value object that refuses silent cross-currency math" is the answer that shows you've been burned before. The classic production bug is a system that assumed one currency, stored bare amounts, then onboarded a second currency and silently added yen to dollars.

### Q4. Why is `2` the wrong number of decimal places to hard-code, and what's the right approach?

Because the number of minor units per currency **varies** and is defined per currency by ISO 4217's exponent — it is not universally 2:

| Currency | Minor units (scale) | `100.00`? |
|---|---|---|
| USD, EUR, GBP | 2 (cents/pence) | yes |
| JPY, KRW | 0 (no minor unit) | ¥100 is just 100 |
| BHD, KWD, TND | 3 (fils) | 100.000 |

Hard-coding 2 corrupts amounts by factors of 100 or 1000. If you store JPY assuming 2 dp, `¥100` becomes `10000` minor units — a 100x error. If you store a 3-dp dinar as 2 dp, you silently drop a digit of precision.

The right approach: **look up the scale per currency** (from a reference table keyed on the ISO code) and apply *that* scale for storage, display, and rounding. In a minor-units system, `toMinorUnits(amount, currency)` multiplies by `10^exponent(currency)`; in a decimal system, you `setScale(exponent(currency), roundingMode)`. The scale is a property *of the currency*, so it belongs in your currency/reference data, not baked into code as a literal `2`. This is a favourite spot-the-bug: any `amount * 100` or `.setScale(2)` sitting in shared money code is wrong the moment JPY or a 3-dp currency arrives.

### Q5. Explain rounding for money — why "explicit HALF_EVEN" and not the language default?

Two problems the default hides. First, **there is a default at all, and it varies** — Java's `BigDecimal` division *throws* without a rounding mode, C#/others pick a mode for you, and the "obvious" round-half-up has a subtle flaw. Second, **round-half-up is biased**: it always rounds `.5` upward, so over millions of roundings the total drifts *up*, a systematic error auditors notice.

**HALF_EVEN (banker's rounding)** rounds a half to the nearest *even* digit — `2.5 → 2`, `3.5 → 4` — so halves round up and down roughly equally and the bias cancels over many operations. That's why it's the common default for money.

```java
// explicit scale + mode; never rely on the default
Money.of("10.005", USD).setScale(2, RoundingMode.HALF_EVEN); // 10.00
```

The engineering rules: (1) **always specify the mode explicitly** at every rounding point; (2) round **only at defined boundaries** (e.g. when persisting or presenting a final amount), never in the middle of a running calculation where you'd throw away precision repeatedly; (3) use the **mandated** mode if your jurisdiction/contract specifies one (some do). "Explicit HALF_EVEN, rounded only at boundaries" signals you know rounding is a policy decision, not a language accident.

### Q6. Explain double-entry bookkeeping to an engineer. Why do financial systems use ledgers instead of a balance column?

**Double-entry** means every transaction is recorded as *equal and opposite* entries: for every **debit** there's an equal **credit**, and across the whole system total debits always equal total credits. Money is never created or destroyed, only moved between accounts. Alice pays Bob $100: debit Alice's account $100, credit Bob's account $100 — two entries, net zero.

Why a ledger beats an `UPDATE account SET balance = balance + 100`:

1. **Built-in consistency check.** Debits = credits is an invariant you can assert after every posting. If they don't balance, you have a bug *and you can detect it immediately*. A mutable balance column has no such self-check.
2. **Immutable audit trail.** The ledger is append-only; every movement is a permanent, attributable entry. You can reconstruct any past balance and answer "why is it this number" — exactly what regulators demand.
3. **No lost updates.** `balance = balance + 100` under concurrency races (two reads, two writes, one increment lost). Appending immutable entries and *deriving* the balance sidesteps the whole class of update races.
4. **Money conservation.** Because entries are always paired and balanced, money can't leak; a single-sided balance bump can.

So: **a ledger is an append-only, double-entry log; a balance is derived from it.** That's the model — the mutable balance column is the anti-pattern.

### Q7. Why is a balance derived from immutable entries rather than stored as a mutable column?

Because a balance is a **fold over the account's entries** — the same "derived state" idea as a position over trades. Storing it as a mutable, incremented column trades away everything the entries give you:

- **You lose history.** `balance = 4200` tells you the number, not how it got there. The entries tell you every movement, with actor, time, and source — the audit trail regulation requires.
- **You invite lost updates.** Concurrent `balance = balance + x` operations race; one increment silently vanishes unless you lock hard, which kills throughput.
- **You can't reconstruct or time-travel.** "What was the balance as of last Tuesday?" is a `SUM(entries WHERE ts <= tuesday)` if entries are immutable, and impossible if you only kept the latest scalar.
- **Corrections corrupt it.** Fixing a wrong balance means another destructive `UPDATE`, erasing evidence.

The derived model: append immutable entries, compute `balance(account, as_of) = SUM(amount) WHERE account = ? AND ts <= as_of`. For performance you **snapshot** periodically (materialise the balance at time T) and sum only entries after the snapshot — `snapshot + delta`, not a full-history scan every time. That gives you fast reads *and* full history — the CQRS read-model pattern applied to money. The mutable column is a premature optimisation that throws away auditability, correctness under concurrency, and time-travel to save a `SUM`.

### Q8. Design a double-entry ledger schema. What are the core tables and invariants?

Minimal, immutable, self-checking:

```sql
CREATE TABLE account (
  account_id  BIGINT PRIMARY KEY,
  type        TEXT NOT NULL,        -- asset|liability|equity|revenue|expense
  currency    CHAR(3) NOT NULL      -- one currency per account (see below)
);

CREATE TABLE journal_txn (              -- one business transaction
  txn_id      BIGINT PRIMARY KEY,
  business_key TEXT UNIQUE NOT NULL,    -- idempotency key (dedup retries)
  posted_at   TIMESTAMPTZ NOT NULL,
  actor       TEXT NOT NULL
);

CREATE TABLE ledger_entry (             -- append-only lines; >=2 per txn
  entry_id    BIGINT PRIMARY KEY,
  txn_id      BIGINT NOT NULL REFERENCES journal_txn,
  account_id  BIGINT NOT NULL REFERENCES account,
  direction   TEXT NOT NULL,            -- 'DEBIT' | 'CREDIT'
  amount      NUMERIC(28,8) NOT NULL,   -- exact; >= 0
  currency    CHAR(3) NOT NULL
);
```

Invariants (enforce in the posting logic / constraints):

1. **Balanced transaction.** Per `txn_id`, `SUM(debits) = SUM(credits)` (per currency). Reject the posting otherwise — this is your money-conservation check.
2. **Append-only.** No `UPDATE`/`DELETE` on `ledger_entry` or `journal_txn`. Corrections are new reversing transactions.
3. **Idempotent posting.** `business_key` is unique; a retried transaction is a no-op, not a double-post.
4. **Currency-consistent.** An entry's currency matches its account; cross-currency moves are modelled as an FX transaction with explicit legs, not a silent mix.

Balances are a view, not a table: `SELECT SUM(CASE direction WHEN 'DEBIT' THEN amount ELSE -amount END) FROM ledger_entry WHERE account_id = ? AND ...`. That's a complete, auditable, self-checking ledger core.

### Q9. What is an idempotent posting and why is it non-negotiable in a ledger?

An **idempotent posting** is one where submitting the *same logical transaction* more than once results in it being recorded **exactly once**. It's non-negotiable because money movement over any real network is subject to retries, redeliveries, and at-least-once messaging — and a double-posted payment is a real, customer-visible financial loss, not a cosmetic glitch.

The mechanism: dedup on a **business idempotency key** — a stable identifier of the *logical* transaction (the payment id, the source trade id), **not** a transport-level id like a message offset or HTTP request id that changes on retry.

```sql
INSERT INTO journal_txn (business_key, ...) VALUES ('payment-8821', ...)
ON CONFLICT (business_key) DO NOTHING;   -- second delivery no-ops
-- only post ledger_entry lines if the txn row was newly inserted
```

Two subtleties: (1) the seen-key set must be **persisted and checked atomically with the posting** (unique constraint in the same transaction), or a race lets two deliveries both pass the check; (2) the key must be chosen by the *business meaning*, so a client retrying "pay invoice 8821" always presents `payment-8821` — if you key on something that regenerates per attempt, you'll double-post. "Idempotent on a persisted business key, in the same transaction as the write" is the answer; it's the ledger-specific case of the general idempotency pattern in the next topic.

### Q10. How do you correct a mistaken ledger posting? Spot the bug in `UPDATE ledger_entry SET amount = 90 WHERE entry_id = 5`.

You **never** correct by mutating the entry — you post a **reversing (compensating) transaction**. The bug in the `UPDATE` is the same one that recurs across every financial system: it **destroys an immutable financial fact and breaks the ledger's invariants**.

Concretely, the `UPDATE` is wrong because:

1. **It breaks double-entry.** The entry was one leg of a balanced transaction; changing one leg's amount from 100 to 90 leaves debits ≠ credits — the books no longer balance.
2. **It erases the audit trail.** There's now no record it was ever 100, or that someone changed it, or why. Regulators can't reconstruct.
3. **It desynchronises derived state.** Balances/reports that already folded 100 don't retroactively change with an in-place edit.

The correct pattern — reverse and (optionally) re-book:

```text
-- 1. reverse the whole original transaction (equal & opposite entries)
POST txn 'reverse-of-77'  : credit X 100, debit Y 100
-- 2. book the corrected transaction
POST txn 'correction-77'  : debit  X  90, credit Y 90
```

Now the original, the reversal, and the corrected posting all survive; debits still equal credits at every step; and the net effect is the intended 90 with a full, attributable history. Immutable + reversing entries is how ledgers stay both correct and auditable.

### Q11. Model a multi-currency ledger. How do you post an FX transaction without silently mixing currencies?

Rule one: **each account holds a single currency**, and **each ledger entry carries its currency**. That makes "add yen to dollars" structurally impossible — you can't sum entries across currencies, and the balanced-transaction invariant is checked *per currency*.

An FX conversion is then not a magic cross-currency entry — it's a transaction with **legs in each currency**, tied together by the rate used:

```text
Transaction 'fx-4410'  (Alice sells USD, buys EUR at 0.90)
  USD leg:  debit  Alice_USD_out   100.00 USD
            credit Broker_USD        100.00 USD
  EUR leg:  debit  Broker_EUR         90.00 EUR
            credit Alice_EUR_in       90.00 EUR
  metadata: rate = 0.90 EUR per USD, rate_source, rate_ts
```

Each currency balances within itself (USD debits = USD credits; EUR debits = EUR credits). The two legs are linked by the transaction and by the **stamped FX rate, its source, and its timestamp** — which you must persist for audit and for reconciliation (the same amount converts differently at a different rate/time). The domain bugs this prevents: (1) silently adding amounts of different currencies; (2) losing which rate produced the converted figure; (3) quote-inversion errors, since the rate is stored with an explicit direction/pair rather than applied by guesswork. Multi-currency = per-currency accounts + per-currency balancing + explicit, stamped FX legs.

### Q12. A payments service does `balance = balance + amount` on deposit. Two deposits arrive concurrently. What breaks, and how do you fix it?

**Lost update.** Both requests read the same starting balance, each computes `balance + amount` from that stale read, and the second write overwrites the first — so one deposit silently vanishes. With a start of 0 and two $100 deposits, you can end at $100 instead of $200. This is the textbook read-modify-write race, and on money it's a real loss.

Naive fixes and why they fall short:

- **A row lock / `SELECT ... FOR UPDATE`** serialises updates and *is* correct, but it's a contention bottleneck on hot accounts and still keeps a mutable balance with no history.
- **An atomic DB increment** (`SET balance = balance + amount` as a single statement) fixes the lost update but still discards history and can't answer "as of when" or "why."

The model-correct fix: **don't mutate a balance at all — append immutable ledger entries and derive the balance.** Two concurrent deposits are two independent, idempotent appends (each with its own business key); there's no shared scalar to race on, and the balance is `SUM(entries)`. Add snapshots for read performance. This trades a fragile hot column for an append-only log that's concurrent-safe, auditable, and time-travelable — the same reason positions are derived rather than stored. The bug isn't "missing a lock," it's "storing a balance as mutable truth."

### Q13. What's the difference between a journal and a ledger, and where does the T-account fit?

They're two views of the same immutable entries:

- **Journal** — the **chronological** record: transactions in the order they happened, each a balanced set of entries. "On 2026-07-01, txn 4410: debit X, credit Y." It's the append-only log, time-ordered.
- **Ledger** — the same entries **organised by account**: all the debits and credits touching account X, from which X's balance is derived. It's the per-account projection.

Engineering translation: the **journal is your event log** (source of truth, append-only, time-ordered), and the **ledger is a read model** (group the entries by account). You don't store them as two independent sources that could disagree — the ledger view is *derived* from the journal, exactly like a position is derived from the trade log.

The **T-account** is the mental model for a single account: a T shape with the account name on top, **debits on the left, credits on the right**; the balance is the difference between the two columns. It's how accountants reason about one account's movements, and it maps cleanly to "filter the ledger to one account, sum debits minus credits." Knowing these are *views over one immutable entry stream*, not three separate stores, is the engineer's takeaway.

### Q14. How do you compute a point-in-time historical balance efficiently over an immutable ledger?

The definition is a fold: `balance(account, T) = SUM(signed amount of entries WHERE account = ? AND ts <= T)`. Correct, but summing the full history on every query is `O(all entries)` and gets slow as the ledger grows. The fix is **snapshots + delta**, the event-sourcing performance pattern:

1. **Periodically materialise** each account's balance at a checkpoint time (say end of each day): store `(account, as_of, balance)`.
2. **To answer "balance as of T"**, take the latest snapshot at or before T, then sum only the entries **between the snapshot and T** — `snapshot + delta`, which is `O(delta)`, not `O(history)`.

```text
balance(acct, T) = snapshot(acct, S<=T).balance
                 + SUM(entries WHERE acct AND S < ts <= T)
```

Key properties this preserves: the ledger stays **append-only** (snapshots are a cache, not a mutation of history); you can still reconstruct any as-of balance; and you can rebuild snapshots from the log if they're ever wrong or lost. Two "as-of"s may matter — *valid time* (when the entry applies) vs *transaction time* (when it was recorded) — for late corrections; a bitemporal ledger keeps both so a backdated correction doesn't rewrite what yesterday's report legitimately showed. Snapshot-plus-delta over an immutable log is how you get both fast reads and full auditability.

### Q15. Design the ledger for a wallet/neobank app that holds customer money. What are the must-haves?

Anchor on the invariant that **customer money must always be accounted for and reconcilable to the penny**. Must-haves:

1. **Double-entry, append-only ledger.** Every movement is balanced entries in an immutable journal; balances are derived (with snapshots). No mutable balance column.
2. **Exact money + currency + per-currency scale.** Minor-units integers or exact decimal; currency stored on every account and entry; never `float`.
3. **Idempotent postings on business keys.** Deposits, withdrawals, transfers, card settlements all keyed on a stable id so retries/redeliveries post once.
4. **Account structure that models reality.** Customer wallet accounts (liabilities — you *owe* the customer their money) offset against your asset accounts at the partner bank; the ledger must show that the sum of customer liabilities equals the cash you actually hold.
5. **Reconciliation hooks.** The internal ledger is reconciled daily against the partner bank / card network statement — so the ledger's design must make matching keys (external references, timestamps) first-class.
6. **Full audit trail + retention.** Who/when/source on every entry; reversing entries for corrections; retention per regulation.

The one that catches people: a wallet balance is a **liability** you owe the customer, and it must always be backed by real assets you hold — the ledger exists precisely to *prove* `Σ customer balances = cash in the bank`, and reconciliation proves it against reality. Design so that proof is a query, not a spreadsheet.

### Q16. Tie it together: why are "exact money," "double-entry," "immutable entries," and "idempotency" one coherent design rather than four separate rules?

Because they're the four properties that together make a system that handles money **provably correct and auditable** — remove any one and the others can't do their job:

- **Exact money** guarantees the *numbers* are right — no float drift, so amounts reconcile to the penny. Without it, double-entry "balances" that are actually off by accumulated error.
- **Double-entry** guarantees money is *conserved and self-checked* — debits = credits is a continuous correctness assertion. Without it, a single-sided bump can leak money undetected.
- **Immutable entries** guarantee history is *preserved and reconstructable* — corrections are reversing entries, so the audit trail (and time-travel, and regulation) hold. Without it, an `UPDATE` breaks both the balance invariant and the audit.
- **Idempotency** guarantees each transaction is applied *exactly once* — retries and redeliveries don't double-post. Without it, at-least-once delivery quietly duplicates money.

Stack them and you get the recurring shape of the whole domain: an **append-only log of exact, balanced, uniquely-keyed money events, over which balances are derived**. That's a ledger, and it's also an event-sourced system, and it's also a regulator's audit trail — the same construction satisfying correctness, concurrency-safety, and compliance at once. Recognising them as one design is the senior signal, and it's the direct bridge into the Financial-Systems Engineering Patterns topic, which generalises exactly this shape.

## Financial-Systems Engineering Patterns

### Summary

**What this topic covers**

The handful of engineering patterns that recur across *every* financial system — trading, banking, asset management, payments — and that tie the whole domain together. Three concern areas: (1) **event sourcing** — trades/entries as an append-only log, state (position, balance, PnL) as a fold, corrections as compensating events, and snapshots to bound replay; (2) **correctness of money movement over unreliable transport** — idempotency on a *business* key, exactly-once effect from at-least-once delivery, per-entity ordering; and (3) **temporal correctness** — as-of / point-in-time queries, the trade-date/settle-date/value-date distinction, business-day calendars, and lineage/audit. The 16 questions here are the senior-level payoff of the primer: they cross-reference the System Design and OOD material rather than re-teaching it, and they assume the money model, immutability, and audit requirements from the previous two topics. This is where "design a real-time position-keeping service" and "design a reconciliation pipeline" live.

**Mental model**

One idea underlies almost everything: **the source of truth is an append-only log of immutable business events, and everything else is a projection you can recompute.** A trade is an event; a position is a fold over trades; a balance is a fold over ledger entries; PnL is a fold plus a price. You never mutate the derived state as truth — you append events and re-derive. From that single stance, the rest follows: *corrections* can't be in-place edits (they're compensating events), *replay* must be cheap (so you snapshot), *retries* mustn't double-count (so consumers are idempotent on a business key), *ordering* matters only within an entity (so you partition by portfolio/account and parallelise across them), and *history* is first-class (so you can ask "as of last Tuesday" and trace any figure's lineage). Every one of these is really a corollary of "immutable log + derived projections." The financial twist on generic event sourcing is the paranoia: money and regulation mean exactly-once-effect, full audit, and point-in-time reconstructability aren't optional niceties — they're the requirements the pattern exists to satisfy.

**Key terms**

- **Event sourcing** — persist the sequence of state-changing events; derive current state by folding them.
- **Fold / projection** — the reduction of an event log into a read model (position, balance, PnL).
- **Compensating event** — a new event that reverses/corrects a prior one; the immutable alternative to an update.
- **Snapshot** — a materialised state at a checkpoint so replay is `snapshot + delta`, not full history.
- **Idempotency key (business key)** — a stable identifier of the *logical* operation (source trade id, payment id) used to dedup.
- **At-least-once / exactly-once** — delivery semantics; exactly-once *effect* = at-least-once delivery + idempotent consumer.
- **Per-entity ordering** — order preserved within a key (portfolio/account), parallel across keys.
- **As-of / point-in-time** — querying state as it was (or as it was known) at a past instant.
- **Bitemporal** — tracking both *valid time* (when a fact applies) and *transaction time* (when it was recorded).
- **Trade date / settlement date / value date** — when a deal is struck / when it settles / when it's economically effective.
- **Business day** — a trading/settlement day per a holiday calendar; not a naive calendar day.
- **Lineage** — the traceable link from any output figure back to the inputs that produced it.

**Why interviewers ask this**

This is the senior filter. Junior candidates model a position as a mutable `positions` table they `UPDATE` on each trade, correct mistakes with in-place edits, assume messages arrive once and in order, and store dates as naive timestamps. Senior candidates reach immediately for the log-and-fold model, know that corrections are compensating events, are idempotent on a business key by reflex, partition ordering by entity, and distinguish trade/settle/value date and business days without prompting. Interviewers use "design a position-keeping service" or "design a reconciliation pipeline" precisely because they surface all of it at once — and because these patterns transfer across the entire industry, so getting them right signals you can build *any* financial system, not just the one in front of you. The domain knowledge from the earlier topics is the vocabulary; this topic is whether you can turn it into a correct architecture.

**Common confusions**

- "Store the position, update it per trade" — the position is *derived*; storing it as truth loses history, races, and can't answer as-of.
- "Correct a bad trade with an UPDATE" — never; append a compensating event so both survive.
- "Idempotency = dedup on the message id" — no; dedup on the *business* key, because transport ids change on retry.
- "Exactly-once delivery" — practically impossible; you get exactly-once *effect* via at-least-once + idempotent consumers.
- "Order everything globally" — global ordering kills throughput; order only within an entity, parallelise across entities.
- "Trade date = settlement date" — they differ (T+1/T+2); and *value date* is a third thing again.
- "T+2 = trade date + 2 calendar days" — it's 2 *business* days per a holiday calendar; naive date math is wrong.
- "As-of = latest value" — as-of means state *at a past instant*, often bitemporal, not last-write-wins.

**What follows from this topic**

This topic is the synthesis point — it operationalises the whole primer. Event sourcing here is the generalisation of "position = fold over trades" and "balance = fold over ledger entries" from the earlier topics; the compensating-event rule is the immutability demand from Risk & Regulation Vocabulary; business-key idempotency and exact-once money movement build directly on the idempotent postings from Money, Accounting & Ledgers. It leans on the System Design primer (event sourcing, CQRS, partitioning, delivery semantics) and the OOD primer (value objects, keyed executors) rather than re-deriving them. If the earlier topics gave you the domain vocabulary and invariants, this one gives you the architectural patterns to build systems that honour them — correctly, at scale, and audit-ready.

### Q1. Why is event sourcing the natural fit for trades and positions?

Because the domain *is already* event-sourced — a **trade is an immutable business event that happened**, and a **position is derived state** (a running fold of net quantity and average cost over those events). Event sourcing just stops fighting that reality: store the events as the source of truth, derive the position by folding them.

```text
Events (source of truth):   +100@10   +50@11   -30@12
Fold (derived position):    100  ->   150  ->  120   (net qty)
```

What this buys you, all of which the domain demands anyway:

- **Full audit trail for free** — every trade that ever affected the position is retained, attributable, and ordered. Regulators can reconstruct.
- **Point-in-time / as-of queries** — replay events up to timestamp T to get the position as it stood then; you're not stuck with only "now."
- **Corrections without destruction** — a mis-booked trade is fixed by a *compensating event*, not by mutating the position.
- **Recomputability** — if the fold logic has a bug, fix it and re-derive from the untouched log; the truth is safe.

Contrast the naive model: a mutable `positions` table you `UPDATE` per trade. It loses history, can't answer as-of, corrupts on correction, and races under concurrency. "Trades are events, position is a fold" is the whole insight — and it generalises to balances, PnL, and NAV. (Cross-ref System Design: Event Sourcing & CQRS.)

### Q2. Why must corrections be compensating events and never mutations?

Because mutation destroys the three things a financial system exists to preserve — **auditability, recomputability, and downstream consistency** — while a compensating event preserves all three.

If a trade was booked wrong and you `UPDATE` it:

- The **audit trail** loses the fact that it was ever different and that someone changed it — a regulatory failure.
- **Downstream projections** (positions, PnL, reports, the counterparty's confirmation) already folded the old value; an in-place edit doesn't retroactively propagate, so your derived state silently disagrees with the log.
- **Replay breaks** — replaying the (now-edited) log no longer reproduces the state anyone actually saw at the time.

A **compensating event** — a reversal, or a reversal-plus-rebook — instead *appends* the correction:

```text
e17: BOOK   trade 88  +100 @ 10      (original, wrong)
e42: CORRECT trade 88  qty_delta -10  actor=alice reason='fat finger'
                                       (or: e42 REVERSE e17, e43 REBOOK +90)
```

Now the original and the correction both survive, every downstream consumer folds the correction like any other event (so projections converge correctly), replay is faithful, and the audit trail shows exactly what happened and who did it. This is the same "never silently correct — reverse and re-book" rule that the ledger and the regulation topics insist on; here it's stated as the general event-sourcing invariant.

### Q3. Design a real-time position-keeping service from a trade event stream.

Restate the goal: consume a stream of trade events and maintain accurate, queryable positions per `(portfolio, instrument)` in real time, correctly under retries and concurrency.

```text
Trade stream ──partition by portfolioId──> [Position workers] ──> Position read-model
   (Kafka)                                        │                    (per portfolio/instrument)
                                                  ├─ dedup on business key (seen-keys)
                                                  ├─ fold event into running position
                                                  └─ periodic snapshot
```

Design decisions and *why*:

1. **Event-sourced fold.** Position = fold over trades (net qty, avg cost). The log is truth; the position is a materialised read model (CQRS). Never store position as mutable truth.
2. **Partition by `portfolioId`.** Order matters *within* a portfolio (a buy then a sell must not reorder) but not across portfolios — so key the stream by portfolio: ordered per key, parallel across keys, throughput scales.
3. **Idempotent consumer.** Delivery is at-least-once; dedup on the **business key** (source trade id) with a persisted seen-set so a redelivered trade no-ops instead of double-counting.
4. **Snapshots.** Periodically persist `(portfolio, instrument, position, as_of)` so recovery/replay is `snapshot + delta`, not a full-history replay.
5. **As-of queries.** Keep the log so you can replay to any T for point-in-time positions.

The recurring quartet — event-sourced fold, per-entity partitioned ordering, business-key idempotency, snapshots — is the template; this question just instantiates it. (Cross-ref System Design: partitioning, delivery semantics; OOD: keyed executor.)

### Q4. Explain idempotency on a business key vs a transport id. Why does the distinction matter?

**Idempotency** = processing the same logical operation more than once has the same effect as processing it once. The whole thing hinges on *which id you dedup on*, and using the transport id is a classic, costly mistake.

- A **business key** identifies the *logical* operation: the source trade id, the payment id, the order id. It is **stable across retries** — the same logical trade always carries the same key.
- A **transport id** identifies the *delivery*: a Kafka offset, a message id, an HTTP request id. It **changes when the sender retries** — the same logical trade redelivered gets a *new* transport id.

So if you dedup on the transport id, a retry (which has a fresh transport id) sails past your dedup check and you **double-book the trade / double-pay**. Deduping on the business key catches it, because the retry carries the same business key.

```text
Booked once as trade 'ACME-8821'. Network hiccup -> producer retries.
  dedup on offset (transport):  offset 5001 seen? no -> DOUBLE BOOK  ✗
  dedup on 'ACME-8821' (biz):   key seen? yes -> no-op               ✓
```

Implementation: persist the seen business keys and check-and-insert **atomically with the effect** (unique constraint in the same transaction), so two concurrent deliveries can't both pass. "Idempotent on the business key, checked atomically with the write" is the answer.

### Q5. "Exactly-once delivery" — is it real? How do you actually get exactly-once money movement?

Exactly-once *delivery* over a real network is essentially a myth — you cannot guarantee a message is delivered once and only once when senders, receivers, and links can all fail and retry. What you *can* build, and what the industry actually relies on, is exactly-once **effect**: **at-least-once delivery + an idempotent consumer**.

The reasoning: to be safe against loss you must retry, which risks duplicates (at-least-once); to be safe against duplicates you make the *effect* idempotent, so duplicates are harmless. The delivery layer guarantees "at least once"; the consumer guarantees "applying it twice = applying it once."

For **money movement** specifically:

1. Give each logical money operation a **business idempotency key** (payment id, transfer id).
2. On receipt, **atomically** check-and-record the key and perform the posting in one transaction — if the key's already recorded, no-op.
3. Because postings are immutable ledger entries (never a `balance += x` you might re-apply), replay is safe.

```text
at-least-once delivery  +  idempotent consumer (dedup on business key)
        =  exactly-once EFFECT  (the money moves once)
```

So the honest interview answer is: "I don't rely on exactly-once delivery — I design at-least-once delivery with idempotent, business-keyed consumers, which gives exactly-once effect." Claiming a broker gives you true exactly-once delivery is the junior tell. (Cross-ref System Design: messaging delivery semantics.)

### Q6. Why is snapshotting necessary in an event-sourced financial system, and how do you do it safely?

**Necessary** because folding the *entire* history on every read (or every recovery/restart) is `O(all events)` and only gets slower as the log grows — a portfolio with years of trades, or an account with millions of ledger entries, becomes unusably slow to reconstruct. A **snapshot** materialises the derived state at a checkpoint so you fold only the tail: `state(T) = snapshot(S ≤ T) + fold(events in (S, T])` — `O(delta)`.

**Safely**, the rules are:

1. **Snapshots are a cache, never truth.** The event log remains the source of truth; a snapshot is a derivable optimisation. If a snapshot is lost or found buggy, you rebuild it from the log.
2. **Stamp the snapshot with its position** — the exact event offset/timestamp it includes up to — so you know precisely which events form the delta and never double-apply or skip.
3. **Keep the log intact.** Snapshotting is *not* an excuse to truncate history in a regulated system — you need the full log for audit and as-of queries. (Compaction, if any, is a separate, policy-driven decision.)
4. **Snapshot per entity** (per portfolio/account) so you can replay one entity cheaply without touching others.

```text
events:   e1 e2 e3 [snap@e3] e4 e5 e6
state(e6) = snapshot@e3  +  fold(e4,e5,e6)     -- not fold(e1..e6)
```

Snapshot-plus-delta is the same pattern used for positions and for point-in-time ledger balances — bound the replay, keep the log immutable.

### Q7. Explain as-of / point-in-time queries and why bitemporality matters in finance.

An **as-of query** asks for state *at a past instant*, not the latest value — "what was the position on 2026-06-30?" With an immutable event log that's natural: fold the events up to that timestamp. But finance needs *two* time axes, because corrections arrive late:

- **Valid time** — when a fact is economically effective / applies to (a trade's trade date, an entry's effective date).
- **Transaction time** — when your system actually recorded it.

A trade for last week booked today has `valid_time = last week`, `transaction_time = today`. **Bitemporality** tracks both, which lets you answer two genuinely different questions:

1. "What is the position *for* 2026-06-30?" (valid time) — includes the late correction.
2. "What did we *believe* the 2026-06-30 position was, *as we knew it on* 2026-06-30?" (transaction time) — excludes a correction booked later.

```text
Question                              Filter
"true position for June 30"           valid_time <= Jun 30
"June 30 as reported that day"        valid_time <= Jun 30 AND txn_time <= Jun 30
```

Why it matters: regulators and auditors ask both. A report you published on the 30th must be reproducible *as published* even after a backdated correction — last-write-wins can't do that, but bitemporal history can. The domain bug is collapsing the two times into one timestamp; then a late correction silently rewrites what a past report showed. (Cross-ref SQL: temporal/bitemporal modelling.)

### Q8. Distinguish trade date, settlement date, and value date — and how each shows up in the data model.

Three distinct dates engineers routinely conflate into one:

| Date | Means | Example |
|---|---|---|
| **Trade date** | When the deal was struck / agreed | You buy ACME today |
| **Settlement date** | When cash & securities actually change hands | T+2 → two business days later |
| **Value date** | When a cash flow is economically effective (for interest/valuation) | FX/deposit value date |

They diverge constantly. A trade executed Monday (trade date) settles Wednesday (settlement date, T+2). An FX deal's value date drives which day's interest/position it belongs to, independent of when it was booked.

In the data model this means a trade/cash-flow record carries **multiple date fields**, each used for a different purpose, and you must be deliberate about *which* one drives *which* view:

```sql
trade(
  trade_date       DATE,   -- when agreed (drives "trades today")
  settlement_date  DATE,   -- when it settles (drives settlement/fails)
  value_date       DATE    -- economic effect (drives valuation/interest)
)
```

The domain bug: using one date for everything — e.g. computing settlement obligations off trade date, or valuing a position on the wrong day because you ignored value date. Positions "as of trade date" and "as of settlement date" can legitimately differ (traded-but-unsettled). Model the dates separately and be explicit about which drives each aggregate.

### Q9. Why can't you compute T+2 as `trade_date + 2 days`, and how do you do it correctly?

Because **T+2 means two *business* days**, not two calendar days — and "business day" depends on a **holiday calendar** for the relevant market(s). `trade_date + INTERVAL '2 days'` lands on weekends and public holidays, which are not settlement days, so your settlement dates will be wrong and your fails/exposure calculations with them.

Concretely: a trade on Friday settles not Sunday but the following **Tuesday** (skip Sat/Sun); if Monday is a holiday, it's Wednesday. And it's market-specific — a cross-border trade may depend on *two* calendars (both currencies' / both venues' holidays), settling only on a day that's a business day in both.

The correct approach:

1. Maintain **holiday calendars** as reference data, per market/currency (they change yearly and are published in advance).
2. Compute settlement by **advancing N business days**, skipping weekends and calendar holidays — a `addBusinessDays(trade_date, 2, calendar)` function, not date arithmetic.
3. For multi-currency/cross-venue, intersect the relevant calendars.

```text
addBusinessDays(Fri, 2, US_calendar):
  Fri +1 biz = Mon  (skip Sat, Sun)
  Mon +1 biz = Tue
  => settles Tuesday   (Wednesday if Mon is a holiday)
```

"T+2 is business days against a holiday calendar, not `+2 days`" is the answer — and the calendar is reference data you own, not something to hard-code.

### Q10. Design a reconciliation pipeline that matches internal trades against a custodian feed at scale.

Restate: prove your internal records agree with an external source (custodian/counterparty/exchange), surface mismatches ("breaks") for ops, and do it repeatedly and at scale. Reconciliation is fundamentally a **join + diff on imperfect data from two systems with different conventions**.

```text
External feed ─> [Ingest] ─> [Normalise] ─┐
                                          ├─> [Match on keys + tolerances] ─> matched
Internal records ────────> [Normalise] ───┘                                └─> BREAKS -> ops
```

Stages and the engineering care each needs:

1. **Ingest** — read the external file/feed (CSV, fixed-width, SWIFT); **idempotent loaders** so re-running a day doesn't duplicate.
2. **Normalise** — map both sides to a common shape: resolve symbology via the **security master** (never string-match tickers), align date/timezone conventions, sign conventions, currency scale.
3. **Match** — join on the best key: `trade_id` if shared, else a composite (`instrument + date + qty + counterparty`), with **tolerances** for small price/qty/rounding diffs.
4. **Classify** — matched / unmatched (missing one side) / broken (matched key, mismatched value).
5. **Report & track** — breaks are first-class records with state (open/investigating/resolved), aged-break reports, audit per break.

**Scale** by chunking independent partitions — by date or by counterparty — and processing in parallel; recon is embarrassingly parallel across those keys. The senior framing: it's a *data-quality* problem (messy keys, dupes, convention mismatches), not arithmetic. (Cross-ref SQL: cleaning/dedup/fuzzy keys; System Design: idempotent ingestion, scaling a slow batch.)

### Q11. Why is per-entity ordering the right granularity? What breaks with global ordering, and what breaks with no ordering?

Ordering matters in finance because some operations are **non-commutative within an entity** — for one portfolio, a buy then a sell is not the same as a sell then a buy (you could go momentarily short, breach a limit, or compute the wrong average cost). But operations across *different* entities are independent. So the right granularity is **per-entity (per-portfolio/per-account) ordering**.

- **Global ordering** (one total order across everything) is *correct* but **kills throughput**: every event serialises through a single ordered pipeline, so you can't scale horizontally, and one slow entity blocks all others. You're paying for ordering guarantees you don't need across independent entities.
- **No ordering** (fully parallel, unordered) is **fast but wrong**: a portfolio's trades can be applied out of order, corrupting the fold — a sell processed before the buy that funds it, a correction before the event it corrects.

The sweet spot: **partition the stream by entity key** (e.g. `portfolioId`), so events for one entity are strictly ordered while different entities process in parallel.

```text
partition by portfolioId:
  P1: t1 -> t2 -> t3   (ordered within P1)
  P2: t1 -> t2         (ordered within P2, parallel to P1)
```

Order preserved exactly where it changes the result, parallelism everywhere it doesn't. "Order per entity, parallel across entities" — global is too strong, none is too weak. (Cross-ref System Design: partitioning; OOD: keyed executor.)

### Q12. Spot the domain bug: a position service keeps a `positions` table and does `UPDATE positions SET qty = qty + ? WHERE portfolio=? AND instrument=?` per trade.

This treats a **derived** value as **mutable truth**, and it's wrong on four counts:

1. **No history / no audit.** The table holds only the current net; there's no record of the trades that produced it. You can't answer "how did we get here," can't do as-of queries, and can't satisfy an auditor — a regulatory failure.
2. **Lost updates under concurrency.** Two trades for the same `(portfolio, instrument)` racing on `qty = qty + ?` can lose one increment unless you lock hard, which then serialises and bottlenecks the hot instrument.
3. **Corrections corrupt it.** A mis-booked trade "fixed" by another `UPDATE` destroys evidence and can't propagate consistently.
4. **Not recomputable.** If the update logic ever had a bug (wrong sign, wrong instrument), there's no source log to re-derive from — the corruption is permanent.

The fix is the model from the whole topic: **append trades to an immutable log; derive the position as a fold**; partition by portfolio for ordered, concurrent-safe application; snapshot for fast reads; correct via compensating events. The `positions` table becomes a *read model* rebuilt from the log, not the source of truth. The bug is conceptual, not a missing lock — "position is derived state, not a mutable column."

### Q13. What is lineage, and how do you build a system where every figure traces back to its inputs?

**Lineage** is the traceable chain from any output figure back to the exact inputs and transformations that produced it — "this NAV of $4.2m came from *these* positions, marked at *these* prices from *this* source at *this* time, folded from *these* trades." Regulators, auditors, and your own debugging demand it: a number you can't explain is a liability.

You build it by making provenance a **first-class, captured-at-write-time** property, not something reconstructed later:

- **Event log as the spine.** Every derived figure is a fold over identifiable events; the events *are* the lineage of the state.
- **Stamp inputs on outputs.** A computed figure records the ids/timestamps/sources of what fed it — a mark carries `(price, price_source, price_ts)`; a NAV carries the snapshot of positions and marks it used. (This is why "store the source and timestamp, not just the number" recurs.)
- **Reference upstream events.** Each event carries a `source_ref` to the upstream message/file/decision that caused it.
- **Immutability.** Because nothing is mutated, the chain never gets rewritten out from under a past figure.

```text
NAV(4.2m) ─> positions@T ─> trades[..] (each -> source_ref)
          └─> marks@T ─> (price, source, ts)
```

The key insight: lineage can't be added retroactively — you must **capture context at the moment of writing**, because you can't invent the input reference for an event that already happened without it. Design provenance in from day one. (Cross-ref Risk & Regulation: audit trail; SQL: temporal modelling.)

### Q14. Design an end-of-day NAV/PnL calculation that's also queryable intraday.

Restate: strike an official NAV/PnL per portfolio at the close (a scheduled batch), but also let users query a live/as-of figure intraday. Two read patterns, one source of truth — a CQRS shape.

```text
Trades (event log) ──> Position fold (per portfolio)
Market data (prices) ──> Marks (price, source, ts)
        │
        ├─ EOD batch:  at "the close", snapshot positions × official close prices
        │              => official NAV/PnL (immutable, dated, the record)
        └─ Intraday:   fold-to-now × latest marks => live/estimated NAV/PnL (read model)
```

Design decisions:

1. **Define "the close" precisely.** NAV is struck against *official* closing prices at a cutoff — store *which* prices, their source and timestamp. The same positions yield different NAV under different marks, so provenance is mandatory.
2. **Official EOD figure is immutable and dated.** It's the record of account (drives fund NAV, reporting); persist it, never overwrite. A late correction is a new dated figure, not an edit.
3. **Intraday is a derived estimate.** Fold positions to now, apply latest marks — clearly labelled as live/unofficial, recomputed on demand from the same event log (CQRS read model).
4. **As-of support.** Because positions come from the event log and marks are timestamped, you can value "as of 14:00" by folding to then and using marks at then.
5. **Realised vs unrealised.** Separate PnL locked in by closes from paper PnL on open positions (which moves every tick with the price feed, even with zero trades).

Same log, two projections: an immutable official EOD strike and a live intraday estimate. (Cross-ref System Design: CQRS, batch vs streaming.)

### Q15. How do you handle out-of-order and late-arriving events in a financial stream?

Two related problems: events that arrive **out of order** (event 3 before event 2) and events that arrive **late** (a trade for yesterday booked today). Finance can't just drop them — a late trade is a real economic fact — so you design to *absorb* them correctly.

Techniques:

1. **Per-entity ordering via partitioning + sequence.** Key the stream by entity and carry a business sequence/timestamp so a consumer can order within the entity even if transport delivers out of order — buffer/reorder up to a bound.
2. **Bitemporal recording.** A late event gets its true **valid time** (yesterday) but its actual **transaction time** (now). It folds into the position *for yesterday* while preserving what you reported yesterday — no silent rewrite of past reports.
3. **Recompute affected projections.** Because state is a fold over an immutable log, inserting a late event means re-deriving the affected entity's downstream state (position/PnL) from the relevant point — cheap with snapshots (`snapshot + delta`).
4. **Idempotency still applies** — a late *duplicate* must still no-op on its business key.
5. **Correction, not mutation** — if the late event supersedes an earlier assumption, it's a compensating event, not an edit.

```text
Late trade (valid=yesterday, txn=today):
  - fold into yesterday's position (valid time)
  - preserve yesterday's published figure (transaction time)
  - re-derive affected projections from snapshot + delta
```

The enabling insight: an immutable-log + bitemporal model makes late events a *normal case* (re-fold with two timestamps), not an emergency. Last-write-wins mutable state can't do this correctly.

### Q16. Tie the primer together: what single mental model lets you design almost any financial system correctly?

**The source of truth is an append-only log of immutable, exactly-once, business-keyed events; every number you serve — position, balance, PnL, NAV — is a projection you fold from that log and can always recompute.** Almost every requirement in the domain is a corollary of that one stance:

- **Immutability** → audit trail and regulatory reconstruction come for free (Risk & Regulation).
- **Derived projections** → positions and balances are folds, never mutable truth (Positions; Money & Ledgers).
- **Compensating events** → corrections never destroy history.
- **Business-key idempotency** → exactly-once *effect* over at-least-once delivery; no double-booking/double-paying.
- **Snapshots** → bounded replay, fast reads (CQRS read models).
- **Per-entity ordering** → correctness where operations don't commute, parallelism everywhere else.
- **Bitemporality + business-day calendars** → point-in-time truth and correct settlement dates.
- **Exact money + currency** → the amounts in those events reconcile to the penny.
- **Lineage** → every projected figure traces to the events and inputs that made it.

So when an interviewer says "design a position keeper," "design a ledger," "design a reconciliation pipeline," or "design an intraday NAV," you're not learning four systems — you're applying **one pattern** with different projections and different match/fold logic. The domain vocabulary from the earlier topics tells you *what the events and invariants are*; this model tells you *how to build systems that honour them*. Internalise "immutable event log + recomputable projections, with exact money and full lineage," and you can reason about essentially any financial system you'll be handed. (Cross-ref System Design: Event Sourcing, CQRS, partitioning, delivery semantics; OOD: value objects, keyed executors.)
## Fintech, Payments & Crypto/DeFi

### Summary

**What this topic covers**

This topic maps the fintech, payments, and crypto/DeFi vocabulary onto the domain patterns you already have — ledgers, reconciliation, exact money, idempotency — so you can see that a "disruptive" payments or DeFi system is mostly the same engineering problem wearing new nouns. Three concern areas live here: (1) **card and payment systems** — the authorization → clearing → settlement flow, who the issuer, acquirer, and scheme are, and why the network is a reconciliation machine with branding; (2) **banking-as-a-service (BaaS) and open banking** — how fintechs rent a real bank's ledger and rails, and how open-banking APIs expose account and payment access; (3) **crypto assets and DeFi** — blockchains as append-only settlement ledgers, on-chain vs off-chain, finality, wallets/keys, stablecoins, and DeFi primitives (exchanges, lending) at a domain level, never as investment advice. The 16 questions here are deliberately domain-for-engineers: what the thing is, why you care, what it means for your data model. The recurring punchline is that fintech reuses the same invariants — a payment is an immutable event, a balance is a derived fold, money is `(amount, currency, scale)`, and every mutation needs an idempotency key.

**Mental model**

Think of every payment or crypto system as **a ledger plus a set of rails plus a reconciliation obligation**. The ledger is the source of truth for who owes what; the rails (card networks, ACH, SWIFT, a blockchain) are the transport that actually moves value; reconciliation is the daily proof that your ledger and the rail's records agree. A card payment is not one atomic "charge" — it is a **state machine**: authorization (a hold / promise), clearing (the network batches and nets the promises), settlement (real money moves between banks), often a day or more apart. A blockchain is the same shape viewed differently: it is a **distributed append-only ledger** where "settlement" means a transaction is included in a block and (probabilistically or deterministically) final. Stablecoins are just tokenized IOUs; DeFi lending and exchange are the same trade/position/collateral concepts you already modelled, executed by smart-contract code instead of a clearing house. When you strip the branding, you are always asking: what is the event, what is the derived balance, when is it final, and how do I reconcile against the counterparty's version of reality.

**Key terms**

- **Issuer** — the bank that gave the cardholder their card and carries their account/balance.
- **Acquirer** — the merchant's bank that receives card payments on the merchant's behalf.
- **Scheme / card network** — Visa/Mastercard-style network that routes messages between issuer and acquirer and sets the rules; it clears and nets, it does not hold your money.
- **Authorization** — a real-time check + hold on funds; a promise to pay, not the payment.
- **Clearing** — batching and netting authorized transactions to compute who owes whom.
- **Settlement** — the actual movement of money between banks (via central-bank rails).
- **BaaS (banking-as-a-service)** — a licensed bank rents its ledger, accounts, and rails to a fintech via API; the fintech is the brand, the bank is the balance sheet.
- **Open banking** — regulated APIs (e.g. PSD2) that let third parties read account data and initiate payments with user consent.
- **On-chain vs off-chain** — settled on the blockchain ledger itself vs tracked in a private ledger and settled net later.
- **Finality** — the point after which a settled transaction cannot be reversed (deterministic on some chains, probabilistic "N confirmations" on others).
- **Wallet / private key** — a keypair; the private key authorizes spends. Lose the key, lose the assets — there is no "forgot password".
- **Stablecoin** — a token pegged to a fiat currency, backed by reserves (or a mechanism); a tokenized IOU.
- **DeFi primitive** — smart-contract building block: a DEX (automated exchange), a lending/borrowing pool, collateral, liquidation.

**Why interviewers ask this**

Fintech and payments roles want to know you will not treat a payment as a single float you `UPDATE`. The junior answer says "we charge the card and add the money to the balance." The senior answer says "authorization, clearing, and settlement are separate events days apart, so I model a payment as a state machine over an append-only ledger with an idempotency key on the network's transaction id, and I reconcile against the scheme's settlement file daily." For crypto, the signal is whether you understand **finality and idempotency**: a naive engineer credits a user on the first sight of a transaction; a senior engineer waits for finality, dedupes on the on-chain tx hash, and never lets a chain reorg double-credit. Interviewers are checking that you carry the ledger/recon/exact-money discipline across the fintech buzzwords rather than reinventing it badly.

**Common confusions**

- "A card payment is atomic" — no; it is authorization → clearing → settlement, each a distinct event, often on different days, each of which can fail or reverse.
- "The card network moves my money" — the scheme routes messages and nets obligations; actual money settles bank-to-bank via central-bank rails.
- "The fintech is a bank" — usually it is a BaaS front end on a licensed bank's ledger; know where the real balance sheet lives.
- "On-chain means instant and final" — inclusion in a block is not always final; probabilistic chains need confirmations, and reorgs can un-happen a transaction.
- "Crypto removes the ledger" — the opposite; a blockchain *is* a ledger, just replicated and append-only, and you still reconcile your off-chain records against it.
- "Stablecoin = stable = risk-free" — a stablecoin is an IOU whose peg depends on its reserves/mechanism; model it as a claim, not as cash.

**What follows from this topic**

This topic is where the whole primer pays off: payments and DeFi are concrete instances of [[the ledger, idempotency, and reconciliation patterns]] from the financial-systems-patterns topic, the exact-money rules from the treasury/FX topic, and the false-friends discipline from the "Speaking the Language" topic. It feeds directly into the scenario topic, where "design a multi-currency ledger / payment system" is a headline exercise. If a term here feels like magic, translate it back into event, derived balance, finality, and reconciliation — that translation is the skill being tested.

### Q1. Walk me through what actually happens when a customer taps a card at a shop.

Four stages, not one, and they are the same authorization → clearing → settlement shape as a securities trade.

**Authorization (real-time, seconds)** — the terminal sends a message through the **acquirer** (merchant's bank) to the **scheme** (Visa/Mastercard-style network) to the **issuer** (cardholder's bank). The issuer checks funds/fraud and approves or declines, placing a **hold** on the funds. Nothing has moved yet — this is a promise.

**Clearing (hours to a day)** — the merchant submits captured authorizations in a batch. The scheme collects these, **nets** what each issuer owes each acquirer, and produces settlement instructions. This is a reconciliation-and-netting step, not a money movement.

**Settlement (T+1-ish)** — real money moves between the issuer's and acquirer's banks over central-bank rails; the merchant is credited (minus fees).

**Engineer angle**: model a payment as a **state machine over an append-only ledger** (`authorized → captured → cleared → settled`, with `reversed`/`refunded`/`chargeback` branches), never a boolean `paid`. Dedupe on the network transaction id (idempotency key). Reconcile your ledger against the scheme's daily settlement file — an authorization that never clears is a break to investigate.

### Q2. Who are the issuer, acquirer, and scheme, and why does the distinction matter to my schema?

Three distinct legal entities, three distinct roles:

| Role | Who | Holds your money? |
|---|---|---|
| **Issuer** | Cardholder's bank (gave them the card) | Yes — cardholder's account |
| **Acquirer** | Merchant's bank | Yes — merchant's account |
| **Scheme** | The network (Visa/Mastercard-style) | No — routes + nets + sets rules |

The scheme is a **message router and netting engine**, not a custodian of funds. It moves *instructions*; banks move *money*.

**Engineer angle**: your data model needs these as separate reference entities because fees, rules, and reconciliation feeds differ per role. You reconcile with the **acquirer/scheme** (settlement files), not with "the payment." Interchange and scheme fees are line items you must store per transaction — a payment's gross amount and net-settled amount differ, and conflating them corrupts merchant payout reconciliation. Keep gross, fees, and net as separate fields on the settled record; never store only the net.

### Q3. Why is idempotency non-negotiable in a payments API, and what's the right key?

Because payment networks and clients **retry**. A dropped response after a successful charge, a double-tap, a client timeout — any of these can resend the same request. Without idempotency you double-charge, which is both a bug and a regulatory/customer-trust incident.

**The right key is a business key supplied by the caller**, not a transport id. A well-designed payments API makes the client pass an `Idempotency-Key` (e.g. their order id); you persist a `(idempotency_key → result)` mapping and, on replay, return the **stored result** rather than executing again.

```sql
CREATE TABLE payment_idempotency (
  idempotency_key TEXT PRIMARY KEY,   -- caller-supplied business key
  request_hash    TEXT NOT NULL,      -- guard against key reuse w/ different body
  payment_id      TEXT,               -- the result to replay
  created_at      TIMESTAMPTZ NOT NULL
);
```

**Engineer angle**: same pattern as [[business-key idempotency in trade processing]] — the seen-keys set is the whole trick. Store the request hash too, so a reused key with a different payload is rejected as a client error, not silently mismatched.

### Q4. What is banking-as-a-service, and where does the money actually live?

**BaaS** is a licensed bank renting its **ledger, accounts, and payment rails** to a fintech via API. The fintech owns the app, brand, and UX; the bank owns the balance sheet, the regulatory license, and the actual customer funds.

So when a neobank app shows you a "balance," that balance is usually a row in the **partner bank's ledger** (or a sub-ledger the fintech keeps and reconciles against the bank). The fintech is often not holding your money at all — it is an interface plus a reconciliation obligation.

**Engineer angle**: this is a two-ledger problem. The fintech keeps its own ledger for speed and UX; the bank keeps the ledger of record. You **reconcile the fintech ledger against the bank's ledger** daily (sometimes intraday), and a mismatch is a break. Know which ledger is the source of truth — usually the bank's — and design your app ledger as a derived/cached view that can be rebuilt from events, not as an independent truth that can silently drift.

### Q5. What is open banking and what does it change for how I build?

**Open banking** is a set of regulated APIs (e.g. PSD2 in Europe) that let an authorized third party, **with the user's consent**, (a) read account data (balances, transactions) and (b) initiate payments directly from the user's bank account. It breaks the bank's monopoly on account access.

Two capabilities: **AIS** (account information — read) and **PIS** (payment initiation — write). Both are consent-scoped and time-limited.

**Engineer angle**: you are now a **consumer of someone else's ledger over an API you don't control**. That means: consent tokens with expiry (model consent as a first-class, revocable entity), rate limits, inconsistent data shapes per bank (normalise like a security master normalises symbology), and eventual consistency (the balance you read is a snapshot, not live). Payment initiation is still authorization → settlement underneath, so you model initiated payments as a state machine and reconcile completion against the account feed rather than assuming success on API 200.

### Q6. Explain a blockchain to me as a data structure, not as a buzzword.

A blockchain is an **append-only, replicated, cryptographically-linked ledger**. Each block contains a batch of transactions plus a hash of the previous block, so tampering with an old block breaks every hash after it. Many nodes hold a copy and agree on the next block via a consensus rule.

Strip the hype and it is: an **event log** (transactions) with a **materialised state** (account balances / contract storage) derived by folding the log — exactly the event-sourcing shape from [[the positions topic]]. "Settlement" = a transaction is included in a block. The novelty is *who* is allowed to append (permissionless consensus) and *tamper-evidence*, not the ledger idea itself.

**Engineer angle**: treat the chain as an external system of record you **read and reconcile against**, like a custodian feed. Your off-chain database is a derived view; the chain is the truth. Never assume your local view and the chain agree — reconcile on the transaction hash, and rebuild state by replaying confirmed transactions.

### Q7. What's the difference between on-chain and off-chain, and when would you keep something off-chain?

**On-chain** — the transaction is recorded and settled on the blockchain ledger itself; every node sees it, it is final per the chain's rules, and it costs a fee and takes block time.

**Off-chain** — you track balances in a private ledger and only settle to the chain **net, periodically** (or never). Faster, cheaper, private, but now you carry counterparty/custody risk and a reconciliation duty.

| | On-chain | Off-chain |
|---|---|---|
| Source of truth | The chain | Your private ledger |
| Speed / cost | Slow-ish, fee per tx | Fast, cheap |
| Trust | Trustless | Trust the operator |
| Recon | Against chain | Against eventual on-chain settlement |

**Engineer angle**: same trade-off as netting a batch of trades before settling — you defer expensive settlement and reconcile net. Off-chain balances are a derived fold you must be able to prove against the chain at settlement; keep the per-transaction detail so a break can be traced, don't just keep the net.

### Q8. What does "finality" mean and why can crediting a user too early be a bug?

**Finality** is the point after which a settled transaction cannot be reversed. On deterministic-finality chains, inclusion in a block is final immediately. On probabilistic chains, a block can be **reorganised** out of the canonical history if a competing chain wins — so a transaction that "happened" can un-happen. The convention is to wait for **N confirmations** (N blocks built on top) until reversal is economically implausible.

The bug: you see a deposit transaction, immediately credit the user's balance, they withdraw — then a reorg drops the deposit. You paid out real value against a transaction that no longer exists.

**Engineer angle**: model a deposit as a state machine — `seen → confirming (n of N) → final` — and only make funds spendable at `final`. Dedupe on the **on-chain tx hash** (idempotency again) so a reorg-then-reinclusion doesn't double-credit. Finality is just the crypto name for "trade done ≠ settled" — the same distinction as T+2 and settlement fails.

### Q9. Explain wallets and keys. What's the operational nightmare an engineer must design around?

A **wallet** is a keypair. The **public key/address** is where value is sent; the **private key** authorizes spending. Whoever holds the private key controls the assets — "not your keys, not your coins." There is no issuer to call, no password reset, no chargeback: **lose the key, lose the funds; leak the key, lose the funds.**

That is the nightmare: **key custody**. Options are self-custody (user holds keys), custodial (you hold keys for users — now you are a high-value target and effectively a bank), and multi-sig / MPC (a spend needs M-of-N keys, so no single compromise is fatal).

**Engineer angle**: keys are the crown jewels — HSMs, hardware signers, strict segregation, and multi-sig for anything material. You never store a raw private key in your database. Because a signed transaction is **irreversible**, your ledger must treat outbound transfers as authorization → broadcast → confirmed state transitions with idempotency on the tx, so a retry can't broadcast the same spend twice.

### Q10. What is a stablecoin, at a domain level, and how would you model holding one?

A **stablecoin** is a token pegged to a fiat currency (commonly 1:1 to a major currency), intended to hold a stable value. It is, in domain terms, a **tokenized IOU**: a claim on reserves held by (or a mechanism run by) the issuer. Types differ by backing — fiat-reserve-backed, crypto-collateralised, or algorithmic — and the peg is only as good as that backing.

**Engineer angle**: model a stablecoin balance as a **claim/asset with an issuer and a reference currency**, not as cash itself. Store `(amount, token, reference_currency, issuer)`; the reference currency lets you value it, the issuer captures the credit risk, and you should never assume the peg holds — that is a risk column, not an invariant. This is exactly the "money = `(amount, currency, scale)` and store the source" discipline: a stablecoin amount without its issuer and reference currency is meaningless, just like a bare number without a currency.

### Q11. Explain a decentralized exchange and a lending protocol without any investment advice.

At a **domain** level, both are the familiar trade/collateral concepts run by smart-contract code instead of an intermediary.

**DEX (decentralized exchange)** — swaps one token for another. Many use an automated market maker: a pool holds two tokens and a formula sets the price from the pool ratio, rather than a matched order book. Same domain nouns: an order/swap is an event, the pool has a balance, a swap changes the derived state.

**Lending protocol** — a pool where suppliers deposit tokens to earn interest and borrowers take loans against **collateral**. If a borrower's collateral value falls below a threshold, the position is **liquidated** (collateral sold to repay). This is exactly margin/collateral from [[the treasury topic]].

**Engineer angle**: these are collateralised positions with liquidation thresholds — the same position/collateral/margin data model, with the "clearing house" replaced by on-chain code. You still track positions as a fold over events, value collateral by mark-to-market against a price feed, and monitor a limit (the liquidation threshold is a risk column). No new domain — just a new venue.

### Q12. A colleague says "crypto means we don't need a database or reconciliation anymore." Push back.

That is backwards. A blockchain is a **replicated append-only ledger** — reconciliation and immutability are its whole point, not something it abolishes. And you almost always still run your own database because:

- The chain is slow and expensive to query; you need an indexed off-chain read model (CQRS) for your app.
- Your off-chain view can drift from the chain (reorgs, missed events, indexer bugs), so you **must reconcile** your database against the chain — same JOIN + DIFF as a custodian recon.
- Business data (user identity, KYC, fees, fiat legs) lives off-chain.

**Engineer angle**: crypto adds a settlement rail; it does not remove the need for a derived read model, exact money, idempotency, or reconciliation. If anything it makes reconciliation *more* central, because settlement is irreversible — a break you catch after finality can't be un-done, only compensated.

### Q13. How is exact-money handling different (or not) for crypto tokens?

Not different in principle, more dangerous in practice. You still **never use float** — but crypto tokens often have far more decimal places than fiat (many tokens use 18 decimal places), so the classic approach is **integer minor units**: store the raw integer amount in the token's smallest unit plus the token's decimal exponent, and only scale for display.

```json
{ "token": "ACMECOIN", "amount_raw": "1500000000000000000", "decimals": 18 }
// = 1.5 ACMECOIN; never store this as the double 1.5
```

**Engineer angle**: this is the same `(amount, currency, scale)` rule, with `scale` now a per-token property you must look up (like ISO 4217 exponents, but larger and per-token). A float here doesn't just round a cent — it can silently drop a fortune, because the units are tiny and numerous. Persist the raw integer and the decimals; compute in integers; format only at the edge.

### Q14. What domain patterns carry over unchanged from traditional finance to fintech?

Nearly all of them — that is the point of the topic.

- **Immutable event, derived balance** — a payment/transfer is an event; a balance is a fold over events, not a writable column.
- **Idempotency on a business key** — retries and redelivery are guaranteed; dedupe on the network/tx id.
- **Exact money, currency always attached** — `(amount, currency/token, scale)`; never float.
- **Reconciliation** — your ledger vs the scheme's settlement file / the partner bank / the chain; breaks get investigated.
- **State machine, not a boolean** — `authorized → cleared → settled`, with reversal branches; trade-done ≠ settled = auth ≠ settled = seen ≠ final.
- **Append-only + audit trail** — corrections are compensating entries, never mutations; regulators still apply (KYC/AML).

**Engineer angle**: if you can already model a trade lifecycle and a multi-currency ledger, you can model a payment or a crypto wallet — you are re-skinning the same invariants. The interview signal is that you *recognise* the reuse instead of treating fintech as a greenfield with no rules.

### Q15. Design sketch: a simple wallet/payment ledger for a fintech app. What are the invariants?

Double-entry, append-only, exact money, idempotent.

```sql
-- immutable ledger entries; every movement is two rows that sum to zero
CREATE TABLE ledger_entry (
  entry_id        BIGSERIAL PRIMARY KEY,
  txn_id          TEXT NOT NULL,          -- groups the two legs
  account_id      TEXT NOT NULL,
  amount_minor    BIGINT NOT NULL,        -- signed integer minor units
  currency        CHAR(3) NOT NULL,       -- always present
  idempotency_key TEXT NOT NULL,          -- business key from caller/rail
  created_at      TIMESTAMPTZ NOT NULL
);
-- balance is DERIVED, never stored as truth:
-- SELECT account_id, currency, SUM(amount_minor)
-- FROM ledger_entry GROUP BY account_id, currency;
```

**Invariants**: (1) every transaction's legs **sum to zero per currency** (double-entry); (2) entries are **append-only** — reversals are new compensating entries; (3) `idempotency_key` is unique, so a retry no-ops; (4) money is integer minor units with an attached currency; (5) balance is a `GROUP BY` fold, with periodic snapshots to bound the scan.

**Engineer angle**: this is the [[multi-currency ledger]] from the scenario topic in miniature — the "fintech" framing changes nothing structural.

### Q16. Spot the domain bug: a payments service does `UPDATE accounts SET balance = balance + :amt WHERE id = :acct` on each webhook from the card network.

Two bugs, both fatal.

**No idempotency.** Card-network webhooks are delivered **at-least-once** — the same event will arrive twice. This `UPDATE` double-credits on every redelivery. There is no seen-keys set, no business idempotency key, so retries silently inflate balances.

**Balance stored as mutable truth.** The balance is a folded aggregate of movements; storing it as a directly-mutated column throws away the event history, so you can't audit, can't reconcile, can't answer "as of when," and can't rebuild after a bug. Regulators and recon both require the movement log.

**The fix**: append an immutable ledger entry keyed on the network transaction id (idempotent insert — a duplicate hits the unique constraint and no-ops), and derive the balance as a fold (with snapshots for speed). Reconcile against the scheme's settlement file daily.

**Engineer angle**: `UPDATE balance` is the single most common finance-domain anti-pattern — event + derived fold + idempotency key is the fix everywhere, from trades to payments to wallets.

## Speaking the Language: False Friends & Data Modeling

### Summary

**What this topic covers**

Finance reuses ordinary English words — order, execution, fill, trade, position, balance, long, short, book, par, price — with **precise, non-obvious meanings**. Getting a word wrong doesn't just embarrass you in a stand-up; it makes your **schema and API lie**, because you'll model two distinct concepts as one field or invent a concept that doesn't exist. This topic is a false-friend dictionary aimed at data modeling: for each term, the **common misread**, the **correct meaning**, and **how to model it as distinct entities/fields**. The 16 questions cover the lifecycle cluster (order vs execution vs fill vs trade), the derived-vs-stored cluster (position vs balance, notional vs market value), the direction cluster (long vs short, the book), the settlement cluster (trade date vs settlement/value date, clearing vs settlement), and the price/quote cluster (par vs price, bid vs ask, nostro vs vostro). The through-line: **precise vocabulary is a data-modeling and stakeholder-communication concern**, not pedantry. When engineer and trader use "trade" to mean different things, the bug is born in the conversation, long before the code.

**Mental model**

Treat every finance word as a **candidate entity or field, and interrogate whether it's an event, a derived quantity, or a point-in-time value** before you put it in a schema. The classic three: a **trade is an event** (immutable, append-only), a **position is derived** (a fold over trade events), a **balance is a point-in-time aggregate** (a snapshot at instant `t`). Engineers conflate these constantly and end up with a mutable `position` column that drifts from the truth. The second habit: when two words *sound* like synonyms, assume they are **not**, and find the distinction — order vs execution vs fill vs trade are four different entities in a one-to-many chain, not four names for one row. The third habit: many terms are **directional or relative** — nostro/vostro, bid/ask, base/quote — where the meaning depends on *whose* perspective or *which* side, so the field needs the perspective encoded, not assumed. If you model the words precisely, the schema tells the truth; if you smear them together, every downstream report inherits the lie.

**Key terms**

- **order** — an *intent* to trade (buy/sell, qty, limit); not a done deal.
- **execution** — a *match event*: the order met liquidity in the market.
- **fill** — the *quantity executed* by an execution (partial or full).
- **trade** — the resulting *done deal*, aggregating one or more fills.
- **position** — *net holding* for an `(instrument, portfolio)`; **derived**, not stored raw.
- **balance** — a *point-in-time aggregate* (cash or quantity) at instant `t`.
- **long / short** — *direction*: own-it/bet-up vs sold-borrowed/bet-down; not duration.
- **the book** — a *portfolio* / set of positions; not a DB table or ledger.
- **notional** — contract *face amount* exposure is calculated on; not its worth.
- **market value** — current worth = `qty × price`; changes with the market.
- **trade date vs settlement/value date** — when the deal is struck vs when cash/securities actually move.
- **par vs price** — a bond's face/redemption value (100) vs its quoted market price (may be above/below par).
- **nostro / vostro** — "our" account at their bank / "your" account at our bank, per currency.
- **clearing vs settlement** — netting + guaranteeing obligations vs the actual exchange of value.
- **bid vs ask** — best buy price vs best sell price; you buy at the ask, sell at the bid.

**Why interviewers ask this**

Domain fluency is the fastest senior/junior discriminator in a finance interview, and it costs the interviewer one question. A junior says "we store the trade and update the position." A senior says "a trade is an immutable event, the position is a fold over trades, and the balance is a point-in-time aggregate — so I never store position as a writable column." The words reveal whether you've built financial systems or just read about them. There's also a **stakeholder-communication** signal: finance engineers sit between traders/ops (who use these words precisely) and a database (which will faithfully encode whatever misunderstanding you feed it). If you can't map the business vocabulary to distinct entities, you'll ship a schema that a trader looks at and says "that's not what a fill is" — and now every report is wrong. Interviewers probe the false-friends specifically because that's where the expensive, silent modeling bugs hide.

**Common confusions**

- "Order, trade, execution — same thing" — four distinct entities in a 1:N chain; conflating them flattens auditable structure into one lying table.
- "Position is a column I update" — position is *derived*; storing it as truth guarantees drift and kills the audit trail.
- "Long/short = how long I hold it" — it's *direction*, not time horizon; a short can be held for months.
- "The book is a table" — it's a *portfolio*; "booking a trade" means recording it to a portfolio, not writing to a table called book.
- "Notional = value" — a large-notional swap can be worth near zero; store both, never reuse one column.
- "Trade date = settlement date" — they differ (T+1/T+2 in business days); using one for the other misstates cash and exposure.
- "Nostro and vostro are two account types" — they're the *same account from two perspectives*; the word encodes whose books you're on.

**What follows from this topic**

This is the Rosetta Stone for the rest of the primer: the lifecycle terms feed [[the trade-lifecycle and positions topics]], the derived-vs-stored distinction underpins [[event-sourced position keeping]], and nostro/vostro + settlement dates feed [[the treasury and multi-currency ledger topic]]. In the scenario topic, every design starts by naming entities correctly — get the words right and the data model almost writes itself; get them wrong and no amount of clever architecture saves the schema from lying. When you design, say the word out loud and ask: event, derived, or point-in-time?

### Q1. What's the difference between an order, an execution, a fill, and a trade — and how do you model them?

Four distinct concepts in a one-to-many chain, not four names for one thing.

- **Order** — *intent*: "buy 1000 ACME at ≤ 50." Nothing has happened in the market yet.
- **Execution** — a *match event*: your order met liquidity. One order can have many executions.
- **Fill** — the *quantity* an execution filled (e.g. 400 of the 1000). Partial fills are normal.
- **Trade** — the *done deal* that aggregates the fills into a booked economic transaction.

```
Order (buy 1000 ACME @ ≤50)
 ├─ Execution #1  → Fill 400 @ 49.9
 ├─ Execution #2  → Fill 350 @ 50.0
 └─ Execution #3  → Fill 250 @ 50.0
        ⇒ Trade: 1000 ACME, avg 49.96
```

**Engineer angle**: model as **parent/child rows** — `orders 1:N executions/fills`, aggregated into a `trade` — never one flat table with nullable columns. Flattening loses partial-fill history and average-price provenance, and makes the audit trail unreconstructable. This is the canonical false-friend: "we got a trade" from a trader might mean an execution to them and a booked trade to ops.

### Q2. Explain position vs balance to an engineer. Why is one derived and one stored?

Both are aggregates, but of different things at different granularity.

- **Position** — net holding for an `(instrument, portfolio)`: net quantity + average cost. It is a **fold over all trade events** for that key. Derived.
- **Balance** — a **point-in-time aggregate**, typically of cash (or quantity) at instant `t`. Also derived from movements, but the emphasis is "as of this instant."

Neither should be a writable column that you mutate directly. Both are **computed from an append-only event log**:

```sql
-- position = fold over trades
SELECT portfolio_id, instrument_id,
       SUM(signed_qty) AS net_qty
FROM trade
GROUP BY portfolio_id, instrument_id;
```

**Engineer angle**: store the **events** (trades, cash movements) as truth; materialise position/balance as read models (CQRS), refreshed by the fold, with snapshots to bound replay. If you store position as a mutable column, a missed or double-applied trade makes it drift from the events with no way to detect or rebuild — the exact bug event-sourcing exists to prevent.

### Q3. Why is a position "derived state" and not something I store and update?

Because the **trades are the facts; the position is an opinion computed from them**. If you store position as the source of truth and update it on each trade, you have two independent representations of the same reality that *will* diverge — a redelivered trade double-counts, a dropped trade under-counts, and you can't tell which happened or fix it.

Deriving it instead gives you: **rebuildability** (recompute from the log after any bug), **auditability** (every position number traces to the trades behind it), **as-of queries** (fold up to timestamp `t`), and **idempotency** (dedupe trades on a business key before folding). The mutable-column approach gives you none of these and silently lies.

**Engineer angle**: position is a **materialised read model**, not a system of record. Keep it for speed, but treat it as disposable — you can always throw it away and re-fold the trade log. Snapshots make that fold `O(delta)`. The moment you can't rebuild your positions from your trades, you've lost the plot.

### Q4. What's the difference between long and short, and what does an engineer most often get wrong?

**Long** = you own it / bet the price goes up. **Short** = you've sold something you borrowed / bet the price goes down. It is **direction**, full stop.

The common wrong: assuming **long/short means time horizon** ("long = hold a long time"). It doesn't — a short position can be held for months, a long position closed in seconds. Duration is unrelated.

**Engineer angle**: represent direction as the **sign of the quantity**, not a separate `direction` enum you can forget to keep consistent. A long position is `+qty`, a short is `−qty`; the fold over trades naturally produces a signed net. This keeps PnL and exposure math sign-correct automatically and removes a whole class of "we forgot to flip the sign for shorts" bugs. If you model direction as a string column beside an unsigned quantity, you've created two fields that can contradict each other.

### Q5. Someone says "book the trade to the EM book." What is "the book" and what is it not?

**The book** is a **portfolio** — a named set of positions (e.g. the emerging-markets book, the rates book). "Booking a trade" means **recording it against a portfolio**. It is an organisational/ownership grouping of positions.

What it is **not**: a database table, a ledger, or a physical file. "The book" is a false friend precisely because it sounds like a place you write rows.

**Engineer angle**: model "book" as a **portfolio dimension** (a foreign key on trades/positions), not as anything literal. Every trade references the portfolio it's booked to; positions aggregate per `(instrument, portfolio)`. When a trader says "move this to another book," they mean re-assign the portfolio, which in an append-only world is a **compensating transfer event** (book out of A, book into B), never an in-place `UPDATE` of a `book` column — the audit trail must show the move.

### Q6. Notional vs market value — why can't they share a column?

They measure different things and routinely diverge.

- **Notional** — the contract's **face amount**, what exposure/interest is calculated on. Fixed by the contract.
- **Market value** — what the position is **currently worth** = `qty × price`, changing every tick.

A large-notional interest-rate swap can have a market value near **zero** at inception (fixed and floating legs offset). A bond's notional (par) is fixed at 100 while its market value floats above or below par.

**Engineer angle**: store them as **separate fields** — `notional` (static, from the contract) and `market_value` (derived, from a mark). Reusing one column for both means every risk and PnL report inherits the confusion: exposure limits key off notional, PnL keys off market value, and a system that conflates them will mis-size risk. Also store the **mark price source and timestamp** behind market value — the same position yields different market values depending on which price you used.

### Q7. Explain trade date vs settlement date (value date). What breaks if you use one for the other?

- **Trade date** — when the deal is **struck** (economics agreed). This is when the position and PnL start.
- **Settlement date / value date** — when cash and securities **actually change hands**, typically T+1 or T+2 in **business days**.

Between them the trade is **executed but not settled** — a real state you must model.

If you conflate them: you misstate **cash** (you show money moved when it hasn't, or vice versa), misstate **available balance** (unsettled cash isn't spendable), and can't detect a **settlement fail** (it didn't settle on the value date). You also can't answer "what settles tomorrow," which treasury needs for funding.

**Engineer angle**: store **both dates** on every trade, and model settlement status as a **state machine** (`executed → cleared → settled`, with `failed`/`pending` branches), not a boolean. Compute value date with a **holiday calendar** (business days), never `trade_date + INTERVAL '2 days'` — weekends and market holidays make naive date math wrong.

### Q8. What's the difference between par and price for a bond, and how do you model it?

- **Par** (face value) — the bond's **redemption amount**, conventionally quoted as **100**. It's what the issuer repays at maturity and what coupons are calculated on. Fixed.
- **Price** — the bond's **current market price**, quoted as a **percentage of par**. 98 means "trading below par" (at a discount), 103 means "above par" (at a premium).

So a bond with 1,000,000 par trading at a price of 98 has a market value of ~980,000 (plus accrued interest) — par and price are different numbers doing different jobs.

**Engineer angle**: store **par/face amount** (static reference data on the position) and **price** (a mark from market data) as **separate fields**, and never assume price = 100. Market value = `par × price/100` (+ accrued). Coupons compute off par, not price. Conflating them — e.g. treating the price 98 as the value — understates or overstates holdings by orders of magnitude. This is the fixed-income cousin of notional vs market value.

### Q9. Explain nostro vs vostro. Why is it the same account from two perspectives?

**Nostro** = "**our** account held at **another** bank" (our money, their books). **Vostro** = "**your** account held at **our** bank" (your money, our books). The identical account appears as a **nostro to one party and a vostro to the other** — the word encodes *whose* perspective, per currency.

If Bank A holds an account at Bank B: to A it's a **nostro**; to B it's A's **vostro**. Same balance, two viewpoints.

**Engineer angle**: this is a **perspective/relationship** attribute, not two account types. Model the account once with the two parties and derive the label from whose books you're rendering — don't create separate `nostro_account` and `vostro_account` entities that can disagree. Because both banks keep records of the same account, the two views **must reconcile**; a nostro/vostro break is a classic recon exception. Nostros are per-currency (a bank holds a different nostro for each currency it settles in), so currency is part of the key.

### Q10. Clearing vs settlement — traders use them interchangeably. Where's the line?

They're sequential, distinct post-trade stages.

- **Clearing** — **netting and guaranteeing** obligations before money moves. A central counterparty (CCP) often steps in, nets everyone's trades down to net obligations, and guarantees them. No value has changed hands yet.
- **Settlement** — the **actual exchange** of cash for securities (delivery-versus-payment). This is when value truly moves.

```
Execution → Clearing (net + guarantee) → Settlement (cash vs security, T+2)
```

**Engineer angle**: model these as **separate states in the settlement state machine**, because failures differ — a clearing issue vs a settlement **fail** (didn't move on the value date) are different exceptions with different ops workflows. "Trade done ≠ cleared ≠ settled." Storing a single boolean `settled` throws away the intermediate states you need to track pending obligations and chase fails.

### Q11. The quote is "EUR/USD = 1.10." What does it mean, and what's the classic inversion bug?

**EUR/USD = 1.10** means **1 EUR = 1.10 USD**. The first currency (EUR) is the **base**, the second (USD) is the **quote/counter**. The number is how many units of quote currency one unit of base costs.

The classic bug: **applying the rate in the wrong direction** — dividing when you should multiply, or using 1/1.10 as if it were 1.10. To convert 100 EUR to USD you **multiply** (110 USD); to convert 100 USD to EUR you **divide** (90.9 EUR). Invert it and you're off by the **square of the rate** — and it's **silent**, because the result still looks like a plausible number.

**Engineer angle**: never store a bare rate. Store it as a **directional triple** — `(base, quote, rate)` — and write conversion functions that take source and target currency explicitly and pick multiply/divide from the pair, so the direction can't be applied by accident. Also stamp the **rate's source and timestamp** (same pair differs by venue/snapshot). The inversion bug is one of the most expensive silent errors in FX systems precisely because it type-checks and looks reasonable.

### Q12. Explain bid vs ask, and which one applies when I buy?

- **Bid** — the best price someone will **buy** at (the price *you* sell into).
- **Ask (offer)** — the best price someone will **sell** at (the price *you* buy at).
- **Spread** = ask − bid; **mid** = (bid+ask)/2.

So **you buy at the ask, you sell at the bid**. The counterintuitive bit: "bid" is the buyer's price but it's the price *you* get when *you're* selling.

**Engineer angle**: store **both bid and ask** on a quote, never a single "price," because which one is correct depends on the **side** of your trade. Valuing a long position you'd sell at the bid; a short you'd cover at the ask; a mid mark is a convention you must record as such. A system that marks everything at a single price silently mis-values on one side and overstates PnL. When you record an execution, capture the actual fill price, not the mid — the spread is a real cost.

### Q13. Why is getting the vocabulary right a data-modeling problem, not just pedantry?

Because your **schema faithfully encodes whatever misunderstanding you feed it**, and then every downstream report inherits the error silently. If you model "order" and "trade" as one table because you thought they were synonyms, you've destroyed the one-to-many structure that partial fills need — and no query can reconstruct it. If you store "position" as a mutable column because you didn't register that it's derived, it drifts from the trades and you can't tell. If you reuse one column for notional and market value, risk limits and PnL both break.

The words *are* the entity boundaries. A trader saying "fill" and an engineer hearing "trade" is a modeling bug being created **in conversation**, before any code exists.

**Engineer angle**: precise vocabulary is how you **negotiate the entity model with the business**. When you name entities the way traders and ops do, they can look at your schema and catch the lie; when you smear the words, they can't, and the bug ships. Vocabulary discipline is upstream of schema correctness.

### Q14. Spot the modeling bug: a schema has one `transactions` table with a nullable `fill_price` and a mutable `position_qty` column.

Two false-friend bugs baked into one table.

**Orders/executions/fills flattened.** A single `transactions` table with a nullable `fill_price` is trying to be order, execution, fill, and trade at once. The nullable column is the tell: it's null for intents (orders) and populated for fills. This loses the **1:N structure** — one order to many fills — so you can't represent partial fills cleanly, can't audit which fills built a trade, and can't reconstruct average price provenance.

**Position stored as a mutable column.** `position_qty` being updated in place means position is treated as **truth**, not derived. It will drift from the sum of fills, can't be rebuilt, can't answer as-of, and breaks under redelivery.

**The fix**: split into `orders 1:N executions/fills`, aggregate into `trades`, and **derive** position as a fold (materialised read model + snapshots). Every stage is append-only.

**Engineer angle**: the nullable-column-per-lifecycle-stage and the mutable-aggregate-column are the two signatures of false-friend modeling — both flatten distinct concepts into one lying row.

### Q15. A field is called `amount` with no currency. Why is that a bug, and how does it relate to false friends?

An `amount` without a currency is **meaningless** — 100 what? It's the money version of the same false-friend disease: treating a domain concept (money = `(amount, currency, scale)`) as a simpler thing (money = a number). The moment two currencies enter the system, a bare `amount` silently compares or sums EUR with USD and produces garbage that still looks like a number.

**Engineer angle**: money is always a **compound value** — store `currency` beside every `amount`, and the `scale` (minor-unit exponent) too, since it varies per currency. Use an **exact decimal or integer minor units**, never float. Forbid a bare numeric money column in review the same way you'd forbid conflating order and trade — it's the same failure: modeling a rich domain concept as a naive primitive. A total, a balance, a PnL — all must carry currency, and cross-currency aggregation must go through an explicit, timestamped FX conversion.

### Q16. Give me a cheat-sheet mapping of the top false friends to how you model each.

The table every finance engineer should carry:

| Term | Sounds like | Actually is | Model as |
|---|---|---|---|
| order | the trade | intent to trade | parent entity |
| execution | the trade | a match event | child of order |
| fill | the trade | qty executed | child of execution |
| trade | any of above | booked done deal | aggregate of fills (event) |
| position | a stored number | net holding | **derived** fold over trades |
| balance | current cash | point-in-time aggregate | derived, as-of `t` |
| long/short | duration | direction | sign of quantity |
| the book | a table/ledger | a portfolio | portfolio FK |
| notional | its value | contract face amount | static field |
| market value | notional | qty × price now | derived from a mark |
| par | the price | face/redemption (100) | static field |
| price | par | market quote (% of par) | mark from market data |
| nostro/vostro | two account types | one account, two views | perspective on one account |
| clearing | settlement | net + guarantee | state before settlement |
| bid/ask | one price | buy vs sell price | two fields on a quote |

**Engineer angle**: the pattern across the whole table — ask **event, derived, or point-in-time?**, and **whose perspective / which side?** Answer those two questions per term and the schema stops lying.

## Finance Domain Scenario & Interview Playbooks

### Summary

**What this topic covers**

This is the pure **scenario** topic — the payoff where the whole primer becomes a set of system designs you can drive in an interview. Each question is a design prompt driven the same way: **restate → assumptions → diagnose → simple-first → tradeoffs**, always **leading with the data model and invariants** before any framework. The 16 questions cover the canonical finance-domain designs: a **real-time position-keeping service** from a trade event stream (per-portfolio ordering, business-key idempotency, event-sourced fold, snapshots); an **EOD NAV/PnL calc that's also queryable intraday** (batch close vs streaming, as-of semantics, CQRS, what "the close" actually means); a **reconciliation system** (JOIN + DIFF on messy data, tolerances, break classification, chunk-to-scale); a **security master** (canonical id + mapping, effective-dated); a **multi-currency ledger / payment system** (double-entry, exact money, FX direction, idempotency); plus how to **demonstrate domain fluency** in a fintech interview. These aren't new concepts — they're the trade/position/balance, event-sourcing, reconciliation, and exact-money patterns from earlier topics assembled into end-to-end systems.

**Mental model**

Drive every finance design the way you'd drive a system-design round, but **anchor on the domain model first**. The method: **(1) Restate** — say what the system must do and for whom (front/middle/back office). **(2) Assumptions** — volume, latency, consistency tolerance, source of truth. **(3) Diagnose the invariants** — this is the finance-specific move: name the events, the derived state, the idempotency key, the ordering scope, the money representation, the as-of requirement, *before* drawing boxes. **(4) Simple-first** — the naive correct design (an append-only log + a fold), then only add complexity you can justify. **(5) Tradeoffs** — surface the recurring tensions: ordering (per-key not global), idempotency (business key), as-of (bitemporal not last-write-wins), money (never float), read-vs-write (CQRS). The candidates who pass lead with "a trade is an immutable event, the position is a fold, here's the idempotency key" and *then* talk about Kafka. The ones who fail start with Kafka and never mention that a position is derived.

**Key terms**

- **Event-sourced fold** — positions/balances computed by reducing an append-only event log; the log is truth.
- **Business-key idempotency** — dedupe on a domain id (source trade id), not a transport id; persist seen keys.
- **Per-entity ordering** — order events within a key (portfolio) but process keys in parallel; never global order.
- **Snapshot + delta** — periodic materialised state so replay is `O(delta)`, not `O(full history)`.
- **As-of / point-in-time** — "as it stood at time `t`," not "now"; needs history, ideally bitemporal.
- **CQRS** — separate the write model (append events) from read models (materialised positions/NAV) for different access patterns.
- **The close** — the official EOD snapshot of prices used to strike marks/NAV; a defined instant, not "latest tick."
- **NAV** — net asset value: assets − liabilities per portfolio/fund, typically struck daily after the close.
- **Reconciliation break** — an unmatched/mismatched item between two systems; investigated until cleared.
- **Security master** — canonical instrument id + effective-dated mapping to every external id.
- **Double-entry** — every movement is balanced legs summing to zero per currency; the ledger invariant.
- **Bitemporal** — track both when something happened and when it was recorded/known; enables correct as-of + corrections.

**Why interviewers ask this**

Scenario questions are where domain fluency and system-design skill combine — you can't fake either. A fintech interviewer wants to see you **lead with invariants**: name the event, the derived state, the idempotency key, and the ordering scope in the first two minutes. The junior signal is jumping straight to technology ("I'd use Kafka and Cassandra") without ever stating that a position is derived or that trades need business-key dedupe — a design that will double-count on the first redelivery. The senior signal is the reverse: "the trade log is the source of truth, position is a materialised fold keyed by portfolio for ordering, deduped on source trade id, snapshotted hourly — now let's pick storage." These questions also test **communication**: can you restate the problem, state assumptions out loud, and surface tradeoffs rather than presenting one design as obviously correct. That restate-assumptions-tradeoffs discipline is exactly what separates an engineer who can be handed an ambiguous finance problem from one who needs it fully specified.

**Common confusions**

- "Store the position, update it per trade" — position is a **derived fold**; storing it as truth guarantees drift and no rebuild.
- "Dedupe on the Kafka offset / message id" — that's a **transport** id; use the **business** key (source trade id) so redelivery across topics/retries still no-ops.
- "Order the whole stream" — global ordering kills throughput; order **per portfolio**, parallelise across portfolios.
- "NAV is real-time" — NAV is struck at **the close**, a defined EOD instant; intraday you serve an estimate, not the official number.
- "Recon is arithmetic" — recon is a **JOIN + DIFF on messy data** (symbology, dates, sign, rounding, dupes); it's a data-quality problem.
- "Corrections update the record" — corrections are **compensating events**; never mutate a booked trade (audit trail).
- "One FX rate, apply it" — rates are **directional** and timestamped; wrong direction is a silent square-of-the-rate bug.

**What follows from this topic**

This topic assembles every earlier one into deliverable designs: [[trade lifecycle]], [[positions/PnL/NAV]], [[reconciliation]], [[security master]], [[treasury and multi-currency ledgers]], and the [[financial-systems patterns]] (event sourcing, idempotency, ordering, exact money). It's the last topic because it's the integration exam — if any invariant here feels unfamiliar, go back to the topic that owns it. In a real interview, the move that lands is always the same: name the event, name the derived state, name the idempotency key and the ordering scope, then design. Lead with the model; the architecture follows.

### Q1. Design a real-time position-keeping service from a trade event stream.

**Restate**: consume a stream of trade events, maintain current positions per `(portfolio, instrument)`, serve them with low latency, survive restarts and redelivery.

**Assumptions**: at-least-once delivery, high volume, positions queried by traders/risk in real time, must be rebuildable and auditable.

**Invariants (lead here)**: a **trade is an immutable event**; a **position is a fold** over trades for a key; delivery is at-least-once so consumers **must be idempotent**; order matters **within** a portfolio, not across.

**Simple-first design**:

```
Trade stream (partitioned by portfolioId)
   → idempotent consumer (dedupe on source trade id)
   → fold into position read model  (net qty, avg cost)
   → periodic snapshot (bound replay)
   → query API serves the read model
```

- **Ordering**: partition the stream by `portfolioId` so events for one portfolio are ordered, but portfolios process in parallel.
- **Idempotency**: persist seen `source_trade_id`s; a redelivery is a no-op — never double-book.
- **Snapshots**: checkpoint position + last-applied offset periodically; restart = load snapshot + replay delta.

**Tradeoffs**: global ordering would be correct but throughput-killing — key-level ordering is the win. The read model is disposable; the trade log is truth, so any fold bug is fixed by replay.

**Engineer angle**: this is textbook event sourcing + CQRS with per-key ordering and business-key idempotency — the four invariants *are* the design.

### Q2. In that service, why dedupe on the source trade id and not the message/offset?

Because the **transport id doesn't survive the failure modes you're deduping against**. A Kafka offset or message id is unique per delivery attempt on one topic — but the same logical trade can arrive via a retry with a new id, be republished to a different topic, be replayed after a reset, or come from an upstream that re-sends. Dedupe on the offset and every one of those double-books.

The **source trade id** (or a business idempotency key the upstream stamps) identifies the **logical trade** across all of those, so a redelivery in any form collapses to the same key and no-ops.

```sql
-- seen-keys guard, keyed on the business id
INSERT INTO applied_trades(source_trade_id) VALUES (:id)
ON CONFLICT DO NOTHING;   -- 0 rows affected ⇒ already applied ⇒ skip the fold
```

**Engineer angle**: idempotency keys must be **business-meaningful and stable across transports**. "Exactly-once" is really "at-least-once delivery + idempotent consumer keyed on a business id" — there's no magic, just the seen-keys set on the right key.

### Q3. Design an EOD NAV/PnL calc that's also queryable intraday.

**Restate**: strike the official NAV/PnL per portfolio at end of day, but also let users query an intraday estimate.

**Assumptions**: the official NAV is a **defined daily number** struck at the close; intraday users accept an estimate that moves with prices.

**Invariants (lead here)**: **the close** is a defined instant with an official price set; **NAV is derived** (`assets − liabilities`, marked at close prices); **PnL = realized + unrealized**, and unrealized changes with the mark even with zero trades; every marked number must carry its **price source + timestamp**.

**Design (CQRS, two paths)**:

- **Batch close path** — after the close, run the official EOD job: take positions (fold of trades to EOD), apply **official closing prices**, compute NAV/PnL, persist an **immutable, dated NAV record** (the number of record).
- **Intraday streaming path** — the same position fold, marked with **latest available prices**, served as an **estimate** clearly labelled as such, not the official number.

**As-of semantics**: NAV is queried "as of date D at the close" — store dated snapshots so "what was NAV on D" is a lookup, not a recompute; support corrections as new dated records.

**Tradeoffs**: intraday estimate trades accuracy for freshness; the official number trades freshness for defined, auditable pricing. Never let the intraday estimate overwrite the official close.

**Engineer angle**: "the close" is a **business-defined snapshot**, not "latest tick" — modeling it as a defined instant with a stored price set is the whole trick.

### Q4. What does "the close" actually mean, and why does it complicate the design?

**The close** is the **official end-of-day snapshot of prices** used to strike marks, PnL, and NAV — a *defined instant* with an *agreed price source*, not simply "the last trade of the day" or "latest tick." Different markets close at different times; some instruments have no clean closing print and use a derived/vendor close; a global fund's "close" spans time zones.

It complicates the design because:

- **NAV depends on which prices** — the same positions marked with different closing prices give different NAV, so you must **store the price source and timestamp**, not just the number.
- **Intraday ≠ close** — an intraday estimate uses live prices; only the close is official. You need both paths and must not conflate them.
- **Corrections happen** — a bad closing price gets restated; you post a **new dated NAV**, never mutate the original.

**Engineer angle**: model the close as a **first-class, dated, sourced snapshot entity** (`price_close(instrument, date, price, source, ts)`), and make every NAV/PnL record reference the price set it used. That's what makes NAV reproducible and auditable — the auditor can reconstruct exactly which prices produced the number.

### Q5. Design a reconciliation system matching internal trades to a custodian feed.

**Restate**: prove that internal records agree with an external custodian's records; surface mismatches (breaks) for ops.

**Assumptions**: the two feeds use **different conventions** (symbology, date formats, sign, rounding), delivery is imperfect (dupes, late files), runs daily and intraday.

**Invariants (lead here)**: recon is a **JOIN + DIFF on messy data**, not arithmetic; matching needs **tolerances**; loaders must be **idempotent**; every break needs an **audit trail**.

**Pipeline (simple-first)**:

```
External feed ─┐
               ├─ Normalise (map symbols via security master, fix dates/sign/scale)
Internal recs ─┘
               → Match on keys (trade_id, else instrument+date+qty) with tolerances
               → Classify: matched / unmatched-internal / unmatched-external / mismatched
               → Break report + aging → ops
```

- **Match keys**: prefer a shared `trade_id`; fall back to `instrument + date + qty` fuzzy keys.
- **Tolerances**: allow small price/qty rounding diffs so noise isn't a break.
- **Normalise first**: map both sides' symbols through the **security master**; align dates/timezones and sign conventions before matching.

**Scale**: chunk by **date or counterparty** and parallelise — recon is embarrassingly partitionable.

**Tradeoffs**: tighter tolerances catch more real breaks but create noise; looser tolerances hide small errors. Idempotent loaders let you re-run a file safely.

**Engineer angle**: recon is the **messy-data problem in business form** — a JOIN + DIFF over two systems that disagree on conventions; it's data-quality engineering, not computation.

### Q6. In that recon system, how do you classify and manage breaks?

Breaks aren't binary — classify by **why** they didn't match, because each type routes differently:

| Break type | Meaning | Typical cause |
|---|---|---|
| Unmatched (internal) | We have it, they don't | Timing (they haven't booked yet), or our error |
| Unmatched (external) | They have it, we don't | Missed booking on our side, or their error |
| Mismatched | Both have it, values differ | Price/qty/date/sign/rounding diff beyond tolerance |

**Management**: each break is a **first-class, aged entity** — it has an id, a first-seen date, a status, an owner, and an audit trail of investigation. **Aged-break reports** surface anything unresolved past T+n. A break that clears on its own next day (pure timing) is distinct from a persistent one needing a correction.

**Engineer angle**: model breaks as **stateful, append-only records** (`open → investigating → resolved`), never transient log lines — regulators and ops both need the history of what broke, when, and how it was resolved. Corrections to internal records are **compensating entries**, not mutations. The recon system's real product is the **break workflow**, not the match itself.

### Q7. Design a security master.

**Restate**: a canonical instrument reference store that maps every external identifier to one internal id, so business data never keys on a messy vendor symbol.

**Assumptions**: one instrument has **many ids** (ISIN, CUSIP, SEDOL, FIGI, tickers) across vendors/venues; none is universal; ids/mappings **change over time** (renames, corporate actions, reused tickers).

**Invariants (lead here)**: one **canonical internal id** is the FK everywhere; mapping to external ids is **many-to-many over time** → **effective-dated**; never key trades/positions on a raw ticker.

**Model (simple-first)**:

```sql
CREATE TABLE instrument (            -- canonical
  instrument_id BIGINT PRIMARY KEY,  -- internal, stable, the FK everywhere
  asset_class   TEXT, description TEXT
);
CREATE TABLE instrument_xref (       -- effective-dated mapping
  instrument_id BIGINT REFERENCES instrument,
  id_type       TEXT,   -- 'ISIN' | 'CUSIP' | 'TICKER' | 'FIGI' ...
  id_value      TEXT,
  valid_from    DATE, valid_to DATE  -- history, not a single static row
);
```

- **Lookups join through the master** — resolve any external id to the canonical `instrument_id`, then use that everywhere.
- **Effective dates** — a reused ticker or a rename is a new mapping row, not an overwrite, so historical trades still resolve correctly as-of their date.

**Tradeoffs**: effective-dating adds complexity but is non-negotiable — without it, corporate actions and symbol reuse corrupt history.

**Engineer angle**: the master is **reference data** (slow-changing, hot reads) → cache + CDC, opposite profile to market data. **Never regex/string-match two symbols to decide they're the same instrument** — map through the master.

### Q8. Design a multi-currency ledger / payment system.

**Restate**: a ledger that tracks balances across multiple currencies, supports transfers/payments, exposes point-in-time balances, and never loses a cent.

**Assumptions**: multi-currency, at-least-once message delivery, balances queried as-of arbitrary times, strict audit requirements.

**Invariants (lead here)**: **double-entry** (legs sum to zero **per currency**); **money = (amount, currency, scale)**, exact decimal / integer minor units, **never float**; **balance is a derived fold**, not a mutable column; movements are **idempotent** on a business key; corrections are **compensating entries**.

**Model (simple-first)**:

```sql
CREATE TABLE ledger_entry (
  entry_id     BIGSERIAL PRIMARY KEY,
  txn_id       TEXT NOT NULL,        -- groups balanced legs
  account_id   TEXT NOT NULL,
  amount_minor BIGINT NOT NULL,      -- signed integer minor units
  currency     CHAR(3) NOT NULL,     -- always present
  idem_key     TEXT UNIQUE NOT NULL, -- business idempotency key
  created_at   TIMESTAMPTZ NOT NULL
);
-- balance = SUM(amount_minor) per (account, currency); snapshot to bound scan
```

- **FX**: a cross-currency transfer stores the **directional rate + timestamp + source** used, with legs in each currency; conversion picks multiply/divide from the pair explicitly.
- **As-of balance**: fold entries up to `t`; snapshots make it `O(delta)`.

**Tradeoffs**: append-only + double-entry costs storage and write amplification but buys auditability, rebuildability, and correct as-of — mandatory in finance.

**Engineer angle**: the payment framing changes nothing — same event/derived/idempotent/exact-money invariants as a trade ledger.

### Q9. Why double-entry, and what invariant does it give you for free?

**Double-entry** records every movement as **balanced legs that sum to zero** (per currency): money leaving one account enters another. The invariant it buys is a **continuously checkable conservation law** — the sum of all entries in a `txn_id` must be zero, and the sum across a closed set of accounts must be constant. If it isn't, you've lost or created money, and you know instantly.

That turns a whole class of bugs into a **cheap assertion**: a dropped leg, a double-applied credit, a rounding leak — all break the sum-to-zero check. Single-entry (just incrementing a balance) has no such safety net; an error silently accumulates.

```
Transfer 100 USD from A to B:
  A: -10000 (minor units, USD)
  B: +10000 (minor units, USD)   ⇒ sum = 0 ✓
```

**Engineer angle**: double-entry is an **integrity constraint you can enforce and reconcile against** — pair it with exact integer minor units (so the sum is exact, not float-fuzzy) and idempotency (so retries don't post a leg twice). It's the accounting profession's version of a checksum.

### Q10. How do you handle corrections in any of these systems without breaking the audit trail?

Never `UPDATE` a booked record. A trade, a ledger entry, a NAV number — once recorded, it's **immutable**. Corrections are **new compensating events** that reverse and/or replace, so both the original and the fix survive in the log.

- **Wrong trade booked** → post a **reversing trade** (equal and opposite), then book the correct one. The position fold naturally nets to the right answer, and the history shows what happened.
- **Wrong ledger entry** → post a **compensating entry**; the balance re-folds correctly.
- **Wrong NAV** → publish a **new dated NAV record** (a restatement), never mutate the original.

**Why**: regulators must **reconstruct who did what, when, from what input** — sometimes years later. A silent `UPDATE` destroys that. Segregation of duties also means the person who spots the error often can't unilaterally mutate the data anyway.

**Engineer angle**: this is the **accept-and-reconcile / never-silently-correct** pattern. Append-only + compensating events = full lineage. Any design that mutates records in place fails the audit requirement, full stop — build for append-only history from day one because retrofitting it is brutal.

### Q11. Walk me through as-of / point-in-time queries. Why isn't last-write-wins enough?

An **as-of query** asks "what did this look like **as it stood at time `t`**," not "what does it look like now." Finance needs this constantly: NAV as of last month-end, the position as of the trade date, the price used at the close. Last-write-wins keeps only the current value, so it **can't answer historical questions** — the past is overwritten.

Worse, finance needs **bitemporal**: two time axes — when something **happened** (valid/effective time) and when it was **recorded/known** (transaction time). A trade booked today with yesterday's trade date, or a correction to last week's NAV, means "what did we *think* NAV was on D, as known on D+2" differs from "what do we *now* know NAV was on D." Only bitemporal history captures both.

**Engineer angle**: keep an **append-only event log** (fold up to `t` for valid-time as-of) and, where corrections matter, a **bitemporal model** (both timestamps on each record). Snapshots bound the fold cost. Last-write-wins is a data-loss bug in any system that must reconstruct the past — which in finance is all of them.

### Q12. When would you choose streaming vs batch for a finance calc, and can you have both?

It's driven by **what the number is for**:

| | Batch | Streaming |
|---|---|---|
| Fits | Official EOD numbers (NAV, regulatory reports) | Live estimates (intraday PnL, risk monitoring) |
| Timing | Runs at a defined instant (the close) | Continuous |
| Correctness | Defined inputs, reproducible, official | Fresh but estimate |

**You often want both**, and that's what CQRS gives you: the **same event log / position fold** feeds two read models — a batch job that strikes the official close, and a streaming job that maintains a live estimate. The official number and the estimate must be **clearly distinguished** and never overwrite each other.

**Engineer angle**: don't pick one — separate the **write model** (append trades/prices) from **two read models** (official batch, live stream) over the same source of truth. The classic mistake is letting the streaming estimate masquerade as the official NAV; label provenance (source + timestamp + "estimate vs official") on every number so consumers can't confuse them.

### Q13. What are the recurring tensions you should proactively surface in any finance design?

Name these before the interviewer digs — it signals you've built these systems:

- **Ordering** — order **per key** (portfolio/account), not globally; global ordering is correct but throughput-killing. Partition the stream by the key.
- **Idempotency** — at-least-once delivery is the norm, so dedupe on a **business key** (source trade id), not a transport id; persist seen keys.
- **As-of** — "now" vs "as it stood at `t`" — use append-only history / bitemporal, not last-write-wins.
- **Money** — never float; exact decimal or integer minor units; **currency always attached**; explicit rounding.
- **Read vs write** — the hot ingest path and the ad-hoc query path want **different stores** (CQRS); don't force one to serve both.
- **Source of truth** — the **event log** is truth; positions/balances/NAV are derived read models you can rebuild.

**Engineer angle**: for each, state **what's the source of truth, can I rebuild state from the log, and what's my tolerance for stale/wrong**. Leading with these tensions — rather than waiting to be asked — is the single clearest senior signal in a finance system-design round.

### Q14. Spot the domain bug in this pitch: "trades go into Kafka, a consumer updates a positions table, we dedupe on Kafka message id, and order the topic globally for consistency."

Three domain bugs stacked in one sentence.

**"Updates a positions table."** Position is **derived**, not stored truth. Directly updating a positions row means it will **drift** from the trade events (missed/double-applied trades) with no way to detect or rebuild. It should be a **fold over the trade log**, materialised as a disposable read model.

**"Dedupe on Kafka message id."** That's a **transport** id — it doesn't survive retries to new offsets, republishing, or replays. Redelivery of the same logical trade under a new message id **double-books**. Dedupe on the **source trade id** (business key).

**"Order the topic globally."** Global ordering **kills throughput** and isn't needed. Order is only required **within a portfolio**; partition by `portfolioId` so per-key order holds and portfolios process in parallel.

**The fix**: trade log as source of truth → partition by portfolio → idempotent consumer keyed on source trade id → fold into a rebuildable position read model → snapshot to bound replay.

**Engineer angle**: the pitch reaches for the right tools (Kafka, a consumer) but violates all four core invariants — derived state, business-key idempotency, per-key ordering, rebuildable-from-log.

### Q15. How do you demonstrate domain fluency in a fintech interview without overclaiming?

**Lead with the invariants, use the vocabulary precisely, and stay in the engineer's lane.** Concretely:

- **Open every design with the model**: "A trade is an immutable event, a position is a fold over trades, a balance is a point-in-time aggregate — so I'll store the trade log as truth and derive the rest." That one sentence signals more than any buzzword.
- **Use the false-friends correctly** — order vs execution vs fill vs trade, notional vs market value, clearing vs settlement. Precise words prove you've been near real systems.
- **Name the recurring tensions unprompted** — per-key ordering, business-key idempotency, as-of, never-float, CQRS.
- **Stay in your lane** — say "the risk engine / quant desk owns the Greeks and pricing maths; my job is to **store and serve** those numbers correctly with lineage." Overclaiming the maths is a tell; knowing the boundary is fluency.

**Engineer angle**: fluency is **recognising the domain patterns and mapping them to data**, not reciting derivatives math. The interviewer is checking you'll model money, trades, and positions correctly and know where the engineering ends and the quant begins.

### Q16. Give me the one-paragraph playbook you'd run for any finance-domain design prompt.

**Restate** the problem and who it's for (front/middle/back office). **State assumptions** — volume, latency, delivery semantics, consistency tolerance, source of truth. **Diagnose the invariants first**: name the **event** (trade/payment/price), the **derived state** (position/balance/NAV), the **idempotency key** (business id), the **ordering scope** (per portfolio/account), the **money representation** (exact, currency-attached), and the **as-of requirement** — before drawing a single box. **Design simple-first**: append-only event log as truth + an idempotent, per-key-ordered consumer + a materialised fold as the read model + snapshots to bound replay. **Then surface tradeoffs**: per-key vs global ordering, batch vs streaming (CQRS), tolerances in recon, storage profiles for reference vs market data, corrections as compensating events. **Close on the engineer angle**: the log is the source of truth, everything else is a rebuildable read model, money is never a float, and corrections never mutate history.

**Engineer angle**: every finance scenario is the same skeleton — **event → derived state → idempotency → ordering → as-of → exact money → audit** — assembled to fit the prompt. Master the skeleton and you can drive any of them; the specific system (positions, NAV, recon, ledger, security master) just re-weights which invariant leads.
