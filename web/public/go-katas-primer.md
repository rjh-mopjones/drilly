## How to Attack a Go Concurrency Kata

### Summary

**What this topic covers**

The method for turning an open-ended Go prompt — "many handlers read the latest price", "drain the server without losing in-flight jobs", "fan many venue feeds into one stream" — into correct, race-free, tested code under interview time pressure. These katas are framed as pieces of a low-latency sports-betting trading platform, and every one hides a specific concurrency trap: a data race on a shared map, a goroutine leak, a send-on-closed panic, a lost update, a dropped context. The skill being tested is not "do you know channels" but "can you reason about what happens when N goroutines hit this at once, and can you write the test that *proves* it". This topic is the loop every Go kata runs on: clarify the concurrency shape, design the smallest API and pick your synchronisation, **write the tests first — including a `-race` stress test** — then implement until green, and finally repeat under `-count` because one green run proves nothing.

**Mental model**

Go concurrency correctness comes down to one question asked at every shared value: **what establishes happens-before here?** A bare `map` read next to a concurrent write has no ordering edge — that's a data race, undefined behaviour, and `go test -race` will catch it. The fixes are a small menu, and choosing among them *is* the design: a `sync.Mutex`/`RWMutex` for shared mutable state (RWMutex only when reads truly don't mutate — an LRU "get" mutates recency, so a read-lock is wrong); a **channel** to pass ownership instead of sharing memory ("don't communicate by sharing memory; share memory by communicating"); `context.Context` to thread cancellation and deadlines to every downstream call; `sync/atomic` (or `atomic.Pointer`) for lock-free single values; a `sync.WaitGroup` to know when a set of goroutines is done so exactly one closer can close the channel. The second reflex is **lifecycle**: every goroutine you start needs a defined way to end — a closed channel, a cancelled context, or a finite loop — or it leaks. Design the exit before you write the `go`.

**Key terms**

- **Data race** — concurrent access to the same memory, ≥1 write, no synchronisation; undefined behaviour, caught by `-race`.
- **Happens-before** — the ordering edge (channel send/recv, mutex unlock/lock, WaitGroup) that makes one goroutine's writes visible to another.
- **Goroutine leak** — a goroutine with no exit path (blocked on a channel/ctx that never fires); memory + scheduler cost that climbs.
- **Ownership transfer** — passing a value over a channel so only one goroutine touches it at a time (share by communicating).
- **The closer rule** — the sender closes, exactly once; send-on-closed and double-close panic.
- **`context.Context`** — carries cancellation, deadline, and request scope down the call tree; check `ctx.Done()`.
- **RWMutex discipline** — read-lock only for genuinely read-only paths; if a "read" mutates state, it needs the write lock.
- **Backpressure** — a bounded (buffered) channel or `select`+`default` so a fast producer can't grow memory unbounded.
- **`-race` stress test** — many goroutines, mixed read/write, run under the detector and repeated with `-count`.
- **Invariant** — the post-run property (conservation, every item seen once, no leak) a race would break.

**Why interviewers ask this**

Go interviews for backend/low-latency roles are almost entirely about concurrency judgement, and open-ended katas expose it better than any quiz. A junior writes the happy path, runs it once, sees green, and declares victory — then the `-race` detector or a `-count=10` rerun finds the race they never tested for. A senior narrates the shared state up front ("this map is read by handlers and written by the feed, so it needs a lock or an atomic pointer"), designs the goroutine lifecycle ("workers exit on ctx-cancel *and* channel-close"), and — crucially — writes a stress test that *would fail* the naive version. Interviewers watch for that: do you reach for `-race`, do you reason about happens-before rather than "add a mutex and hope", do you know that one green run is not proof. Writing the failing race test first is the strongest signal you can give.

**Common confusions**

- "It ran fine, so it's correct" — races are probabilistic; a single green `-race` run isn't proof, repeat under `-count` and load.
- "RWMutex is always faster for read-heavy" — only if reads don't mutate; an LRU get mutates recency, so RLock corrupts the list.
- "Add a mutex to make it safe" — a lock held across a downstream/blocking call serialises everything and can deadlock; scope it tight.
- "Channels are always the answer" — a plain mutex-guarded struct is often simpler and faster than a channel dance; pick the tool.
- "The goroutine will just finish" — not if it's blocked on a channel or ctx that never fires; design the exit.

**What follows from this topic**

The next topic — Testing Concurrency in Go — is the toolkit this method depends on: `go test -race`, table-driven tests, the `Test*_RaceStress` pattern, goroutine-leak checks, and driving `context` deadlines deterministically. Then each kata is "apply the loop to one trap": `pricecache` (map race), `oddsfeed` (leak), `feedchannel`/`shutdown` (close discipline), `priceladder`/`ledger` (lost update), `settlement`/`settlepipeline` (context), `venuefanin` (fan-in close ordering), up to the bigger staged builds (`matchingengine`, `messagebus`, `cache`, `betgateway`).

### The first questions: find the shared state and the lifecycle

Before designing anything, locate the two things that cause every bug in these katas.

- **Shared state** — "What memory is touched by more than one goroutine? Who writes it, who reads it, how often?" That's your lock/atomic/channel decision. A map read by handlers and written by a feed is the canonical race.
- **Goroutine lifecycle** — "For every goroutine I start, how does it end?" Closed input channel, cancelled `ctx`, or a finite loop. No answer = a leak.
- **Who closes** — "Which single goroutine owns closing this channel?" The sender, once. Receivers never close.
- **Bounded or unbounded** — "If the consumer is slow, does memory grow?" Buffered channel / `select`+`default` gives backpressure.
- **Concurrency level** — "Is this called by one goroutine or many?" Decides whether you need synchronisation at all.

State these out loud; each answer becomes a test.

### Design the API and pick your synchronisation

Write the exported signatures first, and with them commit to *how* you'll synchronise — that choice is the heart of the design.

```go
type PriceCache struct {
    mu     sync.RWMutex          // reads >> writes, and a read is read-only
    prices map[string]float64
}
func (c *PriceCache) Get(id string) (float64, bool) { … }
func (c *PriceCache) Set(id string, px float64)     { … }
```

Menu: `Mutex`/`RWMutex` (shared struct) · channel (transfer ownership / serialise via a single-writer loop) · `context` (cancellation/deadline) · `atomic.Pointer` (lock-free single value) · `WaitGroup`+single-closer (fan-in). Prefer the simplest that removes the race.

### Write the tests first (including the race stress test)

Enumerate behaviours and write them as tests before the implementation:

1. **Contract** — single-goroutine happy path (set then get; enqueue then dequeue).
2. **Core behaviour** — the kata's real job (fan-in preserves all items; state machine rejects illegal transitions).
3. **Edges** — nil/closed channel, empty, `ctx` cancelled mid-flight, slow consumer.
4. **`-race` stress** — many goroutines, mixed read/write, assert an invariant (conservation / every item once / no leak). This is the one that catches the bug.

Then implement to green. See the next topic for the exact test shapes.

### Run the loop — and don't trust one green

```bash
cd practice && go test -race ./pricecache/      # the detector is the point
cd practice && go vet ./...                     # catches lock-copy, loop-var, printf
cd solution && go test -race -count=5 ./ledger/ # repeat to shake rare interleavings
```

A single `-race` pass proving green is **not** proof a concurrent design is correct — repeat under `-count` and vary load. That habit (and the stress tests that build it) is exactly what these katas train. State your final behaviour under contention out loud: no race, bounded memory, every goroutine exits.


## Testing Concurrency in Go (-race, table tests, stress)

### Summary

**What this topic covers**

The concrete Go testing tools that make "write the tests first" mechanical for concurrency katas, where the hard part is that a bug only appears sometimes. Three things trip people up: proving there's no **data race** (a normal test passes even when the code is racy — you need the `-race` detector), writing a **stress test** that actually forces the bad interleaving instead of getting lucky, and catching **goroutine leaks** and **deadlocks** that a green functional test hides. This topic gives you the vocabulary: `go test -race`, table-driven subtests with `t.Run`, the `Test*_RaceStress` high-contention pattern, goroutine-count leak checks with `t.Cleanup`, deterministic `context` deadlines, and the `-count`/`-short` habits. Master these and every kata's "Write the tests" step is just choosing which pattern the trap needs.

**Mental model**

