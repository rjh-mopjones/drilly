## How to Attack a Rust Kata

### Summary

**What this topic covers**

The method for solving an open-ended Rust prompt — "parse this without allocating", "implement an LRU cache", "build a thread pool", "model this state machine" — from a blank file in interview time. Rust katas have a different centre of gravity from other languages: the hard part usually isn't the algorithm, it's **satisfying the borrow checker** — deciding who owns each value, what borrows what and for how long, and whether a shape you'd reach for reflexively in Java or Go (a pointer-linked list, a graph of mutable nodes) even *compiles* in safe Rust. This topic is the loop every Rust kata runs on: clarify the spec, design the API **ownership-first** (moves vs borrows, lifetimes, `&self`/`&mut self`, trait object vs generic), write the inline `#[test]`s first, then implement — treating the compiler as a design partner, not an adversary. And it names the Rust twist that reframes the concurrency katas: **data races don't compile**, so the bugs left to hunt are deadlock, lost updates, channel discipline, and UB inside `unsafe`.

**Mental model**

Every Rust design decision is an **ownership decision made first**. Before writing logic, answer: does this function *take* the value (`self`/`T`), *borrow it shared* (`&T`, many readers), or *borrow it mutably* (`&mut T`, exactly one writer)? That single question — enforced by the borrow checker's "one mutable XOR many shared" rule — determines your API and rules out whole categories of design. A classic doubly-linked list has two owners per node, so safe Rust rejects it; the idiomatic move is an **arena/slab**: store nodes in a `Vec` and link them with `usize` indices, sidestepping ownership entirely. A tree of expressions is infinite-sized, so you `Box` the recursion. Shared mutable state across threads is `Arc<Mutex<T>>`, and the compiler *forces* you to think about it via `Send`/`Sync`. When you hit "cannot borrow as mutable", that's not the compiler being difficult — it's telling you two things want to own the same data, and the fix is a real design choice (index instead of reference, clone the small thing, `RefCell` for interior mutability with a runtime check, or restructure). Make the compile the design.

**Key terms**

- **Ownership** — every value has one owner; when it drops, the value is freed. Moves transfer ownership.
- **Borrow** — `&T` (shared, many) or `&mut T` (exclusive, one); the checker enforces one-mutable-XOR-many-shared.
- **Lifetime `'a`** — how long a borrow is valid; ties a returned reference to an input (zero-copy).
- **Move vs `Copy`** — non-`Copy` values move on assignment; `Copy` types (ints) duplicate.
- **`Box<T>`** — heap ownership; needed for recursive/`dyn` types (infinite-size otherwise).
- **Trait object `Box<dyn Trait>`** — dynamic dispatch, heterogeneous storage; vs generic `<T: Trait>` monomorphisation (faster, one type).
- **`Arc<Mutex<T>>`** — shared ownership + interior mutability across threads.
- **`Send` / `Sync`** — auto traits the compiler uses to prove thread-safety; a data race won't compile.
- **Arena / slab** — `Vec<Node>` + `usize` indices to model graphs/lists without fighting ownership.
- **`Result` + `?`** — error propagation; model failures as a custom error enum, not exceptions.
- **Exhaustive `match`** — the compiler forces every enum variant handled; add a variant, get compile errors at every site.

**Why interviewers ask this**

Rust interviews probe whether you *think in ownership* or just fight the compiler. A junior writes C-with-`Rc<RefCell>`-everywhere, hits borrow errors, and sprinkles `.clone()` until it compiles — producing something that works but signals they haven't internalised the model. A senior states the ownership shape up front ("the cache owns the nodes in a slab; the map holds indices, not references, so there's no aliasing"), picks dynamic vs static dispatch deliberately, models errors as enums with `?`, and uses exhaustive `match` so the compiler guards the state machine. On the concurrency katas, the senior knows the compiler already killed data races and focuses on the bugs it can't catch — lock ordering, granularity, `Drop`-based shutdown, `unsafe` invariants. Interviewers read "designs with the borrow checker" as the core competence.

**Common confusions**

- "The borrow checker is fighting me" — it's surfacing a real aliasing problem; the fix is a design change (index, clone, restructure), not `unsafe`.
- "`.clone()` everywhere to make it compile" — sometimes right, often a smell hiding a wrong ownership shape.
- "`Rc<RefCell<T>>` is how you do linked structures" — usually an arena/slab of indices is simpler and faster and avoids runtime `RefCell` panics.
- "Rust has no concurrency bugs" — no *data races*, but deadlock, lost updates, and `unsafe` UB are all still on you.
- "Make it compile, then it's correct" — compiling rules out memory bugs, not logic bugs; you still write tests.

**What follows from this topic**

The next topic — Testing in Rust — covers the inline `#[test]` model this loop writes first: `assert_eq!`, `Result`-returning tests with `?`, `#[should_panic]`, and the `Barrier`-gated `thread::scope` concurrency stress test (plus Miri for the `unsafe` capstone). Then each kata drills one pillar: `tickparser` (lifetimes/zero-copy), `calc` (enums+`Box` recursion), `candles` (`Iterator` by hand), `eventbus` (traits/dispatch), `lru` (the ownership/DLL problem), `threadpool`/`positionbook` (concurrency the compiler can't fully check), `orderstate` (enums+typestate), up to `spscring` (`unsafe` + atomics + Miri).

### The first questions: ownership before logic

Turn the prompt into an ownership plan before writing code.

- **Who owns the data?** Does the type own its contents, or borrow them (`&'a str` for zero-copy)? Owning is simpler; borrowing avoids allocation but adds a lifetime.
- **Move, `&`, or `&mut`?** Decide each method's receiver: `&self` (read), `&mut self` (mutate), `self` (consume). This is your API.
- **Any aliasing?** If two things need to touch the same data, you can't have two `&mut`. Reach for an **arena + indices**, `RefCell` (single-thread interior mutability), or `Arc<Mutex>` (threads).
- **Static or dynamic dispatch?** One concrete type → generic `<T: Trait>`. Heterogeneous/stored-together → `Box<dyn Trait>`.
- **Errors?** A custom `enum Error` + `Result` + `?`, not panics (panics only for genuine bugs / `#[should_panic]` tests).

### Design the API (ownership-first)

Write the signatures and key types first — they encode every decision above.

```rust
pub struct Lru<K, V> {          // owns its storage
    map: HashMap<K, usize>,     // key -> slab index (not a reference!)
    slots: Vec<Node<V>>,        // arena; links are usize, no aliasing
    // head/tail indices...
}
impl<K: Eq + Hash + Clone, V> Lru<K, V> {
    pub fn get(&mut self, k: &K) -> Option<&V> { /* a hit mutates recency → &mut self */ }
    pub fn put(&mut self, k: K, v: V) { /* evict on overflow */ }
}
```

Note `get` takes `&mut self`: a cache hit reorders recency, so it's a write. Getting the receiver right up front avoids a borrow-checker rewrite later.

### Write the tests first, then implement

Tests live **inline** in the same file — write them before the bodies:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn evicts_least_recently_used() {
        let mut c = Lru::new(2);
        c.put("a", 1); c.put("b", 2);
        c.get(&"a");            // promote a
        c.put("c", 3);          // evicts b
        assert!(c.get(&"b").is_none());
        assert_eq!(c.get(&"a"), Some(&1));
    }
}
```

Order: contract → core behaviour → edges (empty, capacity 1, error variants) → concurrency stress (`Barrier` + `thread::scope`) for the threaded katas. Then implement to green — and to *compile*, which is half the work. Run one kata with `cargo test -p solution <kata>`; the unsafe `spscring` capstone additionally runs under `cargo +nightly miri test`. Details in the next topic.


## Testing in Rust (cargo test, #[test], Barrier, Miri)

### Summary

**What this topic covers**

Rust's built-in testing model, so "write the tests first" is mechanical on every kata. Rust needs no third-party test framework — tests are `#[test]` functions, conventionally in an inline `#[cfg(test)] mod tests` block **in the same file as the code**, run with `cargo test`. This topic covers that model (`assert_eq!`, `assert!`, `#[should_panic]`, `Result`-returning tests with `?`), how to write **table-driven** cases idiomatically, and — the part that trips people — how to test **concurrency** in a language that has already deleted data races: you gate threads with `std::sync::Barrier` inside `std::thread::scope` and assert an invariant (conservation, no lost update, no deadlock), and for the `unsafe` capstone you run **Miri**, which plays the ThreadSanitizer/UB-detector role that `-race` plays in Go and TSan in C++. Master these and each kata's "Write the tests" step is just picking which pattern the trap needs.

**Mental model**

Two kinds of test, two questions. A **behaviour test** proves logic: the parser rejects a malformed tick (`Result::Err`), the LRU evicts the right key, the calculator respects precedence — arrange, act, `assert_eq!`. Because Rust models failure as `Result`, tests can be `fn ... -> Result<(), E>` and use `?`, and expected panics are asserted with `#[should_panic(expected = "...")]`. A **concurrency test** proves an invariant under contention: spawn N threads that hammer shared state, then assert something a bug would break. The Rust-specific mechanics: `std::thread::scope` lets threads borrow local state without `'static`/`Arc` gymnastics (they're all joined at scope end), and `std::sync::Barrier::wait()` is the start-gate — every thread blocks until all N arrive, then they're released together to maximise the overlap that exposes a lost update or a lock-ordering deadlock. You assert the invariant (a position book's net is conserved; every job ran), never an exact interleaving. Crucially, you are **not** hunting data races — the compiler already proved their absence via `Send`/`Sync`; you're hunting the logic bugs concurrency creates. For `unsafe` code the compiler's guarantees lapse, so **Miri** interprets the program and flags UB (data races on raw pointers, invalid memory, bad atomic orderings) that a normal run hides.

**Key terms**

- **`#[test]`** — marks a test fn; `cargo test` discovers and runs all of them.
- **`#[cfg(test)] mod tests`** — inline test module compiled only under test; `use super::*;` to reach the code.
- **`assert_eq!` / `assert!` / `assert_ne!`** — the core assertions; failures print both values.
- **`Result`-returning test** — `fn t() -> Result<(), Box<dyn Error>>` + `?`; ergonomic for fallible setups.
- **`#[should_panic(expected = "...")]`** — asserts the body panics with a matching message.
- **Table-driven** — iterate an array of `(input, expected)` tuples, asserting each (optionally with an index label).
- **`std::thread::scope`** — scoped threads that may borrow locals; all joined when the scope returns.
- **`std::sync::Barrier`** — `wait()` blocks until N threads arrive, then releases together (the start-gate).
- **Invariant assertion** — conservation / exactly-once / no-deadlock; the property a bug breaks, not exact output.
- **Miri** — `cargo +nightly miri test`; interprets the program to detect UB in `unsafe` (the TSan analogue).
- **`cargo test -p <crate> <filter>`** — run a subset by name; `-- --nocapture` to see `println!`.

**Why interviewers ask this**

In a Rust interview, driving your own tests shows you can specify behaviour precisely *and* that you understand what the type system already guarantees versus what it doesn't. Anyone writes an `assert_eq!` on the happy path; the signal is whether you model errors as `Result` and test the `Err` variants, whether you know expected panics use `#[should_panic]`, and — the senior tell — whether, on a concurrency kata, you can write a `Barrier`-gated `thread::scope` stress test that would expose a lock-ordering deadlock or a lost update, rather than shrugging "Rust is safe". And for `unsafe`, knowing that a green `cargo test` proves nothing about soundness and that **Miri** is how you actually check UB is exactly the judgement the capstone probes. A candidate who reaches for those tools reads as someone who ships correct Rust, not just compiling Rust.

**Common confusions**

- "Rust is safe, so I don't need concurrency tests" — no *data races*, but deadlock/lost-update/logic bugs remain; test the invariant.
- "I need a test crate like JUnit" — no; `#[test]` + `cargo test` is built in, std-only.
- "`unwrap()` in tests is fine" — ok for genuine can't-fail setup, but prefer `Result` tests + `?`, and assert real error variants.
- "A green `cargo test` proves my `unsafe` is sound" — it doesn't; run **Miri**, which catches the UB a normal run misses.
- "`thread::spawn` for the stress test" — needs `'static`/`Arc`; `thread::scope` lets threads borrow locals and auto-joins.
- "Assert the exact concurrent output" — order is nondeterministic; assert a conserved quantity or a set/count.

**What follows from this topic**

Every kata's "Write the tests" card is an instance of these patterns: behaviour tests + table cases for `tickparser`/`calc`/`candles`/`orderstate`/`lru`/`eventbus`; `Barrier`-gated `thread::scope` invariant stress tests for `threadpool` and `positionbook`; and Miri for the `spscring` unsafe capstone. When a kata shows a concurrency test or a Miri run, come back here for the template.

### The behaviour test (inline, table-driven, Result)

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_valid_ticks() -> Result<(), ParseError> {
        let cases = [
            ("AAPL,101.5,200", ("AAPL", 101.5, 200)),
            ("MSFT,42.0,1",    ("MSFT", 42.0, 1)),
        ];
        for (input, want) in cases {
            let t = parse(input)?;           // ? works: test returns Result
            assert_eq!((t.symbol, t.price, t.qty), want);
        }
        Ok(())
    }

    #[test]
    fn rejects_missing_field() {
        assert!(matches!(parse("AAPL,101.5"), Err(ParseError::MissingField)));
    }

    #[test]
    #[should_panic(expected = "capacity")]
    fn zero_capacity_panics() { Lru::<u8, u8>::new(0); }
}
```

Run: `cargo test -p solution tickparser`, or `-- --nocapture` to see output.

### The concurrency stress test (Barrier + thread::scope)

The invariant test that would catch a lost update or a deadlock. Threads borrow the shared book directly (no `Arc` needed) because `scope` joins them before it returns.

```rust
#[test]
fn concurrent_transfers_conserve_net() {
    let book = PositionBook::new();
    book.set("a", 1000); book.set("b", 1000);
    let n = 8;
    let gate = std::sync::Barrier::new(n);
    std::thread::scope(|s| {
        for _ in 0..n {
            s.spawn(|| {
                gate.wait();                 // release all together → max contention
                for _ in 0..10_000 {
                    book.transfer("a", "b", 1);   // sorted lock order inside
                    book.transfer("b", "a", 1);
                }
            });
        }
    }); // all threads joined here
    assert_eq!(book.net("a") + book.net("b"), 2000); // conserved iff correct
}
```

Assert the **invariant** (sum == 2000), never a sequence. A lost update or a coarse/incorrect lock fails it; a deadlock hangs (wrap the run in a watchdog thread or a bounded loop so it fails loudly). Re-run to shake interleavings.

### Miri — the UB detector for `unsafe` (spscring)

Safe Rust's guarantees stop at `unsafe`, so a normal green run says nothing about soundness. Miri interprets the program and flags data races on raw pointers, out-of-bounds, uninitialised reads, and invalid atomic orderings:

```bash
rustup component add miri
cargo +nightly miri test -p solution spscring
```

For the SPSC ring, Miri is what proves the `Acquire`/`Release` ordering and the `UnsafeCell` accesses are actually sound under concurrent producer/consumer — the role `-race` (Go) and TSan (C++) play elsewhere.


## Tick Parser — Zero-Copy Borrowing & Lifetimes

### Summary

**What this topic covers**

A feed handler reads pipe-delimited quote lines off the wire — `"LIV-MUN|1.95|2.05|1234"` (symbol, bid, ask, sequence number) — millions per second. You write `parse(line)` that turns one line into a `Quote`. The constraint that makes it a Rust kata: on the hot path you must **not allocate**. The parsed `Quote` borrows the symbol *straight out of the input buffer* — `symbol: &'a str`, not `symbol: String`. This drills the single most distinctive thing in Rust: **lifetimes**, the annotation that lets you return a reference into someone else's data and have the compiler prove, at zero runtime cost, that the reference can never dangle. Alongside it you drill `Result` + a custom error enum + the `?` operator, and mapping `std`'s parse errors into your own domain type. Small surface, deep idea: the whole exercise is one function signature and getting the borrow to check.

**Mental model**

The line lives in the caller's buffer. `Quote` is a *view* into it — the symbol field is a pointer + length into bytes the caller still owns. The lifetime `'a` on `Quote<'a>` and the signature `fn parse(line: &str) -> Result<Quote<'_>, ParseError>` tie the quote's lifetime to the input line: the borrow checker refuses to compile any code where a `Quote` outlives the buffer it points into. That's the trade — one lifetime annotation buys a compile-time guarantee against a whole bug class (use-after-free / dangling pointer) that a C++ `string_view` would happily let you write and crash on at runtime. Contrast `symbol: String`: correct, but it heap-allocates and memcpys the bytes on *every line*. At feed volume that allocator traffic *is* the bottleneck. `&str` borrows and is free; `String` owns and costs. Reach for the owning type only when the data must outlive the buffer.

**Key terms**

- **borrow (`&str`)** — a reference into data owned elsewhere; no allocation, no copy, no ownership transfer.
- **lifetime `'a`** — a compile-time label naming *how long* a borrow is valid; `Quote<'a>` says "this quote borrows something that lives at least `'a`".
- **lifetime elision** — the compiler infers `'a` in common signatures so you rarely write it; `-> Quote<'_>` makes the elided-but-present lifetime visible.
- **`&str` vs `String`** — `&str` is a borrowed view (ptr+len); `String` is a heap-owned, growable buffer. Borrow on the hot path, own only when you must keep data.
- **`str::split('|')`** — returns an iterator of `&str` slices *into* the original — themselves zero-copy borrows.
- **`str::parse::<T>()`** — turns a `&str` into a `T` via `FromStr`, returning `Result<T, T::Err>`.
- **`ParseFloatError` / `ParseIntError`** — `std`'s parse error types; you map these into your domain enum rather than leaking them.
- **`Result<T, E>`** — success/failure sum type; the idiomatic way to return recoverable errors (no exceptions in Rust).
- **custom error enum** — one variant per failure mode (`WrongFieldCount`, `EmptySymbol`, `InvalidBid`…); implements `Display` + `Error` so callers can `?` it.
- **`?` operator** — early-returns the `Err` on a `Result`, unwrapping the `Ok`; the backbone of clean error propagation.
- **`map_err`** — rewrites a `Result`'s error type, e.g. `std`'s `ParseFloatError` → your `ParseError::InvalidBid`.
- **`std::ptr::eq`** — pointer-identity check; the test trick that *proves* the symbol borrows the input (same address) rather than copying it.

**Why interviewers ask this**

It's the cleanest probe of whether you understand lifetimes or just avoid them. A junior reaches for `symbol: String`, "makes it work," and never notices the per-line allocation — or fights the borrow checker and `.to_owned()`s everything. A senior reads `Result<Quote<'_>, ParseError>` as "the output borrows the input," designs the ownership up front, and can articulate *why* zero-copy matters (allocator pressure at millions of lines/sec is the latency killer). Error handling is a second signal: do you leak `std::num::ParseFloatError`, or own a domain `ParseError` enum, implement `Display`/`Error`, and `map_err` at the boundary? The whole thing is fifteen lines — nowhere to hide.

**Common confusions**

- "I need a lifetime, so I'll add `String` to be safe." — Backwards. `String` is what you use to *avoid* lifetimes; the kata's whole point is the borrow. Adding `'a` is the correct, cheaper answer.
- "Returning a reference from a function is dangerous." — Only without lifetimes. `-> Quote<'_>` ties the borrow to `line`; the compiler guarantees safety. It's dangling references that are impossible here, not references.
- "`split` allocates a Vec." — No. `str::split` is a lazy iterator yielding `&str` slices into the original — zero allocation. Counting then re-splitting is two cheap passes over the same bytes.
- "`-1` should parse as a seq." — `seq: u64` is unsigned, so `"-1".parse::<u64>()` fails → `InvalidSeq`. The type *is* the validation.
- "Just `?` the `std` error." — It won't compile unless your `ParseError` has `From<ParseFloatError>`; even then you'd be leaking std's type semantics. `map_err(|_| ParseError::InvalidBid)?` is the deliberate, self-documenting choice.

**What follows from this topic**

Borrowing-into-input is the foundation for every real parser: `nom`/`winnow` combinators return `&'a str` slices the same way, and `serde`'s zero-copy `#[serde(borrow)]` deserialization is this idea at scale. The extension — parse from `&[u8]` raw wire bytes instead of `&str` and benchmark against a `String`-owning version — makes the allocation cost you avoided visible on a flamegraph. From here the lifetime story deepens into structs that hold multiple borrows, `Cow<'a, str>` (borrow-or-own when you *sometimes* need to mutate), and self-referential-struct pain (which is exactly why the LRU-cache kata reaches for slab indices instead of `Rc<RefCell>`). The error-enum + `?` pattern recurs in every kata that returns `Result`.

### Clarify & design the API

The clarifying questions are really *ownership* questions — answer them and the signature writes itself:

- **Who owns the symbol bytes after parse returns?** The caller's line does. So the `Quote` must *borrow*, not own → `symbol: &'a str`, and `Quote` is generic over `'a`.
- **Does `parse` need `&self`?** No — it's a free function, no receiver. It takes the line by shared reference (`&str`) because it only reads.
- **One lifetime or two?** One. The output borrows from exactly one input (the line), so a single `'a` connects them. Elision even lets you omit naming it in the signature — but you must still *write* `Quote<'_>` so the reader sees the borrow.
- **Bid/ask type?** `f64` (prices). **Seq?** `u64` — unsigned, which for free rejects `-1`.
- **Error model?** A custom `enum ParseError` with one variant per failure, implementing `Display` + `std::error::Error` so callers can `?`-propagate or `match`.

`Quote<'a>` and `ParseError` are provided verbatim; you write `parse`. The shapes:

```rust
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Quote<'a> {
    pub symbol: &'a str,   // borrows the input line — no String, no alloc
    pub bid: f64,
    pub ask: f64,
    pub seq: u64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ParseError {
    WrongFieldCount { expected: usize, got: usize },
    EmptySymbol,
    InvalidBid,
    InvalidAsk,
    InvalidSeq,
}

// The signature IS the design: output borrows input, fallible via Result.
pub fn parse(line: &str) -> Result<Quote<'_>, ParseError>;
```

Note `Quote` derives `Copy` — it's just a pointer, two `f64`s and a `u64`, all `Copy`, so the whole struct is trivially copyable. That's only possible *because* `symbol` is `&str` and not `String` (`String` isn't `Copy`). The zero-copy choice pays off twice.

### Write the tests

Write these first — they pin the contract before a line of `parse` exists. The load-bearing one is `symbol_borrows_the_input_no_copy`: it uses `std::ptr::eq` on the raw pointers to *prove* the symbol is the same memory as the input, not a copy. Without that assertion a `String`-based implementation would pass every other test — this is the test that actually enforces "zero-copy."

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_a_valid_line() {
        let line = "LIV-MUN|1.95|2.05|1234";
        let q = parse(line).expect("valid line");
        assert_eq!(q.symbol, "LIV-MUN");
        assert_eq!(q.bid, 1.95);
        assert_eq!(q.ask, 2.05);
        assert_eq!(q.seq, 1234);
    }

    #[test]
    fn symbol_borrows_the_input_no_copy() {
        let line = String::from("ARS-CHE|1.50|1.60|7");
        let q = parse(&line).unwrap();
        // Same address ⇒ the symbol points INTO the buffer, zero copy.
        assert!(std::ptr::eq(q.symbol.as_ptr(), line.as_ptr()));
    }

    #[test]
    fn rejects_wrong_field_count() {
        assert_eq!(
            parse("A|1.0|2.0"),
            Err(ParseError::WrongFieldCount { expected: 4, got: 3 })
        );
        assert_eq!(
            parse("A|1.0|2.0|1|extra"),
            Err(ParseError::WrongFieldCount { expected: 4, got: 5 })
        );
    }

    #[test]
    fn rejects_empty_symbol() {
        assert_eq!(parse("|1.0|2.0|1"), Err(ParseError::EmptySymbol));
    }

    #[test]
    fn rejects_bad_numbers() {
        assert_eq!(parse("A|x|2.0|1"),   Err(ParseError::InvalidBid));
        assert_eq!(parse("A|1.0|y|1"),   Err(ParseError::InvalidAsk));
        assert_eq!(parse("A|1.0|2.0|z"), Err(ParseError::InvalidSeq));
        assert_eq!(parse("A|1.0|2.0|-1"), Err(ParseError::InvalidSeq)); // u64 rejects negatives
    }

    #[test]
    fn error_implements_display() {
        let e = ParseError::WrongFieldCount { expected: 4, got: 2 };
        assert_eq!(e.to_string(), "expected 4 fields, got 2");
    }
}
```

What each catches: `parses_a_valid_line` is the happy-path contract; `symbol_borrows_the_input_no_copy` enforces the *zero-copy* invariant (the whole kata); `rejects_wrong_field_count` pins the arity check both under and over; `rejects_empty_symbol` and `rejects_bad_numbers` cover each error variant, with `-1` proving the `u64` type *is* the validation; `error_implements_display` confirms you implemented `Display` (needed for the `Error` trait). Run: `cargo test -p solution tickparser`.

### Implement it

`split('|')` yields borrowed `&str` slices into `line` — no allocation. Count first to validate arity, then re-split to read (two cheap passes over the same bytes). Each numeric field goes through `str::parse` with `map_err` to translate `std`'s error into a domain variant, then `?` to early-return on failure:

```rust
pub fn parse(line: &str) -> Result<Quote<'_>, ParseError> {
    let count = line.split('|').count();
    if count != 4 {
        return Err(ParseError::WrongFieldCount { expected: 4, got: count });
    }

    // count == 4, so all four next() calls are guaranteed Some.
    let mut fields = line.split('|');
    let symbol = fields.next().unwrap();                       // &str into `line`
    let bid = fields.next().unwrap()
        .parse::<f64>().map_err(|_| ParseError::InvalidBid)?;
    let ask = fields.next().unwrap()
        .parse::<f64>().map_err(|_| ParseError::InvalidAsk)?;
    let seq = fields.next().unwrap()
        .parse::<u64>().map_err(|_| ParseError::InvalidSeq)?;

    if symbol.is_empty() {
        return Err(ParseError::EmptySymbol);
    }

    Ok(Quote { symbol, bid, ask, seq })  // symbol still borrows `line`
}
```

And the error type — one variant per failure, `Display` for human text, empty `Error` impl to opt into the trait hierarchy:

```rust
impl std::fmt::Display for ParseError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {  // exhaustive match — add a variant, this won't compile until handled
            ParseError::WrongFieldCount { expected, got } =>
                write!(f, "expected {expected} fields, got {got}"),
            ParseError::EmptySymbol => write!(f, "empty symbol"),
            ParseError::InvalidBid  => write!(f, "invalid bid"),
            ParseError::InvalidAsk  => write!(f, "invalid ask"),
            ParseError::InvalidSeq  => write!(f, "invalid seq"),
        }
    }
}
impl std::error::Error for ParseError {}
```

The key point: `symbol` is never copied. It's a slice into `line`, and because `parse`'s return type is `Quote<'_>` (lifetime tied to `line`), the borrow checker guarantees the caller can't hold the `Quote` past `line`. Complexity is O(n) over the line length, one allocation-free pass conceptually (two literal passes for count-then-read). The gotcha to avoid: don't `.to_owned()` the symbol "to be safe" — that reintroduces the exact allocation the kata exists to eliminate.

