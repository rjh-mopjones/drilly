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

## Rolling Window Aggregator

### Summary

**What this topic covers**
This kata builds a `SlidingWindow` that keeps a rolling count / sum / weighted average over the *last* `windowMillis` of an injected clock. Values arrive stamped with a millisecond timestamp — possibly out of order — and every read (`count`, `sum`, `weightedAverage`, `retainedBuckets`) reports only the values still inside the current window. This is the shape behind a rolling traded-volume counter, a moving-average price, or the accounting side of a rate limiter: cheap, exact reads over a moving time horizon without rescanning history on every call.

**Mental model**
Two decisions do all the work. First, the clock is injected as a `LongSupplier` of millis, never `System.currentTimeMillis()` inline, so a test can pin `now` with an `AtomicLong` and move it deterministically. Second, storage is keyed by **timestamp**, not arrival order: a `TreeMap<Long, Bucket>` where each bucket aggregates every value that landed in that millisecond (count, sum, weight, weighted-sum). Four running totals mirror the live buckets so every read is an O(1) totals read, not an O(n) walk of the map. Eviction is lazy — `evict(now)` runs at the top of every `add` and every read, pruning `buckets.headMap(edge, true)` (everything at or before the trailing edge) and subtracting each pruned bucket from the totals before removing it. There is no background sweeper thread.

**Key terms**
- **trailing edge** — the old boundary of the window, `now - windowMillis`; a value with `ts <= edge` has expired.
- **leading edge** — the window's boundary at `now`; a value with `ts > now` is in the future and rejected.
- **boundary rule** — a value is in-window iff `now - windowMillis < ts <= now`: trailing edge **exclusive**, leading edge **inclusive**.
- **lazy eviction** — pruning happens on demand (every `add`/read), not on a timer; between calls, expired buckets simply sit there until the next touch.
- **bucket** — one millisecond's worth of aggregate (`count`, `sum`, `weight`, `weighted`), not a list of raw events — this is what bounds memory.
- **running totals** — four fields (`totalCount`, `totalSum`, `totalWeight`, `totalWeighted`) kept in sync with the live buckets so reads never rescan.
- **weighted average** — `Σ(value·weight) / Σ(weight)`; `OptionalDouble.empty()` when the window is empty or total weight is zero.

