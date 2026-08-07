## How to survive a staged live-coding round

### Summary

**What this is**

A market-making firm's live round is not LeetCode. The interviewer starts you on one problem — build an
order book, parse a feed, aggregate a window — and every ~20 minutes bolts on a requirement that
**breaks the design you just wrote**. They are not testing whether you memorised a matching engine; they
are watching how you react when a new constraint invalidates your last decision. This primer is the
coach's-eye view of the mm-katas repo: the escalation arc of each kata, the design pivot each stage
forces, and what a strong versus weak answer sounds like. Use it to *review* — do the timed practice
in the repo first, then come here to see what the interviewer was really probing.

**The method**

- **Don't over-build Stage 1.** The single biggest failure mode is engineering Stage 1 for requirements
  that haven't been asked. Solve exactly what's on the table, but pick the data structure that *keeps its
  options open* (a `TreeMap` of FIFO levels, an injected clock, integer ticks) so the pivot is cheap.
- **Listen for the pivot.** When a requirement lands, say out loud what it breaks: "matching means
  `submit` stops being a store and becomes a loop"; "out-of-order events mean I can't evict from the
  head any more." Naming the break is half the score.
- **Test first, always.** You own the tests. Write the failing assertion for the new requirement before
  you touch the code — it's what the desk does and it stops you flailing.
