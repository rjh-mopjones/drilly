---
type: interview-prep
---

# C++ for Financial Mathematics Interview Primer — 333 Questions

Comprehensive Q+A primer for quant-developer interviews — C++ applied to financial and numerical computing. The fourth Computational Finance primer, and the applied counterpart to the general C++ language primer: it assumes you know C++ syntax and focuses on how C++ builds pricing libraries, Monte Carlo & PDE engines, low-latency numeric code, and how templates/RAII/move-semantics/memory serve performance and correctness in finance. Cross-references the Quantitative Methods primer (the maths being implemented), High-Frequency Finance (low-latency), and Concurrency.

Covers the C++-in-finance landscape, floating-point precision (why money isn't a double), value semantics & RAII, templates/CRTP/expression templates, OO design for pricing libraries, STL numeric algorithms, memory & cache performance, move semantics & RVO, modern C++ (11→23), linear algebra (Eigen, Cholesky for correlated normals), random number generation, Monte Carlo engine design, numerical methods (implied-vol solvers, trees, PDEs), C++ concurrency, low-latency techniques, error handling & numerical robustness, C++↔Python (pybind11, the GIL, zero-copy), build/test/profile tooling, QuantLib-style design patterns, real-world quant C++ (Greeks via bump vs AAD), and quant-dev interview playbooks.

Every answer carries real, idiomatic modern C++ (in code fences) with the performance/correctness rationale a quant desk cares about; maths formulas are in plain ASCII (the reader renders no LaTeX). Warm-up ("double vs float for prices", "what is RAII", "why C++ in finance") to senior ("design a generic templated Monte Carlo engine", "kill virtual dispatch on the hot path with CRTP", "expression templates in Eigen", "Greeks via AAD vs bump-and-revalue", "parallelize Monte Carlo with per-thread RNG").

1. [[#C++ for Quant Finance: The Landscape]]
2. [[#Numerical Types & Floating-Point Precision]]
3. [[#Value Semantics, RAII & Resource Management]]
4. [[#Templates & Generic Numerical Code]]
5. [[#OO Design for Pricing Libraries]]
6. [[#STL & Standard Algorithms for Quant Code]]
7. [[#Memory Management & Cache Performance]]
8. [[#Move Semantics & Perfect Forwarding]]
9. [[#Modern C++ (11 to 23) for Quants]]
10. [[#Linear Algebra in C++]]
11. [[#Random Number Generation]]
12. [[#Monte Carlo Engines in C++]]
13. [[#Numerical Methods Implementation]]
14. [[#Concurrency & Parallelism in C++]]
15. [[#Low-Latency C++ Techniques]]
16. [[#Error Handling & Numerical Robustness]]
17. [[#Interfacing C++ with Python]]
18. [[#Building, Testing & Profiling]]
19. [[#Design Patterns for Financial Libraries]]
20. [[#Real-World Quant C++]]
21. [[#C++ Quant Interview & Scenario Playbooks]]

## C++ for Quant Finance: The Landscape

### Summary

**What this topic covers**

Why C++ still owns the pricing, risk, and execution core of the financial industry in 2026 — and what a quant developer actually builds with it. This is the orientation topic: the *shape* of the field before the mechanics. Three concern areas: (1) the **economics** — why banks and funds keep a large C++ codebase (latency, deterministic numerical control, decades of legacy libraries) despite the ergonomic pull of Python and Rust; (2) the **architecture** — the **two-language problem**, where a C++ compute core is wrapped and driven from a Python research/glue layer via pybind11, and where **QuantLib** sits as the reference open-source library everyone measures against; and (3) the **role** — what a "quant dev" versus a "quant analyst/researcher" does day to day, and which C++ standard (17 or 20) production desks actually target. The 16 questions here set the stance for the whole primer: this is C++ *applied to numerical finance*, not a language tutorial. Every later topic — floating point, RAII, templates, Monte Carlo — assumes you have this map in your head.

**Mental model**

Picture a bank's pricing stack as a pyramid. At the **base** is a C++ analytics library — payoffs, curves, models, Monte Carlo and PDE engines. It is optimised, tested against golden values, and changes slowly. On **top** sits a research and glue layer, almost always Python: notebooks, calibration scripts, scenario runners, dashboards. Between them is a thin **binding** (pybind11 for in-house libs, SWIG for QuantLib) that lets Python call the C++ core with near-zero overhead. Traders and risk systems hit the same core through services. The key insight: **you cross the language boundary as rarely and as coarsely as possible** — one call that prices a million paths in C++, not a million calls from Python. C++ earns its place at the base because that is where microseconds and last-bit numerical reproducibility are non-negotiable; Python earns the top because iteration speed matters more there than raw throughput. A quant dev spends most of their time at the base and the binding; a quant researcher lives at the top and occasionally reaches down.

**Key terms**

- **Quant developer** — engineer who builds and optimises the C++ analytics/infra; owns performance, correctness, and the Python bindings.
- **Quant analyst / researcher** — designs the models and maths; prototypes in Python, hands specs (or working code) to quant devs.
- **Two-language problem** — the tension between a fast compiled core and a productive scripting front-end; solved by bridging, not by picking one.
- **pybind11** — header-only C++11 library that exposes C++ functions/classes to Python with automatic type conversion; the modern default binding.
- **QuantLib** — the canonical open-source C++ quant library (instruments, engines, term structures, date logic); Python bindings via SWIG (QuantLib-Python).
- **Pricing library** — the code that turns market data + a trade into a price and its risks (Greeks).
- **Risk engine** — batch system that revalues a whole portfolio under many scenarios (VaR, sensitivities).
- **Execution / low-latency core** — order handling and market-data processing where nanoseconds matter; C++ (sometimes with FPGA) territory.
- **C++17 / C++20 baseline** — the standards production desks actually compile with; C++20 adds concepts, ranges, `std::jthread` but toolchain lag keeps many shops on 17.
- **Legacy moat** — millions of lines of battle-tested C++ analytics that no one will rewrite; a structural reason C++ persists.

**Why interviewers ask this**

They want to know you understand *why* you would reach for C++ here rather than treating it as the language you happened to learn. A junior answer is "C++ is fast." A senior answer distinguishes the three real drivers — latency, numerical determinism, and legacy — and can say where C++ is the *wrong* tool (research iteration, glue, anything IO-bound). They are also probing whether you know the ecosystem: naming QuantLib, pybind11, and the two-language pattern signals you have worked in a real quant stack rather than only done coursework. Getting the role distinction right (dev vs researcher) tells them which seat you are actually interviewing for and calibrates the rest of the conversation.

**Common confusions**

- "C++ because it's the fastest language" — incomplete; Rust is comparably fast. C++'s edge is the *combination* of speed, fine numerical control, and the enormous existing library base.
- "Everything is C++" — no. The modern stack is deliberately mixed: C++ core, Python everywhere else. Insisting on pure C++ is a red flag.
- "QuantLib is what banks use in production" — mostly it's a reference and teaching library; big banks run proprietary analytics, though many borrow QuantLib's design (PricingEngine, Handle/Observer).
- "Quant dev and quant researcher are the same job" — different skill sets and interviews; devs are graded on C++/systems, researchers on maths/stats.
- "Rust will replace C++ here soon" — Rust is growing at the edges (new services, infra) but the analytics moat and toolchain inertia keep C++ central for years yet.

**What follows from this topic**

Everything. The two-language problem sets up the C++ <-> Python topic (pybind11, GIL, zero-copy). "Numerical control" previews Floating-Point Precision. "Latency and no GC pauses" previews RAII and Low-Latency. QuantLib's design previews the OO-for-pricing and Financial-Library-Patterns topics. Keep this map in mind: each later topic is a zoom-in on one block of the pyramid.

### Q1. Why is C++ still the dominant language for the pricing and risk core in finance?

Three independent reasons, and it's the *combination* that's decisive:

1. **Latency and predictable performance.** No garbage collector means no stop-the-world pauses — destruction is deterministic (RAII). For execution and intraday risk, tail latency matters as much as throughput, and a GC pause at the wrong microsecond is unacceptable. C++ gives you direct control over memory layout, inlining, and cache behaviour.

2. **Numerical control.** You choose exactly which floating-point type, which rounding, which library call (`std::fma`, `log1p`), and you get bit-for-bit reproducibility. Regulated risk numbers must reproduce exactly across runs; a managed runtime that reorders or recompiles hot code fights that.

3. **The legacy moat.** Decades of tested analytics — millions of lines — that price exotic books correctly. Nobody rewrites that; new code layers onto it.

Rust matches 1 and 2 but not 3 (no library base yet), which is why C++ persists. "It's fast" alone is the junior answer.

### Q2. What is the "two-language problem" and how does the industry solve it?

The **two-language problem**: the language that is fastest to *run* (C++) is slow to *iterate* in, and the language that is fastest to *iterate* in (Python) is too slow to run heavy numerics. Research wants Python's REPL, notebooks, and libraries; production wants C++'s speed and determinism. Writing everything twice is wasteful and error-prone.

The industry doesn't pick one — it **bridges**:

```cpp
// C++ core: a pricing function
double price_european(double S, double K, double r,
                      double sigma, double T, bool is_call);

// Exposed to Python with pybind11
PYBIND11_MODULE(pricing, m) {
    m.def("price_european", &price_european,
          "Black-Scholes European price");
}
```

```python
# Python research layer drives the fast core
import pricing
px = pricing.price_european(100, 100, 0.02, 0.2, 1.0, True)
```

The C++ core carries the compute; Python carries the research, glue, and orchestration. The rule is **coarse-grained crossings**: one call that does a lot of work, not a chatty loop across the boundary. This is the single most important architectural fact about a modern quant stack. See the C++ <-> Python topic for GIL release and zero-copy detail.

### Q3. What does a quant developer actually do, versus a quant analyst?

**Quant developer (quant dev):** builds and maintains the C++ analytics library and the infrastructure around it. Concerns: performance (profiling, cache, SIMD), correctness (tests, sanitizers, numerical stability), API and binding design (pybind11), build systems (CMake), and integration into risk/pricing services. Interviewed on C++, systems, data structures, and numerical methods.

**Quant analyst / researcher:** designs the models — chooses the stochastic process, derives the PDE, designs the calibration, validates against market. Prototypes in Python/Mathematica; may hand a spec or reference implementation to a dev. Interviewed on probability, stochastic calculus, statistics, and modelling judgement.

There is overlap (a "quant" at a small fund may do both), and a third role — **desk/strat quant** — sits next to traders doing fast, pragmatic modelling. This primer targets the **dev** seat: you implement the maths the researcher specifies, fast and correctly.

### Q4. Which C++ standard should a quant library target, and why not always the newest?

Target **C++17 as a safe production baseline, C++20 where the toolchain allows.** Reasons:

- **C++17** is universally supported by the compilers desks actually deploy (GCC, Clang, MSVC), gives you structured bindings, `if constexpr`, `std::optional`, parallel STL, and guaranteed copy elision. It's the pragmatic floor.
- **C++20** adds the features that genuinely help numerics: **concepts** (constrain `template<std::floating_point T>` cleanly), **ranges** (lazy pipelines), `std::span` (non-owning buffer views for cheap path passing), `std::jthread`, and better `constexpr`. Adopt it once your build/CI and third-party deps are ready.
- **Newest isn't free.** Banks pin compiler versions for reproducibility and validation; upgrading a toolchain across a large regulated codebase is a project. C++23 goodies (`std::expected`, `std::mdspan`) are attractive but adoption lags.

The senior point: standard choice is a *risk and toolchain* decision, not a "grab the latest" reflex. Reproducibility of risk numbers can trump language ergonomics.

### Q5. Where do Python and Rust fit alongside C++ in a modern quant stack?

**Python** — the research, glue, and orchestration layer: notebooks, calibration scripts, scenario/backtest harnesses, data pipelines (pandas/NumPy), dashboards, and test drivers. It calls the C++ core; it does not carry heavy inner loops. Its value is iteration speed and ecosystem, not raw performance.

**Rust** — growing at the *edges*: new microservices, infra tooling, data plumbing, and greenfield low-latency components where memory safety without a GC is attractive. It matches C++ on speed and beats it on safety guarantees, but lacks the quant library ecosystem (no QuantLib equivalent, thinner numerical/linear-algebra tooling) and the deep in-house codebase, so it rarely replaces the analytics core yet.

**C++** — the analytics/pricing/execution core, as covered in Q1.

Rule of thumb: **compute-and-latency-critical core → C++; safety-critical new infra → increasingly Rust; everything human-facing and iterative → Python.** A strong candidate frames these as complementary, not competing.

### Q6. What is QuantLib and how is it used in practice?

**QuantLib** is the reference open-source C++ quantitative finance library. It provides instruments (options, swaps, bonds), **pricing engines**, term structures (yield curves, vol surfaces), and an infamously thorough date/calendar/day-count layer. Its design is the canonical teaching example of quant OO: an `Instrument` holds a payoff and delegates valuation to a pluggable `PricingEngine` (Strategy pattern), and market data flows through a `Handle`/`Observer` mechanism so changing a quote invalidates and recomputes dependents.

In practice:
- **As a reference/benchmark** — validate your own analytics against it; borrow its design patterns.
- **Via QuantLib-Python** (SWIG bindings) — for research and prototyping without touching C++.
- **As a base to extend** — add a custom engine or instrument.

Most large banks run **proprietary** analytics in production (control, performance, and IP reasons) but heavily echo QuantLib's architecture. Naming QuantLib and describing its PricingEngine/Handle design signals real ecosystem exposure. See the Financial-Library-Patterns topic for the Handle/Observer mechanics.

### Q7. Why not just write the whole system in Python with NumPy — isn't NumPy already C under the hood?

NumPy vectorised operations are indeed fast C loops, and for *array-shaped, embarrassingly-vectorisable* work (bulk Black-Scholes over a grid) pure NumPy is often good enough. But it breaks down where quant workloads actually live:

- **Path-dependent, branchy logic** (barrier monitoring, early exercise, callable schedules) doesn't vectorise cleanly; you fall back to Python-level loops that are 50–100x slower.
- **Boundary overhead and the GIL** — chatty per-step calls into NumPy pay Python interpreter cost each iteration, and threading is throttled by the GIL.
- **Memory and layout control** — NumPy gives you arrays, not cache-line-tuned SoA layouts, custom allocators, or SIMD you can direct.
- **Latency determinism** — the interpreter and its allocator introduce jitter unacceptable in execution paths.

So NumPy is excellent *glue and prototyping*, and part of the Python top layer — but the compute core that needs branchy loops, deterministic latency, and memory control is C++. The two-language pattern exists precisely because "just use NumPy" only covers the vectorisable slice.

### Q8. How does a typical pricing request flow through such a system?

End to end, coarse-grained crossings at each layer:

```
Trader / risk system
      |  (request: trade + as-of market data)
      v
Service layer (C++ or thin Python)
      |
      v
Python orchestration (optional): pick model, assemble curves
      |  (one coarse call)
      v
C++ analytics core
   - build term structures from market quotes
   - select PricingEngine (analytic / tree / Monte Carlo)
   - compute price + Greeks
      |  (result: number + sensitivities)
      v
back up the stack, serialised to the caller
```

Key properties: market data is assembled once and shared (Handle/Observer so a quote change ripples); the heavy compute happens entirely inside C++ with the GIL released if driven from Python; the boundary is crossed a handful of times with fat payloads, never in an inner loop. This flow is the backbone the rest of the primer implements piece by piece — engines (Monte Carlo topic), curves (Financial-Library-Patterns), Greeks (bump vs AAD).

### Q9. What are the biggest risks or downsides of a C++ core, and how are they managed?

C++ buys performance and control at the cost of **safety and productivity**, and mature desks manage that explicitly:

- **Memory/lifetime bugs (UB)** — dangling references, use-after-free, buffer overruns. Managed with **RAII and smart pointers** (no raw `new`/`delete`), plus **sanitizers** in CI: ASan (memory), UBSan (undefined behaviour), TSan (races).
- **Slow iteration / long builds** — heavy templates and large codebases compile slowly. Managed with modular builds, precompiled headers, `ccache`, and pushing experimentation into the Python layer.
- **Numerical subtlety** — silent precision loss, `-ffast-math` breaking IEEE semantics. Managed with tolerance-based tests, golden values, and property tests (put-call parity).
- **Talent and maintenance cost** — expert C++ is scarce; the code must be readable. Managed with strong conventions, code review, and keeping the *surface* small (fat C++ core, thin API).

The senior framing: you accept C++'s sharp edges *only* for the layer that needs them, and you wrap it in tooling (sanitizers, tests, CMake, bindings) that contains the risk. That containment strategy is why the two-language split exists.

### Q10. "C++ has no garbage collector" — why is that an advantage here rather than a burden?

Because in trading and risk, **when** memory is freed matters as much as **that** it's freed. A garbage collector reclaims memory on its own schedule, which introduces two problems: unpredictable **pause times** (a collection can stall the process at a latency-critical moment) and non-deterministic destruction (you don't know exactly when a resource is released).

C++'s alternative is **RAII**: destruction happens deterministically when an object leaves scope. You know precisely when a buffer is freed, a lock released, a file closed — no pauses, no jitter, no tuning a GC's generational parameters to dodge stalls.

The "burden" — you manage lifetimes yourself — is largely neutralised by modern C++: `unique_ptr`, containers, and the rule of zero mean you rarely write manual `delete`. So you get manual-management *control* with mostly automatic-management *ergonomics*, minus GC pauses. For a latency-sensitive numeric core that's a clear win. This directly sets up the RAII topic.

### Q11. A researcher hands you working but slow Python that prices a barrier option path-by-path. How do you productionise it?

A staged, low-risk approach:

1. **Reproduce and pin a reference.** Run the Python, capture golden prices/Greeks for several cases — these become your regression tests (tolerance-based, not exact).
2. **Port the hot inner loop to C++**, keeping the same algorithm first (no cleverness yet): a path generator + payoff + accumulator, templated so it inlines.
3. **Expose it via pybind11** with a coarse interface — one call prices N paths and returns price + standard error. Release the GIL around the compute so Python threads aren't blocked.
4. **Validate** against the golden values within tolerance; add a put-call-parity / analytic-limit property test.
5. **Then optimise** — per-thread RNG for parallelism, SoA layout, variance reduction (antithetics) — re-checking golden values after each change.

The discipline: **correctness parity before speed**, separate the port from the optimisation, and keep the boundary coarse. This is the two-language pattern and the "make it right, then fast" rule in action — themes that recur throughout the primer.

### Q12. How is a C++ analytics library typically built and consumed? (build/deploy shape)

**Build:** **CMake** is the near-universal build system — it defines library targets, finds dependencies (`find_package` for Eigen/Boost, or `FetchContent`), and produces both the C++ static/shared library and the Python extension module. Compilation flags like `-O2`/`-O3 -march=native` are set per build type; `-ffast-math` is generally *avoided* because it breaks IEEE NaN/associativity guarantees that risk numbers depend on.

**Test/verify:** unit tests with tolerance-based comparisons and golden values, plus **sanitizer builds** (ASan/UBSan/TSan) in CI, and microbenchmarks (Google Benchmark).

**Consume:** the same core is linked into risk/pricing **services** (C++) *and* wrapped as a **Python module** (pybind11) for research — one codebase, two consumers. Distribution is typically an internal package/artifact with pinned compiler and dependency versions for reproducibility.

The takeaway: the library is built once, verified hard, and consumed from both C++ and Python — reinforcing why the core must be clean and its API small.

### Q13. Where does C++ lose to Python, and why fighting that costs you?

C++ loses badly wherever **iteration speed and ecosystem** dominate over runtime speed:

- **Exploratory research** — trying twenty model variants in an afternoon. Python's REPL/notebooks win; a C++ recompile loop kills momentum.
- **Data wrangling and IO glue** — pulling market data, reshaping, plotting. pandas/matplotlib have no C++ peer worth the effort.
- **Orchestration** — scheduling jobs, config, reporting. Interpreter overhead is irrelevant when the work is IO-bound.

Forcing these into C++ costs you developer time, introduces bugs in code that didn't need to be fast, and slows the research cadence that generates alpha. The mature stance is *humility about the boundary*: put only the compute-and-latency-critical inner core in C++, and let Python own the rest. A candidate who wants to write everything in C++ signals poor judgement about where the language pays off.

### Q14. Give a concrete example where microsecond latency (not just throughput) forces C++.

**Execution / market-making.** A market-making engine consumes a market-data feed, updates its view of the book, and decides whether to quote or hedge — reacting in single-digit microseconds. Here **tail latency** is the metric: a slow response means you're picked off (adverse selection) or miss the fill. Throughput ("prices per second averaged over a minute") is irrelevant if the 99.9th-percentile response spikes.

C++ is forced because you need:
- **No GC pauses** — a managed runtime's collection at the wrong moment is a losing trade.
- **Deterministic, inlinable hot paths** — no virtual dispatch, no allocation, cache-resident data (SoA), possibly SIMD.
- **Direct control** — `[[likely]]` hints, memory layout, lock-free structures.

Contrast with an **overnight risk batch**, where total throughput matters and a Python-orchestrated C++ core is fine. The distinction — *latency-critical* vs *throughput-critical* — is exactly where C++ becomes non-negotiable versus merely convenient. See the Low-Latency topic for the mechanics.

### Q15. What's the relationship between this primer and a general C++ language primer — what should you already know?

This primer assumes you can already write and read basic modern C++: loops, functions, classes, references, templates syntax, the STL containers, and the general shape of the language. That material lives in a separate **C++ language primer**; repeating it here would waste your prep time.

What *this* primer adds is the **application layer**: how those features serve numerical finance. So when move semantics appears, the framing is "moving a million-path matrix in O(1) instead of copying it," not "here's what an rvalue reference is." When templates appear, it's "CRTP to remove virtual dispatch from the pricing hot path" and "expression templates so `a = b + c + d` fuses into one loop," not "how to declare a template parameter."

Practically: brush up basic syntax elsewhere; here, focus on *why* a construct is the right tool for a pricing library, Monte Carlo engine, or low-latency path — and be ready to write real, correct C++ that a quant desk would accept.

### Q16. If you had to justify a new C++ component to a manager who prefers "just use Python," what's your case?

Frame it around the **specific requirement**, not language loyalty:

1. **State the constraint numerically** — e.g. "this risk revaluation must finish in 5 minutes for a 2-million-position book; the Python prototype takes 4 hours." Or "this quoting path needs sub-10-microsecond, jitter-free response."
2. **Show why Python can't meet it** — interpreter overhead in branchy inner loops, GIL-throttled threading, GC/allocator jitter, no cache-layout control.
3. **Scope it tightly** — you're proposing C++ only for the hot inner core, wrapped in a pybind11 API so the team keeps working in Python everywhere else. This limits the C++ surface (and the maintenance cost that worries the manager).
4. **Name the containment** — sanitizers in CI, golden-value tests, CMake build; the sharp edges are managed.

The persuasive move is **agreeing with the default** (Python for most things) and carving out the narrow slice where it provably fails. That's the same judgement the two-language pattern encodes — and it's what separates an engineer from a language partisan.

## Numerical Types & Floating-Point Precision

### Summary

**What this topic covers**

How real numbers are actually represented and manipulated in a C++ pricing library — and the precision traps that produce wrong risk numbers. This is the topic that separates people who *use* `double` from people who *understand* it. Four concern areas: (1) the **types** — `float` (32-bit), `double` (64-bit, the pricing default), and `long double`, and when each is appropriate; (2) **IEEE-754 mechanics** — the sign/exponent/mantissa layout, rounding, and why `0.1` is not exactly representable; (3) **comparison and cancellation** — why `==` on doubles is a bug, how to compare with absolute+relative epsilon or ULPs, and **catastrophic cancellation** that quietly wrecks finite-difference Greeks; and (4) **special values and money** — NaN/inf propagation, why **money must never be a `double`**, and the danger of `-ffast-math`. The 16 questions move from "float vs double for prices" to spotting cancellation in a Greeks calculation and choosing a money representation. This underpins every numeric topic that follows.

**Mental model**

A `double` is not a real number — it's a **60-ish-bit-precise approximation** drawn from a finite, unevenly-spaced grid. Near 1.0 the grid spacing (one ULP) is about 2.2e-16; near 1e9 it's about 1e-7; near 1e300 the gaps are enormous. Every operation lands on the nearest grid point and rounds, injecting a tiny relative error (~1e-16 for `double`). Most of the time these errors are negligible and independent, so they don't accumulate meaningfully. The danger is when structure conspires: **subtracting two near-equal numbers** cancels the leading digits and promotes rounding noise into the leading digits of the result (catastrophic cancellation) — exactly what a finite-difference Greek does. So the mental model is: think in **relative error and ULPs**, assume every `double` carries ~1e-16 relative noise, and be paranoid wherever you subtract close quantities or compare for equality. Money is different in kind: it needs *exact* decimal values, which binary floating point cannot provide — so money uses integers or a decimal type, never `double`.

**Key terms**

- **`float` / `double` / `long double`** — 32-bit (~7 decimal digits), 64-bit (~15–16 digits, the pricing default), and extended (80-bit on x86, ~18–19 digits) IEEE types.
- **IEEE-754** — the standard defining bit layout, rounding, and special values for binary floating point.
- **Mantissa / significand** — the fractional precision bits (52 for `double`, giving 53 effective with the implicit leading 1).
- **Exponent** — sets the magnitude/scale; determines where on the number line the grid sits.
- **ULP (unit in the last place)** — the gap between adjacent representable doubles at a given magnitude; the natural unit of floating error.
- **Machine epsilon** — ~2.22e-16 for `double`; the relative spacing near 1.0 (`std::numeric_limits<double>::epsilon()`).
- **Rounding error** — the ~1e-16 relative error each operation introduces by snapping to the nearest representable value.
- **Catastrophic cancellation** — loss of significant digits when subtracting near-equal numbers; rounding noise becomes the answer.
- **NaN / inf** — special values for undefined (0/0, sqrt(-1)) and overflow (1/0); propagate through arithmetic.
- **Denormal / subnormal** — tiny values below the normal range; represented with reduced precision, often very slow.
- **`-ffast-math`** — compiler flag that relaxes IEEE rules (assumes no NaN/inf, allows reassociation) for speed — dangerous in finance.

**Why interviewers ask this**

Floating point is where a plausible-looking pricer silently returns wrong risk. Interviewers want to see that you *distrust* `==`, that you can explain *why* `0.1 + 0.2 != 0.3`, and that you recognise catastrophic cancellation before it corrupts a Greek. A junior says "use double, it's precise enough"; a senior reaches for a relative-epsilon comparison unprompted, knows money can't be a double, and can rewrite a cancelling expression (e.g. via `log1p`/`expm1` or algebraic reformulation). It's also a proxy for numerical maturity generally: if you understand ULPs and cancellation, you'll write stable Monte Carlo accumulators and finite-difference schemes. Getting the money question right — integer minor units, not `double` — is a hard filter; a candidate who'd store a cash amount in a `double` fails a basic correctness bar.

**Common confusions**

- "`double` is exact for reasonable numbers" — no; `0.1`, `0.2`, most decimals are inexact in binary. Only dyadic rationals are exact.
- "Use a tiny fixed epsilon like 1e-9 for all comparisons" — wrong at scale; absolute epsilon fails for large or tiny magnitudes. Use a *relative* (or combined) tolerance.
- "More precision fixes cancellation" — `long double` delays it but doesn't cure it; cancellation is about the *operation*, so reformulate the maths.
- "NaN == NaN is true" — it's **false**; that's how `std::isnan` works and why a stray NaN can silently fail comparisons.
- "Money in a double is fine if I round at the end" — errors compound *before* the rounding; use integer cents or a decimal type.
- "`-ffast-math` is a free speedup" — it can change results, break NaN handling, and reorder sums; unacceptable where numbers must reproduce.

**What follows from this topic**

This is the substrate for all later numeric work. Epsilon comparison recurs in every test (tolerances, not exact equality — see Build/Test). Catastrophic cancellation drives the Greeks discussion: it's a core argument for **AAD over bump-and-revalue**. Numerical stability tricks (`std::fma`, `log1p`, reordering) reappear in the Monte Carlo accumulator and the root-finding/implied-vol solver. NaN/inf handling connects to error-handling and `noexcept`. And the money-representation rule is a standing correctness constraint whenever cash flows appear.

### Q1. float vs double vs long double — which do you use for prices, and why?

**Use `double` for prices and almost all pricing maths.** Rationale:

| Type | Bits | Precision (~decimal digits) | Use in quant code |
|---|---|---|---|
| `float` | 32 | ~7 | Rarely for values; sometimes bulk storage/GPU/SIMD to save bandwidth |
| `double` | 64 | ~15–16 | **The default** — prices, rates, vols, PDE grids, MC accumulators |
| `long double` | 80 (x86) | ~18–19 | Occasional extra headroom in a sensitive reduction; not portable |

`float`'s ~7 digits is dangerous: with a price near 100, a `float` resolves to about 1e-5 — coarser than a basis point, and errors accumulate over a Monte Carlo sum of millions of paths. `double`'s ~1e-16 relative precision gives comfortable headroom.

`long double` is **80-bit only on x86** (64-bit on ARM/MSVC it's just `double`), so relying on it hurts portability and reproducibility. Reach for it only for a specific ill-conditioned accumulation, and prefer algorithmic fixes (Kahan summation, reformulation) first.

`float` earns its place for *memory bandwidth* — storing a huge path array or feeding SIMD/GPU — where you trade precision for throughput deliberately, not by accident.

### Q2. Explain the IEEE-754 layout of a double and why 0.1 can't be represented exactly.

A `double` is 64 bits: **1 sign + 11 exponent + 52 mantissa**. The value is

```
value = (-1)^sign * 1.mantissa * 2^(exponent - 1023)
```

The `1.mantissa` (the implicit leading 1 plus 52 fraction bits) is a **binary** fraction. So a `double` can only exactly represent numbers of the form (integer) * 2^k — dyadic rationals.

`0.1` in binary is `0.0001100110011...` repeating forever, like `1/3` in decimal. With only 52 mantissa bits it must be **rounded** to the nearest representable value, which is slightly more than 0.1. Same for 0.2. So:

```cpp
0.1 + 0.2 == 0.3;                 // false
printf("%.17f\n", 0.1 + 0.2);     // 0.30000000000000004
```

The two rounded inputs sum to a value one ULP above the rounded 0.3. This is *not* a bug in your compiler — it's the fundamental limit of binary floating point. The lesson: never assume decimal fractions are exact, never `==` them, and never store money as a double (Q11).

### Q3. Why is comparing two doubles with == a bug, and what should you do instead?

`==` demands the two values land on the *exact same* grid point. But rounding means mathematically-equal computations often differ by an ULP or two (`0.1 + 0.2 != 0.3`). So `==` gives false negatives that look like logic bugs.

Compare with a **tolerance**, and use a *combined* absolute+relative one:

```cpp
#include <cmath>
#include <algorithm>

bool nearly_equal(double a, double b,
                  double rel = 1e-9, double abs_tol = 1e-12) {
    double diff = std::fabs(a - b);
    if (diff <= abs_tol) return true;              // handles near-zero
    return diff <= rel * std::max(std::fabs(a), std::fabs(b));
}
```

- The **absolute** term (`abs_tol`) handles values near zero, where a relative tolerance collapses to nothing.
- The **relative** term scales with magnitude — essential because ULP size grows with the numbers.

A single fixed epsilon (say `1e-9`) is wrong at scale: too loose for tiny numbers, too tight for large prices. For tighter control you can compare in **ULPs** (Q4). Choose the tolerance from the *problem's* accuracy, not a magic constant.

### Q4. What is a ULP, and how would you compare doubles by ULP distance?

A **ULP** (unit in the last place) is the gap between one representable double and the next at a given magnitude. Near 1.0 it's ~2.2e-16; near 1e6 it's ~1.2e-10; the gap scales with the exponent. "Within N ULPs" means "at most N representable values apart" — a scale-invariant notion of closeness.

Because IEEE doubles are ordered the same way as their bit patterns (for a fixed sign), you can measure ULP distance by reinterpreting the bits as integers:

```cpp
#include <cstdint>
#include <cstring>
#include <cmath>

int64_t ulp_distance(double a, double b) {
    if (a == b) return 0;
    int64_t ia, ib;
    std::memcpy(&ia, &a, sizeof(a));   // bit-cast, no aliasing UB
    std::memcpy(&ib, &b, sizeof(b));
    if ((ia < 0) != (ib < 0)) return INT64_MAX; // opposite signs
    return std::llabs(ia - ib);
}
// usage: within 4 ULPs?
bool close = ulp_distance(x, y) <= 4;
```

ULP comparison is the sharpest tool when you know your algorithm should be accurate to a few last bits (e.g. validating a special-function implementation). For general pricing tolerances, the relative-epsilon of Q3 is usually more practical and easier to reason about.

### Q5. What is catastrophic cancellation, and why does it bite finite-difference Greeks?

**Catastrophic cancellation** is the loss of significant digits when you subtract two nearly-equal numbers. Each operand carries ~1e-16 *relative* rounding noise. When you subtract them, the large equal leading digits cancel, leaving a small result — but the *absolute* noise doesn't shrink, so it now dominates the surviving digits.

Finite-difference Greeks are exactly this pattern. A delta via bump-and-revalue:

```cpp
double delta = (price(S + h) - price(S - h)) / (2 * h);
```

`price(S+h)` and `price(S-h)` are almost equal (bump `h` is small), so the numerator cancels. Worse, you then **divide by a small `h`**, amplifying the noise. Too-large `h` gives truncation (bias) error; too-small `h` gives cancellation (noise) error — the classic U-shaped total error, with an optimal `h` around `sqrt(machine_eps)*S` for a first derivative.

Second-order Greeks (gamma) subtract *three* close values and divide by `h^2`, doubling the pain. This precision floor is a central argument for **AAD** over bumping (see the Greeks topic): AAD computes derivatives analytically through the code, sidestepping the subtraction entirely.

### Q6. Rewrite an expression to avoid cancellation. Give a concrete example.

The fix is almost always **algebraic reformulation**, not more precision. Classic case: the quadratic formula root `(-b + sqrt(b*b - 4*a*c)) / (2*a)` cancels when `b > 0` and `sqrt(...) ~ b`.

```cpp
// Naive: cancels for one root when b*b >> 4ac
double r1 = (-b + std::sqrt(b*b - 4*a*c)) / (2*a);

// Stable: compute the well-conditioned root, then use r1*r2 = c/a
double disc = std::sqrt(b*b - 4*a*c);
double q = -0.5 * (b + std::copysign(disc, b)); // no cancellation
double root1 = q / a;
double root2 = c / q;
```

Finance-flavoured examples:
- `log(1 + x)` for small `x` → use **`std::log1p(x)`** (avoids `1 + x` losing `x`'s low bits). Shows up in log-returns of tiny moves.
- `exp(x) - 1` for small `x` → use **`std::expm1(x)`**. Shows up discounting over short tenors.
- `1 - N(d)` in the tail → use the complementary form `N(-d)` rather than subtracting from 1.

The principle: identify where two close quantities are subtracted, and restructure so the small result is computed *directly* rather than as a difference of large ones.

### Q7. What are NaN and inf, how do they propagate, and how do you detect them?

- **inf** — overflow or division by a nonzero (`1.0/0.0`, `exp(1000)`); a signed infinity.
- **NaN (not-a-number)** — an *undefined* result: `0.0/0.0`, `sqrt(-1.0)`, `log(-1.0)`, `inf - inf`.

Both **propagate**: any arithmetic touching a NaN yields NaN, and inf arithmetic follows extended rules (`inf + 1 = inf`, `1/inf = 0`). A single stray NaN early in a Monte Carlo path can silently poison the final average.

The trap: **NaN compares false to everything, including itself.**

```cpp
double x = std::sqrt(-1.0);
x == x;              // false! this is the standard NaN test
std::isnan(x);       // true  — use this
std::isinf(y);       // for infinities
std::isfinite(z);    // true only if not NaN and not inf
```

Because `NaN < K` and `NaN > K` are both false, a naive `if (price < barrier)` silently takes the wrong branch when `price` is NaN — no exception, just wrong logic. So **validate inputs** (reject `T <= 0`, negative vol, `S <= 0`) at the library boundary and consider a debug-time `assert(std::isfinite(result))` on outputs to fail fast rather than propagate garbage into risk.

### Q8. Why must money not be stored as a double?

Because binary floating point **cannot represent most decimal cash amounts exactly**, and the errors compound. `0.10` isn't representable (Q2); accumulate thousands of such amounts and the drift becomes visible cents — unacceptable for accounting, settlement, or anything that must reconcile to the penny.

```cpp
double total = 0.0;
for (int i = 0; i < 10; ++i) total += 0.1;
total == 1.0;   // false — total is 0.9999999999999999
```

Use one of:

| Representation | How | Notes |
|---|---|---|
| **Integer minor units** | store cents/pips as `int64_t` | Exact, fast; you manage scale and rounding explicitly. The common choice. |
| **Fixed-point / decimal type** | `boost::multiprecision`, a `Decimal` class, or DB `DECIMAL` | Exact decimal arithmetic; clearer semantics, some overhead. |

```cpp
int64_t cents = 1050;             // $10.50, exact
int64_t total_cents = 0;
for (int i = 0; i < 10; ++i) total_cents += 10;  // exactly 100 = $1.00
```

The nuance: **model quantities** (a price, a rate, a vol, an NPV used for risk) legitimately live in `double` — they're approximate by nature. **Ledger quantities** (actual cash to be paid, positions to be reconciled) must be exact. Confusing the two — storing a settleable cash amount in a `double` — is a classic correctness failure interviewers probe for.

### Q9. What does -ffast-math do and why is it dangerous in a pricing library?

`-ffast-math` (and its pieces like `-funsafe-math-optimizations`, `-fno-signed-zeros`, `-freciprocal-math`) tells the compiler to **relax IEEE-754 guarantees** for speed. Specifically it may:

- **Assume no NaN/inf exist** — so your `std::isnan` checks can be optimised away, breaking input validation and error detection.
- **Reassociate floating-point sums** — `(a + b) + c` → `a + (b + c)`, which changes results because FP addition isn't associative. This breaks **bit-reproducibility** of risk numbers.
- **Use reciprocals and fused forms** freely, and flush denormals to zero.

In finance this is dangerous because:
- Regulated risk must **reproduce exactly** across runs/machines; reassociation destroys that.
- NaN/inf handling is a real correctness mechanism; assuming they can't occur turns a detectable error into silent garbage.

So the default is **don't use `-ffast-math`** on pricing code. If you need parts of its speed, enable *specific*, safe sub-flags on *specific* hot kernels you've proven tolerate it, never blanket across the library. Prefer explicit `std::fma` and reassociation *you* control over letting the compiler reorder your carefully-ordered sums.

### Q10. How would you sum a large vector of P&L values with minimal error?

Naive left-to-right summation accumulates ~O(N) * epsilon relative error, and worse when large and small magnitudes mix (small terms get lost against a big running total). Options, roughly in order of effort:

1. **Kahan (compensated) summation** — track a running correction term:

```cpp
double kahan_sum(const std::vector<double>& x) {
    double sum = 0.0, c = 0.0;   // c = lost low-order bits
    for (double v : x) {
        double y = v - c;
        double t = sum + y;
        c = (t - sum) - y;       // recovers what rounding dropped
        sum = t;
    }
    return sum;
}
```

Kahan gives roughly O(1) error regardless of N, at ~4x the arithmetic (usually negligible vs memory-bound cost).

2. **Pairwise / tree summation** — recursively sum halves; O(log N) error growth, and it vectorises well. `std::reduce` (C++17) is allowed to do this since it doesn't promise left-to-right order (unlike `std::accumulate`).

3. **Sort by magnitude** (ascending) before summing — cheap improvement when magnitudes vary wildly, but O(N log N).

For a Monte Carlo mean you also want the running **variance/standard error**, so use a numerically-stable online algorithm (Welford's) rather than the cancellation-prone `E[x^2] - E[x]^2`. See the Monte Carlo topic's accumulator.

### Q11. What does this print, and is it well-defined? `std::cout << (0.1 + 0.2 == 0.3);`

It prints **`0`** (false), and yes it is **well-defined** — this is deterministic IEEE-754 behaviour, not undefined behaviour.

Why: `0.1`, `0.2`, and `0.3` are each rounded to the nearest `double` at parse time. The stored `0.1` and `0.2` are each slightly *above* the true value; their sum rounds to a value one ULP above the stored `0.3`. So the equality is false:

```cpp
printf("%.17f\n", 0.1 + 0.2);  // 0.30000000000000004
printf("%.17f\n", 0.3);        // 0.29999999999999999
```

The output is portable across conforming IEEE-754 platforms with default rounding — every mainstream desktop/server compiler. (It could differ only under exotic rounding modes or `-ffast-math` reassociation, which is one more reason to avoid the latter.)

Interviewers use this to check two things: that you know decimal literals aren't exact in binary, and that you distinguish **surprising-but-defined** from **undefined behaviour**. The fix is never to compare floats with `==` — use `nearly_equal` (Q3).

### Q12. When is float (32-bit) the right choice in quant code, despite its low precision?

When you're **memory-bandwidth or throughput bound and can tolerate ~7 digits**, deliberately trading precision for speed:

- **Large path/scenario storage** — a Monte Carlo engine holding tens of millions of simulated values. `float` halves memory footprint and cache pressure, so more data fits in cache and SIMD processes twice as many lanes per instruction.
- **GPU / SIMD kernels** — GPUs are far faster in `float`; wide vector units (AVX) do 2x the `float` lanes. For bulk, well-conditioned operations (e.g. applying a payoff across many paths) the extra throughput can dominate.
- **ML/feature pipelines** feeding a model that's insensitive to the last digits.

The discipline:
- Keep **accumulation in `double`** even if storage is `float` — sum a huge number of `float`s in `double` to avoid catastrophic precision loss (a `float` sum saturates its precision after ~1e7 additions).
- Never use `float` for anything **ill-conditioned** (finite-difference Greeks, cancellation-prone maths) — 7 digits leaves no headroom.
- Never for money.

So `float` is a *targeted performance tool for bulk, well-conditioned data*, not a default. The default remains `double`.

### Q13. Spot the precision bug: a loop that steps a PDE grid with `for (double t = 0; t != T; t += dt)`.

The bug is `t != T` as the loop condition. `dt` (e.g. `T/N`) generally isn't exactly representable, so after `N` additions the accumulated `t` will *not* land exactly on `T` — it'll be a fraction of a ULP off. So `t != T` may **never become false**, giving an infinite loop or one extra/one fewer step, corrupting the terminal condition of the PDE.

```cpp
// BROKEN
for (double t = 0.0; t != T; t += dt) { step(); }

// Also risky: t < T can give N or N+/-1 iterations depending on rounding
for (double t = 0.0; t < T; t += dt) { step(); }
```

Fix: **iterate with an integer count**, and derive `t` from it (or accept the running `t` only for the physics, not the loop control):

```cpp
int N = 100;
double dt = T / N;
for (int i = 0; i < N; ++i) {
    double t = i * dt;   // recompute, don't accumulate — avoids drift
    step(t, dt);
}
```

Two wins: the loop runs *exactly* `N` times, and computing `t = i * dt` fresh each step avoids the **accumulated rounding drift** of `t += dt` (which grows over many steps). This "count with ints, derive the float" rule applies to any time-stepping scheme — trees, Euler MC, finite differences.

### Q14. How do rounding modes work, and when would you touch them?

IEEE-754 defines four rounding modes; the default is **round-to-nearest, ties-to-even** ("banker's rounding"), which minimises bias over many operations. The others are round-toward-zero, round-up (+inf), and round-down (-inf).

You almost never change the mode in normal pricing — but two situations matter:

- **Interval arithmetic / rigorous error bounds.** Compute a lower bound with round-down and an upper bound with round-up to *guarantee* the true value is bracketed. Used in verified numerics, rarely in day-to-day pricing.
- **Debugging non-reproducibility.** If results differ across machines, a changed rounding mode (or `-ffast-math`) is a suspect.

```cpp
#include <cfenv>
std::fesetround(FE_DOWNWARD);   // then compute a lower bound
// ... revert with FE_TONEAREST
```

Caveats: changing the mode is process-global and can be **slow** and interacts badly with compiler optimisations that assume the default (you need `#pragma STDC FENV_ACCESS ON` for correctness). So the practical stance is: **leave it at round-to-nearest**, know the ties-to-even rule exists (it's why `round()` and cast-truncation differ), and treat mode changes as a specialist tool. Ties-to-even is also why you can't assume `0.5` rounds "up" — `2.5` rounds to `2`.

### Q15. Your Greek is noisy at small bump sizes. Walk through diagnosing and fixing it.

The symptom — noise that *worsens* as the bump `h` shrinks — is the fingerprint of **catastrophic cancellation** in `(price(S+h) - price(S-h)) / (2h)` (Q5).

Diagnosis:
1. Confirm the U-shape: sweep `h` and plot error. Large `h` → biased (truncation); tiny `h` → noisy (cancellation). If error bottoms out then rises as `h` falls, it's cancellation, not a coding bug.
2. Estimate the optimum: for a central first difference, error is minimised around `h ~ (machine_eps)^(1/3) * S ~ 1e-5 * S` (for `double`), giving ~10-11 good digits at best.

Fixes, in order of quality:
- **Tune `h`** to the optimum and use central (not forward) differences — cheap, buys a few digits.
- **Reformulate** so the difference is computed analytically where possible (e.g. Black-Scholes has closed-form delta = `N(d1)` — don't bump it at all).
- **Use AAD (adjoint automatic differentiation)** — computes exact derivatives through the code with no subtraction, so no cancellation, and gets *all* Greeks in a small constant multiple of one pricing. This is the real fix for a large exotic book and the reason AAD displaced bumping on modern risk systems (see the Greeks topic).
- For Monte Carlo, use **pathwise / likelihood-ratio** derivative estimators or **common random numbers** across the bumps to cancel the sampling noise.

The senior answer names cancellation as root cause and reaches for AAD or an analytic form rather than just fiddling with `h`.

### Q16. How do you test numerical code given you can't use exact equality?

Exact equality is meaningless for floating-point results, so numerical tests are built on **tolerances and invariants**:

1. **Tolerance-based comparison** — assert `nearly_equal(result, expected, rel, abs)` (Q3), with the tolerance chosen from the method's expected accuracy (e.g. 1e-10 for an analytic formula, looser for a Monte Carlo estimate).

2. **Golden / reference values** — pin outputs from a trusted source (a textbook value, QuantLib, or a slower high-precision implementation) and regression-test against them within tolerance.

3. **Property / invariant tests** — check relationships that must hold regardless of the exact number:
   - **Put-call parity**: `C - P == S - K*exp(-r*T)` (within tolerance).
   - Monotonicity: a call price increases in spot; vega is positive.
   - Limits: as vol → 0, the option → its intrinsic value.

4. **Convergence tests** — for Monte Carlo, check the error shrinks like ~1/sqrt(N) and lies within a few standard errors of the analytic value; for a PDE, that halving the step reduces error at the expected order.

5. **Edge cases** — `T` near 0, deep in/out of the money, zero vol, ensuring no NaN/inf escapes.

The mindset: you test **behaviour and relationships**, not bit patterns — and you make tolerances explicit and justified, never a magic `1e-9`. This connects directly to the Build/Test/Profile topic.

## Value Semantics, RAII & Resource Management

### Summary

**What this topic covers**

How C++ manages the lifetime of resources — memory, locks, files, handles — and why that mechanism (RAII) delivers *both* correctness and performance for a pricing/trading system. Four concern areas: (1) **RAII** — tying resource lifetime to object lifetime so cleanup is automatic and **deterministic** (no GC pauses, which matters for latency); (2) **value semantics** — the C++ default of copying values rather than sharing references, and when to prefer values vs references; (3) the **rules of 0/3/5** — how to decide which special member functions (destructor, copy, move) a class needs, with the **rule of zero** as the goal; and (4) **ownership with smart pointers** — `unique_ptr` (owning, zero-overhead) vs `shared_ptr` (atomic reference count, avoid on the hot path) vs `weak_ptr` (non-owning observers), and why raw `new`/`delete` is banned in modern code. The 16 questions run from "what is RAII" and "why no `new`/`delete`" up to spotting lifetime bugs and choosing an ownership model for a pricing-engine object graph. RAII is the foundation the whole language's safety and performance story rests on.

**Mental model**

The core idea: **a resource's lifetime = an object's lifetime.** You acquire the resource in a constructor and release it in the destructor; the compiler then guarantees the destructor runs when the object leaves scope — on normal return, on `break`, and crucially on an **exception** (stack unwinding). You never write cleanup code at call sites; you can't forget it. Because destruction happens at a **statically-known point** (scope exit), it's *deterministic* — unlike a garbage collector that frees "sometime later." That determinism is why a trading system can trust that a lock is released or a buffer freed at a precise instant, with no pause. The second pillar is **value semantics**: by default a C++ object *is* its value (like an `int`), copies are independent, and there's no hidden sharing or null. You reach for references/pointers only when you deliberately want sharing or indirection. Put together: prefer owning values and RAII types, express ownership explicitly with smart pointers, and let scope drive cleanup. Correctness (no leaks, exception-safe) and performance (no GC, stack allocation, deterministic) come from the *same* mechanism.

**Key terms**

- **RAII (Resource Acquisition Is Initialization)** — bind a resource to an object; acquire in ctor, release in dtor; scope drives cleanup.
- **Deterministic destruction** — objects are destroyed at a known point (scope exit / delete), not at a GC's discretion.
- **Value semantics** — variables hold values; assignment/passing copies the value; no implicit sharing (contrast reference semantics).
- **Special member functions** — destructor, copy ctor, copy assign, move ctor, move assign; the compiler may generate them.
- **Rule of zero** — design classes so you write *none* of them; let members (containers, smart pointers) manage resources. The goal.
- **Rule of three** — if you write one of dtor/copy-ctor/copy-assign, you likely need all three (pre-C++11 resource classes).
- **Rule of five** — the rule of three plus move-ctor/move-assign in modern C++.
- **`unique_ptr<T>`** — sole owner; move-only; zero runtime overhead over a raw pointer; the default owning pointer.
- **`shared_ptr<T>`** — shared ownership via an **atomic** reference count; heavier; use only when ownership is genuinely shared.
- **`weak_ptr<T>`** — non-owning observer of a `shared_ptr`; breaks reference cycles; `lock()` to access safely.
- **Stack unwinding** — on an exception, destructors of in-scope objects run automatically; the basis of exception safety.
- **Dangling reference** — a reference/pointer to an object that has been destroyed; use is undefined behaviour.

**Why interviewers ask this**

RAII and ownership are *the* dividing line between someone who writes C++ and someone who writes safe, fast C++. Interviewers want to see you reach for `unique_ptr` and rule-of-zero by default, explain *why* deterministic destruction matters for latency (no GC pauses), and never propose raw `new`/`delete`. A junior manages memory manually and leaks under exceptions; a senior makes leaks *structurally impossible* via scope. They'll also probe ownership judgement: can you justify `unique_ptr` over `shared_ptr` (avoid atomic refcount churn on the hot path), spot a `shared_ptr` cycle, or catch a dangling reference from a lambda capturing a local? Getting this right signals you can build a large object graph — instruments, engines, market data — that's both correct under exceptions and cheap at runtime.

**Common confusions**

- "RAII is just about memory" — it's about *any* resource: locks (`lock_guard`), files, sockets, DB handles, timers. Memory is one case.
- "Smart pointers are slow" — `unique_ptr` has **zero** overhead over a raw pointer; only `shared_ptr`'s atomic refcount costs, and only when copied.
- "Use `shared_ptr` everywhere to be safe" — over-sharing causes atomic contention, unclear ownership, and cycles/leaks. Default to `unique_ptr`.
- "The rule of five means always write five functions" — the opposite: the rule of *zero* means write none; the five only appear when you truly own a raw resource.
- "`std::move` moves something" — it's just a cast to rvalue; the move happens (if at all) in the move ctor/assign it enables.
- "References are always cheaper than values" — for small types or when you need independence, a value is better (no aliasing, no lifetime worry, cache-local).

**What follows from this topic**

RAII underpins exception safety (error-handling topic) and the move-semantics topic (move ctors are how RAII types transfer ownership cheaply — moving a million-path buffer in O(1)). Ownership design drives the OO-for-pricing topic (who owns the payoff, the engine, the market data). Deterministic destruction is a pillar of the low-latency topic (no GC, `lock_guard` scope, avoiding allocation on the hot path). And the rule of zero connects to STL usage — leaning on `vector`/`unique_ptr` so you rarely hand-manage anything. Master RAII and most memory bugs simply can't occur.

### Q1. What is RAII and why does it matter in a trading/pricing system?

**RAII (Resource Acquisition Is Initialization)** ties a resource's lifetime to an object's lifetime: acquire the resource in the constructor, release it in the destructor. The compiler guarantees the destructor runs when the object leaves scope — including during **stack unwinding on an exception** — so cleanup is automatic and unmissable.

```cpp
{
    std::lock_guard<std::mutex> guard(book_mutex);  // acquires lock
    update_order_book();                            // may throw
}   // guard's destructor releases the lock — always, even on exception
```

Why it matters specifically in trading/pricing:

- **Deterministic destruction — no GC pauses.** The lock is released, the buffer freed, the file closed at a *precise, known* instant (scope exit), not "sometime later" at a garbage collector's discretion. For a latency-sensitive system, an unpredictable GC pause at the wrong microsecond is unacceptable; RAII gives predictable timing.
- **Exception safety for free.** A pricing routine that throws mid-way still releases every resource it acquired — no leaked locks that deadlock the desk, no leaked memory.
- **No cleanup code at call sites** — you can't forget to release.

RAII is why C++ can offer manual-management *control* with automatic-management *reliability*, minus the GC. It's the single most important idiom in the language.

### Q2. Contrast value semantics with reference semantics. When do you want each?

**Value semantics:** a variable *is* its value; copying produces an independent object. This is the C++ default and how `int`, `std::string`, `std::vector` behave.

```cpp
std::vector<double> a = {1, 2, 3};
std::vector<double> b = a;   // b is an independent copy
b[0] = 99;                   // a is unchanged
```

**Reference semantics:** a variable *refers* to a shared object; "copying" the handle aliases the same underlying object (how Java/Python objects, and C++ `shared_ptr`, behave).

Prefer **value semantics** when you can:
- No aliasing surprises — nobody else can mutate your data behind your back; easier to reason about and thread-safe by construction if immutable.
- No lifetime worries — the value owns itself; no dangling.
- Cache-friendly — values can live on the stack or contiguously.

Reach for **references/pointers** when:
- The object is **genuinely shared** (one market-data curve observed by many instruments → `shared_ptr`).
- It's **large and you're only reading** it (pass `const T&` to avoid a copy).
- You need **polymorphism** (a base-class reference/pointer to a derived object).

The modern default: pass small things by value, big read-only things by `const&`, express real sharing explicitly with smart pointers. Value semantics first, indirection when justified.

### Q3. Explain the rule of zero, three, and five. Which should you aim for?

The **special member functions** are: destructor, copy constructor, copy assignment, move constructor, move assignment.

- **Rule of three (pre-C++11):** if you write any of destructor / copy-ctor / copy-assign, you almost certainly need all three, because it means you're managing a raw resource and the compiler's defaults will get copying/cleanup wrong (double-free or leak).
- **Rule of five (C++11+):** the same, extended to also provide the **move** ctor and move assign, so your resource-owning type transfers cheaply instead of copying.
- **Rule of zero (the goal):** design so you write **none** of them. Let your members — `std::vector`, `std::unique_ptr`, `std::string` — own the resources; the compiler-generated defaults then do the right thing (copy/move/destroy each member correctly).

```cpp
// Rule of zero — nothing to write, everything correct
struct YieldCurve {
    std::vector<double> tenors;   // members manage themselves
    std::vector<double> rates;
    std::unique_ptr<Interpolator> interp;
    // no dtor, no copy/move — compiler generates correct ones
};
```

**Aim for the rule of zero.** You only descend to rule of five when wrapping a raw C resource (a file handle, an FFI pointer) that no existing RAII type covers — and even then, wrap it once in a small RAII class and go back to rule of zero everywhere else.

### Q4. unique_ptr vs shared_ptr vs weak_ptr — when do you use each?

| | Ownership | Cost | Use when |
|---|---|---|---|
| `unique_ptr<T>` | Sole owner, move-only | **Zero** overhead vs raw pointer | The default. One clear owner; transfer with `std::move`. |
| `shared_ptr<T>` | Shared, atomic refcount | Heavier — atomic inc/dec on copy, separate control block | Ownership is *genuinely* shared and lifetime can't be scoped to one owner. |
| `weak_ptr<T>` | None (observer) | Cheap; no keep-alive | Observe a `shared_ptr` without extending its life; break cycles. |

```cpp
auto engine = std::make_unique<MonteCarloEngine>(cfg);   // sole owner
auto curve  = std::make_shared<YieldCurve>(data);        // many instruments share it
std::weak_ptr<YieldCurve> observer = curve;              // watch, don't own
if (auto c = observer.lock()) { c->discount(t); }        // safe access if alive
```

Guidance:
- **Default to `unique_ptr`.** It's free and expresses clear ownership.
- **`shared_ptr` only for true sharing** — e.g. one market-data object referenced by many trades with independent lifetimes. Its atomic refcount is a real cost; **avoid copying it on the hot path** (pass `const shared_ptr&` or a raw/`T*` observer instead).
- **`weak_ptr` for observers and to break cycles** (Q9). `lock()` gives you a `shared_ptr` if the object still lives, `nullptr` if not.

Over-using `shared_ptr` ("shared by default") is a common smell: unclear ownership, atomic contention, and cycle leaks.

### Q5. Why is raw new/delete discouraged in modern C++?

Because manual `new`/`delete` makes leaks and double-frees *possible*, and modern C++ makes them *impossible* — for free. Problems with raw ownership:

- **Exception leaks.** If code between `new` and `delete` throws, the `delete` is skipped and the memory leaks:

```cpp
Widget* w = new Widget();
do_stuff();          // throws → delete never runs → leak
delete w;
```

- **Manual bookkeeping** — you must `delete` on every path (early return, break, exception), pair each `new` with exactly one `delete`, and never use-after-free. Easy to get wrong at scale.
- **Unclear ownership** — a raw `T*` in an API doesn't say who frees it.

The fix is RAII containers and smart pointers:

```cpp
auto w = std::make_unique<Widget>();  // freed automatically at scope exit,
do_stuff();                           // even if this throws
```

`std::make_unique` / `std::make_shared` allocate and wrap in one step (also exception-safe, and `make_shared` fuses the object and control block into one allocation). With `vector` for buffers and `unique_ptr` for single objects, you essentially never write `new`/`delete` yourself. Raw `new`/`delete` survives only inside the guts of a custom allocator or container — code most quants never touch.

### Q6. Implement a minimal RAII wrapper for a raw resource (rule of five).

When you must own a raw C-style resource (say a handle from a market-data C API), wrap it once. Full rule-of-five:

```cpp
class MarketDataSession {
    Handle h_ = nullptr;                     // raw resource
public:
    explicit MarketDataSession(const char* cfg)
        : h_(md_open(cfg)) {                 // acquire in ctor
        if (!h_) throw std::runtime_error("md_open failed");
    }
    ~MarketDataSession() { if (h_) md_close(h_); }   // release in dtor

    // Non-copyable: a session handle shouldn't be duplicated
    MarketDataSession(const MarketDataSession&) = delete;
    MarketDataSession& operator=(const MarketDataSession&) = delete;

    // Movable: transfer ownership, null the source
    MarketDataSession(MarketDataSession&& o) noexcept : h_(o.h_) {
        o.h_ = nullptr;
    }
    MarketDataSession& operator=(MarketDataSession&& o) noexcept {
        if (this != &o) {
            if (h_) md_close(h_);            // release ours
            h_ = o.h_;                       // steal theirs
            o.h_ = nullptr;                  // leave source valid-but-empty
        }
        return *this;
    }
    Handle get() const { return h_; }
};
```

Key points: acquire in ctor (throw on failure so you never hold a bad handle), release in dtor, **delete copy** (a handle isn't copyable), and provide **`noexcept` move** that nulls the moved-from source so its destructor is a harmless no-op. Mark moves `noexcept` so containers like `vector` will move rather than copy them on reallocation. Better still: if you only need this once, consider `std::unique_ptr<HandleType, decltype(&md_close)>` and skip writing the class at all (Q7).

### Q7. How can unique_ptr manage a non-memory resource, avoiding a hand-written class?

`unique_ptr` takes a **custom deleter**, so it can own *any* resource whose cleanup is a callable — not just heap memory. This often lets you get RAII without writing a rule-of-five class:

```cpp
#include <cstdio>
#include <memory>

// FILE* managed by unique_ptr with fclose as the deleter
auto fp = std::unique_ptr<std::FILE, decltype(&std::fclose)>(
              std::fopen("trades.csv", "r"), &std::fclose);
if (fp) { /* use fp.get() */ }
// fclose(fp) called automatically at scope exit

// A C-API handle, deleter as a lambda
auto session = std::unique_ptr<SessionT, void(*)(SessionT*)>(
                   md_open(cfg), [](SessionT* s){ md_close(s); });
```

For zero storage overhead, use a **stateless functor** deleter type so `unique_ptr` stays pointer-sized:

```cpp
struct MdCloser { void operator()(SessionT* s) const { md_close(s); } };
using Session = std::unique_ptr<SessionT, MdCloser>;   // sizeof == one pointer
```

This is the rule-of-zero spirit applied to foreign resources: you don't write a destructor, copy, or move — `unique_ptr` supplies correct, move-only, exception-safe ownership, and the deleter runs deterministically at scope exit. Reach for the hand-written class only when the resource needs richer behaviour than "close it once."

### Q8. Spot the bug: a lambda captures a local by reference and is stored for later.

```cpp
std::function<double(double)> make_discounter(double rate) {
    double factor = compute_factor(rate);
    return [&](double t) { return std::exp(-factor * t); };  // BUG
}
```

The lambda captures `factor` **by reference** (`[&]`), but `factor` is a local that is **destroyed when `make_discounter` returns**. The returned `std::function` now holds a dangling reference; every later call reads freed stack memory — **undefined behaviour** (may return garbage, may appear to work until the stack is reused).

Fix: capture **by value** so the lambda owns its own copy, which lives as long as the closure:

```cpp
return [factor](double t) { return std::exp(-factor * t); };  // captures a copy
```

General rules:
- A closure that **outlives the enclosing scope** (stored, returned, posted to a thread/queue) must capture by value (or capture `shared_ptr`s for shared state).
- `[&]` is only safe for closures used **within** the current scope (e.g. passed to an algorithm that runs immediately, like `std::sort`'s comparator).
- Beware `[=]` capturing `this` in a member function — it captures the *pointer* `this`, so the closure dangles if the object dies; capture needed members explicitly, or `[*this]` (C++17) to copy the object.

This class of lifetime bug is exactly what ASan catches — run sanitizers in CI.

### Q9. What is a shared_ptr reference cycle, and how does weak_ptr fix it?

`shared_ptr` frees the object when its refcount hits zero. If two objects hold `shared_ptr`s to **each other**, neither count ever reaches zero even when nothing else references them — a **cycle leak**: memory (and its resources) never freed.

```cpp
struct Instrument { std::shared_ptr<PricingEngine> engine; };
struct PricingEngine { std::shared_ptr<Instrument> owner; };  // cycle!

auto inst = std::make_shared<Instrument>();
inst->engine = std::make_shared<PricingEngine>();
inst->engine->owner = inst;   // now each keeps the other alive forever
```

When `inst` goes out of scope, its count drops to 1 (the engine still points to it) and vice versa — both leak.

Fix: make the **back-reference** (the non-owning direction) a `weak_ptr`. Decide who *owns* whom; the owned side observes its owner weakly:

```cpp
struct PricingEngine { std::weak_ptr<Instrument> owner; };   // non-owning

// access safely:
if (auto inst = engine->owner.lock()) {  // shared_ptr if still alive, else null
    inst->notify();
}
```

`weak_ptr` doesn't contribute to the refcount, so it doesn't keep the object alive; `lock()` promotes it to a `shared_ptr` *only if* the object still exists. The rule: **ownership edges are `shared_ptr`, observation/back-edges are `weak_ptr`.** This is exactly the pattern QuantLib's Observer mechanism uses to watch market data without owning it.

### Q10. Why is deterministic destruction a performance feature, not just a correctness one?

Correctness-wise, deterministic destruction means no leaks and exception safety. But it's *also* a performance property for three reasons:

1. **No GC pauses / jitter.** A tracing garbage collector reclaims memory on its own schedule, introducing unpredictable stop-the-world pauses. RAII frees at a *statically-known* point, so there's no background collector to stall your hot path at a critical microsecond. For latency-sensitive trading, eliminating that jitter is worth more than average throughput.

2. **Prompt resource release enables reuse.** Because a buffer is freed exactly at scope exit, an allocator (or your object pool) can immediately reuse that memory — keeping the working set small and cache-resident. GC's deferred reclamation bloats the live heap and hurts cache locality.

3. **Stack allocation and no bookkeeping.** RAII pairs naturally with stack-allocated objects (allocation is a pointer bump; destruction is free) and needs no per-object GC metadata or write barriers.

The deeper point: RAII lets you *reason about exactly when* costly work (freeing, unlocking, flushing) happens, so you can keep it **off** the hot path entirely — e.g. allocate/free outside the trading loop, reuse inside it. A GC hides that timing from you. Deterministic timing is the enabler for the whole low-latency toolkit (see the Low-Latency topic).

### Q11. Pass by value, const reference, or rvalue reference — how do you choose for a function parameter?

Choose by **size** and whether the function **keeps** the argument:

- **Small, cheap-to-copy types (`double`, `int`, small structs, `std::span`)** → pass **by value**. Copying is trivial and a value is easier to optimise (no aliasing, register-friendly).

```cpp
double discount(double rate, double t);          // by value — cheap
```

- **Large types you only read** → pass **`const T&`**, avoiding a copy:

```cpp
double price(const std::vector<double>& path);   // read-only, no copy
```

- **Large types the function stores/owns a copy of** → take **by value and `std::move`** (the "sink" idiom). The caller decides copy-or-move; you move into place:

```cpp
class Engine {
    std::vector<double> data_;
public:
    explicit Engine(std::vector<double> d)       // by value...
        : data_(std::move(d)) {}                  // ...then move into member
};
// caller: Engine e(std::move(big));  // moved, no copy
// caller: Engine e(big);             // one copy, then move
```

- **`T&&` (rvalue ref) as an explicit parameter** → mainly for overload sets and perfect forwarding (`T&&` template + `std::forward`), not everyday signatures.

Rules of thumb: **value for small or sink params, `const&` for large read-only, forwarding refs in generic code.** Avoid non-const `T&` "out params" — prefer returning by value (RVO makes it free) or a struct/`tuple`. This ties into the move-semantics topic.

### Q12. What does this print, and is there a bug? (moved-from vector reused)

```cpp
std::vector<double> a = {1.0, 2.0, 3.0};
std::vector<double> b = std::move(a);
a.push_back(4.0);
std::cout << a.size() << "\n";
```

It prints **`1`**, and there is **no undefined behaviour** — but the code is a **smell** worth flagging.

After `std::move(a)`, `a` is in a **valid but unspecified state**. The standard guarantees a moved-from standard-library object is still a valid object on which you may call operations *with no preconditions* — like `push_back`, `clear`, `size`, or assignment. It does **not** guarantee *what* state it's in; in practice `vector`'s move leaves the source empty, so `push_back(4.0)` yields size 1.

The pitfalls to name:
- **Reading meaningful data** from a moved-from object is a bug — its contents are unspecified.
- Calling operations **with preconditions** (e.g. `front()`, `back()`, `pop_back()` on a possibly-empty container) is undefined.
- The safe pattern after moving is to either **not touch** the source, or **reassign** it before reuse:

```cpp
a = std::vector<double>{};   // now a is in a known state
```

So: prints 1, defined behaviour, but relying on a specific moved-from state is fragile — treat moved-from objects as "destroy or reassign only." (See the move-semantics topic.)

### Q13. Design the ownership model for a pricing engine, an instrument, and market data.

Decide the **ownership edges** first, then pick pointer types to match. Typical model:

- **Market data (yield curve, vol surface)** is **shared** — many instruments reference the same curve, and its lifetime isn't owned by any single trade. → `shared_ptr<const YieldCurve>` (const because instruments only *read* it). Instruments that merely *observe* for change notifications hold a `weak_ptr` (QuantLib's Handle/Observer pattern).

- **An instrument owns its payoff** (1:1, exclusive). → `std::unique_ptr<Payoff>` inside the instrument, or a value member if the payoff type is fixed.

- **A pricing engine** is a strategy plugged into an instrument. If an engine is stateless/shared across trades, pass it by reference or `shared_ptr`; if each instrument owns its engine, `unique_ptr<PricingEngine>`.

```cpp
class Option {
    std::unique_ptr<Payoff> payoff_;              // owns its payoff
    std::shared_ptr<const YieldCurve> curve_;     // shares market data
    std::unique_ptr<PricingEngine> engine_;       // owns its pricing strategy
public:
    double NPV() const { return engine_->calculate(*this); }
};
```

Principles:
- **Exclusive containment → `unique_ptr` or value; genuine sharing → `shared_ptr`; observation → `weak_ptr` or raw `T*`/`const&`.**
- Keep market data `const` where consumers only read it (safe to share across threads).
- Avoid `shared_ptr` for the payoff/engine just because it's convenient — that blurs ownership and adds atomic cost. Model the *actual* lifetimes.

This directly previews the OO-for-pricing topic (Instrument/PricingEngine/Payoff split) and the Financial-Library-Patterns topic (Handle/Observer).

### Q14. What is stack unwinding, and what must a destructor never do during it?

**Stack unwinding** is the process, when an exception is thrown, of walking back up the call stack and running the **destructors of all fully-constructed automatic objects** in each scope being exited — before the exception reaches its handler. This is exactly what makes RAII exception-safe: every lock, buffer, and handle acquired on the way in is released on the way out, automatically.

```cpp
void price_book() {
    std::lock_guard<std::mutex> g(m);        // acquired
    auto buf = std::make_unique<double[]>(N);
    risky_step();                            // throws
}   // unwinding runs ~unique_ptr then ~lock_guard — both cleaned up
```

The critical rule: **a destructor must not throw an exception, especially during unwinding.** If a destructor throws while the stack is already unwinding from another exception, C++ calls `std::terminate` — the program dies immediately. Consequences:

- Destructors should be **`noexcept`** (they are by default since C++11). Never let an exception escape a destructor.
- If a destructor does work that *can* fail (flushing a buffer, closing a file with errors), **catch and swallow/log** inside the destructor rather than propagating:

```cpp
~Writer() noexcept {
    try { flush(); } catch (...) { /* log, don't rethrow */ }
}
```

- For operations where failure *must* be observable, provide an explicit `close()`/`commit()` the caller invokes (which may throw), and have the destructor only handle the not-yet-closed fallback.

This is why move operations are also marked `noexcept` — containers rely on non-throwing moves for strong exception guarantees during reallocation.

### Q15. make_unique vs make_shared vs constructing the smart pointer directly — does it matter?

Yes, prefer the **`make_` factories** for correctness and (for `shared_ptr`) performance.

- **`std::make_unique<T>(args...)`** vs `unique_ptr<T>(new T(args...))`:
  - Avoids writing `new` at all (rule: no raw `new`).
  - **Exception safety** in multi-argument calls. Historically `f(std::unique_ptr<T>(new T), may_throw())` could leak if `may_throw()` ran between the `new` and the `unique_ptr` construction; `make_unique` closes that hole. (Post-C++17 evaluation order narrows this, but `make_unique` is still clearer and safer.)

- **`std::make_shared<T>(args...)`** vs `shared_ptr<T>(new T(args...))`:
  - **One allocation instead of two.** `make_shared` fuses the object and the control block (refcount) into a single heap block — fewer allocations, better cache locality, faster.
  - Same exception-safety benefit.
  - Caveat: with `make_shared`, the object's memory isn't freed until the last **`weak_ptr`** also dies (control block and object share one allocation). If you have large objects with long-lived `weak_ptr`s, the separate-allocation form can release the object sooner — a rare consideration.

```cpp
auto e = std::make_unique<Engine>(cfg);          // preferred
auto c = std::make_shared<YieldCurve>(data);     // one allocation
```

Bottom line: **default to `make_unique`/`make_shared`.** Fall back to constructing directly only for the edge cases — a custom deleter (which `make_unique` can't take), or the `weak_ptr`-lifetime concern above.

### Q16. How do RAII and value semantics together prevent whole classes of bugs?

They make entire bug categories **structurally impossible** rather than merely avoidable:

- **Memory/resource leaks** — RAII ties release to scope, so every acquired resource is freed on every exit path, including exceptions. You can't "forget" a `delete`; there isn't one.
- **Use-after-free / double-free** — with `unique_ptr` there's exactly one owner and one free; value semantics means copies are independent, so freeing one doesn't dangle another.
- **Aliasing surprises** — value semantics means passing/copying an object doesn't let a caller mutate your state behind your back; no hidden shared references (unless you *ask* for one via a pointer). Reasoning stays local.
- **Lock leaks / deadlocks** — `lock_guard`/`scoped_lock` release on scope exit, even under exceptions, so a throwing critical section can't leave the desk's mutex held.
- **Iterator/reference invalidation from shared state** — preferring values over shared references removes a class of "someone else reallocated the vector I was holding a reference into."

The unifying idea: instead of *remembering* to do cleanup and *avoiding* aliasing by discipline, you encode ownership in the type system and let **scope** drive lifetime. The compiler enforces it. That's why idiomatic modern C++ — rule of zero, `unique_ptr`, value members, `const&` params — is both safer *and* faster than manual management: the same mechanism (deterministic, scope-bound lifetime) delivers correctness and performance at once. This is the foundation the move-semantics, low-latency, and OO-design topics all build on.
## Templates & Generic Numerical Code

### Summary

**What this topic covers**

How C++ templates turn one piece of numeric code into many specialised, fully-inlined machine-code variants — the single biggest reason C++ beats interpreted languages on pricing hot paths. This topic has 16 questions. Three concern areas: (1) **generic numeric kernels** — function and class templates so one Monte Carlo engine, one Newton solver, one interpolator works for `double`, `float`, an AAD active type, or a whole `std::array<double,N>` of paths; (2) **compile-time dispatch** — `if constexpr`, template metaprogramming, **CRTP** (static polymorphism that removes the vtable and lets the optimiser inline), and **policy-based design** (compose a pricer from an RNG policy + a payoff policy chosen at compile time); (3) **expression templates** — the trick that lets Eigen evaluate `a = b + c + d` in one fused loop with zero temporaries, plus C++20 **concepts** to constrain `template<std::floating_point T>` and give readable errors. The recurring theme: pay compile time and code size to buy runtime speed and type safety. It complements the general C++ primer's template syntax — here it is always in service of a numeric kernel.

**Mental model**

A template is not a function — it is a *recipe the compiler runs* to stamp out a function per set of types. Think of it as compile-time code generation. When you write `template<class T> T mean(span<const T>)`, nothing is compiled until someone instantiates `mean<double>`; then the compiler produces a `double`-specific version with the type baked in, ripe for inlining and vectorisation. This is why a templated `payoff(S)` inlined into the MC loop costs zero call overhead, whereas a `std::function<double(double)>` payoff pays an indirect call every path. The mental shift from OO is: **move the dispatch decision from runtime to compile time**. A `virtual` picks the implementation when the program runs (vtable lookup, no inlining across it); a template or CRTP picks it when the program compiles (the concrete type is known, everything inlines). On a hot path evaluated a billion times, that difference dominates. The cost is real: longer builds, bigger binaries, and error messages that name deeply nested types — which concepts (C++20) exist to tame.

**Key terms**

- **Function/class template** — a pattern parameterised by type; instantiated on first use into concrete code.
- **Instantiation / monomorphisation** — the compiler generating one concrete version per type argument (source of both speed and code bloat).
- **CRTP** (Curiously Recurring Template Pattern) — `class D : Base<D>`; static polymorphism, no vtable, calls inline.
- **Policy-based design** — inject behaviour (RNG, payoff, discounting) as template parameters, composed at compile time.
- **Expression template** — an operator returns a tiny node object describing the operation, not the result; the whole tree evaluates in one loop on assignment.
- **`if constexpr`** — compile-time branch; the untaken branch is discarded, not just skipped.
- **Concept** (C++20) — a named compile-time predicate on types (`std::floating_point<T>`) used to constrain templates.
- **Template metaprogramming** — computing types/values at compile time (traits, `constexpr`, recursion/fold).
- **SFINAE** — "substitution failure is not an error"; the pre-concepts way to enable/disable overloads; concepts replace most of it.
- **Code bloat** — many instantiations inflating the binary and instruction cache.

**Why interviewers ask this**

Templates are the line between a C++ *user* and a C++ *quant developer*. A junior can write a `virtual double price()` hierarchy; a senior knows when that vtable is killing the hot path and reaches for CRTP or a template policy instead. Interviewers probe: can you explain *why* a templated payoff is faster than a `std::function` one (inlining, no indirect call)? Do you understand expression templates well enough to say why `Vector c = a + b` in a naive library allocates a temporary but Eigen does not? Can you constrain a template so a caller passing `int` gets a clean error, not three screens of instantiation noise? The senior signal is judgement about the tradeoff — templates are not free, and knowing *when the compile-time cost is not worth it* (rarely-called setup code, plugin boundaries) is as important as knowing how to write them.

**Common confusions**

- "Templates are just generics like Java/C#" — no; Java generics erase to `Object` with one implementation, C++ templates *monomorphise* to one specialised implementation per type. That is why C++ generic code is fast and Java generic code boxes.
- "CRTP needs a virtual somewhere" — the opposite; CRTP exists specifically to avoid `virtual`. The base casts `static_cast<Derived*>(this)` and calls the derived method directly.
- "`if constexpr` is just a faster `if`" — it discards the false branch at compile time, so that branch need not even compile for the current type; a runtime `if` requires both branches to be valid.
- "Expression templates make everything faster" — they remove temporaries in elementwise chains; for a single operation or a matrix multiply you still want BLAS, and the machinery adds compile time.
- "Concepts change runtime behaviour" — they are purely compile-time constraints; they change *which overload is chosen* and error quality, never generated code.

**What follows from this topic**

CRTP and template policies are the concrete mechanism behind the low-latency advice to avoid virtual dispatch on the hot path. Expression templates are why the Linear Algebra topic recommends Eigen. Templating a Monte Carlo engine on its payoff and path generator is the design in the Monte Carlo topic. The OO Design topic is the counterweight — it shows where runtime polymorphism (`virtual`, Strategy) is the *right* call for flexibility, and this topic shows where to trade that flexibility for speed. Concepts reappear in Modern C++.

### Q1. Why does a templated payoff make a Monte Carlo pricer faster than passing a `std::function`?

Because a template argument is known at compile time, so the payoff call inlines into the loop; `std::function` is a runtime type-erased wrapper, so every path pays an indirect call and blocks inlining and vectorisation.

```cpp
// Templated: payoff type known at compile time -> inlines, vectorises.
template <class Payoff>
double mc_price(const Payoff& payoff, double S0, double r, double sigma,
                double T, int n, std::uint64_t seed) {
    std::mt19937_64 rng(seed);
    std::normal_distribution<double> Z(0.0, 1.0);
    const double drift = (r - 0.5 * sigma * sigma) * T;
    const double vol   = sigma * std::sqrt(T);
    double sum = 0.0;
    for (int i = 0; i < n; ++i) {
        double ST = S0 * std::exp(drift + vol * Z(rng));
        sum += payoff(ST);            // inlined: no call overhead
    }
    return std::exp(-r * T) * (sum / n);
}

struct Call { double K; double operator()(double S) const { return std::max(S - K, 0.0); } };

// vs std::function<double(double)> payoff  -> indirect call every path
```

Benchmarks typically show the `std::function` version 2-5x slower purely from the per-path indirect call and lost inlining. The cost of the template version is one instantiation per payoff type. Use `std::function` only where you genuinely need runtime-chosen payoffs (e.g. a scripting boundary), and accept the hit there.

### Q2. What is CRTP and how does it remove virtual dispatch on the hot path?

CRTP (Curiously Recurring Template Pattern) is a base class templated on its own derived type: `class Derived : public Base<Derived>`. The base calls into the derived by `static_cast`, so the concrete method is resolved at compile time — no vtable, and the call inlines.

```cpp
template <class Derived>
struct PathGenerator {
    // No virtual. Base forwards to derived via static_cast -> inlinable.
    double next(std::mt19937_64& rng) {
        return static_cast<Derived*>(this)->next_impl(rng);
    }
};

struct GBMGenerator : PathGenerator<GBMGenerator> {
    double S0, drift, vol;
    std::normal_distribution<double> Z{0.0, 1.0};
    double next_impl(std::mt19937_64& rng) {           // called directly, inlined
        return S0 * std::exp(drift + vol * Z(rng));
    }
};
```

| | `virtual` | CRTP |
|---|---|---|
| Dispatch | Runtime (vtable) | Compile time (`static_cast`) |
| Inlining | Blocked across call | Full |
| Object size | +8 bytes vptr | No vptr |
| Container of mixed types | Yes (`vector<Base*>`) | No — one type per template |
| Use when | Heterogeneous, cold path | Homogeneous, hot path |

Trade-off: CRTP loses the ability to store different concrete types in one `vector<Base*>`. On a hot loop over one known generator that is exactly what you want; for a portfolio of mixed instruments, use `virtual`.

### Q3. Rewrite this virtual hot-loop with CRTP and explain the win.

Given `struct Payoff { virtual double operator()(double) const = 0; };` called once per path — the vtable lookup and inlining barrier cost real time. CRTP moves resolution to compile time.

```cpp
// Before: virtual — indirect call + no inlining, every path
double price_virtual(const Payoff& p, const std::vector<double>& ST) {
    double s = 0.0;
    for (double x : ST) s += p(x);        // indirect call each iteration
    return s / ST.size();
}

// After: CRTP — call resolved and inlined at compile time
template <class P>
struct PayoffBase {
    double eval(double S) const { return static_cast<const P&>(*this).eval_impl(S); }
};
struct CallPayoff : PayoffBase<CallPayoff> {
    double K;
    double eval_impl(double S) const { return std::max(S - K, 0.0); }
};
template <class P>
double price_crtp(const PayoffBase<P>& p, const std::vector<double>& ST) {
    double s = 0.0;
    for (double x : ST) s += p.eval(x);   // inlined -> max fuses into loop, vectorises
}
```

The win: the compiler sees `std::max(S - K, 0.0)` inside the loop body, inlines it, and can auto-vectorise the whole loop under `-O3`. The virtual version cannot cross the indirect call, so it stays scalar and pays the dispatch each iteration.

### Q4. What is policy-based design? Sketch a pricer composed of an RNG policy and a payoff policy.

Policy-based design injects behaviour as template parameters, each a small class with a fixed interface ("policy"). The class composes them at compile time, so every combination is a distinct, fully-inlined type. It is the compile-time analogue of dependency injection.

```cpp
struct MT64Policy {
    std::mt19937_64 eng;
    explicit MT64Policy(std::uint64_t seed) : eng(seed) {}
    double normal() { std::normal_distribution<double> d; return d(eng); }
};

struct CallPolicy {
    double K;
    double payoff(double S) const { return std::max(S - K, 0.0); }
};

template <class RngPolicy, class PayoffPolicy>
class McPricer {
    RngPolicy rng_;
    PayoffPolicy payoff_;
    double S0_, r_, sigma_, T_;
public:
    McPricer(RngPolicy rng, PayoffPolicy p, double S0, double r, double sigma, double T)
        : rng_(rng), payoff_(p), S0_(S0), r_(r), sigma_(sigma), T_(T) {}
    double price(int n) {
        const double drift = (r_ - 0.5 * sigma_ * sigma_) * T_;
        const double vol   = sigma_ * std::sqrt(T_);
        double sum = 0.0;
        for (int i = 0; i < n; ++i)
            sum += payoff_.payoff(S0_ * std::exp(drift + vol * rng_.normal()));
        return std::exp(-r_ * T_) * (sum / n);
    }
};
// McPricer<MT64Policy, CallPolicy> — RNG and payoff swapped with zero runtime cost.
```

Swap in a `SobolPolicy` or `PutPolicy` and you get a new fully-inlined pricer. The cost is one instantiation per combination and slightly heavier compiles; the benefit is composition with no virtual dispatch.

### Q5. Explain how expression templates let Eigen evaluate `a = b + c + d` with no temporaries.

A naive vector library evaluates `b + c` into a temporary, then `+ d` into another, then copies to `a` — three loops and two heap temporaries. Expression templates make `operator+` return a tiny *node object* that only *describes* the addition; nothing is computed until assignment, which runs a single fused loop.

```cpp
// operator+ returns a lightweight node holding references, not a computed vector.
template <class L, class R>
struct Sum {
    const L& l; const R& r;
    double operator[](std::size_t i) const { return l[i] + r[i]; }  // lazy
    std::size_t size() const { return l.size(); }
};
template <class L, class R> Sum<L,R> operator+(const L& l, const R& r) { return {l, r}; }

struct Vec {
    std::vector<double> v;
    double operator[](std::size_t i) const { return v[i]; }
    template <class Expr> Vec& operator=(const Expr& e) {   // fuses the whole tree here
        for (std::size_t i = 0; i < e.size(); ++i) v[i] = e[i];   // ONE loop
        return *this;
    }
};
// a = b + c + d  builds Sum<Sum<Vec,Vec>,Vec>; the assignment loop calls
// operator[] which expands to b[i] + c[i] + d[i] — single pass, zero temporaries.
```

So `b + c + d` builds the type `Sum<Sum<Vec,Vec>,Vec>` at compile time; the assignment's single loop expands `e[i]` to `b[i] + c[i] + d[i]`. One pass, no allocations, and the optimiser can vectorise it. This is exactly Eigen's mechanism (plus SIMD and alignment), and the reason `Vector` chains in Eigen are fast without you writing raw loops.

### Q6. When do expression templates NOT help, and what is their cost?

They help for *elementwise* chains (`a + b - c`, scaling, coefficientwise products) where fusion removes temporaries. They do **not** help a matrix-matrix multiply — that is O(n^3) work best handed to BLAS/MKL, where the temporary is negligible and cache-blocking matters far more than fusion. Costs: (1) much longer compile times and deep template types in errors; (2) a dangerous lifetime trap — the nodes hold *references*, so storing an expression with `auto` past the lifetime of its operands is a dangling-reference bug.

```cpp
// UB: expr holds references to temporaries that die at the end of this statement.
auto expr = Vec{...} + Vec{...};   // dangling — operands destroyed
double x = expr[0];                // reads freed memory

// Safe: assign into a concrete vector immediately (forces evaluation now).
Vec a = b + c + d;                 // fine — evaluated before temporaries die
```

Rule of thumb: let the library return expression types, but assign them to a concrete `Vector`/`Matrix` promptly and avoid `auto expr = ...` unless you know the operands outlive it.

### Q7. What is `if constexpr` and how does it help write one generic pricer for scalar and AAD types?

`if constexpr` is a compile-time branch: the condition is a `constexpr bool`, and the *untaken* branch is discarded before it is even type-checked for that instantiation. This lets one template body do different things per type without SFINAE or overloads.

```cpp
template <class T>
T discount_factor(T r, T t) {
    if constexpr (std::is_same_v<T, double>) {
        return std::exp(-r * t);            // fast library exp for plain doubles
    } else {
        return exp(-r * t);                 // ADL: picks the AAD type's overloaded exp
    }
}
```

Because the false branch is discarded, `std::exp` need not be valid for the AAD type in that instantiation, and vice versa. A runtime `if` would require *both* branches to compile for *every* `T`, which fails when the two types support different functions. `if constexpr` is the clean way to specialise numeric kernels (scalar vs vectorised vs differentiable) inside a single template.

### Q8. How do C++20 concepts improve a numeric template? Constrain a solver to floating-point types.

Concepts are named compile-time predicates on types. Constraining a template with one (a) rejects wrong types at the call site with a short, readable error instead of a deep instantiation dump, and (b) documents the requirement in the signature.

```cpp
#include <concepts>

template <std::floating_point T, class F, class DF>
T newton(F f, DF df, T x0, T tol = T(1e-10), int max_it = 100) {
    T x = x0;
    for (int i = 0; i < max_it; ++i) {
        T fx = f(x);
        if (std::abs(fx) < tol) return x;
        x -= fx / df(x);                 // needs derivative; see implied-vol question
    }
    return x;
}
```

Calling `newton` with `int` now fails immediately: "constraint `std::floating_point<int>` not satisfied", not pages of errors from deep inside the loop. You can write custom concepts too, e.g. `template<class T> concept Payoff = requires(T p, double s){ { p(s) } -> std::convertible_to<double>; };` to constrain the payoff policy. Concepts change only compile-time selection and diagnostics — never the generated code.

### Q9. What is template code bloat and when should you avoid over-templating?

Each distinct instantiation generates its own machine code. Templating a large function on many type/value parameters can produce dozens of near-identical copies that bloat the binary and thrash the instruction cache — sometimes making code *slower* despite "more inlining". Avoid over-templating when: the code is cold (setup, config, I/O), the body is large, or the type set is open-ended (a plugin boundary begging for runtime polymorphism).

```cpp
// Bloat risk: templating a big body on a small value knob -> N copies of a large function.
template <int N> Matrix solve_grid();     // solve_grid<50>, <100>, <200>... all separate

// Better: template only the tiny hot kernel; keep the bulky logic in one non-template fn.
Matrix solve_grid(int n);                 // one copy; pass n as a runtime argument
```

The discipline: template the *small, hot, type-varying* kernel; keep *large or cold* logic as ordinary functions. Measure binary size and i-cache misses if a heavily-templated build regresses.

### Q10. Implement a generic `mean` and `variance` over any container of floating-point, using concepts.

A clean generic reduction: constrain the value type to floating point, take any range, and compute mean and sample variance in a numerically careful two-pass (or Welford) manner. Two-pass is fine and more accurate than the naive sum-of-squares.

```cpp
#include <concepts>
#include <ranges>

template <std::ranges::input_range R>
    requires std::floating_point<std::ranges::range_value_t<R>>
auto mean_var(const R& xs) {
    using T = std::ranges::range_value_t<R>;
    T n = 0, mean = 0;
    for (T x : xs) { ++n; mean += x; }
    mean /= n;
    T s2 = 0;
    for (T x : xs) { T d = x - mean; s2 += d * d; }
    return std::pair<T,T>{ mean, s2 / (n - 1) };   // sample variance
}
// Works for vector<double>, array<float,N>, a filtered view — all monomorphised.
```

For Monte Carlo, the standard error is sqrt(var / n), so `mean_var` gives both the price estimate and its error bar in one place. The concept guard keeps someone from instantiating it on `vector<int>` and getting integer-division surprises.

### Q11. `std::function` vs a template parameter for a callback in numeric code — which and why?

Prefer a **template parameter** on the hot path; use `std::function` only where the callback must be chosen at runtime or stored heterogeneously. `std::function` type-erases: it may heap-allocate for large captures, and every call is indirect (no inlining). A template parameter bakes the concrete callable in, so the call inlines and vectorises.

| | Template param | `std::function` |
|---|---|---|
| Call cost | Inlined, zero overhead | Indirect call |
| Heap alloc | None | Possible (large captures) |
| Runtime swap | No | Yes |
| Stored in container | Only same type | Yes (heterogeneous) |
| Hot path | Yes | Avoid |

```cpp
template <class F> double integrate(F f, double a, double b, int n); // hot: inlines f
double integrate(std::function<double(double)> f, ...);              // flexible: cold only
```

For an integrand or payoff evaluated millions of times, the template form is the default; reserve `std::function` for the rare runtime-configurable edge.

### Q12. What does `std::mt19937_64` as a template-style engine buy you, and how do you make a solver generic over the engine?

The `<random>` engines are class templates/typedefs with a common concept-like interface (`operator()`, `min`, `max`, `seed`). Templating your simulation on the engine lets you swap Mersenne Twister for a faster PCG/xoshiro without touching the algorithm, and keeps the call inlined.

```cpp
template <class Engine>
double mc_price(Engine& eng, double S0, double r, double sigma, double T, int n) {
    std::normal_distribution<double> Z;
    const double drift = (r - 0.5 * sigma * sigma) * T, vol = sigma * std::sqrt(T);
    double sum = 0.0;
    for (int i = 0; i < n; ++i)
        sum += std::max(S0 * std::exp(drift + vol * Z(eng)) - 100.0, 0.0);
    return std::exp(-r * T) * (sum / n);
}
// mc_price(mt) or mc_price(pcg) — same code, engine chosen at compile time.
```

This is policy-based design applied to the RNG. In parallel MC you instantiate one engine per thread (distinct seeds/streams) and the template keeps each per-thread call fully inlined. Never share one engine across threads — covered in the Concurrency topic.

### Q13. Spot the bug: this templated accumulator gives wrong results for `float`.

```cpp
template <class T>
T sum_payoffs(const std::vector<T>& p) {
    T total = 0;
    for (auto x : p) total += x;      // naive running sum
    return total;
}
```

For a large `vector<float>` the running sum loses precision catastrophically: once `total` grows large, adding a small `x` rounds away — the classic accumulation-error problem, worst in `float` (24-bit mantissa). Two fixes: accumulate in a wider type, or use compensated (Kahan) summation.

```cpp
template <class T>
T sum_payoffs(const std::vector<T>& p) {
    // Accumulate in double regardless of T; or use Kahan for full accuracy.
    double total = 0.0, c = 0.0;           // Kahan compensation
    for (T x : p) {
        double y = static_cast<double>(x) - c;
        double t = total + y;
        c = (t - total) - y;
        total = t;
    }
    return static_cast<T>(total);
}
```

The lesson for generic numeric code: the accumulator type should not blindly follow the element type. For Monte Carlo means over millions of paths, accumulate in `double` (or `long double`) even when paths are `float`, or the standard error you report is meaningless.

### Q14. How would you use a trait / `constexpr` to pick the RNG normal-generation method at compile time?

Use a compile-time trait or template value to select Box-Muller vs the library Ziggurat (`std::normal_distribution`) without a runtime branch, so the untaken path adds no cost. This is metaprogramming in service of a numeric kernel.

```cpp
enum class NormalMethod { Library, BoxMuller };

template <NormalMethod M, class Engine>
double next_normal(Engine& eng) {
    if constexpr (M == NormalMethod::Library) {
        std::normal_distribution<double> d;
        return d(eng);
    } else {                                   // Box-Muller: two uniforms -> one normal
        std::uniform_real_distribution<double> u(0.0, 1.0);
        double u1 = u(eng), u2 = u(eng);
        return std::sqrt(-2.0 * std::log(u1)) * std::cos(2.0 * 3.14159265358979323846 * u2);
    }
}
```

The `if constexpr` discards the unused branch per instantiation, so `next_normal<NormalMethod::Library>` compiles to just the library call. This pattern generalises: pick antithetic vs plain sampling, single vs double precision, scalar vs SIMD kernel — all resolved at compile time, all fully inlined.

### Q15. Compare templates (C++ monomorphisation) with Java/C# generics for numeric code — why does it matter for a quant library?

C++ templates *monomorphise*: the compiler emits one concrete, specialised version per type, with the type baked in — so `Matrix<double>` operations inline, vectorise, and pay zero boxing. Java/C# generics (for reference types) *erase* or share one implementation over `Object`, boxing primitives; `List<Double>` stores heap-allocated boxed doubles with pointer chasing and GC pressure. For a million-path Monte Carlo, that is the difference between a tight cache-friendly `double` loop and a boxed, allocating, GC-pausing one.

| | C++ template | Java generic | C# generic |
|---|---|---|---|
| Mechanism | Monomorphise per type | Erasure | Reified, shared for ref types |
| Primitives | Native, no boxing | Boxed | Value types specialised (better than Java) |
| Inlining | Full | JIT-dependent | JIT-dependent |
| Cost | Compile time, code size | Boxing, GC | Some code size |

This is a core reason the pricing/risk core stays in C++ and only the research glue is Python/Java. The templated `double` kernel is why C++ owns the latency- and throughput-critical numeric path.

### Q16. Design a generic templated Monte Carlo engine parameterised on path generator, payoff, and accumulator.

Compose three policies at compile time so the whole per-path body inlines into one loop: a **PathGenerator** (produces a terminal or full path), a **Payoff** (maps path to cashflow), and an **Accumulator** (running mean + variance for the standard error). Template on all three so there is no virtual dispatch anywhere on the hot path.

```cpp
struct MeanVarAccumulator {
    double sum = 0.0, sum2 = 0.0; long n = 0;
    void add(double x) { sum += x; sum2 += x * x; ++n; }
    double mean() const { return sum / n; }
    double stderr_() const {                     // ~ 1/sqrt(N) convergence
        double m = mean();
        return std::sqrt((sum2 / n - m * m) / n);
    }
};

template <class PathGen, class Payoff, class Acc = MeanVarAccumulator>
class MonteCarloEngine {
    PathGen gen_; Payoff payoff_; double discount_;
public:
    MonteCarloEngine(PathGen g, Payoff p, double discount)
        : gen_(g), payoff_(p), discount_(discount) {}
    template <class Engine>
    std::pair<double,double> run(Engine& rng, int n) {
        Acc acc;
        for (int i = 0; i < n; ++i)
            acc.add(payoff_(gen_.terminal(rng)));   // all three inline into one loop
        return { discount_ * acc.mean(), discount_ * acc.stderr_() };
    }
};
```

Every policy call inlines, so the loop body is just `exp`, `max`, and two `+=` — vectorisable and branch-light. Swap `PathGen` for a Heston generator, `Payoff` for an Asian payoff, or add an antithetic accumulator, all at compile time with zero runtime cost. Report both price and standard error; the error shrinks like 1/sqrt(N), the defining property of Monte Carlo.

## OO Design for Pricing Libraries

### Summary

**What this topic covers**

How real pricing libraries are structured with object-oriented design — the counterweight to the templates topic. Where templates buy hot-path speed, OO buys *flexibility*: the ability to hold a heterogeneous book of instruments, add a new product or a new pricing method without touching existing code, and separate slow-moving market data from fast-moving trades. This topic has 16 questions. The spine is the canonical **Instrument / Payoff / PricingEngine** decomposition (the design QuantLib is built on): an instrument *is* a trade, a payoff describes *what* it pays, and a pricing engine knows *how* to value it — the Strategy pattern, so one `EuropeanOption` prices via analytic Black-Scholes, a binomial tree, or Monte Carlo by swapping engines. Around that spine sit the classic patterns in their quant roles: **Visitor** (run an operation — pricing, risk, cashflow reporting — across every instrument type), **Factory** (build instruments/engines from config or trade feeds), **Decorator** (wrap a pricer to add discounting, netting, or logging), and the **Observer/Handle** pattern for reactive market data. It complements the templates topic and the QuantLib material.

**Mental model**

Think of a pricing library as three loosely-coupled axes that must vary independently: **what the trade is** (instrument + payoff), **how you value it** (engine), and **what the market looks like** (curves, vol surfaces, quotes). The whole art of the design is keeping these orthogonal. If pricing logic lives *inside* the instrument, you cannot add a new numerical method without editing every product; if market data is baked into instruments, you cannot revalue the book under a shocked curve. So the instrument is a passive data holder that *delegates* valuation to an injected engine (Strategy), the engine reads market data through *handles* it does not own, and payoffs are small callable objects the engine evaluates. This is the same "compose behaviour, don't inherit it" instinct as policy-based design — but resolved at *runtime* via `virtual`, because a trading book is inherently heterogeneous and dynamic: you load trades whose types you did not know at compile time. The mental test for any addition: "to add product X or method Y, how many existing files must I edit?" A good design answers "one — the new file."

**Key terms**

- **Instrument** — a tradeable; holds terms (strike, expiry) and delegates valuation to an engine. Base class of the hierarchy.
- **Payoff** — a small object mapping underlying value to cashflow, e.g. `max(S-K,0)`; injected into the option.
- **PricingEngine** — Strategy that values an instrument; interchangeable (analytic / tree / MC).
- **Strategy pattern** — encapsulate an algorithm behind an interface so it can be swapped at runtime; the Instrument-Engine split *is* Strategy.
- **Visitor** — externalise an operation over a fixed set of types via `accept(Visitor&)` + `visit(ConcreteType&)`; add operations without editing instruments.
- **Factory** — centralise construction; build the right instrument/engine from a type tag or config.
- **Decorator** — wrap an object to add behaviour (discounting, logging) with the same interface.
- **Observer / Observable** — a Handle wraps a Quote; when the quote changes, dependents are notified to recompute (reactive market data).
- **Term structure** — a curve/surface object (yield curve, vol surface) supplying market data to engines.
- **Market data separation** — curves and vols live outside instruments so the book can be revalued under new market states.

**Why interviewers ask this**

"Design the class hierarchy for a pricing library" is one of the most common quant-dev design questions, because it reveals whether you can build something that *survives contact with a real trading desk* — new products weekly, new models, whole-book revaluation under stressed markets. A junior answer puts a `price()` method on each instrument and hard-codes Black-Scholes; it works for one product and calcifies immediately. A senior answer separates instrument from engine (so a new model is a new engine class), separates market data from instruments (so risk can shock a curve and reprice), and reaches for Visitor when operations proliferate across a fixed type set. Interviewers also probe the tradeoff with the templates topic: *when* do you accept virtual dispatch for flexibility (a mixed book, priced once per revaluation) versus template it away (a single hot inner loop)? Naming the real library (QuantLib) and its Instrument/Engine/Handle structure is a strong signal.

**Common confusions**

- "The instrument should know how to price itself" — that couples product to model; you then cannot add a new numerical method without editing every product. Delegate to an engine.
- "Strategy and Visitor are interchangeable" — Strategy swaps *how one operation* (pricing) is done; Visitor adds *new operations* across many types. Different axes.
- "Factory is over-engineering" — for a library loading trades from a feed with a type tag, a factory is exactly right; you cannot `new` a type known only as a string otherwise.
- "Market data can live on the instrument" — then you cannot revalue the book under a shocked curve, which is the entire point of a risk system. Curves are shared, handle-referenced objects.
- "Everything should be `virtual` for flexibility" — flexibility has a cost (vtable, no inlining); the hot inner loop of an engine should still be templated/CRTP. OO at the book level, templates in the kernel.

**What follows from this topic**

The PricingEngine Strategy and the Handle/Observer pattern are the heart of the QuantLib deep-dive. The tension with the templates topic is the recurring theme: OO polymorphism for the heterogeneous, dynamic *book*; template/CRTP monomorphisation for the homogeneous, hot *kernel* inside an engine. Separating market data foreshadows term-structure bootstrapping and calibration. The Payoff object reappears as the template policy in the Monte Carlo engine. Getting these boundaries right is what lets a pricing library grow for a decade without rotting.

### Q1. Design the core class hierarchy for a pricing library. What are the key abstractions?

Three orthogonal abstractions: **Instrument** (the trade — passive data), **Payoff** (what it pays), and **PricingEngine** (how to value it — Strategy). The instrument holds a payoff and delegates `NPV()` to an injected engine, so the same instrument prices via different models by swapping engines.

```cpp
struct PricingEngine;   // forward

struct Instrument {
    virtual ~Instrument() = default;
    virtual double NPV() const = 0;
    void setEngine(std::shared_ptr<PricingEngine> e) { engine_ = std::move(e); }
protected:
    std::shared_ptr<PricingEngine> engine_;
};

struct Payoff {
    virtual ~Payoff() = default;
    virtual double operator()(double S) const = 0;
};
struct PlainVanillaPayoff : Payoff {
    enum Type { Call, Put } type; double K;
    double operator()(double S) const override {
        return type == Call ? std::max(S - K, 0.0) : std::max(K - S, 0.0);
    }
};

struct PricingEngine { virtual ~PricingEngine() = default; virtual double calculate() const = 0; };

class EuropeanOption : public Instrument {
    std::shared_ptr<Payoff> payoff_; double expiry_;
public:
    EuropeanOption(std::shared_ptr<Payoff> p, double T) : payoff_(std::move(p)), expiry_(T) {}
    double NPV() const override { return engine_->calculate(); }   // delegates to Strategy
    const Payoff& payoff() const { return *payoff_; }
    double expiry() const { return expiry_; }
};
```

The key property: to add a new valuation method you add a new `PricingEngine` subclass; to add a new product you add a new `Instrument`. Neither change touches existing code — the open/closed principle in action.

### Q2. Why is the PricingEngine a separate object rather than a method on the instrument? (Strategy pattern)

Because *what a trade is* and *how you value it* vary independently, and coupling them calcifies the library. A `EuropeanOption` can be valued analytically (Black-Scholes), on a binomial tree, or by Monte Carlo — same instrument, three algorithms. The Strategy pattern makes the algorithm a swappable object.

```cpp
class AnalyticEuropeanEngine : public PricingEngine {
    const EuropeanOption& opt_; MarketData mkt_;
public:
    AnalyticEuropeanEngine(const EuropeanOption& o, MarketData m) : opt_(o), mkt_(m) {}
    double calculate() const override {
        // Black-Scholes: C = S*N(d1) - K*exp(-r*T)*N(d2)
        double S = mkt_.spot, K = /*from payoff*/ 0, r = mkt_.r, sig = mkt_.vol, T = opt_.expiry();
        double d1 = (std::log(S/K) + (r + 0.5*sig*sig)*T) / (sig*std::sqrt(T));
        double d2 = d1 - sig*std::sqrt(T);
        return S*N(d1) - K*std::exp(-r*T)*N(d2);
    }
};
class MonteCarloEngine : public PricingEngine { /* simulate paths, average payoff */ };
```

Swap `AnalyticEuropeanEngine` for `MonteCarloEngine` and the option reprices with no change to `EuropeanOption`. Had `price()` lived on the instrument with Black-Scholes hard-coded, adding Monte Carlo would mean editing the product class — and every other product too. Strategy keeps the two axes orthogonal.

### Q3. How does the same instrument get priced by analytic, tree, and Monte Carlo engines? Show the wiring.

The instrument holds a `PricingEngine*` and calls it; the client picks which concrete engine to inject. Same option object, three prices, one line changed.

```cpp
auto payoff = std::make_shared<PlainVanillaPayoff>(PlainVanillaPayoff::Call, 100.0);
auto option = std::make_shared<EuropeanOption>(payoff, /*T=*/1.0);
MarketData mkt{ .spot = 100, .r = 0.05, .vol = 0.2 };

option->setEngine(std::make_shared<AnalyticEuropeanEngine>(*option, mkt));
double bs  = option->NPV();

option->setEngine(std::make_shared<BinomialEngine>(*option, mkt, /*steps=*/500));
double tree = option->NPV();

option->setEngine(std::make_shared<MonteCarloEngine>(*option, mkt, /*paths=*/1'000'000));
double mc  = option->NPV();
// bs, tree, mc should agree to within tree/MC error — a great sanity test.
```

Cross-checking the three against each other is a standard library test: analytic is the reference, the tree should converge to it as steps grow, and MC should agree within its standard error. This is also why the design matters — it makes such consistency tests trivial to write.

### Q4. Design a class hierarchy for options: European, American, Asian, Barrier. Where does the variation live?

Variation lives on two axes: the **payoff** (what it pays — vanilla, Asian average, barrier knock-out) and the **exercise/engine** (European vs American exercise, path-dependent vs not). Keep the instrument thin and push differences into payoff objects and engine choice rather than a deep inheritance tree of one class per (product x method) combination.

```cpp
struct Exercise { virtual ~Exercise() = default; virtual bool isAmerican() const = 0; };
struct EuropeanExercise : Exercise { double T; bool isAmerican() const override { return false; } };
struct AmericanExercise : Exercise { double T; bool isAmerican() const override { return true; } };

class Option : public Instrument {
    std::shared_ptr<Payoff> payoff_;
    std::shared_ptr<Exercise> exercise_;
public:
    Option(std::shared_ptr<Payoff> p, std::shared_ptr<Exercise> e)
        : payoff_(std::move(p)), exercise_(std::move(e)) {}
    double NPV() const override { return engine_->calculate(); }
    const Payoff& payoff() const { return *payoff_; }
    const Exercise& exercise() const { return *exercise_; }
};
// Asian/Barrier = different Payoff (path-dependent) + an engine that feeds it the full path.
// American = AmericanExercise + a tree/LSM engine that handles early exercise.
```

A common junior mistake is one class per product *and* method (`AmericanBarrierMonteCarloOption`), which explodes combinatorially. Composition — payoff x exercise x engine — keeps it linear: a new payoff is one class, a new exercise one class, a new method one engine.

### Q5. What is the Visitor pattern and why is it useful across instrument types?

Visitor externalises an *operation* over a fixed set of instrument types. Each instrument implements `accept(Visitor&)`, which calls back `visit(ConcreteType&)` — double dispatch. This lets you add new operations (pricing, cashflow reporting, regulatory capital) *without editing the instrument classes*, at the cost of making it harder to add new instrument types.

```cpp
struct Bond; struct Swap; struct Option;
struct InstrumentVisitor {
    virtual void visit(Bond&) = 0;
    virtual void visit(Swap&) = 0;
    virtual void visit(Option&) = 0;
    virtual ~InstrumentVisitor() = default;
};
struct Visitable { virtual void accept(InstrumentVisitor&) = 0; virtual ~Visitable() = default; };
struct Bond : Visitable { void accept(InstrumentVisitor& v) override { v.visit(*this); } };
struct Swap : Visitable { void accept(InstrumentVisitor& v) override { v.visit(*this); } };

struct CashflowReport : InstrumentVisitor {   // a NEW operation, zero edits to Bond/Swap
    void visit(Bond& b) override  { /* schedule coupons */ }
    void visit(Swap& s) override  { /* fixed vs float legs */ }
    void visit(Option&) override  { /* no cashflows until exercise */ }
};
```

Use Visitor when your *type set is stable* but *operations keep growing* (reporting, risk, serialization). If instead you add new instrument types constantly but operations are few, Visitor is the wrong trade — every new type forces editing every visitor. That is the classic "expression problem" tradeoff.

### Q6. When is Visitor the wrong choice? (The expression problem)

Visitor makes adding *operations* cheap but adding *types* expensive: every new instrument forces a new `visit` overload in *every* visitor. So Visitor is wrong when the instrument set churns faster than the operation set — e.g. a desk onboarding exotic products weekly. In that case prefer a `virtual` method on the instrument (adding a type is one self-contained class) even though adding an operation then touches every instrument. This is the *expression problem*: no single dispatch mechanism makes both axes cheap.

| | `virtual` method on type | Visitor |
|---|---|---|
| Add a new type | Cheap (one class) | Expensive (edit every visitor) |
| Add a new operation | Expensive (edit every type) | Cheap (one visitor) |
| Best when | Types churn | Operations churn |

Practical rule for pricing libraries: core valuation (`NPV`) stays a virtual on the instrument because it is intrinsic; cross-cutting reports (cashflows, risk buckets, XML export) that multiply over time go through Visitor.

### Q7. Design a Factory for constructing instruments from a trade feed. Why not just `new`?

Because the feed gives you a *type tag* (a string like "EUROPEAN_CALL"), and you cannot `new` a type known only at runtime. A factory maps the tag to a constructor, centralising the switch so adding a product touches one registration, not every call site.

```cpp
class InstrumentFactory {
    using Builder = std::function<std::shared_ptr<Instrument>(const TradeRecord&)>;
    std::unordered_map<std::string, Builder> builders_;
public:
    void registerType(const std::string& tag, Builder b) { builders_[tag] = std::move(b); }
    std::shared_ptr<Instrument> create(const TradeRecord& rec) const {
        auto it = builders_.find(rec.type);
        if (it == builders_.end()) throw std::runtime_error("unknown type: " + rec.type);
        return it->second(rec);
    }
};
// Registration (once, e.g. at startup):
factory.registerType("EUROPEAN_CALL", [](const TradeRecord& r) {
    return std::make_shared<EuropeanOption>(
        std::make_shared<PlainVanillaPayoff>(PlainVanillaPayoff::Call, r.strike), r.expiry);
});
```

The registry form (map of tag to builder lambda) beats a hard-coded `if/else if` switch: new products self-register, the factory itself never changes, and you can plug in products from separate modules. This is exactly how a library ingests a heterogeneous trade blotter into typed instrument objects.

### Q8. How does the Decorator pattern apply — e.g. wrapping an engine to add discounting or logging?

Decorator wraps an object in another with the *same interface*, adding behaviour transparently. For pricing you can wrap a `PricingEngine` to add discounting to a settlement date, collateral adjustment, logging, or caching — the client still sees a `PricingEngine` and is unaware of the layers.

```cpp
class LoggingEngine : public PricingEngine {          // Decorator
    std::shared_ptr<PricingEngine> inner_;
public:
    explicit LoggingEngine(std::shared_ptr<PricingEngine> e) : inner_(std::move(e)) {}
    double calculate() const override {
        auto t0 = std::chrono::steady_clock::now();
        double v = inner_->calculate();               // delegate
        auto us = std::chrono::duration_cast<std::chrono::microseconds>(
                      std::chrono::steady_clock::now() - t0).count();
        std::clog << "priced in " << us << "us -> " << v << '\n';
        return v;
    }
};
class DiscountingEngine : public PricingEngine {      // another Decorator
    std::shared_ptr<PricingEngine> inner_; double df_;
public:
    DiscountingEngine(std::shared_ptr<PricingEngine> e, double df) : inner_(std::move(e)), df_(df) {}
    double calculate() const override { return df_ * inner_->calculate(); }
};
// Compose: DiscountingEngine{ LoggingEngine{ AnalyticEuropeanEngine{...} }, 0.98 }
```

Decorators compose in any order and each is a small, testable class. Contrast with subclassing every combination (`LoggingDiscountingAnalyticEngine`) — Decorator turns a combinatorial explosion of subclasses into a linear set of wrappers you stack at runtime.

### Q9. Why separate market data (curves, vols) from instruments? How is it wired?

Because a risk system's whole job is to revalue the *same book* under *different market states* — shock a curve, bump a vol surface, reprice everything. If market data lived on instruments, you could not do that without rebuilding every trade. So curves and surfaces are shared objects the engine references (through handles), and the instrument holds only its own terms.

```cpp
struct YieldCurve  { virtual double discount(double t) const = 0; virtual ~YieldCurve() = default; };
struct VolSurface  { virtual double vol(double K, double T) const = 0; virtual ~VolSurface() = default; };

struct MarketContext {                    // shared, swappable market state
    std::shared_ptr<YieldCurve> curve;
    std::shared_ptr<VolSurface> vols;
    double spot;
};
class AnalyticEngine : public PricingEngine {
    const Option& opt_;
    std::shared_ptr<MarketContext> mkt_;  // references market data, does not own the trade's copy
public:
    double calculate() const override {
        double r  = -std::log(mkt_->curve->discount(opt_.expiry())) / opt_.expiry();
        double sig = mkt_->vols->vol(/*K*/100, opt_.expiry());
        /* Black-Scholes with r, sig, mkt_->spot ... */ return 0.0;
    }
};
// Risk: clone MarketContext with a shocked curve, re-run NPV over the whole book.
```

This separation is what makes scenario analysis, Greeks by curve bump, and end-of-day revaluation possible. It also foreshadows the Observer/Handle pattern: when a live quote updates the shared curve, dependent instruments are notified to recompute.

### Q10. How is QuantLib structured at a high level, and what can you borrow from it?

QuantLib is built on exactly this decomposition: **Instrument** (base of all tradeables) delegates to a **PricingEngine** (Strategy); market data lives in **term structures** (`YieldTermStructure`, `BlackVolTermStructure`) reached through **Handles** (`Handle<Quote>`) that participate in an **Observer/Observable** graph, so a quote change lazily invalidates and recomputes dependents. Construction goes through builder-like helpers; dates/calendars/day-counters are first-class value types.

Borrow four ideas: (1) **Instrument delegates to Engine** — never hard-code a model in a product. (2) **Handle + Observer** — market data is reactive; changing a `Quote` marks dependents dirty and they recompute lazily on next `NPV()`. (3) **Term structures as objects** — a yield curve is a first-class type you bootstrap from market instruments, not a bag of numbers. (4) **Value-type date/calendar/day-count machinery** — the boring, bug-prone conventions get real types so you cannot mix an Actual/360 rate with a 30/360 one by accident.

```cpp
// QuantLib-flavoured shape (illustrative):
// Handle<Quote> spot(...);                 // observable market datum
// Handle<YieldTermStructure> curve(...);   // reacts to quote changes
// ext::shared_ptr<Instrument> option = ...;
// option->setPricingEngine(engine);        // Strategy injection
// Real npv = option->NPV();                // lazy recalculation through the observer graph
```

The lesson: QuantLib is a masterclass in keeping instrument, engine, and market data orthogonal, plus reactive recomputation via Observer. Even if you never use it, its structure is the reference design.

### Q11. Implement the Observer/Observable pattern for reactive market data (a Handle over a Quote).

The pattern: a **Quote** is Observable; when its value changes it notifies registered **Observers** (instruments/curves), which mark themselves dirty and recompute lazily on next query. This is how a library keeps a whole dependency graph consistent as live prices tick.

```cpp
class Observer;
class Observable {
    std::vector<Observer*> observers_;
public:
    void registerObserver(Observer* o) { observers_.push_back(o); }
    void notifyObservers();               // defined after Observer
    virtual ~Observable() = default;
};
class Observer {
public:
    virtual void update() = 0;            // called when an Observable changes
    virtual ~Observer() = default;
};
inline void Observable::notifyObservers() { for (auto* o : observers_) o->update(); }

class Quote : public Observable {
    double value_;
public:
    explicit Quote(double v) : value_(v) {}
    double value() const { return value_; }
    void setValue(double v) { value_ = v; notifyObservers(); }   // ticks -> notify
};
class DiscountedInstrument : public Observer {
    Quote& spot_; bool dirty_ = true; double cachedNPV_ = 0.0;
public:
    explicit DiscountedInstrument(Quote& q) : spot_(q) { q.registerObserver(this); }
    void update() override { dirty_ = true; }                   // lazy: just mark dirty
    double NPV() {
        if (dirty_) { cachedNPV_ = spot_.value() * 0.98; dirty_ = false; }  // recompute once
        return cachedNPV_;
    }
};
```

The key is **lazy** recomputation: `update()` only sets a dirty flag; the expensive recalculation happens on the next `NPV()`, so a burst of quote ticks does not trigger a burst of repricings. This is exactly QuantLib's `LazyObject` behaviour and the backbone of its reactive market-data graph.

### Q12. Spot the design smell: an `Option` class with a giant `price()` switch on model type.

```cpp
double Option::price(const std::string& model) const {
    if (model == "BS")        return blackScholes();
    else if (model == "TREE") return binomial(500);
    else if (model == "MC")   return monteCarlo(1'000'000);
    else throw std::runtime_error("unknown model");
}
```

Two smells. (1) **The instrument knows every model** — adding a new method (e.g. finite-difference PDE) means editing `Option`, and *every other product* that has the same switch. That violates open/closed and guarantees merge conflicts as the desk grows. (2) **Stringly-typed dispatch** — `"MC"` is unchecked; a typo is a runtime throw, not a compile error. The fix is the Strategy pattern: pull each branch into a `PricingEngine` subclass and inject it.

```cpp
// Fixed: instrument delegates; models are separate, self-contained engine classes.
double Option::NPV() const { return engine_->calculate(); }
// new model = new PricingEngine subclass; Option never changes again.
```

The heuristic: a `switch`/`if-else` on a type/model string that you expect to grow is almost always a missing polymorphic hierarchy. Replace it with Strategy (for "how to do one thing") or a Factory (for "which object to build").

### Q13. Where do you use runtime polymorphism vs templates in a pricing library?

Split by axis of variation. Use **runtime polymorphism** (`virtual`, Strategy, Visitor) at the *book/portfolio* level, where the type set is heterogeneous, dynamic, and each object is priced relatively few times per revaluation — the vtable cost is negligible against the valuation work. Use **templates/CRTP** inside the *engine kernel* — the Monte Carlo path loop, the PDE stencil — where one known type is evaluated millions of times and inlining/vectorisation dominate.

| Layer | Mechanism | Why |
|---|---|---|
| Portfolio of instruments | `virtual` (`vector<shared_ptr<Instrument>>`) | Heterogeneous, dynamic, cold relative to inner loop |
| Engine selection | Strategy (`virtual`) | Swap model at runtime; called once per NPV |
| MC path inner loop | Template / CRTP | Homogeneous, billions of calls, must inline |
| Payoff in that loop | Template policy | Inline `max(S-K,0)`, vectorise |

So a single library uses *both*: `virtual` where you value a mixed book once, templates where you grind one kernel a billion times. Choosing the wrong one either calcifies the design (templates at the book level — cannot hold mixed trades) or tanks performance (`virtual` in the path loop — no inlining). This is the central design judgement quant interviewers probe.

### Q14. Design the interface for a yield curve / term structure. What operations must it expose?

A yield curve must answer *discount factor* and *rate* queries at arbitrary times by interpolating its internal knots, and (crucially) be an **Observable** so dependents recompute when it is rebuilt. Keep the interface small and let concrete curves differ in interpolation and construction.

```cpp
class YieldTermStructure : public Observable {
public:
    virtual double discount(double t) const = 0;                    // P(0,t)
    double zeroRate(double t) const {                               // continuously compounded
        return t > 0 ? -std::log(discount(t)) / t : instantaneousRate();
    }
    double forwardRate(double t1, double t2) const {                // f(t1,t2)
        return (std::log(discount(t1)) - std::log(discount(t2))) / (t2 - t1);
    }
    virtual double instantaneousRate() const = 0;
    virtual ~YieldTermStructure() = default;
};

class InterpolatedCurve : public YieldTermStructure {
    std::vector<double> times_, logDf_;     // knots; interpolate log-discounts (keeps DF>0)
public:
    double discount(double t) const override {
        // linear-on-log-discount interpolation; clamp/extrapolate at the ends
        auto it = std::lower_bound(times_.begin(), times_.end(), t);
        /* interpolate logDf_ between neighbours, return exp(...) */ return 0.0;
    }
    double instantaneousRate() const override { return -/*slope of logDf at 0*/ 0.0; }
};
```

Two design points: interpolate on *log* discount factors (guarantees positive discount factors and smooth forwards), and expose `discount` as the single primitive with `zeroRate`/`forwardRate` derived from it, so all rate conventions stay consistent. Being Observable lets a rebuild (after a market move) invalidate every instrument that reads the curve.

### Q15. How do you design for testability — golden values, put-call parity, engine cross-checks?

Bake three kinds of tests into the design, made possible by the orthogonal structure. (1) **Golden/reference values** — pin known analytic results (a specific Black-Scholes call price) and assert within a tolerance, never exact float equality. (2) **Property tests** — invariants that must hold regardless of inputs, chiefly **put-call parity**: C - P = S - K*exp(-r*T). (3) **Engine cross-checks** — price the same instrument with analytic, tree, and MC engines and assert they agree (tree/MC within their error), which the Strategy design makes trivial.

```cpp
TEST(Pricing, PutCallParity) {
    MarketData m{ .spot = 100, .r = 0.05, .vol = 0.2 };
    double T = 1.0, K = 100.0;
    double C = price(Call, K, T, m), P = price(Put, K, T, m);
    // C - P == S - K*exp(-r*T)
    EXPECT_NEAR(C - P, m.spot - K * std::exp(-m.r * T), 1e-9);
}
TEST(Pricing, EnginesAgree) {
    double bs = analyticPrice(), tree = binomialPrice(1000), mc = mcPrice(1'000'000, /*se*/&se);
    EXPECT_NEAR(bs, tree, 1e-3);          // tree convergence tolerance
    EXPECT_NEAR(bs, mc, 3 * se);          // within 3 standard errors
}
```

Testability *is* a design property here: because instrument, engine, and market data are separate, you can hold two fixed and vary the third. Parity tests catch sign and discounting bugs; cross-checks catch model bugs; golden values catch regressions. Tolerances, not `==`, because these are floating-point computations.

### Q16. Design a complete instrument-engine skeleton for a European option priced by Black-Scholes and by Monte Carlo.

Bringing the topic together: a thin `EuropeanOption` holding a payoff and expiry, delegating to an injected `PricingEngine`, with two concrete engines sharing the same market data. This is the canonical skeleton an interviewer wants to see.

```cpp
struct MarketData { double spot, r, vol; };

class EuropeanOption;
struct PricingEngine {
    virtual double calculate(const EuropeanOption&, const MarketData&) const = 0;
    virtual ~PricingEngine() = default;
};

class EuropeanOption {
    bool isCall_; double K_, T_;
    std::shared_ptr<PricingEngine> engine_;
public:
    EuropeanOption(bool isCall, double K, double T) : isCall_(isCall), K_(K), T_(T) {}
    void setEngine(std::shared_ptr<PricingEngine> e) { engine_ = std::move(e); }
    double payoff(double S) const {
        return isCall_ ? std::max(S - K_, 0.0) : std::max(K_ - S, 0.0);
    }
    double strike() const { return K_; } double expiry() const { return T_; }
    bool isCall() const { return isCall_; }
    double NPV(const MarketData& m) const { return engine_->calculate(*this, m); }
};

struct AnalyticBSEngine : PricingEngine {
    double calculate(const EuropeanOption& o, const MarketData& m) const override {
        double S = m.spot, K = o.strike(), r = m.r, sig = m.vol, T = o.expiry();
        double d1 = (std::log(S/K) + (r + 0.5*sig*sig)*T) / (sig*std::sqrt(T));
        double d2 = d1 - sig*std::sqrt(T);
        auto N = [](double x){ return 0.5 * std::erfc(-x / std::sqrt(2.0)); };  // standard normal CDF
        double call = S*N(d1) - K*std::exp(-r*T)*N(d2);
        return o.isCall() ? call : call - S + K*std::exp(-r*T);   // parity for the put
    }
};

struct MonteCarloEngine : PricingEngine {
    int paths; std::uint64_t seed;
    MonteCarloEngine(int p, std::uint64_t s) : paths(p), seed(s) {}
    double calculate(const EuropeanOption& o, const MarketData& m) const override {
        std::mt19937_64 rng(seed);
        std::normal_distribution<double> Z;
        double drift = (m.r - 0.5*m.vol*m.vol)*o.expiry(), vol = m.vol*std::sqrt(o.expiry());
        double sum = 0.0;
        for (int i = 0; i < paths; ++i)
            sum += o.payoff(m.spot * std::exp(drift + vol * Z(rng)));
        return std::exp(-m.r*o.expiry()) * (sum / paths);
    }
};
// Usage: opt.setEngine(make_shared<AnalyticBSEngine>()); double a = opt.NPV(m);
//        opt.setEngine(make_shared<MonteCarloEngine>(1'000'000, 42)); double b = opt.NPV(m);
```

This skeleton shows every principle at once: the instrument is passive and model-agnostic, engines are interchangeable Strategies, market data is passed in (not owned), and the two engines can be cross-checked against each other. Adding a binomial tree is one more `PricingEngine` subclass; adding a barrier option is a new instrument with a path-aware engine — neither disturbs what already works.

## STL & Standard Algorithms for Quant Code

### Summary

**What this topic covers**

The Standard Template Library through a quant-performance lens: which container to reach for on numeric data, and which standard algorithms replace hand-written loops with correct, optimisable, and parallelisable code. This topic has 16 questions. Two concern areas: (1) **containers** — `vector` as the default contiguous workhorse, fixed-size `array`, the often-forgotten `valarray` for elementwise math, and *when `map`/`unordered_map` quietly cost you* through pointer-chasing and cache misses; plus `reserve()` to kill reallocation and the times a raw contiguous buffer beats any container on the hot path. (2) **algorithms** — `<numeric>` (`accumulate`, `inner_product`, **`transform_reduce`** — the ideal Monte Carlo payoff aggregator, and parallelisable, `partial_sum`, `iota`), `<algorithm>` (sort/partition/nth_element for VaR and percentiles), and C++20 **`std::ranges`** views for lazy numeric pipelines that fuse without temporaries. The through-line: prefer contiguous memory and standard algorithms, because they express intent, vectorise, and give you `std::execution::par` parallelism nearly for free — while an unthinking `map` or a hand loop leaves performance on the table.

**Mental model**

Think in terms of *memory layout first, algorithm second*. On modern hardware the bottleneck for numeric code is almost never arithmetic — it is waiting on memory. A `std::vector<double>` is one contiguous block: iterating it streams cache lines and auto-vectorises. A `std::map<K,double>` is a red-black tree of separately-allocated nodes: each lookup chases pointers across the heap, blowing the cache — often 10-100x slower to traverse than a vector of the same data. So the default is *always* a contiguous container, and you only pay for a node-based or hashed structure when you genuinely need its lookup semantics. On top of that layout, express computation with *standard algorithms* rather than raw loops: `transform_reduce` says "map each path to a payoff and sum" in one call that the compiler can vectorise and you can parallelise by adding `std::execution::par`. Ranges views (C++20) let you chain `transform | filter` lazily so the whole pipeline runs in a single pass with no intermediate vectors. The mental checklist for any numeric kernel: contiguous data, `reserve` ahead, standard algorithm, parallel policy if it is hot.

**Key terms**

- **`std::vector`** — contiguous, growable; the default for prices, paths, curve knots. Streams and vectorises.
- **`std::array<T,N>`** — fixed-size, stack-allocated, no heap; ideal for small known-size vectors (a 3-factor state).
- **`std::valarray`** — numeric array with built-in elementwise `+ - * /` and slicing; niche but expressive for pointwise math.
- **`map` / `unordered_map`** — ordered tree / hash table; O(log n)/O(1) lookup but node-allocated and cache-hostile to iterate.
- **`reserve()`** — pre-allocate capacity so `push_back` never reallocates+copies mid-loop.
- **`accumulate`** — fold a range to a scalar (sum, product) with an init value and optional binary op.
- **`inner_product`** — dot product / generalised sum of products; e.g. discounted cashflows.
- **`transform_reduce`** — map-then-reduce in one pass; parallelisable; ideal for MC payoff aggregation.
- **`partial_sum` / `iota`** — running totals (cumulative distribution) / fill 0,1,2,... (path indices, time grid).
- **`nth_element` / `sort`** — partial/full ordering; `nth_element` finds a VaR percentile in O(n) without full sort.
- **`std::ranges` views** — lazy, composable adaptors (`transform`, `filter`, `take`) that fuse into one pass.
- **`std::span`** — non-owning view over a contiguous buffer; pass paths without copying.

**Why interviewers ask this**

STL fluency separates someone who *writes* C++ from someone who writes *fast, idiomatic* C++. The classic tell is the `map`: a junior reaches for `std::map<int,double>` to store per-index data that a `vector` would hold contiguously and traverse an order of magnitude faster. Interviewers ask "aggregate these million payoffs" to see if you reach for `transform_reduce` (one pass, vectorisable, `par`-parallelisable) or write a raw loop; "compute the 99% VaR" to see if you know `nth_element` beats a full `sort`; "why is this pricer allocating in its loop" to check you know `reserve`. The senior signal is *layout awareness* — knowing that container choice is really a cache-behaviour decision, that `reserve` removes reallocation stalls, and that standard algorithms are not just tidier but a gateway to free vectorisation and parallelism. It also probes modern C++: do you know ranges views fuse pipelines, and when `std::span` lets you avoid copying a big path array?

**Common confusions**

- "`map` is fine, it is only O(log n)" — the complexity hides the constant: node allocation and pointer chasing make iterating a `map` far slower than a `vector`, and cache misses dominate. Use `vector` unless you need ordered keyed lookup.
- "`reserve` and `resize` are the same" — `reserve` sets capacity without creating elements; `resize` creates elements. Reserving then `push_back` is the allocation-free idiom; `resize` then index-assign also works but default-constructs first.
- "`accumulate` on doubles is exact" — it is a left fold; order affects rounding, and the default `init` type matters (`accumulate(v.begin(), v.end(), 0)` sums doubles into an *int*).
- "algorithms are just sugar for loops" — they also unlock `std::execution::par`/`par_unseq` and are easier for the optimiser to vectorise; a raw loop with a lambda side effect may not vectorise.
- "ranges views own their data" — they are lazy, non-owning adaptors; iterating twice recomputes, and a view over a temporary dangles just like an expression template.

**What follows from this topic**

`transform_reduce` with `std::execution::par` is the bridge to the Concurrency topic's "parallelise Monte Carlo" — but only correct with per-thread RNG, so the two topics interlock. Contiguous layout here is the same lesson the Memory & Cache topic drives home with SoA-vs-AoS. `std::span` and ranges are picked up again in Modern C++. And `accumulate`'s ordering/precision caveat connects to the floating-point topic: summation order changes the answer, which is why parallel reductions can be non-reproducible. Master containers-and-algorithms and most numeric code becomes short, fast, and parallel-ready.

### Q1. Which STL container is your default for numeric data and why?

`std::vector` — contiguous storage, cache-friendly iteration, and it auto-vectorises. Prices, simulated paths, curve knots, payoff samples: all are sequences you stream through, and contiguity means each cache line brings in several useful elements and the CPU prefetcher predicts the access pattern.

```cpp
std::vector<double> payoffs;
payoffs.reserve(n_paths);              // one allocation up front
for (int i = 0; i < n_paths; ++i)
    payoffs.push_back(simulate_payoff(rng));   // never reallocates
double price = discount * std::accumulate(payoffs.begin(), payoffs.end(), 0.0) / n_paths;
```

Contrast the alternatives: `std::list` (node-per-element, cache-hostile, almost never right for numbers), `std::map`/`unordered_map` (only when you need keyed lookup), `std::deque` (contiguous in chunks, use for front-and-back queues). The reasoning that matters in an interview: numeric performance is bound by memory bandwidth and cache, and `vector`'s single contiguous block is optimal for the streaming access numeric code does. Reach elsewhere only when you need a specific access pattern `vector` cannot give.

### Q2. When do `std::array` and `std::valarray` beat `std::vector`?

**`std::array<T,N>`** wins when the size is *known at compile time and small* — a 3-factor model state, a 2x2 covariance, fixed quadrature nodes. It lives on the stack (no heap allocation, no indirection), and the fixed size lets the compiler fully unroll and vectorise.

**`std::valarray`** wins for concise *elementwise* math: it overloads `+ - * /` and math functions to operate over the whole array, with slicing/masking — closer to NumPy than `vector`.

```cpp
std::array<double, 3> state{ 100.0, 0.04, 0.2 };   // spot, var, vol — stack, no alloc

std::valarray<double> S = { 100, 101, 99, 102 };
std::valarray<double> payoff = std::max(S - 100.0, std::valarray<double>(0.0, S.size()));
double total = payoff.sum();                        // elementwise then reduce, no loop
```

Caveats: `array`'s size is part of its type, so you cannot grow it or pick size at runtime. `valarray` is expressive but under-optimised in many implementations and lacks the ecosystem support of `vector`/Eigen — for serious linear algebra use Eigen instead. Use `array` liberally for small fixed vectors; treat `valarray` as a readable niche for pointwise arithmetic.

### Q3. Why can `std::map` quietly kill performance in numeric code? What is the fix?

Because `std::map` is a red-black tree of *individually heap-allocated nodes*, scattered across memory. Every lookup or traversal chases pointers, and each hop is likely a cache miss — so iterating a `map<int,double>` can be 10-100x slower than a `vector<double>` holding the same values, even though both are "linear". `unordered_map` is better for lookup (O(1) average) but still node-allocated and cache-hostile to iterate, with hashing overhead.

```cpp
// Slow: keyed by contiguous integer index -> tree nodes scattered on the heap.
std::map<int, double> discountFactors;              // idx -> DF

// Fast: the key IS the index, so use a vector — contiguous, cache-friendly.
std::vector<double> discountFactors(n);             // discountFactors[idx]
```

The fix is almost always: if keys are dense integers (indices, time-grid points), use a `vector` and index directly. Reserve `map`/`unordered_map` for genuinely sparse or non-integer keys (a curve keyed by currency string). If you need sorted key lookup over dense data, a *sorted `vector` of pairs* with `std::lower_bound` beats `map` on both cache behaviour and memory. The interview point: container choice is a cache decision, and `map` is a common accidental performance sink.

### Q4. What does `reserve()` do and why is it critical in a Monte Carlo loop?

`reserve(n)` pre-allocates capacity for `n` elements without constructing them, so subsequent `push_back` calls never trigger a reallocation. Without it, a `vector` grows geometrically: as it fills, it allocates a bigger block, *copies/moves every existing element*, and frees the old — repeatedly, mid-loop. For a million-path simulation that is a string of allocation stalls and O(n) copies.

```cpp
std::vector<double> payoffs;
payoffs.reserve(n_paths);          // ONE allocation; capacity fixed
for (int i = 0; i < n_paths; ++i)
    payoffs.push_back(simulate(rng));   // amortised O(1), no reallocation, no copies
```

Without `reserve`, a vector doubling from 1 to 1,000,000 reallocates ~20 times and copies ~2 million elements cumulatively. With it, one allocation and zero copies. This matters even more when the element type is expensive to move, or when you are on a latency-sensitive path where a mid-loop allocation is an unacceptable stall. Rule: whenever you know (even approximately) the final size, `reserve` it. Note `reserve` only affects capacity, not `size()`; the vector is still empty until you push.

### Q5. Implement Monte Carlo payoff aggregation with `std::transform_reduce`. Why is it ideal?

`transform_reduce` maps each element through a unary op and reduces the results in one pass — exactly "turn each random draw into a discounted payoff, then average". It is a single expressive call, the compiler vectorises it, and it takes an execution policy for free parallelism.

```cpp
#include <numeric>
#include <execution>

double mc_price(const std::vector<double>& normals, double S0, double r,
                double sigma, double T, double K) {
    double drift = (r - 0.5 * sigma * sigma) * T, vol = sigma * std::sqrt(T);
    double sumPayoff = std::transform_reduce(
        std::execution::par,               // parallel reduction, one line
        normals.begin(), normals.end(),
        0.0,                               // init
        std::plus<>{},                     // reduce: sum
        [=](double z) {                    // transform: draw -> payoff
            double ST = S0 * std::exp(drift + vol * z);
            return std::max(ST - K, 0.0);
        });
    return std::exp(-r * T) * (sumPayoff / normals.size());
}
```

Why ideal: (1) it fuses map and reduce into one memory pass — no intermediate payoff vector; (2) the lambda is inlined and the loop vectorises; (3) swapping `std::execution::par` in parallelises the reduction across cores with no manual threading. One caveat carried from the floating-point topic: parallel/vectorised reduction re-associates the sum, so the result can differ in the last bits and is not bitwise reproducible across thread counts — fine for a price with a standard error, but know it.

### Q6. Compare `accumulate`, `inner_product`, and `transform_reduce` for reductions.

All three fold a range to a scalar; they differ in shape and parallelisability.

| Algorithm | Does | Parallel? | Quant use |
|---|---|---|---|
| `accumulate` | Left fold with a binary op | No (sequential, ordered) | Simple sum/product of one range |
| `inner_product` | Sum of products of *two* ranges | No | Dot product: discounted cashflows |
| `transform_reduce` | Map (1 or 2 ranges) then reduce | Yes (with policy) | MC payoff aggregation, weighted sums |

```cpp
double sum = std::accumulate(v.begin(), v.end(), 0.0);                    // sum of payoffs
double pv  = std::inner_product(cf.begin(), cf.end(), df.begin(), 0.0);   // sum cf[i]*df[i]
double pv2 = std::transform_reduce(std::execution::par,                   // same, parallel
              cf.begin(), cf.end(), df.begin(), 0.0);                     // (2-range overload)
```

Key gotchas: `accumulate` is strictly sequential and ordered (so reproducible but not parallel), and its `init` type dictates the accumulator — pass `0.0` not `0` for doubles or you truncate to int. `transform_reduce` is the modern default when you want parallelism or a map step; it assumes the reduction is associative/commutative, which is why it may reorder and lose bitwise reproducibility. For present value of cashflows, `inner_product`/`transform_reduce` over cashflows and discount factors is the idiomatic one-liner.

### Q7. Show `partial_sum` and `iota` in quant code (cumulative distribution, time grid).

`std::iota` fills a range with sequentially increasing values (`0,1,2,...` or a scaled grid); `std::partial_sum` produces running totals — a cumulative sum, which is exactly a discrete CDF or an accumulated cashflow schedule.

```cpp
#include <numeric>

// Time grid t_i = i*dt for a PDE / path discretisation.
std::vector<double> t(steps + 1);
std::iota(t.begin(), t.end(), 0.0);                 // 0,1,2,...,steps
for (double& ti : t) ti *= dt;                      // scale to actual times

// Build a discrete CDF from probability masses, for inverse-transform sampling.
std::vector<double> pmf = { 0.1, 0.2, 0.4, 0.2, 0.1 };
std::vector<double> cdf(pmf.size());
std::partial_sum(pmf.begin(), pmf.end(), cdf.begin());   // 0.1,0.3,0.7,0.9,1.0
// sample: draw u ~ U(0,1); index = lower_bound(cdf, u) gives the outcome.
```

`partial_sum` also builds cumulative P&L or accumulated cashflows from a per-period series in one call. `iota` is the clean way to generate index vectors, discretised time axes, or seeds `0..K-1` for per-stream RNG. Both express intent directly and avoid off-by-one bugs in hand-rolled loops. Pair `partial_sum`-built CDFs with `lower_bound` for O(log n) inverse-transform sampling of discrete distributions.

### Q8. Compute the 99% VaR of a P&L vector. Why `nth_element` over `sort`?

Value at Risk at 99% is a percentile of the loss distribution — the 1st-percentile P&L (the loss such that only 1% of outcomes are worse). You do **not** need the whole distribution sorted, only that one order statistic, so `std::nth_element` (average O(n)) beats a full `std::sort` (O(n log n)).

```cpp
#include <algorithm>

double var99(std::vector<double>& pnl) {           // pnl: simulated P&L (loss = negative)
    std::size_t k = static_cast<std::size_t>(0.01 * pnl.size());   // 1st percentile index
    std::nth_element(pnl.begin(), pnl.begin() + k, pnl.end());     // partitions around k, O(n)
    return -pnl[k];                                 // VaR reported as a positive loss
}
```

`nth_element` rearranges the vector so the element at position `k` is the one that would be there if fully sorted, with everything smaller before it — precisely the k-th order statistic, without sorting the rest. For a million-scenario P&L, that is a meaningful constant-factor and complexity win over a full sort. If you also need Expected Shortfall (the average loss *beyond* VaR), `nth_element` conveniently leaves the worse-than-VaR tail in the `[begin, begin+k)` partition, ready to average. Note it mutates the input; copy first if you must preserve order.

### Q9. What do `std::ranges` views buy you for a numeric pipeline?

Ranges views (C++20) are *lazy, non-owning* adaptors you compose with `|`; the whole pipeline runs in a *single pass* with no intermediate containers. A chain like "take the terminal spots, map to payoffs, drop the zeros" becomes one readable expression that fuses into one loop instead of building three temporary vectors.

```cpp
#include <ranges>
namespace rv = std::views;

double mc_price(const std::vector<double>& spots, double K, double discount) {
    auto payoffs = spots
                 | rv::transform([K](double S){ return std::max(S - K, 0.0); });  // lazy
    // Single pass: transform is applied element-by-element inside the reduce.
    double sum = 0.0; long n = 0;
    for (double p : payoffs) { sum += p; ++n; }
    return discount * sum / n;
}
```

The win is compositional clarity plus fusion: `spots | transform | filter | take(k)` never materialises the intermediate stages, unlike chaining `std::transform` into fresh vectors. Two caveats that echo expression templates: views are *lazy and non-owning*, so a view over a temporary dangles, and iterating a view twice recomputes (cache the result in a `vector` via `std::ranges::to` if you need it materialised). For lazy numeric pipelines over paths, ranges give NumPy-like expressiveness with zero-temporary evaluation.

### Q10. When does a raw contiguous buffer beat `std::vector` on the hot path?

Rarely, but it happens: when you must eliminate *every* overhead and control layout exactly. `std::vector` already gives contiguous storage, so the wins from a raw buffer are narrow — (1) avoiding value-initialisation of a huge buffer you will overwrite anyway, (2) fixed-lifetime scratch reused across calls without any bookkeeping, (3) precise alignment for SIMD, or (4) interop with a C/Fortran BLAS API expecting a raw pointer.

```cpp
// vector zero-initialises a million doubles you are about to overwrite -> wasted write pass.
std::vector<double> buf(n);                         // touches all n doubles first

// Aligned scratch reused across pricings, no re-init, SIMD-aligned:
alignas(64) static thread_local std::array<double, 4096> scratch;   // fixed, reused
// or std::make_unique_for_overwrite<double[]>(n) to skip value-init (C++20).
auto raw = std::make_unique_for_overwrite<double[]>(n);             // no zeroing
```

But be honest about the tradeoff: raw buffers lose bounds safety, RAII cleanliness, and resizing. The idiomatic middle ground is `std::vector` with `reserve` + `make_unique_for_overwrite` to skip initialisation, or a reused `thread_local` scratch buffer to avoid per-call allocation. Reach for a truly raw pointer only at a measured, proven hotspot or a C-API boundary — and wrap it in a `std::span` so the rest of your code still gets a safe view.

### Q11. What is `std::span` and how does it let you pass paths without copying?

`std::span<T>` (C++20) is a non-owning *view* over a contiguous sequence — a pointer plus a length. It lets a function accept "some contiguous doubles" regardless of whether they came from a `vector`, an `array`, or a raw buffer, without copying and without templating on the container. For a million-element path array, passing a `span` is two words on the stack; passing the `vector` by value would copy the whole thing.

```cpp
#include <span>

double average_payoff(std::span<const double> terminalSpots, double K) {
    double sum = 0.0;
    for (double S : terminalSpots) sum += std::max(S - K, 0.0);   // no copy, bounds known
    return sum / terminalSpots.size();
}
// Call with any contiguous source — zero copy:
std::vector<double> paths = simulate();
average_payoff(paths, 100.0);                       // implicit vector -> span
std::array<double, 256> block; average_payoff(block, 100.0);
```

`span` gives you the size (so no separate length parameter, unlike a raw pointer) and works uniformly across containers, while making non-ownership explicit in the signature. Use `std::span<const double>` for read-only access. The one caveat: a span does not own or extend lifetime, so never return a span to a local buffer or hold one past the owner's lifetime — same dangling discipline as any view.

### Q12. Spot the bug: `std::accumulate(prices.begin(), prices.end(), 0)` on a `vector<double>`.

The `init` value `0` is an `int`, so `accumulate` deduces `int` as its accumulator type: every double is truncated and added into an integer, discarding all fractional parts and overflowing for large sums. The result is garbage — a "sum of prices" that dropped every cent.

```cpp
std::vector<double> prices = { 100.25, 99.75, 101.10 };
double wrong = std::accumulate(prices.begin(), prices.end(), 0);    // int accumulator! -> 300
double right = std::accumulate(prices.begin(), prices.end(), 0.0);  // double -> 301.10
```

The rule: the accumulator type *is* the type of the `init` argument, so it must match (or be wider than) the element type. Pass `0.0` for doubles, `0.0L` for `long double`, or an explicitly-typed zero. This is one of the most common real STL bugs in numeric code precisely because it compiles cleanly and silently corrupts results. A related, subtler point from the floating-point topic: even with the correct `0.0`, `accumulate`'s left-to-right order affects rounding, so for a huge sum of very different magnitudes consider a wider accumulator or Kahan summation.

### Q13. Build a discounted-cashflow present value with an STL algorithm.

Present value is a dot product: PV = sum over i of cashflow[i] * discountFactor[i]. That is exactly `std::inner_product` (or `transform_reduce` for the parallel version), expressing the whole calculation in one call.

```cpp
#include <numeric>

double presentValue(const std::vector<double>& cashflows,
                    const std::vector<double>& times,
                    const YieldCurve& curve) {
    // Build discount factors DF_i = curve.discount(t_i), then PV = sum cf_i * DF_i.
    std::vector<double> df(times.size());
    std::transform(times.begin(), times.end(), df.begin(),
                   [&](double t){ return curve.discount(t); });    // DF per time
    return std::inner_product(cashflows.begin(), cashflows.end(), df.begin(), 0.0);
}
```

`inner_product` folds `cf[i]*df[i]` into a running sum with the correct `0.0` accumulator. For a large schedule or to parallelise, use `std::transform_reduce(std::execution::par, cashflows.begin(), cashflows.end(), df.begin(), 0.0)` — same result, multi-core reduction. The design lesson: recognising PV, portfolio value, and weighted averages as dot products lets you use one tested standard algorithm instead of an error-prone hand loop, and get vectorisation and parallelism as a bonus.

### Q14. How do you fill a vector with correlated normals using STL + Cholesky? Where do the algorithms fit?

To turn independent standard normals Z into correlated ones X with covariance Sigma, factor Sigma = L*L^T (Cholesky) and compute X = L*Z. In code the per-factor step X_i = sum_j L[i][j]*Z[j] is again an `inner_product` of a matrix row with the Z vector; STL handles the fill (`generate`) and the products (`inner_product`).

```cpp
#include <numeric>
#include <algorithm>

std::vector<double> correlatedNormals(const std::vector<std::vector<double>>& L,  // lower-tri
                                      std::mt19937_64& rng) {
    std::size_t n = L.size();
    std::vector<double> Z(n), X(n);
    std::normal_distribution<double> nd;
    std::generate(Z.begin(), Z.end(), [&]{ return nd(rng); });     // independent normals
    for (std::size_t i = 0; i < n; ++i)                            // X = L * Z
        X[i] = std::inner_product(L[i].begin(), L[i].begin() + i + 1, Z.begin(), 0.0);
    return X;
}
```

`std::generate` fills the independent-normal vector; `std::inner_product` computes each correlated component as the dot of a Cholesky row with Z (only the first `i+1` entries, since L is lower-triangular). This is the core primitive for multi-asset Monte Carlo — every path needs a fresh correlated normal draw. In production you would use Eigen's `LLT` decomposition and its matrix-vector product (expression templates, SIMD), but the STL version shows exactly where each algorithm slots into the maths.

### Q15. Which STL algorithms parallelise, and what breaks when you add `std::execution::par`?

Most `<algorithm>` and `<numeric>` algorithms took execution-policy overloads in C++17: `for_each`, `transform`, `reduce`, `transform_reduce`, `sort`, `inner_product`(as reduce), etc. Passing `std::execution::par` runs them across threads; `par_unseq` also allows vectorisation/interleaving. Two things break if you are careless.

```cpp
// (1) Data races: a lambda with shared mutable state under par is UB.
double sum = 0.0;
std::for_each(std::execution::par, v.begin(), v.end(),
              [&](double x){ sum += x; });          // RACE — do NOT do this
double ok = std::reduce(std::execution::par, v.begin(), v.end(), 0.0);  // correct parallel sum

// (2) Non-reproducibility: parallel reduce re-associates float addition ->
//     result differs in the low bits across runs/thread counts.
```

Rules: (1) the per-element work must be independent and side-effect-free — never accumulate into a shared variable inside a `par` lambda; use a reduction algorithm (`reduce`/`transform_reduce`) instead. (2) Parallel and vectorised reductions reorder floating-point addition, which is not associative, so the answer can vary in the last bits — acceptable for a Monte Carlo price with a standard error, but a problem if you need bitwise-reproducible results (fix by reducing per-block in a fixed order). (3) `par_unseq` forbids any synchronisation (no mutexes/allocation) in the callable. Also note `reduce` (unordered) vs `accumulate` (strictly ordered, sequential): only `reduce` parallelises.

### Q16. Design the container and algorithm choices for a full Monte Carlo pricer. Justify each.

Put the layout and algorithm decisions together for a vanilla MC pricer, justifying each choice on cache/performance grounds.

```cpp
#include <numeric>
#include <execution>
#include <random>

double mc_price(double S0, double r, double sigma, double T, double K,
                std::size_t nPaths, std::uint64_t seed) {
    const double drift = (r - 0.5 * sigma * sigma) * T;
    const double vol   = sigma * std::sqrt(T);

    // 1. Draws in a contiguous vector, reserved once. (vector = cache-friendly, no realloc.)
    std::vector<double> Z(nPaths);
    std::mt19937_64 eng(seed);
    std::normal_distribution<double> nd;
    std::generate(Z.begin(), Z.end(), [&]{ return nd(eng); });   // fill independent normals

    // 2. Map each draw to a discounted payoff and reduce in ONE parallel pass.
    double sumPayoff = std::transform_reduce(
        std::execution::par_unseq,          // parallel + vectorised
        Z.begin(), Z.end(), 0.0, std::plus<>{},
        [=](double z){ return std::max(S0 * std::exp(drift + vol * z) - K, 0.0); });

    return std::exp(-r * T) * (sumPayoff / nPaths);
}
```

Justification: (1) **`std::vector` reserved to `nPaths`** — contiguous, one allocation, streams and vectorises; a `map`/`list` here would be a cache disaster. (2) **`std::generate`** to fill draws expresses intent and stays sequential where the RNG requires ordering (a single engine cannot be shared across threads — for true parallel RNG you would draw per-thread, see the Concurrency topic). (3) **`transform_reduce` with `par_unseq`** fuses payoff-mapping and summation into one memory pass, vectorises the `exp`/`max`, and reduces across cores — no intermediate payoff vector. (4) Report the **standard error** alongside (sqrt(var/n)) using a second `transform_reduce` for the sum of squares. The one caveat carried through the whole topic: the parallel reduction re-associates the float sum, so it is not bitwise reproducible — fine given the Monte Carlo error bar, but know it, and if you need reproducibility, reduce per-block in a fixed order with per-block seeded engines.
## Memory Management & Cache Performance

### Summary

**What this topic covers**

The single most important lever for numeric performance in a pricing library, and the one interviewers use to separate people who *have* profiled a hot loop from people who quote Big-O. Three concern areas live here: (1) **where objects live** — stack (fast, RAII, no allocator call) vs heap (a `malloc`/`free` round-trip, pointer chasing, fragmentation); (2) **how the CPU actually fetches data** — cache lines, spatial and temporal locality, and why a cache miss (~200 cycles) dwarfs an arithmetic op (~1 cycle); and (3) **data layout as a design decision** — struct-of-arrays vs array-of-structs, avoiding allocation on the hot path, custom pools and arenas, and false sharing between threads. The 16 questions here all circle one lesson: on modern hardware, *memory layout, not FLOP count, usually dominates numeric performance*. A Monte Carlo pricer that's memory-bound doesn't get faster by reducing multiplies; it gets faster by feeding the cache.

**Mental model**

Picture the memory hierarchy as a set of nested desks. Registers are what's in your hand; L1 (~32KB, ~4 cycles) is the desk surface; L2 (~256KB-1MB) is the drawer; L3 (~tens of MB, ~40 cycles) is the shared filing cabinet; DRAM (~100-300 cycles) is the warehouse across the street. The CPU never fetches one number — it fetches a whole **cache line of 64 bytes** (eight doubles) around the address you touched. So the game is: once a line is on your desk, use *everything* on it before it gets evicted. Sequential access over a contiguous `std::vector<double>` reads each line once and the hardware prefetcher runs ahead of you; random access over a `std::map` or a vector of pointers pays a miss per element. This is why "the algorithm is O(n) either way" is the wrong frame: two O(n) loops can differ 10x because one streams and one thrashes. Design your data so the bytes you need next are the bytes physically next in memory.

**Key terms**

- **Cache line** — the unit of transfer between cache levels, 64 bytes on x86/ARM. Touch one byte, pay for 64.
- **Spatial locality** — accessing addresses near ones you just accessed; rewarded by cache-line prefetch.
- **Temporal locality** — reusing the same address soon; rewarded by the line still being resident.
- **Stack allocation** — bump a pointer; freed on scope exit (RAII). No allocator, no fragmentation.
- **Heap allocation** — `new`/`malloc`; a synchronized, variable-cost call that may fragment and always pointer-chases.
- **AoS (array-of-structs)** — `vector<Option>` where each element bundles all fields together.
- **SoA (struct-of-arrays)** — parallel `vector<double>` per field; vectorizes and caches better for bulk work.
- **Data-oriented design** — organize memory around the access pattern of the hot loop, not the domain model.
- **Memory pool / arena** — pre-allocate a big block and hand out slices; O(1) alloc, bulk free, no fragmentation.
- **False sharing** — two threads writing different variables that share one cache line, forcing coherence traffic.
- **Prefetching** — the CPU (or you, via `__builtin_prefetch`) pulling a line into cache before it's needed.
- **Memory-bound** — a loop limited by fetch bandwidth/latency, not by the ALU; adding FLOPs is free until you fix layout.

**Why interviewers ask this**

Because it's the fastest way to tell whether a candidate has actually made numeric C++ go fast. A junior answer talks about `-O3` and "use `reserve`." A senior answer reaches for a profiler, identifies the loop as memory-bound, restructures AoS to SoA so the vectorizer can run and each cache line is fully used, and can explain *why* that beat halving the arithmetic. On a quant desk this is money: overnight risk that runs in 3 hours instead of 9, or a pricer whose latency budget is spent in cache misses. Interviewers also probe for the failure modes — false sharing that silently kills a parallel MC scaling curve, or allocation inside the path loop that shows up as `malloc` at the top of a flamegraph. Getting these right signals you can own the performance of a library, not just its correctness.

**Common confusions**

- "It's O(n), so layout doesn't matter" — two O(n) loops routinely differ by an order of magnitude on cache behaviour alone.
- "More RAM fixes slowness" — the bottleneck is usually latency/bandwidth to cache, not capacity.
- "`shared_ptr` is fine everywhere" — its control block is a second heap allocation and the atomic refcount pointer-chases; on a hot path it's a real cost.
- "SoA is always better" — SoA wins for bulk column operations; AoS wins when you touch all fields of one object at once. Match layout to access.
- "The allocator is free" — `new` in a loop can dominate; it synchronizes, may hit the OS, and fragments.

**What follows from this topic**

This is the substrate under everything numeric. [[move-semantics]] is the mechanism for moving these big buffers without copying them. The Monte Carlo engine topic depends on reusing per-path buffers instead of allocating them. The low-latency material (CRTP, avoiding virtual dispatch, SIMD) only pays off once the data is laid out to feed it — a vtable indirection and a cache miss are the same class of problem: the CPU stalling on a fetch it couldn't predict. Concurrency inherits false sharing directly. If a pricer is slow and the algorithm is already good, the answer is almost always in this topic.

### Q1. Stack vs heap — why does a quant library prefer the stack, and when must it use the heap?

The **stack** allocates by bumping the stack pointer: allocation and deallocation are effectively free, memory is contiguous and cache-hot, and lifetime is tied to scope (RAII cleans up automatically, even on exceptions). The **heap** (`new`/`malloc`) is a call into an allocator that must find a free block, may take a lock, can fragment over time, and returns memory that is pointer-chased and often cold.

```cpp
double price_european(double S, double K, double r, double sigma, double T) {
    double d1 = (std::log(S / K) + (r + 0.5 * sigma * sigma) * T)
                / (sigma * std::sqrt(T));   // all scalars on the stack
    double d2 = d1 - sigma * std::sqrt(T);
    return S * norm_cdf(d1) - K * std::exp(-r * T) * norm_cdf(d2);
}
```

Use the heap when: the size isn't known at compile time and is large (a million-path array), the object must outlive the creating scope, or it's too big for the stack (stack is typically 1-8MB — a big matrix overflows it). Even then, prefer a container (`std::vector`) that owns the heap block via RAII over raw `new`/`delete`. The rule: **stack by default, heap when you must, and let a value type own the heap allocation for you.**

### Q2. Explain cache lines and why a 64-byte transfer unit shapes how you write numeric loops.

The CPU never loads a single `double`. It loads the entire **64-byte cache line** containing that address — eight contiguous doubles. If your next access is the next element in a `std::vector<double>`, it's already resident: seven of every eight accesses are free, and the hardware prefetcher, seeing the sequential stride, fetches the *next* line before you ask.

Contrast a random-access pattern (a `std::map<int,double>`, or a `vector<Node*>` where nodes were `new`ed separately): each element likely sits on its own line, so you pay a full miss (~100-300 cycles) per element and the prefetcher can't help.

```cpp
// Streams: one miss per 8 elements, prefetcher engaged
double sum = 0.0;
for (double x : payoffs) sum += x;              // payoffs is vector<double>

// Thrashes: one miss per element, no useful prefetch
double sum2 = 0.0;
for (Node* n : node_ptrs) sum2 += n->payoff;    // pointers into scattered heap
```

The takeaway for a pricer: keep the data you iterate over **contiguous and in the order you visit it**. A cache miss costs ~200 arithmetic ops, so a loop's speed is often set by its access pattern, not its math.

### Q3. What is data-oriented design, and why do quant developers care about it?

Data-oriented design (DOD) means you organize memory around **how the hot loop accesses data**, not around the domain model. Object-oriented design groups by "what is an option" (all its fields together); DOD groups by "what does the pricing loop stream through" (all the spots together, all the strikes together).

The motivation is the cache. If your innermost loop over a million options only reads spot and strike, an AoS layout drags the entire fat `Option` struct through cache for two fields; a SoA layout streams exactly the two arrays you need, and the vectorizer can process 4-8 lanes at once.

DOD isn't anti-OO everywhere — it's a targeted choice for the *bulk numeric core*. You keep clean objects at the API boundary (an `Option` a user constructs), then transform into flat arrays for the compute kernel. On a desk this is the difference between risk that vectorizes and risk that doesn't. See Q4 for the concrete SoA-vs-AoS layout and numbers.

### Q4. Show AoS vs SoA for pricing a batch of options and explain which the CPU prefers.

**Array-of-structs (AoS)** — the natural OO layout:

```cpp
struct Option {          // 40 bytes: 5 doubles
    double S, K, r, sigma, T;
};
std::vector<Option> book(N);

double total = 0.0;
for (const auto& o : book)                 // each iteration drags 40B through cache
    total += price_european(o.S, o.K, o.r, o.sigma, o.T);
```

**Struct-of-arrays (SoA)** — one contiguous array per field:

```cpp
struct Book {
    std::vector<double> S, K, r, sigma, T;  // each field packed tightly
};
Book book;  // book.S has N doubles back-to-back

double total = 0.0;
for (std::size_t i = 0; i < book.S.size(); ++i)
    total += price_european(book.S[i], book.K[i], book.r[i],
                            book.sigma[i], book.T[i]);
```

| | AoS `vector<Option>` | SoA `Book` |
|---|---|---|
| Access one full object | Cache-friendly (all fields on one line) | 5 separate streams |
| Bulk op over one/few fields | Wastes bandwidth on unread fields | Streams only what's used |
| Auto-vectorization (SIMD) | Hard — fields interleaved | Easy — each array is a clean lane sequence |
| Best for | Per-object logic touching all fields | Batch/columnar pricing and risk |

For a bulk pricer or a Monte Carlo kernel that sweeps arrays, **SoA wins**: each cache line is fully used and the compiler emits packed SIMD. AoS wins when you process one object at a time and touch all its fields. Match the layout to the loop.

### Q5. A colleague's Monte Carlo pricer allocates a fresh path vector inside the path loop. Why is that slow, and how do you fix it?

```cpp
// SLOW: one heap allocation + free per path, N times
for (std::size_t p = 0; p < N; ++p) {
    std::vector<double> path(steps);        // malloc every iteration
    simulate_gbm(path, S0, r, sigma, dt, rng);
    total += payoff(path);
}                                            // free every iteration
```

`std::vector`'s constructor calls the allocator and zero-initializes; the destructor frees. Doing that a million times puts `malloc`/`free` at the top of the profile, serializes threads on the allocator lock, and touches cold memory each time. The compute is fine; the *allocation* is the bottleneck.

Fix: allocate the buffer **once**, outside the loop, and reuse it:

```cpp
std::vector<double> path(steps);            // one allocation, reused
for (std::size_t p = 0; p < N; ++p) {
    simulate_gbm(path, S0, r, sigma, dt, rng);  // overwrites in place
    total += payoff(path);
}
```

The buffer stays cache-warm and the allocator is never touched inside the hot loop. This is the single most common MC speedup: **hoist allocation out of the hot path.** In a parallel version, give each thread its own reusable buffer (also avoiding the shared allocator and false sharing).

### Q6. What does `reserve` do on a `std::vector`, and why is forgetting it a classic performance bug?

`std::vector` grows by allocating a new, larger block (typically 1.5x or 2x), **copying/moving every existing element**, and freeing the old block. Without `reserve`, building a vector of N elements via `push_back` triggers O(log N) reallocations and O(N) total element moves — plus every reallocation invalidates pointers/iterators into the vector.

```cpp
std::vector<double> results;
results.reserve(N);                 // one allocation up front
for (std::size_t i = 0; i < N; ++i)
    results.push_back(price(i));    // no reallocation, no element moves
```

`reserve(N)` sets capacity once so all `push_back`s are amortized O(1) with zero reallocation. For a risk run producing millions of results this is a meaningful win and it stabilizes any pointers you hold. Note `reserve` changes capacity, not size — the vector is still empty until you push. Use `resize` when you want N default-constructed elements to index into directly.

### Q7. What is a memory pool / arena allocator and when is it worth writing one?

A **pool/arena** pre-allocates one big contiguous block and hands out fixed-size slices by bumping a pointer. Allocation becomes a pointer increment (O(1), no lock, no fragmentation), and you free *everything at once* by resetting the pointer. It's ideal when you create many small, same-lifetime objects — nodes of a binomial tree, per-scenario state, AST nodes in a payoff-expression evaluator.

```cpp
class Arena {
    std::vector<std::byte> buf_;
    std::size_t off_ = 0;
public:
    explicit Arena(std::size_t bytes) : buf_(bytes) {}
    template <class T> T* alloc(std::size_t n = 1) {
        std::size_t a = alignof(T);
        off_ = (off_ + a - 1) & ~(a - 1);       // align up
        T* p = reinterpret_cast<T*>(buf_.data() + off_);
        off_ += n * sizeof(T);
        return p;                                // no per-object free
    }
    void reset() { off_ = 0; }                   // bulk "free"
};
```

Benefits over `new` for this pattern: allocations are contiguous (cache-friendly), there's no per-object bookkeeping, no fragmentation, and teardown is a single `reset`. It's worth it when the allocator shows up in your profile or when many small objects share a lifetime. It's *not* worth it for a handful of long-lived objects — you'd just be reinventing `new` badly. Objects with non-trivial destructors still need those destructors called (or the arena restricted to trivially-destructible types).

### Q8. Explain false sharing and how you'd fix it in a parallel accumulator.

**False sharing** happens when two threads write to *different* variables that happen to live on the *same 64-byte cache line*. Even though there's no logical data race, the cache-coherence protocol forces the line to ping-pong between cores — each write invalidates the other core's copy — and your parallel loop scales terribly.

Classic trigger: an array of per-thread partial sums, packed tightly:

```cpp
double sums[NUM_THREADS];            // all sums share ~1-2 cache lines
// thread t does: for (...) sums[t] += payoff(...);   // false sharing!
```

Fix by padding each entry to its own cache line:

```cpp
struct alignas(64) Padded { double value = 0.0; };   // one per line
std::vector<Padded> sums(NUM_THREADS);
// thread t: sums[t].value += ...;   // no coherence traffic
```

Better still, have each thread accumulate into a **local** variable (a register/stack slot, never shared) and write to the shared array only once at the end:

```cpp
double local = 0.0;
for (std::size_t p = lo; p < hi; ++p) local += payoff(p);
sums[t].value = local;               // single write, no ping-pong
```

False sharing is invisible in correctness tests and only shows up as poor scaling — knowing to look for it is a senior signal.

### Q9. Why is chasing pointers (linked list, tree of `new`ed nodes) slow even when the algorithm is optimal?

A pointer-based structure scatters its nodes across the heap, wherever the allocator happened to place them. Traversing it means: load a node, read its `next`/child pointer, then **stall** while the CPU fetches an address it couldn't predict — a cache miss per hop, ~100-300 cycles each. The hardware prefetcher can't help because the next address only becomes known *after* the current load completes (a dependent-load chain).

A contiguous `std::vector` has the opposite property: the next element's address is known in advance, so the prefetcher streams ahead and misses amortize 8-to-1 over the cache line. This is why `std::vector` routinely beats `std::list` even for insert-heavy workloads until the list is very large, and why a **flat, array-backed** binomial/trinomial tree (index arithmetic instead of child pointers) outperforms a pointer tree for option pricing. The algorithm's Big-O is identical; the constant factor is dominated by whether memory access is predictable. Prefer contiguous, index-addressed structures on any hot path.

### Q10. `shared_ptr` vs `unique_ptr` on the hot path — what's the cost, and what should a pricer use?

`std::unique_ptr` is a zero-overhead owning pointer: it's the size of a raw pointer, and its operations compile to the same code as manual `new`/`delete` with none of the leak risk. `std::shared_ptr` is heavier: it carries a **control block** (a second heap allocation unless you use `make_shared`), and every copy/destroy does an **atomic** increment/decrement of the reference count. Atomics enforce memory ordering and can cause cache-line contention when the same `shared_ptr` is copied across threads.

| | `unique_ptr` | `shared_ptr` |
|---|---|---|
| Size | 1 pointer | 2 pointers |
| Refcount | none | atomic inc/dec per copy |
| Extra allocation | none | control block (fused by `make_shared`) |
| Hot-path suitable | yes | avoid copying in loops |

For a pricer: use **value types and `unique_ptr`** for ownership, pass by `const&` or raw pointer/`span` for non-owning access, and reserve `shared_ptr` for genuinely shared, longer-lived objects (a market-data curve observed by many instruments). Never copy a `shared_ptr` inside a tight loop — take a reference to the pointee instead. "Shared by default" is a common source of invisible atomic traffic.

### Q11. Why can memory layout matter more than reducing the number of floating-point operations?

Because a modern core can issue several FLOPs per cycle but stalls ~200 cycles on an L3/DRAM miss. If a loop is **memory-bound** — waiting on fetches — the ALU is idle most of the time, so cutting the arithmetic in half changes nothing; you're still waiting on memory. Conversely, restructuring for locality (contiguous access, SoA, cache blocking) keeps the ALU fed and can multiply throughput.

The diagnostic is the **arithmetic intensity**: FLOPs per byte fetched. Low intensity (a few ops per element streamed once, like a payoff sum) is memory-bound — optimize layout and bandwidth. High intensity (dense matrix multiply reusing each element O(n) times) is compute-bound — optimize the math and SIMD. A roofline model makes this explicit. The practical lesson for quants: before micro-optimizing formulas, check whether you're even compute-bound. Most bulk pricing and risk loops are memory-bound, so the wins live in *layout*, not in shaving multiplies.

### Q12. How do you improve temporal locality with cache blocking (tiling) in a matrix computation?

If a computation reuses data but the working set exceeds L1/L2, naive traversal evicts a value before you reuse it, forcing repeated refetches. **Blocking (tiling)** restructures the loops to work on small sub-blocks that fit in cache, so each block's data is loaded once and fully reused before moving on.

```cpp
// Naive matmul: for large n, C's/B's rows get evicted before reuse
for (int i = 0; i < n; ++i)
  for (int j = 0; j < n; ++j)
    for (int k = 0; k < n; ++k)
      C[i*n+j] += A[i*n+k] * B[k*n+j];

// Blocked: operate on BS x BS tiles that stay cache-resident
constexpr int BS = 64;
for (int ii = 0; ii < n; ii += BS)
  for (int jj = 0; jj < n; jj += BS)
    for (int kk = 0; kk < n; kk += BS)
      for (int i = ii; i < ii + BS; ++i)
        for (int j = jj; j < jj + BS; ++j)
          for (int k = kk; k < kk + BS; ++k)
            C[i*n+j] += A[i*n+k] * B[k*n+j];
```

Each tile's data is reused across the inner loops while still hot. This is exactly what tuned BLAS (MKL, OpenBLAS) does internally, plus SIMD and packing — which is why you should call BLAS for heavy linear algebra rather than hand-roll it (see the Linear Algebra topic). But knowing *why* blocking works is the point: raise temporal locality so the working set fits the cache.

### Q13. What is alignment, and why does it matter for SIMD and for avoiding false sharing?

**Alignment** is the requirement that an object's address be a multiple of some power of two. Two different reasons a quant cares:

1. **SIMD**: vector instructions (SSE/AVX) load 16/32/64 bytes at a time and are fastest (sometimes required) when the data is aligned to that width. A `std::vector<double>` is 8-byte aligned by default; for AVX you may want 32-byte alignment so aligned loads (`vmovapd`) are legal and the vectorizer doesn't emit slower unaligned paths or peel loops.

2. **False sharing** (Q8): aligning a per-thread struct to 64 bytes (`alignas(64)`) guarantees it occupies its own cache line, eliminating coherence ping-pong.

```cpp
struct alignas(64) ThreadState {     // own cache line
    double partial_sum = 0.0;
    std::mt19937_64 rng;
};

alignas(32) double lanes[8];          // AVX-friendly
```

Over-alignment costs a little padding memory, but for hot per-thread state or SIMD buffers it's a cheap, high-leverage win. `alignof`/`alignas` express the requirement; aligned allocators or `std::aligned_alloc` provide over-aligned heap memory.

### Q14. When would you deliberately choose a raw contiguous buffer over `std::vector`?

Rarely — but the cases exist. `std::vector` gives you RAII, exception safety, and growth for free, and its data is already contiguous, so it's the right default. You'd drop to a raw buffer (`std::unique_ptr<double[]>`, `std::aligned_alloc`, or a slice of an arena) when:

- You need **over-alignment** the default allocator won't give (32/64-byte for SIMD) and don't want a custom allocator on the vector.
- You want to **avoid the value-initialization** `resize` performs — `vector<double>(n)` zeroes n doubles; sometimes you'll immediately overwrite them and the zeroing is wasted bandwidth (`resize_and_overwrite` in C++23, or a raw buffer, avoids it).
- You're carving many sub-arrays out of **one arena block** for locality and bulk free.
- You're at an **FFI/zero-copy boundary** and must control the exact allocation handed to Python/NumPy or a C API.

Even then, wrap the raw buffer in an RAII owner and hand out a `std::span` (see [[modern-cpp-for-quants]]) for access, so the rest of the code stays safe. Don't reach for raw memory for "speed" without a profile — the vector is not your bottleneck until proven otherwise.

### Q15. How would you diagnose whether a slow pricing loop is memory-bound or compute-bound?

Measure, don't guess. Concretely:

1. **Profile with cache counters** — `perf stat -e cache-misses,cache-references,instructions,cycles ./pricer`, or `cachegrind`, or Intel VTune's memory-access analysis. A high miss rate and low IPC (instructions per cycle) point to memory-bound; high IPC near the machine's peak points to compute-bound.
2. **Roofline / arithmetic intensity** — estimate FLOPs per byte moved. A payoff-sum loop (a couple of ops per double, streamed once) is low-intensity and almost certainly memory-bound; a dense factorization reusing data is high-intensity.
3. **The experiment** — halve the arithmetic and remeasure. If runtime doesn't move, you're memory-bound and the fix is layout (SoA, blocking, fewer allocations), not fewer multiplies. Shrink the data to fit L2 and see if it suddenly speeds up — if it does, memory is the wall.

The reason this matters: it tells you *which* optimizations will pay. Memory-bound → fix layout (this whole topic). Compute-bound → SIMD, better algorithm, call MKL. Applying the wrong one wastes effort. A senior candidate names the tool and the experiment; a junior guesses.

### Q16. What is prefetching, and when is manual prefetching worth it over trusting the hardware?

**Prefetching** is loading a cache line before the code actually needs it, hiding memory latency behind other work. The **hardware prefetcher** detects simple patterns — sequential and small constant strides — and runs ahead automatically. For a well-laid-out contiguous loop, it does the job and you should do nothing.

**Manual** software prefetch (`__builtin_prefetch(addr)` / `_mm_prefetch`) is worth considering only when the access pattern is one the hardware *can't* predict but *you* can — e.g. gathering along an index array, or walking a structure where you know the next node's address several iterations ahead:

```cpp
for (std::size_t i = 0; i < n; ++i) {
    __builtin_prefetch(&data[idx[i + PREFETCH_DIST]]);  // pull future line early
    acc += weight[i] * data[idx[i]];                    // irregular gather
}
```

Caveats: it's easy to hurt performance (evicting useful lines, wasting bandwidth, wrong distance), it's brittle across CPUs, and the real fix is usually to *change the layout so access becomes sequential* — then the hardware handles it for free. Reach for manual prefetch last, after profiling shows a gather-bound loop that can't be restructured, and always benchmark the change.

## Move Semantics & Perfect Forwarding

### Summary

**What this topic covers**

How to move large numeric objects — vectors of a million paths, dense matrices, correlation factorizations, discount curves — from one owner to another without copying the underlying buffer. Three concern areas: (1) **value categories** — lvalues, rvalues, and xvalues, and why the language distinguishes them; (2) **the move machinery** — `std::move` (a cast, not an operation), move constructors and move assignment that *steal* a heap buffer in O(1) instead of copying it in O(n), and the rule of 0/3/5 that governs when you write them; and (3) **generic plumbing** — perfect forwarding with `T&&` and `std::forward` so factories pass arguments through without extra copies, plus copy elision / RVO / NRVO that let you return big pricing results by value for free. The 15 questions here are framed almost entirely through *big-numeric-object performance*: the whole point of move semantics in a quant library is that returning or reseating a 100MB result should cost a few pointer swaps, not a deep copy.

**Mental model**

A `std::vector<double>` is a small handle (three pointers: begin, end, capacity) pointing at a big heap buffer. **Copying** it allocates a new buffer and copies every element — O(n), and for a million-path array that's real time and a cache-cold allocation. **Moving** it just copies the three pointers and nulls out the source's handle — O(1), no allocation, no element traffic. That's the entire idea: for objects that own a heap buffer, a move transfers ownership of the buffer instead of duplicating it. The compiler decides move-vs-copy from the **value category** of the source: if it's an rvalue (a temporary, or something you explicitly `std::move`d), it can be safely gutted, so the move constructor runs; if it's an lvalue (a named variable you'll use again), the copy runs to keep it intact. `std::move` doesn't move anything — it's a cast that says "treat this lvalue as an rvalue, you may steal from it." Copy elision goes one better: often the compiler constructs the result directly in the caller's slot and there's *no* move or copy at all.

**Key terms**

- **lvalue** — a named, addressable object with identity that persists (`std::vector<double> v;` — `v` is an lvalue).
- **rvalue** — a temporary without a persistent name (`make_path()`'s return, `a + b`); safe to cannibalize.
- **xvalue** — an "expiring" value: an lvalue cast to rvalue via `std::move`, eligible to be moved from.
- **`std::move`** — a `static_cast` to `T&&`; produces an xvalue, enabling a move. Moves nothing itself.
- **Move constructor** — `T(T&&)`; steals the source's buffer (copy pointers, null the source) in O(1).
- **Move assignment** — `operator=(T&&)`; releases own resources, then steals the source's.
- **Rule of 0** — write no special members; let members (vector, unique_ptr) manage resources. Preferred.
- **Rule of 3/5** — if you write one of destructor/copy/move, consider all five; hand-managing a resource means defining them consistently.
- **Perfect forwarding** — `template<class T> f(T&& x)` + `std::forward<T>(x)` preserves the caller's value category through a wrapper.
- **Forwarding (universal) reference** — `T&&` where `T` is deduced; binds to both lvalues and rvalues (distinct from an rvalue reference).
- **Copy elision / RVO / NRVO** — the compiler omits the copy/move when returning a temporary (guaranteed since C++17) or a local (NRVO, allowed).
- **Moved-from state** — valid but unspecified; you may destroy or reassign it, not assume its value.

**Why interviewers ask this**

Move semantics is the dividing line between C++ developers who understand ownership and cost, and those who write correct-but-slow code. On a quant desk the objects are large — matrices, path arrays, curves — so a spurious deep copy in a returned result or a container reallocation is a measurable performance bug. Interviewers want to see that you know a returned `std::vector` isn't copied (RVO/move), that `std::move` on a `const` object silently *copies* (a subtle correctness/perf trap), and that `return std::move(local)` actively *disables* the optimization it looks like it's helping. The perfect-forwarding questions test whether you can write generic factory/wrapper code — templated Monte Carlo engines, `emplace`-style construction — without inserting hidden copies. Getting these right signals you can reason about *who owns what and what each line costs*, which is the core competence for library-quality C++.

**Common confusions**

- "`std::move` moves the object" — no; it's a cast to an rvalue. The move happens only if a move constructor/assignment then runs.
- "`return std::move(x)` is faster" — it's usually *slower*: it blocks NRVO, forcing a move where the compiler would have elided everything.
- "You can't use a moved-from object" — you can; it's in a valid-but-unspecified state. You may reassign or destroy it, just don't rely on its contents.
- "Moving is always cheaper than copying" — for a `std::array` or a struct of scalars there's no buffer to steal; move == copy. Moves win for *heap-owning* types.
- "`T&&` is always an rvalue reference" — only when `T` is a concrete type. When `T` is a *deduced* template parameter, `T&&` is a forwarding reference that also binds lvalues.
- "`std::move` on a `const T` moves" — it can't; a move constructor takes non-const `T&&`, so overload resolution silently falls back to the copy constructor.

**What follows from this topic**

Move semantics is why the value-semantic style works for large numeric objects — you can return a matrix or a path array by value and pass results around without fear, which keeps ownership clear (tie-in to RAII and the rule of 0). It underpins [[memory-management-and-cache-performance]]: reusing buffers avoids allocation, and moving avoids copying the buffers you do allocate. The templated Monte Carlo engine relies on perfect forwarding to construct payoffs and generators in place. And it feeds [[modern-cpp-for-quants]], where `std::span`/`std::mdspan` give you non-owning views to pass large buffers with *zero* transfer at all — the logical endpoint of "stop copying big things."

### Q1. What is the difference between an lvalue, an rvalue, and an xvalue, and why does C++ care?

An **lvalue** is an object with a persistent identity you can take the address of — a named variable like `std::vector<double> v`. An **rvalue** is a value without a persistent name, typically a temporary — the result of `make_path()` or `a + b`. An **xvalue** ("expiring value") is an lvalue that you've marked as safe to move from by casting it with `std::move` — it has identity *and* is eligible to be cannibalized.

C++ cares because the value category tells the compiler whether the source can be safely gutted. If you pass an rvalue (a temporary nobody will use again), the compiler can bind it to a `T&&` move constructor and steal its buffer. If you pass an lvalue (a variable you'll use later), it must copy to keep the original intact.

```cpp
std::vector<double> v = make_path();   // make_path() returns an rvalue -> moved in
std::vector<double> w = v;             // v is an lvalue -> copied (v still usable)
std::vector<double> x = std::move(v);  // std::move(v) is an xvalue -> v's buffer stolen
```

The categories exist precisely to let the compiler pick *move* when copying would be wasteful and *copy* when the source must survive.

### Q2. `std::move` doesn't move anything — explain what it actually does.

`std::move(x)` is a `static_cast<T&&>(x)`: it takes an lvalue and produces an xvalue — a name for "an rvalue reference to x." It generates **no code** and moves **nothing** by itself. All it does is change the value category so that overload resolution selects a move constructor/assignment (which takes `T&&`) instead of the copy version.

```cpp
template <class T>
constexpr std::remove_reference_t<T>&& move(T&& t) noexcept {
    return static_cast<std::remove_reference_t<T>&&>(t);   // just a cast
}
```

The actual buffer-stealing happens inside the move constructor that runs *because* of the cast. If no move constructor exists (or the target is `const`, see Q11), the copy constructor runs and you get a silent copy despite the `std::move`. So the mental model is: `std::move` is you telling the compiler "I'm done with this, you may pillage it" — the pillaging is done by the type's move operations, not by `std::move`. Naming it "move" is arguably the biggest teaching wart in the language.

### Q3. Write a move constructor for a simple matrix class and explain why it's O(1) vs O(n) for copy.

```cpp
class Matrix {
    std::size_t rows_ = 0, cols_ = 0;
    double* data_ = nullptr;                 // owns a heap buffer
public:
    Matrix(std::size_t r, std::size_t c)
        : rows_(r), cols_(c), data_(new double[r * c]{}) {}

    ~Matrix() { delete[] data_; }

    // Copy: allocate a new buffer, copy every element -- O(rows*cols)
    Matrix(const Matrix& o)
        : rows_(o.rows_), cols_(o.cols_), data_(new double[o.rows_ * o.cols_]) {
        std::copy(o.data_, o.data_ + rows_ * cols_, data_);
    }

    // Move: steal the pointer, null the source -- O(1)
    Matrix(Matrix&& o) noexcept
        : rows_(o.rows_), cols_(o.cols_), data_(o.data_) {
        o.data_ = nullptr;                   // source must not free our buffer
        o.rows_ = o.cols_ = 0;
    }
};
```

The copy constructor must allocate `rows*cols` doubles and copy each one — O(n) time plus a cold allocation. The move constructor copies three scalars and one pointer, then nulls the source so its destructor won't `delete[]` the buffer we just took — O(1), no allocation, no element traffic. For a 1000x1000 matrix that's the difference between moving 8MB and copying three ints. Mark it `noexcept` (Q8) so containers will use it. In real code you'd get all of this for free by holding a `std::vector<double>` and writing *no* special members (rule of 0, Q7).

### Q4. Explain the rule of 0, 3, and 5 and which one a numeric class should aim for.

- **Rule of 3**: if you need a custom destructor, copy constructor, *or* copy assignment, you almost certainly need all three (they manage the same resource consistently). Pre-C++11 baseline.
- **Rule of 5**: C++11 adds the move constructor and move assignment; if you hand-manage a resource you should define all five for correctness *and* performance (without the moves, moves silently become copies).
- **Rule of 0**: write **none** of them. Compose your class from members that already manage their own resources — `std::vector`, `std::unique_ptr`, `std::string` — and the compiler-generated special members do the right thing (member-wise copy, member-wise move, correct destruction).

A numeric class should aim for the **rule of 0**. Instead of a raw `double*` with hand-written copy/move (Q3), hold a `std::vector<double>`:

```cpp
class Matrix {
    std::size_t rows_ = 0, cols_ = 0;
    std::vector<double> data_;          // manages the buffer for us
public:
    Matrix(std::size_t r, std::size_t c) : rows_(r), cols_(c), data_(r * c) {}
    // no destructor, no copy, no move -- all correct and efficient by default
};
```

You reach for rule of 5 only when you genuinely wrap a raw resource the standard library doesn't manage (a C API handle, a memory-mapped region). For the common case, rule of 0 is less code and fewer bugs.

### Q5. Why can you return a big `std::vector` or matrix from a function by value without worrying about the copy?

Because of **copy elision** plus move semantics. When you return a temporary, C++17 *guarantees* the result is constructed directly in the caller's storage — no copy, no move (**RVO**, return value optimization). When you return a named local, the compiler is *allowed* to do the same (**NRVO**), and if it can't, it falls back to a **move**, not a copy — the return value is treated as an rvalue.

```cpp
std::vector<double> simulate(std::size_t n) {
    std::vector<double> path(n);
    // ... fill path ...
    return path;             // NRVO: constructed in caller's slot; else moved. Never copied.
}

auto p = simulate(1'000'000);   // no million-element copy happens
```

So returning large numeric results by value is idiomatic and free — it gives you clean value semantics (clear ownership, no output parameters) at zero cost. The one way to *break* this is to write `return std::move(path)` (Q6), which suppresses NRVO. Just `return path;` and let the compiler do the right thing.

### Q6. Why is `return std::move(local)` an anti-pattern?

Because it **disables the optimization it appears to help**. When you write `return local;`, the compiler tries **NRVO** — constructing the local directly in the caller's return slot so there's *zero* copy *and* zero move. Writing `return std::move(local)` changes the return expression's type from an lvalue of type `T` to an xvalue of type `T&&`, which makes NRVO inapplicable — now the compiler is *forced* to run a move constructor. You've converted "nothing at all" into "a move," which is strictly worse (and for a type where move==copy, like a struct of scalars, you may even force a copy the compiler would otherwise have elided).

```cpp
std::vector<double> good() {
    std::vector<double> v(N);
    return v;                 // NRVO: no move, no copy
}
std::vector<double> bad() {
    std::vector<double> v(N);
    return std::move(v);      // NRVO suppressed -> forced move. Worse.
}
```

Rule: never `std::move` a local you're returning by value. The only legitimate `std::move` in a return is when returning a *member* or a *by-value parameter* that you actually want to move out and where NRVO doesn't apply anyway — and even those are niche. Default to a plain `return local;`.

### Q7. What is perfect forwarding and why does a generic factory need it?

Perfect forwarding lets a generic wrapper pass its arguments to another function while **preserving each argument's value category** — an lvalue stays an lvalue (gets copied downstream), an rvalue stays an rvalue (gets moved downstream). Without it, a forwarding wrapper would name its parameters, and a named parameter is always an lvalue, so everything downstream gets *copied* even when the caller passed a movable temporary.

The mechanism is a **forwarding reference** `T&&` (with deduced `T`) plus `std::forward<T>`:

```cpp
template <class Payoff, class... Args>
std::unique_ptr<Payoff> make_payoff(Args&&... args) {
    return std::make_unique<Payoff>(std::forward<Args>(args)...);  // preserve categories
}

std::vector<double> strikes = load_strikes();
auto p1 = make_payoff<BasketPayoff>(strikes);             // lvalue -> copied into BasketPayoff
auto p2 = make_payoff<BasketPayoff>(std::move(strikes));  // rvalue -> moved into BasketPayoff
```

A quant library needs this for factories, `emplace`-style construction, and generic engine builders (a templated Monte Carlo engine constructing its payoff and path generator in place): you want to forward a heavy argument — a strike vector, a correlation matrix — into the constructed object *without* an intermediate copy. `std::forward` conditionally casts back to rvalue only when the original argument was an rvalue.

### Q8. Explain `std::forward` and how it differs from `std::move`.

Both are casts that generate no code, but they cast *conditionally* vs *unconditionally*:

- **`std::move(x)`** — *unconditionally* casts to rvalue. Use it when you know you're done with `x` and want to move from it.
- **`std::forward<T>(x)`** — *conditionally* casts: it yields an rvalue **only if** `T` was deduced as an rvalue reference; otherwise it yields an lvalue. It's used exclusively with forwarding references to relay the caller's original category.

```cpp
template <class T> void wrapper(T&& arg) {
    downstream(std::forward<T>(arg));   // rvalue if caller passed rvalue, else lvalue
    // downstream(std::move(arg));      // WRONG: would move even an lvalue the caller still owns
}
```

The reason `forward` needs the explicit `<T>` template argument is that it inspects `T` (via reference-collapsing rules) to decide whether to cast. Using `std::move` inside a forwarding wrapper would be a bug: it would steal from an lvalue the caller intends to keep using. Mnemonic: **`move` for "I own this and I'm done"; `forward` for "pass along exactly what I was given."**

### Q9. What is a moved-from object's state, and what's safe to do with it?

After an object is moved from, it's left in a **valid but unspecified** state. "Valid" means all class invariants hold and the destructor will run correctly. "Unspecified" means you can't assume its *value* — a moved-from `std::vector` is typically empty (size 0) but the standard only guarantees it's valid, not what it contains.

What's safe: **destroy it** (always fine — that's the whole point of nulling the source in a move), or **reassign it** (give it a fresh value, then use normally):

```cpp
std::vector<double> a = make_path();
std::vector<double> b = std::move(a);   // a is now moved-from
// double x = a[0];                     // UB-ish: reading unspecified state -- don't
a = make_path();                         // OK: reassign, a is usable again
a.clear();                               // OK: clear() has no precondition on contents
```

What's *not* safe: relying on its contents, or calling operations with **preconditions** on the value (e.g. `front()`/`pop_back()` on a container you assume is non-empty). This bites in loops that `std::move` out of a variable and then accidentally use it again. Treat a moved-from object as "empty and needs re-filling before use."

### Q10. Is moving always faster than copying? When are they identical?

No. A move only wins when there's an owned **heap resource to steal**. If the object's data lives entirely *inline* — no pointer to a separate buffer — there's nothing to transfer, so the "move" just copies the bytes, identical to a copy.

| Type | Copy cost | Move cost |
|---|---|---|
| `std::vector<double>` (N elements) | O(N) + allocation | O(1) pointer swap |
| `std::string` (long) | O(len) + allocation | O(1) (short strings: same, SSO copies inline) |
| `std::array<double, N>` | O(N) inline copy | O(N) inline copy — **same** |
| `struct { double a, b, c; }` | copy 3 doubles | copy 3 doubles — **same** |
| `std::unique_ptr<T>` | not copyable | O(1) pointer transfer |

So `std::array<double, 1000>` — a fixed inline buffer — gains *nothing* from `std::move`; you're copying 8000 bytes either way. Same for a plain aggregate of scalars, or a `std::string` short enough to sit in SSO. Moves matter for the heap-owning types a quant library passes around: dynamic path arrays, dynamically-sized matrices, curves. Don't sprinkle `std::move` on trivially-copyable value types expecting a speedup — there's no buffer to steal.

### Q11. What happens when you `std::move` a `const` object? Why is it a silent trap?

It **silently copies**. `std::move(x)` on a `const T` produces a `const T&&`. But a move constructor takes a *non-const* `T&&` (it has to mutate the source to null out its buffer), so `const T&&` can't bind to it. Overload resolution then falls back to the copy constructor, whose parameter is `const T&` — which `const T&&` binds to happily. You get a full deep copy, exactly the thing `std::move` was supposed to avoid, with no error or warning.

```cpp
const std::vector<double> curve = build_curve();
std::vector<double> local = std::move(curve);   // looks like a move...
                                                 // ...actually COPIES (curve is const)
```

This bites when a member or parameter is `const` and you "optimize" it with `std::move`. The lesson: you can't move out of something you promised not to modify. If you genuinely want to move, the source can't be `const`. Compilers can warn (`-Wpessimizing-move` / `-Wredundant-move` families) but it's easy to miss. Be suspicious of any `std::move` applied to a `const`-qualified object — it's almost always a hidden copy.

### Q12. Design the special members for a `PricingResult` holding a big vector of per-scenario P&Ls.

Prefer the **rule of 0** — hold standard containers and write nothing:

```cpp
class PricingResult {
    double price_ = 0.0;
    double std_error_ = 0.0;
    std::vector<double> scenario_pnl_;    // the big buffer -- vector manages it
    std::vector<double> greeks_;
public:
    PricingResult(double p, double se, std::vector<double> pnl, std::vector<double> g)
        : price_(p), std_error_(se),
          scenario_pnl_(std::move(pnl)),  // move params in: caller's temporary is stolen
          greeks_(std::move(g)) {}
    // no dtor, no copy, no move -- compiler generates correct + efficient versions
};
```

Two design points worth stating in an interview: (1) take the big vectors **by value** in the constructor and `std::move` them into members — this is the "sink" idiom: a caller passing a temporary gets a move all the way in, a caller passing an lvalue pays one copy they explicitly opted into. (2) Because the members are movable, the compiler-generated move constructor moves the vectors in O(1), so `return PricingResult{...};` from an engine is cheap. You'd only hand-write the five special members if you wrapped a raw resource — here you don't, so don't. Returning this by value from a Monte Carlo engine costs a pointer-swap move (or nothing, via RVO), not a copy of a million P&Ls.

### Q13. In `void f(T&& x)`, when is `T&&` an rvalue reference and when is it a forwarding reference?

It depends on whether `T` is **deduced**:

- If `T` is a **template parameter being deduced** in this context, `T&&` is a **forwarding (universal) reference** — it binds to both lvalues and rvalues, and reference-collapsing determines the final type. Pass an lvalue and `T` deduces to `U&`, so `T&&` collapses to `U&`; pass an rvalue and `T` deduces to `U`, so `T&&` is `U&&`.
- If the type is **concrete** (not deduced here) — e.g. `void f(std::vector<double>&&)`, or `T&&` inside a class template where `T` is already fixed by the class — it's a plain **rvalue reference** that binds to rvalues only.

```cpp
template <class T> void a(T&& x);        // forwarding reference: binds lvalue OR rvalue
void b(std::vector<double>&& x);         // rvalue reference: rvalue only

template <class T> struct Engine {
    void run(T&& x);                     // T fixed by the class -> plain rvalue reference,
};                                       //   NOT a forwarding reference
```

This matters because `std::forward` is correct *only* with forwarding references. Misreading a fixed-`T` member `T&&` as a forwarding reference — and calling `std::forward` on it expecting lvalue binding — is a classic mistake. The test is simple: **is `T` being deduced right here from the argument? If yes, forwarding reference; if no, rvalue reference.**

### Q14. How do move semantics interact with `std::vector` growth and reallocation?

When a `std::vector` outgrows its capacity, it allocates a bigger buffer and transfers existing elements into it. Whether it **moves** or **copies** those elements during reallocation depends on one thing: **is the element's move constructor `noexcept`?**

- If the move constructor is `noexcept`, the vector **moves** each element — O(1) per element for heap-owning types.
- If it's *not* `noexcept`, the vector **copies** instead. It has to: reallocation must provide the strong exception guarantee (if a move threw halfway, the vector would be left with some elements moved-out and no way to roll back), so it falls back to copying, which it can abandon safely on throw.

```cpp
struct Path {
    std::vector<double> steps;
    Path(Path&&) noexcept = default;   // <-- noexcept: vector<Path> growth MOVES
};
std::vector<Path> book;
book.reserve(N);                        // or: mark move noexcept so grows are cheap
```

The practical lesson: **mark your move constructor/assignment `noexcept`** (and prefer `= default`, which is `noexcept` when the members' moves are). Forgetting it silently turns cheap moves into expensive copies every time a `std::vector` of your type reallocates — an invisible performance bug in code that stores big objects in growing containers. Also `reserve` up front to avoid reallocation entirely (tie to [[memory-management-and-cache-performance]]).

### Q15. Given a swap of two large matrices, why is the move-based idiom O(1)?

`std::swap` on two heap-owning objects is implemented with three moves, and each move is a pointer swap, so the whole swap is O(1) — no element data is touched:

```cpp
template <class T>
void swap(T& a, T& b) noexcept {
    T tmp = std::move(a);   // steal a's buffer into tmp (O(1))
    a = std::move(b);       // steal b's buffer into a   (O(1))
    b = std::move(tmp);     // steal tmp's buffer into b  (O(1))
}
```

Each `std::move` + move-assignment swaps three pointers and nulls the source; no `rows*cols` doubles are copied. For two 1000x1000 matrices, swapping is a handful of pointer writes instead of moving 16MB. This is why the **copy-and-swap idiom** is both exception-safe and efficient for assignment operators, and why standard containers provide O(1) `swap`. It's also the mechanism behind cheaply reseating large state — e.g. double-buffering a working array between Monte Carlo batches, or swapping in a freshly rebuilt curve. Any time you'd otherwise deep-copy two big buffers to exchange them, a move-based swap does it in constant time. Note it relies on the move operations being `noexcept` (Q14) for the swap itself to be `noexcept`.

## Modern C++ (11 to 23) for Quants

### Summary

**What this topic covers**

The specific features each C++ standard from 11 through 23 added that *change how numeric and financial code is written* — not a language changelog, but a working quant's toolkit. Three concern areas: (1) **expressiveness that costs nothing at runtime** — `auto`, lambdas for RNG/payoff closures, `constexpr`/`consteval` compile-time constants, structured bindings; (2) **safer, faster interfaces to numeric data** — concepts constraining `template<floating_point T>`, ranges for lazy pipelines, `std::span` as a non-owning view over a path array, and C++23's `std::mdspan` as a multidimensional view over a grid or matrix buffer; and (3) **honest error and result types** — `std::optional`, C++23's `std::expected`, plus the workhorse libraries `<random>` (never `rand()`) and `<chrono>` (for timing/benchmarks). The 16 questions map each feature to *what it buys numeric code*, with a summary table. Coroutines and modules get a brief mention — real but less central to the pricing hot path than the value-semantics and view types above.

**Mental model**

Think of modern C++ as three waves aimed at numeric work. **C++11/14** made value semantics and closures cheap and ergonomic: `auto` and lambdas let you write a payoff or RNG closure inline, move semantics (its own topic) made returning big results free, and `<random>` replaced `rand()` with real engines and distributions. **C++17** added `if constexpr` (compile-time branching in templates), structured bindings (unpack a `pair`/`tuple` result cleanly), `std::optional` (a maybe-value), and guaranteed copy elision. **C++20/23** is the "views and constraints" wave: **concepts** replace SFINAE so a numeric template says exactly what it needs (`std::floating_point`), **ranges** compose lazy pipelines without temporaries, **`std::span`** and **`std::mdspan`** let you pass buffers and grids as cheap non-owning views (no copy, no ownership), and **`std::expected`** gives you a value-or-error return without exceptions on the hot path. The unifying theme: express intent precisely, pay nothing at runtime, and stop copying large numeric buffers.

**Key terms**

- **`auto`** — deduce a variable's type from its initializer; essential for un-spellable types (lambdas, iterators, range views).
- **Lambda** — an inline callable with captured state; used for payoff functions, RNG closures, custom comparators.
- **`constexpr`** — may be evaluated at compile time; folds pricing constants and small tables into the binary.
- **`consteval`** — *must* be evaluated at compile time (C++20); an immediate function, guaranteeing no runtime cost.
- **Structured bindings** — `auto [mean, stderr] = estimate();` unpacks a tuple/pair/struct into named variables.
- **Concept** — a named compile-time predicate on types (C++20); constrains templates and gives readable errors.
- **Ranges** — composable lazy views (`filter`, `transform`) over sequences (C++20); no intermediate containers.
- **`std::span`** — a non-owning `{pointer, size}` view over a contiguous buffer (C++20); pass a path array cheaply.
- **`std::mdspan`** — a non-owning multidimensional view over a 1D buffer (C++23); index a grid/matrix as `m(i,j)`.
- **`std::optional`** — holds a value or nothing; a solver that may not converge returns `optional<double>`.
- **`std::expected`** — holds a value *or* an error (C++23); value-or-error returns without exceptions.
- **`<random>` / `<chrono>`** — proper RNG engines+distributions; type-safe durations/clocks for timing.

**Why interviewers ask this**

To gauge whether you write *current* C++ or C++98-with-a-newer-compiler. A candidate who returns error codes and out-params, hand-writes SFINAE, and passes `(double* p, int n)` pairs is signalling they stopped learning a decade ago. A candidate who constrains a template with `std::floating_point`, returns a result by value (RVO), passes a buffer as a `std::span`, indexes a grid via `mdspan`, and returns `std::expected<double, CalibError>` from a solver is signalling library-quality, safe, expressive code. Interviewers also probe *judgement*: knowing that `span`/`mdspan` are non-owning views (dangling risk if the buffer dies), that `constexpr` moves work to compile time, and that exceptions are for setup while `expected` suits the hot path. The features are easy to list; using them with correct ownership and cost reasoning is the signal.

**Common confusions**

- "`auto` hurts readability" — for un-spellable types (lambdas, range views, iterators) it's mandatory; the cost is trivial and IDEs show the type.
- "`std::span` owns its data" — it does *not*; it's a view. If the underlying buffer is freed, the span dangles.
- "`constexpr` guarantees compile-time" — it only *permits* it; use `consteval` to *require* it. A `constexpr` function called with runtime args runs at runtime.
- "`optional` and `expected` are the same" — `optional` says "value or nothing"; `expected` says "value or *this specific error*." Use `expected` when the caller needs to know *why* it failed.
- "Concepts are just documentation" — they participate in overload resolution and produce short, accurate errors; they change what compiles, not just what reads well.
- "mdspan copies the matrix" — no; it's a view with an index mapping over an existing 1D buffer. Zero copy.

**What follows from this topic**

These features are the connective tissue of a modern quant library. `std::span`/`std::mdspan` are the payoff of [[memory-management-and-cache-performance]] and [[move-semantics]]: once your data is a contiguous buffer you own once, you pass *views* of it everywhere at zero cost — no copies, no moves, no ownership confusion. Concepts constrain the templated Monte Carlo engine and the CRTP/expression-template machinery of the linear-algebra and low-latency topics. `<random>` is the foundation of the Monte Carlo and RNG topics (per-thread engines, distributions). `std::expected` and `noexcept` feed the error-handling and robustness discussion. `<chrono>` underlies every benchmark you run when you profile the hot path. Modern C++ is less a topic than the vocabulary the rest of the primer is written in.

### Q1. What does `auto` buy numeric code, and when is it essential rather than just convenient?

`auto` deduces a variable's type from its initializer. For everyday code it removes redundant type spelling (`auto it = v.begin();` instead of the full iterator type) and avoids implicit-conversion bugs. For modern numeric code it's often **essential**, not cosmetic, because some types are effectively un-spellable:

```cpp
auto payoff = [K](double S) { return std::max(S - K, 0.0); };  // lambda: no nameable type
auto view = prices | std::views::transform(discount);          // range view: complex type
for (auto& [name, curve] : market_data) { /* ... */ }          // structured binding
```

A lambda's type is a unique compiler-generated closure type you *cannot* write out; a `ranges` view's type is a deeply nested template you shouldn't. `auto` is the only reasonable way to name them.

Caveat with judgement: prefer explicit types where the concrete type carries meaning (`double`, `std::size_t`) — `auto x = 0;` gives `int`, which can silently truncate an index or lose precision in a numeric expression, and `auto` drops `const`/reference qualifiers unless you write `const auto&`. Use `auto` for un-spellable and obvious-from-RHS types; be explicit for numeric scalars where the type is a correctness decision.

### Q2. How are lambdas used in a pricing/Monte Carlo library?

Lambdas are inline callables that capture surrounding state, which makes them the natural way to express **payoffs** and **RNG closures** — small functions parameterized by market or contract data:

```cpp
double K = 100.0;
auto call_payoff = [K](double S) { return std::max(S - K, 0.0); };
auto put_payoff  = [K](double S) { return std::max(K - S, 0.0); };

std::mt19937_64 engine(seed);
std::normal_distribution<double> dist(0.0, 1.0);
auto next_normal = [&engine, &dist] { return dist(engine); };   // RNG closure

double total = 0.0;
for (std::size_t i = 0; i < N; ++i)
    total += call_payoff(simulate(next_normal));
```

Two performance points worth raising: (1) a lambda's call is typically **inlined** — when you pass a lambda as a *template* parameter (not through `std::function`), the compiler sees the concrete type and inlines the body, so a payoff closure costs nothing over hand-written code. (2) `std::function<double(double)>` *type-erases* the payoff, which adds an indirect call and possible allocation — fine at the API boundary, but on the hot path template on the callable to keep it inlined. Capture by value for cheap scalars, by reference for the engine/distribution you're mutating (mind lifetimes). Lambdas are how you compose a generic engine with a specific contract without a class hierarchy.

### Q3. What do `constexpr` and `consteval` buy, and how do they differ?

`constexpr` marks a function or variable as *eligible* for compile-time evaluation; `consteval` (C++20) marks a function that *must* run at compile time (an "immediate function"). The payoff for numeric code is folding constants, small lookup tables, and cheap math into the binary so there's zero runtime work and the values can be used where a compile-time constant is required (array sizes, template args).

```cpp
constexpr double days_per_year = 365.25;
constexpr double year_fraction(int days) { return days / days_per_year; }

consteval int steps_for(double years) { return static_cast<int>(years * 252); }  // must be compile-time

constexpr double t = year_fraction(90);   // computed at compile time
std::array<double, steps_for(1.0)> grid;  // 252, fixed at compile time
```

The key distinction: a `constexpr` function called with **runtime** arguments simply runs at runtime — `constexpr` *permits* compile-time evaluation, it doesn't force it. `consteval` *guarantees* it: calling it with a runtime value is a compile error. Use `constexpr` for things that *can* be constant-folded (most pure numeric helpers), and `consteval` when you specifically want to forbid any runtime evaluation (e.g. generating a compile-time table). Modern standards keep widening what's allowed in `constexpr` (loops, `<cmath>` in C++23, even some containers), so more of your setup math can move to compile time.

### Q4. How do structured bindings clean up returning multiple values from a numeric routine?

A Monte Carlo estimate naturally returns *two* numbers — the price and its standard error. Pre-C++17 you'd use an out-parameter or a `std::pair` accessed via `.first`/`.second`. **Structured bindings** unpack a tuple/pair/struct (or aggregate) into named variables in one line:

```cpp
struct Estimate { double price; double std_error; };

Estimate monte_carlo(std::size_t N) {
    // ... accumulate mean and variance ...
    return {mean, std::sqrt(var / N)};
}

auto [price, stderr] = monte_carlo(1'000'000);   // named, readable
if (stderr / price < 1e-4) { /* converged */ }
```

This reads far better than `.first`/`.second` (which say nothing about meaning) and avoids out-parameters (which obscure data flow and hurt the compiler's ability to elide). It also composes with range-based `for` over a map — `for (auto& [key, value] : m)` — and with `std::tie`-free tuple returns. Note bindings introduce *new names* referring to members of a hidden object; use `auto& [..]` to bind by reference when you want to mutate or avoid a copy. For numeric APIs that return a small bundle of results (price + Greeks + error), a named struct plus structured bindings is the clean idiom.

### Q5. What are concepts and how do they improve a numeric template?

A **concept** (C++20) is a named compile-time predicate on types that you attach to a template to say exactly what the template requires. For numeric code the immediate win is constraining a template to floating-point types, and getting a short, accurate error when someone violates that — instead of a wall of SFINAE/instantiation errors.

```cpp
#include <concepts>

template <std::floating_point T>            // only float/double/long double
T black_scholes_call(T S, T K, T r, T sigma, T T_expiry) {
    T d1 = (std::log(S / K) + (r + T(0.5) * sigma * sigma) * T_expiry)
           / (sigma * std::sqrt(T_expiry));
    T d2 = d1 - sigma * std::sqrt(T_expiry);
    return S * norm_cdf(d1) - K * std::exp(-r * T_expiry) * norm_cdf(d2);
}
```

Call it with an `int` and you get a crisp "constraint not satisfied: int is not floating_point" at the call site, not a 200-line template dump. You can also write custom concepts — e.g. a `PathGenerator` concept requiring a `.next()` returning `double` — to constrain a templated Monte Carlo engine so the requirements are documented *and enforced*. Concepts participate in overload resolution (you can have different overloads for `std::integral` vs `std::floating_point`), replacing `enable_if` SFINAE with readable intent. They change what compiles and dramatically improve error quality — the reason they're the headline C++20 feature for generic numeric libraries.

### Q6. What is `std::span`, and why is it the right way to pass a path array?

`std::span<double>` (C++20) is a lightweight **non-owning view** over a contiguous sequence — just a pointer and a length. It lets a function accept "some contiguous doubles" without caring whether they came from a `std::vector`, a `std::array`, or a raw buffer, and **without copying** them or taking ownership.

```cpp
double average_payoff(std::span<const double> path) {   // accepts any contiguous source
    return std::accumulate(path.begin(), path.end(), 0.0) / path.size();
}

std::vector<double> v = simulate(...);
double a = average_payoff(v);              // no copy: span views v's buffer
std::array<double, 252> arr = ...;
double b = average_payoff(arr);            // same function, different container
double c = average_payoff({v.data() + 10, 50});  // a sub-window, zero copy
```

Before `span`, you either passed `const std::vector<double>&` (locks callers into `vector`, can't view a sub-range or a C array) or a `(const double*, size_t)` pair (unsafe, easy to desync pointer and length). `span` bundles them safely, carries `.size()`, supports subviews (`.subspan(offset, count)`), and works as a range. **Ownership caveat**: a span is a *view* — if the underlying buffer is freed or reallocated (a `vector` that grows), the span dangles. Use it for parameters and short-lived views, never to store data that must outlive the source. It's the idiomatic "pass a buffer cheaply" type and the natural interface for a payoff or a path-processing function.

### Q7. What does `std::mdspan` (C++23) give a quant working with grids and matrices?

`std::mdspan` is a **non-owning multidimensional view** over a flat 1D buffer: you own the data once as a contiguous `std::vector<double>`, then wrap it in an `mdspan` to index it as a 2D grid or matrix with natural `m(i, j)` syntax and a chosen layout (row- or column-major). Zero copy, zero ownership — just an index mapping over existing memory.

```cpp
#include <mdspan>

std::vector<double> buf(rows * cols);                    // own the data contiguously
std::mdspan grid(buf.data(), rows, cols);                // 2D view, default row-major

for (std::size_t i = 0; i < grid.extent(0); ++i)
    for (std::size_t j = 0; j < grid.extent(1); ++j)
        grid[i, j] = payoff_at(i, j);                    // C++23 multidim subscript
```

This is exactly what a finite-difference PDE grid or a scenario matrix wants: the storage stays a single cache-friendly buffer (good for the memory topic), but the code reads like 2D math instead of manual `buf[i*cols + j]` index arithmetic that's easy to get wrong. You can also choose the layout policy (`layout_left` for column-major to match Fortran/BLAS, `layout_right` for row-major) and even non-owning strided/submatrix views without moving data. Like `span`, it's a **view** — it does not manage the buffer's lifetime, so keep the owning `vector` alive as long as the `mdspan` is used. It's the C++23 answer to "index a matrix cleanly without a heavyweight matrix class or hand-rolled stride math."

### Q8. When do you return `std::optional` vs `std::expected`, and why not just throw?

Both model "the result might not be a plain value," but they say different things:

- **`std::optional<T>`** — "a `T`, or nothing." Use it when *absence* is a normal, self-explanatory outcome and the caller doesn't need a reason. A root-finder that may not converge within its iteration budget: `std::optional<double>`.
- **`std::expected<T, E>`** (C++23) — "a `T`, or an error `E` explaining why." Use it when the caller needs to *distinguish and handle* failure modes. A calibration that can fail for several reasons returns `std::expected<Params, CalibError>`.

```cpp
std::optional<double> implied_vol(double price, /* ... */) {
    // Newton iterations; return std::nullopt if it fails to converge
    if (!converged) return std::nullopt;
    return sigma;
}

std::expected<double, PricingError> price_option(const Option& o) {
    if (o.T <= 0.0) return std::unexpected(PricingError::Expired);
    if (o.sigma < 0) return std::unexpected(PricingError::BadVol);
    return black_scholes(o);
}
```

Why not always throw? Exceptions are excellent for **setup/config** failures (invalid market data at construction, a missing curve) — rare, fatal, unwound once. But on a **numeric hot path** — pricing millions of instruments, an implied-vol solve per quote — exceptions are the wrong tool: throwing is expensive, and "didn't converge" is an *expected*, frequent outcome, not an exceptional one. `optional`/`expected` make the failure part of the type, force the caller to handle it, and cost nothing when things succeed. Rule of thumb: **exceptions for the exceptional (setup), `expected`/`optional` for routine numeric outcomes on the hot path.**

### Q9. Why use `<random>` instead of `rand()`, and what are the pieces?

`rand()` is a C-era mistake for numeric work: it has poor statistical quality (short period, low-order-bit correlations on many implementations), is only specified up to `RAND_MAX` (often just 32767), gives a biased distribution if you do `rand() % n`, and isn't safe to share across threads. Monte Carlo convergence and correctness depend on the RNG, so this matters.

`<random>` separates two concerns cleanly: an **engine** (the source of raw bits) and a **distribution** (the shape you want):

```cpp
#include <random>

std::mt19937_64 engine(42);                          // Mersenne Twister, 64-bit, fixed seed
std::normal_distribution<double> normal(0.0, 1.0);   // maps engine bits -> N(0,1)
std::uniform_real_distribution<double> unif(0.0, 1.0);

double z = normal(engine);                            // one standard normal draw
```

Engines: `mt19937`/`mt19937_64` (good default, long period), or faster modern choices (PCG, xoshiro) when speed dominates. Distributions: `normal_distribution`, `uniform_real_distribution`, `lognormal_distribution`, etc. — statistically correct, no modulo bias. **Reproducibility**: seed the engine explicitly for repeatable runs, but note distributions are *not* guaranteed identical across standard-library implementations, so pin your library if bit-exact cross-platform results matter. **Parallel MC**: give each thread its *own* engine with a distinct seed/stream — never share one engine across threads (that's a data race and destroys independence). This is the foundation the RNG and Monte Carlo topics build on.

### Q10. How do you use `<chrono>` to time a pricing routine, and what's the pitfall?

`<chrono>` provides type-safe clocks and durations for measuring how long code takes — the basis of any hand benchmark when you profile the hot path. Use `steady_clock` for elapsed-time measurement (it's monotonic and never jumps, unlike `system_clock` which can shift with NTP/clock changes):

```cpp
#include <chrono>

auto t0 = std::chrono::steady_clock::now();
double result = run_monte_carlo(N);
auto t1 = std::chrono::steady_clock::now();

auto us = std::chrono::duration_cast<std::chrono::microseconds>(t1 - t0).count();
std::cout << "priced in " << us << " us\n";
```

The type system prevents unit mix-ups: durations carry their units (`microseconds`, `nanoseconds`), so you convert explicitly rather than juggling raw integers.

The **pitfall** is measuring code the optimizer deleted. If `result` is never used, the compiler may elide the whole computation (dead-code elimination), and you'll "measure" nanoseconds for work that never ran. Force the result to be observed — consume it, or use a benchmark framework's `benchmark::DoNotOptimize(result)` (Google Benchmark). Also beware timing overhead for very short operations (the `now()` call itself costs something — measure a loop, not a single tiny op), warm-up/JIT-free but cache effects, and run enough iterations to average out noise. For serious microbenchmarks prefer Google Benchmark over hand-rolled `<chrono>`, but `<chrono>` is the right primitive and the correct clock choice signals you know the difference.

### Q11. What do ranges (C++20) buy a numeric pipeline?

Ranges let you compose **lazy, non-owning views** over a sequence — `filter`, `transform`, `take` — that fuse into a single pass with no intermediate containers. For a numeric pipeline this means expressing "discount these cashflows, keep the positive ones, sum them" declaratively without allocating a temporary vector at each step:

```cpp
#include <ranges>
namespace rv = std::views;

double pv = 0.0;
for (double cf : cashflows
                 | rv::transform([&](double c) { return c * discount(c); })
                 | rv::filter([](double d) { return d > 0.0; }))
    pv += cf;
```

The views are *lazy*: nothing is computed until iterated, and no intermediate `std::vector` of discounted values is materialized — each element flows through the whole pipeline once. That's both readable (the transformation reads top-to-bottom) and efficient (no temporaries, cache-friendly single pass). Ranges also tidy up algorithm calls — `std::ranges::sort(v)` instead of `std::sort(v.begin(), v.end())` — and compose with `span`/`mdspan`.

Judgement points: for a genuinely hot inner loop, a plain indexed loop can still be easier for the optimizer and to reason about, and heavy range pipelines can bloat compile times and produce dense types (lean on `auto`). Use ranges where they make a data transformation clearer without hurting the hot path; they're expressiveness with usually-zero runtime cost, not a mandate.

### Q12. Give a "feature to what it buys quant code" table across C++11 to 23.

| Feature (standard) | What it buys numeric/quant code |
|---|---|
| `auto`, move semantics (11) | Un-spellable types (lambdas/views); return big matrices/paths by value for free |
| Lambdas (11) | Inline payoff/RNG closures; inlined when passed as template params |
| `<random>` (11) | Real engines + distributions; per-thread RNG for parallel Monte Carlo |
| `<chrono>` (11) | Type-safe timing for benchmarks; `steady_clock` for elapsed time |
| `constexpr` (11/14/17/20) | Fold pricing constants, day-count math, small tables to compile time |
| Generic lambdas, `constexpr` loops (14) | More setup math and closures at compile time |
| `if constexpr` (17) | Compile-time branching in a template (pick algorithm by type, no overloads) |
| Structured bindings (17) | Unpack `{price, std_error}` / map entries into named variables |
| `std::optional` (17) | "Value or nothing" — a solver that may not converge |
| Guaranteed copy elision (17) | Return big pricing results with no move/copy at all |
| Concepts (20) | Constrain `template<floating_point T>`; short, accurate template errors |
| Ranges (20) | Lazy, temporary-free transform/filter pipelines over sequences |
| `std::span` (20) | Non-owning view — pass a path/buffer cheaply, any contiguous source |
| `consteval` (20) | *Force* compile-time evaluation (immediate functions) |
| `std::jthread`, atomics refinements (20) | Safer concurrency for parallel MC (see Concurrency topic) |
| `std::mdspan` (23) | Multidim view over a 1D buffer — index grids/matrices as `m(i,j)`, zero copy |
| `std::expected` (23) | Value-or-error returns without exceptions on the hot path |
| `constexpr` `<cmath>` (23) | Compile-time transcendental math for constant folding |

The through-line: newer standards let you *say more precisely what you mean* (concepts, expected), *pass big data without copying* (span, mdspan, move), and *do more at compile time* (constexpr/consteval), almost always at zero runtime cost.

### Q13. What does `if constexpr` do that runtime `if` and overloads don't?

`if constexpr` (C++17) is a **compile-time branch inside a template**: the compiler evaluates the condition at instantiation and *discards the untaken branch entirely* — it isn't even compiled for that instantiation. This lets one function template handle types with different capabilities without writing separate overloads or specializations.

```cpp
template <class T>
double to_price(const T& x) {
    if constexpr (std::floating_point<T>) {
        return x;                              // already a price
    } else if constexpr (requires { x.value(); }) {
        return x.value();                      // a Quote-like wrapper
    } else {
        static_assert(sizeof(T) == 0, "unsupported price type");
    }
}
```

A runtime `if` can't do this: it requires *both* branches to compile for *every* type, so `x.value()` would be a hard error when `T` is `double`. `if constexpr` discards the dead branch, so each instantiation only compiles the branch that applies. Versus tag-dispatch or overload sets, it keeps the logic in one readable function instead of scattering it across overloads — useful in a generic pricing kernel that adapts to whether the input is a raw `double`, a wrapped `Quote`, or an AAD active type. It's the clean modern replacement for a lot of SFINAE and tag-dispatch boilerplate.

### Q14. Briefly, what do coroutines and modules offer, and are they central to the pricing hot path?

**Coroutines** (C++20) are functions that can suspend and resume, keeping their state across suspensions. They shine for *lazy generators* and *async I/O*: a market-data feed handler awaiting network events, or a lazy path/scenario generator that yields one draw at a time without materializing all of them. For a quant they're most relevant in the **I/O and streaming** layers (async market-data ingestion, an async pricing service) rather than the arithmetic core. On a tight numeric hot path they're usually *not* the tool — the suspension machinery and potential heap allocation of the coroutine frame add overhead you don't want in an inner Monte Carlo loop; a plain loop over a reusable buffer is faster and simpler.

**Modules** (C++20) replace the textual `#include` model with a proper compiled-module interface. The payoff is *build performance and hygiene*: no repeated re-parsing of huge headers (Eigen, standard library), no macro leakage across translation units, cleaner dependencies. For a large pricing library with heavy templated headers this can meaningfully cut compile times. But adoption has lagged on tooling/build-system support, so many quant codebases still use headers in 2026.

Honest framing for an interview: both are real and worth knowing, but neither reshapes the *numeric hot path* the way `span`/`mdspan`, move semantics, concepts, and `<random>` do. Coroutines belong to the async/streaming edges; modules are a build-time concern. Mention them, don't over-claim them.

### Q15. Design a small modern-C++ interface for a generic pricer using these features together.

Combine concepts (constrain the callable), `span` (non-owning market data), `expected` (value-or-error), and value-return (RVO) into one clean interface:

```cpp
#include <concepts>
#include <span>
#include <expected>

enum class PricingError { Expired, BadVol, NoConvergence };

template <class F>
concept Payoff = requires(F f, double S) {
    { f(S) } -> std::convertible_to<double>;      // callable double->double
};

template <Payoff F>
std::expected<double, PricingError>
price_mc(F payoff,                                 // inlined closure, not std::function
         std::span<const double> normals,          // pre-drawn N(0,1), zero-copy view
         double S0, double r, double sigma, double T) {
    if (T <= 0.0)   return std::unexpected(PricingError::Expired);
    if (sigma < 0.0) return std::unexpected(PricingError::BadVol);

    const double drift = (r - 0.5 * sigma * sigma) * T;
    const double diff  = sigma * std::sqrt(T);
    double sum = 0.0;
    for (double z : normals) {                      // ranges-style loop over the span
        double ST = S0 * std::exp(drift + diff * z);
        sum += payoff(ST);
    }
    double price = std::exp(-r * T) * sum / normals.size();
    return price;                                    // by value: RVO, no copy
}

// use:
auto call = [K = 100.0](double S) { return std::max(S - K, 0.0); };
auto result = price_mc(call, normals, 100.0, 0.02, 0.2, 1.0);
if (result) use(*result); else handle(result.error());
```

Every feature earns its place: the `Payoff` concept documents and enforces the callable's shape (and keeps errors readable); templating on `F` inlines the payoff instead of paying `std::function` indirection; `std::span<const double>` takes market data as a cheap non-owning view with no copy and no ownership fuss; `std::expected` reports validation failures without throwing on the hot path; and returning by value is free via RVO. This is what "modern C++ for quants" looks like in the small — precise interfaces, zero-cost abstractions, honest error handling.

### Q16. What are the ownership and lifetime traps with `span` and `mdspan`, and how do you avoid them?

Both are **non-owning views** — a pointer (plus size/extents) into memory someone else owns. The trap is a **dangling view**: if the underlying buffer is destroyed, reallocated, or goes out of scope while the view still refers to it, you have undefined behaviour reading freed or moved memory.

```cpp
std::span<double> bad() {
    std::vector<double> local(100);
    return local;                 // DANGLING: local's buffer is freed on return
}

std::span<const double> s = get_prices();
std::vector<double> v = ...;
s = v;                            // OK...
v.push_back(1.0);                 // ...but a reallocation just invalidated s!
```

How to avoid it: (1) treat `span`/`mdspan` as **function parameters and short-lived locals**, not as members that outlive the data or as return values referring to a local; (2) never let a view outlive its backing `vector`/`array`; (3) beware **reallocation** — mutating a `vector` (push_back, resize) can move its buffer and silently dangle any span over it, so don't hold a view across operations that may grow the container; (4) if you must store a view long-term, make sure the owner's lifetime provably encloses it (or store the owner instead). The rule mirrors references and iterators: a view is only as valid as the buffer behind it. Used with that discipline — pass a buffer in, view it, don't outlive it — they're zero-cost and safe; used carelessly they're a lifetime bug generator. Run ASan to catch these in tests.
## Linear Algebra in C++

### Summary

**What this topic covers**

The numerical-linear-algebra layer that sits under every serious pricing, risk, and calibration library. Three concern areas live here: (1) **libraries** — Eigen (header-only, expression-template based, the quant default) versus the BLAS/LAPACK/Intel MKL stack of hand-tuned kernels, and when each earns its keep; (2) **the operations** — matrix and vector types, products, solves, and the four decompositions a quant actually uses (LU, QR, Cholesky, SVD) with what each is *for*; and (3) **the one primitive that shows up in every Monte Carlo interview** — using the Cholesky factor of a covariance matrix, `Sigma = L * L^T`, to turn a vector of independent standard normals `Z` into a vector of correlated normals `X = L * Z`. Around the edges sit the performance concerns that make or break bulk numeric code: row- versus column-major storage, cache behaviour, SIMD vectorization, and avoiding temporaries. The 16 questions here range from "why Eigen and not raw loops" to "factor this covariance matrix and simulate a correlated basket."

**Mental model**

Think of it as two worlds that meet. On top is a **value-semantic, expression-oriented API** (Eigen) where you write `x = A.llt().solve(b)` or `y = a + b + c` and it reads like maths. Underneath is a **contiguous block of doubles** plus a set of kernels (BLAS levels 1/2/3, LAPACK factorizations) that were micro-optimized for the cache hierarchy and SIMD units of real CPUs. Eigen bridges the two: for small fixed-size matrices it inlines and unrolls; for large ones it can call into BLAS/MKL. The key insight for a quant is that **memory layout and temporaries dominate, not FLOP count** — a naive `D = A + B + C` that materializes two intermediate matrices is slower than one fused loop, which is exactly what expression templates buy you. The second insight: **most "solve a linear system" problems in finance are structured** (a covariance matrix is symmetric positive-definite), and picking the decomposition that exploits that structure (Cholesky, ~2x cheaper than LU) is both faster and more numerically stable.

**Key terms**

- **Eigen** — header-only C++ template linear-algebra library; expression templates fuse operations and avoid temporaries; SIMD-vectorized. The quant default.
- **BLAS** — Basic Linear Algebra Subprograms; the standard low-level kernel API (Level 1 vector-vector, Level 2 matrix-vector, Level 3 matrix-matrix).
- **LAPACK** — higher-level routines (factorizations, solves, eigenvalues) built on BLAS.
- **Intel MKL / OpenBLAS** — highly optimized BLAS/LAPACK implementations; MKL is the fast commercial one on Intel hardware.
- **LU decomposition** — `A = P*L*U`; general square solves and determinants.
- **QR decomposition** — `A = Q*R`; least-squares and regression (curve fitting, calibration).
- **Cholesky** — `Sigma = L*L^T` for symmetric positive-definite `Sigma`; ~2x cheaper than LU; the correlated-normals primitive.
- **SVD** — `A = U*S*V^T`; the robust workhorse for rank, pseudo-inverse, PCA on covariance, ill-conditioned problems.
- **Expression template** — a template technique that represents `a + b + c` as an unevaluated tree, evaluated in one pass with no temporaries.
- **Row-major vs column-major** — memory ordering of a 2D array; C/C++ default row-major, Eigen and Fortran/BLAS default column-major.
- **Condition number** — how much a solve amplifies input error; large means ill-conditioned, prefer SVD/QR.

**Why interviewers ask this**

Linear algebra is where "can you do the maths" meets "can you make it fast." Juniors reach for a hand-rolled triple loop and an `O(n^3)` matrix multiply that ignores cache and gets the row/column order wrong; seniors reach for Eigen, pick the right decomposition for the matrix structure, and can explain why a temporary-free expression matters. The Cholesky-for-correlated-normals question is nearly universal in quant-dev interviews because it sits exactly at the intersection of probability, linear algebra, and C++ — it tests whether you understand *why* `L*Z` produces the target covariance (`E[X X^T] = L E[Z Z^T] L^T = L*I*L^T = Sigma`), not just the API call. Getting the decomposition choice right (Cholesky over LU for an SPD matrix) signals you think about numerical stability and cost, not just correctness.

**Common confusions**

- "Eigen is slow because it's all templates" — the opposite; expression templates *remove* temporaries and enable inlining/SIMD, often beating naive hand loops.
- "Any decomposition solves any system" — only if it applies. Cholesky needs symmetric positive-definite; feed it a non-SPD matrix and it fails (which is actually a useful check that a covariance matrix is valid).
- "Row-major vs column-major is just cosmetic" — it changes cache behaviour and, worse, silently transposes data when you interoperate with BLAS/NumPy if you get it wrong.
- "`X = L*Z` needs `L` from the correlation matrix" — it's the covariance (or correlation, if you then scale by vols). Be explicit about which matrix you factored.
- "Inverting the matrix then multiplying is fine" — computing an explicit inverse is slower and less stable than a factor-and-solve; almost never form `A^{-1}` explicitly.

**What follows from this topic**

Cholesky is the hinge into **Random Number Generation** (generating the independent `Z` to correlate) and **Monte Carlo Engines** (simulating a correlated basket of underlyings). QR and SVD feed **calibration** and curve fitting in the numerical-methods material. The expression-template discussion connects back to the templates/performance themes of the general C++ material, and the row-major/SIMD/cache points tie into the low-latency and data-oriented-design topics. If you can factor a covariance matrix and explain `X = L*Z`, you have the core building block for correlated multi-asset simulation.

### Q1. Why use Eigen instead of writing your own matrix class and loops?

Because a correct, fast linear-algebra layer is a huge amount of work that Eigen already did, and a naive hand-rolled version is usually both slower and buggier.

```cpp
#include <Eigen/Dense>
using Eigen::MatrixXd;
using Eigen::VectorXd;

VectorXd solve(const MatrixXd& A, const VectorXd& b) {
    // LU with partial pivoting — one line, numerically sound.
    return A.partialPivLu().solve(b);
}
```

What Eigen gives you that a weekend matrix class won't:

- **Expression templates** — `D = A + B + C` compiles to a single fused loop, no intermediate matrices allocated.
- **SIMD** — inner loops auto-vectorize (SSE/AVX) with correct alignment.
- **Fixed-size optimization** — `Matrix3d` is stack-allocated and fully unrolled; no heap, no loop overhead.
- **Battle-tested decompositions** — LU/QR/Cholesky/SVD with pivoting and stability handled.

A quant desk cares because pricing/risk code lives or dies on the cache behaviour of these kernels, and reinventing them wastes time you should spend on models. Reach for raw loops only for a trivial, hot, fixed-shape operation you've profiled.

### Q2. What are expression templates and why do they matter for `y = a + b + c`?

An expression template represents an arithmetic expression as a compile-time tree of *unevaluated* operations, then evaluates the whole thing in a single loop when assigned.

Without them, each `+` returns a full temporary:

```cpp
// Naive: a+b makes a temp, (a+b)+c makes another temp, then copy into y.
// 2 extra allocations, 3 passes over memory.
VectorXd y = a + b + c;
```

With Eigen, `a + b + c` has a type like `CwiseBinaryOp<..., CwiseBinaryOp<...>>` — a tree. Assignment triggers one loop:

```cpp
for (int i = 0; i < n; ++i)
    y[i] = a[i] + b[i] + c[i];   // fused, no temporaries, one pass
```

Why a quant cares: bulk vector math (discount factors across a curve, payoffs across paths) is **memory-bandwidth bound**. Cutting three passes to one and eliminating temporaries is often a 2-3x win with zero API cost. This is the same idea as loop fusion, done at compile time by the type system.

### Q3. When do you drop to BLAS/LAPACK or Intel MKL instead of pure Eigen?

For **large, heavy Level-3 operations** — big dense matrix-matrix products and large factorizations — where a vendor-tuned kernel beats Eigen's built-in path.

| Case | Use |
|---|---|
| Small fixed-size (2x2..8x8) | Eigen (inlined, unrolled) — MKL call overhead dominates |
| Medium dense solves | Eigen native is fine |
| Large `A*B`, big SVD/eigen | BLAS/LAPACK/MKL — hand-tuned, multithreaded, cache-blocked |
| You already link MKL | Let Eigen dispatch to it |

Eigen can transparently forward to an external BLAS:

```cpp
// Compile with -DEIGEN_USE_MKL_ALL and link MKL:
// Eigen routes large products/decompositions to MKL kernels,
// you keep the same Eigen API.
```

The rule: MKL wins when the operation is big enough to amortize call overhead and benefit from multithreaded, cache-blocked kernels. For the small matrices in a per-instrument pricer, Eigen's inlined path is usually faster. Measure before switching.

### Q4. Show how to turn independent normals into correlated normals via Cholesky.

This is the core Monte Carlo primitive. Given a target covariance matrix `Sigma`, factor it as `Sigma = L * L^T` (Cholesky), draw independent standard normals `Z`, and set `X = L * Z`. Then `X` has covariance `Sigma`.

```cpp
#include <Eigen/Dense>
#include <random>
using Eigen::MatrixXd;
using Eigen::VectorXd;

// Sigma must be symmetric positive-definite.
MatrixXd choleskyFactor(const MatrixXd& Sigma) {
    Eigen::LLT<MatrixXd> llt(Sigma);
    if (llt.info() != Eigen::Success)
        throw std::runtime_error("Sigma not positive-definite");
    return llt.matrixL();   // lower-triangular L
}

VectorXd correlatedNormals(const MatrixXd& L, std::mt19937_64& rng) {
    std::normal_distribution<double> nd(0.0, 1.0);
    VectorXd z(L.rows());
    for (int i = 0; i < z.size(); ++i) z[i] = nd(rng);
    return L * z;           // X = L * Z  -> Cov(X) = Sigma
}
```

Why it works: `Cov(X) = E[X X^T] = E[L Z Z^T L^T] = L E[Z Z^T] L^T = L * I * L^T = L L^T = Sigma`, because independent standard normals have `E[Z Z^T] = I`. That one line of algebra is what interviewers want you to reproduce.

### Q5. Why prove `Cov(L*Z) = Sigma`? Walk through the algebra.

Because the interviewer wants to see you understand *why* the trick works, not that you memorized an API call.

Let `Z` be a vector of independent standard normals, so `E[Z] = 0` and `E[Z Z^T] = I` (identity — variance 1 on the diagonal, zero covariance off it). Let `X = L*Z` where `L` is the Cholesky factor, `Sigma = L*L^T`.

```text
E[X]     = L * E[Z]        = 0
Cov(X)   = E[X X^T]        = E[(L Z)(L Z)^T]
         = E[L Z Z^T L^T]
         = L * E[Z Z^T] * L^T
         = L * I * L^T
         = L * L^T
         = Sigma.                       // done
```

Also `X` is a linear combination of jointly Gaussian variables, so it is itself multivariate normal — mean 0, covariance `Sigma`, exactly the target. This is why Cholesky is *the* method for simulating correlated Gaussian risk factors.

### Q6. Why Cholesky rather than LU for a covariance matrix?

Because a covariance matrix is **symmetric positive-definite (SPD)**, and Cholesky is the decomposition specialized for exactly that structure.

| | LU | Cholesky (LLT) |
|---|---|---|
| Applies to | general square | symmetric positive-definite |
| Cost | ~ (2/3) n^3 | ~ (1/3) n^3 (half of LU) |
| Pivoting | needed for stability | not needed (SPD) |
| Output | `P*L*U` | `L*L^T` |
| Bonus | — | fails cleanly if not PSD |

Three wins: it's about **2x cheaper**, it's **numerically stable without pivoting** for SPD inputs, and its failure is *informative* — if `LLT::info()` reports non-success, your "covariance" matrix isn't positive-definite (a bad correlation input or a rank-deficient estimate), which you want to catch. Using LU here would work but throws away structure, cost, and that free validity check.

### Q7. Your Cholesky throws "not positive-definite" on a real correlation matrix. Why, and what do you do?

An estimated covariance/correlation matrix can be only positive **semi**-definite or slightly indefinite due to noise, missing data, or interpolation — it has a zero or tiny-negative eigenvalue, so strict Cholesky fails.

Fixes, in order of preference:

```cpp
// 1. Use LDLT (robust to semi-definite), Eigen's pivoting Cholesky:
Eigen::LDLT<MatrixXd> ldlt(Sigma);   // handles PSD / near-singular

// 2. Or repair the matrix: clip negative eigenvalues to a small floor.
Eigen::SelfAdjointEigenSolver<MatrixXd> es(Sigma);
VectorXd d = es.eigenvalues().cwiseMax(1e-12);       // floor
MatrixXd fixed = es.eigenvectors() * d.asDiagonal()
                                   * es.eigenvectors().transpose();
```

The eigenvalue-clipping approach ("nearest correlation matrix" in spirit) produces a valid SPD matrix you can then factor. The real-world lesson: never assume a market-estimated covariance is clean; validate and repair before feeding it into a simulation. This is a very common follow-up because it separates candidates who've only seen textbook matrices from those who've shipped a risk engine.

### Q8. What does each decomposition — LU, QR, Cholesky, SVD — actually get used for in finance?

| Decomposition | Form | Primary quant use |
|---|---|---|
| **LU** | `A = P*L*U` | General square solves, determinants, PDE grid solves |
| **QR** | `A = Q*R` | Least-squares regression — curve/surface fitting, Longstaff-Schwartz regression in American MC |
| **Cholesky** | `Sigma = L*L^T` | Correlated normal generation; SPD solves (Kalman filters, GLS) |
| **SVD** | `A = U*S*V^T` | PCA on covariance (risk factors), pseudo-inverse, ill-conditioned/rank-deficient least squares |

The heuristic: **exploit structure**. SPD -> Cholesky. Tall thin least-squares -> QR. Ill-conditioned or need rank/pseudo-inverse -> SVD (most robust, most expensive). General square -> LU. Naming the *right* one for the matrix at hand — and why (cost, stability) — is the signal.

### Q9. Explain row-major vs column-major and why it bites when you call BLAS or NumPy.

Storage order determines which index varies fastest in the flat memory buffer. C/C++ native 2D arrays are **row-major** (last index contiguous); Eigen, Fortran, BLAS, LAPACK default to **column-major** (first index contiguous).

```cpp
// Eigen defaults to column-major; make it explicit if you interop:
Eigen::Matrix<double, Eigen::Dynamic, Eigen::Dynamic,
              Eigen::RowMajor> rowMat;   // row-major, matches C/NumPy default
```

Two ways it bites:

- **Performance**: iterate in the wrong order and every access is a cache miss. For column-major, loop columns in the outer loop, rows inner.
- **Correctness on interop**: pass a row-major buffer to a column-major BLAS routine (or a NumPy C-order array to Fortran-order code) and you silently get the **transpose**. Debugging a wrong-but-plausible matrix that's actually `A^T` is miserable.

The fix: be explicit about layout at every boundary (Eigen `RowMajor` flag, NumPy `order=`, BLAS transpose flags) and know that Eigen<->NumPy zero-copy requires matching order.

### Q10. Why never explicitly invert a matrix to solve `A x = b`?

Because forming `A^{-1}` is slower, uses more memory, and is numerically worse than factor-and-solve.

```cpp
// BAD: explicit inverse
VectorXd x = A.inverse() * b;          // ~n^3 to invert + a matvec, less stable

// GOOD: factor once, solve
VectorXd x = A.partialPivLu().solve(b); // solves directly, better conditioned
```

The inverse is only worth forming if you genuinely need the matrix `A^{-1}` as an object (rare). For "solve this system" — even for many right-hand sides — factor once and reuse the factorization:

```cpp
auto lu = A.partialPivLu();            // factor once
VectorXd x1 = lu.solve(b1);
VectorXd x2 = lu.solve(b2);            // reuse — cheap back-substitution
```

Explicitly inverting also amplifies round-off: the condition number of the answer depends on `A`, but the inverse computes and then re-multiplies, compounding error. Factor-and-solve is the universal idiom.

### Q11. How do you compute the covariance matrix of a return series in Eigen, cheaply?

Center the data, then a single matrix product gives the covariance — no explicit loops.

```cpp
#include <Eigen/Dense>
using Eigen::MatrixXd;

// R: rows = observations (T), cols = assets (N). Returns N x N covariance.
MatrixXd covariance(const MatrixXd& R) {
    const int T = R.rows();
    Eigen::RowVectorXd mean = R.colwise().mean();
    MatrixXd centered = R.rowwise() - mean;        // broadcast subtract
    return (centered.transpose() * centered) / double(T - 1);  // unbiased
}
```

Points that earn credit:

- **Vectorized** — `colwise().mean()` and the broadcast subtract avoid manual loops and vectorize.
- **`T - 1`** — the unbiased (sample) estimator; using `T` is the biased/ML version. Know which you want.
- **Single Level-3 op** — `centered^T * centered` is one BLAS-friendly matrix product, the expensive step, done once.

The result is symmetric positive-semidefinite by construction, so it feeds straight into Q4's Cholesky (subject to the repair caveat in Q7).

### Q12. `Matrix3d` vs `MatrixXd` — what's the difference and when does it matter?

`Matrix3d` is **fixed-size** (dimensions known at compile time); `MatrixXd` is **dynamic-size** (dimensions at runtime).

```cpp
Eigen::Matrix3d  fixed;   // 9 doubles inline, on the stack, no heap alloc
Eigen::MatrixXd  dyn(3,3);// heap-allocated buffer, size stored at runtime
```

| | Fixed (`Matrix3d`) | Dynamic (`MatrixXd`) |
|---|---|---|
| Storage | inline / stack | heap |
| Allocation | none | one malloc |
| Loops | fully unrolled | runtime loop |
| Size limit | small (compile-time) | arbitrary |

For small, known shapes on a hot path — a 3x3 rotation, a 2-factor correlation — fixed size removes the allocation and lets the compiler unroll and vectorize completely. For anything large or runtime-sized (a covariance across N assets where N varies), use dynamic. Mixing up: don't make a 1000x1000 `Matrix<double, 1000, 1000>` — that's a megabyte on the stack and will overflow it.

### Q13. Simulate one step of a correlated two-asset GBM basket in Eigen.

Combine Cholesky (correlation) with the GBM update. For assets `i`, `S_i(t+dt) = S_i * exp((r - 0.5*sigma_i^2)*dt + sigma_i*sqrt(dt)*X_i)` where `X = L*Z` are the correlated normals.

```cpp
#include <Eigen/Dense>
#include <random>
using Eigen::VectorXd; using Eigen::MatrixXd;

VectorXd stepBasket(const VectorXd& S, const VectorXd& sigma,
                    double r, double dt, const MatrixXd& L,
                    std::mt19937_64& rng) {
    std::normal_distribution<double> nd(0.0, 1.0);
    VectorXd z(S.size());
    for (int i = 0; i < z.size(); ++i) z[i] = nd(rng);
    VectorXd x = L * z;                              // correlated normals

    const double sqdt = std::sqrt(dt);
    VectorXd drift = (r - 0.5 * sigma.array().square()) * dt;   // per asset
    VectorXd diff  = sigma.array() * sqdt * x.array();
    return (S.array() * (drift + diff).array().exp()).matrix(); // S * exp(...)
}
```

Note the `.array()` switches from matrix algebra to elementwise ops (square, exp, product) — a common Eigen idiom. Here `L` is the Cholesky factor of the *correlation* matrix and the vols enter separately; equivalently you can factor the full covariance and skip the separate `sigma` scaling. Be explicit about which you did.

### Q14. What is `valarray` and should you use it for numeric work?

`std::valarray` is a standard-library numeric array with elementwise operators (`a + b`, `sin(a)`) and slicing, designed for vectorized math.

```cpp
#include <valarray>
std::valarray<double> a = {1, 2, 3}, b = {4, 5, 6};
std::valarray<double> c = a * b + 2.0;   // elementwise, expression-friendly
```

In practice: **skip it for real quant work.** It's a half-abandoned corner of the standard library — no linear algebra, no decompositions, no SIMD guarantees, worse tooling than Eigen. It predates and is outclassed by Eigen/Armadillo/Blaze. Know it exists (it may appear in legacy code) and know why the modern answer is Eigen: expression templates, decompositions, SIMD, active development. `valarray`'s one virtue — elementwise operators with no dependency — is fully subsumed by Eigen's array interface.

### Q15. How does Eigen use SIMD, and what can break it?

Eigen vectorizes inner loops using SSE/AVX intrinsics so one instruction processes 2-4 doubles at once, but it needs the right conditions.

What enables it:

- Compile with `-O3 -march=native` so the compiler targets your CPU's widest vector unit.
- **Aligned storage** — Eigen aligns fixed-size types; keep them aligned in your own structs (Eigen provides `EIGEN_MAKE_ALIGNED_OPERATOR_NEW` for class members that are fixed-size Eigen types).
- Contiguous, unit-stride data — operating on a whole vector, not a strided sub-block.

What breaks it:

- Misalignment (can crash on older SSE, or silently fall back to scalar).
- Tiny sizes where setup cost exceeds the win.
- Mixing scalar and vector code so the compiler can't prove it's safe.

The quant takeaway mirrors the general performance rule: layout and alignment, not FLOP count, decide whether the vector units actually fire. Verify with a profiler that the hot kernel is vectorized rather than assuming.

### Q16. Design the linear-algebra interface for a multi-asset MC engine — what do you expose?

Keep the correlation machinery behind a small, reusable object so the path generator just asks for correlated shocks.

```cpp
#include <Eigen/Dense>
#include <random>

// Owns the Cholesky factor; hands out correlated normals on demand.
class CorrelatedNormalGenerator {
public:
    explicit CorrelatedNormalGenerator(const Eigen::MatrixXd& Sigma) {
        Eigen::LLT<Eigen::MatrixXd> llt(Sigma);
        if (llt.info() != Eigen::Success)
            throw std::runtime_error("covariance not positive-definite");
        L_ = llt.matrixL();
    }

    // One draw of correlated normals; rng is caller-owned (per-thread).
    Eigen::VectorXd operator()(std::mt19937_64& rng) const {
        std::normal_distribution<double> nd(0.0, 1.0);
        Eigen::VectorXd z(L_.rows());
        for (int i = 0; i < z.size(); ++i) z[i] = nd(rng);
        return L_ * z;
    }
private:
    Eigen::MatrixXd L_;   // cached Cholesky factor
};
```

Design points: **factor once** in the constructor (the expensive step) and cache `L_`; take the RNG **by reference from the caller** so each thread owns its own engine (ties into parallel MC — never share an engine); keep the object a pure value with no global state so it's trivially reusable and testable. The path generator then loops calling `gen(rng)` per step. This cleanly separates "how are shocks correlated" (linear algebra) from "how does the underlying evolve" (the SDE), which is exactly the modularity a pricing library wants.

## Random Number Generation

### Summary

**What this topic covers**

How to produce the random numbers that drive every Monte Carlo pricer — correctly, reproducibly, and fast enough. Four concern areas live here: (1) **the `<random>` library** — the engine/distribution split, which engine to pick (`mt19937_64` as the safe default, PCG/xoshiro for speed) and which distributions (`normal_distribution`, `uniform_real_distribution`), and why `rand()` is banned; (2) **reproducibility** — fixed seeds for regression tests, and the sharp caveat that distribution *implementations* are not portable across standard libraries; (3) **variance and convergence** — quasi-random (Sobol) low-discrepancy sequences that converge faster than pseudo-random for Monte Carlo; and (4) **the parallel-correctness rule that interviewers love** — every thread must own an independent engine (distinct seed/stream or jump-ahead), because sharing one engine across threads is both a data race and a statistical disaster. Also here: how normals get made (Box-Muller vs Ziggurat) and how to combine RNG with the Cholesky factor to draw correlated normals. Around 16 questions, warm-up ("why not `rand()`") through senior ("seed 64 threads correctly").

**Mental model**

Separate two things the C++ library deliberately separates: an **engine** is a deterministic source of uniformly-distributed bits (a state machine — seed it, call it, it emits the next number and advances state); a **distribution** is a stateless-ish transform that maps that uniform stream into the shape you want (normal, uniform-real, Poisson). You wire them together: `dist(engine)`. This split is the whole design — one engine can feed many distributions, and you swap engines without touching distribution code. The reproducibility model: same engine + same seed + same sequence of calls = same numbers *within one standard-library build* — but the distribution transforms are unspecified, so numbers differ across libstdc++/libc++/MSVC. For parallel Monte Carlo the mental model is "N independent streams": you never want two threads pulling from the same state (they'd race and correlate), so each thread gets its own engine seeded to a disjoint region of the sequence. And for MC convergence, remember pseudo-random error shrinks like `1/sqrt(N)` while a good quasi-random (Sobol) sequence can approach `1/N` for smooth low-dimensional payoffs.

**Key terms**

- **Engine** — deterministic generator of uniform bits; has state, must be seeded. E.g. `mt19937_64`.
- **Distribution** — maps the engine's output to a target law; e.g. `normal_distribution<double>`.
- **`mt19937_64`** — 64-bit Mersenne Twister; long period, good quality, the standard default.
- **PCG / xoshiro** — modern fast engines with small state; faster than Mersenne Twister with good statistics.
- **`rand()`** — the legacy C generator; low quality, small period, not thread-safe. Never use for MC.
- **Seed** — the value initializing engine state; fixed seed -> reproducible stream.
- **Low-discrepancy / quasi-random** — deterministic sequences (Sobol, Halton) that fill space more evenly than random, speeding MC convergence.
- **Sobol sequence** — the dominant low-discrepancy sequence in finance; needs careful dimension handling.
- **Box-Muller** — turns two uniforms into two normals via trig; simple, slower.
- **Ziggurat** — fast rejection-based normal generator; what high-performance libraries use.
- **Jump-ahead / stream** — advancing an engine by a huge fixed offset (or using a distinct stream id) to give each thread a disjoint sub-sequence.

**Why interviewers ask this**

RNG is where a plausible-looking Monte Carlo quietly produces *wrong numbers*. The classic tell: a candidate parallelizes a pricer, shares one `mt19937` across threads (or default-constructs a fresh engine inside a loop), and either races or draws correlated/identical paths — the price looks fine but the standard error is a lie. Interviewers ask to see whether you understand that **RNG state is the shared mutable state** in a parallel simulation and must be partitioned per thread. They also probe reproducibility (can you reproduce a failing regression? do you know the cross-platform caveat?) and convergence (do you know Sobol beats pseudo-random for smooth payoffs, and why?). Juniors say "I used `rand()` / a random seed"; seniors say "`mt19937_64`, fixed seed for tests, one engine per thread with jump-ahead, and Sobol for the smooth low-dimensional legs."

**Common confusions**

- "`rand()` is fine, it's random" — it's low-quality, short-period, and not thread-safe; MC amplifies its flaws.
- "Fixed seed means identical results everywhere" — only within one std-lib build; distribution transforms aren't portable, so `normal_distribution` differs across compilers.
- "Construct the distribution/engine inside the loop" — re-seeding or reconstructing per iteration destroys the sequence and can repeat values; create once, call many times.
- "Just give each thread a different seed and it's independent" — nearby seeds can produce overlapping/correlated streams; use jump-ahead or a proper stream mechanism, or well-separated seeds via a seed sequence.
- "Sobol is always better" — only for smooth, low-effective-dimension problems; in high dimensions or with discontinuous payoffs its advantage erodes and it needs scrambling.

**What follows from this topic**

RNG feeds directly into **Monte Carlo Engines** — the per-thread-engine rule is *the* correctness constraint when that engine parallelizes over paths. The correlated-normals thread ties back to **Linear Algebra** (Cholesky `X = L*Z`, where `Z` comes from here). The convergence discussion (`1/sqrt(N)` vs Sobol) sets up the variance-reduction material. If you take one thing: the engine is shared mutable state — treat it with the same discipline as any other data shared across threads.

### Q1. Why must you never use `rand()` for Monte Carlo?

Because `rand()` fails on every axis that matters for simulation: quality, period, range, and thread-safety.

- **Low quality** — many implementations have short periods and visible serial correlation; MC integrates over millions of draws and surfaces exactly those flaws.
- **Small range** — `RAND_MAX` is often just 32767, giving coarse, granular uniforms.
- **Global hidden state** — it mutates a single global; not thread-safe, and you can't have independent streams per thread.
- **Not reproducible cleanly** — `srand`/`rand` semantics vary.

The modern replacement is `<random>`:

```cpp
#include <random>
std::mt19937_64 eng(12345);                    // seeded engine
std::uniform_real_distribution<double> u(0.0, 1.0);
double x = u(eng);                              // good uniform in [0,1)
```

Saying "I'd use `rand()`" in a quant interview is an instant junior tell. The correct instinct is `<random>` with an explicit engine and distribution.

### Q2. Explain the engine/distribution split in `<random>`.

`<random>` deliberately separates the *source of randomness* from the *shape of the output*.

```cpp
#include <random>
std::mt19937_64 eng(42);                        // ENGINE: uniform bits, has state
std::normal_distribution<double> nd(0.0, 1.0);  // DISTRIBUTION: transform
double z = nd(eng);                             // wire them together
```

- **Engine** — a deterministic state machine producing uniformly-distributed integers. Seed it, call it, it advances. Examples: `mt19937_64`, `minstd_rand`.
- **Distribution** — maps the engine's uniform output to a target law (normal, uniform-real, exponential). Holds parameters, may hold a little state (e.g. Box-Muller caches a spare normal).

The benefit: one engine feeds many distributions, and you can swap the engine (Mersenne Twister -> PCG) without rewriting the distribution logic. The idiom is always `distribution(engine)`. Keep both objects alive across calls — don't reconstruct them per draw.

### Q3. Which engine should you default to, and when would you switch?

Default to **`mt19937_64`** — the 64-bit Mersenne Twister. It has a huge period (2^19937 - 1), well-understood statistical quality, and is available everywhere. It's the safe answer.

Switch when profiling shows RNG is a bottleneck or you need small state:

| Engine | Character |
|---|---|
| `mt19937_64` | Default; excellent quality, large 2.5KB state, moderate speed |
| PCG (pcg64) | Fast, tiny state, good statistics, easy multiple streams |
| xoshiro256++ | Very fast, tiny state, strong quality; great for parallel |
| `minstd_rand` | Legacy LCG; avoid for MC — poor quality |

```cpp
std::mt19937_64 eng(seed);   // reach for this first
```

PCG and xoshiro matter for massively parallel MC because their small state and built-in stream/jump-ahead make per-thread independence cheap. But they're not in the standard library — you add a header. For an interview: "`mt19937_64` by default, PCG/xoshiro if RNG is hot or I need many cheap independent streams."

### Q4. What is reproducibility here and what's the portability gotcha?

Reproducibility means: **same engine type + same seed + same call sequence produces the same numbers** — essential for regression tests and reproducing a failing scenario.

```cpp
std::mt19937_64 eng(20240101);   // fixed seed -> deterministic stream
// Re-run with the same seed, same code path -> identical draws.
```

The gotcha: **engines are portable but distributions are not.** The C++ standard specifies the exact integer sequence an engine produces, but it does *not* specify how `std::normal_distribution` or `std::uniform_real_distribution` transform that sequence. So the same seed gives:

- identical raw engine output on any conforming library, but
- **different normals** across libstdc++ vs libc++ vs MSVC.

Consequences for a quant desk: golden-value MC tests can pass on Linux and fail on Windows purely from distribution differences. Fixes: pin the toolchain for reference tests, or use your *own* transform (an inverse-CDF normal you control) instead of `std::normal_distribution` when cross-platform bit-reproducibility matters.

### Q5. Spot the bug: seeding inside the loop.

```cpp
double meanDraw(int n) {
    double sum = 0;
    for (int i = 0; i < n; ++i) {
        std::mt19937_64 eng(42);                 // BUG: reconstructed + reseeded
        std::normal_distribution<double> nd(0,1);
        sum += nd(eng);
    }
    return sum / n;
}
```

The engine is created and seeded with the *same* seed on every iteration, so every draw is the **first number of the same stream** — `n` identical values. The "mean of n samples" is actually one sample repeated; variance and standard error are meaningless.

Fix: construct engine and distribution **once**, outside the loop, and call the distribution repeatedly so the engine advances.

```cpp
double meanDraw(int n) {
    std::mt19937_64 eng(42);                     // once
    std::normal_distribution<double> nd(0, 1);   // once
    double sum = 0;
    for (int i = 0; i < n; ++i) sum += nd(eng);  // engine advances each call
    return sum / n;
}
```

This is a real, common bug — often hidden inside a helper that constructs an engine per call. The rule: RNG objects are long-lived; create once, reuse.

### Q6. Parallelize a Monte Carlo over 8 threads — how do you seed the RNGs?

The rule: **one independent engine per thread**, each seeded to a disjoint sub-sequence. Never share an engine.

```cpp
#include <thread>
#include <vector>
#include <random>

double mcParallel(int paths, int nThreads, std::uint64_t baseSeed) {
    std::vector<double> partial(nThreads, 0.0);
    std::vector<std::thread> pool;
    const int per = paths / nThreads;

    for (int t = 0; t < nThreads; ++t) {
        pool.emplace_back([&, t] {
            // Distinct, well-separated seed per thread via a seed_seq.
            std::seed_seq seq{baseSeed, static_cast<std::uint64_t>(t)};
            std::mt19937_64 eng(seq);                 // THREAD-LOCAL engine
            std::normal_distribution<double> nd(0, 1);
            double s = 0;
            for (int i = 0; i < per; ++i) s += /* payoff of */ nd(eng);
            partial[t] = s;                           // no shared RNG, no race
        });
    }
    for (auto& th : pool) th.join();
    double total = 0; for (double s : partial) total += s;
    return total / paths;
}
```

Key choices: each thread owns its `eng` (thread-local, so no data race and no correlated draws); seeds come from a `seed_seq` mixing a base seed with the thread index so the streams don't overlap; results accumulate into per-thread slots then reduce. For stronger guarantees against stream overlap, use an engine with **jump-ahead** (PCG/xoshiro) so thread `t` starts a fixed huge offset into one master stream.

### Q7. Why is sharing one engine across threads catastrophic — both mechanically and statistically?

Two separate disasters at once.

- **Mechanically (data race)**: an engine mutates internal state on every call. Two threads calling `eng()` concurrently race on that state — undefined behaviour: torn reads, corrupted state, crashes.
- **Statistically (even if you add a mutex)**: serializing access with a lock removes the race but is slow *and* wrong-headed. Worse, naive "fixes" like each thread copying the engine or default-seeding produce **correlated or identical streams**, so your "independent paths" are duplicates. The variance estimate collapses — you report a tight standard error that's a lie because the samples aren't independent.

```cpp
std::mt19937_64 shared(1);   // shared across threads
// Thread A and B both call shared() -> race (UB) OR, if locked, contention.
```

The takeaway an interviewer wants: **the engine is the shared mutable state of a parallel simulation.** The right design isn't to guard it — it's to *partition* it, one independent stream per thread. This is the single most common parallel-MC mistake.

### Q8. What are low-discrepancy (quasi-random) sequences and why use Sobol?

Quasi-random (low-discrepancy) sequences are *deterministic* points that fill the unit hypercube more **evenly** than pseudo-random points, which cluster and leave gaps. For Monte Carlo integration, more even coverage means faster convergence.

- Pseudo-random MC error shrinks like `O(1/sqrt(N))`.
- Quasi-Monte Carlo with Sobol can approach `O((log N)^d / N)` — nearly `1/N` for low effective dimension `d` and smooth integrands.

For a smooth European payoff, that can mean reaching a target accuracy with far fewer paths.

```text
Pseudo-random points: clumpy, ~1/sqrt(N) error.
Sobol points:         evenly spread, up to ~1/N error (smooth, low-dim).
```

Caveats interviewers expect you to add: Sobol's advantage **degrades in high dimensions** and for **discontinuous payoffs** (barriers, digitals); it needs good **dimension allocation** (Brownian bridge / PCA construction so the most important dimensions get the best-distributed coordinates) and **scrambling** to get error estimates. Sobol is deterministic, so you can't get a standard error from a single run — use randomized (scrambled) Sobol for that. It's not in `<random>`; you use a library (e.g. Sobol generators from Intel MKL or QuantLib).

### Q9. Box-Muller vs Ziggurat — how are normals actually generated?

Both turn uniform draws into normal draws; they trade simplicity for speed.

**Box-Muller** — takes two uniforms `u1, u2` and produces two independent standard normals:

```text
z0 = sqrt(-2*log(u1)) * cos(2*pi*u2)
z1 = sqrt(-2*log(u1)) * sin(2*pi*u2)
```

Simple and exact, but the `log`, `sqrt`, `sin`, `cos` per pair are expensive. (The polar/Marsaglia variant avoids the trig via rejection.)

**Ziggurat** — a table-based rejection method: for the common case it's a single table lookup and comparison (no transcendental functions), falling back to a slower path only in the rare tail. Much faster in practice, which is why high-performance libraries use it.

`std::normal_distribution`'s implementation is unspecified (often Box-Muller/polar). Points to make: Box-Muller is easy to implement yourself for **cross-platform reproducibility** (you control the transform); Ziggurat is what you want for **raw throughput**. And if you roll your own via inverse-CDF (`z = Phi^{-1}(u)`), you also get a monotone map that plays nicely with Sobol sequences.

### Q10. Generate correlated normals — tie RNG to Cholesky.

Draw a vector of **independent** standard normals from your engine, then multiply by the Cholesky factor `L` of the target covariance to correlate them: `X = L*Z`.

```cpp
#include <Eigen/Dense>
#include <random>

Eigen::VectorXd correlatedDraw(const Eigen::MatrixXd& L,
                               std::mt19937_64& eng) {
    std::normal_distribution<double> nd(0.0, 1.0);
    Eigen::VectorXd z(L.rows());
    for (int i = 0; i < z.size(); ++i) z[i] = nd(eng);  // independent Z
    return L * z;                                        // correlated X
}
```

The division of labour: **RNG's job** is to produce good *independent* normals `Z`; **linear algebra's job** (`L` from `Sigma = L*L^T`) is to impose the correlation. Keep them separate — factor `L` once and reuse, take the engine by reference (per-thread in parallel MC). This is the exact seam between this topic and the Linear Algebra topic, and interviewers like to walk you across it: "now make those normals correlated."

### Q11. How do you make a reproducible test for a Monte Carlo pricer?

Pin the seed and pin the reduction order, then assert on a tolerance, not exact equality.

```cpp
#include <random>
double priceMC(std::uint64_t seed, int paths /* ... */) {
    std::mt19937_64 eng(seed);                 // fixed seed -> deterministic
    std::normal_distribution<double> nd(0, 1);
    double sum = 0;
    for (int i = 0; i < paths; ++i) sum += /* payoff using */ nd(eng);
    return sum / paths;
}

// Test: same seed -> same price (within one std-lib build).
// assert(std::abs(priceMC(123, 100000) - EXPECTED) < 1e-6);
```

Rules that make it robust:

- **Fixed seed** so the stream is deterministic.
- **Deterministic summation order** — in parallel runs, float addition isn't associative, so reduce per-thread partials in a fixed order (or accept a looser tolerance).
- **Tolerance-based assertions** — numeric code is never bit-exact across platforms; compare against a golden value with an epsilon.
- Remember the **distribution portability caveat** (Q4): if the test must pass on multiple compilers, use your own inverse-CDF normal instead of `std::normal_distribution`.

### Q12. Why can two threads with "different seeds" still be statistically correlated?

Because seeding an engine with two nearby or arbitrary values does **not** guarantee the resulting streams are non-overlapping or uncorrelated — especially for engines whose state initialization spreads the seed poorly.

Problems:

- **Overlap** — two seeds might land the engine in regions of its single giant cycle that overlap within your draw budget, so threads share numbers.
- **Correlation** — for some engines, similar seeds produce correlated early output.

Robust approaches:

```cpp
// (a) Use a seed_seq to spread bits well across engine state:
std::seed_seq seq{baseSeed, threadId, someSalt};
std::mt19937_64 eng(seq);

// (b) Better: jump-ahead / streams (PCG, xoshiro) — one master stream,
//     thread t advances by t * huge_fixed_offset, guaranteeing disjoint runs.
```

The gold standard is **jump-ahead / distinct streams**: engines like PCG expose `advance()` and multiple stream ids, so you can hand each thread a provably disjoint sub-sequence. `seed_seq` mitigates the poor-seeding problem but doesn't *prove* non-overlap. Mentioning jump-ahead is the senior signal.

### Q13. When you draw millions of normals, is the distribution or the engine the bottleneck?

Usually the **distribution transform**, especially with `normal_distribution` — the `log`/`sqrt`/trig (Box-Muller) or table logic costs more than the engine's next-integer step.

Ways to speed it up:

- **Ziggurat** normal generator instead of Box-Muller (table lookup, no transcendentals in the common case).
- **Vectorized generation** — draw a batch of uniforms and transform them with SIMD (MKL's `vdRngGaussian` fills an array at once), rather than one call at a time.
- **Cheaper engine** — swap `mt19937_64` (large state, cache-unfriendly) for xoshiro/PCG (tiny state) if the engine itself shows up hot.

```cpp
// Batch generation beats one-at-a-time: fewer calls, SIMD-friendly.
// e.g. fill a std::vector<double> of N normals in one MKL call, then use them.
```

The method: **profile first.** For a simple GBM European, RNG can be a large fraction of runtime, so this matters. For a path-dependent product with heavy per-step work, RNG may be noise. Don't optimize the generator blind — measure whether engine or distribution dominates.

### Q14. What state does a distribution hold, and why can it surprise you?

Some distributions cache state between calls, which interacts badly with resetting or copying them mid-stream.

The classic case is `std::normal_distribution` implemented via Box-Muller: each computation yields *two* normals, so it returns one and **caches the second** for the next call.

```cpp
std::normal_distribution<double> nd(0, 1);
double a = nd(eng);   // computes a pair, returns first, stores second
double b = nd(eng);   // may return the cached second WITHOUT advancing eng
```

Surprises this causes:

- **Reproducibility** — if you `nd.reset()` or reconstruct the distribution partway, you discard the cached value and desync the stream.
- **Copying** — copying a distribution copies its cached state; a copied normal-distribution isn't a fresh one.
- **Interleaving** — mixing draws from two distributions sharing one engine can interleave unexpectedly because a cached normal doesn't consume engine output.

Practical rule: one long-lived distribution object per stream, don't reset it mid-run, and if you need precise control over engine consumption (e.g. to line up with a Sobol dimension), use a **stateless** transform like inverse-CDF instead of `std::normal_distribution`.

### Q15. Implement an inverse-CDF normal and say why a quant might prefer it.

Map a uniform `u` in (0,1) through the inverse standard-normal CDF `Phi^{-1}` (e.g. Acklam's or Moro's rational approximation) to get a normal.

```cpp
#include <cmath>
// Acklam-style inverse normal CDF approximation (coefficients elided/schematic).
double invNormCdf(double u) {
    // 0 < u < 1 assumed. Real code uses a rational approximation in regions.
    static const double a[] = {/* ... */};
    // ... rational approximation of Phi^{-1}(u) ...
    double z = /* rational approx of inverse CDF at u */;
    return z;  // standard normal quantile
}

double normalFromUniform(std::mt19937_64& eng) {
    std::uniform_real_distribution<double> u(0.0, 1.0);
    return invNormCdf(u(eng));      // one uniform -> one normal, monotone
}
```

Why a quant prefers it despite Box-Muller/Ziggurat being available:

- **One uniform in, one normal out**, monotonically — essential for **Sobol / quasi-Monte Carlo**, where each dimension must map a *single* low-discrepancy coordinate to a normal. Box-Muller consumes uniforms in pairs and destroys the low-discrepancy structure.
- **Cross-platform reproducibility** — you own the transform, so it's bit-identical everywhere (Q4's fix).
- **Antithetic variates** are trivial: `Phi^{-1}(1-u) = -Phi^{-1}(u)`.

Cost: the rational approximation is a few flops; accuracy is fine for finance. For plain pseudo-random MC where throughput rules, Ziggurat may win, but for QMC the inverse-CDF is the standard choice.

### Q16. What is `std::random_device` and when is it the wrong tool?

`std::random_device` is a **non-deterministic** source (hardware entropy or OS RNG) meant for *seeding*, not for bulk generation.

```cpp
std::random_device rd;                 // entropy source
std::mt19937_64 eng(rd());             // seed the PRNG from it, then use eng
```

Correct use: seed your PRNG once from it (for a "different run each time" scenario), then draw from the fast, reproducible engine.

Wrong uses:

- **Bulk MC draws** — it can be slow, and on some platforms (notably older libstdc++ on MinGW) it's **deterministic despite the name**, silently giving you the same sequence.
- **Reproducible tests** — you *want* a fixed seed there, so `random_device` is exactly wrong; hard-code the seed.

The nuance to raise: use `random_device` only to seed, prefer a `seed_seq` when seeding an engine with large state (one 32-bit draw under-seeds `mt19937_64`), and never rely on it for reproducibility or for the millions of draws in the simulation itself.

## Monte Carlo Engines in C++

### Summary

**What this topic covers**

How to build a Monte Carlo pricer in C++ that is reusable across products *and* fast enough for a desk — the capstone that pulls together RNG, linear algebra, templates, and concurrency. Four concern areas live here: (1) **the architecture** — the three-part split of a **PathGenerator** (simulates the underlying, e.g. GBM), a **Payoff** (turns a path into a cashflow), and an **accumulator** (running mean and variance to produce price plus standard error); (2) **the performance decision** — whether to compose those pieces with **templates** (compile-time, inlinable, zero dispatch cost) or **virtual functions** (runtime-flexible, vtable overhead on the hot loop); (3) **variance reduction** — antithetic variates (`+Z`/`-Z`) and control variates that cut the error for a given number of paths; and (4) **parallelization** — splitting paths across threads with a per-thread RNG, then reducing partial sums, being honest about float non-associativity. The through-line is that a Monte Carlo estimate is only as good as its **standard error**, so the engine must report `price +/- SE` where `SE ~ sigma_payoff / sqrt(N)`. Around 16 questions, from "what is the standard error" to "design and parallelize a generic templated engine."

**Mental model**

A Monte Carlo price is a sample mean: simulate `N` payoffs, average them, and the average estimates `E[discounted payoff]`. Everything else is engineering around that. Picture a pipeline: **RNG -> PathGenerator -> Payoff -> Accumulator**. The RNG feeds normals; the path generator evolves the underlying (`S_next = S*exp((r - 0.5*sigma^2)*dt + sigma*sqrt(dt)*Z)` for GBM); the payoff reads the path and returns a cashflow; the accumulator keeps a running sum and sum-of-squares so it can emit the mean *and* the standard error in one pass. The convergence law is unavoidable: error shrinks like `1/sqrt(N)`, so **cutting error in half costs 4x the paths** — which is why variance reduction (getting more accuracy per path) matters more than raw speed. The design tension is polymorphism cost: you want to swap payoffs and generators freely (that's the whole point of a reusable engine), but on a loop that runs 10 million times, a virtual call per iteration that blocks inlining is real money. The senior move is to **template on payoff and generator** so the compiler inlines the whole pipeline into one tight loop, resorting to virtual dispatch only at coarse boundaries where flexibility beats speed.

**Key terms**

- **PathGenerator** — object that simulates one (or a batch of) underlying path(s) under a chosen SDE (e.g. GBM).
- **Payoff** — callable mapping a path (or terminal value) to a cashflow; `std::function`, a functor, or a template parameter.
- **Accumulator** — running-statistics object: mean and variance (Welford) to yield price and standard error.
- **Standard error (SE)** — estimated uncertainty of the MC mean, `SE = sample_stdev / sqrt(N)`; the number you quote as `+/-`.
- **`1/sqrt(N)` convergence** — MC error scales inversely with the square root of path count.
- **Antithetic variates** — pair each `Z` with `-Z`; averages cancel odd-order error, reducing variance cheaply.
- **Control variate** — subtract a correlated quantity with known expectation to shrink variance.
- **Variance reduction** — techniques (antithetic, control, importance, QMC) that lower SE for fixed N.
- **CRTP / static polymorphism** — template-based dispatch that inlines, avoiding vtable cost on the hot path.
- **`transform_reduce`** — STL algorithm ideal for aggregating payoffs across paths in parallel.
- **Reduction** — combining per-thread partial sums into the final estimate.

**Why interviewers ask this**

This is *the* quant-dev design question — it exercises everything at once: numerical correctness (do you report a standard error, or just a point estimate that could be noise?), software design (can you carve out PathGenerator/Payoff/Accumulator so one engine prices calls, barriers, and Asians?), performance (do you know a virtual call per path kills inlining, and reach for templates/CRTP?), and concurrency (can you parallelize without corrupting the RNG or lying about the error?). Juniors write a monolithic loop that hard-codes a European call and returns a single number; seniors present a composable engine that's templated for speed, reports `price +/- SE`, adds antithetic variates almost for free, and parallelizes with per-thread RNG and a clean reduction. The interviewer is really asking: "can you build the thing the desk actually runs?"

**Common confusions**

- "More paths always fixes accuracy" — technically yes but at `1/sqrt(N)`: halving error is 4x the work. Variance reduction is the smarter lever.
- "A single MC number is the answer" — without a standard error it's meaningless; you can't tell signal from noise.
- "Virtual functions are fine, the compiler inlines them" — it generally can't devirtualize a call through a base pointer; on a 10M-path loop that's the bottleneck.
- "Antithetic variates always help" — they cancel odd-order dependence; for a payoff that's even/symmetric in the shock they can help little or nothing. Usually a win for monotone payoffs.
- "Just add up all threads' results" — float addition isn't associative, so parallel reduction order changes the last bits; fine numerically, but reproducibility needs a fixed order.
- "Reuse one RNG across threads to save memory" — the cardinal sin; races and correlates paths (see the RNG topic).

**What follows from this topic**

This topic *is* the convergence point. It consumes the **RNG** topic (per-thread engines, correlated normals) and the **Linear Algebra** topic (Cholesky for multi-asset baskets), and it hands off to **Concurrency** (thread pools, parallel STL, reduction) and to the **numerical-methods/Greeks** material (bump-and-revalue reuses the engine; pathwise/AAD Greeks change the payoff). If you can whiteboard a templated engine that reports `price +/- SE` and parallelizes correctly, you've demonstrated the full quant-developer stack in one design.

### Q1. Design the three-part architecture of a reusable Monte Carlo engine.

Split the engine into a **PathGenerator** (evolves the underlying), a **Payoff** (turns a path into a cashflow), and an **Accumulator** (running statistics). The engine just wires them together and drives the loop.

```cpp
// Schematic: engine is generic over how paths are made and how they pay.
template <class PathGen, class Payoff>
struct MonteCarloEngine {
    PathGen gen;
    Payoff  payoff;
    double  discount;               // exp(-r*T)

    template <class Rng>
    Result run(std::size_t nPaths, Rng& rng) {
        Accumulator acc;
        for (std::size_t i = 0; i < nPaths; ++i) {
            auto path = gen(rng);            // simulate underlying
            double cf = payoff(path);        // path -> cashflow
            acc.add(discount * cf);          // running mean + variance
        }
        return acc.result();                 // price +/- standard error
    }
};
```

Why this split: it's the Strategy pattern applied three ways. The same engine prices a European call, an Asian, or a barrier by swapping the `Payoff`; it prices under GBM or Heston by swapping the `PathGen`; and it always reports a proper standard error because the `Accumulator` is orthogonal to both. Each piece is independently testable. Templating on `PathGen` and `Payoff` lets the compiler inline the whole pipeline (see Q9) so the abstraction costs nothing at runtime.

### Q2. Implement a GBM path generator for a European option.

Under geometric Brownian motion, the exact one-step update to maturity `T` is `S_T = S0*exp((r - 0.5*sigma^2)*T + sigma*sqrt(T)*Z)` for a single normal `Z`. For a European (terminal-only) payoff you don't need intermediate steps.

```cpp
#include <cmath>
#include <random>

struct GbmTerminal {
    double S0, r, sigma, T;

    template <class Rng>
    double operator()(Rng& rng) const {
        std::normal_distribution<double> nd(0.0, 1.0);
        double z = nd(rng);
        double drift = (r - 0.5 * sigma * sigma) * T;
        double diff  = sigma * std::sqrt(T) * z;
        return S0 * std::exp(drift + diff);           // terminal spot
    }
};
```

For a **path-dependent** payoff (Asian, barrier) you'd step through `n` intervals of `dt = T/n`, applying `S_next = S*exp((r - 0.5*sigma^2)*dt + sigma*sqrt(dt)*Z)` at each and recording the whole path. Points that earn credit: the `-0.5*sigma^2` Ito correction in the drift (forgetting it is a classic bug that biases the price up); using the exact lognormal step for GBM rather than an Euler approximation (Euler is for SDEs without closed-form steps); and taking the RNG by reference so it's the caller's per-thread engine.

### Q3. What is the standard error and why must the engine report it?

The standard error is the estimated uncertainty of the Monte Carlo mean: `SE = s / sqrt(N)`, where `s` is the sample standard deviation of the discounted payoffs and `N` the number of paths. It tells you how much the estimate would wobble if you re-ran with fresh randomness.

```text
price_hat = mean(discounted payoffs)
s^2       = sample variance of discounted payoffs
SE        = s / sqrt(N)
report:   price_hat +/- 1.96 * SE     (95% confidence interval)
```

Without it, a single number is meaningless — you can't distinguish a converged price from noise. If a colleague says "the MC says 10.12" you must ask "plus or minus what?" A price of `10.12 +/- 0.05` and `10.12 +/- 2.0` are wildly different claims. Reporting `price +/- SE` also tells you when to stop adding paths (once SE is below your tolerance) and lets you compare variance-reduction techniques objectively (a method that halves SE for the same N is worth 4x the paths).

### Q4. Implement a numerically stable accumulator for mean and variance.

Use **Welford's online algorithm** — one pass, numerically stable, no catastrophic cancellation from the naive "sum of squares minus square of sum."

```cpp
struct Accumulator {
    long   n = 0;
    double mean = 0.0;
    double m2 = 0.0;        // sum of squared deviations

    void add(double x) {
        ++n;
        double delta = x - mean;
        mean += delta / n;
        m2   += delta * (x - mean);      // Welford update
    }
    double price() const { return mean; }
    double variance() const { return n > 1 ? m2 / (n - 1) : 0.0; }
    double standardError() const {
        return n > 1 ? std::sqrt(variance() / n) : 0.0;
    }
};
```

Why not the naive way: computing `E[X^2] - E[X]^2` by accumulating `sum` and `sumSq` separately subtracts two large near-equal numbers when the variance is small relative to the mean — **catastrophic cancellation**, which can even produce a negative "variance." Welford avoids it by updating the mean and the centered sum-of-squares incrementally. This matters because payoffs (especially deep-in-the-money) can have a large mean and comparatively small variance — exactly the regime where the naive formula loses precision.

### Q5. Should the payoff be a `std::function`, a functor, or a template parameter?

Depends on the flexibility-vs-speed tradeoff, and on the hot path speed usually wins.

| Approach | Dispatch | Inlinable | Flexibility |
|---|---|---|---|
| Template parameter | compile-time | yes (fully) | fixed at compile time |
| Functor / lambda | compile-time (if templated) | yes | per instantiation |
| `std::function` | runtime (type-erased) | no | swap at runtime |
| Virtual base | runtime (vtable) | no | swap at runtime |

```cpp
// Fast: payoff is a template param -> call inlines into the path loop.
template <class Payoff>
double run(std::size_t n, Payoff payoff, /* ... */);

// Flexible but slow on the hot loop: type-erased, no inlining.
double run(std::size_t n, std::function<double(double)> payoff, /* ... */);
```

Rule of thumb: **template on the payoff for the inner loop** so the whole pipeline inlines into one tight loop (a call vanilla European reduces to `max(S-K,0)` inlined). Use `std::function` or a virtual `Payoff` only at a **coarse boundary** — e.g. a scripting layer or a config-driven product selector — where you genuinely need runtime swapping and the per-path cost is amortized. Paying type-erasure cost 10 million times to gain flexibility you invoke once is the wrong trade.

### Q6. Add antithetic variates — how and why do they reduce variance?

For each standard normal draw `Z`, also use `-Z`, price both paths, and average the pair. The two are negatively correlated, so their average has lower variance than two independent draws.

```cpp
template <class Rng, class Payoff>
double antitheticPair(const GbmTerminal& gbm, Payoff payoff,
                      double discount, Rng& rng) {
    std::normal_distribution<double> nd(0.0, 1.0);
    double z = nd(rng);
    double drift = (gbm.r - 0.5*gbm.sigma*gbm.sigma) * gbm.T;
    double vol   = gbm.sigma * std::sqrt(gbm.T);
    double sPlus  = gbm.S0 * std::exp(drift + vol * z);   // uses +Z
    double sMinus = gbm.S0 * std::exp(drift - vol * z);   // uses -Z
    return 0.5 * discount * (payoff(sPlus) + payoff(sMinus));
}
```

Why it works: the estimator variance of an average of two variables is `0.5*(Var + Cov)`. Because `+Z` and `-Z` push the underlying in opposite directions, the payoffs are negatively correlated (`Cov < 0`), so the pair's variance is below the independent case — extra accuracy for nearly free (you reuse the same `Z`, half the RNG calls). Caveats: it helps most for **monotone** payoffs (a vanilla call) and can help little for payoffs that are symmetric/even in the shock. Also note each "path" is now a pair, so count pairs correctly when computing `N` and the standard error.

### Q7. What is a control variate and when is it worth the complexity?

A control variate subtracts a correlated quantity whose expectation you know exactly, cancelling much of the noise.

If `Y` is the payoff you want and `C` is a correlated variable with *known* mean `E[C]`, the estimator

```text
Y_cv = Y - beta * (C - E[C])
```

has the same expectation as `Y` (since `E[C - E[C]] = 0`) but lower variance when `beta ~ Cov(Y,C)/Var(C)` and `C` is well correlated with `Y`.

Classic finance example: pricing an **arithmetic-average Asian** (no closed form) using the **geometric-average Asian** as the control — the geometric version *has* a closed form, and the two payoffs are highly correlated, so variance drops dramatically.

```cpp
// Per path: record both the target payoff and the control payoff.
// Estimate beta from the sample, then form Y - beta*(C - E[C]) per path.
```

When it's worth it: when a cheap, **highly correlated** quantity with a known expectation exists (the correlation is what gives the variance reduction). When it isn't: a weakly correlated control adds bookkeeping and estimation noise (`beta` is estimated) for little gain. Control variates can beat antithetic variates by a wide margin when a good control is available, which is why the Asian example is a standard interview follow-up.

### Q8. Why does virtual dispatch hurt on the Monte Carlo hot path?

Because a virtual call through a base pointer is an indirect jump the compiler generally **cannot inline or devirtualize**, and it's executed once per path — millions of times.

```cpp
struct Payoff { virtual double operator()(double S) const = 0; };
// engine holds Payoff* ; each path does an indirect vtable call:
double cf = payoff->operator()(S);     // vtable load + indirect jump, no inline
```

Costs per virtual call on the hot loop:

- **No inlining** — the body (`max(S-K,0)`) can't fold into the loop, so the optimizer can't vectorize or hoist.
- **Indirect branch** — vtable pointer load then an indirect jump the branch predictor handles worse than a direct call.
- **Optimization barrier** — the compiler can't assume anything about the callee across the call.

For a European call the payoff is a single `max`; wrapping it in a virtual call can dominate the per-path cost. The fix is static polymorphism — template on the payoff (Q5) or use CRTP (Q9) — so the call inlines and the loop becomes a tight, vectorizable sequence. Virtual dispatch is fine at coarse granularity; it's the *per-path* frequency that makes it expensive here.

### Q9. Show CRTP static polymorphism to kill virtual dispatch in the engine.

CRTP (Curiously Recurring Template Pattern) gives you a polymorphic-looking interface that dispatches at compile time and inlines fully — no vtable.

```cpp
template <class Derived>
struct PayoffBase {
    double operator()(double S) const {
        // Static dispatch: resolves to Derived::eval at compile time, inlines.
        return static_cast<const Derived&>(*this).eval(S);
    }
};

struct Call : PayoffBase<Call> {
    double K;
    double eval(double S) const { return std::max(S - K, 0.0); }
};

// Engine templated on the concrete payoff -> whole loop inlines.
template <class Payoff, class Rng>
double run(const GbmTerminal& gbm, const Payoff& payoff,
           double discount, std::size_t n, Rng& rng) {
    Accumulator acc;
    for (std::size_t i = 0; i < n; ++i)
        acc.add(discount * payoff(gbm(rng)));   // no virtual call
    return acc.price();
}
```

The `static_cast` to `Derived` resolves the "virtual" call at compile time, so `payoff(S)` inlines to `max(S-K,0)` inside the loop — the optimizer can then vectorize and hoist. You keep the extensibility (add a new payoff by deriving from `PayoffBase<NewPayoff>`) without the runtime vtable cost. The tradeoff versus true virtual: the concrete type must be known at compile time (no runtime swapping through a common base pointer, and more template instantiation / code bloat). That's the right trade for a hot numeric loop.

### Q10. Why is `1/sqrt(N)` convergence the key economic fact of Monte Carlo?

Because it dictates that accuracy is *expensive*: the standard error falls only with the square root of the path count, so **each extra digit of precision costs 100x the paths**.

```text
SE ~ sigma_payoff / sqrt(N)
halve the error   -> 4x the paths
10x the accuracy  -> 100x the paths
```

Consequences that shape every design decision:

- **Variance reduction beats brute force** — antithetic/control variates lower `sigma_payoff`, buying accuracy without the quadratic path cost. That's why they're worth real engineering.
- **Quasi-Monte Carlo (Sobol)** can approach `1/N` for smooth low-dimensional problems — a categorically better rate, hence its appeal.
- **Parallelism helps throughput, not the rate** — 8 threads give ~8x paths per second, but you still need 4x the paths to halve the error; it doesn't change the `1/sqrt(N)` law, just how fast you can reach a given N.

Stating this law and its "4x for half the error" corollary shows you understand *why* the fancy techniques exist rather than treating them as trivia.

### Q11. Parallelize the engine over paths and reduce the results.

Split the `N` paths across threads, give **each thread its own RNG** (per the RNG topic), accumulate per-thread, then combine the partial statistics.

```cpp
#include <thread>
#include <vector>
#include <random>

template <class PathGen, class Payoff>
Accumulator runParallel(const PathGen& gen, const Payoff& payoff,
                        double discount, std::size_t nPaths,
                        int nThreads, std::uint64_t baseSeed) {
    std::vector<Accumulator> locals(nThreads);
    std::vector<std::thread> pool;
    const std::size_t per = nPaths / nThreads;

    for (int t = 0; t < nThreads; ++t) {
        pool.emplace_back([&, t] {
            std::seed_seq seq{baseSeed, (std::uint64_t)t};
            std::mt19937_64 rng(seq);              // THREAD-LOCAL engine
            Accumulator& acc = locals[t];          // no false sharing: own slot
            for (std::size_t i = 0; i < per; ++i)
                acc.add(discount * payoff(gen(rng)));
        });
    }
    for (auto& th : pool) th.join();

    Accumulator total;                             // merge partials
    for (auto& a : locals) total.merge(a);         // combine mean+variance
    return total;
}
```

Design points: partition paths, one independent engine per thread (never share — races and correlates), accumulate into per-thread `Accumulator`s (each thread writes only its slot; pad/align to avoid false sharing), then **merge** using a parallel-variance combine (Chan's formula) so the final standard error is correct across the whole sample. `std::execution::par` with `transform_reduce` is a lighter-weight alternative for simple cases.

### Q12. Merging per-thread accumulators — why can't you just add the variances?

Because variance isn't additive across groups with different means — you need the **parallel (Chan) combine** that accounts for the gap between the group means.

```cpp
// Merge accumulator b into this (parallel variance, Chan et al.).
void Accumulator::merge(const Accumulator& b) {
    if (b.n == 0) return;
    if (n == 0) { *this = b; return; }
    long   nAB   = n + b.n;
    double delta = b.mean - mean;
    mean = (n * mean + b.n * b.mean) / nAB;             // pooled mean
    m2   = m2 + b.m2 + delta * delta * (double(n) * b.n) / nAB;  // correction term
    n    = nAB;
}
```

The `delta*delta*n*b.n/nAB` term is the key: two sub-samples can each have small internal variance but different means, and that between-group spread contributes to the total variance. Naively summing the `m2` values (or the variances) omits it and understates the standard error — you'd report a falsely tight confidence interval. This is the parallel analogue of the Welford update and the correct way to keep the standard error honest when you split work across threads.

### Q13. Aggregate payoffs with `transform_reduce` and parallel STL.

For a simple European where each path is independent, `std::transform_reduce` with `std::execution::par` expresses the whole "map payoff, sum results" in one parallel line — but the RNG makes it subtle.

```cpp
#include <numeric>
#include <execution>
#include <vector>

// Pre-generate per-path seeds (or normals) so each element is independent,
// then map+reduce in parallel. Avoids sharing one engine across the reduction.
double priceEuropean(const std::vector<std::uint64_t>& seeds,
                     const GbmTerminal& gbm, double K, double discount) {
    double sum = std::transform_reduce(
        std::execution::par, seeds.begin(), seeds.end(), 0.0,
        std::plus<>{},
        [&](std::uint64_t s) {
            std::mt19937_64 rng(s);                 // independent per element
            double S = gbm(rng);
            return discount * std::max(S - K, 0.0);
        });
    return sum / seeds.size();
}
```

Why it's clean: `transform_reduce` is exactly "map each input to a value, then reduce with `+`," which is what MC aggregation is; `execution::par` parallelizes it with no manual thread management. The catch — and the interview point — is that the lambda **must not share mutable RNG state** across invocations (the runtime may call it on any thread in any order), so each element carries its own seed/engine. And because parallel reduction order is unspecified, the float sum's last bits aren't reproducible; fix the order or accept a tolerance (Q14).

### Q14. Float addition isn't associative — how does that affect a parallel MC?

Because `(a + b) + c` can differ from `a + (b + c)` in the last bits, a parallel reduction that sums partials in a **non-deterministic order** gives a slightly different price each run — even with identical per-path values.

```text
Serial:   sum in path order            -> price P0 (deterministic)
Parallel: threads finish in any order  -> sum order varies -> P0 +/- a few ULPs
```

Implications and fixes:

- **Numerically** it's harmless — the difference is far below the Monte Carlo standard error, so the *statistical* answer is unaffected.
- **Reproducibility** suffers — regression tests that assert bit-exact prices will flake. Fix by reducing in a **fixed order** (e.g. always combine thread partials by ascending thread id, as in Q11/Q12) rather than as-they-complete, or by asserting on a tolerance instead of equality.
- Beware `-ffast-math`, which lets the compiler reassociate freely and makes even the serial result order-dependent.

The mature stance: separate "is the price statistically correct" (yes, order doesn't matter) from "is the run bit-reproducible" (only with a fixed reduction order). Quote a tolerance in tests and pin the reduction order when you need determinism.

### Q15. Put it together — a full templated Monte Carlo engine skeleton.

A single generic engine, templated on generator and payoff so the pipeline inlines, reporting `price +/- SE`.

```cpp
#include <cmath>
#include <random>

struct Result { double price, standardError; };

template <class PathGen, class Payoff>
class MonteCarlo {
public:
    MonteCarlo(PathGen g, Payoff p, double discount)
        : gen_(std::move(g)), payoff_(std::move(p)), disc_(discount) {}

    template <class Rng>
    Result run(std::size_t nPaths, Rng& rng) const {
        Accumulator acc;
        for (std::size_t i = 0; i < nPaths; ++i) {
            auto path = gen_(rng);               // simulate underlying
            acc.add(disc_ * payoff_(path));      // discounted cashflow
        }
        return { acc.price(), acc.standardError() };
    }
private:
    PathGen gen_;
    Payoff  payoff_;
    double  disc_;
};

// Usage: price a European call under GBM.
//   GbmTerminal gbm{S0, r, sigma, T};
//   auto call = [K](double S){ return std::max(S - K, 0.0); };
//   MonteCarlo engine(gbm, call, std::exp(-r*T));
//   std::mt19937_64 rng(12345);
//   Result res = engine.run(1'000'000, rng);   // res.price +/- res.standardError
```

What makes it good: `PathGen` and `Payoff` are template parameters, so `gen_(rng)` and `payoff_(path)` inline into one tight loop with no virtual dispatch; the `Accumulator` (Welford) yields both price and standard error in a single pass; the RNG is passed by reference so the caller controls seeding (and, in parallel, per-thread engines). Swap the lambda for an Asian/barrier payoff, or `GbmTerminal` for a stepping Heston generator, and the engine is unchanged. Layer antithetic/control variates inside the payoff or generator, and parallelize by running this per thread and merging accumulators (Q11-Q12).

### Q16. How do you validate a Monte Carlo pricer is correct?

Cross-check against known-exact references and structural identities, using tolerances rather than exact equality.

- **Closed-form benchmark** — for a European under GBM, compare the MC price to the Black-Scholes analytic price; they should agree within a few standard errors. If MC is off by more than ~2-3 SE, something's wrong (missing Ito drift term, discount error).
- **Standard-error sanity** — the |MC - analytic| gap should shrink like `1/sqrt(N)` as you add paths, and roughly match the reported SE. If the gap doesn't shrink, you have bias, not variance.
- **Put-call parity** — `C - P = S0 - K*exp(-r*T)`; a property test that must hold for your MC call and put prices.
- **Convergence plot** — price vs N should stabilize inside the confidence band.
- **Fixed seed reproducibility** — same seed reproduces the run for debugging (mind the distribution-portability caveat from the RNG topic).

```cpp
// Test: MC European call within 3 standard errors of Black-Scholes.
//   Result r = engine.run(1'000'000, rng);
//   assert(std::abs(r.price - blackScholesCall(...)) < 3 * r.standardError);
```

The senior instinct is to test **numerical code with tolerances and reference/golden values**, add **property tests** (parity) that hold regardless of parameters, and confirm the **error scales as `1/sqrt(N)`** — distinguishing a *biased* estimator (wrong model/drift) from a merely *noisy* one (needs more paths or variance reduction).
## Numerical Methods Implementation

### Summary

**What this topic covers**

The numerical toolkit a quant library needs when there is no closed form — or when the closed form itself must be inverted. Four families dominate: (1) **root finding** — Newton-Raphson, bisection, and Brent — with the **implied volatility solver** as the canonical worked example (invert Black-Scholes for the sigma that reprices a market quote); (2) **interpolation** — linear and cubic spline — for building yield and volatility curves from discrete market points; (3) **grid methods** — **finite-difference PDE** solvers (explicit, implicit, Crank-Nicolson) for the Black-Scholes PDE, and **binomial/trinomial trees** with backward induction for American early exercise; and (4) **quadrature** — Simpson and Gauss-Legendre — for integrals like the normal CDF N(x) or expectations under a density. The 16 questions here focus on the C++ *implementation* — how you structure the solver, where floating-point pitfalls bite (step size, stability, cancellation), and how you pick a method under an interview's "which and why". The maths itself lives in the Quantitative Methods primer; here you write the code that runs it.

**Mental model**

Every numerical method is a trade between **robustness**, **speed**, and **smoothness of the input**. Root finders sit on a spectrum: bisection always converges but linearly (halving the bracket each step); Newton converges quadratically but needs a derivative and can diverge or cycle; Brent combines bracketing with inverse-quadratic interpolation to get near-Newton speed with bisection's guarantee — it is the default when you can bracket the root. PDE and tree methods discretize continuous time and space onto a grid, then march **backward** from the known payoff at maturity to today; the American-option twist is a `max(continuation, intrinsic)` check at every node. Quadrature approximates an integral as a weighted sum of function evaluations; Gauss places nodes and weights to integrate high-degree polynomials exactly. The recurring engineering theme: **discretization introduces error controlled by a step size h**, and shrinking h trades accuracy against runtime and, past a point, against floating-point noise. Choose the coarsest grid that meets tolerance.

**Key terms**

- **Newton-Raphson** — x_{n+1} = x_n - f(x_n)/f'(x_n); quadratic convergence, needs the derivative (vega for implied vol), can diverge.
- **Bisection** — repeatedly halve a bracket [a,b] where f(a), f(b) have opposite signs; linear, guaranteed, derivative-free.
- **Brent's method** — hybrid of bisection, secant, and inverse-quadratic interpolation; robust and fast, the practical default.
- **Implied volatility** — the sigma that makes Black-Scholes reprice an observed option price; found by inverting BS numerically.
- **Vega** — dPrice/dsigma; the derivative Newton needs for the implied-vol root find.
- **Linear interpolation** — connect points with straight lines; cheap, continuous but not smooth (kinked derivative).
- **Cubic spline** — piecewise cubics with matched first and second derivatives; smooth, used for discount/vol curves.
- **Finite-difference PDE** — discretize the Black-Scholes PDE on a (S, t) grid; explicit, implicit, or Crank-Nicolson time-stepping.
- **Crank-Nicolson** — average of explicit and implicit schemes; second-order accurate in time, unconditionally stable.
- **Binomial tree** — underlying moves up/down each step; backward induction values the option, with an early-exercise check for American.
- **Backward induction** — start from payoff at maturity, roll back node by node discounting expected value.
- **Quadrature** — numerical integration as a weighted sum; Simpson (equal spacing) and Gauss-Legendre (optimal nodes/weights).
- **Stability** — whether discretization errors decay (stable) or blow up; the explicit FD scheme is only conditionally stable.

**Why interviewers ask this**

This is where "can you code" meets "do you understand the numerics". A junior candidate reaches for Newton, forgets it can diverge, and hardcodes a magic iteration count with no tolerance. A senior candidate brackets the root, picks Brent or a safeguarded Newton (Newton step, fall back to bisection if it leaves the bracket), states the convergence order, and knows implied vol has no closed form so it *must* be solved numerically. The implied-vol question is the single most common quant-dev coding exercise because it exercises Black-Scholes, a root finder, floating-point comparison, and edge cases (deep OTM options where vega -> 0 and Newton stalls) all at once. PDE and tree questions probe whether you understand stability and early exercise — the reasons a bank runs a grid engine at all instead of a closed form.

**Common confusions**

- "Newton is always fastest" — only near a good initial guess with well-behaved f'. Where vega is tiny (deep in/out of the money), Newton overshoots wildly; bracket and safeguard it.
- "More grid points is always better" — beyond a point, extra nodes add runtime and floating-point noise without reducing model error; and an *explicit* FD scheme diverges if the time step is too large relative to the space step.
- "Bisection and Newton are interchangeable" — bisection needs a sign-change bracket, not a derivative; Newton needs a derivative, not a bracket. They fail in opposite situations.
- "Linear interpolation is fine for everything" — for a discount curve it produces kinked forward rates (discontinuous derivative), which looks wrong to a rates desk; splines fix the smoothness.
- "Simpson beats Gauss because it's simpler" — for smooth integrands Gauss-Legendre reaches the same accuracy with far fewer function evaluations; Simpson wins only when you're stuck with equally spaced samples.

**What follows from this topic**

Root finding underpins calibration (fit model params so the model reprices the market — an optimization loop, see the Quantitative Methods primer). The Monte Carlo engine is the other pillar of numerical pricing; PDE/tree methods are its grid-based alternative for low-dimensional and early-exercise problems. Implementing these fast leads directly into **Low-Latency C++ Techniques** (the inner grid loop is a hot loop) and **Concurrency & Parallelism** (independent tree nodes and MC paths parallelize). Floating-point stability here is the same discipline the money-and-epsilon material demands elsewhere.

### Q1. Implement a Newton-Raphson root finder in C++. What are its failure modes?

Newton iterates x_{n+1} = x_n - f(x_n)/f'(x_n), converging quadratically near a simple root. A production version takes the function and its derivative as callables, and guards against non-convergence:

```cpp
#include <cmath>
#include <functional>
#include <stdexcept>

double newton(std::function<double(double)> f,
              std::function<double(double)> fprime,
              double x0, double tol = 1e-10, int maxIter = 100) {
    double x = x0;
    for (int i = 0; i < maxIter; ++i) {
        double fx = f(x);
        if (std::abs(fx) < tol) return x;      // converged on value
        double dfx = fprime(x);
        if (std::abs(dfx) < 1e-14)             // flat -> divide-by-zero
            throw std::runtime_error("derivative near zero");
        double step = fx / dfx;
        x -= step;
        if (std::abs(step) < tol) return x;    // converged on step
    }
    throw std::runtime_error("Newton failed to converge");
}
```

Failure modes: (1) **derivative near zero** — the step explodes; (2) **overshoot / divergence** — a poor initial guess or an inflection sends x off to infinity; (3) **cycling** — x oscillates between two points and never converges. Note the two stopping criteria: on the function value AND on the step size. Never trust a bare `maxIter` with no tolerance, and never compare `fx == 0.0`.

### Q2. Implement bisection. When would you prefer it over Newton?

Bisection needs a bracket [a,b] with f(a) and f(b) of opposite sign. Each step halves the interval, so it converges linearly and *always* succeeds if the bracket is valid:

```cpp
double bisection(std::function<double(double)> f,
                 double a, double b, double tol = 1e-10, int maxIter = 200) {
    double fa = f(a), fb = f(b);
    if (fa * fb > 0.0) throw std::runtime_error("root not bracketed");
    for (int i = 0; i < maxIter; ++i) {
        double m = a + 0.5 * (b - a);          // avoids overflow vs (a+b)/2
        double fm = f(m);
        if (std::abs(fm) < tol || 0.5 * (b - a) < tol) return m;
        if (fa * fm < 0.0) { b = m; fb = fm; }
        else               { a = m; fa = fm; }
    }
    return a + 0.5 * (b - a);
}
```

Prefer bisection when you cannot compute a derivative, when f is noisy or non-smooth, or when robustness matters more than speed. It is slow (about 3.3 iterations per decimal digit) but cannot diverge. In practice the best of both worlds is Brent, or a **safeguarded Newton**: take a Newton step, but if it lands outside the current bracket, fall back to a bisection step.

### Q3. Implement an implied-volatility solver by inverting Black-Scholes. Why must it be numerical?

Black-Scholes gives price as a function of sigma, but there is no closed-form inverse: given a market price, no formula returns sigma, so you solve C_market - C_BS(sigma) = 0 numerically. Newton is natural because the derivative is **vega**, which has a clean formula:

```cpp
#include <cmath>

double normCdf(double x) {                      // N(x) via erfc
    return 0.5 * std::erfc(-x / std::sqrt(2.0));
}
double normPdf(double x) {
    return std::exp(-0.5 * x * x) / std::sqrt(2.0 * M_PI);
}

double bsCall(double S, double K, double r, double T, double sigma) {
    double sd = sigma * std::sqrt(T);
    double d1 = (std::log(S / K) + (r + 0.5 * sigma * sigma) * T) / sd;
    double d2 = d1 - sd;
    return S * normCdf(d1) - K * std::exp(-r * T) * normCdf(d2);
}
double bsVega(double S, double K, double r, double T, double sigma) {
    double sd = sigma * std::sqrt(T);
    double d1 = (std::log(S / K) + (r + 0.5 * sigma * sigma) * T) / sd;
    return S * std::sqrt(T) * normPdf(d1);      // dPrice/dsigma
}

double impliedVol(double price, double S, double K, double r, double T,
                  double tol = 1e-8, int maxIter = 100) {
    double sigma = 0.20;                         // sensible seed
    for (int i = 0; i < maxIter; ++i) {
        double diff = bsCall(S, K, r, T, sigma) - price;
        if (std::abs(diff) < tol) return sigma;
        double v = bsVega(S, K, r, T, sigma);
        if (v < 1e-12) break;                    // vega collapse -> bail to bisection
        sigma -= diff / v;
        if (sigma <= 0.0) sigma = 1e-4;          // keep it positive
    }
    // fallback: robust bracketed search on [1e-4, 5.0]
    return bisection([&](double s){ return bsCall(S,K,r,T,s) - price; },
                     1e-4, 5.0, tol);
}
```

It must be numerical because the map sigma -> price has no elementary inverse. The production subtlety: for deep in/out-of-the-money options **vega -> 0**, so Newton's step explodes; detect the vega collapse and fall back to a bracketed solver (Brent or bisection). Also validate the price is within no-arbitrage bounds before solving, or the root does not exist.

### Q4. Explain Brent's method. Why is it the practical default for 1-D root finding?

Brent combines three techniques: **bisection** (guaranteed, keeps a bracket), the **secant method** (uses the last two points for a linear estimate), and **inverse quadratic interpolation** (fits a parabola through three points). It attempts the fast interpolation step but rejects it and falls back to bisection whenever the step would leave the bracket or fail to shrink the interval fast enough. The result: superlinear convergence in the common case, with bisection's ironclad guarantee in the worst case, and no derivative required.

It is the default because it needs only function evaluations (unlike Newton), never diverges (unlike Newton or secant), and is far faster than pure bisection. `boost::math::tools::brent_find_minima` and Boost's `bracket_and_solve_root` provide production implementations. For implied vol, a Brent solve on [1e-4, 5.0] is a common robust choice that sidesteps the vega-collapse problem entirely. Trade-off vs Newton: Brent needs a bracket; Newton needs a derivative. Where you have a cheap, well-behaved derivative and a good seed, safeguarded Newton is faster; otherwise Brent.

### Q5. Implement linear interpolation for a yield curve. What are its limitations?

Given sorted maturities and rates, linear interpolation finds the bracketing segment and blends:

```cpp
#include <vector>
#include <algorithm>
#include <cassert>

double linearInterp(const std::vector<double>& xs,
                    const std::vector<double>& ys, double x) {
    assert(xs.size() == ys.size() && xs.size() >= 2);
    if (x <= xs.front()) return ys.front();      // flat extrapolation
    if (x >= xs.back())  return ys.back();
    auto it = std::upper_bound(xs.begin(), xs.end(), x);
    size_t i = (it - xs.begin()) - 1;            // xs[i] <= x < xs[i+1]
    double t = (x - xs[i]) / (xs[i + 1] - xs[i]);
    return ys[i] + t * (ys[i + 1] - ys[i]);
}
```

`upper_bound` gives O(log n) lookup on the sorted grid. Limitations: the interpolant is **continuous but not smooth** — its derivative jumps at each knot. For a discount curve, interpolating zero rates linearly produces **discontinuous instantaneous forward rates** (piecewise constant with jumps), which a rates desk considers unrealistic and which can make hedges misbehave. Linear also does nothing sensible in extrapolation (here we clamp flat). For curve building you usually want a smoother scheme (cubic spline, or monotone/tension splines on the log-discount factors) so forwards are continuous.

### Q6. What is a cubic spline and why prefer it for curve construction?

A natural cubic spline fits a separate cubic polynomial on each interval between knots, choosing coefficients so that the value, **first derivative, and second derivative are continuous** across every knot (the "natural" variant sets the second derivative to zero at the endpoints). That C2 continuity is exactly what a rates or vol curve wants: smooth forward rates and smooth local volatilities, no kinks.

Construction solves a **tridiagonal linear system** for the second derivatives at the knots (O(n) via the Thomas algorithm), then evaluates the local cubic:

```cpp
struct CubicSpline {
    std::vector<double> x, y, m;   // m = second derivatives at knots
    CubicSpline(std::vector<double> xs, std::vector<double> ys);  // solves tridiagonal system
    double operator()(double xq) const {
        auto it = std::upper_bound(x.begin(), x.end(), xq);
        size_t i = std::clamp<size_t>((it - x.begin()) - 1, 0, x.size() - 2);
        double h = x[i + 1] - x[i];
        double a = (x[i + 1] - xq) / h, b = (xq - x[i]) / h;
        return a * y[i] + b * y[i + 1]
             + ((a*a*a - a) * m[i] + (b*b*b - b) * m[i + 1]) * (h*h) / 6.0;
    }
};
```

Caveat: plain cubic splines can **overshoot** and are not monotonicity-preserving, so a curve of positive discount factors can develop negative forwards. Desks often use monotone-convex or tension splines instead. But for a general smooth interpolation question, the natural cubic spline is the textbook answer — smoother than linear, cheap to build, C2 everywhere.

### Q7. Derive and implement an explicit finite-difference scheme for the Black-Scholes PDE. What is its stability constraint?

The Black-Scholes PDE is dV/dt + 0.5*sigma^2*S^2*d2V/dS2 + r*S*dV/dS - r*V = 0. Discretize S onto a grid of spacing dS and time into steps dt, approximate the derivatives with central/forward differences, and march backward from the payoff at maturity. The **explicit** scheme expresses each new node directly from three old nodes:

```cpp
// grid: j = 0..M in S, marching from maturity back to today
for (int n = N - 1; n >= 0; --n) {
    std::vector<double> next(M + 1);
    for (int j = 1; j < M; ++j) {
        double S = j * dS;
        double a = 0.5 * dt * (sigma*sigma*j*j - r*j);
        double b = 1.0 - dt * (sigma*sigma*j*j + r);
        double c = 0.5 * dt * (sigma*sigma*j*j + r*j);
        next[j] = a * V[j-1] + b * V[j] + c * V[j+1];
    }
    next[0] = 0.0;                         // boundary at S=0 (call)
    next[M] = Smax - K * std::exp(-r * (N - n) * dt);  // large-S boundary
    V = std::move(next);
}
```

The explicit scheme is **only conditionally stable**: errors blow up unless roughly dt <= 1/(sigma^2 * M^2), i.e. the time step must shrink like the *square* of the space refinement. Refine the S-grid and you must refine dt quadratically or the solution oscillates and diverges. That fragility is why implicit and Crank-Nicolson schemes are preferred despite needing a linear solve.

### Q8. Compare explicit, implicit, and Crank-Nicolson schemes.

| Scheme | Stability | Accuracy (time) | Cost per step | Notes |
|---|---|---|---|---|
| Explicit | Conditional (dt <= ~1/(sigma^2 M^2)) | O(dt) | Cheap (matrix-vector) | Simple but can diverge; tiny dt required |
| Implicit (backward Euler) | Unconditional | O(dt) | Solve tridiagonal system | Stable at any dt, only first-order in time |
| Crank-Nicolson | Unconditional | O(dt^2) | Solve tridiagonal system | Best accuracy; can show spurious oscillations near non-smooth payoffs |

Explicit reads new values directly from old ones — no linear solve, but fragile. Implicit and Crank-Nicolson relate several unknown new-time nodes at once, so each step solves a **tridiagonal system** (O(M) via the Thomas algorithm). Crank-Nicolson averages the explicit and implicit operators, giving second-order accuracy in time while staying unconditionally stable — the usual default. Its one wart: near a kinked payoff (a digital, or a vanilla at the strike) it can produce oscillations in the Greeks; **Rannacher stepping** (a couple of implicit steps first) smooths that out. For an interview: explicit = simple but conditionally stable; implicit = stable, first-order; Crank-Nicolson = stable and second-order, the practical choice.

### Q9. Implement a binomial tree pricer with backward induction. How do you handle American early exercise?

Build a recombining tree with up factor u = exp(sigma*sqrt(dt)), down d = 1/u, and risk-neutral probability p = (exp(r*dt) - d)/(u - d). Fill terminal payoffs, then roll back discounting the expected value:

```cpp
double binomialAmericanPut(double S, double K, double r, double T,
                           double sigma, int N) {
    double dt = T / N;
    double u = std::exp(sigma * std::sqrt(dt));
    double d = 1.0 / u;
    double disc = std::exp(-r * dt);
    double p = (std::exp(r * dt) - d) / (u - d);

    std::vector<double> V(N + 1);
    for (int j = 0; j <= N; ++j) {                  // terminal payoffs
        double ST = S * std::pow(u, N - j) * std::pow(d, j);
        V[j] = std::max(K - ST, 0.0);
    }
    for (int n = N - 1; n >= 0; --n) {              // backward induction
        for (int j = 0; j <= n; ++j) {
            double cont = disc * (p * V[j] + (1.0 - p) * V[j + 1]);
            double ST   = S * std::pow(u, n - j) * std::pow(d, j);
            double intrinsic = K - ST;
            V[j] = std::max(cont, intrinsic);       // American: exercise vs hold
        }
    }
    return V[0];
}
```

The **early-exercise** handling is the single extra line: at every interior node, compare the discounted continuation value against the immediate intrinsic value and take the larger. A European option omits that `max` and just discounts. Trinomial trees add a middle "stay" branch for better convergence and map naturally onto finite-difference grids. Convergence is O(1/N) and oscillatory; averaging N and N+1 steps, or using a control variate against the European closed form, smooths it.

### Q10. Implement Simpson's rule and explain when Gaussian quadrature is better.

Simpson's rule fits parabolas over pairs of equal subintervals: integral ~= (h/3) * [f0 + 4f1 + 2f2 + 4f3 + ... + fn], error O(h^4):

```cpp
double simpson(std::function<double(double)> f, double a, double b, int n) {
    if (n % 2 == 1) ++n;                     // needs an even number of intervals
    double h = (b - a) / n;
    double s = f(a) + f(b);
    for (int i = 1; i < n; ++i)
        s += (i % 2 ? 4.0 : 2.0) * f(a + i * h);
    return s * h / 3.0;
}
```

Gauss-Legendre instead chooses **both** the nodes and the weights optimally, integrating a degree-(2k-1) polynomial exactly with only k points. For smooth integrands it reaches a target accuracy with far fewer function evaluations than Simpson — which matters when each `f` is an expensive pricing call. Use Simpson when your samples are forced onto an equal grid (e.g. tabulated data) or the integrand is only piecewise smooth; use Gauss when `f` is smooth and evaluations are costly. For discontinuous or oscillatory integrands, split the domain at the kinks first or neither converges well.

### Q11. How do you compute the normal CDF N(x) accurately in C++?

The cleanest route is the standard library's `std::erf`/`std::erfc`, since N(x) = 0.5 * erfc(-x / sqrt(2)):

```cpp
double normCdf(double x) {
    return 0.5 * std::erfc(-x * M_SQRT1_2);   // M_SQRT1_2 = 1/sqrt(2)
}
```

`erfc` (the complementary error function) is used rather than `erf` because it is accurate in the **far tail**: for large positive x, `1 - erf(x)` suffers catastrophic cancellation, whereas `erfc(x)` computes the tiny tail probability directly. If you cannot use `<cmath>`'s erf (older/portable code), the classic **Abramowitz-Stegun** rational approximation or **Cody's algorithm** gives ~1e-7 / near-machine accuracy respectively. Avoid rolling your own numerical integration of the pdf for N(x) — it is slower and less accurate than the well-tuned erfc. This function is called billions of times in a pricing/risk run, so it is also a prime target for vectorization and caching.

### Q12. Why does catastrophic cancellation matter in finite-difference Greeks, and how do you mitigate it?

A bump-and-revalue Greek approximates a derivative as (V(x+h) - V(x-h)) / (2h). When h is small, V(x+h) and V(x-h) are nearly equal, so subtracting them **cancels most significant digits** — you difference two numbers agreeing to, say, 12 digits and keep only 3 or 4 meaningful ones, then amplify the noise by dividing by a small 2h. Shrinking h reduces the *truncation* error but *increases* this cancellation/round-off error, so total error is U-shaped with an optimal h around sqrt(machine-epsilon) for a first derivative (about 1e-8 for double), and cube-root for a central second derivative.

Mitigations: (1) use `double`, never `float`, and pick h near the optimal scale, relative to x (h = eps^(1/2) * max(|x|, 1)); (2) use **central** differences (O(h^2) truncation) over forward (O(h)); (3) for smoother functions use `std::log1p`/`std::expm1` to avoid cancellation inside the pricer itself; (4) best of all, switch to **AAD (adjoint automatic differentiation)**, which computes exact derivatives with no bump and no cancellation, and delivers all Greeks in roughly a constant multiple of one pricing. Cancellation is *the* reason AAD displaced bumping for large risk runs.

### Q13. You need European option Greeks. Bump-and-revalue vs analytic vs AAD — which and why?

| Method | Accuracy | Cost for k Greeks | When to use |
|---|---|---|---|
| Analytic | Exact | ~free (formula) | Closed form exists (BS vanilla) — always prefer |
| Bump-and-revalue | Approx (cancellation) | (k+1) pricings (or 2k central) | No closed form; small number of Greeks; quick to code |
| AAD | Exact (to round-off) | ~2-4x one pricing, all k Greeks | Many Greeks / large portfolio; MC or path-dependent |

For a European vanilla with a closed form, use the **analytic** Greeks — delta = N(d1), vega = S*sqrt(T)*phi(d1), etc. — they are exact and essentially free. Bump-and-revalue is the fallback when no formula exists: it is trivial to implement (reprice at x+h and x-h) but suffers cancellation and costs a full revaluation per parameter, which explodes for a portfolio with hundreds of risk factors. **AAD** computes every sensitivity in one reverse sweep at a small constant multiple of a single pricing cost, exactly, regardless of how many Greeks — which is why it transformed bank-wide risk. The catch: AAD requires instrumenting the pricing code (operator overloading or a tape), so it is a bigger engineering investment. Rule of thumb: analytic if you can, AAD if you have many Greeks, bump only for a handful or a quick prototype.

### Q14. Your explicit PDE solver produces oscillating, exploding prices. What went wrong?

Almost certainly a **stability violation**: the explicit scheme is only conditionally stable, requiring roughly dt <= 1/(sigma^2 * M^2) where M is the number of space steps. Someone refined the S-grid (raised M) without shrinking dt quadratically, so the scheme's amplification factor exceeds 1 and round-off errors grow geometrically each step — you see high-frequency oscillations that blow up. Diagnostics and fixes: (1) check the ratio dt/dS^2 against the stability bound; (2) shrink dt (expensive — scales with M^2) or, far better, (3) switch to an **implicit or Crank-Nicolson** scheme, which are unconditionally stable and let you choose dt for accuracy alone. Secondary suspects: a probability going negative in a poorly parameterized tree, wrong boundary conditions at S=0 or S=Smax, or a grid so coarse that a kinked payoff isn't resolved. But an *exploding* explicit scheme is the textbook conditional-stability failure — the reason production grid engines default to Crank-Nicolson.

### Q15. Design a reusable root-finder interface for a pricing library. Templates or std::function?

You want callers to plug in any objective (implied vol, curve bootstrap, calibration residual) and swap algorithms. Two idioms:

```cpp
// Template on the callable: zero indirection, inlinable, header-only.
template <class F>
double solveNewton(F&& f, F&& fprime, double x0, double tol = 1e-10);

// Or type-erased via std::function: compiled once, swappable at runtime,
// but a virtual call per evaluation.
double solveNewton(std::function<double(double)> f,
                   std::function<double(double)> fprime, double x0);
```

Prefer the **template** form on the hot path: the compiler inlines the objective straight into the solver loop, so a million implied-vol solves have zero call overhead — the same reason Monte Carlo engines template on the payoff. Use `std::function` only at a coarse boundary where you genuinely need runtime polymorphism (a calibration framework choosing solvers from config) and the per-call overhead is negligible against the work inside `f`. A clean design pairs a small `SolverResult { double root; int iters; bool converged; }` return with a policy enum or tag type selecting Newton/Brent/bisection, so the caller expresses intent and the library picks a safeguarded implementation. Never return a bare double that silently means "didn't converge" — surface convergence explicitly.

### Q16. Which method for pricing an American option, and how do you validate the implementation?

For a low-dimensional American option (one or two underlyings) with early exercise, use a **finite-difference (Crank-Nicolson) grid** or a **binomial/trinomial tree** — both handle the `max(continuation, intrinsic)` check node by node. Trees are simpler to code and reason about; CN grids give better accuracy per unit work and smoother Greeks. For higher dimensions where grids suffer the curse of dimensionality, use **Longstaff-Schwartz least-squares Monte Carlo** (regress continuation value against basis functions of the state). Plain Monte Carlo alone cannot price early exercise because it has no natural backward pass.

Validation is a discipline, not an afterthought: (1) an American call on a **non-dividend** stock equals the European call (never optimal to exercise early) — a free golden test; (2) check **put-call parity** and no-arbitrage bounds; (3) confirm the American price **converges** as N grows and sits at or above the European price; (4) cross-check the tree against the CN grid against a reference value from QuantLib; (5) use **tolerances, not exact equality**, in tests, and add edge cases (T -> 0, deep ITM/OTM, zero vol). Numerical code without reference-value and property-based tests is untrustworthy — a senior candidate always names the validation plan alongside the method.

## Concurrency & Parallelism in C++

### Summary

**What this topic covers**

How to make numeric and pricing code use many cores correctly — the concurrency a quant desk actually needs, not a general threading tutorial. Topics: the **thread primitives** (`std::thread`, `std::async`/`std::future`, C++20 `std::jthread`); the **C++ memory model** and `std::atomic` with its ordering options (relaxed, acquire-release, seq_cst); **parallel STL** (`std::execution::par`) as the low-effort path to parallel reductions; **thread pools** and a glance at **lock-free** structures; **TBB and OpenMP** for data parallelism; and the centerpiece — **parallelizing Monte Carlo correctly**: split paths across threads, give each thread an **independent RNG stream**, combine partial sums, and understand why floating-point non-associativity means a parallel run may not be bit-identical to the serial one. The 15 questions here emphasize correctness (data races, RNG independence, reproducibility) as much as speedup, and cross-reference the dedicated Concurrency primer for the language-level threading detail.

**Mental model**

Parallelism in pricing is overwhelmingly **embarrassingly parallel**: Monte Carlo paths, portfolio positions, scenarios in a risk run, and nodes in a tree layer are largely independent, so the pattern is almost always *fan out independent work, then reduce partial results*. The hard part is not the fan-out; it is the two things that make shared state dangerous. First, **data races** — two threads touching the same memory with at least one write and no synchronization — are undefined behavior, and the compiler assumes they never happen, so a race can corrupt results silently and non-deterministically. Second, **shared mutable RNG state**: two threads pulling from one engine is both a race and a statistical bug (correlated streams destroy the independence Monte Carlo assumes). The safe design gives each thread its own engine seeded distinctly, its own local accumulator, and combines only at the end. Layered on top is a subtlety unique to numerics: floating-point addition is **not associative**, so summing partial results in a different order yields a slightly different total — parallel results are correct but not bit-reproducible unless you fix the reduction order.

**Key terms**

- **std::thread** — the basic OS-thread wrapper; you must `join()` or `detach()` or the destructor calls `std::terminate`.
- **std::jthread** — C++20 thread that auto-joins on destruction and supports cooperative cancellation via `std::stop_token`.
- **std::async / std::future** — launch a task and retrieve its result (or exception) later; `std::launch::async` forces a new thread.
- **Data race** — concurrent access to the same memory, one a write, with no synchronization; undefined behavior.
- **std::atomic** — a type whose operations are indivisible and race-free; the basis for lock-free code and safe counters.
- **Memory order** — the visibility/ordering guarantee of an atomic op: `relaxed` (atomicity only), `acquire`/`release` (pairwise sync), `seq_cst` (single global order, the default).
- **Parallel STL** — `std::execution::par` overloads of `for_each`, `reduce`, `transform_reduce` that run across cores.
- **Thread pool** — a fixed set of worker threads pulling tasks from a queue; avoids per-task thread creation cost.
- **Per-thread RNG** — each thread owns an engine seeded distinctly (or jumped ahead) so streams are independent.
- **Non-associativity** — (a+b)+c != a+(b+c) in floating point; makes parallel reductions order-dependent.
- **False sharing** — two threads write different variables that share a 64-byte cache line, causing cache-line ping-pong.
- **TBB / OpenMP** — libraries for data parallelism: TBB (task-based, C++), OpenMP (pragma-based loop parallelism).

**Why interviewers ask this**

Concurrency separates candidates who have shipped parallel numeric code from those who have only read about threads. The tell is the Monte Carlo question: a junior parallelizes the path loop, shares one `mt19937`, and reports a "speedup" while silently producing correlated, biased results — the code runs, the answer is wrong, and they don't know it. A senior candidate immediately says "independent RNG per thread", explains that one shared engine is both a data race and a statistical failure, uses per-thread accumulators to avoid contention, and volunteers that the parallel sum won't be bit-identical to the serial one because float addition isn't associative — then offers a fixed-order reduction if reproducibility is required for risk sign-off. Interviewers also probe whether you reach for the *simplest correct* tool (`std::reduce(par, ...)` or OpenMP) rather than hand-rolling threads, and whether you understand `std::atomic` ordering well enough not to sprinkle `seq_cst` everywhere or, worse, use `relaxed` where you needed a release.

**Common confusions**

- "I made the counter `atomic`, so it's fast and correct" — atomic fixes the race but a single shared atomic accumulator serializes every thread on one cache line; use per-thread partials and combine once.
- "Sharing one RNG across threads just needs a lock" — a lock removes the race but the threads still draw from **one correlated stream**, breaking Monte Carlo's independence assumption; give each thread its own engine.
- "`std::async` always runs on another thread" — with the default launch policy the implementation may run it lazily on `get()`; pass `std::launch::async` to force concurrency.
- "Parallel and serial MC must give the same number" — they give statistically equivalent answers, but floating-point non-associativity makes the bits differ unless you fix the summation order.
- "More threads = more speedup" — past the physical core count you hit memory-bandwidth limits, false sharing, and scheduling overhead; MC is often memory-bound, not compute-bound.
- "`volatile` means thread-safe" — `volatile` is for memory-mapped IO, not concurrency; it provides no atomicity or ordering. Use `std::atomic`.

**What follows from this topic**

Correct parallelism feeds directly into **Low-Latency C++ Techniques** — once work is spread across cores, per-thread hot loops still need SIMD, cache-friendly layout, and no allocation. The RNG-independence discipline ties back to the Monte Carlo engine and Numerical Methods (parallel path generation), and the memory-model detail is expanded in the dedicated Concurrency primer. False sharing and cache-line padding here are the same cache concerns that dominate low-latency design.

### Q1. std::thread vs std::async vs std::jthread — when do you use each?

`std::thread` is the raw primitive: it starts a function on a new OS thread and you **must** `join()` or `detach()` it before it destructs, or the destructor calls `std::terminate`. It gives no easy way to return a value or propagate an exception. `std::async` runs a callable and hands back a `std::future` that carries the result *or* a thrown exception, retrieved via `.get()`; it is the right tool when you want a value back from a task. `std::jthread` (C++20) is the modern default: it **auto-joins** in its destructor (RAII, no forgotten join) and carries a `std::stop_token` for cooperative cancellation.

```cpp
std::jthread worker([](std::stop_token st) {
    while (!st.stop_requested()) { /* work */ }
});   // destructor requests stop AND joins — no leak, no terminate

auto fut = std::async(std::launch::async,
                      [] { return pricePortfolio(); });
double pv = fut.get();     // result, or rethrows the task's exception
```

Rule of thumb: `std::async` for "compute this and give me the result/exception", `std::jthread` for a managed long-running worker, and raw `std::thread` almost never — only when you need control neither of the others offers. One gotcha: with the default launch policy, `std::async` *may* defer and run lazily on `get()`; pass `std::launch::async` if you require true concurrency.

### Q2. What is a data race, and why is it undefined behavior?

A data race is two or more threads accessing the **same memory location**, where at least one access is a **write**, with **no synchronization** ordering them. The C++ standard declares this **undefined behavior** — not "the value is one or the other", but *anything may happen*. This is not pedantry: the compiler optimizes on the assumption that races never occur, so it may cache a value in a register, reorder reads and writes, or fuse operations in ways that only manifest under contention. The result is corruption that is intermittent, timing-dependent, and often invisible until production load.

```cpp
long total = 0;
// BROKEN: two threads writing 'total' with no sync -> data race, UB
std::jthread a([&]{ for (int i=0;i<1'000'000;++i) total += 1; });
std::jthread b([&]{ for (int i=0;i<1'000'000;++i) total += 1; });
// result is not 2,000,000 and is not even well-defined
```

Fixes, cheapest first: give each thread a **local** accumulator and sum at the end (no sharing at all — the preferred numeric pattern); or make the shared variable `std::atomic<long>`; or guard it with a `std::mutex`. Detect races with **ThreadSanitizer** (`-fsanitize=thread`) — it instruments memory accesses and reports races even when a run happens to produce the right answer. Note `volatile` does **not** help: it is for hardware registers, not thread synchronization.

### Q3. Explain std::atomic memory orderings: relaxed, acquire-release, seq_cst.

An atomic operation is indivisible, but you also choose how it **orders surrounding memory** for other threads:

- **`memory_order_relaxed`** — guarantees only atomicity of *this* variable; no ordering of other memory. Correct for a standalone counter where you only need the final count, not synchronization with other data. Cheapest.
- **`memory_order_acquire` / `memory_order_release`** — a paired handshake: a `release` store *publishes* everything the thread wrote before it, and a matching `acquire` load on the same variable *sees* all of it. This is how you hand off data (e.g. a ready flag guarding a buffer) without a mutex.
- **`memory_order_seq_cst`** — the default: acquire-release *plus* a single total order all threads agree on. Easiest to reason about, most expensive (may insert full fences).

```cpp
std::atomic<bool> ready{false};
Data payload;
// producer
payload = compute();
ready.store(true, std::memory_order_release);   // publishes payload
// consumer
while (!ready.load(std::memory_order_acquire)) {}
use(payload);                                   // guaranteed to see compute()
```

Guidance: default to `seq_cst` unless you have profiled a bottleneck and understand the model; use `relaxed` only for independent counters/statistics where ordering is irrelevant; use acquire-release for lock-free handoffs. Getting `relaxed` wrong where you needed a release is a classic, hard-to-reproduce bug — the extra cost of `seq_cst` is usually worth the safety.

### Q4. Parallelize a Monte Carlo option pricer. What is the single most important correctness rule?

The most important rule: **each thread must have its own independent RNG** — never share one engine. Split the N paths across threads, give each a distinctly seeded engine and a *local* accumulator, then combine the partial sums:

```cpp
#include <thread>
#include <vector>
#include <random>
#include <cmath>

double mcCallParallel(double S, double K, double r, double T, double sigma,
                      long N, unsigned nThreads) {
    std::vector<double> partial(nThreads, 0.0);
    std::vector<std::jthread> pool;
    long per = N / nThreads;
    double drift = (r - 0.5 * sigma * sigma) * T;
    double vol   = sigma * std::sqrt(T);

    for (unsigned t = 0; t < nThreads; ++t) {
        pool.emplace_back([&, t] {
            std::mt19937_64 rng(t + 1);              // INDEPENDENT stream per thread
            std::normal_distribution<double> Z(0.0, 1.0);
            double sum = 0.0;                        // thread-LOCAL accumulator
            for (long i = 0; i < per; ++i) {
                double ST = S * std::exp(drift + vol * Z(rng));
                sum += std::max(ST - K, 0.0);
            }
            partial[t] = sum;                        // one write per thread, no race
        });
    }
    pool.clear();                                    // jthreads join here
    double total = 0.0;
    for (double p : partial) total += p;             // deterministic reduction order
    return std::exp(-r * T) * (total / (per * nThreads));
}
```

Two correctness pillars: (1) **independent RNG per thread** — one shared engine is both a data race *and* a statistical bug (correlated draws bias the estimate); (2) **thread-local accumulators** — a shared atomic sum would serialize the threads on one cache line and kill the speedup. Distinct seeds are the simple approach; for rigorous independence use engines with **jump-ahead**/leapfrog (guaranteed non-overlapping streams) or a counter-based RNG. Also note `partial[t]` writes to distinct vector slots — fine, though adjacent slots sharing a cache line invite false sharing, addressed in Q9.

### Q5. Why can a parallel Monte Carlo give a slightly different price than the serial version?

Because floating-point addition is **not associative**: (a + b) + c is not bit-identical to a + (b + c), since each addition rounds. The serial run sums the payoffs in one fixed order; the parallel run sums within each thread and then combines partials in a different order, so the rounding falls differently and the final price differs in the last few bits. Both answers are equally *correct* statistically — the difference is round-off noise far below the Monte Carlo standard error — but they are not **bit-reproducible**.

This matters when reproducibility is a requirement: regulatory risk sign-off, regression tests that assert exact values, or debugging where you need the parallel and serial runs to match. Mitigations: (1) fix the reduction to a **deterministic order** (always combine partials by thread index, as above, and pin how many threads run) so a given thread count reproduces exactly; (2) use **pairwise / Kahan summation** to shrink the round-off so serial and parallel agree to more digits; (3) accept that different thread counts give different bits and assert on tolerance, not equality. The key interview point is *awareness*: a candidate who claims parallel MC is bit-identical to serial hasn't thought about non-associativity.

### Q6. Use parallel STL to price a Monte Carlo option. What are the caveats?

`std::transform_reduce` with `std::execution::par` expresses the map-payoff-then-average pattern directly and lets the implementation handle the threading:

```cpp
#include <execution>
#include <numeric>
#include <vector>

double mcParSTL(double S, double K, double r, double T, double sigma, long N) {
    std::vector<double> z(N);
    // fill z with pre-generated independent normals (see caveat below)
    double drift = (r - 0.5*sigma*sigma)*T, vol = sigma*std::sqrt(T);
    double sumPayoff = std::transform_reduce(
        std::execution::par, z.begin(), z.end(), 0.0, std::plus<>{},
        [=](double Zi){ return std::max(S*std::exp(drift + vol*Zi) - K, 0.0); });
    return std::exp(-r*T) * sumPayoff / N;
}
```

Caveats: (1) the **reduction operation must be associative and commutative** — `std::plus` on doubles is commutative but not truly associative, so results are order-dependent (the Q5 point again); (2) the lambda **must not mutate shared state** or it races — here it is pure, which is why we pre-generate the normals rather than call a shared RNG inside; (3) generating independent randoms *inside* a `par` lambda is the trap, since a shared engine races — you either pre-fill the buffer (costs memory for N draws) or use a counter-based RNG indexed by position; (4) `par` needs a linker-provided backend (TBB on libstdc++) and gives no speedup for tiny N. Parallel STL is the lowest-effort correct parallelization when the work is a clean map-reduce over a buffer.

### Q7. Design a simple thread pool. Why not just spawn a thread per task?

Spawning a `std::thread` per task costs a kernel call and stack allocation each time — hundreds of microseconds — which dwarfs a short task and, for a risk run firing thousands of small pricings, becomes the bottleneck. A **thread pool** creates a fixed set of worker threads once and feeds them tasks through a queue, amortizing the creation cost:

```cpp
class ThreadPool {
    std::vector<std::jthread> workers;
    std::queue<std::function<void()>> tasks;
    std::mutex m; std::condition_variable cv; bool stop = false;
public:
    explicit ThreadPool(unsigned n) {
        for (unsigned i = 0; i < n; ++i)
            workers.emplace_back([this] {
                for (;;) {
                    std::function<void()> job;
                    { std::unique_lock lk(m);
                      cv.wait(lk, [this]{ return stop || !tasks.empty(); });
                      if (stop && tasks.empty()) return;
                      job = std::move(tasks.front()); tasks.pop(); }
                    job();
                }
            });
    }
    template <class F> void submit(F&& f) {
        { std::lock_guard lk(m); tasks.emplace(std::forward<F>(f)); }
        cv.notify_one();
    }
    ~ThreadPool() { { std::lock_guard lk(m); stop = true; } cv.notify_all(); }
};
```

The pool sizes to the hardware (`std::thread::hardware_concurrency()`), so you don't oversubscribe cores. In production you would usually not hand-roll this — **TBB**, OpenMP's runtime, or a `std::execution::par` backend already provide well-tested, work-stealing pools. The interview value is showing you understand the cost model (thread creation is expensive, reuse amortizes it) and the mechanics (queue + condition variable + clean shutdown).

### Q8. What is a lock-free data structure, and when is it worth it?

A lock-free structure coordinates threads using **atomic operations** (typically `compare_exchange`) instead of mutexes, guaranteeing that *some* thread always makes progress even if others are suspended — no thread can hold a lock and block everyone. A classic example is an atomic increment or a single-producer/single-consumer ring buffer:

```cpp
std::atomic<long> counter{0};
counter.fetch_add(1, std::memory_order_relaxed);   // lock-free, no mutex

// CAS loop pattern underlying lock-free updates:
std::atomic<Node*> head;
void push(Node* n) {
    n->next = head.load(std::memory_order_relaxed);
    while (!head.compare_exchange_weak(n->next, n,
               std::memory_order_release, std::memory_order_relaxed)) {}
}
```

Worth it when lock contention is the measured bottleneck and latency spikes from a blocked lock-holder are unacceptable — an HFT order book or a market-data queue, where a mutex stall of even microseconds is intolerable. Not worth it otherwise: lock-free code is genuinely hard (the **ABA problem**, memory reclamation, subtle ordering bugs) and often no faster than a well-designed lock under low contention. For quant *compute* (Monte Carlo, PDE), you rarely need lock-free at all — the embarrassingly parallel pattern of per-thread state plus a final reduction avoids shared mutable state entirely. Reach for lock-free only on a proven hot path with a real contention problem.

### Q9. What is false sharing and how does it wreck a parallel reduction?

False sharing happens when two threads write to **different variables that happen to occupy the same 64-byte cache line**. Even though the variables are logically independent, the cache-coherence protocol treats the whole line as one unit: each write invalidates the other core's copy, forcing the line to bounce between cores' caches. The threads aren't sharing data, but they pay as if they were — a parallel loop can run *slower* than serial.

The Q4 `std::vector<double> partial(nThreads)` is the classic trap: adjacent doubles are 8 bytes apart, so eight partial sums share one cache line and every update ping-pongs it:

```cpp
struct alignas(64) Padded { double value; };      // one per cache line
std::vector<Padded> partial(nThreads);            // no false sharing
// or std::hardware_destructive_interference_size (C++17) for the padding
```

Better still, keep the accumulator **thread-local** (a plain `double sum` inside the lambda, written to the shared slot only once at the end, as in Q4) so the hot loop never touches shared memory at all. Padding to a cache line (`alignas(64)` or `std::hardware_destructive_interference_size`) fixes the residual case where threads must update shared slots frequently. False sharing is invisible in the code — it only shows up as mysteriously poor scaling — so it is a favorite "why is my parallel code slow" interview question.

### Q10. OpenMP vs TBB vs raw std::thread for data parallelism — which and why?

| Approach | Model | Effort | Best for |
|---|---|---|---|
| OpenMP | `#pragma omp` on loops | Very low | Regular parallel-for over arrays; scientific loops |
| TBB | Task-based C++ library | Moderate | Nested/irregular parallelism, work stealing, pipelines |
| Parallel STL | `std::execution::par` | Low | Standard algorithms (reduce, for_each, sort) |
| Raw std::thread | Manual | High | Bespoke control you can't get otherwise |

**OpenMP** parallelizes a loop with a single pragma and a `reduction` clause that handles the partial-sum combination for you — unbeatable for regular numeric loops:

```cpp
double sum = 0.0;
#pragma omp parallel for reduction(+:sum)
for (long i = 0; i < N; ++i) sum += payoff(i);   // per-thread partials, auto-combined
```

But note OpenMP's `reduction` still leaves each thread needing its **own RNG** — the pragma parallelizes the loop, it doesn't fix shared engine state, so you seed a per-thread engine keyed on `omp_get_thread_num()`. **TBB** shines for irregular, nested, or pipelined work with its work-stealing scheduler (`parallel_reduce`, `parallel_pipeline`) and is pure C++ (no compiler flag). **Parallel STL** is the standard-library sweet spot for algorithm-shaped work. Reach for **raw threads** only when you need control the higher-level tools don't offer. Guidance: for a flat Monte Carlo or PDE sweep, OpenMP or parallel STL; for a complex task graph, TBB; hand-rolled threads last.

### Q11. std::async's default launch policy surprised you with no speedup. What happened?

Called as `std::async(f)` with **no explicit policy**, the launch policy is `std::launch::async | std::launch::deferred`, and the implementation is free to choose **deferred**: instead of running `f` on another thread, it stores it and runs it *synchronously on the calling thread when you call `.get()`*. If you launch many "tasks" this way and only call `get()` afterward, they may all execute serially at that point — zero parallelism, and worse, if you never call `get()` the task never runs at all.

```cpp
// May defer -> runs serially on get(): no speedup
auto a = std::async(work);
auto b = std::async(work);
// FORCE concurrency:
auto a2 = std::async(std::launch::async, work);
auto b2 = std::async(std::launch::async, work);
```

Always pass `std::launch::async` when you require the task to run concurrently. A second gotcha compounds this: the `std::future` returned by `std::async` has a **blocking destructor** — if you don't bind it to a variable, the temporary future's destructor blocks until the task finishes, silently serializing your loop (`std::async(async, work);` as a statement runs and *waits*). Bind futures to named variables and collect them after launching all tasks.

### Q12. How do you make a parallel Monte Carlo result reproducible?

Reproducibility requires controlling two sources of nondeterminism: **RNG assignment** and **summation order**. (1) Assign each path a **deterministic RNG stream** independent of scheduling — seed thread `t`'s engine from a fixed function of `t` (or better, use jump-ahead so stream boundaries don't depend on how paths are chunked). Do *not* let threads pull from a shared engine, where interleaving order — which is nondeterministic — decides who gets which draw. (2) Fix the **reduction order**: combine per-thread partials by thread index, not in completion order, and pin the thread count, so the sequence of floating-point additions is identical every run (recall float addition is non-associative).

```cpp
// stream per path index, not per thread -> chunking-independent
auto pathRng = [](long pathId){ std::mt19937_64 e(0x9E3779B97F4A7C15ULL * (pathId+1)); return e; };
// combine partials in fixed index order, fixed nThreads -> deterministic sum
```

The gold standard is a **counter-based RNG** (Philox, Threefry): the random draw for path i is a stateless function `rng(seed, i)`, so path i always gets the same value regardless of thread count or scheduling — this decouples reproducibility from parallel decomposition entirely. Combined with a fixed-order (or Kahan) reduction, the same inputs then yield bit-identical prices, which is what regulatory sign-off and regression tests require.

### Q13. Spot the concurrency bug: a shared std::mt19937 behind a mutex in parallel MC.

```cpp
std::mt19937_64 rng(42);
std::mutex m;
double sum = 0.0;
auto work = [&] {
    for (long i = 0; i < per; ++i) {
        double z;
        { std::lock_guard lk(m); z = norm(rng); }   // serialize each draw
        double payoff = /* ... using z ... */;
        { std::lock_guard lk(m); sum += payoff; }    // serialize each add
    }
};
```

Two problems. First, **correctness/statistics**: even though the mutex removes the data race, all threads draw from **one shared stream**. The sequence a given thread receives depends on nondeterministic lock-acquisition order, so runs aren't reproducible; more fundamentally, this doesn't give you N independent draws partitioned cleanly — it gives interleaved draws from one stream, and any correlation structure in the engine is now shared across threads in a schedule-dependent way. Second, **performance**: locking around *every* random draw and *every* accumulation serializes the entire hot loop — the threads spend their time contending on the mutex, so this is often slower than single-threaded. The fix is the Q4 pattern: **per-thread engine** (distinct seed or jump-ahead) and **per-thread local accumulator**, combining once at the end — no mutex in the inner loop at all. A mutex-protected shared RNG is the canonical "runs but wrong and slow" answer.

### Q14. When is multithreading NOT the right answer for speeding up numeric code?

Threads help only when the work is **compute-bound and parallelizable**, and even then have costs. Cases where threading is the wrong first move: (1) **memory-bandwidth-bound** loops — much numeric code (large vector sweeps, sparse linear algebra) is limited by how fast data streams from RAM, not by CPU cycles; adding threads that all hammer the same memory bus gives little speedup and can regress from contention. (2) **Small workloads** — thread creation and synchronization overhead exceeds the work; a 100-path Monte Carlo is faster serial. (3) **Serial dependencies** — a path where each step needs the previous (some tree recursions, sequential ODE integration) can't be split across the dependent dimension. (4) Before you've exploited **single-thread performance** — SIMD vectorization, cache-friendly SoA layout, and removing allocation (the next topic) often deliver a bigger, cheaper win than threads, and they *compose*: vectorize first, then parallelize the vectorized loop. The disciplined order is **measure -> optimize single-thread (SIMD, cache, allocation) -> then parallelize -> then consider distributed**. Reaching for threads before profiling, on memory-bound or tiny work, is a common junior mistake.

### Q15. How does releasing the GIL relate to C++ concurrency in a Python-facing quant library?

When a C++ pricing core is exposed to Python via pybind11, Python's **Global Interpreter Lock (GIL)** normally allows only one thread to execute Python bytecode at a time. While your C++ `price()` runs a long computation, it *holds* the GIL by default, so other Python threads are blocked — Python-level parallelism (e.g. a thread pool of pricing calls) gains nothing. The fix is to **release the GIL** around the pure-C++ compute, since that code touches no Python objects:

```cpp
#include <pybind11/pybind11.h>
namespace py = pybind11;

double price_wrapper(/* args */) {
    py::gil_scoped_release release;   // let other Python threads run
    return heavyCppMonteCarlo(/* args */);   // no Python objects touched here
}   // GIL re-acquired at scope exit
```

With the GIL released, multiple Python threads can each drive an independent C++ computation truly in parallel, and inside C++ you are free to use `std::thread`/OpenMP/TBB with no Python involvement at all. The rule: release the GIL only around code that does **not** touch the Python C-API (no `py::object`, no ref-count changes), and re-acquire (`py::gil_scoped_acquire`) if you must call back into Python. This is the practical bridge between the two-language pattern and real parallelism — the C++ side is where the concurrency lives, and releasing the GIL is what lets Python callers exploit it. See the C++/Python interop material for the wider zero-copy story.

## Low-Latency C++ Techniques

### Summary

**What this topic covers**

The techniques that shave microseconds and nanoseconds off a hot path — the pricing inner loop, the market-data handler, the order-submission path in an HFT system. Topics: eliminating **virtual dispatch** on the hot path (the vtable indirection blocks inlining) via **CRTP, templates, or `std::variant` + visit**; helping the CPU's **branch predictor** with `[[likely]]`/`[[unlikely]]` and branchless code; **forcing or enabling inlining**; **SIMD** (auto-vectorization with `-O3 -march=native`, intrinsics, and `std::simd`); cache-friendly **Structure-of-Arrays (SoA)** layout; **avoiding exceptions and heap allocation on the hot path**; and build-level wins — **profile-guided optimization (PGO)** and **link-time optimization (LTO)**. The through-line is the discipline **"measure, don't guess"**: profile first, optimize the proven bottleneck, verify the win. The 15 questions here tie each technique to a concrete HFT or pricing hot loop and usually show a before/after in ```cpp. This is where the RAII, templates, move-semantics, and cache material from earlier topics pays off as raw speed.

**Mental model**

Low-latency C++ is about respecting the machine underneath the abstraction. A modern CPU is fast only when it can **predict, pipeline, prefetch, and vectorize**; every source of unpredictability — an indirect call it can't inline, a mispredicted branch, a cache miss, an allocation that hits the kernel — stalls the pipeline for tens to hundreds of cycles. So the mental model is: keep the hot path **straight-line, inlinable, branch-predictable, cache-resident, and allocation-free**. Two ideas dominate. First, **memory, not FLOPs, is usually the bottleneck** — a cache miss costs ~200 cycles, enough for hundreds of arithmetic ops, so data layout (SoA, contiguity, cache-line awareness) matters more than clever math. Second, **compile-time beats run-time**: resolving a call statically (templates/CRTP) lets the compiler inline and then vectorize across it, whereas a virtual call is an opaque barrier. Above all, latency work is empirical — you **profile** (perf, VTune, flamegraphs) to find the real hot spot, change one thing, and **measure** the delta; intuition about what's slow is routinely wrong.

**Key terms**

- **Hot path** — the small fraction of code executed most often / under latency pressure (the pricing loop, the tick handler); where optimization pays.
- **Virtual dispatch** — a call resolved at runtime through the vtable; an indirect jump the compiler cannot inline.
- **CRTP** — Curiously Recurring Template Pattern; static polymorphism via `Derived : Base<Derived>`, no vtable, fully inlinable.
- **Branch prediction** — the CPU guesses which way a branch goes; a misprediction flushes the pipeline (~15-20 cycles).
- **[[likely]] / [[unlikely]]** — C++20 attributes hinting the probable branch, letting the compiler lay out code for the common case.
- **Inlining** — replacing a call with the callee's body; removes call overhead and unlocks further optimization across the boundary.
- **SIMD** — Single Instruction Multiple Data; one instruction operates on a vector (e.g. 8 doubles with AVX-512).
- **Auto-vectorization** — the compiler turning a scalar loop into SIMD automatically under `-O3 -march=native`.
- **SoA vs AoS** — Structure-of-Arrays (parallel arrays per field) vs Array-of-Structs; SoA vectorizes and caches better for bulk work.
- **Cache line** — the 64-byte unit of memory transfer; spatial locality means using all of a fetched line.
- **PGO** — Profile-Guided Optimization; compile, run on representative data, recompile using the collected profile for better layout/inlining.
- **LTO** — Link-Time Optimization; lets the optimizer inline and specialize across translation-unit boundaries at link time.

**Why interviewers ask this**

HFT and low-latency pricing desks live and die on tail latency, so these questions test whether you *think in cycles and cache lines* or only in big-O. The signature question is "make this pricer/handler faster": a junior guesses — adds threads, micro-tweaks arithmetic, or rewrites in a "faster" style — without measuring, and often makes it slower. A senior candidate says "first, profile it" and then reaches for the high-leverage moves in the right order: fix data layout and cache behavior, remove virtual dispatch and allocation from the hot loop, let it vectorize, and only then micro-optimize — verifying each step with a benchmark. Interviewers also probe understanding of *why* a virtual call is slow (indirection blocks inlining, not just the extra load), why exceptions are cheap when not thrown but poison the hot path if they can be, and whether you know that `-ffast-math` buys speed by breaking IEEE semantics — a dangerous trade in finance. The meta-signal is discipline: measure, change one thing, measure again.

**Common confusions**

- "Virtual calls are slow because of the extra pointer load" — the load is minor; the real cost is that the compiler **can't inline** an indirect call, so it can't optimize or vectorize across it.
- "SIMD means writing intrinsics" — most gains come free from **auto-vectorization** under `-O3 -march=native` on clean, contiguous loops; hand-written intrinsics are a last resort.
- "AoS vs SoA is a micro-optimization" — for bulk pricing it can be a multiple-x difference, because SoA streams only the fields you use and vectorizes cleanly.
- "Exceptions are always slow" — a *not-taken* exception path is essentially free (zero-cost model); the cost is that *throwing* is very slow and that exception support can inhibit some optimizations on the hot path.
- "`-ffast-math` is a free speedup" — it breaks IEEE associativity and NaN handling, so results change and reproducibility/edge-case correctness break; dangerous for financial code.
- "Optimize everything" — 99% of code isn't hot; optimizing cold code adds complexity for no gain. Profile, then optimize the 1% that matters.

**What follows from this topic**

This is the capstone of the performance thread running through the whole primer: RAII and value semantics (deterministic, GC-free destruction), move semantics (cheap transfer of big buffers), templates/CRTP (static dispatch), and cache-oriented SoA layout all converge here as latency techniques. It composes with **Concurrency & Parallelism** — vectorize and de-allocate the single-thread hot loop first, then parallelize it — and with **Numerical Methods**, whose inner grid and root-finding loops are exactly the hot code these techniques target. It connects outward to the High-Frequency Finance primer for the systems context (kernel bypass, NIC tuning) that surrounds the C++ hot path.

### Q1. Why is virtual dispatch a problem on the hot path, and what replaces it?

The cost of a virtual call is not mainly the extra vtable pointer load — it is that an **indirect call is an optimization barrier**. The compiler doesn't know at compile time which function runs, so it cannot **inline** the callee, and without inlining it cannot optimize or **vectorize** across the call. In a tight loop calling `payoff->value(S)` a million times, you pay the indirection *plus* the lost inlining and vectorization on every iteration.

```cpp
// SLOW on hot path: indirect call, no inlining, no vectorization across it
struct Payoff { virtual double value(double S) const = 0; };
double price(const Payoff& p, const double* S, int n) {
    double sum = 0;
    for (int i = 0; i < n; ++i) sum += p.value(S[i]);   // virtual every iter
    return sum;
}
```

Replacements, all resolving the call statically: **CRTP** (compile-time polymorphism, Q2), plain **templates** on the payoff type (the Monte Carlo engine pattern), or **`std::variant` + `std::visit`** when you need a closed set of types chosen at runtime but still want inlining (Q3). Each lets the compiler see the concrete callee, inline it into the loop, and then vectorize. Keep virtual dispatch for **cold** paths — setup, configuration, the outer "which instrument" dispatch done once — where its flexibility is worth it and its cost is invisible. The rule: dynamic polymorphism at the coarse boundary, static polymorphism in the inner loop.

### Q2. Show how CRTP removes virtual dispatch. What does it cost?

CRTP (Curiously Recurring Template Pattern) has the base take the derived type as a template parameter and `static_cast` to it, so the "virtual" call is resolved at compile time and fully inlinable:

```cpp
template <class Derived>
struct Payoff {
    double value(double S) const {
        return static_cast<const Derived&>(*this).valueImpl(S);  // static dispatch
    }
};
struct Call : Payoff<Call> {
    double K;
    double valueImpl(double S) const { return std::max(S - K, 0.0); }
};

template <class P>
double price(const P& p, const double* S, int n) {   // templated on payoff
    double sum = 0;
    for (int i = 0; i < n; ++i) sum += p.value(S[i]);  // inlined, vectorizable
    return sum;
}
```

No vtable, no indirect call — `p.value(S[i])` compiles down to the inlined `max`, and the loop vectorizes under `-O3`. Costs and trade-offs: (1) you lose **runtime** polymorphism — the type must be known at compile time, so you can't store a heterogeneous `vector<Payoff*>` of mixed payoffs the way you can with virtual; (2) **code bloat and compile time** — each payoff type instantiates its own `price`; (3) the syntax is more intricate and error messages worse. Use CRTP (or plain templates) on the hot loop where the type *is* known statically; when you genuinely need a runtime-selected type, prefer `std::variant` + visit (Q3), which keeps inlining while allowing a closed set of runtime types.

### Q3. std::variant + visit vs virtual vs CRTP — when each?

| Approach | Dispatch | Inlinable | Runtime type choice | Heterogeneous container |
|---|---|---|---|---|
| Virtual | Runtime (vtable) | No | Yes (open set) | Yes (`vector<Base*>`) |
| CRTP / templates | Compile time | Yes | No | No |
| `std::variant` + visit | Runtime (closed set) | Yes | Yes (fixed set) | Yes (`vector<variant<...>>`) |

`std::variant` holds one of a **fixed, compile-time-known set** of types; `std::visit` dispatches to the right one. Because the set is closed, the compiler can inline each alternative — you get near-CRTP speed *and* the ability to choose the type at runtime and store a heterogeneous vector:

```cpp
using AnyPayoff = std::variant<Call, Put, Digital>;
double value(const AnyPayoff& p, double S) {
    return std::visit([S](const auto& pf){ return pf.value(S); }, p);  // inlined per type
}
std::vector<AnyPayoff> book;   // heterogeneous, no heap indirection, cache-friendly
```

Guidance: use **CRTP/templates** when the type is known at compile time on the hot path (fastest, simplest data). Use **`std::variant`+visit** when you need a runtime choice among a *known, closed* set of types but still want inlining and value semantics (payoffs stored inline, no pointer chasing — better cache behavior than `vector<Base*>`). Use **virtual** when the type set is genuinely **open/extensible** (plugins, third-party instruments) or the dispatch is cold. For a pricing library's payoff hierarchy, `std::variant` is often the sweet spot — fast, cache-friendly, and closed sets are the norm.

### Q4. How do branch prediction and [[likely]]/[[unlikely]] affect a hot loop?

A modern CPU speculatively executes past a branch by guessing its direction; a correct guess costs nothing, a **misprediction flushes the pipeline** (~15-20 cycles). Predictable branches (a loop condition, a rarely taken error check) are cheap because the predictor learns them; **data-dependent, unpredictable** branches (a ~50/50 condition on random input) are expensive. The C++20 `[[likely]]`/`[[unlikely]]` attributes tell the compiler which side is common so it lays out the hot code contiguously and pushes the rare path out of line:

```cpp
double processTick(const Tick& t) {
    if (t.valid) [[likely]] {           // hot path stays inline & straight
        return revalue(t);
    } else [[unlikely]] {               // error handling moved out of line
        return handleBadTick(t);
    }
}
```

Use these for genuinely lopsided branches — an error/validation check that almost never fires, an unlikely early-exit. They help code *layout* (keeping the common path in I-cache and straight-line), not the predictor's dynamic accuracy. For a branch that is truly unpredictable (near 50/50 on live data), the better fix is to **remove the branch** — make it branchless with arithmetic or a conditional move (Q5) — since no hint helps a coin-flip. Don't sprinkle these everywhere; a wrong hint hurts, and most branches the predictor already handles fine. Profile to find the mispredicting branch first.

### Q5. Rewrite a branchy hot loop to be branchless. When does it help?

An unpredictable data-dependent branch (roughly 50/50, no learnable pattern) mispredicts constantly. Replacing it with straight-line arithmetic or a conditional move removes the misprediction penalty and lets the loop vectorize:

```cpp
// BRANCHY: unpredictable if -> frequent mispredict, blocks vectorization
double sumITM(const double* S, int n, double K) {
    double sum = 0;
    for (int i = 0; i < n; ++i)
        if (S[i] > K) sum += S[i] - K;      // data-dependent branch
    return sum;
}
// BRANCHLESS: always compute, mask the result -> vectorizes cleanly
double sumITMBranchless(const double* S, int n, double K) {
    double sum = 0;
    for (int i = 0; i < n; ++i) {
        double payoff = S[i] - K;
        sum += payoff * (payoff > 0.0);     // multiply by 0/1 mask; no branch
    }
    return sum;
}
```

The branchless form computes the payoff unconditionally and multiplies by a 0/1 mask, so there is no branch to mispredict and the compiler can vectorize the whole loop under `-O3` (SIMD compares and masks lanes). This helps when the branch is **unpredictable** and the branch body is **cheap** — doing the "wasted" work costs less than a misprediction (~15-20 cycles). It **hurts** when the branch is highly predictable (the predictor already makes it free and you'd be paying for work you could skip) or the skipped work is expensive (a costly function call you'd rather avoid). As always: measure. `std::max(payoff, 0.0)` also often compiles to a branchless `maxsd` and is clearer — prefer it here.

### Q6. How do you get the compiler to inline a hot function, and why does it matter?

Inlining replaces a call with the callee's body, removing call overhead *and*, more importantly, exposing the callee to the caller's optimizer — enabling constant propagation, dead-code elimination, and vectorization across what was a call boundary. The compiler inlines automatically based on heuristics (size, call frequency at `-O2`/`-O3`), and the `inline` keyword is mainly about ODR, only a weak hint. To *force* it when a heuristic wrongly declines:

```cpp
[[gnu::always_inline]] inline double discount(double r, double t) {
    return std::exp(-r * t);
}
// MSVC: __forceinline
```

Enablers that matter more than the attribute: keep hot functions **small and in headers** (or use **LTO**, Q13, so the optimizer can inline across translation units — a function defined in another .cpp normally *cannot* be inlined without LTO); avoid taking the function's address, recursion, or virtual dispatch, all of which block inlining. Why it matters on the hot path: an un-inlined `payoff()` call in a million-iteration loop is both call overhead and a **vectorization barrier** — inlining it lets the whole loop become SIMD. Caveat: forcing inline on a *large* function bloats code and can hurt I-cache, so reserve `always_inline` for small, hot, proven cases and let the compiler decide the rest.

### Q7. What is SIMD, and how do you get a pricing loop to use it?

SIMD (Single Instruction, Multiple Data) executes one instruction across a vector of values — AVX2 processes 4 doubles at once, AVX-512 processes 8 — so a loop over prices can run 4-8x faster if the compiler vectorizes it. The easiest and highest-leverage route is **auto-vectorization**: write a clean, contiguous, branch-free loop and compile with `-O3 -march=native`, and the compiler emits SIMD automatically:

```cpp
// Auto-vectorizes under -O3 -march=native: contiguous, no branches, no aliasing
void discountAll(const double* pv, double* out, int n, double r, double t) {
    double df = std::exp(-r * t);
    for (int i = 0; i < n; ++i) out[i] = pv[i] * df;   // one SIMD mul per 4-8 lanes
}
```

Conditions the compiler needs: contiguous memory (SoA, not AoS), no data-dependent branches in the body, no loop-carried dependencies, and no pointer **aliasing** (use `__restrict` or separate buffers to promise `out` and `pv` don't overlap). Check it worked with `-fopt-info-vec` (GCC) or by reading the assembly for `vmulpd`-style instructions. When auto-vectorization fails or you need full control, drop to **intrinsics** (`_mm256_mul_pd`) or the portable **`std::simd`** (C++26/experimental) — but that is a last resort: it's verbose, non-portable across ISAs, and the compiler usually matches it on clean loops. The 80/20 is: lay data out contiguously, remove branches, compile with `-O3 -march=native`, verify.

### Q8. AoS vs SoA — show the difference and why SoA is faster for bulk pricing.

Array-of-Structs (AoS) stores each option's fields together; Structure-of-Arrays (SoA) stores each field in its own contiguous array:

```cpp
// AoS: fields interleaved
struct Option { double S, K, r, T, sigma; };
std::vector<Option> book;      // S0 K0 r0 T0 sig0 S1 K1 ...

// SoA: each field contiguous
struct Book {
    std::vector<double> S, K, r, T, sigma;   // S0 S1 S2 ... | K0 K1 K2 ...
};
```

For a bulk operation that touches only some fields — say computing moneyness `S/K` across the whole book — SoA wins for two reasons. (1) **Cache efficiency**: a 64-byte cache line holds 8 contiguous `S` values in SoA, so every byte fetched is used; in AoS, loading `S` drags along `K,r,T,sigma` you don't need, wasting most of the line — you touch ~5x the memory. (2) **Vectorization**: SoA's contiguous `S[]` and `K[]` let the compiler load 4-8 lanes and divide them in one SIMD instruction; AoS's strided access defeats clean vectorization. For a large book this is routinely a several-x speedup, not a micro-optimization — because bulk numeric work is **memory-bound**, and SoA minimizes bytes moved and maximizes SIMD width. Trade-off: SoA is less convenient for single-object logic (an option isn't one struct anymore), so use AoS for scalar/OO code paths and SoA for the bulk hot loops — this is the core of **data-oriented design**.

### Q9. Why avoid heap allocation on the hot path, and how do you eliminate it?

A heap allocation (`new`, `malloc`, growing a `vector`) can cost hundreds of nanoseconds to microseconds: it may take a lock, search free lists, fault in pages, or even call into the kernel — and it introduces **latency jitter** (unpredictable tail spikes), which is exactly what a low-latency system cannot tolerate. Worse, it fragments memory and pollutes cache. So the hot path should do **zero** allocation. Techniques:

```cpp
// 1. Reserve once, reuse the buffer across iterations
std::vector<double> paths;
paths.reserve(N);                 // one allocation, outside the loop
for (auto& scenario : scenarios) {
    paths.clear();                // keeps capacity, no free/alloc
    generate(paths, scenario);    // reuses the same memory
}
// 2. Fixed-size stack storage for small, bounded data
std::array<double, 64> buf;       // no heap at all
// 3. Arena / pool allocator for many small same-lifetime objects
```

Key patterns: **reserve capacity up front** and reuse containers (`clear()` retains capacity — never let a `vector` reallocate inside the loop); use **stack** storage (`std::array`, small buffers) for bounded data; use a **memory pool / arena allocator** for many small objects with a shared lifetime (bump-pointer allocate, free all at once); and pass views (`std::span`) instead of copying buffers. Pre-allocate all working memory during setup, then run the hot loop allocation-free. This turns unpredictable allocator latency into deterministic, cache-resident access — the difference between a stable p99 and random microsecond spikes.

### Q10. Are exceptions slow? Should you avoid them on the hot path?

Under the modern **zero-cost** (table-based) exception model, the *non-throwing* path is essentially free — no runtime checks on the happy path, so normal execution isn't slowed just by exceptions existing. The cost is entirely on **throw**: unwinding the stack and matching handlers is very slow (microseconds), and the mere *possibility* of a throw can inhibit some optimizations and requires the compiler to keep unwind information. So the guidance is nuanced:

- **Setup / configuration / library boundaries**: use exceptions freely — invalid inputs (negative vol, T <= 0), file/parse errors. These are exceptional and off the hot path; exceptions give clean, hard-to-ignore error propagation.
- **Numeric hot path**: don't throw, and prefer designs that *can't* throw. Mark hot functions **`noexcept`** (which also enables optimizations and is required for moves in some containers), and return errors as values — `std::optional` or C++23 **`std::expected<T,E>`** — rather than throwing:

```cpp
[[nodiscard]] std::expected<double, PricingError>
tryPrice(const Args& a) noexcept {
    if (a.sigma < 0) return std::unexpected(PricingError::BadVol);
    return computePrice(a);          // no throw on the hot path
}
```

So: exceptions are *not* "always slow" — the false-path is free — but a *thrown* exception is expensive and you never want that in a per-tick loop. Use exceptions for the exceptional at the boundary; use `noexcept` + `expected`/`optional` for expected error conditions on the hot path.

### Q11. "Make this pricer faster." Walk through your methodology.

The methodology is **measure, don't guess** — the single most important answer. Concretely:

1. **Profile first.** Run a representative workload under `perf`, VTune, or a sampling profiler and find where time actually goes. Intuition about the bottleneck is routinely wrong; optimizing un-profiled code wastes effort and adds risk.
2. **Confirm it's hot and worth it.** Optimize the ~1% that dominates; leave cold code simple.
3. **Attack the biggest lever first, usually memory/layout.** Because numeric code is typically memory-bound, fix data layout (AoS -> SoA), improve locality, and remove cache misses before touching arithmetic.
4. **Remove hot-path overhead:** kill virtual dispatch (CRTP/variant), eliminate heap allocation (reserve/reuse/pool), mark hot functions `noexcept`, and get the loop to **auto-vectorize** (`-O3 -march=native`, contiguous, branch-free).
5. **Then micro-optimize** only what remains: branchless code for unpredictable branches, forced inlining of a small hot function, `std::fma`.
6. **Build-level wins:** enable **LTO** and, if the win justifies the pipeline complexity, **PGO**.
7. **Measure after every change** with a microbenchmark (Google Benchmark, guarding against dead-code elimination with `benchmark::DoNotOptimize`), keep what helps, revert what doesn't, and check you didn't change the numerical results.

The senior signal is refusing to guess, ordering changes by leverage (layout and cache before arithmetic; single-thread before threads), and validating each step empirically. A junior jumps to threads or micro-tweaks without a profile and often regresses.

### Q12. Benchmark two implementations correctly. What are the pitfalls?

Use a real microbenchmark harness (Google Benchmark) rather than ad-hoc timing, and defend against the compiler optimizing your benchmark away:

```cpp
#include <benchmark/benchmark.h>
static void BM_Price(benchmark::State& state) {
    auto args = makeArgs(state.range(0));
    for (auto _ : state) {
        double p = price(args);
        benchmark::DoNotOptimize(p);      // stop DCE from deleting the work
        benchmark::ClobberMemory();       // force pending writes to complete
    }
    state.SetItemsProcessed(state.iterations());
}
BENCHMARK(BM_Price)->Range(1<<10, 1<<16);
```

Pitfalls: (1) **dead-code elimination** — if the result is unused, the compiler deletes the whole computation and you time nothing; `benchmark::DoNotOptimize`/`ClobberMemory` prevent it. (2) **Cold cache / warm-up** — the first iterations pay cache-miss and page-fault costs; a good harness runs enough iterations to amortize this. (3) **CPU frequency scaling / turbo / thermal throttle** — pin the frequency (disable turbo, use `perf stat`) or results drift run to run. (4) **Unrepresentative data** — benchmarking with a tiny or all-identical dataset hides cache and branch behavior seen in production; use realistic sizes and distributions. (5) **Measuring the wrong thing** — include only the hot path, exclude setup. (6) **Noise** — run multiple times, look at the distribution and p99, not a single number. The overarching rule: a benchmark that isn't defended against DCE and isn't run on representative data lies confidently.

### Q13. What are PGO and LTO, and when are they worth it?

**LTO (Link-Time Optimization)** defers optimization to link time so the optimizer can see *across* translation units — it can then **inline a function defined in another .cpp**, propagate constants across module boundaries, and devirtualize calls it couldn't within a single file. Enable with `-flto` (and use it for release builds of a pricing library almost always — it's a low-effort, broad win with only longer link times as a cost).

**PGO (Profile-Guided Optimization)** is a two-pass build: (1) compile with instrumentation (`-fprofile-generate`), (2) run the binary on a **representative** workload to collect a profile of which branches are taken and which functions are hot, (3) recompile using that profile (`-fprofile-use`). The compiler then lays out code for the real common case — better branch layout, smarter inlining of actually-hot functions, cold code moved out of line. Typical gains are ~5-15% on branch- and layout-sensitive code (parsers, market-data handlers, pricing loops).

When worth it: **LTO** — nearly always for release builds; cheap. **PGO** — when you need every last percent, can capture a representative profile, and can afford the more complex build pipeline (the profile must reflect production behavior or it can *hurt*). For an HFT hot path where 10% latency matters, PGO + LTO together are standard; for a research library where build simplicity wins, LTO alone is the pragmatic choice.

### Q14. Why is -ffast-math dangerous in financial code?

`-ffast-math` speeds up floating-point by letting the compiler **break IEEE-754 guarantees**: it assumes no NaNs or infinities, treats floating-point addition/multiplication as **associative** (so it can reorder and vectorize reductions freely), flushes denormals to zero, and enables other unsafe algebraic rewrites. Those assumptions are exactly the ones finance relies on:

- **Associativity is violated** — reordering sums changes results, so a `-ffast-math` build gives *different prices* than a standard build, breaking reproducibility and regression tests (the non-associativity point from the Concurrency topic, now imposed by the compiler).
- **NaN/inf handling is discarded** — code that checks `std::isnan(x)` or relies on NaN propagation to flag bad inputs can be silently mis-compiled (the check optimized away), so a bad computation slips through instead of being caught.
- **Denormal flush-to-zero** changes behavior near zero.

For a domain where a pricing discrepancy or a swallowed NaN is a real financial/regulatory problem, that's an unacceptable trade for a few percent. The disciplined approach: **don't** use the blanket `-ffast-math`. If you need a specific rewrite (e.g. `-fno-math-errno`, or `std::fma` for fused multiply-add), enable the narrow, safe flag deliberately, and get associativity-based vectorization only where you've confirmed the reordering is acceptable. "Free speedup" it is not — it silently changes your numbers.

### Q15. Design the dispatch for a pricing engine that's flexible in setup but fast on the hot path.

The principle: **dynamic polymorphism at the coarse, cold boundary; static dispatch in the hot inner loop.** You choose the instrument/engine/model *once* per pricing request (rare, flexibility matters), then run a tight, monomorphic loop (millions of iterations, speed matters).

```cpp
// COLD boundary: virtual, open, flexible - chosen once per request
struct PricingEngine { virtual double price(const Instrument&) const = 0; };

// HOT loop inside a concrete engine: templated on payoff -> inlined, vectorized
struct McEngine : PricingEngine {
    template <class Payoff, class Generator>
    double run(Payoff pf, Generator gen, long N) const {   // static dispatch
        double sum = 0;
        for (long i = 0; i < N; ++i)
            sum += pf(gen.next());        // inlined payoff + generator, vectorizable
        return discount_ * sum / N;
    }
    double price(const Instrument& inst) const override {  // virtual entry, once
        return std::visit([&](auto pf){ return run(pf, makeGen(inst), N_); },
                          inst.payoff());  // variant -> closed set, still inlined
    }
    double discount_; long N_;
};
```

The **outer** `price()` is virtual so you can add engines/instruments and select them from config — that call happens once per valuation, so its cost is invisible. The **inner** `run` is templated (or dispatches over a `std::variant` of a closed payoff set), so the hot loop has no virtual calls, inlines the payoff and path generator, and vectorizes. This is the canonical resolution of the flexibility-vs-speed tension: pay for polymorphism where it's cheap and valuable (setup), and go fully static where it's expensive and hot (the loop). It mirrors QuantLib's Instrument/PricingEngine (Strategy) split, tuned so the numeric core stays monomorphic.
## Error Handling & Numerical Robustness

### Summary

**What this topic covers**

How a C++ pricing library reports failure and how it stays *numerically* correct under the ugly inputs a real desk throws at it. Two intertwined concerns: (1) **error signalling** — when to throw an exception, when to return an error code, when to return `std::expected<T,E>` (C++23), and how `noexcept` participates in both correctness and speed; and (2) **numerical robustness** — keeping arithmetic well-behaved when values are tiny, huge, near-equal, or outright invalid: NaN/inf/denormal handling, catastrophic cancellation, operation reordering, `std::fma`, `log1p`/`expm1`, and input validation (negative vol, T <= 0, negative price). The distinction that runs through the whole topic: **exceptions and validation belong at the library boundary and in setup/config code; the numeric hot path wants branch-free, allocation-free, exception-free arithmetic.** The 16 questions here move from "why not just throw everywhere" to "reorder this variance formula so it doesn't lose all its precision." This is the correctness counterpart to the performance topics — a pricer that is fast but returns a silent NaN on a stressed input is worse than useless on a risk run.

**Mental model**

Split your code into two regions with a hard border. **Outside the border** (constructors, config parsing, calibration setup, the public `price()` entry point) you validate aggressively and fail loudly: throw on a negative volatility, a maturity in the past, a null curve. Setup happens once, so an exception costs nothing measurable and gives a clean stack. **Inside the border** (the Monte Carlo path loop, the PDE sweep, the payoff kernel called a billion times) you assume inputs are already valid, avoid throwing, and treat IEEE-754 as a design surface, not an accident. NaN is *contagious* — one `0.0/0.0` or `log` of a negative poisons every downstream sum. So you either prevent the poison at the boundary or you detect it explicitly at the end (`std::isnan(result)`), never in the middle of a tight loop. Numerical stability is about *how* you compute, not *what*: the same mathematical formula evaluated two ways can differ by orders of magnitude in error. Your job is to pick the evaluation order that keeps relative error bounded.

**Key terms**

- **`std::expected<T,E>`** — C++23 sum type holding either a value or an error; explicit, allocation-free, no stack unwinding. The modern "error code with a payload."
- **`noexcept`** — a promise a function won't throw; enables optimizations and is *required* for `std::vector` to move (not copy) elements on reallocation.
- **NaN** — "not a number"; result of `0.0/0.0`, `sqrt(-1)`, `log(-1)`. `NaN != NaN` is true; propagates through all arithmetic.
- **inf** — overflow / `1.0/0.0`; signed; `inf - inf == NaN`.
- **denormal (subnormal)** — a tiny value below the normal exponent range; often 10-100x slower in hardware. Flush-to-zero (FTZ) trades a negligible accuracy loss for speed.
- **catastrophic cancellation** — subtracting two nearly-equal floating values, annihilating the leading significant digits and amplifying relative error.
- **`std::fma(a,b,c)`** — fused multiply-add: computes `a*b+c` with a *single* rounding, more accurate and often faster than separate ops.
- **`log1p(x)` / `expm1(x)`** — compute `log(1+x)` / `exp(x)-1` accurately for small x, where naive `log(1+x)` loses precision.
- **fail-fast** — detect an invalid state at the earliest boundary and abort that operation, rather than propagating a corrupt value.
- **contract / assertion** — a precondition check (`assert`, or C++26 contracts) that documents and enforces an invariant, typically compiled out in release.

**Why interviewers ask this**

Error handling separates candidates who have only written toy pricers from those who have shipped a risk system that runs overnight on real market data. A junior throws exceptions everywhere (or nowhere) and is surprised when a stressed scenario returns NaN and silently corrupts a P&L report. A senior knows the two-region model, knows that `noexcept` is a performance lever *and* a container-move enabler, and — the real signal — can look at `sqrt((a-b)*(a+b))` versus `sqrt(a*a - b*b)` and say which one survives when `a` and `b` are close. The numerical-stability questions (variance in one pass, cancellation in finite-difference Greeks, `log1p` for near-zero rates) are the ones that actually differentiate quant devs, because they require understanding *why* the naive formula fails, not just memorising the fix.

**Common confusions**

- "Exceptions are slow, so never use them" — they're near-zero-cost on the *non-throwing* path; the cost is only paid when one is thrown. They're fine for setup; the real reason to avoid them on the hot path is they defeat inlining and vectorization, not raw throw cost.
- "`noexcept` just documents intent" — no: marking a move constructor `noexcept` changes which code path `std::vector` takes on growth (move vs copy), a real performance difference for vectors of matrices.
- "Checking `if (x == NaN)` detects NaN" — it never does; `NaN == anything` is false. Use `std::isnan`.
- "`-ffast-math` makes my code faster and correct" — it assumes no NaN/inf and breaks IEEE associativity, silently changing results; dangerous in finance (covered in the build topic).
- "Reordering `(a+b)+c` to `a+(b+c)` can't change the answer" — in floating point it can, because addition isn't associative. Reordering is a *tool* for stability, and a *hazard* for reproducibility.

**What follows from this topic**

`noexcept` and the exceptions-vs-hot-path split feed directly into the low-latency and move-semantics material. The `-ffast-math` danger and sanitizer coverage (UBSan catches signed overflow, which interacts with FTZ tricks) belong to the **Building, Testing & Profiling** topic. Numerical stability connects back to the Quantitative Methods primer — catastrophic cancellation is *why* central-difference Greeks need care and why the Black-Scholes `d1`/`d2` are written the way they are. And `std::expected` reappears when you cross the **C++/Python boundary**, where a thrown C++ exception must be translated into a Python exception rather than leaking across the ABI.

### Q1. Exceptions, error codes, or `std::expected` — how do you decide for a pricing library?

Match the mechanism to the *frequency and locality* of the failure.

**Exceptions** — for failures that are rare, unrecoverable locally, and happen during **setup/config**: a malformed instrument, a null discount curve, a calibration that failed to converge. The non-throwing path is essentially free; you pay only when you throw, which by definition is rare here. They also carry a payload and unwind cleanly through RAII.

**Error codes** (`int`, `enum`, `std::error_code`) — the C-style interop path, or when you're crossing an ABI boundary where exceptions can't propagate.

**`std::expected<T,E>` (C++23)** — for failures that are *expected* and *local*: "this root-find didn't converge," "this implied-vol solve is out of bounds." Explicit in the type, no unwinding, no allocation, composable.

```cpp
#include <expected>
enum class PriceError { NegativeVol, ExpiredOption, NoConvergence };

std::expected<double, PriceError> impliedVol(double price, double S, double K,
                                             double r, double T) {
    if (T <= 0.0)        return std::unexpected(PriceError::ExpiredOption);
    // ... Newton iteration ...
    if (!converged)      return std::unexpected(PriceError::NoConvergence);
    return sigma;                       // the happy path returns a plain double
}

auto v = impliedVol(mktPrice, S, K, r, T);
if (v) useVol(*v);
else   logSolveFailure(v.error());
```

Rule of thumb: **exceptions at the boundary for programmer/config errors; `std::expected` for numeric outcomes the caller is expected to handle; never throw inside the innermost pricing loop.**

### Q2. Why avoid exceptions on the numeric hot path if they're "zero-cost"?

Zero-cost refers to the *non-throwing* path having no runtime overhead versus the throwing path being expensive. Both are true, but neither is the reason to keep them off the hot path.

The real reasons:
- **They block optimization.** A `try`/`catch` region and potentially-throwing calls create implicit control-flow edges the optimizer must preserve, defeating inlining and auto-vectorization of the loop.
- **They break `noexcept` propagation.** A function that might throw can't be `noexcept`, which cascades: containers copy instead of move, and downstream `noexcept` functions can't call it.
- **They're the wrong model for numeric failure.** A NaN in one Monte Carlo path shouldn't unwind the entire simulation. You want to compute the whole batch, then inspect the aggregate.

So on the hot path: validate once at entry, mark the kernel `noexcept`, and let IEEE semantics carry NaN/inf to the end where you check once.

```cpp
double mcPrice(std::span<const double> paths, double K) noexcept {
    double sum = 0.0;
    for (double S : paths) sum += std::max(S - K, 0.0);   // no throw, vectorizable
    return sum / paths.size();
}
```

### Q3. What does `noexcept` actually do, and why does `std::vector` care about it?

`noexcept` is a promise the function won't emit an exception. It has two concrete effects:

1. **Optimization / codegen.** The compiler can omit exception-unwinding scaffolding and optimize more aggressively across the call.
2. **The container move/copy decision.** When `std::vector` reallocates on growth, it must move existing elements to the new buffer. If the element's move constructor is `noexcept`, `vector` *moves* (O(1) per element, steals the buffer). If it is *not* `noexcept`, `vector` must *copy* — because a throw midway through moving would leave the vector in an unrecoverable half-moved state, violating the strong exception guarantee. For a `std::vector<Matrix>` or `std::vector<Path>`, that's the difference between O(n) pointer swaps and O(n·m) deep copies on every growth.

```cpp
struct Path {
    std::vector<double> spots;
    Path(Path&&) noexcept = default;          // <-- makes vector<Path> move on grow
    Path& operator=(Path&&) noexcept = default;
};
```

If you `throw` from a `noexcept` function, `std::terminate` is called — no unwinding. So only promise it when you mean it. Move constructors and destructors should almost always be `noexcept`.

### Q4. A Monte Carlo run returns NaN. How do you find and prevent it?

**Why it happens.** NaN is contagious: `0.0/0.0`, `sqrt(negative)`, `log(non-positive)`, or `inf - inf`. In an MC pricer the usual culprits are `log(S/K)` with a non-positive spot, a negative variance from a broken correlation matrix, or a `sqrt(dt)` where `dt` went negative from a bad schedule. Once one path produces NaN, `sum += payoff` makes the whole average NaN — and `NaN` compares false against every bound, so a naive `if (payoff > barrier)` silently takes the wrong branch.

**Prevention (at the boundary):**

```cpp
void validate(double S, double sigma, double T) {
    if (!(S > 0.0))      throw std::invalid_argument("spot must be > 0");
    if (!(sigma >= 0.0)) throw std::invalid_argument("vol must be >= 0");
    if (!(T > 0.0))      throw std::invalid_argument("maturity must be > 0");
}
```

Note `!(S > 0.0)` rather than `S <= 0.0` — the former *also* rejects a NaN input, because every comparison with NaN is false.

**Detection (at the aggregate, not per-iteration):**

```cpp
double price = sum / n;
assert(std::isfinite(price) && "MC produced NaN/inf — check inputs");
```

**Debugging tool.** Enable the floating-point exception trap so the process faults on the *first* NaN-producing operation, giving you a stack trace at the source:

```cpp
#include <cfenv>
feenableexcept(FE_INVALID | FE_DIVBYZERO);   // glibc; SIGFPE at the culprit op
```

Turn that on in debug builds only — you don't want a SIGFPE in production.

### Q5. What is catastrophic cancellation? Show a finance example.

**Cancellation** happens when you subtract two nearly-equal floating-point numbers: the leading significant digits agree and annihilate, leaving a result dominated by the rounding error of the inputs. Absolute error stays small; **relative** error explodes.

Classic example — the "wrong" way to compute variance in one pass:

```cpp
// Naive:  Var = E[X^2] - (E[X])^2
double sumsq = 0, sum = 0;
for (double x : v) { sumsq += x*x; sum += x; }
double var = sumsq/n - (sum/n)*(sum/n);   // two large near-equal numbers subtracted
```

For MC payoffs with a large mean and small variance (e.g. a deep in-the-money option), `E[X^2]` and `(E[X])^2` are huge and nearly equal, so their difference loses most of its digits — you can even get a *negative* variance. Fix with Welford's stable one-pass algorithm, which never forms that difference:

```cpp
double mean = 0, M2 = 0; long k = 0;
for (double x : v) {
    double d = x - mean;
    mean += d / ++k;
    M2   += d * (x - mean);
}
double var = M2 / (k - 1);                // always >= 0, well-conditioned
```

The same phenomenon is why central finite-difference Greeks (`(f(x+h) - f(x-h)) / 2h`) are delicate: for small `h` the numerator is a difference of near-equal prices, so `h` too small *amplifies* error rather than reducing it. There's an optimal `h ~ sqrt(machine_eps)` balancing truncation against cancellation.

### Q6. Why use `log1p` and `expm1` instead of `log(1+x)` and `exp(x)-1`?

Both fix cancellation near zero, exactly where continuous-compounding and log-return maths lives.

`log(1 + x)` for small `x`: forming `1 + x` rounds away the low bits of `x` (you've added a tiny number to 1.0), so you take the log of an already-corrupted operand. `log1p(x)` computes `log(1+x)` accurately without ever materialising `1+x`.

`exp(x) - 1` for small `x`: `exp(x)` is ~1, and subtracting 1 is catastrophic cancellation. `expm1(x)` computes it directly.

Finance context — a discount factor over a short period at a small rate:

```cpp
double r = 1e-9, dt = 1.0/252;           // near-zero short rate
double naive  = std::exp(-r*dt) - 1.0;   // loses most digits
double stable = -std::expm1(-r*dt);      // accurate

double logret = std::log1p(priceChange); // log(1 + return) for small returns
```

For log-returns from tiny price moves, or continuously-compounded rates near zero, these primitives keep several digits you'd otherwise throw away.

### Q7. What are denormals and why can they wreck performance? What is flush-to-zero?

**Denormals (subnormals)** are floating-point values smaller in magnitude than the smallest *normal* number (~1e-308 for double). IEEE-754 represents them with a gradual-underflow encoding so you don't jump straight to zero. The catch: many CPUs handle denormal operands via a microcode slow path — **10x to 100x slower** than normal arithmetic. In a tight loop (an exponentially-decaying PDE tail, a barrier option whose values decay toward zero, a filter that settles to near-zero), values drift into the denormal range and a hot loop mysteriously slows to a crawl.

**Flush-to-zero (FTZ) / denormals-are-zero (DAZ)** tells the FPU to treat denormal results/inputs as 0.0. You lose a negligible amount of accuracy at the very bottom of the exponent range and get consistent performance:

```cpp
#include <pmmintrin.h>
_MM_SET_FLUSH_ZERO_MODE(_MM_FLUSH_ZERO_ON);      // FTZ: denormal results -> 0
_MM_SET_DENORMALS_ZERO_MODE(_MM_DENORMALS_ZERO_ON); // DAZ: denormal inputs  -> 0
```

For pricing, where anything below ~1e-300 is economically zero anyway, FTZ is almost always the right call on the hot path. (`-ffast-math` enables FTZ too, but drags in other unwanted behaviour — prefer setting the MXCSR bits explicitly.)

### Q8. Reorder this sum for accuracy. What's the general principle?

Summing a large set of MC payoffs by naive accumulation loses precision: once the running total is large, adding a small payoff rounds part of it away.

```cpp
double sum = 0;
for (double x : payoffs) sum += x;        // running total dwarfs each addend -> loss
```

**Principles for stable summation:**
1. **Add smallest-to-largest** when magnitudes vary — but sorting a million paths is expensive.
2. **Kahan (compensated) summation** — track and re-inject the lost low-order bits. O(n), branch-free, near-double-double accuracy:

```cpp
double sum = 0, c = 0;                     // c carries the running compensation
for (double x : payoffs) {
    double y = x - c;
    double t = sum + y;
    c = (t - sum) - y;                     // recovers what was rounded off
    sum = t;
}
```

3. **Pairwise / tree summation** — recursively split and sum halves; O(n) with O(log n) error growth versus O(n) for naive. This is what a well-implemented `std::reduce` effectively does, and it's why `std::reduce` (unordered) can be *more* accurate as well as parallelisable than a serial `accumulate`.

The general rule: **floating-point addition is not associative, so the order and grouping of a sum determine its error.** For MC that means Kahan or pairwise for the final aggregation, and being aware that a parallel reduction will give a bit-different (often better-conditioned) answer than the serial one.

### Q9. When should you use `std::fma`?

`std::fma(a, b, c)` computes `a*b + c` with a **single rounding** at the end, versus `a*b` (rounded) then `+ c` (rounded again) for the plain expression. Two benefits:

- **Accuracy** — one rounding instead of two, so the intermediate `a*b` is kept at full internal precision. Matters in polynomial evaluation (Horner's rule for a rational approximation of `N(x)`, the normal CDF), dot products, and iterative refinement.
- **Speed** — modern CPUs have a hardware FMA instruction, so `fma` is often a *single* cycle-comparable instruction rather than two, and it's the building block auto-vectorizers emit.

```cpp
// Horner evaluation of a polynomial approximation to the normal CDF tail
double poly(double x, std::span<const double> coef) {
    double acc = coef[0];
    for (size_t i = 1; i < coef.size(); ++i)
        acc = std::fma(acc, x, coef[i]);   // acc*x + coef[i], one rounding
    return acc;
}
```

Caveat: results differ bit-for-bit from the non-FMA version, so if you need cross-platform reproducibility down to the last ULP, be consistent about whether FMA is used (and note `-ffast-math`/`-march=native` may introduce it silently).

### Q10. Design input validation for a Black-Scholes pricer. What do you check and where?

Validate **once, at the public boundary**, then trust the inputs inside the kernel. The checks encode the domain of the model.

```cpp
double blackScholesCall(double S, double K, double r, double sigma, double T) {
    // --- boundary validation: fail fast, throw, done once ---
    if (!(S > 0.0))      throw std::invalid_argument("spot S must be > 0");
    if (!(K > 0.0))      throw std::invalid_argument("strike K must be > 0");
    if (!(sigma >= 0.0)) throw std::invalid_argument("vol sigma must be >= 0");
    if (!(T >= 0.0))     throw std::invalid_argument("maturity T must be >= 0");

    // --- degenerate but valid edge cases: closed-form limits, not errors ---
    if (T == 0.0 || sigma == 0.0)            // no time / no vol -> intrinsic (discounted)
        return std::max(S - K * std::exp(-r * T), 0.0);

    // --- hot path: inputs guaranteed valid, no further checks ---
    double sqrtT = std::sqrt(T);
    double d1 = (std::log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * sqrtT);
    double d2 = d1 - sigma * sqrtT;
    return S * normcdf(d1) - K * std::exp(-r * T) * normcdf(d2);
}
```

Key decisions:
- **`!(x > 0)` not `x <= 0`** so NaN inputs are rejected (NaN fails `> 0`).
- **Distinguish invalid from degenerate.** `T <= 0` in the sense of *negative* is an error; `T == 0` or `sigma == 0` are legitimate limits with a closed-form answer (intrinsic value) — return it, don't divide by zero.
- **Negative rates are allowed** (they've been real since 2015), so don't validate `r > 0`.
- Everything is checked *before* the arithmetic that could otherwise produce NaN/inf, so the hot path is clean.

### Q11. `assert`, exceptions, or C++ contracts — which for preconditions?

They serve different audiences and lifetimes.

| Mechanism | Checks | Active in release? | For |
|---|---|---|---|
| `assert` | programmer invariants | No (compiled out by `NDEBUG`) | internal "can't happen" bugs |
| exception | recoverable / caller errors | Yes | invalid *external* input at the boundary |
| contracts (C++26) | pre/post-conditions | Configurable | documented interface obligations |

Rule: **`assert` for things that indicate a bug in *your* code** (a negative variance after a computation that should guarantee non-negativity) — you want it loud in testing and gone in release for speed. **Exceptions for bad input from *outside*** (a user-supplied negative vol) — that must be checked even in release. Don't use `assert` to validate external input: it vanishes under `NDEBUG`, so your production build would silently proceed with garbage.

```cpp
double variance = welford.result();
assert(variance >= 0.0);              // our algorithm guarantees this; catch bugs in test

if (userVol < 0.0)                    // external input; must reject in release too
    throw std::invalid_argument("vol < 0");
```

C++26 contracts (`pre`, `post`) formalise the precondition idea with a runtime-configurable enforcement mode, but the *decision* — invariant vs external input — is unchanged.

### Q12. Fail-fast at the boundary vs graceful degradation — which for a risk system?

Depends on whether a single bad input should sink the *whole batch*.

**Fail-fast** (throw immediately) is right for **construction and config**: if a curve is malformed, nothing built on it is trustworthy, so stop now with a clear error rather than producing a plausible-looking wrong number.

**Graceful degradation** is right for a **batch valuation** across a large portfolio: if one exotic among 100,000 trades fails to converge, you do *not* want the whole overnight risk run to abort. You want that trade flagged and the other 99,999 to complete. This is exactly where `std::expected` shines — the per-trade result is a value-or-error, and the batch driver collects failures without unwinding:

```cpp
struct Report { std::vector<double> prices; std::vector<TradeId> failed; };

Report pricePortfolio(std::span<const Trade> trades) {
    Report rep;
    for (const auto& t : trades) {
        if (auto p = priceTrade(t))          // std::expected<double, Error>
            rep.prices.push_back(*p);
        else
            rep.failed.push_back(t.id);      // record, keep going
    }
    return rep;
}
```

The senior instinct: **fail-fast where a fault invalidates everything downstream; degrade gracefully where faults are independent and the batch has value even when partially complete.** A risk run that dies on trade #7 of 100k is an operational incident; one that returns 99,993 prices and a list of 7 failures is a Tuesday.

### Q13. Spot the numerical bug: computing `sqrt(a*a - b*b)`.

```cpp
double f(double a, double b) { return std::sqrt(a*a - b*b); }   // fragile
```

Two problems when `a` and `b` are close (`a ~ b`):
1. **Cancellation** — `a*a - b*b` subtracts two near-equal large numbers, destroying precision before the `sqrt` ever runs.
2. **Spurious NaN** — if rounding pushes `a*a - b*b` slightly negative when the true value is a tiny positive, `sqrt` returns NaN.

Fix by factoring to avoid the direct subtraction of squares:

```cpp
double f(double a, double b) {
    return std::sqrt((a - b) * (a + b));   // a-b computed once, no squared cancellation
}
```

`(a-b)*(a+b)` is algebraically identical but numerically far better: `a-b` still cancels, but it's a *single* subtraction of the originals (not their squares), preserving relative accuracy, and the product's sign is correct so no spurious NaN. This pattern recurs in implied-vol and barrier maths, and it's the same reasoning behind `std::hypot(a,b)` for `sqrt(a*a+b*b)` (which additionally guards against overflow of the intermediate squares).

### Q14. How do you compare two doubles for equality in pricing code?

Never with `==`. Rounding means two computations of "the same" value differ in the low bits. Use a **combined absolute + relative** tolerance:

```cpp
bool nearlyEqual(double a, double b,
                 double relTol = 1e-9, double absTol = 1e-12) {
    if (a == b) return true;                    // exact / both inf of same sign
    double diff = std::fabs(a - b);
    double scale = std::max(std::fabs(a), std::fabs(b));
    return diff <= std::max(absTol, relTol * scale);
}
```

Why both terms:
- **Relative** (`relTol * scale`) handles large values — 1,000,000.0 vs 1,000,000.1 should compare equal at a sensible tolerance.
- **Absolute** (`absTol`) handles values *near zero*, where relative tolerance collapses (relative error near 0 is meaningless / divides by ~0).

For test assertions on prices, pick tolerances tied to the expected accuracy (an MC price is good to ~standard-error, a closed form to ~1e-10). An alternative is **ULP** comparison (count representable doubles between them) via bit-casting, useful for low-level numeric tests but overkill for pricing-level checks. Note `nearlyEqual(NaN, NaN)` is `false`, which is usually what you want — a NaN result is never "equal" to anything, including itself.

### Q15. Should you rely on IEEE-754 semantics for reproducibility across machines and runs?

Only if you control the compilation and execution carefully — reproducibility is *fragile*.

Sources of divergence for the "same" computation:
- **`-ffast-math`** — reorders and contracts operations; non-reproducible by design. Never on for reproducible finance.
- **FMA contraction** — `a*b+c` may or may not fuse depending on `-march`/`-ffp-contract`, changing the last bits.
- **Reduction order** — a parallel MC sum combines partial sums in a nondeterministic order; since float addition isn't associative, the total varies run to run with the thread count/schedule.
- **Transcendental functions** — `exp`, `log`, `normcdf` are *not* bit-identical across libm implementations or platforms. IEEE mandates correct rounding for `+ - * / sqrt`, but **not** for transcendentals.
- **x87 excess precision** — legacy 80-bit intermediates (mostly gone with SSE/AVX, but a classic gotcha).

To get bitwise reproducibility you must: fix the compiler and flags, disable fast-math, pin FP-contract, use a **deterministic reduction** (fixed-order or fixed-tree, e.g. per-thread partials combined in thread-index order), and possibly ship your own correctly-rounded transcendentals. Most desks settle for **run-to-run reproducibility on one build/platform** (fixed RNG seeds + deterministic reduction) rather than true cross-platform bit-identity, which is expensive to guarantee. The interview point: know that "IEEE-754" guarantees rounding of the basic ops but not associativity, not transcendentals, and not your reduction order.

### Q16. A stress scenario produces `inf`. How do you handle it robustly?

`inf` arises from overflow (`exp` of a large argument, division by a value that underflowed to zero) and, unlike NaN, is *ordered* — so comparisons behave, but arithmetic can still turn it into NaN (`inf - inf`, `inf / inf`, `0 * inf`).

Handling strategy:
1. **Prevent at the boundary.** Cap or validate inputs that could overflow — e.g. an absurd volatility or a rate that makes `exp(-r*T)` overflow. A stress scenario that sets vol to 10,000% should be rejected or clamped, not silently pushed through.
2. **Guard the specific operations.** In a GBM step, `exp((r - 0.5*sigma*sigma)*dt + sigma*sqrt(dt)*Z)` can overflow for a huge `sigma` or a fat-tailed `Z`. Clamp the exponent argument or the resulting spot to a sane bound if the model domain allows.
3. **Detect at the aggregate.** `std::isinf(price)` (or `std::isfinite`) at the end, and surface it as a *typed error*, not a number that flows into a P&L:

```cpp
double price = compute(scenario);
if (!std::isfinite(price))
    return std::unexpected(PriceError::Overflow);   // don't ship inf into risk
```

4. **Beware the `inf - inf = NaN` trap.** In a spread/portfolio sum, one `+inf` leg and one `-inf` leg cancel to NaN, which then poisons everything. Detect non-finite *per leg* before combining if legs can independently blow up.

The principle mirrors NaN handling: keep infinities out of the middle of computations by validating inputs, and never let a non-finite value escape the library boundary as if it were a valid price.

## Interfacing C++ with Python

### Summary

**What this topic covers**

The single most important architectural pattern in modern quant work: **C++ compute core, Python research and orchestration layer**, and the machinery that joins them without throwing away the performance you built C++ for. The topic covers (1) the **two-language pattern** and *why* it dominates quant stacks; (2) the binding tools — **pybind11** (the modern default), Cython, ctypes, and SWIG (which QuantLib uses); (3) the **GIL** — what it is, why it serialises Python threads, and how releasing it around C++ compute lets Python threads progress; and (4) **zero-copy** data exchange via the buffer protocol / NumPy so you never copy a million-path array across the boundary. The through-line: the boundary is *coarse-grained*. You cross it rarely with big payloads (price a whole book, simulate a million paths in one call), not in a hot loop. Cross it per-element and you've paid C++'s complexity cost and kept Python's speed. The 16 questions run from "why two languages at all" to "wrap this templated pricer and expose it to NumPy zero-copy while releasing the GIL."

**Mental model**

Picture two rooms with one narrow, expensive door between them. The **Python room** is where researchers live: notebooks, pandas, matplotlib, scikit-learn, fast iteration, glue. The **C++ room** is where the heavy compute lives: the pricing kernels, the Monte Carlo engine, the PDE solver — anything in a hot loop. The door is the language boundary, and every crossing costs: type conversion, potential data copies, GIL juggling. So the design rule writes itself: **make the C++ room do a lot per visit, and visit rarely.** A good binding exposes a `price_portfolio(trades) -> array` that goes in once and comes back once, having done a billion floating-point operations inside. A bad binding exposes `add(a, b)` and gets called a million times from a Python loop — now you're paying door tolls with no compute behind them. Two corollaries: (1) while you're in the C++ room doing long compute, *release the GIL* so other Python threads aren't locked out; (2) hand big arrays through the door *by reference* (buffer protocol) — copying a million doubles each way defeats the point.

**Key terms**

- **two-language pattern / two-language problem** — the productivity win (Python) plus performance (C++) combo; the "problem" is the friction of maintaining and bridging both.
- **pybind11** — header-only C++11 library that exposes C++ functions/classes to Python with automatic type conversions; the modern default for new bindings.
- **nanobind** — pybind11's leaner, faster successor by the same author; same idea, smaller overhead.
- **Cython** — a Python-superset compiled to C; good for speeding up Python and calling C/C++.
- **ctypes** — stdlib FFI calling plain C shared libraries at runtime; no build step, C ABI only.
- **SWIG** — generator producing bindings for many languages from interface files; **QuantLib** uses it.
- **GIL (Global Interpreter Lock)** — a mutex serialising CPython bytecode execution; only one thread runs Python at a time.
- **`py::gil_scoped_release`** — RAII guard that releases the GIL for the duration of a C++ compute block, letting other Python threads run.
- **buffer protocol** — CPython's contract (`Py_buffer`) for exposing a raw contiguous memory block without copying; how NumPy arrays are shared.
- **zero-copy** — passing data by exposing the same memory to both sides rather than duplicating it.
- **`py::array_t<double>`** — pybind11's typed NumPy array wrapper; gives you a raw pointer into the array's buffer.
- **ABI boundary** — the binary contract at the door; C++ exceptions must be translated to Python exceptions here, not leaked across.

**Why interviewers ask this**

Because this *is* the job at most quant desks and funds. Almost every production quant stack is C++ under Python, and knowing how the two connect — really knowing, not "I've heard of pybind11" — is a direct proxy for having worked in one. Juniors describe the two-language pattern in the abstract. Seniors know the *failure modes*: the person who wrapped a scalar `price()` and called it in a Python `for` loop over a million rows and got Python speed; the person who forgot to release the GIL and wondered why their "multithreaded" backtest ran serially; the person who copied a huge NumPy array in and out every call and lost all the C++ advantage to memcpy. Being able to say "coarse-grained calls, release the GIL around the compute, zero-copy the arrays" — and show the pybind11 to back it — is a strong, hard-to-fake signal of real experience.

**Common confusions**

- "Bindings make Python calls as fast as C++" — no; each *crossing* has overhead. The win comes from doing lots of work per crossing, not from making crossings cheap.
- "Multithreading Python over my C++ pricer gives parallel speedup automatically" — only if the C++ releases the GIL; otherwise the GIL serialises everything.
- "`py::array` copies the data" — it doesn't have to; with the buffer protocol you get a pointer into NumPy's own memory. Copies happen only when you force them (dtype mismatch, non-contiguous, requesting a copy).
- "The GIL means C++ code can't run in parallel" — false; the GIL only guards the *Python interpreter*. Native C++ threads (or OpenMP inside your kernel) run fully parallel; you just release the GIL while they do.
- "SWIG is obsolete" — it's older and clunkier than pybind11, but QuantLib ships production bindings with it; it's still very much alive.

**What follows from this topic**

Releasing the GIL is only safe and useful because your C++ can be genuinely parallel — which ties straight to the **Concurrency** topic (per-thread RNG, parallel reductions) and the low-latency material. Zero-copy array exchange leans on **`std::span`/`std::mdspan`** (non-owning views, covered in the modern-C++ and memory topics) as the natural C++ side of a NumPy buffer. Exception translation at the boundary connects to **Error Handling** — a C++ `std::invalid_argument` should surface as a Python `ValueError`, not a crash. And the whole pattern is *why* the compute topics (Monte Carlo engine, PDE, Greeks) are written in C++ in the first place: they're the payload that makes crossing the expensive door worth it.

### Q1. Why the two-language pattern — C++ core, Python layer? Why not one language?

Because the two languages optimise for opposite things and quant work needs both.

**Python** wins on *iteration speed and ecosystem*: notebooks, pandas, NumPy, matplotlib, scikit-learn, a REPL, no build step. A researcher can test a hypothesis, plot a vol surface, and pull market data in minutes. But CPython is slow for tight numeric loops and the GIL limits threading.

**C++** wins on *execution speed and control*: hand-tuned Monte Carlo, cache-friendly PDE solvers, deterministic RAII, no GC pauses, SIMD. But it's slow to *write* and iterate — recompile cycles, verbose, easy to get memory bugs.

The pattern gives you both: **write the hot compute once in C++, expose it to Python, and do all the research/glue/plumbing in Python.** Researchers stay productive; the numbers come out fast.

Why not one language? Pure Python is too slow for the pricing core (a million-path MC in a Python loop is hopeless). Pure C++ makes research glacial — no one wants to recompile to re-plot a curve. Julia and Rust chip at the edges (Julia tries to *solve* the two-language problem outright; Rust competes with C++ for the core), but the installed base, QuantLib, and every bank's legacy library keep C++-under-Python the industry default. The "two-language *problem*" is the maintenance friction of that split — but it's a price the industry pays gladly.

### Q2. Wrap a C++ `price()` function with pybind11. Show the module.

pybind11 is header-only; you write a small `PYBIND11_MODULE` block and the type conversions are automatic.

```cpp
#include <pybind11/pybind11.h>
#include <cmath>
namespace py = pybind11;

double black_scholes_call(double S, double K, double r, double sigma, double T) {
    double sqrtT = std::sqrt(T);
    double d1 = (std::log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * sqrtT);
    double d2 = d1 - sigma * sqrtT;
    auto N = [](double x){ return 0.5 * std::erfc(-x / std::sqrt(2.0)); };
    return S * N(d1) - K * std::exp(-r * T) * N(d2);
}

PYBIND11_MODULE(pricer, m) {                       // module name == compiled .so name
    m.doc() = "C++ pricing core";
    m.def("black_scholes_call", &black_scholes_call,
          py::arg("S"), py::arg("K"), py::arg("r"),
          py::arg("sigma"), py::arg("T"),
          "European call price under Black-Scholes");
}
```

From Python, after building:

```python
import pricer
pricer.black_scholes_call(S=100, K=100, r=0.02, sigma=0.2, T=1.0)   # 8.916...
```

`double`, `int`, `std::string`, `std::vector`, `std::optional` etc. convert automatically. The named `py::arg` give Python keyword arguments and defaults. This is the "hello world," but note it's *scalar* — the next step (Q7) is making it operate on a whole NumPy array in one call so the boundary crossing is worth it.

### Q3. Expose a C++ class to Python with pybind11.

For a stateful pricer you bind the class, its constructor, methods, and properties.

```cpp
#include <pybind11/pybind11.h>
namespace py = pybind11;

class MonteCarloPricer {
    double S_, r_, sigma_;
    std::size_t nPaths_;
public:
    MonteCarloPricer(double S, double r, double sigma, std::size_t nPaths)
        : S_(S), r_(r), sigma_(sigma), nPaths_(nPaths) {}
    double price(double K, double T) const;        // runs the simulation
    double standardError() const;
    std::size_t paths() const { return nPaths_; }
    void setPaths(std::size_t n) { nPaths_ = n; }
};

PYBIND11_MODULE(mc, m) {
    py::class_<MonteCarloPricer>(m, "MonteCarloPricer")
        .def(py::init<double, double, double, std::size_t>(),
             py::arg("S"), py::arg("r"), py::arg("sigma"), py::arg("n_paths"))
        .def("price", &MonteCarloPricer::price, py::arg("K"), py::arg("T"))
        .def("standard_error", &MonteCarloPricer::standardError)
        .def_property("n_paths", &MonteCarloPricer::paths,
                                 &MonteCarloPricer::setPaths);
}
```

```python
from mc import MonteCarloPricer
p = MonteCarloPricer(S=100, r=0.02, sigma=0.2, n_paths=1_000_000)
price, se = p.price(K=105, T=1.0), p.standard_error()
```

`py::init<...>` binds a constructor; `.def_property` exposes getter/setter as a Python attribute. The C++ object lives on the heap and its lifetime is managed by Python's refcount — when the Python object is collected, the C++ destructor runs (RAII across the boundary). You can also control ownership with return-value policies for methods that hand back pointers/references.

### Q4. Compare pybind11, Cython, ctypes, and SWIG. When each?

| Tool | Style | Best for | Notes |
|---|---|---|---|
| **pybind11** | C++ header lib, bind in C++ | New C++/Python bindings | Modern default; clean C++11 API; auto conversions; great NumPy support |
| **nanobind** | like pybind11, leaner | Perf-critical new bindings | Same author; lower overhead, smaller binaries |
| **Cython** | Python-superset -> C | Speeding up Python, thin C wrappers | Write `.pyx`; good when the *Python* side is the bottleneck |
| **ctypes** | stdlib runtime FFI | Calling a plain **C** `.so`, no build | C ABI only; no C++ classes; no compile step; verbose for complex types |
| **SWIG** | interface-file generator | Many target languages at once | **QuantLib** uses it; older, clunkier, generates a lot of code |

Decision guide:
- **Greenfield C++ core exposed to Python** -> **pybind11** (or nanobind if overhead matters). It's the ergonomic sweet spot: write idiomatic C++, get idiomatic Python.
- **You have a C shared library and want a quick call** with no build tooling -> **ctypes**.
- **Your bottleneck is Python code** you want to compile, not an existing C++ lib -> **Cython**.
- **You need bindings for several languages** (Python, Java, C#) from one interface, or you're **extending QuantLib** -> **SWIG**, because that's what QuantLib's binding layer is built on.

For a typical quant desk building a new pricing library today, pybind11 is the answer unless you're specifically in QuantLib's SWIG world.

### Q5. What is the GIL and why does it matter for a C++/Python quant stack?

The **Global Interpreter Lock** is a mutex in CPython that allows only **one thread to execute Python bytecode at a time**. It exists to make CPython's memory management (reference counting) thread-safe without fine-grained locking. Consequence: pure-Python multithreading gives you *concurrency* (threads interleave) but not *parallelism* on CPU-bound work — N threads running Python don't use N cores; they take turns.

Why it matters for a quant stack: if your expensive compute is in C++ *but you hold the GIL while running it*, then Python threads calling your pricer are serialised — a "multithreaded" backtest that farms scenarios across threads runs one at a time, wasting your cores. The fix (next question) is that **native C++ code doesn't need the GIL** — the lock only protects the *Python interpreter*, not your C++ arithmetic. So you release it around the compute. Multiprocessing sidesteps the GIL entirely by using separate processes (separate interpreters), at the cost of no shared memory and IPC overhead. Note the industry is mid-transition: CPython 3.13+ ships an experimental **free-threaded (no-GIL) build**, but for now assume the GIL is there and design around it.

### Q6. How and why do you release the GIL in a pybind11 binding?

You release it around any **long-running C++ compute that doesn't touch Python objects**, so other Python threads can run meanwhile. pybind11 gives you an RAII guard:

```cpp
#include <pybind11/pybind11.h>
namespace py = pybind11;

double price_long_running(const MonteCarloPricer& p, double K, double T) {
    double result;
    {
        py::gil_scoped_release release;     // GIL dropped for this scope
        result = p.price(K, T);             // pure C++, no Python API calls here
    }                                        // GIL re-acquired on scope exit
    return result;                           // now safe to build the Python return value
}
```

Why it works and why it's safe: the GIL only guards the CPython interpreter. Your MC loop is native code that never calls a Python C-API function, so it doesn't need the lock — dropping it lets other threads execute Python (or enter *their* C++ compute) truly in parallel. **The rule: never touch a Python object (create, refcount, call back into Python) while the GIL is released** — that's a race/crash. Acquire it back (automatically, via the RAII scope, or `py::gil_scoped_acquire` for a callback) before doing so.

Impact: with the GIL released, a Python `ThreadPoolExecutor` mapping scenarios onto your C++ pricer actually uses all cores. Without the release, it runs serially no matter how many threads you spawn. This one line is the difference between a parallel and an accidentally-serial backtest — a very common real-world bug.

### Q7. Take a NumPy array of spots and return payoffs zero-copy. Show it.

Bind a function taking `py::array_t<double>`, get a raw pointer into NumPy's buffer, and write into a pre-sized output array — no element-wise crossing, no copies.

```cpp
#include <pybind11/numpy.h>
namespace py = pybind11;

py::array_t<double> call_payoffs(py::array_t<double, py::array::c_style |
                                               py::array::forcecast> spots,
                                 double K) {
    auto buf = spots.request();                     // Py_buffer: ptr + shape, no copy
    const double* in = static_cast<double*>(buf.ptr);
    std::size_t n = buf.shape[0];

    auto out = py::array_t<double>(n);              // allocate result once
    double* o = static_cast<double*>(out.request().ptr);

    {
        py::gil_scoped_release release;             // heavy loop, drop the GIL
        for (std::size_t i = 0; i < n; ++i)
            o[i] = std::max(in[i] - K, 0.0);        // operate on raw contiguous memory
    }
    return out;                                      // NumPy owns it, no copy back
}
```

```python
import numpy as np, pricer
spots = np.random.lognormal(size=1_000_000)
payoffs = pricer.call_payoffs(spots, K=1.0)          # one crossing, a million elements
```

Key points: `spots.request()` exposes NumPy's own buffer via the buffer protocol — **the input is not copied** (as long as it's C-contiguous `double`; `forcecast` would copy only on dtype mismatch). We loop over raw pointers at full C++ speed, release the GIL for the duration, and hand back a NumPy array pybind11 manages. This is the *right* granularity: one boundary crossing, a million elements of compute inside. Contrast with binding a scalar `payoff(x)` and calling it in a Python loop — same math, orders of magnitude slower.

### Q8. Why is calling a scalar C++ function in a Python loop a performance trap?

Because you pay the expensive boundary crossing a million times and get almost no compute per crossing — the C++ speed is drowned by call overhead.

```python
# TRAP: one crossing per element
payoffs = [pricer.scalar_payoff(s, K) for s in spots]   # 1e6 boundary crossings
```

Each call does: acquire GIL context, marshal Python floats to C++ `double`, dispatch, marshal the result back to a Python float, refcount bookkeeping. That fixed per-call cost (tens to hundreds of nanoseconds) dwarfs a single `max(s-K, 0)`. Net result: you've built and maintained a C++ extension and gotten *Python-loop* performance, because the loop itself is in Python and the door toll is paid per iteration.

The fix is **batching / vectorization** — cross once with the whole array (Q7):

```python
payoffs = pricer.call_payoffs(spots, K)     # 1 crossing, loop is in C++
```

General principle: **the boundary must be coarse-grained.** Amortise the crossing cost over a large payload. Design your API around "do a lot per call" (`price_portfolio`, `simulate_paths`, `payoffs_of_array`), never "do a little, called often." If you find yourself writing a Python `for` loop around a C++ call, push the loop into C++.

### Q9. When should computation cross into C++ vs stay in Python (or NumPy)?

Cross into C++ when the work is a **tight numeric loop that NumPy can't vectorize well**, and stay in Python/NumPy when the work is already vectorized or is glue.

Stay in Python / use NumPy when:
- The operation is a **whole-array vectorized** op (`spots - K`, `np.maximum(...)`, a `.dot()`), where NumPy already runs C under the hood.
- It's **orchestration**: reading market data, building schedules, plotting, assembling results.
- The data is small enough that Python overhead is irrelevant.

Cross into C++ when:
- There's an **inherently sequential/path-dependent loop** NumPy can't express without materialising huge intermediates — an American-option backward induction, a barrier check along each path, a PDE time-stepping sweep.
- You need **fine control**: custom RNG streams, cache-friendly layouts, SIMD, deterministic reduction.
- The Python/NumPy version allocates enormous temporaries or is too slow despite vectorization.

The decision is really *granularity plus expressibility*: if NumPy vectorizes it, let NumPy do it (it's C already, no boundary friction); if it needs a genuine element-by-element or step-by-step loop, that loop belongs in C++ — and you cross the boundary *once* with the whole dataset. A path-dependent MC where each step depends on the last is the canonical "must be C++" case; a European payoff over a precomputed terminal-spot array is a "just use NumPy" case.

### Q10. Show a pybind11 binding for a *templated* pricer. How do templates cross the boundary?

Templates are a *compile-time* feature; Python has no notion of them. So you can't expose a template directly — you **explicitly instantiate** it for the concrete types you want and bind each instantiation (optionally under one name via overloads).

```cpp
template <class Real>
Real bs_call(Real S, Real K, Real r, Real sigma, Real T) { /* ... */ }

// A generic MC engine templated on a Payoff functor:
template <class Payoff>
double mc_price(const Payoff& payoff, double S, double r,
                double sigma, double T, std::size_t n);

struct CallPayoff { double K; double operator()(double s) const {
    return std::max(s - K, 0.0); } };
struct PutPayoff  { double K; double operator()(double s) const {
    return std::max(K - s, 0.0); } };

PYBIND11_MODULE(pricer, m) {
    // instantiate the template for double and bind it
    m.def("bs_call", &bs_call<double>);

    // bind the payoff types, then bind concrete instantiations of the engine
    py::class_<CallPayoff>(m, "CallPayoff").def(py::init<double>());
    py::class_<PutPayoff>(m,  "PutPayoff").def(py::init<double>());
    m.def("mc_price", &mc_price<CallPayoff>);
    m.def("mc_price", &mc_price<PutPayoff>);     // overload: pybind picks by arg type
}
```

The mechanism: each `&mc_price<CallPayoff>` forces the compiler to *generate* that concrete function, and pybind11 binds the generated symbol. From Python you pass a `CallPayoff` or `PutPayoff` and pybind11 dispatches to the right overload. The benefit of the template (the payoff is inlined into the MC loop, no virtual dispatch — see the CRTP topic) is preserved *inside* C++; Python just sees the finished, specialised functions. You expose the *menu* of instantiations you care about, not the template itself.

### Q11. How are C++ exceptions handled across the pybind11 boundary?

A C++ exception must be **translated into a Python exception** at the boundary — it can't propagate as a C++ exception into the interpreter (that would cross an ABI it doesn't understand and crash). pybind11 does this automatically for the standard hierarchy:

| C++ exception | becomes Python |
|---|---|
| `std::invalid_argument` | `ValueError` |
| `std::domain_argument` / `std::out_of_range` | `ValueError` / `IndexError` |
| `std::runtime_error` | `RuntimeError` |
| `std::bad_alloc` | `MemoryError` |
| `std::exception` (fallback) | `RuntimeError` |

So a boundary-validation throw surfaces Pythonically:

```cpp
double bs_call(double S, double K, double r, double sigma, double T) {
    if (!(sigma >= 0.0)) throw std::invalid_argument("vol must be >= 0");
    // ...
}
```
```python
try:
    pricer.bs_call(100, 100, 0.02, -0.2, 1.0)
except ValueError as e:
    print(e)          # "vol must be >= 0"
```

For a custom error type, register a translator:

```cpp
py::register_exception<CalibrationError>(m, "CalibrationError");
```

Two cautions: (1) if you **released the GIL**, you must *not* let an exception's Python-object construction happen while it's released — pybind re-acquires when translating, but code that manually manages the GIL must be careful. (2) **Never let an exception escape a `noexcept` boundary or a C callback** — it calls `std::terminate`. This is exactly why the **Error Handling** topic's "throw at the boundary" rule pairs with translation: the throw happens just inside C++, gets converted at the wrapper, and the Python researcher sees a normal `ValueError`.

### Q12. How does object lifetime / memory ownership work across the boundary?

When Python holds a C++ object created via pybind11, **Python's reference count owns it** — the C++ destructor runs when the Python object is garbage-collected. That's clean RAII across the door for the common case. The subtlety is *shared* ownership and *non-owning views*, controlled by **return-value policies**:

```cpp
py::class_<Engine>(m, "Engine")
    .def("child", &Engine::child,
         py::return_value_policy::reference_internal);   // child alive while parent is
```

Common policies:
- **`copy`** — copy the returned object into a new Python-owned instance (safe default for small values).
- **`move`** — move it (for returned-by-value big objects).
- **`reference`** — Python gets a *non-owning* reference; **dangerous** if C++ frees it while Python still holds it (dangling).
- **`reference_internal`** — reference *tied to the parent's* lifetime (keep-alive); the right choice when returning a pointer to a sub-object (a leg of a trade, an element of an internal container).
- **`take_ownership`** — Python takes ownership of a raw pointer and will `delete` it.

The classic bug: returning a pointer/reference to a temporary or to internal storage with `reference` policy, so C++ frees it and Python is left with a dangling pointer -> crash or corruption. For shared ownership across the boundary, use `std::shared_ptr` as the holder type so both sides participate in the refcount. And with **zero-copy NumPy** (Q7), if you return a view over a C++ buffer, you must keep that buffer alive as long as the array exists — use a `base` object / keep-alive so NumPy's array pins your C++ memory.

### Q13. What is the buffer protocol and how does it enable zero-copy?

The **buffer protocol** is CPython's low-level contract (`Py_buffer`) by which an object exposes a **raw, contiguous block of memory** — pointer, item size, shape, strides, format — to other code *without copying*. NumPy arrays implement it; that's how libraries share the same bytes. pybind11 wraps both ends of it.

Two directions:

**Consuming** a NumPy array in C++ (`arr.request()` gives you the `Py_buffer`) — you read/write NumPy's own memory directly (Q7).

**Exposing** a C++ container to Python as a NumPy array without copying — implement `def_buffer` so Python can wrap your C++ memory:

```cpp
py::class_<Matrix>(m, "Matrix", py::buffer_protocol())
    .def_buffer([](Matrix& mx) -> py::buffer_info {
        return py::buffer_info(
            mx.data(),                         // pointer to the raw buffer
            sizeof(double),                    // item size
            py::format_descriptor<double>::format(),
            2,                                 // ndim
            { mx.rows(), mx.cols() },          // shape
            { sizeof(double) * mx.cols(),      // strides (row-major)
              sizeof(double) });
    });
```

Now `np.asarray(cpp_matrix)` gives a NumPy view over the C++ matrix's memory — **no copy**. The payoff: a million-path simulation writes into a C++ buffer, and Python plots/analyses it via NumPy without ever duplicating the data. The obligation (Q12): the C++ buffer must outlive the NumPy view, or you get a dangling-pointer crash — manage that with a keep-alive/base object. Strides matter too: expose the correct row/column-major strides or NumPy will misread the layout.

### Q14. Design the boundary for a Monte Carlo backtest: C++ or Python for each piece?

Split by the *coarse-grained, compute-heavy vs glue* rule.

**Python (the thin, wide top):**
- Load market data, build the scenario grid, parse config.
- Orchestrate: for each scenario/parameter set, call into C++.
- Aggregate, analyse, and plot results with pandas/matplotlib.
- Parallelise scenarios with a thread pool — *works* because the C++ releases the GIL.

**C++ (the deep, narrow core):**
- The path generator (GBM stepping), payoff kernels, the accumulator (mean + standard error).
- Per-thread RNG and the parallel reduction over paths (Concurrency topic).
- Exposed as a **coarse** call: `simulate(params, n_paths) -> (price, se)` or, better, `simulate_batch(param_array) -> results_array`.

```cpp
PYBIND11_MODULE(engine, m) {
    m.def("simulate_batch",
        [](py::array_t<double> params, std::size_t nPaths) {
            auto out = py::array_t<double>(/* n scenarios */);
            {
                py::gil_scoped_release release;      // release around the heavy loop
                // C++ threads, per-thread RNG, fill `out` zero-copy
            }
            return out;                              // one crossing back
        }, py::arg("params"), py::arg("n_paths"));
}
```

The boundary is crossed **once per batch**, carrying arrays both ways (zero-copy), with the GIL released so Python's scenario-level thread pool runs the C++ in parallel. Everything researchers want to *change often* (which scenarios, how to plot) stays in Python for fast iteration; everything that must be *fast* stays in C++. That's the pattern working as intended: coarse boundary, big payloads, GIL released, zero-copy.

### Q15. When do you build the extension with C++ threads inside, vs relying on Python threads/multiprocessing?

Three parallelism strategies; pick by where the work and the data live.

**C++ threads inside one call (with the GIL released)** — best for a *single* heavy computation parallelised internally: one `simulate(n_paths)` that splits a billion paths across cores using per-thread RNG and a reduction. You cross the boundary once, release the GIL, and use OpenMP/`std::thread`/TBB inside. Maximum efficiency, shared memory, no IPC. This is the default for a compute kernel.

**Python threads over a GIL-releasing C++ core** — best for *many independent* coarse C++ calls: a scenario grid where each scenario is one C++ call. A `ThreadPoolExecutor` maps scenarios onto the pricer; because each call releases the GIL, they run truly in parallel. Simple orchestration, shared process memory.

**Python multiprocessing** — when the *Python* side is CPU-bound (heavy pandas/NumPy work the GIL would serialise), or you want process isolation. Cost: no shared memory (data is pickled/copied between processes) and IPC overhead — bad for passing million-path arrays around.

Guidance: put parallelism **as deep as practical**. If one computation is huge, parallelise it *inside* C++ (option 1). If you have many independent C++ calls, thread them from Python over a GIL-releasing core (option 2). Reach for multiprocessing only when the bottleneck is genuinely Python-side CPU work that can't release the GIL, and accept the copy cost. Avoid the worst case: Python multiprocessing shuffling giant arrays between processes when a single GIL-releasing C++ call with internal threads would have shared one buffer.

### Q16. Your "multithreaded" Python backtest over a C++ pricer runs at single-core speed. Diagnose.

The overwhelmingly likely cause: **the C++ code holds the GIL while it computes**, so Python's threads serialise on it despite being "parallel."

Diagnosis steps:
1. **Confirm the symptom** — CPU usage pinned near one core, wall-clock scaling ~flat with thread count. Classic GIL contention.
2. **Check the binding for a GIL release.** Is there a `py::gil_scoped_release` around the compute? If not, every thread that enters the pricer takes turns holding the GIL — the C++ runs one-at-a-time.
3. **Fix:** wrap the heavy, Python-object-free compute in `py::gil_scoped_release` (Q6). Re-run; you should now see multi-core utilisation.

Secondary suspects if releasing the GIL doesn't fix it:
- **You're using `threading` but the bottleneck is in Python code** (data prep in pandas), which the GIL serialises regardless of the C++ — move that work into C++/NumPy or use multiprocessing.
- **The calls are too fine-grained** — you're crossing the boundary a million times (Q8), so overhead, not the GIL, dominates. Batch them.
- **False contention on a shared resource** — a shared RNG or a lock inside the C++ serialises the threads (Concurrency topic: use per-thread RNG).
- **Memory bandwidth saturation** — the kernel is memory-bound, so more threads don't help. Profile to confirm.

The first thing to check, though, is always the missing `gil_scoped_release` — it's the single most common reason a C++/Python quant stack fails to scale, and it's a one-line fix.

## Building, Testing & Profiling

### Summary

**What this topic covers**

The engineering discipline around a quant C++ codebase: how you **build** it (CMake — targets, `find_package`, `FetchContent`), which **compiler flags** you use and which you must *not* (`-O2/-O3 -march=native` yes; `-ffast-math` almost never, for a reason that's pure finance); how you catch bugs the compiler won't with **sanitizers** (ASan for memory, UBSan for undefined behaviour and signed overflow, TSan for data races); how you **benchmark** correctly with Google Benchmark (and why dead-code elimination silently makes microbenchmarks lie); how you **test numerical code** where exact equality is the wrong tool (tolerances, golden/reference values, property tests like put-call parity, edge cases); and how you **profile** to find the real bottleneck (perf, VTune, cachegrind, flamegraphs). The unifying theme: numeric finance code has failure modes ordinary software tooling misses — a race that only corrupts a few paths, a `-ffast-math` reordering that changes a P&L, a benchmark that "proves" your optimised loop is infinitely fast because the compiler deleted it. The 16 questions cover the toolchain a quant dev is expected to drive fluently.

**Mental model**

Think of four gates every change passes through: **build, sanitize, test, profile** — and each gate catches a class of failure the others can't. The **build** gate (CMake + flags) decides both *whether* it compiles portably and *how fast/correct* the output is — and one flag (`-ffast-math`) can silently trade correctness for speed in a way that's fine for a game and lethal for a risk engine. The **sanitize** gate runs instrumented builds that catch what compiles-and-runs but is undefined: use-after-free, signed overflow, data races — bugs that in an optimised release build manifest as "wrong number on Tuesdays." The **test** gate is different from ordinary software testing because floating point means `==` is the wrong assertion; you test to *tolerances*, against *golden values*, and with *properties* that must hold regardless of inputs (put-call parity, non-negative prices). The **profile** gate enforces "measure, don't guess" — you find the hotspot with a profiler, not intuition, because in numeric code the bottleneck is usually memory/cache, not the FLOPs you'd expect. Run all four; skipping any leaves a category of bug live.

**Key terms**

- **CMake** — the de-facto C++ build-system generator; you declare *targets* and their dependencies, it generates the actual build.
- **target** — a library or executable plus its properties (sources, include dirs, compile options, linked deps).
- **`find_package`** — locate an already-installed dependency (Eigen, Boost, TBB).
- **`FetchContent`** — download and build a dependency as part of your build (pin Google Test / Benchmark by tag).
- **`-O2` / `-O3`** — optimization levels; `-O3` adds aggressive vectorization/inlining.
- **`-march=native`** — target this machine's exact ISA (AVX2/AVX-512); enables SIMD codegen but the binary won't run on older CPUs.
- **`-ffast-math`** — relax IEEE compliance (assume no NaN/inf, allow reassociation); faster, *unsafe for finance*.
- **ASan / UBSan / TSan** — AddressSanitizer (memory errors), UndefinedBehaviorSanitizer (UB incl. signed overflow), ThreadSanitizer (data races).
- **Google Benchmark** — microbenchmark library; `benchmark::DoNotOptimize` prevents the compiler from deleting the code under test.
- **dead-code elimination** — the optimizer removing code whose result is unused; wrecks naive benchmarks.
- **golden / reference value** — a known-correct expected output (from a closed form or a trusted library) to test numeric code against.
- **property test** — asserting an invariant that must hold for all inputs (put-call parity, monotonicity) rather than one hard-coded output.
- **flamegraph** — a stacked visualisation of sampled call stacks showing where time is spent.

**Why interviewers ask this**

Because writing a correct pricer once is easy; keeping a large numeric codebase correct and fast across a team, a build farm, and years of change is the actual engineering job — and this topic is how you do it. A junior "tested it and it printed the right number"; a senior tests to tolerances against golden values, adds a put-call-parity property test, runs UBSan in CI, and *knows why `-ffast-math` is banned on the risk engine*. The `-ffast-math` question in particular is a superb filter: it sounds like a free speedup, and the candidate who can explain that it assumes-away NaN and breaks IEEE associativity — silently changing a P&L and defeating your NaN guards — has thought about numeric correctness at the level a desk needs. Likewise the benchmark-DCE trap and the "the bottleneck is memory, not FLOPs" instinct separate people who *measure* from people who *guess*.

**Common confusions**

- "`-ffast-math` is a free speedup" — it's a *correctness* change: no NaN/inf, reassociation allowed, FTZ on. It can alter results and disable your NaN checks. Dangerous in finance.
- "`-O3` is always faster than `-O2`" — not reliably; `-O3` can bloat code and hurt I-cache. Measure; `-O2` is often the sane default.
- "`-march=native` is safe to ship" — the binary may crash with illegal-instruction on any older CPU than the build machine. Fine for a pinned server, risky for distribution.
- "My benchmark shows this is 1000x faster" — probably dead-code elimination deleted the unused result. Use `DoNotOptimize`.
- "The test passes because `price == expected`" — floating point almost never compares exactly equal; you need a tolerance.
- "Sanitizers are for debug only, skip them in CI" — the opposite; TSan/UBSan in CI catch races and overflow that only surface in production under load.

**What follows from this topic**

This is where the whole primer's correctness and performance claims get *enforced*. `-ffast-math`'s danger is the operational consequence of the **Error Handling** topic's NaN/associativity discussion. TSan is how you actually verify the **Concurrency** topic's "per-thread RNG, careful reductions" are race-free. Google Benchmark plus profiling is how you *validate* the low-latency, CRTP, and memory-layout optimisations rather than cargo-culting them — the "measure, don't guess" that every performance topic ends on. Property tests like put-call parity tie straight back to the Quantitative Methods primer (the maths you're asserting). And the build/test/profile loop is what makes the C++/Python boundary shippable — CI builds the extension, tests it to tolerances, and profiles the kernel before it goes near a Python researcher.

### Q1. Write a minimal CMake setup for a pricing library with an Eigen dependency and tests.

Modern CMake is *target-centric*: you declare targets, attach properties to them, and let usage requirements propagate.

```cmake
cmake_minimum_required(VERSION 3.20)
project(pricing LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# --- the library target ---
add_library(pricing src/black_scholes.cpp src/monte_carlo.cpp)
target_include_directories(pricing PUBLIC include)

# --- an installed dependency: Eigen (header-only) ---
find_package(Eigen3 3.4 REQUIRED)
target_link_libraries(pricing PUBLIC Eigen3::Eigen)

# --- a fetched dependency: GoogleTest, pinned by tag ---
include(FetchContent)
FetchContent_Declare(googletest
    GIT_REPOSITORY https://github.com/google/googletest.git
    GIT_TAG v1.14.0)                       # pin, never track a moving branch
FetchContent_MakeAvailable(googletest)

# --- the test target ---
enable_testing()
add_executable(pricing_tests tests/test_bs.cpp)
target_link_libraries(pricing_tests PRIVATE pricing GTest::gtest_main)
include(GoogleTest)
gtest_discover_tests(pricing_tests)
```

Key ideas: `target_link_libraries(... PUBLIC ...)` propagates Eigen's include dirs to anything linking `pricing` (usage requirements — no manual include paths). `find_package` uses a dependency already on the system; `FetchContent` builds one from source pinned to a tag (reproducible). `PUBLIC`/`PRIVATE` control whether a dependency leaks to consumers. Build with `cmake -B build && cmake --build build && ctest --test-dir build`.

### Q2. `find_package` vs `FetchContent` — when each?

Both bring in a dependency; they differ in *where the dependency comes from* and who controls its version.

| | `find_package` | `FetchContent` |
|---|---|---|
| Source | Already installed on the system | Downloaded + built as part of your build |
| Version control | Whatever is installed | Pinned by git tag in your CMake |
| Build time | Fast (prebuilt) | Slower first build (compiles the dep) |
| Reproducibility | Depends on the machine | Self-contained, deterministic |
| Best for | Heavy/system libs (Boost, MKL, TBB) | Small/test libs, exact pinning (GTest, Benchmark, fmt) |

Use **`find_package`** for large or system-provided libraries you don't want to rebuild — Intel MKL, Boost, a system Eigen — and where the platform (or a package manager like vcpkg/Conan) provides them. Use **`FetchContent`** when you want the build to be *self-contained and version-pinned* regardless of the machine — ideal for test/bench frameworks and small header-only deps, so CI and every developer get byte-identical versions. Many projects combine them: `find_package` for the heavy numerics, `FetchContent` for tooling. A common robust pattern is `FetchContent`'s `FIND_PACKAGE_ARGS` to *try* an installed copy first and fall back to fetching.

### Q3. Explain `-O2` vs `-O3` vs `-march=native`. What do you ship for a pricing server?

`-O2` — the standard "optimise well without going overboard" level: inlining, common-subexpression elimination, most loop optimisations. Reliable, rarely surprises.

`-O3` — everything in `-O2` plus more aggressive vectorization, loop unrolling, and inlining. *Sometimes* faster, but the extra code size can pressure the instruction cache and it occasionally *loses* to `-O2`. You must **measure** rather than assume.

`-march=native` — generate code for *this exact CPU's* instruction set (AVX2, AVX-512, FMA). This is what actually unlocks SIMD codegen for your numeric loops — big wins for Monte Carlo and linear algebra. The catch: the binary uses instructions the build machine has, so it will **crash with SIGILL on any older CPU**. Fine when you control and pin the deployment hardware; dangerous for a binary distributed to heterogeneous machines.

What to ship for a **pricing server** you control: typically **`-O2 -march=<the server's arch>` (or `-march=native` if build and run hardware are identical), with LTO**, plus PGO if the workload is stable. Pin the arch to the deployment CPU family (e.g. `-march=skylake-avx512`) rather than `native` if the build host differs from prod. Try `-O3` and keep it only if the benchmark says it's faster on *your* workload. And crucially: **not `-ffast-math`** (next question). For a distributed binary, target a conservative baseline (e.g. `-march=x86-64-v2`) or ship multiple dispatched variants.

### Q4. Why is `-ffast-math` dangerous in finance? Be specific.

Because it's not a performance flag with no downside — it's a **semantics change** that silently trades IEEE correctness for speed, and both things it breaks matter acutely in finance.

Specifically, `-ffast-math` (a bundle of sub-flags) tells the compiler it may assume:
1. **No NaN or inf ever occur** (`-ffinite-math-only`). The optimizer then *removes your NaN/inf checks* as provably-dead code — `std::isnan(x)` can fold to `false`. So all your careful boundary guards (Error Handling topic) evaporate, and a genuine NaN sails through undetected into a P&L.
2. **Floating-point addition/multiplication is associative** (`-fassociative-math`). It reorders `(a+b)+c` into `a+(b+c)` and contracts operations freely. Since FP arithmetic is *not* associative, this **changes numerical results** — a valuation can differ run-to-run or build-to-build, breaking reproducibility and any golden-value test.
3. **Flush-to-zero and reciprocal approximations** — denormals become zero and divisions may use lower-precision estimates.

The consequence for a risk engine: numbers that are *subtly wrong*, non-reproducible, and un-guardable, all to save some cycles. That's a catastrophic trade when the output is money. If you want *parts* of the speedup safely, enable the specific innocuous sub-flags deliberately (e.g. FTZ via MXCSR, or `-ffp-contract=fast` for FMA) rather than the blanket `-ffast-math`. The rule desks follow: **`-ffast-math` off on anything that computes a price or a risk number.** It's a legitimate flag for a game engine; it's banned on the pricing library.

### Q5. What is AddressSanitizer and what class of bugs does it catch?

**ASan** is a compiler-instrumented tool (`-fsanitize=address`) that detects **memory errors at runtime** by shadowing memory and poisoning red zones around allocations. It catches:
- **Heap use-after-free** — reading/writing freed memory (a dangling pointer to a released path buffer).
- **Heap/stack buffer overflow** — indexing past the end of a `vector`/array (off-by-one in a PDE grid sweep).
- **Use-after-return / use-after-scope** — using a pointer to a local that's gone (returning a `span` into a destroyed temporary).
- **Memory leaks** (with LeakSanitizer, bundled).
- **Double-free** and invalid-free.

```
cmake -DCMAKE_CXX_FLAGS="-fsanitize=address -g -O1" ..
```

It costs ~2x slowdown and ~2-3x memory, so you run it on **tests and CI**, not production. The payoff in numeric finance is large: a stack-buffer overflow in a hot loop might, in an optimised release build, silently corrupt an adjacent array and produce a *plausible but wrong* Greek only under specific inputs — the kind of bug that's near-impossible to find by inspection. ASan turns it into an immediate, precise, stack-traced abort at the offending access. Pair it with the lifetime bugs the **memory/move** topics warn about (dangling `span`/`string_view`, returning references to locals) — ASan is how you catch those in test.

### Q6. UBSan and TSan — what do they catch that ASan doesn't?

Three sanitizers, three (mostly) disjoint bug classes; you run them in separate builds because some are mutually exclusive.

**UBSan** (`-fsanitize=undefined`) — **undefined behaviour** that isn't a memory-access error: **signed integer overflow** (a real finance bug — cents overflowing a 32-bit int on a large notional), invalid enum values, null-pointer dereference, misaligned access, shifts past the width, `float`->`int` conversions that overflow, invalid `bool`. Cheap enough to sometimes leave on in production. In finance the standout is signed overflow: money-as-integer arithmetic (Error Handling topic) silently wraps on overflow in an optimised build; UBSan makes it a diagnosed error.

**TSan** (`-fsanitize=thread`) — **data races**: two threads accessing the same memory concurrently with at least one write and no synchronisation. This is *the* tool for the Concurrency topic — it catches a shared RNG mutated by multiple MC threads, an unsynchronised accumulator, a lock you forgot. Races are the worst bugs to find by hand because they're nondeterministic and often invisible in testing; TSan detects them from a *single* run even if the race didn't corrupt anything that time. Costs ~5-15x slowdown and lots of memory.

Why separate builds: **ASan and TSan are incompatible** (both hijack memory instrumentation) — you can't combine them. Typical CI matrix: one ASan+UBSan build, one TSan build, both running the test suite. That combination covers memory errors, undefined behaviour, and races — the three categories the plain compiler and your tests will happily miss.

### Q7. Write a Google Benchmark for a pricer and explain the dead-code-elimination trap.

The trap: if the benchmark computes a result nobody uses, the optimizer **deletes the computation** (dead-code elimination), and your benchmark reports an impossibly fast (or zero) time — "proving" your code is infinitely fast. `benchmark::DoNotOptimize` forces the compiler to treat a value as observably used.

```cpp
#include <benchmark/benchmark.h>

static void BM_BlackScholes(benchmark::State& state) {
    double S = 100, K = 105, r = 0.02, sigma = 0.2, T = 1.0;
    for (auto _ : state) {
        double price = black_scholes_call(S, K, r, sigma, T);
        benchmark::DoNotOptimize(price);      // result is "used" -> not deleted
    }
}
BENCHMARK(BM_BlackScholes);

static void BM_MonteCarlo(benchmark::State& state) {
    std::size_t n = state.range(0);           // parametrised over path count
    MonteCarloPricer p(100, 0.02, 0.2, n);
    for (auto _ : state) {
        double price = p.price(105, 1.0);
        benchmark::DoNotOptimize(price);
        benchmark::ClobberMemory();           // ensure writes to memory happen
    }
}
BENCHMARK(BM_MonteCarlo)->Range(1<<10, 1<<20);   // 1k..1M paths
BENCHMARK_MAIN();
```

`DoNotOptimize(x)` tells the compiler the value must exist in a register/memory (it can't fold the computation away); `ClobberMemory()` is a full memory-barrier forcing pending writes to be observable (needed when the "result" is written into a buffer rather than returned). Other pitfalls Google Benchmark handles: it runs enough iterations for statistical stability, reports variance, and lets you set inputs *outside* the timed loop. Without `DoNotOptimize`, `BM_BlackScholes` above would very likely report ~0ns because the whole call folds away — the single most common microbenchmarking mistake.

### Q8. How do you test numerical code where exact equality fails?

You replace "equals" with three complementary tactics: **tolerances, golden values, and properties.**

**1. Tolerances, not `==`.** Assert closeness within a combined absolute+relative bound (Error Handling topic's `nearlyEqual`), sized to the expected accuracy — ~1e-10 for a closed form, ~standard-error for Monte Carlo.

```cpp
EXPECT_NEAR(bs_call(100,100,0.02,0.2,1.0), 8.9160, 1e-4);   // gtest tolerance assert
```

**2. Golden / reference values.** Compare against a known-correct answer: an analytic Black-Scholes price, a value from a trusted library (QuantLib), or a high-precision reference computation. Store these as regression fixtures so a refactor that changes a price fails loudly.

**3. Property tests.** Assert invariants that must hold for *all* inputs, not one hard-coded output — these catch bugs a single golden value misses (next question): put-call parity, non-negative option prices, monotonicity in spot, convergence of MC to the analytic price as N grows.

Plus **edge cases**: `T -> 0` (price -> intrinsic), `sigma -> 0`, deep in/out-of-the-money, and invalid inputs that should throw. And for MC specifically, test the *statistical* claim: the analytic price should lie within a few standard errors of the MC estimate — a probabilistic assertion, run with a fixed seed for determinism. The mindset shift: numeric tests verify "close enough and structurally correct," never "bit-identical."

### Q9. What's a property-based test in finance? Give a concrete one.

A **property test** asserts an invariant that must hold across a *range of randomised inputs*, rather than checking one input against one hard-coded output. It's powerful for pricing because the maths *guarantees* relationships that any correct implementation must satisfy — and violations expose bugs a single golden value would never reveal.

The canonical example is **put-call parity**: for European options, `C - P == S - K*exp(-r*T)`, for *every* valid `(S, K, r, sigma, T)`.

```cpp
TEST(Parity, PutCallHoldsEverywhere) {
    std::mt19937 rng(42);
    std::uniform_real_distribution<> S(50,150), K(50,150),
                                     r(-0.01,0.05), vol(0.05,0.6), T(0.1,3.0);
    for (int i = 0; i < 10000; ++i) {
        double s=S(rng), k=K(rng), rr=r(rng), v=vol(rng), t=T(rng);
        double lhs = bs_call(s,k,rr,v,t) - bs_put(s,k,rr,v,t);
        double rhs = s - k * std::exp(-rr * t);
        EXPECT_NEAR(lhs, rhs, 1e-9) << "parity broke at S=" << s << " K=" << k;
    }
}
```

Other quant properties worth asserting:
- **Non-negativity** — an option price is always >= 0 and >= discounted intrinsic.
- **Monotonicity** — a call price is non-decreasing in spot, non-increasing in strike.
- **Convergence** — the MC estimate approaches the analytic price as N grows, and its error shrinks like ~1/sqrt(N).
- **Symmetry / no-arbitrage bounds** — prices sit within their static arbitrage bounds.

If put-call parity fails on random inputs, one of your two pricers is wrong — even if both matched their individual golden values (a shared constant error in `N(x)` could pass golden tests but break parity). Properties test the *relationships*, which is where subtle bugs hide.

### Q10. How do you test a Monte Carlo pricer, which is inherently random?

You test the *statistics*, deterministically, and against what the theory guarantees.

1. **Fix the seed.** Make the RNG deterministic so the test is reproducible run-to-run; a random-seeded test that "usually passes" is a flaky test.
2. **Assert convergence to the analytic price within standard errors.** MC has a known error ~standard_error = stdev/sqrt(N). The estimate should fall within, say, 3 standard errors of the closed-form Black-Scholes value — a probabilistic bound with a controllable false-failure rate:

```cpp
TEST(MC, ConvergesToAnalytic) {
    MonteCarloPricer p(100, 0.02, 0.2, 1'000'000);  // fixed seed inside
    double mc = p.price(105, 1.0), se = p.standard_error();
    double analytic = bs_call(100, 105, 0.02, 0.2, 1.0);
    EXPECT_LT(std::fabs(mc - analytic), 3.0 * se);   // within 3 SE
}
```

3. **Check the error *rate*.** Quadrupling N should roughly *halve* the standard error (1/sqrt(N) law). A test that runs N and 4N and checks the SE ratio validates the estimator itself.
4. **Test variance reduction actually reduces variance** — antithetic/control-variate variants should report a *smaller* standard error than plain MC at the same N.
5. **Edge cases** — `sigma=0` should give the deterministic discounted intrinsic exactly (no randomness); `T=0` the intrinsic.

The mindset: you're not asserting the MC price *equals* the analytic (it never will exactly), you're asserting it's *statistically consistent* with it. Choosing 3 SE gives ~0.3% false-failure probability — tighten or loosen per your CI flakiness tolerance. And always fix the seed so a failure is a real bug, not variance.

### Q11. You profiled and the pricer is slow. Walk through finding the bottleneck.

**Measure first, don't guess** — the bottleneck in numeric code is usually *not* where intuition says (rarely the FLOPs; usually memory/cache or an unexpected allocation).

1. **Get a wall-clock baseline** and a representative workload (real path counts, real instrument mix). Optimising an unrepresentative case wastes effort.
2. **Sample with a profiler** to find *where* time goes. On Linux, `perf`:
```
perf record -g ./pricer_bench && perf report
```
This gives a call-stack breakdown. Render it as a **flamegraph** (wide bars = hot; `perf script | flamegraph.pl`) to see the hotspot at a glance.
3. **Read the hotspot correctly.** If most time is in one function, drill in. Common culprits in a pricer: `std::normal_distribution` / RNG, `exp`/`log` transcendentals, a `shared_ptr` refcount on the hot path, or hidden allocation inside a loop.
4. **Check whether it's compute- or memory-bound.** Use `perf stat` for cache-miss and IPC counters, or **cachegrind** (`valgrind --tool=cachegrind`) for a precise cache-miss profile. High miss rate + low IPC = memory-bound -> fix data layout (SoA, `reserve`, contiguous buffers), not arithmetic. High IPC, few misses = compute-bound -> vectorize, reduce transcendental calls, better algorithm.
5. **On Intel, VTune** gives a richer microarchitectural view (front-end vs back-end bound, port saturation) when you need to know *why* a loop doesn't vectorize.
6. **Fix the top item, re-measure, repeat.** Verify each change with a Google Benchmark (Q7) so you're not fooled by noise or DCE.

The discipline is the point: **profile -> hypothesis -> fix -> re-profile.** In practice the answer is often "we're allocating in the loop" or "the layout thrashes the cache," which is why the memory/data-oriented topics matter more than shaving FLOPs.

### Q12. `perf` vs VTune vs cachegrind — which tool for what?

They sample or simulate at different levels; pick by the question you're asking.

| Tool | Mechanism | Best question | Notes |
|---|---|---|---|
| **perf** | Hardware-counter sampling (Linux) | "Where does wall-clock time go?" | Low overhead, real hardware, great with flamegraphs; the default first look |
| **VTune** | HW sampling + microarch analysis (Intel) | "*Why* is this loop slow — front-end? memory-bound? bad vectorization?" | Deep Intel-specific insight (top-down analysis, port utilisation); heavier UI |
| **cachegrind** | Cache *simulation* (Valgrind) | "Exactly how many cache misses, deterministically?" | ~50x slowdown, but reproducible and precise; simulates rather than measures real HW |

Guidance:
- Start with **`perf`** — cheap, samples the real execution, and a flamegraph usually points straight at the hotspot. It's the everyday tool.
- Escalate to **VTune** when `perf` tells you *where* but you need *why*: is the hot loop back-end (memory) bound, front-end (instruction fetch/decode) bound, or failing to vectorize? Its top-down methodology and roofline view answer "what's the microarchitectural ceiling."
- Use **cachegrind** when you need a **deterministic, exact** cache-miss count — comparing two data layouts (AoS vs SoA) precisely, or in a CI regression check — and can tolerate the huge slowdown. Because it *simulates*, results are noise-free and reproducible, unlike sampling.

For memory-layout work specifically, cachegrind's precision is ideal for A/B-ing layouts; for finding *the* hotspot fast, perf+flamegraph; for squeezing a known-hot kernel to the metal, VTune. Real workflow uses all three at different stages.

### Q13. What is a flamegraph and how do you read one?

A **flamegraph** is a visualisation of sampled call stacks that shows *where a program spends its time*. You collect stack samples (e.g. `perf record -g`), then each unique stack becomes a vertical column of stacked boxes and identical frames are merged into wider boxes.

How to read it:
- **X-axis = proportion of samples (time), NOT time order.** Width of a box = fraction of total time spent in that function (including its callees). Wider = hotter. The left-to-right order is just alphabetical merging, not chronological — a common misreading.
- **Y-axis = stack depth.** The bottom is `main`/entry; each box above is a function *called by* the one below. Height is call depth, not cost.
- **Top edges are where the CPU actually is.** A frame's *own* (self) time is the part of its width not covered by children on top of it. A wide box with a flat top = a leaf doing real work; a wide box fully covered by children = time is in the callees, not here.

Reading strategy: scan the **widest boxes**, then look at their **top edges** to find the actual hot leaves. In a pricer you'd typically see a wide `mc_price` at the bottom, and near the top a wide `normal_distribution::operator()` or `std::exp` — telling you the RNG/transcendentals dominate. **Differential flamegraphs** (before vs after) show whether an optimisation moved the needle. The value is instant visual triage: instead of scrolling a `perf report` table, you *see* the hotspot's shape and depth in one image.

### Q14. Design a CI pipeline for a numeric C++ library. What stages?

Structure it as gates that each catch a distinct failure class, cheap-to-expensive:

1. **Build matrix** — compile with multiple compilers (GCC, Clang) and standards (C++17/20), warnings-as-errors (`-Wall -Wextra -Werror`). Catches portability and warning regressions early.
2. **Unit + property tests** (release-ish build) — the full test suite: tolerance-based golden-value tests and property tests (put-call parity, non-negativity, MC convergence with fixed seeds). Fast; runs on every push.
3. **Sanitizer builds** — one **ASan+UBSan** job and one **TSan** job (they're incompatible, so separate) running the same test suite. Catches memory errors, signed overflow, and data races that release builds and plain tests miss. Slower, but essential for a threaded numeric library.
4. **Benchmark / performance regression** — run Google Benchmark on key kernels and compare against a stored baseline; fail (or warn) if a hotspot regresses beyond a threshold. Guards the performance you worked for.
5. **Reproducibility check** (finance-specific) — assert prices are bit-stable across runs with fixed seeds and pinned flags, catching an accidental `-ffast-math` or nondeterministic reduction sneaking in.
6. **Static analysis / lint** — clang-tidy, include-what-you-use, and a check that `-ffast-math` is *not* in the pricing library's flags.

Ordering: fast gates (build, unit tests) first for quick feedback; expensive gates (TSan ~10x, sanitizers, benchmarks) after, possibly nightly rather than per-commit if they're too slow. The finance-specific additions — the reproducibility check and the `-ffast-math` guard — are what distinguish a *numeric* library's CI from generic C++ CI, and they directly enforce the correctness rules from the Error Handling topic.

### Q15. Your optimised loop benchmarks 100x faster than baseline. Should you believe it?

Almost certainly not — a 100x jump from a micro-optimisation is a red flag for a **measurement artifact**, usually dead-code elimination. Investigate before celebrating.

Prime suspects:
1. **Dead-code elimination.** If the loop's result is unused, the optimizer deleted the entire computation and you timed nothing. Fix: `benchmark::DoNotOptimize(result)` and `ClobberMemory()` (Q7). This is the #1 cause of "impossibly fast" benchmarks.
2. **Constant folding / hoisting.** If the inputs are compile-time constants or loop-invariant, the compiler computed the answer once (or at compile time) and the "loop" just returns a cached value. Fix: make inputs come from `state.range()` or a runtime source the compiler can't see through.
3. **The two versions don't do the same work.** The "optimised" version might skip an allocation, use a smaller N, or have different inputs. Verify both produce the *same output* on the same data.
4. **Warm vs cold cache / different data sizes.** One version fits in cache, the other doesn't. Ensure identical, representative inputs.
5. **Timing noise / too few iterations.** Google Benchmark mitigates this, but check the reported variance.

Verification: **compare the outputs** of both versions (they must match to tolerance), inspect the **generated assembly** (`-S` or Compiler Explorer) to confirm the loop body actually exists, and re-run with `DoNotOptimize`. A *believable* micro-optimisation gives 1.2x-3x; a genuine algorithmic change (O(n^2) -> O(n log n)) can give 100x, but a mere loop rewrite giving 100x means the compiler outsmarted your benchmark. Trust it only after you've seen the assembly and matched the outputs.

### Q16. `-O3 -march=native` made the release build produce different numbers than the debug build. Why, and is it a bug?

This is usually **not a bug** but *expected* floating-point non-determinism from optimisation — though you must confirm it's within tolerance, not a real error.

Why the numbers differ:
1. **FMA contraction.** With `-O3 -march=native`, the compiler fuses `a*b+c` into a single fused-multiply-add (one rounding) where the debug build did two separate rounded operations. Different rounding -> different last bits. `-march=native` enables FMA hardware, so release uses it and debug may not.
2. **Reassociation and vectorization.** Auto-vectorization sums a reduction in a *different order* (lane-wise partial sums combined at the end) than the scalar debug loop. Since FP addition isn't associative, the totals differ slightly.
3. **Different `exp`/`log` code paths.** `-march=native` may select SIMD or approximate transcendental implementations differing from the scalar debug ones — and transcendentals aren't correctly-rounded/portable anyway.
4. **x87 excess precision** (legacy, if 80-bit intermediates are involved).

Is it a bug? **Judge by magnitude.** If the difference is a few ULPs / within your pricing tolerance (~1e-10 relative), it's benign optimisation-induced rounding variation — accept it, and make your *tests* tolerance-based (Q8) rather than exact so they pass on both builds. If the difference is *large* (basis points on a price, a sign flip, a NaN in one build only), that signals a real problem — often an uninitialised variable, UB the optimizer exploited (run UBSan), or an accidental `-ffast-math`. So: reproduce, measure the delta, and if it's within numerical tolerance it's the normal price of optimisation; if it's not, treat it as a UB/`-ffast-math` bug and hunt it with sanitizers. For code needing bit-reproducibility, pin `-ffp-contract=off` and disable fast-math (Error Handling topic, Q on reproducibility).
## Design Patterns for Financial Libraries

### Summary

**What this topic covers**

How a real quant pricing library is *architected* — not the maths inside a model, but the object model that lets one codebase price thousands of instruments against live market data without turning into a ball of mud. This is the design layer QuantLib made canonical and every bank's internal analytics library re-invented: the **Instrument / PricingEngine / Payoff** split (Strategy), the **Handle / Observable / Observer** reactive market-data graph with **lazy recalculation**, **term structures** (yield curves, vol surfaces) as first-class objects, curve **bootstrapping**, and the deceptively deep **Date / Calendar / DayCounter / business-day-convention** stack that is the single most bug-prone corner of any financial system. The 16 questions here move from "why decouple instrument from engine" through "how does a Handle notify its dependents" to "design a term-structure hierarchy" and "why is day-counting so hard." When you finish, you should be able to sketch the class diagram of a pricing library on a whiteboard and defend every arrow.

**Mental model**

Picture the library as three planes. The **instrument plane** describes *what* a trade is — a European option is a payoff plus an exercise plus an underlying; it knows nothing about how to be valued. The **engine plane** describes *how* to value it — analytic Black-Scholes, a binomial tree, Monte Carlo — each a `PricingEngine` you plug in via Strategy, so the same option re-prices under a different method by swapping one object. The **market-data plane** holds Quotes, curves and surfaces behind **Handles**; when a quote ticks it fires an Observer notification that marks every dependent (curves, engines, instruments) dirty. Nothing recomputes eagerly: a dirty instrument recomputes its NPV only when you next ask for it — **lazy recalculation**. This graph — quotes at the leaves, term structures in the middle, instruments at the top, all wired by observer edges — is the beating heart of the design. Get it and the rest of the library reads as consequences.

**Key terms**

- **Instrument** — a tradeable (option, bond, swap); holds economic terms, delegates valuation to an engine.
- **PricingEngine** — a Strategy that knows one valuation method; produces NPV + results for an instrument.
- **Payoff** — a small callable object encoding the terminal cashflow, e.g. `max(S-K,0)`; composable and reusable across engines.
- **Quote** — a single observable market number (a spot, a rate, a vol); the leaf of the market-data graph.
- **Handle** — a smart-pointer-to-a-pointer wrapping a Quote/term structure so the *link* can be repointed and all holders see the change and get notified.
- **Observable / Observer** — the notification protocol: observables hold a list of observers and `notifyObservers()` on change; observers `update()` by marking dirty.
- **Term structure** — a curve object mapping time to a value: yield curve (discount factors), vol surface, default-probability curve.
- **DayCounter** — computes year-fractions between two dates under a convention (Actual/360, 30/360, Actual/Actual).
- **Business-day convention** — how to roll a date that lands on a holiday (Following, Modified Following, Preceding).
- **Bootstrapping** — solving iteratively for the curve nodes that reprice a set of market instruments (deposits, futures, swaps) exactly.
- **Lazy recalculation** — cache the result; invalidate on notification; recompute only on the next `NPV()` request.

**Why interviewers ask this**

Design questions separate someone who has *used* a pricing library from someone who has *built* one. A junior describes classes; a senior explains *why the seams are where they are* — why the payoff is a separate object (so a tree engine and an MC engine share it), why market data hides behind Handles (so you can rebuild a curve at 4pm without touching a million live instruments), why recalculation is lazy (so ticking one quote doesn't trigger a portfolio-wide revaluation storm). Interviewers also probe the Observer graph for correctness traps: forgetting to unregister an observer (a lifetime bug and a memory leak), or a notification storm where one tick fans out to N recomputations. And nearly everyone gets grilled on dates, because everyone has been burned by a day-count or holiday bug that mispriced a book.

**Common confusions**

- "The instrument computes its own price" — no; it delegates to a swappable engine. Coupling valuation into the instrument is the anti-pattern this whole design exists to avoid.
- "A Handle is just a `shared_ptr`" — it's a pointer-to-a-link: repointing the link updates every holder *and* notifies them. A bare `shared_ptr` gives sharing but no notification and no relinking.
- "Lazy just means slow the first time" — laziness is about *correctness of caching under change*: recompute exactly when an input changed, never otherwise.
- "Day-count is trivial arithmetic" — Actual/Actual, 30/360, end-of-month rules and holiday calendars make it a minefield; a wrong convention silently mis-discounts every cashflow.
- "Observer is over-engineering" — without it you either recompute everything on every tick or forget to recompute something and show a stale price. Both are worse.

**What follows from this topic**

This is the scaffolding the rest of the primer hangs on. The PricingEngine abstraction is exactly where a Monte Carlo engine (see the MC-engine material in Quantitative Methods and the scenario topic below) plugs in. The Observer/lazy machinery is what makes **calibration** and **risk** tractable — bump a quote, let the graph invalidate, reprice. The day-count and curve pieces feed directly into **Real-World Quant C++**, where QuantLib's concrete implementations and curve bootstrapping get their deep dive. Cross-reference the Concurrency primer for the sharp edge here: the Observer graph is inherently mutable shared state, so a live pricing graph is *not* thread-safe without care.

### Q1. Why decouple an Instrument from its PricingEngine? Sketch the design.

Because the *same* trade can be valued *many* ways, and the *same* method values *many* trades. A European option can be priced analytically (Black-Scholes), on a tree, or by Monte Carlo; a Monte Carlo engine can price options, baskets, autocallables. If the instrument computed its own price you'd get a combinatorial explosion and copy-pasted valuation code. The fix is **Strategy**: the instrument holds economic terms and delegates to a pluggable `PricingEngine`.

```cpp
struct Results { double value = 0.0; };            // extend: greeks, error, etc.

class PricingEngine {
public:
    virtual ~PricingEngine() = default;
    virtual void calculate(const struct Arguments& args, Results& out) const = 0;
};

class Instrument {
public:
    void setEngine(std::shared_ptr<PricingEngine> e) { engine_ = std::move(e); }
    double NPV() const {
        Results r;
        engine_->calculate(arguments(), r);        // delegate to the strategy
        return r.value;
    }
    virtual Arguments arguments() const = 0;       // instrument fills its own args
protected:
    std::shared_ptr<PricingEngine> engine_;
};
```

Now `option.setEngine(analyticEngine)` vs `option.setEngine(mcEngine)` swaps the method with one line, and every engine is testable in isolation against a known instrument. This is the single most important structural decision in the library.

### Q2. Implement the Payoff as a first-class object. Why not just hardcode max(S-K,0)?

Because the payoff is the one piece *shared* across every engine and reused by variance-reduction and bumping. Make it a small polymorphic (or templated) callable so a tree, a PDE grid and an MC path all evaluate the *same* terminal function.

```cpp
struct Payoff {
    virtual ~Payoff() = default;
    virtual double operator()(double S) const = 0;
};

struct PlainVanillaPayoff : Payoff {
    enum Type { Call, Put } type;
    double K;
    PlainVanillaPayoff(Type t, double strike) : type(t), K(strike) {}
    double operator()(double S) const override {
        return type == Call ? std::max(S - K, 0.0) : std::max(K - S, 0.0);
    }
};
```

A tree engine calls `payoff(S)` at each terminal node; an MC engine calls it per path; a PDE engine seeds its grid with it. Hardcoding `max(S-K,0)` inside each engine means a new payoff (digital, asian) forces edits in every engine — the opposite of open/closed. On the hot path you can template the engine on the payoff type instead of using a virtual call, so `operator()` inlines (see the CRTP/templating discussion in the low-latency material).

### Q3. Explain the Handle / Observable / Observer pattern for market data. Why not just pass a double?

Because a spot or a rate isn't a value you copy once — it's a *live link* that a thousand instruments share, that ticks, and that everything downstream must react to. Passing a `double` freezes a snapshot; the moment the market moves your prices are stale and you have no way to know what to recompute.

The pattern has three parts. An **Observable** holds a list of observers and notifies them on change. An **Observer** registers with observables and reacts (typically by marking itself dirty). A **Handle** wraps a pointer to the observable so the *link* is shared: repoint the Handle and every holder sees the new target and gets a notification.

```cpp
class Observer;

class Observable {
public:
    void registerObserver(Observer* o)   { observers_.insert(o); }
    void unregisterObserver(Observer* o) { observers_.erase(o); }
    void notifyObservers();               // calls update() on each
private:
    std::set<Observer*> observers_;
};

class Observer {
public:
    virtual ~Observer() { for (auto* o : observables_) o->unregisterObserver(this); }
    virtual void update() = 0;
    void observe(Observable* s) { observables_.insert(s); s->registerObserver(this); }
private:
    std::set<Observable*> observables_;
};
```

A `Quote` is an Observable; when `setValue()` is called it fires `notifyObservers()`. A yield curve observes its quotes; an engine observes the curve; the instrument observes the engine. One tick propagates through the graph, marking everything above dirty — but nothing recomputes yet (Q6).

### Q4. What is a Handle and why is it a pointer-to-a-pointer?

A `Handle<T>` holds a shared *link* object that itself holds a `shared_ptr<T>` — two levels of indirection on purpose. The point is **relinkability with notification**: you can repoint the underlying (swap yesterday's curve for today's freshly-bootstrapped one) and *every* holder of that Handle now sees the new curve *and* is notified to recompute.

```cpp
template <class T>
class Link : public Observable {                 // the shared inner node
    std::shared_ptr<T> h_;
public:
    void linkTo(std::shared_ptr<T> h) { h_ = std::move(h); notifyObservers(); }
    const std::shared_ptr<T>& currentLink() const { return h_; }
};

template <class T>
class Handle {
    std::shared_ptr<Link<T>> link_ = std::make_shared<Link<T>>();
public:
    const std::shared_ptr<T>& operator->() const { return link_->currentLink(); }
    Observable* asObservable() const { return link_.get(); }
    void linkTo(std::shared_ptr<T> h) { link_->linkTo(std::move(h)); }
};
```

A plain `shared_ptr<Curve>` gives you *sharing* but not *relinking*: reassigning your copy doesn't touch anyone else's, and nobody gets notified. The Handle's extra hop is exactly what lets the whole book point at "the discount curve" as an abstraction and have it rebuilt underneath them atomically.

### Q5. Design a term-structure class hierarchy (yield curve, vol surface).

Term structures are *time-parameterised market objects* — you ask them for a value at a time (or time+strike) and they interpolate. Make an abstract base carrying a reference date and a day-counter, then specialise. Each term structure is itself Observable (it observes its inputs and notifies its consumers).

```cpp
class TermStructure : public Observable, public Observer {
public:
    TermStructure(Date ref, DayCounter dc) : referenceDate_(ref), dc_(std::move(dc)) {}
    double timeFromReference(Date d) const { return dc_.yearFraction(referenceDate_, d); }
    void update() override { notifyObservers(); }   // input changed -> tell consumers
protected:
    Date referenceDate_;
    DayCounter dc_;
};

class YieldTermStructure : public TermStructure {
public:
    using TermStructure::TermStructure;
    double discount(Date d) const { return discountImpl(timeFromReference(d)); }
    double zeroRate(Date d) const {                 // continuously compounded
        double t = timeFromReference(d);
        return t > 0 ? -std::log(discountImpl(t)) / t : instantaneousRate();
    }
private:
    virtual double discountImpl(double t) const = 0; // e.g. interpolated on nodes
    virtual double instantaneousRate() const = 0;
};

class BlackVolSurface : public TermStructure {
public:
    using TermStructure::TermStructure;
    double vol(Date d, double strike) const { return volImpl(timeFromReference(d), strike); }
private:
    virtual double volImpl(double t, double strike) const = 0;
};
```

Concrete subclasses (`InterpolatedDiscountCurve`, `FlatForward`, `BlackVarianceSurface`) supply the interpolation. Consumers hold a `Handle<YieldTermStructure>` so the concrete curve can be swapped without recompiling call sites.

### Q6. What is lazy recalculation and why is it essential in a pricing graph?

Lazy recalculation means an object **caches** its result and marks itself **dirty** on notification, recomputing only when the value is next *requested*. It's essential because the market-data graph fans out: one quote feeds one curve feeds hundreds of engines feeds thousands of instruments. If a tick triggered eager recomputation everywhere, a single spot move would revalue the entire book synchronously — a notification storm.

```cpp
class LazyObject : public Observable, public Observer {
    mutable bool calculated_ = false;
public:
    void update() override { calculated_ = false; notifyObservers(); } // just mark dirty
    double result() const {
        if (!calculated_) { performCalculation(); calculated_ = true; }
        return value_;
    }
protected:
    virtual void performCalculation() const = 0;
    mutable double value_ = 0.0;
};
```

The subtlety: `update()` must *propagate* the dirty flag (notify its own observers) but must *not* recompute — otherwise laziness collapses. Then a risk run that bumps one quote and reads back 500 NPVs recomputes exactly those 500, once each, at read time. Combined with the Handle graph this is what makes real-time repricing and bump-based Greeks affordable.

### Q7. Why is Date / Calendar / DayCounter / business-day handling so bug-prone?

Because "how many years between two dates" has a dozen market-specific answers and every one silently changes a discount factor. Consider the moving parts:

- **DayCounter** — Actual/360, Actual/365F, 30/360 (with US vs European end-of-month rules), Actual/Actual (ISDA vs ICMA). The *same* two dates give different year-fractions, so `exp(-r*t)` differs, so the cashflow is discounted differently.
- **Calendar** — which days are holidays (TARGET, US settlement, UK, JPY) — and instruments span *multiple* calendars (a cross-currency swap uses a joint calendar).
- **Business-day convention** — a payment date landing on a holiday rolls: Following (next business day), Modified Following (next, unless it crosses month-end, then previous), Preceding.
- **End-of-month rule** — does a schedule anchored on the 31st stay on month-ends?

```cpp
double df = std::exp(-zeroRate * dc.yearFraction(today, payDate)); // wrong dc -> wrong price
```

None of these throw; they just return a *plausible wrong number*, so bugs survive to production and show up as small pricing discrepancies against a counterparty. This is why libraries invest heavily in a rigorously tested date layer and why interviewers love asking about it — it's where careful engineers are separated from careless ones.

### Q8. Implement a DayCounter interface with Actual/360 and 30/360.

```cpp
struct Date { int y, m, d; };                     // real libs carry a serial number

struct DayCounter {
    struct Impl {
        virtual ~Impl() = default;
        virtual double yearFraction(Date a, Date b) const = 0;
        virtual long   dayCount(Date a, Date b) const = 0;
    };
    std::shared_ptr<Impl> impl_;
    double yearFraction(Date a, Date b) const { return impl_->yearFraction(a, b); }
};

struct Actual360 : DayCounter::Impl {
    long dayCount(Date a, Date b) const override { return serial(b) - serial(a); }
    double yearFraction(Date a, Date b) const override { return dayCount(a, b) / 360.0; }
    static long serial(Date);                     // days since an epoch
};

struct Thirty360 : DayCounter::Impl {             // US/NASD variant
    long dayCount(Date a, Date b) const override {
        int d1 = a.d, d2 = b.d;
        if (d1 == 31) d1 = 30;
        if (d2 == 31 && d1 == 30) d2 = 30;
        return 360L*(b.y - a.y) + 30L*(b.m - a.m) + (d2 - d1);
    }
    double yearFraction(Date a, Date b) const override { return dayCount(a, b) / 360.0; }
};
```

The pimpl/handle idiom lets a schedule carry a `DayCounter` by value while dispatching to the right convention. Note the fiddly 30/360 end-of-day clamping — that's exactly the kind of rule that gets mis-implemented.

### Q9. Implement a business-day roll (Modified Following) over a holiday calendar.

```cpp
struct Calendar {
    virtual ~Calendar() = default;
    virtual bool isBusinessDay(Date) const = 0;   // weekend + holiday check
};

enum class Convention { Following, ModifiedFollowing, Preceding };

Date adjust(Date d, const Calendar& cal, Convention c) {
    auto next = [&](Date x){ do { x = plusDays(x, 1); } while (!cal.isBusinessDay(x)); return x; };
    auto prev = [&](Date x){ do { x = plusDays(x, -1); } while (!cal.isBusinessDay(x)); return x; };

    if (cal.isBusinessDay(d)) return d;
    switch (c) {
        case Convention::Following:  return next(d);
        case Convention::Preceding:  return prev(d);
        case Convention::ModifiedFollowing: {
            Date f = next(d);
            return f.m != d.m ? prev(d) : f;      // don't cross month-end -> roll back
        }
    }
    return d;
}
```

Modified Following is the market default for swaps precisely because "next business day" must not spill a payment into the following accrual month. Getting the month-crossing check wrong shifts a coupon by weeks.

### Q10. How does curve bootstrapping work, and how would you structure it?

Bootstrapping solves for the curve nodes that **reprice a ladder of market instruments exactly** — short-end deposits, mid futures/FRAs, long-end swaps. You process instruments in maturity order; each new instrument adds one unknown node, which you solve so that the instrument prices to par given all shorter nodes already fixed.

```cpp
struct RateHelper {                                // one market instrument
    virtual ~RateHelper() = default;
    virtual Date maturity() const = 0;
    virtual double impliedQuote(const YieldTermStructure&) const = 0; // model value
    virtual double marketQuote() const = 0;
};

// For each helper (sorted by maturity), find the node value making implied == market:
double solveNode(const RateHelper& h, YieldTermStructure& curve) {
    auto objective = [&](double nodeGuess) {
        curve.setLastNode(nodeGuess);              // move the newest pillar
        return h.impliedQuote(curve) - h.marketQuote();
    };
    return brentSolve(objective, /*lo*/-0.05, /*hi*/0.30);  // robust bracketing solver
}
```

Structurally it's an **iterative bootstrap** wrapping a **1-D root find (Brent)** per pillar, with the curve's interpolation providing everything to the left. It leans on the term-structure and observer machinery: build the curve once, and if a quote moves, the observer graph marks it dirty and it re-bootstraps lazily on next use. Cross-reference the numerical-methods material for the root-finder choice (Brent for robustness over Newton here, since we lack a clean analytic derivative).

### Q11. A colleague stores market data as raw doubles copied into each instrument. What breaks and how do you fix it?

Three things break. (1) **Staleness** — when the market moves, every copy is wrong and nothing knows to update; you're pricing off snapshots taken at construction. (2) **Inconsistency** — two instruments built at different instants hold different "spot" values, so a hedge and its hedged trade disagree. (3) **No relinking** — you can't swap the discount curve for the whole book atomically because each instrument owns its own copy.

The fix is the Handle/Observer graph: instruments hold `Handle<Quote>` / `Handle<YieldTermStructure>`, market data lives once behind those handles, ticks notify, and repricing is lazy.

```cpp
// Before: frozen snapshot, no reactivity
class Option { double spot_; /* copied at build time -> stale */ };

// After: shared live link, notified on change
class Option : public LazyObject {
    Handle<Quote> spot_;                           // observes the live quote
public:
    explicit Option(Handle<Quote> s) : spot_(std::move(s)) { observe(spot_.asObservable()); }
};
```

Now one `spot->setValue(...)` marks every dependent option dirty; each reprices once, on demand, off a single consistent value.

### Q12. What lifetime bug lurks in a raw-pointer Observer graph, and how do you prevent it?

The classic bug: an Observer is destroyed but stays registered in an Observable's list, so the next `notifyObservers()` calls `update()` through a **dangling pointer** — undefined behaviour, often a crash under load. The mirror bug is a leak/logic error where a long-lived Observable keeps a dead observer alive or keeps calling it.

Prevent it by making registration symmetric and RAII-driven: the Observer unregisters from *all* its observables in its destructor (as in Q3), and observables should tolerate observers vanishing.

```cpp
Observer::~Observer() {
    for (auto* s : observables_) s->unregisterObserver(this);  // never leave a dangling link
}
```

For robustness in real libraries, observables often hold `weak_ptr`s and skip-and-prune expired observers during notification, so a race between destruction and notification degrades to "skip" rather than "crash." And because the graph is mutable shared state, concurrent notification needs synchronisation — see the Concurrency primer.

### Q13. Which GoF patterns show up in a pricing library, and where?

| Pattern | Where it lives | Why |
|---|---|---|
| **Strategy** | PricingEngine plugged into Instrument | swap valuation method (analytic/tree/MC) without touching the trade |
| **Observer** | Quote -> curve -> engine -> instrument | reactive market data + lazy invalidation |
| **Factory** | building instruments/curves from config or trade tickets | centralise construction, hide concrete types |
| **Visitor** | operations across a heterogeneous instrument set (cashflow analysis, XML export) | add operations without editing every instrument class |
| **Decorator** | wrapping an engine with discounting/quanto/collateral adjustments | layer valuation adjustments compositionally |
| **Composite** | a portfolio/basket that is itself priced like an instrument | uniform treatment of leaf trades and baskets |
| **Bridge / pimpl** | Date, DayCounter carried by value dispatching to an impl | value semantics with polymorphic behaviour |

The two load-bearing ones are Strategy (instrument/engine decoupling) and Observer (market-data reactivity). If you can only name two in an interview, name those and explain the seam.

### Q14. How does the Visitor pattern help operate across many instrument types?

When you have a zoo of instruments (options, swaps, bonds) and want to add operations *across* all of them — compute total cashflows, serialise to XML, tag for regulatory reporting — you don't want to edit every instrument class each time. Visitor puts the operation in one place and lets instruments *accept* it.

```cpp
struct Swap; struct Bond;
struct Visitor {
    virtual void visit(Swap&) = 0;
    virtual void visit(Bond&) = 0;
    virtual ~Visitor() = default;
};

struct Instrument { virtual void accept(Visitor&) = 0; virtual ~Instrument() = default; };
struct Swap : Instrument { void accept(Visitor& v) override { v.visit(*this); } };
struct Bond : Instrument { void accept(Visitor& v) override { v.visit(*this); } };

struct CashflowReport : Visitor {                  // one operation, all types
    double total = 0;
    void visit(Swap&) override { /* sum swap legs */ }
    void visit(Bond&) override { /* sum coupons  */ }
};
```

The tradeoff: Visitor makes *adding operations* cheap but *adding instrument types* expensive (every visitor must grow a `visit` overload). Choose it when the type set is stable and operations proliferate — often true for a mature instrument library.

### Q15. Why hold market data behind a Handle rather than a shared_ptr directly?

A `shared_ptr` gives shared *ownership* of one fixed object; a `Handle` gives a shared, *repointable link* with notification. The difference matters operationally. At end of day you rebuild the discount curve from fresh quotes and want the entire live book to switch to it *atomically* and *reactively*. With `Handle<YieldTermStructure>`, one `handle.linkTo(newCurve)` repoints every holder and fires notifications so everything reprices lazily. With a raw `shared_ptr`, each instrument holds its own copy of the pointer; reassigning yours changes nothing for anyone else and notifies no one.

```cpp
Handle<YieldTermStructure> discount;               // shared across the whole book
discount.linkTo(todaysCurve);                      // one call -> all holders + notified
```

In short: `shared_ptr` = shared *object*; `Handle` = shared *link you can re-aim*. The extra indirection is the whole point.

### Q16. Sketch the full object graph for pricing a European option in this architecture.

Bottom to top: **Quotes** (spot, rate, vol) sit at the leaves as Observables. A **YieldTermStructure** and a **BlackVolSurface** observe those quotes. A **EuropeanOption** instrument holds a **Payoff** and an **Exercise** and points at the market data via **Handles**; it's a `LazyObject`. You attach a **PricingEngine** (say `AnalyticEuropeanEngine`) that observes the curves and, on `calculate`, reads spot/rate/vol and returns Black-Scholes NPV.

```
   spot(Quote)   rate(Quote)   vol(Quote)      <- Observables (leaves)
        \            |            /
     YieldTermStructure   BlackVolSurface       <- observe quotes, notify up
              \          /
           AnalyticEngine  (Strategy)            <- observes curves
                 |
          EuropeanOption (LazyObject)            <- holds Payoff+Exercise, Handles
                 |
              NPV()   -> lazy: recompute iff dirty
```

Tick `vol` and the notification propagates up, marking the surface, engine and option dirty; the next `option.NPV()` recomputes once. Swap `AnalyticEngine` for `MonteCarloEngine` and the *same* option reprices by a different method — Strategy and Observer doing exactly the jobs the design assigned them.

## Real-World Quant C++

### Summary

**What this topic covers**

What the pricing/risk stack actually looks like in production — beyond toy engines. This is the "how does a real desk do it" topic: a **QuantLib** deep-dive (its layering, its SWIG-generated Python bindings, how you extend it with a new engine), the shape of a **production pricing/risk architecture** (compute core in C++, orchestration and research in Python — the two-language pattern), **market-data handling and serialization**, **calibration** (fitting model parameters to market quotes as an optimization loop), and the topic everyone eventually cares about: **computing Greeks efficiently** — **bump-and-revalue** (finite differences: dead simple, but N+1 revaluations and cancellation error) versus **AAD / adjoint automatic differentiation** (all sensitivities in a small constant multiple of one pricing) and *why AAD reshaped risk* for large portfolios. The 16 questions run from "walk me through QuantLib's structure" to "implement reverse-mode AD for a small pricer" and "why is your overnight risk batch slow and how does AAD fix it."

**Mental model**

Hold two pictures. The first is the **two-language sandwich**: a fast, careful C++ core (instruments, engines, curves, RNG, linear algebra) wrapped in a thin binding layer so Python drives it — quants prototype and glue in Python; the P&L-critical, latency-critical numerics live in C++. QuantLib is the canonical instance: a big C++ library with SWIG-generated Python bindings. The second picture is the **derivative-of-price** view of risk. A price is a function P(market) of many inputs; risk is the gradient dP/dinput (deltas, vegas) and second derivatives (gammas). Bump-and-revalue estimates that gradient by finite differences — perturb each input, reprice, subtract — costing one revaluation per input. AAD instead records the *computation* of P once and plays it backward to get *every* partial derivative in one sweep, at a cost independent of the number of inputs. For a book with thousands of risk factors, that's the difference between an overnight batch and a real-time one.

**Key terms**

- **Two-language problem** — research/glue in Python, performance-critical numerics in C++; the boundary is where most engineering effort goes.
- **QuantLib** — the reference open-source C++ quant library; instruments, engines, term structures, calendars, math.
- **SWIG** — the tool generating QuantLib's Python (and other) bindings from interface files.
- **pybind11** — modern header-only alternative for hand-wrapping C++ into Python (used by many in-house libs).
- **Calibration** — solving for model parameters (e.g. Heston's kappa, theta, sigma, rho) that best reprice a set of market quotes; an optimization loop around the pricer.
- **Greeks** — sensitivities of price to inputs: delta (dP/dS), gamma (d2P/dS2), vega (dP/dvol), theta, rho.
- **Bump-and-revalue** — estimate a Greek by finite difference: reprice with a bumped input, subtract, divide by the bump.
- **AAD / adjoint AD** — reverse-mode automatic differentiation: one forward pass records operations, one backward pass yields all partials.
- **Forward-mode AD** — propagates one input's derivative forward; cheap for few inputs, many outputs.
- **Tape** — the recorded sequence of operations AAD replays backward.
- **Serialization** — persisting market data / trades (binary, protobuf, JSON) for reproducible pricing and grid distribution.

**Why interviewers ask this**

This topic tells the interviewer whether you've shipped analytics or only studied them. Anyone can price one option; a production quant dev reasons about the *system*: where the C++/Python boundary sits and why, how a risk batch scales, why the overnight run is slow and what actually fixes it. The Greeks question is the discriminator. A junior says "bump every input and reprice" and stops. A senior knows the cost is O(N) revaluations, that finite differences suffer catastrophic cancellation when the bump is small, that choosing the bump size is a bias/variance tradeoff, and that AAD gets *all* Greeks in ~3-5x one pricing — which is why banks invested heavily in it. Being able to explain reverse-mode AD, even at sketch level, is a strong senior signal.

**Common confusions**

- "AAD is just numerical differentiation done cleverly" — no; it's *exact* (to floating-point), computing analytic derivatives via the chain rule on the recorded computation, with no bump and no cancellation.
- "More bumps = more accurate" — smaller bumps reduce truncation bias but amplify cancellation/rounding; there's an optimal bump around sqrt(machine-eps)*scale for one-sided, and central differences are second-order but cost 2N.
- "The GIL means Python can't parallelise C++ work" — release the GIL around the C++ compute (`gil_scoped_release`) and Python threads run concurrently while C++ crunches.
- "Calibration is a formula" — it's an iterative optimizer (Levenberg-Marquardt, differential evolution) repeatedly *pricing* under trial parameters; the pricer is the inner loop.
- "QuantLib is too slow for production" — it's often the reference/benchmark, sometimes the engine; where it's too slow, teams specialise hot engines, not the whole design.

**What follows from this topic**

This is where the earlier pieces cash out. The PricingEngine/Handle/Observer design (previous topic) is exactly what QuantLib implements and what makes bump-based risk tractable (bump a quote, the graph invalidates, reprice lazily). The Monte Carlo and numerical-methods material feeds calibration's inner loop. The `pybind11`/GIL/zero-copy discussion connects to the Concurrency and low-latency primers. And the scenario topic that follows puts you at the whiteboard implementing the very engines this architecture wires together. Cross-reference Quantitative Methods for the models being calibrated (Black-Scholes, Heston, SABR) and the meaning of the Greeks.

### Q1. Walk me through how QuantLib is structured.

QuantLib layers roughly like this, bottom to top:

- **Math/utilities** — `Array`/`Matrix`, solvers (Brent, Newton), interpolation, optimizers, random-number generation, statistics. The numerical toolbox.
- **Date/time** — `Date`, `Calendar` (per-market holidays), `DayCounter`, `Schedule`, business-day conventions. The bug-prone date layer as its own subsystem.
- **Market data & term structures** — `Quote`, `Handle`, `YieldTermStructure`, `BlackVolTermStructure`, `DefaultProbabilityTermStructure`, built via `RateHelper` bootstrapping.
- **Cashflows & instruments** — `CashFlow`, `Leg`, and `Instrument` subclasses (`VanillaOption`, `Swap`, `Bond`).
- **Pricing engines** — `PricingEngine` strategies: `AnalyticEuropeanEngine`, `BinomialVanillaEngine`, `MCEuropeanEngine`, finite-difference engines.
- **Models & processes** — `StochasticProcess` (GBM, Heston), short-rate models, calibration helpers.

Cross-cutting: the **Observable/Observer + LazyObject** machinery wiring quotes -> curves -> engines -> instruments with lazy recalculation, and the **Handle** indirection for relinkable market data. The mental one-liner: *math and dates at the base, market data and instruments in the middle, swappable engines on top, all reactive.*

### Q2. How are QuantLib's Python bindings generated, and how does that differ from pybind11?

QuantLib uses **SWIG**: `.i` interface files declare which C++ classes/functions to expose, and SWIG generates the wrapper C++ plus the Python module (`QuantLib` in Python mirrors the C++ API closely). It's declarative and multi-target (the same `.i` files can emit Python, Java, C#), which suits a large, stable public API.

**pybind11** is the modern hand-wrapping alternative: you write C++ that describes the binding inline — no separate IDL, full control, cleaner ownership/STL/NumPy integration, but you write each binding by hand.

```cpp
// pybind11: wrap a pricer directly in C++
PYBIND11_MODULE(fastpricer, m) {
    m.def("black_scholes", &blackScholes,
          py::arg("S"), py::arg("K"), py::arg("r"), py::arg("vol"), py::arg("T"));
    py::class_<MonteCarloEngine>(m, "MonteCarloEngine")
        .def(py::init<std::size_t>())
        .def("price", &MonteCarloEngine::price);
}
```

Rule of thumb: **SWIG** when you must expose a huge existing API across languages (QuantLib's situation); **pybind11** when you're wrapping *your own* focused C++ core into Python with tight NumPy/ownership integration.

### Q3. How would you extend QuantLib with a new pricing engine?

You subclass the instrument's `engine` base and implement `calculate()`, reading the instrument's `arguments_` and writing `results_`. Because of the Strategy design you don't touch the instrument at all — you plug your engine in.

```cpp
class MyBarrierEngine : public BarrierOption::engine {
public:
    explicit MyBarrierEngine(std::shared_ptr<GeneralizedBlackScholesProcess> p)
        : process_(std::move(p)) { registerWith(process_); }   // observe market data

    void calculate() const override {
        // read inputs from arguments_ (payoff, barrier, exercise)
        // read market data from process_ (spot, vol, rates)
        results_.value = /* your valuation */;                 // write outputs
        // optionally results_.delta, results_.gamma, ...
    }
private:
    std::shared_ptr<GeneralizedBlackScholesProcess> process_;
};

// usage: barrierOption.setPricingEngine(std::make_shared<MyBarrierEngine>(process));
```

Key hooks: `registerWith()` wires your engine into the Observer graph so it invalidates when market data ticks; `arguments_`/`results_` are the typed in/out structs the framework passes. This is the extension seam the whole architecture is built around.

### Q4. Sketch a production pricing/risk architecture. Where does C++ sit vs Python?

Layered by responsibility and language:

```
 Research / notebooks / strategy   (Python)   <- pandas, plotting, quick models
 Orchestration / risk batch / API  (Python)   <- schedules jobs, aggregates P&L
 -------------------- binding boundary (pybind11 / SWIG) --------------------
 Pricing engines, curves, MC/PDE, AAD tape    (C++)   <- P&L-critical numerics
 Linear algebra (Eigen/MKL), RNG, memory pools (C++)   <- performance core
 Market-data store / serialization             (C++ + protobuf/binary)
```

C++ owns everything on the P&L- and latency-critical path: valuation, sensitivities, simulation, the number crunching. Python owns everything that benefits from iteration speed and ecosystem: research, orchestration, reporting, gluing services. The binding boundary is deliberately **coarse-grained** — you cross it with "price this book" not "add these two doubles," and you **release the GIL** around the heavy C++ so a Python thread pool can fan risk jobs across cores. Market data is serialized (protobuf/binary) so a grid of workers can each reconstruct an identical pricing environment for reproducibility.

### Q5. What is calibration, and how is it structured in code?

Calibration finds the **model parameters that best reprice observed market quotes**. For Heston you seek (kappa, theta, sigma, rho, v0) so model option prices match a grid of market implied vols; it's an **optimization loop with the pricer as the objective's inner call**.

```cpp
// minimize sum of squared (model - market) over parameter vector p
double objective(const Vector& p, const std::vector<Quote>& market) {
    HestonModel model(p);
    double sse = 0.0;
    for (const auto& q : market) {
        double modelPrice = priceUnder(model, q.strike, q.maturity); // inner: a full pricing
        double diff = modelPrice - q.price;
        sse += diff * diff;
    }
    return sse;
}
// LevenbergMarquardt / DifferentialEvolution repeatedly evaluates objective(p, market)
Vector p = optimizer.minimize(objective, initialGuess, bounds);
```

Structurally: an **optimizer** (Levenberg-Marquardt for smooth local fits, differential evolution/simplex for rugged surfaces) wraps a **loss function** that **prices under trial parameters**. That inner pricing is called thousands of times, so its speed dominates calibration wall-clock — and its *derivatives* w.r.t. parameters (which AAD provides) turn a slow finite-difference Jacobian into a fast exact one. Cross-reference the numerical-methods and optimization material in Quantitative Methods for the solvers.

### Q6. Compare bump-and-revalue vs AAD for computing Greeks.

| | Bump-and-revalue (finite diff) | AAD (adjoint/reverse-mode) |
|---|---|---|
| Idea | perturb each input, reprice, subtract | record computation once, play it backward |
| Cost for N Greeks | N+1 (one-sided) or 2N (central) full pricings | ~1 pricing + a backward pass = small constant x one pricing |
| Accuracy | truncation bias + catastrophic cancellation; bump-size dependent | exact to floating point; no bump |
| Implementation | trivial: wrap the existing pricer | intrusive: needs an AD type/tape or a library |
| Second-order | O(N^2) repricings | achievable via AD-over-AD but harder |
| Memory | negligible | tape stores every operation (can be large) |

The headline: for a portfolio with **thousands** of risk factors, bump costs *thousands* of revaluations; AAD costs a handful. That asymptotic collapse — all Greeks in ~3-10x a single pricing regardless of N — is exactly why AAD "transformed risk": overnight XVA/sensitivity batches that took hours became feasible intraday. You reach for bump when N is small, the pricer is a black box, or you need it working today; you invest in AAD when N is large and you own the code.

### Q7. Implement bump-and-revalue for delta and vega. What's the accuracy trap?

```cpp
double price(double S, double vol);                 // the pricer

double deltaBump(double S, double vol, double h) {  // central difference
    return (price(S + h, vol) - price(S - h, vol)) / (2.0 * h);
}
double vegaBump(double S, double vol, double h) {
    return (price(S, vol + h) - price(S, vol - h)) / (2.0 * h);
}
```

The trap is **catastrophic cancellation** fighting **truncation bias**. Truncation error of central differencing is O(h^2), so you want h *small*. But `price(S+h) - price(S-h)` subtracts two nearly-equal numbers, and as h shrinks the difference loses significant digits to rounding — relative error blows up like eps/h. The total error is minimized at a sweet spot: for central differences roughly h ~ (eps)^(1/3) * scale (around 1e-5 * S for doubles); for one-sided, h ~ sqrt(eps) * scale. A common mistake is picking h "tiny for accuracy" and getting *noise*. Also: bump a *relative* amount for scale-invariance (`h = S * 1e-5`), not a fixed absolute bump that's wrong across instruments.

### Q8. Explain reverse-mode automatic differentiation and why it gives all Greeks cheaply.

A price is built from elementary operations (+, *, `exp`, `log`, `N`). Reverse-mode AD does two passes. **Forward**: evaluate the price normally, but record each operation and its inputs on a **tape**. **Backward**: starting from `dP/dP = 1` at the output, walk the tape in reverse applying the chain rule, accumulating an **adjoint** `dP/dx` for every intermediate and input.

The magic is cost. One backward sweep touches each recorded operation once, so you get `dP/dx_i` for *all* inputs x_i in a single pass whose cost is a small constant multiple of the forward pricing — **independent of the number of inputs**. Forward-mode AD, by contrast, propagates one input's derivative at a time, costing O(N) for N inputs. Since risk wants many derivatives of *one* output (the price), reverse-mode is the natural fit. That "all gradients for the price of a few evaluations" property is why a book with 10,000 sensitivities becomes tractable — the exact reason AAD swept through derivatives risk.

### Q9. Implement a tiny reverse-mode AD number and differentiate Black-Scholes-style code with it.

```cpp
struct Tape {
    struct Node { double partial0 = 0, partial1 = 0; int in0 = -1, in1 = -1; };
    std::vector<Node> nodes;
    std::vector<double> adjoint;
    int push(double p0, int i0, double p1 = 0, int i1 = -1) {
        nodes.push_back({p0, p1, i0, i1}); return (int)nodes.size() - 1;
    }
};
inline Tape g_tape;

struct Var {
    double v; int idx;
    Var(double x) : v(x), idx(g_tape.push(0, -1)) {}   // leaf
    Var(double x, int i) : v(x), idx(i) {}
};

Var operator*(Var a, Var b) {                          // d(ab): da=b, db=a
    return {a.v * b.v, g_tape.push(b.v, a.idx, a.v, b.idx)};
}
Var operator+(Var a, Var b) { return {a.v + b.v, g_tape.push(1, a.idx, 1, b.idx)}; }
Var vexp(Var a) { double e = std::exp(a.v); return {e, g_tape.push(e, a.idx)}; } // d(exp)=exp

void backprop(int output) {                            // reverse sweep
    g_tape.adjoint.assign(g_tape.nodes.size(), 0.0);
    g_tape.adjoint[output] = 1.0;                      // dP/dP = 1
    for (int i = output; i >= 0; --i) {
        double a = g_tape.adjoint[i];
        auto& n = g_tape.nodes[i];
        if (n.in0 >= 0) g_tape.adjoint[n.in0] += a * n.partial0;
        if (n.in1 >= 0) g_tape.adjoint[n.in1] += a * n.partial1;
    }
}
// After computing price P as a Var, backprop(P.idx); then g_tape.adjoint[S.idx] is delta, etc.
```

This is the skeleton every AAD library elaborates (operator overloading records the tape; a reverse sweep harvests all adjoints). Production tools (dco/c++, ADOL-C, Adept) add checkpointing to bound tape memory and hand-tuned intrinsics.

### Q10. How do you handle the GIL so Python can parallelise C++ pricing?

Python's Global Interpreter Lock serialises Python bytecode, but *not* pure C++ that isn't touching Python objects. So around long-running C++ compute you **release the GIL**, letting other Python threads run while your engine crunches; you reacquire it before returning to Python.

```cpp
double priceBook(const Book& book) {                   // pure C++, no py objects
    py::gil_scoped_release release;                    // let other Python threads run
    return runHeavyValuation(book);                    // minutes of C++ compute
}                                                      // GIL reacquired on scope exit
```

With the GIL released, a Python `ThreadPoolExecutor` mapping `priceBook` over sub-portfolios achieves real parallelism because the work lives in C++. The rule: release the GIL for *coarse* C++ work, and never touch Python objects (or the interpreter) while it's released. This pairs with **zero-copy** data transfer (Q11) so you're not copying million-path arrays across the boundary.

### Q11. How do you avoid copying large arrays across the C++/Python boundary?

Use the **buffer protocol** so C++ reads/writes NumPy memory in place. pybind11 exposes `py::array_t<double>` with a `request()` giving a raw pointer, shape and strides — you operate on the caller's buffer directly, no copy.

```cpp
double payoff_mean(py::array_t<double, py::array::c_style | py::array::forcecast> paths) {
    auto buf = paths.request();                        // no copy: view into NumPy memory
    const double* p = static_cast<double*>(buf.ptr);
    std::size_t n = buf.size;
    double s = 0.0;
    for (std::size_t i = 0; i < n; ++i) s += std::max(p[i] - 100.0, 0.0);
    return s / n;
}
```

For a million-path Monte Carlo array, copying on every call would dominate runtime and thrash cache; the zero-copy view makes the boundary essentially free. Combine with `py::gil_scoped_release` for the compute portion. The discipline: cross the boundary *coarsely* and *without copying* — pass big buffers by view, do the loop in C++.

### Q12. How do you serialize market data / trades for a distributed risk grid, and why does it matter?

Because a risk grid fans a book across many worker processes/machines, each worker must reconstruct an *identical* pricing environment — same curves, same fixings, same trade terms — or results won't aggregate coherently and won't be reproducible. So you serialize the market snapshot and trades to a stable format and ship them to workers.

Format choice matters: **binary/protobuf** (compact, fast, schema-evolvable, versioned) for the hot path; **JSON** for debuggability and interop where speed is secondary.

```cpp
// schema-first (protobuf) keeps producers/consumers in sync and versionable
message Quote   { string id = 1; double value = 2; int64 as_of = 3; }
message CurveSnap { string ccy = 1; repeated Quote pillars = 2; string day_counter = 3; }
```

Two non-obvious requirements: (1) **reproducibility** — pin the as-of timestamp and RNG seeds so a re-run reprices identically for P&L attribution and audit; (2) **versioning** — schema evolution so a new field doesn't break old workers mid-deploy. Get these wrong and you get non-deterministic risk numbers that are impossible to reconcile.

### Q13. Your overnight risk batch takes 6 hours. Walk me through diagnosis and fixes.

First, **measure** — profile to find whether time is in pricing, market-data rebuild, I/O, or aggregation; don't guess. Then attack in order of leverage:

1. **Algorithmic (biggest win): replace bump Greeks with AAD.** If you compute thousands of sensitivities by finite differences, you're doing thousands of full revaluations. AAD gets all of them in a small constant multiple of one pricing — often the single change that turns 6 hours into minutes.
2. **Parallelise** across the portfolio — independent trades/scenarios across cores and grid nodes, releasing the GIL if Python-orchestrated; MC paths across threads with per-thread RNG.
3. **Cache and share** the market-data build — bootstrap each curve once, reuse across trades (the Observer/lazy graph already enables this); avoid rebuilding per trade.
4. **Reduce redundant repricing** — dirty-flag laziness so unchanged inputs don't retrigger valuation; batch trades sharing an engine.
5. **Micro/perf** last — SoA layout, avoid allocation on the hot path, vectorise, tune the RNG.

The headline order: *algorithm (AAD) beats parallelism beats caching beats micro-optimisation.* Interviewers want to hear you reach for AAD before you reach for more cores.

### Q14. When is forward-mode AD the right choice over reverse-mode?

Match the mode to the shape of the Jacobian. **Reverse-mode** cost scales with the number of *outputs*; it's ideal for **many inputs, one (or few) outputs** — exactly pricing (one price, thousands of risk factors). **Forward-mode** cost scales with the number of *inputs*; it wins for **few inputs, many outputs**.

So forward-mode fits: calibrating a model with a *handful* of parameters but wanting the sensitivity of *many* instrument prices to those few parameters (few inputs, many outputs); or computing a single input's effect throughout a large result vector. It's also simpler — no tape, just carry a derivative alongside each value (dual numbers) — so for 1-3 inputs it can beat reverse-mode's tape overhead outright.

```cpp
struct Dual { double v, d; };                          // value + derivative wrt ONE input
Dual operator*(Dual a, Dual b) { return {a.v*b.v, a.v*b.d + a.d*b.v}; }  // product rule
Dual dexp(Dual a) { double e = std::exp(a.v); return {e, e*a.d}; }
```

Rule of thumb: **gradient of a scalar (price) w.r.t. many inputs -> reverse**; **derivative of many outputs w.r.t. few inputs -> forward**.

### Q15. Where does QuantLib's design become a bottleneck, and what do desks do about it?

QuantLib optimises for *generality and correctness* — heavy use of `shared_ptr`, virtual dispatch through the Instrument/Engine/Observer graph, and the Handle indirection. Each is a small runtime cost: atomic refcount traffic, vtable indirection that blocks inlining, extra pointer hops. For occasional pricing that's invisible; for a tight Monte Carlo inner loop or a latency-sensitive path it adds up.

What desks actually do: they don't rewrite QuantLib, they **specialise the hot engines**. Keep QuantLib as the reference/benchmark and for the long tail of instruments, but for the high-volume products write a purpose-built engine that (a) templates on payoff/process to kill virtual dispatch (CRTP), (b) uses value semantics and pre-reserved SoA buffers instead of `shared_ptr` graphs on the inner loop, and (c) drops the Observer overhead where inputs are fixed for a batch. It's the classic pattern: a general framework for coverage, a hand-tuned fast path for the 20% of instruments that are 80% of the compute. Cross-reference the low-latency and CRTP material for the specific techniques.

### Q16. How do you test numerical/pricing code where exact equality is meaningless?

You test to **tolerances and invariants**, never `==` on floats. A layered strategy:

- **Golden/reference values** — compare against a trusted source (a closed-form price, another library, a published benchmark) within an absolute+relative tolerance sized to the method's accuracy.
- **Analytic anchors** — a Monte Carlo/tree price must converge to the Black-Scholes closed form for a European option; assert `|mc - analytic| < k * standardError`.
- **Property tests** — model-independent invariants that must always hold: **put-call parity** (`C - P == S - K*exp(-r*T)`), monotonicity (call price increases in spot), non-negativity, bounds.
- **Convergence tests** — error shrinks at the expected rate: MC ~ 1/sqrt(N), a tree ~ 1/steps.
- **Edge cases** — T -> 0, vol -> 0, deep in/out of the money, to catch NaN/inf and cancellation.

```cpp
EXPECT_NEAR(mcPrice, bsClosedForm, 3.0 * standardError);      // statistical tolerance
EXPECT_NEAR(call - put, S - K*std::exp(-r*T), 1e-10);         // put-call parity
```

The mindset shift from ordinary testing: you're validating *numerical accuracy and mathematical properties*, so the assertions encode tolerances and theorems, not bit-exact outputs.

## C++ Quant Interview & Scenario Playbooks

### Summary

**What this topic covers**

The hands-on, whiteboard half of a quant-dev interview — the problems you actually get asked to *write* and *debug* on the spot. This is a playbook topic: **implement Black-Scholes in C++** (including N(x) via `erfc`), **design a Monte Carlo pricer class hierarchy** (payoff + path generator + engine), **price an option on a binomial tree**, a battery of **"what does this print" / "is this UB" / spot-the-bug** questions (dangling references, lifetime, integer overflow, uninitialized reads, static initialization order), **make a slow pricer fast** (profile, then kill virtual dispatch / allocation / cache misses), **debug memory and perf with sanitizers**, and the meta-question of **how a quant-dev interview is actually shaped** (C++ + numerics + a little maths) and how to approach it under pressure. The 16 questions are deliberately concrete — code in, code or a crisp verdict out. Treat this as the dress rehearsal for the earlier topics: everything abstract there gets implemented here.

**Mental model**

A quant-dev interview is a **triangle**: C++ correctness, numerical/financial competence, and clear communication under time pressure. You'll rarely be asked pure algorithms (that's the SWE track) or pure maths (that's the quant-researcher track) — you live in the intersection, where "implement Black-Scholes and now compute its delta" tests all three at once. Approach every problem the same way: (1) restate and pin down assumptions (European? continuous dividends? which day-count?); (2) write the small, correct, idiomatic version first — `double`, clear names, no premature optimisation; (3) *then* discuss accuracy (cancellation, edge cases at T->0) and performance (dispatch, allocation) as a second pass. For the "what does this print / is this UB" questions, the reflex is to scan for the five classic hazards — lifetime/dangling, uninitialized reads, signed overflow, static-init-order, and iterator/reference invalidation — because that's where these questions always live.

**Key terms**

- **Undefined behaviour (UB)** — a program construct the standard imposes no requirements on; anything may happen, including "works on my machine" then crashes in prod.
- **Dangling reference** — a reference/pointer to an object whose lifetime has ended (returned local, invalidated vector element).
- **Static initialization order fiasco** — the unspecified init order of non-local statics across translation units; using one before it's constructed is UB.
- **Signed integer overflow** — UB in C++ (unsigned wraps, signed does not); a real trap in tree/step counters.
- **N(x)** — standard normal CDF; computed via `0.5 * erfc(-x / sqrt(2))`.
- **CRTP** — Curiously Recurring Template Pattern; static polymorphism to remove virtual dispatch on the hot path.
- **ASan / UBSan / TSan** — AddressSanitizer (memory errors), UndefinedBehaviorSanitizer, ThreadSanitizer (data races).
- **Profile-guided** — measure before optimising; `perf`/VTune/cachegrind find the real hotspot.
- **Binomial tree** — discretise the underlying into up/down moves; value by backward induction; handles American exercise.
- **Antithetic variates** — variance reduction pairing Z with -Z in Monte Carlo.
- **`DoNotOptimize`** — benchmark helper preventing the compiler from deleting code you're timing.

**Why interviewers ask this**

Because talk is cheap and a whiteboard isn't. The design topics tell them you *understand* an architecture; the scenario topic tells them you can *produce* correct C++ that computes a right number, and *find* the bug when it doesn't. The implement-Black-Scholes question checks you know `double` not `float`, `erfc` for N(x), and the edge cases. The class-hierarchy question checks you can factor payoff/generator/engine cleanly under time pressure. The spot-the-UB questions are pure signal on C++ maturity — a senior sees a returned reference to a local instantly. The "make it fast" question separates people who guess (and micro-optimise the wrong thing) from people who *profile first* and know that memory layout usually beats FLOPs. And how you *approach* the problem — assumptions first, correct then fast — is itself the signal.

**Common confusions**

- "Use `float` for speed" — for prices you use `double`; the precision matters more than the halved memory, and money isn't a `double` at all (integer minor units).
- "N(x) needs a rational approximation I have to memorise" — the standard library's `erfc` gives it directly and accurately: `0.5*erfc(-x/sqrt(2))`.
- "It printed the right value, so it's defined" — UB can *appear* to work; a returned dangling reference may read the stale-but-intact stack slot until it doesn't.
- "Virtual calls are the bottleneck" — sometimes, but allocation and cache misses usually dominate; measure before assuming.
- "More paths always fixes MC error" — error only falls like 1/sqrt(N); to halve it you 4x the work. Variance reduction beats brute force.

**What follows from this topic**

This topic is the capstone: it implements what the Design-Patterns topic architected and the Real-World topic productionised. The Monte Carlo hierarchy here is the concrete form of the PricingEngine/Payoff design; the "make it fast" question applies the CRTP/SoA/allocation lessons from the low-latency material; the sanitizer and UB questions connect to the general C++ language primer (which owns the *syntax* — here we apply it under interview conditions). After this you should be able to sit a quant-dev screen and, given "price this and give me its Greeks, then make it faster," write the code, reason about its accuracy, profile it, and defend every decision. Cross-reference Quantitative Methods for the underlying maths and the general C++ primer for language mechanics.

### Q1. Implement Black-Scholes for a European call and put in C++, including N(x).

```cpp
#include <cmath>

// standard normal CDF via the complementary error function (accurate, in <cmath>)
inline double normCdf(double x) {
    return 0.5 * std::erfc(-x / std::sqrt(2.0));
}

struct BsResult { double call, put; };

BsResult blackScholes(double S, double K, double r, double q, double vol, double T) {
    // guard degenerate inputs before dividing by vol*sqrt(T)
    if (T <= 0.0 || vol <= 0.0) {
        double c = std::max(S * std::exp(-q * T) - K * std::exp(-r * T), 0.0);
        double p = std::max(K * std::exp(-r * T) - S * std::exp(-q * T), 0.0);
        return {c, p};
    }
    double sqrtT = std::sqrt(T);
    double d1 = (std::log(S / K) + (r - q + 0.5 * vol * vol) * T) / (vol * sqrtT);
    double d2 = d1 - vol * sqrtT;
    double disc = std::exp(-r * T), div = std::exp(-q * T);
    double call = S * div * normCdf(d1) - K * disc * normCdf(d2);
    double put  = K * disc * normCdf(-d2) - S * div * normCdf(-d1);
    return {call, put};
}
```

Talking points the interviewer wants: `double` not `float`; N(x) from `erfc` (no memorised polynomial); the `T<=0`/`vol<=0` guard returning intrinsic value; carrying a dividend yield q; and that put could equivalently come from **put-call parity** `P = C - S*div + K*disc`, a free correctness check.

### Q2. Extend it to compute delta and vega analytically.

Closed-form Greeks fall straight out of the same d1/d2. Let `n(x) = exp(-x*x/2)/sqrt(2*pi)` be the normal pdf.

```cpp
inline double normPdf(double x) {
    static const double INV_SQRT_2PI = 0.3989422804014327;
    return INV_SQRT_2PI * std::exp(-0.5 * x * x);
}

struct Greeks { double callDelta, putDelta, vega, gamma; };

Greeks bsGreeks(double S, double K, double r, double q, double vol, double T) {
    double sqrtT = std::sqrt(T);
    double d1 = (std::log(S / K) + (r - q + 0.5 * vol * vol) * T) / (vol * sqrtT);
    double div = std::exp(-q * T);
    double callDelta = div * normCdf(d1);
    double putDelta  = div * (normCdf(d1) - 1.0);       // = -div*N(-d1)
    double vega  = S * div * normPdf(d1) * sqrtT;       // per 1.0 of vol; /100 for per-1%
    double gamma = div * normPdf(d1) / (S * vol * sqrtT);
    return {callDelta, putDelta, vega, gamma};
}
```

Note vega and gamma are the *same* for call and put (parity differentiates to a constant). A common follow-up: "now do it by bumping" — which sets up the bump-vs-analytic (and vs AAD) discussion from the Real-World topic, plus the cancellation trap in finite differences.

### Q3. Design a Monte Carlo pricer class hierarchy. What are the pieces?

Three orthogonal responsibilities: a **PathGenerator** (evolve the underlying), a **Payoff** (map a path/terminal value to a cashflow), and an **Engine** (drive N paths, aggregate mean + standard error). Keep them separate so you mix and match (GBM vs Heston generator; vanilla vs asian payoff) and can template for inlining on the hot path.

```cpp
struct Payoff { virtual double operator()(double S_T) const = 0; virtual ~Payoff() = default; };
struct Call : Payoff { double K; Call(double k):K(k){} double operator()(double S) const override { return std::max(S-K,0.0); } };

struct GbmGenerator {                                  // one terminal draw under GBM
    double S0, r, vol, T;
    double terminal(double z) const {
        return S0 * std::exp((r - 0.5*vol*vol)*T + vol*std::sqrt(T)*z);
    }
};

template <class Gen, class Pay>                        // templated -> operator() inlines
class McEngine {
    Gen gen_; const Pay& pay_; double discount_;
public:
    McEngine(Gen g, const Pay& p, double disc) : gen_(g), pay_(p), discount_(disc) {}
    struct Out { double price, stdError; };
    Out run(std::size_t n, std::uint64_t seed) const {
        std::mt19937_64 rng(seed);
        std::normal_distribution<double> N(0.0, 1.0);
        double sum = 0, sumSq = 0;
        for (std::size_t i = 0; i < n; ++i) {
            double v = pay_(gen_.terminal(N(rng)));
            sum += v; sumSq += v * v;
        }
        double mean = sum / n;
        double var  = (sumSq / n - mean * mean) / n;   // variance of the mean
        return {discount_ * mean, discount_ * std::sqrt(var)};
    }
};
```

The design points: template (not virtual) on the hot path so the payoff/generator inline; return **price and standard error** (MC without an error bar is meaningless); one RNG *per run* seeded reproducibly. This is the concrete instance of the PricingEngine/Payoff design from the first topic.

### Q4. Add antithetic variates to that engine. Why does it help?

Antithetic variates pair each draw Z with its mirror -Z, average the two payoffs, and thereby cancel much of the sampling noise (the two paths are negatively correlated, so their mean has lower variance).

```cpp
Out runAntithetic(std::size_t pairs, std::uint64_t seed) const {
    std::mt19937_64 rng(seed);
    std::normal_distribution<double> N(0.0, 1.0);
    double sum = 0, sumSq = 0;
    for (std::size_t i = 0; i < pairs; ++i) {
        double z = N(rng);
        double a = pay_(gen_.terminal(z));
        double b = pay_(gen_.terminal(-z));            // mirrored path, same z magnitude
        double v = 0.5 * (a + b);                       // averaged -> lower variance
        sum += v; sumSq += v * v;
    }
    double mean = sum / pairs;
    double var  = (sumSq / pairs - mean * mean) / pairs;
    return {discount_ * mean, discount_ * std::sqrt(var)};
}
```

It helps most when the payoff is monotone in Z (like a vanilla call), where the negative correlation is strong; for symmetric/non-monotone payoffs the gain shrinks. It's nearly free (same number of `exp` calls per unit variance reduction) and composes with control variates. Since MC error only falls like 1/sqrt(N), variance reduction is how you get accuracy without 4x-ing the path count.

### Q5. Price a European option with a binomial (CRR) tree in C++.

```cpp
double binomialCall(double S, double K, double r, double vol, double T, int steps) {
    double dt = T / steps;
    double u  = std::exp(vol * std::sqrt(dt));         // Cox-Ross-Rubinstein up factor
    double d  = 1.0 / u;
    double disc = std::exp(-r * dt);
    double p  = (std::exp(r * dt) - d) / (u - d);      // risk-neutral up-probability

    std::vector<double> value(steps + 1);
    for (int i = 0; i <= steps; ++i) {                 // terminal payoffs
        double S_T = S * std::pow(u, steps - i) * std::pow(d, i);
        value[i] = std::max(S_T - K, 0.0);
    }
    for (int step = steps - 1; step >= 0; --step)      // backward induction
        for (int i = 0; i <= step; ++i)
            value[i] = disc * (p * value[i] + (1.0 - p) * value[i + 1]);
    return value[0];
}
```

Talking points: CRR sets `d = 1/u` so the tree recombines (O(steps^2) nodes, not 2^steps); `p` is the risk-neutral probability, not a real-world one; and the killer extension — for an **American** option insert `value[i] = max(continuation, intrinsic)` inside the backward loop, which trees handle and closed-form Black-Scholes cannot. Convergence is O(1/steps) and oscillatory.

### Q6. What does this print, and is it UB?

```cpp
const std::string& firstName() {
    std::string s = "alice";
    return s;                       // returns reference to a local
}
int main() { std::cout << firstName() << "\n"; }
```

**It's undefined behaviour** — a returned reference to a local `s` whose lifetime ends when `firstName()` returns; the caller dereferences a dangling reference. It might print `alice`, print garbage, or crash, and may differ between `-O0` and `-O2`. The insidious part is it *often prints the right value* at low optimisation because the stack slot isn't yet overwritten — which is exactly why "it worked" proves nothing about UB. Fix: return by value (`std::string`, cheap with RVO/move) or take a reference to something that outlives the call. The senior reflex is to spot "returns a reference/pointer to a local" instantly.

### Q7. Spot the bug: this loop over a vector of prices sometimes crashes.

```cpp
std::vector<double> prices = load();
double* first = &prices[0];
for (double p : newQuotes) {
    prices.push_back(p);            // may reallocate
    use(*first);                    // first may now dangle
}
```

The bug is **iterator/pointer invalidation**: `push_back` can reallocate the vector's buffer when it exceeds capacity, moving the elements; `first` still points at the *old*, freed storage — a dangling pointer, UB, intermittent crash (it only reallocates on some iterations, hence "sometimes"). Fixes: `prices.reserve(prices.size() + newQuotes.size())` before the loop so no reallocation occurs (only safe if you never exceed it), or don't cache raw pointers/iterators across mutations — re-index by position (`prices[0]`) each time, or capture the value not the address. This is the numeric-code version of a classic container hazard; ASan catches it immediately (Q13).

### Q8. What does this print?

```cpp
int steps = 100000;
int nodes = steps * steps;          // total tree nodes
std::cout << nodes << "\n";
```

`steps * steps` is `100000 * 100000 = 10,000,000,000`, which overflows a 32-bit `int` (max ~2.1e9). **Signed integer overflow is undefined behaviour** in C++ (unlike unsigned, which wraps modulo 2^n), so the standard permits anything; in practice you'll often see a wrapped garbage value like `1410065408`, but the compiler is also allowed to assume it can't happen and optimise accordingly. The fix is to use a wide enough type and compute in it: `long long nodes = (long long)steps * steps;` (cast *before* the multiply, or the multiply still happens in `int`). This exact trap bites tree/grid sizing and array index math on large problems.

### Q9. Is there a bug here? What's the value of `total`?

```cpp
double sumPayoffs(const std::vector<double>& xs) {
    double total;                   // uninitialized
    for (double x : xs) total += x;
    return total;
}
```

Yes — `total` is **read uninitialized**. A local `double` with automatic storage isn't zero-initialized; its initial value is indeterminate, and using it (`total += x` reads it first) is undefined behaviour. It may happen to be 0.0, may be garbage, may differ per run/build — the classic "works in debug, wrong in release" bug, and a silent one because it produces a plausible *number* not a crash. Fix: `double total = 0.0;`. Better still, express intent with the standard library: `return std::accumulate(xs.begin(), xs.end(), 0.0);` (note the `0.0` seed — `0` would accumulate in `int` and truncate). UBSan/valgrind flag the uninitialized read.

### Q10. Explain the static initialization order fiasco with a pricing-config example.

Non-local `static`/global objects in *different* translation units have **unspecified initialization order** across those units. If a global in a.cpp uses a global in b.cpp during its own construction, it may run before the other is constructed — reading a not-yet-initialized object, which is UB.

```cpp
// market.cpp
Calendar g_calendar = buildCalendar();          // depends on...
// config.cpp
Config g_config = loadConfig();                 // ...uses g_calendar in its ctor -> order?
```

If `g_config`'s constructor touches `g_calendar` and the linker initialised `config.cpp` first, `g_calendar` is still garbage. The standard fix is **Construct-On-First-Use**: wrap the global in a function with a local `static`, which is initialised on first call (and thread-safely since C++11):

```cpp
Calendar& calendar() {
    static Calendar c = buildCalendar();        // constructed on first use, once
    return c;
}
```

Now `config()` calling `calendar()` forces construction in dependency order. This bites real analytics libraries that lean on global default calendars/curves.

### Q11. This pricer is slow. Walk me through making it faster.

**Profile first — never guess.** Run `perf`/VTune to find where the time actually goes; the bottleneck is rarely where intuition points. Then attack in the order the data justifies:

```cpp
// Common culprit 1: virtual dispatch in the hot loop blocks inlining
for (auto& path : paths) total += payoff->eval(path);   // vtable indirection per call
```

1. **Kill virtual dispatch on the hot path** — template or CRTP the payoff/engine so `eval` inlines (see the low-latency material); a virtual call per path both indirects and prevents vectorisation.
2. **Remove allocation from the loop** — no `new`/`vector` growth per path; `reserve` buffers once and reuse them.
3. **Fix memory layout** — cache misses usually dominate numeric code; switch AoS to **SoA** so the inner loop streams contiguous doubles and the vectoriser engages.
4. **Enable the compiler** — `-O3 -march=native` for auto-vectorisation, LTO, maybe PGO.
5. **Then parallelise** — split paths across threads with per-thread RNG, reduce partial sums.

The meta-point interviewers reward: *measure, then fix the biggest thing; memory layout and dispatch usually beat clever FLOP-level tweaks, and you optimise the profiler's hotspot, not your guess.*

### Q12. Convert a virtual-dispatch payoff to CRTP to remove the vtable cost. Show both.

```cpp
// Virtual: one indirect call + no inlining per path
struct Payoff { virtual double eval(double S) const = 0; virtual ~Payoff() = default; };
struct Call : Payoff { double K; double eval(double S) const override { return std::max(S-K,0.0);} };

double priceVirtual(const Payoff& p, const std::vector<double>& terminals) {
    double s = 0; for (double S : terminals) s += p.eval(S); return s;   // vtable per element
}

// CRTP: static polymorphism, eval() inlines, loop vectorises
template <class Derived>
struct PayoffBase { double eval(double S) const { return static_cast<const Derived&>(*this).evalImpl(S); } };
struct CallC : PayoffBase<CallC> { double K; double evalImpl(double S) const { return std::max(S-K,0.0);} };

template <class P>
double priceCRTP(const P& p, const std::vector<double>& terminals) {
    double s = 0; for (double S : terminals) s += p.eval(S); return s;   // inlined, no vtable
}
```

The win: CRTP resolves the call at compile time, so `evalImpl` inlines into the loop and the optimiser can vectorise it — meaningful when you're evaluating a payoff over millions of paths. The cost: you lose runtime polymorphism (can't hold a `vector<PayoffBase*>` of mixed types) and templates bloat code / slow compiles. Use CRTP on the *hot inner* loop; keep virtual dispatch at the *cold outer* level where you genuinely need heterogeneous containers.

### Q13. How do you use sanitizers to debug a MC engine that crashes intermittently and gives non-reproducible numbers?

Match the sanitizer to the symptom. Intermittent crashes on memory smell like a heap/lifetime bug; non-reproducible numbers under threading smell like a data race.

- **ASan (AddressSanitizer)** — `-fsanitize=address`: catches out-of-bounds, use-after-free, dangling pointers (the Q7 invalidation bug). First reach for the crash.
- **UBSan** — `-fsanitize=undefined`: catches signed overflow (Q8), uninitialized-ish UB, misaligned access, bad shifts.
- **TSan (ThreadSanitizer)** — `-fsanitize=thread`: catches **data races** — e.g. threads sharing one RNG engine or accumulating into the same `sum` without synchronisation, the classic cause of non-reproducible MC results.

```
g++ -fsanitize=address,undefined -O1 -g mc.cpp && ./a.out   # memory + UB
g++ -fsanitize=thread          -O1 -g mc.cpp && ./a.out     # data races
```

For the non-reproducible numbers specifically: TSan will point at a shared RNG or shared accumulator; the fix is **per-thread RNG** (independent seeds/streams) and per-thread partial sums reduced at the end — never share one engine across threads. (Even with correct code, float non-associativity across threads can perturb the last bits; pin the reduction order if you need bit-reproducibility.)

### Q14. You benchmark a pricer and it reports 0 nanoseconds. What happened and how do you fix it?

The compiler **optimised the work away** (dead-code elimination): your result is unused, so a smart optimiser deletes the entire computation you were trying to time. Benchmarks must consume their outputs so the work can't be elided.

```cpp
// Wrong: result unused -> whole computation may be deleted -> "0 ns"
for (auto _ : state) { double p = blackScholes(S, K, r, q, vol, T).call; }

// Right: forbid the optimiser from discarding it
for (auto _ : state) {
    double p = blackScholes(S, K, r, q, vol, T).call;
    benchmark::DoNotOptimize(p);          // treat p as observed
    benchmark::ClobberMemory();           // if it writes through memory
}
```

`benchmark::DoNotOptimize` (Google Benchmark) tells the compiler the value is observed, so the code that produces it must run; `ClobberMemory` forces pending writes. The broader lesson for micro-benchmarking numeric code: also vary inputs so constant-folding can't precompute the answer, warm the cache, and run enough iterations to dominate timer noise — otherwise you measure the compiler's cleverness, not your code.

### Q15. What's the shape of a quant-dev interview and how should you approach it?

It's the **intersection of three tracks**, not any one of them: (1) **C++** — RAII, move semantics, templates, UB, "what does this print"; (2) **numerics/finance** — implement Black-Scholes/MC/a tree, compute Greeks, discuss accuracy and stability; (3) **a little maths** — enough stochastic-calculus/probability intuition to know *what* you're implementing (risk-neutral pricing, why MC error is 1/sqrt(N)). Compared to a pure-SWE loop there's less big-O algorithm trivia and more "implement this pricer correctly, now make it fast, now find its Greeks." Compared to a quant-researcher loop there's far more code.

How to approach it: **assumptions first** (European? dividends? day-count?), **correct before fast** (write the clean `double` version, then discuss cancellation, edge cases at T->0, dispatch and cache as a second pass), **narrate your reasoning** (they're buying your thought process), and **know your accuracy story** (why `double` not `float`, why money isn't a `double`, why `erfc` for N(x)). If asked to optimise, say "let me profile" before guessing. The candidates who pass make the right number *first* and then reason about performance out loud.

### Q16. Given "price this option, then give me its Greeks, then make it faster" — how do you structure your 45 minutes?

Treat it as three explicit phases and say so up front:

1. **Correctness (~15 min).** Restate assumptions, then implement Black-Scholes with `double`, `erfc`-based N(x), and the T<=0/vol<=0 guards (Q1). Sanity-check with put-call parity. Land a *right number* before anything else — this is the gate.
2. **Greeks (~15 min).** Offer both routes and let them choose: **analytic** (delta/vega/gamma fall out of d1/d2 — Q2) is exact and fast; **bump-and-revalue** is general but O(N) revaluations with a cancellation trap in the bump size; mention **AAD** as what production uses for many Greeks at once (all sensitivities in a small constant multiple of one pricing — Real-World topic). Implement the one they want, discuss the tradeoff.
3. **Performance (~15 min).** Say "measure first," then name the real levers in order: kill virtual dispatch (CRTP/templates so the payoff inlines), remove hot-path allocation (`reserve`/reuse), fix memory layout (SoA for vectorisation), enable `-O3 -march=native`, then parallelise with per-thread RNG. Note that memory layout and dispatch usually beat FLOP tweaks, and that MC accuracy needs variance reduction (1/sqrt(N)), not just more paths.

The through-line: *correct, then differentiated, then fast* — communicated out loud, with the tradeoffs named at each step. That structure itself is much of the signal.
