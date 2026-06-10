---
created-on: "[[Journal/2026/June/10-June-Wednesday]]"
ctime: 2026-06-10 09:00:00
categories:
  - "[[Categories/Interview Prep|Interview Prep]]"
  - "[[Categories/Technical|Technical]]"
type: interview-prep
---

# Go Interview Primer — 100+ Questions

Comprehensive Q+A primer covering any Go (Golang) backend interview. Sister note to the [[Java Interview Primer]] — same shape, Go-flavoured: FAANG, fintech, cloud-native shops, and infra teams shipping in Go.

Each answer is interview-shaped: 2–6 sentences, code where useful, no textbook padding.

1. [[#Core Go]]
2. [[#Interfaces & Type System]]
3. [[#Concurrency]]
4. [[#Goroutines & Scheduler]]
5. [[#Memory & Garbage Collection]]
6. [[#Error Handling]]
7. [[#Standard Library]]
8. [[#Testing]]
9. [[#Modules & Build]]
10. [[#Performance & Profiling]]
11. [[#Web Services & HTTP]]
12. [[#Database (database/sql)]]
13. [[#Design Patterns & Idioms]]
14. [[#Common Pitfalls & Spot-the-Bug]]
15. [[#Cloud-Native Go]]
16. [[#Security]]
17. [[#Resilience Patterns]]
18. [[#Tooling]]

---

## Core Go

### Summary

**What this topic covers** — This is the foundation layer of Go: how source becomes a binary, how the type system's zero-value philosophy shapes API design, and the three data structures you will touch in every single program — slices, maps, and structs — plus the method/receiver rules and `defer`. If you cannot reason precisely about slice headers and `defer` argument evaluation, every later topic (concurrency, GC, performance) sits on sand. Interviewers probe here first because it separates people who write Go from people who write Java-in-Go.

**Mental model** — Go is a small, value-oriented language with explicit memory layout and no hidden runtime magic. Variables are values; assignment and function calls copy values. The "reference-ish" types — slices, maps, channels, pointers, functions — are themselves small value structs that *contain* a pointer to shared backing storage, so copying the header is cheap but the copies alias the same data. Hold that distinction and most "spooky action at a distance" bugs become obvious. The compiler decides stack vs heap via escape analysis, not you. There is no inheritance, no constructors, no exceptions; you compose structs and return `error` values. Everything has a zero value that must be usable, which is why idiomatic Go types are designed so the zero value is the empty-but-valid state. Once you internalize "copy the header, share the array; zero value is the constructor," the language stops surprising you.

**Key terms**
- **Zero value** — the default value a variable gets with no initializer: `0`, `""`, `false`, `nil` for pointers/slices/maps/channels/interfaces/funcs.
- **Slice header** — a 3-word struct `{ptr, len, cap}` describing a window into a backing array.
- **Backing array** — the contiguous allocation a slice points into; multiple slices can share one.
- **Capacity** — elements available from the slice's start to the end of the backing array; `cap >= len`.
- **Escape analysis** — compiler pass deciding whether a value lives on the stack or escapes to the heap.
- **Method set** — the set of methods callable on a type `T` vs `*T`; determines interface satisfaction.
- **Receiver** — the value or pointer a method is bound to (`func (t T)` vs `func (t *T)`).
- **Embedding** — placing a type inside a struct without a field name, promoting its fields/methods.
- **Comma-ok idiom** — `v, ok := m[k]` to distinguish "absent" from "present with zero value."
- **Addressable** — a value whose address can be taken with `&`; map elements are not.
- **`defer`** — schedules a call to run when the surrounding function returns, in LIFO order.

**Why interviewers ask this** — A junior describes slices as "dynamic arrays" and stops. A senior knows a slice is a 3-word header, can predict whether an `append` mutates a caller's data, and knows that passing a slice "by value" still lets the callee overwrite shared elements. The same split shows on `defer` (does the argument capture happen now or at return?), on receivers (why does a `*T` method block `T` from satisfying an interface?), and on maps (why won't `&m[k]` compile?). These aren't trivia — they predict whether someone will ship aliasing bugs and resource leaks. Strong candidates answer with the memory layout, not the vibe, and reach for the right fix (`append([]T(nil), src...)`, three-index slices, pointer receivers) without prompting.

**Common confusions**
- **"Slices are passed by reference."** No — the *header* is copied by value; it just happens to point at shared storage, so element writes are visible but `append`/reslice on the copy may not be.
- **"`append` always mutates in place"** — only when `cap` allows; otherwise it allocates a new array and the original is untouched.
- **"Map iteration is random by accident."** It's deliberately randomized by the runtime to stop you depending on order.
- **"`defer` evaluates its arguments at return time."** Arguments are evaluated when `defer` executes; only the *call* is deferred.
- **"Value receivers can't mutate, so always use pointers."** Value receivers are correct and idiomatic for small immutable-ish types; mixing receiver kinds on one type is the real smell.
- **"Embedding is inheritance."** It's composition with method promotion — no virtual dispatch, no `super`.

**What follows from this topic** — Slice and map semantics underpin the **Concurrency** topic (shared backing arrays plus goroutines equals data races), the method-set rules feed directly into **Interfaces and errors**, and escape analysis and `defer` cost reappear in **Performance and the runtime** (pprof, `GOMEMLIMIT`, GC). Get this layer exact and the rest of Go is mostly applying it under new constraints.

### Q1. Walk through how a Go program goes from source to a running binary. What does the toolchain do that the JVM does at runtime?

`go build` runs a multi-stage compile entirely ahead of time. The compiler (`gc`) parses each package, type-checks it, runs escape analysis and inlining decisions, lowers to SSA, optimizes, and emits machine code per package into archive files. The linker then stitches those objects together with the runtime and produces one statically linked native executable — no external VM, no separate JIT.

The key contrast with the JVM: Java compiles to bytecode, ships that, and the JVM interprets-then-JIT-compiles to native at runtime, doing profile-guided optimization while the app runs. Go decides stack-vs-heap placement, inlining, and devirtualization at *compile* time. There's no warm-up curve and no class loading; the binary starts at full speed. The tradeoff is Go can't use runtime profiles for hot-path specialization the way HotSpot does — though Go 1.21+ added PGO (profile-guided optimization) where you feed a `default.pgo` pprof profile back into `go build` to guide inlining at compile time. That's PGO done statically, not a runtime JIT.

```bash
go build -o app .          # native binary, links runtime in
go build -gcflags='-m' .   # show escape-analysis / inlining decisions
go tool compile -S x.go    # dump the generated assembly
```

What ships with the binary is the Go *runtime*: the scheduler (goroutines onto OS threads), the garbage collector, the memory allocator, and reflection metadata. So Go has a runtime, just not a virtual machine — it's linked in, not installed separately. That's why a Go binary is large (a few MB) but runs anywhere with the right OS/arch and no JRE.

### Q2. Explain zero values and why Go has no constructors. What does this buy you and where does it bite?

Every type has a zero value, and Go guarantees a freshly declared variable is initialized to it: numerics `0`, strings `""`, booleans `false`, and `nil` for pointers, slices, maps, channels, interfaces, and functions. There are no constructors because the design goal is that the zero value should be *useful* — `var b bytes.Buffer` is a ready-to-use buffer, `var mu sync.Mutex` is an unlocked mutex, `var wg sync.WaitGroup` is ready. No `new Buffer()` ceremony.

What this buys you: predictability and no "uninitialized garbage." You never read indeterminate memory like in C. It also pushes API designers toward types whose empty state is the valid default, which tends to produce simpler, allocation-free initialization. When you do need setup, the convention is a plain function `NewThing(...) *Thing` (or `(*Thing, error)`), not a special language construct.

Where it bites: `nil` maps and slices behave asymmetrically. Reading a nil map is fine (returns the element zero value), but *writing* panics:

```go
var m map[string]int
_ = m["x"]      // ok, returns 0
m["x"] = 1      // panic: assignment to entry in nil map  -> need make(map...)
```

A nil slice, by contrast, is fully appendable — `var s []int; s = append(s, 1)` works — so the asymmetry trips people. The other bite is types whose zero value is *not* valid and where the compiler can't warn you: a struct holding an unexported `*sql.DB` that you forgot to set, or your own type that requires a constructor. The fix is to make the zero value valid where you can, and where you can't, document that `NewX` is mandatory and keep the type unexported so callers can't `var x X{}` their way into a broken state.

### Q3. Arrays vs slices: what is a slice header, and what happens on append when capacity is exceeded?

An array `[N]T` has its length baked into its type — `[3]int` and `[4]int` are different types — and it's a *value*: assigning or passing it copies all elements. You rarely use arrays directly; they're the storage layer. A slice is the everyday workhorse: a 3-word header describing a window into a backing array.

```go
type sliceHeader struct {
    ptr *T   // start of the window in the backing array
    len int  // number of accessible elements
    cap int  // elements from ptr to end of backing array
}
```

Passing a slice copies these three words, not the data — cheap regardless of length. `len` is what indexing/range see; `cap` is how far you can grow before reallocating.

`append` checks whether `len < cap`. If there's room, it writes in place into the existing backing array and returns a header with `len+1` — same `ptr`. If `len == cap`, the runtime allocates a *new, larger* backing array (growth is roughly doubling for small slices, tapering to ~1.25x for large ones), copies the elements over, and returns a header pointing at the new array. The old array is untouched. That reallocation is exactly why you must always write `s = append(s, x)` — the returned header can differ from the input.

```go
s := make([]int, 0, 2)   // len 0, cap 2
s = append(s, 1, 2)      // fits: same backing array
s = append(s, 3)         // cap exceeded: new array, copied, doubled cap
```

If you know the final size, preallocate with `make([]T, 0, n)` to skip the copy churn — a real hot-loop win that `pprof` will show you as `runtime.growslice`.

### Q4. Explain slice aliasing and the re-slice gotcha (sharing backing arrays). Show a bug and the fix.

Because a slice is just a header pointing into a backing array, two slices can share the same array. Re-slicing (`s[a:b]`) and `append` into spare capacity both create aliases. Mutations through one are visible through the other — until a reallocation silently splits them, which is where the nastiest bugs live.

Classic bug: a function appends to a sub-slice of the caller's data and clobbers neighboring elements because the sub-slice still has capacity reaching into the parent's array.

```go
func addID(ids []int, x int) []int {
    return append(ids, x)
}

all := []int{1, 2, 3, 4}   // len 4, cap 4
first := all[:2]           // len 2, cap 4  <- cap reaches into 'all'
first = addID(first, 99)   // append fits in cap -> overwrites all[2]!
// all is now [1 2 99 4]  -- surprise mutation of the original
```

`first` had `cap 4`, so `append` wrote into `all[2]` instead of allocating. The fix is the **three-index slice** to cap the capacity at the length, forcing the next `append` to reallocate:

```go
first := all[:2:2]   // len 2, cap 2  -> append must allocate, 'all' is safe
```

When you genuinely need an independent copy, copy explicitly:

```go
dst := append([]int(nil), src...)   // or make + copy
// Go 1.21+:
dst := slices.Clone(src)
```

The same trap bites with sub-slices held long-term: a tiny `s[:1]` of a 1GB slice keeps the whole backing array alive (memory leak), because the GC can't free an array any live header references. Copy out the small piece you need. And the `bytes`/`strings` split functions return sub-slices aliasing the input — don't mutate the input while holding them.

### Q5. How do maps work in Go? Iteration order, the comma-ok idiom, and why you cannot take the address of a map element.

A Go map is a hash table: keys are hashed into buckets, each bucket holds up to 8 key/value pairs, and overflow buckets chain when a bucket fills. As the map grows past a load factor, it incrementally rehashes into a bigger bucket array, migrating buckets a few at a time during writes so there's no single giant stall. You create one with `make(map[K]V)` (or a literal); the zero value is `nil` and is read-only.

Iteration order is **deliberately randomized** — the runtime picks a random starting bucket and offset each `range`. This isn't an accident or a hash artifact; it's intentional so code can never depend on order. If you need stable order, collect and sort the keys:

```go
keys := make([]string, 0, len(m))
for k := range m { keys = append(keys, k) }
sort.Strings(keys)   // or slices.Sort
```

The comma-ok idiom distinguishes "key absent" from "key present with the zero value" — essential because `m[k]` alone returns the zero value for missing keys:

```go
v, ok := m[k]   // ok == false means k absent; v == zero value
if !ok { /* handle missing */ }
```

You can't take `&m[k]` because map entries are **not addressable**. The reason is mechanical: the incremental rehash can move entries to a new bucket array at any write, so any pointer you held would dangle. Go forbids the pointer rather than letting you keep a stale one. The consequence: you can't mutate a struct field in place inside a map.

```go
m["a"].count++          // compile error: cannot assign to struct field
v := m["a"]; v.count++  // works on a copy...
m["a"] = v              // ...write the whole value back
```

If you need in-place mutation, store pointers: `map[string]*T`. Then `m["a"].count++` works because you're dereferencing a stable heap pointer, not addressing the bucket.

### Q6. Value receivers vs pointer receivers on methods — how do you choose, and what does the method set rule imply for interface satisfaction?

A value receiver `func (t T) M()` operates on a *copy*; mutations don't persist. A pointer receiver `func (t *T) M()` operates on the original and can mutate it. The decision rules: use a pointer receiver if the method mutates the receiver, if the struct is large enough that copying is wasteful, or if the type contains a `sync.Mutex` or other thing that must not be copied. Use a value receiver for small, immutable-style types (a `time.Time`, a 2-int `Point`). The hard rule that overrides taste: **be consistent** — if any method needs a pointer receiver, give the type *all* pointer receivers. Mixing is a code smell and creates the method-set surprises below.

The method set rule: the method set of `T` includes only value-receiver methods; the method set of `*T` includes both value- and pointer-receiver methods. So a `*T` can call everything, but a plain `T` value can only call value-receiver methods through an interface.

```go
type Stringer interface{ String() string }

type Big struct{ s string }
func (b *Big) String() string { return b.s }   // pointer receiver

var _ Stringer = &Big{}   // OK: *Big has String
var _ Stringer = Big{}    // COMPILE ERROR: Big's method set lacks String
```

The practical bite: people store values in a slice and try to use them as an interface.

```go
items := []Big{{"a"}}
var s Stringer = items[0]   // error: items[0] is a Big, not *Big
var s Stringer = &items[0]  // fix: take the address (slice elems are addressable)
```

Why the asymmetry exists: to call a pointer-receiver method, the runtime needs an address. When you hold an addressable variable, the compiler auto-takes `&` for you (`b.String()` works on a `Big` variable). But an interface stores a copy, and a copy isn't addressable, so the language can't synthesize the pointer — hence `T` doesn't satisfy an interface that needs `*T`. Store `*T` in interfaces and you sidestep the whole class of error.

### Q7. Explain structs, struct embedding, and how Go does composition instead of inheritance.

A struct is a fixed layout of named fields, laid out contiguously in memory (field order affects size due to alignment padding — group fields by size to shrink hot structs). Composition is the default: you build bigger types by *having* smaller ones as fields.

Embedding is composition with sugar. Put a type in a struct *without a field name* and its fields and methods are **promoted** — accessible as if they belonged to the outer type:

```go
type Logger struct{ prefix string }
func (l Logger) Log(msg string) { fmt.Println(l.prefix, msg) }

type Server struct {
    Logger        // embedded, no field name
    addr string
}

s := Server{Logger: Logger{prefix: "[srv]"}, addr: ":8080"}
s.Log("started")   // promoted: actually s.Logger.Log("started")
```

Crucially this is **not inheritance**. There's no subtype relationship — a `Server` is not a `Logger`, you can't pass it where a `Logger` is expected (you'd pass `s.Logger`). There's no virtual dispatch and no `super`. Promotion is purely a compile-time name-resolution convenience; the embedded value is still just a field you can name explicitly. If the outer type defines a method with the same name, it shadows the promoted one — and you call the inner explicitly via `s.Logger.Log(...)`. No polymorphism is happening.

Where embedding shines is satisfying interfaces by delegation: embed an interface or a type that already implements one, and the outer type satisfies it for free.

```go
type ReadCloser struct {
    io.Reader        // embed the interface
    io.Closer
}
```

The Go way is "accept interfaces, return structs," and use embedding to assemble behavior rather than to model "is-a" hierarchies. When you're tempted to build a base-class tree, the idiomatic move is instead small interfaces plus embedding for the shared mechanics — you get reuse without the fragile-base-class coupling that inheritance brings.

### Q8. What does `defer` actually do — evaluation time of arguments, LIFO order, and the loop-defer resource-leak trap?

`defer` schedules a function call to run when the *surrounding function* returns — whether by normal return, a later `return` statement, or a panic. Two precise rules. First, **arguments are evaluated immediately** when the `defer` statement executes; only the call itself is postponed. Second, deferred calls run in **LIFO** order — last deferred, first to run.

```go
func f() {
    x := 1
    defer fmt.Println("deferred:", x)  // captures x==1 NOW
    x = 2
    fmt.Println("body:", x)            // prints 2
}
// body: 2
// deferred: 1   <- argument was snapshotted at defer time
```

If you want to observe the *final* value, capture it in a closure with no args (`defer func(){ fmt.Println(x) }()`), which reads `x` at run time. This closure form is also how `defer` can modify *named* return values — `defer func(){ err = wrap(err) }()` works because the closure reads the named result at return time.

The classic trap: `defer` is scoped to the *function*, not the loop body. Deferring a `Close` inside a loop holds every resource open until the function returns:

```go
func bad(paths []string) error {
    for _, p := range paths {
        f, err := os.Open(p)
        if err != nil { return err }
        defer f.Close()        // BUG: all files stay open until bad() returns
        process(f)
    }
    return nil
}
```

With thousands of files you exhaust file descriptors. The fix is to give each iteration its own function scope so the `defer` fires per iteration:

```go
func good(paths []string) error {
    for _, p := range paths {
        if err := func() error {
            f, err := os.Open(p)
            if err != nil { return err }
            defer f.Close()    // fires when this closure returns, each iteration
            return process(f)
        }(); err != nil {
            return err
        }
    }
    return nil
}
```

`defer` is cheap in modern Go (1.14+ open-coded the common cases to near-zero cost), so don't avoid it for performance superstition — just keep it function-scoped and mind the argument-evaluation timing.

---

## Interfaces & Type System

### Summary

**What this topic covers** — Go's interface mechanism and the broader type system that grew up around it: how interfaces are laid out in memory, why satisfaction is implicit, the runtime cost of `any`, and how generics (added in Go 1.18) slot in alongside interfaces rather than replacing them. This is the conceptual core of idiomatic Go API design — the difference between code that composes cleanly and code that fights the language.

**Mental model** — An interface value is *not* a pointer to a thing; it's a two-word pair: a type descriptor and a data word. The first word answers "what concrete type is in here, and which methods does it have?" (the itable, which embeds the type's method set), and the second points to the actual value. This pairing explains almost every interface surprise: why a `nil`-typed interface differs from an interface boxing a nil pointer, why assigning a large struct to an interface allocates, why type assertions are a fast pointer comparison. Senior engineers think in terms of *method sets*: a type satisfies an interface iff its method set is a superset. Pointer receivers mean only `*T` satisfies, not `T`. Interfaces are consumer-defined contracts — you declare the interface where you *use* it, keeping it small, and the producer never imports it. Generics, by contrast, operate at compile time and erase to either a single shared shape or a few GC-shape stencils; they give you type safety without the boxing tax, but they're a different tool with different limits.

**Key terms**
- **Method set** — the set of methods callable on a type; determines interface satisfaction. `*T`'s set includes `T`'s.
- **itable (itab)** — runtime structure pairing a concrete type with an interface's method pointers; cached per (interface, concrete-type) pair.
- **Type descriptor (`_type`)** — runtime metadata describing a concrete type; the first word of an `any` value.
- **Data word** — second word of an interface value; holds or points to the concrete value.
- **Implicit satisfaction** — a type satisfies an interface by having the methods, with no `implements` declaration.
- **`any`** — Go 1.18 alias for `interface{}`; the empty interface, satisfied by everything.
- **Type assertion** — `x.(T)`; extracts the concrete type, optionally with comma-ok.
- **Type switch** — `switch v := x.(type)` ; dispatches on dynamic type.
- **Type parameter** — `[T any]`; a compile-time placeholder for a type in generic code.
- **Constraint** — an interface used to bound a type parameter; can include type sets via `~T | ~U`.
- **`comparable`** — built-in constraint for types usable with `==`/map keys.
- **`~T` (tilde / underlying type)** — matches any type whose underlying type is `T`.

**Why interviewers ask this** — Interfaces are where Go's "looks simple, has sharp edges" reputation lives. A junior describes interfaces as "like Java interfaces" and stops. A senior reaches for the two-word representation, predicts the nil-interface bug before you finish the sentence, and knows that returning `error` (an interface) holding a typed nil is the single most common production panic in Go. They'll also have a clear stance on generics-vs-interfaces — generics for containers and algorithms over `comparable`/`Ordered`, interfaces for behavior and polymorphism — rather than treating generics as a hammer. The signal is whether the candidate designs *consumer-side, narrow* interfaces and understands the runtime, not just the syntax.

**Common confusions**
- **"A function returning a nil `*MyError` as `error` returns nil."** No — the interface has a non-nil type word, so `err != nil` is true. Classic bug.
- **"Interfaces are reference types so passing one is free."** The data word may point at a heap copy; assigning a non-pointer to an interface can allocate.
- **"`any` is free / zero-cost."** Boxing into `any` can allocate and forces dynamic dispatch or assertions to get back out.
- **"Generics replace interfaces."** They're orthogonal; generics can't do dynamic dispatch or heterogeneous collections.
- **"You declare interfaces where the implementation lives."** Idiomatic Go declares them where they're consumed.
- **"A big interface is more useful."** The opposite: small interfaces compose; `io.Reader` is one method.

**What follows from this topic** — The nil-interface bug feeds directly into error handling (`errors.Is`/`errors.As` and typed-nil pitfalls). Method sets connect to value-vs-pointer semantics and to how `sync` types must not be copied. The "accept interfaces, return structs" rule shapes package design and testing (interfaces as seams for fakes). Generics tie into the standard `slices`/`maps` packages and performance work, where avoiding `any`-boxing matters for allocation profiles you'd see under pprof.

### Q9. How are interfaces represented at runtime (itable + data word)? Explain the "nil interface vs interface holding a nil pointer" bug.

An interface value is two machine words. For a non-empty interface (one with methods), the first word is a pointer to an **itab** — a structure that pairs the concrete dynamic type with the interface type and lays out the concrete type's method implementations in the order the interface expects. The second word is the **data pointer**: it points at the concrete value (or holds it inline only for word-sized pointer-shaped values; the compiler boxes everything else onto the heap). For `any` (empty interface), the first word is just the `*_type` descriptor since there are no methods to dispatch.

An interface is `nil` only when **both** words are zero. That's the whole bug. If you put a typed nil pointer into an interface, the type word is set (to `*MyError`, say) and only the data word is nil — so `iface == nil` is **false**.

```go
type MyError struct{}
func (*MyError) Error() string { return "boom" }

func do() error {
    var e *MyError = nil
    return e // returns a non-nil error! type word = *MyError
}

func main() {
    if err := do(); err != nil {
        fmt.Println("got error", err) // THIS FIRES, then panics on use
    }
}
```

The fix: return a literal `nil`, not a typed nil variable. Make the function return early with `return nil`, and only construct and return the concrete error on the failure path. Never declare `var err *MyError` and return it on success.

```go
func do() error {
    if ok() {
        return nil // untyped nil -> genuinely nil interface
    }
    return &MyError{}
}
```

Linters catch some of this (`nilness` in `go vet`'s extended analyzers, `staticcheck`), but the durable habit is: don't name a typed-pointer error variable that spans both success and failure paths. The itab itself is computed once per (interface, concrete-type) pair and cached, so the cost is amortized — but the nil trap has nothing to do with cost and everything to do with that type word being non-zero.

### Q10. Explain implicit interface satisfaction (structural typing) and why "accept interfaces, return structs" is idiomatic.

Go has no `implements` keyword. A type satisfies an interface purely by having the required method set — structural, duck-typed satisfaction checked at compile time. `os.File` satisfies `io.Reader` without ever importing `io.Reader` or declaring intent. This decouples producers from consumers: the package that *defines* `*os.File` doesn't know or care which interfaces exist, and a consumer can invent a new interface that existing types already satisfy.

That decoupling is exactly why interfaces belong on the **consumer** side. You declare the narrow interface where you need the behavior, listing only the methods you actually call. This keeps interfaces tiny and makes them trivial to fake in tests.

**Accept interfaces** — function parameters should be interfaces so callers can pass anything satisfying the contract: a real `*os.File`, a `bytes.Buffer`, a test fake. **Return structs** (concrete types) — returning an interface hides the concrete type's other methods, forces callers into type assertions to get them back, and creates the typed-nil trap from Q9.

```go
// Good: narrow consumer interface, concrete return.
type Store struct{ /* ... */ }
func NewStore(db *sql.DB) *Store { return &Store{} } // return concrete

type rowScanner interface { Scan(dest ...any) error } // declared here, used here
func (s *Store) load(r rowScanner) error { return r.Scan(/*...*/) }
```

The notable exception is `error`: it's an interface by necessity because implementations are heterogeneous. And constructors that genuinely produce one of several types (e.g. `crypto` hash constructors) may return interfaces. But the default — return the concrete struct, let the caller decide which interface to view it through — is what keeps Go APIs composable and discoverable (IDE autocomplete shows real methods, not an opaque interface).

### Q11. Type assertions vs type switches — syntax, the comma-ok form, and when each is appropriate.

A **type assertion** `x.(T)` extracts a concrete type (or another interface) from an interface value. The single-return form `v := x.(T)` **panics** if the dynamic type isn't `T`. The **comma-ok** form `v, ok := x.(T)` never panics — `ok` reports success and `v` is the zero value on failure.

```go
v, ok := r.(io.Closer)
if ok {
    v.Close()
}
```

Use the panicking form only when a failure is a genuine programmer error you want to surface loudly (rare, and usually a code smell). In production code reaching into `any`, use comma-ok essentially always.

A **type switch** dispatches across several possible dynamic types in one construct:

```go
switch v := x.(type) {
case nil:
    return "nil"
case int:
    return strconv.Itoa(v)        // v is int here
case fmt.Stringer:
    return v.String()             // v is fmt.Stringer here
default:
    return fmt.Sprintf("%v", v)   // v keeps x's static type
}
```

Reach for a **type switch** when you have three or more candidate types, or when you're walking a heterogeneous structure (an AST, a `json`-decoded `any`, an event union). Reach for a single **assertion** when you expect exactly one type, or you're probing for one optional capability — the `io.Closer` / `interface{ Unwrap() error }` pattern. Order matters in a type switch: more specific or interface cases should generally precede broader ones, and `case nil` must be explicit since a nil interface matches no concrete `case`. Note that listing multiple types in one `case int, int64:` leaves `v` with the *interface* type, not the concrete one — split them if you need the concrete value.

### Q12. What is the empty interface (`any`) and how do you reason about code that uses it? Costs and alternatives.

`any` is a Go 1.18 alias for `interface{}` — the interface with no methods, satisfied by every type. It's Go's escape hatch for genuinely heterogeneous data: `fmt.Println(args ...any)`, JSON decoding into `map[string]any`, `context.WithValue`. Use it when the set of types is open or unknown at the boundary.

Reasoning about `any`-heavy code means tracking two things: **what can actually be in here**, and **the cost of putting it there**. Boxing a value into `any` may allocate — non-pointer values get copied to the heap so the data word can point at them (small integers 0–255 and the empty struct are cached, but don't rely on that). Getting the value back out requires a type assertion or switch, which is dynamic dispatch, not a free cast. So `any` trades compile-time safety and allocation efficiency for flexibility. A hot loop that boxes into `[]any` will show up in pprof's alloc profile.

Alternatives, in rough order of preference:

| Need | Better than `any` |
|------|------|
| Same operation over many types | **Generics** (`[T any]`) — type-safe, no boxing |
| A fixed, known set of types | A small **interface** with the behavior, or a tagged union via interface |
| Decoding into known shape | A concrete struct with `json` tags, not `map[string]any` |
| "Maybe present" value | Concrete type + `ok` bool, not `any` |

The senior stance: `any` at API *boundaries* (serialization, logging, `context`) is fine; `any` threaded through your *domain* logic is usually a missing type parameter or a missing interface. Since 1.18, a lot of old `interface{}`-based containers (`sync.Map` aside) should be rewritten with generics. When you must use `any`, validate at the boundary with comma-ok and fail fast rather than letting an untyped value propagate.

### Q13. Explain Go generics: type parameters, constraints, the `comparable` constraint, and type inference.

Generics arrived in Go 1.18. A **type parameter** is a compile-time placeholder declared in square brackets: `func Map[T, U any](s []T, f func(T) U) []U`. Within the body, `T` and `U` are real types the compiler resolves at each call site.

A **constraint** is an interface used to bound what a type parameter may be. `any` means no constraint. Beyond method sets, constraints can specify **type sets** using union and the `~` tilde operator, where `~int` means "any type whose underlying type is `int`" (so your `type Celsius int` still matches):

```go
type Ordered interface {
    ~int | ~int64 | ~float64 | ~string // (abbreviated; see golang.org/x/exp/constraints)
}
func Max[T Ordered](a, b T) T {
    if a > b { return a }
    return b
}
```

`comparable` is a built-in constraint for types usable with `==` and `!=` — required for map keys and set membership. Since Go 1.20, `comparable` also admits interface types (which compare at runtime and can panic if the dynamic type isn't comparable), a subtle relaxation; for strict compile-time guarantees you sometimes still want a narrower constraint.

**Type inference** lets you usually omit the type arguments: `Max(3, 5)` infers `T = int` from the arguments. Inference flows from function arguments to type parameters; it does *not* infer from the return type or from constraint type sets. When inference fails — common with `Map` where `U` only appears in the function value's return — you supply arguments explicitly: `Map[int, string](xs, strconv.Itoa)`. The standard library now ships `slices` and `maps` (1.21) built on this: `slices.Sort`, `slices.Contains`, `maps.Keys`. Reach for those before hand-rolling. Implementation note: the compiler uses **GC-shape stenciling** — it generates one instantiation per distinct memory layout, so all pointer types share a stencil; this is neither full monomorphization nor full type erasure, and it has measurable (usually small) call overhead versus a hand-written concrete function.

### Q14. When should you use generics vs interfaces? What can generics NOT do (e.g. no method-level type params, no specialization)?

Use **interfaces** for *behavior and runtime polymorphism*: heterogeneous collections, plugin points, "accept interfaces" parameters, anything needing dynamic dispatch where the concrete type is decided at runtime. Use **generics** for *type-safe code reused across types* where the type is fixed at each call site: containers (`Stack[T]`, `Set[T]`), algorithms over `Ordered`/`comparable`, and eliminating `any`-boxing in hot paths.

The deciding question: *does the calling code need to mix different concrete types in one variable/slice at runtime?* If yes, you need an interface (`[]Shape`). If every call site uses one known type and you just don't want to write the function N times, generics. A `[]io.Reader` must be interfaces; a generic `Filter[T]` works on whatever `T` the caller picks but each call is one `T`.

What Go generics **cannot** do — important to state plainly in an interview:

- **No method-level type parameters.** A method cannot introduce its own type parameter beyond the receiver's. `func (s Set[T]) Map[U any](...)` does **not** compile. This kills fluent `Map().Filter()` chains; you write package-level functions instead. It exists because allowing it complicates interface satisfaction and the type system.
- **No specialization.** You cannot provide a faster implementation for a specific type the way C++ template specialization does. One generic body serves all instantiations; if `T == string` needs special handling, branch with a type switch inside, or write a separate function.
- **No covariance.** `Stack[Cat]` is not a `Stack[Animal]`; type parameters are invariant.
- **No metaprogramming / reflection over type params at runtime** beyond what ordinary reflection gives the boxed values.
- **Constraints can't require operators selectively** — you express arithmetic capability via type sets (`~int | ~float64`), not "any type supporting `+`".

Default to interfaces for APIs (they keep the language's composition story intact) and add generics where you'd otherwise duplicate code or box into `any`. Don't genericize speculatively — a single concrete type doesn't need a type parameter.

### Q15. Interface embedding and the io.Reader/io.Writer composition story — why small interfaces win.

An interface can **embed** other interfaces, and its method set becomes the union. The `io` package is the canonical demonstration:

```go
type Reader interface { Read(p []byte) (n int, err error) }
type Writer interface { Write(p []byte) (n int, err error) }
type Closer interface { Close() error }

type ReadWriter   interface { Reader; Writer }
type ReadCloser   interface { Reader; Closer }
type ReadWriteCloser interface { Reader; Writer; Closer }
```

`io.Reader` and `io.Writer` are each **one method**. That smallness is the entire point. Because satisfaction is structural, any type with a `Read` method *is* a `Reader` — files, network conns, `bytes.Buffer`, `strings.Reader`, gzip streams, HTTP bodies. And because the interface is tiny, generic plumbing composes across all of them: `io.Copy(dst Writer, src Reader)` moves bytes between *any* source and *any* sink without knowing what they are. `io.TeeReader`, `bufio.NewReader`, `gzip.NewWriter` all wrap a `Reader`/`Writer` and return one — decorators that stack arbitrarily.

The principle, sometimes phrased as the interface-segregation half of "the bigger the interface, the weaker the abstraction" (Rob Pike): a one-method interface is satisfied by almost everything and composes with almost everything; a ten-method interface is satisfied by almost nothing and forces fakes to stub ten methods in tests. Small interfaces are *more* powerful precisely because they demand less.

Practical consequences: declare interfaces with the fewest methods your consumer needs (often one or two), and **build bigger contracts by embedding** rather than defining fat interfaces from scratch. When a function only reads, take an `io.Reader`, not `*os.File` — you instantly gain testability (pass a `strings.NewReader`) and reach (anyone's `Reader` works). This is the structural-typing payoff from Q10 made concrete: small + implicit + embeddable is why Go's I/O ecosystem interoperates as well as it does.

---

## Concurrency

### Summary

**What this topic covers** — This topic is about Go's flagship feature: concurrency built into the language via goroutines, channels, `select`, and the `context` package, backed by the `sync` package for shared-memory coordination. It covers the cost model of goroutines versus OS threads, the semantics of channels (buffered, unbuffered, closed), cancellation propagation, the classic concurrency patterns (worker pools, fan-out/fan-in, pipelines), how goroutines leak, and the guarantees the memory model and race detector give you. The thread running through all of it is that concurrency is cheap to spawn but easy to get subtly wrong, and the discipline is in cleanup and synchronization, not in starting work.

**Mental model** — Hold two layers in your head. The bottom layer is the runtime scheduler: an M:N model where many goroutines (G) are multiplexed onto a small set of OS threads (M) via logical processors (P, count = `GOMAXPROCS`). Goroutines are cooperatively-then-preemptively scheduled green threads with a tiny 2 KB starting stack that grows on demand. The top layer is the programming model: you reason about *ownership* of data. At any instant, exactly one goroutine should own a piece of mutable state. Channels transfer ownership — when you send a value, you hand it off and stop touching it. `sync.Mutex` is the alternative: instead of moving data between goroutines, you let the data sit still and serialize access to it. The senior instinct is: who owns this, when does the owning goroutine exit, and what wakes it up? Every goroutine you start needs an answer to "how does this end" — a closed channel, a cancelled context, or a finite loop. Leaks happen when that answer is "never."

**Key terms**
- **Goroutine** — a lightweight, runtime-scheduled function invocation started with `go f()`.
- **GOMAXPROCS** — number of OS threads that can run Go code simultaneously; defaults to `NumCPU`.
- **Unbuffered channel** — capacity 0; send and receive rendezvous synchronously.
- **Buffered channel** — capacity N; send blocks only when the buffer is full.
- **`select`** — multiplexes over multiple channel operations; blocks until one is ready.
- **`context.Context`** — carries cancellation, deadlines, and request-scoped values across API boundaries.
- **Happens-before** — the partial order the memory model uses to define when one goroutine's write is visible to another.
- **Data race** — concurrent unsynchronized access to the same memory where at least one is a write; undefined behavior.
- **Goroutine leak** — a goroutine that never terminates, holding memory and stack indefinitely.
- **`sync.WaitGroup`** — counter to wait for a set of goroutines to finish.
- **`sync.Once`** — guarantees a function runs exactly once across goroutines.
- **Fan-out/fan-in** — splitting work across many goroutines, then merging results into one channel.

**Why interviewers ask this** — Concurrency is where Go candidates separate themselves. A junior can spawn a goroutine and send on a channel; a senior knows where the bodies are buried. The signal interviewers hunt for: do you treat every `go` statement as a lifecycle you must close out, or do you fire-and-forget? Do you reach for a channel when a mutex is simpler, or vice versa? Can you explain *why* an unbuffered send blocks rather than just stating it does? Do you know that `context` cancellation is cooperative — nothing is force-killed? Strong candidates discuss goroutine leaks unprompted, reach for `-race` reflexively, and can reason about happens-before instead of "it worked on my machine." Weak candidates over-use channels for everything, share mutable state without synchronization, and assume goroutines clean themselves up.

**Common confusions**
- **"Channels are always the right tool."** They model ownership transfer and signaling; for protecting a shared counter or map, a `Mutex` is simpler and faster.
- **"A goroutine stops when its parent function returns."** It does not — goroutines are independent of their spawner's stack; the parent returning is exactly how leaks happen.
- **"Buffered channels are non-blocking."** They block when full on send and when empty on receive.
- **"Closing a channel cancels the receivers."** Closing signals "no more values"; receivers drain remaining buffered values and then get the zero value.
- **"The race detector proves correctness."** It only flags races on code paths actually executed at runtime; an untriggered race goes unseen.

**What follows from this topic** — Concurrency feeds directly into the **context** and HTTP-server topics (every handler runs in its own goroutine with a request-scoped context), into **error handling** (propagating errors out of worker pools with `errgroup`), and into **performance and profiling** (goroutine dumps, the scheduler trace, contention profiles). It also underpins the **runtime/GC** discussion, since goroutine stacks and `GOMEMLIMIT` interact under load.

### Q16. Goroutines vs OS threads — what is the cost, and what does "do not communicate by sharing memory; share memory by communicating" mean in practice?

A goroutine starts with a ~2 KB stack that grows and shrinks on demand, versus an OS thread's fixed 1–8 MB stack reserved up front. Creation and context-switching are handled by the Go runtime in user space, so switching between goroutines doesn't require a kernel trap. That's why spawning hundreds of thousands of goroutines is routine, while hundreds of thousands of OS threads would exhaust memory and crush the kernel scheduler.

The runtime uses an M:N scheduler: G (goroutines) multiplexed onto M (OS threads) through P (logical processors, `GOMAXPROCS` of them). When a goroutine makes a blocking syscall, the runtime can detach the M and hand the P to another thread so other goroutines keep running. So goroutines are cheap, but not free — each still costs stack memory, and a million live goroutines is still a lot of RAM and scheduler pressure.

The proverb means: instead of having two goroutines poke at the same variable behind a lock, have one goroutine *own* the data and hand values to others over a channel. Ownership moves with the value, so at any moment only one goroutine touches it — the synchronization is implicit in the channel send/receive.

```go
// share memory by communicating: one owner, hand off via channel
results := make(chan int)
go func() {
    results <- expensiveComputation() // producer owns it until send
}()
v := <-results // consumer now owns v
```

In practice it's not dogma. Protecting a shared cache or counter with a `sync.Mutex` is the right call — channels there add latency and complexity. The senior reading is: use channels for *transferring ownership and signaling*, use mutexes for *guarding state that stays put*.

### Q17. Explain channels: buffered vs unbuffered, send/receive semantics, and what closing a channel does.

A channel is a typed conduit. `make(chan T)` is unbuffered (capacity 0); `make(chan T, n)` is buffered with capacity `n`.

On an **unbuffered** channel, send and receive are a rendezvous: the sender blocks until a receiver is ready, and vice versa. The handoff is synchronous — when the send completes, you know a receiver has taken the value. That makes unbuffered channels a synchronization primitive, not just a queue.

On a **buffered** channel, a send succeeds immediately as long as the buffer has room; it blocks only when the buffer is full. A receive succeeds while the buffer has values and blocks when empty. Buffering decouples sender and receiver timing but gives you a weaker guarantee: a successful send means "it's in the buffer," not "someone received it."

| Operation | Unbuffered | Buffered (cap n) |
|---|---|---|
| Send blocks when | no receiver ready | buffer full |
| Receive blocks when | no sender ready | buffer empty |
| Send on closed | panic | panic |
| Receive on closed | zero value, `ok=false` | drains buffer, then zero value |

**Closing** a channel with `close(ch)` signals "no more values will be sent." Receivers can still drain any buffered values, then receive the zero value with `ok == false`. The two-value receive `v, ok := <-ch` and `range` over a channel both detect closure cleanly.

```go
close(ch)
v, ok := <-ch // ok == false once drained → channel closed
for v := range ch { /* loops until ch is closed and drained */ }
```

Rules that bite people: sending on a closed channel **panics**, closing an already-closed channel **panics**, closing a `nil` channel **panics**. Send/receive on a `nil` channel block forever (useful for disabling a `select` case). Convention: the **sender** closes, never the receiver, and only one goroutine should own closing. If multiple senders exist, coordinate closure separately (e.g. a `sync.WaitGroup` plus a single closer goroutine).

### Q18. The `select` statement — how it works, default case, and how to implement timeouts.

`select` waits on multiple channel operations and proceeds with whichever is ready. If several are ready simultaneously, it picks one **at random** — that fairness prevents starvation. If none is ready, `select` blocks until one becomes ready.

```go
select {
case v := <-in:
    handle(v)
case out <- result:
    // sent
}
```

Add a `default` case and `select` becomes non-blocking: if nothing else is ready, `default` runs immediately. That's how you do a non-blocking send or receive (try, but don't wait).

```go
select {
case v := <-ch:
    use(v)
default:
    // nothing available right now, move on
}
```

For **timeouts**, race the real work against `time.After`, which returns a channel that fires once after the duration:

```go
select {
case res := <-work:
    return res, nil
case <-time.After(2 * time.Second):
    return zero, errTimeout
}
```

Two cautions. First, `time.After` allocates a `Timer` that isn't collected until it fires; in a hot loop or a long-lived `select`, create a `time.NewTimer` once and reset/stop it, or prefer a `context` deadline. Second, prefer `ctx.Done()` over `time.After` when the deadline is request-scoped — it composes with the rest of your cancellation chain:

```go
select {
case res := <-work:
    return res, nil
case <-ctx.Done():
    return zero, ctx.Err() // context.DeadlineExceeded or Canceled
}
```

A `select{}` with no cases blocks forever — occasionally used to park `main` while background goroutines run.

### Q19. How do you signal cancellation across goroutines? Explain the `context` package and context propagation.

`context.Context` is Go's standard cancellation and deadline mechanism. The core idea: a `Context` carries a `Done()` channel that closes when the operation should stop, plus an `Err()` explaining why (`context.Canceled` or `context.DeadlineExceeded`). Cancellation is **cooperative** — closing `Done()` doesn't kill anything; each goroutine must watch `ctx.Done()` and return on its own.

You build a tree from `context.Background()`:

```go
ctx, cancel := context.WithCancel(parent)
ctx, cancel := context.WithTimeout(parent, 5*time.Second)
ctx, cancel := context.WithDeadline(parent, t)
defer cancel() // always — releases resources, prevents leak
```

Cancelling a parent cancels all descendants. The convention is to pass `ctx` as the **first parameter** of every function that does I/O or spawns work, never store it in a struct, and never pass `nil` (use `context.TODO()` if you genuinely don't have one yet).

A worker watches `Done()` in its `select` and bails out:

```go
func worker(ctx context.Context, jobs <-chan Job) error {
    for {
        select {
        case <-ctx.Done():
            return ctx.Err()
        case j, ok := <-jobs:
            if !ok { return nil }
            process(ctx, j)
        }
    }
}
```

`context.WithValue` carries request-scoped values (trace IDs, auth) — use sparingly and only for cross-cutting request data, never for optional function parameters; an untyped value bag is an anti-pattern. The single most common bug is forgetting `defer cancel()`: the timer and the context node leak until the deadline fires. `go vet` flags this as a lostcancel warning. For propagating cancellation *and* errors across a group of goroutines, reach for `golang.org/x/sync/errgroup`, whose `Group` cancels the shared context when the first worker returns an error.

### Q20. sync primitives: Mutex vs RWMutex, sync.Once, sync.WaitGroup — when to reach for sync over channels.

`sync.Mutex` gives mutual exclusion: `Lock()`/`Unlock()` around a critical section. Use it to guard state that stays in place — a map, a counter, a cache. Pattern: lock, mutate, unlock, ideally with `defer mu.Unlock()` right after `Lock()`.

`sync.RWMutex` adds `RLock()`/`RUnlock()` for readers. Many readers can hold it concurrently, but a writer is exclusive. It's a win only when reads vastly outnumber writes *and* the critical section is non-trivial — `RWMutex` has higher overhead than `Mutex`, so for short sections a plain `Mutex` is often faster. Measure, don't assume.

`sync.Once` runs a function exactly once regardless of how many goroutines call it — the canonical lazy-init / singleton tool. Go 1.21 added `sync.OnceFunc`, `OnceValue`, and `OnceValues` as ergonomic wrappers.

```go
var once sync.Once
var conn *DB
func get() *DB {
    once.Do(func() { conn = connect() })
    return conn
}
```

`sync.WaitGroup` waits for a set of goroutines to finish: `Add(n)` before starting, `Done()` (deferred) in each, `Wait()` to block. The classic bug is calling `Add` *inside* the goroutine — by the time it runs, `Wait` may already have returned. Always `Add` before `go`.

```go
var wg sync.WaitGroup
for _, item := range items {
    wg.Add(1)
    go func(it Item) { defer wg.Done(); process(it) }(it)
}
wg.Wait()
```

(Note: as of Go 1.22 the loop variable is per-iteration, so the `it` parameter is no longer strictly necessary, but it's still common and harmless.)

When to choose `sync` over channels: when you're protecting *shared state that stays put* rather than transferring ownership; when performance matters and the channel rendezvous overhead is wasteful; for one-shot init (`Once`) and joins (`WaitGroup`) where channels would be clumsy. Reach for channels when you're moving data between goroutines or signaling events. Also remember: a `sync.Mutex` copied after first use is a bug — `go vet` catches it via the `noCopy` pattern. For lock-free counters, `sync/atomic` (and the typed `atomic.Int64` etc. from Go 1.19) beats a mutex.

### Q21. Explain common channel patterns: fan-out/fan-in, worker pools, pipelines, and the done-channel pattern.

**Pipeline**: stages connected by channels, each stage a goroutine that ranges over its input and sends to its output, closing its output when its input is drained.

```go
func gen(nums ...int) <-chan int {
    out := make(chan int)
    go func() { defer close(out); for _, n := range nums { out <- n } }()
    return out
}
func sq(in <-chan int) <-chan int {
    out := make(chan int)
    go func() { defer close(out); for n := range in { out <- n * n } }()
    return out
}
// gen → sq → consume
for v := range sq(gen(2, 3, 4)) { fmt.Println(v) }
```

**Fan-out/fan-in**: fan-out is starting multiple goroutines reading from the *same* input channel to parallelize a slow stage; fan-in merges their outputs back into one channel using a `WaitGroup` to know when all sources are done before closing the merged channel.

```go
func merge(cs ...<-chan int) <-chan int {
    out := make(chan int)
    var wg sync.WaitGroup
    for _, c := range cs {
        wg.Add(1)
        go func(c <-chan int) { defer wg.Done(); for v := range c { out <- v } }(c)
    }
    go func() { wg.Wait(); close(out) }() // close only after all senders done
    return out
}
```

**Worker pool**: a fixed number of workers draining a shared `jobs` channel, writing to a `results` channel. This bounds concurrency — you control parallelism by worker count instead of spawning one goroutine per job, which protects downstream resources (DB connections, file handles).

```go
jobs := make(chan Job)
results := make(chan Result)
for i := 0; i < 8; i++ {
    go func() { for j := range jobs { results <- do(j) } }()
}
```

**Done-channel pattern**: pass a `done <-chan struct{}` (or `ctx.Done()`) into every stage and `select` on it in each send, so closing `done` unwinds the whole pipeline and prevents leaks when the consumer stops early. In modern code `context` has largely superseded the hand-rolled done channel, but the principle — give every goroutine an escape hatch — is identical. The senior point: fan-in's `close` must happen *after* `wg.Wait`, never per-source, or you'll send on a closed channel and panic.

### Q22. What is a goroutine leak? Show how an abandoned goroutine blocked on a channel leaks, and how to prevent it.

A goroutine leak is a goroutine that never returns — it's blocked forever on a channel send/receive, a mutex, or an infinite loop with no exit. Unlike memory the GC reclaims, a blocked goroutine is *reachable* (the runtime holds it), so its stack and any captured variables are never freed. Leaks accumulate silently until you OOM or the scheduler bogs down.

The classic leak: a producer sends on an unbuffered channel, but the consumer leaves early (timeout, error, early return). The send blocks forever because no one will ever receive.

```go
// LEAK: if the caller returns on timeout, this goroutine blocks on send forever
func search(query string) string {
    ch := make(chan string)
    go func() {
        ch <- httpGet(query) // blocks forever if no receiver
    }()
    select {
    case r := <-ch:
        return r
    case <-time.After(time.Second):
        return "" // consumer leaves; goroutine above leaks
    }
}
```

Two standard fixes. **Buffer the channel** so the orphaned send always succeeds and the goroutine can exit:

```go
ch := make(chan string, 1) // send never blocks → goroutine completes and is collected
```

Or **propagate cancellation** via context so the goroutine itself bails:

```go
func search(ctx context.Context, query string) (string, error) {
    ch := make(chan string, 1)
    go func() { ch <- httpGet(ctx, query) }() // ctx-aware get returns on cancel
    select {
    case r := <-ch:
        return r, nil
    case <-ctx.Done():
        return "", ctx.Err()
    }
}
```

Detecting leaks: `runtime.NumGoroutine()` trending up under steady load is the smell. `pprof`'s goroutine profile (`go tool pprof http://.../debug/pprof/goroutine`, or `?debug=2` for full stacks) shows *where* they're parked — clusters blocked on the same channel op point straight at the leak. In tests, `go.uber.org/goleak` fails any test that finishes with stray goroutines. The discipline: every `go` statement needs a defined termination — a buffered channel, a closed channel, or a cancelled context.

### Q23. Explain the Go memory model and happens-before. What does the race detector catch and what does it miss?

The Go memory model defines when a read in one goroutine is guaranteed to observe a write from another. The key relation is **happens-before**: a partial order over memory operations. If event A happens-before event B, then A's effects are visible to B. Within a single goroutine, program order gives happens-before. Across goroutines you need a **synchronization point** to establish it.

The guaranteed edges: a channel send happens-before the corresponding receive completes; closing a channel happens-before a receive that returns zero-because-closed; a receive from an unbuffered channel happens-before the send completes (the rendezvous). `sync.Mutex.Unlock` happens-before a subsequent `Lock`. The `go` statement happens-before the goroutine starts; a goroutine's exit does *not* synchronize with anything unless you add a `Wait` or channel. `sync/atomic` operations and `sync.Once.Do` also establish ordering. Without one of these, the runtime and compiler are free to reorder and cache, and concurrent access is a **data race** — undefined behavior, not just "stale read."

```go
// DATA RACE: no happens-before edge between the writer and main's read
var done bool
go func() { done = true }() // write
for !done {} // read — may loop forever; compiler may hoist the read
```

The fix is a real synchronization primitive — a channel, a mutex, or `atomic.Bool` — not a `time.Sleep`.

The **race detector** (`go test -race`, `go run -race`) instruments memory accesses and reports a race when two goroutines touch the same address without an intervening happens-before edge and at least one writes. It's precise — almost no false positives — and the single best tool you have. Run it in CI.

What it **misses**: it only sees races on code paths *actually executed* during the run. A race in a branch your test never hits is invisible. It does not detect deadlocks (the runtime's `all goroutines are asleep` panic catches only total deadlock), goroutine leaks, or logical races like check-then-act on a map even when each op is individually locked. It also has real cost — ~5–10x CPU and memory — so it's a testing tool, not a production setting. The takeaway: `-race` proves the presence of races on exercised paths, never their absence.

---

## Goroutines & Scheduler

### Summary

**What this topic covers** — This topic is about how Go runs concurrent work. A goroutine is a lightweight, runtime-managed coroutine; the *scheduler* multiplexes potentially millions of goroutines onto a small pool of OS threads. We cover the GMP model (the data structures the scheduler manipulates), how work is distributed and how goroutines get preempted, what happens when a goroutine blocks in a syscall versus on the network, why goroutine stacks are cheap, and how you actually observe scheduler behaviour in production. This is runtime internals, but the practical payoff is reasoning about latency, throughput, and pathological CPU/blocking behaviour.

**Mental model** — Carry three letters: `G`, `M`, `P`. A `G` is a goroutine (its stack, instruction pointer, and bookkeeping). An `M` is a machine — a real OS thread. A `P` is a processor, a *scheduling context* that holds a run queue of runnable `G`s and the resources needed to execute Go code. The invariant: to run Go code, an `M` must hold a `P`. The number of `P`s is fixed at `GOMAXPROCS` (defaults to logical CPU count), so that's your ceiling on goroutines executing Go code *simultaneously*. `M`s are created on demand and can outnumber `P`s — many are parked or blocked in syscalls. The scheduler's job is to keep every `P` busy: when a `P`'s local queue empties, its `M` steals work from another `P` or the global queue. Blocking syscalls detach the `M` so the `P` can be handed to another thread. Network I/O doesn't block an `M` at all — it parks the `G` on the netpoller. Internalize "P is the permit to run, and there are exactly GOMAXPROCS permits."

**Key terms**
- **G (goroutine)** — A user-space coroutine: stack, PC, status. Cheap to create (~few KB).
- **M (machine)** — An OS thread. Runs Go code only while holding a `P`.
- **P (processor)** — Scheduling context with a local run queue; count = `GOMAXPROCS`.
- **GOMAXPROCS** — Max `P`s, i.e. max goroutines executing Go code in parallel.
- **Local run queue** — Per-`P` queue (256 slots) of runnable `G`s, lock-free for the owner.
- **Global run queue** — Shared queue, lock-protected; overflow + fairness backstop.
- **Work-stealing** — An idle `P` steals half of another `P`'s local queue.
- **Handoff** — Detaching a `P` from an `M` blocked in a syscall so another `M` can run it.
- **Netpoller** — Runtime epoll/kqueue integration; parks `G`s on network/file readiness.
- **Async preemption** — Since 1.14, signal-based interruption of long-running `G`s.
- **sysmon** — Background monitor thread; triggers preemption, retakes `P`s, forces GC.
- **GOMAXPROCS pinning** — `runtime.LockOSThread` binds a `G` to its `M` (cgo, OpenGL).

**Why interviewers ask this** — Concurrency is Go's headline feature, so "I use goroutines" is table stakes. The signal interviewers want is whether you understand the *cost model* and *failure modes*. A junior says goroutines are "free, just spin up a million." A senior knows they're cheap but not free (stack memory, scheduler pressure), knows that `GOMAXPROCS` caps parallelism but not concurrency, and can explain why a tight CPU loop with no function calls could wedge the scheduler before 1.14. The strongest signal is connecting the model to observable symptoms: "p99 latency spiked, schedtrace showed run-queue depth climbing, so we were CPU-bound, not lock-bound." If you can reason from GMP to a pprof profile to a fix, you're operating at the level they're hiring for.

**Common confusions**
- **"GOMAXPROCS limits the number of goroutines."** No — it limits `P`s, i.e. parallel *execution* of Go code. You can have millions of goroutines with `GOMAXPROCS=1`.
- **"A blocking syscall blocks all other goroutines."** No — the runtime hands off the `P` so other `G`s keep running on a different `M`.
- **"Goroutines map 1:1 to threads."** They're M:N multiplexed; `M`s are created lazily and reused.
- **"Goroutine stacks are fixed at 8KB."** They start at ~2KB (since 1.4) and grow/shrink by copying.
- **"Pre-1.14 you needed `runtime.Gosched()` everywhere."** Only for tight loops with no preemption points; async preemption mostly fixed this.

**What follows from this topic** — Once you understand the scheduler, channel and `select` semantics make sense as ways to park and wake `G`s. The `context` package's cancellation propagates by signalling goroutines you've launched. The memory model and `sync` primitives govern what those concurrently-scheduled `G`s can safely observe. And GC behaviour interacts with scheduling via stop-the-world phases and `GOMEMLIMIT` — the same `sysmon` that preempts goroutines also forces GC. Profiling (pprof, the execution tracer) is how you see all of this in motion.

### Q24. Explain the GMP model (G, M, P). What are P count (GOMAXPROCS) and run queues?

The scheduler manipulates three structures. `G` is a goroutine: its stack, program counter, and status (`_Grunnable`, `_Grunning`, `_Gwaiting`, etc.). `M` is an OS thread — the thing the kernel actually schedules onto a CPU. `P` is a *processor*, a logical scheduling context. The hard rule: **an `M` must own a `P` to execute Go code.**

`GOMAXPROCS` sets the number of `P`s, defaulting to `runtime.NumCPU()`. That's your parallelism ceiling — at most `GOMAXPROCS` goroutines run Go code at the same instant. It is *not* a limit on goroutine count or on concurrency. With `GOMAXPROCS=1` you can still have a million live goroutines; they just take turns on one `P`.

Each `P` owns a **local run queue** of runnable `G`s — a 256-entry ring buffer the owning `M` accesses without locks (fast path). There's also a single **global run queue**, protected by a lock, used for overflow when a local queue fills and as a fairness mechanism. When a goroutine becomes runnable (e.g. unblocked on a channel), it's pushed to a local queue; the next `runnext` slot gives a just-woken `G` priority to improve locality and latency.

```go
runtime.GOMAXPROCS(0)   // returns current value without changing it
runtime.NumGoroutine()  // live goroutine count — unrelated to GOMAXPROCS
```

One subtlety worth raising: in containerized environments, `NumCPU` historically reported host cores, not the cgroup CPU limit, so `GOMAXPROCS` could be wildly too high under Kubernetes. The community fix is `uber-go/automaxprocs`; Go 1.25 makes the runtime cgroup-aware natively. Mentioning that shows you've run Go in production, not just on a laptop.

### Q25. How does the Go scheduler do work-stealing and preemption (async preemption since 1.14)?

**Work-stealing** keeps `P`s busy. When a `P`'s local queue empties, its `M` doesn't park immediately — it tries to find work: first check the global queue periodically, then poll the netpoller, then **steal half** the runnable `G`s from a randomly chosen victim `P`'s local queue. Stealing half (not one) amortizes the cost and spreads load. Only after a few failed steal rounds does the `M` park. This is why Go scales reasonably across cores without you doing anything — load balancing is automatic.

**Preemption** is how a `G` gives up its `P` so others can run. There are cooperative preemption points the compiler inserts at function *prologues* (a stack-bounds check that doubles as a preemption check). That covers most code, because most code calls functions. The classic pre-1.14 failure: a tight loop with *no* function calls and no allocation never hit a preemption point, so it could starve other goroutines — under `GOMAXPROCS=1` it could hang the program, and it delayed stop-the-world GC.

```go
// Pre-1.14: this could wedge the scheduler under GOMAXPROCS=1.
for {
    // pure arithmetic, no calls — no cooperative preemption point
}
```

**Async preemption** (Go 1.14) fixed this. `sysmon`, a dedicated runtime monitor thread, notices a `G` that's been running longer than ~10ms and sends the `M` a signal (`SIGURG` on Unix). The signal handler safely interrupts the goroutine at a point where registers/stack are in a known state and reschedules it. So you almost never need `runtime.Gosched()` anymore. Caveat: async preemption can't interrupt a goroutine inside a blocking syscall or one holding the OS thread via `LockOSThread` — and `GODEBUG=asyncpreemptoff=1` disables it, which is occasionally a useful debugging knob when chasing signal-related bugs in cgo.

### Q26. What happens to an M when a goroutine makes a blocking syscall? Explain handoff and netpoller integration.

It depends on the kind of "blocking," and this distinction is the whole point of the answer.

**A genuine blocking syscall** (e.g. a blocking file read, or a cgo call). Before entering the syscall, the runtime calls `entersyscall`, which *releases the `P`* from the current `M`. The `M` is now blocked in the kernel with the `G` attached, but the `P` is free. `sysmon` (or the handoff path) gives that `P` to another `M` — waking a parked one or spinning up a new one — so the remaining goroutines keep executing. This is **handoff**. When the syscall returns, the `M` tries to reacquire a `P`; if none is free, it parks its `G` on the global queue and the `M` itself goes idle. The cost: you can end up with more `M`s than `P`s. A program doing thousands of concurrent blocking syscalls can spawn thousands of OS threads.

**Network I/O does not block an `M` at all.** Go's net package sets sockets non-blocking and registers them with the **netpoller** — `epoll` on Linux, `kqueue` on BSD/macOS, IOCP on Windows. When you call `conn.Read` and there's no data, the runtime parks the `G` (status `_Gwaiting`) and the `M` goes off to run other goroutines. The scheduler polls the netpoller (in its find-work loop and in `sysmon`); when the socket is readable, the corresponding `G` is marked runnable and pushed back onto a run queue. So a server handling 100k idle connections costs 100k cheap goroutines, *not* 100k threads.

The practical implication: network-heavy services scale beautifully; syscall-heavy or cgo-heavy services (lots of blocking disk I/O, calls into C) can quietly accumulate threads. Watch the `threads` count in `runtime/metrics` (`/sched/threads:threads` conceptually, or just `pprof` goroutine/threadcreate profiles). If thread count balloons, you're hitting real blocking syscalls, and the fix is usually bounding concurrency or moving work to async APIs.

### Q27. Goroutine stacks: how do growable/segmented stacks work, and why are they cheap to spawn?

A goroutine starts with a tiny stack — **~2KB** since Go 1.4. Compare that to an OS thread's stack, typically 1–8MB reserved. That alone is why you can have a million goroutines: a million × 2KB is ~2GB of *address* space, growing only as needed, versus a million threads being completely infeasible.

The mechanism is **contiguous, copying stacks** (since 1.4 — the older *segmented* stack design was abandoned because of a "hot split" problem where a loop crossing a segment boundary thrashed). Each function prologue includes a stack-bounds check. If the goroutine needs more stack than it has, the runtime allocates a new, larger stack (doubling), **copies** the old stack's contents over, fixes up pointers into the stack, and frees the old one. Because Go knows where every pointer is (it's a precise, managed runtime), it can rewrite stack-internal pointers safely. Stacks can also *shrink* during GC if a goroutine is using far less than allocated.

```go
// Spawning is cheap, but not free — each G still costs stack + scheduler bookkeeping.
for i := 0; i < 1_000_000; i++ {
    go func() { <-ch }()  // ~2KB each + runtime overhead
}
```

So "cheap to spawn" means: small initial allocation, no kernel involvement (creating a `G` is a user-space operation, no `clone()` syscall), and amortized growth. The cost you *do* pay: the copy on growth (rare, amortized), GC has to scan every goroutine's stack (so a million goroutines means a million stacks to scan — this is a real GC cost), and the scheduler bookkeeping. The senior nuance: goroutines are cheap enough that the bug is usually *leaking* them — a goroutine blocked forever on a channel never gets collected, because it's still "reachable" via the runtime. Always have a cancellation path (`context`) or a bounded worker pool rather than unbounded `go`.

### Q28. How do you observe scheduler behaviour — GODEBUG=schedtrace, runtime metrics, and what to look for under contention?

Start with `GODEBUG=schedtrace=N`, which prints a scheduler summary every `N` milliseconds, no code changes needed:

```
GODEBUG=schedtrace=1000 ./server
SCHED 1003ms: gomaxprocs=8 idleprocs=0 threads=23 spinningthreads=1 idlethreads=4 runqueue=42 [5 3 8 ...]
```

Read it like this: `idleprocs=0` with a growing `runqueue` (global) and growing per-`P` numbers in the brackets means **you're CPU-bound** — more runnable goroutines than `P`s can execute. If `runqueue` is deep and stays deep, throwing more goroutines at the problem won't help; you need more cores, less work, or to fix a hot path. A high and climbing `threads` count points at **blocking syscalls / cgo** (per Q26). `spinningthreads` is normal in small numbers. Adding `scheddetail=1` gives per-G/per-P/per-M breakdowns when you need to go deep.

For programmatic observation, prefer the structured `runtime/metrics` package over the older `runtime.ReadMemStats`. It exposes scheduler-relevant series like `/sched/latencies:seconds` (a histogram of how long goroutines wait between runnable and running — *this is the scheduling-latency smoking gun*), `/sched/goroutines:goroutines`, and GC pause metrics. Export those to Prometheus and alert on scheduling latency p99.

For one-off diagnosis, reach for `net/http/pprof`: the **goroutine profile** (`/debug/pprof/goroutine?debug=2` dumps every stack — perfect for finding leaks and "where is everything blocked"), and the **execution tracer** (`runtime/trace` or `/debug/pprof/trace`), which `go tool trace` renders as a timeline showing exactly when goroutines ran, blocked, and got preempted, plus GC and syscall events. The tracer is the gold standard when you suspect scheduler pathology.

| Symptom | Tool | Likely cause |
| --- | --- | --- |
| Deep, persistent run queue | `schedtrace` | CPU-bound; need fewer goroutines/more cores |
| Climbing thread count | `schedtrace` `threads`, threadcreate profile | Blocking syscalls / cgo |
| High `/sched/latencies` p99 | `runtime/metrics` | Scheduler can't keep up; contention or GC |
| Many goroutines stuck on same chan | goroutine profile (`debug=2`) | Leak or deadlock-ish blocking |
| Mysterious pauses / preemption | `go tool trace` | GC STW, long-running G, syscall stalls |

The senior move is to reason top-down: schedtrace tells you *which class* of problem (CPU vs blocking vs GC), then pprof/trace tells you *where*. Don't guess — Go's observability here is genuinely excellent, so measure first.

---

## Memory & Garbage Collection

### Summary

**What this topic covers** — This topic is about where Go puts your data (stack vs heap), how the runtime decides, and how the garbage collector reclaims heap memory without stopping your program for long. It spans escape analysis, the concurrent tri-color mark-sweep collector, the `GOGC` and `GOMEMLIMIT` knobs, allocation-reduction techniques, leak hunting with heap profiles, and the allocation consequences of value vs pointer semantics. The thread running through all of it: Go gives you a fast, low-latency GC and mostly automatic memory management, but a senior engineer knows when allocations escape to the heap, how to measure GC behavior, and how to tune it for a throughput batch job versus a latency-sensitive service.

**Mental model** — Hold two pictures. First, the compiler's escape analysis runs at build time and answers one question per value: "can this outlive the function that created it?" If no, it goes on the stack and costs nothing to free (the stack just unwinds). If yes — it's returned by pointer, stored in an interface, captured by a closure that outlives the frame, or its size isn't known at compile time — it escapes to the heap and becomes the GC's problem. Second, the GC itself: a concurrent, non-generational, non-compacting mark-sweep collector that runs mostly while your goroutines keep executing. It trades a little CPU and a little extra memory for very short stop-the-world pauses (sub-millisecond, typically). You don't free memory; you produce less garbage and tune how aggressively the collector runs. The single most useful instinct: *allocation is the cost, not collection*. Cut allocations and GC pressure drops automatically.

**Key terms**
- **Escape analysis** — compile-time analysis deciding whether a value can live on the stack or must move to the heap.
- **Heap** — GC-managed memory for values that outlive their stack frame.
- **Tri-color marking** — objects partitioned into white (unreached), grey (reached, children unscanned), black (fully scanned); collection ends when no grey remain.
- **Write barrier** — runtime hook on pointer writes during marking that preserves the tri-color invariant when mutators run concurrently.
- **STW (stop-the-world)** — brief global pause to enable/disable barriers and rescan stacks.
- **GOGC** — percentage knob: heap may grow GOGC% beyond live set before the next cycle (default 100).
- **GOMEMLIMIT** — soft memory ceiling (Go 1.19+) that makes GC run more aggressively as you approach it.
- **`sync.Pool`** — per-P free list for reusing transient allocations across GC cycles.
- **Interface boxing** — storing a value in an `interface{}`/`any`, which often forces a heap allocation.
- **Heap profile** — `pprof` snapshot of live (`inuse_space`) or cumulative (`alloc_space`) allocations.
- **Pacer** — GC algorithm that schedules cycles to hit the GOGC/GOMEMLIMIT target without overshooting.
- **Finalizer** — `runtime.SetFinalizer` callback run before reclamation; unreliable for resource cleanup.

**Why interviewers ask this** — Memory is where Go's "it just works" abstraction leaks, and where seniors separate from juniors fast. A junior says "Go has a garbage collector, so I don't worry about memory." A senior says "the GC is cheap, but every heap allocation costs a malloc plus future scan work, so I read `-gcflags=-m`, I profile with pprof before optimizing, and I know `GOMEMLIMIT` is a soft limit that won't OOM-protect you alone." Interviewers want to see that you can reason about *why* a value escapes, that you measure with `go test -bench -benchmem` rather than guess, and that you understand the GC is concurrent — not a "the world stops while it cleans up" model from Java circa 2005. They're also checking for the trap answers: thinking pointers are always faster, thinking `sync.Pool` is a general cache, or thinking finalizers are a safe way to close files.

**Common confusions**
- **"Pointers are always more efficient than values."** Wrong — pointers force heap escapes and add GC scan work; small values are often cheaper to copy.
- **"The GC stops the world to collect."** Wrong — marking and sweeping are concurrent; STW is sub-millisecond bookkeeping.
- **"`GOMEMLIMIT` prevents OOM."** Wrong — it's a *soft* limit; the runtime can exceed it and will thrash the GC trying to stay under it.
- **"`sync.Pool` is a cache."** Wrong — entries are cleared on GC; it's only for short-lived, interchangeable objects.
- **"Setting a slice to `nil` frees its backing array immediately."** Wrong — it's freed only when unreachable and the next GC sweeps it.

**What follows from this topic** — Allocation behavior connects directly to Concurrency (goroutine stacks start small and grow; channels and closures cause escapes), to Performance & Profiling (pprof, `GODEBUG=gctrace=1`, benchmarks with `-benchmem`), and to Slices & Maps (backing-array retention is a classic leak). Understanding pointer vs value semantics here also feeds into Interfaces and Method Sets, where the receiver type decides whether values box and escape.

### Q29. Stack vs heap allocation in Go — explain escape analysis and how to read `go build -gcflags=-m` output.

The compiler decides allocation, not you. For each value it asks: does this outlive its stack frame? If the answer is provably no, it lives on the stack and is freed for free when the frame unwinds — zero GC involvement. If it might outlive the frame, it *escapes* to the heap. Common escape triggers: returning a pointer to a local, storing a value in an `interface{}`, capturing a variable in a closure that outlives the function, sending a pointer on a channel, or an allocation whose size isn't known at compile time (e.g. `make([]int, n)`).

Read the decisions with `go build -gcflags=-m` (add a second `-m` for more detail):

```go
func newUser() *User {       // escapes: returned by pointer
    u := User{Name: "alice"}
    return &u
}
func sum(xs []int) int {     // xs backing array does not escape here
    t := 0
    for _, x := range xs { t += x }
    return t
}
```

```
$ go build -gcflags=-m ./...
./main.go:2:2: moved to heap: u
./main.go:7:6: sum xs does not escape
```

Key phrases: `moved to heap: x` means a stack allocation became a heap one; `escapes to heap` usually flags an argument forced to the heap (classic culprit: `fmt.Println(x)` — the `...any` boxes its arguments); `does not escape` and `does not escape, inlining` are the good cases.

The trap people fall into: optimizing escapes they never measured. Pair `-gcflags=-m` with `go test -bench=. -benchmem`, which reports `allocs/op` and `B/op`. A change that removes an escape but doesn't move `allocs/op` isn't worth the readability cost. Note that escape analysis is conservative — it will heap-allocate when it *can't prove* safety, so a tiny refactor (e.g. not taking the address of a local, or avoiding `interface{}`) can flip a value back onto the stack.

### Q30. Explain the Go garbage collector: concurrent tri-color mark-sweep, write barriers, and STW phases.

Go's GC is a **concurrent, tri-color, mark-sweep** collector. Non-generational and non-compacting — it never moves live objects, which keeps pointers stable (important for cgo and unsafe) at the cost of fragmentation that the size-class allocator largely absorbs.

Tri-color: every object is white (not yet reached), grey (reached but children not scanned), or black (reached and fully scanned). Marking starts from roots (stacks, globals), greys them, then drains the grey set — scanning each object, blackening it, and greying its referents. When no grey objects remain, every white object is unreachable and can be swept. The catch: your goroutines (the *mutators*) keep running during marking, so they can rewire pointers mid-scan. Without protection, a mutator could hide a white object behind a black one and the collector would wrongly free live memory.

That's what the **write barrier** prevents. During the mark phase the compiler inserts a barrier on pointer writes (Go uses a hybrid Dijkstra/Yuasa barrier) that shades the relevant object grey, preserving the invariant that no black object points to a white one without that white being tracked. The barrier is why marking can be concurrent at all.

STW phases are tiny and there are two: a brief pause at the **start** to enable the write barrier and snapshot roots, and a brief pause at **mark termination** to disable the barrier and finish. Sweeping is concurrent and lazy — memory is reclaimed as it's needed. Typical pauses are well under a millisecond; the 2018+ design target was sub-500µs and it generally beats that. Watch a live trace with `GODEBUG=gctrace=1 ./app`, which prints each cycle's wall-clock, CPU share, and heap sizes. The mental correction for anyone with a Java background: this is not "the world freezes while it cleans up" — the expensive work overlaps your program.

### Q31. What is GOGC and the soft memory limit (GOMEMLIMIT, Go 1.19+)? How do you tune GC for throughput vs latency?

`GOGC` is the primary knob: it's a *percentage* controlling how much the heap may grow relative to the live set before the next collection. Default `100` means "let the heap double" — if the live set after a collection is 200MB, the next cycle triggers around 400MB. Higher `GOGC` (e.g. `300`) collects less often: fewer GC cycles, more throughput, more peak memory. `GOGC=off` disables GC entirely (only for short-lived batch tools). Set it via the env var or `debug.SetGCPercent`.

`GOMEMLIMIT` (Go 1.19+) is a **soft memory limit** — a byte ceiling that makes the GC run progressively harder as the heap approaches it, regardless of `GOGC`. It's the right tool for containerized services: set it a bit below your cgroup limit so GC ramps up before the OOM killer fires. Crucially it is *soft* — if the live set genuinely exceeds the limit, Go will keep allocating (you'd rather thrash than crash mid-request) and the GC will spin hard trying to comply. So `GOMEMLIMIT` is not OOM protection on its own; pair it with monitoring.

The idiomatic combo for a service: set `GOMEMLIMIT` to your real memory budget and leave `GOGC=100`, or set `GOGC=off` *and* a hard-ish `GOMEMLIMIT` so the limit becomes the sole trigger — the heap grows freely until it nears the ceiling, then GC kicks in. That avoids paying for frequent small collections under light load while still respecting the cap under pressure.

| Goal | GOGC | GOMEMLIMIT |
|------|------|-----------|
| Throughput (batch) | high (300+) or `off` | optional safety cap |
| Latency (service) | default 100 | set near budget |
| Container OOM-avoidance | 100 or `off` | set just below cgroup limit |

Always measure with `gctrace` and pprof before and after; the right values are workload-specific and the defaults are good for most services.

### Q32. How do you reduce allocations? Discuss sync.Pool, preallocating slices, and avoiding interface boxing.

Rule one: measure with `go test -bench=. -benchmem` and read `allocs/op`. Don't optimize escapes you haven't proven matter. Once you have a hot path, the high-value moves:

**Preallocate** slices and maps with a known or estimated capacity so they don't repeatedly grow and copy:

```go
out := make([]Result, 0, len(in)) // one alloc instead of log2(n) regrowths
for _, x := range in { out = append(out, transform(x)) }
```

Same for `make(map[K]V, hint)`. Reusing a buffer across iterations (`buf = buf[:0]`) keeps the backing array and avoids re-allocating each loop.

**`sync.Pool`** reuses transient, interchangeable objects (buffers, scratch structs) across GC cycles, cutting both allocation and GC scan work:

```go
var bufPool = sync.Pool{New: func() any { return new(bytes.Buffer) }}
b := bufPool.Get().(*bytes.Buffer)
b.Reset()
defer bufPool.Put(b)
```

Caveats that catch people: a `Pool` is *not a cache* — entries are dropped on GC, so don't store anything you need to keep. Always `Reset()` on get or put so you don't leak stale data. And don't pool tiny objects — the pool's own overhead can exceed the saving.

**Avoid interface boxing.** Putting a value into `any`/`interface{}` typically heap-allocates because the interface stores a pointer. `fmt.Sprintf` and friends box every argument; in a hot path, prefer `strconv.AppendInt(buf, n, 10)` over `fmt.Sprintf("%d", n)`. Since Go 1.18, **generics** let you write reusable code without boxing — `func Max[T constraints.Ordered](a, b T) T` keeps `T` concrete and stack-friendly where an `any`-based version would allocate. Other wins: pass large structs by pointer only when needed (see Q34), and avoid `[]byte`↔`string` conversions in loops (each copies) — use `strings.Builder` or append into a `[]byte`.

### Q33. Explain how to find and fix a memory leak in Go (heap profile, retained references, finalizers caveats).

"Leak" in a GC language means *unintended retention*: something still reachable holds memory you expected freed. The GC can't help — it's doing its job; your object graph is the bug.

Start by confirming growth: watch RSS and `go_memstats` (or `GODEBUG=gctrace=1`) over time. Then take a heap profile via `net/http/pprof` (import `_ "net/http/pprof"`, hit `/debug/pprof/heap`) or `pprof.WriteHeapProfile`. Analyze with `go tool pprof`:

```
go tool pprof -inuse_space http://localhost:6060/debug/pprof/heap
(pprof) top
(pprof) list <func>
```

`inuse_space` shows what's *currently live* — that's your leak. `alloc_space` shows cumulative allocation (useful for churn/GC pressure, not leaks). Take two snapshots minutes apart and diff with `-base` to see what grew.

The usual culprits, in rough order of frequency:
- **Goroutine leaks** — a goroutine blocked forever on a channel/`select` keeps its entire stack and everything it references alive. Check `/debug/pprof/goroutine`; a steadily climbing count is the tell.
- **Unbounded maps/slices** — caches with no eviction, or appending forever.
- **Slice sub-referencing** — `small := big[:10]` keeps the *entire* `big` backing array alive. Fix by copying: `small := append([]T(nil), big[:10]...)`.
- **Lingering references** — values left in package-level maps, registered callbacks, timers not stopped (`time.Ticker` you forget to `Stop()`).

On **finalizers**: `runtime.SetFinalizer` looks like a fix but isn't. Finalizers run on an unspecified schedule (maybe never before exit), only after the object is unreachable, can resurrect objects, and a finalizer holding a reference *prevents* collection — turning the cleanup into the leak. Never use them to close files, sockets, or release locks; use explicit `Close()` and `defer`. Finalizers are at best a last-resort safety net for cgo handles, paired with `runtime.KeepAlive` to control lifetime.

### Q34. Value vs pointer semantics and their effect on allocation and GC pressure — when does passing a pointer hurt?

The reflexive "pointers are faster" belief is wrong often enough to be dangerous. Passing by value *copies*, but the copy lives on the stack and costs nothing to reclaim. Passing by pointer avoids the copy but frequently forces the pointee to **escape to the heap**, which adds a malloc and turns the object into GC scan work for its whole lifetime.

So a pointer hurts when:
- The value is **small** — for a few words (an `int`, a small struct), the copy is cheaper than a heap allocation plus a pointer dereference plus GC tracking. Rule of thumb: below ~a few cache lines, prefer value.
- It causes an **escape that wouldn't otherwise happen** — taking `&local` and passing it out heap-allocates `local`. Check with `-gcflags=-m`.
- It adds **GC pressure at scale** — a `[]*T` of a million pointers gives the collector a million pointers to scan and chase; a `[]T` of values is one contiguous block the GC scans far faster (or skips entirely if `T` has no pointers).

Pointers genuinely help when the struct is **large** (copying dozens of fields each call is real cost) or when you need to **mutate** the caller's value or share identity. There's also the consistency rule: keep a type's method receivers uniform — if any method needs a pointer receiver (to mutate or because the struct is large), make them all pointer receivers, so the method set is coherent.

```go
type Point struct{ X, Y int }      // 16 bytes — pass by value
func (p Point) Add(q Point) Point { return Point{p.X + q.X, p.Y + q.Y} }

type Buffer struct{ data [4096]byte; n int } // big + mutated — pointer
func (b *Buffer) Write(p []byte) { /* ... */ }
```

Bottom line: default to values for small immutable data, pointers for large or mutated data, and let the profiler — not folklore — settle the marginal cases.

---

## Error Handling

### Summary

**What this topic covers** — This topic is about how Go represents, propagates, inspects, and contains failure. Go has no exceptions for ordinary error flow: functions return `error` as an ordinary value, callers check it explicitly, and the type system makes the error a first-class part of every signature. The topic spans the `error` interface, the wrapping/unwrapping machinery (`fmt.Errorf("%w", err)`, `errors.Is`, `errors.As`, `errors.Join`), API design choices (sentinels vs typed errors vs opaque errors), the `panic`/`recover` escape hatch for truly exceptional situations, and the surprisingly tricky business of handling errors returned from deferred calls like `f.Close()`.

**Mental model** — Think of an error in Go as a *value that travels up the call stack by hand*, not a control-flow event that unwinds it automatically. Because errors are values, you can store them, compare them, wrap them, log them, and write helper functions over them — the same way you would with any other return value. The senior instinct is: *errors are part of your API contract*. What a function returns on failure is as much a design decision as what it returns on success. Wrapping builds a *chain* — a linked list from the outermost context (`"loading config: open /etc/app.conf: permission denied"`) down to the root cause — and `errors.Is`/`errors.As` walk that chain so callers can branch on a root cause buried three layers deep without string-matching. `panic` is reserved for *programmer errors and unrecoverable invariants*, not for "the file wasn't there." You reach for `recover` only at trust boundaries (a request handler, a worker loop) to stop one bad request from killing the process.

**Key terms**
- **`error`** — the built-in interface: a single method `Error() string`.
- **Sentinel error** — a package-level `var ErrNotFound = errors.New(...)` compared with `errors.Is`.
- **Error type** — a concrete struct/type implementing `error`, carrying fields, matched with `errors.As`.
- **Opaque error** — an error returned as a plain `error` value with no exported type or sentinel; callers can only display it.
- **Wrapping** — embedding one error inside another via `%w`, preserving the chain.
- **`errors.Is`** — reports whether any error in the chain matches a target (value equality or `Is` method).
- **`errors.As`** — finds the first error in the chain assignable to a target type, and binds it.
- **`errors.Unwrap`** — returns the next error down the chain (the `Unwrap() error` method).
- **`errors.Join`** — combines multiple errors into one (Go 1.20), unwrappable as a slice.
- **`panic`** — aborts normal flow, runs deferreds, unwinds the stack.
- **`recover`** — inside a deferred function, stops a panic and returns its value.
- **Named return value** — a named result like `(err error)` a deferred closure can mutate.

**Why interviewers ask this** — Error handling is where Go's philosophy is most distinct from Java/Python, so it's a fast read on whether someone *thinks in Go* or just writes Go-flavored Java. Juniors `return err` everywhere with no added context, swallow errors with `_`, or panic on anything that fails. Strong candidates talk about errors as API design: they wrap with `%w` to preserve chains, expose sentinels or typed errors *deliberately* when callers need to branch, keep most errors opaque to avoid coupling, and know that `errors.Is` vs `errors.As` is value-vs-type matching. The deferred-`Close` question is a classic senior filter — almost everyone writes `defer f.Close()` and silently drops a write-flush error, which on a buffered writer can mean *silent data loss*. Knowing how to capture that into a named return separates people who have shipped reliable Go from people who have only read about it.

**Common confusions**
- **"`errors.Is` and `errors.As` are interchangeable."** No — `Is` matches a specific *value* (sentinel); `As` matches a *type* and extracts fields.
- **"Wrapping with `%w` and `%v` is the same."** `%v` flattens to a string and *breaks the chain*; `%w` preserves it for `Is`/`As`.
- **"`recover` can catch a panic from another goroutine."** It cannot. A panic in a goroutine with no `recover` in *its own* stack crashes the whole program.
- **"`panic` is Go's exception mechanism for errors."** It's for unrecoverable/programmer bugs; ordinary failures return `error`.
- **"`defer f.Close()` is always fine."** For writable files it can drop a flush error — a real bug.

**What follows from this topic** — Error handling threads through everything else in Go. Concurrency relies on propagating errors out of goroutines (channels, `errgroup`); `context` cancellation surfaces as `context.Canceled`/`context.DeadlineExceeded` sentinels you match with `errors.Is`. Observability (structured logging with `slog`) hinges on logging wrapped errors with their full chain. Resilience patterns — retries, circuit breakers (`gobreaker`) — decide *which* errors are retryable by inspecting types. Master errors-as-values and the rest of idiomatic Go gets noticeably easier.

### Q35. Explain Go's error interface and the explicit `if err != nil` philosophy vs exceptions. Tradeoffs.

The `error` interface is trivially small:

```go
type error interface {
    Error() string
}
```

Any type with an `Error() string` method is an error. Functions that can fail return one as their last result, and the caller checks it explicitly:

```go
f, err := os.Open(path)
if err != nil {
    return fmt.Errorf("open config: %w", err)
}
defer f.Close()
```

The core philosophy: **errors are values, not control flow.** There's no hidden stack-unwinding mechanism for ordinary failures. Whether a function can fail is visible in its signature, and the caller is forced (by the unused-variable rules, mostly) to acknowledge the error before using the result.

The tradeoff versus exceptions is real and goes both ways. The win: error paths are *local and explicit*. You can see exactly where failure is handled, there's no invisible non-local jump, and you're nudged to add context at each layer. The cost: verbosity. The `if err != nil` boilerplate is the single most common complaint about Go, and the language has repeatedly declined to add `try`/`?` sugar (the 2019 `try` proposal was rejected). Exceptions, by contrast, are concise and centralize handling, but they make it easy to *forget* a failure mode and let it propagate silently to a top-level handler, and the failure points are invisible in signatures.

My honest take: the explicitness pays off in long-lived services where you genuinely want to handle errors differently at each layer (retry here, annotate there, surface to the user up top). It's annoying in glue code. Go accepts the verbosity as the price of not having invisible control flow. `panic`/`recover` exists for the truly exceptional, but it is *not* the everyday error mechanism.

### Q36. Error wrapping with `%w`, and unwrapping with `errors.Is` / `errors.As`. Show idiomatic usage.

Wrapping (Go 1.13+) lets you add context while preserving the original error so callers can still inspect it. Use the `%w` verb in `fmt.Errorf` — exactly once per call (Go 1.20 allows multiple `%w`):

```go
func loadConfig(path string) (*Config, error) {
    data, err := os.ReadFile(path)
    if err != nil {
        return nil, fmt.Errorf("loadConfig %q: %w", path, err)
    }
    // ...
}
```

`%w` keeps a reference to the wrapped error; `%v` would only embed its string and break the chain. The result is a chain: `loadConfig "x": open x: no such file or directory`.

To branch on a *sentinel value* anywhere in the chain, use `errors.Is`:

```go
_, err := loadConfig("missing.json")
if errors.Is(err, os.ErrNotExist) {
    // fall back to defaults
}
```

To extract a *typed error* and read its fields, use `errors.As`:

```go
var pathErr *fs.PathError
if errors.As(err, &pathErr) {
    log.Printf("failed op %q on %q", pathErr.Op, pathErr.Path)
}
```

The rule of thumb: `errors.Is` for "is this *that specific error*?" (sentinels), `errors.As` for "is there an error of *this type* in the chain, and give it to me." Both walk the chain by repeatedly calling `Unwrap`. Never do `strings.Contains(err.Error(), "not found")` — that's matching on a message you don't own, and it breaks the moment the wording changes.

`errors.Join` (Go 1.20) combines multiple failures, useful for validation or cleanup:

```go
err := errors.Join(validateName(n), validateEmail(e))
// errors.Is works against either joined error
```

### Q37. Sentinel errors vs error types vs opaque errors — how do you design an error API for a library?

These are three points on a spectrum of how much you expose to callers:

| Approach | Caller matches with | Coupling | Use when |
|---|---|---|---|
| **Sentinel** (`var ErrNotFound = errors.New(...)`) | `errors.Is` | High — callers depend on the variable | A small fixed set of conditions callers branch on (`io.EOF`, `sql.ErrNoRows`) |
| **Error type** (struct implementing `error`) | `errors.As` | High, but carries structured data | Callers need *fields* (status code, field name, retryable flag) |
| **Opaque** (plain `error`, no exported identity) | nothing — display only | Lowest | The default; callers only log/show it |

My default for a library is **opaque**, and I promote to a sentinel or type only when I have a concrete reason — i.e., a caller genuinely needs to *programmatically* distinguish one failure from another. Every exported sentinel and error type becomes part of your public API: removing or renaming it is a breaking change, so don't export them casually.

When I do expose typed errors, I make the type carry the data callers actually need and implement `Unwrap` if it wraps a cause:

```go
type ValidationError struct {
    Field string
    Err   error
}

func (e *ValidationError) Error() string { return fmt.Sprintf("%s: %v", e.Field, e.Err) }
func (e *ValidationError) Unwrap() error  { return e.Err }
```

A useful pattern is an exported *behavior* rather than a concrete type — define an interface like `interface { Temporary() bool }` and let callers check behavior via `errors.As`, decoupling them from your concrete struct. The `net` package historically did this. The senior move is restraint: a library that exports twenty sentinels has frozen twenty implementation details into its contract.

### Q38. panic / recover — when is it acceptable to use them, and how does recover work across goroutines?

`panic` unwinds the current goroutine's stack, running deferred functions on the way up. `recover`, called inside a deferred function, stops the unwinding and returns the panic value. If nothing recovers, the program crashes and prints a stack trace.

Acceptable uses are narrow:
- **Programmer errors / broken invariants** — something that should be impossible. `panic("unreachable")`, or a constructor that panics on a nil dependency at startup.
- **Init-time failures** — `regexp.MustCompile`, `template.Must`: fail fast at program start rather than return an error nobody will check.
- **Recovering at a trust boundary** — an HTTP handler or worker loop catching a panic so one bad request doesn't take down the process. `net/http` already wraps each handler in a recover.

```go
func safeHandle(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        defer func() {
            if v := recover(); v != nil {
                log.Printf("panic: %v\n%s", v, debug.Stack())
                http.Error(w, "internal error", http.StatusInternalServerError)
            }
        }()
        next.ServeHTTP(w, r)
    })
}
```

**The critical gotcha: `recover` only catches panics in its own goroutine.** A deferred `recover` in the parent does *nothing* for a child goroutine — when that child panics with no recover in *its* stack, the entire program crashes:

```go
go func() {
    // BUG: if this panics, the whole process dies.
    // The recover() in the caller cannot see it.
    doWork()
}()
```

The fix is to install a recover *inside every goroutine* you spawn that might panic (typically via a `go safeGo(fn)` wrapper that defers recover and reports the panic). Don't use `panic`/`recover` as a `try`/`catch` substitute for ordinary errors — it's slower, hides control flow, and is non-idiomatic. Recover, log, and either translate to an error at the boundary or let it crash if the invariant is truly broken.

### Q39. How do you add context to errors without losing the chain? Discuss the deprecated github.com/pkg/errors and stdlib equivalents.

Add context by wrapping with `%w` at each layer where you know something the layer below didn't — a path, an ID, the operation name:

```go
func (s *Store) GetUser(ctx context.Context, id string) (*User, error) {
    u, err := s.db.query(ctx, id)
    if err != nil {
        return nil, fmt.Errorf("GetUser %s: %w", id, err)
    }
    return u, nil
}
```

This builds a readable chain and keeps the root cause inspectable via `errors.Is`/`errors.As`. The discipline: wrap with context that *adds information*, and don't re-wrap the same error twice at the same level. Annotate with the *inputs* of the failing call (the `id`, the path), not just "failed to get user" — generic prefixes add noise without signal.

Before Go 1.13, `github.com/pkg/errors` was the standard answer. It gave you `errors.Wrap(err, "msg")`, `errors.Cause(err)` to get the root, and — its killer feature — **stack traces** captured at the point of wrapping. The stdlib then absorbed the core idea:

| `pkg/errors` | stdlib equivalent |
|---|---|
| `errors.Wrap(err, "msg")` | `fmt.Errorf("msg: %w", err)` |
| `errors.Cause(err)` | `errors.Is` / `errors.As` (walk the chain) |
| `errors.WithMessage` | `fmt.Errorf("msg: %w", err)` |

For new code, use the stdlib — `pkg/errors` is archived/deprecated and adding it now is a code smell. The one thing the stdlib still *doesn't* give you is automatic stack traces; your error chain is your "stack." If you need real stack traces, capture them yourself in a custom error type or rely on good wrapping plus `slog` context. In practice, well-wrapped errors with operation names usually localize the failure as precisely as a stack trace would, with less overhead.

### Q40. What is the "errors as values" pattern, and how do you handle errors in deferred calls (e.g. closing a file that returns an error)?

"Errors as values" means: because errors are ordinary values, you can program *with* them — store them, accumulate them, and write helpers that reduce repetitive `if err != nil` churn. The canonical example is Rob Pike's `errWriter`, where you stash the first error and skip subsequent operations:

```go
type errWriter struct {
    w   io.Writer
    err error
}

func (ew *errWriter) write(buf []byte) {
    if ew.err != nil {
        return // already failed; do nothing
    }
    _, ew.err = ew.w.Write(buf)
}

// caller does many writes, checks ew.err once at the end.
```

The deferred-`Close` problem is the practical face of this. `defer f.Close()` *discards* the error — and for a writable file, `Close` can return a buffered-write/flush error. Dropping it can mean **silent data loss**. The fix is to capture the error into a **named return value** from the deferred closure:

```go
func writeFile(path string, data []byte) (err error) {
    f, err := os.Create(path)
    if err != nil {
        return err
    }
    defer func() {
        if cerr := f.Close(); cerr != nil && err == nil {
            err = cerr // only overwrite if we weren't already failing
        }
    }()

    _, err = f.Write(data)
    return err
}
```

Two subtleties. First, the result must be a *named* return (`err error`) so the deferred closure can assign to it — assigning to a local `err` in a closure that returns `error` normally would do nothing. Second, the `err == nil` guard: if `Write` already failed, that's the more interesting error, so don't clobber it with the `Close` error. You could also `err = errors.Join(err, cerr)` to keep both (Go 1.20+), which is increasingly my preference. For read-only files, `defer f.Close()` is fine — there's nothing to flush — but get in the habit of distinguishing the two, because the write case is a genuine bug interviewers look for.

---

## Standard Library

### Summary

**What this topic covers** — Go's standard library is the unusual selling point of the language: a production-grade HTTP stack, JSON codec, streaming I/O abstractions, time handling, cancellation plumbing, and generic collection helpers all ship in the box and are versioned with the compiler. This topic covers the packages you actually reach for in a service every day — `net/http`, `encoding/json`, `io`/`bufio`, `time`, `context`, `strings`, `sort`/`slices`, and `maps` — plus the sharp edges that bite people who treat them as black boxes.

**Mental model** — Think of the stdlib as a set of small, composable interfaces (`io.Reader`, `io.Writer`, `http.Handler`, `sort.Interface`) wrapped by concrete helpers. Almost everything is built from one-method interfaces, which is why `io.Copy`, `gzip.NewWriter`, `bufio.Scanner`, and `http.ResponseWriter` all snap together without adapters. The model a senior carries is "stream, don't buffer; cancel, don't leak; compose, don't reinvent." You assume any byte-producing thing is a `Reader` and any sink is a `Writer`, so plumbing data through compression, hashing, and the network is just function composition. You also assume the stdlib is conservative and rarely changes behavior — so when it does (loop variables in 1.22, the new `ServeMux` routing in 1.22, `min`/`max` builtins, `slices`/`maps` in 1.21), those version boundaries matter for what you can rely on. Finally, you treat `context.Context` as a first-class argument that flows through every blocking call, because the stdlib's network and DB packages honor it.

**Key terms**
- **`http.Handler`** — interface with `ServeHTTP(ResponseWriter, *Request)`; the unit of HTTP handling.
- **`http.HandlerFunc`** — adapter turning a function into a `Handler`.
- **`ServeMux`** — the stdlib request router; gained method+wildcard patterns in Go 1.22.
- **`io.Reader`/`io.Writer`** — the two one-method interfaces all I/O composes from.
- **`io.Copy`** — streams from a `Reader` to a `Writer` with a fixed buffer.
- **`bufio`** — buffering layer; `Scanner` for line/token reads, `Writer` to batch small writes.
- **`time.Duration`** — an `int64` nanosecond count, not a wall-clock instant.
- **monotonic clock** — a reading embedded in `time.Time` used for correct interval math.
- **`context.Context`** — carries deadlines, cancellation, and request-scoped values.
- **`json.RawMessage`** — deferred-decode `[]byte` for delaying or passing through JSON.
- **`slices`/`maps`** — generic helpers (Go 1.21) replacing hand-rolled loops and `sort.Slice`.

**Why interviewers ask this** — Stdlib fluency is the cleanest separation between someone who has shipped Go and someone who has only read about it. A junior reaches for a framework or a third-party router on day one and reads whole files into memory; a senior writes an HTTP service with `net/http` plus maybe `chi`, streams large payloads, and knows that `time.After` in a hot loop leaks. Interviewers probe here because the answers reveal whether you understand interface composition, resource lifecycle (timers, response bodies, contexts), and the version-specific behavior changes that determine whether your code is correct on the team's Go version. Getting `omitempty` semantics, timer leaks, or `context` propagation wrong are the exact bugs that show up in production incidents, so these questions double as a proxy for operational judgment.

**Common confusions**
- **"`ServeMux` can't do method routing or path params"** — true before Go 1.22, false after; `mux.HandleFunc("GET /items/{id}", ...)` works now.
- **"`omitempty` drops empty structs and zero-value pointers' targets"** — it only checks the field's own zero value; a non-nil pointer to a zero struct is still emitted.
- **"Reading a whole file with `os.ReadFile` is fine"** — fine for configs, a memory bomb for uploads; stream with `io.Copy`.
- **"`time.Time` comparison is just wall-clock"** — it also carries a monotonic reading, which is what makes `time.Since` immune to clock jumps.
- **"`time.After` is free"** — its timer isn't GC'd until it fires, so in a `select` loop it leaks until the duration elapses.
- **"Closing the request body is optional"** — leaking response bodies starves the connection pool.

**What follows from this topic** — Interface composition here connects directly to the Interfaces and Concurrency topics: `context` cancellation is meaningless without goroutines that select on `ctx.Done()`, and `io` pipelines often fan out across goroutines. The error-handling topic builds on `database/sql` and `net/http` returning wrapped errors, and the performance topic revisits `strings.Builder`, buffer reuse, and `pprof` profiling of allocation hot spots you first meet here.

### Q41. Walk through net/http server basics: Handler, HandlerFunc, ServeMux, and the request lifecycle.

The whole server is built on one interface:

```go
type Handler interface {
    ServeHTTP(w http.ResponseWriter, r *http.Request)
}
```

Anything implementing `ServeHTTP` can serve requests. Because writing a struct with a method for every endpoint is tedious, `http.HandlerFunc` is an adapter — it's a function type whose own `ServeHTTP` just calls itself. So `http.HandlerFunc(myFunc)` turns a plain `func(w, r)` into a `Handler`. That's the entire trick behind `mux.HandleFunc`.

`ServeMux` is the router. You register patterns, and on each request it picks the most specific match and calls that handler. The big change is Go 1.22: `ServeMux` now understands methods and wildcards.

```go
mux := http.NewServeMux()
mux.HandleFunc("GET /items/{id}", getItem)   // method + path param
mux.HandleFunc("POST /items", createItem)
http.ListenAndServe(":8080", mux)

func getItem(w http.ResponseWriter, r *http.Request) {
    id := r.PathValue("id")   // 1.22 API
    fmt.Fprintf(w, "item %s", id)
}
```

Before 1.22 you needed `chi` or `gorilla/mux` for this; now the stdlib covers most routing needs, though `chi` still wins for sub-router grouping and middleware ergonomics.

Lifecycle: `ListenAndServe` accepts a connection, the `Server` reads the request and constructs `*http.Request`, the mux matches a pattern and invokes `ServeHTTP` on its own goroutine (one per request — your handlers must be concurrency-safe). You write headers and body via `ResponseWriter`; the first `Write` (or explicit `WriteHeader`) flushes the status line and headers, so set headers and call `WriteHeader` before writing the body. Middleware is just a `Handler` that wraps another `Handler` — `func(next http.Handler) http.Handler`. The request carries a `Context()` that's cancelled when the client disconnects, which you should propagate to downstream calls.

### Q42. encoding/json: marshalling rules, struct tags, omitempty, custom Marshaler/Unmarshaler, and decoding into interface{}.

`json.Marshal` only encodes exported fields. Field names default to the Go name; struct tags rename and configure: `json:"user_id,omitempty"`. `omitempty` omits the field when it holds its type's zero value — `0`, `""`, `nil`, empty slice/map, `false`. The classic gotcha is that it checks the field's own zero value, not "emptiness of what it points to":

```go
type Cfg struct {
    Timeout *int `json:"timeout,omitempty"`
}
zero := 0
Cfg{Timeout: &zero}   // emits "timeout":0 — pointer is non-nil
Cfg{}                 // omits timeout — pointer is nil
```

That's why config structs use pointers: nil means "unset," `&0` means "explicitly zero."

Custom encoding implements `json.Marshaler` (`MarshalJSON() ([]byte, error)`) and `json.Unmarshaler` (`UnmarshalJSON([]byte) error`). Use them for enums-as-strings, custom time formats, or wrapping. A common bug: calling `json.Marshal(t)` on the same type inside its own `MarshalJSON` causes infinite recursion — define a type alias to strip the method first:

```go
func (t Temp) MarshalJSON() ([]byte, error) {
    type alias Temp                 // alias has no MarshalJSON
    return json.Marshal(alias(t))
}
```

Decoding into `interface{}` gives you the dynamic-type mapping: objects → `map[string]interface{}`, arrays → `[]interface{}`, numbers → `float64` (not `int` — this surprises people and loses precision on large int64s; use `Decoder.UseNumber()` to get `json.Number`). For pass-through or deferred decoding, use `json.RawMessage` to keep raw bytes and decode later. For streaming large or multiple JSON values, prefer `json.NewDecoder(r)` over reading the whole body then `Unmarshal`.

### Q43. The io package: Reader/Writer/Closer, io.Copy, bufio, and why streaming beats reading whole files.

`io` defines the two interfaces everything composes from: `Reader` (`Read(p []byte) (int, error)`) and `Writer` (`Write(p []byte) (int, error)`), plus `Closer` for cleanup. `Read` fills a buffer you provide and returns `io.EOF` when exhausted — note EOF can come *with* data on the final read, so handle `n > 0` before checking the error.

`io.Copy(dst, src)` is the workhorse: it streams from any `Reader` to any `Writer` using a small internal buffer (32KB), so memory stays flat regardless of payload size. This is why you can pipe a multi-GB upload straight to disk or S3 without OOMing:

```go
f, _ := os.Create("out.bin")
defer f.Close()
io.Copy(f, r.Body)   // constant memory, not r.Body's full size
```

Compare with `os.ReadFile` / `io.ReadAll`, which allocate the entire content in memory. Fine for a 2KB config; a denial-of-service waiting to happen for user uploads. Cap untrusted readers with `io.LimitReader`.

`bufio` adds buffering. `bufio.Writer` batches many small writes into fewer syscalls — wrap a network conn or file when you write byte-by-byte, and remember to `Flush()`. `bufio.Scanner` is the idiomatic line/token reader:

```go
sc := bufio.NewScanner(f)
for sc.Scan() {
    line := sc.Text()
}
if err := sc.Err(); err != nil { /* ... */ }
```

Scanner's trap: it has a default 64KB line-length cap and returns an error on longer lines — use `sc.Buffer()` to raise it, or `bufio.Reader.ReadString('\n')` for unbounded lines. The composition payoff: because everything is `Reader`/`Writer`, you can stack `gzip.NewReader`, `io.TeeReader` (to hash while copying), and `io.MultiWriter` (fan-out) without bespoke glue.

### Q44. Working with time: time.Time, monotonic clock, Duration, tickers/timers, and the classic timer leak.

`time.Time` is an instant; `time.Duration` is an `int64` nanosecond count, so you write `5 * time.Second`, not `time.Second(5)`. A subtle but important detail: a `time.Time` from `time.Now()` carries *both* a wall-clock reading and a monotonic-clock reading. `time.Since(t)` and `t2.Sub(t1)` use the monotonic component, so interval math stays correct even if NTP steps the wall clock backward. Operations that strip the monotonic reading (`t.Round(0)`, marshalling to JSON and back) make you vulnerable to clock jumps — measure elapsed time on raw `time.Now()` values, not on serialized timestamps.

`time.Timer` fires once; `time.Ticker` fires repeatedly. Always `Stop()` a ticker (usually `defer ticker.Stop()`) or it keeps its goroutine/channel alive.

The classic leak is `time.After` inside a `select` loop:

```go
// BUG: each iteration allocates a Timer that lives until it fires
for {
    select {
    case msg := <-ch:
        handle(msg)
    case <-time.After(time.Minute):   // leaks one timer per loop on the msg path
        return
    }
}
```

Every loop iteration that takes the `ch` branch leaves a one-minute timer parked in the runtime; under high message rate you accumulate thousands. The runtime can't GC a `time.After` timer until it fires. Fix: hoist a single reusable `Timer` and reset it:

```go
t := time.NewTimer(time.Minute)
defer t.Stop()
for {
    if !t.Stop() {
        select { case <-t.C: default: }   // drain if already fired
    }
    t.Reset(time.Minute)
    select {
    case msg := <-ch:
        handle(msg)
    case <-t.C:
        return
    }
}
```

Go 1.23 actually improved `Timer`/`Ticker` GC and channel semantics (timers are now collected when unreferenced even if not stopped), but the explicit-timer pattern is still the safe, version-independent answer in an interview.

### Q45. context in the stdlib: how net/http and database/sql consume it for deadlines and cancellation.

`context.Context` is the stdlib's standard way to carry deadlines, cancellation signals, and request-scoped values across API boundaries. The contract is simple: it's the first parameter (`ctx context.Context`), you never store it in a struct, and blocking calls return early when `ctx.Done()` closes — typically with `context.Canceled` or `context.DeadlineExceeded`.

`net/http` consumes it on both sides. On the server, `r.Context()` is cancelled when the client disconnects or the request completes — propagate it to every downstream call so abandoned requests don't keep doing work. On the client, you build a request with a context and the transport honors its deadline:

```go
ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
defer cancel()
req, _ := http.NewRequestWithContext(ctx, "GET", url, nil)
resp, err := http.DefaultClient.Do(req)   // aborts if ctx expires
```

`database/sql` mirrors this: prefer the `Context` variants — `db.QueryContext`, `db.ExecContext`, `conn.PingContext`. When the context is cancelled, the driver attempts to cancel the in-flight query and return the connection to the pool, so a client timeout doesn't leave a query running on the DB forever. Using the non-context methods (`db.Query`) ignores cancellation entirely — a senior treats those as legacy.

Two rules people get wrong: always call the `cancel` function `WithTimeout`/`WithCancel` returns (defer it) or you leak the context's goroutine/timer; and check `ctx.Err()` after a blocking operation to distinguish "the work failed" from "we were cancelled," because a cancelled context often surfaces as a wrapped error you want to handle differently (e.g. don't log a client-disconnect as a 500).

### Q46. Useful but tricky stdlib: strings.Builder vs concatenation, sort/slices generics (1.21+), and the maps package.

String concatenation with `+=` in a loop is O(n²) — strings are immutable, so each `+=` allocates a new backing array and copies everything. `strings.Builder` writes into a growable buffer and produces the final string with one allocation via `String()`:

```go
var b strings.Builder
for _, s := range parts {
    b.WriteString(s)
}
result := b.String()
```

Call `b.Grow(n)` if you know the rough size. Don't copy a `Builder` after first use — it holds an internal pointer and the copy check will panic.

Before Go 1.21 you sorted with `sort.Slice(s, func(i, j int) bool {...})`, which works but pays reflection/closure overhead and is error-prone. The generic `slices` package is now the default:

```go
slices.Sort(nums)                              // ordered types, ascending
slices.SortFunc(users, func(a, b User) int {   // returns -1/0/+1
    return cmp.Compare(a.Age, b.Age)
})
i, found := slices.BinarySearch(nums, 42)
slices.Contains(nums, 42)
slices.Equal(a, b)
```

Note `SortFunc` takes a *comparison* returning an int (use `cmp.Compare`), not a less-than bool — that's the migration footgun from `sort.Slice`.

The `maps` package (also 1.21) gives `maps.Keys`, `maps.Values`, `maps.Clone`, `maps.Equal`, `maps.Copy`. In Go 1.21 `maps.Keys` returned a slice; in 1.23 the iterator-based versions in the stdlib return `iter.Seq` (range-over-func), so check your Go version — `for k := range maps.Keys(m)` is the 1.23 idiom, while older code expects a slice. Both `slices` and `maps` are pure helpers over built-in types; they don't introduce new container types, they just replace the hand-rolled loops everyone used to write.

---

## Testing

### Summary

**What this topic covers** — This topic is about Go's built-in testing story: the standard-library `testing` package, the `go test` toolchain, and the idioms that have crystallized around them. Go ships testing, benchmarking, fuzzing, and coverage in the core toolchain — there is no Jest, no JUnit, no pytest to choose between. That deliberate minimalism shapes everything: tests are ordinary Go functions in `_test.go` files, mocks are hand-written interface implementations, and the "framework" debate that consumes other ecosystems mostly doesn't exist here. We cover `*testing.T`, table-driven tests and subtests, benchmarks and the optimizer traps that ruin them, mocking philosophy, fixtures and golden files, `TestMain`, native fuzzing (Go 1.18+), and coverage.

**Mental model** — Treat `go test` as a compiler-plus-runner that builds a throwaway binary per package from your `_test.go` files and runs every `func TestXxx(t *testing.T)` it finds. Tests are code, not configuration: you express setup, assertions, and teardown in plain Go, which is why Go has no assertion DSL — you write `if got != want { t.Errorf(...) }`. A senior engineer thinks in terms of *the test binary's lifecycle*: `TestMain` wraps the whole package run, `t.Cleanup` registers LIFO teardown scoped to a test or subtest, and `t.Parallel` pauses a test until its siblings have been collected so they run concurrently. Failures are values, not exceptions: `t.Error` records and continues; `t.Fatal` calls `runtime.Goexit` on the test's goroutine — which is why you must never call `t.Fatal` from a goroutine you spawned. The whole design optimizes for tests that read like specifications and run deterministically in CI.

**Key terms**
- **`*testing.T`** — the handle passed to every test; carries failure state, logging, parallel/cleanup hooks.
- **Table-driven test** — a slice of input/expected structs iterated to exercise many cases through one code path.
- **Subtest** — a nested test launched via `t.Run(name, fn)`, individually addressable with `-run`.
- **`t.Parallel()`** — signals a test (or subtest) may run concurrently with other parallel tests.
- **`*testing.B`** — benchmark handle; the harness tunes `b.N` until timing is statistically stable.
- **Golden file** — a checked-in expected-output file compared against, regenerated via an `-update` flag.
- **`TestMain`** — optional `func TestMain(m *testing.M)` giving package-level setup/teardown around `m.Run()`.
- **`t.Cleanup`** — registers teardown that runs when the test and its subtests finish, LIFO order.
- **Fuzz target** — `func FuzzXxx(f *testing.F)` that feeds randomized inputs to find crashing/invariant-breaking cases.
- **Coverage profile** — `-coverprofile` output rendered by `go tool cover` as percentages or HTML.
- **`b.ReportAllocs()`** — adds allocations/op to benchmark output, the metric that catches regressions.
- **`testdata/`** — a magic directory name `go test` ignores for build purposes, used for fixtures and goldens.

**Why interviewers ask this** — Testing reveals engineering maturity faster than almost any other topic. Juniors describe tests as a chore that proves code "works"; seniors talk about tests as a design tool and a regression net, and they know the toolchain cold — `-run`, `-bench`, `-race`, `-coverprofile`, `t.Cleanup` vs `defer`, why `b.N` exists. The strongest signal is someone who reaches for hand-written fakes and a small interface instead of a mocking framework, who knows that `-race` belongs in CI, and who can articulate the *limits* of coverage rather than chasing 100%. Interviewers also probe for the subtle traps: benchmarks the compiler optimizes away, `t.Fatal` in goroutines, parallel subtests capturing loop variables (a real bug pre-Go 1.22). Knowing these distinguishes someone who has actually shipped and debugged Go tests from someone who has only read about them.

**Common confusions**
- **"I need a mocking framework like Mockito."** — Idiomatic Go uses small interfaces and hand-written fakes; frameworks are the exception.
- **"`t.Parallel` makes my test faster on its own."** — It only enables concurrency *with other parallel tests*; a lone parallel test gains nothing.
- **"`b.N` is a number I set."** — The harness sets it, scaling up until measurements stabilize; you loop `for range b.N`.
- **"100% coverage means well-tested."** — Coverage measures lines executed, not assertions made or cases considered.
- **"`t.Fatal` works anywhere."** — Calling it off the test goroutine leaks the goroutine and doesn't fail the test correctly; use `t.Error` + return.
- **"Fuzzing replaces unit tests."** — Fuzzing finds inputs that break invariants; it complements, not replaces, example-based tests.

**What follows from this topic** — Testing connects to nearly every other Go area. Concurrency tests lean on the race detector and careful goroutine/`t.Fatal` discipline. Benchmarks feed directly into the performance and profiling topic (pprof, escape analysis, `GOMEMLIMIT`). Interface-based mocking is the practical payoff of Go's structural typing and dependency-injection patterns. Fuzzing overlaps with the security topic (`govulncheck`, input validation). And `TestMain` plus build tags underpin integration testing against real databases and HTTP servers.

### Q47. Explain the testing package: *testing.T, table-driven tests, t.Run subtests, and t.Parallel.

A test is any `func TestXxx(t *testing.T)` in a `_test.go` file. `t` is your interface to the harness: `t.Errorf` records a failure and keeps going, `t.Fatalf` records and stops *this* test by calling `runtime.Goexit`, `t.Log` emits output shown only on failure or with `-v`, and `t.Helper()` marks a function so failures report the caller's line, not the helper's.

Table-driven tests are the dominant idiom. You define a slice of cases and loop, running each as a subtest so failures are individually named and `-run TestParse/negative` can target one:

```go
func TestParse(t *testing.T) {
	tests := []struct {
		name    string
		in      string
		want    int
		wantErr bool
	}{
		{"simple", "42", 42, false},
		{"negative", "-7", -7, false},
		{"garbage", "x", 0, true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := Parse(tt.in)
			if (err != nil) != tt.wantErr {
				t.Fatalf("err = %v, wantErr %v", err, tt.wantErr)
			}
			if got != tt.want {
				t.Errorf("got %d, want %d", got, tt.want)
			}
		})
	}
}
```

`t.Run` gives you a fresh `*testing.T` per case, hierarchical naming, and the ability to bail one case with `t.Fatal` without killing the others. `t.Parallel()` inside a subtest signals it can run concurrently — the harness pauses it until the enclosing test returns, then runs all paused siblings together, bounded by `GOMAXPROCS` (override with `-parallel`).

One classic trap: before **Go 1.22**, the loop variable `tt` was shared across iterations, so a parallel subtest closing over `tt` would see the *last* value. The fix was `tt := tt` inside the loop. Go 1.22 changed loop semantics so each iteration gets a fresh variable — the shadow is no longer needed, but you'll still see it in older code and it remains harmless. Use `t.Cleanup(fn)` over `defer` for teardown that must also cover spawned subtests; cleanups run LIFO when the test and its subtests complete.

### Q48. How do you write benchmarks (*testing.B), and how do you avoid the compiler optimizing your benchmark away?

A benchmark is `func BenchmarkXxx(b *testing.B)` and you loop `b.N` times. The harness calls your function repeatedly, increasing `b.N` until the timed region runs long enough (default ~1s) for a stable ns/op number. You never set `b.N`; you only consume it.

```go
func BenchmarkParse(b *testing.B) {
	b.ReportAllocs()
	for range b.N { // Go 1.22 range-over-int; pre-1.22: for i := 0; i < b.N; i++
		_, _ = Parse("12345")
	}
}
```

Run with `go test -bench=. -benchmem`. Always call `b.ReportAllocs()` (or pass `-benchmem`) — allocs/op catches regressions that ns/op alone hides, and allocation pressure is usually the real story. If you have expensive setup, do it before the loop and call `b.ResetTimer()`; use `b.StopTimer`/`b.StartTimer` to exclude per-iteration setup, though those have overhead.

The optimizer trap: if your benchmark's result is unused, the compiler may eliminate the whole call as dead code, and you'll measure nothing. The standard defenses are to assign the result to a package-level sink, or in **Go 1.24+** use the new `b.Loop()` form which the runtime guarantees won't be optimized away:

```go
var sink int

func BenchmarkAdd(b *testing.B) {
	var r int
	for range b.N {
		r = Add(2, 3) // without escaping r, this can vanish
	}
	sink = r // keep it alive
}
```

```go
// Go 1.24+: b.Loop() prevents dead-code elimination and hoists setup automatically
func BenchmarkAdd(b *testing.B) {
	for b.Loop() {
		Add(2, 3)
	}
}
```

For statistical rigor, run with `-count=10` and feed the output to `benchstat`, which reports mean and variance and tells you whether a delta between two runs is real or noise. A single benchmark run is nearly meaningless — CPU frequency scaling and background load swamp small differences.

### Q49. Mocking in Go without a framework — interfaces + hand-written fakes vs gomock. Idiomatic approach.

Idiomatic Go mocks with interfaces, and the key move is *defining the interface at the consumer, not the producer*. Your code depends on a small interface describing only the methods it uses, and in tests you pass a hand-written fake. This works because Go interfaces are satisfied structurally — no `implements` keyword, so a test fake just needs the right method set.

```go
type Store interface {
	Get(ctx context.Context, id string) (User, error)
}

type fakeStore struct {
	users map[string]User
	err   error
}

func (f *fakeStore) Get(_ context.Context, id string) (User, error) {
	if f.err != nil {
		return User{}, f.err
	}
	u, ok := f.users[id]
	if !ok {
		return User{}, ErrNotFound
	}
	return u, nil
}
```

Keep interfaces narrow — one or two methods is common. A wide interface forces a wide fake and signals the consumer is doing too much. For one-off behavior, a function-field fake is even lighter: `type fakeStore struct{ getFn func(...) (User, error) }`, then set `getFn` per test case.

When does a framework earn its place? `gomock` (now `go.uber.org/mock`) generates mocks via `mockgen` and gives you call-count and ordering assertions; `testify/mock` offers a similar expectation API. They're worth it for *large* interfaces you don't own (a generated gRPC client) or when you genuinely need to assert "called exactly twice, in this order." But the cost is real: generated code to keep in sync, brittle expectation chains, and tests that assert *interactions* rather than *outcomes*. My default is hand-written fakes; reach for `gomock` only when the interface is large and externally owned. Avoid mocking what you don't own directly — wrap third-party clients in your own narrow interface and fake that, which also insulates you from upstream API churn.

### Q50. Test fixtures and golden files, TestMain, and managing setup/teardown.

Fixtures live in `testdata/` — a directory name `go test` treats specially: it's excluded from the build and the package's working directory during tests is the package dir, so `os.ReadFile("testdata/input.json")` just works. Golden files are the pattern for asserting large or structured output: store the expected bytes in `testdata/foo.golden`, compare, and add an `-update` flag to regenerate them when behavior legitimately changes.

```go
var update = flag.Bool("update", false, "update golden files")

func TestRender(t *testing.T) {
	got := Render(input)
	golden := filepath.Join("testdata", "render.golden")
	if *update {
		os.WriteFile(golden, got, 0o644)
	}
	want, _ := os.ReadFile(golden)
	if !bytes.Equal(got, want) {
		t.Errorf("output mismatch; run go test -update to regenerate")
	}
}
```

`TestMain` gives you package-level setup/teardown: define `func TestMain(m *testing.M)`, do your setup, call `m.Run()`, do teardown, then `os.Exit(code)`. This is where you spin up a test database container, run migrations, or start a shared HTTP server once for the whole package. The critical gotcha: you must call `os.Exit` yourself, and `os.Exit` skips deferred functions — so run teardown *before* exiting, not in a `defer`:

```go
func TestMain(m *testing.M) {
	pool := mustStartPostgres()
	code := m.Run()
	pool.Close() // explicit; a defer here would never run
	os.Exit(code)
}
```

For per-test setup prefer `t.Cleanup` over `defer` — it runs after the test *and its subtests* finish, composes across helper functions (each helper can register its own cleanup), and runs LIFO so resources tear down in reverse order of creation. A helper that opens a temp file and calls `t.Cleanup(func(){ os.Remove(f) })` is self-contained: callers don't have to remember teardown. Use `t.TempDir()` for scratch directories — it's auto-removed and unique per test, eliminating cleanup code entirely.

### Q51. Fuzzing (Go 1.18+): how does the built-in fuzzer work and what does a fuzz target look like?

Native fuzzing landed in **Go 1.18** as part of the standard toolchain. A fuzz target is `func FuzzXxx(f *testing.F)`. You seed it with example inputs via `f.Add(...)`, then call `f.Fuzz` with a function whose parameters (after `*testing.T`) are the fuzzed arguments. The fuzzer mutates the seed corpus and feeds randomized inputs, looking for inputs that panic, fail an assertion, or break an invariant you check.

```go
func FuzzParseAndFormat(f *testing.F) {
	f.Add("42")
	f.Add("-7")
	f.Fuzz(func(t *testing.T, s string) {
		n, err := Parse(s)
		if err != nil {
			return // invalid input is fine; we only care about crashes/invariants
		}
		// round-trip invariant: Parse(Format(Parse(s))) is stable
		got, err := Parse(Format(n))
		if err != nil || got != n {
			t.Errorf("round-trip failed for %q: got %d, err %v", s, got, err)
		}
	})
}
```

The fuzzed argument types are limited to what the engine knows how to mutate: `[]byte`, `string`, the integer and float types, `bool`, and `rune`. By default `go test` runs only the seed corpus as regular test cases (so fuzz targets double as unit tests in CI). To actually fuzz you run `go test -fuzz=FuzzParseAndFormat -fuzztime=30s`, which mutates inputs continuously.

When the fuzzer finds a failing input, it minimizes it and writes it to `testdata/fuzz/<FuzzName>/` as a new corpus entry. That file is checked in and becomes a permanent regression test — the next plain `go test` run replays it. The best fuzz targets check *invariants* rather than exact outputs: round-trip properties (parse∘format), "never panics," "output always valid UTF-8," or differential checks against a reference implementation. Fuzzing has historically found real bugs in `encoding/json`, `image`, and the standard library's parsers; it shines on anything that consumes untrusted bytes.

### Q52. How do you measure and enforce coverage, and what are the limits of coverage as a quality signal?

Measure with `go test -coverprofile=cover.out ./...`, then render: `go tool cover -func=cover.out` for per-function percentages or `go tool cover -html=cover.out` for a line-highlighted browser view. Use `-covermode=atomic` when combining with `-race` so concurrent tests count lines correctly (`set`/`count` aren't goroutine-safe). A notable **Go 1.20** addition: `go build -cover` lets you collect coverage from *integration tests* of a running binary via `GOCOVERDIR`, not just unit tests — useful for end-to-end suites.

Enforcing a threshold in CI is straightforward but has no built-in flag; you parse the total. A common pattern:

```bash
go test -coverprofile=cover.out ./...
go tool cover -func=cover.out | awk '/^total:/ {print $3}' # e.g. "78.4%"
```

Then fail the build if it drops below a number (or below the previous commit's number, which catches regressions without bikeshedding the absolute target).

Now the limits, which is what interviewers actually want. Coverage measures *which lines executed*, not *whether you asserted anything about the result*. A test that calls a function and checks nothing produces 100% coverage and zero confidence. It says nothing about whether you tested the *right* inputs — boundary values, error paths, concurrent access, the empty case. It can't see missing branches you never wrote, and it rewards the wrong behavior: chasing 100% pushes people to test trivial getters and error-wrapping while leaving the genuinely hard logic under-specified. Mutation testing (e.g. `go-mutesting`) is a better signal — it changes your code and checks whether tests fail — but it's slow and rarely run in CI. My position: use coverage as a *ratchet* to prevent regressions and to surface entirely untested files, not as a quality target. 80% with thoughtful assertions on the hard paths beats 100% of shallow line-touching every time, and the race detector (`-race` in CI) catches a class of bugs coverage can't even model.

---

## Modules & Build

### Summary

**What this topic covers** — This topic is about how Go turns a directory of source files plus a dependency graph into a reproducible binary. It covers the module system introduced in Go 1.11 and made mandatory by 1.16: `go.mod` and `go.sum`, semantic import versioning, minimal version selection (MVS), the `/v2` major-version rule, build constraints and file-name conventions that drive conditional compilation, vendoring versus the module cache, and the reproducibility machinery — `GOTOOLCHAIN`, workspace mode (`go.work`), and the `replace`/`exclude` directives. The thread running through all of it: builds should be deterministic, auditable, and explainable without a network round-trip.

**Mental model** — Think of a Go build as a pure function of (source tree, module graph, toolchain version, GOOS/GOARCH, build tags). Pin all five and you get a byte-identical binary. `go.mod` declares your *direct* dependencies and the minimum version of each you require; the full graph is computed transitively. MVS is the algorithm that resolves that graph: for each module, take the maximum of the minimum versions anyone asked for — never "latest." That's the opposite of npm/SAT-solver resolution, and it's why Go builds are stable: adding a dependency can't silently float your transitive versions forward. `go.sum` is a tamper-evidence ledger of cryptographic hashes, not a lockfile — MVS already makes versions deterministic, so `go.sum` only verifies that the bytes you downloaded match what the graph resolved to. Major versions are different *import paths*, not just different tags, which is how Go lets v1 and v2 of a library coexist in one build. Everything else — vendoring, toolchain pinning, workspaces — is about controlling the inputs to that pure function.

**Key terms**
- **`go.mod`** — declares the module path, Go version, and `require`/`replace`/`exclude`/`retract` directives.
- **`go.sum`** — content hashes (module zip + its `go.mod`) for integrity verification; not a version lock.
- **MVS** — minimal version selection: resolve each module to the highest of its minimum required versions.
- **Semantic import versioning** — major version ≥ 2 appears in the import path (`/v2`, `/v3`).
- **Module path** — the import prefix declared by `module` in `go.mod`, e.g. `github.com/org/repo`.
- **`+incompatible`** — pseudo-suffix for v2+ tags from repos that predate modules and lack a `/vN` path.
- **Pseudo-version** — synthetic version for untagged commits, e.g. `v0.0.0-20230101000000-abcdef123456`.
- **`GOFLAGS`** — env var of default flags applied to every `go` command, e.g. `-mod=vendor`.
- **`GONOSUMCHECK`/`GONOSUMDB`/`GOSUMDB`** — controls for the checksum database (`sum.golang.org`).
- **`GOTOOLCHAIN`** — selects which Go toolchain version actually runs the build.
- **`go.work`** — workspace file overlaying multiple local modules for cross-module development.
- **Build constraint** — `//go:build` line or `_GOOS`/`_GOARCH` filename suffix gating compilation.

**Why interviewers ask this** — Build and module questions separate people who *use* Go from people who *ship* Go. A junior knows `go get` and `go build`. A senior can explain why a CI build broke when someone ran `go get -u`, debug a `go.sum` mismatch in an air-gapped pipeline, reason about why MVS won't pick the version they expected, and structure a multi-module repo without circular `replace` hell. Interviewers probe this because dependency and supply-chain incidents are operational reality — a botched major-version migration, a non-reproducible build, a `replace` directive accidentally committed pointing at someone's laptop. The signal they want: do you treat the build as something to engineer and audit, or as magic that "just works" until it doesn't?

**Common confusions**
- **"`go.sum` is a lockfile like `package-lock.json`."** No — MVS makes the version selection deterministic from `go.mod` alone; `go.sum` only verifies integrity.
- **"MVS picks the latest compatible version."** It picks the *minimum* that satisfies all requirements — the maximum of the minimums, never beyond.
- **"`/v2` is just a Git tag."** It's a distinct import path; v1 and v2 are different modules that can coexist.
- **"Vendoring is obsolete now that there's a module cache."** Vendoring still matters for air-gapped builds, audit, and zero-network CI.
- **"`replace` is fine to commit."** Local-path `replace` directives break everyone else's build; use `go.work` for that.

**What follows from this topic** — Reproducible builds feed directly into supply-chain security (`govulncheck`, the checksum database, SBOMs) and into the testing/CI topics where build tags gate integration tests. The `GOOS`/`GOARCH` cross-compilation story connects to deployment and container topics. And once you understand that a build is a pure function of pinned inputs, the toolchain-and-runtime topics — `GODEBUG` toggles, `GOMEMLIMIT`, runtime versioning — become much easier to reason about, because they're all just more inputs to pin.

### Q53. Explain Go modules: go.mod, go.sum, semantic import versioning, and minimal version selection (MVS).

A module is a tree of packages with a `go.mod` at its root. That file declares the module path (the import prefix), the minimum Go version, and the dependency requirements:

```go
module github.com/org/service

go 1.22

require (
	github.com/go-chi/chi/v5 v5.0.12
	golang.org/x/sync v0.7.0
)
```

The key thing about each `require` line: it states a **minimum** version, not a pin and not a range. `go.sum` sits beside it holding two hashes per dependency — one for the module zip, one for that module's `go.mod` — so the toolchain can verify on download that the bytes match what the checksum database (`sum.golang.org`) recorded. People reach for the npm analogy and call `go.sum` a lockfile; it isn't. There's no separate resolution step to lock, because MVS makes resolution a deterministic function of the `go.mod` graph.

MVS is the part that surprises people. To resolve a module's version, Go walks the transitive `require` graph, collects every minimum version anyone asked for, and picks the **highest of those minimums**. That's it — no SAT solver, no "latest compatible." If your `go.mod` says `v1.2.0` and a dependency says `v1.4.0`, you get `v1.4.0`. Nobody gets `v1.9.0` just because it exists. This is why `go build` never silently floats you forward and why builds stay stable across machines and months.

Semantic import versioning is the rule that the major version lives in the import path for v2 and up (`github.com/org/lib/v2`). Within a major version, MVS assumes backward compatibility, which is the contract that makes "max of minimums" safe.

The practical upshot: `go get -u` is the *only* thing that upgrades you, and it edits `go.mod`. A plain `go build` will never change your versions. When someone says "the build broke and I didn't change anything," the first question is whether `go.mod`/`go.sum` changed in the diff.

### Q54. How do major version bumps work (the /v2 import path rule)? Why does Go do this?

For v0 and v1, the import path has no version suffix. Starting at v2, the major version becomes part of both the module path and every import path:

```go
// go.mod
module github.com/org/lib/v2

// consumer
import "github.com/org/lib/v2"
```

The reason is the **import compatibility rule**: if an import path is the same, the packages must be backward compatible. A breaking change *must* change the import path. Because the major version is in the path, `github.com/org/lib` and `github.com/org/lib/v2` are, to the build, two entirely different modules. That's not a hack — it's the mechanism that lets a single binary depend on v1 (pulled in transitively by some old dependency) and v2 (used by your code) simultaneously, with no diamond conflict. In a language without this, that's a build failure or a runtime surprise.

To actually cut a v2 you do three things: bump the `module` line in `go.mod` to end in `/v2`, update all *internal* imports within the module to the `/v2` path, and tag `v2.0.0`. You can do this on a `v2/` subdirectory or on the repo root — Go supports both layouts.

The wart you'll hit in the wild is `+incompatible`. If a repo released `v2.0.0`+ tags *before* adopting modules (so it has no `/v2` in its path), Go tolerates it with a synthetic suffix: `v2.1.0+incompatible`. It works, but it signals the library never properly adopted semantic import versioning, and you lose the ability to import multiple majors side by side. When you see `+incompatible` in a `go.mod`, that's the story.

### Q55. Build constraints / build tags and platform-specific files (_linux.go, _test.go). Give examples.

Go has two mechanisms for conditional compilation, and they compose. The first is the **filename suffix**: a file named `cache_linux.go` only compiles on `GOOS=linux`; `cache_arm64.go` only on `GOARCH=arm64`; `cache_linux_amd64.go` requires both. `_test.go` is the same machinery — those files only compile under `go test`. This is purely a naming convention, no comment required.

The second is the **`//go:build` constraint line**, which must appear before the `package` clause with a blank line after it:

```go
//go:build linux && (amd64 || arm64) && !cgo

package fastpath
```

The old form was `// +build linux,amd64`; since Go 1.17 the canonical form is `//go:build` with real boolean operators (`&&`, `||`, `!`, parens). `gofmt` will keep the legacy `// +build` line in sync if both are present, but new code should use only `//go:build`.

These cover more than OS/arch. You can gate on the Go version (`//go:build go1.21`), on `cgo`, on custom tags you pass yourself, and on the experimental `goexperiment.*` flags. Custom tags are the common pattern for integration tests:

```go
//go:build integration

package db_test
// run with: go test -tags=integration ./...
```

A real-world example: in cross-platform code you put the syscall-heavy implementation in `poller_linux.go` (epoll) and `poller_darwin.go` (kqueue), with a shared `poller.go` declaring the interface. The compiler picks exactly one per target, and there's no runtime `if runtime.GOOS ==` branching. One gotcha worth flagging in review: a file with *only* a build constraint that excludes the current platform still has to parse, and if you typo the constraint (e.g. forget the blank line after `//go:build`) it's silently treated as a normal comment and the file compiles everywhere — `go vet` catches this.

### Q56. How do you vendor dependencies and when should you? go mod vendor vs the module cache and GOFLAGS.

`go mod vendor` copies every dependency's source needed to build the module into a top-level `vendor/` directory and writes `vendor/modules.txt` recording what's there. Once that directory exists, the `go` command *automatically* builds from it (`-mod=vendor` is implied when `vendor/` is present and consistent with `go.mod`). The module cache (`$GOPATH/pkg/mod`, shared across projects, content-addressed and read-only) is the alternative source — it's what you use when there's no `vendor/` dir.

The decision matrix:

| Concern | Vendor | Module cache |
|---|---|---|
| Offline / air-gapped builds | Yes, zero network | Needs cache pre-populated |
| Build reproducibility | Source is in your repo | Relies on `go.sum` + proxy |
| Audit / supply-chain review | `git diff vendor/` shows every change | Review `go.mod`/`go.sum` deltas |
| Repo size | Bloated, large diffs | Clean |
| Multi-project disk usage | Duplicated per repo | Shared once |

My default for application repos in regulated or air-gapped environments is to vendor — a reviewer can see exactly what bytes a dependency bump pulls in, and CI needs no proxy access. For libraries and most open-source apps, skip it and rely on the cache plus the proxy (`proxy.golang.org`) and checksum DB.

Two operational notes. First, you can force vendor mode regardless of directory presence via `GOFLAGS=-mod=vendor`, or force the cache with `-mod=mod` — handy in CI to fail loudly if `vendor/` drifts. Run `go mod verify` to confirm the cache contents still match `go.sum`. Second, after any dependency change you must re-run `go mod vendor`; a stale `vendor/modules.txt` that disagrees with `go.mod` makes the build error out rather than silently fall back, which is the behavior you want.

### Q57. Reproducible builds: GOTOOLCHAIN, the Go workspace mode (go.work), and replace/exclude directives.

Reproducibility means pinning every input to the build function. The most overlooked input is the **toolchain itself**, and since Go 1.21 the `go` directive plus `GOTOOLCHAIN` control it. If your `go.mod` says `go 1.22.0` and you've also got a `toolchain go1.22.5` line, a developer on 1.21 will have the `go` command transparently download and run 1.22.5. Set `GOTOOLCHAIN=local` to forbid that auto-download (the build fails if your installed toolchain is too old — exactly what you want in a hermetic CI image), or `GOTOOLCHAIN=go1.22.5` to force a specific one. This killed the old "works on my machine because I'm on a different Go" class of bug.

**Workspace mode** (`go.work`, Go 1.18) solves cross-module local development. Instead of committing a `replace` pointing at `../otherlib` — which breaks everyone who doesn't have that checkout — you create a `go.work` that overlays multiple local modules:

```
go 1.22

use (
	./service
	./sharedlib
)
```

Builds inside the workspace resolve `sharedlib` to your local copy without touching any `go.mod`. The rule: **`go.work` is for your machine — gitignore it** (or commit it only in deliberately monorepo-shaped repos). It's the right tool for the job that people used to abuse `replace` for.

`replace` and `exclude` live in `go.mod`. `replace github.com/org/lib => ./fork` or `=> github.com/org/lib v1.2.4-patched` redirects a module to a fork, a local path, or a pinned version — legitimate for vendoring a security patch before upstream merges it. `exclude github.com/org/lib v1.3.0` tells MVS to skip a known-bad version. The senior caution: a local-path `replace` committed to a shared repo is a classic landmine — it builds on the author's laptop and nowhere else. In review, treat any `replace => ./` or `=> /Users/...` in a committed `go.mod` as a bug, and reach for `go.work` instead.

---

## Performance & Profiling

### Summary

**What this topic covers** — This topic is about making Go programs fast and proving why they were slow. It spans the `runtime/pprof` and `net/http/pprof` profilers (CPU, heap, goroutine, block, mutex), the execution tracer (`go tool trace`), benchmark-driven measurement (`go test -bench` with `-benchmem`), and the practical engineering of reducing allocations, avoiding reflection, buffering IO, and picking the right data structure. The throughline is a discipline: measure before you optimize, and let the tool — not your intuition — point at the hot path.

**Mental model** — A senior engineer treats performance work as a feedback loop, never a guessing game. The model is: form a hypothesis, capture a profile under representative load, read it top-down by cumulative cost to find the expensive subtree, then drill into flat cost to find the leaf doing the actual work. CPU profiles answer "where are cycles spent?"; heap profiles answer "what is allocating and surviving GC?"; the tracer answers "why is wall-clock time elapsing when CPUs are idle?" — scheduling, GC pauses, blocking syscalls, lock contention. You hold two distinct clocks in your head: on-CPU time (what pprof samples) and wall-clock time (what the tracer shows). Most "it's slow" mysteries that pprof can't explain are wall-clock problems: a goroutine blocked on a channel, a mutex, or a network read. You also internalize that allocation is the dominant tunable cost in Go — fewer allocations means less GC pressure, better cache locality, and less work overall — so `-benchmem` and the heap profile are where you spend most of your time.

**Key terms**
- **pprof** — sampling profiler and the tool (`go tool pprof`) that reads its output.
- **Flat time** — time spent in a function itself, excluding callees.
- **Cumulative time** — time in a function plus everything it calls.
- **Heap profile** — sampled allocation profile; `inuse_space` (live) vs `alloc_space` (cumulative).
- **Goroutine profile** — stack traces of all current goroutines; the leak detector.
- **Block profile** — time goroutines spend blocked on sync primitives/channels.
- **Mutex profile** — contention on `sync.Mutex`/`RWMutex`.
- **Execution tracer** — `go tool trace`; per-goroutine, per-P timeline of scheduling/GC events.
- **GOMEMLIMIT** — Go 1.19 soft memory cap that paces the GC.
- **Escape analysis** — compiler decision on whether a value lives on stack or heap.
- **`-benchmem`** — benchmark flag reporting allocs/op and B/op.
- **Sampling rate** — `runtime.SetBlockProfileRate`, `SetMutexProfileFraction` control block/mutex granularity.

**Why interviewers ask this** — Optimization separates engineers who "feel" slowness from those who localize it. A junior says "I think the JSON parsing is slow" and rewrites it; a senior captures a profile, sees JSON is 4% flat while a `regexp.MustCompile` inside a loop is 60% cumulative, and fixes the real thing. Interviewers want to see you reach for `pprof` reflexively, distinguish flat from cumulative without fumbling, know that CPU profiles are useless for diagnosing a lock-bound service (you'd want the mutex profile or the tracer instead), and understand allocation as the central GC cost. They're also probing for production maturity: can you profile a live service without taking it down, and do you know `net/http/pprof` is a footgun if exposed publicly. The strongest signal is someone who says "I'd benchmark it first" before proposing any change.

**Common confusions**
- **"The function with the highest flat time is the bottleneck."** Not necessarily — a cheap leaf called millions of times shows high flat but the fix is in the caller's algorithm; read cumulative top-down first.
- **"pprof shows me where my program waits."** No — CPU pprof only samples on-CPU work. Blocking I/O and lock waits are invisible; use the tracer or block profile.
- **"Importing `net/http/pprof` adds overhead."** The CPU/heap profilers are off until you hit an endpoint; the import just registers handlers. Block/mutex profiling is what costs, and only when enabled.
- **"More goroutines = faster."** Often the opposite — contention and scheduler churn. The tracer reveals it.
- **"`sync.Pool` always helps."** It only helps for short-lived, high-churn allocations; misused it just hides bugs and adds complexity.

**What follows from this topic** — Performance work connects to Concurrency (the tracer is where goroutine and channel design pays off or fails), Memory & GC (escape analysis, `GOMEMLIMIT`, allocation reduction), and Testing (benchmarks are the regression guard). It also feeds Production Readiness: continuous profiling and `expvar`/metrics are how you keep these wins from silently regressing across releases.

### Q58. Explain pprof: CPU, heap, goroutine, block, and mutex profiles. How do you capture and read them?

pprof is Go's built-in sampling profiler. There are five profiles worth knowing, and they answer different questions:

| Profile | Answers | How it's collected |
|---|---|---|
| CPU | Where are cycles spent? | Samples the stack ~100x/sec while on-CPU |
| Heap | What's allocating / what's live? | Samples allocations (every ~512KB by default) |
| Goroutine | What is every goroutine doing right now? | Snapshot of all stacks |
| Block | Where do goroutines wait on sync/channels? | Sampled, off by default |
| Mutex | Where is lock contention? | Sampled, off by default |

In a benchmark you capture them directly:

```go
go test -bench=. -cpuprofile=cpu.out -memprofile=mem.out -benchmem
```

Or programmatically with `runtime/pprof`:

```go
f, _ := os.Create("cpu.out")
pprof.StartCPUProfile(f)
defer pprof.StopCPUProfile()
```

Block and mutex profiles are *opt-in* because they add overhead — you enable them explicitly:

```go
runtime.SetBlockProfileRate(1)        // sample every blocking event (1 = max detail)
runtime.SetMutexProfileFraction(1)    // sample every contention event
```

You read them with `go tool pprof cpu.out`. The commands you'll use 90% of the time: `top` (ranked by flat), `top -cum` (by cumulative), `list <func>` (annotated source with per-line cost), and `web` (SVG call graph, needs Graphviz). For a quick visual, `go tool pprof -http=:8080 cpu.out` opens an interactive flame graph in the browser — that's usually where I start now.

The two mistakes I watch for: people grab a *heap* profile to diagnose a *CPU* problem (wrong clock), and people forget that block/mutex profiles return nothing useful unless they set the rate first.

### Q59. How do you profile a running service safely in production (net/http/pprof, continuous profiling)?

The standard move is the blank import:

```go
import _ "net/http/pprof"
```

That registers handlers under `/debug/pprof/` on `http.DefaultServeMux`. Then you pull profiles over HTTP without restarting anything:

```bash
go tool pprof http://localhost:6060/debug/pprof/profile?seconds=30   # 30s CPU
go tool pprof http://localhost:6060/debug/pprof/heap
curl http://localhost:6060/debug/pprof/goroutine?debug=2             # full goroutine dump
```

The critical safety rule: **never expose `/debug/pprof/` publicly.** It leaks stack traces, lets anyone trigger an expensive CPU profile (a trivial DoS), and the goroutine dump can reveal secrets in stack frames. Bind it to a separate internal-only port or a private mux, gated behind auth or a network policy. If you `import _ "net/http/pprof"` and also run a public server on `DefaultServeMux`, you've just published it — run pprof on its own `http.Server` with a dedicated listener.

```go
go func() {
    log.Println(http.ListenAndServe("localhost:6060", nil)) // localhost only
}()
```

For ongoing visibility, continuous profiling is the modern answer: agents like Grafana Pyroscope, Datadog, or Google Cloud Profiler periodically scrape these endpoints and store profiles over time, so when latency spikes at 3am you can diff "now" against "yesterday" instead of trying to reproduce it. The CPU/heap profilers are cheap enough (sampling) to run continuously in prod; block and mutex profiling are heavier, so enable those only when investigating a specific contention problem, not by default.

### Q60. Reading a CPU profile: flat vs cumulative, and how to spot the real hot path. Walk through an example.

**Flat** is time spent inside a function's own body. **Cumulative** is flat plus everything that function called. The hot path lives where cumulative is high but flat is low until you reach the leaf doing the real work.

Say `go tool pprof` shows `top`:

```
      flat  flat%   cum   cum%
     2.10s  42%    2.10s  42%   runtime.mallocgc
     0.40s   8%    4.50s  90%   encoding/json.Marshal
     0.05s   1%    4.30s  86%   (*Handler).serializeResponse
```

Read top-down by `cum`: `serializeResponse` is 86% cumulative but 1% flat — it's not slow itself, it's a *conduit*. Below it, `json.Marshal` is 90% cum / 8% flat, and `runtime.mallocgc` is 42% flat. The story writes itself: serialization is allocating like crazy and the GC is eating the CPU. The flat winner (`mallocgc`) is a symptom; the cause is the call chain above it.

I'd then run `list serializeResponse` to see the offending line, and check the heap profile to confirm allocations. The fix is usually upstream — reuse a buffer with a `sync.Pool` or `json.Encoder` over a pooled `bytes.Buffer`, switch to a streaming encoder, or precompute. Chasing `mallocgc` directly is pointless; you can't optimize the allocator, you reduce the calls to it.

The discipline: **`top -cum` finds the expensive subtree, `top` (flat) finds the leaf, `list` finds the line.** Never optimize the first thing with high flat time — confirm it's not just a hot leaf doing necessary work.

### Q61. Common Go performance wins: reducing allocations, avoiding reflection, buffering IO, and using the right data structure.

Allocations are the number one tunable cost because every heap allocation feeds the GC. Concrete wins:

- **Preallocate slices and maps** with known capacity: `make([]T, 0, n)` and `make(map[K]V, n)` avoid repeated grow-and-copy. This is often a 2-3x win in a hot loop for free.
- **Reuse buffers** via `sync.Pool` or a reused `bytes.Buffer`/`[]byte` for high-churn short-lived objects (request encoding, scratch space). Don't pool things with long or unpredictable lifetimes.
- **Pass by value for small structs**, but watch escape analysis: returning a pointer to a local forces a heap allocation. Build with `go build -gcflags=-m` to see escape decisions.
- **Avoid `interface{}`/`any` in hot paths** — boxing a value into an interface allocates. Generics (Go 1.18) let you write one implementation without the boxing cost.

Reflection (`reflect`, and the reflection-based `encoding/json`) is slow and allocates heavily. For hot serialization paths, code-generated marshalers (easyjson, or hand-written `MarshalJSON`) or `encoding/json/v2` patterns beat reflection by a wide margin.

Buffered IO is the cheapest possible win people forget. Writing to a raw `os.File` or `net.Conn` byte-by-byte is a syscall per write; wrap it:

```go
w := bufio.NewWriter(conn)
defer w.Flush()
```

Right data structure matters more than micro-tuning: a `map[K]struct{}` for set membership beats scanning a slice; a slice beats a map for small, ordered, iterate-heavy collections (cache locality); and `strings.Builder` beats `+=` concatenation in a loop (which is O(n²) allocations). Measure each change with `go test -bench=. -benchmem` and compare with `benchstat` — if allocs/op doesn't drop, you didn't actually fix it.

### Q62. Execution tracer (go tool trace) vs pprof — when does the trace tell you something the profile cannot?

pprof samples *on-CPU* work. The execution tracer records *events* — goroutine create/start/block/unblock, GC phases, syscalls, network blocking — with timestamps, giving you a wall-clock timeline per goroutine and per processor (P). They answer different questions, and the tracer wins precisely when your bottleneck is *not* CPU.

Capture it like CPU profiling:

```go
go test -bench=. -trace=trace.out
# or in a service: GET /debug/pprof/trace?seconds=5
go tool trace trace.out
```

Reach for the tracer when:

- **The service is slow but CPUs are idle.** pprof shows nothing hot because the time is spent *blocked* — on a channel, a mutex, a DB round-trip. The tracer's goroutine analysis shows the wait directly.
- **You suspect GC pauses or scheduling problems.** The trace shows STW pauses, GC assist time stealing from your goroutines, and goroutines stuck in "runnable" but not running (GOMAXPROCS starvation).
- **Latency is bursty, not throughput-bound.** A p99 spike that averages out in a profile shows up as a clear stall on the timeline.
- **You want to see concurrency actually happening** — whether your 8 workers run in parallel or serialize behind one lock.

The mental split: **pprof tells you what's expensive; the tracer tells you why time is passing.** If you've optimized CPU to the floor and the service is still slow, the answer is almost always in the trace — blocking, contention, or GC — not the profile. The tracer is heavier and produces large files, so capture short windows (a few seconds) around a known slow event rather than running it continuously.

---

## Web Services & HTTP

### Summary

**What this topic covers** — This topic is about building HTTP services with Go's `net/http` package: the middleware idiom, handler structuring and dependency injection, the `http.Client` and its pitfalls, graceful shutdown, request validation and panic recovery, and routing choices including the 1.22 `ServeMux` upgrade versus third-party frameworks. Go's standard library is genuinely production-grade for HTTP — most services never need a framework — so the bar here is knowing the stdlib well enough to decide when not to reach for one.

**Mental model** — An HTTP server in Go is a tree of `http.Handler` values, where `Handler` is just an interface with one method: `ServeHTTP(w http.ResponseWriter, r *http.Request)`. Everything composes around that. A middleware is a function that takes a `Handler` and returns a `Handler` — it's decoration, not inheritance. A router is a `Handler` that dispatches to other `Handler`s by matching method and path. The `*http.Request` carries a `context.Context` that is cancelled when the client disconnects or the server shuts down; you thread that context into everything downstream (DB calls, outbound HTTP). The `ResponseWriter` is write-once: headers must be set before the first `Write` or `WriteHeader`, and once the body starts flowing you cannot change the status. Holding these invariants — handler-as-interface, middleware-as-decoration, context-as-cancellation-spine, write-once-response — lets you reason about an entire service without a framework's magic.

**Key terms**
- **`http.Handler`** — interface with `ServeHTTP(w, r)`; the unit of composition.
- **`http.HandlerFunc`** — adapter making an ordinary `func(w, r)` satisfy `Handler`.
- **Middleware** — `func(http.Handler) http.Handler`; wraps a handler to add behavior.
- **`http.ServeMux`** — stdlib request router; gained method+wildcard patterns in 1.22.
- **`http.Server`** — the server struct; holds timeouts, `Handler`, and `Shutdown`/`Close`.
- **`http.Client`** — outbound HTTP client; wraps a `Transport` (connection pool).
- **`http.Transport`** — manages connection reuse, keep-alives, and TLS.
- **`context.Context`** — per-request cancellation/deadline carrier on `r.Context()`.
- **Graceful shutdown** — `Server.Shutdown(ctx)` drains in-flight requests before exit.
- **`http.MaxBytesReader`** — caps request body size to prevent memory abuse.
- **`PathValue`** — `r.PathValue("id")` reads a wildcard segment from a 1.22 pattern.

**Why interviewers ask this** — HTTP is where most Go backend engineers actually live, so it separates people who memorized syntax from people who have run a service in production. A junior wires up handlers, ignores the response body close, uses `http.Get` everywhere, and lets panics or the default client's infinite timeout take the process down. A senior reaches for explicit `http.Server` timeouts, closes and drains response bodies, recovers panics per-request, validates and size-limits input, and knows that `http.DefaultClient` has no timeout. The middleware question in particular reveals whether someone understands closures and interface composition rather than copying a framework's annotations. The shutdown question reveals whether they've operated a service behind a load balancer or rolling deploy.

**Common confusions**
- **"I should always use a web framework."** The stdlib plus 1.22 routing handles the large majority of services; frameworks buy ergonomics, not capability.
- **"`http.Get` and `http.DefaultClient` are fine for production."** They have no timeout — one hung server can wedge a goroutine forever.
- **"Closing the response body is optional."** Failing to `Close()` (and drain) leaks connections and defeats keep-alive reuse.
- **"A panic in a handler just fails that request."** Without recovery middleware it can crash the whole server — actually the stdlib recovers per-connection, but you still lose the response and log noise; recover explicitly.
- **"Set the status code anytime."** Once you `Write`, the header is `200` and locked.
- **"Middleware order doesn't matter."** It's an onion; recovery and logging must be outermost.

**What follows from this topic** — Once you can structure handlers and thread `context`, the Concurrency topic's cancellation and `errgroup` patterns plug directly into request fan-out. The Error Handling topic governs how validation and downstream failures surface as status codes. Observability (pprof, `slog`, metrics middleware) layers onto the same middleware chain. And the Testing topic leans on `httptest.Server` and `httptest.NewRecorder`, which work precisely because handlers are just interfaces.

### Q63. Design idiomatic HTTP middleware in Go (the func(http.Handler) http.Handler pattern). Show a chain.

The idiom is a function that takes the next `http.Handler` and returns a new one that wraps it. Because `http.Handler` is a one-method interface and closures capture `next`, you get clean composition with zero framework support.

```go
type Middleware func(http.Handler) http.Handler

func Logger(l *slog.Logger) Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			sw := &statusWriter{ResponseWriter: w, status: http.StatusOK}
			next.ServeHTTP(sw, r)
			l.Info("request",
				"method", r.Method, "path", r.URL.Path,
				"status", sw.status, "dur", time.Since(start))
		})
	}
}

func Recover(l *slog.Logger) Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			defer func() {
				if v := recover(); v != nil {
					l.Error("panic", "value", v, "stack", string(debug.Stack()))
					http.Error(w, "internal error", http.StatusInternalServerError)
				}
			}()
			next.ServeHTTP(w, r)
		})
	}
}
```

To capture the status you need a thin `ResponseWriter` wrapper, because the stdlib doesn't expose what was written:

```go
type statusWriter struct {
	http.ResponseWriter
	status int
}
func (s *statusWriter) WriteHeader(code int) { s.status = code; s.ResponseWriter.WriteHeader(code) }
```

Chaining is just function application. Order matters — it's an onion, and the **outermost** middleware runs first on the way in and last on the way out, so recovery and logging belong outside everything:

```go
func Chain(h http.Handler, mw ...Middleware) http.Handler {
	for i := len(mw) - 1; i >= 0; i-- { // apply in reverse so mw[0] is outermost
		h = mw[i](h)
	}
	return h
}

handler := Chain(mux, Recover(log), Logger(log), Auth(store))
```

One real gotcha: a naive `statusWriter` breaks `http.Flusher` and `http.Hijacker`, so streaming and websockets stop working. If you need those, type-assert and forward, or use a library like `felixge/httpsnoop` that preserves the optional interfaces.

### Q64. How do you structure handlers, dependency injection, and avoid global state in a Go web service?

Don't use package-level globals for your DB, logger, or config — they make tests fight each other and hide dependencies. The idiomatic pattern is a server struct that holds dependencies, with handlers as methods or closures over it. There is no DI framework; you wire by hand in `main`, and that's a feature.

```go
type Server struct {
	db     *sql.DB
	log    *slog.Logger
	mux    *http.ServeMux
}

func NewServer(db *sql.DB, log *slog.Logger) *Server {
	s := &Server{db: db, log: log, mux: http.NewServeMux()}
	s.routes()
	return s
}

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) { s.mux.ServeHTTP(w, r) }
```

I prefer the **handler-returns-handler** style popularized by Mat Ryer: a method returns an `http.HandlerFunc`, which gives each handler a place to do per-route setup once (compile a template, parse a config) in the enclosing scope, and makes dependencies explicit per handler rather than reaching into the struct for everything.

```go
func (s *Server) handleGetUser() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		u, err := s.users.Get(r.Context(), id) // context threaded through
		if err != nil { s.error(w, r, err); return }
		s.respondJSON(w, u, http.StatusOK)
	}
}

func (s *Server) routes() {
	s.mux.HandleFunc("GET /users/{id}", s.handleGetUser())
}
```

For testability, depend on interfaces you define at the **consumer** side, not concrete types — `s.users` should be a small `UserStore` interface, so tests inject a fake. Keep `main()` thin: it constructs concrete implementations, builds the `Server`, applies middleware, and calls `run(ctx)` that returns an error. That `func run(ctx context.Context) error` pattern keeps `main` to two lines and makes the whole startup testable. Globals like `http.DefaultServeMux` are exactly what to avoid — never use `http.Handle`/`http.HandleFunc` package-level functions in a real service.

### Q65. http.Client best practices: connection reuse, timeouts, closing response bodies, and the default-client trap.

The single most common production bug: `http.DefaultClient` and `http.Get` have **no timeout**. A slow or hung upstream blocks the calling goroutine forever; under load you leak goroutines and connections until the process falls over. Always construct your own client with an explicit timeout.

```go
client := &http.Client{
	Timeout: 10 * time.Second, // covers dial + redirects + body read
	Transport: &http.Transport{
		MaxIdleConns:        100,
		MaxIdleConnsPerHost: 10, // default is 2 — raise for hot upstreams
		IdleConnTimeout:     90 * time.Second,
	},
}
```

Reuse one client (and thus one `Transport`) for the lifetime of the program — the `Transport` is the connection pool. Creating a new client per request defeats keep-alive and exhausts ephemeral ports. The client is safe for concurrent use.

You **must** close the response body, and to get connection reuse you must also drain it. If you read only part of the body and `Close()`, the connection often can't be returned to the pool:

```go
resp, err := client.Do(req)
if err != nil { return err }
defer resp.Body.Close()
// ... on the error/early-return paths, drain so the conn is reusable:
defer io.Copy(io.Discard, resp.Body)
```

`Timeout` on the client is a blunt overall deadline. For finer control, use `http.NewRequestWithContext(ctx, ...)` and put a deadline on the context — that's also what makes the request cancellable when the *inbound* request that triggered it is cancelled. Thread `r.Context()` into outbound calls so a disconnecting client tears down the whole chain.

Two more: cap how much body you'll read with `io.LimitReader` if the upstream is untrusted, and remember `Timeout` does **not** cover time spent reading a streaming body if it keeps producing bytes — for streaming use context deadlines per chunk instead.

### Q66. Graceful shutdown of an HTTP server with context and signal handling. Show the pattern.

Graceful shutdown means: stop accepting new connections, let in-flight requests finish within a deadline, then exit. Behind a load balancer during a rolling deploy this prevents dropped requests and `502`s. The tool is `Server.Shutdown(ctx)` — never `Server.Close()`, which kills connections immediately.

The clean pattern uses `signal.NotifyContext` (added in 1.16) so the same `context` that cancels on `SIGINT`/`SIGTERM` also propagates into your app:

```go
func run(ctx context.Context) error {
	ctx, stop := signal.NotifyContext(ctx, os.Interrupt, syscall.SIGTERM)
	defer stop()

	srv := &http.Server{
		Addr:              ":8080",
		Handler:           handler,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      15 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	errCh := make(chan error, 1)
	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			errCh <- err
		}
	}()

	select {
	case err := <-errCh:
		return err
	case <-ctx.Done(): // signal received
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		return srv.Shutdown(shutdownCtx)
	}
}
```

Key details. `ListenAndServe` returns `http.ErrServerClosed` on a clean shutdown — treat that as success, not an error. The shutdown context's timeout bounds how long you'll wait for in-flight requests; if it expires, `Shutdown` returns `context.DeadlineExceeded` and any remaining connections are abandoned. Use a **fresh** `context.Background()` for the shutdown deadline — don't reuse the already-cancelled signal context, or `Shutdown` returns immediately.

Always set the `http.Server` timeouts shown above. Without `ReadHeaderTimeout` a Slowloris client can hold a connection open indefinitely; `go vet` and many linters now flag a `Server` with no read timeout. If you have background workers or long-lived websockets, `Shutdown` won't wait for them — track them separately (e.g. a `sync.WaitGroup` or `errgroup`) and drain after `Shutdown` returns.

### Q67. How do you handle request validation, JSON decoding limits, and panics in handlers without crashing the server?

Three separate concerns, each with a stdlib-first answer.

**Body size limits.** Untrusted JSON can be gigabytes. Wrap the body before decoding so a hostile client can't OOM you:

```go
r.Body = http.MaxBytesReader(w, r.Body, 1<<20) // 1 MiB cap
dec := json.NewDecoder(r.Body)
dec.DisallowUnknownFields() // reject typos / unexpected keys
if err := dec.Decode(&in); err != nil {
	var maxErr *http.MaxBytesError // added in 1.19
	if errors.As(err, &maxErr) {
		http.Error(w, "request too large", http.StatusRequestEntityTooLarge)
		return
	}
	http.Error(w, "invalid JSON", http.StatusBadRequest)
	return
}
```

`DisallowUnknownFields` is a cheap correctness win — it turns silent client typos into `400`s. After decoding, call `dec.Decode(&struct{}{})` once more and check for `io.EOF` to reject trailing garbage / multiple JSON objects in one body.

**Validation.** Decoding only checks shape, not meaning. Validate semantics explicitly — I prefer a `Valid(ctx) error` method on the request type (an interface your decode helper calls), or `go-playground/validator` with struct tags for larger APIs. Return field-level errors as structured JSON, not a bare string, so clients can act on them. Don't validate in the data layer; validate at the boundary.

**Panics.** The stdlib already recovers panics per-connection so one bad request won't take down the server — but the client gets a dropped connection and you get an ugly log. Add explicit recovery middleware (the `Recover` from Q63) so you return a clean `500`, log the stack, and optionally increment a metric. One subtlety: if you've already written part of the response body before panicking, you can't change the status to `500` — the header is locked. So build the full response in memory (or a buffer) before writing when failure is possible, and never `panic` for ordinary control flow — return errors. Reserve recovery for truly unexpected programmer bugs.

### Q68. Routing: stdlib ServeMux (1.22 method+path patterns) vs chi/gin/echo — when do you reach for a framework?

Go 1.22 substantially closed the gap. The stdlib `http.ServeMux` now supports method matching and path wildcards, which is what most people reached for a router to get:

```go
mux := http.NewServeMux()
mux.HandleFunc("GET /users/{id}", getUser)
mux.HandleFunc("POST /users", createUser)
mux.HandleFunc("GET /files/{path...}", serveFile) // trailing wildcard
// in handler:
id := r.PathValue("id")
```

It does precedence by specificity (not registration order), handles `{$}` for exact-match, and returns `405` with an `Allow` header when the path matches but the method doesn't. For a large fraction of services that's now enough, and you avoid a dependency.

What the stdlib still **doesn't** give you, and where a framework earns its place:

| Need | stdlib 1.22 | chi | gin / echo |
|---|---|---|---|
| Method + path params | yes | yes | yes |
| Route-group middleware | manual | yes (`r.Group`) | yes |
| `func(http.Handler) http.Handler` middleware | yes | yes | own type |
| Built-in binding/validation/render | no | no | yes |
| Regex / typed path constraints | no | partial | partial |
| Performance (radix tree) | good | good | very good |

My default: start with stdlib `ServeMux`. Reach for **chi** when you want sub-router groups with per-group middleware and you still want plain `net/http` handlers — chi is `Handler`-compatible, so it's a thin, idiomatic layer with no lock-in. Reach for **gin** or **echo** only when you want the batteries — request binding, validation, rendering, and a large middleware ecosystem — and you're comfortable with their non-stdlib handler signature (`gin.Context`), which makes handlers harder to reuse and test outside the framework.

The honest heuristic: if you find yourself reimplementing route groups, param parsing, and a middleware registry by hand, adopt chi. If you're building a large API surface and value convention over assembling pieces, gin/echo. Don't pull in a framework for a three-route service — that's dependency cost with no payoff.

---

## Database (database/sql)

### Summary

**What this topic covers** — This topic is about Go's standard `database/sql` package: the abstraction layer that sits between your code and a concrete database driver. It covers the driver-registration model, the crucial fact that `*sql.DB` is a connection *pool* rather than a single connection, how to tune that pool, how parameterized queries and prepared statements protect you from SQL injection, the transaction API including context-aware variants, and the mechanics and pitfalls of scanning result rows (NULLs, `Close`, `Err`). `database/sql` is deliberately minimal — it gives you pooling, a query/exec/scan surface, and transactions, and leaves SQL dialect, migrations, and ORMs to other libraries.

**Mental model** — Think of `*sql.DB` as a *handle to a pool of connections*, not a connection. You open it once at startup, store it on a struct or package var, and share it across every goroutine — it is safe for concurrent use and manages its own connections internally. Every `Query`/`Exec`/`QueryRow` call borrows a connection from the pool, runs, and returns it (sometimes the borrowing is deferred until you finish reading rows). The pool is lazy: `sql.Open` does *not* connect — it just validates the DSN and constructs the struct; the first real connection happens on first use or `Ping`. Because connections are recycled, you must respect lifecycle limits (`SetConnMaxLifetime`) and clean up resources (`rows.Close()`) or you starve the pool. The driver does the wire protocol; `database/sql` does pooling, retry-on-bad-conn, and the `Scanner`/`Valuer` plumbing.

**Key terms**
- **Driver** — a package implementing `database/sql/driver` (e.g. `github.com/jackc/pgx/v5/stdlib`, `github.com/go-sql-driver/mysql`) registered via `sql.Register`.
- **DSN** — data source name, the connection string parsed by the driver (`postgres://user:pass@host/db?sslmode=disable`).
- **`*sql.DB`** — the pooled handle; concurrency-safe; one per database for the process lifetime.
- **`*sql.Conn`** — a single dedicated connection obtained via `db.Conn(ctx)`; needed for session-state-bound operations.
- **`*sql.Tx`** — a transaction bound to one underlying connection.
- **`*sql.Stmt`** — a prepared statement; pool-aware, re-prepared per connection as needed.
- **Placeholder** — the parameter marker (`$1` Postgres, `?` MySQL/SQLite) that keeps data out of the SQL text.
- **`Scanner`** — the `sql.Scanner` interface (`Scan(src any) error`) for reading a column into a custom type.
- **`Valuer`** — `driver.Valuer` (`Value() (driver.Value, error)`) for sending a custom type as a parameter.
- **`sql.NullString`** — wrapper type carrying a value plus a `Valid bool` for nullable columns.
- **Idle connection** — an open connection sitting in the pool unused, governed by `SetMaxIdleConns`.

**Why interviewers ask this** — Almost every Go service talks to a database, and `database/sql` is where juniors quietly create production incidents. A junior calls `sql.Open` per request, never closes rows, and is mystified when the service hits "too many connections" or leaks memory under load. A senior knows `sql.Open` is cheap-and-lazy, keeps a single shared `*sql.DB`, tunes the pool against the database's actual `max_connections` (minus headroom for other services), always pairs `Query` with `defer rows.Close()`, checks `rows.Err()`, and uses `context` for cancellation and timeouts. The interviewer is probing whether you understand the pool abstraction, resource lifecycle, and injection safety — these are the difference between a service that survives Black Friday and one that falls over.

**Common confusions**
- **"`sql.Open` connects to the database"** — it does not; it's lazy. Call `db.PingContext` if you want to fail fast at startup.
- **"I should open a `*sql.DB` per request for isolation"** — no; that defeats pooling and exhausts connections. Open once, share everywhere.
- **"Prepared statements are always faster"** — under `database/sql` pooling, a `*sql.Stmt` may re-prepare on each connection and add round-trips; for one-shot queries, plain `QueryContext` with placeholders is often better.
- **"Placeholders work for table/column names"** — they don't; only for *values*. Identifiers must be validated against an allowlist.
- **"Forgetting `rows.Close()` is harmless because GC cleans up"** — it isn't; the connection stays checked out until the rows are drained or closed, starving the pool.

**What follows from this topic** — Once the pool model is clear, it connects to **Context** (every DB call should take a `context.Context` for timeouts/cancellation), **Concurrency** (the pool is the shared resource your goroutines contend on), **Error handling** (`sql.ErrNoRows`, `errors.Is`, driver-specific errors), and **Observability** (`db.Stats()` feeds pool metrics into pprof/Prometheus). It also sets up higher-level libraries like `sqlc`, `sqlx`, and `pgx`'s native interface, all of which build on or deliberately bypass these same primitives.

### Q69. Explain database/sql: the driver model, *sql.DB as a pool (not a connection), and why you keep one *sql.DB.

`database/sql` is an *interface* package — it ships no drivers. A driver (say `github.com/jackc/pgx/v5/stdlib` or `github.com/go-sql-driver/mysql`) implements the `database/sql/driver` interfaces and calls `sql.Register("pgx", &Driver{})` in its `init()`. You import it for its side effect — `_ "github.com/jackc/pgx/v5/stdlib"` — and then `sql.Open("pgx", dsn)` finds the registered driver by name. This is why you see those blank imports: they're not unused, they're wiring the driver into the registry.

The single most important thing to internalize: **`*sql.DB` is a pool of connections, not a connection.** It is safe for concurrent use by many goroutines. Internally it holds a set of idle and in-use connections, opens new ones on demand up to your limit, and hands one out for the duration of each `Query`/`Exec`. `sql.Open` itself does *not* dial the database — it parses the DSN and returns immediately. The first connection is established lazily on first use.

```go
db, err := sql.Open("pgx", dsn)
if err != nil {
    return err // DSN parse error only
}
db.SetMaxOpenConns(25)
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()
if err := db.PingContext(ctx); err != nil {
    return err // *now* you find out the DB is unreachable
}
```

Because it's lazy, you call `PingContext` at startup if you want to fail fast instead of discovering the DB is down on the first request.

You keep *one* `*sql.DB` for the whole process and inject it everywhere (on a repository struct, usually). Opening a new `*sql.DB` per request is the classic junior mistake — each one is its own pool, so you multiply connection counts, blow past the database's `max_connections`, and lose all the benefit of reuse. One handle, opened at startup, closed at shutdown (`defer db.Close()` in `main`), shared by reference. Don't pass it by value and don't close it mid-request.

### Q70. Connection pool tuning: SetMaxOpenConns, SetMaxIdleConns, SetConnMaxLifetime — what goes wrong if you ignore them?

There are four knobs, and the defaults are footguns at scale:

| Setting | Default | What it controls |
|---|---|---|
| `SetMaxOpenConns(n)` | 0 = unlimited | Hard cap on total open connections (idle + in-use). |
| `SetMaxIdleConns(n)` | 2 | How many idle connections are kept warm in the pool. |
| `SetConnMaxLifetime(d)` | 0 = forever | Max age before a connection is retired. |
| `SetConnMaxIdleTime(d)` | 0 = forever | Max idle time before an idle connection is closed. |

If you **ignore `SetMaxOpenConns`**, the pool is unbounded. Under a load spike Go will happily open hundreds of connections, and your Postgres — which often defaults to `max_connections = 100` shared across *all* clients — starts rejecting with "too many connections" or, worse, every connection eats backend memory and the DB falls over. Always cap this, and size it against the DB's real limit divided by the number of service instances, leaving headroom for migrations and admin tools.

If you **leave `SetMaxIdleConns` at the default 2** but allow 25 open, you get connection churn: under steady load you constantly open connection 3..25, use them, then close them back down to 2 idle. Each open is a TCP + TLS + auth round-trip. Set `MaxIdleConns` equal to (or close to) `MaxOpenConns` so warm connections get reused. Note: `MaxIdleConns` is silently clamped to `MaxOpenConns`.

If you **ignore `SetConnMaxLifetime`**, connections live forever — which breaks two things. First, behind a load balancer or proxy (or after a Postgres failover), stale connections point at a dead backend and you get sporadic errors until they're evicted. Second, some setups kill idle connections server-side (`wait_timeout` in MySQL), and Go hands you a dead one. Setting a lifetime of a few minutes (e.g. `db.SetConnMaxLifetime(5 * time.Minute)`) lets the pool rotate gracefully. The classic MySQL "invalid connection" / "driver: bad connection" bug is almost always an unset lifetime against a server-side timeout.

Monitor `db.Stats()` — `WaitCount` and `WaitDuration` rising means goroutines are blocking on the pool and you need more connections or fewer concurrent queries.

### Q71. Prepared statements, query parameters, and how Go protects against SQL injection. Where can you still get it wrong?

The protection is **parameterized queries**. You never interpolate values into the SQL string; you pass placeholders and arguments separately, and the driver sends them apart from the query text so the data can never be parsed as SQL.

```go
// Safe — value travels as a parameter, not as SQL text
row := db.QueryRowContext(ctx, "SELECT id, email FROM users WHERE email = $1", email)

// Catastrophe — string concatenation, classic injection
q := "SELECT id FROM users WHERE email = '" + email + "'" // NEVER
```

Placeholder syntax is driver-specific: `$1, $2` for Postgres/pgx, `?` for MySQL and SQLite. The arguments are passed as the variadic `args ...any` after the query string. This is the single rule that matters: **if a value comes from user input, it goes in an argument, never in the string.**

Prepared statements (`db.PrepareContext` → `*sql.Stmt`) are the same idea made reusable: parse once, execute many. But under `database/sql`'s pool they're subtle — a `*sql.Stmt` is tied to the connection it was prepared on, and if that connection is busy the pool may re-prepare it on another connection, adding round-trips. For a query you run once, a plain `QueryContext` with placeholders is simpler and often faster. Reserve explicit `Stmt` for tight loops reusing the exact same query. Always `defer stmt.Close()`.

Where you can still get it wrong:

- **Identifiers can't be parameterized.** Placeholders only bind *values*. `SELECT * FROM ? ` or `ORDER BY ?` for a column name does not work. If you must vary a table or column name dynamically, validate it against a hardcoded allowlist and only then concatenate — never trust the raw string.
- **Dynamic `IN` clauses.** You can't pass a slice to a single `?`. You build `?, ?, ?` to match the slice length (or use `pq.Array`/pgx array support, or `sqlx.In`). Hand-building this with `strings.Join` of user data instead of placeholders reopens injection.
- **`LIKE` with user wildcards.** The value is still safe from injection, but unescaped `%`/`_` in user input changes query semantics — escape them if that matters.
- **Driver-specific string building** for things like `LIMIT` from user input — bind it as a parameter (`LIMIT $1`), don't `fmt.Sprintf` it.

### Q72. Transactions in Go: Begin/Commit/Rollback, context-aware Tx, and the deferred-rollback idiom.

A transaction is `db.BeginTx(ctx, opts)` → a `*sql.Tx` → `Commit()` or `Rollback()`. Critically, a `Tx` is pinned to a single underlying connection for its whole life, so all queries within it run on the same connection in order. You issue queries on the `tx`, not the `db`:

```go
func transfer(ctx context.Context, db *sql.DB, from, to int, amount int64) (err error) {
    tx, err := db.BeginTx(ctx, nil)
    if err != nil {
        return err
    }
    defer func() {
        if err != nil {
            _ = tx.Rollback() // no-op if already committed
        }
    }()

    if _, err = tx.ExecContext(ctx,
        "UPDATE accounts SET balance = balance - $1 WHERE id = $2", amount, from); err != nil {
        return err
    }
    if _, err = tx.ExecContext(ctx,
        "UPDATE accounts SET balance = balance + $1 WHERE id = $2", amount, to); err != nil {
        return err
    }
    return tx.Commit()
}
```

The **deferred-rollback idiom** is the key pattern. You `defer tx.Rollback()` (gated on `err != nil` via a named return, as above, or unconditionally) right after `BeginTx`. After a successful `Commit`, the deferred `Rollback` becomes a harmless no-op — `database/sql` returns `sql.ErrTxDone` and you ignore it. This guarantees that *any* early return — including a panic that you recover, or an error path you forgot — releases the connection back to the pool. Forgetting it is how you leak a connection per failed transaction until the pool is exhausted and everything deadlocks.

`BeginTx` takes the context and a `*sql.TxOptions` where you set `Isolation` (e.g. `sql.LevelSerializable`) and `ReadOnly`. The context matters: if it's cancelled or times out, the transaction is rolled back automatically and the connection is freed. Pass a request-scoped context so a client disconnect doesn't leave a transaction hanging.

Two gotchas: don't capture the `tx` in a goroutine that outlives the function — it's not safe for concurrent use across the connection. And don't mix `db.Exec` and `tx.Exec` in the same logical transaction; calls on `db` go to a *different* pooled connection and aren't part of your transaction at all.

### Q73. Scanning rows: Rows.Scan, NULL handling with sql.NullString / pointers, and the must-call rows.Close()/rows.Err() gotchas.

`QueryContext` returns `*sql.Rows`, which you iterate with `rows.Next()` and read with `rows.Scan(&dst...)`. The canonical loop has four required parts, and skipping any of them is a bug:

```go
rows, err := db.QueryContext(ctx, "SELECT id, name, email FROM users WHERE active = $1", true)
if err != nil {
    return nil, err
}
defer rows.Close() // 1. ALWAYS, even on the happy path

var users []User
for rows.Next() { // 2. advances the cursor
    var u User
    if err := rows.Scan(&u.ID, &u.Name, &u.Email); err != nil { // 3. pointers, in column order
        return nil, err
    }
    users = append(users, u)
}
if err := rows.Err(); err != nil { // 4. did Next() stop because of an error or EOF?
    return nil, err
}
```

The two classic gotchas are in the comments. **`defer rows.Close()`** — until the rows are fully drained *or* closed, the underlying connection is checked out of the pool. A loop that `break`s early without `Close` leaks that connection. `rows.Next()` auto-closes when it reaches the end, but you cannot rely on always reaching the end, so the `defer` is mandatory. **`rows.Err()`** — `rows.Next()` returns `false` both at normal EOF *and* when an error (network drop mid-stream, scan-type failure) ends iteration. Without checking `rows.Err()` you silently treat a truncated result as a complete one. This is the bug that ships a half-empty list to production and nobody notices until the row count looks wrong.

**NULL handling**: `Scan` cannot put a SQL `NULL` into a plain `string` or `int` — you get `sql: Scan error ... converting NULL to string is unsupported`. Two fixes:

| Approach | Use when |
|---|---|
| `sql.NullString`, `sql.NullInt64`, `sql.NullTime`, etc. | You want an explicit `Valid bool` and don't mind the wrapper. |
| Pointer (`*string`, `*int`) | `nil` means NULL; nicer for JSON marshalling and structs. |

```go
var email sql.NullString
if err := rows.Scan(&u.ID, &u.Name, &email); err != nil { ... }
if email.Valid {
    u.Email = email.String
}
```

For `QueryRowContext` (single row), there's no `Close` to worry about, but you must handle `sql.ErrNoRows` explicitly with `errors.Is(err, sql.ErrNoRows)` — that's how "not found" surfaces, and conflating it with a real error (or ignoring it) is a common mistake. Also ensure your `Scan` destination count and types exactly match the `SELECT` column list; a mismatch is a runtime error, not a compile error, so column-order drift after a schema change bites silently.

---

## Design Patterns & Idioms

### Summary

**What this topic covers** — How Go expresses the classic design problems — construction, dependency wiring, behavioral variation, cross-cutting concerns, and state ownership — using its own small vocabulary of features: first-class functions, interfaces satisfied implicitly, goroutines, and channels. The Gang-of-Four catalogue mostly survives, but Go reshapes it. Half the patterns collapse into "pass a function" or "define a one-method interface," and the ones that remain (decorator, strategy, options) look nothing like their Java incarnations. This topic also covers idiomatic package layout and the anti-patterns that mark code as written by someone fighting the language rather than using it.

**Mental model** — Go has no constructors, no inheritance, no method overloading, and no annotations. That sounds impoverishing; in practice it forces composition over hierarchy. The senior instinct is: reach for a plain function or a closure first, an interface second, and a struct-with-methods third — and never a "framework" until the wiring genuinely hurts. Interfaces are *consumer-defined*: you declare the small interface where you *use* it, not where you implement it, because implementations satisfy interfaces structurally without any `implements` keyword. Behavior is injected by passing values — functions or interface values — through constructors that return concrete structs. State is owned, not shared: either one goroutine owns a piece of data and others talk to it via channels, or you guard it with a mutex and keep the critical section tiny. Almost every "pattern" in Go is one of those moves dressed up. When you find yourself building elaborate type hierarchies or generic abstractions, you've usually left idiomatic Go.

**Key terms**
- **Functional options** — variadic `...Option` functions that mutate a config struct, giving extensible, defaulted constructors.
- **Constructor injection** — passing dependencies into a `NewX(...)` function rather than reaching for globals.
- **Consumer-defined interface** — declaring the interface in the package that *consumes* it, kept to 1-2 methods.
- **Middleware** — a `func(http.Handler) http.Handler` (or similar) that wraps and augments behavior.
- **Higher-order function** — a function taking or returning functions; Go's decorator mechanism.
- **Strategy** — swapping behavior by passing different interface implementations.
- **`internal/`** — a directory whose packages are importable only by code rooted at its parent.
- **wire** — Google's compile-time DI codegen tool; produces plain Go, no runtime reflection.
- **fx** — Uber's runtime DI/lifecycle framework built on reflection and providers.
- **Goroutine-owns-state** — actor-style concurrency where one goroutine serializes all access to a value.
- **Interface pollution** — defining interfaces with no second implementation, on the producer side.

**Why interviewers ask this** — Patterns questions separate engineers who *write* Go from those who *transliterate* Java or Python into it. A junior reaches for getters/setters, a `BaseService` struct, a `utils` package, and an interface for every type "in case we need to mock it." A senior knows that Go's idioms exist *because* the language omits features, and can articulate the tradeoff: functional options buy API evolution at the cost of verbosity; consumer-side interfaces buy testability without polluting producers. The real signal is restraint — knowing when *not* to abstract. Interviewers also probe whether you can read the standard library as the canonical style guide (`http`, `slog`, `database/sql`) rather than importing patterns from other ecosystems. Strong candidates cite concrete stdlib examples and explain *why* the layout choice matters for the next reader.

**Common confusions**
- **"Functional options are over-engineering; just use a config struct."** — Config structs can't enforce required-vs-optional or evolve without breaking, and zero-values are ambiguous.
- **"You need an interface to make code testable."** — You need an interface only at the seam you actually mock; over-interfacing hurts more than it helps.
- **"A `utils` or `common` package keeps things DRY."** — It becomes an import-cycle magnet and a dumping ground with no cohesion.
- **"Decorator needs a class hierarchy."** — In Go it's just a function that takes and returns the same type.
- **"DI requires a framework."** — Wiring at `main()` is dependency injection; frameworks are for graph size, not correctness.

**What follows from this topic** — These idioms rest on earlier ones: functional options and decorators rely on closures (see *Functions & Closures*), strategy and consumer interfaces rely on Go's implicit interface satisfaction (*Interfaces*), and the concurrency patterns rest on goroutines and channels (*Concurrency*). They feed forward into *Testing* (small interfaces are what make seams mockable) and *Project Structure / Modules*, where `internal/` and package design become module-level concerns.

### Q74. The functional options pattern — why Go uses it instead of constructor overloading or config structs. Show it.

Go has no constructor overloading and no default arguments. So `NewServer(addr)`, `NewServer(addr, timeout)`, `NewServer(addr, timeout, tls)` can't coexist. Your three bad options are: a giant positional constructor (unreadable call sites, `nil, nil, 0, false`), a config struct (works, but can't distinguish "unset" from zero, and every new field is a silent behavior change), or functional options.

Functional options are variadic functions that mutate a private config. The win is API evolution: you add an option without touching any existing call site, defaults live in one place, and required args stay positional while optional ones are self-documenting at the call site.

```go
type Server struct {
	addr    string
	timeout time.Duration
	tls     *tls.Config
}

type Option func(*Server)

func WithTimeout(d time.Duration) Option { return func(s *Server) { s.timeout = d } }
func WithTLS(c *tls.Config) Option       { return func(s *Server) { s.tls = c } }

func NewServer(addr string, opts ...Option) *Server {
	s := &Server{addr: addr, timeout: 30 * time.Second} // defaults
	for _, opt := range opts {
		opt(s)
	}
	return s
}

// call site:
srv := NewServer(":8080", WithTimeout(5*time.Second), WithTLS(cfg))
```

When *not* to use it: if every field is required and there are no defaults, a plain struct literal is clearer — don't cargo-cult options onto a value type. The pattern earns its keep when there's a real defaulted/optional surface that you expect to grow. The stdlib uses it sparingly (`grpc.Dial`, many third-party libs); the `http.Server` struct is the counter-example where a public struct was deemed fine because the fields are stable and self-explanatory. If you want options to be able to fail (e.g. validate input), use `Option func(*Server) error` and accumulate the error in the loop.

### Q75. Explain idiomatic Go project layout and package design (avoid util/common, package-per-capability, internal/).

The first rule: package names are part of the API and should describe a *capability*, not a layer. `package user` exposes `user.New`, `user.Store` — you never write `user.UserStore` because the package qualifies it (stutter). That alone kills `util`, `common`, `helpers`, `models`, and `base` — those name no capability, so nothing cohesive lives in them. They become import-cycle magnets and dumping grounds. If you have a `util.FormatDate`, it belongs in a `dateformat` package or, more likely, next to its one caller.

Organize by *what the code does*, not by *what kind of thing it is*. A `handlers/`, `services/`, `repositories/` split (Rails-brain) scatters one feature across three packages and creates import cycles. Instead, `package billing` owns its handler, service, and store together; the HTTP layer is a thin adapter. This is "package per capability."

`internal/` is a compiler-enforced privacy boundary: anything under `myapp/internal/` can only be imported by code rooted at `myapp/`. Put everything that isn't a deliberate public API there. A typical module:

```
myapp/
  cmd/server/main.go      // entry points, one dir per binary
  internal/billing/       // domain packages, not importable externally
  internal/user/
  internal/platform/db/   // shared infra, still private
  api/                    // optional: public types if you ship a library
```

A few hard-won rules: avoid the `pkg/` directory convention — it adds a layer for no benefit; `internal/` already does privacy. Keep packages flat and shallow; deep nesting signals premature structure. The `cmd/<name>/main.go` should be tiny — parse flags/env, wire dependencies, call `Run(ctx)`. And resist creating a package until you have a real cohesion reason; a single 800-line file in one package is more idiomatic than five 50-line packages that import each other.

### Q76. Dependency injection without a framework: constructor injection and wiring at main(). When is wire/fx justified?

DI in Go is just passing dependencies as arguments. There's no magic. A constructor takes the interfaces it needs and returns a concrete struct. Wiring happens once, at `main()`, where you construct the leaves first and pass them up the graph.

```go
func main() {
	db := mustOpenDB(os.Getenv("DATABASE_URL"))
	users := user.NewStore(db)        // *user.Store
	billing := billing.NewService(users, stripe.New(key))
	srv := api.NewServer(billing)
	log.Fatal(srv.ListenAndServe())
}
```

Two key idioms make this clean. First, accept interfaces, return structs — `billing.NewService` takes a `UserLookup` interface (defined in the billing package, the consumer), so it doesn't depend on `*user.Store` concretely and is trivially testable. Second, never reach for package-level globals or a service locator; that's hidden coupling that defeats the whole point and makes tests order-dependent.

For most services — even fairly large ones — hand-wiring at `main()` is the right answer. It's explicit, greppable, and a stack trace points straight at the wiring. You reach for a tool when the graph gets large enough that hand-wiring is error-prone or the ordering is genuinely hard to maintain.

| | Hand-wired | `google/wire` | `uber-go/fx` |
|---|---|---|---|
| Mechanism | plain code | compile-time codegen | runtime reflection |
| Errors surface | compile | compile (generated) | runtime/startup |
| Lifecycle hooks | manual | none | built-in start/stop |
| Best for | most apps | large static graphs | big apps wanting lifecycle + modules |

`wire` is the conservative choice: it generates the exact `main()` you'd have written by hand, so there's zero runtime cost and errors are compile-time. `fx` is justified when you want managed lifecycle (ordered startup/shutdown of dozens of components), pluggable modules, and you accept that a misconfigured graph fails at startup rather than compile time. If you can't name a concrete pain a framework solves, you don't need one yet.

### Q77. The decorator/middleware pattern via higher-order functions, and the strategy pattern via interfaces.

Decorator in Go is a function that takes a value and returns an enhanced value of the *same type*. The canonical case is HTTP middleware: `func(http.Handler) http.Handler`. Each layer wraps the next, runs code before/after, and the composition is just nesting.

```go
func WithLogging(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		slog.Info("req", "path", r.URL.Path, "dur", time.Since(start))
	})
}

// compose: logging(auth(mux)). Routers like chi give r.Use(...) to stack these.
handler := WithLogging(WithAuth(mux))
```

The same shape decorates anything — wrap a `RoundTripper` for retries, wrap a `Store` for caching, wrap a function for memoization. The key insight: because the wrapper and wrapped share a type (`http.Handler`, `http.RoundTripper`), composition is associative and order-explicit. Use a slice + a loop to apply a stack in a fixed order.

Strategy is the interface version of the same idea: instead of varying *wrapping*, you vary the *implementation* behind a one-method interface and pass the chosen one in.

```go
type Compressor interface{ Compress([]byte) []byte }

type Gzip struct{} // implements Compress
type Zstd struct{}

func NewStore(c Compressor) *Store { return &Store{c: c} } // swap at wiring time
```

When the strategy is genuinely a single function, skip the interface entirely and pass a `func([]byte) []byte` — that's strategy-by-closure, and it's more idiomatic than a one-method interface with one implementation. `sort.Slice`'s `less func(i, j int) bool` is exactly this. Rule of thumb: interface when you have multiple named implementations or need to mock; plain func when the variation is a single behavior.

### Q78. Concurrency patterns as design: the actor-ish goroutine-owns-state pattern vs shared state + mutex.

Two ways to make concurrent access to state safe, and the choice is a design decision, not a style one. "Share memory by communicating" (channels) vs "communicate by sharing memory" (mutex). Both are valid; the Go proverb favors the former but the stdlib uses mutexes heavily.

Goroutine-owns-state (actor-ish): one goroutine exclusively owns the data, and all reads/writes go through a channel of request messages. No locks, no data races by construction, because only one goroutine ever touches the state.

```go
type counter struct{ ops chan func(*int) }

func newCounter() *counter {
	c := &counter{ops: make(chan func(*int))}
	go func() {
		var n int
		for op := range c.ops { op(&n) } // single owner mutates n
	}()
	return c
}
func (c *counter) Inc()      { c.ops <- func(n *int) { *n++ } }
func (c *counter) Get() int  { r := make(chan int); c.ops <- func(n *int) { r <- *n }; return <-r }
```

Shared state + mutex: the data is shared, a `sync.Mutex` (or `RWMutex` for read-heavy) guards the critical section. Simpler, faster for fine-grained access, and obvious to readers.

```go
type counter struct {
	mu sync.Mutex
	n  int
}
func (c *counter) Inc()     { c.mu.Lock(); c.n++; c.mu.Unlock() }
func (c *counter) Get() int { c.mu.Lock(); defer c.mu.Unlock(); return c.n }
```

How to choose: use a **mutex** when the state is simple, access is fine-grained, and you just need mutual exclusion — it's lower latency (no channel hop, no extra goroutine) and easier to reason about. Use the **owning goroutine** when there's complex sequencing, the owner must coordinate multiple resources, or it already has a select loop (a connection manager, a rate limiter, a cache with TTL eviction). Don't build the actor version for a counter in production — that example is pedagogical; a `sync.Mutex` or `atomic.Int64` wins. The anti-pattern is mixing both for the same data, or holding a lock across a channel send (instant deadlock risk). Always run `go test -race` — it's the only reliable way to catch the bugs either approach can hide.

### Q79. What are common Go anti-patterns (interface pollution, premature abstraction, getters/setters, empty-interface APIs)?

**Interface pollution** — defining an interface on the producer side with exactly one implementation "for testability" or "for flexibility." Go interfaces are satisfied implicitly, so you don't need to declare them up front. Define the interface in the *consumer* package, with only the methods that consumer uses, when you actually have a second implementation or a mock seam. A package exporting `type Service interface{...}` plus `type service struct{}` that's the only impl is a smell — return the concrete struct and let callers abstract if they need to.

**Premature abstraction** — generics, plugin registries, and config-driven dispatch added before there's a second case. Go 1.18 generics are great for genuinely type-parametric code (`slices`, `maps`, container types), but a generic `Repository[T]` with one entity type is just indirection. Write the concrete version twice; abstract on the third when the shape is actually clear. "A little copying is better than a little dependency."

**Getters/setters** — Java-brain `GetName()`/`SetName()` on every field. Idiomatic Go exports the field directly if it's meant to be accessed, and the getter (if any) is named `Name()` not `GetName()` (the `Get` prefix is non-idiomatic per the style guide). Setters often hide that a field shouldn't be mutable at all — prefer constructing a new value or a method that does real work.

**Empty-interface APIs** — `func Process(v interface{})` (or `any` since 1.18) pushes type errors to runtime and forces type switches everywhere. Since generics landed, most `any`-based APIs should be type parameters instead. Reserve `any` for genuinely heterogeneous data (JSON, `fmt`-style varargs); everywhere else it's lost type safety.

A few more worth naming: **god packages** (`util`); **returning concrete error types** instead of wrapping with `%w` and checking via `errors.Is`/`errors.As`; **starting goroutines without a lifecycle** (no way to stop them, no `context` — a leak); and **panic-as-control-flow** in library code (return errors; reserve `panic` for truly unrecoverable programmer bugs). The through-line: every one of these is importing a habit from another language instead of leaning into Go's small, explicit feature set.

---

## Common Pitfalls & Spot-the-Bug

### Summary

**What this topic covers** — This is the "have you been burned yet" topic. It collects the bugs every Go engineer ships at least once: capturing a loop variable in a goroutine, returning a typed nil that compares unequal to `nil` through an interface, mutating a caller's backing array via `append`, fighting the compiler over addressability of map values, leaking goroutines and tickers, and shipping a data race that passes every test until production. Most of these are not exotic — they fall directly out of Go's value semantics, its interface representation as a (type, value) pair, and the slice header. Knowing them cold is the difference between a candidate who has read the spec and one who has paged a service at 3am.

**Mental model** — Hold three facts in your head and most of these bugs become predictable. First, **everything is a value**: a slice is a 3-word header (pointer, len, cap), a map is a pointer to a runtime structure, an interface is a 2-word (type, data) pair. Copying a slice copies the header, not the backing array — so two slices can alias the same memory. Second, **an interface is nil only when both words are nil**; stuff a `(*T)(nil)` into an `error` and the type word is non-nil, so `err != nil` is true even though the pointer is nil. Third, **goroutines and the variable they close over are separate**: pre-1.22, the loop variable was one shared address, so by the time goroutines ran they all read the final value. Once you internalize header-copy semantics, interface identity, and closure-by-reference, "spot the bug" becomes mechanical rather than magical. The `-race` detector and `go vet` mechanize the rest.

**Key terms**
- **Loop variable capture** — closures sharing one loop variable's address; fixed by per-iteration scoping in Go 1.22.
- **Typed nil** — a nil pointer carrying a concrete type, which is non-nil when stored in an interface.
- **Interface header** — the 2-word (type, value) representation; nil requires both to be zero.
- **Slice header** — the (ptr, len, cap) triple copied by value when you pass a slice.
- **Aliasing** — two slices sharing one backing array, so a write through one is visible through the other.
- **Addressability** — whether an expression has a memory address you can take; map elements are not addressable.
- **Data race** — concurrent access to the same memory with at least one write and no synchronization.
- **Goroutine leak** — a goroutine blocked forever (often on a channel) that never returns, holding memory.
- **`-race`** — the race detector build flag instrumenting memory accesses at runtime.
- **`go vet`** — static analyzer that flags lock copies, loop captures (pre-1.22), and printf mistakes.

**Why interviewers ask this** — These questions separate people who write Go from people who understand Go. A junior says "loop variable capture" and stops; a senior explains the underlying shared-address mechanism, names the Go 1.22 semantic change, and knows `go vet` and `loopclosure` caught it before. On the nil-interface bug, the junior is genuinely confused; the senior draws the 2-word header and explains why returning a concrete `*MyError` typed as the function's `error` return is the trap. The strongest signal is reflexive defensiveness: a senior reaches for `-race` in CI without being asked, treats unbuffered-channel sends as deadlock risks, and never trusts a concurrent test that "seems to work." Interviewers want to know whether you'll ship the race or catch it.

**Common confusions**
- **"Returning `nil` from a function with an `error` return always gives a nil error."** Only if you return the untyped `nil`; returning a nil `*MyErr` typed as `error` is non-nil.
- **"`append` never touches the original slice."** It mutates the shared backing array when there's spare capacity; only a reallocation detaches it.
- **"Passing a slice by value protects the caller's data."** The header is copied but the backing array is shared — element writes are visible to the caller.
- **"If my tests pass, there's no race."** Races are timing-dependent; only `-race` reliably surfaces them.
- **"Go 1.22 fixed every closure-capture bug."** It rescoped `for` loop variables, but capturing any other shared variable in a goroutine is still on you.

**What follows from this topic** — Almost every other Go topic feeds these traps. Slices and maps explain aliasing and addressability; interfaces explain the typed-nil bug; goroutines and channels explain leaks and deadlocks; the memory model explains why `-race` exists. Treat this topic as the integration test for everything else — if you can spot these bugs cold, you've actually understood the value semantics, not just memorized them.

### Q80. The loop variable capture bug in goroutines/closures — explain it and the Go 1.22 semantic change.

The classic bug: you launch a goroutine per iteration that closes over the loop variable, expecting each to see its own value, but they all observe the final one.

```go
// Pre-Go 1.22: BUGGY
for _, v := range []string{"a", "b", "c"} {
    go func() {
        fmt.Println(v) // often prints "c", "c", "c"
    }()
}
```

The reason is that, before Go 1.22, `v` was a single variable whose address was reused across every iteration. The closure captured that one variable by reference, and by the time the goroutines actually scheduled and ran, the loop had finished and `v` held its last value. The same applies to `defer` and to passing `&v` anywhere.

The pre-1.22 fixes were either to shadow the variable (`v := v` inside the loop body) or to pass it as an argument (`go func(v string){...}(v)`), which copies it at call time.

Go 1.22 changed the language semantics: the loop variable is now **per-iteration scoped** — each iteration gets a fresh `v`. The buggy code above now does the right thing under a `go.mod` declaring `go 1.22` or later. This was a rare backwards-incompatible change, gated on the module's Go version so old modules keep old behavior.

Two caveats I still raise in interviews. First, it only fixed `for` loop variables — capturing any *other* shared variable in a goroutine is still your problem. Second, `go vet`'s `loopclosure` check and `golangci-lint`'s `copyloopvar`/`exportloopref` caught this for years; don't rely solely on the language fix, because you may be reading code in a 1.21 module. I still write `v := v` reflexively in libraries that must support older Go versions.

### Q81. nil interface vs nil pointer wrapped in an interface — show the classic "err != nil but err is nil" bug.

This one bites everyone once. An interface value is a 2-word pair: a type word and a data word. It equals `nil` only when **both** words are nil. A nil pointer of a concrete type has a non-nil type word, so once stored in an interface it is not nil.

```go
type MyError struct{ msg string }
func (e *MyError) Error() string { return e.msg }

func doThing(fail bool) error {
    var e *MyError // nil *MyError
    if fail {
        e = &MyError{"boom"}
    }
    return e // BUG: always returns a non-nil error
}

func main() {
    err := doThing(false)
    fmt.Println(err == nil) // false! type word is *MyError
}
```

Even when `fail` is false and `e` is a nil pointer, `return e` boxes a `(*MyError, nil)` interface. The caller's `err != nil` is true, so callers take the error path with a nil pointer that panics the moment they call a method touching fields.

The fix is to return the untyped `nil` literal on the success path, and to keep the error variable typed as `error`, not as the concrete pointer:

```go
func doThing(fail bool) error {
    if !fail {
        return nil // untyped nil → genuine nil interface
    }
    return &MyError{"boom"}
}
```

The general rule: never declare a function-local concrete error pointer and then `return` it through an `error` return. Either return `nil` explicitly or use an `error`-typed variable throughout. `errors.Is`/`errors.As` don't save you here — the value is genuinely non-nil. This is also why `go vet` has the `nilness` analyzer and why linters like `nilnil` exist.

### Q82. Slice aliasing / append surprises — show a function that mutates its caller's data unexpectedly.

A slice is a header — `(ptr, len, cap)` — over a backing array. Passing it by value copies the header, but both copies point at the same array. So a function can mutate the caller's data without taking a pointer.

```go
func zeroFirst(s []int) {
    s[0] = 0 // visible to the caller — same backing array
}
```

The subtler trap is `append`. If the slice has spare capacity, `append` writes into the shared backing array; if it doesn't, it reallocates and detaches. So the same function is sometimes destructive and sometimes not, depending on capacity:

```go
func appendVal(s []int, v int) []int {
    return append(s, v) // may overwrite the caller's "next" element
}

func main() {
    base := []int{1, 2, 3, 4}
    head := base[:2]            // len 2, cap 4 — shares base
    appendVal(head, 99)
    fmt.Println(base)           // [1 2 99 4] — clobbered base[2]!
}
```

`head` had cap 4, so `append` wrote `99` into `base[2]` rather than allocating. The bug is invisible until a slice happens to have spare capacity.

The fixes: when a function must not mutate the input, copy first (`out := make([]int, len(s)); copy(out, s)`), or use a full-slice expression to cap capacity at the slice boundary (`base[:2:2]`), which forces `append` to reallocate. Since Go 1.21, `slices.Clone` is the idiomatic copy. The mental rule: treat a slice you didn't allocate as borrowed — never `append` to it and hand the result back unless you own the backing array.

### Q83. Map of structs: why `m[k].field = x` does not compile, and the workarounds.

```go
type Point struct{ X, Y int }
m := map[string]Point{"a": {1, 2}}
m["a"].X = 10 // compile error: cannot assign to struct field m["a"].X in map
```

The reason is **addressability**. `m["a"]` is not an addressable value — the map's internal storage can move when it grows, so the runtime never lets you take the address of a map element. Assigning to `m["a"].X` would require addressing the element in place, which isn't allowed. (Reading `m["a"].X` is fine; only assignment through the element fails.)

There are three idiomatic workarounds. First, read-modify-write the whole value:

```go
p := m["a"]
p.X = 10
m["a"] = p
```

Second, and usually better when you intend to mutate, store **pointers** in the map:

```go
m := map[string]*Point{"a": {1, 2}}
m["a"].X = 10 // fine: m["a"] is a *Point, the pointer is the value
```

Here `m["a"]` yields a copy of the pointer, but that pointer addresses the same `Point`, so the field write lands.

Third, if you only need to bump a counter, the read-modify-write collapses to `m[k]++` for scalar value types, which the compiler special-cases.

The same addressability rule explains why you can't take `&m[k]`, and why range over a map of structs gives you copies (`for _, p := range m { p.X = 1 }` mutates nothing). Senior tell: choose pointer-valued maps up front when the values are mutated frequently, value maps when they're small and treated as immutable snapshots.

### Q84. Deferred Close in a loop, leaked goroutines, and unbuffered-channel deadlocks — spot-the-bug trio.

**Bug 1 — `defer` in a loop.** `defer` runs at *function* return, not loop-iteration end. This file handle pattern leaks descriptors until the function exits:

```go
for _, name := range files {
    f, err := os.Open(name) // BUG: all stay open until func returns
    if err != nil { return err }
    defer f.Close()
    process(f)
}
```

Fix: move the body into its own function (or closure) so `defer` fires per iteration, or close explicitly at the end of the loop body:

```go
for _, name := range files {
    func() {
        f, err := os.Open(name)
        if err != nil { return }
        defer f.Close()
        process(f)
    }()
}
```

**Bug 2 — leaked goroutine.** A goroutine that sends to a channel nobody reads from blocks forever and leaks. Common when the consumer returns early (e.g. on timeout) without draining:

```go
ch := make(chan int) // unbuffered
go func() { ch <- compute() }() // blocks forever if nobody receives
select {
case v := <-ch:
    use(v)
case <-time.After(time.Second): // timeout: goroutine now leaks
    return
}
```

Fix: make the channel buffered (`make(chan int, 1)`) so the send always completes, or propagate a `context.Context` the goroutine checks. Goroutine leaks don't crash — they slowly bleed memory; catch them with `goleak` in tests.

**Bug 3 — unbuffered deadlock.** Sending on an unbuffered channel from the same goroutine that will receive deadlocks immediately, because the send blocks until a receiver is ready and there is none:

```go
ch := make(chan int)
ch <- 1        // fatal error: all goroutines are asleep - deadlock!
fmt.Println(<-ch)
```

Fix: do the send from a separate goroutine, or buffer the channel. The runtime detects the *global* all-asleep case and panics, but a partial deadlock (one stuck goroutine among many running) goes undetected — that's the leak in Bug 2.

### Q85. Data race that the program "seems to work" with — show one and explain why -race is non-negotiable.

```go
func main() {
    counter := 0
    var wg sync.WaitGroup
    for i := 0; i < 1000; i++ {
        wg.Add(1)
        go func() {
            defer wg.Done()
            counter++ // DATA RACE: unsynchronized read-modify-write
        }()
    }
    wg.Wait()
    fmt.Println(counter) // usually < 1000, occasionally 1000, never guaranteed
}
```

`counter++` is three operations — load, increment, store — and concurrent goroutines interleave them, losing updates. On a fast machine with few cores it might *usually* print 1000 in a quick test and look fine, which is exactly the danger: a race is not a deterministic crash, it's undefined behavior that the Go memory model gives you no guarantees about. The compiler may cache the value in a register; on weak memory architectures (ARM) the read may never observe another goroutine's write at all.

Run it with `go run -race .` and the detector reports the exact two stacks racing on `counter`, with file and line. `-race` instruments every memory access and tracks happens-before edges via a vector-clock algorithm; it only reports races it actually observes at runtime, so you must exercise the code path — but a reported race is never a false positive.

The fix is a real synchronization primitive: `sync.Mutex` around the increment, or `atomic.Int64` (Go 1.19+) with `counter.Add(1)` for a counter specifically. The non-negotiable rule: run your test suite and integration tests under `-race` in CI. It costs ~2-10x runtime and ~5-10x memory, so you don't ship `-race` binaries to prod, but you absolutely run it in CI. "Seems to work" is not evidence of correctness for concurrent code — the absence of a `-race` report on an exercised path is.

### Q86. Time/Tick and time.After leaks, plus the JSON-number-as-float64 decoding surprise.

**`time.Tick` and `time.After` leaks.** `time.Tick` returns a channel from a ticker that **can never be garbage collected or stopped** — there's no handle to call `Stop()`. Using it in a long-lived loop leaks a runtime timer forever. The fix is `time.NewTicker`, which you can `defer t.Stop()`:

```go
// BUG: ticker leaks, can't be stopped
for range time.Tick(time.Second) { poll() }

// FIX
t := time.NewTicker(time.Second)
defer t.Stop()
for range t.C { poll() }
```

`time.After` is subtler. Each call allocates a timer that lives until it fires — even if you stop waiting on it. In a hot `select` loop it accumulates timers until they fire:

```go
for {
    select {
    case msg := <-in:
        handle(msg)
    case <-time.After(time.Minute): // a fresh timer every iteration; old ones linger
        return
    }
}
```

If `in` is busy, you spin up a new minute-long timer on every message, all sitting in the runtime heap. Fix: hoist a single `time.NewTimer` and `Reset` it, or check whether you actually need the timeout reset each iteration. (Go 1.23 made `time.After`/`Timer` timers eligible for GC as soon as they're unreferenced, which softens this — but `Tick` and the `Reset` semantics still matter, and you can't assume callers run 1.23.)

**JSON numbers decode to `float64`.** When you decode JSON into an `interface{}` (or `map[string]interface{}`), every number becomes a `float64`, not an `int`. So a 64-bit ID loses precision above 2^53 and a type assertion to `int` panics:

```go
var m map[string]any
json.Unmarshal([]byte(`{"id": 9007199254740993}`), &m)
id := m["id"].(int) // panic: interface conversion, it's a float64
fmt.Println(m["id"]) // 9.007199254740992e+15 — precision already lost
```

Fixes: decode into a typed struct with an `int64`/`json.Number` field, or call `dec.UseNumber()` on a `json.Decoder` so numbers arrive as `json.Number` (a string you convert losslessly via `.Int64()`). For large IDs, the safest contract is to send them as JSON strings. This bites people constantly when proxying arbitrary JSON through `any`.

---

## Cloud-Native Go

### Summary

**What this topic covers** — This topic is about why Go became the default language of the cloud-native ecosystem and how you operate a Go service inside a container orchestrator like Kubernetes. It spans the packaging story (static binaries, tiny images), the wire protocols you'll speak service-to-service (gRPC and REST), the three pillars of observability (logs, metrics, traces), and the operational contract a service must honor to be a good citizen in a cluster: read config from the environment, start fast, and shut down cleanly on `SIGTERM`. These are the things a platform team will judge your service on in production, and the things an interviewer probes to see if you've actually run Go in anger versus just written handlers.

**Mental model** — Think of a cloud-native Go service as a single self-contained executable that the platform treats as a black box with three contracts: a packaging contract, a runtime contract, and an observability contract. The packaging contract is "I am one static binary with no libc dependency, so you can drop me in `FROM scratch` and I'll run anywhere the kernel does." The runtime contract is "I read all my config at startup from env/flags, I expose a health endpoint, and when you send me `SIGTERM` I stop accepting new work, drain in-flight requests, and exit before the grace period." The observability contract is "I emit structured logs to stdout, expose `/metrics` for Prometheus to scrape, and propagate trace context so a request can be followed across services." When you internalize this, most cloud-native questions reduce to "which contract is this testing, and what's the failure mode if I get it wrong?" — e.g. a service that ignores `SIGTERM` causes dropped requests on every rolling deploy.

**Key terms**
- **Static binary** — a Go executable with no dynamic library dependencies; produced when `CGO_ENABLED=0`, lets you use `FROM scratch`.
- **CGO** — Go's C interop; enabling it links against libc, forcing a glibc/musl-bearing base image and breaking `scratch`.
- **distroless** — Google's minimal base images (`gcr.io/distroless/static`) with no shell or package manager, shrinking attack surface.
- **Multi-stage build** — a Dockerfile that compiles in a fat `golang` stage then copies only the binary into a tiny final stage.
- **gRPC** — Google's HTTP/2-based RPC framework using protobuf for schema and codegen; default for internal service-to-service in cloud-native.
- **protobuf** — the IDL and binary wire format; `protoc` + `protoc-gen-go` generate Go stubs from `.proto` files.
- **slog** — the structured logging package in the stdlib since Go 1.21 (`log/slog`), with leveled, key-value, handler-based output.
- **OpenTelemetry (OTel)** — vendor-neutral standard for traces/metrics; `go.opentelemetry.io/otel` is the Go SDK.
- **SIGTERM** — the signal Kubernetes sends to start graceful termination; followed by `SIGKILL` after `terminationGracePeriodSeconds`.
- **Twelve-factor** — the methodology that says config lives in the environment, not in code or committed files.
- **Readiness vs liveness probe** — readiness gates traffic; liveness restarts the pod. Conflating them causes restart loops under load.

**Why interviewers ask this** — Almost every Go job today is a backend service running in a container, so this is where theory meets operations. A junior writes a working HTTP handler and a `Dockerfile` that's 900MB and runs as root. A senior ships a 12MB distroless image, knows that `CGO_ENABLED=0` is what makes `scratch` possible (and that `net` and `os/user` quietly pull in cgo unless you disable it), drains connections on `SIGTERM`, and can explain why their readiness probe flips to failing *before* the drain starts so the load balancer stops sending traffic. The signal interviewers want is operational empathy: do you understand that your service lives in a hostile, ephemeral environment where pods are killed constantly, and have you designed for that rather than assuming a long-lived box? Bonus signal is knowing the observability story end to end — that logs alone don't scale and you need metrics and traces to debug a distributed system.

**Common confusions**
- **"`FROM scratch` works for any Go binary."** Only if `CGO_ENABLED=0`; cgo-linked binaries need libc and a TLS cert bundle you must copy in.
- **"Liveness and readiness probes are interchangeable."** A failing liveness probe restarts the pod; a failing readiness probe just removes it from the Service endpoints.
- **"gRPC is strictly faster than REST so always use it."** It wins on internal, high-volume, schema-stable links; REST/JSON wins for browsers, public APIs, and human debuggability.
- **"`log.Println` is fine for production."** Unstructured logs can't be queried or correlated; use `slog` with JSON output to stdout.
- **"Catching `SIGKILL` lets me clean up."** `SIGKILL` is uncatchable; you only get to handle `SIGTERM` within the grace period.

**What follows from this topic** — Graceful shutdown leans directly on the **Concurrency** topic (`context` cancellation, `sync.WaitGroup` for draining goroutines). The packaging and CGO discussion connects to **Build & Tooling** (`go build` flags, `-ldflags`, embedding). gRPC streaming is an applied form of the **Channels & Goroutines** model. And the observability section sets up **Performance & Profiling**, where `pprof` and `runtime/metrics` complement the Prometheus and OTel instrumentation you wire here.

### Q87. Why is Go the lingua franca of cloud-native (Docker, Kubernetes, etcd)? Static binaries, fast startup, small images.

It's mostly an accident of timing plus a genuinely good fit. Docker (2013) and Kubernetes (2014) were both written in Go at a moment when Go was the hot systems-adjacent language at Google, so the entire CNCF ecosystem — etcd, Prometheus, Istio, containerd, Helm, Terraform — grew up in Go and now reinforces itself. New infra tools pick Go because the libraries (client-go, the gRPC stack, cobra/viper) are all there.

But the technical fit is real. A Go program compiles to a single statically-linked binary with no runtime to install — no JVM, no Python interpreter, no `node_modules`. That makes it trivially containerizable: the entire image can be the binary plus a CA cert bundle, often 10-20MB versus hundreds of MB for a JVM or Node base image. Smaller images pull faster, which matters enormously when Kubernetes is scheduling and rescheduling pods across a fleet.

Startup is the other half. Go binaries start in milliseconds — no JIT warmup, no class loading. For an orchestrator that's constantly killing and rescheduling pods, autoscaling, and rolling deploys, fast cold-start is a direct operational advantage. The GC is low-latency and tuned for server workloads, and goroutines make the highly-concurrent network servers that infra tooling needs cheap to write.

The honest senior take: Go is dominant in cloud-native partly because of network effects, not pure technical superiority — Rust beats it on footprint and predictability, and Java has caught up on startup with GraalVM native images. But for the *median* networked service, Go's combination of fast compile, static binary, small image, fast start, and a batteries-included stdlib (`net/http`, `crypto/tls`, `encoding/json`) is hard to beat, and the ecosystem lock-in seals it.

### Q88. How do you build a minimal container image for a Go service (scratch/distroless, multi-stage, CGO_ENABLED=0)?

Use a multi-stage Dockerfile: compile in the full `golang` image, then copy only the binary into a minimal final stage. The key flag is `CGO_ENABLED=0`, which forces the pure-Go implementations of `net` and `os/user` and produces a fully static binary that needs no libc — that's what makes `FROM scratch` viable.

```dockerfile
FROM golang:1.23 AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /app ./cmd/server

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /app /app
USER nonroot:nonroot
ENTRYPOINT ["/app"]
```

The `-ldflags="-s -w"` strips the symbol table and DWARF debug info, shaving a few MB. Copy `go.mod`/`go.sum` and `go mod download` *before* copying source so Docker's layer cache reuses your dependencies across builds when only code changes.

`scratch` vs distroless: `scratch` is truly empty — you get the smallest possible image but you must also `COPY` in `/etc/ssl/certs/ca-certificates.crt` (or your TLS calls fail with x509 errors) and you have no `/etc/passwd` for a non-root user. Distroless `static` solves both: it ships CA certs and a `nonroot` user, still has no shell or package manager (so no `kubectl exec`-into-a-shell and a much smaller attack surface), and is the pragmatic default. Reserve `scratch` for when you want the absolute minimum and are willing to copy certs yourself.

Two bugs I see constantly. First, forgetting `CGO_ENABLED=0` — the build succeeds on the dev machine, then the container exits immediately with `no such file or directory` because the dynamic loader can't find libc in `scratch`. Second, running as root: distroless `:nonroot` or an explicit `USER` is non-negotiable for any security review. Also note: if you actually *need* cgo (e.g. SQLite via `mattn/go-sqlite3`), `scratch` is off the table — use `gcr.io/distroless/base` which carries glibc.

### Q89. gRPC in Go: protobuf, generated stubs, streaming, and how it compares to REST/JSON for service-to-service.

gRPC is the default for internal service-to-service in the Go cloud-native world. You define your service and messages in a `.proto` file, then `protoc` with `protoc-gen-go` and `protoc-gen-go-grpc` generates Go structs and typed client/server stubs. You implement the generated server interface; callers get a fully-typed client. The schema *is* the contract, versioned and shared.

```proto
service UserService {
  rpc GetUser(GetUserRequest) returns (User);
  rpc ListUsers(ListUsersRequest) returns (stream User); // server streaming
}
```

gRPC runs over HTTP/2, which buys you multiplexing (many concurrent calls on one connection) and four call shapes: unary, server-streaming, client-streaming, and bidirectional streaming. In Go a server stream is just a loop calling `stream.Send(&User{...})`; bidi is two goroutines, one looping on `stream.Recv()` and one on `stream.Send()`. The payload is protobuf binary — compact and fast to (de)serialize compared to JSON.

| Dimension | gRPC | REST/JSON |
|---|---|---|
| Wire format | protobuf (binary) | JSON (text) |
| Transport | HTTP/2, multiplexed | HTTP/1.1 or 2 |
| Contract | `.proto`, codegen, strongly typed | OpenAPI (optional), loose |
| Streaming | first-class, bidi | SSE/websockets bolt-on |
| Browser support | needs grpc-web proxy | native |
| Debuggability | needs `grpcurl` | `curl`, readable |

My rule: gRPC for internal, high-throughput, schema-stable links between services your team owns; REST/JSON for public APIs, browser clients, and anywhere humans need to read the traffic. gRPC's costs are real — you need a proto build pipeline, load balancing is harder because HTTP/2 connections are long-lived and sticky (you typically need an L7 proxy like Envoy or client-side LB rather than a naive L4 `Service`), and debugging requires `grpcurl` instead of `curl`. Don't reach for it for a three-endpoint CRUD service. A common middle ground is gRPC internally with a `grpc-gateway`-generated REST/JSON edge.

### Q90. Observability: structured logging (slog, 1.21+), metrics (Prometheus client), and OpenTelemetry tracing.

Three pillars, three different jobs. Logs tell you what happened in one service, metrics tell you aggregate trends and feed alerts, traces follow one request across many services. You need all three in a distributed system; logs alone don't scale.

Logging: since Go 1.21, use the stdlib `log/slog`. Configure a JSON handler writing to stdout (the twelve-factor way — let the platform collect it) and always log with key-value attributes, never string concatenation, so a log aggregator can query on fields.

```go
logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
slog.SetDefault(logger)
slog.Info("request handled", "method", r.Method, "path", r.URL.Path, "status", 200, "dur_ms", 42)
```

The big win over the old `log` package is structured, leveled output and `logger.With(...)` to attach request-scoped fields (like a trace ID) once. Pull the logger off the request `context` so handlers don't reach for globals.

Metrics: use the official `prometheus/client_golang`. Register counters, gauges, and histograms, and expose `promhttp.Handler()` at `/metrics` for Prometheus to scrape. Histograms (e.g. request latency buckets) are what give you p99s. Watch out for cardinality — never put unbounded values like user IDs or full URLs in label values, or you'll blow up Prometheus memory.

Tracing: OpenTelemetry is the standard. Set up a `TracerProvider` exporting OTLP to a collector, wrap your HTTP server and gRPC handlers with `otelhttp`/`otelgrpc` middleware, and trace context propagates automatically via headers. Spans nest to show where time went across services.

The senior move is correlation: inject the OTel trace ID into your `slog` records (a custom handler that reads `trace.SpanContextFromContext(ctx)`), so a log line links straight to its trace. That's the difference between "we have observability tooling" and "I can actually debug a production incident."

### Q91. Twelve-factor config in Go: env vars, flags, config precedence, and graceful handling of SIGTERM in k8s.

Twelve-factor says config lives in the environment, not in committed files, because the same binary must run unchanged across dev/staging/prod. In Go that means reading `os.Getenv` (or a typed loader like `kelseyhightower/envconfig` / `caarlos0/env`) at startup, validating it, and failing fast — `log.Fatal` on a missing required var beats a `nil` panic three hours into runtime. Establish a clear precedence: flags override env vars override built-in defaults. The stdlib `flag` package plus env fallback covers most needs; reach for `viper` only if you genuinely need layered file/env/flag config.

```go
addr := os.Getenv("LISTEN_ADDR")
if addr == "" { addr = ":8080" }
```

Graceful shutdown is the operational half and where most candidates fall down. Kubernetes terminates a pod by sending `SIGTERM`, waiting up to `terminationGracePeriodSeconds` (default 30s), then `SIGKILL` — which you cannot catch. So you must handle `SIGTERM` and drain within that window.

```go
ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGTERM, os.Interrupt)
defer stop()

srv := &http.Server{Addr: addr, Handler: mux}
go func() {
    if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
        slog.Error("listen failed", "err", err)
        os.Exit(1)
    }
}()

<-ctx.Done() // SIGTERM received
shutdownCtx, cancel := context.WithTimeout(context.Background(), 25*time.Second)
defer cancel()
if err := srv.Shutdown(shutdownCtx); err != nil { // stops accepting, drains in-flight
    slog.Error("graceful shutdown failed", "err", err)
}
```

`srv.Shutdown` stops accepting new connections and waits for in-flight requests to finish, up to the timeout — set that timeout *below* the grace period so you finish before `SIGKILL`. The subtlety interviewers love: there's a race between Kubernetes removing the pod from Service endpoints and `SIGTERM` arriving, so a well-behaved service flips its readiness probe to failing first (or sleeps a few seconds before calling `Shutdown`) to let `kube-proxy`/the load balancer stop routing new traffic, *then* drains. Skip that and you drop requests on every single rolling deploy. Also remember to cancel the root `context` you pass to outbound calls and background goroutines so they unwind too, not just the HTTP server.

---

## Security

### Summary

**What this topic covers** — Security in Go spans the language's memory-safety guarantees (and their limits), the standard library's crypto primitives, defensive handling of untrusted input, supply-chain integrity, and the common web vulnerabilities that bite Go services. Go gives you a lot for free — bounds checking, a managed runtime, no manual `free()` — but it is not a sandbox, and the stdlib happily lets you shoot yourself with `math/rand`, `text/template`, or an unbounded `io.Reader`. This topic is about knowing where the guardrails end.

**Mental model** — Treat the Go runtime as memory-safe *only in the absence of data races*. Bounds-checked slices, GC, and the lack of pointer arithmetic eliminate whole classes of CVEs (buffer overflows, use-after-free, double-free) that dominate C. But the moment two goroutines touch the same memory without synchronization, those guarantees evaporate: a torn write to an interface or slice header can hand you a corrupted pointer the runtime will dereference. So the senior mental model is layered: the *language* protects you from spatial memory bugs; *the race detector and `sync`* protect you from temporal ones; and *you* protect everything above that — input validation, crypto choices, resource limits. Crypto follows the same posture: the stdlib gives correct primitives but no opinions, so picking `crypto/rand` over `math/rand`, constant-time comparison, and a real password KDF is your job. Supply chain is verified by default (`go.sum` + checksum DB) but only as strong as your discipline about *not* disabling it.

**Key terms**
- **Data race** — concurrent unsynchronized access to memory with at least one write; UB in Go, can corrupt multi-word values.
- **`crypto/rand`** — cryptographically secure RNG; the only acceptable source for keys, tokens, salts, nonces.
- **`math/rand` / `math/rand/v2`** — fast, seedable, *predictable* PRNG; never for secrets.
- **`subtle.ConstantTimeCompare`** — timing-safe byte comparison resisting timing side-channels.
- **`bcrypt` / `argon2` / `scrypt`** — adaptive password hashing in `golang.org/x/crypto`; slow by design.
- **Decompression bomb** — small compressed payload that expands to huge size to exhaust memory.
- **`http.MaxBytesReader`** — caps request body size, returns an error past the limit.
- **Slowloris** — attack holding connections open with slow drip; defeated by server timeouts.
- **`go.sum`** — recorded cryptographic hashes of every dependency module.
- **GOSUMDB** — the public transparency checksum database (`sum.golang.org`) Go consults by default.
- **`govulncheck`** — official tool that reports known vulns *reachable* in your call graph.
- **SSRF** — server-side request forgery; coercing your server to fetch attacker-chosen URLs.

**Why interviewers ask this** — Security separates engineers who ship features from those who ship *services*. A junior says "Go is memory-safe, so we're fine"; a senior immediately qualifies that with data races and the `-race` flag, and knows the stdlib won't stop them from seeding a token generator with `math/rand`. The strongest signal is reflexive defensive defaults: capping body sizes before decoding JSON, reaching for `bcrypt` not SHA-256, using `html/template` for HTML, and running `govulncheck` in CI. Interviewers want to see that you understand *what Go gives you for free and what it pointedly does not*, because that boundary is exactly where real incidents happen.

**Common confusions**
- **"Go is memory-safe like Rust, so concurrency is safe."** No — Go has no borrow checker; data races are UB and can corrupt memory.
- **"`math/rand` is fine if I seed it well."** It is never fine for secrets; the algorithm is public and recoverable.
- **"`html/template` and `text/template` are interchangeable."** `text/template` does zero escaping and is an XSS hole in HTML contexts.
- **"`==` on `[]byte` tokens is fine."** Byte comparison short-circuits and leaks length/content via timing.
- **"`go.sum` protects me from malicious code."** It protects integrity (the bytes didn't change), not safety — a pinned-but-vulnerable dep is still vulnerable.

**What follows from this topic** — Security threads through nearly every other Go topic: the *Concurrency* topic's race detector is your memory-safety enforcement tool, *HTTP servers* is where timeouts and body limits live, *Testing* is where `govulncheck` and fuzzing belong in CI, and *Modules* underpins the supply-chain story. Get the defaults right here and the rest is hardening.

### Q92. How does Go help and hurt on memory safety vs C? Bounds checking, no pointer arithmetic, but data races can still corrupt.

Go eliminates the memory bugs that account for the majority of C/C++ CVEs. Slice and array accesses are bounds-checked (panic, not overflow); there's no pointer arithmetic, so you can't walk off the end of a buffer; the GC removes use-after-free and double-free; and there are no uninitialized reads because every value has a zero value. For the spatial-safety class of bugs, Go is genuinely in a different league than C.

Where it hurts: Go is **not** memory-safe in the presence of data races, and unlike Rust there's no compile-time enforcement preventing them. A multi-word value — an interface (type word + data word), a slice header (ptr/len/cap), or a string (ptr/len) — can be written by one goroutine and read by another mid-update. The reader can observe a type word from one assignment paired with a data word from another, producing a pointer the runtime will dereference into garbage. That's true memory corruption, reachable from pure Go with no `unsafe`.

```go
// Two goroutines racing on an interface var can tear the (type,data) pair.
var v interface{}
go func() { v = "hello" }() // 16-byte write, not atomic
go func() { _ = v.(string) }() // may read mismatched halves -> crash
```

The fix is the same as the diagnosis: synchronize. Use `sync.Mutex`, channels, or `sync/atomic` (including `atomic.Value`/`atomic.Pointer[T]` for whole values), and run tests with `go test -race` in CI. The race detector is dynamic — it only flags races it observes — so it's necessary but not sufficient; pair it with code review and avoiding shared mutable state by design.

One more sharp edge: the `unsafe` package and cgo deliberately exit the safe subset. `unsafe.Pointer` conversions and C calls can reintroduce every C-style bug, so treat any `unsafe`/cgo code as requiring the same scrutiny you'd give C. The honest one-liner for an interview: *Go is memory-safe for spatial bugs, but only data-race-free programs are fully memory-safe.*

### Q93. crypto in Go: using crypto/rand vs math/rand, constant-time comparison (subtle.ConstantTimeCompare), and password hashing.

The single most common Go crypto mistake is using `math/rand` (or `math/rand/v2`) where `crypto/rand` is required. `math/rand` is a deterministic PRNG: given the seed and algorithm (both public), an attacker can reproduce the entire stream. Anything an attacker shouldn't predict — session tokens, API keys, salts, nonces, IVs, password-reset tokens — must come from `crypto/rand`, which reads the OS CSPRNG.

```go
import "crypto/rand"

func token(n int) (string, error) {
    b := make([]byte, n)
    if _, err := rand.Read(b); err != nil { // crypto/rand.Read never returns short on success
        return "", err
    }
    return base64.RawURLEncoding.EncodeToString(b), nil
}
```

Constant-time comparison: comparing secrets with `==` or `bytes.Equal` short-circuits on the first differing byte, leaking how much of a guess was correct via timing. For MACs, tokens, or any secret equality check, use `subtle.ConstantTimeCompare(a, b) == 1`. Note it still leaks *length*, so for HMAC verification prefer `hmac.Equal`, which wraps it correctly.

Password hashing: never SHA-256 a password (too fast, brute-forceable). Use an adaptive KDF from `golang.org/x/crypto`. `bcrypt` is the pragmatic default — it salts automatically and embeds the cost:

```go
import "golang.org/x/crypto/bcrypt"

hash, _ := bcrypt.GenerateFromPassword([]byte(pw), bcrypt.DefaultCost) // cost ~10; tune up
err := bcrypt.CompareHashAndPassword(hash, []byte(attempt))            // constant-time internally
```

For new systems, `argon2id` (`x/crypto/argon2.IDKey`) is the modern recommendation — memory-hard, resists GPU/ASIC cracking — but you manage salt and parameters yourself. `bcrypt` caps input at 72 bytes (pre-hash with SHA-256 if you must accept longer). Whatever you pick, tune the cost so a single hash takes tens to low-hundreds of milliseconds on your hardware, and re-evaluate periodically.

### Q94. Handling untrusted input: JSON bombs, decompression bombs, request size limits, and slowloris timeouts.

The first rule for any HTTP handler reading a body: cap the size *before* you decode. Without a limit, `encoding/json` will happily read a multi-gigabyte body into memory. Wrap the body in `http.MaxBytesReader` (which also signals the server to close the connection cleanly when exceeded):

```go
func handler(w http.ResponseWriter, r *http.Request) {
    r.Body = http.MaxBytesReader(w, r.Body, 1<<20) // 1 MiB
    dec := json.NewDecoder(r.Body)
    dec.DisallowUnknownFields()
    var req Payload
    if err := dec.Decode(&req); err != nil {
        http.Error(w, "bad request", http.StatusBadRequest)
        return
    }
}
```

JSON bombs: deeply nested arrays/objects can blow the stack or balloon allocation even within a byte limit. `encoding/json` enforces a max nesting depth (10000) which helps, but the real defense is a tight `MaxBytesReader` plus validating the decoded shape. For untrusted JSON, also consider `dec.DisallowUnknownFields()` to reject unexpected keys and avoid mass-assignment surprises.

Decompression bombs: a few KB of gzip can expand to gigabytes. `gzip.NewReader` gives you a stream — never read it unbounded. Cap the *decompressed* output with `io.LimitReader`, and treat hitting the limit as an attack:

```go
zr, _ := gzip.NewReader(r.Body)
limited := io.LimitReader(zr, 10<<20) // 10 MiB max inflated
data, err := io.ReadAll(limited)
if err == nil && len(data) == 10<<20 {
    return errors.New("payload too large after decompression")
}
```

Slowloris and slow-read attacks: the zero-value `http.Server` has **no timeouts**, so a client can open connections and drip bytes forever, exhausting goroutines/file descriptors. Always set them explicitly: `ReadHeaderTimeout` (the cheapest single defense against slowloris), `ReadTimeout`, `WriteTimeout`, and `IdleTimeout`. For long-lived or streaming handlers where a blanket `WriteTimeout` is wrong, use `http.ResponseController` (Go 1.20+) to adjust deadlines per-request instead of disabling the server-wide guard.

### Q95. Supply-chain security: go.sum, GONOSUMCHECK/GOSUMDB, govulncheck, and dependency pinning.

Go's supply-chain model is verify-by-default. `go.sum` records a cryptographic hash for every module version (and its `go.mod`) in your build graph. On every build the toolchain re-hashes downloaded modules and fails loudly if they don't match — this is *integrity*: it guarantees the bytes you got today are the bytes recorded, defeating tampered mirrors and MITM. The first time a new module is seen, the hash is verified against the **checksum database** (`GOSUMDB`, default `sum.golang.org`), a public append-only transparency log, before being written to `go.sum`. The module proxy (`GOPROXY`, default `proxy.golang.org`) and `GONOSUMCHECK` (legacy) / `GONOSUMDB`/`GOPRIVATE` knobs control this. The senior point: **don't disable verification.** Setting `GOFLAGS=-insecure`, `GONOSUMCHECK`, or `GOSUMDB=off` to "make it work" silently removes your supply-chain protection; for private modules, scope it with `GOPRIVATE=github.com/yourorg/*` instead of turning everything off.

Integrity is not the whole story, though — `go.sum` proves a dependency is *unchanged*, not that it's *safe*. That's where `govulncheck` comes in. It cross-references your dependencies against the Go vulnerability database and, crucially, does **call-graph analysis**: it only reports vulnerabilities you actually *reach*, dramatically cutting noise versus a naive "you have a vulnerable version" scanner. Run it in CI:

```bash
go install golang.org/x/vuln/cmd/govulncheck@latest
govulncheck ./...
```

Dependency pinning: `go.mod` records exact versions and minimal version selection (MVS) makes builds deterministic — there's no floating "latest." Commit both `go.mod` and `go.sum`. Use `go mod verify` to confirm the local cache matches `go.sum`, and review `go get -u` upgrades rather than auto-bumping. For locked-down environments, vendor (`go mod vendor`) so builds don't touch the network at all. The combination — pinned versions, committed checksums, the transparency log, and `govulncheck` in CI — covers both "did the code change?" and "is the code I'm pulling known-bad?"

### Q96. Common Go web vulns: SSRF via http.Client, path traversal with filepath, template auto-escaping (html/template vs text/template).

SSRF: if you build an `http.Client` request from a user-supplied URL (webhooks, "fetch this image," link previews), an attacker can point it at internal services — `http://169.254.169.254/` for cloud metadata, `http://localhost:6379` for Redis, internal admin endpoints. The defense isn't a single flag; it's validating the resolved IP. Parse the URL, resolve the host, and reject private/loopback/link-local ranges — and re-check after redirects, since a public host can redirect to `127.0.0.1`. Use a custom `DialContext` that validates the actual IP being dialed (closing the DNS-rebinding window between check and connect), and set `CheckRedirect` to re-validate each hop. Also set a `Timeout` so the fetch can't hang.

Path traversal: joining user input into a filesystem path lets `../../etc/passwd` escape your directory. `filepath.Join` *cleans* but does not *contain* — `filepath.Join("/srv/files", "../../etc/passwd")` resolves outside the base. Validate after cleaning, or on Go 1.24+ use `os.Root` to confine all access to a directory:

```go
// Pre-1.24 pattern:
clean := filepath.Clean("/srv/files/" + name)
if !strings.HasPrefix(clean, "/srv/files/") { return errForbidden }

// Go 1.24+: traversal-proof by construction
root, _ := os.OpenRoot("/srv/files")
f, err := root.Open(name) // escaping paths error out
```

Template escaping is the one with the sharpest footgun: **`html/template` auto-escapes; `text/template` does not.** They share an identical API, so it's trivially easy to import the wrong one and ship XSS. `html/template` is context-aware — it escapes differently inside HTML body, attributes, JS, CSS, and URLs — which `text/template` never does. Rule: use `html/template` for anything rendered in a browser; reserve `text/template` for non-HTML output (config files, emails-as-text, code generation). And never defeat the escaping by wrapping user input in `template.HTML`, `template.JS`, or `template.URL` — those types tell the engine "trust me, this is safe," and using them on untrusted data reopens exactly the XSS hole the package exists to close.

---

## Resilience Patterns

### Summary

**What this topic covers** — How Go services survive partial failure: bounding the time you wait on anything (timeouts/deadlines via `context`), safely re-driving failed work (retries with backoff and jitter), shedding load when a dependency is sick (circuit breakers and bulkheads), and protecting yourself and others from overload (rate limiting). These are the patterns that separate a service that degrades gracefully from one that collapses under cascading failure. Go's standard library gives you the primitives — `context.Context`, `time`, channels — and the ecosystem fills the gaps (`sony/gobreaker`, `golang.org/x/time/rate`).

**Mental model** — Every outbound call is a liability with a clock attached. A senior engineer treats latency, not just errors, as the thing that kills systems: a downstream that's slow-but-up is more dangerous than one that's cleanly down, because it consumes your goroutines, connections, and memory while you wait. So the mental model is "bound everything." You set a deadline at the edge (the inbound request), thread the same `context.Context` through every hop, and let cancellation propagate so that when the client gives up — or the deadline fires — every downstream call unwinds. Retries are a multiplier: useful for transient blips, catastrophic during an outage because they amplify load on an already-struggling dependency (the "retry storm"). Circuit breakers exist precisely to stop that multiplier; bulkheads exist to make sure one sick dependency can't drain the resources the rest of the system needs. Rate limiting is the same instinct turned outward: bounding the rate of work so neither you nor your callers exceed what the system can sustain.

**Key terms**
- **Deadline** — an absolute time after which a `context` is `Done`; derived with `context.WithDeadline`.
- **Timeout** — a relative duration; `context.WithTimeout` is sugar over a deadline.
- **Backoff** — increasing the wait between retries, usually exponentially.
- **Jitter** — randomizing backoff to de-correlate retries across clients and avoid thundering herds.
- **Idempotency** — an operation safe to apply more than once with the same effect; the precondition for safe retries.
- **Circuit breaker** — a state machine (closed/open/half-open) that fails fast once a dependency exceeds a failure threshold.
- **Bulkhead** — isolating resources (goroutine/connection pools) per dependency so one failure can't exhaust everything.
- **Token bucket** — a rate-limiting algorithm that refills tokens at a steady rate up to a burst capacity.
- **Retry budget** — a cap on the fraction of traffic that may be retries, to prevent retry storms.
- **Thundering herd** — many clients retrying or waking in lockstep, spiking load simultaneously.
- **Cascading failure** — one component's failure overloading and toppling its neighbors.

**Why interviewers ask this** — Resilience is where the gap between "writes Go" and "operates Go in production" shows up. A junior reaches for `time.Sleep` loops and naive `for` retries; a senior talks about deadline propagation, the idempotency precondition before they'll even add a retry, and the danger of retries during an incident. The strongest signal is someone who unprompted raises the failure modes of the patterns themselves: that retries amplify outages, that a circuit breaker without a half-open probe stays open forever, that a global rate limiter starves small tenants while a per-client one needs eviction to avoid a memory leak. Interviewers also probe whether you reach for the right library (`x/time/rate`, `gobreaker`) versus hand-rolling, and whether you know the standard-library context plumbing cold.

**Common confusions**
- **"`context.WithTimeout` cancels the goroutine."** It only signals via `Done()`/`Err()`; the goroutine must actually check the context. Cancellation is cooperative.
- **"I can retry anything if I just add backoff."** Backoff controls timing, not safety — non-idempotent writes can double-charge or double-create.
- **"A retry on a fresh `http.Client` reuses the request body."** A consumed `io.Reader` body is empty on the second attempt; you need `GetBody` or a buffered body.
- **"Circuit breaker = retry."** Opposite intent: breakers fail *fast*, retries try *again*. They compose but solve different problems.
- **"Rate limiting is just a counter per second."** Fixed windows allow 2x burst at boundaries; token bucket smooths this.

**What follows from this topic** — Resilience leans on the **Concurrency** topic (context cancellation, goroutine lifecycle, `errgroup`), the **HTTP/Networking** topic (transport timeouts, connection pooling, `http.Client`), and **Observability** (you can't tune backoff or breaker thresholds without metrics and traces). It also feeds directly into **Testing** — these patterns are notoriously easy to get subtly wrong, and you want deterministic tests with injected clocks and fake dependencies.

### Q97. Implement timeouts and deadlines correctly with context across an entire request path. Where do people forget?

The rule is: a deadline is set once at the edge, and the *same* context flows through every hop. You almost never set a fresh timeout deep in the stack — you derive from the inbound one so the whole tree unwinds together.

```go
func (s *Server) handleOrder(w http.ResponseWriter, r *http.Request) {
    // Inbound context already carries the client's deadline if you set
    // ReadHeaderTimeout / a middleware deadline. Tighten if needed:
    ctx, cancel := context.WithTimeout(r.Context(), 800*time.Millisecond)
    defer cancel() // ALWAYS — leaks the timer + context tree otherwise

    user, err := s.users.Get(ctx, userID)   // passes ctx down
    if err != nil { http.Error(w, err.Error(), 502); return }

    // Parallel fan-out that respects the same deadline:
    g, gctx := errgroup.WithContext(ctx)
    var inv Inventory
    g.Go(func() error { var e error; inv, e = s.inventory.Check(gctx, sku); return e })
    g.Go(func() error { return s.fraud.Score(gctx, user) })
    if err := g.Wait(); err != nil { http.Error(w, err.Error(), 502); return }
}
```

Where people forget, in rough order of how often I see it bite:

1. **They don't pass the context down.** A repository method takes `ctx` but calls `db.Query(...)` instead of `db.QueryContext(ctx, ...)`. The timeout exists on paper and does nothing. Same with `http.NewRequestWithContext` vs `http.NewRequest`.
2. **`defer cancel()` missing.** `go vet` flags this (`lostcancel`), but people silence it. Every `WithTimeout`/`WithCancel` *must* be cancelled even on the success path, or you leak the timer goroutine.
3. **No `http.Server` timeouts.** `context` covers handler logic, but a slow client sending headers byte-by-byte never reaches your handler. Set `ReadHeaderTimeout`, `ReadTimeout`, `WriteTimeout`, `IdleTimeout` on the `http.Server` itself.
4. **`http.Client` with no `Timeout`.** The default client waits forever. Set a `Timeout` *and* pass a per-request context — the context bounds this attempt, the client `Timeout` is the backstop.
5. **Swallowing `ctx.Err()`.** When a deadline fires you should return `context.DeadlineExceeded` cleanly, not retry it or map it to a 500. Check `errors.Is(err, context.DeadlineExceeded)`.

One subtlety: don't tighten the timeout at every layer multiplicatively. If the edge gives 800ms and each of three layers shaves 200ms "to be safe," you've quietly created a 200ms budget for the deepest call. Set the budget once and let `ctx.Deadline()` be the source of truth; if a layer needs to reserve time for cleanup, do it explicitly and document it.

### Q98. Retries with backoff and jitter in Go — show a correct implementation and the idempotency precondition.

The precondition comes first, because it's the part people skip: **only retry idempotent operations.** A `GET`, a `PUT` with a fixed key, or a write guarded by an idempotency key is safe. A bare `POST /charge` is not — a retry after a timeout might double-charge, because the *original* request may have succeeded server-side even though your client timed out waiting for the response. If the operation isn't naturally idempotent, make it so (idempotency key, conditional write) before you add a retry. No exceptions.

Second: only retry *retryable* errors. Retrying a 400 or a `context.Canceled` is pointless and harmful. Retry on transient signals — timeouts, connection resets, 429, 502/503/504.

```go
func retry(ctx context.Context, max int, fn func(context.Context) error) error {
    const base, cap = 100 * time.Millisecond, 5 * time.Second
    var err error
    for attempt := 0; attempt <= max; attempt++ {
        if err = fn(ctx); err == nil || !retryable(err) {
            return err
        }
        // Exponential backoff with full jitter (AWS "Exponential Backoff and Jitter").
        backoff := min(cap, base*(1<<attempt))
        sleep := time.Duration(rand.Int63n(int64(backoff))) // full jitter: [0, backoff)
        select {
        case <-ctx.Done():
            return ctx.Err() // respect the deadline — don't sleep past it
        case <-time.After(sleep):
        }
    }
    return err
}
```

Things that make this correct rather than naive:

- **Full jitter** (`rand.Int63n(backoff)`) over fixed or "equal" jitter — it de-correlates clients best and is the simplest variant that works. Without jitter, every client that failed at the same instant retries at the same instant: a thundering herd.
- **Cap the backoff** so you don't sleep for minutes on attempt 10.
- **Respect the context** in the wait via `select` — a retry loop that ignores `ctx.Done()` will keep sleeping after the caller has given up, which is a classic goroutine leak.
- **Bound attempts** *and* consider a global **retry budget** (e.g. token bucket: retries may not exceed 10% of traffic). During an outage, per-call retry limits still let total retry volume explode; a budget caps the aggregate.

For HTTP specifically, the body bug bites everyone: an `*http.Request` body is an `io.Reader` consumed on the first attempt. Either buffer it (`bytes.NewReader`) and set `req.GetBody`, or rebuild the request each attempt. Production code should reach for `cenkalti/backoff/v4` or `hashicorp/go-retryablehttp` (which handles the body and retryable status codes for you) rather than hand-rolling.

### Q99. Circuit breaker and bulkhead patterns in Go — how would you implement or which libraries (sony/gobreaker)?

A circuit breaker is a three-state machine wrapped around a dependency:

| State | Behavior |
|---|---|
| **Closed** | Calls pass through; failures are counted. |
| **Open** | Calls fail fast (return immediately, no downstream hit) for a cooldown. |
| **Half-open** | After cooldown, allow a few probe calls; success → closed, failure → open again. |

The point is to *stop hammering a dependency that's down* and to *fail fast* so your goroutines aren't all parked waiting on a dead service — that's the mechanism that prevents cascading failure. I don't hand-roll this; `sony/gobreaker` is the standard choice and is small enough to read in one sitting.

```go
cb := gobreaker.NewCircuitBreaker(gobreaker.Settings{
    Name:        "payments",
    MaxRequests: 3,                 // probes allowed in half-open
    Interval:    10 * time.Second,  // window to clear counts in closed state
    Timeout:     30 * time.Second,  // how long to stay open before half-open
    ReadyToTrip: func(c gobreaker.Counts) bool {
        return c.Requests >= 20 && // don't trip on tiny samples
            float64(c.TotalFailures)/float64(c.Requests) > 0.5
    },
})

result, err := cb.Execute(func() (any, error) {
    return s.payments.Charge(ctx, order) // ctx still flows through
})
if errors.Is(err, gobreaker.ErrOpenState) {
    // serve cached/degraded response, don't 500
}
```

Two things people get wrong: tripping on raw counts instead of a *ratio over a minimum sample* (one failure in a low-traffic window shouldn't open the breaker), and forgetting the breaker must wrap a *fast-failing* path — pair it with a per-call timeout, or "open" still means "wait the full timeout before failing."

A **bulkhead** is resource isolation: cap how much of a shared resource any one dependency can consume, so a sick dependency can't starve the rest. In Go the idiomatic bulkhead is a buffered channel used as a semaphore (or `golang.org/x/sync/semaphore` for weighted/context-aware acquisition):

```go
sem := make(chan struct{}, 10) // at most 10 concurrent calls to this dependency
func call(ctx context.Context) error {
    select {
    case sem <- struct{}{}:
        defer func() { <-sem }()
    case <-ctx.Done():
        return ctx.Err() // shed load instead of queueing unboundedly
    }
    return doCall(ctx)
}
```

The naming comes from ship design: watertight compartments so one flooded section doesn't sink the vessel. Without bulkheads, a single slow dependency can soak up every goroutine and connection in a shared pool, and now *every* endpoint is degraded. Breaker + bulkhead + timeout compose: the timeout bounds each call, the bulkhead bounds concurrency, the breaker bounds how long you keep trying a dead dependency.

### Q100. Rate limiting with golang.org/x/time/rate (token bucket) and per-client limiting. Show usage.

`golang.org/x/time/rate` is a token bucket: a `Limiter` refills at `r` tokens/second up to a burst of `b`. `rate.NewLimiter(rate.Limit(r), b)` — `r` is the sustained rate, `b` is how much burst you tolerate. The three call styles matter:

- `Allow()` — non-blocking, returns `bool`. Use for "reject if over limit" (HTTP 429).
- `Wait(ctx)` — blocks until a token is free or the context is done. Use for client-side throttling of your own outbound calls.
- `Reserve()` — gives you a `Reservation` with a `Delay()`, for when you want to decide whether the wait is acceptable.

Server-side rejection:

```go
var limiter = rate.NewLimiter(100, 30) // 100 req/s sustained, burst 30

func mw(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        if !limiter.Allow() {
            w.Header().Set("Retry-After", "1")
            http.Error(w, "rate limit exceeded", http.StatusTooManyRequests)
            return
        }
        next.ServeHTTP(w, r)
    })
}
```

A single global limiter is rarely what you want — it lets one noisy client starve everyone. For **per-client** limiting you keep a limiter per key (IP, API key, tenant), and the trap is the **memory leak**: a naive `map[string]*rate.Limiter` grows forever as new clients appear. You need eviction.

```go
type clientLimiter struct {
    lim  *rate.Limiter
    seen time.Time
}
type Limiters struct {
    mu sync.Mutex
    m  map[string]*clientLimiter
}

func (l *Limiters) get(key string) *rate.Limiter {
    l.mu.Lock()
    defer l.mu.Unlock()
    cl, ok := l.m[key]
    if !ok {
        cl = &clientLimiter{lim: rate.NewLimiter(10, 20)}
        l.m[key] = cl
    }
    cl.seen = time.Now()
    return cl.lim
}

// Background sweeper evicts idle clients so the map doesn't grow unbounded.
func (l *Limiters) reap() {
    for range time.Tick(time.Minute) {
        l.mu.Lock()
        for k, cl := range l.m {
            if time.Since(cl.seen) > 3*time.Minute {
                delete(l.m, k)
            }
        }
        l.mu.Unlock()
    }
}
```

A few realities: this is **per-process**. Behind a load balancer with N instances, a per-instance limit of 100/s is really up to 100N/s — if you need a true global limit you push it to a shared store (Redis with a token-bucket Lua script, or a sidecar/gateway like Envoy). Token bucket is the right default over a fixed window because a fixed window allows a 2x burst across the boundary (full quota at 0.999s, full quota again at 1.001s); the bucket smooths that. And put the limiter check *before* expensive work — the whole point is to shed load cheaply, so reject at the edge, not after you've already hit the database.

---

## Tooling

### Summary

**What this topic covers** — Go ships an unusually opinionated toolchain, and the `go` command is the front door to all of it: building, testing, dependency management, vetting, profiling, and code generation. This topic is about the ecosystem of analysis and productivity tools layered on top of the compiler — `go vet`, `staticcheck`, `golangci-lint`, `gofmt`/`goimports`, the race detector, `go generate`, and the grab-bag of `go` subcommands and `GODEBUG` knobs that separate someone who *writes* Go from someone who *operates* it. The throughline is that Go's culture pushes correctness and uniformity into tooling rather than into reviewer discretion.

**Mental model** — Think in three concentric rings of correctness. The innermost ring is the **compiler**: it guarantees type safety and rejects unused variables and imports, but it deliberately stays cheap and fast, so it ignores whole classes of "compiles fine, wrong at runtime" bugs. The middle ring is **static analysis** — `go vet`, `staticcheck`, `golangci-lint` — which runs the heuristic and dataflow checks the compiler won't, catching `Printf` format mismatches, lost loop variables, ineffectual assignments, and nil-deref patterns. The outer ring is **dynamic analysis** — the race detector and the profilers — which observes the program actually running because some bugs (data races, lock contention) are invisible to static reasoning. A senior engineer wires all three into CI so that the cheap rings gate every commit and the expensive dynamic rings gate the merge. The cultural payoff: machines enforce mechanical correctness, freeing humans to review design.

**Key terms**
- **`go vet`** — built-in static checker for suspicious-but-compilable constructs, run automatically by `go test`.
- **staticcheck** — Dominik Honnef's analyzer, the de-facto standard SA tool, far deeper than vet (SAxxxx, Sxxxx, STxxxx checks).
- **golangci-lint** — a meta-runner that executes dozens of linters concurrently with shared parsing; the standard CI gate.
- **gofmt** — the canonical formatter; output is non-negotiable and version-stable.
- **goimports** — gofmt plus automatic import add/remove/group.
- **race detector** — `-race` instrumentation built on Google's ThreadSanitizer; finds data races at runtime.
- **happens-before** — the memory-model ordering relation the detector uses to decide if two accesses are concurrent.
- **`go generate`** — a convention for invoking codegen tools via `//go:generate` directives.
- **stringer** — generates `String()` methods for integer enum types.
- **GODEBUG** — runtime knobs (e.g. `gctrace`, `schedtrace`, `http2debug`) toggled via env var.

**Why interviewers ask this** — Toolchain fluency is one of the cleanest seniority signals in Go, because the language is small enough that everyone knows the syntax but only experienced engineers know how to *operate* a Go service. A junior says "I run `go build` and `go test`." A senior says "vet and staticcheck gate every PR, `-race` runs on the integration suite because it's too slow for unit-loop, I use `go mod why` to justify dependencies in review, and I reach for `GODEBUG=gctrace=1` before I reach for a profiler when I suspect GC pressure." Interviewers probe this to see whether you've shipped and maintained Go in production, debugged a flaky race, or kept a large codebase consistent. The answers reveal whether tooling is muscle memory or something you Google each time.

**Common confusions**
- **"`go vet` and `staticcheck` are the same thing"** — vet is conservative (low false positives, ships in the toolchain); staticcheck is far broader and is third-party.
- **"`-race` proves my code is race-free"** — it only detects races on code paths that actually execute under instrumentation; unexercised paths are invisible.
- **"`gofmt` and `goimports` are interchangeable"** — goimports is a superset that also fixes imports; gofmt never touches them.
- **"golangci-lint is yet another linter"** — it's a *runner* that aggregates many linters efficiently, not a checker itself.
- **"code generation is a smell"** — in Go, with no generics before 1.18 and no macros ever, codegen is idiomatic and often the right call.

**What follows from this topic** — Tooling connects to nearly every other Go topic. The race detector is meaningless without understanding the **memory model and concurrency** (goroutines, channels, mutexes). `GODEBUG=gctrace` and pprof feed directly into **performance and the runtime/GC**. `go mod` subcommands underpin **modules and dependency management**, and `govulncheck` ties into **security**. Codegen culture explains why **interfaces and generics** evolved the way they did.

### Q101. go vet, staticcheck, and golangci-lint — what classes of bugs does each catch that the compiler does not?

The compiler's job is type-checking and codegen, and it stops there by design — it'll happily compile `fmt.Printf("%d", "hello")` because the types are valid for variadic `any`. The three tools fill the gap above the compiler in increasing order of ambition.

`go vet` ships in the toolchain and runs automatically as part of `go test`. It's deliberately conservative — near-zero false positives — so its findings are almost always real. Classic catches: `Printf` format-string/argument mismatches, struct tags that won't parse, copying a `sync.Mutex` by value, unreachable code, and lost `context.CancelFunc`. It's the floor, not the ceiling.

`staticcheck` is the big one. It runs hundreds of checks across four families: `SA` (correctness bugs — `nil` map writes, impossible type assertions, ineffectual `append`), `S` (simplifications), `ST` (style), and `QF` (quickfixes). It does real dataflow analysis, so it catches things like a deferred `rows.Close()` that runs before the error check, or a loop that ignores its own variable. If you run one third-party tool, run this.

`golangci-lint` isn't a linter — it's a runner that executes vet, staticcheck, `errcheck`, `ineffassign`, `gosec`, `revive` and dozens more concurrently, sharing a single parse/typecheck pass so it's far faster than running them serially.

```yaml
# .golangci.yml — a sane starting set
linters:
  enable: [staticcheck, govet, errcheck, ineffassign, unused, gosec]
```

Rule of thumb: `go vet` is the non-negotiable floor (it's free, it runs in `go test`), `staticcheck` is the must-have correctness layer, and `golangci-lint` is the CI orchestration that runs both plus `errcheck` to catch the unchecked-error bugs that are endemic in Go.

### Q102. gofmt/goimports and the cultural significance of "there is one way to format Go". Why no style debates?

`gofmt` was a deliberate, almost ideological decision early in Go's life: the language ships with a canonical formatter, its output is the One True Format, and it is not configurable. No tabs-vs-spaces debate (it's tabs, end of discussion), no brace-placement bikeshed, no max-line-length config. `goimports` is the same engine plus automatic import management — it adds imports you reference, removes ones you don't, and groups stdlib separately from third-party.

The cultural payoff is enormous and underrated. Because there's exactly one format, diffs are minimal and meaningful — a PR never shows reformatting noise. Code review focuses entirely on *behavior and design* because formatting is mechanically settled before the PR exists. New hires don't argue style; they run `gofmt` (usually on save via their editor). The whole ecosystem looks the same, so reading an unfamiliar library feels like reading your own code.

The deeper lesson — and a good thing to say in an interview — is that the Go team treated formatting as a problem to *eliminate* rather than *manage*. A configurable formatter would have just relocated the argument into config files. By removing the knobs, they removed the argument.

```bash
gofmt -l ./...      # list files that aren't formatted (CI gate: must be empty)
goimports -w ./...  # format + fix imports in place
```

In CI, the standard gate is `test -z "$(gofmt -l .)"` — fail the build if anything is unformatted. Note `gofmt`'s output is stable across Go versions by policy, so a formatting gate won't suddenly break on a toolchain bump (the 1.19 doc-comment reformatting was the rare, pre-announced exception).

### Q103. The race detector (-race): how it works (happens-before via shadow memory), its cost, and how to use it in CI.

The race detector is built on ThreadSanitizer (TSan). When you compile with `-race`, the toolchain instruments every memory access and every synchronization event (channel send/receive, mutex lock/unlock, `sync/atomic` ops, goroutine start). At runtime it maintains **shadow memory** — extra metadata per memory location recording which goroutines accessed it and with what vector-clock timestamp.

The core logic is the **happens-before** relation from the Go memory model. Two accesses to the same location race if at least one is a write and there is no happens-before edge ordering them — i.e. they could be concurrent. Synchronization operations create those edges (a channel receive happens-after the corresponding send; an unlock happens-before the next lock). If the detector sees two unordered accesses and one writes, it prints a report with both stacks and aborts.

The catch every senior engineer states unprompted: **it only finds races on code paths that actually execute during the run.** It's a dynamic detector, not a prover. A race in an error branch you never hit stays hidden. So `-race` is only as good as your test coverage and your load.

Cost is real: roughly **5-10x slower** and **5-10x more memory**. That's why you don't ship `-race` binaries to prod and you don't run it on the tight unit-test inner loop.

```bash
go test -race ./...                    # the standard CI invocation
go test -race -count=10 ./pkg/...      # repeat to shake out timing-sensitive races
```

In CI, the practical pattern: run plain `go test` on every push for fast feedback, and run `go test -race ./...` as a separate (slower) required job, often with `-count` bumped on the concurrency-heavy packages. For services, also keep a `-race` build of integration/load tests, since real concurrency surfaces races that unit tests never trigger.

### Q104. go generate, and code generation culture in Go (stringer, mockgen, protoc). When is codegen the right call?

`go generate` is almost nothing — it's a convention, not a build step. It scans files for `//go:generate <command>` directives and runs them. It does *not* run on `go build`; you run `go generate ./...` deliberately and commit the output. That's intentional: generated code is checked into the repo, reviewable, and present without a toolchain dependency at build time.

```go
//go:generate stringer -type=State
type State int
const (
    StateIdle State = iota
    StateRunning
    StateDone
)
```

Codegen is *idiomatic* in Go, not a smell, and the historical reason matters: before generics landed in 1.18, there was no way to write a typed container or a generic helper without copy-paste or `interface{}`, so people generated typed code. Go has never had macros. So the language pushes you toward generating source you can read rather than metaprogramming you can't.

The canonical tools: `stringer` (enum `String()` methods), `mockgen`/`moq` (interface mocks for tests), `protoc` with the Go plugin (gRPC/protobuf), `sqlc` (typed query code from SQL), and `go:embed` adjacent workflows. Even with generics, mocks and protobuf bindings are still generated — generics don't help there.

When is codegen right? When the alternative is hand-maintaining repetitive, error-prone boilerplate that's mechanically derivable from a source of truth (a `.proto` file, an interface, a SQL schema, an enum). When it's *wrong*: generating code you then hand-edit (regeneration clobbers it), or generating to avoid writing a small generic function that 1.18+ now handles cleanly. The test: is there a single source of truth that the code is a faithful projection of? If yes, generate.

### Q105. Useful go subcommands for interviews: go mod why, go mod graph, go test -run/-bench, go tool, and GODEBUG knobs.

These are the commands that signal you've actually operated Go, not just written it.

**Module forensics.** `go mod why <pkg>` answers "why is this dependency in my build?" by printing the import chain from a main package to it — indispensable when justifying or removing a transitive dep in review. `go mod graph` dumps the full module dependency graph (one `module@version dep@version` edge per line); pipe it to `grep` to find who pulls in a problematic version. `go mod tidy` reconciles `go.mod`/`go.sum` with actual imports. Pair these with `govulncheck` (the official vuln scanner) which, unlike naive CVE matchers, only flags vulnerabilities in functions you *actually call*.

**Test targeting.** `go test -run 'TestFoo/subtest'` runs tests matching a regex (including subtest names) — essential when iterating on one failing case. `go test -bench=. -benchmem` runs benchmarks with allocation stats; add `-benchtime=10s` or `-count=6` for stable numbers you can feed to `benchstat`. `-cpuprofile`/`-memprofile` emit profiles for `pprof`.

```bash
go test -run TestParser/handles_empty ./parser
go test -bench=BenchmarkDecode -benchmem -count=6 ./codec
```

**`go tool`.** It fronts the bundled tools: `go tool pprof <profile>` for CPU/heap analysis, `go tool trace` for the execution tracer (goroutine scheduling, GC, syscalls), `go tool objdump` for disassembly. As of 1.24, `go tool` can also run module-pinned tools declared in `go.mod`, replacing the old `tools.go` hack.

**GODEBUG knobs.** Runtime behavior you toggle by env var, no recompile: `GODEBUG=gctrace=1` prints a line per GC cycle (reach for this before pprof when you suspect GC pressure); `schedtrace=1000` dumps scheduler state every second; `inittrace=1` times package init; `http2debug=1/2` for HTTP/2 frames. Since 1.21, `GODEBUG` also carries *compatibility* settings — e.g. `GODEBUG=httpservecontentkeepheaders=1` — letting you opt back into old behavior after a toolchain upgrade, with defaults pinned by the `go` line in `go.mod`.
