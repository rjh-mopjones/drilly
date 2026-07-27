## How to Attack a Kata (TDD)

### Summary

**What this topic covers**

The repeatable method for turning an open-ended prompt — "build me an LRU cache", "write a rate limiter", "design a parking lot" — into working, tested code inside the interview's time box. These katas mirror the hardest interview format: no LeetCode scaffolding, no method stub to fill, just a blank file and a vague requirement. The skill being tested is not "do you know the algorithm" but "can you drive a problem from nothing to a correct, tested implementation the way you would at work". This topic is the operating system every other kata runs on: clarify the spec, design the smallest honest API, **write the tests first**, implement until they pass, then talk complexity and concurrency. Get this loop reflexive and each individual kata becomes an exercise in one specific data structure or concurrency primitive rather than a scramble.

**Mental model**

Think of an open-ended kata as three collapsing funnels. First you collapse **ambiguity** into a spec: a handful of clarifying questions pin down capacity, null handling, thread-safety, ordering, and the return type — before a line of code. Second you collapse the spec into an **API**: the smallest set of method signatures that could satisfy it (`Optional<V> get(K)`, `void put(K,V)`, `int size()`), chosen so the caller's life is easy and the invariants are expressible. Third you collapse the API into an **implementation**, and the thing that drives that collapse is a **test list** — you write the failing tests that encode the spec, then make them pass. Tests come first not as ceremony but because they force you to use your own API before you build it, they turn a fuzzy requirement into a concrete checklist, and they catch the eviction-order or lost-update bug the moment it appears instead of in the final five minutes. The senior move is to keep each loop tiny: one behaviour, its test, its code, repeat — never write fifty lines then hope.

**Key terms**

- **Open-ended prompt** — a problem with no stub; you invent the API and the tests, not just the body.
- **Clarifying pass** — the 3–6 questions that turn ambiguity into a testable spec.
- **The smallest API** — the minimal method set that satisfies the spec; design it before logic.
- **Test list** — the enumerated behaviours you'll assert: contract, core behaviour, edges, concurrency.
- **Tests-first** — write the failing test that encodes a behaviour, then the code that satisfies it.
- **Contract test** — the happy-path round-trip that proves the basic API works.
- **Edge/boundary test** — capacity 1, empty, duplicate keys, null/negative args (`assertThrows`).
- **Stress test** — many threads hammering the SUT to surface races/lost updates (concurrency katas).
- **Invariant** — a property that must always hold (`size ∈ [0, capacity]`); assert it, don't assume it.
- **SUT** — system under test; the class you're building.
- **Complexity budget** — the target Big-O you commit to out loud before coding.

**Why interviewers ask this**

Open-ended katas are the highest-signal interview format because they can't be pattern-matched to a memorised answer. A junior jumps straight into implementation, discovers the API is wrong halfway, and runs out of time with an untested tangle. A senior spends the first few minutes making the problem smaller: clarifying the spec, naming the API, and writing a test list on the whiteboard. Interviewers watch for exactly that sequencing — do you *design before you type*, do you *let tests drive*, do you *state your complexity and thread-safety assumptions* rather than leave them implicit. Writing tests first is itself a strong signal: it shows you can specify behaviour precisely and that you value correctness over speed. The candidate who says "let me write the eviction-order test first so we agree on the behaviour" reads as someone who ships reliable code; the one who silently codes for fifteen minutes reads as a risk.

**Common confusions**

- "Tests-first slows me down" — it front-loads the thinking you'd otherwise do (badly) at the end; it's faster to green than debug-by-print.
- "I should build the whole thing then test it" — you'll discover API mistakes too late; grow it one tested behaviour at a time.
- "Clarifying questions waste time" — one wrong assumption (nulls allowed? sliding vs fixed window?) costs more than the whole clarifying pass.
- "Thread-safety is an afterthought" — decide single- vs multi-threaded up front; it changes the data structures and the tests.
- "More code = more progress" — the correct, small, tested core beats a large half-working sketch every time.

**What follows from this topic**

Every kata in this section applies this loop. The next topic — the JUnit 5 Testing Toolkit — gives you the concrete tools to write the tests this method demands: assertions, exception and timeout checks, injected clocks for time-based katas (rate limiter, retry, circuit breaker, scheduler), and the reusable concurrency stress harness that recurs across the concurrent katas (bank, cache, blocking queue, connection pool, idempotency, lock-free). Read those two topics first; then each kata is just "apply the loop to this one data structure or primitive".

### The first five minutes: clarify before you code

Before touching the keyboard, turn the vague prompt into a spec with a handful of targeted questions. The answers become your test list.

- **Bounds & capacity** — "Is the cache/pool/queue bounded? What's the capacity? What happens at the limit — evict, block, or reject?"
- **Null & argument rules** — "Can keys/values be null? Should bad arguments throw or be ignored?" (Decides your `assertThrows` tests.)
- **Concurrency** — "Single-threaded or accessed by many threads?" This is the biggest fork: it changes your data structures (`HashMap` vs `ConcurrentHashMap`, plain field vs `AtomicInteger`) and adds a whole stress-test group.
- **Ordering & tie-breaks** — "For eviction, which entry goes first? How are ties broken?" (LRU by recency, LFU by frequency then recency.)
- **Return shape** — "Miss returns `Optional.empty()` or `null` or throws?" The signature falls out of this.

State your assumptions out loud and write them down. You're not just gathering requirements — you're showing the interviewer you design deliberately.

### Design the smallest API first

Write the interface before any logic. Aim for the minimal set of methods that satisfies the spec, with signatures that make invariants expressible and the caller's code clean.

```java
interface Cache<K, V> {
    Optional<V> get(K key);   // miss = empty, not null
    void put(K key, V value); // evicts on overflow
    int size();               // always in [0, capacity]
    void clear();
}
```

Good signatures encode decisions: `Optional<V>` says "misses are normal, not exceptional"; `int size()` invites the `size ∈ [0, capacity]` invariant test. Pick names and types that a caller would want, then let the tests hold you to them.

### Write the tests, then the implementation

With the API fixed, enumerate behaviours as a test list and write them as failing tests — in this order, so each layer builds on the last:

1. **Contract** — the happy-path round-trip (`put` then `get` returns the value; `size` reflects count).
2. **Core behaviour** — the thing the kata is actually about (LRU eviction order, token refill, state transition).
3. **Edges & validation** — capacity 1, empty, duplicate keys, null/negative args → `assertThrows`.
4. **Concurrency** — (if multi-threaded) the stress test that fails an unsynchronised implementation.

Only now implement, making one group green at a time. Because you used your own API in the tests first, design mistakes surface immediately, and the eviction/ordering/race bugs announce themselves the moment they appear instead of during the final scramble.

### Running the loop and managing the clock

The practice module ships with **no tests** — writing them is the exercise. Put yours under `practice/src/test/java/org/kata/<pkg>/` and run:

```bash
export JAVA_HOME=$(/usr/libexec/java_home -v 21)
mvn -pl practice test        # your tests drive your impl
mvn -pl solution test        # the reference suite (green) — diff after your attempt
```

Time-box it: clarify (≈3 min) → API (≈3 min) → tests + impl in tight loops → complexity/thread-safety wrap-up. If stuck, the `solution/` twin is the answer key — but attempt first, then diff. State your final time **and** space complexity out loud; interviewers grade the reasoning, not just the green bar.


## Testing Toolkit (JUnit 5)

### Summary

**What this topic covers**

The concrete testing tools every kata in this section leans on, so that "write the tests first" is a mechanical act rather than a blank-page problem. Three things trip candidates up when they have to drive their own tests: asserting on exceptions and time-outs cleanly, testing **time-dependent** behaviour without `Thread.sleep` making the suite slow and flaky, and testing **concurrent** behaviour so that a real race actually fails the test instead of passing by luck. This topic gives you the JUnit 5 vocabulary (`assertEquals`/`assertThrows`/`assertTimeout`/`assertAll`, parameterized tests, lifecycle hooks), the pattern for **injecting a clock** so time-based katas (rate limiter, retry, circuit breaker, scheduler) are deterministic, and a reusable **concurrency stress harness** that surfaces lost updates and corruption in the concurrent katas (bank, cache, blocking queue, connection pool, idempotency, lock-free). Master these once and every kata's "Write the tests" step is just choosing which of them applies.

**Mental model**

A test is an executable specification: **Arrange** the SUT and inputs, **Act** by calling the method, **Assert** the observable outcome — never the private internals. The three hard cases each need a specific trick. For **exceptions**, don't try/catch — `assertThrows` returns the caught exception so you can assert on its message. For **time**, the flaky path is real wall-clock sleeping; the robust path is to make time an *input*: pass a `Supplier<Long>`/`Clock`/`nanoTime` source into the SUT so a test can advance it instantly and deterministically — a rate limiter test can "wait" a second without waiting. For **concurrency**, a single-threaded test can't catch a race; you need N threads released simultaneously by a `CountDownLatch` start-gate, all hammering the SUT, then joined, then an invariant check (total transferred == 0, no elements lost, action ran exactly once). Because races are probabilistic, you raise the odds of catching them with high thread counts, many iterations, and a shared counter that only survives if every increment was safe.

**Key terms**

- **AAA** — Arrange, Act, Assert; the shape of every test.
- **`assertThrows(Ex.class, () -> …)`** — asserts a lambda throws; returns the exception for further assertions.
- **`assertTimeoutPreemptively(dur, exec)`** — fails if the code exceeds a duration (async/blocking katas).
- **`assertAll(...)`** — groups assertions so all failures report, not just the first.
- **`@ParameterizedTest` + `@ValueSource`/`@CsvSource`** — run one test across many inputs (change-making, backoff steps).
- **`@BeforeEach` / `@AfterEach`** — fresh SUT per test; tear down thread pools.
- **Injected clock** — time as a constructor dependency (`Supplier<Long> nanos`), advanced by tests deterministically.
- **`CountDownLatch` start-gate** — release all worker threads at once to maximise contention.
- **`ExecutorService` + `invokeAll`/`Future`** — run the concurrent workload and surface worker exceptions.
- **`AtomicInteger` / `ConcurrentHashMap`** — safe shared counters/collectors in the harness itself.
- **Invariant assertion** — the post-run check (`sum == 0`, `dequeued.size() == enqueued`) that a race would break.
- **Fake/stub collaborator** — a hand-written flaky service or fixed-response dependency; no Mockito needed.

**Why interviewers ask this**

Driving your own tests is the part of the interview that separates people who *say* they do TDD from people who *do*. Anyone can write a happy-path assertion; the signal is whether you reach for `assertThrows` on the validation case, whether you make time an input instead of sleeping, and — the big one — whether you can write a test that actually **proves** thread-safety rather than hand-waving "it uses a lock so it's fine". A candidate who spins up an `ExecutorService`, gates it with a latch, and asserts an invariant after joining demonstrates they understand *why* concurrent code is hard and *how* to gain confidence in it. That's staff-level signal. Conversely, a `Thread.sleep(1000)` in a test tells the interviewer you'll ship slow, flaky suites.

**Common confusions**

- "Test the private fields" — test observable behaviour through the public API; internals are free to change.
- "`Thread.sleep` to test timing" — flaky and slow; inject and advance a clock instead.
- "One run proves thread-safety" — races are probabilistic; use many threads × many iterations + an invariant.
- "`assertTimeout` vs `assertTimeoutPreemptively`" — the preemptive form interrupts the thread; use it for code that could hang.
- "I need Mockito" — a 10-line hand-written fake (a service that fails twice then succeeds) is clearer for these katas.
- "Catch the exception myself" — `assertThrows` is cleaner and asserts a throw actually happened.

**What follows from this topic**

Each kata's "Write the tests" card applies this toolkit: LLD katas (parking, vending, elevator, order book) lean on AAA + parameterized + `assertThrows`; time-based katas (rate limiter, retry, circuit breaker, scheduler) lean on the injected clock; the concurrent katas (bank, cache's `ConcurrentLruCache`, blocking queue, connection pool, idempotency, lock-free) all reuse the stress harness below. When a kata card shows a stress test, it's an instance of this pattern — come back here for the template.

### The JUnit 5 essentials

```java
@Test
void put_then_get_roundtrips() {
    var c = new LruCache<String,Integer>(3);   // Arrange
    c.put("a", 1);                              // Act
    assertEquals(1, c.get("a").orElseThrow());  // Assert
}

@Test
void rejects_zero_capacity() {
    var ex = assertThrows(IllegalArgumentException.class,
                          () -> new LruCache<>(0));
    assertTrue(ex.getMessage().contains("capacity"));
}

@ParameterizedTest
@CsvSource({ "30,25,1", "30,1,4" })   // amount, paid, expectedCoins
void makes_correct_change(int amt, int paid, int coins) { … }
```

- Use `assertAll(...)` when several properties should all be checked and reported together.
- `@BeforeEach` builds a fresh SUT; `@AfterEach` shuts down any executor so tests don't leak threads.

### Testing time without sleeping (inject the clock)

Time-based katas are only testable if time is an **input**, not `System.nanoTime()` buried inside. Make it a dependency:

```java
class TokenBucket {
    private final LongSupplier nanos;      // inject the clock
    TokenBucket(int cap, double perSec, LongSupplier nanos) { … }
}

@Test
void refills_after_one_second() {
    long[] now = {0};
    var b = new TokenBucket(10, 10, () -> now[0]);
    drain(b);                       // empty it
    assertFalse(b.tryAcquire());    // no tokens
    now[0] = 1_000_000_000L;        // advance 1s — instantly
    assertTrue(b.tryAcquire());     // refilled, no real waiting
}
```

Deterministic, instant, non-flaky. The same pattern tests retry backoff, circuit-breaker OPEN→HALF_OPEN timeouts, and scheduler due-times.

### The concurrency stress-test harness

The reusable pattern that makes real races fail. Release N threads at once, hammer the SUT, join, then assert an invariant that a lost update would break.

```java
@Test
void concurrent_ops_preserve_invariant() throws Exception {
    int threads = 16, itersEach = 10_000;
    var pool = Executors.newFixedThreadPool(threads);
    var start = new CountDownLatch(1);            // start-gate
    var done  = new CountDownLatch(threads);
    var sut = new ConcurrentLruCache<Integer,Integer>(64);

    for (int t = 0; t < threads; t++) {
        pool.submit(() -> {
            start.await();                         // all block here
            for (int i = 0; i < itersEach; i++) {
                sut.put(i % 128, i);
                sut.get(i % 128);
            }
            done.countDown(); return null;
        });
    }
    start.countDown();                             // release together
    assertTrue(done.await(10, TimeUnit.SECONDS));  // no deadlock
    pool.shutdownNow();
    assertTrue(sut.size() <= 64);                  // invariant holds
}
```

- The **start-gate** (`CountDownLatch(1)`) maximises real overlap so contention actually happens.
- Assert an **invariant**, not exact values: `size <= capacity`, `transfers sum to zero`, `dequeued.size() == enqueued.size()`, or "the action ran exactly once".
- Turn up `threads × iters` and collect worker exceptions (`Future.get()` rethrows) so a thread that blew up fails the test instead of dying silently.
- For lost-update katas (bank transfer, idempotency), have every thread mutate shared state and assert the conserved quantity at the end — an unsynchronised impl fails; a correct one passes every run.


## Cache — LRU · LFU · Concurrent

### Summary

**What this topic covers**
This kata asks you to build two bounded in-memory caches from scratch with **O(1) `get` and `put`** — one with a Least-Recently-Used eviction policy, one with Least-Frequently-Used — then make the LRU thread-safe. You implement a small `Cache<K,V>` contract (`get`, `put`, `size`, `clear`) three times: `LruCache` (HashMap + doubly-linked list), `LfuCache` (frequency buckets + `minFreq` scalar), and `ConcurrentLruCache` (an `LruCache` guarded by a single lock). It is the single most common data-structure interview question, and the LFU variant separates people who have memorised LRU from people who actually understand eviction.

**Mental model**
Every eviction policy is the same shape: a **fast lookup structure** (a `HashMap` from key to some node) plus a **secondary ordering structure** that answers "who gets evicted next?" in O(1). For LRU the ordering is a doubly-linked list: head is most-recent, the node just before the tail sentinel is the eviction victim, and every hit *unlinks-and-moves-to-front*. The map exists so you can jump straight to any node and unlink it in O(1); the list is doubly-linked so an interior unlink needs no predecessor scan. For LFU the ordering is a `Map<Integer, LinkedHashSet<K>>` from frequency → keys-at-that-frequency, plus an `int minFreq` that always points at the non-empty lowest bucket. Eviction is `freqToKeys.get(minFreq).iterator().next()`. The `LinkedHashSet` gives LRU tie-breaking within a frequency for free. The whole game is keeping `minFreq` correct.

**Key terms**
- **Intrusive doubly-linked list** — each cache node carries its own `prev`/`next`, so no wrapper node is allocated and any node unlinks in O(1).
- **Sentinel head/tail** — permanent dummy nodes so every real node has non-null neighbours; collapses four boundary cases to one.
- **Move-to-front / promotion** — on every LRU hit, unlink the node and re-insert after head. This is why `get` mutates.
- **Frequency bucket** — `freqToKeys.get(f)` is the ordered set of keys accessed exactly `f` times.
- **minFreq** — scalar tracking the lowest occupied frequency; makes finding the eviction candidate O(1).
- **LRU tie-break** — within a frequency bucket, `LinkedHashSet` insertion order = recency, so `iterator().next()` is the LRU key.
- **Cache-aside / look-aside** — a miss returns `empty`; the caller (not the cache) fetches from the backing store.
- **ReentrantLock** — the single mutex serialising the concurrent variant; chosen over `ReadWriteLock` because LRU `get` writes.

**Why interviewers ask this**
LRU-from-scratch tests whether you can compose two structures to hit a complexity bound rather than reach for `LinkedHashMap`. A junior produces an O(n) "scan for the LRU/LFU" or forgets that `get` must promote. A mid-level nails LRU with sentinels. A senior does three extra things: names `LinkedHashMap(cap, 0.75f, true)` as the real production shortcut and explains why the hand-roll exists; gets `minFreq` maintenance provably correct on LFU; and explains why a `ReadWriteLock` is useless here (every LRU read mutates the recency list, so all callers need the write lock) and why lock-striping fails (the shared tail pointer crosses stripes). Bonus signal: naming Caffeine / W-TinyLFU as the state of the art.

**Common confusions**
- *"`get` is a read, so use a read lock."* No — LRU `get` promotes, mutating the list. Everyone needs the write lock; `ReentrantLock` is correct.
- *"LFU evicts the oldest key."* No, the least *frequent*; recency is only the tie-break inside `minFreq`.
- *"`minFreq` needs recomputing after eviction."* No — a new key is always inserted right after, resetting `minFreq = 1`.
- *"A new LFU key inherits the current `minFreq`."* No, every new key starts at frequency 1 and forces `minFreq = 1`.
- *"Singly-linked list is fine."* It can't unlink an interior node in O(1) — no back-pointer to fix.
- *"Updating an existing key can evict."* Never — an update changes value + promotes, size unchanged.

**What follows from this topic**
The HashMap-plus-ordering pattern recurs everywhere: `LinkedHashMap`, `TreeMap` range queries, and LFU's frequency-bucket trick reappears almost verbatim in sliding-window rate limiters and in-memory schedulers. The concurrency lesson — reach for one correct lock first, prove it, and only then measure whether striping or a lock-free deque is worth the complexity — sets up the lock-free and bounded-blocking-queue katas, where the same "single lock vs. fine-grained" tension returns with sharper teeth. And the production tangent (LRU scan pollution, LFU frequency bias, midpoint insertion in InnoDB's buffer pool, W-TinyLFU's count-min-sketch plus periodic decay for aging) is the bridge from this coding exercise to the real cache-design and system-design questions that follow it in a senior loop.

### Clarify & design the API

Before touching a data structure, pin the contract with a few questions:

- **Miss semantics?** Return `Optional.empty()` (not null, not throw). Cache-aside: a miss does not fetch.
- **Does `get` mutate?** Yes for LRU (promote) and LFU (increment freq). Say this out loud — it drives the whole design.
- **Update vs insert?** `put` on an existing key updates the value and promotes/increments; it must **not** evict and must **not** change `size()`.
- **Null keys/values?** Contract says both non-null; keys need valid `equals`/`hashCode` (HashMap).
- **Capacity floor?** `capacity >= 1`; reject `0`/negative in the constructor.
- **LFU tie-break?** Least-frequent, then least-recently-used within that frequency.

Commit to one interface, three implementations:

```java
public interface Cache<K, V> {
    Optional<V> get(K key);
    void put(K key, V value);
    int size();          // always in [0, capacity]
    void clear();
}

class LruCache<K,V> implements Cache<K,V>            { LruCache(int capacity) {…} }
class LfuCache<K,V> implements Cache<K,V>            { LfuCache(int capacity) {…} }
class ConcurrentLruCache<K,V> implements Cache<K,V>  { ConcurrentLruCache(int capacity) {…} }
```

### Write the tests — LRU

Write these **first**. They pin the spec, grouped exactly like the reference `LruCacheTest`: basic contract → eviction order → update semantics → boundary/validation.

**Group 1 — basic contract.** Roundtrip, miss, size, clear, and `capacity == 1`.

```java
@Test void get_returns_empty_for_missing_key() {
    var cache = new LruCache<String, Integer>(3);
    assertTrue(cache.get("absent").isEmpty());
}

@Test void capacity_of_one_always_holds_latest_entry() {
    var cache = new LruCache<String, Integer>(1);
    cache.put("a", 1);
    cache.put("b", 2);            // "a" evicted
    assertTrue(cache.get("a").isEmpty());
    assertEquals(2, cache.get("b").orElseThrow());
}
```

**Group 2 — eviction order (the heart of LRU).** Plain eviction, then prove `get` *promotes* so the accessed key survives, then an interleaved-access ordering check.

```java
@Test void evicts_lru_entry_when_full() {
    var cache = new LruCache<String, Integer>(3);
    cache.put("a", 1); cache.put("b", 2); cache.put("c", 3);
    cache.put("d", 4);                       // "a" is LRU → evicted
    assertTrue(cache.get("a").isEmpty());
    assertEquals(3, cache.size());
}

@Test void get_promotes_entry_so_it_is_not_evicted_next() {
    var cache = new LruCache<String, Integer>(3);
    cache.put("a", 1); cache.put("b", 2); cache.put("c", 3);
    cache.get("a");                          // order: c, a, b(LRU)
    cache.put("d", 4);                       // evicts b, NOT a
    assertTrue(cache.get("b").isEmpty());
    assertEquals(1, cache.get("a").orElseThrow());
}
```

The `get_promotes` test is the one that fails a naive "insertion-order only" cache — it forces the move-to-front.

**Group 3 — update semantics.** An update must not grow size and must promote.

```java
@Test void updating_existing_key_promotes_it_to_mru() {
    var cache = new LruCache<String, Integer>(3);
    cache.put("a", 1); cache.put("b", 2); cache.put("c", 3);
    cache.put("a", 100);                     // update promotes a → b is LRU
    cache.put("d", 4);                       // evicts b
    assertTrue(cache.get("b").isEmpty());
    assertEquals(100, cache.get("a").orElseThrow());
}
```

**Group 4 — boundary & validation.** `assertThrows` on bad capacity, and a stress loop proving capacity is never exceeded.

```java
@Test void constructor_rejects_zero_capacity() {
    assertThrows(IllegalArgumentException.class, () -> new LruCache<>(0));
}

@Test void capacity_is_strictly_respected_over_many_inserts() {
    var cache = new LruCache<Integer, Integer>(5);
    for (int i = 0; i < 100; i++) {
        cache.put(i, i);
        assertTrue(cache.size() <= 5);
    }
}
```

### Write the tests — LFU

Same skeleton, but the interesting groups are **frequency-based eviction**, **LRU tie-breaking within a bucket**, and **`minFreq` maintenance**.

**Frequency eviction.** Drive different access counts, then prove the least-frequent key dies. Note the counting: the initial `put` counts as frequency 1, each `get` adds one.

```java
@Test void evicts_least_frequently_used_entry() {
    var cache = new LfuCache<String, Integer>(3);
    cache.put("a", 1); cache.put("b", 2); cache.put("c", 3);
    cache.get("a"); cache.get("a"); cache.get("a"); // freq(a)=4
    cache.get("c"); cache.get("c");                 // freq(c)=3, freq(b)=1
    cache.put("d", 4);                              // evicts b
    assertTrue(cache.get("b").isEmpty());
}
```

**LRU tie-break within a frequency.** All keys at freq 1 → evict the oldest.

```java
@Test void ties_broken_by_lru_within_same_frequency() {
    var cache = new LfuCache<String, Integer>(3);
    cache.put("a", 1); cache.put("b", 2); cache.put("c", 3); // all freq 1
    cache.put("d", 4);                                       // "a" is LRU at freq 1
    assertTrue(cache.get("a").isEmpty());
}
```

**`minFreq` maintenance — the regression that catches subtle bugs.** After many evict cycles `minFreq` must always point at a non-empty bucket; and a fresh key must reset `minFreq` to 1.

```java
@Test void new_key_always_resets_min_freq_to_one() {
    var cache = new LfuCache<String, Integer>(2);
    cache.put("a", 1); cache.put("b", 2);
    cache.get("a"); cache.get("a");   // freq(a)=3
    cache.get("b"); cache.get("b");   // freq(b)=3
    cache.put("c", 3);                // evicts a-or-b; c enters at freq 1
    cache.put("d", 4);                // c (freq 1) must be the victim
    assertTrue(cache.get("c").isEmpty());
}

@Test void min_freq_updates_correctly_across_multiple_evictions() {
    var cache = new LfuCache<Integer, Integer>(3);
    for (int i = 0; i < 20; i++) {
        cache.put(i, i * 10);
        if (i >= 1) cache.get(i - 1);
        if (i >= 2) cache.get(i - 2);
        assertTrue(cache.size() <= 3);    // never throws, never overflows
    }
}
```

Plus the mirror of the LRU groups: `updating_existing_key_increments_its_frequency`, and the constructor-rejects/capacity-respected boundary tests.

### Write the tests — ConcurrentLRU stress test

The concurrent variant re-runs the LRU behavioural tests (identical contract), **then** adds the tests that a single global lock must pass and an unsynchronised `LruCache` would fail. Under data races the doubly-linked list's pointers desync and a later `get` throws `NullPointerException` — so "no exception + size never exceeds capacity + no deadlock" is a real corruption detector.

```java
@Test
void concurrent_puts_and_gets_never_corrupt_state() throws Exception {
    int capacity = 20;
    var cache = new ConcurrentLruCache<Integer, Integer>(capacity);
    int N = 300;
    var gate = new CountDownLatch(1);          // release all threads at once
    var done = new CountDownLatch(N);
    var failed = new AtomicBoolean(false);

    try (var exec = Executors.newVirtualThreadPerTaskExecutor()) {
        IntStream.range(0, N).forEach(i -> exec.submit(() -> {
            try {
                gate.await();
                int key = i % 30;              // overlap → contention + evictions
                cache.put(key, i);
                cache.get(key);
                if (cache.size() > capacity) failed.set(true);
            } catch (Exception e) {
                failed.set(true);              // NPE from a corrupted list lands here
            } finally {
                done.countDown();
            }
        }));
        gate.countDown();
        assertTrue(done.await(5, TimeUnit.SECONDS), "deadlock?");
    }
    assertFalse(failed.get());
    assertTrue(cache.size() <= capacity);
}
```

Three variants matter, each targeting a different race:
- **disjoint keys** — pure eviction pressure, no key sharing; capacity must still hold.
- **concurrent gets on a full cache** — all threads promote the same keys, maximum contention on the recency list.
- **readers + writers** — one group inserts, one looks up; assert `hits > 0` so you know the cache wasn't silently returning empty.

The `CountDownLatch` gate is the trick: it releases every thread simultaneously to maximise the chance of exposing a race. Run this against an unlocked `LruCache` and it throws; that failing run is the proof your lock earns its keep.

### Implement it

**LRU — HashMap + intrusive doubly-linked list, O(1) get/put.** `head`/`tail` sentinels; `map` from key to node; every hit and every update calls `moveToFront`; eviction removes `tail.prev`.

```java
public Optional<V> get(K key) {
    Node node = map.get(key);
    if (node == null) return Optional.empty();
    moveToFront(node);                 // unlink + insert-after-head
    return Optional.of(node.value);
}
public void put(K key, V value) {
    Node existing = map.get(key);
    if (existing != null) { existing.value = value; moveToFront(existing); return; }
    if (map.size() == capacity) evictLru();   // remove tail.prev, drop from map
    Node node = new Node(key, value);
    map.put(key, node);
    insertAtFront(node);
}
private void unlink(Node n)      { n.prev.next = n.next; n.next.prev = n.prev; }
private void insertAtFront(Node n){ n.next = head.next; n.prev = head; head.next.prev = n; head.next = n; }
```

The node stores its **key** (not just value) so eviction can `map.remove(lru.key)` without scanning. Complexity: O(1) amortised get/put; O(1) list rewiring on clear.

**LFU — frequency buckets + minFreq, O(1) get/put.** Node carries `value` + `freq`. `promoteKey` moves a key from bucket `f` to `f+1` and nudges `minFreq`:

```java
private void promoteKey(K key, Node<V> node) {
    int f = node.freq;
    LinkedHashSet<K> bucket = freqToKeys.get(f);
    bucket.remove(key);
    if (bucket.isEmpty()) {
        freqToKeys.remove(f);
        if (f == minFreq) minFreq = f + 1;      // only place minFreq climbs
    }
    node.freq = f + 1;
    freqToKeys.computeIfAbsent(node.freq, k -> new LinkedHashSet<>()).add(key);
}
private void evictLfu() {
    LinkedHashSet<K> min = freqToKeys.get(minFreq);
    K victim = min.iterator().next();           // O(1) LRU key at minFreq
    min.remove(victim);
    if (min.isEmpty()) freqToKeys.remove(minFreq);
    keyToNode.remove(victim);
}
```

New-key `put` inserts at freq 1 and sets `minFreq = 1` unconditionally. The subtle invariant: `minFreq` can only climb by exactly 1 (frequencies are integers incremented one at a time, and the key you just promoted guarantees `f+1` is non-empty), and eviction doesn't recompute it because the following insert resets it to 1.

**ConcurrentLRU — one ReentrantLock over an LruCache.** Do not re-implement LRU; wrap it. Every method is `lock()/try/finally unlock()`.

```java
private final LruCache<K, V> delegate;
private final ReentrantLock lock = new ReentrantLock();

public Optional<V> get(K key) {
    lock.lock();
    try { return delegate.get(key); }   // promotion happens under the lock
    finally { lock.unlock(); }
}
```

The `try/finally` is mandatory: an unchecked exception must not leave the lock held, or the cache becomes permanently unusable. A `ReadWriteLock` is wrong here because `get` promotes — it writes.

### Common mistakes & senior signal

- **O(n) eviction.** Scanning for the LRU/LFU victim defeats the point. LRU: it's `tail.prev`. LFU: it's `freqToKeys.get(minFreq).iterator().next()`.
- **Singly-linked list.** Can't unlink an interior node in O(1) — you need the back-pointer. Use a doubly-linked list with sentinels.
- **Forgetting `get` promotes.** The `get_promotes` / `get_increments` tests exist precisely to catch this. A cache whose `get` is a pure read is not LRU/LFU.
- **Node stores only the value.** Eviction then can't find the key to remove from the map — store the key on the LRU node.
- **Botched `minFreq`.** The classic LFU bug: resetting or advancing `minFreq` at the wrong moment leaves it pointing at an empty bucket, and the next eviction NPEs. Reset to 1 on new insert; advance only when the min bucket empties on promotion.
- **`ReadWriteLock` for the concurrent variant.** Tempting and wrong — reads mutate. One `ReentrantLock` is the correct, simple answer.
- **Lock inside `try` incorrectly.** `lock()` goes *before* the `try`; `unlock()` in `finally`. Locking inside the try risks unlocking a lock you never acquired.

**Senior tells:** names `LinkedHashMap(cap, 0.75f, true)` + `removeEldestEntry` as the real production LRU and explains the hand-roll is interview theatre; pre-sizes the HashMap to `(int)(capacity/0.75f)+1`; explains why striping/`ReadWriteLock` fail before defaulting to one lock; and reaches for Caffeine / W-TinyLFU when asked "what would you actually ship?", noting LRU's scan pollution and LFU's frequency bias as the reasons pure policies lose in production.


## Bounded Blocking Queue

### Summary

**What this topic covers**
This kata asks you to build a generic, fixed-capacity blocking queue from scratch — a hand-rolled `java.util.concurrent.ArrayBlockingQueue`. Producers call `put(E)` and block when the queue is full; consumers call `take()` and block when it is empty. The instant space or an element becomes available, the right waiting threads wake and proceed. It is the single most common Java concurrency data-structure question because passing it demands fluent command of `ReentrantLock`, `Condition`, the `signal()` vs `signalAll()` distinction, and the `while`-loop wait idiom — all under a real producer/consumer stress test. You design the backing structure (a circular array), the locking strategy (one lock), and the blocking/waking logic (two conditions) yourself.

**Mental model**
Picture one `ReentrantLock` guarding all mutable state, and two waiting rooms hanging off it: `notFull` (producers wait here when the buffer is full) and `notEmpty` (consumers wait here when it is empty). A `put` acquires the lock, waits on `notFull` until there is space, writes the element, then rings `notEmpty` to wake exactly one consumer. A `take` mirrors it: wait on `notEmpty` until there is an element, read it, then ring `notFull` to wake exactly one producer. The waiting is always a `while` loop re-checking the predicate — never an `if` — because `await()` can return spuriously and because another thread may grab the freed slot before the woken thread is scheduled. Storage is a circular array: `head` (next read) and `tail` (next write) advance modulo capacity, and a separate `size` counter tells full from empty. Two conditions instead of one is the crux: it lets you `signal()` one correct waiter rather than `signalAll()` a mixed crowd.

**Key terms**
- **circular array (ring buffer)** — fixed-length `Object[]` with `head`/`tail` cursors wrapping modulo capacity; O(1) enqueue/dequeue, no per-item allocation, cache-friendly.
- **`ReentrantLock`** — the single lock guarding `head`, `tail`, `size`, and the buffer. One lock keeps all state transitions atomic and mutually consistent.
- **`Condition`** — a wait/notify queue derived from a lock via `lock.newCondition()`. Replaces `Object.wait/notify`; you can have several per lock.
- **`notFull` / `notEmpty`** — the two conditions. Producers await `notFull`, consumers await `notEmpty`; each side signals the other's condition.
- **`await()`** — atomically releases the lock and parks the thread; on wake it re-acquires the lock before returning. Must be called holding the lock.
- **`signal()` vs `signalAll()`** — `signal()` wakes one waiter; `signalAll()` wakes all. Two conditions let you use the cheaper `signal()` correctly.
- **spurious wakeup** — `await()` returning with no matching signal, permitted by POSIX/JVM. The reason the guard must be a `while` loop.
- **`lockInterruptibly()`** — acquires the lock but throws `InterruptedException` if interrupted while waiting, so blocked producers/consumers stay cancellable.
- **`finally`-unlock** — the critical section's unlock lives in `finally` so an exception never leaves the lock held (which would deadlock the whole queue).
- **GC hygiene** — `take()` nulls the vacated slot so the array does not pin a dead reference in a long-lived queue.

**Why interviewers ask this**
It is a compact but merciless test of whether you actually understand concurrency or have only memorised keywords. A junior reaches for `synchronized` + `wait/notify`, guards with `if`, and calls `notifyAll()` everywhere — it often "works" on a laptop and hides races. A senior reaches for `ReentrantLock` with two `Condition`s, guards every wait with `while`, unlocks in `finally`, uses `signal()` on the correct condition, and can explain precisely why each choice is correct: why two conditions halve context switches, why `while` beats `if`, why the lock must be released atomically inside `await()`. The strongest signal is the candidate who writes the producer/consumer stress test unprompted and reasons about what an `if` guard would corrupt under it.

**Common confusions**
- **"`if (size == 0) await()` is fine."** No — a spurious wakeup, or another consumer stealing the item first, leaves you reading from an empty queue. Always `while`.
- **"One condition is simpler."** It forces `signalAll()` (you cannot tell producers from consumers on a shared queue), waking threads that immediately re-block — wasted work under contention.
- **"`signal()` might lose a wakeup."** Not with the `while` guard: any thread that could make progress re-checks the predicate on wake; correctness never rests on which single thread was signalled.
- **"`await()` keeps the lock while parked."** It releases the lock atomically on the way in and re-acquires it on the way out — that is why another thread can enter and change `size`.
- **"Nulling the slot in `take` is optional."** Functionally yes, but omitting it leaks memory in long-lived queues by pinning dead objects.

**What follows from this topic**
This is the atom of producer/consumer systems: thread pools, bounded work queues, and backpressure all rest on exactly this blocking-when-full/empty contract. The two-condition pattern generalises to any resource with multiple wait predicates (read/write locks, bounded semaphores). Related katas: a `RateLimiter` (condition-timed waiting), a lock-free queue (CAS instead of a lock), and a thread pool (this queue as its task backlog). See the Java primer's producer/consumer and `synchronized` vs `Lock` entries.

### Clarify & design the API

Questions to settle before writing a line of logic:
- **Bounded and blocking?** Yes — fixed capacity; `put` blocks when full, `take` blocks when empty (versus a `offer`/`poll` non-blocking variant).
- **Nulls allowed?** No — reject with `NullPointerException`; a null would be ambiguous with an empty slot.
- **FIFO ordering guaranteed?** Yes — head-to-tail insertion order.
- **Interruption?** Blocked `put`/`take` must throw `InterruptedException` so callers can cancel.
- **Fairness / multiple producers-consumers?** Assume many of each, contending simultaneously; single lock is acceptable unless asked to optimise.

Commit to this surface first:

```java
public class BoundedBlockingQueue<E> {
    public BoundedBlockingQueue(int capacity);   // capacity >= 1 or IllegalArgumentException
    public void put(E element) throws InterruptedException;   // blocks when full; NPE on null
    public E    take()          throws InterruptedException;   // blocks when empty
    public int  size();          // point-in-time count
    public int  capacity();      // fixed maximum
}
```

### Write the tests

Write these FIRST — they pin the spec, and the concurrency ones fail loudly against a naive `if`-guarded or unsynchronised implementation. Group them: basic contract → blocking behaviour → the stress tests → argument validation.

**Basic contract — FIFO and size accounting.** Cheap, single-threaded, catches cursor/modulo bugs immediately.