### Common mistakes & senior signal

- **The real challenge — lifetimes are the point, not an obstacle.** The trap is treating the borrow checker as an adversary and defaulting to `String`. A senior recognizes the `Quote<'a>` / `-> Quote<'_>` signature as *the design*: output borrows input, proven at compile time, zero runtime cost. They can contrast it with C++ `string_view` (same performance, none of the dangling-pointer safety).
- **Leaking `std`'s error types.** Junior: `.parse()?` and let `ParseFloatError` escape (which won't even compile without a `From` impl, then leaks std semantics). Senior: own a domain `ParseError` enum and `map_err(|_| ParseError::InvalidBid)?` at the boundary — callers match on *your* variants.
- **Exhaustive `match` in `Display`.** No wildcard `_ =>` arm. If someone adds a `ParseError` variant, the match fails to compile until they handle it — the compiler enforces you can't forget an error case.
- **Type-as-validation.** Choosing `u64` for `seq` makes `-1` a parse failure for free — no manual range check. A senior picks the type that encodes the invariant.
- **Proving zero-copy in a test.** The `std::ptr::eq(q.symbol.as_ptr(), line.as_ptr())` assertion is what separates "I think it borrows" from "I proved it borrows." Without it the test suite can't distinguish a borrow from a hidden allocation.
- **Knowing when to own instead.** Borrow on the hot path; but a senior names the exception — if the quote must outlive the buffer (queued for later, sent across a channel), you *do* copy into `String` or `Cow<'a, str>`. The skill is choosing per use-site, not dogmatically.


## Calculator — The Recursive-Enum AST & Precedence-by-Descent

### Summary

**What this topic covers**

You are handed a string like `"1 + 2 * (3 - 4) / 5"` and must return the `f64` it means. Build `eval(input: &str) -> Result<f64, CalcError>` by hand — no `nom`, no `winnow`, no parser generator. You support `+ - * /`, parentheses, unary minus, integer and decimal literals, and arbitrary whitespace, with `* /` binding tighter than `+ -` and every operator left-associative (`10-2-3 == 5`). This is the canonical "write a calculator" senior ask, and it drills the two features Rust most wants to see you use: an **enum modelling a grammar** and **`match` recursing over it**. The whole exercise is turning a flat string into structured meaning — you cannot evaluate left-to-right in one pass and get precedence right, so you build a tree first (an abstract syntax tree, `Expr`) whose *shape encodes precedence*, then walk it bottom-up.

**Mental model**

Precedence is not a rule you apply while scanning — it is a property of *tree shape*. `1 + 2 * 3` must parse to `Add(1, Mul(2, 3))` so that evaluating the `Mul` node happens before the `Add` node purely because it sits lower in the tree. You produce that shape with **recursive descent**: one function per precedence level, each parsing the level *above* it and then looping while it sees *its own* operators. `expr` handles `+ -`, calls `term`; `term` handles `* /`, calls `factor`; `factor` handles numbers, parentheses, and unary minus. Precedence falls out of which function calls which; left-associativity falls out of the *loop* (fold the accumulated left-hand side into a new `Bin` node each iteration) rather than recursion. The AST is an `enum Expr` — and because a `Bin` node holds two child `Expr`s, the type is self-referential and must be broken with `Box`, or it has infinite size and won't compile.

**Key terms**

- **AST (abstract syntax tree)** — the parsed `Expr` tree; shape encodes precedence and associativity.
- **`enum Expr`** — sum type with variants `Num(f64)`, `Neg(Box<Expr>)`, `Bin { op, lhs, rhs }`.
- **`Box<Expr>`** — heap pointer of known size; the idiomatic fix for a recursive type (see below).
- **recursive descent** — mutually-recursive functions, one per precedence level, mirroring the grammar.
- **left-associative** — `a - b - c == (a - b) - c`; produced by a *loop*, not right-recursion.
- **tokenize / lexer** — `&str → Vec<Token>` first, so the parser matches tokens not raw `char`s.
- **cursor** — `Parser { tokens: &'a [Token], pos }`; `peek` looks, `advance` consumes.
- **`Op`** — `#[derive(Clone, Copy)]` enum of the four operators; matched exhaustively in eval.
- **`?` operator** — bubbles the first `CalcError` out of every parse/eval step.
- **`CalcError`** — error enum (`DivideByZero`, `UnexpectedChar(c)`, `UnexpectedEof`, `UnexpectedToken`, `TrailingInput`) implementing `Display` + `std::error::Error`.
- **exhaustive `match`** — the compiler forces every `Op` and `Expr` variant to be handled.

**Why interviewers ask this**

It separates people who *reach for* Rust's type system from people who fight it. A junior writes a single scanning loop, mishandles precedence, and returns a bare `f64` or panics on bad input. A senior says "precedence forces a tree" before writing a line, defines the `Expr` enum, immediately notes it's recursive and reaches for `Box`, and models errors as an enum returned via `Result`/`?` rather than `unwrap`/`panic`. The `match` in `eval` being *exhaustive* — the compiler refusing to compile if you forget `Op::Div` — is the exact safety property they want you to lean on. It is also a compact tour of ownership: who owns the tokens, does the parser borrow a slice (`&'a [Token]`) or own a `Vec`, and why the AST nodes own their children via `Box`.

**Common confusions**

- "Left-associative means recurse on the left." No — right-recursion gives you right-associativity. Left-associativity comes from a `while` loop that folds the running `lhs` into a new node each step.
- "`Box` is for performance / avoiding copies." Here it is for *sizing*: without it the enum is infinitely large and the program does not compile.
- "Unary minus is just subtraction." It is a distinct `Neg` node; `2 + -3` needs `factor` to accept a leading `-`.
- "Leftover input is fine." `1+2)` and `1 2` parse a valid prefix then leave tokens — that must be `TrailingInput`, checked after the top-level parse.

**What follows from this topic**

The recursive-enum-plus-`Box` pattern is the same one behind any tree or linked list in Rust, and the `match`-over-enum evaluator generalises to interpreters and visitor-style walks. The natural extensions — a right-associative `^` power operator, a variable environment, or rewriting the parser as a **Pratt** (top-down operator-precedence) parser — each stress a different corner: `^` shows how associativity lives in loop-vs-recursion, Pratt shows precedence-as-a-table when function-per-level stops scaling.

### Clarify & design the API

Questions worth asking before coding: float or arbitrary precision (`f64` is fine)? Are `+`/`-` allowed as unary? What error granularity is expected (one `Err(())` vs distinct variants)? Is the AST an observable output or purely internal? The senior move is to state the grammar out loud:

```text
expr   := term   (('+' | '-') term)*     // lowest precedence, left-assoc
term   := factor (('*' | '/') factor)*   // higher precedence, left-assoc
factor := '-' factor | '(' expr ')' | number
```

Then fix the **ownership decisions**. The AST nodes *own* their children, and because `Expr` is recursive, children are `Box<Expr>`. The parser *borrows* the token slice (`&'a [Token]`) rather than owning it — a lifetime `'a` ties the `Parser` to the `Vec<Token>` living in `eval`. Parse methods take `&mut self` (they advance a cursor); `eval_expr` takes `&Expr` (read-only walk).

```rust
pub enum Op { Add, Sub, Mul, Div }

pub enum Expr {
    Num(f64),
    Neg(Box<Expr>),                              // Box: recursive
    Bin { op: Op, lhs: Box<Expr>, rhs: Box<Expr> },
}

pub enum CalcError {
    UnexpectedChar(char), UnexpectedEof,
    UnexpectedToken, TrailingInput, DivideByZero,
}

pub fn eval(input: &str) -> Result<f64, CalcError>;

struct Parser<'a> { tokens: &'a [Token], pos: usize }
```

### Write the tests

Write these `#[cfg(test)] mod tests` first — they pin down precedence, associativity, and every error variant before a line of parser exists. Run with `cargo test -p practice calc` (or `-p solution calc`).

```rust
#[cfg(test)]
mod tests {
    use super::*;

    // --- core arithmetic & precedence ---
    #[test] fn precedence_multiplies_before_adding() { assert_eq!(eval("1+2*3"), Ok(7.0)); }
    #[test] fn parentheses_override_precedence()      { assert_eq!(eval("(1+2)*3"), Ok(9.0)); }
    #[test] fn decimal_literals()                     { assert_eq!(eval("3.5*2"), Ok(7.0)); }
    #[test] fn arbitrary_whitespace_is_ignored()      { assert_eq!(eval("  1  +  2  "), Ok(3.0)); }

    // --- associativity: the loop, not recursion ---
    #[test] fn subtraction_is_left_associative() { assert_eq!(eval("10-2-3"), Ok(5.0)); } // (10-2)-3
    #[test] fn division_is_left_associative()    { assert_eq!(eval("8/2/2"),  Ok(2.0)); } // (8/2)/2

    // --- unary minus ---
    #[test] fn unary_minus_on_a_literal()   { assert_eq!(eval("-5"),     Ok(-5.0)); }
    #[test] fn unary_minus_after_operator() { assert_eq!(eval("2 + -3"), Ok(-1.0)); }

    // --- every error variant (Result, never panic) ---
    #[test] fn division_by_zero_is_an_error()  { assert_eq!(eval("1/0"),  Err(CalcError::DivideByZero)); }
    #[test] fn trailing_paren_is_rejected()    { assert_eq!(eval("1+2)"), Err(CalcError::TrailingInput)); }
    #[test] fn two_numbers_no_operator()       { assert_eq!(eval("1 2"),  Err(CalcError::TrailingInput)); }
    #[test] fn empty_input_is_rejected()       { assert_eq!(eval(""),     Err(CalcError::UnexpectedEof)); }
    #[test] fn bad_character_reports_the_char(){ assert_eq!(eval("1+@"),  Err(CalcError::UnexpectedChar('@'))); }
    #[test] fn dangling_operator_is_eof()      { assert_eq!(eval("1 +"),  Err(CalcError::UnexpectedEof)); }

    // --- shape assertion: the AST really is Add(1, Mul(2,3)) ---
    #[test]
    fn builds_the_expected_ast() {
        let tokens = tokenize("1+2*3").unwrap();
        let ast = Parser::new(&tokens).parse_expr().unwrap();
        assert_eq!(ast, Expr::Bin {
            op: Op::Add,
            lhs: Box::new(Expr::Num(1.0)),
            rhs: Box::new(Expr::Bin {
                op: Op::Mul,
                lhs: Box::new(Expr::Num(2.0)),
                rhs: Box::new(Expr::Num(3.0)),
            }),
        });
    }

    #[test]
    fn error_implements_display() {
        assert_eq!(CalcError::DivideByZero.to_string(), "division by zero");
    }
}
```