**Why interviewers ask this**
It looks like "just a ring buffer with a timestamp," but three traps separate a working answer from a correct one: the injected clock (so the test suite doesn't need real sleeps), the exact-inclusive/exclusive boundary (an off-by-one here is a silent data bug, not a crash — a value bounces in and out of the count depending on which edge you got backwards), and keying by timestamp rather than arrival order (a head-eviction design that assumes monotonically increasing arrival breaks the instant an event arrives late). A senior candidate states the boundary rule out loud before coding and picks the bucket-per-timestamp structure specifically because it tolerates out-of-order arrival for free.

**Common confusions**
- *"Just keep a queue of raw events and evict from the front."* — Works only if timestamps arrive in non-decreasing order; a late (but still in-window) event breaks front-eviction because it does not belong at the tail.
- *"Recompute the sum from the map on every read."* — Correct but O(bucket count) per read; the running totals make reads O(1) at the cost of keeping them in sync during eviction.
- *"windowMillis long is the same as an inclusive `>=` boundary."* — No; this design is `now - window < ts <= now`. Get the inequality direction backwards and a value at exactly the edge silently double-counts or vanishes one call early/late.
- *"High event rate means high memory."* — Not with per-millisecond buckets: a million events landing in the same millisecond collapse into one bucket, so retention is bounded by `windowMillis`, independent of event rate.

**What follows from this topic**
The same lazy-eviction-plus-running-totals idea underpins a token-bucket **[[ratelimit]]** and a **[[cache]]** with TTL eviction. Swapping millisecond buckets for coarser (per-second) buckets trades memory for boundary accuracy — the granularity/accuracy trade-off worth naming unprompted. A count-based ("last N events") window instead of time-based would swap the `TreeMap` for a ring/deque since the boundary becomes ordinal, not temporal. Concurrent producers would need to guard the totals + map with a single lock or shard by key and merge on read.

### Clarify & design the API

Questions to settle before writing a line of logic:

- **What does the window aggregate?** Count, sum, and a weighted average — so each recorded value carries an optional weight (default `1.0`).
- **Where does time come from?** Never read the wall clock inline; take a `LongSupplier` of millis in the constructor so tests can drive it with an `AtomicLong`.
- **Exact boundary?** Nail down which edge is inclusive before coding: `now - windowMillis < ts <= now` — trailing exclusive, leading inclusive. A value exactly `windowMillis` old has *just* expired.
- **Out-of-order arrival?** Must be tolerated — a value can arrive after a later-timestamped one and still land correctly in the window, as long as its own `ts` is still in range.
- **Future timestamps?** Reject them (`ts > now`) rather than silently accepting a value that would only become "in window" later.
- **Empty-window reads?** `count`/`sum` return `0`/`0.0`; `weightedAverage` returns `OptionalDouble.empty()` — no divide-by-zero, no sentinel doubles.
- **Memory bound?** Must not grow with event *rate* — only with window length. Expose it (`retainedBuckets()`) so the bound is testable, not just asserted in prose.

Commit to this surface:

```java
public final class SlidingWindow {
    public SlidingWindow(long windowMillis, LongSupplier nowMillis);

    public boolean add(long tsMillis, double value);                  // unit weight
    public boolean add(long tsMillis, double value, double weight);   // returns false if out of range

    public long count();
    public double sum();
    public OptionalDouble weightedAverage();
    public int retainedBuckets();
}
```

### Write the tests

Write these first — they pin the boundary rule, the out-of-order tolerance, and the memory bound before a line of implementation exists. Group them: empty state, basic count/sum, the boundary itself, weighted average, out-of-order arrival, and the retention bound.

**Empty window and basic in/out-of-window behaviour.**

```java
private final AtomicLong clock = new AtomicLong(2_000);
private final SlidingWindow window = new SlidingWindow(1_000, clock::get);

@Test
void empty_window_reports_zero_and_no_average() {
    assertEquals(0, window.count());
    assertEquals(0.0, window.sum(), 1e-9);
    assertEquals(OptionalDouble.empty(), window.weightedAverage());
    assertEquals(0, window.retainedBuckets());
}

@Test
void values_drop_out_as_the_clock_advances() {
    window.add(1_200, 10.0);
    window.add(1_800, 5.0);
    clock.set(2_500); // window is now (1_500, 2_500]; the ts=1_200 value has expired
    assertEquals(1, window.count());
    assertEquals(5.0, window.sum(), 1e-9);
}
```

**The boundary — this is the test that catches an off-by-one.** Pin both edges explicitly: a value exactly at the trailing edge is OUT, one millisecond newer is IN.

```java
@Test
void trailing_edge_is_exclusive() {
    window.add(1_500, 7.0);
    clock.set(2_499); // edge = 1_499; ts=1_500 > 1_499 is IN
    assertEquals(1, window.count());
    clock.set(2_500); // edge = now - window = 1_500; ts == edge is OUT
    assertEquals(0, window.count());
}

@Test
void future_timestamp_is_rejected() {
    assertFalse(window.add(2_500, 1.0)); // now = 2_000
    assertEquals(0, window.count());
}
```

**Weighted average — the divide-by-zero edge and expiry moving both sums together.**

```java
@Test
void weighted_average_is_sum_of_value_weight_over_sum_of_weight() {
    window.add(1_500, 2.0, 3.0);  // contributes 6 to weighted, 3 to weight
    window.add(1_800, 4.0, 1.0);  // contributes 4 to weighted, 1 to weight
    OptionalDouble avg = window.weightedAverage();
    assertTrue(avg.isPresent());
    assertEquals(10.0 / 4.0, avg.getAsDouble(), 1e-9);
}

@Test
void zero_total_weight_yields_empty_average() {
    window.add(1_500, 5.0, 0.0);
    assertEquals(1, window.count());
    assertEquals(OptionalDouble.empty(), window.weightedAverage());
}
```

**Out-of-order arrival — the case a naive head-eviction design cannot survive.**

```java
@Test
void out_of_order_but_in_window_event_is_counted() {
    window.add(1_800, 1.0);
    window.add(1_200, 2.0); // arrives later but is older; still inside (1_000, 2_000]
    assertEquals(2, window.count());
    assertEquals(3.0, window.sum(), 1e-9);
}

@Test
void event_already_past_the_trailing_edge_is_rejected() {
    clock.set(3_000); // window (2_000, 3_000]
    assertFalse(window.add(1_500, 9.0));
    assertEquals(0, window.count());
}
```

**The retention bound — proves memory scales with window length, not event count.** A million events land in only 1,000 distinct milliseconds; the bucket count must stay near the window size, not near a million.

```java
@Test
void retention_is_bounded_by_the_window_not_the_event_count() {
    for (int i = 0; i < 1_000_000; i++) {
        long ts = 1_001 + (i % 1_000); // timestamps in [1_001, 2_000]
        window.add(ts, 1.0);
    }
    assertTrue(window.retainedBuckets() <= 1_001,
            "retained " + window.retainedBuckets() + " buckets; expected <= window+1");
    assertEquals(1_000_000, window.count());
    assertEquals(1_000_000.0, window.sum(), 1e-3);
}
```

A companion `duplicate_timestamps_aggregate_into_one_bucket` test confirms three `add`s at the same `ts` land in one bucket (`retainedBuckets() == 1`), and a constructor test asserts `IllegalArgumentException` for `windowMillis <= 0`.

### Implement it

A `TreeMap<Long, Bucket>` keyed by timestamp, plus four running totals kept in sync on every add and every eviction. `evict` is the one piece of real logic; every accessor just calls it then reads a total.

```java
private static final class Bucket {
    long count;
    double sum;
    double weight;
    double weighted;
}

private final long windowMillis;
private final LongSupplier now;
private final TreeMap<Long, Bucket> buckets = new TreeMap<>();
private long totalCount;
private double totalSum;
private double totalWeight;
private double totalWeighted;

/** Drop buckets past the trailing edge (ts <= now - window), keeping the running totals in sync. */
private void evict(long nowMs) {
    long edge = nowMs - windowMillis; // in-window iff ts > edge
    Iterator<Map.Entry<Long, Bucket>> it = buckets.headMap(edge, true).entrySet().iterator();
    while (it.hasNext()) {
        Bucket b = it.next().getValue();
        totalCount -= b.count;
        totalSum -= b.sum;
        totalWeight -= b.weight;
        totalWeighted -= b.weighted;
        it.remove();
    }
}

public boolean add(long tsMillis, double value, double weight) {
    long nowMs = now.getAsLong();
    evict(nowMs);
    if (tsMillis > nowMs || tsMillis <= nowMs - windowMillis) {
        return false;
    }
    Bucket b = buckets.computeIfAbsent(tsMillis, k -> new Bucket());
    b.count++; b.sum += value; b.weight += weight; b.weighted += value * weight;
    totalCount++; totalSum += value; totalWeight += weight; totalWeighted += value * weight;
    return true;
}

public OptionalDouble weightedAverage() {
    evict(now.getAsLong());
    return totalWeight == 0.0 ? OptionalDouble.empty() : OptionalDouble.of(totalWeighted / totalWeight);
}
```

- **Why `TreeMap.headMap(edge, true)`:** it hands back exactly the expired sub-map (keys `<= edge`) in one navigable-map call — no manual iteration over the full key set, and `it.remove()` on that view's iterator removes from the backing map.
- **Why keyed by timestamp, not a FIFO queue:** eviction targets "everything at or before the trailing edge" regardless of insertion order, so an out-of-order-but-in-window `add` lands correctly and a stale `add` is rejected outright — arrival order never enters the eviction decision.
- **Complexity:** `add` is O(log b) for the TreeMap touch plus O(k) for evicting k now-expired buckets (amortised O(log b) since each bucket is created and evicted at most once); every read is O(log b) + O(k) for the same eviction, then O(1) off the running totals. Space is O(windowMillis) buckets, independent of event count.
- **Key gotcha:** every accessor — `count`, `sum`, `weightedAverage`, `retainedBuckets`, and `add` itself — calls `evict(now.getAsLong())` first. Skip it on a read-only path and a query right after a big clock jump returns stale totals.

### Common mistakes & senior signal

- **Head-eviction on an arrival-ordered queue.** Assuming timestamps arrive in non-decreasing order and evicting "from the front" works until one event arrives late — then a still-valid value never gets removed, or a stale one lingers at the wrong end. Keying by timestamp in a `TreeMap` sidesteps the assumption entirely; naming why arrival order is irrelevant here is the senior tell.
- **Recomputing sums on every read.** Walking the live buckets on each `count()`/`sum()` call is correct but O(bucket count) per read; the running totals turn every read into O(1) after eviction. Forgetting to keep the totals in sync *during* eviction (subtracting a bucket's contribution before removing it) is the bug that makes this optimization dangerous.
- **Boundary inequality backwards.** Using `>=`/`<` instead of `>`/`<=` (or vice versa) silently shifts every value by one edge — it compiles, most tests pass, and only the exact-boundary test catches it. State the rule (`now - window < ts <= now`) before writing the comparison.
- **Float `==` on weight or sum.** The zero-weight guard in `weightedAverage` compares `totalWeight == 0.0` deliberately — that's safe because weight only ever accumulates from exact adds of `0.0`/positive doubles here, but reach for an epsilon comparison the moment weights could be computed rather than literal inputs; do not generalize a bare `==` to arbitrary float comparisons elsewhere.
- **Unbounded memory per event.** Storing a list of raw `(ts, value)` pairs instead of aggregating per millisecond means retention scales with event *rate*, not window length — the million-events-into-1,000-buckets test exists specifically to catch this regression.
- **Ignoring the granularity/accuracy trade-off.** Per-millisecond buckets are exact to the millisecond; coarsening to per-second buckets would shrink memory further but blur the boundary to within a second. A senior names this trade explicitly rather than treating the bucket width as an arbitrary implementation detail.

## Top-K Over a Stream

### Summary

**What this topic covers**
This kata builds a `TopK` that answers "who are the K highest-scoring keys *right now*" over an unbounded stream of weighted observations — the "biggest movers" panel on a live feed (most-traded selections, top gainers, trending symbols) recomputed on every tick. Every observation is `add(key, weight)`: the key's cumulative score changes by `weight` (which may be negative — a key can fall as well as rise), and `top()` must always answer with the current top `k`, ranked by score descending, ties broken by key ascending so two callers reading the same state see the same order. You design a two-structure model — a map holding the score of truth and a sorted structure holding the ranking — and the one tricky operation: re-ranking a key whose score just changed, in O(log n) rather than a full re-sort.

**Mental model**
A `HashMap<String, Long>` is the source of truth for "what is key X's score right now"; a `TreeSet<Entry>`, ordered by score descending then key ascending, is a live ranking of the same keys. The two must never disagree. Because `Entry` is an immutable record, "the score changed" means "a different tree node" — you cannot mutate a `TreeSet` element in place and expect the tree to re-balance itself; the only correct move is remove-the-old-entry, update-the-map, insert-the-new-entry, and the removal must happen *before* the map is overwritten (you need the *old* score to find the *old* node — looking a key up by itself, after the map already holds the new score, silently misses it and leaves a stale/duplicate node in the tree). `top()` is then a trivial O(k) walk of the set's head. This wins over a bounded min-heap precisely because the requirement is not "insert new values, evict the smallest" but *rescore an arbitrary existing key* — one already in the top K, or one currently outside it, can move either direction on every tick, and a plain `PriorityQueue` has no efficient "find and re-rank this element" operation.

**Key terms**
- **score of truth vs ranking structure** — the map is authoritative for a key's current score; the tree is a derived, always-consistent view sorted for ranking. Two structures, one invariant.
- **`Comparator.comparingLong(...).reversed().thenComparing(...)`** — chained comparator: primary key descending (score), tiebreaker ascending (key) — the idiom for "rank by X, then deterministically by Y".
- **remove-before-reinsert** — because `Entry` is immutable, an "update" on a `TreeSet` element is really delete-old-node, insert-new-node; skipping the delete leaves a ghost entry ranked at the old score.
- **indexed / addressable heap** — a `PriorityQueue` augmented with a key→array-index side map so an arbitrary element can be found and re-heapified; the bookkeeping alternative to a `TreeSet` when memory, not update flexibility, is the constraint.
- **bounded top-K heap** — a fixed-size-K min-heap of current leaders; O(1) memory in K regardless of key-space size, but no efficient way to rescore a key already tracked or check one that fell out.
- **Count-Min Sketch** — a sub-linear-memory approximate frequency counter; trades per-key exactness for a bounded key population when the key space is too large to track exactly (e.g. millions of symbols).
- **deterministic tie-break** — without a secondary sort key, equal scores have an undefined/JVM-dependent order; two readers (or two runs) can disagree on "the" top K.
- **O(log n) rescoring** — both the removal and the reinsertion are single `TreeSet` operations; a naive "collect all entries, sort, take k" `top()` call would be O(n log n) on every read instead of O(log n) on every write.

**Why interviewers ask this**
It tests whether a candidate's first instinct is a `PriorityQueue` (right shape, wrong requirement) or a structure that supports efficient *update*, not just insert/extract-min. The senior signal is naming the actual constraint unprompted — "scores change on existing keys, so I need find-and-rerank, not just push/pop" — and then picking the `HashMap` + `TreeSet` pair because a `TreeSet` is a balanced BST that supports both ordered iteration *and* O(log n) removal by value, whereas a heap array only supports O(log n) removal by *index*, which means either linear search or extra bookkeeping (the indexed heap) to locate the element to update. A second signal is catching the remove-before-map-update ordering bug in code review before it is pointed out.

**Common confusions**
- *"Just use a `PriorityQueue<Entry>`."* — A heap gives you extract-min/max in O(log n), not "find and update the priority of an arbitrary element" — that needs either a linear scan (O(n)) or an indexed heap (more machinery than a `TreeSet`, for the same O(log n) bound).
- *"Update the map first, then remove the stale entry by key."* — By the time you look the key up again, the map already returns the *new* score, so `new Entry(key, scores.get(key))` does not equal the old tree node — the remove misses, and the tree now holds two entries for one key.
- *"Ties don't matter, any order is fine."* — Two callers (or two test runs) observing the same score set can then see different "top K" lists; a leaderboard without a deterministic tiebreaker is not reproducible.
- *"Exact per-key tracking always scales."* — It is O(n) in distinct keys seen; fine for thousands of symbols, not for an unbounded or adversarial key space, where a Count-Min Sketch trades exactness for bounded memory.
- *"`top()` should re-sort every call."* — That moves the O(log n) cost from every write (rare-ish, one per tick) to every read (potentially every render), and throws away the whole point of keeping a sorted structure incrementally maintained.

**What follows from this topic**
The same "map for truth, ordered structure for ranking, remove-before-reinsert on update" shape reappears in the **[[orderbook]]** kata (price-time priority — an order's price level changes, and the book must re-rank it, not just insert/delete), and in the **[[cache]]** kata's LFU eviction (frequency changes on every access, and the eviction candidate is "current minimum," a live-ranked structure by another name). The two named extensions — a bounded indexed min-heap when K is small relative to the key space, and a Count-Min Sketch when the key space itself is too large for exact per-key state — are the standard escalation path for "top-K of a stream" questions once memory, not correctness, becomes the constraint.

### Clarify & design the API

Questions to settle before writing a line of logic:

- **What does "score" mean — cumulative sum, or last value?** Cumulative: every `add(key, weight)` *changes* the score by `weight`, it doesn't replace it. Confirm negative weights are legal (a key can fall).
- **How are ties broken?** Score descending is the obvious primary order; without an explicit secondary key (key ascending) the result is non-deterministic. Nail this down before writing tests — it drives half of them.
- **Can `add` touch a key already inside — or outside — the top K?** Yes, on every call; that single fact is what rules out a plain bounded heap and drives the remove/reinsert design.
- **What about `k == 0` or `k` larger than the number of distinct keys seen?** `k == 0` → always empty; `k` larger than the population → return everything you have, no padding with zeros/nulls.
- **Do unseen keys have a score?** Yes, `0` by convention (`scoreOf` never throws for an unknown key) — matches "hasn't been observed yet," not "is invalid."

Commit to this surface:

```java
public final class TopK {
    public TopK(int k);                                  // k must be >= 0
    public void add(String key, long weight);             // cumulative; weight may be negative
    public void increment(String key);                    // shorthand for add(key, 1)
    public List<Entry> top();                              // score desc, then key asc; size <= k
    public long scoreOf(String key);                       // 0 if never observed
}

public record Entry(String key, long score) {}
```

### Write the tests

Write these first — they pin the ranking contract before a line of `TopK` exists. Group them: ordering basics, the fewer-than-k / larger-than-population edge cases, the tie-break rule, then the re-ranking behaviour that is the actual point of the kata.

**Ordering basics — highest score first, ties settle by key ascending.**

```java
@Test
void top_orders_by_score_descending() {
    TopK topK = new TopK(3);
    topK.add("AAPL", 10);
    topK.add("MSFT", 30);
    topK.add("GOOG", 20);

    assertEquals(
            List.of(new Entry("MSFT", 30), new Entry("GOOG", 20), new Entry("AAPL", 10)),
            topK.top());
}

@Test
void tied_scores_break_ties_by_key_ascending() {
    TopK topK = new TopK(3);
    topK.add("MSFT", 10);
    topK.add("AAPL", 10);
    topK.add("GOOG", 10);

    assertEquals(
            List.of(new Entry("AAPL", 10), new Entry("GOOG", 10), new Entry("MSFT", 10)),
            topK.top());
}
```

**Population smaller / larger than k — no padding, no truncation surprises.**

```java
@Test
void fewer_than_k_distinct_keys_returns_all_of_them() {
    TopK topK = new TopK(5);
    topK.add("AAPL", 10);
    topK.add("MSFT", 20);

    assertEquals(List.of(new Entry("MSFT", 20), new Entry("AAPL", 10)), topK.top());
}

@Test
void k_of_zero_always_returns_empty() {
    TopK topK = new TopK(0);
    topK.add("AAPL", 100);

    assertTrue(topK.top().isEmpty());
}

@Test
void negative_k_is_rejected() {
    assertThrows(IllegalArgumentException.class, () -> new TopK(-1));
}
```

**The re-ranking tests — this is the heart of the kata.** A key already inside the top K must be able to fall out on a rescore; a key outside must be able to climb in. Both require finding and moving the *existing* tree node, not just inserting a new one.

```java
@Test
void updating_a_key_can_climb_it_into_the_top_k() {
    TopK topK = new TopK(2);
    topK.add("AAPL", 100);
    topK.add("MSFT", 90);
    topK.add("GOOG", 10); // outside top 2

    topK.add("GOOG", 200); // now 210, climbs to first place

    assertEquals(List.of(new Entry("GOOG", 210), new Entry("AAPL", 100)), topK.top());
}

@Test
void updating_a_key_can_drop_it_out_of_the_top_k() {
    TopK topK = new TopK(2);
    topK.add("AAPL", 100);
    topK.add("MSFT", 90);
    topK.add("GOOG", 10);

    topK.add("AAPL", -95); // drops to 5, now last

    assertEquals(List.of(new Entry("MSFT", 90), new Entry("GOOG", 10)), topK.top());
}

@Test
void negative_weight_lowers_score_and_rank() {
    TopK topK = new TopK(2);
    topK.add("AAPL", 50);
    topK.add("MSFT", 40);

    topK.add("AAPL", -20);

    assertEquals(30, topK.scoreOf("AAPL"));
    assertEquals(List.of(new Entry("MSFT", 40), new Entry("AAPL", 30)), topK.top());
}
```

**`scoreOf` and `increment` — the small, easy-to-forget contract corners.**

```java
@Test
void score_of_unseen_key_is_zero() {
    TopK topK = new TopK(3);
    assertEquals(0, topK.scoreOf("AAPL"));
}

@Test
void increment_adds_one_to_score() {
    TopK topK = new TopK(1);
    topK.increment("AAPL");
    topK.increment("AAPL");
    topK.increment("AAPL");

    assertEquals(3, topK.scoreOf("AAPL"));
    assertEquals(List.of(new Entry("AAPL", 3)), topK.top());
}
```

A companion test seeds `k` larger than the observed key population and asserts `top()` returns exactly the observed keys, unpadded — the "don't invent zero-score entries" trap.

### Implement it

`scores` is the map of record — every read/write of "what does this key have right now" goes through it. `ranked` is a `TreeSet<Entry>` ordered by score descending, key ascending; it never diverges from `scores` because every mutation removes the stale node (using the *old* score, captured before the map is touched) before inserting the fresh one.

```java
public final class TopK {

    private static final Comparator<Entry> RANKING =
            Comparator.comparingLong(Entry::score).reversed()
                    .thenComparing(Entry::key);

    private final int k;
    private final Map<String, Long> scores = new HashMap<>();
    private final TreeSet<Entry> ranked = new TreeSet<>(RANKING);

    public TopK(int k) {
        if (k < 0) {
            throw new IllegalArgumentException("k must be non-negative: " + k);
        }
        this.k = k;
    }

    public void add(String key, long weight) {
        long oldScore = scores.getOrDefault(key, 0L);
        long newScore = oldScore + weight;
        if (scores.containsKey(key)) {
            ranked.remove(new Entry(key, oldScore)); // must use the OLD score to find the OLD node
        }
        scores.put(key, newScore);
        ranked.add(new Entry(key, newScore));
    }

    public void increment(String key) {
        add(key, 1);
    }

    public List<Entry> top() {
        List<Entry> result = new ArrayList<>(Math.min(k, ranked.size()));
        for (Entry entry : ranked) {
            if (result.size() == k) {
                break;
            }
            result.add(entry);
        }
        return result;
    }

    public long scoreOf(String key) {
        return scores.getOrDefault(key, 0L);
    }
}
```

- **Ordering mechanism:** a chained `Comparator` — `comparingLong(Entry::score).reversed().thenComparing(Entry::key)` — score descending is the primary key, key ascending is the tiebreaker; `TreeSet` maintains this order on every insert/remove, not just at read time.
- **Complexity:** `add` is O(log n) (one removal, one insertion, both tree operations) in the number of distinct keys n; `top()` is O(k), a bounded walk of the set's head; `scoreOf` is O(1).
- **Key gotcha:** the `if (scores.containsKey(key))` guard plus capturing `oldScore` *before* `scores.put` — remove the old node using the score it actually had, not the score it is about to have.

### Common mistakes & senior signal

- **Reaching for a plain `PriorityQueue`.** It supports insert and extract-min/max, not "find and re-rank an arbitrary element." Making one work needs a key→array-index side map kept in sync on every heap swap (a hand-rolled indexed heap) — more bookkeeping than a `TreeSet` for the same O(log n) bound. Naming this trade-off unprompted is the senior tell.
- **Removing the stale `TreeSet` entry *after* updating the map.** `scores.put(key, newScore)` first, then `ranked.remove(new Entry(key, scores.get(key)))` looks reasonable but constructs the entry with the *new* score — the remove silently misses the old node, `top()` starts returning duplicate/stale ranks for that key, and the set slowly corrupts as more keys update.
- **Non-deterministic tie-break.** Sorting by score alone means the JVM/`TreeSet` internal order decides ties — two identical states can produce two different "top K" answers. The fix is a chained comparator with an explicit, stable secondary key.
- **Re-sorting on every `top()` call instead of maintaining order incrementally.** Collecting all entries and sorting on read moves an O(log n) per-write cost to an O(n log n) per-read cost — backwards for a workload where reads (dashboard refreshes) likely outnumber writes (individual ticks) by a lot, and it throws away the reason to keep a sorted structure at all.
- **Confusing "top-K memory" with "exact."** A `HashMap` + `TreeSet` gives *exact* answers at O(n) memory in distinct keys seen — correct here, but it does not scale to an unbounded/adversarial key space. The senior answer names the two standard escalations: a **bounded indexed min-heap of size K** (O(K) memory, but loses `scoreOf` for keys outside the top K and cheap arbitrary-key rescoring) when the key space is large but K is small, and a **Count-Min Sketch** (sub-linear memory, approximate counts with bounded over-estimation) when even per-key existence is too much to track exactly — while explaining *why* neither is the right default here: the requirement is exact, arbitrary-direction rescoring of a bounded key population, which is exactly what `TreeSet` + map is built for.

## Position & Exposure Keeper

### Summary

**What this topic covers**
This kata builds a `PositionKeeper` — the thread-safe running position and worst-case exposure book for a betting exchange. Matched `BACK`/`LAY` bets stream in from many concurrent order-matching threads; the keeper folds each into a running per-market book via `apply`, and answers two hot-path risk queries — `pnlIfWins(market, selection)` and `worstCaseLiability(market)` — in O(1)/O(distinct selections), never by replaying bet history. That last constraint is the whole kata: a real-time risk engine that gates the *next* bet on the *current* worst-case liability cannot afford to rescan thousands of historical bets on every check, so the design question is which running numbers to maintain per market so both queries fall out of arithmetic on them.

**Mental model**
Decimal odds `O`, stake `S`. If a bet's selection is the winning outcome: `BACK` profits `+S*(O-1)`, `LAY` loses `-S*(O-1)`. If it does not win: `BACK` loses `-S`, `LAY` profits `+S`. `pnlIfWins(w)` sums that payoff over every bet in the market for a hypothesised winner `w`. Rather than replay bets, each market keeps four running numbers — `backStakeTotal`, `layStakeTotal`, and per-selection `backOddsStake[sel] = Σ S*O` / `layOddsStake[sel] = Σ S*O` — from which `pnlIfWins(w) = (backOddsStake[w] - backStakeTotal) + (layStakeTotal - layOddsStake[w])`. The first term collapses every back bet at once: backers of `w` collect their odds-stake, everyone else's back stake is forfeit; the second term is the lay mirror image. `worstCaseLiability` is the largest possible loss across every outcome the market could resolve to: every selection with at least one bet on it, *plus* the "other outcome" case — none of those selections wins, so every back bet loses its stake and every lay bet pays out, `pnl = layStakeTotal - backStakeTotal`. That candidate set is bounded by the number of distinct selections actually bet on, not the (possibly unbounded — "top goalscorer") universe of outcomes, because an outcome nobody backed or laid cannot be the worst case: its pnl is exactly the "other outcome" figure, which is already a candidate. Liability is reported as `max(0, -min pnl)` — non-negative; a market that cannot lose money reports `0`.

**Key terms**
- **decimal odds** — total return per unit stake including the stake; profit on a winning back bet is `stake * (odds - 1)`.
- **BACK** — betting *for* an outcome; wins `stake * (odds - 1)` if it happens, loses the stake otherwise.
- **LAY** — the exchange counterparty side; the mirror image of BACK — wins the stake if the outcome does not happen, pays out `stake * (odds - 1)` if it does.
- **odds-stake** — `stake * odds`, the running per-selection accumulator that lets `pnlIfWins` collapse all bets on a selection into one number instead of replaying them.
- **worst-case liability** — the largest loss across every possible market outcome, reported as a non-negative number.
- **the "other outcome"** — the case where none of the selections that were actually bet on wins; easy to forget, and it is frequently the actual worst case for a one-sided book.
- **per-market lock** — a `ReentrantLock` guarding one market's four running numbers, so reads never observe a torn update mid-write.
- **lost update** — two concurrent writers both read a stale total and overwrite each other's increment; the reason plain fields under no lock corrupt the book under contention.

**Why interviewers ask this**
It looks like "sum some numbers" but is really three separate senior signals at once: (1) recognising that a running-totals design beats replay-on-read for a hot risk-check path, (2) getting the payoff algebra right including the easy-to-miss "other outcome" case, and (3) choosing the right concurrency grain — not a global lock (kills throughput across unrelated markets), not lock-free-per-field (torn reads across the four numbers), but one lock per market held across both the write and the multi-field read. Candidates who reach for `BigDecimal` and `compareTo` unprompted, and who name per-market locking as the deliberate middle ground between "too coarse" and "too fine," are showing they've actually built something like this before.

**Common confusions**
- *"Just store the bet list and sum on read."* — Correct but O(n) per query on a path that needs to run before every accepted bet; the running-totals design trades O(1) writes-are-already-happening bookkeeping for O(1) reads.
- *"Worst case is just the minimum pnl across selections that were bet on."* — Missing the "other outcome": a pure-back book (nobody laid anything) loses the *most* when none of the backed selections wins, and that case isn't in the selection set at all.
- *"One global lock across all markets is simpler and fine."* — It is simpler, but it serialises unrelated markets that share nothing; a live exchange runs many more markets than any one market has concurrent bets, so lock-per-market is the throughput-correct grain.
- *"double is fine for money, it's just arithmetic."* — Binary floating point cannot represent most decimal fractions exactly; money and prices use `BigDecimal` with `compareTo`, never `==` or `double`.
- *"totalMatchedStake needs the market lock too."* — No: it only needs per-key atomicity (a `ConcurrentHashMap.merge`), not consistency with any one market's other fields, so it is deliberately a separate, unlocked structure.

**What follows from this topic**
The natural extension is turning this from a passive tracker into an active risk gate — reject `apply` before it lands if the resulting `worstCaseLiability` would exceed a configured cap, which is exactly the kind of check-then-act-under-lock reasoning from **[[idempotentprocessor]]** and **[[ratelimit]]**. It also connects to **[[pricecache]]** (per-key locking granularity trade-offs) and the general "aggregate incrementally, don't replay" lesson behind any O(1)-read/O(1)-write running-statistics design.

### Clarify & design the API

Questions to settle before writing a line of logic:

- **What counts as "exposure"?** Two distinct queries: `pnlIfWins(market, selection)` — the whole market's P&L if a specific selection wins — and `worstCaseLiability(market)` — the largest possible loss across *every* outcome the market could resolve to, floored at zero.
- **Scoped per market or global?** Per market. Markets are independent books (different events, different selections); nothing about one market's liability depends on another's.
- **Concurrent writers?** Yes — many order-matching threads apply bets to potentially the same market concurrently. That is the hard case to design for, not an afterthought.
- **Money type?** `BigDecimal` throughout — stakes, odds, and every derived total — compared with `compareTo`, never `double`/`==`.
- **What about an unknown market or selection?** Return `BigDecimal.ZERO`, not throw — a market with no bets yet has no exposure, that's a valid, common state.
- **Does "other outcome" belong in the candidate set even with zero back-only or lay-only bets?** Yes, always — it's the case where none of the selections that were bet on wins, and it must be considered even when it is not the eventual worst case.

Commit to this surface (the fixtures — `Bet`, `Side` — are copied verbatim from `solution/`):

```java
public record Bet(String market, String selection, Side side, BigDecimal stake, BigDecimal odds) { … }

public enum Side { BACK, LAY }

public final class PositionKeeper {
    public void apply(Bet bet);                                    // fold a matched bet into its market's book
    public BigDecimal pnlIfWins(String market, String selection);  // 0 for unknown/empty market
    public BigDecimal worstCaseLiability(String market);           // non-negative; 0 for unknown/empty/can't-lose market
    public BigDecimal totalMatchedStake(String selection);         // sum of stakes on a selection, across all markets
}
```

### Write the tests

Write these first — pin the payoff arithmetic on paper, then let the tests hold you to it. Group them: two-outcome pnl, a mixed multi-selection book, worst-case liability (including the "other outcome" trap), a back+lay hedge that should net to zero, validation, and the concurrency stress test.

**Two-way market — the base case.** Confirm the sign convention for BACK on both legs.

```java
@Test
void two_way_market_back_bet_pnl() {
    var keeper = new PositionKeeper();
    keeper.apply(new Bet("Match1", "Home", Side.BACK, new BigDecimal("100"), new BigDecimal("2.0")));
    keeper.apply(new Bet("Match1", "Away", Side.BACK, new BigDecimal("50"), new BigDecimal("3.0")));

    // Home wins: +100*(2-1) on the Home bet, -50 on the losing Away bet.
    assertMoneyEquals("50", keeper.pnlIfWins("Match1", "Home"));
    // Away wins: -100 on the losing Home bet, +50*(3-1) on the Away bet.
    assertMoneyEquals("0", keeper.pnlIfWins("Match1", "Away"));
}
```

**Three-way mixed book — BACK and LAY on different selections in the same market.** This is the one that pins the general formula, not just a two-outcome special case.

```java
@Test
void three_way_mixed_book_pnl_per_outcome() {
    var keeper = new PositionKeeper();
    keeper.apply(new Bet("Race", "A", Side.BACK, new BigDecimal("10"), new BigDecimal("4")));
    keeper.apply(new Bet("Race", "B", Side.LAY, new BigDecimal("20"), new BigDecimal("2")));
    keeper.apply(new Bet("Race", "C", Side.BACK, new BigDecimal("5"), new BigDecimal("10")));

    // A wins: +10*(4-1) back A, +20 lay B (B loses), -5 back C (C loses) = 45.
    assertMoneyEquals("45", keeper.pnlIfWins("Race", "A"));
    // B wins: -10 back A, -20*(2-1) lay B (B wins), -5 back C = -35.
    assertMoneyEquals("-35", keeper.pnlIfWins("Race", "B"));
    // C wins: -10 back A, +20 lay B, +5*(10-1) back C = 55.
    assertMoneyEquals("55", keeper.pnlIfWins("Race", "C"));
}
```

**Worst-case liability — the "other outcome" trap, twice.** A pure-back book's worst case is neither selection winning (the "other outcome"); a pure-lay book can never lose money, so liability floors at zero rather than going negative.

```java
@Test
void pure_back_book_worst_case_is_the_other_outcome() {
    var keeper = new PositionKeeper();
    keeper.apply(new Bet("PureBack", "X", Side.BACK, new BigDecimal("100"), new BigDecimal("1.5")));
    keeper.apply(new Bet("PureBack", "Y", Side.BACK, new BigDecimal("100"), new BigDecimal("1.5")));

    // Either X or Y winning still loses 50 on the other leg; neither winning loses both stakes.
    assertMoneyEquals("-50", keeper.pnlIfWins("PureBack", "X"));
    assertMoneyEquals("-50", keeper.pnlIfWins("PureBack", "Y"));
    assertMoneyEquals("200", keeper.worstCaseLiability("PureBack"));
}

@Test
void pure_lay_book_cannot_lose_money() {
    var keeper = new PositionKeeper();
    keeper.apply(new Bet("PureLay", "X", Side.LAY, new BigDecimal("100"), new BigDecimal("1.5")));
    keeper.apply(new Bet("PureLay", "Y", Side.LAY, new BigDecimal("100"), new BigDecimal("1.5")));

    // Every outcome nets a profit for a book with no backers; liability floors at zero, not negative.
    assertMoneyEquals("0", keeper.worstCaseLiability("PureLay"));
}

@Test
void worst_case_liability_across_a_mixed_book_including_other_outcome() {
    var keeper = new PositionKeeper();
    keeper.apply(new Bet("Race", "A", Side.BACK, new BigDecimal("10"), new BigDecimal("4")));
    keeper.apply(new Bet("Race", "B", Side.LAY, new BigDecimal("20"), new BigDecimal("2")));
    keeper.apply(new Bet("Race", "C", Side.BACK, new BigDecimal("5"), new BigDecimal("10")));

    // Candidates: A=45, B=-35, C=55, "other outcome" = layTotal-backTotal = 20-15 = 5.
    // Worst is B winning (pnl -35), so liability is 35.
    assertMoneyEquals("35", keeper.worstCaseLiability("Race"));
}
```

**A back+lay hedge on the same selection nets to zero.** The exchange's classic sanity check: opposing bets at the same odds cancel out exactly.

```java
@Test
void opposing_back_and_lay_at_same_odds_nets_liability_toward_zero() {
    var keeper = new PositionKeeper();
    keeper.apply(new Bet("Hedge", "X", Side.BACK, new BigDecimal("100"), new BigDecimal("2")));
    keeper.apply(new Bet("Hedge", "X", Side.LAY, new BigDecimal("100"), new BigDecimal("2")));

    assertMoneyEquals("0", keeper.pnlIfWins("Hedge", "X"));
    assertMoneyEquals("0", keeper.worstCaseLiability("Hedge"));
}
```

**Unknown market and bet validation.**

```java
@Test
void unknown_market_reports_zero() {
    var keeper = new PositionKeeper();
    assertMoneyEquals("0", keeper.pnlIfWins("NoSuchMarket", "X"));
    assertMoneyEquals("0", keeper.worstCaseLiability("NoSuchMarket"));
}

@Test
void bet_validation_throws_on_invalid_stake_and_odds() {
    assertThrows(IllegalArgumentException.class, () ->
            new Bet("M", "X", Side.BACK, new BigDecimal("0"), new BigDecimal("2")));
    assertThrows(IllegalArgumentException.class, () ->
            new Bet("M", "X", Side.BACK, new BigDecimal("10"), new BigDecimal("1")));
    assertThrows(IllegalArgumentException.class, () ->
            new Bet("M", "X", null, new BigDecimal("10"), new BigDecimal("2")));
}
```

**The stress test — the one a plain-field, unlocked `Market` fails.** Fire N virtual threads at the *same* selection through a `CountDownLatch` gate so they collide, then assert the running total is exactly `N * stake` — no lost updates from an unsynchronised read-modify-write race.

```java
@Test
void concurrent_applies_to_the_same_selection_conserve_total_stake() throws Exception {
    var keeper = new PositionKeeper();
    int n = 200;
    BigDecimal stake = new BigDecimal("10");
    var gate = new CountDownLatch(1);
    var done = new CountDownLatch(n);

    try (var exec = Executors.newVirtualThreadPerTaskExecutor()) {
        IntStream.range(0, n).forEach(i -> exec.submit(() -> {
            try {
                gate.await(); // all threads block here, then stampede together
                keeper.apply(new Bet("ConcMkt", "ConcSel", Side.BACK, stake, new BigDecimal("2")));
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            } finally {
                done.countDown();
            }
        }));
        gate.countDown(); // release the stampede
        assertTrue(done.await(5, TimeUnit.SECONDS));
    }

    assertMoneyEquals("2000", keeper.totalMatchedStake("ConcSel"));
}
```

### Implement it

`markets` is a `ConcurrentHashMap<String, Market>`; each `Market` is a small mutable aggregate guarded by its own `ReentrantLock`, held across both the write in `apply` and the multi-field read in `pnlIfWins`/`worstCaseLiability` so a reader never observes a torn update.

```java
private static final class Market {
    private final ReentrantLock lock = new ReentrantLock();
    private final Map<String, BigDecimal> backOddsStake = new HashMap<>();
    private final Map<String, BigDecimal> layOddsStake = new HashMap<>();
    private BigDecimal backStakeTotal = BigDecimal.ZERO;
    private BigDecimal layStakeTotal = BigDecimal.ZERO;

    void apply(Bet bet) {
        BigDecimal stakeOdds = bet.stake().multiply(bet.odds());
        lock.lock();
        try {
            if (bet.side() == Side.BACK) {
                backStakeTotal = backStakeTotal.add(bet.stake());
                backOddsStake.merge(bet.selection(), stakeOdds, BigDecimal::add);
            } else {
                layStakeTotal = layStakeTotal.add(bet.stake());
                layOddsStake.merge(bet.selection(), stakeOdds, BigDecimal::add);
            }
        } finally {
            lock.unlock();
        }
    }

    /** Caller must hold {@link #lock}. */
    private BigDecimal pnlIfWinsLocked(String selection) {
        BigDecimal backOdds = backOddsStake.getOrDefault(selection, BigDecimal.ZERO);
        BigDecimal layOdds = layOddsStake.getOrDefault(selection, BigDecimal.ZERO);
        return backOdds.subtract(backStakeTotal).add(layStakeTotal).subtract(layOdds);
    }

    BigDecimal worstCaseLiability() {
        lock.lock();
        try {
            BigDecimal otherOutcome = layStakeTotal.subtract(backStakeTotal);
            Set<String> selections = Stream.concat(
                            backOddsStake.keySet().stream(), layOddsStake.keySet().stream())
                    .collect(Collectors.toSet());

            BigDecimal worstPnl = otherOutcome;
            for (String selection : selections) {
                BigDecimal pnl = pnlIfWinsLocked(selection);
                if (pnl.compareTo(worstPnl) < 0) {
                    worstPnl = pnl;
                }
            }
            return worstPnl.negate().max(BigDecimal.ZERO);
        } finally {
            lock.unlock();
        }
    }
}
```

The outer class routes by market id and treats an unknown market as empty:

```java
private final ConcurrentHashMap<String, Market> markets = new ConcurrentHashMap<>();
private final ConcurrentHashMap<String, BigDecimal> matchedStakeBySelection = new ConcurrentHashMap<>();

public void apply(Bet bet) {
    markets.computeIfAbsent(bet.market(), m -> new Market()).apply(bet);
    matchedStakeBySelection.merge(bet.selection(), bet.stake(), BigDecimal::add);
}

public BigDecimal pnlIfWins(String market, String selection) {
    Market m = markets.get(market);
    return m == null ? BigDecimal.ZERO : m.pnlIfWins(selection);
}

public BigDecimal worstCaseLiability(String market) {
    Market m = markets.get(market);
    return m == null ? BigDecimal.ZERO : m.worstCaseLiability();
}
```

- **Concurrency mechanism:** one `ReentrantLock` per `Market`, held across the write and across the whole multi-field read — never a global lock, never per-field atomics (those would let a reader see `backStakeTotal` updated but `backOddsStake` not yet, i.e. a torn read). `totalMatchedStake` is intentionally *outside* any market lock — a `ConcurrentHashMap.merge` gives it the per-key atomicity it needs without coupling it to a market's consistency.
- **Complexity:** `apply` and `pnlIfWins` are O(1); `worstCaseLiability` is O(distinct selections bet on in that market), never O(bet count) — the whole point of running totals over replay.
- **Key gotcha:** the worst-case candidate set must seed with the "other outcome" pnl (`layStakeTotal - backStakeTotal`) *before* scanning selections, not just take the min over selections — a pure-back book has no lay bets at all, so its true worst case only shows up in that seed value.

### Common mistakes & senior signal

- **Replaying the bet list on every query.** Storing `List<Bet>` and summing on read is correct but O(n) on a path a risk gate needs to call before accepting the *next* bet. Running per-market totals updated on write is the senior design; it moves the cost to the side that can afford it.
- **Forgetting the "other outcome".** Taking `worstCaseLiability` as just the minimum `pnlIfWins` over selections that were bet on misses the case where none of them wins — the actual worst case for a pure-back book. Seed the candidate set with `layStakeTotal - backStakeTotal` unconditionally.
- **A global lock across all markets.** Simpler, but serialises every market's bets through one monitor even though markets share no state; a live exchange runs far more markets than any single market has concurrent bets, so per-market locking gives near-linear scalability for the same safety.
- **Per-field atomics instead of a per-market lock.** Four independent `AtomicReference<BigDecimal>` fields eliminates the *word-tearing* problem but not the *cross-field* one: a reader can see `backStakeTotal` post-update and `backOddsStake` pre-update mid-write, corrupting `pnlIfWins`. The lock must span the whole read, not just each field.
- **`double` for money.** Binary floating point cannot represent most decimal stakes/odds exactly, and repeated `+=` compounds the error. `BigDecimal` with `compareTo` (never `==`) is non-negotiable for this domain.
- **Lost updates under concurrency.** Reading `backStakeTotal`, adding, and writing back without holding the market lock loses increments when two threads interleave — the stress test's `N * stake` conservation check is exactly what catches this.
- **The named alternative, unprompted.** A senior candidate flags that per-market locking is the right grain *for now* and names the escalation path if profiling ever shows one hot market's lock as the bottleneck: sharded/striped atomic accumulators per selection, paying the extra bookkeeping cost only once single-market throughput actually saturates the lock.

## Quote-Expiry Cache — TTL

### Summary

**What this topic covers**
This kata builds a `QuoteCache<K, V>` whose entries expire a fixed duration after they were *written* — stale-price protection for a trading desk, where a quote that hasn't been refreshed inside its TTL is worse than no quote at all: trading against it risks execution at a price nobody would honour. You design a small four-method API (`put`, `get`, `size`, `containsKey`), a value-plus-timestamp record, an injected clock so the whole thing is testable without real sleeps, and — the crux — a lazy expiry check that must not race a concurrent overwrite. This is a mechanics-plus-concurrency kata: the interesting work is the exact-boundary semantics and the conditional-remove race, not raw complexity.

**Mental model**
A `QuoteCache` is deliberately a *different* eviction policy from an `LruCache`/`LfuCache`. Those evict based on **recency** or **frequency** of access once the cache is at capacity — a hot entry survives indefinitely, a cold one gets pushed out only when something new needs the slot. A `QuoteCache` has no capacity bound at all; every entry evicts on a **wall-clock deadline** regardless of how often it is read. A quote read a thousand times a second is exactly as stale at `ttlNanos` as one never read again — access pattern is irrelevant to whether a price is safe to trade on. That is the whole conceptual shift: LRU/LFU answer "is this still useful," TTL answers "is this still true."

**Key terms**
- **TTL (time-to-live)** — the fixed duration after write that an entry stays valid; here expressed as `ttlNanos`.
- **stale-price protection** — the business reason for the kata: an expired quote must never be readable, because trading on it risks a bad fill.
- **injected clock** — a `LongSupplier` of nanoseconds passed into the constructor (default `System::nanoTime`) so tests can drive time deterministically with an `AtomicLong`, instead of the untestable `System.nanoTime()` called inline.
- **lazy (passive) expiry**‑ checking an entry's age against the TTL only when something touches it (`get`/`size`/`containsKey`), rather than running a background sweep.
- **active expiry (reaper)** — the alternative: a scheduled task or delay-ordered queue that proactively evicts expired entries even if nobody ever reads them again.
- **conditional remove** — `ConcurrentHashMap.remove(key, expectedEntry)`, which deletes only if the map still maps `key` to that exact object — the tool that prevents a stale reader from deleting a value a concurrent writer just refreshed.
- **exact-TTL boundary** — the inclusive/exclusive edge case at `age == ttlNanos`; this kata defines it as *already expired*.
- **storedAt timestamp** — the write-time nanosecond stamp captured per entry, reset on every `put` (including overwrites).

**Why interviewers ask this**
It looks like "write a `Map` with a timer" but it quietly tests three separate skills: precise boundary reasoning (is `age == ttl` expired or not, and can you justify the choice), designing for testability (would you dare call `System.nanoTime()` inline, or do you reach for dependency injection unprompted), and concurrency correctness under a lazy-eviction design (does your expiry check on `get` know it can race a `put`). A candidate who reaches for `Thread.sleep` in a test, or does an unconditional `map.remove(key)` after detecting staleness, has missed both the testability and the race. The senior signal is stating the boundary rule out loud, injecting the clock from the first line of the constructor, and reasoning about the read-then-remove race *before* being asked "what if two threads touch this key at once?"

**Common confusions**
- *"This is basically an LRU cache with a timer bolted on."* — No: LRU/LFU are capacity-driven and access-driven; TTL is time-driven and access-agnostic. A `QuoteCache` never evicts because the cache is "full" — there is no bound — and never keeps an entry alive because it's popular.
- *"`age > ttl` and `age >= ttl` are the same thing in practice."* — They are one nanosecond apart in code but a real behavioural difference: at `age == ttl` exactly, one design still serves the value and the other doesn't. For a price feed, treating "exactly at the deadline" as expired is the conservative, defensible choice.
- *"Lazy expiry means stale data can leak out."* — Only if the check is missing from a read path. Every accessor (`get`, `size`, `containsKey`) must independently re-check age; a cache that only purges in `put` can serve a stale `get`.
- *"An unconditional `remove(key)` after detecting staleness is fine — it's just cleanup."* — Not under concurrency: if a `put` refreshed that key between your `get`'s staleness check and your `remove` call, an unconditional remove deletes the *fresh* entry a racing writer just installed.
- *"Overwriting a key should have no relation to TTL."* — Wrong for this design: `put` unconditionally re-stamps `storedAt`, so an overwrite is defined to reset the deadline — a quote that gets refreshed 1ns before it would have expired lives a full fresh TTL.

**What follows from this topic**
The active-reaper extension swaps passive per-access checks for a `ScheduledExecutorService` sweep or a `DelayQueue<K>` ordered by deadline — the difference between "clean on touch" and "clean on a timer," the same trade-off as generational GC vs. reference counting. A per-entry-TTL extension (accepting an override on `put` instead of one fixed TTL for the whole cache) generalises this into something closer to Redis `EXPIRE`. It connects to the **[[idempotentprocessor]]** kata's `ConcurrentHashMap` primitives (there `computeIfAbsent`, here conditional `remove`), and to any **[[ratelimit]]**/**[[cache]]** kata that also needs an injectable clock instead of wall-clock calls sprinkled through the implementation.

### Clarify & design the API

Questions to settle before writing a line of logic:

- **Is the TTL boundary inclusive or exclusive?** Decide explicitly: an entry stored at `t` is expired at `now` iff `now - t >= ttlNanos`. "Valid for up to N nanos" (inclusive of the deadline) is the safer reading for a price feed than "valid for more than N nanos."
- **Does overwriting a key reset its TTL, or preserve the original deadline?** This kata resets it — `put` is unconditional, so the newest write always re-stamps `storedAt`, and the entry gets a fresh full TTL from that point.
- **Lazy or active expiry?** Lazy: no background thread, no timer wheel. Every accessor checks age on the way in and purges on the spot if stale. Trade-off: `put` stays O(1) with zero bookkeeping, but a key nobody ever reads again lingers in the map (and counts toward memory) until something touches it.
- **How is "now" obtained?** Never call `System.nanoTime()` inline — inject a `LongSupplier` clock (default `System::nanoTime`) so tests can drive it with an `AtomicLong`.
- **Thread-safe?** Assume concurrent `put`/`get` from many threads is the normal case (many quote sources publishing, many strategies reading). Point at `ConcurrentHashMap`, and flag the one subtlety: expiring an entry inside `get` must not race a concurrent `put` that just refreshed the same key.
- **What does an expired read look like?** `Optional.empty()`, not `null` and not an exception — a missing/expired quote is a normal, expected outcome for a caller to branch on.

Commit to this surface:

```java
public final class QuoteCache<K, V> {
    public QuoteCache(long ttlNanos);                    // default clock: System::nanoTime
    public QuoteCache(long ttlNanos, LongSupplier clock); // injected clock for tests; ttlNanos must be > 0

    public void put(K key, V value);        // stores/overwrites, stamping "now"; resets TTL
    public Optional<V> get(K key);          // present+live -> value; absent or expired -> empty
    public int size();                      // count of live entries; purges stale ones as a side effect
    public boolean containsKey(K key);      // true iff a live entry exists
}
```

### Write the tests

Group them: basic contract (fresh reads, missing keys), the exact-TTL boundary, lazy purge behaviour, overwrite-resets-TTL, argument validation, then the concurrency stress test. Drive time with an `AtomicLong` — never a real sleep.

**Setup — a shared `AtomicLong` clock and a small, easy-to-reason-about TTL.**

```java
// now starts at 10_000 with a 1_000ns TTL, so a quote stored at 10_000 expires at 11_000.
private final AtomicLong clock = new AtomicLong(10_000);
private final QuoteCache<String, Double> cache = new QuoteCache<>(1_000, clock::get);
```

**Basic contract — a fresh write is readable; a missing key is empty.**

```java
@Test
void get_returns_value_before_expiry() {
    cache.put("EURUSD", 1.0850);
    assertEquals(1.0850, cache.get("EURUSD").orElseThrow());
}

@Test
void missing_key_returns_empty() {
    assertTrue(cache.get("GBPUSD").isEmpty());
    assertFalse(cache.containsKey("GBPUSD"));
}
```

**The exact-TTL boundary — this is the test that pins the inclusive/exclusive decision.** One nanosecond below the deadline is still live; exactly at the deadline is already expired.

```java
@Test
void exact_ttl_boundary_is_expired() {
    cache.put("EURUSD", 1.0850);
    clock.set(10_999); // age = 999 < 1_000 -> still live
    assertTrue(cache.get("EURUSD").isPresent());

    clock.set(11_000); // age = 1_000 == ttl -> expired
    assertTrue(cache.get("EURUSD").isEmpty());
}
```

**Lazy purge — `get` on an expired entry must both return empty AND remove it, dropping `size()`.**

```java
@Test
void expired_entry_is_purged_lazily_on_get() {
    cache.put("EURUSD", 1.0850);
    assertEquals(1, cache.size());

    clock.set(11_000); // age == 1_000 == ttl -> expired
    assertTrue(cache.get("EURUSD").isEmpty());
    assertEquals(0, cache.size(), "get() must lazily purge the expired entry");
}

@Test
void size_reflects_only_live_entries_and_purges_stale_ones() {
    cache.put("EURUSD", 1.0850);
    clock.set(10_500);
    cache.put("GBPUSD", 1.2650); // stored later, still fresh at 11_500

    clock.set(11_100); // EURUSD (age 1_100) expired; GBPUSD (age 600) live
    assertEquals(1, cache.size());
    assertTrue(cache.get("EURUSD").isEmpty());
    assertTrue(cache.get("GBPUSD").isPresent());
}
```

**Overwrite resets the TTL — a refreshed quote gets a full fresh deadline from the overwrite time, not the original write time.**

```java
@Test
void overwrite_resets_the_ttl() {
    cache.put("EURUSD", 1.0850);
    clock.set(10_900); // age 900, about to expire at 11_000
    cache.put("EURUSD", 1.0860); // overwrite resets storedAt to 10_900

    clock.set(11_000); // age since original write is 1_000, but since overwrite only 100
    assertEquals(1.0860, cache.get("EURUSD").orElseThrow(),
            "overwrite must reset the TTL clock, keeping the entry alive past the original deadline");
}
```

**Argument validation — a non-positive TTL is nonsensical and must be rejected in the constructor.**

```java
@Test
void non_positive_ttl_is_rejected() {
    assertThrows(IllegalArgumentException.class, () -> new QuoteCache<String, Double>(0, clock::get));
    assertThrows(IllegalArgumentException.class, () -> new QuoteCache<String, Double>(-5, clock::get));
}
```

**The concurrency stress test — distinct-key puts must all be conserved under contention on one shared map.** N virtual threads each write a *different* key through a `CountDownLatch` start gate so writes collide on the same `ConcurrentHashMap` bins simultaneously; a large TTL keeps anything from expiring mid-test. Afterwards every key must be present and `size()` must equal N exactly — no write lost, no phantom entry.

```java
@Test
void concurrent_puts_of_distinct_keys_are_all_conserved() throws InterruptedException {
    final int n = 200;
    var bigTtlCache = new QuoteCache<Integer, String>(1_000_000_000L, clock::get);

    var gate = new CountDownLatch(1);
    var done = new CountDownLatch(n);

    try (var exec = Executors.newVirtualThreadPerTaskExecutor()) {
        for (int i = 0; i < n; i++) {
            final int key = i;
            exec.submit(() -> {
                try {
                    gate.await(); // all threads block here, then stampede together
                    bigTtlCache.put(key, "quote-" + key);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                } finally {
                    done.countDown();
                }
            });
        }
        gate.countDown(); // release the stampede
        assertTrue(done.await(5, TimeUnit.SECONDS), "threads did not complete within 5 seconds");
    }

    assertEquals(n, bigTtlCache.size());
    for (int i = 0; i < n; i++) {
        assertEquals("quote-" + i, bigTtlCache.get(i).orElseThrow(),
                "key " + i + " was lost under concurrent put");
    }
}
```

### Implement it

The store is a `ConcurrentHashMap<K, Entry<V>>`, where `Entry` is a private record pairing the value with its write timestamp. `put` is a single unconditional map write that always re-stamps — that unconditionality is *why* overwrite resets the TTL for free. `get` (and `size`) each independently re-check age and lazily purge, using the conditional two-arg `remove` so a reader never deletes a fresher write it raced past.

```java
private record Entry<V>(V value, long storedAt) {}

private final long ttlNanos;
private final LongSupplier clock;
private final ConcurrentHashMap<K, Entry<V>> entries = new ConcurrentHashMap<>();

public QuoteCache(long ttlNanos) {
    this(ttlNanos, System::nanoTime);
}

public QuoteCache(long ttlNanos, LongSupplier clock) {
    if (ttlNanos <= 0) {
        throw new IllegalArgumentException("ttlNanos must be positive: " + ttlNanos);
    }
    this.ttlNanos = ttlNanos;
    this.clock = clock;
}

public void put(K key, V value) {
    entries.put(key, new Entry<>(value, clock.getAsLong()));
}

public Optional<V> get(K key) {
    Entry<V> entry = entries.get(key);
    if (entry == null) {
        return Optional.empty();
    }
    if (isExpired(entry, clock.getAsLong())) {
        // Conditional remove: only delete if the map still holds this exact (now-expired)
        // entry. If a concurrent put() already replaced it with a fresh one, that fresh
        // entry must survive — we'd otherwise race-delete a live write.
        entries.remove(key, entry);
        return Optional.empty();
    }
    return Optional.of(entry.value());
}

public int size() {
    long now = clock.getAsLong();
    int live = 0;
    for (var mapEntry : entries.entrySet()) {
        Entry<V> entry = mapEntry.getValue();
        if (isExpired(entry, now)) {
            entries.remove(mapEntry.getKey(), entry);
        } else {
            live++;
        }
    }
    return live;
}

public boolean containsKey(K key) {
    return get(key).isPresent(); // reuses get()'s lazy-purge path
}

private boolean isExpired(Entry<V> entry, long now) {
    return now - entry.storedAt() >= ttlNanos;
}
```

- **Concurrency mechanism:** `ConcurrentHashMap` gives lock-free-ish `put`/`get`; the only hand-written correctness step is the conditional `remove(key, entry)` in the expiry path, which is a compare-and-remove keyed on object identity of the exact stale entry.
- **Complexity:** O(1) for `put`/`get`/`containsKey` (hash lookup); O(n) for `size()` since it must scan every entry to separate live from stale — there is no cheaper way to answer "how many are live right now" without an active reaper maintaining a running count.
- **Key gotcha:** `containsKey` must route through `get` (or duplicate its expiry+purge logic) rather than a bare `entries.containsKey(key)` — otherwise a stale entry that hasn't been touched yet would report as present.

### Common mistakes & senior signal

- **Returning an expired value.** Checking `entries.containsKey(key)` (or reading the map directly) without re-validating age against "now" serves a price that is provably stale — the exact bug this cache exists to prevent. Every read path must re-check the deadline, every time.
- **Unconditional remove racing an overwrite.** `if (isExpired(entry, now)) entries.remove(key);` looks like harmless cleanup but is a real race: if a concurrent `put` refreshed that key between the staleness check and the remove, the unconditional remove deletes the *fresh* entry the other thread just wrote. The fix is the two-arg conditional `remove(key, entry)`, which only deletes if the map still maps to that exact stale object.
- **Calling `System.nanoTime()` inline instead of injecting the clock.** It compiles and passes a demo, but makes the exact-boundary and overwrite-reset tests impossible to write deterministically — you'd be at the mercy of real elapsed wall-clock time in a unit test. Injecting a `LongSupplier` (defaulting to `System::nanoTime`) is what makes `AtomicLong`-driven tests possible at all.
- **Confusing TTL eviction with LRU/LFU.** A candidate who reaches for "evict the least-recently-used entry when the map gets big" has solved a capacity problem, not a freshness problem — this cache has no capacity bound and must evict *purely* on age, independent of how often (or recently) an entry was read.
- **Getting the boundary backwards.** Treating `age == ttlNanos` as still valid (using `>` instead of `>=`) is a subtle off-by-one that a boundary test catches immediately; state and justify the inclusive choice before writing the comparison.
- **Ignoring the memory cost of lazy expiry.** A senior flags, unprompted, that a cold key nobody reads again lingers in the map forever under pure lazy expiry, and names the fix: an active reaper (`ScheduledExecutorService` sweep, or a `DelayQueue<K>` ordered by deadline, drained periodically) to reclaim memory even for abandoned keys — and, separately, a per-entry-TTL override on `put` for symbols with different freshness SLAs instead of one fixed TTL for the whole cache.

## Odds Converter — Decimal · Fractional · American

### Summary

**What this topic covers**
This kata builds an `OddsConverter` that translates a betting price between the three quoting
conventions bookmakers actually use — **decimal** (`3.50`), **fractional** (`5/2`), and **American /
moneyline** (`+150` / `-200`) — plus **implied probability** (`0.2857`). Every conversion must be
*exact and round-trippable*: decimal → fractional → decimal must return (within a fixed tolerance)
what you started with, and the even-money price must agree across all four representations at once.
It reads like a small formula exercise, but it is really a kata about choosing the right numeric type
and a fixed rounding policy — the interesting bugs live in what happens when you reach for `double`
instead of `BigDecimal`, not in the formulas themselves.

**Mental model**
Odds are fractions dressed up in three display conventions, and a sportsbook that quotes them
inconsistently — or drifts a hundredth of a cent through repeated conversions — leaks money at
volume. Decimal odds are "multiply your stake by this to get total payout"; fractional odds are "you
win this much per that much staked"; American odds are a US convention where positive means "profit
per $100 staked" and negative means "stake needed to profit $100". All three pivot through decimal
odds — the common currency — with an `xFromDecimal`/`decimalFromX` pair per format. Because
`1.0 / 3.0` has no exact binary (`double`) representation and repeated float conversions compound that
drift, every calculation goes through `BigDecimal` with one fixed scale and `RoundingMode`, so the
rounding policy is a design decision you can point to, not an accident of IEEE 754.

**Key terms**
- **decimal odds** — `stake × decimalOdds = total payout` (stake included); e.g. `3.5` pays `$3.50`
  per `$1` staked. The pivot format every other conversion routes through.
- **fractional odds** — `numerator/denominator = profit per denominator staked` (stake excluded);
  e.g. `5/2` wins `$5` profit per `$2` staked. UK/Irish board convention.
- **American / moneyline odds** — positive = profit per `$100` staked (`+150` → `$150` profit on
  `$100`); negative = stake needed to profit `$100` (`-200` → stake `$200` to profit `$100`). Has no
  `0`, no `-100 … +100` gap — the scale jumps straight from `-100` to `+100`.
- **implied probability** — `1 / decimalOdds`; the break-even win probability the price encodes,
  ignoring the bookmaker's margin.
- **even-money boundary** — decimal `2.0` ≡ fractional `1/1` ≡ American `+100` ≡ probability `0.5`;
  the coin-flip price where American's sign flips.
- **`BigDecimal.compareTo` vs `equals`** — `compareTo` compares numeric value; `equals` also compares
  *scale*, so `2.50` and `2.5` are numerically equal but not `.equals()`. Every comparison here uses
  `compareTo`.
- **`HALF_UP` rounding** — round half away from zero, the convention a bettor checking a price by hand
  expects; `HALF_EVEN` (banker's rounding) is defensible for accounting but surprising here.
- **exact fraction reduction** — recovering lowest-terms `numerator/denominator` from a `BigDecimal`
  via its unscaled integer value and `BigInteger.gcd`, rather than looping or casting through `double`.

**Why interviewers ask this**
It looks like a "just write the formulas" exercise, which is the trap: a candidate who reaches for
`double` sails through the happy-path tests and then fails silently on round-trips or values that
don't divide evenly. The senior signal is picking `BigDecimal` unprompted, naming *why* (exact
decimal arithmetic, no float drift, an explicit rounding policy), and catching two sharp edges by
construction: the even-money sign boundary in American odds, and `equals` vs `compareTo` when
comparing two `BigDecimal`s. It also rewards clean API taste — small, single-purpose conversion
methods plus one shared validation guard, rather than one "convert(from, to)" god method with a
format enum and a switch inside.

**Common confusions**
- *"`double` is fine, I'll just round at the end."* — Rounding once doesn't undo drift accumulated
  earlier; `1.0/3.0` is already wrong before you round it, and chained conversions compound the error.
- *"`BigDecimal.equals` and `compareTo` are interchangeable."* — `new BigDecimal("2.50").equals(new
  BigDecimal("2.5"))` is `false` because scale differs, even though the values are equal. Use
  `compareTo` everywhere, tests included.
- *"American odds go smoothly from negative to positive through zero."* — There is no `0` and no line
  between `-100` and `+100`. `decimalOdds == 2.0` is the pivot and belongs on the *positive* branch
  (`+100`), not the negative one.
- *"5/2 and 10/4 are different fractional prices."* — Same price; a converter that doesn't reduce to
  lowest terms produces `10/4` on one path and `5/2` on another, breaking equality checks.
- *"Any decimal odds value is valid."* — Odds `<= 1` (or a probability outside `(0, 1)`, or American
  `0`) are out of domain and must throw, not silently produce nonsense.

**What follows from this topic**
This is the arithmetic core of an odds-quoting/pricing service; natural extensions are the
bookmaker's **margin/overround** (implied probabilities across a market summing to `> 1`) and **vig
removal** — normalising those probabilities back to a fair book. It also generalises: Hong Kong,
Indonesian, and Malaysian odds are each another linear transform of decimal odds, slotting in as more
`xFromDecimal`/`decimalFromX` pairs once the `BigDecimal`-first, fixed-scale discipline is
established. The scale/rounding lesson generalises anywhere money or exact fractions are modelled —
ledgers, interest, currency conversion.

### Clarify & design the API

Questions to settle before writing a line of logic:

- **Numeric type — `double` or `BigDecimal`?** Odds and probabilities are exact fractions with no
  exact binary form; at bookmaker volume even a fraction-of-a-cent rounding error is real money.
  `BigDecimal` throughout, never `double`.
- **What's the pivot format?** Decimal odds — every other format converts *through* decimal
  (`xFromDecimal(decimal)` / `decimalFromX(x)`), so there is one canonical representation instead of
  N² direct conversions.
- **Rounding policy?** A single fixed scale and `RoundingMode` (this kata: 4 decimal places,
  `HALF_UP`) applied everywhere, so results are deterministic and the policy is a named, testable
  decision rather than incidental.
- **What's invalid, per format?** Decimal odds `<= 1` (odds must at least return the stake);
  probability outside the open interval `(0, 1)`; American odds of exactly `0` (no such price exists).
  Reject all of these with `IllegalArgumentException` up front.
- **Does fractional odds need to reduce to lowest terms?** Yes — `10/4` and `5/2` are the same price;
  a `Fractional` produced by the converter must always be in lowest terms so equal prices compare
  equal.

Commit to this surface:

```java
public record Fractional(int numerator, int denominator) {
    public Fractional { /* rejects numerator/denominator <= 0 */ }
    public static Fractional parse(String text); // "5/2" -> Fractional(5, 2)
}

public final class OddsConverter {
    BigDecimal decimalFromFractional(Fractional fractional);
    BigDecimal decimalFromAmerican(int american);
    BigDecimal impliedProbability(BigDecimal decimalOdds);
    BigDecimal decimalFromProbability(BigDecimal probability);
    Fractional fractionalFromDecimal(BigDecimal decimalOdds);
    int americanFromDecimal(BigDecimal decimalOdds);
}
```

Six small conversion methods, each one direction, each validating its own input — no shared mutable
state, no format enum, no god method.

### Write the tests

Write these first: textbook values for each conversion, the even-money boundary that must agree
across all four representations at once, fractional reduction, round-trips within a tolerance, then
the validation guards.

**Textbook conversions — pin the formulas against known bookmaker prices.**

```java
@Test
void decimal_from_fractional_matches_textbook_values() {
    assertBigDecimalEquals(new BigDecimal("3.5000"), converter.decimalFromFractional(new Fractional(5, 2)));
    assertBigDecimalEquals(new BigDecimal("2.0000"), converter.decimalFromFractional(new Fractional(1, 1)));
}

@Test
void decimal_from_american_handles_both_signs() {
    assertBigDecimalEquals(new BigDecimal("2.5000"), converter.decimalFromAmerican(150));
    assertBigDecimalEquals(new BigDecimal("1.5000"), converter.decimalFromAmerican(-200));
}
```

Comparisons go through a helper that calls `compareTo`, not `assertEquals` on the `BigDecimal`
directly — `2.0000` and `2.0` are numerically equal but not `.equals()`:

```java
private static void assertBigDecimalEquals(BigDecimal expected, BigDecimal actual) {
    assertEquals(0, expected.compareTo(actual), () -> "expected " + expected + " but was " + actual);
}
```

**The even-money boundary — the one test that pins all four formats against each other at once.**
This is the American sign-flip trap made explicit: `2.0` must land on the *positive* branch.

```java
@Test
void even_money_boundary_agrees_across_all_four_representations() {
    assertBigDecimalEquals(new BigDecimal("2.0000"), converter.decimalFromFractional(new Fractional(1, 1)));
    assertBigDecimalEquals(new BigDecimal("2.0000"), converter.decimalFromAmerican(100));
    assertEquals(100, converter.americanFromDecimal(new BigDecimal("2.0")));
    assertEquals(1, converter.fractionalFromDecimal(new BigDecimal("2.0")).numerator());
    assertEquals(1, converter.fractionalFromDecimal(new BigDecimal("2.0")).denominator());
    assertBigDecimalEquals(new BigDecimal("0.5000"), converter.impliedProbability(new BigDecimal("2.0")));
}
```

**Fractional reduction — 10/4 and 5/2 are the same price and must reduce identically.**

```java
@Test
void fractional_from_decimal_reduces_to_lowest_terms() {
    BigDecimal decimalOdds = converter.decimalFromFractional(new Fractional(10, 4));
    Fractional reduced = converter.fractionalFromDecimal(decimalOdds);
    assertEquals(5, reduced.numerator());
    assertEquals(2, reduced.denominator());
}
```

**Round-trips — a fixed-tolerance check, not exact equality, since rounding is lossy by design.**

```java
@Test
void round_trip_decimal_american_decimal_stays_within_tolerance() {
    BigDecimal original = new BigDecimal("2.5");
    int american = converter.americanFromDecimal(original);
    BigDecimal roundTripped = converter.decimalFromAmerican(american);
    assertWithinTolerance(original, roundTripped);
}
```

`assertWithinTolerance` asserts `expected.subtract(actual).abs().compareTo(TOLERANCE) <= 0` — the
right shape for a lossy round-trip through an integer moneyline, where exact equality would be too
strict.

**Validation — every out-of-domain input throws, including the American-zero and Fractional-record
edges.**

```java
@Test void american_odds_of_zero_is_rejected() {
    assertThrows(IllegalArgumentException.class, () -> converter.decimalFromAmerican(0));
}
@Test void fractional_rejects_non_positive_terms() {
    assertThrows(IllegalArgumentException.class, () -> new Fractional(0, 2));
    assertThrows(IllegalArgumentException.class, () -> new Fractional(5, -2));
}
```

### Implement it

Every method funnels through decimal odds and one fixed rounding policy: `SCALE = 4`,
`RoundingMode.HALF_UP`.

**Decimal ↔ fractional and American** are direct formula translations:

```java
public BigDecimal decimalFromFractional(Fractional fractional) {
    return BigDecimal.valueOf(fractional.numerator())
            .divide(BigDecimal.valueOf(fractional.denominator()), SCALE, ROUNDING)
            .add(BigDecimal.ONE);
}

public BigDecimal decimalFromAmerican(int american) {
    if (american == 0) throw new IllegalArgumentException("american odds cannot be zero");
    if (american > 0) {
        return BigDecimal.valueOf(american).divide(HUNDRED, SCALE, ROUNDING).add(BigDecimal.ONE);
    }
    return HUNDRED.divide(BigDecimal.valueOf(-american), SCALE, ROUNDING).add(BigDecimal.ONE);
}
```

**Implied probability** is `1 / decimalOdds`, guarded by a shared `requireValidDecimalOdds`:

```java
public BigDecimal impliedProbability(BigDecimal decimalOdds) {
    requireValidDecimalOdds(decimalOdds);
    return BigDecimal.ONE.divide(decimalOdds, SCALE, ROUNDING);
}
```

**American from decimal is where the even-money boundary lives** — the branch is `>= 2.0`, not
`> 2.0`, so `2.0` lands on `+100`:

```java
public int americanFromDecimal(BigDecimal decimalOdds) {
    requireValidDecimalOdds(decimalOdds);
    BigDecimal diff = decimalOdds.subtract(BigDecimal.ONE);
    if (decimalOdds.compareTo(TWO) >= 0) {
        return diff.multiply(HUNDRED).setScale(0, ROUNDING).intValueExact();
    }
    BigDecimal ratio = HUNDRED.divide(diff, SCALE, ROUNDING);
    return -ratio.setScale(0, ROUNDING).intValueExact();
}
```

**Fractional reduction reads the `BigDecimal` as an exact integer ratio**, not a looped search for a
denominator and not a `double` cast — `unscaledValue() / 10^scale`, then divide both terms by their
`BigInteger.gcd`:

```java
private static Fractional reduce(BigDecimal value) {
    BigDecimal normalized = value.stripTrailingZeros();
    int scale = normalized.scale();
    BigInteger numerator = scale <= 0
            ? normalized.unscaledValue().multiply(BigInteger.TEN.pow(-scale))
            : normalized.unscaledValue();
    BigInteger denominator = scale <= 0 ? BigInteger.ONE : BigInteger.TEN.pow(scale);
    BigInteger gcd = numerator.gcd(denominator);
    return new Fractional(numerator.divide(gcd).intValueExact(), denominator.divide(gcd).intValueExact());
}
```

`3.50 - 1 = 2.50 = 250/100`, `gcd(250, 100) = 50`, reduces to `5/2` — exact, no floating-point
candidate search.

- **Rounding policy:** one `SCALE`/`RoundingMode` pair applied at every `divide`, so results are
  deterministic and the policy is a single named constant, not scattered magic numbers.
- **Complexity:** O(1) per conversion — a handful of `BigDecimal` operations and one `gcd`.
- **Key gotcha:** `requireValidDecimalOdds` (odds `> 1`) is shared across every method that consumes
  decimal odds, so a bad input is rejected once, consistently, rather than re-checked (or missed) per
  method.

### Common mistakes & senior signal

- **Reaching for `double`.** Passes every hand-checked textbook value, then drifts on round-trips or
  produces a value that's off in the last decimal place under a large batch of conversions. The senior
  move is `BigDecimal` from the first line, with the "why" (exact decimal arithmetic, explicit
  rounding) stated unprompted.
- **`BigDecimal.equals` instead of `compareTo`.** `new BigDecimal("2.0").equals(new
  BigDecimal("2.0000"))` is `false` — `equals` is scale-sensitive. Every comparison, in the
  implementation and in tests, must use `compareTo`; forgetting this makes tests flaky depending on
  incidental trailing zeros.
- **Getting the even-money sign boundary wrong.** American odds have no `-100`/`+0` gap; the branch
  must be `decimalOdds >= 2.0` → positive, not `> 2.0`. Off-by-one here silently mis-prices every
  coin-flip market at exactly the boundary — the one price most likely to appear in a real book.
- **Skipping fraction reduction.** Returning `10/4` for one input and `5/2` for another (the same
  price) breaks equality checks and looks wrong on a board. Reduce with `BigInteger.gcd` from the
  exact unscaled value, not a `double`-cast search for a denominator.
- **Missing validation.** Decimal odds `<= 1`, probability outside `(0, 1)`, and American odds of
  exactly `0` are all out-of-domain inputs that must throw `IllegalArgumentException`, not silently
  produce a nonsense price or divide-by-zero.
- **Extensions worth naming unprompted:** removing the vig (normalising a market's implied
  probabilities that sum to `> 1` back to a fair book) and computing the bookmaker's margin/overround
  — both build directly on `impliedProbability`, and naming them shows you see this as one piece of a
  pricing service, not an isolated formula exercise.

## Overround / De-vig

### Summary

**What this topic covers**
This kata builds an `Overround` class that measures a bookmaker's built-in margin (the "overround",
"vig", or "juice") from a set of decimal odds, and strips that margin back out to recover the
underlying *fair* probabilities — the ones a perfectly efficient, zero-margin market would quote.
Every decimal odds price implies a probability, `p = 1/odds`; sum those across every outcome and a
fair book totals exactly `1.0`. A real bookmaker shortens every price slightly so the book sums to
*more* than `1.0` — that excess is the overround, the house edge baked into the prices. You design a
small four-method API (`bookSum`, `overround`, `fairProbabilities`, `fairOdds`) and implement three
industry-standard de-vig methods — `PROPORTIONAL`, `ADDITIVE`, `POWER` — each a different model of
*how* the bookmaker distributed the margin across outcomes.

**Mental model**
Think of a two-horse race priced at 1.90 / 1.90. Each price implies `1/1.90 ≈ 0.5263`; summed, the
book totals `1.0526` — a 5.26% overround. If both horses were truly 50/50, a fair market would price
them at 2.00 / 2.00. De-vigging recovers the fair split from the shortened prices, and the three
methods differ in *where* they assume the margin was loaded. `PROPORTIONAL` spreads it evenly in
proportion to each outcome's own probability (simple, always well-behaved). `ADDITIVE` shaves an equal
*absolute* slice off every outcome regardless of size — which can drive a longshot negative, a known
failure mode. `POWER` reflects the "favourite-longshot bias" — bookmakers load more margin onto
longshots — by raising every implied probability to a common exponent `k` solved so they sum to `1.0`.

**Key terms**
- **decimal odds / implied probability** — a price where `1/odds` is the implied probability; e.g.
  `2.00` implies 50%.
- **book sum** — `Σ 1/oddsᵢ` across a market; `> 1.0` for a real (over-round) book.
- **overround / vig / juice** — `bookSum − 1`, the bookmaker's built-in margin, e.g. `0.05` = 5%.
- **de-vig / fair probabilities** — probabilities with the margin removed, summing to exactly `1.0`.
- **PROPORTIONAL / ADDITIVE / POWER** — the three margin-removal models: uniform scale-down; equal
  absolute subtraction (clamped at zero); a common exponent `k` solved so `Σ pᵢ^k = 1`.
- **favourite-longshot bias** — the empirical observation that bookmakers price longshots with
  proportionally more margin than favourites; what `POWER` models.
- **arbitrage / negative overround** — a mispriced book where `bookSum < 1`; backing every outcome
  locks in profit.

**Why interviewers ask this**
It is a compact test of numerical discipline in a real financial domain: candidates who reach for
`double` throughout get bitten by compounding rounding error, and candidates who don't renormalise
after adjustment ship probabilities that silently don't sum to 1 — the one invariant the class exists
to guarantee. It also probes root-finding competence: `POWER` has no closed form, so the candidate
must recognise a monotonic function, bracket a root, and bisect with a hard iteration cap rather than
trust an unbounded loop. The senior signal is naming each method's known weakness unprompted, rather
than presenting one formula as "the" answer.

**Common confusions**
- *"The raw `1/odds` values already sum to 1."* — Only for a theoretical fair book; a real market's
  implied probabilities sum to `1 + overround`, precisely the quantity being measured.
- *"Any de-vig method recovers the one 'true' probability."* — Each is a heuristic assumption about
  margin distribution; they disagree except in symmetric (equal-price) books.
- *"The additive method is safe because it's the simplest."* — It is the *most* fragile: once the
  equal absolute share exceeds a longshot's tiny implied probability, it goes negative and must be
  clamped — exactly what forces the renormalisation step.

**What follows from this topic**
Shin's method is the natural next step — a fourth de-vig model that solves for an implied
insider-trading fraction rather than a flat exponent, strictly more accurate than `POWER` for markets
with informed money, at the cost of a 2D solve instead of a 1D bisection. The same `bookSum` primitive
also powers arbitrage detection: flag `overround < 0` as a distinctly mispriced, arbable book.

### Clarify & design the API

Questions to settle before writing a line of logic:

- **Which de-vig method(s) must be supported?** All three classic ones — `PROPORTIONAL`, `ADDITIVE`,
  `POWER` — as a caller-selected `Method` enum, not a single hard-coded formula.
- **Two-way or N-way markets?** Generalise from the start: `List<BigDecimal>` of any size, not a
  fixed pair — a 3-way (soccer) or 20-way (horse race) market must work identically.
- **Must fair probabilities sum to exactly 1?** Yes — the contract's whole point. Every method's raw
  output gets renormalised by its own total, so the invariant holds even where a method's construction
  (additive, after clamping) would otherwise fall short of 1.
- **What counts as invalid input?** An empty odds list, and any single price `<= 1.0` (certainty, or
  not a valid decimal price at all) — both throw `IllegalArgumentException` before arithmetic runs.
- **Precision model?** `BigDecimal` at a fixed working scale for all the "real" arithmetic — this is
  money-adjacent math where `double`'s binary rounding of fractions like `1/3` compounds across a
  multi-leg book. The deliberate exception is `POWER`'s iterative solve, done in `double`.

Commit to this surface:

```java
public final class Overround {
    BigDecimal bookSum(List<BigDecimal> decimalOdds);                              // Σ 1/oddsᵢ
    BigDecimal overround(List<BigDecimal> decimalOdds);                            // bookSum − 1
    List<BigDecimal> fairProbabilities(List<BigDecimal> decimalOdds, Method m);    // sum to 1
    List<BigDecimal> fairOdds(List<BigDecimal> decimalOdds, Method m);             // 1/p
}

public enum Method { PROPORTIONAL, ADDITIVE, POWER }
```

### Write the tests

Pin the measurement contract first (`bookSum`/`overround`), then the de-vig invariant every method
must satisfy, then each method's distinguishing behaviour, then validation.

**Measurement — a known two-way book has a known book sum and overround.**

```java
@Test
void book_sum_and_overround_on_a_known_two_way_book() {
    List<BigDecimal> odds = List.of(bd("1.90"), bd("1.90"));
    assertEquals(1.0526315790, overround.bookSum(odds).doubleValue(), 1e-8);
    assertEquals(0.0526315790, overround.overround(odds).doubleValue(), 1e-8);
}
```

**The de-vig invariant — every method's output sums to exactly 1, on a fair book and a real one.**
A fair (zero-margin) book is the sanity check every method must agree on.

```java
@Test
void fair_book_has_zero_overround_and_every_method_agrees_on_fifty_fifty() {
    List<BigDecimal> odds = List.of(bd("2.0"), bd("2.0"));
    assertEquals(0.0, overround.overround(odds).doubleValue(), DELTA);

    for (Method method : Method.values()) {
        List<BigDecimal> fair = overround.fairProbabilities(odds, method);
        assertEquals(0.5, fair.get(0).doubleValue(), DELTA, method + " outcome 0");
        assertEquals(0.5, fair.get(1).doubleValue(), DELTA, method + " outcome 1");
    }
}

@Test
void every_de_vig_method_returns_probabilities_summing_to_one_for_a_three_way_market() {
    List<BigDecimal> odds = List.of(bd("1.90"), bd("3.60"), bd("4.20"));
    for (Method method : Method.values()) {
        assertEquals(1.0, sum(overround.fairProbabilities(odds, method)), DELTA, method + " sums to 1");
    }
}
```

**Method-specific behaviour — proportional gives exact even shares; additive removes an equal
absolute slice; power converges and preserves the favourite's ranking.**

```java
@Test
void proportional_method_gives_exact_values_on_a_simple_book() {
    List<BigDecimal> odds = List.of(bd("2.0"), bd("2.0"), bd("2.0"));
    List<BigDecimal> fair = overround.fairProbabilities(odds, Method.PROPORTIONAL);
    for (BigDecimal p : fair) {
        assertEquals(1.0 / 3.0, p.doubleValue(), DELTA);
    }
}

@Test
void power_method_converges_and_its_probabilities_sum_to_one() {
    List<BigDecimal> odds = List.of(bd("1.50"), bd("4.00"), bd("6.00"));
    List<BigDecimal> fair = overround.fairProbabilities(odds, Method.POWER);
    assertEquals(1.0, sum(fair), DELTA);
    // Favourite (shortest odds) should still have the highest fair probability.
    assertTrue(fair.get(0).compareTo(fair.get(1)) > 0);
    assertTrue(fair.get(1).compareTo(fair.get(2)) > 0);
}
```

**Fair odds are the reciprocal of fair probabilities, and validation rejects bad prices and empty
markets.**

```java
@Test
void fair_odds_are_the_reciprocal_of_fair_probabilities() {
    List<BigDecimal> odds = List.of(bd("1.90"), bd("3.60"), bd("4.20"));
    List<BigDecimal> fairProbabilities = overround.fairProbabilities(odds, Method.PROPORTIONAL);
    List<BigDecimal> fairOdds = overround.fairOdds(odds, Method.PROPORTIONAL);
    for (int i = 0; i < odds.size(); i++) {
        assertEquals(1.0 / fairProbabilities.get(i).doubleValue(), fairOdds.get(i).doubleValue(), 1e-6);
    }
}

@Test
void odds_at_or_below_one_and_empty_markets_are_rejected() {
    assertThrows(IllegalArgumentException.class, () -> overround.bookSum(List.of(bd("1.0"), bd("2.0"))));
    assertThrows(IllegalArgumentException.class, () -> overround.bookSum(List.of(bd("0.5"), bd("2.0"))));
    assertThrows(IllegalArgumentException.class, () -> overround.bookSum(List.of()));
    assertThrows(IllegalArgumentException.class,
            () -> overround.fairProbabilities(List.of(), Method.POWER));
}
```

### Implement it

`bookSum` and `overround` are one line each once implied probabilities exist; the real work is the
three de-vig adjustments and the shared `normalize` renormalisation that closes out every method.

```java
public BigDecimal bookSum(List<BigDecimal> decimalOdds) {
    validate(decimalOdds);
    return sum(impliedProbabilities(decimalOdds));
}

public BigDecimal overround(List<BigDecimal> decimalOdds) {
    return bookSum(decimalOdds).subtract(BigDecimal.ONE);
}

public List<BigDecimal> fairProbabilities(List<BigDecimal> decimalOdds, Method method) {
    validate(decimalOdds);
    List<BigDecimal> implied = impliedProbabilities(decimalOdds);
    return switch (method) {
        case PROPORTIONAL -> normalize(implied);
        case ADDITIVE -> normalize(additiveAdjust(implied));
        case POWER -> normalize(powerAdjust(implied));
    };
}
```

**Proportional** is `normalize` applied directly to the implied probabilities — divide every value by
the group's own total so it sums to 1. **Additive** subtracts an equal absolute share of the margin
from every outcome and clamps at zero before that same `normalize` call runs:

```java
private static List<BigDecimal> additiveAdjust(List<BigDecimal> implied) {
    BigDecimal margin = sum(implied).subtract(BigDecimal.ONE);
    BigDecimal share = margin.divide(BigDecimal.valueOf(implied.size()), SCALE, ROUNDING);
    List<BigDecimal> adjusted = new ArrayList<>(implied.size());
    for (BigDecimal p : implied) {
        BigDecimal shifted = p.subtract(share);
        adjusted.add(shifted.max(BigDecimal.ZERO));
    }
    return adjusted;
}
```

**Power** raises every implied probability to an exponent `k` found by bisection, then — like the
other two — gets renormalised. The exponent has no closed form, so it is solved numerically by
exploiting one fact: each `pᵢ ∈ (0, 1)`, so `pᵢ^k` is strictly *decreasing* in `k`. That monotonicity
guarantees `f(k) = Σ pᵢ^k − 1` has exactly one root, so a single bracket found by doubling `hi` until
`f(hi) ≤ 0`, then plain bisection — no Newton step, no derivative — converges reliably regardless of
whether the book has positive or negative overround:

```java
private static double solveExponent(List<BigDecimal> implied) {
    double[] p = toDoubles(implied);
    double lo = 0.0, hi = 1.0;
    while (residual(p, hi) > 0 && hi < 1e6) hi *= 2;   // bracket the root

    for (int i = 0; i < MAX_BISECTION_ITERATIONS; i++) {
        double mid = (lo + hi) / 2;
        double residual = residual(p, mid);
        if (Math.abs(residual) < BISECTION_TOLERANCE) return mid;
        if (residual > 0) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2; // best estimate if the loop exhausts without hitting tolerance
}
```

- **Precision:** `BigDecimal` at `SCALE = 10` with `HALF_UP` for every "real" step; `double` only
  inside the bisection, converted back to `BigDecimal` at the end. `hi < 1e6` and
  `MAX_BISECTION_ITERATIONS` both cap their loops — no unbounded iteration on pathological input.
- **Why renormalise always:** for `PROPORTIONAL`/`POWER` it is close to a no-op; for `ADDITIVE` it is
  load-bearing — clamping a longshot at zero leaves the remaining mass short of 1.
- **Complexity:** `PROPORTIONAL`/`ADDITIVE` are `O(n)`; `POWER` is `O(n · iterations)`, bounded by
  `MAX_BISECTION_ITERATIONS` (200), effectively `O(n)` since tolerance (`1e-12`) is hit in a handful
  of steps.

### Common mistakes & senior signal

- **Forgetting to renormalise.** Returning `additiveAdjust`'s raw clamped output without dividing by
  its own total ships probabilities that don't sum to 1 — silently breaking the one property a "fair
  probabilities" method exists to guarantee. Every method must funnel through `normalize`.
- **Additive going negative on longshots without a floor.** `p − margin/n` for a tiny implied
  probability and a large margin goes negative; forgetting `.max(BigDecimal.ZERO)` corrupts the whole
  book. Naming this as a *known weakness* — not a bug to hide — is the senior tell, matching the
  Javadoc's own callout that `fairOdds` can throw `ArithmeticException` for a longshot clamped to zero.
- **Power method with no convergence guarantee.** Bisecting without a hard iteration cap risks an
  infinite loop on pathological input. The correct answer names the monotonicity argument (`pᵢ^k`
  strictly decreasing in `k`) as *why* plain bisection is safe — no Newton step needed.
- **Doing the "real" arithmetic in `double`.** Decimal odds and stake math never uses binary floating
  point: fractions like `1/3` have no exact binary representation and error compounds across a
  multi-leg book. `BigDecimal` is the default; `double` is the deliberate exception for the bisection.
- **Treating one method as "the" correct answer.** All three are heuristic assumptions about *where*
  the margin was loaded. A senior candidate names the trade-off between them and, if asked "which is
  best," names Shin's method as the more accurate but more expensive extension.

## Cross-Book Arbitrage Detector

### Summary

**What this topic covers**
This kata builds an `ArbitrageDetector` that shops the best decimal-odds price for every selection in a market across multiple bookmakers, detects when the combined implied probability of those best prices is a risk-free "surebet" (below 100%), and sizes stakes across the selections so the payout is identical whichever one wins — and strictly exceeds the total staked. You design four small public methods (`bestOdds`, `bookSum`, `isArbitrage`, `stakes`, plus `guaranteedProfit`) around one immutable `Quote` record. It is a `BigDecimal` precision-and-correctness kata dressed as a betting-market problem: the interesting work is the strict-inequality arbitrage condition, the missing-selection edge case, and the rounding trade-off when converting theoretical stakes into whole currency cents.

**Mental model**
Decimal odds `o` mean a stake of 1 returns `o` if the selection wins, so the book is implicitly pricing the outcome's probability at `1/o`. A single honest bookmaker sets its own odds so `Σ(1/oi)` across all selections in a market is slightly *above* 1 — that excess (the "overround" or "vig") is the house edge. But no rule says every book must have the best price on every selection: Book A might have the best price on "Home", Book B the best price on "Away". If you take the *best* price per selection across several competing books, the combined sum can slip *below* 1 — which means the market as a whole is, briefly, offering odds no single rational book would offer alone. At that point there exists a stake split — proportional to each selection's implied probability — that returns the *same* payout no matter which selection wins, and that payout is guaranteed larger than what you staked. This is a real, if narrow and fleeting, source of risk-free profit, and it is the same shape of problem as detecting negative-cost cycles in a graph of exchange rates (FX triangular arbitrage) — implied-probability sum instead of log-rate cycle product.

**Key terms**
- **decimal (European) odds** — a stake of 1 pays back `odds` on a win; `Quote` rejects any odds `<= 1` because that is not a coherent price.
- **implied probability** — `1/odds`; what the market's price says the true win probability is, ignoring margin.
- **overround / vig / bookmaker's margin** — the amount by which one book's own `Σ(1/oi)` exceeds 1; the house edge baked into a single book's own prices.
- **surebet / arbitrage** — a stake split across selections, sourced from the best price per selection *across* books, that guarantees a positive payout regardless of outcome; requires `bookSum < 1` strictly.
- **`bookSum`** — `Σ(1/best_oi)` over the selections in the market, using the best (highest) available price per selection.
- **coverage** — every selection in the market must have at least one quote; a missing selection means the book cannot be hedged and is not tradeable.
- **equalised payout** — the stake sizing rule `stakeI = totalStake * (1/oI) / bookSum`, chosen so `stakeI * oI` is the same constant `P` for every `i`.
- **`MathContext` / `RoundingMode.HALF_UP`** — the fixed intermediate precision (`MathContext(12, HALF_UP)`) used for every `BigDecimal` division so implied-probability arithmetic doesn't accumulate representation error; stakes are separately rounded to 2 decimal places (whole cents) at the very end.
- **strict inequality** — every comparison against 1 uses `BigDecimal.compareTo`, never `==` or floating equality; `bookSum == 1` is break-even, not arbitrage.

**Why interviewers ask this**
It looks like a finance-flavoured data-structure drill but is really a test of numeric discipline and edge-case discovery under a precise mathematical contract. Juniors reach for `double` and `==`, silently corrupting the strict-inequality boundary that defines the whole feature (break-even vs. genuine edge). The senior signal is treating `BigDecimal` and `compareTo` as non-negotiable from the first line, catching the missing-selection case unprompted (an uncovered outcome is not "assume zero", it's "not tradeable at all"), and reasoning explicitly about what happens when you round stakes to real currency — that rounding *is not free*, it can erode or (rarely) invert the theoretical edge, and a production system needs a residual-assignment strategy to preserve it. It is also a nice probe for whether a candidate can derive a formula (`stakeI = totalStake * (1/oI) / bookSum`) from a stated invariant (equal payout `P`) rather than just memorising it.

**Common confusions**
- *"`bookSum < 1` and `bookSum <= 1` are basically the same."* — No: `== 1` is break-even (payout equals stake, zero profit); only strict `< 1` is a genuine, profitable arbitrage.
- *"If a selection has no quote, just skip it / treat its odds as infinite."* — Wrong; an unhedged outcome means you cannot guarantee a payout if it wins, so the whole market is untradeable, not partially tradeable.
- *"Round each stake independently and it all works out."* — Independent per-selection rounding to cents can perturb payouts by a fraction of a cent each, and in aggregate can erode or flip a razor-thin edge; a real venue rounds all-but-one stake and assigns the last to preserve the total (or rounds down for a safety margin).
- *"`double` is fine, odds are just numbers."* — `double` binary floating point cannot represent values like `2.10` exactly, and repeated arithmetic across quotes compounds that error right at the strict `< 1` boundary that defines the feature.
- *"`guaranteedProfit` should be derived from the rounded stakes."* — The solution deliberately reports the *theoretical* unrounded edge from `bookSum`, not a re-derivation from rounded stakes, so it isn't itself subject to rounding erosion; a caller wanting the realized, rounding-adjusted number sums the actual rounded payouts themselves.

**What follows from this topic**
The natural production evolution is **streaming quotes**: books push price updates continuously, so instead of rescanning the full quote list on every check you maintain a live best-price table per selection and incrementally update `bookSum` as quotes arrive or expire — which turns this from a batch computation into a concurrency problem (guarding the shared best-price table with a lock, or sharding per market). It also connects to transaction-cost modelling (commission/stake-limits haircut the edge before summing), stale-price/slippage risk (re-validate every leg immediately before execution and abort the whole split if one leg fails), and multi-currency books (convert to a common currency before summing implied probabilities). The core technique — reduce a set of competing prices to one canonical "best" value, then test an aggregate invariant with strict comparison — reappears anywhere you shop across venues for a best price (FX, order routing, price comparison engines).

### Clarify & design the API

Questions to settle before writing a line of logic:

- **Best price per selection, or per-book totals?** The market is only arbitrageable if you shop the *best* quote for each selection independently across all books — a single book's own quotes almost never sum below 1. `bestOdds` must group by selection and keep the max, not evaluate books in isolation.
- **Tie-breaking?** Two books can quote the exact same best price for a selection. Pick a deterministic rule — book name ascending — so the winner doesn't depend on input list order (needed for reproducible tests and reproducible execution routing).
- **Full selection set vs. whatever quotes happen to exist?** The caller must state the complete selection set for the market (`Set<String> selections`) rather than inferring it from the quotes present, because a *missing* selection is exactly the case that must reject the market — inferring the set from the quotes would silently hide that case.
- **Strict `< 1`, or `<= 1`?** Strict. Break-even (`bookSum == 1`) returns a payout equal to the stake — zero profit, not an arbitrage.
- **What does `bookSum` return when the market is uncoverable?** Design choice: return `BigDecimal.ONE` (which reads as "no arbitrage" to the strict `< 1` check) rather than throwing, so callers can inspect the value without a try/catch; `isArbitrage` and `stakes` layer the actual coverage check and throw/false behaviour on top.
- **Stake rounding?** Real venues only accept whole-cent stakes, so `stakes` rounds to 2 decimal places (`HALF_UP`). Call out — but don't necessarily fix in the kata — that per-selection independent rounding can erode the edge by a fraction of a cent.
- **What happens when you ask for stakes/profit on a non-arbitrage market?** Split the two: `stakes` has no valid equalising split to return, so it throws `IllegalStateException`; `guaranteedProfit` has a perfectly meaningful answer — zero — so it returns `BigDecimal.ZERO` instead of throwing.

Commit to this surface:

```java
public final class ArbitrageDetector {
    Map<String, Quote> bestOdds(List<Quote> quotes);
    BigDecimal bookSum(List<Quote> quotes, Set<String> selections);
    boolean isArbitrage(List<Quote> quotes, Set<String> selections);
    Map<String, BigDecimal> stakes(List<Quote> quotes, Set<String> selections, BigDecimal totalStake);
    BigDecimal guaranteedProfit(List<Quote> quotes, Set<String> selections, BigDecimal totalStake);
}

public record Quote(String book, String selection, BigDecimal odds) {
    // compact constructor rejects blank book/selection and odds <= 1
}
```

### Write the tests

Write these first — they pin the arbitrage condition's strict boundary and the coverage rule before any implementation exists. Group them: `bestOdds` selection/tie-break, a genuine multi-way arbitrage with equalised payouts, the non-arbitrage and break-even rejections, the missing-selection rejection, then a profit-consistency check.

**`bestOdds` picks the highest price per selection and breaks ties by book name.**

```java
@Test
void best_odds_picks_the_highest_price_per_selection_and_breaks_ties_by_book_name() {
    List<Quote> quotes = List.of(
            new Quote("Zeta", "A", new BigDecimal("2.00")),
            new Quote("Alpha", "A", new BigDecimal("2.00")), // ties Zeta; "Alpha" < "Zeta"
            new Quote("Beta", "A", new BigDecimal("1.90")),
            new Quote("Gamma", "B", new BigDecimal("3.50")));

    Map<String, Quote> best = detector.bestOdds(quotes);

    assertEquals("Alpha", best.get("A").book());
    assertEquals(0, new BigDecimal("2.00").compareTo(best.get("A").odds()));
    assertEquals("Gamma", best.get("B").book());
}
```

**A genuine two-way arbitrage is detected, and the resulting stakes equalise the payout above the stake.** This is the heart of the contract: both payout legs must match exactly, and both must beat the total staked.

```java
@Test
void two_way_arbitrage_is_detected_and_stakes_equalise_payout() {
    List<Quote> quotes = List.of(
            new Quote("Pinnacle", "A", new BigDecimal("2.10")),
            new Quote("Bet365", "B", new BigDecimal("2.10")));
    Set<String> selections = Set.of("A", "B");

    assertTrue(detector.isArbitrage(quotes, selections));
    assertEquals(0.952380952, detector.bookSum(quotes, selections).doubleValue(), 1e-6);

    BigDecimal totalStake = new BigDecimal("1000.00");
    Map<String, BigDecimal> stakes = detector.stakes(quotes, selections, totalStake);

    BigDecimal payoutA = stakes.get("A").multiply(new BigDecimal("2.10"));
    BigDecimal payoutB = stakes.get("B").multiply(new BigDecimal("2.10"));

    assertEquals(0, payoutA.compareTo(payoutB), "payout must be equal whichever selection wins");
    assertTrue(payoutA.compareTo(totalStake) > 0, "payout must exceed the amount staked");

    BigDecimal profit = detector.guaranteedProfit(quotes, selections, totalStake);
    assertEquals(0, profit.compareTo(new BigDecimal("50.00")));
}
```

**Non-arbitrage (a single book's own market) and exact break-even are both rejected.** The break-even test is the one that actually pins the strict-inequality decision — `1/2.0 + 1/2.0` sums to exactly 1.

```java
@Test
void a_single_bookmakers_own_market_is_not_an_arbitrage() {
    List<Quote> quotes = List.of(
            new Quote("Pinnacle", "A", new BigDecimal("1.90")),
            new Quote("Pinnacle", "B", new BigDecimal("1.90")));
    Set<String> selections = Set.of("A", "B");

    assertFalse(detector.isArbitrage(quotes, selections));
    assertThrows(IllegalStateException.class,
            () -> detector.stakes(quotes, selections, new BigDecimal("1000")));
    assertEquals(0, detector.guaranteedProfit(quotes, selections, new BigDecimal("1000"))
            .compareTo(BigDecimal.ZERO));
}

@Test
void exact_break_even_is_not_an_arbitrage() {
    List<Quote> quotes = List.of(
            new Quote("Pinnacle", "A", new BigDecimal("2.0")),
            new Quote("Bet365", "B", new BigDecimal("2.0")));
    Set<String> selections = Set.of("A", "B");

    BigDecimal sum = detector.bookSum(quotes, selections);
    assertEquals(0, sum.compareTo(BigDecimal.ONE), "1/2.0 + 1/2.0 must sum to exactly 1");
    assertFalse(detector.isArbitrage(quotes, selections));
}
```

**A selection with no quote at all is not an arbitrage, even if the priced selections would otherwise clear.**

```java
@Test
void a_selection_missing_from_every_quote_is_not_an_arbitrage() {
    List<Quote> quotes = List.of(new Quote("Pinnacle", "A", new BigDecimal("2.10")));
    Set<String> selections = Set.of("A", "B"); // "B" has no quote at all

    assertFalse(detector.isArbitrage(quotes, selections));
    assertThrows(IllegalStateException.class,
            () -> detector.stakes(quotes, selections, new BigDecimal("1000")));
}
```

**`guaranteedProfit` is consistent with `bookSum`, independent of `stakes`' rounding.**

```java
@Test
void guaranteed_profit_is_positive_and_consistent_with_the_book_sum() {
    List<Quote> quotes = List.of(
            new Quote("Pinnacle", "HOME", new BigDecimal("3.10")),
            new Quote("Bet365", "DRAW", new BigDecimal("3.10")),
            new Quote("William Hill", "AWAY", new BigDecimal("3.10")));
    Set<String> selections = Set.of("HOME", "DRAW", "AWAY");
    BigDecimal totalStake = new BigDecimal("1000.00");

    BigDecimal sum = detector.bookSum(quotes, selections);
    BigDecimal profit = detector.guaranteedProfit(quotes, selections, totalStake);

    assertTrue(profit.compareTo(BigDecimal.ZERO) > 0);
    double expected = totalStake.doubleValue() * (1.0 / sum.doubleValue() - 1.0);
    assertEquals(expected, profit.doubleValue(), 0.01);
}
```

A three-way variant (`HOME`/`DRAW`/`AWAY` each at 3.10 from a different book) asserts three equalised payouts up to a one-cent tolerance — the tolerance itself documents that per-selection rounding is expected to introduce a small perturbation.

### Implement it

`bestOdds` is a single pass keeping the max per selection with a two-part comparator (odds, then book name). `bookSum` and `isArbitrage` both need the coverage check — `does every requested selection have a best quote?` — before touching the arithmetic. `stakes` and `guaranteedProfit` both start by calling `isArbitrage` and branching on its result, but differently: one throws, one returns zero.

```java
private static final MathContext MC = new MathContext(12, RoundingMode.HALF_UP);
private static final int STAKE_SCALE = 2;

public Map<String, Quote> bestOdds(List<Quote> quotes) {
    Map<String, Quote> best = new LinkedHashMap<>();
    for (Quote quote : quotes) {
        Quote current = best.get(quote.selection());
        if (current == null || isBetter(quote, current)) {
            best.put(quote.selection(), quote);
        }
    }
    return best;
}

private boolean isBetter(Quote candidate, Quote current) {
    int cmp = candidate.odds().compareTo(current.odds());
    if (cmp != 0) {
        return cmp > 0;
    }
    return candidate.book().compareTo(current.book()) < 0; // tie-break: book name ascending
}

public BigDecimal bookSum(List<Quote> quotes, Set<String> selections) {
    Map<String, Quote> best = bestOdds(quotes);
    if (!best.keySet().containsAll(selections)) {
        return BigDecimal.ONE; // uncoverable market reads as "no arbitrage" downstream
    }
    BigDecimal sum = BigDecimal.ZERO;
    for (String selection : selections) {
        BigDecimal odds = best.get(selection).odds();
        sum = sum.add(BigDecimal.ONE.divide(odds, MC), MC);
    }
    return sum;
}

public boolean isArbitrage(List<Quote> quotes, Set<String> selections) {
    if (selections.isEmpty()) {
        return false;
    }
    Map<String, Quote> best = bestOdds(quotes);
    if (!best.keySet().containsAll(selections)) {
        return false;
    }
    return bookSum(quotes, selections).compareTo(BigDecimal.ONE) < 0; // strict
}
```

Stake sizing derives from the equal-payout invariant `stakeI * oI = P` for every `i`, with `Σ stakeI = totalStake`. Substituting `stakeI = P / oI` into the sum and solving for `P` gives `P = totalStake / bookSum`, so `stakeI = totalStake * (1/oI) / bookSum`:

```java
public Map<String, BigDecimal> stakes(List<Quote> quotes, Set<String> selections, BigDecimal totalStake) {
    if (!isArbitrage(quotes, selections)) {
        throw new IllegalStateException("no arbitrage exists for the given quotes/selections");
    }
    Map<String, Quote> best = bestOdds(quotes);
    BigDecimal sum = bookSum(quotes, selections);
    Map<String, BigDecimal> stakes = new LinkedHashMap<>();
    for (String selection : selections) {
        BigDecimal odds = best.get(selection).odds();
        BigDecimal impliedShare = BigDecimal.ONE.divide(odds, MC);
        BigDecimal stake = totalStake.multiply(impliedShare, MC).divide(sum, MC);
        stakes.put(selection, stake.setScale(STAKE_SCALE, RoundingMode.HALF_UP));
    }
    return stakes;
}

public BigDecimal guaranteedProfit(List<Quote> quotes, Set<String> selections, BigDecimal totalStake) {
    if (!isArbitrage(quotes, selections)) {
        return BigDecimal.ZERO;
    }
    BigDecimal sum = bookSum(quotes, selections);
    BigDecimal payout = totalStake.divide(sum, MC);
    return payout.subtract(totalStake).setScale(STAKE_SCALE, RoundingMode.HALF_UP);
}
```

- **`MathContext(12, HALF_UP)`:** every intermediate division (`1/odds`, the stake formula) uses this fixed 12-digit precision so implied-probability arithmetic doesn't drift; only the *final* stake and profit values are separately rounded to 2 decimal places for currency display. Mixing those two roundings up would push imprecision into the strict `< 1` comparison.
- **Stake rounding is the real subtlety, not an afterthought:** rounding each stake independently to whole cents can make the rounded stakes sum to a few cents more or less than `totalStake`, and since payout-if-`i`-wins is `stakeI * oI`, that rounding also perturbs the equal-payout property and can erode — rarely invert — the theoretical edge. A production system rounds all-but-one stake and assigns the remainder to the last selection (or rounds down and banks the residual as a safety margin) to preserve the edge exactly.
- **`guaranteedProfit` deliberately does not re-derive from the rounded `stakes` map** — it reports the theoretical, unrounded edge straight from `bookSum`, so it isn't itself subject to the rounding erosion above; a caller who needs the realized, rounding-adjusted profit sums the actual rounded payouts themselves.
- **Complexity:** `bestOdds` is O(n) in quotes; `bookSum`/`isArbitrage`/`stakes` are O(k) in the selection count on top of that O(n) scan.

### Common mistakes & senior signal

- **Comparing a book's own odds instead of the best-across-books price.** `bookSum` must be computed from `bestOdds` (the max per selection across *all* quotes), never from one book's own quotes in isolation — a single honest book's own market almost never sums below 1; the edge only appears when you shop across competing books.
- **Treating break-even as an arbitrage.** `bookSum == 1` means the payout exactly equals the stake — zero profit, a guaranteed wash, not a surebet. The strict `< 1` check (via `compareTo`, never `==`) is the entire point of the kata; getting this wrong silently turns "no edge" into "edge".
- **Ignoring a missing selection.** If any selection in the requested set has no quote at all, the outcome cannot be hedged and the market is not tradeable — `bookSum` returning `BigDecimal.ONE` for that case (rather than silently summing over only the covered selections) is what makes the missing-selection case fail the strict-inequality check safely instead of computing a bogus partial arbitrage.
- **Stake rounding eroding the edge.** Rounding every stake independently to whole cents can, in aggregate, shave a few cents off the guaranteed payout or (on a razor-thin edge) flip it negative. The senior answer is to round all-but-one stake and assign the remainder to the last selection (or round down and keep the residual as a margin) — and to know `guaranteedProfit` intentionally reports the theoretical, not the rounded-realized, number.
- **`double` instead of `BigDecimal`.** Decimal odds like `2.10` aren't exactly representable in binary floating point, and the whole feature hinges on a strict comparison at a boundary (`bookSum < 1`) that floating-point error can flip in either direction. `BigDecimal` with a fixed `MathContext` and explicit `RoundingMode` is non-negotiable here, not a style preference.
- **Extension to name:** a streaming-quotes variant, where books push continuous price updates and the detector maintains a live best-price table per selection, incrementally updating `bookSum` as quotes arrive or expire instead of rescanning the full list — which turns this from a batch computation into a concurrency problem (guarding the shared best-price table with a lock or sharding it per market).

## Hash Map From Scratch

### Summary

**What this topic covers**
This kata builds `MyHashMap<K, V>` — the data structure behind `java.util.HashMap` — from first principles: `put`, `get`, `remove`, `size`, `containsKey`. It is not a wrapper over `java.util.HashMap`; you own the bucket array, the hash spreading, the collision strategy, and the resize. The point is to make the four ideas that make a hash map O(1)-average explicit and testable: the `equals`/`hashCode` contract that key lookup depends on, bit-spreading a hash before masking it to an index, separate chaining for collisions, and load-factor-triggered resize-and-rehash. A `null` key is a first-class, deterministically-routed case, not a special path bolted on.

**Mental model**
A hash map is an array of buckets where each bucket is a small list (a *chain*) of entries whose keys hashed to that index. `put`/`get`/`remove` all start the same way: spread the key's `hashCode()` (XOR-fold the high 16 bits into the low 16 — `h ^ (h >>> 16)`), then mask it down to a bucket index with `hash & (capacity - 1)`. That AND-mask is only a valid substitute for `% capacity` when capacity is a power of two — it is the reason capacity is always rounded up to the next power of two and only ever doubled. Within a bucket, equality is decided by `equals()`, never `==` — two distinct objects that are `.equals()` must resolve to the *same* entry, which is only possible if they also share a `hashCode()` (the contract). As entries accumulate past `size > capacity * 0.75` (the load factor), the table doubles and every existing node is *rehashed* — re-bucketed against the new capacity — not reallocated, since a node's key/value never changes, only which bucket it lives in.

**Key terms**
- **`equals`/`hashCode` contract** — objects that are `.equals()` MUST return the same `hashCode()`; violate it and a key silently becomes unfindable after insertion (it hashes to a different bucket than the one it was compared against).
- **spread hash** — `h ^ (h >>> 16)`, XOR-folding a hash's high bits into its low bits so low-entropy hash codes (small `Integer`s, short `String`s) still spread across a small capacity.
- **power-of-two capacity** — capacity is always `2^n`; `hash & (capacity - 1)` is then equivalent to `hash % capacity` but is a single AND instead of a division.
- **separate chaining** — each bucket is a singly linked list of `Node`s; collisions just extend the chain instead of needing a second probe strategy.
- **load factor** — the fill ratio (`0.75` here) past which the table resizes; it trades memory (lower factor, shorter chains, more buckets) against time (higher factor, longer chains, less memory).
- **resize / rehash** — doubling the bucket array and re-linking every existing node against the new capacity; O(n) per resize, amortised O(1) per `put` across all resizes (same argument as `ArrayList` growth).
- **generic array creation** — Java forbids `new Node<K,V>[n]` outright (type erasure means there is no reified `K`/`V` for the JVM to check on array store); the standard workaround is a raw `new Node[n]` cast to `Node<K,V>[]`.
- **open addressing** — the alternative collision strategy to chaining: probe for the next free *slot* in the array itself instead of linking a list.
- **tombstone** — a "deleted" marker used in open addressing so a probe sequence doesn't stop early at a hole left by a real deletion.
- **treeify** — converting a pathologically long bucket chain into a balanced tree (red-black, keyed by `hashCode()`) so a worst-case bucket degrades to O(log n) instead of O(n).

**Why interviewers ask this**
It tests whether "I know HashMap is O(1)" is backed by an actual mental model or just memorised trivia. The senior signal is naming the `equals`/`hashCode` contract *unprompted* and explaining what breaks if it's violated, knowing *why* capacity must be a power of two (the AND-instead-of-modulo trick), and being able to reason about the amortised cost of resize rather than treating it as magic. It also probes generics fluency: `new Node<K,V>[]` failing to compile, and why the fix is a raw-array cast rather than `new Object[n]` (an `Object[]` is not a `Node[]` — the array-type cast throws `ClassCastException` at the point of use). A candidate who reaches for open addressing or treeification as *extensions* rather than starting requirements shows they know the trade-off space, not just one implementation.

**Common confusions**
- *"You can hash straight to an index with `hashCode() % capacity`."* — Without spreading, low-entropy hash codes collide far more than necessary once capacity is small; spreading folds high-bit entropy down first.
- *"Any capacity works as long as you mask with `& (capacity - 1)`."* — That mask is only equivalent to modulo when capacity is a power of two; on a non-power-of-two capacity it silently produces wrong (out-of-range or biased) indices.
- *"Resize is a reallocation of new entries."* — Nodes are moved, not recreated: the cached `hash` is reused, only the bucket assignment changes.
- *"`null` keys need a special-cased branch everywhere."* — Here `null` just spreads to hash `0` and is routed to bucket 0 like any other key; no `if (key == null)` scattered through `put`/`get`/`remove`.
- *"Casting `(Node<K,V>[]) new Object[n]` is fine."* — It compiles but throws `ClassCastException` at runtime; only casting from a raw `Node[]` (not `Object[]`) works, because the runtime array type must actually be `Node[]`.

**What follows from this topic**
This is the substrate for anything "cache-shaped": the **[[cache]]** kata's LRU builds an eviction policy *on top of* a hash map (hash map for O(1) lookup + a doubly linked list for O(1) recency reordering) — you cannot build an LRU without first having this. It also connects to the interview-standard "design a `HashMap`" and "why does Java forbid generic arrays" questions, and to `ConcurrentHashMap`'s bin-locking story (see the idempotent-processor kata) once you add concurrency on top.

### Clarify & design the API

Questions worth settling before writing logic:

- **What is key identity?** `equals()`, never reference equality — two distinct-but-equal instances (`new String("x")` twice) must resolve to the same entry, matching `java.util.HashMap`'s contract.
- **Is `null` a valid key?** Yes — deterministically routed to a bucket (here, bucket 0 via `spread(null) == 0`), not rejected or special-cased away.
- **What triggers resize, and by how much?** Load factor `0.75`; doubling (not incrementing) keeps capacity a power of two, which the index mask depends on.
- **Initial capacity contract?** Round up to the next power of two; reject non-positive requested capacities.
- **What does `put` return?** The previous value (or `null` if absent) — mirrors `Map.put`.

Commit to this surface:

```java
public final class MyHashMap<K, V> {
    public MyHashMap();                     // default capacity 16
    public MyHashMap(int initialCapacity);  // rounded up to next power of two

    public V put(K key, V value);           // returns previous value, or null
    public V get(K key);                    // null if absent
    public boolean containsKey(K key);
    public V remove(K key);                 // returns removed value, or null
    public int size();
}
```

### Write the tests

Write these first: basic round-trip, collision handling with a hand-crafted colliding key, `null`-key support, and resize correctness across many entries — including from a tiny initial capacity, to force several resizes.

**Basic contract — round trip, overwrite returns the previous value, missing key is `null`.**

```java
@Test
void put_and_get_round_trip() {
    MyHashMap<String, Integer> map = new MyHashMap<>();
    map.put("a", 1);
    assertEquals(1, map.get("a"));
}

@Test
void put_returns_previous_value_on_overwrite() {
    MyHashMap<String, Integer> map = new MyHashMap<>();
    assertNull(map.put("a", 1));
    assertEquals(1, map.put("a", 2));
    assertEquals(2, map.get("a"));
    assertEquals(1, map.size());
}
```

**Collision handling — a key whose `hashCode()` is a constant forces every instance into one bucket chain.** This is the test that actually exercises chaining rather than the happy path where every key lands in its own bucket.

```java
@Test
void colliding_keys_are_both_stored_in_the_same_bucket() {
    MyHashMap<CollidingKey, String> map = new MyHashMap<>();
    CollidingKey k1 = new CollidingKey(1);
    CollidingKey k2 = new CollidingKey(2);

    map.put(k1, "one");
    map.put(k2, "two");

    assertEquals("one", map.get(k1));
    assertEquals("two", map.get(k2));
    assertEquals(2, map.size());
}

@Test
void remove_from_middle_of_a_collision_chain_preserves_the_rest() {
    MyHashMap<CollidingKey, String> map = new MyHashMap<>();
    CollidingKey k1 = new CollidingKey(1);
    CollidingKey k2 = new CollidingKey(2);
    CollidingKey k3 = new CollidingKey(3);
    map.put(k1, "one"); map.put(k2, "two"); map.put(k3, "three");

    assertEquals("two", map.remove(k2));

    assertEquals("one", map.get(k1));
    assertNull(map.get(k2));
    assertEquals("three", map.get(k3));
    assertEquals(2, map.size());
}

/** A key whose hashCode is constant so every instance collides into one bucket. */
private static final class CollidingKey {
    private final int id;
    CollidingKey(int id) { this.id = id; }

    @Override public int hashCode() { return 42; }
    @Override public boolean equals(Object o) {
        return o instanceof CollidingKey other && other.id == id;
    }
}
```

**`null` key — supported like any other key, including overwrite and removal.**

```java
@Test
void null_key_is_supported() {
    MyHashMap<String, Integer> map = new MyHashMap<>();

    assertNull(map.put(null, 1));
    assertTrue(map.containsKey(null));
    assertEquals(1, map.get(null));

    assertEquals(1, map.put(null, 2));
    assertEquals(2, map.remove(null));

    assertNull(map.get(null));
    assertFalse(map.containsKey(null));
}
```

**Resize correctness — every entry must survive doubling, including starting from a capacity of 1 (forcing many resizes on the way to 1000 entries).**

```java
@Test
void resize_preserves_all_entries() {
    MyHashMap<Integer, Integer> map = new MyHashMap<>();
    for (int i = 0; i < 1_000; i++) map.put(i, i * i);

    assertEquals(1_000, map.size());
    for (int i = 0; i < 1_000; i++) assertEquals(i * i, map.get(i));
}

@Test
void resize_preserves_entries_starting_from_a_tiny_initial_capacity() {
    MyHashMap<Integer, Integer> map = new MyHashMap<>(1);
    for (int i = 0; i < 200; i++) map.put(i, i);

    assertEquals(200, map.size());
    for (int i = 0; i < 200; i++) assertEquals(i, map.get(i));
}

@Test
void non_positive_initial_capacity_is_rejected() {
    assertThrows(IllegalArgumentException.class, () -> new MyHashMap<Integer, Integer>(0));
    assertThrows(IllegalArgumentException.class, () -> new MyHashMap<Integer, Integer>(-1));
}
```

### Implement it

Four pieces, in order: the bucket array (and why it needs an unchecked cast), the spread-and-mask index function, chain traversal shared by `put`/`get`/`remove`, and resize.

**The generic-array trap.** `new Node<K,V>[capacity]` does not compile — Java forbids generic array creation because type erasure leaves no reified `K`/`V` for the JVM to check on array store. The fix `java.util.HashMap` itself uses: allocate a **raw** `Node[]` and cast to `Node<K,V>[]`. The cast is unchecked but safe because the array is private and every element ever stored is a `Node<K,V>` this class constructed itself.

```java
@SuppressWarnings("unchecked")
private Node<K, V>[] newTable(int capacity) {
    return (Node<K, V>[]) new Node[capacity];   // raw Node[], NOT new Object[capacity]
}
```

Casting from `new Object[capacity]` instead would compile identically but throw `ClassCastException` the first time the array is used as `Node[]` — the runtime array type genuinely has to be `Node[]`, not `Object[]`, because array types are reified even though generics are erased.

**Spread the hash, then mask to a power-of-two index.**

```java
private static int spread(Object key) {
    if (key == null) return 0;
    int h = key.hashCode();
    return h ^ (h >>> 16);          // fold high bits into low bits
}

private static int indexFor(int hash, int capacity) {
    return hash & (capacity - 1);   // valid only because capacity is always a power of two
}
```

**`put` walks the target bucket's chain for an existing key (via `equals`), else prepends a new node.**

```java
public V put(K key, V value) {
    int hash = spread(key);
    int idx = indexFor(hash, buckets.length);
    for (Node<K, V> node = buckets[idx]; node != null; node = node.next) {
        if (node.hash == hash && Objects.equals(node.key, key)) {
            V previous = node.value;
            node.value = value;
            return previous;
        }
    }
    buckets[idx] = new Node<>(hash, key, value, buckets[idx]);
    size++;
    if (size > threshold) resize();
    return null;
}
```

`get`/`containsKey`/`remove` share the same `spread` → `indexFor` → chain-walk with `Objects.equals`; `remove` additionally tracks `prev` to unlink without breaking the rest of the chain.

**Resize doubles capacity and re-links every node — moved, not recreated.**

```java
private void resize() {
    Node<K, V>[] old = buckets;
    int newCapacity = old.length * 2;
    Node<K, V>[] newBuckets = newTable(newCapacity);
    for (Node<K, V> head : old) {
        Node<K, V> node = head;
        while (node != null) {
            Node<K, V> next = node.next;
            int idx = indexFor(node.hash, newCapacity);
            node.next = newBuckets[idx];
            newBuckets[idx] = node;
            node = next;
        }
    }
    buckets = newBuckets;
    threshold = (int) (newCapacity * LOAD_FACTOR);
}
```

- **Complexity:** O(1) average for `get`/`put`/`remove` (short chains); O(n) worst case if every key collides into one bucket (a pathological or adversarial `hashCode()`). Resize is O(n) but amortises to O(1) per `put`, same argument as `ArrayList` growth.
- **Key gotcha:** a resize does *not* recompute hashes — the cached `hash` field on each `Node` is reused, since a key's `hashCode()` doesn't change across a resize, only which bucket `hash & (newCapacity - 1)` now points to.

### Common mistakes & senior signal

- **Violating the `equals`/`hashCode` contract.** Overriding `equals()` without `hashCode()` (or vice versa) means two "equal" keys can spread to different buckets — a `put` with one instance becomes permanently unfindable via the other. Naming this contract unprompted, not just "override both," is the senior tell.
- **Using `hashCode() % capacity` without spreading.** Works, but degrades badly for low-entropy hash codes (small `Integer`s, short `String`s) against a small power-of-two capacity — the high bits of the hash never influence a small mask. The spread step (`h ^ (h >>> 16)`) exists specifically to fix that.
- **Growing capacity by anything other than doubling.** The `hash & (capacity - 1)` trick is only valid when capacity is a power of two; growing by, say, +50% would silently break every future index lookup.
- **The `new Object[n]` cast.** Compiles, throws `ClassCastException` on first use. The only safe unchecked cast is from a raw `Node[]`, never `Object[]` — array types are reified even though generic type parameters are erased.
- **Reference-equality shortcuts (`node.key == key`).** Breaks the map contract for any two `.equals()`-but-distinct key instances; must always be `Objects.equals(node.key, key)` (which also handles `null` keys for free).
- **Named extensions (from the solution's Javadoc), the natural senior follow-ups:**
  - **Open addressing** — linear or quadratic probing packs entries directly into the array (better cache locality, no per-entry `Node` allocation) but needs **tombstone** markers on deletion so a probe sequence doesn't stop early at a hole, and suffers clustering at high load factor.
  - **Treeify hot buckets** — once a bucket's chain exceeds a threshold (`java.util.HashMap` treeifies at 8), convert it to a red-black tree keyed by `hashCode()` so a pathological chain degrades to O(log n) instead of O(n) — the real-world defence against hash-flooding attacks.

See also **[[cache]]** — an LRU cache is this hash map plus a doubly linked list for O(1) recency tracking; you need this kata's O(1) lookup before that one's eviction policy makes sense.

## Ring Buffer — Bounded Queue

### Summary

**What this topic covers**
This kata builds `RingBuffer<E>` — a fixed-capacity FIFO queue backed by a single array, the classic circular buffer behind `java.util.ArrayDeque`, a JVM async logger ring, or an audio driver's playback buffer. A producer `offer`s elements, a consumer `poll`s them, and the buffer never grows past its construction-time `capacity`: once full, `offer` reports failure rather than overwriting or resizing, leaving the backpressure decision (drop, block, apply pressure upstream) to the caller. The whole exercise is mechanical correctness under index arithmetic — modular head/tail cursors that wrap around the backing array — plus the classic full-vs-empty ambiguity that trips up a surprising number of candidates on a whiteboard.

**Mental model**
One `Object[] elements` plus three cursors: `head` (index of the next element to poll), `tail` (index of the next free slot to offer into), and `count` (how many live elements there are right now). Both `head` and `tail` only ever move forward, modulo `capacity` — `(index + 1) % elements.length` — so when either would run off the end of the array it snaps back to `0` instead. No element is ever copied and the array is never reallocated after construction, so `offer`/`poll` are O(1) with zero per-element allocation — the entire cost is one array write/read and one modulo. The one wrinkle that defines the whole class: with only `head` and `tail`, `head == tail` is ambiguous — it means both "just constructed, nothing offered yet" and "tail has wrapped all the way around and lapped head". This implementation resolves the ambiguity with a third field, `count`, as the single source of truth for `isEmpty()`/`isFull()`/`size()`, so every real array slot stays usable and no method needs a special case for the wrap point.

**Key terms**
- **circular / ring buffer** — a fixed-length array where the logical "ends" wrap around to index 0, so the structure behaves like a queue without ever shifting elements.
- **`head`** — index of the next element `poll`/`peek` will return; advances on every successful `poll`.
- **`tail`** — index of the next free slot `offer` will write into; advances on every successful `offer`.
- **modular wrap-around** — `index = (index + 1) % capacity`; the mechanism that turns a linear array into a logical ring.
- **full/empty ambiguity** — the classic circular-buffer trap: `head == tail` alone cannot distinguish "empty" from "full".
- **count field vs. slot-burning** — the two textbook fixes for the ambiguity: track a separate live-element counter (this class), or deliberately waste one array slot so `tail` can never fully lap `head`.
- **FIFO order** — first offered, first polled; preserved across any number of wraps.
- **generic array creation** — `new E[capacity]` is illegal under erasure; the standard workaround is a raw `Object[]` with an unchecked-but-safe cast on read.
- **bounded / fixed-capacity** — capacity is set once at construction and never changes; there is no amortised-growth story like a resizable `ArrayList`.

**Why interviewers ask this**
It is a compact test of whether a candidate can reason precisely about array indices under a wrap-around invariant — a skill that shows up anywhere a fixed-size window or lock-free structure is on the table. The naive first attempt almost always uses only `head`/`tail` and silently breaks on the empty-vs-full case; the senior signal is naming that ambiguity *before* writing code and picking one of the two fixes deliberately, rather than discovering the bug from a failing test. It also probes whether someone reaches for the right invariant at each capacity boundary (capacity 1 is the sharpest edge case — it alternates between empty and full on every single operation) and whether they know why `Object[]` shows up instead of `E[]`.

**Common confusions**
- *"`head == tail` means empty."* — Only sometimes; after `capacity` offers with no polls, `tail` has wrapped back to equal `head` again while the buffer is completely full.
- *"I need to special-case the wrap in `offer`/`poll`."* — Not with a `count` field: `isFull()`/`isEmpty()` are answered directly from `count`, so `offer`/`poll` never branch on where the cursors happen to sit relative to each other.
- *"Offering into a full buffer should overwrite the oldest element."* — Some ring buffers (metrics samplers, "last N" windows) do that by design, but this one is a bounded *queue*: `offer` returns `false` and leaves the buffer untouched, pushing the drop/overwrite/block decision to the caller.
- *"`poll` on empty should throw."* — This API returns `null`, mirroring `Queue.poll()`'s "best-effort, no exception" contract rather than `Queue.remove()`'s throwing one.
- *"A generic `E[]` array is just cleaner."* — `new E[capacity]` doesn't compile; `Object[]` plus a cast on read (`(E) elements[i]`) is the idiomatic workaround because the class alone controls what goes in, so the cast can never actually fail.

**What follows from this topic**
The concurrent, thread-safe cousin of this exact bounded-queue contract is **[[blockingqueue]]** — same full/empty semantics, but `offer`/`poll` block or time out instead of returning `false`/`null`, guarded by a lock and condition variables. Pushing further into "no lock at all, single producer/single consumer" territory is **[[lockfree]]**: swap `head`/`tail` for `volatile`/`AtomicInteger` cursors, re-derive full/empty from the cursors themselves instead of a shared `count` (a plain `int` written by one thread and read by another has no happens-before edge), and the array-of-slots layout here is exactly the structure that pattern reuses.

### Clarify & design the API

Questions worth settling before writing a line of index arithmetic:

- **What happens when full?** `offer` fails fast — returns `false`, leaves the buffer unchanged — rather than overwriting the oldest element or growing. That is the "queue" reading of a ring buffer, as opposed to the "rolling window" reading.
- **What happens when empty?** `poll`/`peek` return `null` rather than throwing, matching `Queue.poll()`'s non-throwing contract.
- **How is full-vs-empty disambiguated?** Either burn one array slot (max usable capacity is `capacity - 1`) or track a separate `count`. Pick `count`: it keeps every constructed slot usable and keeps the cursor math branch-free.
- **Backing storage?** A single fixed-length array allocated once at construction; no per-element boxing/allocation on `offer`/`poll` beyond the generic-erasure cast.
- **Validation?** Reject non-positive capacity at construction — a zero- or negative-capacity ring buffer is meaningless.

Commit to this surface:

```java
public final class RingBuffer<E> {
    public RingBuffer(int capacity);   // throws IllegalArgumentException if capacity <= 0

    public boolean offer(E e);         // false (buffer unchanged) if full
    public E poll();                   // null if empty; advances head
    public E peek();                   // null if empty; does not advance head

    public int size();
    public boolean isEmpty();
    public boolean isFull();
    public int capacity();             // fixed at construction, never changes
}
```

### Write the tests

Write these first: basic FIFO contract, full/empty edge behaviour, the wrap-around case that actually exercises the modular arithmetic, and the boundary conditions (`capacity == 1`, repeated wraps) that catch an off-by-one in the index math.

**Basic contract — FIFO order, `peek` doesn't consume, `offer`/`poll` at the boundaries.**

```java
@Test
void offer_then_poll_returns_elements_in_fifo_order() {
    RingBuffer<String> buffer = new RingBuffer<>(3);
    assertTrue(buffer.offer("a"));
    assertTrue(buffer.offer("b"));
    assertTrue(buffer.offer("c"));
    assertEquals("a", buffer.poll());
    assertEquals("b", buffer.poll());
    assertEquals("c", buffer.poll());
}

@Test
void peek_returns_head_without_removing_it() {
    RingBuffer<Integer> buffer = new RingBuffer<>(2);
    buffer.offer(1);
    buffer.offer(2);
    assertEquals(1, buffer.peek());
    assertEquals(1, buffer.peek());     // still there
    assertEquals(2, buffer.size());
}
```

**Full/empty semantics — the two "leave it alone" edge cases that a naive implementation gets wrong.**

```java
@Test
void offer_when_full_returns_false_and_leaves_contents_unchanged() {
    RingBuffer<Integer> buffer = new RingBuffer<>(2);
    buffer.offer(1);
    buffer.offer(2);
    assertTrue(buffer.isFull());
    assertFalse(buffer.offer(3));       // rejected, not overwritten
    assertEquals(2, buffer.size());
    assertEquals(1, buffer.poll());     // original contents intact
    assertEquals(2, buffer.poll());
}

@Test
void poll_and_peek_on_empty_buffer_return_null() {
    RingBuffer<String> buffer = new RingBuffer<>(4);
    assertNull(buffer.poll());
    assertNull(buffer.peek());
}
```

**Wrap-around — the test that actually proves the modular cursor math, not just the FIFO contract in isolation.**

```java
@Test
void wrap_around_preserves_fifo_order_once_tail_crosses_the_array_end() {
    RingBuffer<Integer> buffer = new RingBuffer<>(3);
    buffer.offer(1);
    buffer.offer(2);
    buffer.offer(3);
    assertEquals(1, buffer.poll());     // head advances, freeing a slot near the array start
    assertEquals(2, buffer.poll());
    buffer.offer(4);                    // tail wraps past the end of the backing array
    buffer.offer(5);
    assertEquals(3, buffer.poll());
    assertEquals(4, buffer.poll());
    assertEquals(5, buffer.poll());
    assertTrue(buffer.isEmpty());
}

@Test
void repeated_wrap_around_over_many_cycles_stays_correct() {
    RingBuffer<Integer> buffer = new RingBuffer<>(4);
    int nextValue = 0;
    for (int cycle = 0; cycle < 10; cycle++) {
        buffer.offer(nextValue++);
        buffer.offer(nextValue++);
        buffer.offer(nextValue++);
        assertEquals(nextValue - 3, buffer.poll());
        assertEquals(nextValue - 2, buffer.poll());
        assertEquals(nextValue - 1, buffer.poll());
        assertTrue(buffer.isEmpty());
    }
}
```

**Boundary — `capacity == 1` is the sharpest edge, alternating full/empty every single call; plus construction validation.**

```java
@Test
void capacity_of_one_alternates_between_empty_and_full() {
    RingBuffer<String> buffer = new RingBuffer<>(1);
    assertTrue(buffer.isEmpty());
    assertTrue(buffer.offer("only"));
    assertTrue(buffer.isFull());
    assertFalse(buffer.offer("second"));
    assertEquals("only", buffer.poll());
    assertTrue(buffer.isEmpty());
}

@Test
void non_positive_capacity_is_rejected() {
    assertThrows(IllegalArgumentException.class, () -> new RingBuffer<Integer>(0));
    assertThrows(IllegalArgumentException.class, () -> new RingBuffer<Integer>(-3));
}
```

A `size()`/`isEmpty()`/`isFull()` transition test walks the same buffer through empty → partial → full → partial → empty, asserting all three predicates stay consistent with each other at every step — the cheapest way to catch a `count` update that drifts out of sync with the cursors.

### Implement it

Three fields carry the whole class: the backing `Object[] elements`, and `head`/`tail`/`count` as `int`s. `offer` and `poll` are symmetric — guard on `isFull()`/`isEmpty()`, touch one slot, advance one cursor modulo `elements.length`, and keep `count` in lock-step.

```java
public final class RingBuffer<E> {

    // Object[] rather than E[]: generic array creation (`new E[capacity]`) is illegal because the
    // component type is erased at runtime. Casting on read is the standard, unchecked-but-safe
    // workaround: this class alone controls what goes into the array, so the cast can never fail.
    private final Object[] elements;
    private int head;
    private int tail;
    private int count;

    public RingBuffer(int capacity) {
        if (capacity <= 0) {
            throw new IllegalArgumentException("capacity must be positive: " + capacity);
        }
        this.elements = new Object[capacity];
    }

    public boolean offer(E e) {
        if (isFull()) {
            return false;
        }
        elements[tail] = e;
        tail = (tail + 1) % elements.length;
        count++;
        return true;
    }

    @SuppressWarnings("unchecked")
    public E poll() {
        if (isEmpty()) {
            return null;
        }
        E value = (E) elements[head];
        elements[head] = null;              // drop the reference so a polled object isn't pinned
        head = (head + 1) % elements.length;
        count--;
        return value;
    }

    @SuppressWarnings("unchecked")
    public E peek() {
        if (isEmpty()) {
            return null;
        }
        return (E) elements[head];
    }

    public int size()       { return count; }
    public boolean isEmpty(){ return count == 0; }
    public boolean isFull() { return count == elements.length; }
    public int capacity()   { return elements.length; }
}
```

- **Wrap-around mechanism:** `(cursor + 1) % elements.length` on every successful `offer`/`poll`. No branch for "did we hit the end" — the modulo handles it uniformly whether or not a wrap actually occurs this call.
- **Full/empty disambiguation:** `count`, not cursor comparison. `isFull()`/`isEmpty()` never look at `head`/`tail` at all, which is what keeps `offer`/`poll` free of a special-cased wrap check.
- **Complexity:** O(1) time, O(1) additional space per `offer`/`poll` — no element is ever copied or the array reallocated after construction.
- **Key gotcha:** `poll` nulls out the vacated slot (`elements[head] = null`) before advancing `head`. Skipping that line doesn't break correctness (the slot gets overwritten on the next wrap-around `offer` to that index) but it pins the polled object in memory until the ring wraps back around — a silent memory leak in a long-lived buffer holding large objects.

### Common mistakes & senior signal

- **The `head == tail` trap.** Using only two cursors and comparing them directly is the single most common bug — it conflates "just constructed" with "just filled to capacity" because `tail` laps `head` on the `capacity`-th offer. Naming this ambiguity before writing `isFull()` is the senior tell; picking a fix deliberately (count field vs. burn one slot) rather than debugging it out of a failing test is the stronger one.
- **Off-by-one on the modulo.** `tail = (tail + 1) % elements.length` is correct; `tail = tail == elements.length ? 0 : tail + 1` (or worse, forgetting to wrap at all and indexing out of bounds) is the kind of bug that only surfaces once a test actually crosses the array boundary — which is why `wrap_around_preserves_fifo_order_once_tail_crosses_the_array_end` and the repeated-cycle test exist rather than testing capacity-and-under only.
- **Growing instead of rejecting.** Reaching for `Arrays.copyOf` on a full buffer turns a bounded, latency-sensitive structure into an `ArrayList` with extra steps, defeating the entire point of a fixed-capacity ring — `offer` must fail fast and let the caller decide (drop/block/backpressure).
- **Leaking references on `poll`.** Forgetting `elements[head] = null` after reading it out is correct but leaky — the stale reference keeps a (potentially large) object alive until the slot is overwritten by a future wrap, which can be an arbitrarily long time in a low-throughput buffer.
- **Skipping `capacity == 1`.** The smallest capacity is the sharpest edge case — every single `offer` immediately makes it full, every single `poll` immediately makes it empty — and is exactly where an implicit "leave one slot empty" assumption (the slot-burning alternative to `count`) would silently cap real capacity at zero.
- **Named extensions, for when asked "what would you add?"**: an `Iterable<E>` walking `count` elements from `head` in logical (not backing-array) order via a custom `Iterator`; a double-ended variant (`offerFirst`/`offerLast`, `pollFirst`/`pollLast`) by allowing `head` to decrement as well as increment, modulo `capacity`; and the lock-free single-producer/single-consumer cousin — `volatile`/`AtomicInteger` cursors instead of a shared `count`, re-deriving full/empty from the cursors themselves, since a plain `int` written by one thread and read by another has no happens-before guarantee (see **[[lockfree]]**). The thread-safe, blocking-instead-of-failing sibling of this exact contract is **[[blockingqueue]]**.

## Binary Heap — Priority Queue

### Summary

**What this topic covers**
This kata builds `BinaryHeap<E>` — the array-backed structure behind `java.util.PriorityQueue`. You implement `add`, `peek`, `poll`, `size`, `isEmpty`, plus a bulk-build constructor that heapifies an existing collection in O(n). There is no linked node, no pointer chasing: a heap is a *complete binary tree* stored implicitly in a flat `Object[]`, where a node's children and parent are computed from its index. The whole exercise is two small tree-walk operations — sift-up on insert, sift-down on remove — plus the one insight (Floyd's algorithm) that turns "build from n items" into O(n) instead of O(n log n). It is also a clean vehicle for a Java-specific wrinkle: generic array creation is erased at runtime, so the backing store has to be a raw `Object[]` with casts, exactly like the JDK's own `PriorityQueue`.

**Mental model**
Picture the tree drawn out level by level, then read it left-to-right into an array — that reading order *is* the storage layout. For a node at index `i`: left child at `2i+1`, right child at `2i+2`, parent at `(i-1)/2` (integer division). Completeness — every level full except possibly the last, which fills left-to-right with no gaps — is what makes this indexing scheme valid; a tree with a hole partway through a level would not map onto a dense array. The heap-order invariant is weaker than a sorted structure: every parent compares "not after" its children (`cmp.compare(parent, child) <= 0` for a min-heap), but siblings and separate subtrees have no ordering relationship at all. Only the root is guaranteed to be the extreme element. That weaker invariant is the whole performance story — `add` and `poll` only ever touch a single root-to-leaf path, which is `O(log n)` deep because the tree is complete, instead of the `O(n)` a fully sorted array would need to keep sorted.

**Key terms**
- **complete binary tree** — every level full except possibly the last, which fills left-to-right; the property that lets the tree be array-backed with no pointers.
- **implicit tree / array-backed** — child/parent relationships are computed from index arithmetic (`2i+1`, `2i+2`, `(i-1)/2`), not stored as references.
- **heap-order invariant** — every parent compares "not after" its children under the comparator; weaker than a total order, so only the root is pinned.
- **sift-up (bubble-up)** — after appending at the last slot, swap upward while the new element compares before its parent. Used by `add`.
- **sift-down (bubble-down)** — after moving the last element into a vacated slot, swap downward with the "better" child while it compares before the parent. Used by `poll`.
- **heapify (Floyd's build-heap)** — bottom-up sift-down from the last non-leaf index to the root; builds a valid heap from n items in O(n) total, not O(n log n).
- **natural ordering vs `Comparator`** — the no-arg constructor casts elements to `Comparable`; an explicit `Comparator` decouples the heap from `E` needing to implement anything.
- **generic array erasure** — Java forbids `new E[cap]`; the backing store is `Object[]` with a cast on every read, same as `java.util.PriorityQueue`.
- **`decreaseKey`** — the classic heap extension: an auxiliary element-to-index map turns "find an arbitrary element, then re-sift it" from O(n) into O(log n); what Dijkstra's algorithm needs.
- **d-ary heap** — widen fan-out from 2 children to d; shallower tree (cheaper sift-up) at the cost of more per-level comparisons on sift-down.

**Why interviewers ask this**
A heap is the single most-reused structure in the "design an algorithm" half of an interview — top-k, Dijkstra, merge-k-sorted-lists, task scheduling all reduce to "give me the extreme element, repeatedly, with cheap updates." Asking a candidate to build one from scratch (not just call `PriorityQueue`) tests whether they actually understand *why* it is O(log n) rather than treating it as a black box. The senior signal is deriving the index arithmetic from "complete tree stored in array" rather than memorizing `2i+1`/`2i+2`, explaining why heap order is weaker than sorted (and why that's exactly what makes it fast), and volunteering Floyd's O(n) heapify instead of defaulting to n sequential `add` calls when asked to build from a collection. Bonus points for naming `decreaseKey` and the element-to-index map unprompted — it's the detail that separates "I've implemented a heap" from "I've implemented Dijkstra's algorithm with one."

**Common confusions**
- *"Heap order means the array is sorted."* — No. Only the parent-child edges are ordered; `elements[1]` and `elements[2]` (siblings) have no defined relationship, and neither do arbitrary cross-subtree pairs.
- *"Building from n items by calling `add` n times is the best you can do."* — That's O(n log n). Loading all items first, then sifting down from the last non-leaf index to the root, is O(n) — Floyd's algorithm.
- *"`peek` should sift or search."* — The root is always at index 0 by the invariant; `peek` is a plain array read, O(1).
- *"The heap needs `E extends Comparable<E>`."* — Only the no-arg (natural-ordering) path needs that, and it's enforced at compare-time via a `ClassCastException`, not encoded as a compile-time bound — so the same class works with any `E` when you pass a `Comparator`.
- *"A `PriorityQueue`-style heap gives sorted iteration."* — It doesn't; iterating the backing array directly yields heap order, not sorted order. Only repeated `poll()` yields sorted order.

**What follows from this topic**
The bounded min-heap in **[[topk]]** is this same structure with one twist: cap the size at k and evict the root on overflow, turning "keep the k largest" into an O(n log k) streaming algorithm instead of sorting everything. **[[scheduler]]** reaches for the same priority-queue shape to always dispatch the next-due task in O(log n). The `decreaseKey` extension is also the piece that turns this heap into Dijkstra's shortest-path priority queue — the reason the "auxiliary index map" detail matters beyond this kata.

### Clarify & design the API

Questions worth settling before writing logic:

- **Min-heap or max-heap by default?** Min-heap: the no-arg constructor mirrors `java.util.PriorityQueue`'s natural-ordering default, where the smallest element is the root. A max-heap is just `Comparator.reverseOrder()`.
- **Comparable-only, or pluggable ordering?** Both — a no-arg constructor for `Comparable` elements, plus a `Comparator`-taking constructor so the class works for types with no natural order (or a custom order for a `Comparable` type).
- **Empty-heap behaviour for `peek`/`poll`?** Return `null` rather than throwing — mirrors `PriorityQueue.poll()`/`peek()`, and callers can loop `while ((e = heap.poll()) != null)`.
- **Bulk construction?** A `Collection` + `Comparator` constructor that heapifies in O(n) — the point being to *not* pay O(n log n) via repeated `add`.
- **Growth strategy?** Amortised doubling on overflow, same as `ArrayList`/`PriorityQueue` — keeps `add` amortised O(log n) rather than O(n) on every insert.

Commit to this surface:

```java
public final class BinaryHeap<E> {
    public BinaryHeap();                                             // natural ordering, min-heap
    public BinaryHeap(Comparator<? super E> cmp);                    // explicit ordering
    public BinaryHeap(Collection<? extends E> items, Comparator<? super E> cmp); // O(n) heapify

    public void add(E e);      // sift-up, amortised O(log n)
    public E peek();           // O(1), null if empty
    public E poll();           // sift-down, O(log n), null if empty
    public int size();
    public boolean isEmpty();
}
```

### Write the tests

Write these first — they pin the contract before any sift logic exists. Group them: empty-heap edge cases, ordering under the default and an injected comparator, duplicates, the heapify constructor, and a scale test that forces array growth.

**Empty heap — `peek`/`poll` return `null`, never throw.**

```java
@Test
void empty_heap_peek_and_poll_return_null() {
    BinaryHeap<Integer> heap = new BinaryHeap<>();
    assertTrue(heap.isEmpty());
    assertEquals(0, heap.size());
    assertNull(heap.peek());
    assertNull(heap.poll());
}
```

**Default ordering — natural order, min first.** This is the ordering guarantee the whole class exists to provide: repeated `poll()` drains ascending regardless of insertion order.

```java
@Test
void default_ctor_polls_in_ascending_order_min_heap() {
    BinaryHeap<Integer> heap = new BinaryHeap<>();
    heap.add(5);
    heap.add(1);
    heap.add(4);
    heap.add(2);
    heap.add(3);

    assertEquals(5, heap.size());
    assertEquals(1, heap.poll());
    assertEquals(2, heap.poll());
    assertEquals(3, heap.poll());
    assertEquals(4, heap.poll());
    assertEquals(5, heap.poll());
    assertTrue(heap.isEmpty());
}

@Test
void peek_returns_root_without_removing_it() {
    BinaryHeap<Integer> heap = new BinaryHeap<>();
    heap.add(3);
    heap.add(1);
    heap.add(2);

    assertEquals(1, heap.peek());
    assertEquals(3, heap.size());   // unchanged — peek does not remove
    assertEquals(1, heap.peek());
}
```

**Injected `Comparator` — prove the heap is not hardwired to natural order.** `Comparator.reverseOrder()` turns the same class into a max-heap with zero code changes.

```java
@Test
void comparator_reverse_order_makes_a_max_heap() {
    BinaryHeap<Integer> heap = new BinaryHeap<>(Comparator.reverseOrder());
    heap.add(5);
    heap.add(1);
    heap.add(4);
    heap.add(2);
    heap.add(3);

    assertEquals(5, heap.poll());
    assertEquals(4, heap.poll());
    assertEquals(3, heap.poll());
    assertEquals(2, heap.poll());
    assertEquals(1, heap.poll());
}
```

**Duplicates, and drain-to-empty-then-poll-again.** Duplicates are all retained (a heap is a multiset, not a set); polling past empty settles back to `null` rather than throwing.

```java
@Test
void duplicate_elements_are_all_retained_and_ordered() {
    BinaryHeap<Integer> heap = new BinaryHeap<>();
    heap.add(2); heap.add(2); heap.add(1); heap.add(1); heap.add(2);

    assertEquals(5, heap.size());
    assertEquals(1, heap.poll());
    assertEquals(1, heap.poll());
    assertEquals(2, heap.poll());
    assertEquals(2, heap.poll());
    assertEquals(2, heap.poll());
}
```

**Heapify constructor — build from a `Collection` in one shot and drain sorted.** This is the O(n) path; the test doesn't assert complexity directly, but pairs with the doc comment's claim that this beats n sequential `add` calls.

```java
@Test
void heapify_constructor_builds_from_a_collection_and_drains_sorted() {
    List<Integer> items = List.of(9, 3, 7, 1, 8, 2, 6, 4, 5, 0);
    BinaryHeap<Integer> heap = new BinaryHeap<>(items, Comparator.naturalOrder());

    assertEquals(items.size(), heap.size());
    for (int expected = 0; expected <= 9; expected++) {
        assertEquals(expected, heap.poll());
    }
    assertTrue(heap.isEmpty());
}

@Test
void heapify_constructor_with_empty_collection_is_an_empty_heap() {
    BinaryHeap<Integer> heap = new BinaryHeap<>(List.<Integer>of(), Comparator.naturalOrder());
    assertTrue(heap.isEmpty());
    assertNull(heap.poll());
}
```

**Scale test — forces at least one capacity-growth cycle.** A thousand descending inserts, then a fully ascending drain, is the cheapest way to exercise `ensureCapacity`'s doubling without asserting on internal array length.

```java
@Test
void handles_many_elements_across_capacity_growth() {
    BinaryHeap<Integer> heap = new BinaryHeap<>();
    int n = 1_000;
    for (int i = n - 1; i >= 0; i--) {
        heap.add(i);
    }
    assertEquals(n, heap.size());
    for (int expected = 0; expected < n; expected++) {
        assertEquals(expected, heap.poll());
    }
}
```

### Implement it

The backing store is `Object[] elements` plus `int size` — the array *is* the tree; nothing else is stored. `add` appends then sifts up; `poll` swaps the last element into the root slot then sifts down. Both sift operations only ever touch one root-to-leaf path.

```java
public final class BinaryHeap<E> {

    private Object[] elements;
    private int size;
    private final Comparator<? super E> comparator;

    private static final int DEFAULT_CAPACITY = 16;

    public BinaryHeap() {
        this(BinaryHeap.<E>naturalOrderComparator());
    }

    public BinaryHeap(Comparator<? super E> cmp) {
        if (cmp == null) throw new IllegalArgumentException("comparator must not be null");
        this.comparator = cmp;
        this.elements = new Object[DEFAULT_CAPACITY];
        this.size = 0;
    }

    public BinaryHeap(Collection<? extends E> items, Comparator<? super E> cmp) {
        if (cmp == null) throw new IllegalArgumentException("comparator must not be null");
        this.comparator = cmp;
        this.elements = items.toArray(new Object[0]);
        this.size = elements.length;
        if (this.elements.length == 0) {
            this.elements = new Object[DEFAULT_CAPACITY];
        }
        for (int i = parentOf(size - 1); i >= 0; i--) {   // Floyd: bottom-up, internal nodes only
            siftDown(i);
        }
    }

    @SuppressWarnings("unchecked")
    private static <T> Comparator<T> naturalOrderComparator() {
        return (a, b) -> ((Comparable<T>) a).compareTo(b);
    }

    public void add(E e) {
        ensureCapacity(size + 1);
        elements[size] = e;
        size++;
        siftUp(size - 1);
    }

    @SuppressWarnings("unchecked")
    public E peek() {
        return size == 0 ? null : (E) elements[0];
    }

    @SuppressWarnings("unchecked")
    public E poll() {
        if (size == 0) return null;
        E root = (E) elements[0];
        size--;
        elements[0] = elements[size];   // last element takes the root's place
        elements[size] = null;
        if (size > 0) siftDown(0);
        return root;
    }

    private void siftUp(int i) {
        while (i > 0) {
            int parent = parentOf(i);
            if (compare(i, parent) >= 0) break;
            swap(i, parent);
            i = parent;
        }
    }

    private void siftDown(int i) {
        while (true) {
            int left = 2 * i + 1;
            int right = 2 * i + 2;
            int smallest = i;
            if (left < size && compare(left, smallest) < 0) smallest = left;
            if (right < size && compare(right, smallest) < 0) smallest = right;
            if (smallest == i) break;
            swap(i, smallest);
            i = smallest;
        }
    }

    private static int parentOf(int i) {
        return (i - 1) / 2;
    }
}
```

- **Index arithmetic:** `2i+1` / `2i+2` for children, `(i-1)/2` for parent — derives directly from reading a complete tree level-by-level into an array; no lookup table needed.
- **`siftUp` after `add`:** the new element only ever needs to climb past *ancestors*, since everything else in the tree already satisfies heap order. Stops the moment it finds a parent it doesn't beat.
- **`siftDown` after `poll`:** the element dropped into the root slot only ever needs to descend, picking the smaller (or larger, under the comparator) of its two children at each level so it doesn't skip over a still-smaller node.
- **Floyd's heapify:** starting the bottom-up sift-down at `parentOf(size - 1)` (the last non-leaf) skips leaves entirely — they're trivially valid heaps with no children to violate — and fixing bottom-up means every `siftDown` only ever moves an element into a subtree that's already valid. That's what gets the total cost to O(n) rather than O(n log n).
- **`Object[]` and the cast:** Java erases `E` at runtime, so `new E[cap]` doesn't compile; the array is raw `Object[]` and every read casts back, exactly mirroring `java.util.PriorityQueue`'s own field.
- **Complexity:** `add`/`poll` are O(log n) (bounded by tree height); `peek`/`size`/`isEmpty` are O(1); the collection constructor is O(n).

### Common mistakes & senior signal

- **Confusing heap order with sorted order.** Iterating the raw array (or asserting `elements[1] < elements[2]`) is *not* a valid heap check — only parent-child edges are ordered. The only way to read sorted order out is repeated `poll()`.
- **Building from a collection with n `add` calls.** Correct, but O(n log n). Naming Floyd's bottom-up sift-down (O(n)) unprompted — and explaining *why* it's O(n) (leaves are free, bottom-up keeps every sift landing in an already-valid subtree) — is the senior signal.
- **Forgetting the last-element-to-root swap on `poll`.** A common bug is sifting down from the *removed* slot instead of moving the last element into the root first — that leaves a hole partway through the tree, breaking completeness.
- **Encoding `E extends Comparable<E>` as a class-level bound.** That forecloses ever using the class with a `Comparator` for non-Comparable types. The real solution's no-arg constructor pushes the constraint to a `ClassCastException` at compare time instead — matching `java.util.PriorityQueue`'s own design.
- **`ArrayList<E>` instead of `Object[]`.** Sidesteps the erasure cast but adds a layer of boxing/indirection for what's fundamentally a flat array; worth naming as the trade-off, not just picking one silently.
- **Not naming the extensions.** `decreaseKey` (an auxiliary element-to-index map, turning "find and re-sift an arbitrary element" from O(n) into O(log n) — what Dijkstra's algorithm and [[topk]]'s bounded-heap tracker both lean on) and the **d-ary heap** (wider fan-out, shallower tree, tunable per workload) are the two extensions worth volunteering when asked "how would you make this faster for use case X."

## Dynamic Array (ArrayList)

### Summary

**What this topic covers**
This kata builds `DynamicArray<E>`, the index-based growable array behind `java.util.ArrayList`. It is backed by a single `Object[]` that grows geometrically as elements are appended, giving O(1) *amortised* `add(E)` and O(1) random access via `get(int)`. Indexed `add(int, E)` and `remove(int)` stay O(n) because they must shift the tail to keep the backing array dense and contiguous — that shift is the fundamental trade-off against a linked structure, which gets O(1) insert/remove at a known node but loses O(1) indexing. You design the public surface (`add`, `get`, `set`, `remove`, `size`, `isEmpty`), the private growth policy, and the two distinct bounds checks. This is a mechanics kata: the real deliverable is getting the size/capacity bookkeeping, the growth formula, and the `System.arraycopy` shifts exactly right.

**Mental model**
Two numbers matter and must never be conflated: **size** (how many logical elements are stored — what `size()` returns and what the API's bounds checks are relative to) and **capacity** (`elements.length` — how many *slots* the backing array currently has, always `>= size`, with the extra slots unused headroom). Every mutation that could exceed capacity calls `ensureCapacity` first, which reallocates a *bigger* array and copies the old contents in — the array itself never grows in place (Java arrays are fixed-length), so "growing" always means allocate-new + copy + swap the reference. Because reallocation is amortised across many appends (most appends just write into existing headroom), the average cost per `add` stays O(1) even though any single call might trigger an O(n) copy.

**Key terms**
- **size vs capacity** — size is the logical element count; capacity is `elements.length`, the physical slot count. `size <= capacity` always holds.
- **geometric growth** — capacity grows by a constant *multiple* of itself (here `oldCapacity + (oldCapacity >> 1)`, i.e. ~1.5x) rather than a constant increment, so the number of resizes needed to reach N elements is O(log N), not O(N).
- **amortised O(1)** — the *average* cost per `add` across a long sequence is O(1), even though individual calls that trigger a resize cost O(n); the geometric series of copy costs sums to a constant multiple of N total.
- **`System.arraycopy`** — the JVM intrinsic bulk-copy used both to grow the backing array (`Arrays.copyOf`, which calls it internally) and to shift elements during indexed insert/remove; far faster than a manual loop.
- **type erasure** — generics are compile-time-only in Java; `new E[capacity]` does not compile, so the backing store must be declared `Object[]` and cast back to `E` on read.
- **unchecked cast** — the `@SuppressWarnings("unchecked")` cast from `Object` to `E` in `get`/`set`/`remove`; safe here only because every *write* path is typed `E`.
- **dense/contiguous** — the array has no gaps between index 0 and `size - 1`; insert/remove must shift elements to preserve this.
- **fail-fast iterator** — an iterator that detects structural modification during iteration (via a `modCount` counter) and throws rather than returning corrupted results.

**Why interviewers ask this**
It looks trivial ("just wrap an array") but cleanly separates candidates who understand *why* `ArrayList` is O(1) amortised from those who only know that it is. The senior signal is explaining the growth factor trade-off unprompted — doubling (2x) is the textbook default, but the JDK's real `ArrayList` uses ~1.5x specifically because after several resizes a freed 2x-oversized array can never be reused to satisfy a later allocation of the *same* size class in some allocators/GCs, while a 1.5x-grown array leaves less permanently wasted headroom; both keep the amortised bound but trade memory against resize frequency. The rest of the kata is a clean test of care with array indices: two different bounds-check ranges, an off-by-one in the shift direction, and the classic generic-array-creation problem from erasure.

**Common confusions**
- *"`add` is always O(1)."* — Only amortised. The call that crosses the capacity boundary is O(n) (allocate + copy); it is the *average* over many calls that is O(1).
- *"Doubling and 1.5x are the same idea, so it doesn't matter which."* — Both give amortised O(1), but doubling wastes up to 50% of the array as unused headroom right after a resize; 1.5x wastes less at the cost of resizing slightly more often. It's a memory/CPU trade-off, not a correctness one.
- *"`get`/`set`/`remove` and `add(int, e)` use the same bounds check."* — They don't: `get`/`set`/`remove` require `0 <= index < size` (index must name an *existing* element); `add(int, e)` additionally allows `index == size` (append via the indexed overload).
- *"Since it's generic, just do `new E[capacity]`."* — Doesn't compile; erasure means the JVM has no runtime `E` to instantiate. Use `Object[]` and cast on read.
- *"`remove` just decrements `size`; no need to touch the last slot."* — It must null out `elements[size]` after the shift, or the removed reference stays reachable from the array past the logical end — a quiet memory leak.

**What follows from this topic**
The same "size vs capacity + geometric growth" story reappears wherever a data structure amortises resizes over a stream of operations — most directly **[[hashmap]]**'s bucket-array resize-on-load-factor and **[[ringbuffer]]**'s fixed-capacity, wraparound-indexed buffer (which trades growth for a hard capacity bound instead). The unchecked-cast-over-`Object[]` pattern for a generic array is the same trick both of those use. The two possible extensions — a fail-fast `Iterator` with `modCount`, and a public `ensureCapacity` — are exactly the features `java.util.ArrayList` ships that this kata's minimal surface omits.

### Clarify & design the API

Questions to settle before writing a line of logic:

- **What's the element type story?** Generic `DynamicArray<E>`, so the backing store can't be `E[]` (erasure) — commit to `Object[]` plus an unchecked cast on every read.
- **Which operations does the contract need?** `add(E)` (append), `add(int, E)` (indexed insert), `get(int)`, `set(int, E)`, `remove(int)`, `size()`, `isEmpty()` — the minimal `ArrayList`-like surface, no iteration, no bulk ops.
- **What are the two bounds-check ranges?** Access-by-existing-index (`get`/`set`/`remove`: `0 <= index < size`) vs insert-index (`add(int, e)`: `0 <= index <= size`, since appending at `size` is valid).
- **What does the constructor accept?** A no-arg constructor with a sane default capacity (10, matching `ArrayList`), and an `initialCapacity` overload that rejects negative values.
- **What's the growth trigger and formula?** Check capacity *before* every write that could exceed it (`ensureCapacity(size + 1)`), grow by `oldCapacity + (oldCapacity >> 1)` (~1.5x), and fall back to `minCapacity` itself when 1.5x isn't enough yet (small/zero starting capacities).

Commit to this surface:

```java
public final class DynamicArray<E> {
    public DynamicArray();
    public DynamicArray(int initialCapacity);   // throws IllegalArgumentException if < 0

    public void add(E e);                        // append, amortised O(1)
    public void add(int index, E e);              // insert, O(n) shift; 0 <= index <= size
    public E get(int index);                      // O(1); 0 <= index < size
    public E set(int index, E e);                  // O(1), returns old value; 0 <= index < size
    public E remove(int index);                    // O(n) shift, returns removed value; 0 <= index < size
    public int size();
    public boolean isEmpty();
}
```

### Write the tests

No tests ship with `practice/` — design your own, but they should pin the same contract the reference suite does. Group them: empty/basic contract, growth across a resize boundary, indexed insert/remove shift direction, and the two distinct bounds-check ranges.

**Basic contract — empty on construction, append preserves order.**

```java
@Test
void new_array_is_empty() {
    DynamicArray<String> array = new DynamicArray<>();
    assertTrue(array.isEmpty());
    assertEquals(0, array.size());
}

@Test
void append_and_get_return_values_in_order() {
    DynamicArray<String> array = new DynamicArray<>();
    array.add("a");
    array.add("b");
    array.add("c");
    assertEquals(3, array.size());
    assertEquals("a", array.get(0));
    assertEquals("b", array.get(1));
    assertEquals("c", array.get(2));
}
```

**Growth — the whole point of the kata.** Start from a deliberately tiny capacity so multiple resizes fire, and assert every element survives every reallocation in order. This is the test that would catch a growth-formula bug (e.g. forgetting the `newCapacity < minCapacity` fallback for capacity 0/1) that unit tests on a default-sized array would never exercise.

```java
@Test
void growth_across_the_capacity_boundary_preserves_all_elements() {
    DynamicArray<Integer> array = new DynamicArray<>(2); // tiny initial capacity forces resizes
    for (int i = 0; i < 20; i++) {
        array.add(i);
    }
    assertEquals(20, array.size());
    for (int i = 0; i < 20; i++) {
        assertEquals(i, array.get(i));
    }
}
```

**Indexed insert/remove — shift direction, and the `index == size` append edge case.**

```java
@Test
void insert_at_the_front_shifts_everything_right() {
    DynamicArray<String> array = arrayOf("b", "c");
    array.add(0, "a");
    assertEquals(3, array.size());
    assertEquals("a", array.get(0));
    assertEquals("b", array.get(1));
    assertEquals("c", array.get(2));
}

@Test
void insert_at_size_behaves_like_append() {
    DynamicArray<String> array = arrayOf("a", "b");
    array.add(2, "c");
    assertEquals(3, array.size());
    assertEquals("c", array.get(2));
}

@Test
void remove_shifts_the_tail_left_and_returns_the_removed_element() {
    DynamicArray<String> array = arrayOf("a", "b", "c", "d");
    String removed = array.remove(1);
    assertEquals("b", removed);
    assertEquals(3, array.size());
    assertEquals("a", array.get(0));
    assertEquals("c", array.get(1));
    assertEquals("d", array.get(2));
}
```

**Bounds checks — the two ranges, tested at both edges.**

```java
@Test
void get_out_of_bounds_throws() {
    DynamicArray<String> array = arrayOf("a");
    assertThrows(IndexOutOfBoundsException.class, () -> array.get(-1));
    assertThrows(IndexOutOfBoundsException.class, () -> array.get(1)); // == size, invalid for get
}

@Test
void indexed_add_out_of_bounds_throws() {
    DynamicArray<String> array = arrayOf("a");
    assertThrows(IndexOutOfBoundsException.class, () -> array.add(-1, "x"));
    assertThrows(IndexOutOfBoundsException.class, () -> array.add(2, "x")); // > size, invalid for insert
}

@Test
void negative_initial_capacity_is_rejected() {
    assertThrows(IllegalArgumentException.class, () -> new DynamicArray<String>(-1));
}

private static DynamicArray<String> arrayOf(String... values) {
    DynamicArray<String> array = new DynamicArray<>();
    for (String v : values) array.add(v);
    return array;
}
```

### Implement it

The backing store is `Object[] elements` plus an `int size`. Every public mutator that can exceed capacity calls `ensureCapacity` first; every indexed accessor calls one of two bounds checks first.

```java
public final class DynamicArray<E> {
    private static final int DEFAULT_CAPACITY = 10;

    private Object[] elements;
    private int size;

    public DynamicArray() {
        this(DEFAULT_CAPACITY);
    }

    public DynamicArray(int initialCapacity) {
        if (initialCapacity < 0) {
            throw new IllegalArgumentException("initialCapacity must be >= 0: " + initialCapacity);
        }
        this.elements = new Object[initialCapacity];
    }

    public void add(E e) {
        ensureCapacity(size + 1);
        elements[size++] = e;
    }

    public void add(int index, E e) {
        checkIndexForInsert(index);
        ensureCapacity(size + 1);
        System.arraycopy(elements, index, elements, index + 1, size - index); // open a gap
        elements[index] = e;
        size++;
    }

    @SuppressWarnings("unchecked") // only add/set ever write a slot, always with an E
    public E get(int index) {
        checkIndexForAccess(index);
        return (E) elements[index];
    }

    @SuppressWarnings("unchecked")
    public E remove(int index) {
        checkIndexForAccess(index);
        E removed = (E) elements[index];
        int numMoved = size - index - 1;
        if (numMoved > 0) {
            System.arraycopy(elements, index + 1, elements, index, numMoved); // close the gap
        }
        size--;
        elements[size] = null; // drop the reference so it isn't pinned past the logical end
        return removed;
    }

    private void ensureCapacity(int minCapacity) {
        if (minCapacity <= elements.length) return;
        int oldCapacity = elements.length;
        int newCapacity = oldCapacity + (oldCapacity >> 1); // ~1.5x
        if (newCapacity < minCapacity) {
            newCapacity = minCapacity; // covers capacity 0/1 where 1.5x alone can't catch up
        }
        elements = Arrays.copyOf(elements, newCapacity);
    }

    private void checkIndexForAccess(int index) {   // get/set/remove: index must name an existing element
        if (index < 0 || index >= size) {
            throw new IndexOutOfBoundsException("Index: " + index + ", Size: " + size);
        }
    }

    private void checkIndexForInsert(int index) {    // add(index, e): index may additionally equal size
        if (index < 0 || index > size) {
            throw new IndexOutOfBoundsException("Index: " + index + ", Size: " + size);
        }
    }
}
```

- **Why 1.5x, not doubling:** doubling is the textbook default; the JDK's real `ArrayList` uses ~1.5x to trade a few more resizes for less permanently wasted headroom. Both are geometric, so both keep N appends at O(N) total work — each element is copied only O(log N) times across all resizes, and the resulting geometric series of copy costs sums to a constant multiple of N.
- **Why `System.arraycopy`, not a loop:** it's a JVM intrinsic bulk-copy, used both inside `Arrays.copyOf` (growth) and directly for the insert/remove shifts — the shift direction matters: insert copies `[index, size)` right *before* writing the new element; remove copies `[index + 1, size)` left *after* saving the removed value.
- **Complexity:** `add`/`get`/`set` are O(1) amortised/worst-case; `add(int,·)`/`remove(int)` are O(n) worst-case (the shift), O(1) only at the tail (`index == size - 1`).
- **Key gotcha:** the `newCapacity < minCapacity` fallback. Without it, growing from capacity 0 or 1 computes `0 + 0 = 0` or `1 + 0 = 1` — the array never actually grows and the next write throws `ArrayIndexOutOfBoundsException` deep inside the "safe" growable structure.

### Common mistakes & senior signal

- **Conflating size and capacity.** Bounds checks, loops, and the growth trigger must all be relative to `size`, never `elements.length`. Using `elements.length` anywhere in the public-facing logic silently exposes uninitialised slots.
- **Growth formula edge case.** Forgetting the `newCapacity < minCapacity` fallback breaks growth from a tiny (0 or 1) initial capacity — exactly what the "growth across the capacity boundary" test is designed to catch. A candidate who reasons about this unprompted, rather than discovering it via a failing test, is showing the senior signal.
- **Conflating the two bounds-check ranges.** `get`/`set`/`remove` require `0 <= index < size`; `add(int, e)` additionally allows `index == size`. Reusing one check for both either wrongly rejects a valid append-via-insert or wrongly accepts an out-of-range `get`.
- **Wrong shift order/direction.** Insert must open the gap (copy right) *before* writing the new element, or the write clobbers a live slot; remove must copy left *then* decrement `size`, or the arithmetic is off by one.
- **Forgetting to null the vacated slot after `remove`.** Skipping `elements[size] = null` leaves a reference alive past the logical end of the array — a genuine, if minor, memory leak (the object can't be GC'd while the array holds it).
- **`new E[capacity]` instead of `Object[]`.** The classic type-erasure trap — doesn't compile, because there is no runtime `E` to reify. The fix is `Object[]` plus a documented unchecked cast, safe only because every write path is statically typed `E`.
- **Named extensions from the Javadoc, worth raising unprompted:** a **fail-fast `Iterator`** (track `modCount`, bump it on every structural change, check it in `next()`/`hasNext()` — the same mechanism `ArrayList` uses to throw `ConcurrentModificationException`); a public **`ensureCapacity(int)`** hook so a caller who knows the eventual size can pre-size once and skip intermediate resizes; and **shrinking** — halving the backing array when `size` falls far enough below capacity (e.g. below a quarter) to bound memory after a large removal burst, using the same amortised argument as growth run in reverse.

## Money — equals / hashCode / Comparable

### Summary

**What this topic covers**
This kata builds an immutable `Money` value type wrapping a `BigDecimal` amount and a currency-code `String`, and uses it as the textbook exercise in making `equals`, `hashCode`, and `compareTo` mutually consistent. The trap is `BigDecimal` itself: `new BigDecimal("2.0")` and `new BigDecimal("2.00")` are numerically the same value but carry different *scale*, and `BigDecimal.equals` treats scale as part of state — so a naive `Money` that stores the caller's raw `BigDecimal` fails `equals` (and lands in different `HashMap` buckets) for two amounts a human would call identical. `Money` closes the gap by canonicalising the scale in the constructor, so every downstream comparison — `equals`, `hashCode`, `compareTo`, and safe use as a `HashMap`/`HashSet` key — agrees on what "the same amount" means.

**Mental model**
Two competing notions of "equal" collide on `BigDecimal`: *numeric* equality (`compareTo() == 0`, what `5.0` and `5.00` mean to a human) and *representational* equality (`equals()`, which also compares scale). Pick one and normalise to it at the boundary rather than juggling both downstream. `Money` normalises on construction — `amount.setScale(SCALE, RoundingMode.HALF_EVEN)` — so by the time any comparison runs, two logically-equal amounts are the *same* `BigDecimal` object state (same unscaled value, same scale). That single decision makes every other method trivial: `equals`/`hashCode` become a plain field comparison, and `compareTo` (needed for cross-scale correctness anywhere a raw `BigDecimal` is compared) agrees with `equals` because there is no scale drift left to disagree about. The second mental model is the *partial order*: `compareTo` only means something within one currency, so it throws across currencies rather than inventing a nonsensical ordering.

**Key terms**
- **equals/hashCode contract** — reflexive (`x.equals(x)`), symmetric (`x.equals(y) == y.equals(x)`), transitive (`x.equals(y) && y.equals(z) ⟹ x.equals(z)`), consistent (repeated calls give the same answer absent mutation), and `x.equals(null) == false`. `hashCode` must additionally agree: equal objects *must* produce equal hash codes (the reverse need not hold).
- **scale** — the number of digits after the decimal point a `BigDecimal` records as part of its state; `2.0` (scale 1) and `2.00` (scale 2) are numerically equal but not `.equals()`-equal.
- **`BigDecimal.equals` vs `compareTo`** — `equals` is scale-sensitive (representational); `compareTo` (and therefore `compareTo() == 0`) is scale-insensitive (numeric). Using the wrong one for a given purpose is the classic bug source.
- **canonicalisation** — normalising representation at a single chokepoint (here, the constructor) so every later comparison is trivially consistent instead of re-deriving "same value" logic in three different methods.
- **`Comparable` consistent with `equals`** — the general contract that `x.compareTo(y) == 0` should imply `x.equals(y)` (and vice versa); violating it silently corrupts sorted collections like `TreeSet`/`TreeMap`, which use `compareTo` alone for membership.
- **partial order** — `compareTo` is total *within* a currency but undefined *across* currencies; `Money` throws rather than guessing, which is the deliberate, honest choice over a false total order.
- **banker's rounding (`HALF_EVEN`)** — rounds ties to the nearest even digit; the standard for financial arithmetic because it has no cumulative positive/negative bias across many roundings, unlike `HALF_UP`.
- **value type / immutability** — no setters, all fields `final`; operations (`plus`/`minus`/`times`) return new instances, which is also *why* it's safe as a hash key (a key's hash code must never change while it's in the map).

**Why interviewers ask this**
It's a compact probe of whether a candidate actually understands the `equals`/`hashCode`/`Comparable` contracts or has just memorised "override both together." Anyone can write `Objects.equals(a, b)`; the senior signal is recognising that `BigDecimal` is a landmine for this exact contract (scale-sensitive `equals`, scale-insensitive `compareTo`) and designing the type so the landmine can't go off — canonicalise once at construction rather than special-casing every comparison. It also tests judgement on partial orders: a junior might make `compareTo` order arbitrarily by currency code to avoid ever throwing; a senior recognises that a false total order is worse than an honest exception, because it lets `5 USD < 5 GBP` silently sort into a `TreeSet` as if that meant something.

**Common confusions**
- *"`BigDecimal.equals` and `compareTo() == 0` are interchangeable."* — They're not: `new BigDecimal("2.0").equals(new BigDecimal("2.00"))` is `false`, but `.compareTo(...)` is `0`. Pick the one semantics you need and canonicalise instead of mixing them ad hoc.
- *"I can override `equals` without touching `hashCode`."* — Two `Money`s that are `.equals()` must return the same `hashCode()`, or a `HashMap`/`HashSet` will silently fail to find an entry that's logically present.
- *"`compareTo` should never throw — just pick *some* ordering."* — Ordering `5 USD` against `5 GBP` by amount alone, or by currency code, produces a total order that lies about meaning. Throwing is the correct, honest answer when there's no sane comparison.
- *"Storing the raw caller `BigDecimal` is fine, I'll just be careful with scale downstream."* — That pushes the bug to every call site instead of fixing it once; the correct fix is canonicalising at the single choke point (the constructor).
- *"`HALF_UP` is the obvious rounding mode."* — For money, `HALF_EVEN` (banker's rounding) is the professional default — it avoids the slight upward bias `HALF_UP` introduces when rounding many values.

**What follows from this topic**
This is the same "canonicalise once, then trust the contract" discipline behind any value type over a representation with hidden state (dates with timezone offsets, floating point with `-0.0` vs `0.0`, case-insensitive strings). It pairs naturally with **[[oddsconverter]]** — another `BigDecimal` value-math kata, where the discipline shifts from equality/ordering to precision-preserving arithmetic across representations (decimal/fractional/moneyline odds). The extension path here is `java.util.Currency` (validates ISO 4217 codes, drives locale-aware formatting), allocation/splitting (dividing an amount N ways without losing or gaining a cent), and JSR-354 (`javax.money.MonetaryAmount`), the standard-library abstraction this class is a simplified stand-in for.

### Clarify & design the API

Questions to settle before writing a line of logic:

- **What does "equal" mean for money?** Same currency *and* the same numeric amount — `2.0 USD` and `2.00 USD` must compare equal, because a human reading a receipt would call them identical.
- **Where does scale get normalised — at construction, or at every comparison?** At construction. Normalising once means `equals`/`hashCode` can be dumb field comparisons and there's no way to construct an un-canonical `Money`.
- **Can `equals` ever throw (e.g. on a currency mismatch)?** No — `equals` must be usable as a `HashMap`/`HashSet` predicate without exploding, so cross-currency amounts are simply *unequal*, never an error.
- **Can `compareTo` ever throw?** Yes, deliberately — cross-currency ordering has no correct answer, so `compareTo` throws `IllegalArgumentException` rather than silently picking one.
- **Mutable or immutable?** Immutable — `plus`/`minus`/`times` return new instances. A hash key that could change its hash code after insertion would corrupt any `HashMap`/`HashSet` it sits in.
- **Rounding mode?** `HALF_EVEN` (banker's rounding) at a fixed 2 decimal places, applied uniformly on construction and after every arithmetic op.

Commit to this surface:

```java
public final class Money implements Comparable<Money> {
    public Money(BigDecimal amount, String currency);
    public static Money of(String amount, String currency);

    public Money plus(Money other);
    public Money minus(Money other);
    public Money times(BigDecimal factor);

    public BigDecimal amount();
    public String currency();

    @Override public boolean equals(Object o);
    @Override public int hashCode();
    @Override public int compareTo(Money other);   // throws IllegalArgumentException cross-currency
}
```

### Write the tests

Write these first — they pin the contract before any canonicalisation logic exists. Group them: the equals/hashCode contract by name, hash-collection behaviour, `compareTo` (same-currency ordering and cross-currency rejection), then arithmetic and immutability.

**The contract, tested explicitly — reflexive, symmetric, transitive, consistent, and scale-insensitive.** This is the part interviewers are actually grading: naming and pinning each contract clause, not just "it works."

```java
@Test
void differently_scaled_equal_amounts_compare_equal() {
    assertEquals(usd("2.0"), usd("2.00"));
    assertEquals(usd("2"), usd("2.00"));
}

@Test
void equals_is_reflexive() {
    Money m = usd("10.00");
    assertEquals(m, m);
}

@Test
void equals_is_symmetric() {
    Money a = usd("10.00");
    Money b = usd("10.0");
    assertEquals(a, b);
    assertEquals(b, a);
}

@Test
void equals_is_transitive() {
    Money a = usd("10.0");
    Money b = usd("10.00");
    Money c = Money.of("10.000", "USD");
    assertEquals(a, b);
    assertEquals(b, c);
    assertEquals(a, c);
}

@Test
void equals_rejects_null_and_other_types() {
    Money m = usd("10.00");
    assertNotEquals(null, m);
    assertNotEquals("10.00 USD", m);
}

@Test
void equal_instances_have_equal_hash_code() {
    Money a = usd("2.0");
    Money b = usd("2.00");
    assertEquals(a, b);
    assertEquals(a.hashCode(), b.hashCode());
}
```

**As a hash key/member — the payoff of canonicalising scale.** A differently-scaled lookup key must still find the entry, and a `HashSet` must dedup amounts that are numerically the same regardless of how they were constructed.

```java
@Test
void works_as_a_hash_map_key() {
    Map<Money, String> prices = new HashMap<>();
    prices.put(usd("19.99"), "widget");

    assertEquals("widget", prices.get(Money.of("19.990", "USD")));
    assertTrue(prices.containsKey(usd("19.99")));
}

@Test
void dedups_in_a_hash_set() {
    Set<Money> amounts = new HashSet<>();
    amounts.add(usd("5.0"));
    amounts.add(usd("5.00"));
    amounts.add(usd("5.000"));
    amounts.add(usd("6.00"));

    assertEquals(2, amounts.size());
    assertTrue(amounts.contains(usd("5.00")));
}
```

**`compareTo` — total within a currency, an exception across currencies.** The cross-currency case is the one candidates most often get wrong by silently returning *something* instead of throwing.

```java
@Test
void compare_to_orders_amounts_within_a_currency() {
    Money five = usd("5.00");
    Money ten = usd("10.00");

    assertTrue(five.compareTo(ten) < 0);
    assertTrue(ten.compareTo(five) > 0);
    assertEquals(0, five.compareTo(usd("5.0")));
}

@Test
void compare_to_across_currencies_throws() {
    Money usd = usd("5.00");
    Money gbp = Money.of("5.00", "GBP");

    assertThrows(IllegalArgumentException.class, () -> usd.compareTo(gbp));
}
```

**Arithmetic and immutability — same-currency required, operands never mutated.**

```java
@Test
void plus_adds_same_currency_amounts() {
    assertEquals(usd("15.00"), usd("10.00").plus(usd("5.00")));
}

@Test
void plus_across_currencies_throws() {
    Money usd = usd("10.00");
    Money gbp = Money.of("10.00", "GBP");
    assertThrows(IllegalArgumentException.class, () -> usd.plus(gbp));
}

@Test
void operations_do_not_mutate_the_operands() {
    Money original = usd("10.00");
    Money unused = original.plus(usd("5.00"));

    assertEquals(usd("10.00"), original);
}
```

### Implement it

The whole trick is a single line in the constructor: rescale on the way in, and every other method becomes a plain field comparison. No method ever has to reconcile two differently-scaled `BigDecimal`s again.

```java
public final class Money implements Comparable<Money> {

    static final int SCALE = 2;

    private final BigDecimal amount;
    private final String currency;

    public Money(BigDecimal amount, String currency) {
        if (amount == null) throw new IllegalArgumentException("amount must not be null");
        if (currency == null) throw new IllegalArgumentException("currency must not be null");
        this.amount = amount.setScale(SCALE, RoundingMode.HALF_EVEN);  // canonicalise once, here
        this.currency = currency;
    }

    public static Money of(String amount, String currency) {
        return new Money(new BigDecimal(amount), currency);
    }

    public Money plus(Money other) {
        requireSameCurrency(other);
        return new Money(this.amount.add(other.amount), currency);
    }

    private void requireSameCurrency(Money other) {
        if (!this.currency.equals(other.currency)) {
            throw new IllegalArgumentException(
                    "currency mismatch: " + this.currency + " vs " + other.currency);
        }
    }

    /** Plain field comparison — safe *only* because amount is already canonical scale. */
    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof Money other)) return false;
        return amount.equals(other.amount) && currency.equals(other.currency);
    }

    @Override
    public int hashCode() {
        return Objects.hash(amount, currency);
    }

    /** Total within a currency; throws rather than guessing across currencies. */
    @Override
    public int compareTo(Money other) {
        requireSameCurrency(other);
        return this.amount.compareTo(other.amount);
    }
}
```

- **The key insight:** canonicalisation is a *chokepoint*, not a policy scattered across methods. Because `amount` is guaranteed scale-2 the instant an object exists, `equals`/`hashCode` can use `BigDecimal.equals` directly (fast, correct) instead of `compareTo() == 0` (which `Objects.hash` can't consume anyway — you'd have to hash the unscaled value yourself).
- **Why `equals` never throws but `compareTo` does:** `equals` must be total (usable as a hash/set predicate on any two objects); `compareTo` is documented to allow `ClassCastException`-style rejections when no ordering exists, so throwing on a currency mismatch is contract-compliant, not a hack.
- **Complexity:** O(1) for all three methods (bounded-size field comparisons); the canonicalisation cost is paid once, in the constructor, not on every comparison.

### Common mistakes & senior signal

- **Storing the raw `BigDecimal` and comparing with `equals`.** `Money.of("2.0", "USD").equals(Money.of("2.00", "USD"))` silently returns `false` if the constructor doesn't rescale — the amount looks right in a debugger (`toString()` may even mask it) but fails equality and hash lookups. This is the single most common `BigDecimal`-as-a-field bug.
- **Overriding `equals` without `hashCode` (or hashing a different field set).** Breaks the `HashMap`/`HashSet` contract: `works_as_a_hash_map_key` and `dedups_in_a_hash_set` would fail unpredictably — the value is "in" the set by `equals` but unreachable by `hashCode`.
- **Making `compareTo` a false total order.** Ordering by currency code first, or comparing raw amounts ignoring currency, produces a `compareTo` that *works* in tests with one currency and quietly corrupts a `TreeSet`/`TreeMap` the moment two currencies mix. Throwing is the correct, defensible answer — say so unprompted.
- **`compareTo` inconsistent with `equals`.** If `compareTo` ever returned `0` for objects that aren't `.equals()` (or vice versa), sorted collections that rely on `compareTo` alone for membership (`TreeSet`) would silently drop or duplicate entries relative to a `HashSet`. Canonicalising scale is precisely what keeps the two mutually consistent here.
- **Reaching for `HALF_UP` out of habit.** It's the "intuitive" rounding mode from school, but it biases sums upward over many roundings; `HALF_EVEN` (banker's rounding) is the correct default for financial code and worth naming as a deliberate choice.
- **Mutable money.** A hash key whose state can change after insertion (no `final` fields, exposed setters) corrupts any `HashMap`/`HashSet` bucket it's stored in — immutability isn't just tidiness here, it's required for hash-key correctness.
- **Named extensions to mention:** `java.util.Currency` in place of a raw `String` (validates ISO 4217, unlocks locale-aware formatting); allocation/splitting an amount N ways without losing or gaining a cent; and JSR-354 `MonetaryAmount`, the real standard-library abstraction this class simplifies. Compare against **[[oddsconverter]]**, which applies the same "canonicalise a `BigDecimal` representation once, trust it everywhere after" discipline to a different problem — converting between odds formats without losing precision.

## Trade Blotter — Streams & Collectors

### Summary

**What this topic covers**
This kata builds `Blotter`, a read-only reporting layer over a `List<Trade>`, written as a guided tour
of the `java.util.stream.Collectors` catalogue. Four query methods, each a single `stream().collect(...)`
call: `pnlByDeskAndSymbol` nests two levels of `groupingBy` with a `reducing` downstream to sum
`BigDecimal` pnl per desk-then-symbol bucket; `winnersVsLosers` uses `partitioningBy` for a two-way
boolean split; `minMaxPnl` uses `Collectors.teeing` to find the min *and* max pnl in one pass instead of
two; `tagCounts` uses `flatMap` to fan out each trade's tag list before `groupingBy(identity(), counting())`.
Every method takes `trades` as a parameter rather than holding state — the blotter is a query surface,
not a stateful ledger. This is a collectors kata, not a streams-fundamentals kata: the point is knowing
which collector composition expresses each shape, not `map`/`filter` basics.

**Mental model**
A `Collector` is a mutable-reduction recipe: it describes *how* to fold a stream into a result container,
and `Collectors` supplies pre-built recipes you compose rather than write by hand. The composition trick
that separates a junior answer from a senior one is **downstream collectors** — `groupingBy` takes a
second argument that is itself a collector, so `groupingBy(desk, groupingBy(symbol, reducing(...)))`
builds a `Map<String, Map<String, BigDecimal>>` in one pass instead of grouping once and then
re-iterating each bucket. `teeing` is the same idea applied to fan-out: it runs *two* downstream
collectors over the same elements and merges their results with a `BiFunction`, so `min` and `max` come
out of a single walk of the stream rather than two separate `stream().min()`/`stream().max()` calls. The
naive two-pass version is invisible in a five-element test and real money on a multi-million-row
end-of-day blotter.

**Key terms**
- **`Collector`** — the `accumulator`/`combiner`/`finisher` recipe a terminal `collect()` call executes;
  `Collectors` is the JDK's library of pre-built ones.
- **downstream collector** — the second argument to `groupingBy`/`partitioningBy` that decides what
  happens *within* each bucket (`reducing`, `counting`, another `groupingBy`, …), instead of the default
  `toList()`.
- **`Collectors.groupingBy(classifier, downstream)`** — buckets elements by a key function, applying the
  downstream collector to each bucket; nesting it builds multi-level maps in one pass.
- **`Collectors.reducing(identity, mapper, op)`** — a reduction with an explicit identity and combining
  function; the idiomatic way to sum `BigDecimal` since there is no `summingBigDecimal`.
- **`Collectors.partitioningBy(predicate)`** — a specialised two-bucket `groupingBy` keyed by
  `Boolean`; the result map *always* has both `true` and `false` keys, even with an empty input.
- **`Collectors.teeing(d1, d2, merger)`** — fans one stream into two downstream collectors and merges
  their results in a single pass; the fix for "two `min`/`max` calls walk the data twice."
- **`Collectors.mapping(fn, downstream)`** — projects each element before handing it to a downstream
  collector; used here to turn `Stream<Trade>` into "the pnl values" before `minBy`/`maxBy`.
- **`flatMap`** — turns each element into a stream of zero-or-more elements and flattens them; the
  many-to-many fan-out from "one trade, many tags" to "one stream entry per tag occurrence."
- **`Function.identity()`** — a no-op key function (`x -> x`), used as the `groupingBy` classifier when
  the element itself (here, the tag string) is the key.

**Why interviewers ask this**
It tests whether a candidate reaches for the *composed* collector or writes a manual loop that
re-implements one. The naive first draft for min/max is two stream calls — correct, but a double pass
that a senior should name unprompted and fix with `teeing`. The naive first draft for nested grouping
is `groupingBy` once, then a second loop over each bucket's list to sum — also correct, also a second
pass, also fixable by nesting the downstream collector. The `BigDecimal` sum is a small but real trap:
reaching for a primitive `summingDouble`-style collector silently loses precision on money, and there is
no `Collectors.summingBigDecimal` in the JDK, so knowing `reducing(BigDecimal.ZERO, mapper, BigDecimal::add)`
is the substitute is a genuine signal. `partitioningBy` vs `groupingBy(predicate)` for a two-outcome
split is a smaller but real efficiency/API-fit question.

**Common confusions**
- *"`groupingBy` with no downstream collects a `List` per key."* — True, and that is the default; the
  power move is passing a second collector to change what accumulates per bucket.
- *"I'll find min and max with two `stream().min()`/`.max()` calls."* — Correct but two passes;
  `teeing` with two `mapping(...).minBy/maxBy` downstreams does it in one.
- *"`partitioningBy` is just `groupingBy` with a boolean key."* — Similar shape, but `partitioningBy`
  guarantees both `true`/`false` keys exist in the result map, even for an empty or one-sided input;
  plain `groupingBy(predicate)` would only produce the keys that actually occurred.
- *"`flatMap` is for `Optional`."* — It is a `Stream` operation too: `Stream<Trade>` →
  `stream.flatMap(t -> t.tags().stream())` → `Stream<String>`, the fan-out this kata's `tagCounts` needs.
- *"Sum pnl with `Collectors.summingDouble`."* — Loses precision converting `BigDecimal` to `double`;
  use `reducing` with an explicit `BigDecimal.ZERO` identity instead.

**What follows from this topic**
Once collector composition is muscle memory, `Collectors.summarizingInt`/`summarizingDouble` give
count/sum/min/max/average in a single collector (for primitives — `BigDecimal` still needs `reducing`),
and `Collector.of(...)` lets you hand-roll a bespoke accumulator (a running VWAP, a Sharpe ratio) that
no built-in collector expresses. It also raises the parallel-stream question: `groupingBy`'s default
`HashMap` merge and `reducing`'s associative combiner are parallel-safe, but `.parallelStream()` only
pays off above a real data-size threshold — measure, don't reach for it reflexively. This kata is a
good pairing with **[[feedparser]]**, which is about *lazy* Streams (the pipeline doesn't run until a
terminal op); `Blotter` is the payoff on the other side — once you have a stream, `Collectors` is how
you turn it into a shaped result.

### Clarify & design the API

Questions worth settling before writing a collector:

- **Is the blotter stateful or a query surface?** A query surface — every method takes `List<Trade>` as
  a parameter and returns a fresh `Map`/record; nothing is mutated or cached.
- **What does empty input produce, per method?** Matters because the collectors behave differently:
  `groupingBy` on an empty stream gives an empty map; `partitioningBy` still gives both `true`/`false`
  keys mapped to empty lists (never a missing key); `teeing`'s two `Optional`-based downstreams both
  come back empty, so the merger must handle "no min/no max" explicitly.
- **How is money summed?** `pnl` is `BigDecimal`, so precision rules out `double`-based collectors;
  reduction needs an explicit identity (`BigDecimal.ZERO`).
- **One pass or two for min/max?** State the requirement out loud — "in one pass" is the tell that
  `teeing` (not two `stream()` calls) is the intended answer.
- **Two-outcome split — `partitioningBy` or `groupingBy(predicate)`?** Two outcomes and both keys
  always wanted → `partitioningBy`.

Commit to this surface:

```java
public final class Blotter {
    public record MinMax(BigDecimal min, BigDecimal max) {}

    public Map<String, Map<String, BigDecimal>> pnlByDeskAndSymbol(List<Trade> trades);
    public Map<Boolean, List<Trade>> winnersVsLosers(List<Trade> trades);
    public MinMax minMaxPnl(List<Trade> trades);
    public Map<String, Long> tagCounts(List<Trade> trades);
}
```

### Write the tests

Each method gets a "happy path" test plus an explicit empty-input test — the empty case is where
`groupingBy`, `partitioningBy`, and `teeing` diverge in behaviour, so pinning it matters as much as the
happy path.

**`pnlByDeskAndSymbol` — nested sum, and empty input is an empty map.** Compare `BigDecimal` with
`compareTo`, never `equals`, since scale differs (`"60.00"` vs a summed `"60.00"` may differ in
representation even when numerically equal).

```java
@Test
void pnl_is_summed_per_desk_and_symbol() {
    List<Trade> trades = List.of(
            trade("rates", "UST10Y", Side.BUY, "100.00"),
            trade("rates", "UST10Y", Side.SELL, "-40.00"),
            trade("rates", "UST2Y", Side.BUY, "10.00"),
            trade("equities", "AAPL", Side.BUY, "5.00"));

    Map<String, Map<String, BigDecimal>> result = blotter.pnlByDeskAndSymbol(trades);

    assertEquals(0, new BigDecimal("60.00").compareTo(result.get("rates").get("UST10Y")));
    assertEquals(0, new BigDecimal("10.00").compareTo(result.get("rates").get("UST2Y")));
    assertEquals(0, new BigDecimal("5.00").compareTo(result.get("equities").get("AAPL")));
}

@Test
void pnl_by_desk_and_symbol_is_empty_map_for_empty_input() {
    assertTrue(blotter.pnlByDeskAndSymbol(List.of()).isEmpty());
}
```

**`winnersVsLosers` — `partitioningBy` always yields both keys, even for empty input.** Note the
boundary: `pnl == 0` (flat) counts as a loser, not a winner — `signum() > 0` is strict.

```java
@Test
void winners_and_losers_are_partitioned_by_positive_pnl() {
    Trade winner = trade("rates", "UST10Y", Side.BUY, "50.00");
    Trade loser = trade("rates", "UST10Y", Side.SELL, "-20.00");
    Trade flat = trade("rates", "UST10Y", Side.SELL, "0.00");

    Map<Boolean, List<Trade>> result = blotter.winnersVsLosers(List.of(winner, loser, flat));

    assertEquals(List.of(winner), result.get(true));
    assertEquals(List.of(loser, flat), result.get(false));   // flat pnl is not a winner
}

@Test
void winners_vs_losers_is_empty_lists_for_empty_input() {
    Map<Boolean, List<Trade>> result = blotter.winnersVsLosers(List.of());

    assertTrue(result.get(true).isEmpty());   // both keys present, not missing
    assertTrue(result.get(false).isEmpty());
}
```

**`minMaxPnl` — the one-pass `teeing` collector; empty input is `null`/`null`, not thrown.** The
"in one pass" wording is the design cue this needs `teeing`, not two separate stream calls.

```java
@Test
void min_and_max_pnl_are_found_in_one_pass() {
    List<Trade> trades = List.of(
            trade("rates", "UST10Y", Side.BUY, "50.00"),
            trade("rates", "UST10Y", Side.SELL, "-20.00"),
            trade("equities", "AAPL", Side.BUY, "5.00"));

    Blotter.MinMax result = blotter.minMaxPnl(trades);

    assertEquals(0, new BigDecimal("-20.00").compareTo(result.min()));
    assertEquals(0, new BigDecimal("50.00").compareTo(result.max()));
}

@Test
void min_max_pnl_is_null_for_empty_input() {
    Blotter.MinMax result = blotter.minMaxPnl(List.of());

    assertNull(result.min());
    assertNull(result.max());
}
```

**`tagCounts` — `flatMap` fans out tags, then `groupingBy(identity(), counting())`; trades with no
tags contribute nothing.**

```java
@Test
void tag_counts_are_totalled_across_trades() {
    List<Trade> trades = List.of(
            trade("rates", "UST10Y", Side.BUY, "50.00", "algo", "hedge"),
            trade("rates", "UST2Y", Side.SELL, "-10.00", "algo"),
            trade("equities", "AAPL", Side.BUY, "5.00", "manual"));

    Map<String, Long> result = blotter.tagCounts(trades);

    assertEquals(2L, result.get("algo"));
    assertEquals(1L, result.get("hedge"));
    assertEquals(1L, result.get("manual"));
}

@Test
void tag_counts_ignores_trades_with_no_tags() {
    Trade noTags = trade("rates", "UST10Y", Side.BUY, "50.00");

    Map<String, Long> result = blotter.tagCounts(List.of(noTags));

    assertTrue(result.isEmpty());
}
```

### Implement it

Each method is one `stream().collect(...)` call; the design work is entirely in *which* collector, and
how to nest or fan it.

```java
/** Sum of pnl per desk, then per symbol within that desk. */
public Map<String, Map<String, BigDecimal>> pnlByDeskAndSymbol(List<Trade> trades) {
    return trades.stream()
            .collect(Collectors.groupingBy(Trade::desk,
                    Collectors.groupingBy(Trade::symbol,
                            Collectors.reducing(BigDecimal.ZERO, Trade::pnl, BigDecimal::add))));
}

/** Trades split into winners (pnl > 0, key true) and losers/flat (key false). */
public Map<Boolean, List<Trade>> winnersVsLosers(List<Trade> trades) {
    return trades.stream()
            .collect(Collectors.partitioningBy(t -> t.pnl().signum() > 0));
}

/** The lowest and highest pnl across all trades, found in one pass over the stream. */
public MinMax minMaxPnl(List<Trade> trades) {
    return trades.stream()
            .collect(Collectors.teeing(
                    Collectors.mapping(Trade::pnl, Collectors.minBy(Comparator.naturalOrder())),
                    Collectors.mapping(Trade::pnl, Collectors.maxBy(Comparator.naturalOrder())),
                    (min, max) -> new MinMax(min.orElse(null), max.orElse(null))));
}

/** How many times each tag occurs across all trades. */
public Map<String, Long> tagCounts(List<Trade> trades) {
    return trades.stream()
            .flatMap(t -> t.tags().stream())
            .collect(Collectors.groupingBy(Function.identity(), Collectors.counting()));
}
```

- **`pnlByDeskAndSymbol`:** the outer `groupingBy(Trade::desk, ...)` classifies by desk; its downstream
  is *another* `groupingBy`, classifying by symbol; *its* downstream is `reducing(ZERO, Trade::pnl, add)`
  — three collectors nested, one stream walk.
- **`minMaxPnl`:** `teeing` takes two downstream collectors and a merge `BiFunction`. Each downstream is
  `mapping(Trade::pnl, minBy/maxBy(...))` — project to pnl, then reduce to an `Optional<BigDecimal>`.
  The merger unwraps both optionals with `orElse(null)`, which is exactly what makes empty input come
  back as `MinMax(null, null)` instead of throwing.
- **Key gotcha:** `Collectors.reducing` needs an explicit identity (`BigDecimal.ZERO`) because there is
  no zero-arg reduction that is safe on an empty stream — the identity *is* the empty-input answer.

### Common mistakes & senior signal

- **Two passes for min/max.** `trades.stream().max(...)` then a second `trades.stream().min(...)` is
  correct but walks the list twice; `teeing` is the tell that a candidate thinks about pass count, not
  just correctness. On a small test list it is invisible; on a real end-of-day blotter it is not.
- **`summingDouble` on `BigDecimal` pnl.** Converting money to `double` to use a primitive summing
  collector silently loses precision. There is no `Collectors.summingBigDecimal` — `reducing(BigDecimal.ZERO,
  Trade::pnl, BigDecimal::add)` is the idiomatic substitute, and naming *why* (no primitive summing
  collector for `BigDecimal`) is the senior signal.
- **Grouping then re-iterating instead of nesting.** `groupingBy(Trade::desk)` into a
  `Map<String, List<Trade>>`, then looping each bucket to sum by symbol, works but is a second pass per
  bucket. Passing a nested `groupingBy` as the downstream collector does it in the original single pass.
- **`groupingBy(predicate)` instead of `partitioningBy`.** For an exactly-two-outcome split,
  `partitioningBy` is more direct and — unlike `groupingBy` — guarantees both `true` and `false` keys
  exist in the result even when one side is empty; a candidate who reaches for `groupingBy` here may not
  know that guarantee exists.
- **Forgetting `BigDecimal.compareTo` vs `equals` in assertions.** `new BigDecimal("60.00")` and a
  reduced sum can differ in scale while being numerically equal; `assertEquals(0, a.compareTo(b))` is the
  correct comparison, `assertEquals(a, b)` is not.
- **Named extensions (from the solution Javadoc):** `summarizingInt`/`summarizingDouble` for a single
  count/sum/min/max/average collector (primitives only, not `BigDecimal` directly); a custom
  `Collector.of(...)` for a bespoke accumulator like VWAP or a running Sharpe ratio that `reducing` can't
  express; and the parallel-stream caveat — `groupingBy`'s default `HashMap` merge and `reducing`'s
  associative combiner are parallel-safe, but `.parallelStream()` only pays off above a real data-size
  threshold, so measure before reaching for it.

## Typed Pipeline — Generics & PECS

### Summary

**What this topic covers**
This kata builds `Pipeline<T>`, a small fluent transformation wrapper over an in-memory `List<T>` with four operations — `addAll`, `map`, `drainTo`, and a standalone static `copy` — whose signatures only differ from the "obvious" unbounded-generic version in their wildcard bounds. That's the whole kata: every method would still compile written the naive way (`addAll(Collection<T>)`), but the wildcard version is what lets client code build against a real type *hierarchy* — loading a `Pipeline<Number>` from a `List<Integer>`, or draining a `Pipeline<Number>` into a `List<Object>` — instead of forcing exact-type matches everywhere. You design the bounded-wildcard signatures, a private-constructor-plus-static-factory shape, and internalise what type erasure does and doesn't let you do with `T` at runtime.

**Mental model**
PECS — **P**roducer-**E**xtends, **C**onsumer-**S**uper — answers one question for every generic parameter: does this method only *read* from it, or only *write* to it? A parameter you only read from is a producer of `T`s, so declare it `? extends T` (`addAll`'s `items`, `copy`'s `src`): a `List<Integer>` can produce `Number`s. A parameter you only write into is a consumer of `T`s, so declare it `? super T` (`drainTo`'s `sink`, `copy`'s `dst`): a `List<Object>` can consume `Number`s. The cost is symmetric and is the mechanism, not a limitation: `? extends T` forbids `add` (the compiler can't prove *which* subtype the list holds), and `? super T` forbids reading back anything more specific than `Object`. `map` applies the same reasoning to a `Function` instead of a `Collection`: the function *consumes* `T` (so `? super T`) and *produces* `R` (so `? extends R`) — exactly the bound the JDK puts on `Stream#map`. The plain internal field, `List<T> items`, stays invariant (no wildcard) because it is both read and written internally — neither variance direction alone would be sound there.

**Key terms**
- **PECS** — Producer-Extends, Consumer-Super: the mnemonic for choosing `? extends T` vs `? super T` on a generic parameter based on whether the method reads or writes it.
- **bounded wildcard** — `? extends T` or `? super T`, restricting an unknown type argument to a sub- or super-type of `T` without naming it.
- **producer / consumer parameter** — a parameter only ever read from (`addAll`'s `items`) vs one only ever written to (`drainTo`'s `sink`).
- **invariance** — `List<T>` is not a subtype of `List<Number>` even if `T` is `Integer`; the internal `items` field needs this because it's read *and* written.
- **type erasure** — the compiler discards `T` after checking the wildcard bounds and compiles every instantiation to the same bytecode operating on the erased bound (`Object` here).
- **static factory** — `create()`, replacing `new Pipeline<>()` so the type argument can be inferred and the constructor can stay `private`.
- **heap pollution** — a generic-varargs parameter is really one shared `Object[]` at runtime; nothing stops a differently-typed write into it before it's read.
- **unchecked cast** — a cast the compiler can't verify at runtime (post-erasure) but accepts because the surrounding generic code proved it sound at compile time.

**Why interviewers ask this**
Generics with wildcards is where "I know Java generics" gets tested for real. Anyone can write `<T> void foo(List<T> list)`. Fewer people can explain *why* `List<? extends T>` rejects `.add(...)`, or design a `copy(dst, src)` signature that needs *both* wildcards on *different* parameters at once. The senior signal is reaching for PECS unprompted, applying it correctly to `Function` (not just `Collection`), and being able to name the erasure consequences that trip people up in real code review: why a generic class can't do `new T[n]`, why `@SafeVarargs` is a promise and not a fix, and why the JDK itself uses `Collections.copy(List<? super T> dst, List<? extends T> src)` — the same shape as this kata's `copy`.

**Common confusions**
- *"`? extends T` should let me add a `T` — it's still `T`-ish."* — No: the compiler only knows the actual list holds *some* unknown subtype of `T`, so it can't verify a `T` (or any specific subtype) is safe to insert. Only reads are guaranteed safe.
- *"`? super T` means I can read a `T` back out."* — No: the compiler only knows the list holds *some* supertype of `T`, so a read only guarantees `Object`. Only writes of `T` (or its subtypes) are guaranteed safe.
- *"I could just use `List<T>` everywhere and skip the wildcards."* — Then `Pipeline<Number>.addAll(List<Integer>)` doesn't compile — `List<Integer>` is not a `List<Number>`. Wildcards exist precisely to let hierarchy-typed callers in.
- *"Type erasure means generics do nothing at runtime, so why bother."* — Erasure removes the *reified* type, not the compile-time safety; the safety is the whole value, and it's why `new T[n]` is rejected instead of silently misbehaving.
- *"`@SafeVarargs` fixes the heap-pollution warning."* — It suppresses the warning as a promise the author has manually verified; it changes nothing at the bytecode level.

**What follows from this topic**
The natural extensions are a recursive-bound `sorted()` (`<T extends Comparable<? super T>>`, the same bound `Collections.max` uses), a `@SafeVarargs static <T> Pipeline<T> of(T... items)` factory, and swapping the eager `List<T>` for a lazy `Stream`-backed implementation so `map` composes functions instead of materialising an intermediate list per stage. It connects to **[[cache]]** — another generics-heavy API, where the interesting question is bounding a key/value type instead of variance on read/write parameters — and to any JDK API shaped like `Collections.copy` or `Stream.map` once you recognise the PECS pattern underneath.

### Clarify & design the API

Questions to settle before writing a signature:

- **Does each parameter only get read, or only get written?** `addAll`'s `items` and `copy`'s `src` are read-only (producers) → `? extends T`. `drainTo`'s `sink` and `copy`'s `dst` are write-only (consumers) → `? super T`.
- **What about a `Function` parameter — is PECS even relevant?** Yes: the function *consumes* `T` and *produces* `R`, so it needs both halves at once: `Function<? super T, ? extends R>`.
- **Should the internal storage be wildcarded too?** No — `items` is both read and written internally by the class itself, so it must stay the invariant `List<T>`.
- **Constructor: public, or a static factory?** Static factory (`create()`), so the type argument is inferred at the call site and the no-arg constructor can stay `private` — `create()` and `map` are the only code that ever builds a `Pipeline`.
- **Does `map` mutate `this`, or return a new pipeline?** Returns a new `Pipeline<R>`; the source pipeline is left untouched — chaining requires each stage to be independent.

Commit to this surface:

```java
public final class Pipeline<T> {
    public static <T> Pipeline<T> create();

    public Pipeline<T> addAll(Collection<? extends T> items);
    public <R> Pipeline<R> map(Function<? super T, ? extends R> fn);
    public void drainTo(Collection<? super T> sink);
    public List<T> toList();

    public static <T> void copy(List<? super T> dst, List<? extends T> src);
}
```

### Write the tests

Write these first — each one exists to pin a *variance* claim, not just a happy path. Group them: producer variance on `addAll`, `map`'s type-changing chain, consumer variance on `drainTo`, the defensive-copy guarantee, and the standalone `copy`.

**Producer variance — `addAll` accepts a narrower element type than the pipeline's own.**

```java
@Test
void addAll_accepts_a_covariant_producer_collection() {
    // Pipeline<Number> loaded from a List<Integer> — only legal because addAll takes
    // Collection<? extends T>.
    Pipeline<Number> pipeline = Pipeline.<Number>create().addAll(List.of(1, 2, 3));

    assertEquals(List.of(1, 2, 3), pipeline.toList());
}

@Test
void addAll_returns_this_for_chaining() {
    Pipeline<Number> pipeline = Pipeline.create();
    Pipeline<Number> same = pipeline.addAll(List.of(1, 2));

    assertSame(pipeline, same);
    assertEquals(List.of(1, 2), same.toList());
}
```

**`map` — changes element type, leaves the source untouched, chains across multiple type changes.** The chaining test is the strongest proof the signature is right: `Integer → String → Integer (length) → Double` compiles and runs cleanly through three different `R`s.

```java
@Test
void map_changes_the_element_type() {
    Pipeline<Integer> ints = Pipeline.<Integer>create().addAll(List.of(1, 2, 3));

    Pipeline<String> strings = ints.map(i -> "v" + i);

    assertEquals(List.of("v1", "v2", "v3"), strings.toList());
}

@Test
void map_leaves_the_source_pipeline_untouched() {
    Pipeline<Integer> ints = Pipeline.<Integer>create().addAll(List.of(1, 2, 3));

    ints.map(i -> i * 10);

    assertEquals(List.of(1, 2, 3), ints.toList());
}

@Test
void map_chains_across_multiple_type_changes() {
    Pipeline<Integer> ints = Pipeline.<Integer>create().addAll(List.of(1, 2, 3));

    Pipeline<Double> doubled = ints
            .map(i -> "v" + i)
            .map(String::length)
            .map(len -> len * 1.5);

    assertEquals(List.of(3.0, 3.0, 3.0), doubled.toList());
}
```

**Consumer variance — `drainTo` accepts a wider sink type than the pipeline's own, empties on drain, and appends rather than overwrites.**

```java
@Test
void drainTo_accepts_a_contravariant_sink_collection() {
    // Pipeline<Number> draining into a List<Object> — only legal because drainTo takes
    // Collection<? super T>.
    Pipeline<Number> pipeline = Pipeline.<Number>create().addAll(List.<Number>of(1, 2.5, 3));
    List<Object> sink = new ArrayList<>();

    pipeline.drainTo(sink);

    assertEquals(List.<Number>of(1, 2.5, 3), sink);
}

@Test
void drainTo_appends_to_an_already_populated_sink() {
    Pipeline<Number> pipeline = Pipeline.<Number>create().addAll(List.of(2, 3));
    List<Object> sink = new ArrayList<>(List.of(1));

    pipeline.drainTo(sink);

    assertEquals(List.of(1, 2, 3), sink);
}
```

**Defensive copy and the standalone `copy` — the latter needs both wildcards at once, on two different parameters.**

```java
@Test
void toList_returns_a_defensive_copy() {
    Pipeline<Integer> pipeline = Pipeline.<Integer>create().addAll(List.of(1, 2));

    List<Integer> snapshot = pipeline.toList();
    snapshot.add(99);

    assertEquals(List.of(1, 2), pipeline.toList());
}

@Test
void static_copy_appends_a_covariant_source_into_a_contravariant_destination() {
    List<Number> dst = new ArrayList<>(List.of(0));
    List<Integer> src = List.of(1, 2, 3);

    Pipeline.copy(dst, src);

    assertEquals(List.of(0, 1, 2, 3), dst);
}
```

### Implement it

Storage is a plain `List<T>` behind a private constructor — no reflection, no array, nothing that needs a reified `T`. `create()` is the only public way in for a fresh pipeline; every other method either reads or writes `items` and the wildcard on its own parameter tells the compiler which is safe.

```java
public final class Pipeline<T> {

    private final List<T> items;

    private Pipeline(List<T> items) {
        this.items = items;
    }

    public static <T> Pipeline<T> create() {
        return new Pipeline<>(new ArrayList<>());
    }

    public Pipeline<T> addAll(Collection<? extends T> items) {
        this.items.addAll(items);
        return this;
    }

    public <R> Pipeline<R> map(Function<? super T, ? extends R> fn) {
        List<R> mapped = new ArrayList<>(items.size());
        for (T item : items) {
            mapped.add(fn.apply(item));
        }
        return new Pipeline<>(mapped);
    }

    public void drainTo(Collection<? super T> sink) {
        sink.addAll(items);
        items.clear();
    }

    public List<T> toList() {
        return new ArrayList<>(items);
    }

    public static <T> void copy(List<? super T> dst, List<? extends T> src) {
        for (T item : src) {
            dst.add(item);
        }
    }
}
```

- **`addAll`:** `items` is `Collection<? extends T>` — a producer. `this.items.addAll(items)` only ever *reads* elements out of the parameter, so the wildcard costs nothing here.
- **`map`:** `fn` is `Function<? super T, ? extends R>` — PECS applied to a functional interface instead of a collection. `fn.apply(item)` passes a `T` in (needs `? super T` to accept it) and gets an `R`-or-narrower out (needs `? extends R` to store it as `R`).
- **`drainTo`:** `sink` is `Collection<? super T>` — a consumer. `sink.addAll(items)` only ever *writes* `T`s into it.
- **`copy`:** both halves at once, on two *different* parameters — `dst` consumes (`? super T`), `src` produces (`? extends T`) — mirroring `java.util.Collections#copy`.
- **Why a static factory, not `new Pipeline<>()`:** `create()` lets the type argument be inferred (or supplied explicitly as `Pipeline.<Integer>create()`) without repeating `<T>` on both sides of an assignment, and lets the constructor stay `private` — `create()` and `map` are the only two places that know the element type of the `List` they hand to it.
- **Key gotcha:** the internal `items` field is deliberately *not* wildcarded — it is `List<T>`, invariant — because the class itself both reads and writes it. Wildcards only earn their keep at a method boundary where one direction is the whole story.

**Type erasure consequences.** At runtime, `Pipeline<Integer>` and `Pipeline<String>` are the same class — the compiler erases `T` to its bound (`Object` here) once the wildcard checks above have passed, and inserts the unchecked casts needed to make that safe.

- `new T[n]` does not compile inside a generic class — the JVM needs a reified component type to allocate an array, and erasure has already discarded `T`. Backing `Pipeline` with a `List` (which hides its own `Object[]` behind a type-safe API) sidesteps the problem entirely instead of working around it with a manually-cast `Object[]`.
- A hypothetical `static <T> Pipeline<T> of(T... items)` factory would compile with an "unchecked generic array creation" warning: `items` is really one shared `Object[]` at runtime, so nothing stops another erased-generic method from stashing a different type into that same array before it's read (heap pollution). `@SafeVarargs` suppresses the warning as a promise, not a fix — it only belongs on a method the author has manually verified never writes into that array.
- Every `? extends`/`? super` bound above is a compile-time-only proof; the generated bytecode for `addAll`, `map`, and `copy` is identical regardless of the concrete types used, with an implicit unchecked cast to `T` wherever the erased code reads a value the wildcard guaranteed was assignable.

### Common mistakes & senior signal

- **Writing the unbounded signature and missing why it's wrong.** `addAll(Collection<T> items)` compiles and passes a same-type test, but `Pipeline<Number>.addAll(List.of(1, 2, 3))` — a `List<Integer>` — fails to compile. The senior tell is explaining *why* before being shown the failing call: producer parameters need `? extends T`.
- **Getting the direction backwards.** Declaring `drainTo(Collection<? extends T> sink)` compiles but breaks the moment a caller passes a `List<Object>` sink for a `Pipeline<Number>` — `? extends T` can't accept a `List<Object>` as a `T`-consumer. PECS gets the direction right from the read/write question, not from guessing.
- **Trying to read out of a `? extends T` parameter, or write into a `? super T` one.** Both are compiler-rejected on purpose — the fix is never a cast to silence it, it's recognising the parameter was declared with the wrong variance for what the method is trying to do with it.
- **Wildcarding the internal field.** `List<? extends T> items` would break `addAll`'s own `this.items.addAll(items)` — you can't write into a `? extends T` list, even your own. Invariant storage plus wildcarded *boundaries* is the correct split.
- **Believing `@SafeVarargs` is a fix rather than a promise.** It suppresses the heap-pollution warning; it does not change that `items` is one shared `Object[]` at runtime. Only add it after manually verifying the varargs body never writes into that array.
- **Named extensions that show depth beyond the base kata:** a `sorted()` operation needs the recursive bound `<T extends Comparable<? super T>>` (`T` comparable to itself or a supertype — the same bound `Collections.max` uses); a verified `@SafeVarargs static <T> Pipeline<T> of(T... items)` factory for `Pipeline.of(1, 2, 3)`-style construction; and replacing the eager `List<T>` with a `Stream`-backed pipeline so `map` composes functions lazily instead of materialising an intermediate list at every stage.

## Resource Lease — AutoCloseable

### Summary

**What this topic covers**
This kata builds a fixed-size, single-threaded `Pool<R>` that hands out resources as `Lease<R>` handles implementing `AutoCloseable`. A caller `acquire()`s a lease, reaches the resource through `Lease.get()`, and returns it by `close()`-ing the lease — almost always via try-with-resources, so the return happens even when the caller's code throws. It is the fundamentals-tier shape behind a JDBC connection pool or an object pool, stripped of concurrency machinery: no `Semaphore`, no blocking, `acquire()` either succeeds immediately or throws. A third fixture, `FaultyResource`, whose `close()` always throws, exists purely to drill suppressed exceptions in a multi-resource try-with-resources block. The real deliverable is not the pool's bookkeeping — it's getting `Lease.close()` right: deterministic, idempotent, and correct under exception unwinding.

**Mental model**
`try-with-resources` is sugar for a `finally` block that calls `close()` on every resource declared in the parenthesised list, in **reverse (LIFO) declaration order**, no matter how the try body exits — normally, or via exception. That guarantee is what makes `Lease` safe to hand out: the pool never needs the caller to remember to return anything. The second half of the mental model is idempotency: `close()` must tolerate being called more than once, doing nothing on the second call. Without that guard, a caller who (accidentally or defensively) closes a lease twice would call `Pool.release()` twice, pushing the same resource onto the idle deque twice and inflating `available()` past the pool's real capacity — two future callers would then believe they each hold an exclusive resource that is actually the same object. The third piece is what happens when **both** the try body and a resource's `close()` throw: the JVM does not discard either exception. The body's exception (whichever is already propagating) becomes primary; every exception thrown while closing resources during unwinding is attached to it via `Throwable.addSuppressed(Throwable)`, retrievable from `getSuppressed()` — nothing is silently lost.

**Key terms**
- **`AutoCloseable`** — the interface with a single `close() throws Exception`; implementing it makes a type eligible for try-with-resources.
- **try-with-resources** — the `try (Resource r = ...) { }` form; compiles to a `finally` that closes every declared resource, LIFO order, even on exception.
- **LIFO close ordering** — resources close in the reverse of their declaration order — the last resource acquired is the first one closed, mirroring stack unwinding / RAII destructor order.
- **idempotent `close()`** — a second (or later) call is a safe no-op; `Closeable`/`AutoCloseable` both document this as the expected contract, not just a nice-to-have.
- **suppressed exception** — an exception thrown while closing a resource during unwinding, attached to the primary (already-propagating) exception via `addSuppressed`, read back via `getSuppressed()`.
- **lease** — a borrow handle, not the resource itself; closing a lease means "I'm done borrowing this," not "destroy this."
- **lazy creation** — the pool calls `factory` only when acquiring and no idle resource is waiting, not `size` times up front.
- **`available()` invariant** — `size - leased`, which must hold exactly even under double-close, exceptions, and reuse.

**Why interviewers ask this**
Nearly everyone can write `try { } finally { close(); }` for one resource. Far fewer can state — unprompted — the three rules that make multi-resource cleanup actually safe: LIFO ordering (so a resource that depends on one opened before it is closed first), suppressed exceptions (so a close-time failure doesn't silently swallow the real bug), and idempotency (so defensive double-closing doesn't corrupt shared state). This kata is small enough to implement in minutes, which is exactly why interviewers use it as a filter: the code is trivial, but explaining *why* each line is there — and predicting `getSuppressed()` output on a whiteboard — separates people who have internalized RAII-style resource management from people who've only ever called `.close()` in a `finally` block by habit.

**Common confusions**
- *"try-with-resources closes resources in declaration order."* — No, it's LIFO: the last one opened is the first one closed, mirroring how a stack of destructors unwinds.
- *"If `close()` throws while a body exception is propagating, the close exception replaces it."* — No, the body's exception stays primary; the close exception is attached via `addSuppressed`, not thrown on its own.
- *"`Lease.close()` should call `close()` on the underlying resource `R`."* — No. The lease closing means "return to the pool," not "destroy." The pool (not any individual lease) owns the resource's lifecycle.
- *"A second `close()` call should throw to catch bugs."* — No, the `AutoCloseable`/`Closeable` contract expects tolerance: nested try-with-resources and defensive cleanup code routinely double-close. Throwing turns safe code into a bug source.
- *"`acquire()` should block when the pool is exhausted."* — Not here: single-threaded, no other thread could ever return a resource while this one waits, so blocking would deadlock. It throws `IllegalStateException` instead.

**What follows from this topic**
The natural extension is making this concurrent: swap the `Deque` + `leased` counter for a `Semaphore` (bounding concurrent leases) and a thread-safe idle queue, and swap "throw when exhausted" for "block with a timeout" — that's exactly [[connectionpool]], the concurrent cousin of this kata. Other extensions living in the `Pool` Javadoc: **FIFO vs LIFO reuse** (this pool's `ArrayDeque` push/pop is a stack, reusing the most-recently-returned resource first to keep a small working set hot; a queue would round-robin instead), and **validation on reuse** (running a `Predicate<R>` over an idle resource before handing it out, discarding and recreating on failure — what `ConnectionPool` does for real connections that may have gone stale).

### Clarify & design the API

Questions worth settling before writing the pool:

- **Blocking or throwing on exhaustion?** Single-threaded pool, so blocking would deadlock (no other thread can ever return a resource). `acquire()` throws `IllegalStateException` immediately instead.
- **Eager or lazy resource creation?** Lazy — `factory` runs only when `acquire()` needs a resource and none is idle, not `size` times at construction.
- **What does `Lease.close()` actually do?** Return the resource to the pool's idle deque and decrement `leased` — *not* call `close()`/cleanup on the resource itself. The pool owns the resource's lifecycle, not any one lease.
- **What happens on double-close?** Must be a no-op, tracked with a `boolean closed` flag on the lease — never call `Pool.release()` twice for the same acquisition.
- **What happens when the try body *and* a resource's close both throw?** Nothing should be swallowed — this is what `FaultyResource` exists to force you to observe and assert on (`getSuppressed()`).

Commit to this surface:

```java
public final class Pool<R> {
    public Pool(Supplier<R> factory, int size);
    public Lease<R> acquire();      // throws IllegalStateException if exhausted
    public int available();         // size - leased
    void release(R resource);       // package-private return path, called by Lease.close()
}

public final class Lease<R> implements AutoCloseable {
    public R get();
    @Override public void close();  // idempotent — returns resource to the pool at most once
}
```

### Write the tests

Write these first: the try-with-resources happy path, the body-throws path, idempotency, resource reuse, exhaustion, and — the payoff — the suppressed-exception case with `FaultyResource`.

**Happy path — try-with-resources returns the resource deterministically.**

```java
@Test
void try_with_resources_returns_the_lease_to_the_pool() {
    Pool<Object> pool = newPool(2);
    assertEquals(2, pool.available());

    try (Lease<Object> lease = pool.acquire()) {
        assertNotNull(lease.get());
        assertEquals(1, pool.available());
    }

    assertEquals(2, pool.available());
}
```

**Body throws — the resource still comes back.** This is the entire point of `AutoCloseable`: cleanup happens even on the unhappy path.

```java
@Test
void body_throwing_still_returns_the_resource() {
    Pool<Object> pool = newPool(1);

    assertThrows(RuntimeException.class, () -> {
        try (Lease<Object> lease = pool.acquire()) {
            throw new RuntimeException("boom");
        }
    });

    assertEquals(1, pool.available());
}
```

**Idempotency — double-close must not inflate `available()`.** Without the `closed` guard this test fails: two `release()` calls would push the same resource twice and `available()` would read `2` on a pool of size `1`.

```java
@Test
void double_close_is_idempotent() {
    Pool<Object> pool = newPool(1);
    Lease<Object> lease = pool.acquire();

    lease.close();
    lease.close();

    assertEquals(1, pool.available());
}
```

**Reuse — a closed lease's resource comes back out on the next `acquire()`.**

```java
@Test
void closed_lease_reuses_the_same_resource_on_next_acquire() {
    Pool<Object> pool = newPool(1);
    Lease<Object> first = pool.acquire();
    Object resource = first.get();
    first.close();

    Lease<Object> second = pool.acquire();

    assertSame(resource, second.get());
}
```

**Exhaustion — `acquire()` throws rather than blocking, since blocking here would deadlock.**

```java
@Test
void acquire_when_exhausted_throws() {
    Pool<Object> pool = newPool(1);
    pool.acquire();

    assertThrows(IllegalStateException.class, pool::acquire);
}
```

**Suppressed exceptions — the payoff test.** A multi-resource try-with-resources block where the body throws *and* the second resource's `close()` throws. LIFO ordering closes `resource` (the `FaultyResource`) before `lease`; the body's `RuntimeException` stays primary, `FaultyResource`'s `IllegalStateException` is suppressed onto it, and `Lease.close()` still runs afterward, returning the resource to the pool regardless.

```java
@Test
void faulty_resource_close_exception_is_suppressed_under_the_body_exception() {
    Pool<FaultyResource> pool = new Pool<>(FaultyResource::new, 1);
    RuntimeException bodyFailure = new RuntimeException("body failed");

    RuntimeException thrown = assertThrows(RuntimeException.class, () -> {
        try (Lease<FaultyResource> lease = pool.acquire();
             FaultyResource resource = lease.get()) {
            throw bodyFailure;
        }
    });

    assertSame(bodyFailure, thrown);
    assertEquals(1, thrown.getSuppressed().length);
    assertInstanceOf(IllegalStateException.class, thrown.getSuppressed()[0]);
    // Lease.close() still ran (after the faulty resource's close) and returned the resource.
    assertEquals(1, pool.available());
}
```

### Implement it

`Pool<R>` holds a `Deque<R>` of idle resources plus a `leased` counter; `available() == size - leased` is the invariant every test pins.

```java
public final class Pool<R> {
    private final Supplier<R> factory;
    private final int size;
    private final Deque<R> idle = new ArrayDeque<>();
    private int leased;

    public Pool(Supplier<R> factory, int size) {
        this.factory = Objects.requireNonNull(factory, "factory");
        if (size <= 0) throw new IllegalArgumentException("size must be positive: " + size);
        this.size = size;
    }

    public Lease<R> acquire() {
        if (leased >= size) {
            throw new IllegalStateException("pool exhausted: all " + size + " resources are leased");
        }
        R resource = idle.isEmpty() ? factory.get() : idle.pop();
        leased++;
        return new Lease<>(resource, this);
    }

    public int available() {
        return size - leased;
    }

    void release(R resource) {   // package-private: only Lease.close() calls this
        idle.push(resource);
        leased--;
    }
}
```

`Lease<R>` is where the pedagogy lives — a `boolean closed` flag makes `close()` idempotent, and `close()` never touches the resource's own lifecycle, only the pool's bookkeeping:

```java
public final class Lease<R> implements AutoCloseable {
    private final R resource;
    private final Pool<R> pool;
    private boolean closed;

    Lease(R resource, Pool<R> pool) {
        this.resource = resource;
        this.pool = pool;
    }

    public R get() {
        return resource;   // still returns the resource after close() — the pool is what forgets it
    }

    @Override
    public void close() {
        if (closed) return;   // idempotency guard — the whole point of this class
        closed = true;
        pool.release(resource);
    }
}
```

- **The key insight:** `Lease.close()` and `Pool.release()` are two different concerns — `close()` guards against being called more than once; `release()` trusts its caller and just does the bookkeeping. Idempotency belongs on the lease (the thing a caller might close twice), not on the pool (which is only ever told once, by the one lease that owns that acquisition).
- **Complexity:** O(1) for `acquire()`/`release()`/`available()` (deque push/pop, counter arithmetic).
- **Why `release()` is package-private:** only `Lease.close()` should ever be able to call it — a public `release()` would let a caller bypass the idempotency guard entirely by calling `pool.release(resource)` directly.

### Common mistakes & senior signal

- **Forgetting the idempotency guard.** The most common bug: `close()` unconditionally calls `pool.release(resource)`. It passes the happy-path test and fails only `double_close_is_idempotent` — which is exactly why that test exists as its own case rather than being folded into the happy path.
- **Assuming close order matches declaration order.** try-with-resources unwinds LIFO — the *last* resource declared is the *first* one closed. Get this backwards and you'll mispredict which resource's exception ends up primary versus suppressed in a multi-resource block.
- **Thinking a close-time exception replaces the body's exception.** It doesn't — the already-propagating body exception stays primary, and the close-time exception is *attached* via `addSuppressed`, not thrown separately or discarded. Missing this means misreading `assertSame(bodyFailure, thrown)` in the suppressed-exception test as a coincidence rather than the contract.
- **Conflating "close the lease" with "close the resource."** `Lease.close()` returns the resource to the pool; it must not call any cleanup on `R` itself. A resource that itself needs shutdown (e.g. a real `Closeable` network connection) is closed by whoever eventually retires the *pool*, not by every lease that borrows and returns it.
- **Reaching for blocking `acquire()` here.** In a single-threaded pool, blocking on exhaustion is a guaranteed deadlock — no other thread exists to ever call `release()`. Throwing `IllegalStateException` is the correct fundamentals-tier answer; blocking-with-timeout is a real technique, but it belongs to the concurrent pool.
- **Senior signal — naming the concurrent extension unprompted.** The strongest answer volunteers that a multi-threaded version swaps the `Deque` + counter for a `Semaphore` and a thread-safe idle queue, and swaps "throw when exhausted" for "block with a timeout" — precisely the design of [[connectionpool]]. Also worth naming: LIFO-vs-FIFO reuse policy (this pool's stack-based reuse keeps a small working set hot) and validating a resource before handing it back out on reuse (discard-and-recreate on failure, as a real connection pool does for connections that went stale while idle).
