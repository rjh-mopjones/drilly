## How to Attack a Python Kata

### Summary

**What this topic covers**

The method for solving an open-ended Python prompt — "build a mini spreadsheet", "design an in-memory KV store with transactions", "write a middleware pipeline", "run these fetches with a concurrency cap" — from a blank file in interview time. These katas are deliberately **LLD scenarios**: small, real systems (a formula engine, a mini-Redis, a notification service, a file system) with behavioural rules, *not* "implement a decorator from scratch" drills. So the hard part is rarely an algorithm — it's **modelling the system with the right Python idiom**: does this want the data model (`__getitem__`, `__iter__`), a generator, a context manager, a decorator, `asyncio`, a `Protocol`, or `match`? The loop every Python kata runs on is: clarify the system's rules, design the class/function API, pick the idiom that makes the design fall out cleanly, write the `pytest` tests first, then implement. The senior signal is idiom *fluency* under a real scenario — reaching for `__enter__/__exit__` when the problem is "acquire/commit/rollback", for a generator when it's "stream without buffering", for a `Protocol` when it's "any object that can `send`".

**Mental model**

Python gives you an unusually rich toolbox, and picking the right tool *is* the design. The prompt's shape tells you which:
- "read/write like a container / grid / mapping" → the **data model** (`__getitem__`, `__setitem__`, `__len__`, `__contains__`).
- "process a stream without holding it all in memory" → a **generator** (`yield`, lazy, O(1) memory).
- "acquire something, then always release/commit/rollback" → a **context manager** (`with`, `__enter__/__exit__` or `@contextmanager`).
- "wrap cross-cutting behaviour around a function/handler" → a **decorator / closure** (`Handler -> Handler`).
- "do many I/O-bound things concurrently" → **asyncio** (`async`/`await`, `Semaphore`, `gather`) — never threads (the GIL).
- "any object that can do X" → a **`Protocol`** (structural typing, no base class) + the **Observer** pattern.
- "a value moving through states" → an **`Enum`** + `match`/`case` structural pattern matching.
Modern Python is also **typed** — full hints (`X | None`, `list[str]`, `Protocol`, dataclasses) are part of a senior answer, not decoration. And it's **immutable-by-preference** where it helps: frozen dataclasses + `replace` for state transitions.

**Key terms**

- **Data model / dunder methods** — `__getitem__`, `__setitem__`, `__len__`, `__contains__`, `__iter__`: make your type behave like a built-in.
- **Generator** — a function with `yield`; lazy, pull-based, O(1) memory; composes with `for` and `itertools`.
- **Context manager** — `with x:`; `__enter__`/`__exit__` (class) or `@contextmanager` (generator); guarantees cleanup.
- **Decorator / closure** — a function returning a wrapped function; `functools.wraps`/`reduce`; the composition idiom.
- **asyncio** — single-threaded cooperative concurrency for **I/O-bound** work; `await`, `Semaphore`, `gather`.
- **GIL** — one thread runs Python bytecode at a time; use `asyncio` for I/O, `multiprocessing` for CPU-bound.
- **`Protocol`** — structural (duck) typing: any object with the right methods qualifies, no inheritance.
- **`dataclass` / frozen** — declarative value types; `frozen=True` + `replace(...)` for immutable transitions.
- **`match`/`case`** — structural pattern matching (3.10+): class patterns, OR-patterns, a `case _` catch-all.
- **Type hints** — `X | None`, `list[str]`, `Callable[..., R]`, generics; a senior writes them throughout.

**Why interviewers ask this**

Python interviews probe whether you *write Python*, not Java-in-Python. A junior solves the spreadsheet with `sheet.set_cell(...)`/`sheet.get_cell(...)` methods and a hand-rolled loop; a senior makes it `sheet["A1"] = 5` via `__setitem__`, computes on read so dependents update for free, and guards cycles with a DFS visiting-set. The tell is reaching for the idiom the problem is *shaped* like — a context manager for a transaction, a generator for a stream, a `Protocol` for pluggable channels, `match` for a state machine — and backing it with full type hints and `pytest` tests. Interviewers read "models the system with idiomatic Python" as the core competence; the scenario is just the frame.

**Common confusions**

- "I'll add `get_x`/`set_x` methods" — if it's container-shaped, use the data model (`__getitem__`/`__setitem__`); it's the idiomatic API.
- "Build a list then return it" — if it's a stream, a generator is lazy and O(1) memory; don't materialise.
- "Threads for concurrency" — the GIL means threads don't speed up CPU work; use `asyncio` for I/O, `multiprocessing` for CPU.
- "A base class for the plugin interface" — a `Protocol` (structural typing) is lighter and more Pythonic than an ABC.
- "Type hints are optional" — at senior level they're part of the design and the review; write them.

**What follows from this topic**

The next topic — Testing in Python — covers the `pytest` model these katas are graded against (`def test_*`, `assert`, `pytest.raises`, `parametrize`, and testing `async` code with `asyncio.run` and no plugin). Then each kata drills one idiom under a real scenario: `spreadsheet` (data model + recursion), `kvstore` (context managers), `feedstats` (generators), `middleware` (decorators/closures), `crawler` (asyncio), `workflow` (enums + `match`), `notifier` (Protocols + Observer), `filesystem` (recursion + dunder).

### The first questions: which idiom is the system shaped like?

Turn the prompt into an idiom + an API before writing code.

- **What's the system, and what are its rules?** State them back (a cell holds a literal or a formula; a transaction commits or rolls back). The rules are your tests.
- **Which idiom does its shape call for?** Container → data model; stream → generator; acquire/release → context manager; wrap → decorator; I/O concurrency → asyncio; pluggable behaviour → Protocol; states → enum + `match`.
- **What's the class/function API?** Name the public methods and their types. Prefer dunder methods where the type is container-/value-shaped.
- **Immutable or mutable?** Frozen dataclasses + `replace` for state transitions; plain classes for stateful services.
- **Errors?** Custom exception classes (often data-carrying) raised on rule violations; `pytest.raises` in the tests.

### Design the API (idiom-first)

Write the signatures and key types first — they encode the idiom choice.

```python
class Sheet:                                    # container-shaped → the data model
    def __setitem__(self, ref: str, content: float | str) -> None: ...
    def __getitem__(self, ref: str) -> float: ...       # computed on read (lazy)
    def __contains__(self, ref: str) -> bool: ...

class CycleError(Exception): ...                # rule violation → a custom exception
```

`sheet["A1"] = "=B1+C1"` reads better than `sheet.set_cell(...)` *and* signals you think in the data model — the idiom is the design.

### Write the tests first, then implement

Tests are `pytest` — plain `def test_*` functions with `assert`, written before the bodies:

```python
def test_edit_updates_dependents():
    s = Sheet()
    s["A1"] = 10
    s["A2"] = "=A1*2"
    assert s["A2"] == 20
    s["A1"] = 100          # dependents recompute on next read (lazy)
    assert s["A2"] == 200

def test_cycle_is_rejected():
    s = Sheet(); s["A1"] = "=A1"
    with pytest.raises(CycleError):
        _ = s["A1"]
```

Order: the system's rules → edges (empty, missing, error paths) → concurrency/async where relevant (`asyncio.run` for the async kata). Then implement to green. Run one kata with `pytest solution/<kata>`. Details next.

## Testing in Python (pytest, asyncio.run — no plugin)

### Summary

**What this topic covers**

The `pytest` model these katas run on, so "write the tests first" is mechanical. `pytest` needs no boilerplate: a test is a plain `def test_*()` function using bare `assert`, discovered automatically. This topic covers that model (`assert`, `pytest.raises` for expected exceptions, `@pytest.mark.parametrize` for table cases, fixtures and a deterministic fake clock), the **write-your-own** model (the `practice/` side ships no tests — designing them is the exercise), and the one wrinkle worth knowing cold: how to test **`async`** code **without** a plugin — you call `asyncio.run(coro)` *inside* a normal `def test_*()`, so no `pytest-asyncio`, no `async def` test functions. Master these and each kata's "Write the tests" step is just picking which pattern the rules need.

**Mental model**

A `pytest` test is a function that either returns (pass) or raises `AssertionError` (fail); `pytest` rewrites `assert` so `assert got == want` prints both sides on failure — no `assertEqual` needed. Expected exceptions use `with pytest.raises(SomeError):`. Table-driven cases use `@pytest.mark.parametrize`. Determinism is the discipline: anything time-dependent takes an **injected clock** the test advances (a tiny `FakeClock`), never `time.sleep` — a sleep-based test is a flaky coin flip. For **async** code, the mental shift is that a coroutine does nothing until an event loop runs it, so the test *is* the loop entry point: `def test_x(): result = asyncio.run(the_coroutine()); assert ...`. To assert an async invariant like a concurrency cap deterministically, you don't sleep — you use an `asyncio.Event` or a shared counter with `await asyncio.sleep(0)` to force interleaving, then assert the property (max concurrent ≤ limit, results in input order). You assert the rule the system must obey, not an incidental ordering.

**Key terms**

- **`def test_*()`** — a plain function; `pytest` auto-discovers and runs it. No class or base needed.
- **bare `assert`** — `pytest` rewrites it to show both operands on failure; no `assertEqual`.
- **`pytest.raises(Exc)`** — `with pytest.raises(Exc):` asserts the block raises `Exc` (optionally `match=`).
- **`@pytest.mark.parametrize`** — table-driven: run the same test over a list of `(input, expected)` rows.
- **fixture** — a reusable setup function (`@pytest.fixture`); requested by naming it as a test param.
- **FakeClock / injected clock** — a callable the test advances, so TTL/backoff logic is deterministic (no `sleep`).
- **`asyncio.run(coro)`** — runs a coroutine to completion in a fresh event loop; the way to test `async` from a sync test.
- **`asyncio.Event` / `asyncio.sleep(0)`** — deterministic async coordination for asserting order / a concurrency cap.
- **`from . import X`** — the kata's test imports its module by relative import (each kata is a package).

**Why interviewers ask this**

Driving your own `pytest` tests shows you can pin behaviour precisely and that you know Python's testing ergonomics. Anyone writes `assert f(x) == y`; the signal is whether you test the error paths with `pytest.raises`, whether you make time deterministic with an injected clock instead of `sleep`, and — the senior tell — whether, on the async kata, you know a coroutine needs a loop, reach for `asyncio.run` in a plain test (rather than fumbling for a plugin), and can assert a concurrency cap without a race-prone sleep. That fluency reads as someone who ships tested Python, not just working-once Python.

**Common confusions**

- "I need `unittest.TestCase`/`assertEqual`" — no; `pytest` uses plain functions and bare `assert`.
- "`async def test_...`" — that just returns a coroutine `pytest` never awaits; use `def test_...` + `asyncio.run(...)`.
- "`time.sleep` to test the TTL/backoff" — flaky and slow; inject a clock the test advances by exact amounts.
- "Assert the exact order of concurrent completions" — nondeterministic; assert the invariant (order preserved by `gather`, max concurrency ≤ limit).
- "One giant test" — prefer one behaviour per test (and `parametrize` the table cases); failures then point at the exact rule.

**What follows from this topic**

Every kata's "Write the tests" card is an instance of these: `assert` + `pytest.raises` for `spreadsheet`/`workflow`/`filesystem`, a `FakeClock` for `kvstore`, generator/laziness assertions for `feedstats`, and `asyncio.run`-driven tests (with a Semaphore-cap and order-preservation invariant) for `crawler`. When a kata shows a fake clock or an `asyncio.run` test, come back here for the template.

### The behaviour test (assert, pytest.raises, parametrize)

```python
import pytest
from . import Sheet, CycleError          # each kata is a package; relative import

@pytest.mark.parametrize("formula,expected", [
    ("=1+2*3", 7.0),           # precedence
    ("=(1+2)*3", 9.0),
])
def test_precedence(formula, expected):
    s = Sheet(); s["A1"] = formula
    assert s["A1"] == expected

def test_missing_slot_raises():
    with pytest.raises(CycleError):
        s = Sheet(); s["A1"] = "=A1"; _ = s["A1"]
```

Run: `pytest solution/spreadsheet -q`, or `-k <name>` to filter.

### The async test (asyncio.run, no plugin)

A coroutine does nothing until a loop runs it, so the test is the entry point — `asyncio.run`, in a **plain** `def test_*`. Assert the invariant (order preserved, cap respected), never wall-clock timing.

```python
def test_gather_capped_respects_limit():
    current = max_seen = 0
    async def fetch(_):
        nonlocal current, max_seen
        current += 1; max_seen = max(max_seen, current)
        await asyncio.sleep(0)           # yield → force interleaving, no real delay
        current -= 1
        return None
    asyncio.run(gather_capped([fetch(u) for u in range(20)], limit=4))
    assert max_seen <= 4                 # the concurrency cap held
```

No `pytest-asyncio`, no `async def test_...`. Drive order-preservation with an `asyncio.Event` rather than sleeps so it's deterministic.

## Spreadsheet — A Formula Engine (Data Model, Lazy Recompute, Cycle Detection)

### Summary

**What this topic covers**

You build the engine behind a spreadsheet: cells addressed like `A1` each hold either a literal
number or a *formula* — `"=A1+B2*3"` — that references other cells. `sheet["A1"] = 5` writes a
cell; `sheet["C1"]` reads its **computed** value; an empty cell reads as `0.0`. Because a formula
reads other cells, editing one cell is transparently reflected in everything downstream, and a
formula that (directly or transitively) refers back to its own cell is a **circular reference** that
must be rejected rather than looped on forever. It's a compact LLD scenario that drills three
separable skills at once: the **Python data model** (`__getitem__`/`__setitem__`/`__contains__` so
the object reads and writes like the grid it models), **lazy recompute** (compute on read, so
dependents update for free), and **DFS cycle detection** over a small recursive-descent evaluator.

**Mental model**

Two design axes decide everything. First, *when* do you compute — on write (eager) or on read
(lazy)? The eager engine keeps an explicit dependency DAG and topologically re-sorts it on every
edit: fast reads, but real bookkeeping, and it must catch cycles at write time. The lazy engine
stores raw cell content and computes nothing until you read: `sheet["C1"]` evaluates C1's formula,
which recursively evaluates the cells C1 names, and so on down to literals. The payoff is that
"editing a cell updates its dependents" *falls out for free* — the dependents just re-read the new
value next time they're evaluated; there is no write-time graph to maintain. That simplicity is why
lazy-with-DFS is the model to reach for first. Second axis: the one thing lazy evaluation must
guard is a cycle. Evaluation threads the set of cells *currently being computed* down the recursion;
reach a cell already in that set and the formulas form a loop — raise `CycleError` instead of
recursing until the stack blows. That `visiting` set is exactly a depth-first-search's recursion
stack, and membership-in-stack is the textbook cycle test on a directed graph.

**Key terms**

- **`__getitem__`/`__setitem__` data model** — dunder methods that make `sheet["A1"] = 5` and
  `sheet["A1"]` work; the idiomatic subscript API, not `get`/`set` methods.
- **lazy recompute on read** — cells store *raw content*; values are computed when read, so
  dependents reflect edits automatically with no write-time dependency graph.
- **DFS cycle detection** — carry a `visiting` set of cells currently on the evaluation stack; a
  reference into that set is a back-edge → cycle.
- **recursive-descent precedence** — `expr → term → factor` gives `* /` binding tighter than `+ -`
  without a precedence table or shunting-yard.
- **`CycleError`** — the domain exception raised on a circular reference, so callers distinguish it
  from a generic `RecursionError` or `ValueError`.
- **cells as literals-or-formulas** — one cell dict maps `ref → float | str`; a leading `=` marks a
  formula string, everything else is a stored number.

**Why interviewers ask this**

It's a clean separator of "can wire up a container" from "can design an evaluation model." A junior
reaches for `get`/`set` methods, eagerly recomputes a whole grid on every write, and either forgets
cycles or catches them with a bare recursion-depth guard. A senior states the eager-vs-lazy
trade-off unprompted, picks lazy *because* it deletes the write-time DAG, and can point to the exact
line — the `visiting` set threaded through recursion — that turns an infinite loop into a clean
`CycleError`. It also probes idiomatic Python (the data model), a tiny parser (recursive descent,
which many people have never written by hand), and edge-case discipline (empty cell reads as zero,
lower-case ref rejected, `bool` is an `int` subclass). Lots of surface, little code.

**Common confusions**

- *"I need a dependency graph to make dependents update."* — Not if you compute on read. The graph
  is implicit in the recursion; edits are visible on the next read for free.
- *"Catch the cycle with a recursion-depth limit."* — That catches deep chains and legitimate deep
  nesting alike, and only after wasted work. A `visiting`-set membership check is exact.
- *"Precedence needs a table / operator-precedence parser."* — Two grammar levels (`term` inside
  `expr`) express `*//` before `+/-` with plain recursion.
- *"Store the computed value in the cell."* — Then you're back to invalidation and a write-time
  graph. Store *raw content*; recompute on read.
- *"`isinstance(x, int)` is a fine number check."* — `True`/`False` are `int`s; they'd silently
  become `1.0`/`0.0`. Reject `bool` explicitly.

**What follows from this topic**

The lazy-recompute + DFS pattern generalises to any pull-based reactive system (build systems,
signal graphs, cached derivations). The natural extensions turn it into a bigger kata: add
parentheses and functions (`=SUM(A1:A3)`) to grow the grammar, or flip to an **eager** engine with
an explicit dependency DAG and topological recompute that catches cycles at *write* time — the same
problem from the other end, and a direct lead-in to graph topological-sort katas. Memoising a
computed value (and invalidating dependents on write) is the bridge from the simple lazy model to a
real incremental engine.

### Clarify & design the API

Questions worth asking out loud: is the API subscript-style (`sheet["A1"]`) or method-style — i.e.
should this emulate a container (yes: `__getitem__`/`__setitem__`)? What does reading an unset cell
return — error or zero (kata: `0.0`, so formulas over sparse grids just work)? Are values integer or
float (float — division must not truncate)? Which operators, and what precedence (`+ - * /`, normal
`*//` over `+/-`)? Do we recompute on write or on read? And when a formula loops, do we raise a
*typed* error the caller can catch (yes — `CycleError`, not a bare `RecursionError`)?

The **compute-on-read decision** is the design. Store each cell's *raw content* — a `float` for a
literal, the `=…` string for a formula — and compute nothing until `__getitem__`. Reading a formula
recursively reads the cells it names; so "dependents reflect edits" needs no write-time graph.