What each group catches: `precedence_*` proves `term` sits below `expr`; the `*_left_associative` pair is the one most single-pass solutions fail — it proves you fold with a loop, not right-recursion. The error tests force `Result` discipline: `1+2)` parses a valid `1+2` then must *reject* the leftover `)` as `TrailingInput` (not silently succeed), and `1 2` exercises the same "valid prefix, leftover tokens" path. `builds_the_expected_ast` asserts *structure*, catching a parser that computes the right number via the wrong tree. Deriving `PartialEq` on `Expr`/`CalcError` is what makes all of `assert_eq!` possible.

### Implement it

Three stages: **tokenize → parse → eval**. Tokenize first so the parser matches on `Token`, not raw `char`s (whitespace vanishes here, so the parser never thinks about it):

```rust
#[derive(Clone, Copy, PartialEq)]
enum Token { Num(f64), Plus, Minus, Star, Slash, LParen, RParen }

fn tokenize(input: &str) -> Result<Vec<Token>, CalcError> {
    let chars: Vec<char> = input.chars().collect();
    let mut tokens = Vec::new();
    let mut i = 0;
    while i < chars.len() {
        match chars[i] {
            ' ' | '\t' | '\n' | '\r' => i += 1,
            '+' => { tokens.push(Token::Plus);  i += 1; }
            '-' => { tokens.push(Token::Minus); i += 1; }
            '*' => { tokens.push(Token::Star);  i += 1; }
            '/' => { tokens.push(Token::Slash); i += 1; }
            '(' => { tokens.push(Token::LParen); i += 1; }
            ')' => { tokens.push(Token::RParen); i += 1; }
            c if c.is_ascii_digit() || c == '.' => {
                let start = i;
                while i < chars.len() && (chars[i].is_ascii_digit() || chars[i] == '.') { i += 1; }
                let text: String = chars[start..i].iter().collect();
                let value = text.parse::<f64>().map_err(|_| CalcError::UnexpectedChar(c))?;
                tokens.push(Token::Num(value));
            }
            other => return Err(CalcError::UnexpectedChar(other)),
        }
    }
    Ok(tokens)
}
```

Now recursive descent. Each level parses the level above, then **loops** while it sees its own operators — that loop is what makes them left-associative, folding the running `lhs` into a fresh `Bin`:

```rust
impl<'a> Parser<'a> {
    fn peek(&self) -> Option<Token> { self.tokens.get(self.pos).copied() }
    fn advance(&mut self) -> Option<Token> {
        let t = self.tokens.get(self.pos).copied();
        if t.is_some() { self.pos += 1; }
        t
    }

    fn parse_expr(&mut self) -> Result<Expr, CalcError> {   // + -
        let mut lhs = self.parse_term()?;
        while let Some(tok) = self.peek() {
            let op = match tok { Token::Plus => Op::Add, Token::Minus => Op::Sub, _ => break };
            self.advance();
            let rhs = self.parse_term()?;
            lhs = Expr::Bin { op, lhs: Box::new(lhs), rhs: Box::new(rhs) };
        }
        Ok(lhs)
    }

    fn parse_term(&mut self) -> Result<Expr, CalcError> {   // * /  (same shape, calls parse_factor)
        let mut lhs = self.parse_factor()?;
        while let Some(tok) = self.peek() {
            let op = match tok { Token::Star => Op::Mul, Token::Slash => Op::Div, _ => break };
            self.advance();
            let rhs = self.parse_factor()?;
            lhs = Expr::Bin { op, lhs: Box::new(lhs), rhs: Box::new(rhs) };
        }
        Ok(lhs)
    }

    fn parse_factor(&mut self) -> Result<Expr, CalcError> { // - / ( ) / number
        match self.advance() {
            Some(Token::Num(n))   => Ok(Expr::Num(n)),
            Some(Token::Minus)    => Ok(Expr::Neg(Box::new(self.parse_factor()?))),
            Some(Token::LParen)   => {
                let inner = self.parse_expr()?;
                match self.advance() {
                    Some(Token::RParen) => Ok(inner),
                    Some(_) => Err(CalcError::UnexpectedToken),
                    None    => Err(CalcError::UnexpectedEof),
                }
            }
            Some(_) => Err(CalcError::UnexpectedToken),
            None    => Err(CalcError::UnexpectedEof),
        }
    }
}
```

Evaluation is an **exhaustive `match`** that recurses into children — the compiler will not let you forget an `Op` or `Expr` variant:

```rust
fn eval_expr(e: &Expr) -> Result<f64, CalcError> {
    match e {
        Expr::Num(n)   => Ok(*n),
        Expr::Neg(inner) => Ok(-eval_expr(inner)?),
        Expr::Bin { op, lhs, rhs } => {
            let (l, r) = (eval_expr(lhs)?, eval_expr(rhs)?);
            match op {
                Op::Add => Ok(l + r),
                Op::Sub => Ok(l - r),
                Op::Mul => Ok(l * r),
                Op::Div => if r == 0.0 { Err(CalcError::DivideByZero) } else { Ok(l / r) },
            }
        }
    }
}

pub fn eval(input: &str) -> Result<f64, CalcError> {
    let tokens = tokenize(input)?;
    let mut parser = Parser::new(&tokens);
    let expr = parser.parse_expr()?;
    if parser.pos != tokens.len() {            // valid prefix, leftover tokens
        return Err(CalcError::TrailingInput);
    }
    eval_expr(&expr)
}
```

Complexity is O(n) tokens, O(n) parse, O(n) eval — a single linear pass per stage. The key gotcha: the `if parser.pos != tokens.len()` check is not optional — without it `1+2)` and `1 2` silently return `3.0`, since the parser happily stops at the first thing it cannot continue.

### Common mistakes & senior signal

The README's "real challenge" is precedence, and the trap is trying to do it in one left-to-right pass: by the time you read the `*` in `1 + 2 * 3` you have already (wrongly) added `1 + 2`. The fix is to build the tree first — say that out loud. Other pitfalls and the senior response:

- **Forgetting `Box` and fighting the compiler.** `enum Expr { Bin { lhs: Expr, rhs: Expr } }` errors with "recursive type has infinite size." A senior recognises the message instantly and reaches for `Box<Expr>` — the heap indirection gives the node a fixed size. This is the same reason a hand-rolled tree or linked list needs `Box`/`Rc`.
- **Right-recursing and getting right-associativity.** If `parse_expr` recursed on the right instead of looping, `10-2-3` would parse as `10-(2-3) == 11`. The `while` loop that folds `lhs` is the whole point; the two `_left_associative` tests guard it.
- **Panicking on bad input.** `unwrap()` / `panic!` / returning `0.0` on error is the junior tell. A senior threads `Result<_, CalcError>` through every step, uses `?` to bubble the first failure, and models distinct variants (`DivideByZero` vs `UnexpectedChar` vs `TrailingInput`) so callers can `match` or `?`-propagate. `CalcError` implements `Display` + `std::error::Error` so it composes with `Box<dyn Error>`.
- **Non-exhaustive eval.** Leaning on a catch-all `_ =>` in the `Op` match throws away the compiler's exhaustiveness guarantee — add a fifth operator later and it silently misbehaves. Match every variant explicitly.
- **Ignoring leftover tokens.** The `parser.pos != tokens.len()` guard turning into `TrailingInput` is the difference between a parser and a thing that accepts `1+2)`.

Senior signal in one sentence: *"precedence forces a tree, the tree is a recursive enum so it needs `Box`, and every failure is a `Result` variant, not a panic."*


## Candle Aggregator — Hand-Rolling a Lazy Streaming `Iterator`

### Summary

**What this topic covers**

You are handed a live market-data feed: an iterator of time-ordered `Tick`s (`ts`, `price`, `qty`). A chart or a strategy doesn't want raw prints — it wants *candles*: open/high/low/close plus total volume over a fixed time window. Your job is `candles(ticks, period)`, which turns that tick stream into a stream of `Candle`s, one per `period`-wide window (a tick at `ts` lands in bucket `start = (ts / period) * period`). The catch — and the whole kata — is that the result must be a **lazy `Iterator`**, not a `Vec`. You implement the `Iterator` trait *by hand*: define `type Item = Candle` and write `fn next(&mut self)`. This drills the signature Rust topic of **iterators as pull-based state machines**: generics over an input iterator, O(1) space over an unbounded stream, and adapter-style composition (`.map`, `.take`, `for`).

**Mental model**

An `Iterator` in Rust is not a collection — it's a *cursor with a `next` button*. Every `.map`, `.filter`, `.take` is a thin struct wrapping the upstream iterator; nothing runs until something calls `next()`. That's laziness: work is pulled through the chain one element at a time. Your `Candles` is exactly one of those wrapper structs. It owns the upstream iterator (`ticks: I`), the in-progress candle (`cur: Option<Candle>`), and one stashed tick (`pending: Option<Tick>`). `next()` is a little state machine: fold ticks into `cur` while they share a bucket; the instant you read a tick from the *next* window you can't un-read it, so stash it in `pending`, return the finished candle, and let that stashed tick open the next candle on the following call. When upstream returns `None`, flush the last `cur`, then `None`. That's the "peek by stashing one item" pattern — a `group-by` without `Peekable`.

**Key terms**

- **`Iterator` trait** — implement `type Item` + `fn next(&mut self) -> Option<Self::Item>`; everything else (`map`, `take`, `collect`) is free via default methods.
- **Lazy / pull-based** — nothing computes until `next()` is called; work flows one item at a time.
- **`IntoIterator`** — the trait for "can become an iterator"; `Vec`, arrays, ranges all impl it. Accepting it makes the API maximally general.
- **Generic over `I: Iterator<Item = Tick>`** — `Candles` is monomorphized per input type; zero dispatch cost, unlike `Box<dyn Iterator>`.
- **`Option::take`** — swaps an `Option` out for `None`, moving the value out of `&mut self` without cloning. The workhorse of `next`.
- **`or_else`** — lazily fall back: `self.pending.take().or_else(|| self.ticks.next())`.
- **Look-ahead / stash** — hold one already-read item (`pending`) because iterators can't be rewound.
- **O(1) space** — one candle + one tick in memory regardless of stream length.
- **Adapter composition** — `Candles` plugs into `.map`, `.take`, `for` because it *is* an `Iterator`.
- **Monomorphization** — the compiler generates a specialized `Candles<VecIntoIter>` etc. at each call site.

**Why interviewers ask this**

A junior reaches for `.collect()` into a `Vec`, groups it, returns `Vec<Candle>`. It passes the tests — and it's the wrong answer: eager, O(n) space, and it hangs forever on an unbounded feed. The senior signal is recognizing that "a stream of candles from a stream of ticks" *is* an `Iterator`, then implementing the trait by hand with the correct one-item look-ahead. It exercises whether you understand that Rust iterators are lazy state machines (not Python generators, not lists), whether you know to be generic over `IntoIterator` rather than concrete types, and whether you handle the two subtle boundaries: the window transition (stash the over-read tick) and the end-of-stream flush (emit the last partial candle exactly once). Getting `next()` to both compile against the borrow checker and be correct at those boundaries is the real test.

**Common confusions**

- "Just `collect` and group." → That defeats the point: eager, O(n) space, can't handle an infinite feed. The whole kata is *not* buffering.
- "Use `Peekable`." → Works, but the kata wants you to see the underlying mechanic: manually stashing one item in a field is the same idea, and it's what `Peekable` does internally.
- "The last candle gets dropped." → Only if you forget the flush: when upstream is `None`, `return self.cur.take()` emits the final partial window before the terminating `None`.
- "Iterators are like lists." → No — they're cursors. Nothing exists until pulled; `candles(...).next()` does the minimum work for one candle.

**What follows from this topic**

This is the gateway to Rust's iterator ecosystem: once you can implement `Iterator` by hand you understand what `map`/`filter`/`chunks`/`scan` actually *are*. The natural extension is an **extension trait** (`trait TickExt { fn candles(self, period) -> Candles<Self>; }`) so you write `ticks.candles(period)` fluent-style — exactly how `itertools` adds `chunk_by`. It connects to the tick-parser kata (zero-copy `&'a str` parsing feeds this aggregator) and to any streaming pipeline where holding the whole dataset in RAM is a non-starter.

### Clarify & design the API

Questions to surface up front — they pin down the ownership and the boundaries:

- **Ownership of ticks?** The aggregator *consumes* the stream, so it should **own** the upstream iterator by value (`ticks: I`), not borrow it. `next` takes `&mut self`.
- **How general an input?** Accept `IntoIterator<Item = Tick>` at the constructor, store the resulting `I::IntoIter`. That lets a `Vec`, `[Tick; N]`, a `.copied()` slice, or a channel drain all work.
- **Generic vs `dyn`?** Generic (`I: Iterator`) — monomorphized, zero dispatch, no allocation. A `Box<dyn Iterator>` would only be needed if you had to store heterogeneous sources in one field.
- **Windowing rule?** `start = (ts / period) * period`; candle covers `[start, start + period)`. Confirm ticks are time-ordered (they are) so a single stashed look-ahead suffices.
- **Edge policy?** Empty input → no candles. `period == 0` → panic (it's a programmer bug, not a runtime condition, so `assert!` not `Result`).

The shape:

```rust
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Tick { pub ts: u64, pub price: f64, pub qty: u64 }

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Candle {
    pub start: u64, pub open: f64, pub high: f64,
    pub low: f64, pub close: f64, pub volume: u64,
}

pub struct Candles<I: Iterator<Item = Tick>> {
    ticks: I,
    period: u64,
    pending: Option<Tick>,   // one tick of look-ahead
    cur: Option<Candle>,     // in-progress candle
}

pub fn candles<I: IntoIterator<Item = Tick>>(ticks: I, period: u64) -> Candles<I::IntoIter> {
    assert!(period > 0, "period must be > 0");
    Candles { ticks: ticks.into_iter(), period, pending: None, cur: None }
}
```

### Write the tests

Write these first — they nail the spec and, crucially, the two boundaries (window split, end flush) plus laziness. Run with `cargo test -p practice candles` (or `-p solution`).

```rust
#[cfg(test)]
mod tests {
    use super::*;
    fn tick(ts: u64, price: f64, qty: u64) -> Tick { Tick { ts, price, qty } }

    #[test]
    fn empty_stream_yields_no_candles() {
        let out: Vec<Candle> = candles(Vec::<Tick>::new(), 10).collect();
        assert!(out.is_empty());
    }

    #[test]
    fn single_window_ohlc_and_volume() {
        // open=first, close=last, high=max, low=min, volume=sum(qty)
        let ticks = vec![tick(0, 10.0, 1), tick(3, 12.0, 2), tick(9, 8.0, 3)];
        let out: Vec<Candle> = candles(ticks, 10).collect();
        assert_eq!(out, vec![Candle {
            start: 0, open: 10.0, high: 12.0, low: 8.0, close: 8.0, volume: 6,
        }]);
    }

    #[test]
    fn splits_into_windows_by_ts() {
        // Boundary test: a tick at ts=10 must close the [0,10) candle and open [10,20).
        // Note the gap — ts jumps 15 -> 23, so window [20,30) opens with a single tick.
        let ticks = vec![
            tick(0, 10.0, 1), tick(9, 8.0, 3),
            tick(10, 11.0, 1), tick(15, 9.0, 1),
            tick(23, 20.0, 5),
        ];
        let starts: Vec<u64> = candles(ticks, 10).map(|c| c.start).collect();
        assert_eq!(starts, vec![0, 10, 20]);
    }

    #[test]
    fn open_is_first_close_is_last() {
        let ticks = vec![tick(1,5.0,1), tick(2,7.0,1), tick(3,6.0,1), tick(4,4.0,1)];
        let out: Vec<Candle> = candles(ticks, 100).collect();
        assert_eq!(out.len(), 1);
        assert_eq!((out[0].open, out[0].close, out[0].high, out[0].low),
                   (5.0, 4.0, 7.0, 4.0));
    }

    #[test]
    fn is_lazy_and_composes_with_adapters() {
        // Pull ONE candle without consuming the tick in the next window.
        let ticks = vec![tick(0,1.0,1), tick(1,2.0,1), tick(10,3.0,1)];
        let first = candles(ticks, 10).next().unwrap();
        assert_eq!((first.start, first.close), (0, 2.0));
    }

    #[test]
    #[should_panic]
    fn zero_period_panics() { let _ = candles(vec![tick(0,1.0,1)], 0); }
}
```

What each catches: `empty_*` proves the flush doesn't emit a phantom candle; `single_window_*` locks the OHLC/volume fold; `splits_into_windows_*` is the **look-ahead/stash boundary** (the ts=10 tick must not be lost when it closes the previous candle) and the gap case; `open_is_first_close_is_last` guards the fold direction; `is_lazy_*` proves `next()` does minimal work and composes with `.map`; `zero_period_panics` pins the precondition. A missing end-flush fails `single_window_*` (drops the last candle); a lost stashed tick fails `splits_into_windows_*`.

### Implement it

`next` is the state machine. Pull from `pending` first (the stashed look-ahead), else from upstream; fold same-bucket ticks into `cur`; on a bucket change, stash and emit; on `None`, flush.

```rust
impl<I: Iterator<Item = Tick>> Iterator for Candles<I> {
    type Item = Candle;

