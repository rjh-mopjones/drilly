## How to Attack a C++ Kata

### Summary

**What this topic covers**

The method for solving an open-ended modern-C++ prompt — "write a move-only handle", "build a fixed-capacity ring buffer", "publish a quote without tearing", "make a lock-free SPSC queue" — from a blank file in interview time. C++ katas have a distinct centre of gravity: the language gives you total control over **object lifetime and memory layout** and, unlike Rust, the compiler will *not* stop you from a use-after-free, a leak, or a data race — that discipline is on you, and the tools (ASan/TSan) are how you prove you got it right. So the loop every C++ kata runs on is: clarify the spec, design the API **value-semantics first** (who owns what, copy vs move vs borrow, `const`-correctness, the rule of five vs rule of zero), write the tests first with the module's tiny hand-rolled harness, then implement — reaching for RAII so cleanup is automatic and exception-safe. And it names the C++ twist on the concurrency katas: **data races are real and undefined** (not deleted by the compiler as in Rust), so you design the synchronisation deliberately and verify it under **ThreadSanitizer**.

**Mental model**

Every C++ design decision starts with **ownership and lifetime, made explicit**. Before logic, answer: does this type *own* its resource (and therefore need a destructor, and therefore the rule of five), or is it a non-owning view? Owning types put cleanup in the destructor (**RAII**) so it runs on every path — normal return, early `return`, thrown exception — which is the single most important C++ idiom: a resource with an owner is released exactly once, automatically. If you write a destructor, you almost certainly must reason about all five special members (destructor, copy ctor/assign, move ctor/assign) — the **rule of five** — because the compiler's defaults will do the wrong thing (double-free, or a silent copy of a handle). If your type owns nothing, write none of them — the **rule of zero**. Moves transfer ownership and must leave the source in a valid, destructible state. For raw storage you separate *allocation* from *construction* (`operator new` + placement `new`, `std::destroy_at`), because that is what containers do under the hood. And when threads share mutable state, the compiler offers no protection: you pick the primitive (mutex, atomics, a seqlock, a lock-free ring) and you *prove* it with TSan.

**Key terms**

- **RAII** — a resource's lifetime is tied to an object's; the destructor releases it, automatically and exception-safely.
- **Rule of five / rule of zero** — own a resource → define (or delete) all five special members; own nothing → define none.
- **Move semantics** — transfer ownership (`&&`, `std::move`); the moved-from object stays valid and destructible.
- **`noexcept` destructor** — destructors must not throw (a second exception during unwinding calls `std::terminate`).
- **`const`-correctness** — mark read-only methods/params `const`; it's part of the API contract.
- **Placement `new` / `std::destroy_at`** — construct/destroy an object in raw storage; separates allocation from lifetime.
- **`std::atomic` + memory order** — `acquire`/`release`/`relaxed`; the tool for lock-free hand-offs.
- **UB** — use-after-free, data races, torn reads, signed overflow: *undefined*, and the compiler won't warn — tools catch it.
- **ASan / TSan** — AddressSanitizer (memory errors) / ThreadSanitizer (data races), the `-race` analogues.

**Why interviewers ask this**

C++ interviews probe whether you *reason about lifetime and layout* or just write Java-in-C++. A junior news-and-deletes by hand, forgets a copy constructor, and leaks on the exception path; a senior reaches for RAII so cleanup is structural, states the rule-of-five obligations out loud, distinguishes owning from non-owning types, keeps methods `const`, and — on a concurrency kata — names the exact memory ordering their design needs and how they'd verify it under TSan. The tell is that a senior treats "it compiles and the happy path runs" as the *start*: they know the compiler proves almost nothing about lifetime or races, and they design so correctness is guaranteed by construction (a destructor that always runs, an ordering that's actually sound) rather than by hoping.

**Common confusions**

- "The compiler will catch my mistake" — for lifetime/races it won't; C++ trusts you. ASan/TSan are how you check.
- "I wrote a destructor, I'm done" — writing one usually obligates the other four special members (rule of five).
- "Move is a copy that's faster" — no; move *transfers* ownership and leaves the source empty-but-valid.
- "`std::vector<T>` for raw storage" — it default-constructs `T`s; manual-lifetime katas need `operator new` + placement `new`.
- "Rust and C++ concurrency are the same" — Rust deletes data races at compile time; in C++ they're real UB you must design out and verify.

**What follows from this topic**

The next topic — Testing in C++ — covers the module's tiny hand-rolled harness (`KATA_TEST` / `EXPECT_*` / `KATA_MAIN`, no GoogleTest), the `StartGate` concurrency gate, and running the concurrency katas under TSan. Then each kata drills one pillar: `exchange_session` (move-only RAII / rule of five), `tick_buffer` (raw aligned storage + placement `new`), `order_handle` (intrusive reference counting), `top_of_book` (a seqlock with an atomic payload), up to `feed_pipe` (a lock-free SPSC ring) — the two concurrency capstones you verify under ThreadSanitizer.

### The first questions: ownership & value semantics

Turn the prompt into a lifetime plan before writing code.

- **Does this type own a resource?** If yes → RAII: put release in the destructor, and reason about the rule of five. If no → rule of zero, write no special members.
- **Copy, move, or neither?** A unique resource (a connection, a buffer) is move-only: `= delete` the copies, define the moves. A value type is copyable. A view owns nothing.
- **`const`-correct?** Which methods only read? Mark them `const`; take read-only params by `const&`.
- **Raw storage?** If elements must outlive/underlive their slots (a ring, a small-buffer optimisation), separate allocation (`operator new`, aligned) from construction (placement `new`, `std::destroy_at`).
- **Shared across threads?** Pick the primitive deliberately (mutex / atomics / seqlock / lock-free) and note the memory ordering — the compiler guarantees nothing here.

### Design the API (value semantics first)

Write the class and its special members first — they encode every decision above.

```cpp
class ExchangeSession {                       // owns one connection → RAII + rule of five
public:
    explicit ExchangeSession(std::string venue);
    ~ExchangeSession() noexcept;              // releases exactly once
    ExchangeSession(const ExchangeSession&) = delete;          // one owner: no copies
    ExchangeSession& operator=(const ExchangeSession&) = delete;
    ExchangeSession(ExchangeSession&&) noexcept;               // move transfers ownership
    ExchangeSession& operator=(ExchangeSession&&) noexcept;
    void send(const Order& order);
    bool is_open() const noexcept;            // const: read-only
};
```

Deleting the copies and defining the moves *is* the design: it says "this is a unique, transferable resource", and the destructor guarantees release on every path.

### Write the tests first, then implement

Tests use the module's hand-rolled harness (next topic) — write them before the bodies:

```cpp
KATA_TEST(move_transfers_ownership_and_closes_source) {
    ExchangeSession a("LSE");
    ExchangeSession b(std::move(a));
    EXPECT_TRUE(b.is_open());
    EXPECT_FALSE(a.is_open());          // moved-from is closed → its dtor is a no-op
    EXPECT_EQ(ExchangeSession::live_count(), 1);  // no double-open
}
```

Order: contract → core behaviour → edges (empty, capacity, exceptions) → concurrency stress (`StartGate` + `std::jthread`, verified under TSan) for the threaded katas. Then implement to green — and to *not leak or race*, which the sanitizers check. Run a kata with `ctest -R <kata>`; the concurrency katas additionally run `-DKATAS_SANITIZE=thread`. Details next.

## Testing in C++ (CTest, a hand-rolled header harness, TSan)

### Summary

**What this topic covers**

C++ has no single standard test framework, and this module keeps to the repo's std-only ethos, so tests run on a **~100-line hand-rolled header harness** (`solution/common/harness.hpp`) driven by CTest — not GoogleTest or Catch2. This topic covers that harness (`KATA_TEST(name){…}` auto-registration, `EXPECT_TRUE/EXPECT_EQ/EXPECT_THROWS`, `KATA_MAIN()`), how the practice side ships **no tests** so writing them is the exercise, and — the part that separates people — how to test **concurrency** in a language where a data race is undefined behaviour the compiler won't flag: you gate threads with a `StartGate` (a `std::latch`) so they start together for maximum contention, join with `std::jthread`, assert a self-consistency invariant that a torn/lost/duplicated value would break, and run the whole thing under **ThreadSanitizer** (`-fsanitize=thread`), which is the C++ analogue of Go's `-race`. Master these and each kata's "Write the tests" step is just picking which pattern the trap needs.

**Mental model**

Two kinds of test. A **behaviour test** proves logic — a ring buffer overwrites the oldest element, a move leaves the source empty, a parser rejects bad input — with `KATA_TEST` + `EXPECT_*`. A **concurrency test** proves an invariant under contention and, crucially, is checked twice: once by an **invariant assertion** that logic bugs break (a consistency relation on every value read, a strictly-increasing sequence, a conserved count), and once by **TSan**, which instruments memory accesses and reports the data race directly even when the invariant happens to pass on a given run. The gate matters: a `std::latch` released after all workers are spawned maximises the overlap that exposes a torn read or a lost update; a `sleep`-based test is a flaky coin flip. You never assert an exact interleaving — you assert the property. And you internalise the headline difference from Rust: there, data races don't compile; here they're real UB, so the sanitizer isn't optional polish, it's how you know the design is sound.

**Key terms**

- **`KATA_TEST(name){…}`** — declares + auto-registers a test with the harness; no framework needed.
- **`EXPECT_TRUE` / `EXPECT_EQ` / `EXPECT_THROWS(expr, Exc)`** — the assertions; failures print file:line and values.
- **`KATA_MAIN()`** — expands to `main()`; runs every registered test, supports an `argv[1]` name filter, non-zero exit on failure.
- **CTest** — `ctest -R <kata>` runs one kata's executable; `add_test` registers it.
- **`StartGate` / `std::latch`** — the start-gate: workers `wait()`, the test releases them together for max contention.
- **`std::jthread`** — a thread that joins on destruction; a `std::vector<std::jthread>` auto-joins at scope end.
- **Self-consistency invariant** — encode each written value so a torn/mixed read is detectable without a sanitizer.
- **ThreadSanitizer** — `-fsanitize=thread`; detects data races and bad orderings — the `-race` analogue.
- **Practice ships no tests** — the `practice/` skeletons are `throw`-only; writing the tests is half the exercise.

**Why interviewers ask this**

Driving your own tests in C++ shows you can specify behaviour *and* that you respect what the language does not guarantee. Anyone writes an `EXPECT_EQ` on the happy path; the signal is whether you test the exception path (`EXPECT_THROWS`), whether — on a lifetime kata — you use a live-instance counter to prove no leak/double-free, and — the senior tell — whether, on a concurrency kata, you write a **latch-gated, invariant-checked** stress test and say "I'd run this under TSan" rather than shrugging that it "seems to work". Knowing that a green run proves nothing about a race, and that TSan is how you actually check, is exactly the judgement the seqlock and SPSC katas probe.

**Common confusions**

- "I need GoogleTest/Catch2" — no; a `KATA_TEST` + `EXPECT_*` header is enough and keeps the module dependency-free.
- "It ran fine, so there's no race" — a data race is UB that often *looks* fine; only TSan (or bad luck in prod) reveals it.
- "Assert the exact concurrent output" — order is nondeterministic; assert an invariant (consistency / FIFO / conserved count).
- "`sleep` to synchronise the threads" — flaky; gate with a `std::latch` so they start together, and join deterministically.
- "The destructor test is trivial" — a live-instance counter across construct/move/destroy is what actually catches a double-free.

**What follows from this topic**

Every kata's "Write the tests" card is an instance of these patterns: behaviour tests for `exchange_session` / `tick_buffer` / `order_handle`, and latch-gated invariant stress tests under TSan for `top_of_book` (the seqlock) and `feed_pipe` (the SPSC ring). When a kata shows a `StartGate` stress test or a TSan run, come back here for the template.

### The behaviour test (KATA_TEST + EXPECT_*)

```cpp
#include "harness.hpp"
#include "tick_buffer.hpp"

KATA_TEST(overwrites_oldest_when_full) {
    katas::TickBuffer<int> buf(2);
    buf.record(1); buf.record(2); buf.record(3);   // 1 overwritten
    EXPECT_EQ(buf.size(), 2u);
    EXPECT_EQ(buf.snapshot(), (std::vector<int>{2, 3}));  // oldest → newest
}

KATA_TEST(latest_on_empty_throws) {
    katas::TickBuffer<int> buf(4);
    EXPECT_THROWS(buf.latest(), std::out_of_range);
}

KATA_MAIN()   // one main per test executable; a stress file omits it and shares this one
```

Run: `ctest -R tick_buffer` (or the built binary directly with a name filter).

### The concurrency stress test (StartGate + std::jthread)

The invariant test that would catch a torn or lost value. A `StartGate` (a `std::latch`) releases every worker together; encode each written value so a mixed read is self-evidently wrong.

```cpp
KATA_TEST(seqlock_no_torn_reads_under_contention) {
    katas::TopOfBook tob;
    kata::StartGate gate;
    std::atomic<bool> torn{false};
    std::vector<std::jthread> readers;             // auto-join at scope end
    for (int r = 0; r < 8; ++r)
        readers.emplace_back([&] {
            gate.wait();                            // released together → max overlap
            while (tob.sequence() < 2 * kWrites)
                if (!consistent(tob.read())) { torn = true; return; }  // fields must agree
        });
    std::jthread writer([&] { gate.wait();
        for (uint64_t v = 1; v <= kWrites; ++v) tob.publish(encode(v)); });
    gate.open();
    // ... joins here ...
    EXPECT_FALSE(torn.load());
}
```

Assert the **invariant** (`consistent(...)`), never a sequence. `consistent`/`encode` derive every field from one counter, so a torn read breaks the relation even without a sanitizer.

### TSan — the data-race detector

A green run proves nothing about a race, so build the concurrency katas under ThreadSanitizer and re-run:

```bash
cmake -B build-tsan -DKATAS_SANITIZE=thread && cmake --build build-tsan
ctest --test-dir build-tsan -R top_of_book        # and feed_pipe
```

TSan instruments every memory access and reports a data race with both stacks — this is what proves the seqlock's `acquire`/`release` fences and the SPSC ring's head/tail hand-off are actually sound, the role `-race` plays in Go. (Note: on some macOS/arm64 setups Apple's TSan runtime won't launch; the self-consistency invariant is the portable fallback.)

## Exchange Session — Move-Only RAII & the Rule of Five

### Summary

**What this topic covers**