- **Talk while you type.** The trade-off you *say* ("a single lock because matching is inherently
  sequential; the production answer is a lock-free ring feeding one matching thread") is worth more than
  the code.

**How the 90 minutes usually splits**

Four stages, roughly 20 / 20 / 25 / 25 minutes. Stage 1 is naive and single-threaded. Stages 2–3 add
domain reality (matching, partial data, out-of-order). Stage 4 is almost always **concurrency** — the
point where they find out whether you understand what actually needs to be atomic. Blowing the Stage 1
budget is the classic tell that you built for stages nobody asked for yet.

## Limit Order Book — the price-time matching core

### Summary

**What this kata drills**

The matching core of an exchange for one instrument: rest orders, cancel, report best quote, then match
crossing orders with price-time priority, then market orders and self-trade prevention, then make it
thread-safe. It is *the* market-making warm-up and the cleanest example of a Stage-1 design (a store)
being turned into something else (a matching loop) by the second requirement.

**The mental model**

A book is two sorted maps — bids high-to-low, asks low-to-high — each price level an FIFO queue. Best
quote is the first key. A trade consumes the front of the best opposite level at the *maker's* price.
Everything else (partial fills, market orders, STP, concurrency) is a small delta on that loop, *if* you
chose FIFO price levels in Stage 1.

**Prices are integer ticks**

Say this in the first minute: prices are `long` ticks, never `double` — float equality is a landmine in
a matching engine, and it signals you've built one before.

### The escalation (four stages)

- **Stage 1 (~20m):** `submit` rests, `cancel(id)` removes, `bestBid`/`bestAsk` report the top. Orders
  don't cross yet.
- **Stage 2 (~20m):** orders cross — `submit` matches and returns fills; the unmatched remainder rests.
- **Stage 3 (~25m):** market orders (no price, sweep, remainder discarded) and self-trade prevention
  (cancel-resting vs cancel-newest when an account would trade itself).
- **Stage 4 (~25m):** N venues submit concurrently — no over-fills, no lost fills, consistent best quote.

### The design pivot each stage forces

- **1 → 2:** `submit` stops being one line (`rest`) and becomes a loop that trades against the best
  opposite level while marketable, at the maker price, keeping a partially-filled maker at the front of
  its queue, and **removing drained levels** so the best quote never reports an empty level. The Stage-1
  data structure was already right — the pivot is behavioural. This is why committing to FIFO levels in
  Stage 1 pays off.
- **2 → 3:** two tiny hooks, not a rewrite. Market vs limit differ only in the *marketable* check (a
  market order always takes the best); the rest-remainder step runs only for limit. STP is a check at the
  head of the loop. A candidate who copy-pasted the loop for market orders pays here.
- **3 → 4:** recognise that **matching is inherently sequential** — the race is the multi-step
  read-modify-write inside the match, not any single field. Serialise the whole match/cancel with one
  lock; read the best quote under the same lock for a consistent snapshot. Conservation then falls out.

### Interviewer signals — strong vs weak

- **Strong:** `TreeMap<price, deque>` per side + id→node map from minute one; `long` ticks with a
  one-line justification; trades at the maker price; removes empty levels; `long` quantities (an `int`
  overflows a busy book); on Stage 4, names the production design — a lock-free MPSC ring feeding a
  single matching thread — and the trade-off vs a `ReentrantLock`.
- **Weak:** an `ArrayList` scanned for best/cancel; `double` prices; fills at the taker price; forgets to
  remove empty levels (phantom best); on Stage 4 sprinkles `synchronized`/`ConcurrentHashMap` per field
  and thinks a `ConcurrentSkipListMap` alone makes the multi-step match atomic (it doesn't).

### Common mistakes & senior signal

- Losing a partially-filled maker's queue position (must stay at the front, just with less quantity).
- Reporting an empty price level as the best quote after it drains.
- Re-sorting the whole book on every trade instead of consuming from the front.
- **Senior signal:** treats each stage as one small, well-named change to a loop they designed to be
  extended, and can articulate exactly what is and isn't atomic under concurrency — plus the lock-free
  single-writer design they'd reach for in production.

## Odds Feed Parser — streaming a line protocol under real-world mess

### Summary

**What this kata drills**

Parsing a `SEQ|BOOK|EVENT|MARKET|SELECTION|ODDS` feed, then everything that makes a *real* feed painful:
chunks that split a line mid-way, malformed lines that must not desync the stream, per-bookmaker sequence
numbers with gap and duplicate detection, and backpressure when the consumer can't keep up. It's the
"turn a toy parser into a production ingest" drill.

**The mental model**

Stage 1 is a pure function over a line. Every later stage adds **state**: a byte buffer for partial
lines, a per-book `expected-next-seq` map, a conflating buffer for backpressure. The pivot each time is
"this can no longer be stateless."

**Money on the line**

Odds go into a `BigDecimal`, never a `double` — you're pricing bets. And a malformed line is *reported*,
never thrown: one bad line must not kill the feed.

### The escalation (four stages)

- **Stage 1 (~20m):** parse whole lines, dispatch each `OddsUpdate`; report malformed lines.
- **Stage 2 (~20m):** input arrives in arbitrary chunks; a line can split across two chunks; handle
  CRLF/LF; a malformed line must not desync the ones after it.
- **Stage 3 (~25m):** per-bookmaker sequence numbers — detect gaps (report), drop duplicates/old,
  survive a restart.
- **Stage 4 (~25m):** the consumer is slow — add a bounded, **conflating** buffer that keeps only the
  latest odds per selection.

### The design pivot each stage forces

- **1 → 2:** the parser stops being stateless. You need a residual buffer: append the chunk, split off
  complete lines, keep the incomplete tail for next time. The trap is splitting on `\n` but forgetting
  the tail, or letting a malformed line consume the buffer.
- **2 → 3:** add per-key state — a `Map<book, expectedSeq>`. `received == expected` delivers;
  `> expected` is a gap (report, then resync forward); `<= last` is a duplicate (drop). `seq` is `long`.
  The nasty case is a **restart** (seq goes backwards) — treat it as old/duplicate, don't crash.
- **3 → 4:** backpressure for odds is **conflation**, not drop-oldest or block — only the latest price
  per selection matters. A `Map<selection, latestUpdate>` keeps memory bounded by distinct selections,
  not message count, and an older-seq update never overwrites a newer one.

### Interviewer signals — strong vs weak

- **Strong:** a clean residual-buffer state machine in Stage 2 that a split-at-the-delimiter test can't
  break; per-book state that reports a gap exactly once and is idempotent on duplicates; recognises
  conflation as the *domain-right* backpressure policy and keeps the latest-by-seq.
- **Weak:** re-parses the whole accumulated buffer each chunk; throws on a malformed line (killing the
  feed); a global seq counter instead of per-book; drop-oldest backpressure that discards the latest
  price.

### Common mistakes & senior signal

- Desyncing after a malformed or split line (the buffer is now wrong for everything after).
- Conflation that keeps the last *arrived* rather than the highest *seq*.
- Reporting a gap on every subsequent message instead of resyncing forward once.
- **Senior signal:** names the state each stage introduces before writing it, and picks conflation for
  backpressure because *stale odds are worthless* — a domain judgement, not a generic queue.

## Sliding Window Aggregator — rolling stats that survive out-of-order and scale

### Summary

**What this kata drills**

Rolling count/sum over the last N seconds, then a weighted average, then correctness when events arrive
**out of order** within a lateness bound, then **memory-bounded** aggregation under millions of events a
second. It's the purest example of a Stage-1 shortcut (evict from the head) being invalidated by a later
requirement (out-of-order arrival).

**The mental model**

The window is `(now - N, now]` evaluated against an **injected clock** at read time. Stage 1 you can get
away with a simple deque; Stage 3 you can't, because eviction is no longer "pop the front." Stage 4 you
stop storing events at all and store **per-bucket aggregates**.

**Inject the clock**

Take a `LongSupplier nowMillis` in the constructor — deterministic tests, no `Thread.sleep`, and it
signals you test time-based code properly.

### The escalation (four stages)

- **Stage 1 (~20m):** `add(ts, value)`, `count()`, `sum()` over the last N ms vs the clock.
- **Stage 2 (~20m):** `add(ts, value, weight)` and a `weightedAverage()` — empty when total weight is 0.
- **Stage 3 (~25m):** events may arrive out of order up to a lateness bound; accept if in-window, reject
  if too old.
- **Stage 4 (~25m):** millions/sec — you can't keep every event; aggregate into a bounded ring of buckets.

### The design pivot each stage forces

- **1 → 2:** minor — track two running sums (`sum(v*w)` and `sum(w)`), both decremented consistently on
  expiry; guard the divide-by-zero (empty `OptionalDouble`).
- **2 → 3:** the real pivot. Stage-1's "evict from the head as you add" **assumed monotonic timestamps**
  and now breaks — an out-of-order event doesn't belong at the head. You need a time-ordered structure
  (or a watermark) so an in-window late event is counted and an event past the trailing edge is rejected.
- **3 → 4:** stop storing events. Aggregate into fixed sub-interval **buckets** in a ring of
  `window/bucket (+ lateness/bucket)` slots — O(buckets) memory regardless of event rate. count()/sum()
  sum the live buckets; rotation happens as the clock advances.

### Interviewer signals — strong vs weak

- **Strong:** injects the clock in Stage 1; on Stage 3 immediately says "head-eviction assumed ordered
  arrival — that's the break" and moves to a ts-keyed / watermark design; on Stage 4 reaches for a bucket
  ring and can state the memory bound (buckets, not events) and the accuracy trade-off.
- **Weak:** reads `System.currentTimeMillis()` directly (untestable); keeps a raw list and rescans it for
  count/sum; on Stage 3 still pops the head and silently loses late events; on Stage 4 keeps every event
  and OOMs.

### Common mistakes & senior signal

- Boundary ambiguity — never defines whether the trailing edge is inclusive; pick one (`>`), test it.
- Floating-point equality in tests instead of `isCloseTo`.
- A weighted average that divides by zero on an empty window.
- **Senior signal:** recognises Stage 3 as a *data-structure* pivot (ordered arrival was a hidden
  assumption) and Stage 4 as a *representation* pivot (aggregate, don't store), and can quantify the
  memory bound and the granularity trade-off of bucketing.