    fn next(&mut self) -> Option<Candle> {
        loop {
            let tick = self.pending.take().or_else(|| self.ticks.next());
            match tick {
                Some(t) => {
                    let bucket = (t.ts / self.period) * self.period;
                    match &mut self.cur {
                        None => {
                            self.cur = Some(Candle {
                                start: bucket, open: t.price, high: t.price,
                                low: t.price, close: t.price, volume: t.qty,
                            });
                        }
                        Some(c) if c.start == bucket => {
                            c.high = c.high.max(t.price);
                            c.low = c.low.min(t.price);
                            c.close = t.price;
                            c.volume += t.qty;
                        }
                        Some(_) => {
                            // `t` belongs to a new window: stash it, emit the finished candle.
                            self.pending = Some(t);
                            return self.cur.take();
                        }
                    }
                }
                None => return self.cur.take(), // stream ended: flush last candle, then None
            }
        }
    }
}
```

Key points. **`Option::take` everywhere** — it moves `cur`/`pending` out of `&mut self` without cloning, and it's *self-terminating*: after the final flush, `cur` is `None`, so the next call reads `None` upstream and returns `None` forever. The **`loop`** matters because starting a fresh candle (`None` arm) must fall through to read the next tick, not return early. Complexity: **O(1) space** (one candle, one tick), O(1) amortized per `next`. Gotcha: match on `&mut self.cur` so the `Some(c) if ...` arm can mutate in place; the `Some(_)` arm proves the borrow ends before `self.pending = Some(t)`.

Extension — the fluent adapter via an extension trait:

```rust
pub trait TickExt: Iterator<Item = Tick> + Sized {
    fn candles(self, period: u64) -> Candles<Self> { candles(self, period) }
}
impl<I: Iterator<Item = Tick>> TickExt for I {}
// now: ticks.into_iter().candles(60).take(10)
```

### Common mistakes & senior signal

- **Eager `collect` + group** — the README's headline trap. It's O(n) space and can't run on an unbounded feed. Senior move: recognize the output *is* an `Iterator` and implement the trait.
- **Dropping the final partial candle** — forgetting the `None => self.cur.take()` flush. The last window never gets a "next-window tick" to close it, so the end-of-stream *is* its close signal.
- **Losing the boundary tick** — reading the next-window tick and folding or discarding it. It must be stashed in `pending` and re-read next call. This is the one-item look-ahead; without it every window boundary corrupts a candle.
- **Reaching for `Box<dyn Iterator>`** — unnecessary allocation and dynamic dispatch. Generics monomorphize to zero-cost specialized types; use `dyn` only when you genuinely need to store heterogeneous iterator types behind one field.
- **`Result` for `period == 0`** — it's a caller bug, not a recoverable condition; `assert!`/panic is the idiomatic choice, matching how slice indexing panics on out-of-bounds.
- **Not being generic at the boundary** — taking `Vec<Tick>` instead of `IntoIterator<Item = Tick>`. The senior signature accepts anything tick-yielding and stores `I::IntoIter`.

The senior signal in one line: an owned, generic, hand-written `Iterator` with correct one-item look-ahead and an explicit end-flush — laziness and O(1) space treated as the *requirement*, not an optimization.


## Event Bus — Trait Objects & Dynamic Dispatch (`Box<dyn Fn>`)

### Summary

**What this topic covers**

You build a synchronous publish/subscribe `EventBus` — the observer pattern. Subscribers register a handler under a *topic*; publishing an `Event` to that topic invokes every handler registered for it, in subscription order. Publishers don't know who listens, subscribers don't know who sends. The signature Rust topic this drills is **traits & dispatch**: how do you store handlers of *wildly different shapes* — a logger, a counter, an accumulator, each a distinct closure with distinct captured state — side by side in one list? The answer is **type erasure via trait objects**: `Box<dyn Fn(&Event)>`. The kata forces the `dyn` vs generics decision, the `Fn`/`FnMut`/`FnOnce` closure-trait choice, and closure capture — the core of Rust's function-value story.

**Mental model**

Every closure in Rust has its own *anonymous, unique* type — two closures that capture different variables are as unrelated as `i32` and `String` to the type system. So `Vec<F>` for a generic `F: Fn` is **homogeneous**: it can hold many copies of *one* closure type, never two different ones. To put a logger and a counter in the same `Vec`, you must **erase** their concrete types. `Box<dyn Fn(&Event)>` does exactly that: it's a **fat pointer** — (data pointer, vtable pointer) — that forgets what the closure *is* and remembers only that it's callable as `Fn(&Event)`. The vtable holds the address of the closure's `call` implementation, so `publish` dispatches through it (dynamic dispatch). The senior insight is the *boundary*: stay generic at the call site (`subscribe<F: Fn>`, static, inlinable, ergonomic) and erase to `dyn` only in *storage*. Generics at the edge, trait objects in the container.

**Key terms**

- **trait object** — `dyn Trait` behind a pointer (`Box<dyn Fn>`, `&dyn Fn`); a fat pointer of (data, vtable) that erases the concrete type.
- **`Box<dyn Fn(&Event)>`** — a heap-allocated, type-erased handler; the storage type that lets heterogeneous closures share a `Vec`.
- **static dispatch** — generic `F` monomorphised at compile time; call is inlined, zero indirection, but storage is pinned to one concrete type.
- **dynamic dispatch** — the call goes through the vtable; one indirect call + a heap allocation per handler, but accepts a mixed bag.
- **monomorphisation** — the compiler stamps out a separate copy of a generic per concrete type used; why `Vec<F>` can't be heterogeneous.
- **`Fn` / `FnMut` / `FnOnce`** — closure traits: callable via `&self` repeatedly / via `&mut self` / by consuming `self` once. `publish(&self)` needs `Fn`.
- **`+ 'static`** — the closure's captured data must outlive the bus (no borrowed short-lived references captured).
- **closure capture** — a closure that captures state is a *value*; `move` moves the captures into it so it can be boxed and stored.
- **interior mutability** — `Rc<RefCell<T>>` / `Rc<Cell<T>>`, needed to observe handler side effects since `Fn` can't mutate captures directly.
- **vtable** — the per-type table of method pointers the trait-object pointer references; where `publish` finds each handler's code.

**Why interviewers ask this**

It cleanly separates people who've *read* about trait objects from people who've *shipped* them. A junior reaches for a generic `subscribe<F>` and then can't explain why the second, differently-typed subscriber won't compile — they hit "expected closure, found a different closure" and get stuck. A senior states up front: closures have unique types, so storage must erase to `Box<dyn Fn>`, and articulates the tradeoff (heap + vtable indirection vs. accepting arbitrary listeners) as an *enabling* choice, not a regret. They also nail the closure-trait choice — `Fn` because `publish` fires repeatedly through `&self` — and know that observing side effects requires interior mutability. It's a compact test of ownership, generics-vs-erasure, and the closure model all at once.

**Common confusions**

- "Just use `Vec<F>` with a generic `F`." → It's homogeneous; two different closures are two different types and won't coexist. You need `dyn`.
- "`dyn Fn` is slower so avoid it." → For a bus whose *job* is holding arbitrary handlers, static dispatch literally can't express the requirement. Dynamic dispatch is the enabler, not a compromise.
- "Handlers should be `FnMut` so they can update state." → That forces `publish(&mut self)` and serialises all publishes. Keep `Fn` and capture `Rc<Cell/RefCell>` for mutation.
- "The closure borrows my local, that's fine." → Without `move` + `'static` it captures a reference that won't outlive the bus; won't compile.

**What follows from this topic**

The same trait-object machinery recurs across the katas: `Box<dyn Subscriber>` with a named trait (adds an id for unsubscribe), `Box<dyn Error>` for error type erasure, and the `dyn` vs generic vs `enum`-dispatch decision in any plugin/strategy design. The extension — a subscription **handle** that unsubscribes on `Drop` (RAII) — bridges to ownership/`Drop` katas, and making the bus generic (`EventBus<E>`) revisits the generics-vs-erasure boundary. Contrast with the closed-set alternative: an `enum Handler { Logger, Counter(..) }` dispatched by `match` stays fully static (no heap, no vtable) but can't accept arbitrary user closures — the exact tradeoff `dyn` buys you out of.

### Clarify & design the API

Questions to ask before typing: *Is dispatch synchronous* (handler runs inline on `publish`) or queued? Here, synchronous. *Can handlers mutate shared state?* Only through interior mutability — `Fn` is read-only over `&self`. *Order guarantee?* Yes, subscription order per topic. *Do we need unsubscribe?* Base kata no; it's the extension.

The **ownership decision** is the whole design:
- Handlers have distinct anonymous types → storage must be **type-erased**: `Box<dyn Fn(&Event)>`.
- Closure trait: `publish(&self)` calls each handler repeatedly through a shared reference → **`Fn`** (not `FnMut`/`FnOnce`).
- Generic at the *call site* (`subscribe<F: Fn + 'static>`), erased in *storage* — best ergonomics + heterogeneous container.
- `subscribe` mutates the map → `&mut self`; `publish` and `subscriber_count` only read → `&self`.

```rust
pub struct Event { pub topic: String, pub payload: i64 }

type Handler = Box<dyn Fn(&Event)>;      // type-erased: the enabling choice

#[derive(Default)]
pub struct EventBus {
    handlers: HashMap<String, Vec<Handler>>,  // topic -> ordered handlers
}

impl EventBus {
    pub fn new() -> Self { Self::default() }
    pub fn subscribe<F: Fn(&Event) + 'static>(&mut self, topic: &str, handler: F);
    pub fn publish(&self, event: &Event);
    pub fn subscriber_count(&self, topic: &str) -> usize;
}
```

`subscribe<F>` is generic (static dispatch, inlinable) at the boundary and boxes `F` into `dyn Fn` internally — generics at the edge, erasure in the container.

### Write the tests

Write these first. The key trick: `Fn` handlers can't mutate captures directly, so to *observe* that a handler fired, capture shared interior-mutable state — `Rc<RefCell<Vec<_>>>` to record order, `Rc<Cell<u32>>` to count. Each `move` closure clones the `Rc` so the bus owns one handle and the test keeps another.

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::{Cell, RefCell};
    use std::rc::Rc;

    // Basic contract: subscribe then publish invokes the handler with the payload.
    #[test]
    fn subscribe_then_publish_invokes_the_handler() {
        let seen = Rc::new(RefCell::new(Vec::new()));
        let mut bus = EventBus::new();
        let sink = Rc::clone(&seen);
        bus.subscribe("prices", move |e| sink.borrow_mut().push(e.payload));
        bus.publish(&Event { topic: "prices".into(), payload: 42 });
        assert_eq!(*seen.borrow(), vec![42]);
    }

    // Core behaviour: many *different* closures on one topic all fire, in order.
    // This is the test that only compiles because storage is Box<dyn Fn>.
    #[test]
    fn multiple_handlers_fire_in_subscription_order() {
        let order = Rc::new(RefCell::new(Vec::new()));
        let mut bus = EventBus::new();
        for id in 0..3 {                       // each iteration = a distinct closure type
            let sink = Rc::clone(&order);
            bus.subscribe("t", move |_e| sink.borrow_mut().push(id));
        }
        bus.publish(&Event { topic: "t".into(), payload: 0 });
        assert_eq!(*order.borrow(), vec![0, 1, 2]);
    }

    // Isolation: a handler only fires for its own topic.
    #[test]
    fn a_handler_only_fires_for_its_topic() {
        let hits = Rc::new(Cell::new(0u32));
        let mut bus = EventBus::new();
        let c = Rc::clone(&hits);
        bus.subscribe("wanted", move |_e| c.set(c.get() + 1));
        bus.publish(&Event { topic: "other".into(),  payload: 0 });
        assert_eq!(hits.get(), 0);
        bus.publish(&Event { topic: "wanted".into(), payload: 0 });
        assert_eq!(hits.get(), 1);
    }

    // Edge: publishing to an empty topic is a no-op, not a panic.
    #[test]
    fn publish_with_no_subscribers_is_a_no_op() {
        let bus = EventBus::new();
        bus.publish(&Event { topic: "nobody-home".into(), payload: 7 }); // must not panic
    }

    // subscriber_count reflects registrations; 0 for absent topics.
    #[test]
    fn subscriber_count_reflects_registrations() {
        let mut bus = EventBus::new();
        assert_eq!(bus.subscriber_count("t"), 0);
        bus.subscribe("t", |_e| {});
        bus.subscribe("t", |_e| {});
        bus.subscribe("u", |_e| {});
        assert_eq!(bus.subscriber_count("t"), 2);
        assert_eq!(bus.subscriber_count("absent"), 0);
    }
}
```

What each catches: the order test is load-bearing — it wouldn't *compile* with `Vec<F>` because the three `move |_e| ... id` closures are three types; it proves the erasure works. The topic-isolation test catches a naive `publish` that fires all handlers regardless of topic. The no-subscribers test catches an unguarded `HashMap` lookup that would `unwrap`/panic. Run with `cargo test -p solution eventbus`.

### Implement it

The implementation is small once the ownership call is made — the design *is* the type. Store `HashMap<String, Vec<Box<dyn Fn(&Event)>>>`. `subscribe` takes generic `F`, boxes it (erasing the type), and pushes onto the topic's list via `entry(...).or_default()` so a new topic auto-creates an empty `Vec`. `publish` looks up the list and calls each through the vtable; the `if let Some` guard makes an unknown topic a no-op.

```rust
use std::collections::HashMap;

pub struct Event { pub topic: String, pub payload: i64 }
type Handler = Box<dyn Fn(&Event)>;

#[derive(Default)]
pub struct EventBus { handlers: HashMap<String, Vec<Handler>> }

impl EventBus {
    pub fn new() -> Self { EventBus { handlers: HashMap::new() } }

    pub fn subscribe<F: Fn(&Event) + 'static>(&mut self, topic: &str, handler: F) {
        self.handlers
            .entry(topic.to_string())
            .or_default()
            .push(Box::new(handler));   // erase F -> dyn Fn at the storage boundary
    }

    pub fn publish(&self, event: &Event) {
        if let Some(list) = self.handlers.get(&event.topic) {  // unknown topic = no-op
            for handler in list { handler(event); }            // indirect call via vtable
        }
    }

    pub fn subscriber_count(&self, topic: &str) -> usize {
        self.handlers.get(topic).map_or(0, Vec::len)
    }
}
```

Complexity: `subscribe` amortised O(1), `publish` O(k) for k handlers on the topic, `subscriber_count` O(1). The `+ 'static` bound is what makes `Box::new(handler)` sound — the boxed closure can't outlive borrowed data because it captures none. The key gotcha to *name* in interview: dispatch has a per-handler heap allocation and a vtable indirection; that's the cost of accepting arbitrary listeners, and it's the right trade for a decoupling primitive.

Unsubscribe extension: return a `SubId(u64)` from `subscribe` and store `Vec<(SubId, Handler)>`; `unsubscribe(id)` retains all but that id. RAII variant: hand back a guard struct whose `Drop` calls `unsubscribe` — but that needs shared ownership of the bus (`Rc<RefCell<Inner>>`) since the guard must mutate the bus when dropped.

### Common mistakes & senior signal

The README's real trap: reaching for `Vec<F>` with a generic `F` and being unable to add a second, differently-shaped handler. Junior symptom: fighting "expected closure, found a different closure" and trying to name the closure type. Senior move: state immediately that closures have unique anonymous types, so storage must erase to `Box<dyn Fn(&Event)>`, and explain the fat-pointer/vtable mechanics without hand-waving.