You build the object every trading strategy holds to talk to a venue: an `ExchangeSession`. Constructing one *connects* (claims a unique, expensive session slot); destroying one *disconnects* — exactly once. Sessions are routinely moved: returned from a factory, `emplace_back`-ed into a registry `vector`, reassigned. Each move must transfer ownership so that exactly one handle owns the connection at any instant, it never leaks (slot never freed), and it is never closed twice (a later order riding a recycled slot). This is the canonical C++ resource-ownership question, and it drills the signature C++ topic: **RAII and the rule of five** — deterministic destruction, deleted copy, move that leaves the source inert, and the `noexcept` release path. It is `std::unique_ptr` written by hand so the mechanics are exposed.

**Mental model**

RAII means a resource's lifetime *is* an object's lifetime: acquire in the constructor, release in the destructor, and C++'s deterministic scope-exit does the rest — no GC, no `finally`, no manual `close()`. The whole kata is one question: **who runs the destructor's release, and how many times?** A connection has exactly one owner, so copying is nonsense — two handles would each `close()` the same slot, a double-close on the second destruction. You therefore *delete* copy and transfer ownership by **move**: the move constructor steals the source's state and flips the source to "closed / inert" so *its* destructor becomes a no-op. That flag — the moved-from state — is the entire trick, identical to how a moved-from `unique_ptr` holds `nullptr`. Move *assignment* adds one wrinkle: `b = std::move(a)` must release whatever `b` already owns *before* stealing `a`'s, or you leak `b`'s old connection. And the destructor must be `noexcept`: if it threw during stack unwinding of another exception, C++ calls `std::terminate`.

**Key terms**

- **RAII** — resource acquisition is initialisation: tie a resource (connection, fd, lock) to an object so the destructor releases it deterministically at scope exit.
- **rule of five** — once you declare *any* of destructor, copy ctor, copy assign, move ctor, move assign, you should reason about all five; the compiler stops generating the rest sensibly.
- **move ctor / move assign** — `T(T&&)` and `operator=(T&&)`: transfer ownership out of a source rvalue, leaving it valid-but-empty.
- **deleted copy** — `T(const T&) = delete;` / `operator=(const T&) = delete;`: one-owner types forbid copying so two handles can't own one resource.
- **`noexcept` destructor** — a release path that cannot throw; mandatory, because throwing while unwinding another exception terminates the program.
- **moved-from state** — the inert state (`open_ == false`) the source is left in so its destructor does nothing and `send` on it throws.
- **ownership** — the invariant that exactly one live object is responsible for releasing the resource; the type enforces it structurally.

**Why interviewers ask this**

It's the fastest way to tell someone who *uses* `unique_ptr` from someone who can *build* one. A junior writes a class with a `close()` and calls it wherever they remember to; a senior makes the destructor the only place release happens and makes it impossible to release twice. The tell is whether the candidate volunteers the rule of five unprompted — declaring a destructor and moves means copy must be handled (here: deleted), and move-assign must release-before-steal and guard self-assignment. The `noexcept` on the destructor is the second tell: knowing *why* (terminate during unwinding) separates rote from understanding. And the money stakes are concrete: a leaked session exhausts the venue's finite connection slots at peak; a double-closed session lets a later order ride a recycled connection — dropped or duplicated fills, real P&L.

**Common confusions**

- *"Deleting copy is enough to make it safe to move."* — No. Deleting copy stops double-ownership by copy, but move must still leave the source inert or you double-close via the move path.
- *"The destructor can just check a flag; throwing there is fine."* — A throwing destructor is a latent `std::terminate`. Keep release `noexcept`.
- *"Move assignment just copies the members over."* — It must first `close()` what `this` already owns, then steal, then null the source — and skip all of it on self-assignment.
- *"A moved-from object is garbage — using it is UB."* — It must be *valid*: destructible and safe to call. Here `send` on it throws, `is_open()` returns false. Valid-but-unspecified, never broken.

**What follows from this topic**

This is the anchor for every owning type you'll write: `unique_ptr` with a custom deleter, a socket/`fd` wrapper, a `thread` handle, a lock guard. The natural extensions lead straight into the rest of the primer: make the connection a *real* owned resource (an `int fd` you `dup`/`close`, or a heap `Connection*`) so a leak or double-close shows up under **AddressSanitizer**; add a `swap` member + free `swap` so `std::swap` is noexcept and allocation-free (the copy-and-swap idiom); and then the concurrency katas, where a session pool shared across threads needs a `StartGate` (`std::latch`) stress test under **TSan**. Ownership discipline here is the precondition for all of it.

### Clarify & design the API

Clarifying questions worth asking out loud: is a session single-owner or can several strategies share one (single — that's *why* it's move-only)? Should `send` on a closed/moved-from handle throw or be a silent no-op (throw — a closed send is a bug, not a valid state)? Is `live_count()` a real per-connection tracker or a test hook (a process-wide counter for this single-threaded kata; a real pool tracks per connection)? Do we need `swap` and thus the copy-and-swap idiom (extension)?

The **ownership decision is the design.** One owner ⇒ copy is deleted, transfer is by move, and the moved-from source must be left inert so its destructor is a no-op. Every method that observes state is `const noexcept`; the two mutators that release (`~ExchangeSession`, `operator=(&&)`) route through one private `close()` so "release exactly once" lives in a single place.

```cpp
namespace katas {

struct Order {                       // fixture, provided verbatim in both trees
    std::uint64_t id{};
    double price{};
    std::uint32_t qty{};
};

// Process-wide count of open connections — the leak / double-close detector the tests assert on.
inline int& live_sessions() { static int n = 0; return n; }

class ExchangeSession {
public:
    explicit ExchangeSession(std::string venue);        // connect: claims a slot, ++live
    ~ExchangeSession() noexcept;                         // release exactly once

    ExchangeSession(const ExchangeSession&) = delete;    // one owner: no copying
    ExchangeSession& operator=(const ExchangeSession&) = delete;

    ExchangeSession(ExchangeSession&&) noexcept;         // steal; leave source inert
    ExchangeSession& operator=(ExchangeSession&&) noexcept;

    void send(const Order& order);                       // throws if closed / moved-from
    bool is_open() const noexcept;
    const std::string& venue() const noexcept;
    std::size_t sent() const noexcept;
    static int live_count() noexcept;                    // == live_sessions()
private:
    void close() noexcept;                               // the single release site
    std::string venue_;
    bool open_{false};
    std::size_t sent_{0};
};

} // namespace katas
```

Say the tradeoff explicitly: `std::shared_ptr<Connection>` with a custom deleter *would* compile, but shared ownership invites "who actually closes it?" — the wrong model for a single-owner venue slot. Move-only is the honest encoding of the domain, and volunteering that reasoning is the senior signal.

### Write the tests

The `practice/` tree ships **no tests** — writing them is the exercise. This module uses a hand-rolled header harness (`KATA_TEST` / `EXPECT_*` / `KATA_MAIN`), **not** GoogleTest; include `../../solution/common/harness.hpp`. The `live_count()` counter is your instrument: assert it around every scope so a leak (never returns to 0) or a double-close (goes negative) is caught mechanically. Cover construction opening a slot, move transferring ownership with the source left closed, *no* double-close after a move, and move-assign releasing the previous connection first.

```cpp
#include "harness.hpp"
#include "exchange_session.hpp"

#include <stdexcept>
#include <utility>

using katas::ExchangeSession;
using katas::Order;

KATA_TEST(construct_opens_and_counts) {
    EXPECT_EQ(ExchangeSession::live_count(), 0);
    {
        ExchangeSession s("LSE");
        EXPECT_TRUE(s.is_open());
        EXPECT_EQ(s.venue(), std::string("LSE"));
        EXPECT_EQ(ExchangeSession::live_count(), 1);
    }
    EXPECT_EQ(ExchangeSession::live_count(), 0);   // released exactly once at scope exit
}

KATA_TEST(move_construct_transfers_ownership) {
    ExchangeSession a("NYSE");
    a.send(Order{1, 10.0, 1});
    EXPECT_EQ(ExchangeSession::live_count(), 1);

    ExchangeSession b(std::move(a));
    EXPECT_EQ(ExchangeSession::live_count(), 1);   // move did NOT open a second connection
    EXPECT_TRUE(b.is_open());                      // target owns it
    EXPECT_FALSE(a.is_open());                     // source is inert
    EXPECT_EQ(b.venue(), std::string("NYSE"));
    EXPECT_EQ(b.sent(), 1u);                       // state transferred
    EXPECT_THROWS(a.send(Order{2, 1.0, 1}), std::logic_error); // send on moved-from throws
}

KATA_TEST(no_double_close_after_move) {
    EXPECT_EQ(ExchangeSession::live_count(), 0);
    {
        ExchangeSession a("ICE");
        ExchangeSession b(std::move(a));
        EXPECT_EQ(ExchangeSession::live_count(), 1);
    } // both a and b destruct here — only the real owner decrements
    EXPECT_EQ(ExchangeSession::live_count(), 0);   // NOT -1: the moved-from dtor is a no-op
}

KATA_TEST(move_assign_releases_previous_connection) {
    ExchangeSession a("A");
    ExchangeSession b("B");
    EXPECT_EQ(ExchangeSession::live_count(), 2);

    b = std::move(a);                              // b's old connection to "B" released here
    EXPECT_EQ(ExchangeSession::live_count(), 1);   // 2 -> 1: no leak of "B"
    EXPECT_EQ(b.venue(), std::string("A"));
    EXPECT_FALSE(a.is_open());
}

KATA_MAIN()
```

The two load-bearing assertions are `no_double_close_after_move` (proves the moved-from destructor is inert — a naive move that forgot to null the source lands `live_count()` at `-1`) and `move_assign_releases_previous_connection` (proves release-before-steal — forgetting it strands `"B"` and leaves the count at `2`). Neither can be caught single-threaded except by watching the counter, which is exactly why it exists. `KATA_MAIN()` expands to a `main` that runs every registered `KATA_TEST` and reports failures.

### Implement it

The whole class routes both release sites through one private `close()`, so "exactly once" is enforced in a single place.

```cpp
explicit ExchangeSession(std::string venue)
    : venue_(std::move(venue)), open_(true) { ++live_sessions(); }   // connect

~ExchangeSession() noexcept { close(); }                             // release once

ExchangeSession(ExchangeSession&& other) noexcept
    : venue_(std::move(other.venue_)), open_(other.open_), sent_(other.sent_) {
    other.open_ = false;                        // source now inert: its dtor is a no-op
}

ExchangeSession& operator=(ExchangeSession&& other) noexcept {
    if (this != &other) {                       // self-assignment guard
        close();                                // release what we currently own, FIRST
        venue_ = std::move(other.venue_);
        open_  = other.open_;
        sent_  = other.sent_;
        other.open_ = false;                    // leave the source inert
    }
    return *this;
}

void send(const Order& order) {
    if (!open_) throw std::logic_error("send on a closed ExchangeSession");
    (void)order; ++sent_;
}

void close() noexcept {                         // the single release site — idempotent
    if (open_) { --live_sessions(); open_ = false; }
}
```

The key gotcha is the whole point of the kata: **release happens exactly once, and only from `close()`, which is `noexcept` and idempotent.** The `if (open_)` guard is what makes a second `close()` — on a moved-from object, or a self-move-assign — a harmless no-op instead of a double decrement. The move constructor *must* set `other.open_ = false`; that one line is the difference between a clean transfer and `live_count()` going negative when the source destructs. Copy is deleted because two live owners can't both be right about who closes. Move-assign does the three things in order: `close()` its current connection (or leak it), steal the source's members, then null the source. And the destructor is `noexcept` so that if it runs during stack unwinding of another exception, it can't trigger `std::terminate`. Everything else — `is_open`, `venue`, `sent`, `live_count` — is a `const noexcept` observer with no ownership stake.

### Common mistakes & senior signal

- **Forgetting to null the moved-from source.** The move ctor copies `open_` but doesn't set `other.open_ = false`, so both objects `close()` on destruction — a double decrement, `live_count()` hits `-1`. The moved-from state flag *is* the mechanism. **Senior signal** — states that a moved-from object must be left valid-and-inert, exactly like a `nullptr` `unique_ptr`, and points to the single line that guarantees it.
- **Move-assign that steals before releasing.** `b = std::move(a)` overwrites `b`'s members without `close()`-ing `b`'s current connection first — `"B"`'s slot leaks, `live_count()` stays high. **Senior signal** — release-before-steal *and* a `this != &other` self-assignment guard, both stated as deliberate, not incidental.
- **A destructor (or `close()`) that can throw.** A throwing release path is a latent `std::terminate` the moment it fires during another exception's unwinding. **Senior signal** — marks the destructor and release path `noexcept` and can explain the unwinding-terminate rule without prompting.
- **Reaching for `shared_ptr` to "avoid the move complexity."** Shared ownership compiles but models the domain wrong — a venue slot has one owner — and only defers the "who closes it?" question. **Senior signal** — chooses move-only because it's the honest encoding of single ownership, and names `unique_ptr` as the stdlib equivalent this kata rebuilds by hand.
- **Only testing single-threaded happy paths.** Without asserting `live_count()` around move and move-assign scopes, a double-close or a leak passes silently. **Senior signal** — instruments the counter around every scope so leaks and double-closes fail mechanically, and reaches for ASan (real `fd`) and a `StartGate`/TSan pool test as the extensions that make the bug physical.

## Tick Buffer — A Ring Over Raw Aligned Storage (Placement New)

### Summary

**What this topic covers**

You build a fixed-capacity rolling window of the last N market ticks for a symbol — the raw material for a rolling VWAP, a last-N-trades feed, a short-horizon momentum signal. A pricing loop sees millions of ticks a second, so the window is a *bounded* history that recycles its storage: once it holds N ticks, each new tick overwrites the oldest, and the hard rule is **zero heap allocation per tick** — allocate the backing store once at construction, never again. The signature C++ topic it drills is **manual object lifetime over raw storage**: `::operator new` with `std::align_val_t`, placement `new` to construct, `std::destroy_at` to destroy, and a ring (head/count) laid over the bytes — the mechanics `std::vector` normally hides from you, done by hand.

**Mental model**

