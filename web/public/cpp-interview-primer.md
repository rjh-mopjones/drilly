---
type: interview-prep
---

# C++ Interview Primer — 334 Questions

Comprehensive Q+A primer for senior C++ backend / systems interviews. Sister note to the [[Rust Interview Primer]] and [[Java Interview Primer]] — same shape, C++-flavoured: the object model, RAII & ownership, move semantics, templates & concepts, the memory model, and the UB/lifetime footguns that separate senior candidates from the rest.

Each answer is interview-shaped: opinionated, concrete, code where it clarifies. C++17/20 baseline; C++23 features (`std::expected`, `std::print`, deducing `this`, `std::generator`) called out where relevant.

1. [[#Core C++ & the Object Model]]
2. [[#Memory Management & RAII]]
3. [[#Pointers, References & Smart Pointers]]
4. [[#Value Categories & Move Semantics]]
5. [[#Classes, Constructors & the Rule of Five/Zero]]
6. [[#Const Correctness & the Type System]]
7. [[#Templates & Generic Programming]]
8. [[#Template Metaprogramming & Type Traits]]
9. [[#STL: Containers]]
10. [[#STL: Iterators & Algorithms]]
11. [[#Inheritance, Polymorphism & Virtual Dispatch]]
12. [[#Error Handling & Exceptions]]
13. [[#Concurrency & Multithreading]]
14. [[#The Memory Model & Atomics]]
15. [[#Lambdas & Functional]]
16. [[#Modern C++ (C++11 to 23 highlights)]]
17. [[#constexpr, Concepts & Ranges (C++20)]]
18. [[#Coroutines (C++20)]]
19. [[#Compilation, Linking, ODR, Build & Tooling]]
20. [[#Undefined Behaviour, Performance & Spot-the-Bug]]
21. [[#Reviewing C++ Code — Checklist & Guide]]

---

## Core C++ & the Object Model

### Summary

**What this topic covers**

The bedrock every C++ engineer is expected to explain cold — and where every C++ interview starts before it goes anywhere interesting. Three concern areas live here: (1) the **build model** — how a `.cpp` file becomes a running program through preprocessing, compilation, and linking, and what a translation unit actually is; (2) the **object model** — what an *object* is in the C++ abstract machine, storage duration, object layout, and the trivial / standard-layout / POD taxonomy; and (3) the **language primitives** — `struct` vs `class`, initialization forms and the `{}` gotchas, `auto`, `nullptr`, scope and linkage, `namespace`, and the One-Definition Rule. The 18 questions here are the surface; the semantics underneath — value semantics, deterministic lifetime, the ODR — silently underpin every later topic (Memory & RAII, Smart Pointers, Move Semantics, Templates). C++ punishes fuzzy foundations harder than most languages: get the object model wrong and you get undefined behaviour, not an exception.

**Mental model**

Think in terms of the **abstract machine** the standard defines, and the **translation-then-link** pipeline that realises it. A build runs each `.cpp` independently: the preprocessor textually expands `#include`s and macros producing a *translation unit*; the compiler turns that TU into an object file (`.o`) of machine code plus a symbol table; the linker then stitches all object files and libraries into one executable, resolving every symbol reference to a definition. Nothing is JIT-ed, nothing is managed — the output is native code that runs directly on the CPU. The second pillar is **value semantics with deterministic lifetime**: a C++ *object* is a region of storage with a type and a lifetime that begins at construction and ends at destruction. Variables *are* objects (not references to them, as in Java) — `Widget w;` builds a Widget right there in `w`'s storage. Copying copies the bytes/members; there is no implicit sharing. Lifetime is tied to *storage duration* — automatic objects die at scope exit, which is the entire foundation RAII is built on.

**Key terms**

- **Translation unit (TU)** — one `.cpp` after all `#include`s and macros are expanded; the compiler's unit of work.
- **Preprocessor** — text-substitution pass (`#include`, `#define`, `#ifdef`) that runs before real compilation.
- **Linker** — resolves symbols across object files/libraries into one binary; source of "undefined reference" and "multiple definition" errors.
- **Object** — a typed region of storage with a lifetime; the abstract-machine primitive, not necessarily a class instance.
- **Storage duration** — automatic (scope), static (program lifetime), dynamic (`new`/`delete`), thread (`thread_local`).
- **Value semantics** — variables hold objects, not handles; copies are independent. Contrast Java/C# reference semantics.
- **`struct` vs `class`** — identical except default access (public vs private) and default inheritance visibility.
- **ODR (One-Definition Rule)** — every entity has exactly one definition across the program; inline/templates get a controlled exception.
- **POD / trivial / standard-layout** — categories governing whether an object is memcpy-able and C-compatible.
- **Linkage** — internal (TU-local) vs external (program-wide) visibility of a name; controlled by `static`, anonymous namespaces, `inline`.
- **`auto`** — deduce a variable's type from its initializer (C++11); strips top-level `const`/references unless you add them back.
- **`nullptr`** — a typed null pointer literal (C++11) replacing the ambiguous `NULL`/`0`.

**Why interviewers ask this**

Three signals. (1) **Do you understand the build?** — juniors say "C++ compiles"; seniors can explain why a template goes in a header, why a missing `.cpp` in the build gives "undefined reference," and why two definitions give a linker error. Debugging real builds requires this model. (2) **Do you think in the object model?** — value semantics, storage duration, and deterministic destruction are what separate C++ reasoning from garbage-collected-language reasoning. Someone who says "I set it to null so it's freed" has not made the mental shift. (3) **Do you respect UB?** — C++ trades safety for control. Interviewers probe whether you know where the sharp edges are (uninitialised objects, ODR violations, reading a dead object) because in C++ those are silent corruption, not exceptions.

**Common confusions**

- "A header is compiled once" — no. `#include` is textual paste; the header's contents are compiled into *every* TU that includes it. That's why the ODR and include guards matter.
- "`struct` is for data, `class` is for behaviour" — a *convention*, not a rule. The only language difference is default member/inheritance access (public vs private).
- "`auto x = expr;` keeps the exact type" — it strips top-level `const` and references. `auto` on `const int&` gives you a plain `int`. Use `const auto&` when you mean it.
- "`NULL` and `nullptr` are the same" — `NULL` is an integer `0` and picks the wrong overload / breaks templates; `nullptr` has type `std::nullptr_t`. Always use `nullptr`.
- "Uninitialised means zero" — only objects with static storage are zero-initialised. Automatic-storage `int i;` is *indeterminate*; reading it is UB.
- "POD, trivial, and standard-layout are synonyms" — they overlap but answer different questions (memcpy-safe vs C-ABI-compatible). "POD" was even split into the two finer traits in C++11.

**What follows from this topic**

Everything. Storage duration and deterministic destruction feed directly into **Memory Management & RAII** — the whole RAII pattern is just "tie a resource's lifetime to an automatic object's storage duration." Value semantics sets up **Copy/Move Semantics** (what does copying an object mean, and how do you avoid it). The object layout and trivial-type discussion previews performance and interop topics. `nullptr` and pointers set up **Pointers, References & Smart Pointers**. If the object model feels shaky, fix it here first — in C++ a weak foundation doesn't just slow you down, it produces undefined behaviour you can't see.

### Q1. Walk me through what happens when you compile and run a C++ program.

Four stages, and being able to name them is table stakes:

1. **Preprocessing** — the preprocessor expands `#include` directives (pasting header text in), expands macros (`#define`), and strips `#if`/`#ifdef` branches. Output is a single *translation unit* of pure C++ with no directives left. `g++ -E foo.cpp` shows it.
2. **Compilation** — the compiler parses the TU, does semantic analysis, optimises, and emits an object file (`foo.o`) containing machine code plus a symbol table (defined symbols, and unresolved references it needs the linker to fill).
3. **Assembly** — (often folded into the compiler step) the emitted assembly becomes actual machine-code object bytes.
4. **Linking** — the linker takes all `.o` files plus libraries, resolves every external symbol reference to exactly one definition, lays out the final address space, and produces the executable.

At **runtime** the OS loader maps the binary, dynamic libraries are resolved, static objects are initialised, and `main` runs on native code — no VM, no interpreter. The two most common build errors map cleanly to two stages: `error: 'X' was not declared` is *compile-time* (a TU didn't see a declaration); `undefined reference to X` is *link-time* (no TU provided a definition).

### Q2. What is a translation unit, and why does the distinction matter?

A **translation unit** is what the compiler actually compiles: one `.cpp` file *after* the preprocessor has expanded all its `#include`s and macros. So a TU is your source file plus the full textual content of every header it pulls in, transitively.

Why it matters in practice:

- **Compilation is per-TU and independent.** The compiler sees one TU at a time and knows nothing about the others. That's why you need *declarations* in headers — so each TU can be type-checked against a promise, with the *definition* supplied elsewhere and stitched in by the linker.
- **The ODR operates across TUs.** If two TUs both include a header that *defines* a non-inline free function, you get a "multiple definition" link error — each TU compiled its own copy. This is why headers contain declarations (and `inline`/templates), not ordinary definitions.
- **Templates must be visible where instantiated.** Because instantiation happens per-TU, template definitions live in headers — the compiler needs the body in every TU that uses them.

Rule of thumb: *headers declare, one `.cpp` defines.* Understanding TUs explains the entire header/source split.

### Q3. What actually differs between `struct` and `class` in C++?

Exactly two things, and both are about defaults:

1. **Default member access** — `struct` members are `public` by default; `class` members are `private`.
2. **Default inheritance access** — `struct D : Base` inherits publicly by default; `class D : Base` inherits privately.

That's the *entire* language-level difference. Both can have constructors, destructors, virtual functions, access specifiers, templates, everything.

```cpp
struct A { int x; };            // x is public
class  B { int x; };            // x is private

struct D1 : Base {};            // public inheritance
class  D2 : Base {};            // private inheritance
```

The rest is **convention**: teams use `struct` for passive aggregates / plain data bags and `class` for types with invariants and encapsulated behaviour. Interview trap: if someone says "`struct` can't have methods" or "`struct` is a C thing," they're wrong — in C++ `struct` is a full class type. Say "public-by-default class" and move on.

### Q4. What does it mean that C++ has "value semantics," and how does it differ from Java or C#?

In C++ a variable *is* an object — it owns a region of storage holding the value directly. `Widget w;` constructs a Widget right there; `Widget w2 = w;` makes an **independent copy**. There's no hidden pointer, no sharing.

In Java/C# (for class types) a variable is a **reference/handle** to a heap object. `Widget w2 = w;` copies the *handle* — both name the same object, and mutating through one is visible through the other.

```cpp
Widget a;
Widget b = a;   // b is a full, independent copy
b.mutate();     // a is unaffected
```

Consequences of value semantics:

- **Deterministic lifetime** — the object dies when its variable goes out of scope, enabling RAII.
- **No aliasing by default** — fewer spooky-action bugs, but copies can be expensive (hence move semantics).
- **You opt into sharing explicitly** — via pointers, references, or `shared_ptr`, not implicitly.

This is *the* mental shift for engineers coming from managed languages. "In C++, `=` means copy the thing, not copy the handle."

### Q5. What is an "object" in C++, and when does its lifetime begin and end?

In the C++ abstract machine, an **object** is a region of storage that has a *type*, a *value*, and a *lifetime*. Crucially it does **not** have to be a class instance — an `int` is an object, so is an array. (Functions and references are not objects.)

Lifetime:

- **Begins** when storage is obtained *and* initialization completes (the constructor finishes, for class types).
- **Ends** when the destructor is called (for class types) or the storage is released/reused.

Using an object **outside** its lifetime — reading before construction or after destruction — is **undefined behaviour**, not a caught error:

```cpp
Widget* p;
{
    Widget w;
    p = &w;
}            // w's lifetime ends here; its destructor runs
p->use();    // UB — dangling: object no longer alive
```

Lifetime is bound to **storage duration**: automatic objects live for their scope, static objects for the program, dynamic objects until you `delete` them. This tight, deterministic coupling of lifetime to scope is the single fact RAII exploits — and the reason "I forgot it was already destroyed" is a whole class of C++ bugs.

### Q6. Explain the four storage durations in C++.

Every object has exactly one **storage duration**, which decides how long its storage lives:

| Duration | Created / destroyed | Example |
|---|---|---|
| **Automatic** | Enters/exits scope | local non-static variables, parameters |
| **Static** | Program start / end | globals, `static` locals, `static` members |
| **Dynamic** | `new` / `delete` (you control) | heap allocations |
| **Thread** | Thread start / end | `thread_local` variables |

```cpp
int g;                       // static storage
void f() {
    int a;                   // automatic
    static int s;            // static (initialised once, on first pass)
    thread_local int t;      // thread — one per thread
    int* h = new int;        // dynamic — you must delete it
    delete h;
}
```

Key facts interviewers probe: **static objects are zero-initialised** before any dynamic init; **automatic objects are *not* zero-initialised** (reading them uninitialised is UB); **`static` locals** are initialised on first control-flow pass (thread-safe since C++11 — the "magic static"); **dynamic** storage is the only one whose lifetime *you* manage, which is exactly why we wrap it in RAII types.

### Q7. What are the different initialization forms, and what's the deal with `{}` initialization?

C++ has an unfortunate abundance of init syntaxes:

```cpp
int a = 5;        // copy-initialization
int b(5);         // direct-initialization
int c{5};         // direct-list (brace) initialization
int d = {5};      // copy-list initialization
int e{};          // value-initialization -> 0
int f;            // default-initialization -> indeterminate for int!
```

**Brace `{}` init (C++11) was meant to be the uniform default**, and it has two real advantages:

- **It prevents narrowing conversions.** `int x{3.5};` is a *compile error*; `int x = 3.5;` silently truncates.
- **`T obj{};` value-initializes** — zeroes scalars, calls the default constructor for classes. Great for avoiding indeterminate values.

But it has one famous trap — the `std::initializer_list` hijack:

```cpp
std::vector<int> v1(3, 0);   // 3 elements, all 0
std::vector<int> v2{3, 0};   // 2 elements: 3 and 0  (!!)
```

If a type has an `initializer_list` constructor, `{}` prefers it, changing meaning. So: prefer `{}` for its narrowing protection and value-init, but reach for `()` when you specifically want a non-initializer-list constructor (like sizing a container).

### Q8. What is the most vexing parse?

A syntactic ambiguity where something you intend as a *variable definition* is parsed as a *function declaration*, because the grammar prefers the declaration interpretation.

```cpp
Widget w();          // NOT a default-constructed Widget!
                     // Declares a function w() returning Widget.

Widget w2(Gadget()); // Declares a function taking a (function ptr) and returning Widget
```

`Widget w();` looks like "construct `w` with the default constructor" but the compiler reads it as a function prototype named `w` taking no args. You then get baffling errors when you try to use `w` as an object.

**The fix is brace initialization:**

```cpp
Widget w{};              // unambiguously a value-initialized object
Widget w2{Gadget{}};     // unambiguously constructs from a temporary
```

This is one of the strongest arguments for preferring `{}`. Naming it correctly ("the most vexing parse") and immediately offering the brace fix is a solid senior signal.

### Q9. When should you use `auto`, and what are its pitfalls?

`auto` (C++11) deduces a variable's type from its initializer. Use it to remove noise and coupling:

- **Unspellable or verbose types** — iterators, lambdas, template results: `auto it = m.begin();`.
- **To avoid silent conversions** — `auto` gives you the *actual* type, so no accidental narrowing.
- **Range-for**: `for (const auto& x : xs)`.

Pitfalls seniors are expected to know:

- **`auto` strips top-level `const` and references.** `const std::string& r = get(); auto x = r;` — `x` is a *plain, copied* `std::string`. Use `const auto&` to bind by reference without copying.
- **`auto` with braces is a trap pre-C++17:** `auto a{1};` used to be `initializer_list<int>`; fixed in C++17 to be `int`. `auto a = {1};` is *still* an `initializer_list`.
- **Proxy types bite:** `auto b = vec_of_bool[0];` deduces `std::vector<bool>::reference`, not `bool`.

Guideline: use `auto` freely for local variables where the type is obvious from the RHS or too painful to write, but be deliberate about `const`/`&` qualifiers — write `const auto&` when you want a non-owning read-only view.

### Q10. Why prefer `nullptr` over `NULL` or `0`?

`nullptr` (C++11) is a real null-pointer literal of type `std::nullptr_t` that converts to any pointer type but **not** to an integer. `NULL` is just a macro for `0` (an `int`), and `0` is an integer that happens to be usable as a null pointer.

The problem is overload resolution and templates:

```cpp
void f(int);
void f(char*);

f(NULL);      // ambiguous or calls f(int) — NULL is 0, an int!
f(nullptr);   // unambiguously calls f(char*)
```

```cpp
template <class T> void g(T);
g(NULL);      // T deduced as int (or long) — pointer intent lost
g(nullptr);   // T deduced as std::nullptr_t — correct
```

`nullptr` also reads as *intent* — "this is a pointer" — and works cleanly with `auto`. There is no reason to use `NULL` or `0` for pointers in modern C++. Flagging this in a code review is a small but reliable competence signal.

### Q11. Explain scope and linkage. What does `static` at file scope do?

**Scope** is where a name is *visible* in source (block, function, class, namespace, file). **Linkage** is whether a name refers to the *same entity* across translation units.

- **No linkage** — local variables; each is its own entity.
- **Internal linkage** — the name is private to its TU; other TUs can't refer to it. Given by `static` at namespace/file scope, `const`/`constexpr` globals (by default), and anything in an anonymous namespace.
- **External linkage** — one entity shared program-wide; other TUs can refer to it via a declaration. Given to non-`static` functions and globals.

```cpp
static int counter = 0;   // file-scope static => internal linkage: private to this TU
int shared = 0;           // external linkage: visible to other TUs via `extern int shared;`
```

`static` is famously overloaded — at file scope it means *internal linkage*; on a local it means *static storage duration*; on a class member it means *no `this`, one shared instance*. The modern idiom for TU-private helpers is an **anonymous namespace** rather than `static`, because it also works for types.

### Q12. What is a namespace and how do you use it well?

A **namespace** partitions the global identifier space to prevent name collisions between libraries. Everything at "global scope" without an explicit namespace is really in the global namespace.

```cpp
namespace acme {
    class Widget {};
    void init();
}
acme::Widget w;        // qualified access
```

Good practice, and interview-relevant opinions:

- **Never write `using namespace std;` in a header** — it leaks into every TU that includes it and causes ambiguities. In a `.cpp`, at function scope, it's tolerable.
- **Anonymous namespaces** give internal linkage — the modern replacement for file-scope `static`:
  ```cpp
  namespace { int helper(); }   // helper is private to this TU
  ```
- **Namespace aliases** tame long names: `namespace fs = std::filesystem;`.
- **ADL (argument-dependent lookup)** means functions are also found in the namespace of their arguments — the reason `swap(a, b)` finds a type's custom `swap`. Know it exists; it's a common gotcha.

### Q13. What is the One-Definition Rule?

The **ODR** says: within a program, every variable, function, class, etc. may be *declared* many times but must be *defined* exactly once — with a narrow, deliberate exception.

Three facets:

1. **One definition per program** for non-inline functions and global variables. Two TUs each defining `void f(){}` → link error "multiple definition."
2. **One definition per TU** for classes/enums/templates, and if a class or inline entity is defined in multiple TUs, **all definitions must be token-for-token identical**. Violating this (e.g. compiling two TUs with different struct layouts under the same name, often via different macros) is **undefined behaviour the linker usually can't catch** — genuinely dangerous.
3. **The exception:** `inline` functions/variables and templates may be defined in every TU (identically), and the linker merges them. This is *why* you can put function definitions in headers by marking them `inline`.

Practical upshot: put declarations and `inline`/`template` definitions in headers; put ordinary definitions in exactly one `.cpp`. ODR violations are one of the nastier C++ bug classes because they can silently corrupt rather than error.

### Q14. What are trivial, standard-layout, and POD types — and why do they matter?

These are **type traits** that answer "can I treat this object like raw bytes / like C?"

- **Trivial** — the type has trivial (compiler-generated, no custom logic) special members: default constructor, copy/move, destructor. Implication: it can be created without running real code and **copied with `memcpy`**.
- **Standard-layout** — the memory layout is predictable and C-compatible: no mix of access specifiers on data members, no virtual functions, no virtual/multiple base weirdness. Implication: it's safe to share with C, `offsetof` works, you can reinterpret the first member.
- **POD ("Plain Old Data")** — historically both trivial *and* standard-layout. C++11 split the concept into the two finer traits above (`std::is_trivial`, `std::is_standard_layout`); `std::is_pod` was deprecated in C++20.

Why interviewers care: these traits gate real optimizations and interop. `memcpy`ing a non-trivial type (say, one owning a pointer) is a **double-free / corruption bug**. Writing a `struct` to a file or a network socket as bytes is only sound for standard-layout/trivial types. Serialization, `std::bit_cast`, shared-memory IPC, and C ABIs all live and die on this taxonomy.

### Q15. What is name mangling, and when does it bite you?

**Name mangling** is how the compiler encodes a function's full signature — namespace, class, parameter types, `const`/ref qualifiers — into the linker symbol name. It's what makes **overloading** possible: `f(int)` and `f(double)` become distinct symbols like `_Z1fi` and `_Z1fd`.

Where it bites: **linking C++ with C**. C doesn't mangle, so a C++ TU calling a C function looks for a mangled symbol that doesn't exist → "undefined reference." The fix is `extern "C"`, which tells the compiler to use C linkage (no mangling) for those declarations:

```cpp
extern "C" {
    int c_library_func(int);   // unmangled symbol, matches the C object file
}
```

Other consequences:

- Mangled names differ **across compilers/ABIs** (GCC vs MSVC), so C++ libraries aren't ABI-portable the way C ones are — hence C is the lingua franca for stable ABIs and plugin boundaries.
- Demangle stack traces with `c++filt` (or `abi::__cxa_demangle`) to turn `_Z3fooi` back into `foo(int)`.

### Q16. What happens before `main` runs, and can code run before it?

Yes — quite a lot happens before `main`:

- The OS loader maps the executable and its shared libraries into memory.
- The C++ runtime performs **dynamic initialization of objects with static storage duration** — constructors of global and namespace-scope objects run, along with any non-constant global initializers.
- Only then is `main` called.

So code absolutely runs before `main` via global constructors:

```cpp
struct Init { Init() { /* runs before main */ } };
Init g;   // constructor executes during static initialization
```

The gotcha every senior should name is the **static initialization order fiasco**: the order of dynamic initialization of statics **across different TUs is unspecified**. If global `a` in `a.cpp` uses global `b` in `b.cpp` during its constructor, you may touch `b` before it's constructed → UB. The fix is the **construct-on-first-use idiom** (a function-local static returned by reference), which defers and orders initialization deterministically. `main`'s signatures are `int main()` and `int main(int argc, char** argv)`; reaching the end implicitly `return 0;` (a special rule for `main` only).

### Q17. What does this print, and why?

```cpp
#include <cstdio>
int main() {
    int i;                // automatic storage, no initializer
    std::printf("%d\n", i);
}
```

**Trick question: it's undefined behaviour.** `i` has automatic storage duration and no initializer, so it is **default-initialized**, which for a scalar means its value is **indeterminate**. Reading an indeterminate value is UB — the program may print garbage, print 0, print different values on each run, or (with optimizations) do something entirely unpredictable, because the compiler is allowed to assume UB never happens.

The junior answer is "it prints 0" or "it prints garbage." The senior answer is: **"you can't say — it's UB, and I wouldn't ship it."** Contrast with static storage, which *is* zero-initialised:

```cpp
int g;          // static storage => guaranteed 0
int main() {
    static int s;   // also 0
    int i{};        // value-initialized => 0, and safe
}
```

Compile with `-Wall -Wextra` and the compiler warns; ASan/UBSan and valgrind catch it at runtime. The lesson: in C++, "uninitialised" is a real, dangerous state — always initialise, ideally with `{}`.

### Q18. What is object layout, and how do you reason about `sizeof` a struct?

`sizeof(T)` is the number of bytes an object of type `T` occupies, *including padding*, such that arrays of `T` are correctly aligned. Members are laid out in declaration order, each placed at an offset satisfying its **alignment** requirement, with the whole struct padded up to a multiple of its largest member's alignment.

```cpp
struct A {
    char  c;   // 1 byte  @ offset 0
    // 3 bytes padding
    int   i;   // 4 bytes @ offset 4
    char  d;   // 1 byte  @ offset 8
    // 3 bytes padding to make sizeof a multiple of 4
};
// sizeof(A) == 12, not 6
```

Reorder to shrink it — put larger/most-aligned members first:

```cpp
struct B { int i; char c; char d; };   // sizeof(B) == 8
```

Key facts: `alignof(T)` gives the requirement; `offsetof` gives a member's offset (standard-layout types only); padding bytes are **indeterminate** (don't `memcmp` structs for equality). Empty classes have `sizeof >= 1` so distinct objects have distinct addresses, but the **empty base optimization** lets an empty base contribute 0 bytes. This matters for cache behaviour and memory footprint in hot data structures — struct packing is a real performance lever, not trivia.

## Memory Management & RAII

### Summary

**What this topic covers**

How C++ manages memory — and why the language's signature idiom, RAII, exists. This is the topic that most sharply separates C++ from garbage-collected languages, and the one interviewers use to find out whether you can be trusted with a codebase that has no GC to catch your mistakes. It spans (1) the **memory model in the small** — stack vs heap, what `new`/`delete` actually do, alignment, and the array-form pitfalls; (2) **RAII** — the principle of binding resource lifetime to object lifetime, why it beats `try`/`finally`, and how destructors give deterministic cleanup; and (3) the **bug taxonomy** — leaks, double-frees, dangling pointers, use-after-free, and the tools (ASan, valgrind) that find them. The 16 questions here range from "stack vs heap" warm-ups to placement `new`, custom allocators, and arena allocation. Master this and smart pointers (the next topic) become obvious — they're just RAII applied to ownership.

**Mental model**

C++ gives you two regions and makes *you* the memory manager. The **stack** is a fast, LIFO region tied to function calls: local objects live there, allocation is a pointer bump, and cleanup is automatic and deterministic at scope exit. The **heap** (free store) is a large, unordered region you allocate from explicitly with `new`/`malloc` and must release with `delete`/`free`; it's flexible but slower, can fragment, and every allocation is a liability you must track. The central insight of modern C++ is that manual `new`/`delete` is *error-prone bookkeeping* — so you don't do it directly. Instead, **RAII** wraps every heap resource (and every non-memory resource: files, locks, sockets) in a *stack* object whose **destructor** releases it. Because destructors run deterministically when the owning object leaves scope — even on exceptions — resource release becomes automatic and correct without a GC and without manual cleanup code. "Acquire in the constructor, release in the destructor" is the whole philosophy.

**Key terms**

- **Stack** — automatic-storage region; fast, LIFO, auto-cleaned at scope exit; limited size (typically ~1–8 MB).
- **Heap / free store** — dynamically allocated region managed via `new`/`delete`; flexible, slower, fragmentable, manually tracked.
- **RAII** — Resource Acquisition Is Initialization: bind a resource's lifetime to an object's lifetime; release in the destructor.
- **Destructor** — special member run when an object's lifetime ends; the hook RAII uses for deterministic cleanup.
- **Ownership** — the responsibility for releasing a resource; every resource should have exactly one clear owner.
- **Memory leak** — allocated memory never freed; the owner was lost or forgotten.
- **Double free** — releasing the same allocation twice; corrupts the allocator → UB.
- **Dangling pointer** — a pointer to memory that has been freed or an object that has been destroyed; using it is UB.
- **`new[]` / `delete[]`** — the array forms; mixing them with the scalar forms is UB.
- **Placement new** — construct an object into pre-allocated storage without allocating; you must call the destructor manually.
- **Alignment** — the address-multiple an object's type requires; over-aligned types need `new`'s aligned overloads.
- **Arena / pool allocator** — allocate many objects from one pre-reserved block, freed en masse; amortises allocation cost.

**Why interviewers ask this**

This is *the* C++ competence gate. (1) **Can you be trusted without a GC?** — the interviewer wants evidence you instinctively think in ownership and RAII, not raw `new`/`delete` scattered through code. A candidate who reaches for `new`/`delete` for a local buffer instead of a `vector` or `unique_ptr` reveals a pre-modern mental model. (2) **Do you understand the failure modes?** — leaks, double-frees, and use-after-free are the bugs that ship crashes and CVEs; being able to explain *how* they arise and how RAII prevents them is core. (3) **Depth on demand** — placement new, custom allocators, alignment, and arenas are where senior/systems candidates show they understand the machine underneath, not just the idioms on top. Weak answers here cap the whole interview regardless of how good your algorithms are.

**Common confusions**

- "The heap is where objects live" — only *dynamically allocated* objects. Locals live on the stack; members live wherever their containing object lives.
- "RAII is about memory" — RAII is about *any* resource: file handles, mutex locks, sockets, DB connections. Memory is just the most common case.
- "Setting a pointer to `nullptr` frees the memory" — no. It only changes the pointer; if it was the last handle to a `new`ed object, you just leaked it.
- "`delete` on `nullptr` crashes" — `delete nullptr;` is explicitly a safe no-op. (But double-`delete` of a real pointer is UB.)
- "Destructors are like Java `finalize`" — no. Destructors are **deterministic** (run at a known point, at scope exit); `finalize`/GC finalizers run whenever/if-ever the collector decides.
- "Smart pointers are slower because GC" — there's no GC; `unique_ptr` is zero-overhead, and `shared_ptr`'s only cost is atomic refcounting.

**What follows from this topic**

RAII is the seed for almost everything downstream. **Pointers, References & Smart Pointers** is literally "RAII applied to ownership" — `unique_ptr`/`shared_ptr` are RAII wrappers around `new`/`delete`. **Exception safety** depends entirely on RAII: because destructors run during stack unwinding, RAII is what makes exception-safe code tractable. **Move semantics** exists to let RAII types transfer ownership cheaply instead of copying. And the containers of the standard library (`vector`, `string`, `map`) are all RAII types managing heap memory for you — which is exactly why "use a container instead of `new[]`" is the right default. Get RAII, and the rest of C++ resource management is corollaries.

### Q1. What's the difference between the stack and the heap?

| | Stack | Heap (free store) |
|---|---|---|
| **Allocation** | Pointer bump (near-free) | Allocator call (`new`/`malloc`) |
| **Deallocation** | Automatic at scope exit | Manual (`delete`/`free`) or via RAII |
| **Lifetime** | Tied to scope | Until you free it |
| **Size** | Small (~1–8 MB), fixed | Large (most of RAM) |
| **Speed** | Very fast, cache-friendly | Slower, can fragment |
| **Failure** | Stack overflow | `bad_alloc` / `nullptr` |

The **stack** holds automatic-storage objects — locals and parameters. Allocation is just moving the stack pointer, and cleanup is automatic and deterministic when the frame unwinds. The **heap** is for objects that must outlive the scope that created them or whose size isn't known at compile time; you request memory explicitly and are responsible for releasing it.

Practical guidance: **prefer the stack**. It's faster, cache-friendly, and can't leak. Use the heap only when you need dynamic lifetime or size — and even then, wrap it in a container or smart pointer rather than managing it by hand. "Default to the stack; reach for the heap deliberately, and never hold raw ownership of heap memory" is the modern stance.

### Q2. What do `new` and `delete` actually do, and why avoid raw `new`?

`new T(args)` does **two** things: (1) allocates raw storage (calls `operator new`, typically `malloc`), then (2) **constructs** a `T` in that storage, running its constructor. `delete p` does the inverse: runs `~T()` then frees the storage (`operator delete`). This constructor/destructor coupling is why `new`/`delete` aren't interchangeable with `malloc`/`free`.

Why avoid **raw** `new`/`delete` in modern C++:

- **Leaks on every early exit.** Any `return`, `break`, or thrown exception between `new` and `delete` leaks the allocation.
  ```cpp
  Widget* w = new Widget();
  if (fail()) return;        // leak — delete never runs
  delete w;
  ```
- **Ownership is invisible.** A raw pointer doesn't say who's responsible for `delete`; double-frees and leaks follow.
- **Not exception-safe** without extra scaffolding.

The rule: **almost never write raw `new`/`delete`.** Use `std::make_unique<Widget>()` / `std::make_shared`, or a container (`std::vector`, `std::string`). They allocate for you and guarantee the matching `delete` runs — even on exceptions. If you see raw `new` in a review, that's a smell to question.

### Q3. Explain RAII. Why is it the central idiom of C++?

**RAII — Resource Acquisition Is Initialization** — means: acquire a resource in a constructor and release it in the destructor, so the resource's lifetime is bound to an object's lifetime. Because destructors run **deterministically** when the object leaves scope, cleanup is automatic and guaranteed.

```cpp
class File {
    std::FILE* f;
public:
    explicit File(const char* path) : f(std::fopen(path, "r")) {
        if (!f) throw std::runtime_error("open failed");
    }
    ~File() { if (f) std::fclose(f); }   // released automatically
    // ...delete or define copy/move to control ownership...
};

void read() {
    File f("data.txt");
    // ...use f...
}   // ~File() runs here — file closed, even if an exception is thrown
```

Why it's central:

- **No leaks by construction** — you can't forget to release; the compiler inserts the destructor call.
- **Exception safety for free** — during stack unwinding, destructors run, so resources release even on the exception path. This is what makes exception-safe C++ tractable.
- **Works for *any* resource** — memory, files, locks (`std::lock_guard`), sockets, DB handles.

RAII is why C++ doesn't *need* a GC or `finally`: resource management is expressed in the type system, deterministically. It's the single most important idiom to demonstrate you understand.

### Q4. How do destructors give "deterministic cleanup," and how does that differ from GC finalizers?

A destructor runs at a **statically known point**: exactly when the object's lifetime ends — scope exit for automatics, `delete` for dynamics, or the end of the enclosing object's destruction for members. You can point at the line where it happens.

```cpp
{
    std::lock_guard<std::mutex> lk(m);   // lock acquired
    critical_section();
}   // <-- lock released HERE, deterministically, always
```

Contrast with **GC finalizers** (Java `finalize`, C# destructors): they run when — and *if* — the garbage collector decides to reclaim the object, which may be milliseconds or minutes later, or **never** (at process exit finalizers may be skipped). That's fine for pure memory (the GC reclaims it), but disastrous for scarce resources: a file handle or DB connection held until "whenever GC runs" causes handle exhaustion. That's exactly why Java needed `try`-with-resources and C# needed `using`/`IDisposable` — bolt-on mechanisms to get the determinism that C++ has natively.

Determinism is the whole point: in C++ you know *precisely* when the socket closes and the lock releases, which makes resource-tight and real-time code feasible.

### Q5. What is ownership, and why does every resource need a clear owner?

**Ownership** is the answer to "who is responsible for releasing this resource?" Every heap allocation, file handle, or lock has exactly one job to be done once — release it — and ambiguity about who does it produces the two canonical bugs:

- **Nobody owns it** → **leak** (never released).
- **Two owners** → **double free** (released twice → heap corruption → UB).

Modern C++ encodes ownership in the *type*, so it's not a matter of comment discipline:

- **`std::unique_ptr<T>`** — *exclusive* ownership. Exactly one owner; move-only, so ownership transfer is explicit and the type prevents accidental copies.
- **`std::shared_ptr<T>`** — *shared* ownership. Reference-counted; the last owner standing releases. Use only when lifetime genuinely can't be pinned to one owner.
- **Raw pointer / reference / `span`** — **non-owning** observation. "I use this but I don't free it."

The senior framing: *express ownership in the type system.* A function signature taking `unique_ptr<T>` by value says "I take ownership"; one taking `T*` or `T&` says "I just look." When ownership is clear and encoded, leaks and double-frees largely stop being possible.

### Q6. Explain memory leaks, double-frees, and dangling pointers.

The three classic manual-memory bugs, all UB-adjacent:

**Memory leak** — allocated memory is never freed because the owning handle was lost or overwritten. Not immediately fatal, but unbounded growth eventually exhausts memory.
```cpp
Widget* w = new Widget();
w = new Widget();          // first allocation leaked — nothing points to it now
```

**Double free** — the same allocation is `delete`d twice. This corrupts the allocator's bookkeeping → **undefined behaviour**, often a crash or an exploitable vulnerability.
```cpp
delete w;
delete w;                  // UB — heap corruption
```

**Dangling pointer** — a pointer that still refers to memory that's been freed or an object that's been destroyed. Dereferencing it is **use-after-free** — UB, and a top source of security exploits.
```cpp
delete w;
w->use();                  // UB — w dangles
```

RAII + smart pointers make these largely unreachable: `unique_ptr` frees exactly once and nulls itself on move; there's no manual `delete` to double up; and ownership semantics discourage keeping raw handles past the owner's life. Tooling closes the rest of the gap — **AddressSanitizer** (`-fsanitize=address`) and **valgrind** catch use-after-free, double-free, and leaks at runtime; they're standard in CI for C++ shops.

### Q7. What happens if you mix `new` with `delete[]` (or `new[]` with `delete`)?

**Undefined behaviour.** The array and scalar forms are not interchangeable — you must pair them exactly:

```cpp
int*  a = new int;         // scalar
int*  b = new int[10];     // array

delete a;                  // correct
delete[] b;                // correct

delete[] a;                // UB — scalar allocated, array-deleted
delete b;                  // UB — array allocated, scalar-deleted
```

The reason: `new[]` often stores extra bookkeeping (like the element count, so `delete[]` knows how many destructors to run) adjacent to the allocation, and may use a *different* `operator new[]`/`operator delete[]` pair than the scalar versions. `delete` on an array pointer runs only one destructor and hands the wrong address/size to the deallocator → corruption.

The modern answer to the whole hazard: **don't use `new[]`/`delete[]` at all.** Use `std::vector<T>` (dynamic array, RAII-managed) or `std::make_unique<T[]>(n)` (which correctly calls `delete[]`). Then the mismatch is impossible by construction. Raw `new[]` in a modern codebase is almost always a bug waiting to happen.

### Q8. What is placement new, and when would you use it?

**Placement new** constructs an object into storage you already have, *without allocating*:

```cpp
#include <new>
alignas(Widget) unsigned char buf[sizeof(Widget)];
Widget* w = new (buf) Widget(args);   // construct in-place, no allocation
// ...use w...
w->~Widget();                         // you MUST call the destructor manually
```

It separates the two halves of `new`: you supply the memory, placement `new` only runs the constructor. Correspondingly, there is **no matching `delete`** — you must invoke the destructor explicitly and free the raw storage yourself (if it was heap).

When it's used (all systems/library-level):

- **Custom allocators and containers** — `std::vector` allocates raw capacity once, then placement-news elements as you `push_back`, so reserved-but-unused slots hold no constructed objects.
- **Memory pools / arenas** — construct objects into a pre-reserved block.
- **`std::optional` / `std::variant` internals** — construct into inline storage on demand.

It's a sharp tool: forget the manual destructor call and you leak; get alignment wrong and you get UB. In application code you almost never need it — but explaining it demonstrates you understand that `new` is really "allocate + construct," which is a genuine senior signal.

### Q9. What are custom allocators, and why would you write one?

A **custom allocator** replaces the default `new`/`delete` (or the `std::allocator` a container uses) with your own allocation strategy. Standard containers are templated on an allocator (`std::vector<T, MyAlloc>`) precisely so you can swap the memory policy without changing the container.

Reasons to write one:

- **Performance** — the general-purpose heap allocator is a synchronised, one-size-fits-all data structure. A **pool/arena** allocator that hands out fixed-size blocks from a pre-reserved region is dramatically faster for many-small-object workloads and improves cache locality.
- **Fragmentation control** — long-running servers and games avoid heap fragmentation by allocating from arenas with predictable layout.
- **Special memory** — placing objects in shared memory, GPU-visible memory, or a fixed hardware region.
- **Determinism / real-time** — avoiding the unbounded worst-case latency of the global allocator (critical in games, trading, embedded).
- **Instrumentation** — tracking allocations for leak detection or budgeting.

C++17 added **polymorphic memory resources** (`std::pmr`) which make this ergonomic: `std::pmr::vector` takes a runtime `memory_resource` (like `monotonic_buffer_resource`), so you get arena allocation without templating everything. For most application code the default allocator is fine; custom allocators are a targeted optimization you reach for with a profiler in hand.

### Q10. What is alignment, and when does it matter?

**Alignment** is the requirement that an object of type `T` live at an address that's a multiple of `alignof(T)`. Hardware requires it: a misaligned access is slower or, on some architectures, a hardware fault. `alignof(int)` is typically 4, `alignof(double)` 8, and SIMD types like `__m256` need 32.

Where it shows up:

- **Struct padding** — the compiler inserts padding so each member is aligned, which is why `sizeof` a struct exceeds the sum of its members (see the object-model topic).
- **Over-aligned types** — a type needing more than the default alignment (e.g. a SIMD vector, or a cache-line-aligned struct to avoid false sharing). You request it with `alignas`:
  ```cpp
  struct alignas(64) CacheLine { std::atomic<int> counter; };  // own cache line
  ```
- **Allocation** — plain `malloc`/`operator new` guarantee only "max fundamental alignment." For over-aligned types, C++17 added the aligned `operator new` overloads (automatically used when you `new` an over-aligned type) and `std::aligned_alloc`.
- **`std::launder` / `std::aligned_storage`** — the tools for building correctly-aligned raw buffers for manual object construction (though `aligned_storage` is deprecated in C++23 in favour of `alignas` byte arrays).

Alignment matters most in performance work (SIMD, avoiding false sharing between threads on the same cache line) and in low-level buffer management. Getting it wrong in placement-new code is straight UB.

### Q11. Briefly — what are `std::aligned_storage` and `std::launder` for?

Both are low-level tools for hand-rolled storage; you rarely need them, but should recognise them.

**`std::aligned_storage<Size, Align>`** — historically, a way to declare a raw byte buffer with a chosen size and alignment, into which you placement-`new` objects (used to build things like `optional` or small-buffer-optimized types). It's **deprecated in C++23** because a plain `alignas(T) std::byte buf[sizeof(T)];` is clearer and avoids its footguns.

**`std::launder`** (C++17) — a barrier that tells the optimizer "the object at this address may have been replaced; don't assume the old value/type." You need it in rare cases where you construct a *new* object into storage that previously held a different object and you're still accessing through the old pointer — especially with `const` members or references, where the compiler would otherwise be allowed to cache the old contents.

```cpp
alignas(T) std::byte buf[sizeof(T)];
T* p = new (buf) T{...};
// If you reuse buf for another T, use std::launder(reinterpret_cast<T*>(buf))
```

The honest interview take: these are library-implementer / systems tools. Knowing *that they exist and why* (aligned raw storage; defeating aliasing/const-caching assumptions after in-place reconstruction) is enough for most roles — needing them daily means you're writing container internals.

### Q12. What is a memory arena (pool allocator), and what's the tradeoff?

A **memory arena** (or region/pool allocator) pre-allocates one large block up front and satisfies many small allocations by just bumping a pointer within it. Deallocation is typically all-at-once: you reset the arena, freeing everything in O(1), rather than freeing objects individually.

```cpp
// Conceptually:
char* base = /* one big block */;
char* cursor = base;
void* alloc(size_t n) { void* p = cursor; cursor += n; return p; }  // bump
void  reset()         { cursor = base; }                            // free ALL
```

Benefits:

- **Speed** — allocation is a pointer add; no free-list search, no per-object bookkeeping, no locking.
- **Cache locality** — related objects sit contiguously.
- **No fragmentation** and O(1) bulk free.

Tradeoffs:

- **No individual free** — you can't release one object; memory is reclaimed only when the whole arena resets. Great for *phase-based* lifetimes (per-frame in a game, per-request on a server, per-parse in a compiler), poor for objects with scattered independent lifetimes.
- **Destructors** — a pure bump arena doesn't run destructors on reset; fine for trivial types, but non-trivial ones need care.

C++17's `std::pmr::monotonic_buffer_resource` is exactly this pattern, standardised. The senior insight: match the allocator to the *lifetime pattern* — arenas turn "many allocations with a common death point" into near-free operations.

### Q13. What causes a stack overflow, and how is it different from a heap problem?

A **stack overflow** happens when the call stack grows past its fixed limit (commonly ~1 MB on Windows threads, ~8 MB on Linux main threads). Two usual causes:

- **Unbounded / deep recursion** — each call pushes a frame; runaway or missing-base-case recursion exhausts the stack.
  ```cpp
  void f() { f(); }   // infinite recursion -> stack overflow, crash
  ```
- **Huge automatic objects** — a large local array blows the frame in one shot: `int big[10'000'000];` as a local.

It's different from heap problems in kind:

- The stack has a **small, fixed** size decided at thread creation; the heap is large and grows. So stack overflow is about *depth/frame size*, heap exhaustion (`bad_alloc`) is about *total allocated volume*.
- Stack overflow usually **can't be caught** — it often manifests as an immediate segfault/access violation, not a C++ exception, because there's no stack room left to even run a handler. Heap exhaustion throws `std::bad_alloc` you *can* catch.

Fixes: convert deep recursion to iteration (explicit stack/loop), heap-allocate large buffers (`std::vector` instead of a giant local array), and increase the thread stack size only as a last resort. In interviews, the tell of a strong candidate is immediately connecting "recursion depth" and "large locals" to the *fixed-size* nature of the stack.

### Q14. Why is RAII better than a `try`/`finally` or manual cleanup approach?

C++ has no `finally`, and that's deliberate — RAII makes it unnecessary and is strictly better:

- **Cleanup can't be forgotten or skipped.** With `try`/`finally` (or goto-cleanup, or manual `delete` at every exit), *you* must write the release at every path, and any new early `return` you add later silently bypasses it. With RAII the destructor is attached to the *object*, so it runs on **every** exit path — normal return, exception, `break` — automatically. Correctness is structural, not disciplinary.
- **It composes.** With N resources, `try`/`finally` nests N deep and you must release in the right order; with RAII you declare N local guards and the language destroys them in reverse order of construction, correctly, for free.
  ```cpp
  void f() {
      std::lock_guard lk(m);         // released last
      auto conn = pool.acquire();    // released before lk
      auto w = std::make_unique<Widget>();
      may_throw();
  }   // all three released, reverse order, exception or not
  ```
- **Cleanup lives with the resource, not the call site.** The knowledge of *how to release* is written once, in the destructor, instead of copy-pasted into every `finally`.
- **Exception safety falls out.** Stack unwinding runs destructors, so RAII code is exception-safe by default; `try`/`finally` code is only as safe as the author's diligence.

The one-liner: *`try`/`finally` makes cleanup a runtime obligation you can forget; RAII makes it a compile-time guarantee tied to the type.* This is why languages without it (Java, C#, Python) had to add `try-with-resources`/`using`/`with` — bolt-ons approximating what C++ gets from destructors natively.

### Q15. Spot the bug.

```cpp
std::vector<Widget>& makeWidgets() {
    std::vector<Widget> v;
    v.push_back(Widget{});
    return v;                 // ???
}

auto& widgets = makeWidgets();
widgets.size();               // ???
```

**Returning a reference to a local (automatic) object** — `v` is destroyed when `makeWidgets` returns, so the returned reference **dangles**. Every use of `widgets` afterward is **use-after-free → undefined behaviour**. It may appear to "work" in a debug build because the freed stack memory hasn't been overwritten yet, which makes it an insidious, intermittent bug.

The fix is to **return by value**:

```cpp
std::vector<Widget> makeWidgets() {
    std::vector<Widget> v;
    v.push_back(Widget{});
    return v;                 // move/RVO — cheap, and safe
}
auto widgets = makeWidgets();
```

Returning by value is *not* expensive here: **RVO/NRVO** (copy elision) usually constructs `v` directly in the caller's storage, and even when it can't, the vector is **moved**, not copied. So the correct code is both safe and fast — the reference "optimization" was never an optimization, just a lifetime bug. The general rule: **never return a reference or pointer to a local**; the same trap appears with returning `c_str()` of a local string or `&local`.

### Q16. How do you find memory bugs in a C++ codebase?

You don't rely on eyeballing — you use sanitizers and dynamic analysis, and ideally wire them into CI:

- **AddressSanitizer (ASan)** — `-fsanitize=address`. Catches use-after-free, heap/stack buffer overflow, double-free, and use-after-return, with a precise stack trace at the point of the bug. Low overhead (~2x), the first tool to reach for. Pair with **LeakSanitizer** (`-fsanitize=leak`, on by default under ASan) for leaks.
- **UndefinedBehaviorSanitizer (UBSan)** — `-fsanitize=undefined`. Catches signed overflow, misaligned access, invalid casts, null deref, etc. — the "silent UB" that ASan doesn't.
- **ThreadSanitizer (TSan)** — `-fsanitize=thread`. Data races and lock-ordering bugs (relevant once you hit concurrency).
- **valgrind (memcheck)** — no recompile needed; catches leaks and invalid accesses. Slower (~20–50x) and doesn't catch stack overflows well, but great when you can't rebuild with sanitizers.
- **Static analysis** — `clang-tidy`, compiler warnings (`-Wall -Wextra -Werror`), and the Core Guidelines checkers catch classes of bugs before runtime.

The senior workflow: compile with `-Wall -Wextra`, run the test suite under **ASan+UBSan** in CI, and reach for valgrind or TSan for the cases sanitizers miss. And the strategic point — **the best debugging is prevention**: RAII and smart pointers make most of these bugs *unrepresentable*, so the tools are a safety net for the raw-pointer code you couldn't avoid.

## Pointers, References & Smart Pointers

### Summary

**What this topic covers**

The handles C++ gives you onto objects — raw pointers, references, and the smart-pointer types that automate ownership — and, just as importantly, *which to choose*. This is where RAII (the previous topic) becomes concrete: `unique_ptr` and `shared_ptr` are RAII wrappers that make correct memory management the default instead of a discipline. The 18 questions span (1) the **primitives** — raw pointers vs references, pointer arithmetic, and the `const`/pointer permutations that trip everyone up; (2) the **smart pointers** — `unique_ptr` for exclusive ownership, `shared_ptr` for shared ownership and its real costs, and `weak_ptr` for breaking cycles; and (3) the **API design layer** — how to pass smart pointers and observers (`span`, references) as parameters, and when a raw pointer is still the right tool. Get this right and most memory bugs simply can't occur; get it wrong and you'll leak, dangle, or pay for atomic refcounting you never needed.

**Mental model**

Separate two orthogonal questions: **"do I observe or do I own?"** and **"if I own, exclusively or shared?"** Raw pointers and references are **non-owning observers** — they name an object someone else's lifetime controls; you must never `delete` through them and must ensure the pointee outlives your use. **Smart pointers encode ownership.** `unique_ptr` is *exclusive* ownership: one owner, move-only, zero runtime overhead over a raw pointer — the default owning type. `shared_ptr` is *shared* ownership: a reference-counted control block keeps the object alive until the last owner drops, at the cost of atomic refcount operations and a second allocation. `weak_ptr` is a *non-owning observer of a shared object* that can detect whether it's still alive (`lock()`), used to break the reference cycles that would otherwise leak `shared_ptr`s. The design rule that falls out: **own with `unique_ptr` by default, share only when lifetime genuinely can't be pinned to one owner, and observe with references/raw pointers/`span`.**

**Key terms**

- **Raw pointer (`T*`)** — an address; may be null, may dangle, non-owning by modern convention. Supports arithmetic and rebinding.
- **Reference (`T&`)** — an alias for an existing object; can't be null, can't be rebound, no arithmetic. Cleaner for "must exist."
- **`const T*` vs `T* const`** — pointer-to-const (can't change the pointee) vs const-pointer (can't change the pointer).
- **`std::unique_ptr<T>`** — exclusive-ownership RAII pointer; move-only; zero overhead; supports custom deleters.
- **`std::make_unique` / `std::make_shared`** — factory functions that allocate and construct in one step, exception-safe.
- **`std::shared_ptr<T>`** — shared-ownership RAII pointer backed by a reference-counted **control block**.
- **Control block** — heap structure holding the strong count, weak count, and deleter for a `shared_ptr`.
- **Atomic refcount** — `shared_ptr`'s copy/destroy adjust the count atomically (thread-safe count, *not* thread-safe pointee).
- **`std::weak_ptr<T>`** — non-owning observer of a `shared_ptr`-managed object; `lock()` yields a `shared_ptr` if still alive.
- **Reference cycle** — mutually-referencing `shared_ptr`s whose counts never reach zero → leak; broken with `weak_ptr`.
- **`std::span<T>`** — non-owning view over contiguous elements (pointer + length); the modern "array parameter."
- **`std::function`** — type-erased callable wrapper; heavier than a function pointer or lambda, but stores any callable.

**Why interviewers ask this**

This is the highest-signal topic in a modern C++ interview. (1) **Ownership fluency** — the interviewer wants to hear you *default* to `unique_ptr` and justify `shared_ptr` only when sharing is real. Candidates who reach for `shared_ptr` everywhere ("it's safe") reveal they don't understand its cost or the value of single-owner clarity. (2) **The cycle bug** — knowing that two `shared_ptr`s can leak, and that `weak_ptr` is the fix, is a canonical senior question. (3) **API design** — how you pass pointers in function signatures (`unique_ptr` by value = transfer, `const T&` = observe, `span` = view) shows whether you think about ownership at interface boundaries, which is where real codebases live or die. (4) **The const/pointer permutations and pointer-vs-reference** filter for people who actually read the declarations they write.

**Common confusions**

- "`shared_ptr` is the safe default" — no; `unique_ptr` is. `shared_ptr` costs atomics and an allocation, and shared mutable ownership obscures lifetime. Use it only for genuine shared ownership.
- "`shared_ptr` is thread-safe" — only the **refcount** is atomic. Concurrent access to the **pointee** still needs your own synchronization.
- "References are just pointers" — semantically no: a reference can't be null, can't be reseated, and has no arithmetic. Different intent.
- "`make_shared` and `shared_ptr(new T)` are equivalent" — `make_shared` does one allocation (object + control block together) and is exception-safe; the raw-`new` form does two and can leak on certain argument-evaluation orders.
- "A `unique_ptr` copy" — there's no such thing; `unique_ptr` is move-only. You `std::move` it to transfer ownership.
- "`weak_ptr` keeps the object alive" — it doesn't; that's the point. You must `lock()` and check for null before using it.

**What follows from this topic**

This is where the earlier topics pay off and the later ones plug in. Smart pointers are the applied form of **Memory Management & RAII** — ownership expressed in types. `unique_ptr`'s move-only nature is the clearest motivation for **Move Semantics** (the next natural topic): you *move* ownership, you can't copy it. Passing observers by `const&`/`span` connects to **API and interface design** and to the value-semantics discussion from Core C++. And `shared_ptr`'s atomic refcount and the "count-is-atomic-but-pointee-isn't" caveat set up **Concurrency**. The through-line of modern C++ — *make correct resource handling the path of least resistance* — is most visible right here.

### Q1. What's the difference between a pointer and a reference?

| | Pointer (`T*`) | Reference (`T&`) |
|---|---|---|
| **Null?** | Yes (`nullptr`) | No — must bind to an object |
| **Rebind?** | Yes — can point elsewhere | No — bound for life at init |
| **Arithmetic?** | Yes (`p+1`, `p[i]`) | No |
| **Must init?** | No (but should) | Yes |
| **Levels** | Pointer-to-pointer OK | No reference-to-reference |

A **reference** is an alias for an existing object — a second name for it. A **pointer** is an independent object holding an address, which can be null, reassigned, and arithmetic'd.

Guidance on which to use:

- **Reference** when the thing *must* exist and you won't rebind — function parameters you read/modify, especially `const T&` for cheap read-only passing. It documents "this is never null."
- **Pointer** when absence is meaningful (`nullptr` = "none"), when you need to rebind, or when you need arithmetic / to iterate raw memory.

The senior nuance: prefer references in APIs where "always present" is true, because they make null-checking unnecessary and encode intent. Reach for a (raw, non-owning) pointer specifically when *optional* or *rebindable* is part of the contract.

### Q2. Explain pointer arithmetic and its rules.

Pointer arithmetic moves a pointer in **units of the pointed-to type**, not bytes: `p + 1` advances by `sizeof(*p)` bytes. It's how array iteration works under the hood.

```cpp
int a[5] = {10,20,30,40,50};
int* p = a;        // &a[0]
*(p + 2);          // 30  — advanced by 2*sizeof(int)
p[2];              // identical: p[2] == *(p+2)
ptrdiff_t d = &a[4] - &a[0];   // 4 (element count, signed)
```

The rules that make it *defined* (violating them is UB, even if it "works"):

- You may only compute/compare pointers **within a single array** (or one-past-the-end). Forming a pointer before the start or more than one-past-the-end is UB — no wraparound guarantees.
- **One-past-the-end** is a valid pointer to *form and compare* but not to *dereference*; it's what `end()` iterators are.
- Subtracting two pointers is only defined **within the same array**, yielding a signed `ptrdiff_t` element count.

Practical note: in modern C++ you rarely do raw pointer arithmetic — iterators, range-for, and `std::span` express the same traversals more safely. But understanding it is essential for reading legacy/systems code and for knowing why out-of-bounds pointer formation is UB, not merely "reading wrong memory."

### Q3. Untangle `const` with pointers: `const T*`, `T* const`, and `const T* const`.

Read declarations **right-to-left**; the `const` binds to whatever is immediately to its left (or to the thing on its right if it's leftmost):

```cpp
const int* p;        // pointer to const int: change p, NOT *p
int* const p = &x;   // const pointer to int: change *p, NOT p
const int* const p = &x;  // const pointer to const int: change neither
```

- **`const int*`** (a.k.a. `int const*`) — **pointer-to-const**. You can reseat the pointer, but you can't modify the pointee *through it*. This is the common one — used for "I'll read but not write your data" parameters.
- **`int* const`** — **const pointer**. You can modify the pointee, but the pointer itself is fixed for life (like a reference, but nullable-at-init).
- **`const int* const`** — both fixed.

The trick that resolves any case: find the `*`, then read outward. Whatever is left of the `*` describes the *pointee*; a `const` right of the `*` (before the name) describes the *pointer*. Getting this right matters because `const`-correctness propagates through APIs — a `const int*` parameter is a promise to the caller that you won't mutate their object, and the type system enforces it.

### Q4. What is `std::unique_ptr`, and why is it the default owning pointer?

`std::unique_ptr<T>` is a smart pointer expressing **exclusive ownership**: exactly one `unique_ptr` owns the object, and when it's destroyed (scope exit, reassignment, explicit reset) it `delete`s the object automatically. It's the RAII wrapper around `new`/`delete`.

Why it's the default:

- **Zero overhead.** A `unique_ptr` is the size of a raw pointer (with the default deleter) and generates the same code — you pay *nothing* for the safety.
- **Move-only, so ownership is unambiguous.** You can't copy it; you `std::move` it to transfer ownership. The type system guarantees a single owner, killing double-free and unclear-ownership bugs.
- **Exception-safe.** It frees on every exit path, including exceptions.

```cpp
auto w = std::make_unique<Widget>(args);   // owns a Widget
use(*w);
auto w2 = std::move(w);                     // ownership transferred; w is now null
// automatic delete when w2 dies
```

Guideline: **when you need heap allocation and a single owner (the common case), reach for `unique_ptr`.** It's as cheap as a raw pointer, as safe as RAII gets, and it documents ownership in the type. Only escalate to `shared_ptr` when ownership genuinely must be shared.

### Q5. Why prefer `std::make_unique` / `std::make_shared` over `new`?

Three reasons, in order of importance:

1. **Exception safety.** Consider `f(std::shared_ptr<Widget>(new Widget), mayThrow());`. The compiler may evaluate `new Widget`, then `mayThrow()` (which throws) *before* the `shared_ptr` is constructed — leaking the raw allocation. `make_shared`/`make_unique` construct the smart pointer in one indivisible step, so there's no window to leak.
2. **No raw `new` in sight.** They keep ownership in the type from birth — you never hold a raw owning pointer, so you can't forget to wrap it.
3. **`make_shared` is more efficient.** It allocates the object *and* the control block in a **single** allocation, versus two for `shared_ptr(new T)` — fewer allocations, better locality.

```cpp
auto u = std::make_unique<Widget>(a, b);
auto s = std::make_shared<Widget>(a, b);
```

Caveats worth knowing (senior nuance): `make_shared`'s single allocation means the object's memory isn't freed until the last **`weak_ptr`** also dies (object and control block share the block), so with large objects and long-lived `weak_ptr`s the two-allocation form can be preferable. And you can't use `make_unique`/`make_shared` when you need a **custom deleter** or must pass a specific already-`new`ed pointer. Default to the factories; drop to explicit construction only for those cases.

### Q6. What is a custom deleter, and when do you need one?

By default `unique_ptr`/`shared_ptr` call `delete` on destruction. A **custom deleter** replaces that with your own cleanup — essential when the resource isn't freed by `delete`:

```cpp
// C API resource: fopen/fclose
auto closer = [](std::FILE* f){ if (f) std::fclose(f); };
std::unique_ptr<std::FILE, decltype(closer)> fp(std::fopen("d.txt","r"), closer);

// Or a C library handle
std::shared_ptr<Conn> c(open_conn(), [](Conn* p){ close_conn(p); });
```

When you need it:

- **Non-`new` resources** — C library handles (`FILE*`, sockets, `sqlite3*`), OS handles, GPU resources — anything freed by a specific function rather than `delete`.
- **Array allocations** — though `std::unique_ptr<T[]>` handles `delete[]` for you.
- **Special cleanup** — logging, returning to a pool, decrementing an external counter.

Type differences worth flagging: for `unique_ptr`, the deleter is **part of the type** (`unique_ptr<T, Deleter>`), so a stateless-lambda deleter keeps it pointer-sized; for `shared_ptr`, the deleter is **type-erased into the control block**, so `shared_ptr<T>` stays the same type regardless of deleter — more flexible, slightly heavier. This is exactly what makes smart pointers a universal RAII mechanism for *any* resource, not just memory.

### Q7. How does `std::shared_ptr` work internally?

A `shared_ptr<T>` is **two** pointers: one to the managed object, and one to a heap-allocated **control block**. The control block holds:

- the **strong reference count** — how many `shared_ptr`s own the object;
- the **weak reference count** — how many `weak_ptr`s observe it;
- the **deleter** and allocator (type-erased).

Mechanics:

- **Copying** a `shared_ptr` atomically **increments** the strong count; **destroying/reassigning** one atomically **decrements** it.
- When the **strong count hits 0**, the object is destroyed (deleter runs). When the **weak count** *also* hits 0, the control block itself is freed.

```cpp
auto a = std::make_shared<Widget>();  // strong=1
{
    auto b = a;                       // strong=2 (atomic ++)
}                                     // b dies -> strong=1 (atomic --)
// a dies -> strong=0 -> Widget destroyed
```

Costs to name in an interview: **two allocations** with `shared_ptr(new T)` (one avoided by `make_shared`), **twice the pointer size**, and **atomic** refcount operations on every copy/destroy — which can be a real contention cost in hot, multithreaded code. And the classic caveat: the *count* is atomic, but the *pointee* is not synchronized — sharing the object across threads still needs your own locking.

### Q8. What is the `shared_ptr` cycle problem, and how does `weak_ptr` fix it?

If two objects hold `shared_ptr`s to **each other**, their strong counts never reach zero — each keeps the other alive — so both **leak**, even after all external references are gone.

```cpp
struct Node {
    std::shared_ptr<Node> next;
    std::shared_ptr<Node> prev;   // BUG: cycle
};
auto a = std::make_shared<Node>();
auto b = std::make_shared<Node>();
a->next = b;   // b strong=2
b->prev = a;   // a strong=2
// a,b go out of scope -> each drops to 1, never 0 -> both leak
```

The fix: make the **back-reference** a `std::weak_ptr`, which observes without owning (doesn't bump the strong count):

```cpp
struct Node {
    std::shared_ptr<Node> next;   // owns forward
    std::weak_ptr<Node>   prev;   // observes back — no cycle
};
```

Now when the external owners drop, the strong counts reach zero and the objects are destroyed. To *use* a `weak_ptr` you call `lock()`, which returns a `shared_ptr` (non-null only if the object is still alive):

```cpp
if (auto p = node->prev.lock()) { p->doThing(); }  // safe, checked
```

The general principle: in any ownership graph, decide a **direction of ownership** — owners hold `shared_ptr`, back/observer edges hold `weak_ptr`. Parent-owns-child trees, observer patterns, and caches are the usual places this bites. Naming `weak_ptr` as the cycle-breaker is the expected senior answer.

### Q9. When do you use `unique_ptr` vs `shared_ptr` vs `weak_ptr`?

A decision procedure:

- **`unique_ptr` — the default for owning.** Use whenever there's (or can be) a single clear owner: factory returns, pImpl, members that own a resource, objects in a container. Cheap, clear, move-transferable.
- **`shared_ptr` — only for genuine shared ownership.** Use when the object's lifetime truly can't be tied to one owner: multiple independent parts of the system keep it alive and *any* of them may be the last. Examples: shared immutable config/cache entries, nodes referenced by several subsystems. Pay the atomic + allocation cost consciously.
- **`weak_ptr` — non-owning observation of a shared object.** Use to break cycles (back-pointers, parent links) and for caches/observers that must not extend lifetime and must detect expiry via `lock()`.
- **Raw pointer / reference — non-owning observation, no lifetime tracking.** Use for parameters and short-lived views where the callee doesn't participate in ownership and the object provably outlives the call.

The anti-pattern to call out: **`shared_ptr` everywhere "to be safe."** It hides who really owns what, adds atomic contention, and turns lifetime bugs into leaks. Strong candidates start from `unique_ptr` + non-owning observers and *justify* every `shared_ptr`. Rule of thumb: *own uniquely, share reluctantly, observe freely.*

### Q10. How should you pass smart pointers as function parameters?

Match the parameter type to what the function *does with ownership* — this is a classic Herb Sutter guideline set:

- **Just uses the object, doesn't touch ownership** → take `T&` or `const T&` (or `T*` if null is meaningful). **Not** a smart pointer.
  ```cpp
  void render(const Widget& w);        // I only read it
  ```
- **Takes ownership (sink)** → take `std::unique_ptr<T>` **by value**; caller must `std::move` in.
  ```cpp
  void store(std::unique_ptr<Widget> w);   // ownership transferred
  ```
- **Might share ownership / keeps a copy that outlives the call** → take `std::shared_ptr<T>` **by value**.
  ```cpp
  void cache(std::shared_ptr<Widget> w);   // co-owns
  ```
- **Reseats the caller's smart pointer** → take `unique_ptr<T>&` or `shared_ptr<T>&` (rare).

The key insight interviewers look for: **don't take `const shared_ptr<T>&` just to read the object.** That needlessly couples the API to `shared_ptr` and forces every caller to have one. If you only use the object, take a reference to the *object*. Smart pointers in signatures should appear **only when the function participates in ownership**; otherwise pass the plain reference/pointer/`span`. This keeps interfaces decoupled from callers' storage choices.

### Q11. What is `std::span`, and why use it for parameters?

`std::span<T>` (C++20) is a **non-owning view** over a contiguous sequence — essentially a `{pointer, length}` pair. It owns nothing; it just describes "these N elements living somewhere else."

The problem it solves: an "array parameter" used to force a choice between overloads or template bloat. `span` unifies them:

```cpp
double sum(std::span<const int> xs) {          // one function...
    double s = 0; for (int x : xs) s += x; return s;
}

std::vector<int> v{1,2,3};
int raw[] = {4,5,6};
std::array<int,2> a{7,8};
sum(v);            // works
sum(raw);          // works — knows its size
sum(a);            // works
sum({raw, 2});     // explicit pointer+length
```

Why prefer it:

- **Decouples from container type** — accepts `vector`, `array`, C array, or any contiguous range without templating or copying.
- **Carries the length** — no separate `(ptr, size)` params, so no length/pointer mismatch bugs, and range-for/bounds info come along.
- **Zero copy, zero ownership** — it's a view, ideal for "operate on someone else's buffer."

The caveat: because it's non-owning, a `span` **dangles** if the underlying container is resized or destroyed while you hold it — treat it like a reference, valid only as long as the source is. For read-only, use `std::span<const T>`. It's the modern answer to "how do I pass a range I don't own."

### Q12. What causes a dangling reference, and how do you avoid it?

A **dangling reference** (or pointer) refers to an object whose lifetime has ended — using it is **use-after-free / UB**. The recurring causes:

- **Returning a reference/pointer to a local:**
  ```cpp
  const std::string& name() { std::string s = "bob"; return s; }  // s dies; dangles
  ```
- **Reference to a temporary that's gone:**
  ```cpp
  const int& r = std::vector<int>{1,2,3}[0];   // temp vector destroyed at ; -> dangles
  ```
- **Holding a reference/`span`/iterator into a container that reallocates:**
  ```cpp
  int& first = v[0];
  v.push_back(x);        // may reallocate -> first now dangles
  ```
- **Capturing by reference in a lambda that outlives the captured object** (e.g. stored callback capturing a local by `&`).

How to avoid them:

- **Return by value** (RVO/move makes it cheap) instead of returning references to locals.
- Ensure the referent **outlives** every reference to it — bind references only to objects with longer lifetime.
- Beware **iterator/reference invalidation** rules of containers; re-fetch after mutation.
- Prefer **owning types** (value, `unique_ptr`) at storage boundaries and non-owning views only for transient use.
- Turn on **`-Wdangling`/`-Wreturn-local-addr`** and run **ASan**, which catches most of these at runtime.

The mental rule: a reference/`span`/iterator is a *borrow* — it's only valid while the lender is alive and unmodified.

### Q13. Should APIs take references or pointers? How do you decide?

Decide on two axes — **can it be absent?** and **can it be rebound?**

- **Use `T&` / `const T&`** when the argument **must** refer to a valid object and you won't reseat it. This is the default for pass-by-reference parameters. It documents "never null," so the callee needs no null check.
  ```cpp
  void draw(const Shape& s);   // always a real shape
  ```
- **Use `T*` (raw, non-owning)** when **null is a legitimate value** ("optional, not provided") or you need to reassign what it points at.
  ```cpp
  void draw(const Shape* s);   // nullptr = "nothing to draw"
  ```
- **Use a smart pointer** *only* if the function participates in **ownership** (see the parameter-passing question) — not merely to access the object.

Supporting nuances: `std::optional<T&>` isn't available pre-C++26, so an optional-reference is usually expressed as a raw pointer or `std::reference_wrapper`. For out-parameters, prefer returning a value (or a struct/`tuple`) over a `T&` out-param when you can — it reads better. The overarching principle: **the type should encode the contract** — `const T&` says "I read your object and it must exist," `T*` says "maybe nothing," and an owning pointer says "I'm taking responsibility." Choose the least-privileged type that expresses the truth.

### Q14. What is `this`, and what type is it?

`this` is an implicit pointer available in non-static member functions, pointing to the object the function was called on. Its type reflects the member function's cv-qualifiers:

```cpp
struct Widget {
    void a();         // this is       Widget*
    void b() const;   // this is const Widget*
};
```

Uses and gotchas worth knowing:

- **Disambiguation / explicit member access** — `this->x` when a parameter shadows a member, or in templates to force dependent-name lookup.
- **Returning `*this`** — enables fluent/chained interfaces (`obj.set(1).set(2)`), the builder pattern.
- **`shared_ptr` from within** — you cannot just wrap `this` in a `shared_ptr` (double-free). Inherit from `std::enable_shared_from_this<T>` and call `shared_from_this()` to get a `shared_ptr` that shares the existing control block.
- **`delete this`** — legal in narrow patterns (reference-counted objects managing their own lifetime), but a red flag outside them.
- **C++23 "deducing this"** — you can now write an explicit object parameter (`void f(this Self&& self)`), enabling things like recursive lambdas and de-duplicating const/non-const overloads.

`this` being a **pointer** (not a reference) is a historical quirk — it predates references in C++. That's the kind of trivia detail that occasionally comes up; the substantive points are the cv-qualification and `enable_shared_from_this`.

### Q15. Spot the bug.

```cpp
std::shared_ptr<Widget> getWidget() {
    Widget w;
    return std::shared_ptr<Widget>(&w);   // ???
}
```

**Constructing a `shared_ptr` from the address of a local (stack) object.** `w` has automatic storage and is destroyed when `getWidget` returns — but the `shared_ptr` thinks it *owns* it and will call `delete &w` when its count hits zero. Two disasters compound: (1) the returned pointer immediately **dangles** (the object is already destroyed), and (2) `delete` is called on **stack memory that was never `new`ed** → undefined behaviour / heap corruption.

The rule: **a `shared_ptr`/`unique_ptr` must own something that was heap-allocated (via `new`/`make_*`)** — never the address of a local, a member, or a static.

Correct versions depending on intent:

```cpp
std::shared_ptr<Widget> getWidget() {
    return std::make_shared<Widget>();   // owns a real heap Widget
}
// or if you don't need heap at all:
Widget getWidget() { return Widget{}; }  // value semantics, RVO
```

A related trap is making two independent `shared_ptr`s from the *same* raw pointer (`shared_ptr<Widget> a(p); shared_ptr<Widget> b(p);`) — two control blocks, double free. Always create the smart pointer once, via a factory, and pass *it* around.

### Q16. What's the difference between a function pointer, a lambda, and `std::function`?

Three ways to pass "callable behaviour," from lightest to heaviest:

- **Function pointer (`R(*)(Args...)`)** — a raw address of a free/static function. Tiny (pointer-sized), no state/capture, C-compatible. Use for plain callbacks with no captured context.
  ```cpp
  int (*op)(int,int) = &add;
  ```
- **Lambda** — an anonymous function object the compiler generates; each lambda is its own **unique unnamed type**. A *captureless* lambda converts to a function pointer; a capturing one does not (it holds state). Lambdas are typically **inlined** — zero overhead — which is why STL algorithms take them by template parameter.
  ```cpp
  auto add = [](int a,int b){ return a+b; };
  auto plusN = [n](int x){ return x+n; };   // captures n, stateful
  ```
- **`std::function<R(Args...)>`** — a **type-erased** wrapper that can hold *any* callable with that signature (function pointer, lambda, functor, bound member). Flexibility costs: it may **heap-allocate** for large captures, and calls go through an **indirect/virtual dispatch**, so it's slower than a direct lambda call.
  ```cpp
  std::function<int(int,int)> f = add;   // stores anything matching int(int,int)
  ```

Guidance: **prefer a template parameter (or `auto` lambda)** for callables in hot paths so the call inlines; reach for `std::function` only when you need to **store heterogeneous callables in a common type** (e.g. a `std::vector<std::function<...>>` of callbacks, or a class member holding a caller-supplied handler). In C++23, `std::move_only_function` and `std::function_ref` (the latter a non-owning view) fill the gaps where `std::function`'s copyability or allocation is unwanted.

### Q17. Are `shared_ptr`'s reference-count operations thread-safe? What exactly is and isn't?

Precisely: the **control block's reference counts are atomic**, so *these* operations are thread-safe without extra locking:

- **Copying/destroying different `shared_ptr` instances** that point to the same object from multiple threads — the strong count increments/decrements atomically, and the object is destroyed exactly once by whichever thread drops the last reference.

What is **not** thread-safe:

- **The managed object itself.** Two threads reading/writing the pointee concurrently is a data race unless *you* synchronize it — `shared_ptr` says nothing about the object's own thread-safety.
- **Mutating the *same* `shared_ptr` instance from multiple threads** — e.g. one thread `reset()`ing a `shared_ptr` while another copies that same instance. The control-block count is atomic, but the `shared_ptr`'s own two pointers aren't updated atomically as a unit. For that you need `std::atomic<std::shared_ptr<T>>` (C++20) or the older `std::atomic_*` free-function overloads.

```cpp
std::shared_ptr<Widget> g;
// Thread A: auto local = g;   // copying a *shared* instance -> needs atomic<shared_ptr> or a lock
// Thread B: g = make_shared<Widget>();
```

The clean summary for an interview: **"The refcount is atomic; the pointee and the shared_ptr variable are not."** Copies of *distinct* `shared_ptr` objects across threads are fine; concurrent writes to *one* `shared_ptr` object, or to the underlying data, need your own synchronization.

### Q18. What does this print, and is it safe?

```cpp
#include <memory>
#include <iostream>
int main() {
    std::weak_ptr<int> w;
    {
        auto s = std::make_shared<int>(42);
        w = s;
        std::cout << (w.lock() ? *w.lock() : -1) << "\n";   // (1)
    }
    std::cout << (w.lock() ? *w.lock() : -1) << "\n";       // (2)
    std::cout << w.expired() << "\n";                        // (3)
}
```

It prints:

```
42
-1
1
```

And it is **safe** — this is exactly what `weak_ptr` is for. At **(1)** the shared object is still alive (`s` owns it, strong count 1), so `w.lock()` returns a valid `shared_ptr` and `*w.lock()` is `42`. When the inner scope ends, `s` is destroyed, the strong count hits 0, and the `int` is freed — but `w`, being a **non-owning** observer, didn't keep it alive. At **(2)** `w.lock()` now returns a **null** `shared_ptr` (the object is gone), so the ternary yields `-1` — no dangling, no UB, because we *checked via `lock()`* instead of dereferencing a raw pointer. At **(3)** `w.expired()` is `true` (prints `1`).

The lesson: **never assume a `weak_ptr`'s object is alive — always `lock()` and test the result** (or check `expired()`, though `lock()` is the race-free way, since the object can't expire between `lock()` succeeding and you using the returned `shared_ptr`). This checked-access pattern is precisely why `weak_ptr` is the safe tool for caches, observers, and cycle-breaking back-references.
## Value Categories & Move Semantics

### Summary

**What this topic covers**

Move semantics is the single feature that most separates a candidate who "writes C++" from one who "understands C++". This topic has 16 questions covering three concern areas: (1) the **value category taxonomy** — how every C++ expression is classified as an lvalue, xvalue, or prvalue, and how those group into the older glvalue/rvalue buckets; (2) the **move machinery** — rvalue references (`&&`), `std::move`, `std::forward`, move constructors and move assignment, `noexcept` move guarantees, and what "moved-from" actually means; and (3) the **elision story** — copy elision, RVO, NRVO, and the C++17 guarantee that turns some "moves" into no-ops entirely. The through-line: C++ lets you distinguish an object you *must not* disturb from one you *may* pillage, and move semantics is how you pillage safely. Get value categories right and everything downstream — overload resolution, forwarding, container performance — falls into place.

**Mental model**

Every expression in C++ has a **type** and a **value category**. The category answers two orthogonal yes/no questions: *does it have identity* (can you take its address / does it name a persistent object)? and *can it be moved from* (is it safe to cannibalise)? The three primary categories are the combinations that make sense: an **lvalue** has identity and can't be moved (a named variable); a **prvalue** has no identity and can be moved (a temporary being born, like `42` or `f()` returning by value); an **xvalue** has identity *and* can be moved (a named object you've explicitly authorised with `std::move`, or a function returning `T&&`). The two composite categories: **glvalue** = has identity (lvalue + xvalue), **rvalue** = movable (prvalue + xvalue). Rvalue references (`T&&`) bind to rvalues and are the overload hook that lets the compiler pick the move path. `std::move` produces nothing at runtime — it's a static_cast to `T&&` that *reclassifies* an lvalue as an xvalue so a move overload becomes viable. The actual stealing happens inside your move constructor.

**Key terms**

- **lvalue** — expression naming a persistent object with identity; can't be implicitly moved. `x`, `arr[0]`, `*ptr`.
- **prvalue** — a "pure" rvalue; a temporary or literal being materialised. `42`, `x + y`, `make_widget()`.
- **xvalue** — an "expiring" glvalue: has identity but is movable. The result of `std::move(x)` or a function returning `T&&`.
- **glvalue** — generalised lvalue = lvalue ∪ xvalue; anything with identity.
- **rvalue** — prvalue ∪ xvalue; anything you're allowed to move from.
- **rvalue reference `T&&`** — binds to rvalues; the overload signal for "you may cannibalise me".
- **`std::move`** — an unconditional cast to `T&&`; moves nothing itself, just enables move overloads.
- **`std::forward<T>`** — a conditional cast that preserves value category in generic code; the tool of perfect forwarding.
- **forwarding (universal) reference** — `T&&` where `T` is a deduced template parameter; binds to *both* lvalues and rvalues.
- **reference collapsing** — the rule `& & → &`, `& && → &`, `&& & → &`, `&& && → &&` that makes forwarding references work.
- **moved-from state** — valid but unspecified; you may destroy or reassign, not assume a value.
- **copy elision / RVO / NRVO** — compiler omits copy/move constructors entirely, constructing directly in the destination.

**Why interviewers ask this**

This is the highest-signal topic in modern C++ interviews. A junior candidate thinks `std::move` "moves the object" and can't tell you what an xvalue is. A senior candidate knows `std::move` is *just a cast*, can explain why a moved-from `std::string` is empty-ish but a moved-from `int` is unchanged, and knows that returning `std::move(local)` is usually a **pessimisation** because it blocks NRVO. Interviewers probe here because move semantics is where correctness (use-after-move bugs, missing `noexcept`), performance (accidental copies, blocked elision), and language-lawyer precision (value categories, reference collapsing) all intersect. Nail the "is `std::move` free?" and "what does `noexcept` on a move constructor buy you?" questions and you signal that you've actually profiled and debugged real C++, not just read about it.

**Common confusions**

- "`std::move` moves the object" — no. It's a `static_cast<T&&>`. Zero runtime effect on its own; it only changes which overload is selected.
- "rvalue reference variables are rvalues" — a *named* rvalue reference is an **lvalue**. `void f(T&& x)` — inside `f`, `x` is an lvalue; you must `std::move(x)` again to move from it.
- "a moved-from object is invalid/destroyed" — it's **valid but unspecified**. Its destructor must run fine; you may assign to it. You just can't assume its value.
- "`const T&&` is useful" — almost never; you can't steal from a const object, so it defeats the purpose.
- "return `std::move(local)` optimises the return" — it usually *blocks* NRVO, forcing a move where you'd have had zero copies.
- "forwarding references and rvalue references look the same, so they're the same" — `T&&` on a deduced template param is a forwarding reference (binds to anything); `T&&` on a concrete type is a plain rvalue reference.

**What follows from this topic**

Move semantics feeds directly into **Classes, Constructors & the Rule of Five/Zero** (the move constructor and move assignment are two of the five special members) and into smart pointers / RAII (a `unique_ptr` *is* a move-only type — it embodies these rules). Perfect forwarding underpins the entire standard library's emplace/factory machinery. If value categories feel fuzzy, resolve them before tackling templates or the memory model — half of overload resolution and all of forwarding depend on categorising expressions correctly.

### Q1. What are the value categories in C++, and how do they relate?

Every expression has a value category answering two questions: does it have **identity** (a nameable, addressable location)? and is it **movable** (safe to cannibalise)?

```
              has identity?
                 yes         no
movable?  no   lvalue        —
          yes  xvalue        prvalue
```

- **lvalue** — identity, not movable: `x`, `*p`, `arr[i]`.
- **prvalue** — no identity, movable: `42`, `a + b`, `make_widget()`.
- **xvalue** — identity *and* movable: `std::move(x)`, a call returning `T&&`.

The composites: **glvalue** = lvalue ∪ xvalue ("has identity"), **rvalue** = xvalue ∪ prvalue ("movable"). Rvalue references bind to rvalues; lvalue references bind to lvalues (const lvalue refs bind to both). The whole point is to let overload resolution route "temporaries you can steal from" to a different code path than "objects you must leave intact".

### Q2. Is `std::move` free? What does it actually do?

`std::move(x)` is a cast — roughly `static_cast<remove_reference_t<decltype(x)>&&>(x)`. It generates **no code**. It moves nothing. It merely reclassifies its argument as an xvalue so that a move constructor / move assignment becomes a viable overload.

The actual work happens later, inside whatever move operation gets selected. If no move overload exists (or the type is trivially copyable, or the target is `const`), you silently get a **copy** instead — `std::move` never fails loudly.

```cpp
std::string a = "hello";
std::string b = std::move(a); // move ctor runs HERE; a is now valid-but-unspecified
std::string c = std::move(b); // fine
```

Naming it `move` was arguably a mistake; think of it as `rvalue_cast`.

### Q3. Explain `std::forward` and perfect forwarding.

`std::forward<T>` is a **conditional** cast: it casts to `T&&` only when `T` was deduced as an rvalue, otherwise it leaves an lvalue as an lvalue. It exists to solve one problem — a function template that must pass its arguments onward *preserving their original value category*.

```cpp
template <class... Args>
Widget make(Args&&... args) {
    return Widget(std::forward<Args>(args)...); // lvalues stay lvalues, rvalues stay rvalues
}
```

Without `forward`, `args` inside `make` is a *named* variable — hence an lvalue — so you'd always copy, even when the caller passed a temporary. `std::forward` restores the "rvalue-ness" that naming the parameter erased. Rule of thumb: **`std::move` an rvalue reference, `std::forward` a forwarding reference.**

### Q4. What is a forwarding (universal) reference, and how does it differ from an rvalue reference?

Syntax is identical — `T&&` — but semantics hinge on whether `T` is being *deduced*:

- **Rvalue reference**: `T&&` where `T` is a concrete type. `void f(Widget&&)`. Binds only to rvalues.
- **Forwarding reference**: `T&&` where `T` is a template parameter deduced at the call site (also `auto&&`). Binds to lvalues *and* rvalues.

```cpp
template <class T> void f(T&& x);   // forwarding reference
void g(Widget&& x);                 // rvalue reference
Widget w;
f(w);            // T = Widget&,  x is Widget&   (lvalue path)
f(Widget{});     // T = Widget,   x is Widget&&  (rvalue path)
g(w);            // ERROR: can't bind rvalue ref to lvalue
```

The magic that makes forwarding references bind to both is **reference collapsing** (Q5). Note the trap: `template<class T> void f(std::vector<T>&&)` is *not* a forwarding reference — `T` isn't deduced directly as the whole parameter type, so it only takes rvalues.

### Q5. What is reference collapsing?

You can't write `& &` in C++, but template substitution and typedefs can *produce* references-to-references. The compiler collapses them with a simple rule: **rvalue only survives if both are rvalue.**

| Combination | Collapses to |
|---|---|
| `T& &` | `T&` |
| `T& &&` | `T&` |
| `T&& &` | `T&` |
| `T&& &&` | `T&&` |

This is exactly why forwarding references work. When you call `f(w)` with an lvalue `w`, `T` deduces to `Widget&`, so the parameter `T&&` becomes `Widget& &&` → collapses to `Widget&`. Pass a temporary and `T` deduces to `Widget`, so `T&&` stays `Widget&&`. One rule, and `T&&` becomes able to bind to anything.

### Q6. Why must a move constructor be `noexcept`, and why do containers care?

`std::vector` gives a **strong exception guarantee** on reallocation (growing): if moving elements to the new buffer could throw partway through, the old buffer might already be corrupted with half-moved-from objects and no way to roll back. So `vector` uses `std::move_if_noexcept`: it will only *move* your elements during reallocation if your move constructor is `noexcept` — otherwise it **copies** them (slower, but rollback-safe).

```cpp
class Buffer {
public:
    Buffer(Buffer&&) noexcept;            // vector will move on growth — fast
    Buffer& operator=(Buffer&&) noexcept;
};
```

Practical impact: forget `noexcept` on your move constructor and a `vector<Buffer>` silently deep-copies every element on every reallocation. This is a classic "why is my code slow?" interview gotcha. Mark move operations `noexcept` unless they genuinely can throw.

### Q7. What state is a moved-from object left in?

**Valid but unspecified.** The standard guarantees only that the object is in a state where its destructor runs correctly and where you can assign a new value to it. You may **not** assume its value.

- A moved-from `std::string` / `std::vector` is *typically* empty, but that's not guaranteed by the standard for all types.
- A moved-from `std::unique_ptr` **is** guaranteed to be `nullptr` (its move semantics are specified precisely).
- A moved-from `int` is unchanged — trivial types don't have a special moved-from state; move = copy for them.

```cpp
std::string s = "data";
std::string t = std::move(s);
std::cout << s.size();  // legal, but value unspecified — don't rely on 0
s = "reuse";            // legal — reassignment is always fine
```

Safe operations on a moved-from object: destroy it, assign to it, or call methods with no preconditions (`clear()`, `size()`). Unsafe: anything assuming a particular value.

### Q8. What does this print, and why?

```cpp
void f(const std::string&) { std::cout << "lvalue\n"; }
void f(std::string&&)      { std::cout << "rvalue\n"; }

void g(std::string&& s) {
    f(s);
    f(std::move(s));
}
int main() { g("hi"); }
```

Output:
```
lvalue
rvalue
```

The trap: inside `g`, `s` is declared as an rvalue reference, but **a named rvalue reference is an lvalue**. So `f(s)` selects the `const std::string&` overload. Only `f(std::move(s))` re-casts it to an xvalue and hits the `&&` overload. This is the single most common move-semantics interview question, and the reason `std::forward`/`std::move` exist: naming a reference erases its value category, so you have to restore it explicitly.

### Q9. Explain copy elision, RVO, and NRVO.

**Copy elision** is the compiler omitting a copy/move constructor call, constructing the object directly in its final location instead.

- **RVO (Return Value Optimization)** — eliding the copy/move when returning a *nameless temporary*: `return Widget{};`. Since **C++17 this is guaranteed** (mandatory copy elision) — the prvalue is materialised directly in the caller's storage; no move constructor need even exist.
- **NRVO (Named Return Value Optimization)** — eliding when returning a *named local*: `Widget w; ...; return w;`. This is **permitted but not guaranteed**, even in C++17/20. Compilers usually do it, but it can be blocked (e.g. returning one of several named objects on different paths).

```cpp
Widget make() {
    Widget w;      // NRVO candidate — optional elision
    return w;
}
Widget make2() {
    return Widget{}; // guaranteed elision since C++17
}
```

The upshot: prefer returning by value and let elision work. Don't fight it.

### Q10. Why is `return std::move(local);` usually wrong?

Because it **disables NRVO**. When you `return local;`, the compiler is allowed to construct `local` directly in the caller's return slot — zero copies, zero moves. When you `return std::move(local);`, the return expression is now an xvalue, not the name of the local, so NRVO no longer applies; the compiler is forced to invoke the **move constructor**. You've turned "nothing" into "one move".

```cpp
Widget good() { Widget w; return w; }             // NRVO: 0 moves
Widget bad()  { Widget w; return std::move(w); }   // forced 1 move, NRVO blocked
```

Compilers (`-Wpessimizing-move` in clang/gcc) will warn on this. The narrow exception: returning a member or a function parameter (which are never NRVO candidates) — there `std::move` on return is correct and necessary.

### Q11. When are move operations actually invoked?

A move (rather than copy) happens when the source expression is an **rvalue** and a viable move overload exists:

- Returning a local by value (via elision, or a move if elision doesn't apply).
- Passing/constructing from a temporary: `v.push_back(make_widget());`.
- Explicitly: `x = std::move(y);`.
- `std::vector` reallocation, *if* the move constructor is `noexcept` (else copy — see Q6).

Moves do **not** happen when: the source is a named lvalue you didn't `std::move`; the type has no move constructor (falls back to copy); the target is `const` (can't modify to steal); or the move constructor isn't `noexcept` and a strong-guarantee container is involved.

### Q12. What are the move constructor and move assignment signatures, and what should they do?

```cpp
class Buffer {
    char* data_; size_t size_;
public:
    Buffer(Buffer&& o) noexcept                 // move ctor
        : data_(o.data_), size_(o.size_) {
        o.data_ = nullptr; o.size_ = 0;         // leave source valid & destructible
    }
    Buffer& operator=(Buffer&& o) noexcept {    // move assignment
        if (this != &o) {
            delete[] data_;                     // release our own resource
            data_ = o.data_; size_ = o.size_;
            o.data_ = nullptr; o.size_ = 0;
        }
        return *this;
    }
};
```

Rules: **steal** the source's resources (pointer copy, not deep copy), **null out** the source so its destructor is harmless, mark both `noexcept`, and in assignment release the current object's resources first and guard self-assignment. If you can express the class in terms of `unique_ptr`/`vector`, follow the **Rule of Zero** and write none of this.

### Q13. Why doesn't `const T&&` make sense as a move parameter?

Moving means *modifying* the source — stealing its pointer, nulling it out. A `const T&&` binds to rvalues but forbids modifying them, so you can't actually steal anything; you'd fall back to a copy. It's almost always pointless.

The one place `const T&&` appears deliberately is as a **deleted** overload to *prevent* dangerous binding — e.g. `std::optional`/`std::ref` delete `const&&` overloads to stop you binding a reference to an expiring temporary:

```cpp
template <class T> const T& max_ref(const T&&) = delete; // ban dangling
```

Otherwise, if you're writing `const T&&`, you almost certainly meant `const T&` or `T&&`.

### Q14. What is a moved-from `unique_ptr` guaranteed to hold?

`nullptr`. Unlike the general "valid but unspecified" rule, `std::unique_ptr`'s move is precisely specified: after `auto p2 = std::move(p1);`, `p1.get() == nullptr`.

```cpp
auto p1 = std::make_unique<int>(42);
auto p2 = std::move(p1);
assert(p1 == nullptr);   // guaranteed
assert(*p2 == 42);
```

This is why `unique_ptr` is the canonical **move-only type** — copying is deleted, moving transfers sole ownership and disarms the source so exactly one destructor frees the resource. It's the cleanest concrete illustration of move semantics: the move constructor does `ptr_ = o.ptr_; o.ptr_ = nullptr;` and nothing else.

### Q15. Given a class with a raw pointer, what happens if you define a destructor but rely on the default move?

Declaring a destructor **suppresses** the implicit generation of the move constructor and move assignment (and deprecates the implicit copy). So a class with a user-declared destructor and no explicit move operations will fall back to the (implicitly still-available but deprecated) **copy** operations — which for a raw pointer is a shallow copy → **double free**.

```cpp
class Bad {
    int* p_;
public:
    explicit Bad(int n) : p_(new int(n)) {}
    ~Bad() { delete p_; }          // suppresses implicit moves
    // no move ops → copies used → double delete on the raw pointer
};
Bad a{1};
Bad b = std::move(a);   // actually COPIES p_ → both delete the same pointer
```

This is the **Rule of Five** in action: declare one of the five, consciously handle all five. Better: hold the resource in a `unique_ptr` and declare nothing (Rule of Zero) — moves are then correct and free.

### Q16. What does `std::move_if_noexcept` do, and when would you use it?

It returns an rvalue reference (enabling a move) **only if** the type's move constructor is `noexcept` *or* the type isn't copyable; otherwise it returns a const lvalue reference (forcing a copy). It's the primitive `std::vector` uses internally to preserve the strong exception guarantee during reallocation.

```cpp
T* dst = ...;
for (auto& elem : old_buffer)
    new (dst++) T(std::move_if_noexcept(elem)); // move if safe, else copy
```

You rarely call it directly — it's mostly relevant to understanding *why* your class's `noexcept`-ness changes container performance (Q6). The takeaway for interviews: it's the mechanism connecting "I forgot `noexcept`" to "my vector suddenly copies instead of moving". Knowing it exists demonstrates you understand the exception-safety/performance tradeoff at the library level, not just the syntax.

## Classes, Constructors & the Rule of Five/Zero

### Summary

**What this topic covers**

How C++ objects come into being, get copied and moved, and are torn down — plus the resource-management discipline that keeps all of that correct. This topic has 16 questions across three concern areas: (1) the **special member functions** — default constructor, copy/move constructors, copy/move assignment, and destructor: when the compiler synthesises them, when it suppresses them, and how to control that with `=default` and `=delete`; (2) the **construction mechanics** — member initialiser lists and their ordering trap, delegating constructors, `explicit`, converting constructors, and the most-vexing-parse; and (3) the **resource rules** — the Rule of Three, Five, and Zero, virtual destructors, `final`, aggregate initialisation, and the copy-and-swap idiom. If move semantics is *how* you transfer resources, this topic is *how you package them into types that own resources correctly*.

**Mental model**

A C++ class has up to six **special member functions** the compiler will write for you: default constructor, destructor, copy constructor, copy assignment, move constructor, move assignment. The compiler's willingness to synthesise each depends on what *you* declare — declaring any of them can suppress others, following rules designed (imperfectly) to prevent silent resource-management bugs. The governing principle is **ownership**: every resource (heap memory, file handle, socket, lock) should be owned by exactly one object whose destructor releases it — this is RAII. The Rule of Five says: if your class manually manages a resource, you need to correctly define all five copy/move/destroy operations, because the compiler-generated shallow versions will double-free or leak. The Rule of Zero says: don't manage resources manually at all — compose your class out of types that already do (`unique_ptr`, `vector`, `string`), declare none of the five, and let the compiler generate correct ones. Modern C++ strongly prefers Rule of Zero; Rule of Five is for the rare type that *is* the resource wrapper.

**Key terms**

- **Special member functions** — the six the compiler may generate: default ctor, destructor, copy ctor, copy assignment, move ctor, move assignment.
- **Rule of Three** — pre-C++11: if you define any of destructor/copy ctor/copy assignment, define all three.
- **Rule of Five** — C++11+: extends Rule of Three to include the move constructor and move assignment.
- **Rule of Zero** — design so you declare *none* of the five; delegate ownership to RAII members.
- **`=default`** — ask the compiler for the standard implementation explicitly.
- **`=delete`** — forbid a function; calling it is a compile error (used to ban copies, unwanted conversions).
- **Member initialiser list** — `: a_(x), b_(y)` — initialises members before the constructor body; the only way to init `const`/reference/no-default members.
- **Initialisation order** — members initialise in **declaration order**, never in initialiser-list order.
- **Delegating constructor** — one constructor calls another via the init list to share setup.
- **`explicit`** — blocks implicit conversions / copy-initialisation through a constructor (or conversion operator).
- **Virtual destructor** — required in a polymorphic base so `delete base_ptr` runs the derived destructor.
- **Copy-and-swap** — implement assignment via copy + `swap` for strong exception safety and one code path.

**Why interviewers ask this**

This topic is where "can you write a class that doesn't leak or double-free?" gets tested — the bread and butter of C++ ownership. A junior candidate writes a class with a raw `new` in the constructor and a `delete` in the destructor, and can't tell you it now double-frees on copy. A senior candidate knows the Rule of Five, reaches for Rule of Zero first, knows *why* declaring a destructor suppresses the move operations, and can spot a missing virtual destructor in a base class instantly. Interviewers also use `explicit`, member init order, and the most-vexing-parse as precision tests — small things that reveal whether you've been bitten by real C++ or only read tutorials. The virtual-destructor question in particular is a near-universal filter: get it wrong and you've shipped UB in any polymorphic hierarchy.

**Common confusions**

- "The compiler always gives me copy and move" — declaring a destructor (or a copy op) **suppresses** the implicit move operations; declaring a move op deletes the implicit copies.
- "Members initialise in the order I list them" — no, they initialise in **declaration order** in the class; the init-list order is irrelevant (and misleading if it disagrees).
- "`explicit` only matters for single-argument constructors" — since C++11 it also matters for multi-arg constructors (brace conversions) and for conversion operators.
- "A base class destructor doesn't need to be virtual if I don't add data" — if you ever `delete` through a base pointer, it must be virtual, full stop; otherwise UB.
- "`=default` and an empty `{}` body are the same" — they are not; `=default` can keep a type trivial/aggregate and can be more efficient, and an empty user-provided body counts as user-provided (affecting triviality).
- "`Widget w();` declares a Widget" — it declares a *function* returning `Widget` (the most-vexing-parse).

**What follows from this topic**

This topic sits directly on top of **Value Categories & Move Semantics** (the move constructor and move assignment are defined there; here we package them). It leads straight into RAII and smart pointers — `unique_ptr`/`shared_ptr` are the Rule-of-Zero members that let you avoid writing the Rule of Five at all — and into polymorphism and inheritance, where virtual destructors and `final` live. Const correctness (the next topic) governs which of these members can be called on `const` objects. Master this and you can design types that own resources safely without thinking about it — the definition of idiomatic modern C++.

### Q1. What are the special member functions, and when does the compiler generate each?

Six functions the compiler may synthesise:

| Member | Generated by default when... |
|---|---|
| Default constructor | no other constructor is user-declared |
| Destructor | always (unless user-declared) |
| Copy constructor | no move op and no user-declared copy/destructor (deprecated if any are) |
| Copy assignment | same conditions as copy ctor |
| Move constructor | no user-declared copy op, move op, or destructor |
| Move assignment | same conditions as move ctor |

The key interaction: **declaring a destructor or any copy operation suppresses the implicit moves**; **declaring any move operation deletes the implicit copies**. This is why a class with a hand-written destructor silently reverts to copying where you expected moves. The clean escape is the Rule of Zero (declare nothing) or the Rule of Five (declare all five deliberately).

### Q2. State the Rule of Three, Five, and Zero.

- **Rule of Three** (C++98): if you need to define any one of **destructor**, **copy constructor**, or **copy assignment**, you almost certainly need all three — because they all point to the same underlying resource management.
- **Rule of Five** (C++11): add the **move constructor** and **move assignment**. If you're hand-managing a resource, define all five for correctness and performance.
- **Rule of Zero**: design classes so they **don't** manually manage resources — hold `unique_ptr`, `vector`, `string`, etc. — and declare *none* of the five. The compiler generates correct copy/move/destroy for free.

Modern guidance: **reach for Rule of Zero by default.** Rule of Five is for the rare low-level type that genuinely *is* a resource wrapper (and even then, prefer wrapping the raw handle in a `unique_ptr` with a custom deleter).

### Q3. Why should a base class with virtual functions have a virtual destructor?

Because `delete`-ing a derived object through a base pointer with a **non-virtual** destructor is **undefined behaviour** — typically only the base destructor runs, leaking the derived part (and skipping its resource release).

```cpp
struct Base { virtual void f(); ~Base(); };          // NON-virtual dtor — bug
struct Derived : Base { std::vector<int> big; };
Base* p = new Derived;
delete p;    // UB: Derived::~Derived never runs, `big` leaks
```

Fix: `virtual ~Base() = default;`. Rule of thumb: **if a class has any virtual function, give it a virtual destructor.** The exception is a base intended only for non-polymorphic use (never deleted through a base pointer) — then a *protected non-virtual* destructor documents and enforces that intent.

### Q4. Explain member initialiser lists and their ordering rule.

The initialiser list (`: a_(x), b_(y)`) initialises members **before** the constructor body runs. It's the *only* way to initialise `const` members, reference members, base classes, and members lacking a default constructor. Using it also avoids the "default-construct then assign" double work of assigning in the body.

The trap: **members are initialised in the order they are declared in the class**, not the order they appear in the init list. If the two disagree, you can read an uninitialised member:

```cpp
struct S {
    int a_;
    int b_;
    S(int x) : b_(x), a_(b_) {}   // a_ initialised FIRST (declared first) using b_
};                                //  → a_ reads b_ before b_ is set: garbage
```

Compile with `-Wreorder` to catch this. Always order the init list to match declaration order.

### Q5. What is `explicit`, and why does it matter?

`explicit` prevents a constructor (or conversion operator) from being used for **implicit** conversions and copy-initialisation. Without it, a single-argument constructor defines a silent conversion path that can produce surprising overload resolution and accidental temporaries.

```cpp
struct Meters {
    explicit Meters(double d);
};
void draw(Meters);
draw(5.0);          // ERROR with explicit — good, 5.0 isn't obviously meters
draw(Meters{5.0});  // OK — intent is clear
```

Guidance: make single-argument constructors `explicit` **by default**, unless the implicit conversion is genuinely desirable (e.g. `std::string` from `const char*`). Since C++11, `explicit` also governs multi-argument constructors invoked via braces, and conversion operators (`explicit operator bool()` — as in `std::optional`, usable in `if` but not implicitly convertible to `int`).

### Q6. What is the most-vexing-parse?

Any syntax that *could* be parsed as a function declaration **is** parsed as one. The classic bite:

```cpp
Widget w();          // NOT a default-constructed Widget —
                     // it's a declaration of a function `w` returning Widget!
std::string s(std::istream_iterator<char>(file),   // declares a function, not a string
              std::istream_iterator<char>());
```

`Widget w();` declares a function taking no args returning `Widget`, so `w.foo()` fails to compile mysteriously. Fixes:

```cpp
Widget w;      // default construction, no parens
Widget w{};    // brace init — unambiguous, preferred in modern C++
```

Brace initialisation (`{}`) sidesteps the whole problem because it can't be parsed as a function declaration. This is one of the strongest arguments for preferring `{}` initialisation.

### Q7. When do you use `=default` versus `=delete`?

- **`=default`** — explicitly request the compiler's standard implementation. Use it to (a) re-enable a special member that your other declarations suppressed, (b) document intent, or (c) keep a type trivial/aggregate while still declaring the member. `Widget(const Widget&) = default;`
- **`=delete`** — forbid a function entirely; any use is a compile error. Use it to make a type non-copyable (`Widget(const Widget&) = delete;`), to ban unwanted conversions, or to block specific overloads.

```cpp
struct NonCopyable {
    NonCopyable() = default;
    NonCopyable(const NonCopyable&) = delete;             // ban copy
    NonCopyable& operator=(const NonCopyable&) = delete;
    NonCopyable(NonCopyable&&) = default;                 // but allow move
};

void f(int);
void f(double) = delete;   // f(3.14) is now a hard error
```

`=default` is generally preferable to an empty `{}` body because it can preserve triviality and lets the compiler optimise better.

### Q8. What is the copy-and-swap idiom, and what does it buy you?

Implement copy assignment by **copying** the argument (by value) and then **swapping** with the copy. It gives you strong exception safety and unifies copy and move assignment into one function.

```cpp
class Buffer {
    char* data_; size_t n_;
    friend void swap(Buffer& a, Buffer& b) noexcept {
        using std::swap;
        swap(a.data_, b.data_);
        swap(a.n_, b.n_);
    }
public:
    Buffer(const Buffer&);                 // copy ctor
    Buffer(Buffer&&) noexcept;             // move ctor
    Buffer& operator=(Buffer other) {      // by VALUE — handles copy & move
        swap(*this, other);
        return *this;
    }
};
```

Benefits: (1) **strong exception guarantee** — all the throwing work (the copy) happens *before* you touch `*this`; if it throws, `*this` is untouched. (2) **self-assignment safe** for free. (3) **one function** serves both copy and move assignment (the by-value parameter is copy-constructed or move-constructed by the caller). Cost: sometimes an extra move vs a hand-tuned assignment — usually irrelevant.

### Q9. What is a delegating constructor?

A constructor that calls another constructor of the *same* class in its initialiser list, to avoid duplicating setup logic. Introduced in C++11.

```cpp
class Widget {
    int w_, h_;
    void validate();
public:
    Widget(int w, int h) : w_(w), h_(h) { validate(); }
    Widget() : Widget(100, 100) {}          // delegates to the two-arg ctor
    explicit Widget(int square) : Widget(square, square) {} // delegates too
};
```

Rules: the delegating call must be the **only** thing in the init list (you can't also initialise members directly in that same constructor). The target constructor fully runs first, then the delegating constructor's body. It's the DRY tool for constructors — one canonical constructor does the real work, the others funnel into it.

### Q10. Spot the bug.

```cpp
class Handle {
    int* p_;
public:
    Handle() : p_(new int(0)) {}
    ~Handle() { delete p_; }
};
Handle a;
Handle b = a;   // ???
```

**Double free.** `Handle` declares a destructor but no copy operations, so the compiler generates a **shallow** copy constructor: `b.p_ = a.p_`. Now `a` and `b` hold the *same* pointer; when both destruct, `delete p_` runs twice on one allocation — UB (heap corruption, likely crash).

This is the Rule of Three/Five violation. Fixes, best to worst:
1. **Rule of Zero:** `std::unique_ptr<int> p_;` — copy is then correctly deleted, move works, no destructor needed.
2. **Rule of Five:** define copy ctor (deep copy), copy assignment, move ctor, move assignment, destructor.
3. **Ban copying:** `Handle(const Handle&) = delete;` if copies make no sense.

### Q11. What is aggregate initialisation?

An **aggregate** (a class/struct with no user-declared constructors, no private/protected non-static data members, no virtual functions, no base classes — rules loosened slightly across standards) can be initialised directly from a brace list, member-by-member, with no constructor:

```cpp
struct Point { int x; int y; };
Point p{3, 4};            // aggregate init: x=3, y=4
Point q{3};               // x=3, y=0 (value-initialised)
Point arr[] = {{1,2}, {3,4}};

struct Named { std::string id; int n = 0; };  // C++14: default member init allowed
Named w{.id = "a", .n = 5};   // C++20 designated initialisers
```

Aggregates get no encapsulation but are cheap, trivially copyable, and support designated initialisers (C++20). Adding a user-declared constructor (even `=default`? — no, `=default` is fine; a *user-provided* one) or a private data member makes it a non-aggregate, and the brace init then routes to a constructor instead.

### Q12. Why does declaring a move constructor delete the implicit copy operations?

Because the compiler treats "you've taken control of move" as a signal that the class's resource semantics are non-trivial, and a naive default copy would likely be wrong. Once you declare *any* move operation, the implicit **copy constructor and copy assignment are deleted** (not merely suppressed — actively deleted).

```cpp
struct M {
    M() = default;
    M(M&&) noexcept = default;   // declaring this...
    // ...deletes the copy ctor and copy assignment implicitly
};
M a, b;
M c = std::move(a);   // OK
M d = b;              // ERROR: copy constructor is deleted
```

If you *want* both copy and move, declare both explicitly (`= default` each). This asymmetry — declaring moves deletes copies, but declaring a destructor only *deprecates*/suppresses moves — is a common interview trap. The safe rule remains: declare zero, or declare all five.

### Q13. What is the difference between a converting constructor and an `explicit` one?

A **converting constructor** is a non-`explicit` constructor callable with a single argument (or all-but-one defaulted); it defines an implicit conversion *to* the class type:

```cpp
struct Celsius {
    Celsius(double d);            // converting: double → Celsius implicitly
};
void report(Celsius);
report(36.6);                     // OK — implicit conversion happens

struct Kelvin {
    explicit Kelvin(double d);    // explicit: no implicit conversion
};
void report2(Kelvin);
report2(310.0);                   // ERROR
report2(Kelvin{310.0});           // OK — explicit
```

Converting constructors are convenient but a frequent source of surprising overload resolution and silent bugs (a stray `double` becomes a `Celsius`). The guidance: make constructors `explicit` unless the implicit conversion is genuinely part of the type's intended interface (as with `std::string` from string literals).

### Q14. In what order are base classes and members destroyed?

**Reverse of construction order.** Construction: base classes first (in declaration order of the base list), then members (in declaration order in the class), then the constructor body. Destruction runs exactly the reverse: constructor... er, destructor body first, then members in **reverse** declaration order, then base classes in reverse.

```cpp
struct A { ~A(){ log("~A"); } };
struct B { ~B(){ log("~B"); } };
struct D : A {
    B b_;
    ~D(){ log("~D body"); }
};
// Destroying a D logs: "~D body", then "~B" (member), then "~A" (base)
```

This guarantees a member/base is always fully constructed before anything depending on it, and torn down only after its dependents. It's why you must never call a virtual function that reaches derived state from a base destructor — the derived part is already gone.

### Q15. What does `final` do on a class or virtual function?

`final` marks a class as **non-inheritable** or a virtual function as **non-overridable**:

```cpp
struct Base { virtual void f(); };
struct Derived final : Base {        // no class may inherit from Derived
    void f() final;                  // no further override of f() allowed
};
struct Nope : Derived {};            // ERROR: Derived is final
```

Two uses: (1) **design intent / safety** — prevent unintended subclassing or overriding. (2) **devirtualisation optimisation** — when the compiler knows a call is on a `final` type or function, it can resolve the virtual call statically and inline it, removing the vtable indirection. Use `final` when a class truly isn't designed for further extension; don't sprinkle it everywhere, as it closes off legitimate extension points.

### Q16. When would you `=delete` the copy operations but `=default` the move operations?

For a **move-only type** — one that models unique ownership of a resource that can't or shouldn't be duplicated:

```cpp
class FileHandle {
    int fd_ = -1;
public:
    explicit FileHandle(const char* path);
    ~FileHandle();
    FileHandle(const FileHandle&)            = delete;   // can't duplicate an fd
    FileHandle& operator=(const FileHandle&) = delete;
    FileHandle(FileHandle&&) noexcept;                    // transfer ownership
    FileHandle& operator=(FileHandle&&) noexcept;
};
```

This is exactly the shape of `std::unique_ptr`, `std::thread`, `std::fstream`, and `std::future` — resources with a single logical owner where copying is meaningless or dangerous but transfer is fine. Deleting the copies makes accidental duplication a compile error; defaulting/defining the moves keeps the type usable in containers and returnable from factories. It's the canonical answer to "how do I make a non-copyable but movable type?"

## Const Correctness & the Type System

### Summary

**What this topic covers**

The parts of C++'s type system a working engineer must reason about daily: const correctness, the four named casts, conversions, and compile-time type queries. This topic has 14 questions across three concern areas: (1) **const correctness** — `const` member functions, `mutable`, top-level vs low-level const, `const_cast` and its dangers, and `constexpr` vs `const`; (2) **the casting family** — why C-style casts are dangerous and how `static_cast`, `dynamic_cast`, `reinterpret_cast`, and `const_cast` differ, plus what `volatile` really means; and (3) **conversions and deduction** — narrowing, integer promotions and implicit conversions, `enum` vs `enum class`, `decltype`, `using`/typedef, and the type-deduction pitfalls that bite in generic code. The unifying idea: C++'s type system encodes *contracts* (this won't be modified, this conversion is intentional, this runs at compile time), and const correctness is the most pervasive of those contracts.

**Mental model**

Think of `const` as a **promise about who may modify what, verified by the compiler**. It's part of the type: `int`, `const int`, and `int* const` are distinct types with distinct rules. The crucial distinction is **top-level** const (the object itself is const — `int* const p`, you can't repoint `p`) versus **low-level** const (what it points *to* is const — `const int* p`, you can't modify `*p`). A `const` member function promises not to modify the object's observable state; the compiler enforces it by making `this` a pointer-to-const inside that function. `mutable` punches a hole for genuinely non-observable state (caches, mutexes). Casts are the escape hatches, ordered by danger: `static_cast` for sane, related-type conversions the compiler can check; `dynamic_cast` for safe downcasting in polymorphic hierarchies (runtime-checked); `const_cast` to add/remove const (removing it and then writing is UB if the object was truly const); `reinterpret_cast` for "trust me, reinterpret these bits" (almost always platform-specific or UB-adjacent). `constexpr` is a stronger, orthogonal promise: *computable at compile time*.

**Key terms**

- **const correctness** — designing interfaces so `const` accurately marks what won't be modified; the compiler then enforces it.
- **const member function** — `T f() const;` — promises not to modify the object; `this` becomes `const T*`.
- **`mutable`** — allows a specific member to be modified even inside a const member function (for non-observable state).
- **top-level const** — the object itself is const (`int* const`, `const int x`).
- **low-level const** — the pointee/referent is const (`const int*`).
- **`const_cast`** — the only cast that can add/remove const/volatile; removing-then-writing a truly-const object is UB.
- **`static_cast`** — compile-time-checked conversion between related types (numeric, up/down-cast without runtime check, `void*`→`T*`).
- **`dynamic_cast`** — runtime-checked cross/down cast in polymorphic hierarchies; returns `nullptr` (pointer) or throws (reference) on failure.
- **`reinterpret_cast`** — reinterpret the bit pattern; no value conversion; almost always implementation-defined or UB if misused.
- **`constexpr`** — usable in constant expressions / evaluated at compile time; stronger than `const`.
- **`volatile`** — every access is a real memory access; for memory-mapped IO / signal handlers, **not** a threading tool.
- **`enum class`** — scoped, strongly-typed enumeration; no implicit int conversion, no name leakage.
- **`decltype`** — yields the declared type of an expression, preserving references and const.

**Why interviewers ask this**

Const correctness is the clearest signal of whether a candidate has worked on a real C++ codebase. Junior candidates sprinkle or omit `const` randomly; senior candidates use it as a design tool and can explain top-level vs low-level const without pausing. The casting questions are a precision and safety filter: knowing *when* `dynamic_cast` returns null vs throws, why `reinterpret_cast` between unrelated pointer types then dereferencing is UB (strict aliasing), and why `const_cast`-ing away const to write is only safe if the underlying object wasn't const — these separate people who reason about UB from people who cargo-cult casts. `enum class` vs plain `enum`, narrowing, and `decltype` are modern-C++ literacy checks. Interviewers care because getting const and casts wrong produces the exact bugs — silent aliasing, UB, accidental copies — that are hardest to debug in production.

**Common confusions**

- "`const` and `constexpr` are the same" — `const` means "won't change after init" (possibly at runtime); `constexpr` means "computable at compile time" and implies const.
- "A const member function can't change anything" — it can change `mutable` members and anything reachable through a pointer *member* that is itself only top-level const.
- "`const_cast` lets me safely modify a const object" — removing const is legal; **writing** through it is UB *if the original object was declared const*. It's for interfacing with const-incorrect legacy APIs.
- "`static_cast` and `reinterpret_cast` are interchangeable for pointers" — `static_cast` adjusts pointers correctly within a hierarchy; `reinterpret_cast` just reinterprets bits and usually breaks strict aliasing.
- "`volatile` makes variables thread-safe" — it does not. It prevents the compiler from eliding/reordering *accesses to that variable* but gives no atomicity or cross-thread ordering. Use `std::atomic`.
- "`enum` and `enum class` are basically the same" — plain `enum` leaks names into the enclosing scope and implicitly converts to int; `enum class` does neither.

**What follows from this topic**

Const correctness threads through every other topic: `const` member functions define which methods are callable on the `const` objects returned by many APIs; the copy constructor takes `const T&`; RAII wrappers expose const and non-const accessors. The casting family connects to polymorphism (`dynamic_cast`) and to the memory model / low-level code (`reinterpret_cast`, `volatile`, strict aliasing). `constexpr` opens onto compile-time programming (templates, `consteval`, `constinit`). If const correctness is shaky, retrofit it early — it's far cheaper to design const-correct interfaces up front than to bolt `const` on later, when one missing `const` cascades through an entire call graph.

### Q1. What is const correctness, and why does it matter?

Const correctness means marking every interface — parameters, return types, member functions, pointers — with `const` wherever a thing genuinely won't be (or shouldn't be) modified, and letting the compiler enforce those promises.

```cpp
class Account {
    double balance_;
public:
    double balance() const { return balance_; }   // read-only: const member fn
    void deposit(double amt) { balance_ += amt; }  // mutating: non-const
};
void print(const Account& a) { a.balance(); }      // can only call const members
```

It matters for three reasons: (1) **it documents intent** in a compiler-checked way — a `const&` parameter tells the reader and the compiler "I won't touch this". (2) **It catches bugs** — accidental modification becomes a compile error. (3) **It's viral in a good way** — const-correct code composes; a single missing `const` deep in a call chain can force ugly `const_cast`es everywhere. Design const-correct from the start; retrofitting is painful.

### Q2. What is the difference between top-level and low-level const?

**Top-level** const qualifies the object itself; **low-level** const qualifies what a pointer/reference refers to.

```cpp
int x = 0;
const int ci = 42;        // top-level const on ci
int* const p = &x;        // TOP-level: p can't be repointed, *p can change
const int* q = &ci;       // LOW-level: *q can't change, q can be repointed
const int* const r = &ci; // both
```

The distinction matters for conversions and templates: top-level const is **ignored** when copying (`int y = ci;` is fine — copying a const int into a non-const one) and is **dropped during template type deduction** for by-value parameters, whereas low-level const must be preserved (you can't bind `const int*` to `int*`). This is exactly the source of many "why won't my template deduce the const?" surprises.

### Q3. What does `mutable` do?

`mutable` allows a specific data member to be modified **even inside a `const` member function** (and even on a `const` object). It's for state that isn't part of the object's *logical, observable* value — caches, memoisation, lazy-computed fields, and synchronisation primitives.

```cpp
class Lookup {
    mutable std::mutex m_;
    mutable std::optional<int> cached_;
    int compute() const;
public:
    int value() const {                 // logically const...
        std::lock_guard lk(m_);         // ...but locks a mutex (mutable)
        if (!cached_) cached_ = compute();
        return *cached_;                // ...and populates a cache (mutable)
    }
};
```

Without `mutable`, locking `m_` or writing `cached_` inside a `const` function wouldn't compile. The discipline: `mutable` is for **bitwise-non-const but logically-const** state. Abusing it to modify observable state defeats const correctness and misleads callers.

### Q4. Explain `const_cast` and when it's dangerous.

`const_cast` is the only cast that can add or remove `const`/`volatile`. Its legitimate use is narrow: calling a **const-incorrect legacy/C API** that takes `char*` but won't actually modify the data.

```cpp
void legacy_print(char* s);          // old API, doesn't modify s
void show(const std::string& s) {
    legacy_print(const_cast<char*>(s.c_str()));  // OK if legacy_print truly doesn't write
}
```

The **UB trap**: casting away const and then *writing* is undefined behaviour **if the underlying object was originally declared `const`**.

```cpp
const int x = 10;
int* p = const_cast<int*>(&x);
*p = 20;                    // UB — x was truly const; compiler may have inlined 10
```

If the object was *not* originally const (you just received a `const&` to a mutable object), writing after `const_cast` is technically legal but a serious code smell. Rule: `const_cast` to *read*/*pass* through const-incorrect APIs, essentially never to *write*.

### Q5. What is the difference between `const` and `constexpr`?

- **`const`** — "this won't be modified after initialisation." The value may still be computed at **runtime**. It's about *immutability*.
- **`constexpr`** — "this can be evaluated at **compile time**" and can be used in constant expressions (array sizes, template args, `case` labels). It's about *when computation happens*. A `constexpr` variable is implicitly `const`.

```cpp
const int a = std::rand();      // OK — runtime value, just immutable
constexpr int b = 5 * 5;        // compile-time constant
// constexpr int c = std::rand(); // ERROR — not a constant expression

constexpr int square(int n) { return n * n; } // usable at compile OR runtime
int arr[square(4)];             // compile-time: array of 16
```

A `constexpr` function *may* run at runtime too (if called with runtime args). C++20 adds `consteval` ("**must** be compile-time") and `constinit` ("compile-time initialised, but mutable"). Prefer `constexpr` for true constants — it enables compile-time evaluation and stronger guarantees than `const`.

### Q6. Compare the four named casts.

| Cast | Purpose | Checked? |
|---|---|---|
| `static_cast<T>` | Related-type conversions: numeric, up/down-cast (no runtime check), `void*`→`T*`, explicit ctors | Compile time |
| `dynamic_cast<T>` | Safe down/cross-cast in **polymorphic** hierarchies | **Runtime** (RTTI) |
| `const_cast<T>` | Add/remove `const`/`volatile` only | None |
| `reinterpret_cast<T>` | Reinterpret bit pattern between unrelated types | None — you're on your own |

```cpp
double d = static_cast<double>(3);           // numeric
Derived* dp = dynamic_cast<Derived*>(bp);    // nullptr if bp isn't a Derived
char* c = const_cast<char*>(cstr);           // strip const for legacy API
auto n = reinterpret_cast<std::uintptr_t>(ptr); // pointer→integer, impl-defined
```

Prefer the **most restrictive** cast that works. C-style casts (Q7) are dangerous precisely because they try each of these in turn silently. Named casts are greppable, express intent, and refuse to do more than you asked.

### Q7. Why avoid C-style casts?

A C-style cast `(T)expr` silently attempts, in order, `const_cast`, `static_cast`, `static_cast`+`const_cast`, `reinterpret_cast`, then `reinterpret_cast`+`const_cast` — and picks the first that compiles. So a cast you *think* is a safe numeric conversion can silently become a `reinterpret_cast` that reinterprets bits and invokes UB, with no warning.

```cpp
Base* b = ...;
Derived* d = (Derived*)b;   // looks innocent; is an UNCHECKED downcast (reinterpret-ish)
                            // no runtime check like dynamic_cast, no diagnostic
```

Problems: (1) **hides intent** — the reader can't tell if you meant a numeric conversion or a bit reinterpretation. (2) **too powerful** — it can strip const *and* reinterpret in one go. (3) **ungreppable** — you can't search the codebase for risky casts. Named casts fix all three: they're explicit, minimal, and searchable. Use them; enable `-Wold-style-cast` to flag C-style casts in C++ code.

### Q8. What does this print, and is it safe?

```cpp
struct Base { virtual ~Base() = default; };
struct Derived : Base { int x = 7; };

Base* b = new Base;
Derived* d = dynamic_cast<Derived*>(b);
std::cout << (d ? d->x : -1) << "\n";
```

Prints `-1`, and it's **safe**. `b` actually points to a `Base`, not a `Derived`. `dynamic_cast` does a **runtime check** using RTTI: since the object isn't a `Derived`, the pointer cast returns `nullptr`, so `d` is null and we print `-1`.

Key contrasts:
- If we'd used `static_cast<Derived*>(b)` instead, `d` would be a **non-null but invalid** pointer, and `d->x` would be UB (reading `Derived::x` off a `Base` object).
- `dynamic_cast` on a **reference** (`dynamic_cast<Derived&>(*b)`) throws `std::bad_cast` on failure instead of returning null.
- `dynamic_cast` requires the type to be **polymorphic** (at least one virtual function — here the virtual destructor); otherwise it won't compile.

### Q9. What is `volatile`, and what does it *not* do?

`volatile` tells the compiler that every read and write of that object is an **observable side effect** that must actually happen and must not be reordered or elided relative to other volatile accesses. Its real uses are **memory-mapped hardware registers**, **signal handlers** (`volatile sig_atomic_t`), and `setjmp`/`longjmp` locals.

```cpp
volatile uint32_t* status_reg = reinterpret_cast<uint32_t*>(0x4000'0000);
while (!(*status_reg & READY_BIT)) { }   // compiler MUST re-read each iteration
```

What it does **not** provide: **atomicity**, **cross-thread memory ordering**, or any synchronisation. A `volatile int` shared between threads is still a data race → UB. `volatile` predates the C++11 memory model and is orthogonal to it. For concurrency, use `std::atomic`. Confusing `volatile` with a threading primitive (a habit borrowed from older Java/C#) is a classic interview red flag.

### Q10. What is the difference between `enum` and `enum class`?

**Plain `enum`** leaks its enumerators into the enclosing scope and implicitly converts to integers. **`enum class`** (scoped enum, C++11) does neither — enumerators are scoped to the enum name and there's no implicit int conversion.

```cpp
enum Color { Red, Green, Blue };          // Red leaks into surrounding scope
enum class Fruit { Apple, Banana };       // must write Fruit::Apple

int n = Green;                            // OK — implicit conversion (often unwanted)
// int m = Fruit::Banana;                 // ERROR — no implicit conversion (good)
int m = static_cast<int>(Fruit::Banana);  // explicit if you really want it
```

`enum class` benefits: no name collisions (two enums can both have `None`), no accidental arithmetic/comparison across enum types, and you can specify the underlying type (`enum class Status : uint8_t {...}`). Prefer `enum class` by default; reach for plain `enum` only for bit-flag interop or when implicit int conversion is genuinely wanted.

### Q11. What are integer promotions and implicit conversions, and where do they bite?

Small integer types (`char`, `short`, `bool`, unscoped `enum`) are **promoted** to `int` in arithmetic ("integral promotion"), and mixed-type operations apply the **usual arithmetic conversions** (which can convert to `unsigned` unexpectedly). The classic bite is **signed/unsigned mixing**:

```cpp
unsigned u = 1;
int i = -1;
if (i < u) std::cout << "less\n"; else std::cout << "not less\n";
// prints "not less": i converts to a huge unsigned value (4294967295 > 1)

std::vector<int> v;
for (int k = 0; k < v.size() - 1; ++k) { ... }
// v.size() is unsigned; if v is empty, 0u - 1 == 4294967295 → loop runs, UB on access
```

Other traps: narrowing on assignment (`char c = 300;`), `bool`→`int` (`true` becomes `1`), and float↔int truncation. Compile with `-Wsign-conversion -Wconversion` to surface these. In interviews, the empty-container `size() - 1` unsigned-wraparound bug is a favourite.

### Q12. What is narrowing, and how does brace initialisation help?

A **narrowing conversion** loses information — a larger type to a smaller one, float to int, or a value that can't be represented in the target type. Ordinary (`=`, parentheses) initialisation allows it silently; **brace initialisation `{}` forbids it** (a compile error, or at least a warning).

```cpp
int x = 3.9;        // OK, silently truncates to 3
int y(3.9);         // OK, silently truncates to 3
int z{3.9};         // ERROR — narrowing double→int is ill-formed in braces
char c{300};        // ERROR — 300 doesn't fit in char (if char is 8-bit signed)
int ok{3};          // fine — no information loss
```

This is a major reason to prefer brace initialisation for scalars: it turns silent, bug-prone truncations into compile errors. It also sidesteps the most-vexing-parse. The caveat: `{}` prefers `std::initializer_list` constructors when one exists (`std::vector<int>{3, 0}` is `{3, 0}`, not size-3), so brace-init has its own gotcha for container sizing.

### Q13. What is `decltype`, and how does it differ from `auto`?

`decltype(expr)` yields the **declared type** of an expression, preserving `const` and reference-ness exactly; `auto` deduces a type the way a by-value function parameter would, **stripping** references and top-level const.

```cpp
int i = 0;
const int& r = i;

auto a = r;            // int          — auto drops const and reference
decltype(r) b = i;     // const int&   — decltype preserves them exactly

decltype(i) x;         // int
decltype((i)) y = i;   // int&  — note: (i) is an lvalue expression, so ref!
```

The `decltype((i))` vs `decltype(i)` distinction is a favourite gotcha: a bare name gives the declared type; a *parenthesised* lvalue expression gives an lvalue reference. `decltype` shines in generic code and trailing return types (`decltype(auto)` in C++14 deduces using `decltype` rules, preserving references — useful for perfect-forwarding return values). Use `auto` for locals where you want a value copy; `decltype`/`decltype(auto)` when you must preserve the exact type including references.

### Q14. When would you use `using` versus `typedef`, and what's the deduction pitfall?

`using` (C++11 alias declaration) and `typedef` both create type aliases, but `using` reads left-to-right, is clearer for function-pointer/complex types, and — crucially — **supports templates** (`typedef` cannot be templated):

```cpp
typedef std::map<int, std::string> Map1;         // old
using Map2 = std::map<int, std::string>;          // preferred, reads naturally

typedef void (*Handler1)(int, int);               // hard to read
using Handler2 = void(*)(int, int);               // clearer

template <class T>                                 // IMPOSSIBLE with typedef
using Vec = std::vector<T>;                         // alias template
Vec<int> v;
```

Prefer `using` everywhere in modern C++. The related deduction pitfall: aliases are transparent to the type system — `using Vec = std::vector<T>` doesn't create a *new* distinct type (unlike `enum class` or a wrapping struct), so it provides no extra type safety, only readability. If you want a genuinely distinct type (e.g. a `UserId` that can't be mixed with an `OrderId`), you need a wrapper struct (a "strong typedef"), not an alias.
## Templates & Generic Programming

### Summary

**What this topic covers**

Templates are C++'s compile-time generic programming mechanism — the machinery behind the STL, most modern library design, and a large slice of what separates "writes C++" from "understands C++". Three concern areas live here: (1) the **template forms** — function templates, class templates, alias templates, variable templates, and how the compiler *instantiates* concrete code from them on demand; (2) the **deduction and specialisation rules** — template argument deduction, explicit and partial specialisation, non-type template parameters, default template arguments, and the two-phase name lookup that trips up everyone porting between compilers; and (3) the **idioms and hazards** — variadic templates and parameter packs, fold expressions (C++17), CRTP, SFINAE, `if constexpr`, dependent names with their `typename`/`template` disambiguators, the header-only requirement, and template code bloat. The 18 questions here move from "what is a template" up to genuine senior gotchas. Concepts (C++20) formalise much of the constraint machinery and get their own treatment in a later topic — here we cover the pre-concepts foundation SFINAE lives on.

**Mental model**

A template is not code — it is a *recipe for generating code*. The compiler does nothing with `template<class T> T max(T a, T b)` until you actually *use* it with a concrete `T`; at that point it *instantiates* a specific function, type-checks it against that `T`, and emits it. This is why templates are duck-typed at compile time: `T` only needs to support the operations the body actually performs, and errors surface at the instantiation site, often as a wall of text. Two consequences follow directly. First, the full definition must be visible wherever it's instantiated — hence templates live in headers, not `.cpp` files. Second, name lookup happens in **two phases**: non-dependent names are resolved when the template is *defined*, dependent names (those that depend on `T`) when it's *instantiated*. Everything else — specialisation, SFINAE, `if constexpr` — is about steering *which* code gets generated for *which* types.

**Key terms**

- **Instantiation** — the compiler generating concrete code from a template for a specific set of arguments; implicit (on use) or explicit (`template class Foo<int>;`).
- **Template argument deduction** — the compiler inferring template parameters from function call arguments; drops top-level `const` and references unless the parameter is a reference.
- **Explicit specialisation** — `template<> class Foo<int> {…}`; a completely custom implementation for one exact argument set.
- **Partial specialisation** — specialising for a *pattern* of arguments (`template<class T> class Foo<T*>`); allowed for class templates, **not** function templates.
- **Non-type template parameter (NTTP)** — a value, not a type, as a parameter (`template<std::size_t N>`); C++20 broadened allowed kinds to include class-type NTTPs.
- **Parameter pack** — `typename... Ts` / `Ts... args`; zero-or-more template or function arguments, expanded with `...`.
- **Fold expression** — C++17 `(args + ...)`; collapses a pack over a binary operator without recursion.
- **SFINAE** — "Substitution Failure Is Not An Error"; an ill-formed *substitution* in the immediate context removes an overload rather than erroring.
- **Dependent name** — a name whose meaning depends on a template parameter; needs `typename` (for types) or `template` (for member templates) to disambiguate.
- **CRTP** — Curiously Recurring Template Pattern; `class D : Base<D>`, static polymorphism via the base knowing the derived type.
- **`if constexpr`** — C++17 compile-time branch; the untaken branch is discarded, not instantiated.
- **Two-phase lookup** — names resolved at definition (non-dependent) vs at instantiation (dependent).

**Why interviewers ask this**

Templates are the sharpest junior-vs-senior discriminator in C++. Anyone can write `template<class T>`; the signal is in the corners. Do you know *why* templates go in headers, or do you just cargo-cult it? Can you explain what "duck-typed at compile time" means for error messages? Do you reach for `if constexpr` instead of tag dispatch when appropriate, and do you know when you *can't*? Senior candidates distinguish explicit from partial specialisation, know function templates can't be partially specialised (and overload instead), and can read a `typename T::iterator` and explain the disambiguator. The deepest tell is understanding two-phase lookup — candidates who've only used MSVC (historically lax about it) often can't explain why their code fails on clang. Interviewers also probe judgment: do you know templates cause code bloat and slow compiles, and when a runtime abstraction would serve better?

**Common confusions**

- "Templates are like generics/erased types" — no; each instantiation is a *distinct* type with its own emitted code. `vector<int>` and `vector<double>` share no code, unlike Java's erased `List`.
- "You can partially specialise a function template" — you cannot; you overload instead. Only class (and variable) templates support partial specialisation.
- "`typename` and `class` differ in template parameter lists" — they're interchangeable there; `typename` is *required* elsewhere to mark dependent types.
- "`if constexpr` and SFINAE are interchangeable" — `if constexpr` picks a branch within one function; SFINAE picks between *overloads/specialisations*. `if constexpr` can't remove a candidate from overload resolution.
- "Templates make code faster automatically" — they enable zero-overhead abstraction but cost compile time and binary size; unbounded instantiation is real bloat.

**What follows from this topic**

Templates underpin the next topic, **Template Metaprogramming & Type Traits**, which turns the specialisation/SFINAE machinery here into compile-time computation. The whole **STL** — Containers, Algorithms, iterators — is templates in anger, and iterator categories are dispatched via the tag machinery introduced here. **Concepts** (C++20) supersede much of the SFINAE gymnastics with readable constraints, so master SFINAE first to appreciate what concepts buy you. If templates feel like guesswork, this is the topic to solidify before anything relying on the STL or generic library design.

### Q1. What is the difference between a function template and a class template?

A **function template** parameterises a function; the compiler *deduces* the template arguments from the call arguments, so you rarely spell them out:

```cpp
template<class T> T max(T a, T b) { return a > b ? a : b; }
max(3, 4);        // T = int, deduced
max<double>(3, 4); // T = double, explicit
```

A **class template** parameterises a type. Before C++17 you had to supply the arguments explicitly (`std::vector<int> v;`); since C++17, **class template argument deduction (CTAD)** deduces them from the constructor (`std::vector v{1, 2, 3};` → `vector<int>`).

Key asymmetry: function templates support overloading and argument deduction but **not** partial specialisation; class templates support partial specialisation but historically not deduction (until CTAD). Member functions of a class template are themselves only instantiated when *used* — an unused member with a type error can sit undetected.

### Q2. Explain template argument deduction. What are its main gotchas?

Deduction infers each template parameter by matching the parameter type against the argument type. The core rules mirror how `auto` works (they share machinery):

- For a by-value parameter `T`, top-level `const` and references are **stripped**: `max(const int& x)` deduces `T = int`.
- For `T&`, the reference is kept and `const` preserved: `f(const int&)` → `T = const int`.
- For a forwarding reference `T&&`, deduction uses **reference collapsing**: lvalues deduce `T = U&`, rvalues deduce `T = U`. This is the basis of perfect forwarding.

Gotchas:

```cpp
template<class T> void f(T a, T b);
f(1, 2.0);        // ERROR: T deduced as int and double — conflict

template<class T> void g(const std::vector<T>&);
g({1, 2, 3});     // ERROR: braced-init-list is a non-deduced context

template<class T, std::size_t N> void h(T(&arr)[N]); // deduces array size N
```

Array-to-pointer and function-to-pointer decay also happen unless the parameter is a reference — `h` above captures the size *only* because it takes a reference to an array.

### Q3. Why must template definitions live in header files?

Because instantiation requires the **full definition** at the point of use. When the compiler processes `vector<int> v;` in `main.cpp`, it must generate the code for `vector<int>` right there — which means it needs the complete template body, not just a declaration.

If you split a template into `.h` (declaration) and `.cpp` (definition), each translation unit that uses it sees only the declaration, instantiates nothing, and you get **linker errors** for the missing symbols — the `.cpp`'s translation unit never knew which types to instantiate.

Escape hatches:
- **Header-only** (the norm): put the whole definition in the header.
- **Explicit instantiation**: in one `.cpp`, write `template class Widget<int>;` to force emission there, and declare `extern template class Widget<int>;` elsewhere to suppress redundant instantiation and speed compiles. Only works when you know the finite set of types up front.

### Q4. What is the difference between explicit (full) and partial specialisation?

**Explicit (full) specialisation** provides a custom implementation for one exact set of arguments:

```cpp
template<class T> struct Serializer { /* general */ };
template<> struct Serializer<bool> { /* bool-specific */ }; // full
```

**Partial specialisation** matches a *pattern* of arguments, leaving some still parameterised:

```cpp
template<class T> struct Serializer<T*> { /* any pointer */ };
template<class K, class V> struct Serializer<std::map<K,V>> { /* any map */ };
```

Rules that catch people:
- Only **class** and **variable** templates can be partially specialised. **Function templates cannot** — overload them instead.
- The compiler picks the *most specialised* matching partial specialisation, using partial ordering; ambiguity is an error.
- A full specialisation is not a template (`template<>`), so it's an ordinary definition and must obey the ODR — put it in a `.cpp` or mark it `inline` if it's in a header.

### Q5. What are non-type template parameters and what can they be?

An NTTP is a compile-time *value* passed as a template argument, not a type:

```cpp
template<std::size_t N> struct FixedBuffer { char data[N]; };
FixedBuffer<64> buf; // N = 64, a constant known at compile time
```

Classically allowed kinds: integral and enum values, pointers/references to objects or functions with static storage, `std::nullptr_t`, and (C++17) `auto`-deduced NTTPs (`template<auto V>`). C++20 broadened this to **class-type NTTPs** with structural equality — which is how you can now pass a fixed-size string literal into a template:

```cpp
template<auto V> struct Constant { static constexpr auto value = V; };
Constant<42>::value;   // 42
Constant<'x'>::value;  // 'x', auto deduces char
```

NTTPs must be *constant expressions* — you can't pass a runtime variable. `std::array<T, N>` is the canonical example: the size is an NTTP, which is exactly why `std::array` carries no runtime size overhead.

### Q6. Explain variadic templates and parameter packs.

A variadic template accepts an arbitrary number of template arguments via a **parameter pack** (`typename... Ts`). The pack is expanded with `...`:

```cpp
template<class... Ts>
void printAll(const Ts&... args) {
    // expand into function args, recurse or fold
}
```

Pre-C++17 the idiom was recursion with a base case:

```cpp
void print() {}                                  // base case
template<class T, class... Rest>
void print(const T& first, const Rest&... rest) {
    std::cout << first;
    print(rest...);                              // peel one, recurse
}
```

`sizeof...(Ts)` gives the pack size at compile time. Packs appear in template parameter lists, function parameter lists, and expansion contexts (base-class lists, initialiser lists, etc.). They're the foundation of `std::tuple`, `std::make_unique`'s forwarding, `emplace_back`, and `printf`-style type-safe APIs. Since C++17, fold expressions (next question) replace most of the recursive boilerplate.

### Q7. What are fold expressions and what problem do they solve (C++17)?

Fold expressions collapse a parameter pack over a binary operator in a single expression — eliminating the recursive base-case boilerplate variadic templates used to require.

```cpp
template<class... Ts>
auto sum(Ts... xs) { return (xs + ...); }        // unary right fold

template<class... Ts>
void printAll(const Ts&... xs) {
    ((std::cout << xs << ' '), ...);             // fold over comma
}

template<class... Ts>
bool allTrue(Ts... xs) { return (xs && ...); }   // short-circuits
```

Four forms:

| Form | Expansion |
|---|---|
| `(pack op ...)` | unary right: `x1 op (x2 op (x3))` |
| `(... op pack)` | unary left: `((x1) op x2) op x3` |
| `(pack op ... op init)` | binary right |
| `(init op ... op pack)` | binary left |

Watch the **empty-pack** rules: only `&&` (→ `true`), `||` (→ `false`), and `,` (→ `void()`) are valid for an empty pack with a unary fold; anything else is ill-formed, so use a binary fold with an identity element (`(0 + ... + xs)`) to be safe.

### Q8. What is two-phase name lookup?

Template names are resolved in **two phases**:

1. **At definition time** — non-dependent names (those not depending on a template parameter) are looked up and bound immediately. Syntax errors and use of undeclared non-dependent names are caught here even if the template is never instantiated.
2. **At instantiation time** — dependent names (those depending on `T`) are looked up, including via argument-dependent lookup (ADL) with the actual argument types.

This is why this fails:

```cpp
template<class T>
struct Derived : Base<T> {
    void f() { g(); }   // ERROR if g() is inherited from Base<T>
};
```

`g()` is a non-dependent name, looked up at phase 1, when `Base<T>` isn't yet instantiated — so it isn't found. Fix by making it dependent: `this->g();` or `Base<T>::g();`. MSVC historically deferred *all* lookup to phase 2, so code that compiled there breaks on gcc/clang — a classic portability bug.

### Q9. When do you need the `typename` and `template` disambiguators?

Inside a template, the compiler can't tell whether a *dependent* qualified name is a type, a value, or a member template — so you tell it.

**`typename`** — before a dependent name that is a *type*:

```cpp
template<class T>
void f() {
    typename T::value_type x;   // without typename, parsed as multiplication/decl
    typename std::vector<T>::iterator it;
}
```

Without it, `T::value_type * p` is parsed as "multiply `T::value_type` by `p`", not "declare pointer `p`". (C++20 relaxed this in some contexts where only a type is possible.)

**`template`** — before a dependent *member template* name:

```cpp
template<class T>
void g(T obj) {
    obj.template get<0>();       // disambiguate: get is a member template
    typename T::template rebind<int> r;
}
```

Without it, `obj.get<0>()` parses `<` as less-than. Both are only needed on **dependent** names; on concrete types the compiler already knows.

### Q10. What is SFINAE and when is it useful?

**SFINAE** — "Substitution Failure Is Not An Error." When the compiler substitutes deduced arguments into a template's signature and the substitution produces an ill-formed type *in the immediate context*, that overload is silently **removed** from consideration rather than causing a hard error.

```cpp
// Only viable when T has a nested ::type
template<class T>
typename T::type f(T);          // removed if T::type doesn't exist

template<class T>
void f(...);                     // fallback
```

The canonical tool is `std::enable_if`, which conditionally *produces* a type only when a predicate holds:

```cpp
template<class T,
         std::enable_if_t<std::is_integral_v<T>, int> = 0>
void process(T x) { /* integral path */ }
```

Uses: selecting overloads by type properties, detecting whether an operation is valid, tag-free trait dispatch. Crucially, only failures in the **immediate context** (the signature) are SFINAE-friendly — an error deep in the function *body* is a hard error, not a substitution failure. In C++20, **concepts** replace most SFINAE with far cleaner syntax; SFINAE remains the mechanism underneath.

### Q11. What is template code bloat and how do you mitigate it?

Each distinct instantiation emits its own copy of the code. `vector<int>`, `vector<long>`, and `vector<MyType>` produce three separate sets of functions — even where the logic is identical. Multiplied across a large codebase this inflates binary size, hurts instruction-cache locality, and slows compilation and linking.

Mitigations:
- **Factor type-independent logic into a non-template base** and have the template be a thin typed wrapper. The classic example: implement the container in terms of `void*`/`std::byte` once, wrap it typed. (Some standard libraries do this internally.)
- **`extern template`** declarations to instantiate a common type in exactly one TU and suppress it elsewhere.
- **Type erasure** (`std::function`, a custom vtable) when you genuinely don't need per-type code and can afford a runtime indirection.
- Prefer passing already-instantiated interfaces (`std::span<T>`, `std::string_view`) at API boundaries so callers don't force new instantiations.

Measure first — `nm`/`bloaty`/link maps show which templates dominate. Don't pre-optimise; bloat matters most in binary-size-constrained or heavily-templated code.

### Q12. What is CRTP (Curiously Recurring Template Pattern) and what is it for?

CRTP is a class inheriting from a template *specialised on itself*:

```cpp
template<class Derived>
struct Comparable {
    bool operator>(const Derived& o) const {
        return o < static_cast<const Derived&>(*this); // reuse derived's <
    }
};

struct Money : Comparable<Money> {
    bool operator<(const Money& o) const { /* ... */ }
};
```

It gives **static (compile-time) polymorphism**: the base can call into the derived via `static_cast<Derived&>(*this)` with no virtual dispatch, so calls inline and cost nothing at runtime. Uses:

- **Mixin behaviour** — inject a whole family of operators/methods from one `<` (as above) or one `==`.
- **Static interface / "policy"** — `enable_shared_from_this` is CRTP.
- **Object counters, cloning, visitor plumbing** without vtables.

Trade-offs: no runtime polymorphism (you can't store heterogeneous `Comparable*` and dispatch dynamically), each derived class is an unrelated type, and error messages get gnarly. Since C++23, **deducing this** (`this auto&& self`) offers a cleaner alternative for many CRTP use cases.

### Q13. What are dependent names and why do they complicate templates?

A **dependent name** is any name whose meaning depends on a template parameter — `T::value_type`, `this->member` in a template base, `obj.template method<X>()`. Because the compiler doesn't know what `T` is at definition time, it can't resolve these until instantiation, and it can't even *parse* some of them without help.

Three practical consequences:

1. **Disambiguators required** — `typename`/`template` (Q9), because the parser can't tell a dependent type from a value or a member template from a comparison.
2. **Base-class members are invisible by default** — names inherited from a dependent base (`Base<T>`) are *not* found by unqualified lookup (Q8); use `this->` or `Base<T>::`.
3. **ADL applies at phase 2** — dependent function calls pull in overloads from the argument types' namespaces at instantiation, which is how customization points like `swap` and `begin` work (`using std::swap; swap(a, b);`).

The mental rule: if a name's meaning could change depending on `T`, the compiler defers it — and you may have to annotate it.

### Q14. What are default template arguments?

You can give template parameters defaults, exactly like function parameter defaults:

```cpp
template<class T, class Allocator = std::allocator<T>>
class vector { /* ... */ };

vector<int> v;                       // Allocator defaults to std::allocator<int>

template<class T, class Compare = std::less<T>>
class set { /* ... */ };
```

Rules and uses:
- Defaults let library types expose customisation points (allocator, comparator, hash) that most users never touch.
- Later parameters can depend on earlier ones (`Allocator = std::allocator<T>`).
- For **class** templates, once you default a parameter all following ones must also be defaulted (like function args). For **function** templates this restriction is relaxed — a defaulted parameter can precede a deducible one, since deduction fills the rest.
- Default arguments are a common place to inject SFINAE/`enable_if` guards on a *type* parameter without changing the visible signature.

### Q15. What are alias templates and how do they differ from typedefs?

An **alias template** is a parameterised `using` declaration — a name for a family of types:

```cpp
template<class T> using Vec = std::vector<T>;
Vec<int> v;                              // == std::vector<int>

template<class T> using ElementType = typename Container<T>::value_type;
```

Differences from the old `typedef`:
- `typedef` **cannot** be templated; alias templates can. This is their whole reason to exist.
- Aliases never introduce a new type — `Vec<int>` *is* `std::vector<int>`, fully interchangeable.
- The `_t` convention in `<type_traits>` (`std::remove_reference_t<T>`) is alias templates over the `::type` members, saving you the `typename … ::type` noise.

One subtlety: alias templates are **never deduced** — `Vec` above can't have its `T` deduced from a `std::vector<int>` argument, because the compiler doesn't invert aliases. And they can't be partially or explicitly specialised; specialise the underlying template instead.

### Q16. What is `if constexpr` and how does it differ from a regular `if` or SFINAE?

`if constexpr` (C++17) is a **compile-time** branch: the condition must be a constant expression, and the **discarded branch is not instantiated** for the current template arguments.

```cpp
template<class T>
auto stringify(const T& x) {
    if constexpr (std::is_arithmetic_v<T>)
        return std::to_string(x);       // only instantiated for arithmetic T
    else
        return std::string(x);          // only instantiated otherwise
}
```

With a plain `if`, *both* branches must compile for every `T`, so the above would fail — you can't call `std::to_string` on a non-arithmetic type even in a dead branch. `if constexpr` fixes that by discarding the untaken branch.

Versus SFINAE: `if constexpr` chooses a path *within a single function*; SFINAE chooses between *separate overloads/specialisations*. `if constexpr` is far more readable and is the modern replacement for tag dispatch and much `enable_if` — but it **can't remove a function from overload resolution**, so when the *selection itself* must participate in overloading (e.g. a customization point), you still need SFINAE or concepts.

### Q17. What does this print, and why? (spot the bug)

```cpp
template<class T>
struct Wrapper {
    void show() { std::cout << "primary\n"; }
};

template<class T>
struct Wrapper<T*> {              // partial specialisation for pointers
    void show() { std::cout << "pointer\n"; }
};

int main() {
    Wrapper<int>  a; a.show();
    Wrapper<int*> b; b.show();
}
```

Prints:
```
primary
pointer
```

`Wrapper<int>` matches only the primary template. `Wrapper<int*>` matches the `T*` **partial specialisation**, which is more specialised, so the compiler selects it — the class is entirely re-defined for pointer types, so `show()` prints `"pointer"`. The common trap is expecting the primary's `show()` to run for both because it "looks like the default"; a partial specialisation *replaces* the whole class for matching arguments, not just the members you override. If you added `Wrapper<const int*>`, note `int*` and `const int*` are different patterns and would need separate specialisations.

### Q18. How would you write a compile-time check that a type has a `.size()` member?

Pre-C++20, use SFINAE with `decltype` and `std::void_t` (the *detection idiom*):

```cpp
template<class, class = void>
struct has_size : std::false_type {};

template<class T>
struct has_size<T, std::void_t<decltype(std::declval<T>().size())>>
    : std::true_type {};

static_assert(has_size<std::vector<int>>::value);
static_assert(!has_size<int>::value);
```

The partial specialisation is only viable when `decltype(declval<T>().size())` is a valid type; `void_t` maps any valid type to `void` so the specialisation matches. If the expression is ill-formed, SFINAE drops the specialisation and you fall back to `false_type`.

In C++20 this collapses to a **concept**, which is what you'd actually reach for:

```cpp
template<class T>
concept HasSize = requires(T t) { { t.size() } -> std::convertible_to<std::size_t>; };
```

Same intent, immediate context, far clearer diagnostics — the payoff for having understood the SFINAE mechanism underneath.

## Template Metaprogramming & Type Traits

### Summary

**What this topic covers**

Template metaprogramming (TMP) is computation performed by the compiler, at compile time, using the template system as an interpreter. This topic covers the practical modern subset: the `<type_traits>` library, the tools for constraining and selecting templates (`std::enable_if`, tag dispatch, `std::conditional`), the detection idiom built from `std::declval` and `std::void_t`, the boundary between old-school TMP and modern `constexpr`, and the type-manipulation traits (`is_same`, `remove_reference`, `decay`) you use daily even when you never write a metafunction of your own. The 14 questions here are less about writing recursive template calculators (that era is fading) and more about the traits and techniques a working engineer reaches for: perfect-forwarding factories, trailing return types with `decltype`, and — critically — *judgment* about when TMP is the right tool versus when `constexpr` functions or C++20 concepts are simpler. Interviewers care as much about "when would you *not* use this" as about the mechanics.

**Mental model**

Classic TMP treats **types as values and templates as functions**. A "metafunction" is a class template whose result is a nested `::type` (for a type result) or `::value` (for a value result); you "call" it by instantiating and reading the member. `std::remove_reference<T>::type` is a function from a type to a type; `std::is_integral<T>::value` is a function from a type to a `bool`. Recursion replaces loops (specialise a base case, recurse in the general case), and specialisation replaces branching. The compiler *is* the interpreter, and instantiation *is* evaluation — which is why heavy TMP murders compile times. The modern shift is that much of what once required this template-as-interpreter style is now expressible with ordinary-looking **`constexpr` functions** running at compile time, and constraints once encoded via SFINAE are now **concepts**. So the mental model is dual: understand the type-as-value machinery to read existing library code, but reach for `constexpr`/concepts when *writing* new code.

**Key terms**

- **Metafunction** — a class template exposing a `::type` or `::value` as its result.
- **Type trait** — a metafunction in `<type_traits>` querying (`is_pointer`) or transforming (`remove_const`) a type.
- **`std::integral_constant`** — the base wrapping a compile-time value as a type; `true_type`/`false_type` are the boolean specialisations.
- **`std::enable_if`** — SFINAE helper that yields a `::type` only when its bool condition is true; the tool for conditionally enabling overloads.
- **`std::conditional`** — compile-time ternary: `conditional_t<B, T, F>` is `T` if `B` else `F`.
- **`std::declval<T>()`** — produces an rvalue of `T` in an *unevaluated* context (no constructor needed) for use inside `decltype`.
- **`std::void_t`** — maps any well-formed type list to `void`; the workhorse of the detection idiom.
- **Detection idiom** — SFINAE pattern using `void_t` + partial specialisation to test whether an expression is valid.
- **Tag dispatch** — selecting an overload by passing an empty tag type (e.g. iterator category) as an argument.
- **`decltype`** — yields the declared type of an expression without evaluating it; pairs with trailing return types.
- **`std::decay`** — models pass-by-value: strips references, cv-qualifiers, and applies array/function-to-pointer decay.
- **Perfect forwarding** — preserving value category through `T&&` + `std::forward<T>` so a factory forwards args unchanged.

**Why interviewers ask this**

TMP is where interviewers separate people who *use* the STL from people who *understand* it. Almost no job requires writing gnarly recursive metaprograms — but reading `<type_traits>`-heavy library code, writing a `make_unique`-style forwarding factory, or constraining a template correctly is routine senior work. The strongest signal is *judgment*: a candidate who reaches for a 40-line SFINAE contraption where a `constexpr` function or a concept would do is showing they learned TMP in 2012 and stopped. Conversely, someone who says "I'd write this as `if constexpr`, but if it needs to affect overload resolution I'd use a concept, falling back to `enable_if` pre-C++20" is showing current, practical command. Interviewers also probe fundamentals that trip people up: why `declval` exists, the difference between `decltype(x)` and `decltype((x))`, and what `decay` actually does — small things that reveal depth.

**Common confusions**

- "TMP and `constexpr` are the same" — TMP computes with *types* via instantiation; `constexpr` runs *ordinary functions* at compile time. Modern code prefers `constexpr` where the result is a value.
- "`decltype(x)` gives the type of `x`" — only for an unparenthesised id-expression. `decltype((x))` adds a reference: it's the *expression* type, so `decltype((x))` is `int&` for a local `int x`.
- "`std::declval` returns a value you can use" — no; it's only legal in unevaluated contexts (`decltype`, `sizeof`, `noexcept`). Calling it at runtime is an error by design (it has no definition).
- "`remove_reference` also removes const" — it doesn't; `remove_reference_t<const int&>` is `const int`. Use `decay` or `remove_cvref` (C++20) to strip everything.
- "Traits are magic compiler intrinsics" — some are (`is_polymorphic`), but many are ordinary partial specialisations you could write yourself.

**What follows from this topic**

This topic is the applied face of **Templates & Generic Programming** — SFINAE, specialisation, and packs from there become computation here. The traits covered underpin the **STL** (allocator/iterator machinery, `std::advance`'s tag dispatch) and the correctness of any generic API you design. Most importantly, it sets up **Concepts** (C++20): concepts are the readable successor to nearly everything in this topic, so understanding the SFINAE/`enable_if`/detection machinery is what lets you appreciate *why* concepts were added and when they fully replace the older tools versus when the old tools still show through in existing code.

### Q1. What is `<type_traits>` and what are the two categories of traits?

`<type_traits>` is the standard metaprogramming toolkit: a set of compile-time metafunctions for querying and transforming types. Two categories:

**Query traits** — ask a yes/no or numeric question, expose `::value`:

```cpp
std::is_integral<T>::value       // or is_integral_v<T> (C++17)
std::is_pointer_v<T>
std::is_base_of_v<Base, Derived>
std::is_same_v<T, U>
```

**Transformation traits** — produce a new type, expose `::type` (with a `_t` alias since C++14):

```cpp
std::remove_reference_t<T>       // T& -> T
std::add_const_t<T>              // T  -> const T
std::conditional_t<B, X, Y>      // B ? X : Y
std::decay_t<T>                  // pass-by-value model
```

The `_v` (value) and `_t` (type) aliases exist precisely to remove the `::value` / `typename …::type` boilerplate. In practice you consume traits far more than you write them — they're the vocabulary of generic constraints and perfect-forwarding code.

### Q2. Explain `std::enable_if`. Show both common placements.

`std::enable_if<B, T>` exposes `::type = T` **only when `B` is true**; when `B` is false it has *no* `::type`, so any template relying on it fails substitution and is dropped from overload resolution (SFINAE).

```cpp
// (1) as a return type
template<class T>
std::enable_if_t<std::is_integral_v<T>, T>
half(T x) { return x / 2; }

// (2) as a defaulted non-type template parameter (preferred — doesn't
//     clutter the signature and works for constructors)
template<class T, std::enable_if_t<std::is_floating_point_v<T>, int> = 0>
T half(T x) { return x / 2; }
```

Placement (2) is generally preferred: it works even when there's no return type to hijack (constructors, conversion operators) and lets you write multiple mutually-exclusive overloads without ambiguity. The whole pattern is largely superseded by **concepts** in C++20 (`template<std::integral T>`), which say the same thing without the ceremony — but `enable_if` remains everywhere in existing code.

### Q3. What is tag dispatch and when would you use it over `enable_if`?

Tag dispatch selects an overload by passing an **empty tag type** as an extra argument, letting normal overload resolution do the branching:

```cpp
template<class It>
void advance_impl(It& it, int n, std::random_access_iterator_tag) {
    it += n;                                  // O(1)
}
template<class It>
void advance_impl(It& it, int n, std::forward_iterator_tag) {
    while (n--) ++it;                         // O(n)
}
template<class It>
void advance(It& it, int n) {
    advance_impl(it, n, typename std::iterator_traits<It>::iterator_category{});
}
```

This is exactly how `std::advance` and `std::distance` pick an optimal implementation per iterator category. Versus `enable_if`: tag dispatch is **cleaner for a discrete set of categories** with a natural tag hierarchy (overload resolution even picks the most-derived tag automatically), reads better, and gives clearer errors. `enable_if`/SFINAE wins when the condition is an arbitrary boolean predicate that doesn't map to a tag type. In C++20 both are frequently replaced by `if constexpr` (for in-function branching) or concept overloading.

### Q4. What does `std::conditional` do?

`std::conditional<B, T, F>` is a **compile-time ternary** on types: `conditional_t<B, T, F>` is `T` when `B` is `true`, otherwise `F`.

```cpp
template<class T>
using StorageType = std::conditional_t<
    (sizeof(T) <= sizeof(void*)),
    T,                    // small: store by value
    T*                    // large: store by pointer
>;
```

Both branches must be **well-formed types** — unlike `if constexpr`, `conditional` doesn't discard the untaken branch, it just *selects* one of two already-valid types. So you can't use it to avoid instantiating an invalid type; for that you need `enable_if`/SFINAE or `if constexpr`. It's commonly used to pick a return type, an iterator type (const vs non-const in one class template), or an integer width based on a size computation.

### Q5. What is `std::declval` and why is it needed?

`std::declval<T>()` yields a value of type `T&&` in an **unevaluated context** — without requiring `T` to be constructible. It exists purely so you can name "an expression of type `T`" inside `decltype`/`sizeof`/`noexcept` even when you can't actually *create* a `T`:

```cpp
template<class T, class U>
using AddResult = decltype(std::declval<T>() + std::declval<U>());

AddResult<int, double> x;   // double — computed without adding anything
```

Why not just write `T{} + U{}`? Because `T` might have no default constructor (or any accessible constructor at all) — `declval` sidesteps construction entirely. The catch, enforced by design: `declval` has **no definition**, so if it ever escapes an unevaluated context and gets ODR-used at runtime, you get a linker/compile error. That's intentional — it's a compile-time-only stand-in for "pretend I have a `T` here."

### Q6. Explain `std::void_t` and the detection idiom.

`std::void_t<Ts...>` (C++17) is an alias that maps *any* list of well-formed types to `void`. Its value is entirely in the **side effect**: if any type in the pack is ill-formed, substitution fails (SFINAE), which lets a partial specialisation act as a validity test.

```cpp
// primary: assume not detected
template<class T, class = void>
struct is_dereferenceable : std::false_type {};

// specialisation: only valid if *declval<T>() is well-formed
template<class T>
struct is_dereferenceable<T, std::void_t<decltype(*std::declval<T>())>>
    : std::true_type {};

static_assert(is_dereferenceable<int*>::value);
static_assert(!is_dereferenceable<int>::value);
```

If `*std::declval<T>()` is valid, `void_t<…>` is `void`, the specialisation matches (it's more specialised than the primary), and you get `true_type`. Otherwise SFINAE removes the specialisation and the primary's `false_type` wins. This is the **detection idiom** — the pre-C++20 way to ask "is this expression valid for `T`?". C++20 concepts (`requires`) express the same thing directly and legibly.

### Q7. When is compile-time computation with TMP the wrong tool?

TMP earns its keep when you must compute or manipulate **types**, or enforce constraints that affect overload resolution. It's the *wrong* tool when:

- **You're computing a value, not a type.** A `constexpr` function (`constexpr int factorial(int n){…}`) reads like normal code, debugs like normal code, and runs at compile time when the inputs are constant. Recursive-template integer arithmetic is a legacy pattern — don't write it in new code.
- **You just need an in-function branch.** `if constexpr` beats SFINAE/tag dispatch for readability.
- **You're expressing a constraint (C++20).** Concepts replace `enable_if`/detection with clearer syntax and dramatically better error messages.
- **Compile time or diagnostics matter.** Heavy TMP explodes compile times and produces error novellas; if a runtime abstraction (virtual dispatch, `std::function`) is cheap enough, prefer it.

The senior instinct: reach for the *simplest* mechanism that works — `constexpr` → `if constexpr` → concept → SFINAE/TMP, in roughly that order of preference. Deep TMP is a maintenance liability; use it only when nothing simpler expresses the requirement.

### Q8. What is `std::integral_constant` and how do `true_type`/`false_type` relate?

`std::integral_constant<T, v>` wraps a **compile-time constant value as a type**, exposing `::value` (the constant) and a conversion operator:

```cpp
using Two = std::integral_constant<int, 2>;
static_assert(Two::value == 2);
```

`std::true_type` and `std::false_type` are just:

```cpp
using true_type  = std::integral_constant<bool, true>;
using false_type = std::integral_constant<bool, false>;
```

Nearly every boolean query trait *inherits* from one of them, which is why `std::is_integral<int>` behaves as `true_type` — it *is a* `true_type`. This matters for **tag dispatch**: because they're distinct types, you can overload on `std::true_type` vs `std::false_type` and let overload resolution branch on a trait:

```cpp
template<class T> void f(T x, std::true_type)  { /* integral path */ }
template<class T> void f(T x, std::false_type) { /* other path   */ }
template<class T> void f(T x) { f(x, std::is_integral<T>{}); }
```

### Q9. What is the difference between `constexpr` functions and template metaprogramming?

Both compute at compile time, but through different machinery:

| | TMP | `constexpr` function |
|---|---|---|
| Computes | types **and** values | values (and, with `consteval`, forced at compile time) |
| Syntax | class templates, `::type`/`::value`, recursion + specialisation | ordinary function syntax, loops, `if` |
| Readability | poor; a DSL in the type system | reads like runtime code |
| Runtime use | compile-time only | same function usable at runtime too |
| Debuggability | painful | can be stepped like normal code |

`constexpr` (C++11, hugely relaxed in C++14/17/20 to allow loops, local mutation, even `constexpr` allocation and `std::vector` in C++20) has absorbed most *value* computation that used to require TMP. The remaining irreducible domain of TMP is **type-level** work — you can't return a *type* from a `constexpr` function. So: compute values with `constexpr`; manipulate types with traits/templates; constrain overloads with concepts.

### Q10. What is `decltype` and how does it pair with trailing return types?

`decltype(expr)` yields the **declared type** of an expression without evaluating it. It's the tool for return types that depend on the parameters:

```cpp
template<class T, class U>
auto add(T a, U b) -> decltype(a + b) { return a + b; }   // trailing return
```

The trailing form (`auto … -> decltype(…)`) is needed pre-C++14 because `a` and `b` aren't in scope when a *leading* return type is parsed. Since C++14 you can often just write `auto add(T a, U b) { return a + b; }` and let return-type deduction handle it — but `decltype(auto)` preserves references/cv exactly where plain `auto` would strip them:

```cpp
decltype(auto) get(std::vector<int>& v) { return v[0]; }  // returns int&
auto           get2(std::vector<int>& v){ return v[0]; }  // returns int (copy!)
```

Watch the parentheses rule: `decltype(x)` on a variable gives its declared type; `decltype((x))` gives the *expression* type — an lvalue reference (`int&`). That distinction is a favourite interview gotcha.

### Q11. Write a perfect-forwarding factory function.

The canonical shape (this is `std::make_unique` minus the checks):

```cpp
template<class T, class... Args>
std::unique_ptr<T> make(Args&&... args) {
    return std::unique_ptr<T>(new T(std::forward<Args>(args)...));
}
```

Two pieces do the work:

- **`Args&&... args`** — a pack of *forwarding references*. Reference collapsing means each argument's value category is captured: lvalues deduce `Args = U&`, rvalues deduce `Args = U`.
- **`std::forward<Args>(args)...`** — casts each argument back to its original value category, so lvalues stay lvalues and rvalues stay rvalues. This preserves move semantics through the factory — a temporary passed in is *moved* into `T`'s constructor, not copied.

Never use `std::move` here — `std::move` unconditionally casts to rvalue, which would wrongly move from lvalue arguments the caller still owns. `std::forward` is *conditional* move: move only if the caller gave you an rvalue. The `...` expands both the parameter pack and the forward call in lockstep.

### Q12. What is a type list and what is it used for?

A **type list** is a compile-time sequence of types, usually held in a variadic template:

```cpp
template<class... Ts> struct TypeList {};
using Numbers = TypeList<int, long, double>;
```

You operate on it with the same techniques as any TMP: `sizeof...(Ts)` for length, partial specialisation to get the head/tail, recursion to fold over it. Common operations are "get the Nth type", "does this list contain T?", "map a trait over every element", "filter". Uses:

- **`std::tuple`** is essentially a type list plus storage.
- **`std::variant`** carries a type list of alternatives.
- **Visitor / dispatch tables**, serialisation frameworks, and reflection-like registration ("for each type in this list, register a handler").

In modern C++ you rarely hand-roll list algorithms — libraries like Boost.Mp11 or `std::tuple`/`std::variant` cover most needs, and fold expressions over packs handle the simple cases inline without a named list type at all.

### Q13. When would you choose a concept over the traits/SFINAE tools in this topic?

Prefer a **concept** (C++20) essentially whenever you're expressing a *constraint on a template parameter* and you're on a C++20 toolchain. Concepts are the direct, readable successor to `enable_if`/detection:

```cpp
// SFINAE, pre-C++20
template<class T, std::enable_if_t<std::is_integral_v<T>, int> = 0>
void f(T);

// concept, C++20 — same meaning
template<std::integral T> void f(T);
void f(std::integral auto x);   // even terser
```

Concepts win on: **readability** (the intent is in the signature), **error messages** (the compiler says "constraint not satisfied" instead of dumping a substitution-failure novel), **overloading** (concepts subsume/order each other, so a more-constrained overload is preferred automatically without ambiguity tricks), and **composability** (`requires` clauses combine cleanly).

Stick with SFINAE/traits only when you're stuck pre-C++20, or when you genuinely need to test something a concept can't express as cleanly (rare). Traits like `is_same`/`decay`/`remove_reference` remain useful *inside* concept definitions — concepts replace the *plumbing*, not the vocabulary.

### Q14. Explain `is_same`, `remove_reference`, and `decay` with examples.

Three of the most-used traits, each with a common surprise:

**`std::is_same<T, U>`** — exact type equality, cv- and reference-sensitive:

```cpp
std::is_same_v<int, int>          // true
std::is_same_v<int, const int>    // false — const counts
std::is_same_v<int&, int>         // false — reference counts
```

**`std::remove_reference<T>`** — strips one level of reference, *keeps* cv-qualifiers:

```cpp
std::remove_reference_t<int&>        // int
std::remove_reference_t<const int&>  // const int  (const survives!)
```

**`std::decay<T>`** — models what happens to a type when passed **by value**: removes references, removes cv-qualifiers, and applies array/function-to-pointer decay:

```cpp
std::decay_t<const int&>   // int
std::decay_t<int[5]>       // int*   (array decays)
std::decay_t<int(int)>     // int(*)(int)  (function decays)
```

Use `decay` (or C++20's `std::remove_cvref` when you want *only* the cv+ref stripping without the decay) to normalise a deduced `T&&` back to a clean value type — a routine step in generic code that stores or compares deduced types.

## STL: Containers

### Summary

**What this topic covers**

The Standard Template Library's container half: the concrete data structures the language ships and the rules governing how you choose and misuse them. Three concern areas: (1) the **sequence containers** — `vector`, `array`, `deque`, `list`/`forward_list` — and their memory layouts, growth behaviour, and iterator-invalidation semantics; (2) the **associative containers** — ordered `map`/`set`/`multimap`/`multiset` (red-black trees) and unordered `unordered_map`/`unordered_set` (hash tables) — with their complexity, ordering, hashing, and load-factor mechanics; and (3) the **adaptors and views** — `stack`/`queue`/`priority_queue`, plus the non-owning `std::span` and `std::string_view`, and the special cases every senior is expected to know cold: `string` and the small-string optimisation, `vector<bool>`'s proxy trap, node handles (`extract`), and custom hashers/comparators. The 18 questions here are heavy on *judgment* (which container, and why) and *gotchas* (what invalidates what, what copies when). Choosing the right container is a daily decision; getting invalidation wrong is a daily bug.

**Mental model**

Think of container choice as a decision along three axes: **memory layout** (contiguous vs node-based), **access pattern** (indexed, sequential, keyed), and **ordering** (none, sorted, insertion). `vector` is a growable contiguous array — cache-friendly, `O(1)` indexed access, `O(1)` amortised push_back, but `O(n)` middle insertion and reallocation invalidates everything. Node-based containers (`list`, `map`, `set`) trade cache locality for stable element addresses and cheap splicing. Associative containers split by *how* they find keys: ordered ones are balanced binary trees (`O(log n)`, sorted iteration, need `<`); unordered ones are hash tables (`O(1)` average, no order, need a hash + `==`). The unifying discipline is **iterator invalidation**: every mutating operation has documented rules about which iterators, pointers, and references survive it, and those rules follow directly from the layout — reallocating a `vector` moves every element, so every iterator dies; a `list` node never moves, so only the erased element's iterator dies. Internalise the layout and the rules become derivable rather than memorised.

**Key terms**

- **`vector`** — dynamic contiguous array; `size` (elements) vs `capacity` (allocated slots); grows geometrically.
- **`reserve` vs `resize`** — `reserve(n)` changes capacity only; `resize(n)` changes the element count (constructing/destroying).
- **`deque`** — double-ended queue; segmented storage, `O(1)` push/pop at both ends, **not** contiguous.
- **`list` / `forward_list`** — doubly / singly linked lists; `O(1)` splice, stable addresses, poor locality.
- **Red-black tree** — the self-balancing BST behind `map`/`set`; guarantees `O(log n)`, sorted order.
- **Load factor** — `size / bucket_count` in a hash table; exceeding `max_load_factor` triggers a rehash.
- **Iterator invalidation** — the rule set for which iterators/pointers/references a mutation breaks.
- **`emplace`** — constructs the element in place from constructor args, avoiding a temporary that `insert` may build.
- **Node handle** — C++17 `extract`; detaches a node so it can be moved between containers or re-keyed without reallocation.
- **SSO** — small-string optimisation; short strings stored inline in the `string` object, no heap allocation.
- **`vector<bool>`** — a bit-packed specialisation returning a *proxy*, not a real `bool&`.
- **`span` / `string_view`** — non-owning (pointer, length) views over contiguous data; cheap to pass, borrow-not-own.

**Why interviewers ask this**

Container choice is the most *frequent* real decision a C++ engineer makes, so it's a fast, honest competence probe. Juniors reach for `list` "because insertion is O(1)" and get schooled on cache locality — in practice `vector` wins even for middle insertion up to surprisingly large sizes because linked-list pointer chasing destroys the cache. Seniors quote the complexity table *and* know that constant factors and memory layout usually dominate the big-O. Interviewers also mine this area for correctness gotchas that reveal real experience: iterator invalidation bugs (erasing while iterating), `vector<bool>`'s proxy breaking `auto&`, `[]` on a `map` silently *inserting* a default value, and `emplace` vs `insert` subtleties. Finally, the modern additions — `string_view`, `span`, node handles — signal whether a candidate has kept current or stopped learning at C++11.

**Common confusions**

- "`list` is faster for insertion" — only algorithmically; cache misses make `vector` faster in practice until quite large `n`. Measure.
- "`reserve` sets the size" — no; `reserve` only grows *capacity*. The elements don't exist until you push/emplace. `resize` creates elements.
- "`map::operator[]` is a read" — it **inserts** a default-constructed value if the key is absent, and can't be used on a `const map`. Use `.at()` or `.find()` to read.
- "`vector<bool>` stores bools" — it's a bit-packed proxy specialisation; `v[i]` isn't a `bool&`, so `auto& b = v[i]` and `&v[i]` don't behave like other vectors.
- "unordered containers keep some order" — they don't; iteration order is unspecified and changes on rehash.
- "erasing an element invalidates all iterators" — depends on the container; for `list`/`map` only the erased iterator dies, for `vector` everything from the erase point onward.

**What follows from this topic**

Containers are half of the STL; **Algorithms & Iterators** is the other half, and the two meet at the iterator concept — a container's invalidation rules and iterator category determine which algorithms are safe and efficient on it. The choice discipline here (layout, locality, complexity) recurs in performance work. `string_view`/`span` connect forward to the ownership/lifetime concerns of **Smart Pointers & RAII** (a view must not outlive its backing store). And the associative containers' reliance on custom hashers/comparators links back to **operator overloading** and the traits machinery from the previous topics.

### Q1. Explain how `std::vector` grows. What's the difference between size and capacity?

A `vector` holds a contiguous heap array plus two counts: **size** (elements currently constructed) and **capacity** (slots allocated). `push_back` uses a free slot when `size < capacity`; when full, it **reallocates**: allocates a larger block (typically 1.5× or 2× — implementation-defined), moves/copies the elements over, and frees the old block.

Geometric growth is what makes `push_back` **`O(1)` amortised**: doubling means the total copy work across `n` pushes is `O(n)`, not `O(n²)`.

```cpp
std::vector<int> v;
v.reserve(100);         // capacity >= 100, size still 0
std::cout << v.size();  // 0
std::cout << v.capacity(); // >= 100
v.resize(10);           // size = 10, ten value-initialised ints
```

Two practical consequences: (1) if you know the final size, `reserve` it up front to avoid repeated reallocation and the iterator invalidation that comes with it; (2) reallocation moves every element, so **any** reallocation invalidates all iterators, pointers, and references into the vector.

### Q2. When does a `vector` invalidate iterators, pointers, and references?

The rule follows from the contiguous layout:

| Operation | Invalidates |
|---|---|
| `push_back`/`emplace_back` **causing reallocation** | **all** iterators/pointers/references |
| `push_back` with spare capacity | `end()` only |
| `insert`/`erase` at position `p` | everything **at and after** `p` (and all, if reallocated) |
| `reserve`/`resize` growing past capacity | all |
| `clear` | all (except still-valid `end()`ish semantics — treat as all) |
| `operator[]`, `at`, `data`, read-only | nothing |

```cpp
std::vector<int> v{1,2,3};
int* p = &v[0];
v.push_back(4);     // MAY reallocate -> p dangling. UB to deref.
```

The senior habit: don't hold raw pointers/iterators across any mutation that can grow or shift the vector. If you must, `reserve` enough up front so no reallocation occurs, or store **indices** instead of iterators — indices survive reallocation.

### Q3. When would you use `std::array` over `std::vector`, and over a C array?

`std::array<T, N>` is a **fixed-size** contiguous array whose size is a compile-time constant — no heap allocation, the storage lives inline (stack, or inside the enclosing object).

- **Over `vector`**: when the size is known at compile time and fixed. `array` avoids the heap allocation and the size/capacity bookkeeping, and can live on the stack. Use it for small fixed buffers, lookup tables, coordinates, etc. Downside: size is part of the type, so `array<int,3>` and `array<int,4>` are different types.
- **Over a C array (`int a[N]`)**: essentially always. `std::array` is a zero-overhead wrapper that adds `.size()`, iterators, bounds-checked `.at()`, value semantics (it copies and can be returned from a function — C arrays can't), and it doesn't decay to a pointer silently. Same performance, strictly better ergonomics and safety.

Rule of thumb: fixed size known at compile time → `array`; size known only at runtime or must grow → `vector`; raw C array → basically never in new code.

### Q4. What is `std::deque` and how does it differ from `vector` and `list`?

`std::deque` (double-ended queue) supports **`O(1)` insertion and removal at *both* ends**, plus `O(1)` random access — something neither `vector` (cheap only at the back) nor `list` (no random access) offers.

Internally it's **not contiguous**: it's a sequence of fixed-size chunks with a map (index) of chunk pointers. Consequences:

- `push_front`/`push_back` are `O(1)` and — importantly — **don't invalidate references/pointers to existing elements** (only iterators are invalidated by end insertions). Contrast `vector`, where a front insert shifts everything.
- No `data()` / no contiguity guarantee, so you can't pass it to a C API expecting a flat buffer.
- Slightly worse locality and a fatter per-element overhead than `vector`.

Use `deque` when you need a queue/double-ended workload with indexed access — it's the default backing store for `std::stack` and `std::queue` for exactly this reason. If you only ever push at the back, `vector` is usually faster.

### Q5. Compare `std::list` and `std::forward_list`. When is either the right choice?

Both are node-based linked lists with stable element addresses and `O(1)` splice:

- **`std::list`** — doubly linked; bidirectional iteration, `O(1)` insert/erase *given an iterator* at either end or the middle, `O(1)` `splice`.
- **`std::forward_list`** — singly linked; forward-only, lower per-node overhead (one pointer instead of two), and a deliberately minimal API (`insert_after`, `erase_after`, no `size()` by default). It's the memory-lean choice.

When either is genuinely right is **rarer than people think**. Valid cases:

- You need **stable references/iterators** that survive arbitrary insertions and erasures elsewhere (node-based containers never move existing elements).
- You do lots of **splicing** — moving sub-ranges between lists in `O(1)` without copying.
- Large elements where moving them (as `vector` would on reallocation) is expensive and you can't reserve.

Otherwise `vector` almost always wins on real hardware because linked-list traversal is a cache-miss per node. Benchmark before choosing a list "for O(1) insertion".

### Q6. How do `std::map` and `std::set` work internally, and what do they guarantee?

Both are **balanced binary search trees** (red-black trees in every mainstream implementation). `set` stores keys; `map` stores key→value pairs keyed on the key. Guarantees:

- **`O(log n)`** insert, erase, and find.
- **Sorted iteration** — traversing yields keys in order defined by the comparator (default `std::less<Key>`, i.e. `operator<`). This is the headline feature: you get an always-sorted structure for free.
- **Stable addresses** — nodes never move, so references/pointers/iterators to elements survive any insertion and survive erasure of *other* elements.

Requirements: the key type needs a **strict weak ordering** (a valid `<`, or a custom comparator). It does *not* need `==` or a hash.

```cpp
std::map<std::string, int> counts;
++counts["apple"];   // operator[] default-inserts 0, then increments -> 1
```

Choose ordered containers when you need sorted traversal, range queries (`lower_bound`/`upper_bound`), or a guaranteed worst-case `O(log n)` (hash tables can degrade). Otherwise the unordered variants are usually faster.

### Q7. How do `std::unordered_map` and `std::unordered_set` work? What is the load factor?

They're **hash tables**: each key is hashed to a bucket, and each bucket holds a chain (typically a linked list) of elements that hash there. Operations are **`O(1)` average**, `O(n)` worst case (everything colliding into one bucket).

- **Load factor** = `size() / bucket_count()`. When an insertion would push the load factor above `max_load_factor()` (default `1.0`), the table **rehashes**: allocates more buckets and redistributes every element (recomputing hashes). Rehashing is `O(n)` and **invalidates all iterators** (but *not* references/pointers to elements — nodes are stable).
- Requirements: the key needs a **hash function** (`std::hash<Key>`) and an **equality** (`operator==`), not an ordering.
- `reserve(n)` pre-sizes the bucket array to avoid rehashes during bulk insertion — the analogue of `vector::reserve`.

Trade-off vs ordered: unordered is faster on average and needs no ordering, but gives **no sorted iteration**, has worse worst-case behaviour, and needs a good hash to avoid clustering. Iteration order is unspecified and changes across rehashes.

### Q8. What do `multimap`/`multiset` add, and how do you work with duplicate keys?

`std::multimap` and `std::multiset` are the same red-black-tree structures as `map`/`set` but **permit duplicate keys**. (There are `unordered_multimap`/`unordered_multiset` too.)

Differences that matter:

- **No `operator[]`** on `multimap` — it wouldn't make sense with duplicate keys. Use `insert`/`emplace`.
- To retrieve all values for a key, use **`equal_range(key)`**, which returns a `[first, last)` pair of iterators spanning the duplicates:

```cpp
std::multimap<std::string, int> m;
m.emplace("x", 1); m.emplace("x", 2);
auto [lo, hi] = m.equal_range("x");
for (auto it = lo; it != hi; ++it) use(it->second);  // 1 and 2
```

- **`count(key)`** returns how many entries match (0/1 for the non-multi versions, any number here).
- `erase(key)` removes **all** matching entries; erase a single duplicate via an iterator.

Use these when a key naturally maps to many values and you want them ordered — e.g. a sorted index of events by timestamp. Often a `map<Key, vector<Value>>` is a clearer alternative; choose based on whether you need per-duplicate iterator stability and range queries.

### Q9. What are the container adaptors, and what backs each?

Adaptors wrap an underlying container to expose a restricted interface:

| Adaptor | Interface | Default backing | Notes |
|---|---|---|---|
| `std::stack` | LIFO: `push`/`pop`/`top` | `std::deque` | any back-insertable container |
| `std::queue` | FIFO: `push`/`pop`/`front`/`back` | `std::deque` | needs front+back ops |
| `std::priority_queue` | max-heap: `push`/`pop`/`top` | `std::vector` | uses `std::make_heap`/`push_heap` under the hood |

They're not containers themselves — they *adapt* one, hiding iterators and exposing only the discipline you want. You can swap the backing container as a template argument:

```cpp
std::stack<int, std::vector<int>> s;         // vector-backed stack
std::priority_queue<int, std::vector<int>,
                    std::greater<int>> minHeap;  // min-heap via greater<>
```

`priority_queue` defaults to a **max**-heap (`std::less` → largest on top); pass `std::greater` to get a min-heap. Note it gives you only the top element — no iteration, no arbitrary lookup. Because adaptors expose no iterators, you can't traverse a `stack`/`queue`; if you need that, use the underlying container directly.

### Q10. Explain `std::string` and the small-string optimisation (SSO).

`std::string` is essentially a `vector<char>` with string-specific API and a null terminator guarantee — but with one crucial addition: **SSO**. Short strings (typically up to 15 bytes on 64-bit libstdc++/libc++, implementation-defined) are stored **inline inside the string object itself**, with no heap allocation. Only when the string exceeds the inline capacity does it allocate on the heap.

Why it matters:
- Constructing, copying, and destroying short strings is **allocation-free** — a huge win because most real-world strings (names, keys, tokens) are short.
- `sizeof(std::string)` is typically 24–32 bytes precisely because it reserves inline space for the buffer.
- A consequence: a `string`'s internal buffer address **changes** when it transitions from SSO to heap (or reallocates), so pointers/iterators into it are invalidated by growth just like `vector`.

This is why passing strings by `const std::string&` (or better, `std::string_view`) matters — an accidental copy of a *long* string allocates, though a short one is cheap thanks to SSO.

### Q11. Give a decision table for choosing a container.

Default to `std::vector` and deviate only for a reason. Rough guide:

| Need | Container |
|---|---|
| General-purpose sequence, indexed access, cache-friendly | `vector` |
| Fixed size known at compile time | `array` |
| Fast insert/remove at **both** ends + random access | `deque` |
| Stable element addresses + `O(1)` splice, insert anywhere | `list` |
| Same, memory-minimal, forward-only | `forward_list` |
| Keyed lookup, **sorted** iteration / range queries | `map` / `set` |
| Keyed lookup, fastest average, order irrelevant | `unordered_map` / `unordered_set` |
| Duplicate keys allowed | `multi*` variants |
| LIFO / FIFO / priority discipline | `stack` / `queue` / `priority_queue` |
| Non-owning view over contiguous data | `span` / `string_view` |

The meta-rule: **big-O is a starting filter, not the decision.** Memory layout and constant factors usually decide — `vector` beats `list` for most workloads despite worse insertion complexity, because linear scans over contiguous memory crush pointer-chasing on modern CPUs. Profile before trading `vector` away.

### Q12. Summarise iterator-invalidation rules across the containers.

The rules fall out of the memory layout:

| Container | Insertion | Erasure |
|---|---|---|
| `vector` | reallocation → **all**; else from insert point on | from erased point onward |
| `deque` | ends: iterators invalidated, **refs/ptrs survive**; middle: all | ends: only the erased; middle: all |
| `list`/`forward_list` | **nothing** invalidated | only the erased element |
| `map`/`set`/`multi*` | **nothing** invalidated | only the erased element |
| `unordered_*` | rehash → **all iterators** (refs/ptrs survive); else nothing | only the erased (iterators + refs to it) |

Two takeaways:
1. **Node-based containers** (`list`, `map`, `set`) never invalidate other elements — their whole value proposition.
2. For **contiguous/segmented** containers, growth is the danger. The classic bug is the erase-while-iterating loop:

```cpp
for (auto it = v.begin(); it != v.end(); )
    if (pred(*it)) it = v.erase(it);   // erase returns next valid iterator
    else ++it;
```

Never `++it` after an `erase` that invalidates `it`; use the returned iterator (or the erase-remove idiom / `std::erase_if` in C++20).

### Q13. What's the difference between `emplace` and `insert`?

`insert`/`push_back` take an **already-constructed object** (or something convertible to one) and copy/move it in. `emplace`/`emplace_back` take the **constructor arguments** and construct the element **in place** inside the container, forwarding the args — no intermediate temporary:

```cpp
std::vector<std::pair<int,std::string>> v;
v.push_back(std::make_pair(1, "x"));  // build pair, then move it in
v.emplace_back(1, "x");               // construct pair in place from (1,"x")

std::map<int, Widget> m;
m.emplace(42, /* Widget ctor args */);
```

When it actually helps: for types where constructing a temporary is expensive or move is non-trivial, `emplace` saves that temporary. For cheap/movable types (`int`, small structs) the difference is negligible and modern compilers often erase it.

Two caveats: (1) `emplace` uses **direct** initialisation, so it can invoke `explicit` constructors that `insert` couldn't — occasionally a source of surprise; (2) for `map`, `emplace` constructs the element **even if the key already exists** (then discards it) — `try_emplace` (C++17) avoids that wasted construction and doesn't touch the mapped value on a hit.

### Q14. What's wrong with `std::vector<bool>`?

`std::vector<bool>` is a **special-case specialisation** that packs bits (8 bools per byte) instead of storing `bool` objects. Space-efficient, but it breaks the `vector` contract because `operator[]` can't return a real `bool&` — there's no addressable `bool` to reference. Instead it returns a **proxy object**:

```cpp
std::vector<bool> v{true, false};
auto  b  = v[0];    // b is std::vector<bool>::reference (a PROXY), not bool
auto& br = v[0];    // binds to a temporary proxy — dangling/surprising
bool* p = &v[0];    // ILL-FORMED — can't take address of a bit
```

Consequences: `auto` deduces the proxy not `bool`; you can't take a pointer/real reference to an element; it doesn't satisfy the contiguous-container requirements, so it can't be handed to APIs expecting `bool*`; and generic code templated on `vector<T>` may misbehave for `T = bool`.

Fixes when you *don't* want bit-packing: use `std::vector<char>`, `std::deque<bool>`, or `std::vector<std::uint8_t>`. When you *do* want a bitset of fixed size, `std::bitset<N>` is cleaner. It's a widely regretted standardisation — treat `vector<bool>` as a distinct type, not a `vector` of `bool`.

### Q15. What are node handles (`extract`) and what problem do they solve (C++17)?

Before C++17, moving an element from one associative container to another meant a copy/move plus two allocations (erase a node here, allocate a node there), and you couldn't change a `set`/`map` key in place without erase+reinsert. **Node handles** fix both.

`extract` detaches a node from the container, returning an owning **node handle** without deallocating it; you can then `insert` that handle into another compatible container — **splicing** with no element copy and no reallocation:

```cpp
std::map<int, std::string> a{{1,"x"}}, b;
auto nh = a.extract(1);   // detach node; a no longer contains key 1
nh.key() = 2;             // mutate the key in place — impossible before!
b.insert(std::move(nh));  // move node into b as key 2, no realloc
```

Benefits:
- **Re-key without reallocation** — `nh.key()` is mutable while detached (you can't normally mutate a `map` key).
- **Move nodes between containers** cheaply (`a.merge(b)` is built on this).
- Preserves element identity — references to the element stay valid across the move.

Works for all the associative and unordered containers. It's the idiomatic C++17 way to transfer or re-key elements without paying for a copy.

### Q16. How do you supply a custom hash or comparator?

**Ordered containers** take a comparator as a template argument — anything providing a strict weak ordering:

```cpp
struct ByLength {
    bool operator()(const std::string& a, const std::string& b) const {
        return a.size() < b.size();     // order by length
    }
};
std::set<std::string, ByLength> s;
// or transparent comparators (C++14): std::set<std::string, std::less<>>
```

**Unordered containers** need a **hash** and an **equality**. For a custom key type either specialise `std::hash` or pass a functor:

```cpp
struct Point { int x, y; bool operator==(const Point&) const = default; };
struct PointHash {
    std::size_t operator()(const Point& p) const {
        return std::hash<int>{}(p.x) ^ (std::hash<int>{}(p.y) << 1);
    }
};
std::unordered_set<Point, PointHash> pts;
```

Rules that bite: the hash must be **consistent with equality** — equal keys *must* hash equal (the reverse needn't hold). A weak hash (like the XOR above, which collides `(a,b)` with `(b,a)`) degrades performance to `O(n)`; prefer a real combiner (`boost::hash_combine`-style). For ordered containers, a comparator that isn't a strict weak ordering (e.g. using `<=`) is **undefined behaviour**, not just wrong results.

### Q17. What is small-buffer / small-object optimisation, and where does the STL use it?

Small-buffer optimisation (SBO), a.k.a. small-object optimisation, stores small payloads **inline inside the object** rather than on the heap, avoiding an allocation for the common small case. It's the same idea as SSO generalised beyond strings.

Where the standard library uses it:
- **`std::string`** — SSO (Q10): short strings live inline.
- **`std::function`** — typically stores small callables (a function pointer, a small lambda capturing a couple of values) inline; only larger closures allocate. Size and threshold are implementation-defined.
- **`std::any`** — usually stores small, trivially-movable values inline.

The trade-off: inline storage makes the object **larger** (`sizeof(std::string)` ~32 bytes, `std::function` ~32) and moving it may involve copying the inline buffer rather than just swapping a pointer, but it eliminates allocation and improves locality for the common small case. It also means the inline buffer's address changes when the object moves — so you can't rely on stable addresses of the contained payload. Knowing where SBO applies explains otherwise-surprising `sizeof` values and why "just use `std::function`" isn't always free.

### Q18. What are `std::span` and `std::string_view`, and what must you watch out for?

Both are **non-owning views** — a `(pointer, length)` pair over contiguous memory that someone *else* owns:

- **`std::string_view`** (C++17) — a read-only view over character data (a `std::string`, string literal, or `char[]`). Pass it instead of `const std::string&` to accept *any* string-like source without forcing a copy or a `std::string` construction.
- **`std::span<T>`** (C++20) — a view over any contiguous range of `T` (`vector`, `array`, C array, raw buffer). The idiomatic way to take "a contiguous sequence of `T`" as a parameter without templating on the container.

```cpp
void log(std::string_view msg);      // accepts string, literal, char* — no copy
int sum(std::span<const int> xs);    // accepts vector<int>, array<int,N>, int[]
```

The critical hazard is **lifetime / dangling**: a view does *not* extend the lifetime of what it points at. If the backing store is destroyed, moved, or reallocated, the view dangles — UB on use.

```cpp
std::string_view sv = std::string("temp");   // DANGLES: temporary dies at ;
std::string_view bad() { std::string s="x"; return s; } // returns dangling view
```

Also note `string_view` is **not guaranteed null-terminated**, so never hand `.data()` to a C API expecting a C string. Rule: views are for *parameters* and short-lived borrows — never store one that can outlive its owner, and never return one referring to a local.
## STL: Iterators & Algorithms

### Summary

**What this topic covers**

The glue that makes the STL a *library* rather than a pile of containers: **iterators** — the abstraction that lets one algorithm work over a `vector`, a `list`, a `set`, or a raw array — and the `<algorithm>` / `<numeric>` header of generic functions that consume them. This topic has 16 questions spanning the six iterator categories (input, output, forward, bidirectional, random-access, and C++20 contiguous), the staple algorithms (`sort`, `find`, `accumulate`, `transform`, `for_each`, `lower_bound`, the erase-remove idiom), how predicates and comparators parameterise behaviour, output iterators like `back_inserter`, writing your own iterator, `begin`/`end` customisation points and ADL, and the two classic traps: the erase-remove bug and `std::accumulate`'s init-type pitfall. Ranges (C++20) get a preview here and full treatment in topic 17.

**Mental model**

Alexander Stepanov's design: algorithms are written once against **iterator concepts**, and containers expose iterators that model those concepts. An iterator is a generalised pointer — it supports some subset of `*it`, `++it`, `--it`, `it + n`, and comparison. The *category* an iterator models determines which algorithms accept it and at what cost. A range is a half-open pair `[first, last)`: `last` is one-past-the-end, never dereferenced, and `first == last` means empty. Algorithms don't know the container — they only touch elements through the iterator interface — which is why `std::sort` needs random-access iterators (it does `first[n]` arithmetic) and won't compile on `std::list` (which offers only bidirectional iterators and ships its own `list::sort`). Algorithms *never* resize the container: `std::remove` and `std::unique` shuffle elements and return a new logical end; you must call the container's `erase` to actually shrink it. This separation — algorithm over iterators, mutation via the container — is the single idea the whole topic rests on.

**Key terms**

- **Iterator category** — the concept an iterator models: input, output, forward, bidirectional, random-access, or contiguous (C++20). Determines allowed operations and algorithm applicability.
- **Half-open range** `[first, last)` — `last` is one-past-the-end and never dereferenced; empty when `first == last`.
- **Predicate** — a callable returning `bool` for one element (e.g. `find_if`, `remove_if`).
- **Comparator** — a callable returning `bool` defining strict-weak ordering for two elements (e.g. `sort`, `lower_bound`).
- **Erase-remove idiom** — `v.erase(std::remove(b, e, x), e)` — the two-step to actually delete matching elements from a sequence container.
- **Output iterator** — write-only, single-pass; `back_inserter`, `ostream_iterator`, `inserter` adapt a container/stream into one.
- **Iterator invalidation** — mutation that makes existing iterators/pointers dangle; rules differ per container (see topic on containers).
- **`std::sort` vs `std::stable_sort`** — introsort, `O(n log n)`, *not* stability-preserving vs merge-sort-based, stable, `O(n log n)` with extra memory (or `O(n log²n)` in place).
- **`lower_bound` / `upper_bound`** — binary search on a *sorted* range; `O(log n)` steps but `O(n)` on non-random-access iterators due to advancing.
- **ADL / customisation point** — `std::begin(x)` / range-based `for` find `begin` via argument-dependent lookup, letting your type opt in.
- **Projection (C++20)** — a per-element transform ranges algorithms apply before comparing, e.g. `ranges::sort(v, {}, &Widget::id)`.

**Why interviewers ask this**

Iterator fluency separates people who *use* the STL from people who *understand* it. Juniors call `std::sort` and `std::find`; seniors know *why* `sort` won't compile on a `list`, what "one-past-the-end" guarantees, and that `remove` doesn't remove. The erase-remove idiom is a near-universal screening question because getting it wrong is a real, shipped bug — the elements look gone in a debugger's size field but the container still holds stale tail garbage. The `accumulate` init-type question catches candidates who don't realise the *template* deduces the accumulator type from the init argument — a one-character bug (`0` vs `0.0`) that silently truncates. And "write a custom iterator" is a favourite because it forces you to name the traits (`iterator_category`, `value_type`, `difference_type`) and prove you know what the algorithms actually require.

**Common confusions**

- "`std::remove` deletes elements" — it does not. It compacts the kept elements to the front and returns the new logical end; the container size is unchanged until you `erase`.
- "`std::sort` works on any container" — only random-access ranges (`vector`, `deque`, array). `std::list` has its own `sort` member; associative containers are already ordered and immutable-key.
- "iterators are pointers" — pointers *are* contiguous iterators, but most iterators are class types; assuming pointer arithmetic on a `list` iterator won't compile.
- "`accumulate(v.begin(), v.end(), 0)` sums doubles fine" — the `0` makes the accumulator an `int`; every add truncates. Use `0.0` or `0.0L`.
- "`find` on a sorted range is fast" — `std::find` is linear regardless; use `lower_bound`/`binary_search` to exploit sortedness.
- "a comparator can return `true` for equal elements" — no. `sort`'s comparator must be a strict-weak ordering; `comp(a, a)` must be `false`, or you get UB.

**What follows from this topic**

Iterator categories are the vocabulary for the containers topic (each container advertises a category and an invalidation contract) and for **Ranges & Views (topic 17)**, which replaces iterator pairs with range objects, lazy views, and pipelines. Predicates and comparators lead directly into **lambdas and function objects**. The strict-weak-ordering requirement reappears in the associative-container key-comparison rules. And the "algorithm never resizes" principle underpins exception-safety reasoning in **topic 12 (Error Handling)** — algorithms that only rearrange give you strong guarantees more easily than ones that allocate.

### Q1. What are the iterator categories, and why do they matter?

Six categories, each a refinement of the previous (C++20 adds contiguous and reframes them as concepts):

| Category | Key operations | Example source |
|---|---|---|
| **Input** | `*it` (read), `++it`, single-pass | `istream_iterator` |
| **Output** | `*it = x` (write), `++it`, single-pass | `back_inserter`, `ostream_iterator` |
| **Forward** | input + multi-pass, `==` | `forward_list` |
| **Bidirectional** | forward + `--it` | `list`, `set`, `map` |
| **Random-access** | bidirectional + `it + n`, `it[n]`, `<` | `deque` |
| **Contiguous** (C++20) | random-access + elements physically adjacent (`&*(it+n) == &*it + n`) | `vector`, `array`, `string`, raw pointer |

They matter because **algorithms are constrained by the weakest category they need**. `std::sort` needs random-access; `std::reverse` needs bidirectional; `std::find` needs only input. Pass a weaker iterator than required and you get a compile error (a *feature* — it's the concept check firing). Category also predicts cost: `std::distance` is `O(1)` on random-access, `O(n)` on bidirectional.

### Q2. Why does `std::sort` fail to compile on a `std::list`, and what do you use instead?

`std::sort` requires **random-access iterators** — internally it does `first[n]`, `first + n`, and iterator subtraction for its introsort partitioning. `std::list` only provides **bidirectional** iterators (you can `++`/`--` but not jump). The concept check fails at compile time.

Use the member function `list.sort()`, which is a merge sort that relinks nodes (no element moves, `O(n log n)`, stable). Same for `forward_list::sort`. Associative containers (`set`, `map`) are already sorted and you can't reorder them — the key ordering is an invariant.

```cpp
std::list<int> l{3, 1, 2};
// std::sort(l.begin(), l.end());  // ❌ won't compile
l.sort();                          // ✅ member sort
```

### Q3. Walk through the erase-remove idiom. What bug does forgetting it cause?

`std::remove(first, last, value)` does **not** remove anything — it can't, algorithms don't own the container. It moves the elements you want to *keep* to the front, preserving their order, and returns an iterator to the new logical end. Everything from there to `last` is unspecified (moved-from) garbage. To actually shrink the container you call `erase`:

```cpp
std::vector<int> v{1, 2, 3, 2, 4, 2};
v.erase(std::remove(v.begin(), v.end(), 2), v.end());  // v == {1, 3, 4}
// C++20: std::erase(v, 2);  // one-liner, same effect
```

The bug from forgetting the `erase`: `std::remove` alone returns a discarded iterator, leaves `v.size()` at 6, and the tail still holds `{4, 2}` (or moved-from junk). Code that iterates by `size()` then processes phantom trailing elements. C++20's free `std::erase(v, val)` / `std::erase_if(v, pred)` exist precisely to remove this footgun.

### Q4. What's the difference between a predicate and a comparator?

A **predicate** is a unary callable returning `bool` — "does this one element qualify?" Used by `find_if`, `count_if`, `remove_if`, `partition`, `all_of`.

A **comparator** is a *binary* callable returning `bool` defining an ordering — "does `a` come before `b`?" Used by `sort`, `stable_sort`, `lower_bound`, `set`/`map` (as a template parameter), `priority_queue`.

```cpp
auto isEven = [](int x){ return x % 2 == 0; };            // predicate
auto byLen  = [](const std::string& a, const std::string& b){ return a.size() < b.size(); }; // comparator

std::count_if(v.begin(), v.end(), isEven);
std::sort(words.begin(), words.end(), byLen);
```

The comparator must model a **strict weak ordering**: irreflexive (`comp(a,a) == false`), antisymmetric, transitive. Violate it — e.g. `<=` instead of `<` — and `std::sort` is undefined behaviour (can crash or corrupt memory in libstdc++'s debug mode it asserts).

### Q5. What does `std::back_inserter` do, and when do you need it?

`std::back_inserter(c)` returns an **output iterator** that turns `*it = x` into `c.push_back(x)`. You need it whenever an algorithm writes to a destination that must *grow* — the raw destination iterator form assumes the output range already has room.

```cpp
std::vector<int> src{1, 2, 3}, dst;
std::copy(src.begin(), src.end(), std::back_inserter(dst));   // dst grows to {1,2,3}
// std::copy(src.begin(), src.end(), dst.begin());            // ❌ UB: dst is empty, writes past end
```

Siblings: `front_inserter` (→ `push_front`, for `list`/`deque`), `inserter(c, pos)` (→ `insert`, works for `set`/`map`), and `ostream_iterator<T>(os, sep)` to stream results out.

### Q6. What does this print?

```cpp
std::vector<double> v{1.5, 2.5, 3.0};
double s = std::accumulate(v.begin(), v.end(), 0);
std::cout << s;
```

It prints **6**, not 7. The init value `0` is an `int`, so `accumulate`'s accumulator type is deduced as `int`. Each addition does `int + double → double`, then assigns back into the `int` accumulator, truncating: `0 + 1.5 = 1`, `1 + 2.5 = 3`, `3 + 3.0 = 6`.

Fix by making the init type match: `std::accumulate(v.begin(), v.end(), 0.0)`. This is a classic screening bug — the accumulator type is deduced *solely* from the third argument, never from the element type. Same trap with `std::reduce` and any templated fold.

### Q7. How do `lower_bound` and `upper_bound` work, and what's the gotcha on a `std::list`?

On a **sorted** range, `lower_bound(first, last, val)` returns the first position where `val` could be inserted without breaking order — the first element `>= val`. `upper_bound` returns the first element `> val`. Together they bracket the equal-range `[lower, upper)`.

They do `O(log n)` **comparisons** via binary search — but they advance iterators to reach the midpoint. On random-access iterators that's `O(1)` per step, so `O(log n)` total. On a `std::list` (bidirectional), advancing is `O(n)`, making the whole call `O(n)` — the binary search's advantage evaporates. That's why you binary-search on `vector`, and for a `list`-like structure you'd use `set`/`map` (which do their own `O(log n)` tree lookup via `set::lower_bound`).

```cpp
std::vector<int> v{1, 3, 3, 5, 7};
auto lo = std::lower_bound(v.begin(), v.end(), 3);  // → index 1
auto hi = std::upper_bound(v.begin(), v.end(), 3);  // → index 3
```

### Q8. `std::sort` vs `std::stable_sort` — when does the difference matter?

`std::sort` is introsort (quicksort + heapsort fallback + insertion sort for small ranges), `O(n log n)`, in place, but **not stable** — equal elements may be reordered. `std::stable_sort` preserves the relative order of equal elements, `O(n log n)` with `O(n)` extra memory (falls back to `O(n log²n)` in place if allocation fails).

It matters for **multi-key sorting** done in passes: to sort by department then by name-within-department, `stable_sort` by name first, then `stable_sort` by department — stability keeps the name order intact within each department. With plain `sort` the second pass would scramble the first. If your comparator already encodes the full ordering (e.g. compare a `tuple`), you don't need stability and `sort` is faster.

### Q9. Write a minimal forward iterator for a custom range type.

You expose `begin()`/`end()` and give the iterator the traits algorithms query:

```cpp
struct IntRange {
    int lo, hi;
    struct iterator {
        using iterator_category = std::forward_iterator_tag;
        using value_type        = int;
        using difference_type   = std::ptrdiff_t;
        using pointer           = const int*;
        using reference         = int;
        int cur;
        int operator*() const { return cur; }
        iterator& operator++() { ++cur; return *this; }
        iterator operator++(int) { auto t = *this; ++cur; return t; }
        bool operator==(const iterator& o) const { return cur == o.cur; }
        bool operator!=(const iterator& o) const { return cur != o.cur; }
    };
    iterator begin() const { return {lo}; }
    iterator end()   const { return {hi}; }
};
// for (int x : IntRange{0, 5}) ...   // 0 1 2 3 4
```

The five traits (`iterator_category`, `value_type`, `difference_type`, `pointer`, `reference`) let `std::iterator_traits` and the algorithms introspect your type. Get the category wrong (claim `random_access` without `+`/`[]`) and algorithms will fail to compile or, worse, mis-dispatch. In C++20 you'd instead satisfy the `std::forward_iterator` concept, which checks these requirements directly.

### Q10. How does range-based `for` find `begin` and `end`? Why does ADL matter?

`for (auto x : range)` desugars (roughly) to:

```cpp
auto&& __r = range;
auto __b = begin(__r);   // member r.begin() if it exists, else free begin() via ADL
auto __e = end(__r);
for (; __b != __e; ++__b) { auto x = *__b; ... }
```

The lookup prefers a **member** `begin()`/`end()`; if absent it does an **argument-dependent-lookup (ADL)** call to a free `begin(__r)`/`end(__r)`, with `std::begin`/`std::end` in scope. This is why C arrays work in range-`for` (`std::begin(arr)` returns `arr`, `std::end` returns `arr + N`) and why you can retrofit iteration onto a third-party type by writing free `begin`/`end` in *its* namespace. Best practice when writing generic code: `using std::begin; using std::end;` then call unqualified `begin(x)` so both member-providing and ADL-providing types resolve.

### Q11. What does `std::transform` do, and how does it differ from `std::for_each`?

`std::transform` maps a range to an output range through a function, writing results: `dst[i] = f(src[i])`. It has a two-range overload for binary ops: `dst[i] = f(a[i], b[i])`. It returns the output end iterator and does not guarantee order of application (so `f` should be pure).

`std::for_each` invokes a function for each element **for its side effects** and discards any return value; it guarantees in-order traversal.

```cpp
std::vector<int> in{1, 2, 3}, out;
std::transform(in.begin(), in.end(), std::back_inserter(out), [](int x){ return x * x; }); // out = {1,4,9}
std::for_each(in.begin(), in.end(), [](int x){ std::cout << x; });                          // side effect
```

Rule of thumb: `transform` when you're building a new sequence, `for_each` when you're doing I/O or accumulating into captured state. In modern code both often give way to ranges pipelines (`in | std::views::transform(...)`).

### Q12. Can you sort in place and pass a lambda comparator that captures? Any pitfalls?

Yes — `std::sort` takes any callable, including a capturing lambda:

```cpp
std::vector<Widget> ws = ...;
int pivot = threshold;
std::sort(ws.begin(), ws.end(),
          [pivot](const Widget& a, const Widget& b){ return a.rank(pivot) < b.rank(pivot); });
```

Pitfalls: (1) the comparator is **called many times**, so keep it cheap and side-effect-free — mutating captured state during sort gives unpredictable results. (2) It must be a **strict weak ordering**; a capturing lambda doesn't change that requirement. (3) Comparing on a *derived* value recomputed each call (like `a.rank(pivot)`) can be expensive — if it's costly, precompute keys and sort those, or use a C++20 **projection**: `std::ranges::sort(ws, std::less{}, [pivot](const Widget& w){ return w.rank(pivot); })`, which computes the key per element rather than per comparison.

### Q13. What are projections in C++20 ranges algorithms?

A **projection** is an extra callable that ranges algorithms apply to each element *before* the comparator/predicate sees it — it decouples "what to compare by" from "how to compare". Nearly every `std::ranges::` algorithm takes an optional trailing projection:

```cpp
struct Widget { int id; std::string name; };
std::vector<Widget> v = ...;
std::ranges::sort(v, {}, &Widget::id);              // sort by id, default (<) comparator
auto it = std::ranges::find(v, "foo", &Widget::name); // find where name == "foo"
std::ranges::max(v, {}, &Widget::id);                 // widget with largest id
```

The `{}` is `std::ranges::less` (the default). Projections can be member pointers, member-function pointers, or lambdas. The win: you write the comparator once (`less`) and vary the key, instead of writing a bespoke lambda `[](a,b){ return a.id < b.id; }` every time. This previews the ergonomics covered fully in **topic 17 (Ranges & Views)**.

### Q14. What's an output iterator, and why can't you read through one?

An **output iterator** supports `*it = value` and `++it`, is **single-pass**, and gives *no* guarantee you can read back what you wrote or revisit a position. `std::back_inserter`, `std::ostream_iterator`, and `std::inserter` are output iterators — the "position" they represent is really "the next write goes to `push_back`/`insert`/the stream".

You can't read through one because the underlying target may have no readable position at all: an `ostream_iterator` writes to `std::cout`, where reading is meaningless. Algorithms that only ever *write* their output (`copy`, `transform`, `generate_n`) are specified against output iterators precisely so they accept these adapters. If an algorithm needs to re-read or seek the output (rare), it demands forward-or-better instead.

### Q15. `std::find` returns an iterator — how do you know if it found nothing, and what's the classic mistake?

`std::find` (and `find_if`, `lower_bound` when nothing matches, etc.) signals "not found" by returning the **end iterator** of the searched range — never a null pointer. You must compare against the *same* range's `end()`:

```cpp
auto it = std::find(v.begin(), v.end(), target);
if (it != v.end()) { use(*it); }   // ✅
```

Classic mistakes: (1) dereferencing without the check — `*std::find(...)` is UB when not found, since it dereferences `end()`. (2) Comparing against a *different* container's `end()`. (3) With `lower_bound`, forgetting it returns the insertion point even on a miss — you must also check `it != end() && *it == target`, because `lower_bound` returns non-end when a *larger* element exists. Only `binary_search` gives you a plain `bool`.

### Q16. Give a one-line preview of what ranges (C++20) change about this whole model.

Ranges replace the **iterator-pair** interface (`algo(v.begin(), v.end(), ...)`) with **range objects** (`std::ranges::algo(v, ...)`) plus **lazy views** you compose with `|`:

```cpp
auto result = v | std::views::filter([](int x){ return x % 2; })
                | std::views::transform([](int x){ return x * x; })
                | std::views::take(3);
```

Three shifts: (1) pass a range, not two iterators — fewer mismatched-range bugs; (2) **views are lazy** — nothing is computed until you iterate, and no intermediate container is allocated; (3) algorithms gain **projections** and stricter **concept** constraints, so errors are caught earlier with clearer messages. Full treatment — view lifetime traps, `views::owning_view`, dangling, and the pipe operator internals — is in **topic 17**.

## Inheritance, Polymorphism & Virtual Dispatch

### Summary

**What this topic covers**

How C++ does object-oriented programming at the machine level, and the design judgement around it. This topic has 16 questions covering the three inheritance access modes (public/protected/private), the mechanics of **virtual dispatch** (vtable, vptr, how a `virtual` call actually resolves), **virtual destructors** (the single most-asked C++ safety question), pure-virtual functions and abstract classes, the `override`/`final` specifiers, **object slicing**, `dynamic_cast` and RTTI cost, **multiple inheritance** and the diamond problem with its `virtual` inheritance fix, the trap of calling virtuals from constructors/destructors, covariant return types, the **NVI (non-virtual interface) idiom**, static-vs-dynamic dispatch cost, `typeid`, and — running through all of it — *when to prefer composition over inheritance*.

**Mental model**

A class with any `virtual` function gets, per object, a hidden pointer (**vptr**) to a per-class table of function pointers (**vtable**). A virtual call `p->f()` compiles to: load the vptr from `*p`, index the vtable to find `f`'s entry, call through it. So dispatch is decided by the object's **dynamic type** (what it actually is), not its **static type** (what the pointer/reference is declared as). Non-virtual calls are resolved at compile time from the static type — no indirection. This is the whole game: `virtual` = "decide at runtime based on the real object"; non-`virtual` = "decide now based on the declared type". Inheritance in C++ is **implementation inheritance** (you get the base's data and code) *and*, when public, an **is-a subtype** relationship the compiler enforces. Because C++ objects have value semantics — they live on the stack, get copied by value — polymorphism only works through **pointers or references** to a base. Copy a `Derived` into a `Base` value and you *slice* off everything derived. That value-semantics-plus-vtables combination is what makes C++ inheritance sharp-edged in ways garbage-collected languages aren't.

**Key terms**

- **vtable / vptr** — per-class table of virtual function pointers; per-object hidden pointer to it. The dispatch mechanism.
- **Static vs dynamic type** — declared type of the expression vs actual type of the object it refers to.
- **Virtual function** — dispatched on dynamic type; overridable; costs one indirection.
- **Pure virtual** (`= 0`) — declares an interface slot with no (required) definition; makes the class **abstract** (non-instantiable).
- **Virtual destructor** — required in a base you delete polymorphically, or `delete base_ptr` is UB / leaks the derived part.
- **Object slicing** — copying a derived object into a base *value*, discarding the derived state and vptr.
- **`override`** — compiler-checked "this overrides a base virtual"; catches signature typos.
- **`final`** — bans further overriding (on a method) or derivation (on a class); can enable devirtualisation.
- **`dynamic_cast`** — runtime-checked down/cross-cast in a polymorphic hierarchy; returns `nullptr` (pointers) or throws `bad_cast` (references) on failure.
- **RTTI** — run-time type information (`typeid`, `dynamic_cast`); costs a little space and, for `dynamic_cast`, runtime.
- **Diamond problem** — two base subobjects of the same grandparent; resolved by **virtual inheritance** to share one subobject.
- **NVI idiom** — public non-virtual method wraps a private virtual, centralising pre/post logic while keeping the customisation point virtual.

**Why interviewers ask this**

This is the densest cluster of "shipped a real bug" questions in C++. The virtual-destructor question is nearly universal because omitting one is undefined behaviour that a beginner writes naturally. Slicing is asked because it's silent — no warning, no crash, just quietly wrong behaviour. The vtable question ("what does `virtual` cost / how does it work") separates people who treat OOP as syntax from people who know the object layout. The calling-virtuals-from-a-constructor gotcha is a favourite because the answer is counter-intuitive (dispatch uses the *base's* override, not the derived one). And the composition-over-inheritance discussion tests design maturity: seniors reach for inheritance only for genuine runtime substitutability and prefer composition, templates, or `std::function` for reuse.

**Common confusions**

- "Every base class needs a virtual destructor" — only bases you delete **polymorphically** through a base pointer. A base used only as a private mixin or never heap-deleted through a base pointer doesn't.
- "`override` changes behaviour" — no; it's a compile-time *check*. Without it a signature typo silently creates a new non-overriding function.
- "Slicing is a compile error" — it's silent and legal; `Base b = derived;` compiles and slices.
- "`virtual` calls in a constructor dispatch to the derived override" — they don't; during base construction the object *is* a base, so the base version runs.
- "`dynamic_cast` and `static_cast` are interchangeable down a hierarchy" — `static_cast` down is unchecked (UB if wrong); `dynamic_cast` is runtime-verified.
- "Multiple inheritance is always evil / always fine" — neither; interface (pure-virtual) multiple inheritance is clean, multiple inheritance of *state* is where the diamond and ambiguity pain lives.

**What follows from this topic**

Virtual destructors and slicing feed directly into **smart pointers and ownership** (`unique_ptr<Base>` needs a virtual `~Base`; `shared_ptr` sidesteps it via a type-erased deleter). RTTI and `dynamic_cast` connect to `std::variant`/`std::visit` as the closed-set alternative to open polymorphism. NVI and "prefer composition" preview the **design-patterns** material (Template Method, Strategy, type erasure). The vtable cost model reappears in **performance** discussions (devirtualisation, `final`, avoiding virtual in hot loops). And the exception-safety of destructors links straight to **topic 12** — a throwing destructor in a polymorphic hierarchy is doubly dangerous.

### Q1. How does a virtual function call actually work at the machine level?

Any class with a virtual function gets a per-class **vtable**: an array of function pointers, one slot per virtual function. Each *object* of that class carries a hidden **vptr** (usually first in the layout) pointing at its class's vtable. A call `p->f()` where `f` is virtual compiles to roughly:

```
load  vptr   = *(p)            ; hidden pointer at start of object
load  target = vptr[index_of_f]; fixed slot per virtual function
call  target(p, ...)           ; pass p as 'this'
```

So the resolution depends on the **dynamic type** — the object's real class sets the vptr at construction, so even through a `Base*` you reach `Derived::f`. Cost: one extra memory load (the vtable lookup) and an indirect call the branch predictor and inliner usually can't see through. Non-virtual calls skip all this — the target address is baked in at compile time from the static type.

### Q2. When do you need a virtual destructor, and what happens if you omit it?

You need `virtual ~Base()` whenever you **delete a derived object through a base pointer**. If the destructor isn't virtual, `delete basePtr` calls only `~Base` — the derived destructor never runs, so derived members leak (and any derived-only cleanup is skipped). Formally it's **undefined behaviour**.

```cpp
struct Base { ~Base() {} };                 // non-virtual!
struct Derived : Base { std::vector<int> big; };
Base* p = new Derived;
delete p;                                    // UB: ~Derived never runs, big leaks
```

Fix: `virtual ~Base() = default;`. Rule of thumb: **if a class has any virtual function, give it a virtual destructor** — you're clearly using it polymorphically. Exceptions: a base you never delete through a base pointer (e.g. a private-inheritance mixin, or one you only ever hold by value) doesn't strictly need it, and `shared_ptr<Base>` created from a `Derived` sidesteps it because it stores a type-erased deleter that remembers the real type.

### Q3. What is object slicing? Show it.

Slicing happens when you copy a derived object into a **base value** — the derived portion (extra members *and* the polymorphic behaviour) is sliced off, because a `Base` value only has room for `Base`.

```cpp
struct Base { virtual std::string who() const { return "Base"; } };
struct Derived : Base { std::string who() const override { return "Derived"; } };

Derived d;
Base b = d;             // slice: b is a plain Base
std::cout << b.who();   // "Base" — vptr is Base's, derived state gone

void take(Base b);      // by value → slices any Derived argument
take(d);                // "Base" behaviour inside
```

It's silent — no error, no warning by default. Prevent it by passing/holding polymorphic objects through **references or pointers** (`const Base&`, `Base*`, `unique_ptr<Base>`), and consider deleting the base copy operations or making the base abstract so a bare `Base` value can't exist.

### Q4. What's the difference between public, protected, and private inheritance?

They control (a) the access level inherited members get in the derived class's *clients*, and (b) whether the is-a relationship is visible:

| Mode | `public` base members become | Meaning |
|---|---|---|
| **public** | `public` in derived | **is-a** — `Derived` is substitutable for `Base` (the normal case) |
| **protected** | `protected` | implemented-in-terms-of, exposed to further derived classes |
| **private** | `private` | **implemented-in-terms-of** — reuse base's code, but *not* a subtype |

Only **public** inheritance models subtyping — a `Derived*` implicitly converts to `Base*` and virtual dispatch is usable by outside code. Private/protected inheritance say "I'm reusing Base's implementation" and block the outside conversion. In practice private inheritance is rare — composition ("has-a") usually expresses the same reuse more clearly. Reach for private inheritance only when you need to override a virtual of the base or access its protected members.

### Q5. What do `override` and `final` do, and why should you always use `override`?

`override` is a compile-time assertion that the function *does* override a base virtual with a matching signature. Without it, a typo silently creates a brand-new function:

```cpp
struct Base { virtual void f(int) const; };
struct Derived : Base {
    void f(int);         // ❌ silently NOT an override (missing const) — new function!
    void f(int) const override;  // ✅ compiler enforces it really overrides
};
```

The first line compiles fine without `override` and you get a baffling bug where the base version keeps getting called. `override` turns that into a compile error. **Always write it** on overriding functions.

`final` bans further overriding (`void f() final;`) or, on a class (`struct S final`), bans derivation. Beyond intent, `final` lets the compiler **devirtualise** — if it knows no further override exists, it can resolve the call statically and even inline it.

### Q6. What does this print, and why?

```cpp
struct Base {
    Base() { init(); }
    virtual void init() { std::cout << "Base::init\n"; }
};
struct Derived : Base {
    void init() override { std::cout << "Derived::init\n"; }
};
int main() { Derived d; }
```

It prints **`Base::init`**. During `Base`'s constructor the object is still only a `Base` — the derived part isn't constructed yet, and the vptr points at `Base`'s vtable. So the virtual call resolves to `Base::init`, *not* the override. (Same in destructors, in reverse: by the time `~Base` runs, the derived part is already destroyed, so a virtual call there also uses the base version.)

This is by design — calling the derived override would touch uninitialised derived state. The lesson: **never rely on virtual dispatch during construction or destruction.** If you need derived-specific setup, do it in the derived constructor body or use a two-phase `init()` called after construction (or the NVI/factory pattern).

### Q7. How does `dynamic_cast` work, and what does it cost?

`dynamic_cast<Derived*>(basePtr)` performs a **runtime-checked** down- or cross-cast in a polymorphic hierarchy (the source type must have at least one virtual function). It consults **RTTI** attached to the vtable to verify the object's real type:

- On pointers: returns the cast pointer on success, `nullptr` on failure — so you branch on the result.
- On references: throws `std::bad_cast` on failure (no null reference to return).

```cpp
if (auto* d = dynamic_cast<Derived*>(base)) { d->derivedOnly(); }  // safe, checked
auto& r = dynamic_cast<Derived&>(*base);                            // throws bad_cast if wrong
```

Cost: it walks type-info structures, so it's slower than a `static_cast` (which is a compile-time, unchecked pointer adjustment). In hot paths, frequent `dynamic_cast` is a design smell — it usually means a `virtual` function or a `std::variant` + `visit` would model the "what type is this really" question better. `static_cast` down is faster but **unchecked** — UB if the object isn't actually that type.

### Q8. Explain the diamond problem and how virtual inheritance fixes it.

If `B` and `C` both derive from `A`, and `D` derives from both `B` and `C`, then `D` contains **two** `A` subobjects — one via `B`, one via `C`. This is ambiguous (`d.aMember` — which one?) and wasteful.

```cpp
struct A { int x; };
struct B : A {};
struct C : A {};
struct D : B, C {};   // D has TWO A::x — d.x is ambiguous
```

**Virtual inheritance** makes `A` a shared, single subobject:

```cpp
struct B : virtual A {};
struct C : virtual A {};
struct D : B, C {};   // one shared A; d.x is unambiguous
```

Now `D` has exactly one `A`. Cost: virtual bases add an indirection to reach the shared subobject (the layout uses an offset lookup), and `D`'s constructor becomes responsible for constructing the shared `A` directly. The canonical real-world case is `iostream`'s hierarchy (`basic_iostream` virtually inheriting `basic_istream` and `basic_ostream` from a shared `basic_ios`). In application code, prefer keeping shared state as a *member* (composition) over diamond hierarchies.

### Q9. What is the NVI (non-virtual interface) idiom?

Make the **public** interface non-virtual and delegate to **private virtual** implementation hooks. Clients call the stable non-virtual method; derived classes customise only the hook.

```cpp
class Report {
public:
    void generate() {                 // public, non-virtual: fixed skeleton
        writeHeader();
        doGenerate();                 // the customisation point
        writeFooter();
    }
    virtual ~Report() = default;
private:
    virtual void doGenerate() = 0;    // private virtual: overridden by subclasses
    void writeHeader() { /* shared */ }
    void writeFooter() { /* shared */ }
};
```

Benefits: the base owns the *invariant* parts (pre/post logic, locking, logging, argument validation) in one place, while subclasses can't accidentally skip them; you can change the wrapper without touching every override. It's the C++ spelling of the **Template Method** pattern. (Yes, a private virtual can still be overridden by a derived class — access control and virtual dispatch are orthogonal.)

### Q10. What are covariant return types?

An override may return a type **more derived** than the base version's return type, as long as it's a pointer or reference in the same hierarchy. The classic use is polymorphic `clone`:

```cpp
struct Shape {
    virtual Shape* clone() const { return new Shape(*this); }
};
struct Circle : Shape {
    Circle* clone() const override { return new Circle(*this); }  // covariant: Circle* not Shape*
};
```

`Circle::clone` overrides `Shape::clone` even though the return type differs, because `Circle*` is-a `Shape*`. Callers holding a `Circle*` get a `Circle*` back without a cast; callers through `Shape*` still get a `Shape*`. Covariance is limited to pointers/references (not values, and not smart pointers — `unique_ptr<Circle>` is *not* covariant with `unique_ptr<Shape>`, which is a common frustration; you work around it with a non-virtual public `clone` wrapping a virtual that returns a raw pointer).

### Q11. What is the runtime cost of virtual dispatch versus a non-virtual call?

A non-virtual call has a compile-time-known target: the compiler can inline it, propagate constants through it, and the CPU pipelines it perfectly. A virtual call costs:

1. A **load** of the vptr from the object.
2. A **load** of the target from the vtable slot.
3. An **indirect call** the inliner usually can't see through and the branch predictor may mispredict.

In a tight loop calling a tiny virtual function per element, this can be several times slower than the non-virtual equivalent — not from the two loads (often cache-hot) but from **lost inlining and optimisation** across the call boundary. Mitigations: mark leaf classes/methods `final` (enables devirtualisation), hoist the type check out of the loop, or replace open polymorphism with a `std::variant` + `std::visit` (closed set, often devirtualised) or templates (static dispatch) in hot code. But **measure first** — for anything I/O-bound or called infrequently, virtual dispatch cost is noise, and its flexibility is worth it.

### Q12. `static_cast` vs `dynamic_cast` for downcasting — when is each right?

Both convert a `Base*`/`Base&` to `Derived*`/`Derived&`, but with opposite trade-offs:

| | `static_cast` | `dynamic_cast` |
|---|---|---|
| Check | none (compile-time only) | runtime-verified via RTTI |
| Wrong type | **undefined behaviour** | `nullptr` (ptr) / `bad_cast` (ref) |
| Cost | ~free (pointer adjust) | RTTI walk |
| Needs polymorphic base | no | yes (base must have a virtual) |

Use `static_cast` only when you **already know** the dynamic type (e.g. you just checked a discriminator, or it's a CRTP/`this`-downcast where the relationship is guaranteed). Use `dynamic_cast` when the type is genuinely uncertain and you must branch on it safely. If you find yourself `dynamic_cast`-ing all over, that's usually a sign the design wants a virtual function instead.

### Q13. What is `typeid` and how does it differ from `dynamic_cast`?

`typeid(expr)` yields a `const std::type_info&` describing a type. On a **polymorphic** expression (one whose static type has a virtual function) it inspects the **dynamic** type at runtime; on a non-polymorphic expression it's resolved statically. You compare results with `==` or read `.name()` (implementation-mangled).

```cpp
Base* p = new Derived;
if (typeid(*p) == typeid(Derived)) { ... }   // exact dynamic-type match
std::cout << typeid(*p).name();               // implementation-defined string
```

Key difference from `dynamic_cast`: `typeid` checks for an **exact** type match, whereas `dynamic_cast` succeeds for any type **in the correct direction of the hierarchy** (a `Derived` is-a `Base`, and `dynamic_cast<Middle*>` succeeds if the real type derives from `Middle`). Also note `typeid(*p)` where `p` is null throws `std::bad_typeid`. Both rely on RTTI, which `-fno-rtti` disables.

### Q14. What is a pure virtual function, and can it have a definition?

`virtual void f() = 0;` declares a **pure virtual** — an interface slot the class refuses to define (or defines only as a default). It makes the class **abstract**: you cannot instantiate it directly, only derive from it and override `f`. A hierarchy's abstract base is the C++ way to express an interface.

Surprisingly, a pure virtual **can** still have a definition, called explicitly:

```cpp
struct Base {
    virtual void f() = 0;    // pure — Base is abstract
};
void Base::f() { /* shared default logic */ }   // legal!

struct Derived : Base {
    void f() override { Base::f(); /* extend */ }  // call the pure virtual's body
};
```

This lets you force overriding (subclasses *must* provide `f`) while still offering common logic they can opt into via `Base::f()`. A pure virtual **destructor** is the idiom for "abstract base with no other pure virtuals" — but it *must* have a definition, since the derived destructor always calls it.

### Q15. When should you prefer composition over inheritance?

Default to **composition** (has-a: hold the other object as a member and delegate) and reserve **public inheritance** for genuine **is-a substitutability** where you need runtime polymorphism through a base pointer. Prefer composition when:

- You want to reuse an implementation but the types aren't substitutable (a `Stack` is *not* a `Vector` even if built on one — inheriting exposes `Vector`'s whole interface, breaking the abstraction).
- The relationship can change at runtime (composition lets you swap the held object; inheritance is fixed at compile time).
- You'd otherwise inherit from a class with a non-virtual destructor or a fat interface.
- You only need to customise behaviour — inject a `std::function` or a strategy object instead of subclassing.

Inheritance couples you to the base's implementation and interface, invites slicing and the fragile-base-class problem, and can't be changed after construction. The Liskov test: if a `Derived` can't stand in for a `Base` *everywhere* without surprising callers, it's not an is-a — use composition. This judgement is what interviewers probe to gauge design seniority.

### Q16. If a class has virtual functions but you make its destructor non-virtual and mark the class `final`, is that safe?

Marking the class `final` means nothing derives from it, so there's no "delete derived through base pointer" scenario **for this class** — the classic virtual-destructor UB can't arise *below* it. But it's still unsafe if **this class itself** is deleted through a pointer to *its* base:

```cpp
struct Base { virtual void f(); ~Base(); };          // non-virtual dtor
struct Leaf final : Base { std::vector<int> data; };
Base* p = new Leaf;
delete p;   // still UB — ~Base is non-virtual, ~Leaf never runs
```

`final` on `Leaf` doesn't help because the danger is at the `Base` level. The rule stands: **the class you delete through needs the virtual destructor.** `final` is useful for *devirtualisation* (the compiler knows `Leaf`'s virtuals can't be overridden further, so calls on a known `Leaf` can be resolved statically) and for expressing "don't extend this" — but it's not a substitute for a virtual destructor in a polymorphic base.

## Error Handling & Exceptions

### Summary

**What this topic covers**

How C++ reports and recovers from failures, and — just as important — the design judgement of *which* mechanism to use. This topic has 16 questions covering exception mechanics (`throw`/`catch`, **stack unwinding**), the **exception-safety guarantees** (nothrow / strong / basic / none), **RAII** as the backbone of exception safety, `noexcept` and its effect on moves and containers, the never-throw-from-a-destructor rule, the **zero-cost** exception model, the `std::exception` hierarchy, catching by `const&`, rethrowing, and the modern alternatives — error codes, `std::optional`, `std::variant`, `std::error_code`/`std::system_error`, and C++23's `std::expected`. It closes with the real-world constraints: exceptions across ABI boundaries and `-fno-exceptions` environments (embedded, some game engines).

**Mental model**

An exception is a non-local transfer of control: `throw x` copies/moves `x` into a runtime-managed region, then **unwinds** the stack — destroying every automatic object between the throw and the matching `catch`, in reverse construction order — until it finds a handler whose type matches. This is why **RAII is the mechanism, not just a convention**: unwinding runs destructors, so any resource owned by a stack object (memory, lock, file, socket) is released automatically, on *every* exit path, exception or not. If unwinding reaches a destructor that itself throws while an exception is already propagating, or finds no matching handler, `std::terminate` is called. The exception-safety guarantees describe what an operation promises if it throws partway: **nothrow** (never fails), **strong** (commit-or-rollback — state unchanged on failure), **basic** (no leaks, invariants intact, but state may have changed), **none** (all bets off — avoid). Modern C++ increasingly encodes "expected failure" in the *type system* — `optional`, `expected`, `error_code` — reserving exceptions for genuinely exceptional, rarely-taken paths where the zero-cost model shines.

**Key terms**

- **Stack unwinding** — destroying automatic objects between `throw` and `catch`, in reverse order, running their destructors.
- **RAII** — resource acquisition is initialisation; a class ties resource lifetime to object lifetime, making cleanup exception-safe automatically.
- **Exception-safety guarantees** — **nothrow** / **strong** (rollback) / **basic** (no leak, valid state) / **none**.
- **`noexcept`** — a promise a function won't throw; violating it calls `terminate`. Enables optimisations and container move-vs-copy decisions.
- **Zero-cost model** — no runtime overhead on the non-throwing path; cost is paid only when an exception is actually thrown (table-driven unwinding).
- **`std::exception`** — base of the standard exception hierarchy; `what()` returns a message.
- **`std::error_code` / `std::system_error`** — value-based error reporting (an `int` + category); `system_error` is the exception wrapper around it.
- **`std::optional<T>`** — "value or nothing"; models absence, not error detail.
- **`std::expected<T, E>`** (C++23) — "value or error `E`"; error handling as a return value, no throw.
- **`std::variant`** — sum type; one way to return "value or one of several error types".
- **Throwing destructor** — a destructor that lets an exception escape; during unwinding this calls `terminate`. Effectively never do it.
- **`-fno-exceptions`** — build mode that disables exceptions entirely (embedded, some game/HFT code); the standard library then `terminate`s where it would throw.

**Why interviewers ask this**

Exception safety is where "writes code that works" meets "writes code that survives failure." Juniors write the happy path; seniors reason about *what happens if line 3 of 5 throws*. The RAII question is foundational — if you can't explain why `std::lock_guard` beats a manual `unlock()`, you'll write leaky code. The strong-vs-basic guarantee question probes whether you can design a transactional operation (copy-and-swap). `noexcept` on move constructors is a subtle, high-value question: `std::vector` *copies* instead of *moves* on reallocation if your move constructor isn't `noexcept`, silently tanking performance. And the "exceptions vs error codes vs `expected`" discussion tests whether you know the modern C++ direction — that not every failure deserves a throw.

**Common confusions**

- "Exceptions are slow" — only on the *throw* path. The happy path is zero-cost (no branch, no register save) under the table-driven model. Slow only if you throw in a hot loop.
- "`try`/`catch` has runtime overhead even when nothing throws" — no; the modern model puts the cost entirely in out-of-line unwinding tables.
- "Catch by value is fine" — it slices polymorphic exceptions and copies; catch by `const&`.
- "A `noexcept` function can't call throwing code" — it can, but if an exception *escapes* it, `terminate` runs. `noexcept` is a promise about escape, not about internals.
- "Destructors can throw if I'm careful" — during unwinding, a second exception → `terminate`. Destructors are implicitly `noexcept` since C++11; just don't.
- "`std::optional` reports errors" — it reports *absence*, with no reason. For error detail use `expected` or `error_code`.

**What follows from this topic**

RAII ties this topic to **smart pointers and ownership** — `unique_ptr`/`lock_guard` are the exception-safety tools you reach for daily. `noexcept`'s move-vs-copy effect connects to **move semantics** and to the **containers** topic (reallocation behaviour). The strong guarantee's copy-and-swap technique reappears in **the rule of five / assignment operators**. `std::expected`, `optional`, and `variant` link to the **`<utility>`/vocabulary-types** material. And the "algorithms only rearrange" observation from **topic 10** is what makes many STL operations easy to give the strong guarantee. Getting error handling right is a cross-cutting concern that every other topic quietly depends on.

### Q1. Walk through what happens when a `throw` executes.

`throw x` does three things: (1) constructs the exception object by copying/moving `x` into a special runtime-managed storage (not the normal stack, so it survives unwinding); (2) begins **stack unwinding** — walking back up the call stack, destroying every automatic (stack) object created since the corresponding `try`, in reverse order of construction, running each destructor; (3) searching, frame by frame, for a `catch` whose type matches the thrown type (by exact type, base class, or `...`). When found, control jumps there and the exception object is bound to the handler's parameter.

```cpp
void f() {
    std::lock_guard lk(mtx);       // (2) destroyed during unwind → mutex released
    std::vector<int> buf(1000);    // (2) destroyed during unwind → memory freed
    throw std::runtime_error("boom");  // (1) construct exception, begin unwind
}   // never reaches here
// caller: try { f(); } catch (const std::exception& e) { ... }  // (3) match
```

If no handler matches anywhere up the stack, `std::terminate` is called (default: `abort`). This is why RAII is essential — unwinding is what releases the lock and the buffer, automatically and correctly.

### Q2. Explain the four exception-safety guarantees.

They describe the state of your program if an operation throws:

- **Nothrow (no-throw) guarantee** — the operation never throws; it always succeeds. Required of destructors, `swap`, move operations (ideally), and anything called during unwinding. Marked `noexcept`.
- **Strong guarantee** — commit-or-rollback: if it throws, program state is **exactly as before** the call (transactional). Achieved via copy-and-swap: do the risky work on a copy, then swap it in with a nothrow `swap`.
- **Basic guarantee** — if it throws, no resources leak and all invariants hold (the object is in a *valid but unspecified* state), but the state may have changed. The minimum every operation should meet.
- **No guarantee** — throwing may leak or corrupt. Unacceptable; treat as a bug.

```cpp
// Strong guarantee via copy-and-swap:
Widget& operator=(const Widget& rhs) {
    Widget tmp(rhs);       // risky copy done on a temporary
    swap(*this, tmp);      // noexcept commit
    return *this;
}   // if the copy throws, *this is untouched
```

Aim for the **basic** guarantee everywhere and the **strong** guarantee where the cost is reasonable (single mutating operations, assignment).

### Q3. Why is RAII the foundation of exception safety?

Because stack unwinding runs destructors, tying a resource's lifetime to a stack object guarantees release on **every** exit path — normal return, `break`, early return, *or* exception — with zero manual cleanup code. The alternative (manual acquire/release) is unsafe: any throw between acquire and release leaks.

```cpp
// ❌ leaks the lock if process() throws
mtx.lock();
process();          // throws → unlock never runs → deadlock
mtx.unlock();

// ✅ RAII: destructor unlocks on every path
{
    std::lock_guard lk(mtx);
    process();      // throws → lk's destructor unlocks during unwind
}
```

Every owning type — `unique_ptr`, `shared_ptr`, `lock_guard`, `fstream`, `vector` — is an RAII wrapper. The discipline: **never own a raw resource in a bare local variable**; wrap it so the destructor cleans up. This is why "there is no `finally` in C++" isn't a gap — RAII destructors *are* the `finally`, and they compose.

### Q4. What is `noexcept`, and how does it affect `std::vector`?

`noexcept` declares a function won't let an exception escape. If one does, `std::terminate` is called immediately (no unwinding past it). It's both documentation and an optimisation enabler — the compiler can omit unwinding machinery and callers can assume the call is safe.

The high-value effect: **`std::vector` reallocation checks `noexcept` on your move constructor.** When a `vector` grows, it must relocate existing elements. If your type's move constructor is `noexcept`, it *moves* them (fast); if it *might* throw, `vector` **copies** them instead — because a throw halfway through moving would leave both the old and new buffers in a broken state, defeating the strong guarantee it wants to provide.

```cpp
struct Widget {
    Widget(Widget&&) noexcept;   // ← without noexcept, vector copies on realloc
};
```

So: mark your move constructor and move assignment `noexcept` whenever they genuinely can't throw. `std::move_if_noexcept` is the internal mechanism. Forgetting this is a silent, common performance bug.

### Q5. Why must destructors never throw?

If a destructor throws while the stack is **already unwinding** from another exception, the runtime faces two simultaneous exceptions and calls `std::terminate` — no recovery. Since C++11, destructors are **implicitly `noexcept`**, so a destructor that lets an exception escape terminates by default.

```cpp
struct Bad {
    ~Bad() { throw std::runtime_error("no"); }  // implicitly noexcept → terminate if it escapes
};
```

The practical consequences: (1) if a destructor does something that *can* fail (e.g. flushing a buffer, closing a file that reports errors), **catch and swallow or log** inside the destructor — don't let it propagate. (2) Provide a separate `close()`/`commit()` method that *can* throw, for callers who want to handle the error, and have the destructor do best-effort cleanup silently as a fallback. This is exactly how `std::fstream` works: `close()` can set failbit, but `~fstream` won't throw.

### Q6. Is it true that exceptions are "zero-cost"? What does that mean?

Under the modern **table-driven** (a.k.a. "zero-cost" or "Itanium ABI") model, the **non-throwing path pays nothing**: there's no runtime bookkeeping, no register save, no branch to set up a `try` block. The compiler instead emits out-of-line **unwinding tables** mapping each program-counter range to the destructors that must run and the handlers that apply. Entering a `try` is free; the cost is deferred entirely to the moment an exception is actually thrown.

The catch: when you *do* throw, it's **expensive** — the runtime consults those tables, runs destructors, and does a type-matching search, often costing microseconds (thousands of cycles). So the model optimises the common case (no error) at the expense of the rare case (error).

Implication: exceptions are ideal for **genuinely exceptional** conditions taken rarely. They're the wrong tool for control flow or expected, high-frequency failures in a hot loop — that's where `std::expected`/`optional`/error codes win, because they cost the same whether the operation succeeds or fails.

### Q7. Sketch the `std::exception` hierarchy and how you'd use it.

`std::exception` is the base; `what()` (virtual, `noexcept`) returns a C-string message. Standard subclasses:

- `std::logic_error` — bugs detectable before run (e.g. `std::invalid_argument`, `std::out_of_range`, `std::length_error`).
- `std::runtime_error` — errors only detectable at runtime (e.g. `std::range_error`, `std::overflow_error`, `std::system_error`).
- `std::bad_alloc`, `std::bad_cast`, `std::bad_optional_access`, etc. — specific standard failures.

```cpp
struct ConfigError : std::runtime_error {
    using std::runtime_error::runtime_error;   // inherit the (const string&) ctor
};
throw ConfigError("missing key: port");
// ...
catch (const std::exception& e) { log(e.what()); }   // catches your type via the base
```

Best practice: derive your custom exceptions from `std::runtime_error`/`std::logic_error` (so a single `catch (const std::exception&)` at the top handles everything), and pick `logic_error` vs `runtime_error` by whether the condition represents a **programming bug** or an **environmental failure**.

### Q8. Why catch by `const&` rather than by value?

Two reasons:

1. **Avoid slicing.** Exceptions are polymorphic; catching a base *by value* slices off the derived part, so `what()` and any derived data are lost. `catch (const std::exception& e)` binds to the real dynamic type and dispatches `what()` correctly.
2. **Avoid a copy.** Catching by value copy-constructs the exception object; by reference binds directly.

```cpp
try { risky(); }
catch (const std::runtime_error& e) { ... }   // ✅ no slice, no copy
// catch (std::exception e)                    // ❌ slices a runtime_error to exception
```

Use `const&` unless you specifically need to **modify and rethrow** (then plain `&`). Order handlers **most-derived first** — a `catch (const std::exception&)` before a `catch (const std::runtime_error&)` would swallow everything into the first, and the compiler warns the second is unreachable.

### Q9. How do you rethrow an exception, and what's the difference between `throw;` and `throw e;`?

Inside a handler, a bare `throw;` **rethrows the current exception** — the *same* object, with its original dynamic type preserved. `throw e;` **throws a copy** of `e`, which may slice if `e` is a base reference.

```cpp
catch (const std::exception& e) {
    log(e.what());
    throw;          // ✅ rethrows original object, full dynamic type intact
    // throw e;     // ❌ copies & slices to std::exception
}
```

Use bare `throw;` to log/annotate and let it propagate. For deferred rethrow (e.g. capturing an exception in one thread and rethrowing in another), use `std::current_exception()` → `std::exception_ptr` → `std::rethrow_exception(ptr)`. And `std::throw_with_nested` / `std::rethrow_if_nested` let you chain a low-level cause under a higher-level exception.

### Q10. When should you use exceptions vs error codes vs `std::expected`?

There's no single answer, but a modern rule of thumb by **frequency and nature** of the failure:

| Mechanism | Use when |
|---|---|
| **Exceptions** | Rare, exceptional failures; deep call stacks where threading an error through every frame is noise; constructors (can't return a code) |
| **Error codes / `std::error_code`** | Expected, frequent failures; interop with C APIs; hot paths where throw cost matters |
| **`std::expected<T, E>`** (C++23) | You want a *value or an error* as a return type, checked by the caller, no throw — the "explicit, local error handling" sweet spot |
| **`std::optional<T>`** | Failure has *no detail* — just "value or nothing" (a lookup miss) |

```cpp
std::expected<Config, std::string> parse(std::string_view text);
auto r = parse(src);
if (!r) return report(r.error());
use(*r);
```

The trend in modern C++ (and Rust's influence) is toward **`expected`/`optional` for expected failures** — visible in the signature, no hidden control flow, zero cost on either path — reserving exceptions for the genuinely exceptional. Constructors and operators that can't return a value are the case where exceptions remain the natural choice.

### Q11. What's `std::optional` good for, and what are its limits in error handling?

`std::optional<T>` holds *either* a `T` or nothing (`std::nullopt`). It's the vocabulary type for "**this may legitimately have no value**" — a cache miss, a `find` that matched nothing, a parse that produced no result — without sentinel values or out-params.

```cpp
std::optional<User> findUser(int id);
if (auto u = findUser(42)) { greet(*u); }   // contextual bool + deref
int port = cfg.value_or(8080);              // default on absence
```

Limits for error handling: it conveys **absence, not reason**. A failed `parse()` returning `nullopt` can't tell the caller *why* it failed. `.value()` on an empty optional throws `std::bad_optional_access`, and `*opt` on empty is **UB**. So use `optional` when "nothing" is a complete, self-explanatory answer; when the caller needs the *error detail*, reach for `std::expected<T, E>` (C++23) or `std::error_code`. Think of `optional<T>` as `expected<T, monostate>`.

### Q12. How can `std::variant` be used for error handling, and how does it compare to `std::expected`?

`std::variant<T, E1, E2, ...>` is a **sum type** — it holds exactly one of its alternatives — so you can return "a value *or* one of several distinct error types" and force the caller to handle each with `std::visit`:

```cpp
std::variant<Result, NetworkError, ParseError> fetch();
std::visit(overloaded{
    [](const Result& r)       { use(r); },
    [](const NetworkError& e) { retry(e); },
    [](const ParseError& e)   { report(e); },
}, fetch());
```

Versus `std::expected<T, E>`: `expected` is the **purpose-built** two-outcome type — it has a distinguished "value" side with `operator*`/`->`, a `.has_value()`/`bool` test, `.error()`, and monadic helpers (`and_then`, `transform`, `or_else`). `variant` treats every alternative symmetrically, so it's clunkier for the common "one success, one error" case but more flexible when you genuinely have **several unrelated error kinds** and want the compiler to force exhaustive handling. Pre-C++23, `variant<T, Error>` (or `expected` from a library like `tl::expected`) was the common stand-in for `std::expected`.

### Q13. What are `std::error_code` and `std::system_error`?

`std::error_code` is a lightweight, value-based error: an integer code plus a pointer to an **error category** (`std::error_category`) that gives it meaning and a message. It's the standard way to report failures **without throwing** — used throughout `<filesystem>`, networking, and threading APIs, which offer overloads taking an `error_code&` out-parameter.

```cpp
std::error_code ec;
auto sz = std::filesystem::file_size("data.bin", ec);  // no-throw overload
if (ec) { log(ec.message()); return; }                  // check the code
```

`std::system_error` is the **exception** that wraps an `error_code` — the throwing overloads of those same APIs throw a `system_error` carrying the code. So you choose per call site: the `ec`-out-param overload for value-based handling, or the no-`ec` overload that throws `system_error`. `std::make_error_code` and custom `error_category` subclasses let you plug your own domain's error enums into this framework, so library and application errors interoperate through one `error_code` currency.

### Q14. What causes `std::terminate` to be called?

`std::terminate` (which by default calls `abort`) fires on unrecoverable exception-handling failures:

- An exception **escapes a `noexcept`** function (including the implicitly-`noexcept` destructors and, by default, `main`'s failure to catch).
- A **second exception** is thrown while the stack is already unwinding from a first (the classic throwing-destructor-during-unwind case).
- An exception propagates out of `main` (or a thread's top-level function) with **no matching handler** anywhere.
- A `noexcept` violation, or throwing from a function registered where throwing is forbidden.
- An exception escapes the initial function of a `std::thread`, or a `std::thread` is destroyed/assigned while still joinable.

```cpp
void f() noexcept { throw 1; }   // escapes noexcept → terminate
```

You can install a custom handler with `std::set_terminate`, but it can't resume — it must end the program (log, dump core, etc.). The takeaways: give threads a top-level `try`/`catch`, don't let destructors throw, and be deliberate about `noexcept` promises.

### Q15. What breaks when exceptions cross an ABI or language boundary?

Exceptions are **not** part of a stable, cross-toolchain ABI in general. Problems arise when you throw across:

- **A C boundary.** C has no exceptions; letting a C++ exception unwind through a C stack frame (e.g. a callback invoked by a C library) is **undefined behaviour**. You must catch *before* the exception reaches C code and translate it to an error code. Mark such callbacks `noexcept` and `try`/`catch` inside them.
- **A shared-library / different-compiler boundary.** Two modules built with different compilers (or incompatible C++ runtimes/RTTI) may not agree on exception-type layout or unwinding tables, so catching a thrown type across the boundary can fail or corrupt. Keep exceptions *inside* a module and expose a C-style or `error_code`-based interface at the DLL/`.so` seam.

```cpp
extern "C" int c_callback(void* ctx) noexcept {   // ← boundary
    try { real_work(ctx); return 0; }
    catch (...) { return -1; }                     // translate to error code
}
```

Rule: **exceptions are an intra-module mechanism.** At any boundary you don't fully control — C code, plugin interfaces, foreign runtimes — convert to values before crossing.

### Q16. What does `-fno-exceptions` do, and where is it used?

`-fno-exceptions` (gcc/clang) compiles the translation unit with **exceptions disabled**: `throw` and `try`/`catch` become compile errors (or `throw` lowers to a call to `std::terminate`/`abort`), and the compiler omits all unwinding tables, shrinking binary size and removing any latent exception machinery.

Where it's used: **embedded/real-time systems** (deterministic timing, no room for unwind tables), some **game engines** and **high-frequency trading** code (predictable latency, and teams that have banned exceptions stylistically), and freestanding environments with no runtime support. In these builds the standard library is compromised — operations that would throw (`vector::at` out of range, `std::stoi` on bad input, allocation failure) instead call `std::terminate`, and types like `std::optional`/`std::expected` become the *only* error-reporting tools available.

```cpp
// Under -fno-exceptions:
std::vector<int> v;
// v.at(0);              // would throw → instead terminates
auto r = parse(s);       // std::expected — the sanctioned pattern here
if (!r) return r.error();
```

The consequence for library authors: code meant to run in these environments must avoid throwing paths and lean entirely on value-based error handling (`expected`, `error_code`, status returns). Checking `__cpp_exceptions` lets a header adapt its error strategy to the build mode.
## Concurrency & Multithreading

### Summary

**What this topic covers**

Everything about running multiple threads correctly in C++ — from spinning one up to designing pools that saturate a machine without corrupting memory. Three concern areas: (1) the **threading primitives** — `std::thread`, `std::jthread` (C++20), joining vs detaching, `thread_local` storage, and the RAII discipline that keeps thread lifetimes sane; (2) the **synchronisation toolkit** — mutexes (`std::mutex`, `std::shared_mutex`), the RAII lock wrappers (`lock_guard`, `unique_lock`, `scoped_lock`), condition variables, `std::call_once`, and the C++20 coordination types `std::latch` and `std::barrier`; and (3) the **task-based layer** — `std::async`, `std::future`/`std::promise`, `std::packaged_task`, and how to build thread pools on top. The 18 questions run from "how do I start a thread" to lock-ordering deadlocks, false sharing, and why a data race is undefined behaviour rather than "just a wrong answer." This topic is where careless C++ stops compiling clean and starts corrupting silently — TSan is your friend.

**Mental model**

A C++ thread is a real OS thread (1:1 model on every mainstream implementation), and the language gives you *nothing* automatic: no GIL, no managed runtime, no GC to serialise access. You get raw shared memory and a formal memory model that says any two threads touching the same non-atomic location, where at least one writes, with no happens-before relationship between them, is a **data race → undefined behaviour**. Not "reads a stale value" — UB, meaning the optimiser may assume it never happens. So concurrency in C++ is fundamentally about establishing *happens-before* edges: a mutex unlock synchronises-with the next lock; an atomic release-store synchronises-with an acquire-load that reads it; a `thread::join()` synchronises-with everything the joined thread did. Everything correct flows from those edges. RAII is the second pillar: locks, thread handles, and futures all clean up in destructors, so exceptions can't leave a mutex held. The mental shift from GC languages is that *ownership and lifetime* dominate — a detached thread outliving the data it captured is the classic C++ concurrency bug.

**Key terms**

- **`std::thread`** — owns one OS thread; must be `join()`ed or `detach()`ed before destruction or the destructor calls `std::terminate`.
- **`std::jthread`** (C++20) — RAII thread that auto-joins in its destructor and carries a `std::stop_token` for cooperative cancellation.
- **`std::mutex` / `lock_guard` / `unique_lock` / `scoped_lock`** — mutual exclusion plus RAII wrappers; `scoped_lock` locks multiple mutexes deadlock-free.
- **`std::shared_mutex`** — reader-writer lock; many `shared_lock` readers or one `unique_lock` writer.
- **`std::condition_variable`** — blocks a thread until notified; always used with a predicate to survive spurious wakeups.
- **`std::async` / `future` / `promise` / `packaged_task`** — task-based concurrency; a future is the read end of a one-shot channel, a promise/packaged_task the write end.
- **data race** — unsynchronised concurrent access with ≥1 write; undefined behaviour, not merely nondeterministic.
- **deadlock** — cyclic wait on locks; prevented by consistent lock ordering or `scoped_lock`.
- **`std::call_once` / `once_flag`** — runs an initialiser exactly once across threads; basis of thread-safe lazy init.
- **false sharing** — two threads write different variables sharing one cache line, ping-ponging the line; fixed with `alignas(std::hardware_destructive_interference_size)`.
- **`thread_local`** — one instance of the variable per thread.
- **`std::latch` / `std::barrier`** (C++20) — single-use / reusable thread rendezvous counters.

**Why interviewers ask this**

Concurrency separates engineers who *use* threads from those who *reason* about them. Junior signal: can spin up a `std::thread`, remembers to join, knows a mutex protects shared data. Senior signal: articulates that a data race is UB (not "a race condition bug"), can spot a lock-ordering deadlock and fix it with `scoped_lock`, knows why condition variables need a predicate loop, and understands that `std::async` with the default launch policy may run *synchronously*. The killer follow-ups are always about the failure modes — "what happens if you forget to join," "why is this singleton not thread-safe," "why is this loop slow under contention." Getting the memory-model framing right (this topic and the next are tightly coupled) is the strongest senior signal, because it shows you understand *why* the primitives exist, not just their APIs.

**Common confusions**

- "A data race just gives a wrong value" — no, it's undefined behaviour; the compiler may delete code paths that assume no race.
- "`volatile` makes it thread-safe" — false. `volatile` is for memory-mapped IO, not atomicity or ordering. Use `std::atomic`.
- "`std::async` runs on another thread" — only with `std::launch::async`; the default `async|deferred` policy lets it run lazily on the calling thread at `.get()`.
- "Detaching is a way to fire-and-forget safely" — detached threads capturing locals are dangling-reference factories; the captured data can die first.
- "A `shared_mutex` is always faster for reads" — reader locks have real overhead; under low contention a plain `mutex` often wins.
- "Locking each individual operation makes the class thread-safe" — per-operation locking doesn't compose; check-then-act sequences still race.

**What follows from this topic**

Concurrency sits directly on top of **The Memory Model & Atomics** — the happens-before edges named here are formalised there, and lock-free code replaces mutexes with atomics. It leans on **RAII & lifetimes** (every lock and thread handle is an RAII object) and on **smart pointers** (`shared_ptr` is the standard way to keep data alive for detached work). Get this topic and the memory model solid together; they are the two halves of one interview.

### Q1. How do you start a thread in C++, and what must you do before it's destroyed?

Construct a `std::thread` with a callable; it starts running immediately.

```cpp
void work(int n) { /* ... */ }
std::thread t(work, 42);   // starts now
// ...
t.join();                  // wait for it — REQUIRED
```

Before a `std::thread` is destroyed you **must** call either `join()` (block until it finishes) or `detach()` (let it run independently). If a joinable thread's destructor runs without either, it calls `std::terminate()` and your program dies. This deliberate design forces you to make a lifetime decision. In C++20, prefer `std::jthread`, which joins automatically in its destructor.

### Q2. What's the difference between `join()` and `detach()`, and when would you detach?

`join()` blocks the calling thread until the target finishes, then releases its resources; it also establishes a happens-before edge, so everything the thread did is visible afterwards. `detach()` severs the handle — the thread runs on its own and cleans itself up when done, but you lose all ability to wait for it or observe completion.

Detach almost never in application code. The danger: a detached thread that captured references or pointers to local state can outlive that state, giving undefined behaviour. If you must detach, the thread should own everything it touches (capture by value, or via `shared_ptr`). In practice, prefer a thread pool or `std::jthread` over manual detach.

### Q3. What is `std::jthread` and why prefer it over `std::thread`?

`std::jthread` (C++20) is `std::thread` with two upgrades: (1) its destructor calls `request_stop()` then `join()` automatically, so you can't forget to join and can't `std::terminate` by accident; (2) it carries a `std::stop_source`/`std::stop_token` for cooperative cancellation.

```cpp
std::jthread t([](std::stop_token st){
    while (!st.stop_requested()) { /* do work */ }
});
// t's destructor requests stop and joins — no manual cleanup
```

It makes the common case (RAII, scoped thread lifetime) the default. Reach for plain `std::thread` only when you genuinely need to `detach` or manage lifetime manually.

### Q4. Explain the RAII lock wrappers: `lock_guard`, `unique_lock`, `scoped_lock`.

All three lock a mutex on construction and unlock in their destructor, so an exception can never leave a mutex held.

- **`std::lock_guard`** — minimal, non-movable, locks one mutex for its whole scope. The default for a simple critical section.
- **`std::unique_lock`** — flexible: can defer locking, unlock/relock early, transfer ownership (movable), and works with condition variables (which need to unlock). Slightly heavier than `lock_guard`.
- **`std::scoped_lock`** (C++17) — locks *one or more* mutexes with a deadlock-avoidance algorithm. Use it whenever you need two locks at once.

```cpp
std::mutex m;
{
    std::lock_guard g(m);   // CTAD, C++17 — no <std::mutex> needed
    // critical section
}                            // unlocked here
```

Rule of thumb: `lock_guard` by default, `unique_lock` when you need flexibility or a condvar, `scoped_lock` for multiple mutexes.

### Q5. What is a deadlock and how do you prevent lock-ordering deadlocks?

A deadlock is a cycle of threads each holding a lock the next one wants. Classic case: thread A locks `m1` then `m2`; thread B locks `m2` then `m1`. Each waits forever.

```cpp
// BAD — inconsistent order
void transfer(Account& a, Account& b) {
    std::lock_guard la(a.m);
    std::lock_guard lb(b.m);  // deadlocks if another thread does transfer(b, a)
}
```

Fixes, in order of preference:
1. **`std::scoped_lock`** — locks all mutexes atomically with a deadlock-free algorithm: `std::scoped_lock lk(a.m, b.m);`.
2. **Consistent global lock ordering** — always acquire in the same order (e.g. by address).
3. **`std::lock(m1, m2)`** then adopt with `lock_guard(..., std::adopt_lock)` (pre-C++17 idiom).

Also: hold locks for the shortest time possible, and never call user callbacks while holding a lock.

### Q6. Why must you use a predicate with a condition variable, and what are spurious wakeups?

A `condition_variable` can wake a waiting thread even when no one notified it — a **spurious wakeup** (allowed by the standard, and real on many platforms). So you must re-check the condition after waking. The predicate overload does this loop for you:

```cpp
std::mutex m;
std::condition_variable cv;
bool ready = false;

// waiter
std::unique_lock lk(m);
cv.wait(lk, []{ return ready; });   // loops until ready, immune to spurious wakeups

// notifier
{ std::lock_guard g(m); ready = true; }
cv.notify_one();
```

Two more rules: (1) modify the shared condition *under the mutex* before notifying, or you can lose a wakeup (the "lost wakeup" race); (2) `wait` takes a `unique_lock` (not `lock_guard`) because it must unlock while sleeping and relock on wake.

### Q7. Walk through implementing a thread-safe producer-consumer queue.

A mutex protects the queue; a condition variable lets consumers sleep until there's work.

```cpp
template <class T>
class BlockingQueue {
    std::mutex m_;
    std::condition_variable cv_;
    std::queue<T> q_;
public:
    void push(T v) {
        { std::lock_guard g(m_); q_.push(std::move(v)); }
        cv_.notify_one();
    }
    T pop() {
        std::unique_lock lk(m_);
        cv_.wait(lk, [this]{ return !q_.empty(); });
        T v = std::move(q_.front());
        q_.pop();
        return v;
    }
};
```

Key points: notify *after* releasing the lock (or at least don't hold it longer than needed) so the woken consumer doesn't immediately block on the mutex; the predicate `!q_.empty()` handles both spurious wakeups and the case where another consumer already drained the item. For shutdown, add a `bool done_` flag checked in the predicate.

### Q8. `std::async` vs manually managing threads — and the default-launch-policy gotcha.

`std::async` runs a callable and returns a `std::future` for its result, handling thread creation and exception propagation for you. But with the **default** launch policy (`std::launch::async | std::launch::deferred`), the implementation may choose *deferred* execution — the task doesn't run until you call `.get()`, and then it runs **synchronously on the calling thread**.

```cpp
auto f = std::async(std::launch::async, compute);  // forces a new thread
auto g = std::async(compute);                       // MAY run lazily on .get()
```

Two more traps: (1) the future returned by `std::async` **blocks in its destructor** until the task completes — so `std::async(f); std::async(g);` runs serially, not in parallel, if you don't keep the futures alive; (2) always pass `std::launch::async` explicitly when you actually want concurrency.

### Q9. Explain `std::promise`, `std::future`, and `std::packaged_task`.

They're the write and read ends of a one-shot value channel (the shared state).

- **`std::promise<T>`** — the producer sets the value with `set_value` (or an exception with `set_exception`); a consumer reads it through the paired `future`.
- **`std::future<T>`** — the read end; `.get()` blocks until the value is ready (and rethrows any stored exception). Move-only, single `get`.
- **`std::packaged_task<Sig>`** — wraps a callable so that invoking it fulfils an associated future; useful as the work item in a thread pool.

```cpp
std::promise<int> p;
std::future<int> f = p.get_future();
std::thread t([&]{ p.set_value(42); });
int v = f.get();   // 42
t.join();
```

Use `promise` when the producer computes the value at some arbitrary later point; `packaged_task` when you want a callable you can hand to a pool; `async` when you just want "run this and give me a future."

### Q10. What is a data race, and why is it undefined behaviour rather than just a bug?

A data race is: two threads access the same memory location, at least one access is a write, they're not ordered by a happens-before relationship, and neither is atomic. The C++ standard declares this **undefined behaviour** outright.

It's UB, not "reads a torn/stale value," because the optimiser is allowed to assume races never happen. It can hoist loads out of loops, fuse or split writes, or reorder around what looks like unsynchronised code — transformations that are perfectly valid *unless* another thread is watching. So a racy program can miscompile in ways that have nothing to do with the "expected" bad value: infinite loops, skipped branches, torn multi-word writes. The fix is to make the shared access either mutex-protected or `std::atomic`. Run TSan (`-fsanitize=thread`) to catch these — races are invisible in casual testing.

### Q11. Implement a thread-safe singleton. Why is `call_once` or a local static preferred?

Two clean options.

**Meyers singleton (preferred)** — a function-local static. Since C++11 the standard guarantees its initialisation is thread-safe (the "magic statics" rule):

```cpp
Config& instance() {
    static Config cfg;   // initialised exactly once, thread-safe, no locks in fast path
    return cfg;
}
```

**`std::call_once`** — when init logic is more complex or the object lives elsewhere:

```cpp
std::once_flag flag;
Config* cfg = nullptr;
void init() { std::call_once(flag, []{ cfg = new Config(); }); }
```

Both beat the classic **double-checked locking** with a raw pointer, which was famously broken before C++11 because the write to the pointer could be reordered before the object's construction finished — a data race. If you must hand-roll DCLP today, the flag must be `std::atomic` with acquire/release ordering.

### Q12. What is false sharing and how do you fix it?

False sharing happens when two threads write *different* variables that happen to live on the **same cache line** (typically 64 bytes). Even though there's no logical conflict, the cache-coherence protocol bounces the line between cores on every write, killing performance.

```cpp
struct Counters { std::atomic<int> a; std::atomic<int> b; };  // a and b share a line
```

Fix by padding/aligning each hot variable to its own cache line:

```cpp
struct Counters {
    alignas(std::hardware_destructive_interference_size) std::atomic<int> a;
    alignas(std::hardware_destructive_interference_size) std::atomic<int> b;
};
```

It's a classic "why doesn't my parallel loop scale" answer: the algorithm is fine, the memory layout is fighting the hardware. Diagnose with `perf` (high cache-coherence traffic) or by observing that spreading counters apart suddenly speeds things up.

### Q13. What does `thread_local` mean, and when is it useful?

`thread_local` gives each thread its own independent instance of a variable, constructed on first use in that thread and destroyed when the thread exits.

```cpp
thread_local int cachedId = -1;           // one per thread
thread_local std::mt19937 rng{std::random_device{}()};  // per-thread RNG
```

Uses: per-thread scratch buffers, per-thread RNG state (avoids locking a shared generator), thread-specific caches, and per-thread error contexts (like `errno`). It trades memory (one copy per thread) for the elimination of synchronisation. Caveat: destruction order at thread exit is subtle, and `thread_local` on a class member isn't a thing (only namespace-scope, static, or local variables).

### Q14. What are `std::latch` and `std::barrier` (C++20)?

Both are thread-coordination counters.

- **`std::latch`** — single-use. Initialised with a count; threads `count_down()` and any thread can `wait()` until the count hits zero. Perfect for "wait until N workers have all reached the start line," then it's spent.
- **`std::barrier`** — reusable. A group of threads `arrive_and_wait()`; when all arrive, an optional completion function runs and the barrier resets for the next phase. Ideal for iterative parallel algorithms with per-iteration sync points.

```cpp
std::latch startGate(1);
// workers: startGate.wait();   main: startGate.count_down();  // release all at once

std::barrier sync(nThreads, []{ /* runs once per phase */ });
// each worker per phase: sync.arrive_and_wait();
```

Before C++20 you'd fake these with a mutex + condition variable + counter; the standard types are clearer and often faster.

### Q15. How would you design a simple thread pool, and why not just spawn a thread per task?

Spawning a thread per task is expensive: OS thread creation costs microseconds and kilobytes of stack, and unbounded spawning oversubscribes the CPU (more threads than cores → context-switch thrashing). A pool creates a fixed number of worker threads (usually `std::thread::hardware_concurrency()`) once and feeds them a shared task queue.

```cpp
// sketch
std::vector<std::jthread> workers;
BlockingQueue<std::function<void()>> tasks;
for (unsigned i = 0; i < std::thread::hardware_concurrency(); ++i)
    workers.emplace_back([&]{ while (auto job = tasks.pop()) job(); });
```

Submit work by pushing a `std::packaged_task` and returning its future so callers can await results. Real pools add: graceful shutdown (a sentinel or stop flag), work-stealing deques to reduce contention on one central queue, and bounded queues for backpressure. The whole point is amortising thread setup and matching parallelism to hardware.

### Q16. What's the cost of lock contention, and how do you reduce it?

Under contention, threads serialise at the lock and burn time in the kernel blocking/waking — throughput collapses toward single-threaded, plus overhead. The cure is to shrink or eliminate the contended region:

- **Narrow the critical section** — do expensive work (allocation, IO, computation) *outside* the lock; hold it only for the shared mutation.
- **Shard the lock** — split one mutex over N buckets (striped locking) so unrelated keys don't contend.
- **Reader-writer split** — `std::shared_mutex` when reads vastly outnumber writes.
- **Per-thread state** — `thread_local` accumulators merged at the end (map-reduce style) remove the shared write entirely.
- **Lock-free structures** — atomics/CAS for simple shared counters or queues (see the memory-model topic).

Measure first: a lock that's rarely contended costs almost nothing (uncontended mutex lock/unlock is ~tens of nanoseconds). Optimise the hot, contended locks only.

### Q17. What is `std::stop_token` and how does cooperative cancellation work (C++20)?

C++ threads can't be forcibly killed — there's no safe way to abort arbitrary code mid-execution. Instead, C++20 offers *cooperative* cancellation: a `std::stop_source` produces `std::stop_token`s; setting `request_stop()` on the source flips the token, and the worker periodically checks it and returns.

```cpp
std::jthread t([](std::stop_token st){
    while (!st.stop_requested()) {
        // do a chunk of work
    }
});
// t's destructor calls request_stop() automatically
```

You can also register a `std::stop_callback` to fire immediately on cancellation (e.g. to wake a blocked condition variable via `condition_variable_any::wait` with a stop token). The key idea: cancellation is a *request*, the worker chooses safe points to honour it. `jthread` wires this in by default.

### Q18. Spot the bug: what's wrong with this detached-thread code?

```cpp
void launch() {
    int result = 0;
    std::thread t([&result]{
        result = expensive();   // (A)
    });
    t.detach();
}                                // (B)
```

Two fatal bugs. First, `result` is a local of `launch`; the moment `launch` returns at (B), `result` is destroyed, but the detached thread may still be executing (A) — it writes to a dangling reference, undefined behaviour. Second, even if the lifetime were fine, there's a **data race**: nothing synchronises the thread's write to `result` with the (now-gone) main thread, and no one ever reads it safely.

Fixes: don't detach — `join()` before returning (so `result` outlives the thread and the join provides happens-before), or capture by value / into a `shared_ptr`, or return a `std::future` via `std::async(std::launch::async, expensive)` and `.get()` the result. Detaching a thread that touches locals is almost always wrong.

## The Memory Model & Atomics

### Summary

**What this topic covers**

The formal rules that make multithreaded C++ *defined* rather than a coin flip — the C++11 memory model and the `std::atomic` machinery built on it. Three concern areas: (1) the **model itself** — happens-before, synchronizes-with, sequenced-before, and the data-race-is-UB rule that everything hangs off; (2) **atomics and their memory orders** — `std::atomic<T>`, the six `memory_order` values (`seq_cst`, `acquire`, `release`, `acq_rel`, `relaxed`, `consume`), and the read-modify-write operations including `compare_exchange_weak`/`strong`; and (3) **lock-free reasoning** — what lock-free vs wait-free actually mean, the ABA problem, fences, `atomic_flag`, atomic smart pointers, and cache coherence (why atomics aren't free). The 14 questions push on the precise ordering guarantees, because this is the topic where hand-waving gets you a wrong lock-free algorithm that passes tests and corrupts production. If Concurrency taught you the primitives, this topic tells you *why* they synchronise.

**Mental model**

Forget "threads run in program order and see each other's writes immediately" — that intuition (sequential consistency) is what `seq_cst` *buys* you, at a cost, and weaker orders relax it. The real model: each thread executes its own operations in an order consistent with its source (`sequenced-before`), but *between* threads there is no shared clock. Visibility between threads exists only where you create a **synchronizes-with** edge — a release-store on an atomic paired with an acquire-load that reads that value. Chain sequenced-before and synchronizes-with together and you get **happens-before**, the partial order that determines what a read is allowed to see. If two conflicting accesses aren't ordered by happens-before, it's a data race → UB. Atomics do two jobs at once: they make an access *indivisible* (no torn reads) and, via their memory order, they publish/acquire a *release sequence* of other (possibly non-atomic) writes. So `x.store(1, release)` doesn't just publish `x`; it publishes everything the thread wrote *before* it, to any thread that does `x.load(acquire)` and sees the 1.

**Key terms**

- **happens-before** — the partial order deciding visibility; if A happens-before B and both touch a location (one writing), B sees A.
- **synchronizes-with** — the cross-thread edge created by a release store read by an acquire load on the same atomic.
- **`std::atomic<T>`** — indivisible reads/writes/RMW on `T`; `is_lock_free()` says whether it uses a lock under the hood.
- **`memory_order_seq_cst`** — default; single total order across all seq_cst ops, strongest and most expensive.
- **`acquire` / `release`** — release publishes prior writes; acquire sees them; together they form the standard producer-consumer edge.
- **`relaxed`** — atomicity only, no ordering; safe for standalone counters.
- **`acq_rel`** — for RMW ops that both consume and publish (e.g. a CAS in a lock-free stack).
- **`consume`** — data-dependency ordering; effectively deprecated, treated as `acquire` by every compiler.
- **`compare_exchange_weak/strong`** — atomic CAS; the building block of lock-free algorithms.
- **ABA problem** — a value reads A, changes to B, back to A; a naive CAS thinks nothing happened.
- **lock-free vs wait-free** — lock-free: system-wide progress guaranteed; wait-free: *every* thread finishes in bounded steps.
- **fence** — `std::atomic_thread_fence`; standalone ordering barrier not tied to a specific variable.

**Why interviewers ask this**

This is the deepest-water C++ topic and a strong senior filter. Junior signal: knows `std::atomic<int>` exists and `++` on it is safe. Mid signal: can explain acquire/release for a producer-consumer flag. Senior signal: can state precisely *why* a data race is UB, explain what a release store publishes beyond its own variable, reason about when `relaxed` is safe (and when it silently isn't), spot an ABA bug in a lock-free stack, and articulate that `volatile` gives you neither atomicity nor ordering. Interviewers probe here to find people who've actually written or debugged lock-free code, because the failure mode is invisible in testing and catastrophic in production. Even if you never write lock-free structures, understanding this model is what lets you reason confidently about the mutex-based code you *do* write.

**Common confusions**

- "`volatile` is C++'s atomic" — no. `volatile` prevents the compiler eliding accesses (for MMIO); it gives no atomicity and no inter-thread ordering. Use `std::atomic`.
- "`atomic` operations are always lock-free" — `std::atomic<BigStruct>` may use a hidden mutex; check `is_lock_free()`.
- "Atomics are basically free" — an atomic RMW forces cache-line ownership and often a memory barrier; under contention it's *slower* than you think.
- "`relaxed` means no guarantees at all" — it still guarantees atomicity and a single modification order per variable; it only drops *cross-variable* ordering.
- "`seq_cst` and `acquire/release` are interchangeable" — seq_cst adds a global total order the weaker pair doesn't; some algorithms need it.
- "A successful CAS means the value never changed" — ABA: it may have changed away and back.

**What follows from this topic**

This is the formal underpinning of **Concurrency & Multithreading** — every mutex lock/unlock and `thread::join` is defined in terms of the happens-before edges described here. It connects to **smart pointers** via `std::atomic<std::shared_ptr>` (C++20) and to **performance**, since atomics and false sharing are cache-coherence stories. Master the acquire/release pair first; `seq_cst`, `relaxed`, and lock-free algorithms all make sense relative to it.

### Q1. What problem does the C++11 memory model solve?

Before C++11, the language had no notion of threads at all — multithreading relied on platform APIs and compiler-specific guarantees, and there was no portable definition of what one thread was allowed to see of another's writes. C++11 introduced a formal **memory model**: it defines when a write by one thread becomes visible to a read by another, what constitutes a data race (undefined behaviour), and the ordering guarantees of atomic operations.

The payoff is that you can now write portable, correctly-synchronised concurrent code and reason about it with the *language standard* rather than CPU-vendor manuals. It also gives the compiler and hardware freedom to reorder and optimise *within* the rules — the model is the contract between your code, the optimiser, and the CPU's memory system.

### Q2. Explain happens-before and synchronizes-with.

**Sequenced-before** is the intra-thread order: within one thread, evaluations are (mostly) ordered by the source. **Synchronizes-with** is the *inter*-thread edge: a release operation on an atomic *synchronizes-with* an acquire operation on the same atomic that reads the value the release stored (or later in its release sequence). **Happens-before** is the transitive closure of sequenced-before and synchronizes-with.

The rule that matters: if a write W happens-before a read R of the same location, R sees W (or a later write). If two conflicting accesses are *not* ordered by happens-before and neither is atomic, it's a data race → UB.

```cpp
std::atomic<bool> ready{false};
int data = 0;
// thread 1
data = 42;                          // sequenced-before the store
ready.store(true, std::memory_order_release);
// thread 2
if (ready.load(std::memory_order_acquire))  // synchronizes-with the store
    assert(data == 42);             // guaranteed: store happens-before this load
```

### Q3. List the six memory orders and what each guarantees.

| Order | Guarantee |
|---|---|
| `seq_cst` | Atomicity + acquire/release **+** a single global total order over all seq_cst ops. Default. |
| `acquire` | On a load: no reads/writes in this thread can be reordered *before* it; sees the releasing thread's prior writes. |
| `release` | On a store: no reads/writes in this thread can be reordered *after* it; publishes prior writes. |
| `acq_rel` | For RMW ops: acquire on the load half, release on the store half. |
| `relaxed` | Atomicity + per-variable modification order only. No cross-variable ordering. |
| `consume` | Data-dependency-only ordering; deprecated in practice — compilers promote it to `acquire`. |

Mental grouping: `seq_cst` (safe default), `acquire`/`release`/`acq_rel` (the workhorse producer-consumer set), `relaxed` (counters and flags where order doesn't matter), `consume` (don't use).

### Q4. What does a release store actually publish, and how does an acquire load consume it?

A release store publishes **everything the storing thread wrote before it** — not just the atomic variable. When another thread does an acquire load on the same atomic and *reads the value the release stored*, all those prior writes become visible to it (they happen-before everything after the acquire load).

That's the whole trick behind lock-free handoff: you write your payload (ordinary, non-atomic writes), then do one `release` store of a "ready" flag; the consumer does an `acquire` load of the flag and, if it sees "ready," is guaranteed to see the payload. The atomic acts as a *gate* that flushes and publishes the surrounding writes. Crucially, an acquire load that reads a *stale* value (doesn't see the release) provides no such guarantee — the synchronizes-with edge only forms when the acquire actually reads the released value.

### Q5. When is `memory_order_relaxed` safe? Give an example.

`relaxed` gives atomicity (no torn values, and a coherent per-variable modification order) but **no ordering relative to other variables**. It's safe whenever you don't rely on the atomic to publish or order *other* memory.

The canonical safe use is an independent counter where only the final total matters:

```cpp
std::atomic<long> hits{0};
// many threads:
hits.fetch_add(1, std::memory_order_relaxed);   // safe — we only read the total later
```

Each increment is atomic; you never use `hits` to guard access to other data, so its ordering doesn't matter. Reference counting's *increment* can be relaxed for the same reason. But the *decrement-to-zero* in `shared_ptr` needs `acq_rel` — because seeing the count hit zero must synchronise with all prior uses before the object is destroyed. That contrast is the classic interview probe: relaxed for the increment, release/acquire for the destroying decrement.

### Q6. Explain `compare_exchange_weak` vs `compare_exchange_strong` and when to use each.

Both are atomic CAS: "if this atomic currently equals `expected`, set it to `desired` and return true; otherwise load the current value into `expected` and return false."

The difference is **spurious failure**. `compare_exchange_weak` may fail *even when the value equals `expected`* (on platforms using LL/SC instructions where an interrupt can break the reservation). `compare_exchange_strong` never fails spuriously.

Rule: use `weak` inside a retry loop (where you're looping anyway, so a spurious failure just retries — and `weak` is cheaper on some ISAs); use `strong` when you're *not* looping and a false failure would be a bug.

```cpp
// typical lock-free update loop — weak is correct and efficient here
auto cur = a.load();
while (!a.compare_exchange_weak(cur, transform(cur))) { /* cur reloaded, retry */ }
```

### Q7. What is the ABA problem?

A thread reads a value A from an atomic, prepares an update, and does a CAS expecting A. In between, another thread changed it to B and *back to A*. The CAS succeeds because the value is A again — but the world is not the same; the "unchanged" assumption is false. In a lock-free stack, this can splice a freed/reused node back into the list, corrupting it.

```cpp
// thread 1 reads head = A, gets preempted
// thread 2 pops A, pops B, pushes A back (A now points somewhere else)
// thread 1's CAS(head, A -> A.next) succeeds — but A.next is stale
```

Fixes: **tagged pointers** (pack a version counter alongside the pointer so A-with-tag-1 ≠ A-with-tag-2, via `compare_exchange` on a double-width atomic), **hazard pointers**, or **RCU**/epoch-based reclamation to ensure a node isn't reused while another thread references it. ABA is *the* reason naive lock-free stacks are wrong.

### Q8. What's the difference between lock-free and wait-free?

Both are *non-blocking* — no mutexes, so a thread stalling (even being suspended by the OS) can't block others indefinitely. They differ in the strength of the progress guarantee:

- **Lock-free** — the *system as a whole* makes progress: at least one thread completes its operation in a bounded number of steps. Individual threads may starve (retry loops can spin), but the whole never deadlocks or livelocks. Most `compare_exchange` retry-loop structures are lock-free.
- **Wait-free** — *every* thread completes in a bounded number of its own steps, regardless of what others do. No starvation, no unbounded retries. Much harder to build; usually needs helping schemes or per-thread announcement arrays.

Wait-free is strictly stronger and rarer (used in hard-real-time and latency-critical systems). "Lock-free" in casual usage often just means "uses atomics not mutexes" — in an interview, be precise about which guarantee you mean.

### Q9. Is `std::atomic` always lock-free? How do you check?

No. `std::atomic<T>` for a `T` larger than the platform's atomic word size (e.g. a big struct, or sometimes 16-byte types) may be implemented with a hidden internal lock — you still get correct atomic semantics, but not the lock-free performance or the safety in signal handlers.

Check at runtime with `.is_lock_free()`, or at compile time with `std::atomic<T>::is_always_lock_free` (a `constexpr bool`, C++17):

```cpp
static_assert(std::atomic<int>::is_always_lock_free);      // true everywhere sane
std::atomic<BigStruct> s;
if (!s.is_lock_free()) { /* it's using a mutex under the hood */ }
```

`std::atomic_flag` is the *only* type the standard guarantees is always lock-free. Integral and pointer atomics are lock-free on all mainstream platforms; large user types often aren't.

### Q10. What is `std::atomic_flag` and why is it special?

`std::atomic_flag` is the simplest atomic — a single boolean-like flag with just two operations: `test_and_set` (atomically set to true, return the previous value) and `clear`. It's the **only** atomic type the standard *guarantees* to be lock-free on every conforming implementation, which is why it's the primitive you can build a spinlock from:

```cpp
class SpinLock {
    std::atomic_flag f = ATOMIC_FLAG_INIT;
public:
    void lock()   { while (f.test_and_set(std::memory_order_acquire)) { /* spin */ } }
    void unlock() { f.clear(std::memory_order_release); }
};
```

Pre-C++20 it had no way to read the value without setting it; C++20 added `test()` and integration with `atomic_wait`/`notify`. Use it for spinlocks and the lowest-level building blocks; for anything richer, use `std::atomic<bool>`.

### Q11. What is `std::atomic<std::shared_ptr>` and why is plain `shared_ptr` not thread-safe for this?

A `std::shared_ptr`'s *control block* (the refcount) is thread-safe — multiple threads can copy/destroy shared_ptrs to the *same* object concurrently. But the `shared_ptr` **object itself** is not: if one thread reassigns a `shared_ptr` while another reads it, that's a data race on the pointer, UB.

Before C++20 you used the free functions `std::atomic_load`/`std::atomic_store` on `shared_ptr` (clunky, easy to misuse). C++20 added a proper `std::atomic<std::shared_ptr<T>>` specialisation:

```cpp
std::atomic<std::shared_ptr<Config>> current;
current.store(std::make_shared<Config>(...));   // publish new config atomically
auto snapshot = current.load();                  // reader gets a consistent snapshot
```

This is the clean way to do lock-free configuration swaps / read-copy-update-style publishing: readers `load()` a stable snapshot; a writer `store()`s a freshly built object. It's often *not* lock-free internally, but it's race-free and far simpler than hand-rolled reclamation.

### Q12. What are memory fences and how do they differ from atomic-operation ordering?

A fence (`std::atomic_thread_fence(order)`) is a standalone ordering barrier **not tied to any particular variable**. It constrains how memory operations before and after it can be reordered, without itself being a load or store.

The difference from per-operation ordering: `x.store(1, release)` attaches the release semantics *to that store*. A fence instead lets you separate the barrier from the access — e.g. do several `relaxed` atomic writes, then one `atomic_thread_fence(release)`, so the fence publishes all of them together:

```cpp
a.store(1, std::memory_order_relaxed);
b.store(2, std::memory_order_relaxed);
std::atomic_thread_fence(std::memory_order_release);   // publishes both
flag.store(true, std::memory_order_relaxed);
```

A consumer pairs an acquire fence with its loads. Fences are lower-level and easier to get subtly wrong than per-operation orders; prefer attaching the order to the atomic op unless you specifically need to batch. `atomic_signal_fence` is the same idea but only orders w.r.t. signal handlers on the same thread (no CPU barrier).

### Q13. Why is `seq_cst` more expensive than `acquire`/`release`, and when do you actually need it?

`acquire`/`release` only orders operations *relative to that atomic's* release/acquire chain — it's typically free or a cheap barrier on strongly-ordered CPUs (x86) and a lightweight barrier on weakly-ordered ones (ARM). `seq_cst` additionally imposes a **single global total order** over *all* seq_cst operations across all threads, which on weakly-ordered hardware requires full memory barriers (e.g. `dmb ish` / `mfence`), and prevents certain reorderings even on x86 (a seq_cst store often compiles to `xchg` or an `mfence`).

You need `seq_cst` when correctness depends on all threads agreeing on a *single order* of independent atomic operations — the textbook case is Dekker-style mutual exclusion / the "independent reads of independent writes" (IRIW) litmus test, where acquire/release alone permits threads to observe writes to two different variables in inconsistent orders. For most producer-consumer handoffs, acquire/release suffices and is faster. Default to `seq_cst` for correctness while learning; drop to acquire/release once you've proven the weaker order is sufficient.

### Q14. Why isn't `volatile` a substitute for `std::atomic`?

`volatile` means "this variable may change outside the program's knowledge, so don't optimise away or cache accesses to it." It exists for **memory-mapped hardware IO and signal handlers** — it stops the compiler from eliding or reordering *volatile* accesses relative to each other.

What it does **not** give you: (1) **atomicity** — a `volatile int64_t` write on a 32-bit target can still tear; `volatile` operations aren't indivisible. (2) **inter-thread ordering** — `volatile` puts no constraints on the CPU's memory reordering or on ordering relative to *non-volatile* accesses, so it creates no happens-before edge. A `volatile` flag used for thread handoff is a data race.

```cpp
volatile bool ready = false;   // WRONG for thread communication
std::atomic<bool> ok{false};   // RIGHT — atomicity + ordering
```

Java/C# `volatile` *does* imply memory ordering; C++ `volatile` does not — a common cross-language trap. In C++, threads → `std::atomic`; hardware registers → `volatile`.

## Lambdas & Functional

### Summary

**What this topic covers**

Lambdas — C++'s closures — and the functional-style programming they enable. Three concern areas: (1) the **syntax and semantics** — the `[captures](params){body}` form, what a lambda actually *is* (a compiler-generated closure type), `mutable`, generic (`auto`-parameter) lambdas, and `constexpr` lambdas; (2) **captures and their pitfalls** — by-value vs by-reference, capturing `this` vs `*this` (C++17), init-capture (C++14), and the dangling-reference bugs that dominate real code; and (3) the **functional toolkit** — `std::function` and its type-erasure cost, higher-order functions, returning lambdas, recursion in lambdas (`std::function`, the Y-combinator, and C++23 deducing-this), and why lambdas have essentially retired `std::bind`. The 14 questions run from "write a lambda that sorts descending" to the closure-lifetime traps that make lambdas the single most common source of subtle use-after-free in modern C++. Lambdas look trivial and hide sharp edges around *lifetime* — exactly where interviews probe.

**Mental model**

A lambda is **syntactic sugar for an anonymous struct with an `operator()`**. When you write `[x](int n){ return n + x; }`, the compiler generates a unique unnamed class (the *closure type*) with a member for each captured variable and a call operator containing the body; the lambda expression constructs an instance of it. That single fact explains everything: captures are *members* (so by-value captures copy at the point of definition, not at call), `mutable` just removes the `const` from the generated `operator()`, a generic lambda is a struct with a *templated* `operator()`, and a captureless lambda is convertible to a plain function pointer (nothing to store). It also explains the lifetime rule: a by-reference capture stores a *reference member*, and like any reference it dangles if the referent dies first. Because each lambda has its own unique type, you need `auto` to name one, and `std::function` (with its heap-allocation/indirection cost) to store heterogeneous ones in a container.

**Key terms**

- **closure type** — the unique compiler-generated class a lambda expression produces; each lambda has a distinct type.
- **capture** — a variable pulled into the closure; by value (`[x]`), by reference (`[&x]`), all-by-value (`[=]`), all-by-reference (`[&]`).
- **`mutable`** — allows the lambda body to modify by-value captures (removes `const` from `operator()`).
- **init-capture** (C++14) — `[y = expr]` or `[p = std::move(ptr)]`; introduces a new closure member, enabling move-capture.
- **`this` vs `*this` capture** — `[this]` captures the enclosing object by *pointer* (dangling risk); `[*this]` (C++17) copies it by value.
- **generic lambda** (C++14) — `auto` parameters give the closure a templated call operator.
- **`constexpr` lambda** (C++17) — usable in constant expressions.
- **`std::function`** — a type-erased callable wrapper; owns any callable of a given signature, at the cost of an allocation + indirect call.
- **higher-order function** — one that takes or returns a function/lambda.
- **IIFE** — immediately-invoked lambda expression, used to initialise a `const` with complex setup logic.
- **`std::bind`** — pre-lambda partial-application tool, now largely obsolete.
- **deducing this** (C++23) — `operator()(this Self&& self, ...)`, enabling clean recursive lambdas.

**Why interviewers ask this**

Lambdas are everywhere in modern C++ — STL algorithms, callbacks, async continuations, custom comparators — so fluency is table stakes. Junior signal: can write a lambda for `std::sort` and knows `[=]` vs `[&]`. Senior signal: knows a lambda is a closure *object* with a unique type, can explain exactly when a captured reference dangles (the classic "capture `this` in an async callback that outlives the object" bug), knows why storing lambdas needs `std::function` and what that costs, and reaches for lambdas over `std::bind`. The favourite trap question is a "what does this print / spot the dangling capture" involving a lambda that captures a local by reference and is returned or stored. Getting lifetime reasoning right here is the same muscle as smart-pointer and move-semantics questions — interviewers use lambdas as a compact way to test it.

**Common confusions**

- "`[=]` captures everything by value so it's always safe" — it captures `this` by *pointer* when used in a member function; the object can still dangle.
- "By-value capture snapshots at call time" — no, it copies at the point the lambda is *created*.
- "`mutable` makes the captured original mutable" — it makes the *copy* mutable; the outside variable is untouched.
- "Every lambda is a `std::function`" — no; each lambda is its own unique type. `std::function` is a separate, heavier wrapper you opt into.
- "Lambdas are slower than functions" — a lambda called directly usually inlines completely and is as fast as a hand-written loop; the cost comes only from `std::function` erasure.
- "You can't have a `constexpr` lambda" — you can since C++17.

**What follows from this topic**

Lambdas lean hard on **move semantics & value categories** (init-capture with `std::move`, capturing by value) and on **RAII & lifetimes / smart pointers** (the dangling-capture bug is a lifetime bug; capturing a `shared_ptr` extends lifetime). They're the callable of choice throughout **the STL & algorithms** (predicates, comparators, projections) and appear as continuations in the concurrency topics (`std::async`, thread pool tasks). If move semantics and lifetimes are solid, lambdas are mostly syntax on top; if they're shaky, lambda capture bugs will bite.

### Q1. What is a lambda, really — what does the compiler generate?

A lambda expression creates an unnamed **closure object** whose type is a unique, compiler-generated class with an `operator()`. This is equivalent hand-written code:

```cpp
int x = 10;
auto f = [x](int n){ return n + x; };

// roughly equivalent to:
struct __lambda {
    int x;                                   // captured member
    int operator()(int n) const { return n + x; }
};
auto f = __lambda{10};
```

Every lambda has a *distinct* type (even two textually identical lambdas differ), which is why you store one in `auto`. Captures become data members initialised when the lambda is *created*. The body becomes a `const` `operator()` by default (hence `mutable` to relax it). Understanding this desugaring answers almost every lambda interview question.

### Q2. Explain the capture modes and when to use each.

| Capture | Meaning |
|---|---|
| `[x]` | copy `x` into the closure |
| `[&x]` | store a reference to `x` |
| `[=]` | copy every used variable (and `this` by pointer, in a member fn) |
| `[&]` | reference every used variable |
| `[x, &y]` | mixed: copy `x`, reference `y` |
| `[y = expr]` | init-capture (C++14): new member `y` |

Guidance: **capture by value** when the lambda may outlive the enclosing scope (stored callbacks, async work, anything returned) — it's self-contained. **Capture by reference** only for lambdas that run and finish *within* the current scope (e.g. passed straight to `std::for_each`). Avoid the blanket `[=]`/`[&]` in non-trivial code; naming captures documents intent and avoids accidentally grabbing `this`. Prefer explicit captures for anything stored.

### Q3. What does `mutable` do on a lambda?

By default a lambda's `operator()` is `const`, so it can't modify its by-value captures. `mutable` removes that `const`, letting the body mutate the *copies* it holds — but the originals outside are unaffected.

```cpp
int count = 0;
auto gen = [count]() mutable { return ++count; };  // mutates the copy
gen(); gen();          // returns 1, then 2
// count outside is still 0
```

This is how you make a lambda with internal state (a counter, an accumulator) that persists across calls. Note it does *not* mean "mutate the captured variable" — for that you'd capture by reference (`[&count]`), which mutates the original and needs no `mutable`.

### Q4. What are generic lambdas and how do they work?

A generic lambda (C++14) uses `auto` for one or more parameters, making the closure's `operator()` a *template*:

```cpp
auto add = [](auto a, auto b){ return a + b; };
add(1, 2);        // int
add(1.5, 2.5);    // double
add(std::string{"a"}, "b");
```

The compiler generates a templated call operator, instantiated per argument-type combination — so it's as flexible as a function template but inline and anonymous. C++20 adds an explicit template-parameter syntax for when you need to name or constrain the type:

```cpp
auto first = []<class T>(const std::vector<T>& v){ return v.front(); };
```

Generic lambdas shine in STL pipelines and as transparent comparators (`[](auto& a, auto& b){ return a.id < b.id; }`).

### Q5. What is init-capture and what problem does it solve?

Init-capture (C++14) introduces a *new* closure member initialised from an arbitrary expression: `[name = expr]`. Its main job is **move-capture** — pre-C++14 you could only capture by copy or reference, so you couldn't move a move-only object (like `unique_ptr`) into a lambda.

```cpp
auto p = std::make_unique<Widget>();
auto task = [p = std::move(p)]{ p->run(); };   // moves ownership into the closure
```

It also lets you capture a *computed* value or rename: `[total = a + b]{ ... }`, or `[self = shared_from_this()]{ ... }` to keep an object alive for an async callback. Without init-capture you'd need an awkward helper struct. It's the idiomatic way to give a lambda owned state.

### Q6. The classic bug — capturing `this` vs `*this`. Explain the danger and the fix.

Inside a member function, capturing by `[this]` (or implicitly via `[=]`) stores a *raw pointer* to the enclosing object. If the lambda outlives the object — stored in a callback, posted to a thread, kept in a future — every member access through that pointer is a **use-after-free**.

```cpp
struct Session {
    int id;
    auto makeCallback() {
        return [this]{ return id; };   // DANGER if the callback outlives *this
    }
};
```

Fixes:
- **`[*this]`** (C++17) — capture a *copy* of the whole object into the closure; self-contained, no dangling.
- **Capture the needed members by value** — `[id = id]{ return id; }`.
- **Keep the object alive** — for `shared_ptr`-managed objects, `[self = shared_from_this()]{ self->id; }`.

This is *the* most common lambda bug in async/callback-heavy code. Any lambda that escapes the current scope must not hold a bare `this`.

### Q7. What does this print? (capture-by-reference trap)

```cpp
std::vector<std::function<int()>> fns;
for (int i = 0; i < 3; ++i)
    fns.push_back([&i]{ return i; });
for (auto& f : fns) std::cout << f() << ' ';
```

It prints `3 3 3` (and worse — it's actually undefined behaviour). Each lambda captured `i` **by reference**, so all three closures share a reference to the *same* loop variable. By the time you call them, the loop has finished and `i` is 3 — and since `i`'s scope ends with the loop, the references dangle.

Fix: capture by value so each closure snapshots its own `i`:

```cpp
fns.push_back([i]{ return i; });   // prints 0 1 2
```

This is the textbook demonstration of why stored/escaping lambdas should capture by value. (C++ has no per-iteration binding like some languages; the loop variable is one object.)

### Q8. What is `std::function`, and what does it cost?

`std::function<R(Args...)>` is a **type-erased** wrapper that can hold *any* callable matching that signature — a lambda, function pointer, functor, or bind result. It gives you a single concrete type to store in containers, pass across ABI boundaries, or use as a class member, hiding the callable's unique closure type.

The cost: (1) a likely **heap allocation** for captures too big for its small-buffer optimisation; (2) an **indirect call** through a type-erased dispatch (usually a virtual-like jump), which the compiler generally *cannot inline*. So a hot loop calling through a `std::function` is measurably slower than calling a lambda directly.

```cpp
std::function<int(int)> f = [](int x){ return x * 2; };  // erased, may allocate
auto g = [](int x){ return x * 2; };                     // concrete, inlines
```

Use `std::function` when you *need* type erasure (heterogeneous storage, stable member type); prefer `auto` or a template parameter when you can keep the concrete type.

### Q9. How do you write a recursive lambda?

A lambda can't refer to itself by name directly (it's being defined, and `auto` isn't deduced yet). Options:

**1. `std::function` (simple, has overhead):**
```cpp
std::function<int(int)> fact = [&](int n){ return n <= 1 ? 1 : n * fact(n - 1); };
```

**2. Y-combinator style — pass the lambda to itself (no `std::function` cost):**
```cpp
auto fact = [](auto self, int n) -> int { return n <= 1 ? 1 : n * self(self, n - 1); };
fact(fact, 5);   // 120
```

**3. Deducing `this` (C++23, cleanest):**
```cpp
auto fact = [](this auto self, int n) -> int { return n <= 1 ? 1 : n * self(n - 1); };
fact(5);   // self is the closure itself — no self-passing needed
```

The C++23 form is the modern answer; before that, the self-passing generic lambda avoids the `std::function` allocation.

### Q10. What's an IIFE and why use one for const initialisation?

An **immediately-invoked function expression** is a lambda you call right where you define it, using its return value. The idiom lets you initialise a `const` (or `constexpr`) variable that needs multi-step setup logic, without leaking a mutable temporary or a helper function:

```cpp
const auto config = []{
    Config c;
    c.load(defaults);
    if (envOverride()) c.apply(env);
    c.validate();
    return c;
}();   // note the trailing () — invoked immediately
```

Without it you'd either make `config` non-`const` (so you can mutate it during setup) or write a named helper function used once. The IIFE keeps the setup logic *local* and lets the result be `const`, which improves readability and lets the compiler assume immutability. It's the C++ answer to "complex const initialisation."

### Q11. Lambdas vs function objects (functors) — what's the difference?

They're nearly the same thing — a lambda *is* a compiler-generated functor. A functor is a class you write with an `operator()`; a lambda is that class written for you inline. Differences in practice:

- **Boilerplate** — lambdas are far terser for one-off callables; a functor needs a full class definition.
- **Reusability / naming** — a functor has a name and can be reused, have multiple methods, hold complex state, and be documented; a lambda is anonymous and local.
- **State** — both can hold state (functor via members, lambda via captures); functors give you explicit control over constructors and member access.
- **Templates** — a functor can be a class template with partial specialisations; a generic lambda only gives you a templated `operator()`.

Reach for a named functor when the callable is reused across the codebase, is genuinely stateful/complex, or benefits from a documented interface; use a lambda for the local, throwaway case (which is most of them).

### Q12. Can lambdas be `constexpr`? When does it matter?

Yes — since C++17, a lambda's `operator()` is *implicitly* `constexpr` if its body satisfies the constexpr rules (no captures of runtime values, only constexpr-eligible operations). You can also mark it explicitly:

```cpp
constexpr auto square = [](int n){ return n * n; };
static_assert(square(5) == 25);          // evaluated at compile time

constexpr int table[] = { square(1), square(2), square(3) };
```

This matters when you want to use a lambda inside constant expressions — building compile-time tables, in `static_assert`, or as a helper in `constexpr`/`consteval` functions. A captureless lambda is also convertible to a function pointer, and that conversion is itself `constexpr`. If the lambda captures non-constexpr state or does runtime-only work, it simply isn't usable in a constant expression — no error unless you try.

### Q13. Why prefer lambdas over `std::bind`?

`std::bind` (from C++11, and `bind1st`/`bind2nd` before it) does partial application — fixing some arguments of a callable. Lambdas do the same thing more clearly and efficiently, so `std::bind` is now considered legacy.

```cpp
auto add = [](int a, int b){ return a + b; };

// std::bind — placeholders, opaque type, harder to read
auto add5_bind = std::bind(add, 5, std::placeholders::_1);

// lambda — explicit, readable, inlines well
auto add5 = [](int b){ return add(5, b); };
```

Reasons lambdas win: (1) **readability** — no `_1`/`_2` placeholder puzzle; the parameters are named. (2) **performance** — `bind` returns an opaque object that often can't inline as well and can force extra copies; a lambda inlines cleanly. (3) **flexibility** — lambdas handle overloaded functions, perfect forwarding, and arbitrary logic that `bind` chokes on. (4) **correctness** — `bind`'s eager argument copying and nested-bind semantics are subtle. Scott Meyers' *Effective Modern C++* explicitly recommends lambdas over `bind` in nearly all cases.

### Q14. How do you write a higher-order function that returns a lambda?

A higher-order function takes or returns a callable. Returning a lambda that captures parameters lets you build specialised functions (a factory / partial application):

```cpp
// returns a callable that multiplies by `factor`
auto multiplier(int factor) {
    return [factor](int n){ return n * factor; };   // capture BY VALUE
}

auto triple = multiplier(3);
triple(10);   // 30
```

Two rules matter here. (1) **Capture by value**, not reference — `factor` is a parameter local to `multiplier`; capturing `[&factor]` would return a lambda holding a dangling reference (UB) the moment `multiplier` returns. (2) **Return type** — `auto` return works; if you need a *concrete* return type (e.g. to store in a container or expose in a header), return `std::function<int(int)>` at the cost of type erasure. This factory pattern — returning a configured closure — is the everyday use of higher-order functions in C++, from custom comparators to callback builders.
## Modern C++ (C++11 to 23 highlights)

### Summary

**What this topic covers**

The arc of "Modern C++" — everything from C++11 onward that turned C++ from a manual-memory, verbose, error-prone language into something that reads closer to a high-level language while keeping zero-overhead abstraction. This topic is a guided tour of what each standard *added* and, more importantly, *which features you should actually adopt* on a real codebase. The 18 questions walk through the four big releases: **C++11** (the reset — `auto`, lambdas, move semantics, `nullptr`, range-`for`, `unique_ptr`/`shared_ptr`, `std::thread`, `constexpr`, uniform initialisation, variadic templates), **C++14** (the polish — generic lambdas, return-type deduction, `make_unique`), **C++17** (the pragmatic upgrade — structured bindings, `if constexpr`, `optional`/`variant`/`any`, `string_view`, fold expressions, parallel algorithms, guaranteed copy elision, `[[nodiscard]]`), **C++20** (the second reset — concepts, ranges, coroutines, modules, the spaceship operator, `std::span`, `std::format`, designated initialisers), and **C++23** (the fill-in — `std::expected`, `std::print`, `std::mdspan`, deducing `this`, `std::flat_map`). The framing throughout is a senior engineer's: what earns its place in your style guide, what's a footgun, and what's still not ready.

**Mental model**

C++ ships a new standard every three years, and each is *strictly additive* — old code keeps compiling (with rare, carefully-managed removals). So "Modern C++" isn't a language you switch to; it's a set of idioms you layer on. The load-bearing shift is **value semantics + RAII + move**: instead of `new`/`delete` and raw owning pointers, you express ownership in the type system (`unique_ptr` = sole owner, `shared_ptr` = shared, value = copy) and let destructors run deterministically at scope exit. Move semantics (C++11) made returning and passing big objects cheap, which made value semantics the *default* rather than a performance compromise. On top of that, C++17 and C++20 pushed more work to **compile time** (`constexpr`, `if constexpr`, concepts) and made generic code *checkable* rather than duck-typed. The practical rule: reach for the highest standard your toolchain supports, adopt the features that remove a class of bug (smart pointers kill leaks, `optional` kills sentinel values, concepts kill unreadable template errors), and be cautious with the features that are powerful but sharp (coroutines, modules, `shared_ptr` overuse).

**Key terms**

- **Move semantics** — transferring resources out of an rvalue instead of copying; enabled by rvalue references (`T&&`) and `std::move`.
- **RAII** — Resource Acquisition Is Initialisation; tie resource lifetime to object lifetime so destructors release deterministically.
- **`auto`** — type deduction from the initialiser; strips top-level `const`/reference unless you write `auto&`/`const auto&`.
- **`constexpr`** — usable in constant expressions; may run at compile time. `consteval` (C++20) *must*.
- **Uniform initialisation** — brace `{}` init; prevents narrowing, but interacts with `std::initializer_list` in surprising ways.
- **Structured bindings** (C++17) — `auto [a, b] = pair;` to destructure tuples/pairs/aggregates.
- **`if constexpr`** (C++17) — compile-time branch that discards the untaken arm; the workhorse of template metaprogramming.
- **Concepts** (C++20) — named, checkable constraints on template parameters; replace SFINAE for readability.
- **Ranges** (C++20) — composable, lazy views over sequences with the pipe (`|`) syntax.
- **Coroutines** (C++20) — functions that suspend/resume via `co_await`/`co_yield`/`co_return`.
- **Modules** (C++20) — a replacement for textual `#include` with real semantic boundaries and faster builds.
- **`std::expected`** (C++23) — a value-or-error type for error handling without exceptions.

**Why interviewers ask this**

This is the fastest way to date a candidate. Someone who writes `NULL`, raw `new`/`delete`, `typedef`, and hand-rolled `for (int i = 0; i < n; ++i)` loops over containers has not touched the language since 2010, regardless of years on their CV. A senior C++ engineer in 2026 reaches for `auto`, smart pointers, range-`for`, `std::optional`, structured bindings, and `std::format` reflexively — and, crucially, can *justify* each choice and name its cost (e.g. "I default to `unique_ptr` and only promote to `shared_ptr` when ownership is genuinely shared, because atomic refcounting isn't free"). Interviewers also probe judgement: knowing that a feature *exists* (coroutines, modules) is junior-level; knowing whether it's production-ready in your toolchain and worth the complexity is senior-level. The best answers are opinionated and version-aware.

**Common confusions**

- "`auto` makes C++ dynamically typed" — no; `auto` is fully static, it just infers the type at compile time. Types are as strict as ever.
- "Move is a deep operation" — move typically just steals pointers/handles and null out the source; it's cheap precisely because it *doesn't* copy the payload.
- "`shared_ptr` is the safe default" — `unique_ptr` is. `shared_ptr` adds atomic refcount overhead and enables cycles that leak. Default to unique; share deliberately.
- "`constexpr` guarantees compile-time evaluation" — it only *permits* it. Use `consteval` (C++20) to force it, or evaluate in a `constexpr` variable/`static_assert` context.
- "Modules are drop-in ready" — as of 2026 toolchain and build-system support (CMake, package managers) is improving but still uneven; adopt with eyes open.
- "`string_view` is a free `const string&`" — it's a non-owning view; dangling it past the backing string's lifetime is UB.

**What follows from this topic**

Modern C++ is the umbrella; the two topics that follow drill into its deepest new machinery. **constexpr, Concepts & Ranges (C++20)** takes the compile-time and generic-programming story further — how concepts replace SFINAE and how lazy ranges compose. **Coroutines (C++20)** unpacks the single most complex feature added since templates. Everywhere else in this primer — smart pointers, move semantics, the memory model — you're applying the idioms introduced here. If a candidate is fuzzy on move semantics or smart-pointer ownership, that's the foundation to shore up before ranges or coroutines make any sense.

### Q1. What are the headline features C++11 added, and why is it called a "reset"?

C++11 is the largest single change in the language's history — it's why people say "Modern C++ starts here." The load-bearing additions:

- **Move semantics** (`T&&`, `std::move`) — return and pass big objects cheaply; made value semantics the default.
- **Smart pointers** (`unique_ptr`, `shared_ptr`, `weak_ptr`) — express ownership in the type system; end manual `new`/`delete`.
- **`auto`** and **range-`for`** — kill verbose iterator boilerplate.
- **Lambdas** — inline callable objects, closing over local state; made `<algorithm>` usable.
- **`nullptr`** — a real null-pointer type, ending the `NULL`/`0` ambiguity in overload resolution.
- **`constexpr`** — compute at compile time.
- **Uniform initialisation** (`{}`) — one syntax, narrowing prevention.
- **Variadic templates** — type-safe variable-argument generic code (`std::tuple`, `make_shared`).
- **The memory model + `<thread>`, `<mutex>`, `<atomic>`** — the first *standard* concurrency, with defined semantics.
- **`= default` / `= delete`, `override`, `final`, `enum class`, `static_assert`, `decltype`, `using` aliases.**

It's a "reset" because writing idiomatic C++11 looks almost nothing like C++98: no raw owning pointers, no manual loops over containers, no `NULL`, no functor structs where a lambda fits.

### Q2. What did C++14 add? Is it a big release?

C++14 is deliberately small — a "bug-fix and polish" release cleaning up C++11's rough edges. The ones you use daily:

- **Generic lambdas** — `auto` parameters: `[](auto x, auto y){ return x + y; }`. Effectively a lambda that's a template.
- **Return-type deduction for normal functions** — `auto f() { return 42; }`; no trailing `-> int` needed.
- **`std::make_unique`** — C++11 shipped `make_shared` but *forgot* `make_unique`; C++14 fixed the omission. Prefer it over `new`.
- **Relaxed `constexpr`** — loops, local variables, and multiple statements allowed inside `constexpr` functions (C++11 restricted you to a single `return`).
- **Variable templates**, **binary literals** (`0b1010`), **digit separators** (`1'000'000`), and **`[[deprecated]]`**.

If you can only remember one thing: `make_unique` lives in C++14.

### Q3. What are the most impactful C++17 features for everyday code?

C++17 is the pragmatic sweet spot many shops still target. The high-value additions:

- **Structured bindings** — `auto [key, val] = *it;` — destructure pairs, tuples, and aggregates.
- **`if constexpr`** — compile-time branching that discards the dead arm; hugely simplifies templates versus tag dispatch/SFINAE.
- **`std::optional`, `std::variant`, `std::any`** — vocabulary types for "maybe a value," "one of N types," and "type-erased value."
- **`std::string_view`** — non-owning string reference; pass substrings without copying.
- **Fold expressions** — `(args + ...)` — collapse variadic packs without recursion.
- **Parallel algorithms** — execution policies: `std::sort(std::execution::par, ...)`.
- **Guaranteed copy elision** — prvalues are never copied/moved into their destination; enables returning non-movable types.
- **`[[nodiscard]]`, `[[maybe_unused]]`, `[[fallthrough]]`** — attributes that let the compiler catch mistakes.
- **`std::filesystem`**, inline variables, `constexpr if`, and class template argument deduction (CTAD: `std::pair p{1, 2.0};`).

Adopt structured bindings, `optional`, `string_view`, and `if constexpr` reflexively — they remove whole categories of boilerplate and bugs.

### Q4. Explain move semantics and what problem it solves.

Before C++11, returning a large container copied it (or relied on fragile compiler optimisations). Move semantics gives you a way to *transfer* ownership of a resource instead of duplicating it.

```cpp
std::vector<int> make() {
    std::vector<int> v(1'000'000);
    return v;              // moved (or elided), not copied
}
std::string a = "long string...";
std::string b = std::move(a);   // b steals a's buffer; a is now valid-but-unspecified
```

Mechanically: an rvalue reference (`T&&`) binds to temporaries and things you've `std::move`d. A move constructor/assignment steals the source's internal pointers/handles and leaves the source in a valid, destructible, but unspecified state — typically empty. It's cheap because it copies a few pointers, not the payload.

The senior points: (1) `std::move` doesn't move anything — it's just a cast to rvalue that *enables* a move. (2) After moving from an object, only reassign or destroy it; don't assume its value. (3) Prefer to return by value and let move/elision handle it — don't return `T&&` or output-parameter hack.

### Q5. What is perfect forwarding and when do you need it?

Perfect forwarding lets a generic wrapper pass its arguments to another function *preserving their value category* (lvalue vs rvalue) and const-ness — so an rvalue stays movable and an lvalue stays copyable.

```cpp
template <typename... Args>
auto make(Args&&... args) {
    return Widget(std::forward<Args>(args)...);
}
```

The pieces: a **forwarding (universal) reference** `T&&` on a deduced template parameter binds to either lvalue or rvalue; `std::forward<T>` conditionally casts back to an rvalue only when the original argument was one. You need it any time you write a wrapper that should be transparent to overload resolution — factory functions (`make_unique`), `emplace_back`, `std::invoke`, container adapters.

Gotcha: `T&&` is only a forwarding reference when `T` is *deduced* on that function. `void f(std::string&& s)` is a plain rvalue reference; `template<class T> void f(T&& t)` is a forwarding reference.

### Q6. What was new about C++20, and why is it also called a "second reset"?

C++20 is the second-largest release after C++11, adding four independent large features plus many smaller ones:

- **Concepts** — named, checkable constraints on templates; readable errors, replaces SFINAE.
- **Ranges** — composable lazy views with pipe syntax: `v | views::filter(even) | views::transform(square)`.
- **Coroutines** — suspendable functions (`co_await`/`co_yield`/`co_return`).
- **Modules** — semantic replacement for `#include`.
- **The spaceship operator `<=>`** — declare `operator<=>` once, get all six comparisons.
- **`std::span`** — non-owning view over a contiguous range (the array analogue of `string_view`).
- **`std::format`** — Python-style type-safe formatting, finally replacing `printf`/`iostream` verbosity.
- **`constexpr` almost everything** — `constexpr` `std::vector`/`std::string`, virtual functions, `try`/`catch`, dynamic allocation at compile time.
- **Designated initialisers** — `Widget{.width = 10, .height = 20}`.
- **`consteval`, `constinit`, `[[likely]]`/`[[unlikely]]`, `std::jthread`, calendar/timezone in `<chrono>`, `std::bit_cast`.**

"Second reset" because concepts + ranges change how you write generic code, and coroutines/modules change program structure.

### Q7. What does the spaceship operator `<=>` do, and how do I use it?

`operator<=>` (three-way comparison) lets you define ordering *once* and have the compiler synthesise `<`, `>`, `<=`, `>=`, `==`, and `!=`.

```cpp
struct Version {
    int major, minor, patch;
    auto operator<=>(const Version&) const = default;   // all six comparisons
};
```

`= default` gives you memberwise lexicographic comparison for free — a huge boilerplate saving. The return type is a *comparison category*: `std::strong_ordering` (total order, equal means substitutable), `std::weak_ordering` (equal means equivalent, e.g. case-insensitive strings), or `std::partial_ordering` (some values incomparable, e.g. floats with `NaN`).

Subtlety: defaulting `<=>` also gives you `==` *only if you default it* — since C++20 `==` is synthesised separately, so defaulted `<=>` implies a defaulted `==` for the relational-plus-equality set. When you write a custom `<=>` returning `partial_ordering` for floats, you often still default `==` explicitly.

### Q8. What is `std::format` and why prefer it over iostreams or printf?

`std::format` (C++20) is type-safe, extensible, Python-style string formatting:

```cpp
std::string s = std::format("{} scored {:.1f}% ({:d}/{})", name, pct, hits, total);
```

Advantages over the alternatives:

- **vs `printf`** — type-safe (no format-string/argument mismatch UB), works with user types via `formatter` specialisation, no varargs footguns.
- **vs `iostream`** — far less verbose (no `<<` chains, no `std::setprecision`/`std::fixed` state manipulation), and the format string keeps arguments and layout together and readable.

Positional args (`{0} {1} {0}`), fill/align (`{:*^10}`), and locale support are all built in. C++23 adds `std::print`/`std::println` so you can write `std::print("{}\n", x)` directly to `stdout` without building a string first. If your toolchain lacks it, `{fmt}` is the reference library it was based on.

### Q9. What is `std::span` and how does it differ from `std::string_view`?

`std::span<T>` (C++20) is a non-owning, bounds-carrying view over a contiguous sequence — a `{pointer, length}` pair. It generalises the "pass an array without decaying to a raw pointer" pattern.

```cpp
int sum(std::span<const int> xs) {           // accepts vector, array, C-array, subrange
    int total = 0;
    for (int x : xs) total += x;
    return total;
}
```

Relationship to `string_view`: `string_view` is essentially `span<const char>` with string-specific operations (`substr`, `find`, comparison). Use `span` for arbitrary element types, `string_view` for text.

Both are **non-owning** — the same dangling hazard applies: never store a `span`/`string_view` that outlives its backing storage, and never return one referring to a local. `span` can be mutable (`span<int>`) whereas `string_view` is always read-only.

### Q10. What did C++23 add that's worth adopting?

C++23 is a consolidation release filling gaps left by C++20:

- **`std::expected<T, E>`** — value-or-error return type; structured error handling without exceptions, with monadic `and_then`/`transform`/`or_else`.
- **`std::print` / `std::println`** — `std::print("{}\n", x)` straight to output; the ergonomic front end for `std::format`.
- **Deducing `this`** (explicit object parameter) — write member functions that deduce their own const/ref/value category, eliminating the classic four-overload boilerplate.
- **`std::mdspan`** — a multidimensional, non-owning array view for numerical/scientific code.
- **`std::flat_map` / `std::flat_set`** — sorted-vector-backed associative containers: cache-friendly, faster iteration and lookup than `std::map` for many workloads, slower insertion.
- **`std::generator`** — the standard's first coroutine type: a lazy sequence generator (see the Coroutines topic).
- **`if consteval`, `std::stacktrace`, `std::move_only_function`, `[[assume]]`, `std::byteswap`, ranges additions** (`views::zip`, `views::enumerate`, `views::chunk`).

The two to reach for first: `std::expected` (better errors) and `std::print` (better output).

### Q11. What is `std::expected` and how does it compare to exceptions and `optional`?

`std::expected<T, E>` (C++23) holds *either* a success value of type `T` *or* an error of type `E`. It's the answer to "I want to signal failure without throwing, but I need to carry *why* it failed."

```cpp
std::expected<Config, ParseError> parse(std::string_view text);

auto result = parse(input);
if (result) use(*result);
else log(result.error());
```

Comparison:

| | `optional<T>` | `expected<T,E>` | exceptions |
|---|---|---|---|
| Carries error detail | No (just "empty") | Yes (`E`) | Yes (exception object) |
| Control flow | explicit | explicit | non-local (stack unwind) |
| Cost on failure | none | none | throw is expensive |
| Composability | `and_then` | `and_then`/`or_else`/`transform` | try/catch |

Use `optional` when failure has no useful detail ("not found"), `expected` when the caller needs the reason and you want visible, cheap error paths, and exceptions for truly exceptional / unrecoverable conditions or where error propagation across many layers would drown in boilerplate. `expected`'s monadic operations let you chain fallible steps without a pyramid of `if`s.

### Q12. What is "deducing this" (explicit object parameter) in C++23?

Traditionally, if you wanted a member function to work correctly for `const`/non-`const`/lvalue/rvalue objects, you wrote up to four near-identical overloads. Deducing `this` lets you write *one* template that deduces the object's own type:

```cpp
struct Widget {
    std::vector<int> data;
    template <typename Self>
    auto&& items(this Self&& self) {
        return std::forward<Self>(self).data;   // const/ref-correct in one shot
    }
};
```

The explicit object parameter (`this Self&& self`) replaces the implicit `this`. Benefits: (1) collapse the const/non-const overload pair; (2) perfect-forward the object itself (return by value from rvalue, by ref from lvalue); (3) write recursive lambdas (`[](this auto self, int n){ ... self(n-1) ...; }`) without the `Y`-combinator trick; (4) implement CRTP-style patterns without the base-class template parameter. It's a niche-but-elegant feature that removes real boilerplate in library code.

### Q13. Should I adopt C++20 modules today?

Cautiously. Modules replace textual `#include` with a real semantic unit: `import std;` instead of dozens of headers, no macro leakage, no include-order fragility, and — the promised payoff — dramatically faster builds because a module is compiled once into a binary interface rather than re-parsed in every translation unit.

The reality in 2026: compiler support (GCC, Clang, MSVC) is largely there, but **build-system and package-manager integration is the bottleneck**. CMake support exists but is still maturing; third-party libraries mostly still ship headers; mixing modular and header code has sharp edges. `import std;` (standardised in C++23) is the most tractable entry point.

Senior take: worth prototyping on a greenfield internal project to learn the ergonomics, but not yet worth a big-bang migration of an existing header-based codebase. Watch your specific toolchain's support matrix rather than trusting "C++20 has modules" as a green light.

### Q14. What are structured bindings and where do they shine?

Structured bindings (C++17) destructure a compound object into named locals:

```cpp
std::map<std::string, int> scores;
for (const auto& [name, score] : scores)        // instead of it->first / it->second
    std::print("{}: {}\n", name, score);

auto [iter, inserted] = scores.insert({"alice", 10});
auto [q, r] = std::div(17, 5);
```

They work on: `std::pair`/`std::tuple`, aggregate structs (binds public members in declaration order), and fixed-size arrays. The killer use cases are iterating maps (kills `.first`/`.second`), consuming multi-return functions (`insert`, `from_chars`, `div`), and destructuring small structs.

Gotchas: the binding names are *not* independent variables — they alias members of a hidden object; and `auto [a, b]` copies, `auto& [a, b]` references. You can't (pre-C++26) mark individual bindings differently or ignore one with `_` cleanly, and you can't use them as lambda captures directly before C++20.

### Q15. What does this print? (move-from footgun)

```cpp
std::string a = "hello";
std::string b = std::move(a);
std::cout << "a=[" << a << "] b=[" << b << "]\n";
```

**Answer:** `b=[hello]` is guaranteed. `a` is in a *valid but unspecified* state — in every mainstream implementation it prints empty (`a=[]`), but the standard does **not** guarantee that; it only guarantees `a` is destructible and assignable.

The teaching point: after `std::move(a)`, you may *not* rely on `a`'s value. The only legal operations are those with no precondition on the current value — destroy it, or assign a new value. Reading a moved-from object and depending on the result is a portability bug waiting to happen, even though it "works" on your compiler today. Tools like clang-tidy's `bugprone-use-after-move` will flag it.

### Q16. Why is `unique_ptr` the default and `shared_ptr` the exception?

Because ownership should be as *simple* and *explicit* as the problem allows, and shared ownership is rarely the actual requirement.

`unique_ptr` is zero-overhead: it's the size of a raw pointer, its destructor just calls `delete`, and it *documents* sole ownership. Moving it transfers ownership; copying is deleted, so you can't accidentally create two owners.

`shared_ptr` costs more: a separate control block, **atomic** reference-count increments/decrements on every copy (even single-threaded), and the ever-present risk of **reference cycles** that leak (two objects holding `shared_ptr`s to each other never reach zero — you need `weak_ptr` to break the cycle). It also obscures ownership: "who frees this?" becomes "whoever holds the last reference," which is harder to reason about.

Rule of thumb: model ownership with `unique_ptr` first. Promote to `shared_ptr` only when the object genuinely has multiple independent owners with non-nested lifetimes (e.g. a cache entry referenced by several subsystems). Prefer passing raw pointers/references for *non-owning* access — a function that just *uses* an object shouldn't take a smart pointer at all.

### Q17. How do you decide which C++ standard to target on a real project?

It's a constraint-satisfaction problem, not a "newest is best" decision:

1. **Toolchain floor** — what compilers must build this? Embedded/vendor toolchains often lag. Your target is the newest standard *all* required compilers support well. In 2026 that's commonly C++20; conservative shops sit on C++17.
2. **Dependencies** — your libraries and their ABI expectations. Mixing standards across a shared ABI boundary can be fine, but be deliberate.
3. **Feature payoff** — which new features remove real pain? C++17's `optional`/`string_view`/structured bindings pay off immediately; C++20 concepts/ranges pay off in generic-heavy code; modules are still speculative.
4. **CI cost** — bumping the standard means re-validating warnings, ABI, and third-party builds.

Senior answer: default to the highest standard your CI matrix fully supports, enable `-std=c++20` (or `c++17`) explicitly rather than relying on the compiler default, and adopt features incrementally behind your style guide rather than rewriting to chase novelty.

### Q18. Name three "modernisation" refactors that reliably improve legacy C++.

1. **Raw owning pointers → smart pointers.** Replace `new`/`delete` pairs and owning raw pointers with `unique_ptr` (and `shared_ptr` where sharing is real). This eliminates leaks, double-frees, and most manual exception-safety bugs in one pass. Run under ASan afterwards to catch what's left.

2. **Index/iterator loops → range-`for` and algorithms.** `for (int i = 0; i < v.size(); ++i)` becomes `for (auto& x : v)` or a named `<algorithm>` call (`std::find_if`, `std::transform`, `std::accumulate`). Fewer off-by-one and signedness bugs, clearer intent. C++20 ranges take this further with composable views.

3. **`NULL`/`0` → `nullptr`, `typedef` → `using`, C casts → named casts, output params → return-by-value.** These are mechanical and low-risk: `nullptr` fixes overload-resolution ambiguity, `static_cast`/`reinterpret_cast` make intent (and grep-ability) explicit, and returning by value (relying on move/elision) beats the old "pass a `T&` to fill in" pattern for readability. Pair with `[[nodiscard]]` on functions whose results must not be ignored.

The discipline: do these as *separate, mechanical commits* from behaviour changes, validate each under `-Wall -Wextra` and sanitizers, and let clang-tidy's modernize-* checks automate the boilerplate.

## constexpr, Concepts & Ranges (C++20)

### Summary

**What this topic covers**

The three C++20 features that most changed how you write *generic and compile-time* code: compile-time evaluation (`constexpr`/`consteval`/`constinit`), constraints on templates (concepts and `requires`), and composable lazy sequence processing (ranges). These are the "compile-time and generic programming" pillar of modern C++ — the machinery that lets you push work to the compiler, get readable errors from generic code, and write pipeline-style data transformations. The 14 questions cover: the `constexpr` family and what "compile-time evaluation" actually means (including C++20's `constexpr` containers and allocation); `if constexpr` for compile-time branching; concepts as named constraints, `requires` clauses versus requires-expressions, and the standard concept library (`std::integral`, `std::sortable`, etc.); how concepts replace SFINAE and how constraint subsumption orders overloads; and ranges — views, laziness, `filter`/`transform`/`take`, the pipe operator, projections, `std::ranges` algorithms versus the classic iterator ones, borrowed ranges and dangling, plus where ranges help readability and where they bite.

**Mental model**

Two mental models sit under this topic. First, **the compile/run-time boundary is now programmable**. `constexpr` means "*may* run at compile time"; `consteval` means "*must*"; `constinit` means "initialised at compile time but mutable at runtime." C++20 pushed this far enough that you can allocate, use `std::vector`/`std::string`, and run real algorithms during constant evaluation — the compiler runs an interpreter over your code. Second, **generic code is now *constrained* rather than duck-typed**. Pre-C++20, a template accepted anything and failed deep inside instantiation with a wall of errors. A **concept** is a named predicate on types; putting it on a template parameter checks the requirement *at the call site* with a readable message, and the compiler uses which constraints are *more specific* (subsumption) to pick the best overload. **Ranges** apply the same rigour to sequences: a *view* is a lazy, cheap-to-copy adaptor that computes elements on demand as you iterate, and the pipe operator composes views into a pipeline that does one pass with no intermediate containers.

**Key terms**

- **`constexpr`** — usable in a constant expression; *permits* compile-time evaluation, doesn't force it.
- **`consteval`** — immediate function; *must* be evaluated at compile time (an "immediate function").
- **`constinit`** — guarantees static/thread-local initialisation happens at compile time (kills the static init order fiasco); the variable stays mutable.
- **`if constexpr`** — branch resolved at compile time; the untaken branch is discarded (not instantiated).
- **Concept** — a named boolean predicate on template parameters (`template<class T> concept Foo = ...;`).
- **`requires` clause** — attaches a constraint to a template (`template<class T> requires Foo<T>`).
- **Requires-expression** — `requires(T a){ a.size(); }` — a compile-time check that expressions are well-formed; *yields* a bool.
- **Subsumption** — the ordering of constraints; a more-constrained overload is preferred when its constraints logically imply another's.
- **Range** — anything with `begin()`/`end()`; a **view** is a range that's cheap to copy and non-owning.
- **View adaptor** — a lazy transformation (`views::filter`, `views::transform`, `views::take`) composed with `|`.
- **Projection** — a callable a ranges algorithm applies to each element before comparing/using it (e.g. sort by a field).
- **Borrowed range** — a range whose iterators stay valid even when the range itself is a temporary; non-borrowed temporaries yield `dangling`.

**Why interviewers ask this**

These features separate engineers who *write* generic C++ from those who only *consume* it. Anyone can call `std::sort`; a senior can constrain a template with a concept, explain why the error message improved, and reason about which overload subsumption picks. Interviewers probe `constexpr` to test understanding of the compile/run-time boundary — a classic follow-up is "does `constexpr` *guarantee* compile-time evaluation?" (no). Concepts questions reveal whether a candidate has actually moved past SFINAE or just heard the word. Ranges questions test two things at once: fluency with the modern idiom, *and* awareness of its traps (laziness surprises, dangling views, debug-build performance). The strongest signal is *judgement* — knowing that ranges make some code far clearer and other code slower or harder to debug, and being able to say which is which.

**Common confusions**

- "`constexpr` runs at compile time" — only when it *can* and is used in a constant-expression context; otherwise it runs at runtime like a normal function.
- "Concepts are just prettier SFINAE" — they're checkable, composable, *named*, and participate in overload ordering via subsumption; SFINAE does none of that cleanly.
- "Ranges are eager like Java streams collect" — views are **lazy**; nothing happens until you iterate or convert to a container.
- "`views::filter` copies elements" — no; views reference the underlying range and compute lazily. Copying the *view* is cheap; the data isn't copied.
- "A view owns its data" — most don't. Piping off a temporary container can dangle.
- "`std::ranges::sort` needs `begin()/end()`" — no, that's the point: it takes the range directly and supports projections.

**Common confusions (cont.)**

- "`consteval` and `constexpr` are interchangeable" — `consteval` forbids runtime calls entirely; use it for things that must never leak to runtime.

**What follows from this topic**

This is the compile-time/generic core of Modern C++. It builds directly on the template and `constexpr` foundations from the **Modern C++** topic and feeds into **Coroutines (C++20)**, which reuses the same "library provides customisation points, you compose" philosophy — a coroutine's return type is a concept-shaped contract, and `std::generator` is consumed exactly like a range. If concepts and ranges click, the rest of the C++20/23 standard library reads as variations on the same theme: named constraints, lazy composition, and moving work to compile time.

### Q1. What's the difference between `constexpr`, `consteval`, and `constinit`?

They control *when* something is evaluated or initialised:

- **`constexpr`** — the value or function *can* be used in a constant expression. A `constexpr` function runs at compile time when called in a constant-expression context, otherwise at runtime. It's a *permission*, not a guarantee.
- **`consteval`** (C++20) — an **immediate function**; every call *must* produce a compile-time constant. Calling it in a runtime context is a compile error. Use it when a computation must never leak into the binary as runtime work (e.g. building a lookup table, validating a format string).
- **`constinit`** (C++20) — applies to a static/thread-local variable and *guarantees* its initialisation happens at compile time, eliminating the static-initialisation-order fiasco. Unlike `constexpr`, the variable is **not** const — you can mutate it at runtime.

```cpp
constexpr int sq(int x) { return x * x; }        // maybe compile-time
consteval int cube(int x) { return x * x * x; }  // always compile-time
constinit int counter = sq(3);                   // init at compile time, mutable after
```

### Q2. Does `constexpr` guarantee compile-time evaluation? How do you force it?

No. `constexpr` only makes a function *eligible* for constant evaluation. Whether it actually runs at compile time depends on the *context*:

```cpp
constexpr int f(int x) { return x * 2; }
int a = f(10);            // MAY run at compile time; compiler's choice
constexpr int b = f(10);  // MUST be compile-time (constexpr variable context)
static_assert(f(10) == 20); // MUST be compile-time
int n = read();           // runtime input
int c = f(n);             // definitely runtime — n isn't a constant
```

To *force* compile-time evaluation you either (a) use the result in a context that requires a constant expression — `constexpr` variable, `static_assert`, template argument, array bound — or (b) declare the function `consteval`, which makes every call immediate. This distinction is a favourite interview trap: candidates who say "`constexpr` means compile-time" are betraying a shallow model.

### Q3. What can you do at compile time in C++20 that you couldn't before?

C++20 dramatically widened `constexpr`:

- **Dynamic allocation** — `new`/`delete` are allowed in constant evaluation, provided every allocation is freed before evaluation ends (no leaks escape to runtime).
- **`constexpr` `std::vector` and `std::string`** — because allocation works, these containers are usable at compile time. You can build, sort, and query a vector inside a `constexpr` function.
- **`constexpr` virtual functions**, **`try`/`catch`** (the `catch` just can't be taken), **`constexpr` destructors**, and **union member changes**.
- **`std::is_constant_evaluated()`** — branch on whether you're currently in a constant-evaluation context (e.g. use a compile-time-friendly algorithm at compile time, a SIMD one at runtime).

```cpp
constexpr int sum_evens(int n) {
    std::vector<int> v;                 // allocation at compile time (C++20)
    for (int i = 0; i <= n; ++i) if (i % 2 == 0) v.push_back(i);
    return std::accumulate(v.begin(), v.end(), 0);
}
static_assert(sum_evens(10) == 30);
```

The catch: any allocation made during constant evaluation must be released before it finishes — you can't return a compile-time-allocated `vector` *out* to runtime (until `constexpr`-to-runtime lifetime rules relax in later standards).

### Q4. How does `if constexpr` differ from a normal `if`, and why does it matter for templates?

A normal `if` evaluates its condition at runtime and *both* branches must compile. `if constexpr` (C++17) evaluates a compile-time condition and **discards the untaken branch** — the discarded branch isn't instantiated, so it may contain code that would be ill-formed for the current type.

```cpp
template <typename T>
std::string stringify(T v) {
    if constexpr (std::is_arithmetic_v<T>)
        return std::to_string(v);           // only compiled for numbers
    else
        return std::string(v);              // only compiled for string-likes
}
```

With a plain `if`, `std::to_string(v)` would have to compile even when `T` is a `std::string`, which fails. `if constexpr` makes the untaken branch vanish. This single feature replaces most uses of tag dispatch, SFINAE overload sets, and template specialisation for "pick behaviour based on a type trait" — it's the readable way to branch generic code on compile-time properties.

### Q5. What is a concept, and how is it better than SFINAE?

A **concept** is a named, reusable predicate on template parameters:

```cpp
template <typename T>
concept Numeric = std::integral<T> || std::floating_point<T>;

template <Numeric T>
T twice(T x) { return x + x; }
```

Compare the SFINAE equivalent — `std::enable_if_t<std::is_arithmetic_v<T>, T>` smeared across the signature, cryptic on failure. Concepts win on four counts:

1. **Readable errors** — a failed concept says "constraint `Numeric<std::string>` not satisfied," not a 200-line instantiation dump.
2. **Named and reusable** — `Numeric` documents intent and is reused across functions.
3. **Composable** — combine with `&&`/`||`; the compiler understands the logical structure.
4. **Overload ordering via subsumption** — a more-constrained overload is preferred automatically; SFINAE requires manual, fragile disambiguation.

Concepts also enable the terse `void f(std::integral auto x)` syntax and constrained `auto`. They are the intended replacement for the SFINAE idiom in almost all new code.

### Q6. Explain `requires` clauses versus requires-expressions.

They're two different things that often appear together:

A **`requires` clause** *attaches* a constraint to a template. It takes a compile-time boolean (often a concept):

```cpp
template <typename T>
requires std::integral<T>       // requires clause
T half(T x) { return x / 2; }
```

A **requires-expression** *produces* a boolean by checking whether certain expressions are well-formed:

```cpp
template <typename T>
concept Container = requires(T c) {   // requires-expression
    c.begin();
    c.end();
    typename T::value_type;
    { c.size() } -> std::convertible_to<std::size_t>;   // compound requirement
};
```

Inside a requires-expression you can state simple requirements (`c.begin();` — must compile), type requirements (`typename T::value_type;`), compound requirements with a return-type constraint (`{ expr } -> Concept;`), and nested requirements (`requires Foo<T>;`). The confusing part is the `requires requires` idiom — a requires *clause* whose condition is an ad-hoc requires *expression*: `template<class T> requires requires(T t){ t.f(); } void g(T);`. Prefer naming a concept instead for readability.

### Q7. How does constraint subsumption pick between overloads?

When two constrained overloads both match, the compiler prefers the one whose constraints **subsume** (logically imply) the other's — i.e. the *more constrained* one.

```cpp
template <std::integral T>            void f(T);          // #1
template <std::integral T>
    requires std::is_signed_v<T>      void f(T);          // #2 (more constrained)

f(5);   // picks #2 for signed int — its constraints subsume #1's
```

Subsumption works on the *decomposed* atomic constraints: `#2`'s constraint `integral<T> && is_signed_v<T>` implies `#1`'s `integral<T>`, so `#2` is more specialised and wins. This replaces the old SFINAE "priority tag" tricks with a principled ordering.

The subtlety: subsumption only reasons about constraints that are *syntactically* the same atomic constraints. Two `requires`-expressions that check "the same thing" but are written differently don't subsume each other — the compiler treats them as unrelated atomic constraints. This is why factoring shared requirements into *named concepts* matters: it lets subsumption actually see the implication.

### Q8. What is a range and a view, and why are views lazy?

A **range** is anything you can iterate — it exposes `begin()` and `end()` (via `std::ranges::begin/end`). Every standard container is a range.

A **view** is a special range that is *non-owning* and *cheap (O(1)) to copy/move*. Views are the composable building blocks: `views::filter`, `views::transform`, `views::take`, etc. They're **lazy** — constructing a view does no work; elements are computed on demand as you iterate.

```cpp
std::vector<int> v{1,2,3,4,5,6};
auto evens_squared = v | std::views::filter([](int x){ return x % 2 == 0; })
                       | std::views::transform([](int x){ return x * x; });
// nothing computed yet
for (int x : evens_squared) std::print("{} ", x);  // 4 16 36 — computed here, one pass
```

Laziness matters because it means the pipeline needs **no intermediate containers** — filter and transform are fused into a single pass, and if you only consume the first few elements (`views::take(2)`), the rest are never computed. It's the difference between eager `std::transform`-into-a-new-vector and a fused, on-demand pipeline.

### Q9. What does the pipe operator `|` actually do with ranges?

`|` is function composition sugar for range adaptors. `range | adaptor` is equivalent to `adaptor(range)`, and the adaptors are *partial applications* — `views::transform(f)` is a range adaptor closure waiting for a range on its left.

```cpp
auto result = data | views::filter(pred) | views::transform(f) | views::take(3);
// reads left-to-right as a data pipeline; equivalent to:
// views::take(views::transform(views::filter(data, pred), f), 3)
```

The pipe makes composition read in *data-flow order* (source first, transformations left-to-right) instead of the inside-out nesting of function-call syntax. Each `|` wraps the previous view in another lazy adaptor; the whole chain is still a single view object that's cheap to copy and evaluated only on iteration. This is the ergonomic payoff of ranges — the pipeline reads like a description of the transformation rather than a pile of nested calls or a sequence of imperative loops.

### Q10. What is a projection in ranges algorithms?

A **projection** is an extra callable that a `std::ranges` algorithm applies to each element *before* comparing or operating on it — so you can sort/search/compare "by a field" without writing a custom comparator.

```cpp
struct Widget { std::string name; int price; };
std::vector<Widget> ws = /* ... */;

std::ranges::sort(ws, {}, &Widget::price);          // sort by price, default less<>
auto it = std::ranges::find(ws, "gadget", &Widget::name);   // find where name == "gadget"
std::ranges::max_element(ws, std::greater{}, &Widget::price);
```

The signature pattern is `algorithm(range, comparator = {}, projection = {})`. The projection (`&Widget::price`, a lambda, or any callable) is applied to each element, and the comparator works on the *projected* values. This is a big ergonomic win over classic algorithms where you'd write a full lambda comparator (`[](auto& a, auto& b){ return a.price < b.price; }`) — the projection separates "what to look at" from "how to compare," and member-pointer projections are especially concise.

### Q11. How do `std::ranges` algorithms differ from the classic `<algorithm>` ones?

Same algorithms, better interface:

| | Classic (`std::sort`) | Ranges (`std::ranges::sort`) |
|---|---|---|
| Arguments | iterator pair (`begin, end`) | whole range *or* iterator pair |
| Projections | none (write a lambda) | built-in projection parameter |
| Constraints | unconstrained templates | concept-constrained (readable errors) |
| Return values | often just an iterator | richer (e.g. `in`/`out` pairs, subranges) |
| Composition | none | integrate with views/pipes |

```cpp
std::sort(v.begin(), v.end());          // classic
std::ranges::sort(v);                   // ranges — no begin/end boilerplate
std::ranges::sort(v, std::less{}, &T::field);   // + projection
```

The ranges versions are **concept-constrained**, so passing something unsortable gives a clean diagnostic instead of an instantiation dump. They also compose with views — you can sort a subrange or feed a view into an algorithm. There's essentially no reason to reach for the iterator-pair versions in new C++20 code except when you genuinely have a bare iterator pair rather than a range.

### Q12. What is a dangling range / borrowed range, and what does `views::filter` on a temporary risk?

If a range algorithm or view would hand you an iterator into a range that no longer exists, you get a dangling reference — UB if you use it. C++20 defends against the common case with **borrowed ranges** and the `std::ranges::dangling` type.

```cpp
auto it = std::ranges::find(std::vector<int>{1,2,3}, 2);
// the vector is a temporary destroyed at the ';'
// find *refuses* to return a usable iterator: 'it' has type std::ranges::dangling
```

A **borrowed range** is one whose iterators remain valid even if the range object itself dies — e.g. `std::string_view`, `std::span`, or an lvalue container (whose data outlives the expression). For a non-borrowed *rvalue* range (a temporary container), ranges algorithms return `std::ranges::dangling` instead of a dangling iterator, so misuse fails to compile rather than crashing at runtime.

The `views::filter`-on-a-temporary trap: piping a view off a temporary container (`getVector() | views::filter(...)`) can leave the view referencing destroyed storage. Store the container in a named variable first, then build the view over it. The general rule: **views are non-owning; keep the underlying data alive for as long as the view.**

### Q13. When do ranges *hurt* — performance or debuggability?

Ranges are not free lunch. Where they bite:

- **Debug-build performance** — view pipelines are deeply nested templates; without inlining (i.e. in `-O0` debug builds) they can be dramatically slower than a hand-written loop because every element goes through layers of iterator adaptors. Optimised builds usually recover this, but the debug gap surprises people.
- **Compile times and error messages** — despite concepts, a mistake deep in a long pipe can still produce intimidating diagnostics, and heavy view use lengthens compilation.
- **Debugging** — stepping through a lazy pipeline in gdb/lldb means stepping through adaptor internals; there's no single loop to breakpoint. Inspecting "the intermediate collection" is impossible because there isn't one.
- **Lazy-evaluation surprises** — a `filter` predicate with side effects, or an expensive `transform`, runs on *every* traversal, and re-traversing re-runs it. Caching isn't automatic.

Senior judgement: use ranges where they make a transformation *read* clearly and the pipeline is the point; drop to an explicit loop in hot debug-sensitive paths, or where laziness/side-effects make reasoning harder than it saves.

### Q14. Rewrite this loop with ranges and say what improves. What could go wrong?

```cpp
// classic
std::vector<int> out;
for (int x : in)
    if (x > 0)
        out.push_back(x * x);

// ranges (C++20)
auto view = in | std::views::filter([](int x){ return x > 0; })
               | std::views::transform([](int x){ return x * x; });
std::vector<int> out(view.begin(), view.end());   // materialise
// or, C++23:  auto out = view | std::ranges::to<std::vector>();
```

**What improves:** intent reads top-to-bottom as "positive values, squared"; no manual `push_back`/index bookkeeping; the filter+transform fuse into a single lazy pass with no throwaway intermediate; and the pipeline is trivially extendable (`| views::take(10)`).

**What could go wrong:** (1) the view is lazy — if you forget to materialise (`out(view.begin(), view.end())` or `ranges::to`), nothing is computed and re-iterating re-runs the predicates. (2) If `in` is a *temporary*, the view dangles — keep the source alive. (3) In debug builds this can be slower than the raw loop. (4) The lambdas must be side-effect-free to be safely re-iterated. `std::ranges::to` (C++23) is the clean way to collect into a container.

## Coroutines (C++20)

### Summary

**What this topic covers**

C++20 coroutines — the single most intricate feature added to the language since templates. This topic explains what a coroutine actually *is* at the machine level, the three keywords that make a function one (`co_await`, `co_yield`, `co_return`), and the customisation machinery the standard exposes: the **coroutine frame** and its (elidable) heap allocation, the **promise type**, `std::coroutine_handle`, and **awaitables/awaiters** (`await_ready`/`await_suspend`/`await_resume`). The 12 questions build from "what problem do coroutines solve" through generators and async tasks to the sharp edges: symmetric transfer, why the standard library shipped only the *machinery* and no ready-to-use `task`/`generator` type until C++23's `std::generator`, dangling-parameter lifetime bugs, the missing executor/scheduler story, and how coroutines compare to threads and callback-based async. The through-line is a senior framing: coroutines are a *low-level customisation point*, not a batteries-included feature, and using them well in 2026 means either adopting a library (cppcoro, Boost.Asio, folly) or understanding the plumbing deeply.

**Mental model**

A coroutine is a function that can **suspend** partway through, hand control back to its caller, and later **resume** exactly where it left off with all its locals intact. To do that, its state can't live on the normal call stack (which unwinds on return), so the compiler allocates a **coroutine frame** — containing the locals, the parameters, the suspend point, and a **promise object** — typically on the heap (though the compiler may *elide* that allocation, "HALO", when it can prove the coroutine's lifetime is bounded). A function becomes a coroutine purely by *using* `co_await`, `co_yield`, or `co_return` in its body. The compiler then rewrites it around your **promise type** — a type you (or a library) provide that decides what happens at the start, at each suspend, on a returned/yielded value, and at the end. `co_await expr` asks an **awaiter** three questions: are you ready (`await_ready`)? if not, here's my handle — arrange to resume me later (`await_suspend`); when resumed, what's the result (`await_resume`)? That triad is the entire protocol; generators, tasks, and async I/O are all just different promise/awaiter implementations of it.

**Key terms**

- **Coroutine** — a resumable function; suspends and resumes preserving its local state.
- **`co_await`** — suspend until an awaitable is ready, then resume with its result.
- **`co_yield`** — produce a value to the caller and suspend (sugar for `co_await promise.yield_value(x)`).
- **`co_return`** — finish the coroutine, optionally producing a final value.
- **Coroutine frame** — heap-allocated (usually) storage holding locals, parameters, promise, and resume point.
- **Promise type** — `Ret::promise_type`; the customisation hook the compiler drives (`get_return_object`, `initial_suspend`, `yield_value`, `return_value`/`return_void`, `final_suspend`, `unhandled_exception`).
- **`std::coroutine_handle<P>`** — a non-owning handle to resume/destroy a suspended coroutine and reach its promise.
- **Awaitable / Awaiter** — the operand of `co_await`; an awaiter has `await_ready`/`await_suspend`/`await_resume`.
- **`std::suspend_always` / `std::suspend_never`** — trivial awaiters that always/never suspend.
- **HALO** — Heap Allocation eLision Optimisation; the compiler removes the frame allocation when lifetimes allow.
- **Symmetric transfer** — resuming another coroutine by *returning its handle* from `await_suspend`, avoiding stack growth.
- **`std::generator`** (C++23) — the first standard coroutine type: a lazy synchronous sequence.

**Why interviewers ask this**

Coroutines are a strong senior-level differentiator precisely because they're hard and because the C++20 version is famously *un-ergonomic*. Asking about them separates candidates who've only read the marketing ("C++ has coroutines now!") from those who've actually used them — and who therefore know that C++20 shipped only the compiler machinery, forcing you to write a promise type or pull in a library. Good answers demonstrate understanding of the suspend/resume mechanics, honest awareness of the costs (heap allocation, lifetime hazards), and judgement about *when* a coroutine beats a thread or a callback. Interviewers also use coroutines to probe lifetime reasoning at its most demanding: the dangling-reference-parameter bug is a subtle, real trap that reveals whether a candidate genuinely understands the frame model. Nobody expects a candidate to have memorised the promise-type boilerplate; they expect the mental model and the tradeoffs.

**Common confusions**

- "Coroutines are threads / run in parallel" — no; a coroutine is a *single-threaded* control-flow construct. It suspends and resumes cooperatively; any concurrency comes from the scheduler you (or a library) provide.
- "`co_return` returns like `return`" — it finishes the coroutine and routes the value through the promise; the caller already holds the return object from the *first* suspension.
- "The frame is always heap-allocated" — usually, but HALO can elide it entirely.
- "C++20 gave me `task` and `generator`" — it gave you the *machinery*; `std::generator` only arrived in C++23, and there's still no standard `task`.
- "I can pass references into a coroutine freely" — reference *parameters* are dangerous: the frame stores the reference, not the referent, so it can dangle after the first suspend.
- "`co_await` blocks the thread" — it suspends the *coroutine* and returns control to the caller/scheduler; the thread is free to do other work.

**What follows from this topic**

Coroutines are the capstone of the C++20 additions introduced in **Modern C++** and lean on the same "library-provides-customisation-points, you-compose" design philosophy seen in **constexpr, Concepts & Ranges** — a coroutine's return type is a concept-shaped contract and `std::generator` is consumed exactly like a range. In practice coroutines connect to the concurrency and memory topics elsewhere in this primer: the lifetime hazards are the same aliasing/dangling problems, amplified by suspension, and the "who resumes this and on which thread" question is the executor gap that C++ concurrency is still filling. If the frame/promise/awaiter model here is clear, async C++ libraries (Asio, cppcoro) stop looking like magic.

### Q1. What is a coroutine, and what problem does it solve?

A coroutine is a function that can **suspend** its execution partway through, return control to whoever resumed it, and later be **resumed** from exactly that point with all its local state preserved. A normal function has one entry and one exit; a coroutine has multiple suspend/resume points.

The problems it solves:

- **Asynchronous code without callback hell.** Instead of chaining callbacks or `.then()` continuations, you write straight-line code with `co_await` at the points that wait for I/O; the coroutine suspends there and resumes when the result arrives. The logic reads sequentially.
- **Lazy sequences / generators.** A function can `co_yield` values one at a time, computing each only when the consumer asks — an infinite or expensive sequence without materialising it.
- **State machines** expressed as ordinary control flow rather than an explicit switch on a state variable.

In C++ specifically, a function becomes a coroutine simply by *using* `co_await`, `co_yield`, or `co_return` in its body — there's no `coroutine` keyword on the signature. The return type must satisfy the coroutine protocol (i.e. provide a `promise_type`).

### Q2. Explain `co_await`, `co_yield`, and `co_return`.

The three keywords, each of which turns the enclosing function into a coroutine:

- **`co_await expr`** — suspend the coroutine until `expr` (an *awaitable*) is ready, then resume with its result. This is the general suspension primitive; async waits are built on it.
- **`co_yield expr`** — produce a value to the consumer and suspend. It's pure sugar for `co_await promise.yield_value(expr)`. This is how generators emit elements.
- **`co_return expr;`** (or bare `co_return;`) — finish the coroutine, routing the final value through the promise's `return_value`/`return_void`. After this the coroutine is done; resuming it again is UB.

```cpp
Generator<int> counter() {
    for (int i = 0;; ++i)
        co_yield i;            // emit i, suspend, resume on next request
}

Task<std::string> fetch(Url u) {
    auto conn = co_await connect(u);   // suspend until connected
    auto body = co_await conn.read();  // suspend until data arrives
    co_return body;                    // finish, deliver result
}
```

A function may use `co_await`/`co_yield` many times but you can't mix `return` and `co_return` in the same function — using any of the three makes the whole function a coroutine.

### Q3. What is the coroutine frame, and where does it live?

When a coroutine first runs, its state can't live on the ordinary call stack because the stack frame is destroyed when the function returns control to the caller — but the coroutine needs to be resumable later. So the compiler allocates a **coroutine frame** holding everything that must survive suspension:

- the coroutine's **local variables** and temporaries live across suspend points,
- a copy of its **parameters** (by value) — see the dangling-reference trap,
- the **promise object**,
- bookkeeping: the current suspend point and the resume/destroy function pointers.

This frame is typically **heap-allocated** via `operator new` (you can customise which). That allocation is the main runtime cost people cite against coroutines. Crucially, though, the compiler is *allowed to elide* it — **HALO** (Heap Allocation eLision Optimisation) — when it can prove the coroutine's lifetime is fully contained within the caller (e.g. a generator fully consumed in a local loop that the optimiser can see). When HALO fires, the frame lives on the caller's stack and coroutines become nearly free; when it doesn't, you pay an allocation per coroutine invocation.

### Q4. What is the promise type and what does the compiler require from it?

The **promise type** (`YourReturnType::promise_type`) is the customisation object the compiler creates inside the frame and drives at every stage of the coroutine's life. The compiler rewrites your coroutine body into calls on it. The required interface:

```cpp
struct promise_type {
    ReturnObject get_return_object();          // build the object returned to the caller
    std::suspend_always initial_suspend();     // suspend before the body runs? (lazy vs eager)
    std::suspend_always final_suspend() noexcept; // suspend after the body finishes?
    void return_value(T v);   // OR void return_void();   // handle co_return
    // std::suspend_always yield_value(T v);   // handle co_yield (generators)
    void unhandled_exception();                // called if the body throws
};
```

Reading it top to bottom: `get_return_object` produces what the *caller* receives (usually wrapping a `coroutine_handle`); `initial_suspend` decides whether the coroutine runs immediately or waits for the first `resume()` (returning `suspend_always` makes it lazy — the generator pattern); `yield_value`/`return_value` receive yielded/returned values; `final_suspend` (must be `noexcept`) decides whether the frame stays alive after completion so the caller can read the result before destroying it; `unhandled_exception` catches escaping exceptions. Writing this boilerplate by hand is exactly why people reach for a library.

### Q5. What is a `coroutine_handle` and what do you do with it?

`std::coroutine_handle<Promise>` is a lightweight, **non-owning** handle — essentially a typed pointer to the coroutine frame — that lets code outside the coroutine control it:

- **`.resume()`** (or `operator()`) — continue a suspended coroutine from its last suspend point.
- **`.done()`** — has it reached final suspension?
- **`.destroy()`** — free the frame (destructors of locals run). Because the handle is non-owning, *someone* must call this exactly once, or you leak the frame; typically the wrapping return-object type owns the handle and destroys it in its destructor (RAII).
- **`.promise()`** — access the promise object, e.g. to read the last yielded/returned value.
- **`coroutine_handle<P>::from_promise(p)`** — recover the handle from a promise reference.

```cpp
auto gen = counter();          // returns a wrapper holding a coroutine_handle
gen.handle.resume();           // run to first co_yield
int v = gen.handle.promise().current_value;
```

The non-owning nature is the crux of coroutine lifetime bugs: the handle doesn't manage the frame, so ownership and destruction are *your* responsibility (or the library's). Resuming a `done()` or destroyed coroutine is undefined behaviour.

### Q6. Explain awaitables and awaiters — the three `await_*` methods.

`co_await expr` drives a small protocol. `expr` is an **awaitable**; from it the compiler obtains an **awaiter** (directly, or via `operator co_await`/`await_transform`). The awaiter must provide three methods:

```cpp
struct Awaiter {
    bool await_ready();                          // already done? skip suspension if true
    void await_suspend(std::coroutine_handle<> h); // called on suspend; arrange resumption
    T    await_resume();                         // produce co_await's result value
};
```

The sequence: (1) **`await_ready()`** — if it returns `true`, no suspension happens and we jump straight to `await_resume` (fast path for already-available results). (2) If `false`, the coroutine suspends and **`await_suspend(h)`** runs, handed the coroutine's own handle; it stashes `h` somewhere (an I/O completion callback, a scheduler queue, another coroutine) so `h.resume()` gets called when the awaited thing is ready. `await_suspend` can return `void` (stay suspended), `bool` (`false` = resume immediately), or a `coroutine_handle` (symmetric transfer — resume *that* one next). (3) When resumed, **`await_resume()`** runs and its return value becomes the result of the `co_await` expression.

`std::suspend_always` (`await_ready` returns `false`) and `std::suspend_never` (`await_ready` returns `true`) are the two trivial built-in awaiters used for `initial_suspend`/`final_suspend`.

### Q7. How do you build a generator with `co_yield`? Why is it lazy?

A generator is a coroutine whose promise implements `yield_value`, storing each yielded value so the consumer can read it after each resume. The lazy behaviour falls out of `initial_suspend` returning `suspend_always` (nothing runs until the first `resume`) and each `co_yield` suspending after producing a value.

```cpp
std::generator<int> fibonacci() {         // C++23 std::generator
    int a = 0, b = 1;
    while (true) {
        co_yield a;                       // emit, then suspend
        std::tie(a, b) = std::pair{b, a + b};
    }
}

for (int x : fibonacci()) {               // pull one value per iteration
    if (x > 100) break;
    std::print("{} ", x);
}
```

It's lazy because computation is *demand-driven*: the body advances only when the consumer asks for the next value (each loop iteration resumes the coroutine, which runs until the next `co_yield`). This lets you express **infinite** sequences (`while(true)`) and expensive streams without ever materialising them — you compute exactly as many elements as you consume. Before C++23 you had to write the `Generator` type yourself; `std::generator` standardises it and integrates with ranges.

### Q8. Why did C++20 ship coroutine *machinery* but no usable `task`/`generator` type?

This is the most important practical fact about C++20 coroutines. The committee standardised the **language mechanism** — the keywords, the frame, the promise/awaiter protocol, `coroutine_handle` — but **not** any concrete, ready-to-use coroutine *types*. So out of the box in C++20 you cannot write `Task<int> f()` or `Generator<int> g()` without first providing the `Task`/`Generator` types yourself, including their promise types and awaiter plumbing.

Why: designing a *good* general-purpose `task` (with an executor/scheduler model, cancellation, allocator control, error propagation) is genuinely hard and contentious, and the committee chose to ship the low-level machinery on time rather than block it on the high-level types. The consequence is that C++20 coroutines are a **library-author feature**, not an application-author one — you're expected to either write the wrappers (a lot of subtle boilerplate) or adopt a library: **cppcoro**, **Boost.Asio** (coroutine-based async), **folly::coro**, **libunifex**. C++23 finally added **`std::generator`** (the synchronous lazy generator), but there is *still* no standard `std::task` as of 2026 — that's expected in a future standard alongside the executors/senders-receivers work.

### Q9. What lifetime bug lurks in coroutine reference parameters?

Passing a reference (or pointer, or `string_view`/`span`) into a coroutine is a classic dangling trap. The coroutine frame stores **parameters by copying them** — but copying a *reference* copies the reference, not the referent. If the referent is a temporary, it's destroyed after the full-expression that created the coroutine, while the coroutine (which suspended) lives on and later dereferences the now-dangling reference.

```cpp
std::generator<char> chars(const std::string& s) {   // reference parameter — danger
    for (char c : s) co_yield c;
}

auto g = chars(std::string{"hello"});   // temporary string destroyed at ';'
for (char c : g) use(c);                // UB — s dangles; frame holds a dead reference
```

The temporary `std::string` dies at the end of the initialising statement, but the coroutine only *starts consuming* `s` later, reading freed memory. The fix: **take coroutine parameters by value** (`std::generator<char> chars(std::string s)`) so the frame owns a copy for its whole lifetime, or ensure the referent outlives the coroutine. This is subtle because the same signature is perfectly safe for a *normal* function — it's the deferred, suspend-and-resume execution that turns a fine-looking reference parameter into a use-after-free. Static analysers (clang-tidy) have checks for it, but the mental rule is: coroutine parameters should be by value unless you can prove the argument outlives the coroutine.

### Q10. What is symmetric transfer and why does it matter?

**Symmetric transfer** is the technique of resuming one coroutine directly from another *without* growing the call stack, by returning a `coroutine_handle` from `await_suspend`:

```cpp
std::coroutine_handle<> await_suspend(std::coroutine_handle<> h) {
    // instead of continuation.resume(); return;  (which recurses on the stack)
    return continuation;   // compiler tail-resumes 'continuation' — no stack growth
}
```

Why it matters: in a chain of coroutines awaiting each other (task A awaits task B awaits task C...), naively calling `.resume()` inside `await_suspend` nests a new stack frame for every hop. A long chain — or worse, a loop of coroutines resuming each other (a ping-pong) — would **overflow the stack**. When `await_suspend` *returns* the next handle instead, the coroutine machinery performs a guaranteed tail call: the current coroutine's `await_suspend` returns, and control transfers to the returned handle without leaving a frame behind. This makes deep or cyclic coroutine chains run in **constant stack space**. It's an essential building block for any real task library — without it, coroutine-based async would stack-overflow on realistic workloads. The `std::noop_coroutine()` handle is the "resume nothing, return to caller" terminator used to end such chains.

### Q11. When should you use a coroutine instead of a thread or a callback?

They solve different problems; the choice is about *concurrency model*, not just style:

| | Coroutine | Thread | Callback |
|---|---|---|---|
| Concurrency | cooperative, single-threaded (unless scheduled across threads) | preemptive, truly parallel | none inherent |
| Cost | frame alloc (often elided); cheap switch | OS stack (~MB) + context switch | none |
| Code shape | sequential (`co_await`) | sequential but blocking | fragmented `.then()` chains |
| Best for | high-concurrency async I/O; lazy generators | CPU-bound parallel work | simple one-shot completions |

Reach for a **coroutine** when you have *many* concurrent, mostly-waiting operations (thousands of network connections) — coroutines suspend without a blocked OS thread each, so you scale far past the thread-per-connection limit, and the code still reads top-to-bottom. Reach for a **thread** when you need genuine CPU parallelism (crunching numbers on multiple cores) — coroutines don't add cores. Reach for a **callback** for a trivial single completion where a whole coroutine is overkill. Coroutines' headline win over callbacks is readability: `auto x = co_await f(); auto y = co_await g(x);` versus nested continuations. Their win over threads is *density* — cheap suspension instead of an OS thread per in-flight operation. Note the catch: a coroutine only delivers async concurrency if something *schedules* its resumption, which is the executor gap.

### Q12. What is the "executor gap" in C++20 coroutines?

A coroutine, by itself, only knows how to *suspend* and be *resumed* — it does **not** know *who* resumes it, *when*, or *on which thread*. That decision belongs to a **scheduler/executor**, and C++20 standardised **no executor**. So the language gives you suspension points but no standard answer to "when this I/O completes, run `handle.resume()` on some worker thread."

The consequence: to do real async work you must supply the scheduling yourself or adopt a framework that does — Boost.Asio's `io_context`, libunifex/stdexec **senders and receivers**, folly, cppcoro's thread pools. Your awaiters' `await_suspend` hand the coroutine handle to that scheduler, which resumes it on completion. Without one, `co_await` on a truly async operation has nothing to resume it.

This gap is why C++20 coroutines feel unfinished. The missing piece — a standard execution/scheduler framework (**`std::execution`**, the sender/receiver model, P2300) — was voted into **C++26**. Until it lands and matures, coroutine-based async in C++ means committing to a third-party executor, and mixing libraries with incompatible executor models is a real integration headache. Interviewers like this question because acknowledging the executor gap signals you've actually built async C++ rather than just read the coroutine spec.
## Compilation, Linking, ODR, Build & Tooling

### Summary

**What this topic covers**

How a C++ program actually gets built — the part of the language that isn't the language at all, but the toolchain around it. Three concern areas live here: (1) the **build pipeline** — preprocessing, compilation to object files, and linking, plus why C++ builds are slow and how to make them fast; (2) the **rules that make separate compilation legal** — the One Definition Rule, `inline`, internal vs external linkage, `static`, anonymous namespaces, and `extern`; and (3) the **practical tooling** — headers vs sources, include guards, forward declarations, PIMPL, static vs dynamic libraries, name mangling, `extern "C"`, ABI stability, CMake, and reading linker errors. The 16 questions here are the ones that separate engineers who *use* a build system from engineers who *understand* one. When a build breaks with "undefined reference" or "multiple definition", this is the knowledge that turns a two-hour flail into a two-minute fix.

**Mental model**

C++ compiles one **translation unit** (TU) at a time, in near-total isolation. A TU is a single `.cpp` file *after* the preprocessor has textually pasted in every `#include`d header. The compiler turns each TU into an **object file** (`.o`/`.obj`) of machine code with a symbol table — some symbols *defined* here, others *referenced* but unresolved. Because TUs don't see each other, every TU that uses `Widget` needs `Widget`'s declaration (from a header), and exactly one TU must contain its definition. The **linker** then stitches object files and libraries together, resolving each referenced symbol to exactly one definition. This two-phase model — independent compilation, then global linking — is the source of nearly every "why won't it build" question. It's also why headers exist: they're the shared *declarations* every TU copies, while definitions live once in a `.cpp`. Get this model and the ODR, `inline`, and linkage rules stop being arbitrary and become obvious consequences.

**Key terms**

- **Translation unit** — one `.cpp` plus all headers it includes, after preprocessing; the atomic compilation unit.
- **Preprocessor** — text substitution phase: `#include`, `#define`, `#ifdef`. Runs before the compiler sees any C++.
- **ODR (One Definition Rule)** — every entity has exactly one definition across the whole program (with a same-token exception for inline entities in multiple TUs).
- **Linkage** — external (visible to other TUs), internal (this TU only), or none (local).
- **`inline`** — permits multiple identical definitions across TUs; a linkage/ODR keyword, only weakly about inlining.
- **`static` (file scope)** — gives internal linkage; the modern idiom is an anonymous namespace.
- **`extern`** — declares without defining; names a symbol defined elsewhere.
- **Name mangling** — encoding of function signature/namespace into the linker symbol; why C++ needs `extern "C"` to call C.
- **ABI** — binary contract (layout, calling convention, mangling) between separately compiled components.
- **PIMPL** — "pointer to implementation" idiom that hides a class's members behind an opaque pointer to cut compile-time coupling.
- **Static vs dynamic library** — `.a`/`.lib` copied into the executable at link time vs `.so`/`.dll`/`.dylib` loaded at runtime.

**Why interviewers ask this**

This is the topic that reveals whether a candidate has shipped real C++ or only solved exercises. Anyone can write a class; only someone who's fought a build understands why putting a non-`inline` function definition in a header detonates the linker across every TU that includes it. Two signals matter. (1) **Diagnostic ability** — given "undefined reference to `Foo::bar()`" or "multiple definition of `x`", can you name the cause instantly? Seniors have a reflex; juniors guess. (2) **Design-for-build** — do you reach for forward declarations and PIMPL to keep headers light and builds fast, or do you `#include` everything everywhere and let a 40-minute build rot the team's velocity? Compile-time is a real engineering cost at scale, and awareness of it is a seniority marker.

**Common confusions**

- "`inline` makes the function faster / forces inlining" — no. `inline` is primarily an ODR exemption allowing the same definition in multiple TUs. Inlining is the optimizer's call; `[[gnu::always_inline]]` is a separate, non-standard hammer.
- "Header guards and `#pragma once` do the same thing so they're equivalent" — functionally close, but `#pragma once` is non-standard (though universally supported) and can misbehave with symlinks/hardlinks that alias the same file under different paths.
- "Undefined reference means the header is missing" — no, it means the *definition* (the `.cpp`, or the library) wasn't linked. Missing header ⇒ compile error; missing definition ⇒ link error.
- "`static` and `extern` are opposites" — `static` at file scope means internal linkage; `extern` means external linkage / declaration-only. They're related to linkage but not simple negations.
- "The compiler does the whole build" — the compiler produces object files; the *linker* resolves cross-TU symbols. Different tool, different error class.

**What follows from this topic**

This is the foundation under everything mechanical. Name mangling and ABI stability feed directly into `Undefined Behaviour, Performance & Spot-the-Bug` (mismatched ABIs are UB). PIMPL and header hygiene reappear in `Reviewing C++ Code` as a review checklist item. The ODR and linkage rules underpin how templates, `constexpr`, and `inline` variables are allowed to live in headers, which connects back to the templates and generic-programming topics. If linker errors still feel like weather rather than physics, fix that here first — it pays off in every debugging session for the rest of your career.

### Q1. Walk me through what happens between a `.cpp` file and a running executable.

Four phases:

1. **Preprocessing** — `#include`s are pasted in textually, macros expanded, `#ifdef` branches resolved. Output is a single self-contained translation unit. Inspect it with `g++ -E foo.cpp`.
2. **Compilation** — the TU is parsed, type-checked, optimized, and lowered to assembly, then assembled into an **object file** (`foo.o`). It contains machine code plus a symbol table: symbols *defined* here and symbols *referenced* but not yet resolved. `g++ -c` stops here.
3. **Linking** — the linker takes all `.o` files plus libraries and resolves every referenced symbol to exactly one definition, laying out the final address space.
4. **Loading** — at runtime the OS loader maps the executable, resolves any dynamic library symbols, and jumps to `_start` → `main`.

The key insight: steps 1–2 happen *per file in isolation*. The compiler never sees two `.cpp` files at once. All cross-file wiring is the linker's job — which is why "compiles fine, won't link" is such a common state.

### Q2. What is the One Definition Rule, and how do you violate it?

The **ODR** says: every variable, function, class, enum, or template used in a program must be *defined* exactly once — with an exception for entities like inline functions, templates, and class definitions, which may appear in multiple TUs *provided every definition is token-for-token identical*.

Three classic violations:

```cpp
// util.h — WRONG: non-inline definition in a header
int counter() { return 42; }   // every .cpp that includes this defines counter()
```

Include that in two `.cpp` files and the linker reports **multiple definition of `counter()`**. Fix: declare in the header (`int counter();`) and define once in `util.cpp`, or mark it `inline`.

The nastier ODR violations are the *silent* ones: defining the same class differently in two TUs (e.g. behind different `#ifdef`s or struct-packing pragmas), or an inline function whose definitions differ. These compile and link but are **undefined behaviour** — the linker picks one definition arbitrarily and you get memory corruption with no diagnostic.

### Q3. Header guards vs `#pragma once` — what's the difference and which do you use?

Both prevent a header's contents being pasted in twice within one TU (which would cause redefinition errors).

```cpp
// Include guard — standard, portable
#ifndef WIDGET_H
#define WIDGET_H
// ...declarations...
#endif

// pragma once — non-standard but universally supported
#pragma once
// ...declarations...
```

`#pragma once` is terser, immune to macro-name collisions, and lets the compiler skip re-reading the file (a small build-speed win). Its one weakness: it identifies files by filesystem identity, so symlinks/hardlinks or odd build layouts that expose the same file under two paths can defeat it. Include guards are pure C++ and always correct, but a duplicated guard macro across two headers silently hides one of them.

Practical answer: use `#pragma once` on every mainstream toolchain; it's what most codebases and style guides now default to. Some safety-critical or maximally-portable codebases still mandate include guards.

### Q4. Explain internal vs external linkage, and how `static` and anonymous namespaces relate.

**External linkage** — the symbol is visible to the linker and can be referenced from other TUs (default for non-`const` globals and free functions). **Internal linkage** — the symbol is private to its TU; each TU gets its own copy and no cross-TU reference is possible. **No linkage** — locals.

You get internal linkage three ways:

```cpp
static int s = 1;             // C-style file-scope static → internal linkage
namespace { int a = 2; }      // anonymous namespace → internal linkage (modern idiom)
const int c = 3;              // namespace-scope const → internal linkage by default in C++
```

Prefer the **anonymous namespace** for translation-unit-private helpers: unlike `static`, it works on types too (you can hide a whole class), and it reads clearly. Internal linkage is how you avoid polluting the global symbol table and prevent ODR clashes between two `.cpp`s that happen to use the same helper name.

### Q5. Why does putting a function definition in a header often break the build, but `inline` fixes it?

Because a header is textually included into every TU that uses it. A plain (non-`inline`) function definition therefore produces the *same external symbol defined multiple times* — one per including TU — and the linker refuses: **multiple definition**.

`inline` changes the ODR contract: it tells the linker "this symbol may be defined identically in many TUs; merge them into one." So an `inline` function (or a member function defined inside the class body, which is implicitly `inline`) is legal in a header.

```cpp
// ok.h
inline int square(int x) { return x * x; }   // inline → one merged definition
struct P { int f() { return 1; } };          // in-class body → implicitly inline
```

Note this is about **linkage**, not optimization: `inline` does not force the compiler to inline the call. C++17 also added `inline` *variables*, which finally let you put a single global definition in a header without a `.cpp`.

### Q6. What are forward declarations and how do they speed up compilation?

A forward declaration introduces a name without its full definition:

```cpp
class Widget;                 // forward declaration — Widget is now an "incomplete type"
void process(Widget& w);      // fine: reference/pointer only needs the name
```

You can declare pointers/references to an incomplete type, and take function parameters/returns by pointer or reference — but you can't create one, access members, or size it. The payoff is **decoupling**: a header that only needs `Widget*` can forward-declare it instead of `#include "widget.h"`, so changing `widget.h` doesn't force a recompile of every file that only mentions `Widget` in passing.

At scale this is enormous. A heavy header included by 500 TUs recompiles all 500 on every edit. Replacing includes with forward declarations where possible — and hiding the rest behind PIMPL — is the primary lever for keeping large C++ builds tractable.

### Q7. Explain the PIMPL idiom. What does it buy you and what does it cost?

PIMPL ("pointer to implementation") hides a class's data members behind an opaque pointer:

```cpp
// widget.h — no private members leak into the header
class Widget {
public:
    Widget();
    ~Widget();                    // must be user-declared (defined in .cpp)
    void draw();
private:
    struct Impl;                  // incomplete here
    std::unique_ptr<Impl> impl_;  // only a pointer — size known
};

// widget.cpp
struct Widget::Impl { int x; std::vector<int> data; /*...*/ };
Widget::Widget() : impl_(std::make_unique<Impl>()) {}
Widget::~Widget() = default;      // defined where Impl is complete
void Widget::draw() { /* use impl_->... */ }
```

**Buys you:** (1) *Compile-firewall* — changing private members only recompiles `widget.cpp`, not every client. (2) *ABI stability* — the class's size and layout stay fixed even as internals change, so you can ship a library without breaking binary compatibility. (3) Cleaner headers.

**Costs:** an extra heap allocation and pointer indirection per object (bad for tiny hot objects), and boilerplate — notably the destructor *must* be declared in the header and defined in the `.cpp` where `Impl` is complete, or `unique_ptr`'s default deleter fails to compile on the incomplete type.

### Q8. Static library vs dynamic/shared library — when do you use each?

| | Static (`.a` / `.lib`) | Dynamic (`.so` / `.dll` / `.dylib`) |
|---|---|---|
| Linked | At link time, copied into the executable | At runtime, by the loader |
| Executable size | Larger (code embedded) | Smaller (code external) |
| Deployment | Single self-contained binary | Must ship/find the library at runtime |
| Updates | Rebuild + redistribute the app | Swap the `.so`, no relink (if ABI stable) |
| Startup | Faster | Slight load/relocation cost |
| Memory | Each process has its own copy | One copy shared across processes |

Use **static** for self-contained binaries, avoiding "DLL hell", and when you want the linker to strip unused code. Use **dynamic** for large shared dependencies (system libs), plugin architectures, and to patch a library without rebuilding every consumer — but only if you control ABI compatibility. Dynamic libs also enable `dlopen`-style runtime plugin loading.

### Q9. What is name mangling, and why do you need `extern "C"`?

C++ supports overloading, namespaces, and templates, so a bare function name isn't a unique linker symbol. The compiler **mangles** the full signature into the symbol name — `void foo(int)` might become `_Z3fooi`, `void foo(double)` becomes `_Z3food`. That's how the linker distinguishes overloads. Decode with `c++filt` or `nm -C`.

C has no mangling — `foo` is just `foo`. So to call a C function from C++ (or expose a C++ function to C), you disable mangling:

```cpp
extern "C" {
    #include "c_library.h"      // C symbols, unmangled
}
extern "C" void plugin_entry(); // this C++ function gets a C-style symbol
```

`extern "C"` is why nearly every C header guards its contents with `#ifdef __cplusplus / extern "C" {`. It's also mandatory for stable plugin ABIs and FFI boundaries (calling C++ from Python/Rust/etc.), since mangled names aren't standardized across compilers.

### Q10. What is ABI stability and why does it matter?

The **ABI** (Application Binary Interface) is the binary-level contract between separately compiled components: struct/class layout and size, calling conventions, name mangling scheme, vtable layout, and exception mechanics. Two binaries are ABI-compatible if they agree on all of it.

It matters whenever code crosses a compilation boundary you don't rebuild together — a shared library, a plugin, a prebuilt vendor SDK. If a library adds a member to a class, everything that was compiled against the old layout now reads the wrong offsets: silent memory corruption, not a clean error. That's precisely what PIMPL and pure-abstract interfaces protect against.

Real-world consequences: you generally can't mix objects built with incompatible standard-library ABIs (the libstdc++ pre/post-C++11 `std::string` split is the famous example), and passing `std::string`/`std::vector` across a shared-library boundary requires both sides use the identical standard library build. This is why stable C++ library interfaces are often kept to C-style or pure-virtual-interface boundaries.

### Q11. Can you define a `constexpr` function or a template in a `.cpp` file?

Generally no — both need to be **visible** at every point of use, so they live in headers.

**Templates** aren't code until instantiated with concrete types, and the compiler can only instantiate what it can see. Put a template's *definition* in a `.cpp` and other TUs see only the declaration → "undefined reference" at link time. So template definitions go in headers (or `.tpp`/`.ipp` files included by the header). The escape hatch is **explicit instantiation** — force specific instantiations in one `.cpp` (`template class Vector<int>;`) if you truly want to hide the body and only support a fixed set of types.

**`constexpr` functions** must be defined before they're used in a constant expression, so their definition must be visible — again, header. Note `constexpr` functions and variables are implicitly `inline` regarding the ODR, so putting them in a header included everywhere is fine, no multiple-definition error.

### Q12. You get `undefined reference to 'Foo::bar()'`. How do you debug it?

That's a **linker** error: a symbol was *declared and used* but never *defined/linked*. Walk the usual suspects, most common first:

1. **Definition never written** — you declared `void Foo::bar();` in the header but never wrote the body in any `.cpp`. Or you defined a *free* `bar()` when the call needs the *member* `Foo::bar()`.
2. **`.cpp` not compiled/linked** — the file with the definition isn't in the build (missing from `CMakeLists.txt` / the link line).
3. **Library not linked** — the definition is in a library you didn't pass (`-lfoo`), or link order is wrong (with static libs, dependencies must come *after* the things that use them on the GCC/ld command line).
4. **Signature mismatch** — a `const`, reference, or namespace difference makes the mangled name of the definition differ from the call site's. `nm -C obj.o | grep bar` and compare the mangled symbols.
5. **`extern "C"` mismatch** — one side mangles, the other doesn't.

Tooling: `nm`/`objdump -t` to see which symbols an object *defines* (`T`) vs *needs* (`U`); `c++filt` to demangle.

### Q13. And `multiple definition of 'x'` — what causes that and how do you fix it?

The mirror image: the linker found the *same external symbol defined more than once*. Causes:

1. **Non-`inline` function or variable defined in a header** included by ≥2 TUs — the #1 cause. Fix: mark it `inline`, or (better for functions) declare in the header and define in one `.cpp`.
2. **A global variable defined instead of declared in a header** — `int g = 0;` in a header. Fix: `extern int g;` in the header, `int g = 0;` in one `.cpp`. (Or `inline int g = 0;` in C++17.)
3. **Same `.cpp` compiled twice** into the link, or two files defining a colliding symbol that should have internal linkage.

The general rule the errors are enforcing: **declarations in headers, definitions in exactly one place** — unless the entity is `inline`/`constexpr`/a template/a class definition, which are ODR-exempt when identical.

### Q14. Sketch a minimal modern CMake setup for a library + executable.

Modern ("target-based") CMake — you configure *targets*, not global flags:

```cmake
cmake_minimum_required(VERSION 3.20)
project(MyApp LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_library(core src/widget.cpp src/engine.cpp)
target_include_directories(core PUBLIC include)   # consumers get include/ too
target_compile_options(core PRIVATE -Wall -Wextra)

add_executable(app src/main.cpp)
target_link_libraries(app PRIVATE core)           # app links core; inherits its PUBLIC usage reqs
```

Key ideas: `PUBLIC`/`PRIVATE`/`INTERFACE` control whether a property (include dirs, defines, flags) propagates to consumers. Prefer `target_*` commands over the old global `include_directories`/`add_definitions`. Build out-of-source: `cmake -S . -B build && cmake --build build`. For dependencies, `find_package` or `FetchContent`. This target-based style is the single biggest thing interviewers want to see over legacy CMake.

### Q15. Our build takes 40 minutes. What levers do you have to speed it up?

Attack it in layers, cheapest first:

- **Cut header coupling** — forward-declare instead of `#include`; push heavy includes into `.cpp`s; apply PIMPL to widely-included classes. Include-what-you-use (`iwyu`) audits this. This attacks the root cause: total preprocessed bytes.
- **Precompiled headers (PCH)** — compile stable heavy headers (`<vector>`, framework headers) once; CMake has `target_precompile_headers`.
- **Unity/jumbo builds** — concatenate many `.cpp`s into one TU to amortize header parsing (`CMAKE_UNITY_BUILD`). Big wins, but watch for ODR/`static`-name collisions between merged files.
- **C++20 modules** — the real fix: `import std;` parses an interface once instead of re-preprocessing text per TU. Toolchain support is maturing (2026) but not yet universal.
- **Parallelism & caching** — `cmake --build build -j`, `ccache`/`sccache` to cache object files, `ninja` over `make`, and a faster linker (`mold`, `lld`) since linking is often the serial bottleneck.
- **Split into libraries** so touching one file doesn't relink the world, and reduce template bloat / explicit-instantiate hot templates.

Measure first: `-ftime-report` / `-ftime-trace` (Clang) shows where compile time actually goes.

### Q16. What are C++20 modules and why do they matter for builds?

Modules replace textual `#include` with a compiled, imported interface:

```cpp
// math.ixx (module interface unit)
export module math;
export int add(int a, int b) { return a + b; }

// main.cpp
import math;                 // no preprocessing, no re-parsing headers
int main() { return add(2, 3); }
```

Why it matters:

- **Build speed** — a header included by 500 TUs is preprocessed and parsed 500 times; a module interface is compiled *once* into a binary artifact (BMI) that others import. This is the long-promised fix for C++'s worst-in-class build times. `import std;` (C++23) imports the whole standard library as a module.
- **Isolation** — macros and internal names don't leak across `import`; no more accidental capture from include order, no need for include guards.
- **Explicit interface** — only `export`ed names are visible.

Caveat for 2026: modules are standardized but toolchain/build-system support (compilers, CMake, package managers) is still stabilizing, so most production codebases remain header-based. Knowing the direction of travel is the senior signal.

## Undefined Behaviour, Performance & Spot-the-Bug

### Summary

**What this topic covers**

The two things that make C++ simultaneously fast and dangerous: **undefined behaviour** and the **performance model** that UB exists to enable. Three concern areas: (1) *what UB is* — why the standard leaves things undefined, why the optimizer is allowed to assume it never happens, and the catalog of the UB you'll actually hit (signed overflow, out-of-bounds, use-after-free, dangling references, uninitialized reads, data races, strict aliasing, bad shifts); (2) *how to catch it* — the sanitizers (ASan/UBSan/TSan/MSan), valgrind, and a set of "spot the bug / what does this print" snippets that are staples of senior interviews; and (3) *performance reasoning* — cache-friendly data layout, AoS vs SoA, branch prediction, inlining, move vs copy, small-buffer optimization, and how to actually measure instead of guess. The 18 questions here are where interviews get sharp: getting a dangling-reference snippet right is a hard seniority signal.

**Mental model**

Two ideas do most of the work. First, **UB is a contract, not a bug category**: the standard says "if your program does X, we make *no* guarantees at all." The compiler is then free to *assume X never happens* and optimize accordingly. So UB isn't "might crash" — it's "the optimizer may delete your null check, reorder your code, or make the impossible happen," because it reasoned from a premise you violated. This is why UB is worse than a defined crash: it's *silent, non-local, and version-dependent*. Second, **performance is about the memory hierarchy, not instruction count**. A modern core does billions of ops/sec but stalls hundreds of cycles on an L1 miss to DRAM. So the dominant performance question is almost never "how many operations" but "what's my memory access pattern and can the branch predictor and prefetcher see it coming." Contiguous, predictable, cache-resident data beats clever algorithms on pointer-chasing structures far more often than beginners expect.

**Key terms**

- **Undefined behaviour (UB)** — program semantics the standard doesn't define; the compiler may assume it never occurs.
- **Unspecified / implementation-defined** — weaker cousins: a valid-but-unpredictable result vs a documented per-implementation choice. Not the same as UB.
- **Dangling reference/pointer** — refers to an object whose lifetime has ended; dereferencing is UB.
- **Use-after-free / use-after-move** — accessing freed memory, or a moved-from object beyond its valid-but-unspecified state.
- **Strict aliasing** — the rule that accessing an object through an incompatible pointer type is UB, which the optimizer exploits.
- **Data race** — two threads access the same memory concurrently, at least one writing, without synchronization → UB.
- **Sanitizer** — compiler instrumentation (ASan/UBSan/TSan/MSan) that traps UB at runtime.
- **Cache line** — the ~64-byte unit memory is fetched in; spatial locality is measured against it.
- **AoS vs SoA** — Array-of-Structs vs Struct-of-Arrays memory layouts; SoA improves cache use for column-wise access.
- **Branch prediction** — the CPU speculates branch direction; mispredicts cost ~15–20 cycles.
- **SSO/SBO** — small-string / small-buffer optimization: store small payloads inline to avoid heap allocation.

**Why interviewers ask this**

Because this is where "knows C++ syntax" and "can be trusted with production C++" diverge. UB questions test whether you understand that the compiler is an adversary that will punish sloppy code in non-obvious ways — a candidate who thinks signed overflow "just wraps" hasn't been burned yet. The spot-the-bug snippets test *reading* skill under pressure: can you trace object lifetimes and iterator validity in code someone else wrote, which is 90% of the real job. And the performance questions separate cargo-cult optimizers ("I made everything `inline` and used `++i`") from engineers who *profile first* and reason about cache behaviour. A senior answer always includes "and here's how I'd catch/measure it" — sanitizers and profilers, not just theory.

**Common confusions**

- "UB just means it might crash" — no; it means *anything*, including working today and corrupting memory after the next compiler upgrade. The optimizer may delete code guarded by a check it proved "can't fail."
- "Signed integer overflow wraps around" — that's *unsigned*. Signed overflow is UB; the compiler may assume `x + 1 > x` always holds.
- "Sanitizers slow it down so they're only for tests" — correct that they're for testing, wrong to skip them; a nightly ASan/UBSan/TSan run catches bugs no amount of code review will.
- "Moved-from objects are empty/invalid" — they're in a *valid but unspecified* state: you may destroy or reassign them, not assume their value.
- "`std::endl` is just a newline" — it also flushes, which is a real performance bug in hot loops; use `'\n'`.
- "Micro-optimizing loops is where the speed is" — usually it's data layout and cache misses; the loop body was never the bottleneck.

**What follows from this topic**

This is the payoff topic that everything else feeds. The lifetime and ownership rules from the memory-management and smart-pointer topics are *why* dangling references and use-after-free happen; here you see them bite. The concurrency topic's `std::atomic` and mutexes exist to prevent the data-race UB catalogued here. And the review topic (`Reviewing C++ Code`) turns this knowledge into a checklist: every "spot the bug" pattern here becomes a thing you scan for in a PR. Master this and you stop *writing* the bugs the other topics teach you to fix.

### Q1. What is undefined behaviour, and why is it worse than a crash?

UB is behaviour the C++ standard explicitly declines to define. The critical consequence: the compiler is permitted to **assume UB never happens** and optimize on that assumption.

```cpp
int foo(int* p) {
    int x = *p;          // compiler now assumes p != nullptr (deref of null is UB)
    if (!p) return -1;   // ...so it may DELETE this check as dead code
    return x;
}
```

A defined crash (say, a checked exception) is *local and reproducible*. UB is neither: the effects can appear far from the cause, only under `-O2`, only on one compiler version, only on Tuesdays. It might work in debug and corrupt memory in release — because the optimizer reasoned from a premise you violated and rearranged your program accordingly. That's why "it works on my machine" is meaningless for UB: correct-looking output is one of the infinitely many things "undefined" is allowed to produce.

### Q2. Give me a catalog of the UB a working C++ engineer actually hits.

The greatest hits, roughly by frequency:

- **Out-of-bounds access** — reading/writing past an array or `std::vector` (`v[v.size()]`, off-by-one).
- **Use-after-free / dangling pointer or reference** — using memory after `delete`/scope exit/reallocation.
- **Uninitialized read** — reading a local `int x;` before assigning it.
- **Signed integer overflow** — `INT_MAX + 1`. (Unsigned wraps and is *defined*.)
- **Null dereference** — `*p` when `p == nullptr`.
- **Data race** — unsynchronized concurrent access with a writer.
- **Invalid downcast** — `static_cast` to a type the object isn't; also bad `reinterpret_cast`.
- **Strict-aliasing violation** — reading a `float`'s bits through an `int*`.
- **Shift by ≥ bit-width or negative** — `x << 32` for 32-bit `x`.
- **Modifying a `const` object**, returning nothing from a non-`void` function, invalid iterator use, calling a virtual through a partially-destroyed object, integer divide by zero.

The unifying theme: violations of lifetime, bounds, type, or synchronization — the four invariants the language trusts you to maintain in exchange for zero-cost abstractions.

### Q3. Explain the four main sanitizers and valgrind. When do you use which?

Compiler instrumentation you enable with `-fsanitize=`; run your test suite under them:

| Tool | Catches | Cost |
|---|---|---|
| **ASan** (Address) | Heap/stack/global overflow, use-after-free, use-after-scope, leaks | ~2× slower, ~3× memory |
| **UBSan** (Undefined) | Signed overflow, bad shifts, misaligned/null deref, invalid casts | Low; often on in CI |
| **TSan** (Thread) | Data races, lock-order inversions | ~5–15× slower |
| **MSan** (Memory) | Reads of uninitialized memory | ~3× slower; needs instrumented libs |
| **valgrind/memcheck** | Similar to ASan, no recompile needed | ~20–30× slower |

Rules of thumb: run **ASan + UBSan together** on every test run (they compose and are cheap enough). Run **TSan** on anything multithreaded. **MSan** is finicky (needs an instrumented libc++) so it's less common. **valgrind** when you *can't* recompile with sanitizers (third-party binary) or want its detailed leak reports, but it's much slower and misses some stack bugs ASan catches. Note ASan and TSan can't run simultaneously.

### Q4. What does this print, and is it correct?

```cpp
std::string_view greet() {
    std::string s = "hello";
    return s;                // returns a view into a local string
}
int main() { std::cout << greet(); }
```

It's a **dangling `string_view`** — UB, not a valid program. `s` is a local `std::string` destroyed at the `return`. The `string_view` is a (pointer, length) pair borrowing `s`'s buffer; the moment `greet()` returns, that buffer is freed. `main` then prints through a pointer to dead memory.

It might *appear* to print `hello` (freed memory often isn't overwritten immediately), which makes it worse — it passes casual testing and corrupts later. ASan flags it instantly as "stack-use-after-return" / "use-after-free."

The lesson: `string_view` and `span` are **non-owning**. Never return one that borrows a local, and be wary of storing them as members that outlive their source. Return `std::string` (by value) here.

### Q5. Spot the bug.

```cpp
std::vector<int> v{1, 2, 3, 4, 5};
for (auto it = v.begin(); it != v.end(); ++it) {
    if (*it % 2 == 0)
        v.push_back(*it * 10);   // <-- bug
}
```

**Iterator invalidation.** `push_back` may reallocate the vector's buffer when it grows past capacity; every existing iterator (including `it` and the `end()` recomputed each loop) then dangles. Continuing to `++it` and dereference is UB. Even without reallocation, appending while iterating to `end()` is a logic trap (you may process the newly added elements or loop forever).

Fixes: collect additions in a separate vector and append after the loop; or `reserve()` enough capacity up front *and* iterate by index over the original size:

```cpp
std::size_t n = v.size();
for (std::size_t i = 0; i < n; ++i)
    if (v[i] % 2 == 0) v.push_back(v[i] * 10);
```

General rule: mutating a container's size while iterating it invalidates iterators — know each container's invalidation guarantees.

### Q6. What's wrong here?

```cpp
auto make() {
    std::vector<int> v{1, 2, 3};
    auto p = std::move(v);
    std::cout << v.size() << "\n";   // (A)
    v.push_back(9);                  // (B)
    return p;
}
```

Line (A) is **legal but relies on unspecified state**, and (B) is fine but often misunderstood. After `std::move(v)`, `v` is in a *valid but unspecified* state — for a `std::vector` implementations leave it empty, so `v.size()` is *probably* `0`, but the standard doesn't promise a specific value, so (A) shouldn't be relied on. (B) is genuinely OK: you may call any operation with *no precondition* on the value (like `push_back`, `clear`, assignment) on a moved-from object.

The **use-after-move bug** would be assuming a *value*: e.g. `v[0]` or "it still has 3 elements." That's the real interview trap. Moved-from means "empty the state, don't read it; reassign or destroy it." clang-tidy's `bugprone-use-after-move` flags genuine misuse.

### Q7. Trace the lifetime bug.

```cpp
const std::string& pick(bool b) {
    static const std::string a = "A";
    std::string tmp = "B";
    return b ? a : tmp;   // <-- bug on one branch
}
```

Returning `a` is fine — it's `static`, lives for the program's duration. Returning `tmp` is a **dangling reference**: `tmp` is a local destroyed when `pick` returns, so the caller gets a reference to dead memory (UB). The bug is branch-dependent, which makes it insidious — `pick(true)` works, `pick(false)` corrupts, so it can survive testing that only exercises the happy path.

Compilers warn here (`-Wreturn-local-addr` / `-Wdangling`), and it's exactly the class of bug UBSan/ASan catch at runtime. Fix: return by value (`std::string`), or don't return a reference to anything with local lifetime. This is the single most common lifetime bug in real reviews.

### Q8. What is strict aliasing and how does it bite you?

The strict-aliasing rule says the compiler may **assume that pointers of unrelated types never point at the same memory**. This lets it keep values in registers instead of reloading after every write through a different-typed pointer — a real optimization. Violating it is UB:

```cpp
float f = 1.0f;
int i = *reinterpret_cast<int*>(&f);   // UB: reading a float through int*
```

Because the optimizer assumes `int*` and `float*` can't alias, it may reorder or cache reads/writes in ways that make this "type punning" produce garbage under `-O2` while working at `-O0`. The bug is invisible until an optimization level or compiler version changes.

Correct ways to reinterpret bits: `std::bit_cast<int>(f)` (C++20), or `std::memcpy` into a target object (the compiler recognizes and optimizes it to a no-op). `char*`/`std::byte*` are exempt — they may alias anything. If you must play fast and loose, `-fno-strict-aliasing` disables the assumption (GCC/Clang), at some optimization cost — a workaround, not a fix.

### Q9. Why is signed integer overflow UB but unsigned isn't, and why does it matter?

**Unsigned** arithmetic is defined to wrap modulo 2ⁿ — `UINT_MAX + 1 == 0`, guaranteed. **Signed** overflow is UB, because historically signed representations varied (the standard only mandated two's complement in C++20) and, more importantly, leaving it undefined lets the optimizer assume it never happens.

That assumption enables real optimizations: the compiler may treat `i < i + 1` as always true, convert `int` loop counters into wider registers without overflow checks, or prove a loop terminates. It also means overflow can't be detected by "checking after the fact":

```cpp
if (x + 1 < x) { /* overflow? */ }   // UB path — optimizer may assume x+1 > x and delete this
```

Consequences: use unsigned (or wider types) when you *need* wrapping; use signed for loop counters and arithmetic where you want the optimizer's help *and* UBSan to catch actual overflow. Detect overflow with `__builtin_add_overflow` / `std::add_sat` (C++26) rather than post-hoc checks. This is a favorite gotcha precisely because "it just wraps" is such a common wrong belief.

### Q10. Explain cache-friendly data layout. Why can it beat a better algorithm?

A cache miss to main memory costs ~100–300 cycles; an L1 hit costs ~4. So the CPU's real constraint is *feeding* the ALU, not the ALU itself. Code that walks memory **contiguously and predictably** lets the hardware prefetcher stream data in ahead of use and packs multiple useful items per 64-byte cache line; code that *pointer-chases* (linked lists, node-based trees, scattered heap objects) stalls on miss after miss.

This is why `std::vector` routinely beats `std::list` even for "list-friendly" operations, and why a linear scan of a packed array can beat a hash lookup at small sizes. An O(n) contiguous scan can outrun an O(log n) pointer-chasing tree because constant factors dominated by memory latency swamp the asymptotic win.

Practical moves: prefer contiguous containers, keep hot data small and together, avoid indirection in inner loops, and lay data out in the order you traverse it. You optimize the *access pattern* first; the algorithm's big-O second.

### Q11. AoS vs SoA — what's the difference and when do you switch?

**Array of Structs** groups fields by entity; **Struct of Arrays** groups by field:

```cpp
// AoS — natural, good when you touch whole objects
struct Particle { float x, y, z, vx, vy, vz; float mass; };
std::vector<Particle> aos;

// SoA — good when you sweep one field across all objects
struct Particles {
    std::vector<float> x, y, z, vx, vy, vz, mass;
};
```

The trade-off is **which access pattern is cache-optimal**. If you update just positions across a million particles, AoS drags the velocity and mass fields into cache uselessly (wasting bandwidth on unread bytes), while SoA streams a dense array of exactly the `x` values you need — and it vectorizes cleanly (SIMD loves contiguous same-type data). Conversely, if you process one whole entity at a time, AoS keeps its fields together on one cache line and SoA scatters them.

Rule: choose the layout that matches your dominant traversal. SoA wins in data-parallel hot loops (physics, ECS game engines, DSP); AoS wins for object-at-a-time logic and is far easier to read. Measure before contorting readable AoS into SoA.

### Q12. What is branch prediction and how does it affect the code you write?

The CPU pipeline is deep, so it can't wait to know a branch's outcome — it **predicts** and speculatively executes ahead. A correct prediction is free; a **mispredict** flushes the pipeline, ~15–20 wasted cycles. Predictors are excellent at regular patterns (a loop that runs 1000 times) and poor at data-dependent unpredictable branches (a coin-flip `if` in a hot loop).

The classic demonstration: summing only the elements above a threshold is dramatically faster on a **sorted** array than an unsorted one — same work, but sorted data makes the branch predictable.

What to do about it:
- **Make branches predictable** or eliminate them — sort data, hoist invariant conditions out of loops.
- **Branchless techniques** in hot paths — replace an unpredictable `if` with arithmetic/`std::min`/a conditional-move (`x = cond ? a : b` often compiles to `cmov`).
- **`[[likely]]`/`[[unlikely]]`** (C++20) hint the compiler which way to lay out code, helping the *static* predictor and code layout — useful for error paths, but don't sprinkle them; the hardware predictor is usually smarter than you.

Always profile: `perf stat` reports `branch-misses`.

### Q13. Move vs copy — where does the performance actually come from?

A copy duplicates the owned resource: `std::vector` copy allocates a new buffer and copies every element — O(n) plus an allocation. A **move** transfers ownership: it steals the source's pointer and size and nulls the source — O(1), no allocation.

```cpp
std::vector<int> big(1'000'000);
auto a = big;             // COPY: allocate + copy 1M ints
auto b = std::move(big);  // MOVE: steal pointer, big becomes empty
```

The win is entirely about **owned heap resources**. Moving a type with no heap ownership (e.g. `std::array<int,4>` or an `int`) is the same cost as copying — there's nothing to steal. So move semantics matter most for containers, strings, `unique_ptr`, file handles.

Where it silently helps: returning big objects (RVO/NRVO often elides even the move), `push_back(std::move(x))`, and pass-by-value-then-move sink parameters. Where people misfire: `return std::move(local)` *pessimizes* by disabling NRVO — just `return local;`. And `std::move` on a `const` object silently copies (you can't steal from a const), a subtle performance bug.

### Q14. What is small-buffer / small-string optimization?

SSO/SBO stores small payloads **inline in the object itself** instead of on the heap, avoiding an allocation entirely for the common small case.

`std::string` is the canonical example: most implementations reserve ~15–22 bytes inside the string object, so short strings (`"error"`, `"id"`) live entirely in the object — no `malloc`, and the data sits right where the object does (cache-friendly). Only when the string exceeds the inline capacity does it allocate a heap buffer.

```cpp
std::string s = "small";        // no heap allocation — lives inside s
std::string big(1000, 'x');     // exceeds SSO capacity → heap allocated
```

Implications: string allocation cost is bimodal — near-free below the SSO threshold, an allocation above it, so a workload of many short strings performs very differently from long ones. `sizeof(std::string)` is ~24–32 bytes because of the inline buffer, not just a pointer. The same idea appears in `std::function` (small callables stored inline), `boost::small_vector`, and various optimized containers. It's why "just use `std::string`" is usually fine for short strings and why benchmarks must use representative data sizes.

### Q15. How do you actually measure performance instead of guessing?

Rule zero: **profile before optimizing** — intuition about C++ hot spots is wrong more often than right, because the bottleneck is usually memory or a mispredicted branch, not the code you're staring at.

The toolkit:
- **Profilers** — `perf` (Linux: `perf record`/`report`, plus hardware counters `perf stat` for cache-misses, branch-misses, IPC), Instruments (macOS), VTune. Find *where* time goes before touching anything.
- **Microbenchmarks** — Google Benchmark for isolated functions; it handles warm-up, iteration counts, and prevents the optimizer from deleting your work (`benchmark::DoNotOptimize`).
- **godbolt (Compiler Explorer)** — inspect the actual generated assembly to confirm inlining, vectorization, or that a construct compiled to what you expected.
- **`-ftime-trace`** (Clang) for compile-time profiling.

Method: measure a baseline, form a hypothesis, change *one* thing, re-measure on representative data, keep it only if it helps. Beware benchmarks that let the optimizer elide the computation, and always test with realistic input sizes (see SSO — small vs large data behave completely differently).

### Q16. "We should optimize this loop with `++i` instead of `i++`." React.

For an `int`, this is a **non-issue** — the compiler generates identical code; there's nothing to optimize, and citing it signals cargo-cult optimization rather than understanding. The advice is a fossil from misapplied guidance.

Where pre-increment *does* matter: **non-trivial iterators** (e.g. some `std::map`/custom iterators), where `i++` must construct and return a *copy* of the old value before incrementing, while `++i` mutates in place and returns a reference. For those, prefer `++i` as a good default habit — but the compiler often optimizes the copy away too when the result is unused.

The senior framing: this is **premature micro-optimization**. It optimizes something that isn't the bottleneck, at the cost of no readability but real distraction. The right instinct is "did we profile? where does the time actually go?" — which is almost never a `++i` in a loop and almost always a cache miss, an allocation, or an algorithmic problem. Use `++i` as a cheap default, but never present it as a performance win without a profiler backing you.

### Q17. What does this print?

```cpp
int arr[3] = {10, 20, 30};
int* p = arr;
std::cout << p[0] << " " << *(p + 3) << "\n";
```

`p[0]` is `10`, defined. `*(p + 3)` is **out-of-bounds** — `arr` has indices 0–2, so index 3 is one past the end, and dereferencing it is UB. (Note: forming the pointer `p + 3` to *one-past-the-end* is legal; *dereferencing* it is not.)

So the honest answer is "the first value is 10; the second is undefined behaviour — it may print garbage, whatever happens to sit in adjacent stack memory, or crash, and the compiler may assume this can't happen and optimize surrounding code unpredictably." A candidate who confidently says "it prints 10 and some garbage value" is half-right about the symptom but should name it as UB, not merely "garbage." ASan flags it as a stack-buffer-overflow. The fix is bounds discipline: prefer `std::array` with `.at()` in checked contexts, or `std::span` which carries a size.

### Q18. What's the performance and correctness problem here?

```cpp
for (int i = 0; i < 1'000'000; ++i)
    std::cout << compute(i) << std::endl;
```

The bug is **`std::endl` in a hot loop**. `std::endl` is not "newline" — it's `'\n'` *plus a stream flush*. Flushing a million times forces a million syscalls/buffer drains, turning a fast loop into an I/O-bound crawl; it can be an order of magnitude slower than buffered output.

Fix: use `'\n'` and let the stream buffer, flushing once at the end (or when you actually need durability):

```cpp
for (int i = 0; i < 1'000'000; ++i)
    std::cout << compute(i) << '\n';   // buffered; flush happens naturally/at exit
```

`std::endl` is only warranted when you genuinely need the data flushed *now* (e.g. logging right before a potential crash, or interactive prompts). This is a real, common production performance bug — and a nice tell in interviews for whether someone understands that `std::endl` ≠ `\n`. (For further speed on bulk I/O, `std::ios::sync_with_stdio(false)` and `\n` are the usual combo.)

## Reviewing C++ Code — Checklist & Guide

### Summary

**What this topic covers**

The practical craft of reviewing a C++ pull request — the synthesis topic that turns everything else in this primer into a repeatable process. It has three parts: (1) a *mental model* of what makes reviewing C++ fundamentally different from reviewing Java/Go/Python, where the compiler and garbage collector catch classes of bugs that in C++ are silent UB; (2) a *structured checklist* — the single most useful artifact here, a scannable set of review checks grouped by theme (ownership, Rule of Five/Zero, const-correctness, lifetime/UB traps, concurrency, exception safety, STL/API design, headers/build, tooling gates); and (3) a set of *worked review scenarios* — real snippets where you find the bug, choose the right smart pointer, judge exception safety, spot a data race, or decide whether to approve an API signature. The goal is to make you the reviewer who catches the dangling `string_view` and the missing `noexcept` move *before* they reach production, and who explains *why* in a way that teaches the author.

**Mental model**

Reviewing C++ is **risk-ranked reading**, and the risks are unique to the language. In a GC'd language you review mostly for logic and design; the runtime guarantees memory safety. In C++, the reviewer *is* part of the safety system. So you read in a specific priority order: first **lifetime and ownership** (who owns this, who frees it, does any reference/pointer/view outlive its target?), because use-after-free is the deadliest and least visible bug; then **UB traps** (bounds, uninitialized, aliasing, overflow); then **concurrency** (data races, lock ordering); then **exception safety** (does a throw mid-operation leak or corrupt?); then **ABI/header hygiene** (does this change break binary compatibility or the build); and only then ordinary logic and style. You also read *outward*: a change to a widely-included header or a public class layout has blast radius far beyond its diff. The reviewer's job is to simulate the compiler's *pessimism* about lifetimes that the compiler itself won't enforce.

**Key terms**

- **Ownership** — which entity is responsible for a resource's lifetime; the first thing to establish in any review.
- **Rule of Five/Zero** — if you write one of destructor/copy/move ctor/assignment you likely need all five; better, own nothing raw so you need *none* (Rule of Zero).
- **Exception safety guarantees** — no-throw, strong (commit-or-rollback), basic (no leak, valid state), none.
- **Dangling view** — a `string_view`/`span`/reference/iterator outliving the data it borrows.
- **Iterator invalidation** — container mutation making existing iterators/pointers/references unsafe.
- **Use-after-move** — reading a moved-from object's value.
- **Data race / lock ordering** — unsynchronized shared access; inconsistent lock acquisition order causing deadlock.
- **RAII** — tying resource lifetime to object scope; the idiom that makes exception safety and cleanup automatic.
- **`noexcept` move** — move operations must not throw, or containers fall back to copying on reallocation.
- **`span`/`string_view` parameters** — non-owning views as function inputs; efficient but must not be stored past the call.
- **Tooling gates** — clang-format, clang-tidy, and ASan/UBSan/TSan in CI: the automated floor beneath human review.

**Why interviewers ask this**

Because senior engineers spend more time reading code than writing it, and a strong reviewer is a force multiplier for a whole team. Asking you to review reveals depth that writing questions can hide: anyone can memorize "use `unique_ptr`," but spotting a `string_view` that borrows a temporary, or a copy-assignment that isn't exception-safe, or a `shared_ptr` cycle, requires you to *hold lifetimes and invariants in your head while reading someone else's code*. It also tests judgment and communication — can you triage severity (block on the use-after-free, note the naming nit), and explain the *why* so the author learns? A candidate who reviews well demonstrates they can be trusted to guard the codebase and mentor others, which is exactly the senior signal interviewers are hunting for.

**Common confusions**

- "If it compiles and passes tests, review is just style" — false in C++; the worst bugs (UB, races, dangling) compile cleanly and often pass tests, surfacing only under load or a new compiler.
- "Smart pointers everywhere means it's memory-safe" — `shared_ptr` cycles leak, `shared_ptr` overuse hides ownership, and a raw view into a smart pointer's data still dangles.
- "`noexcept` is just documentation" — it changes behaviour: containers only *move* elements on grow if the move is `noexcept`, else they copy; a throwing `noexcept` function calls `std::terminate`.
- "A reference parameter can't dangle" — it can, if you *store* it or return something that borrows it.
- "Tooling replaces review" — sanitizers and clang-tidy are the floor, not the ceiling; they miss design, API, and many logic/lifetime bugs.

**What follows from this topic**

This is the capstone. Its checklist is the operational form of the memory-management topic (ownership, RAII), the smart-pointer topic (which pointer, cycles), the move-semantics topic (`noexcept`, use-after-move), the concurrency topic (races, lock ordering), the templates/STL topic (right container, view parameters), and the UB topic (every "spot the bug" pattern). If those topics taught you the rules, this one teaches you to *enforce* them on code you didn't write — the actual daily work of a senior C++ engineer. Treat the checklist below as something to internalize until scanning for these becomes reflex.

### Review checklist

A structured, scannable checklist for reviewing a C++ change. Read in this order — top themes are the highest-severity, most C++-specific risks.

**Memory & ownership**
- No raw `new`/`delete` in application code — use `make_unique`/`make_shared` and RAII wrappers.
- Ownership is *explicit and singular*: who owns each resource is obvious from the types (`unique_ptr` = sole owner, `shared_ptr` = shared, raw pointer/reference/`span` = non-owning borrow).
- Correct smart-pointer choice: `unique_ptr` by default; `shared_ptr` only for genuinely shared lifetime; `weak_ptr` to break cycles.
- No `shared_ptr` reference cycles (parent↔child) — at least one direction is `weak_ptr`.
- No manual resource management that RAII could handle (files, locks, sockets, handles).

**Rule of Five / Rule of Zero**
- Classes owning a resource define *all* of destructor + copy/move ctor + copy/move assignment (or `=delete`/`=default` them deliberately).
- Prefer **Rule of Zero**: own nothing raw, let members' own special functions compose — no hand-written special members at all.
- Move operations are `noexcept` (or there's a reason they aren't).
- Copy/move assignment handles self-assignment and is exception-safe (copy-and-swap where apt).

**Const & type safety**
- `const`-correct: parameters, methods, and locals that don't mutate are `const`; pass read-only large objects by `const&`.
- No `const_cast` away of constness to mutate; no unnecessary C-style casts (use named casts, and question every `reinterpret_cast`).
- Prefer `enum class` over plain `enum`; no implicit narrowing conversions.
- Integer signedness is deliberate (no signed/unsigned comparison warnings; loop counters chosen consciously).

**Lifetime & UB traps**
- No dangling `string_view`/`span`/reference/iterator — nothing borrows a temporary, a local, or a soon-reallocated buffer.
- No use-after-move (reading a moved-from object's value).
- No iterator/reference invalidation across a container mutation (`push_back`, `erase`, `insert` in a loop).
- No uninitialized variables; no out-of-bounds indexing (prefer `.at()`/`span`/range-for over raw indices).
- No signed overflow assumptions, bad shifts, or strict-aliasing violations (`bit_cast`/`memcpy`, not pointer punning).

**Concurrency**
- Shared mutable state is synchronized (mutex/atomic); no data races.
- Consistent **lock ordering** everywhere to prevent deadlock; prefer `scoped_lock` for multiple mutexes.
- Locks held via RAII (`lock_guard`/`unique_lock`/`scoped_lock`), never manual lock/unlock.
- `atomic` memory orders are justified — default to `seq_cst`; relaxed/acquire-release only with a clear argument.
- No accidental data sharing via captured-by-reference lambdas handed to threads.

**Exception safety & error handling**
- Every operation offers a defined guarantee (basic minimum; strong for mutations that must be atomic).
- Destructors and move operations don't throw; no `throw` from a `noexcept` function.
- Errors handled deliberately — exceptions vs `expected`/error codes used consistently; no silently swallowed exceptions.
- Resources released on every path (RAII), including the throwing one; no leak on early return/throw.

**STL & API design**
- The right container for the access pattern (`vector` by default; `map`/`unordered_map`/`flat_map` chosen for real reasons).
- Parameters take the right form: `span`/`string_view` for read-only ranges/strings, sink params by value + `move`, big read-only objects by `const&`.
- APIs are hard to misuse: strong types over bare `bool`/`int` flags, `[[nodiscard]]` on must-check returns, no out-params where a return works.
- No unnecessary copies (structured bindings/`const auto&` in range-for; `emplace_back`/`reserve` where it matters).

**Headers & build**
- No `using namespace` (especially `std`) in a header.
- No non-`inline` function/variable *definitions* in headers (ODR / multiple-definition risk).
- Include-what-you-use: every used symbol has a direct include; forward-declare to cut coupling; heavy includes pushed to `.cpp`.
- No ODR violations (differing definitions of the same entity); public class layout changes reviewed for ABI impact.

**Tooling gates**
- `clang-format` clean (no style bikeshedding in review — the formatter decides).
- `clang-tidy` warnings addressed (bugprone-*, modernize-*, performance-*).
- Compiles clean under `-Wall -Wextra` (ideally `-Werror`); no new warnings.
- Covered by ASan + UBSan (and TSan if threaded) in CI; new code has tests exercising the risky paths.

### Q1. Review this snippet — find the bugs.

```cpp
class Buffer {
    char* data_;
    size_t size_;
public:
    Buffer(size_t n) : data_(new char[n]), size_(n) {}
    ~Buffer() { delete[] data_; }
    char& at(size_t i) { return data_[i]; }
};
```

Two serious problems and a smaller one:

1. **Rule of Five violation** — it owns a raw resource and defines a destructor but *not* the copy/move operations. So the compiler-generated copy does a shallow pointer copy; copy a `Buffer` and both objects `delete[]` the same buffer → **double free** (UB). This is the classic reason "define one of the five, consider all five."
2. **No bounds check** — `at()` implies checking (that's the STL convention), but this indexes raw. Either rename to `operator[]` or actually validate `i < size_`.
3. Constructor should be `explicit` to avoid `Buffer b = 100;` implicit conversions.

The senior fix is **Rule of Zero**: replace `char* data_` with `std::vector<char>` (or `std::unique_ptr<char[]>`), delete the destructor, and let the members' own special functions handle copy/move correctly and exception-safely. Owning raw pointers by hand in 2026 is almost always a smell.

### Q2. Which smart pointer here, and why?

"A `Scene` holds many `Node`s. Each `Node` needs to reach its parent `Node`, and the `Scene` owns the root."

- **`Scene` owns the tree**: parent nodes own their children with `std::unique_ptr<Node>` (or a `vector<unique_ptr<Node>>` of children) — sole, clear ownership, automatic cleanup, no ref-counting overhead.
- **Child → parent back-pointer**: a **raw pointer** `Node* parent_` (non-owning), or `std::weak_ptr` *only if* the tree is `shared_ptr`-owned. It must **not** be `shared_ptr` — a `shared_ptr` parent plus `shared_ptr` children creates a **reference cycle**, so neither ever hits refcount zero and the whole tree leaks.

The principle: **owning edges point one way** (down the tree, `unique_ptr`), **back-references are non-owning** (raw pointer or `weak_ptr`). If you'd used `shared_ptr` everywhere "to be safe," I'd flag it: it hides ownership, adds atomic-refcount cost, and here it leaks. Reach for `shared_ptr` only when lifetime is *genuinely* shared with no clear single owner.

### Q3. Is this exception-safe?

```cpp
Widget& Widget::operator=(const Widget& other) {
    delete impl_;
    impl_ = new Impl(*other.impl_);   // if this throws...
    return *this;
}
```

**No** — it offers *no* guarantee. If `new Impl(...)` throws (allocation failure or the copy constructor throwing), `impl_` has already been `delete`d and is now a **dangling pointer**: the object is left in a broken state, and the destructor will double-delete or `delete` garbage. It also doesn't handle **self-assignment** (`w = w` deletes `impl_` then copies from the freed object).

The fix is **copy-and-swap**, which gives the *strong* guarantee for free:

```cpp
Widget& Widget::operator=(Widget other) {   // by value → copy happens first, may throw here safely
    swap(*this, other);                      // noexcept swap
    return *this;                            // old state destroyed with 'other'
}
```

The copy is made *before* any mutation; if it throws, `*this` is untouched. The `swap` is `noexcept`. Self-assignment is harmless. Even better: use `unique_ptr<Impl>` and let Rule of Zero generate a correct assignment. I'd block the PR on this — a throwing copy-assign is a latent crash.

### Q4. Spot the data race.

```cpp
int counter = 0;
void worker() {
    for (int i = 0; i < 100000; ++i)
        ++counter;              // called from multiple threads
}
```

`++counter` from multiple threads is a **data race** → UB. `++counter` is read-modify-write (load, increment, store), not atomic; two threads interleave and lose updates, so the final count is wrong *and* the program is technically undefined (TSan will flag it). "It's just an int, increment is surely atomic" is the wrong intuition — nothing about a plain `int` is atomic.

Fixes, in order of preference here:
- **`std::atomic<int> counter{0};`** then `++counter;` — lock-free, correct, minimal change. For a pure counter, `counter.fetch_add(1, std::memory_order_relaxed)` is enough since no other memory is ordered by it.
- A `std::mutex` + `lock_guard` if the update were part of a larger critical section.
- Best for throughput: each thread accumulates a *local* counter and adds once at the end, avoiding contention entirely.

I'd also note: run this under **TSan** in CI — data races are exactly what it exists to catch, and they're invisible to normal testing.

### Q5. Would you approve this API signature?

```cpp
std::vector<std::string> parse(std::string input, bool trim, bool lower, bool dedupe);
```

Not as-is. Problems:

- **Boolean parameter soup** — `parse(text, true, false, true)` is unreadable at the call site and easy to transpose. Replace the flags with a strong options type or named flags: `parse(text, ParseOptions{.trim = true, .dedupe = true})`, or an `enum class` bitmask.
- **`std::string input` by value** — if the function only reads it, take `std::string_view` (no copy, accepts any string-like). Take by value *only* if you sink/store it.
- **Missing `[[nodiscard]]`** — the result is the entire point; callers must not ignore it. Add `[[nodiscard]]`.

Revised:

```cpp
[[nodiscard]] std::vector<std::string> parse(std::string_view input, ParseOptions opts = {});
```

The guiding principle is **make interfaces hard to use wrong**: strong types over bare bools, views for read-only inputs, `[[nodiscard]]` on must-use returns. I'd approve after the flags become a named type — the boolean list is the real blocker; it *will* cause a caller to pass arguments in the wrong order.

### Q6. What's wrong with this header?

```cpp
// utils.h
#include <vector>
using namespace std;

int global_count = 0;

int add(int a, int b) { return a + b; }
```

Three defects, escalating:

1. **`using namespace std;` in a header** — the worst offender. Every TU that includes `utils.h` gets `std` dumped into its global namespace, causing surprise name collisions and ambiguities far from this file, with no way to opt out. Never do this in a header (and rarely in a `.cpp`).
2. **`int global_count = 0;` — a *definition* in a header** — every including TU defines the same external symbol → **multiple definition** linker error (ODR). Fix: `extern int global_count;` here + one definition in a `.cpp`, or `inline int global_count = 0;` (C++17) if a header-only global is truly wanted.
3. **`int add(...)` — non-`inline` function definition in a header** — same ODR/multiple-definition problem across TUs. Fix: mark it `inline`, or declare here and define in `utils.cpp`.

Also: no include guard / `#pragma once` (re-inclusion in one TU redefines things), and it should include what it needs and no more. I'd block this — it won't even link once included twice.

### Q7. Review the lifetime here.

```cpp
std::string_view first_word(const std::string& s) {
    return s.substr(0, s.find(' '));   // <-- look closely
}
```

**Dangling `string_view`.** `s.substr(...)` returns a *new `std::string` by value* — a temporary. The function then constructs a `string_view` borrowing that temporary's buffer and returns it; the temporary is destroyed at the end of the full expression, so the caller receives a view into freed memory → UB. It'll often *appear* to work, which is what makes it dangerous.

The bug is subtle because `substr` looks like it returns a view but actually allocates. Fixes:
- Return a view into the *original* `s` without allocating: `return std::string_view(s).substr(0, s.find(' '));` — `string_view::substr` returns a view, borrowing `s` (valid as long as the caller keeps `s` alive).
- Or return `std::string` by value if you want an owning result.

I'd also note the remaining constraint: even the correct version returns a view borrowing `s`, so the caller must not let it outlive `s`. Any function returning a `string_view`/`span` deserves a comment stating what it borrows. Block on this — it's a textbook use-after-free.

### Q8. This function is marked `noexcept`. Is that safe?

```cpp
void append_all(std::vector<int>& dst, const std::vector<int>& src) noexcept {
    for (int x : src)
        dst.push_back(x);   // can this throw?
}
```

**No — the `noexcept` is a lie, and a dangerous one.** `push_back` can throw `std::bad_alloc` when it reallocates and the allocation fails. When an exception tries to escape a `noexcept` function, the runtime calls `std::terminate` — the program hard-crashes instead of letting a caller handle the out-of-memory condition. So this `noexcept` converts a recoverable exception into an unconditional abort.

The rule: only mark a function `noexcept` if it *genuinely cannot throw* — no allocation, no throwing callees. Here, either drop `noexcept`, or make it actually non-throwing by reserving up front and... no, `push_back` still allocates; you can't honestly promise `noexcept` around heap growth.

Where `noexcept` *does* belong: destructors (implicitly), **move constructors/assignment** (so containers move rather than copy on reallocation — a real performance win), and `swap`. Mismarking `noexcept` is a subtle bug because it compiles and usually works — until the day allocation fails. I'd request removing it (or a comment justifying a real no-throw guarantee).

### Q9. Two threads, two mutexes — what's the risk?

```cpp
// Thread A                    // Thread B
lock(mutexA);                  lock(mutexB);
lock(mutexB);                  lock(mutexA);
// ... transfer ...            // ... transfer ...
```

**Deadlock via lock-order inversion.** Thread A holds `mutexA` and waits for `mutexB`; Thread B holds `mutexB` and waits for `mutexA`; neither can proceed. This is the classic dining-philosophers deadlock, and it's timing-dependent — it may pass a thousand test runs and hang in production under load.

Fixes:
1. **Consistent global lock ordering** — every site acquires `mutexA` *before* `mutexB`, always. Discipline-based, but simple.
2. **`std::scoped_lock`** (C++17) — locks multiple mutexes at once using a deadlock-avoidance algorithm, regardless of the order you list them:
   ```cpp
   std::scoped_lock lk(mutexA, mutexB);   // both threads write this; no inversion possible
   ```
   This is the preferred fix — it removes the ordering requirement entirely.

I'd block on it and recommend `scoped_lock`. I'd also flag the raw `lock()` calls: locks should be RAII-managed so they release on every path including exceptions. And note that TSan detects lock-order inversions, so this belongs in the CI gate.

### Q10. Spot the bug and the performance issue.

```cpp
std::map<std::string, int> counts;
for (int i = 0; i < items.size(); ++i) {
    std::string key = items[i];
    counts[key] = counts[key] + 1;
}
```

**Correctness:** it's actually correct (`counts[key]` default-constructs `0` on first access), but there's a signedness smell — `int i` vs `items.size()` (`size_t`) triggers a signed/unsigned comparison warning and breaks for very large containers. Use `for (const auto& item : items)`.

**Performance, several:**
- `std::string key = items[i];` makes an **unnecessary copy** of every element — use `const auto&`.
- `counts[key]` is looked up **twice** per iteration (read then write). Do it once: `++counts[key];`.
- `std::map` is a red-black tree (pointer-chasing, cache-unfriendly, O(log n)). If ordering isn't needed, **`std::unordered_map`** (O(1) average) or a `flat_map` is faster for counting.

Cleaned up:

```cpp
std::unordered_map<std::string, int> counts;
for (const auto& item : items)
    ++counts[item];
```

None of these is a *blocker* — the code works — but for a hot path I'd request the copy-elimination and double-lookup fixes, and question the `map` vs `unordered_map` choice. This is the kind of "correct but wasteful" pattern review exists to catch.

### Q11. Review this factory. Anything to fix?

```cpp
Widget* create(bool fancy) {
    if (fancy) return new FancyWidget();
    return new PlainWidget();
}
```

The signature **leaks ownership responsibility** — returning a raw owning pointer forces every caller to remember to `delete`, and there's no signal that they own it. It's a leak waiting to happen and it's not exception-safe at call sites.

Return a smart pointer that encodes ownership:

```cpp
std::unique_ptr<Widget> create(bool fancy) {
    if (fancy) return std::make_unique<FancyWidget>();
    return std::make_unique<PlainWidget>();
}
```

Now ownership transfer is explicit, cleanup is automatic, and it's exception-safe. Two more review notes: (1) `Widget` must have a **`virtual` destructor** — this is polymorphic deletion through a base pointer, and without a virtual dtor deleting a `FancyWidget` via `Widget*`/`unique_ptr<Widget>` is UB (the derived destructor won't run). Verify that in the base class. (2) The `bool` parameter is a mild smell; if variants grow, an `enum class WidgetKind` reads better than `create(true)`. I'd block until it returns `unique_ptr` and confirm the base destructor is virtual — the raw `new` returning a base pointer is the real risk.

### Q12. What guarantee does this offer, and is it enough?

```cpp
void Account::transfer(Account& to, Money amt) {
    balance_ -= amt;          // step 1
    to.deposit(amt);          // step 2 — can this throw?
}
```

It offers **no meaningful guarantee**, and for money that's a serious bug. If `to.deposit(amt)` throws (validation, overflow check, logging failure — anything), step 1 has already run: money has left `this` account but never arrived. The object is left in an **inconsistent, money-losing state**. That's a *broken invariant*, the worst kind of exception-unsafety.

You want at least the **strong (commit-or-rollback) guarantee**: either the whole transfer happens or nothing does. Reorder so the throwing/validating work happens *before* any mutation, then commit with non-throwing steps:

```cpp
void Account::transfer(Account& to, Money amt) {
    to.validate_deposit(amt);   // may throw — nothing mutated yet
    if (balance_ < amt) throw InsufficientFunds{};
    // both checks passed: now do the non-throwing mutations
    balance_ -= amt;
    to.balance_ += amt;
}
```

The principle — **do all the work that can fail before any work that mutates state** — is the core technique for the strong guarantee (same idea as copy-and-swap). For real money you'd also need atomicity across threads (lock both accounts with `scoped_lock`) and durability, but the exception-safety hole is the blocker. I'd reject the original.

### Q13. Anything wrong with returning by `const` value or this range-for?

```cpp
const std::vector<int> makeData();      // (A)

for (auto x : makeData())               // (B)
    process(x);
```

Two separate notes:

**(A) `const` return by value** is a minor anti-pattern: it prevents the caller from *moving* from the returned temporary (you can't move out of a `const`), so it can silently force copies and disables useful client code. Return a non-`const` value; use `const` on the *variable*, not the return type.

**(B)** `for (auto x : makeData())` — here `auto x` copies each element, which for `int` is fine but would be wasteful for a heavier element type; the habit should be `for (const auto& x : ...)` for read-only iteration. More importantly, calling `makeData()` in the range expression is fine (the temporary's lifetime is *extended* for the duration of the loop — that's a guaranteed rule), so there's **no dangling bug** here — a common false alarm reviewers raise. But note the classic trap nearby:

```cpp
for (auto x : makeData().front())   // if front() returned a view/ref into the temp — dangling!
```

Range-for only lifetime-extends the *outermost* temporary; calling a member that returns a reference/view into it dangles. So: fix the `const` return type, prefer `const auto&` in the loop, and know the range-for lifetime-extension rule precisely so you neither introduce nor falsely flag the bug.

### Q14. Give me your general approach to reviewing a large C++ PR.

I read in **risk order**, not top-to-bottom:

1. **Understand intent first** — read the PR description and tests to know what it's *supposed* to do; review against intent, not just for local correctness.
2. **Ownership & lifetime pass** — for every new pointer/reference/view/container: who owns it, who frees it, can any borrow outlive its target? This catches the deadliest, least-visible bugs (use-after-free, dangling views) first.
3. **UB & concurrency pass** — bounds, uninitialized reads, use-after-move, iterator invalidation; then shared state, locks, and races if it's threaded.
4. **Exception safety & error handling** — does each mutation leave a valid state on throw? Are errors handled consistently?
5. **API & design** — is the interface hard to misuse? Right containers, right parameter types, `[[nodiscard]]`, strong types over bools.
6. **Headers/build/ABI** — no `using namespace` or definitions in headers, include hygiene, blast radius of layout changes.
7. **Then style** — but only what the formatter *doesn't* own; I don't bikeshed whitespace that `clang-format` handles.

Throughout I **triage severity**: block on UB/races/leaks/broken invariants; request-changes on wasteful copies and misusable APIs; leave nits as non-blocking suggestions. And I lean on the tooling gates — clang-tidy, ASan/UBSan/TSan in CI — as the automated floor, so human review time goes to the design and lifetime judgment calls the tools *can't* make. Finally, I explain the *why* on every substantive comment: a review that teaches is worth more than one that just gatekeeps.