Other pitfalls and the senior response:
- **Wrong closure trait.** Choosing `FnMut` "so handlers can mutate" forces `publish(&mut self)` and serialises publishes. Senior keeps `Fn` + interior mutability (`Rc<Cell/RefCell>`) — and can say *why*.
- **Missing `+ 'static`.** Boxing a closure that borrows a local won't compile. Senior adds `'static` and explains it bounds captured data's lifetime; use `move` to take ownership of captures.
- **Panicking on unknown topic.** Unguarded `self.handlers[&topic]` or `.get(..).unwrap()` panics. Senior uses `if let Some(..)` / `map_or(0, ..)` for the no-subscribers no-op.
- **Not articulating the tradeoff.** The signal isn't just *using* `dyn` — it's framing dynamic dispatch as the *enabling* choice and knowing the alternatives: `Box<dyn Subscriber>` (named trait, gives you an id for unsubscribe) or `enum Handler { .. }` + `match` (fully static, no heap/vtable) when the handler set is closed. Choosing correctly for the constraints is the senior signal.


## LRU Cache — The Doubly-Linked-List Ownership Problem

### Summary

**What this topic covers**

You build a fixed-capacity `LruCache<K, V>`: a bounded cache in front of a slow store that holds at most `capacity` entries and, when full, evicts the one nobody has touched in the longest — every operation O(1). A `get` hit returns the value *and* marks the key most-recently-used; `put` inserts or updates and evicts the least-recently-used entry on overflow; `peek` reads without touching recency. The signature Rust topic this drills is **ownership in a linked data structure**. O(1) LRU classically wants a hash map for lookup plus a doubly-linked list you can splice a node out of and re-insert at the front. In C++/Java that's a couple of pointer swaps. In safe Rust it's the canonical "fight the borrow checker" problem, and the way you win — an index-based arena instead of pointers — is the whole lesson.

**Mental model**

A node in a doubly-linked list is pointed at from two directions — its `prev` and its `next` — so it has *two owners*. Rust's ownership model allows exactly one. That single fact kills the direct port of the pointer design. The naive rescue, `Rc<RefCell<Node>>` with `Weak` back-links, compiles but is painful: every field touch becomes a runtime `borrow_mut()` that can panic, `Weak::upgrade` clutters the logic, and you pay a refcount + interior-mutability tax on the hot path. The idiomatic answer is to **stop using pointers**. Store nodes in a `Vec<Entry>` — an arena / slab — and make the "pointers" `usize` indices into that vec. `prev`/`next`/`head`/`tail` become `Option<usize>`. Moving a node to the front is the same unlink-then-relink surgery, but now it's a handful of bounds-checked index writes the borrow checker is completely happy with. No `unsafe`, no `Rc`, no `RefCell`. You've traded the compiler's aliasing rules for your own bookkeeping.

**Key terms**

- **ownership** — each value has exactly one owner; a DLL node needs two, which is why the pointer design won't compile in safe Rust.
- **arena / slab** — a `Vec<Entry>` that owns all nodes; the vec is the single owner, indices are cheap non-owning references into it.
- **`usize` index as pointer** — replaces `&Node`/`*mut Node`; bounds-checked, `Copy`, no lifetime, no aliasing constraint.
- **free-list** — a `Vec<usize>` of reclaimed slots so eviction recycles a slot instead of shrinking the vec, keeping stored indices stable.
- **`Rc<RefCell<T>>`** — shared ownership + interior mutability; the "it compiles but hurts" alternative, with runtime borrow panics.
- **`Weak<T>`** — non-owning back-reference used to break `Rc` cycles (the `prev` link); needs `.upgrade()` on every use.
- **`&mut self`** — exclusive borrow; `get` needs it because a read mutates recency order.
- **generics + trait bounds** — `LruCache<K, V>` with `K: Hash + Eq + Clone`; `Clone` because eviction needs the tail's key to remove its map row.
- **`Option::take`** — swap a value out leaving `None`; handy when moving links around.
- **intrusive list** — the links live *inside* the stored `Entry`, not in separate node allocations.

**Why interviewers ask this**

LRU is the classic "do you actually understand Rust ownership, or did you just learn the syntax" filter. A junior reaches for `Rc<RefCell<Node>>` because it's the mechanical translation of the C++ pointer design, then drowns in `borrow_mut()` panics and `Weak` upgrades and often can't finish. A senior recognises within a minute that the pointer DLL doesn't port, states *why* (two owners, one allowed), and pivots to the arena/index design without being prompted — because it sidesteps the borrow checker entirely rather than wrestling it. The follow-ups probe depth: why does `get` take `&mut self`? (a read reorders the list, so a read is a write). Why `K: Clone`? (eviction needs the tail key to delete the map row). How do indices stay valid across eviction? (free-list recycles slots, the vec never shifts). Getting these right signals you think in ownership, not just syntax.

**Common confusions**

- *"`get` should be `&self` — it's a read."* No: a hit moves the key to most-recently-used, mutating the recency list. It's `&mut self`. `peek` is the `&self` version that leaves recency alone.
- *"`Rc<RefCell>` is the Rust way to do linked lists."* It compiles, but it's the painful path: runtime borrow panics and a refcount tax. Indices are the idiomatic answer.
- *"Removing an entry from the vec keeps indices valid."* `Vec::remove` shifts everything after it, invalidating every stored index. Use a free-list and recycle slots instead of removing.
- *"Updating an existing key grows `len`."* No — an update overwrites in place and marks MRU; `len` only grows on genuinely new keys.

**What follows from this topic**

The arena/index pattern generalises to any graph in safe Rust — trees with parent pointers, adjacency lists, ECS storage — wherever the pointer design would demand shared ownership. The thread-safe extension (wrap in a `Mutex`, noting an `RwLock` read guard is *not* enough because `get` needs `&mut`) leads into `Arc<Mutex<T>>` and the shared-state concurrency katas. Per-entry TTL turns it into a time-aware cache. In production you'd reach for the `lru` crate or `hashlink::LinkedHashMap`, both of which package exactly this arena-list design behind a safe API.

### Clarify & design the API

Questions to nail before writing anything: **What's the eviction policy on update — does re-`put`ting an existing key count as a use?** (Yes: it marks MRU and must not grow `len`.) **Is `get` allowed to mutate?** (It must — recency is state.) **What happens at `capacity == 0`?** (Panic; a zero-capacity cache is a call-site bug.) **Do we return owned values or references?** (References — `Option<&V>` — the cache retains ownership.)

The load-bearing decision is **ownership of the recency list**. State it out loud: a doubly-linked list needs two owners per node, which safe Rust forbids, so I will *not* use pointers or `Rc<RefCell>`. Instead, an arena of `usize` indices.

```rust
use std::collections::HashMap;
use std::hash::Hash;

struct Entry<K, V> {
    key: K,               // kept here too: eviction needs it to delete the map row
    value: V,
    prev: Option<usize>,  // "pointers" are indices into `slab`
    next: Option<usize>,
}

pub struct LruCache<K, V> {
    map: HashMap<K, usize>,    // key -> slab index, O(1) lookup
    slab: Vec<Entry<K, V>>,    // the arena; owns every node
    free: Vec<usize>,          // reclaimed slots for reuse
    head: Option<usize>,       // most-recently-used
    tail: Option<usize>,       // least-recently-used (eviction end)
    capacity: usize,
}

impl<K: Hash + Eq + Clone, V> LruCache<K, V> {
    pub fn new(capacity: usize) -> Self;          // panic if capacity == 0
    pub fn get(&mut self, key: &K) -> Option<&V>; // &mut: a hit reorders recency
    pub fn put(&mut self, key: K, value: V);      // insert/update; evict LRU on overflow
    pub fn peek(&self, key: &K) -> Option<&V>;    // &self: read, no reordering
    pub fn len(&self) -> usize;
    pub fn is_empty(&self) -> bool;
    pub fn capacity(&self) -> usize;
}
```

`K: Hash + Eq` for the map key; `Clone` specifically so eviction can copy the tail's key out of the slab to remove its map row.

### Write the tests

Write these first — they pin the contract and surface the tricky bits (recency reordering, in-place update, slot reuse) before you touch the implementation. Run with `cargo test -p solution lru`.

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn put_then_get_round_trips() {
        let mut cache: LruCache<i32, &str> = LruCache::new(2);
        cache.put(1, "one");
        cache.put(2, "two");
        assert_eq!(cache.get(&1), Some(&"one"));
        assert_eq!(cache.get(&2), Some(&"two"));
        assert_eq!(cache.get(&3), None); // miss returns None
    }

    #[test]
    fn evicts_least_recently_used_when_over_capacity() {
        let mut cache: LruCache<i32, &str> = LruCache::new(2);
        cache.put(1, "one");
        cache.put(2, "two");
        cache.put(3, "three");            // key 1 (oldest) evicted
        assert_eq!(cache.get(&1), None);
        assert_eq!(cache.get(&2), Some(&"two"));
        assert_eq!(cache.len(), 2);
    }

    #[test]
    fn get_updates_recency_so_a_different_key_is_evicted() {
        let mut cache: LruCache<i32, &str> = LruCache::new(2);
        cache.put(1, "one");
        cache.put(2, "two");
        assert_eq!(cache.get(&1), Some(&"one")); // touch 1 -> now MRU, 2 is LRU
        cache.put(3, "three");                   // evicts 2, NOT 1
        assert_eq!(cache.get(&2), None);
        assert_eq!(cache.get(&1), Some(&"one"));
    }

    #[test]
    fn updating_existing_key_does_not_grow_len_and_marks_mru() {
        let mut cache: LruCache<i32, &str> = LruCache::new(2);
        cache.put(1, "one");
        cache.put(2, "two");
        cache.put(1, "ONE");                     // update in place: len stays 2, 1 -> MRU
        assert_eq!(cache.len(), 2);
        assert_eq!(cache.peek(&1), Some(&"ONE"));
        cache.put(3, "three");                   // evicts 2, not the updated 1
        assert_eq!(cache.get(&2), None);
        assert_eq!(cache.get(&1), Some(&"ONE"));
    }

    #[test]
    fn peek_does_not_change_recency() {
        let mut cache: LruCache<i32, &str> = LruCache::new(2);
        cache.put(1, "one");
        cache.put(2, "two");
        assert_eq!(cache.peek(&1), Some(&"one")); // peek the oldest: no reorder
        cache.put(3, "three");                    // 1 still LRU -> evicted
        assert_eq!(cache.get(&1), None);
    }

    #[test]
    fn eviction_keeps_len_at_capacity_and_reuses_slots() {
        let mut cache: LruCache<i32, i32> = LruCache::new(2);
        for i in 0..10 {
            cache.put(i, i * 10);
            assert!(cache.len() <= 2); // free-list exercised on every put past 2
        }
        assert_eq!(cache.get(&8), Some(&80));
        assert_eq!(cache.get(&9), Some(&90));
        assert_eq!(cache.get(&7), None);
    }

    #[test]
    #[should_panic]
    fn zero_capacity_panics() {
        let _: LruCache<i32, i32> = LruCache::new(0);
    }
}
```

What each catches: `get_updates_recency…` is the one that proves your list surgery is correct (naive implementations that only reorder on `put` fail it). `updating_existing_key…` catches the `len`-growth bug and the "update didn't mark MRU" bug in one shot. `eviction_keeps_len…reuses_slots` hammers the free-list so a slot-recycling bug (stale index, double-alloc) shows up. `#[should_panic]` documents the `capacity == 0` contract without a custom error type.

### Implement it

The whole implementation is index surgery over the slab. Two private helpers — `unlink` and `move_to_front` — carry the linked-list logic; `alloc` and the free-list carry slot lifecycle.

```rust
impl<K: Hash + Eq + Clone, V> LruCache<K, V> {
    pub fn new(capacity: usize) -> Self {
        assert!(capacity > 0, "LruCache capacity must be greater than 0");
        LruCache {
            map: HashMap::with_capacity(capacity),
            slab: Vec::with_capacity(capacity),
            free: Vec::new(),
            head: None, tail: None, capacity,
        }
    }

    pub fn get(&mut self, key: &K) -> Option<&V> {
        let idx = *self.map.get(key)?;   // ? on Option: miss -> None
        self.move_to_front(idx);         // a read is a write
        Some(&self.slab[idx].value)
    }

    pub fn peek(&self, key: &K) -> Option<&V> {
        let idx = *self.map.get(key)?;
        Some(&self.slab[idx].value)      // no reordering
    }

    pub fn put(&mut self, key: K, value: V) {
        if let Some(&idx) = self.map.get(&key) {
            self.slab[idx].value = value;    // update in place, don't grow len
            self.move_to_front(idx);
            return;
        }
        if self.map.len() == self.capacity {
            self.evict_lru();
        }
        let idx = self.alloc(Entry { key: key.clone(), value, prev: None, next: self.head });
        if let Some(old_head) = self.head {
            self.slab[old_head].prev = Some(idx);
        }
        self.head = Some(idx);
        if self.tail.is_none() { self.tail = Some(idx); }
        self.map.insert(key, idx);
    }

    fn move_to_front(&mut self, idx: usize) {
        if self.head == Some(idx) { return; } // already MRU
        self.unlink(idx);
        self.slab[idx].prev = None;
        self.slab[idx].next = self.head;
        if let Some(old_head) = self.head { self.slab[old_head].prev = Some(idx); }
        self.head = Some(idx);
    }

    fn unlink(&mut self, idx: usize) {
        let (prev, next) = (self.slab[idx].prev, self.slab[idx].next);
        match prev { Some(p) => self.slab[p].next = next, None => self.head = next }
        match next { Some(n) => self.slab[n].prev = prev, None => self.tail = prev }
    }

    fn evict_lru(&mut self) {
        let Some(idx) = self.tail else { return }; // let-else guard clause
        self.unlink(idx);
        let key = self.slab[idx].key.clone(); // Clone bound earns its keep here
        self.map.remove(&key);
        self.free.push(idx);                  // recycle the slot, don't shrink the vec
    }

    fn alloc(&mut self, entry: Entry<K, V>) -> usize {
        if let Some(idx) = self.free.pop() {
            self.slab[idx] = entry;           // drops the dead entry in the recycled slot
            idx
        } else {
            self.slab.push(entry);
            self.slab.len() - 1
        }
    }
}
```

Every operation is O(1) amortised: `HashMap` lookup, then a fixed number of index writes. The gotcha you're avoiding by construction: **never `Vec::remove` a slot** — it shifts every later element and invalidates all the indices the map is holding. The free-list is what makes indices stable for the life of an entry. Note the `let-else` in `evict_lru` and `?` on `Option` in `get`/`peek` — idiomatic early-return control flow, no nesting.

### Common mistakes & senior signal

The README's real trap is reaching for the pointer design and its `Rc<RefCell<Node>>` translation. It *compiles*, which is the seduction — then `borrow_mut()` panics at runtime when a splice transiently aliases a node, and you're debugging interior-mutability instead of shipping. The senior move is to never go there: recognise "DLL node has two owners, safe Rust allows one" and pivot to the arena the moment you see the problem.

Other pitfalls and the senior counter-move:

- **`get` as `&self`.** Betrays that you think a cache read is pure. It reorders recency — `&mut self`. Provide `peek` as the honest `&self` read.
- **`Vec::remove` on eviction.** Invalidates every stored index. Seniors use a free-list and recycle slots; the vec never shifts.
- **Update growing `len`.** Re-`put`ting an existing key must overwrite in place and mark MRU, not insert a second row. Test it explicitly.
- **Forgetting `head`/`tail` edge cases.** Evicting the last entry, moving the sole node to front, inserting into an empty cache — the `Option<usize>` match arms in `unlink` handle these; a pointer version tends to null-deref them.
- **Over-reaching for `unsafe`.** This kata needs none. Reaching for `unsafe` or raw pointers here is a red flag, not sophistication — the index design is safe *and* fast.
- **Not stating the bounds rationale.** A senior explains `K: Clone` is there so eviction can lift the tail key out to delete the map row, and that `V` needs no bound because the cache only moves and references it.


## Order State Machine — Enums, Exhaustive `match` & the Typestate Escape Hatch

### Summary

**What this topic covers**

An order on a matching engine walks a fixed lifecycle: `New` → `Accepted` → fills → `Filled`, or bails out to `Cancelled`/`Rejected` along the way. You model each stage as an `enum` variant that *carries its own data* (`PartiallyFilled { filled, total }` knows how far along it is), and you write one function — `apply(self, event) -> Result<OrderState, TransitionError>` — that *is* the entire transition table, expressed as a single `match` on `(state, event)`. The signature Rust topic this drills is **enums + exhaustive pattern matching**: a closed set of states named exactly, with the compiler auditing that every state handles every event. The secondary theme is **move semantics as state encoding** (consuming `self`), and the extension is the **typestate pattern** — pushing the state into the *type system* so illegal transitions fail to compile at all.

**Mental model**

A state machine is a function from `(state, event)` to `state-or-error`. In Rust the states are not strings or `int` constants — they are variants of an `enum`, and each can hold exactly the fields that stage needs. The transition table is `match (self, event) { … }`. The key insight: Rust `match` is **exhaustive** — the compiler refuses to build until every reachable `(state, event)` combination is covered. So the illegal-transition table isn't a comment you hope stays in sync; it's code the compiler audits. Add a seventh state tomorrow (`Suspended`) and the crate won't compile until you decide what every event does to it. Second insight: `apply` takes `self` **by value**, so transitioning *moves the old state out of existence*. You physically cannot feed a stale `Accepted` handle a second fill after it reached `Filled` — the borrow checker consumed it. "A state, once left, is gone" becomes a compile-time fact, not a convention.

**Key terms**

- **enum with data** — each variant (`New { total }`, `PartiallyFilled { filled, total }`) carries its own fields; no invalid combination is representable.
- **exhaustive match** — the compiler requires every possible value be handled; forgetting a state is a build error, not a runtime bug.
- **tuple match** — `match (self, event)` matches on both at once, so the arm names the exact transition.
- **move / consume `self`** — `apply(self, …)` takes ownership; the old state is unusable afterward.
- **`Result<T, E>`** — legal transition → `Ok(next)`, illegal → `Err(TransitionError)`; callers `?` or `match` it.
- **custom error enum** — `TransitionError` implements `std::error::Error` (via `Display` + `Error`), so it composes with `?` and `Box<dyn Error>`.
- **`#[non_exhaustive]`** — marks the error enum so a new variant isn't a breaking change; downstream matches must keep a wildcard `_` arm.
- **terminal state** — `Filled`/`Cancelled`/`Rejected` accept no events; every event returns `Err`.
- **binding vs `..`** — `New { total }` binds the field; `New { .. }` ignores fields when the arm doesn't need them.
- **typestate** — the extension: each state is its own *type* (`Order<Filled>`), so illegal transitions are compile errors, not runtime `Err`s.

**Why interviewers ask this**

It separates people who reach for a `status: String` and a wall of `if`s from people who let the type system do the auditing. A junior writes a `match` with a catch-all `_ => panic!("impossible")` and moves on. A senior knows the catch-all is exactly what you *don't* want for the state axis — an unhandled state should be a compile error, so you match states explicitly and only fold the *illegal pairs* into a final `(state, event) => Err(...)`. The senior also takes `self` by value on purpose (encoding "old state is gone"), returns a domain error enum rather than a bare `bool`/`Option`, marks it `#[non_exhaustive]`, and can articulate when to escalate to typestate. The money angle sharpens it: an illegal transition that slips through is a double fill or a payout against a cancelled order — so "you cannot leave a terminal state" must be enforced by the compiler and the `Result`, not by a comment.

**Common confusions**

- *"Just use a catch-all `_` arm for unknown states."* → That defeats exhaustiveness. Match each state; a new variant should break the build so you're forced to handle it.
- *"`apply` should take `&mut self`."* → Taking `self` by value is deliberate: it moves the old state out, so a stale handle can't be reused. `&mut self` would leave the old handle alive.
- *"Overfill and illegal-transition are the same error."* → They're distinct variants so callers can react differently (retry vs reject); that's the point of a custom enum over `bool`.
- *"Typestate is strictly better."* → Only when the state set is fixed at compile time. Typestate can't hold a state chosen at runtime (from a wire message), and it fans out into many types.

**What follows from this topic**

The tuple-`match`-as-transition-table shape recurs anywhere you have a closed protocol: a `circuitbreaker`'s Closed/Open/HalfOpen, a TCP-style handshake, a parser's modes. The `Result` + custom error + `?` discipline is the same you'd use in `rust-calc` (parse errors) and any kata with fallible operations. The typestate extension connects to the builder pattern and to session types; and the "make illegal states unrepresentable" mantra is the through-line from here to zero-cost abstractions across the Rust katas.

### Clarify & design the API

Questions worth asking before touching the keyboard: *Is the state set closed and known at compile time?* (Yes → enum is right; if states arrive from config/wire, enum beats typestate.) *Should a transition mutate in place or produce a new state?* *Are illegal transitions errors or panics?* (Errors — this is risk-controlling code.) *Do fills accumulate?* (Yes — `PartiallyFilled` carries running `filled`.)