`std::vector<T>` and `new T[capacity]` both *default-construct* every element up front (and `vector` may reallocate as it grows). That is wrong twice: a `Tick` has no meaningful "empty" value, and constructing N of them is work you never asked for. So you separate the two things `vector` fuses — **allocation** and **construction**. Allocate once: `capacity` slots of raw, uninitialised, correctly-aligned bytes (`::operator new(sizeof(T)*capacity, align_val_t(alignof(T)))`). Then a slot is just a bag of bytes; reading it is undefined behaviour until you *construct* a live `T` in it with placement `new`, and you must *destroy* that `T` with `std::destroy_at` before the slot is reused or the buffer dies. The ring is bookkeeping over those slots: `head_` is the physical index of the oldest live element, `count_` how many are live, the write slot is `(head_ + count_) % capacity_`. The whole kata lives in keeping construction, destruction, and the ring indices in exact lockstep so every recorded tick is constructed once and destroyed exactly once.

**Key terms**

- **raw aligned storage** — a block of uninitialised bytes sized `sizeof(T)*capacity` and aligned to `alignof(T)`; no `T` exists in it yet.
- **`operator new` / `std::align_val_t`** — the allocation primitive underneath `new`; the aligned overload returns storage suitable for `T` without constructing anything. Paired with the sized, aligned `operator delete`.
- **placement new** — `::new (ptr) T(args)` constructs a `T` *in* memory you already own; it allocates nothing, it only runs the constructor.
- **`std::destroy_at`** — runs `T`'s destructor on the object at `ptr` without freeing the storage; the inverse of placement `new`.
- **manual lifetime** — you, not the compiler, decide exactly when each element is constructed and destroyed; the storage outlives individual objects.
- **ring head/count** — `head_` points at the oldest live element, `count_` counts live elements; together they define the live window over the fixed slots.
- **destroy-before-overwrite** — when full, `record` must `destroy_at` the element it is about to replace *before* placement-newing into that slot, or the old object leaks.
- **no `vector<T>`** — the backing store is deliberately *not* a `vector<T>`, because that would default-construct every slot and can reallocate; the point is to avoid both.

**Why interviewers ask this**

It separates people who reach for `std::vector` reflexively from people who understand what a container actually *does* — that allocation and object lifetime are separable, and that on a hot path you often want to manage them apart. A junior writes `std::vector<T>`, calls `.push_back`, and never sees the default-constructions or the reallocations they've signed up for. A senior can state precisely why raw storage is the right tool here, place a placement-`new` and a matching `destroy_at`, get the ring modulo right so `snapshot()` reads live slots in order, and — the real tell — reason about the destructor destroying *exactly* the live range and nothing else. It also exposes whether someone can *test* lifetime correctness: a live-instance counter that would catch a leak (overwrite without destroy) or a double-destroy (destroying a never-constructed slot).

**Common confusions**

- *"Just use `std::vector<T>` and `pop_front` past N."* — That default-constructs N elements you never wanted and isn't allocation-free; a `deque` is closer but still allocates and has worse locality.
- *"Placement `new` allocates memory."* — No. It constructs an object in storage you already have; the allocation happened once, up front.
- *"Overwriting the oldest just means assigning the new value."* — Only for trivial types. In general you must `destroy_at` the old object first, then placement-`new` the new one — otherwise the old element's destructor never runs.
- *"The destructor can just `delete[]` the array."* — There is no array of live objects; there are `count_` live elements scattered in a ring. You destroy exactly those, then free the raw bytes with the sized, aligned `operator delete`.

**What follows from this topic**

This is the foundation for anything that manages storage by hand: a small-buffer-optimised type, an arena/pool allocator, a lock-free SPSC ring (same head/count discipline, plus atomics and memory ordering), or the rule-of-five deep copy of exactly the live elements. The natural extension — make the buffer copyable and movable — turns this into a full manual-lifetime container: copy placement-news each live element from the source and leaves the source's spare slots raw. It is the concrete anchor for `construct_at`/`destroy_at`, aligned allocation, and the separation of allocation from construction everywhere else in C++.

### Clarify & design the API