```python
class CycleError(Exception):
    """Raised when a formula depends on itself, directly or transitively."""


class Sheet:
    """A grid of cells, each a literal number or a ``=formula`` string."""

    def __setitem__(self, ref: str, content: float | int | str) -> None:
        ...   # validate ref; store float literal, or =formula string

    def __getitem__(self, ref: str) -> float:
        ...   # compute on read: evaluate the cell's formula recursively

    def __contains__(self, ref: str) -> bool:
        ...   # has this cell ever been set?
```

Say the trade-off explicitly: the eager alternative keeps a dependency DAG and topologically
recomputes on every write — faster reads, more bookkeeping, cycle-check at write time. Lazy-with-DFS
stores raw content and recomputes on read: simpler, and the dependency structure lives in the call
stack. Volunteering that comparison, then choosing lazy for its simplicity, *is* the senior signal.

### Write the tests

The README ships **no tests** — designing them is the exercise. Cover the four axes in order:
storage (literals + empty cells), evaluation (formula reads other cells, precedence,
division/subtraction), reactivity (dependents update on edit, transitively), and the two failure
shapes (direct + indirect cycle → `CycleError`, bad ref → `ValueError`). Use plain `def test_*`
functions and `pytest.raises`; no fixtures or config needed.

```python
import pytest

from . import CycleError, Sheet


def test_literal_and_empty_cells():
    s = Sheet()
    s["A1"] = 5
    assert s["A1"] == 5.0
    assert s["Z9"] == 0.0  # empty cell reads as zero


def test_formula_reads_other_cells():
    s = Sheet()
    s["A1"] = 2
    s["A2"] = 3
    s["A3"] = "=A1+A2"
    assert s["A3"] == 5.0


def test_operator_precedence():
    s = Sheet()
    s["A1"] = 2
    s["A2"] = 3
    s["B1"] = "=A1+A2*4"  # 2 + 12, not (2+3)*4
    assert s["B1"] == 14.0


def test_changing_a_cell_updates_dependents():
    s = Sheet()
    s["A1"] = 10
    s["A2"] = "=A1*2"
    assert s["A2"] == 20.0
    s["A1"] = 100  # dependents reflect the new value on next read — no rewrite of A2
    assert s["A2"] == 200.0


def test_transitive_dependencies():
    s = Sheet()
    s["A1"] = 1
    s["A2"] = "=A1+1"
    s["A3"] = "=A2+1"  # A3 -> A2 -> A1, all lazy
    assert s["A3"] == 3.0


def test_direct_cycle_is_rejected():
    s = Sheet()
    s["A1"] = "=A1+1"
    with pytest.raises(CycleError):
        _ = s["A1"]


def test_indirect_cycle_is_rejected():
    s = Sheet()
    s["A1"] = "=B1"
    s["B1"] = "=A1"  # A1 -> B1 -> A1
    with pytest.raises(CycleError):
        _ = s["A1"]


def test_bad_reference_rejected():
    s = Sheet()
    with pytest.raises(ValueError):
        s["a1"] = 5  # lower-case is not a valid ref
```

Run with `cd python-katas && .venv/bin/pytest practice/spreadsheet` (or `solution/spreadsheet` for
the reference). The two cycle tests are the ones that matter: without the `visiting` guard,
`test_direct_cycle` doesn't fail an assert — it recurses until Python raises `RecursionError`, which
is *not* `CycleError`, so the test still fails and points straight at the missing guard.

### Implement it

Store raw content per cell (`float` or the `=…` string). `_value(ref, visiting)` is the recursive
core: it short-circuits on a ref already in `visiting` (the cycle guard), returns `0.0` for an unset
cell, returns a stored literal directly, and otherwise evaluates the formula body with `ref` *added*
to `visiting`. Precedence comes from a two-level recursive-descent `_eval` — `expr` loops over
`+ -`, `term` loops over `* /`, `factor` is a number or a (recursive) cell read.

```python
import re

_REF = re.compile(r"^[A-Z]+[0-9]+$")
_TOKEN = re.compile(r"\s*(?:(?P<num>\d+(?:\.\d+)?)|(?P<ref>[A-Z]+[0-9]+)|(?P<op>[+\-*/]))")


class Sheet:
    def __init__(self) -> None:
        self._cells: dict[str, float | str] = {}

    def __setitem__(self, ref: str, content: float | int | str) -> None:
        if not _REF.match(ref):
            raise ValueError(f"bad cell reference: {ref!r}")
        if isinstance(content, bool):  # bool is an int subclass — reject to avoid surprises
            raise TypeError("cell content must be a number or a formula string")
        if isinstance(content, (int, float)):
            self._cells[ref] = float(content)
        elif isinstance(content, str) and content.startswith("="):
            self._cells[ref] = content
        else:
            raise ValueError(f"cell content must be a number or a =formula, got {content!r}")

    def __getitem__(self, ref: str) -> float:
        return self._value(ref, frozenset())

    def __contains__(self, ref: str) -> bool:
        return ref in self._cells

    def _value(self, ref: str, visiting: frozenset[str]) -> float:
        if ref in visiting:                       # back-edge on the eval stack → cycle
            raise CycleError(f"circular reference through {ref}")
        content = self._cells.get(ref)
        if content is None:
            return 0.0                            # empty cell reads as zero
        if isinstance(content, float):
            return content                        # literal
        return self._eval(content[1:], visiting | {ref})   # formula, ref now "in progress"

    # grammar: expr := term (('+'|'-') term)* ; term := factor (('*'|'/') factor)*
    def _eval(self, formula: str, visiting: frozenset[str]) -> float:
        tokens = self._tokenize(formula)
        pos = 0

        def expr() -> float:
            nonlocal pos
            value = term()
            while pos < len(tokens) and tokens[pos] in ("+", "-"):
                op = tokens[pos]; pos += 1
                rhs = term()
                value = value + rhs if op == "+" else value - rhs
            return value

        def term() -> float:
            nonlocal pos
            value = factor()
            while pos < len(tokens) and tokens[pos] in ("*", "/"):
                op = tokens[pos]; pos += 1
                rhs = factor()
                value = value * rhs if op == "*" else value / rhs
            return value

        def factor() -> float:
            nonlocal pos
            tok = tokens[pos]; pos += 1
            if _REF.match(tok):
                return self._value(tok, visiting)   # recurse — visiting carries down
            return float(tok)

        return expr()
```

The key gotcha is that you **compute on read**, so dependents update for free: nothing caches a
value and nothing tracks who-depends-on-whom. Editing `A1` just replaces its raw content in
`self._cells`; any formula that names `A1` picks up the new number the *next* time it's read, because
reading re-runs `_value("A1", …)` from scratch. That's the whole reason there's no write-time DAG.
The **DFS `visiting` set is the cycle guard**: it's a `frozenset` (so `visiting | {ref}` yields a new
set for the deeper call and the caller's set is untouched — clean backtracking with no manual
pop), and a reference into it is a back-edge, caught before it can recurse forever. And
`__getitem__`/`__setitem__` are what make it read and write like the grid it models
(`sheet["A1"] = 5`) — the idiomatic Python container API, not `get`/`set` methods bolted on the side.

### Common mistakes & senior signal

- **Eagerly recomputing the grid on every write.** Building and re-sorting a dependency DAG on each
  edit is more code and more bugs than the kata needs. **Senior signal** — reaches for lazy
  compute-on-read first, names the eager DAG as the faster-read / more-bookkeeping alternative, and
  says *why* lazy wins here.
- **Guarding cycles with a recursion-depth limit instead of a visiting set.** A depth limit trips on
  legitimate deep chains and only after wasted work, and surfaces as `RecursionError`, not a typed
  error. **Senior signal** — threads an explicit `visiting` set (the DFS recursion stack) and raises
  a domain `CycleError` callers can catch.
- **Storing the computed value in the cell.** Caching the number reintroduces invalidation and a
  who-depends-on-whom graph — the exact complexity lazy eval avoids. **Senior signal** — stores raw
  content only; treats the value as always-derived.
- **`get`/`set` methods instead of the data model.** Works, but isn't idiomatic and misses the point
  of the exercise. **Senior signal** — implements `__getitem__`/`__setitem__`/`__contains__` so the
  object behaves like the grid it represents.
- **`isinstance(content, int)` letting `bool` through.** `True`/`False` are `int`s and would store as
  `1.0`/`0.0`. **Senior signal** — rejects `bool` explicitly and normalises numbers to `float` so
  division never truncates.
- **A precedence table or shunting-yard for four operators.** Over-engineered. **Senior signal** —
  expresses precedence structurally with a two-level `expr`/`term`/`factor` recursive descent.

Extensions that show depth: add parentheses and range functions (`=SUM(A1:A3)`) to grow the grammar;
memoise computed values with dependent invalidation; or flip to an **eager** engine with an explicit
dependency DAG, topological recompute on write, and cycle detection at write time — the same problem
approached from the other end.

## Key-Value Store — A Mini-Redis with TTL & Transactions

### Summary

**What this topic covers**

You build the engine behind a process-local key-value store — the kind of thing that backs a cache
sidecar or a feature-flag service. The API is deliberately tiny: `set`/`get`/`delete` over string
keys. Two features drag it past a plain `dict`: a key can carry a **TTL** and vanish after it, and a
block of writes can be grouped into a **transaction** that either commits as a whole or leaves the
store untouched. The signature Python topics it drills are the two idioms for **context managers**
(`__enter__`/`__exit__` vs `@contextmanager`), the **unit-of-work** buffer-then-commit pattern, and
Python's **container dunders** (`__len__`, `__contains__`) — all wired to an **injected clock** so
time is deterministic instead of slept-through.

**Mental model**

Two independent ideas, each with a small twist. The first is *lazy expiry*: a key has an absolute
deadline, and you never run a background sweeper to reap it — you check the deadline the moment the
key is *touched* (`get`, `in`, `len`) and prune it on the way past. Idle keys cost nothing; a large
TTL'd key nobody reads again lingers until touched. The second is a *transaction as a unit of work*:
`transaction()` is a context manager that, while open, does **not** mutate the live store. Writes are
queued into a side buffer; on a clean exit the buffer is replayed atomically, and on an exception the
buffer is dropped and the store is exactly as it was — with the exception left to propagate. This is
Redis `MULTI`/`EXEC`: commands are queued while the transaction is open and only take effect on
`EXEC`, so reads *inside* the block see committed state, never the pending buffer. The whole kata
lives in getting those two twists right: prune-on-access, and buffer-then-commit-or-rollback.

**Key terms**

- **context managers — `__enter__`/`__exit__` vs `@contextmanager`** — the two idioms for `with`. A
  class implements the protocol directly; the `contextlib` decorator turns a generator into one
  (setup before `yield`, teardown after). Both work here; pick one and know the other.
- **unit-of-work (buffer-then-commit)** — don't touch the live store while the transaction is open;
  record pending writes in a side buffer and replay them atomically on clean exit.
- **`__exit__` returning `False` to propagate** — `__exit__` returns falsy ⇒ any in-flight exception
  keeps propagating; returning `True` *swallows* it. In the generator form, *not* re-raising is the
  same silent-swallow bug.
- **lazy TTL expiry** — a key's deadline is checked when the key is accessed, and the expired entry
  is pruned then; no background thread. The opposite is *active* expiry (a sweeper / random sampling).
- **injected clock** — time comes from a `Callable[[], float]` (default `time.monotonic`), so tests
  advance a fake clock instead of sleeping, and monotonic time can't jump backwards on an NTP step.
- **dunder container protocol — `__len__` / `__contains__`** — implementing them makes `len(kv)` and
  `key in kv` work, and lets both honour expiry (count/see only *live* keys).

**Why interviewers ask this**

It's a compact low-level-design question that reads a candidate on two axes at once: do you reach for
the *right Python idiom* for a job (a context manager for a scoped unit of work, container dunders for
`len`/`in`), and do you *design the semantics* rather than the syntax (what does a read see mid-
transaction? when exactly does a TTL fire? what happens to the store on a raise?). A junior writes a
`dict` wrapper and bolts TTL on with a timer thread. A senior states the buffer-then-commit design
unprompted, names both context-manager forms and why they'd pick one, insists `__exit__` must not
swallow the exception, and defends lazy expiry over a sweeper with the memory trade-off — then writes
a *deterministic* test with a fake clock instead of `time.sleep`.

**Common confusions**

- *"A `with` block that raises should be caught by the context manager."* — No. `transaction()`
  rolls the store back but must **re-raise**; returning `True` from `__exit__` (or not re-raising in
  the generator) silently eats the caller's error.
- *"Reads inside the transaction see my buffered writes."* — No — that's the point of `MULTI`. Reads
  see committed state; the buffer is invisible until commit.
- *"TTL needs a background thread."* — Not for an in-process store. Lazy prune-on-access is simpler
  and free when idle; a sweeper only earns its keep when memory reclaim latency matters.
- *"`len(kv)` can just be `len(self._data)`."* — That counts expired-but-not-yet-pruned keys. `len`
  and `in` must filter through the same liveness check `get` uses.

**What follows from this topic**

Buffer-then-commit is the seed of real transactional storage: the extension to **nested transactions
with savepoints** is where the class-based `__enter__`/`__exit__` form (which carries per-level state
naturally) beats the generator, and **pub/sub on key changes** turns the store into an event source.
The context-manager muscle carries straight into resource management (files, locks, DB sessions,
`ExitStack`), and lazy-vs-active reclaim is the same trade-off you meet in cache eviction and GC.

### Clarify & design the API

Clarifying questions worth asking out loud: is `get` on a missing key an error or `None` (kata:
`None`)? Does `delete` report whether it removed something (yes — returns a `bool`)? What does a read
*inside* a transaction see — the buffer or committed state (committed, Redis `MULTI`-style)? Is expiry
lazy or swept (lazy — prune on access)? Are nested transactions in scope (no — reject them; savepoints
are the extension)? Wall-clock or monotonic time (monotonic, and injected so tests are deterministic)?

The **design decision** is the transaction. A transaction is a *unit of work*: while it's open, writes
don't touch the live store — they land in a pending buffer keyed by key, recording either a `set`
(value + ttl) or a `delete`. On a clean exit the buffer is replayed atomically; on an exception it's
discarded and the exception propagates. Because writes are buffered, a `get` inside the block reads the
live store and therefore sees pre-transaction state — exactly `MULTI`/`EXEC`. TTL is orthogonal and
lazy: `set` stamps an **absolute deadline** (`clock() + ttl`), and every accessor funnels through one
liveness check that prunes an expired entry and reports it absent.

```python
from collections.abc import Callable, Iterator
from contextlib import contextmanager
import time

class KVStore:
    """In-memory key-value store with per-key TTL and buffered transactions."""

    def __init__(self, clock: Callable[[], float] = time.monotonic) -> None: ...

    def set(self, key: str, value: object, ttl: float | None = None) -> None: ...
    def get(self, key: str) -> object | None: ...          # None if missing or expired
    def delete(self, key: str) -> bool: ...                # True iff it was present & live

    def __contains__(self, key: str) -> bool: ...          # honours expiry
    def __len__(self) -> int: ...                          # counts live keys only

    @contextmanager
    def transaction(self) -> Iterator[None]: ...           # buffer -> commit / rollback
```

Say the trade-off explicitly: buffering into a side dict keyed by key means later writes to the same
key in one transaction naturally overwrite earlier ones, and commit is a single deterministic replay.
Lazy expiry means no timer machinery, at the cost of dead keys lingering until touched — the sane
default for an in-process store. Choosing to make `get` inside a transaction return *committed* state
is a semantic decision you should volunteer, not stumble into.

### Write the tests

The README ships **no tests** — writing them is the exercise, and it's where you prove you understand
the semantics rather than the syntax. Use a deterministic `FakeClock` you `advance` by hand — never
`time.sleep`, which makes TTL tests slow and flaky. Cover the plain contract, then TTL through *all
three* accessors (`get`, `in`, `len`), then the three transaction behaviours that actually pin the
design: atomic commit, rollback-and-reraise, and buffer-invisibility mid-block.

```python
import pytest
from kvstore import KVStore


class FakeClock:
    """Deterministic monotonic clock; advance() moves it, __call__ reads it."""

    def __init__(self, t: float = 0.0) -> None:
        self.t = t

    def advance(self, dt: float) -> None:
        self.t += dt

    def __call__(self) -> float:
        return self.t


def test_set_get_delete_and_missing():
    kv = KVStore()
    kv.set("a", 1)
    assert kv.get("a") == 1
    assert kv.get("missing") is None
    assert kv.delete("a") is True
    assert kv.get("a") is None
    assert kv.delete("a") is False          # already gone


def test_ttl_expires_on_get():
    clock = FakeClock()
    kv = KVStore(clock=clock)
    kv.set("session", "token", ttl=10)
    assert kv.get("session") == "token"
    clock.advance(10)                       # deadline reached; >= is expired
    assert kv.get("session") is None


def test_ttl_reflected_in_len_and_contains():
    clock = FakeClock()
    kv = KVStore(clock=clock)
    kv.set("a", 1, ttl=5)
    kv.set("b", 2)                          # no ttl -> permanent
    assert len(kv) == 2
    clock.advance(6)
    assert "a" not in kv
    assert len(kv) == 1                     # expired key not counted


def test_transaction_commits_atomically():
    kv = KVStore()
    kv.set("existing", 0)
    with kv.transaction():
        kv.set("a", 1)
        kv.set("b", 2)
        kv.delete("existing")
    assert kv.get("a") == 1
    assert kv.get("b") == 2
    assert kv.get("existing") is None       # all applied together on clean exit


def test_transaction_rolls_back_on_exception_and_reraises():
    kv = KVStore()
    kv.set("keep", "original")
    with pytest.raises(ValueError, match="boom"), kv.transaction():
        kv.set("keep", "changed")
        kv.set("new", 99)
        raise ValueError("boom")
    assert kv.get("keep") == "original"     # none of the buffered writes applied
    assert kv.get("new") is None            # ...and the exception propagated


def test_buffered_writes_not_visible_inside_block():
    kv = KVStore()
    kv.set("k", "committed")
    with kv.transaction():
        kv.set("k", "buffered")
        assert kv.get("k") == "committed"   # read sees pre-transaction state
        kv.set("fresh", 1)
        assert kv.get("fresh") is None      # buffer is invisible until commit
    assert kv.get("k") == "buffered"
    assert kv.get("fresh") == 1
```

Run with `pytest`. Two tests carry the design: the rollback test uses `pytest.raises` to assert the
exception *both* reverts the store *and* escapes the `with` (a manager that swallowed it would fail
here), and the buffer-invisibility test pins the `MULTI` semantics — the write inside the block is
still not readable until the block exits.