The ownership decision is the design here. `apply` takes **`self` by value**, not `&mut self`: consuming the old state moves it out of existence, so a stale handle can't be fed a second event — the compiler enforces "once you leave a state it's gone." The return is `Result<OrderState, TransitionError>` so illegal pairs are recoverable `Err`s a caller can `?`.

```rust
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum OrderState {
    New { total: u64 },
    Accepted { total: u64 },
    PartiallyFilled { filled: u64, total: u64 },
    Filled, Cancelled, Rejected,           // terminal
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Event { Accept, Fill { qty: u64 }, Cancel, Reject }

#[derive(Debug, Clone, PartialEq, Eq)]
#[non_exhaustive]                          // add failure modes without breaking callers
pub enum TransitionError {
    IllegalTransition { state: OrderState, event: Event },
    Overfill { filled: u64, qty: u64, total: u64 },
}

impl OrderState {
    pub fn apply(self, event: Event) -> Result<OrderState, TransitionError> { /* … */ }
}
```

Each variant carries only its stage's data, so an "impossible" combination (`Filled { filled }`) is *unrepresentable* — the strongest form of validation.

### Write the tests

This is the heart: the transition table is a spec, so the tests *are* the requirements written as `assert_eq!`. Cover the full happy path, the exact one-shot fill, every cancel/reject entry, both `Overfill` cases, and — critically — that **every** terminal state rejects **every** event. Run with `cargo test -p practice orderstate` (or `-p solution`).

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn full_happy_path() {
        let s = OrderState::New { total: 10 };
        let s = s.apply(Event::Accept).unwrap();
        assert_eq!(s, OrderState::Accepted { total: 10 });
        let s = s.apply(Event::Fill { qty: 4 }).unwrap();
        assert_eq!(s, OrderState::PartiallyFilled { filled: 4, total: 10 });
        let s = s.apply(Event::Fill { qty: 6 }).unwrap();   // exactly closes it
        assert_eq!(s, OrderState::Filled);
    }

    #[test]
    fn overfill_is_rejected() {
        let s = OrderState::PartiallyFilled { filled: 8, total: 10 };
        assert_eq!(
            s.apply(Event::Fill { qty: 3 }),
            Err(TransitionError::Overfill { filled: 8, qty: 3, total: 10 }),
        );
    }

    #[test]
    fn terminal_states_reject_every_event() {
        for terminal in [OrderState::Filled, OrderState::Cancelled, OrderState::Rejected] {
            for event in [Event::Accept, Event::Fill { qty: 1 }, Event::Cancel, Event::Reject] {
                assert_eq!(
                    terminal.clone().apply(event.clone()),
                    Err(TransitionError::IllegalTransition {
                        state: terminal.clone(), event: event.clone(),
                    }),
                );
            }
        }
    }

    #[test]
    fn error_implements_display() {                          // proves it's a real Error
        let e = TransitionError::Overfill { filled: 8, qty: 3, total: 10 };
        assert_eq!(e.to_string(), "overfill: filled 8 + qty 3 exceeds total 10");
    }
}
```

The nested-loop terminal test is the high-value one: it's a 3×4 truth table that would be tedious to hand-write and easy to leave a hole in. Because `OrderState`/`Event` derive `Clone` + `PartialEq`, you can loop over owned copies and compare with `assert_eq!`. Note `apply` consumes `self`, so the loop `clone()`s before each call.

### Implement it

The whole thing is one `match` on the tuple `(self, event)`. Match each *state* explicitly for its legal events; fold **all** illegal pairs — terminal states, bad `(state, event)` combos — into one final `(state, event) => Err(...)` catch-all. That final arm is fine because it's the *illegal* axis; the state axis is fully enumerated above it, so adding a `Suspended` variant still breaks the build until you add its legal arms.

```rust
impl OrderState {
    pub fn apply(self, event: Event) -> Result<OrderState, TransitionError> {
        match (self, event) {
            (OrderState::New { total }, Event::Accept)  => Ok(OrderState::Accepted { total }),
            (OrderState::New { .. },    Event::Reject)  => Ok(OrderState::Rejected),
            (OrderState::New { .. },    Event::Cancel)  => Ok(OrderState::Cancelled),

            (OrderState::Accepted { total }, Event::Fill { qty }) => fill(0, qty, total),
            (OrderState::Accepted { .. },    Event::Cancel)       => Ok(OrderState::Cancelled),

            (OrderState::PartiallyFilled { filled, total }, Event::Fill { qty }) => fill(filled, qty, total),
            (OrderState::PartiallyFilled { .. },            Event::Cancel)       => Ok(OrderState::Cancelled),

            (state, event) => Err(TransitionError::IllegalTransition { state, event }),
        }
    }
}

fn fill(filled: u64, qty: u64, total: u64) -> Result<OrderState, TransitionError> {
    let next = filled + qty;
    if next > total       { Err(TransitionError::Overfill { filled, qty, total }) }
    else if next == total { Ok(OrderState::Filled) }
    else                  { Ok(OrderState::PartiallyFilled { filled: next, total }) }
}
```

`fill` is factored out so `Accepted` (filled == 0) and `PartiallyFilled` share one rule — DRY the arithmetic, not the match. The error type earns its keep with the trait impls:

```rust
impl std::fmt::Display for TransitionError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            TransitionError::IllegalTransition { state, event } =>
                write!(f, "illegal transition: {event:?} in state {state:?}"),
            TransitionError::Overfill { filled, qty, total } =>
                write!(f, "overfill: filled {filled} + qty {qty} exceeds total {total}"),
        }
    }
}
impl std::error::Error for TransitionError {}
```

Complexity is O(1) per transition. The gotcha: don't reach for a catch-all on the *state* axis — that's the one place you want exhaustiveness to bite.

**The typestate extension.** If the state set is fixed at compile time, you can make illegal transitions *not compile* by encoding state in the type via a zero-sized marker:

```rust
struct New;      struct Accepted;    struct Filled;      // zero-sized markers
struct Order<S> { total: u64, _state: std::marker::PhantomData<S> }

impl Order<New>      { fn accept(self) -> Order<Accepted> { /* … */ } }
impl Order<Accepted> { fn cancel(self) -> Order<Cancelled> { /* … */ } }
// Order<Filled> has no cancel() — so filled.cancel() is a *compile* error, not an Err.
```

Typestate wins when states are known statically and you want illegal calls to be unbuildable. It loses when a state is chosen at runtime (a wire message, a config value) — you can't name the type — and it fans out into many types/generics. The runtime enum keeps states as first-class values you can store, send over a channel, and pick dynamically, at the cost of a `Result` instead of a type error. Most trading systems want the enum for exactly that reason: states come off the wire.

### Common mistakes & senior signal

- **Catch-all on the state axis.** `_ => panic!("unreachable")` throws away the compiler's audit. Enumerate states; only fold *illegal pairs* into the trailing `(state, event) => Err`. A new state must break the build.
- **`&mut self` instead of `self`.** Consuming `self` is the design — it moves the old state out so a stale handle can't be reused. The README's "real challenge" is seeing that move semantics *encode* the machine.
- **`bool` or `Option` for the outcome.** A senior returns a domain error enum implementing `Error`, so `Overfill` and `IllegalTransition` are distinguishable and `?`-composable. Mark it `#[non_exhaustive]` so adding a failure mode later isn't a breaking change.
- **Duplicating the fill arithmetic.** Factor the shared `filled + qty` rule into one helper; `Accepted` is just the `filled == 0` case.
- **Treating typestate as always-better.** The senior signal is naming the trade-off out loud: typestate for compile-time-known states and unbuildable illegal calls; enum for runtime-chosen states you store and send. The money framing — an illegal transition is a double fill or a payout against a cancelled order — is why this is enforced by the compiler *and* the `Result`, never by a comment.


## Position Book — Shared Mutable State Without the Data Race, Deadlock, or Lost Update

### Summary

**What this topic covers**

You build a trading desk's net-position keeper: many order-handler threads report signed `Fill`s (`+` bought, `-` sold) across many symbols, `apply` adds to a symbol's running net, `hedge(from, to, qty)` moves quantity between two symbols atomically, and `total()` sums the book (an invariant `hedge` must preserve). This is the canonical "make shared mutable state thread-safe, and don't deadlock" senior question. The signature Rust topic it drills is **shared-state concurrency**: `Arc<Mutex<T>>`, `RwLock`, `Send`/`Sync`, and the discipline of lock ordering — plus the crucial Rust twist that changes what "the bug" even is.

**Mental model**

In Go or C++ this kata is partly a data-race hunt: two threads writing one `i64` is undefined behaviour you catch with `-race`/TSan. **In Rust that bug cannot exist** — it won't compile. A bare `i64` shared across threads fails the borrow checker: `&mut` can't cross a thread boundary and `&` can't mutate. To touch shared state you are *forced* to wrap it (`Mutex`, `RwLock`, atomic), and only `Sync` types can be shared by reference. So the compiler deletes the entire data-race category for free. What it does **not** delete are the two runtime bugs that survive perfectly-safe code: **lost update** (a read-modify-write split across a lock boundary — copy value out, drop lock, add, store back, and a concurrent writer clobbers you) and **deadlock** (two locks acquired in opposite orders by two threads). The whole kata lives in that gap: safe Rust, still wrong at runtime. The fix for lost update is to hold the lock *across* the RMW (`*guard += qty`); the fix for deadlock is a global lock order.

**Key terms**

- **`Arc<Mutex<i64>>`** — the per-symbol slot: `Arc` for shared ownership across threads, `Mutex` for exclusive mutable access to the count inside.
- **`RwLock<HashMap<..>>`** — the registry: many readers share it (the common `slot` lookup), writers are exclusive (inserting a new symbol).
- **lost update** — a read-modify-write that isn't atomic; the interleaving loses one thread's write. The RMW must be *inside* one lock hold.
- **deadlock** — thread 1 holds lock A wants B, thread 2 holds B wants A; both wait forever. Broken by a total order on locks.
- **lock ordering** — always acquire multiple locks in the same global order (here: lexicographically-smaller symbol first), whichever direction the operation goes.
- **`Send`** — a type safe to *move* to another thread. **`Sync`** — a type safe to *share* by `&`. `Mutex<T>: Sync` when `T: Send`; that is what makes `&PositionBook` shareable.
- **`MutexGuard`** — the RAII handle `.lock()` returns; the lock releases when it drops. Lock granularity is scope granularity.
- **poisoning** — if a thread panics holding a `Mutex`, `.lock()` returns `Err`; `.unwrap()` propagates it.
- **granularity** — one big `Mutex<HashMap>` (simple, deadlock-free, fully serialised) vs per-symbol locks (parallel, but the deadlock hazard exists).
- **`thread::scope` + `Barrier`** — the stress-test tools: scoped threads borrow the book by `&`, a `Barrier` releases them together for maximum contention.

**Why interviewers ask this**

It separates people who think "Rust = memory safe = concurrency safe" from people who know exactly where the type system stops. A junior wraps things in a `Mutex`, sees it compile, and calls it done. A senior can state precisely what Rust guaranteed (no data race — structurally impossible) and what it did *not* (lost update, deadlock), then defend a granularity choice, impose a lock order and explain *why* it prevents deadlock, and — the real tell — write a **Barrier-gated conservation stress test** that would actually catch a lost update or hang on a deadlock, rather than a `sleep`-based coin-flip test. It is also a clean lens on `Arc<Mutex>` vs `RwLock` vs atomics and on the money stakes: a lost fill is a wrong position and a mis-hedged book; a deadlock is a wedged trading system at peak.

**Common confusions**

- *"Rust is safe, so my concurrent code is correct."* — No. Safe means no data race / UB. Logic bugs like lost update and deadlock are fully expressible in safe Rust.
- *"`apply` reads then writes, both under a lock, so it's fine."* — Only if it's the *same* lock hold. Two separate `.lock()` calls around the arithmetic is a lost-update window.
- *"Per-symbol locks are strictly better."* — They add parallelism *and* a deadlock hazard. The single-mutex map is dumber but has no deadlock to reason about.
- *"Lock order should follow the hedge direction."* — That *is* the bug. Order by a property of the locks (symbol name), never by the operation's direction.

**What follows from this topic**

This is the gateway to `threadpool` (channel discipline + `Drop`-based shutdown) and the `spscring` unsafe capstone (real UB in `unsafe`, verified with Miri). The extension — swapping each `Mutex<i64>` for an `AtomicI64` to make `apply` lock-free — leads straight into atomics and memory ordering, and sharding the map leads into contention engineering. It's the concrete anchor for `Arc<Mutex>`, `Send`/`Sync`, and lock-ordering discipline everywhere else.

### Clarify & design the API

Clarifying questions worth asking out loud: are fills signed (yes — one `apply` path, no separate buy/sell)? Is `hedge` required to be atomic w.r.t. `total()` (yes — that's the whole conservation invariant)? Read-heavy or write-heavy (many `apply`s, so favour cheap lookups)? Do we surface mutex poisoning as a `Result`, or `unwrap` (kata: `unwrap` is fine, mention `Result` as the extension)?

The **ownership decision** is the design. Shared state hammered by many threads means every method takes `&self` (never `&mut self` — that would demand exclusive access and defeat sharing). The book is shared either by reference (`&PositionBook` is `Sync`) or via `Arc<PositionBook>`. Then the granularity call: one coarse lock, or per-symbol locks?

```rust
pub struct Fill { pub symbol: String, pub qty: i64 } // provided verbatim

// Registry of per-symbol locks. RwLock: cheap shared reads to find a slot,
// exclusive only to register a new symbol. Each count behind its own Mutex
// so unrelated symbols update in parallel — this is what creates the deadlock
// hazard hedge() must order around.
#[derive(Default)]
pub struct PositionBook {
    positions: RwLock<HashMap<String, Arc<Mutex<i64>>>>,
}

impl PositionBook {
    pub fn new() -> Self { Self::default() }
    pub fn apply(&self, fill: &Fill);                 // &self — shared
    pub fn hedge(&self, from: &str, to: &str, qty: i64);
    pub fn position(&self, symbol: &str) -> i64;
    pub fn total(&self) -> i64;
}
```

Say the tradeoff explicitly: `Mutex<HashMap<String, i64>>` is simpler and *cannot* deadlock, but serialises every update through one lock. The `RwLock<HashMap<_, Arc<Mutex<i64>>>>` buys per-symbol parallelism at the cost of the two-lock `hedge` deadlock risk. Choosing the harder design *is* the senior signal — you're volunteering the problem you then solve.

### Write the tests

This is the heart of the kata — the README ships **no tests**; writing them is the exercise. Start with the contract, then the invariant, then the two concurrency stress tests. The stress tests are the ones that matter: they're the only thing that can catch a lost update or a deadlock, and they must be **`Barrier`-gated inside `thread::scope`** with **no `sleep`s** (sleeps make it a flaky coin flip).

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Barrier;
    use std::thread;

    fn fill(symbol: &str, qty: i64) -> Fill { Fill { symbol: symbol.into(), qty } }

    #[test]
    fn apply_accumulates_net_position() {
        let book = PositionBook::new();
        book.apply(&fill("VOD", 100));
        book.apply(&fill("VOD", -30));
        assert_eq!(book.position("VOD"), 70); // signed accumulation
    }

    #[test]
    fn unknown_symbol_is_zero() {
        assert_eq!(PositionBook::new().position("NONE"), 0); // edge: never seen
    }

    #[test]
    fn hedge_moves_quantity_and_conserves_total() {
        let book = PositionBook::new();
        book.apply(&fill("A", 50));
        book.apply(&fill("B", 10));
        book.hedge("A", "B", 20);
        assert_eq!(book.position("A"), 30);
        assert_eq!(book.position("B"), 30);
        assert_eq!(book.total(), 60); // the invariant: hedge moves, never mints
    }

    // LOST-UPDATE catcher. 8 threads pound the same 4 symbols, released together
    // by the Barrier for maximum contention. If apply's RMW weren't atomic under
    // one lock hold, the total would fall short of THREADS*ITERS.
    #[test]
    fn concurrent_applies_lose_no_updates() {
        const THREADS: usize = 8;
        const ITERS: i64 = 20_000;
        let symbols = ["A", "B", "C", "D"];
        let book = PositionBook::new();
        let barrier = Barrier::new(THREADS);

        thread::scope(|s| {
            for t in 0..THREADS {
                let (book, barrier) = (&book, &barrier);
                s.spawn(move || {
                    barrier.wait(); // all threads start at once
                    for i in 0..ITERS {
                        book.apply(&fill(symbols[(t + i as usize) % symbols.len()], 1));
                    }
                });
            }
        });
        assert_eq!(book.total(), THREADS as i64 * ITERS); // no update lost
    }

    // DEADLOCK catcher. Half the threads hedge A->B, half B->A — the classic
    // opposite-order setup. A naive two-lock hedge hangs here forever (the test
    // never returns); a lost update breaks conservation. Passing proves both the
    // lock ordering AND the atomicity.
    #[test]
    fn concurrent_hedges_do_not_deadlock_and_conserve() {
        const THREADS: usize = 8;
        const ITERS: usize = 20_000;
        let book = PositionBook::new();
        book.apply(&fill("A", 1_000_000));
        book.apply(&fill("B", 1_000_000));
        let start = book.total();
        let barrier = Barrier::new(THREADS);

        thread::scope(|s| {
            for t in 0..THREADS {
                let (book, barrier) = (&book, &barrier);
                s.spawn(move || {
                    barrier.wait();
                    let (from, to) = if t % 2 == 0 { ("A", "B") } else { ("B", "A") };
                    for _ in 0..ITERS { book.hedge(from, to, 1); }
                });
            }
        });
        assert_eq!(book.total(), start); // conserved, and it returned at all
    }
}
```

Run with `cargo test -p solution positionbook` (or `-p practice` for your own attempt). A deadlock failure manifests as the test **hanging**, not a red assert — so if `concurrent_hedges` never finishes, you have your bug. `thread::scope` matters here: scoped threads may borrow `&book` and `&barrier` off the stack, so you avoid `Arc` and cloning in the test itself, and the scope join is what lets you assert *after* all threads finish.

### Implement it

The implementation must satisfy the borrow checker (that's most of the work) and then dodge the two runtime bugs. Key move: a `slot` helper that returns the per-symbol `Arc<Mutex<i64>>`, taking only a **read** lock on the registry in the fast path and upgrading to a write lock only to register a brand-new symbol.

```rust
fn slot(&self, symbol: &str) -> Arc<Mutex<i64>> {
    {
        let map = self.positions.read().unwrap();      // shared: common case
        if let Some(slot) = map.get(symbol) { return Arc::clone(slot); }
    }                                                  // read guard dropped here
    let mut map = self.positions.write().unwrap();     // exclusive: insert
    Arc::clone(map.entry(symbol.to_string())
        .or_insert_with(|| Arc::new(Mutex::new(0))))
}