Correctness tests and concurrency tests answer different questions. A **functional test** (arrange–act–assert, table-driven) proves *behaviour*: the state machine rejects an illegal transition, the fan-in returns every item. A **race/stress test** proves *safety under contention*: it launches many goroutines that hammer the same value with mixed reads and writes, then asserts an **invariant** that a race would break — conservation (a ledger's total never changes), uniqueness (every message delivered exactly once), or liveness (the drain finishes, no goroutine left blocked). The `-race` detector instruments memory access and flags any unsynchronised read/write it *observes* — so the stress test's job is to *exercise* the concurrent paths hard enough that the race actually happens. Because interleavings are probabilistic, you crank goroutine count and iterations, and rerun with `-count=N`; a design that's green once but red at `-count=10` was never correct. Leaks are caught by snapshotting `runtime.NumGoroutine()` before and after and asserting it returns to baseline; deadlocks by wrapping the operation in a timeout (`context` or a `select` with `time.After`) so a hang fails loudly instead of hanging the suite.

**Key terms**

- **`go test -race`** — the data-race detector; instruments memory, flags unsynchronised access it observes. The core tool.
- **Table-driven test** — `tests := []struct{…}` + `for _, tc := range` + `t.Run(tc.name, …)`; one function, many cases.
- **`Test*_RaceStress`** — the convention here: many goroutines, mixed read/write, run under `-race`, skipped by `-short`.
- **`-count=N`** — rerun the test N times to shake out rare interleavings; green once ≠ correct.
- **`-short` / `testing.Short()`** — skip the heavy stress tests for a fast CI pass.
- **Goroutine-leak check** — compare `runtime.NumGoroutine()` before/after (with a small settle), assert it returns to baseline.
- **`t.Cleanup`** — register teardown (cancel ctx, close, stop server) that runs even on failure.
- **Invariant assertion** — conservation / exactly-once / no-leak; the property a race breaks, not exact values.
- **Deterministic deadline** — pass a short `context.WithTimeout`; assert the op returns `ctx.Err()` rather than sleeping.
- **`sync.WaitGroup` start-gate** — release all workers together (or a closed channel as the gate) to maximise contention.
- **`httptest`** — `net/http/httptest` server/recorder for handler katas (betgateway).

**Why interviewers ask this**

Driving your own concurrency tests is where "I know Go" separates from "I can ship correct Go". Anyone writes the happy-path table test; the signal is whether you reach for `-race`, whether you can write a stress test that *would fail* the naive implementation, and whether you check for leaks and deadlocks rather than trusting a green run. A candidate who says "let me add a `_RaceStress` that runs 200 goroutines doing transfers and asserts the total is conserved, then run it under `-race -count=5`" demonstrates they understand *why* concurrent code is hard and *how* to gain real confidence. That's senior signal. A `time.Sleep` sprinkled to "fix" flakiness, or "it passed so it's fine", is the opposite.

**Common confusions**

- "The test passed, no race" — a normal run can't see races; you must use `-race`, and even then only if the path is exercised.
- "One `-race` pass = correct" — interleavings are probabilistic; repeat with `-count` and high goroutine counts.
- "`time.Sleep` to synchronise the test" — flaky and slow; use channels/WaitGroup/context to coordinate deterministically.
- "Assert exact output under concurrency" — order is nondeterministic; assert an invariant (count, sum, set), not a sequence.
- "Leaks don't matter in a test" — a leaked goroutine is a real bug; snapshot `NumGoroutine()` and assert it settles back.
- "`-race` slows CI, drop it" — run stress under `-short`-skip, but keep `-race` on; it's the whole point.

**What follows from this topic**

Every kata's "Write the tests" card is an instance of these patterns. Map/state katas (`pricecache`, `priceladder`, `betmachine`) use table tests + a race stress asserting conservation/legality. Lifecycle katas (`oddsfeed`, `shutdown`, `venuefanin`) add leak checks and drain assertions. Context katas (`settlement`, `settlepipeline`) drive deterministic deadlines. The HTTP kata (`betgateway`) uses `httptest`. When a kata shows a `_RaceStress`, come back here for the template.

### The two test shapes

Functional behaviour is table-driven; safety is a stress test. You almost always write both.

```go
func TestBetMachine_Transitions(t *testing.T) {
    tests := []struct {
        name    string
        from    State
        event   Event
        want    State
        wantErr bool
    }{
        {"place from new", New, Place, Placed, false},
        {"double settle rejected", Settled, Settle, Settled, true},
    }
    for _, tc := range tests {
        t.Run(tc.name, func(t *testing.T) {
            got, err := tc.from.Apply(tc.event)
            if (err != nil) != tc.wantErr { t.Fatalf("err=%v want %v", err, tc.wantErr) }
            if got != tc.want { t.Errorf("got %v want %v", got, tc.want) }
        })
    }
}
```

### The `-race` stress test (the one that catches the bug)

```go
func TestLedger_Transfer_RaceStress(t *testing.T) {
    if testing.Short() { t.Skip("stress") }
    l := NewLedger()
    l.Open("a", 1000); l.Open("b", 1000)
    const G, N = 64, 5000
    var wg sync.WaitGroup
    start := make(chan struct{})            // start-gate for max contention
    for g := 0; g < G; g++ {
        wg.Add(1)
        go func() {
            defer wg.Done()
            <-start
            for i := 0; i < N; i++ {
                l.Transfer("a", "b", 1)     // A→B and…
                l.Transfer("b", "a", 1)     // …B→A: total must be invariant
            }
        }()
    }
    close(start)
    wg.Wait()
    if got := l.Balance("a") + l.Balance("b"); got != 2000 {
        t.Fatalf("money not conserved: %d (lost update / bad lock order)", got)
    }
}
```

Run it as `go test -race -count=5 ./ledger/`. It fails an unsynchronised RMW; it passes a correctly-locked one every time. Assert the **invariant** (sum == 2000), never an exact interleaving.

### Leaks, deadlocks and deadlines

```go
// Leak check — goroutines return to baseline after Close.
func TestNoGoroutineLeak(t *testing.T) {
    base := runtime.NumGoroutine()
    f := NewFeed(); f.Start()
    f.Close()                               // must unblock every worker
    time.Sleep(20 * time.Millisecond)       // let them unwind
    if n := runtime.NumGoroutine(); n > base {
        t.Fatalf("leaked %d goroutines", n-base)
    }
}

// Deadline — cancellation must reach the downstream call.
ctx, cancel := context.WithTimeout(context.Background(), 10*time.Millisecond)
defer cancel()
err := Settle(ctx, bet)
if !errors.Is(err, context.DeadlineExceeded) { t.Fatalf("ctx not propagated: %v", err) }
```

- Wrap potentially-hanging ops in a timeout so a **deadlock fails the test** instead of hanging the suite.
- `t.Cleanup(cancel)` / `t.Cleanup(server.Close)` so teardown runs even on failure.
- For handlers, drive with `httptest.NewServer` + concurrent identical requests and assert the action ran exactly once.


## Price Cache — Data Race on a Bare Map

### Summary

**What this topic covers**

You build the read-mostly hot path of a betting platform: a `PriceCache` that one market-data feed goroutine writes (the latest two-sided quote per market) while dozens of HTTP handler goroutines read on every request. The API is tiny — `Set(market, Price)`, `Get(market) (Price, bool)`, `Snapshot() map[string]Price`. The whole kata is the trap: a bare `map[string]Price` shared across goroutines is a data race under Go's memory model, and a concurrent map read overlapping a map write is a *fatal* runtime error (`concurrent map read and map write`) that aborts the process — not a recoverable panic. Even without the map, the multi-word `Price` struct can tear. You fix both with a `sync.RWMutex`, and you prove the fix with `go test -race`. The extension makes the read path lock-free with copy-on-write over `atomic.Pointer`.

**Mental model**

Two distinct hazards hide in "a map shared by goroutines." First, the map itself: Go's runtime map is not safe for concurrent use, and the writer physically reshapes bucket memory during a `Set`, so a reader walking those buckets can crash the process. Second, *value tearing*: `Price{Bid, Ask, Seq}` is three words, and a struct copy is not atomic, so a read overlapping a write could splice the new `Bid` onto the old `Ask`/`Seq`. `Seq` exists precisely so a reader (and a test) can check that all fields came from one write. An `RWMutex` closes both: it establishes happens-before ordering so writes are fully published before any reader observes them, and it makes each `Get`/`Set` see the map and the struct as one indivisible unit. Because the workload is read-heavy, `RWMutex` lets readers run in parallel and only serialises on the rare write.

**Key terms**
- **data race** — two goroutines touch the same memory, at least one writing, with no synchronisation between them; undefined behaviour in Go.
- **`sync.RWMutex`** — many concurrent `RLock` holders *or* one `Lock` holder; the read-heavy default here.
- **`sync.Mutex`** — mutual exclusion, one holder; serialises readers too. Simpler, lower per-op overhead.
- **fatal error vs panic** — `concurrent map read and map write` is a runtime-level fatal error; `recover()` cannot catch it.
- **torn read / word tearing** — observing a multi-word value mid-update, fields from different writes.
- **happens-before** — the ordering guarantee (here from mutex lock/unlock) that makes one goroutine's writes visible to another.
- **`atomic.Pointer[T]`** — lock-free atomic load/store of a pointer; the copy-on-write extension's core.
- **copy-on-write (COW)** — writer clones the whole map, mutates the clone, atomically swaps it in; readers never block.
- **snapshot aliasing** — returning the internal map so callers touch it without the lock, reintroducing the race.
- **`-race`** — the race detector; instruments memory access to flag unsynchronised sharing at runtime.

**Why interviewers ask this**

It is the canonical Go concurrency screen and it separates levels cleanly. A junior reaches for a `map` and calls it done, or slaps a `Mutex` on and can't say why `RWMutex` might be better, or worse. A mid-level guards the map but returns the internal map from `Snapshot`, silently reintroducing the race one call away. A senior names *both* hazards (map crash and struct tearing) unprompted, justifies `RWMutex` over `Mutex` by the read:write skew *and* states its downside (higher per-op cost, write starvation under contention), returns a defensive copy from `Snapshot`, and — the real tell — insists on proving it with `go test -race -count=N` rather than eyeballing one green run. Bonus signal: knowing the lock-free COW alternative and its O(n)-write trade-off.

**Common confusions**
- "A `Mutex` fixes it, so `RWMutex` is overkill" → both are correct; `RWMutex` is the *right* default for read-heavy load because it parallelises readers, but it costs more per op.
- "The map crash is a panic I can `recover`" → it's a fatal error; the process dies.
- "`Snapshot` returning the map is fine, it's just a read" → the caller then iterates/mutates it lock-free — that's the race again.
- "One clean `-race` run proves correctness" → races are probabilistic; repeat under `-count` and vary load.

**What follows from this topic**

This is the foundation for every shared-state kata: the same RWMutex-vs-channel-vs-atomic decision recurs in the order book, the ledger, and the rate limiter. The lock-free COW extension leads into the atomics/`atomic.Pointer` family and lock-free reads. The `-race` stress-test habit you build here is the same tool you'll lean on for goroutine-leak and lost-update katas.

### Clarify & design the API

Before writing logic, pin the questions that change the design:

- **One writer or many?** The README says one feed writer, many readers — that justifies `RWMutex`. If writers were plentiful and hot, a sharded `Mutex` or plain `Mutex` might win. State the assumption.
- **Does `Snapshot` need a consistent point-in-time view?** Yes — callers own it and iterate it outside any lock, so it must be a copy taken atomically under the lock.
- **Is `Price` a value or pointer?** A small value struct — copied by assignment. That's what makes tearing possible and what the lock prevents.
- **Missing market?** Return the zero `Price` and `false`, mirroring the comma-ok map idiom.

Commit to the exact signatures first:

```go
type Price struct {
    Bid, Ask float64
    Seq      uint64 // monotonic; lets readers/tests detect torn reads
}

type PriceCache struct {
    mu     sync.RWMutex
    prices map[string]Price
}

func NewPriceCache() *PriceCache
func (c *PriceCache) Set(market string, p Price)
func (c *PriceCache) Get(market string) (Price, bool)
func (c *PriceCache) Snapshot() map[string]Price
```

The zero value is unusable (nil map) — force construction through `NewPriceCache`. Everything the caller can see is a value copy or a fresh map; the internal map never escapes.

### Write the tests

The practice package ships **no tests on purpose** — designing them is the exercise. Write them first, smallest contract outward, and finish with the `-race` stress test that actually exposes the bug. Run everything with `go test -race ./pricecache/`.

**Group 1 — basic contract (table-driven).** Set/Get round-trips, overwrite semantics, and the miss case:

```go
func TestGet(t *testing.T) {
    tests := []struct {
        name    string
        set     []struct{ mkt string; p Price }
        get     string
        want    Price
        wantOK  bool
    }{
        {"hit", []struct{ mkt string; p Price }{{"LIV-MUN", {1.95, 2.05, 1}}}, "LIV-MUN", Price{1.95, 2.05, 1}, true},
        {"miss", nil, "UNKNOWN", Price{}, false},
        {"overwrite",
            []struct{ mkt string; p Price }{{"ARS-CHE", {1.50, 1.60, 1}}, {"ARS-CHE", {1.55, 1.65, 2}}},
            "ARS-CHE", Price{1.55, 1.65, 2}, true},
    }
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            c := NewPriceCache()
            for _, s := range tt.set {
                c.Set(s.mkt, s.p)
            }
            got, ok := c.Get(tt.get)
            if ok != tt.wantOK || got != tt.want {
                t.Fatalf("Get(%q) = %+v, %v; want %+v, %v", tt.get, got, ok, tt.want, tt.wantOK)
            }
        })
    }
}
```

Why it matters: catches the ordinary bugs (wrong return on miss, no overwrite) with zero concurrency noise.

**Group 2 — the snapshot aliasing trap.** The subtle correctness bug. Mutate the returned map and assert the cache is untouched:

```go
func TestSnapshotIsACopy(t *testing.T) {
    c := NewPriceCache()
    c.Set("A", Price{1, 2, 1})
    c.Set("B", Price{3, 4, 1})

    snap := c.Snapshot()
    snap["A"] = Price{99, 99, 99} // mutate the caller's copy
    delete(snap, "B")
    snap["C"] = Price{5, 6, 1}

    if got, _ := c.Get("A"); got != (Price{1, 2, 1}) {
        t.Fatalf("cache A mutated via snapshot: %+v", got)
    }
    if _, ok := c.Get("B"); !ok {
        t.Fatalf("cache B deleted via snapshot")
    }
    if _, ok := c.Get("C"); ok {
        t.Fatalf("cache C inserted via snapshot")
    }
}
```

Why it matters: an implementation that returns the internal map passes every single-threaded test and still ships the race. Only this test catches it.

**Group 3 — the `-race` stress test (the heart).** Many writers, many readers, periodic `Snapshot`, gated to start together. Encode each `Price` self-consistently so a torn read is detectable even without the detector:

```go
func encode(v uint64) Price { return Price{float64(v), float64(v) + 0.5, v} }
func consistent(p Price) bool { return p.Bid == float64(p.Seq) && p.Ask == float64(p.Seq)+0.5 }

func TestPriceCache_RaceStress(t *testing.T) {
    if testing.Short() {
        t.Skip("race-stress: run without -short, ideally -race -count=N")
    }
    c := NewPriceCache()
    const markets, iters = 8, 20000
    procs := runtime.GOMAXPROCS(0)
    writers, readers := 4*procs, 4*procs
    if writers < 16 { writers = 16 }
    if readers < 16 { readers = 16 }

    mkt := func(i int) string { return fmt.Sprintf("MKT-%d", i%markets) }
    for i := 0; i < markets; i++ { c.Set(mkt(i), encode(uint64(i))) } // seed

    var wg sync.WaitGroup
    start := make(chan struct{})

    for w := 0; w < writers; w++ {
        wg.Add(1)
        go func(id int) {
            defer wg.Done()
            <-start
            for i := 0; i < iters; i++ {
                v := uint64(id)*uint64(iters) + uint64(i) + 1
                c.Set(mkt(id+i), encode(v))
            }
        }(w)
    }
    for r := 0; r < readers; r++ {
        wg.Add(1)
        go func(id int) {
            defer wg.Done()
            <-start
            for i := 0; i < iters; i++ {
                if p, ok := c.Get(mkt(id + i)); ok && !consistent(p) {
                    t.Errorf("torn Get: %+v", p)
                    return
                }
                if i%64 == 0 {
                    for _, p := range c.Snapshot() {
                        if !consistent(p) {
                            t.Errorf("torn Snapshot entry: %+v", p)
                            return
                        }
                    }
                }
            }
        }(r)
    }
    close(start)
    wg.Wait()
}
```

Why it matters: the `close(start)` gate releases every goroutine at once to maximise overlap. Against a naive bare-map version this either crashes with `concurrent map read and map write` or trips `-race`; the `consistent` check also catches struct tearing *without* the detector. **A single green `-race` run is not proof** — run `go test -race -count=20 ./pricecache/`, and vary `writers`/`readers`, because races are probabilistic.

### Implement it

Guard the map with an `RWMutex`; the synchronisation is deliberately boring:

```go
func NewPriceCache() *PriceCache {
    return &PriceCache{prices: make(map[string]Price)}
}

func (c *PriceCache) Set(market string, p Price) {
    c.mu.Lock()
    defer c.mu.Unlock()
    c.prices[market] = p
}

func (c *PriceCache) Get(market string) (Price, bool) {
    c.mu.RLock()
    defer c.mu.RUnlock()
    p, ok := c.prices[market]
    return p, ok
}

func (c *PriceCache) Snapshot() map[string]Price {
    c.mu.RLock()
    defer c.mu.RUnlock()
    out := make(map[string]Price, len(c.prices))
    for market, p := range c.prices {
        out[market] = p
    }
    return out
}
```

**Why RWMutex.** One writer, many readers: `RLock` lets every `Get`/`Snapshot` run concurrently and only blocks while a `Set` holds the write lock. A plain `Mutex` would queue readers behind each other even though concurrent reads are safe. The trade-off, which you should name: `RWMutex` has higher per-op overhead than `Mutex` and can starve or lose under heavy *write* contention — so a write-heavy or ultra-short-critical-section workload might prefer a `Mutex` or sharding. For a price feed, reads dominate; `RWMutex` is the right default.

**Happens-before.** The mutex is what makes it correct, not just crash-free: `Unlock` in `Set` happens-before the next `RLock` in `Get`, so a reader sees the *whole* `Price` the writer stored — no tearing — and the map's bucket mutations are fully published before any reader walks them.

**The `Snapshot` gotcha.** Copy under the read lock into a fresh map and return that. Returning `c.prices` directly would let the caller iterate or mutate it with no lock held, reintroducing the exact race the type exists to prevent. `Price` is a value, so the per-entry copy is deep enough — no aliasing survives.

**Extension (lock-free COW).** Replace the map+mutex with `atomic.Pointer[map[string]Price]`. `Set` clones the current map, inserts, and `Store`s the new pointer; `Get`/`Snapshot` do one `Load` and never block. Reads become wait-free; writes become O(n) plus an allocation, so it suits read-mostly data that changes infrequently. Benchmark it against the `RWMutex` version — that comparison is the payoff.

### Common mistakes & senior signal

The README's trap, plus the pitfalls interviewers watch for:

- **Bare map, no lock.** The headline bug: fatal `concurrent map read and map write`, and it's a fatal error `recover()` can't catch. Naming this unprompted is the entry ticket.
- **Guarding the map but leaking it via `Snapshot`.** Returning `c.prices` reintroduces the race one call away. A senior returns a copy and has a test (Group 2) that proves it.
- **`Mutex` without justifying it.** Correct but slower for this read-heavy load. Say *why* `RWMutex`, and say its downside (per-op cost, write starvation) — that even-handedness is the signal.
- **Forgetting struct tearing.** Many candidates fix the map crash and stop. Mention that the multi-word `Price` can tear too, and that `Seq` is the tool to detect it.
- **`defer` discipline.** `defer c.mu.Unlock()` / `RUnlock()` so an early return or panic never leaves the lock held and deadlocks every other goroutine.
- **Trusting one green `-race` run.** Races are probabilistic. The senior habit is `go test -race -count=N` with varied load — a single pass proves nothing about a concurrent design.


## Price Ladder — Lost Update on a Relative Adjust

### Summary

**What this topic covers**

A betting market has a current price, and a stream of feed goroutines apply *relative* odds adjustments to it — "shorten this market by 0.05", "drift it by 0.10" — all at once. You build a `Ladder` that tracks a price per market string and exposes `Adjust(market, delta)` (relative: `price += delta`, absent market starts from 0), `Set(market, price)` (absolute overwrite), and `Price(market) (float64, bool)`. The trap is that a relative `Adjust` is a **read-modify-write** (RMW): read the current price, add the delta, write it back. If that RMW is not one atomic critical section, concurrent adjusters read the same stale value and overwrite each other — a **lost update**. The final price comes out below the sum of all deltas, and in a real-money market a price that doesn't reflect every adjustment mis-prices risk. This is a correctness defect, not a cosmetic one.

**Mental model**

Picture two goroutines and one shared cell holding `2.00`. A reads `2.00`. B reads `2.00` before A has written. A adds `+0.10` and writes `2.10`. B adds `+0.05` to the `2.00` *it* read and writes `2.05`. A's update is gone: the answer is `2.05`, but every-delta-applied is `2.15`. The read and the write raced, and the later writer clobbered the earlier one. The fix is to make the whole read+add+write **indivisible** — one held lock spanning all three, so no other goroutine can observe or mutate the cell mid-sequence. The subtle, interview-grade point: locking is necessary but *not sufficient if scoped wrong*. A "get-then-set" assembled from two separately-locked operations (lock-read-unlock … lock-write-unlock) still loses updates, because another goroutine slips into the gap. The lock must cover the entire RMW as a single critical section.

**Key terms**
- **read-modify-write (RMW)** — read a value, compute a new one from it, write it back; must be atomic to be safe under contention.
- **lost update** — a write based on a stale read overwrites a concurrent write; the overwritten delta silently vanishes.
- **critical section** — the region a lock protects; here it must wrap read+add+write, not just each half.
- **sync.Mutex** — mutual-exclusion lock; `Lock`/`defer Unlock` gives one goroutine exclusive access.
- **happens-before** — Go's memory-model ordering; the mutex release *happens-before* the next acquire, making the previous write visible.
- **atomic.AddInt64** — a genuinely wait-free integer add; the basis of the lock-free tick extension.
- **atomic.Uint64 + CompareAndSwap** — the only lock-free float recipe: load bits, compute sum, CAS on `math.Float64bits`, retry.
- **fixed-point ticks** — money as an integer count of hundredths, so addition is an atomic primitive and float rounding disappears.
- **striped / sharded locks** — hash the market to one of N locks so different markets don't contend on a global lock.
- **gated start** — a `close(start)` barrier that releases all worker goroutines at once to maximise the race window.

**Why interviewers ask this**

It separates "I put a mutex on it" from "I understand *what* the mutex must protect." A junior locks each method and calls it thread-safe — but if they expose a `Get` and a `Set` and tell you to compose your own increment, they've reopened the race. A senior recognises the RMW, insists the lock spans the whole trio, and can explain *why* a two-lock get-then-set fails. They also know the ceiling: you can't `atomic.Add` a `float64` (no hardware atomic float add), so lock-free here means either a CAS loop on the bit pattern or — cleaner — integer ticks with `atomic.AddInt64`. And they write the test that actually fails on the bug: G goroutines × N `+1` adjustments, assert the final price is exactly `G*N`.

**Common confusions**
- "Every method is locked, so it's safe" → wrong if `Adjust` is built from a locked `Price` then a locked `Set`; the gap between them loses updates.
- "Use `atomic` for lock-free" → there is no atomic float add; you need a CAS loop on bits or an integer representation.
- "A single green `-race` run proves it" → the detector only flags races it *observed*; repeat under `-count=N` and vary load.
- "`RWMutex` would be faster" → `Adjust`/`Set` are writers, so RWMutex buys nothing on the hot path here; a plain `Mutex` is right.

**What follows from this topic**

The lost-update RMW pattern recurs anywhere a shared counter or accumulator is updated concurrently — ledger balances, position sizes, sequence numbers. The lock-free extension (integer ticks + `atomic.AddInt64`) is the gateway to the [[lockfree]] katas and the CAS-loop mindset. Striped locks generalise to any high-contention map (see [[cache]] and [[connectionpool]]). The gated-start stress harness is the same shape you'll reuse for every concurrency kata's `-race` test.

### Clarify & design the API

Questions worth asking before writing a line: Is `Adjust` relative or absolute? (Relative — that's what makes it an RMW.) Does an absent market start from 0 or error? (Start from 0.) Does `Price` distinguish "known and zero" from "unknown"? (Yes — hence the `bool`.) Do we need lock-free, or is a mutex acceptable? (Mutex first; ticks are the extension.) One `Ladder` shared across many goroutines, all four methods concurrent.

Commit to the exported surface first — the storage and synchronisation are yours to design behind it:

```go
type Ladder struct {
    mu     sync.Mutex
    prices map[string]float64
}

func NewLadder() *Ladder
func (l *Ladder) Adjust(market string, delta float64) // relative: price += delta
func (l *Ladder) Set(market string, price float64)    // absolute overwrite
func (l *Ladder) Price(market string) (float64, bool)  // 0,false on miss
```

The zero value is unusable (nil map); construct via `NewLadder`. A single `Mutex` over a `map[string]float64` is the simplest correct design — reach for striping only when a benchmark shows contention.

### Write the tests

Test-first, and the point is to write the test that *fails on the bug you're worried about* before you write the fix. Start with the contract, then the lost-update stress test.

Contract tests (table-driven where it helps):

```go
func TestAdjustAccumulates(t *testing.T) {
    l := NewLadder()
    l.Adjust("MKT-1", 2.00)
    l.Adjust("MKT-1", -0.05)
    l.Adjust("MKT-1", 0.10)
    got, ok := l.Price("MKT-1")
    if !ok || got != 2.05 {
        t.Fatalf("Price(MKT-1) = %v, %v; want 2.05, true", got, ok)
    }
}

func TestAdjustAbsentStartsFromZero(t *testing.T) {
    l := NewLadder()
    l.Adjust("MKT-2", 1.50)
    if got, ok := l.Price("MKT-2"); !ok || got != 1.50 {
        t.Fatalf("Price(MKT-2) = %v, %v; want 1.50, true", got, ok)
    }
}

func TestSetOverrides(t *testing.T) {
    l := NewLadder()
    l.Adjust("MKT-3", 3.00)
    l.Set("MKT-3", 1.80)
    if got, _ := l.Price("MKT-3"); got != 1.80 {
        t.Fatalf("Price(MKT-3) = %v; want 1.80", got)
    }
}

func TestPriceMissingMarket(t *testing.T) {
    l := NewLadder()
    if got, ok := l.Price("UNKNOWN"); ok || got != 0 {
        t.Fatalf("Price(UNKNOWN) = %v, %v; want 0, false", got, ok)
    }
}
```

The lost-update probe is the one that matters — it's what a green run *without* proper locking cannot pass. G goroutines each apply N `+1` adjustments to one market behind a gated start; assert the final price is exactly `G*N`. Integer deltas (`1.0`) keep the expected sum exact in `float64`, so any shortfall is a genuine lost update, not rounding noise:

```go
func TestConcurrentAdjust_NoLostUpdates(t *testing.T) {
    const (
        goroutines = 16
        perGoro    = 10000
        market     = "HOT-MARKET"
    )
    l := NewLadder()

    var wg sync.WaitGroup
    start := make(chan struct{}) // gate: release all workers together

    for g := 0; g < goroutines; g++ {
        wg.Add(1)
        go func() {
            defer wg.Done()
            <-start
            for i := 0; i < perGoro; i++ {
                l.Adjust(market, 1.0)
            }
        }()
    }
    close(start)
    wg.Wait()

    got, ok := l.Price(market)
    if want := float64(goroutines * perGoro); !ok || got != want {
        t.Fatalf("lost updates: Price(%s) = %v, want %v", market, got, want)
    }
}
```

The full `-race` stress test adds *mixed* traffic so the detector interleaves every method. Keep one "ADJUST-ONLY" market touched solely by `+1` adjusters (its final price must equal the adjustment count — the conservation invariant), while other goroutines fire `Adjust`/`Set`/`Price` on separate markets to shake out any race the detector can see:

```go
func TestPriceLadder_RaceStress(t *testing.T) {
    if testing.Short() {
        t.Skip("race-stress: run without -short, ideally -race -count=N")
    }
    l := NewLadder()
    const (
        adjustOnly = "ADJUST-ONLY"
        mixed      = 8
        iters      = 20000
    )
    procs := runtime.GOMAXPROCS(0)
    adjusters := max(4*procs, 16)
    mixers := max(2*procs, 8)

    var wg sync.WaitGroup
    start := make(chan struct{})

    for a := 0; a < adjusters; a++ {
        wg.Add(1)
        go func() {
            defer wg.Done()
            <-start
            for i := 0; i < iters; i++ {
                l.Adjust(adjustOnly, 1.0) // conservation probe
            }
        }()
    }
    for x := 0; x < mixers; x++ {
        wg.Add(1)
        go func(id int) {
            defer wg.Done()
            <-start
            for i := 0; i < iters; i++ {
                name := fmt.Sprintf("MIX-%d", (id+i)%mixed)
                switch i % 3 {
                case 0:
                    l.Adjust(name, 0.5)
                case 1:
                    l.Set(name, float64(i))
                default:
                    _, _ = l.Price(name)
                }
            }
        }(x)
    }
    close(start)
    wg.Wait()

    got, ok := l.Price(adjustOnly)
    if want := float64(adjusters * iters); !ok || got != want {
        t.Fatalf("lost updates: Price(%s) = %v, want %v", adjustOnly, got, want)
    }
}
```

Why each group matters: the contract tests pin behaviour; the lost-update probe catches a mis-scoped lock even without `-race` (the *value* is wrong); the stress test lets the race detector observe unsynchronised access on the mixed markets and asserts conservation on the adjust-only market. Run it as `go test -race -count=5 ./priceladder/` — one green pass is not proof; repeat and vary load.

### Implement it

The simplest correct design is a single `sync.Mutex` over a `map[string]float64`, with `Adjust` doing the read, add, and write inside *one* held lock:

```go
func (l *Ladder) Adjust(market string, delta float64) {
    l.mu.Lock()
    defer l.mu.Unlock()
    l.prices[market] += delta // read + add + write, all under one lock
}

func (l *Ladder) Set(market string, price float64) {
    l.mu.Lock()
    defer l.mu.Unlock()
    l.prices[market] = price
}

func (l *Ladder) Price(market string) (float64, bool) {
    l.mu.Lock()
    defer l.mu.Unlock()
    p, ok := l.prices[market]
    return p, ok
}
```

`l.prices[market] += delta` compiles to a load, an add, and a store — but because it sits inside the held lock, no other goroutine can interleave. The happens-before reasoning: `Unlock` on one goroutine happens-before the next goroutine's `Lock`, so each `Adjust` sees the fully-written result of the previous one. That's what makes every delta land exactly once. Complexity is O(1) amortised per call; the only allocation is map growth. A plain `Mutex` (not `RWMutex`) is right because all three methods mutate or must serialise against mutation — there's no read-heavy path that would benefit from shared read locks.

The key gotcha is the one the kata is built around: **do not** implement `Adjust` as `p,_ := l.Price(m); l.Set(m, p+delta)`. Both halves are locked, yet the lost-update race is fully back — a goroutine slips between the `Price` and the `Set`. The lock must span the whole RMW.

Extension — lock-free hot path via integer ticks: represent money as `int64` hundredths and store `*atomic.Int64` per market, so `Adjust` becomes a single wait-free `counter.Add(deltaTicks)` with no lock and no CAS loop, also sidestepping float rounding. (The float-only lock-free recipe is a CAS loop on `atomic.Uint64` over `math.Float64bits` — correct but fiddly, and it still spins under contention.) Benchmark it against the mutex version before adopting it; the mutex is fast enough until a profile says otherwise.

### Common mistakes & senior signal

The README's central trap: a lock scoped to each half of the RMW instead of the whole thing. Get-then-set from two separately-locked calls **still loses updates**. The senior move is to hold one lock across read+add+write and to be able to explain *why* the two-lock version fails.

Other pitfalls and the senior response:
- **Reaching for `atomic` on a `float64`** — there's no atomic float add. Senior names the two real options (CAS loop on bits, or integer ticks) and picks ticks for the wait-free path.
- **`RWMutex` reflex** — writers dominate here, so a read-write lock adds overhead for no gain. Senior uses a plain `Mutex`.
- **Trusting one green `-race` run** — the detector only reports races it *happened* to observe. Senior runs `-race -count=N`, varies goroutine counts, and uses a gated start (`close(start)`) to widen the race window.
- **Asserting an approximate final price** — senior uses integer deltas so `G*N` is exact in `float64`; any shortfall is unambiguously a lost update, and the test conserves the total.
- **Global lock on all markets** — fine to start, but the senior knows striped/sharded locks (hash the market to one of N mutexes) remove cross-market contention when a benchmark demands it.


## Odds Feed Consumer — The Goroutine Leak

### Summary

**What this topic covers**

You are handed a live odds feed as a `<-chan Message` and told to fan it out across a fixed pool of worker goroutines, each running a handler on every message. Throughput is the easy part; the whole kata is the *lifecycle*. Eventually the caller gives up — the producer stops and closes the channel, or the context is cancelled (timeout, request abandoned, process shutting down). Every worker must notice and exit, and `Run` must block until they have all actually exited before returning. The trap is the classic Go goroutine leak: a worker parked forever on a receive from a channel that will never be fed or closed. You build `NewConsumer(workers, handler)` and `Run(ctx, in) error`, and you write the tests that *prove* no goroutine survives `Run` returning.

**Mental model**

A worker cannot loop on a bare receive. `for m := range in` exits only when `in` is closed; a hand-rolled `for { m := <-in; ... }` exits on nothing at all. Either one leaks the instant the producer stalls without closing. The fix is a `select` on **two** arms at once: `<-ctx.Done()` (caller cancelled — the arm the naive loop forgets) and `m, ok := <-in` with the closed-channel `ok` check (producer finished — the arm `for range` gives you for free but the manual loop drops). Only with both does every worker have a guaranteed exit on *every* shutdown path. Then join the pool with a `sync.WaitGroup`: `Run` calls `wg.Wait()` before returning, so it is synchronous — when it returns, the pool is provably gone and no handler is still in flight. A `Run` that returned early would itself be the leak.

**Key terms**

- **goroutine leak** — a goroutine that never exits, pinning its stack, closed-over variables, and the feed connection/buffers behind it. Invisible to error handling: nothing errors, it is simply parked.
- **`for range` over a channel** — loops until the channel is closed, then exits. Gives you the closed-channel exit but never the cancellation exit.
- **comma-ok receive** — `m, ok := <-in`; `ok` is `false` once the channel is closed and drained, yielding zero values forever. The signal to return.
- **`ctx.Done()`** — a channel closed when the context is cancelled; the cancellation arm of the select.
- **`select`** — blocks until one of its ready arms fires, letting a worker wait on *both* a receive and cancellation simultaneously.
- **`sync.WaitGroup`** — `Add(n)` / `defer Done()` / `Wait()`; the join that makes `Run` block until every worker has exited.
- **`ctx.Err()`** — `context.Canceled` after cancel, `nil` otherwise; `Run`'s return value distinguishes the two shutdown paths.
- **`runtime.NumGoroutine()`** — live goroutine count; the instrument the leak test polls back to baseline.
- **fire-and-join boundary** — a function that spawns goroutines *and* waits for them, so no goroutine outlives the call.
- **semaphore channel** — a buffered `chan struct{}` acquired before and released after work, to bound in-flight handlers (the extension).

**Why interviewers ask this**

Goroutine leaks are the single most common Go production bug, and they are silent — a service that leaks a goroutine per request looks healthy until memory and file descriptors climb over hours. A junior writes `for m := range in { h(m) }`, sees the tests pass, and calls it done; they never consider the channel that stalls without closing. A senior immediately asks "who closes `in`, and what if nobody does?", reaches for `select` on `ctx.Done()` plus a comma-ok receive, and — critically — knows how to *prove* the absence of a leak with a goroutine-count assertion under `-race -count`. The signal is whether you treat "it works" and "it provably has no leak and no race" as the same claim. They are not.

**Common confusions**

- *"`for range` handles shutdown."* Only end-of-stream shutdown. A never-closed channel leaves the worker parked forever — you still need the `ctx.Done()` arm.
- *"A single green `-race` run means the design is correct."* Race detection is probabilistic; it only flags races on interleavings that actually occurred. Repeat under `-count=N` with real contention.
- *"`Run` returning means the workers stopped."* Only if `Run` joins them. Without `wg.Wait()`, `Run` returns while workers keep running — the leak wearing a disguise.
- *"Cancelling the context closes the input channel."* It does not. Cancellation and channel-close are two independent signals; that is exactly why you select on both.

**What follows from this topic**

This is the foundation for every graceful-shutdown kata: the `select { case <-ctx.Done() }` plus WaitGroup-join pattern reappears in fan-in aggregators, pipeline stages, and pub/sub bus consumers. The extension — a semaphore channel to bound in-flight work, plus a graceful *drain* that stops accepting new messages but lets in-flight handlers finish — leads directly into backpressure and pipeline-shutdown problems.

### Clarify & design the API

Questions worth asking before writing a line: *Who closes `in` — is a never-closing channel a real case?* (Yes — that is the whole kata.) *Should `Run` block until workers exit, or return immediately?* (Block — it is the guarantee the caller needs.) *What does `Run` return on each path?* (`ctx.Err()` on cancel, `nil` on close.) *Does the handler need the context?* (Yes — a slow handler should observe cancellation too.)

Commit to a tiny surface before touching concurrency:

```go
type Message struct {
	Market  string
	Payload string
}

// Handler gets the Consumer's ctx so a long handler can observe cancellation.
type Handler func(context.Context, Message)

type Consumer struct {
	workers int
	handler Handler
}

func NewConsumer(workers int, h Handler) *Consumer {
	return &Consumer{workers: workers, handler: h}
}

// Run fans out the pool, processes in, and BLOCKS until every worker exits.
// Returns ctx.Err() if cancelled, nil if in was closed.
func (c *Consumer) Run(ctx context.Context, in <-chan Message) error
```

Note the channel direction: `in <-chan Message` — the consumer only receives, so it can never accidentally close a channel it does not own. Whoever produces owns the close. `Run` is the fire-and-join boundary; the goroutines it spawns must not outlive it.

### Write the tests

This is the heart of the kata — the practice version ships **no tests on purpose**. Write them first, and make at least one of them fail if a worker leaks. Four groups, in order of ambition.

**1. Contract: process everything, then return nil.** Feed N messages, close, assert the handler ran N times and `Run` returned `nil`.

```go
func TestRun_ProcessesAllThenNil(t *testing.T) {
	const n = 1000
	var processed atomic.Int64
	c := NewConsumer(8, func(_ context.Context, _ Message) { processed.Add(1) })

	in := make(chan Message)
	go func() {
		for i := 0; i < n; i++ {
			in <- Message{Market: "match-1", Payload: "odds"}
		}
		close(in)
	}()

	if err := c.Run(context.Background(), in); err != nil {
		t.Fatalf("Run = %v, want nil", err)
	}
	if got := processed.Load(); got != n {
		t.Fatalf("handled %d, want %d", got, n)
	}
}
```

**2. Cancellation stops a stalled feed — the leak-catcher.** This is the test the naive loop fails. A channel that is never fed and never closed: the only exit is `ctx.Done()`. Record the baseline goroutine count, cancel, assert `Run` returns `context.Canceled`, then poll the count back to baseline. Without the `ctx.Done()` arm, all 8 workers stay parked and the count never drops.

```go
// Poll NumGoroutine down to want; bounded retry only lets the scheduler
// reap already-returning goroutines — it does not synchronise the logic.
func waitForGoroutines(want int) int {
	got := runtime.NumGoroutine()
	for i := 0; i < 100 && got > want; i++ {
		runtime.Gosched()
		time.Sleep(time.Millisecond)
		got = runtime.NumGoroutine()
	}
	return got
}

func TestRun_CancelStopsWorkers(t *testing.T) {
	baseline := runtime.NumGoroutine()
	c := NewConsumer(8, func(_ context.Context, _ Message) {})

	in := make(chan Message) // never fed, never closed
	ctx, cancel := context.WithCancel(context.Background())
	errCh := make(chan error, 1)
	go func() { errCh <- c.Run(ctx, in) }()

	cancel()
	if err := <-errCh; err != context.Canceled {
		t.Fatalf("Run = %v, want context.Canceled", err)
	}
	if got := waitForGoroutines(baseline); got > baseline {
		t.Fatalf("workers did not exit: got %d, want <= %d", got, baseline)
	}
}
```

**3. Both exit paths, repeatedly — no leak.** Cycle close-path and cancel-path runs several times and assert the count returns to baseline at the end. This catches a worker that leaks on *only one* of the two paths.

**4. The `-race` stress test — mandatory for a concurrency kata.** Many producers fill a buffered channel drained by many workers; run *both* shutdown paths under high contention. On the drain path assert the handler fired exactly once per message (no lost work, no double-handling); on both paths assert no goroutine leak. Then run it under `go test -race -count=20 ./oddsfeed/`. A single green `-race` run is *not* proof — repeat with `-count` so the detector sees many interleavings.

```go
func TestConsumer_RaceStress(t *testing.T) {
	if testing.Short() {
		t.Skip("run without -short, ideally -race -count=N")
	}
	baseline := waitForGoroutines(runtime.NumGoroutine())

	procs := runtime.GOMAXPROCS(0)
	workers, producers := 4*procs, 4*procs
	const perProducer = 5000

	runDrain := func() {
		var processed atomic.Int64
		c := NewConsumer(workers, func(_ context.Context, _ Message) { processed.Add(1) })
		in := make(chan Message, 1024)

		var pwg sync.WaitGroup
		for p := 0; p < producers; p++ {
			pwg.Add(1)
			go func() {
				defer pwg.Done()
				for i := 0; i < perProducer; i++ {
					in <- Message{Market: "m", Payload: "p"}
				}
			}()
		}
		go func() { pwg.Wait(); close(in) }()

		if err := c.Run(context.Background(), in); err != nil {
			t.Fatalf("Run (drain) = %v, want nil", err)
		}
		if want := int64(producers * perProducer); processed.Load() != want {
			t.Fatalf("handled %d, want %d", processed.Load(), want)
		}
		if got := waitForGoroutines(baseline); got > baseline {
			t.Fatalf("drain leaked: got %d, want <= %d", got, baseline)
		}
	}
	// runCancel: producers select on <-ctx.Done() vs in<-msg on a never-closed
	// channel; cancel(), assert Run returns context.Canceled, pwg.Wait(),
	// then poll back to baseline.

	for i := 0; i < 3; i++ {
		runDrain() /* ; runCancel() */
	}
}
```

Each group buys something distinct: group 1 proves correctness, group 2 proves the cancellation exit exists, group 3 proves neither path leaks over repetition, group 4 proves it under real races and load.

### Implement it

The synchronisation choice is deliberately *not* a mutex — there is no shared mutable state to guard. It is channels plus context plus a WaitGroup. Each worker selects on both exit conditions; `Run` joins with the WaitGroup and reports which path fired via `ctx.Err()`.

```go
func (c *Consumer) Run(ctx context.Context, in <-chan Message) error {
	var wg sync.WaitGroup
	wg.Add(c.workers)
	for i := 0; i < c.workers; i++ {
		go func() {
			defer wg.Done()
			for {
				select {
				case <-ctx.Done():
					return
				case m, ok := <-in:
					if !ok {
						return
					}
					c.handler(ctx, m)
				}
			}
		}()
	}
	wg.Wait()
	return ctx.Err()
}
```

Why it is leak-free: every worker's `for` loop has exactly two ways out, and both fire on a real shutdown signal. `wg.Add(c.workers)` happens before any `go`, so `Wait()` cannot race ahead of the spawns. `defer wg.Done()` guarantees the count decrements even if the handler panics. The happens-before reasoning: `wg.Wait()` returns only after all `Done()` calls, which each follow a `return`, which follows the goroutine ceasing to touch anything — so when `Run` returns, no worker is observably alive. `ctx.Err()` read after `Wait()` is safe: on the close path the context was never cancelled so it is `nil`; on the cancel path `Done()` was closed so `Err()` is `context.Canceled`. Complexity is O(messages) work, O(workers) goroutines, zero allocation in the steady loop.

Gotcha to name aloud: if both arms are ready simultaneously (cancelled *and* a message waiting), `select` picks pseudo-randomly, so a cancelled consumer may process a few more messages before exiting. That is acceptable — the guarantee is *bounded* exit, not *instant* exit. If you needed hard cancellation you would re-check `ctx.Err()` before calling the handler.

### Common mistakes & senior signal

The trap, stated plainly: **the naive worker loops on a bare receive and leaks the moment the producer stalls without closing.** `for m := range in` covers only end-of-stream; `for { m := <-in }` covers nothing. Both leave the worker parked forever, pinning its stack and the live feed connection behind the handler. Under load the process accumulates thousands of parked goroutines and nothing ever errors.

Pitfalls and the senior fix for each:

- **One exit condition instead of two.** Select on *both* `<-ctx.Done()` and `m, ok := <-in`. Cancellation without the close check spins on zero values; close-check without cancellation leaks a stalled feed.
- **Forgetting the comma-ok check.** A closed channel yields zero-value messages forever — without `if !ok { return }` the worker busy-loops handling empty messages.
- **`Run` that returns before workers drain.** Join with `sync.WaitGroup` and `wg.Wait()` before returning. An early return is a leak wearing the disguise of a clean shutdown.
- **Closing `in` from the consumer.** The consumer only receives (`<-chan`); the producer owns the close. Closing a channel you receive from, or double-closing, panics.
- **`wg.Add` inside the goroutine.** Always `Add` before the `go`, or `Wait` can return before the goroutine even starts.
- **Trusting a single green `-race` run.** Senior habit: `go test -race -count=20`, vary load, and assert `runtime.NumGoroutine()` returns to baseline. Race detection sees only the interleavings that happened; make many happen.


## Feed Channel Broker — Send-on-Closed, Nil-Channel, Backpressure

### Summary

**What this topic covers**

You build the fan-out broker at the heart of a market-data service: many publisher goroutines push price `Update`s, a single subscriber consumes them by ranging over a receive channel, and the whole thing must shut down cleanly without ever panicking or hanging. This is the canonical Go channel-discipline exercise — the happy path is trivial, and the entire difficulty lives in the edges. The trap is a send-on-closed-channel panic: once `close(updates)` runs, a concurrent `updates <- u` from a still-live publisher panics the process. You defend with close-once discipline (a `sync.Once` closes a separate `done` channel and the `updates` channel exactly once), a `select` that lets a blocked publisher surface backpressure as `ctx.Err()`, and — the part everyone misses — a mutex that makes the close actually safe.

**Mental model**

Three classic channel bugs converge here. (1) **Send on a closed channel panics** — `close` is a one-way, irreversible broadcast; a later send explodes. (2) **A nil channel blocks forever** — the zero-value `Broker` has nil channels, so its methods hang silently; you force construction via `NewBroker`. (3) **A full channel applies backpressure** — a naive `ch <- v` blocks indefinitely if the subscriber stalls, so you bound the buffer and wrap the send in a `select` on `ctx.Done()`. The subtle bit: closing `done` first is *necessary but not sufficient* to prevent the panic. A `select` with several ready cases picks one uniformly at random, so a publisher parked on its send arm does not deterministically wake on `done`. What actually makes close safe is an `RWMutex`: `Publish` holds `RLock` across its check-and-send; `Close` takes `Lock` before `close(updates)`. The write lock can't be granted while any read lock is held, so no send can be in flight when the channel closes. The mutex is the linearisation point.

**Key terms**

- **send-on-closed panic** — `ch <- v` after `close(ch)` panics `"send on closed channel"`; unrecoverable in normal flow.
- **close-once / only the sender closes** — closing is a sender-side responsibility done exactly once; guard with `sync.Once`.
- **`sync.Once`** — runs its function body exactly once even under concurrent `Do` calls; makes `Close` idempotent.
- **nil channel** — send/receive on a `nil` channel blocks forever; also used deliberately to disable a `select` case.
- **bounded buffer** — `make(chan T, n)`; the backpressure window — publishers proceed while < n in flight, then block.
- **backpressure** — a full buffer blocks the sender, coupling publisher rate to the slowest consumer.
- **`select` with `ctx.Done()`** — races the send against context cancel so a blocked publisher returns `ctx.Err()` instead of hanging.
- **`RWMutex` as linearisation point** — `RLock` on send, `Lock` on close; serialises close *after* all in-flight sends.
- **`for range ch`** — the subscriber loop; terminates cleanly when the channel is closed.
- **happens-before** — closing `updates` under `Lock` happens-after every `Publish` that held `RLock` released it.
- **blocking vs dropping** — block (bounded by ctx) for completeness, or add a `default:` arm to drop for latency.

**Why interviewers ask this**

Channels look easy and are a minefield, so this kata separates people who have *used* goroutines from people who have *debugged* them in production. A junior wires up `close(ch)` and a `for range`, runs it once green, and declares victory. A senior immediately asks who owns the close, points out that closing `done` alone still races the send arm because `select` is random, and reaches for a mutex or a state guard to serialise close against live sends. They know the zero value is a trap, that `time.Sleep` is not synchronisation, and that one clean `-race` run proves nothing — you rerun under `-count`. The signal is whether you can reason about *interleavings you can't see*, not whether the demo works.

**Common confusions**

- "Closing `done` first prevents the panic." No — `select` chooses randomly; the send arm can still fire the instant `close(updates)` runs. The mutex is what orders it.
- "The subscriber should close the channel when it's done." No — only the sender side closes, exactly once; a receiver closing it makes every publisher a landmine.
- "Cancelling the context loses the buffered update." No — a cancelled `Publish` under backpressure returns `ctx.Err()` and the already-buffered updates are untouched.
- "A `nil` channel errors." No — it blocks forever, silently. That is why the zero value is unusable and why nil-ing a case disables it in `select`.

**What follows from this topic**

This is the channel counterpart to the mutex-based Price Cache race and the WaitGroup-based Graceful Shutdown kata — same "serialise the teardown" instinct, different primitive. The extension turns it into a true fan-out broker with multiple subscribers, each with its own drop-vs-block slow-consumer policy, which forces the per-subscriber registry and the `default:` dropping arm you deferred here.

### Clarify & design the API

Questions to pin down before writing logic: **How many subscribers?** (one here — a single `range` consumer; multi-subscriber is the extension.) **Block or drop under backpressure?** (block, bounded by context — a price feed *could* justify dropping stale ticks, so name the trade-off out loud.) **Who closes, and is `Close` idempotent?** (only the broker, exactly once, safe to call repeatedly and concurrently with `Publish`.) **Buffered or unbuffered?** (caller-chosen buffer; `0` is a valid unbuffered rendezvous.)

Commit to the surface first — the signatures are the contract your tests bind to:

```go
type Update struct {
    Market string
    Price  float64
}

var ErrClosed = errors.New("feedchannel: broker closed")

func NewBroker(buffer int) *Broker
func (b *Broker) Publish(ctx context.Context, u Update) error
func (b *Broker) Updates() <-chan Update // receive-only: subscriber can't close it
func (b *Broker) Close()                 // idempotent
```

Note the deliberate choices: `Updates()` returns a **receive-only** `<-chan Update` so the subscriber physically cannot close the channel (the "only the sender closes" rule, enforced by the type system). `Publish` takes a `context.Context` so backpressure is caller-cancellable. `NewBroker` is mandatory because the zero-value `Broker` has nil channels that would hang forever.

### Write the tests

This kata ships **no tests on purpose** — designing them is the exercise. Write them first, smallest contract outward to the `-race` stress test. Run everything with `go test -race ./feedchannel/`.

**Group 1 — basic contract (delivery in order).** Proves the happy path before you trust anything else.

```go
func TestPublish_DeliversInOrder(t *testing.T) {
    b := NewBroker(8)
    want := []Update{{"AAPL", 100.5}, {"GOOG", 200.25}, {"MSFT", 300.75}}
    for _, u := range want {
        if err := b.Publish(context.Background(), u); err != nil {
            t.Fatalf("Publish(%v): %v", u, err)
        }
    }
    for i, w := range want {
        if got := <-b.Updates(); got != w {
            t.Fatalf("update %d: got %v, want %v", i, got, w)
        }
    }
}
```

**Group 2 — closed-broker edges.** `Publish` after `Close` must return `ErrClosed` (never panic), and double-`Close` must not panic. These catch the send-on-closed bug and the missing `sync.Once`.

```go
func TestPublish_AfterClose_ReturnsErrClosed(t *testing.T) {
    b := NewBroker(4)
    b.Close()
    if err := b.Publish(context.Background(), Update{"AAPL", 1}); !errors.Is(err, ErrClosed) {
        t.Fatalf("got %v, want ErrClosed", err)
    }
}

func TestClose_Idempotent(t *testing.T) {
    b := NewBroker(2)
    b.Close()
    b.Close() // must not panic
}
```

**Group 3 — backpressure surfaces as ctx.Err, without data loss.** Fill the single buffer slot, then publish with an already-cancelled context: the blocked send must lose the `select` to `ctx.Done()`, and the buffered update must still be there.

```go
func TestPublish_BlocksThenCancelled(t *testing.T) {
    b := NewBroker(1)
    b.Publish(context.Background(), Update{"AAPL", 1}) // fills the slot
    ctx, cancel := context.WithCancel(context.Background())
    cancel()
    if err := b.Publish(ctx, Update{"AAPL", 2}); !errors.Is(err, context.Canceled) {
        t.Fatalf("got %v, want context.Canceled", err)
    }
    if got := <-b.Updates(); got != (Update{"AAPL", 1}) { // no data loss
        t.Fatalf("buffered update: got %v", got)
    }
}
```

**Group 4 — Close terminates the range.** A subscriber ranging `Updates()` in a goroutine must have its loop exit when `Close` runs — otherwise the subscriber leaks.

```go
func TestClose_TerminatesRange(t *testing.T) {
    b := NewBroker(4)
    b.Publish(context.Background(), Update{"AAPL", 1})
    done := make(chan int)
    go func() {
        n := 0
        for range b.Updates() { n++ }
        done <- n // only reached once the channel is closed
    }()
    b.Close()
    <-done // blocks until range exits, proving Close terminates it
}
```

**Group 5 — the `-race` stress test (the one that matters).** Many publishers (some cancelling their own contexts to hit the `ctx.Done()` arm), one draining subscriber, and a `Close` racing all of them. This is the only test that reliably surfaces the send-on-closed panic, the double-close, and the goroutine leak. A single green run is not proof — run `go test -race -count=20 -run RaceStress ./feedchannel/`.

```go
func TestBroker_RaceStress(t *testing.T) {
    if testing.Short() { t.Skip("run under -race -count=N") }
    baseline := runtime.NumGoroutine()
    const publishers, iterations = 48, 400

    b := NewBroker(16)
    var received atomic.Int64
    subDone := make(chan struct{})
    go func() {
        defer close(subDone)
        for range b.Updates() { received.Add(1) }
    }()

    start := make(chan struct{})
    var wg sync.WaitGroup
    var unexpected atomic.Int64
    wg.Add(publishers)
    for p := 0; p < publishers; p++ {
        go func() {
            defer wg.Done()
            <-start
            for i := 0; i < iterations; i++ {
                ctx := context.Background()
                if i%5 == 0 { // exercise the ctx.Done() arm under contention
                    c, cancel := context.WithCancel(ctx); cancel(); ctx = c
                }
                switch err := b.Publish(ctx, Update{"AAPL", float64(i)}); {
                case err == nil, errors.Is(err, ErrClosed), errors.Is(err, context.Canceled):
                default:
                    unexpected.Add(1)
                }
            }
        }()
    }

    closer := make(chan struct{})
    go func() {
        defer close(closer)
        <-start
        for i := 0; i < 50; i++ { runtime.Gosched() } // let traffic flow first
        b.Close(); b.Close() // idempotent under concurrency
    }()

    close(start)
    wg.Wait(); <-closer; <-subDone

    if n := unexpected.Load(); n != 0 {
        t.Fatalf("%d unexpected errors (want only nil/ErrClosed/ctx)", n)
    }
    if err := b.Publish(context.Background(), Update{"MSFT", 1}); !errors.Is(err, ErrClosed) {
        t.Fatalf("Publish after Close: got %v, want ErrClosed", err)
    }
    // goroutine-leak check: subscriber + publishers must all have returned.
}
```

The stress test's shutdown sequence — `wg.Wait()`, then `<-closer`, then `<-subDone` — is deliberate: only once every `Publish` has returned and `Close` has run should the subscriber's `range` terminate. Assert `runtime.NumGoroutine()` has dropped back to baseline (with a bounded poll, since the scheduler reaps lazily) to catch a leaked subscriber.

### Implement it

The synchronisation is two channels plus a `sync.Once` plus an `RWMutex`, and the `RWMutex` is the non-obvious load-bearing piece.

```go
type Broker struct {
    updates   chan Update
    done      chan struct{}
    mu        sync.RWMutex
    closeOnce sync.Once
}

func NewBroker(buffer int) *Broker {
    return &Broker{
        updates: make(chan Update, buffer),
        done:    make(chan struct{}),
    }
}

func (b *Broker) Publish(ctx context.Context, u Update) error {
    b.mu.RLock()
    defer b.mu.RUnlock()

    select { // fast path: already closed → don't enter the send select
    case <-b.done:
        return ErrClosed
    default:
    }

    select {
    case <-b.done:
        return ErrClosed
    case <-ctx.Done():
        return ctx.Err()
    case b.updates <- u:
        return nil
    }
}

func (b *Broker) Updates() <-chan Update { return b.updates }

func (b *Broker) Close() {
    b.closeOnce.Do(func() {
        close(b.done) // wake every blocked Publish first
        b.mu.Lock()
        close(b.updates) // safe: no Publish can hold RLock now
        b.mu.Unlock()
    })
}
```

**Why the `RWMutex` and not just `done`?** Closing `done` is a broadcast that wakes blocked publishers, but a `select` with multiple ready cases picks *at random* — a publisher parked on `b.updates <- u` is not guaranteed to wake on the `done` arm, so if a buffer slot frees up at the same instant `Close` runs, the runtime can pick the send exactly as `close(updates)` executes, and panic. The mutex removes the race: `Publish` holds `RLock` across its entire check-and-send, and `Close` must acquire the exclusive `Lock` before `close(updates)`. The write lock cannot be granted while any read lock is held, so `close(updates)` provably happens-after every in-flight send completes. That's the happens-before edge that makes it correct. **Close ordering matters:** close `done` *first* (outside the write lock) so blocked publishers start draining toward `ErrClosed`, then take `Lock` and close `updates`. Cost: an `RLock`/`RUnlock` pair per `Publish` — cheap, uncontended reader-side, and zero allocation on the hot path.

### Common mistakes & senior signal

- **The trap: closing `done` is *not enough*.** The most common wrong answer closes a `done` channel and assumes the send arm can't fire — but `select` is random, so the send-on-closed panic still happens intermittently. Only serialising close against sends (mutex, or an atomic state flag checked under the same lock) actually fixes it. A senior names this immediately.
- **Letting the subscriber close the channel.** Returning a bidirectional `chan Update` invites the receiver to `close` it, making every publisher a send-on-closed landmine. Return `<-chan Update` and keep close ownership on the sender.
- **Forgetting `sync.Once`.** A second `Close` (or a `Close` racing a `Close`) double-closes and panics. `closeOnce.Do` makes idempotency free.
- **Using the zero value.** `var b Broker` has nil channels; `Publish`/`Updates` hang forever with no error. Force `NewBroker`. (Senior aside: nil-ing a channel to disable a `select` case is the same property used deliberately.)
- **`time.Sleep` as synchronisation.** Sleeps to "let goroutines finish" are flaky and forbidden here — coordinate with channels, `WaitGroup`, and `sync.Once`.
- **Trusting one green `-race` run.** Concurrency bugs are probabilistic; the panic surfaces maybe 1 run in 30. The senior habit is `go test -race -count=20` (or higher) and varying load, plus a goroutine-leak assertion against a baseline. One pass proves nothing.


## Bet State Machine — Guarded, Idempotent Transitions Under Duplicate Events

### Summary

**What this topic covers**

You build a bet-lifecycle state machine that stays correct when events are *duplicated* and arrive *concurrently*. A bet flows `Pending → Accepted → Settled`, with `Reject`/`Cancel` as alternate terminal exits. Each transition stands in for a money-moving side effect: `Settle` pays out winnings, `Reject` releases the stake, `Cancel` voids and refunds. Events ride an at-least-once transport, so the broker *will* redeliver the same `Settle`, and two events for one bet can race. The trap is not the transition table — it is that the guard (is this transition legal?) and the write (move to the target state) must be one atomic critical section. Split them and you get a time-of-check-to-time-of-use (TOCTOU) double payout. You expose that bug with a `-race` stress test *before* you write the lock.

**Mental model**

Two concurrent `Settle` events land on the same `Accepted` bet. Each reads "Accepted", each independently concludes "Settle is legal from Accepted", and each writes "Settled" and fires the payout — two payouts, though every call looked correct in isolation. That is TOCTOU: the check and the set were separated by a window another goroutine slipped through. The fix is to hold one mutex across *both* the validation and the state write, so the read-decide-write is indivisible. Only one goroutine can observe the bet in a settleable (`Accepted`) state; every other concurrent or duplicate `Settle` observes the already-`Settled` state and short-circuits to an idempotent no-op. The lock collapses "check" and "set" into a single step — that atomicity, not the table, is what prevents the double fire. Idempotency is then a data rule layered on top: an event whose *target* state equals the bet's current state is a benign redelivery, return success without re-running the side effect.

**Key terms**
- **at-least-once delivery** — the transport may redeliver any event, so duplicates are the normal case, not an edge case.
- **TOCTOU** — time-of-check-to-time-of-use: a race where state changes between validating it and acting on it.
- **critical section** — the region under the lock where check-and-set is one indivisible step.
- **`sync.Mutex`** — the exclusion primitive; a plain `Mutex` (not `RWMutex`) because every `Apply` writes.
- **transition table** — `allowed[event][state]bool`: the legal source states for each event; terminal states appear in none.
- **target map** — `target[event]State`: the state each event moves a bet *into*; also the key to recognising idempotent redelivery.
- **idempotent no-op** — re-applying the event that produced the current state returns `(current, nil)` without firing the side effect.
- **terminal state** — `Settled`/`Rejected`/`Cancelled`: no event moves a bet out of one.
- **illegal transition** — an event not permitted from the current state; returns `ErrIllegalTransition`, state unchanged.
- **happens-before** — the guarantee that lock acquisition sees all writes made before the prior release.

**Why interviewers ask this**

It separates people who "know channels" from people who reason about *correctness under concurrency*. A junior writes `Get(); if legal { Set() }` with a mutex around each call and thinks it is safe — it typechecks, passes single-threaded tests, and even survives a lucky `-race` run. A senior sees the TOCTOU immediately, puts the whole read-modify-write under one lock, and — critically — writes the test that *forces* the double fire to appear: many goroutines, gated start, assert the real transition fired exactly once, under `-race -count`. The signal is: do you understand that a passing `-race` run once proves nothing, that guarding each *operation* is not the same as guarding the *invariant*, and that idempotency (dedup) and legality (the table) are two distinct rules you must not conflate.

**Common confusions**
- *"A mutex on each method makes it safe."* No — atomic `State()` and atomic `Apply()` still let two goroutines interleave a check and a set. You must guard the whole read-modify-write, not each accessor.
- *"Duplicate Settle should error."* No — under at-least-once delivery a redelivered `Settle` on a `Settled` bet is a no-op *success*, not a failure. Only a *different* event against a terminal state is illegal.
- *"`-race` passed, it's correct."* One green run is not proof; race detection is probabilistic. Repeat under `-count=N` and vary load.

**What follows from this topic**

The idempotency here is *inferred* from the target state, which breaks if an intervening event moves the bet. The extension makes it *explicit*: attach a unique idempotency key (the broker's message id) per event and record processed keys, so a redelivered `Settle` is deduped by identity even after the state moved. Pair that with an append-only event log — persist every applied event, derive state by replay — and you get an audit trail, crash recovery, and deterministic rebuilds. The single-lock discipline connects to the other katas where check-and-act must be atomic (idempotency, cache, ledger).

### Clarify & design the API

Questions worth asking before you write a line: *Is one machine shared across goroutines?* (yes — that is the whole point). *What does a duplicate mean — same event, or same message id?* (this version infers dedup from the target state; the key-based version is the extension). *Do terminal states accept anything?* (only the idempotent redelivery of the event that produced them). *Does an illegal transition mutate state?* (never — leave it untouched).

Commit to a small surface. The enums, constants, and error vars are given; you design the storage, the table, and the synchronisation:

```go
type State int   // Pending, Accepted, Settled, Rejected, Cancelled
type Event int   // Accept, Settle, Reject, Cancel

var ErrUnknownBet = errors.New("betmachine: unknown bet")
var ErrIllegalTransition = errors.New("betmachine: illegal transition")

func NewBetMachine() *BetMachine
func (m *BetMachine) Open(betID string) error            // Pending; dup Open is an error
func (m *BetMachine) Apply(betID string, e Event) (State, error)
func (m *BetMachine) State(betID string) (State, bool)
```

`Apply` returns the state *after* the call so both the real transition and the no-op return `(Settled, nil)` — the caller can't distinguish them, which is exactly right for dedup, but means your *test* has to observe the transition edge itself (see below). Model the table as data, not a `switch`: `allowed[Event]map[State]bool` for legal sources and `target[Event]State` for the destination. Storage is a single `map[string]State` behind one `sync.Mutex`.

### Write the tests

This is the heart of the kata — the practice side ships **no** tests on purpose. Write them first; they define "correct" and the stress test is what turns an invisible TOCTOU into a red bar. Start with the transition table, one row per (state, event) outcome, driven table-style:

```go
func TestTransitions(t *testing.T) {
    tests := []struct {
        name    string
        prep    []Event // events applied before the one under test
        ev      Event
        want    State
        wantErr error
    }{
        {"accept from pending", nil, EventAccept, StateAccepted, nil},
        {"settle from accepted", []Event{EventAccept}, EventSettle, StateSettled, nil},
        {"reject from pending", nil, EventReject, StateRejected, nil},
        {"cancel from pending", nil, EventCancel, StateCancelled, nil},
        {"cancel from accepted", []Event{EventAccept}, EventCancel, StateCancelled, nil},
        // illegal
        {"settle while pending", nil, EventSettle, StatePending, ErrIllegalTransition},
        {"accept after cancel", []Event{EventCancel}, EventAccept, StateCancelled, ErrIllegalTransition},
        {"accept after settled", []Event{EventAccept, EventSettle}, EventAccept, StateSettled, ErrIllegalTransition},
        // idempotent no-op
        {"resettle a settled bet", []Event{EventAccept, EventSettle}, EventSettle, StateSettled, nil},
    }
    for _, tc := range tests {
        t.Run(tc.name, func(t *testing.T) {
            m := NewBetMachine()
            _ = m.Open("b1")
            for _, e := range tc.prep {
                _, _ = m.Apply("b1", e)
            }
            got, err := m.Apply("b1", tc.ev)
            if got != tc.want || !errors.Is(err, tc.wantErr) {
                t.Fatalf("Apply(%v) = (%v, %v), want (%v, %v)", tc.ev, got, err, tc.want, tc.wantErr)
            }
        })
    }
}
```

That table catches every legality/idempotency rule *and* proves illegal transitions leave state unchanged (the `want` is the *unchanged* state). Add edges the table doesn't cover: `Apply` on an unknown bet → `ErrUnknownBet`; a second `Open` on a progressed bet → error, and the progressed state must survive the failed `Open`.

Then the group that matters — proving the side effect fires **exactly once** despite duplicates. First single-threaded (fire five `Settle`s, count real edges = 1), then the `-race` stress test:

```go
func TestConcurrentDuplicateSettle_FiresOnce(t *testing.T) {
    m := NewBetMachine()
    _ = m.Open("b1")
    _, _ = m.Apply("b1", EventAccept)

    const G = 64
    var wg sync.WaitGroup
    start := make(chan struct{})
    var obs sync.Mutex // makes the test's (read-before, Apply) pair atomic
    realTransit := 0

    for i := 0; i < G; i++ {
        wg.Add(1)
        go func() {
            defer wg.Done()
            <-start // gated start: maximise contention
            obs.Lock()
            before, _ := m.State("b1")
            got, err := m.Apply("b1", EventSettle)
            if before != StateSettled && got == StateSettled && err == nil {
                realTransit++ // this Apply performed the real payout edge
            }
            obs.Unlock()
            if err != nil || got != StateSettled {
                t.Errorf("concurrent Settle = (%v, %v), want (Settled, nil)", got, err)
            }
        }()
    }
    close(start)
    wg.Wait()

    if realTransit != 1 {
        t.Fatalf("real Accepted->Settled transitions = %d, want exactly 1", realTransit)
    }
}
```

Key ideas: the **gated start** (`<-start`, then `close(start)`) releases all 64 goroutines at once to force the interleaving. Because `Apply` returns `(Settled, nil)` for *both* the real transition and the no-op, the test counts the transition *edge* by reading state immediately before `Apply` — and `obs` makes that read+apply pair atomic so a late duplicate can't be miscounted. `obs` guards the *test's bookkeeping*, not the machine; the machine must guard itself. Scale it up into `TestBetMachine_RaceStress`: dozens of settle-race bets each hit by `4*GOMAXPROCS` settlers, plus a mixed workload of goroutines opening disjoint ids and firing varied (some illegal, some duplicate) event streams — assert no panic and every bet ends in a legal state. Run it with `go test -race ./betmachine/` and, because one green run proves nothing, `go test -race -count=20 ./betmachine/`.

### Implement it

One `sync.Mutex` guarding one `map[string]State`. Not `RWMutex` — every `Apply` is a potential write and the critical section is tiny, so read-lock complexity buys nothing. `Apply` does the whole read-decide-write under the lock:

```go
func (m *BetMachine) Apply(betID string, e Event) (State, error) {
    m.mu.Lock()
    defer m.mu.Unlock()

    cur, ok := m.bets[betID]
    if !ok {
        return StatePending, ErrUnknownBet
    }
    if target[e] == cur { // idempotent redelivery: side effect already ran
        return cur, nil
    }
    if allowed[e][cur] { // legal real transition; indivisible because we hold the lock
        next := target[e]
        m.bets[betID] = next
        return next, nil
    }
    return cur, ErrIllegalTransition // illegal: state unchanged
}
```

The ordering is deliberate: the idempotent-no-op check comes *before* the legality check, so a redelivered `Settle` on a `Settled` bet returns success (its target equals the current state) rather than falling through to `ErrIllegalTransition`. A *different* event on a terminal state — `Accept` on `Settled` — has a target (`Accepted`) that does not equal `Settled` and no `allowed` entry, so it correctly returns illegal. `Open` also takes the lock and rejects a duplicate id so a replayed `Open` can't reset a progressed bet. Happens-before: because both the check and the set sit inside one lock acquisition, no goroutine can observe the bet mid-decision — acquiring the lock sees every write made before the previous holder released it. Complexity is O(1) per call, one map lookup and at most one write, zero allocation on the hot path (the tables are package-level).

### Common mistakes & senior signal

The headline trap is **splitting the guard from the write**. `s, _ := m.State(id); if legal(s) { m.set(id, next) }` — even with a mutex *inside* `State` and `set` — is TOCTOU: two `Settle`s both read `Accepted` in the gap and both fire. The payout happens twice. A senior guards the *invariant* (only one goroutine settles), not each *operation*, by holding the lock across the whole read-modify-write.

Other pitfalls: **conflating dedup with rejection** — a redelivered `Settle` is a no-op *success*, not an error; only a *different* event on a terminal state is illegal. **Mutating on illegal input** — an illegal transition must leave state exactly as it was, or a stray replayed `Accept` after `Cancel` corrupts the machine and honours a bet the customer pulled. **Trusting one `-race` pass** — race detection is sampling; the senior habit is `-race -count=N` with a gated-start, high-contention test that deliberately maximises the interleaving. **Reaching for `RWMutex`** to look sophisticated when every path writes. The senior move is the boring one done exactly right: one lock, check-and-set inside it, idempotency as a data rule checked before legality, and a stress test that would go red if any of that were wrong.


## Venue Fan-In — Merge Many Feeds, No Drop, No Dup

### Summary

**What this topic covers**

You subscribe to several venue feeds — NYSE, LSE, TSE — each delivered as its own `<-chan Quote`, and downstream wants a single merged stream. You build `FanIn(ctx, bufferSize, sources...) <-chan Quote`: the classic Go fan-in. One forwarding goroutine per source copies every quote it receives onto a shared output channel; a `sync.WaitGroup` counts the forwarders; and a single dedicated closer goroutine does `wg.Wait()` then `close(out)`. The trap is getting three things right at the *same time*: every quote appears **exactly once** (no drop, no dup), memory stays **bounded** by `bufferSize` (backpressure, not unbounded spooling), and the whole thing **terminates cleanly** — output closes when all sources drain OR ctx is cancelled — with no leaked goroutine and no panic on a double close.

**Mental model**

Fan-in is N producers, one consumer, one output channel. The synchronisation question is: *who closes the output, and when?* A channel must be closed exactly once, and only by a sender, and only after the last send. No single forwarder can own the close — if it closed when its own source drained, quotes still queued in the *other* forwarders would hit a send-on-closed panic, and if two forwarders both closed, the second panics. So you separate the two concerns: forwarders only forward-and-`Done()`; a **separate** closer goroutine blocks on `wg.Wait()` (which returns only after the last forwarder exits, so every value it would send has been sent) and then closes exactly once. `wg.Wait()` is the happens-before edge that guarantees the close comes after all sends. That is the "WaitGroup-then-close" idiom, and it's the reusable shape of every correct fan-in.

**Key terms**

- **fan-in** — merging multiple input channels onto one output channel.
- **forwarder goroutine** — one per source; receives every value once, forwards it once.
- **`sync.WaitGroup`** — counts live forwarders; `wg.Wait()` blocks until all `Done()`.
- **closer goroutine** — the single owner of `close(out)`; runs after `wg.Wait()`.
- **buffered channel** — `make(chan Quote, bufferSize)`; the bounded in-flight window.
- **backpressure** — a full buffer blocks senders, propagating slowness back to producers so memory stays bounded.
- **load-shed** — the alternative: a `default:` arm drops on a full buffer (liveness over completeness).
- **send-on-closed panic** — closing while a forwarder is still sending; the classic fan-in bug.
- **goroutine leak** — a forwarder parked forever on `out <- q` after the consumer left.
- **`select` on `ctx.Done()`** — races the receive AND the send so nothing parks after cancel.
- **happens-before** — `wg.Wait()` returning is ordered after every `wg.Done()`, hence after every send.

**Why interviewers ask this**

Fan-in is the single most common Go concurrency pattern in production (log aggregation, feed merging, scatter-gather), so it separates people who've *written* concurrent Go from people who've read about channels. A junior writes the forwarders, then reaches for `close(out)` inside a forwarder or after the `for` loop and ships a send-on-closed panic — or "fixes" a slow consumer by spooling overflow into a slice and creates an OOM. A senior reaches for WaitGroup-then-close reflexively, selects `ctx.Done()` on *both* the receive and the send (the send side is the one people forget), knows the buffer is deliberate backpressure not an accident, and — the real tell — writes a `-race -count` stress test with a multiset assertion because they don't trust one green run.

**Common confusions**

- "Close the output when the loop ends" → *which* loop? Each forwarder has its own; closing on any one drops the others' in-flight quotes.
- "A bigger buffer fixes a slow consumer" → no; it just delays the block. An *unbounded* buffer doesn't remove backpressure, it hides it until OOM.
- "Selecting `ctx.Done()` on the receive is enough" → a full buffer with a departed consumer parks the *send*; you must select on both.
- "One green `-race` run proves it" → concurrency bugs are probabilistic; repeat under `-count=N` with varied load.

**What follows from this topic**

Fan-in pairs with fan-out (one source, N workers) and the two compose into scatter-gather pipelines. The termination idiom here — WaitGroup-then-close, single owner — recurs in every graceful-shutdown kata. The backpressure-vs-load-shed trade-off leads directly into the latest-wins coalescing extension (shed intermediate ticks, never serve a stale price) and into rate-limiting and bounded-queue designs.

### Clarify & design the API

Questions worth asking before writing a line: *Do sources close when drained, or run forever?* (Determines whether ctx cancel is the only way to stop.) *Is the output buffered — what's the bound?* (It's the backpressure window; commit to it.) *Who ranges the output, and can they abandon it?* (If yes, ctx cancel must unblock a full-buffer send.) *No drop, no dup — hard guarantee or best-effort?* (Fan-in gives exactly-once; load-shed doesn't.)

Commit to the signature first, then fill in logic:

```go
type Quote struct {
	Venue  string
	Market string
	Price  float64
}

// FanIn merges sources onto one bounded output channel and returns the
// receive-only output. Closes when all sources drain OR ctx is cancelled.
func FanIn(ctx context.Context, bufferSize int, sources ...<-chan Quote) <-chan Quote
```

Design commitments: receive-only return type (`<-chan`) so the consumer can't send or close; **buffered** output (`bufferSize` is the whole backpressure story); one forwarder per source; a single closer. With zero sources the output must close immediately — `wg.Add(0)`, `wg.Wait()` returns at once, closer closes. Concurrent by construction: N forwarders + 1 closer share one `out`, all coordinated by the WaitGroup.

### Write the tests

This is the heart — the practice side ships no tests on purpose. Write them first; they define the spec. Four groups, escalating.

**1. Merge contract — no drop, no dup.** Feed `k` quotes from each of several venues through a deliberately *small* buffer (forces real backpressure during the merge), collect into a multiset, assert every `(venue, price)` appears exactly once.

```go
func TestFanIn_MergesAllSourcesNoDropNoDup(t *testing.T) {
	const k = 500
	venues := []string{"NYSE", "LSE", "TSE"}
	sources := make([]<-chan Quote, len(venues))
	for i, v := range venues {
		ch := make(chan Quote)
		sources[i] = ch
		go func(v string, ch chan<- Quote) {
			for j := 0; j < k; j++ {
				ch <- Quote{Venue: v, Market: "AAPL", Price: float64(j)}
			}
			close(ch)
		}(v, ch)
	}
	out := FanIn(context.Background(), 4, sources...) // buffer 4 << 3*k

	got := make(map[Quote]int)
	total := 0
	for q := range out { // terminates only if the closer closes out
		got[q]++
		total++
	}
	if want := len(venues) * k; total != want {
		t.Fatalf("total: got %d, want %d", total, want)
	}
	for _, v := range venues {
		for j := 0; j < k; j++ {
			if c := got[Quote{v, "AAPL", float64(j)}]; c != 1 {
				t.Fatalf("quote appeared %d times, want 1", c)
			}
		}
	}
}
```

The multiset (a `map[Quote]int` with an exact `==1` check) is what catches both failure modes at once: count 0 is a drop, count >1 is a dup. `range out` completing is itself the proof the output closed.

**2. Closes when all sources close.** Each source sends one quote then closes; assert `range out` terminates and the count matches. This isolates the "all drained → close" termination path from cancellation.

**3. Cancel stops it — no leak.** Sources that emit *forever* and never close, so only ctx can stop `FanIn`. Snapshot `runtime.NumGoroutine()` as a baseline, drain a few to prove it's live, `cancel()`, drain the rest until `range out` ends, then poll goroutines back down to baseline:

```go
func TestFanIn_CancelStops(t *testing.T) {
	baseline := runtime.NumGoroutine()
	ctx, cancel := context.WithCancel(context.Background())
	producerDone := make(chan struct{})
	// ... 3 sources that select { case ch <- q: case <-producerDone: return }
	out := FanIn(ctx, 2, sources...)
	for i := 0; i < 10; i++ { <-out } // prove live
	cancel()
	for range out {} // must close once forwarders see cancel
	close(producerDone)
	if got := waitForGoroutines(baseline); got > baseline {
		t.Fatalf("leak: baseline %d, after %d", baseline, got)
	}
}
```

`waitForGoroutines` is a *bounded* poll (`runtime.Gosched()` + a short sleep, up to 100 tries) that only gives the scheduler time to reap goroutines already returning — it does not synchronise the code under test. This test catches the forgotten `ctx.Done()` on the send: without it, a full-buffer forwarder parks forever, `wg.Wait()` never returns, `out` never closes, and both the range and the leak check hang/fail.

**4. The `-race` stress test — mandatory.** Many venues (~48), hundreds of quotes each, tiny buffer, gated on a `start` channel so they all launch together for maximum contention. Two sub-runs: `clean_drain` (multiset exactly-once + no leak) and `cancel_midstream` (drain a prefix, cancel, assert output closes and no leak).

```go
func TestFanIn_RaceStress(t *testing.T) {
	if testing.Short() { t.Skip("run with -race -count=N") }
	t.Run("clean_drain_no_drop_no_dup", func(t *testing.T) {
		baseline := runtime.NumGoroutine()
		const venues, perSrc = 48, 300
		// ... producers gated on start, close(ch) when done
		out := FanIn(context.Background(), 8, sources...)
		close(start)
		got, total := map[Quote]int{}, 0
		for q := range out { got[q]++; total++ }
		// assert total == venues*perSrc and every quote count == 1
		// assert waitForGoroutines(baseline) <= baseline
	})
	t.Run("cancel_midstream_closes_and_no_leak", func(t *testing.T) { /* ... */ })
}
```

Run it: `go test -race -count=20 ./venuefanin/`. A single green run is not proof — the race detector only flags races it *observes*, and interleavings are probabilistic. `-count` re-runs the whole test so different schedules get exercised; that's the habit to teach.

### Implement it

```go
func FanIn(ctx context.Context, bufferSize int, sources ...<-chan Quote) <-chan Quote {
	out := make(chan Quote, bufferSize)
	var wg sync.WaitGroup
	wg.Add(len(sources))

	for _, src := range sources {
		go func(src <-chan Quote) {
			defer wg.Done()
			for {
				select {
				case <-ctx.Done():
					return
				case q, ok := <-src:
					if !ok {
						return // source drained and closed
					}
					select { // send must ALSO race ctx.Done()
					case <-ctx.Done():
						return
					case out <- q:
					}
				}
			}
		}(src)
	}

	go func() { // single closer, exactly once, after the last send
		wg.Wait()
		close(out)
	}()

	return out
}
```

**Synchronisation choice — channels, not a mutex.** The forwarders never share mutable state; they only *communicate* values through `out`. The only coordination is "count the finishers", which is exactly `WaitGroup`. No lock guards anything here.

**Happens-before reasoning.** Each forwarder receives a value, forwards it, and eventually returns and calls `wg.Done()`. `wg.Wait()` returning happens-after every `Done()`, therefore after every send. So `close(out)` is ordered strictly after the last value reaches the buffer — the consumer's `range` sees every value, then the close. Exactly-once falls out of structure: each value is received once (one forwarder owns each source) and forwarded once (linear loop, no re-send).

**Complexity / allocation.** One goroutine per source plus one closer — O(N) goroutines, O(bufferSize) memory, zero per-quote allocation. Memory is bounded by `bufferSize` *regardless* of producer speed; that's the point.

**The key gotchas, and why the code avoids each.** (a) Close inside a forwarder → drops other forwarders' in-flight quotes / double-close panic → fixed by the separate closer. (b) `close(out)` after the `for range sources` loop (before goroutines finish) → same bug → fixed by `wg.Wait()`. (c) Bare `out <- q` with no ctx race → full buffer + departed consumer parks the forwarder forever → **goroutine leak** and `wg.Wait()` never completes so `out` never closes → fixed by the inner `select` on `ctx.Done()`. (d) Spooling overflow into a slice to "avoid blocking" → unbounded growth → OOM → *don't*; blocking IS the design.

### Common mistakes & senior signal

The README's trap, distilled: **WaitGroup-then-close, and select `ctx.Done()` on the send.**

- **Close the output from a forwarder.** The single most common fan-in bug. `close` isn't idempotent and isn't a receiver's job. Rule: *only close once, only from a sender, only after all senders are done* — so it lives in a dedicated goroutine after `wg.Wait()`.
- **Forget the send-side `ctx.Done()`.** Receiving with cancel-awareness but sending with a bare `out <- q` leaks a forwarder the moment the consumer abandons a full buffer. `wg.Wait()` then hangs and the output never closes — a leak *and* a stuck close. Senior instinct: any channel op that can block in a cancellable context gets a `select { case <-ctx.Done(): ...; case op: }`.
- **"Fix" backpressure with an unbounded buffer.** Spooling into a growing slice so sends never block converts a latency problem into an OOM. Backpressure is the feature; keep the bound.
- **Blind load-shed on quotes.** If you *must* shed (liveness over completeness), a `default:` drop can throw away the newest tick and leave a stale one. For prices the senior shed is **latest-wins per-market coalescing** — overwrite older un-sent quotes so you lose intermediate ticks but never serve a stale price (the README extension).
- **Trust one green run.** A senior writes the multiset assertion and runs `go test -race -count=20 ./venuefanin/`, varies buffer size and producer count, and treats a *single* clean run as necessary but not sufficient.

The senior signal in one line: reaches for the WaitGroup-then-close idiom without thinking, guards *both* channel directions against ctx, understands the buffer is deliberate backpressure, and proves it with a repeated `-race` stress test rather than a single pass.


## Settlement — Context Propagation to a Downstream Dependency

### Summary

**What this topic covers**

When a market settles you must pay out every winning bet by calling a downstream payments dependency once per bet. The caller of `Settle` owns a `context.Context` carrying a deadline ("give up after 2s") and/or a cancel signal ("this settlement was abandoned, stop now"). The kata is to build `Settle(ctx, bets)` so that context is threaded into *every* payout call and honoured between calls — when the caller gives up, downstream work stops promptly and no orphaned payouts fire for a settlement nobody awaits. The seductive bug is calling the dependency with a fresh, detached context — `payout(context.Background(), bet)` — which severs the link to the caller and lets the call sail on after cancellation.

**Mental model**

Context is a one-way propagation channel: a parent cancellation flows *down* to every context derived from it. `context.Background()` is a root with no deadline that is never cancelled — passing it downstream is not "a context", it is a wall that stops the caller's cancel signal dead. The fix is two-sided. Your half: *pass* the received `ctx` into `payout` unchanged (or narrowed via `WithTimeout`, never replaced), and *check* `ctx.Err()` at the top of each iteration before dispatching the next call. The payout's half: *observe* the ctx — select on `ctx.Done()`, attach it to the outbound request, return `ctx.Err()` promptly. You cannot rescue a payout that ignores its ctx, but you can refuse to *start* further calls once yours is dead, which bounds overrun to at most one in-flight call. The whole thing is synchronous and lock-free in the base kata — correctness comes from *never detaching*, not from mutexes.

**Key terms**

- **`context.Context`** — carries deadline, cancel signal, and request-scoped values across API boundaries; always the first parameter.
- **propagation** — deriving child contexts so a parent's cancellation reaches all descendants; the invariant this kata protects.
- **detached context** — `context.Background()`/`context.TODO()`; a fresh root with no link to the caller. The bug is handing one downstream.
- **`ctx.Err()`** — nil while live; `context.Canceled` or `context.DeadlineExceeded` once done. The cheap synchronous guard between iterations.
- **`ctx.Done()`** — a channel closed on cancel/timeout; how a *downstream* call observes cancellation via `select`.
- **`context.WithCancel` / `WithTimeout`** — derive a child cancelled when the parent dies (WithCancel) or additionally when a budget elapses (WithTimeout). Narrowing, not detaching.
- **`defer cancel()`** — mandatory after `WithCancel`/`WithTimeout`; the child + timer leak resources until called, even on success. `go vet`'s lostcancel flags a miss.
- **dependency injection** — `PayoutFunc` is injected so tests supply a fake downstream that observes ctx.
- **`errors.Is`** — unwraps wrapped errors; used to assert the returned error wraps `context.Canceled`.
- **errgroup pattern** — the concurrent extension: `WithCancel` + a semaphore channel + `sync.Once` to cancel siblings on first failure.

**Why interviewers ask this**

Context propagation is the single most common real-world Go concurrency bug and it is invisible in a demo — everything works until a caller cancels under load. A junior writes the loop, passes `context.Background()` (or `context.TODO()` left from a stub), sees green tests, and ships a service that keeps billing the payments provider for abandoned settlements. A senior treats "where does this ctx come from and where does it go" as the first question, threads the caller's ctx into every downstream call, guards `ctx.Err()` between iterations for prompt cancellation, and — crucially — *tests it* by injecting a fake downstream that blocks on `ctx.Done()` and asserting the caller's cancel/timeout actually unblocks it. Bonus signal: knowing `WithTimeout` narrows without detaching, and that `defer cancel()` is not optional.

**Common confusions**

- "`context.Background()` is fine, it's just an empty context" → it is a detached root; passing it downstream severs cancellation. Pass the *received* ctx.
- "Checking `ctx.Err()` once at the start is enough" → no; check before *each* call so cancellation mid-flight stops the next dispatch.
- "If I propagate ctx, cancellation is guaranteed to stop the work" → only if the payout *observes* it. Propagation is necessary, not sufficient.
- "`WithTimeout` replaces the parent deadline" → it derives a child that dies on parent-cancel *or* budget; propagation is preserved, just tightened.
- "I can skip `cancel()` on the success path" → the child/timer leak until cancelled regardless of outcome. Always `defer cancel()`.

**What follows from this topic**

The base kata is sequential — a clean baseline. The extension is bounded-concurrency settlement: a worker pool that settles up to N bets at once while still propagating ctx into every call and cancelling its siblings on the first failure (the [[graceful-shutdown]] / errgroup pattern, stdlib-only: `WithCancel` + semaphore channel + `sync.Once`). The propagation discipline here underpins every other kata that fans work out — a leaked, detached call is the same failure mode as a leaked goroutine.

### Clarify & design the API

Questions worth asking before writing code: *In-order or concurrent?* (base kata: strictly in order, one call at a time). *Fail-fast or best-effort?* (fail-fast: stop and return the first error). *Does the returned count include the failed bet?* (no — only bets that completed successfully). *Who owns the context lifecycle?* (the caller; `Settle` propagates, never creates a detached root). *Is the downstream injected?* (yes — so tests can supply a fake).

Commit to these signatures before any logic:

```go
type Bet struct {
    ID    string
    Stake float64
}

// PayoutFunc is the injected downstream call. It MUST receive the propagated
// ctx and is expected to honour it (select on ctx.Done(), attach to the
// request, return ctx.Err() promptly).
type PayoutFunc func(ctx context.Context, bet Bet) error

func NewSettler(payout PayoutFunc) *Settler
func (s *Settler) Settle(ctx context.Context, bets []Bet) (settled int, err error)
```

`Settler` holds only the injected `payout` — no mutable state, so it is safe to reuse across concurrent settlements. Injecting `PayoutFunc` is the design decision that makes propagation *testable*: a fake downstream can inspect the ctx it receives and block on `ctx.Done()`.

### Write the tests

This is the heart. The practice side ships **no tests** — designing them is the exercise, and the tests are what prove propagation actually works. Write them first, then implement to green. Order: basic contract → propagation → cancel/timeout reaching downstream → boundary (pre-cancelled) → first-error → the `-race` stress test.

**Contract + first-error (table-driven).** The floor: all bets paid, and a mid-stream failure stops and reports the successful count.

```go
func TestSettle_Contract(t *testing.T) {
    boom := errors.New("payments down")
    tests := []struct {
        name        string
        bets        []Bet
        failOn      string // bet ID whose payout errors, "" = none
        wantSettled int
        wantErr     error
    }{
        {"all paid", []Bet{{ID: "b1"}, {ID: "b2"}, {ID: "b3"}}, "", 3, nil},
        {"stops on first error", []Bet{{ID: "b1"}, {ID: "b2"}, {ID: "b3"}}, "b2", 1, boom},
    }
    for _, tc := range tests {
        t.Run(tc.name, func(t *testing.T) {
            s := NewSettler(func(ctx context.Context, bet Bet) error {
                if bet.ID == tc.failOn {
                    return boom
                }
                return nil
            })
            settled, err := s.Settle(context.Background(), tc.bets)
            if settled != tc.wantSettled {
                t.Fatalf("settled = %d, want %d", settled, tc.wantSettled)
            }
            if tc.wantErr != nil && !errors.Is(err, tc.wantErr) {
                t.Fatalf("err = %v, want it to wrap %v", err, tc.wantErr)
            }
            if tc.wantErr == nil && err != nil {
                t.Fatalf("err = %v, want nil", err)
            }
        })
    }
}
```

**Propagation — the fake downstream observes the ctx.** Thread a value through the caller's ctx and assert every payout sees it. If `Settle` passed `context.Background()`, the value would be absent — this is the test that fails on the detached-context bug.

```go
func TestSettle_PropagatesContext(t *testing.T) {
    type ctxKey struct{}
    const want = "settlement-7f3a"
    ctx := context.WithValue(context.Background(), ctxKey{}, want)

    var observed int
    s := NewSettler(func(c context.Context, bet Bet) error {
        got, ok := c.Value(ctxKey{}).(string)
        if !ok || got != want {
            t.Errorf("bet %s: ctx value = %q (ok=%v), want %q — ctx not propagated",
                bet.ID, got, ok, want)
        }
        observed++
        return nil
    })
    if _, err := s.Settle(ctx, []Bet{{ID: "b1"}, {ID: "b2"}}); err != nil {
        t.Fatalf("err = %v, want nil", err)
    }
    if observed != 2 {
        t.Fatalf("observed = %d, want 2", observed)
    }
}
```

**Cancel/timeout reaches downstream — a fake that blocks on `ctx.Done()`.** This is the strongest propagation test: the fake downstream mimics a real slow RPC by *blocking on `ctx.Done()`* and returning `ctx.Err()`. If the caller's cancel (or deadline) truly reached it, the blocked call unblocks and returns; if `Settle` had detached the ctx, the fake would hang forever and the test would time out.

```go
func TestSettle_DownstreamUnblocksOnCallerCancel(t *testing.T) {
    // Fake downstream: models an in-flight RPC that only returns when its
    // context is done. If Settle detaches the ctx, this blocks forever.
    entered := make(chan struct{})
    s := NewSettler(func(ctx context.Context, bet Bet) error {
        close(entered)
        <-ctx.Done()        // observe cancellation via the propagated ctx
        return ctx.Err()    // return promptly once the caller gave up
    })

    ctx, cancel := context.WithCancel(context.Background())
    done := make(chan error, 1)
    go func() {
        _, err := s.Settle(ctx, []Bet{{ID: "b1"}})
        done <- err
    }()

    <-entered   // downstream is now blocked inside payout, holding the ctx
    cancel()    // caller gives up

    select {
    case err := <-done:
        if !errors.Is(err, context.Canceled) {
            t.Fatalf("err = %v, want it to wrap context.Canceled", err)
        }
    case <-time.After(time.Second):
        t.Fatal("Settle did not return after cancel — ctx was NOT propagated downstream")
    }
}
```

The timeout variant is the same shape with `context.WithTimeout(ctx, 50*time.Millisecond)` and no manual `cancel` — assert the payout unblocks with `context.DeadlineExceeded`. Together they prove *both* cancel and deadline reach the downstream call.

**Prompt cancellation between iterations + pre-cancelled boundary.** Guarding `ctx.Err()` before each dispatch means a caller who cancels after bet 1 gets exactly one payout; a context dead on arrival gets zero.

```go
func TestSettle_StopsBetweenCalls(t *testing.T) {
    ctx, cancel := context.WithCancel(context.Background())
    var calls int
    s := NewSettler(func(c context.Context, bet Bet) error {
        calls++
        cancel() // caller gives up right after the first call returns
        return nil
    })
    settled, err := s.Settle(ctx, []Bet{{ID: "b1"}, {ID: "b2"}, {ID: "b3"}})
    if !errors.Is(err, context.Canceled) {
        t.Fatalf("err = %v, want context.Canceled", err)
    }
    if calls != 1 || settled != 1 {
        t.Fatalf("calls=%d settled=%d, want 1 and 1 (must stop before bet 2)", calls, settled)
    }
}

func TestSettle_PreCancelled_NoCalls(t *testing.T) {
    ctx, cancel := context.WithCancel(context.Background())
    cancel() // dead on arrival
    var calls int
    s := NewSettler(func(c context.Context, bet Bet) error { calls++; return nil })
    settled, err := s.Settle(ctx, []Bet{{ID: "b1"}, {ID: "b2"}})
    if !errors.Is(err, context.Canceled) || calls != 0 || settled != 0 {
        t.Fatalf("calls=%d settled=%d err=%v, want 0,0,Canceled", calls, settled, err)
    }
}
```

**The `-race` stress test.** Many concurrent callers, each with its own `[]Bet` and its own context; half cancel deterministically mid-flight, half run clean. Assert: cancelled runs stop early and wrap `context.Canceled`; clean runs settle every bet; the payout never sees a nil ctx; no panic. The `Settler` is stateless and reused across all callers, so this also proves reuse is race-free. Run `go test -race -count=10 ./settlement/` — a single green `-race` run is not proof; repeat under `-count` and vary load.

```go
func TestSettle_RaceStress(t *testing.T) {
    if testing.Short() {
        t.Skip("run without -short, ideally -race -count=N")
    }
    const callers, betsPerCall, cancelAtBet, loops = 64, 50, 10, 30

    type callKey struct{}
    var sawNilCtx, payouts atomic.Int64

    s := NewSettler(func(ctx context.Context, bet Bet) error {
        if ctx == nil {
            sawNilCtx.Add(1)
            return nil
        }
        payouts.Add(1)
        // A cancelling caller stashes its CancelFunc on the ctx; trigger it at
        // the fixed bet index (encoded in Stake) to model mid-flight giving up.
        if c, ok := ctx.Value(callKey{}).(*cancelTrigger); ok && int(bet.Stake) == c.trigger {
            c.cancel()
        }
        return ctx.Err() // well-behaved: honour the ctx
    })

    start := make(chan struct{})
    var wg sync.WaitGroup
    var failures atomic.Int64
    wg.Add(callers)
    for c := 0; c < callers; c++ {
        cancelling := c%2 == 0
        go func(cancelling bool) {
            defer wg.Done()
            <-start
            for l := 0; l < loops; l++ {
                bets := make([]Bet, betsPerCall)
                for i := range bets {
                    bets[i] = Bet{ID: "b", Stake: float64(i)} // Stake encodes index
                }
                ctx, cancel := context.WithCancel(context.Background())
                if cancelling {
                    ct := &cancelTrigger{cancel: cancel, trigger: cancelAtBet}
                    ctx = context.WithValue(ctx, callKey{}, ct)
                }
                settled, err := s.Settle(ctx, bets)
                if cancelling {
                    if !errors.Is(err, context.Canceled) || settled >= len(bets) {
                        failures.Add(1)
                    }
                } else if err != nil || settled != len(bets) {
                    failures.Add(1)
                }
                cancel()
            }
        }(cancelling)
    }
    close(start)
    wg.Wait()

    if n := sawNilCtx.Load(); n != 0 {
        t.Fatalf("payout saw nil ctx %d times", n)
    }
    if n := failures.Load(); n != 0 {
        t.Fatalf("%d invariant violations under stress", n)
    }
    if payouts.Load() == 0 {
        t.Fatal("no payouts recorded; stress did nothing")
    }
}

type cancelTrigger struct {
    cancel  context.CancelFunc
    trigger int
}
```

Why each group matters: the contract tests pin the API; propagation + the blocking-downstream test catch the detached-context bug (the whole point); the between-calls + pre-cancelled tests pin *prompt* cancellation and the zero-call boundary; the stress test proves it holds under concurrent reuse with `-race`.

### Implement it

The synchronisation choice is **no synchronisation** — the base kata is sequential and the correctness comes entirely from context discipline. `Settler` is immutable after construction, so concurrent `Settle` calls share nothing mutable.

```go
func (s *Settler) Settle(ctx context.Context, bets []Bet) (settled int, err error) {
    for _, bet := range bets {
        // Prompt cancellation: bail before dispatching the next call.
        if err := ctx.Err(); err != nil {
            return settled, fmt.Errorf("settlement cancelled after %d/%d bets: %w",
                settled, len(bets), err)
        }
        // Propagate the caller's ctx downstream — never a detached background ctx.
        if err := s.payout(ctx, bet); err != nil {
            return settled, fmt.Errorf("payout for bet %s failed: %w", bet.ID, err)
        }
        settled++
    }
    return settled, nil
}
```

Reasoning: the `ctx.Err()` guard at the *top of each iteration* is what bounds overrun to at most one in-flight call — if the ctx died while the previous payout was running, the next `s.payout` never fires. Passing `ctx` (not `context.Background()`) into `payout` is the propagation itself. Errors are wrapped with `%w` so callers can `errors.Is(err, context.Canceled)`. Complexity is O(n) calls, zero allocations beyond the error paths. The key gotcha is subtle: propagation here is *necessary but not sufficient* — if the injected payout ignores its ctx, cancellation won't stop the *in-flight* call, only the *next* dispatch. That's the payout's contract to keep, and why the blocking-downstream test asserts the fake actually returns `ctx.Err()`.

For a per-call budget (retries, a slow dependency), narrow — don't detach:

```go
callCtx, cancel := context.WithTimeout(ctx, perCallBudget)
defer cancel() // mandatory: child + timer leak until cancelled, even on success
err := s.payout(callCtx, bet)
```

### Common mistakes & senior signal

The README's trap, and the pitfalls around it:

- **The detached-context bug** — `payout(context.Background(), bet)` or a leftover `context.TODO()` from a stub. It compiles, passes naive tests, and severs cancellation: the caller times out, its cancel fires, `Settle`'s own ctx is `Done` — and the payout sails on, billing the payments provider for a settlement nobody awaits. Senior signal: pass the *received* ctx down; the propagation test with a value threaded through is the one that catches this.
- **Guarding once, not per-iteration** — checking `ctx.Err()` only before the loop means a cancel mid-settlement still dispatches the rest. Guard at the top of *every* iteration for prompt cancellation.
- **Assuming propagation guarantees stopping** — it doesn't; the payout must *observe* the ctx (`select { case <-ctx.Done(): }`, attach to the request, return `ctx.Err()`). Propagation is a two-sided contract; you can only refuse to *start* further calls once yours is dead.
- **Forgetting `defer cancel()`** after `WithTimeout`/`WithCancel` — the child and its timer leak until cancelled, even on the success path. `go vet`'s lostcancel check flags it; a senior defers unconditionally.
- **Trusting one green `-race` run** — concurrency bugs are probabilistic. Repeat under `-race -count=10` and vary load; the stress test with a stateless reused `Settler` is what earns confidence.
- **In the concurrent extension: not cancelling siblings on first failure** — the errgroup pattern uses `sync.Once` to capture the first error and `cancel()` the shared derived ctx, so in-flight siblings that observe their ctx abort instead of grinding on for a doomed settlement.


## Graceful Shutdown — Drain Without Deadlock, Loss, or Panic

### Summary

**What this topic covers**

You run a bet-processing server: many goroutines `Submit` jobs onto a bounded internal queue, and a fixed pool of workers drains that queue and processes each job. On every deploy the process gets a shutdown signal and must stop *gracefully* — stop accepting new work, finish everything already submitted (in-flight and queued), and exit. The happy path is trivial; the entire difficulty is the shutdown protocol. Three classic failure modes lurk: **send on a closed channel panics** (many senders race the one closer), **lost in-flight messages** (returning before workers drain the buffer), and **deadlock** (a bare `wg.Wait()` hangs forever on a wedged worker). You build `NewServer`, `Start`, `Submit`, and `Shutdown(ctx)`, and the design is judged entirely on how those four interact under contention.

**Mental model**

Shutdown is a *fence-then-drain* sequence with a linearisation point. The fence: close a separate `done` channel exactly once (via `sync.Once`) so `Submit` observes shutdown and returns `ErrShuttingDown` — never sends. But `Submit` sends on `jobs` and `Shutdown` wants to `close(jobs)`; "only the sender closes" fails because there are many senders. So an `RWMutex` makes `Submit`'s check-then-send *atomic* against the close: `Submit` holds the read lock across `check(done) + send`; `Shutdown` takes the write lock before `close(jobs)`. Holding the write lock proves no `Submit` is mid-send, so the close can't race a send. The drain: workers `range jobs`; ranging a *closed* channel yields every buffered element before ending, so closing `jobs` drains the queue rather than dropping it, and a `WaitGroup` (one count per worker, `Done` when `range` ends) tells you the drain finished. The anti-hang: run `wg.Wait()` in a goroutine that closes `finished`, then `select` on `finished` vs `ctx.Done()`.

**Key terms**

- **`done` channel** — closed once to broadcast "shutting down"; a closed channel makes every `<-done` return immediately, so it fans out to all `Submit` callers.
- **`sync.Once`** — guarantees `close(done)` and `close(jobs)` run exactly once, making `Shutdown` idempotent (double-close panics otherwise).
- **`sync.RWMutex`** — `Submit` takes `RLock` (many concurrent sends allowed); `Shutdown` takes `Lock` (exclusive) to fence off all sends before closing.
- **check-then-send atomicity** — the read lock spans both the `done` check and the channel send, so the close can't slip between them.
- **`sync.WaitGroup`** — counts live workers; `wg.Wait()` returns only when every worker's `range` loop has ended, i.e. the queue is fully drained.
- **range over closed channel** — yields all buffered values, *then* terminates the loop. This is why closing `jobs` drains rather than truncates.
- **send on closed channel** — panics ("send on closed channel"); `close` is irreversible. The bug this kata is built around.
- **wait-with-timeout idiom** — `wg.Wait()` in a goroutine closing `finished`, raced against `ctx.Done()` in a `select`.
- **`ctx.Err()`** — returned when the deadline fires first (`context.DeadlineExceeded`) so the operator regains control instead of hanging.
- **happens-before** — `close(done)` before a receiver observes it establishes ordering; the mutex orders send vs close.

**Why interviewers ask this**

Graceful shutdown separates people who *use* channels from people who *own their lifecycle*. A junior writes the worker pool fine, then closes `jobs` from `Shutdown` and either panics (a `Submit` was mid-send) or loses queued jobs (returns before the drain). A mid-level reaches for `sync.Once` to avoid the double-close panic but still races send-vs-close. The senior signal is naming all three failure modes unprompted, explaining *why* "only the sender closes" doesn't directly apply with many senders, using a lock as the linearisation point, and — critically — knowing a bare `wg.Wait()` is a latent deadlock, so wrapping it in a ctx-bounded select. It maps straight onto real deploy/SIGTERM handling.

**Common confusions**

- "Just let `Submit` close `jobs`" — impossible with many concurrent senders; you fence them off first, then one closer closes.
- "`close(jobs)` loses queued jobs" — no; `range` over a closed channel drains the buffer first. Closing is how you drain.
- "`ctx` timeout means the workers stopped" — no; the workers keep draining in the background. Timeout just returns control to the operator.
- "`time.Sleep` to let the drain finish" — never; the `WaitGroup` is the signal.

**What follows from this topic**

This is the coordination backbone under [[go-settlement]] and the [[go-betmachine]] worker pools — anything with a deploy story. It shares the "close once, fan-out on a closed channel" idiom with [[go-feedchannel]] and the ctx-cancellation discipline with [[go-oddsfeed]]. The extension (backpressure via a `default:` arm, dropped-job accounting) leads into rate-limiting and load-shedding.

### Clarify & design the API

Questions to ask before writing a line: **Is `Submit` called concurrently?** (Yes — many goroutines.) **Should `Submit` block when the queue is full, or shed load?** (Block for the base kata; `ErrQueueFull` is the extension.) **Must `Shutdown` wait for in-flight jobs, or just stop accepting?** (Wait — drain everything, no loss.) **Can `Shutdown` be called twice?** (Yes — idempotent, no panic.) **What on a slow worker?** (Respect `ctx`; return its error rather than hang.)

Commit to the surface before any logic — buffered `jobs` channel (bounded queue), a separate `done` signal, one closer:

```go
var ErrShuttingDown = errors.New("shutdown: server is shutting down")

type Job struct{ ID string }

func NewServer(workers, queueSize int, process func(Job)) *Server
func (s *Server) Start()                         // launch the pool
func (s *Server) Submit(j Job) error             // many callers; ErrShuttingDown after Shutdown
func (s *Server) Shutdown(ctx context.Context) error // drain-or-deadline, idempotent
```

Decisions baked in here: `jobs` is **buffered** (the queue). `done` is **unbuffered and only ever closed** (a broadcast, not a value). The **workers own draining** (`range jobs`); **`Shutdown` owns closing** — exactly once. Naming `ErrShuttingDown` up front signals the contract: a shutting-down `Submit` is a clean error, never a panic.

### Write the tests

Tests come first — the practice kata ships none on purpose, because designing tests that *expose* the three bugs is the exercise. Structure them contract → behaviour → edge → race.

**No-loss on the clean path** — the core invariant: every job you submit gets processed.

```go
func TestShutdown_DrainsAllJobs(t *testing.T) {
	const n = 200
	var processed atomic.Int64
	s := NewServer(4, 16, func(Job) { processed.Add(1) })
	s.Start()
	for i := 0; i < n; i++ {
		if err := s.Submit(Job{ID: "j"}); err != nil {
			t.Fatalf("Submit %d: %v", i, err)
		}
	}
	if err := s.Shutdown(context.Background()); err != nil {
		t.Fatalf("Shutdown: %v", err)
	}
	if got := processed.Load(); got != n {
		t.Fatalf("processed %d, want %d (queued work lost)", got, n)
	}
}
```

**Rejection after shutdown** — `Submit` returns `ErrShuttingDown`, never panics; and **idempotency** — a second `Shutdown` must not double-close:

```go
func TestSubmit_AfterShutdown_Rejected(t *testing.T) {
	s := NewServer(2, 4, func(Job) {})
	s.Start()
	_ = s.Shutdown(context.Background())
	if err := s.Submit(Job{ID: "late"}); err != ErrShuttingDown {
		t.Fatalf("got %v, want ErrShuttingDown", err)
	}
}

func TestShutdown_Idempotent(t *testing.T) {
	s := NewServer(2, 4, func(Job) {})
	s.Start()
	if err := s.Shutdown(context.Background()); err != nil { t.Fatal(err) }
	if err := s.Shutdown(context.Background()); err != nil { t.Fatal(err) } // must not panic
}
```

**Context deadline** — gate the worker so the drain *cannot* finish, and assert `Shutdown` surfaces the ctx error instead of hanging. No `time.Sleep` for synchronisation — a `block` channel makes it deterministic:

```go
func TestShutdown_RespectsContextDeadline(t *testing.T) {
	block := make(chan struct{})
	s := NewServer(1, 4, func(Job) { <-block }) // worker wedged
	s.Start()
	_ = s.Submit(Job{ID: "slow"})
	ctx, cancel := context.WithTimeout(context.Background(), time.Millisecond)
	defer cancel()
	if err := s.Shutdown(ctx); err != context.DeadlineExceeded {
		t.Fatalf("got %v, want DeadlineExceeded", err)
	}
	close(block) // let the background drain finish cleanly
}
```

**The `-race` stress test** — the one that actually catches the send-on-closed panic and goroutine leak. Many submitters hammer `Submit` while another goroutine calls `Shutdown` (twice). Invariants: no panic; every *accepted* (returned-nil) job is processed; only `nil`/`ErrShuttingDown` ever returned; no goroutine leaks.

```go
func TestServer_RaceStress(t *testing.T) {
	if testing.Short() { t.Skip("run without -short, ideally -race -count=N") }
	baseline := runtime.NumGoroutine()
	const workers, queueSize, submitters, perSubmit = 6, 32, 48, 200

	var processed, accepted, badErr atomic.Int64
	s := NewServer(workers, queueSize, func(Job) { processed.Add(1) })
	s.Start()

	start := make(chan struct{})
	var wg sync.WaitGroup
	wg.Add(submitters)
	for sub := 0; sub < submitters; sub++ {
		go func() {
			defer wg.Done()
			<-start
			for i := 0; i < perSubmit; i++ {
				switch err := s.Submit(Job{ID: "x"}); err {
				case nil:            accepted.Add(1) // now owned by the server
				case ErrShuttingDown:
				default:             badErr.Add(1)
				}
			}
		}()
	}
	done := make(chan error, 1)
	go func() {
		<-start
		for i := 0; i < 80; i++ { runtime.Gosched() } // let submits get going
		e1 := s.Shutdown(context.Background())
		e2 := s.Shutdown(context.Background()) // idempotent under concurrency
		if e1 != nil { done <- e1; return }
		done <- e2
	}()
	close(start)
	wg.Wait()

	if err := <-done; err != nil { t.Fatalf("clean-path Shutdown: %v", err) }
	if n := badErr.Load(); n != 0 { t.Fatalf("%d unexpected errors", n) }
	if got, want := processed.Load(), accepted.Load(); got != want {
		t.Fatalf("processed %d but accepted %d; work lost", got, want)
	}
	if err := s.Submit(Job{ID: "late"}); err != ErrShuttingDown {
		t.Fatalf("post-shutdown Submit: got %v", err)
	}
	// goroutine-leak check: poll NumGoroutine back down to baseline
}
```

The `accepted == processed` invariant is subtle and correct: under a shutdown race you *can't* demand all attempted submits succeed (some legitimately hit `ErrShuttingDown`), but every submit that returned `nil` handed ownership to the server, so all of those must be processed. Run it hard: `go test -race -count=50 ./shutdown/`. A single green `-race` pass is not proof — concurrency bugs are probabilistic, so `-count=N` and vary load until you trust it.

### Implement it

Three primitives, each targeting one failure mode. `done` (closed once) is the shutting-down signal. `mu sync.RWMutex` makes `Submit`'s check-then-send atomic against `close(jobs)`. `wg sync.WaitGroup` counts workers so `Shutdown` knows when the drain is complete.

```go
func (s *Server) Start() {
	s.wg.Add(s.workers)
	for i := 0; i < s.workers; i++ {
		go func() {
			defer s.wg.Done()
			for j := range s.jobs { // drains buffer after close, then ends
				s.process(j)
			}
		}()
	}
}

func (s *Server) Submit(j Job) error {
	s.mu.RLock()
	defer s.mu.RUnlock()
	select {
	case <-s.done:
		return ErrShuttingDown // fast path: already shutting down
	default:
	}
	select {
	case <-s.done:
		return ErrShuttingDown // unblocks a Submit parked on a full queue
	case s.jobs <- j:
		return nil
	}
}

func (s *Server) Shutdown(ctx context.Context) error {
	s.closeOnce.Do(func() {
		close(s.done)        // fence: every future/blocked Submit now bails
		s.mu.Lock()          // granted only when no Submit holds RLock (none mid-send)
		close(s.jobs)         // the ONLY close of jobs — exactly once
		s.mu.Unlock()
	})
	finished := make(chan struct{})
	go func() { s.wg.Wait(); close(finished) }()
	select {
	case <-finished:
		return nil
	case <-ctx.Done():
		return ctx.Err() // wedged worker → return control, don't hang
	}
}
```

Happens-before reasoning: `close(done)` is visible to every `Submit` that later reads it; and `s.mu.Lock()` in `Shutdown` cannot be granted while any `Submit` holds `RLock`, so once the write lock is held, *no send is in progress* — closing `jobs` is safe. The second `select` in `Submit` re-checks `done` so a caller blocked on a full queue wakes with `ErrShuttingDown` the instant shutdown begins, rather than hanging until space frees. Cost: an `RWMutex` read lock per `Submit` (uncontended read locks are cheap; the write lock is taken exactly once), a `WaitGroup` counter, and one throwaway goroutine per `Shutdown` call for the timeout wrap.

### Common mistakes & senior signal

The README's trap is three-fold, and each has a senior move:

- **Send on closed channel.** Don't make `Submit` the closer — there are many senders. Fence first (`close(done)` under `sync.Once`), then close `jobs` under the write lock. The lock is the linearisation point that makes check-then-send atomic vs the close. Junior: closes `jobs` directly from `Shutdown` and races a send → panic.
- **Lost in-flight work.** Don't return from `Shutdown` before `wg.Wait()`, and don't try to "drain manually" — `for j := range s.jobs` over a *closed* channel yields the whole buffer first, so `close(jobs)` + `wg.Wait()` *is* the drain. Register `wg.Add(workers)` in `Start`, `defer wg.Done()` when `range` ends.
- **Deadlock on a wedged worker.** Never a bare `wg.Wait()` in a deploy path. Wrap it: `Wait` in a goroutine closing `finished`, `select` against `ctx.Done()`, return `ctx.Err()` on timeout. The workers keep draining in the background; the operator gets control back and can escalate to SIGKILL.

Other tells: `sync.Once` (or a `closeOnce`) so a double `Shutdown` doesn't panic on double-close; **no `time.Sleep` for synchronisation** anywhere — use channels and the `WaitGroup`; and the `-race -count=N` habit stated aloud ("one green race run doesn't prove a concurrent design"). Extensions a senior raises unprompted: a `default:` arm on the `Submit` send for backpressure (`ErrQueueFull`, shed load instead of blocking), and counting dropped jobs on ctx-timeout for observability.


## Matching Engine — Single-Writer Order Book

### Summary

**What this topic covers**
You build the core of an exchange: a limit order book that matches incoming orders against resting liquidity under strict **price-time priority**, plus an `Engine` that serialises concurrent order flow through a single matching goroutine so the book needs no locks. Two sides — bids (buyers) and asks (sellers) — each a set of price levels, each level a FIFO queue. A buy matches asks, a sell matches bids; whatever does not fill either rests (limit) or is discarded (market). The trap is that this is a real-money system: it must be **deterministic** (trades depend only on arrival order) and must **conserve quantity exactly** — no double-fill, no phantom fill. This is a bigger staged kata: build the single-threaded book first (stages 1-3), then wrap it in a lock-free concurrent engine (stage 4).

**Mental model**
Two ideas stacked. First, **the data structure IS the policy**: keep each side's price levels sorted (bids high→low, asks low→high) and each level a FIFO queue. Walk the best level, drain its queue front-to-back, advance to the next level — that walk *is* price-time priority, with no scoring or heuristics, so the outcome is reproducible from the arrival sequence alone. Second, **single-writer beats locking**. A matching engine is the textbook single-writer state machine: every op is a read-modify-write of the same book and the *order* of ops is the result. A mutex would serialise everything anyway plus add lock overhead and a forgotten-critical-section risk on real money. Instead, funnel all orders through one channel into one goroutine: same serialisation, a genuinely lock-free core (the book is touched by exactly one goroutine), and determinism for free. You scale not by locking but by **sharding per instrument** — one Engine per symbol, a router hashing orders to shards.

**Key terms**
- **price-time priority** — best price trades first; ties broken by earliest arrival.
- **maker / taker** — maker is the resting order; taker is the incoming aggressive order.
- **maker-price rule** — the fill executes at the *maker's* (resting) price, not the taker's.
- **price level** — all resting orders at one price, held as a FIFO queue.
- **FIFO queue = time priority** — append on arrival, pop from the front when matching.
- **integer ticks** — price is `int64`, never `float64`; floats drift and break conservation.
- **quantity conservation** — each match decrements *both* sides by the same amount; total bought == total sold.
- **single-writer loop** — one goroutine ranges a channel and applies every op serially.
- **reply channel** — buffered `chan []Trade` (size 1) the loop sends trades back on.
- **`done` / `stopped`** — close-signal channel and loop-exited channel for clean shutdown.
- **`sync.Once`** — closes `done` exactly once so `Close` is idempotent and panic-free.
- **send-on-closed panic** — `Submit` selects on `done` so it never sends into a closed channel.

**Why interviewers ask this**
It is the richest concurrency kata: it separates **domain modelling** from **concurrency discipline** and tests both. A junior locks the book with a mutex, matches at the taker's price, uses `float64` for money, and either leaks the matching goroutine or panics on send-after-close. A senior recognises the single-writer pattern immediately ("there is no independently-shardable work within one instrument, so a lock just serialises with extra overhead"), matches at the maker price, uses integer ticks and explains why, keeps the book lock-free with concurrency only at the edge, and closes the engine with `sync.Once` + a `stopped` handshake so `Close` blocks until the goroutine is truly gone. They also name the scaling answer — shard by instrument — unprompted. It is the clearest read on whether you can pick the right concurrency structure rather than reflexively reaching for a lock.

**Common confusions**
- *"Lock the book with a mutex."* → Every op is a write of the same state; a lock serialises everything anyway. A single-writer channel loop is cleaner and lock-free.
- *"Trade at the taker's price."* → Fills execute at the *maker's* resting price; the taker gets price improvement.
- *"Use float64 for price."* → Floats drift; equality fails and fills don't reconcile. Integer ticks are exact.
- *"A market order rests if unfilled."* → Never. Only limit remainders rest; market remainders are discarded.
- *"Amend-up keeps priority."* → No — increasing qty or re-pricing goes to the back of the level; reject or model as cancel+resubmit.

**What follows from this topic**
This is the capstone of the channel-serialisation family. The single-writer loop is the same pattern as [[go-shutdown]]'s graceful stop and [[go-feedchannel]]'s fan-in, scaled to a stateful core; the buffered-reply / `select`-on-`ctx.Done()` handshake is the request-reply idiom from [[go-pricecache]] and [[go-settlement]]. Sharding-by-instrument connects to [[go-venuefanin]]. Contrast with [[orderbook]] and [[blockingqueue]] for the lock-based alternative you deliberately reject here.

### Clarify & design the API

Ask before coding. **Price units** — integer ticks, confirmed (never float). **Order types** — limit (rests) and market (never rests)? **Maker or taker price** on a cross — maker (standard continuous auction). **Amend semantics** — reduce keeps priority; amend-up / re-price rejected? **Concurrency** — is the book itself concurrent, or is serialisation the engine's job? (The latter: keep the book a plain single-threaded state machine.) **Close semantics** — must `Submit` after `Close` error rather than panic, and must `Close` guarantee no goroutine leak?

Commit to two layers. The book is the single-threaded core; the engine is concurrency at the edge.

```go
// Single-threaded core — NO locking, one writer only.
func NewOrderBook() *OrderBook
func (b *OrderBook) Submit(o Order) []Trade
func (b *OrderBook) Cancel(orderID string) bool
func (b *OrderBook) Amend(orderID string, newQty int64) bool
func (b *OrderBook) Best() (bestBid, bestAsk int64, ok bool)

// Concurrency at the edge — one matching goroutine.
func NewEngine() *Engine
func (e *Engine) Start()
func (e *Engine) Submit(ctx context.Context, o Order) ([]Trade, error)
func (e *Engine) Close()

type Order struct{ ID string; Side Side; Type OrderType; Price, Qty int64 }
type Trade struct{ MakerID, TakerID string; Price, Qty int64 }
```

Internally: each side is a `[]*priceLevel` kept in priority order (index 0 is the best), each `priceLevel` is a `price` plus a FIFO `[]*restingOrder`, and a `map[string]orderLoc` index locates a resting order for O(1) Cancel/Amend. The engine holds the book, an unbuffered `submit chan submitReq`, and `done`/`stopped` signal channels. `submitReq{order Order; reply chan []Trade}` carries the order and a **buffered** reply channel.

### Stage 1-3: implement the book (single-threaded core)

Build the book with no locking — it is a plain state machine. `Submit` picks the opposite side and a `crosses` predicate, then sweeps best-level-first:

```go
func (b *OrderBook) Submit(o Order) []Trade {
	remaining := o.Qty
	var trades []Trade
	opposite, crosses := b.matchTargets(o) // &b.asks / &b.bids + price predicate

	for remaining > 0 && len(*opposite) > 0 {
		level := (*opposite)[0]
		if !crosses(level.price) {
			break // best level doesn't cross; nothing deeper can either.
		}
		for remaining > 0 && len(level.orders) > 0 {
			maker := level.orders[0]      // FIFO front = earliest arrival
			fill := min(remaining, maker.remaining)
			trades = append(trades, Trade{maker.id, o.ID, maker.price, fill}) // maker price
			maker.remaining -= fill       // conservation: same fill leaves both sides
			remaining -= fill
			if maker.remaining == 0 {
				delete(b.index, maker.id)
				level.orders = level.orders[1:] // pop front
			}
		}
		if len(level.orders) == 0 {
			*opposite = (*opposite)[1:] // level drained; drop it
		}
	}
	if remaining > 0 && o.Type == Limit { // market remainder evaporates
		b.rest(o, remaining)
	}
	return trades
}
```

Four things pin the spec: the `crosses` predicate (`o.Type == Market || o.Price >= restPrice` for a buy) folds market orders in as "crosses anything"; the fill uses `maker.price` (maker-price rule); both sides decrement by the *same* `fill` (conservation); and only a `Limit` remainder rests. `rest` appends to the back of the matching level (last in time) and re-sorts on a new level. `Cancel`/`Amend` use the index; amend-up returns `false` (loses priority), amend-to-zero cancels.

### Write the tests — book behaviour (write these FIRST)

Test-first, before the loop above exists. Group by the invariant each catches. Start with the maker-price and resting-remainder contract:

```go
func TestCrossingLimit_TradesAtMakerPrice(t *testing.T) {
	b := NewOrderBook()
	b.Submit(Order{ID: "maker", Side: Sell, Type: Limit, Price: 102, Qty: 10})
	trades := b.Submit(Order{ID: "taker", Side: Buy, Type: Limit, Price: 105, Qty: 4})
	want := Trade{MakerID: "maker", TakerID: "taker", Price: 102, Qty: 4} // maker's 102, not 105
	if len(trades) != 1 || trades[0] != want {
		t.Fatalf("trade = %+v, want %+v", trades, want)
	}
	if !b.Cancel("maker") { // maker's remaining 6 still rests
		t.Fatalf("maker should still rest with remaining 6")
	}
}
```

Then the two priority axes, each its own test. **Price priority** — a big buy sweeps the 100 level then the 101 level, in that order, and stops before 102. **Time priority (FIFO)** — two sells at the *same* price; a buy for 5 must fill the *earliest* (`e1`), and `e1` must be gone while `e2` still rests:

```go
func TestPriceTimePriority_FIFOAtALevel(t *testing.T) {
	b := NewOrderBook()
	b.Submit(Order{ID: "e1", Side: Sell, Type: Limit, Price: 100, Qty: 5}) // arrives first
	b.Submit(Order{ID: "e2", Side: Sell, Type: Limit, Price: 100, Qty: 5})
	trades := b.Submit(Order{ID: "t", Side: Buy, Type: Limit, Price: 100, Qty: 5})
	if len(trades) != 1 || trades[0].MakerID != "e1" {
		t.Fatalf("trades = %+v, want single fill against e1 (FIFO)", trades)
	}
	if b.Cancel("e1") { t.Fatalf("e1 should be filled and gone") }
	if !b.Cancel("e2") { t.Fatalf("e2 should still rest") }
}
```

Cover the edges that break naive code: **market sweeps then never rests** (fills all liquidity, remainder discarded, `Cancel("m")` is false), **market on an empty book** (no fill, no rest), **cancel removes** a resting order, **amend-reduce keeps priority** (reduced `e1` still fills before `e2`), **amend-up is rejected**, **amend-to-zero cancels**, and **`Best` reflects the book** (ok=false unless both sides populated). Table-drive the amend/cancel cases with `t.Run` since they share setup.

### Write the tests — quantity conservation (the money-safety stress test)

The single test that proves no double-fill or phantom fill: a long **seeded** random sequence of limit orders in a tight price band (95-105, so they cross constantly), tracking every fill. Deterministic (seeded), so it reproduces on failure.

```go
func TestQuantityConservation(t *testing.T) {
	rng := rand.New(rand.NewSource(0xC0FFEE))
	b := NewOrderBook()
	filled, orig, sideOf := map[string]int64{}, map[string]int64{}, map[string]Side{}
	var bought, sold int64

	for i := 0; i < 5000; i++ {
		id := orderID(i)
		side := Buy; if rng.Intn(2) == 0 { side = Sell }
		price := int64(95 + rng.Intn(11)) // 95..105 -> frequent crossing
		qty := int64(1 + rng.Intn(10))
		orig[id], sideOf[id] = qty, side
		for _, tr := range b.Submit(Order{ID: id, Side: side, Type: Limit, Price: price, Qty: qty}) {
			filled[tr.MakerID] += tr.Qty
			filled[tr.TakerID] += tr.Qty
			// taker and maker are always opposite sides -> one buy tally, one sell tally.
			classify(sideOf[tr.TakerID], tr.Qty, &bought, &sold)
			classify(sideOf[tr.MakerID], tr.Qty, &bought, &sold)
		}
	}
	if bought != sold { t.Fatalf("conservation violated: bought %d != sold %d", bought, sold) }
	for id, f := range filled {
		if f > orig[id] { t.Fatalf("order %s over-filled: %d > %d", id, f, orig[id]) }
	}
}
```

Two assertions, two failure modes: `bought == sold` catches a phantom fill (quantity created from nowhere); `filled[id] <= orig[id]` catches a double-fill (the same resting quantity matched twice). This is single-threaded — conservation is a *domain* invariant, proven before any concurrency exists.

### Stage 4: implement the engine (single-writer matching loop)

Now wrap the book. One goroutine is the *only* thing that ever touches the book, which is precisely why the book needs no locks. `Start` ranges the submit channel via `select`, also watching `done`:

```go
func (e *Engine) Start() {
	go func() {
		defer close(e.stopped) // signal "loop is gone" for Close
		for {
			select {
			case <-e.done:
				return
			case req := <-e.submit:
				req.reply <- e.book.Submit(req.order) // buffered reply -> never blocks
			}
		}
	}()
}

func (e *Engine) Submit(ctx context.Context, o Order) ([]Trade, error) {
	req := submitReq{order: o, reply: make(chan []Trade, 1)} // size 1 = loop can't block
	select {                       // hand off — bail if closed or ctx cancelled
	case e.submit <- req:
	case <-e.done:
		return nil, ErrEngineClosed // selecting on done = no send on closed channel
	case <-ctx.Done():
		return nil, ctx.Err()
	}
	select {                       // await reply
	case trades := <-req.reply:
		return trades, nil
	case <-ctx.Done():
		return nil, ctx.Err()      // loop's buffered send still succeeds; nothing leaks
	}
}

func (e *Engine) Close() {
	e.closeOnce.Do(func() { close(e.done) }) // exactly once -> double-Close safe
	<-e.stopped                              // block until the goroutine is truly gone
}
```

Three deliberate choices. The reply channel is **buffered (1)** so the loop's `req.reply <- ...` always completes even if the caller already gave up on `ctx.Done()` — that is what prevents a leak on cancellation. `Submit` **selects on `done`** during hand-off, so a concurrent `Close` yields `ErrEngineClosed`, never a send-on-closed-channel panic. `Close` uses `sync.Once` (idempotent) plus a `stopped` handshake so it returns only once the loop has exited — no goroutine leak. Happens-before: the channel send/receive on `submit` orders every book access, so the book's non-atomic mutations are fully synchronised despite having no lock.

### Write the tests — engine & the -race stress test

Engine-level behaviour first: **serialised matching** (submit maker then taker, assert the fill), **submit-after-close returns `ErrEngineClosed`** (not a panic), **`Close` is idempotent and leak-free** (double `Close`, then assert goroutine count returns to baseline), and a **deterministic aggregate** — seed 100 resting units, fire 32 gated goroutines each buying 10 (demand 320 >> 100), assert exactly 100 filled because the loop serialises every cross so all liquidity is consumed and no more. Also **close-with-active-submitters**: close mid-flight and require every `Submit` to return `trades+nil` *or* `ErrEngineClosed`, no panic, no leak.

Then the capstone — the conservation invariant under `-race`, many goroutines, mixed sides/types:

```go
func TestEngine_RaceStress(t *testing.T) {
	if testing.Short() { t.Skip("run with -race -count=N") }
	baseline := runtime.NumGoroutine()
	e := NewEngine(); e.Start()

	workers := max(32, 16*runtime.GOMAXPROCS(0))
	const iters = 400
	tallies := make([]tally, workers) // per-goroutine maps -> the TEST adds no shared state
	start := make(chan struct{}); var wg sync.WaitGroup

	for w := 0; w < workers; w++ {
		w := w; wg.Add(1)
		go func() {
			defer wg.Done()
			tl := &tallies[w]; <-start
			for i := 0; i < iters; i++ {
				o := makeOrder(w, i) // price 96..104 straddles 100; qty 1..5; 1-in-7 market
				tl.qty[o.ID] = o.Qty
				trades, err := e.Submit(context.Background(), o)
				if err != nil { t.Errorf("Submit %s: %v", o.ID, err); return }
				for _, tr := range trades {
					tl.filledByOrder[tr.TakerID] += tr.Qty
					tl.filledByOrder[tr.MakerID] += tr.Qty
					tl.buyFilled += tr.Qty  // one taker + one maker on opposite sides
					tl.sellFilled += tr.Qty // -> lock-step, so global sums must be equal
				}
			}
		}()
	}
	close(start); wg.Wait(); e.Close()

	// merge tallies -> totalBuy == totalSell IS conservation across the whole run
	// and filled[id] <= origQty[id] for every id; then assert no goroutine leak.
}
```

Note the discipline: each goroutine tallies into **its own** maps, merged single-threaded after `wg.Wait()`, so the test harness itself has no shared mutable state to race on — a failure is the *engine's*, not the test's. Run it as `go test -race -count=20 ./matchingengine/`. One green `-race` pass is not proof; the `-count` loop plus `GOMAXPROCS`-scaled workers vary the interleaving so a latent race actually surfaces.

### Common mistakes & senior signal

The README's trap is reaching for a **mutex around the book**. A senior articulates why that is wrong here specifically: every op is a read-modify-write of the same state with no independently-shardable work, so a lock serialises everything anyway — the single-writer channel loop gives identical serialisation, a genuinely lock-free core, and free determinism, then you scale by **sharding per instrument**, not by locking harder.

Pitfalls that separate levels:
- **Taker-price fills.** Match at the *maker's* resting price. Getting this wrong also breaks conservation accounting (both sides must agree on one price).
- **float64 money.** Integer ticks only — floats drift, equality fails, fills don't reconcile. Convert to display price only at the edge.
- **Market orders resting.** A market remainder is discarded; only limit remainders rest.
- **Send-on-closed panic.** `Submit` must `select` on `done` during hand-off, never send blindly.
- **Leak on ctx-cancel.** The reply channel must be **buffered (1)** so the loop's send completes even after the caller bailed.
- **`Close` that returns before the loop exits.** Use `sync.Once` to close `done` once and block on `stopped` — otherwise `Close` races the goroutine and leak-tests flake.
- **Amend-up keeping priority.** Reject it (or model as cancel+resubmit); silently keeping priority is a fairness bug.
- **Trusting a single `-race` pass.** Repeat under `-race -count=N` with load variation; concurrency correctness is a distribution, not one sample.


## Message Bus — At-Least-Once Delivery, Ack/Nack, Prefetch & Dead-Letter

### Summary

**What this topic covers**
You build an in-memory message broker that models RabbitMQ's delivery semantics: topic routing (exact + a single-level trailing wildcard `markets.*`), bounded per-consumer queues, manual `Ack`/`Nack` with redelivery, per-consumer **prefetch** (QoS) backpressure, ack-timeout redelivery off an injected clock, and dead-lettering of poison messages. The headline guarantee is **at-least-once delivery**: a message is not done when it leaves the queue, only when the consumer acks it — so it can be delivered *more than once*, and a consumer that moves money must be idempotent. The trap is that "exactly-once" is a fantasy over an unreliable channel, and the whole design forces you to model redelivery as a feature and dedupe as the consumer's job. Every delivery channel is owned by the broker and must be closed exactly once.

**Mental model**
Think AMQP: publisher → **exchange** → **binding** → **queue** → consumer. This broker collapses exchange+binding into `Publish` (the topic is the routing key) and gives each `Subscribe` its own queue fed by one dispatcher goroutine. That dispatcher is the *only* goroutine that sends on and closes the delivery channel — this is what makes "close exactly once, only the owner closes" true and kills send-on-closed panics. All mutable queue state (FIFO, inflight set, dead-letter slice) lives behind one `sync.Mutex`; the dispatcher and the ack/nack callbacks mutate it under the lock, then fire a capacity-1 `wake` channel as an edge-triggered "state changed" nudge. No lock is ever held across the channel send to the consumer. At-least-once falls straight out of manual ack: a delivery stays *unacked* (the broker still owns it) until `Ack`; a crash, a `Nack(true)`, or an ack-timeout means redeliver. Prefetch caps how many unacked deliveries are outstanding — the backpressure that paces a fast producer to a slow consumer instead of leaking memory.

**Key terms**
- **at-least-once** — every accepted message is delivered one or more times; never lost, possibly duplicated.
- **Ack / Nack(requeue)** — consumer confirms processing; `Nack(true)` redelivers, `Nack(false)` dead-letters.
- **idempotent consumer** — dedupes side effects on `Message.ID` so a redelivery doesn't pay a winner twice.
- **prefetch / QoS** — max unacked deliveries outstanding per consumer; the backpressure knob.
- **dead-letter queue (DLQ)** — parking lot for poison messages that exceed `maxRetries` or are rejected.
- **redelivery count** — `Delivery.Redelivered`: 1 on first delivery, +1 each redelivery.
- **dispatcher goroutine** — the single owner that sends on and closes `out`, exactly once.
- **ack-timeout** — unacked-past-deadline delivery treated as `Nack(true)`, measured against an **injected clock**.
- **generation guard** — each dispatch bumps `p.gen`; a stale (timed-out) delivery's late ack is a no-op.
- **shed-on-full** — `Publish` to a full queue returns `ErrQueueFull` rather than blocking the publisher.
- **close-once** — `sync.Once` + owner-only close; concurrent `Publish`/`Subscribe` racing `Close` get `ErrClosed`, never a panic.

**Why interviewers ask this**
It's the richest concurrency kata: a junior wires channels and calls it done; a senior reasons about *ownership and obligation*. The signal is whether you know at-least-once forces consumer idempotency (and *why* exactly-once is impossible without a distributed transaction), whether prefetch is framed as backpressure vs. a memory leak, whether redelivery is bounded so a poison message can't loop forever, and whether the delivery channel is closed exactly once from the owning goroutine. It also probes deterministic testing: driving ack-timeout off a fake clock instead of `time.Sleep`, and proving no-message-lost under `-race -count=N`.

**Common confusions**
- "Ack means received" → no, ack means *processed*; the broker owns it until then.
- "Redelivery is a bug" → it's the mechanism that makes delivery lossless; duplicates are the price.
- "Exactly-once fixes it" → it doesn't exist over an unreliable channel; dedupe on the consumer instead.
- "Prefetch is a perf tuning knob" → it's a correctness/backpressure control; without it a slow consumer OOMs.
- "The consumer closes the channel when done" → the *broker* owns and closes it, exactly once.

**What follows from this topic**
This is the capstone that ties together several smaller katas: [[go-pricecache]] (RWMutex read-modify-write), [[blockingqueue]] (bounded backpressure), [[go-shutdown]] (graceful vs. abandon shutdown — this broker *abandons* on Close), [[idempotency]] and [[retry]] (the money-safe consumer), and [[eventbus]] (fan-out routing). Push further with competing consumers (fair round-robin over one queue) or multi-level `a.#` wildcards.

### Clarify & design the API

Ask before coding: *At-least-once or best-effort?* (at-least-once). *What happens to a full queue — block or shed?* (shed with `ErrQueueFull`). *Who closes the delivery channel?* (the broker, exactly once). *Does Close drain or abandon?* (abandon — graceful drain is a different kata). *Real time or injectable?* (inject the clock so ack-timeout is deterministic). *Wildcard depth?* (single-level trailing `.*` only).

Commit to the public surface first; design every private type yourself.

```go
type Message struct{ ID, Topic string; Body []byte } // ID = idempotency key

type Delivery struct {
    Message     Message
    Redelivered int // 1 on first delivery, +1 each redelivery
    // unexported: queue back-ref + once-guarded ack callback
}
func (d *Delivery) Ack()               // idempotent
func (d *Delivery) Nack(requeue bool)  // idempotent

func New(opts ...Option) *Broker
func (b *Broker) Publish(topic string, m Message) error            // ErrClosed / ErrQueueFull
func (b *Broker) Subscribe(topic string, opts ...Option) (<-chan Delivery, func())
func (b *Broker) DeadLettered() []Message
func (b *Broker) Close() error

// Options: WithPrefetch(n), WithMaxRetries(n), WithQueueSize(n),
//          WithAckTimeout(d), WithClock(func() time.Time)
var ErrClosed, ErrQueueFull error
```

The delivery channel is `<-chan Delivery` (receive-only) — the consumer can never close it. `Subscribe` returns an idempotent `unsubscribe func()`. Note the deliberate asymmetry: `Publish` is non-blocking (shed), while dispatch to the consumer *is* paced by prefetch. Each `Subscribe` gets its own queue + dispatcher, so subscriptions are independent.

### Write the tests first — routing & the ack/nack contract

The practice side ships **no tests on purpose** — designing them is the exercise. Write tests before the implementation, smallest contract first. Two helpers make the whole suite deterministic: `recv(t, ch)` (receive one delivery or fail on a generous 2s deadlock guard) and `expectNoDelivery(t, ch)` (assert nothing arrives in ~50ms — this is how you *prove a negative*, e.g. prefetch withholding or a non-match).

Start with routing, then the ack/nack redelivery contract — the semantic core:

```go
func TestNack_Requeue_RedeliversAndIncrementsCount(t *testing.T) {
    b := New(WithPrefetch(1), WithMaxRetries(5))
    defer b.Close()
    ch, unsub := b.Subscribe("t"); defer unsub()

    b.Publish("t", Message{ID: "r", Topic: "t"})
    d1 := recv(t, ch)
    if d1.Redelivered != 1 { t.Fatalf("first = %d, want 1", d1.Redelivered) }
    d1.Nack(true) // requeue → redeliver

    d2 := recv(t, ch)
    if d2.Message.ID != "r" || d2.Redelivered != 2 {
        t.Fatalf("got %q/%d, want r/2", d2.Message.ID, d2.Redelivered)
    }
    d2.Ack()
}

func TestAck_Idempotent_NoRedelivery(t *testing.T) {
    b := New(WithPrefetch(1)); defer b.Close()
    ch, unsub := b.Subscribe("t"); defer unsub()
    b.Publish("t", Message{ID: "a", Topic: "t"})
    d := recv(t, ch); d.Ack()
    d.Ack(); d.Nack(true)        // double-ack / ack-then-nack: harmless no-ops
    expectNoDelivery(t, ch)      // acked message must NOT come back
}
```

Why each matters: the routing tests (exact + `markets.*` matches `markets.tennis` but **not** `markets.tennis.live` nor bare `markets`) pin the binding rule. The redelivery test proves `Nack(true)` re-dispatches and `Redelivered` increments — the thing that turns the bus into at-least-once. The idempotency test proves `Ack`/`Nack` are once-only, so an accidental double-ack can't corrupt the queue's inflight accounting. Add `TestNack_NoRequeue_DeadLettersImmediately` for the reject path and `TestFIFO_OrderingWithinQueue` for in-queue order. Run everything with `go test -race ./messagebus/`.

### Write the tests — prefetch backpressure

Prefetch is the backpressure invariant, and `expectNoDelivery` is what lets you assert it — you're proving the `N+1`th message is *held back* until a slot frees:

```go
func TestPrefetch_CapsInFlightUntilAck(t *testing.T) {
    b := New(WithPrefetch(2), WithMaxRetries(5), WithQueueSize(16))
    defer b.Close()
    ch, unsub := b.Subscribe("t"); defer unsub()

    for _, id := range []string{"m1", "m2", "m3"} {
        b.Publish("t", Message{ID: id, Topic: "t"})
    }
    d1, d2 := recv(t, ch), recv(t, ch)      // prefetch=2 → exactly two flow
    if d1.Message.ID != "m1" || d2.Message.ID != "m2" {
        t.Fatalf("got %q,%q want m1,m2 (FIFO)", d1.Message.ID, d2.Message.ID)
    }
    expectNoDelivery(t, ch)                 // m3 withheld: cap holds

    d1.Ack()                                // free ONE slot
    d3 := recv(t, ch)
    if d3.Message.ID != "m3" { t.Fatalf("got %q, want m3", d3.Message.ID) }
    expectNoDelivery(t, ch)                 // still capped at 2 in flight
    d2.Ack(); d3.Ack()
}
```

This catches the two classic bugs: a broker with no cap dumps all three immediately (memory-leak-under-load), and a broker that miscounts inflight either wedges forever or releases too many. The key subtlety a senior tests: an ack frees **exactly one** slot, not the floodgates. Also test that `Publish` to a full queue (ready + inflight ≥ capacity) returns `ErrQueueFull` — the shed policy — since prefetch and queue capacity interact.

### Write the tests — dead-letter, ack-timeout & the idempotent consumer

Poison messages must stop looping; the DLQ bounds the blast radius to `maxRetries+1` attempts:

```go
func TestDeadLetter_AfterMaxRetries(t *testing.T) {
    const maxRetries = 2
    b := New(WithPrefetch(1), WithMaxRetries(maxRetries)); defer b.Close()
    ch, unsub := b.Subscribe("t"); defer unsub()

    b.Publish("t", Message{ID: "poison", Topic: "t"})
    for attempt := 1; attempt <= maxRetries+1; attempt++ {
        d := recv(t, ch)
        if d.Redelivered != attempt { t.Fatalf("attempt %d: got %d", attempt, d.Redelivered) }
        d.Nack(true)                        // attempts 1,2,3 — 3 > cap → DLQ
    }
    expectNoDelivery(t, ch)                 // now poison, never redelivered
    if dl := b.DeadLettered(); len(dl) != 1 || dl[0].ID != "poison" {
        t.Fatalf("DeadLettered = %+v, want [poison]", dl)
    }
}
```

Ack-timeout is driven off the **injected clock** — no `time.Sleep` for logic. Store nanos in an `atomic.Int64`, hand `New` a `WithClock` closure that reads it, publish, `recv` (don't ack), advance the clock past the timeout, then `recv` again and assert `Redelivered == 2`. The original delivery's late `Ack()` must be a **no-op** (the generation guard superseded it). That's the stale-ack safety proof.

Then the money-angle test — the whole point of at-least-once:

```go
func TestIdempotentConsumer_DedupesRedelivery(t *testing.T) {
    b := New(WithPrefetch(1)); defer b.Close()
    ch, unsub := b.Subscribe("settle"); defer unsub()
    var payouts atomic.Int64
    seen := map[string]bool{}
    process := func(d Delivery) {
        if seen[d.Message.ID] { d.Ack(); return } // already settled: just ack
        payouts.Add(1); seen[d.Message.ID] = true; d.Ack()
    }
    b.Publish("settle", Message{ID: "bet-42", Topic: "settle"})
    d1 := recv(t, ch)
    payouts.Add(1); seen[d1.Message.ID] = true      // did work...
    d1.Nack(true)                                    // ...but lost the ack → redeliver
    process(recv(t, ch))                             // dedupe: must NOT pay twice
    if payouts.Load() != 1 { t.Fatalf("payouts=%d, want 1", payouts.Load()) }
}
```

### Write the tests — the `-race` stress test

A single green `-race` run is **not** proof of a correct concurrent design. Run the stress test repeatedly and vary load: `go test -race -count=20 ./messagebus/`. Drive one broker with many publishers and several consumers across a few topics, consumers acking most deliveries and `Nack(true)`-ing some to force redelivery and dead-lettering — all concurrent with `Close`.

The invariant is **no accepted message is lost**: the set of IDs acked-or-dead-lettered must eventually cover every ID the broker accepted (`err == nil`). Duplicates are allowed (at-least-once); `ErrQueueFull` sheds were never accepted, so they're not owed.

```go
func TestBroker_RaceStress(t *testing.T) {
    if testing.Short() { t.Skip("run without -short, ideally -race -count=N") }
    baseline := runtime.NumGoroutine()
    b := New(WithQueueSize(8), WithPrefetch(2), WithMaxRetries(2))

    var acked, published sync.Map // sync.Map: read coverage while consumers run
    var consumerWG sync.WaitGroup
    for c := 0; c < 4; c++ {
        ch, _ := b.Subscribe(fmt.Sprintf("t.%d", c))
        consumerWG.Add(1)
        go func() {
            defer consumerWG.Done()
            n := 0
            for d := range ch {          // ranges until broker closes the channel
                n++
                if n%5 == 0 && d.Redelivered <= 2 { d.Nack(true); continue }
                acked.Store(d.Message.ID, struct{}{}); d.Ack()
            }
        }()
    }
    // ... publishers Store accepted IDs into `published`, count ErrQueueFull as shed ...

    // Drain to quiescence BEFORE Close, then assert coverage; poll with a hard
    // watchdog. Missing IDs after the deadline = genuine delivery loss/hang.
    // Close has ABANDON semantics — asserting coverage after it would flag
    // deliberately-dropped queued messages as "lost".
    b.Close()                        // races in-flight consumers + unsubscribes
    consumerWG.Wait()
    if got := waitForGoroutines(baseline); got > baseline {
        t.Errorf("goroutine leak: baseline %d, got %d", baseline, got)
    }
}
```

Three things this catches that unit tests can't: (1) a data race on the queue's shared state (the detector fires); (2) a **send-on-closed-channel panic** when `Close` races a live dispatch; (3) a **goroutine leak** — every dispatcher must exit and every consumer's `range` must terminate on channel close. Critical design point: **drain to quiescence while the broker is live, then assert coverage, then Close.** Asserting after Close would mislabel messages that Close legitimately abandons as lost — separating a real delivery-loss bug from correct shutdown abandonment.

### Implement it

Broker holds `sync.RWMutex` over `subs map[*subscription]struct{}` + a `closed` bool + `closeOnce sync.Once`. `Publish` takes the read lock, snapshots matching queues, releases, then publishes **outside the lock** so a slow queue can't stall other publishers. `topicMatches` handles exact then `prefix.*` (the trailing segment must be non-empty and contain no dot).

Each queue is a bounded FIFO of `*pending{msg, attempts, inflight, deadline, gen}` behind one `sync.Mutex`, drained by a single `dispatch` goroutine — **the only place that sends on and closes `out`.** The loop: lock, expire ack-timeouts, compute the next eligible message under the prefetch cap (`inflight >= prefetch` → dispatch nothing), unlock, then `select` on sending to `out` vs. `<-done`. When nothing's dispatchable it blocks on `wake`/`done`/a poll timer. The **wake channel** (capacity 1, non-blocking send) coalesces bursts into one re-evaluation — simpler than a `sync.Cond`, and it never holds the lock across a send.

`Ack`/`Nack` route through a `sync.Once`-guarded, **generation-captured** callback: `settle` only runs if `p.gen == gen && p.inflight`, so a redelivered message's stale old delivery is inert. `settle` decrements inflight, then acks (drop), dead-letters (`!requeue`, or `attempts > maxRetries`), or requeues to the FIFO front — then nudges. Ack-timeout uses a **real** `pollInterval` timer but re-checks deadlines against the **injected** clock each tick, so a fake clock that jumps instantly is still honoured deterministically. `close` sets `closed`, closes `done`, and `wg.Wait()`s the dispatcher before the deferred `close(out)` fires — the happens-before that guarantees no send races the close.

### Common mistakes & senior signal

The README's traps, and what a senior does:

- **Consumer closes the channel** → panic city. Only the owning dispatcher closes `out`, guarded so it happens exactly once. Consumers get `<-chan` and can't close it.
- **`close(out)` racing a live send** → send-on-closed panic. Serialize with `wg.Wait()` after `close(done)`: the dispatcher's `select` sees `done`, returns, *then* the deferred `close(out)` runs — no send is in flight.
- **Double `Close` / double unsubscribe** → `sync.Once` at both broker and subscription level makes them idempotent no-ops.
- **Non-idempotent ack** → a double-ack corrupts inflight counting and wedges prefetch. Guard with `sync.Once` + generation, so late/duplicate acks are silent no-ops.
- **Blocking publish on a full queue** → couples publisher latency to the slowest consumer and can deadlock under a held lock. Shed with `ErrQueueFull`; push the load decision to the caller.
- **Unbounded redelivery** → a poison message loops forever. Cap at `maxRetries`, then dead-letter.
- **`time.Sleep` in ack-timeout tests** → flaky and slow. Inject the clock; advance it explicitly.
- **Assuming exactly-once** → the senior states plainly it doesn't exist over an unreliable channel and makes the consumer dedupe on `Message.ID` (processed-set: if seen, ack; else do work, record, ack).
- **`for v := range ch`, `defer wg.Done()`, guard the whole read-modify-write, `-race -count=N`** — the reflexes. One green race run proves nothing; repetition under contention does.


## Ledger / Wallet — Lost Updates, Idempotency & Deadlock-Free Transfers

### Summary

**What this topic covers**
This is the money store for the betting platform: customer wallets backed by a double-entry ledger, correct under concurrent access. You build a `Ledger` supporting `Open`, `Balance`, `Deposit`, `Withdraw`, and `Transfer`, plus a `CheckInvariant` that asserts the books reconcile. Correctness — not throughput — is the whole point: a single wrong penny is a real loss and an audit failure. Four hazards all live in this one small type: **lost updates** (crediting is a read-modify-write; two goroutines interleaving their RMW silently drop one), **idempotency** (an at-least-once "settle bet" command arriving twice must not pay out twice), **deadlock** (a transfer locks two accounts, so `A→B` racing `B→A` can hang forever), and **conservation** (money only moves, never appears or vanishes). The trap the interviewer is really watching for is whether you lock the *whole* RMW, make the dedupe-check-and-mutation one atomic critical section, and impose a total lock order.

**Mental model**
Every mutation is a read-modify-write on a balance. Correctness requires the read, the decision (funds check / dedupe check), the mutation, and the audit posting to be one indivisible critical section — hold the account's own mutex across all of it. A single-account op locks one account; a transfer locks *two*. Two locks is where deadlock breeds: if each transfer locks source-then-destination, opposing transfers each grab one lock and wait on the other forever. The fix is a **total order** — always acquire the lower account id's lock first, regardless of transfer direction — so no waits-for cycle can form. Money is integer minor units (pence), never `float64`. Conservation is structural: every operation writes balanced signed entries, so transfer postings across the whole ledger net to exactly zero.

**Key terms**
- **read-modify-write (RMW)** — read balance, compute, write back; must be atomic under one lock or updates are lost
- **lost update** — two RMWs interleave, both read 100, both write 150, final is 150 not 200
- **idempotency key** — a per-command id; first application takes effect and its outcome is remembered, later ones replay it as a no-op
- **TOCTOU** — time-of-check-to-time-of-use; the check ("seen this key?") and the use ("apply + mark seen") must be one critical section
- **total lock ordering** — acquire multiple locks in a globally consistent order (sorted id) to make deadlock impossible
- **waits-for cycle** — the graph condition for deadlock; a consistent lock order breaks it
- **double-entry posting** — every movement records balanced signed entries summing to zero
- **conservation invariant** — sum of all transfer postings across the ledger is exactly zero
- **`sync.RWMutex`** — guards the account-map (find/create); never held across a balance mutation
- **per-account `sync.Mutex`** — guards one account's balance, seen-set, and entries together
- **minor units** — integer pence/cents; float money math is wrong by construction

**Why interviewers ask this**
It bundles four canonical concurrency bugs into one realistic domain, so it separates candidates fast. A junior locks the read but not the write (or vice versa) and loses updates; checks idempotency under one lock and mutates under another (TOCTOU); locks `from` then `to` and deadlocks; or reaches for `float64` and drifts pennies. A senior holds the account lock across the *entire* RMW, folds the dedupe check into the same critical section, sorts the two transfer locks by id, keeps money in integers, and — critically — proves it: they write the lost-update test, the concurrent-duplicate test, the opposing-transfer deadlock test (with a watchdog, not a sleep), and run them under `-race -count=N`. Saying "it works" after one green run is the junior tell; treating a single `-race` pass as insufficient is the senior tell.

**Common confusions**
- "I locked the write, so it's safe" → no; locking only the write still loses updates because two goroutines read the same stale balance. Lock the whole RMW.
- "Check-seen then apply under separate locks is fine" → no; two duplicates both pass the check before either marks seen, and both apply. One critical section.
- "Lock from, then to" → deadlocks under opposing transfers. Sort by id, lower first.
- "A green `-race` run proves it" → no; race detection is probabilistic. Repeat under `-count` and vary load.
- "Freeze the whole ledger in `CheckInvariant`" → unnecessary; the invariant is structural, so a per-account-consistent snapshot suffices.

**What follows from this topic**
The pessimistic per-account mutex maps directly onto SQL: `SELECT ... FOR UPDATE` is the row lock, and ordering the locked rows is the same deadlock fix. The extension swaps the lock for an optimistic `version` CAS (`UPDATE ... WHERE version = ?`, retry on zero rows) — the same concurrency problem, lock-free. The idempotency discipline recurs in the settlement pipeline and bet gateway katas; the total-lock-order lesson recurs anywhere two resources are held at once.

### Clarify & design the API

Ask first: **Money type?** Integer minor units (pence) — never `float64`; state it and move on. **Idempotency scope** — dedupe per key, and does a repeated key replay the *original outcome* including rejections? (Yes: a retried overdraw must reject identically, not race a now-funded account.) **Concurrency** — fully concurrent, many goroutines, must be `-race` clean. **Overdraw** — wallets never go negative.

Commit to the exported surface before writing any logic. The `Account`/`Entry` structs and `Err*` sentinels are given; you design all internals — storage, locking, the idempotency record, the audit trail.

```go
type Ledger struct { /* unexported */ }

func New() *Ledger
func (l *Ledger) Open(id string, initial int64) error
func (l *Ledger) Balance(id string) (int64, error)
func (l *Ledger) Deposit(idemKey, id string, amount int64) error
func (l *Ledger) Withdraw(idemKey, id string, amount int64) error
func (l *Ledger) Transfer(idemKey, from, to string, amount int64) error
func (l *Ledger) Entries(id string) []Entry
func (l *Ledger) CheckInvariant() error

var (
	ErrInsufficientFunds = errors.New("ledger: insufficient funds")
	ErrUnknownAccount    = errors.New("ledger: unknown account")
	ErrAccountExists     = errors.New("ledger: account already exists")
	ErrSameAccount       = errors.New("ledger: cannot transfer to the same account")
)
```

Internally: a `Ledger.mu sync.RWMutex` guards the `map[string]*account` used **only** to find/create accounts — never held across a balance mutation, so ops on different accounts run fully parallel. Each `*account` carries its own `mu sync.Mutex`, a `balance int64`, a `seen map[string]outcome` (idempotency record), and an `entries []Entry` audit slice. The seen-set living *on the account* under the *same* lock as the balance is the design decision that makes the dedupe check and the mutation inseparable.

### Write the tests

The practice side ships **no tests on purpose** — designing them is the exercise. Write them first, staged: contract → idempotency → the concurrency proofs. Each concurrency test uses a `close(start)` gate so goroutines fire simultaneously, and the deadlock test guards against a hang with a `done` channel + `select`/`time.After` — **never** a sleep.

**Contract (table-driven).** Open/duplicate, balance/unknown, deposit+withdraw, overdraw rejection, transfer happy-path (assert `CheckInvariant`), same-account and overdraw rejection.

```go
func TestWithdrawInsufficientFunds(t *testing.T) {
	l := New()
	l.Open("alice", 100)
	if err := l.Withdraw("w1", "alice", 101); !errors.Is(err, ErrInsufficientFunds) {
		t.Fatalf("err = %v, want ErrInsufficientFunds", err)
	}
	if bal, _ := l.Balance("alice"); bal != 100 {
		t.Fatalf("balance changed on rejected withdraw: %d", bal)
	}
}
```

**Idempotency.** Apply the same key 5× sequentially → one effect. The subtle one: a rejected withdraw replayed after funding must *still reject* — the command was already answered.

```go
func TestWithdrawIdempotentReplaysRejection(t *testing.T) {
	l := New()
	l.Open("alice", 50)
	first := l.Withdraw("k", "alice", 100)          // ErrInsufficientFunds
	l.Deposit("fund", "alice", 1000)                 // now funded
	second := l.Withdraw("k", "alice", 100)          // same key → same rejection
	if !errors.Is(first, ErrInsufficientFunds) || !errors.Is(second, ErrInsufficientFunds) {
		t.Fatalf("replay must reject identically: %v, %v", first, second)
	}
	if bal, _ := l.Balance("alice"); bal != 1050 {
		t.Fatalf("balance = %d, want 1050 (only the deposit took effect)", bal)
	}
}
```

**No lost updates.** G goroutines each deposit +1, N times, with **distinct** keys → balance must be exactly `G*N`. Catches a half-locked RMW.

**Concurrent duplicate deposits.** Many goroutines deliver the *same* key at once → exactly one effect. Catches the TOCTOU on the seen-set that the sequential idempotency test cannot.

```go
func TestConcurrentDuplicateDeposits_OneEffect(t *testing.T) {
	l := New()
	l.Open("alice", 0)
	var wg sync.WaitGroup
	start := make(chan struct{})
	for g := 0; g < 32; g++ {
		wg.Add(1)
		go func() { defer wg.Done(); <-start; _ = l.Deposit("dup-key", "alice", 100) }()
	}
	close(start)
	wg.Wait()
	if bal, _ := l.Balance("alice"); bal != 100 {
		t.Fatalf("duplicate concurrent deposits = %d, want 100", bal)
	}
}
```

**Deadlock-free opposing transfers.** Half the goroutines push `A→B`, half `B→A`, simultaneously — a naive lock-from-then-to hangs here. Watchdog, not sleep; then assert conservation.

```go
func TestDeadlockFreeTransfers(t *testing.T) {
	l := New()
	l.Open("A", 1_000_000); l.Open("B", 1_000_000)
	var wg sync.WaitGroup
	start := make(chan struct{})
	for g := 0; g < 16; g++ {
		wg.Add(1)
		dir := g % 2
		go func(g, dir int) {
			defer wg.Done(); <-start
			for i := 0; i < 500; i++ {
				key := fmt.Sprintf("g%d-i%d", g, i)
				if dir == 0 { _ = l.Transfer(key, "A", "B", 1) } else { _ = l.Transfer(key, "B", "A", 1) }
			}
		}(g, dir)
	}
	close(start)
	done := make(chan struct{})
	go func() { wg.Wait(); close(done) }()
	select {
	case <-done:
	case <-time.After(30 * time.Second):
		t.Fatal("transfers did not complete: likely deadlock") // watchdog only, not synchronisation
	}
	balA, _ := l.Balance("A"); balB, _ := l.Balance("B")
	if balA+balB != 2_000_000 {
		t.Fatalf("money not conserved: total=%d, want 2000000", balA+balB)
	}
	if err := l.CheckInvariant(); err != nil { t.Fatalf("invariant broken: %v", err) }
}
```

**The `-race` conservation stress test.** The capstone: a worker pool hammers a shared pool of accounts with a mix of deposits, withdrawals, and opposing transfers, each op's key replayed a second time (must be a no-op). No shared mutable counters — each worker returns its own net external flow, merged after. Assert total balance equals `startTotal + Σ netExternal` (transfers cancel), and `CheckInvariant`.

```go
func TestLedger_RaceStress(t *testing.T) {
	if testing.Short() { t.Skip("run under -race -count=N, not -short") }
	const nAccounts, initial, iters = 8, 1_000_000, 300
	workers := 16 * runtime.GOMAXPROCS(0)
	if workers < 32 { workers = 32 }
	l := New()
	acct := func(i int) string { return fmt.Sprintf("acc-%02d", i) }
	for i := 0; i < nAccounts; i++ { l.Open(acct(i), initial) }
	startTotal := int64(nAccounts) * initial
	netExternal := make([]int64, workers) // per-worker: no shared counters

	start := make(chan struct{})
	var wg sync.WaitGroup
	for w := 0; w < workers; w++ {
		w := w; wg.Add(1)
		go func() {
			defer wg.Done(); <-start
			var net int64
			for i := 0; i < iters; i++ {
				a := (w + i) % nAccounts
				b := (w + i + 1 + i%(nAccounts-1)) % nAccounts
				key := fmt.Sprintf("k-%d-%d", w, i)
				amt := int64(1 + (w*7+i)%50)
				switch (w + i) % 4 {
				case 0:
					l.Deposit(key, acct(a), amt)
					l.Deposit(key, acct(a), amt) // replay: no-op
					net += amt
				case 1:
					err := l.Withdraw(key, acct(a), amt)
					l.Withdraw(key, acct(a), amt) // replay: same outcome
					if err == nil { net -= amt }
				default:
					l.Transfer(key, acct(a), acct(b), amt)
					l.Transfer(key, acct(a), acct(b), amt) // replay + opposing dirs
				}
			}
			netExternal[w] = net
		}()
	}
	done := make(chan struct{})
	go func() { wg.Wait(); close(done) }()
	close(start)
	select {
	case <-done:
	case <-time.After(30 * time.Second): t.Fatal("deadlock: workers did not finish")
	}
	var wantDelta, total int64
	for _, n := range netExternal { wantDelta += n }
	for i := 0; i < nAccounts; i++ { bal, _ := l.Balance(acct(i)); total += bal }
	if want := startTotal + wantDelta; total != want {
		t.Fatalf("conservation violated: total=%d want=%d", total, want)
	}
	if err := l.CheckInvariant(); err != nil { t.Fatalf("CheckInvariant: %v", err) }
}
```

Run it: `go test -race -count=10 ./ledger/`. One green pass is not proof — the race detector is probabilistic, so repeat under `-count` and vary `workers`/`iters`. This is the single test that would have caught every one of the four bugs, and the assertion that money is neither created nor destroyed is the one an auditor cares about.

### Implement it

The synchronisation choice is a **per-account `sync.Mutex`**, held across the entire read-modify-write. Not `atomic` (the check-and-mutate spans a funds decision and a seen-set write — not a single word), not a channel (no ownership-transfer or fan-in here; it's shared mutable state guarded by a lock). The ledger-level `RWMutex` guards *only* map lookup/insert and is released before any balance work.

Deposit is the whole pattern in one place — dedupe check, RMW, and posting all under one lock:

```go
func (l *Ledger) Deposit(idemKey, id string, amount int64) error {
	a, err := l.find(id) // RLock the map, release
	if err != nil { return err }
	a.mu.Lock()
	defer a.mu.Unlock()
	if o, ok := a.seen[idemKey]; ok { return o.err } // duplicate: replay outcome, no effect
	a.balance += amount
	a.entries = append(a.entries, Entry{ID: idemKey, AccountID: id, Amount: amount, Ref: "deposit"})
	a.seen[idemKey] = outcome{err: nil}
	return nil
}
```

The happens-before reasoning: the seen-check, the balance write, and the seen-record all sit inside one `a.mu` critical section, so no duplicate delivery and no concurrent RMW can slip between them. Withdraw is identical but records the *rejection* against the key too, so a retry replays it.

Transfer is the deadlock-critical piece. Reject same-account up front (it would also deadlock a naive impl by locking the same mutex twice). Find both accounts, then acquire the two locks in **sorted-id order** — the total order that makes a waits-for cycle impossible:

```go
first, second := src, dst
if first.id > second.id { first, second = second, first }
first.mu.Lock();  defer first.mu.Unlock()
second.mu.Lock(); defer second.mu.Unlock()

if o, ok := src.seen[idemKey]; ok { return o.err }
if src.balance < amount { /* record rejection under key */ return errInsufficient }
src.balance -= amount; dst.balance += amount
src.entries = append(src.entries, Entry{ID: idemKey, AccountID: from, Amount: -amount, Ref: "transfer:from"})
dst.entries = append(dst.entries, Entry{ID: idemKey, AccountID: to,   Amount:  amount, Ref: "transfer:to"})
src.seen[idemKey] = outcome{err: nil}
```

The debit (`-amount`) and credit (`+amount`) are a balanced double-entry posting that nets to zero — that is conservation, made structural. Complexity is O(1) per op plus an append; the only allocation is the growing entries slice and seen-map. `CheckInvariant` snapshots accounts under the ledger lock, then locks each in turn (it doesn't freeze the whole ledger — the invariant is structural, not timing-dependent): per-account, entry amounts must sum to balance; globally, `transfer:from`+`transfer:to` postings must net to zero.

### Common mistakes & senior signal

The README's four traps, and the senior move for each:

- **Half-locked RMW.** Locking only the read *or* only the write still loses updates — two goroutines read the same stale balance. Senior: hold `a.mu` across the *entire* read-modify-write, releasing only after the posting is written.
- **TOCTOU on the seen-set.** "Check seen under lock A, release, apply under lock B" lets two duplicates both pass the check before either marks it — both apply, money moves twice. Senior: the dedupe lookup, the mutation, and recording the key's outcome are **one critical section** under the account lock. Put the seen-set on the account, not in a separate globally-locked map.
- **Inconsistent lock order.** "Lock from, then to" deadlocks under `A→B` racing `B→A`. Senior: sort the two locks by id, lower first — a total order under which no waits-for cycle can form. Reject same-account before locking (double-locking one mutex self-deadlocks).
- **Float money.** `0.1 + 0.2 != 0.3`; a penny lost per million settlements fails audit. Senior: integer minor units end-to-end, decimals only at the edges.

The overarching senior signal is the *proof*: writing the lost-update, concurrent-duplicate, and opposing-transfer tests before the implementation, gating them with `close(start)`, guarding the hang with a `done`-channel watchdog rather than a sleep, and running `-race -count=N` — treating a single green race run as necessary but not sufficient. The persistence-layer framing seals it: the per-account mutex is `SELECT ... FOR UPDATE`, ordering locks is `ORDER BY id`, and the optimistic extension is a `version`-column CAS retried on a zero-row update.


## Settlement Pipeline — Staged Bounded Concurrency, Cancel & Short-Circuit

### Summary

**What this topic covers**

When a market settles, every bet on it flows through four stages — **validate → reserve funds → settle → notify**. Each stage runs a *bounded worker pool* and the stages are wired by *bounded channels* so a fast stage can't run away from a slow one (backpressure). You build one reusable generic `Stage[I, O]` and chain four of them, then a `Pipeline.Run` that feeds the bets, collects the notified IDs, and honours three properties *at once*: the caller's context cancellation propagates end-to-end, the first fatal error from any stage short-circuits the whole graph, and on success it drains gracefully — nothing lost, every channel closed exactly once in order, no leaked goroutine. This is the fan-out/fan-in pattern under real pressure: the trap is that "close the channel when done" and "stop on cancel" are each easy alone but interact viciously when a full buffer, a departed consumer, and a `close` all land together.

**Mental model**

A pipeline is producers and consumers joined by channels. Each `Stage` is a fan-out (N workers over one `in`) feeding a fan-in (all workers into one `out`). The two load-bearing rules are **WaitGroup-then-close** and **select-on-`ctx.Done()` on every op**. Only the sole producer of a channel may close it, exactly once, and only after every producer has finished — so each worker `wg.Done()`s on exit and one closer goroutine does `wg.Wait(); close(out)`. Separately, one derived `context` is shared by the feeder and all four stages; cancelling it (caller gave up, *or* first error) unblocks every parked send and receive at once, tearing the graph down through the mechanism every stage already watches. The subtlety: you must select on `ctx.Done()` on the **send** too, not just the receive — a full output buffer with a departed consumer parks a worker forever, its closer's `wg.Wait()` never returns, and the goroutine leaks. Cancel + WaitGroup-then-close together give a prompt, leak-free teardown.

**Key terms**
- **fan-out / fan-in** — N workers reading one input channel (fan-out), all writing one output channel (fan-in).
- **bounded worker pool** — a fixed number of goroutines per stage, capping that stage's concurrency.
- **backpressure** — a bounded output buffer: when the next stage lags, sends block, workers stop pulling, slowness propagates upstream. Memory stays bounded.
- **WaitGroup-then-close** — `wg.Add(N)`; each worker `defer wg.Done()`; one closer does `wg.Wait(); close(out)`. Single owner, exactly once, after the last send.
- **derived context** — `ctx, cancel := context.WithCancel(parent)`; one cancel func tears down every stage.
- **first-error short-circuit** — the errgroup idiom: the first fatal error triggers `cancel()`, stopping siblings instead of letting them grind on.
- **send-side cancellation** — `select { case <-ctx.Done(): return; case out <- v: }` — the guard people forget; without it a full buffer leaks the worker.
- **drain vs abandon** — on success, range every channel to completion (nothing lost); on error/cancel, `cancel()` then drain only enough to unblock workers so closers run.
- **happens-before** — a channel send/close happens-before the corresponding receive; the closer's `wg.Wait()` happens-after every worker's `wg.Done()`, so `close` follows the last send.
- **goroutine leak** — a goroutine parked on a channel op that never completes; the canonical failure of a mis-built pipeline.
- **`context.Canceled`** — the sentinel `ctx.Err()` returns after cancel; surface it rather than a partial result.

**Why interviewers ask this**

It's the capstone concurrency question: it combines fan-out/fan-in, channel-closing discipline, context propagation, and error handling into one graph, and every one of them has to be right simultaneously. A junior wires the four stages and demos the happy path — then leaks goroutines the moment you cancel, or panics with `send on closed channel` under an injected error, or closes `out` from inside a worker. A senior reaches for one reusable `Stage`, states the WaitGroup-then-close invariant unprompted, puts `ctx.Done()` on *both* sides of every channel op, uses a single derived cancel for both cancellation and short-circuit, and — the real tell — writes a `-race -count=N` stress test that asserts goroutine count returns to baseline. They can articulate *why* the send needs the cancel guard, not just that it does.

**Common confusions**
- *"Close the channel inside the last worker."* You don't know which worker is last without a WaitGroup, and closing from more than one panics. Use one closer after `wg.Wait()`.
- *"Selecting on `ctx.Done()` at the receive is enough."* No — a full `out` with a gone consumer parks the *send*. Guard both directions.
- *"An unbounded buffer removes backpressure."* It removes *blocking*, not backpressure — it just lets a fast stage balloon memory until OOM. Keep the bound.
- *"On error just return; the goroutines will finish."* They won't — they're parked on sends nobody reads. You must `cancel()` and drain so their closers run.

**What follows from this topic**

This is where the smaller katas compose. The `Stage` closer is the [[go-venuefanin]] fan-in idiom; the send-side `ctx.Done()` guard is the [[go-shutdown]] leak-free-drain lesson; the single-derived-cancel short-circuit is the errgroup pattern behind [[go-settlement]]. Extensions: per-stage metrics + pprof-driven worker tuning (validate is CPU-bound, reserve/notify IO-bound, so their ideal pool sizes differ), or wrapping a flaky stage's `fn` in retry-with-backoff that still respects `ctx.Done()`.

### Clarify & design the API

Questions to pin down before writing a line of logic:

- **How many stages, and is the shape fixed?** Four here (validate → reserve → settle → notify), each with its own value type. Fixed chain, so I can wire it explicitly rather than build a dynamic DAG.
- **Where do worker/buffer counts come from?** Per-stage knobs. Different stages have different profiles (CPU vs IO), so `[4]int` arrays, not one global number. Non-positive falls back to 1.
- **What does `Run` return?** The notified IDs on success, or the first fatal error. Partial results on cancel? No — surface `ctx.Err()`, don't hand back a half-processed slice.
- **Who owns/closes each channel?** The feeder owns the head channel (sole producer); each `Stage` owns its own `out` and `errc`. One producer, one closer, everywhere.
- **Buffered or unbounded?** Bounded — the bound *is* the backpressure. Non-negotiable.

Commit to a single reusable generic building block and a thin wiring struct:

```go
// Stage: N workers apply fn over in, emit results to a bounded out and errors to errc.
// Stage owns and closes both, exactly once, after every worker returns.
func Stage[I, O any](
    ctx context.Context,
    in <-chan I,
    workers, buffer int,
    fn func(context.Context, I) (O, error),
) (<-chan O, <-chan error)

type StageFuncs struct {
    Validate func(context.Context, Bet) (Validated, error)
    Reserve  func(context.Context, Validated) (Reserved, error)
    Settle   func(context.Context, Reserved) (Settled, error)
    Notify   func(context.Context, Settled) (Notified, error)
}

type Pipeline struct { /* fns, workers [4]int, buffers [4]int */ }

func New(fns StageFuncs, workers, buffers [4]int) *Pipeline
func (p *Pipeline) Run(ctx context.Context, bets []Bet) ([]string, error)
```

The receive-only return types (`<-chan O`, `<-chan error`) are deliberate: the caller can only drain, never send or close — the type system enforces single-ownership. Injecting `StageFuncs` is what makes this testable: production hits real services; tests force errors, slowness, or instrument concurrency by swapping one function.

### Write the tests

This is the heart. The practice side ships **no tests** on purpose — designing the tests that expose the bugs is the exercise. Write them first, smallest contract outward, ending in a `-race` stress test. Run everything with `go test -race ./settlepipeline/`.

**Helpers first** — a leak check and an identity pipeline so each test overrides only the stage it cares about:

```go
// Polls NumGoroutine down to baseline; only gives the scheduler time to reap
// goroutines already returning — it does NOT synchronise the logic under test.
func waitForGoroutines(want int) int {
    got := runtime.NumGoroutine()
    for i := 0; i < 200 && got > want; i++ {
        runtime.Gosched()
        time.Sleep(time.Millisecond)
        got = runtime.NumGoroutine()
    }
    return got
}

func identityFuncs() StageFuncs { /* each stage passes the bet straight through */ }
func makeBets(n int) []Bet     { /* bet-0 .. bet-(n-1) */ }
```

**Group 1 — the happy-path contract.** Every bet in, every ID out exactly once, and no leak afterward. This is the baseline the other tests perturb.

```go
func TestRun_ProcessesAllBets(t *testing.T) {
    baseline := runtime.NumGoroutine()
    const n = 500
    p := New(identityFuncs(), [4]int{4, 4, 4, 4}, [4]int{2, 2, 2, 2})

    got, err := p.Run(context.Background(), makeBets(n))
    if err != nil { t.Fatalf("Run returned error: %v", err) }
    if len(got) != n { t.Fatalf("settled %d, want %d", len(got), n) }

    seen := make(map[string]int, n)
    for _, id := range got { seen[id]++ }          // no drop, no duplicate
    for i := 0; i < n; i++ {
        if c := seen[fmt.Sprintf("bet-%d", i)]; c != 1 {
            t.Fatalf("bet-%d settled %d times, want 1", i, c)
        }
    }
    if g := waitForGoroutines(baseline); g > baseline {
        t.Fatalf("goroutine leak: baseline %d, after %d", baseline, g)
    }
}
```

Catches: lost items, duplicates, and — via the leak check — closers that never run.

**Group 2 — cancellation propagates and stops work.** Gate the settle stage with a single worker, wait until it's parked, cancel, and assert `Run` returns `context.Canceled`, hands back `nil`, *stops* calling settle, and doesn't leak. The single settle worker + `buffer 1` means backpressure holds everything upstream, so `settleCalls` must be well below `n`.

```go
func TestRun_CancellationPropagatesAndStopsWork(t *testing.T) {
    baseline := runtime.NumGoroutine()
    ctx, cancel := context.WithCancel(context.Background())
    gate := make(chan struct{})
    var settleCalls int64

    fns := identityFuncs()
    fns.Settle = func(ctx context.Context, r Reserved) (Settled, error) {
        atomic.AddInt64(&settleCalls, 1)
        select {
        case <-gate:      return Settled{Bet: r.Bet, Payout: r.Reserved}, nil
        case <-ctx.Done(): return Settled{}, ctx.Err()   // stage must watch ctx too
        }
    }
    p := New(fns, [4]int{2, 2, 1, 2}, [4]int{1, 1, 1, 1}) // one settle worker

    const n = 200
    done := make(chan struct{})
    var got []string; var runErr error
    go func() { got, runErr = p.Run(ctx, makeBets(n)); close(done) }()

    for i := 0; i < 1000 && atomic.LoadInt64(&settleCalls) == 0; i++ {
        runtime.Gosched(); time.Sleep(time.Millisecond)   // wait until live at the gate
    }
    cancel()
    <-done

    if !errors.Is(runErr, context.Canceled) { t.Fatalf("got %v, want Canceled", runErr) }
    if got != nil { t.Fatalf("want nil result on cancel, got %v", got) }
    if c := atomic.LoadInt64(&settleCalls); c >= n {
        t.Fatalf("settle kept working after cancel: %d (n=%d)", c, n)
    }
    if g := waitForGoroutines(baseline); g > baseline {
        t.Fatalf("goroutine leak after cancel: %d > %d", g, baseline)
    }
}
```

Catches: cancel that doesn't reach in-flight stages (work continues after the caller gave up), and the send-side leak (goroutines parked forever after cancel).

**Group 3 — first error short-circuits.** One reserve worker; fail `bet-3`. Assert `Run` returns *that* error (`errors.Is`), hands back `nil`, and stops feeding — `reserveCalls < n` proves the pipeline didn't grind through every bet after the failure.

```go
func TestRun_FirstErrorShortCircuits(t *testing.T) {
    baseline := runtime.NumGoroutine()
    wantErr := errors.New("reserve declined: insufficient funds")
    var reserveCalls int64

    fns := identityFuncs()
    fns.Reserve = func(_ context.Context, v Validated) (Reserved, error) {
        atomic.AddInt64(&reserveCalls, 1)
        if v.Bet.ID == "bet-3" { return Reserved{}, wantErr }
        return Reserved{Bet: v.Bet, Reserved: v.Bet.Stake}, nil
    }
    p := New(fns, [4]int{1, 1, 1, 1}, [4]int{1, 1, 1, 1})

    const n = 300
    got, err := p.Run(context.Background(), makeBets(n))
    if !errors.Is(err, wantErr) { t.Fatalf("got %v, want %v", err, wantErr) }
    if got != nil { t.Fatalf("want nil on error, got %v", got) }
    if c := atomic.LoadInt64(&reserveCalls); c >= n {
        t.Fatalf("kept feeding after error: %d calls (n=%d)", c, n)
    }
    if g := waitForGoroutines(baseline); g > baseline {
        t.Fatalf("goroutine leak after error: %d > %d", g, baseline)
    }
}
```

Catches: errors swallowed or wrapped away, results returned alongside an error, and a pipeline that keeps working after a fatal error (no short-circuit).

**Group 4 — bounded concurrency per stage.** Park up to `workers` settle calls, CAS-track the peak, release together, assert the observed max never exceeds the cap. No sleeps — the workers self-release once enough are parked.

```go
func TestRun_BoundedConcurrencyPerStage(t *testing.T) {
    const workers = 4
    var inFlight, maxSeen, entered int64
    release := make(chan struct{}); var once sync.Once

    fns := identityFuncs()
    fns.Settle = func(ctx context.Context, r Reserved) (Settled, error) {
        cur := atomic.AddInt64(&inFlight, 1)
        for {                                        // CAS the running max
            old := atomic.LoadInt64(&maxSeen)
            if cur <= old || atomic.CompareAndSwapInt64(&maxSeen, old, cur) { break }
        }
        if atomic.AddInt64(&entered, 1) >= workers { once.Do(func() { close(release) }) }
        select { case <-release: case <-ctx.Done(): }
        atomic.AddInt64(&inFlight, -1)
        return Settled{Bet: r.Bet, Payout: r.Reserved}, nil
    }
    p := New(fns, [4]int{8, 8, workers, 8}, [4]int{16, 16, 16, 16})

    got, err := p.Run(context.Background(), makeBets(100))
    if err != nil { t.Fatalf("Run error: %v", err) }
    if len(got) != 100 { t.Fatalf("settled %d, want 100", len(got)) }
    if m := atomic.LoadInt64(&maxSeen); m > workers {
        t.Fatalf("observed concurrency %d exceeds cap %d", m, workers)
    }
}
```

Catches: a stage that spawns per-item goroutines instead of a fixed pool (concurrency blows past the cap).

**Group 5 — the `-race` stress test.** The one that actually earns confidence. Many concurrent `Run`s across all three scenario families (success / cancel / injected error), each with its *own* instrumented counters (each pipeline has its own pools, so the cap assertion is per-pipeline). A start gate releases every runner at once; a `WaitGroup` joins them; assert per-stage cap, in-flight returns to zero, and goroutines return to baseline. Run it under `go test -race -count=20 -run RaceStress ./settlepipeline/`.

```go
func TestPipeline_RaceStress(t *testing.T) {
    if testing.Short() { t.Skip("run without -short, ideally -race -count=N") }
    baseline := runtime.NumGoroutine()
    const runners, betsPerRun = 24, 64
    workers := [4]int{2, 3, 2, 4}; buffers := [4]int{4, 4, 4, 4}
    bets := makeBets(betsPerRun)
    errInjected := errors.New("injected settle failure")

    start := make(chan struct{}); var wg sync.WaitGroup
    for r := 0; r < runners; r++ {
        r := r; wg.Add(1)
        go func() {
            defer wg.Done()
            <-start
            var c stageCounters                    // per-Run instrumentation
            switch r % 3 {
            case 0: // success — every ID present
                p := New(instrumented(&c, identityFuncs()), workers, buffers)
                ids, err := p.Run(context.Background(), bets)
                /* assert err==nil, len(ids)==len(bets), all IDs seen */
            case 1: // cancel immediately — must tear down promptly
                p := New(instrumented(&c, identityFuncs()), workers, buffers)
                ctx, cancel := context.WithCancel(context.Background()); cancel()
                _, err := p.Run(ctx, bets)
                if !errors.Is(err, context.Canceled) { t.Errorf("want Canceled, got %v", err) }
            default: // injected settle error
                base := identityFuncs()
                base.Settle = func(context.Context, Reserved) (Settled, error) {
                    return Settled{}, errInjected
                }
                p := New(instrumented(&c, base), workers, buffers)
                _, err := p.Run(context.Background(), bets)
                if !errors.Is(err, errInjected) { t.Errorf("want injected, got %v", err) }
            }
            for s := 0; s < 4; s++ {               // per-stage cap + no in-flight leak
                if m := atomic.LoadInt64(&c.maxSeen[s]); m > int64(workers[s]) {
                    t.Errorf("stage %d concurrency %d > cap %d", s, m, workers[s])
                }
                if cur := atomic.LoadInt64(&c.inFlight[s]); cur != 0 {
                    t.Errorf("stage %d leaked in-flight %d", s, cur)
                }
            }
        }()
    }
    close(start); wg.Wait()
    if g := waitForGoroutines(baseline); g > baseline {
        t.Errorf("goroutine leak: baseline %d, got %d", baseline, g)
    }
}
```

A single green `-race` run is *not* proof — data races and leaks are timing-dependent. Repeat under `-count=20` (or higher) and vary load; that's what turns "passed once" into "correct design". Catches: races on shared state across concurrent Runs, cap violations under contention, and — the big one — leaked goroutines on the cancel and error paths that only surface when many teardowns overlap.

### Implement `Stage` — the reusable building block

Everything hinges on this one function. N workers over one `in`, one shared `out`, and a closer that fires exactly once after the last worker exits.

```go
func Stage[I, O any](
    ctx context.Context, in <-chan I, workers, buffer int,
    fn func(context.Context, I) (O, error),
) (<-chan O, <-chan error) {
    if workers < 1 { workers = 1 }
    out := make(chan O, buffer)
    errc := make(chan error, buffer)

    var wg sync.WaitGroup
    wg.Add(workers)
    for i := 0; i < workers; i++ {
        go func() {
            defer wg.Done()
            for {
                var v I; var ok bool
                select {                          // RECEIVE: cancel or drained-and-closed
                case <-ctx.Done(): return
                case v, ok = <-in:
                    if !ok { return }
                }
                res, err := fn(ctx, v)
                if err != nil {
                    select {                      // SEND err: race ctx — nobody may read errc
                    case <-ctx.Done(): return
                    case errc <- err:
                    }
                    continue
                }
                select {                          // SEND res: race ctx — full out + gone consumer
                case <-ctx.Done(): return
                case out <- res:
                }
            }
        }()
    }
    go func() { wg.Wait(); close(out); close(errc) }()   // single owner, exactly once
    return out, errc
}
```

Why it's correct:

- **WaitGroup-then-close.** The closer's `wg.Wait()` happens-after every worker's `defer wg.Done()`, which happens-after that worker's last send. So `close(out)` provably follows the final send — no send-on-closed panic, no lost queued result. The close lives in exactly one goroutine, so the "second `close` panics" failure is impossible by construction.
- **`ctx.Done()` on every op.** Three channel operations, three guards. The receive guard lets a worker abandon a wait when the pipeline tears down. The *send* guards are the ones people forget: when `out` is full and its consumer has departed (cancel or a sibling's error), a bare `out <- res` parks the worker forever, the closer's `wg.Wait()` never completes, and the goroutine leaks. Racing each send against `ctx.Done()` lets the worker drop its value and return the instant the context cancels.
- **Bounded buffers.** `out` is `cap buffer`. When the next stage lags, sends block, workers stop pulling from `in`, and backpressure walks upstream to the feeder — memory bounded regardless of how fast an early stage produces. An unbounded queue here would just let a fast stage OOM the process.

Cost: `workers` goroutines + 1 closer per stage, `O(buffer)` channel memory, no per-item allocation beyond what `fn` does.

### Implement `Pipeline.Run` — wire, feed, short-circuit, drain

`Run` derives one cancellable context, feeds the bets through a goroutine that owns the head channel, chains four `Stage`s output→input, fans-in the error channels, then consumes results and errors in a single `select`.

```go
func (p *Pipeline) Run(ctx context.Context, bets []Bet) ([]string, error) {
    ctx, cancel := context.WithCancel(ctx)   // ONE derived ctx for feeder + all stages
    defer cancel()

    head := make(chan Bet, p.buffers[0])
    go func() {                               // feeder is head's sole producer → it closes head
        defer close(head)
        for _, b := range bets {
            select {
            case <-ctx.Done(): return
            case head <- b:
            }
        }
    }()

    validated, e0 := Stage(ctx, head,      p.workers[0], p.buffers[0], p.fns.Validate)
    reserved,  e1 := Stage(ctx, validated, p.workers[1], p.buffers[1], p.fns.Reserve)
    settled,   e2 := Stage(ctx, reserved,  p.workers[2], p.buffers[2], p.fns.Settle)
    notified,  e3 := Stage(ctx, settled,   p.workers[3], p.buffers[3], p.fns.Notify)

    errc := mergeErrors(ctx, e0, e1, e2, e3)  // fan the 4 error streams onto one

    ids := make([]string, 0, len(bets))
    for notified != nil || errc != nil {
        select {
        case n, ok := <-notified:
            if !ok { notified = nil; continue }   // notify drained & closed
            ids = append(ids, n.Bet.ID)
        case err, ok := <-errc:
            if !ok { errc = nil; continue }        // all stages done, no error
            if err != nil {
                cancel()                           // first error: tear every stage down
                drain(notified); drainErrors(errc) // unblock workers so closers run
                return nil, err
            }
        }
    }
    if err := ctx.Err(); err != nil { return nil, err }  // caller cancelled mid-flight
    return ids, nil
}
```

The design decisions:

- **One derived cancel does double duty.** Because the derived context is a *child* of the caller's, the caller cancelling propagates automatically. And the first error calls the *same* `cancel()`. Both teardown triggers flow through the one mechanism every stage already selects on — no per-stage signalling to get wrong. This is the errgroup pattern by hand.
- **Set-to-`nil` channel idiom.** A closed channel is always ready, so a naive `select` would busy-spin on it. Setting `notified`/`errc` to `nil` after they close removes that case from the `select` (a nil channel blocks forever), so the loop exits cleanly once both are drained.
- **`mergeErrors`** is a fan-in: one forwarder per stage, each selecting on `ctx.Done()` so a torn-down pipeline can't park it, and a WaitGroup-then-close closer for the merged channel — the same idiom as `Stage`, applied to errors.
- **Drain vs abandon.** Happy path: range `notified` to completion — the feeder closes `head`, each stage drains and WaitGroup-then-closes in order, `notified` closes, the loop ends, nothing lost. Error/cancel path: `cancel()`, then `drain` the remaining channels *only* enough to unblock parked workers so their closers run. Completeness is deliberately traded for a prompt, leak-free shutdown. Either way no goroutine survives a returned `Run`.
- **Surface `ctx.Err()`.** If both channels closed cleanly but the caller cancelled mid-flight, return the cancellation, not a partial slice — a half-processed pipeline is not a success.

### Common mistakes & senior signal

The README's traps, and what a senior does about each:

- **Closing `out` from inside a worker.** You can't know which worker is last without a WaitGroup, and closing from two workers panics on the second `close`. Close early and an in-flight sibling hits send-on-closed (panic) or its result is dropped. *Senior:* `defer wg.Done()` per worker; one closer does `wg.Wait(); close(out)`. Single owner, exactly once, provably after the last send.
- **Only guarding the receive with `ctx.Done()`.** The classic leak. A full `out` with a departed consumer parks the *send* forever; the closer's `wg.Wait()` never returns; the goroutine leaks and the test's `waitForGoroutines` catches it. *Senior:* `select { case <-ctx.Done(): return; case out <- v: }` on **every** send, errc included.
- **Unbounded buffer to "avoid blocking".** Removing the bound removes backpressure's benefit, not backpressure — a fast stage balloons memory ahead of a slow one until OOM. *Senior:* keep the bound; drive the actual numbers from pprof/benchmarks (validate is CPU-bound, reserve/notify IO-bound → different pool sizes).
- **Signalling each stage by hand on error.** Fragile and easy to leave one out. *Senior:* one derived `cancel()`; every stage already watches it. The first error and caller cancellation share the same teardown path.
- **Returning on error without draining.** The workers are parked on sends nobody reads; `return` alone leaks them. *Senior:* `cancel()` then `drain` the remaining channels enough to let each stage's closer run.
- **Trusting one green `-race` run.** Concurrency bugs are timing-dependent; passing once proves nothing. *Senior:* `go test -race -count=N`, vary load, and assert goroutines return to baseline — the habit that separates "compiles and demoed" from "correct under contention".


## In-Memory Caches — TTL, LRU, LFU

### Summary

**What this topic covers**

One package, three caches that a low-latency betting platform leans on constantly: a **concurrency-safe TTL cache** (odds snapshots that go stale after a few hundred ms), an **O(1) LRU** (bounded hot-set of price ladders), and an **O(1) LFU** (whiteboard-only). You build `NewCache(defaultTTL, opts...)` with `Get`/`Set`/`GetOrCompute`/`Close`, a hand-rolled doubly-linked-list LRU, and can sketch the LFU freq-bucket structure. The traps stack up: an `RWMutex` read path that must *never* mutate; a background sweeper that must stop cleanly on `Close` (goroutine leak otherwise); a **stampede guard** so N concurrent misses on one hot key run the expensive compute exactly once; and the LRU's defining subtlety — *a read is a write*, so `Get` reorders the recency list and therefore cannot take a read lock.

**Mental model**

Two different locking regimes, chosen by workload. The TTL cache is read-heavy: unlimited `Get`s under `RLock`, rare `Set`/`Delete`/sweep under the full `Lock`. That split only holds because `Get` is genuinely read-only — it finds an expired entry and *declines to delete it* (deleting would force a lock upgrade), leaving reclamation to the sweeper; serving a stale value is the one thing it must never do. The LRU and LFU flip this: their `Get` mutates order/frequency, so there is no read-only path and both use a plain `sync.Mutex`. Put an `RWMutex` on an LRU `Get` and two `RLock`-holding readers splice the same list concurrently — silent corruption that `-race` catches. The stampede guard is a third idea: a hand-rolled singleflight where the leader runs `fn` **holding no lock** (it may be slow I/O) and a `WaitGroup` publishes the result to waiters with a happens-before edge.

**Key terms**
- **`sync.RWMutex`** — many readers or one writer; right default for read-mostly, wrong for a cache whose reads mutate.
- **lazy expiry** — `Get` checks `expiresAt` and returns a miss; never deletes.
- **sweeper** — background goroutine on a ticker that `delete`s expired entries under the write lock.
- **goroutine leak** — the sweeper outliving the cache because nothing closes its `done` channel.
- **singleflight / stampede guard** — dedup concurrent misses on one key so `fn` runs once.
- **in-flight map** — `map[K]*call`, the leader registers, waiters join and `wg.Wait()`.
- **happens-before** — the leader's writes to `val`/`err` before `wg.Done()` are visible to waiters after `wg.Wait()`.
- **sentinel nodes** — dummy head/tail so list surgery never nil-checks edges.
- **"a read is a write"** — LRU/LFU `Get` reorders state, so it needs the full `Lock`.
- **freq buckets** — LFU's `map[freq]*list` + `minFreq` pointer for O(1) eviction.
- **injectable clock** — `WithClock` makes TTL deterministic without `time.Sleep`.

**Why interviewers ask this**

"Build an LRU" is the most-asked design coding question there is (LeetCode 146), and the TTL+stampede variant separates people who've *run* caches from people who've read about them. A junior writes a `map` + `Mutex`, maybe reaches for `container/list`, and takes `RLock` on every `Get` because "it's a read." A senior names the workload, justifies `RWMutex` vs `Mutex` per cache, calls out that LRU `Get` mutates so `RLock` is a data race, closes the sweeper to avoid a leak, and *volunteers* the stampede problem before being asked. The tell is the vocabulary — lazy vs eager expiry, lost update, thundering herd, happens-before — plus the reflex to write a `-race` stress test rather than trust one green run.

**Common confusions**
- *"Get is a read, so RLock."* — True for the TTL cache, **false** for LRU/LFU where `Get` reorders. Wrong lock = data race.
- *"The sweeper is enough; skip the lazy check."* — No: between ticks an expired entry is still stored, so `Get` must check `expiresAt` itself or it serves staleness.
- *"Cache the error in GetOrCompute."* — Don't; a transient upstream blip would poison the key. Only cache successes.
- *"Hold the lock while `fn` runs."* — That serialises every caller behind slow I/O and can deadlock. Register in-flight under the lock, release, *then* compute.
- *"`container/list` is fine."* — It boxes values in `interface{}` and hides the pointer surgery the interviewer wants to see.

**What follows from this topic**

This is the read-modify-write discipline behind [[price-cache-data-race]] and the compute-once pattern that reappears whenever a hot key fronts an expensive upstream. The clean-shutdown half connects to [[graceful-shutdown]] (close a `done`/context, no leaked goroutine), and the singleflight is a cousin of the coordination in [[message-bus]] and [[connection-pool]].

### Clarify & design the API

Before any code, pin the scope out loud. Good clarifying questions:

- **Generic or one type?** Go generics let us write `Cache[K comparable, V any]` once — commit to that.
- **Concurrent from the start?** Yes for the TTL cache (that's the whole point). The LRU is single-threaded first, then a mutex pass.
- **How does TTL expiry happen — lazy, eager, or both?** Both: lazy on `Get`, plus a sweeper for memory.
- **Deterministic time in tests?** Inject the clock via a functional option, don't call `time.Now` directly.
- **Who stops the background goroutine?** `Close()` — and it must be idempotent.
- **Stampede handling required?** Yes: `GetOrCompute` runs `fn` once across N concurrent misses.

Commit to the signatures before logic:

```go
// TTL cache
type Cache[K comparable, V any] struct{ /* ... */ }
func NewCache[K comparable, V any](defaultTTL time.Duration, opts ...Option) *Cache[K, V]
func WithClock(now func() time.Time) Option
func WithSweepInterval(d time.Duration) Option
func (c *Cache[K, V]) Get(key K) (V, bool)
func (c *Cache[K, V]) Set(key K, value V)
func (c *Cache[K, V]) Delete(key K) bool
func (c *Cache[K, V]) GetOrCompute(key K, fn func() (V, error)) (V, error)
func (c *Cache[K, V]) Len() int
func (c *Cache[K, V]) Close() error

// LRU
type LRUCache[K comparable, V any] struct{ /* ... */ }
func NewLRU[K comparable, V any](capacity int) *LRUCache[K, V]
func (c *LRUCache[K, V]) Get(key K) (V, bool)
func (c *LRUCache[K, V]) Put(key K, value V)
```

The functional-options pattern (`Option func(*options)`) keeps construction a one-liner in production — `NewCache(time.Minute)` — while tests opt into a fake clock and a fast sweep cadence without widening the constructor. `Get` returning `(V, bool)` (not `V, error`) is the idiomatic "comma-ok" cache shape.

### Write the tests — TTL cache

Tests first, because the practice skeleton ships none on purpose. Start with a **deterministic clock** so TTL never depends on wall time:

```go
type fakeClock struct {
	mu sync.Mutex
	t  time.Time
}
func (f *fakeClock) Now() time.Time      { f.mu.Lock(); defer f.mu.Unlock(); return f.t }
func (f *fakeClock) Advance(d time.Duration) { f.mu.Lock(); defer f.mu.Unlock(); f.t = f.t.Add(d) }
```

Then walk from contract to edges. Basic contract: `Set` then `Get` hits; a missing key returns `(zero, false)`; `Set` overwrites. The **lazy-expiry** test is the interesting one — advance the clock to *just before* expiry (still a hit) then to exactly `expiresAt` (a miss, because `now >= expiresAt` counts as expired), with the sweeper parked at `WithSweepInterval(time.Hour)` so only the `Get`-time check is exercised:

```go
func TestGet_ExpiresAfterTTL(t *testing.T) {
	clk := &fakeClock{t: time.Unix(0, 0)}
	c := NewCache[string, int](100*time.Millisecond,
		WithClock(clk.Now), WithSweepInterval(time.Hour))
	defer c.Close()

	c.Set("k", 7)
	clk.Advance(99 * time.Millisecond)
	if _, ok := c.Get("k"); !ok {
		t.Fatalf("at t=99ms: want hit, not yet expired")
	}
	clk.Advance(1 * time.Millisecond) // now == expiresAt => expired
	if _, ok := c.Get("k"); ok {
		t.Fatalf("at t=100ms: want miss, TTL elapsed")
	}
}
```

Two behaviours that only a background goroutine can satisfy — sweeper eviction and clean shutdown — each get a test. The sweeper test advances the clock past TTL then polls `Len()` down to 0 with a deadline. The **leak** test snapshots `runtime.NumGoroutine()` before, asserts it rose while the cache runs, then `Close()`s and polls it back down:

```go
func TestClose_NoGoroutineLeak(t *testing.T) {
	before := runtime.NumGoroutine()
	c := NewCache[string, int](50*time.Millisecond, WithSweepInterval(5*time.Millisecond))
	if runtime.NumGoroutine() <= before {
		t.Fatalf("expected sweeper goroutine running")
	}
	c.Close()
	deadline := time.Now().Add(2 * time.Second)
	for runtime.NumGoroutine() > before {
		if time.Now().After(deadline) {
			t.Fatalf("goroutine leak after Close")
		}
		time.Sleep(time.Millisecond)
	}
}
```

Also test `Close` twice (idempotent, no panic on double `close`). These four — lazy expiry, sweeper, leak, idempotent close — are the ones a junior forgets.

### Implement the TTL cache — lazy + sweeper

The struct is a map under an `RWMutex`, plus a `done` channel and a `closeOnce`:

```go
type ttlEntry[V any] struct {
	value     V
	expiresAt time.Time
}
func (e ttlEntry[V]) expired(now time.Time) bool {
	return !e.expiresAt.IsZero() && !now.Before(e.expiresAt) // now >= expiresAt
}
```

`Get` is the read path and stays strictly read-only:

```go
func (c *Cache[K, V]) Get(key K) (V, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	e, ok := c.items[key]
	if !ok || e.expired(c.now()) {
		var zero V
		return zero, false
	}
	return e.value, true
}
```

The subtle senior move: on finding an expired entry, `Get` does **not** delete it. Deleting would require upgrading `RLock`→`Lock`, which Go's `RWMutex` can't do atomically — you'd unlock and re-lock, and the read path would suddenly contend on the write lock. Instead the expired check *hides* the stale value (correctness) and the sweeper reclaims the memory later (housekeeping). `Set`/`Delete`/`Clear`/`sweep` all take the full `Lock`. The sweeper loop is the leak-proofing:

```go
func (c *Cache[K, V]) sweepLoop(interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-c.done:   // Close() closed it -> return, goroutine ends
			return
		case <-ticker.C:
			c.sweep()
		}
	}
}
func (c *Cache[K, V]) Close() error {
	c.closeOnce.Do(func() { close(c.done) })
	return nil
}
```

That `case <-c.done` arm is the entire difference between clean shutdown and a leaked goroutine. `sync.Once` makes `Close` idempotent — a second `close(done)` would otherwise panic.

### The stampede guard — GetOrCompute singleflight

The thundering-herd problem: a hot key expires, 100 requests miss simultaneously, and 100 identical DB/RPC calls hit an already-cold downstream. The fix is a **hand-rolled singleflight** (stdlib only — no `golang.org/x/sync`). An `inflight map[K]*call` records who is computing; the first caller leads, the rest wait on a `WaitGroup`:

```go
type call[V any] struct {
	wg  sync.WaitGroup
	val V
	err error
}

func (c *Cache[K, V]) GetOrCompute(key K, fn func() (V, error)) (V, error) {
	if v, ok := c.Get(key); ok { // fast path: pure RLock
		return v, nil
	}
	c.mu.Lock()
	if e, ok := c.items[key]; ok && !e.expired(c.now()) { // double-check
		c.mu.Unlock()
		return e.value, nil
	}
	if cl, ok := c.inflight[key]; ok { // someone's already computing: join them
		c.mu.Unlock()
		cl.wg.Wait()
		return cl.val, cl.err
	}
	cl := &call[V]{}          // we're the leader
	cl.wg.Add(1)
	c.inflight[key] = cl
	c.mu.Unlock()             // release BEFORE running fn

	cl.val, cl.err = fn()     // slow I/O, holding no lock
	if cl.err == nil {
		c.Set(key, cl.val)    // do NOT cache failures
	}
	c.mu.Lock()
	delete(c.inflight, key)
	c.mu.Unlock()
	cl.wg.Done()              // publish result to waiters (happens-before)
	return cl.val, cl.err
}
```

Three load-bearing details. **`fn` runs with no lock held** — holding it would serialise every caller behind slow I/O and could deadlock if `fn` re-enters the cache. **The double-check under the lock** closes the race between the fast-path miss and acquiring the lock (another goroutine may have populated the key). **Errors aren't cached** — a transient failure self-heals next call. The `WaitGroup` isn't just coordination: writing `val`/`err` *before* `wg.Done()` establishes the happens-before edge that lets waiters read them race-free after `wg.Wait()`.

### The O(1) LRU — a read is a write

Two structures in lockstep: a `map[K]*node` for O(1) lookup, and a hand-rolled doubly-linked list for O(1) recency (MRU at front, LRU at back). **Sentinel** head/tail nodes mean every real node always has non-nil `prev`/`next`, so the splice helpers never special-case the empty list or the ends:

```go
type node[K comparable, V any] struct {
	key        K            // stored so removeTail can delete from the map in O(1)
	value      V
	prev, next *node[K, V]
}

func (c *LRUCache[K, V]) addToFront(n *node[K, V]) {
	n.prev, n.next = c.head, c.head.next
	c.head.next.prev = n
	c.head.next = n
}
func (c *LRUCache[K, V]) unlink(n *node[K, V]) {
	n.prev.next = n.next
	n.next.prev = n.prev
	n.prev, n.next = nil, nil
}
func (c *LRUCache[K, V]) moveToFront(n *node[K, V]) { c.unlink(n); c.addToFront(n) }
```

The defining insight: **`Get` mutates.** A hit calls `moveToFront`, reordering the list — so `Get` is a write, and the cache uses a plain `sync.Mutex`, not `RWMutex`:

```go
func (c *LRUCache[K, V]) Get(key K) (V, bool) {
	c.mu.Lock()          // full Lock — Get reorders the list
	defer c.mu.Unlock()
	n, ok := c.items[key]
	if !ok {
		var zero V
		return zero, false
	}
	c.moveToFront(n)
	return n.value, true
}
```

Say it out loud in the interview: "In an LRU a read is a write, so an `RWMutex` `RLock` would let two concurrent `Get`s splice the same list and corrupt it — that's why it's a `Mutex`." `Put` inserts at front, and when `len > capacity` calls `removeTail()` (the node just before the tail sentinel) and deletes its key from the map — the `key` field on the node is what makes that map delete O(1).

### The LFU — frequency buckets + minFreq

Whiteboard-only, but be ready to sketch it. LFU evicts the least-*frequently*-used, tie-broken by recency. The structure is a `map[K]*entry`, a `map[freq]*list` (each bucket a sentinel doubly-linked list ordered MRU→LRU), and a `minFreq` int:

```go
type LFUCache[K comparable, V any] struct {
	mu       sync.Mutex           // Get bumps frequency -> a read is a write here too
	capacity int
	items    map[K]*lfuEntry[K, V]
	freqs    map[int]*freqList[K, V]
	minFreq  int
}
```

The trick is maintaining `minFreq` in O(1) without ever scanning:
- **Insert**: new entry has freq 1, the global minimum, so `minFreq = 1`.
- **Touch (on `Get`/update)**: move the entry from bucket `f` to `f+1`. If that *drained* the `minFreq` bucket, the entry we just promoted was the last at the minimum, so the new minimum is exactly `f+1` — `minFreq++`. No search.
- **Evict**: remove `freqs[minFreq].back()` (LRU within the min bucket); the next insert resets `minFreq` to 1 anyway.

The trade-off is the interview payload: **LRU** is the cheap sensible default but a one-off sequential scan flushes the hot set (recency can't tell "hot" from "touched once just now"). **LFU** resists scans (a once-touched key dies at freq 1) but a historically-hot-now-cold key squats forever without decay. Production "LFU" is therefore approximate — TinyLFU (a decaying Count-Min sketch as an admission filter in front of an LRU), as in Caffeine and Ristretto.

### The -race stress test

A single green `-race` run is not proof — concurrency bugs are probabilistic. Write a high-contention test with **capacity < keyspace** (so evictions fire concurrently) and mixed read/write, then run it under `-race -count`. Encode the key into the value so a read can detect a torn write:

```go
func TestLRU_Concurrent_NoRace(t *testing.T) {
	c := NewLRU[int, int](8) // cap 8 < keyspace 16 -> eviction churn
	const (goros, ops, keyspace = 32, 2000, 16)

	var wg sync.WaitGroup
	start := make(chan struct{})
	for g := 0; g < goros; g++ {
		wg.Add(1)
		go func(g int) {
			defer wg.Done()
			<-start // release all goroutines at once -> maximise contention
			for i := 0; i < ops; i++ {
				k := (g + i) % keyspace
				if i%2 == 0 {
					c.Put(k, i*keyspace+k) // invariant: v % keyspace == k
				} else if v, ok := c.Get(k); ok && v%keyspace != k {
					t.Errorf("torn read for key %d: got %d", k, v)
					return
				}
			}
		}(g)
	}
	close(start)
	wg.Wait()
}
```

The `start` channel is the standard trick to unleash every goroutine simultaneously rather than letting early ones finish before late ones spawn. The same shape covers the TTL cache (add `WithSweepInterval(time.Millisecond)` so the sweeper churns the map alongside the readers) and the stampede test (100 goroutines miss one hot key, assert the compute counter is exactly 1). Run them hard:

```bash
go test -race -count=20 ./cache/
```

If the LRU took an `RWMutex` `RLock` on `Get`, or the TTL cache mutated the map under `RLock`, `-race` flags it — usually not on run 1, which is exactly why `-count` matters.

### Common mistakes & senior signal

The README's traps and the pitfalls that separate levels:

- **Wrong lock for the workload.** `RWMutex` for the read-mostly TTL cache — good. `RWMutex` on an LRU/LFU `Get` — a data race, because those reads reorder state. Senior signal: state *why* per cache.
- **Lazy check skipped.** Relying on the sweeper alone serves stale entries between ticks. `Get` must check `expiresAt` itself.
- **Deleting expired entries on the read path.** Tempting, but it forces an `RLock`→`Lock` upgrade that `RWMutex` doesn't support. Let the sweeper reclaim; the read path only *hides* staleness.
- **Leaking the sweeper.** No `case <-done` arm, or no `Close` — the goroutine runs till process exit. Always `select` on a done channel; guard `close` with `sync.Once`.
- **Holding the lock across `fn` in GetOrCompute.** Serialises callers behind slow I/O and risks deadlock. Register in-flight under the lock, release, compute, then re-lock to deregister.
- **Caching errors.** Poisons the key on a transient blip. Cache successes only.
- **Trusting one `-race` pass.** Senior habit: `-race -count=N`, capacity < keyspace, a `start` channel to force overlap, and an invariant the test can actually check (`v % keyspace == k`, exactly-once compute counter, `Len()` bounded by capacity).
- **Reaching for `container/list`.** Hand-roll the doubly-linked list with sentinels — the interviewer wants to see the pointer surgery and the O(1) argument, not an `interface{}`-boxed stdlib type.


## Bet Gateway — Exactly-Once HTTP Bet Submission

### Summary

**What this topic covers**

You build the `http.Handler` that a betslip POSTs to when a punter taps "Place bet". A request is a `POST` carrying an `X-Account-Id` header, an `Idempotency-Key` header, and a JSON `Bet` body (`selection`, integer-penny `stake`, decimal `odds`). The handler validates, rate-limits, and places the bet exactly once — even when the *same* logical bet arrives as many concurrent, identical POSTs. Punters double-tap, mobile clients retry on flaky connections, and load balancers replay requests they never saw a response for, so duplicate submissions carrying one `Idempotency-Key` are routine. The trap: the naive `if _, seen := store[key]; !seen { store[key] = place() }` is a check-then-act (TOCTOU) race — two requests both read "not seen" and both call `Place`, charging the punter twice. Rate limiting (`Limiter`) and placement (`Placer`) are injected interfaces; you write the HTTP glue plus the idempotency guard that ties them together, and you test it with `net/http/httptest`.

**Mental model**

The guard is a **single-flight per key**. Keep one in-flight `entry` per `Idempotency-Key`. The first request for a key installs its entry under a *short-held* mutex, releases the lock, then performs the single `Place` call; concurrent requests for the same key find the existing entry, block on its `ready` channel, and return the identical result. The mutex protects only the map read-modify-write — install-or-find — which is fast and never wraps the network call. Exactly one `Place` runs per key; unrelated keys never serialise behind each other because the lock is released before the slow work. The waiter/leader hand-off is a channel `close`: the leader fills `entry.bet`/`entry.err` and closes `ready`; every waiter's `<-e.ready` unblocks and reads the now-published fields. The close is the happens-before edge, so waiters see the writes without a data race.

**Key terms**
- **TOCTOU / lost update** — time-of-check-to-time-of-use: two goroutines both pass `!seen`, both act; one placement is lost (duplicated).
- **single-flight** — collapse N concurrent calls for one key into one execution; the rest wait and share the result.
- **`Idempotency-Key`** — client-supplied token identifying one logical operation; the dedup axis.
- **critical section** — the code the mutex guards; here just the map lookup/insert, *never* `Place`.
- **`entry.ready chan struct{}`** — a one-shot broadcast: closing it wakes all waiters at once.
- **close-as-publish** — `close(ready)` happens-before every `<-ready` return, so waiters observe `bet`/`err` safely.
- **leader vs waiter** — the goroutine that installs the entry (leader) does the work; others (waiters) block and read.
- **cache success, drop failure** — keep completed placements for free replays; delete the entry on error so a transient failure is retryable.
- **status-code discipline** — 405/400/429/422/201/200/502 each mean one specific thing.
- **`httptest.NewRecorder` / `NewServer`** — in-process response capture for unit cases; a real server + goroutines for the concurrent double-submit.

**Why interviewers ask this**

It fuses three things a senior must hold at once: correct HTTP semantics (right status for each failure), a concurrency invariant with real money on it (exactly-once), and clean dependency boundaries (inject `Placer`/`Limiter`, don't reimplement them). A junior writes check-then-act, holds a global lock across the downstream call, or caches failures forever. A senior reaches for single-flight, explains *why the lock is never held across `Place`* (it would collapse all concurrency at peak), reasons about the success-vs-failure caching trade-off out loud, and — the real tell — writes a gated concurrent test that actually places 32 requests at once and asserts `Place` ran exactly once under `-race`. Getting one green run is not the bar; repeating under `-count` is.

**Common confusions**
- "A mutex round the whole handler is safe." Safe, but it serialises every account behind one lock across a network call — a stalled front-end at peak. Guard only the map op.
- "Cache the failure too." Then a transient downstream blip poisons the key forever; the punter can never retry. Drop the entry on error.
- "Replay should be free of the rate-limit charge." That's the extension, not the base spec — base spec spends a token even on a replay.
- "Rate-limit after parsing the body." No — reject over-limit callers *before* doing real work; a denied caller must be cheap.

**What follows from this topic**

This is where the `ratelimit` (token bucket → `Limiter`) and `ledger` (→ `Placer`) katas meet behind one HTTP door. The single-flight pattern generalises to any dedup-around-a-slow-call: cache stampede protection, request coalescing, `golang.org/x/sync/singleflight`. The extensions — per-key TTL so the store doesn't grow unbounded, free replays via pre-limit lookup, `Retry-After` on 429 — are the natural next questions.

### Clarify & design the API

Questions worth asking before writing a line: *Is the idempotency scope per-key-global or per-account? What's the retry policy on a downstream failure — poison the key or allow retry? Does a replay cost a rate-limit token? Is the store bounded (TTL/eviction)?* For the base kata: key is global, failures are retryable, replays do cost a token, store is unbounded (TTL is the extension).

The interfaces are given — you own only `Gateway`'s internals. Commit to the single-flight `entry` shape and a `submit` helper that returns *whether this call created the bet* so `ServeHTTP` can pick 201 vs 200:

```go
type Gateway struct {
	placer  Placer
	limiter Limiter
	mu       sync.Mutex
	inflight map[string]*entry // keyed by Idempotency-Key
}

// entry is a single-flight slot: leader fills bet/err and closes ready;
// waiters block on ready and read the shared result.
type entry struct {
	ready chan struct{}
	bet   PlacedBet
	err   error
}

func NewGateway(p Placer, l Limiter) *Gateway {
	return &Gateway{placer: p, limiter: l, inflight: make(map[string]*entry)}
}

// created==true means THIS call ran Place (→201); false means it replayed (→200).
func (g *Gateway) submit(ctx context.Context, account, key string, bet Bet) (PlacedBet, bool, error)
```

`ready` is `chan struct{}` because it carries no value — its *close* is the signal, and closing broadcasts to every waiter at once. `inflight` is a plain `map` guarded by `mu`; a `sync.Map` buys nothing here because the install-or-find must be one atomic step.

### Write the tests

This is the heart — the practice side ships **no tests on purpose**, because designing the one that exposes the double-submit is half the exercise. Build outward: contract cases with `httptest.NewRecorder`, then the concurrent race with a real `httptest.NewServer`.

Shared stubs make `Place` countable and the limiter switchable:

```go
type countingPlacer struct {
	calls atomic.Int64
	ids   atomic.Int64
	fail  bool
}
func (p *countingPlacer) Place(context.Context, string, Bet) (PlacedBet, error) {
	p.calls.Add(1)
	if p.fail {
		return PlacedBet{}, fmt.Errorf("downstream unavailable")
	}
	n := p.ids.Add(1)
	return PlacedBet{ID: fmt.Sprintf("bet-%d", n), Status: "accepted"}, nil
}

type fixedLimiter struct{ allow bool }
func (l fixedLimiter) Allow(string) bool { return l.allow }
```

**Status-code contract (recorder-based).** One table nails every branch — these are cheap and catch status regressions:

```go
func TestStatusCodes(t *testing.T) {
	const ok = `{"selection":"LIV-MUN","stake":500,"odds":2.5}`
	tests := []struct {
		name, method, account, key, body string
		limiter                          fixedLimiter
		want                             int
	}{
		{"wrong method", http.MethodGet, "acc-1", "k", ok, fixedLimiter{true}, 405},
		{"missing account", http.MethodPost, "", "k", ok, fixedLimiter{true}, 400},
		{"missing key", http.MethodPost, "acc-1", "", ok, fixedLimiter{true}, 400},
		{"rate limited", http.MethodPost, "acc-1", "k", ok, fixedLimiter{false}, 429},
		{"malformed json", http.MethodPost, "acc-1", "k", `{not json`, fixedLimiter{true}, 400},
		{"empty selection", http.MethodPost, "acc-1", "k", `{"selection":"","stake":5,"odds":2}`, fixedLimiter{true}, 422},
		{"zero stake", http.MethodPost, "acc-1", "k", `{"selection":"X","stake":0,"odds":2}`, fixedLimiter{true}, 422},
		{"odds below evens", http.MethodPost, "acc-1", "k", `{"selection":"X","stake":5,"odds":0.5}`, fixedLimiter{true}, 422},
		{"success", http.MethodPost, "acc-1", "k", ok, fixedLimiter{true}, 201},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			g := NewGateway(&countingPlacer{}, tc.limiter)
			r := httptest.NewRequest(tc.method, "/bets", strings.NewReader(tc.body))
			if tc.account != "" { r.Header.Set("X-Account-Id", tc.account) }
			if tc.key != "" { r.Header.Set("Idempotency-Key", tc.key) }
			w := httptest.NewRecorder()
			g.ServeHTTP(w, r)
			if w.Code != tc.want {
				t.Fatalf("status = %d, want %d", w.Code, tc.want)
			}
		})
	}
}
```

Why each group matters: `429`-before-work proves you rate-limit early (also assert `Place` ran 0 times); `400` vs `422` proves you distinguish *malformed* from *semantically invalid*; `201` proves the happy path.

**Idempotent replay (sequential).** Same key twice → first 201, second 200, same `bet_id`, `Place` called once. This is the dedup logic without concurrency — if this fails, the race test is meaningless.

**Failure is retryable.** `fail:true` first request → 502; flip `fail:false`, retry same key → 201, and `Place.calls == 2`. This is the "drop the entry on error" spec; a handler that caches the failure returns a cached 502 forever and this fails.

**The `-race` stress test — the whole point.** N goroutines, same `Idempotency-Key`, gated to fire together against a real server; assert `Place` ran *exactly once*, exactly one response was 201, and every returned id is identical:

```go
func TestConcurrentDoubleSubmit(t *testing.T) {
	p := &countingPlacer{}
	g := NewGateway(p, fixedLimiter{allow: true})
	srv := httptest.NewServer(g)
	defer srv.Close()

	const requests = 32
	var wg sync.WaitGroup
	start := make(chan struct{}) // gate: all goroutines block until close(start)
	var created atomic.Int64
	ids := make([]string, requests)

	for i := 0; i < requests; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			req, _ := http.NewRequest(http.MethodPost, srv.URL+"/bets",
				strings.NewReader(`{"selection":"LIV-MUN","stake":500,"odds":2.5}`))
			req.Header.Set("X-Account-Id", "acc-1")
			req.Header.Set("Idempotency-Key", "same-key")
			<-start
			resp, err := srv.Client().Do(req)
			if err != nil { t.Errorf("req %d: %v", i, err); return }
			defer resp.Body.Close()
			if resp.StatusCode == http.StatusCreated { created.Add(1) }
			var pb PlacedBet
			_ = json.NewDecoder(resp.Body).Decode(&pb)
			ids[i] = pb.ID
		}(i)
	}
	close(start) // release the herd simultaneously
	wg.Wait()

	if p.calls.Load() != 1 {
		t.Fatalf("Place called %d times, want exactly 1 (double-submit not deduped)", p.calls.Load())
	}
	if created.Load() != 1 {
		t.Fatalf("%d responses were 201, want exactly 1", created.Load())
	}
	for i, id := range ids {
		if id != "bet-1" { t.Fatalf("req %d id=%q, want all bet-1", i, id) }
	}
}
```

The `start` channel is the critical trick: without it goroutines drift and the first finishes before the rest begin, so the race never fires. Gating them to launch together maximises the overlap window. Run:

```
CGO_ENABLED=0 go test -race -count=20 ./betgateway/
```

`-count=20` is not superstition — a single green `-race` run is *not* proof of a correct concurrent design. The scheduler interleaves differently each run; only repetition (and varying `requests`) builds confidence. (`CGO_ENABLED=0` sidesteps a macOS `net/http` cgo-resolver link issue; Linux/CI needs no flag.)

### Implement it

Single-flight, lock held only across the map op:

```go
func (g *Gateway) submit(ctx context.Context, account, key string, bet Bet) (PlacedBet, bool, error) {
	g.mu.Lock()
	if e, ok := g.inflight[key]; ok {
		g.mu.Unlock()
		<-e.ready // waiter: block until the leader finishes
		return e.bet, false, e.err
	}
	e := &entry{ready: make(chan struct{})}
	g.inflight[key] = e
	g.mu.Unlock() // release BEFORE the downstream call

	e.bet, e.err = g.placer.Place(ctx, account, bet) // the single Place, lock-free

	if e.err != nil {
		g.mu.Lock()
		delete(g.inflight, key) // drop on failure → retryable
		g.mu.Unlock()
	}
	close(e.ready) // publish result to all waiters
	return e.bet, true, e.err
}
```

`ServeHTTP` maps the result to a status:

```go
placed, created, err := g.submit(r.Context(), account, key, bet)
if err != nil {
	http.Error(w, "placement failed", http.StatusBadGateway) // 502
	return
}
status := http.StatusOK // 200 replay
if created {
	status = http.StatusCreated // 201 first placement
}
w.Header().Set("Content-Type", "application/json")
w.WriteHeader(status)
_ = json.NewEncoder(w).Encode(placed)
```

Happens-before reasoning: the leader writes `e.bet`/`e.err` *before* `close(e.ready)`; every waiter reads them *after* `<-e.ready` returns. The channel close is the synchronisation edge — the writes are published, no lock needed on the fields, and `-race` stays clean. The mutex serialises only concurrent map access (install-or-find is one atomic step, closing the TOCTOU window); it is `O(1)` and never wraps I/O. Allocation is one `entry` per distinct key. Note the leader always returns `created=true` even after a failure — but on failure `err != nil` so `ServeHTTP` returns 502 before consulting `created`, and the entry is already gone.

### Common mistakes & senior signal

- **Check-then-act (the money bug).** `if _, seen := store[key]; !seen { store[key] = place() }` — two requests both read "not seen", both call `Place`, punter charged twice. This is the exact TOCTOU shape of `priceladder`/`ledger`, but the critical section here wraps a *slow* call, which is why the naive whole-handler lock is also wrong.
- **Holding the lock across `Place`.** Correct for exactly-once, catastrophic for throughput: every account's bets serialise behind one mutex across a network round-trip. At peak that's a frozen front-end. Senior signal: release the lock, let the channel coordinate the wait.
- **Caching failures forever.** Keeping the entry on error poisons the key — the punter can never retry a bet the downstream merely blipped on. Drop it. Know the trade-off out loud: caching failures is *safer against duplicate side effects* but worse for the punter; caching only success is the kata's chosen point.
- **Rate-limiting after parsing.** Do it *before* any real work — a denied caller must be cheap. And a base-spec replay still spends a token (making replays free is the extension: look the key up before spending).
- **Testing without a gate.** A concurrent test where goroutines aren't released together doesn't overlap, so it passes even on a broken handler. The `close(start)` herd-release plus `-race -count=N` is what actually exposes the double-submit.
- **Senior signal, distilled:** single-flight not whole-handler lock; lock never across I/O; `close(ready)` as the publish edge; drop-on-failure; status-code discipline (405/400/429/422/201/200/502); and a gated stress test run under `-race -count` rather than trusting one green run.


## Aggregator Drill — Fan-In with Subscriptions

### Summary

**What this topic covers**

You build a low-latency market-data aggregator for a sports-betting firm: many venue feeds push back/lay quotes for the same markets, and many request handlers read the current best-of-book on a hot path. Best back is the highest price available to back; best lay is the lowest to lay. Quotes expire after a TTL. Callers can also `Subscribe` to a market and be pushed the freshest `MarketView` as it changes. This is a *self-paced staged drill* — you write everything from a stub through eight escalating stages (core best-of-book → concurrency → staleness → subscriptions → backpressure → graceful shutdown → benchmark). The trap sits on the shutdown path: `Subscribe`, `unsubscribe`, ctx-cancel, and `Close` can all try to close the same subscriber channel, and a `close` of an already-closed channel — or a send on one — panics. The reference implementation *shipped that bug*, and a single green `-race` run did not surface it. Only a stress test run under `-race -count` did.

**Mental model**

Two independent contention domains. The read/write hot path uses per-market copy-on-write: a top-level `map[string]*market` guarded by an `RWMutex` taken only to find-or-create, and each market publishing its computed best view through an `atomic.Pointer[MarketView]`. Readers do one atomic `Load()` — no lock. Writers recompute an immutable view under the market's own `Mutex` and atomically swap it in. The subscription domain is a *separate* registry with its *own* mutex, so subscribe/unsubscribe never contend with reads. The concurrency danger lives entirely in channel lifetime: a subscriber channel has multiple would-be closers. The fix is a single ownership rule — the registry owns each channel and closes it exactly once via `sync.Once`, with a `closed` flag set under the registry lock *before* the close, checked under the same lock by non-blocking `publish` sends. That interlock (flag-then-close, both under one lock) is what makes send-on-closed structurally impossible rather than merely improbable.

**Key terms**
- **RWMutex** — many readers or one writer; here it guards only the markets-map *shape* (find-or-create), not the hot read.
- **atomic.Pointer[T]** — lock-free publish/consume of an immutable snapshot; `Store` swaps, `Load` reads with no lock.
- **copy-on-write** — build a fresh immutable `MarketView` per update and swap it in; readers never see a torn value.
- **sync.Once** — runs the close body exactly once no matter how many paths race it; the spine of "close exactly once".
- **done channel** — closed alongside `ch` by the same `Once` to release the per-subscription watcher goroutine.
- **latest-wins / coalescing** — on a full buffer, drop the oldest and enqueue the newest so a lagging consumer advances toward the current price.
- **non-blocking send** — `select { case ch <- v: default: }`; a stuck subscriber can never stall ingestion.
- **injectable clock** — `func() time.Time` so tests advance time deterministically instead of sleeping.
- **goroutine leak** — a watcher or sweeper that never exits; detected by comparing `runtime.NumGoroutine()` to a baseline.
- **happens-before** — the flag-under-lock write orders before the close, so no send observes a closing channel.

**Why interviewers ask this**

It separates people who *pass a test* from people who *trust concurrent code*. A junior wires up channels, runs `go test`, sees green, and calls it done. A senior knows a green concurrent run proves nothing: the interleaving that panics may not have occurred this time. They design the ownership rule up front ("one owner closes each channel, exactly once"), articulate why the `closed` flag and the close share a lock, and — the real signal — they reach for `go test -race -count=100` and vary load because they expect the first run to lie. This drill also probes API taste: functional options, who-closes semantics, and the drain-vs-abandon shutdown decision (abandon in-flight publishes; a queued odds tick is already stale).

**Common confusions**
- "It passed `-race`, so it's correct." No — `-race` only flags races it *observed*. The bug here needed a specific Subscribe/Close interleaving; a single run may never hit it. Repeat under `-count`.
- "Buffered channels mean I can't lose data." The policy deliberately drops intermediate ticks; latest price is all that matters for live odds.
- "The receiver should close the channel." The *sender/owner* closes. Here the registry owns it; closing from a consumer or from every path invites the double-close panic.

**What follows from this topic**

This is the capstone that combines earlier concurrency katas: the atomic-snapshot read path echoes the price-cache data-race drill, the sweeper + `Close` join is the graceful-shutdown pattern, and the fan-out is the message-bus / feed-channel family. The transferable lesson — *a stress test under `-race -count` is the unit test for concurrent code* — carries into every one of them.

### Clarify & design the API

Questions to ask before writing logic: Is `Apply` called from many goroutines (yes — venue feeds)? Is `Get` the hot path (yes — read-heavy)? Do subscribers get every tick or just the latest (latest-wins — this is live odds)? Who closes subscriber channels (the aggregator owns them)? What ends a subscription (explicit unsubscribe, ctx-cancel, *or* aggregator `Close`)? Is `Close` idempotent and safe to race with `Apply`/`Subscribe` (yes)?

Commit to a small surface, then let the stages grow it:

```go
type PriceUpdate struct { Venue, Market string; Back, Lay float64; Ts time.Time }
type MarketView  struct { Market string; Back, Lay float64; BackVenue, LayVenue string; BackTs, LayTs time.Time }

func New(opts ...Option) *Aggregator
func (a *Aggregator) Apply(u PriceUpdate)                 // ingest one quote; no-op after Close
func (a *Aggregator) Get(market string) (MarketView, bool) // lock-free read
func (a *Aggregator) Subscribe(ctx context.Context, market string) (<-chan MarketView, func())
func (a *Aggregator) Close() error                        // idempotent
```

Design decisions to state out loud: the returned channel is **receive-only** (`<-chan`) — callers can't close it, the registry does. `Subscribe` returns an **idempotent** unsubscribe `func()`. The buffer is small and configurable (`WithSubscriberBuffer`); it's a coalescing buffer, not a queue. Functional options (`WithTTL`, `WithClock`, `WithSweepInterval`) keep `New` backward-compatible and make the clock injectable for tests.

### Write the tests

This is the heart of the drill: the practice side ships **no tests on purpose**. Write them first, and make the fake clock the backbone so nothing sleeps.

Start with the core contract — table-driven best-of-book with a fake clock, covering unknown market, single venue, best-back-highest / best-lay-lowest, same-venue overwrite replaces, and back/lay from different venues:

```go
func TestBestOfBook(t *testing.T) {
    clk := newFakeClock(base())
    tests := []struct{ name string; updates []PriceUpdate; market string; wantOK bool; wantBack, wantLay float64 }{
        {name: "unknown market", market: "missing", wantOK: false},
        {name: "best back highest, best lay lowest", updates: []PriceUpdate{
            {Venue: "alice", Market: "m", Back: 2.0, Lay: 2.2, Ts: base()},
            {Venue: "bob",   Market: "m", Back: 2.5, Lay: 2.1, Ts: base()},
        }, market: "m", wantOK: true, wantBack: 2.5, wantLay: 2.1},
    }
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            a := New(WithClock(clk.Now), WithTTL(time.Minute)); defer a.Close()
            for _, u := range tt.updates { a.Apply(u) }
            v, ok := a.Get(tt.market)
            if ok != tt.wantOK { t.Fatalf("ok = %v, want %v", ok, tt.wantOK) }
            if ok && (v.Back != tt.wantBack || v.Lay != tt.wantLay) {
                t.Errorf("got back %v lay %v", v.Back, v.Lay)
            }
        })
    }
}
```

Then edge behaviour — each catches a distinct class of bug:
- **Staleness** (`TestStalenessExpiresAndRevives`): advance the fake clock past TTL, assert `Get` drops the stale side, then a fresh `Apply` revives it. Catches update-driven-only expiry.
- **Sweeper** (`TestSweeperExpiresWithoutUpdates`): with no new updates, the background sweeper must republish an empty view — expiry is time-driven, not update-driven.
- **Backpressure** (`TestSlowSubscriberDoesNotBlockOthersOrIngestion`): a subscriber that never drains must not stall `Apply`, and a healthy subscriber must still observe the latest (999) via coalescing. Catches a blocking send on the ingest path.
- **Closed / cancelled channels**: `unsub()` closes the channel (`<-ch` yields `ok=false`) and further `Apply` must not panic; ctx-cancel ends the subscription the same way. Catches send-on-closed and leaked watchers.

Then the group that actually earns its keep — the `-race` stress test:

```go
func TestAggregator_RaceStress(t *testing.T) {
    if testing.Short() { t.Skip("run without -short, ideally -race -count=N") }
    baseline := runtime.NumGoroutine()
    a := New(WithClock(newFakeClock(base()).Now), WithTTL(2*time.Second),
        WithSweepInterval(time.Millisecond), WithSubscriberBuffer(4))

    procs := runtime.GOMAXPROCS(0)
    var wg sync.WaitGroup
    start := make(chan struct{})
    // 8*procs appliers, 8*procs getters, and — deliberately weighted —
    // 8*procs subscribers that churn Subscribe → drain a few → unsubscribe,
    // racing the sweeper's publishes and, finally, a concurrent Close.
    // ... spawn goroutines, each <-start ...
    close(start)

    ch, _ := a.Subscribe(context.Background(), "m-0")
    if err := a.Close(); err != nil { t.Fatalf("Close: %v", err) } // races in-flight work
    for range ch {}                                                 // must be closed by Close
    if err := a.Close(); err != nil { t.Fatalf("second Close: %v", err) } // idempotent
    wg.Wait()

    if !pollUntil(2*time.Second, func() bool { return runtime.NumGoroutine() <= baseline }) {
        t.Errorf("goroutine leak: baseline %d, got %d", baseline, runtime.NumGoroutine())
    }
}
```

Its three assertions map to three failure modes: **no panic** (a double-close or send-on-closed crashes the run), **every channel closed after Close** (the `for range ch` completes — a leaked-open channel hangs it), and **goroutines back to baseline** (every watcher and the sweeper reaped). Run it with:

```bash
go test -race -run TestAggregator_RaceStress -count=100 ./...
```

The `-count=100` is the whole point. The reference had a close-of-closed-channel bug on the Subscribe/unsubscribe/Close paths; a single `-race` run went green because the panicking interleaving didn't happen that time. Only churning subscriptions hard while `Close` tore down concurrently — repeated under `-count` — forced the bad schedule and caught it.

### Implement it

Two synchronisation choices, each justified by the workload.

**Read/write path — atomic snapshot.** `Apply` finds-or-creates the market (RLock fast path, exclusive Lock only for a brand-new market, double-checked), then under the market's own `Mutex` writes the venue quote, recomputes an immutable `MarketView`, and `view.Store(view)`. `Get` does a single `view.Load()` — no lock — then drops any side now older than TTL (so a view that went stale since the last write is never served). Rejected: one big RWMutex over the whole map, which serialises every read against every write. Cost of the chosen design: one allocation per update (the new view) — fine because updates are far rarer than reads.

**Subscription path — the ownership interlock.** Each `subscription` holds `ch`, a `done` channel, a `closed bool`, and a `sync.Once`. `release()` closes `ch` and `done` inside `once.Do` — exactly once, no matter how many of {unsubscribe, ctx-cancel, Close} fire. The happens-before that kills send-on-closed: `remove`/`closeAll` set `closed = true` **under the registry lock**, then close; `publish` iterates and sends **under the same lock**, skipping any `closed` subscriber:

```go
func (r *subRegistry) publish(market string, v MarketView) {
    r.mu.Lock(); defer r.mu.Unlock()
    for _, s := range r.byMkt[market] {
        if s.closed { continue }
        select {
        case s.ch <- v:                 // fast path
        default:                        // full: coalesce to latest
            select { case <-s.ch: default: } // drop oldest
            select { case s.ch <- v: default: }
        }
    }
}
```

Because the flag write and the close are both under `r.mu`, `publish` can never send to a channel that's concurrently closing. The per-subscription watcher goroutine `select`s on `ctx.Done()`, the aggregator's `ctx.Done()`, and `s.done`; whichever fires, the sub is removed and `done` closes, so the watcher always terminates — no leak. `Close` CAS-flips `closed`, cancels the context (stopping the sweeper), `closeAll()`s the registry, then `wg.Wait()`s the sweeper. It **abandons** in-flight publishes rather than draining — a queued odds tick is already stale, and draining risks hanging on a consumer that never reads.

### Common mistakes & senior signal

The README's trap and the pitfalls around it:

- **Trusting a single green `-race` run.** The reference *shipped* a close-of-closed-channel bug that a lone run missed. Senior move: `-race -count=100` and vary load; expect the first run to lie.
- **Closing a channel from multiple paths.** Unsubscribe, ctx-cancel, and Close all want to end a subscription — funnel every path through one `sync.Once` (`release`) so the close happens once total. Never close from the receiver.
- **Send-on-closed race.** Set the `closed` flag and read it under the *same* lock that guards the close; a naive `closed`-check outside the lock still races the close.
- **Blocking the ingest path.** Subscriber sends must be non-blocking (`select … default`) — one stuck consumer must never stall `Apply` or other subscribers.
- **Goroutine leaks on cancel.** Every watcher needs a guaranteed exit (`s.done`); assert `runtime.NumGoroutine()` returns to baseline after `Close`.
- **Locking the hot read.** Keep `Get` to one atomic `Load()`; don't reach for an RWMutex over the whole market map.
- **Draining on shutdown "to be safe".** For live odds, abandon in-flight publishes; draining a slow consumer risks a hang. State the drain-vs-abandon trade explicitly — interviewers listen for it.