```java
@Test
void basic_put_and_take_fifo_order() throws InterruptedException {
    var q = new BoundedBlockingQueue<Integer>(3);
    q.put(1); q.put(2); q.put(3);
    assertEquals(1, q.take());
    assertEquals(2, q.take());
    assertEquals(3, q.take());
}

@Test
void size_reflects_current_element_count() throws InterruptedException {
    var q = new BoundedBlockingQueue<String>(5);
    assertEquals(0, q.size());
    q.put("a"); assertEquals(1, q.size());
    q.put("b"); assertEquals(2, q.size());
    q.take();   assertEquals(1, q.size());
}
```

**Blocking behaviour — the core of the kata.** Prove `put` blocks on a full queue and unblocks after a `take`, and symmetrically that `take` blocks on empty until a `put`. Drive it with a helper thread and `CountDownLatch`es: start the blocked op, assert it has *not* finished after a short grace period, trigger the freeing op, then assert it finishes. This is what separates a real blocking queue from a busy-wait or a no-op.

```java
@Test
void put_blocks_when_full_until_take_frees_space() throws Exception {
    var q = new BoundedBlockingQueue<Integer>(1);
    q.put(42);                         // queue now full
    var started  = new CountDownLatch(1);
    var finished = new CountDownLatch(1);
    try (var exec = Executors.newVirtualThreadPerTaskExecutor()) {
        exec.submit(() -> {
            try { started.countDown(); q.put(99); finished.countDown(); }
            catch (InterruptedException e) { Thread.currentThread().interrupt(); }
        });
        assertTrue(started.await(2, TimeUnit.SECONDS));
        assertFalse(finished.await(50, TimeUnit.MILLISECONDS),
            "putter should still be blocked while queue is full");
        assertEquals(42, q.take());    // frees a slot
        assertTrue(finished.await(2, TimeUnit.SECONDS),
            "putter should unblock after take");
        assertEquals(99, q.take());
    }
}

@Test
void take_blocks_when_empty_until_put_arrives() throws Exception {
    var q = new BoundedBlockingQueue<String>(5);
    var started = new CountDownLatch(1);
    var got     = new CountDownLatch(1);
    var holder  = new String[1];
    try (var exec = Executors.newVirtualThreadPerTaskExecutor()) {
        exec.submit(() -> {
            try { started.countDown(); holder[0] = q.take(); got.countDown(); }
            catch (InterruptedException e) { Thread.currentThread().interrupt(); }
        });
        assertTrue(started.await(2, TimeUnit.SECONDS));
        assertFalse(got.await(50, TimeUnit.MILLISECONDS),
            "taker should be blocked while queue is empty");
        q.put("hello");
        assertTrue(got.await(2, TimeUnit.SECONDS), "taker should unblock after put");
        assertEquals("hello", holder[0]);
    }
}
```

**The stress test — no item lost, no item duplicated.** This is the one that fails an `if`-guard or a missing lock. Run N producers each putting M items and N consumers draining until all `N*M` are consumed, with capacity deliberately smaller than the total to force real blocking. Track each value in a `ConcurrentHashMap<Integer, AtomicInteger>` and assert every value was seen exactly once. A race — lost signal, `if` guard reading from an empty queue, torn `size` update — shows up here as a missing item, a duplicate, or a timeout.

```java
@Test
void concurrent_producers_consumers_all_items_consumed_exactly_once() throws Exception {
    final int N = 4, M = 100, total = N * M;
    var q = new BoundedBlockingQueue<Integer>(10);   // capacity < total forces blocking
    var gate = new CountDownLatch(1);
    var done = new CountDownLatch(N + N);
    var seen = new ConcurrentHashMap<Integer, AtomicInteger>();
    try (var exec = Executors.newVirtualThreadPerTaskExecutor()) {
        for (int i = 0; i < N; i++) {
            final int id = i;
            exec.submit(() -> {
                try { gate.await(); for (int j = 0; j < M; j++) q.put(id * M + j); }
                catch (InterruptedException e) { Thread.currentThread().interrupt(); }
                finally { done.countDown(); }
            });
        }
        var remaining = new AtomicInteger(total);
        for (int i = 0; i < N; i++) {
            exec.submit(() -> {
                try {
                    gate.await();
                    while (remaining.decrementAndGet() >= 0) {
                        Integer item = q.take();
                        seen.computeIfAbsent(item, k -> new AtomicInteger()).incrementAndGet();
                    }
                } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
                finally { done.countDown(); }
            });
        }
        gate.countDown();
        assertTrue(done.await(10, TimeUnit.SECONDS), "producer/consumer threads timed out");
    }
    assertEquals(total, seen.size());
    seen.forEach((k, v) -> assertEquals(1, v.get(), "item " + k + " consumed " + v.get() + " times"));
}
```

**Capacity invariant under load.** A second concurrency test asserting the observed size never exceeds capacity — 25 producers and 25 consumers hammering a capacity-5 queue, sampling `size()` and folding the max with `accumulateAndGet(s, Math::max)`. Guards against a bug where `put` writes before confirming space.

**Argument validation — the fast `assertThrows` cases.** Null rejection and illegal capacity; cheap and they pin the contract edges.

```java
@Test void null_element_rejected() {
    var q = new BoundedBlockingQueue<String>(5);
    assertThrows(NullPointerException.class, () -> q.put(null));
}
@Test void capacity_below_one_rejected() {
    assertThrows(IllegalArgumentException.class, () -> new BoundedBlockingQueue<>(0));
}
```

### Implement it

Circular array plus one lock plus two conditions. `put` and `take` are O(1); `size`/`capacity` are O(1). Space is O(capacity). The whole correctness argument lives in four rules: guard with `while`, signal the *other* condition, `signal()` (not `signalAll()`) because you added/removed exactly one item, and unlock in `finally`.

```java
public class BoundedBlockingQueue<E> {
    private final Object[] buffer;
    private final int capacity;
    private int head = 0, tail = 0, size = 0;
    private final ReentrantLock lock = new ReentrantLock();
    private final Condition notFull  = lock.newCondition();
    private final Condition notEmpty = lock.newCondition();

    public BoundedBlockingQueue(int capacity) {
        if (capacity < 1) throw new IllegalArgumentException("capacity must be >= 1");
        this.capacity = capacity;
        this.buffer = new Object[capacity];
    }

    public void put(E element) throws InterruptedException {
        if (element == null) throw new NullPointerException("element must not be null");
        lock.lockInterruptibly();
        try {
            while (size == capacity) notFull.await();   // while, not if
            buffer[tail] = element;
            tail = (tail + 1) % capacity;               // advance circularly
            size++;
            notEmpty.signal();                          // wake exactly one consumer
        } finally {
            lock.unlock();                              // never leave the lock held
        }
    }

    @SuppressWarnings("unchecked")
    public E take() throws InterruptedException {
        lock.lockInterruptibly();
        try {
            while (size == 0) notEmpty.await();
            E element = (E) buffer[head];
            buffer[head] = null;                        // GC hygiene
            head = (head + 1) % capacity;
            size--;
            notFull.signal();                           // wake exactly one producer
            return element;
        } finally {
            lock.unlock();
        }
    }

    public int size() {
        lock.lock();
        try { return size; } finally { lock.unlock(); }
    }

    public int capacity() { return capacity; }
}
```

The key gotcha: `await()` atomically releases the lock while parked and re-acquires it before returning, so the world can change between the check and the wake — which is exactly why the guard must be a `while` loop re-testing `size`, not a one-shot `if`. Note the unchecked cast on `take`: generics are erased, so you cannot allocate an `E[]`; storing in `Object[]` and casting on the way out is the standard, safe idiom here.

### Common mistakes & senior signal

- **`if` instead of `while` around `await()`** — the single most common failure. A spurious wakeup, or a competing thread consuming the freed slot first, then proceeds on invalid state. The stress test exposes it as a lost or duplicated item.
- **One condition + `signal()`** — with a shared condition, `signal()` may wake a producer when only consumers can progress; it re-blocks, and under load the queue can stall. Either use two conditions with `signal()`, or one condition with `signalAll()` — never one condition with `signal()`.
- **Unlock outside `finally`** — an exception in the critical section leaves the lock held forever and deadlocks every other thread. `finally` is non-negotiable.
- **Signalling the wrong condition** — a producer must signal `notEmpty` (wake a consumer), a consumer must signal `notFull`. Signalling your own side wakes threads that cannot make progress.
- **Forgetting to null the vacated slot** — works functionally but leaks memory in long-lived queues by pinning dead references.
- **Using `size == 0` vs `head == tail` sloppily** — with a circular array, `head == tail` is ambiguous (both empty and full). A separate `size` counter disambiguates cleanly; senior candidates pick it deliberately and say why.
- **Senior signal** — writes the producer/consumer stress test unprompted, reasons about what an `if` guard corrupts under it, uses `lockInterruptibly()` so blocked ops stay cancellable, and closes by naming `ArrayBlockingQueue` as the production answer — this is a teaching re-implementation, not something you ship.


## Rate Limiters — Token · Leaky · Sliding Window

### Summary

**What this topic covers**
Three classic rate-limiting algorithms behind one narrow interface — `boolean tryAcquire(String key, int n)` — each implemented **per-key, lock-free, and with an injectable clock**. You build `TokenBucketRateLimiter` (bursty), `LeakyBucketRateLimiter` (smooth), and `SlidingWindowRateLimiter` (boundary-spike-free), all storing state in a `ConcurrentHashMap<String, AtomicReference<StateRecord>>` and mutating it through a CAS retry loop over an immutable record. The kata is deliberately time-based: the whole reason the clock is a `LongSupplier` parameter is so your tests advance time by mutating an `AtomicLong` instead of calling `Thread.sleep` — deterministic, instant, flake-free. Nail that one idea and the rest is arithmetic.

**Mental model**
Every algorithm is "lazy update on read". There is no background thread ticking tokens in or draining water out. On each `tryAcquire`, you read `now = clock.getAsLong()`, compute how much *should* have accumulated (token bucket), leaked (leaky bucket), or aged (sliding window) since the timestamp stored in the last state, derive the new state, decide admit/reject, then CAS the whole tuple in one atomic swap. The tuple is the crux: `(tokens, lastRefillNanos)` — or `(level, lastLeakNanos)`, or `(prevCount, currCount, windowStart)` — must move together. Two separate `AtomicLong`s would let a reader see a fresh count paired with a stale timestamp and double-refill. Bundling them in an immutable `record` inside a single `AtomicReference` makes "swap both or neither" a compiler-enforced property. The clock is monotonic (`System::nanoTime`), never wall-clock — `currentTimeMillis()` can jump backwards on NTP slew and make elapsed time negative.

**Key terms**
- **`tryAcquire(key, n)`** — the whole public API. `n` defaults to 1 via an interface `default` method. Returns immediately; never blocks or spins.
- **Compound-state CAS** — packing all fields into one immutable record so `AtomicReference.compareAndSet` swaps them atomically, closing the TOCTOU gap two atomics would leave.
- **Lazy update** — deriving accumulated/leaked/aged quantity from `now - lastNanos` on each call; an idle key costs zero CPU.
- **Injectable clock** — `LongSupplier` constructor arg; production `System::nanoTime`, tests `AtomicLong::get`.
- **Monotonic time** — `nanoTime()` only ever moves forward; the defence against `currentTimeMillis()` jumping back.
- **Token bucket** — refills N/sec up to `capacity`; permits bursts up to `capacity`. Start **full**.
- **Leaky bucket** — a water level that drains at a fixed rate; admits if `level + n <= capacity`. No bursts. Start **empty**.
- **Sliding window counter** — `prevCount × (1 − elapsed/windowSize) + currCount`; O(1) memory, kills the boundary spike.
- **Boundary spike** — the fixed-window bug where a client fires `2×limit` by straddling the reset instant.
- **Fast-reject** — early-exit `return false` *before* attempting a CAS when the request is already known to fail, so a flood of rejections doesn't contend on the atomic.
- **`computeIfAbsent`** — atomic lazy per-key initialisation; the factory runs at most once even under concurrent first-touch.

**Why interviewers ask this**
It bundles three things they want to see cold: a real concurrency primitive (lock-free CAS, not `synchronized`), an algorithm-design contrast (three ways to shape traffic, each with a distinct tradeoff), and — the sleeper — *testability of time-dependent code*. A junior reaches for `synchronized` and `Thread.sleep(1000)` in the test, producing a slow, flaky suite that can't assert refill precisely. A senior injects the clock, freezes or advances it by exact nanosecond deltas, and writes a concurrency stress test that would fail a naive non-atomic implementation. The senior also knows *which* algorithm fits *which* problem (public API vs traffic shaping vs login throttling) and can articulate the compound-state race and the fast-reject optimisation without prompting.

**Common confusions**
- "Use two `AtomicLong`s for count and timestamp" → no: they can be observed half-updated. One record, one `AtomicReference`.
- "Use `currentTimeMillis()`" → no: wall-clock jumps backwards; use `nanoTime()`.
- "A background thread refills tokens" → no: lazy derivation on read; no scheduler, idle keys free.
- "Token and leaky bucket are the same" → no: token allows bursts up to capacity; leaky enforces a hard smooth ceiling. Token starts full; leaky starts empty.
- "Fixed window is good enough" → it allows a 2× burst across the boundary; the sliding window counter weights the previous window to prevent it.
- "Store every request timestamp for the sliding window" → that's the O(n) *log*; the counter approximation is O(1) with ±1 error.

**What follows from this topic**
The CAS-retry-over-immutable-record pattern is the same one behind the lock-free stack/queue katas and any `AtomicReference` state machine; the injectable-clock discipline reappears in cache TTL/expiry katas and anything scheduler-driven. Scaling out swaps the `AtomicReference` for a Redis Lua script (atomic read-refill-decrement server-side) sharded by key. See also atomic classes and CAS fundamentals.

### Clarify & design the API

