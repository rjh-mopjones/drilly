## FP Fundamentals & Philosophy

### Summary

**What this topic covers**

What "functional programming" actually means once you strip away the mystique: a style built on **expressions that compute values** rather than **statements that mutate state**, on **functions treated as ordinary values**, and on **referential transparency** — the property that a call can be replaced by its result without changing the program. It frames the two axes people conflate — declarative-vs-imperative and functional-vs-object-oriented — and is honest that the languages you interview in (Java, Kotlin, JavaScript/TypeScript, Python, Rust, C++) are **multi-paradigm**, not pure. You don't "switch to FP"; you reach for functional constructs (`map`/`filter`/`reduce`, `Optional`/`Result`, immutable data, closures) where they buy you clearer reasoning, and drop to imperative loops where they're clearer or faster. It closes with a short lineage — lambda calculus to Lisp to ML/Haskell to FP features landing in mainstream languages — so you can place the ideas historically without pretending you write Haskell.

**Mental model**

Think of a program as **a pipeline that transforms values**, not a sequence of commands that pokes at memory. Imperative code answers "what steps do I perform, in what order, on which variables?" Functional code answers "what is this value a function of?" The unlocking instinct is **referential transparency**: if `total(order)` always returns the same thing for the same `order` and touches nothing else, then you can read `total(order)` as *being* that number — cache it, move it, test it in isolation, run two of them on different threads — because it's just a value with a fancy spelling. That one property is where every advertised benefit comes from: **local reasoning** (you understand a function by its inputs, not the whole world), **trivial testing** (no mocks for a pure function — feed inputs, assert outputs), and **safe concurrency** (no shared mutable state means no data races). The practical senior move isn't purity for its own sake; it's **pushing side effects to the edges** and keeping a large pure core you can reason about, while I/O, logging, and mutation live in a thin, obvious shell.

**Key terms**

- **Expression** — code that evaluates to a value (`a + b`, `if cond then x else y`). Composes.
- **Statement** — code executed for its effect (`x = 1;`, `for (...)`). Sequences, doesn't compose.
- **Pure function** — output depends only on inputs; no observable side effects. Same input, same output.
- **Side effect** — anything a function does beyond returning a value: mutation, I/O, throwing, clock/random reads.
- **Referential transparency** — an expression can be replaced by its value without changing behaviour.
- **First-class function** — functions are values: stored in variables, passed as args, returned.
- **Higher-order function (HOF)** — a function that takes and/or returns a function (`map`, `filter`, `compose`).
- **Closure** — a function plus the captured environment of variables it references.
- **Declarative** — describe *what* result you want (`filter(evens)`); the *how* is abstracted.
- **Imperative** — describe *how*, step by step, usually via explicit control flow and mutation.
- **Immutability** — data can't be modified after creation; "changes" produce new values.
- **Multi-paradigm** — a language that supports FP, OO, and imperative styles; you mix them per problem.

**Why interviewers ask this**

FP fluency separates engineers who *use* `stream().map()` from those who understand *why* it's safe to parallelise and when it isn't. A junior recites "no side effects, immutable data." A senior can name the payoff (local reasoning, testability, concurrency), is honest about the cost (allocation pressure, unfamiliar debugging, the JVM/Python having no tail-call optimisation), and knows the mainstream reality — Java's `Optional` isn't a Haskell `Maybe`, JS closures capture by reference not by value, "immutable" in most languages is a convention not a guarantee. Interviewers use this topic to check you won't cargo-cult: that you'd write a plain loop when it's clearer, and reach for a pure pipeline when the reasoning-and-testing win is real.

**Common confusions**

- **"Functional means no loops / no variables"** → No. It means no *reliance on mutation for correctness*; a local `for` loop building a result is fine, especially where it's clearer or faster.
- **"Declarative == functional"** → Overlapping, not equal. SQL and HTML are declarative but not functional; you can write imperative code with lambdas.
- **"Lambda == closure"** → A lambda is anonymous-function *syntax*; a closure is the runtime concept of *capturing* environment. A lambda that captures nothing isn't really a closure.
- **"Pure functions can't do anything useful"** → They compute; effects get pushed to a thin edge. The core stays pure, the shell does I/O.
- **"My language is functional"** → It has functional *features*. Java/Kotlin/JS/Python/Rust are multi-paradigm; none forces purity.

**What follows from this topic**

Everything downstream builds on referential transparency. **Immutability & Persistent Data Structures** makes "no mutation" affordable. **Pure Functions & Side Effects** and **Referential Transparency** drill the core property. **Higher-Order Functions & Composition** and **Closures** turn first-class functions into reusable machinery. **Map/Filter/Reduce** is the declarative pipeline in practice; **Optional/Result & Error Handling** and **Functors/Monads** formalise chaining. The **FP vs OOP** topic contrasts this worldview with the object model (owned by the OOD & Design Patterns primer), and **Immutability & Concurrency** connects it to safe sharing (the Concurrency primer owns the memory model itself).

### Q1. What is functional programming, in one honest sentence — and what does it *not* mean?

FP is **programming with pure functions over immutable values, treating functions as first-class data, and preferring expressions to statements** — so that most of your code is referentially transparent and thus easy to reason about, test, and parallelise. What it does *not* mean: banning loops, banning variables, or requiring Haskell. In mainstream languages FP is a **discipline you apply selectively**, not a mode you switch into. The realistic senior framing is "**functional core, imperative shell**": a large body of pure transformations, wrapped in a thin layer that does I/O and mutation. You get the reasoning benefits where they matter without pretending your runtime is pure.

### Q2. Expressions vs statements — why does FP prefer expressions, and how do languages differ?

An **expression evaluates to a value and composes**; a **statement executes for a side effect and only sequences**. Expression-oriented code is easier to reason about because every piece *is* something, not *does* something. Kotlin, Rust, and Scala make `if`, `when`/`match`, and blocks into expressions; Java and Python keep `if` as a statement and offer a ternary/conditional-expression instead.

```kotlin
// Kotlin: if is an expression — no reassignment needed
val label = if (score >= 50) "pass" else "fail"

// when is an expression too
val kind = when {
    n < 0  -> "negative"
    n == 0 -> "zero"
    else   -> "positive"
}
```

```rust
// Rust: match and blocks are expressions; the tail value is returned
let label = if score >= 50 { "pass" } else { "fail" };
let abs = { let x = n.abs(); x };   // block evaluates to x
```

```python
label = "pass" if score >= 50 else "fail"   # Python: if is a statement, so use a conditional expression
```

The payoff: expression form removes the mutable temporary (`var label; if (...) label = ...`) and makes the value's definition a single, movable, testable thing.

### Q3. What are first-class and higher-order functions? Show them across languages.

**First-class** means functions are values — assign them, pass them, return them, store them in data structures. A **higher-order function** takes a function as an argument or returns one. This is the mechanism that makes `map`/`filter`/`reduce`, dependency injection, callbacks, and strategy-style code work without ceremony.

```javascript
// JS: functions passed and returned
const twice = f => x => f(f(x));      // returns a function
const inc = x => x + 1;
twice(inc)(10);                       // 12

[1, 2, 3].map(inc);                   // [2, 3, 4]  — map is higher-order
```

```java
// Java: functions as values via functional interfaces
Function<Integer, Integer> inc = x -> x + 1;
List.of(1, 2, 3).stream().map(inc).toList();   // [2, 3, 4]

// returning a function
Function<Integer, Function<Integer,Integer>> adder = a -> b -> a + b;
adder.apply(3).apply(4);                        // 7
```

```python
def compose(f, g):
    return lambda x: f(g(x))          # returns a new function

inc = lambda x: x + 1
dbl = lambda x: x * 2
compose(inc, dbl)(10)                 # 21
```

Interview nuance: Java has no bare function type — you route through `Function`, `Predicate`, `Supplier`, etc. Go has real function types but no generics-free `map` in the stdlib historically. The *concept* is identical; the *ergonomics* vary.

### Q4. Define referential transparency and prove why it matters with a concrete example.

An expression is **referentially transparent** if replacing it with its computed value leaves program behaviour unchanged — equivalently, the function is **pure**: output depends only on inputs, and it causes no observable effects. Its practical value is **substitution**: you can cache it, reorder it, hoist it out of a loop, or run copies concurrently, because it's just a value.

```javascript
// Referentially transparent: price(order) can be replaced by its result
const price = order => order.items.reduce((s, i) => s + i.cost, 0);

// NOT transparent: reads a mutable global, so its value depends on hidden state
let taxRate = 0.2;
const priceWithTax = order => price(order) * (1 + taxRate);  // changes if taxRate mutates
```

`price(order)` can be memoised or parallelised freely. `priceWithTax` cannot be substituted safely, because two calls with the "same" argument can differ. Fix it by making the dependency explicit: `priceWithTax(order, taxRate)`. That single change — turning a hidden input into a parameter — is the everyday move that buys testability and thread-safety. It's also why interviewers probe it: it's the property from which every other FP benefit is derived.

### Q5. Declarative vs imperative — refactor an imperative loop into a functional pipeline.

Imperative says *how* (init accumulator, iterate, mutate, guard). Declarative says *what* (keep the active adult users' names, uppercased). The pipeline reads as a description of the result.

```java
// Imperative
List<String> names = new ArrayList<>();
for (User u : users) {
    if (u.isActive() && u.age() >= 18) {
        names.add(u.name().toUpperCase());
    }
}
```

```java
// Declarative — Java Streams
List<String> names = users.stream()
    .filter(User::isActive)
    .filter(u -> u.age() >= 18)
    .map(u -> u.name().toUpperCase())
    .toList();
```

```kotlin
// Kotlin — same shape, sequence for laziness on large inputs
val names = users.asSequence()
    .filter { it.isActive && it.age >= 18 }
    .map { it.name.uppercase() }
    .toList()
```

Honest tradeoff: the pipeline is clearer for transform/filter/aggregate, but a plain loop can be *more* readable for early-exit-with-index logic or when you're mutating two accumulators at once — and on hot paths a manual loop avoids per-stage allocation. Declarative isn't automatically better; it's better when it removes bookkeeping.

### Q6. Higher-order functions and composition — how do you build behaviour by combining functions?

**Composition** glues small functions into bigger ones: `(f ∘ g)(x) = f(g(x))`. It's the functional analogue of building a pipeline, and it's how you get reuse without inheritance. Some languages give it directly; in others you write a two-line helper.

```kotlin
// Kotlin has function composition built in
val parse: (String) -> Int = String::toInt
val square: (Int) -> Int = { it * it }
val parseAndSquare = parse andThen square      // andThen = g after f
parseAndSquare("5")                            // 25
```

```javascript
// JS: compose your own; runs right-to-left
const compose = (...fns) => x => fns.reduceRight((acc, f) => f(acc), x);
const clean = compose(s => s.trim(), s => s.toLowerCase());
clean("  HELLO ");                              // "hello"
```

```rust
// Rust: closures compose via chaining or nesting; iterator adaptors compose lazily
let process = |s: &str| s.trim().to_lowercase();
```

Composition beats a tangle of flags: instead of one `process(input, doTrim, doLower)` with boolean parameters, you assemble exactly the pipeline you need. This is also the FP counterpart to the Decorator/Strategy patterns (owned by the OOD primer) — same intent, less boilerplate.

### Q7. What is a closure, and what's the classic gotcha with captured variables?

A **closure** is a function bundled with the environment it captures — the free variables it references from an enclosing scope. It's how a returned function "remembers" state. The gotcha is **capture semantics**: most languages capture the *variable* (by reference), not a snapshot of its *value*, so a loop that creates closures can have them all see the final value.

```javascript
// JS gotcha: var is function-scoped and captured by reference
var fns = [];
for (var i = 0; i < 3; i++) fns.push(() => i);
fns.map(f => f());          // [3, 3, 3]  — all see the final i

// Fix: let is block-scoped — a fresh binding per iteration
let gns = [];
for (let j = 0; j < 3; j++) gns.push(() => j);
gns.map(f => f());          // [0, 1, 2]
```

```python
fns = [lambda: i for i in range(3)]    # Python captures by reference too — same trap
[f() for f in fns]                 # [2, 2, 2]
fns = [lambda i=i: i for i in range(3)]   # Fix: bind per-iteration via a default argument
[f() for f in fns]                 # [0, 1, 2]
```

Rust makes capture explicit (`move` closures take ownership; otherwise borrow), which sidesteps the aliasing surprise but introduces borrow-checker constraints instead. The senior point: know whether your language captures by reference or value, because it changes correctness inside loops and async callbacks.

### Q8. If mainstream languages are multi-paradigm, what does "using FP" actually look like day-to-day?

It looks like reaching for specific constructs, not rewriting everything. Concretely: **`Optional`/`Result` instead of null and exceptions** for expected absence/failure; **immutable data** (`record` in Java, `data class` + `val` in Kotlin, frozen objects / tuples, Rust's default immutability); **`map`/`filter`/`reduce` pipelines** instead of accumulator loops; **pure helper functions** you can unit-test without mocks; **pushing I/O to the edges** so business logic stays pure.

```kotlin
// Idiomatic-FP Kotlin without being dogmatic
data class Order(val items: List<Item>)               // immutable
fun total(o: Order): Int = o.items.sumOf { it.cost }  // pure

fun discounted(o: Order, rate: Double): Order =        // returns new value, no mutation
    o.copy(items = o.items.map { it.copy(cost = (it.cost * (1 - rate)).toInt()) })
```

Nobody in these languages writes monad transformers in production Java. The bar is: *pure core, effects at the edge, immutable-by-default data, expressions over statements.* That's "using FP" pragmatically — and it's exactly what an interviewer wants to hear instead of purity absolutism.

### Q9. Give the short history: lambda calculus to Lisp to ML/Haskell to today's mainstream FP features.

- **1930s — Lambda calculus (Church).** A formal model of computation built entirely from functions and application; the theoretical root of FP and the meaning of "everything is a function."
- **1958 — Lisp (McCarthy).** First practical functional-ish language: first-class functions, recursion, code-as-data, garbage collection. Not pure, but it put functions-as-values into practice.
- **1970s — ML (Milner).** Brought Hindley–Milner type inference, algebraic data types, and pattern matching — the ancestry of today's `sealed`/`enum` + `match`.
- **1990 — Haskell.** The reference *pure, lazy* functional language; codified type classes, monads for structuring effects, and referential transparency as a hard rule.
- **2000s–2010s — mainstream absorption.** Scala (2004) and F# (2005) fused FP with OO on the JVM/CLR. Then the features diffused: Java 8 (2014) added lambdas, `Stream`, `Optional`; Kotlin, Swift, and modern C++ shipped lambdas and immutability idioms; JS got arrow functions and `map`/`filter`/`reduce`; Rust built iterators, `Option`/`Result`, and pattern matching into its core.

The takeaway for an interview: the *ideas* are old and settled; what changed is that **pragmatic languages adopted the useful 20%** (first-class functions, immutability, ADTs, pattern matching, `Option`/`Result`) while leaving purity optional.

### Q10. When is FP the wrong call? Be honest about the costs.

Reaching for FP everywhere is its own anti-pattern. Real costs:

- **Allocation & GC pressure.** Immutable "copy-on-change" and multi-stage pipelines allocate. On hot paths a mutable loop can be meaningfully faster; measure before going pure.
- **No tail-call optimisation on some runtimes.** The **JVM has no general TCO** and **CPython has none**, so deep functional recursion blows the stack — you need explicit iteration, trampolines, or an accumulator loop. Scala's `@tailrec` and Kotlin's `tailrec` only handle direct self-recursion.
- **Debuggability.** A stack of `map`/`flatMap` can be harder to step through than a loop, and lazy sequences make "where did this run?" non-obvious.
- **Team fluency & ergonomics.** Deep FP (monad stacks, point-free style) can be write-only for a mixed team. Java's `Optional` is clunky as a field; JS lacks a native `Result`.

The senior instinct is *proportionate* FP: pure functions and immutable data as defaults because they pay for themselves in testability and safe concurrency, plain imperative code where it's clearer or where the profiler says so.

### Q11. The interview one-liner: functional programming in one crisp paragraph.

Functional programming is **building software out of pure functions over immutable values, with functions themselves as first-class data and expressions preferred to statements**, so that most of your code is **referentially transparent** — any call can be replaced by its result. That single property is the source of every real benefit: **local reasoning** (understand a function from its inputs alone), **effortless testing** (no mocks — inputs in, outputs asserted), and **safe concurrency** (no shared mutable state, no data races). In practice you don't adopt a pure language; you write a **functional core wrapped in an imperative shell** inside multi-paradigm languages (Java, Kotlin, JS/TS, Python, Rust), using `Optional`/`Result`, immutable data, and `map`/`filter`/`reduce` where they clarify, and dropping to a plain loop where that's clearer or faster — honest about the costs (allocation, no TCO on the JVM/CPython, debuggability) rather than chasing purity for its own sake.


## Pure Functions & Side Effects

### Summary

**What this topic covers**

The most load-bearing idea in functional programming: a **pure function** is one whose output depends only on its arguments and which does nothing observable except return a value. This topic pins down the precise definition (deterministic + no side effects), enumerates what actually counts as a side effect (I/O, mutation, reading the clock, randomness, throwing, touching global state), and — crucially — what purity *buys* you: tests without mocks, safe memoization and caching, referential transparency, local reasoning, and trivial parallelism. It then gets pragmatic about the languages you actually interview in. None of Java, Kotlin, JS/TS, Python, or Rust *enforces* purity the way an effect-tracked language (Haskell, PureScript, Koka) does — purity in the mainstream is a **discipline plus a few language affordances** (`const`, immutability, `record`/`data class`, `Result`). We finish with the workhorse skill: spotting effects and pushing them to the edges so a pure core stays testable.

**Mental model**

Think of a pure function as a **mathematical mapping frozen into code**: give it the same input and it returns the same output, forever, and calling it changes nothing else in the universe. The practical consequence — the whole reason this matters — is **referential transparency**: you can replace any call with its result (or vice-versa) without changing the program's meaning. That single property is what makes pure code cacheable, reorderable, parallelizable, and testable by simple equality assertions. The senior instinct is not "make everything pure" — that's impossible; a program that does nothing observable is useless. It's **functional core, imperative shell**: concentrate decisions and computation in pure functions, and quarantine the effects (DB, network, clock, logging) in a thin outer layer you keep dumb. When a bug appears, you know the messy part is small and the reasoning-heavy part is deterministic. Purity is a tool for *managing* effects, not abolishing them.

**Key terms**

- **Pure function** — same input → same output, and no observable side effect. Both halves required.
- **Side effect** — any observable interaction with the world beyond returning a value: mutation, I/O, throwing, reading time/randomness, global state.
- **Referential transparency** — an expression can be replaced by its value without changing program behaviour. The formal name for what purity gives you.
- **Determinism** — same inputs always yield the same output; a necessary (not sufficient) condition for purity.
- **Idempotence** — calling twice has the same effect as once. Related but distinct: idempotent effects can still be impure.
- **Memoization** — caching a pure function's result by its arguments; only sound when the function is pure.
- **Functional core, imperative shell** — architecture that isolates pure computation from effectful edges.
- **Referentially opaque** — the opposite; a call that can't be substituted for its value (e.g. `readLine()`, `now()`).
- **Effect** — a description or occurrence of interaction with the outside world; effect-*tracked* languages encode it in the type.
- **Observable** — a side effect only breaks purity if something outside the call can detect it; internal local mutation is fine.

**Why interviewers ask this**

Purity is the concept everything else in FP (immutability, higher-order functions, monads, parallelism) leans on, so it's a fast senior-vs-junior filter. A junior recites "no side effects." A senior names *both* conditions, gives a crisp taxonomy of effects, and — the real signal — explains the *payoff* and the *tradeoff*: pure functions are trivial to test and parallelize, but purity is a spectrum in mainstream languages and chasing 100% purity in Java or Python is often overkill. The strongest candidates immediately reach for "functional core, imperative shell" and can take an impure function and refactor it — pulling the clock, the DB call, or the `println` out as parameters or return values — while explaining what testability they just bought. Bonus signal: knowing that the JVM/Python/JS runtimes don't *enforce* any of this, so it's a convention you uphold, not a guarantee the compiler gives you.

**Common confusions**

- "Pure means no mutation" — incomplete. A function can mutate a *local* it created and stay pure (no *observable* effect); it's impure only if the mutation escapes or touches shared state.
- "Throwing keeps it pure because it returns nothing" — no; an exception is a non-local side effect and control-flow observable to the caller. Model failure with `Optional`/`Result` to stay pure.
- "It reads from a cache, so it's impure" — reading an internal memo table is unobservable and stays pure; reading a *mutable global* the caller can change is not.
- "Logging is harmless" — logging is I/O; a function that logs is impure. Usually you accept it, but name it.
- "Deterministic = pure" — a function can be deterministic yet impure (it writes a file every call). Purity needs *both* determinism and effect-freedom.
- "`const` in JS makes it pure" — `const` only stops rebinding the name; the referenced object is still mutable. Purity is about behaviour, not a keyword.

**What follows from this topic**

Purity is the foundation the rest of this primer builds on. **Immutability** is the discipline that makes purity *practical* — you can't accidentally mutate shared state if the data can't be mutated. **Higher-order functions** (`map`/`filter`/`reduce`) are valuable precisely because pure transformations compose and can run in parallel. **Referential transparency** here is the same property that lets **monads** (`Optional`, `Result`, `Promise`) sequence effects while keeping the pure parts pure. And the **FP-vs-OOP** contrast is largely a debate about where you put your effects. If purity feels fuzzy, nail it now; every later topic assumes you can tell a pure expression from an effectful one at a glance.

### Q1. Define a pure function precisely. What are the two conditions?

A function is **pure** if it satisfies **both**:

1. **Determinism** — for the same arguments it always returns the same result. No dependence on hidden inputs (clock, randomness, global mutable state, I/O).
2. **No observable side effects** — evaluating it does nothing the outside world can detect except produce the return value: no mutation of shared state, no I/O, no throwing to signal control flow, no writing to logs or files.

Both are required. A function reading `System.currentTimeMillis()` is effect-free but not deterministic. A function that always returns `42` but writes to a file is deterministic but not effect-free. Only when *both* hold do you get **referential transparency** — the ability to swap the call for its value.

```kotlin
fun add(a: Int, b: Int): Int = a + b          // pure: deterministic, no effects
fun addAndLog(a: Int, b: Int): Int {          // impure: I/O side effect
    println("adding $a and $b")               // observable interaction
    return a + b
}
```

The subtle word is **observable**. Purity is defined by what a caller can detect, not by what happens internally — which is why local mutation is allowed (see Q4).

### Q2. What counts as a side effect? Give the full taxonomy.

Anything a caller can observe beyond the returned value:

| Category | Examples | Why impure |
|---|---|---|
| **I/O** | `print`, file read/write, network, DB query | interacts with outside world |
| **Mutation of shared state** | writing a field, a passed-in list, a global | observable to other holders of the reference |
| **Time** | `now()`, `currentTimeMillis`, uptime | non-deterministic input |
| **Randomness** | `Math.random()`, `Random.nextInt()` | non-deterministic input |
| **Throwing exceptions** | `throw` to signal a case | non-local control-flow effect |
| **Global / ambient state** | env vars, static counters, singletons | hidden input and/or output |

Two litmus tests. **The substitution test**: can I replace `f(x)` with the value it returned, everywhere, without changing behaviour? If not, it's impure. **The twice test**: does calling it twice differ observably from calling it once and reusing the value? If yes, impure.

```python
counter = 0
def next_id():          # impure: reads AND writes global, non-deterministic
    global counter
    counter += 1        # mutation of shared state at end-of-line, note the effect
    return counter
```

Each call returns a different value — fails determinism *and* mutates global state.

### Q3. What does purity actually buy you? Why care?

Five concrete payoffs, roughly in order of how often they matter:

- **Testability without mocks** — a pure function is tested by asserting `f(input) == expected`. No stubbing a clock, no fake DB, no mock of the filesystem. This is the biggest day-to-day win.
- **Referential transparency** — you can reason by substitution, refactor fearlessly, and the compiler/JIT can safely hoist or eliminate calls.
- **Memoization / caching** — because the result depends only on inputs, you can cache by argument key. Only sound for pure functions.
- **Parallelism & reordering** — no shared mutable state means no data races; pure `map` over a collection parallelizes trivially (Java `parallelStream`, Rust Rayon `par_iter`).
- **Local reasoning** — you understand a pure function by reading *it alone*, not by tracing global state across the program. Debugging shrinks to "what did I pass in."

```java
// Pure -> safe to run in parallel, no locks needed
double total = prices.parallelStream()
                     .mapToDouble(p -> p * 1.2)   // pure transform
                     .sum();
```

The senior framing: purity converts *temporal* reasoning ("what's the state right now?") into *value* reasoning ("what's this a function of?"), which is dramatically cheaper.

### Q4. Can a pure function mutate anything? Isn't mutation always impure?

No — **local, non-escaping mutation is fine**. Purity is about *observable* effects. If a function creates a buffer, mutates it internally, and returns a fresh value without leaking the mutable reference, no caller can tell mutation happened. This matters for performance: you don't need persistent data structures everywhere to be pure.

```kotlin
fun sum(xs: List<Int>): Int {
    var acc = 0                 // local, created here
    for (x in xs) acc += x      // mutation the caller cannot observe
    return acc                  // pure overall: same input -> same output
}
```

Contrast with mutating a *shared* input, which is observable and therefore impure:

```kotlin
fun addOneToEach(xs: MutableList<Int>) {
    for (i in xs.indices) xs[i] += 1   // mutates caller's list -> IMPURE
}
```

Rust makes this distinction explicit in the type system: `&mut self` / `&mut arg` signals observable mutation, while owning and returning a value keeps effects local. The rule: **mutation you own and don't leak is invisible; mutation of something the caller can still see is a side effect.**

### Q5. Show the same computation pure and impure across languages.

The impure version reaches out to the world; the pure version takes everything as input.

```javascript
// JS — impure: reads Date.now(), a hidden non-deterministic input
function greeting(name) {
    const hour = new Date().getHours();
    return hour < 12 ? `Morning, ${name}` : `Hello, ${name}`;
}
// pure: the effectful input becomes a parameter
function greetingPure(name, hour) {
    return hour < 12 ? `Morning, ${name}` : `Hello, ${name}`;
}
```

```python
def greeting_pure(name, hour):      # deterministic: hour is passed in
    return f"Morning, {name}" if hour < 12 else f"Hello, {name}"
```

```rust
fn greeting_pure(name: &str, hour: u8) -> String {
    if hour < 12 { format!("Morning, {name}") } else { format!("Hello, {name}") }
}
```

The trick is nearly always the same: **turn a hidden input (clock, config, random seed, DB handle) into an explicit parameter.** Now the impurity lives in *one* place — whoever calls `greetingPure(name, new Date().getHours())` — and the interesting logic is pure and testable.

### Q6. Walk through refactoring an impure function into a pure core.

Take a function that computes a discounted total, reads the clock for a "happy hour" rule, and logs.

```java
// BEFORE — impure: clock, logging, all tangled with the logic
double checkout(List<Item> items) {
    double total = items.stream().mapToDouble(Item::price).sum();
    if (LocalTime.now().getHour() < 10) total *= 0.9;   // hidden clock input
    System.out.println("total=" + total);               // I/O
    return total;
}
```

Separate the *decision* (pure) from the *effects* (shell):

```java
// AFTER — pure core: everything it needs is an argument
double checkoutPure(List<Item> items, int hour) {
    double total = items.stream().mapToDouble(Item::price).sum();
    return hour < 10 ? total * 0.9 : total;
}

// thin imperative shell: gathers effects, calls the pure core, performs I/O
double checkout(List<Item> items) {
    double total = checkoutPure(items, LocalTime.now().getHour());
    log.info("total={}", total);
    return total;
}
```

You can now unit-test `checkoutPure(items, 9)` and `checkoutPure(items, 11)` with plain assertions — no clock mocking, no captured stdout. The effects didn't vanish; they moved to a shell so dumb it barely needs testing. This **functional core, imperative shell** move is the single most useful thing this topic teaches.

### Q7. How do exceptions relate to purity, and how do you stay pure around failure?

Throwing to signal a case is a **side effect** — a non-local jump the caller observes, and it breaks referential transparency (you can't substitute the call for a value; it might unwind the stack instead). A purist models failure as a **value** you return, using sum types:

```kotlin
// Kotlin: Result / sealed types instead of throwing
sealed interface Parsed
data class Ok(val n: Int) : Parsed
data object Bad : Parsed

fun parse(s: String): Parsed =
    s.toIntOrNull()?.let(::Ok) ?: Bad    // total, pure: every input -> a value
```

```rust
// Rust: Result is the idiom; no exceptions for recoverable errors
fn parse(s: &str) -> Result<i32, std::num::ParseIntError> {
    s.parse::<i32>()   // returns Err instead of throwing
}
```

Java's `Optional`, Kotlin's `Result`/`null`, Rust's `Result`, and Haskell's `Either` all serve this: turn "might fail" into a return type. The payoff is that a **total, value-returning** function stays pure and composes with `map`/`flatMap` (the monad topic). Pragmatically, most JVM/Python code still throws for truly exceptional cases — that's fine — but for *expected* failure (parse, lookup, validation), returning a value keeps your core pure and forces the caller to handle it.

### Q8. Do any mainstream languages enforce purity? What do they actually give you?

**None of the mainstream ones enforce it.** Java, Kotlin, JS/TS, Python, C#, Rust — all let a function do arbitrary I/O with no type-level marker. Purity is a **convention** you maintain, aided by a few affordances:

| Language | Helps purity | But… |
|---|---|---|
| **Java** | `record` (immutable data), `final`, `Stream` | nothing stops a lambda doing I/O |
| **Kotlin** | `val`, `data class`, `copy()`, expression bodies | `val` ref can point at mutable state |
| **JS/TS** | `const`, `readonly`, `Object.freeze`, TS types | `const` blocks rebinding only; closures capture by reference |
| **Python** | tuples, `@dataclass(frozen=True)` | everything mutable by default |
| **Rust** | ownership, `&` vs `&mut`, no nulls | `&mut`/`unsafe`/interior mutability still allow effects |

Only **effect-tracked** languages make purity a *type-checked guarantee*. In **Haskell** an effectful action has type `IO a`, so the compiler physically separates pure functions from ones that touch the world — you cannot call `putStrLn` from a function typed as pure. Languages like **Koka** and **PureScript** track effects in row-typed signatures. That rigor is the exception; in the languages you interview in, **the compiler won't catch an impure function for you** — code review, naming, and architecture do. Be honest about this in interviews: don't claim Java "makes" code pure.

### Q9. If side effects are unavoidable, how do you get purity's benefits in a real app?

You **push effects to the edges** and keep the middle pure — the *functional core, imperative shell* pattern, and the closest a mainstream codebase gets to Haskell's `IO` discipline without the type system.

- **Effects at the boundary**: reading config, DB, HTTP, clock, and random happen at the top (controllers, `main`, request handlers). They gather raw data.
- **Pure core**: business logic takes plain values in, returns plain values (or a `Result`/command describing *what* to do). It decides; it doesn't act.
- **Effects at the boundary again**: the shell interprets the core's decision — writes to the DB, sends the response.

```typescript
// pure core: decides, returns a description of the effect
function decideEmail(user: User, now: Date): EmailCommand | null {
    return user.trialEndsWithin(now, 3) ? { to: user.email, template: "renew" } : null;
}
// impure shell: gathers input, runs the decision, performs the effect
const cmd = decideEmail(user, new Date());
if (cmd) await mailer.send(cmd);          // the only I/O
```

The core is 90% of your logic and 100% testable with equality assertions; the shell is thin and boring. This is how teams get purity's *reasoning and testing* wins without pretending I/O doesn't exist.

### Q10. Give a gotcha: something that looks pure but isn't (or vice-versa).

The classic trap is a function that returns the right value but **mutates an argument** — it passes a naive "same output" test yet is impure:

```javascript
function firstThree(arr) {
    return arr.splice(0, 3);   // LOOKS like a read; splice MUTATES arr -> IMPURE
}
const xs = [1,2,3,4,5];
firstThree(xs);   // returns [1,2,3] ... but xs is now [4,5]!
// pure version:
const firstThreePure = arr => arr.slice(0, 3);   // slice copies, no mutation
```

The reverse trap: a **memoized** function looks impure (it has a hidden cache it writes to) but is *pure to observers* — the cache is unobservable and the returned value depends only on inputs:

```python
from functools import lru_cache
@lru_cache(maxsize=None)
def fib(n):                       # writes an internal cache, yet still pure
    return n if n < 2 else fib(n-1) + fib(n-2)
```

And JS closures bite here: a "pure-looking" function that closes over a variable captured **by reference** silently depends on hidden mutable state — change the captured variable elsewhere and the function's output changes for the same argument. Purity is about *observable behaviour under substitution*, not surface syntax — always apply the twice test and the substitution test rather than trusting how the code looks.

### Q11. The interview one-liner: pure functions & side effects in one crisp paragraph.

A **pure function** returns the same output for the same input and does nothing else observable — no mutation of shared state, no I/O, no clock or randomness, no throwing — which makes it **referentially transparent**: you can replace the call with its result anywhere. That single property is what buys you tests without mocks, safe memoization, and free parallelism, and it's why FP pushes decisions into pure functions. A **side effect** is any of those observable interactions; local mutation you don't leak is fine because no one can see it. No mainstream language (Java, Kotlin, JS, Python, Rust) *enforces* purity — only effect-tracked languages like Haskell do — so in practice you maintain it by discipline: **functional core, imperative shell**, keeping a pure, testable middle and quarantining effects at the edges. The goal is never 100% purity — a useful program must touch the world — but concentrating and shrinking your effects so the reasoning-heavy code stays deterministic.


## Immutability & Persistent Data Structures

### Summary

**What this topic covers**

Immutability is the FP idea with the widest mainstream payoff: once constructed, a value never changes, so every reference to it is permanently trustworthy. This topic covers *why* that matters (safe sharing without defensive copies, effortless thread-safety, undo/time-travel, cache keys that stay valid), the difference between **value** and **reference** semantics, the concrete tools each mainstream language gives you (Java `record` + `final` + `Collections.unmodifiableList`, Kotlin `val` + `data class` `copy`, JS `const` + `Object.freeze` + spread, Python `tuple`/`frozenset`/`@dataclass(frozen=True)`, Rust's immutable-by-default bindings and ownership), and the piece most engineers miss: **persistent data structures** that make "return a modified copy" cheap via **structural sharing** (HAMTs, persistent trees) instead of O(n) copying. It closes with the honest cost/performance tradeoff — immutability is not free, and knowing when the allocation churn actually bites is a senior signal.

**Mental model**

Think of an immutable value as a **photograph, not a whiteboard**. A whiteboard (mutable object) is the same object before and after you edit it — anyone holding a reference sees your edit, whether they wanted it or not. A photograph never changes; to "edit" it you produce a *new* photograph and hand that out, leaving every existing copy untouched. The consequence that makes it click: if a value can't change, **sharing is free and aliasing is harmless** — no defensive copies, no "who else has a reference to this list", no locks to guard a read. The apparent objection — "copying on every change is O(n)" — is answered by structural sharing: the new version reuses the unchanged sub-structure of the old one and only allocates the spine along the path that changed. So "modify" becomes O(log n) allocation, not O(n), and the old version stays valid for free. That single trick is what makes immutability practical at scale, and it's why Clojure, Scala, Immutable.js, and Kotlin's persistent collections exist.

**Key terms**

- **Immutable** — state fixed at construction; no observable mutation afterward.
- **Value semantics** — a variable *is* its value; assignment/passing conceptually copies (Rust structs, `int`, Python `tuple`).
- **Reference semantics** — a variable is a handle to shared state; two variables can alias one mutable object (Java objects, JS objects).
- **Shallow vs deep immutability** — a `final`/`const` binding freezes the *reference*, not the object it points to; deep immutability freezes all the way down.
- **Defensive copy** — cloning input/output to stop callers mutating your internals; unnecessary when values are immutable.
- **Copy-on-write (COW)** — produce a full new copy on mutation; simple but O(n) per change.
- **Structural sharing** — the new version reuses the old version's untouched nodes; only the changed path is reallocated.
- **Persistent data structure** — an immutable collection whose "updates" return a new version while old versions remain valid and cheap, via structural sharing.
- **HAMT** — Hash Array Mapped Trie; the tree backing persistent maps/sets (Clojure, Immutable.js, Scala `Vector`/`HashMap`).
- **Freeze** — a runtime seal (`Object.freeze`, `Collections.unmodifiable*`) enforcing "no writes" — distinct from compile-time immutability.
- **Interning / canonicalization** — safely caching immutable values because they can never change out from under the cache.

**Why interviewers ask this**

A junior says "immutable means you can't change it" and stops. A senior explains the *downstream* wins — that immutability is what makes concurrency safe (no data races on read-only data), what makes Redux/React state predictable (reference equality tells you what changed), what lets you keep undo history for free, and what removes a whole class of aliasing bugs. The strongest signal is nuance in **both directions**: knowing that `final` in Java and `const` in JS are shallow, that `Object.freeze` is one level deep, that immutability trades allocation and GC pressure for safety, and that naive copy-on-write is O(n) while persistent structures are O(log n). Interviewers use this to check whether you reach for immutability by default and know when its cost is real (hot loops, huge arrays, tight memory) versus imagined.

**Common confusions**

- **"`final`/`const`/`val` makes the object immutable"** → No. It makes the *binding* immutable. `final List<String> xs` still allows `xs.add(...)`; `const obj` still allows `obj.x = 1`. You need `unmodifiableList`/`freeze`/an immutable type for the contents.
- **"Immutable means copying everything on every change, so it's slow"** → Only with naive COW. Persistent structures share structure; updates are O(log n), not O(n).
- **"`Object.freeze` deep-freezes"** → It's shallow — nested objects stay mutable unless you recurse.
- **"A `record`/`data class` is automatically deeply immutable"** → Only if every field is itself immutable. A `record` holding a mutable `List` leaks mutation through the accessor.
- **"Value vs reference semantics is about `==`"** → It's about whether assignment aliases or copies; equality behavior is a downstream consequence.

**What follows from this topic**

Immutability is the backbone of the rest of this primer. Pure functions (see the purity topic) *require* not mutating their inputs — immutable data makes purity the path of least resistance. Referential transparency depends on values that don't change under you. The concurrency topic builds directly on this: immutable data is safe to share across threads with no locks (that primer owns the memory-model details — here we only note the consequence). And the FP-vs-OOP contrast leans on immutability to explain why FP prefers transforming values over mutating objects in place.

### Q1. Why is immutability worth the trouble — what do you actually get?

Four concrete wins, in rough order of how often they pay off:

1. **Safe sharing / no defensive copies.** If a value can't change, handing out a reference is harmless. Mutable APIs force defensive copying to protect internals:

```java
// Mutable: must copy in AND out, or callers corrupt your state
class Order {
    private final List<Item> items;
    Order(List<Item> items) { this.items = new ArrayList<>(items); }   // copy in
    List<Item> getItems() { return new ArrayList<>(items); }           // copy out
}
// Immutable: hand out the reference, no copy needed
record Order(List<Item> items) {                 // items is an immutable list
    Order { items = List.copyOf(items); }        // canonicalize once at the boundary
}
```

2. **Thread-safety for free.** Read-only data has no data races; no locks needed on reads. (The Concurrency primer owns the memory-model rules — the point here is immutable state removes the problem.)
3. **Time-travel / undo / audit.** Old versions stay valid, so keeping history is just keeping old references — the basis of Redux, event sourcing, and editor undo stacks.
4. **Trustworthy caches and keys.** An immutable value's hash never changes, so it's a safe `Map` key and safe to memoize/intern.

### Q2. Value semantics vs reference semantics — what's the distinction and why does it matter here?

**Value semantics:** a variable *is* its value; passing or assigning conceptually copies it, so no two variables share mutable state. **Reference semantics:** a variable is a handle; two variables can point at the *same* mutable object, so a write through one is visible through the other (aliasing).

```js
// JS objects: reference semantics — aliasing bites
const a = { n: 1 };
const b = a;
b.n = 2;
console.log(a.n);   // 2  — a and b alias the same object

// Primitives: value semantics
let x = 1, y = x;
y = 2;
console.log(x);     // 1  — independent
```

```rust
// Rust: immutable by default; ownership prevents shared mutation at compile time
let a = String::from("hi");
let b = a.clone();          // explicit copy — no accidental aliasing
let c = &a;                 // shared borrow is read-only; you literally cannot mutate through it
```

Immutability sidesteps the whole distinction: if the shared thing can't change, it *doesn't matter* whether two variables alias it. Aliasing is only dangerous because of mutation.

### Q3. Show me the immutability tools in each mainstream language.

```java
// Java: record (immutable carrier) + final + unmodifiable view
record Point(int x, int y) {}                     // no setters, final fields
List<Integer> xs = List.of(1, 2, 3);              // immutable list (throws on add)
var frozen = Collections.unmodifiableList(src);   // read-only *view* (source can still change!)
```

```kotlin
// Kotlin: val binding + data class copy()
data class Point(val x: Int, val y: Int)
val p = Point(1, 2)
val p2 = p.copy(y = 9)          // new instance; p unchanged
val xs = listOf(1, 2, 3)        // read-only List interface (not a guarantee of deep immutability)
```

```python
from dataclasses import dataclass   # tuple / frozenset / frozen dataclass
@dataclass(frozen=True)
class Point:                    # __setattr__ raises FrozenInstanceError
    x: int
    y: int
coords = (1, 2)                 # tuple: immutable sequence
tags = frozenset({"a", "b"})    # immutable, hashable set
```

```js
// JS: const binding + Object.freeze + spread for "copy with change"
const p = Object.freeze({ x: 1, y: 2 });     // shallow freeze
const p2 = { ...p, y: 9 };                    // new object, p untouched
```

```rust
// Rust: bindings are immutable unless you opt into `mut`
let p = (1, 2);                 // immutable by default
// p.0 = 5;  -> compile error
let mut q = (1, 2);
q.0 = 5;                        // must be explicit
```

Note what each one *doesn't* give you: `final`/`val`/`const` freeze the binding, not the graph; `unmodifiableList` is a view over a possibly-mutable source; `Object.freeze` is one level deep.

### Q4. `final` / `const` / `val` — do they make things immutable?

No — they make the **binding** immutable, not the referenced object. This is the single most common immutability bug.

```java
final List<String> xs = new ArrayList<>();
xs.add("boom");        // fine — the list mutates; only reassigning `xs` is forbidden
// xs = other;         // this is what final actually prevents
```

```js
const obj = { n: 1 };
obj.n = 2;             // allowed — const forbids reassigning `obj`, not mutating it
```

```kotlin
val list = mutableListOf(1)
list.add(2)            // allowed — val is the reference; the list is mutable
```

To get immutable *contents* you need an immutable type or a freeze: `List.of(...)` / `List.copyOf(...)` in Java, `Object.freeze` (shallow) in JS, `listOf`/`toList` in Kotlin, a `tuple`/`frozen dataclass` in Python.

### Q5. `Object.freeze` and Java's unmodifiable collections — what are their limits?

Both are **shallow** and both are runtime seals, not type-level guarantees:

```js
const state = Object.freeze({ user: { name: "alice" }, tags: [1, 2] });
state.user.name = "bob";   // SUCCEEDS — nested object isn't frozen
state.tags.push(3);        // SUCCEEDS — nested array isn't frozen
// Deep freeze must recurse:
function deepFreeze(o) {
    Object.values(o).forEach(v => v && typeof v === "object" && deepFreeze(v));
    return Object.freeze(o);
}
```

```java
List<StringBuilder> xs = List.of(new StringBuilder("a"));
xs.get(0).append("!");     // the *elements* are still mutable
List<Integer> view = Collections.unmodifiableList(src);
src.add(99);               // `view` reflects it — it's a live view, not a copy
```

Senior takeaway: freezing gives you *shallow, structural* immutability. For deep guarantees, make the nested values immutable too, or copy defensively at the boundary once.

### Q6. What are persistent data structures and how do they avoid O(n) copying?

A **persistent data structure** is an immutable collection whose "update" operations return a **new version** while all previous versions remain valid and cheap. The trick is **structural sharing**: instead of deep-copying, the new version reuses the unchanged nodes of the old one and only allocates along the path that changed.

Concretely, these collections are shallow, wide trees (branching factor ~32). Updating one element rebuilds only the nodes from the root to that element — **O(log₃₂ n)** ≈ effectively constant for realistic sizes — and shares everything else:

```
v1:  root ── A ── B ── C          (a persistent vector)
              \
v2 = v1.set(i,x):
     root' ── A ── B ── C'        root', C' are new; A and B are SHARED with v1
```

Because the old nodes are never mutated, `v1` still sees `C` and `v2` sees `C'` — both valid, no copying of A/B. This is why "immutable = slow copying" is a myth for structures designed this way. The map/set variant uses a **HAMT** (Hash Array Mapped Trie): the key's hash is chopped into 5-bit chunks that index bitmap-compressed nodes down the trie.

### Q7. Show structural sharing in practice — libraries across languages.

```js
// Immutable.js — HAMT-backed Map/List with structural sharing
import { Map } from "immutable";
const m1 = Map({ a: 1, b: 2 });
const m2 = m1.set("a", 9);        // O(log n); m1 untouched
m1.get("a");                       // 1
m2.get("a");                       // 9
m1 !== m2;                         // true — cheap reference-equality change detection
```

```clojure
;; Clojure — all core collections are persistent by default
(def v1 [1 2 3])
(def v2 (conj v1 4))   ; v2 shares v1's structure; v1 is still [1 2 3]
```

```kotlin
// Kotlin — kotlinx.collections.immutable persistent collections
import kotlinx.collections.immutable.persistentListOf
val a = persistentListOf(1, 2, 3)
val b = a.add(4)        // structural sharing; a stays [1, 2, 3]
```

```scala
// Scala — immutable Vector is a 32-way trie (bit-mapped vector trie)
val v1 = Vector(1, 2, 3)
val v2 = v1.updated(0, 9)   // O(log32 n), shares the rest
```

The reference-equality property (`m1 !== m2`) is why these power React/Redux: a cheap `prev === next` check tells you a subtree is unchanged, so you skip re-rendering.

### Q8. What's the honest cost of immutability — when does it bite?

Immutability is not free. The costs:

- **Allocation and GC pressure.** Every "change" allocates. In hot loops or on huge arrays, that churn shows up in GC pause time and cache misses. A tight numeric inner loop mutating a primitive array will crush the persistent-collection version.
- **Indirection.** A HAMT/trie lookup chases pointers through several nodes; a plain array is a single cache-friendly index. Persistent structures trade constant factors for cheap versioning.
- **Memory overhead** per node (bitmaps, child arrays) versus a packed mutable array.
- **Ergonomic friction** in languages without good copy syntax — deeply nested immutable updates in plain JS (`{...a, b:{...a.b, c:9}}`) get verbose (hence Immer's `produce`, lenses, `copy` DSLs).

When to *not* insist on it: performance-critical numeric kernels, large mutable buffers, and localized mutation that never escapes a function (mutating a local accumulator you built yourself is perfectly fine and often the pragmatic FP move). The rule of thumb: **immutable at the boundaries and for shared state; local, non-escaping mutation is fine.**

### Q9. Refactor: turn this mutating code into an immutable transformation.

```js
// Imperative, mutating — caller's input array is corrupted, order-dependent
function applyDiscounts(cart, pct) {
    for (let i = 0; i < cart.length; i++) {
        cart[i].price = cart[i].price * (1 - pct);   // mutates caller's objects!
    }
    return cart;
}
```

```js
// Immutable — pure, returns new data, inputs untouched
const applyDiscounts = (cart, pct) =>
    cart.map(item => ({ ...item, price: item.price * (1 - pct) }));
```

The functional version: no aliasing bug (caller's objects survive), safe to run in parallel, and trivially testable because it's a pure input→output mapping. `map` returns a fresh array; the spread makes a fresh item. Same pattern in Kotlin (`cart.map { it.copy(price = it.price * (1 - pct)) }`) and Python (`[replace(it, price=it.price*(1-pct)) for it in cart]` with a frozen dataclass).

### Q10. How does immutability enable time-travel / undo and cheap change detection?

Because old versions stay valid and cheap, **history is just a list of references**:

```js
// Undo stack — each state is an immutable snapshot; O(1) to push, O(1) to undo
let history = [initialState];
function dispatch(reducer, action) {
    const next = reducer(history[history.length - 1], action);  // returns NEW state
    history.push(next);                                          // old states untouched
}
const undo = () => history.pop();
```

With structural sharing, each snapshot only costs the O(log n) delta from the previous one, so keeping the whole history is affordable — this is exactly how Redux DevTools "time-travel" and editor undo work. It also gives **cheap change detection**: since an unchanged subtree is *the same object*, `prevState.users === nextState.users` is a correct, O(1) "did users change?" test. Mutable state can't do either — mutation destroys the old value and makes reference-equality meaningless.

### Q11. Does immutability make equality and hashing easier? What's the catch?

Yes — an immutable value's contents never change, so its hash is **stable for life**, which is exactly what a hash-based collection needs. Mutating an object after using it as a `Map` key is a classic bug: the hash moves and the entry becomes unreachable.

```java
// Safe: record is immutable, so its hashCode is stable — valid map key forever
record Coord(int x, int y) {}                 // auto value-based equals/hashCode
Map<Coord, String> grid = new HashMap<>();
grid.put(new Coord(1, 2), "home");            // key can never mutate out from under the map
```

```python
d = {(1, 2): "home"}       # tuple key — fine, immutable & hashable
d[[1, 2]] = "x"            # TypeError: list is unhashable *because* it's mutable
```

The catch: value-based equality means two *different* instances with the same contents are equal, which is usually what you want — but it also means equality can be O(size) to compute (comparing all fields), and interning/caching by value only stays correct *because* the values can't change. Python literally refuses to hash mutable containers for this reason.

### Q12. The interview one-liner: immutability in one crisp paragraph.

Immutability means a value's state is fixed at construction, so every reference to it stays permanently trustworthy — which buys you safe sharing without defensive copies, thread-safety on reads, free undo/time-travel, and stable hash keys; the catch juniors miss is that `final`/`const`/`val` and `Object.freeze` only freeze the binding or the top level, not the whole graph, and the objection they raise ("copying is O(n)") is dissolved by **persistent data structures** that use **structural sharing** (HAMTs and wide trees) to make "return a modified copy" O(log n) instead of O(n) — so you reach for immutable-by-default at boundaries and shared state, and keep localized non-escaping mutation for the hot loops where allocation churn actually costs you.


## Higher-Order Functions

### Summary

**What this topic covers**

The single most-used idea in day-to-day functional programming: functions that take other functions as arguments or return functions as results. This is what lets you replace the mechanics of a loop (initialise accumulator, index, mutate, terminate) with a declarative statement of *what* transformation you want. The core trio — **map**, **filter**, and **reduce/fold** — plus **flatMap** and a long tail of specialised helpers (`forEach`, `groupBy`, `partition`, `zip`, `takeWhile`, `find`, `any`/`all`). We cover the cross-language vocabulary (Java Streams, Kotlin collection functions, JS `Array` methods, Python `map`/`filter`/`functools.reduce` and comprehensions, Rust iterator adapters), why **fold is the universal HOF** that the others derive from, the difference between **left and right fold**, and the honest question of when a comprehension or a plain loop reads better than a chain of HOFs.

**Mental model**

A loop tangles three separate concerns into one block: the transformation, the selection, and the accumulation. Higher-order functions **name and separate** those concerns. `map` is "transform each element, keep the shape." `filter` is "keep the elements matching a predicate." `reduce`/`fold` is "collapse the whole thing into one value." When you see a raw `for` loop, ask which of these three it is really doing — usually one of them wearing loop clothing, and the HOF version deletes the ceremony (no index, no manual accumulator, no off-by-one). The deeper insight is that **fold is the mother function**: it walks the structure carrying an accumulator, and both `map` and `filter` are just folds whose accumulator is a new list — understand `reduce` and you understand the family. The payoff is not cleverness — each stage of a `list.filter(...).map(...).reduce(...)` pipeline reads top-to-bottom as a sentence, composes without temporary variables, and has no mutable state to reason about. The cost is that a badly-chosen chain can hide intent or allocate intermediate collections, so it is a judgement call, not a religion.

**Key terms**

- **Higher-order function (HOF)** — a function that takes a function as an argument, returns a function, or both.
- **map** — apply a function to every element, producing a new collection of the same length. Shape-preserving.
- **filter** — keep only elements satisfying a predicate; length shrinks. Kotlin/Rust/JS call it `filter`; Ruby calls it `select`.
- **reduce / fold** — collapse a collection to a single value using a binary combining function and (usually) a seed.
- **flatMap** — map each element to a collection, then concatenate the results one level deep. Also `mapcat`/`bind`/`chain`.
- **predicate** — a function returning a boolean, e.g. `x -> x > 0`.
- **left fold (`foldl`)** — associates from the left, `f(f(f(seed, a), b), c)`; the tail-recursive direction.
- **right fold (`foldr`)** — associates from the right, `f(a, f(b, f(c, seed)))`; builds lists lazily / handles infinite streams in lazy languages.
- **comprehension** — declarative syntax (`[f(x) for x in xs if p(x)]`) fusing map+filter in one readable expression.
- **lazy vs eager** — Java Streams / Rust iterators / Kotlin `Sequence` are lazy (nothing runs until a terminal op like `collect`/`sum`); Kotlin `List` functions and JS `Array` methods are eager (each stage allocates).
- **fusion** — collapsing `map().filter().map()` into a single pass so no intermediate collection is materialised (what lazy pipelines buy you).

**Why interviewers ask this**

It is the fastest read on whether someone thinks in transformations or in loops. A junior reaches for `for (int i = 0; ...)` and mutates a list; a mid writes `map`/`filter` but chains six stages where a comprehension or one fold would be clearer; a senior picks the right tool, knows `reduce` is the general case, spots when a chain allocates three throwaway lists on a hot path, and can articulate laziness (why `stream.filter(...).findFirst()` never touches the tail). Interviewers also probe the sharp edges: can you write `map` and `filter` in terms of `reduce`? Do you know the JVM has no general tail-call optimisation, so a deep `foldRight` blows the stack? These separate someone who memorised "use map" from someone who understands the machinery.

**Common confusions**

- **"`reduce` needs a seed."** — Not always, but the seedless overload throws on an empty collection and forces the accumulator type to equal the element type. Prefer the seeded form; it is total and lets the accumulator differ.
- **"`map` and `flatMap` are interchangeable."** — `map` with a list-returning function gives you a list-of-lists; `flatMap` flattens one level. Reach for `flatMap` when your mapper produces a collection (or `Optional`/`Stream`) you want merged.
- **"Chaining HOFs is always faster/cleaner."** — On eager collections each stage allocates a full intermediate; on a hot path a single loop or a lazy `Sequence`/`Stream` can be markedly faster.
- **"`forEach` is just `map`."** — `forEach` returns nothing and exists for side effects; `map` is pure and returns the transformed collection. Using `map` for side effects is a smell.
- **"left and right fold give the same answer."** — Only when the operation is associative *and* commutative. `foldLeft` and `foldRight` differ for subtraction, list construction, and non-associative combiners.

**What follows from this topic**

HOFs are the surface; the machinery under them is **closures** (how a passed lambda captures its environment) and **pure functions** (why a mapper with no side effects is safe to reorder or parallelise). `flatMap` here is the same operation that defines **monads** later — `Optional`, `Result`, `Promise`, `Stream` all expose it. The laziness discussion connects to the **lazy evaluation** topic, and "immutability makes parallel map/reduce safe" bridges to the **FP & concurrency** topic. Master the trio and the rest of the primer is mostly naming what you are already doing.

### Q1. What is a higher-order function, and what are the two ways a function can be "higher-order"?

A higher-order function either **takes one or more functions as arguments**, **returns a function as its result**, or both. It contrasts with a first-order function that only deals in plain values. The prerequisite is that the language treats functions as **first-class values** — passable, returnable, storable in variables.

Taking a function (the common case — `map` receives the transform):

```kotlin
val lengths = listOf("ab", "cde").map { it.length }   // map takes a function
```

Returning a function (a closure factory):

```javascript
const multiplier = (factor) => (x) => x * factor;   // returns a function
const triple = multiplier(3);
triple(10);                                          // 30
```

Both directions at once is `compose`: `compose(f, g)` takes two functions and returns a new function `x => f(g(x))`. Mainstream languages lean heavily on the *taking* direction (every `map`/`filter`/`sort` comparator), while the *returning* direction powers decorators, currying, and dependency injection via partial application.

### Q2. Explain map, filter, and reduce as the core trio, and show the same pipeline in three languages.

They are the three canonical shapes a loop takes: **map** transforms (same length out), **filter** selects (shorter out), **reduce/fold** collapses (one value out). Most data processing is a chain of these.

"Sum of the squares of the even numbers" in three languages:

```kotlin
val r = (1..10).filter { it % 2 == 0 }
               .map { it * it }
               .sum()                       // 220  (sum is a specialised reduce)
```

```javascript
const r = [1,2,3,4,5,6,7,8,9,10]
  .filter(n => n % 2 === 0)
  .map(n => n * n)
  .reduce((acc, n) => acc + n, 0);          // 220
```

```python
from functools import reduce
nums = range(1, 11)
r = reduce(lambda acc, n: acc + n,
           (n * n for n in nums if n % 2 == 0), 0)   # 220
```

Read top-to-bottom it is a sentence: *keep the evens, square them, add them up.* No index, no mutable accumulator declared by hand, no off-by-one. Note `sum()` in Kotlin and `sum` in Python are just named reductions — most languages ship the common folds (`sum`, `max`, `count`, `joinToString`) so you rarely spell out `reduce` for those.

### Q3. Why is fold/reduce called the "universal" HOF? Show map and filter written in terms of reduce.

Because `fold` is the one operation that **walks the whole structure while threading an accumulator**, and that is general enough to express any of the others. `map` and `filter` are just folds whose accumulator happens to be a growing list.

```javascript
const map = (fn, xs) =>
  xs.reduce((acc, x) => [...acc, fn(x)], []);

const filter = (pred, xs) =>
  xs.reduce((acc, x) => pred(x) ? [...acc, x] : acc, []);

map(x => x * 2, [1, 2, 3]);        // [2, 4, 6]
filter(x => x % 2 === 0, [1,2,3,4]); // [2, 4]
```

Same idea in Kotlin using `fold`:

```kotlin
fun <A, B> List<A>.mapViaFold(f: (A) -> B): List<B> =
    fold(emptyList()) { acc, x -> acc + f(x) }
```

This is a favourite interview question because it proves you understand the machinery rather than just the API. (In practice you would still call the built-in `map`/`filter` — they are clearer and the built-ins avoid the quadratic `[...acc, x]` copy; this reconstruction is about understanding, not production code.)

### Q4. What is flatMap and when do you need it rather than map?

`flatMap` maps each element to a **collection** and then concatenates the results, flattening exactly **one level**. You reach for it whenever your mapping function itself produces a collection (or an `Optional`, `Stream`, `Promise` — the monadic cases) and you want a single flat result instead of a nested one.

```kotlin
val orders = listOf(Order(items = listOf("a", "b")),
                    Order(items = listOf("c")))

orders.map { it.items }       // [[a, b], [c]]   nested
orders.flatMap { it.items }   // [a, b, c]        flat
```

It also drops "empty" results, which makes it the idiomatic filter-and-map for optionals:

```java
List<String> firstNames = people.stream()
    .flatMap(p -> p.middleName().stream())   // Optional<String> -> Stream (0 or 1)
    .toList();                               // people with no middle name vanish
```

The mental test: *does my mapper return a container?* If yes, `flatMap`. If it returns a plain value, `map`. This is the same operation that will reappear as monadic **bind** — `Optional.flatMap`, `CompletableFuture.thenCompose`, JS `Promise.then` are all flatMap under different names.

### Q5. Beyond the trio, what other HOFs earn their keep? Name them and what they do.

The specialised helpers exist because expressing them via raw `reduce` is possible but obscures intent. The workhorses:

- **forEach** — run a side-effecting function per element, return nothing. For I/O, not transformation.
- **find / first** — return the first element matching a predicate (as `Optional`/`null`/`Option`).
- **any / all / none** — short-circuiting boolean folds ("is any order overdue?").
- **groupBy** — bucket elements into a `Map<Key, List<T>>` by a key function.
- **partition** — split into two lists by a predicate (the pass pile and the fail pile).
- **zip** — pair up two collections elementwise into tuples.
- **takeWhile / dropWhile** — take (or skip) a prefix while a predicate holds, then stop.
- **associateBy / toMap** — index a list into a map keyed by some field.

```kotlin
val (adults, minors) = people.partition { it.age >= 18 }
val byCity = people.groupBy { it.city }               // Map<String, List<Person>>
val names  = ids.zip(names).toMap()                   // Map<Id, Name>
val prefix = readings.takeWhile { it < threshold }    // stops at first breach
```

Knowing these by name matters in interviews: reaching for `groupBy` instead of hand-rolling a `HashMap<K, List<V>>` accumulate loop is an instant signal of fluency.

### Q6. Map the cross-language names — the same concepts have different spellings.

The concepts are universal; the API names and the eager/lazy behaviour differ. This table is worth memorising because interviewers switch languages mid-question.

| Concept | Java Stream | Kotlin | JS `Array` | Python | Rust iterator |
|---|---|---|---|---|---|
| map | `.map()` | `.map {}` | `.map()` | `map()` / comprehension | `.map()` |
| filter | `.filter()` | `.filter {}` | `.filter()` | `filter()` / `if` in comp | `.filter()` |
| reduce/fold | `.reduce()` | `.fold()` / `.reduce()` | `.reduce()` | `functools.reduce()` | `.fold()` / `.reduce()` |
| flatMap | `.flatMap()` | `.flatMap {}` | `.flatMap()` | chain / comprehension | `.flat_map()` |
| forEach | `.forEach()` | `.forEach {}` | `.forEach()` | `for` loop | `.for_each()` |
| find | `.findFirst()` | `.firstOrNull {}` | `.find()` | `next(x for..)` | `.find()` |
| any/all | `.anyMatch()` | `.any {}` | `.some()`/`.every()` | `any()`/`all()` | `.any()`/`.all()` |
| group | `Collectors.groupingBy` | `.groupBy {}` | (manual/`reduce`) | `itertools.groupby`* | `.fold` into map |

Key behavioural gotchas: **Java Streams and Rust iterators are lazy** — nothing runs until a terminal op (`collect`, `sum`, `toList`). **Kotlin `List` functions and JS `Array` methods are eager** — each stage allocates a new collection; use Kotlin `.asSequence()` to get laziness. Python's `map`/`filter` return **lazy iterators** (Py3), but comprehensions are eager. `*itertools.groupby` only groups *consecutive* equal keys, so you must sort first — a classic trap.

### Q7. What is the difference between left fold and right fold, and when does it matter?

`foldLeft` associates from the left and `foldRight` from the right:

```
foldLeft (seed=0):   (((0 - 1) - 2) - 3) = -6
foldRight (seed=0):   1 - (2 - (3 - 0)) =  2
```

For an **associative and commutative** operation with a neutral seed (sum, max, product) they agree, so it does not matter. It matters the moment the operation is non-associative (subtraction, division), order-sensitive, or builds a structure:

```scala
List(1,2,3).foldLeft(List.empty[Int])((acc, x) => x :: acc)  // List(3,2,1) — reverses
List(1,2,3).foldRight(List.empty[Int])((x, acc) => x :: acc) // List(1,2,3) — preserves
```

Two practical consequences. First, **`foldLeft` is tail-recursive** (accumulator-passing), so it runs in constant stack; **`foldRight` recurses on the tail first**, so in a strict language a long list overflows the stack. Second, in a **lazy** language like Haskell, `foldr` can short-circuit and work on infinite lists because the combining function may ignore its (unevaluated) second argument — `foldr` with a lazy `||` stops at the first `True`. Rule of thumb in strict/mainstream languages: **default to `foldLeft`/`reduce`**; only reach for `foldRight` when you specifically need right-associative structure building on a bounded list.

### Q8. When does a comprehension read better than a chain of HOFs?

When the pipeline is a simple **map + filter**, a comprehension usually wins on readability because it fuses both into one expression with no lambda ceremony, and — in Python especially — it is idiomatic and faster than `map`/`filter` with `lambda`.

```python
result = [f(x) for x in xs if p(x)]                    # clear, one pass
result = list(map(f, filter(p, xs)))                   # noisier, same effect
```

Comprehensions also shine for **nested iteration** and building dicts/sets:

```python
pairs = [(i, j) for i in range(3) for j in range(3) if i != j]
by_id = {u.id: u.name for u in users}
```

Where comprehensions lose: **reduce/fold logic** (there is no comprehension for "sum" — you call `sum()` or `reduce`), **long multi-stage pipelines** (three nested comprehensions are harder to read than a `.filter().map().take()` chain), and languages where the chain is the idiom (Kotlin, Rust, JS have no general comprehension, so chaining *is* the readable form). The senior instinct: comprehension for one map+filter you can read at a glance; a named HOF chain when there are three-plus distinct stages or a genuine reduction.

### Q9. Refactor this imperative loop into map/filter/reduce, and say what each stage bought you.

Imperative version — three concerns tangled into one mutating block:

```java
double total = 0;
for (Order o : orders) {
    if (o.getStatus() == Status.PAID) {   // selection
        double net = o.getAmount() * 0.8; // transformation
        total += net;                     // accumulation
    }
}
```

Functional version — each concern is its own named stage:

```java
double total = orders.stream()
    .filter(o -> o.getStatus() == Status.PAID)   // selection
    .mapToDouble(o -> o.getAmount() * 0.8)       // transformation
    .sum();                                       // accumulation (a named reduce)
```

What the refactor bought: (1) **no mutable state** — `total` and the loop index are gone, so there is nothing to accidentally mutate or get wrong; (2) **each line has one job**, readable as "paid orders, times 0.8, summed"; (3) it is **trivially parallelisable** — `.parallelStream()` and the sum still holds because the operation is associative and the stages are pure; (4) the pipeline **composes** — adding "only orders over $100" is one more `.filter`, not surgery on a loop body. The cost to weigh: the Stream version allocates a pipeline and (if eager) intermediate structures, so on a micro-optimised hot path the plain loop may still win. Measure before assuming.

### Q10. What are the honest downsides of HOF chains, and when would you not use them?

They are not free, and pretending otherwise is a junior tell. The real costs:

- **Intermediate allocation.** On eager collections (Kotlin `List`, JS `Array`, Python comprehension-per-stage), `list.map().filter().map()` allocates a full throwaway collection per stage. On a hot loop this matters — switch to a lazy `Sequence`/`Stream`/iterator so the stages *fuse* into one pass, or just write the loop.
- **Debuggability.** Stepping through a deep lambda chain in a debugger is worse than a loop with a breakpoint on a line; stack traces through `map`/`flatMap` are noisier.
- **Early exit is awkward.** `break`/`continue`/early `return` from inside a `forEach` lambda is impossible in most languages — you need `takeWhile`, `find`, or `anyMatch`, and if the logic does not fit those, a loop is clearer.
- **Over-chaining hides intent.** A seven-stage pipeline where a well-named helper function or a single comprehension would do is showing off, not communicating.
- **Exceptions in lambdas** are painful in Java (checked exceptions do not thread through `Function`), forcing ugly wrapping.

The rule: HOFs for the common transform/select/collapse shapes where they read as intent; drop to a loop when you need early exit that does not map to a helper, when profiling shows the allocation hurts, or when the imperative version is genuinely more readable. FP is a tool, not a loyalty oath.

### Q11. The interview one-liner: the topic in one crisp paragraph.

Higher-order functions are functions that take or return other functions, and in practice they let you replace hand-written loops with three declarative shapes — **map** (transform each element, same length), **filter** (keep the elements matching a predicate), and **reduce/fold** (collapse the collection to one value) — plus **flatMap** for when the mapper returns a collection you want flattened; `fold` is the universal one that the others derive from, `foldLeft` is the tail-recursive default while `foldRight` builds right-associative structure at the cost of stack, the same concepts wear different names across Java Streams, Kotlin, JS `Array`, Python, and Rust iterators (with laziness varying — Streams and iterators are lazy, Kotlin `List` and JS `Array` eager), a comprehension often reads better than a chain for a single map+filter, and the senior move is knowing when the chain's clarity is worth its allocation and when a plain loop wins.


## Closures & Lexical Scope

### Summary

**What this topic covers**

The single most-quizzed FP building block in mainstream interviews: a **closure** is a function bundled with a reference to the **lexical environment** it was defined in — so it can still read (and often mutate) the variables that were in scope where it was *written*, long after the enclosing function has returned. This topic separates **lexical scope** (name resolution follows the source-code nesting, decided at author time) from **dynamic scope** (name resolution follows the call stack, decided at run time), which almost every modern language rejects. It then works through the part interviewers actually care about: **capture by reference vs by value**, and the notorious **loop-variable capture bug** that bites in JavaScript (`var` vs `let`), Java (the effectively-final rule), Python (late-binding), and Go (the pre-1.22 loop variable). We close with the famous duality — "a closure is a poor man's object, and an object is a poor man's closure" — and the day-to-day uses: callbacks, memoization, partial application/currying, event handlers, and private state without a class.

**Mental model**

Think of a function value as **code plus a backpack**. The code is the body; the backpack is a pointer to the scope where the function was born. When the function later runs — anywhere, any time — it opens the backpack to resolve any free variable (a name it uses but doesn't declare). The crucial, counter-intuitive part: the backpack holds a **reference to the live variable**, not a snapshot of its value at capture time — so if the variable keeps changing, the closure sees the latest value. That one fact explains every "why did all my callbacks print 3?" bug. The payoff is **stateful behaviour without a class**: a counter, a memo cache, a configured handler — all just a function holding onto a variable nobody else can reach. Encapsulation falls out for free, because the only way to touch the captured variable is through the functions that closed over it.

**Key terms**

- **Closure** — a function value paired with a reference to its defining lexical environment.
- **Free variable** — a name used in a function but declared in an enclosing scope (not a parameter or local).
- **Lexical (static) scope** — free variables resolve by where the code is *written*; the compiler can decide it. Used by essentially every modern language.
- **Dynamic scope** — free variables resolve by the *call stack* at run time (Emacs Lisp, Bash, old Lisps). Fragile; mostly abandoned.
- **Capture by reference** — the closure holds the variable itself; later mutations are visible (JS, Python, Go, Java's captured objects).
- **Capture by value** — the closure holds a copy taken at creation time (C++ `[=]`, or simulated via a default arg / IIFE).
- **Effectively final** — Java's rule: a captured local must never be reassigned, so capture-by-value is safe and unambiguous.
- **Late binding** — the captured name is looked up when the closure *runs*, not when it's *defined* (Python's default behaviour).
- **Partial application** — fixing some arguments of a function, returning a closure that takes the rest.
- **Memoization** — caching results in a variable captured by the returned function.

**Why interviewers ask this**

Closures are the fault line between "I've used arrow functions" and "I understand how the language actually resolves names and manages memory." A junior can write `arr.map(x => x * 2)` but freezes when asked *why* a `for` loop with `var` and a `setTimeout` prints the same number every time. A senior explains it in one breath: the three callbacks all closed over the **same** `i`, capture is by reference, and by the time they fire the loop has finished so `i` is at its final value — then offers the three canonical fixes (`let`, an IIFE, or `.bind`). This question is beloved because it simultaneously probes scope rules, reference vs value semantics, the event loop, and whether you can debug asynchronously-observed state. It also gates real bugs: memory leaks from closures pinning large objects, and subtle mutation bugs in React hooks (stale-closure reads of state).

**Common confusions**

- "A closure captures the *value* of the variable" — no; it captures the *variable* (a reference/binding). It sees later mutations. This is the root of the loop bug.
- "Closures are a JavaScript thing" — every language with first-class functions has them: Python, Kotlin, Java lambdas, Rust, Go, Swift, C++.
- "`let` fixes the loop by making a copy" — it fixes it by giving each iteration a **fresh binding**; the closure captures a different variable each time, not a copy of one variable.
- "Lexical scope means global scope" — lexical means *nesting in the source*; the nearest enclosing declaration wins, not the outermost.
- "Java captures by value so it's safe from mutation" — it copies the *reference*; the pointed-to object is still shared and mutable. Effectively-final constrains the local, not the heap object.
- "Closures and objects are unrelated" — they're duals; both bundle behaviour with state, just with the fields hidden differently.

**What follows from this topic**

Closures are the machinery under nearly every other topic in this primer. **Higher-order functions** *are* functions that take or return closures; `map`/`filter`/`reduce` pass your closure the element. **Partial application and currying** are closures by another name. **Pure functions** warn you that a closure over mutable captured state is an *impure* function with hidden inputs — the same stale-closure trap, reframed. And the "closure vs object" duality sets up the **FP-vs-OOP** contrast later: private state via captured variables versus private state via encapsulated fields.

### Q1. What exactly is a closure, and what does "lexical environment" mean?

A closure is a **function value plus a reference to the scope in which it was defined**. When the function uses a *free variable* — a name it neither declares nor receives as a parameter — that name is resolved against the captured environment, not against wherever the function happens to be called from.

"Lexical environment" is just the chain of variable scopes visible at the point in the **source code** where the function is written. It's decided by nesting, so the compiler can resolve it statically.

```js
function makeAdder(x) {
  return function (y) {   // inner fn closes over x
    return x + y;         // x is a free variable, found in makeAdder's scope
  };
}
const add10 = makeAdder(10);
add10(5);                 // 15 — x is still alive, held by the closure
```

`makeAdder` has already returned, its stack frame conceptually gone — yet `x` survives because the returned closure holds a reference to it. That's the defining trick: **captured variables outlive their enclosing call.**

### Q2. Lexical scope vs dynamic scope — what's the difference and why did lexical win?

Under **lexical (static) scope**, a free variable resolves by walking *outward through the source-code nesting* from where the function is defined. Under **dynamic scope**, it resolves by walking *up the call stack* — you get whatever value the variable has in whoever called you.

```js
const x = "global";
function inner() { return x; }      // lexical: x is the global, always
function outer() { const x = "local"; return inner(); }
outer();   // "global" in JS (lexical). Under dynamic scope it'd be "local".
```

Lexical won because it's **predictable and analyzable**: you can understand a function by reading the code around it, the compiler can resolve and optimize names, and behaviour doesn't change based on the caller. Dynamic scope makes a function's meaning depend on its entire call history — great for a few niche cases (Bash environment variables, Emacs Lisp `let`, dependency-injection-ish overrides) but a nightmare for reasoning. Almost every mainstream language is lexically scoped; closures only make sense *because* scope is lexical.

### Q3. The classic loop-variable capture bug — show it in JavaScript and fix it.

The single most famous closure gotcha. Pre-ES6, `var` is function-scoped, so every closure created in the loop captures the **same** `i`:

```js
const fns = [];
for (var i = 0; i < 3; i++) {
  fns.push(function () { return i; });
}
fns.map(f => f());   // [3, 3, 3]  — all share one i, which ended at 3
```

There's exactly one `i`. All three closures reference it; by the time they run, the loop is done and `i` is 3. Three fixes, each attacking a different part:

```js
for (let i = 0; i < 3; i++) fns.push(() => i);   // fix 1: let = fresh binding per iteration -> [0,1,2]

for (var i = 0; i < 3; i++)                        // fix 2: IIFE captures a copy by value
  (function (j) { fns.push(() => j); })(i);        //        -> [0,1,2]

for (var i = 0; i < 3; i++)                        // fix 3: bind the current value as an argument
  fns.push(function (j) { return j; }.bind(null, i));
```

The `let` fix is the important one to understand: ES6 gives **each iteration its own fresh `i` binding**, so each closure captures a *different* variable. It is not making a copy of one shared variable — it's creating three variables.

### Q4. Same bug in Python — why, and what's the idiomatic fix?

Python closures capture by reference and use **late binding**: the free variable is looked up when the closure *runs*, not when it's *created*. So the loop trap is identical.

```python
fns = [lambda: i for i in range(3)]
[f() for f in fns]          # [2, 2, 2] — i is looked up at call time, ends at 2
```

The idiomatic fix exploits that **default arguments are evaluated once, at definition time**, capturing the current value:

```python
fns = [lambda i=i: i for i in range(3)]
[f() for f in fns]          # [0, 1, 2] — i=i binds the current value eagerly
```

The `i=i` reads oddly but is standard Python: the right-hand `i` is evaluated now (per iteration) and bound as the default of a fresh parameter, sidestepping late binding. `functools.partial(lambda x: x, i)` works too. Note Python 3 also gives comprehensions their own scope, but the late-binding-of-`i` problem is orthogonal to that and still bites.

### Q5. How does Java avoid this bug, and what does "effectively final" actually mean?

Java sidesteps the loop trap by **refusing to compile** the dangerous case. A lambda or anonymous class may only capture a local variable that is **effectively final** — assigned once and never reassigned. Since a loop counter *is* reassigned each iteration, you can't capture it directly:

```java
List<Supplier<Integer>> fns = new ArrayList<>();
for (int i = 0; i < 3; i++) {
    fns.add(() -> i);        // COMPILE ERROR: i is not effectively final
}
```

The fix is to introduce a fresh, effectively-final variable per iteration — which the enhanced-for loop does naturally:

```java
for (int idx = 0; idx < 3; idx++) {
    final int j = idx;       // fresh, never reassigned
    fns.add(() -> j);        // OK -> yields 0, 1, 2
}
for (int v : List.of(0, 1, 2)) fns.add(() -> v);  // v is effectively final each iteration
```

Important nuance: effectively-final constrains the **local variable/reference**, not the object it points to. Java captures the *value* of the variable (the reference), so if you capture a reference to a mutable `List`, mutations to that list are still visible through the closure. Effectively-final prevents ambiguity about *which value* was captured; it does not make the heap object immutable.

### Q6. And Go — what changed in Go 1.22?

For over a decade Go had the same trap, because the loop variable was **declared once and reused** across iterations, and goroutines/closures captured that single variable:

```go
funcs := []func() int{}
for _, v := range []int{0, 1, 2} {
    funcs = append(funcs, func() int { return v })  // pre-1.22: all return 2
}
```

The canonical pre-1.22 fix was to shadow the variable per iteration — `v := v` inside the loop — creating a fresh binding to close over. This bug was so common (especially with goroutines in loops) that **Go 1.22 changed the language**: the loop variable is now **per-iteration**, so each closure captures a distinct `v` and the snippet above returns `[0, 1, 2]` without any fix. It's the same resolution ES6 reached with `let`: give each iteration its own binding rather than sharing one.

```go
for _, v := range items {
    v := v                 // pre-1.22 fix: fresh binding; unnecessary in 1.22+
    go func() { use(v) }()
}
```

### Q7. Capture by reference vs by value — how do the mainstream languages differ?

There's no single answer; it's a per-language design choice:

| Language | Default capture | Notes |
|---|---|---|
| JavaScript | by reference | closures see later mutations of `let`/`var` |
| Python | by reference (late binding) | default-arg trick simulates by-value |
| Java | value of the local (must be effectively final) | but that value is often a *reference* to a mutable object |
| Go | by reference (per-iteration binding since 1.22) | |
| Rust | inferred; `move` forces ownership transfer | borrow-checked; captures by ref, `&mut`, or by value |
| C++ | **you choose per variable** | `[=]` by value, `[&]` by reference, `[x, &y]` mixed |

C++ is the honest one — it forces you to spell out the semantics:

```cpp
int x = 10;
auto byVal = [x]() { return x; };   // snapshot: copies x now
auto byRef = [&x]() { return x; };  // live reference to x
x = 99;
byVal();  // 10   (captured the value)
byRef();  // 99   (captured the variable)
```

Senior takeaway: "capture by reference" and "the loop bug" are the *same phenomenon*. Languages that capture by reference (JS, Python, Go) all had the loop trap; the fix in each case is to manufacture a fresh binding or a value copy.

### Q8. "A closure is a poor man's object, and an object is a poor man's closure." Explain.

Both bundle **behaviour together with state**; they just differ in which half is foregrounded. An object is state (fields) with attached behaviour (methods); a closure is behaviour (a function) with attached state (captured variables). Each can simulate the other.

A closure standing in for an object with private state:

```js
function counter() {
  let count = 0;                       // "private field", unreachable from outside
  return {
    inc() { return ++count; },
    get() { return count; },
  };
}
const c = counter();
c.inc(); c.inc(); c.get();            // 2 — count is truly private
```

Conversely, a single-method object *is* effectively a closure — Java's functional interfaces make this literal: a lambda is compiled to an object implementing one method, closing over captured locals. The saying (from the Scheme community) is a reminder that OOP and FP encapsulate the same thing by different routes. Which reads better is a style/ergonomics call, not a capability difference: closures shine for one-or-few behaviours over shared state; objects shine when you have many methods and named fields.

### Q9. Show closures powering memoization and partial application.

**Memoization** caches results in a variable the returned function closes over:

```js
function memoize(fn) {
  const cache = new Map();             // captured; survives across calls, private to the wrapper
  return (n) => {
    if (cache.has(n)) return cache.get(n);
    const result = fn(n);
    cache.set(n, result);
    return result;
  };
}
const slowSquare = (n) => n * n;
const fastSquare = memoize(slowSquare);
```

The `cache` lives exactly as long as `fastSquare` does and is reachable only through it — encapsulation with no class.

**Partial application** fixes some arguments and returns a closure over them:

```python
def multiply(a, b):
    return a * b

def partial(fn, a):
    return lambda b: fn(a, b)          # closes over a

triple = partial(multiply, 3)
triple(10)                             # 30
```

**Currying** is the fully-decomposed form — a chain of one-arg closures:

```js
const add = a => b => c => a + b + c;  // each arrow closes over the previous arg
add(1)(2)(3);                          // 6
```

### Q10. Encapsulation and event handlers — closures as private state and configured callbacks.

Before ES6 classes, the **module pattern** used a closure to hide private state behind a public API — still common in JS and in any language with first-class functions:

```js
const bankAccount = (() => {
  let balance = 0;                     // genuinely private; no reference escapes
  return {
    deposit: (n) => { balance += n; },
    balance: () => balance,
  };
})();
bankAccount.deposit(100);
bankAccount.balance();                 // 100 — cannot be tampered with directly
```

Closures also make **configured event handlers** trivial: the handler closes over the context it needs instead of receiving it through globals or DOM attributes.

```js
function attach(buttons) {
  buttons.forEach((btn, index) => {
    btn.onclick = () => console.log(`clicked button ${index}`);  // each handler closes over its own index
  });
}
```

Because `forEach`'s callback parameter is a fresh binding per element, each handler correctly remembers *its* index — the same mechanism that fixes the loop bug, working for you instead of against you. This is exactly why React hooks warn about "stale closures": an effect or callback closes over the `state` value from the render it was created in, so an outdated closure can read an outdated value — the loop-capture problem wearing a UI costume.

### Q11. Do closures cause memory leaks? What's the performance cost?

They can, and it's a real senior concern. A closure keeps its **entire captured environment reachable** for as long as the closure itself is reachable — so if a long-lived closure captures a large object, the GC can't reclaim it even if you only needed one small field.

```js
function setup() {
  const huge = new Array(1_000_000).fill(0);   // big
  const id = huge.length;
  return () => id;    // in a naive engine this can pin `huge` alive via the shared scope
}
```

The mitigation is to capture only the small value you need (`const id = huge.length`) and let `huge` go out of scope, or null out references. Classic leak sources: event handlers that close over DOM nodes and are never removed, and caches (memoization) that grow unbounded — use a bounded/LRU cache or `WeakMap`. Performance-wise, closures allocate an environment record on the heap, so a hot inner loop that creates millions of tiny closures has real allocation/GC pressure; hoist the closure out of the loop if it doesn't need per-iteration capture. For most code the cost is negligible and clarity wins — but "closure pins a big graph" and "unbounded memo cache" are the two leaks worth naming in an interview.

### Q12. The interview one-liner: closures in one crisp paragraph.

A **closure** is a function packaged together with a reference to the lexical environment where it was defined, so it can keep reading and mutating the free variables of that environment even after the enclosing function has returned; because virtually every modern language is **lexically scoped**, name resolution follows the source-code nesting rather than the call stack, and because capture is **by reference to the variable, not a snapshot of its value**, all the closures created in a loop share one binding unless the language gives each iteration a fresh one — which is exactly why the loop-counter callbacks famously all print the final value, and why the fixes (`let` in JS, effectively-final locals in Java, the `i=i` default-arg in Python, and per-iteration loop variables in Go 1.22) all amount to manufacturing a new binding per iteration; that same variable-hiding power is what lets a closure act as "a poor man's object," giving you memoization caches, partial application, event handlers, and truly private state without ever writing a class.


## Recursion & Tail-Call Optimization

### Summary

**What this topic covers**

Recursion is how functional programming loops. In a language where nothing mutates, the imperative `for (int i = 0; i < n; i++)` has no home — there is no `i` to increment. So FP expresses repetition by having a function call itself with new arguments, and expresses "loop state" as those arguments. This topic covers **structural recursion** (walk a list or tree by its shape), **tail recursion** and the **tail-call optimization (TCO)** that stops it from blowing the stack, the **accumulator pattern** that rewrites an ordinary recursion into a tail-recursive one, **trampolining** for languages that lack TCO, **mutual recursion**, and — the part that actually bites people in interviews — *which mainstream runtimes implement TCO and which do not*. The honest headline: most functional languages (Scheme, Scala with `@tailrec`, Kotlin `tailrec`, Elixir, F#, OCaml) guarantee or opt into TCO, but **the JVM has no general TCO, CPython deliberately refuses it, and the JS spec mandates it but only Safari ships it**. That last fact is why, in Java/Python/JS, deep recursion is a `StackOverflowError` waiting to happen and you often keep a loop or an explicit stack instead.

**Mental model**

A recursive call is a loop where **the call stack is the mutable state**. Each frame remembers "where I was and what I still have to do after the sub-call returns." An ordinary recursion like `n * factorial(n-1)` leaves *pending work* on every frame (the multiply happens *after* the recursive call comes back), so the stack grows to depth `n`. A **tail** call leaves no pending work: the recursive call is the *very last thing* the function does, its result is returned as-is. That frame has nothing left to do, so a compiler that implements TCO can **reuse the same frame** instead of pushing a new one — turning the recursion into a `goto` with updated arguments, i.e. a real loop, in O(1) space. The whole game of "make it tail-recursive" is: move the pending work *into an argument* (the accumulator) so that by the time you recurse, there is nothing left to do afterward. If your runtime doesn't do TCO, you either restructure to a loop/explicit stack, or bounce the calls off a **trampoline** (return a thunk instead of calling, and let a driver loop invoke thunks) to keep the native stack flat.

**Key terms**

- **Recursion** — a function defined in terms of itself; a base case stops it, a recursive case shrinks the problem.
- **Structural recursion** — recurse following the shape of the data (head/tail of a list, left/right of a tree). Termination is "obvious" because each call is on a strictly smaller sub-structure.
- **Base case** — the non-recursive branch that halts the descent; forgetting it (or never approaching it) is infinite recursion → stack overflow.
- **Tail call** — a call in *tail position*: its result is returned directly with no further computation wrapping it.
- **Tail recursion** — recursion whose recursive call is in tail position.
- **Tail-call optimization (TCO) / elimination** — reusing the current stack frame for a tail call, giving O(1) stack space. Also called **proper tail calls (PTC)**.
- **Accumulator** — an extra parameter that carries the running result, turning a non-tail recursion into a tail-recursive one.
- **Trampoline** — a loop that repeatedly invokes returned thunks, simulating TCO on runtimes that lack it; converts stack depth into heap allocation.
- **Mutual recursion** — two or more functions that call each other (`isEven`/`isOdd`); needs mutual TCO or a trampoline to stay flat.
- **Stack overflow** — the runtime error when call depth exceeds the stack; the practical ceiling on non-optimized recursion (~1e4 frames on the JVM/CPython by default).

**Why interviewers ask this**

Because it separates people who *memorized* "use recursion in FP" from people who understand the machine underneath. A junior writes a naive recursive `sum` and is surprised it throws on a 100k-element list. A senior knows *why* (linear stack growth), knows whether the target language will save them (JVM/Python/most-of-JS: no), and reaches for the accumulator, `@tailrec`/`tailrec` to get a *compile-time guarantee*, an explicit iterative loop, or a trampoline — and can say which is appropriate and why. The strongest signal is nuance about TCO support: candidates who claim "recursion is always as efficient as a loop" get caught, because on the exact platforms most interviews use it isn't.

**Common confusions**

- "Recursion is always tail-recursive" — no; `n * f(n-1)` is *not* tail-recursive, the multiply is pending after the call.
- "Tail recursion is automatically optimized" — only if the runtime does TCO. On the JVM, CPython, and Node/Chrome it is not, so a tail-recursive function still overflows.
- "JavaScript has TCO because ES6 specced it" — the spec mandates PTC, but in practice only JavaScriptCore/Safari ships it; V8 (Node, Chrome) removed its implementation.
- "`@tailrec`/`tailrec` makes recursion faster" — it doesn't speed anything up; it *guarantees at compile time* the call is in tail position and rewrites it to a loop, failing to compile otherwise.
- "Deep recursion is fine, the GC handles it" — the GC manages the heap; recursion depth is a *stack* limit, unrelated.

**What follows from this topic**

Recursion is the engine behind the rest of this primer. **Higher-order functions** like `map`/`filter`/`fold` are recursion patterns given names — a `foldLeft` is a tail-recursive accumulator loop in disguise. **Immutability** is what forces recursion in the first place (no mutable counter), and also what makes it safe. **Laziness** lets you recurse over conceptually infinite structures without overflow. When you meet `reduce`/`fold` next, remember it is this topic with the accumulator pattern baked in.

### Q1. Why does functional programming use recursion instead of loops?

Because a `for`/`while` loop needs **mutable state** — a counter or index you increment, an accumulator you reassign each pass. In pure FP nothing mutates, so there is no `i` to bump and no variable to overwrite. Repetition is expressed instead as a function that calls itself with *new* argument values; what an imperative loop keeps in mutable locals, recursion keeps in the parameter list. The loop's "current state" becomes "the arguments to this call."

```kotlin
// imperative: mutate i and acc
fun sumImperative(xs: List<Int>): Int {
    var acc = 0
    for (x in xs) acc += x   // acc is reassigned each pass
    return acc
}

// functional: state lives in the parameters, nothing mutates
fun sumRec(xs: List<Int>): Int =
    if (xs.isEmpty()) 0 else xs.first() + sumRec(xs.drop(1))
```

In practice, mainstream languages give you `map`/`filter`/`fold` so you rarely hand-write the recursion — but those combinators are themselves recursion (or an internal loop) with a name. The concept underneath is: iteration and recursion are equivalent in power; FP just picks the one that doesn't require mutation.

### Q2. What is structural recursion? Show it over a list and a tree.

Structural recursion means the shape of your code mirrors the shape of your data. A list is "empty, or a head plus a smaller list"; a tree is "a leaf, or a node with smaller subtrees." You write one branch per constructor, and each recursive call is on a strictly smaller piece — which is why termination is obvious.

```scala
// list: base case = Nil, recursive case = head :: tail
def sum(xs: List[Int]): Int = xs match {
  case Nil     => 0
  case h :: t  => h + sum(t)   // recurse on the smaller tail
}

// tree: base case = Leaf, recursive case = Branch(left, right)
sealed trait Tree
case class Leaf(v: Int) extends Tree
case class Branch(l: Tree, r: Tree) extends Tree

def total(t: Tree): Int = t match {
  case Leaf(v)      => v
  case Branch(l, r) => total(l) + total(r)   // two recursive calls
}
```

The tree case shows why recursion beats loops for nested data: a `for` loop naturally walks a flat sequence, but a tree needs the call stack to remember the parent while you descend a child. That's structural recursion doing implicit backtracking for you.

### Q3. What is a tail call, and why does tail position matter?

A call is in **tail position** if it is the last thing the function does — its result becomes the function's result directly, with no operation wrapping it. It matters because a tail call leaves *no pending work* on the current frame, so there is nothing to come back to. A TCO-capable compiler can therefore discard the current frame and reuse it, making the recursion run in constant stack space.

```javascript
// NOT tail-recursive: the `n *` happens AFTER the call returns
function fact(n) {
  if (n <= 1) return 1;
  return n * fact(n - 1);   // multiply is pending → frame must stay
}

// tail-recursive: the recursive call IS the return value, nothing wraps it
function factTail(n, acc = 1) {
  if (n <= 1) return acc;
  return factTail(n - 1, n * acc);   // last action → tail position
}
```

The distinction is purely about *where the recursive call sits*. `n * fact(n-1)` must keep the frame alive to do the multiply when the call returns, so the stack grows to depth `n`. `factTail` does the multiply *before* recursing and carries it in `acc`, so the frame is dead the moment it recurses. Note: a call inside a `try` block is *not* in tail position — the exception handler is pending work.

### Q4. Rewrite a non-tail recursion into a tail-recursive one using an accumulator.

The recipe: take the work that happens *after* the recursive call and push it *into an extra parameter* (the accumulator), so that by the time you recurse there is nothing left to do afterward.

```python
def sum_naive(xs):
    if not xs:
        return 0
    return xs[0] + sum_naive(xs[1:])   # the `+` is pending work

def sum_acc(xs, acc=0):
    if not xs:
        return acc
    return sum_acc(xs[1:], acc + xs[0])   # tail position; work moved into acc
```

Two things to notice. First, the accumulator often changes the order of evaluation: `sum_naive` adds on the way *back up* the stack, `sum_acc` adds on the way *down*. For `+` that's fine (associative), but for non-commutative operations (string building, list construction) you may get a reversed result and need to compensate. Second — and this is the Python gotcha — `sum_acc` *is* tail-recursive but Python has **no TCO**, so it still overflows on a long list. The accumulator pattern is necessary for TCO but only pays off on a runtime that actually performs it. In Python you'd write the loop.

### Q5. Which languages actually implement TCO? Be precise.

This is where overclaiming gets you caught. The accurate map:

| Language / runtime | TCO? | Notes |
|---|---|---|
| Scheme, Racket | Yes (guaranteed) | The standard *requires* proper tail calls. |
| Scala | Opt-in | `@tailrec` verifies + rewrites *self*-recursion to a loop; general/mutual tail calls are not optimized on the JVM. |
| Kotlin | Opt-in | `tailrec` modifier, same story — self tail-recursion only. |
| Elixir/Erlang, F#, OCaml, Haskell | Yes | Core to the runtime/idiom. |
| Clojure | Manual | No auto-TCO on JVM; use explicit `recur` (loop) or `trampoline`. |
| **Java / JVM (general)** | **No** | The JVM has no tail-call bytecode; deep recursion overflows. `javac` does not eliminate tail calls. |
| **Python (CPython)** | **No** | Guido rejected it *deliberately* — he values readable tracebacks and explicit loops over TCO. |
| **JavaScript** | Spec: yes; reality: mostly no | ES2015 mandates Proper Tail Calls, but only JavaScriptCore (Safari) ships it. V8 (Node, Chrome) removed it; SpiderMonkey (Firefox) never shipped it. |

The senior takeaway: on the three platforms most people interview and work in — JVM, CPython, Node/V8 — you **cannot** rely on TCO. So there you keep an explicit loop, use an explicit stack for tree traversal, or trampoline. `@tailrec`/`tailrec` are worth reaching for precisely because they turn "I hope this is a tail call" into a compile error if it isn't.

### Q6. What does Scala's `@tailrec` (or Kotlin's `tailrec`) actually do?

It does **not** make anything faster and it does **not** magically enable general TCO. It is a *checked contract*: the compiler verifies the annotated function is genuinely self-tail-recursive and rewrites it into a plain `while` loop (a jump with updated locals). If the call turns out *not* to be in tail position, compilation **fails** — which is exactly the value: you find out at build time, not via a production `StackOverflowError`.

```scala
import scala.annotation.tailrec

@tailrec
def gcd(a: Int, b: Int): Int =
  if (b == 0) a else gcd(b, a % b)   // compiles: call is in tail position

@tailrec
def factBad(n: Int): Int =
  if (n <= 1) 1 else n * factBad(n - 1)
// ^ compile ERROR: "recursive call not in tail position" (the * wraps it)
```

Because it rewrites to a loop, it also sidesteps the JVM's lack of TCO. The limitation: it only handles a function calling *itself*. Mutual recursion between two functions won't qualify — for that you need a trampoline. Kotlin's `tailrec` keyword behaves the same way.

### Q7. What is trampolining and when do you need it?

A trampoline lets you get TCO-like flat-stack behaviour on a runtime that lacks TCO. The trick: instead of a function *calling* the next step (which grows the stack), it *returns a thunk* describing the next step. A driver loop — the trampoline — repeatedly invokes whatever thunk it gets back until a final value appears. The recursion depth becomes iterations of that loop plus heap-allocated thunks, so the native stack stays flat.

```javascript
// each step returns EITHER a final value OR a function to call next
function trampoline(fn) {
  let result = fn;
  while (typeof result === "function") result = result();
  return result;
}

// tail-recursive-in-spirit sum that never grows the JS stack
function sumTo(n, acc = 0) {
  if (n === 0) return acc;
  return () => sumTo(n - 1, acc + n);   // return a thunk, don't call
}

trampoline(() => sumTo(1_000_000)); // works; direct recursion would overflow
```

You need it when: (a) you have genuinely deep or unbounded recursion, (b) the runtime has no TCO (JVM/Python/V8), and (c) restructuring to a plain loop is awkward — classically **mutual recursion** or interpreter/state-machine code. The cost is real: every step allocates a closure, so a trampoline is slower and GC-heavier than a native loop. Prefer a plain loop or explicit stack when the structure allows it; reach for the trampoline when it doesn't.

### Q8. What is mutual recursion and why is it a problem for TCO?

Mutual recursion is two or more functions that call each other rather than themselves. The textbook toy is even/odd:

```kotlin
fun isEven(n: Int): Boolean = if (n == 0) true  else isOdd(n - 1)
fun isOdd(n: Int): Boolean  = if (n == 0) false else isEven(n - 1)
```

Each call *is* in tail position, yet `tailrec`/`@tailrec` **cannot** help: those annotations only rewrite a function that calls *itself* into a loop, and here the tail call lands in a *different* function. Only runtimes with *general* proper tail calls (Scheme, Erlang, OCaml) keep this flat automatically; on the JVM/CPython/V8 `isEven(1_000_000)` overflows. Fixes: merge the two functions into one with an extra "which mode" flag so it becomes self-recursion (then `tailrec` applies), rewrite as a loop, or run both through a shared trampoline that bounces thunks between them. Mutual recursion is common in recursive-descent parsers and interpreters, which is exactly where the trampoline earns its keep.

### Q9. A naive recursive function overflows on a large input. Walk through diagnosing and fixing it.

```java
// StackOverflowError on a 200_000-element list on the JVM
static long sum(List<Integer> xs, int i) {
    if (i == xs.size()) return 0;
    return xs.get(i) + sum(xs, i + 1);   // pending add → frame per element
}
```

Diagnose: the stack trace is thousands of identical frames — the tell-tale of unbounded recursion depth, not a logic bug. Ask three questions. (1) *Is there a reachable base case?* Here yes, so it's not infinite recursion. (2) *Is the recursion tail-recursive?* No — `xs.get(i) +` is pending after the call, so depth scales with `n`. (3) *Does this runtime do TCO?* JVM: no. So even rewriting to tail form won't save you here. The fix on the JVM is the pragmatic one — **use a loop** (or a Stream):

```java
static long sum(List<Integer> xs) {
    long acc = 0;
    for (int x : xs) acc += x;   // O(1) stack, O(n) time
    return acc;
}
```

For a *tree* where you can't easily loop, replace the call stack with an **explicit `Deque` stack** and push child nodes — same algorithm, heap-allocated frontier, flat native stack. General rule of thumb: on JVM/Python/Node, treat any recursion whose depth is proportional to input size as a latent overflow, and convert it to iteration or an explicit stack.

### Q10. When is recursion the right choice versus a loop, in a pragmatic multi-paradigm codebase?

Reach for recursion when the *data or algorithm is recursive*: trees, graphs, parsing, divide-and-conquer (quicksort, mergesort), backtracking. There the recursive version is dramatically clearer and the depth is typically `O(log n)` or bounded by tree height, so overflow isn't a concern. Reach for a **loop** when you're iterating a flat sequence to a size proportional to input on a no-TCO runtime (JVM/Python/JS) — recursion there buys nothing but a `StackOverflowError` risk and is *slower* (frame push/pop, no frame reuse). In between, prefer the **named combinator** — `map`/`filter`/`reduce`/`fold` — which reads as intent and hides whether the implementation loops or recurses. And when you do write deliberate deep tail-recursion in Scala/Kotlin, annotate it `@tailrec`/`tailrec` so the compiler *guarantees* it stays flat. The instinct: match the tool to the data shape, and never rely on TCO on a platform that doesn't provide it.

### Q11. The interview one-liner: recursion & TCO in one crisp paragraph.

Recursion is FP's loop — with no mutable counter, repetition is a function calling itself and carrying its "loop state" in its arguments — and structural recursion mirrors the shape of lists and trees so termination is self-evident; the catch is that an ordinary recursion pushes a stack frame per level and overflows on deep input, so you move the pending work into an **accumulator** to reach *tail position*, where a runtime with **tail-call optimization** can reuse the frame and run in O(1) stack — but you must know which runtimes actually do it (Scheme/Erlang/OCaml yes; Scala/Kotlin only via `@tailrec`/`tailrec` for self-recursion; **the JVM, CPython, and V8/Node do not**, and JS's specced proper tail calls ship only in Safari), which is why in mainstream languages you keep a loop, use an explicit stack, or **trampoline** deep and mutual recursion to keep the native stack flat.


## Currying & Partial Application

### Summary

**What this topic covers**

Two closely-related techniques for turning a function that takes many arguments into something more flexible: **currying** (rewriting an n-ary function as a chain of one-argument functions) and **partial application** (pinning some arguments now and getting back a function of the rest). They are constantly conflated — including by working engineers — so a big part of the value here is drawing the line cleanly and knowing which one your language actually gives you. We cover arity, why these techniques matter in practice (specialisation, configuration, adapting a function to a higher-order function that expects a unary callback, and building pipelines), how each mainstream language expresses them (Haskell/ML curry by default; JS/TS lean on closures, arrow chains and `bind`; Python has `functools.partial`; Kotlin uses lambdas; Java is deliberately limited), and the real use cases you'd actually reach for: a pre-configured logger, a partially-applied API client, and dependency injection done with nothing more than a partially-applied constructor function.

**Mental model**

A function of `(a, b, c)` is one machine with three input slots that only runs once all three are filled. **Currying** turns it into three machines bolted in a line: feed `a`, get a machine waiting for `b`; feed `b`, get a machine waiting for `c`; feed `c`, it finally runs. **Partial application** is the pragmatic cousin — you don't insist on one-at-a-time, you just say "here are the first one or two arguments, hand me back a smaller function for whatever's left." The unifying insight is that **arguments don't all have to arrive at the same time or from the same place.** Some are known at *configuration* time (the log level, the base URL, the DB handle) and some at *call* time (the message, the request path, the row). Currying and partial application let you bake in the early-known arguments and pass around a smaller, more specialised function — which reads better, tests easier, and slots straight into `map`/`filter` and pipelines that expect a unary function. Under the hood in every mainstream language, both are just **closures** capturing the fixed arguments.

**Key terms**

- **Arity** — how many arguments a function takes. A binary (arity-2) function curried becomes `a -> b -> result`.
- **Currying** — transforming `f(a, b, c)` into `f(a)(b)(c)`: a chain of **unary** functions, each returning the next.
- **Partial application** — fixing *some* arguments of a function to produce a new function of the remaining ones; the result can still be multi-argument.
- **Unary / n-ary** — a unary function takes one argument; n-ary takes n. Currying's output is a chain of unary functions.
- **Closure** — the function-plus-captured-environment that actually *holds* the fixed arguments. Both techniques are closures underneath.
- **Point-free / tacit style** — defining functions by composing others without naming the argument; currying makes this ergonomic.
- **Curried by default** — languages (Haskell, OCaml, ML) where every function is already a chain of unary functions, so partial application is "just don't pass the last argument."
- **`bind`** — JS's built-in partial application: `f.bind(thisArg, x)` fixes `this` and leading arguments.
- **`functools.partial`** — Python's standard-library partial application, including by keyword.
- **Placeholder** — a hole for an argument you *don't* want to fix yet (e.g. Ramda's `R.__`), letting you partially apply out of order.

**Why interviewers ask this**

It's a fast probe for whether you actually understand closures and higher-order functions or just memorised the vocabulary. A junior defines currying and partial application interchangeably and stops. A senior draws the distinction crisply (**currying is a strict shape — a chain of unary functions; partial application is a use — fixing some arguments**), notes that *most day-to-day "currying" in JS is really partial application*, and can connect it to real design: "I partially apply the DB connection into my repository functions instead of pulling in a DI container." The strongest signal is knowing what your language gives you for free versus what you fake with a closure — Haskell curries automatically; Java gives you almost nothing and you reach for a lambda; Python hands you `functools.partial`. Bonus points for mentioning the gotchas: currying kills the performance-friendly variadic call, and Python/JS won't magically curry for you.

**Common confusions**

- "Currying and partial application are the same thing" — no. Currying always yields **unary** steps regardless of use; partial application fixes some arguments and may leave a multi-argument function.
- "`f.bind(null, 1)` curries `f`" — that's **partial application**, not currying; true currying would give `f(1)(2)(3)`.
- "Currying requires special language support" — you can hand-roll it with closures anywhere; Haskell just does it automatically.
- "Partial application mutates the original function" — it returns a **new** function; the original is untouched.
- "You can partially apply from the right easily" — only if the language supports placeholders or keyword args; positional-only partial application fills arguments left-to-right.

**What follows from this topic**

This sits directly on top of **Closures** (the capture mechanism) and **Higher-Order Functions** (currying's whole point is producing functions to feed to `map`/`filter`/`reduce`). It feeds forward into **Function Composition & Pipelines**, where curried unary functions are what make `pipe`/`compose` clean, and into the **FP-vs-OOP** contrast, where partial application is the functional answer to dependency injection. If closures feel shaky, shore them up first — currying is closures wearing a suit.

### Q1. Define currying and partial application, and state the difference precisely.

**Currying** transforms an n-ary function into a chain of unary functions: `f(a, b, c)` becomes `f(a)(b)(c)`, where each call takes exactly one argument and returns another function, until the last one returns the result. It's a **structural transformation** — the shape is fixed regardless of how you use it.

**Partial application** takes a function and *some* of its arguments, and returns a new function expecting the rest: from `f(a, b, c)` and `a`, you get `g(b, c)`. The result can still be multi-argument.

The crisp line: **currying is about the shape** (always unary steps); **partial application is about the act** (fixing arguments to get a smaller function). Currying a function then supplying one argument *is* a partial application — but you can partially apply without ever currying.

```text
curry:   f(a, b, c)              ->  a => b => c => result     (shape change)
partial: f(a, b, c), fix a       ->  (b, c) => result          (fewer args)
```

They meet because a curried function, given fewer than all its arguments, is naturally partially applied. In curried-by-default languages the two ideas collapse into one.

### Q2. Show currying vs partial application in JavaScript so the difference is unmistakable.

```javascript
function add(a, b, c) { return a + b + c; }

// Partial application via bind: fix `a`, keep a 2-arg function
const add5 = add.bind(null, 5);
add5(10, 20);            // 35  -- still takes two args at once

// Currying: rewrite as a chain of unary functions
const curriedAdd = a => b => c => a + b + c;
curriedAdd(5)(10)(20);   // 35  -- one arg per call, three calls

// A generic curry helper for an arbitrary fixed-arity fn
function curry(fn) {
  return function curried(...args) {
    return args.length >= fn.length
      ? fn(...args)
      : (...more) => curried(...args, ...more);
  };
}
const cadd = curry(add);
cadd(5)(10)(20);         // 35
cadd(5, 10)(20);         // 35  -- this helper also allows partial groups
cadd(5)(10, 20);         // 35
```

`add.bind(null, 5)` is partial application — you handed over one argument and got a still-binary function. `a => b => c => …` is currying — every step is strictly unary. The `curry` helper blurs the two deliberately, which is why real-world JS "currying" is usually partial application in disguise.

### Q3. Which mainstream languages curry by default, and what does that buy you?

**Haskell and the ML family (OCaml, F#, Standard ML) curry everything automatically.** There is no such thing as a two-argument function in Haskell — `add :: Int -> Int -> Int` is sugar for `Int -> (Int -> Int)`, a function returning a function. So partial application is simply "stop passing arguments."

```haskell
add :: Int -> Int -> Int
add a b = a + b

add5 :: Int -> Int
add5 = add 5          -- partial application, for free, no helper

map (add 5) [1,2,3]   -- [6,7,8]  -- feed a partially-applied fn straight to map
```

What it buys you: **partial application costs zero ceremony**, point-free composition is natural (`map . filter` style pipelines read cleanly), and the type signature `a -> b -> c` literally documents that you can stop early. The tradeoff is that a genuinely variadic or "all arguments at once" call has no special fast path — but that's rarely a concern in these languages. Mainstream languages don't curry by default because they favour familiar multi-argument calls and variadics; you opt in with a closure or a helper.

### Q4. How do you partially apply in Python?

Python's standard library ships `functools.partial`, which fixes leading positional arguments and/or keyword arguments and returns a callable for the rest.

```python
from functools import partial

def connect(host, port, timeout, path):
    return f"{host}:{port}{path} (t={timeout})"

api = partial(connect, "api.example.com", 443, timeout=30)  # fix infra args once, vary path per call
api(path="/users")     # 'api.example.com:443/users (t=30)'
api(path="/orders")    # 'api.example.com:443/orders (t=30)'
```

`partial` fills positional arguments **left to right**, but because Python has keyword arguments you can skip ahead by naming them — that's how you fake right-side or out-of-order partial application. Python has **no built-in currying**; if you want `f(a)(b)(c)` you write nested functions or a decorator. Note also that Python has no tail-call optimisation, so don't build deep currying chains expecting recursion-style efficiency — each step is just another closure and stack frame.

### Q5. Java barely supports this — what can and can't you do?

Java has no currying and no `functools.partial` equivalent. What it *does* have since Java 8 is lambdas and functional interfaces, so you simulate partial application by capturing arguments in a closure.

```java
import java.util.function.Function;
import java.util.function.BiFunction;

BiFunction<Integer, Integer, Integer> add = (a, b) -> a + b;

// "Partial application": capture a, return a Function of b
Function<Integer, Integer> add5 = b -> add.apply(5, b);
add5.apply(10);        // 15

// "Currying" by hand: a chain of Function<>
Function<Integer, Function<Integer, Integer>> curriedAdd = a -> b -> a + b;
curriedAdd.apply(5).apply(10);   // 15
```

The limits are real: Java has no variadic-arity generic function type (you're stuck with `Function`, `BiFunction`, and hand-written interfaces beyond two arguments), the generics get noisy fast, and there's no library sugar in the standard library. It works, but it's verbose enough that idiomatic Java usually reaches for a constructor or a small class instead of a deep curry chain. This is a fair thing to say out loud in an interview: Java *can* express these ideas but doesn't make them ergonomic.

### Q6. Show partial application in Kotlin.

Kotlin has no dedicated `partial` in its standard library, but lambdas and function references make it a one-liner, and it reads cleanly.

```kotlin
fun log(level: String, tag: String, msg: String) =
    println("[$level] $tag: $msg")

// Partially apply level + tag once, get a message-only logger
val dbError: (String) -> Unit = { msg -> log("ERROR", "DB", msg) }
dbError("connection refused")   // [ERROR] DB: connection refused

// A tiny currying helper via extension-style lambdas
fun <A, B, C> ((A, B) -> C).curried(): (A) -> (B) -> C =
    { a -> { b -> this(a, b) } }

val add = { a: Int, b: Int -> a + b }
val add5 = add.curried()(5)
add5(10)                        // 15
```

Kotlin's default-argument support also covers a lot of the ground partial application would — you often don't need it. When you do, a captured lambda is the idiomatic route.

### Q7. Why does currying matter for higher-order functions and pipelines?

Because `map`, `filter`, and `pipe`/`compose` expect **unary** functions, and currying manufactures exactly those. Instead of writing a throwaway lambda at every call site, you partially apply a general function down to the one-argument shape the HOF wants.

```javascript
const multiply = a => b => a * b;      // curried
const double = multiply(2);            // unary, ready for map
[1, 2, 3].map(double);                 // [2, 4, 6]

// Pipelines want a -> a functions; currying supplies them
const pipe = (...fns) => x => fns.reduce((acc, f) => f(acc), x);
const addTax = multiply(1.2);
const applyDiscount = multiply(0.9);
const price = pipe(addTax, applyDiscount);
price(100);                            // 108
```

Without currying you'd write `x => multiply(2, x)` everywhere — more noise, more chances to fumble argument order. Curried building blocks compose directly. This is the practical reason FP-heavy JS libraries (Ramda, lodash/fp) ship curried-by-default versions of their functions: every function is pre-shaped for pipelines.

### Q8. Give a real use case: a configured logger and a partially-applied API client.

Both are the same move — fix the *configuration-time* arguments once, vary the *call-time* argument.

```javascript
// A configured logger: level + module fixed up front
const makeLog = (level, module) => (msg) =>
  console.log(`[${level}] ${module}: ${msg}`);

const dbInfo = makeLog("INFO", "db");
dbInfo("pool initialised");            // [INFO] db: pool initialised
dbInfo("query took 12ms");             // reuse everywhere in the module
```

```python
from functools import partial
import requests   # illustrative

def call(method, base_url, token, path, **kw):
    return requests.request(method, base_url + path,
                            headers={"Authorization": f"Bearer {token}"}, **kw)

client = partial(call, "GET", "https://api.example.com", "tok_abc")  # base URL + token baked in
client(path="/users")                  # only the path varies per call
client(path="/orders")
```

The payoff is that the rest of your code passes around `dbInfo` or `client` — small, specialised, already-configured functions — instead of repeating `base_url`, `token`, and headers at every call site. Change the config in one place and every derived function updates.

### Q9. Explain dependency injection via partial application.

In OO codebases you inject dependencies through a constructor or a DI container. In FP you can get the same decoupling by **partially applying the dependency into the function** — no framework required. The dependency (a DB handle, a clock, an HTTP client) is just an early-bound argument.

```javascript
// The "service" is a plain function whose first arg is its dependency
const findUser = (db, id) => db.query("SELECT * FROM users WHERE id = ?", id);

// Wire it up at composition time by partially applying the real db
const db = makePostgresConnection();
const userRepo = { find: (id) => findUser(db, id) };   // db injected once

// In a test, inject a fake by partially applying a stub instead
const fakeDb = { query: (_sql, id) => ({ id, name: "alice" }) };
const testRepo = { find: (id) => findUser(fakeDb, id) };
```

`findUser` never reaches out for a global connection — the dependency arrives as an argument, and partial application binds the *real* one in production and a *stub* in tests. That's textbook dependency inversion achieved with a closure. The senior framing: **partial application is dependency injection without the container** — testable, explicit, and with the wiring visible at the composition root instead of hidden in annotations.

### Q10. What are the main gotchas and performance caveats?

- **They're not interchangeable.** Saying you "curried" a function when you called `bind` with one argument is a red flag; that's partial application. Keep the vocabulary straight.
- **No automatic currying in mainstream languages.** JS, Python, Java, Kotlin won't curry for you — you write a helper or nested closures. Only the Haskell/ML family curries by default.
- **Argument order matters.** Positional partial application fills left-to-right. Put the *stable, configuration-time* arguments first (dependency, config) and the *varying, call-time* argument last, or you can't partially apply cleanly. Python and Ramda give you keyword args / placeholders to escape this.
- **Closures capture, and JS captures by reference.** A partially-applied function closing over a mutable variable sees later mutations — bind the value, not a moving target.
- **No free lunch on efficiency.** Each currying step allocates a closure and a call frame. Python and the JVM have **no tail-call optimisation**, so don't build pathologically deep chains expecting them to be free. For hot paths, a plain multi-argument call is cheaper.
- **Over-currying hurts readability.** `f(a)(b)(c)(d)(e)` is clever and unreadable. Curry where it buys composition; otherwise pass arguments normally.

### Q11. The interview one-liner: currying and partial application in one crisp paragraph.

Currying and partial application both exploit the fact that a function's arguments don't have to arrive all at once: **currying** rewrites an n-ary function as a chain of unary functions (`f(a)(b)(c)`), a fixed structural shape, while **partial application** simply fixes some arguments now and returns a smaller function for the rest — currying is the shape, partial application is the act, and a curried function called with too few arguments *is* partially applied. Haskell and ML curry by default so partial application is free; in JS/TS you use closures, arrow chains, or `bind`; Python has `functools.partial`; Kotlin uses lambdas; Java can express it but makes it verbose. The payoff is specialisation and configuration — bake in the arguments known at setup time (a log level, a base URL, a DB handle) and pass around a small, pipeline-ready, unary function — which is also how FP does dependency injection: partial application is DI without the container. Underneath, every bit of it is just a closure capturing the arguments you've supplied so far.


## Function Composition & Point-Free Style

### Summary

**What this topic covers**

Composition is the beating heart of functional programming: build big functions out of small ones by feeding one's output into the next. This topic covers the two canonical combinators — **compose** (right-to-left, the mathematician's `f ∘ g`) and **pipe** (left-to-right, the way humans read a data flow); how composition differs from OO **method chaining** and from **language-level pipelines**; building **data pipelines** as a chain of composed transformations; **point-free / tacit style** (defining a function without ever naming its argument) and the honest readability tradeoff between elegant and cryptic; the **JS pipeline-operator proposal**, the **Elixir/F# `|>` pipe**, and the **Unix pipe** as the same idea in a shell; and the **associativity** of compose that makes all this safe to refactor. Examples span Kotlin, JS/TS (Ramda), Java method references, Python, and Rust iterators.

**Mental model**

Think of functions as **pipe segments**. Each takes one thing and returns one thing; composition welds segments end-to-end into a longer pipe, and the welded pipe is itself just another segment you can weld again. The payoff is that you stop writing intermediate variables and start describing a *transformation* declaratively: `pipe(parse, validate, save)` reads as a sentence, and each stage is independently testable. The constraint that makes it click: composition wants **unary** functions (one in, one out). Real code is full of multi-arg functions, so **currying** and **partial application** are the glue that shapes them into composable single-argument pieces — which is why compose and currying always show up together. Compose is **associative** — `(f ∘ g) ∘ h = f ∘ (g ∘ h)` — so you can freely group and extract sub-pipelines without changing behaviour, exactly like refactoring `a + b + c`. That is the license to name a middle chunk of a pipeline and reuse it. It is *not* commutative: order is everything.

**Key terms**

- **compose** — `compose(f, g)(x) = f(g(x))`; runs **right-to-left**, mirroring math notation `f ∘ g`.
- **pipe** — `pipe(f, g)(x) = g(f(x))`; runs **left-to-right**, reading in execution order. Same operation, reversed argument list.
- **point-free / tacit style** — defining a function by combining other functions, without mentioning the argument: `const clean = pipe(trim, toLower)` vs `x => toLower(trim(x))`.
- **the "point"** — the argument/data value; "point-free" = "argument-free".
- **combinator** — a higher-order function (like `compose`) that builds functions from functions.
- **unary function** — one argument, one return value; the natural currency of composition.
- **method chaining** — `x.a().b().c()`; fluent OO calls on a receiver, resolved by the object's type.
- **pipeline operator** — syntax (`|>`) that threads a value through function calls left-to-right, at the language level.
- **associativity** — grouping doesn't matter: `compose(compose(f,g),h) === compose(f,compose(g,h))`.
- **transducer** — a composable transformation independent of the collection it runs over (composition applied to `map`/`filter` steps).
- **Kleisli composition** — composing functions that return wrapped values (`a -> M b`), i.e. chaining with `flatMap` instead of plain application (see the monad topic).

**Why interviewers ask this**

Composition separates people who *use* FP features from people who *think* in them. A junior can call `.map().filter()`; a senior can explain why `compose` is right-to-left, why it needs unary functions, why currying exists to feed it, and when a point-free rewrite crosses from elegant into unreadable. The strong signal is **honesty about the tradeoff**: a candidate who insists everything should be point-free is as suspect as one who's never composed two functions. Interviewers also probe the boundary questions — "how is this different from method chaining?", "is compose associative?", "what does `pipe` give you that a `for` loop doesn't?" — because they reveal whether you understand composition as an algebraic property or just a syntax trick. Bonus signal: connecting it to Unix pipes and the language pipeline proposals shows you see it as a cross-paradigm idea, not a Haskell curiosity.

**Common confusions**

- **compose vs pipe direction** → `compose` is right-to-left (last function listed runs first); `pipe` is left-to-right. They're the same operation with the argument order flipped — not different algorithms.
- **point-free means fewer bugs** → it means fewer *names*, not fewer bugs. Over-applied it hides the data flow and gets cryptic ("pointless style").
- **composition == method chaining** → chaining is dispatch on an object (`this`-bound, needs methods on the type); composition is free functions welded by a combinator, independent of any class.
- **the pipeline operator is just sugar for compose** → close, but `|>` threads a concrete value *now*; `compose` builds a *new function* for later. One is application, one is construction.
- **you can compose any two functions** → only when the shapes line up: output type of `g` must match input type of `f`, and multi-arg functions must be curried/adapted first.

**What follows from this topic**

Composition is the reason currying and higher-order functions matter — curried, unary, higher-order functions are what compose consumes. When the functions being composed return *wrapped* values (`Optional`, `Result`, `Promise`), plain composition breaks and you need `flatMap`/monadic (Kleisli) composition — the bridge to the monads topic. Immutability keeps each pipeline stage side-effect-free so composition stays predictable (immutability, pure functions). And the whole idea scales up: a data pipeline, a middleware stack, and a Unix shell one-liner are all the same associative welding of small transformations.

### Q1. What is function composition, and what's the difference between `compose` and `pipe`?

Composition combines two or more functions so the output of one becomes the input of the next, yielding a new function. The two conventions differ only in **direction**:

- **`compose`** runs **right-to-left**, matching math's `f ∘ g` meaning "f after g": `compose(f, g)(x) === f(g(x))`.
- **`pipe`** runs **left-to-right**, in execution order: `pipe(f, g)(x) === g(f(x))`.

Both are trivial to implement with `reduce`:

```js
const compose = (...fns) => x => fns.reduceRight((acc, fn) => fn(acc), x);
const pipe    = (...fns) => x => fns.reduce((acc, fn) => fn(acc), x);

const trim    = s => s.trim();
const toLower = s => s.toLowerCase();
const slugify = pipe(trim, toLower, s => s.replace(/\s+/g, "-"));

slugify("  Hello World  ");  // -> "hello-world"
```

`pipe` reads the way data flows, so most pragmatic codebases prefer it; `compose` reads the way you'd write nested calls or math. Same operation, reversed list.

### Q2. Show composition across a few mainstream languages.

Kotlin ships `compose` and `andThen` on function types via the stdlib:

```kotlin
val trim: (String) -> String = { it.trim() }
val lower: (String) -> String = { it.lowercase() }

val clean = trim andThen lower      // left-to-right (pipe-like)
val clean2 = lower compose trim     // right-to-left, same result
clean("  HÉ ")                      // "hé"
```

Java has no free-function compose, but `Function` provides `andThen` / `compose`:

```java
Function<String,String> trim  = String::strip;
Function<String,String> lower = String::toLowerCase;
Function<String,String> clean = trim.andThen(lower);   // strip, then lower
clean.apply("  HELLO ");                                // "hello"
```

Python has no built-in `compose`; you fold with `reduce`:

```python
from functools import reduce
def pipe(*fns):
    return lambda x: reduce(lambda acc, f: f(acc), fns, x)

clean = pipe(str.strip, str.lower)
clean("  HELLO ")   # 'hello'
```

Rust composes iterator adapters rather than named `compose`, but closures compose too: `let f = |x| g(h(x));`. The concept is universal; only the ergonomics differ.

### Q3. How is composition different from method chaining?

They look similar (`pipe(a,b,c)` vs `x.a().b().c()`) but differ in mechanism:

- **Method chaining** dispatches on a **receiver object**. Each method must exist on the type (or a base/interface), returns `this` or a new wrapper, and the chain is bound to that class's API. It's OO's fluent style: `stream.filter(...).map(...).collect(...)`, `Optional.map(...).orElse(...)`, jQuery.
- **Composition** welds **free functions** with a combinator. The functions know nothing about each other or any class; you can pull any of them out, reuse it elsewhere, or reorder the pipeline. No shared receiver.

Practically: chaining is great when the operations naturally belong to one type (a collection, a builder). Composition wins when you're assembling behaviour from functions that live in different modules and you want them independently testable and reusable. Java Streams are chaining; Ramda `pipe` is composition. Many codebases mix both.

### Q4. What is point-free (tacit) style, and when does it help vs hurt?

Point-free means defining a function purely by combining other functions, **never naming the argument** (the "point"):

```js
// pointful — names the argument x
const isLongName = user => user.name.length > 20;

// point-free — no argument mentioned
const nameLength = pipe(prop("name"), length);
const isLong     = pipe(nameLength, gt(20));   // reads: name -> length -> >20
```

**When it helps:** short, linear pipelines where naming the argument adds noise — `const clean = pipe(trim, toLower)` is clearly better than `s => toLower(trim(s))`. It emphasises the *transformation* over the *data*.

**When it hurts:** the moment the data flow branches, uses an argument twice, or needs awkward combinators (`converge`, `useWith`, flipped args) to stay point-free, it becomes **"pointless style"** — cryptic, hard to debug (no named intermediates in stack traces), and hostile to the next reader. Senior rule of thumb: reach for point-free on straight pipelines; drop back to a named lambda the instant it fights you.

### Q5. Show a realistic data pipeline built as composed transformations.

Reshaping a list of raw records into a summary — each stage is a small, testable transform:

```js
const R = require("ramda");

const activeUserEmails = R.pipe(
  R.filter(u => u.active),            // keep active
  R.map(u => u.email.toLowerCase()),  // normalise
  R.uniq,                             // dedupe
  R.sortBy(R.identity)                // stable order
);

activeUserEmails(rawUsers);           // string[]
```

The same shape in Kotlin using the collection DSL (chaining, but conceptually a composed pipeline):

```kotlin
val emails = users
    .filter { it.active }
    .map { it.email.lowercase() }
    .distinct()
    .sorted()
```

And in Python:

```python
emails = sorted({u["email"].lower() for u in users if u["active"]})
```

The functional framing lets you *name and reuse* sub-pipelines: `const normalize = R.pipe(R.map(lower), R.uniq)` becomes a building block dropped into many flows. That reusability is exactly what associativity guarantees is safe.

### Q6. Why does composition need currying and unary functions?

`compose`/`pipe` thread **one value** from stage to stage, so each stage must be a **unary** function: one argument in, one value out. Real functions take multiple arguments, so you shape them with **currying / partial application** before they can join a pipeline:

```js
const add = a => b => a + b;          // curried
const mul = a => b => a * b;
const f = pipe(add(1), mul(3));       // x -> (x+1) -> *3
f(4);                                 // 15
```

Without currying you'd have to wrap every multi-arg call in a lambda — `x => mul(3, x)` — which is just manual partial application. Ramda/Lodmash-fp curry their whole API precisely so `map`, `filter`, `add`, `prop` slot into `pipe` argument-first. This is why the currying topic and this one are inseparable: currying manufactures the unary building blocks that composition consumes. Kotlin/Java don't auto-curry, so you use lambdas or method references to reach the same unary shape.

### Q7. What does it mean that `compose` is associative, and why should I care?

Associativity means grouping doesn't change the result:

```
compose(compose(f, g), h)  ===  compose(f, compose(g, h))
```

Just like `(a + b) + c === a + (b + c)`. The practical payoff is **refactoring freedom**: any contiguous chunk of a pipeline can be extracted, named, and reused without altering behaviour.

```js
const full = pipe(parse, validate, enrich, save);
// extract a middle sub-pipeline — guaranteed identical behaviour
const prepare = pipe(validate, enrich);
const full2   = pipe(parse, prepare, save);   // same as `full`
```

Crucially, composition is associative but **not commutative** — you can regroup, but you cannot reorder. `pipe(f, g) !== pipe(g, f)` in general. Associativity is also the law that lets libraries offer both `compose(...fns)` variadic forms and let you build them incrementally; and it's the same law (in a fancier dress) that underpins monoid/monad composition later.

### Q8. Explain the pipeline operator and the Unix-pipe analogy.

The **pipeline operator** threads a value through a series of calls left-to-right. It exists natively in several languages and is a long-running JS proposal:

```elixir
"  Hello  "                  # Elixir; F# is nearly identical with |>
|> String.trim()
|> String.downcase()
|> String.replace(" ", "-")
```

F#: `input |> trim |> toLower`. The **JS pipeline-operator proposal** (`|>`, still Stage 2, "hack" style using a `%` placeholder) would let you write `value |> trim(%) |> toLower(%)` instead of nesting or reaching for a `pipe` helper.

The **Unix pipe** is the original: `cat log | grep ERROR | sort | uniq -c` welds programs together, each reading stdin and writing stdout — process-level function composition. The mental model is identical across all three: small units, each transforming a stream, connected end-to-end. The difference: `|>`/Unix apply a value *right now* (left-to-right application), whereas `compose`/`pipe` *build a reusable function* for later. Same philosophy, different binding time.

### Q9. Refactor: turn this imperative loop into a composed pipeline.

Before — nested logic, intermediate mutation, hard to reuse:

```js
function topSpenders(orders) {
  const totals = {};
  for (const o of orders) {
    if (o.status !== "paid") continue;
    totals[o.userId] = (totals[o.userId] || 0) + o.amount;
  }
  const rows = Object.entries(totals);
  rows.sort((a, b) => b[1] - a[1]);
  return rows.slice(0, 3).map(([id]) => id);
}
```

After — a declarative pipeline of named stages:

```js
const R = require("ramda");

const topSpenders = R.pipe(
  R.filter(o => o.status === "paid"),
  R.groupBy(o => o.userId),
  R.map(R.sumBy(o => o.amount)),   // { userId: total }
  R.toPairs,
  R.sortWith([R.descend(R.nth(1))]),
  R.take(3),
  R.map(R.head)
);
```

The refactor's value isn't brevity — it's that each stage is independently understandable and testable, and `R.filter(paid)` or the sort step can be lifted out and reused. The honest caveat: a `for` loop is a single pass; a naive pipeline allocates an intermediate collection per stage. For hot paths, lazy sequences (Kotlin `asSequence()`, Rust iterators, Java streams, transducers) restore the single-pass efficiency while keeping the composed structure.

### Q10. What breaks when the composed functions return wrapped values, and how do you fix it?

Plain composition assumes `g` returns exactly what `f` expects. It breaks the moment a stage returns a **wrapped** value — `Optional`, `Result`, `Promise`, a list — because the next stage expects the *unwrapped* thing:

```js
// findUser: id -> Optional<User>;  getEmail: User -> Optional<string>
// pipe(findUser, getEmail) is BROKEN: getEmail receives an Optional, not a User
```

The fix is **monadic (Kleisli) composition** — chain with `flatMap` instead of plain application, so each step unwraps before feeding the next:

```java
Optional<String> email = findUser(id)      // Optional<User>
    .flatMap(this::getEmail)               // unwraps, applies, re-wraps
    .map(String::toLowerCase);
```

```kotlin
val user: User? = findUser(id)?.let(::getEmail)?.lowercase()  // ?. is null-monad composition
```

Same story with `Promise.then` (async composition), `Result`/`?` in Rust, and list `flatMap`. The unifying idea: when values live in a "box," you compose the box-returning functions with `flatMap`, and that operation — `(a -> M b)` composed with `(b -> M c)` — is Kleisli composition. It's the direct sequel to this topic; the monads topic formalises it.

### Q11. The interview one-liner.

Function composition is the discipline of building large behaviour by welding small unary functions end-to-end — `compose` right-to-left like math, `pipe` left-to-right like reading — an associative (but not commutative) operation that lets you name and reuse any sub-pipeline freely; currying manufactures the unary pieces it consumes, point-free style trims the argument names when the flow is linear (and turns cryptic when it isn't), and the same idea shows up everywhere from Ramda `pipe` and Elixir/F#'s `|>` to Unix shell pipes and Java `Function.andThen` — with monadic `flatMap` composition taking over the instant your stages start returning `Optional`, `Result`, or `Promise`.


## Algebraic Data Types & Pattern Matching

### Summary

**What this topic covers**

Algebraic data types (ADTs) are the FP way to model data as a **closed shape**: a value is *this* combination of fields (a **product** type — record/tuple/struct) or it is *one of* a fixed set of alternatives (a **sum** type — tagged union/sealed hierarchy/enum). Paired with **pattern matching**, ADTs let you take a value apart by shape and — crucially — let the **compiler tell you when you forgot a case** (exhaustiveness checking). This topic covers what "algebraic" actually means (counting inhabitants), the design mantra *make illegal states unrepresentable*, pattern matching / destructuring / exhaustiveness, and how the mainstream languages spell all of this: Rust `enum` + `match`, Kotlin `sealed` + `when`, Scala `enum`/case class + `match`, Java `sealed` + `record` + pattern-matching `switch`, TypeScript discriminated unions, and Python `match`.

**Mental model**

Think of a type as a **set of possible values**, and think in *cardinality*. A `Bool` has 2 inhabitants. A struct `{ a: Bool, b: Bool }` has 2 × 2 = 4 — a **product**, you *multiply* because you pick one `a` **and** one `b`. A tagged union "either a `Bool` **or** a `Bool`" has 2 + 2 = 4 — a **sum**, you *add* because it's one alternative **or** the other. That is literally why they're called *algebraic*: `struct`/tuple = multiplication, `enum`/union = addition, `Unit` = 1, an empty/`Never` type = 0, and (bonus) a function `A -> B` has `|B|^|A|`. The senior payoff of the cardinality lens: **shrink the number of representable-but-invalid states toward zero.** A design where "loading" and "has data" can both be true has too many inhabitants; an ADT with four disjoint states has exactly the right number. Combine that with exhaustive pattern matching and adding a new case becomes a *compiler-enforced to-do list* — every `match` that doesn't handle it fails to compile.

**Key terms**

- **Product type** — fields combined with AND: record, tuple, struct, `data class`, `record`. Inhabitants multiply.
- **Sum type** — alternatives combined with OR: tagged union, `enum` (Rust/Swift-style), `sealed` hierarchy, discriminated union. Inhabitants add.
- **Tag / discriminant** — the field that says *which* variant a sum value currently is (`kind`, the enum case, the concrete subtype).
- **Pattern matching** — control flow that branches on a value's shape *and* binds its parts in one step.
- **Destructuring** — pulling fields out of a value positionally or by name (`let (x, y) = p`).
- **Exhaustiveness checking** — the compiler proves every variant is handled, else it errors.
- **Make illegal states unrepresentable** — choose types so bad combinations simply cannot be constructed.
- **Sealed / closed hierarchy** — the set of variants is fixed and known at compile time (enables exhaustiveness).
- **Guard** — an extra boolean condition on a match arm (`case n if n > 0`).
- **Recursive ADT** — a sum type referencing itself (an `Expr`, a `Tree`, a linked `List`).
- **`Option`/`Result`** — the canonical sum types: `Some|None`, `Ok|Err` — see errors-as-values and Option/Either.

**Why interviewers ask this**

Modeling with ADTs is one of the cleanest signals of design maturity. A junior reaches for a bag of nullable fields plus boolean flags and defends it at runtime with `if (data != null && !loading)`. A senior reaches for a sum type so the invalid combinations *don't exist* and lets an exhaustive `match` enforce completeness at compile time. The follow-ups probe depth: "why is a sealed `when` safer than an `instanceof` ladder?" (the compiler catches the missing case), "what breaks when you add a variant?" (with a wildcard `_`/`default`, nothing warns — a silent bug; without one, every switch fails to compile — a feature), "count the states this struct allows." Getting the cardinality framing right shows you reason about types as sets, not just syntax.

**Common confusions**

- "An `enum` is just named integer constants" — that's a C enum. The powerful ADT `enum` (Rust/Swift/Scala 3) is a *sum type* where each variant **carries its own data**.
- "Pattern matching is a fancy `switch`" — a switch tests one scalar; pattern matching tests *shape*, destructures, nests, and (in real ADT languages) is *exhaustiveness-checked*.
- "A wildcard default is good hygiene" — on a sum type, a catch-all `_`/`default` **silently swallows** future variants and defeats exhaustiveness. Prefer listing every case.
- "Python `match` gives me exhaustiveness" — it does **not** at runtime (unmatched falls through); only a type checker with `assert_never` approximates it.
- "Sum types are unions like `A | B` in C" — a C `union` is *untagged* (unsafe). ADT sums are *tagged*: the discriminant is part of the value.

**What follows from this topic**

ADTs are the substrate for the FP idioms in the rest of this primer. `Option`/`Result` (error handling and Option/Either) are just sum types; `flatMap`/`map` over them (see higher-order functions and monads) are pattern matches in disguise. immutability is what makes a matched-and-rebuilt value safe to share. And the *expression problem* — do you make it easy to add new cases or new operations? — is exactly the ADT-vs-OOP-polymorphism tradeoff explored below and in the OOD primer's Visitor discussion.

### Q1. What is an algebraic data type, and why "algebraic"?

An **algebraic data type** is a composite type built from two operations:

- **Product** (AND): a value holds *several* fields at once — a tuple, record, struct, `data class`, `record`. To build one you supply field `a` **and** field `b`.
- **Sum** (OR): a value is *exactly one of* several tagged variants — a `sealed` hierarchy, a Rust/Scala/Swift `enum`, a discriminated union. It is variant `X` **or** variant `Y`.

"Algebraic" refers to **counting inhabitants** (cardinality), where the type operations behave like arithmetic:

| Type | Inhabitants |
|---|---|
| `Unit` / `()` | 1 |
| `Bool` | 2 |
| `Never` / empty enum | 0 |
| product `(A, B)` | `|A| × |B|` |
| sum `A + B` | `|A| + |B|` |
| `Option<A>` | `1 + |A|` |
| function `A -> B` | `|B|^|A|` |

So a struct `{ ready: Bool, value: Bool }` has 2×2 = 4 inhabitants; a sum "`Ready(Bool)` or `Pending`" has 2+1 = 3. The lens is practical, not academic: **fewer inhabitants means fewer invalid states means fewer bugs.** When you design a type, ask "how many values does this allow, and are all of them legal?" If the count is bigger than the number of *valid* states, you've left room for a bug.

### Q2. What does "make illegal states unrepresentable" mean? Show the classic before/after.

It means choosing types so that a nonsensical combination *cannot be constructed* — the compiler, not a runtime guard, rules it out. The canonical example is the state of an async fetch.

The **product-of-flags** version allows contradictions — `isLoading: true` *and* `data` set, or `error` *and* `data` both present:

```typescript
// BAD: 2 × (T|null) × (Error|null) inhabitants — most are nonsense
interface RemoteData<T> {
  isLoading: boolean;
  data: T | null;
  error: Error | null;
}
```

The **sum-type** version has exactly the four states that make sense, and no others:

```typescript
type RemoteData<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: T }
  | { status: "failure"; error: Error };
```

Now "loading with data" is not a bug you handle — it's a value you *cannot type*. Every consumer must `switch` on `status`, and `data`/`error` are only in scope inside the arm where they exist. This is the everyday senior use of ADTs: push validity into the type so the wrong states never reach runtime.

### Q3. Show me a sum type — the same `Shape` — across languages.

`Shape` is *circle OR rectangle OR triangle*, each carrying its own fields (a sum of products). `area` is one exhaustive match.

Rust — `enum` with data + `match`:

```rust
enum Shape {
    Circle { radius: f64 },
    Rectangle { width: f64, height: f64 },
    Triangle { base: f64, height: f64 },
}

fn area(s: &Shape) -> f64 {
    match s {
        Shape::Circle { radius } => std::f64::consts::PI * radius * radius,
        Shape::Rectangle { width, height } => width * height,
        Shape::Triangle { base, height } => 0.5 * base * height,
    }
}
```

Kotlin — `sealed interface` + `when`:

```kotlin
sealed interface Shape
data class Circle(val radius: Double) : Shape
data class Rectangle(val width: Double, val height: Double) : Shape
data class Triangle(val base: Double, val height: Double) : Shape

fun area(s: Shape): Double = when (s) {
    is Circle -> Math.PI * s.radius * s.radius
    is Rectangle -> s.width * s.height
    is Triangle -> 0.5 * s.base * s.height
}
```

TypeScript — discriminated union on a `kind` tag:

```typescript
type Shape =
  | { kind: "circle"; radius: number }
  | { kind: "rectangle"; width: number; height: number }
  | { kind: "triangle"; base: number; height: number };

const area = (s: Shape): number => {
  switch (s.kind) {
    case "circle":    return Math.PI * s.radius ** 2;
    case "rectangle": return s.width * s.height;
    case "triangle":  return 0.5 * s.base * s.height;
  }
};
```

Note the shared structure: one tag, N variants, one branch per variant, fields visible only inside their own arm.

### Q4. Exhaustiveness checking — why is it the real win over an `instanceof`/`if-else` chain?

Because it moves "did you handle every case?" from *hope* to *compile error*. With a hand-written `instanceof` ladder, forgetting a subtype compiles fine and blows up (or silently returns a default) at runtime — and stays wrong forever if no test exercises it. With an exhaustive match over a **sealed** set, adding a new variant makes **every** match that doesn't handle it fail to compile. The compiler hands you the exact list of call sites to update. That is the single most valuable property of ADTs in a large codebase.

Languages differ in how they give it to you:

- **Rust** — `match` is exhaustive; missing arm is a hard error (`non-exhaustive patterns`).
- **Java** — `switch` over a `sealed` type must cover all permitted subtypes or it won't compile.
- **Kotlin** — a `when` used as an *expression*, or (since Kotlin 1.7) as a statement on a sealed/enum subject, must be exhaustive.
- **Scala** — a `match` on a sealed type gives a *warning* ("match may not be exhaustive"); with `-Werror`/`-Xfatal-warnings` it's an error.
- **TypeScript** — **not** automatic; you opt in with the `never` trick (Q10).
- **Python** — **no** exhaustiveness at runtime; a type checker with `assert_never` approximates it.

The corollary: a wildcard `_`/`default` arm **turns exhaustiveness off** for future variants. On a closed sum, omit it deliberately so new cases break the build.

### Q5. Pattern matching vs a plain `switch` vs destructuring — what's actually different?

A C/JS `switch` compares one scalar against constants. **Pattern matching** matches on *structure* and *binds* substructure in the same step, supports **nesting**, and adds **guards**. Destructuring is the binding half of it (pulling fields out); pattern matching is destructuring *plus* choosing a branch by shape.

Rust shows all of it at once — nested patterns, binding, a guard, and a range:

```rust
enum Msg { Move { x: i32, y: i32 }, Write(String), Quit }

fn describe(m: &Msg) -> String {
    match m {
        Msg::Move { x: 0, y: 0 }        => "origin".into(),         // literal in pattern
        Msg::Move { x, y } if *x == *y  => format!("diag {x}"),     // guard
        Msg::Move { x, y }              => format!("({x},{y})"),    // bind both
        Msg::Write(s) if s.is_empty()   => "empty write".into(),
        Msg::Write(s)                   => format!("write {s}"),
        Msg::Quit                       => "quit".into(),
    }
}
```

Order matters: arms are tried top-to-bottom, first match wins, so specific patterns go above general ones. Pure destructuring without branching is the degenerate case — `let Point { x, y } = p;` in Rust, `const { x, y } = p;` in JS, `case Point(x, y):` in Python.

### Q6. How does Java model ADTs, and what's the pattern-matching `switch`?

Java assembles ADTs from three finalized features: **records** (product types, JEP 395), **sealed** classes/interfaces (closed sums, JEP 409), and **pattern matching for `switch`** (JEP 441) with **record patterns** (JEP 440), all GA in Java 21.

```java
sealed interface Shape permits Circle, Rectangle, Triangle {}
record Circle(double radius) implements Shape {}
record Rectangle(double width, double height) implements Shape {}
record Triangle(double base, double height) implements Shape {}

static double area(Shape s) {
    return switch (s) {                       // exhaustive: no default needed
        case Circle(double r)         -> Math.PI * r * r;      // record pattern destructures
        case Rectangle(double w, double h) -> w * h;
        case Triangle(double b, double h)  -> 0.5 * b * h;
    };
}
```

Two things to call out for interviews. First, because `Shape` is `sealed`, the compiler knows the full variant set, so omitting a case is a **compile error** — no `default` required (and adding one would silently absorb future variants). Second, **record patterns** destructure in the label (`case Circle(double r)`), and you can add **guards** with `when`: `case Circle c when c.radius() > 0 -> ...`. This is Java catching up to what Kotlin/Scala/Rust had for years; the semantics are the same sealed-sum + exhaustive-match idea.

### Q7. Recursive ADTs — model an arithmetic expression and evaluate it.

Sum types that reference themselves model trees directly, which is why ADTs are the natural fit for ASTs, JSON, and interpreters. An `Expr` is a number, or an addition/multiplication of two sub-`Expr`s, or a negation — and `eval` is one recursive match.

Rust (the self-reference needs a `Box` for a known size):

```rust
enum Expr {
    Num(f64),
    Add(Box<Expr>, Box<Expr>),
    Mul(Box<Expr>, Box<Expr>),
    Neg(Box<Expr>),
}

fn eval(e: &Expr) -> f64 {
    match e {
        Expr::Num(n)    => *n,
        Expr::Add(a, b) => eval(a) + eval(b),
        Expr::Mul(a, b) => eval(a) * eval(b),
        Expr::Neg(a)    => -eval(a),
    }
}
```

Scala 3 says the same thing very compactly:

```scala
enum Expr:
  case Num(n: Double)
  case Add(l: Expr, r: Expr)
  case Mul(l: Expr, r: Expr)
  case Neg(e: Expr)

def eval(e: Expr): Double = e match
  case Expr.Num(n)    => n
  case Expr.Add(l, r) => eval(l) + eval(r)
  case Expr.Mul(l, r) => eval(l) * eval(r)
  case Expr.Neg(x)    => -eval(x)
```

Adding a `Div` variant makes `eval` fail to compile until you handle it — the ADT keeps the interpreter and the grammar in lockstep. Contrast the OOP approach (a method per node class), which is the subject of the next card.

### Q8. ADT + match vs OOP polymorphism / Visitor — which should I use? (the expression problem)

They're duals, and the deciding question is **which axis you expect to grow**: variants (data cases) or operations (functions over them). This is the *expression problem*.

- **ADT + pattern matching** makes **adding an operation** trivial: write one new function with a match; touch nothing else. Adding a **variant** is the expensive direction — every match must be updated (though exhaustiveness *tells you* exactly where).
- **OOP subtype polymorphism** (a method per subclass) is the mirror image: **adding a variant** is trivial (new subclass implements the interface), but **adding an operation** means editing every existing class — which is what the **Visitor** pattern exists to work around (and Visitor essentially re-implements a sum-type match by hand). See the OOD & Design Patterns primer for Visitor.

Rule of thumb: **closed data, open operations → ADTs** (an AST's node set is fixed, but you keep adding passes: eval, print, optimize, type-check). **Open data, fixed operations → polymorphism** (plugins/shapes where new kinds arrive but the operation set is stable). ADTs also win when you want the *whole shape* visible in one place and exhaustiveness enforced; OOP wins when variants live in separate modules/teams and shouldn't know about each other.

### Q9. How do `Option` and `Result` fit in — and why prefer them over `null`?

They're the two most important sum types in day-to-day code, and recognizing them *as* ADTs is the point.

- `Option<T>` = `Some(T)` **+** `None` — "a `T`, or nothing" (cardinality `1 + |T|`).
- `Result<T, E>` = `Ok(T)` **+** `Err(E)` — "success `T`, or failure `E`" (`|T| + |E|`).

The difference from `null` is that the absence/failure is **in the type** and the compiler forces you to match it before touching the value:

```rust
fn first_even(xs: &[i32]) -> Option<i32> {
    xs.iter().copied().find(|n| n % 2 == 0)
}

match first_even(&[1, 3, 4]) {
    Some(n) => println!("found {n}"),
    None    => println!("none"),
}
```

A bare `null` (or an unchecked exception) carries no such obligation — that's the "billion-dollar mistake." Kotlin's `T?` + smart-casts, Java's `Optional<T>`, TS's `T | undefined` with strict null checks, and Haskell/Scala's `Maybe`/`Option` are all the same sum-type idea with varying enforcement. And the FP combinators you use on them — `map`, `flatMap`/`and_then`, `getOrElse` — are just *pre-packaged pattern matches* so you don't hand-write the `Some/None` branch every time. See errors-as-values, Option/Either, and monads.

### Q10. What are the gotchas — non-exhaustiveness, wildcards, and Python/TS?

Four traps that separate people who've shipped ADTs from people who've read about them:

**1. The wildcard defeats exhaustiveness.** A catch-all `_`/`default` on a closed sum means adding a variant compiles silently and hits the fallthrough at runtime. On a sealed type, *omit* the wildcard so new cases break the build. Keep wildcards for genuinely open sets (e.g. matching an `i32`).

**2. TypeScript needs the `never` trick.** TS won't error on a missing union case by itself. Force it by assigning the value to `never` in the default:

```typescript
const area = (s: Shape): number => {
  switch (s.kind) {
    case "circle":    return Math.PI * s.radius ** 2;
    case "rectangle": return s.width * s.height;
    case "triangle":  return 0.5 * s.base * s.height;
    default: {
      const _exhaustive: never = s;   // compile error if a variant is unhandled
      return _exhaustive;
    }
  }
};
```

**3. Python `match` has no exhaustiveness at runtime.** An unmatched value simply falls through (the `match` does nothing / your function returns `None`). You approximate the check statically with `typing.assert_never` in a `case _:` and a type checker:

```python
from typing import assert_never

def area(s):
    match s:
        case Circle(radius=r):
            return 3.14159 * r * r
        case Rectangle(width=w, height=h):
            return w * h
        case _ as unreachable:
            assert_never(unreachable)   # pyright/mypy flag a missing variant
```

Also note Python's `case Point(x, y)` uses `__match_args__` (dataclasses set it for you), and a *bare* name in a pattern **binds**, it doesn't compare — `case foo:` matches anything and captures it, a classic footgun.

**4. Kotlin `when` as a statement.** Historically a non-exhaustive `when` *statement* only warned; rely on it as an *expression* (or Kotlin 1.7+) to get the hard error.

### Q11. The interview one-liner: ADTs & pattern matching in one crisp paragraph.

**Algebraic data types** model data as **products** (structs/records/tuples — fields combined with AND, inhabitants multiply) and **sums** (sealed/tagged unions/`enum`s — variants combined with OR, inhabitants add); "algebraic" is the cardinality view where you *count and minimize* the representable states so that **illegal states become unrepresentable**. **Pattern matching** then takes such a value apart by shape — binding, nesting, and guarding in one step — and, over a *sealed* set, the compiler enforces **exhaustiveness**, turning "you forgot a case" from a runtime bug into a compile error and turning "add a variant" into a compiler-generated to-do list. Every mainstream language now offers it — Rust `enum`/`match`, Kotlin `sealed`/`when`, Scala `enum`/`match`, Java `sealed` + `record` + pattern `switch`, TypeScript discriminated unions, Python `match` — and the ubiquitous `Option`/`Result` are simply the sum types you already use; reach for ADTs when your data cases are closed and your operations keep growing, and prefer listing every case over a wildcard so the compiler keeps working for you.


## Option/Maybe, Either/Result — Errors as Values

### Summary

**What this topic covers**

Two of the highest-leverage FP ideas that mainstream languages have already adopted: modelling **absence** with `Option`/`Maybe` (Java `Optional`, Kotlin's nullable `T?`, Rust `Option<T>`, Scala `Option`, Haskell `Maybe`) and modelling **failure** with `Either`/`Result` (Rust `Result<T, E>`, Scala `Either[E, A]`, Kotlin `Result<T>`, Arrow's `Either`). The unifying move is **errors as values**: instead of a `null` that blows up later or an exception that jumps the stack invisibly, the *type* tells you a value might be missing or an operation might fail, and the compiler forces you to deal with it. From there we build **railway-oriented programming** — chaining `map`/`flatMap` so the happy path stays flat and the first error short-circuits — and cover `getOrElse`/`orElse`/`unwrap_or`, the `map`-vs-`flatMap` distinction, and, honestly, when exceptions are still the right tool. This is also a preview of monads: `flatMap` on these types *is* monadic bind.

**Mental model**

Think of every fallible step as a stretch of **two-track railway**: a success track and a failure track. A function that can fail takes a value on the success track and either keeps it there or switches it to the failure track. `map` transforms whatever is on the success track and leaves the failure track untouched. `flatMap` (Rust `and_then`, Scala/Kotlin `flatMap`) is for the step that *itself* returns a track — it splices that step's railway in, so a failure anywhere routes straight to the end without derailing everything after it. You write the happy path as a flat top-to-bottom pipeline as if nothing fails; the error handling is threaded automatically by the type. The payoff: **failure is in the type signature, not in a comment or a wiki page.** `parseUser(s): Result<User, ParseError>` tells the caller everything. A signature returning `User` that secretly throws tells them nothing. You trade the invisibility and non-locality of exceptions for explicit, type-checked, composable control flow — the compiler becomes your code reviewer for unhandled failure.

**Key terms**

- **Option / Maybe** — a container that is either `Some(x)`/`Just x` or `None`/`Nothing`. Models *absence* with no error detail.
- **Either / Result** — a container that is either success (`Ok`/`Right`) or failure (`Err`/`Left`) *carrying an error value*. Models *why* it failed.
- **`map`** — apply `A -> B` inside the container; `Option<A> -> Option<B>`. Never changes success/failure status.
- **`flatMap` / `and_then` / bind** — apply `A -> Option<B>` and flatten; the sequencing operation. `flatMap` = monadic bind.
- **short-circuit** — once you hit `None`/`Err`, every downstream `map`/`flatMap` is skipped and the failure passes through.
- **`getOrElse` / `unwrap_or` / `orElse`** — leave the container: supply a default, or an alternative container, when empty/failed.
- **`?` operator (Rust)** — syntactic sugar for "unwrap `Ok`, or early-return the `Err`"; railway sugar built into the language.
- **right-biased** — Scala `Either`'s `map`/`flatMap` operate on the `Right` (success) side; `Left` conventionally carries the error.
- **billion-dollar mistake** — Tony Hoare's term for `null`; `Option` is the type-level fix.
- **total function** — returns a real value for every input (returns `Option`) instead of throwing for some — a *partial* function.

**Why interviewers ask this**

A junior reaches for exceptions and `null` reflexively and treats `Optional`/`Result` as annoying wrappers to `.get()`/`.unwrap()` out of as fast as possible — reintroducing exactly the crash they were meant to prevent. A senior reads a signature and knows what it means: `Optional<User>` says "may be absent, handle it"; `Result<User, DbError>` says "may fail, here's the failure type." The senior signal is knowing *which* to use (absence vs typed failure), being able to build a validation pipeline that composes without a pyramid of null-checks, knowing `map` vs `flatMap` cold, and — crucially — being *honest* about when exceptions still win (truly exceptional, unrecoverable conditions; deep call stacks where threading a `Result` through every frame is noise). Overclaiming that "exceptions are always bad" is a junior tell; the pragmatic take is what lands.

**Common confusions**

- **`Optional` replaces all `null`** → No. It's for *return values* that may be absent. As a field or parameter type it's usually noise (and non-serializable on the JVM); a nullable param is fine.
- **`map` vs `flatMap`** → Use `map` when your function returns a plain `B`; use `flatMap` when it returns *another* `Option`/`Result`. `map` with a container-returning function gives you `Option<Option<B>>` — the nesting bug that signals you wanted `flatMap`.
- **`Option` and `Either`/`Result` are different beasts** → They're the same shape; `Option` is `Either` with `Unit`/no info on the failure side. Reach for `Either`/`Result` the moment you need to know *why*.
- **`.get()`/`.unwrap()` is "handling" it** → It's asserting it can't fail. In Rust `unwrap` panics; `Optional.get()` throws. Fine at a proven boundary, a landmine in a pipeline.
- **Kotlin `T?` is a full `Option`** → It's a compiler-checked nullable, and `?.`/`?:` cover most uses ergonomically — but you can't nest it (`T??` collapses) the way `Option<Option<T>>` can.

**What follows from this topic**

`flatMap` here is the same operation as `flatMap` on `List`, on `Promise`/`Future`, and on the abstract **monad** covered later — this topic is the concrete on-ramp to that abstraction and its laws. The **error-handling** and **purity** topics build on "errors as values" as the pure alternative to throwing. **Immutability** and **ADTs / pattern matching** are the substrate: `Option`/`Either` are sealed sum types you destructure with `match`/`when`. And the railway pattern reappears in the **composition** topic as function composition over fallible steps.

### Q1. What problem does `Option`/`Maybe` solve, and how is it better than `null`?

`null` is a single value that inhabits *every* reference type, so the compiler can't tell a "definitely present" `User` from a "maybe present" one — the absence is invisible until a `NullPointerException` fires far from the cause. Tony Hoare called inventing it his "billion-dollar mistake." `Option<T>` (Scala/Rust) / `Maybe a` (Haskell) makes absence a *distinct type*: `Option<User>` is not a `User`, so you physically cannot call `.name` on it without first handling the `None` case. The check moves from runtime to compile time.

```kotlin
// Kotlin makes it a first-class part of the type system with `?`
fun find(id: Int): User? = repo[id]          // nullable return
val name = find(1)?.name ?: "unknown"        // safe-call + elvis default
```

```rust
fn find(id: u32) -> Option<User> { repo.get(&id).cloned() }
let name = find(1).map(|u| u.name).unwrap_or_else(|| "unknown".into());
```

Java's `Optional<T>` is the same idea as a library type. The win is uniform: a `None`/empty can't be dereferenced by accident, and `map`/`flatMap`/`getOrElse` give you a vocabulary for "do this if present, else that" without an `if (x != null)` ladder.

### Q2. `Option` vs `Either`/`Result` — when do you reach for each?

`Option` answers *"is there a value?"* — it carries no reason for absence. `Either`/`Result` answers *"did it succeed, and if not, why?"* — the failure side carries an error value you can inspect, log, or branch on.

| | absence | typed failure |
|---|---|---|
| Rust | `Option<T>` | `Result<T, E>` |
| Scala | `Option[A]` | `Either[E, A]` (Right = success) |
| Kotlin | `T?` | `Result<T>` (or Arrow `Either<E, A>`) |
| Haskell | `Maybe a` | `Either e a` |

Rule of thumb: a cache lookup or "find by id" returns `Option` — not-found isn't an error, it's a normal outcome. Anything that can fail for *distinguishable reasons* (parse error vs I/O error vs validation error) returns `Result`/`Either` so the caller can react to the specific cause. Structurally `Option<T>` is just `Either<Unit, T>` — same railway, the failure track simply carries no cargo.

```rust
fn parse_port(s: &str) -> Result<u16, String> {
    s.parse::<u16>().map_err(|_| format!("bad port: {s}"))
}
```

### Q3. Explain `map` vs `flatMap` on these types.

`map` applies a function that returns a **plain value**; `flatMap` applies a function that returns **another wrapped value**, then flattens the result. Get this wrong and you get nesting.

```scala
val o: Option[Int] = Some(2)
o.map(x => x + 1)          // Some(3)          — function returns Int
o.map(x => Some(x + 1))    // Some(Some(3))    — nesting bug!
o.flatMap(x => Some(x+1))  // Some(3)          — flatMap flattens
```

The trigger: **if your transforming function is itself fallible (returns `Option`/`Result`), you need `flatMap`** (Rust `and_then`, Scala/Kotlin `flatMap`). If it always succeeds and returns a bare value, use `map`. This is exactly monadic **bind**: `flatMap : F<A> -> (A -> F<B>) -> F<B>` is the signature of `>>=`. `map` is the weaker `Functor` operation; `flatMap` is what makes these types *monads* and is what lets you *sequence* dependent fallible steps.

### Q4. What is railway-oriented programming?

A way of composing fallible steps so the happy path reads as a flat pipeline while errors short-circuit automatically. Picture two parallel tracks — success and failure. Each step either stays on the success track or switches to failure; once on failure, every later step is skipped and the error slides straight to the output.

```scala
def validate(r: Request): Either[Error, Response] =
  parse(r)                    // Either[Error, Parsed]
    .flatMap(checkAuth)       // Parsed  => Either[Error, AuthedReq]
    .flatMap(loadUser)        // AuthedReq => Either[Error, User]
    .map(render)              // User => Response  (can't fail => map)
```

No `try`/`catch`, no nested `if err != nil`, no early-return ladder — the *type* threads the failure. Each `flatMap` is a set of points on the track: if `checkAuth` returns `Left`, `loadUser` and `render` never run and that `Left` is the result. It's the FP answer to Go's repetitive `if err != nil` and to exception spaghetti: linear, composable, and every branch's error type is checked.

### Q5. Show the same validation pipeline across languages.

Registering a user: parse age, check it's adult, check the email — each step can fail, failures short-circuit.

```rust
fn register(age: &str, email: &str) -> Result<User, String> {
    let age: u8 = age.parse().map_err(|_| "age not a number".to_string())?;
    if age < 18 { return Err("must be 18+".into()); }
    if !email.contains('@') { return Err("bad email".into()); }
    Ok(User { age, email: email.into() })
}
```

```kotlin
// Arrow's Either with the `either { }` builder; `bind()` is flatMap/short-circuit
fun register(ageStr: String, email: String): Either<String, User> = either {
    val age = ageStr.toIntOrNull().toRight { "age not a number" }.bind()
    ensure(age >= 18) { "must be 18+" }
    ensure(email.contains('@')) { "bad email" }
    User(age, email)
}
```

```scala
def register(ageStr: String, email: String): Either[String, User] =
  for {
    age <- ageStr.toIntOption.toRight("age not a number")
    _   <- Either.cond(age >= 18, (), "must be 18+")
    _   <- Either.cond(email.contains("@"), (), "bad email")
  } yield User(age, email)
```

Note Scala's `for`-comprehension and Rust's `?` are *both* sugar over `flatMap`/short-circuit — same railway, different syntax.

### Q6. What do `getOrElse`, `orElse`, and `unwrap_or` do — and how do they differ?

They're the ways to *leave* the container and get a concrete value or a fallback. The distinction is what the fallback is:

- **`getOrElse` / `unwrap_or(x)`** — supply a **plain default value** for the empty/error case. `Option<T> -> T`.
- **`orElse`** — supply an **alternative container**; used to chain fallbacks that are themselves fallible. `Option<T> -> Option<T>`.
- **`unwrap_or_else(f)` / `getOrElse(lazy)`** — like the above but the default is **computed lazily**, only if needed.

```rust
config.get("port").unwrap_or(8080);                 // default value
config.get("port").or_else(|| env_port());          // try another Option
cache.get(k).unwrap_or_else(|| expensive_compute()); // lazy default
```

```scala
opt.getOrElse(8080)          // eager default
opt.orElse(fallbackOpt)      // alternative Option
either.getOrElse(defaultVal) // Either -> A, discards the error
```

Use `getOrElse`/`unwrap_or` at the **edge** of the pipeline where you finally must produce a real value; use `orElse` mid-pipeline to express "try A, else B." Prefer the lazy `*_else` forms when the default is expensive — `unwrap_or(expensive())` evaluates `expensive()` unconditionally.

### Q7. Refactor this imperative, exception-throwing code to errors-as-values.

```java
// Before: throws, null, nested — caller has no idea what can go wrong
User load(String id) {
    Row r = db.query(id);          // may return null
    if (r == null) throw new NotFound(id);
    if (!r.isActive()) throw new Inactive(id);
    return mapUser(r);             // may throw MappingException
}
```

The signature `User load(String)` hides three failure modes. Make them explicit with `Result`:

```rust
enum LoadErr { NotFound(String), Inactive(String), Mapping(String) }

fn load(id: &str) -> Result<User, LoadErr> {
    let row = db.query(id).ok_or(LoadErr::NotFound(id.into()))?;
    if !row.active { return Err(LoadErr::Inactive(id.into())); }
    map_user(row).map_err(|e| LoadErr::Mapping(e.to_string()))
}
```

Now the type lists every failure, the caller must `match` on `LoadErr`, and the `?` keeps the body flat. The `enum LoadErr` is a sum type (ADT) — pattern-matching on it is exhaustive, so adding a new failure variant makes every caller a compile error until handled. That's the whole pitch: **unhandled failure becomes a type error instead of a production incident.**

### Q8. When are exceptions still the right call? Don't just say "never."

Errors-as-values shine for *expected, recoverable* outcomes — validation, parsing, lookups, anything the caller should branch on. Exceptions still earn their place for:

- **Truly exceptional, unrecoverable conditions** — out-of-memory, programmer bugs (index out of bounds, broken invariant). Rust models these as `panic!`, not `Result`, on purpose.
- **Deep call stacks** where the failure is handled far up top and threading a `Result` through twenty intermediate frames is pure noise — an exception's non-local jump is the *feature* there.
- **Language-idiomatic boundaries** — Python and Java code is exception-native; forcing `Result` everywhere fights the ecosystem (libraries, frameworks, `try-with-resources`).

Be precise about mechanics: exceptions are invisible in the type (checked exceptions were Java's attempt to fix that and are widely disliked), they carry stack traces `Result` doesn't, and they're often *faster* to write for one-off scripts. The senior position isn't "exceptions bad" — it's "**use values for expected failures the caller reasons about; reserve exceptions for the genuinely exceptional.**" Many teams draw the line exactly there.

### Q9. How do `Optional`/`Result` connect to monads — the preview.

These are the two monads every mainstream engineer already uses without the vocabulary. A monad is a type `M<A>` with two operations: a way to lift a plain value in (`Some`/`Ok`/`of`/`pure`) and **bind** (`flatMap`), which sequences dependent steps. `Option`, `Either`/`Result`, `List`, and `Promise`/`Future` are all monads — and `flatMap` *is* bind in each:

```kotlin
optional.flatMap { ... }   // Option monad
result.flatMap { ... }     // Result/Either monad
list.flatMap { ... }       // List monad (cartesian)
promise.then { ... }       // Promise ~ monad (.then ~ flatMap)
```

The reason `for`-comprehensions (Scala), `do`-notation (Haskell), Rust's `?`, and Arrow's `either { bind() }` all exist is that "sequence steps where each may short-circuit" is such a common shape it got dedicated syntax — and that syntax works for *any* monad, not just error types. The **monad topic later** formalises this with the three laws (left identity, right identity, associativity); for now the practical takeaway is: **once you can spell `flatMap`, you already understand the monad you'll be asked to define.**

### Q10. The interview one-liner.

`Option`/`Maybe` and `Either`/`Result` turn absence and failure from invisible runtime landmines — `null` dereferences and thrown exceptions — into **values the type system tracks**, so the compiler forces you to handle the missing user or the failed parse instead of discovering it in production; you compose fallible steps with `map` (transform the success) and `flatMap`/`and_then` (sequence another fallible step, which is monadic bind) into a **railway** where the happy path stays flat and the first error short-circuits to the end, escape at the edge with `getOrElse`/`unwrap_or`, and you keep exceptions for the genuinely exceptional rather than pretending they're always wrong.


## Lazy Evaluation & Infinite Streams

### Summary

**What this topic covers**

The difference between doing work **now** and doing it **only when the answer is demanded**. We cover eager vs lazy evaluation, thunks and deferred computation, and the pragmatic form most engineers actually meet: **lazy sequences/streams** — Java `Stream`, Kotlin `Sequence`, JS generators/iterators, Python generators and `itertools`, Rust iterators, and Haskell's whole-language laziness. From there: **infinite streams** (naturals, Fibonacci) made finite by `take`; **short-circuiting** terminal operations (`find`, `any`, `all`) that stop mid-traversal; **memoisation** of a lazy value computed at most once (`lazy val`, `once_cell`); and the two dark corners — the **space leak / retained-head** gotcha, and the way laziness **defers exceptions and confuses debugging**. The throughline: laziness lets you write an infinite or expensive description and pay only for what you consume.

**Mental model**

A lazy sequence is a **recipe, not a meal.** An eager pipeline (`list.map(f).filter(g)`) cooks the whole first course, plates it, then cooks the second — every stage materialises a full intermediate collection. A lazy pipeline hands each element down the whole chain before touching the next: element flows `map → filter → collect`, one at a time, and no intermediate list ever exists. That single shift buys three things. **Infinity becomes usable** — `naturals().map(square).take(5)` terminates because only 5 elements are ever demanded. **Wasted work disappears** — `find(isPrime)` stops the instant it hits one. **Fusion** — chained transforms collapse into a single pass with no throwaway allocations. The cost is that nothing happens until a **terminal/consuming** operation pulls, so a pipeline with no consumer does *nothing*, exceptions surface late and far from their cause, and a lazy value you accidentally keep a reference to can pin an unbounded amount of memory. Rule of thumb: laziness pays off on **large, infinite, or short-circuited** data, and is needless ceremony on a 10-element list.

**Key terms**

- **Eager (strict) evaluation** — an expression is computed when bound; arguments evaluated before the call. The default nearly everywhere.
- **Lazy evaluation** — computation deferred until its result is actually needed (demand-driven / call-by-need).
- **Thunk** — a zero-arg deferred computation (`() => expr`); the unit of "not yet". Forcing a thunk runs it.
- **Lazy sequence / stream** — a pull-based sequence that produces elements on demand: Java `Stream`, Kotlin `Sequence`, Rust `Iterator`.
- **Terminal / consuming operation** — the pull that drives evaluation (`collect`, `toList`, `sum`, `forEach`, `find`). Intermediate ops (`map`, `filter`) are lazy; they just build the recipe.
- **Short-circuiting** — a terminal op that stops early once the answer is known (`find`, `any`, `all`, `first`, `takeWhile`).
- **Infinite stream** — an unbounded generator (`generate`, `iterate`, `count()`, a generator loop) made finite downstream by `take`/`limit`.
- **Memoised / cached lazy value** — a thunk that runs at most once and caches its result: Scala `lazy val`, Rust `OnceCell`/`Lazy`, Kotlin `by lazy`.
- **Retained head / space leak** — holding a reference to the front of a lazy list forces the whole spine to stay in memory; the classic lazy-language footgun.
- **Fusion** — collapsing chained lazy transforms into one pass with no intermediate collection.

**Why interviewers ask this**

It separates people who *use* Streams from people who *understand* them. A junior writes `stream.map(...).filter(...)` and can't say why nothing runs without `collect`, or why an infinite `Stream.iterate` doesn't hang. A senior can explain that intermediate ops are lazy and terminal ops drive them, can build an infinite Fibonacci stream and take five, knows `find` stops early while `map` visits everything, and can name the tradeoffs honestly: laziness saves work on huge/infinite data and enables short-circuiting, but defers exceptions, muddies stack traces, and risks retained-head leaks. The strongest signal is *restraint* — knowing Kotlin `Sequence` beats `List` only past a size/chain-length threshold, and that on a small list eager is simpler and often faster.

**Common confusions**

- "Lazy means asynchronous." No — laziness is about *when* (on demand) not *where* (which thread). It's orthogonal to concurrency.
- "`stream.map(f)` runs `f`." No — it runs when a terminal op consumes it. No terminal op, no work.
- "Infinite streams hang." Only if you force the whole thing (`collect` before `limit`). `take`/`limit`/short-circuit bounds them.
- "Lazy is always faster." No — per-element pull has overhead; on small collections eager wins. Laziness pays on large/infinite/short-circuited data.
- "Kotlin `List.map` is lazy." No — `List` ops are eager and allocate each stage; only `Sequence`/`asSequence()` is lazy.
- "A memoised `lazy val` recomputes each read." No — it forces once, caches, and returns the cached value thereafter.

**What follows from this topic**

Laziness is the engine under the higher-order-function pipelines in the **HOF** topic and the **composition** topic — `map`/`filter`/`reduce` chains only fuse because the sequence is pull-based. Deferring a computation in a thunk is a **closure** capturing its environment. `take`/`iterate` producing infinite structures leans on the **recursion** topic (a stream is a recursive "head + lazy tail"). And "compute at most once, cache it" is one step from **memoisation** and referential transparency in the **pure functions** topic.

### Q1. Eager vs lazy evaluation — what's the actual difference, and give the canonical example.

**Eager (strict):** an expression is evaluated when it is bound or passed. **Lazy (call-by-need):** evaluation is deferred until the value is *demanded*, and (in call-by-need) memoised so it runs at most once.

The canonical demonstration is a function that ignores its argument:

```haskell
const_ :: a -> b -> a
const_ x _ = x

const_ 42 (error "boom")   -- Haskell: 42. The second arg is never forced.
```

In an eager language the equivalent explodes, because arguments are evaluated *before* the call:

```javascript
const constFn = (x, _y) => x;
constFn(42, (() => { throw new Error("boom"); })());  // throws — arg evaluated first
```

To get laziness in an eager language you pass a **thunk** (a zero-arg function) and force it only if needed:

```javascript
const constFn = (x, thunk) => x;                 // thunk never called
constFn(42, () => { throw new Error("boom"); }); // 42 — the () is deferred
```

This is exactly why `&&`, `||`, and `?:` are "special" in eager languages: they are the built-in islands of laziness — `a && expensive()` won't call `expensive` if `a` is false. `if/else` is lazy in its branches too. Everything else evaluates eagerly unless you wrap it in a thunk, a generator, or a lazy sequence.

### Q2. What is a thunk, and how do I build deferred computation in a mainstream language?

A **thunk** is a suspended computation: a zero-argument closure whose body runs only when you *force* it by calling it. It's the atom of laziness.

```javascript
const thunk = () => expensiveHash(bigInput); // nothing runs yet
// ... later, only if we actually need it:
const value = thunk();                       // forced here
```

Kotlin/Java use the same shape with a functional interface:

```kotlin
val thunk: () -> Config = { loadConfigFromDisk() }  // deferred
// later:
val cfg = thunk()                                    // runs now
```

Two refinements turn a raw thunk into something useful:

1. **Memoisation** — cache the result so repeated forces don't recompute (next question).
2. **Sequences of thunks** — a lazy list is conceptually `(head, () -> tail)`: a value plus a thunk producing the rest. That recursive "head + deferred tail" is literally how infinite streams are built.

Thunks are also how you fake non-strict function arguments: pass `() -> T` instead of `T` and the callee decides whether to force it. Java's `Supplier<T>`, Kotlin's `() -> T`, Scala's by-name `=> T`, and JS arrow functions are all thunk vehicles.

### Q3. Show the same lazy pipeline avoiding a full intermediate list in Java, Kotlin, and Rust.

The win: `map` then `filter` then take-first-few should make **one pass**, element by element, allocating **no** intermediate collection.

Java `Stream` — intermediate ops are lazy, `findFirst` short-circuits:

```java
Optional<Integer> r = Stream.of(1,2,3,4,5,6)
    .map(n -> { System.out.println("map " + n); return n * n; })
    .filter(n -> n > 10)
    .findFirst();          // prints map 1..4 only, then stops. r = 16
```

Kotlin — `List.map` would eagerly build a whole squared list; `asSequence()` makes it lazy:

```kotlin
val r = listOf(1,2,3,4,5,6)
    .asSequence()               // WITHOUT this, each stage allocates a List
    .map { it * it }
    .filter { it > 10 }
    .first()                    // pulls only until first match -> 16
```

Rust iterators are lazy by construction — adapters do nothing until a consumer runs:

```rust
let r = (1..=6)
    .map(|n| n * n)
    .filter(|&n| n > 10)
    .next();                    // Some(16); map/filter ran only for 1..=4
```

In all three, no `[1,4,9,16,25,36]` array is ever materialised, and elements 5 and 6 are never touched. That's fusion + short-circuiting working together.

### Q4. Java `Stream`: which operations are lazy, which force, and why does an infinite stream not hang?

`Stream` splits operations in two:

- **Intermediate** (`map`, `filter`, `peek`, `limit`, `flatMap`, `sorted`*) — return a new `Stream`, do **no** work, just extend the recipe.
- **Terminal** (`collect`, `forEach`, `reduce`, `count`, `findFirst`, `anyMatch`, `sum`) — pull elements and drive the whole pipeline. Exactly one per stream; after it, the stream is spent.

Nothing runs until the terminal op. So this is instant, not an infinite loop:

```java
List<Integer> firstFive = Stream.iterate(0, n -> n + 1) // infinite: 0,1,2,...
    .map(n -> n * n)
    .limit(5)                    // bounds it
    .collect(Collectors.toList()); // [0, 1, 4, 9, 16]
```

`limit(5)` is a short-circuiting intermediate op: the terminal `collect` pulls, `limit` says "stop after 5," and the infinite generator is only ever asked for 6 values. Put `collect` before `limit` and you'd hang forever, because `collect` would try to drain an infinite source.

Caveat: `sorted` and `distinct` are *stateful* — `sorted` on an infinite stream never terminates because it must buffer everything before emitting. Laziness doesn't save you from an op that inherently needs the whole input.

### Q5. Kotlin `Sequence` vs `List` — when does laziness actually pay off?

`List.map { }.filter { }` is **eager**: `map` allocates a full intermediate list, then `filter` allocates another. `Sequence` (via `asSequence()` or `generateSequence`) is **lazy**: element-at-a-time, no intermediates, and it can short-circuit.

```kotlin
// Eager: builds a 1,000,000-element squared list, THEN filters, THEN takes 3.
val eager = (1..1_000_000).map { it * it }.filter { it % 2 == 0 }.take(3)

// Lazy: pulls maybe ~6 elements total. No million-element list ever exists.
val lazy = (1..1_000_000).asSequence().map { it * it }.filter { it % 2 == 0 }.take(3).toList()
```

But `Sequence` is **not free**: each element pays iterator/closure-call overhead, and for small collections or single operations, eager `List` is simpler and often *faster* (better JIT/inlining, less indirection). The honest rule:

- Use `Sequence` when the collection is **large**, the chain is **long** (several `map`/`filter` stages), or you **short-circuit** (`first`, `take`, `find`).
- Use plain `List` operations for small collections and short chains.

`generateSequence` is Kotlin's infinite-stream constructor: `generateSequence(0) { it + 1 }.take(5).toList()`.

### Q6. Build an infinite Fibonacci stream and take the first 10 — in three languages.

The pattern is "seed + a function producing the next state," consumed with `take`.

JS generator — the most direct expression of a lazy infinite sequence:

```javascript
function* fib() {
  let [a, b] = [0, 1];
  while (true) { yield a; [a, b] = [b, a + b]; }   // never returns; paused at each yield
}
const take = (n, it) => { const out=[]; for (const x of it){ if(out.length===n) break; out.push(x);} return out; };
take(10, fib());   // [0,1,1,2,3,5,8,13,21,34]
```

Python generator — `itertools.islice` is the idiomatic `take`:

```python
from itertools import islice
def fib():
    a, b = 0, 1
    while True:
        yield a
        a, b = b, a + b
list(islice(fib(), 10))   # [0,1,1,2,3,5,8,13,21,34]
```

Kotlin — `generateSequence` carries state as a pair:

```kotlin
val fibs = generateSequence(0 to 1) { (a, b) -> b to (a + b) }.map { it.first }
fibs.take(10).toList()    // [0,1,1,2,3,5,8,13,21,34]
```

Java is clumsier because there's no coroutine — you `iterate` over the `(a,b)` state:

```java
Stream.iterate(new long[]{0,1}, p -> new long[]{p[1], p[0]+p[1]})
      .map(p -> p[0]).limit(10)
      .collect(Collectors.toList()); // [0,1,1,2,3,5,8,13,21,34]
```

The generator versions (JS/Python) read best because the language suspends the loop at `yield`; the FP-sequence versions thread state explicitly.

### Q7. Short-circuiting: how do `find`/`any`/`all` stop early, and why does it matter?

These terminal ops answer a question the moment they can, then abandon the rest of the traversal:

- `find`/`findFirst`/`first` — stop at the first match.
- `any`/`anyMatch` — stop at the first `true`.
- `all`/`allMatch` — stop at the first `false` (a single counterexample settles it).
- `takeWhile` — stop at the first element failing the predicate.

```python
nums = range(1, 1_000_000)
next(n for n in nums if n % 7 == 0)      # 7 — generator stops immediately
any(n > 100 for n in nums)               # True — stops at 101, doesn't scan a million
all(n > 0 for n in nums)                 # True here, but stops at first n <= 0 if present
```

Why it matters: short-circuiting is *only possible* because evaluation is demand-driven. In an eager world you'd `filter` the whole million-element range into a list and then take `[0]` — a million predicate calls and a huge allocation to answer a question that needed 7. Laziness turns "find one" and "does any exist" from O(n) worst-effort into "stop as soon as you know." This composes with infinite streams: `fib().first { it > 1000 }` terminates precisely because `first` short-circuits an unbounded source.

### Q8. Memoising a lazy value — compute at most once, then cache. Show it.

A plain thunk recomputes every force. A **memoised lazy value** forces once and caches — the sweet spot of "defer the cost, but don't pay it twice."

Scala's built-in `lazy val` (thread-safe, computed on first access):

```scala
lazy val config = { println("loading..."); loadConfig() }  // not run yet
config.timeout  // prints "loading..." once, computes, caches
config.retries  // no print — served from cache
```

Kotlin's `by lazy` delegate:

```kotlin
val config: Config by lazy { println("loading..."); loadConfig() }
// first access runs the block; subsequent accesses return the cached value
```

Rust's `OnceCell` / `LazyLock` (std) or `once_cell::Lazy`:

```rust
use std::sync::LazyLock;
static CONFIG: LazyLock<Config> = LazyLock::new(|| { println!("loading..."); load_config() });
// CONFIG derefs to the value; the closure runs exactly once, on first deref.
```

JS hand-rolled memoised thunk:

```javascript
function once(fn) { let done = false, v; return () => (done ? v : (done = true, v = fn())); }
const config = once(() => { console.log("loading..."); return loadConfig(); });
config(); config();   // logs once
```

Key subtlety: memoisation is only *safe* (referentially transparent) when the computation is **pure**. Memoising something that reads mutable state or the clock caches a stale answer — a bug, not an optimisation. Note also `lazy val`/`LazyLock` handle the concurrent double-init race; a naive `once` does not.

### Q9. The space-leak / retained-head gotcha — what is it and how does it bite?

In a fully lazy language (Haskell) a value is a thunk until forced. Two failure modes follow:

**Retained head:** if you hold a reference to the *front* of a large or infinite lazy list while walking it, the garbage collector can't reclaim the already-visited spine — you pin the whole thing in memory.

```haskell
let xs = [1..10000000]
    total = sum xs            -- fine alone
in (total, length xs)         -- BAD: xs held for both traversals; whole list retained
```

**Thunk build-up (the classic space leak):** a lazy left fold accumulates a tower of unforced `+` thunks instead of a number, then blows the stack when finally forced:

```haskell
foldl (+) 0 [1..1000000]      -- builds ((0+1)+2)+... as thunks -> space leak / stack blow
foldl' (+) 0 [1..1000000]     -- strict fold forces each step -> constant space. FIX.
```

The pragmatic-language echo: even in Java/JS, keeping a reference to a generator's start, or buffering an infinite stream, retains memory unboundedly. The defences are the same everywhere: **consume-and-discard** (don't alias the head), **force strictly** when accumulating (`foldl'`, or `reduce` with a primitive accumulator), and **bound infinite sources** with `take`/`limit` before any op that must see everything.

### Q10. When does laziness help and when does it hurt? Be honest.

**Helps:**

- **Infinite / unbounded data** — streams of naturals, event feeds, paginated APIs modelled as one lazy sequence.
- **Short-circuiting** — `find`/`any`/`takeWhile` stop early; you describe "all of it" and consume a sliver.
- **Avoiding wasted work / fusion** — long `map`/`filter` chains over large data run in one pass, no intermediate allocations.
- **Expensive-but-maybe-unused values** — `lazy val`/`by lazy` for config, connections, heavy computations you might not touch.

**Hurts:**

- **Debugging** — evaluation happens far from where the value was defined; stack traces point at the *forcing* site, not the cause.
- **Deferred exceptions** — a bad element throws when consumed, possibly deep in unrelated code, or never (if never forced). Errors move in time.
- **Space leaks** — retained heads and thunk build-up (previous question); reasoning about memory gets subtle.
- **Overhead on small data** — per-element pull costs more than a tight eager loop; needless on a 10-element list.
- **Side effects + laziness = landmines** — if `map` has a side effect and the stream is never consumed, the effect silently doesn't happen (or happens in surprising order).

Senior instinct: reach for laziness when data is **large, infinite, or short-circuited, and the pipeline is pure**. Otherwise eager is simpler, more debuggable, and often faster. Laziness is a performance/expressiveness tool, not a default.

### Q11. Refactor: turn this eager, wasteful imperative loop into a lazy pipeline.

Eager and over-computing — it squares a million numbers, filters, sorts the *whole* thing, all to get three results:

```python
squares = []
for n in range(1, 1_000_001):
    squares.append(n * n)          # 1,000,000-element list
evens = [s for s in squares if s % 2 == 0]   # another big list
first_three = sorted(evens)[:3]    # sorts everything to take 3
```

Lazy version — generators + `itertools.islice`, one pass, no big intermediate lists, stops after ~6 elements:

```python
from itertools import islice
squares = (n * n for n in range(1, 1_000_001))       # lazy generator
evens   = (s for s in squares if s % 2 == 0)          # still lazy
first_three = list(islice(evens, 3))                  # pulls only until 3 found -> [4, 16, 36]
```

(The sort was spurious — the source is already ascending, so `find first 3` needs no sort. Spotting that the eager code did unnecessary global work is half the refactor.) The Kotlin equivalent is the same idea with `asSequence`:

```kotlin
(1..1_000_000).asSequence().map { it * it }.filter { it % 2 == 0 }.take(3).toList()
```

The refactor's essence: replace "build everything, then whittle down" with "describe everything, pull only what you need."

### Q12. The interview one-liner: laziness in one crisp paragraph.

**Lazy evaluation defers a computation until its result is demanded — a recipe, not a meal — which lets you write infinite or expensive descriptions (`Stream.iterate`, Kotlin `Sequence`, JS/Python generators, Rust iterators) and pay only for what a terminal operation actually pulls; the payoffs are usable infinite streams bounded by `take`, single-pass fused pipelines with no intermediate allocations, short-circuiting `find`/`any`/`all` that stop the instant they know, and compute-once memoised values (`lazy val`, `OnceCell`); the costs are deferred exceptions, harder debugging, retained-head/thunk-buildup space leaks, and per-element overhead — so you reach for it on large, infinite, or short-circuited pure data, and stay eager on the small stuff.**


## Type Systems, Generics & Inference

### Summary

**What this topic covers**

Why the functional tradition leans so hard on **strong static types**, and how the tools that make that bearable — **parametric polymorphism** (generics), **type inference**, and a design discipline of **making illegal states unrepresentable** — show up in the mainstream languages you actually interview in. We cover the static-vs-dynamic axis and where it's really about *strength* not *timing*; the difference between parametric polymorphism (one implementation, all types) and ad-hoc polymorphism (per-type behaviour, the next topic's turf); how inference ranges from full **Hindley-Milner** (ML, Haskell — annotate nothing, get everything) down to the **local inference** in Java `var`, Kotlin, Rust, TypeScript, and Scala; **parametricity** and the "theorems for free" it buys; **variance** (covariance/contravariance, Kotlin `in`/`out`, Java wildcards) and the gotchas that trip people up; **bounded** generics; and the lightweight **newtype/phantom** tricks that push more correctness into the compiler.

**Mental model**

A type is a **proof obligation the compiler checks for free, on every build, forever**. A dynamic language runs the proof at runtime, once per code path you happen to exercise; a static language runs it exhaustively before the code ships. The functional payoff is that once your data can *only* be constructed in valid states, huge classes of bug — null derefs, "forgot the empty case", "used the value before validating it" — become **unwriteable**, not merely untested. Generics are what stop that discipline from drowning you in duplication: you write `map` once and it works for `List<Int>`, `List<User>`, `List<List<String>>`. Inference is what stops the discipline from drowning you in annotations: the compiler reconstructs the types you'd otherwise have to spell out. The senior instinct is to treat the **type as the first line of documentation and the cheapest test you'll ever write** — `parse(String): Result<User, Error>` tells you more, and enforces more, than a comment ever could. Push validity into the type, and the "what if it's null / negative / in the wrong state" questions answer themselves.

**Key terms**

- **Static typing** — types checked at compile time; errors caught before running (Java, Kotlin, Rust, Haskell, TS).
- **Dynamic typing** — types checked at runtime, attached to values not variables (Python, JS, Ruby).
- **Strong vs weak** — orthogonal to static/dynamic: how much implicit coercion the language allows. Python is dynamic *and* strong; C is static *and* weak.
- **Parametric polymorphism** — one implementation that works uniformly for all types; generics. `<T>`, `[A]`, `fun <T> id(x: T)`.
- **Ad-hoc polymorphism** — different behaviour per type via overloading or type classes/traits (next topic).
- **Type inference** — the compiler reconstructs types you didn't write.
- **Hindley-Milner (HM)** — the inference algorithm behind ML/Haskell: infers the most general type for a whole program with zero annotations.
- **Local type inference** — infers within an expression/statement but needs annotations at boundaries (Java `var`, Kotlin, Rust, TS, Scala).
- **Parametricity** — a fully-generic function is so constrained by its type it can only do a few things; yields "theorems for free".
- **Variance** — how subtyping of `T` relates to subtyping of `Box<T>`. Covariant (`out`), contravariant (`in`), invariant.
- **Bounded/constrained generic** — a type parameter restricted by a supertype or interface: `<T extends Comparable<T>>`, `T: Ord`.
- **Newtype / phantom type** — a zero-cost wrapper (or unused type param) that makes distinct concepts distinct types.

**Why interviewers ask this**

A junior says "generics let you reuse code" and stops. A senior reasons about **what a type guarantees** and **who has to prove it**. The signal is watching you reach for the type system as a design tool: turning a runtime check into a compile-time impossibility, choosing `sealed`/`enum` over a stringly-typed status field, knowing *why* `List<Dog>` is not a `List<Animal>` when the list is mutable, and being able to explain the `? extends` / `? super` (PECS) rule without hand-waving. Inference questions probe whether you understand that `var`/`auto` change nothing about the *strength* of typing — the type is still fully known, just not written. The variance gotcha (array covariance, `ArrayStoreException`) separates people who memorised syntax from people who understand soundness. And "make illegal states unrepresentable" is the phrase that tells an interviewer you think about correctness structurally, not defensively.

**Common confusions**

- **"Static means verbose."** No — HM infers everything in Haskell; Kotlin/Rust infer most locals. Verbosity is a language choice, not a static-typing tax.
- **"Dynamic means weak / static means strong."** Independent axes. Python is dynamically *and strongly* typed; it won't silently add `"3" + 5`.
- **"`var` makes Java dynamic."** No. `var x = 3` is a fully-typed `int`, resolved at compile time; you just didn't type the word.
- **"Generics exist at runtime on the JVM."** Java erases them — `List<String>` and `List<Integer>` share one class. Rust and C++ monomorphise; C#/Kotlin-on-JVM erase (Kotlin has `reified` only in inline funcs).
- **"Covariance is always safe."** Only for read-only (producer) positions. Java's covariant arrays are a known soundness hole (`ArrayStoreException`).
- **"A newtype has runtime cost."** Rust `struct Meters(f64)` and Haskell `newtype` are zero-cost; the wrapper vanishes after compilation.

**What follows from this topic**

Types are the substrate everything else in this primer stands on. **Algebraic data types** (`sealed`/`enum`/`data class`) are how you actually *build* the illegal-states-unrepresentable types gestured at here. **Type classes / traits** are the next topic's answer to ad-hoc polymorphism — the "different behaviour per type" side left out here. `Option`/`Result` and the monad topics are the payoff of pushing nullability and failure into the type.

### Q1. Static vs dynamic typing — and why does the FP tradition favour strong static types?

**Static**: every expression has a type known at compile time; the checker rejects `user.nmae` or `"3" - 1` before you run. **Dynamic**: types live on values at runtime; the same mistakes surface as exceptions when that line executes (if it ever does under test).

Crucially this is a *different axis* from **strong vs weak**, which is about implicit coercion:

| | Strong | Weak |
|---|---|---|
| **Static** | Haskell, Rust, Kotlin | C (`int`↔`char`↔pointer) |
| **Dynamic** | Python, Ruby | JavaScript (`[] + {}`), PHP |

The FP tradition (ML, Haskell, Scala) favours **strong + static** because the whole philosophy is *push correctness into things the compiler proves*. Pure functions have no hidden state, so their type signature captures almost their entire contract — `sort :: Ord a => [a] -> [a]` tells you it needs orderable elements and returns the same element type. Combine that with types that can only be built in valid states and you delete whole bug categories at compile time rather than chasing them at runtime. The pragmatic mainstream (Kotlin, Rust, TS) adopted the same stance: strong static typing, but with enough inference that it doesn't feel like Java 1.4.

### Q2. Parametric vs ad-hoc polymorphism — what's the difference?

**Parametric**: *one* implementation, uniform across all types, because it can't inspect the type. `identity`, `length`, `reverse`, `map`. The function body is blind to what `T` is.

**Ad-hoc**: *different* implementations selected per type — overloading, or type classes/traits (`+` on ints vs strings, `toString`, `Ord`). This topic owns parametric; ad-hoc is the type-classes topic.

```kotlin
fun <T> firstOrNull(xs: List<T>): T? = if (xs.isEmpty()) null else xs[0]  // parametric: identical for every T
```

```haskell
length :: [a] -> Int        -- parametric: cannot depend on what 'a' is
compare :: Ord a => a -> a -> Ordering   -- ad-hoc: the Ord constraint supplies per-type behaviour
```

The tell: a **type constraint** (`Ord a =>`, `T : Comparable<T>`, `where T: Ord`) means you've crossed from purely parametric into ad-hoc — you're now allowed to *use* type-specific operations. Unconstrained `<T>` is pure parametricity, and (see Q7) that constraint-freedom is exactly what makes it so predictable.

### Q3. Show me a generic function plus inference across languages.

The same idea — a reusable `map`-like transform — with the compiler filling in the types:

```typescript
function map<T, U>(xs: T[], f: (x: T) => U): U[] { return xs.map(f); }
const lens = map([ "a", "bb" ], s => s.length);  // TS infers T=string, U=number, lens: number[]
```

```rust
fn map<T, U>(xs: Vec<T>, f: impl Fn(T) -> U) -> Vec<U> { xs.into_iter().map(f).collect() }
let lens = map(vec![1, 2, 3], |x| x * 2);         // Rust infers T=i32, U=i32; lens: Vec<i32>
```

```kotlin
fun <T, U> List<T>.mapTo(f: (T) -> U): List<U> = map(f)
val lens = listOf("a", "bb").mapTo { it.length }  // Kotlin infers T=String, U=Int; lens: List<Int>
```

```java
static <T, U> List<U> map(List<T> xs, Function<T, U> f) {
    return xs.stream().map(f).collect(Collectors.toList());
}
var lens = map(List.of("a", "bb"), String::length);  // Java infers T=String, U=Integer
```

Note nobody wrote `map<String, Integer>` at the call site — inference recovered both parameters from the argument and the lambda. That's the ergonomic half of static typing.

### Q4. Hindley-Milner vs local type inference — what's the real difference?

**Hindley-Milner (HM)**, in ML/Haskell/OCaml, infers the **most general type of an entire program** with *no* annotations — it solves a global system of type constraints via unification. You can write a whole module and the compiler reconstructs every signature, generalising type variables automatically (let-polymorphism).

```haskell
twice f x = f (f x)   -- no annotation; HM infers  twice :: (a -> a) -> a -> a
```

**Local inference** (Java `var`, Kotlin, Rust, TS, Scala) is deliberately weaker: it infers *within* an expression or statement but **requires annotations at boundaries** — notably function parameters and (often) return types.

```rust
fn twice(f: impl Fn(i32) -> i32, x: i32) -> i32 { f(f(x)) }  // params MUST be annotated
let y = twice(|n| n + 1, 10);   // locals inferred: y: i32
```

Why the retreat from full HM? Three reasons: (1) HM doesn't play nicely with subtyping and overloading, which the mainstream OO languages have; (2) full inference makes error messages point far from the actual mistake; (3) explicit signatures at API boundaries are *good documentation*. So the pragmatic languages keep inference local — inside a function you annotate almost nothing, but the public shape of each function is spelled out. Kotlin even forbids inferring the return type of a public API function without opting in, precisely so signatures stay readable.

### Q5. "Make illegal states unrepresentable" — what does that mean concretely?

It means designing your types so a bad value *cannot be constructed*, moving validation from runtime `if`s into the type system. The classic smell is a struct where field combinations encode invariants informally:

```typescript
// ✗ illegal states ARE representable: loading && error, or data with error set
type Fetch = { loading: boolean; data?: User; error?: string };
```

```typescript
// ✓ illegal states unrepresentable — exactly one variant, checked exhaustively
type Fetch =
  | { status: "loading" }
  | { status: "ok"; data: User }
  | { status: "err"; message: string };
```

Now `loading && error` can't exist, and a `switch` on `status` forces you to handle every case. Other everyday instances of the principle:

- Non-empty list as its own type so `head` needs no null check.
- `NonNegativeInt` / `Email` newtypes so a validated value is a *different type* from a raw one — you literally can't pass an unvalidated string where a validated one is required.
- `Optional`/`Result` instead of nullable/exception, so "might be absent/failed" is in the signature.

This is the single most FP-flavoured design move that translates directly to Kotlin (`sealed`), Rust (`enum`), and TS (discriminated unions). It's the type acting as a *proof* that only valid states exist.

### Q6. How is a type documentation — and even a proof?

A signature is documentation the compiler *enforces and never lets go stale*. `parseUser(raw: String): Result<User, ParseError>` tells a reader: this can fail, failure is a `ParseError` (not an exception you might forget), success gives a `User`. No comment can guarantee that; this signature does.

At the strong end, types become **proofs**: a function of type `a -> a` (Q7) is *provably* the identity on total inputs. Richer type systems push this further — a length-indexed vector type can make `zip` on mismatched lengths a compile error; Rust's borrow types *prove* no data race. Even in mainstream code you get lightweight proofs daily: a `NonNull<T>`, a `sealed` hierarchy that makes a `when`/`switch` provably exhaustive, a `val` that proves immutability. The mental shift: stop writing comments and runtime asserts that say "this is never null / always positive / already validated" and instead choose a *type* that makes the statement true by construction.

### Q7. What is parametricity, and what are "theorems for free"?

**Parametricity**: a function that is polymorphic in `T` with *no constraints* on `T` cannot inspect or fabricate a `T`, so its behaviour is radically constrained by its type alone — and you can derive properties ("theorems") purely from the signature, for free.

- `fun <T> f(x: T): T` — on total, pure inputs the *only* thing it can return is `x`. It's the identity. It can't invent a `T` (doesn't know what `T` is) and has nothing else of type `T` to return.
- `fun <T> f(xs: List<T>): List<T>` — can only reorder/drop/duplicate elements; it can't *conjure* new ones. So `map g (f xs) == f (map g xs)` for any `g` — the free theorem: `f` commutes with `map` because it can't depend on the values, only their positions.

Why it matters practically: unconstrained generic code is the *most* reusable and *most* predictable code you can write, because the compiler's freedom is your certainty. When you see `<T>` with no bounds, you already know the function is "structural" — it shuffles data without understanding it. Caveats: parametricity holds cleanly in a pure total language; escape hatches (reflection, `instanceof`/downcasts, `null`, side effects, exceptions) weaken it. That's a concrete reason FP frowns on runtime type inspection — it breaks the free theorems.

### Q8. Explain variance with a real gotcha.

**Variance** answers: if `Cat <: Animal`, how do `Box<Cat>` and `Box<Animal>` relate?

- **Covariant** (`out`): `Box<Cat> <: Box<Animal>`. Safe when the box only *produces* `T` (read-only).
- **Contravariant** (`in`): `Box<Animal> <: Box<Cat>`. Safe when the box only *consumes* `T` (write-only).
- **Invariant**: no relationship. Required when `T` is both read and written (a mutable collection).

The canonical gotcha is **Java's covariant arrays**, which the language allows but which is *unsound*:

```java
Object[] arr = new String[3];   // allowed: arrays are covariant
arr[0] = 42;                     // compiles fine...
                                 // ...throws ArrayStoreException at RUNTIME
```

The type checker let a hole through and the JVM has to patch it with a runtime check. Generics fixed this by being **invariant** by default — `List<String>` is *not* a `List<Object>`, so the analogous mistake won't compile. You then opt into variance explicitly:

```kotlin
interface Source<out T> { fun next(): T }          // covariant: only produces T
interface Sink<in T>   { fun accept(x: T) }         // contravariant: only consumes T
val animals: Source<Animal> = object : Source<Cat> { override fun next() = Cat() }  // OK
```

```java
List<? extends Animal> producers = new ArrayList<Cat>();  // read Animals out (covariant use)
List<? super Cat> consumers = new ArrayList<Animal>();     // write Cats in (contravariant use)
```

The mnemonic is **PECS — Producer `extends`, Consumer `super`**. Kotlin/Scala put the annotation on the *declaration* (`out`/`in`); Java puts it at the *use site* (wildcards). Both encode the same rule: covariance for readers, contravariance for writers, invariance when you do both.

### Q9. Bounded/constrained generics — why and how?

An unbounded `<T>` can't *do* anything to its values (that's parametricity). To call methods on `T` you constrain it — which is the bridge into ad-hoc polymorphism:

```kotlin
fun <T : Comparable<T>> maxOf(a: T, b: T): T = if (a >= b) a else b  // T must be orderable
```

```rust
fn max_of<T: PartialOrd>(a: T, b: T) -> T { if a >= b { a } else { b } }  // trait bound
```

```java
static <T extends Comparable<T>> T maxOf(T a, T b) { return a.compareTo(b) >= 0 ? a : b; }
```

```haskell
maxOf :: Ord a => a -> a -> a
maxOf a b = if a >= b then a else b     -- 'Ord a =>' is the constraint
```

Bounds trade some genericity for capability: `maxOf` no longer works for *every* type, only orderable ones, but in exchange it can compare. Multiple bounds compose (`<T : Comparable<T> & Serializable>` in Java, `T: Ord + Clone` in Rust, `(Ord a, Show a) =>` in Haskell). This is also where "generic" quietly becomes "type class / trait" — the constraint is a dictionary of operations the type must provide.

### Q10. Newtype and phantom types — cheap extra safety.

A **newtype** is a zero-cost wrapper that gives an existing representation a *distinct* type, so the compiler stops you mixing things that happen to share a runtime shape:

```rust
struct Meters(f64);
struct Seconds(f64);
fn speed(d: Meters, t: Seconds) -> f64 { d.0 / t.0 }
// speed(Seconds(5.0), Meters(2.0)) — WON'T COMPILE. Two f64s, but not interchangeable.
```

```haskell
newtype UserId = UserId Int   -- distinct from OrderId, no runtime cost; can't pass one for the other
```

The payoff: `userId`/`orderId` mix-ups, unvalidated-vs-validated strings, and unit errors become type errors. In Kotlin, `value class UserId(val raw: String)` is the inline, zero-overhead equivalent; in TS, a branded type (`type UserId = string & { __brand: "UserId" }`) approximates it.

A **phantom type** takes this further with a type parameter that has *no runtime value*, used purely to track state at compile time:

```rust
struct Connection<State> { sock: TcpStream, _state: PhantomData<State> }
struct Open; struct Closed;
impl Connection<Open> { fn send(&self, msg: &str) { /* ... */ } }  // send only exists when Open
// A Connection<Closed> literally has no send method — misuse is a compile error, not a runtime panic.
```

The `State` parameter carries no data; it exists so the type system can enforce a state machine. Same family of trick as newtypes: spend a little type machinery, delete a class of runtime bug.

### Q11. Does static typing mean lots of annotations? And does `var`/`auto` weaken typing?

No on both counts, and they're the same misconception. **HM languages annotate essentially nothing** yet are more strictly typed than Java. **`var`/`auto`/`val` don't change the type at all** — they omit the *written* type while the compiler fully infers it:

```java
var names = new ArrayList<String>();   // names is EXACTLY ArrayList<String>, fully static
names.add(42);                         // compile error — still strongly, statically typed
```

```cpp
auto x = 3;        // x is int, decided at compile time
```

Contrast a genuinely dynamic binding, where the type travels with the value at runtime:

```python
x = 3        # x holds an int now
x = "three"  # ...and rebinds to a str later; type is a property of the value, not the name
```

So the axis that matters is *when and how strongly types are checked*, not *whether you typed the type name*. Local inference is purely ergonomic sugar over a fully static system. The one honest caveat: over-using `var` can hurt *readability* (a human can't see the type either), which is why style guides say keep it for obvious right-hand sides.

### Q12. The interview one-liner: types, generics, and inference in one crisp paragraph.

A **type is a machine-checked proof about your program**; the functional tradition leans on **strong static types** to turn whole bug classes — null, "unhandled case", "used before validated" — into things the compiler refuses to build. **Parametric polymorphism** (generics) keeps that discipline DRY by writing one implementation for all types, and its very type-blindness (**parametricity**) is what makes generic code so predictable you get "theorems for free". **Type inference** keeps it ergonomic — full **Hindley-Milner** reconstructs entire programs with no annotations, while the pragmatic mainstream (`var`, Kotlin, Rust, TS, Scala) uses **local inference** that annotates only API boundaries for the sake of readable, well-documented signatures. The senior moves are to **make illegal states unrepresentable** (sealed unions, `Result`, newtypes) so validity is structural rather than defensive, and to get **variance** right — covariance (`out`) for producers, contravariance (`in`) for consumers, invariance when you do both, PECS in Java — remembering that Java's covariant arrays are the cautionary tale of getting it wrong.


## Type Classes & Ad-hoc Polymorphism

### Summary

**What this topic covers**

This topic is about *ad-hoc polymorphism* — code that works over many types but does something *different* for each type — and the mechanism functional languages use to make it principled: the **type class**. A type class defines a set of operations (an interface) that a type can implement, and the compiler resolves *which* implementation to call at compile time based on the static types involved. Haskell's `Eq`, `Ord`, `Show` and `Num` are the canonical examples. The reason this matters to a working engineer is that the same idea shows up everywhere in mainstream languages under different names — Rust **traits**, Scala `given`/`using` (formerly implicits), Swift **protocols**, Kotlin interfaces plus extension functions, and, more weakly, Java **interfaces**. Understanding type classes lets you see what these features share and, more importantly, the one capability that sets the strong versions apart from a plain OOP interface: you can add an interface to a type you did not define. That single property is the seed of the *expression problem*.

**Mental model**

Think of a type class as a **contract carried separately from the data**. In OOP, `class Dog implements Comparable` welds the `compareTo` behavior into the class body — you must own the class to add the interface. A type class inverts this: `Ord` is declared independently, and somewhere else you write "here is how `Dog` satisfies `Ord`." The compiler collects these implementations (call them *instances* in Haskell, *impls* in Rust, *givens* in Scala) into a dictionary and threads the right one to each call site. Two payoffs follow. First, **retroactive extension**: you can make a third-party type sortable or printable without editing its source and without subclassing it. Second, **static dispatch**: because the compiler knows the concrete type, it can inline the call — zero runtime cost, unlike a virtual method through a vtable. The price is *coherence rules* (each type may satisfy a class exactly once) so the compiler never has two competing implementations to choose from.

**Key terms**

- **Ad-hoc polymorphism** — one name, many type-specific implementations, chosen by type (`+` on ints vs strings). Contrast with *parametric* polymorphism (generics), where one implementation works uniformly for all types.
- **Type class** — a named set of operations a type can implement; the compiler resolves the implementation from static types.
- **Instance / impl** — the concrete implementation of a type class for a specific type (`instance Ord Dog`, `impl Ord for Dog`).
- **Dictionary passing** — the compilation strategy: a type class constraint becomes a hidden argument carrying the operation table.
- **Coherence / orphan rule** — a type has at most one instance of a class; you may only define an instance if you own the class or the type.
- **Trait** (Rust) — the closest mainstream analogue to a type class; static dispatch by default, dynamic via `dyn`.
- **Given / implicit** (Scala) — a term the compiler supplies automatically to satisfy a `using` parameter.
- **Superclass constraint** — a type class requiring another (`Ord` requires `Eq`); analogous to interface inheritance.
- **Retroactive extension** — adding an interface to an already-defined type without modifying it.

**Why interviewers ask this**

A junior answer describes type classes as "Haskell's version of interfaces" and stops. The senior signal is naming the *difference*: an OOP interface must be declared at the type's definition site, whereas a type class can be implemented for a type you don't own, and resolution is static rather than virtual. Seniors connect this to concrete engineering wins — deriving `Ord`/`Comparable`, passing a `Comparator` as an explicit instance, making a foreign type printable — and to the tradeoff: coherence rules exist to prevent ambiguity, which is exactly why Rust forbids orphan impls. The strongest candidates tie it forward to the expression problem (adding new types vs new operations) and note where mainstream languages fall short of the model.

**Common confusions**

- *"Type class = interface."* Close but incomplete — the retroactive, own-neither-required extension and static resolution are the real distinctions.
- *"It's runtime polymorphism."* By default it's compile-time (monomorphized in Rust, dictionary-passed in Haskell). Dynamic dispatch is opt-in (`dyn Trait`, existential types).
- *"Comparator and Comparable are the same."* `Comparable` welds ordering into the type (one canonical order); `Comparator` is a *separate* instance you pass in — much closer to the type-class spirit.
- *"You can add any instance anywhere."* Coherence/orphan rules restrict this; Scala is looser (and can suffer ambiguous givens), Rust is strict.

**What follows from this topic**

Type classes are the cleanest lens on the **expression problem** (topic 20): they make adding new *operations* easy while OOP subclassing makes adding new *types* easy. They also underpin the abstractions in the ADTs and Monad topics — `Functor`, `Monad`, `Semigroup` are all type classes, and "`Option`/`Result` are monads" means they have a `Monad` instance. Keep this in mind when we discuss `map`/`flatMap` being the same interface across `List`, `Option`, and `Future`.

### Q1. What is ad-hoc polymorphism, and how does it differ from parametric polymorphism?

**Parametric** polymorphism is one implementation that works for *all* types uniformly, because it never inspects the values — `fun <T> head(xs: List<T>): T` behaves identically whether `T` is `Int` or `String`. **Ad-hoc** polymorphism is one *name* backed by *many* type-specific implementations, selected by type: `1 + 2` and `"a" + "b"` share the `+` symbol but run different code.

The distinction matters because they compose differently. A generic sort is parametric in the element type but *ad-hoc* in the comparison: `sort<T: Ord>(xs)` works for any `T`, provided `T` supplies an ordering. Type classes are the machinery that expresses "for any `T` that is `Ord`" — a constrained parametric function whose constraint is satisfied ad-hoc.

```haskell
-- parametric: identical behavior for every a
identity :: a -> a
identity x = x

-- ad-hoc via a constraint: works for any a that has an Ord instance
maximum' :: Ord a => [a] -> a
maximum' = foldr1 (\x y -> if x >= y then x else y)
```

### Q2. Define a type class and give the Haskell `Show`/`Ord` shape.

A type class declares operation signatures; an *instance* supplies them for a concrete type. Here is a minimal `Show` (render to text) and a use of the built-in `Ord`:

```haskell
class Show' a where
  show' :: a -> String

data Color = Red | Green | Blue

instance Show' Color where
  show' Red   = "Red"
  show' Green = "Green"
  show' Blue  = "Blue"

-- Ord requires Eq (superclass constraint); compare returns LT/EQ/GT
brightest :: Ord a => [a] -> a
brightest = maximum
```

The call `show' Red` is resolved at compile time to the `Color` instance. Note `Ord` *requires* `Eq` — a superclass constraint, the type-class version of interface inheritance.

### Q3. Show the same idea as a Rust trait — this is the cleanest mainstream analogue.

Rust traits are type classes with different spelling. `Display` is Rust's `Show`; `Ord` is its own name. Dispatch is static by default (monomorphized, zero-cost); `dyn Trait` opts into a vtable.

```rust
use std::fmt;

enum Color { Red, Green, Blue }

impl fmt::Display for Color {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        let s = match self { Color::Red => "Red", Color::Green => "Green", Color::Blue => "Blue" };
        write!(f, "{}", s)
    }
}

fn label<T: fmt::Display>(x: T) -> String { format!("<{}>", x) }  // static dispatch
```

`T: fmt::Display` is exactly Haskell's `Show a =>`. The compiler generates a specialized `label` per concrete `T` and can inline the `fmt` call.

### Q4. What is the ONE thing a type class gives you that a plain OOP interface does not?

**You can implement it for a type you did not define — retroactively, without subclassing.** In Java, to make `LocalDate` `Comparable` a certain way you cannot; the class is fixed and already ships one `compareTo`. With a type class you declare the implementation *externally*.

```rust
// std's Duration isn't ours, but we CAN implement our own trait for it
trait Humanize { fn humanize(&self) -> String; }

impl Humanize for std::time::Duration {
    fn humanize(&self) -> String { format!("{}s", self.as_secs()) }
}
```

An OOP interface must be declared at the type's definition site (`class Foo implements Bar`). A type class decouples the contract from the data, so the implementation can live anywhere the coherence rules allow. That decoupling is the whole game.

### Q5. If they decouple so freely, what stops two conflicting implementations? Explain coherence / orphan rules.

If two libraries both defined "how `Int` is `Ord`" differently, a call site couldn't know which to use — and a `HashSet<Int>` built with one ordering would corrupt under the other. So languages enforce **coherence**: at most one instance of a class per type, globally. Rust operationalizes this with the **orphan rule** — you may write `impl Trait for Type` only if you own the trait *or* you own the type. You cannot implement someone else's trait for someone else's type.

```rust
// Allowed: we own Humanize (our trait), Duration is foreign  -> OK
// Allowed: implement foreign Display for our own Color        -> OK
// Forbidden: impl std::fmt::Display for std::time::Duration   -> orphan, rejected
```

The workaround is the **newtype**: wrap the foreign type in a struct you own (`struct MyDur(Duration)`) and implement the foreign trait on the wrapper. Haskell has the same coherence guarantee (relies on a global instance uniqueness assumption); Scala is *looser* — givens are scoped by imports, which is more flexible but can produce ambiguous-implicit errors.

### Q6. How do Scala givens/implicits express a type class, and how does `Ordering` compare to Java's `Comparator`?

Scala encodes a type class as a trait plus a `given` instance, injected through a `using` parameter. This is *the* idiomatic Scala pattern and maps 1:1 to Haskell.

```scala
trait Show[A]:
  def show(a: A): String

given Show[Boolean] with
  def show(a: Boolean): String = if a then "yes" else "no"

def render[A](a: A)(using s: Show[A]): String = s.show(a)   // Show[A] => in Haskell
render(true)  // compiler finds the given, prints "yes"
```

Scala's `Ordering[A]` is literally a type class instance passed implicitly; Java's `Comparator<T>` is the *same concept* but passed **explicitly**. That's the tell: `Comparator` is closer to a type class than `Comparable` is, because it separates the ordering *from* the type. `Comparable` welds one canonical order into the class (like a default instance); `Comparator` lets you supply the "instance" per call — `list.sort(comparingInt(Item::price))`.

### Q7. Where do Java interfaces fall short of being real type classes?

Java interfaces give you ad-hoc polymorphism but miss two properties:

1. **No retroactive implementation.** `String` is `final` and already fixed; you cannot make it implement a *new* interface `Json` after the fact. Type classes / Rust traits / Scala givens can. Java's escape hatch is the adapter/wrapper or a `Function`/`Comparator` passed explicitly.
2. **Dispatch is virtual, not static.** Interface calls go through a vtable; there's no monomorphization, so no compile-time specialization or guaranteed inlining the way Rust gives you.

Java also can't express "return a value of the abstract type" cleanly (no `Numeric`-style class where `zero` has no argument to dispatch on — Java has nothing to dispatch a static factory on). So `Comparable`/`Comparator`/`Iterable` cover the *consumer* side well but the *producer* side (create an `A` from nothing, like Haskell's `mempty` or `Num`'s `fromInteger`) is awkward. Kotlin narrows the gap with **extension functions** (add methods to foreign types) but extensions are statically dispatched syntactic sugar, not true instances the compiler threads through generic constraints.

### Q8. Show a type class whose method has no value to dispatch on — why is that hard for interfaces?

`Num`/`Numeric` includes `fromInteger`/`zero` — an operation that *produces* an `A` with no `A` argument. Interfaces dispatch on the receiver (`this`), so an operation with no receiver of type `A` can't be a normal method.

```haskell
class Monoid' a where
  mempty' :: a            -- no argument of type a to dispatch on!
  mappend' :: a -> a -> a

instance Monoid' [b] where
  mempty'  = []
  mappend' = (++)
```

Haskell resolves `mempty'` from the *return type* / usage context. Rust does it with an associated function: `trait Default { fn default() -> Self; }` — `Self` in return position, resolved by the expected type (`let x: i32 = Default::default();`). Java/Kotlin interfaces cannot do this cleanly because there's no instance to call the method on; you fall back to a static factory that you must name explicitly, losing the automatic resolution.

### Q9. Refactor: turn an OOP `Comparable` hierarchy into a type-class style ordering.

Imperative/OOP: each class hard-codes one order.

```java
// welds a single ordering into the type
record Money(long cents) implements Comparable<Money> {
    public int compareTo(Money o) { return Long.compare(cents, o.cents); }
}
```

Type-class style (Scala): the ordering is a *separate* instance you can swap.

```scala
case class Money(cents: Long)

given byAmount: Ordering[Money] = Ordering.by(_.cents)
val byAmountDesc: Ordering[Money] = byAmount.reverse   // a different instance, no edit to Money

List(Money(3), Money(1)).sorted            // uses the given
List(Money(3), Money(1)).sorted(byAmountDesc)  // pass a different one explicitly
```

The win: multiple orderings coexist without touching `Money`, and functions constrained on `Ordering[Money]` compose. The same refactor in Rust would keep `Ord` for the one canonical order and use a key function (`sort_by_key`) for alternates.

### Q10. How do type classes tee up the expression problem?

The expression problem asks: can you add both new **types** and new **operations** to a system without modifying existing code and without losing type safety? OOP subclassing makes adding a new *type* easy (new subclass implements all methods) but adding a new *operation* means editing every class. Type classes flip it: adding a new *operation* is a new type class + instances (edit nothing existing), while adding a new *type* means writing instances for every existing class.

```rust
// new operation over existing types: define a trait + impls, touch no existing type
trait ToJson { fn to_json(&self) -> String; }
impl ToJson for i32    { fn to_json(&self) -> String { self.to_string() } }
impl ToJson for bool   { fn to_json(&self) -> String { self.to_string() } }
```

Because traits can be implemented retroactively, they add *operations* without editing the types — the axis OOP finds hard. Neither approach wins outright; the point (topic 20) is that the two paradigms are strong on *opposite* axes, and type classes are the FP side of that tradeoff.

### Q11. The interview one-liner.

A type class is an interface defined *separately* from the data, whose implementation for a given type can be supplied retroactively (even for types you don't own) and is resolved by the compiler from static types rather than a runtime vtable — Rust `trait`, Scala `given`, Swift `protocol`, and Haskell's `Eq`/`Ord`/`Show` are all this idea, and the one power it has over a plain OOP interface — attaching behavior to a type you didn't define — is exactly what makes it the clean answer to the expression problem.


## Functors & Applicatives

### Summary

**What this topic covers**

The rung of the ladder between "I use `map` every day" and "I understand monads." A **functor** is nothing exotic: it is any container or context that has a lawful `map` — a way to apply a function to the value(s) inside without disturbing the container itself. `Optional`, `List`/array, `Result`/`Either`, `Promise`/`Future`, `Stream`, even a plain function are all functors. You already program with functors constantly; this topic names the pattern, states the two laws that make `map` trustworthy, and then adds one capability on top: the **applicative**, which lets you combine *several independent* wrapped values — apply a multi-argument function to `Option` + `Option` + `Option`, or validate five fields and accumulate **all** the errors instead of stopping at the first. We cover `map`, `ap`, `map2`/`zip`, and `sequence`/`traverse` with cross-language code, and set up monads (the next rung) by showing exactly where applicatives stop.

**Mental model**

Picture your value sitting inside a box — `Option[T]`, `List[T]`, `Result[T,E]`. A **functor** gives you one move: reach in, transform the contents with `a => b`, hand back a box of the same shape (`map`). You never open the box yourself; `map` handles the "is it empty / how many / did it fail" bookkeeping. That is the whole idea — a *uniform interface for transforming values in a context*. An **applicative** adds a second move: given a box holding a **function** and a box holding an **argument**, combine them (`ap`). That unlocks applying an n-ary function to n independently-boxed values — `map2(oa, ob)(f)`, `zip`, or turning a `List[Option[A]]` into an `Option[List[A]]` (`sequence`). The practical payoff: applicatives combine **independent** effects, so they can gather all failures at once (form validation), while monads chain **dependent** effects and short-circuit on the first failure. Same box, two different "combine" powers.

**Key terms**

- **Functor** — a type with a lawful `map`/`fmap`: `F[A]` + `(A => B)` → `F[B]`, structure preserved.
- **`map` / `fmap` / `select`** — the functor operation; transforms contents, keeps the container.
- **Functor laws** — *identity* (`map(id) == id`) and *composition* (`map(f).map(g) == map(g ∘ f)`).
- **Structure-preserving** — `map` never changes the container's shape: no adding/dropping elements, no turning `Some` into `None`.
- **Applicative functor** — a functor that also supports `pure`/`of` (lift a plain value) and `ap` (apply a wrapped function to a wrapped value).
- **`ap` / `<*>`** — `F[A => B]` + `F[A]` → `F[B]`; the defining applicative op.
- **`map2` / `zipWith` / `liftA2`** — combine two wrapped values with a binary function; derived from `ap`.
- **`pure` / `of` / `return`** — lift a bare value into the minimal context (`Some(x)`, `[x]`, `Ok(x)`).
- **`sequence`** — flip the nesting: `List[F[A]]` → `F[List[A]]`.
- **`traverse`** — `map` then `sequence` in one pass: `List[A]` + `(A => F[B])` → `F[List[B]]`.
- **Validation / accumulating applicative** — an `Either`-shaped type whose applicative gathers **all** errors instead of short-circuiting (Scala Cats `Validated`, Arrow `ValidatedNel`).

**Why interviewers ask this**

It is the cleanest way to tell whether "functional" means buzzwords or understanding. A junior says "a functor is a thing with `map`" and stops. A senior can (a) point at `Optional.map`, `Stream.map`, `Promise.then`, `Result::map` and say "these are the *same* abstraction, that's why they feel the same," (b) state why the laws matter — they are what let you refactor `map(f).map(g)` into one pass without fear — and (c) explain the applicative-vs-monad distinction operationally: *independent effects combine and accumulate; dependent effects chain and short-circuit.* The killer follow-up is "you have five form fields to validate and want every error, not just the first — how?" The monadic answer (`flatMap`/for-comprehension) stops at the first failure by construction; the applicative answer accumulates. Knowing which tool the problem wants is exactly the senior signal.

**Common confusions**

- **"Functor is a Haskell thing."** → No — `map` on any collection/`Optional`/`Result` is a functor. You've used them for years.
- **"`map` can change the container."** → It must not. `list.map` keeps the length; `Option.map` keeps `None` as `None`. Changing shape (filtering, flattening) is a *different* operation.
- **"Applicative and monad are the same."** → Every monad is an applicative, but applicative combines independent values (can accumulate errors); monad sequences dependent steps (short-circuits). Use the weaker one when you can.
- **"`Promise.then` is `map`."** → `then` is overloaded — it's `map` when the callback returns a plain value, `flatMap` when it returns another Promise. That auto-flattening is why Promises feel monadic.
- **"`ap` and `flatMap` are interchangeable."** → With `ap`, the second computation can't depend on the first's *result*; with `flatMap` it can. That dependency is the whole difference.

**What follows from this topic**

This is the direct on-ramp to **Monads**: a monad is an applicative plus `flatMap`/`bind`, which lets the next step depend on the previous value and is what makes `Optional`/`Result`/`Promise` chaining flatten instead of nest. The functor laws here rhyme with the monad laws there. It also connects back to **Higher-Order Functions** (`map` takes a function), **Algebraic Data Types** (`Option`/`Result`/`Either` are the boxes we're mapping over), and **Type Classes** (functor/applicative/monad are the canonical type-class hierarchy). `traverse`/`sequence` reappear whenever you fold a collection of effects into one effect.

### Q1. What is a functor, in terms a working engineer already knows?

A **functor** is any type `F[_]` that supports a lawful `map`: given `F[A]` and a function `A => B`, it produces `F[B]` **without changing the container's structure**. That's it. The reason it feels abstract is only that the name is unfamiliar — the operation is one you use hourly.

```kotlin
listOf(1, 2, 3).map { it * 2 }          // List is a functor      -> [2, 4, 6]
"x".let { it }                           // (not the point)
val name: String? = user?.name?.uppercase()  // nullable = Optional functor
```

```typescript
[1, 2, 3].map(x => x * 2);               // Array functor
const upper = maybeName?.toUpperCase();  // optional chaining ~ Option.map
Promise.resolve(2).then(x => x + 1);     // Promise: then-as-map
```

```rust
Some(2).map(|x| x + 1);                  // Option is a functor -> Some(3)
Ok::<_, String>(2).map(|x| x + 1);       // Result maps the Ok side
vec![1, 2, 3].iter().map(|x| x * 2);     // iterator adapter
```

The container decides what `map` *means* per shape: for `List` it applies to every element; for `Option` it applies only if present (`None.map(f) == None`); for `Result` it applies only to the success side. You write the same `A => B` and the functor handles the "how many / is it there / did it fail" bookkeeping. That uniformity — one interface, many containers — is the entire value proposition.

### Q2. State the functor laws and explain why anyone should care.

Two laws:

1. **Identity:** `map(id) == id` — mapping the identity function changes nothing.
2. **Composition:** `map(f).map(g) == map(x => g(f(x)))` — mapping `f` then `g` equals mapping their composition in a single pass.

```typescript
xs.map(x => x).toString() === xs.toString();          // identity
xs.map(f).map(g);                                      // ==
xs.map(x => g(f(x)));                                  // composition
```

Why care in practice: the laws are the *permission slip for refactoring*. The composition law is literally the justification for fusing two passes into one — `list.map(parse).map(validate)` → `list.map(x => validate(parse(x)))` — which a compiler or a stream engine can do safely precisely because the law guarantees the result is unchanged. The identity law rules out a "map" that secretly reorders, drops, or duplicates elements. A `map` that violates these isn't a functor; it's a footgun wearing a familiar name. You'll never write a law-checking test at work, but the laws are why `map` is *trustworthy* — why you can reason about a mapped pipeline without tracing every step.

### Q3. What does an applicative add over a functor?

A functor can apply a **one-argument** function to **one** wrapped value. An **applicative** can apply an **n-argument** function to **n independently-wrapped** values. The primitive is `ap` — apply a wrapped function to a wrapped argument — plus `pure` to lift a plain value in.

```
functor:      F[A]                + (A => B)        -> F[B]      // map
applicative:  F[A => B]           + F[A]            -> F[B]      // ap
              F[A], F[B]          + ((A,B) => C)    -> F[C]      // map2 (from ap)
```

Concretely: you have three independent `Option`s and a 3-arg constructor. `map` alone can't do it — after `oa.map(mkUser)` you're stuck holding an `Option[B => C => User]` with no way to feed it the other options. `ap` is exactly the "feed the next wrapped arg" move.

```kotlin
// pseudo-Arrow style: combine three independent Options
val user: Option<User> = Option.map(firstName, lastName, age) { f, l, a -> User(f, l, a) }
// If ANY is None, result is None; all must be present.
```

```typescript
// map2 for optionals, hand-rolled
const map2 = <A, B, C>(a: A | null, b: B | null, f: (a: A, b: B) => C): C | null =>
  a !== null && b !== null ? f(a, b) : null;
map2(width, height, (w, h) => w * h);      // area, only if both present
```

The key restriction: the wrapped values are **independent** — `F[B]` cannot depend on the *runtime result* inside `F[A]`. When it can, you need a monad (`flatMap`). That independence is not a weakness; it's what makes accumulation possible (Q4).

### Q4. Show the classic applicative win: validating multiple fields and collecting ALL errors.

Monadic validation short-circuits — the first failure aborts and you never see the rest. Applicative validation over an error-accumulating type reports **every** failure in one pass. This is the interview's favourite applicative example because it's a real problem with a wrong-feeling monadic answer.

Monadic (short-circuits — user fixes one error, resubmits, hits the next):

```typescript
function validateMonadic(f: Form): Result<User, string> {
  const name = validateName(f.name);   if (!name.ok) return name;   // stops here
  const email = validateEmail(f.email); if (!email.ok) return email; // never reached
  const age = validateAge(f.age);       if (!age.ok) return age;
  return ok(new User(name.value, email.value, age.value));
}
```

Applicative (accumulates — one round-trip, all errors):

```typescript
type Validated<T> = { ok: true; value: T } | { ok: false; errors: string[] };

function map3<A, B, C, R>(
  a: Validated<A>, b: Validated<B>, c: Validated<C>,
  f: (a: A, b: B, c: C) => R,
): Validated<R> {
  if (a.ok && b.ok && c.ok) return { ok: true, value: f(a.value, b.value, c.value) };
  const errors = [
    ...(a.ok ? [] : a.errors),
    ...(b.ok ? [] : b.errors),
    ...(c.ok ? [] : c.errors),
  ];
  return { ok: false, errors };
}

const result = map3(validateName(f.name), validateEmail(f.email), validateAge(f.age),
  (name, email, age) => new User(name, email, age));
// -> { ok: false, errors: ["name too short", "invalid email"] }  — BOTH reported
```

Scala Cats spells this out with `Validated` and `mapN`; Kotlin's Arrow has `ValidatedNel`/`zipOrAccumulate`. The mechanism is the same everywhere: because the three validations are **independent**, the applicative can run all of them and merge the errors with a semigroup (`++`). A monad *can't* — `flatMap` sequences, so it can't reach the second check once the first failed.

### Q5. `map` vs `ap` vs `flatMap` — one table, and when each is the right reach.

| Operation | Signature | Combines | Behaviour on failure | You need it when |
|-----------|-----------|----------|----------------------|------------------|
| `map` (functor) | `F[A] + (A=>B) => F[B]` | one value | propagates | transforming a single wrapped value |
| `ap`/`map2` (applicative) | `F[A] + F[B] + ((A,B)=>C) => F[C]` | several **independent** values | accumulate or propagate | combining values that don't depend on each other |
| `flatMap` (monad) | `F[A] + (A=>F[B]) => F[B]` | **dependent** steps | short-circuits | the next step needs the previous *result* |

The senior instinct: **reach for the weakest tool that works.** If the computations are independent, use `map`/applicative — it's more parallelizable and can accumulate errors. Only escalate to `flatMap` when step 2 genuinely depends on step 1's unwrapped value (e.g. "fetch user, *then* fetch their orders by id"). Using `flatMap` where `map2` suffices silently throws away the ability to gather all errors and can force needless sequencing.

### Q6. Why is `Optional.map` on Java different from `Optional.flatMap`, and how does that preview monads?

`map` keeps you in one layer; `flatMap` avoids stacking layers when your function *itself* returns an `Optional`.

```java
Optional<String> name = Optional.of("  alice  ");
Optional<String> trimmed = name.map(String::trim);            // String -> String, stays Optional<String>

// But a lookup that might miss returns Optional itself:
Optional<Optional<User>> nested = trimmed.map(this::findUser); // OOPS: Optional<Optional<User>>
Optional<User> flat        = trimmed.flatMap(this::findUser);  // flatMap flattens one layer
```

If your transform returns a plain value, `map`. If it returns *another* box of the same kind, `map` would nest (`F[F[A]]`) and `flatMap` flattens it back to `F[A]`. That flattening is the essence of a **monad** — and it's why a monad is strictly more powerful than an applicative: `flatMap`'s function receives the *unwrapped* value and gets to decide the next context based on it (including "produce `None` / `empty`"), which is exactly the dependency an applicative forbids. Hold that thought — it's the whole of the next topic.

### Q7. Are `Promise`/`Future` and `Stream` really functors? Where do they get slippery?

Yes — anything with a structure-preserving `map` qualifies.

- **`Stream`/`Sequence`/iterators** are functors: `stream.map(f)` transforms each element, count preserved. (`flatMap` on a stream is the monadic op — one element can expand to many, which is *not* structure-preserving, hence a different method.)
- **`Future`/`Task`** are functors: `future.map(f)` transforms the eventual value. In Scala, `Future.map` is genuine `map`; `Future.flatMap` chains dependent async steps.
- **JS `Promise`** is the slippery one. `.then` is *overloaded*: if the callback returns a plain value it behaves like `map`; if it returns another `Promise` it auto-flattens — behaving like `flatMap`. There's no separate `.flatMap`, so Promise smears the functor/monad line. That auto-flattening is convenient but it's why "`.then` is `map`" is only half true.

```typescript
Promise.resolve(2).then(x => x + 1);              // map-like    -> Promise<3>
Promise.resolve(2).then(x => fetchScore(x));      // flatMap-like -> Promise<Score>, auto-flattened
```

Practical takeaway: don't let Promise's convenience blur the concepts. On types with *separate* `map` and `flatMap` (`Optional`, `Result`, Rx `Observable`, Scala `Future`), choosing correctly matters — `map` when the callback returns a value, `flatMap` when it returns another wrapped value, else you nest.

### Q8. What are `sequence` and `traverse`, and when do you actually use them?

They flip nested contexts inside-out. You have a **collection of effects** and you want **one effect of a collection**.

- `sequence`: `List[F[A]]` → `F[List[A]]`
- `traverse`: `List[A]` + `(A => F[B])` → `F[List[B]]` (it's `map` then `sequence`, in one pass)

The everyday version you've hand-written a dozen times:

```typescript
// You have ids, each fetch returns a Promise. You want ONE promise of all results.
const promises: Promise<User>[] = ids.map(fetchUser);   // List[F[A]]
const all: Promise<User[]>     = Promise.all(promises);  // F[List[A]]  <- this IS sequence
```

`Promise.all` is literally `sequence` for Promises. The same shape appears with `Option`/`Result`:

```rust
// Vec of Results -> Result of Vec. collect() does the sequence.
let parsed: Result<Vec<i32>, _> = ["1", "2", "3"].iter().map(|s| s.parse::<i32>()).collect();
// Ok([1,2,3]);   any parse failure -> Err(..)  (short-circuits, because Result is monadic)
```

```kotlin
// Arrow: traverse a list, accumulating validation errors (applicative, not short-circuit)
val users: ValidatedNel<Error, List<User>> = forms.traverse { validate(it) }
```

Note the theme: whether `traverse` short-circuits or accumulates depends on which combining behaviour the effect uses — `Result`'s monadic instance stops at first error; a `Validated` applicative instance gathers all. Same traversal, different collecting semantics. Use `traverse`/`sequence` any time you're tempted to write a manual loop that builds up a list while threading an `Option`/`Result`/`Promise` — it's the named, correct version of that loop.

### Q9. Refactor: imperative "combine three lookups" into applicative style.

Imperative, nested-null-check version — the shape you see in real code:

```typescript
function makeOrder(cartId: string): Order | null {
  const cart = findCart(cartId);
  if (cart === null) return null;
  const user = findUser(cart.userId);
  if (user === null) return null;
  const address = findAddress(user.id);
  if (address === null) return null;
  return new Order(cart, user, address);
}
```

Two things are tangled here: some steps are **dependent** (`user` needs `cart.userId`) and the null-plumbing is manual. The dependent parts genuinely want a *monad* (`flatMap`) — an applicative can't express "userId comes from cart." But wherever inputs are **independent**, applicative combination collapses the ceremony:

```typescript
// If the three were independent lookups keyed off cartId, applicative map3 fits:
const order = map3(findCart(id), findUserByCart(id), findAddressByCart(id),
  (cart, user, address) => new Order(cart, user, address));
// one expression, null handled uniformly, and (with an accumulating type) all misses reported
```

The refactor lesson: **classify each step as dependent or independent.** Dependent chains → `flatMap` (monad, short-circuit). Independent combinations → `map2`/`mapN` (applicative, optionally accumulating). Mixing them thoughtlessly — `flatMap` everywhere — works but discards accumulation and over-sequences independent work.

### Q10. Common confusion: doesn't every applicative come from a monad? Why keep them separate?

Every **monad is an applicative** (you can define `ap` via `flatMap`), but not every useful applicative is a law-abiding monad — and even when it could be, you often *want* the weaker one. Reasons to keep applicatives distinct:

- **Error accumulation.** The `Validated`/`ValidatedNel` applicative gathers all errors; the moment you give it a lawful monad instance, `flatMap` forces short-circuiting and you lose accumulation. So Cats deliberately makes `Validated` an applicative but **not** a monad. The behaviours are incompatible; you pick per use-site (`Either`/`for` to short-circuit, `Validated`/`mapN` to accumulate).
- **Independence enables parallelism.** Applicative effects don't depend on each other, so they can run concurrently; monadic `flatMap` imposes an order. Some effect systems parallelize `mapN`/`traverse` but must sequence `flatMap`.
- **Weaker = more reusable.** "Program to the least powerful abstraction that works" — code written against applicative works for more types and states fewer assumptions.

So the hierarchy `Functor ⊂ Applicative ⊂ Monad` isn't academic hair-splitting; each level trades power for guarantees, and the accumulating validator is the concrete payoff for stopping at the applicative level.

### Q11. The interview one-liner: functors and applicatives in one crisp paragraph.

A **functor** is anything with a lawful `map` — `Option`, `List`, `Result`, `Promise`, `Stream` — that transforms the value(s) inside a container while preserving the container's structure, giving you one uniform interface for "transform in a context"; the two functor laws (identity and composition) are what make a mapped pipeline safe to refactor and fuse. An **applicative** adds `pure` and `ap`, letting you apply a multi-argument function to several **independently**-wrapped values (`map2`/`zip`/`sequence`/`traverse`) — its signature win is combining validations to accumulate **all** errors, where a monad's `flatMap` would short-circuit on the first. The rule of thumb: independent effects → applicative (combine, accumulate, parallelize); dependent effects → monad (chain, short-circuit). A monad is exactly an applicative plus `flatMap`, which is the next topic.


## Monads

### Summary

**What this topic covers**

Monads — the concept with the worst reputation-to-difficulty ratio in programming. The honest one-liner: a monad is a design pattern for sequencing computations in a context. You wrap a value in some context (nullable, fallible, async, list-of-many), and a monad gives you a disciplined way to chain steps where each step also returns a wrapped value — without drowning in nesting or manually unwrapping at every stage. If you've used `Optional.flatMap`, `.then()` on a Promise, Rust's `?` operator, or a Kotlin `for` over `Result`, you have already used monads. This topic names the pattern you already apply, covers the everyday monads (Option, Either/Result, List, Promise, IO), the three monad laws, and do-notation as sugar over `flatMap`.

**Mental model**

A monad is a functor (something you can `map` over) plus two extra powers: a way to **wrap** a plain value into the context (`of` / `return` / `unit` / `Some` / `Ok`), and a way to **chain** (`flatMap` / `bind` / `>>=`) that takes a wrapped value and a function `A -> M<B>`, runs it, and flattens the `M<M<B>>` you'd otherwise get down to `M<B>`. That flattening is the whole point. `map` alone leaves you with `Optional<Optional<User>>` when each step is itself fallible; `flatMap` collapses it to `Optional<User>`. The context decides what "chaining" means: for Option it's "stop at the first null"; for Result it's "stop at the first error"; for List it's "cartesian product"; for Promise it's "wait, then continue". Same shape, different sequencing rule. Once you see `flatMap` as "do the next thing that also lives in this context, and keep the context flat", the mystique evaporates. The abstraction is named after the pattern, not the use case — which is exactly why it's confusing.

**Key terms**

- **functor** — a context you can `map` over: `map: (A -> B) -> M<A> -> M<B>`. Every monad is a functor.
- **flatMap / bind / >>=** — chain: `(M<A>, A -> M<B>) -> M<B>`. The defining operation.
- **of / return / unit / pure** — wrap a plain `A` into `M<A>`. Nothing to do with imperative `return`.
- **flatten / join** — collapse `M<M<A>>` to `M<A>`; `flatMap f = flatten . map f`.
- **short-circuit** — Option/Result stop chaining at the first empty/error and carry it to the end.
- **do-notation / for-comprehension** — syntactic sugar that reads a chain of `flatMap`s as sequential statements.
- **Kleisli composition** — composing two `A -> M<B>` functions; the "associativity" law lives here.
- **effect / context** — the `M`: nullability, failure, nondeterminism, async, IO, state.

**Why interviewers ask this**

Monads separate people who parrot "a monad is a monoid in the category of endofunctors" from people who can say "it's `flatMap` plus a constructor, and here's why `Optional.flatMap` avoids nested optionals." The senior signal is pragmatism: you know Promise chaining, Rust `?`, and Optional chaining are the *same pattern*; you can explain why `flatMap` beats `map` for fallible steps; you know the laws exist and what breaks when they don't hold; and you know when the abstraction earns its keep versus when it's overkill in an imperative codebase. The junior answer either fears the word or over-worships it. Nobody senior needs category theory — they need to reason about sequencing effects.

**Common confusions**

- "Monads are a Haskell thing." → You use them daily in Java, JS, Rust, Kotlin. Haskell just makes them explicit and named.
- "`map` and `flatMap` are interchangeable." → `map` with an `A -> M<B>` gives you `M<M<B>>`; `flatMap` flattens. Wrong one = nested wrappers.
- "`return`/`of` is like an imperative return." → It only *wraps* a value into the context. Unfortunate name collision.
- "A monad is a container." → Some are (Option, List). Promise, IO, State, Reader are not containers — they're deferred/effectful computations with the same interface.
- "You need to understand the laws to use them." → No. The laws are what let *library authors* guarantee chaining behaves; users just call `flatMap`.

**What follows from this topic**

Monads sit on top of **Functors** (map) and generalize the chaining you saw in **Option/Maybe** and **Either/Result**. The next topics — **IO/effects** and **State** — are monads whose context is "a side-effecting computation" and "a threaded state value", showing the pattern beyond containers. **Type classes** explain how a language expresses "these different types all share the monad interface", and do-notation ties back to the imperative-looking sugar in Scala, Haskell, Kotlin's arrow, and Rust's `?`.

### Q1. What actually is a monad, minus the mysticism?

A monad is a type `M<A>` with two operations that satisfy three laws:

- **wrap**: `of: A -> M<A>` (a.k.a. `return`, `unit`, `pure`) — lift a plain value into the context.
- **chain**: `flatMap: (M<A>, A -> M<B>) -> M<B>` (a.k.a. `bind`, `>>=`) — run the next context-producing step and keep the result flat.

That's it. It's a *functor* (has `map`) with the added ability to sequence steps that each return another wrapped value. The one-liner worth memorizing: **a monad is a design pattern for sequencing computations in a context.** The "context" is whatever `M` encodes — maybe-a-value, value-or-error, many-values, a-future-value, an-effect.

Why `flatMap` and not `map`? If each step is fallible, `map` stacks the wrappers:

```
Optional<User> user = findUser(id);              // Optional<User>
// map with a fallible step -> nested:
Optional<Optional<Address>> nested = user.map(u -> findAddress(u));   // ugh
// flatMap flattens:
Optional<Address> addr = user.flatMap(u -> findAddress(u));           // clean
```

`flatMap` = `map` then `flatten`. Flattening is the defining move.

### Q2. Show the SAME chained pipeline across four languages.

The task: get a user, then their primary account, then that account's balance — each step can fail/be-absent. Notice it's structurally identical everywhere.

JavaScript, Promise (async failure = rejection):

```
const balance = findUser(id)
  .then(user => findPrimaryAccount(user))
  .then(account => getBalance(account));
// .then IS flatMap-ish: returning a Promise from the callback auto-flattens
```

Kotlin / Java, `Optional` (absence):

```
Optional<BigDecimal> balance = findUser(id)
    .flatMap(user -> findPrimaryAccount(user))
    .flatMap(account -> getBalance(account));
// any empty step short-circuits to Optional.empty()
```

Rust, `Result` with `?` (typed failure):

```
fn balance(id: u64) -> Result<Decimal, AppError> {
    let user = find_user(id)?;
    let account = find_primary_account(&user)?;
    let bal = get_balance(&account)?;
    Ok(bal)
}
// ? is monadic sugar: on Err it returns early, on Ok it unwraps and continues
```

Haskell, `Maybe` in do-notation:

```
balance :: UserId -> Maybe Money
balance uid = do
  user    <- findUser uid
  account <- findPrimaryAccount user
  getBalance account
```

Four languages, one pattern: chain steps, each returning a wrapped value, short-circuit on the "bad" case, never manually unwrap in the middle.

### Q3. Which everyday monads am I already using?

You use these constantly, usually without the word:

- **Option / Maybe** (`Optional`, `Option`, `T | null`) — chain steps that might have no value; short-circuit on empty. Context: *nullability*.
- **Either / Result** (`Result`, `Either`, Go's `(T, error)` by hand) — chain fallible steps; short-circuit carrying the error. Context: *typed failure*.
- **List / Seq** — `flatMap` produces the cross-product; context: *nondeterminism / many results*. `[1,2].flatMap(x => [x, -x])` = `[1,-1,2,-2]`.
- **Promise / Future / CompletableFuture** — `.then` chains async steps; context: *a value that arrives later*. Async/await is do-notation for this monad.
- **Stream** (Java `Stream`, Kotlin `Sequence`, Rust iterators) — `flatMap` over lazy sequences.
- **IO / Task** — a description of a side effect you can chain and compose before running; context: *effects*.
- **State / Reader / Writer** — thread state, read config, accumulate a log through a chain without passing arguments explicitly.

The insight: these look unrelated in a textbook but share one interface. That shared interface *is* the monad.

### Q4. Promise `.then` "is" `flatMap" — defend that.

`flatMap` has signature `(M<A>, A -> M<B>) -> M<B>`. Promise's `.then` has essentially `(Promise<A>, A -> Promise<B>) -> Promise<B>` — you return a Promise from the callback and it auto-flattens instead of giving you `Promise<Promise<B>>`. That auto-flatten is exactly `flatMap`'s flattening.

```
// If .then were only `map`, this would be Promise<Promise<User>>:
fetchId().then(id => fetchUser(id))   // but you get Promise<User> — flattened
```

Two honest caveats so you don't overclaim:

- `.then` also accepts a *plain* value (not just a Promise) and wraps it — so it's `map` and `flatMap` fused into one overloaded method. A textbook monad keeps them separate.
- Promises are eager (they start running on creation) and cache their result, so they aren't a *lawful* IO monad. But for the purpose of "then sequences effectful steps and flattens", the analogy holds and is the reason `async/await` reads like sequential do-notation.

So: async programming is monadic. `await` is sugar over `flatMap` on the Promise/Future monad.

### Q5. What are the three monad laws, in plain language?

Let `of` = wrap, `>>=` = flatMap. The laws:

- **Left identity**: `of(a) >>= f` ≡ `f(a)`. Wrapping a value then chaining `f` is the same as just calling `f`. *Wrapping adds no behavior of its own.*
- **Right identity**: `m >>= of` ≡ `m`. Chaining with the bare wrap constructor changes nothing. *`of` is a genuine no-op unit.*
- **Associativity**: `(m >>= f) >>= g` ≡ `m >>= (x -> f(x) >>= g)`. How you group a chain of steps doesn't matter — only the order does. *Like `(a+b)+c == a+(b+c)`.*

Why they matter, practically: they guarantee that `flatMap` behaves like *sequencing* and nothing sneaky. Associativity is what lets do-notation and for-comprehensions exist at all — the compiler can desugar `do { a; b; c }` into nested `flatMap`s grouped however it likes, and the meaning is stable. It's also what lets you refactor a chain (extract a helper, reorder groupings) without changing behavior. If a type calls itself a monad but breaks a law, chained code stops being safely refactorable — that's the real cost.

Haskell `do` making the laws concrete:

```
-- left identity: these two are interchangeable
do { x <- return a; f x }   ===   f a
-- right identity
do { x <- m; return x }     ===   m
```

### Q6. What is do-notation / for-comprehension, really?

Pure syntactic sugar over nested `flatMap` (with the final step usually a `map`). It lets a monadic chain *read* like sequential imperative statements while staying purely functional. Every language has its dialect:

- **Haskell** `do`:

```
result = do
  a <- stepA
  b <- stepB a
  return (a + b)
```

- **Scala** `for`:

```
val result = for {
  a <- stepA
  b <- stepB(a)
} yield a + b
```

- **Rust** `?` — a targeted desugar for `Result`/`Option`: `let a = stepA()?;` desugars to "match, return `Err`/`None` early, else bind `a`".
- **Kotlin** — no built-in, but Arrow's `either { }` / `option { }` blocks with `.bind()` do the same.
- **JS** `async/await` — do-notation for the Promise monad; `await` = the `<-` bind arrow.

All of these desugar to the same thing. Scala's `for` is literally rewritten by the compiler to `stepA.flatMap(a => stepB(a).map(b => a + b))`. Understanding this demystifies both: async/await isn't magic, and Haskell's `do` isn't imperative — they're the same trick applied to different monads.

### Q7. Why do people find monads so hard?

Three concrete reasons, none of them "you're not smart enough":

1. **Named after the pattern, not the use.** "Optional chaining" or "async sequencing" describe *what you do*; "monad" describes the *shared structure*. Learning the abstract name before meeting the instances is backwards — like learning "vehicle" before ever seeing a car.
2. **Bad first contact.** Most people meet the word via `IO` in Haskell or a category-theory tweet ("monoid in the category of endofunctors"), which is technically true and pedagogically useless. You should meet it as `Optional.flatMap`.
3. **`return`/`of` is a terrible name.** It means "wrap", not imperative return, and the collision actively misleads.

The fix: you already understand the four or five common monads operationally. "Monad" is just the noun for what they have in common. Learn the instances first, generalize second. The moment "it's `flatMap` plus a way to wrap, and the context defines what chaining means" clicks, there's nothing left to fear.

### Q8. When do I NOT need to care about monads?

Often. Be honest about it:

- **Single non-nested step** — if you have one `Optional` and you're extracting a value, `map` or a plain `if`/`get` is fine. `flatMap` earns its keep only when steps *themselves* return the context.
- **Imperative languages without the sugar** — in Go, chaining `(T, error)` monadically by hand is *more* awkward than the idiomatic `if err != nil { return err }`. The pattern is there conceptually; forcing the machinery isn't worth it.
- **You just need the value, not composition** — don't build a `Reader` monad to pass config when a constructor parameter works.
- **Team unfamiliarity** — an Arrow `either { }` block or a hand-rolled `Validated` type can cost more in reviewer confusion than it saves. Match the codebase.

The useful stance: use the *instances* freely (`Optional.flatMap`, `Result` + `?`, Promise chains) because they're idiomatic and readable. Reach for the *abstraction* ("let me write code generic over any monad") only in languages that support it well (Scala, Haskell) and when you genuinely have multiple monads to abstract over. In mainstream day-to-day code, you consume monads far more than you build them.

### Q9. `map` vs `flatMap` — when does choosing wrong bite me?

Rule of thumb: **if your function returns a plain `B`, use `map`; if it returns a wrapped `M<B>`, use `flatMap`.** Pick wrong and you get nested wrappers or a type error.

```
Optional<String> name = findUser(id).map(User::getName);        // getName -> String, so map
Optional<Address> addr = findUser(id).flatMap(this::findAddr);  // findAddr -> Optional<Address>, so flatMap
Optional<Optional<Address>> oops = findUser(id).map(this::findAddr);  // WRONG: nested
```

Same in Rust — `map` transforms the `Ok` value, `and_then` (Rust's `flatMap`) chains another `Result`:

```
let n: Result<usize, E> = parse(s).map(|x| x.len());        // len -> usize
let r: Result<Config, E> = parse(s).and_then(|x| load(x));  // load -> Result<Config, E>
```

And in JS, `.then` papers over the distinction (it flattens either way), which is convenient but is exactly why people don't realize Promise is a monad — the language hides the `map`/`flatMap` split. When you see `Optional<Optional<T>>`, `List<List<T>>`, or `Promise<Promise<T>>` in a type error, you reached for `map` where you needed `flatMap`.

### Q10. Refactor: nested null checks into a monadic chain.

Imperative, defensively nested — the "pyramid of doom":

```
public String cardCity(Long userId) {
    User user = repo.findUser(userId);
    if (user != null) {
        Account acct = user.getPrimaryAccount();
        if (acct != null) {
            Address addr = acct.getBillingAddress();
            if (addr != null) {
                return addr.getCity();
            }
        }
    }
    return "UNKNOWN";
}
```

Monadic with `Optional` — flat, each step short-circuits:

```
public String cardCity(Long userId) {
    return repo.findUser(userId)
        .flatMap(User::getPrimaryAccount)     // each returns Optional<...>
        .flatMap(Account::getBillingAddress)
        .map(Address::getCity)                // getCity -> String, so map
        .orElse("UNKNOWN");
}
```

The nesting collapsed into a linear pipeline; the `null` propagation became automatic short-circuiting. Same idea in Rust with `?`, where the early-return replaces the pyramid:

```
fn card_city(id: u64) -> Option<String> {
    let user = find_user(id)?;
    let acct = user.primary_account()?;
    let addr = acct.billing_address()?;
    Some(addr.city)
}
```

This refactor — pyramid of null/error checks into a `flatMap` chain — is a classic interview exercise. The payoff is that the *happy path* reads top to bottom and the failure handling is factored out entirely.

### Q11. How does a language say "these types all have the monad interface"?

Two broad approaches, and knowing the difference is a senior signal:

- **Ad-hoc / duck-typed** — Java, Kotlin, JS, Rust give each type its *own* `flatMap`/`and_then`/`then` method. `Optional.flatMap` and `Stream.flatMap` share a name and a shape but there's no common `Monad` interface tying them together. You can't write one function generic over "any monad". Pragmatic, and 95% of the time enough.
- **Type classes / higher-kinded types** — Haskell (`Monad` class), Scala (via `cats`/`Monad[F[_]]`) let you abstract over `F[_]` itself, so you can write `traverse`, `sequence`, or a generic `retry` once and run it on *any* monad. This needs **higher-kinded types** (parameterizing over `M` the container, not just `A` the element) — which Java, Kotlin, Go, and Rust lack.

```
-- Haskell: works for Maybe, Either, List, IO, ... any Monad
sequence :: Monad m => [m a] -> m [a]
```

That's why "monad" feels native in Haskell/Scala and feels like "just a method name" in Java/Rust. The *pattern* is universal; only some languages can *name and abstract over* it. If asked "why can't I write a generic monad interface in Java?", the answer is: no higher-kinded types.

### Q12. The interview one-liner.

A monad is a design pattern for sequencing computations in a context: a functor (something you can `map`) plus a way to wrap a plain value (`of`/`return`) and a way to chain steps that each return a wrapped value (`flatMap`/`bind`), where chaining flattens the nested wrapper so you never manually unwrap mid-pipeline — the context (nullable, fallible, async, many-valued, effectful) defines what "chaining" means, which is why `Optional.flatMap`, Rust's `?`, Promise `.then`, and a Haskell `do`-block are all the same pattern, and why do-notation and async/await are just syntactic sugar over `flatMap`.


## Managing Effects & IO

### Summary

**What this topic covers**

Pure functions are the whole selling point of FP — same input, same output, no observable side effects — but a program that computes nothing about the outside world is useless. It has to read a request, hit a database, write a file, call an API, log, get the clock. Every one of those is a side effect, the exact thing purity forbids. This topic is about how FP squares that circle: not by banning effects, but by *organising* where they live. The dominant, portable answer is the **functional core / imperative shell** — pure decision logic in the middle, effects pushed to the thin edges. We also cover injecting effects for testability, the **IO monad** idea (describe effects as values, run them once at the "end of the world"), a nod to **effect systems / algebraic effects**, and how a well-structured core is testable *without mocks*.

**Mental model**

Think of your program as an onion with one rule: **effects go on the skin, decisions go in the middle, and data flows between them.** The shell reads from the world (`SELECT`, `fetch`, `readFile`), hands plain data to a pure function, gets plain data back (a decision, a value, or a *description* of what to do), and the shell performs it. The core never touches I/O — so it's deterministic, trivially unit-testable, and reusable. The IO monad takes this one step further: instead of the core returning "here's the answer," it returns a *value that represents an effect* (`IO[A]`, `Task`, a `() => Promise`) which stays inert until the shell runs it. Purity is preserved because *building* the description is pure; only *running* it does I/O, and running happens in exactly one place. The practical payoff isn't philosophical — it's that 90% of your logic becomes a function you can test with `assertEquals`, no database, no clock, no network.

**Key terms**

- **side effect** — anything observable beyond the return value: mutation, I/O, throwing, reading the clock/random.
- **functional core, imperative shell** — Gary Bernhardt's name for pure logic wrapped by a thin effectful boundary.
- **dependency injection of effects** — pass the effectful capability (clock, repo, sender) in as a parameter/interface so tests can swap it.
- **IO monad** — a value that *describes* an effect without performing it; composed with `map`/`flatMap`, executed once at the edge.
- **referential transparency** — an expression can be replaced by its value without changing behaviour; `IO` restores this for effects.
- **end of the world** — the single top-level place (`main`, the request handler) where descriptions are actually run.
- **effect system** — a type-level tracking of *which* effects a function may perform (Haskell `IO`, ZIO's `R,E,A`, Koka effects).
- **algebraic effects / handlers** — effects declared as operations, interpreted by a handler chosen at the call site; generalises exceptions/async.
- **thunk / suspension** — wrapping an effect in `() => …` so it's a value, not an immediate execution — the poor man's IO.
- **capability** — an injected interface granting the right to perform some effect (`Clock`, `Emailer`), enabling substitution.

**Why interviewers ask this**

This is the single most practical FP idea for mainstream code, so it separates people who *recite* "pure functions good" from people who can actually structure a system. A junior says "I'd mock the database." A senior says "I'd move the branching logic out of the code that touches the database, test that pure, and keep the DB code so thin there's almost nothing to mock." The senior signal is knowing that testability is a *design* property you get by pushing effects to the edge, not a *tooling* property you buy with a mocking framework. Bonus signal: explaining the IO monad *without* religion — knowing it's just "effect as a deferred value" and being honest that in Kotlin/JS you usually get 80% of the benefit from the core/shell split without importing an effect library.

**Common confusions**

- "Pure means no effects ever" → No — it means the *core* is pure; effects still happen, at the edges, in the shell.
- "The IO monad makes side effects pure" → It makes *constructing the description* pure; the effect still fires when you run it — but now in one controlled place.
- "I need mocks to test I/O code" → If logic is separated from I/O, you test the logic with plain values and the I/O shell needs almost no testing.
- "Injecting an interface = functional core" → DI helps, but if branching still lives next to the effect call you haven't split anything.
- "Effect systems are just async/await" → async tracks *one* effect (latency); effect systems track *which* effects and their errors in the type.

**What follows from this topic**

The core/shell split is the payoff of everything upstream: immutability (plain data flowing between layers), pure functions (the core's defining property), and monads (IO is the monad that makes effects composable — same `flatMap` shape as Option/Either and Result). Testing the pure core links to the broader the Testing primer primer. Concurrency safety of this design — immutable data crossing threads freely — is developed in the Concurrency primer; here we only note it.

### Q1. What is the functional core / imperative shell pattern, and why is it the most practical FP idea for everyday code?

Split the program in two. The **functional core** is pure: it takes plain data in, returns plain data (or a *decision*) out, and performs no I/O. The **imperative shell** is a thin layer that reads from the world, calls the core, and performs whatever the core decided. The value is asymmetric: the core holds all the interesting branching logic and is deterministic and unit-testable with zero infrastructure; the shell is dumb glue with almost no branching, so there's little left to test. You stop writing "test that mocks a repo, a clock, and a mailer to check one `if`" and start writing "test a function." It's practical because it needs no library and no language features — just discipline about *where* effects live. The tension it resolves: pure functions can't do I/O, programs must do I/O, so you don't fight that — you concentrate the I/O in a place small enough to eyeball.

### Q2. Refactor this impure function into a pure core + thin shell. (Kotlin)

Before — logic and I/O tangled together, so you can only test it with a live/mocked DB:

```kotlin
fun applyDiscount(userId: String) {
    val user = db.loadUser(userId)                 // effect
    val newTier = if (user.spend > 1000) "gold"    // logic
                  else if (user.spend > 100) "silver"
                  else "bronze"
    db.updateTier(userId, newTier)                 // effect
    mailer.send(user.email, "You are now $newTier") // effect
}
```

After — the decision is pure and returns *what to do*; the shell performs it:

```kotlin
data class Decision(val tier: String, val notify: String?)

fun decideTier(spend: Int): Decision = when {          // pure core: no I/O, total, testable
    spend > 1000 -> Decision("gold", "You are now gold")
    spend > 100  -> Decision("silver", "You are now silver")
    else         -> Decision("bronze", null)
}

fun applyDiscount(userId: String) {                    // imperative shell: just wiring
    val user = db.loadUser(userId)
    val d = decideTier(user.spend)
    db.updateTier(userId, d.tier)
    d.notify?.let { mailer.send(user.email, it) }
}
```

Now `decideTier(1500)` is a one-line assertion. The shell has no branching worth testing.

### Q3. Show the same refactor in Python and JS/TS — is the idea language-independent?

Yes; it's a design discipline, not a feature. Python:

```python
from dataclasses import dataclass

@dataclass(frozen=True)
class Decision:
    tier: str
    notify: str | None

def decide_tier(spend: int) -> Decision:        # pure core
    if spend > 1000: return Decision("gold", "You are now gold")
    if spend > 100:  return Decision("silver", "You are now silver")
    return Decision("bronze", None)

def apply_discount(user_id: str) -> None:        # shell
    user = db.load_user(user_id)
    d = decide_tier(user.spend)
    db.update_tier(user_id, d.tier)
    if d.notify:
        mailer.send(user.email, d.notify)
```

TypeScript is identical in spirit:

```ts
type Decision = { tier: string; notify: string | null };

const decideTier = (spend: number): Decision =>   // pure core
  spend > 1000 ? { tier: "gold",   notify: "You are now gold" }
  : spend > 100 ? { tier: "silver", notify: "You are now silver" }
  :               { tier: "bronze", notify: null };

async function applyDiscount(userId: string) {    // shell
  const user = await db.loadUser(userId);
  const d = decideTier(user.spend);
  await db.updateTier(userId, d.tier);
  if (d.notify) await mailer.send(user.email, d.notify);
}
```

The core is byte-for-byte the same shape in three languages because it's just "data in, decision out."

### Q4. How does dependency injection of effects relate to the core/shell split — and when is DI enough?

DI passes the effectful capability in as a parameter or interface so a test can substitute it. It's the mechanism that keeps the *shell* itself flexible. But DI alone doesn't give you a functional core — if your `if` lives right next to the injected `repo.load()`, you've made the effect swappable but the logic still isn't pure. Use DI for the shell's dependencies; use the core/shell split so most logic doesn't need them at all.

```kotlin
interface Clock { fun now(): Instant }
interface Emailer { fun send(to: String, body: String) }

// Shell takes capabilities; core (decideTier) took none.
class DiscountService(private val clock: Clock, private val mailer: Emailer, private val db: Db) {
    fun run(userId: String) {
        val user = db.loadUser(userId)
        val d = decideTier(user.spend)          // pure, no capabilities needed
        db.updateTier(userId, d.tier)
        d.notify?.let { mailer.send(user.email, it) }
    }
}
```

Rule of thumb: DI is enough when the effectful thing is genuinely at the boundary (one call, no branching around it). When there's real logic entangled with the effect, extract the logic — don't just inject the effect and mock it.

### Q5. What actually is the IO monad, explained for someone who will never write Haskell?

An `IO[A]` is a **value that represents a not-yet-run computation which, when executed, performs effects and yields an `A`**. Building it is pure — `IO { println("hi") }` prints *nothing*; it's a recipe. You compose recipes with `map` and `flatMap` (same shape as Option/Either and Result), and the whole assembled program is one big `IO` value. Then, at the *end of the world* (`main`), the runtime calls `.unsafeRun()` once and the effects fire in order. Why bother? Because it restores **referential transparency**: `val x = IO(println("a")); x.flatMap { x }` prints "a" twice, exactly as if you'd inlined it — effects become ordinary composable values you can pass around, retry, sequence, and reason about with equational rules. Scala's cats-effect `IO` and ZIO's `Task`/`ZIO` are the mainstream homes.

```scala
val program: IO[Unit] =
  for {
    name <- IO(scala.io.StdIn.readLine())   // description, nothing runs yet
    _    <- IO(println(s"Hello $name"))
  } yield ()

program.unsafeRunSync()   // the ONE place effects actually happen
```

The mainstream-language punchline: a JS `() => Promise<A>` thunk is the same idea in miniature — a deferred, composable effect. You already use a weak IO monad every time you pass a callback instead of calling it.

### Q6. Is a JavaScript Promise a monad / an IO? Be precise about where the analogy breaks.

A `Promise` is *monad-shaped* — `.then` doubles as `map` and `flatMap` (it auto-flattens nested promises) — but it is **not** a lawful IO for two reasons. First, it's **eager**: `new Promise(exec)` runs `exec` immediately, so it's already firing effects before you compose — it's a running computation, not an inert description. A true IO is lazy. Second, `.then` isn't a clean `flatMap` (it collapses `Promise<Promise<T>>`, and it also catches thrown errors), so it violates the monad laws in edge cases. The faithful IO in JS is a **thunk returning a promise**, `type IO<A> = () => Promise<A>`, which *is* lazy and composable:

```ts
type IO<A> = () => Promise<A>;
const log = (m: string): IO<void> => () => { console.log(m); return Promise.resolve(); };
const chain = <A,B>(io: IO<A>, f: (a: A) => IO<B>): IO<B> => () => io().then(a => f(a)());

const program = chain(log("a"), () => log("b"));  // nothing printed yet
program();                                        // NOW it runs — end of the world
```

Naming it in an interview — "Promise is monad-*shaped* but eager, so not a pure IO" — is a strong senior signal.

### Q7. Effect systems and algebraic effects — what problem do they solve beyond the IO monad?

A plain `IO[A]` says "this does *some* I/O" but not *which*, and errors aren't in the type. **Effect systems** push more into the type. ZIO's `ZIO[R, E, A]` reads "given environment `R`, may fail with `E`, or succeed with `A`" — so the *dependencies* and *error channel* are statically tracked and testable by providing a different `R`. Haskell's `IO` is the coarse version; libraries like `mtl`/`Polysemy` refine it. **Algebraic effects** (Koka, OCaml 5 effect handlers, and the pattern behind React's Suspense/generators) go further: code *declares* an operation like `perform Ask` and a **handler**, chosen at the call site, decides how to interpret it — one handler does real I/O, another returns canned values for a test, another logs. It's a generalisation of exceptions (which are a one-shot, non-resumable effect) to *resumable*, composable effects. Practical takeaway for the interview: these give you (a) "what effects can this code do?" as a type, and (b) swap the interpreter, not the code, to test. In mainstream languages you approximate all of this with injected capabilities and the core/shell split — which is why that pattern earns its keep even without an effect library.

### Q8. Concretely, how do you test a functional core *without mocks*?

You don't mock anything because the core takes and returns plain values. Mocks exist to stand in for effects; remove effects from the unit and the mocks evaporate. Contrast the two styles:

```python
def test_apply_discount(mocker):                   # entangled I/O forces mocks
    db = mocker.Mock(); mailer = mocker.Mock()
    db.load_user.return_value = User(spend=1500, email="a@b.co")
    apply_discount("u1", db, mailer)               # arrange 3 fakes to check one branch
    mailer.send.assert_called_once()

def test_decide_tier():                            # pure core: assert on values, no fakes
    assert decide_tier(1500) == Decision("gold",   "You are now gold")
    assert decide_tier(500)  == Decision("silver", "You are now silver")
    assert decide_tier(10)   == Decision("bronze", None)          # no I/O, no fakes
```

The pure tests are faster, deterministic (no clock/network flake), and read as a *specification* of the logic. You still write a *handful* of integration tests to prove the thin shell wires the pieces together — but the exhaustive branch coverage lives in mock-free unit tests. This is the whole return on investment of the pattern.

### Q9. A gotcha: what breaks if you push a `Clock`, randomness, or "now" into the core?

Determinism — the property the whole scheme buys you. The moment the core calls `Instant.now()`, `Math.random()`, or `Date.now()`, the same input no longer yields the same output and the function is no longer pure or repeatably testable. The fix isn't to inject a `Clock` interface *into the core* (that drags a capability back in); it's to **pass the value the core needs as data**. Compute "now" in the shell, hand it in:

```kotlin
// BAD: core reaches for the clock — impure, flaky test
fun isExpired(token: Token): Boolean = token.expiresAt < Instant.now()

// GOOD: shell reads the clock, core is a pure comparison
fun isExpired(token: Token, now: Instant): Boolean = token.expiresAt < now
// shell:  isExpired(token, clock.now())
```

Same for randomness (pass the seed or the drawn value) and IDs (pass the generated UUID in). The principle: **the core receives the results of effects as ordinary parameters; it never performs them.** This keeps `isExpired(token, someInstant)` a pure, exhaustively testable function.

### Q10. When is all of this overkill? Be honest about the tradeoffs.

FP has hype; don't cargo-cult it. The core/shell split is nearly always worth it — it's cheap and it's just "put your logic where you can test it." But the heavier machinery has real costs. A full **IO monad / effect library** (cats-effect, ZIO) imposes a learning curve on the whole team, colours your entire codebase in `IO[…]`, and can obscure control flow for people not fluent in it; it pays off in systems with gnarly concurrency, resource safety, and ret/cancellation needs, and is overkill for a CRUD service where a thin shell over a repo is clearer. In Kotlin/JS/Python you usually take the **80/20**: adopt functional core/shell everywhere, inject a couple of capabilities, and *skip* the monadic IO layer — the language's `suspend`/`async` and plain functions already carry you. Two honest constraints worth stating: mainstream runtimes don't erase effects for you (the JVM/Python still *do* the I/O when the shell runs), and deferring effects doesn't make them free — ordering, retries, and error handling still need thought. The senior move is matching the ceremony to the problem, not maximising purity.

### Q11. The interview one-liner: managing effects in one crisp paragraph.

Pure functions can't do I/O and real programs must, so you don't ban effects — you *localise* them: keep all the decision logic in a **pure functional core** that takes plain data and returns plain data (or a description of what to do), and push every effect — DB, network, clock, randomness — into a **thin imperative shell** at the edges that reads the world, calls the core, and performs the result. The **IO monad** formalises the extreme version — represent an effect as an inert *value* you compose with `flatMap` and run exactly once at the "end of the world," which restores referential transparency — and effect systems like ZIO track *which* effects and errors a function may have in its type; but in mainstream languages you usually just take the core/shell split plus a little dependency injection, which is what makes your logic deterministic and testable *without mocks*, because there's nothing effectful left in the part worth testing.


## Immutable State & Data Transformation

### Summary

**What this topic covers**

How functional programming manages *change over time* without mutation. The central move: stop treating state as a mutable place you poke, and start treating it as a **value produced by folding a sequence of events (or actions) through a pure function**. That one reframe unifies a surprising amount of mainstream practice — Redux and React's `useReducer`, the Elm architecture, Android/iOS MVI, event sourcing, undo/redo stacks, and time-travel debuggers are all the same idea wearing different clothes. This topic covers **reducers** (`(state, action) → newState`), the **update-via-copy** pattern for immutable data (spread, `copy`, and lenses/optics for deep nesting), **event sourcing** (persist the events, derive state by replaying them), and the **State monad** as the formal name for "threading state through a pure computation." It closes with the practical payoff: because every state is an immutable value and every transition is a pure function, you get auditability, trivial undo/redo, and time-travel debugging almost for free.

**Mental model**

Imperative code says "the account *has* a balance; subtract 10 from it." Functional code says "the balance *is* `fold(deposits_and_withdrawals, 0)` — a value computed from the whole history." State becomes a **left fold over events**: `stateₙ = reduce(events, initialState, apply)`. You never overwrite `stateₙ₋₁`; you produce a new value beside it. A reducer is the per-step function of that fold: `(state, action) → newState`, pure, no I/O, no mutation. Run the same actions from the same start and you always land on the same state — that determinism is what makes the whole family of tools work. Keeping old states around costs memory, but structural sharing makes it cheap: a "copy with one field changed" reuses the untouched 99%. The senior instinct: **separate the log of what happened (events/actions, the facts) from the current view (derived state).** The facts are the source of truth; the state is just a cached fold you can always rebuild.

**Key terms**

- **Reducer** — a pure function `(state, action) → newState`; the step function of a fold over actions.
- **Fold / reduce** — collapse a sequence into one accumulated value by applying a step function left-to-right.
- **Action / event** — an immutable value describing *what happened* (`{type: 'DEPOSIT', amount: 10}`); the input to a reducer.
- **Update-via-copy** — produce a changed value by copying and overriding fields (spread, `copy`, `with`) rather than mutating.
- **Structural sharing** — persistent data structures reuse unchanged sub-trees so copies are cheap.
- **Lens / optic** — a composable, first-class getter+setter that makes deep immutable updates readable.
- **Event sourcing** — persist the stream of events as the source of truth; derive current state by folding them.
- **Projection / read model** — a state value derived by folding events, often cached and rebuildable.
- **State monad** — the formalization of threading state purely: a value `S → (A, S)` that sequences stateful steps without a mutable variable.
- **Time-travel debugging** — replaying or rewinding through the sequence of past states, possible only because each is immutable.
- **Snapshot** — a persisted fold result used to avoid replaying the entire event log from zero.

**Why interviewers ask this**

State management is where most real bugs live, so it separates people who *use* Redux from people who understand *why it's shaped that way*. A junior describes Redux as boilerplate; a senior says "it's an event-sourced fold with a pure step function, which is exactly what buys you time-travel and predictable tests." The reveal question is usually a nested immutable update — weak candidates mutate the object and shrug, strong candidates reach for spread/`copy`/a lens and can explain why mutation would break `React.memo`, `===` change-detection, or an undo stack. The topic also probes whether you know the *costs*: unbounded event logs, snapshotting, replay performance, and when a plain mutable variable is simply the right call. Honest tradeoff talk is the senior signal.

**Common confusions**

- "A reducer and event sourcing are different things" — they're the same fold; event sourcing just *persists* the events instead of keeping only the latest state.
- "Immutability means slow copies" — with structural sharing a deep update copies only the path that changed, not the whole tree.
- "Redux/useReducer needs immutability by convention" — no, it needs it for correctness: mutating state defeats reference-equality change detection.
- "The State monad makes code stateful" — it makes state *explicit and pure*; there's still no mutable cell, just a value threaded through.
- "Store events forever" — usually you snapshot periodically and fold forward from the snapshot; the full log is for audit/rebuild.
- "Actions must be objects with a `type`" — that's a Redux convention; conceptually an action is any value the reducer knows how to apply.

**What follows from this topic**

This is immutability and higher-order functions (specifically `reduce`/fold) put to work on the hardest target: mutable state. The reducer *is* a fold, so recursion and higher-order functions underpin it. The State monad connects forward to monads — it's the canonical example of "a monad is a pattern for sequencing," here sequencing state instead of `Optional`/`Result`. Immutability's payoff for concurrency (safe sharing, no locks around shared state) is developed in the Concurrency primer; here we only note that a fold over immutable values is trivially safe to snapshot and replay. Lenses/optics are their own small discipline — we touch them, the composition topic (function composition) goes deeper.

### Q1. What does it mean to "manage state functionally"?

It means modeling state as a **value produced by a pure function of its history**, rather than a mutable location you write into over time. Concretely: you keep an immutable `state`, and every change is `newState = reduce(state, action)` where `reduce` is pure. The current state is a left fold over the whole sequence of actions:

```text
state₀ = initial
state₁ = apply(state₀, action₁)
state₂ = apply(state₁, action₂)
...
stateₙ = actionsₙ.fold(initial, apply)
```

The payoff is that "state" is now a *value*, not a *place*. Values can be compared (`===`), stored, logged, sent over the wire, and diffed. Because `apply` is pure and deterministic, the same actions always reproduce the same state — which is the entire basis for testability, undo, and replay. You trade in-place mutation (fast, but entangles time and identity) for a stream of immutable snapshots (a little more memory, but every past state still exists and nothing can change underneath you).

### Q2. What is a reducer, and why is that shape `(state, action) → newState` so common?

A **reducer** is a pure function that takes the current state and a single action and returns the next state — the step function of a fold over actions. It appears everywhere: Redux, React's `useReducer`, the Elm architecture (`update: (Msg, Model) → Model`), and Android MVI.

```typescript
type Action =
  | { type: 'increment' }
  | { type: 'add'; by: number }
  | { type: 'reset' };

function counterReducer(state: number, action: Action): number {
  switch (action.type) {
    case 'increment': return state + 1;
    case 'add':       return state + action.by;
    case 'reset':     return 0;
    // exhaustive: a never-typed default catches missed cases at compile time
  }
}

// The store is nothing but a fold over dispatched actions:
const actions: Action[] = [{ type: 'add', by: 5 }, { type: 'increment' }];
const final = actions.reduce(counterReducer, 0); // 6
```

The shape is popular because it is the *minimal* interface that makes state changes (a) pure and testable — a reducer is a plain function, no framework needed to unit-test it; (b) serializable — actions are data, so you can log, queue, or replay them; and (c) centralized — all transitions live in one place, so you reason about "how can this state change?" by reading one function instead of hunting every `x.field = ...` in the codebase.

### Q3. Show the "update-via-copy" pattern. How do you update a *nested* field immutably?

Shallow updates use a spread/copy. The trap is nesting: you must copy *every level along the path* to the changed field, because a shallow spread still shares the nested objects by reference.

```javascript
const state = {
  user: { name: 'alice', address: { city: 'Dublin', zip: 'D01' } },
  theme: 'dark',
};

// Shallow: fine, top-level field.
const s1 = { ...state, theme: 'light' };

// Nested: copy each level on the path (user, then address).
const s2 = {
  ...state,
  user: {
    ...state.user,
    address: { ...state.user.address, city: 'Cork' },
  },
};
// state is untouched; s2.user.address is a new object; s2.theme still === state.theme (shared, unchanged).
```

Kotlin's `data class` gives you `copy` per level:

```kotlin
data class Address(val city: String, val zip: String)
data class User(val name: String, val address: Address)
data class AppState(val user: User, val theme: String)

val s2 = state.copy(user = state.user.copy(address = state.user.address.copy(city = "Cork")))
```

The verbosity of deep copies is exactly the pain that **lenses/optics** exist to remove (next question). Note the win: unchanged branches keep their old references, so a memoized component subscribed to `state.theme` sees `s1.theme === state.theme` and can skip re-rendering — that reference-sharing is *why* immutability plus change-detection works.

### Q4. What are lenses/optics, and what problem do they solve?

A **lens** is a first-class, composable pair of "how to get field X" and "how to produce a new whole with X replaced" — a getter+setter as a value you can pass around and compose. They solve the nested-update verbosity from Q3: instead of hand-copying every level, you compose lenses down the path and call `set`/`over` once.

```typescript
// A minimal lens: get + immutable set.
interface Lens<S, A> {
  get: (s: S) => A;
  set: (a: A, s: S) => S;
}

const compose = <S, A, B>(outer: Lens<S, A>, inner: Lens<A, B>): Lens<S, B> => ({
  get: (s) => inner.get(outer.get(s)),
  set: (b, s) => outer.set(inner.set(b, outer.get(s)), s),
});

// cityLens = user ∘ address ∘ city; then:
// const s2 = cityLens.set('Cork', state);   // deep update, one call, original untouched
```

Real code uses a library (Ramda lenses, `optics-ts`, Arrow `Optics` in Kotlin, Monocle in Scala). The senior point: lenses make deep immutable updates *composable and readable*, turning an O(depth) pile of spreads into a single composed path. They're a nice-to-have, not a requirement — for one or two levels, plain `copy`/spread is clearer than pulling in an optics dependency. See function composition for how lens composition generalizes function composition.

### Q5. What is event sourcing, and why is it fundamentally functional?

**Event sourcing** stores the *sequence of events* (immutable facts about what happened) as the system's source of truth, and derives current state by **folding those events** through a pure `apply` function. Instead of a `balance` column you `UPDATE`, you have an append-only log of `Deposited`/`Withdrew` events, and `balance = events.fold(0, apply)`.

```python
def apply(balance, event):          # pure reducer over events
    kind, amount = event
    if kind == "deposited":
        return balance + amount
    if kind == "withdrew":
        return balance - amount
    return balance

events = [("deposited", 100), ("withdrew", 30), ("deposited", 50)]
balance = 0
for e in events:                    # a left fold; functools.reduce(apply, events, 0) is the same
    balance = apply(balance, e)
print(balance)  # 120
```

Kotlin, same fold made explicit:

```kotlin
sealed interface Event
data class Deposited(val amount: Int) : Event
data class Withdrew(val amount: Int) : Event

val balance = events.fold(0) { acc, e ->
    when (e) {
        is Deposited -> acc + e.amount
        is Withdrew  -> acc - e.amount
    }
}
```

It's functional to the core because it *is* a fold with a pure step function — the same shape as a reducer, just with the events persisted rather than discarded. This buys a full audit trail (you can answer "how did we get here?"), the ability to rebuild any past state or derive brand-new read models (projections) by re-folding, and temporal queries ("what was the balance on Tuesday?" = fold up to Tuesday). The costs are real: unbounded logs need **snapshots** (persist a fold result, replay forward from it), schema evolution of old events is fiddly, and eventual consistency between the log and projections must be designed for.

### Q6. What is the State monad, and how does it relate to reducers?

The **State monad** is the formal name for "threading a piece of state through a pure computation without a mutable variable." A stateful computation is modeled as a *function* `S → (A, S)`: given the old state, return a result `A` and the new state. The monad's job is to *sequence* these so you don't manually pass `s` between every step.

```typescript
// State<S, A> is a function from old state to [value, new state].
type State<S, A> = (s: S) => [A, S];

const get: State<any, any> = (s) => [s, s];
const put = <S>(next: S): State<S, void> => (_s) => [undefined, next];

// flatMap sequences two stateful steps, threading s automatically.
function flatMap<S, A, B>(m: State<S, A>, f: (a: A) => State<S, B>): State<S, B> {
  return (s) => {
    const [a, s1] = m(s);
    return f(a)(s1);
  };
}
```

The connection: a reducer `(state, action) → newState` is a *specialization* of this idea where the "computation" is picked by an action and returns only the next state. The State monad is the general version that also carries a result value and composes many steps purely. In mainstream FP you rarely reach for a literal `State` monad — Haskell/Scala use it to make imperative-looking-but-pure code; in Kotlin/TS you'd more likely just write a reducer or thread state explicitly. The value of knowing it is conceptual: it explains *why* reducers are pure and composable — they're the applied, stripped-down face of a well-understood formal pattern. See monads for the general sequencing story.

### Q7. Refactor: turn this imperative, mutating update into a functional one.

Imperative — mutates shared state, hard to test, no history:

```javascript
const cart = { items: [], total: 0 };
function addItem(product) {
  cart.items.push(product);          // mutates the array in place
  cart.total += product.price;       // mutates the field
}
```

Functional — pure reducer, returns a new state, original preserved:

```javascript
function cartReducer(cart, action) {
  switch (action.type) {
    case 'ADD_ITEM':
      return {
        items: [...cart.items, action.product],        // new array
        total: cart.total + action.product.price,      // new total
      };
    case 'REMOVE_ITEM':
      return {
        items: cart.items.filter((i) => i.id !== action.id),
        total: cart.items
          .filter((i) => i.id !== action.id)
          .reduce((sum, i) => sum + i.price, 0),
      };
    default:
      return cart;
  }
}

const c0 = { items: [], total: 0 };
const c1 = cartReducer(c0, { type: 'ADD_ITEM', product: { id: 1, price: 10 } });
// c0 is still { items: [], total: 0 } — the old state survives for undo/diff/testing.
```

What the refactor bought: `cartReducer` is a pure function, so a test is a one-liner with no setup or teardown; `c0` and `c1` coexist, enabling undo and time-travel; and because `c1 !== c0`, a UI layer can detect the change by reference. The cost is allocating new objects per action — negligible here, and where it isn't, structural sharing or an immutable-collection library (Immutable.js, Immer's copy-on-write) handles it.

### Q8. How do immutability and these patterns enable time-travel debugging and undo/redo?

Because every state is an **immutable value** and every transition is a **pure function**, the past never gets overwritten — so you can just *keep the list of states* (or the list of actions and re-fold). Undo is "point at the previous value"; redo is "point at the next"; time-travel debugging is "let me scrub to any index in that history and inspect it, guaranteed identical to when it happened."

```typescript
interface History<S> { past: S[]; present: S; future: S[]; }

function undo<S>(h: History<S>): History<S> {
  if (h.past.length === 0) return h;
  const previous = h.past[h.past.length - 1];
  return {
    past: h.past.slice(0, -1),
    present: previous,
    future: [h.present, ...h.future],   // current becomes redoable
  };
}
// redo is the mirror image; a new action clears `future`.
```

This only works because of immutability: if states were mutable, the entries in `past` would change out from under you and "the state at step 3" would be a lie. Redux DevTools' time-travel is literally this — it retains dispatched actions and re-runs the reducer to reconstruct any point. Event sourcing gives the same power at the persistence layer: fold the event log up to timestamp *T* to see the exact historical state. The general rule: **auditability, undo/redo, and time-travel are not features you build — they fall out for free once state is an immutable fold over an event/action log.**

### Q9. When is this overkill? When should you just mutate?

FP has hype; be honest. The reducer/event-sourcing machinery earns its keep when state is *shared*, *changes in many ways from many places*, needs an *audit trail*, or benefits from *undo/time-travel* — think an app's global store, a collaborative document, a financial ledger. It's overkill when:

- **Local, transient state** — a loop counter, an accumulator inside one function, a scratch buffer. `let sum = 0; for (...) sum += x` is clearer and faster than folding, and no one outside sees the mutation. Purity is about *observable* mutation; a mutable local that never escapes is fine.
- **Hot inner loops** — allocating a new immutable state per iteration can thrash GC. Mutating a local array or using a builder, then freezing at the boundary, is a common pragmatic pattern (e.g. Kotlin's `buildList`, Rust's `Vec` built mutably then shared as `&[T]`).
- **Tiny apps** — wiring up actions, a reducer, and a store for a three-field form is bureaucracy; `useState` is enough.

The senior framing: **use immutable state at boundaries and for shared/audited data; use controlled local mutation inside pure functions where it's invisible and performance matters.** The two coexist — a pure reducer can build its result with a local mutable loop, as long as what it *returns* is a fresh value and it never touches the input.

### Q10. The interview one-liner: immutable state and data transformation in one crisp paragraph.

Managing state functionally means treating current state not as a mutable place but as a **value you fold out of a sequence of events or actions** — `stateₙ = actions.fold(initial, reducer)`, where the reducer `(state, action) → newState` is a pure function. Changes are made by copying-and-overriding (spread, `copy`, or lenses for deep nesting), never by mutation, so every past state survives as its own immutable value; structural sharing keeps those copies cheap. **Event sourcing** persists the events and derives state by replaying them, and the **State monad** is the formal name for threading state purely through a computation — but the everyday faces of the idea are Redux, `useReducer`, and the Elm architecture. The payoff is that because state is an immutable value and transitions are pure functions, you get testability, auditability, undo/redo, and time-travel debugging essentially for free — and the senior move is knowing when that's worth it versus when a plain mutable local is simply the right tool.


## Concurrency & Parallelism the FP Way

### Summary

**What this topic covers**

Why functional style makes concurrent and parallel code dramatically easier to get right — and where its limits are. The central claim is small and load-bearing: **if data never mutates and functions never touch shared state, most of the hard problems in concurrency simply don't exist.** No shared mutable state means no data races, which means no locks to forget, no deadlocks to untangle, no torn reads. Immutable values can be shared across threads freely because there's nothing to corrupt. Pure functions are **trivially parallelizable** — a `map` over independent elements is "embarrassingly parallel" because each call is isolated. On top of that foundation this topic surveys the concurrency *models* that pair naturally with FP: **message-passing / actors** (Erlang, Akka — share nothing, communicate by copying messages), **STM** (software transactional memory — Clojure's `ref`/`dosync`), **CSP** (Go channels — "share memory by communicating"), and **futures/promises** as composable async values. It stays **conceptual on purpose**: the deep mechanics of threads, locks, memory ordering, and the happens-before model live in the **Concurrency primer** — here we care about how immutability and purity change the *shape* of the problem, not how a mutex is implemented.

**Mental model**

Data races require three ingredients: **shared** state, **mutable** state, and **concurrent** access. Remove any one and the race is impossible. Locking removes *concurrency* at the critical section — you serialize access, paying with contention, deadlock risk, and reasoning overhead. FP instead removes **mutability**: if a value can't change after construction, unlimited threads can read it at once with zero coordination, because a read that can never observe a half-written state needs no protection. So the functional move is to shrink the mutable, shared surface to almost nothing — a **pure core** of transformations plus a thin shell that does the actual I/O and coordination. Parallelism then falls out for free: since a pure function's result depends only on its inputs, running a thousand of them on different cores can't interfere, and the scheduler can reorder, retry, or speculatively run them without changing the answer. **Referential transparency is what makes retries and speculation safe** — if `f(x)` always yields the same value with no effects, re-running it after a transient failure or racing two copies and taking the first is harmless.

**Key terms**

- **Data race** — two threads access the same mutable location concurrently, at least one writing, with no ordering. UB / corruption.
- **Shared-nothing** — no memory shared between units of work; they communicate by passing copies (actors, processes).
- **Embarrassingly parallel** — a workload that splits into independent pieces with no coordination (a pure `map`).
- **Fork-join** — split work into subtasks, run in parallel, combine results (Java `ForkJoinPool`, parallel streams).
- **Associativity** — `(a⊕b)⊕c == a⊕(b⊕c)`; required for a parallel `reduce`'s combiner to be correct.
- **Actor model** — isolated processes with private state, communicating only via asynchronous messages (Erlang, Akka).
- **STM** — software transactional memory: atomic, optimistic transactions over refs that retry on conflict (Clojure).
- **CSP** — communicating sequential processes: goroutines/threads exchanging values over channels (Go).
- **Future / Promise** — a value that will exist later; composable via `map`/`flatMap`/`then` without blocking.
- **Referential transparency** — an expression equals its value; enables caching, retry, and speculative execution.
- **Immutable sharing** — passing read-only values across threads with no locks because they can't change.

**Why interviewers ask this**

This is where FP stops being aesthetic and starts paying rent. A junior says "immutable is good practice." A senior connects it to a mechanism: *no shared mutable state → no data races → safe lock-free sharing*, and can then reason about *which* model fits — actors when you have independent stateful entities, STM when you need coordinated updates to a few refs, channels when you're pipelining, futures when you're composing async I/O. Interviewers also probe the honest limits: immutability doesn't make everything parallel (a `reduce` needs an **associative** combiner; a sequential dependency chain can't be split), FP doesn't abolish coordination (you still need to *aggregate* results), and "no locks" doesn't mean "no cost" (persistent structures allocate; message passing copies). Naming the caveat is the senior signal.

**Common confusions**

- **"Immutability makes code parallel automatically"** → It makes sharing *safe*; you still have to *dispatch* work across cores (parallel streams, rayon, a thread pool). Safe ≠ parallel.
- **"Any reduce parallelizes"** → Only with an **associative** combiner (and often an identity). Subtraction and non-associative folds give wrong answers when split.
- **"Actors/STM/CSP are FP features"** → They're concurrency *models* that pair well with immutability; they exist in non-FP languages too. FP makes them cleaner, not mandatory.
- **"Pure means fast"** → Purity buys *safety* and *composability*, not speed. Parallelism can even lose to a tight sequential loop for small inputs (splitting overhead).
- **"Futures are just callbacks"** → A future is a *value* you can `map`/`flatMap`; that composability is the point, versus nested callback spaghetti.

**What follows from this topic**

This builds directly on **Immutability & Persistent Data Structures** (why sharing is safe and affordable) and **Pure Functions & Referential Transparency** (why parallel/retry/speculate is sound). **Map/Filter/Reduce** becomes parallel map/reduce here. **Functors/Monads** reappear as futures/promises — async values you compose with `flatMap`. For the mechanics deliberately left out — threads, locks, atomics, the memory model, happens-before — see the **Concurrency** primer; this topic is the FP-shaped view of the same territory.

### Q1. Why does immutability make concurrency easier? Walk the causal chain.

Because it removes one of the three ingredients a data race requires. A race needs **shared** + **mutable** + **concurrent** access with a write. Immutable values are constructed once and never change, so even though many threads share them and access them at once, there's no write to race against — every read observes a fully-formed value. The chain is: **immutable data → no shared mutable state → no data races → no locks needed → no deadlocks, no contention, no torn reads.** Contrast the lock-based approach, which keeps the mutation and serializes access instead: correct if you never forget a lock and never acquire two in the wrong order, but that's exactly the discipline humans fail at. The functional strategy is to make most of your data immutable so the vast majority of cross-thread access needs *zero* coordination, and confine the genuinely mutable, shared state to a tiny, obvious region you can guard carefully. You don't eliminate all coordination — aggregating parallel results still needs it — but you shrink it from "everywhere" to "one small place."

### Q2. What does "embarrassingly parallel" mean, and why is `map` the canonical example?

A workload is **embarrassingly parallel** when it decomposes into independent pieces that need no communication or coordination — you can hand each piece to a different core and stitch the results at the end. A **`map` of a pure function** is the textbook case: `map(f, xs)` applies `f` to each element, and if `f` is pure, `f(xs[i])` depends only on `xs[i]` — never on `xs[j]`, never on shared state, never on order. So the runtime can run all the `f` calls simultaneously and the answer is identical to running them sequentially. That's the whole trick: purity guarantees isolation, and isolation is what makes splitting free.

```java
// Java: sequential map...
List<Integer> lengths = words.stream()
    .map(String::length)
    .collect(Collectors.toList());

// ...becomes parallel by changing one word. Correct because String::length is pure.
List<Integer> lengthsPar = words.parallelStream()
    .map(String::length)
    .collect(Collectors.toList());
```

```rust
// Rust with rayon: par_iter() is the parallel drop-in for iter()
use rayon::prelude::*;
let lengths: Vec<usize> = words.par_iter().map(|w| w.len()).collect();
```

The caveat: this only holds while `f` is pure. If `f` mutates a shared counter or writes a shared buffer, you've reintroduced the race and the "one-word change" silently corrupts data.

### Q3. Parallel `reduce` needs an *associative* combiner — why, and what breaks without it?

`map` parallelizes trivially; `reduce` does **not**, because reduce folds elements together and the parallel runtime doesn't fold left-to-right — it splits the input, reduces each chunk on its own core, then combines the partial results in an unspecified grouping. For the parallel answer to equal the sequential one, the combine operation must be **associative**: `(a ⊕ b) ⊕ c` must equal `a ⊕ (b ⊕ c)`, so the grouping doesn't matter. Addition, multiplication, `min`, `max`, string concatenation, set union — all associative, all safe. **Subtraction and division are not**: `(10 - 3) - 2 = 5` but `10 - (3 - 2) = 9`, so a parallel "reduce by subtraction" returns garbage that depends on how the scheduler happened to chunk the data.

```java
// SAFE: sum is associative — parallel and sequential agree
int total = nums.parallelStream().reduce(0, Integer::sum);

// BROKEN: subtraction is not associative — result depends on chunking
int wrong = nums.parallelStream().reduce(0, (a, b) -> a - b);
```

Many APIs also want the seed to be an **identity** (`0` for sum, `""` for concat) and, in Java's three-arg `reduce`/`collect`, a separate associative **combiner** for merging partials. The mental checklist before parallelizing a fold: *is my combine associative, and is my seed a true identity?* If not, keep it sequential or restructure it (e.g. map to a monoid first).

### Q4. Contrast the actor model with shared-memory-plus-locks.

Both coordinate concurrent work; they differ in what's shared. **Shared memory + locks**: threads read and write the same mutable memory, and correctness depends on every thread acquiring the right lock in the right order. It's fast (no copying) but fragile — deadlocks, races, and priority inversion are all live hazards. The **actor model** is **shared-nothing**: each actor owns *private* state that no one else can touch, and actors communicate only by sending **immutable messages** to each other's mailboxes, processed one at a time. Because an actor handles messages sequentially and nothing outside can mutate its state, there's no lock inside an actor and no race between actors — the isolation replaces locking entirely.

```
// Erlang-style sketch: a counter actor. State lives only inside the loop;
// the outside world can only send messages, never poke the state.
loop(Count) ->
    receive
        {incr, N}      -> loop(Count + N);
        {get, From}    -> From ! {count, Count}, loop(Count);
        stop           -> ok
    end.
```

Erlang and Akka build on this; the tradeoff is that message passing **copies** (or transfers ownership), so it costs more per interaction than a shared read, and you trade data races for *logical* races (message ordering, lost messages) — different, often easier, but not zero. Immutability is what makes messages safe to pass: since a sent value can't change, sender and receiver can't interfere over it.

### Q5. What is STM (software transactional memory), and how does Clojure use it?

**STM** brings database-style transactions to in-memory state. You wrap coordinated updates to shared **refs** in an atomic transaction; the runtime runs it **optimistically**, tracking the reads and writes, and commits only if no other transaction touched those refs in the meantime — otherwise it **automatically retries** the whole block. You never take a lock and never specify a lock order, so deadlock is structurally impossible; the cost is that highly-contended transactions may retry several times, and transaction bodies must be **side-effect-free** because they can run more than once.

```clojure
;; Clojure: transfer between two accounts, atomically, no locks
(def a (ref 100))
(def b (ref 0))

(dosync                 ; transaction: both updates commit together or not at all
  (alter a - 50)
  (alter b + 50))
```

STM pairs naturally with FP because it *relies* on referential transparency: the "retry the block" strategy is only sound when re-running the block has no observable effect beyond the ref updates — exactly the guarantee purity gives you. Put an I/O call inside a `dosync` and a retry fires it twice. So the rule is the same functional-core/imperative-shell discipline: pure logic inside the transaction, effects outside it.

### Q6. How do Go channels (CSP) differ from actors, and what's the slogan?

Go follows **CSP — communicating sequential processes**. The slogan is *"Do not communicate by sharing memory; instead, share memory by communicating."* Independent **goroutines** exchange values over **channels**; sending a value hands it off, and the channel provides the synchronization, so you coordinate by passing data rather than by locking shared data. It's a close cousin of the actor model — both are shared-nothing message passing — but the emphasis differs: actors are addressed **entities** with mailboxes (you send *to an actor*), whereas CSP centers the **channel** as a first-class conduit (you send *to a channel*, and any goroutine reading it may receive). Channels are typically synchronous/bounded (a rendezvous), actor mailboxes typically asynchronous/unbounded.

```go
// Go: producer sends over a channel; consumer ranges until it's closed.
func produce(ch chan<- int) {
    for i := 0; i < 3; i++ {
        ch <- i * i            // hand the value off; no shared mutable state
    }
    close(ch)
}

func main() {
    ch := make(chan int)
    go produce(ch)
    for v := range ch {        // receive until channel closes
        fmt.Println(v)
    }
}
```

Go isn't a functional language, but CSP embodies the same principle FP leans on: keep state *inside* a process and move **values** between processes instead of sharing mutable memory. (Go also exposes locks and atomics for the cases where shared memory genuinely wins — the channel style is a default, not a religion.)

### Q7. In what sense is a future/promise a *composable* async value — and how is it monad-like?

A **future** (a.k.a. promise, `CompletableFuture`, JS `Promise`, Rust `Future`, Scala `Future`) represents a value that will arrive **later**. The functional insight is to treat it as a **value you transform**, not a callback you register: you `map` over it to change the eventual result, and `flatMap`/`then` to chain another async step whose input is this one's output — without ever blocking a thread waiting. That's precisely the **monad** shape from the Functors/Monads topic: `map` for `Future<A> → Future<B>`, `flatMap`/`then` for `Future<A> → (A → Future<B>) → Future<B>`, which is what lets you sequence dependent async calls linearly instead of nesting callbacks.

```javascript
// JS: promises compose — .then chains sequential async steps, no callback nesting
fetchUser(id)                       // Promise<User>
  .then(user => fetchOrders(user))  // flatMap: A -> Promise<B>
  .then(orders => orders.length)    // map:     B -> C
  .catch(err => 0);                 // error channel, like Result's Err
```

```scala
// Scala: for-comprehension is flatMap sugar over Future — reads sequential,
// runs async. Each step's result feeds the next.
val result: Future[Int] =
  for {
    user   <- fetchUser(id)
    orders <- fetchOrders(user)
  } yield orders.size
```

Composability is the whole value proposition: nested callbacks don't compose (you can't easily pass "a callback pipeline" around), but a `Future[A]` is an ordinary value you can return, store in a list, `map`, or feed to a combinator like `Future.sequence`/`Promise.all` to run many in parallel and collect the results.

### Q8. Why does referential transparency make retries and speculative execution safe?

Because a referentially transparent call `f(x)` **is** its result — same input, same output, no observable effects — so running it more than once, or not at all, or racing two copies, can't change the program's meaning. That underwrites several concurrency tricks that would be dangerous with effectful code. **Retry:** on a transient failure you can just call `f(x)` again; there's no half-applied side effect to undo (which is exactly why STM can auto-retry a transaction and why a pure task in a work-stealing pool is safe to re-run). **Speculation / hedging:** you can launch two copies of a slow pure computation on different cores and take whichever finishes first, discarding the loser — harmless, because neither left a trace. **Memoization:** cache the result and skip recomputation. **Reordering:** the scheduler can run independent pure tasks in any order. The moment `f` performs I/O — charges a card, sends an email, appends to a log — every one of these breaks: a retry double-charges, speculation double-sends. This is the operational reason for functional-core/imperative-shell: keep the retryable, parallelizable, speculatable work **pure**, and push the effects that must happen *exactly once* into a thin, carefully-ordered shell.

### Q9. Refactor a lock-guarded shared aggregation into a parallel map/reduce.

The imperative version shares one mutable accumulator across threads and guards every update with a lock — correct but contended, and easy to get wrong (forget the lock and it silently corrupts).

```java
// BEFORE: shared mutable total, lock on every element. Contention + fragility.
long total = 0;
Object lock = new Object();
items.parallelStream().forEach(it -> {
    synchronized (lock) {          // serializes the hot path
        total += it.price();
    }
});
```

The functional version has **no shared mutable state**: each element maps to a value purely, and an **associative** reduce combines partials — the runtime accumulates per-chunk and merges, so there's nothing to lock.

```java
// AFTER: pure map to a value, associative reduce combines partials. No lock.
long total = items.parallelStream()
    .mapToLong(Item::price)        // pure per-element transform
    .sum();                        // sum is associative → safe to parallelize
```

```rust
// Same shape in Rust with rayon: map is pure, sum is the associative combine.
use rayon::prelude::*;
let total: i64 = items.par_iter().map(|it| it.price()).sum();
```

The lesson generalizes: whenever you catch yourself locking a shared accumulator inside a parallel loop, ask whether the update is really an **associative fold** — if so, replace the shared-mutable-plus-lock pattern with map-then-reduce and the coordination disappears. When the combine *isn't* associative, that's the signal to keep it sequential or redesign the aggregation.

### Q10. Be honest: what does FP *not* solve about concurrency?

Plenty — and saying so is the senior signal. **Immutability makes sharing safe, not automatically parallel:** you still have to dispatch work across cores (`parallelStream`, rayon, a thread pool, an actor system), and for small inputs the split/merge overhead can lose to a tight sequential loop — measure before parallelizing. **Not everything is embarrassingly parallel:** a computation with a genuine sequential dependency (each step needs the previous result) can't be split, and a `reduce` only parallelizes with an **associative** combiner. **Coordination doesn't vanish:** you still aggregate results, and message-passing systems trade data races for *logical* races — message ordering, backpressure, lost or duplicated messages, distributed failure. **Purity has a cost:** persistent data structures allocate and chase pointers; message passing copies; STM retries under contention. And crucially, **the effects still have to happen** — the outside world is mutable and sequential, so your imperative shell still needs real synchronization; FP shrinks that surface, it doesn't erase it. The deep machinery for that shell — threads, locks, atomics, memory ordering, happens-before — is the **Concurrency primer's** subject, not this one's.

### Q11. The interview one-liner: concurrency the FP way in one crisp paragraph.

Functional programming attacks concurrency by removing **mutation** rather than serializing **access**: with no shared mutable state there are no data races, so immutable values can be shared across threads with zero locking, and pure functions — depending only on their inputs — are trivially parallelizable, which makes a `map` embarrassingly parallel and, via an **associative** combiner, a `reduce` too; referential transparency additionally makes retries, memoization, and speculative execution safe, and the models that pair with this worldview — **actors** and **CSP** (shared-nothing message passing), **STM** (optimistic auto-retrying transactions), and **futures/promises** (composable async values you `flatMap`) — all trade shared mutable memory for isolated state plus value passing; the honest caveats are that immutability makes sharing *safe* but not automatically parallel, that non-associative folds and sequential dependencies don't split, and that the effectful shell still needs real coordination — the mechanics of which belong to the Concurrency primer.


## FP in Multi-Paradigm Languages

### Summary

**What this topic covers**

A practical tour of what functional programming each mainstream language *actually gives you* — the features, the idioms, and the hard limits — so you can reach for FP where it pays and stop fighting the language where it doesn't. We walk Java (Streams, `Optional`, lambdas, `record`, sealed types + pattern-matching `switch`), Kotlin (`val`, `data class` copy, sealed hierarchies, `when`, lazy `sequence`, arrow-kt), JavaScript/TypeScript (first-class functions, closures, array HOFs, `const`, discriminated unions, fp-ts/Ramda), Python (comprehensions, `map`/`filter`, `functools`, frozen `dataclass`), and Rust (iterator adapters, `Option`/`Result` + `?`, traits, immutable-by-default, exhaustive `match`). Scala is the JVM's real FP language (cats, ZIO); Haskell/Clojure/Elixir/F#/OCaml are the reference points that define the "pure" end of the spectrum. The through-line: **use FP features pragmatically; don't force purity where the language fights you.**

**Mental model**

Think of a spectrum, not a binary. On one end sits **imperative-first with FP bolted on** (Java, Python); in the middle, **FP-leaning multi-paradigm** (Kotlin, JS/TS, Rust); at the far end, **FP-first** (Scala, then Haskell/Clojure/Elixir/OCaml/F#). Every mainstream language now hands you the *style* of FP — map/filter/reduce, immutable values, sum types, first-class functions — but almost none give you the *runtime guarantees* that make pure FP tick. The two things that separate "FP style" from "real FP" are (1) **general tail-call optimization** (deep recursion without blowing the stack) and (2) **higher-kinded types** (abstracting over `List`/`Option`/`Future` uniformly, i.e. a real `Functor`/`Monad` typeclass). The JVM has neither by default; Python has neither; Rust has TCO-ish loops but no HKT; only Scala/Haskell give you both. So the senior move is: **adopt the idioms (pipelines, sum types, `Result`), skip the ceremony the language can't support (deep recursion, monad transformers) — and know exactly which is which.**

**Key terms**

- **Multi-paradigm** — a language that supports OOP, imperative, and functional styles; you pick per problem.
- **HOF (higher-order function)** — a function taking or returning functions; the substrate of `map`/`filter`/`fold`.
- **Sum type / ADT** — a "one of" type: `sealed` (Kotlin/Java), `enum` (Rust), discriminated union (TS), `sealed trait` (Scala).
- **Exhaustive match** — the compiler forces you to handle every case; Rust `match`, Kotlin sealed `when`, Java switch on sealed.
- **TCO (tail-call optimization)** — reusing the stack frame on a tail call so recursion is a loop. Absent on the JVM, in Python, in JS engines (in practice).
- **HKT (higher-kinded types)** — abstracting over type constructors (`F[_]`); lets one `flatMap`/`Monad` interface span `Option`, `List`, `Future`. Scala/Haskell only.
- **`Optional`/`Option`/`Maybe`** — the null-free container; chain with `map`/`flatMap` instead of null checks.
- **`Result`/`Either`** — typed error channel: success or failure as a value, not an exception.
- **Immutable-by-default** — bindings are read-only unless marked mutable (Rust `let`, Kotlin `val`); the inverse of Java/Python.
- **Structural sharing** — persistent collections that reuse unchanged structure so "copy" is cheap (Clojure, Scala, immutable.js).
- **Effect system** — types that track side effects (`IO`, ZIO); the far-FP way to keep purity honest.

**Why interviewers ask this**

Because it separates people who *cargo-cult* FP from people who *reason* about it. A junior says "Java is functional now, it has streams." A senior says "Java has FP *style* — Streams and `Optional` — but no TCO, no HKT, and lambdas capture effectively-final variables, so I use FP for data pipelines and keep recursion shallow." The signal is honesty about limits: knowing that a `Stream` is single-use and lazy, that Python's lack of TCO caps your recursion depth at ~1000, that JS closures capture by *reference* (the classic `for`-loop-`var` bug), that Kotlin's `sequence` is the lazy escape hatch. Interviewers also probe judgment: *when* do you reach for arrow-kt's `Either` versus plain Kotlin? (Rarely — usually plain is enough.) The best answers show you'll adopt FP where it makes code clearer and refuse it where it adds ceremony.

**Common confusions**

- "Streams make Java functional" — they give you a functional *pipeline API*; the language still has no TCO, no HKT, and effects are uncontrolled.
- "`map`/`filter` means the language is FP" — every mainstream language has HOFs now; that's table stakes, not FP-ness.
- "Rust is imperative" — Rust is deeply FP-*influenced*: immutable-by-default, `Option`/`Result`, iterator adapters, exhaustive `match`, no null. It just isn't pure.
- "Python is a good FP language" — it has comprehensions and `functools`, but Guido deprioritized FP; no TCO, weak lambdas (one expression), `reduce` is banished to a module.
- "I need arrow-kt / fp-ts to do FP" — you almost never do; stdlib `Optional`/`Result`/sealed types cover 90% of the value.
- "TypeScript has ADTs" — it has *discriminated unions* (structural, erased at runtime); great for modeling, but no exhaustiveness unless you add a `never` check.

**What follows from this topic**

This is the "so what, in my language" capstone. It assumes the concept topics — **Immutability**, **HOFs**, **Option/Result**, **ADTs & pattern matching**, **Monads**, **Recursion** — and grounds each in real APIs. Recursion here connects to the TCO discussion; ADTs connect to sealed/enum/discriminated-union modeling; monads connect to `flatMap`/`Optional` chaining. If you want the *rigorous* version of any concept (the monad laws, typeclasses), that's where Scala and Haskell come in — this topic tells you which mainstream feature is the pragmatic stand-in.

### Q1. What FP does mainstream Java actually give you — and what are its hard limits?

Modern Java (17+) is genuinely FP-*capable* for everyday code, while remaining imperative at the core:

- **Lambdas & method refs** — `list.forEach(System.out::println)`; lambdas capture *effectively-final* locals only.
- **Streams** — lazy, single-use pipelines: `map`/`filter`/`reduce`/`collect`. Not collections — you can't iterate one twice.
- **`Optional`** — null-free container with `map`/`flatMap`/`orElse`. (Meant for return types, not fields.)
- **`record`** — concise immutable data carriers with auto `equals`/`hashCode`/accessors.
- **Sealed types + pattern-matching `switch`** — real ADTs with exhaustiveness (Java 21).

```java
sealed interface Shape permits Circle, Square {}
record Circle(double r) implements Shape {}
record Square(double s) implements Shape {}

double area(Shape sh) {
    return switch (sh) {                 // exhaustive; no default needed
        case Circle c -> Math.PI * c.r() * c.r();
        case Square q -> q.s() * q.s();
    };
}

var total = shapes.stream()
    .filter(s -> s instanceof Circle)
    .mapToDouble(this::area)
    .sum();
```

**Hard limits:** no general **tail-call optimization** (deep recursion overflows the stack — use loops or streams), no **higher-kinded types** (you cannot write one generic `Monad`/`Functor` interface over `Optional`/`Stream`/`CompletableFuture`), and effects are uncontrolled. Java gives you FP *style* for data transformation, not FP *guarantees*.

### Q2. Kotlin is often called "more functional than Java." What features earn that?

Kotlin is FP-leaning multi-paradigm and smooths over Java's rough edges:

- **`val`** makes immutability the easy default (vs Java's verbose `final`).
- **`data class` + `copy`** — immutable updates without boilerplate: `user.copy(name = "bob")`.
- **Sealed classes/interfaces + `when`** — exhaustive matching with smart-casts, the ADT workhorse.
- **Null safety in the type system** — `String?` vs `String`; `?.`, `?:`, `let` replace `Optional` for most cases.
- **Rich stdlib HOFs** — `map`, `filter`, `fold`, `groupBy`, `associateBy` on every collection.
- **`Sequence`** — the lazy escape hatch (Java `Stream` equivalent) for large/infinite pipelines.

```kotlin
sealed interface Result<out T>
data class Ok<T>(val value: T) : Result<T>
data class Err(val msg: String) : Result<Nothing>

fun describe(r: Result<Int>) = when (r) {   // exhaustive
    is Ok  -> "got ${r.value}"
    is Err -> "failed: ${r.msg}"
}

val evensSquared = (1..1_000_000).asSequence()   // lazy
    .filter { it % 2 == 0 }
    .map { it * it }
    .take(5).toList()
```

For monadic error handling, **arrow-kt** adds `Either`, `Option`, and comprehensions — but reach for it only when you genuinely want typed error composition; plain sealed `Result` + `when` covers most needs. Same JVM limits: no TCO for arbitrary recursion (though `tailrec` handles the self-recursive case), no HKT.

### Q3. What does the `tailrec` keyword do, and why does it matter that most languages lack it?

Kotlin's `tailrec` is the exception that proves the rule. Marking a *self-recursive* function `tailrec` tells the compiler to rewrite it into a loop, so it runs in constant stack:

```kotlin
tailrec fun sum(n: Long, acc: Long = 0): Long =
    if (n == 0L) acc else sum(n - 1, acc + n)   // rewritten to a loop
```

But it only works when the recursive call is in *tail position* and calls *itself* (not mutual recursion). The JVM has **no general TCO**, so Java and Scala (without `@tailrec`, which is also self-only) share this limit; Python and JavaScript engines don't optimize tail calls in practice either. **Consequence:** in these languages, deep or mutual recursion overflows the stack — you convert to iteration, an explicit stack, or a trampoline. Only true FP runtimes (Haskell, Clojure via `recur`, Scheme, Erlang/Elixir) give you recursion as a free replacement for loops. This is the single most common "gotcha" when someone brings a Haskell mindset to a JVM interview.

### Q4. Show the same map/filter/reduce pipeline in JS/TS, Python, and Rust.

The idiom is near-universal; the ergonomics differ.

```javascript
// JS/TS — array HOFs, chainable
const total = orders
  .filter(o => o.status === "paid")
  .map(o => o.amount)
  .reduce((a, b) => a + b, 0);
```

```python
total = sum(o.amount for o in orders if o.status == "paid")  # generator expr is lazy; this is idiomatic
value = sum(o.amount for o in paid)  # functools.reduce exists but is discouraged for summation
```

```rust
// Rust — lazy iterator adapters, nothing runs until the consumer
let total: u64 = orders.iter()
    .filter(|o| o.status == Status::Paid)
    .map(|o| o.amount)
    .sum();
```

Key differences: **JS** array methods are *eager* and allocate at each step; **Python** prefers comprehensions (a generator is lazy, a list comp is eager) and treats `reduce` as a code smell; **Rust** iterators are *lazy and zero-cost* — the chain compiles to a tight loop with no intermediate allocation. Rust also forces you to name the consumer (`sum`, `collect`) — nothing happens without it.

### Q5. Why is Rust described as "heavily FP-influenced" despite not being pure?

Rust is the poster child for taking FP's *good ideas* into a systems language without the purity dogma:

- **Immutable by default** — `let x = 5;` is read-only; you opt into mutation with `let mut`.
- **No null** — absence is `Option<T>` (`Some`/`None`); errors are `Result<T, E>`.
- **The `?` operator** — early-return propagation that reads like monadic `do`-notation for `Result`/`Option`.
- **Exhaustive `match`** — algebraic pattern matching the compiler checks for completeness.
- **Iterators + adapters** — lazy, composable, zero-cost `map`/`filter`/`fold`/`collect`.
- **Traits** — ad-hoc polymorphism close to Haskell typeclasses (bounded, not HKT-general).
- **Closures** — first-class, with `Fn`/`FnMut`/`FnOnce` capturing ownership precisely.

```rust
fn parse_config(path: &str) -> Result<Config, Error> {
    let raw = std::fs::read_to_string(path)?;   // ? propagates the Err
    let cfg: Config = toml::from_str(&raw)?;
    Ok(cfg)
}
```

What Rust *lacks* for full FP: no HKT (so no generic `Monad`), no GC-backed persistent data structures by default, and side effects aren't type-tracked. But the *defaults* — immutability, sum types, exhaustiveness, no null — mean idiomatic Rust reads more functionally than idiomatic Java. It's FP where FP earns its keep, imperative where control matters.

### Q6. How do TypeScript's discriminated unions compare to real ADTs, and where do fp-ts/Ramda fit?

TypeScript models sum types with **discriminated (tagged) unions** — a shared literal "tag" field the compiler narrows on:

```typescript
type Shape =
  | { kind: "circle"; r: number }
  | { kind: "square"; s: number };

function area(sh: Shape): number {
  switch (sh.kind) {
    case "circle": return Math.PI * sh.r ** 2;
    case "square": return sh.s ** 2;
    default: {
      const _exhaustive: never = sh;   // compile error if a case is missed
      return _exhaustive;
    }
  }
}
```

This is excellent for *modeling* — the compiler narrows types per branch — but note it's **structural and erased at runtime** (no `instanceof`), and you only get exhaustiveness by adding the `never` assertion. For a heavier FP toolkit, **fp-ts** supplies real `Option`, `Either`, `Task`, and typeclass-style `pipe`/`flatMap`; **Ramda** offers curried, data-last utilities and lenses. Honest take: fp-ts brings genuine monadic composition to TS but a steep learning curve and noisy stack traces — most teams get 90% of the benefit from plain discriminated unions, `readonly`, and array HOFs. Reach for fp-ts only when typed effect composition is a real project goal, not a preference.

### Q7. Why is Python considered the *least* FP-idiomatic of the mainstream languages?

Python *has* functional tools but the language's philosophy pushes you elsewhere:

- **Comprehensions are the idiom** — `[x*x for x in xs if x > 0]` is preferred over `map`/`filter`, which return lazy iterators few people chain.
- **Weak lambdas** — a lambda is a *single expression*, no statements; anything real needs a named `def`.
- **`reduce` was exiled** — moved out of builtins into `functools` because Guido considered it un-Pythonic.
- **`functools`/`itertools`** — `reduce`, `partial`, `lru_cache`, `chain`, `groupby` give you real FP building blocks.
- **Frozen dataclasses** — `@dataclass(frozen=True)` gives immutable value objects with `__eq__`/`__hash__`.
- **No TCO** — recursion is capped (default limit ~1000); deep recursion is an anti-pattern, use loops.

```python
from dataclasses import dataclass
from functools import reduce

@dataclass(frozen=True)          # immutable value object
class Point:
    x: int
    y: int

total = reduce(lambda a, b: a + b, (p.x for p in points), 0)  # works, but sum() is clearer
```

Python rewards a *light* functional touch — pure functions, comprehensions, immutable dataclasses — and punishes heavy FP (recursion, point-free style, monad emulation). Idiomatic Python is "functional in the small, imperative in the loop."

### Q8. If someone wants "real FP" on the JVM, why Scala — and what does it add over Kotlin?

Scala is the JVM's genuine FP language, where Kotlin is FP-*flavored* OOP. What Scala adds:

- **Higher-kinded types** — you can write `trait Monad[F[_]]` and abstract over `Option`, `List`, `Future`, `IO` uniformly. Neither Java nor Kotlin can express this.
- **Typeclasses via implicits/`given`** — ad-hoc polymorphism (`Functor`, `Monad`, `Semigroup`) as first-class, à la Haskell.
- **`for`-comprehensions** — desugar to `flatMap`/`map`, giving Haskell-style `do`-notation over any monad.
- **Rich pattern matching & case classes** — ADTs with destructuring built into the language core.
- **Libraries** — **cats** (typeclass hierarchy), **ZIO**/**cats-effect** (typed effect systems, `IO` with resource safety and structured concurrency).

```scala
sealed trait Tree[+A]
case class Leaf[A](value: A) extends Tree[A]
case class Branch[A](l: Tree[A], r: Tree[A]) extends Tree[A]

def size[A](t: Tree[A]): Int = t match {
  case Leaf(_)      => 1
  case Branch(l, r) => size(l) + size(r)
}
```

The cost is complexity and compile times, and it *still* runs on the JVM so it inherits the no-general-TCO limit (mitigated by `@tailrec` and trampolines like cats' `Eval`). But if your interview or team wants effect systems and lawful typeclasses without leaving the JVM, Scala is the answer — Kotlin deliberately stops short of HKT to stay simple.

### Q9. When would you actually reach for a dedicated FP library (arrow-kt, fp-ts, cats) versus stdlib?

Default to **stdlib**; add a library only for a concrete capability it lacks. The honest heuristic:

| Need | Stdlib is enough | Reach for the library |
|---|---|---|
| Null handling | Kotlin `?`, Rust `Option`, Java `Optional` | — |
| Simple success/failure | sealed `Result`, Rust `Result`, TS union | — |
| Composing *many* fallible steps with typed errors | gets verbose | arrow `Either` + `either {}`, fp-ts `pipe`, cats `EitherT` |
| Abstracting over `Option`/`List`/`Future` uniformly | impossible without HKT | cats/ZIO (Scala), fp-ts (TS) |
| Typed side effects / resource safety / structured concurrency | manual | ZIO, cats-effect |
| Lenses / deep immutable updates | manual `copy` chains | arrow optics, Ramda lenses, fp-ts `Lens` |

The trap is adopting fp-ts or cats for a codebase that only needed `Optional` chaining — you pay in learning curve, worse stack traces, and onboarding friction. **Buy the library when you're buying HKT, effect tracking, or heavy optics; skip it otherwise.** Seniors are expected to make this call, not reflexively FP-maximize.

### Q10. Refactor this imperative Java loop into idiomatic FP — and say what you'd *not* change.

Before — nested imperative accumulation:

```java
Map<String, Integer> totals = new HashMap<>();
for (Order o : orders) {
    if (o.getStatus() == Status.PAID) {
        String c = o.getCustomer();
        totals.put(c, totals.getOrDefault(c, 0) + o.getAmount());
    }
}
```

After — a declarative Stream pipeline that states *what*, not *how*:

```java
Map<String, Integer> totals = orders.stream()
    .filter(o -> o.getStatus() == Status.PAID)
    .collect(Collectors.groupingBy(
        Order::getCustomer,
        Collectors.summingInt(Order::getAmount)));
```

The pipeline is clearer, has no mutable temporary, and parallelizes trivially (`parallelStream()`). **What I would *not* change:** if the loop had early-exit logic, ordering-dependent side effects, or per-iteration I/O with error handling, forcing it into a stream makes it *worse* — streams are for pure transformations, not orchestration. And I wouldn't reach for recursion here: no TCO means a recursive fold over a large list overflows the stack. Pragmatism means using FP for the data-shaping and leaving control flow imperative when that's clearer.

### Q11. Give a one-line "FP by language" cheat sheet — the comparison table.

| Language | FP position | Immutability | Sum types / matching | TCO | HKT | Signature FP features / libs |
|---|---|---|---|---|---|---|
| **Java** | Imperative + FP bolt-on | `final` (verbose) | `sealed` + pattern `switch` | No | No | Streams, `Optional`, `record`, lambdas |
| **Kotlin** | FP-leaning OOP | `val` (easy default) | sealed + exhaustive `when` | `tailrec` only | No | null safety, `data class` copy, `Sequence`, arrow-kt |
| **JS/TS** | Multi-paradigm | `const` + libs | TS discriminated unions | No (in practice) | No (fp-ts emulates) | closures, array HOFs, fp-ts, Ramda |
| **Python** | Imperative-first | `frozen` dataclass, tuples | `match` (3.10+), limited | No | No | comprehensions, `functools`, `itertools` |
| **Rust** | FP-influenced systems | immutable by default | `enum` + exhaustive `match` | Loop-based, no general TCO | No | `Option`/`Result` + `?`, iterators, traits |
| **Scala** | FP-first on JVM | `val`, persistent colls | `sealed trait` + case class | `@tailrec` + trampolines | **Yes** | typeclasses, cats, ZIO, `for`-comprehensions |
| **Haskell / Clojure / Elixir / F# / OCaml** | Real FP reference | default / persistent | native ADTs | Yes | Haskell/OCaml yes | purity, laziness, typeclasses, effects |

Read the table as a gradient: everyone has HOFs and some sum-type story; **TCO and HKT are the dividing line** between "FP style" and "FP language." Clojure and Elixir bring persistent data structures and real recursion; F#/OCaml bring ML-style ADTs and inference; Haskell brings purity, laziness, and lawful typeclasses as the reference standard.

### Q12. The interview one-liner: FP in multi-paradigm languages, in one crisp paragraph.

Every mainstream language now hands you functional *style* — first-class functions, `map`/`filter`/`reduce`, immutable values, and sum types with pattern matching — so the senior skill isn't knowing that FP exists in your language, it's knowing *how far it goes*: Java and Python bolt FP onto an imperative core (Streams/`Optional`, comprehensions/`functools`) but have no tail-call optimization and no higher-kinded types; Kotlin and Rust lean genuinely functional with immutable-by-default bindings, `Option`/`Result`, and exhaustive matching, yet still lack HKT; only Scala (cats/ZIO) reaches real typeclasses and effect systems on the JVM, with Haskell/Clojure/Elixir/F#/OCaml as the pure reference end. The pragmatic verdict: adopt the idioms that make code clearer — pipelines, typed errors, immutable data, sum types — and refuse the ceremony your runtime can't back, like deep recursion where there's no TCO or monad-transformer stacks where there's no HKT; use FP where it pays and stop fighting the language where it doesn't.


## FP vs OOP — Tradeoffs, the Expression Problem & Refactoring

### Summary

**What this topic covers**

The honest comparison interviewers want: not "which paradigm is better" but *what each optimises for and what it costs you*. The core axis is where behaviour lives. **OOP** bundles data and behaviour into objects and makes adding a new **type** cheap (one class implementing an interface) while a new **operation** across all types is expensive (touch every class). **FP** separates data (algebraic data types) from behaviour (functions) and flips it: a new **operation** is cheap (one function that pattern-matches) while a new **type** is expensive (touch every function). That tension is the **Expression Problem**, and it explains half the design decisions you'll ever make. This topic also shows how most Gang-of-Four patterns dissolve into ordinary functions given closures, when each paradigm genuinely wins, and why the modern answer is *both* — a functional core inside an OO shell. The GoF catalogue and SOLID are owned by the OOD & Design Patterns primer; here we **contrast**, we don't re-teach.

**Mental model**

Picture a grid: rows are **types** (Circle, Square, Triangle), columns are **operations** (area, perimeter, draw). Someone has to fill every cell. OOP slices the grid **by row**: each class owns a row, so new rows (types) are a self-contained add, but a new column (operation) means editing every existing row. FP slices **by column**: each function switches over all types, so new columns are cheap, but a new type means editing every function. Neither slicing makes both axes free — that's the Expression Problem, a theorem, not a skill issue. The practical payoff: when you ask "will this grow more *kinds*, or more *things I do to a fixed set of kinds*?", you already know which paradigm to reach for. Stable types, growing operations → lean functional (a `sealed`/`enum` ADT plus free functions). Stable operations, growing types (a plugin system, new payment providers) → lean OO (an interface plus implementations).

**Key terms**

- **Expression Problem** — extending a data abstraction along *both* the type axis and the operation axis without editing existing code and without losing static type safety. No mainstream language solves it for free.
- **Algebraic data type (ADT)** — a closed sum of variants (`sealed interface`, Rust `enum`, Kotlin `sealed class`, Scala `enum`); the FP unit that trades open extension for exhaustive matching.
- **Open vs closed to extension** — OO interfaces are open in *types* (anyone adds an implementation), closed in *operations*; ADTs are the mirror image.
- **Dynamic dispatch** — OOP's mechanism: the object carries a vtable, the call site picks the method at runtime.
- **Pattern matching / `match`** — FP's mechanism: the function inspects the variant tag and branches, checked for exhaustiveness by the compiler.
- **Type class** — an FP mechanism (Haskell/Scala/Rust traits) that adds operations to types *retroactively*, attacking the operation axis while staying open on types.
- **Visitor pattern** — OO's workaround to add operations without editing classes; it makes operations easy but *freezes* the type set, i.e. it converts an OO shape into FP economics.
- **Higher-order function (HOF)** — a function taking/returning functions; the single tool that replaces Strategy, Command, Template Method, and Callback.
- **Functional core, imperative shell** — architecture where pure transformation logic sits in the middle and effects (I/O, mutation, framework glue) wrap the outside.
- **Multimethod** — dispatch on the runtime type of *multiple* arguments (Clojure, CLOS, Julia); a third answer to the Expression Problem.

**Why interviewers ask this**

It's the fastest way to tell a paradigm *tourist* from an *engineer*. A junior answers "FP is functions, OOP is objects" or recites "immutability good, inheritance bad" as slogans. A senior names the **tradeoff** — the Expression Problem, the type-vs-operation axis — and picks a paradigm *for a given growth direction* with a reason. Senior signal is also *dissolving* patterns: seeing that a Strategy hierarchy is just a function parameter, that you don't need a Command class when a closure does, and knowing when the class version still earns its keep (state, config, or a name a bare lambda can't carry). The strongest answer refuses the false binary: "these aren't rival religions; I put a pure functional core inside an OO shell," reaching for whichever paradigm makes the *likely* change cheap.

**Common confusions**

- "FP means no objects / OOP means no functions" → the distinction is where behaviour and state live, not literal keywords. Idiomatic Kotlin, Scala, and F# mix both.
- "The Expression Problem is solved by inheritance / by pattern matching" → each solves *one* axis; the problem is doing *both* without editing old code. Type classes and multimethods get closest.
- "Visitor lets you add anything to a class hierarchy" → it adds *operations* while freezing the *type set*; a new variant breaks every visitor. Visitor is FP-in-OO drag.
- "Replacing patterns with functions is always simpler" → a lambda loses the class's name and slot for state/config; Strategy-as-a-class still wins when the strategy is stateful.
- "OOP/FP is inherently slower" → both compile to comparable machine code; the real costs are immutability's allocation and megamorphic dispatch, both situational.

**What follows from this topic**

This is the synthesis topic — it leans on the ADTs & pattern-matching topic (the FP half of the Expression Problem), the HOFs and closures topics (the machinery that dissolves the patterns), and immutability (why the functional core is safe to share). For the *object* side — the GoF catalogue, SOLID, and LLD — cross-reference the **OOD & Design Patterns** primer. For "which paradigm for concurrency", see the FP concurrency topic (immutability → lock-free sharing); the **Concurrency** primer owns threads-and-locks mechanics.

### Q1. What is the fundamental difference between how OOP and FP organise a program?

Where behaviour lives relative to data. **OOP bundles data and the behaviour that acts on it into objects**: an object holds state and exposes methods, and calls are dispatched at runtime on the receiver's type (`shape.area()` — the object *knows* how to compute its own area). **FP separates data from behaviour**: data is dumb (records, tuples, algebraic data types) and behaviour is standalone functions that take data in and return new data out (`area(shape)` — the *function* knows how, and switches on the shape).

That single choice cascades. OOP's unit of reuse is the class and its interface; FP's is the function and its composition. OOP hides state behind encapsulation and mutates it in place; FP prefers immutable values and produces new ones. OOP extends by subtyping; FP extends by writing more functions. Neither is "objects vs no-objects" — it's *encapsulated state with polymorphic methods* vs *transparent data with composable functions*.

```kotlin
// OOP: behaviour lives inside the type
interface Shape { fun area(): Double }
class Circle(val r: Double) : Shape { override fun area() = Math.PI * r * r }

// FP: data is inert, behaviour is a free function switching over variants
sealed interface ShapeF
data class CircleF(val r: Double) : ShapeF
fun area(s: ShapeF): Double = when (s) {
    is CircleF -> Math.PI * s.r * s.r
}
```

### Q2. What is the Expression Problem, and why can't you just "design it well" to avoid it?

The Expression Problem is: extend a data abstraction along **both** axes — add new **types** (variants) *and* new **operations** — without modifying existing code and without losing static type checking. It's named by Philip Wadler and it's a genuine limitation, not a sign you picked the wrong pattern.

Think of the type-by-operation grid. Every cell (this type, this operation) must be defined somewhere.

```text
            area      perimeter    NEW: draw
Circle       ok          ok          ??
Square       ok          ok          ??
NEW: Hexagon ??          ??          ??
```

- **OOP fills the grid by row.** Each class owns a row. Adding **Hexagon** (a new row) is clean — one new class, nothing else edited. Adding **draw** (a new column) forces you to edit *every* class. OOP is open on types, closed on operations.
- **FP fills the grid by column.** Each function is a column that `match`es over all variants. Adding **draw** (a new function) is clean. Adding **Hexagon** forces you to edit *every* function — and a good compiler will fail the build on the non-exhaustive matches, which is the feature working as intended. FP is open on operations, closed on types.

You can't "design your way out" because it's a structural theorem: the mechanism that makes one axis cheap is exactly what makes the other axis require edits. Languages *attack* it (below), but none makes both axes free and statically safe with zero ceremony.

### Q3. How do type classes, Visitor, and multimethods each attack the Expression Problem?

Three different escapes, each buying one axis back at a cost:

- **Type classes / traits (Haskell, Scala, Rust).** Define an operation *outside* the data as a type class, then add `instance`/`impl` blocks per type. New operation = new type class + instances (open on operations). New type = one value plus its instances (open on types!). This is the closest mainstream solution — Rust's `trait` + `impl Trait for NewType` lets you add both a new type and, via a new trait, a new operation without editing old code. The cost is coherence rules and orphan-instance restrictions.
- **Visitor (OOP).** Bolt an `accept(visitor)` method onto a class hierarchy so operations move *out* into visitor classes. Now a new operation is one new visitor (cheap) — but adding a variant breaks every visitor (you froze the type set). Visitor deliberately trades OOP's economics for FP's: it's *"pattern matching, the hard way"* inside an OO language.
- **Multimethods (Clojure, CLOS, Julia).** Dispatch a function on the runtime types of *several* arguments. New operation = new multimethod; new type = new method definitions. Both axes stay open, and it solves the related *double-dispatch* problem (Visitor's other use) directly.

```rust
// Rust type classes: add an operation to an existing type without editing it
trait Draw { fn draw(&self) -> String; }
impl Draw for f64 { fn draw(&self) -> String { format!("num {self}") } }
```

The interview point: name the axis each one opens, and that Rust/Scala traits and Lisp multimethods get furthest, while Visitor is a *workaround*, not a solution.

### Q4. Show the same extension in OOP vs FP and say which change each makes cheap.

Add a **new type** (Triangle) and a **new operation** (perimeter), and watch which files you touch.

```kotlin
// OOP — new TYPE is a self-contained add; new OPERATION edits every class
interface Shape { fun area(): Double }              // add perimeter() here => edit all
class Circle(val r: Double): Shape { override fun area() = Math.PI*r*r }
class Triangle(val b: Double, val h: Double): Shape { // NEW TYPE: one clean class
    override fun area() = 0.5*b*h
}
```

```python
from dataclasses import dataclass          # FP: new OPERATION is a clean add; new TYPE edits every function
@dataclass
class Circle:   r: float
@dataclass
class Triangle: b: float; h: float          # NEW TYPE: now every function must handle it

def area(s):                                 # add perimeter(s) beside this => clean
    match s:
        case Circle(r):    return 3.14159*r*r
        case Triangle(b,h): return 0.5*b*h
```

In the OOP version, `Triangle` is a one-file add but a new `perimeter()` on the interface ripples through `Circle`, `Triangle`, and every other shape. In the FP version, a new `perimeter(s)` function is a one-place add but the new `Triangle` variant forces edits to `area` and every sibling function. Same information, mirror-image cost — that's the whole lesson.

### Q5. Strategy pattern is "just a function" — show the refactor.

Strategy encapsulates an interchangeable algorithm behind an interface so the context can swap it. With first-class functions, the interface, the concrete classes, and the wiring collapse into a function-typed parameter.

```java
// BEFORE — GoF Strategy: an interface + a class per algorithm
interface DiscountStrategy { double apply(double price); }
class NoDiscount   implements DiscountStrategy { public double apply(double p){ return p; } }
class TenPercent   implements DiscountStrategy { public double apply(double p){ return p*0.9; } }
class Checkout {
    private final DiscountStrategy strategy;
    Checkout(DiscountStrategy s){ this.strategy = s; }
    double total(double price){ return strategy.apply(price); }
}
// call site: new Checkout(new TenPercent()).total(100)
```

```java
// AFTER — the strategy is a UnaryOperator<Double>; classes vanish
class Checkout {
    private final DoubleUnaryOperator discount;
    Checkout(DoubleUnaryOperator d){ this.discount = d; }
    double total(double price){ return discount.applyAsDouble(price); }
}
// call site: new Checkout(p -> p * 0.9).total(100);
// named, reusable strategies are just constants:
DoubleUnaryOperator TEN_PERCENT = p -> p * 0.9;
```

The interface `DiscountStrategy` *is* `DoubleUnaryOperator`; each implementing class *is* one lambda. You keep Strategy's benefit (swap algorithm without touching `Checkout`) and delete the boilerplate. **When to keep the class:** if a strategy needs configuration, a name for logging, injected dependencies, or its own state, the class earns its keep — a bare lambda has no place to hang those.

### Q6. Which GoF patterns dissolve into functions once you have closures and HOFs?

Many "patterns" are only patterns because Java-of-2003 lacked first-class functions. With closures and HOFs they become one-liners:

| GoF pattern | Functional equivalent | Why |
| --- | --- | --- |
| **Strategy** | a function parameter | the algorithm *is* the function you pass |
| **Command** | a closure / thunk | a captured call you invoke later; undo = a pair of closures |
| **Observer** | callbacks / a stream (`Flow`, `Observable`, `EventEmitter`) | subscribe = pass a function; emit = call it |
| **Template Method** | a HOF taking the varying steps | the skeleton is a function; the "hooks" are function args, not overrides |
| **Iterator** | a lazy sequence / generator | `Sequence`, `Iterator`, `yield`, Rust `Iterator` |
| **Decorator** | function composition | `compose(f, g)`; middleware `handler -> handler` wrappers |
| **Factory** | a function returning a value | `() -> Connection`; a supplier is a factory |

```javascript
// Decorator = composition: each wrapper is handler -> handler
const withLogging = (handler) => (req) => { console.log(req.url); return handler(req); };
const withAuth    = (handler) => (req) => req.token ? handler(req) : deny();
const app = withLogging(withAuth(baseHandler));   // stacked decorators, no classes
```

```kotlin
// Command = closure; Observer = list of callbacks
val undoStack = ArrayDeque<() -> Unit>()
fun delete(item: Item) { store.remove(item); undoStack.push { store.add(item) } } // closure captures item
```

The honest caveat: patterns that carry *structure* rather than *behaviour* — Composite, Builder for a complex object, Flyweight's shared-cache — don't reduce to a lambda. And even Strategy-as-a-lambda gives up a name and a state slot. Patterns aren't obsolete; a chunk of the *behavioural* ones were just first-class functions wearing a costume.

### Q7. Observer as classes vs Observer as a stream — what actually changes?

Classic Observer wires a `Subject` holding a list of `Observer` objects and calling `update()` on each. The functional/reactive version replaces the observer *objects* with functions and often the manual list with a stream abstraction that also gives you composition (`map`, `filter`, `debounce`) and lifecycle (unsubscribe) for free.

```typescript
// OO Observer: interface + registration list + notify loop
interface Observer { update(price: number): void; }
class Ticker {
  private obs: Observer[] = [];
  subscribe(o: Observer){ this.obs.push(o); }
  set(price: number){ this.obs.forEach(o => o.update(price)); }
}
```

```typescript
// Functional: a subscriber IS a function; a stream adds map/filter/teardown
type Sub<T> = (v: T) => void;
class Stream<T> {
  private subs = new Set<Sub<T>>();
  subscribe(fn: Sub<T>){ this.subs.add(fn); return () => this.subs.delete(fn); } // returns unsubscribe
  emit(v: T){ this.subs.forEach(fn => fn(v)); }
  map<U>(f: (v:T)=>U): Stream<U> { const s = new Stream<U>(); this.subscribe(v => s.emit(f(v))); return s; }
}
// ticker.map(p => p * 1.01).subscribe(console.log)
```

What changes: subscribers are values you can pass, store, and transform; the stream composes (`.map().filter()`), which the object version can't do without more classes; and `subscribe` hands back a teardown closure instead of a `remove(observer)` method needing you to hold the original reference. This is exactly the model behind RxJS, Kotlin `Flow`, and React's event props.

### Q8. When does FP genuinely win, and when does OOP?

Match the paradigm to the *shape of the problem and its growth direction*.

**FP wins for:**
- **Data transformation / pipelines** — ETL, parsing, compilers, analytics: input → `map`/`filter`/`reduce` → output. The whole job is composing pure functions.
- **Concurrency & parallelism** — immutable data has no races, so `parallelStream`, fork/join, and actor messages are safe without locks. (Mechanics live in the Concurrency primer.)
- **Domain modelling with a fixed vocabulary of cases** — an ADT (`sealed`/`enum`) that makes illegal states unrepresentable and forces exhaustive handling: order states, AST nodes, protocol messages.
- **Correctness-critical logic** — referential transparency makes code testable and reason-about-able; the same input always gives the same output.

**OOP wins for:**
- **Stateful entities with identity and lifecycle** — a `Connection`, a game `Player`, a UI `Widget`: things that *are* something over time and encapsulate mutable state behind an interface.
- **Frameworks and plugin systems** — where the *type* set grows (new payment providers, new device drivers) and you want third parties to add implementations without touching core. That's OOP's cheap axis.
- **Polymorphic hierarchies with stable operations** — a small fixed set of methods, many implementations.
- **Modelling a domain of "nouns" others must extend** — an SDK surface where subclassing/interfaces is the extension contract.

The one-question heuristic: *"Will this grow more kinds of things, or more things I do to a fixed set of kinds?"* More kinds → OO. More operations → FP.

### Q9. What does "functional core, imperative shell" mean, and why is it the modern default?

It's the architecture that ends the paradigm war by using each where it's strong. The **core** is pure functions over immutable data: all the business logic, decisions, and transformations, with **no** I/O, no mutation of shared state, no clock or randomness reached for directly. The **shell** is a thin imperative/OO outer layer that does the effects — read the request, load from the DB, call the core, write the result, respond — and hands the core everything it needs as plain values.

```kotlin
// CORE: pure — decision logic, trivially testable, no I/O
data class Order(val items: List<Item>, val coupon: String?)
fun priceOrder(order: Order, rates: Map<String, Double>): Double =   // pure function of its inputs
    order.items.sumOf { it.price } * (if (order.coupon != null) 0.9 else 1.0)

// SHELL: imperative — fetches inputs, runs the core, performs effects
suspend fun handle(req: Request, db: Db) {
    val order = db.loadOrder(req.id)          // effect in
    val total = priceOrder(order, db.rates()) // pure core
    db.saveInvoice(req.id, total)             // effect out
}
```

Why it's the default: you get FP's testability and reasoning for the part that holds the complexity (the core needs no mocks — pass values, assert values), and you don't fight your language, framework, or the outside world (which is inherently effectful and stateful) in the shell. Hexagonal/ports-and-adapters architecture is the same idea from the OO side. Idiomatic Kotlin, Scala, F#, and modern TypeScript all land here.

### Q10. Refactor an imperative/OOP command-dispatch into a higher-order-function table.

A classic OO instinct for "do different things by key" is a Command interface plus a class per command, registered in a map. The functional version replaces the classes with a map of *functions* — same open-closed benefit, far less ceremony.

```java
// BEFORE — Command pattern: interface + a class per action + registry
interface Command { String run(String arg); }
class Greet implements Command { public String run(String a){ return "hi " + a; } }
class Shout implements Command { public String run(String a){ return a.toUpperCase(); } }
Map<String, Command> registry = Map.of("greet", new Greet(), "shout", new Shout());
String out = registry.get(cmd).run(arg);
```

```java
// AFTER — a table of functions; each command is one lambda, adding one is one line
Map<String, Function<String,String>> registry = Map.of(
    "greet", a -> "hi " + a,
    "shout", String::toUpperCase          // method reference — no class, no boilerplate
);
String out = registry.getOrDefault(cmd, a -> "unknown").apply(arg);
```

The dispatch stays data-driven and open for extension (add a key + lambda), but three classes and their instantiation disappear. Keep the class form only if a command needs its own dependencies, undo/redo state, serialization, or a name for audit logging — then the class is carrying real weight a lambda can't. This is the same move as Strategy-as-a-function (Q5), applied to a keyed set.

### Q11. Is FP always more testable and safer, or is that overclaimed?

Overclaimed if taken absolutely; largely true in practice. Pure functions *are* the easiest thing in software to test — no setup, no mocks, no teardown; feed inputs, assert outputs, done — and immutability removes a whole class of aliasing and data-race bugs. That's real and worth reaching for.

But be precise about the caveats, because interviewers probe the hype:

- **The effects don't vanish, they move.** Your program still does I/O; FP pushes it to the edges (the shell). The shell still needs integration tests. You haven't deleted the hard part, you've *contained* it.
- **Mainstream languages are pragmatically impure.** Java, Kotlin, JS, Python let you mutate and do I/O anywhere; "purity" is a discipline you enforce, not a guarantee the compiler gives you (unlike Haskell's `IO`). A `map` lambda with a side effect compiles fine.
- **Immutability has costs.** Copy-on-write allocates; a hot loop rebuilding a large list each iteration can be slower and GC-heavier than in-place mutation. Persistent data structures soften this but don't erase it.
- **No free lunch on recursion.** The JVM has no general tail-call optimisation and Python has none at all, so "just use recursion instead of loops" can blow the stack — a real constraint on how functional you can be in those languages.

So: FP buys testability and safety *for the pure part*, at the cost of allocation and some language friction, and it relocates rather than removes effectful complexity. Claim the wins, name the costs.

### Q12. The interview one-liner: FP vs OOP in one crisp paragraph.

OOP bundles data with behaviour and makes adding a new **type** cheap but a new **operation** expensive; FP separates data (as algebraic types) from behaviour (as functions) and makes adding a new **operation** cheap but a new **type** expensive — that mirror-image tradeoff is the **Expression Problem**, and no mainstream language solves both axes for free (type classes, Visitor, and multimethods each buy one axis back at a cost). First-class functions dissolve most of the *behavioural* GoF patterns — Strategy is a function, Command a closure, Observer a stream, Template Method a HOF, Decorator function composition — so I reach for a class only when it carries state, identity, or config a lambda can't. I don't treat them as rival religions: I lean FP when the work is data transformation, pipelines, concurrency, or fixed-vocabulary domain modelling, lean OO when I have stateful entities, frameworks, or a growing set of types others must extend, and in practice I ship a **functional core in an imperative shell** — pure, testable decision logic in the middle, effects and framework glue at the edges.


## Scenario & Interview Playbooks

### Summary

**What this topic covers**

This is the closing synthesis topic — the place where the individual FP concepts stop being definitions and become *moves* you make on real code under interview pressure. Every card here is a **scenario drill**: someone hands you a lump of imperative or exception-throwing or callback-nested code and asks you to reshape it, or asks the pointed judgment question ("when would you *not* do this?"). The value isn't learning a new concept — it's stitching together *Pure Functions*, *Immutability*, *Higher-Order Functions*, *Option / Result*, *Functors & Monads*, and *Immutable State* into a fluent response. If the earlier topics taught the vocabulary, this one teaches the sentences.

**Mental model**

Almost every FP interview scenario is one of five reshaping moves, and naming which one you're doing out loud is half the signal. **(1) Loop → pipeline**: a mutable-accumulator `for`-loop becomes `filter`/`map`/`reduce` (*Higher-Order Functions*). **(2) Impure → functional core / imperative shell**: pull I/O and clock and randomness to the edges so the decision logic is a pure, trivially testable function (*Pure Functions*). **(3) Illegal states → unrepresentable**: replace stringly-typed flags and nullable fields with sum types and `Option`/`Result` so the compiler rejects the bad case (*ADTs*, *Option/Either*). **(4) Nested null/callback/try → flat chain**: collapse the pyramid of doom with `flatMap`/`?.`/`and_then` (*Monads*). **(5) Mutation → value + event log**: model change as producing a new immutable value, and if you need history, keep the events (*Immutable State*). Interviewers aren't testing whether you can spell "monad" — they're testing whether, shown ugly code, you reach for the right one of these five reflexively and can justify the tradeoff.

**Key terms**

- **Functional core, imperative shell** — pure decision logic wrapped in a thin I/O layer; the testability payoff of *Pure Functions*.
- **Railway-oriented programming** — chaining `Result`-returning steps so the first failure short-circuits down the error track.
- **Accumulating errors (applicative)** — validating *all* fields and collecting every error, vs monadic short-circuit on the first.
- **Parse, don't validate** — turn unstructured input into a precise type *once* at the boundary, so downstream code can't re-check.
- **Make illegal states unrepresentable** — design types (sum types, non-empty lists, `Option`) so bad combinations don't compile.
- **Pyramid of doom** — deeply nested null-checks / callbacks; the smell that `flatMap`/monadic chaining removes.
- **Event sourcing** — persist the sequence of events, not just current state; undo/audit/replay fall out for free.
- **Reduce / fold** — the universal loop replacement: seed + combining function collapse a collection to one value.
- **Pure decision + effectful interpreter** — return a *description* of what to do, run it at the edge.
- **Dogma tax** — the readability/perf cost of forcing FP where the host language or team fights it.

**Why interviewers ask this**

Concept questions ("what's a functor?") are cheap to game with a memorized line. Scenario questions expose whether the concepts are *load-bearing* in how you actually write code. A junior applies FP everywhere as a badge — recursion where a loop is clearer, a monad transformer stack for a two-field form. A senior reaches for the *specific* move a problem needs, and — the real tell — knows when to stop: when a plain loop reads better, when the JVM's lack of TCO makes deep recursion a `StackOverflowError`, when purity would mean threading state through fifteen signatures for no gain. The strongest signal in this whole primer is a candidate who refactors imperative → functional *and then* says "…but here I'd leave the loop, because." Fluency plus restraint.

**Common confusions**

- "Refactor to FP = make everything pure" — no; push effects to the *edges*, keep the *core* pure. A program with zero I/O does nothing.
- "Railway and accumulating validation are the same" — monadic `flatMap` stops at the first error; accumulating (applicative) reports all of them. Forms want the latter.
- "Undo needs the Memento pattern / deep copies" — with immutable state, every past value already survives; keep a list of them or the events.
- "`map` then `flatten` is different from `flatMap`" — they're the same operation; `flatMap` just avoids the intermediate nesting.
- "FP means no variables ever" — it means no *shared mutable* state; local rebinding and an imperative shell are fine.

**What follows from this topic**

Nothing follows — this is the terminus. It reaches back and reuses every prior topic: the loop-to-pipeline drill is *Higher-Order Functions*, the testability drill is *Pure Functions* and *Immutability*, the domain-modeling drill is *ADTs* and *Option/Either*, the chaining drills are *Functors*, *Monads*, and *Type Classes*, and the undo drill is *Immutable State*. Cross-primer, the concurrency scenario hands off to the **Concurrency** primer for the actual memory model, and the "FP vs OOP" judgment connects to **OOD & Design Patterns**. Treat these cards as the rehearsal reel: pattern-match a prompt to one of the five moves, narrate the tradeoff, and know where you'd stop.

### Q1. Refactor this imperative nested-loop aggregation into map/filter/reduce.

The prompt is usually something like "sum the order totals for active premium customers." The imperative version mutates an accumulator inside nested loops:

```java
double total = 0;
for (Customer c : customers) {
    if (c.isActive() && c.tier() == Tier.PREMIUM) {
        for (Order o : c.orders()) {
            total += o.amount();
        }
    }
}
```

The pipeline version names each stage — *filter* the rows, *flatMap* to the orders, *map* to amounts, *reduce* to the sum (see *Higher-Order Functions*):

```java
double total = customers.stream()
    .filter(c -> c.isActive() && c.tier() == Tier.PREMIUM)  // keep rows
    .flatMap(c -> c.orders().stream())                      // customers -> orders
    .mapToDouble(Order::amount)                             // orders -> numbers
    .sum();                                                 // reduce
```

```kotlin
val total = customers
    .filter { it.isActive && it.tier == Tier.PREMIUM }
    .flatMap { it.orders }
    .sumOf { it.amount }
```

The win isn't fewer lines — it's that each stage is a named, independently-readable transformation with no mutable `total` to reason about. The honest caveat: if the loop also did three unrelated things (logging, side effects, early break on a sentinel), a pipeline can be *worse*; split concerns first, and if one genuinely needs imperative control flow, keep it a loop.

### Q2. This function is hard to test because it reads the clock and hits the database. Make it pure.

The move is **functional core / imperative shell** (see *Pure Functions*). The impure version interleaves a decision with I/O, so testing it needs mocks, a fake clock, and a database:

```python
def maybe_send_reminder(user_id):
    user = db.load(user_id)                       # I/O
    if user.last_seen < datetime.now() - WEEK:    # clock
        email.send(user.address, "come back")     # I/O
```

Split it: a pure function decides, the shell does I/O. Now the decision is testable with plain values — no mocks, no clock:

```python
def reminder_decision(last_seen, now):            # pure: values in, value out
    return now - last_seen > WEEK                  # returns a description, not an effect

def maybe_send_reminder(user_id):                  # thin shell
    user = db.load(user_id)
    if reminder_decision(user.last_seen, datetime.now()):
        email.send(user.address, "come back")
```

```text
test: reminder_decision(week_ago, now) is True     # no DB, no email, no clock
```

State the payoff explicitly: the interesting logic moved to a function whose test is a one-liner, and the untested shell shrank to boring plumbing. That relocation — *push effects to the edge* — is the whole game, and it's why pure functions matter in practice, not in theory.

### Q3. Model this domain so illegal states are unrepresentable.

Given "a payment is pending, or succeeded with a transaction id, or failed with a reason," the weak model is a struct with a `status` string and three nullable fields — nothing stops `status="failed"` with a populated `transactionId` and a null reason. Use a **sum type** so each case carries exactly its own data (see *ADTs* and *Option/Either*):

```kotlin
sealed interface Payment {
    object Pending : Payment
    data class Succeeded(val txId: TxId) : Payment          // id required, no reason field
    data class Failed(val reason: String) : Payment          // reason required, no id field
}
```

```rust
enum Payment {
    Pending,
    Succeeded { tx_id: TxId },
    Failed { reason: String },
}
```

The bad combinations now don't compile — you can't have a `Succeeded` without a `txId`, and a `when`/`match` forces you to handle all three. Pair this with **parse, don't validate**: turn `String` into `EmailAddress` (or `Option<EmailAddress>`) *once* at the boundary, and every downstream function takes the precise type and never re-checks. The senior framing: "I'd rather the compiler reject the impossible state than write a runtime guard I might forget."

### Q4. This validation throws exceptions and stops at the first bad field. Rewrite it as a Result pipeline that accumulates all errors.

Two distinct shapes here, and knowing which you want is the point. **Railway (monadic)** chains `Result`-returning steps and short-circuits on the first failure — right when steps *depend* on each other (see *Monads*):

```rust
fn parse_order(raw: &Raw) -> Result<Order, Error> {
    let id   = parse_id(&raw.id)?;          // ? short-circuits on first Err
    let qty  = parse_qty(&raw.qty)?;
    Ok(Order { id, qty })
}
```

But a *form* wants every error at once, which is short-circuit's opposite: the **applicative / accumulating** style (see *Type Classes* on `Applicative`). You validate each field independently and combine, collecting all failures:

```kotlin
fun validate(f: Form): Result<User, List<Error>> {
    val name  = nonEmpty(f.name)      // each returns Ok or a single error
    val email = validEmail(f.email)
    val age   = inRange(f.age, 0..150)
    return zip(name, email, age) { n, e, a -> User(n, e, a) }   // gathers ALL errors
}
```

```text
zip(Err["name blank"], Err["bad email"], Ok 30) -> Err["name blank", "bad email"]
```

The interview distinction to say aloud: **monad = sequential, dependent, first-failure; applicative = independent, parallel, all-failures.** Reaching for accumulating validation on a form (rather than making the user fix errors one submit at a time) is the senior tell.

### Q5. You have callback hell / nested null checks. Flatten it with monadic chaining.

Both smells are the same shape — a pyramid where each level might not continue — and both flatten with `flatMap` (see *Monads*, *Option/Either*). Nested null checks:

```java
// pyramid of doom
String city = null;
if (user != null) {
    Address a = user.getAddress();
    if (a != null) {
        City c = a.getCity();
        if (c != null) city = c.getName();
    }
}
```

```java
// flattened: Optional.map/flatMap, each step skipped if empty
String city = Optional.ofNullable(user)
    .map(User::getAddress)
    .map(Address::getCity)
    .map(City::getName)
    .orElse("unknown");
```

Async callbacks are the *same move* — a `Promise`/`Future` is a monad, so `.then`/`flatMap` sequences them without nesting (see *Functors*):

```javascript
// callback hell
getUser(id, u => getOrders(u, os => getTotal(os, t => render(t))));

// flat: each then receives the previous result, errors propagate to one catch
getUser(id).then(getOrders).then(getTotal).then(render).catch(handle);
```

The unifying line: "`flatMap` is how you sequence *anything that might not continue* — a missing value, a failure, a not-yet-arrived result — without the staircase." That one insight covers `Optional`, `Result`, `Promise`, and `Stream`.

### Q6. Design an undo feature.

Two clean approaches, both leaning on *Immutable State*; pick based on whether you need *history* or just *previous*. **Immutable snapshots**: because each edit produces a *new* immutable value, the old ones still exist — undo is just popping a stack of past states, no deep-copy Memento needed:

```typescript
type History<S> = { past: S[]; present: S };

function apply<S>(h: History<S>, next: S): History<S> {
    return { past: [...h.past, h.present], present: next };   // old present preserved
}
function undo<S>(h: History<S>): History<S> {
    const past = [...h.past];
    const prev = past.pop()!;
    return { past, present: prev };
}
```

**Event log (event sourcing)** scales better when state is large: store the *events*, not full snapshots, and fold them to get state. Undo = drop the last event and re-fold; you also get redo, audit, and replay for free:

```text
events: [AddItem(a), AddItem(b), Remove(a)]
state  = events.reduce(applyEvent, empty)     # fold to current
undo   = replay all but the last event
```

The framing that lands: "I don't need a Memento pattern or defensive copies — immutability means the past *is already retained*. Snapshots if states are small; an event log if I also want redo, audit, or time-travel." That connects immutability directly to a feature interviewers recognize.

### Q7. Fix this shared-mutable-state bug functionally.

Two threads incrementing a shared `HashMap` counter is a data race. The FP angle isn't "add a lock" — it's *remove the shared mutation* (see *Immutability*, and the **Concurrency** primer for the actual memory model). If each worker computes over its own immutable slice and you *combine* results, there's nothing to race on:

```kotlin
// parallel map, then reduce — no shared accumulator
val counts = chunks.parallelStream()
    .map { chunk -> countWords(chunk) }     // each returns its own immutable Map
    .reduce(emptyMap()) { a, b -> merge(a, b) }
```

Immutable data is safe to share precisely because no one can mutate it — that's the property that makes fearless parallelism possible (Rust encodes it in the type system; `Send`/`Sync`). Where you *do* need shared evolving state, the FP answers are an atomic compare-and-swap on an immutable reference (Clojure `atom`, `AtomicReference`), STM, or an actor owning the state — but say the honest boundary: "the mechanics of locks and the memory model are the Concurrency primer's job; my contribution here is that immutability makes most of the sharing safe by construction."

### Q8. Compose these small functions into a pipeline.

Given `normalize`, `tokenize`, `dedupe`, `rank`, the imperative version names four throwaway intermediates; composition names the *pipeline* (see *Function Composition & Point-Free Style*):

```javascript
const pipe = (...fns) => x => fns.reduce((v, f) => f(v), x);

const process = pipe(normalize, tokenize, dedupe, rank);   // one named transform
const result  = process(rawInput);
```

```kotlin
val process = ::normalize andThen ::tokenize andThen ::dedupe andThen ::rank
```

The value is that `process` is now a first-class thing you can name, test, and reuse. The restraint to voice: **point-free is a readability tool, not a scoring event.** `pipe(normalize, tokenize)` reads well; a chain of `curry`/`flip`/`compose` gymnastics to avoid ever naming an argument reads worse than a plain lambda. Compose until it clarifies, then stop — over-golfed point-free code is a common junior over-reach.

### Q9. When would you NOT use FP here?

The best answer in the whole primer, because it proves the concepts are tools and not a religion. Concrete "leave it imperative" cases:

- **The host language fights it.** Java before records/pattern-matching, or Go (no generics-heavy FP idioms historically, no sum types) — forcing deep FP produces ceremony. Write idiomatic code for the language you're in.
- **No tail-call optimization.** The JVM and CPython don't do TCO — a naturally-recursive deep traversal is a `StackOverflowError` / `RecursionError` waiting to happen; use a loop or an explicit stack (see *Recursion & TCO*).
- **Hot-path performance.** A tight numeric loop over a primitive array can beat an allocating `map`/`filter` chain (boxing, intermediate collections). Measure; persistent data structures have a real constant factor.
- **Purity would smear state through fifteen signatures.** Sometimes a small, well-contained mutable local (a builder, a memo cache) is clearly the simpler code. Local mutation isn't the enemy; *shared* mutation is.
- **The team doesn't read it.** A monad transformer stack in a codebase full of `for`-loops is a maintenance liability regardless of elegance. Code is communication.

Saying "here I'd keep the loop, because the JVM has no TCO and this recursion is 10k deep" is a stronger signal than any refactor. FP is a set of defaults you *reach for*, not a purity test you pass.

### Q10. Explain a monad to a skeptical colleague in 30 seconds.

No category theory. "A monad is just a wrapper type with a `flatMap` — a rule for chaining operations that each return the *wrapper*, so the plumbing between steps is automatic. `Optional.flatMap` skips the rest if a value is missing. `Result`/`Either` `flatMap` skips the rest on the first error. `Promise.then` waits for the previous async step before running the next. `Stream.flatMap` flattens nested collections. Same shape every time: `flatMap` sequences 'things in a box' so you don't hand-write the null-check / error-check / callback nesting between each step. You already use three of these daily — the word just names the pattern they share." Then, only if pushed, mention the laws (left identity, right identity, associativity — see *Monads* and *Type Classes*) as "the rules that guarantee the chaining behaves." The skill this card tests is *demystification*: a senior makes the concept land in terms of `Optional` and `Promise`, a junior recites "a monoid in the category of endofunctors" and communicates nothing.

### Q11. The interview one-liner: how do you talk about FP without dogma?

Frame FP as **a set of defaults that shrink the space of what can go wrong** — pure functions and immutability so behavior is predictable and testable, sum types and `Option`/`Result` so illegal states don't compile and errors are values instead of surprises, and `map`/`flatMap`/`reduce` so data transformations read as named pipelines instead of mutable-accumulator loops. Pull effects to the edges (functional core, imperative shell), model change as new values (with an event log when you need history), and reach for `flatMap` whenever a step *might not continue*. Then earn the senior grade by naming the limits in the same breath: no free lunch on the JVM's missing TCO, on allocation in hot loops, or on a team that won't read a transformer stack — so you apply FP *where it removes a class of bug or clarifies intent, and drop it where a plain loop reads better.* Multi-paradigm fluency, not purity, is the point: "I use the functional move when it makes the code safer or clearer, and I know when it doesn't."