pub fn apply(&self, fill: &Fill) {
    let slot = self.slot(&fill.symbol);
    let mut pos = slot.lock().unwrap();
    *pos += fill.qty;   // RMW *inside* the lock hold — the lost-update fix
}

pub fn hedge(&self, from: &str, to: &str, qty: i64) {
    if from == to { return; }                 // edge: self-hedge is a no-op
    let (from_slot, to_slot) = (self.slot(from), self.slot(to));
    if from < to {                            // GLOBAL ORDER: smaller name first
        let mut a = from_slot.lock().unwrap();
        let mut b = to_slot.lock().unwrap();
        *a -= qty; *b += qty;
    } else {
        let mut b = to_slot.lock().unwrap();  // still smaller-first (to < from)
        let mut a = from_slot.lock().unwrap();
        *a -= qty; *b += qty;
    }
}
```

The lock-ordering gotcha is the whole point: both branches acquire the lexicographically-smaller symbol's lock *first*, regardless of hedge direction. `hedge("A","B")` and `hedge("B","A")` therefore both lock `A` before `B`, so they queue instead of deadlocking. Note we drop the registry read guard in `slot` *before* taking the per-symbol lock — never nest an unrelated lock inside the registry lock, or you've invented a new ordering hazard. `position` and `total` just take the registry read lock then the per-symbol locks; `total`'s `.values().map(|s| *s.lock().unwrap()).sum()` is the conservation read the tests assert on.

### Common mistakes & senior signal

The README's headline trap: **thinking Rust made you safe.** It made a data race un-writable; it did nothing about lost update or deadlock. Name that gap unprompted.

- **Split RMW (lost update).** `let cur = *slot.lock().unwrap(); /* lock dropped */ *slot.lock().unwrap() = cur + qty;` compiles, passes single-threaded, loses updates under contention. Keep the guard alive across the arithmetic.
- **Direction-based lock order (deadlock).** Locking `from` then `to` deadlocks the instant two hedges run opposite directions. Order by the *lock's* identity (symbol name), never the operation. The concurrent-hedge test hangs if you get this wrong — a senior points at the hang and knows it's ordering.
- **Holding the registry lock across the per-symbol lock.** Creates a second lock hierarchy and a fresh deadlock. Scope the registry guard tightly (the inner block in `slot`).
- **`sleep`-based "stress" tests.** Timing-dependent and prove nothing. The senior signal is the `Barrier`-gated `thread::scope` conservation test that deterministically maximises contention and asserts an invariant (`total == THREADS*ITERS`, or `total == start`).
- **Over- or under-locking granularity with no rationale.** State the tradeoff: coarse `Mutex<HashMap>` (no deadlock, no parallelism) vs per-symbol `Arc<Mutex>` (parallelism, deadlock hazard you then order around). Volunteering the harder design and defending it is the signal.

Extensions that show depth: swap each `Mutex<i64>` for an `AtomicI64` to make `apply` lock-free (then `hedge` needs a lock or a two-value CAS story — a genuinely harder atomicity problem); shard the map to cut contention; return `Result` to surface poisoning instead of `unwrap`.


## Thread Pool — Channel Discipline & Drop-Based Shutdown

### Summary

**What this topic covers**

You build a fixed-size pool of worker threads that drain one shared job queue: `ThreadPool::new(size)` spawns `size` OS threads once, `execute(f)` hands a closure to whichever worker is free, and dropping the pool shuts it down cleanly — every queued job runs, every thread is joined, nothing leaks. This is the Rust Book's capstone, and the signature topic it drills is **concurrency ownership**: how you move type-erased work across a thread boundary (`Box<dyn FnOnce() + Send + 'static>`), share a single non-`Sync` receiver (`Arc<Mutex<Receiver<Job>>>`), and orchestrate a graceful stop from `Drop`. Rust won't let a data race compile, so the fight here is not "prove the race" — it's channel discipline and shutdown correctness, the bugs the borrow checker does *not* catch.

**Mental model**

Think of it as one MPSC channel plus a refcounted lock. The pool owns the `Sender`; the `Receiver` is wrapped once in `Arc<Mutex<…>>` and cloned (the `Arc`, not the receiver) into every worker. A worker loops: lock the mutex, `recv()` a job, **drop the guard**, then run the job — so the lock covers only the dequeue, never the work. The whole design pivots on one channel fact: **`recv()` returns `Err` exactly when all senders are dropped, and only after draining the buffer.** That single guarantee is your shutdown signal *and* your no-lost-jobs guarantee. So the pool stores its sender as `Option<Sender>` and each handle as `Option<JoinHandle>`; `Drop` `take()`s the sender to close the channel, workers see `Err` and break, then `Drop` `join()`s every handle and blocks until the last in-flight job finishes. No sentinel message, no poison value, no detached threads.

**Key terms**

- **`Job = Box<dyn FnOnce() + Send + 'static>`** — a type-erased, heap-allocated unit of work.
- **`FnOnce`** — the weakest call trait: runs once, may *consume* (move out) its captures.
- **`Send`** — the closure is created on the caller's thread, run on a worker; it must cross threads.
- **`'static`** — it may run long after the caller's frame is gone, so it owns everything it touches.
- **`Box<dyn …>`** — every closure has a distinct compiler-generated type; erase behind a trait object, heap-allocate because `dyn` is unsized.
- **`mpsc::channel`** — multi-producer, single-consumer; `Sender: Clone`, `Receiver` is neither `Clone` nor `Sync`.
- **`Arc<Mutex<Receiver>>`** — shared ownership (`Arc`) of one receiver, serialized dequeue (`Mutex`).
- **`MutexGuard`** — the RAII lock token; dropping it releases the lock. Drop it *before* running the job.
- **`Option<Sender>` / `Option<JoinHandle>`** — the `take()` trick: move a value out of `&mut self` in `Drop`.
- **`join()`** — consumes a `JoinHandle`, blocks until that thread exits (why the handle must be owned, not borrowed).

**Why interviewers ask this**

It separates people who *use* threads from people who *own* their lifecycle. A junior spawns threads and hopes; a senior can explain why the job type carries exactly those three bounds, why the receiver needs `Arc<Mutex>` and not a clone, and — the real tell — how shutdown terminates without a poison message or a busy-wait. The `Option::take()` shutdown choreography is the discriminator: it shows you understand that `Drop` runs with `&mut self`, that `join` needs ownership, and that closing the channel is what wakes a blocked `recv`. Getting "no lost jobs" right (recv drains the buffer before erroring) proves you actually reasoned about ordering, not just got the happy path green.

**Common confusions**

- *"Give each worker its own `Receiver`"* — no; `Receiver` isn't `Clone`. Share **one** via `Arc<Mutex>`.
- *"Hold the lock while the job runs"* — that serializes all work to one-at-a-time. Drop the guard first.
- *"Send a `Terminate` message to stop workers"* — unnecessary. Dropping the sender closes the channel; `recv` errors. No sentinel.
- *"`Drop` can `join` the handle directly"* — `join` consumes the handle, but `Drop` only has `&mut self`. Store it in `Option` and `take()`.
- *"Dropping the sender loses queued jobs"* — false. `recv` yields buffered jobs *before* it returns `Err`.

**What follows from this topic**

The `Arc<Mutex<Receiver>>` dequeue is a throughput ceiling under contention — the natural next step is a lock-free MPMC queue (`crossbeam-channel`) or per-worker work-stealing deques (`rayon`). The channel-as-signal idea reappears wherever you coordinate shutdown; the `Option::take` + `Drop` pattern generalizes to any RAII teardown that must `join` or `close`. Swap the channel for a hand-rolled `Mutex<VecDeque<Job>> + Condvar` (see [[blockingqueue]]) to see the same shutdown flag pattern without a channel.

### Clarify & design the API

Questions to pin down before typing: *Fixed size, or does it grow?* Fixed — bound concurrency at a number the caller chose. *What can `execute` accept?* Any `FnOnce() + Send + 'static` — keep those bounds verbatim, they are the spec. *What happens on drop — abort in-flight work, or finish it?* Finish it: every submitted job runs, then join. *Zero workers?* Programmer error → `panic`, not a `Result`.

The ownership decisions, made up front:

- **Who owns the closure?** The pool takes it by value (`f: F`), boxes it (`Box::new(f)`), and moves it into the channel. Ownership transfers caller → channel → worker. Hence `Send + 'static`.
- **Who owns the receiver?** All workers share one, so `Arc` (shared ownership) `<Mutex<…>>` (one dequeues at a time). Not a clone — `Receiver` isn't `Clone`.
- **`&self` or `&mut self` on `execute`?** `&self` — submitting is a shared operation (send through a `Sender`, which is `Sync`), so many callers can submit concurrently.

```rust
use std::sync::mpsc::{self, Receiver, Sender};
use std::sync::{Arc, Mutex};
use std::thread::{self, JoinHandle};

type Job = Box<dyn FnOnce() + Send + 'static>;

pub struct ThreadPool {
    workers: Vec<Worker>,
    sender: Option<Sender<Job>>, // Option so Drop can take() it → close channel
}

struct Worker {
    _id: usize,
    handle: Option<JoinHandle<()>>, // Option so Drop can take() it → join()
}

impl ThreadPool {
    pub fn new(size: usize) -> Self { /* … */ }
    pub fn execute<F>(&self, f: F) where F: FnOnce() + Send + 'static { /* … */ }
}
```

### Write the tests

The heart of the kata. There are no bundled tests — writing them *is* the exercise, and they must be **deterministic**: no `sleep` to synchronise. The trick is the inner scope `{ let pool = …; }` — the pool's `Drop` joins every worker, so by the time the scope closes, all jobs have provably finished. Then assert.

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicUsize, Ordering};
    use std::sync::Barrier;

    // Basic contract + core behaviour: every submitted job runs exactly once.
    #[test]
    fn runs_every_submitted_job() {
        let counter = Arc::new(AtomicUsize::new(0));
        const N: usize = 1000;
        {
            let pool = ThreadPool::new(4);
            for _ in 0..N {
                let c = Arc::clone(&counter);
                pool.execute(move || { c.fetch_add(1, Ordering::SeqCst); });
            }
            // pool drops here → Drop joins all workers → all N jobs done. No sleep.
        }
        assert_eq!(counter.load(Ordering::SeqCst), N);
    }

    // Results flow back over a channel — proves jobs run and produce output.
    #[test]
    fn collects_results_over_a_channel() {
        const N: usize = 100;
        let (tx, rx) = mpsc::channel::<usize>();
        {
            let pool = ThreadPool::new(4);
            for i in 0..N {
                let tx = tx.clone();
                pool.execute(move || { tx.send(i * i).expect("receiver alive"); });
            }
        }
        drop(tx);
        let mut got: Vec<usize> = (0..N).map(|_| rx.recv().unwrap()).collect();
        got.sort_unstable();
        assert_eq!(got, (0..N).map(|i| i * i).collect::<Vec<_>>());
    }

    // Edge: a single worker must still drain many jobs (serialised dequeue).
    #[test]
    fn a_single_worker_runs_many_jobs() {
        let counter = Arc::new(AtomicUsize::new(0));
        const N: usize = 50;
        {
            let pool = ThreadPool::new(1);
            for _ in 0..N {
                let c = Arc::clone(&counter);
                pool.execute(move || { c.fetch_add(1, Ordering::SeqCst); });
            }
        }
        assert_eq!(counter.load(Ordering::SeqCst), N);
    }

    // Error variant: zero workers is a programmer error, not a Result.
    #[test]
    #[should_panic(expected = "greater than zero")]
    fn new_with_zero_panics() {
        let _ = ThreadPool::new(0);
    }

    // Concurrency stress: many PRODUCER threads all hammer execute() at once,
    // released simultaneously by a Barrier, to contend on Arc<Mutex<Receiver>>
    // and the Sender. Invariant: no submitted job is lost — the counter equals
    // the exact total. The inner-scope Drop join is our timeout-free "await all".
    #[test]
    fn concurrent_submitters_lose_no_jobs() {
        const PRODUCERS: usize = 8;
        const PER: usize = 500;
        let counter = Arc::new(AtomicUsize::new(0));
        let barrier = Arc::new(Barrier::new(PRODUCERS));
        {
            let pool = ThreadPool::new(4);
            thread::scope(|s| {
                for _ in 0..PRODUCERS {
                    let pool = &pool;                 // borrow the pool into each producer
                    let barrier = Arc::clone(&barrier);
                    let counter = Arc::clone(&counter);
                    s.spawn(move || {
                        barrier.wait();               // all producers start submitting together
                        for _ in 0..PER {
                            let c = Arc::clone(&counter);
                            pool.execute(move || { c.fetch_add(1, Ordering::SeqCst); });
                        }
                    });
                }
            }); // scope join: every producer has finished submitting
        }       // pool Drop: every job has finished running
        assert_eq!(counter.load(Ordering::SeqCst), PRODUCERS * PER);
    }
}
```

What each catches: `runs_every_submitted_job` is the core contract (all jobs run, drop drains). `collects_results_over_a_channel` proves jobs actually execute and are independent. `a_single_worker_runs_many_jobs` guards the shared-receiver loop with `size == 1` (the dequeue-serialisation edge). `new_with_zero_panics` pins the `assert!`. `concurrent_submitters_lose_no_jobs` is the **`Barrier`-gated `thread::scope` stress test**: the barrier releases all producers at the same instant so they genuinely contend on the one sender and the one receiver mutex; a lost-update bug or a botched shutdown that drops queued jobs shows up as a counter below `PRODUCERS * PER`. The two nested scopes are the deterministic "await" — `thread::scope` joins producers, then pool `Drop` joins workers — so no `sleep` and no flaky timing. Run with `cargo test -p solution threadpool` (or `-p practice`).

### Implement it

Wire the channel once, share the receiver, run the worker loop, and add `Drop`.

```rust
impl ThreadPool {
    pub fn new(size: usize) -> Self {
        assert!(size > 0, "thread pool size must be greater than zero");
        let (sender, receiver) = mpsc::channel::<Job>();
        let receiver = Arc::new(Mutex::new(receiver)); // ONE receiver, shared
        let mut workers = Vec::with_capacity(size);
        for id in 0..size {
            workers.push(Worker::new(id, Arc::clone(&receiver)));
        }
        ThreadPool { workers, sender: Some(sender) }
    }

    pub fn execute<F>(&self, f: F)
    where F: FnOnce() + Send + 'static {
        let job: Job = Box::new(f);
        self.sender.as_ref()
            .expect("sender present until Drop")
            .send(job)
            .expect("workers outlive every execute");
    }
}

impl Worker {
    fn new(id: usize, receiver: Arc<Mutex<Receiver<Job>>>) -> Self {
        let handle = thread::spawn(move || loop {
            // Lock → recv → DROP GUARD → run. The guard is a temporary that
            // dies at the end of this statement, so the lock only spans recv().
            let message = receiver.lock().expect("mutex poisoned").recv();
            match message {
                Ok(job) => job(),      // lock already released — work runs unlocked
                Err(_) => break,       // all senders dropped → channel closed → exit
            }
        });
        Worker { _id: id, handle: Some(handle) }
    }
}

impl Drop for ThreadPool {
    fn drop(&mut self) {
        drop(self.sender.take());                    // 1. close channel
        for worker in &mut self.workers {            // 2. join every worker
            if let Some(handle) = worker.handle.take() {
                handle.join().expect("worker panicked");
            }
        }
    }
}
```

The load-bearing detail is `let message = receiver.lock()…​.recv();` — the `MutexGuard` returned by `lock()` is a temporary that is dropped at the semicolon, *before* `match message` runs `job()`. If instead you wrote `while let Ok(job) = receiver.lock().unwrap().recv() { job(); }`, the guard lives for the whole `while` body and every job runs under the lock — serialising the entire pool to one job at a time. Complexity: `execute` is O(1) enqueue; dequeue is O(1) but serialized through the mutex. The channel is unbounded, so `execute` never blocks (that's also its weakness — no backpressure).

### Common mistakes & senior signal

- **Holding the lock across the job (the README's real trap).** `while let Ok(job) = rx.lock().unwrap().recv()` keeps the `MutexGuard` alive for the whole loop body, so jobs run one-at-a-time regardless of worker count. Senior fix: bind `recv()`'s result to a `let` so the guard drops at the statement's end, then run the job unlocked.
- **A sentinel/"poison" shutdown message.** Sending N `Terminate` values and counting them is fragile and unnecessary. Senior signal: *close the channel* by dropping the sender (`Option::take`) — `recv` returns `Err` and each worker breaks. The type system does the counting.
- **Trying to `join` in `Drop` without `Option`.** `join(self)` consumes the handle, but `Drop` has `&mut self`; you can't move a field out of a borrow. Storing `Option<JoinHandle>` and `take()`-ing it is the idiom — same trick for the sender.
- **Losing queued jobs on shutdown.** Assuming "drop sender = discard buffer." It doesn't: `recv` drains buffered jobs *before* erroring, so every submitted job runs. Order the `Drop` steps correctly (take sender, *then* join) and it falls out.
- **Cloning the receiver.** `Receiver` is not `Clone` and not `Sync`; reaching for `receiver.clone()` won't compile. The compile error *is* the design hint: wrap in `Arc<Mutex<…>>`.
- **`size == 0` returning a `Result`.** A pool that can never run a job is a programmer error — `assert!`/`panic!`, tested with `#[should_panic]`. Reserve `Result` for genuine runtime conditions.

Senior close-out: acknowledge the `Arc<Mutex<Receiver>>` dequeue is a throughput ceiling (single mutex, all workers contend) and name the production upgrade — `crossbeam-channel` (clonable MPMC) or `rayon` work-stealing — before the interviewer asks. That framing (correct-by-construction shutdown *plus* an honest scaling limit) is the senior signal.