### Implement it

Two absolute-deadline slots and one pending buffer. Every read routes through a single `_live_entry`
helper that prunes on expiry, so `get`, `__contains__`, and `__len__` share one liveness definition.
`set`/`delete` check whether a transaction is open: if so they record into `_pending` instead of
mutating; otherwise they hit the store directly. `transaction()` is a `@contextmanager` whose
`try/except/else` *is* the commit-or-rollback.

```python
from __future__ import annotations
import time
from collections.abc import Callable, Iterator
from contextlib import contextmanager


class KVStore:
    def __init__(self, clock: Callable[[], float] = time.monotonic) -> None:
        self._clock = clock
        self._data: dict[str, tuple[object, float | None]] = {}   # value, abs deadline
        self._pending: dict[str, tuple[object, ...]] | None = None  # buffer while open

    def set(self, key: str, value: object, ttl: float | None = None) -> None:
        if self._pending is not None:
            self._pending[key] = ("set", value, ttl)              # queue, don't apply
            return
        self._store(key, value, ttl)

    def get(self, key: str) -> object | None:
        entry = self._live_entry(key)
        return None if entry is None else entry[0]

    def delete(self, key: str) -> bool:
        if self._pending is not None:
            existed = self._live_entry(key) is not None
            self._pending[key] = ("del",)
            return existed
        if self._live_entry(key) is None:
            return False
        del self._data[key]
        return True

    def __contains__(self, key: str) -> bool:
        return self._live_entry(key) is not None

    def __len__(self) -> int:                                     # prune, then count survivors
        return sum(1 for k in list(self._data) if self._live_entry(k) is not None)

    @contextmanager
    def transaction(self) -> Iterator[None]:
        if self._pending is not None:
            raise RuntimeError("nested transactions are not supported")
        self._pending = {}
        try:
            yield
        except BaseException:
            self._pending = None                                  # rollback: drop buffer,
            raise                                                 # re-raise (== __exit__ False)
        else:
            buffered, self._pending = self._pending, None
            self._commit(buffered)                                # atomic replay on clean exit

    def _commit(self, buffered: dict[str, tuple[object, ...]]) -> None:
        for key, op in buffered.items():
            if op[0] == "set":
                self._store(key, op[1], op[2])                    # type: ignore[misc]
            else:
                self._data.pop(key, None)

    def _store(self, key: str, value: object, ttl: float | None) -> None:
        deadline = None if ttl is None else self._clock() + ttl   # absolute deadline
        self._data[key] = (value, deadline)

    def _live_entry(self, key: str) -> tuple[object, float | None] | None:
        entry = self._data.get(key)
        if entry is None:
            return None
        _, deadline = entry
        if deadline is not None and self._clock() >= deadline:
            del self._data[key]                                   # lazy prune on access
            return None
        return entry
```

The headline gotcha is the two context-manager forms and why the design is buffer-then-commit. This
uses the `@contextmanager` generator: setup before `yield` opens the buffer, the `try/except/else`
after it *is* the teardown — `else` runs only on a clean exit (commit), `except` runs on a raise
(discard + re-raise). That `raise` is load-bearing: it's the generator analog of `__exit__` returning
`False`. A class version would read `def __exit__(self, exc_type, exc, tb): ...; return False` — the
`return False` (equivalently, no `return`) lets the exception propagate, and returning `True` is the
classic bug that silently eats the caller's error. Reach for the *class* form only when the manager
must carry state or nest (savepoints); the generator is cleaner when commit/rollback is linear like
this. The other gotcha is lazy vs active expiry: `_live_entry` prunes *on access*, so there's no timer
thread and idle keys are free — but a big TTL'd key nobody reads again sits in `_data` until touched.
Active expiry (a sweeper or Redis-style random sampling) reclaims sooner at the cost of machinery;
real Redis does both. For an in-process store, lazy alone is the right default — and storing an
*absolute* deadline (`clock() + ttl`) at write time, not a duration, is what makes the check a plain
comparison against the injected clock.

### Common mistakes & senior signal

The README's headline trap: **a context manager that catches the caller's exception.** Rolling back
is right; swallowing the error is a bug. Say `__exit__` must return falsy (or the generator must
re-raise) unprompted.

- **Swallowing the exception on rollback.** Returning `True` from `__exit__`, or catching without
  re-raising in the generator, reverts the store *and* hides the failure — the caller thinks it
  succeeded. **Senior signal** — states that rollback and propagation are separate obligations, and
  the rollback test asserts *both* (state reverted *and* the exception escapes via `pytest.raises`).
- **Applying transaction writes to the live store.** Mutating `_data` inside the block and undoing on
  error is fragile (partial state on a crash mid-undo) and leaks the buffer to concurrent readers.
  **Senior signal** — buffers first and commits once, so an abort is a no-op, not an unwind.
- **Letting reads see the buffer mid-transaction.** Serving pending writes from `get` breaks the
  `MULTI` contract callers rely on. **Senior signal** — knows reads see committed state and can name
  the Redis semantics they're matching.
- **`len`/`in` bypassing the liveness check.** `len(self._data)` and `key in self._data` count
  expired-but-unpruned keys, so `len` disagrees with `get`. **Senior signal** — funnels every
  accessor through one `_live_entry` so expiry has a single definition.
- **Storing a duration or a `time.sleep`-driven TTL.** Relative TTLs and wall-clock sleeps make
  behaviour timing-dependent and tests flaky. **Senior signal** — stamps an absolute deadline from an
  injected monotonic clock and advances a `FakeClock` in tests, never sleeps.

Extensions that show depth: **pub/sub** (subscribe to key changes, publish on `set`/`delete`); or
**nested transactions with savepoints** — an inner `transaction()` that rolls back to its own start
without aborting the outer one, where the class-based `__enter__`/`__exit__` form carries the
per-level state more naturally than the generator.

## Market-Data Stream Aggregator — Lazy Generators

### Summary

**What this topic covers**

You build the aggregator that sits between a live market-data feed and everything downstream. The feed emits an unbounded stream of trade **ticks** — one per print on the tape, each a `(ts, price, qty)` — and nobody charts raw ticks. They chart **bars**: the open/high/low/close, the volume, and the volume-weighted average price (VWAP) over each fixed window (one minute, five seconds, an hour). Your `bars(ticks, period)` turns the tick firehose into a bar stream, emitting each bar the instant it is complete and holding only the bar it is currently building. The signature Python topic it drills is the **generator**: `yield`, lazy pull-based evaluation, and the discipline of a one-item-look-ahead state machine that runs in O(1) memory over an unbounded input.

**Mental model**

A junior writes `def bars(...)` that appends to a `result` list and returns it. That forces the *entire* feed to be read before the first bar comes back — impossible on an unbounded stream and wasteful on a finite one (the whole session sits in RAM). A generator inverts control: `bars` is a coroutine that computes each bar, `yield`s it, and *suspends* until the consumer pulls the next one. Memory is O(1) in the number of ticks — only the in-progress bar's running aggregates are alive — and it composes with `for`, `itertools`, and an `islice`-style *take* for free. The subtlety is knowing when a bar is *done*: a bar for window `W` is complete only once a tick belonging to a **later** window arrives — and that same tick is both the flush signal for `W` and the first tick of the next bar. So the generator is a small state machine with **one tick of look-ahead**: accumulate into the current window's running OHLC, volume, and the two VWAP sums (`Σ price·qty` and `Σ qty`); when a tick crosses the boundary, `yield` the finished bar and re-seed from that tick; when the stream ends, `yield` the final partial bar. No look-ahead buffer, no list of ticks — just the running totals plus the one boundary tick.

**Key terms**

- **generators / `yield`** — a function containing `yield` returns an iterator; each `yield` produces a value and suspends the frame, resuming on the next `next()`.
- **lazy pull-based evaluation** — nothing runs until the consumer pulls; work happens on demand, one bar at a time, at minimum latency.
- **O(1) memory vs building a list** — the whole game: a `return [...]` buffers every bar (and forces reading all ticks first); a generator holds only the current bar's accumulators.
- **one-item look-ahead state machine** — a bar closes only when the *next* window's first tick appears; that tick both flushes the old bar and seeds the new one.
- **OHLC + VWAP** — open=first price, high=max, low=min, close=last, volume=`Σ qty`, `vwap = Σ(price·qty) / Σ qty` over the window.
- **`Iterable` / `Iterator`** — the input is any `Iterable[Tick]` (list, file, socket, another generator); the output is an `Iterator[Bar]`. Program to the protocol, not the concrete type.
- **itertools composition** — because the output is a lazy iterator it chains with `islice` (take N bars), `groupby` (per-symbol), `takewhile`, etc., all still lazy.

**Why interviewers ask this**

It separates people who reach for a list because it "works on my test array" from people who see that the input is a *stream* and design for it. A junior returns `list`, reads the whole feed, and never notices the design collapses on an unbounded source. A senior states the contract precisely — lazy, pull-based, O(1) memory, yields on completion — then writes the look-ahead state machine, remembers to flush the tail after the loop, and *proves laziness with a test* (a generator input that raises if fully consumed, asserting `next(bars(...))` returns the first bar without tripping it). It is also a clean lens on the iterator protocol, on `itertools` composition, and on the money stakes: VWAP is an execution benchmark, so a mis-windowed or mis-weighted bar misprices every fill scored against it.

**Common confusions**

- *"A generator and a list are interchangeable, just pick one."* — No. A list evaluates eagerly and buffers everything; on an unbounded feed only the generator terminates and stays O(1).
- *"`ValueError` on bad `period` fires when I call `bars(...)`."* — No. A generator defers its *entire* body until first `next()`, so the guard doesn't run until you drive it. Test it with `next(...)`, not the bare call.
- *"I'll flush a bar every time the window changes."* — That misses the **last** window, which never sees a later tick. You must `yield` the in-progress bar after the loop.
- *"VWAP is just the average price."* — It's quantity-weighted: `Σ(price·qty)/Σ qty`. 10@2 and 20@1 is `40/3 ≈ 13.3`, not `15`.

**What follows from this topic**

This is the anchor for every streaming aggregation in Python: `itertools` pipelines, `groupby` over sorted keys, generator delegation with `yield from`, and coroutine-style backpressure. The natural extensions push straight into it — aggregate a **multi-symbol** feed by keying windows per symbol with `itertools.groupby`, or stack a **rolling-VWAP** generator on top of `bars` (a sliding N-bar VWAP that consumes the bar stream lazily, O(N) memory). From here the road runs to `async` generators over real sockets and to the same lazy-pipeline discipline in data-processing frameworks.

### Clarify & design the API