Questions worth asking before writing a line: **Per-key or global?** (per-key — keyed by client id). **Blocking or non-blocking?** (non-blocking `tryAcquire`, returns a boolean, never parks). **What does a brand-new key start at?** (token bucket full, leaky bucket empty, sliding window zero). **What time source?** (injectable monotonic clock — this is the testability hook). **What happens when `n > capacity`?** (reject immediately, don't spin).

Commit to the shared interface first, then three implementations behind it:

```java
public interface RateLimiter {
    default boolean tryAcquire(String key) { return tryAcquire(key, 1); }
    boolean tryAcquire(String key, int n);
}

// Each impl takes config + an injectable clock (prod defaults to System::nanoTime)
new TokenBucketRateLimiter(long capacity, double refillPerSec, LongSupplier clock);
new LeakyBucketRateLimiter(double capacity, double leakPerSec, LongSupplier clock);
new SlidingWindowRateLimiter(long limit, long windowNanos, LongSupplier clock);
```

The `LongSupplier clock` parameter is the single most important design decision in the whole kata — it's what makes time deterministic in tests. Provide a two-arg convenience constructor that defaults to `System::nanoTime` so production callers never see the clock.

### Write the tests

Write these **first** — they pin the spec and, crucially, drive the clock by hand so nothing sleeps. Group them: initial state → time-based behaviour → per-key isolation → argument validation → concurrency stress. The clock is just an `AtomicLong`; `clock.addAndGet(1_000_000_000L)` advances one second instantly.

**Group 1 — initial state & basic contract.** Token bucket starts full; leaky starts empty; both reject once exhausted.

```java
@Test void tokenBucket_startsFull_thenRejects() {
    var clock = new AtomicLong(0);
    var rl = new TokenBucketRateLimiter(5, 1.0, clock::get);
    for (int i = 0; i < 5; i++) assertTrue(rl.tryAcquire("key"));
    assertFalse(rl.tryAcquire("key"));            // 6th rejected, bucket drained
}

@Test void leakyBucket_startsEmpty_admitsUpToCapacity_thenRejects() {
    var clock = new AtomicLong(0);
    var rl = new LeakyBucketRateLimiter(5, 1.0, clock::get);
    for (int i = 0; i < 5; i++) assertTrue(rl.tryAcquire("key"));
    assertFalse(rl.tryAcquire("key"));            // level == capacity now
}
```

**Group 2 — time-based behaviour (the deterministic-clock payoff).** Advance the fake clock and assert exact refill/leak/aging. No `Thread.sleep`, no tolerance windows.

```java
@Test void tokenBucket_refillsAtRate_cappedAtCapacity() {
    var clock = new AtomicLong(0);
    var rl = new TokenBucketRateLimiter(5, 1.0, clock::get);   // 1 token/sec
    for (int i = 0; i < 5; i++) rl.tryAcquire("key");          // drain
    clock.addAndGet(1_000_000_000L);                          // +1s → exactly 1 token
    assertTrue(rl.tryAcquire("key"));
    assertFalse(rl.tryAcquire("key"));                        // only 1 refilled
    clock.addAndGet(100_000_000_000L);                        // +100s would refill 100…
    for (int i = 0; i < 5; i++) assertTrue(rl.tryAcquire("key")); // …but capped at 5
    assertFalse(rl.tryAcquire("key"));
}

@Test void leakyBucket_partialDrainReflectsFractionalLeak() {
    var clock = new AtomicLong(0);
    var rl = new LeakyBucketRateLimiter(10, 10.0, clock::get); // 1 unit / 100ms
    for (int i = 0; i < 8; i++) assertTrue(rl.tryAcquire("key")); // level=8
    clock.addAndGet(500_000_000L);                            // 500ms → 5 units leak, level=3
    for (int i = 0; i < 7; i++) assertTrue(rl.tryAcquire("key"));
    assertFalse(rl.tryAcquire("key"));                        // 8th would push level to 11
}
```

**Group 3 — the sliding window's whole reason to exist.** The boundary-spike test is the one that distinguishes it from a fixed window, plus the proportional-weight test that verifies the `prevCount × (1 − fraction)` formula.

```java
@Test void slidingWindow_throttlesBoundarySpike() {
    var clock = new AtomicLong(0);
    long w = 1_000_000_000L;
    var rl = new SlidingWindowRateLimiter(5, w, clock::get);
    for (int i = 0; i < 5; i++) assertTrue(rl.tryAcquire("key")); // full at window 0
    clock.addAndGet(w + w / 2);                                  // 50% into window 1
    int admitted = 0;                                           // estimate = 5×0.5 = 2.5
    for (int i = 0; i < 5; i++) if (rl.tryAcquire("key")) admitted++;
    assertTrue(admitted < 5, "prev window still weighs in; admitted=" + admitted);
}

@Test void slidingWindow_proportionallyWeightsPreviousWindow() {
    var clock = new AtomicLong(0);
    long w = 1_000_000_000L;
    var rl = new SlidingWindowRateLimiter(5, w, clock::get);
    for (int i = 0; i < 4; i++) assertTrue(rl.tryAcquire("key")); // prev=4
    clock.addAndGet(w + w / 4);                                  // 25% in → prevWeight 0.75
    assertTrue(rl.tryAcquire("key"));                            // estimate 3.0 → fits
    assertTrue(rl.tryAcquire("key"));                            // 4.0 → fits
    assertFalse(rl.tryAcquire("key"));                           // 5.0 > 5 → blocked
}
```

**Group 4 — per-key isolation & argument validation.** Independent buckets per key; `n > capacity` rejects immediately; `n <= 0` throws.

```java
@Test void perKey_bucketsAreIndependent() {
    var rl = new TokenBucketRateLimiter(2, 1.0, new AtomicLong(0)::get);
    assertTrue(rl.tryAcquire("a")); assertTrue(rl.tryAcquire("a"));
    assertFalse(rl.tryAcquire("a"));
    assertTrue(rl.tryAcquire("b"));                              // untouched key
}

@Test void requestLargerThanCapacity_rejectedNotSpun() {
    var rl = new LeakyBucketRateLimiter(5, 1.0, new AtomicLong(0)::get);
    assertFalse(rl.tryAcquire("key", 6));                        // fast-reject, no CAS loop
}

@Test void nonPositiveN_throws() {
    var rl = new TokenBucketRateLimiter(5, 1.0, new AtomicLong(0)::get);
    assertThrows(IllegalArgumentException.class, () -> rl.tryAcquire("key", 0));
}
```

**Group 5 — the concurrency stress test (mandatory).** This is the test a non-atomic implementation fails. Freeze the clock so there is zero refill/leak during the race, fire far more threads than the capacity at a single key through a start-gate, and assert that **exactly `capacity`** win — not `capacity ± a few`. If someone used two separate atomics or read-modify-wrote without CAS, threads race past the limit and this over-admits.

```java
@Test void concurrentAcquires_neverExceedCapacity() throws Exception {
    var clock = new AtomicLong(0);                              // frozen — no refill
    var rl = new TokenBucketRateLimiter(50, 1.0, clock::get);
    int N = 200;
    var gate = new CountDownLatch(1);
    var done = new CountDownLatch(N);
    var wins = new AtomicInteger();
    try (var exec = Executors.newVirtualThreadPerTaskExecutor()) {
        IntStream.range(0, N).forEach(i -> exec.submit(() -> {
            try { gate.await(); if (rl.tryAcquire("k")) wins.incrementAndGet(); }
            catch (InterruptedException e) { Thread.currentThread().interrupt(); }
            finally { done.countDown(); }
        }));
        gate.countDown();                                       // release all at once
        assertTrue(done.await(5, TimeUnit.SECONDS), "timed out — possible deadlock");
    }
    assertEquals(50, wins.get(), "CAS must enforce the limit exactly");
}
```

The frozen clock is what makes the assertion *exact* — with a live clock a stray nanosecond could refill a token mid-race and the count would be non-deterministic. That's the deterministic-clock discipline paying off a second time. Run the same shape for the leaky bucket and sliding window (both cap at exactly 50).

### Implement it

All three share the skeleton: a `ConcurrentHashMap<String, AtomicReference<StateRecord>>`, `computeIfAbsent` for atomic per-key init, and a CAS retry loop over an immutable `record`. **Complexity: O(1) time and O(1) memory per call, per key** — no per-request timestamp lists. Precompute the rate as `perNano = perSec / 1e9` once in the constructor so the hot path multiplies instead of dividing.

```java
public class TokenBucketRateLimiter implements RateLimiter {
    private record BucketState(long tokens, long lastRefillNanos) {}
    private final long capacity; private final double refillPerNano;
    private final LongSupplier clock;
    private final Map<String, AtomicReference<BucketState>> buckets = new ConcurrentHashMap<>();

    public boolean tryAcquire(String key, int n) {
        if (n <= 0) throw new IllegalArgumentException("n must be positive");
        if (n > capacity) return false;                        // fast-reject: unsatisfiable
        long now = clock.getAsLong();
        var ref = buckets.computeIfAbsent(key,
                k -> new AtomicReference<>(new BucketState(capacity, now))); // start full
        while (true) {
            BucketState cur = ref.get();                       // snapshot (immutable)
            long elapsed = Math.max(0, now - cur.lastRefillNanos());        // clamp skew
            long refilled = Math.min(capacity,
                    cur.tokens() + (long) (elapsed * refillPerNano));       // lazy refill
            if (refilled < n) return false;                    // fast-reject BEFORE any CAS
            BucketState next = new BucketState(refilled - n, now);
            if (ref.compareAndSet(cur, next)) return true;     // atomic swap of the whole tuple
            // CAS lost → another thread won this key; re-read fresher state and retry
        }
    }
}
```

Leaky bucket is the mirror image: state is `(double level, long lastLeakNanos)`, the lazy step *subtracts* `elapsed × leakPerNano` (floored at 0), and it admits iff `newLevel + n <= capacity` — new keys start empty (`level = 0.0`). Sliding window holds `(prevCount, currCount, windowStart)`: compute `windowsElapsed = elapsed / windowNanos`, age the counters forward (0 windows → no change; 1 → curr becomes prev, curr resets, `windowStart += windowNanos`; ≥2 → both reset), then admit iff `prevCount × (1 − fractionOfCurrent) + currCount + n <= limit`.

**Why CAS, not `synchronized`?** A per-key mutex serialises all callers, parks losers with a kernel context switch, and risks priority inversion. CAS stays in user space — only the loser pays, and only by re-running a few nanoseconds of arithmetic. Progress is guaranteed: at least one thread's CAS wins per round.

**The load-bearing gotcha:** the fast-reject `return false` must sit *before* `compareAndSet`. Rejections are pure reads; if they attempted a CAS, a flood of rejected traffic would hammer the atomic and make rejection itself the contention bottleneck. Only successful admits write.

### Common mistakes & senior signal

- **Two separate atomics for count + timestamp.** The classic correctness bug: a reader sees a refreshed count with a stale timestamp (or vice-versa) and double-refills/double-drains. One immutable record in one `AtomicReference` — swap both or neither.
- **`Thread.sleep` in tests.** Slow, flaky, and can't assert refill precisely. Inject the clock and advance an `AtomicLong` by exact nanosecond deltas. This is *the* signal the kata probes.
- **`currentTimeMillis()` for the clock.** Wall-clock jumps backwards on NTP slew / manual changes, making `elapsed` negative and corrupting the math. Use monotonic `nanoTime()`; clamp `elapsed` to `>= 0` as belt-and-braces.
- **CAS-ing on rejection.** Attempting `compareAndSet` for a request you already know fails turns rejection into a contention hotspot. Fast-reject before the loop.
- **Spinning when `n > capacity`.** Without the early `return false`, an oversized request can never satisfy and the loop never terminates.
- **Confusing the algorithms.** Token bucket = bursts up to capacity, starts full; leaky bucket = hard smooth ceiling, starts empty; sliding window counter = O(1) boundary-spike fix with ±1 error vs the O(n) log. Picking the right one for the stated use case (public API vs traffic shaping vs login throttling) is the senior tell.
- **Precision.** Dividing by `1e9` in the hot path each call wastes a CPU division and accumulates float error — precompute `perNano` once in the constructor.
- **Senior move:** knowing the exact-50-winners frozen-clock stress test is what catches a non-atomic implementation, and being able to say how this generalises to a distributed limiter (Redis Lua script doing the atomic read-refill-decrement server-side, sharded by key).


## Circuit Breaker — CLOSED · OPEN · HALF_OPEN

### Summary

**What this topic covers**
You build a thread-safe **circuit breaker**: a resilience wrapper that stops your service hammering a failing downstream (DB, external API) and gives it room to recover. It wraps arbitrary `Callable` actions in a three-state machine. In `CLOSED` it forwards every call and counts *consecutive* failures; when the count hits `failureThreshold` it trips to `OPEN`. In `OPEN` it fast-rejects every call with a `CircuitOpenException` — the action is never invoked — until `openDurationNanos` elapses. It then moves to `HALF_OPEN`, admits a small number of trial calls, and closes again after `successThreshold` successes; a single failure in `HALF_OPEN` reopens it immediately and resets the timer. The whole thing is driven by an injectable monotonic clock so tests advance time without sleeping.

**Mental model**
Think of it as a **latch with a self-healing timer**. Three fields carry the state: the `State` enum, a `consecutiveFailures` counter, and an `openedAtNanos` timestamp (plus a `trialSuccesses` counter for HALF_OPEN). The key insight is that the `OPEN → HALF_OPEN` transition is *lazy*: there is no background thread ticking. Every entry point — `call()` and `state()` — first calls `maybeTransitionToHalfOpen()` under the lock, which checks `clock.now() - openedAtNanos >= openDurationNanos` and flips the state if the window has elapsed. The second insight is **lock scope**: you hold the lock only long enough to read state and decide whether to reject, then *release it before invoking the action*, then re-acquire to record the outcome. Holding the lock across a slow network call would serialise every caller and defeat the point. To make outcome-recording race-free, you capture the state observed *at dispatch time* and pass it into `recordSuccess`/`recordFailure`.

**Key terms**
- **CLOSED** — normal; forward calls, count consecutive failures.
- **OPEN** — fast-reject; throw `CircuitOpenException` without touching the action.
- **HALF_OPEN** — probe; admit trial calls to test if the dependency recovered.
- **failureThreshold** — consecutive failures in CLOSED that trip to OPEN.
- **openDurationNanos** — how long to stay OPEN before probing; nanos to match `nanoTime`.
- **successThreshold** — trial successes in HALF_OPEN needed to close.
- **consecutive failures** — any single success resets the counter to zero (vs a rolling window).
- **monotonic clock** — `System::nanoTime`, injected as a `LongSupplier`; never `currentTimeMillis`.
- **lazy transition** — `OPEN → HALF_OPEN` is evaluated on access, not by a timer.
- **state-at-call-time** — the state captured when the call dispatched, used to record the outcome.
- **CircuitOpenException** — unchecked; circuit-open is an operational state, not a domain error.

**Why interviewers ask this**
It is a compact test of **state-machine design plus concurrency plus time**. A junior gets the three states and the happy path but holds the lock across the action, uses `currentTimeMillis`, or spawns a timer thread for the recovery transition. A senior nails four things: minimal lock scope with the action invoked *outside* the lock; an injectable monotonic clock so the behaviour is deterministically testable; lazy time-based transition instead of a background scheduler; and capturing state-at-call-time to avoid a mid-flight race. They also volunteer the design trade-off (consecutive count vs sliding window) and name Resilience4j/Hystrix. The give-away of depth is *how you test it* — a fake clock and a concurrency stress test, not `Thread.sleep`.

**Common confusions**
- **"Hold the lock while calling the action."** No — release before the action, re-acquire to record. The action can be slow; serialising callers defeats the breaker.
- **"A timer thread flips OPEN back to HALF_OPEN."** No — the transition is lazy, checked on the next `call()`/`state()`. Simpler and testable.
- **"HALF_OPEN gets a grace period."** No — the *first* failure reopens immediately and resets the open timer.
- **"Count total failures."** This design counts *consecutive* failures; one success resets to zero.
- **"Use `currentTimeMillis` for elapsed time."** Wall-clock can jump backwards (NTP/leap seconds) making `elapsed` negative. Use `nanoTime`.
- **"`state()` is a pure getter."** It also refreshes the pending OPEN→HALF_OPEN transition so readers see the current picture.

**What follows from this topic**
The lazy-transition and injectable-clock patterns recur in the **[[ratelimit]]** kata (token-bucket refill on read) and any time-windowed component. The lock-outside-the-action discipline generalises to **[[cache]]** loaders and connection pools. The natural next step is upgrading the trip condition to a **rolling failure-rate sliding window** (Resilience4j-style) and composing the breaker with retry, bulkhead, and rate-limiter decorators.

### Clarify & design the API

Questions to settle before writing a line of logic:

- **Trip condition** — consecutive failures or a rolling failure-rate window? Commit to *consecutive* (simpler, resets on any success); mention the window as the production alternative.
- **What counts as failure?** Any exception from the action. (Real libraries let you ignore some exception types — out of scope here.)
- **Recovery** — how many trial successes close the breaker (`successThreshold`), and does one failure in HALF_OPEN reopen? Yes, immediately.
- **Clock** — must be injectable so tests are deterministic. A `LongSupplier` of nanos; production is `System::nanoTime`.
- **Concurrency** — thread-safe under many callers; the action must run *outside* the lock.

Lock in a tiny API — three methods, two constructors, a provided `State` enum and `CircuitOpenException`:

```java
public enum State { CLOSED, OPEN, HALF_OPEN }

public CircuitBreaker(int failureThreshold, long openDurationNanos, int successThreshold);
public CircuitBreaker(int failureThreshold, long openDurationNanos, int successThreshold,
                      LongSupplier clock);        // clock injected for tests

public State state();                             // refreshes pending OPEN→HALF_OPEN
public <T> T call(Callable<T> action) throws Exception;   // throws CircuitOpenException when OPEN
```

### Write the tests

Write these **first** — they pin the whole spec and, crucially, prove you can test time and concurrency deterministically. Drive an `AtomicLong` as the clock; never `Thread.sleep`. Group them: basic contract → state transitions → boundary/timer edges → the concurrency stress test.

**Basic contract — starts CLOSED and forwards.**

```java
private static final Callable<Void> FAILING =
    () -> { throw new RuntimeException("downstream error"); };
private static final Callable<String> SUCCEEDING = () -> "ok";

@Test
void starts_closed_and_forwards_calls() throws Exception {
    var clock = new AtomicLong(0);
    var breaker = new CircuitBreaker(3, 1_000_000_000L, 1, clock::get);
    assertEquals(CircuitBreaker.State.CLOSED, breaker.state());
    assertEquals("ok", breaker.call(SUCCEEDING));
}
```

**Core transition — CLOSED → OPEN on threshold, and success resets the counter.** These two pin the consecutive-failure semantics: the counter only trips on *N in a row*, and a single success zeroes it.

```java
@Test
void closed_to_open_after_failure_threshold() {
    var clock = new AtomicLong(0);
    var breaker = new CircuitBreaker(2, 1_000_000_000L, 1, clock::get);
    assertThrows(RuntimeException.class, () -> breaker.call(FAILING));   // 1st failure
    assertEquals(CircuitBreaker.State.CLOSED, breaker.state());          // still closed
    assertThrows(RuntimeException.class, () -> breaker.call(FAILING));   // 2nd → trips
    assertEquals(CircuitBreaker.State.OPEN, breaker.state());
}

@Test
void success_resets_consecutive_failure_counter() {
    var clock = new AtomicLong(0);
    var breaker = new CircuitBreaker(2, 1_000_000_000L, 1, clock::get);
    assertThrows(RuntimeException.class, () -> breaker.call(FAILING));
    assertDoesNotThrow(() -> breaker.call(SUCCEEDING));                  // resets counter
    assertThrows(RuntimeException.class, () -> breaker.call(FAILING));
    assertEquals(CircuitBreaker.State.CLOSED, breaker.state());          // needs 2 again
    assertThrows(RuntimeException.class, () -> breaker.call(FAILING));
    assertEquals(CircuitBreaker.State.OPEN, breaker.state());
}
```

**Fast-reject — OPEN never invokes the action.** Use a counting action to *prove* the action is untouched — this is the behaviour that sheds load.

```java
@Test
void open_state_rejects_fast_without_invoking_action() {
    var clock = new AtomicLong(0);
    var breaker = new CircuitBreaker(1, 1_000_000_000L, 1, clock::get);
    assertThrows(RuntimeException.class, () -> breaker.call(FAILING));   // trip
    var callCount = new AtomicInteger(0);
    Callable<Void> counting = () -> { callCount.incrementAndGet();
                                      throw new RuntimeException("nope"); };
    assertThrows(CircuitOpenException.class, () -> breaker.call(counting));
    assertEquals(0, callCount.get(), "action must not run while OPEN");
}
```

**Timer edges — the fake clock earns its keep.** Test *just before* vs *at* the boundary, then the full HALF_OPEN recovery and the immediate reopen with timer reset.

```java
@Test
void open_transitions_to_half_open_after_duration() {
    var clock = new AtomicLong(0);
    long open = 1_000_000_000L;
    var breaker = new CircuitBreaker(1, open, 1, clock::get);
    assertThrows(RuntimeException.class, () -> breaker.call(FAILING));   // trip at t=0
    clock.set(open - 1);
    assertEquals(CircuitBreaker.State.OPEN, breaker.state());            // not yet
    clock.set(open);
    assertEquals(CircuitBreaker.State.HALF_OPEN, breaker.state());       // boundary hit
}

@Test
void half_open_success_closes_breaker() throws Exception {
    var clock = new AtomicLong(0);
    long open = 1_000_000_000L;
    var breaker = new CircuitBreaker(1, open, 2, clock::get);            // need 2 successes
    assertThrows(RuntimeException.class, () -> breaker.call(FAILING));
    clock.set(open);
    assertEquals("ok", breaker.call(SUCCEEDING));
    assertEquals(CircuitBreaker.State.HALF_OPEN, breaker.state());       // 1 of 2
    assertEquals("ok", breaker.call(SUCCEEDING));
    assertEquals(CircuitBreaker.State.CLOSED, breaker.state());          // closed
}

@Test
void half_open_failure_reopens_immediately() {
    var clock = new AtomicLong(0);
    long open = 1_000_000_000L;
    var breaker = new CircuitBreaker(1, open, 3, clock::get);
    assertThrows(RuntimeException.class, () -> breaker.call(FAILING));
    clock.set(open);
    assertEquals(CircuitBreaker.State.HALF_OPEN, breaker.state());
    assertThrows(RuntimeException.class, () -> breaker.call(FAILING));   // trial fails
    assertEquals(CircuitBreaker.State.OPEN, breaker.state());            // reopens now
    clock.set(open);                                                     // timer was reset
    assertEquals(CircuitBreaker.State.OPEN, breaker.state());            // still open
    clock.set(open + open);
    assertEquals(CircuitBreaker.State.HALF_OPEN, breaker.state());       // new window
}
```

**Concurrency stress test — the one that fails an unsynchronised impl.** Fire 100 virtual threads at a failing action behind a start gate; assert the breaker ends OPEN and that some calls were fast-rejected. Without a lock guarding the state machine, the counter races and the invariants break.

```java
@Test
void concurrent_calls_trip_the_breaker_safely() throws Exception {
    var clock = new AtomicLong(0);
    var breaker = new CircuitBreaker(5, 1_000_000_000L, 1, clock::get);
    int N = 100;
    var gate = new CountDownLatch(1);
    var done = new CountDownLatch(N);
    var openExceptions = new AtomicInteger(0);
    Callable<Void> failing = () -> { throw new RuntimeException("fail"); };

    try (var exec = Executors.newVirtualThreadPerTaskExecutor()) {
        for (int i = 0; i < N; i++) exec.submit(() -> {
            try { gate.await(); breaker.call(failing); }
            catch (CircuitOpenException e) { openExceptions.incrementAndGet(); }
            catch (Exception ignored) { }
            finally { done.countDown(); }
        });
        gate.countDown();
        assertTrue(done.await(5, TimeUnit.SECONDS));
    }
    assertTrue(openExceptions.get() > 0, "some calls should be fast-rejected");
    assertEquals(CircuitBreaker.State.OPEN, breaker.state());
}
```

### Implement it

Four mutable fields, all guarded by a single `ReentrantLock`; config is immutable. The lock is held for microseconds around the state check and the outcome recording — **never** around `action.call()`.

```java
private final ReentrantLock lock = new ReentrantLock();
private State state = State.CLOSED;
private int consecutiveFailures = 0;
private int trialSuccesses = 0;
private long openedAtNanos = 0;

public <T> T call(Callable<T> action) throws Exception {
    State at;
    lock.lock();
    try {
        maybeTransitionToHalfOpen();                 // lazy timer check
        at = state;
        if (at == State.OPEN)
            throw new CircuitOpenException("Circuit is OPEN; retry later.");
    } finally { lock.unlock(); }                     // release BEFORE the action

    try {
        T result = action.call();                    // slow work, no lock held
        recordSuccess(at);                            // uses state-at-call-time
        return result;
    } catch (Exception e) {
        recordFailure(at);
        throw e;
    }
}

private void maybeTransitionToHalfOpen() {           // must hold lock
    if (state == State.OPEN
            && clock.getAsLong() - openedAtNanos >= openDurationNanos) {
        state = State.HALF_OPEN;
        trialSuccesses = 0;
    }
}

private void recordFailure(State at) {
    lock.lock();
    try {
        switch (at) {
            case CLOSED -> { if (++consecutiveFailures >= failureThreshold) tripOpen(); }
            case HALF_OPEN -> tripOpen();             // one failure reopens now
            case OPEN -> { }                          // unreachable
        }
    } finally { lock.unlock(); }
}

private void tripOpen() {                             // must hold lock
    state = State.OPEN;
    openedAtNanos = clock.getAsLong();               // reset the timer
    trialSuccesses = 0;
}
```

`recordSuccess` mirrors it: in `CLOSED` reset `consecutiveFailures`; in `HALF_OPEN` increment `trialSuccesses` and close once it reaches `successThreshold`. `state()` also takes the lock and calls `maybeTransitionToHalfOpen()` before returning.

**Complexity:** every operation is O(1) — a handful of field reads/writes under a lock held for microseconds. The dominant cost is always the action itself, which runs unlocked. **Key gotcha:** compute `elapsed = clock() - openedAtNanos` with `nanoTime`; with `currentTimeMillis` a backward wall-clock jump makes `elapsed` negative and either wedges the breaker open or silently resets the window.

### Common mistakes & senior signal

- **Lock held across the action.** The single biggest error. It serialises every caller and turns the breaker into a global mutex. Release before `action.call()`, re-acquire to record.
- **Re-reading `state` when recording the outcome** instead of using the state captured at dispatch. If another thread trips the breaker mid-flight, re-reading corrupts HALF_OPEN trial counting. Pass `stateAtCallTime` through.
- **A background timer thread** for OPEN → HALF_OPEN. Unnecessary and hard to test — do it lazily on the next `call()`/`state()`.
- **`System.currentTimeMillis()` for elapsed time.** Non-monotonic; use injected `nanoTime`. The injectable clock is also what makes the whole thing testable without sleeping.
- **Forgetting to reset the open timer** on a HALF_OPEN failure — the breaker would prematurely re-probe. `tripOpen()` re-stamps `openedAtNanos` every time.
- **Testing with `Thread.sleep`.** Flaky and slow. A senior injects an `AtomicLong` clock and steps it to the exact boundary (`open - 1` vs `open`).
- **Senior signal:** volunteers the consecutive-count vs sliding-window trade-off, names Resilience4j/Hystrix/Sentinel, makes `CircuitOpenException` unchecked (operational state, not a domain error), and writes the concurrency stress test that would expose an unsynchronised counter.


## Retry with Exponential Backoff + Jitter

### Summary

**What this topic covers**
You build a `Retryer` that executes a `Callable<T>`, retries on failure up to a configured limit, and waits between attempts with an exponentially growing, jittered delay. The delay curve and the retry count live in an immutable `RetryPolicy` record; the `Retryer` owns the loop. The whole point of the kata is testability: both the sleep mechanism (`LongConsumer`) and the random source (`Random`) are constructor-injected, so you can assert the exact backoff sequence with a recording sleeper and a seeded `Random` instead of burning real wall-clock time. This is the canonical resilience pattern — the thing you reach for around any network or service call that can fail transiently.

**Mental model**
Think of it as a `for` loop over attempts, 1-indexed, with a single sharp edge: *sleep happens between attempts, never after the last one*. On each iteration you call the action; on success you return immediately; on failure you record the exception, and — only if this was not the final attempt — compute a delay and hand it to the sleeper. The delay is `min(maxDelayMs, baseDelayMs × multiplier^(attempt-1))`: exponential growth, then a hard cap. If jitter is on, you replace that computed value with a uniform sample from `[0, delay]` (full jitter). The cap is applied to the raw exponential value; jitter is applied to the already-capped value — order matters. When the loop exhausts, you re-throw the last exception *as-is*, unwrapped, so the caller sees the original cause. The injected sleeper is what makes "assert the delays were `[100, 300, 500]`" a deterministic unit test rather than a flaky sleep.

**Key terms**
- **Exponential backoff** — delay grows geometrically per attempt: `base × multiplier^(attempt-1)`. Spreads retries out as failures persist.
- **Cap (`maxDelayMs`)** — upper bound on any single delay so the multiplier can't grow the wait unboundedly.
- **Jitter** — randomness added to the delay to de-correlate retries across concurrent callers.
- **Full jitter** — `sleep = random(0, delay)`. Maximally spreads load; can produce near-zero sleeps.
- **Equal jitter** — `sleep = delay/2 + random(0, delay/2)`. Guarantees a minimum wait; tames the fast-retry tail.
- **Decorrelated jitter** — `sleep = random(base, lastSleep × 3)`. Grows the window off the previous sleep.
- **Thundering herd / retry storm** — correlated retries from many callers hammering a recovering service in synchronized bursts.
- **Idempotency** — safe to run more than once. Retries are only safe on idempotent (or at-most-once keyed) operations.
- **Injected sleeper (`LongConsumer`)** — `Thread.sleep` in prod; a list-collecting consumer in tests.
- **Seeded `Random`** — fixed seed → deterministic jitter values → assertable delays.
- **`maxAttempts`** — total attempts *including the first call*, not the number of retries.

**Why interviewers ask this**
It's a compact test of resilience literacy and test design. A junior writes a loop that retries and sleeps, and often sleeps after the final failure or wraps the exception. A senior gets the two edges right without prompting — no sleep on the last attempt, re-throw unwrapped — and, crucially, *designs for testability first*: they inject the clock/sleeper and the random source so the backoff curve can be pinned deterministically. The jitter discussion is the senior signal: being able to explain the thundering-herd problem, name the three jitter strategies, and justify full jitter as the default separates someone who has run services in production from someone who has only read about retries. Bonus signal: unprompted mention of the idempotency contract and retryable-vs-non-retryable exception classification.

**Common confusions**
- *"`maxAttempts=3` means 3 retries"* → No — it's 3 total attempts, so at most 2 retries and 2 inter-attempt sleeps.
- *"Sleep then check if done"* → Backwards. Check `attempt == maxAttempts` *before* sleeping; otherwise you waste a full delay before throwing.
- *"Jitter, then cap"* → Cap first, jitter the capped value. Jittering before capping can exceed `maxDelayMs`.
- *"Retry everything"* → Only transient failures (503) are retryable; a 400 will fail identically forever. This kata retries on any exception for simplicity — know that's a simplification.
- *"Wrap the exception in a RetryException"* → Re-throw as-is so the caller gets the original cause.
- *"Random makes it untestable"* → A seeded `Random` plus a recording sleeper makes it fully deterministic.

**What follows from this topic**
Retry is one leg of the resilience triad: pair it with a **circuit breaker** (stop retrying a service that's clearly down) and a **rate limiter** / **bulkhead** (bound concurrent load). The idempotency-key idea connects to exactly-once semantics in distributed systems and message queues. The injected-clock technique here is the same trick you use to test any time-dependent code — schedulers, caches with TTLs, token buckets.

### Clarify & design the API

Questions worth asking before writing a line: *Retry on which exceptions — any, or a caller-supplied predicate?* (Here: any.) *Is `maxAttempts` inclusive of the first call?* (Yes.) *Do we sleep after the final failure?* (No.) *Cap before or after jitter?* (Cap first.) *How are sleep and randomness controlled in tests?* (Both injected.)

Commit to two types. `RetryPolicy` is an immutable record carrying the knobs and the delay formula; `Retryer` owns the loop with the sleeper and random injected.

```java
public record RetryPolicy(
    int maxAttempts, long baseDelayMs, long maxDelayMs,
    double multiplier, boolean jitter
) {
    public RetryPolicy { /* validate: maxAttempts>=1, baseDelayMs>=0,
                            maxDelayMs>=baseDelayMs, multiplier>=1.0 */ }
    public static RetryPolicy noRetry() { return new RetryPolicy(1, 0, 0, 1.0, false); }
    public long computeDelayMs(int attempt) { ... }   // min(cap, base * m^(attempt-1))
}

public class Retryer {
    public Retryer(RetryPolicy policy) { ... }                         // prod: Thread.sleep, new Random()
    public Retryer(RetryPolicy policy, LongConsumer sleeper, Random random) { ... } // test seam
    public <T> T execute(Callable<T> action) throws Exception { ... }
}
```

Making the delay formula a method *on the record* (`computeDelayMs`) keeps the policy self-describing and lets you unit-test the curve independently of the retry loop.

### Write the tests

Write these first — they pin the entire spec. Test seam: a recording `LongConsumer` (`delays::add`) captures every requested delay, and a seeded `Random` makes jitter deterministic. Group them: basic contract → core behaviour → backoff shape → jitter bounds → validation.

Basic contract — success short-circuits, no delay recorded:

```java
@Test
void succeeds_on_first_attempt_without_any_retry() throws Exception {
    var policy = new RetryPolicy(3, 100, 1000, 2.0, false);
    var delays = new ArrayList<Long>();
    var retryer = new Retryer(policy, delays::add, new Random(0));

    assertEquals("hello", retryer.execute(() -> "hello"));
    assertTrue(delays.isEmpty(), "no delay recorded when first attempt succeeds");
}
```

Core behaviour — retries until success, and the sleep-count invariant (`attempts - 1` sleeps):

```java
@Test
void succeeds_on_third_attempt_after_two_failures() throws Exception {
    var policy = new RetryPolicy(3, 100, 1000, 2.0, false);
    var delays = new ArrayList<Long>();
    var retryer = new Retryer(policy, delays::add, new Random(0));
    var calls = new AtomicInteger();

    var result = retryer.execute(() -> {
        if (calls.incrementAndGet() < 3) throw new RuntimeException("fail");
        return "success";
    });

    assertEquals("success", result);
    assertEquals(3, calls.get());
    assertEquals(2, delays.size());   // two failures → two sleeps
}

@Test
void exhausts_attempts_and_rethrows_last_exception() {
    var policy = new RetryPolicy(3, 100, 1000, 2.0, false);
    var delays = new ArrayList<Long>();
    var retryer = new Retryer(policy, delays::add, new Random(0));
    var calls = new AtomicInteger();

    var thrown = assertThrows(RuntimeException.class, () ->
        retryer.execute(() -> { calls.incrementAndGet(); throw new RuntimeException("always fails"); }));

    assertEquals("always fails", thrown.getMessage());   // re-thrown as-is, unwrapped
    assertEquals(3, calls.get());
    assertEquals(2, delays.size(), "no sleep after the final attempt");
}
```

Backoff shape — this is the test that proves the exponential curve *and* the cap in one shot:

```java
@Test
void backoff_delays_grow_exponentially_and_are_capped() {
    // base=100, m=3, cap=500 → 100, 300, 500(capped), 500(capped)
    var policy = new RetryPolicy(5, 100, 500, 3.0, false);
    var delays = new ArrayList<Long>();
    var retryer = new Retryer(policy, delays::add, new Random(0));

    assertThrows(RuntimeException.class, () ->
        retryer.execute(() -> { throw new RuntimeException("fail"); }));

    assertEquals(List.of(100L, 300L, 500L, 500L), delays);   // 5 attempts → 4 gaps
}
```

Jitter bounds — with a seeded `Random`, every jittered delay must land in `[0, computed]`:

```java
@Test
void jitter_bounds_delay_within_zero_and_computed() {
    var policy = new RetryPolicy(4, 200, 800, 2.0, true);   // jitter ON
    var delays = new ArrayList<Long>();
    var retryer = new Retryer(policy, delays::add, new Random(42L));

    assertThrows(RuntimeException.class, () ->
        retryer.execute(() -> { throw new RuntimeException("fail"); }));

    long[] computed = {200L, 400L, 800L};
    assertEquals(3, delays.size());
    for (int i = 0; i < delays.size(); i++) {
        assertTrue(delays.get(i) >= 0);
        assertTrue(delays.get(i) <= computed[i], "jittered delay must not exceed computed");
    }
}
```

Boundary + validation — the single-attempt policy and the record's argument checks:

```java
@Test
void no_retry_policy_propagates_exception_immediately() {
    var retryer = new Retryer(RetryPolicy.noRetry(), (LongConsumer) d -> fail("must not sleep"), new Random(0));
    var calls = new AtomicInteger();
    assertThrows(RuntimeException.class, () ->
        retryer.execute(() -> { calls.incrementAndGet(); throw new RuntimeException("fail"); }));
    assertEquals(1, calls.get());
}

@Test
void record_validates_illegal_arguments() {
    assertThrows(IllegalArgumentException.class, () -> new RetryPolicy(0, 100, 1000, 2.0, false));
    assertThrows(IllegalArgumentException.class, () -> new RetryPolicy(3, -1, 1000, 2.0, false));
    assertThrows(IllegalArgumentException.class, () -> new RetryPolicy(3, 200, 100, 2.0, false)); // cap < base
    assertThrows(IllegalArgumentException.class, () -> new RetryPolicy(3, 100, 1000, 0.5, false)); // m < 1
}
```

The jitter test is why the `Random` injection exists; the backoff-shape and sleep-count tests are why the sleeper injection exists. Without both seams, these assertions would be non-deterministic or slow.

### Implement it

The policy computes the curve; the retryer runs the loop. `computeDelayMs` uses `Math.pow` (fine — not a hot loop) then caps:

```java
public long computeDelayMs(int attempt) {          // attempt is 1-based
    double raw = baseDelayMs * Math.pow(multiplier, attempt - 1);
    return Math.min(maxDelayMs, (long) raw);       // cap the raw exponential value
}
```

The loop is where the two edges live — break before sleeping on the last attempt, and re-throw unwrapped:

```java
public <T> T execute(Callable<T> action) throws Exception {
    Exception last = null;
    for (int attempt = 1; attempt <= policy.maxAttempts(); attempt++) {
        try {
            return action.call();                          // success short-circuits
        } catch (Exception e) {
            last = e;
            if (attempt == policy.maxAttempts()) break;    // ← no sleep after final failure
            long delay = policy.computeDelayMs(attempt);   // cap already applied
            if (policy.jitter()) {
                delay = (long) (random.nextDouble() * (delay + 1));  // full jitter over capped value
            }
            sleeper.accept(delay);                         // Thread.sleep in prod; recorded in tests
        }
    }
    throw last;   // non-null: reachable only when every attempt threw
}
```

Complexity: O(maxAttempts) attempts, O(1) work per attempt (the `Math.pow` is constant). Note `random.nextDouble()` returns `[0.0, 1.0)`, so multiplying by `delay + 1` gives an inclusive-ish `[0, delay]` sample and, when `delay == 0`, correctly yields `0`. The production constructor wraps `Thread.sleep` and swallows/re-flags `InterruptedException` (restore the interrupt flag with `Thread.currentThread().interrupt()`), while the test constructor takes the recording consumer and seeded random.

### Common mistakes & senior signal

- **Sleeping after the last attempt.** The `if (attempt == maxAttempts) break;` must precede the sleep. Computing a delay only to throw immediately wastes a full backoff window — the single most common bug on this kata.
- **Off-by-one on attempts vs sleeps.** N attempts produce N-1 sleeps. `maxAttempts` includes the first call; it is not "number of retries."
- **Jittering before capping.** Cap the raw exponential first, then jitter the capped value — otherwise a jitter draw can push the delay past `maxDelayMs`.
- **Wrapping the exception.** Re-throw the original as-is so the caller gets the real cause; wrapping in a bespoke `RetryException` hides it and breaks `catch` blocks upstream.
- **Hard-coding `Thread.sleep` / `new Random()`.** Kills testability. The senior move is to inject both and expose a convenience prod constructor — the entire reason the tests are deterministic and fast.
- **Retrying non-idempotent or non-transient calls.** A senior flags the idempotency contract unprompted (retrying a card charge = double charge) and notes that a real implementation takes a `Predicate<Exception>` so a 400 isn't retried like a 503.
- **Can't articulate the thundering herd.** The senior explains *why* jitter exists (correlated retries turn a blip into a sustained overload), names full/equal/decorrelated, and defends full jitter as the simple default.


## Connection Pool — Semaphore-Bounded Resource Pool

### Summary

**What this topic covers**
You build `ConnectionPool<R>`, a generic, bounded, thread-safe pool of reusable resources — the primitive underneath HikariCP and every production JDBC pool. Callers `borrow` a resource, use it, and `release` it. If every resource is in use, a borrower blocks up to a timeout and then gets `null`. Resources are created lazily on first borrow, and a stale idle resource (a closed connection, an expired token) is discarded on the way out and replaced transparently. The whole exercise hinges on one invariant — **the number of resources concurrently in use must never exceed `maxSize`** — and on choosing the right concurrency primitive to enforce it without hand-rolled counting and locking.

**Mental model**
Separate two questions that a naive pool conflates: *"am I allowed to proceed?"* and *"which specific resource do I get?"* A `Semaphore(maxSize)` answers the first — a permit is a slot, `tryAcquire(timeout, unit)` blocks until a slot frees up or the deadline passes, `release()` returns the slot. A `ConcurrentLinkedQueue<R>` answers the second — it holds the idle resources. Once you hold a permit you are *guaranteed* the right to exactly one resource: either `poll()` hands you an idle one, or the queue is empty and you may safely create a fresh one, because the permit itself is proof that `totalCreated < maxSize`. The permit is the bound; the queue is just bookkeeping of which objects are currently free. Get that separation right and the whole thing is a dozen lines. Miss it and you're manually coordinating an in-flight counter against a queue under contention — the classic way to leak an extra connection past the limit.

**Key terms**
- **Semaphore** — a counter of permits; `acquire`/`tryAcquire` take one (blocking if none), `release` returns one. Here it counts free slots.
- **permit** — one unit of "you may hold a resource." `maxSize` permits total.
- **`tryAcquire(timeout, unit)`** — blocks up to the timeout; returns `false` (→ borrow returns `null`) if no permit frees up in time.
- **borrow / return** — the pool lifecycle: take a resource, use it, hand it back. Distinct from create/destroy.
- **lazy creation** — resources are made on first borrow, not at construction, so an idle app holds no connections.
- **validate-on-borrow** — a `Predicate<R>` tested before handing out an idle resource; failure means discard and replace.
- **`ConcurrentLinkedQueue`** — lock-free unbounded queue; `poll()`/`offer()` are O(1). Capacity is enforced by the semaphore, not the queue.
- **`AtomicInteger totalCreated`** — tracks resources ever created, distinguishing "queue empty, none made yet" from "queue empty, all in use."
- **release ordering** — enqueue the resource *before* releasing the permit; the reverse leaks a slot.
- **non-fair semaphore** — no FIFO guarantee for waiters; higher throughput, and safe because timed-out threads hold no permit.

**Why interviewers ask this**
It's a compact test of whether you reach for the right `java.util.concurrent` primitive instead of reinventing it with `synchronized` and a hand-managed count. A junior writes a `synchronized` method around an `int inUse` counter and a `wait/notify` loop, and usually either deadlocks, busy-waits, or leaks a slot under a race. A senior recognises "bounded blocking access to N slots" as *exactly* what a `Semaphore` models, picks a lock-free queue for the idle set, and — the real tell — gets the **release ordering** right and can explain the timeout/`null` contract, the validate-and-replace loop, and why a non-fair semaphore is fine here. Bonus signal: quoting the HikariCP sizing heuristic (`cores × 2 + spindles`) and knowing bigger pools are usually *slower*.

**Common confusions**
- *"I'll count borrows myself with a synchronized int."* — That's re-implementing a semaphore, badly. Use `Semaphore`.
- *"Release the permit, then requeue the resource."* — Wrong order: a waiter can grab the permit, find the queue empty, and create a resource beyond `maxSize`.
- *"An empty idle queue means I'm out of resources."* — No — after a successful `acquire`, empty queue means *create a new one*; the permit guarantees you're under the cap.
- *"Timeout should throw."* — The contract returns `null` on timeout (cheap, caller decides); it throws only on `InterruptedException`.
- *"Validate everything continuously."* — Validate lazily, on borrow only; a background health-checker is a production add-on, not the core.

**What follows from this topic**
The Semaphore-as-bound pattern generalises to any rate/capacity limiter — see the **Bounded Blocking Queue** kata (same borrow/return shape with a producer-consumer twist) and **Rate Limiter** (permits over time). The lock-free idle queue connects to lock-free structures generally. Production framing links to HikariCP sizing (Java Primer Q191) and semaphores (Q48).

### Clarify & design the API

Questions to ask before writing a line: *Is the pool generic or connection-specific?* (generic `<R>` — more reusable). *What happens when exhausted — block forever, block with timeout, or fail fast?* (block with timeout, then `null`). *Eager or lazy creation?* (lazy). *Do borrowed resources need health validation?* (optional `Predicate<R>`). *Must `borrow`/`release` be thread-safe?* (yes — that's the whole point).

Commit to this surface before touching logic:

```java
public class ConnectionPool<R> {
    public ConnectionPool(Supplier<R> factory, int maxSize) { ... }
    public ConnectionPool(Supplier<R> factory, int maxSize, Predicate<R> validator) { ... }

    public R borrow(long timeout, TimeUnit unit) throws InterruptedException; // resource, or null on timeout
    public void release(R resource);   // rejects null
    public int available();            // idle count, snapshot
    public int inUse();                // borrowed count, snapshot
}
```

The two-constructor split (factory+size, factory+size+validator) keeps the common no-validation case clean while the validating case delegates to it with `r -> true`.

### Write the tests

Write these first — they pin the spec before any implementation exists. Group them: basic contract → reuse/validation behaviour → argument validation → the concurrency stress test.

**Basic contract — bound, timeout, release round-trip:**

```java
@Test
void borrow_up_to_max_succeeds_immediately() throws Exception {
    var pool = new ConnectionPool<>(() -> new FakeResource(0), 3);
    var r1 = pool.borrow(1, TimeUnit.SECONDS);
    var r2 = pool.borrow(1, TimeUnit.SECONDS);
    var r3 = pool.borrow(1, TimeUnit.SECONDS);
    assertNotNull(r1); assertNotNull(r2); assertNotNull(r3);
    assertEquals(3, pool.inUse());
    assertEquals(0, pool.available());
}

@Test
void borrowing_beyond_max_times_out() throws Exception {
    var pool = new ConnectionPool<>(() -> new FakeResource(0), 2);
    pool.borrow(1, TimeUnit.SECONDS);
    pool.borrow(1, TimeUnit.SECONDS);
    assertNull(pool.borrow(50, TimeUnit.MILLISECONDS),
        "borrow returns null when exhausted and timeout elapses");
}

@Test
void release_makes_resource_borrowable_again() throws Exception {
    var pool = new ConnectionPool<>(() -> new FakeResource(0), 1);
    var r1 = pool.borrow(1, TimeUnit.SECONDS);
    assertNull(pool.borrow(20, TimeUnit.MILLISECONDS)); // exhausted
    pool.release(r1);
    assertNotNull(pool.borrow(1, TimeUnit.SECONDS));    // borrowable again
}
```

**Reuse & validation — the pool recycles, and self-heals on stale resources:**

```java
@Test
void released_resource_is_reused_not_recreated() throws Exception {
    var createCount = new AtomicInteger(0);
    var pool = new ConnectionPool<>(() -> new FakeResource(createCount.incrementAndGet()), 2);
    var r1 = pool.borrow(1, TimeUnit.SECONDS);
    pool.release(r1);
    pool.borrow(1, TimeUnit.SECONDS);
    assertEquals(1, createCount.get(), "resource reused, not recreated");
}

@Test
void invalid_resources_are_discarded_and_factory_called_again() throws Exception {
    var createCount = new AtomicInteger(0);
    var pool = new ConnectionPool<>(
        () -> new FakeResource(createCount.incrementAndGet()),
        3,
        r -> r.id() != 1);           // id 1 is always "stale"
    var r1 = pool.borrow(1, TimeUnit.SECONDS);
    assertEquals(1, r1.id());
    pool.release(r1);                // id=1 goes back to idle
    var r2 = pool.borrow(1, TimeUnit.SECONDS); // polls id=1, rejected, makes id=2
    assertNotEquals(1, r2.id(), "stale resource must not be handed out");
    assertEquals(2, createCount.get(), "one discarded, one created");
}
```

**Argument validation — reject the impossible constructions:**

```java
@Test
void null_factory_and_invalid_maxSize_are_rejected() {
    assertThrows(IllegalArgumentException.class, () -> new ConnectionPool<>(null, 1));
    assertThrows(IllegalArgumentException.class, () -> new ConnectionPool<>(() -> "", 0));
}
```

**The stress test — the invariant that fails an unsynchronised impl.** This is the card that matters most: hammer the pool from many threads and assert the bound *never* breaks. A single volatile-free counter or the wrong release ordering will fail this intermittently.

```java
@Test
void concurrent_borrows_never_exceed_max_in_use() throws Exception {
    final int maxSize = 3;
    var pool = new ConnectionPool<>(() -> new FakeResource(0), maxSize);
    final int N = 30;
    var gate = new CountDownLatch(1);          // release all threads at once
    var done = new CountDownLatch(N);
    var maxObserved = new AtomicInteger(0);

    try (var exec = Executors.newVirtualThreadPerTaskExecutor()) {
        for (int i = 0; i < N; i++) exec.submit(() -> {
            try {
                gate.await();
                var r = pool.borrow(2, TimeUnit.SECONDS);
                if (r != null) {
                    maxObserved.accumulateAndGet(pool.inUse(), Math::max);
                    Thread.sleep(5);           // widen the overlap window
                    pool.release(r);
                }
            } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
            finally { done.countDown(); }
        });
        gate.countDown();
        assertTrue(done.await(10, TimeUnit.SECONDS), "threads timed out");
    }
    assertTrue(maxObserved.get() <= maxSize,
        "inUse " + maxObserved.get() + " exceeded maxSize " + maxSize);
}

@Test
void blocking_borrow_unblocks_when_resource_released() throws Exception {
    var pool = new ConnectionPool<>(() -> new FakeResource(0), 1);
    var r1 = pool.borrow(1, TimeUnit.SECONDS);        // take the only slot
    var started = new CountDownLatch(1);
    var finished = new CountDownLatch(1);
    try (var exec = Executors.newVirtualThreadPerTaskExecutor()) {
        exec.submit(() -> {
            try {
                started.countDown();
                var r2 = pool.borrow(5, TimeUnit.SECONDS); // blocks here
                assertNotNull(r2); pool.release(r2); finished.countDown();
            } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
        });
        assertTrue(started.await(2, TimeUnit.SECONDS));
        assertFalse(finished.await(50, TimeUnit.MILLISECONDS), "waiter still blocking");
        pool.release(r1);                              // hand off the slot
        assertTrue(finished.await(2, TimeUnit.SECONDS), "release unblocked waiter");
    }
}
```

The `gate` latch is what makes the stress test bite: all N threads unblock simultaneously, maximising the race on the single `maxSize`-permit semaphore. The second test proves the *handoff* — a blocked waiter is woken by a `release`, not by polling.

### Implement it

State: three fields — a `Semaphore(maxSize, false)`, a `ConcurrentLinkedQueue<R>` of idle resources, an `AtomicInteger totalCreated`. `borrow` acquires a permit under the deadline; failure to acquire returns `null`. Holding a permit, it polls the idle queue — non-null means validate and (if valid) return it; null means create fresh. `release` requeues **then** releases the permit.

```java
public R borrow(long timeout, TimeUnit unit) throws InterruptedException {
    if (!semaphore.tryAcquire(timeout, unit)) return null;   // timed out, no permit held
    while (true) {
        R r = idle.poll();
        if (r == null) {                 // permit guarantees totalCreated < maxSize
            totalCreated.incrementAndGet();
            return factory.get();        // lazy creation
        }
        if (validator.test(r)) return r; // healthy idle resource, reuse it
        // stale: discard and replace, still holding the one permit
        return factory.get();
    }
}

public void release(R resource) {
    if (resource == null) throw new IllegalArgumentException("resource must not be null");
    idle.offer(resource);   // enqueue FIRST...
    semaphore.release();    // ...THEN release the permit — ordering is load-bearing
}

public int inUse()     { return maxSize - semaphore.availablePermits(); }
public int available() { return idle.size(); }
```

**Concurrency mechanism & why:** the semaphore is the single source of truth for the bound — it does the blocking, the timeout, and the fairness policy that you would otherwise hand-code with `wait/notify` and get wrong. The idle queue is lock-free (`ConcurrentLinkedQueue`), so borrow/release never contend on a lock; correctness comes entirely from the permit protocol. **Complexity:** `borrow` and `release` are O(1) amortised (queue poll/offer plus a semaphore op); no scanning, no locking. **The key gotcha:** the enqueue-before-release ordering in `release`. Reverse it and a woken waiter can acquire the permit, find the queue momentarily empty, and mint a resource beyond `maxSize` — the exact invariant the stress test guards.

### Common mistakes & senior signal

- **Wrong release ordering** — releasing the permit before requeuing the resource lets another thread over-create past `maxSize`. The single most common way to fail this kata; the stress test is designed to catch it.
- **Rolling your own counter + `synchronized`/`wait/notify`** — re-implements `Semaphore` and usually leaks a slot or deadlocks under a race. Seniors reach for the primitive.
- **Treating empty idle queue as "exhausted"** — after a successful `acquire` an empty queue means *create*, not *fail*; the permit is your proof you're under the cap.
- **Eager creation** — pre-filling the pool at construction wastes connections when the app is idle; create lazily on first borrow.
- **Throwing on timeout instead of returning `null`** — the contract is `null` for timeout (cheap, caller-driven), exception only for interruption. Confusing the two changes the API's cost profile.
- **Fair semaphore by reflex** — non-fair is the right default here (throughput over strict FIFO); a timed-out thread holds no permit, so the race is safe. Knowing *why* fairness is optional is senior signal.
- **Forgetting the `release` in `finally`** — leaking a borrow permanently shrinks the pool; the senior documents the borrow/try/finally idiom as part of the contract.
- **Senior tell:** connects the code to production — HikariCP sizing (`cores × 2 + spindles`), that bigger pools are usually slower, and what a real pool adds (max lifetime, idle eviction, keep-alive pings) that this deliberately omits.


## Idempotent Processor — Exactly-Once Dedup

### Summary

**What this topic covers**
This kata builds an `IdempotentProcessor` that wraps arbitrary `Supplier<T>` actions so each unique idempotency key triggers its action *exactly once*, no matter how many times — or how concurrently — `process()` is called with that key. It is the in-process heart of the *idempotent consumer* pattern: the thing that stops a redelivered "charge user $50" Kafka message or a retried payment request from double-billing. You design a small two-method API (`process`, `isProcessed`), a dedup key store, and — the whole point — the atomic check-and-set that makes the guarantee hold under a concurrent race. This is a concurrency kata, so the real deliverable is a stress test that would fail a naive implementation, plus the one-line primitive that passes it.

**Mental model**
Brokers (Kafka, SQS, RabbitMQ) give *at-least-once* delivery — a message can arrive twice during a rebalance, retry, or consumer restart. Idempotency turns at-least-once into effectively-once by keying every message and remembering keys you have already handled. The naive store is "check the map, if absent run and put" — but that is a two-step read-then-write, and two threads carrying the same key can both pass the check before either writes, running the action twice (a TOCTOU race). The fix is to make check-and-set a *single atomic operation*: `ConcurrentHashMap.computeIfAbsent(key, k -> action.get())`. The map holds an internal bin lock for that key while the mapping function runs, so the function executes at most once per absent key; every other thread racing the same key blocks briefly, then reads the stored result. One atomic primitive collapses the whole race.

**Key terms**
- **idempotency key** — a globally unique id (usually a producer-set UUID) that identifies a logical operation across retries/redeliveries.
- **at-least-once delivery** — the broker guarantee that a message is delivered one *or more* times; the reason dedup is needed at all.
- **exactly-once (per key)** — the effect you synthesise: the action's side effect happens once even if the message arrives many times.
- **TOCTOU race** — time-of-check/time-of-use: the gap between `containsKey` and `put` where a duplicate slips through and the action double-runs.
- **`computeIfAbsent`** — `ConcurrentHashMap`'s atomic check-and-conditionally-insert; the mapping function runs at most once per absent key.
- **bin lock** — the per-bucket lock CHM holds during `computeIfAbsent`, serialising concurrent first-touch on the same key.
- **`putIfAbsent`** — the sibling atomic op; use when the value is already computed (you still pay to compute it before the call).
- **null-value caveat** — CHM forbids null values; a null result reads back as an *absent* key, silently re-running the action.
- **dedup key store** — the map (or Redis/DB in production) recording processed keys and their cached results.
- **in-process vs distributed** — this guarantee holds inside one JVM; across nodes you need a shared durable store.

**Why interviewers ask this**
It is a compact test of whether you actually understand concurrency, not just its vocabulary. A junior reaches for `get` + null-check + `put`, or slaps `synchronized` on the whole method (correct but needlessly serialises unrelated keys). The senior signal is naming the TOCTOU window unprompted, reaching straight for `computeIfAbsent` because it *atomically* fuses check and set at bin-lock granularity, and knowing the traps: the null-value caveat, that the guarantee is per-JVM only, and that unbounded key growth needs TTL/eviction in production. The strongest candidates write the concurrent stress test *first* — proving they know the naive version fails and exactly how they would catch it.

**Common confusions**
- *"`ConcurrentHashMap` is thread-safe, so `get`-then-`put` is fine."* — Each call is atomic, but the *sequence* is not; the gap between them is the race.
- *"`synchronized` on `process` is wrong."* — It is correct, just coarse: it serialises all keys through one lock. `computeIfAbsent` locks per-bin, so distinct keys proceed in parallel.
- *"Caching null is harmless."* — With CHM a null value throws (or with a plain map reads as absent), re-running the action — the opposite of idempotency.
- *"This gives distributed exactly-once."* — No. It is one JVM. Distributed needs Redis `SET NX EX` or a DB unique index, durable *before* you ack the broker.
- *"The action runs inside the lock, so keep it fast."* — True and worth saying: long actions hold the bin lock and block same-key racers.

**What follows from this topic**
The distributed version swaps the map for Redis `SET NX EX` or an `INSERT … ON CONFLICT DO NOTHING` unique index — the same check-and-set, made durable. It connects to the **[[cache]]** kata (bounded/TTL stores via Caffeine to cap key growth), **[[ratelimit]]** and **[[retry]]** (atomic counters and safe redelivery), and the broader **[[eventbus]]** / Kafka-consumer dedup story. The primitive — one atomic op instead of a check-then-act sequence — is the same lesson behind `AtomicInteger.compareAndSet` and lock-free stacks.

### Clarify & design the API

Questions to settle before writing a line of logic:

- **Generic result, or fixed type?** The action is a `Supplier<T>`, so `process` is generic in `T`; the store holds heterogeneous results, so it is `Map<String, Object>` internally with a checked cast on the way out.
- **What is cached — the result, or just "seen"?** Both: return the cached *result* to every duplicate caller, so a retried request gets the original response, not just a "already done".
- **Concurrency model?** Assume concurrent duplicate delivery of the *same* key is the hard case. That rules out `synchronized`-free naive code and points at an atomic map op.
- **Null policy?** Reject null key and null action up front; forbid null *results* too (the CHM caveat).
- **Scope?** In-process only — call that out; distributed dedup is a follow-up, not this method.

Commit to this surface:

```java
public class IdempotentProcessor {
    <T> T process(String idempotencyKey, Supplier<T> action); // runs action at most once per key
    boolean isProcessed(String idempotencyKey);               // point-in-time snapshot
}
```

### Write the tests

This is the heart of the kata — write these first, watch them pin the spec, then implement to green. Group them: basic contract, core dedup behaviour, argument validation, then the concurrency stress test that a naive impl cannot pass.

**Basic contract — action runs on first touch, `isProcessed` tracks state.**

```java
@Test
void action_runs_once_for_first_call() {
    var processor = new IdempotentProcessor();
    var callCount = new AtomicInteger();
    String result = processor.process("key-1", () -> { callCount.incrementAndGet(); return "value-1"; });
    assertEquals("value-1", result);
    assertEquals(1, callCount.get());
}

@Test
void is_processed_reflects_cache_state() {
    var processor = new IdempotentProcessor();
    assertFalse(processor.isProcessed("new-key"));
    processor.process("new-key", () -> "done");
    assertTrue(processor.isProcessed("new-key"));
}
```

**Core behaviour — duplicates return the cached result without re-running; distinct keys are independent.** The second test is what "idempotent" *means*: a redelivery must return the first result even though its own supplier would return something else.

```java
@Test
void repeated_calls_with_same_key_return_cached_result_without_running_action_again() {
    var processor = new IdempotentProcessor();
    var callCount = new AtomicInteger();
    String first  = processor.process("key-a", () -> { callCount.incrementAndGet(); return "result"; });
    String second = processor.process("key-a", () -> { callCount.incrementAndGet(); return "should-never-be-returned"; });
    String third  = processor.process("key-a", () -> "also-never");
    assertEquals("result", first);
    assertEquals("result", second, "duplicate must return cached value");
    assertEquals("result", third);
    assertEquals(1, callCount.get(), "action must run exactly once");
}

@Test
void different_keys_run_independently() {
    var processor = new IdempotentProcessor();
    var counter = new AtomicInteger();
    processor.process("key-x", () -> { counter.incrementAndGet(); return "x"; });
    processor.process("key-y", () -> { counter.incrementAndGet(); return "y"; });
    assertEquals(2, counter.get(), "one execution per distinct key");
}
```

**Argument validation — reject null key and null action with `assertThrows`.**

```java
@Test void null_key_throws()    { var p = new IdempotentProcessor();
    assertThrows(IllegalArgumentException.class, () -> p.process(null, () -> "v")); }
@Test void null_action_throws() { var p = new IdempotentProcessor();
    assertThrows(IllegalArgumentException.class, () -> p.process("key", null)); }
```

**The stress test — the one that fails a naive `get`/`put`.** Fire N threads at the *same* key through a start gate so they collide on first-touch. Assert the action ran exactly once and every caller got the same result. A TOCTOU implementation intermittently records 2+ executions here; `computeIfAbsent` holds it at 1. Use a `CountDownLatch` gate to maximise the race and virtual threads to cheaply fan out.

```java
@Test
void concurrent_calls_with_same_key_execute_action_exactly_once() throws Exception {
    var processor = new IdempotentProcessor();
    var executions = new AtomicInteger();
    var results = new CopyOnWriteArrayList<String>();
    int N = 200;
    var gate = new CountDownLatch(1);
    var done = new CountDownLatch(N);

    try (var exec = Executors.newVirtualThreadPerTaskExecutor()) {
        IntStream.range(0, N).forEach(i -> exec.submit(() -> {
            try {
                gate.await(); // all threads block here, then stampede together
                results.add(processor.process("shared-key", () -> {
                    executions.incrementAndGet();
                    return "computed-once";
                }));
            } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
            finally { done.countDown(); }
        }));
        gate.countDown(); // release the stampede
        assertTrue(done.await(5, TimeUnit.SECONDS), "timed out — possible deadlock");
    }

    assertEquals(1, executions.get(), "action must execute exactly once under concurrent first-touch");
    assertEquals(N, results.size());
    assertTrue(results.stream().allMatch("computed-once"::equals), "all callers get the same result");
}
```

A companion test with N *distinct* keys asserts N executions and confirms per-key isolation holds under contention on the shared map.

### Implement it

The store is a `ConcurrentHashMap<String, Object>`; the whole exactly-once guarantee is `computeIfAbsent`. Guard the arguments, then let the atomic op do the work — the mapping lambda runs at most once per absent key because CHM holds that key's bin lock while it runs.

```java
public class IdempotentProcessor {
    private final ConcurrentHashMap<String, Object> cache = new ConcurrentHashMap<>();

    @SuppressWarnings("unchecked")
    public <T> T process(String idempotencyKey, Supplier<T> action) {
        if (idempotencyKey == null) throw new IllegalArgumentException("idempotencyKey must not be null");
        if (action == null)         throw new IllegalArgumentException("action must not be null");

        Object result = cache.computeIfAbsent(idempotencyKey, k -> {
            T value = action.get();               // runs at most once per key
            if (value == null)                    // CHM forbids null; null would read as "absent"
                throw new IllegalStateException("action must not return null");
            return value;
        });
        return (T) result;                        // safe: we only ever store Supplier<T> outputs
    }

    public boolean isProcessed(String idempotencyKey) {
        return cache.containsKey(idempotencyKey); // snapshot only — do not branch on it
    }
}
```

- **Concurrency mechanism:** `computeIfAbsent`'s per-bin lock, *not* a method-level `synchronized`. Distinct keys hash to different bins and proceed in parallel; only same-key first-touch serialises.
- **Complexity:** O(1) average per `process` / `isProcessed` (hash lookup); O(n) space in the number of distinct keys.
- **Key gotcha:** the null-result guard. Without it a null slips past, the key reads as absent next time, and the action re-runs — silently breaking the one property the class exists to provide.

### Common mistakes & senior signal

- **The TOCTOU trap.** `if (cache.containsKey(k)) return cache.get(k); else cache.put(k, action.get());` looks fine and passes every single-threaded test — then double-runs under the stress test. Naming this race unprompted is the senior tell.
- **Over-locking.** `synchronized` on `process` is *correct* but serialises all keys through one monitor. `computeIfAbsent` gives the same safety at per-bin granularity. Knowing it is correct-but-coarse (not "wrong") is the nuanced answer.
- **The null-value caveat.** Forgetting it means the null result re-reads as absent and the action re-fires — the exact opposite of idempotency. Guard and throw clearly.
- **Long actions inside the lambda.** The action runs while the bin lock is held, blocking same-key racers. Fine for the kata; in production keep it short or compute outside and `putIfAbsent`.
- **Claiming distributed exactly-once.** A senior scopes the guarantee to one JVM and names the distributed upgrade: Redis `SET NX EX` or a DB unique index, made durable *before* acking the broker.
- **Ignoring growth.** Unbounded key accumulation is a real leak; the senior flags Caffeine/Guava TTL eviction or a shared store with expiry as the production swap, while noting the plain map is right for the kata.


## Scatter-Gather Aggregator

### Summary

**What this topic covers**
This kata builds a `ScatterGather<T>` — the async fan-out / fan-in pattern behind federated search, price aggregators, and microservice gateways. You accept an injected `Executor` and a `List<Supplier<T>>`, submit every task concurrently (the *scatter*), and then aggregate their results (the *gather*) two ways. `gatherAll` waits for every task and fails fast if any one throws. `gatherAllWithTimeout` enforces a per-task deadline and returns only the results that arrived in time, silently dropping slow or failed tasks. The whole exercise lives on `CompletableFuture` — no manual thread management, no `CountDownLatch`, no `Future.get()` polling. Doing it test-first forces you to pin the two behaviours (fail-fast vs partial-result) before you touch the async plumbing, which is exactly where candidates get lost.

**Mental model**
Three phases, and the trap is between phase 2 and 3. *Scatter*: for each supplier, `CompletableFuture.supplyAsync(task, executor)` — this hands the work to your executor and captures its result-or-exception in a future. Keep every individual future in a list. *Barrier*: `CompletableFuture.allOf(futures...)` returns a `CompletableFuture<Void>` that fires when all complete — but it holds no results, only a completion signal. *Gather*: once the barrier fires, walk your original list and `join()` each future; because the barrier just completed, every `join()` is non-blocking. For the timeout variant, wrap each future with `.orTimeout(...)` then `.handle((v, ex) -> ex == null ? Optional.of(v) : Optional.empty())` so exceptions are *absorbed* — that keeps `allOf` from failing, and you filter for present Optionals after the barrier. The mental unlock: `allOf` is a barrier, not a collector.

**Key terms**
- **scatter / gather** — fan out N tasks concurrently, then fan in their results into one response.
- **`CompletableFuture.supplyAsync(supplier, executor)`** — runs the supplier on the executor, capturing result or exception in the future. The scatter primitive.
- **`allOf(cfs...)`** — barrier that completes (as `Void`) when *all* inputs complete; fails fast if any input fails.
- **`anyOf(cfs...)`** — completes on the *first* input to finish; the primitive for hedged requests, not used here.
- **`join()`** — retrieves the value, rethrowing failures wrapped in `CompletionException` (unchecked). `get()` is the checked-exception twin.
- **`orTimeout(t, unit)`** — completes the future *exceptionally* with `TimeoutException` if the deadline passes.
- **`completeOnTimeout(default, t, unit)`** — completes *normally* with a sentinel; rejected here to avoid inventing a meaningful default.
- **`handle((v, ex) -> ...)`** — runs on both success and failure, letting you convert an exceptional future into a normal `Optional`.
- **`Supplier<T>` vs pre-built `CompletableFuture<T>`** — suppliers stay lazy and start on *your* executor; pre-built futures already started on the caller's thread.
- **virtual-thread-per-task executor** — `Executors.newVirtualThreadPerTaskExecutor()`, the cheap no-pool-sizing default for blocking I/O tasks (JEP 444).
- **`CompletionException`** — the unchecked wrapper `join()` throws; the original is at `.getCause()`.

**Why interviewers ask this**
It separates people who *know about* `CompletableFuture` from people who can *compose* it. A junior reaches for `allOf(...).get()` and then can't explain where the results are — because `allOf` returned `Void` and they discarded the individual futures. A senior keeps the individual-future list, knows `join()` after the barrier can't block, and articulates the fail-fast-vs-partial-result trade-off as a product decision (a slow shard shouldn't degrade the whole response). The timeout variant is the real discriminator: absorbing per-task failures with `handle` so the barrier never fails, choosing `orTimeout` over `completeOnTimeout`, and preserving input order in the strict variant while accepting unordered partial results in the lenient one. It's also a clean read on whether someone writes deterministic async tests instead of flaky `sleep`-and-hope assertions.

**Common confusions**
- *"`allOf` gives me the results."* → No — it's a `CompletableFuture<Void>`. Results live in the original futures; keep references to them.
- *"`join()` after the barrier might block or throw `InterruptedException`."* → It can't block (barrier guarantees done) and `join()` throws unchecked `CompletionException`, never `InterruptedException`.
- *"I'll pass in `CompletableFuture`s."* → Then they start on the caller's thread and your `Executor` is meaningless. Accept `Supplier<T>` and call `supplyAsync` yourself.
- *"Timeout means I cancel the tasks."* → `orTimeout` doesn't cancel the underlying work; it just completes *your* future exceptionally so you stop waiting. The task keeps running (a deliberate trade-off).
- *"`completeOnTimeout` is simpler."* → Only if a sentinel default is meaningful. For "drop it", `orTimeout` + `handle`→`Optional.empty()` is cleaner.
- *"Partial results keep input order."* → No — fast tasks race into the list; assert membership via a `Set`, not index equality.

**What follows from this topic**
This is the composition layer above the single-future primitives in the Java primer (Q50 `CompletableFuture`, Q168 exception handling, Q243 scatter-gather). It pairs naturally with the circuit-breaker and retry katas (what a gateway does *around* each downstream call), the bounded blocking queue (the backpressure primitive when fan-out outpaces consumers), and hedged-request patterns via `anyOf`. Once fan-out/fan-in is muscle memory, structured concurrency (`StructuredTaskScope`, JEP 480+) is the next step — same shape, with lifetime and cancellation handled by the scope.

### Clarify & design the API

Before writing logic, nail down the contract with a few questions:

- **Result semantics on failure?** `gatherAll` fails fast (any throw fails the whole future). `gatherAllWithTimeout` never throws for a task failure — timed-out and failed tasks are silently dropped.
- **Ordering?** Strict gather is index-aligned with the input list. Partial gather is unordered (fast tasks race in).
- **Who owns the threads?** An injected `Executor` (tests want a controlled one to verify parallelism); the no-arg constructor defaults to virtual threads.
- **Lazy or eager tasks?** `Supplier<T>`, so nothing runs until `gatherAll` submits it on our executor.
- **Validation?** Reject null `tasks`; `gatherAllWithTimeout` also rejects null / zero / negative timeouts.

Commit to these signatures before touching async plumbing:

```java
public class ScatterGather {
    public ScatterGather();                       // virtual-thread-per-task executor
    public ScatterGather(Executor executor);      // injected, null-checked

    public <T> CompletableFuture<List<T>> gatherAll(List<Supplier<T>> tasks);

    public <T> CompletableFuture<List<T>> gatherAllWithTimeout(
            List<Supplier<T>> tasks, Duration timeout);
}
```

### Write the tests

Write these first — they pin both behaviours before a line of `CompletableFuture` code exists. Group them: the strict-gather contract, the timeout partial-result behaviour, and edge/validation cases. Inject a real virtual-thread executor so the async paths actually run, and drive determinism through `.join()` on the returned future (the barrier guarantees completion) rather than sleeping in the assertions.

**Group 1 — `gatherAll`: all results, order, fail-fast.** Prove every result comes back, that ordering is index-aligned even when a slow task finishes last, and that a single throw surfaces as a `CompletionException` wrapping the original.

```java
@Test
void gather_all_returns_all_results_in_input_order() {
    var sg = new ScatterGather(Executors.newVirtualThreadPerTaskExecutor());
    List<Supplier<Integer>> tasks = List.of(() -> 1, () -> 2, () -> 3);

    List<Integer> results = sg.gatherAll(tasks).join();

    assertEquals(List.of(1, 2, 3), results);   // index-aligned, not a Set
}

@Test
void gather_all_preserves_order_even_when_first_task_is_slowest() {
    var sg = new ScatterGather(Executors.newVirtualThreadPerTaskExecutor());
    List<Supplier<String>> tasks = List.of(
            () -> { sleepMs(10); return "slow"; },   // finishes last...
            () -> "fast-a",
            () -> "fast-b");

    List<String> results = sg.gatherAll(tasks).join();

    assertEquals("slow", results.get(0));        // ...but still index 0
}

@Test
void gather_all_fails_fast_wrapping_the_original_exception() {
    var sg = new ScatterGather(Executors.newVirtualThreadPerTaskExecutor());
    List<Supplier<Integer>> tasks = List.of(
            () -> 1,
            () -> { throw new RuntimeException("task-2 failed"); },
            () -> 3);

    CompletableFuture<List<Integer>> future = sg.gatherAll(tasks);

    var ex = assertThrows(CompletionException.class, future::join);
    assertEquals("task-2 failed", ex.getCause().getMessage());
}
```

**Group 2 — `gatherAllWithTimeout`: partial results, drop slow, drop failed.** This is the heart of the kata. A slow task past the deadline is dropped; if everything is slow the result is empty; a *failed* task is dropped exactly like a timed-out one; and when everything is fast, all results come back (unordered — assert via `Set`).

```java
@Test
void timeout_keeps_fast_tasks_and_drops_the_slow_one() {
    var sg = new ScatterGather(Executors.newVirtualThreadPerTaskExecutor());
    List<Supplier<String>> tasks = List.of(
            () -> "fast-1",
            () -> { sleepMs(200); return "slow"; },   // > 50ms timeout
            () -> "fast-2");

    List<String> results = sg.gatherAllWithTimeout(tasks, Duration.ofMillis(50)).join();

    // Partial gather is unordered — assert membership, not index.
    assertEquals(Set.of("fast-1", "fast-2"), Set.copyOf(results));
    assertEquals(2, results.size());
}

@Test
void timeout_returns_empty_when_every_task_is_slow() {
    var sg = new ScatterGather(Executors.newVirtualThreadPerTaskExecutor());
    List<Supplier<String>> tasks = List.of(
            () -> { sleepMs(300); return "late-1"; },
            () -> { sleepMs(300); return "late-2"; });

    List<String> results = sg.gatherAllWithTimeout(tasks, Duration.ofMillis(50)).join();

    assertTrue(results.isEmpty());
}

@Test
void timeout_drops_a_failed_task_but_keeps_successful_ones() {
    var sg = new ScatterGather(Executors.newVirtualThreadPerTaskExecutor());
    List<Supplier<String>> tasks = List.of(
            () -> "ok",
            () -> { throw new RuntimeException("boom"); });

    // Generous timeout: the throw happens well before the deadline, yet is still dropped.
    List<String> results = sg.gatherAllWithTimeout(tasks, Duration.ofSeconds(5)).join();

    assertEquals(List.of("ok"), results);
}
```

**Group 3 — edges & argument validation.** Empty list is a valid (empty-result) request; nulls and non-positive timeouts are rejected up front with `assertThrows`.

```java
@Test
void gather_all_of_empty_list_completes_with_empty_results() {
    var sg = new ScatterGather(Executors.newVirtualThreadPerTaskExecutor());
    assertTrue(sg.<Integer>gatherAll(List.of()).join().isEmpty());
}

@Test
void rejects_null_tasks_and_nonpositive_timeouts() {
    var sg = new ScatterGather(Executors.newVirtualThreadPerTaskExecutor());
    assertThrows(IllegalArgumentException.class, () -> sg.gatherAll(null));
    assertThrows(IllegalArgumentException.class,
            () -> sg.gatherAllWithTimeout(List.of(() -> 1), Duration.ZERO));
    assertThrows(IllegalArgumentException.class,
            () -> sg.gatherAllWithTimeout(List.of(() -> 1), Duration.ofMillis(-1)));
    assertThrows(IllegalArgumentException.class, () -> new ScatterGather(null));
}
```

**On testing async deterministically:** you don't need `CountDownLatch` gymnastics here — the returned `CompletableFuture` *is* the synchronization point. `.join()` blocks exactly until the barrier completes, so assertions run against a settled result, never a race. Keep task `sleep` durations comfortably on the correct side of the timeout (200ms task vs 50ms deadline) so timing jitter can't flip the outcome. If you want a hard ceiling on the whole flow, wrap the call in `assertTimeoutPreemptively(Duration.ofSeconds(1), () -> sg.gatherAllWithTimeout(...).join())` to catch an implementation that never completes the barrier (e.g. forgot to absorb an exception, so `allOf` hangs a caller waiting on a future that failed).

### Implement it

Three phases, mirroring the tests. **Scatter** each supplier with `supplyAsync(task, executor)` and *retain the individual futures*. **Barrier** with `allOf`. **Gather** by `join()`-ing the retained futures after the barrier.

```java
public <T> CompletableFuture<List<T>> gatherAll(List<Supplier<T>> tasks) {
    if (tasks == null) throw new IllegalArgumentException("tasks must not be null");

    // Scatter — keep each future; allOf returns Void, so the results live here.
    List<CompletableFuture<T>> futures = new ArrayList<>(tasks.size());
    for (Supplier<T> task : tasks) {
        futures.add(CompletableFuture.supplyAsync(task, executor));
    }

    CompletableFuture<Void> barrier =
            CompletableFuture.allOf(futures.toArray(new CompletableFuture[0]));

    // Gather — barrier guarantees each future is done, so join() can't block.
    // If one failed, join() rethrows here → the gathered future fails fast. That's the spec.
    return barrier.thenApply(ignored -> {
        List<T> out = new ArrayList<>(futures.size());
        for (CompletableFuture<T> f : futures) out.add(f.join());
        return out;
    });
}
```

The timeout variant differs only in the *wrap*: give each future `.orTimeout(...)`, then `.handle(...)` to fold both timeout and failure into `Optional.empty()`. That absorption is load-bearing — it stops a single failed task from failing `allOf`, so the barrier always completes normally and the gather just filters for present values.

```java
public <T> CompletableFuture<List<T>> gatherAllWithTimeout(
        List<Supplier<T>> tasks, Duration timeout) {
    if (tasks == null) throw new IllegalArgumentException("tasks must not be null");
    if (timeout == null || timeout.isNegative() || timeout.isZero())
        throw new IllegalArgumentException("timeout must be positive");

    long nanos = timeout.toNanos();
    List<CompletableFuture<Optional<T>>> wrapped = new ArrayList<>(tasks.size());
    for (Supplier<T> task : tasks) {
        CompletableFuture<Optional<T>> safe =
                CompletableFuture.supplyAsync(task, executor)
                        .orTimeout(nanos, TimeUnit.NANOSECONDS)          // fail on deadline
                        .handle((v, ex) -> ex == null                    // absorb ANY failure
                                ? Optional.of(v) : Optional.empty());
        wrapped.add(safe);
    }

    CompletableFuture<Void> barrier =
            CompletableFuture.allOf(wrapped.toArray(new CompletableFuture[0]));

    return barrier.thenApply(ignored -> {
        List<T> out = new ArrayList<>(wrapped.size());
        for (CompletableFuture<Optional<T>> f : wrapped) f.join().ifPresent(out::add);
        return out;
    });
}
```

**Complexity:** scatter is O(n) submissions; wall-clock latency is the *max* single-task time (or the timeout), not the sum — that's the whole point of fanning out. Gather is O(n). Memory is O(n) futures. **Default executor:** `Executors.newVirtualThreadPerTaskExecutor()` — cheap, no pool sizing, ideal for blocking I/O tasks. **The gotcha in one line:** you must hold the individual-future list, because `allOf` hands you a `Void` barrier, not your data.

### Common mistakes & senior signal

- **Discarding the individual futures** and expecting `allOf` to carry results — the number-one trap. `allOf` is a `CompletableFuture<Void>`; the results are in the futures you (should have) kept.
- **Blocking inside the scatter loop** with `future.get()` per task — that serialises the fan-out into sequential calls and defeats the pattern. Submit everything first, `join()` only after the barrier.
- **Letting a task failure fail `allOf` in the timeout variant** — forgetting `.handle` means one exceptional future propagates and the whole partial-gather throws. Absorb into `Optional` *before* the barrier.
- **`completeOnTimeout` when you mean "drop it"** — that injects a sentinel default into your results. Use `orTimeout` + `handle`→`empty`.
- **Passing pre-built `CompletableFuture`s** instead of `Supplier`s — they start on the caller's thread and make the injected executor a lie.
- **Asserting index order on partial results** — fast tasks race into the list; a senior asserts membership via a `Set` and reserves index equality for the strict `gatherAll`.
- **Flaky timing tests** — sleeps a hair either side of the deadline. A senior picks durations with a wide margin (200ms vs 50ms) and leans on `.join()` for determinism, optionally guarding the flow with `assertTimeoutPreemptively`.
- **Senior signal:** frames fail-fast vs partial-result as a *product* decision, notes that `orTimeout` doesn't cancel the underlying work (and why that's an acceptable trade-off for short fan-outs), reaches for virtual threads without agonising over pool size, and mentions `StructuredTaskScope` as the modern successor when cancellation and lifetime need to be first-class.


## Event Bus — Synchronous Pub/Sub (Observer)

### Summary

**What this topic covers**
This kata builds an in-process, type-keyed publish/subscribe bus — the Observer pattern in its "event bus" form. You implement `EventBus` from scratch: `subscribe(Class<T>, Consumer<T>)` registers a handler for a specific event type and returns a cancellable `Subscription` token; `publish(Object)` dispatches an event to every handler registered for its *exact runtime type*. Publishers never know who is listening, and subscribers never know who fired the event — that decoupling is the whole point. The interesting part is not the happy path; it is staying correct while handlers subscribe, publish, and unsubscribe *concurrently*, isolating handler exceptions so one bad listener can't starve the rest, and giving back an idempotent unsubscribe handle.

**Mental model**
Picture a `Map<Class<?>, List<Handler>>`: the key is the event type, the value is an ordered list of handlers. `publish` does one map lookup on `event.getClass()` and iterates that list. Two structural choices make it thread-safe without a global lock. The outer map is a `ConcurrentHashMap`, so different event types are subscribed and published independently with no contention. Each per-type list is a `CopyOnWriteArrayList` (COWAL): every mutation copies the backing array, so an in-flight `publish` iterates a *stable snapshot* taken when the loop began — a concurrent subscribe or unsubscribe is simply invisible to it, and no `ConcurrentModificationException` is possible. That is exactly the right trade for a bus where reads (publishes) massively outnumber writes (subscribe/unsubscribe). The `Subscription` returned by `subscribe` closes over the exact handler entry it created, so `unsubscribe()` removes precisely that one registration.

**Key terms**
- **Observer / Pub-Sub** — producers emit events; consumers register interest; the bus decouples them. Foundation of UI toolkits, domain events, plugin systems.
- **`Consumer<T>`** — the handler: a callback taking one event, returning nothing.
- **`Subscription`** — the returned token whose `unsubscribe()` cancels one registration; idempotent by design.
- **`ConcurrentHashMap`** — lock-striped map; concurrent subscribe/publish on *different* types never contend.
- **`CopyOnWriteArrayList` (COWAL)** — snapshot-on-iterate list: writes copy the array, reads (publish) are lock-free and never see a half-mutated list.
- **Exact type dispatch** — routing on `event.getClass()`, the concrete runtime type — *not* superclasses or interfaces.
- **Error isolation** — wrapping each handler in try/catch so a throwing handler doesn't block the rest.
- **Fail-safe iteration** — iterating a snapshot rather than the live collection; COWAL gives this for free.
- **Registration order (FIFO)** — handlers fire in the order they subscribed; COWAL preserves insertion order.
- **Structural equality** — `HandlerEntry` is a record, so `remove(entry)` matches by value, targeting the right registration.

**Why interviewers ask this**
It looks trivial — a map of lists — but it separates juniors from seniors on concurrency and API design. A junior writes `HashMap<Class, ArrayList>`, iterates the live list in `publish`, and lets the first throwing handler abort the loop. Under a concurrent stress test that impl throws `ConcurrentModificationException` or drops deliveries; with a throwing handler it silently starves everyone downstream. A senior reaches for `ConcurrentHashMap` + `CopyOnWriteArrayList`, can *justify* COWAL from the read-heavy access pattern, wraps each dispatch in try/catch, and returns an idempotent `Subscription` instead of forcing callers to hold the original lambda for removal. Bonus signal: naming the trade-offs — synchronous vs async dispatch, exact-type vs Guava-style hierarchy walking, COWAL's copy cost on write.

**Common confusions**
- *"A handler for `Animal.class` should catch a `Dog` event."* No — dispatch is on `getClass()`, the exact runtime type. `Dog` events reach only `Dog.class` handlers. (Guava walks the hierarchy; this bus deliberately doesn't.)
- *"COWAL is just a slower list."* Its cost is on write; reads/iteration are lock-free and snapshot-consistent — perfect for read-heavy pub/sub.
- *"Synchronized ArrayList would also work."* It would, but it blocks concurrent publishers during iteration; COWAL lets publishes proceed with no lock.
- *"Removing by the lambda is enough."* Lambdas have no value equality — two subscriptions of the *same* lambda are distinct entries. You must capture the specific `HandlerEntry` to remove exactly one.
- *"A throwing handler should propagate."* Then one buggy plugin breaks every other subscriber. Catch and continue.

**What follows from this topic**
The same registry-and-dispatch skeleton generalises to an *asynchronous* bus (wrap each `handler.accept(event)` in `executor.submit(...)`), to hierarchy-walking dispatch (Guava EventBus), and to reactive `Disposable`/`Subscription` handles (RxJava, Project Reactor). The COWAL snapshot trick is the same fail-safe-iteration idea behind listener lists in Swing/AWT. Related katas: any Observer/callback-registry problem, and concurrency katas that lean on `ConcurrentHashMap` and copy-on-write structures.

### Clarify & design the API

Before writing logic, pin the contract with a few clarifying questions:

- **Type matching — exact or polymorphic?** Exact `getClass()` (chosen here) vs Guava-style hierarchy walking. Exact is simpler and predictable; say so.
- **Sync or async delivery?** Synchronous on the caller's thread (chosen) gives ordering and visible exceptions; async needs an executor.
- **What does a throwing handler do?** Isolate and continue — never propagate, never abort the loop.
- **No subscribers?** `publish` is a silent no-op (fire-and-forget semantics).
- **Ordering guarantee?** FIFO registration order.
- **Unsubscribe semantics?** Returns a token; `unsubscribe()` is idempotent; removes exactly one registration even if the same handler subscribed twice.
- **Null arguments?** Reject `type`, `handler`, and `event` with `IllegalArgumentException`.

Commit to these signatures before touching data structures:

```java
public class EventBus {
    public <T> Subscription subscribe(Class<T> type, Consumer<T> handler) { ... }
    public void publish(Object event) { ... }
}

public interface Subscription {
    void unsubscribe();   // idempotent — safe to call repeatedly
}
```

### Write the tests

Write these *first* — they pin the whole spec, and for this kata the concurrency tests are what actually force the right data structures. Group them: basic contract, core behaviour, edge/validation, then the concurrency stress tests.

**Basic contract — delivery, multiplicity, order**

```java
@Test
void handler_receives_published_event_of_its_type() {
    var bus = new EventBus();
    List<OrderPlaced> received = new ArrayList<>();
    bus.subscribe(OrderPlaced.class, received::add);
    bus.publish(new OrderPlaced(42));
    assertEquals(1, received.size());
    assertEquals(42, received.get(0).orderId());
}

@Test
void multiple_handlers_for_same_type_all_fire() {
    var bus = new EventBus();
    var counter = new AtomicInteger();
    bus.subscribe(OrderPlaced.class, e -> counter.incrementAndGet());
    bus.subscribe(OrderPlaced.class, e -> counter.incrementAndGet());
    bus.subscribe(OrderPlaced.class, e -> counter.incrementAndGet());
    bus.publish(new OrderPlaced(1));
    assertEquals(3, counter.get());
}

@Test
void handlers_are_invoked_in_registration_order() {
    var bus = new EventBus();
    List<Integer> order = new ArrayList<>();
    bus.subscribe(OrderPlaced.class, e -> order.add(1));
    bus.subscribe(OrderPlaced.class, e -> order.add(2));
    bus.subscribe(OrderPlaced.class, e -> order.add(3));
    bus.publish(new OrderPlaced(0));
    assertEquals(List.of(1, 2, 3), order);
}
```
These lock in fan-out (all handlers fire) and FIFO ordering — the guarantee COWAL's insertion order gives you.

**Type routing & unsubscribe**

```java
@Test
void event_of_different_type_is_not_delivered_to_handler() {
    var bus = new EventBus();
    var counter = new AtomicInteger();
    bus.subscribe(OrderPlaced.class, e -> counter.incrementAndGet());
    bus.publish(new PaymentReceived(50));            // wrong type
    assertEquals(0, counter.get());
}

@Test
void unsubscribe_stops_delivery() {
    var bus = new EventBus();
    var counter = new AtomicInteger();
    Subscription sub = bus.subscribe(OrderPlaced.class, e -> counter.incrementAndGet());
    bus.publish(new OrderPlaced(1));                 // counter = 1
    sub.unsubscribe();
    bus.publish(new OrderPlaced(2));                 // removed — stays 1
    assertEquals(1, counter.get());
}

@Test
void unsubscribe_removes_only_own_handler_not_others() {
    var bus = new EventBus();
    var c1 = new AtomicInteger();
    var c2 = new AtomicInteger();
    Subscription sub1 = bus.subscribe(OrderPlaced.class, e -> c1.incrementAndGet());
    bus.subscribe(OrderPlaced.class, e -> c2.incrementAndGet());
    sub1.unsubscribe();
    bus.publish(new OrderPlaced(1));
    assertEquals(0, c1.get());                       // removed
    assertEquals(1, c2.get());                       // untouched
}
```
`different_type` proves dispatch is by exact type; `removes_only_own_handler` is the test that fails if you remove by lambda identity or clear the whole list.

**Edge & idempotency — no-subscriber, repeated unsubscribe, error isolation**

```java
@Test
void event_with_no_subscribers_is_a_no_op() {
    var bus = new EventBus();
    assertDoesNotThrow(() -> bus.publish(new PaymentReceived(100)));
}

@Test
void unsubscribe_is_idempotent() {
    var bus = new EventBus();
    var counter = new AtomicInteger();
    Subscription sub = bus.subscribe(OrderPlaced.class, e -> counter.incrementAndGet());
    sub.unsubscribe();
    assertDoesNotThrow(sub::unsubscribe);            // 2nd call — no-op
    assertDoesNotThrow(sub::unsubscribe);            // 3rd call — no-op
    bus.publish(new OrderPlaced(1));
    assertEquals(0, counter.get());
}

@Test
void throwing_handler_does_not_prevent_subsequent_handlers_from_running() {
    var bus = new EventBus();
    var counter = new AtomicInteger();
    bus.subscribe(OrderPlaced.class, e -> { throw new RuntimeException("bad"); });
    bus.subscribe(OrderPlaced.class, e -> counter.incrementAndGet());  // must still run
    bus.subscribe(OrderPlaced.class, e -> counter.incrementAndGet());  // must still run
    assertDoesNotThrow(() -> bus.publish(new OrderPlaced(1)));
    assertEquals(2, counter.get());                 // healthy handlers survive
}
```
The throwing-handler test is the one that catches the naive `for` loop with no try/catch — subtle because a single-handler test would never reveal the starvation.

**Concurrency stress tests — the ones that force COWAL**

```java
@Test
void concurrent_publishes_deliver_to_all_handlers() throws Exception {
    var bus = new EventBus();
    var counter = new AtomicInteger();
    bus.subscribe(OrderPlaced.class, e -> counter.incrementAndGet());

    int N = 200;
    var gate = new CountDownLatch(1);
    var done = new CountDownLatch(N);
    try (var exec = Executors.newVirtualThreadPerTaskExecutor()) {
        IntStream.range(0, N).forEach(i -> exec.submit(() -> {
            try { gate.await(); bus.publish(new OrderPlaced(i)); }
            catch (InterruptedException e) { Thread.currentThread().interrupt(); }
            finally { done.countDown(); }
        }));
        gate.countDown();                            // release all at once
        assertTrue(done.await(5, TimeUnit.SECONDS));
    }
    assertEquals(N, counter.get());                  // every publish reached the handler once
}

@Test
void concurrent_subscribe_and_publish_are_safe() throws Exception {
    var bus = new EventBus();
    var received = new CopyOnWriteArrayList<OrderPlaced>();

    int N = 100;
    var gate = new CountDownLatch(1);
    var done = new CountDownLatch(N * 2);
    try (var exec = Executors.newVirtualThreadPerTaskExecutor()) {
        IntStream.range(0, N).forEach(i -> exec.submit(() -> {   // publishers
            try { gate.await(); bus.publish(new OrderPlaced(i)); }
            catch (InterruptedException e) { Thread.currentThread().interrupt(); }
            finally { done.countDown(); }
        }));
        IntStream.range(0, N).forEach(i -> exec.submit(() -> {   // subscribers mid-flight
            try { gate.await(); bus.subscribe(OrderPlaced.class, received::add); }
            catch (InterruptedException e) { Thread.currentThread().interrupt(); }
            finally { done.countDown(); }
        }));
        gate.countDown();
        assertTrue(done.await(5, TimeUnit.SECONDS)); // only assert: no exception thrown
    }
}
```
A `CountDownLatch` gate releases all virtual threads simultaneously to maximise contention. The first test asserts *exactly* N deliveries — no missed or duplicate dispatch. The second subscribes *during* publishes: an unsynchronised `ArrayList` throws `ConcurrentModificationException` here; COWAL absorbs it (a handler added mid-flight may or may not fire for a racing publish — non-deterministic and acceptable, so we only assert no exception).

### Implement it

Two structures carry the whole design:

```java
public class EventBus {

    private record HandlerEntry<T>(Class<T> type, Consumer<T> handler) {}

    private final Map<Class<?>, CopyOnWriteArrayList<HandlerEntry<?>>> handlers =
            new ConcurrentHashMap<>();

    public <T> Subscription subscribe(Class<T> type, Consumer<T> handler) {
        if (type == null)    throw new IllegalArgumentException("type must not be null");
        if (handler == null) throw new IllegalArgumentException("handler must not be null");

        HandlerEntry<T> entry = new HandlerEntry<>(type, handler);
        handlers.computeIfAbsent(type, k -> new CopyOnWriteArrayList<>()).add(entry);

        return new Subscription() {
            private volatile boolean cancelled = false;
            @Override public void unsubscribe() {
                if (!cancelled) {
                    cancelled = true;
                    var list = handlers.get(entry.type());
                    if (list != null) list.remove(entry);   // remove(Object) uses equals()
                }
            }
        };
    }

    @SuppressWarnings("unchecked")
    public void publish(Object event) {
        if (event == null) throw new IllegalArgumentException("event must not be null");
        var list = handlers.get(event.getClass());          // exact runtime type
        if (list == null) return;                            // no subscribers — fast no-op
        for (HandlerEntry<?> entry : list) {                 // iterate the COWAL snapshot
            try {
                ((Consumer<Object>) (Consumer<?>) entry.handler()).accept(event);
            } catch (Exception ex) {
                // error isolation: swallow (or log / dead-letter) and continue
            }
        }
    }
}
```

- **Data structures**: `ConcurrentHashMap` keyed by `Class<?>`; each value a `CopyOnWriteArrayList` of handler entries. `computeIfAbsent` atomically creates the per-type list on first subscribe.
- **Concurrency mechanism**: no explicit locks. The map handles concurrent writes across types; COWAL makes `publish` iteration lock-free over a stable snapshot, so subscribe/unsubscribe during publish can't corrupt it. `cancelled` is `volatile` for visibility across threads.
- **Unsubscribe identity**: `HandlerEntry` is a **record**, so `equals` is structural — `list.remove(entry)` deletes exactly the registration this closure captured. Lambdas lack value equality, so subscribing the same lambda twice yields two distinct entries and each token removes only its own.
- **Type dispatch**: `handlers.get(event.getClass())` — the concrete runtime type. The unchecked cast is safe because entries under a key were subscribed *for* that exact type.
- **Complexity**: `subscribe` O(n) amortised (COWAL append copies the array). `publish` O(h) over h handlers for that type, plus one O(1) map lookup. `unsubscribe` O(n) (COWAL remove copies). Memory: one entry per registration. Given publishes dominate, paying copy cost on the rare write to get lock-free reads is the right bargain.
- **Key gotcha**: iterating the *live* list in `publish` (rather than COWAL's snapshot) or forgetting the per-handler try/catch — both pass single-threaded happy-path tests and fail exactly the two hardest tests.

### Common mistakes & senior signal

- **Iterating a live `ArrayList` in `publish`** → `ConcurrentModificationException` when a handler subscribes/unsubscribes mid-dispatch. COWAL's snapshot iteration is the fix; a `synchronized` list also works but blocks concurrent publishers.
- **No try/catch around each handler** → the first throwing handler aborts the loop and silently starves everyone after it. Invisible with one handler per type; caught only by the error-isolation test.
- **Removing by lambda / clearing the list on unsubscribe** → wrong registration removed, or all of them. Capture the specific `HandlerEntry` (a record, for structural equality) and `remove` that.
- **Non-idempotent unsubscribe** → a second call throws or double-removes. Guard with a `volatile boolean cancelled`.
- **Matching on the hierarchy by accident** (e.g. `isAssignableFrom`) when the spec says exact type — or vice versa. State which one you chose and why.
- **A single global `synchronized`** around subscribe/publish/unsubscribe → correct but serialises all publishers; you've thrown away the concurrency the structures give you for free.
- **Senior signal**: justifies COWAL from the read-heavy access pattern rather than reaching for it by rote; names the sync-vs-async and exact-vs-hierarchy trade-offs unprompted; returns an idempotent token instead of forcing callers to retain the original handler; and writes the concurrent stress test *first*, knowing it is what actually drives the design.


## Task Scheduler — DelayQueue · Worker Thread

### Summary

**What this topic covers**
This kata builds a one-shot delay scheduler from scratch: a `TaskScheduler` that accepts `Runnable` tasks with a delay and fires each one on a single background worker thread when it comes due. You implement `start()`, `schedule(Runnable, long, TimeUnit)` (returning a `ScheduledTask` cancel handle), and `close()` (via `AutoCloseable`), plus the inner `ScheduledTask` that implements `Delayed`. The whole point is to reach for the *primitive* — `java.util.concurrent.DelayQueue` — rather than the batteries-included `ScheduledThreadPoolExecutor`, and to understand exactly why that primitive gives you zero-CPU waiting, due-time ordering, and preemption of the current wait for free. It is a concurrency-and-time kata: the hard parts are blocking correctly, ordering by due time without a busy loop, cancelling before execution, and shutting the worker down cleanly.

**Mental model**
Think of `DelayQueue` as a min-heap of `Delayed` elements where the head is only *takeable* once its `getDelay(...)` returns ≤ 0. The worker thread does nothing but loop `queue.take()`. `take()` parks the thread — the OS wakes it at exactly the head's due time, no polling, no `Thread.sleep` loop. Each `ScheduledTask` stores an absolute `dueNanos = System.nanoTime() + toNanos(delay)`; `getDelay` returns `dueNanos - nanoTime()`, and `compareTo` orders by `dueNanos` so the soonest task sits at the head. When you `schedule` a task with a *sooner* due time than what the worker is currently waiting on, the queue unparks the worker so it re-examines the new head — preemption falls out of the data structure. Shutdown is the idiomatic "interrupt a thread that owns a blocking queue" pattern: `close()` flips `running = false` and interrupts the worker; `take()` throws `InterruptedException`, the loop restores the interrupt flag and exits.

**Key terms**
- **`DelayQueue<E extends Delayed>`** — unbounded blocking priority queue; `take()` blocks until the head's delay expires.
- **`Delayed`** — interface with `getDelay(TimeUnit)`; extends `Comparable<Delayed>`, so you also implement `compareTo`.
- **`getDelay(unit)`** — remaining time until due, computed as `dueNanos - System.nanoTime()` converted to `unit`.
- **`dueNanos`** — absolute due time as a `System.nanoTime()` value (monotonic), *not* `currentTimeMillis`.
- **`compareTo`** — total order by `dueNanos` using `Long.compare` to avoid `int` subtraction overflow.
- **worker loop** — single thread running `while (running) { take(); if (!cancelled) run(); }`.
- **`ScheduledTask` handle** — returned by `schedule`; carries an `AtomicBoolean cancelled` for pre-run cancellation.
- **cancellation** — `cancel()` sets the flag; worker checks `isCancelled()` after `take()` and skips (task evaporates).
- **error isolation** — the action runs in a `try/catch`; a throwing task must not kill the worker.
- **`AutoCloseable.close()`** — interrupts the worker, `join(1000)`, sets `running = false`, blocks further scheduling.
- **`ScheduledThreadPoolExecutor` (STPE)** — the production equivalent, backed by a `DelayedWorkQueue` with the same semantics.

**Why interviewers ask this**
It separates people who reach for `Thread.sleep` in a loop from people who know the JDK's concurrency toolkit. A junior busy-waits or polls, uses `currentTimeMillis` for delay math, and lets a throwing task kill the thread. A senior names `DelayQueue`, explains that `take()` parks with zero CPU and that a newly-added sooner task unparks the waiter, insists on monotonic `nanoTime`, uses `Long.compare` in `compareTo` to dodge overflow, and knows the interrupt-plus-join shutdown handshake for a thread that owns a blocking queue. Bonus signal: articulating what STPE adds on top (thread pool, `scheduleAtFixedRate` vs `scheduleWithFixedDelay`) and that this scheduler is deliberately one-shot.

**Common confusions**
- **"I'll sleep until the next task's delay."** No — `DelayQueue.take()` already does this and correctly handles a sooner task arriving mid-wait. A sleep loop can't be woken early.
- **"Order by submission time."** Order is by *due* time via `compareTo`; submission order is irrelevant.
- **"`(int)(this.dueNanos - that.dueNanos)` for compareTo."** Overflows past `Integer.MAX_VALUE`. Use `Long.compare`.
- **"Mix `nanoTime` and `currentTimeMillis`."** `dueNanos` is a `nanoTime` value; comparing it to wall-clock millis corrupts the delay and breaks under clock adjustments.
- **"Cancel interrupts a running task."** This is pre-run cancellation only — a flag checked after `take()`. An already-executing task is not stopped.
- **"A throwing task should propagate."** It must be swallowed so the worker keeps draining.

**What follows from this topic**
Once the one-shot primitive clicks, recurring scheduling is a reschedule-at-end trick, and the natural next step is `ScheduledThreadPoolExecutor` and the fixed-rate vs fixed-delay distinction (primer Q174). The `Delayed`/`DelayQueue` pairing also underpins [[cache]] TTL expiry, [[retry]] backoff timers, and delayed retries in a [[ratelimit]] or [[circuitbreaker]]. The blocking-queue-owned-by-a-worker pattern generalises to [[blockingqueue]] and any producer-consumer design (primer Q255).

### Clarify & design the API

Questions to settle before writing logic: one-shot or recurring? (One-shot; recurring is a reschedule.) Single worker or a pool? (Single — tasks are picked up sequentially; hand off to a pool inside the loop only if actions are long-running.) Is cancellation pre-run only, or must it interrupt a running task? (Pre-run only.) What's the lifecycle contract — can you `schedule` before `start()` or after `close()`? (No, both throw.) What time source — wall clock or monotonic? (Monotonic `nanoTime`.)

Commit to this surface, then stop designing and start testing:

```java
public class TaskScheduler implements AutoCloseable {
    public void start();                                            // IllegalStateException if already started
    public ScheduledTask schedule(Runnable action, long delay, TimeUnit unit);
    public void close();                                            // AutoCloseable — idempotent

    static final class ScheduledTask implements Delayed {
        public void cancel();                                       // idempotent, pre-run
        public boolean isCancelled();
        public long getDelay(TimeUnit unit);                        // dueNanos - nanoTime()
        public int compareTo(Delayed other);                        // order by dueNanos
    }
}
```

### Write the tests

This is the heart of the kata. Because `DelayQueue` runs on real `System.nanoTime()`, there is no injectable clock seam — you test with small wall-clock delays (tens of ms) and assert via `CountDownLatch`/`AtomicBoolean` with generous timeouts, so CI jitter never flakes the test. Start the scheduler in `@BeforeEach` and `close()` it in `@AfterEach`.

**Basic contract — it runs, and it runs on time.** A latch gives a thread-safe "did it run?" signal with a bounded wait:

```java
private TaskScheduler scheduler;

@BeforeEach void setUp()    { scheduler = new TaskScheduler(); scheduler.start(); }
@AfterEach  void tearDown() { scheduler.close(); }

@Test
void scheduled_task_runs_after_delay() throws Exception {
    var latch = new CountDownLatch(1);
    scheduler.schedule(latch::countDown, 30, TimeUnit.MILLISECONDS);
    assertTrue(latch.await(2, TimeUnit.SECONDS), "task must run within 2s");
}

@Test
void zero_delay_task_runs_immediately() throws Exception {
    var latch = new CountDownLatch(1);
    scheduler.schedule(latch::countDown, 0, TimeUnit.MILLISECONDS);
    assertTrue(latch.await(2, TimeUnit.SECONDS));
}
```

**Core behaviour — due-time ordering.** This is the test that proves you used a priority queue and not a FIFO. Submit out of order and assert execution order matches *due* time. Use a `CopyOnWriteArrayList` because the worker thread writes to it:

```java
@Test
void tasks_run_in_due_time_order() throws Exception {
    var order = new CopyOnWriteArrayList<String>();
    var done  = new CountDownLatch(3);
    scheduler.schedule(() -> { order.add("C"); done.countDown(); }, 90, TimeUnit.MILLISECONDS);
    scheduler.schedule(() -> { order.add("A"); done.countDown(); }, 10, TimeUnit.MILLISECONDS);
    scheduler.schedule(() -> { order.add("B"); done.countDown(); }, 50, TimeUnit.MILLISECONDS);
    assertTrue(done.await(3, TimeUnit.SECONDS));
    assertEquals(List.of("A", "B", "C"), order, "due-time order, not submission order");
}
```

**Cancellation — pre-run skips, post-run is a no-op, idempotent:**

```java
@Test
void cancel_before_due_prevents_execution() throws Exception {
    var ran = new AtomicBoolean(false);
    var task = scheduler.schedule(() -> ran.set(true), 200, TimeUnit.MILLISECONDS);
    task.cancel();
    Thread.sleep(300);
    assertFalse(ran.get(), "cancelled task must not execute");
}

@Test
void cancel_is_idempotent_and_safe_after_execution() throws Exception {
    var latch = new CountDownLatch(1);
    var task = scheduler.schedule(latch::countDown, 20, TimeUnit.MILLISECONDS);
    assertTrue(latch.await(2, TimeUnit.SECONDS));
    assertDoesNotThrow(task::cancel);   // post-run cancel is a harmless no-op
    assertDoesNotThrow(task::cancel);   // idempotent
}
```

**Error isolation — a throwing task must not kill the worker.** Schedule a bomb, then a follow-up, and assert the follow-up still fires:

```java
@Test
void throwing_task_does_not_kill_the_scheduler() throws Exception {
    var latch = new CountDownLatch(1);
    scheduler.schedule(() -> { throw new RuntimeException("bad task"); }, 10, TimeUnit.MILLISECONDS);
    scheduler.schedule(latch::countDown, 50, TimeUnit.MILLISECONDS);
    assertTrue(latch.await(2, TimeUnit.SECONDS), "worker must survive and run later tasks");
}
```

**Lifecycle & argument validation — `assertThrows` pins the contract:**

```java
@Test void schedule_before_start_throws() {
    var s = new TaskScheduler();
    assertThrows(IllegalStateException.class, () -> s.schedule(() -> {}, 10, TimeUnit.MILLISECONDS));
}
@Test void start_twice_throws()  { assertThrows(IllegalStateException.class, scheduler::start); }
@Test void close_is_idempotent() { scheduler.close(); assertDoesNotThrow(scheduler::close); }
```

**Concurrency stress — many tasks all complete under one worker.** This flushes out lost-wakeup or ordering bugs that a single-task test hides; every task must run, none dropped:

```java
@Test
void many_tasks_all_execute() throws Exception {
    int n = 50;
    var latch = new CountDownLatch(n);
    for (int i = 0; i < n; i++)
        scheduler.schedule(latch::countDown, (i % 10 + 1) * 5, TimeUnit.MILLISECONDS);
    assertTrue(latch.await(5, TimeUnit.SECONDS), "all " + n + " tasks must complete");
}
```

### Implement it

Store each task's absolute due time and let `DelayQueue` do the heavy lifting.

`ScheduledTask` — the `Delayed` element. `getDelay` uses `nanoTime` (monotonic; immune to clock changes); `compareTo` uses `Long.compare` to avoid overflow:

```java
static final class ScheduledTask implements Delayed {
    final Runnable action;
    final long dueNanos;                               // System.nanoTime() value when due
    final AtomicBoolean cancelled = new AtomicBoolean(false);

    void cancel()            { cancelled.set(true); }  // idempotent
    boolean isCancelled()    { return cancelled.get(); }

    public long getDelay(TimeUnit unit) {
        return unit.convert(dueNanos - System.nanoTime(), TimeUnit.NANOSECONDS);
    }
    public int compareTo(Delayed o) {
        return Long.compare(dueNanos, ((ScheduledTask) o).dueNanos);
    }
}
```

`schedule` computes `dueNanos` and `put`s (never blocks on an unbounded queue). The worker loop is the whole design:

```java
private final DelayQueue<ScheduledTask> queue = new DelayQueue<>();
private volatile boolean running = false;
private Thread worker;

public ScheduledTask schedule(Runnable action, long delay, TimeUnit unit) {
    if (!running)       throw new IllegalStateException("scheduler not running");
    if (action == null) throw new IllegalArgumentException("action");
    if (delay < 0)      throw new IllegalArgumentException("delay negative");
    if (unit == null)   throw new IllegalArgumentException("unit");
    var task = new ScheduledTask(action, System.nanoTime() + unit.toNanos(delay));
    queue.put(task);
    return task;
}

private void workerLoop() {
    while (running) {
        try {
            ScheduledTask task = queue.take();          // parks until head is due — zero CPU
            if (task.isCancelled()) continue;           // evaporates, never re-queued
            try { task.action.run(); }
            catch (Exception ex) { /* isolate: one bad task must not kill the worker */ }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();          // restore flag, exit on close()
            break;
        }
    }
}

public synchronized void close() {
    if (!running) return;
    running = false;
    if (worker != null) {
        worker.interrupt();                              // unblock take()
        try { worker.join(1_000); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
        worker = null;
    }
}
```

Complexity: `schedule` and `take` are O(log n) heap operations; the wait itself is O(0) CPU — the thread is parked, not spinning. The key gotcha is that *nothing polls*: correctness depends entirely on `getDelay`/`compareTo` being consistent so the head is always the soonest task.

### Common mistakes & senior signal

- **Busy-waiting / sleep loop instead of `take()`.** The reference's whole "real challenge" is that `take()` parks with zero CPU and gets unparked early when a sooner task arrives. A sleep loop can't be woken to re-examine a new head.
- **Wall-clock for delay math.** Mixing `currentTimeMillis` into `dueNanos`/`getDelay` corrupts timing and breaks under NTP/clock adjustments. Seniors use monotonic `nanoTime` end to end.
- **`int` subtraction in `compareTo`.** `(int)(a - b)` overflows past `Integer.MAX_VALUE` and mis-orders the heap. `Long.compare` is the fix.
- **Letting a throwing task kill the worker.** Without the inner `try/catch`, one bad `Runnable` silently stops the scheduler forever. Isolate and (in production) log or dead-letter.
- **Botched shutdown.** Forgetting to interrupt leaves the worker blocked in `take()` forever; forgetting to restore the interrupt flag or to `join` with a timeout risks a hung `close()`. The idiom is interrupt → catch `InterruptedException` → restore flag → break → `join(timeout)`.
- **Checking cancellation before `take()` instead of after.** A task can be cancelled while the worker is parked; the skip check must happen *after* `take()` returns.
- **Senior signal:** names the STPE production equivalent and what it adds (pool, fixed-rate vs fixed-delay), keeps the scheduler deliberately one-shot, tests with latches and generous timeouts rather than brittle `sleep`-and-assert, and can explain why preemption of the current wait is a property of the queue, not code they wrote.


## Bank Account Service — Deadlock-Free Transfer

### Summary

**What this topic covers**
Build a thread-safe in-memory bank: accounts that support `open`, `find`, `deposit`, `withdraw`, and `transfer`, then harden it so hundreds of concurrent threads can hammer it without losing a penny, overdrafting, or deadlocking. You implement two twins behind one `AccountService` interface — a single-threaded `InMemoryAccountService` that pins the business rules, and a `ConcurrentAccountService` that adds the locking. The crux is `transfer`: it touches two accounts, so it needs two locks, and two threads doing `A→B` and `B→A` at the same time are the textbook recipe for deadlock. The whole kata lives or dies on how you acquire those two locks.

**Mental model**
Deadlock needs a *cycle* in the lock-acquisition graph: T1 holds `lock(A)` and wants `lock(B)`; T2 holds `lock(B)` and wants `lock(A)`. Neither yields — frozen forever. Kill the cycle by imposing a **global total order** on locks and always acquiring in that order. Every account has a `UUID`; `UUID.compareTo` is a total order over all ids. So a transfer always locks `min(from, to)` first, `max(from, to)` second — regardless of direction. Now `A→B` and `B→A` both reach for the *same* lock first; one wins, the other waits, no cycle can form. Each account gets its own `ReentrantLock` (fine-grained — deposits to unrelated accounts never contend), created lazily via `ConcurrentHashMap.computeIfAbsent` so a first-touch race yields one shared lock, not two. Money is `BigDecimal`, never `double`. Accounts are immutable records; a mutation produces a new `Account` and swaps the map reference under the lock.

**Key terms**
- **Lock ordering (monotonic)** — acquire multiple locks in a globally consistent order to prevent deadlock cycles.
- **ReentrantLock** — explicit lock; supports `tryLock`, timeouts, and holding two at once in a controlled order.
- **Per-account (fine-grained) locking** — one lock per account, not one global lock; unrelated accounts proceed in parallel.
- **ConcurrentHashMap.computeIfAbsent** — atomic get-or-create; guarantees exactly one lock per id under races.
- **Critical section** — the read-modify-write between `lock()` and `unlock()`; must be atomic per account.
- **BigDecimal** — arbitrary-precision decimal for money; `0.1 + 0.2 == 0.3` exactly, unlike `double`.
- **signum()** — sign check on `BigDecimal` (`< 0`, `== 0`, `> 0`) for overdraft/positivity guards.
- **Immutable record** — `Account(id, balance)`; safe to publish across threads without defensive copies.
- **Lost update** — two unsynchronised read-modify-writes clobbering each other; the bug fine-grained locks prevent.
- **Livelock** — the failure mode of `tryLock`-and-retry: threads back off in lockstep and make no progress.

**Why interviewers ask this**
It is the single most-asked concurrency pattern in fintech interviews. A junior reaches for `synchronized` on the whole method (correct but serialises everything) or locks `from` then `to` in call order (deadlocks under load). A senior names the deadlock precondition, imposes a total lock order to break it, chooses fine-grained per-account locks for throughput, uses `computeIfAbsent` to dodge the lock-creation race, and reaches for `BigDecimal` without prompting. The tell is whether you can *prove* deadlock-freedom (no cycle possible) rather than "it seemed to work." Bonus signal: naming the alternatives — `tryLock` with timeout, a single global lock, STM, or a single-writer command queue — and their tradeoffs.

**Common confusions**
- "`ConcurrentHashMap` makes it thread-safe" → it makes each *map operation* atomic, not your read-modify-write across two calls. You still need the lock.
- "Lock `from` then `to`" → deadlocks; the order must be independent of direction.
- "`synchronized(this)`" → one global lock, zero parallelism; misses the point of the kata.
- "Insufficient funds should throw" → no. Overdraft is an expected outcome; `withdraw` returns `Optional.empty()`, `transfer` returns `false`. Reserve exceptions for programmer errors (non-positive amounts).
- "`double` is fine for a demo" → it silently drifts pennies and fails the equality asserts.
- "Reentrant means I can skip unlock" → you must always `unlock()` in `finally`, or an exception permanently freezes the account.

**What follows from this topic**
The lock-ordering trick generalises to any multi-resource transaction — database row locks acquired in primary-key order, the dining philosophers picking up forks by index, distributed two-phase locking. From here, study `tryLock`-with-timeout for deadlock *detection* instead of prevention, lock-free approaches with `AtomicReference`/CAS for the single-account operations, and the single-writer-queue actor model (à la LMAX Disruptor) that sidesteps locks entirely by serialising all mutations through one thread. Related drilly cards: Q39 (synchronized block vs method), Q40 (deadlock), Q130 (BigDecimal for money).

### Clarify & design the API

Ask the questions that pin the spec before writing a line of logic:

- Is insufficient funds an exception or a value? (Value — `Optional.empty()` / `false`. Exceptions are for non-positive amounts only.)
- Can opening balance be zero? (Yes; only *negative* is rejected.)
- Is `transfer(x, x)` legal? (No — returns `false`, moves nothing.)
- What's the concurrency bar? ("No lost updates, no negative balances, no deadlocks under high contention" — that's the stress test.)
- Money type? (`BigDecimal`, always.)

Commit to one interface so the single-threaded and concurrent impls are swappable:

```java
public interface AccountService {
    Account open(BigDecimal openingBalance);
    Optional<Account> find(UUID accountId);
    Optional<Account> deposit(UUID accountId, BigDecimal amount);
    Optional<Account> withdraw(UUID accountId, BigDecimal amount); // empty = missing OR insufficient
    boolean transfer(UUID from, UUID to, BigDecimal amount);       // false = missing/insufficient/same
}

public record Account(UUID id, BigDecimal balance) {
    public Account { /* reject null id/balance and negative balance */ }
    public Account withBalance(BigDecimal b) { return new Account(id, b); }
}
```

### Write the tests

Write these **first** — they are the spec. Build the single-threaded contract, then the concurrency invariants. Group them: basic behaviour → boundaries + argument validation → the stress tests that only a correctly-synchronised impl survives.

**Basic contract + edge/validation** (drive `InMemoryAccountService` first — pure logic, no threads):

```java
@Test void deposit_increases_balance() {
    var acc = service.open(new BigDecimal("100"));
    var updated = service.deposit(acc.id(), new BigDecimal("50")).orElseThrow();
    assertEquals(new BigDecimal("150"), updated.balance());
}

@Test void withdraw_rejects_overdraft() {            // Optional, not exception
    var acc = service.open(new BigDecimal("100"));
    assertFalse(service.withdraw(acc.id(), new BigDecimal("200")).isPresent());
    assertEquals(new BigDecimal("100"), service.find(acc.id()).orElseThrow().balance());
}

@Test void transfer_moves_money_atomically() {
    var alice = service.open(new BigDecimal("100"));
    var bob   = service.open(new BigDecimal("50"));
    assertTrue(service.transfer(alice.id(), bob.id(), new BigDecimal("30")));
    assertEquals(new BigDecimal("70"), service.find(alice.id()).orElseThrow().balance());
    assertEquals(new BigDecimal("80"), service.find(bob.id()).orElseThrow().balance());
}

@Test void transfer_rejects_insufficient_funds() {   // both balances unchanged
    var alice = service.open(new BigDecimal("10"));
    var bob   = service.open(new BigDecimal("50"));
    assertFalse(service.transfer(alice.id(), bob.id(), new BigDecimal("100")));
    assertEquals(new BigDecimal("10"), service.find(alice.id()).orElseThrow().balance());
}

@Test void transfer_rejects_same_account() {
    var acc = service.open(new BigDecimal("100"));
    assertFalse(service.transfer(acc.id(), acc.id(), new BigDecimal("10")));
}

@Test void negative_amounts_throw() {
    var acc = service.open(new BigDecimal("100"));
    assertThrows(IllegalArgumentException.class,
        () -> service.deposit(acc.id(), new BigDecimal("-1")));
}
```

**Stress tests** — these are the point of the kata. Each uses a `CountDownLatch` gate so every thread starts simultaneously (maximising contention), a virtual-thread executor, and a second latch with a timeout. The `await` timeout *is* the deadlock detector: if lock ordering is wrong, the transfer test never finishes and the assert fails.

```java
@Test void concurrent_deposits_preserve_total() throws Exception {   // no lost updates
    var service = new ConcurrentAccountService();
    var acc = service.open(BigDecimal.ZERO);
    int N = 200;
    var gate = new CountDownLatch(1); var done = new CountDownLatch(N);
    try (var exec = Executors.newVirtualThreadPerTaskExecutor()) {
        IntStream.range(0, N).forEach(i -> exec.submit(() -> {
            try { gate.await(); service.deposit(acc.id(), BigDecimal.ONE); }
            catch (InterruptedException e) { Thread.currentThread().interrupt(); }
            finally { done.countDown(); }
        }));
        gate.countDown();
        assertTrue(done.await(5, TimeUnit.SECONDS));
    }
    assertEquals(new BigDecimal(N), service.find(acc.id()).orElseThrow().balance());
}

@Test void concurrent_transfers_never_create_or_destroy_money() throws Exception {
    // THE headline test: A->B and B->A in opposite directions. Wrong lock order => deadlock.
    var service = new ConcurrentAccountService();
    var a = service.open(new BigDecimal("1000"));
    var b = service.open(new BigDecimal("1000"));
    int N = 500;
    var gate = new CountDownLatch(1); var done = new CountDownLatch(N);
    try (var exec = Executors.newVirtualThreadPerTaskExecutor()) {
        for (int i = 0; i < N; i++) {
            boolean aToB = i % 2 == 0;
            exec.submit(() -> {
                try {
                    gate.await();
                    UUID from = aToB ? a.id() : b.id(), to = aToB ? b.id() : a.id();
                    service.transfer(from, to, BigDecimal.ONE);
                } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
                finally { done.countDown(); }
            });
        }
        gate.countDown();
        assertTrue(done.await(10, TimeUnit.SECONDS), "deadlock — transfers never finished");
    }
    BigDecimal total = service.find(a.id()).orElseThrow().balance()
                     .add(service.find(b.id()).orElseThrow().balance());
    assertEquals(new BigDecimal("2000"), total);       // invariant: total is conserved
}

@Test void concurrent_withdraws_never_overdraft() throws Exception {
    // 100 threads withdraw 1 from a balance of 50: exactly 50 succeed, ends at 0, never negative.
    var service = new ConcurrentAccountService();
    var acc = service.open(new BigDecimal("50"));
    int N = 100;
    var gate = new CountDownLatch(1); var done = new CountDownLatch(N);
    var successes = new AtomicInteger();
    try (var exec = Executors.newVirtualThreadPerTaskExecutor()) {
        IntStream.range(0, N).forEach(i -> exec.submit(() -> {
            try { gate.await();
                  service.withdraw(acc.id(), BigDecimal.ONE).ifPresent(x -> successes.incrementAndGet()); }
            catch (InterruptedException e) { Thread.currentThread().interrupt(); }
            finally { done.countDown(); }
        }));
        gate.countDown();
        assertTrue(done.await(5, TimeUnit.SECONDS));
    }
    assertEquals(50, successes.get());
    assertEquals(BigDecimal.ZERO, service.find(acc.id()).orElseThrow().balance());
}
```

Why each stress test earns its place: **deposits** catches lost updates (a naive `get`/`put` loses increments); **transfers** catches deadlock (the timeout fires) *and* money conservation; **withdraws** catches the overdraft race — without the lock, more than 50 threads can each read balance 50 and all decide they can withdraw.

### Implement it

Single-threaded first, then wrap the read-modify-write of each operation in per-account locks. Data structures: a `ConcurrentHashMap<UUID, Account>` of accounts and a `ConcurrentHashMap<UUID, ReentrantLock>` of locks. `computeIfAbsent` gives one lock per id atomically. Every operation is O(1) amortised (hash lookups + constant work under the lock).

```java
private final Map<UUID, Account> accounts = new ConcurrentHashMap<>();
private final Map<UUID, ReentrantLock> locks = new ConcurrentHashMap<>();

private ReentrantLock lockFor(UUID id) {
    return locks.computeIfAbsent(id, k -> new ReentrantLock()); // atomic get-or-create
}

public Optional<Account> withdraw(UUID id, BigDecimal amount) {
    requirePositive(amount);
    ReentrantLock lock = lockFor(id);
    lock.lock();
    try {
        Account a = accounts.get(id);
        if (a == null) return Optional.empty();
        BigDecimal next = a.balance().subtract(amount);
        if (next.signum() < 0) return Optional.empty();   // insufficient -> empty, not throw
        Account updated = a.withBalance(next);
        accounts.put(id, updated);
        return Optional.of(updated);
    } finally { lock.unlock(); }                            // ALWAYS unlock in finally
}

public boolean transfer(UUID from, UUID to, BigDecimal amount) {
    if (from.equals(to)) return false;
    requirePositive(amount);
    // Monotonic order: min(from,to) first, max second — same order both directions => no cycle.
    UUID first  = from.compareTo(to) < 0 ? from : to;
    UUID second = first.equals(from) ? to : from;
    ReentrantLock lockFirst = lockFor(first), lockSecond = lockFor(second);
    lockFirst.lock();
    try {
        lockSecond.lock();
        try {
            Account src = accounts.get(from), dst = accounts.get(to);
            if (src == null || dst == null) return false;
            BigDecimal newSrc = src.balance().subtract(amount);
            if (newSrc.signum() < 0) return false;
            accounts.put(from, src.withBalance(newSrc));                       // both writes
            accounts.put(to,   dst.withBalance(dst.balance().add(amount)));    // under both locks
            return true;
        } finally { lockSecond.unlock(); }
    } finally { lockFirst.unlock(); }
}

private static void requirePositive(BigDecimal amount) {
    if (amount == null || amount.signum() <= 0)
        throw new IllegalArgumentException("amount must be positive");
}
```

The key gotcha: the lock protects the **reference swap**, not the object. `Account` is immutable, so mutation = build a new record + `put` it back while holding the lock. `find` reads unlocked — a `ConcurrentHashMap.get` on an immutable value is a coherent (if possibly stale) snapshot, which is the right tradeoff for a query. Complexity: every operation O(1); `transfer` holds two locks for a constant-time critical section.

### Common mistakes & senior signal

- **Locking in call order (`from` then `to`).** The classic deadlock. Fix: total order via `UUID.compareTo`. Any deterministic total order works (`System.identityHashCode` with a tiebreaker is a common alternative).
- **One global lock / `synchronized` method.** Correct but serialises the whole bank. Per-account `ReentrantLock`s let unrelated accounts run in parallel — the throughput point of the kata.
- **Creating locks with `get`/`put` instead of `computeIfAbsent`.** Two threads first-touching the same id each build a lock and silently lose mutual exclusion. `computeIfAbsent` is atomic on `ConcurrentHashMap`.
- **Forgetting `finally`.** An exception in the critical section leaves the lock held forever; the account becomes permanently unusable.
- **`double` for money.** Fails the `BigDecimal` equality asserts and leaks pennies in production. Use `signum()` for sign checks, `HALF_EVEN` for any rounding.
- **Throwing on insufficient funds.** It's an expected domain outcome — `Optional.empty()` / `false`. Reserve exceptions for non-positive amounts.
- **Senior tells:** proves deadlock-freedom by arguing no cycle can form (not "it passed once"); names the alternatives (`tryLock`+timeout with livelock risk, STM, single-writer command queue) and their tradeoffs; drives it all with a gated, timeout-bounded stress test where the timeout *is* the deadlock detector; keeps the concurrency concern behind the same interface as the single-threaded twin so business logic and locking are reviewed separately.


## Cinema Seat Booking — Holds, Confirm & TTL Expiry

### Summary

**What this topic covers**
You build `ConcurrentSeatBookingService`: a two-phase seat reservation system that is safe under heavy concurrent load, where no two users can ever hold or book the same seat. Selection and payment are separated by an arbitrary delay, so a `hold` temporarily locks a set of seats for a TTL window, and a `confirm` promotes that hold to a permanent `Booking` once payment succeeds. Abandoned holds expire automatically. You design the internal state layout, the locking strategy, and the secondary indexes; the domain records (`Seat`, `Hold`, `Booking`, `Screening`) and the `SeatBookingService` interface are given. The three public methods are `hold`, `confirm`, and `release`.

**Mental model**
This is two-phase commit with a TTL escape hatch. Booking real seats is not atomic from the user's view — they pick, then pay — so you split it: phase one takes seats off the market briefly, phase two makes them permanent, and abandonment is handled by expiry rather than a callback. The concurrency crux is a TOCTOU race: the "is any seat taken?" check and the "mark these seats held" write must live in the *same* critical section, or two threads both pass the check and both reserve. You partition state and locks *per screening* — two users on different screenings must never contend — using `ConcurrentHashMap.computeIfAbsent` to create each screening's state atomically on first touch, and one `ReentrantLock` per screening to serialise same-screening writers. Time is injected: every time-sensitive method takes an `Instant now` parameter instead of reading the system clock, which makes TTL expiry testable at exact boundaries with zero `Thread.sleep`.

**Key terms**
- **Hold** — phase-one temporary reservation of a seat set with an absolute `expiresAt` instant.
- **Booking** — phase-two durable, paid reservation; no expiry, seats are the customer's.
- **TTL** — time-to-live window; `now >= expiresAt` means expired (boundary counts as expired).
- **TOCTOU** — time-of-check-to-time-of-use race; the gap between conflict check and reserve.
- **Check-and-act atomicity** — the invariant this kata is really testing: check + reserve under one lock.
- **Per-screening lock** — `ReentrantLock` keyed by `screeningId`; the contention boundary is one hall's seat map.
- **`computeIfAbsent`** — atomic first-touch creation of a screening's state on the top-level `ConcurrentHashMap`.
- **Secondary index** — `holdId → screeningId` map for O(1) routing in `confirm`/`release`; must be maintained in lockstep with the primary.
- **Idempotent confirm** — retrying the same `holdId` returns the identical `Booking`, never double-charging.
- **Lazy sweep** — expired holds are cleared on each `hold` call before the conflict check, not by a background thread.
- **Injected clock** — caller-supplied `now`, the enabler for deterministic expiry tests.

**Why interviewers ask this**
It is a compact test of whether you can reason about concurrent invariants, not just recite `synchronized`. A junior reaches for one global lock (correct but kills throughput) or, worse, checks then acts across a lock gap (fast and broken — double-books under load). A senior partitions locks by screening, keeps the check-and-act inside one critical section, recognises `confirm` must be idempotent because mobile clients retry flaky RPCs, and reaches for an injected clock so expiry is testable. The tell is whether you *write the stress test* that would actually expose a race — 100 threads racing one seat, exactly one winner — rather than asserting single-threaded happy paths and hoping.

**Common confusions**
- "Partial hold is fine" → no; `hold` is all-or-nothing. If any requested seat is taken, fail the whole set — partial reservation surprises callers and complicates rollback.
- "Use one lock for everything" → correct but needlessly serialises unrelated screenings; partition by `screeningId`.
- "Make maps concurrent and you're done" → `ConcurrentHashMap` gives per-op atomicity, not multi-op atomicity; check-then-put still races without the lock.
- "Expired holds need a background reaper" → lazy sweep on the `hold` path is simpler and sufficient; no scheduler, no janitor thread stealing the lock.
- "Confirm can just create a booking" → without an idempotency check a retried confirm double-charges; look up `bookings.get(holdId)` first.
- "`now.isAfter(expiresAt)` is the expiry test" → use `!now.isBefore(expiresAt)` so the boundary instant counts as expired.

**What follows from this topic**
The check-and-act-under-one-lock pattern generalises to any reserve/commit flow: inventory reservations, distributed locks, optimistic-vs-pessimistic locking. The secondary-index-in-lockstep idea is the same discipline a database enforces between a table and its index. Related katas: any bounded-resource concurrency problem (parking lot, connection pool), rate limiters (TTL windows again), and lock-free counters (where you'd swap the `ReentrantLock` for CAS).

### Clarify & design the API

Questions to pin down before writing logic: Is a hold all-or-nothing, or can it partially reserve? (All-or-nothing.) Is `confirm` idempotent under retries? (Yes — that's the whole point.) Does the boundary instant count as expired? (Yes, `now >= expiresAt`.) Who owns the clock — the service or the caller? (Caller supplies `now`, for testability.) Do different screenings contend? (No — partition locks per screening.)

The interface is given; commit to these signatures and don't drift:

```java
public interface SeatBookingService {
    // all-or-nothing; empty if any seat is held (unexpired) or booked
    Optional<Hold>    hold(UUID screeningId, Set<Seat> seats, Duration ttl, Instant now);
    // idempotent on holdId; empty if unknown or expired
    Optional<Booking> confirm(UUID holdId, String customer, Instant now);
    boolean           release(UUID holdId); // true if a live hold was freed
}
```

`now` is a parameter, not `Instant.now()` inside — production passes the real clock, tests pin exact instants.

### Write the tests

Write these first — they pin the spec. Group them: basic contract → core behaviour → expiry boundary (fake clock) → the concurrency stress tests that a broken impl fails. The stress tests are the reason this kata exists; a single-threaded suite proves nothing about the race.

**Basic contract + core behaviour.** Hold then confirm yields a booking over the same seats; a second hold on a held seat fails; confirm is idempotent.

```java
private final SeatBookingService service = new ConcurrentSeatBookingService();
private final UUID screening = UUID.randomUUID();

@Test
void hold_then_confirm_creates_booking() {
    var seats = Set.of(new Seat(1, 1), new Seat(1, 2));
    var now = Instant.now();
    var hold = service.hold(screening, seats, Duration.ofMinutes(5), now).orElseThrow();
    var booking = service.confirm(hold.id(), "alice", now).orElseThrow();
    assertEquals(seats, booking.seats());
}

@Test
void second_hold_on_same_seat_fails() {
    var now = Instant.now();
    service.hold(screening, Set.of(new Seat(1, 1)), Duration.ofMinutes(5), now);
    var second = service.hold(screening, Set.of(new Seat(1, 1)), Duration.ofMinutes(5), now);
    assertFalse(second.isPresent());
}

@Test
void confirm_is_idempotent() {
    var now = Instant.now();
    var hold = service.hold(screening, Set.of(new Seat(1, 1)), Duration.ofMinutes(5), now).orElseThrow();
    var first  = service.confirm(hold.id(), "alice", now).orElseThrow();
    var second = service.confirm(hold.id(), "alice", now).orElseThrow();
    assertEquals(first.id(), second.id()); // same booking, no double-charge
}
```

**Expiry boundary — the fake clock.** Don't `Thread.sleep`. Because `now` is injected, you simulate the passage of time by passing a *later* `Instant`. Hold with a 1ms TTL at `now`, then hold the same seat again at `now.plus(1s)` — the first has expired and the second must succeed. This is the entire value of the caller-supplied clock: deterministic, instant, no flakiness.

```java
@Test
void expired_hold_releases_seat() {
    var now = Instant.now();
    service.hold(screening, Set.of(new Seat(1, 1)), Duration.ofMillis(1), now);
    var afterExpiry = now.plus(Duration.ofSeconds(1)); // advance the fake clock
    var second = service.hold(screening, Set.of(new Seat(1, 1)), Duration.ofMinutes(5), afterExpiry);
    assertTrue(second.isPresent());
}
```

**Stress test — the race exposer.** This is what fails an unsynchronised implementation. Fire N threads at the *same* seat behind a start gate so they collide; exactly one may win. A separate stress test hammers `confirm` on one hold from N threads and asserts every caller observes the *same* booking id (idempotency under contention). Use virtual threads and a `CountDownLatch` gate to maximise the real overlap.

```java
@Test
void concurrent_holds_on_same_seat_only_one_wins() throws Exception {
    var seat = new Seat(10, 10);
    var now = Instant.now();
    int N = 100;
    var gate = new CountDownLatch(1);
    var done = new CountDownLatch(N);
    var winners = new AtomicInteger();

    try (var exec = Executors.newVirtualThreadPerTaskExecutor()) {
        IntStream.range(0, N).forEach(i -> exec.submit(() -> {
            try {
                gate.await(); // release all threads at once
                service.hold(screening, Set.of(seat), Duration.ofMinutes(5), now)
                       .ifPresent(h -> winners.incrementAndGet());
            } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
            finally { done.countDown(); }
        }));
        gate.countDown();
        assertTrue(done.await(5, TimeUnit.SECONDS));
    }
    assertEquals(1, winners.get()); // a TOCTOU bug lets 2+ win
}

@Test
void concurrent_confirms_of_same_hold_produce_single_booking() throws Exception {
    var now = Instant.now();
    var hold = service.hold(screening, Set.of(new Seat(5, 5)), Duration.ofMinutes(5), now).orElseThrow();
    int N = 50;
    var gate = new CountDownLatch(1);
    var done = new CountDownLatch(N);
    var seenIds = ConcurrentHashMap.newKeySet();

    try (var exec = Executors.newVirtualThreadPerTaskExecutor()) {
        IntStream.range(0, N).forEach(i -> exec.submit(() -> {
            try {
                gate.await();
                service.confirm(hold.id(), "guest" + i, now).ifPresent(b -> seenIds.add(b.id()));
            } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
            finally { done.countDown(); }
        }));
        gate.countDown();
        assertTrue(done.await(5, TimeUnit.SECONDS));
    }
    assertEquals(1, seenIds.size(), "all confirms must observe the same booking id");
}
```

Also worth a test: `release` frees seats so a subsequent `hold` succeeds; and argument validation — `hold` with a null/empty seat set throws `IllegalArgumentException` (`assertThrows`).

### Implement it

State is partitioned per screening. Each `ScreeningState` holds four maps and its own lock; a cross-screening `holdToScreening` index routes `holdId → screeningId` in O(1).

```java
private record ScreeningState(
        Map<Seat, UUID> held,      // seat -> holdId (authority on "reserved?")
        Map<Seat, UUID> booked,    // seat -> bookingId (authority on "sold?")
        Map<UUID, Hold> holds,     // holdId -> Hold (reverse index for confirm/release/sweep)
        Map<UUID, Booking> bookings, // holdId -> Booking (powers idempotent confirm)
        ReentrantLock lock) {}

private final Map<UUID, ScreeningState> states = new ConcurrentHashMap<>();
private final Map<UUID, UUID> holdToScreening = new ConcurrentHashMap<>();

private ScreeningState stateFor(UUID screeningId) {
    return states.computeIfAbsent(screeningId, k -> new ScreeningState(
            new ConcurrentHashMap<>(), new ConcurrentHashMap<>(),
            new ConcurrentHashMap<>(), new ConcurrentHashMap<>(), new ReentrantLock()));
}
```

`hold` is the check-and-act: take the screening lock, lazily sweep expired holds, scan for any conflict, and only then reserve — all inside the one critical section, so no other thread can slip between the check and the write.

```java
public Optional<Hold> hold(UUID screeningId, Set<Seat> seats, Duration ttl, Instant now) {
    if (seats == null || seats.isEmpty()) throw new IllegalArgumentException("seats required");
    ScreeningState s = stateFor(screeningId);
    s.lock().lock();
    try {
        sweepExpired(s, now);                     // clear stale holds first
        for (Seat seat : seats)                   // all-or-nothing conflict check
            if (s.booked().containsKey(seat) || s.held().containsKey(seat)) return Optional.empty();
        Hold h = new Hold(UUID.randomUUID(), screeningId, seats, now.plus(ttl));
        for (Seat seat : seats) s.held().put(seat, h.id());
        s.holds().put(h.id(), h);
        holdToScreening.put(h.id(), screeningId); // secondary index, same critical section
        return Optional.of(h);
    } finally { s.lock().unlock(); }
}
```

`confirm` checks `bookings.get(holdId)` first (idempotency), rejects expired holds, then promotes: record the booking, drop the hold, flip each seat from `held` to `booked` — all under the lock so no thread sees a half-promoted state. `sweepExpired` is a two-pass (collect ids, then remove) to avoid `ConcurrentModificationException`, and it removes from `holdToScreening` in lockstep.

**Complexity:** `hold` is O(k + e) for k requested seats plus e expired holds swept; `confirm`/`release` are O(1) routing + O(m) over the hold's m seats. **The gotcha:** every mutation of a `ScreeningState` map — including the secondary-index write and the sweep — must happen under that screening's lock; a "concurrent map so I don't need the lock" shortcut reopens the TOCTOU hole because per-op atomicity is not multi-op atomicity.

### Common mistakes & senior signal

- **Check-and-act across a lock gap.** Checking conflicts, releasing the lock, then reserving — the classic TOCTOU double-book. Keep both inside one critical section.
- **`ConcurrentHashMap` mistaken for a lock.** It makes each `put`/`get` atomic, not the check-then-put pair. The kata's whole trap.
- **One global lock.** Correct but serialises unrelated screenings. Partition locks by `screeningId`.
- **Non-idempotent confirm.** Forgetting the `bookings.get(holdId)` short-circuit means a retried RPC double-charges. Seniors treat retry-safety as a requirement, not a nicety.
- **Secondary index drift.** Updating `holds` but not `holdToScreening` (or vice versa) in the same critical section leaves a dangling route. Maintain both in lockstep, like a DB index.
- **Reading the system clock inside the service.** Kills testability. Inject `now`; the fake clock is how you test expiry deterministically.
- **`now.isAfter(expiresAt)` off-by-one.** Use `!now.isBefore(expiresAt)` so the boundary instant expires.
- **Senior tell:** they write the 100-thread stress test *before* claiming correctness, and they know why virtual threads + a start gate produce real overlap rather than a sequential parade.


## Restaurant Booking — Time-Slot Overlap · Per-Table Locking

### Summary

**What this topic covers**
You build a table-reservation service for a restaurant with a fixed set of tables, each with a capacity. Guests book a table for a `TimeSlot`; the service finds the smallest table that fits the party (best-fit), confirms the booking, and supports cancellation and a "bookings on a date" query. There are two implementations behind one `BookingService` interface: a single-threaded `InMemoryBookingService` and a thread-safe `ConcurrentBookingService`. The kata has two hearts — a precise **half-open interval overlap** predicate on `TimeSlot`, and an **atomic check-and-act** on booking that stays correct when 100+ threads hit the same slot at once. You write the tests first: overlap truth-table cases, best-fit and cancellation behaviour, and — the payoff — a race/stress test that demonstrably breaks the unsynchronised version and passes the locked one.

**Mental model**
Two independent ideas. First, overlap: model a slot as the half-open interval `[start, start+duration)`. Two intervals intersect iff `a.start < b.end && b.start < a.end` — strict inequalities, so slots that merely *touch* (one ends exactly when the next begins) do **not** overlap. Get the inequality direction and strictness right and every seating decision follows. Second, concurrency: booking is a classic check-then-act — read "is this table free for this slot?", then insert. Between those two steps is a race window: two threads both see free, both insert, table double-booked. The fix is to make check-and-insert a single atomic unit *per table*. Use a per-table `ReentrantLock`, not one service-wide lock, so bookings on different tables run in parallel. Each `book` call holds at most one lock at a time, which makes the design deadlock-free by construction.

**Key terms**
- **Half-open interval** — `[start, end)`, includes start, excludes end; makes adjacent slots non-overlapping cleanly.
- **Overlap predicate** — `start.isBefore(other.end()) && other.start.isBefore(end())`; strict `<` on both sides.
- **Best-fit** — pick the smallest table that fits the party; minimises fragmentation so big parties still get seated. Same idea as best-fit memory allocators.
- **Check-then-act** — read-then-write pair (`isFree` → `put`); unsafe unless the pair is atomic.
- **Race window** — the gap between check and act where another thread can interleave.
- **`ReentrantLock`** — explicit lock; here one per table, keyed by table id.
- **Lock granularity** — coarse (one lock, serialises everything) vs fine (per-table, parallel across tables).
- **`ConcurrentHashMap`** — used for the booking store so reads/cancels are lock-free and atomic.
- **`Optional.empty()`** — the "no table available" result; a full restaurant is expected, not exceptional.
- **`CountDownLatch` start-gate** — parks all worker threads, releases them at once to force a real collision.
- **Virtual threads** — `newVirtualThreadPerTaskExecutor()`; cheap enough to spawn hundreds in a stress test.

**Why interviewers ask this**
It bundles two things they want to see separately: careful interval reasoning and real concurrency. A junior writes `book` with an unsynchronised `isFree` then `put` and calls it done — it passes single-threaded tests and ships a double-booking bug. A senior *names* the check-then-act race before writing a line, chooses per-table locking over a global lock and justifies it (parallelism + deadlock-freedom), and — the strongest signal — writes a stress test that actually reproduces the race with a start-gate latch rather than trusting spawn timing. On overlap, the tell is whether they test the touching-boundary case (`19:00–22:00` vs `22:00–…`) and get strict-vs-non-strict inequalities right, instead of hand-waving `<=`.

**Common confusions**
- "Adjacent slots overlap" → no. `[19:00,22:00)` and `[22:00,00:00)` share only the excluded endpoint; strict `<` makes them disjoint.
- "One `synchronized` on the service is fine" → correct but throws away all cross-table parallelism; per-table locks are the point.
- "`ConcurrentHashMap` alone makes booking safe" → no. It makes each *put* atomic, but check-then-act spans two operations; you still need the lock (or `compute()`).
- "Locking multiple tables risks deadlock" → not here: each `book` holds at most one lock at a time.
- "The race test failing sometimes is a flaky test" → it's *intentionally* non-deterministic; it exists to make the bug observable, and may pass occasionally on the broken impl.

**What follows from this topic**
The atomic check-and-act pattern generalises to any "reserve a unique resource" problem — seat maps, inventory holds, distributed locks. The lock-granularity ladder (global `synchronized` → per-key `ReentrantLock` → `ConcurrentHashMap.compute()` → DB optimistic/pessimistic locking) is the same conversation you have in the [[parking]] and [[cache]] katas and in real booking systems. See the Java primer on thread safety (Q38), deadlock (Q40), and atomic check-and-act (Q241).

### Clarify & design the API

Questions to settle before writing logic: Is failure to book an exception or a value? (Value — a full restaurant is expected; return `Optional.empty()`.) Which table when several fit? (Best-fit: smallest that fits.) Do adjacent slots collide? (No — half-open intervals.) Does the concurrent version need cross-table parallelism? (Yes — per-table locking, not one global lock.)

Commit to a small interface plus a couple of value types, then implement to it:

```java
public interface BookingService {
    Optional<Booking> book(int partySize, TimeSlot slot, String customer);
    boolean cancel(UUID bookingId);
    List<Booking> bookingsFor(LocalDate date);
}

public record TimeSlot(LocalDateTime startTime, Duration duration) {
    public boolean overlaps(TimeSlot other) { /* half-open test */ }
}
public record Table(int id, int capacity) { }
public record Booking(UUID id, Table table, TimeSlot slot, int partySize, String customer) { }
```

`TimeSlot` and `Booking` validate in their compact constructor (positive duration, positive party size, party ≤ capacity). Two service implementations share the interface: `InMemoryBookingService` (single-threaded reference) and `ConcurrentBookingService` (thread-safe).

### Write the tests

Write these first — they pin the spec. Four groups: overlap truth-table, core booking behaviour, cancellation/query edges, and the concurrency stress tests.

**Group 1 — overlap predicate (the arithmetic heart).** Cover the truth table explicitly, especially the touching boundary that strict inequalities must reject:

```java
@Test void slots_with_gap_dont_overlap() {
    TimeSlot a = slot("2026-05-10T19:00", 2);   // [19:00, 21:00)
    TimeSlot b = slot("2026-05-10T22:00", 2);   // [22:00, 00:00)
    assertFalse(a.overlaps(b));
}

@Test void slots_that_touch_dont_overlap() {    // the case juniors miss
    TimeSlot a = slot("2026-05-10T19:00", 3);   // [19:00, 22:00)
    TimeSlot b = slot("2026-05-10T22:00", 2);   // [22:00, 00:00)
    assertFalse(a.overlaps(b));                 // shared endpoint is excluded
}

@Test void slots_overlap() {
    assertTrue(slot("2026-05-10T19:00", 4).overlaps(slot("2026-05-10T22:00", 2)));
}

@Test void contained_slot_overlaps_both_ways() {
    TimeSlot outer = slot("2026-05-10T19:00", 4);
    TimeSlot inner = slot("2026-05-10T20:00", 1);
    assertTrue(outer.overlaps(inner));
    assertTrue(inner.overlaps(outer));          // symmetry
}
```

Why: the touching case and the symmetry case are exactly where a `<=` bug or a one-sided predicate shows up.

**Group 2 — core booking behaviour.** Best-fit selection, overlap-driven rejection, fallback to another table, and non-overlapping reuse of the same table:

```java
@Test void rejects_when_no_table_fits_party_size() {
    var svc = new InMemoryBookingService(List.of(new Table(1, 2)));
    assertTrue(svc.book(4, SEVEN_PM, "alice").isEmpty());
}

@Test void best_fit_picks_smallest_sufficient_table() {
    var svc = new InMemoryBookingService(List.of(new Table(1, 8), new Table(2, 4)));
    assertEquals(2, svc.book(2, SEVEN_PM, "alice").orElseThrow().table().id(),
            "should pick the 4-seater, not the 8-seater");
}

@Test void rejects_when_only_fitting_table_is_taken_at_overlapping_time() {
    var svc = new InMemoryBookingService(List.of(new Table(1, 4)));
    svc.book(2, SEVEN_PM, "alice");             // [19:00,21:00)
    assertTrue(svc.book(2, EIGHT_PM, "bob").isEmpty());  // [20:00,22:00) overlaps
}

@Test void picks_alternative_table_when_first_is_busy() {
    var svc = new InMemoryBookingService(List.of(new Table(1, 4), new Table(2, 4)));
    svc.book(2, SEVEN_PM, "alice");
    assertEquals(2, svc.book(2, EIGHT_PM, "bob").orElseThrow().table().id());
}

@Test void same_table_can_be_booked_for_non_overlapping_slots() {
    var svc = new InMemoryBookingService(List.of(new Table(1, 4)));
    svc.book(2, SEVEN_PM, "alice");             // [19:00,21:00)
    assertTrue(svc.book(2, NINE_PM, "bob").isPresent());  // [21:00,23:00) touches, ok
}
```

Why: best-fit is the seating policy, and the overlap-vs-touch pair ties Group 1 back into `book`. `NINE_PM` deliberately starts exactly when `SEVEN_PM` ends — it proves touch ≠ overlap at the service level.

**Group 3 — cancellation & date query.** `cancel` returns a boolean and frees the slot; the date query filters by start date:

```java
@Test void cancel_frees_the_table() {
    var svc = new InMemoryBookingService(List.of(new Table(1, 4)));
    var first = svc.book(2, SEVEN_PM, "alice").orElseThrow();
    assertTrue(svc.cancel(first.id()));
    assertTrue(svc.book(2, SEVEN_PM, "bob").isPresent());  // slot is free again
}

@Test void cancel_returns_false_for_unknown_booking() {
    var svc = new InMemoryBookingService(List.of(new Table(1, 4)));
    assertFalse(svc.cancel(UUID.randomUUID()));
}

@Test void bookings_for_returns_only_that_dates_bookings() {
    var svc = new InMemoryBookingService(List.of(new Table(1, 4), new Table(2, 4)));
    svc.book(2, slot("2026-05-10T19:00", 2), "alice");
    svc.book(2, slot("2026-05-11T19:00", 2), "bob");
    var may10 = svc.bookingsFor(LocalDate.parse("2026-05-10"));
    assertEquals(1, may10.size());
    assertEquals("alice", may10.get(0).customer());
}
```

**Group 4 — the concurrency stress tests (the payoff).** Three distinct tests. First, prove the *unsynchronised* impl is broken — fire hundreds of threads at one table/slot and assert the race manifests as either a double-book or a `ConcurrentModificationException` (HashMap iterated during mutation):

```java
@Test void unsynchronised_service_breaks_under_concurrency() throws Exception {
    var service = new InMemoryBookingService(List.of(new Table(1, 4)));
    var slot = new TimeSlot(LocalDateTime.parse("2026-05-10T19:00"), Duration.ofHours(2));
    int threads = 200;

    try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
        List<Future<Optional<Booking>>> futures = IntStream.range(0, threads)
                .mapToObj(i -> executor.submit(() -> service.book(2, slot, "user" + i)))
                .toList();

        int successes = 0, raceFailures = 0;
        for (var f : futures) {
            try { if (f.get().isPresent()) successes++; }
            catch (ExecutionException e) { raceFailures++; }   // CME etc. = unsafe access
        }
        // > 1 success is a double-book; any exception is unsafe iteration. Either proves the bug.
        assertTrue(successes > 1 || raceFailures > 0,
                "expected race to manifest. successes=" + successes + ", raceFailures=" + raceFailures);
    }
}
```

This test is intentionally non-deterministic and may occasionally pass on the broken impl — that's the point; it makes the race *observable*.

Second, the **collision test** — prove the lock works. 100 threads, one table, one slot, released simultaneously by a `CountDownLatch` start-gate. Exactly one must win:

```java
@Test void only_one_of_many_concurrent_bookings_for_same_slot_succeeds() throws Exception {
    var service = new ConcurrentBookingService(List.of(new Table(1, 4)));
    var slot = new TimeSlot(LocalDateTime.parse("2026-05-10T19:00"), Duration.ofHours(2));
    var startGate = new CountDownLatch(1);            // park all workers, release at once

    try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
        List<Future<Optional<Booking>>> futures = IntStream.range(0, 100)
                .mapToObj(i -> executor.submit(() -> { startGate.await(); return service.book(2, slot, "user" + i); }))
                .toList();
        startGate.countDown();                        // fire — real contention starts here

        long successes = 0;
        for (var f : futures) if (f.get().isPresent()) successes++;
        assertEquals(1, successes, "exactly one thread should win the booking");
    }
}
```

The latch matters: without it threads trickle in ~1ms apart and thread 0 finishes before thread 50 starts — no real race, so a *broken* lock would still pass. The start-gate forces simultaneous release.

Third, the **parallelism test** — prove the locks aren't too coarse. 20 tables, 20 threads, same slot; all 20 must succeed *and* land on distinct tables:

```java
@Test void concurrent_bookings_on_different_tables_all_succeed() throws Exception {
    var tables = IntStream.rangeClosed(1, 20).mapToObj(id -> new Table(id, 4)).toList();
    var service = new ConcurrentBookingService(tables);
    var slot = new TimeSlot(LocalDateTime.parse("2026-05-10T19:00"), Duration.ofHours(2));

    try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
        List<Future<Optional<Booking>>> futures = IntStream.range(0, 20)
                .mapToObj(i -> executor.submit(() -> service.book(2, slot, "user" + i)))
                .toList();
        var bookedTableIds = new ArrayList<Integer>();
        for (var f : futures) f.get().ifPresent(b -> bookedTableIds.add(b.table().id()));

        assertEquals(20, bookedTableIds.size(), "all 20 attempts should succeed");
        assertEquals(20, Set.copyOf(bookedTableIds).size(), "each table booked by exactly one thread");
    }
}
```

Why two assertions: the size check catches deadlock/starvation; the *distinct*-set check catches a broken per-table lock that lets two threads double-book one table — both return `Optional.of(...)` so the size check alone would still pass, only the set shrinks below 20.

### Implement it

**Overlap** — one line, strict inequalities on the half-open interval:

```java
public boolean overlaps(TimeSlot other) {
    return startTime.isBefore(other.end()) && other.startTime.isBefore(end());
}
LocalDateTime end() { return startTime.plus(duration); }
```

**Single-threaded booking** — filter to fitting tables, sort by capacity (best-fit), take the first free one, insert:

```java
public Optional<Booking> book(int partySize, TimeSlot slot, String customer) {
    return tables.stream()
            .filter(t -> t.capacity() >= partySize)
            .sorted(Comparator.comparingInt(Table::capacity))   // best-fit
            .filter(t -> isFree(t, slot))
            .findFirst()
            .map(t -> {
                Booking b = new Booking(UUID.randomUUID(), t, slot, partySize, customer);
                bookings.put(b.id(), b);
                return b;
            });
}
private boolean isFree(Table table, TimeSlot slot) {
    return bookings.values().stream()
            .filter(b -> b.table().equals(table))
            .noneMatch(b -> b.slot().overlaps(slot));
}
```

Complexity: `book` is O(T log T) to sort candidate tables + O(B) per `isFree` scan; fine for the kata. At 10k+ bookings, replace the flat map with a per-table `NavigableMap<LocalDateTime, Booking>` so overlap becomes two O(log n) `floorEntry`/`ceilingEntry` lookups.

**Concurrent booking** — the gotcha is that `isFree → put` must be atomic *per table*. Give each table its own `ReentrantLock`, iterate candidates in capacity order, and hold exactly one lock across the check-and-insert:

```java
private final Map<UUID, Booking> bookings = new ConcurrentHashMap<>();
private final Map<Integer, ReentrantLock> tableLocks;   // keyed by table id

public Optional<Booking> book(int partySize, TimeSlot slot, String customer) {
    var candidates = tables.stream()
            .filter(t -> t.capacity() >= partySize)
            .sorted(Comparator.comparingInt(Table::capacity))
            .toList();
    for (Table table : candidates) {
        ReentrantLock lock = tableLocks.get(table.id());
        lock.lock();
        try {
            if (isFree(table, slot)) {                  // check
                Booking b = new Booking(UUID.randomUUID(), table, slot, partySize, customer);
                bookings.put(b.id(), b);                // …and act, atomically under this lock
                return Optional.of(b);
            }
        } finally {
            lock.unlock();                              // always release
        }
    }
    return Optional.empty();
}
```

Key points: **one lock at a time** → no deadlock. **Per-table lock** → bookings on different tables never contend (the parallelism test). `cancel` uses `ConcurrentHashMap.remove` and deliberately takes no lock — remove is atomic, and a concurrent `book` missing a just-freed slot is a fail-safe false rejection, retriable by the caller. The next rung on the ladder is `ConcurrentHashMap.compute()` on a per-table index for lock-free atomic check-and-insert; beyond a single process it becomes DB optimistic (version CAS) or pessimistic (`SELECT … FOR UPDATE`) locking.

### Common mistakes & senior signal

- **`<=` in the overlap test.** Treats touching slots as overlapping, so `19:00–21:00` blocks a `21:00–23:00` booking that should succeed. Half-open + strict `<` is the fix. Senior writes the touching-boundary test on purpose.
- **Unsynchronised check-then-act.** `isFree` then `put` with no lock passes every single-threaded test and double-books in production. Naming this race *before* coding is the strongest senior signal on the whole kata.
- **One global lock "to be safe".** Correct but serialises the whole restaurant; the parallelism test (distinct tables, all succeed) fails to complete concurrently. Per-table locks are the intended answer.
- **`ConcurrentHashMap` mistaken for full safety.** It makes each `put`/`remove` atomic, not the check-then-act pair spanning them. Juniors stop at the map; seniors keep the lock around the compound action.
- **A stress test that never races.** Spawning threads in a loop without a start-gate lets thread 0 finish before thread 50 starts — the test passes even on broken locking. Using a `CountDownLatch` to release all workers at once is what makes the collision real.
- **Weak concurrency assertions.** Asserting only "all 20 succeeded" misses a broken lock that double-books one table (both attempts return present). Asserting the booked table ids are *distinct* is what actually catches it.
- **Throwing on a full restaurant.** Exceptions for expected control flow are costly and hide the failure mode from the signature; `Optional.empty()` puts "might not succeed" in the type. Senior reaches for a sealed `BookingResult` only when multiple distinct failure reasons appear.


## Concurrent Parking Lot — Sealed Spots · Best-Fit · Per-Spot Locks

### Summary

**What this topic covers**

A multi-type parking lot: compact, standard, EV-charging, and truck bays, each with its own rule about which vehicles it accepts. You build `park(vehicle, entry)` (allocate the *smallest* spot that fits, issue a timed `Ticket`), `unpark(ticketId, exit)` (compute the `BigDecimal` charge, partial hours rounded up), and `available(type)` (count free compatible spots). The twist that makes this a *senior* kata: the spot hierarchy is a Liskov trap, allocation must be best-fit not first-fit, and all three operations have to stay correct while many threads park and unpark simultaneously — no spot ever double-occupied.

**Mental model**

Two independent design decisions carry the whole exercise. First, **modelling**: the four spot kinds are *sibling* peers, not a class hierarchy. `EVSpot extends StandardSpot` reads naturally but lies — `EVSpot.fits` rejects `CAR` while `StandardSpot.fits` accepts it, strengthening the precondition and breaking substitutability (LSP). A `sealed interface Spot permits CompactSpot, StandardSpot, EVSpot, TruckSpot` captures a closed set of peers, each answering its own `fits` predicate, and the compiler enforces exhaustive `switch`. Second, **concurrency**: allocation is check-then-act (find a free fitting spot, claim it), which is a race unless the claim happens inside a lock. Use one `ReentrantLock` *per spot* and walk best-fit candidates, locking each in turn and re-checking occupancy inside the critical section. A thread holds at most one lock at a time, so there's no deadlock. Losers of a race just move to the next candidate.

**Key terms**

- **sealed interface** — closed type hierarchy; the compiler knows every implementor, enabling exhaustive pattern matching and blocking a rogue fifth spot type.
- **Liskov Substitution Principle (LSP)** — a subtype must be usable wherever the supertype is; narrowing `fits` (rejecting `CAR`) violates it, which is why EV/Standard are siblings not parent/child.
- **best-fit allocation** — assign the smallest `sizeRank` spot that fits, so a motorcycle doesn't consume a truck bay.
- **sizeRank** — total order over spot capacity (compact 1 < standard/EV 2 < truck 3); drives the best-fit sort.
- **check-then-act** — the read (`is this spot free?`) and the write (`occupy it`) must be one atomic step, or two threads both see "free".
- **per-spot `ReentrantLock`** — one lock per bay so parks contend only on the exact spot being fought over, not the whole lot.
- **`ConcurrentHashMap`** — lock-free reads for `occupants` (spotId→Ticket) and `tickets` (ticketId→Ticket); `remove` is the atomic claim on unpark.
- **ceiling-hours integer math** — `(millis + 3_599_999) / 3_600_000` rounds partial hours up without touching `double`.
- **`BigDecimal` + `HALF_EVEN`** — exact money; banker's rounding on the final cents. Never `new BigDecimal(double)`.
- **`Optional` return** — "lot full" and "unknown ticket" are normal outcomes, returned as `Optional.empty()`, not thrown.

**Why interviewers ask this**

It's two of the most-asked senior questions in one kata. A junior reaches for `EVSpot extends StandardSpot`, ships a global `synchronized` lock, and bills with `Math.ceil` on a `double`. A senior *names* the Liskov violation on sight and models siblings; reasons about the check-then-act race and puts the re-check inside the lock; picks per-spot locks and can justify why there's no deadlock (one lock held at a time); and knows that money is `BigDecimal` and ceiling hours are integer arithmetic. The concurrency stress test is the discriminator: an implementation that "looks" thread-safe (a `ConcurrentHashMap` alone, no lock) silently double-occupies under load, and the senior anticipates that before running it.

**Common confusions**

- "`ConcurrentHashMap` makes it thread-safe" → wrong. It makes each *operation* atomic, but `containsKey` then `put` is two operations; the gap is the race. You still need the lock around the pair.
- "EV is a kind of standard spot" → physically similar, contractually narrower; sibling, not subclass.
- "First-fit is simpler and fine" → it fragments capacity, parking small vehicles in large bays. Best-fit is the requirement.
- "Lock the whole lot" → correct but serialises every park; per-spot locks are the point.
- "Round with `Math.ceil((double) millis / 3_600_000)`" → reintroduces the float error `BigDecimal` exists to avoid.

**What follows from this topic**

This sits at the intersection of the SOLID katas (LSP, sealed hierarchies), the pricing/`BigDecimal` money-handling katas, and the concurrency family (bounded blocking queue, rate limiter, LRU cache) where the same check-then-act-under-lock discipline recurs. The per-spot lock pattern generalises to any "pool of exclusive resources" problem — connection pools, seat booking, inventory reservation.

### Clarify & design the API

Questions worth asking before writing a line: *Best-fit or first-fit?* (best-fit — smallest `sizeRank`). *What are the exact fit rules per spot?* (compact: MOTORCYCLE+CAR; standard: CAR+EV; EV: EV only; truck: everything). *Billing granularity and minimum?* (flat hourly, partial hours round up, one-hour minimum). *What happens when the lot is full or the ticket is unknown?* (`Optional.empty()`, not an exception). *How concurrent?* (many threads parking/unparking; no double occupancy).

Commit to the contract first — an interface so a single-threaded and thread-safe variant are swappable:

```java
public interface ParkingLot {
    Optional<Ticket> park(Vehicle vehicle, Instant entry);   // best-fit; empty if full
    Optional<BigDecimal> unpark(UUID ticketId, Instant exit); // charge; empty if unknown
    long available(VehicleType type);
}

public sealed interface Spot permits CompactSpot, StandardSpot, EVSpot, TruckSpot {
    int id();
    boolean fits(Vehicle vehicle);
    int sizeRank();          // compact 1 < standard/EV 2 < truck 3
}

public record Ticket(UUID id, Spot spot, String plate, Instant entry) {}
public record Vehicle(String plate, VehicleType type) { /* compact-ctor validates */ }
public enum VehicleType { MOTORCYCLE, CAR, EV, TRUCK }
```

Each spot is a one-line record answering its own `fits`, e.g. `EVSpot`: `return v.type() == VehicleType.EV;`, `TruckSpot`: `return true;`. No inherited `fits` to be mis-overridden — that's the Liskov point made structural.

### Write the tests

Write these first; they pin the spec before any logic exists. Group them: best-fit contract → rejection → billing → the concurrency stress test that fails an unsynchronised implementation.

**Best-fit** — the smallest fitting spot wins regardless of input order:

```java
@Test
void best_fit_picks_smallest_compatible_spot() {
    var lot = new ConcurrentParkingLot(
        List.of(new TruckSpot(3), new StandardSpot(2), new CompactSpot(1)));  // any order
    var ticket = lot.park(new Vehicle("ABC123", VehicleType.CAR), Instant.now()).orElseThrow();
    assertInstanceOf(CompactSpot.class, ticket.spot());   // not the truck or standard
}
```

**Incompatibility** — a vehicle with no fitting spot gets nothing:

```java
@Test
void ev_cannot_park_in_compact_only_lot() {
    var lot = new ConcurrentParkingLot(List.of(new CompactSpot(1)));
    assertFalse(lot.park(new Vehicle("EV999", VehicleType.EV), Instant.now()).isPresent());
}
```

**Billing** — the one-hour minimum and rounding-up rule:

```java
@Test
void unpark_charges_at_least_one_hour() {
    var lot = new ConcurrentParkingLot(List.of(new StandardSpot(1)));
    Instant entry = Instant.now();
    var t = lot.park(new Vehicle("ABC123", VehicleType.CAR), entry).orElseThrow();
    var charge = lot.unpark(t.id(), entry.plus(Duration.ofMinutes(15))).orElseThrow();
    assertEquals(0, charge.compareTo(new BigDecimal("2.50")));   // 15 min still bills 1 hr
}
// worth adding: a 61-minute stay bills 2 hours (ceiling), and unpark of an unknown UUID is empty.
```

**The stress test — the heart of a concurrency kata.** 100 cars race for 10 spots; a `CountDownLatch` gate releases them simultaneously so they actually collide. Exactly 10 must park and none of the 10 spots may be occupied twice. An implementation that does `containsKey` then `put` *without* a lock passes the three tests above and fails here intermittently:

```java
@Test
void concurrent_parks_never_double_occupy() throws Exception {
    var spots = IntStream.range(0, 10).<Spot>mapToObj(StandardSpot::new).toList();
    var lot = new ConcurrentParkingLot(spots);

    int N = 100;
    var gate = new CountDownLatch(1);
    var done = new CountDownLatch(N);
    var parked = new AtomicInteger();

    try (var exec = Executors.newVirtualThreadPerTaskExecutor()) {
        IntStream.range(0, N).forEach(i -> exec.submit(() -> {
            try {
                gate.await();                        // all threads block here…
                var car = new Vehicle("PLATE" + i, VehicleType.CAR);
                lot.park(car, Instant.now()).ifPresent(t -> parked.incrementAndGet());
            } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
            finally { done.countDown(); }
        }));
        gate.countDown();                            // …released together to maximise contention
        assertTrue(done.await(5, TimeUnit.SECONDS));
    }

    assertEquals(10, parked.get());                  // exactly capacity — no over-allocation
    assertEquals(0, lot.available(VehicleType.CAR)); // and the lot agrees it's full
}
```

The `gate` latch is the trick: without it threads trickle in and rarely collide, so a buggy lock-free version passes by luck. Releasing all threads at once forces the race.

### Implement it

Immutable layout at construction, two `ConcurrentHashMap`s for state, one `ReentrantLock` per spot:

```java
public class ConcurrentParkingLot implements ParkingLot {
    private static final BigDecimal HOURLY_RATE = new BigDecimal("2.50");  // String ctor = exact
    private final List<Spot> spots;
    private final Map<Integer, ReentrantLock> spotLocks;
    private final Map<Integer, Ticket> occupants = new ConcurrentHashMap<>();  // spotId → Ticket
    private final Map<UUID, Ticket> tickets   = new ConcurrentHashMap<>();     // ticketId → Ticket

    public ConcurrentParkingLot(List<Spot> spots) {
        this.spots = List.copyOf(spots);   // immutable snapshot → readers need no sync
        this.spotLocks = spots.stream()
            .collect(Collectors.toUnmodifiableMap(Spot::id, s -> new ReentrantLock()));
    }

    public Optional<Ticket> park(Vehicle vehicle, Instant entry) {
        var candidates = spots.stream()
            .filter(s -> s.fits(vehicle))
            .sorted(Comparator.comparingInt(Spot::sizeRank))   // best-fit: smallest first
            .toList();
        for (Spot spot : candidates) {
            ReentrantLock lock = spotLocks.get(spot.id());
            lock.lock();
            try {
                if (!occupants.containsKey(spot.id())) {       // re-check INSIDE the lock
                    Ticket t = new Ticket(UUID.randomUUID(), spot, vehicle.plate(), entry);
                    occupants.put(spot.id(), t);
                    tickets.put(t.id(), t);
                    return Optional.of(t);
                }
            } finally { lock.unlock(); }                       // lost the race → next candidate
        }
        return Optional.empty();
    }

    public Optional<BigDecimal> unpark(UUID ticketId, Instant exit) {
        Ticket t = tickets.remove(ticketId);   // atomic claim: only one caller sees non-null
        if (t == null) return Optional.empty();
        occupants.remove(t.spot().id());
        long hours = (Duration.between(t.entry(), exit).toMillis() + 3_599_999) / 3_600_000; // ceil
        if (hours < 1) hours = 1;               // one-hour minimum
        return Optional.of(HOURLY_RATE.multiply(BigDecimal.valueOf(hours))
                                      .setScale(2, RoundingMode.HALF_EVEN));
    }

    public long available(VehicleType type) {
        Vehicle probe = new Vehicle("PROBE", type);   // reuse each spot's own fits() rule
        return spots.stream()
            .filter(s -> s.fits(probe))
            .filter(s -> !occupants.containsKey(s.id()))
            .count();
    }
}
```

Complexity: `park` is O(S log S) to sort candidates then O(S) lock attempts worst case (S = spots); `unpark` is O(1); `available` is O(S). The load-bearing line is the `containsKey` re-check *inside* `lock` — that's what makes check-then-act atomic. `unpark` needs no spot lock because `tickets.remove` is itself the atomic claim: only one thread can pull a non-null ticket for a given id. The gotcha is the ceiling math — `(millis + 3_599_999) / 3_600_000` in `long`, never a `double` round-trip.

### Common mistakes & senior signal

- **Inheritance instead of sealed siblings.** `EVSpot extends StandardSpot` narrows `fits` and breaks LSP. Senior names the violation and models peers; junior ships the "is-a" lie.
- **`ConcurrentHashMap` mistaken for a lock.** Atomic *per operation* ≠ atomic across `containsKey`+`put`. The re-check must be under the per-spot lock; otherwise two threads both occupy spot 5.
- **Re-check outside the critical section.** Filtering candidates for "free" *before* locking is worthless — the window between filter and lock is exactly the race. Re-check after acquiring.
- **Global lock.** Correct but serialises every park lot-wide. Per-spot locks contend only on contested bays; justify the no-deadlock claim (one lock held at a time).
- **First-fit.** Wastes truck bays on motorcycles. Sort by `sizeRank` and take the first free.
- **`double`/`Math.ceil` billing, or `new BigDecimal(2.50)`.** Reintroduces float error. Integer ceiling math for hours; `BigDecimal` from a `String`; `HALF_EVEN` on the final cents.
- **Throwing on "full" / "unknown ticket".** These are ordinary outcomes → `Optional.empty()`. Senior keeps exceptions for genuinely exceptional states.
- **A stress test with no gate latch.** Threads that trickle in rarely collide, so the test passes a buggy lock-free impl. Release all threads simultaneously to force the race.


## Vending Machine — State Machine + Change-Making

### Summary

**What this topic covers**
You build a `VendingMachine`: a small session state machine that accepts coins one at a time, dispenses a product on `select(code)`, and returns exact change — or refuses cleanly without ever short-changing the customer. The public API is `restock`, `loadCoins`, `insertCoin`, `select`, and `refund`. The headline skills the interviewer is probing are three: modelling every outcome as a **sealed result type** instead of exceptions, a **plan-then-commit** transaction (compute the full change plan against a projected copy of the coin float, and only mutate real state if the plan succeeds), and **greedy change-making** over canonical coin denominations with exact `BigDecimal` money. `Coin`, `Product`, and `DispenseResult` are given as fixtures; you design the internal state and the change algorithm.

**Mental model**
Think of `select` as a database transaction with a validate phase and a commit phase. First it walks the failure modes cheapest-first: unknown product → out of stock → insufficient funds → can't-make-change. Then, before touching any real state, it builds a *projected* coin inventory — the current float **plus** the coins the user just inserted (they're physically in the machine now, so they're available as change) — and runs greedy change planning against that copy. If the plan comes back `null`, nothing has happened: refund and return `CannotMakeChange`. Only once a viable plan exists does it commit: add inserted coins to the float, remove the change coins, decrement stock, reset the session. The session is a tiny state machine: `insertCoin*` accumulates; every terminal outcome (success or failure) resets it; `InsufficientFunds` is the *only* non-terminal outcome — the session stays open so the user can top up.

**Key terms**
- **sealed interface** — Java 17+ closed sum type; `DispenseResult` has exactly five permitted record variants, so `switch` is exhaustiveness-checked.
- **plan-then-commit** — validate the entire transaction against a copy, mutate real state only on success. Same shape as git's index/working-tree or 2-phase commit.
- **projected inventory** — a fresh `EnumMap` copy of the float with the just-inserted coins merged in; the planner mutates it freely without side effects.
- **greedy change** — largest-coin-first allocation; provably minimal-coin **only** for canonical denomination sets.
- **canonical denominations** — a coin set (US: 1, 5, 10, 25, 100¢) where greedy always finds the optimum. Non-canonical sets (e.g. 1, 3, 4) break greedy.
- **`BigDecimal`** — exact decimal money; `double` cannot represent 0.10, so it is forbidden for any monetary value.
- **HALF_EVEN** — banker's rounding; unbiased over many transactions, standard for finance.
- **`EnumMap`** — array-backed map keyed by enum ordinal; the right structure for the fixed `Coin` key universe.
- **session reset** — clears `insertedAmount` and `insertedCoins`; happens on commit, refund, and every terminal failure.
- **`compareTo` vs `equals`** — compare `BigDecimal` with `compareTo`; `equals` treats 1.0 and 1.00 as unequal.

**Why interviewers ask this**
It's an open-ended design problem, so it separates candidates fast. A junior wires the happy path, throws exceptions for out-of-stock, sums coins into a `double`, and mutates stock/float as they go — then discovers they've dispensed a product they can't make change for. A senior names the failure modes up front, reaches for a sealed result type, uses `BigDecimal` from the first line, and — the real tell — computes the change plan against a *copy* before mutating anything, so a `CannotMakeChange` transaction leaves state pristine. Talking clearly about *why* greedy is safe here (canonical denominations) and *when* it would break (arbitrary sets → DP min-coin) is the senior signal. So is treating `InsufficientFunds` as non-terminal while everything else resets.

**Common confusions**
- **"CannotMakeChange means they didn't pay enough"** → no. They may have *overpaid* and still hit it if the float can't assemble the exact change. `InsufficientFunds` (paid too little) and `CannotMakeChange` (paid enough, no change available) are distinct.
- **"Plan change against the current float"** → plan against the *projected* float (current + inserted coins); the user's own coins are valid change once inserted.
- **"Refund gives equivalent coins from the float"** → no. `refund()` returns the *exact* coins the user inserted, not equivalents — fairer and it doesn't drain the change reserve.
- **"Greedy always gives minimum coins"** → only for canonical sets. State the caveat unprompted.
- **"Exceptions for out-of-stock"** → those are business branches, not exceptional; exceptions also pay stack-trace cost on predictable flows.

**What follows from this topic**
The plan-then-commit pattern generalises: cashless payments add `Authorising → Authorised → Captured/Voided` states but keep the same "only capture once you can dispense" discipline. A shared inventory across a fleet of machines replaces `synchronized` with DB row-locks or optimistic CAS. The change-making core connects to the classic **coin-change DP** (min coins / count ways) — swap greedy for `dp[v] = 1 + min(dp[v - c])` the moment denominations stop being canonical.

### Clarify & design the API

Questions to ask before writing a line: *Are denominations canonical* (so greedy is safe)? *Is the machine single-user* (so a coarse lock is fine) or a shared fleet? *Must failures never throw*? *Does the user get their exact coins back on refund, or equivalents?* *What's the money type* — the correct answer is `BigDecimal`, never `double`.

Then commit to a small surface. `select` returns a sealed `DispenseResult`, not a boolean or an exception:

```java
public void restock(Product product, int qty);
public void loadCoins(Coin coin, int count);
public void insertCoin(Coin coin);
public DispenseResult select(String code);   // sealed: Dispensed | InsufficientFunds
                                              // | OutOfStock | UnknownProduct | CannotMakeChange
public List<Coin> refund();                   // the exact coins inserted

sealed interface DispenseResult permits Dispensed, InsufficientFunds,
        OutOfStock, UnknownProduct, CannotMakeChange {}
record Dispensed(Product product, List<Coin> change) implements DispenseResult {}
record InsufficientFunds(BigDecimal needed)          implements DispenseResult {}
record CannotMakeChange(BigDecimal owed)             implements DispenseResult {}
```

Internal state: `Map<String,Product> catalogue`, `Map<String,Integer> stock`, `EnumMap<Coin,Integer> coinInventory` (the float), and the session pair `BigDecimal insertedAmount` + `List<Coin> insertedCoins`.

### Write the tests

Write these **first** — they pin the spec before any logic exists. Group them: happy path → each failure branch → session lifecycle → money edge cases. Every test starts from a fixture machine with a stocked product and a loaded coin float.

```java
private VendingMachine vm;
private final Product cola = new Product("A1", "Cola", new BigDecimal("1.25"));

@BeforeEach
void setUp() {
    vm = new VendingMachine();
    vm.restock(cola, 3);
    vm.loadCoins(Coin.QUARTER, 10);
    vm.loadCoins(Coin.DIME, 10);
    vm.loadCoins(Coin.NICKEL, 10);
}
```

**Basic contract — dispense with and without change.** Exact money dispenses with empty change; overpayment returns change whose *total* equals the overpay (assert on the summed value with `compareTo`, not on a specific coin list — the plan is an implementation detail):

```java
@Test
void dispenses_when_exact_money_inserted() {
    vm.insertCoin(Coin.DOLLAR);
    vm.insertCoin(Coin.QUARTER);
    var d = assertInstanceOf(DispenseResult.Dispensed.class, vm.select("A1"));
    assertEquals(cola, d.product());
    assertTrue(d.change().isEmpty());
}

@Test
void dispenses_with_change() {
    vm.insertCoin(Coin.DOLLAR);
    vm.insertCoin(Coin.DOLLAR);            // overpay by 0.75
    var d = assertInstanceOf(DispenseResult.Dispensed.class, vm.select("A1"));
    BigDecimal total = d.change().stream()
            .map(Coin::value).reduce(BigDecimal.ZERO, BigDecimal::add);
    assertEquals(0, total.compareTo(new BigDecimal("0.75")));
}
```

**Core behaviour — the failure modes, one test each.** These are the reason the return type is sealed. `InsufficientFunds` is special: it must report the *shortfall* and keep the session open.

```java
@Test
void insufficient_funds_keeps_session_alive() {
    vm.insertCoin(Coin.QUARTER);
    var ins = assertInstanceOf(DispenseResult.InsufficientFunds.class, vm.select("A1"));
    assertEquals(0, ins.needed().compareTo(new BigDecimal("1.00")));
    // session still open: topping up to price now dispenses
    vm.insertCoin(Coin.DOLLAR);
    assertInstanceOf(DispenseResult.Dispensed.class, vm.select("A1"));
}

@Test
void unknown_product_refunds() {
    vm.insertCoin(Coin.DOLLAR);
    assertInstanceOf(DispenseResult.UnknownProduct.class, vm.select("ZZ"));
}

@Test
void out_of_stock_refunds() {
    VendingMachine empty = new VendingMachine();
    empty.restock(cola, 0);
    empty.insertCoin(Coin.DOLLAR);
    empty.insertCoin(Coin.QUARTER);
    assertInstanceOf(DispenseResult.OutOfStock.class, empty.select("A1"));
}
```

**Edge / boundary — the two traps.** `CannotMakeChange` when the user *overpaid* but the float can't assemble exact change — and, critically, that the failed transaction is side-effect-free (stock and float untouched, so a subsequent well-funded select still works). Plus `refund` returning the exact coins:

```java
@Test
void cannot_make_change_when_float_lacks_coins() {
    VendingMachine m = new VendingMachine();
    m.restock(cola, 1);                    // price 1.25, float has NO change coins
    m.insertCoin(Coin.DOLLAR);
    m.insertCoin(Coin.DOLLAR);             // owe 0.75, but float can't build it
    assertInstanceOf(DispenseResult.CannotMakeChange.class, m.select("A1"));
    // plan-then-commit: stock untouched, so a fresh exact-pay transaction still dispenses
    m.insertCoin(Coin.DOLLAR);
    m.insertCoin(Coin.QUARTER);
    assertInstanceOf(DispenseResult.Dispensed.class, m.select("A1"));
}

@Test
void refund_returns_exact_inserted_coins() {
    vm.insertCoin(Coin.QUARTER);
    vm.insertCoin(Coin.DIME);
    var coins = vm.refund();
    assertEquals(2, coins.size());
    assertInstanceOf(DispenseResult.InsufficientFunds.class, vm.select("A1")); // session reset
}
```

**Concurrency — single-user atomicity.** The machine serves one human at a time, so every public method is `synchronized`; the property to assert is that interleaved sessions don't corrupt stock. Hammer `select` from many threads against limited stock and check nothing over-dispenses:

```java
@Test
void concurrent_selects_never_oversell() throws InterruptedException {
    VendingMachine m = new VendingMachine();
    m.restock(cola, 5);
    m.loadCoins(Coin.QUARTER, 100);
    var dispensed = new java.util.concurrent.atomic.AtomicInteger();
    var pool = java.util.concurrent.Executors.newFixedThreadPool(8);
    for (int i = 0; i < 50; i++) pool.submit(() -> {
        // NOTE: real code needs per-session isolation; here we assert stock never goes negative
        synchronized (m) {                          // model one buyer's insert+select as atomic
            m.insertCoin(Coin.DOLLAR); m.insertCoin(Coin.QUARTER);
            if (m.select("A1") instanceof DispenseResult.Dispensed) dispensed.incrementAndGet();
        }
    });
    pool.shutdown();
    pool.awaitTermination(5, java.util.concurrent.TimeUnit.SECONDS);
    assertTrue(dispensed.get() <= 5);               // never dispense more than stock
}
```

### Implement it

Money is `BigDecimal`; the float is an `EnumMap<Coin,Integer>` (dense, array-backed, iterates in enum order). `select` walks failures cheapest-first, then does plan-then-commit against a projected copy:

```java
public synchronized DispenseResult select(String code) {
    Product p = catalogue.get(code);
    if (p == null)                              return refundAndReturn(new UnknownProduct(code));
    if (stock.getOrDefault(code, 0) <= 0)       return refundAndReturn(new OutOfStock(code));
    if (insertedAmount.compareTo(p.price()) < 0)                      // non-terminal: keep session
        return new InsufficientFunds(p.price().subtract(insertedAmount));

    BigDecimal owed = insertedAmount.subtract(p.price()).setScale(2, RoundingMode.HALF_EVEN);
    Map<Coin,Integer> projected = new EnumMap<>(coinInventory);       // float + just-inserted coins
    for (Coin c : insertedCoins) projected.merge(c, 1, Integer::sum);

    List<Coin> change = planGreedyChange(owed, projected);
    if (change == null) return refundAndReturn(new CannotMakeChange(owed));  // bail BEFORE mutating

    for (Coin c : insertedCoins) coinInventory.merge(c, 1, Integer::sum);    // commit phase
    for (Coin c : change)        coinInventory.merge(c, -1, Integer::sum);
    stock.merge(code, -1, Integer::sum);
    resetSession();
    return new Dispensed(p, change);
}

private List<Coin> planGreedyChange(BigDecimal amount, Map<Coin,Integer> projected) {
    if (amount.signum() == 0) return List.of();
    Coin[] sorted = { Coin.DOLLAR, Coin.QUARTER, Coin.DIME, Coin.NICKEL, Coin.PENNY };
    List<Coin> coins = new ArrayList<>();
    BigDecimal remaining = amount;
    for (Coin c : sorted)
        while (remaining.compareTo(c.value()) >= 0 && projected.getOrDefault(c, 0) > 0) {
            remaining = remaining.subtract(c.value());
            projected.merge(c, -1, Integer::sum);
            coins.add(c);
        }
    return remaining.signum() == 0 ? coins : null;                    // null == can't make change
}
```

Complexity: `select` is `O(D + K)` where `D` is the fixed denomination count (5) and `K` the number of change coins produced — effectively constant per transaction. The gotcha is the projection: `planGreedyChange` decrements the *copy*, so returning `null` costs nothing to unwind. For non-canonical denominations swap greedy for min-coin DP: `O(amount × coins)`.

### Common mistakes & senior signal

- **Mutating real state during planning.** Decrementing the live float or stock as you allocate change, then discovering you can't complete — now you've corrupted state. Plan against a *copy*; commit only on success.
- **Planning change against the wrong inventory.** The user's inserted coins are inside the machine and available as change; plan against float **+** inserted, not float alone.
- **Conflating `InsufficientFunds` and `CannotMakeChange`.** Different causes (paid too little vs. no exact change), different lifecycle (open vs. reset). Collapsing them is the classic junior miss.
- **`double` for money.** Ten dimes drift off 1.00. Use `BigDecimal`, `compareTo` for comparisons, `HALF_EVEN` for rounding.
- **Throwing on business branches.** Out-of-stock is not exceptional; a sealed result forces callers to handle every case and the compiler checks exhaustiveness.
- **Resetting the session on `InsufficientFunds`.** That one outcome must keep accumulated coins so the user can top up; everything else (including success) resets.
- **Refunding equivalents from the float.** Return the *exact* coins inserted — fairer and it protects the change reserve.
- **Senior tell:** naming the greedy/canonical assumption unprompted and stating the DP fallback, plus articulating plan-then-commit as the same shape as 2-phase commit or git's index — connecting the toy kata to real transaction discipline.


## Elevator Controller — LOOK Scheduling & Dispatch

### Summary

**What this topic covers**
This kata models a bank of elevators serving a building, and it is the canonical "design a state machine + a dispatcher" LLD question. You build two classes from scratch: an `Elevator` car that runs the **LOOK** scheduling algorithm (travel in one direction, serve every pending stop on that side, reverse only when the side is exhausted), and an `ElevatorController` that receives external hall calls and routes each to the lowest-cost car. A `tick()` advances the simulation by exactly one floor across all cars. The interesting design work is not the plumbing — it is the two-transition state machine inside the car and the directional-bias cost function in the dispatcher. Getting those two right is the whole exercise.

**Mental model**
Think of the car as a state machine with three states — `UP`, `DOWN`, `IDLE` — and two *distinct* transition functions. The first, `chooseInitialDirection`, fires only when a parked (IDLE) car gets its first target: pick the side with the nearer stop, ties to UP. The second, `maybeReverseOrIdle`, fires after every step of motion: if stops remain on the current side keep going; if only the far side has work, reverse; if nothing remains, park. Keep these two separate — entering motion from rest has no "current direction to continue," so collapsing both into one branchy method makes each case harder to verify. The targets live in a `NavigableSet` (`TreeSet`), which is sorted *and* de-duplicating, so "what is the nearest stop strictly above/below me?" is `higher()`/`lower()` in O(log n) — exactly the query LOOK needs every tick. The dispatcher is separate: each car schedules itself; the controller only decides *who* serves a call, via a cost function that penalises cars moving away from the caller.

**Key terms**
- **LOOK** — serve stops in the current direction until the furthest pending request, then reverse. What real elevators do.
- **SCAN** — always travel to the building's extreme floor before reversing, even with no stops there. Wastes travel.
- **C-SCAN** — serve in one direction only, jump back to the start without serving on the return. Uniform waits, unnatural for a physical car.
- **`NavigableSet` / `TreeSet`** — sorted, de-duplicating set; `higher(f)`/`lower(f)` give the nearest element strictly above/below `f`.
- **Dispatcher pattern** — a central router assigns work to the best worker; here, hall call → lowest-cost car.
- **Hall call** — external button on a floor (`Request` with a direction); routed through the dispatcher.
- **Cab-button press** — `selectFloor`; already addressed to a specific car, bypasses dispatch.
- **Directional bias** — cost penalty (building height) for a car moving away from the caller, so it isn't handed a call it would serve last.
- **tick()** — one simulation step: advance one floor, check arrival, re-evaluate direction.
- **IDLE** — a parked *state*, not a destination; invalid as a `Request` direction.

**Why interviewers ask this**
It separates candidates who can *name* a state machine from those who can *build a correct one*. A junior implements movement and thinks they're done — then their car overshoots, or stops twice on a duplicate target, or reverses one floor early. A senior identifies the two transitions up front, picks `TreeSet` deliberately (and can say why not `PriorityQueue` or `HashSet`), writes tests that pin the reverse-and-idle boundary *before* implementing, and separates the car's self-scheduling from the dispatcher's assignment. The dispatch cost function is the senior tell: recognising that raw nearest-floor distance produces pathological assignments (a descending car handed an up-call beneath it) and adding a directional penalty shows systems thinking beyond the happy path.

**Common confusions**
- "LOOK and SCAN are the same" — no; SCAN goes to the physical extreme, LOOK stops at the furthest *request*. Interviewers probe this.
- "One method can handle both direction decisions" — technically yes, but the IDLE-start case and the mid-trip-exhaustion case have different preconditions; merging them hides bugs.
- "Nearest car is the best dispatch" — only if it's heading the right way; a car moving away must traverse its whole run first.
- "PriorityQueue works for targets" — it can't de-duplicate and can't answer "nearest above me" without a direction-specific comparator.
- "The car should compute direction inside tick()" — better to set it when a target is added so the controller can observe accurate state immediately.

**What follows from this topic**
This is the same shape as any dispatcher-over-workers design: task schedulers, load balancers, print-queue routers. The state-machine discipline transfers to traffic lights, vending machines, and TCP connection state. Natural extensions the interviewer will push: capacity-aware dispatch (skip full cars in cost ranking), priority modes (fire-service recall overriding all targets), same-direction matching using `Request.direction()`, and swapping the `synchronized` monitor for a single-dispatcher-thread + `BlockingQueue` pipeline.

### Clarify & design the API

Questions to ask before writing anything: single car or a bank? LOOK or SCAN? Does a `tick` move one floor or one target? Are floors bounded (min/max)? Do hall calls carry a direction? Is this concurrent? For this kata: multi-car, LOOK, one-floor-per-tick, bounded floors, directional hall calls, and a single serialisation point.

Commit to two small APIs before any logic:

```java
enum Direction { UP, DOWN, IDLE }
record Request(int floor, Direction direction) { /* reject IDLE */ }

class Elevator {
    Elevator(int id, int currentFloor, int minFloor, int maxFloor);
    void addTarget(int floor);      // hall call OR cab press — same path
    boolean tick();                 // advance one floor; true iff a stop was reached
    int costFor(Request r);         // dispatch score, lower = better
    int id(); int currentFloor(); Direction direction();
}

class ElevatorController {
    Optional<Integer> call(Request r);        // dispatch → chosen car id
    void selectFloor(int elevatorId, int f);  // cab press, bypasses dispatch
    void tick();                              // step every car
    List<Elevator> elevators();
}
```

The key design commitment: `addTarget` is the *single* entry for both external and internal requests — LOOK doesn't care where a stop came from, only where it sits relative to the car. That collapses two apparent features into one code path.

### Write the tests

Write these first — they pin the spec before you touch the state machine. Group them: basic contract → multi-stop LOOK behaviour → reverse/idle boundary → dispatch selection → argument validation.

```java
// --- Basic contract: a single car reaches a called floor ---
@Test void single_elevator_serves_call() {
    var e = new Elevator(1, 0, 0, 10);
    var ctrl = new ElevatorController(List.of(e));
    ctrl.call(new Request(5, Direction.UP));
    for (int i = 0; i < 10 && e.currentFloor() != 5; i++) ctrl.tick();
    assertEquals(5, e.currentFloor());
}

// --- Core LOOK: multiple same-direction stops served in one pass, then idle ---
@Test void serves_multiple_targets_in_one_pass() {
    var e = new Elevator(1, 0, 0, 10);
    var ctrl = new ElevatorController(List.of(e));
    ctrl.call(new Request(3, Direction.UP));
    ctrl.call(new Request(7, Direction.UP));
    for (int i = 0; i < 20 && e.direction() != Direction.IDLE; i++) ctrl.tick();
    assertEquals(7, e.currentFloor());
    assertEquals(Direction.IDLE, e.direction());
}

// --- Reverse boundary: go up to the top request, then come back down ---
@Test void reverses_after_exhausting_a_direction() {
    var e = new Elevator(1, 5, 0, 10);
    var ctrl = new ElevatorController(List.of(e));
    ctrl.call(new Request(8, Direction.UP));    // up first
    ctrl.call(new Request(2, Direction.DOWN));  // then reverse down
    for (int i = 0; i < 30 && e.direction() != Direction.IDLE; i++) ctrl.tick();
    assertEquals(2, e.currentFloor());
}

// --- Initial-direction tie-break: equidistant targets resolve toward UP ---
@Test void idle_car_breaks_direction_ties_toward_up() {
    var e = new Elevator(1, 5, 0, 10);
    e.addTarget(3); e.addTarget(7);             // both distance 2
    assertEquals(Direction.UP, e.direction());
}

// --- Dispatch: nearest suitable car wins ---
@Test void dispatcher_picks_nearest_elevator() {
    var e1 = new Elevator(1, 0, 0, 20);
    var e2 = new Elevator(2, 15, 0, 20);
    var ctrl = new ElevatorController(List.of(e1, e2));
    int chosen = ctrl.call(new Request(14, Direction.DOWN)).orElseThrow();
    assertEquals(2, chosen);   // e2 at 15 is closer to 14 than e1 at 0
}

// --- De-duplication: adding the same target twice is idempotent ---
@Test void duplicate_target_does_not_stop_twice() {
    var e = new Elevator(1, 0, 0, 10);
    e.addTarget(4); e.addTarget(4);
    int stops = 0;
    for (int i = 0; i < 4; i++) if (e.tick()) stops++;
    assertEquals(1, stops);
}

// --- Argument validation ---
@Test void rejects_idle_request_and_out_of_range_floor() {
    assertThrows(IllegalArgumentException.class,
        () -> new Request(3, Direction.IDLE));
    var e = new Elevator(1, 0, 0, 10);
    assertThrows(IllegalArgumentException.class, () -> e.addTarget(99));
    var ctrl = new ElevatorController(List.of(e));
    assertThrows(IllegalArgumentException.class, () -> ctrl.selectFloor(999, 3));
}
```

Why each group matters: the single-call test proves motion; the multi-pass test proves LOOK serves *all* same-side stops before idling; the reverse test pins the exact transition that a naive impl gets wrong (idling one floor early, or overshooting to the building extreme); the tie-break test locks the IDLE-start semantics; the dispatch test proves the cost function selects correctly; de-dup proves the `TreeSet` choice pays off; validation guards the `Request`/floor invariants.

### Implement it

Two classes. The car holds `NavigableSet<Integer> targets = new TreeSet<>()`, `currentFloor`, `direction`, and floor bounds. Add-target picks a direction immediately if parked:

```java
public void addTarget(int floor) {
    if (floor < minFloor || floor > maxFloor)
        throw new IllegalArgumentException("floor out of range");
    if (floor == currentFloor) return;
    targets.add(floor);                              // TreeSet de-dups for free
    if (direction == Direction.IDLE) chooseInitialDirection();
}

public boolean tick() {
    if (direction == Direction.IDLE) return false;
    currentFloor += (direction == Direction.UP) ? 1 : -1;
    boolean reached = targets.remove(currentFloor);
    maybeReverseOrIdle();
    return reached;
}
```

The two transitions, kept separate:

```java
private void chooseInitialDirection() {
    Integer up = targets.higher(currentFloor), down = targets.lower(currentFloor);
    if (up == null && down == null) { direction = Direction.IDLE; return; }
    if (up == null)   direction = Direction.DOWN;
    else if (down == null) direction = Direction.UP;
    else direction = (up - currentFloor) <= (currentFloor - down)
                     ? Direction.UP : Direction.DOWN;   // tie → UP
}

private void maybeReverseOrIdle() {
    if (targets.isEmpty()) { direction = Direction.IDLE; return; }
    if (direction == Direction.UP   && targets.higher(currentFloor) != null) return;
    if (direction == Direction.DOWN && targets.lower(currentFloor)  != null) return;
    if (direction == Direction.UP   && targets.lower(currentFloor)  != null) direction = Direction.DOWN;
    else if (direction == Direction.DOWN && targets.higher(currentFloor) != null) direction = Direction.UP;
    else direction = Direction.IDLE;
}
```

The dispatch cost — nearest-car with directional bias:

```java
public int costFor(Request r) {
    int distance = Math.abs(currentFloor - r.floor());
    if (direction == Direction.UP   && r.floor() < currentFloor) distance += (maxFloor - minFloor);
    if (direction == Direction.DOWN && r.floor() > currentFloor) distance += (maxFloor - minFloor);
    return distance;
}
```

The controller picks `min` by `costFor`, forwards to that car, and returns its id; all controller methods are `synchronized` so hall calls, cab presses, and ticks serialise against each other.

```java
public synchronized Optional<Integer> call(Request request) {
    Elevator best = elevators.stream()
        .min(Comparator.comparingInt(a -> a.costFor(request))).orElseThrow();
    best.addTarget(request.floor());
    return Optional.of(best.id());
}
```

**Complexity:** each tick is O(log n) per car for the `higher`/`lower`/`remove` queries (n = pending targets); dispatch is O(cars). **Key gotcha:** advance the floor *before* checking `targets.remove(currentFloor)` and re-evaluate direction *after* — reordering these idles the car a floor early or double-counts a stop.

### Common mistakes & senior signal

- **Collapsing the two transitions** into one branchy `updateDirection()` — the reference README calls this out explicitly. The IDLE-start case has no direction to "continue," so it needs its own logic; merging them hides off-by-one reversals.
- **Wrong data structure** — a `PriorityQueue` can't de-duplicate and can't answer "nearest stop above me" without swapping comparators mid-flight; a `HashSet` loses ordering. `TreeSet` is the deliberate choice, and saying *why* is the senior signal.
- **Naive nearest-car dispatch** — without the directional penalty, a descending car gets handed an up-call right beneath it and serves it last. Recognising and pricing "moving away" travel is the tell.
- **Confusing LOOK with SCAN** — travelling to the building extreme when no stop is pending there is a correctness *and* efficiency bug.
- **Off-by-one in tick ordering** — checking arrival before moving, or re-evaluating direction before removing the reached target, produces early idles and double stops.
- **Senior extras:** mentions capacity-aware dispatch, fire-service priority recall, same-direction matching via `Request.direction()`, and that the `synchronized` monitor would become a single-dispatcher-thread + `BlockingQueue` in production — no lock held across door I/O.


## Limit Order Book — Price-Time Priority Matching

### Summary

**What this topic covers**

Build a continuous double-auction matching engine for a single symbol — the core of every equity or futures exchange. You implement `OrderBook` from scratch: `submit(order)` matches an incoming order against the opposite side, prints `Trade` records for every fill, and rests any residual as a passive order; `cancel(orderId)` pulls a resting order; `bestBid()`/`bestAsk()` expose the top of book. The `Order` record (with `BigDecimal` price), `Trade` record, and `Side` enum are given. What you design is the internal machinery — the two sorted books, the per-price FIFO queues, the flat id index for cancellation, the matching loop, and the locking. Primarily a data-structure / LLD kata, but with a real single-writer concurrency story: the match loop is inherently sequential, so one lock guards the whole book.

**Mental model**

Two ordered books facing each other. Bids (BUY) live in a `TreeMap` with `Comparator.reverseOrder()`, so `firstEntry()` is the *highest* bid; asks (SELL) live in a natural-ordered `TreeMap`, so `firstEntry()` is the *lowest* ask. Each price level's value is an `ArrayDeque<Order>` holding that level's orders in arrival order — `peek`/`poll` at the head give the time-priority winner in O(1). An incoming aggressor walks the *opposite* book from best price outward: a buy lifts asks from the lowest up, a sell hits bids from the highest down. At each level it drains the FIFO queue, printing a trade for `min(aggressorRemaining, restingQty)` at the **resting** order's price (price improvement). It stops the moment the best opposite level no longer crosses — prices only get worse deeper, so if the top doesn't cross, nothing does. Whatever can't fill rests on its own side. That is the whole engine: sorted maps for price priority, deques for time priority, `min` for partial fills.

**Key terms**

- **Aggressor / taker** — the incoming order that crosses the spread and consumes liquidity.
- **Resting / passive / maker** — an order sitting in the book waiting to be matched.
- **Price-time priority** — match rule: best price first, then earliest submission (FIFO) within a level.
- **Crossing** — a BUY crosses when `bid >= best ask`, a SELL when `ask <= best bid`; via `compareTo`, never `==`.
- **Price improvement** — the trade prints at the *resting* price, so the aggressor transacts at least as well as its limit.
- **Partial fill** — a resting order consumed in part; it stays at the head of its queue with reduced qty (priority preserved).
- **`TreeMap` (NavigableMap)** — O(log p) sorted price → level map; `firstKey()` gives top of book.
- **`ArrayDeque`** — the per-level FIFO queue; O(1) head peek/poll, tail add.
- **Flat id index** — `UUID → Order` map mirroring the deques so `cancel` is O(log p), not an O(n) scan.
- **`withQty` / immutability** — `Order` is a record; a partial fill *replaces* the head instance rather than mutating it.
- **Single-writer lock** — one `ReentrantLock` over the whole book; the match loop can't be parallelised per level.
- **Empty-level cleanup** — a level whose deque drains must be removed immediately, or `bestBid`/`bestAsk` return a phantom.

**Why interviewers ask this**

It is the canonical "design a system with two coupled data structures and get the priorities right" problem, and it separates candidates instantly. A junior reaches for a single sorted list with O(n) inserts, or a `PriorityQueue` that then can't do FIFO-within-price or O(1) cancel. A senior names the shape immediately — sorted map of price to FIFO queue, one book per side, reverse comparator on bids — and justifies each choice: `TreeMap` over `PriorityQueue` (you must *iterate* levels in order and remove drained ones, not just poll one min), `BigDecimal` over `double` (rounding compounds into real P&L), one lock over fine-grained (a single aggressor walks multiple levels). Follow-ups probe depth: partial-fill bookkeeping, the resting-price rule, IOC/FOK/market/iceberg types, and scaling (shard by symbol — the LMAX Disruptor model).

**Common confusions**

- "Use a `PriorityQueue` per side" — a heap gives the single best order but not ordered *iteration* over levels, FIFO-within-price, or O(1) removal of a drained level. `TreeMap<price, ArrayDeque>` is the right shape.
- "Trade prints at the aggressor's price" — no; it prints at the **resting** price (price improvement). Getting it backwards is an instant red flag.
- "Mutate the resting order's qty in place" — `Order` is immutable and shared between the deque and the id index; replace the head via `withQty` so the original timestamp survives.
- "A partially filled resting order goes to the back" — it stays at the **head**; only its quantity shrinks, or time priority breaks.
- "Leave the empty level in the map" — a drained level must be removed, or `firstEntry()` returns zero-liquidity levels and best-price queries lie.
- "Bids and asks share one comparator" — they can't; bids need reverse order (highest first), asks natural order (lowest first), so `firstEntry()` is the best on both.
- "Lock per level for throughput" — the next match decision depends on the previous fill, so the loop is sequential; one lock is both correct and faster.

**What follows from this topic**

The two-sorted-structures-plus-index pattern recurs across LLD katas — an LRU cache (hash map + intrusive list), a rate limiter (sorted timestamps), a scheduler (priority queue + index). The single-writer / shard-by-key model here is the same one behind the [[bounded-blocking-queue]]. The `BigDecimal`-for-money and `compareTo`-not-`==` habits generalise to any financial code, and the extension menu — IOC, FOK, market, iceberg, pro-rata — is the "now add this variant" pressure an interviewer applies once your baseline engine passes.

### Clarify & design the API

Questions to settle before writing a line of logic: single symbol or many (single — shard across books for many)? What precision for price (`BigDecimal`, always — money is never `double`)? Does `submit` return the trades it produced (yes — the aggressing caller needs its fills; resting orders are filled silently)? What does `cancel` return for an already-filled or unknown id (`false` — the caller can't distinguish, same as most exchanges)? IOC/FOK/market on day one (no — plain limit orders that rest their residual; keep the extension seam visible)? Thread-safe (yes — one lock)?

Commit to a tiny public surface and let the internals stay private:

```java
public record Order(UUID id, Side side, BigDecimal price, int qty, Instant submittedAt) {
    public Order withQty(int newQty) { return new Order(id, side, price, newQty, submittedAt); }
}
public record Trade(UUID buyOrderId, UUID sellOrderId, int qty, BigDecimal price, Instant at) {}
public enum Side { BUY, SELL }

public class OrderBook {
    public List<Trade> submit(Order order);   // match, rest residual, return fills
    public boolean     cancel(UUID orderId);  // true iff open and removed
    public Optional<BigDecimal> bestBid();    // highest resting bid
    public Optional<BigDecimal> bestAsk();    // lowest resting ask
    // internals: NavigableMap<BigDecimal, Deque<Order>> buys/sells, Map<UUID,Order> index, ReentrantLock
}
```

Inject a `Clock` in the constructor so tests can pin timestamps deterministically — real exchanges stamp to microseconds; a fixed clock lets you assert without racing wall time.

### Write the tests

Write these first — they pin the spec before any matching logic exists. Group them: basic contract → core matching behaviour → price-time priority → best-price bookkeeping → argument validation → the concurrency stress tests. A helper keeps each test to its point:

```java
private final OrderBook book = new OrderBook();
private Order order(Side side, String price, int qty) {
    return new Order(UUID.randomUUID(), side, new BigDecimal(price), qty, Instant.now());
}
```

**Basic contract — an order that doesn't cross just rests.**

```java
@Test void resting_order_creates_no_trades() {
    var trades = book.submit(order(Side.BUY, "100", 10));
    assertTrue(trades.isEmpty());
    assertEquals(new BigDecimal("100"), book.bestBid().orElseThrow());
}
```

**Core behaviour — crossing fills, and it prints at the resting price (price improvement).** This is the single most important assertion in the suite.

```java
@Test void crossing_order_executes_trade_at_resting_price() {
    book.submit(order(Side.SELL, "100", 10));            // resting ask
    var trades = book.submit(order(Side.BUY, "105", 10)); // buy crosses at 105 but pays 100
    assertEquals(1, trades.size());
    assertEquals(new BigDecimal("100"), trades.get(0).price());  // resting price, not 105
    assertEquals(10, trades.get(0).qty());
    assertTrue(book.bestAsk().isEmpty());
    assertTrue(book.bestBid().isEmpty());
}

@Test void partial_fill_leaves_residual() {
    book.submit(order(Side.SELL, "100", 10));
    var trades = book.submit(order(Side.BUY, "100", 4));
    assertEquals(1, trades.size());
    assertEquals(4, trades.get(0).qty());
    assertEquals(new BigDecimal("100"), book.bestAsk().orElseThrow()); // 6 left on the ask
}
```

**Price-time priority — same price, earliest submission fills first.**

```java
@Test void price_time_priority_serves_earlier_order_first() {
    var first = order(Side.SELL, "100", 5);
    var second = order(Side.SELL, "100", 5);
    book.submit(first);
    book.submit(second);
    var trades = book.submit(order(Side.BUY, "100", 5));
    assertEquals(first.id(), trades.get(0).sellOrderId()); // FIFO within the level
}
```

**Best-price bookkeeping and cancel.**

```java
@Test void best_prices_reflect_book_state() {
    book.submit(order(Side.BUY, "99", 5));
    book.submit(order(Side.BUY, "100", 5));
    book.submit(order(Side.SELL, "101", 5));
    book.submit(order(Side.SELL, "102", 5));
    assertEquals(new BigDecimal("100"), book.bestBid().orElseThrow()); // highest buy
    assertEquals(new BigDecimal("101"), book.bestAsk().orElseThrow()); // lowest sell
}

@Test void cancel_removes_order() {
    var o = order(Side.BUY, "100", 5);
    book.submit(o);
    assertTrue(book.cancel(o.id()));
    assertTrue(book.bestBid().isEmpty());   // level drained and removed
}

@Test void cancel_unknown_id_returns_false() {
    assertFalse(book.cancel(UUID.randomUUID()));
}
```

**Argument validation — reject nonsense at the boundary (compact constructor).**

```java
@Test void rejects_non_positive_qty_and_price() {
    assertThrows(IllegalArgumentException.class, () -> order(Side.BUY, "100", 0));
    assertThrows(IllegalArgumentException.class, () -> order(Side.BUY, "0", 5));
}
```

**Stress tests — the single-writer invariant under load.** These fail an unsynchronised implementation with lost updates, duplicate fills, or a corrupted deque. Two angles: (1) N resting orders submitted concurrently then swept by one aggressor — every id must be filled exactly once and the book must end empty; (2) N buys + N sells at a crossing price submitted in parallel — total filled quantity must be conserved.

```java
@Test void price_time_priority_holds_under_concurrent_rests() throws Exception {
    int N = 50;
    var ids = new java.util.concurrent.ConcurrentLinkedQueue<UUID>();
    var gate = new CountDownLatch(1);
    var done = new CountDownLatch(N);
    try (var exec = Executors.newVirtualThreadPerTaskExecutor()) {
        IntStream.range(0, N).forEach(i -> exec.submit(() -> {
            try { gate.await(); var o = order(Side.SELL, "100", 1); book.submit(o); ids.add(o.id()); }
            catch (InterruptedException e) { Thread.currentThread().interrupt(); }
            finally { done.countDown(); }
        }));
        gate.countDown();
        assertTrue(done.await(5, TimeUnit.SECONDS));
    }
    var trades = book.submit(order(Side.BUY, "100", N));         // sweep all N with one buy
    assertEquals(N, trades.size());
    assertEquals(N, trades.stream().map(Trade::sellOrderId).distinct().count(), "each filled once");
    assertTrue(book.bestAsk().isEmpty());
    assertTrue(book.bestBid().isEmpty());
}

@Test void concurrent_submits_match_consistently() throws Exception {
    int N = 100;
    var gate = new CountDownLatch(1);
    var done = new CountDownLatch(N * 2);
    var totalFilledQty = new AtomicInteger();
    try (var exec = Executors.newVirtualThreadPerTaskExecutor()) {
        IntStream.range(0, N).forEach(i -> {
            exec.submit(() -> { try { gate.await();
                book.submit(order(Side.BUY, "100", 1)).forEach(t -> totalFilledQty.addAndGet(t.qty())); }
                catch (InterruptedException e) { Thread.currentThread().interrupt(); } finally { done.countDown(); } });
            exec.submit(() -> { try { gate.await();
                book.submit(order(Side.SELL, "100", 1)).forEach(t -> totalFilledQty.addAndGet(t.qty())); }
                catch (InterruptedException e) { Thread.currentThread().interrupt(); } finally { done.countDown(); } });
        });
        gate.countDown();
        assertTrue(done.await(10, TimeUnit.SECONDS));
    }
    assertEquals(100, totalFilledQty.get());   // quantity conserved: 100 crossings, 1 unit each
    assertTrue(book.bestBid().isEmpty());
    assertTrue(book.bestAsk().isEmpty());
}
```

Only the aggressing side receives trades from `submit`; the resting side is filled silently — hence `totalFilledQty == 100`, not 200.

### Implement it

Two `NavigableMap`s and a flat index, everything under one lock:

```java
private final NavigableMap<BigDecimal, Deque<Order>> buys  = new TreeMap<>(Comparator.reverseOrder());
private final NavigableMap<BigDecimal, Deque<Order>> sells = new TreeMap<>();
private final Map<UUID, Order> openOrders = new HashMap<>();
private final ReentrantLock lock = new ReentrantLock();

public List<Trade> submit(Order order) {
    Instant now = clock.instant();          // stamp outside the lock; keep the critical section short
    lock.lock();
    try {
        List<Trade> trades = new ArrayList<>();
        int remaining = match(order, trades, now);
        if (remaining > 0) rest(order.withQty(remaining));   // skip this line and you have IOC
        return trades;
    } finally { lock.unlock(); }
}
```

The match loop — walk opposite levels best-first, drain each FIFO queue, stop when the top no longer crosses:

```java
private int match(Order in, List<Trade> trades, Instant now) {
    NavigableMap<BigDecimal, Deque<Order>> opp = in.side() == Side.BUY ? sells : buys;
    int remaining = in.qty();
    while (remaining > 0 && !opp.isEmpty()) {
        var best = opp.firstEntry();
        BigDecimal price = best.getKey();
        boolean crosses = in.side() == Side.BUY
            ? in.price().compareTo(price) >= 0
            : in.price().compareTo(price) <= 0;
        if (!crosses) break;                       // top doesn't cross → nothing deeper will
        Deque<Order> q = best.getValue();
        while (remaining > 0 && !q.isEmpty()) {
            Order rest = q.peek();                  // head = time-priority winner
            int fill = Math.min(remaining, rest.qty());
            UUID buyId  = in.side() == Side.BUY  ? in.id() : rest.id();
            UUID sellId = in.side() == Side.SELL ? in.id() : rest.id();
            trades.add(new Trade(buyId, sellId, fill, price, now));  // print at RESTING price
            remaining -= fill;
            if (rest.qty() == fill) { q.poll(); openOrders.remove(rest.id()); }
            else {                                  // partial: replace head, keep its place
                Order left = rest.withQty(rest.qty() - fill);
                q.removeFirst(); q.addFirst(left);
                openOrders.put(left.id(), left);
            }
        }
        if (q.isEmpty()) opp.remove(price);         // drop drained level — no phantoms
    }
    return remaining;
}

private void rest(Order o) {
    var book = o.side() == Side.BUY ? buys : sells;
    book.computeIfAbsent(o.price(), k -> new ArrayDeque<>()).add(o);
    openOrders.put(o.id(), o);
}
```

`cancel` uses the flat index to jump to the level, removes within it, and drops the level if it drained:

```java
public boolean cancel(UUID id) {
    lock.lock();
    try {
        Order o = openOrders.remove(id);
        if (o == null) return false;
        var book = o.side() == Side.BUY ? buys : sells;
        Deque<Order> level = book.get(o.price());
        if (level != null) {
            level.removeIf(x -> x.id().equals(id));
            if (level.isEmpty()) book.remove(o.price());
        }
        return true;
    } finally { lock.unlock(); }
}
```

**Complexity.** `submit` is O(log p + f) where p is price levels and f is fills produced (each fill is O(1) head work; finding each level is O(log p) but amortised across the walk). `cancel` is O(log p) to locate the level plus O(k) within a shallow level of k orders. `bestBid`/`bestAsk` are O(log p) via `firstKey`. **The key gotcha:** replace the partially-filled head via `withQty` and re-add it at the *front* — mutating in place or re-queuing at the back silently breaks time priority, and the id index would then point at a stale instance.

### Common mistakes & senior signal

- **Wrong trade price.** Printing at the aggressor's limit instead of the resting price. The resting price is the rule (price improvement) — the single most-tested assertion.
- **Losing time priority on partial fill.** Moving the partially filled resting order to the back of the queue, or forgetting to keep its original timestamp. It must stay at the head with only its qty reduced.
- **Phantom levels.** Not removing a level once its deque drains — `bestBid`/`bestAsk` then return a price with no liquidity, and the `TreeMap` bloats.
- **`double` for price, or `==` for comparison.** Money is `BigDecimal`; comparison is `compareTo`. `new BigDecimal("100").equals(new BigDecimal("100.0"))` is even `false` — scale matters, so compare, don't equate.
- **O(n) cancel.** Scanning the whole book by id instead of keeping the flat `UUID → Order` index. Levels are shallow; the book is not.
- **Wrong comparator on bids.** Using natural order on the buy side so `firstEntry()` returns the *lowest* bid. Bids need `reverseOrder()`.
- **Over-locking.** Reaching for per-level locks or a `ConcurrentSkipListMap` "for throughput." The match loop is sequential — the next decision depends on the last fill — so one `ReentrantLock` is both correct and faster.
- **Senior signal:** names `TreeMap<price, ArrayDeque>` + flat index instantly and justifies each choice; stamps the trade timestamp once per submission outside the lock; keeps the residual-rest call as a visible seam for IOC/FOK; and, unprompted, explains scaling by sharding per symbol with single-writer per book (the LMAX Disruptor model) rather than parallelising one book.


## Lock-Free Data Structures — Treiber · Michael-Scott · ABA

### Summary

**What this topic covers**
This is the hardest kata in the set: build three canonical lock-free structures with no `synchronized`, no `ReentrantLock`, no blocking primitive — all thread-safety comes from `AtomicReference` and `AtomicStampedReference` CAS operations. You implement `TreiberStack<E>` (lock-free LIFO via single-pointer CAS), `MichaelScottQueue<E>` (lock-free FIFO — the algorithm inside `java.util.concurrent.ConcurrentLinkedQueue`, using a dummy node, a two-CAS enqueue, and cooperative tail-helping), and `AtomicStampedStack<E>` (the same stack made ABA-safe with a monotonic stamp). The public API is `push`/`pop`/`isEmpty` for the stacks, `enqueue`/`dequeue`/`isEmpty` for the queue, with removals returning `Optional<E>`. You design the node shape, the atomic fields, and every CAS loop yourself, and you write your own tests — including a high-contention stress test that a broken (unsynchronised) implementation cannot pass.

**Mental model**
Every mutating operation is the *same three-step CAS loop*: (1) volatile-read a stable snapshot of the shared reference; (2) compute the proposed next state as a *pure* function of that snapshot — build the new node, thread its `next` at the snapshotted head — with no side effects; (3) `compareAndSet(snapshot, proposed)` — return on success, loop and retry on failure. The `get()` is a volatile read that establishes a happens-before edge; the winning CAS is a volatile write, so all work before it is visible to the next reader. That is how correct visibility is achieved without a monitor. The whole trick is keeping step (2) side-effect-free so a lost CAS just discards a freshly-allocated node and retries against a fresher snapshot. Michael-Scott adds one wrinkle: enqueue touches two memory locations (append to `tail.next`, then swing `tail`), so it needs two CASes and a *helping* rule that lets any thread finish another thread's half-done enqueue — that is what makes it lock-free, not merely obstruction-free.

**Key terms**
- **CAS (compare-and-set)** — atomic "if the value is still X, set it to Y, else fail"; on x86 a single `CMPXCHG`, entirely in user-space.
- **Lock-free** — at least one thread makes progress per round of CAS attempts; the system never stalls behind a suspended thread (distinct from *wait-free*, where every thread finishes in bounded steps).
- **Linearization point** — the single instant an operation appears to take effect; for Treiber push it is the head CAS, for Michael-Scott enqueue it is the `tail.next` append CAS.
- **Immutable node** — `Node.item` and (in the stacks) `Node.next` are `final`; immutability, not style, is what makes reading `node.next` safe without a lock after CAS installs the node.
- **Dummy / sentinel node** — a permanent placeholder node the queue's `head` always points at; the true first element is `head.next`. It removes the empty↔non-empty special case.
- **Two-CAS enqueue** — append CAS (`tail.next`: null→new) then swing CAS (`tail`: old→new); the window between them is the intermediate state.
- **Helping** — any thread observing `tail.next != null` first advances `tail` before its own work, completing a preempted thread's enqueue.
- **Consistency snapshot** — after reading `curTail`/`tailNext` separately, re-read `tail`; if it changed, restart with a fresh snapshot.
- **ABA problem** — a CAS checks only reference identity, so a value that went A→B→A between snapshot and CAS passes spuriously, installing stale state.
- **AtomicStampedReference** — pairs a reference with a monotonic int stamp in one swappable word; `compareAndSet(ref, newRef, stamp, newStamp)` fails if *either* changed.

**Why interviewers ask this**
Lock-free code is where "I know threads" separates from "I understand the memory model". A junior reaches for `synchronized`, or writes a CAS loop that mutates shared state in step (2), or forgets the retry. A senior writes the pure-snapshot loop reflexively, explains *why* the volatile read/write pair gives visibility without a lock, knows the Michael-Scott enqueue is two CASes and can articulate the helping invariant, and can describe ABA precisely — plus why the JVM's GC hides it in most cases and exactly when (object pools, off-heap, native memory) it bites. The tell is whether they can name the linearization point and prove no item is lost or duplicated under contention.

**Common confusions**
- **"Lock-free means faster."** Not always — it means no thread blocks another; under low contention a lock can be simpler and just as fast.
- **"CAS solves everything."** CAS on a single word is easy; the hard part is that Michael-Scott needs to CAS two locations, which forces the helping protocol.
- **"ABA can't happen on the JVM."** With plain GC it usually can't (a live node can't be recycled), but a free-list, object pool, or off-heap allocator reintroduces it immediately.
- **"The stamp just adds a counter."** It changes the CAS's success condition — reference *and* stamp must both match — which is the actual fix.
- **"isEmpty can drive control flow."** It's a point-in-time volatile read; the structure may change the instant after it returns.

**What follows from this topic**
Master this and the rest of the concurrency katas read as variations: `BoundedBlockingQueue` (locks + conditions — the blocking counterpart), `ConcurrentAccountService` (CAS vs lock tradeoffs on shared counters), and any `AtomicReference`-backed state machine. The CAS-loop skeleton here is the same pattern behind `AtomicInteger.updateAndGet`, `LongAdder`, and `ConcurrentLinkedQueue` itself.

### Clarify & design the API

Questions worth asking before writing a line:
- **Return type on removal?** `Optional<E>` (explicit empty, no null-checks) vs `null` sentinel (avoids Optional allocation on hot paths). This kata uses `Optional`.
- **Nulls allowed as elements?** No — rejecting null lets `pop()`/`dequeue()` use `Optional.of` without ambiguity between "empty" and "stored null".
- **Do we need an exact O(1) `size()`?** No. A size counter can't be updated atomically with the head pointer in one CAS, so a lock-free structure only offers `isEmpty()` (a single volatile read). Say this out loud — it's a senior signal.
- **Which structures?** A stack (single CAS), a FIFO queue (Michael-Scott, two CASes + helping), and an ABA-safe stamped stack.

Commit to these signatures first:

```java
class TreiberStack<E> {
    void push(E item);          // rejects null
    Optional<E> pop();          // empty Optional if empty
    boolean isEmpty();
}

class MichaelScottQueue<E> {
    void enqueue(E item);       // rejects null
    Optional<E> dequeue();      // empty Optional if empty
    boolean isEmpty();
}

class AtomicStampedStack<E> {   // same API as TreiberStack, ABA-safe
    void push(E item);
    Optional<E> pop();
    boolean isEmpty();
}
```

Node shape: immutable `Node(E item, Node<E> next)` with `final` fields for the stacks; for Michael-Scott, `item` is `final` but `next` is an `AtomicReference<Node<E>>` so it can be CAS'd null→node (that append CAS is enqueue's linearization point).

### Write the tests

Write these **first** — they pin the spec and the stress test is the whole point of the kata: an unsynchronised implementation passes the single-threaded cases and fails here. Group them: basic contract → core ordering → edge/validation → concurrency stress.

**Basic contract + ordering (single-threaded).** Stack is LIFO, queue is FIFO:

```java
@Test
void lifo_order_single_threaded() {
    var stack = new TreiberStack<Integer>();
    stack.push(1); stack.push(2); stack.push(3);
    assertEquals(3, stack.pop().orElseThrow());
    assertEquals(2, stack.pop().orElseThrow());
    assertEquals(1, stack.pop().orElseThrow());
}

@Test
void fifo_order_single_threaded() {
    var q = new MichaelScottQueue<Integer>();
    q.enqueue(1); q.enqueue(2); q.enqueue(3);
    assertEquals(1, q.dequeue().orElseThrow());
    assertEquals(2, q.dequeue().orElseThrow());
    assertEquals(3, q.dequeue().orElseThrow());
}
```

**Edge + argument validation.** Empty removal returns `Optional.empty()` (never throws); null is rejected; `isEmpty()` tracks state; interleaving enqueue/dequeue exercises the dummy-node path where head and tail briefly coincide:

```java
@Test
void pop_on_empty_returns_empty_optional() {
    assertTrue(new TreiberStack<String>().pop().isEmpty());
}

@Test
void null_enqueue_rejected_with_npe() {
    var q = new MichaelScottQueue<String>();
    assertThrows(NullPointerException.class, () -> q.enqueue(null));
}

@Test
void alternating_enqueue_dequeue_maintains_fifo() {
    var q = new MichaelScottQueue<Integer>();
    q.enqueue(10);
    assertEquals(10, q.dequeue().orElseThrow()); // drains to empty, head == tail
    q.enqueue(20); q.enqueue(30);
    assertEquals(20, q.dequeue().orElseThrow());
    assertEquals(30, q.dequeue().orElseThrow());
    assertTrue(q.isEmpty());
}
```

**The stress test — the heart.** Conservation of elements under heavy contention: N producers each push a *globally unique* disjoint range; N consumers collectively pop exactly `total` items, coordinated by a shared `AtomicInteger` budget so exactly `total` pops happen regardless of scheduling. A `CountDownLatch` gate releases everyone at once for maximum contention; consumers spin-`yield` when the structure is transiently empty. Assert the multiset out equals the multiset in — no lost items (a failed CAS that wasn't retried), no duplicates (two threads winning on the same node). This is the only test that catches a broken CAS loop, and for `AtomicStampedStack` it's the observable proxy for ABA-safety (a stamp stuck at 0 would let stale snapshots CAS through and produce duplicates/losses here):

```java
@Test
void concurrent_push_pop_no_lost_or_duplicated_items() throws InterruptedException {
    final int N_PROD = 8, N_CONS = 8, PER = 500, total = N_PROD * PER;
    var stack = new TreiberStack<Integer>();
    var gate = new CountDownLatch(1);
    var done = new CountDownLatch(N_PROD + N_CONS);
    var popped = new ConcurrentLinkedQueue<Integer>();
    var budget = new AtomicInteger(total);

    try (var exec = Executors.newVirtualThreadPerTaskExecutor()) {
        for (int p = 0; p < N_PROD; p++) {
            final int offset = p * PER;
            exec.submit(() -> {
                try { gate.await();
                    for (int j = 0; j < PER; j++) stack.push(offset + j);
                } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
                finally { done.countDown(); }
            });
        }
        for (int c = 0; c < N_CONS; c++) {
            exec.submit(() -> {
                try { gate.await();
                    while (budget.getAndDecrement() > 0) {
                        Integer item;
                        do { item = stack.pop().orElse(null);
                             if (item == null) Thread.yield();
                        } while (item == null);
                        popped.offer(item);
                    }
                } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
                finally { done.countDown(); }
            });
        }
        gate.countDown();
        assertTrue(done.await(10, TimeUnit.SECONDS), "did not finish in time");
    }

    assertEquals(total, popped.size(), "no items lost or created");
    var freq = new HashMap<Integer, Integer>();
    for (Integer v : popped) {
        assertTrue(v >= 0 && v < total, "value in range");
        freq.merge(v, 1, Integer::sum);
    }
    assertEquals(total, freq.size(), "duplicates indicate a CAS bug");
    freq.values().forEach(count -> assertEquals(1, count, "each value exactly once"));
}
```

The same harness, retargeted, drives the Michael-Scott queue (asserting every enqueued item is dequeued exactly once — this also exercises the tail-helping path under concurrent enqueuers) and the `AtomicStampedStack`.

### Implement it — TreiberStack (single-CAS)

The entire mutable state is one `AtomicReference<Node<E>>` head. Push and pop are the three-step loop. O(1) per operation (amortised over retries, which are near-zero in practice):

```java
private static final class Node<E> {
    final E item; final Node<E> next;
    Node(E item, Node<E> next) { this.item = item; this.next = next; }
}
private final AtomicReference<Node<E>> head = new AtomicReference<>(null);

public void push(E item) {
    if (item == null) throw new NullPointerException("item must not be null");
    while (true) {
        Node<E> oldHead = head.get();               // (1) snapshot
        Node<E> newNode = new Node<>(item, oldHead); // (2) pure: build node at snapshot
        if (head.compareAndSet(oldHead, newNode)) return; // (3) commit or retry
    }
}

public Optional<E> pop() {
    while (true) {
        Node<E> oldHead = head.get();
        if (oldHead == null) return Optional.empty();     // empty: no CAS needed
        Node<E> newHead = oldHead.next;                   // final field, safe read
        if (head.compareAndSet(oldHead, newHead)) return Optional.of(oldHead.item);
    }
}
public boolean isEmpty() { return head.get() == null; }
```

Key gotcha: build the new node **inside** the loop from the *current* snapshot. If a CAS fails, the stale node is discarded and reallocated against the fresher head — young-gen GC makes that allocation nearly free.

### Implement it — MichaelScottQueue (two-CAS + helping)

Constructor installs a shared dummy node so `head` and `tail` both start on it. Enqueue appends then swings; dequeue reads `head.next`'s value then advances head. Both re-read after the split snapshot to detect a concurrent change. O(1) per op.

```java
private static final class Node<E> {
    final E item;
    final AtomicReference<Node<E>> next = new AtomicReference<>(null);
    Node(E item) { this.item = item; }
}
public MichaelScottQueue() {
    Node<E> dummy = new Node<>(null);
    head = new AtomicReference<>(dummy);
    tail = new AtomicReference<>(dummy);
}

public void enqueue(E item) {
    if (item == null) throw new NullPointerException("item must not be null");
    Node<E> newNode = new Node<>(item);
    while (true) {
        Node<E> curTail = tail.get();
        Node<E> tailNext = curTail.next.get();
        if (curTail != tail.get()) continue;              // inconsistent snapshot, restart
        if (tailNext != null) {
            tail.compareAndSet(curTail, tailNext);         // HELP: finish someone's swing
        } else if (curTail.next.compareAndSet(null, newNode)) { // append = linearization point
            tail.compareAndSet(curTail, newNode);          // swing (may be done by a helper)
            return;
        }
    }
}

public Optional<E> dequeue() {
    while (true) {
        Node<E> curHead = head.get();
        Node<E> curTail = tail.get();
        Node<E> headNext = curHead.next.get();
        if (curHead != head.get()) continue;
        if (curHead == curTail) {
            if (headNext == null) return Optional.empty();  // truly empty
            tail.compareAndSet(curTail, headNext);          // tail lags: help, then retry
        } else {
            E value = headNext.item;                        // read BEFORE the CAS
            if (head.compareAndSet(curHead, headNext)) return Optional.of(value);
        }
    }
}
```

Key gotchas: the append CAS is the linearization point (the item is logically in the queue the instant it succeeds, even though `tail` still lags); *any* thread seeing `tail.next != null` must help swing `tail` before its own work — that is what upgrades the algorithm from obstruction-free to lock-free. Read the dequeued value from `headNext.item` before the head CAS, because after it `curHead` is detached.

### Implement it — AtomicStampedStack (ABA fix)

Structurally identical to Treiber, but head is an `AtomicStampedReference<Node<E>>` initialised to `(null, 0)`. Read reference and stamp together via `get(int[])`; the new stamp is always `oldStamp + 1`; the four-arg CAS fails if *either* changed. A recycled node with matching identity but a stale generation is correctly rejected:

```java
private final AtomicStampedReference<Node<E>> head =
        new AtomicStampedReference<>(null, 0);

public void push(E item) {
    if (item == null) throw new NullPointerException("item must not be null");
    int[] stampHolder = new int[1];
    while (true) {
        Node<E> oldHead = head.get(stampHolder);          // ref + stamp read atomically
        int oldStamp = stampHolder[0];
        Node<E> newNode = new Node<>(item, oldHead);
        if (head.compareAndSet(oldHead, newNode, oldStamp, oldStamp + 1)) return;
    }
}

public Optional<E> pop() {
    int[] stampHolder = new int[1];
    while (true) {
        Node<E> oldHead = head.get(stampHolder);
        int oldStamp = stampHolder[0];
        if (oldHead == null) return Optional.empty();     // no-op pop consumes no generation
        if (head.compareAndSet(oldHead, oldHead.next, oldStamp, oldStamp + 1))
            return Optional.of(oldHead.item);
    }
}
public boolean isEmpty() { return head.getReference() == null; }
```

Key gotcha: read both values with a single `get(stampHolder)` — two separate calls could straddle another thread's CAS and observe a mismatched pair. The stamp is a 32-bit int (wrap is a non-issue at interview scale); production systems that need more use 64-bit stamps or hazard pointers.

### Common mistakes & senior signal

- **Mutating shared state in step (2).** The proposed-next-state computation must be pure — build a detached node, don't touch `head`/`tail` until the CAS. A lost CAS must be a cheap no-op that just retries.
- **Forgetting to retry.** `if (cas(...)) return;` with no surrounding `while (true)` silently drops operations under contention — the stress test catches this, single-threaded tests don't.
- **Skipping the helping path in Michael-Scott.** Omitting the "advance tail if `tail.next != null`" branch makes the queue merely obstruction-free: a single preempted enqueuer can stall every other thread. Seniors state the helping invariant explicitly.
- **Combining the two enqueue CASes.** They touch different memory locations (`tail.next` and `tail`) and cannot be atomic together — that's *why* the intermediate state and helping exist.
- **Reading the dequeued value after the head CAS.** `curHead` is detached post-CAS; capture `headNext.item` first.
- **Claiming ABA "can't happen on the JVM" as absolute.** True only under plain GC; a free-list, object pool, or off-heap allocator reintroduces it. `AtomicStampedReference` is the standard fix; `AtomicMarkableReference` (a single mark bit) is *not* sufficient because the mark can cycle back.
- **Promising an exact lock-free `size()`.** Not achievable with a single CAS; offer `isEmpty()` and explain the tradeoff — a strong senior tell.
- **Testing only single-threaded.** Without a high-contention conservation stress test (no lost/duplicated elements), the implementation is unverified where it matters most.



## Feed Parser — Streaming, Zero-Copy & Malformed-Line Handling

### Summary

**What this topic covers**
This kata asks you to turn a streaming market-data feed of pipe-delimited text lines — `SYMBOL|BID|ASK|QTY`, one record per line — into a **lazy** `Stream<ParsedLine>`, where each non-noise line becomes either an `Ok` (a validated, typed `Quote`) or an `Err` (a `ParseError` that says *what* was wrong and *where*). Blank and `#`-comment lines are skipped but still counted, so every error carries a **1-based physical line number**. You implement two static methods on `FeedParser`: `parse(Stream<String>)` (the lazy mapping) and `parseAll(Stream<String>)` (a convenience terminal that drains into `(List<Quote>, List<ParseError>)`). It is the canonical "parse a feed without exceptions and without buffering the whole file" question, and it separates people who reach for `try/catch` around a `readLine` loop from people who model errors as values in a lazy pipeline.

**Mental model**
A feed parser is a **pure transformation over a stream of lines** with three concerns kept strictly separate: *classification* (is this line noise, a good record, or a bad record?), *coercion* (turn four strings into `String`/`double`/`double`/`long`), and *positioning* (which physical line did this come from?). The trap is that all three want to live in one imperative loop with a mutable counter and a `try/catch` that throws on the first bad tick — which is exactly wrong, because a single fat-fingered line must never abort the stream and lose the thousand good ticks behind it. So you invert it: errors become in-band **values** (a sealed `ParsedLine` with `Ok`/`Err` arms), and the transformation stays **lazy** — an input `Stream<String>` maps to a `Stream<ParsedLine>` element by element, so the terminal operation decides how much to pull (`findFirst`, `limit`, a full drain). The one piece of mutable state you genuinely need is the line counter, and because `Stream` has no element index you thread it yourself with an `AtomicInteger` incremented once per input line — correct only because the pipeline is ordered and sequential.

**Key terms**
- **Lazy pipeline** — `parse` builds a `Stream<ParsedLine>` that does no work until a terminal op pulls; one line flows through end-to-end at a time, nothing is materialised.
- **`mapMulti`** — a Java 16+ stream op that emits *zero-or-one* (or many) outputs per input via a `downstream.accept(...)` callback; the clean lazy way to *drop* the skipped noise lines.
- **Physical line number** — 1-based position in the raw feed, counting *every* line including skipped blanks/comments, so an operator eyeballing the file finds the bad tick.
- **Result type** — modelling an outcome as a value (`Ok`/`Err`) instead of a return-or-throw; errors are expected, not exceptional.
- **Sealed interface** — `ParsedLine permits Ok, Err`; the compiler knows the closed set so a `switch` over it is checkably exhaustive.
- **`split("\\|", -1)`** — split on the (regex-escaped) pipe with a **negative limit** so trailing empty fields are *kept*, not silently discarded.
- **Short-circuiting validation** — check field-count → symbol → bid → ask → qty and report only the *first* failure.
- **Non-negative guard** — `qty` must be `>= 0`; a separate explicit check because `Long.parseLong("-5")` happily succeeds.

**Why interviewers ask this**
Feed parsing looks trivial and is a minefield of exactly the judgement calls a senior makes daily. A junior writes a `BufferedReader` loop that throws on the first malformed line (losing the rest of the feed), forgets that `split` drops trailing empties, and uses the loop index as the "line number" (wrong the moment a comment is skipped). A mid-level returns a `List<ParsedLine>` with errors as values and gets the validation order right. A senior does three more things: keeps the pipeline **lazy** so an unbounded live-socket source or a day's worth of ticks works without buffering, and can say *why* (`findFirst`/`limit` must short-circuit); models the outcome as a **sealed** type and handles it with an exhaustive `switch` so no outcome is ever dropped; and knows the two silent-corruption traps cold — `split`'s trailing-empty discard and `parseLong` accepting negatives. Bonus signal: naming why you must never `parallel()` this stream (the `AtomicInteger` counter assumes encounter order).

**Common confusions**
- *"A bad line should throw."* No — on a streaming feed, malformed ticks are *expected*. One `Err` value must not tear down the stream; return it in-band.
- *"`split("\\|")` is fine."* It discards trailing empties: `"TOO|1.0|2.0|".split("\\|")` is length 3, not 4 — a malformed line silently mis-classified. Use limit `-1`.
- *"The line number is the record index."* No — it's the *physical* line, counting skipped blanks/comments, so line 6 means the sixth line of the raw file.
- *"`parseLong` rejects negatives."* It returns `-5` happily; the non-negative rule is a separate explicit guard, not a parse failure.
- *"I'll collect to a `List` first, then process."* That defeats laziness — the feed may be unbounded (a live socket) or huge (a day's ticks). Map stream-to-stream.
- *"Blank lines can be filtered out and ignored."* They must be *dropped from the output but still counted*, or every later error's line number drifts.

**What follows from this topic**
The "errors as values, not exceptions" pattern is the gateway to `Optional`, `Either`/`Result` types, and Java's sealed-interface-plus-exhaustive-`switch` idiom that reappears in every state machine and protocol decoder. The lazy stream-to-stream mapping is the same shape as backpressure-aware reactive pipelines (`Flow`, Reactor, RxJava) and log/ETL processing, where materialising the whole input is equally fatal. And the parsing discipline — validate in a fixed order, report the first failure with position, coerce only after validating — is exactly what a production feed handler, a CSV/FIX/JSON decoder, or a compiler front-end does; the difference between this kata and a real market-data adapter is a quoted-field escape rule and a `BufferedReader.lines()` source, both natural extensions.

### Clarify & design the API

Before touching a stream, pin the contract with a few questions:

- **Line format?** Exactly `SYMBOL|BID|ASK|QTY` — split on `|` into **exactly four** fields; anything else is `WRONG_FIELD_COUNT`.
- **What is noise?** After trimming, a **blank** line or one **starting with `#`** is skipped — neither a record nor an error — but it still **advances the line counter**.
- **Errors: throw or return?** Return. A malformed line is an `Err` *value*, not an exception; the stream survives.
- **What position does an error carry?** The **1-based physical** line number, counting every input line including skipped ones.
- **Validation order?** Field-count → empty-symbol → bid → ask → qty, short-circuiting on the **first** failure (say this out loud — it's directly testable).
- **Is `qty` signed?** No — non-negative; zero is valid.
- **Must `parse` be lazy?** Yes — `Stream<String>` → `Stream<ParsedLine>` with no materialisation, so short-circuiting terminals and unbounded sources work. Never `parallel()`.

Commit to a small surface — two static methods over provided domain types:

```java
public final class FeedParser {
    public static Stream<ParsedLine> parse(Stream<String> lines);      // the lazy mapping
    public static ParseSummary parseAll(Stream<String> lines);         // drain → (quotes, errors)
    public record ParseSummary(List<Quote> quotes, List<ParseError> errors) {}
}

public record Quote(String symbol, double bid, double ask, long qty) {}
public record ParseError(int line, ErrorKind kind) {}
public enum ErrorKind { WRONG_FIELD_COUNT, EMPTY_SYMBOL, INVALID_BID, INVALID_ASK, INVALID_QTY }

public sealed interface ParsedLine permits ParsedLine.Ok, ParsedLine.Err {
    record Ok(int line, Quote quote) implements ParsedLine {}
    record Err(ParseError error)     implements ParsedLine {}
}
```

The enum's declaration order mirrors the validation order on purpose; the `sealed` interface is what lets the caller handle both arms exhaustively.

### Write the tests

Write these **first**. They pin the spec, grouped like the reference `FeedParserTest`: the canonical feed → each single-error case → validation order → laziness.

**Group 1 — the canonical feed (the whole contract in one fixture).** One shared feed exercises skip-counting, good records, and every error kind with its physical line. Assert quotes and errors *separately* so a failure localises.

```java
private static Stream<String> canonicalFeed() {
    return Stream.of(
        "# market data feed",      // line 1: comment  → skipped
        "LIV-MUN|1.95|2.05|1000",  // line 2: quote
        "",                         // line 3: blank    → skipped
        "ARS-CHE|1.50|1.60|500",   // line 4: quote
        "|1.0|2.0|10",             // line 5: EMPTY_SYMBOL
        "BAD|x|2.0|10",            // line 6: INVALID_BID
        "TOO|1.0|2.0",             // line 7: WRONG_FIELD_COUNT
        "NEG|1.0|2.0|-5");         // line 8: INVALID_QTY
}

@Test void canonical_feed_yields_exact_errors_with_physical_line_numbers() {
    var summary = FeedParser.parseAll(canonicalFeed());
    assertEquals(List.of(
            new ParseError(5, ErrorKind.EMPTY_SYMBOL),
            new ParseError(6, ErrorKind.INVALID_BID),
            new ParseError(7, ErrorKind.WRONG_FIELD_COUNT),
            new ParseError(8, ErrorKind.INVALID_QTY)),
        summary.errors());
}
```

This one test is the spine: lines 5–8 prove the counter kept ticking through the skipped comment (line 1) and blank (line 3). A record-index counter would report `(3, EMPTY_SYMBOL)` and fail here.

**Group 2 — one bad field at a time.** A test per `ErrorKind`, each on a one-line feed so the line number is always 1 and the *kind* is what's under test.

```java
@Test void wrong_field_count_too_many_fields() {
    // Trailing empty field must be counted (split limit -1) — this is 5 fields, not 4.
    var summary = FeedParser.parseAll(Stream.of("MANY|1.0|2.0|10|"));
    assertEquals(List.of(new ParseError(1, ErrorKind.WRONG_FIELD_COUNT)), summary.errors());
}

@Test void invalid_qty_negative_is_rejected() {
    var summary = FeedParser.parseAll(Stream.of("SYM|1.0|2.0|-5"));
    assertEquals(List.of(new ParseError(1, ErrorKind.INVALID_QTY)), summary.errors());
}

@Test void zero_qty_is_valid() {
    var summary = FeedParser.parseAll(Stream.of("SYM|1.0|2.0|0"));
    assertEquals(List.of(new Quote("SYM", 1.0, 2.0, 0)), summary.quotes());
}
```

The `too_many_fields` test is the one that fails a naive `split("\\|")` (limit 0 drops the trailing empty → length 4 → mis-parsed). The `negative` and `zero` pair pins the non-negative guard exactly.

**Group 3 — validation order (short-circuit on the first failure).** Feed a line where *every* field is bad and assert only the first check fires.

```java
@Test void validation_order_reports_only_the_first_failure() {
    // 4 fields (ok), symbol empty, bid non-numeric, qty negative → empty-symbol wins.
    var summary = FeedParser.parseAll(Stream.of("|x|y|-5"));
    assertEquals(List.of(new ParseError(1, ErrorKind.EMPTY_SYMBOL)), summary.errors());
}

@Test void bid_is_checked_before_ask() {
    var summary = FeedParser.parseAll(Stream.of("SYM|x|y|10"));   // both non-numeric → bid wins
    assertEquals(List.of(new ParseError(1, ErrorKind.INVALID_BID)), summary.errors());
}
```

**Group 4 — laziness (prove the pipeline short-circuits).** Drive `parse` directly, pin the sealed arms, then prove an *infinite* source terminates under `findFirst`.

```java
@Test void parse_stream_produces_ok_and_err_arms_with_line_numbers() {
    List<ParsedLine> parsed = FeedParser.parse(canonicalFeed()).toList();
    assertEquals(6, parsed.size());  // 2 skipped, 6 emitted
    assertEquals(new ParsedLine.Ok(2, new Quote("LIV-MUN", 1.95, 2.05, 1000)), parsed.get(0));
    assertEquals(new ParsedLine.Err(new ParseError(5, ErrorKind.EMPTY_SYMBOL)), parsed.get(2));
}

@Test void parse_is_lazy_and_supports_short_circuiting() {
    // An infinite stream of valid records must still terminate — proof the pipeline never buffers.
    Quote first = FeedParser.parse(Stream.generate(() -> "SYM|1.0|2.0|1"))
        .map(p -> ((ParsedLine.Ok) p).quote())
        .findFirst().orElseThrow();
    assertEquals(new Quote("SYM", 1.0, 2.0, 1), first);
}
```

The `Stream.generate(...)` test is the one that hangs forever (or OOMs) if you `collect` internally. If it returns, your `parse` is genuinely lazy. Plus the small cases: `empty_input_yields_no_quotes_and_no_errors`, `comment_and_blank_only_feed_yields_nothing`, and `surrounding_whitespace_on_a_record_line_is_trimmed_before_parsing`.

### Implement it

**`parse` — a lazy `mapMulti` threading an `AtomicInteger`.** The counter increments once per input line *before* the skip test, so skipped lines still advance it. `mapMulti` emits nothing for noise (`return` without `accept`) and exactly one `ParsedLine` for a record — all without materialising the stream.

```java
public static Stream<ParsedLine> parse(Stream<String> lines) {
    // One increment per input line, in encounter order. Correct ONLY because the pipeline is
    // ordered + sequential — do not parallelise this stream.
    AtomicInteger lineNo = new AtomicInteger(0);
    return lines.<ParsedLine>mapMulti((raw, downstream) -> {
        int line = lineNo.incrementAndGet();
        String trimmed = raw.trim();
        if (trimmed.isEmpty() || trimmed.startsWith("#")) return;   // skip, but counter advanced
        downstream.accept(parseLine(trimmed, line));
    });
}
```

`mapMulti` is the clean lazy way to drop noise; a `map` returning `Optional<ParsedLine>` then `.filter(Optional::isPresent).map(Optional::get)` also works but allocates and reads worse.

**`parseLine` — validate in a fixed order, coerce only after validating, short-circuit on the first failure.** Split with limit `-1` so the field count is exact and trailing empties survive.

```java
private static ParsedLine parseLine(String trimmed, int line) {
    String[] fields = trimmed.split("\\|", -1);          // -1 keeps trailing empty fields
    if (fields.length != 4) return err(line, ErrorKind.WRONG_FIELD_COUNT);

    String symbol = fields[0];
    if (symbol.isEmpty()) return err(line, ErrorKind.EMPTY_SYMBOL);

    double bid;
    try { bid = Double.parseDouble(fields[1]); }
    catch (NumberFormatException e) { return err(line, ErrorKind.INVALID_BID); }

    double ask;
    try { ask = Double.parseDouble(fields[2]); }
    catch (NumberFormatException e) { return err(line, ErrorKind.INVALID_ASK); }

    long qty;
    try { qty = Long.parseLong(fields[3]); }
    catch (NumberFormatException e) { return err(line, ErrorKind.INVALID_QTY); }
    if (qty < 0) return err(line, ErrorKind.INVALID_QTY);   // parseLong accepts "-5" — guard it

    return new ParsedLine.Ok(line, new Quote(symbol, bid, ask, qty));
}
```

The `try/catch` is a local coercion detail, *not* control flow that escapes a line — each `catch` returns an `Err` value. The non-negative check is a separate statement because a successful parse of `"-5"` is the trap.

**`parseAll` — one exhaustive `switch` over the sealed type, built on `parse`.** Reuse the lazy pipeline so there's a single source of truth for the rules; the compiler rejects a missing arm.

```java
public static ParseSummary parseAll(Stream<String> lines) {
    List<Quote> quotes = new ArrayList<>();
    List<ParseError> errors = new ArrayList<>();
    parse(lines).forEach(parsed -> {
        switch (parsed) {                                  // exhaustive: no default needed
            case ParsedLine.Ok ok  -> quotes.add(ok.quote());
            case ParsedLine.Err er -> errors.add(er.error());
        }
    });
    return new ParseSummary(quotes, errors);
}
```

No `default` arm: because `ParsedLine` is `sealed`, adding a third outcome later would break *this* `switch` at compile time — which is the point.

### Common mistakes & senior signal

- **Throwing on a bad line.** A `try/catch` around the whole loop that rethrows loses every good tick after the first malformed one. Errors are *values* (`Err`); the stream must survive them.
- **`split("\\|")` without the `-1` limit.** The default drops trailing empties, so `"TOO|1.0|2.0|"` becomes length 3 and a malformed line is silently mis-classified. Always pass `-1` — and escape the pipe (`"\\|"`), since a bare `|` is regex alternation.
- **Using the record index as the line number.** The counter must advance on *every* line, including skipped blanks/comments, or every later error's position drifts. Increment before the skip test.
- **`parseLong` accepting negatives.** `Long.parseLong("-5")` returns `-5` — a successful parse. The non-negative rule is a separate explicit `if (qty < 0)` guard, not a caught exception.
- **Materialising the stream.** Collecting to a `List` internally (or calling `.collect(...)` before returning) breaks laziness — `findFirst`/`limit` no longer short-circuit and an unbounded source hangs. Map stream-to-stream.
- **`parallel()` on the pipeline.** The `AtomicInteger` counter is only correct in encounter order; a parallel stream shuffles increments and scrambles line numbers. Keep it ordered and sequential.
- **A nullable `Quote` plus a side-channel error list.** Easy to forget an outcome. A `sealed ParsedLine` with an exhaustive `switch` makes the compiler prove every case is handled.

**Senior tells:** reaches for `mapMulti` (or a clearly-justified `map`+`filter`) to stay lazy and can explain *why* laziness matters for a live-socket feed; names the two silent-corruption traps (`split` trailing-empty, `parseLong` negatives) before being prompted; models the outcome as a sealed type for exhaustiveness rather than nulls; notes that `bid`/`ask` are `double` for the kata but a real pricing engine uses `BigDecimal`; and, asked "what would you actually ship?", extends to a quoted/escaped-`|` field rule and a `BufferedReader.lines()` source adapter for a real socket.