## SPSC Ring — The Unsafe Capstone: `UnsafeCell`, Atomics Ordering & Hand-Written `Send`/`Sync`

### Summary

**What this topic covers**

You build a wait-free, lock-free, single-producer / single-consumer ring buffer: the feed-parser thread hands parsed market events to the strategy thread over a fixed-capacity ring, with no locks and no per-item allocation. `channel(capacity)` returns a `Producer` and a `Consumer`, each of which moves to its own thread. `try_push(value) -> Result<(), T>` enqueues or hands the value back if full; `try_pop() -> Option<T>` dequeues or returns `None` if empty; neither ever blocks. This is the `unsafe` capstone of the Rust katas — it drills the three things safe Rust deliberately hides from you: interior-mutable shared storage (`UnsafeCell<MaybeUninit<T>>`), inter-thread memory ordering (`Acquire`/`Release` on `AtomicUsize`), and the hand-written `unsafe impl Send`/`Sync` you must justify with a written safety invariant. Because it's `unsafe`, the borrow checker can no longer prove correctness — so **Miri** becomes the tool that plays ThreadSanitizer's role.

**Mental model**

The whole design is one sentence: *two threads share a buffer, but at any instant each slot has exactly one accessor, and every hand-off between them is ordered.* The producer exclusively owns the write index `tail` and only ever writes slot `tail`; the consumer exclusively owns the read index `head` and only ever reads slot `head`. They meet only at the fences: the producer writes the slot, *then* `Release`-stores `tail`; the consumer `Acquire`-loads `tail` *before* reading the slot. That release/acquire pair establishes a **happens-before** edge — the consumer is guaranteed to see the fully-written value, never a torn or stale one. Symmetrically for `head`. Safe Rust can't express "shared but never aliased," so the slots live in `UnsafeCell` and you uphold the no-aliasing invariant *by hand*. The reward: no lock, no CAS on the hot path, no per-item allocation — a push and a pop are each a relaxed load, an acquire load, one slot access, and a release store.

**Key terms**

- **`UnsafeCell<T>`** — the *only* legal way to get a `&mut` through a `&`; the primitive under every interior-mutability type. `!Sync` by itself.
- **`MaybeUninit<T>`** — storage that may hold an uninitialized `T`; lets you allocate slots without constructing values and avoids dropping garbage.
- **`AtomicUsize`** — the lock-free `head`/`tail` indices; loaded/stored with explicit `Ordering`.
- **`Ordering::Acquire` / `Ordering::Release`** — the paired fences that create the cross-thread happens-before edge; `Relaxed` is used only for a thread reading *its own* index.
- **happens-before** — the ordering guarantee: if the release is observed by the acquire, everything before the release is visible after the acquire.
- **`unsafe impl Send` / `Sync`** — you assert the type is thread-transferable/shareable because the *algorithm* (not the compiler) guarantees safety; each needs a `// SAFETY:` invariant.
- **`PhantomData<Cell<()>>`** — a zero-size marker that makes `Producer`/`Consumer` `!Sync`, so the type system enforces "exactly one of each."
- **`assume_init_read` / `assume_init_drop`** — move a value out of / drop a value in a `MaybeUninit` slot; unsafe because *you* promise it's initialized.
- **wait-free** — every operation completes in a bounded number of steps with no spinning on a lock; stronger than lock-free.

**Why interviewers ask this**

This is where Rust stops holding your hand and asks whether you actually understand the memory model. A junior reaches for `Arc<Mutex<VecDeque>>` — correct, but it's a lock, not the wait-free structure the prompt demands. A mid-level writes the `UnsafeCell` buffer but sprinkles `Ordering::SeqCst` everywhere ("it's the safe one") without being able to say *which* release pairs with *which* acquire, or writes `unsafe impl Sync` with no justification. The senior signal is: naming the exact happens-before edge that makes concurrent slot access sound, explaining why one slot is left empty (to distinguish full from empty without a contended shared counter), writing the `// SAFETY:` comment that a reviewer could actually check, and reaching for Miri unprompted — because in `unsafe` Rust "it passed the test 10,000 times" proves nothing about UB. They want to see you treat `unsafe` as a contract you owe the reader, not a keyword that silences the compiler.

**Common confusions**

- *"`unsafe` means the code is unsafe."* No — it means *you*, not the compiler, are vouching for the invariant. The whole game is keeping the unsafe surface tiny and documented.
- *"Just use `SeqCst` everywhere to be safe."* `SeqCst` is correct but oversells the guarantee and hides your understanding; `Acquire`/`Release` is the minimal, honest ordering and is what the interviewer wants to see you reason about.
- *"`UnsafeCell` is enough to share across threads."* `UnsafeCell` is `!Sync`; you still must `unsafe impl Sync` and justify it.
- *"Capacity N means N slots."* You allocate N+1 and keep one empty, so `head == tail` (empty) and `tail+1 == head` (full) are distinguishable without a shared length counter both threads would contend on.

**What follows from this topic**

Everything harder is a generalization of this. Relax "single producer" and you need per-slot sequence numbers and CAS (Vyukov's bounded MPMC queue — the `crossbeam::queue::ArrayQueue` design). Add cache-line padding (`#[repr(align(64))]`) around `head` and `tail` to kill false sharing on the hot path. In production you'd reach for `crossbeam` or `std::sync::mpsc`; this kata exists to show what the `unsafe` contract buys (a wait-free hot path) and costs (a proof obligation you discharge by hand and verify with Miri). It's the Rust twin of the C++ `feed_pipe` kata — same algorithm, but Rust forces the `Send`/`Sync` reasoning into the type system.

### Clarify & design the API

Questions worth asking before writing a line: **How many producers/consumers?** (The prompt says exactly one each — that's load-bearing; it's what lets each index have a single writer.) **Bounded or growable?** (Bounded, fixed capacity, no per-item allocation.) **Blocking or not?** (Never block — `try_push` returns `Err(value)` handing the value back, `try_pop` returns `None`.) **What's `T`?** (Any `Send` value; owned, moved in and out.) **What happens to items left in the ring at drop?** (Each dropped exactly once — a leaked event is a missed fill, a double-drop is a phantom position.)

The ownership decision is the design. Two handles share one ring, so the ring lives in an `Arc<Ring<T>>` and each handle holds a clone. Slots are shared-but-interior-mutable, so `UnsafeCell<MaybeUninit<T>>`. Indices are lock-free, so `AtomicUsize`. Crucially, `try_push`/`try_pop` take `&self` (not `&mut self`) — the handles are shared with their thread, and the mutation goes through `UnsafeCell` and atomics, not `&mut`.

```rust
use std::cell::{Cell, UnsafeCell};
use std::marker::PhantomData;
use std::mem::MaybeUninit;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;

struct Ring<T> {
    buf: Box<[UnsafeCell<MaybeUninit<T>>]>,
    head: AtomicUsize, // next slot to pop  — owned by the consumer
    tail: AtomicUsize, // next slot to push — owned by the producer
}

pub struct Producer<T> { ring: Arc<Ring<T>>, _not_sync: PhantomData<Cell<()>> }
pub struct Consumer<T> { ring: Arc<Ring<T>>, _not_sync: PhantomData<Cell<()>> }

pub fn channel<T>(capacity: usize) -> (Producer<T>, Consumer<T>);
impl<T> Producer<T> { pub fn try_push(&self, value: T) -> Result<(), T>; }
impl<T> Consumer<T> { pub fn try_pop(&self) -> Option<T>; }
```

The senior touch: `PhantomData<Cell<()>>` makes each handle `!Sync`. You can `Send` a `Producer` to a thread (move it) but you cannot share `&Producer` between threads — so "single producer" is enforced by the *type system*, not a comment. `Cell<()>` is the idiomatic `!Sync` marker because `Cell` is `Send` but not `Sync`.

### Write the tests

The tests are the spec, and for an `unsafe` concurrent structure they come in two flavours: **logic tests** (`cargo test`) that pin FIFO/full/empty/wrap/drop semantics, and the **concurrent stress test** that, run under **Miri**, is the data-race/UB proof. Write them first.

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::AtomicUsize;
    use std::sync::Barrier;
    use std::thread;

    #[test]
    fn push_pop_is_fifo() {
        let (tx, rx) = channel::<i32>(4);
        assert!(tx.try_push(1).is_ok());
        assert!(tx.try_push(2).is_ok());
        assert_eq!(rx.try_pop(), Some(1)); // out in insertion order
        assert_eq!(rx.try_pop(), Some(2));
        assert_eq!(rx.try_pop(), None);    // drained
    }

    #[test]
    fn full_hands_value_back_then_pop_makes_room() {
        let (tx, rx) = channel::<i32>(2); // holds 2 (allocates 3 slots)
        assert!(tx.try_push(10).is_ok());
        assert!(tx.try_push(20).is_ok());
        assert_eq!(tx.try_push(30), Err(30)); // full: value handed back, not lost
        assert_eq!(rx.try_pop(), Some(10));
        assert!(tx.try_push(30).is_ok());     // one popped → room again
    }

    #[test]
    fn empty_pops_none() {
        let (_tx, rx) = channel::<i32>(4);
        assert_eq!(rx.try_pop(), None);
    }

    #[test]
    fn wraps_around() {
        // 100 rounds through a 2-capacity ring forces the index to wrap many times.
        let (tx, rx) = channel::<i32>(2);
        for round in 0..100 {
            assert!(tx.try_push(round).is_ok());
            assert!(tx.try_push(round + 1000).is_ok());
            assert_eq!(rx.try_pop(), Some(round));
            assert_eq!(rx.try_pop(), Some(round + 1000));
        }
    }

    // A Drop-counting payload proves each element is dropped exactly once — no leak, no double-free.
    #[test]
    fn drops_unconsumed_elements_exactly_once() {
        static DROPS: AtomicUsize = AtomicUsize::new(0);
        struct Bomb;
        impl Drop for Bomb {
            fn drop(&mut self) { DROPS.fetch_add(1, Ordering::SeqCst); }
        }
        DROPS.store(0, Ordering::SeqCst);
        {
            let (tx, rx) = channel::<Bomb>(8);
            tx.try_push(Bomb).unwrap();
            tx.try_push(Bomb).unwrap();
            tx.try_push(Bomb).unwrap();
            drop(rx.try_pop());  // consume + drop one
            // two remain in the ring; dropping the ends drops the Ring, which drops those two.
        }
        assert_eq!(DROPS.load(Ordering::SeqCst), 3); // 1 consumed + 2 unconsumed, none double-dropped
    }

    // THE proof test: one producer thread, one consumer thread, gated to start together with a
    // Barrier so they actually race. Asserts every item arrives exactly once, in order. Under Miri
    // this is the -race / ThreadSanitizer analogue; without Miri the FIFO assert still catches
    // lost/duplicated/reordered items.
    #[test]
    fn spsc_fifo_under_threads() {
        const N: u64 = 100_000;
        let (tx, rx) = channel::<u64>(1024);
        let barrier = Barrier::new(2);

        thread::scope(|s| {
            let b = &barrier;
            s.spawn(move || {
                b.wait(); // both threads release together → real concurrency
                for i in 0..N {
                    while tx.try_push(i).is_err() { /* full: spin until consumer drains */ }
                }
            });
            let b = &barrier;
            s.spawn(move || {
                b.wait();
                let mut expected = 0u64;
                while expected < N {
                    if let Some(v) = rx.try_pop() {
                        assert_eq!(v, expected); // strict FIFO, no gaps, no repeats
                        expected += 1;
                    }
                }
            });
        });
    }
}
```

What each catches: `push_pop_is_fifo` pins ordering; `full_hands_value_back` pins the N+1-slot full/empty rule and that a full push doesn't consume the value; `empty_pops_none` the empty case; `wraps_around` the index wrap arithmetic; `drops_unconsumed_elements_exactly_once` the `Drop` correctness (the subtle bug: forgetting to drop leftover elements, or dropping consumed ones twice); and `spsc_fifo_under_threads` the actual concurrency contract. `thread::scope` lets the spawned closures borrow `tx`/`rx`/`barrier` off the stack without `'static`; the `Barrier::new(2)` ensures both threads are genuinely in flight before either touches the ring, maximizing the race window.

Run them:

```
cargo test -p solution spscring
cargo +nightly miri test -p solution spscring   // UB/data-race proof, the -race analogue (needs: rustup component add miri)
```

Miri interprets the code under a memory model and flags data races, use-of-uninitialized-memory, and invalid `MaybeUninit` access — bugs that ordinary test runs will pass right over. For `unsafe` code, "the tests are green" is necessary but not sufficient; **Miri green** is the real bar.

### Implement it

`channel` allocates `capacity + 1` slots (one always empty), wraps the ring in an `Arc`, and hands out the two `!Sync` halves. `next()` is the wrap: increment, roll to 0 at the end.

```rust
unsafe impl<T: Send> Send for Ring<T> {}
unsafe impl<T: Send> Sync for Ring<T> {}
// SAFETY: the SPSC discipline — producer only writes tail's slot, consumer only reads head's slot,
// hand-off ordered by release/acquire on head/tail — means concurrent access never aliases a slot.

impl<T> Ring<T> {
    #[inline]
    fn next(&self, i: usize) -> usize {
        let n = i + 1;
        if n == self.buf.len() { 0 } else { n }
    }
}

pub fn channel<T>(capacity: usize) -> (Producer<T>, Consumer<T>) {
    assert!(capacity > 0, "capacity must be > 0");
    let slots = capacity + 1; // one slot always empty to tell full from empty
    let buf = (0..slots)
        .map(|_| UnsafeCell::new(MaybeUninit::uninit()))
        .collect::<Vec<_>>()
        .into_boxed_slice();
    let ring = Arc::new(Ring { buf, head: AtomicUsize::new(0), tail: AtomicUsize::new(0) });
    (
        Producer { ring: Arc::clone(&ring), _not_sync: PhantomData },
        Consumer { ring,                    _not_sync: PhantomData },
    )
}

impl<T> Producer<T> {
    pub fn try_push(&self, value: T) -> Result<(), T> {
        let ring = &*self.ring;
        let tail = ring.tail.load(Ordering::Relaxed);      // I own tail → Relaxed is fine
        let next = ring.next(tail);
        if next == ring.head.load(Ordering::Acquire) {     // Acquire: see the consumer's latest head
            return Err(value);                             // full → hand value back
        }
        // SAFETY: only the producer writes this slot, and the consumer won't read it until we
        // publish `tail` below with the Release store.
        unsafe { (*ring.buf[tail].get()).write(value) };
        ring.tail.store(next, Ordering::Release);          // publish: write happens-before consumer's read
        Ok(())
    }
}

impl<T> Consumer<T> {
    pub fn try_pop(&self) -> Option<T> {
        let ring = &*self.ring;
        let head = ring.head.load(Ordering::Relaxed);      // I own head → Relaxed is fine
        if head == ring.tail.load(Ordering::Acquire) {     // Acquire: see the producer's latest tail
            return None;                                   // empty
        }
        // SAFETY: this slot was fully written before the producer published the `tail` we just
        // acquire-loaded, and only the consumer reads it. We move the value out exactly once.
        let value = unsafe { (*ring.buf[head].get()).assume_init_read() };
        ring.head.store(ring.next(head), Ordering::Release); // publish the free slot to the producer
        Some(value)
    }
}

impl<T> Drop for Ring<T> {
    fn drop(&mut self) {
        // &mut self ⇒ single owner, no concurrency ⇒ get_mut, no atomics needed.
        let mut head = *self.head.get_mut();
        let tail = *self.tail.get_mut();
        while head != tail {
            // SAFETY: slots in [head, tail) were filled by the producer and never consumed.
            unsafe { (*self.buf[head].get()).assume_init_drop() };
            head = self.next(head);
        }
    }
}
```

The ordering, precisely: each thread reads *its own* index with `Relaxed` (no other thread writes it), reads the *other* thread's index with `Acquire`, and publishes *its own* index with `Release`. The producer's `Release` store of `tail` synchronizes-with the consumer's `Acquire` load of `tail`, so the slot write happens-before the slot read — that single edge is the entire soundness proof. `Drop` is easy precisely because it holds `&mut self`: the moment you have exclusive access there is no concurrency, so it uses `get_mut()` and plain (non-atomic) reads, and drops exactly the live range `[head, tail)`. Complexity: `try_push`/`try_pop` are O(1), branch-free on the hot path, no allocation, no lock. The key gotcha is `MaybeUninit` hygiene — you must `assume_init_read` (which *moves out*, so the slot is now logically uninit and must not be read again) and you must *not* drop slots outside `[head, tail)`, or you double-free.

### Common mistakes & senior signal

The README's "real challenge" is a checklist of traps, and each has a senior answer:

- **`unsafe` used as a mute button.** The trap is writing `unsafe impl Sync` with no reasoning. Senior move: every `unsafe` block and impl carries a `// SAFETY:` comment stating the invariant a reviewer can check — here, "producer only writes tail's slot, consumer only reads head's slot, ordered by release/acquire."
- **Wrong or lazy ordering.** `Relaxed` everywhere is a real data race (Miri catches it); `SeqCst` everywhere works but hides that you don't know *which* pair matters. Senior signal: minimal `Acquire`/`Release`, and being able to name the happens-before edge out loud.
- **No empty slot → can't tell full from empty.** If you use all N slots, `head == tail` is ambiguous. Senior fix: allocate N+1, keep one empty; avoids a shared length counter both threads would contend on (which would reintroduce contention and defeat the point).
- **`Drop` bugs.** Forgetting to drop leftover elements leaks (missed fills); using the atomics-with-ordering path in `Drop` is needless — `&mut self` means single owner, use `get_mut`. Dropping the whole buffer rather than just `[head, tail)` double-frees.
- **Letting the halves be `Sync`.** If `Producer` were `Sync`, two threads could share it and you'd have two producers racing `tail` — UB. Senior touch: `PhantomData<Cell<()>>` makes them `!Sync` so the compiler enforces single-producer/single-consumer.
- **Trusting green tests.** The deepest signal: knowing that for `unsafe` concurrent code, passing tests prove nothing about UB — you *must* run `cargo +nightly miri test -p solution spscring`, because Miri is the ThreadSanitizer analogue Rust otherwise lacks (there's no `-race` flag — safe data races don't compile, but this code opted out of safe).