Clarifying questions worth asking out loud: what is the fixed capacity, and is it set once at construction (yes — allocate once, never resize)? When a new tick arrives and the buffer is full, do we overwrite the oldest or reject (overwrite-oldest — it's a rolling window)? What is the element's lifetime — is there a meaningful "empty" `Tick` (no — so we must *not* default-construct slots)? Should `snapshot` be oldest-first or newest-first (oldest → newest, so it reads like a time series)? Copyable/movable (no for this kata — manual lifetime makes correct copy/move fiddly; that's the extension).

The **storage decision** is the design. Because a slot has no meaningful empty value and per-tick allocation is banned, the backing store is raw aligned bytes, not `vector<T>` or `new T[]`. Element lifetime is then manual: placement-`new` on record, `destroy_at` on overwrite and in the destructor. A `head_`/`count_` ring lays the live window over the fixed slots.

```cpp
struct Tick {                                   // provided verbatim in both trees
    std::uint64_t seq{};
    double price{};
    std::uint32_t qty{};
    bool operator==(const Tick&) const = default; // so EXPECT_EQ works
};

template <typename T>
class TickBuffer {
public:
    explicit TickBuffer(std::size_t capacity);  // allocates raw aligned storage; capacity==0 throws
    ~TickBuffer();                              // destroys the live elements, then frees the store

    TickBuffer(const TickBuffer&) = delete;     // non-copyable, non-movable: manual lifetime makes
    TickBuffer& operator=(const TickBuffer&) = delete;   // copy/move fiddly — the kata is about the
    TickBuffer(TickBuffer&&) = delete;                   // storage discipline, not the rule of five
    TickBuffer& operator=(TickBuffer&&) = delete;

    void record(const T& tick);                 // append; overwrites the oldest when full
    const T& latest() const;                    // most recent; throws std::out_of_range if empty
    std::vector<T> snapshot() const;            // copy of the live window, oldest -> newest

    std::size_t size() const noexcept;
    std::size_t capacity() const noexcept;
    bool empty() const noexcept;
    bool full() const noexcept;
};
```

Say the tradeoff explicitly: the raw-storage design buys allocation-free, default-construction-free operation at the cost of hand-managed lifetime — every construct needs a matching destroy, and the ring math must never point at an already-destroyed or never-constructed slot. Choosing raw storage over `vector<T>` *is* the senior signal — you're volunteering the harder mechanics because the hot-path constraints demand them.

### Write the tests

The README ships **no tests** — writing them is the exercise. The module uses a hand-rolled header harness (`KATA_TEST` / `EXPECT_*` / `KATA_MAIN`), not GoogleTest. Start with empty state and the throwing edges, then the fill/overwrite behaviour and snapshot ordering, and finish with the test that actually pins lifetime correctness: a **live-instance counter** type proving every element is constructed once and destroyed exactly once — no leak, no double-destroy.

```cpp
#include "harness.hpp"
#include "tick_buffer.hpp"

#include <stdexcept>
#include <vector>

using katas::Tick;
using katas::TickBuffer;

KATA_TEST(empty_buffer_has_no_ticks) {
    TickBuffer<Tick> buf(4);
    EXPECT_EQ(buf.size(), 0u);
    EXPECT_EQ(buf.capacity(), 4u);
    EXPECT_TRUE(buf.empty());
    EXPECT_FALSE(buf.full());
    EXPECT_THROWS(buf.latest(), std::out_of_range);   // latest on empty is an error, not UB
    EXPECT_TRUE(buf.snapshot().empty());
}

KATA_TEST(capacity_zero_throws) {
    EXPECT_THROWS(TickBuffer<Tick>(0), std::invalid_argument); // a zero-slot ring is meaningless
}

KATA_TEST(record_below_capacity_keeps_all) {
    TickBuffer<Tick> buf(4);
    buf.record(Tick{1, 100.0, 10});
    buf.record(Tick{2, 101.0, 5});

    EXPECT_EQ(buf.size(), 2u);
    EXPECT_FALSE(buf.full());
    EXPECT_EQ(buf.latest(), (Tick{2, 101.0, 5}));
    std::vector<Tick> expected{Tick{1, 100.0, 10}, Tick{2, 101.0, 5}};
    EXPECT_EQ(buf.snapshot(), expected);              // oldest -> newest, nothing dropped
}

KATA_TEST(overwrite_oldest_when_exceeding_capacity) {
    TickBuffer<Tick> buf(3);
    for (std::uint64_t s = 1; s <= 5; ++s) {
        buf.record(Tick{s, 10.0 * static_cast<double>(s), static_cast<std::uint32_t>(s)});
    }
    EXPECT_EQ(buf.size(), 3u);
    EXPECT_TRUE(buf.full());
    std::vector<Tick> expected{Tick{3, 30.0, 3}, Tick{4, 40.0, 4}, Tick{5, 50.0, 5}};
    EXPECT_EQ(buf.snapshot(), expected);              // only the last 3 survive, in order
    EXPECT_EQ(buf.latest(), (Tick{5, 50.0, 5}));
}

KATA_TEST(wrap_many_times_stays_consistent) {
    TickBuffer<Tick> buf(2);
    for (std::uint64_t s = 1; s <= 100; ++s) buf.record(Tick{s, static_cast<double>(s), 1});
    std::vector<Tick> expected{Tick{99, 99.0, 1}, Tick{100, 100.0, 1}};
    EXPECT_EQ(buf.snapshot(), expected);             // ring math holds after 50 wraps
    EXPECT_EQ(buf.latest(), (Tick{100, 100.0, 1}));
}

// A type that counts live instances, to prove each element is constructed and destroyed exactly
// once — no leak (overwrite-without-destroy) and no double-destroy (destroying a raw slot).
namespace {
int& counted_live() { static int n = 0; return n; }

struct Counted {
    int value{0};
    Counted() { ++counted_live(); }
    explicit Counted(int v) : value(v) { ++counted_live(); }
    Counted(const Counted& o) : value(o.value) { ++counted_live(); }
    Counted& operator=(const Counted&) = default;
    ~Counted() { --counted_live(); }
    bool operator==(const Counted&) const = default;
};
} // namespace

KATA_TEST(non_trivial_type_lifetime_is_balanced) {
    EXPECT_EQ(counted_live(), 0);
    {
        TickBuffer<Counted> buf(3);
        for (int i = 0; i < 10; ++i) {
            buf.record(Counted{i});
            EXPECT_TRUE(counted_live() <= 3);        // overwrites destroy before constructing
        }
        EXPECT_EQ(counted_live(), 3);                // a full buffer holds exactly capacity live
        EXPECT_EQ(buf.latest().value, 9);
    }
    EXPECT_EQ(counted_live(), 0);                    // destructor released every live element once
}

KATA_MAIN()
```

The `Counted` test is the one that matters: it is the only thing that can *catch* a manual-lifetime bug. `counted_live() <= 3` inside the loop fails if an overwrite forgets to `destroy_at` first (the count climbs past capacity — a leak); `counted_live() == 0` after the scope fails if the destructor skips a live element (leak) or destroys a never-constructed slot (the count goes negative — a double-destroy on the general case). Plain `Tick` tests prove the ring *ordering*; `Counted` proves the *lifetime* accounting.

### Implement it

The implementation separates allocation (once, in the constructor) from construction (per record, via placement `new`) and destruction (per overwrite and in the destructor, via `destroy_at`). The ring is `head_` (oldest live index) + `count_` (live count); a `slot(logical)` helper maps an unwrapped logical position onto a physical pointer with one modulo.

```cpp
template <typename T>
class TickBuffer {
public:
    explicit TickBuffer(std::size_t capacity)
        : capacity_(capacity),
          data_(capacity == 0
                    ? throw std::invalid_argument("TickBuffer capacity must be > 0")
                    : static_cast<T*>(::operator new(sizeof(T) * capacity,
                                                     std::align_val_t(alignof(T))))) {}

    ~TickBuffer() {
        for (std::size_t i = 0; i < count_; ++i)     // destroy EXACTLY the live elements,
            std::destroy_at(slot(head_ + i));        // oldest-first with wrap
        ::operator delete(data_, sizeof(T) * capacity_, std::align_val_t(alignof(T)));
    }

    void record(const T& tick) {
        T* write = slot(head_ + count_);             // (head_ + count_) % capacity_
        if (count_ == capacity_) {
            std::destroy_at(write);                  // release what we overwrite, FIRST
            ::new (static_cast<void*>(write)) T(tick);
            head_ = index(head_ + 1);                // oldest advances; size stays at capacity
        } else {
            ::new (static_cast<void*>(write)) T(tick);
            ++count_;
        }
    }

    const T& latest() const {
        if (count_ == 0) throw std::out_of_range("TickBuffer::latest on empty buffer");
        return *slot(head_ + count_ - 1);
    }

    std::vector<T> snapshot() const {
        std::vector<T> out;
        out.reserve(count_);
        for (std::size_t i = 0; i < count_; ++i) out.push_back(*slot(head_ + i));
        return out;                                  // copies of the live window, oldest -> newest
    }

private:
    T* slot(std::size_t logical) noexcept { return data_ + index(logical); }
    const T* slot(std::size_t logical) const noexcept { return data_ + index(logical); }
    std::size_t index(std::size_t logical) const noexcept { return logical % capacity_; }

    std::size_t capacity_;
    T* data_;
    std::size_t head_{0};   // physical index of the oldest live element
    std::size_t count_{0};  // number of live elements
};
```

The key gotcha is that the storage is *raw* — a bag of bytes — and you own construction and destruction by hand. Three rules make it correct. First, **destroy before overwrite**: when full, `record` calls `std::destroy_at(write)` on the element it is about to replace *before* the placement-`new`; skip it and the overwritten object's destructor never runs (a leak of, say, a `std::string` field). Second, **the destructor destroys exactly the live elements** — it walks `count_` slots from `head_` with wrap, never touching a slot that was never constructed, then frees the store with the *matching sized, aligned* `::operator delete`. Third, **the ring math must land on live slots**: `(head_ + count_)` can be up to `2*capacity_ - 1`, so one modulo brings it home; get it wrong and `snapshot`/`latest` read an already-destroyed or never-constructed slot — undefined behaviour that feeds a garbage price into the VWAP. And the reason it is not `vector<T>`: `vector` (and `new T[]`) *default-construct* every slot up front and may reallocate — exactly the two costs this hot path forbids. Raw storage lets a slot stay uninitialised bytes until a real tick is recorded there.

### Common mistakes & senior signal

The headline trap: **reaching for `std::vector<T>`** because it's the default container. It default-constructs every slot and can reallocate — both banned here. Naming *why* raw storage is the right tool, unprompted, is the signal.

- **Overwrite without destroy (leak).** Placement-newing over a full slot without `std::destroy_at` first means the old object's destructor never runs; for a `T` owning a heap resource that's a per-tick leak that OOMs a long session. **Senior signal** — destroys the outgoing element *before* constructing the replacement, and proves it with a live-instance-counter test rather than trusting the eye.
- **Assuming placement `new` allocates.** Treating `::new (slot) T(x)` as if it hits the allocator — or worse, pairing it with plain `delete` — misunderstands the primitive. **Senior signal** — separates allocation (once, `::operator new`) from construction (placement `new`) from destruction (`std::destroy_at`), and frees with the *sized, aligned* `::operator delete` that matches the aligned `operator new`.
- **Destroying the wrong range in the destructor.** Looping `0..capacity_` destroys never-constructed slots (double-destroy / UB on raw bytes); looping the wrong start misses live ones (leak). **Senior signal** — destroys *exactly* `count_` elements walking from `head_` with wrap, and can say why any other range is a bug.
- **Off-by-one ring math.** Using `head_ + count_` without the modulo, or reading `head_ + count_` (one past newest) for `latest()` instead of `head_ + count_ - 1`, reads a destroyed or out-of-range slot. **Senior signal** — writes the wrap-many-times test that exercises the modulo across dozens of wraps, not just one fill.
- **Ignoring alignment.** Allocating with the plain `::operator new(size)` instead of the `align_val_t` overload gives storage that may be under-aligned for `T` — UB on some ABIs, a fault for over-aligned types. **Senior signal** — allocates and frees with `std::align_val_t(alignof(T))` on both sides, matching the pair exactly.

## Order Handle — Intrusive Reference Counting

### Summary

**What this topic covers**

You build the owning reference a matching engine hands around: a fixed `OrderPool` checks out `Order`s, and the *same* `Order` is held at once by several subsystems — it rests in a price level's queue, it is indexed by client order id, and the risk engine holds it to track exposure. Each is a separate owner. The order must stay alive while *any* owner references it, and return to the pool the instant the *last* owner lets go. An `OrderHandle` is that reference — a hand-rolled `intrusive_ptr` — and the topic it drills is C++'s **rule of five on a shared resource**: writing copy, move, and destruction so an intrusive reference count stays exactly balanced, with self-assignment safety and exactly-once reclamation. This is the canonical "implement a smart pointer by hand" senior question, minus the heap.

**Mental model**

`std::shared_ptr` puts the count in a *separate* heap-allocated control block reached through the pointer — external refcounting, one extra allocation and indirection per shared object. The intrusive model puts the count *inside* the `Order` itself (`ref_count`), so one cache line holds the payload and its count, and a raw `Order*` can be promoted straight back to an owning handle with no lookup — exactly what a hot matching loop wants. The price is discipline: only `OrderHandle` may touch `ref_count`, and every one of the five special members must keep it balanced. Think of the handle as a valve on a shared counter — **copy bumps** (a new owner appeared), **move steals** the pointer and nulls the source (ownership transfers, count untouched), and **destructor / `reset` releases** (decrement, and reclaim the slot on the single 0-transition). Get any one wrong and the count drifts: too high and the slot leaks forever, too low and it is handed to a future `acquire()` while an owner still holds it.

**Key terms**

- **intrusive refcount** — the count lives *in* the resource (`int ref_count` on `Order`), not in a separate control block; no allocation, one indirection saved, `Order*`→handle promotion is free.
- **rule of five on a shared resource** — declaring a destructor means you must reason about the copy ctor, copy-assign, move ctor, and move-assign too; on shared state each must adjust the count correctly.
- **copy bumps / move steals / dtor releases** — the three verbs: copy `++ref_count`, move takes the pointer and nulls the source (count unchanged), destruction/`reset` `--ref_count`.
- **self-assignment safety** — `h = h;` (and assigning two handles that already share one order) must not free the very order it keeps pointing at; increment the incoming count *before* releasing your own.
- **no leak / double-free** — exactly one 0-transition per order: a missed decrement leaks a pool slot; a double decrement frees a live slot.
- **`OrderPool` recycle** — a fixed `std::vector<Order>`; "reclaim" means a slot's `ref_count` fell to 0 and is reusable by a later `acquire()` — never a `delete`.
- **non-atomic caveat** — `ref_count` is a plain `int`; this kata is single-threaded. A cross-thread pool needs `std::atomic<int>` (acquire/release on the decrement-to-zero) and a lock-free free-list.

**Why interviewers ask this**

Hand-writing a smart pointer is the cleanest test of whether someone actually understands ownership rather than reciting "use `shared_ptr`." A junior writes the copy ctor, sees the happy-path test pass, and ships a copy-assign that frees the order it is about to keep. A senior states the rule of five unprompted, explains *why* copy-assign increments before releasing (self-assignment and same-order assignment are use-after-frees otherwise), guarantees the reclaim fires exactly once at the 0-transition, and — the real tell — knows intrusive vs external refcounting cold and can name where the plain `int` stops being safe. It is also a clean lens on the money stakes: a slot recycled while it still rests in the book fills a *recycled* order — phantom fills, wrong price, exposure booked to the wrong account.

**Common confusions**

- *"The compiler's defaults are fine."* — No. A resource-owning class with a custom destructor gets defaulted copy/move that copy the raw pointer without touching the count — double-free on the second destruction. Declaring the destructor is *why* you must write the other four.
- *"Copy-assign: release the old, then point at the new."* — That order is the bug. If both sides share one order, releasing first can reclaim the slot before you re-point at it. Bump the incoming count first.
- *"Move should bump the count."* — No. Move *transfers* one owner to another; the count is unchanged. Only copy adds an owner.
- *"`use_count()` on a null handle is undefined."* — It must be a defined `0`; a null handle owns nothing. Every accessor has to be null-safe.

**What follows from this topic**

This is the gateway to the rest of the C++ ownership katas: a `unique`-style move-only handle (move without the count), then the concurrency step — swap `int` for `std::atomic<int>` with acquire/release ordering on the decrement-to-zero and a lock-free free-list, which lands you in atomics and memory ordering. The `intrusive_ptr`-style aliasing constructor (promote a raw `Order*` back to an owning handle) is the natural extension. It is the concrete anchor for RAII, the rule of five, and "own exactly once" discipline everywhere else in C++.

### Clarify & design the API

Clarifying questions worth asking out loud: intrusive count (inside the `Order`) or external (a separate control block like `shared_ptr`)? — intrusive here, so the count is a field only the handle touches, no allocation. Does the pool `delete` on reclaim or recycle the slot? — recycle: the backing `std::vector<Order>` lives for the pool's lifetime, `ref_count == 0` just marks a slot free for a later `acquire()`. Thread-safe? — no, single matching thread owns the book; a plain `int` is fine, and I'll name what changes for a shared pool (`std::atomic<int>` + lock-free free-list).

The **ownership decision is the whole design**. `Order` carries its own count; `OrderPool` hands out `OrderHandle`s and finds free slots by scanning for `ref_count == 0`; `OrderHandle` holds a single raw `Order*` and is responsible for keeping the count balanced across all five special members.

```cpp
// The pooled resource — carries its own intrusive count, touched ONLY by OrderHandle.
struct Order {
    std::uint64_t id{};
    double price{};
    std::uint32_t qty{};
    int ref_count{0};              // intrusive; 0 means the slot is free
};

// A fixed slab. "Reclaim" = a slot's ref_count returned to 0, reusable — never a delete.
class OrderPool {
public:
    explicit OrderPool(std::size_t capacity);
    OrderHandle acquire(std::uint64_t id, double price, std::uint32_t qty); // ref_count=1, or throws
    std::size_t live() const noexcept;      // slots with ref_count > 0
    std::size_t capacity() const noexcept;
};

// The intrusive handle — the SUT. The rule of five on a shared resource.
class OrderHandle {
public:
    OrderHandle() noexcept;                              // null: owns nothing
    ~OrderHandle();                                      // release; reclaim if last
    OrderHandle(const OrderHandle&) noexcept;            // copy: ++count
    OrderHandle& operator=(const OrderHandle&) noexcept; // copy-assign: bump-before-release
    OrderHandle(OrderHandle&&) noexcept;                 // move: steal + null source
    OrderHandle& operator=(OrderHandle&&) noexcept;      // move-assign: release old, steal
    Order* get() const noexcept;
    Order& operator*() const noexcept;
    Order* operator->() const noexcept;
    long use_count() const noexcept;                     // count, or 0 if null
    void reset() noexcept;                               // release + become null
    explicit operator bool() const noexcept;
private:
    friend class OrderPool;                              // adopts a checked-out slot
    explicit OrderHandle(Order* adopted) noexcept;       // ref_count already 1
    Order* order_;
};
```

Say the tradeoff explicitly: intrusive refcounting buys you no control-block allocation and free `Order*`→handle promotion at the cost of `Order` knowing it is refcounted and the handle owning every count adjustment. `shared_ptr<Order>` with a custom deleter that returns the slot to the pool would work too — external count, but a control-block allocation per order and a lookup indirection the hot loop pays. Choosing the intrusive hand-roll *is* the exercise: the count mechanics are yours to get exactly right.

### Write the tests

The README ships **no tests** — writing them is the exercise. Use the module's hand-rolled header harness (`KATA_TEST` / `EXPECT_*` / `KATA_MAIN`), not GoogleTest. Drive the contract first (null, acquire, the accessors), then each special member, then the two traps that separate seniors: self-copy-assignment and same-order assignment (must *not* free the shared order), and pool exhaustion / reclaim-once.

```cpp
#include "harness.hpp"
#include "order_handle.hpp"
#include <stdexcept>
#include <utility>

using katas::Order;
using katas::OrderHandle;
using katas::OrderPool;

KATA_TEST(null_handle_owns_nothing) {
    OrderHandle h;
    EXPECT_FALSE(static_cast<bool>(h));
    EXPECT_EQ(h.use_count(), 0L);           // null-safe: defined 0, not UB
    EXPECT_TRUE(h.get() == nullptr);
}

KATA_TEST(acquire_checks_out_one_slot) {
    OrderPool pool(4);
    OrderHandle h = pool.acquire(42, 100.5, 10);
    EXPECT_TRUE(static_cast<bool>(h));
    EXPECT_EQ(pool.live(), 1u);
    EXPECT_EQ(h.use_count(), 1L);
    EXPECT_EQ(h->id, 42u);                  // operator-> reaches the payload
    EXPECT_EQ((*h).id, 42u);
}

KATA_TEST(copy_shares_ownership_count_two) {
    OrderPool pool(4);
    OrderHandle a = pool.acquire(7, 10.0, 1);
    OrderHandle b = a;                      // second owner of the SAME order
    EXPECT_EQ(a.use_count(), 2L);
    EXPECT_EQ(b.use_count(), 2L);
    EXPECT_TRUE(a.get() == b.get());        // same underlying Order
    EXPECT_EQ(pool.live(), 1u);             // shared, not a second acquire
}

KATA_TEST(dropping_one_copy_leaves_order_live) {
    OrderPool pool(4);
    OrderHandle a = pool.acquire(7, 10.0, 1);
    { OrderHandle b = a; EXPECT_EQ(a.use_count(), 2L); }  // b drops here
    EXPECT_EQ(a.use_count(), 1L);
    EXPECT_EQ(pool.live(), 1u);
}

KATA_TEST(dropping_last_handle_reclaims_slot) {
    OrderPool pool(4);
    { OrderHandle a = pool.acquire(7, 10.0, 1); EXPECT_EQ(pool.live(), 1u); }
    EXPECT_EQ(pool.live(), 0u);             // reclaimed exactly once
}

KATA_TEST(self_copy_assignment_is_safe) {
    OrderPool pool(4);
    OrderHandle h = pool.acquire(11, 12.0, 4);
    OrderHandle& alias = h;
    h = alias;                              // must NOT free the order it keeps pointing at
    EXPECT_TRUE(static_cast<bool>(h));
    EXPECT_EQ(h.use_count(), 1L);
    EXPECT_EQ(pool.live(), 1u);
}

KATA_TEST(copy_assign_between_handles_to_same_order_is_safe) {
    OrderPool pool(4);
    OrderHandle a = pool.acquire(11, 12.0, 4);
    OrderHandle b = a;                      // both share the one order, count 2
    b = a;                                  // stays at 2 — must not free the shared order
    EXPECT_EQ(a.use_count(), 2L);
    EXPECT_TRUE(a.get() == b.get());
    EXPECT_EQ(pool.live(), 1u);
}

KATA_TEST(move_transfers_ownership_and_nulls_source) {
    OrderPool pool(4);
    OrderHandle a = pool.acquire(9, 55.0, 3);
    OrderHandle b = std::move(a);
    EXPECT_EQ(b.use_count(), 1L);           // count UNCHANGED by the move
    EXPECT_FALSE(static_cast<bool>(a));     // source is now null
    EXPECT_EQ(a.use_count(), 0L);
    EXPECT_EQ(pool.live(), 1u);
}

KATA_TEST(pool_exhaustion_throws) {
    OrderPool pool(2);
    OrderHandle a = pool.acquire(1, 1.0, 1);
    OrderHandle b = pool.acquire(2, 2.0, 2);
    EXPECT_THROWS(pool.acquire(3, 3.0, 3), std::runtime_error);
}

KATA_TEST(three_subsystems_share_one_order_reclaimed_once) {
    // The whole point: price level + id-index + risk engine each hold a handle.
    OrderPool pool(4);
    OrderHandle price_level = pool.acquire(100, 250.0, 20);
    OrderHandle id_index = price_level;
    OrderHandle risk = price_level;
    EXPECT_EQ(price_level.use_count(), 3L);
    EXPECT_EQ(pool.live(), 1u);

    id_index.reset();
    EXPECT_EQ(price_level.use_count(), 2L);
    risk.reset();
    EXPECT_EQ(price_level.use_count(), 1L);
    EXPECT_EQ(pool.live(), 1u);             // still one owner — not yet reclaimed
    price_level.reset();                    // last owner lets go
    EXPECT_EQ(pool.live(), 0u);             // returned to the pool exactly ONCE
}

KATA_MAIN()
```

Compile the test next to the header and run it via `ctest --test-dir build -R order_handle`. The tests that actually catch a broken handle are `self_copy_assignment_is_safe`, `copy_assign_between_handles_to_same_order_is_safe`, and `three_subsystems_share_one_order_reclaimed_once`: a bump-after-release copy-assign frees a live order and one of the first two turns into a use-after-free (a `live()` or `use_count()` that reads wrong, or a crash under sanitizers); a missed or doubled decrement makes the three-owner test's final `live()` land on 1 (leak) or trip an early reclaim. Building with `-fsanitize=address` makes the use-after-free loud rather than silently passing.

### Implement it

The mechanics are small; the *ordering* inside copy-assign and the exactly-once reclaim are everything.

```cpp
OrderHandle() noexcept : order_(nullptr) {}

~OrderHandle() { reset(); }

// Copy: a new owner appears — bump the shared count.
OrderHandle(const OrderHandle& other) noexcept : order_(other.order_) {
    if (order_ != nullptr) ++order_->ref_count;
}

// Copy-assign: claim the incoming BEFORE releasing our own. If `this` and `other`
// share the same Order (or are the same handle), releasing first could reclaim the
// slot we are about to keep pointing at. Incrementing first makes self-assignment
// AND same-order assignment safe with no separate `this == &other` guard.
OrderHandle& operator=(const OrderHandle& other) noexcept {
    Order* incoming = other.order_;
    if (incoming != nullptr) ++incoming->ref_count;  // claim new first
    release();                                       // then drop old (safe even if same slot)
    order_ = incoming;
    return *this;
}

// Move: steal the pointer, null the source. Ownership transfers; the count is unchanged.
OrderHandle(OrderHandle&& other) noexcept : order_(other.order_) { other.order_ = nullptr; }

OrderHandle& operator=(OrderHandle&& other) noexcept {
    if (this != &other) {
        release();                  // drop what we currently own
        order_ = other.order_;      // steal
        other.order_ = nullptr;     // leave the source null
    }
    return *this;
}

long use_count() const noexcept { return order_ != nullptr ? order_->ref_count : 0; }

void reset() noexcept { release(); order_ = nullptr; }

// Decrement the shared count; the slot is free again on the single 0-transition.
// Does NOT null order_ — callers repoint or null it. Null-safe.
void release() noexcept {
    if (order_ != nullptr && --order_->ref_count == 0) {
        // Reclaimed: the slot is free. A future acquire() finds it by scanning and
        // overwrites the fields on reuse — nothing to delete.
    }
}
```

The key gotcha is the **rule of five on a shared resource**. Because you declare a destructor, the compiler will *not* give you safe copy/move — the defaults would blit the raw `Order*` and let two handles both decrement (or both leak), so you must write all five and keep the count exactly balanced. The single sharpest line is copy-assign: **increment the incoming count before releasing your own.** `h = h;` aliases both sides to one order; if you released first, `--ref_count` could hit 0 and reclaim the slot, and then you re-point `order_` at a freed slot — a use-after-free that a warm single-threaded test often hides. Bump-first makes self-assignment and same-order assignment safe without a `this == &other` guard. Then **reclaim exactly once**: the 0-transition lives in one place (`release`, called by both the destructor and `reset`), so every drop routes through it and the slot returns to the pool on precisely the last owner — a missed decrement leaks the slot, a double decrement frees a live order. The **non-atomic caveat** closes it: `--order_->ref_count` is a plain read-modify-write on an `int`; two threads dropping the last two handles could both see a pre-decrement value and either double-free or leak. A shared pool needs `std::atomic<int>` with `fetch_sub(1, std::memory_order_acq_rel)` on the decrement-to-zero and a lock-free free-list in place of the linear slot scan.

### Common mistakes & senior signal

The headline trap: **letting the compiler default your copy/move on a resource-owning class.** Declaring a destructor is a signal you own something — the other four members are yours to write too, and the defaults are a double-free.

- **Bump-after-release copy-assign (use-after-free).** `release(); order_ = other.order_; if (order_) ++order_->ref_count;` frees a shared order on `h = h;` before re-pointing at it. Increment the incoming count *first*, then release; no `this == &other` guard needed. **Senior signal** — volunteers self-assignment and same-order assignment as the cases, and orders the operations so both are safe by construction rather than patched with a guard.
- **Move that bumps the count.** Treating move like copy leaves the count one too high and the slot leaks. Move transfers an owner — steal the pointer, null the source, leave the count alone. **Senior signal** — states the invariant crisply: copy changes the owner *count*, move changes *which handle* is the owner.
- **Reclaim in more than one place.** Decrementing in both the destructor and an assignment path without a single choke point risks a double 0-transition. Route every drop through one `release()`. **Senior signal** — points to the single 0-transition as the correctness anchor and can say exactly what a missed vs doubled decrement costs (leaked slot vs a live order recycled under a new client).
- **Null-unsafe accessors.** `use_count()` on a default handle must be a defined `0`, not a deref of `nullptr`. Guard every accessor. **Senior signal** — treats the null handle as a first-class state, not an afterthought.
- **Claiming it's thread-safe.** The `int` count makes the whole thing single-thread-only. **Senior signal** — names the plain `int` as the boundary and prescribes the fix precisely: `std::atomic<int>`, acquire/release on the decrement-to-zero, and a lock-free free-list — without pretending the current code is safe to share.

Extensions that show depth: make `ref_count` a `std::atomic<int>` and the pool a lock-free free-list so handles cross threads; add an `intrusive_ptr`-style aliasing constructor that promotes a raw `Order*` back to an owning handle; or write the `shared_ptr`-with-custom-deleter variant and compare the control-block allocation and indirection you traded away.

## Top of Book — A Seqlock Quote Publisher (Atomic Payload, TSan)

### Summary

**What this topic covers**

You build a market-data thread's quote publisher: one writer continuously installs the best
bid/ask for a symbol — a multi-word `Quote` (`bid_px`, `bid_qty`, `ask_px`, `ask_qty`, `seq`) —
and dozens of strategy threads read the *latest* quote on every tick of their own loops. The read
path is the hot path: it must never block the writer, never block other readers, and never return a
**torn** quote (a new `bid_px` stitched to a stale `ask_px`). The signature C++ topic it drills is
the **seqlock** — a sequence-counter synchronisation primitive — and the memory-model subtlety that
a naive seqlock is undefined behaviour that ThreadSanitizer flags, fixed by making the payload
per-field `std::atomic`.

**Mental model**

A mutex serialises readers against the writer (and, plain, against each other). An `RWMutex` lets
readers run together but the writer still takes an exclusive lock and readers do atomic bookkeeping.
A seqlock lets readers run **wait-free and write-free**: they take no lock and mutate no shared
state. The trick is a sequence counter the writer bumps to an **odd** value before touching the
payload and back to **even** after. A reader snapshots the counter, copies the payload, then
re-reads the counter — if it changed or was odd, a publish overlapped and the reader simply retries.
Readers never block the writer; the writer never waits for readers. The whole kata lives in one
gap: the sequence check makes the *algorithm* correct, but under the C++ memory model copying the
payload with plain (non-atomic) loads/stores is a **data race** — concurrent non-atomic access to
the same object, i.e. UB — even though the retry loop throws away every torn value. TSan flags it.
The fix that keeps the seqlock intact is to store each payload field as a `std::atomic` accessed
`memory_order_relaxed`: identical codegen on x86/ARM, but race-free by definition.

**Key terms**

- **seqlock** — a lock-free reader / single-writer primitive built on a sequence counter, no reader
  lock and no reader writes; readers retry instead of blocking.
- **odd/even sequence** — the counter is even when idle, odd while a write is in flight. A reader
  that sees odd, or a value that changes across its read, retries.
- **single writer / many readers** — the invariant the protocol depends on. Two writers would both
  drive the odd/even counter and corrupt it; serialise writers with a mutex if you have many.
- **acquire/release fences** — `std::atomic_thread_fence(release)` on the writer orders the payload
  stores *between* the odd and even transitions; `acquire` on the reader means seeing the even
  counter also means seeing the payload.
- **per-field `std::atomic` relaxed payload** — each `Quote` field is a `std::atomic<...>` loaded
  and stored with `memory_order_relaxed`: race-free, same cost as plain access, no ordering of its
  own (the sequence supplies that).
- **torn read** — a returned quote whose fields came from two different publishes (new bid, stale
  ask). The sequence re-check rejects exactly these.
- **why plain payload is UB / TSan-flagged** — the textbook seqlock races on the payload; the C++
  memory model calls that undefined behaviour regardless of the retry. Relaxed atomics make it
  defined (Boehm & Adve).
- **wait-free reads** — a reader completes in a bounded number of its own steps regardless of other
  readers; it may spin only while a publish is *actually* in flight, never on another reader.

**Why interviewers ask this**

It separates people who reach for a mutex from people who can reason about a lock-free read path and
the C++ memory model underneath it. A junior copies a seqlock off a blog, sees it pass a stress
test, and ships a data race. A senior can state the protocol precisely (odd → write → even, reader
snapshots-copies-rechecks), place the two fences and justify each, and — the real tell — know that
the plain-payload version is UB *even though it never returns a torn value*, cite that TSan catches
it, and fix it with relaxed per-field atomics without breaking the algorithm. It is also a clean
lens on wait-free vs lock-free, on the seqlock-vs-double-buffer tradeoff, and on the money stakes: a
torn quote makes a strategy cross its own book or act on a price that never existed — real fills,
real P&L.

**Common confusions**

- *"The sequence check rejects torn reads, so plain payload copies are fine."* — Correctness of the
  *value* and definedness of the *program* are different things. A race on the payload is UB by the
  memory model no matter what the retry loop does; TSan flags it.
- *"Relaxed atomics are slower than plain loads."* — On x86/ARM a relaxed load/store is the same
  instruction as a plain one. You pay nothing for definedness here.
- *"Relaxed per-field atomics give me a consistent quote."* — No. Relaxed gives each field
  atomicity but no *group* consistency; a reader could get `bid` from publish N and `ask` from N+1.
  The sequence counter is what supplies group consistency.
- *"Seqlocks support multiple writers."* — Not as written. Two writers race the odd/even counter.
  One writer only, or a mutex among writers.

**What follows from this topic**

This is the anchor for `std::atomic`, `memory_order`, and `atomic_thread_fence` everywhere else —
and the gateway to the harder wait-free structures (SPSC ring buffers, double-buffering, RCU). The
extension — a **double-buffer** publisher (two `Quote` slots + an atomic active-index the writer
flips) — gives wait-free reads with *no reader retries* at the cost of a second payload copy, and
benchmarking it against the seqlock leads straight into cache-footprint and contention engineering.

### Clarify & design the API

Clarifying questions worth asking out loud: is there exactly one writer (yes — the market-data
thread; that's what makes the odd/even protocol safe)? Does a torn read actually matter (yes — the
whole point; a new bid with a stale ask is a bad price)? Must reads be non-blocking (yes — readers
take no lock and mutate no shared state; they may spin only while a publish is genuinely in flight)?
What's the zero state (a well-formed empty quote, sequence 0)?

The **design decision** is the synchronisation. Reads dominate and there's a single writer, so a
seqlock is the natural fit: wait-free, write-free readers. `Quote` is a provided value type; the
non-obvious call is that its fields live inside `TopOfBook` as **per-field atomics**, not a plain
struct.

```cpp
// Quote is an immutable snapshot of a symbol's two-sided top of book. seq is the publisher's
// monotonic update number; it lets a reader (and the tests) assert every field came from one publish.
struct Quote {
    double bid_px{};
    std::uint32_t bid_qty{};
    double ask_px{};
    std::uint32_t ask_qty{};
    std::uint64_t seq{};
    bool operator==(const Quote&) const = default;
};

// Safe for ONE writer calling publish() and ANY number of readers calling read().
class TopOfBook {
public:
    TopOfBook() = default;
    TopOfBook(const TopOfBook&) = delete;            // a synchronising object is not copyable
    TopOfBook& operator=(const TopOfBook&) = delete;

    void publish(const Quote& q) noexcept;           // single writer only
    Quote read() const noexcept;                     // wait-free wrt other readers
    std::uint64_t sequence() const noexcept;         // current counter, for diagnostics/tests
};
```

The seqlock protocol in one breath: the writer takes the even counter, stores it `+1` (odd, "write
in progress"), writes the payload, then stores it `+2` (even, "done") — so each publish advances the
counter by exactly 2. A reader loads the counter (retry if odd), copies the payload, re-loads the
counter, and returns only if it's unchanged. Say the *why the payload is atomic* out loud: a plain
copy is a data race under the memory model even though the retry rejects torn values — relaxed
per-field atomics make it defined at zero cost, and the sequence still supplies the group
consistency that relaxed atomics alone don't.

### Write the tests

The README ships **no tests** — writing them is the exercise. Use the hand-rolled header harness
(`KATA_TEST` / `EXPECT_*` / `KATA_MAIN`), *not* GoogleTest. Start with the contract (empty,
round-trip, overwrite, sequence steps by 2), then the concurrency stress test — the only thing that
can catch a torn read — released together by a `kata::StartGate` (a `std::latch` wrapper) and
verified under ThreadSanitizer (the `-race` analogue).

```cpp
#include "harness.hpp"
#include "top_of_book.hpp"

using katas::Quote;
using katas::TopOfBook;

KATA_TEST(initial_read_is_empty) {
    TopOfBook tob;
    EXPECT_EQ(tob.read(), Quote{});        // zero state is a well-formed empty quote
    EXPECT_EQ(tob.sequence(), 0u);
}

KATA_TEST(publish_then_read_round_trips) {
    TopOfBook tob;
    Quote q{1.95, 100, 2.05, 80, 1};
    tob.publish(q);
    EXPECT_EQ(tob.read(), q);
}

KATA_TEST(publish_overwrites) {
    TopOfBook tob;
    tob.publish(Quote{1.95, 100, 2.05, 80, 1});
    Quote q2{1.96, 120, 2.04, 90, 2};
    tob.publish(q2);
    EXPECT_EQ(tob.read(), q2);             // read returns the latest, not the first
}

KATA_TEST(sequence_advances_by_two_per_publish) {
    TopOfBook tob;
    EXPECT_EQ(tob.sequence(), 0u);
    tob.publish(Quote{1.0, 1, 2.0, 1, 1});
    EXPECT_EQ(tob.sequence(), 2u);         // even -> odd -> even
    tob.publish(Quote{1.0, 1, 2.0, 1, 2});
    EXPECT_EQ(tob.sequence(), 4u);
}
```

The stress test is the one that matters. One writer publishes **self-consistent** quotes — every
field derived from a single counter `v` — and many readers spin on `read()` asserting the quote is
internally consistent. A torn read (fields from different publishes) breaks the relation and is
caught *even without* the sanitizer; TSan additionally proves the accesses are race-free. All
workers are released together by the `StartGate` to maximise overlap — no `sleep`s.

```cpp
namespace {
// encode builds a Quote whose fields all derive from one v, so a reader can verify single-publish origin.
Quote encode(std::uint64_t v) {
    return Quote{static_cast<double>(v), static_cast<std::uint32_t>(v),
                 static_cast<double>(v) + 0.5, static_cast<std::uint32_t>(v) + 1u, v};
}
bool consistent(const Quote& q) {
    return q.bid_px == static_cast<double>(q.seq) &&
           q.ask_px == static_cast<double>(q.seq) + 0.5 &&
           q.bid_qty == static_cast<std::uint32_t>(q.seq) &&
           q.ask_qty == static_cast<std::uint32_t>(q.seq) + 1u;
}
} // namespace

KATA_TEST(seqlock_no_torn_reads_under_contention) {
    TopOfBook tob;
    tob.publish(encode(0));
    constexpr int kReaders = 8;
    constexpr std::uint64_t kWrites = 200000;

    kata::StartGate gate;                            // std::latch under the hood
    std::atomic<bool> torn{false};

    std::vector<std::jthread> readers;
    readers.reserve(kReaders);
    for (int r = 0; r < kReaders; ++r) {
        readers.emplace_back([&] {
            gate.wait();
            while (tob.sequence() < kWrites * 2) {
                if (!consistent(tob.read())) { torn.store(true, std::memory_order_relaxed); return; }
            }
        });
    }
    std::jthread writer([&] {
        gate.wait();
        for (std::uint64_t v = 1; v <= kWrites; ++v) tob.publish(encode(v));
    });

    gate.open();                                     // release everyone at once
    writer.join();
    readers.clear();                                 // join all readers (jthread)

    EXPECT_FALSE(torn.load(std::memory_order_relaxed));
    EXPECT_TRUE(consistent(tob.read()));
    EXPECT_EQ(tob.read().seq, kWrites);
}

KATA_MAIN()
```

Run under ThreadSanitizer — the `-race` analogue and the whole point of the atomic-payload story:
`cmake -B build-tsan -DKATAS_SANITIZE=thread && cmake --build build-tsan && ctest --test-dir
build-tsan -R top_of_book`. A plain-payload implementation *passes the value assertions* but TSan
reports a write/read data race on the payload — that's the bug the atomics fix.

### Implement it

The writer drives the counter odd → write → even with a release fence on each side; the reader
snapshots the counter (retry if odd), relaxed-loads the fields, acquire-fences, and re-reads the
counter, returning only on a match.

```cpp
class TopOfBook {
public:
    void publish(const Quote& q) noexcept {
        const std::uint64_t s = seq_.load(std::memory_order_relaxed);
        seq_.store(s + 1, std::memory_order_relaxed);          // enter write: odd
        std::atomic_thread_fence(std::memory_order_release);   // payload stores land AFTER the odd

        bid_px_.store(q.bid_px, std::memory_order_relaxed);
        bid_qty_.store(q.bid_qty, std::memory_order_relaxed);
        ask_px_.store(q.ask_px, std::memory_order_relaxed);
        ask_qty_.store(q.ask_qty, std::memory_order_relaxed);
        qseq_.store(q.seq, std::memory_order_relaxed);

        std::atomic_thread_fence(std::memory_order_release);   // payload stores land BEFORE the even
        seq_.store(s + 2, std::memory_order_relaxed);          // exit write: even
    }

    Quote read() const noexcept {
        Quote out;
        for (;;) {
            const std::uint64_t before = seq_.load(std::memory_order_acquire);
            if (before & 1u) continue;                         // write in progress: wait it out

            out.bid_px = bid_px_.load(std::memory_order_relaxed);
            out.bid_qty = bid_qty_.load(std::memory_order_relaxed);
            out.ask_px = ask_px_.load(std::memory_order_relaxed);
            out.ask_qty = ask_qty_.load(std::memory_order_relaxed);
            out.seq = qseq_.load(std::memory_order_relaxed);

            std::atomic_thread_fence(std::memory_order_acquire);
            if (before == seq_.load(std::memory_order_relaxed)) return out; // no write overlapped
        }
    }

    std::uint64_t sequence() const noexcept { return seq_.load(std::memory_order_relaxed); }

private:
    std::atomic<std::uint64_t> seq_{0};
    std::atomic<double>        bid_px_{0.0};
    std::atomic<std::uint32_t> bid_qty_{0};
    std::atomic<double>        ask_px_{0.0};
    std::atomic<std::uint32_t> ask_qty_{0};
    std::atomic<std::uint64_t> qseq_{0};
};
```

The gotcha is the payload representation, and it's the whole senior tell. A textbook seqlock copies
the payload with **plain** `double`/`uint` loads and stores and leans entirely on the sequence check
for correctness. That is a **data race** under the C++ memory model — concurrent non-atomic access
to the same object — i.e. undefined behaviour, *even though the retry loop discards every torn
value*. Boehm & Adve's *Can Seqlocks Get Along With Programming Language Memory Models?* is the
canonical write-up of exactly this gap, and ThreadSanitizer flags it in practice. The fix that keeps
the algorithm intact and costs nothing on x86/ARM: store each field as a `std::atomic` accessed
`memory_order_relaxed`. Relaxed makes each access race-free by definition but imposes no ordering of
its own — so the **sequence counter still does the real work of group consistency** (without it a
reader could relaxed-load `bid` from publish N and `ask` from N+1). The two release fences pin the
payload stores strictly between the odd and even transitions; the reader's acquire fence pairs with
them so that seeing the even counter implies seeing the payload. And it is **single writer only** —
two threads driving the odd/even counter corrupt it; serialise writers with a mutex (readers stay
lock-free) if you must have many.

### Common mistakes & senior signal

- **Plain (non-atomic) payload copies.** The textbook seqlock; passes every value assertion, still
  UB, still TSan-flagged. **Senior signal** — knows a race on the payload is undefined by the memory
  model *regardless* of the retry loop, cites Boehm & Adve, and fixes it with relaxed per-field
  atomics rather than "it works on my machine."
- **Assuming relaxed atomics give a consistent quote on their own.** Relaxed gives per-field
  atomicity but no group ordering; drop the sequence check and a reader stitches `bid` from N to
  `ask` from N+1. **Senior signal** — separates *atomicity of a field* from *consistency of the
  group*, and names the sequence counter as the thing that supplies the latter.
- **Missing or mis-ordered fences.** Store the payload before the odd transition, or skip the
  reader's acquire fence, and the sequence check passes while the reader still sees stale bytes.
  **Senior signal** — places both release fences to bracket the payload and pairs the reader's
  acquire, then explains the happens-before edge in one sentence.
- **Forgetting the odd-check / single-write retry.** Returning on the first counter read, or not
  rejecting an odd `before`, lets a mid-publish snapshot through. **Senior signal** — reads
  snapshot-copy-recheck and retry only while a write is genuinely in flight, so reads stay wait-free
  wrt other readers.
- **Allowing multiple writers.** Two publishers race the odd/even counter and corrupt it silently.
  **Senior signal** — states the single-writer precondition up front and offers the mutex-among-
  writers escape hatch that keeps readers lock-free.
- **`sleep`-based "stress" tests.** Timing-dependent and prove nothing. **Senior signal** — a
  `StartGate`-gated multi-reader test with a self-consistency invariant (every field derived from
  one counter) that catches torn reads deterministically, run under TSan to prove race-freedom.

Extensions that show depth: implement a **double-buffer** publisher (two `Quote` slots + an atomic
active-index the writer flips) for wait-free reads with *no reader retries*, and benchmark it
against the seqlock under write-heavy load; add a symbol table of `TopOfBook`s; measure reader spin
rates as write frequency climbs.

## Feed Pipe — Lock-Free SPSC Ring (Acquire/Release Hand-Off)

### Summary

**What this topic covers**

You build a market-data feed pipe: a feed-handler thread parses UDP datagrams into `FeedEvent`s in a tight loop and hands each one to the strategy thread, which consumes them and updates its books. Exactly **two** threads meet here — one producer, one consumer — on the latency-critical path, so the hand-off must not lock, must not allocate per event, and must never lose, duplicate, or reorder an event. This is the canonical "wait-free single-producer/single-consumer ring buffer" senior question. The signature C++ topic it drills is the **`std::atomic` memory model**: `memory_order_relaxed`/`acquire`/`release`, the release/acquire *synchronizes-with* edge, and how a correctly-fenced hand-off lets you keep the payload slots as plain, non-atomic `T`.

**Mental model**

A general MPMC queue needs CAS loops and reclamation; with exactly one producer and one consumer you can do far better, and the win comes from *ownership*. The producer owns the write index (`tail_`); the consumer owns the read index (`head_`). Each index has a **single writer**, so it never needs compare-and-swap — a plain atomic load/store with the right ordering is enough. That single-writer-per-index property is what makes both `try_push` and `try_pop` *wait-free*: each runs in a bounded number of steps with no spinning and no lock. The subtle part is the payload. The slots are plain `T`, touched with ordinary (non-atomic) reads and writes — which would be a data race, *except* the two index atomics fence them. The producer writes slot `tail`, then `release`-stores the new tail; the consumer `acquire`-loads tail and, on seeing the new value, is guaranteed to also see the payload written before it. Symmetrically the consumer reads slot `head` then `release`-stores head, and the producer `acquire`-loads head before overwriting. At any instant a given slot has exactly one accessor, and the release/acquire edges order the hand-off — so plain slots are race-free. This is the exact opposite of the seqlock kata, where reader and writer genuinely touch the payload at the same time and the payload therefore *must* be atomic.

**Key terms**

- **single-producer/single-consumer (SPSC)** — exactly one thread pushes, exactly one (other) thread pops; the two run fully concurrently. The precondition that unlocks the whole optimisation.
- **wait-free** — every operation completes in a bounded number of steps regardless of the other thread; stronger than lock-free (no spinning, no retry loop).
- **producer owns tail / consumer owns head** — each index has a single writer, so it needs an atomic store but no CAS.
- **acquire/release hand-off** — the producer's `release` store on `tail_` *synchronizes-with* the consumer's `acquire` load; everything the producer wrote before the store is visible to the consumer after the load.
- **one empty slot = full vs empty** — store `capacity` elements in `capacity + 1` slots; `head == tail` means empty, `tail + 1 == head` means full — no shared size counter.
- **plain `T` slots are safe here (contrast seqlock)** — the release/acquire edges give each slot a single accessor at a time, so the payload need not be atomic; the seqlock's payload must be, because there both sides touch it concurrently.
- **false sharing / cache-line padding** — `head_` and `tail_` on separate cache lines (`alignas(64)`) so the two threads' writes don't ping-pong one line between cores.

**Why interviewers ask this**

It separates people who reach for a `mutex`+`queue` from people who know *why* SPSC is special and can defend a lock-free design at the memory-model level. A junior writes a bounded queue with a lock and calls it done. A senior states precisely why one producer and one consumer means **no CAS is needed** (single writer per index), names the release/acquire edge that makes the plain-`T` slots race-free, explains the one-empty-slot trick that avoids a contended size counter, and pads the two indices onto separate cache lines to kill false sharing — then writes a **gated producer/consumer stress test verified under TSan** that would actually catch a lost, duplicated, or reordered event. It is also a clean lens on the money stakes: a dropped event is a missed fill; a duplicated event is a phantom position.

**Common confusions**

- *"Lock-free needs CAS."* — MPMC does; SPSC does not. Each index has a single writer, so a `release` store is sufficient — CAS would only be needed if two threads could write the same index.
- *"Plain slots are a data race — TSan will scream."* — Not if the release/acquire on the indices order every slot access. TSan is clean because the ordering is real, not assumed.
- *"Use `seq_cst` everywhere to be safe."* — Correct but slower; `relaxed` on the self-owned load plus `acquire`/`release` on the cross-thread edge is the minimal, correct set.
- *"`capacity` slots is enough."* — Then `head == tail` is ambiguous (full or empty?). The extra always-empty slot disambiguates without a size counter both threads would contend on.

**What follows from this topic**

This is the anchor for the whole `std::atomic` memory-ordering family. The natural next step is the **seqlock** (a single-writer/many-reader snapshot where the payload *must* be atomic — the deliberate contrast to this kata), then a bounded **MPMC** queue (Vyukov's: a per-slot sequence number and a CAS on the enqueue/dequeue index) to see exactly what the SPSC specialisation bought you. It also leads into contention engineering (false-sharing measurement, cache-line padding) and into benchmarking a lock-free structure against `std::mutex` + `std::queue`.

### Clarify & design the API

Clarifying questions worth asking out loud: exactly one producer and one consumer (yes — that's the precondition that removes the CAS)? Should the calls block when full/empty, or fail fast (fail fast — `try_push` returns `false`, `try_pop` returns `nullopt`; the caller decides whether to spin)? Is capacity fixed at construction (yes — no allocation on the hot path)? Move-only payloads, or copyable (support both — `try_push(const T&)` and `try_push(T&&)`)?

The **ownership decision** is the design: the producer owns `tail_`, the consumer owns `head_`, and no third party ever writes either. That single-writer-per-index invariant is what lets each index be a plain atomic with a `release` store instead of a CAS loop.

```cpp
template <typename T>
class FeedPipe {
public:
    explicit FeedPipe(std::size_t capacity);          // capacity > 0, else throw
    FeedPipe(const FeedPipe&) = delete;               // a live ring is not copyable
    FeedPipe& operator=(const FeedPipe&) = delete;

    bool try_push(const T& value);                    // producer: false if full, never blocks
    bool try_push(T&& value);                         // producer: move overload
    std::optional<T> try_pop();                       // consumer: nullopt if empty, never blocks

    std::size_t capacity() const noexcept;            // usable elements the ring holds
};
```

Say the tradeoff explicitly: because there is exactly one writer per index, publishing a new position is a single `release` store — no CAS, no retry, so both sides are wait-free. The two indices fence the hand-off: the producer writes the slot *then* `release`-stores `tail_`; the consumer `acquire`-loads `tail_` before reading the slot, so the store *synchronizes-with* the load and the payload write happens-before the payload read. That is the whole reason the slots can be plain `T`.

### Write the tests

The README ships **no tests** — writing them is the exercise. Use the hand-rolled header harness (`KATA_TEST` / `EXPECT_*` / `KATA_MAIN`), not GoogleTest. Cover the contract first (empty pop, FIFO, full, wrap-around), then the concurrency invariant. The stress test is the one that matters: a `StartGate` (a `std::latch`) releases producer and consumer together to maximise contention, and the consumer asserts a **strictly increasing seq** so a lost, duplicated, or reordered event fails the assert. Run it under ThreadSanitizer (the `-race` analogue) to prove the plain-slot accesses are race-free.

```cpp
#include "harness.hpp"
#include "feed_pipe.hpp"

#include <cstdint>
#include <thread>

using katas::FeedEvent;
using katas::FeedPipe;

KATA_TEST(pop_empty_returns_nullopt) {
    FeedPipe<int> p(4);
    EXPECT_FALSE(p.try_pop().has_value());          // empty ring
}

KATA_TEST(push_then_pop_is_fifo) {
    FeedPipe<int> p(4);
    EXPECT_TRUE(p.try_push(1));
    EXPECT_TRUE(p.try_push(2));
    EXPECT_EQ(p.try_pop().value(), 1);              // first in, first out
    EXPECT_EQ(p.try_pop().value(), 2);
}

KATA_TEST(push_fails_when_full) {
    FeedPipe<int> p(3);                             // 3 usable, 4 slots
    EXPECT_TRUE(p.try_push(10));
    EXPECT_TRUE(p.try_push(20));
    EXPECT_TRUE(p.try_push(30));
    EXPECT_FALSE(p.try_push(40));                   // full: tail + 1 == head
    EXPECT_EQ(p.try_pop().value(), 10);
    EXPECT_TRUE(p.try_push(40));                    // a slot freed up
}

KATA_TEST(wraps_around_repeatedly) {
    FeedPipe<int> p(2);
    for (int round = 0; round < 100; ++round) {     // indices wrap past slots_.size()
        EXPECT_TRUE(p.try_push(round));
        EXPECT_TRUE(p.try_push(round + 1000));
        EXPECT_FALSE(p.try_push(-1));               // full
        EXPECT_EQ(p.try_pop().value(), round);
        EXPECT_EQ(p.try_pop().value(), round + 1000);
    }
}

// The catcher. One producer pushes seq 0..N with strictly increasing seq; one
// consumer pops them all and asserts each seq arrives exactly once, in order.
// A StartGate (std::latch) releases both threads together for maximum contention.
// TSan proves the plain-slot accesses are race-free; the seq invariant catches
// lost / duplicated / reordered events even without the sanitizer.
KATA_TEST(spsc_no_lost_or_duplicated_events) {
    constexpr std::uint64_t kEvents = 1000000;
    FeedPipe<FeedEvent> pipe(1024);

    kata::StartGate gate;
    std::atomic<bool> ok{true};
    std::uint64_t received = 0;

    std::jthread consumer([&] {
        gate.wait();
        std::uint64_t expected = 0;
        while (expected < kEvents) {
            auto ev = pipe.try_pop();
            if (!ev) continue;                      // momentarily empty; spin
            if (ev->seq != expected) {              // out-of-order / lost / dup
                ok.store(false, std::memory_order_relaxed);
                return;
            }
            ++expected;
            ++received;
        }
    });

    std::jthread producer([&] {
        gate.wait();
        for (std::uint64_t s = 0; s < kEvents; ++s) {
            FeedEvent ev{s, static_cast<std::uint32_t>(s & 0xFFFF), static_cast<double>(s)};
            while (!pipe.try_push(ev)) { /* full; spin until consumer drains */ }
        }
    });

    gate.open();                                    // both threads race from here
    producer.join();
    consumer.join();

    EXPECT_TRUE(ok.load(std::memory_order_relaxed));
    EXPECT_EQ(received, kEvents);
    EXPECT_FALSE(pipe.try_pop().has_value());       // fully drained
}

KATA_MAIN()
```

Build with ThreadSanitizer and run: `cmake -B build-tsan -DKATAS_SANITIZE=thread && cmake --build build-tsan && ctest --test-dir build-tsan -R feed_pipe`. The `StartGate` (a `std::latch`) is what makes the stress deterministic — both threads block on `gate.wait()` and are released together by `gate.open()`, so they overlap from the first instruction rather than one finishing before the other starts. No `sleep`s: the consumer spins on empty, the producer spins on full, and the join is what lets you assert after both finish.

### Implement it

The ring stores `capacity` usable elements in `capacity + 1` slots (the always-empty slot distinguishes full from empty). Each op loads its *own* index `relaxed`, checks the other index with `acquire`, touches the plain slot, then publishes its own index with a `release` store. `head_` and `tail_` sit on separate cache lines via `alignas`.

```cpp
template <typename T>
class FeedPipe {
public:
    explicit FeedPipe(std::size_t capacity)
        : capacity_(capacity), slots_(capacity + 1) {
        if (capacity == 0) throw std::invalid_argument("FeedPipe capacity must be > 0");
    }

    std::optional<T> try_pop() {
        const std::size_t head = head_.load(std::memory_order_relaxed);        // I own head
        if (head == tail_.load(std::memory_order_acquire)) return std::nullopt; // empty
        T value = std::move(slots_[head]);                                     // plain read
        head_.store(next(head), std::memory_order_release);                    // publish
        return value;
    }

    std::size_t capacity() const noexcept { return capacity_; }

private:
    template <typename U>
    bool emplace(U&& value) {
        const std::size_t tail = tail_.load(std::memory_order_relaxed);        // I own tail
        const std::size_t nxt = next(tail);
        if (nxt == head_.load(std::memory_order_acquire)) return false;        // full
        slots_[tail] = std::forward<U>(value);                                 // plain write
        tail_.store(nxt, std::memory_order_release);                           // publish
        return true;
    }

    std::size_t next(std::size_t i) const noexcept {
        return i + 1 == slots_.size() ? 0 : i + 1;                             // wrap
    }

    static constexpr std::size_t kCacheLine = 64;
    std::size_t capacity_;
    std::vector<T> slots_;
    alignas(kCacheLine) std::atomic<std::size_t> head_{0};                     // separate lines:
    alignas(kCacheLine) std::atomic<std::size_t> tail_{0};                     // no false sharing
};
```

The gotcha is the memory ordering, and it is the whole point. The producer writes `slots_[tail]` **before** the `release`-store of `tail_`; the consumer `acquire`-loads `tail_` **before** reading `slots_[head]`. That release/acquire pair *synchronizes-with*: when the consumer sees the new tail, the standard guarantees it also sees the payload the producer wrote first, so the plain (non-atomic) slot read is ordered *after* the write by happens-before — no data race. Symmetrically, the consumer publishes `head_` with a `release` store and the producer `acquire`-loads it before overwriting, so the producer never clobbers a slot the consumer is still reading. Each slot therefore has a **single accessor at a time** — the exact opposite of the seqlock, whose reader and writer touch the payload concurrently and whose payload must therefore be atomic. Two more details: the load of your *own* index is `relaxed` (no other thread writes it, so there is nothing to synchronise with); and the extra empty slot means `nxt == head` uniquely signals full while `head == tail` signals empty, with no shared size counter for the two threads to contend on. Finally, `alignas(64)` on `head_` and `tail_` puts them on separate cache lines — without it, the producer's store to `tail_` and the consumer's store to `head_` would dirty the same line and bounce it between cores on every op, destroying the throughput the structure exists to provide.

### Common mistakes & senior signal

The headline trap: **reaching for a CAS loop or a `mutex` because "lock-free is hard."** SPSC needs neither — one writer per index means a `release` store is enough. Name that unprompted.

- **Reflexive `seq_cst` on every access.** Works, but a full barrier where `relaxed` + `acquire`/`release` suffices costs throughput on the hot path. **Senior signal** — using the *minimal* ordering (relaxed self-load, acquire cross-load, release publish) and being able to justify each one.
- **Making the slots `std::atomic<T>`.** Unnecessary here: the index release/acquire already orders the plain slot access, and atomic slots add cost for nothing. **Senior signal** — explaining that a single accessor per slot at any instant is what makes plain `T` race-free, and contrasting it with the seqlock where the payload genuinely must be atomic.
- **Sizing the buffer to `capacity` and using a separate size counter.** A shared counter both threads increment/decrement re-introduces contention and a CAS. **Senior signal** — the one-empty-slot trick: `capacity + 1` slots, full is `tail + 1 == head`, empty is `head == tail`, no shared counter.
- **Packing `head_` and `tail_` adjacently.** They land on one cache line and ping-pong between the producer and consumer cores. **Senior signal** — `alignas(64)` (or `std::hardware_destructive_interference_size`) to give each index its own line, and being able to *measure* the false-sharing regression.
- **`sleep`-based "stress" tests.** Timing-dependent, prove nothing, and often let the producer finish before the consumer starts. **Senior signal** — a `StartGate` (`std::latch`)-gated producer/consumer run asserting strictly-increasing seq, verified under TSan, that deterministically overlaps the two threads and catches lost/duplicated/reordered events.

Extensions that show depth: generalise to a bounded **MPMC** queue (Vyukov's per-slot sequence number + CAS) and measure what the SPSC specialisation bought you; add a batched `try_push_n`/`try_pop_n` to amortise the release/acquire per element; and benchmark the whole thing against `std::mutex` + `std::queue` to put a number on the lock-free win.

## Feed Parser — Streaming, Zero-Copy & Malformed-Line Handling

### Summary

**What this topic covers**

You build the front door of the whole trading system: the thing that turns a raw text feed into typed quotes the book can consume. The feed is one record per line — `SYMBOL|BID|ASK|QTY` — arriving off a socket or replayed from a multi-gigabyte capture file, millions of lines a second. The hard requirement is that a *single* malformed line — a truncated packet, a vendor bug, a stray comment, a negative quantity — must **not** throw, must not allocate wildly, and must never abort the stream: it is reported with its line number and skipped, and the good lines keep flowing. This drills the signature C++ text-processing idiom: **`std::string_view` for zero-copy field slicing** and **`std::from_chars` for allocation-free, non-throwing, locale-independent number parsing** — the tools that replace the reflexive-but-wrong `stringstream`/`stod` pipeline. It is the exact technique to reach for the moment someone hands you a delimited feed to parse fast.

**Mental model**

The naive parse — `getline` into a string, then `std::stringstream` / `std::stod` per field — is wrong three separate ways, and naming all three *is* the kata. `stod` **throws** (`std::invalid_argument` / `out_of_range`) on bad input, so one malformed field aborts the stream unless every call is wrapped in try/catch, and exceptions on the ingest hot path are exactly what a feed handler exists to avoid. `stringstream` **allocates** and is **locale-sensitive** — under a comma-decimal locale it silently misparses `1.95` and mis-marks the book. And splitting into `std::string` fields **copies** bytes you already hold in the line buffer. The right model is: slice the trimmed line into field *views* (`std::string_view`) that point into the buffer without copying, then parse each view with `std::from_chars`, which never allocates, never throws (it hands back a `std::errc` and a past-the-end pointer), and is locale-independent by construction. The one unavoidable copy is the symbol into `Quote::symbol` — because the getline buffer is *reused* across lines, so every view into it dangles the instant the next line is read. That lifetime caveat is the trap the whole design turns on.

**Key terms**

- **`std::string_view`** — a non-owning `{ptr, len}` window into existing bytes; slicing and trimming it copies nothing, it just narrows the window.
- **`std::from_chars`** — the C++17 low-level parse: `(first, last, out) -> {ptr, ec}`, no allocation, no throw, no locale; valid only if `ec == std::errc{}` **and** `ptr == last` (whole field consumed).
- **whole-field validation** — a field is a number only if `from_chars` reached the field's end; `1.0x` leaves `ptr` short, so it is *rejected*, not silently truncated to `1.0`.
- **unsigned rejects the sign** — `from_chars` into a `std::uint64_t` refuses a leading `-` (`errc::invalid_argument`), so `-5 -> InvalidQty` falls out for free — no special case.
- **physical line number** — 1-based, incremented for *every* `getline`, including blank/comment lines that are skipped; it tracks the file, not the record index.
- **fixed validation order** — count -> empty-symbol -> bid -> ask -> qty, stopping at the first failure, so each bad line yields exactly one error.
- **the lifetime caveat** — the reused getline buffer means field views dangle after the next read; anything outliving the line (the symbol) must be **copied** into an owning `std::string`.
- **streaming vs collecting** — `parse_feed` invokes a callback per line (constant memory over any feed size); `parse_all` is a thin collector into a `ParseResult`.

**Why interviewers ask this**

Text parsing is where junior and senior C++ diverge most visibly, because the junior tool (`stringstream`/`stod`) *works on the happy path* and hides three defects that only bite in production: it throws on the first bad line, it allocates per field, and it silently reads the wrong number under a foreign locale. A senior reaches for `string_view` + `from_chars` unprompted, and — the real tell — validates the *whole* field (`ptr == last`) rather than trusting `from_chars` to have consumed everything, knows that an unsigned parse rejects the sign for free, and can state the `string_view` lifetime contract precisely: which views dangle, when, and therefore what must be copied. It is also a clean lens on money stakes: a throwing parser lets one corrupt packet freeze the whole book so every strategy trades on stale prices; a locale-sensitive parse mis-marks a price; and line-numbered errors are what let ops pinpoint the offending record in a gigabyte replay.

**Common confusions**

- *"`stod`/`stringstream` is the normal way to parse."* — On a hot feed path it throws, allocates, and is locale-sensitive. `from_chars` does none of those; it is the right default for delimited numeric text.
- *"If `from_chars` returns no error, the field is valid."* — Not enough. `from_chars("1.0x")` parses `1.0` with *no* error and leaves `ptr` before the `x`. You must also check `ptr == last`, or garbage-suffixed fields slip through.
- *"I'll special-case negative quantities."* — No need. Parse into an unsigned type and `from_chars` rejects the `-` itself; the special case is a bug waiting to disagree with the rule.
- *"A `string_view` field is fine to store in the `Quote`."* — It dangles the moment the next `getline` overwrites the buffer — a use-after-free, the same class of bug as returning a pointer to a local. The symbol must be copied.
- *"Blank and comment lines don't count."* — They are skipped as records but still advance the physical line counter, or every error line number in a file with comments is wrong.

**What follows from this topic**

This is the anchor for every "parse a delimited/binary feed fast" problem you'll meet: the natural extension drops the per-line `getline` copy entirely for a hand-written state machine over a buffered byte stream (what the very hottest handlers use), and a `parse_view(std::string_view whole_feed, ...)` overload that hands back `Quote`s holding `string_view` symbols into the *caller's* buffer — forcing the lifetime contract into the API surface rather than hiding it behind a copy. From there: a strict/lenient mode (lenient clamps a negative qty to 0 instead of erroring), and, on the concurrency side, feeding parsed quotes into the SPSC ring (`feed_pipe`) so the parse thread and the book thread hand off under TSan. The `from_chars` / `string_view` discipline here is the precondition for all of it.

### Clarify & design the API

Clarifying questions worth asking out loud: is the parse streaming or does it materialise the whole feed (streaming — a callback per line, constant memory over a replay of any size; `parse_all` is a convenience collector on top)? What is a "record" versus a line — do blank/comment lines count toward the line number (yes — line numbers are *physical* and 1-based, so ops can find the record in the raw file)? When a field is malformed, do we throw, skip-silently, or report-and-continue (report with a line number and continue — the feed must not stall)? Is validation short-circuit or all-fields (short-circuit in a fixed order, so each bad line yields exactly one error)? And the load-bearing one: what is the lifetime of a parsed field (a `string_view` into a *reused* buffer, valid only while that one line is being parsed — so anything stored must be copied).

The **lifetime and no-throw decisions are the design.** Because the getline buffer is recycled, fields are views for the duration of one line only, and the symbol — which must outlive the line inside a `Quote` — is copied into an owning `std::string`. Because the path must not throw, every field parse routes through `from_chars` (via two tiny `noexcept` helpers) instead of `stod`. The fixture types are provided verbatim in both trees; you design the splitting and the number parsing.

```cpp
namespace katas {

// Which field was malformed — one error per bad line, at the first failure in the fixed order.
enum class ErrorKind { WrongFieldCount, EmptySymbol, InvalidBid, InvalidAsk, InvalidQty };

// A parsed quote. `symbol` OWNS its bytes (copied out of the recycled line buffer — which is exactly
// why it is a std::string and not a string_view). Provided verbatim in both trees.
struct Quote {
    std::string symbol;
    double bid{};
    double ask{};
    std::uint64_t qty{};
    bool operator==(const Quote&) const = default;   // so EXPECT_EQ compares whole quotes
};

// A malformed line: which failure, at which 1-based physical line number. Provided verbatim.
struct ParseError {
    std::size_t line{};
    ErrorKind kind{};
    bool operator==(const ParseError&) const = default;
};

struct ParseResult {                    // the collected outcome of parse_all
    std::vector<Quote> quotes;
    std::vector<ParseError> errors;
};

// Streaming: one callback per non-skipped line, with the 1-based physical line number. Never throws
// on malformed input; only the symbol is copied.
void parse_feed(std::istream& in,
                const std::function<void(std::size_t line, const Quote&)>& on_quote,
                const std::function<void(const ParseError&)>& on_error);

ParseResult parse_all(std::istream& in);   // collector built on parse_feed

} // namespace katas
```

Say the tradeoff explicitly: `std::regex` would compile and read cleanly, but it allocates, is slow, and is throw-happy — the opposite of what this path needs. A generated parser (Ragel, or a hand-written byte-stream state machine) is *faster* still and avoids even the per-line getline copy — the extension. This kata is the `string_view` + `from_chars` middle ground: allocation-free field parsing, no exceptions, ~20 lines. Volunteering *why* it beats both extremes is the senior signal.

### Write the tests

The `practice/` tree ships **no tests** — writing them is the exercise. This module uses a hand-rolled header harness (`KATA_TEST` / `EXPECT_*` / `KATA_MAIN`), **not** GoogleTest; include `../../solution/common/harness.hpp` and drive the parser with a `std::istringstream`. The keystone is a single **canonical feed** whose exact quotes-and-errors output is the contract shared across every language port; pin that first, then cover each validation branch in isolation, the whitespace/edge cases, and — the two that catch the subtle bugs — physical line numbers counting skipped lines, and the streaming callback line numbers.

```cpp
#include "harness.hpp"
#include "feed_parser.hpp"

#include <sstream>
#include <string>
#include <vector>

using katas::ErrorKind;
using katas::ParseError;
using katas::ParseResult;
using katas::Quote;
using katas::parse_all;
using katas::parse_feed;

namespace {
// The canonical sample feed shared by all language ports — its output IS the contract.
const char* kCanonicalFeed =
    "# market data feed\n"
    "LIV-MUN|1.95|2.05|1000\n"
    "\n"
    "ARS-CHE|1.50|1.60|500\n"
    "|1.0|2.0|10\n"          // empty symbol   -> line 5
    "BAD|x|2.0|10\n"         // bid not a float -> line 6
    "TOO|1.0|2.0\n"          // 3 fields        -> line 7
    "NEG|1.0|2.0|-5\n";      // negative qty    -> line 8

ParseResult parse_str(const std::string& feed) {
    std::istringstream in(feed);
    return parse_all(in);
}
} // namespace

KATA_TEST(canonical_feed_yields_exact_quotes_and_errors) {
    ParseResult r = parse_str(kCanonicalFeed);
    std::vector<Quote> expected_quotes{
        Quote{"LIV-MUN", 1.95, 2.05, 1000},
        Quote{"ARS-CHE", 1.50, 1.60, 500},
    };
    EXPECT_EQ(r.quotes, expected_quotes);
    std::vector<ParseError> expected_errors{
        ParseError{5, ErrorKind::EmptySymbol},
        ParseError{6, ErrorKind::InvalidBid},
        ParseError{7, ErrorKind::WrongFieldCount},
        ParseError{8, ErrorKind::InvalidQty},
    };
    EXPECT_EQ(r.errors, expected_errors);         // line numbers count the comment + blank
}

KATA_TEST(comment_and_blank_only_yields_nothing) {
    ParseResult r = parse_str("# header\n\n   \n#another\n\t\n");
    EXPECT_TRUE(r.quotes.empty());
    EXPECT_TRUE(r.errors.empty());                // skipped, not errors
}

KATA_TEST(final_line_without_trailing_newline_is_parsed) {
    ParseResult r = parse_str("LIV-MUN|1.95|2.05|1000");   // getline still yields the last line
    std::vector<Quote> expected{Quote{"LIV-MUN", 1.95, 2.05, 1000}};
    EXPECT_EQ(r.quotes, expected);
}

KATA_TEST(negative_qty_is_invalid) {              // unsigned from_chars rejects the '-' for free
    ParseResult r = parse_str("NEG|1.0|2.0|-5\n");
    std::vector<ParseError> expected{ParseError{1, ErrorKind::InvalidQty}};
    EXPECT_EQ(r.errors, expected);
}

KATA_TEST(non_integer_qty_is_invalid) {           // "1.5" leaves ptr short of end -> rejected
    ParseResult r = parse_str("FRC|1.0|2.0|1.5\n");
    std::vector<ParseError> expected{ParseError{1, ErrorKind::InvalidQty}};
    EXPECT_EQ(r.errors, expected);
}

KATA_TEST(validation_order_stops_at_first_failure) {
    ParseResult r = parse_str("|x|y|-1\n");        // every field bad; empty-symbol wins
    std::vector<ParseError> expected{ParseError{1, ErrorKind::EmptySymbol}};
    EXPECT_EQ(r.errors, expected);
}

KATA_TEST(surrounding_whitespace_is_trimmed) {
    ParseResult r = parse_str("  LIV-MUN | 1.95 | 2.05 | 1000  \n");
    std::vector<Quote> expected{Quote{"LIV-MUN", 1.95, 2.05, 1000}};
    EXPECT_EQ(r.quotes, expected);
}

KATA_TEST(physical_line_numbers_count_skipped_lines) {
    ParseResult r = parse_str("# a\n# b\n\nTOO|1.0|2.0\n");   // bad record is physical line 4
    std::vector<ParseError> expected{ParseError{4, ErrorKind::WrongFieldCount}};
    EXPECT_EQ(r.errors, expected);
}

KATA_TEST(parse_feed_reports_line_numbers_to_callbacks) {
    std::istringstream in(kCanonicalFeed);
    std::vector<std::size_t> quote_lines, error_lines;
    parse_feed(in,
        [&](std::size_t line, const Quote&) { quote_lines.push_back(line); },
        [&](const ParseError& e) { error_lines.push_back(e.line); });
    EXPECT_EQ(quote_lines, (std::vector<std::size_t>{2, 4}));
    EXPECT_EQ(error_lines, (std::vector<std::size_t>{5, 6, 7, 8}));
}

KATA_MAIN()
```

The load-bearing tests are `physical_line_numbers_count_skipped_lines` (fails the instant you increment the counter only on records, not on every line), `non_integer_qty_is_invalid` (fails if you forgot the `ptr == last` whole-field check — `from_chars` happily parses the `1` of `1.5`), and `negative_qty_is_invalid` (proves the unsigned parse, not a hand-rolled sign check). `KATA_MAIN()` expands to a `main` that runs every registered `KATA_TEST`.

### Implement it

`parse_feed` reads into **one** reused `buffer` and, per line, trims to a `string_view`, splits on `|` into up to five field views (four valid + one overflow sentinel so `n != 4` catches "too many"), then runs the fixed validation order through two `noexcept` `from_chars` helpers. The symbol is copied into the `Quote` at the very end — the only allocation on the good path.

```cpp
namespace detail {
// Valid only if the WHOLE view is a number: no error AND ptr reached the end (rejects "1.0x").
inline bool parse_double(std::string_view s, double& out) noexcept {
    if (s.empty()) return false;
    auto [ptr, ec] = std::from_chars(s.data(), s.data() + s.size(), out);
    return ec == std::errc{} && ptr == s.data() + s.size();
}
// Unsigned: from_chars rejects a leading '-' itself, which IS the "no negative qty" rule.
inline bool parse_u64(std::string_view s, std::uint64_t& out) noexcept {
    if (s.empty()) return false;
    auto [ptr, ec] = std::from_chars(s.data(), s.data() + s.size(), out);
    return ec == std::errc{} && ptr == s.data() + s.size();
}
} // namespace detail

inline void parse_feed(std::istream& in,
                       const std::function<void(std::size_t, const Quote&)>& on_quote,
                       const std::function<void(const ParseError&)>& on_error) {
    std::string buffer;
    std::size_t line_no = 0;

    while (std::getline(in, buffer)) {
        ++line_no;                                   // 1-based, EVERY line, including skipped ones
        std::string_view line = detail::trim(buffer);
        if (line.empty() || line.front() == '#') continue;   // blank / comment: skip, not an error

        std::string_view fields[5];                  // 4 valid + 1 overflow sentinel, no allocation
        std::size_t n = 0, start = 0;
        while (n < 5) {
            std::size_t bar = line.find('|', start);
            if (bar == std::string_view::npos) { fields[n++] = line.substr(start); break; }
            fields[n++] = line.substr(start, bar - start);
            start = bar + 1;
        }

        if (n != 4) { on_error({line_no, ErrorKind::WrongFieldCount}); continue; }

        std::string_view symbol = detail::trim(fields[0]);
        if (symbol.empty()) { on_error({line_no, ErrorKind::EmptySymbol}); continue; }

        double bid{};
        if (!detail::parse_double(detail::trim(fields[1]), bid)) {
            on_error({line_no, ErrorKind::InvalidBid}); continue; }
        double ask{};
        if (!detail::parse_double(detail::trim(fields[2]), ask)) {
            on_error({line_no, ErrorKind::InvalidAsk}); continue; }
        std::uint64_t qty{};
        if (!detail::parse_u64(detail::trim(fields[3]), qty)) {
            on_error({line_no, ErrorKind::InvalidQty}); continue; }

        // symbol COPIED here — the view dangles the moment the next getline overwrites `buffer`.
        on_quote(line_no, Quote{std::string(symbol), bid, ask, qty});
    }
}

inline ParseResult parse_all(std::istream& in) {
    ParseResult result;
    parse_feed(in,
        [&](std::size_t, const Quote& q) { result.quotes.push_back(q); },
        [&](const ParseError& e) { result.errors.push_back(e); });
    return result;
}
```

The key gotchas are all about what *doesn't* happen. First, **nothing on this path throws**: every parse is `from_chars` returning a `bool`, so a malformed field is an `on_error` + `continue`, never an exception that unwinds the stream. Second, **validity is `ec == std::errc{}` AND `ptr == last`** — the second half is the one people drop, and without it `1.0x` parses as `1.0` and a corrupt price reaches the book. Third, **`fields[5]` with the overflow slot** turns "too many fields" into the same `n != 4` check as "too few" — one branch, no special case, and no allocation for the split. Fourth, **`line_no` increments before the skip check**, so blank/comment lines still advance it and error line numbers match the physical file. And fifth, the whole reason `Quote::symbol` is a `std::string`: `std::string(symbol)` copies the bytes *now*, because the `string_view` points into `buffer`, which the next `getline` overwrites — hand a caller that view and it is a dangling read.

### Common mistakes & senior signal

- **Reaching for `stringstream` / `stod`.** The reflexive parse throws on the first bad line (aborting the feed), allocates per field, and misreads numbers under a comma-decimal locale. **Senior signal** — reaches for `string_view` + `from_chars` unprompted and names all three defects (throws, allocates, locale-sensitive) as the *reason*, not as an afterthought.
- **Trusting `from_chars` without the end check.** Accepting a field because `ec == std::errc{}` lets `1.0x` through as `1.0` — a silently-truncated, wrong price. **Senior signal** — validates the *whole* field with `ptr == last`, and can show the exact `1.0x` input that the missing check lets slip.
- **Special-casing negative quantity.** A hand-rolled `if (field[0] == '-')` is redundant and will eventually disagree with the parser. **Senior signal** — parses `qty` into an unsigned type and states that `from_chars` rejects the sign for free, so `-5 -> InvalidQty` needs no code.
- **Storing a `string_view` field in the `Quote`.** The view dangles when the reused buffer is overwritten on the next `getline` — a use-after-free that passes every single-line test and corrupts the moment two lines are read. **Senior signal** — copies the symbol into an owning `std::string`, states the lifetime contract precisely (views valid for one line only), and points to the one copy that enforces it.
- **Counting only records, not physical lines.** Incrementing `line_no` after the blank/comment skip makes every error number in a file with comments off-by-however-many-were-skipped, so ops can't find the record. **Senior signal** — increments before the skip, and has a test with leading comments proving the reported line matches the raw file.