Clarifying questions worth asking out loud: do ticks arrive **time-ordered** (yes — the windowing relies on it, so a boundary crossing is monotonic)? Is the input possibly **unbounded** (yes — that's what forbids a list)? Are windows aligned to epoch or to the first tick (epoch: `start = (ts // period) * period`, so a 60s bar always starts on a minute boundary)? What about a window with **no ticks** — do we emit an empty bar (no — we only emit windows that saw at least one print; gaps are simply absent)? Surface `period <= 0` as a `ValueError` or clamp it (kata: raise)?

The **return-type decision is the design.** Because the source is a stream, `bars` must be a **generator** (`Iterator[Bar]`), never a function returning `list[Bar]`. That single choice buys laziness (compute-on-pull, minimum latency), O(1) memory (only the in-progress bar's accumulators live), and free composition with `for` / `itertools` / `islice`. The domain types are frozen dataclasses so bars are hashable, comparable, and safe to pass around.

```python
from __future__ import annotations
from collections.abc import Iterable, Iterator
from dataclasses import dataclass

@dataclass(frozen=True)
class Tick:               # provided verbatim — one trade print off the tape
    ts: int               # seconds
    price: float
    qty: int

@dataclass(frozen=True)
class Bar:                # provided verbatim — one window's aggregate
    start: int            # window start = (ts // period) * period
    open: float
    high: float
    low: float
    close: float
    volume: int
    vwap: float           # sum(price*qty) / sum(qty) over the window

def bars(ticks: Iterable[Tick], period: int) -> Iterator[Bar]:
    """Aggregate a time-ordered tick stream into fixed-`period` OHLC+VWAP bars, lazily.

    Yields each completed bar as soon as a tick from a later window arrives, then flushes the
    final (possibly partial) bar at end of stream. Holds only the in-progress bar's running
    totals — O(1) in the number of ticks. Raises ValueError if period <= 0; empty input yields none.
    """
```

Say the tradeoff explicitly: `return [...]` is one line shorter and fine for a fixture array, but it evaluates eagerly, buffers the whole session, and *cannot terminate* on a live feed. Choosing the generator — and naming the O(1)-memory / minimum-latency reason — is the senior signal.

### Write the tests

The README ships **no tests** — designing them is the exercise. Pin the contract first, then the VWAP weighting, then the two properties that actually separate a real generator from a list-builder: **laziness** and **the flushed tail**.

```python
from collections.abc import Iterator
import pytest
from feedstats import Bar, Tick, bars

def test_single_window_ohlc_and_vwap():
    ticks = [Tick(0, 10.0, 1), Tick(1, 14.0, 2), Tick(2, 8.0, 1), Tick(3, 12.0, 1)]
    (bar,) = list(bars(ticks, period=60))          # all in one 60s window
    assert bar.start == 0
    assert (bar.open, bar.high, bar.low, bar.close) == (10.0, 14.0, 8.0, 12.0)
    assert bar.volume == 5
    # Σ price·qty = 10 + 28 + 8 + 12 = 58 ; Σ qty = 5
    assert bar.vwap == pytest.approx(58.0 / 5)

def test_splits_into_windows_by_timestamp():
    ticks = [Tick(0, 10.0, 1), Tick(59, 11.0, 1), Tick(60, 20.0, 1), Tick(125, 30.0, 1)]
    out = list(bars(ticks, period=60))
    assert [b.start for b in out] == [0, 60, 120]   # windows keyed by ts // period

def test_open_first_close_last_high_max_low_min():
    ticks = [Tick(0, 5.0, 1), Tick(1, 9.0, 1), Tick(2, 3.0, 1), Tick(3, 7.0, 1)]
    (bar,) = list(bars(ticks, period=60))
    assert (bar.open, bar.close, bar.high, bar.low) == (5.0, 7.0, 9.0, 3.0)

def test_vwap_weights_by_quantity():
    # 10 @ 2 and 20 @ 1 -> (10*2 + 20*1) / (2 + 1) = 40 / 3, NOT the 15 unweighted mean
    ticks = [Tick(0, 10.0, 2), Tick(1, 20.0, 1)]
    (bar,) = list(bars(ticks, period=60))
    assert bar.vwap == pytest.approx(40.0 / 3)
    assert bar.volume == 3

def test_final_partial_bar_is_flushed():
    ticks = [Tick(0, 10.0, 1), Tick(60, 20.0, 1)]   # second window never sees a later tick
    out = list(bars(ticks, period=60))
    assert len(out) == 2
    assert out[-1] == Bar(60, 20.0, 20.0, 20.0, 20.0, 1, 20.0)

def test_is_lazy_first_bar_without_consuming_everything():
    def stream() -> Iterator[Tick]:
        yield Tick(0, 10.0, 1)
        yield Tick(1, 12.0, 1)
        yield Tick(60, 20.0, 1)     # crosses the boundary -> closes the first bar
        raise AssertionError("generator was fully consumed — aggregation is not lazy")
    first = next(bars(stream(), period=60))          # must NOT reach the raise
    assert (first.start, first.open, first.close) == (0, 10.0, 12.0)

def test_empty_input_yields_no_bars():
    assert list(bars([], period=60)) == []

def test_non_positive_period_raises():
    with pytest.raises(ValueError):
        next(bars([Tick(0, 1.0, 1)], period=0))      # generators defer their body —
    with pytest.raises(ValueError):
        next(bars([Tick(0, 1.0, 1)], period=-5))      # drive it to trip the guard
```

The laziness test is the one that matters: the input generator `raise`s if fully drained, so a list-builder implementation (which reads everything before returning) fails it, while a true generator passes by yielding the first bar off one tick of look-ahead. Note the `period` test drives with `next(...)` — a bare `bars(..., 0)` never runs the guard because a generator's body is deferred to first pull. Run with `pytest solution/feedstats` (or `practice/feedstats` for your attempt).

### Implement it

The body is a small state machine over the running aggregates. `start is None` seeds the first window; a window mismatch flushes-and-re-seeds; otherwise fold the tick in. The tail flush after the loop is not optional — the last window never sees a "later" tick.

```python
def bars(ticks: Iterable[Tick], period: int) -> Iterator[Bar]:
    if period <= 0:
        raise ValueError(f"period must be positive, got {period}")

    start: int | None = None
    open_ = high = low = close = 0.0
    volume = 0
    weighted = 0.0                              # Σ price·qty over the window

    for tick in ticks:
        window = (tick.ts // period) * period
        if start is None:                        # first tick ever — seed
            start = window
            open_ = high = low = close = tick.price
            volume = tick.qty
            weighted = tick.price * tick.qty
            continue
        if window != start:                      # boundary tick: close, then re-seed
            yield Bar(start, open_, high, low, close, volume, weighted / volume)
            start = window
            open_ = high = low = close = tick.price
            volume = tick.qty
            weighted = tick.price * tick.qty
            continue
        high = max(high, tick.price)             # same window: fold in
        low = min(low, tick.price)
        close = tick.price                       # close is always the latest print
        volume += tick.qty
        weighted += tick.price * tick.qty

    if start is not None:                        # flush the final (partial) bar
        yield Bar(start, open_, high, low, close, volume, weighted / volume)
```

The key gotcha is **why a generator, not a list.** A list-builder must read the entire feed before it can return the first bar — a non-starter on an unbounded live tape and wasteful on a finite one, since the whole session's bars sit in memory at once. The generator is lazy and pull-based: it computes each bar the instant a boundary tick proves it complete, `yield`s it, and suspends. Memory is O(1) in ticks — only the seven running scalars are alive, never a buffer of ticks or bars — and the result composes: `for bar in bars(feed, 60)`, `islice(bars(feed, 60), 10)` to take the first ten, or feed it into a rolling-VWAP generator, all still lazy. The **one-tick look-ahead** is the whole trick: a bar is done only when the *next* window's first tick arrives, and that same tick both flushes the old bar and seeds the new one — so there is no separate buffer, just the running totals plus the boundary tick you re-seed from. And don't drop the tail: the final window has no successor tick to trigger its flush, so the post-loop `yield` (guarded by `start is not None` for empty input) is what keeps you from silently losing the last bar.

### Common mistakes & senior signal

The headline trap: **returning a list.** It compiles, passes on a fixture array, and quietly defeats the entire point — eager, buffered, and non-terminating on the stream it exists to handle. Name the streaming requirement unprompted.

- **`return [...]` instead of `yield`.** Reads the whole feed before emitting anything, O(n) memory, hangs on an unbounded source. **Senior signal** — recognises the input is a stream and designs a generator with O(1) state, then says why (laziness, minimum latency, composition).
- **Dropping the final bar.** Flushing only on a window change loses the last window, which never sees a later tick. **Senior signal** — flushes the tail after the loop and writes the `test_final_partial_bar_is_flushed` case that would catch its absence.
- **Unweighted VWAP.** Averaging prices (`Σ price / n`) instead of weighting by quantity (`Σ price·qty / Σ qty`) misprices every bar. **Senior signal** — carries the two running sums and pins the math with a 10@2 / 20@1 → 40/3 test.
- **Testing the `period` guard with a bare call.** `bars(x, 0)` never raises because a generator defers its body; the assertion silently never fires. **Senior signal** — knows generators are lazy and drives the guard with `next(...)`, and proves laziness with a generator input that raises if fully consumed.
- **Buffering ticks to "look back" for the boundary.** Collecting the window's ticks into a list to compute the bar re-introduces the memory you were avoiding. **Senior signal** — folds each tick into running accumulators and keeps only the one boundary tick as look-ahead.

Extensions that show depth: aggregate a **multi-symbol** feed by keying windows per symbol with `itertools.groupby` over a symbol-sorted stream; stack a **rolling-VWAP** generator on top of `bars` (a sliding N-bar VWAP that consumes the bar stream lazily, O(N) memory); or lift the whole thing to an `async` generator over a real socket with backpressure.

## Middleware Pipeline — Decorators & Closures (The Onion Model)

### Summary

**What this topic covers**

You build a web framework's middleware pipeline: a `Handler` is `Request -> Response`, and around it you stack cross-cutting layers — authentication, logging, rate-limiting — that run on every request without each handler re-implementing them. `compose([m1, m2, m3], handler)` assembles those layers into one handler where `m1` is the *outermost* ring: a request flows `m1 -> m2 -> m3 -> handler` on the way in and the response flows back `handler -> m3 -> m2 -> m1` on the way out. Each layer can modify the request going in, modify the response coming out, or **short-circuit** — return a response itself and never call the layers beneath it (an auth layer rejecting with `401` is the canonical case; the handler never runs). The signature Python topic it drills is **higher-order functions, closures, and decorators**: a middleware is a `Handler -> Handler` closure, and the pipeline is those closures folded with `functools.reduce` — the runtime form of stacked `@decorator`s.

**Mental model**

Picture an onion. The base handler is the core; each middleware is a skin wrapped around it. A request pierces every skin from the outside in, hits the core, and the response retraces the same path outward — so every middleware sees *both* sides of its `next_handler(request)` call, the inbound request before it and the outbound response after it. The trick that makes this composable is recognising a middleware is not `Request -> Response`; it is one level up, `Handler -> Handler` — a function that *takes the next handler and returns a new handler that wraps it*. That returned handler is a **closure** capturing `next_handler` in its enclosing scope. Composing the stack is therefore a fold: start with the bare `handler`, wrap it in the last middleware, wrap that in the second-last, ... , wrap that in the first — so the first ends up outermost. `functools.reduce(lambda nxt, mw: mw(nxt), reversed(middlewares), handler)`. This is *literally* what a decorator is: `@logging` above `def f` rebinds `f` to `logging(f)`; a middleware stack is decorators applied at runtime to a value instead of at definition time to a name.

**Key terms**

- **decorators / closures** — a middleware `def mw(next_handler)` returns an inner `wrapped(request)` that *closes over* `next_handler`. `@mw` on a function is the same operation applied statically; `compose` applies it dynamically.
- **higher-order functions `Handler -> Handler`** — a middleware doesn't process a request; it takes a handler and returns a handler. Functions in, functions out — the defining move.
- **`functools.reduce` fold** — walks a sequence threading an accumulator: `reduce(f, seq, init)` computes `f(f(f(init, s0), s1), s2)`. Here the accumulator *is* the handler being wrapped inward.
- **the onion model** — request in outer→inner, response out inner→outer; each layer straddles `next_handler(request)`.
- **short-circuiting** — a middleware that returns a `Response` without calling `next_handler` ends the pipeline; every layer inside it is skipped (auth `401`, rate-limit `429`, circuit-breaker `503`).
- **WSGI/ASGI analogy** — this is the shape every Python web stack uses. WSGI middleware wraps a `(environ, start_response)` app; **ASGI** is the async form — `async def middleware(scope, receive, send)` wrapping the next app, awaited rather than called.

**Why interviewers ask this**

It separates people who *use* decorators from people who understand what a decorator *is*. A junior reaches for a class with an explicit loop and mutable state, or hard-codes three `if` branches inside one handler. A senior sees that a middleware is a `Handler -> Handler` function, that stacking them is function composition, and that `functools.reduce` expresses the whole assembly in one line — then names the direction subtlety (why you fold `reversed(middlewares)` so the *first* is outermost) without being prompted. It's also a clean probe of closures (does the candidate know `wrapped` captures `next_handler` by reference?), of the onion data-flow (can they trace request-in / response-out?), and of short-circuiting (do they realise "skip the rest" is *just not calling* `next_handler`?). The scenario is real: it's the architecture of every framework the candidate has ever imported.

**Common confusions**

- *"A middleware is `Request -> Response`."* — No. That's a *handler*. A middleware is `Handler -> Handler` — one level up. Conflating the two makes composition impossible.
- *"Fold the list left-to-right."* — That makes the *last* middleware outermost. You fold `reversed(middlewares)` (or fold right) so the first listed is the outer skin.
- *"Short-circuiting needs a special mechanism."* — It's just `return Response(...)` without calling `next_handler`. No exceptions, no sentinel, no flag.
- *"The middleware only touches the request."* — It brackets `next_handler(request)`: it can rewrite the request *before* and the response *after*, in the same closure.
- *"`reduce` is un-Pythonic, use a loop."* — A right-to-left `for` loop is a fine equivalent, but `reduce` names the operation (a fold) exactly; know both and say why.

**What follows from this topic**

This is the gateway to decorators with arguments (a `logger(name)` that returns a middleware — a function returning a function returning a function), to `functools.wraps` and metadata preservation, and to the async **ASGI** rewrite (`await next_app(...)` instead of `next_handler(...)`) where the same fold threads coroutines. The extension — a `@route` registry mapping paths to handlers, each wrapped in the shared pipeline — leads into how real frameworks (Flask, Starlette, FastAPI) actually assemble their stacks. The higher-order-function fold is the smallest complete expression of the pattern and the mental anchor for every "wrap behaviour around a call" problem you meet after.

### Clarify & design the API

Clarifying questions worth asking out loud: which end of the list is outermost (first — `m1` wraps everything)? Can a middleware both mutate the request *and* the response (yes — it brackets the inner call)? How does a layer reject a request (short-circuit — return a `Response`, don't call `next_handler`)? Is the pipeline sync or async (kata: sync; mention ASGI as the async form)? Are `Request`/`Response` immutable (yes — frozen dataclasses; a middleware forwards a *new* one rather than mutating in place)?

The **type design** is the whole insight. A `Handler` turns a request into a response; a `Middleware` is one level up — it takes the *next* handler and returns a *new* handler wrapping it. Naming those two aliases precisely is half the answer. Note `Callable` comes from `collections.abc`, not `typing` (the `typing` aliases are deprecated since 3.9).

```python
from __future__ import annotations
import functools
from collections.abc import Callable
from dataclasses import dataclass, field


@dataclass(frozen=True)
class Request:
    path: str
    headers: dict[str, str] = field(default_factory=dict)


@dataclass(frozen=True)
class Response:
    status: int
    body: str = ""


# A handler turns a request into a response.
Handler = Callable[[Request], Response]
# A middleware takes the next handler and returns a wrapped handler (Handler -> Handler).
Middleware = Callable[[Handler], Handler]


def compose(middlewares: list[Middleware], handler: Handler) -> Handler:
    """Wrap `handler` in `middlewares`, the first being the outermost layer."""
    ...
```

Say the shape of a middleware explicitly — it's a closure factory:

```python
def logging(next_handler: Handler) -> Handler:      # Handler -> Handler
    def wrapped(request: Request) -> Response:      # the closure over next_handler
        response = next_handler(request)            # call through the onion
        return response                             # ... or return early to short-circuit
    return wrapped
```

`compose` must make `m1` the outermost skin so a request flows `m1 -> m2 -> m3 -> handler` and the response flows back `handler -> m3 -> m2 -> m1`. Volunteering that this is exactly a runtime decorator stack is the senior framing.

### Write the tests

This is the heart of the kata — the README ships **no tests**; writing them is the exercise. Cover four things: the empty pipeline is a pass-through, the onion order is outer-in / inner-out (proved with a shared log), an auth layer short-circuits so the handler is *never called* (tracked, not assumed), and a middleware brackets `next_handler` to mutate the request in and the response out. Plain `def test_*` functions, no fixtures needed beyond the provided types.

```python
from middleware import Handler, Middleware, Request, Response, compose


def ok_handler(request: Request) -> Response:
    return Response(200, "ok")


def test_empty_pipeline_calls_handler_directly():
    handler = compose([], ok_handler)
    assert handler(Request("/")) == Response(200, "ok")  # fold of nothing == handler


def test_onion_order_outer_in_inner_out():
    log: list[str] = []

    def logger(name: str) -> Middleware:                 # decorator-with-args shape
        def middleware(next_handler: Handler) -> Handler:
            def wrapped(request: Request) -> Response:
                log.append(f"{name}:in")                 # inbound: outer -> inner
                response = next_handler(request)
                log.append(f"{name}:out")                # outbound: inner -> outer
                return response
            return wrapped
        return middleware

    handler = compose([logger("m1"), logger("m2"), logger("m3")], ok_handler)
    handler(Request("/"))
    assert log == ["m1:in", "m2:in", "m3:in", "m3:out", "m2:out", "m1:out"]


def test_auth_short_circuits_and_handler_never_runs():
    calls: list[Request] = []                            # track the base handler

    def counting_handler(request: Request) -> Response:
        calls.append(request)
        return Response(200, "ok")

    def require_auth(next_handler: Handler) -> Handler:
        def wrapped(request: Request) -> Response:
            if "authorization" not in request.headers:
                return Response(401)                      # short-circuit: no next call
            return next_handler(request)
        return wrapped

    handler = compose([require_auth], counting_handler)

    blocked = handler(Request("/private"))
    assert blocked == Response(401)
    assert calls == []                                   # proven: handler never ran

    allowed = handler(Request("/private", {"authorization": "token"}))
    assert allowed == Response(200, "ok")
    assert len(calls) == 1


def test_middleware_mutates_request_in_and_response_out():
    def rewrite(next_handler: Handler) -> Handler:
        def wrapped(request: Request) -> Response:
            forwarded = Request(request.path + "/v2", request.headers)  # request in
            response = next_handler(forwarded)
            return Response(response.status, f"[{response.body}]")       # response out
        return wrapped

    def echo_path(request: Request) -> Response:
        return Response(200, request.path)

    handler = compose([rewrite], echo_path)
    assert handler(Request("/users")) == Response(200, "[/users/v2]")
```

Run with `cd python-katas && .venv/bin/pytest practice/middleware` (or `solution/middleware` for the reference). The short-circuit test is the load-bearing one: asserting `calls == []` is the only thing that *proves* the base handler was skipped rather than just returning the right status by luck. The onion-order test's shared `log` is what makes the invisible control flow visible — a wrong fold direction would print `m3:in` first.

### Implement it

The whole implementation is one fold. Start with the base `handler` and wrap it in each middleware from the *inside out* — so walk the middleware list in reverse and, at each step, replace the accumulated handler with `middleware(accumulated)`. `functools.reduce` is that loop.

```python
def compose(middlewares: list[Middleware], handler: Handler) -> Handler:
    """Wrap `handler` in `middlewares`, the first being the outermost layer.

    A request flows through the middlewares left-to-right and the response flows
    back out right-to-left (the onion model). compose([], handler) == handler.
    """
    return functools.reduce(
        lambda nxt, middleware: middleware(nxt),   # wrap the accumulated handler
        reversed(middlewares),                     # inside-out: m3, m2, m1
        handler,                                   # seed = the base handler (the core)
    )
```

The key gotcha is the **direction of the fold**, and it follows directly from what a middleware *is*. A middleware is `Handler -> Handler`: it consumes the next handler and produces a wrapped one. To make `m1` the outermost skin, `m1` must be applied *last* — it has to receive the already-assembled `m2(m3(handler))` as its `next`. So you fold over `reversed(middlewares)`: `reduce` first wraps `handler` in `m3`, then wraps *that* in `m2`, then wraps *that* in `m1`, leaving `m1` on the outside. Fold the list forwards and you'd get `m3` outermost — the onion inside-out. `compose([], handler)` folds nothing and returns the seed `handler` untouched, which is exactly the pass-through the empty-pipeline test asserts. Each middleware's returned closure decides at call time whether to invoke `next` (continue the onion) or to `return Response(...)` (short-circuit — everything inside it is skipped, because "inside" only runs when `next_handler` is called). That call-or-don't-call choice is the entire short-circuit mechanism — no exceptions, no sentinels. And this is precisely what a Python decorator does for a single function; `compose` is just doing it to a value at runtime instead of to a name at definition time.

### Common mistakes & senior signal

The headline trap: **treating a middleware as `Request -> Response` instead of `Handler -> Handler`.** Get the type wrong and nothing composes.

- **Wrong fold direction.** Folding `middlewares` forwards makes the *last* one outermost, silently inverting the onion — auth ends up *inside* logging and runs too late. Fold `reversed(...)` (or fold-right) so the first listed is the outer skin. **Senior signal** — states which end is outermost and *why* the reverse is needed before writing a line.
- **Reinventing short-circuit with exceptions or sentinels.** Raising a `StopPipeline` or returning a magic value to "abort" is ceremony. **Senior signal** — knows short-circuiting is just `return Response(...)` without calling `next_handler`, and that everything "inside" a layer only runs *because* `next_handler` was called.
- **A middleware that forgets to return `next_handler`'s response.** Calling `next_handler(request)` for its side effect but returning `None` (or its own response) silently drops the real result. **Senior signal** — brackets the call: `response = next_handler(request); ...; return response`, touching both sides.
- **Mutating a frozen `Request`/`Response` in place.** These are immutable dataclasses; a middleware forwards a *new* `Request(...)` rather than assigning to a field. **Senior signal** — constructs a new value going in and a new value coming out, and notes immutability makes the pipeline safe to reason about.
- **Importing `Callable` from `typing`.** The `typing` aliases are deprecated since 3.9; `collections.abc.Callable` is the current home. **Senior signal** — uses `from collections.abc import Callable` and the `list[...]` / `dict[...]` builtins without comment.
- **A class with an explicit loop and mutable state where a fold would do.** Works, but buries the insight. **Senior signal** — reaches for `functools.reduce` (or a tight right-to-left loop), names it as a fold, and connects it explicitly to the decorator model.

Extensions that show depth: a `logger(name)` decorator-with-arguments (a function returning a middleware returning a handler — three levels); a `@route` registry mapping paths to handlers each wrapped in the shared pipeline; and the **async ASGI** rewrite where every `next_handler(request)` becomes `await next_app(scope, receive, send)` and the same fold threads coroutines instead of functions.

## Async Fetch Orchestrator — asyncio Semaphore & gather

### Summary

**What this topic covers**

You build a bounded-concurrency fetch orchestrator: a crawler, or a quote fetcher pulling the current price from every venue an aggregator tracks. Given a list of URLs and an async `fetch(url)`, run the fetches *concurrently* (fetching is I/O-bound — nearly all wall-clock time is spent waiting on a socket), but under a hard **concurrency cap** because the far side and your own file-descriptor / socket budget only tolerate so many in-flight requests. Flaky sources get **retried** a bounded number of times, and results come back **in input order** regardless of which fetch finished first. It's the canonical "fan out I/O with backpressure" async question, and the signature Python topic it drills is **asyncio**: cooperative concurrency on one event loop, `asyncio.Semaphore` as a concurrency gate, `asyncio.gather` for order-preserving fan-in, and the GIL boundary that decides when asyncio is even the right tool.

**Mental model**

asyncio is *single-threaded cooperative concurrency*: one event loop runs one coroutine at a time, and every `await` is a point where the running coroutine voluntarily yields the loop so another can run. There is no preemption and no second thread — so between two `await`s your plain Python state cannot be touched by anyone else, which is why there are no data races to hunt here (contrast the Rust/Go position-book kata, which is entirely about that). The concurrency you get is *overlapped waiting*: while one fetch is parked awaiting its socket, the loop drives the others. The cap is a permit pool — an `asyncio.Semaphore` initialised to `limit` — that each task acquires before its work and releases after, so at most `limit` fetches are ever in flight and the rest park on `acquire()`. Order preservation is *free*: `gather` returns results positionally, so even though coroutines complete in whatever order their I/O decides, the *i*-th result is still the *i*-th awaitable. The whole kata is composing these three primitives correctly — and knowing that if the work were CPU-bound, none of this would help.

**Key terms**

- **asyncio cooperative concurrency / the event loop** — one loop, one coroutine running at a time; concurrency comes from overlapping waits, not parallel execution.
- **`await` yields** — every `await` is a suspension point where the coroutine hands the loop back; between awaits you run uninterrupted, so no locks are needed for plain state.
- **`asyncio.Semaphore` concurrency cap** — a permit pool sized to `limit`; `async with sem:` acquires on entry, releases on exit. At most `limit` holders at once — the backpressure mechanism.
- **`asyncio.gather` order preservation** — awaits many awaitables concurrently and returns results *positionally*, in input order, regardless of completion order.
- **cancellation / error propagation** — plain `gather` (no `return_exceptions=True`) raises the first exception to the caller and cancels the sibling tasks; one dead source aborts the batch.
- **the GIL — asyncio for I/O-bound, multiprocessing for CPU-bound** — CPython runs one thread of bytecode at a time, so asyncio (and threading) win only on I/O; CPU-bound fanout needs `multiprocessing` / `ProcessPoolExecutor` to sidestep the GIL.

**Why interviewers ask this**

It separates people who reach for `asyncio` as a magic "make it fast" incantation from people who know exactly what it does and doesn't buy. A junior sprays `await` and `gather` around and hopes; a senior can state that asyncio gives *overlapped I/O waiting on a single thread*, cap it deterministically with a Semaphore, explain why `gather` needs no sorting to preserve order, choose the right cancellation semantics, and — the real tell — reach the GIL boundary unprompted and say "this only helps because fetching is I/O-bound; for CPU-bound work I'd use `multiprocessing`." It also probes test discipline: async code is where flaky `sleep`-based tests breed, and the senior writes deterministic tests driven by an `asyncio.Event`, not the wall clock.

**Common confusions**

- *"asyncio runs my fetches in parallel."* — No. One thread, one coroutine at a time; it overlaps *waiting*, not computation. Two CPU-heavy coroutines run no faster than sequentially.
- *"I need to sort the results back into order."* — `gather` already returns them positionally. Sorting or index-tagging is only needed with `as_completed`.
- *"The Semaphore makes it thread-safe."* — There are no threads. The Semaphore caps *concurrency*, not access to shared memory; between awaits nothing else runs anyway.
- *"`asyncio.sleep(0.01)` in a test is fine."* — It's a flaky coin flip. Drive completion with an `asyncio.Event` and interleave with `asyncio.sleep(0)` (a bare yield, no real delay).
- *"More `await`s means more parallelism."* — `await` is a *yield point*, not a speedup; a coroutine that never awaits never lets anything else run.

**What follows from this topic**

This is the gateway to the rest of async Python: per-task timeouts with `asyncio.wait_for` (a slow source is cancelled and counts as a failure to retry), structured concurrency with `asyncio.TaskGroup` (3.11+), and swapping the eager task list + Semaphore for a bounded **producer/consumer** using `asyncio.Queue` and a fixed pool of `limit` worker coroutines (true backpressure instead of a permit gate). The GIL note is the fork in the road to `multiprocessing` / `ProcessPoolExecutor` for CPU-bound fanout and to `ThreadPoolExecutor` (via `run_in_executor`) for blocking, non-async I/O libraries.

### Clarify & design the API

Clarifying questions worth asking out loud: is the work genuinely I/O-bound (yes — that's why asyncio, not multiprocessing)? What's the concurrency cap and is it a hard limit or a target (hard — socket/FD budget)? On failure, do we abort the whole batch or collect per-item errors (kata: abort — default `gather` propagates the first exception and cancels siblings; mention `return_exceptions=True` as the alternative)? How many retries, and is the retry count *additional* attempts or total (additional — `1 + retries` attempts)? Must results be in input order (yes — that's the whole point of using `gather` over `as_completed`)?

The design is two small composable functions. The lower one owns the **cap + ordering**; the higher one adds **per-url retry** on top.

```python
from collections.abc import Awaitable, Callable
from typing import TypeVar

T = TypeVar("T")

async def gather_capped(aws: list[Awaitable[T]], limit: int) -> list[T]:
    """Await every awaitable with at most `limit` running concurrently.
    Results come back in the SAME ORDER as `aws` (gather preserves position
    even though completion order is whatever the I/O decides). If one raises,
    it propagates and the siblings are cancelled. `limit` must be positive."""

async def fetch_all(
    fetch: Callable[[str], Awaitable[str]],
    urls: list[str],
    *,
    limit: int,
    retries: int = 0,
) -> list[str]:
    """Fetch every url concurrently (capped at `limit`), retrying transient
    failures up to `retries` more times (1 + retries attempts). Results in
    url order. Built on top of gather_capped."""
```

Say the two load-bearing facts explicitly. **The Semaphore is the cap:** initialise it to `limit`, wrap each awaitable in a coroutine that does `async with sem: await aw`, so at most `limit` are ever in flight and the rest park. **Order is free:** `gather` returns positionally, so we hand back `list(await asyncio.gather(...))` with no sorting. `fetch_all` doesn't re-implement any of that — it builds one `fetch_with_retry` coroutine per url and passes the list straight to `gather_capped`, inheriting the cap and the ordering for nothing.

### Write the tests

The README ships **no tests** — writing them is the exercise, and async is exactly where test discipline shows. The rule: **no `pytest-asyncio`, no `async def` test functions.** Each test is a plain `def test_*()` that builds an `async def main()` and calls `asyncio.run(main())` internally. And **no wall-clock sleeps** — drive completion with an `asyncio.Event` and interleave with `asyncio.sleep(0)` (a bare yield of the loop, zero real delay).

```python
import asyncio
import pytest

from . import fetch_all, gather_capped


def test_results_returned_in_input_order_even_when_later_tasks_finish_first():
    # url N finishes first, url 0 finishes last — result list must still be url order.
    urls = ["u0", "u1", "u2", "u3"]
    gates = {url: asyncio.Event() for url in urls}

    async def fetch(url: str) -> str:
        await gates[url].wait()
        return f"body:{url}"

    async def main() -> list[str]:
        task = asyncio.ensure_future(fetch_all(fetch, urls, limit=4))
        await asyncio.sleep(0)              # let all fetches park on their gate
        for url in reversed(urls):          # release in REVERSE order
            gates[url].set()
            await asyncio.sleep(0)
        return await task

    assert asyncio.run(main()) == ["body:u0", "body:u1", "body:u2", "body:u3"]


def test_concurrency_cap_is_respected():
    limit = 2
    urls = [f"u{i}" for i in range(8)]
    state = {"current": 0, "max_seen": 0}

    async def fetch(url: str) -> str:
        state["current"] += 1
        state["max_seen"] = max(state["max_seen"], state["current"])
        for _ in range(3):                  # force interleaving, no real delay
            await asyncio.sleep(0)
        state["current"] -= 1
        return url

    results = asyncio.run(fetch_all(fetch, urls, limit=limit))
    assert results == urls
    assert state["max_seen"] == limit       # 8 urls, cap 2 → we saturate it


def test_retry_recovers_after_transient_failures():
    calls = {"u0": 0}

    async def fetch(url: str) -> str:
        calls[url] += 1
        if calls[url] <= 2:
            raise RuntimeError("transient")
        return f"ok:{url}"

    result = asyncio.run(fetch_all(fetch, ["u0"], limit=1, retries=2))
    assert result == ["ok:u0"]
    assert calls["u0"] == 3                  # 2 failures + 1 success


def test_permanent_failure_with_retries_exhausted_propagates():
    async def fetch(url: str) -> str:
        raise RuntimeError("always down")

    with pytest.raises(RuntimeError, match="always down"):
        asyncio.run(fetch_all(fetch, ["u0"], limit=1, retries=2))


def test_limit_zero_or_negative_raises_value_error():
    async def fetch(url: str) -> str:
        return url

    with pytest.raises(ValueError):
        asyncio.run(fetch_all(fetch, ["u0"], limit=0))
    with pytest.raises(ValueError):
        asyncio.run(gather_capped([], 0))
```

The order test is the sharp one: the `asyncio.Event` per url plus releasing in *reverse* means the last url completes first, so a broken implementation that returns completion-order (e.g. built on `as_completed` without re-sorting) fails loudly and deterministically. The cap test asserts `max_seen == limit`, not just `<= limit` — with 8 urls and a cap of 2 a correct Semaphore *saturates* the pool, so `== limit` catches both an over-large cap (would exceed) and a too-timid one that never fills it.

### Implement it

`gather_capped` wraps each awaitable in a Semaphore-guarded coroutine and hands the lot to `asyncio.gather`, which preserves order. `fetch_all` builds one retry-wrapping coroutine per url and delegates — no duplicated cap/order logic.

```python
import asyncio
from collections.abc import Awaitable, Callable
from typing import TypeVar

T = TypeVar("T")


async def gather_capped(aws: list[Awaitable[T]], limit: int) -> list[T]:
    if limit <= 0:
        raise ValueError(f"limit must be positive, got {limit}")

    sem = asyncio.Semaphore(limit)

    async def run(aw: Awaitable[T]) -> T:
        async with sem:                       # acquire a permit, release on exit
            return await aw

    return list(await asyncio.gather(*(run(aw) for aw in aws)))  # order preserved


async def fetch_all(
    fetch: Callable[[str], Awaitable[str]],
    urls: list[str],
    *,
    limit: int,
    retries: int = 0,
) -> list[str]:
    if limit <= 0:
        raise ValueError(f"limit must be positive, got {limit}")

    async def fetch_with_retry(url: str) -> str:
        attempt = 0
        while True:
            try:
                return await fetch(url)
            except Exception:
                if attempt >= retries:
                    raise                     # last attempt failed → propagate
                attempt += 1

    return await gather_capped([fetch_with_retry(url) for url in urls], limit)
```

The gotchas that matter. **asyncio is single-threaded cooperative concurrency:** one loop, one coroutine at a time, and every `await` — including `async with sem` and `await aw` — is a yield point where another fetch can run. That's why this is safe without any locks: between awaits nothing else touches your state. **The Semaphore caps concurrency, not correctness:** `async with sem` holds a permit for exactly the duration of the wrapped `await`, so no more than `limit` fetches are ever mid-flight; the rest are parked on `acquire()`, resumed as permits free. **`gather` preserves order despite out-of-order completion** — the coroutines finish whenever their I/O finishes, but `gather` returns results positionally, so no sorting or index-tagging is needed (the free win over `as_completed`). And plain `gather` **propagates the first exception and cancels the siblings**, which is why `fetch_with_retry` only lets an exception escape after the final attempt — one genuinely-dead source aborts the batch rather than returning a half-filled list. Finally the **GIL**: all of this pays off *because fetching is I/O-bound*. CPython executes one thread of bytecode at a time, so a coroutine doing heavy compute between awaits would block the entire loop — for CPU-bound fanout you'd reach for `multiprocessing`, not asyncio.

### Common mistakes & senior signal

- **Awaiting the fetches sequentially.** `for url in urls: results.append(await fetch(url))` is a correct-looking loop that runs one at a time — you've thrown away all the concurrency. The point is to create the awaitables first and `gather` them. **Senior signal** — reaches for `gather` over a per-item `await` and can say why: awaiting in a loop serialises, gather overlaps the waits.
- **Firing everything at once with no cap.** A bare `asyncio.gather(*(fetch(u) for u in urls))` over 10k urls exhausts sockets/FDs and hammers the far side. **Senior signal** — introduces the `asyncio.Semaphore` as deliberate backpressure and can contrast it with a Queue + worker-pool design for true producer/consumer backpressure.
- **Re-sorting results or tagging indices.** Building on `as_completed` and then sorting to restore order, when `gather` already returns positionally. **Senior signal** — knows `gather` preserves input order for free and only reaches for `as_completed` when they genuinely want results as they land.
- **`sleep`-based "stress" tests.** `await asyncio.sleep(0.05)` to "let tasks finish" is timing-dependent and flaky. **Senior signal** — drives completion with an `asyncio.Event` and interleaves with `asyncio.sleep(0)` (a pure yield), so the order and cap tests are deterministic.
- **Retry that swallows the final failure or retries the wrong count.** Catching `Exception` and returning a sentinel, or doing `retries` *total* instead of `1 + retries` attempts. **Senior signal** — states the contract precisely (`1 + retries` attempts; the last failure propagates) and tests both the recover-then-succeed and exhausted-and-propagate paths.
- **Thinking asyncio gives CPU parallelism.** Using it to speed up a compute-heavy loop and being surprised nothing improves. **Senior signal** — names the GIL unprompted: asyncio overlaps I/O waiting on one thread; CPU-bound fanout needs `multiprocessing`, blocking-I/O libraries need a thread executor.

## Order State Machine — Enums & Structural Pattern Matching

### Summary

**What this topic covers**

You build the transition function for a trading order's lifecycle: an order is `NEW`, the venue `ACCEPTED` or `REJECTED`s it, an accepted order fills — possibly in pieces (`PARTIALLY_FILLED`) until fully `FILLED` — or is `CANCELLED` before completing; `FILLED`/`CANCELLED`/`REJECTED` are **terminal**. Each market event (accept, fill of some quantity, cancel, reject) is legal only from certain states, and a fill must never push the filled quantity past the order's total. The single deliverable is `apply(order, event) -> Order`, a **pure** function over `(state, event)`. The signature Python topic it drills is **structural pattern matching** (`match`/`case`, 3.10+) alongside `Enum` and frozen dataclasses — the idiomatic modern way to express a finite state machine.

**Mental model**

A finite state machine is a table: rows are states, columns are events, each cell is either a next state or "illegal". The junior instinct is to encode that table as nested `if`/`elif` over boolean flags (`is_accepted`, `is_filled`, …) — a soup that drifts out of sync and hides which combinations are unhandled. The senior move is to make the *state* a first-class value (an `Enum`), make the *order* an immutable value (a frozen dataclass), and express the *whole table* as one `match (order.state, event):`. Each `case` is one row of the truth table; **class patterns** destructure the event to bind its payload (`Fill(qty=q)`), **OR-patterns** collapse states that share a rule (`ACCEPTED | PARTIALLY_FILLED`), and a final `case _` is the "illegal" cell for everything you didn't name. `apply` reads like the spec because it *is* the spec — and because it returns a *new* `Order` rather than mutating, there is no hidden state to get wrong.

**Key terms**

- **`Enum`** — `OrderState(Enum)` with `auto()` members names the lifecycle states as a closed set of singletons; compare with `is`, match on `OrderState.NEW`. Beats string/int flags: typo-proof, self-documenting, iterable.
- **frozen dataclasses + `dataclasses.replace`** — `@dataclass(frozen=True)` makes `Order` immutable (hashable, no field assignment). `replace(order, state=…, filled=…)` builds the *next* order as a new value, copying unchanged fields — the functional way to "transition".
- **structural pattern matching (`match`/`case`) with class patterns + OR-patterns** — `match (order.state, event):` matches a tuple; `case (OrderState.NEW, Accept()):` matches a state constant *and* an event type; `Fill(qty=q)` binds the fill size; `A | B` matches either state in one arm.
- **the non-exhaustiveness caveat + `case _`** — Python does **not** check that a `match` covers every case. An unhandled `(state, event)` falls straight through and the function returns `None`. `case _` is the deliberate catch-all that turns "unhandled" into a loud error instead of a silent `None`.
- **data-carrying exceptions** — `IllegalTransition` and `Overfill` subclass `Exception` and carry a message; the guards *raise* (never clamp or return a sentinel) so an illegal event fails loudly at the call site.
- **immutable transition** — `apply` is pure: same inputs → same output, no side effects, input untouched. The returned order is a fresh frozen value; the original is safe to keep, share, or log.

**Why interviewers ask this**

Finite state machines are the bread-and-butter of order management, payments, workflow engines and protocol handlers, so "model this lifecycle" is a staple LLD question — and it cleanly separates people who reach for boolean-flag spaghetti from people who reach for a state enum and a transition table. The `match` statement is the modern-Python tell: a candidate who uses class patterns and OR-patterns fluently, *and* who unprompted flags that Python doesn't enforce exhaustiveness (so the `case _` is load-bearing, not decoration), is demonstrating current language mastery. The purity angle — returning a new value instead of mutating — is the second signal: it shows the candidate values testability and reasoning over cleverness. And the money framing (an illegal transition is a real, unintended trade) shows they connect a "toy" state machine to correctness that costs money.

**Common confusions**

- *"`match` is just a `switch`; the compiler will warn me if I miss a case."* — No. Python's `match` has **no** exhaustiveness check. A missing arm silently returns `None`; only a `case _` makes it fail.
- *"`case Fill:` matches a fill."* — No — that binds the name `Fill` to the subject (a capture pattern, always matches). You need `case Fill():` (or `Fill(qty=q)`) — the parentheses make it a class pattern.
- *"`frozen=True` makes it deeply immutable."* — It only blocks attribute assignment on the dataclass itself; a mutable field (a list) is still mutable. Here every field is an `int`/`Enum`, so it's genuinely immutable.
- *"An overfill and an illegal transition are the same error."* — They're distinct: `IllegalTransition` = wrong event for this state; `Overfill` = a *legal* fill event whose quantity would exceed `total`. Different exception types so callers can react differently.
- *"`apply` should update the order in place."* — Mutating re-introduces the hidden state the pure design exists to avoid; return a new `Order` via `replace`.

**What follows from this topic**

The natural extension is the **typestate** pattern — make each state a *distinct type* (`NewOrder`, `AcceptedOrder`, `FilledOrder`) whose methods expose only the legal transitions, so an illegal transition fails to *type-check* and never reaches runtime. That leads into `typing` unions, protocols, and where a type-checker (mypy/pyright) can replace a runtime guard. The pattern-matching muscle carries into parsing wire protocols, walking ASTs, and interpreter dispatch; the frozen-dataclass-plus-`replace` habit carries into event sourcing and any "reduce events into state" design.

### Clarify & design the API

Questions worth asking out loud: are fills signed or always positive (positive — a fill adds to `filled`)? Can a fill be exactly the remainder (yes — `filled == total` transitions to `FILLED`, not `PARTIALLY_FILLED`)? Is a fill past `total` an error or clamped to the remainder (error — `Overfill`, because clamping silently trades a different quantity than the venue reported)? Are the three terminal states truly absorbing — no event, not even a duplicate cancel, is legal (yes)? Should `apply` mutate or return a new order (return new — purity is the design)? Is `NEW + Cancel` legal (yes — you can cancel before the venue responds)?

The **design decision** is to make the state a value and the rule table a `match`. `OrderState` is an `Enum` so states are typed singletons; `Order` is a `frozen` dataclass so a transition is "produce a new value" not "mutate a field"; each event is its own tiny dataclass so `Fill` can carry `qty` while `Accept`/`Cancel`/`Reject` are payload-free, and `Event` is their union. `apply` then dispatches on the `(state, event)` *pair* in one `match`.

```python
from __future__ import annotations
from dataclasses import dataclass, replace
from enum import Enum, auto


class OrderState(Enum):
    """Lifecycle states. FILLED / CANCELLED / REJECTED are terminal."""
    NEW = auto()
    ACCEPTED = auto()
    PARTIALLY_FILLED = auto()
    FILLED = auto()
    CANCELLED = auto()
    REJECTED = auto()


@dataclass(frozen=True)
class Order:
    """Immutable snapshot: current state, total quantity, quantity filled so far."""
    state: OrderState
    total: int
    filled: int = 0


@dataclass(frozen=True)
class Accept:  # venue accepted
    pass


@dataclass(frozen=True)
class Fill:    # a (partial or full) fill of `qty` units
    qty: int


@dataclass(frozen=True)
class Cancel:  # cancel request
    pass


@dataclass(frozen=True)
class Reject:  # venue rejected
    pass


Event = Accept | Fill | Cancel | Reject


class IllegalTransition(Exception):
    """Event is not legal from the order's current state."""


class Overfill(Exception):
    """A fill would push filled quantity past total."""


def apply(order: Order, event: Event) -> Order:
    """Pure transition: returns a NEW Order; never mutates its input."""
    ...
```

Say the tradeoff explicitly: modelling state as an `Enum` + a single `match` keeps the whole rule table in one readable place, versus scattering `is_*` boolean flags across the object. And returning a new frozen `Order` (rather than mutating) is what makes the machine trivial to test and safe to share — the value you pass in is guaranteed untouched.

### Write the tests

The README ships **no tests** — writing them is the exercise, and the coverage *is* the truth table. Pin every legal path, both overfill shapes, one illegal-from-non-terminal case, the terminal absorbing property (every terminal state × every event), and — the purity property — that the input is not mutated.

```python
import pytest

from workflow import (
    Accept, Cancel, Fill, Reject,
    Order, OrderState,
    IllegalTransition, Overfill, apply,
)


def test_happy_path_new_to_filled_via_partial():
    o = Order(state=OrderState.NEW, total=10)
    o = apply(o, Accept())
    assert o.state is OrderState.ACCEPTED
    o = apply(o, Fill(4))
    assert o.state is OrderState.PARTIALLY_FILLED
    assert o.filled == 4
    o = apply(o, Fill(6))
    assert o.state is OrderState.FILLED
    assert o.filled == 10


def test_one_shot_exact_fill():
    o = apply(Order(state=OrderState.ACCEPTED, total=10), Fill(10))
    assert o.state is OrderState.FILLED
    assert o.filled == 10


def test_cancel_from_each_nonterminal_state():
    for order in [
        Order(state=OrderState.NEW, total=5),
        Order(state=OrderState.ACCEPTED, total=5),
        Order(state=OrderState.PARTIALLY_FILLED, total=5, filled=2),
    ]:
        assert apply(order, Cancel()).state is OrderState.CANCELLED


def test_reject_from_new():
    assert apply(Order(state=OrderState.NEW, total=5), Reject()).state is OrderState.REJECTED


def test_overfill_from_accepted():
    with pytest.raises(Overfill):
        apply(Order(state=OrderState.ACCEPTED, total=10), Fill(11))


def test_overfill_from_partially_filled():
    with pytest.raises(Overfill):
        apply(Order(state=OrderState.PARTIALLY_FILLED, total=10, filled=7), Fill(4))


def test_new_plus_fill_is_illegal():
    with pytest.raises(IllegalTransition):
        apply(Order(state=OrderState.NEW, total=10), Fill(1))


def test_every_terminal_state_rejects_every_event():
    terminals = [OrderState.FILLED, OrderState.CANCELLED, OrderState.REJECTED]
    events = [Accept(), Fill(1), Cancel(), Reject()]
    for state in terminals:
        filled = 10 if state is OrderState.FILLED else 0
        order = Order(state=state, total=10, filled=filled)
        for event in events:
            with pytest.raises(IllegalTransition):
                apply(order, event)


def test_apply_does_not_mutate_input():
    o = Order(state=OrderState.NEW, total=10)
    result = apply(o, Accept())
    assert result is not o
    assert o.state is OrderState.NEW          # original untouched
    assert result.state is OrderState.ACCEPTED
```

Run with `cd python-katas && .venv/bin/pytest practice/workflow` (or `solution/workflow` for the reference). The two tests that carry the most weight are `test_every_terminal_state_rejects_every_event` (a nested loop that proves the terminal states are *absorbing* — the property most likely to have a hole) and `test_apply_does_not_mutate_input` (asserts `result is not o` *and* that `o` still reads `NEW` — the purity guarantee, which a mutating implementation silently violates).

### Implement it

The whole function is one `match` on the `(state, event)` tuple. Each arm is a truth-table row; the fill arm does the `Overfill` bound check and picks `FILLED` vs `PARTIALLY_FILLED`; a final `case _` catches every illegal pair.

```python
def apply(order: Order, event: Event) -> Order:
    match (order.state, event):
        case (OrderState.NEW, Accept()):
            return replace(order, state=OrderState.ACCEPTED)
        case (OrderState.NEW, Reject()):
            return replace(order, state=OrderState.REJECTED)
        case (OrderState.NEW, Cancel()):
            return replace(order, state=OrderState.CANCELLED)

        case (OrderState.ACCEPTED | OrderState.PARTIALLY_FILLED, Fill(qty=q)):
            new_filled = order.filled + q
            if new_filled > order.total:
                raise Overfill(f"fill of {q} overfills: {order.filled}+{q} > {order.total}")
            if new_filled == order.total:
                return replace(order, state=OrderState.FILLED, filled=order.total)
            return replace(order, state=OrderState.PARTIALLY_FILLED, filled=new_filled)

        case (OrderState.ACCEPTED | OrderState.PARTIALLY_FILLED, Cancel()):
            return replace(order, state=OrderState.CANCELLED)

        case _:
            raise IllegalTransition(
                f"cannot apply {type(event).__name__} from {order.state.name}"
            )
```

The **star of the kata is the `match`**. `case (OrderState.NEW, Accept())` matches a state *constant* against the first tuple element and an event *class pattern* against the second — the empty `Accept()` parentheses are what make it a type test, not a name capture (`case Accept:` would bind, not match). `Fill(qty=q)` destructures the event and binds its payload in one step. The `ACCEPTED | PARTIALLY_FILLED` OR-pattern collapses the two states that fill identically into a single arm, so the rule lives in exactly one place. The **key gotcha** is the `case _`: Python does **not** enforce exhaustiveness — drop that catch-all and any unhandled `(state, event)` pair falls through and `apply` returns `None`, silently corrupting the order instead of erroring. The wildcard is deliberate — it's the thing that turns every un-enumerated cell of the table into a loud `IllegalTransition`. Note too that `apply` is **pure**: every arm returns `replace(order, …)`, a *new* frozen `Order`, and nothing ever assigns to `order` — same inputs always give the same output, and the caller's order is guaranteed untouched. The alternative design is **typestate**: give each state its own class (`NewOrder.accept() -> AcceptedOrder`, with no `fill` method at all) so illegal transitions fail to type-check; it makes bad transitions statically impossible but explodes into six classes and still needs a runtime `match` to narrow a wire event into a concrete state — reach for the single-function form first.

### Common mistakes & senior signal

- **Omitting the `case _`.** Assuming `match` is exhaustive like a Rust `match` or a checked `switch`. An unhandled pair returns `None`, so a cancelled order silently "becomes" `None` and the next `apply` blows up far from the cause. **Senior signal** — states unprompted that Python does *not* check exhaustiveness and that the wildcard arm is load-bearing, the guard that makes an illegal `(state, event)` fail loudly.
- **`case Fill:` instead of `case Fill():`.** The bare name is a capture pattern — it matches *anything* and rebinds `Fill`, so every event looks like a fill and later code breaks. **Senior signal** — uses class patterns with parentheses and destructures the payload (`Fill(qty=q)`) fluently, and can explain capture-vs-class patterns.
- **Mutating the order in place** (`order.filled += q`) — which frozen dataclasses forbid anyway, but the reflex is to try. It re-introduces shared hidden state and makes tests order-dependent. **Senior signal** — returns a new `Order` via `dataclasses.replace`, keeps `apply` pure, and can articulate why purity makes the machine testable and safe to log/share.
- **Clamping an overfill to the remainder instead of raising.** `Fill(11)` on a `total=10` order silently books 10 — a *different* quantity than the venue reported. In a trading system that's a real, unintended position: the desk thinks it did one thing, the book says another, and the P&L difference is unhedged. **Senior signal** — raises `Overfill` (distinct from `IllegalTransition`) and names the money angle: an illegal transition or a double-fill is a trade that never should have happened.
- **Boolean-flag spaghetti** (`is_accepted`, `is_partial`, nested `if`s) instead of a state enum + one table. It drifts, hides unhandled combinations, and can represent impossible states (`is_filled and is_cancelled`). **Senior signal** — models state as a closed `Enum` and the rules as one `match` truth table, so illegal states are unrepresentable and the whole contract fits on a screen.

## Notification Service — Protocols & the Observer Pattern

### Summary

**What this topic covers**

You build the pub/sub core of a backend that tells users when things happen: an order ships, a ride arrives, a price alert fires. Subscribers register a *channel* (email, SMS, push) for a *topic*, optionally with a filter ("orders over $100"), and `publish(event)` fans the event out to every interested channel — in subscription order, without the publisher knowing who is listening. It is the canonical low-level-design question for **decoupling a producer from a set of runtime-registered consumers**. The signature Python idioms it drills are **structural typing with `typing.Protocol`** (a channel is *anything with a `send` method*, no base class) and the **Observer pattern** (the service is the subject holding a per-topic subscriber list), with `Callable` predicates as first-class filters.

**Mental model**

Two ideas sit on top of each other. The *pattern* is Observer: `NotificationService` is the **subject**, subscribers are **observers**, `subscribe` adds one to a per-topic list, and `publish` walks that list pushing the event to each — the publisher is decoupled from receivers that come and go at runtime. The *idiom* is how you name a "channel". In a nominal language you'd force every transport to inherit a `Channel` base class. In Python you say a channel is **any object with a `send(event)` method** and encode that as a `Protocol` — **structural / duck typing**. A plain `class EmailChannel` with a matching `send` *is* a `Channel` to the type checker without ever importing or subclassing it; third-party objects you don't control conform for free. Dispatch to `channel.send(event)` is ordinary dynamic dispatch — Python looks the method up on the object at call time. Filters are just functions `predicate(event) -> bool` passed as values, not hooks you override by subclassing.

**Key terms**

- **`typing.Protocol`** — structural (duck) typing: conformance is by *shape* (has a `send(event)` method), not by declared inheritance. The service names `Channel` but no transport has to.
- **`@runtime_checkable`** — decorator that makes `isinstance(obj, Channel)` work at runtime; it checks only that the named methods *exist*, never their signatures or return types.
- **the Observer pattern** — subject (`NotificationService`) holds a list of observers (channels) per topic and pushes each event to them; publishers stay decoupled from receivers.
- **`Callable` predicates as filters** — a subscription's filter is a first-class `Callable[[Event], bool]`; a lambda expresses it inline instead of a subclass overriding a `matches` hook.
- **topics / subscriptions** — the registry is `dict[str, list[_Subscription]]`; a subscription bundles a channel with its optional predicate.
- **structural vs nominal typing** — structural: "conforms if it has the methods" (Protocol, Go interfaces). Nominal: "conforms only if it declares the base type" (ABC subclassing, Java `implements`).

**Why interviewers ask this**

It separates people who reach for an ABC and inheritance from people who know Python's structural-typing tools and *why* they fit an open-ended plugin set. A junior writes `class Channel(ABC)` with an abstract `send` and makes every transport inherit — coupling, and third-party objects can't play. A senior models the transport as a `Protocol`, states that any object with `send` conforms without inheritance, adds `@runtime_checkable` only when runtime `isinstance` is actually needed, and passes filters as plain callables. The real tell is the **test that proves it**: a fake channel that is a *plain class with no base class* and asserting `isinstance(it, Channel)` — demonstrating structural typing rather than just claiming it. It's also a clean lens on Observer decoupling and the money stakes: a misrouted or dropped notification is a customer who missed their price alert.

**Common confusions**

- *"A Protocol is just an ABC."* — No. An ABC is *nominal*: you must subclass it. A Protocol is *structural*: matching methods are enough, no subclassing, no import at the transport.
- *"`@runtime_checkable` validates the method signature."* — It does not. `isinstance` against a runtime-checkable Protocol checks only that the attribute *exists*; a `send` with the wrong signature still passes `isinstance`.
- *"Filters need a `FilterChannel` subclass."* — A filter is a first-class `Callable[[Event], bool]`. Pass a lambda; don't build a class hierarchy.
- *"Publishing to an unknown topic should error."* — It's a no-op: no subscribers, nothing delivered, no raise. `.get(topic, ())` handles it.

**What follows from this topic**

This is the anchor for Python's structural-typing toolkit — `Protocol`, `runtime_checkable`, and the duck-typing philosophy — that recurs across pluggable-registry designs. The Observer core generalises to event buses and reactive streams. The natural extensions push into: returning an **unsubscribe handle** (closures / handles over a list), **async delivery** (`async def send`, fan out with `asyncio.gather`), and **per-channel retry** on a failing `send` — each of which layers a real concern onto the same subject/observer skeleton.

### Clarify & design the API

Clarifying questions worth asking out loud: is a channel required to inherit anything, or is "has a `send` method" enough (enough — that's the Protocol)? Is delivery order defined (yes — subscription order, so behaviour is deterministic)? Are filters per-subscription or global (per-subscription, optional)? Should publishing to a topic with no listeners raise or no-op (no-op)? Do we need runtime `isinstance` checks against the channel type (only if callers want them — that's what `@runtime_checkable` buys)?

The **typing decision** is the design. A channel is *anything with `send(event)`*, so model it as a `Protocol` — any conforming object qualifies with no base class. Filters are plain `Callable`s. The service owns the storage: topic → list of `(channel, predicate)`.

```python
from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Protocol, runtime_checkable


@dataclass(frozen=True)
class Event:
    """An immutable notification: a topic string and an arbitrary payload dict."""
    topic: str
    payload: dict = field(default_factory=dict)


@runtime_checkable
class Channel(Protocol):
    """Structural type for a transport: any object with send(event) -> None qualifies."""
    def send(self, event: Event) -> None: ...


class NotificationService:
    def subscribe(
        self,
        topic: str,
        channel: Channel,
        *,
        predicate: Callable[[Event], bool] | None = None,
    ) -> None: ...
    def publish(self, event: Event) -> None: ...
    def subscriber_count(self, topic: str) -> int: ...
```

Say the tradeoff explicitly: `Channel` as a `Protocol` keeps the set of transports **open** — a plain `class EmailChannel` with a matching `send` *is* a `Channel` with no inheritance, and third-party objects conform for free. The nominal alternative (`class Channel(ABC)` with an abstract `send`) forces every transport to subclass and locks out objects you don't control; an `enum` of channel *types* with a `match` in `publish` centralises dispatch but closes the set — adding a transport means editing the service. Reaching for the Protocol *is* the senior signal.

### Write the tests

The README ships **no tests** — writing them is the exercise. The one that matters most is the structural-typing proof: a fake channel that is a **plain class with no base class**, asserting `isinstance(it, Channel)`. That is the test that demonstrates you understand Protocols rather than just naming them. Then pin the Observer contract: delivery, order, per-topic isolation, predicate filtering, the empty-topic no-op, and the count.

```python
from notifier import Channel, Event, NotificationService


class RecordingChannel:
    """A plain channel — NOT a subclass of Channel. Structural typing lets it qualify."""

    def __init__(self) -> None:
        self.received: list[Event] = []

    def send(self, event: Event) -> None:
        self.received.append(event)


def test_plain_class_is_structurally_a_channel():
    ch = RecordingChannel()
    assert isinstance(ch, Channel)  # @runtime_checkable: no inheritance needed


def test_subscribe_and_publish_delivers():
    service = NotificationService()
    ch = RecordingChannel()
    service.subscribe("orders", ch)
    event = Event("orders", {"id": 1})
    service.publish(event)
    assert ch.received == [event]


def test_multiple_channels_all_receive_in_order():
    service = NotificationService()
    first, second = RecordingChannel(), RecordingChannel()
    service.subscribe("orders", first)
    service.subscribe("orders", second)
    event = Event("orders")
    service.publish(event)
    assert first.received == [event]
    assert second.received == [event]


def test_channel_only_gets_its_own_topic():
    service = NotificationService()
    ch = RecordingChannel()
    service.subscribe("orders", ch)
    service.publish(Event("rides"))  # different topic
    assert ch.received == []


def test_predicate_filters_events():
    service = NotificationService()
    ch = RecordingChannel()
    service.subscribe("orders", ch, predicate=lambda e: e.payload.get("total", 0) > 100)
    big = Event("orders", {"total": 250})
    small = Event("orders", {"total": 5})
    service.publish(big)
    service.publish(small)
    assert ch.received == [big]  # only the matching event is delivered


def test_publish_to_empty_topic_is_noop():
    service = NotificationService()
    service.publish(Event("nobody-listening"))  # must not raise


def test_subscriber_count():
    service = NotificationService()
    assert service.subscriber_count("orders") == 0
    service.subscribe("orders", RecordingChannel())
    service.subscribe("orders", RecordingChannel())
    assert service.subscriber_count("orders") == 2
    assert service.subscriber_count("rides") == 0
```

Run with `cd python-katas && .venv/bin/pytest solution/notifier` (or `practice/notifier` for your own attempt). `RecordingChannel` having **no base class** is the whole point of `test_plain_class_is_structurally_a_channel` — if it passed by inheriting `Channel` it would prove nothing; passing as a bare class proves structural conformance. The order test asserts *both* channels received *and* that a shared `Event` object reaches each, pinning subscription-order fan-out.

### Implement it

The storage is a `dict` from topic to a list of subscriptions, each a `(channel, predicate)` pair. `subscribe` appends (preserving order); `publish` walks the topic's list and calls `channel.send(event)` for every subscriber whose predicate passes; `subscriber_count` reads the list length. Every lookup uses `.get(topic, ())` so unknown topics are a clean no-op.

```python
@dataclass(frozen=True)
class _Subscription:
    channel: Channel
    predicate: Callable[[Event], bool] | None


class NotificationService:
    """The Observer *subject*: fans published events out to subscribed channels by topic."""

    def __init__(self) -> None:
        self._subscribers: dict[str, list[_Subscription]] = {}

    def subscribe(
        self,
        topic: str,
        channel: Channel,
        *,
        predicate: Callable[[Event], bool] | None = None,
    ) -> None:
        self._subscribers.setdefault(topic, []).append(_Subscription(channel, predicate))

    def publish(self, event: Event) -> None:
        for sub in self._subscribers.get(event.topic, ()):
            if sub.predicate is None or sub.predicate(event):
                sub.channel.send(event)  # dynamic dispatch onto any conforming object

    def subscriber_count(self, topic: str) -> int:
        return len(self._subscribers.get(topic, ()))
```

The key gotcha is what `Channel` being a `Protocol` buys you: **structural typing**. `publish` never checks a type — it just calls `sub.channel.send(event)`, and *any* object with a `send` method slots in with no inheritance, no registration, no import of `Channel` at the transport. That is why the plain `RecordingChannel` in the tests works. `@runtime_checkable` is orthogonal: it exists only so callers can do `isinstance(obj, Channel)` at runtime — and it checks solely that a `send` attribute *exists*, not its signature, so it's a shape check, not a contract check. Predicates stay as first-class `Callable` filters (`sub.predicate is None or sub.predicate(event)`) so a lambda expresses "orders over $100" inline without a subclass. And the shape of the whole thing is the **Observer pattern**: the service is the subject holding per-topic observer lists and pushing each event out, leaving publishers oblivious to who listens.

### Common mistakes & senior signal

The headline trap: **reaching for an ABC and inheritance** when the set of transports should stay open. A Protocol models "has a `send` method" without forcing anyone to subclass — name that and you've shown you know Python's structural-typing tools.

- **Making `Channel` an ABC subclasses must inherit.** Forces every transport (including third-party objects you don't own) to subclass `Channel` — coupling for no benefit. **Senior signal** — model the transport as a `Protocol` so any object with `send` conforms structurally, and only fall back to nominal typing when you genuinely need a shared implementation.
- **Assuming `@runtime_checkable` validates signatures.** `isinstance(obj, Channel)` passes for *any* object with a `send` attribute, wrong signature and all — it's an existence check. **Senior signal** — state that `@runtime_checkable` checks method *presence* only, add it solely when runtime `isinstance` is needed, and lean on the static type checker (not `isinstance`) for signature conformance.
- **Building a `FilterChannel` subclass for predicates.** Turns a one-line lambda into a class hierarchy. **Senior signal** — pass filters as first-class `Callable[[Event], bool]` values, keeping subscriptions declarative.
- **Letting an unknown topic raise (`self._subscribers[topic]`).** A `KeyError` on a topic nobody subscribed to is a bug, not a feature. **Senior signal** — use `.get(topic, ())` so publish and count degrade to a clean no-op / zero.
- **Losing delivery order (e.g. storing subscribers in a `set`).** Fan-out becomes nondeterministic and the order test flakes. **Senior signal** — keep a `list` and deliver in subscription order, calling out that determinism is part of the contract.

Extensions that show depth: return an **unsubscribe handle** from `subscribe` (a token or closure that removes the subscription); deliver **asynchronously** (`async def send`, fan out with `asyncio.gather`); add **per-channel retry** so one failing `send` doesn't abort the fan-out.

## In-Memory File System — Recursion & the Data Model

### Summary

**What this topic covers**

You build the engine behind an in-memory file system: directories nest to form a tree, files hold string content, and every operation names a node by an absolute `/`-separated path (`"/a/b/c"`, with `"/"` the root). `mkdir` creates a directory and every missing parent (`mkdir -p`); `write` stores a file under an existing directory; `read` fetches content; `ls` lists a directory's children; `find` locates every node with a given name anywhere in the tree; `mv` relocates a file or a whole subtree. This is the canonical "design the data model, then let recursion do the walking" LLD question — a single small design decision (tree of nodes vs. flat dict of paths) dictates how clean every operation turns out. The Python topic it drills is the **data model**: `dataclass` nodes, a `File | Dir` union, and a container dunder (`__contains__`) that makes `"/a/b" in fs` read like membership.

**Mental model**

A directory *is* a `dict[str, Node]` mapping each child's **name** to its node; a file *is* a string of content. Every operation is the same two-beat move: **walk the path, then act.** Split the path into components, descend the tree one component at a time from the root, and either resolve to a node or fail. All the behaviour lives in resolution — a missing intermediate directory, or an intermediate component that turns out to be a file rather than a directory, is exactly what makes each operation raise. Two operations recurse *over* the tree rather than *down* a single path: `find` is a depth-first walk of the whole tree collecting nodes whose basename matches, and `mv` of a directory carries its entire subtree along for free — because a `Dir` *is* the root of its subtree, re-parenting the one node moves everything beneath it, no per-child copying. The lever the whole kata turns on: pick the tree model, write path resolution *once*, and every operation becomes a few lines on top of it.

**Key terms**

- **tree of dir/file nodes** — a `Dir` holds `dict[str, Node]` (name → child); a `File` holds `content`. The recursive shape a real file system has, modelled directly.
- **recursive path resolution** — split `"/a/b"` into `["a", "b"]`, descend from the root component by component; each failure mode (missing node, file-where-a-dir-was-expected) lives here. Written once, shared by `read`/`write`/`ls`/`mv`.
- **`mkdir -p` semantics** — create the target *and* every missing intermediate directory; an existing dir is a no-op; a component that is an existing **file** raises.
- **DFS `find`** — a depth-first walk of the whole tree collecting the absolute path of every node whose basename equals the query, returned sorted.
- **subtree `mv`** — moving a directory re-parents a single node; its whole subtree comes along "for free" because the node *is* the subtree.
- **dunder `__contains__`** — implementing `x in fs` (path existence) as the container protocol, not an `exists()` method.
- **dataclasses** — `@dataclass class File`/`Dir` give explicit, typed nodes with `field(default_factory=dict)` for the children map (never a mutable default).
- **tree-vs-flat-dict tradeoff** — a flat `dict[str, str]` keyed by full path makes `read`/`write` one lookup but pushes cost onto `ls` (scan every key for a prefix) and subtree-`mv` (rewrite every descendant key). The tree pays a little on `read` to make `ls`/`mv` structural and cheap.

**Why interviewers ask this**

It's a data-model question dressed as a coding task, and it sorts people by their *first move*. A junior reaches for a flat `dict[path] = content`, watches `read`/`write` fall out in one line, then hits a wall on `ls` (which now means "scan every key for a shared prefix") and drowns on subtree-`mv` (rewrite every descendant key, and don't miss one). A senior states the two models out loud, picks the tree because directory operations are where the cost belongs, then writes path resolution *once* and lets `read`/`ls`/`mv`/`write` share it — turning six operations into six short methods. The tells are: recognising `find` and subtree-`mv` as recursion *over the tree* (not down a path), knowing subtree-`mv` is free under the tree model, and reaching for `__contains__` instead of inventing `exists()`. It also surfaces judgement on the small stuff — path normalisation, the file-vs-dir type clash, `mkdir` not clobbering existing children.

**Common confusions**

- *"A flat `dict[path]` is simpler, so use it."* — Simpler for `read`/`write`, brutal for `ls` and subtree-`mv`. Match the structure to the operations that dominate.
- *"`mv` of a directory has to copy all the children."* — No. The `Dir` node *is* the subtree; re-parent the one node and everything beneath comes with it.
- *"`find` walks a path."* — `find` walks the whole tree (DFS), collecting by basename. It's the one operation that ignores paths entirely until it builds them for the result.
- *"An existing `mkdir` should recreate the directory."* — It's a no-op; recreating it would clobber children. Only a *file* at that component is an error.
- *"Split with `path.split('/')` and use the parts directly."* — Leading `/` and `//` produce empty strings; `"/"` must normalise to `[]`. Filter the blanks.

**What follows from this topic**

This is the gateway to the rest of the container-protocol and recursion family: add `rm`/`rmdir` (and decide whether `rmdir` requires the directory be empty), symbolic links (resolution now has to *follow* links — and guard against link loops), or an `os.walk`-style `walk()` **generator** that yields `(dirpath, dirnames, filenames)` — the natural bridge into iterators and `yield`. The tree-walk you write here is the same shape behind JSON/DOM traversal, trie autocomplete, and any nested-config resolver; the `__contains__`/`__getitem__` move recurs anywhere you want a domain object to feel like a built-in container.

### Clarify & design the API

Clarifying questions worth asking out loud: are paths always absolute (yes — `"/"`-rooted, reject relative)? Does `mkdir` create missing parents (yes — `mkdir -p`)? Is `find` by basename anywhere in the tree, or by path (basename, whole tree)? Does `mv` of a directory move the whole subtree (yes — that's the interesting case)? What happens on a type clash — a file where a directory is expected, or vice versa (raise `FileSystemError`)? Do we need `rm` (no — leave it as the extension)?

The **data-model decision is the design.** Model a directory as a node holding `dict[str, Node]` (name → child) and a file as a node holding content — `dataclass`es make each explicit and typed, and `Node = File | Dir` is the union every operation branches on. Then every method is "walk the path, then act," with path resolution written once and shared. Say the alternative out loud (flat `dict[str, str]` keyed by full path) and why you're not taking it.

```python
from __future__ import annotations
from dataclasses import dataclass, field


class FileSystemError(Exception):
    """Invalid operation: a missing path, a missing parent, or a file/dir type clash."""


@dataclass
class File:
    content: str


@dataclass
class Dir:
    children: dict[str, "Node"] = field(default_factory=dict)  # name -> node


Node = File | Dir


class FileSystem:
    def __init__(self) -> None:
        self._root = Dir()

    def mkdir(self, path: str) -> None: ...                    # mkdir -p; existing dir is a no-op
    def write(self, path: str, content: str) -> None: ...       # parent must exist; overwrites
    def read(self, path: str) -> str: ...                       # missing path / a dir raises
    def ls(self, path: str) -> list[str]: ...                   # sorted child names; file -> [basename]
    def find(self, name: str) -> list[str]: ...                 # DFS; every matching path, sorted
    def mv(self, src: str, dst: str) -> None: ...               # file or whole subtree
    def __contains__(self, path: str) -> bool: ...              # "/a/b" in fs
```

The tree model means `read` pays a path-walk (a few dict lookups) that the flat dict wouldn't — but in exchange `ls` is `sorted(node.children)` and subtree-`mv` is a single re-parent. Choosing the model whose cost lands on the operations you *don't* mind paying for is the senior signal.

### Write the tests

The practice module ships **no tests** — designing them is the exercise. Cover the contract (`mkdir -p` + sorted `ls`, a write/read round-trip, overwrite), then every failure mode where resolution bites (read a missing path, read a directory, write under a missing parent, write where a directory already sits, `mkdir` over a file), then the two recursive operations that are the point — `find` across the tree and moving a whole subtree.

```python
import pytest
from filesystem import FileSystem, FileSystemError


def test_mkdir_p_then_ls_sorted():
    fs = FileSystem()
    fs.mkdir("/a/b/c")
    fs.mkdir("/a/x")
    assert fs.ls("/a") == ["b", "x"]      # sorted child names
    assert fs.ls("/a/b") == ["c"]


def test_write_then_read_round_trip():
    fs = FileSystem()
    fs.mkdir("/docs")
    fs.write("/docs/hello.txt", "hi there")
    assert fs.read("/docs/hello.txt") == "hi there"


def test_write_overwrites_existing_file():
    fs = FileSystem()
    fs.write("/note", "first")
    fs.write("/note", "second")
    assert fs.read("/note") == "second"


def test_nested_dirs_and_files():
    fs = FileSystem()
    fs.mkdir("/a/b")
    fs.write("/a/b/f1", "one")
    fs.write("/a/f2", "two")
    assert fs.ls("/a") == ["b", "f2"]
    assert fs.ls("/a/b") == ["f1"]


def test_read_missing_path_raises():
    fs = FileSystem()
    with pytest.raises(FileSystemError):
        fs.read("/nope")


def test_write_to_missing_parent_raises():
    fs = FileSystem()
    with pytest.raises(FileSystemError):
        fs.write("/missing/dir/file", "x")


def test_ls_of_file_returns_basename():
    fs = FileSystem()
    fs.mkdir("/a")
    fs.write("/a/file.txt", "x")
    assert fs.ls("/a/file.txt") == ["file.txt"]


def test_find_by_basename_across_tree_sorted():
    fs = FileSystem()
    fs.mkdir("/a/target")
    fs.mkdir("/b")
    fs.write("/b/target", "x")
    fs.write("/a/other", "y")
    assert fs.find("target") == ["/a/target", "/b/target"]  # both, sorted
    assert fs.find("nothing") == []


def test_mv_a_file():
    fs = FileSystem()
    fs.mkdir("/a")
    fs.mkdir("/b")
    fs.write("/a/f", "content")
    fs.mv("/a/f", "/b/g")
    assert "/a/f" not in fs
    assert fs.read("/b/g") == "content"


def test_mv_a_directory_subtree():
    fs = FileSystem()
    fs.mkdir("/a/sub")
    fs.write("/a/sub/deep", "payload")
    fs.mkdir("/dest")
    fs.mv("/a", "/dest/a")
    assert "/a" not in fs
    assert fs.read("/dest/a/sub/deep") == "payload"  # children came along for free
    assert fs.ls("/dest/a") == ["sub"]


def test_contains():
    fs = FileSystem()
    fs.mkdir("/a")
    fs.write("/a/f", "x")
    assert "/a" in fs and "/a/f" in fs
    assert "/a/nope" not in fs


def test_mkdir_over_existing_file_raises():
    fs = FileSystem()
    fs.write("/f", "x")
    with pytest.raises(FileSystemError):
        fs.mkdir("/f/sub")
```

Run with `cd python-katas && .venv/bin/pytest practice/filesystem` (or `solution/filesystem` for the reference). The subtree-`mv` test is the one that proves you got the model right: `read("/dest/a/sub/deep")` only succeeds if re-parenting `/a` carried its whole subtree — if you find yourself copying children in `mv`, that test will still pass but you've done far too much work. The two "raises" families (missing path, missing parent) are what pin your single resolution routine.

### Implement it

Write path resolution **once** and share it. `_resolve` walks the components from the root, raising on a missing node or a file-where-a-dir-was-needed; `_resolve_dir` is `_resolve` plus a "must be a directory" check. Everything else is a few lines on top. `find` and subtree-`mv` are the two that recurse over the tree.

```python
def _split(path: str) -> list[str]:
    """'/a/b' -> ['a', 'b'];  '/' -> [].  Reject relative paths."""
    if not path.startswith("/"):
        raise FileSystemError(f"path must be absolute: {path!r}")
    return [part for part in path.split("/") if part]   # drop '' from leading/double slashes


class FileSystem:
    def __init__(self) -> None:
        self._root = Dir()

    def _resolve(self, parts: list[str], path: str) -> Node:
        node: Node = self._root
        for part in parts:                              # walk one component at a time
            if isinstance(node, File):
                raise FileSystemError(f"not a directory: {path!r}")
            child = node.children.get(part)
            if child is None:
                raise FileSystemError(f"no such path: {path!r}")
            node = child
        return node

    def _resolve_dir(self, parts: list[str], path: str) -> Dir:
        node = self._resolve(parts, path)
        if isinstance(node, File):
            raise FileSystemError(f"not a directory: {path!r}")
        return node

    def mkdir(self, path: str) -> None:
        node: Dir = self._root
        for part in _split(path):
            child = node.children.get(part)
            if child is None:
                child = node.children[part] = Dir()     # create missing parent (mkdir -p)
            elif isinstance(child, File):
                raise FileSystemError(f"not a directory: {part!r} in {path!r}")
            node = child                                # existing Dir: descend, don't clobber

    def write(self, path: str, content: str) -> None:
        parts = _split(path)
        if not parts:
            raise FileSystemError("cannot write to the root")
        parent = self._resolve_dir(parts[:-1], path)    # parent must already exist
        if isinstance(parent.children.get(parts[-1]), Dir):
            raise FileSystemError(f"is a directory: {path!r}")
        parent.children[parts[-1]] = File(content)

    def read(self, path: str) -> str:
        node = self._resolve(_split(path), path)
        if isinstance(node, Dir):
            raise FileSystemError(f"is a directory: {path!r}")
        return node.content

    def ls(self, path: str) -> list[str]:
        parts = _split(path)
        node = self._resolve(parts, path)
        if isinstance(node, File):
            return [parts[-1]] if parts else [""]
        return sorted(node.children)                    # cheap because it's a real dir node

    def find(self, name: str) -> list[str]:
        found: list[str] = []

        def walk(node: Dir, prefix: str) -> None:       # DFS over the whole tree
            for child_name, child in node.children.items():
                here = f"{prefix}/{child_name}"
                if child_name == name:
                    found.append(here)
                if isinstance(child, Dir):
                    walk(child, here)

        walk(self._root, "")
        return sorted(found)

    def mv(self, src: str, dst: str) -> None:
        src_parts, dst_parts = _split(src), _split(dst)
        if not src_parts or not dst_parts:
            raise FileSystemError("cannot move the root")
        src_parent = self._resolve_dir(src_parts[:-1], src)
        node = src_parent.children.get(src_parts[-1])
        if node is None:
            raise FileSystemError(f"no such path: {src!r}")
        dst_parent = self._resolve_dir(dst_parts[:-1], dst)   # dst parent must exist
        del src_parent.children[src_parts[-1]]
        dst_parent.children[dst_parts[-1]] = node       # re-parent ONE node — subtree comes free

    def __contains__(self, path: str) -> bool:
        try:
            self._resolve(_split(path), path)
        except FileSystemError:
            return False
        return True
```

The key gotcha is the model, and it pays off in `mv`. **Model the tree with nested `Dir` nodes** and recursion becomes the natural shape of path resolution — one `_resolve` loop, shared by every operation, where each failure mode (missing node, file-where-a-dir-was-expected) lives in exactly one place. **Subtree-`mv` then falls out for free**: because a `Dir` node *is* the root of its subtree, `del` from the old parent and assign to the new one moves the entire subtree in two lines — no descendant copying, no key rewriting. The **flat-`dict[str, str]` alternative** inverts the cost: `read`/`write` are one lookup, but `ls` must scan every key for a shared prefix and subtree-`mv` must find and rewrite every descendant key (and it's easy to miss one, or to corrupt a path that's a prefix of another). The tree spends a cheap path-walk on `read` to make the directory operations structural — the right default whenever `ls`/`mv` matter, which in a file system they always do.

### Common mistakes & senior signal

The headline trap: **reaching for a flat `dict[path]` because `read`/`write` look easy.** State both models and pick the tree because it puts the cost where it belongs. **Senior signal** — naming the tradeoff unprompted and justifying the choice by which operations dominate, rather than by which is easiest to type first.

- **Copying children in `mv` of a directory.** Walking the subtree and re-inserting every node is wasted work and a bug farm. Re-parent the single `Dir` node; the subtree is *inside* it. **Senior signal** — recognising that a `Dir` node *is* its subtree, so the move is O(1) structural, not O(descendants).
- **Duplicating the walk in every method.** Inlining "split, descend, check" into `read`, `ls`, `write`, and `mv` means four places to get the file-vs-dir clash subtly different. **Senior signal** — one `_resolve` (plus a thin `_resolve_dir`) that every operation shares, so the failure modes are defined exactly once.
- **Fumbling path normalisation.** `"/".split("/")` is `["", ""]`; leading and double slashes leak empty components. Filter the blanks so `"/"` → `[]`. **Senior signal** — deciding up front what an absolute path requires and rejecting the rest in one helper.
- **`mkdir` clobbering an existing directory.** Re-creating the node drops its children. An existing `Dir` is a no-op to descend into; only an existing *file* at that component is the error. **Senior signal** — distinguishing "already exists as a dir" (fine) from "exists as a file" (a type clash) rather than blindly overwriting.
- **Inventing `exists()` instead of `__contains__`.** `"/a/b" in fs` is what path existence should read like — that's the container protocol. **Senior signal** — reaching for the data-model dunder and implementing membership as `try: _resolve; except: False`, reusing the one resolver.

Extensions that show depth: add `rm`/`rmdir` (and decide whether `rmdir` requires the directory be empty); symbolic links (resolution must now *follow* links and guard against link loops); or an `os.walk`-style `walk()` **generator** that `yield`s `(dirpath, dirnames, filenames)` — the same DFS as `find`, turned into a lazy iterator.


## Feed Parser — Streaming, Zero-Copy & Malformed-Line Handling

### Summary

**What this topic covers**

You build the feed handler that sits at the ingest edge of a pricing stack: a market-data gateway
receives quotes as a text firehose — one pipe-delimited record per line, `SYMBOL|BID|ASK|QTY` (e.g.
`LIV-MUN|1.95|2.05|1000`) — arriving over a socket, a file tail, or a replay. The stream is peppered
with `#` comment lines and blank separators, and because it comes off a wire from a dozen venues,
some lines are malformed: a missing field, an empty symbol, a price that won't parse, a negative
size. `parse_feed(lines)` turns that text stream into typed `Quote`s **as they arrive**, and it must
never throw the whole batch away because one line was bad — every reject is reported with the exact
1-based *physical* line number so an operator can find it in the raw capture. The signature Python
topic it drills is the **generator**: `yield`, lazy pull-based evaluation, and streaming an unbounded
input in O(1) memory — plus modelling a reject as a *value* (a frozen dataclass) rather than a raise,
so one bad line doesn't abort the stream.

**Mental model**

A junior writes `def parse_feed(...)` that appends to a `result` list and returns it. That forces the
*entire* feed to be read before the first quote comes back — impossible on an unbounded socket stream
and wasteful on a finite one (the whole capture sits in RAM). A generator inverts control: `parse_feed`
reads one line, computes one `Parsed`, `yield`s it, and *suspends* until the consumer pulls the next.
Memory is O(1) in the number of lines — only the current line's fields are alive — and it composes
with `for`, `itertools`, and an `islice`-style *take* for free; a consumer that wants only the first
few quotes (`next`, an early `break`) stops the parser mid-feed without touching the rest. The second
idea is that a malformed line is **data, not control flow**. Rather than `raise` on a bad print — which
would abort the other 999 good lines — you build a `ParseError` value carrying the line number and the
`ErrorKind`, wrap it in a `Parsed`, and `yield` it. The stream keeps flowing; the *caller* decides
whether to log, alert, or halt. The last subtlety is the counter: blanks and comments are skipped but
still **advance the physical line number** (`enumerate(lines, start=1)`), because an error at record 4
that's really line 8 of the capture is useless to the operator staring at the raw file.

**Key terms**

- **generator / `yield`** — a function containing `yield` returns an iterator; each `yield` produces
  one `Parsed` and suspends the frame, resuming on the next `next()`. This is what makes it streaming.
- **lazy pull-based evaluation** — nothing runs until the consumer pulls; work happens on demand, one
  line at a time, at minimum latency — never batching to end-of-file.
- **O(1) memory vs building a list** — the whole game: a `return [...]` buffers every result (and
  forces reading all lines first); the generator holds only the line it's on.
- **`Iterable[str]` → `Iterator[Parsed]`** — the input is *any* line iterable (a file object, a
  socket-line iterator, `splitlines()`); program to the protocol, not the concrete type.
- **error-as-value** — `ParseError` is a frozen `@dataclass` that *also* subclasses `Exception`, so a
  caller *may* raise it, but the parser treats it as a value and yields it — one bad line ≠ a dead stream.
- **physical line number** — 1-based, counts *every* line including skipped comments/blanks, so a
  reject points at the real line in the capture. Skipping without advancing the counter is the classic bug.
- **fixed validation order** — field-count → empty-symbol → bid → ask → qty; the first problem wins
  deterministically, so a short line with a bad price is a `WRONG_FIELD_COUNT`, not an `INVALID_BID`.

**Why interviewers ask this**

It separates people who reach for a list because it "works on my test array" from people who see the
input is a *stream* and design for it. A junior returns `list`, reads the whole feed, `raise`s on the
first bad line (killing the batch), and numbers errors by record instead of by physical line. A senior
states the contract precisely — lazy, pull-based, O(1) memory, one `Parsed` per non-skipped line,
errors as values — then writes the `enumerate`-driven generator, remembers that comments still advance
the counter, and *proves laziness with a test* (a generator input that raises if fully consumed,
asserting `next(parse_feed(...))` returns the first quote without tripping it). It also probes the
money stakes: this is the ingest edge where every downstream book and fill is priced off these quotes,
so rejecting a garbage bid or a negative size *at the door* is what stops a bad print from mispricing
or crashing a strategy.

**Common confusions**

- *"Return a list — it works on my test feed."* — It reads the whole stream before the first quote and
  can't handle an unbounded source. A generator yields incrementally in O(1) memory.
- *"A malformed line should raise."* — Then one venue's bad print aborts every other line. Model the
  reject as a `ParseError` value inside a `Parsed` and `yield` it; the caller decides what to do.
- *"Number the errors by record."* — Operators read the raw capture; count *physical* lines
  (`enumerate(lines, start=1)`), advancing over skipped comments and blanks.
- *"Validation order doesn't matter."* — It's the contract. Stop at the first failure in a fixed order
  so a line that's both short and has a bad price is deterministically a `WRONG_FIELD_COUNT`.
- *"`int(qty)` is enough."* — A negative size is nonsense and `int("1.5")` raises; reject both as
  `INVALID_QTY`, and remember `0` is a *valid* size.

**What follows from this topic**

The lazy-generator + error-as-value pattern generalises to any stream ingest: log parsers, CSV/JSONL
readers, protocol decoders. The natural extensions turn it into a bigger kata: make the parser
**resumable across chunks** — feed it successive `recv()` buffers, holding a partial trailing line
between calls (a real socket never delivers whole lines) — or add a variant that keys quotes by symbol
and yields a lazily-updated best-bid/best-offer per instrument as the feed streams. Both build on the
same insight: the generator holds the *minimum* state and emits on demand. The idiom carries straight
into `itertools` pipelines and the market-data bar aggregator (the next kata), which is the same
one-item-at-a-time state machine over an unbounded tick stream.

### Clarify & design the API

Questions worth asking out loud: does the parser return a list or *stream* (stream — a lazy generator,
because the feed is unbounded and downstream wants quotes at low latency)? On a bad line, do we raise
or keep going (keep going — one malformed venue print must not abort the batch)? Are error line numbers
record-relative or physical (physical — the operator reads the raw capture, so skipped comments and
blanks still count)? Is validation order defined (yes, and it's the contract: field-count →
empty-symbol → bid → ask → qty, first failure wins)? Is `qty` signed, and is `0` valid (non-negative
int; `0` is fine, a negative size is `INVALID_QTY`)?

The **stream-not-list decision** is the design. `parse_feed` is a generator: it consumes `lines` one
at a time via `enumerate(lines, start=1)` and `yield`s one `Parsed` per non-skipped line, never
materialising the input. Each `Parsed` carries the physical line number and *exactly one* of `quote` /
`error`. The reject is modelled as a value — a frozen `ParseError` (line + `ErrorKind`) — so yielding
it keeps the stream alive. `parse_all` is the eager collector on top, draining the generator into
`(quotes, errors)` for tests and batch jobs.

```python
from collections.abc import Iterable, Iterator
from dataclasses import dataclass
from enum import Enum, auto


@dataclass(frozen=True)
class Quote:                      # a two-way price: SYMBOL|BID|ASK|QTY
    symbol: str
    bid: float
    ask: float
    qty: int


class ErrorKind(Enum):            # why a line failed — checked in this order
    WRONG_FIELD_COUNT = auto()
    EMPTY_SYMBOL = auto()
    INVALID_BID = auto()
    INVALID_ASK = auto()
    INVALID_QTY = auto()


@dataclass(frozen=True)
class ParseError(Exception):      # a data-carrying reject; yielded as a value, not raised
    line: int
    kind: ErrorKind


@dataclass(frozen=True)
class Parsed:                     # one non-skipped line: exactly one of quote / error
    line: int
    quote: Quote | None
    error: ParseError | None


def parse_feed(lines: Iterable[str]) -> Iterator[Parsed]:
    ...   # generator: yield one Parsed per non-skipped line, lazily

def parse_all(lines: Iterable[str]) -> tuple[list[Quote], list[ParseError]]:
    ...   # eager collector: drain parse_feed into (quotes, errors)
```

Say the trade-off explicitly: a generator streams an unbounded feed in O(1) memory and stops the
instant the consumer does, at the cost that you can't index or re-read it — which is exactly right for
a live wire. Modelling the reject as a *value* rather than raising is the other design choice to
volunteer: it's what lets the parser keep flowing past a bad line while still handing the caller the
full failure (line + kind) to act on.

### Write the tests

The README ships **no tests** — designing them is the exercise, and it's where you prove you understand
the semantics, not just the syntax. Anchor on the **canonical feed** (shared verbatim across every
language mirror) and assert the exact quotes *and* the exact `(line, kind)` errors — the physical line
numbers are the whole point. Then cover each error variant, the validation-order tie-breaks, empty and
comment-only input, and — the test that carries the design — **laziness**: a generator input that
raises if fully consumed, proving `next()` returns items without draining it.

```python
import pytest
from . import ErrorKind, Parsed, ParseError, Quote, parse_all, parse_feed

CANONICAL = [
    "# market data feed",
    "LIV-MUN|1.95|2.05|1000",
    "",
    "ARS-CHE|1.50|1.60|500",
    "|1.0|2.0|10",        # line 5: empty symbol
    "BAD|x|2.0|10",       # line 6: bad bid
    "TOO|1.0|2.0",        # line 7: 3 fields
    "NEG|1.0|2.0|-5",     # line 8: negative qty
]


def test_canonical_feed_quotes_and_errors_are_exact():
    quotes, errors = parse_all(CANONICAL)
    assert quotes == [
        Quote("LIV-MUN", 1.95, 2.05, 1000),
        Quote("ARS-CHE", 1.50, 1.60, 500),
    ]
    assert [(e.line, e.kind) for e in errors] == [
        (5, ErrorKind.EMPTY_SYMBOL),
        (6, ErrorKind.INVALID_BID),
        (7, ErrorKind.WRONG_FIELD_COUNT),
        (8, ErrorKind.INVALID_QTY),
    ]


def test_error_carries_physical_line_number():
    # comments/blanks are skipped but still advance the physical counter
    _, errors = parse_all(["#c", "", "|1|2|3"])
    assert errors == [ParseError(3, ErrorKind.EMPTY_SYMBOL)]


def test_validation_order_first_problem_wins():
    _, e = parse_all(["|x|2.0"])       # 3 fields -> field count beats empty symbol / bad bid
    assert e == [ParseError(1, ErrorKind.WRONG_FIELD_COUNT)]
    _, e = parse_all(["|x|2.0|3"])     # empty symbol beats bad bid
    assert e == [ParseError(1, ErrorKind.EMPTY_SYMBOL)]


def test_qty_zero_valid_negative_and_float_rejected():
    quotes, _ = parse_all(["A|1.0|2.0|0"])
    assert quotes == [Quote("A", 1.0, 2.0, 0)]                 # 0 is a valid size
    _, errors = parse_all(["A|1.0|2.0|-1", "A|1.0|2.0|1.5"])
    assert [e.kind for e in errors] == [ErrorKind.INVALID_QTY, ErrorKind.INVALID_QTY]


def test_empty_and_comment_only_feeds_yield_nothing():
    assert list(parse_feed([])) == []
    assert list(parse_feed(["# header", "   ", "", "# footer"])) == []


def test_is_lazy_consumes_incrementally():
    def stream():
        yield "A|1.0|2.0|1"
        yield "B|3.0|4.0|2"
        raise AssertionError("generator fully consumed — parsing is not lazy")

    gen = parse_feed(stream())
    assert next(gen).quote == Quote("A", 1.0, 2.0, 1)
    assert next(gen).quote == Quote("B", 3.0, 4.0, 2)   # third item never pulled → no raise
```

Run with `cd python-katas && .venv/bin/pytest practice/feedparser` (or `solution/feedparser` for the
reference). The laziness test is the one that matters: a list-building implementation would drain
`stream()`, hit the `AssertionError`, and fail — so the test fails precisely when someone drops the
generator for a list. The validation-order test pins the tie-breaks that a naive "check everything and
collect all errors" implementation would get wrong.

### Implement it

The whole parser is one generator loop over `enumerate(lines, start=1)`. Trim each line; `continue`
past blanks and `#` comments (which still advanced the counter for free). Split on `|`, then run the
five checks *in order*, `yield`ing an error `Parsed` and `continue`ing at the first failure — so the
first problem wins. `bid`/`ask` go through `float()` in a `try/except ValueError`; `qty` goes through
a helper that rejects non-integers and negatives. On a clean line, `yield` a success `Parsed`.

```python
def parse_feed(lines: Iterable[str]) -> Iterator[Parsed]:
    for line_no, raw in enumerate(lines, start=1):     # physical, 1-based, counts every line
        text = raw.strip()
        if not text or text.startswith("#"):
            continue                                   # skip — but the counter already moved

        fields = text.split("|")
        if len(fields) != 4:                           # 1. field count wins over everything
            yield _error(line_no, ErrorKind.WRONG_FIELD_COUNT)
            continue

        symbol, bid_s, ask_s, qty_s = fields
        symbol = symbol.strip()
        if not symbol:                                 # 2. empty symbol
            yield _error(line_no, ErrorKind.EMPTY_SYMBOL)
            continue

        try:                                           # 3. bid must be a float
            bid = float(bid_s)
        except ValueError:
            yield _error(line_no, ErrorKind.INVALID_BID)
            continue

        try:                                           # 4. ask must be a float
            ask = float(ask_s)
        except ValueError:
            yield _error(line_no, ErrorKind.INVALID_ASK)
            continue

        qty = _parse_qty(qty_s)                        # 5. qty: non-negative int
        if qty is None:
            yield _error(line_no, ErrorKind.INVALID_QTY)
            continue

        yield Parsed(line_no, Quote(symbol, bid, ask, qty), None)


def parse_all(lines: Iterable[str]) -> tuple[list[Quote], list[ParseError]]:
    quotes: list[Quote] = []
    errors: list[ParseError] = []
    for item in parse_feed(lines):                     # drains the generator eagerly
        if item.quote is not None:
            quotes.append(item.quote)
        else:
            assert item.error is not None
            errors.append(item.error)
    return quotes, errors


def _error(line_no: int, kind: ErrorKind) -> Parsed:
    return Parsed(line_no, None, ParseError(line_no, kind))   # reject as a value, never raised


def _parse_qty(text: str) -> int | None:
    try:
        qty = int(text)                                # int("1.5") raises → INVALID_QTY
    except ValueError:
        return None
    return qty if qty >= 0 else None                   # negative size is nonsense
```

The headline gotcha is that `yield` (not `return [...]`) is what makes this stream: the loop suspends
at each `yield` and resumes only when the consumer pulls, so memory is O(1) and a caller that `break`s
early reads no further — the parser never sees the rest of the feed. The second is that skipped
comments and blanks `continue` *inside* the `enumerate` loop, so `line_no` keeps climbing past them —
that's what makes error line numbers physical (an error at index 3 correctly reports line 8 of the
capture). The third is error-as-value: `_error` builds a `ParseError` and wraps it in a `Parsed` that
gets `yield`ed like any success, so one bad line is just another item in the stream, not a raise that
kills it. And the validation `continue`s enforce the fixed order for free — the first check that fires
yields and skips the rest, so a short line with a bad price is a `WRONG_FIELD_COUNT`, deterministically.

### Common mistakes & senior signal

- **Returning a list instead of a generator.** `return [...]` reads the whole feed before the first
  quote and can't handle an unbounded stream — the design collapses on a live socket. **Senior
  signal** — writes a `yield`-per-line generator, states the O(1)-memory / lazy-pull contract, and
  proves it with a test that raises if the input is fully consumed.
- **Raising on a malformed line.** A `raise` aborts every other good line in the batch — one bad venue
  print blacks out the market. **Senior signal** — models the reject as a `ParseError` *value* inside a
  `Parsed` and yields it, keeping the stream flowing; the caller decides to log, alert, or halt.
- **Numbering errors by record instead of physical line.** Counting only non-skipped lines means an
  error points at the wrong place in the raw capture. **Senior signal** — `enumerate(lines, start=1)`
  and `continue`s past comments/blanks *after* the counter advances, so line numbers are physical.
- **Getting validation order wrong (or collecting all errors).** Checking bid before field-count, or
  reporting every failure on a line, breaks the deterministic first-problem-wins contract. **Senior
  signal** — checks field-count → empty-symbol → bid → ask → qty and `continue`s at the first failure.
- **Sloppy `qty` parsing.** `int(qty)` alone lets a negative size through and raises on `1.5`. **Senior
  signal** — rejects non-integers and negatives as `INVALID_QTY` in a helper, and remembers `0` is valid.
- **Storing mutable / stringly-typed results.** Passing dicts or tuples around loses type safety and
  invites accidental mutation. **Senior signal** — frozen `@dataclass` `Quote`/`ParseError`/`Parsed`
  with full type hints, and an `Enum` `ErrorKind` so callers `match` on the failure.

Extensions that show depth: make the parser **resumable across chunks** — feed it successive `recv()`
buffers, holding a partial trailing line between calls, since a real socket never delivers whole lines;
or add a variant that keys quotes by symbol and yields a lazily-updated best-bid/best-offer per
instrument as the feed streams — the same generator, now carrying a little running state.
