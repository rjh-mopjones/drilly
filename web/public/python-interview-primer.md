---
type: interview-prep
---

# Python Interview Primer — 86 Questions

Comprehensive Q+A primer for senior Python backend interviews. Sister note to the [[Go Interview Primer]] and [[Rust Interview Primer]] — same shape, Python-flavoured: the data model, decorators/generators/closures, OOP & metaclasses, the GIL/threading/multiprocessing, asyncio, memory & GC, typing, and idioms/pitfalls.

Each answer is interview-shaped: opinionated, concrete, code where it clarifies. CPython, Python 3.12 baseline (version-gated features called out where relevant).

1. [[#Core Python & the Data Model]]
2. [[#Names, Binding & Mutability]]
3. [[#Built-in Data Structures]]
4. [[#Functions, Closures & Scope]]
5. [[#Decorators]]
6. [[#Generators & Iterators]]
7. [[#Comprehensions & Functional]]
8. [[#OOP & Classes]]
9. [[#Inheritance, MRO & Metaclasses]]
10. [[#Typing & Type Hints]]
11. [[#The GIL, Threading & Multiprocessing]]
12. [[#Async / Asyncio]]
13. [[#Memory Management & GC]]
14. [[#Exceptions & Context Managers]]
15. [[#Strings, Bytes & Encoding]]
16. [[#Modules, Packaging & Environments]]
17. [[#Testing & Tooling]]
18. [[#Performance, Idioms & Pitfalls]]

---

## Core Python & the Data Model

### Summary

**What this topic covers** — This is the bedrock: how CPython represents everything as an object, the difference between identity (`is`) and equality (`==`), the data model (dunder protocols) that lets your own types plug into built-in syntax, Python's place in the strong/weak and static/dynamic typing quadrant, and truthiness. These are the questions that separate someone who *uses* Python from someone who understands *how it actually behaves* when things get subtle.

**Mental model** — Think of a Python variable as a labelled sticky note pointing at an object that lives on the heap, not a box that contains a value. Assignment never copies; it rebinds the name to point at an object. Every object has three things baked in: an identity (its address, what `id()` returns and what `is` compares), a type (immutable, what `type()` returns), and a value. Names live in namespaces (dicts, essentially); objects live in the heap and are reference-counted. The "syntax" of Python — `len(x)`, `x[0]`, `for y in x`, `x + y`, `if x:` — is almost entirely sugar that dispatches to dunder methods (`__len__`, `__getitem__`, `__iter__`, `__add__`, `__bool__`) defined on the object's *type*, not the instance. Once you internalise "the interpreter calls protocols on types," the whole language stops being magic and becomes a small set of consistent rules.

**Key terms**
- **Object** — a heap-allocated value with identity, a type, and contents. Everything is one: ints, functions, classes, modules.
- **Identity** — the unique, constant id of an object for its lifetime; `id(x)` in CPython is the memory address.
- **Reference** — a name or container slot pointing at an object; assignment binds references, never copies.
- **Reference counting** — CPython's primary memory management: each object tracks how many references point at it; hits zero, it's freed immediately.
- **Dunder / magic method** — a method named `__like_this__` that the interpreter calls to implement syntax/protocols.
- **Data model** — the spec of dunder protocols (sequence, iterator, numeric, container, context manager, etc.).
- **Interning** — caching of certain immutable objects (small ints, some strings) so equal values share one object.
- **Strong typing** — no implicit cross-type coercion; `1 + '2'` raises rather than guessing.
- **Dynamic typing** — types attach to objects at runtime, not to names at compile time.
- **Truthiness** — every object has a boolean value used in `if`/`while`/`and`/`or`, derived from `__bool__` or `__len__`.
- **Type object** — `type` is itself an object; classes are instances of `type`, which is why classes are first-class.

**Why interviewers ask this** — These questions are a fast, reliable seniority filter. A junior says "`is` checks if two things are equal" and gets burned by `a is b` returning `True` for small ints and `False` for `1000`. A senior says "`is` is identity, `==` is equality, they coincide only when both names point at the same object, and CPython *caches* small ints (-5..256) and interns some string literals as an implementation detail you must never rely on." The interviewer is probing whether you understand the object model deeply enough to debug a mutable-default-argument bug, reason about why `==` can be expensive, or implement a clean custom collection. Getting `1 + '2'` right — *why* it raises instead of producing `'12'` or `3` — signals you understand strong typing as a deliberate design choice, not an accident.

**Common confusions**
- **"Variables hold values"** — no; names are references to heap objects. `a = b` makes two names point at one object.
- **"`is` is just a faster `==`"** — they answer different questions; `is` is identity, and using it for value comparison is a bug.
- **"Python is weakly typed because it's dynamic"** — conflates two axes. Python is strongly *and* dynamically typed.
- **"`is None` is a style choice"** — it's correct precisely because `None` is a singleton; `== None` can be overridden.
- **"Empty containers are truthy because they exist"** — `[]`, `{}`, `0`, `''` are all falsy via `__len__`/`__bool__`.

**What follows from this topic** — Identity-vs-equality flows straight into hashing and `__hash__`/`__eq__` contracts (dicts, sets), and into the mutable-default-argument gotcha. Reference counting connects to the cyclic garbage collector, `weakref`, and memory profiling with `tracemalloc`. The data model underpins iterators/generators, context managers, descriptors, and dataclasses. Strong-but-dynamic typing motivates the entire gradual-typing story: type hints, `mypy`, and runtime `isinstance` checks layered on a language that doesn't enforce them itself.

### Q1. Everything in Python is an object — explain what that means for variables, functions, and classes, and how it shapes the language.

"Everything is an object" means every value you can name — integers, strings, functions, classes, modules, even `type` itself — is a heap-allocated object with an identity, a type, and contents. There's no privileged category of "primitives" that behave differently. `(5).bit_length()` works because `5` is a full object; you just rarely call methods on int literals directly.

For **variables**, the consequence is that names are references, not containers. Assignment binds a name to an object; it never copies. So `a = [1, 2]; b = a` gives you two names pointing at one list, and `b.append(3)` mutates what `a` sees. Function arguments are passed the same way — "pass by object reference" (sometimes called pass-by-assignment). Rebinding a parameter inside a function doesn't affect the caller, but mutating the object it points at does.

For **functions**, being objects means they're first-class: you can assign them to variables, pass them as arguments, return them, stash them in lists or dicts, and attach attributes to them. This is what makes decorators, `functools.partial`, callbacks, and higher-order functions like `map`/`sorted(key=...)` natural rather than bolted-on.

```python
def shout(s): return s.upper()
f = shout            # function is just an object
funcs = {"shout": shout}
shout.calls = 0      # functions can carry attributes
```

For **classes**, the kicker is that a class is itself an object — an instance of `type`. `type` is the default *metaclass*. Because classes are objects, you can create them at runtime (`type("Foo", (Base,), {...})`), pass them around, and customise their creation with metaclasses. This uniformity is why introspection (`getattr`, `isinstance`, `__dict__`, `inspect`) works consistently across the whole language: there's one object protocol, and everything participates in it. The cost is a level of indirection on every access, which is part of why CPython is slower than statically-laid-out languages — though the 3.11+ faster-CPython work and the 3.13 experimental JIT chip away at that overhead.

### Q2. is vs == : identity vs equality. When do they diverge, and why does `a is b` sometimes surprise you (small-int caching, interned strings)?

`==` asks "do these have the same *value*?" and dispatches to `__eq__`. `is` asks "are these the *same object*?" — it compares identity (`id(a) == id(b)`) and never calls any dunder. They coincide only when both names happen to point at the same object. For value comparisons, you almost always want `==`. The canonical correct use of `is` is against singletons: `x is None`, `x is True`, `x is False`, and sentinel objects you create yourself.

The surprises come from CPython *implementation details* that make distinct-looking values share one object:

```python
a = 256; b = 256
a is b          # True  — small ints -5..256 are cached at startup
a = 257; b = 257
a is b          # often False at the REPL — outside the cache
x = "hello"; y = "hello"
x is y          # usually True — string literals get interned
s = "".join(["h","i"]); t = "hi"
s is t          # often False — computed at runtime, not interned
```

CPython preallocates the integers `-5` through `256` and reuses them, and it interns many compile-time string literals (especially identifier-like ones). So `is` *appears* to work as equality for small values — and then silently breaks for `257` or for strings built at runtime. This is precisely why relying on `is` for value comparison is a bug: it's coupled to an optimisation that isn't part of the language spec and can differ between CPython versions, PyPy, or the 3.13 free-threaded build.

There's also a subtle trap: `==` can be overridden, `is` cannot. A class with a pathological `__eq__` (or a NumPy array, where `==` returns an element-wise array) can make `x == None` ambiguous or raise; `x is None` is unconditional and cheap. That's the real reason the idiom is `is None`, not style preference. Rule of thumb: `is`/`is not` only for `None` and identity sentinels; `==` for everything else.

### Q3. Explain Python's data model / dunder protocols at a high level — how do __len__, __getitem__, __iter__, __eq__ etc. let your objects plug into built-in syntax?

The data model is the contract between your objects and Python's syntax. Built-in operations don't hardcode behaviour for specific types — they dispatch to dunder methods defined on the object's *type*. `len(x)` calls `type(x).__len__(x)`. `x[k]` calls `__getitem__`. `for y in x` calls `__iter__` (or falls back to `__getitem__` with integer indices). `x + y` calls `__add__` (then `y.__radd__` as fallback). `x == y` calls `__eq__`. `with x:` calls `__enter__`/`__exit__`. So you make a custom type feel native by implementing the relevant protocol — not by inheriting from some magic base class.

```python
class Deck:
    def __init__(self, cards): self._cards = list(cards)
    def __len__(self): return len(self._cards)
    def __getitem__(self, i): return self._cards[i]

d = Deck(["A", "K", "Q"])
len(d)        # 3        -> __len__
d[0]          # 'A'      -> __getitem__
for c in d: ...          # iterates via __getitem__ fallback
"A" in d                 # membership for free via __getitem__/__iter__
```

That last point is the elegance: implementing one or two protocols gives you several behaviours for free. Define `__getitem__` and `__len__` and you've got indexing, iteration, slicing-ish access, and `in`. The `collections.abc` ABCs formalise these clusters — implement `__iter__` + `__next__` to be an `Iterator`, the sequence dunders to be a `Sequence`, and you can register or inherit to get mixin methods and `isinstance` support.

A senior point: protocols are looked up on the *type*, not the instance, for implicit invocations. Setting `obj.__len__ = lambda: 5` does **not** make `len(obj)` work — CPython bypasses the instance dict for special methods (this is the "implicit special method lookup" rule). And you must respect contracts: if you implement `__eq__`, you usually must implement `__hash__` (or set `__hash__ = None` to make instances unhashable), because the default `__hash__` is keyed to identity and will violate the "equal objects must hash equal" invariant that dicts and sets depend on. Get that wrong and your objects silently misbehave as dict keys.

### Q4. Is Python strongly typed or weakly typed? Statically or dynamically? Explain 'strong + dynamic' and why there's no implicit type coercion (`1 + '2'` raises).

These are two independent axes and candidates constantly conflate them. **Strong vs weak** is about whether the language does implicit, surprising cross-type coercion. **Static vs dynamic** is about *when* types are checked and where they live — on names at compile time (static) or on objects at runtime (dynamic). Python is **strongly typed and dynamically typed**. JavaScript, by contrast, is dynamic but *weakly* typed (`1 + '2' === '12'`); C is static and comparatively weak (implicit numeric conversions, pointer casts).

"Dynamic" means types attach to objects, not variables. A name can point at an `int` now and a `str` later; nothing checks until you actually run the operation. "Strong" means Python refuses to silently guess across incompatible types:

```python
1 + '2'        # TypeError: unsupported operand type(s) for +: 'int' and 'str'
'2' * 3        # '222'  — defined, not coercion: str.__mul__ accepts int
3 + True       # 4      — bool IS a subclass of int, so this is real arithmetic
```

`1 + '2'` raises because the `+` operator asks `int.__add__(1, '2')`, which returns `NotImplemented`, then tries `str.__radd__('2', 1)`, which also returns `NotImplemented`, so Python raises `TypeError` rather than inventing a conversion. There's no rule that says "if one side is a string, stringify the other." That's strong typing: explicit is better than implicit. You convert deliberately — `1 + int('2')` or `str(1) + '2'`.

The senior nuance: strong-and-dynamic is why the whole *gradual typing* ecosystem exists. Type hints (`def f(x: int) -> str`) are annotations the interpreter does **not** enforce at runtime — they're stored in `__annotations__` and consumed by tools like `mypy`/`pyright` for static analysis, and by editors and libraries like `pydantic`/`dataclasses`. So you get optional static checking layered on a language that stays dynamically typed at runtime. Don't claim hints make Python statically typed; they don't change runtime behaviour at all unless something explicitly reads them.

### Q5. What is truthiness in Python? How does `if obj:` work, and how do __bool__/__len__ control it?

Every object has a boolean value, and `if obj:`, `while obj:`, `and`, `or`, `not`, and comprehension filters all use it. There's no requirement that the condition be an actual `bool`. When Python needs the truth value of an object, it calls `bool(obj)`, which follows a precise lookup order:

1. If the type defines `__bool__`, call it; it must return a real `bool`.
2. Else if the type defines `__len__`, the object is falsy when `len(obj) == 0`, truthy otherwise.
3. Otherwise the object is truthy (the default — most objects are always truthy).

This is why empty containers are falsy without any special-casing in the interpreter: `list`, `dict`, `str`, `set`, `tuple` all define `__len__`, so `[]`, `{}`, `''` evaluate false. And `0`, `0.0`, `Decimal(0)`, and `None` are falsy via `__bool__`/being defined that way.

```python
class Cart:
    def __init__(self): self.items = []
    def __len__(self): return len(self.items)

c = Cart()
if c: ...          # falsy — no __bool__, so __len__ == 0 -> False
c.items.append("x")
if c: ...          # truthy now
```

The classic senior gotcha is conflating "falsy" with "is None," especially with defaults:

```python
def connect(timeout=None):
    if not timeout:           # BUG: timeout=0 means "no timeout" but is falsy
        timeout = 30
    ...
# fix: test identity explicitly
    if timeout is None:
        timeout = 30
```

`0`, `0.0`, `''`, and empty collections are all falsy, so `if not x:` quietly swallows legitimate zero/empty values. When you mean "the caller didn't supply a value," test `is None`; when you mean "is this empty/zero," truthiness is fine. Also note `and`/`or` return *operands*, not booleans — `x or default` yields `x` if truthy else `default`, which is a handy idiom but has the same zero/empty trap. And if you define `__bool__`, return an actual `bool`; returning a non-bool raises `TypeError` at the call site, which is a confusing place to debug from.

---

## Names, Binding & Mutability

### Summary

**What this topic covers**

This topic is about CPython's object-and-name model: what an assignment statement actually does, the difference between rebinding a name and mutating an object, how aliasing makes two names point at the same object, and how mutability (or its absence) ripples into function calls, dictionary keys, equality, copying, and the classic default-argument footgun. Everything here flows from one fact: in Python, a name is a label bound to an object that lives elsewhere, not a box that holds a value. Get that mental model right and a whole class of "why did my list change?" bugs disappears.

**Mental model**

Think of every object as a thing on the heap with an identity (`id()`), a type, and a value. A name — a local, a global, an attribute, a list slot — is just a binding, a reference pointing at one of those objects. Assignment (`x = obj`) never copies the object; it points the name `x` at it. So `b = a` makes `a` and `b` two names for the *same* object (aliasing). What happens next depends entirely on what you do through those names. If you *rebind* (`b = b + [1]` or `b = 5`), you create or fetch a new object and point `b` at it — `a` is untouched. If you *mutate* (`b.append(1)`, `b[0] = 9`), you change the one shared object in place, and `a` sees it too because `a` points at the same thing. Immutable objects (`int`, `str`, `tuple`, `frozenset`) have no mutating operations, so aliasing them is harmless — there's nothing to mutate, only rebinding. CPython's `id()` is the memory address; `is` compares identity, `==` compares value.

**Key terms**

- **Name (binding)** — a label in a namespace bound to an object; not storage for a value.
- **Object** — the heap entity with identity, type, and value that names point at.
- **Reference** — a name (or container slot) pointing at an object; CPython refcounts these.
- **Aliasing** — two or more names bound to the *same* object, so a mutation through one is visible through all.
- **Rebinding** — pointing a name at a different object; affects only that name.
- **Mutation** — changing an object's value in place; affects every name aliased to it.
- **Mutable** — supports in-place change: `list`, `dict`, `set`, `bytearray`, most user classes.
- **Immutable** — no in-place change: `int`, `float`, `str`, `bytes`, `tuple`, `frozenset`.
- **Identity (`is` / `id()`)** — same object in memory, distinct from value equality (`==`).
- **Hashable** — has a stable `__hash__`; required for dict keys and set members. Immutability usually implies hashability.
- **Shallow copy** — a new container whose slots are bound to the *same* child objects.
- **Deep copy** — a recursive copy where children are copied too, cutting all shared references.

**Why interviewers ask this**

This is the cleanest litmus test for whether someone actually understands Python versus having memorized syntax. A junior says "Python passes by reference" or "Python passes by value" and gets confused when an `int` argument doesn't change but a `list` argument does. A senior says "pass by object reference: the function gets its own name bound to the caller's object — mutate the object and the caller sees it, rebind the name and they don't," and predicts the behavior every time without guessing. The mutable-default-argument bug is asked constantly because it cleanly separates people who understand *when* `def` evaluates defaults (once, at definition time) from those who think it re-runs per call. Strong candidates also volunteer the `is` vs `==` distinction, the interning caveats, and why mutable objects can't be dict keys — all downstream of this one model.

**Common confusions**

- **"Variables hold values"** — no; names are bound to objects that live on the heap. Assignment rebinds, never copies.
- **"`b = a` copies the list"** — it aliases it. `b.append(x)` mutates what `a` sees too.
- **"Python is pass-by-reference"** — it's pass-by-object-reference; rebinding a parameter doesn't affect the caller.
- **"`+=` always mutates"** — for `list` it mutates in place; for `int`/`str`/`tuple` it rebinds to a new object.
- **"Defaults are evaluated each call"** — they're evaluated once at `def`-execution time and stored on the function.
- **"`is` is just a faster `==`"** — `is` is identity; `==` is value. `a == b` can be true while `a is b` is false.

**What follows from this topic**

Mutability underpins almost everything else in Python. It explains why `@dataclass(frozen=True)` exists and why dataclasses warn on mutable defaults, why `tuple`/`frozenset` can be dict keys but `list` can't, and why hashability and `__eq__`/`__hash__` must stay consistent. It drives the data-model topic (`__eq__`, `__hash__`, `__copy__`), the concurrency topics (shared mutable state plus the GIL is where threading bugs live), and the functional-tools topics (`functools.lru_cache` requires hashable, hence immutable, arguments). The copy semantics here are the same ones that bite you with nested config dicts and ORM objects.

### Q6. Python has 'names', not 'variables' — explain assignment as binding a name to an object, and what aliasing means for mutable objects.

In Python an assignment like `x = [1, 2, 3]` does two separate things: it constructs (or locates) an object on the heap, then *binds* the name `x` to it. The name lives in a namespace (a dict, essentially); the object lives elsewhere. The name is a reference, not a container — there's no "box called `x`" holding the list. This is why I say Python has names, not variables in the C sense.

Aliasing is the immediate consequence. When you write `y = x`, no object is copied — you've bound a second name to the *same* object. Now `x is y` is `True`, and `id(x) == id(y)`. If the object is mutable, anything you do *to the object* through one name is visible through the other:

```python
x = [1, 2, 3]
y = x            # alias: same object
y.append(4)      # mutate the shared object
print(x)         # [1, 2, 3, 4] — x sees it
```

The crucial distinction is mutation versus rebinding. `y.append(4)` mutates the object both names share. But `y = y + [4]` builds a *new* list and rebinds `y` to it — `x` still points at the original and is unchanged. Same for `y = []`: that just repoints `y`. The name moves; the old object stays put (and gets garbage-collected when its last reference drops).

For immutable objects this never bites you, because there's no mutating operation to begin with. `a = 5; b = a; b += 1` rebinds `b` to the object `6`; `a` is still `5`. There was never a way to "change the 5." That's the whole reason immutability is restful: aliasing is free of spooky action at a distance.

In an interview I'd close by noting `is` vs `==`: `is` asks "same object?" (identity, `id()`), `==` asks "same value?". They diverge constantly — `[1] == [1]` is `True` but `[1] is [1]` is `False` (two distinct objects). The only time you *should* use `is` is for singletons like `None`, `True`, `False`.

### Q7. Mutable vs immutable: list/dict/set vs int/str/tuple/frozenset. Why does this distinction matter for function arguments, dict keys, and equality?

Mutable objects can be changed in place — `list`, `dict`, `set`, `bytearray`, and most user-defined classes. Immutable objects can't — `int`, `float`, `complex`, `bool`, `str`, `bytes`, `tuple`, `frozenset`, `None`. "Immutable" means the object's value is fixed for its lifetime; any "change" actually produces a new object and rebinds a name.

**Function arguments.** Because arguments are passed by binding the parameter to the caller's object (next question), passing a mutable object lets the callee mutate the caller's data. Passing an immutable one is effectively safe — the worst the callee can do is rebind its local parameter, which the caller never sees. That's why a function that does `lst.append(x)` has a visible side effect, but one that does `n += 1` on an `int` parameter doesn't.

**Dict keys and set members.** These require *hashable* objects, and hashability requires a stable hash over the object's lifetime. Mutable built-ins are deliberately unhashable: `list`, `dict`, `set` raise `TypeError: unhashable type` as keys. The immutable counterparts work — `tuple` and `frozenset` are hashable (provided their contents are too). This is exactly why `frozenset` exists: to put a set-like value in a dict key or another set.

```python
d = {}
d[(1, 2)] = "ok"          # tuple key: fine
d[frozenset({1, 2})] = "ok"
d[[1, 2]] = "boom"        # TypeError: unhashable type: 'list'
```

The contract is: if `a == b` then `hash(a) == hash(b)`, and the hash must not change while the object is in a dict/set. Mutable objects can't honor the second clause, so they're barred. A subtle trap: a `tuple` is only hashable if *all* its elements are — `hash((1, [2]))` raises, because it contains a list.

**Equality.** `==` compares value and is what you almost always want. `is` compares identity. The distinction matters because of interning: CPython caches small ints (−5..256) and many short strings, so `256 is 256` may be `True` while `257 is 257` can be `False` depending on context — these are *implementation details*, not language guarantees. Never use `is` for value comparison; use it only for `None`/sentinels. mypy and ruff will both flag `x == None` and steer you to `x is None`.

### Q8. Is Python pass-by-value or pass-by-reference? Explain 'pass by object reference' and predict what a function does to a list arg vs an int arg.

Neither, exactly — Python is **pass by object reference** (sometimes called "call by sharing"). When you call `f(obj)`, the parameter inside `f` is bound to the *same object* the caller passed; nothing is copied. So it's not pass-by-value (the object isn't duplicated) and not classic pass-by-reference (the function gets no alias to the *caller's variable* — it can't reassign the caller's name).

The rule that predicts every case: **the callee can mutate the object, but rebinding the parameter only repoints the local name.** Mutation reaches the caller; rebinding doesn't.

```python
def mutate(lst):
    lst.append(99)      # mutates the shared object → caller sees it

def rebind(lst):
    lst = [0]           # repoints the local name only → caller unaffected

def bump(n):
    n += 1              # int is immutable: this REBINDS n locally

a = [1, 2]
mutate(a);  print(a)    # [1, 2, 99]
rebind(a);  print(a)    # [1, 2, 99] — unchanged by rebind
x = 5
bump(x);    print(x)    # 5 — int unchanged
```

So the list arg "changes" when you mutate it (`append`, `lst[0] = ...`, `lst.sort()`), and *doesn't* when you rebind it (`lst = something`). The int arg never changes from the caller's view because the only thing you can do to an `int` is rebind your local name — there's no in-place mutation of integers.

A favorite trap is `+=` on a list parameter: `lst += [1]` *does* affect the caller, because `+=` on a list calls `__iadd__`, which mutates in place. But `lst = lst + [1]` does not, because `+` builds a new list and rebinds. Same-looking code, opposite outcome — that asymmetry is the senior-level tell.

If you actually want to protect the caller's data, copy at the boundary: `lst = list(lst)` or accept that you're taking ownership. I lean toward functions that either clearly mutate (and say so in the name/docstring) or clearly return a new value — mixing both is how you get surprise side effects.

### Q9. The classic mutable-default-argument bug: `def f(x, acc=[])`. Why does the default persist across calls, when is it evaluated, and what's the fix?

The default value is evaluated **exactly once, when the `def` statement executes** (at function-definition time), and the resulting object is stored on the function (`f.__defaults__`). It is *not* re-evaluated on each call. So with a mutable default like `[]`, every call that doesn't pass `acc` reuses and mutates the *same* list object — state leaks across calls:

```python
def f(x, acc=[]):
    acc.append(x)
    return acc

f(1)   # [1]
f(2)   # [1, 2]  — same list as last time!
f(3)   # [1, 2, 3]
print(f.__defaults__)   # ([1, 2, 3],)  — proof it's one shared object
```

This trips people up because intuitively `acc=[]` *looks* like "start with a fresh empty list each call." It isn't — `[]` is an expression evaluated once at `def` time, producing one list that becomes the persistent default. The same bug hits `{}`, `set()`, and any mutable object (including a `datetime.now()` that "freezes" at import time).

The fix is the standard sentinel idiom: default to `None`, then build the real mutable object inside the body, which *does* run every call:

```python
def f(x, acc=None):
    if acc is None:
        acc = []
    acc.append(x)
    return acc
```

Use `None` as the sentinel and test with `is None`. If `None` is a legitimate value the caller might pass, use a private sentinel object instead: `_MISSING = object()` and `if acc is _MISSING:`.

Two senior notes. First, this isn't always a bug — the same mechanism is a deliberate technique for cheap per-call caching or for capturing a loop value at definition time. But as an implicit default it's almost always a mistake. Second, tooling catches it: ruff's `B006` (mutable-argument-default, from the flake8-bugbear set) flags `def f(x, acc=[])` directly, and `@dataclass` actively raises `ValueError` if you give a field a mutable default, forcing you to use `field(default_factory=list)` — which is the dataclass-shaped version of the same fix.

### Q10. Shallow copy vs deep copy (`copy` vs `copy.deepcopy`) and slicing copies — show a nested-list bug a shallow copy causes.

A **shallow copy** makes a new outer container but binds its slots to the *same child objects* as the original. A **deep copy** recursively copies the children too, so the result shares nothing mutable with the source. `copy.copy(obj)` and shallow idioms like `list(x)`, `x[:]`, `dict(x)`, `x.copy()` all do the shallow version. `copy.deepcopy(obj)` does the recursive one.

For a flat list of immutables, shallow is all you ever need — there are no shared mutable children to worry about. The bug appears with *nesting*: the inner lists are aliased, so mutating one through the copy mutates it in the original too.

```python
import copy
original = [[1, 2], [3, 4]]
shallow = original[:]          # new outer list, SAME inner lists
shallow[0].append(99)
print(original)                # [[1, 2, 99], [3, 4]] — leaked!
print(shallow[0] is original[0])  # True — aliased inner list

deep = copy.deepcopy(original)
deep[0].append(77)
print(original)                # unchanged — deep copy shares nothing
```

Note the asymmetry: `shallow[0].append(99)` *mutates* a shared inner list, so it leaks. But `shallow[0] = [9, 9]` would *rebind* the copy's slot 0 and leave `original` alone — same mutate-vs-rebind distinction from Q6/Q8, one level down. The classic real-world version of this is the `grid = [[0]*cols]*rows` trap, where `*rows` copies the *reference* to one row list `rows` times, so writing `grid[0][0] = 1` writes to every row. Use `[[0]*cols for _ in range(rows)]` instead.

`deepcopy` is correct but not free: it walks the whole object graph, handles cycles via a memo dict, and respects `__deepcopy__`/`__copy__` hooks if a class defines them. It's slower and can choke on objects holding unpicklable resources (open files, locks, DB connections). So reach for it only when you genuinely need an independent nested structure; for one level of nesting a comprehension or `[list(row) for row in grid]` is cheaper and clearer. And for config-style data, an immutable design (`tuple`/`frozenset`/`frozen=True` dataclasses) sidesteps the whole copy question — there's nothing to alias-mutate.

---

## Built-in Data Structures

### Summary

**What this topic covers**

This topic is about the four-plus core containers every Python program leans on — `list`, `tuple`, `dict`, `set`, and `frozenset` — plus the specialized variants in the `collections` module. The senior-level concern is not "what is a list" but *why* each structure has the performance and semantics it does in CPython: how the dict's open-addressed hash table gives you O(1) lookup and insertion ordering, why a tuple can be a dict key but a list cannot, and which operations hide a linear scan behind innocent-looking syntax (`list.pop(0)`, `x in some_list`).

**Mental model**

Think in terms of two axes: *mutability* and *backing structure*. `list` and `dict` and `set` are mutable; `tuple` and `frozenset` are their immutable, hashable twins. The backing structure determines the cost model. `list` and `tuple` are contiguous arrays of `PyObject*` pointers, so indexing is O(1) but inserting/deleting at the front shifts every element. `dict` and `set` are hash tables, so membership and keyed access average O(1) but cost a hash computation and depend on a sane `__hash__`/`__eq__`. The collections module is just pre-built compositions over these: `Counter` and `defaultdict` are dict subclasses, `deque` is a doubly-linked-list-of-blocks giving O(1) at *both* ends. When you pick a container, you are really choosing a cost curve and a contract about whether the thing can change and whether it can be a key. Get those two questions right and the choice is usually forced.

**Key terms**

- **Mutable** — can be changed in place after creation (`list`, `dict`, `set`); affects whether it's hashable.
- **Hashable** — has a stable `__hash__` over its lifetime; required to be a dict key or set member.
- **Open addressing** — CPython's dict/set collision strategy: probe successive slots in the same array rather than chaining linked lists.
- **Load factor** — ratio of used slots to total; CPython resizes the table when it exceeds ~2/3 full.
- **Amortized O(1)** — average cost over many ops; individual `list.append` or dict insert may trigger an O(n) resize.
- **Compact dict** — the post-3.6 layout: a dense insertion-ordered entries array plus a sparse index array.
- **Probe sequence** — the deterministic series of slots a key is checked against on collision.
- **`__eq__`/`__hash__` contract** — equal objects must have equal hashes; breaking this corrupts hash containers.
- **deque** — `collections.deque`, O(1) appends/pops at both ends, O(n) indexing in the middle.
- **frozenset** — immutable, hashable set; usable as a dict key or nested in another set.

**Why interviewers ask this**

This is the cheapest possible signal for separating juniors from seniors. A junior can list the structures and recite "dict is O(1)." A senior explains *why* — the hash table, the resize policy, the array-shift cost of `pop(0)` — and reaches for the right tool reflexively: `deque` for a queue, `Counter` for frequency, `set` for membership tests inside a loop. Interviewers also probe the subtle contracts: that a list can't be a dict key, that mutating a key after insertion corrupts the table, that dict ordering is now a *language guarantee* (3.7+) not an implementation accident. The strongest tell is whether you instinctively avoid accidental O(n²) — e.g. someone doing `if x in big_list` inside a loop versus converting to a set first. That single habit reveals whether you think about cost curves at all.

**Common confusions**

- **"Dicts are unordered."** False since 3.7 — insertion order is a language guarantee, not just a CPython detail.
- **"Tuples are always faster than lists."** Marginal at best; pick tuple for *semantics* (immutability, hashability), not speed.
- **"`in` is always O(1)."** Only for `dict`/`set`. `x in my_list` and `x in my_tuple` are O(n) linear scans.
- **"`list.pop(0)` is like `deque.popleft()`."** No — `pop(0)` is O(n) because it shifts every remaining element left.
- **"frozenset and tuple are interchangeable keys."** No — frozenset is unordered and dedups; tuple is ordered and positional.

**What follows from this topic**

These containers underpin almost everything else. The dict's hash-table internals connect directly to the **hashing/`is` vs `==`/interning** topic and to **how `__hash__`/`__eq__` interact with object identity**. The cost model here feeds **algorithmic complexity and profiling** (where `cProfile` exposes the accidental O(n²)). Immutability and hashability tie into **dataclasses and `frozen=True`**, and the array-vs-hash distinction reappears when you reason about **memory layout, `__slots__`, and `sys.getsizeof`**.

### Q11. Survey list / tuple / dict / set / frozenset — mutability, ordering, and the average-case time complexity of common ops.

Here's the table I'd sketch on the whiteboard. All complexities are CPython average-case.

| Type | Mutable | Ordered | Hashable | Index/key access | Membership (`in`) | Append/insert | Delete |
|------|---------|---------|----------|-------------------|--------------------|----------------|--------|
| `list` | yes | yes (positional) | no | O(1) by index | O(n) | O(1) amortized at end; O(n) at front | O(n) (shift) |
| `tuple` | no | yes (positional) | yes (if elements are) | O(1) by index | O(n) | n/a | n/a |
| `dict` | yes | yes (insertion, 3.7+) | no | O(1) by key | O(1) on keys | O(1) amortized | O(1) |
| `set` | yes | no | no | n/a | O(1) | O(1) amortized | O(1) |
| `frozenset` | no | no | yes | n/a | O(1) | n/a | n/a |

The thing juniors miss: **`in` against a `list` or `tuple` is a linear scan**, while against a `dict`, `set`, or `frozenset` it's a hash lookup. If you're testing membership repeatedly, build a set first.

```python
# O(n*m) — scans seen_list every iteration
seen_list = []
for x in items:
    if x not in seen_list:   # O(n) each time
        seen_list.append(x)

# O(n) — set membership is O(1)
seen = set()
for x in items:
    if x not in seen:        # O(1)
        seen.add(x)
```

One nuance on "average-case": hash-table O(1) assumes a decent hash distribution. A pathological `__hash__` (everything hashes to one bucket) degrades dict/set operations toward O(n). CPython's string hashing is randomized per-process (`PYTHONHASHSEED`) partly to defend against deliberate collision attacks.

### Q12. How does a dict work internally (hashing, open addressing) and why are dicts insertion-ordered since 3.7? What must a key satisfy (__hash__/__eq__)?

A CPython dict is a hash table using **open addressing**, not chaining. To store a key, it computes `hash(key)`, masks it to an index into the table, and if that slot is taken (a collision), it follows a deterministic **probe sequence** to find the next open slot. Lookup repeats the same probe, comparing with `__eq__` at each candidate until it finds the key or hits an empty slot. The table is kept under ~2/3 full; crossing that triggers a resize (allocate a bigger table, rehash everything), which is why individual inserts are *amortized* O(1) — most are cheap, an occasional one pays for the resize.

The **insertion-order** guarantee comes from the "compact dict" layout introduced in 3.6 (made a language guarantee in 3.7). Instead of one sparse array holding entries directly, CPython splits it: a dense **entries array** that stores `(hash, key, value)` in insertion order, and a sparse **indices array** of integers that point into the entries array. Hashing indexes into the sparse array; iteration just walks the dense array front-to-back — which is exactly insertion order. The split also cut dict memory by roughly 20-25%. So ordering was a *free side effect* of a memory optimization, then promoted to a promise.

A key must satisfy two things:

```python
hash(key)          # must work and be stable for the object's lifetime
key1 == key2  =>   hash(key1) == hash(key2)   # the invariant
```

This is why lists can't be keys (mutable, so unhashable) but tuples can (if their contents are hashable). The classic bug is **mutating a key after insertion** so its hash changes — the entry becomes unreachable because it's filed under the old hash bucket:

```python
class Box:
    def __init__(self, v): self.v = v
    def __hash__(self): return hash(self.v)
    def __eq__(self, o): return self.v == o.v

b = Box(1)
d = {b: "x"}
b.v = 2          # hash silently changed
print(d.get(b))  # None — filed under hash(1), looked up under hash(2)
```

The fix is to make hashable objects effectively immutable (e.g. `@dataclass(frozen=True)`, or hash only on stable identity fields).

### Q13. When do you reach for the collections module — defaultdict, Counter, deque, namedtuple, OrderedDict? Give a use for each.

These are the workhorses. Each replaces a clumsy hand-rolled pattern:

- **`defaultdict`** — grouping and accumulation without `setdefault` boilerplate. Pass a factory; missing keys auto-initialize. `groups = defaultdict(list); groups[k].append(v)` builds a multimap cleanly. Watch out: *reading* a missing key inserts it, so don't iterate-and-test casually.
- **`Counter`** — frequency counting and multiset arithmetic. `Counter(words)` tallies in one line; `.most_common(10)` gives top-k. It supports `+`, `-`, `&`, `|` as multiset operations, which is genuinely useful for things like "what changed between two bags."
- **`deque`** — O(1) appends and pops at *both* ends. The right structure for a queue, a sliding window (`deque(maxlen=n)` auto-evicts), or BFS. This is the answer to "queue in Python" — never a plain list.
- **`namedtuple`** — a lightweight immutable record with named fields and tuple semantics. Good for fixed-shape return values where a full class is overkill and you still want `.x` access plus tuple unpacking. In modern code I usually reach for `@dataclass(frozen=True, slots=True)` or `typing.NamedTuple` instead, since they carry type annotations.
- **`OrderedDict`** — historically *the* way to get ordered dicts; now mostly redundant since plain dicts are ordered. It still earns its place for two things: `move_to_end()` (building an LRU cache by hand) and **order-sensitive equality** — `OrderedDict([(1,1),(2,2)]) != OrderedDict([(2,2),(1,1)])`, whereas plain dicts compare equal regardless of order.

```python
from collections import Counter, defaultdict, deque

groups = defaultdict(list)
for word in words:
    groups[len(word)].append(word)      # group by length

freq = Counter(words).most_common(3)    # top-3 words

window = deque(maxlen=3)                 # sliding window of last 3
```

If I see someone use `OrderedDict` in new code just to "preserve order," that's a tell they haven't internalized the 3.7 change.

### Q14. List vs tuple: beyond mutability, when do you pick a tuple (hashable key, fixed record, slight perf) vs a list?

Mutability is the headline, but the real decision is about *intent and contract*. I pick a **tuple** in three situations:

**As a hashable composite key.** This is the killer use case. You want to key a dict on a pair or triple — `cache[(user_id, date)]` or `grid[(row, col)]`. A list can't do this; a tuple can (assuming its elements are hashable). Same for set members.

**As a fixed-shape heterogeneous record.** A tuple says "this has a known number of positionally-meaningful fields" — `(host, port)`, an RGB triple, a `(value, error)` return. A list signals "a homogeneous, variable-length sequence I'll iterate or grow." Using a list where the length is semantically fixed misleads the reader. For records I'll often go one step further to `NamedTuple` so the fields are named, but the underlying tuple semantics are the point.

**When immutability is a feature.** Passing a tuple guarantees the callee can't mutate your data, and it's safe as a shared constant or a default. (Note the famous gotcha — mutable default args — where you'd never want a list as a default.)

The performance angle is real but **marginal** — don't pick a tuple "for speed." Tuples have a slightly smaller memory footprint, construct a hair faster, and CPython caches small tuples in a free list. But these differences are noise unless you're allocating millions in a hot loop. If someone justifies tuple-over-list primarily on speed, I push back: pick on semantics, and let the hashability/immutability contract drive it.

```python
# tuple as a dict key — list would raise TypeError: unhashable type
visited = set()
visited.add((row, col))

prices = {("AAPL", "2026-06-10"): 412.50}   # composite key
```

### Q15. How do you implement a stack and a queue efficiently in Python (list vs collections.deque) and why is list.pop(0) a trap?

A **stack** (LIFO) is fine as a plain `list`: `append()` to push and `pop()` to pop, both operating at the *end* of the array, both amortized O(1). No need for anything fancier.

A **queue** (FIFO) is where people get burned. The naive version uses a list with `append()` to enqueue and `pop(0)` to dequeue — and `pop(0)` is the trap. Because a list is a contiguous array, removing index 0 forces CPython to **shift every remaining element one slot left**, an O(n) operation. Do that for each of n dequeues and your "simple queue" is silently O(n²). The same applies to `insert(0, x)`.

The fix is `collections.deque`, which is a doubly-linked list of fixed-size blocks. `append`/`appendleft` and `pop`/`popleft` are all genuine O(1) — no shifting:

```python
from collections import deque

# Stack — plain list is fine
stack = []
stack.append(1); stack.append(2)
stack.pop()            # 2, O(1)

# Queue — use deque, NOT list.pop(0)
q = deque()
q.append(1); q.append(2)
q.popleft()            # 1, O(1) — no element shifting

# The trap:
slow = [1, 2, 3]
slow.pop(0)            # O(n) — shifts everything left
```

The tradeoff: `deque` gives up O(1) random indexing — `dq[n]` in the middle is O(n) because it has to walk blocks. So if you need a queue *and* frequent indexed access, neither is ideal and you'd reconsider the data structure. For concurrency, note `deque`'s `append`/`popleft` are individually atomic under the GIL (handy for simple producer/consumer), but for real multi-thread or multi-process work you'd use `queue.Queue` or `multiprocessing.Queue`, which add the blocking/locking semantics `deque` doesn't provide.

---

## Functions, Closures & Scope

### Summary

**What this topic covers** — This topic is about how Python resolves names, how functions capture state, and how you design function signatures. It covers the LEGB lookup rule, the `global` and `nonlocal` declarations, closures and the cells that back them, the infamous late-binding-in-a-loop trap, the full grammar of parameter kinds (`*args`, `**kwargs`, positional-only `/`, keyword-only `*`), and the `functools` workhorses (`partial`, `reduce`, `lru_cache`/`cache`). These are bread-and-butter mechanics that senior Python code leans on constantly, and getting them wrong produces bugs that survive code review because they only bite at runtime under specific data.

**Mental model** — Think of every function call as creating a fresh **frame** with its own local namespace, and name lookup as a search outward through nested scopes that is decided mostly at *compile time*, not runtime. CPython decides whether a name is local the moment it compiles the function body: if you assign to a name anywhere in the function, that name is local for the *entire* function unless you say otherwise with `global` or `nonlocal`. Reads, by contrast, fall through LEGB at runtime. Closures are not magic capture-by-value snapshots — a nested function holds a reference to a **cell object** shared with the enclosing frame, so it sees the *current* value of the variable, not the value at definition time. That single fact explains the loop gotcha, the counter-needs-`nonlocal` puzzle, and why mutable defaults persist. Parameters, meanwhile, are just a structured way of binding call arguments into that local namespace, with `/` and `*` as fences that constrain how callers may pass them.

**Key terms**
- **Frame** — the runtime object holding a call's local namespace, created per call and destroyed (refcount-zeroed) on return.
- **LEGB** — the four-tier name search order: Local, Enclosing, Global, Built-in.
- **Cell** — the heap object a closure uses to share a variable between enclosing and nested function; visible via `fn.__closure__`.
- **Free variable** — a name used in a nested function but bound in an enclosing one; surfaced in `code.co_freevars`.
- **`global`** — declares a name as belonging to the module namespace, so assignment writes there.
- **`nonlocal`** — declares a name as belonging to the nearest enclosing *function* scope (not module), enabling rebinding.
- **Late binding** — closures resolve free variables when *called*, not when *defined*.
- **Positional-only (`/`)** — parameters before `/` cannot be passed by keyword.
- **Keyword-only (`*`)** — parameters after a bare `*` or `*args` must be passed by keyword.
- **`functools.partial`** — pre-binds some arguments to produce a new callable.
- **`lru_cache`/`cache`** — memoization decorators; `cache` is `lru_cache(maxsize=None)`.
- **Memoization** — caching a pure function's outputs keyed by its inputs.

**Why interviewers ask this** — Scope and closures separate people who *use* Python from people who *understand* it. A junior knows functions take arguments; a senior knows that `x = x + 1` inside a function with no declaration raises `UnboundLocalError` because the compiler already marked `x` local. The late-binding loop bug is a near-universal real-world incident (event handlers, deferred tasks, lambdas in comprehensions) and the candidate's reaction reveals whether they reason about *when* names resolve. Likewise, knowing that `lru_cache` on a method silently pins `self` and leaks memory, or that mutable arguments break caching, signals someone who has debugged production memory growth. These questions are cheap to ask and high-signal: they expose whether the candidate has a runtime model of CPython or is pattern-matching syntax.

**Common confusions**
- **"Closures capture the value of the variable at definition time"** — no, they capture the *variable* (a cell); they see its current value when called.
- **"`global` lets me modify a variable from an outer function"** — no, `global` targets the module namespace; for an enclosing function you need `nonlocal`.
- **"I need `nonlocal` to mutate a captured list"** — no, mutating (`lst.append`) needs no declaration; only *rebinding* (`lst = ...`) does.
- **"`lru_cache` is always a safe optimization"** — it holds strong references to args and results forever (until eviction); on long-lived objects it leaks.
- **"`*args` makes parameters optional"** — `*args` collects *extra positionals*; it doesn't make named params optional.

**What follows from this topic** — Cells and late binding feed directly into **decorators** (which are closures over the wrapped function) and into **generators/async** (each `yield`/`await` suspends a frame). The mutable-default and refcount points connect to the **memory-management / GIL** topics, and `lru_cache`'s reference-pinning ties into **weakref** strategies. Parameter design underpins clean **API and dataclass** work later in the primer.

### Q16. Explain the LEGB scope-resolution rule (Local, Enclosing, Global, Built-in) with an example that hits each level.

When Python evaluates a bare name, it searches four namespaces in order: **L**ocal (the current function's frame), **E**nclosing (any enclosing function's scope, walking outward), **G**lobal (the module's top-level namespace), and **B**uilt-in (the `builtins` module — `len`, `print`, `range`, etc.). The first hit wins; if none match you get `NameError`.

Here's one example that touches every tier:

```python
x = "global"  # G

def outer():
    x = "enclosing"  # E

    def inner():
        x = "local"  # L
        print(x)      # -> "local"  (L)
        print(len)    # builtin len (B)
    inner()
    print(x)          # -> "enclosing" (E from outer's own frame)

outer()
print(x)              # -> "global" (G)
```

The crucial CPython detail: whether a name is *local* is decided at **compile time**, by static analysis of the function body, not at runtime. If a name is assigned anywhere in the function, it's local for the whole function. That's why this raises `UnboundLocalError`, not falls through to global:

```python
x = "global"
def f():
    print(x)   # UnboundLocalError
    x = "shadow"
```

The `x = "shadow"` later in the body makes `x` local everywhere in `f`, so the earlier read finds an unbound local rather than the global. Note also that comprehensions and generator expressions get their **own** scope (since Python 3), so a loop variable inside `[i for i in range(3)]` does not leak into the enclosing function — a real difference from Python 2.

### Q17. global vs nonlocal: what does each do, and when do you actually need them? Show a counter closure that needs nonlocal.

Both are *declarations* that change where an **assignment** binds a name; neither affects reads (reads always follow LEGB). `global x` says "assignments to `x` in this function write to the module namespace." `nonlocal x` says "assignments to `x` write to the nearest **enclosing function** scope that already binds `x`" — explicitly *not* the module, and it errors at compile time if no such enclosing binding exists.

You only need them when you want to **rebind** a name in an outer scope. If you're merely *mutating* an object — `counter['n'] += 1`, `items.append(x)`, `obj.attr = ...` — you need no declaration at all, because that's a method call / item assignment on an object you already have a reference to, not a name rebinding.

The classic case that *forces* `nonlocal` is a counter closure, because `count = count + 1` is a rebind:

```python
def make_counter():
    count = 0
    def increment():
        nonlocal count       # without this -> UnboundLocalError
        count += 1
        return count
    return increment

c = make_counter()
c(); c(); c()   # 1, 2, 3
```

Without `nonlocal`, `count += 1` makes `count` local to `increment`, and the augmented read finds an unbound local. The common "workaround" before `nonlocal` existed was to wrap state in a mutable container (`count = [0]; count[0] += 1`) — that works precisely because list mutation isn't a rebind. In modern code, prefer `nonlocal`; reach for a class with an attribute if the state grows beyond one or two variables. Use `global` sparingly — module-level mutable state is a code smell and a concurrency hazard.

### Q18. What is a closure? How does a nested function capture enclosing variables, and what's the late-binding-in-a-loop gotcha (`[lambda: i for i in range(3)]`)?

A **closure** is a nested function plus the enclosing-scope variables it references (its *free variables*). CPython doesn't copy those variables in — it shares a **cell object** between the enclosing frame and the inner function. You can see it: `fn.__closure__` is a tuple of cells, and `fn.__code__.co_freevars` names them. Because the inner function holds the cell, the enclosing locals outlive the enclosing call.

The key property is **late binding**: the free variable is resolved when the closure is *called*, reading the cell's *current* value — not the value at the moment the closure was created. That produces the canonical surprise:

```python
fns = [lambda: i for i in range(3)]
[f() for f in fns]   # -> [2, 2, 2], not [0, 1, 2]
```

All three lambdas close over the *same* `i` cell. By the time you call them, the comprehension has finished and `i` is `2`, so every call reports `2`. (Each lambda has its own scope, but they share the comprehension's single `i`.)

The fix is to bind the current value per-iteration. The idiomatic way is a default argument, which is evaluated *eagerly* at definition time:

```python
fns = [lambda i=i: i for i in range(3)]
[f() for f in fns]   # -> [0, 1, 2]
```

Alternatively, `functools.partial(lambda i: i, i)` or a factory function (`make(i)` returning a closure over its own parameter) captures by separate binding. This bug shows up constantly in real code: registering callbacks in a loop, building per-item event handlers, scheduling tasks — anywhere you defer execution of a closure created in a loop. The tell is "all my handlers behave like the last one."

### Q19. *args and **kwargs, positional-only (/) and keyword-only (*) parameters — how do you design a flexible function signature?

Python's parameter grammar, in order, is: `positional-only`, `/`, `positional-or-keyword`, `*args` (or bare `*`), `keyword-only`, `**kwargs`. The fences matter: everything **before `/`** can only be passed positionally; everything **after `*`** (or after `*args`) can only be passed by keyword.

```python
def f(pos_only, /, normal, *args, kw_only, **kwargs):
    ...
```

`*args` collects extra positional arguments into a tuple; `**kwargs` collects extra keyword arguments into a dict (insertion-ordered since 3.7). On the call side, the *same* `*`/`**` syntax **unpacks** an iterable/mapping into arguments — `f(*my_list, **my_dict)` — which is symmetric and worth pointing out.

Design guidance, opinionated:

- **Positional-only (`/`)** when the parameter name is an implementation detail you don't want to commit to as API, or when you want `**kwargs` to be able to contain a key with that same name. The stdlib uses it heavily (e.g. `dict.get(key, default, /)`). It frees you to rename later without breaking callers.
- **Keyword-only (`*`)** for booleans, flags, and any argument whose meaning isn't obvious at the call site. `make_request(url, *, retries=3, timeout=30)` forces `make_request(url, retries=5)` and forbids the unreadable `make_request(url, 5, 30)`. This is the single most underused tool for self-documenting signatures.
- **`*args`/`**kwargs** for genuine pass-through (decorators, wrappers) or truly variadic APIs (`print`, `max`). Don't use them to paper over a function that secretly wants three named parameters — you lose autocompletion, type-checking via mypy, and readable errors.

A practical pattern: put required, obvious args positional; make every option keyword-only after a `*`; reserve `**kwargs` for forwarding. That gives you a signature mypy can check and that stays evolvable.

### Q20. functools essentials: partial, reduce, and lru_cache/cache — what problem does each solve? Note lru_cache's hidden-memory and unhashable-arg pitfalls.

**`partial`** pre-binds arguments to produce a new callable, solving the "I keep calling this function with the same leading args" problem without writing a lambda. `from functools import partial; int2 = partial(int, base=2)` then `int2("1010")` → `10`. It's preferable to a lambda for pass-as-callback because it's introspectable (`.func`, `.args`, `.keywords`) and picklable. Note it binds *positionally from the left*; for awkward binding positions, keyword args in the `partial` are cleaner.

**`reduce`** folds an iterable into a single value with a binary function: `reduce(operator.mul, range(1, 6), 1)` → `120`. Guido deliberately demoted it out of builtins because a plain loop or a purpose-built function (`sum`, `math.prod`, `any`, `str.join`) is almost always clearer. Use `reduce` only when the accumulation genuinely has no specialized builtin and a comprehension can't express it — otherwise it's write-only code.

**`lru_cache`/`cache`** memoize a pure function, keyed by its arguments. `cache` is just `lru_cache(maxsize=None)` (added 3.9) — unbounded. They solve repeated-computation problems (recursion like Fibonacci, expensive idempotent lookups) and expose `.cache_info()` and `.cache_clear()`.

The pitfalls are where seniority shows:

- **Hidden memory / reference pinning.** The cache holds **strong references** to every argument *and* every return value until eviction (or forever, with `cache`/`maxsize=None`). Decorating a **method** caches `self`, so instances never get garbage-collected — a classic leak. Bound `maxsize`, or for methods prefer `functools.cached_property`, or cache on a module-level function, or use a `weakref`-based scheme.
- **Unhashable arguments.** Keys are built from the arguments, so they must be **hashable**. Calling a cached function with a `list`, `dict`, or `set` raises `TypeError: unhashable type`. Convert to a tuple/frozenset at the boundary, or don't cache that signature.
- **Argument-form sensitivity.** `f(1)` and `f(x=1)` are cached as *different* keys (with `typed=False`); and `typed=True` additionally distinguishes `f(1)` from `f(1.0)`. Don't assume the cache normalizes call forms.

Rule of thumb: `cache`/`lru_cache` is fine for stable, low-cardinality, hashable inputs on module-level pure functions. The moment long-lived objects or large input spaces enter, give it a `maxsize` or reach for an explicit, evictable cache.

---

## Decorators

### Summary

**What this topic covers** — Decorators are the canonical Python mechanism for wrapping a callable (function, method, or class) to add behavior — logging, caching, retry, access control, registration — without editing the wrapped body. This topic covers the desugaring of `@`-syntax, why decorators are just higher-order functions enabled by first-class functions and closures, decorator factories that take arguments, the three flavors (function-returning-function, class-based with `__call__`, class decorators that rewrite a class), `functools.wraps` and the introspection it preserves, stacking/composition order, and the subtle interaction with `self`, `classmethod`, and `staticmethod`.

**Mental model** — `@dec` above a `def` is pure syntactic sugar: after the function object is created, the name is rebound to `dec(func)`. Nothing magic — a decorator is any callable that takes a callable and returns something (usually another callable). The power comes from two language facts: functions are first-class objects (you can pass them, return them, store them), and closures let an inner function capture the outer function's variables by reference. So a decorator typically defines an inner `wrapper` that closes over the original `func` and any factory arguments, then returns `wrapper`. When you later call the decorated name, you're calling `wrapper`, which can run code before/after, swallow or transform arguments, short-circuit, retry, or cache. Decorators run at *definition time* (import time), not call time — a common source of surprise. Anything stateful (a cache, a registry, a call counter) lives either in the closure cell or on a mutable object the wrapper holds.

**Key terms**
- **First-class function** — a function is an ordinary object; it can be assigned, passed, returned.
- **Higher-order function** — a function that takes and/or returns functions; every decorator is one.
- **Closure** — an inner function capturing free variables from an enclosing scope via cell objects (`func.__closure__`).
- **Decorator factory** — a function that *returns* a decorator, used to parameterize the decorator (`@retry(3)`).
- **`functools.wraps`** — a decorator that copies `__name__`, `__doc__`, `__module__`, `__qualname__`, `__dict__`, and sets `__wrapped__` onto the wrapper.
- **`__wrapped__`** — attribute pointing to the original callable, set by `wraps`; lets `inspect.signature` and `inspect.unwrap` see through.
- **Definition-time execution** — decorator code runs when the `def`/`class` statement executes, not when the result is called.
- **Class decorator** — a callable that receives a *class* and returns a (usually modified) class; e.g. `@dataclass`.
- **Decorating with a class** — using a class whose instances are callable (`__call__`) as the decorator/wrapper.
- **Stacking** — multiple `@` lines; they apply bottom-up (nearest the `def` first).

**Why interviewers ask this** — Decorators separate candidates who've *used* `@app.route` from those who understand the object model underneath. A junior recites "it wraps a function"; a senior can desugar `@dec` on the whiteboard, explain why `wraps` matters for `inspect.signature` and pytest fixture discovery, build a three-layer parameterized decorator without fumbling the nesting, and reason about ordering when decorators stack or combine with `classmethod`. The retry-with-backoff question is a favorite because it forces you to demonstrate closures-over-arguments, exponential math, exception handling, and `wraps` all at once — and to know that `@classmethod` must be the *outermost* decorator. Getting `is` vs `==` wrong is a different topic; getting decorator ordering or definition-time-vs-call-time wrong here signals shaky fundamentals.

**Common confusions**
- **"Decorators run each time the function is called."** No — the decorator runs once at definition; only the returned `wrapper` runs per call.
- **"`@retry(3)` and `@retry` are the same shape."** No — the first calls `retry(3)` to *get* a decorator; the second uses `retry` *as* the decorator.
- **"`wraps` is cosmetic."** It also fixes `inspect.signature`, `help()`, and tooling that keys off `__name__`/`__wrapped__`.
- **"Stacked decorators apply top-down."** They apply bottom-up; the topmost is the outermost wrapper.
- **"You can decorate an instance method with `@staticmethod` in any order."** Order matters; `classmethod`/`staticmethod` belong outermost.

**What follows from this topic** — Decorators lean on closures (scoping/`nonlocal`) and feed directly into `functools` (`lru_cache`, `cached_property`, `singledispatch`, `partial`). The class-decorator flavor underpins `dataclasses`. Understanding definition-time execution connects to import-time side effects and metaclasses. Caching decorators raise the memory-leak questions covered under reference counting and `weakref`, and async decorators (wrapping coroutines) connect to the asyncio topic.

### Q21. What is a decorator, mechanically? Show the desugaring of `@dec` and why decorators rely on first-class functions + closures.

A decorator is just a callable applied to another callable at definition time, with the result rebound to the original name. The `@` syntax is sugar — nothing more.

```python
@dec
def f(x):
    return x

# is exactly equivalent to:
def f(x):
    return x
f = dec(f)
```

That equivalence is the whole story. `dec` receives the freshly-created function object `f`, and whatever `dec` returns gets bound to the name `f`. Usually `dec` returns a `wrapper` that calls the original, but it could return anything — a string, a class, `None` (a real footgun: forgetting to `return wrapper` rebinds `f` to `None`).

Two language features make this work. First, functions are **first-class**: `f` is an ordinary object you can pass into `dec` and return out of it. Second, **closures** let the inner `wrapper` capture the original `func` by reference, so it survives after `dec` returns.

```python
def dec(func):
    def wrapper(*args, **kwargs):
        print("before")
        result = func(*args, **kwargs)   # `func` captured via closure
        print("after")
        return result
    return wrapper
```

You can verify the closure: `wrapper.__closure__[0].cell_contents` is the captured `func`. The key senior insight is *when* this runs — `dec(func)` executes once, at import/definition time. Only `wrapper` runs per call. Use `*args, **kwargs` in the wrapper so it's signature-transparent to arbitrary callables.

### Q22. Why use functools.wraps? What breaks (name, docstring, introspection) if you forget it?

Without `wraps`, the decorated name now points at `wrapper`, so all the metadata you see is `wrapper`'s, not the original's. `f.__name__` becomes `"wrapper"`, `f.__doc__` is `None` (or wrapper's docstring), `f.__module__`/`__qualname__` are wrong, and `inspect.signature(f)` reports `(*args, **kwargs)` instead of the real parameters.

```python
import functools, inspect

def dec(func):
    @functools.wraps(func)          # copies metadata, sets __wrapped__
    def wrapper(*args, **kwargs):
        return func(*args, **kwargs)
    return wrapper

@dec
def add(a: int, b: int) -> int:
    "Add two ints."
    return a + b

print(add.__name__)              # 'add'  (without wraps: 'wrapper')
print(add.__doc__)               # 'Add two ints.'
print(inspect.signature(add))    # (a: int, b: int) -> int
```

`wraps` copies `__name__`, `__qualname__`, `__doc__`, `__module__`, updates `__dict__`, and crucially sets `__wrapped__ = func`. That `__wrapped__` link is what lets `inspect.signature` and `inspect.unwrap` see through the wrapper to the real signature.

This is not cosmetic. Tooling breaks without it: `help()` shows garbage, Sphinx documents the wrong signature, pytest's fixture/test discovery and frameworks that introspect parameter names (FastAPI, click, dependency injectors) misbehave, and logging that prints `func.__name__` lies. On stacked decorators, every layer should use `wraps` so the chain stays unwrappable. The one caveat: `wraps` copies `__dict__` by *update*, and signature reporting still reflects the original even if `wrapper` genuinely takes different args — if your wrapper changes the real signature, set `__signature__` explicitly rather than letting `__wrapped__` lie.

### Q23. Write a decorator factory that takes arguments — e.g. a retry decorator with N attempts and exponential backoff. Walk through the three nested layers.

A parameterized decorator needs three layers because `@retry(attempts=3)` *calls* `retry` first to obtain the actual decorator, which then receives the function.

```python
import functools, time, random

def retry(attempts=3, base_delay=0.1, exc=Exception, jitter=True):
    def decorator(func):                       # layer 2: real decorator
        @functools.wraps(func)
        def wrapper(*args, **kwargs):          # layer 3: per-call logic
            delay = base_delay
            for attempt in range(1, attempts + 1):
                try:
                    return func(*args, **kwargs)
                except exc as e:
                    if attempt == attempts:
                        raise
                    sleep = delay + (random.random() * delay if jitter else 0)
                    time.sleep(sleep)
                    delay *= 2                  # exponential backoff
        return wrapper
    return decorator                           # layer 1 returns layer 2

@retry(attempts=5, base_delay=0.2, exc=ConnectionError)
def fetch(url): ...
```

**Layer 1** — `retry(...)` is the *factory*. It runs when you write `@retry(attempts=5)`, captures the parameters in a closure, and returns `decorator`. **Layer 2** — `decorator(func)` is the actual decorator: it receives the function and returns the wrapper. **Layer 3** — `wrapper(*args, **kwargs)` holds the runtime logic, closing over both `func` (from layer 2) and the factory args (from layer 1).

Walk the desugaring: `@retry(attempts=5)` becomes `fetch = retry(attempts=5)(fetch)` — two calls. Note the `attempt == attempts` guard re-raises on the *last* try instead of swallowing; that's the bug people ship — they loop and silently return `None` after exhausting retries. Jitter avoids thundering-herd retries. A senior touch: catch a specific `exc`, not bare `Exception`, and consider `raise ... from e` plus structured logging of each attempt. For async targets, the wrapper must be `async def` and use `await func(...)` / `asyncio.sleep` — a sync retry can't wrap a coroutine.

### Q24. Function decorators vs class decorators vs decorating with a class (__call__). When would you use each, and how do you decorate while preserving state?

Three distinct things share the word "decorator." A **function decorator** takes a function and returns a callable — the everyday case. A **class decorator** takes a *class* and returns a (usually modified) class — `@dataclass`, `@functools.total_ordering`, registration decorators that mutate `cls`. **Decorating with a class** means the decorator itself is a class whose `__call__` makes instances callable, so the instance *is* the wrapper.

| Form | Receives | Returns | Use when |
|------|----------|---------|----------|
| Function decorator | a function | a wrapper function | adding per-call behavior (log, retry, cache) |
| Class decorator | a class | a class | augmenting/registering a class (`@dataclass`) |
| Class-as-decorator (`__call__`) | a function | a callable instance | the wrapper needs rich, mutable state |

For **state**, a function decorator stores it in the closure cell, mutating it with `nonlocal`:

```python
import functools

def count_calls(func):
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        wrapper.calls += 1          # attribute on the wrapper object
        return func(*args, **kwargs)
    wrapper.calls = 0
    return wrapper
```

The class form makes state explicit and inspectable — often cleaner when there's a lot of it:

```python
class CountCalls:
    def __init__(self, func):
        functools.update_wrapper(self, func)   # the class-based wraps
        self.func = func
        self.calls = 0
    def __call__(self, *args, **kwargs):
        self.calls += 1
        return self.func(*args, **kwargs)
```

Use `functools.update_wrapper(self, func)` (the imperative cousin of `@wraps`) in `__init__`. The big caveat: a plain class-based decorator does **not** become a bound method when used on instance methods — `self.__get__` isn't a function, so the descriptor protocol won't pass the instance. To decorate methods with a class, implement `__get__` to return a `functools.partial`/bound wrapper, or just use a function decorator. That descriptor gap is exactly why most method decorators are written as functions.

### Q25. How do stacked decorators compose (order of application), and how do decorators interact with methods (self, classmethod/staticmethod ordering)?

Stacked decorators apply **bottom-up** but execute **top-down** at call time. The one nearest the `def` wraps first; the topmost ends up outermost.

```python
@a
@b
@c
def f(): ...

# desugars to:
f = a(b(c(f)))
```

So `c` wraps the original, `b` wraps that, `a` wraps the outside. At call time you enter `a`'s wrapper first, then `b`, then `c`, then `f` — and unwind in reverse. This matters for correctness: if you stack `@cache` and `@validate`, the order decides whether you validate before or after a cache hit. Put `@cache` outermost (top) to skip validation on hits, or innermost to always validate first.

For **methods**, an ordinary function decorator is fine because the wrapper is still a plain function, so the descriptor protocol binds `self` normally — `wrapper(*args)` receives `self` as `args[0]`. The subtle rule is `classmethod`/`staticmethod`: they must be the **outermost** (topmost) decorator.

```python
class Service:
    @classmethod          # outermost — correct
    @retry(attempts=3)
    def connect(cls): ...
```

Here `retry` wraps the underlying function (a normal callable closing over `cls`), and `classmethod` wraps *that*, turning it into a classmethod descriptor. Reverse them — `@retry` on top of `@classmethod` — and `retry` receives a `classmethod` object, which isn't callable the way you expect; calling it blows up or mis-binds. `classmethod`/`staticmethod` produce descriptors, not plain functions, so nothing should wrap them further. As of 3.11+, chaining `classmethod` with other descriptors (the old `@classmethod @property` combo) was removed, reinforcing the rule: put `classmethod`/`staticmethod` last in the stack and let plain function decorators sit beneath them.

---

## Generators & Iterators

### Summary

**What this topic covers** — This topic is about Python's iteration machinery: the iterator protocol (`__iter__`/`__next__`), the iterable-vs-iterator distinction, generators built with `yield`, generator expressions, the coroutine-flavored generator methods (`send`/`throw`/`close`/`yield from`), and the `itertools` standard-library toolkit. It is the foundation of lazy, streaming, memory-bounded data processing in Python, and it underpins `for` loops, comprehensions, unpacking, and (historically) the whole `async`/`await` machinery.

**Mental model** — Think of iteration as a one-way ratchet driven by a single call: `next(it)`. An *iterable* is anything that can hand you a fresh cursor when you call `iter()` on it; an *iterator* is that cursor, and it is itself iterable (its `__iter__` returns `self`). A `for` loop is sugar: call `iter()` once, call `next()` until `StopIteration`, done. A generator is the cheapest way to build an iterator — the function body becomes a resumable state machine. Each `yield` is a suspend point: local variables, the instruction pointer, and the call stack frame are frozen on the heap, and `next()` thaws them, runs to the next `yield`, and refreezes. Nothing is precomputed; values are produced on demand. This is why generators are *lazy* and *O(1)* in memory regardless of how many values they eventually emit — there is only ever one frame and one in-flight value alive at a time. The cursor is also *stateful and exhaustible*: once it raises `StopIteration`, it is dead.

**Key terms**
- **Iterable** — an object with `__iter__`; can produce an iterator. Lists, dicts, files, ranges.
- **Iterator** — an object with `__next__` (and `__iter__` returning `self`); the stateful cursor.
- **`StopIteration`** — the exception `__next__` raises to signal exhaustion; `for` swallows it.
- **Generator function** — a `def` containing `yield`; calling it returns a generator object without running the body.
- **Generator object** — the resumable iterator a generator function returns; one frozen frame.
- **`yield`** — suspend execution, emit a value, optionally receive one via `send`.
- **Generator expression** — `(expr for x in it)`; a lazy, single-pass anonymous generator.
- **`yield from`** — delegate iteration (and `send`/`throw`/return value) to a sub-iterable.
- **Lazy evaluation** — values computed on demand at `next()` time, not eagerly upfront.
- **Coroutine (generator-based)** — a generator driven via `send()` to consume pushed values.
- **`itertools`** — C-implemented iterator algebra: `chain`, `islice`, `groupby`, `tee`, etc.

**Why interviewers ask this** — Iteration sorts juniors from seniors fast. A junior describes a generator as "a function with `yield` that's faster"; a senior explains *why* it's memory-bounded (one heap frame, lazy production), knows that an iterator is single-pass and that re-iterating an exhausted generator silently yields nothing, and can reach for `itertools` instead of hand-rolling buffering loops. The senior signal is precision about the protocol (what exactly `for` does, what `StopIteration` means, why `return` in a generator becomes `StopIteration.value`), awareness of the consumed-once footguns (generator expressions, `tee`, zipping two views of the same iterator), and judgment about when laziness pays — streaming a 10GB file vs. when you genuinely need a materialized list you can index and re-traverse. It also tests whether a candidate understands that pre-3.5 async was built on this exact machinery.

**Common confusions**
- **"An iterable and an iterator are the same thing."** No — a list is iterable but not its own iterator; `iter(list)` gives you a fresh, independent cursor each time.
- **"You can loop over a generator twice."** You cannot; it's exhausted after one pass and silently yields nothing the second time.
- **"Generators are faster than lists."** Per-item they're often *slower*; the win is memory and not paying for items you never consume.
- **"`StopIteration` propagating out of a generator just ends it."** Since PEP 479 (3.7) it's converted to `RuntimeError` inside generators — a real gotcha.
- **"`yield from x` is just `for i in x: yield i`."** It also forwards `send`/`throw`/`close` and captures `x`'s return value.

**What follows from this topic** — Lazy iteration is the substrate for *async* (`async def`/`await` generalized the suspend/resume mechanism here), for *context managers* via `contextlib.contextmanager` (a generator with one `yield`), and for memory profiling discussions (`tracemalloc`, why streaming beats loading). It connects to comprehensions and functional tools (`map`, `filter`, `functools.reduce`), and to performance work where you weigh per-item C-loop speed in `itertools` against Python-level generator overhead.

### Q26. Iterator protocol: __iter__ vs __next__, and the difference between an iterable and an iterator. What raises StopIteration?

An **iterable** is anything you can call `iter()` on — it implements `__iter__`, which returns a *fresh* iterator. An **iterator** implements `__next__`, which produces the next value or raises `StopIteration` when exhausted. Crucially, every iterator is also iterable: its `__iter__` returns `self`. That self-return is what lets you pass an iterator directly to a `for` loop.

A `for` loop is just sugar over this protocol:

```python
it = iter(iterable)          # __iter__
while True:
    try:
        x = next(it)         # __next__
    except StopIteration:
        break
    ...                      # loop body
```

`StopIteration` is raised by `__next__` (or `next()`) to signal exhaustion — the loop catches it. You rarely raise it by hand; in a generator you just `return` (or fall off the end) and the machinery raises it for you, attaching the return value to `StopIteration.value`.

The list-vs-cursor distinction is the part candidates fumble. A list is iterable but is *not* its own iterator — calling `iter(my_list)` twice gives two independent cursors, which is why you can loop a list repeatedly. An iterator is single-pass and stateful:

```python
nums = [1, 2, 3]
i1, i2 = iter(nums), iter(nums)
next(i1); next(i1)           # i1 advanced to 2
next(i2)                     # i2 independent, still at 1

it = iter(nums)
list(it)                     # [1, 2, 3]
list(it)                     # [] — exhausted, silently empty
```

A hand-rolled iterator separates the two concerns cleanly:

```python
class Countdown:
    def __init__(self, n): self.n = n
    def __iter__(self): return CountdownIter(self.n)   # iterable: fresh cursor

class CountdownIter:
    def __init__(self, n): self.n = n
    def __iter__(self): return self                    # iterator: self
    def __next__(self):
        if self.n <= 0: raise StopIteration
        self.n -= 1
        return self.n + 1
```

Keeping `__next__` off the container (so `__iter__` returns a separate object) is what makes `Countdown` re-iterable and nestable in two `for` loops at once. In practice you'd write `Countdown` as a generator and get all of this for free.

### Q27. What is a generator and how does `yield` make a function lazy? Why is iterating a 10GB file line-by-line O(1) memory?

A **generator** is the easy way to build an iterator: any `def` containing `yield` becomes a generator function. Calling it runs *none* of the body — it returns a generator object with a frozen frame. The body only executes when you call `next()` (or iterate), running until it hits a `yield`, which suspends execution and emits a value. The next `next()` resumes *right after* that `yield` with all locals intact.

```python
def gen():
    print("start"); yield 1
    print("mid");   yield 2

g = gen()        # nothing printed — body hasn't run
next(g)          # "start", returns 1
next(g)          # "mid",   returns 2
next(g)          # raises StopIteration
```

`yield` makes the function *lazy* because each value is computed on demand at `next()` time, not eagerly upfront. The frame — locals, instruction pointer, the suspended stack — lives on the heap and is reused across resumptions. So at any instant there is exactly **one** frame and **one** in-flight value alive, regardless of how many values the generator will ultimately produce. That's the O(1) memory property.

The 10GB file is the canonical example. A file object is *already* a lazy line iterator, so:

```python
with open("huge.log") as f:
    for line in f:                     # one line in memory at a time
        if "ERROR" in line:
            ...
```

Memory stays proportional to the *longest single line*, not the file size, because each `next(f)` reads only up to the next newline and the previous line is garbage-collected (CPython frees it immediately via refcounting once `line` is rebound). Contrast with `f.readlines()` or `f.read().split("\n")`, which materialize all 10GB. The senior point: laziness lets you compose a *pipeline* of generators — read, filter, parse, transform — and the whole chain stays O(1) because each stage pulls one item at a time from the stage upstream. Nothing buffers unless you force it with `list()`.

### Q28. Generator expressions vs list comprehensions — when does `(x for x in ...)` beat `[x for x in ...]`, and what's the consumed-once gotcha?

A list comprehension `[f(x) for x in it]` builds and returns the whole list eagerly. A generator expression `(f(x) for x in it)` returns a lazy iterator that produces items one at a time. Same syntax, parentheses vs brackets, completely different memory profile.

The generator expression wins when (a) the source is large or infinite, (b) you might not consume all of it, or (c) you're feeding a consumer that streams. The classic case is passing straight into a reducer — no intermediate list ever exists:

```python
total = sum(x * x for x in range(10_000_000))   # O(1) memory, no list built
any(line.startswith("ERROR") for line in f)     # short-circuits, stops early
```

When you call `any`/`all`/`next` and the answer is decided early, the genexp stops pulling — a list comp would have built all 10M elements first. (Bare genexp as a sole function arg needs no extra parens: `sum(x*x for x in it)` is fine.)

The list comprehension wins when you need the result *more than once*, need to index it, need `len()`, or will re-iterate. That's the **consumed-once gotcha**: a generator expression is a single-pass iterator, so the second traversal silently yields nothing.

```python
squares = (x*x for x in range(5))
print(max(squares))   # 16
print(min(squares))   # ValueError: min() arg is an empty sequence — exhausted!
```

This bites people who store a genexp in a variable expecting list semantics. Another subtle trap: genexps capture the *iteration variable* late but evaluate the *outermost iterable* eagerly at creation time. So `(x for x in undefined_name)` raises immediately, but `(x*y for x in a)` reads `y` only when consumed — change `y` between creation and consumption and you get surprising values. Rule of thumb: reach for a genexp by default in a pipeline, materialize to a list the moment you need random access, length, or a second pass.

### Q29. Advanced generators: send(), throw(), close(), and `yield from`. What can a generator-coroutine do that a plain function can't?

Beyond producing values, a generator can *receive* them, making it a coroutine. `yield` is an expression: `received = yield value`. The value you pass to `g.send(x)` becomes the result of the paused `yield`. You must `next()` (or `send(None)`) once to advance to the first `yield` before sending — "priming" the coroutine.

```python
def averager():
    total = count = 0
    while True:
        x = yield (total / count if count else None)
        total += x; count += 1

avg = averager()
next(avg)              # prime
avg.send(10)           # 10.0
avg.send(20)           # 15.0
```

This is the thing a plain function can't do: maintain live local state *across* multiple entries while staying suspended in between. A function runs to completion and forgets everything; a generator-coroutine is a resumable, stateful object you push data into.

`throw()` raises an exception *at the suspended yield point*, letting the generator handle it with local `try/except` — useful for signaling errors into a running pipeline. `close()` raises `GeneratorExit` at the yield; the generator should let it propagate (or clean up in a `finally`) and stop. This is how generators run cleanup deterministically, which is exactly what `@contextlib.contextmanager` exploits — a one-`yield` generator whose `finally` runs the teardown.

```python
def managed():
    print("setup")
    try:
        yield "resource"
    finally:
        print("teardown")   # runs on close() or GC
```

`yield from sub` delegates entirely to a sub-iterable: it yields all of `sub`'s values, *and* transparently forwards `send`/`throw`/`close` to it, *and* evaluates to `sub`'s return value (`StopIteration.value`). It's not just `for i in sub: yield i` — that loop drops the return value and breaks the send/throw channel. `yield from` is what let generators compose into trees of coroutines, and it was the direct ancestor of `await`. One PEP 479 caveat: a bare `StopIteration` raised inside a generator body now becomes a `RuntimeError`, so don't rely on it leaking out to end iteration — `return` instead.

### Q30. Tour itertools for real problems — chain, islice, groupby, count, cycle, tee. Give a one-liner that would be clunky without it.

`itertools` is a C-implemented iterator algebra — lazy, memory-frugal, and fast because the loops run in C. The workhorses:

| Tool | Does | Watch out for |
|------|------|---------------|
| `chain(a, b, ...)` | concatenate iterables lazily | `chain.from_iterable` for a stream of streams |
| `islice(it, start, stop, step)` | slice an iterator (can't use `[ ]`) | consumes the iterator; no negative indices |
| `groupby(it, key)` | group *consecutive* equal-key runs | **must sort first** for global grouping |
| `count(start, step)` | infinite counter | pair with `islice`/`zip` or it never ends |
| `cycle(it)` | repeat forever | buffers the whole iterable in memory |
| `tee(it, n)` | n independent iterators from one | buffers items one cursor consumed but others haven't |

The one-liner that's genuinely clunky without it — flatten a list of lists lazily:

```python
flat = itertools.chain.from_iterable(list_of_lists)   # no nested loop, O(1) memory
```

`groupby` is the most misused. It only groups *adjacent* runs, so for global grouping you sort by the same key first, and the group sub-iterator is consumed lazily — materialize it before advancing:

```python
rows.sort(key=lambda r: r.dept)
for dept, grp in itertools.groupby(rows, key=lambda r: r.dept):
    members = list(grp)        # consume now; grp dies on next outer step
```

`islice` is how you page or take-N from any iterator, including infinite ones — `list(islice(count(), 5))` → `[0,1,2,3,4]`. `tee` looks tempting for "iterate twice," but if the two cursors drift far apart it buffers everything in between, so it's no cheaper than `list()` when consumption is unbalanced — and never advance the original iterator after `tee`ing it. `cycle` similarly stores the full sequence to repeat it.

Senior judgment: itertools shines for *streaming* composition where you'd otherwise hand-roll index bookkeeping or accumulate buffers. But it's not magic — `tee`, `cycle`, and `groupby`-after-sort all have hidden memory costs, and a plain comprehension is often clearer for finite, in-memory data. Reach for it when laziness or infinite sequences are the point.

---

## Comprehensions & Functional

### Summary

**What this topic covers** — Python's comprehension family (list, set, dict, and generator) and the functional toolkit that orbits it: `map`, `filter`, `functools.reduce`, lambdas, and the assignment expression (walrus `:=`). The focus is on choosing the right construct, knowing when a comprehension *hurts* rather than helps, and reading the dense forms (nested loops, conditional expressions) without misparsing them — a thing even strong engineers get wrong under pressure.

**Mental model** — A comprehension is syntactic sugar for a `for` loop that builds a collection, but it carries two senior-relevant properties. First, it produces the whole collection eagerly *except* the generator form `(...)`, which is lazy and yields one item at a time — that laziness is the entire reason to prefer it over a list comp when you're going to stream or short-circuit. Second, since Python 3 the loop variable lives in its **own scope**, so `[i for i in range(3)]` does not leak `i` into the enclosing function (a real semantic difference from a plain `for`). Read a comprehension left-to-right as nested statements: the leftmost expression is the *output*, then the `for`/`if` clauses read top-to-bottom exactly as you'd write them as nested loops. A trailing `if` *filters*; an `if/else` before the `for` is a *conditional expression* (ternary) that transforms. Confusing those two positions is the single most common comprehension bug.

**Key terms**
- **List comprehension** — `[expr for x in it if cond]`; eager, returns a `list`.
- **Set / dict comprehension** — `{expr ...}` / `{k: v ...}`; dedupes / builds a mapping.
- **Generator expression** — `(expr for x in it)`; lazy iterator, no stored list, single-pass.
- **Filtering clause** — a trailing `if cond` that *drops* elements.
- **Conditional expression** — `a if cond else b`, a ternary that *transforms* the output value.
- **`functools.reduce`** — left-fold collapsing an iterable to one value with a binary function.
- **Walrus `:=`** — assignment expression; binds a name *and* yields the value inline.
- **Comprehension scope** — the loop variable is local to the comprehension, not leaked (Py3).
- **`map` / `filter`** — lazy built-ins returning iterators, not lists.
- **Lazy vs eager** — whether the whole collection materializes now or item-by-item.

**Why interviewers ask this** — Comprehensions are where idiom, performance instinct, and readability judgment all surface in three lines. A junior writes a triple-nested comprehension because it's "Pythonic" and is proud of the density; a senior knows the comprehension that should have been a loop, reaches for a generator expression when feeding `sum`/`any`/`join` to avoid building a throwaway list, and can explain *why* `reduce` is usually a `sum`/`math.prod`/loop in disguise. The walrus operator is a deliberate trap: it's a recent feature (3.8) that's genuinely good in two or three patterns and a readability disaster everywhere else, so it tests whether you have taste, not just knowledge. Interviewers also probe the conditional-expression-vs-filter distinction because misreading it produces silently wrong results, not crashes.

**Common confusions**
- **"A generator expression is just a faster list comprehension."** It's lazy and single-pass; exhaust it once and it's empty. Different tool.
- **"The loop variable leaks out of the comprehension."** False in Python 3 — it has its own scope.
- **"`if/else` can go after the `for` to filter."** No — a trailing `if` filters; `if/else` must sit *before* the `for` as a ternary on the output.
- **"`reduce` is the functional, idiomatic choice."** Guido deliberately demoted it to `functools`; a loop or `sum`/`prod` usually reads better.
- **"`map(f, xs)` returns a list."** It returns a lazy iterator in Python 3.

**What follows from this topic** — Generator expressions lead straight into **Generators & Iterators** (lazy evaluation, `yield`, memory). The walrus and conditional expressions connect to **Idioms & Pythonic Style**. `functools.reduce`/`partial`/`lru_cache` open into **functools & Decorators**, and the lazy-vs-eager tradeoff reappears whenever you reason about memory in **Performance & Profiling**.

### Q31. Show list / dict / set / generator comprehensions and when each is the right tool. When does a comprehension hurt readability vs a loop?

Four shapes, distinguished by brackets and whether you emit a pair:

```python
nums = [1, -2, 3, -2, 4]

squares      = [n*n for n in nums]            # list  -> [1, 4, 9, 4, 16]
unique_abs   = {abs(n) for n in nums}         # set   -> {1, 2, 3, 4}
index_of     = {n: i for i, n in enumerate(nums)}  # dict -> {1:0, -2:3, 3:2, 4:4}
total        = sum(n*n for n in nums)         # generator expr, no brackets needed
```

Pick by the *output you need*. List when you'll index, slice, or iterate more than once. Set when you want dedup or membership tests. Dict when building a lookup. Generator expression when the result feeds straight into a consumer (`sum`, `any`, `all`, `max`, `"".join(...)`, `set(...)`) — you avoid materializing a throwaway list, which matters for large or infinite inputs. The classic win: `sum(x*x for x in big)` peaks at O(1) extra memory; `sum([x*x for x in big])` builds the whole list first.

A comprehension *earns its place* when it's a single map and/or filter that reads as one thought. It *hurts* the moment you have side effects, multiple statements, `try/except`, or more than about two clauses. This is unreadable:

```python
result = [transform(x) for sub in data for x in sub if valid(x) and x.score > thresh]
```

Once you're nesting two `for`s and a compound `if`, a plain loop with named intermediates is kinder to the next reader — and you can step a debugger through it. My rule: if I can't read the comprehension aloud as one sentence, it should be a loop. And never use a comprehension purely for its side effects (`[print(x) for x in xs]`) — that builds a list of `None`s you throw away; write the `for` loop.

### Q32. map/filter/reduce vs comprehensions — which is more idiomatic in modern Python and why? When is reduce justified?

Comprehensions win in modern Python, and it's a deliberate language-design stance. `map`/`filter` return lazy iterators (Python 3), which is fine, but the moment you need a transform *and* a filter you get the unreadable nesting `map(f, filter(pred, xs))` — read inside-out — whereas the comprehension reads left-to-right: `[f(x) for x in xs if pred(x)]`. `map` is only cleaner when you're applying an *existing named function with no lambda*: `map(str, nums)` beats `[str(n) for n in nums]` slightly, and pairs well with `str.join`. The instant you'd write `map(lambda x: x*2, xs)`, the comprehension is strictly better — no `lambda` tax.

`reduce` was deliberately demoted to `functools` in Python 3; Guido's argument was that almost every real `reduce` is more readable as an explicit loop or a specialized built-in. So before reaching for it, check whether the named tool exists:

| Intent | Don't | Do |
|---|---|---|
| sum | `reduce(add, xs)` | `sum(xs)` |
| product | `reduce(mul, xs)` | `math.prod(xs)` |
| flatten | `reduce(add, lists)` | `itertools.chain.from_iterable(lists)` |
| max | `reduce(...)` | `max(xs)` |

`reduce` is justified only when the fold is genuinely custom *and* has no accumulator you'd rather name — e.g. composing functions, or a running combine with no built-in:

```python
from functools import reduce
compose = reduce(lambda f, g: lambda x: f(g(x)), funcs, lambda x: x)
```

Even then, many seniors would write the explicit loop with a named `acc` because it's easier to debug. If you do use `reduce`, always pass the initializer (the third arg) — relying on the first element as the seed crashes on an empty iterable.

### Q33. The walrus operator := — give a case where it genuinely improves a comprehension or while-loop, and where it's just clever.

The walrus binds a name and yields its value in the same expression. Its best, uncontroversial home is the read-until-sentinel loop, which is genuinely cleaner than the old prime-and-repeat dance:

```python
# Good: no duplicated read, no while True/break
while (chunk := f.read(8192)):
    process(chunk)
```

In comprehensions its one real win is **avoiding a recomputed expensive call** when you both filter on it and use it:

```python
# Good: y computed once per item, filtered and reused
results = [y for x in data if (y := expensive(x)) is not None]
```

Without the walrus you'd compute `expensive(x)` twice (once in the `if`, once in the output) or fall back to a loop. This is the canonical justified case.

Where it's just clever: cramming assignment into an expression to save a line at the cost of a double-take. `[y := f(x), y**2, y**3]` leaks `y` from the comprehension into the enclosing scope (walrus deliberately does *not* respect comprehension scoping — a sharp edge), and reads like a puzzle. Likewise `if (n := len(a)) > 10:` is fine, but burying multiple walruses in a `while` condition or a nested ternary is write-only code.

My tape-measure: use it for the sentinel `while` and the compute-once-in-a-comprehension cases, and reach for it anywhere else only if removing it would force a clearly worse structure. If a reviewer has to pause to find where `y` came from, it failed.

### Q34. Nested comprehensions and conditional expressions — read/write `[x for row in m for x in row]` and `[a if c else b for ...]` correctly.

Two different constructs that look similar and trip people up. The first is a **nested loop**; read the `for` clauses left-to-right in the same order you'd nest them:

```python
m = [[1, 2], [3, 4]]
flat = [x for row in m for x in row]      # -> [1, 2, 3, 4]
# equivalent to:
flat = []
for row in m:          # outer first
    for x in row:      # inner second
        flat.append(x)
```

The order is the gotcha: it's *outer-to-inner left-to-right*, which feels backwards if you expected the innermost loop first. And the output expression `x` must reference a name bound by one of the `for` clauses — `[x for x in row for row in m]` is a `NameError` because `row` isn't defined yet when the first clause runs.

The second construct is a **conditional expression** (ternary) in the *output* position — it transforms each element and emits one item per input:

```python
signs = [1 if v > 0 else -1 for v in vals]   # if/else BEFORE the for
```

Contrast with a *filtering* `if`, which sits *after* the `for` and drops elements:

```python
positives = [v for v in vals if v > 0]       # plain if AFTER the for -> filter
```

This is the single most common comprehension bug. `[a if c else b for x in xs]` keeps every element, choosing `a` or `b`; `[a for x in xs if c]` keeps only the elements where `c` holds. If you want *both* — transform and filter — combine them, ternary in front and a plain `if` at the back:

```python
[x*2 if x % 2 else x for x in xs if x > 0]   # filter x>0, then map evens->x*2
```

When you genuinely need to build a list-of-lists (not flatten), nest a comprehension in the output slot: `[[x for x in row] for row in m]`. Two levels is the readable ceiling; beyond that, write the loop.

---

## OOP & Classes

### Summary

**What this topic covers**

This topic is about how Python builds objects: the two-phase construction protocol (`__new__`/`__init__`), the three method flavours (instance, class, static), the descriptor protocol that powers `@property` and a great deal of the language besides, the dunder contracts that make objects behave correctly in collections and comparisons, and the memory/ergonomic levers — `__slots__`, `@dataclass`, `namedtuple`, `attrs`. It is the senior-level "how does Python's object model actually work" material, where the difference between a memorised answer and an understood one is obvious.

**Mental model**

A Python class is itself an object — an instance of its metaclass (`type` by default). Attribute lookup on an instance walks a deterministic path: data descriptors on the type win, then the instance `__dict__`, then non-data descriptors and plain class attributes, following the MRO (C3 linearisation). Almost every "magic" feature is a descriptor: `@property`, methods (functions are non-data descriptors whose `__get__` produces bound methods), `@staticmethod`, `@classmethod`, and `__slots__` entries are all descriptors living on the type. Construction is two phases: `__new__(cls, ...)` allocates and returns the instance (a static method by convention), then `__init__(self, ...)` mutates it in place — and crucially, `__init__` runs only if `__new__` returned an instance of `cls`. Equality and hashing form a contract enforced by every set and dict. Understanding that "the type holds behaviour, the instance holds state, and lookup is descriptor-mediated" lets you derive every answer here rather than memorise them.

**Key terms**

- **Descriptor** — an object defining `__get__`/`__set__`/`__delete__`; controls attribute access when stored on a class.
- **Data descriptor** — defines `__set__` or `__delete__`; takes priority over the instance `__dict__`.
- **Non-data descriptor** — defines only `__get__` (e.g. a plain function); instance `__dict__` shadows it.
- **Bound method** — a function descriptor's `__get__` result, with `self` partially applied.
- **MRO** — method resolution order, the C3-linearised list `type(obj).__mro__` lookup follows.
- **Metaclass** — the class of a class; `type` by default; controls class creation.
- **Dunder** — "double underscore" special method (`__eq__`, `__repr__`); invoked by syntax/protocols, looked up on the *type*, not the instance.
- **`__slots__`** — a class attribute that replaces per-instance `__dict__` with fixed descriptor slots.
- **Hashable** — has a stable `__hash__` and sane `__eq__`; required for dict keys and set members.
- **`__dict__`** — the per-instance attribute namespace (a mapping); absent when `__slots__` is used.

**Why interviewers ask this**

OOP questions separate people who *use* classes from people who understand the object model. A junior says "`@property` makes a getter"; a senior explains it's a data descriptor on the type, why that beats an instance attribute in lookup, and when a reusable custom descriptor pays off over copy-pasted properties. A junior knows `__init__`; a senior knows `__new__` exists, why immutable types and singletons need it, and that overriding `__init__` on an `int` subclass is useless. The `__eq__`/`__hash__` contract is a favourite because getting it wrong silently corrupts sets — and Python's "define `__eq__`, lose `__hash__`" default trips up people who haven't read the data model. Strong candidates reach for `@dataclass` but can articulate the `frozen`/`eq`/`__hash__` interactions and when `attrs` or `__slots__` earns its place.

**Common confusions**

- **"`__new__` and `__init__` are alternatives"** — both run; `__new__` constructs and returns, `__init__` initialises the returned object.
- **"`@staticmethod` and `@classmethod` are basically the same"** — `classmethod` receives `cls` (polymorphic, great for alternative constructors); `staticmethod` receives nothing special.
- **"Defining `__eq__` keeps the default hash"** — no; Python sets `__hash__ = None`, making instances unhashable unless you redefine it.
- **"`@property` is just syntactic sugar for a method"** — it's a *data descriptor*, which is why it overrides instance-dict assignment.
- **"`__slots__` always saves memory"** — only if you don't also keep a `__dict__`, and it costs you dynamic attributes, multiple-inheritance freedom, and weakref support unless you add `__weakref__`.
- **"`@dataclass` is the same as `namedtuple`"** — dataclasses are mutable classes by default and aren't tuples; you can't unpack them or index them.

**What follows from this topic**

Descriptors and the MRO connect directly to **metaclasses and `__init_subclass__`**. The `__eq__`/`__hash__` contract feeds the **data model / dunder** and **collections** topics (how sets and dicts use hashing). `__slots__` and `@dataclass(slots=True)` tie into **memory management** (refcounting, `__dict__` overhead, `weakref`). `frozen` dataclasses and immutability connect to **concurrency** (immutable objects are safely shareable across threads even under the GIL, and matter more in the free-threaded 3.13 build).

### Q35. __init__ vs __new__: what does each do, when does __new__ matter (immutables, singletons, metaclasses)?

`__new__` is the constructor: a (implicitly) static method that receives the class and returns a new instance. `__init__` is the initialiser: it receives the already-built instance as `self` and mutates it, returning `None`. The two-phase rule that catches people: `__init__` is only called if `__new__` returns an instance of `cls` (or a subclass). Return something else and `__init__` is silently skipped.

For 99% of classes you only touch `__init__`, because the default `object.__new__` does the right thing. `__new__` matters in three cases.

**Immutables.** You can't set attributes in `__init__` on an immutable type — its state is fixed at allocation. So subclassing `int`, `str`, `tuple`, etc. means doing the work in `__new__`:

```python
class PositiveInt(int):
    def __new__(cls, value):
        if value < 0:
            raise ValueError("must be >= 0")
        return super().__new__(cls, value)
```

Putting that logic in `__init__` is useless — the `int` value is already baked in by the time `__init__` runs.

**Singletons / caching / interning.** `__new__` controls whether you even get a new object, so it's where you return a cached instance. Honestly, for singletons I'd usually reach for a module-level instance or a `@lru_cache`'d factory before overriding `__new__` — but the pattern is:

```python
class Config:
    _instance = None
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
```

Note the trap: `__init__` still runs every time `Config()` is called, even when `__new__` returns the cached instance — so don't do expensive re-initialisation there.

**Metaclasses.** A metaclass's `__call__` is actually what orchestrates `__new__` then `__init__` for normal instances; and metaclasses themselves override `type.__new__` to customise class creation. That's the deep end — but it's the same protocol one level up.

### Q36. Instance vs class vs static methods (@classmethod / @staticmethod) — what's the difference and a real use for each (alternative constructors)?

Three flavours, distinguished by what implicit first argument they get:

| Kind | First arg | Bound to | Sees subclass? |
|------|-----------|----------|----------------|
| Instance method | `self` | the instance | via `type(self)` |
| `@classmethod` | `cls` | the class | yes — `cls` is the actual subclass |
| `@staticmethod` | nothing | nothing | no |

**Instance methods** are the default — they operate on per-instance state through `self`.

**`@classmethod`** receives the class, which makes it the idiomatic tool for **alternative constructors**. The key property is that `cls` is polymorphic: call it on a subclass and you get a subclass instance back, for free.

```python
from datetime import date

class Money:
    def __init__(self, cents): self.cents = cents

    @classmethod
    def from_dollars(cls, dollars):
        return cls(round(dollars * 100))   # cls, not Money

class Tip(Money): pass

Tip.from_dollars(5)   # -> Tip instance, not Money — because cls is Tip
```

If you'd hardcoded `Money(...)` there, `Tip.from_dollars` would wrongly return a `Money`. This is why `dict.fromkeys`, `datetime.fromtimestamp`, etc. are classmethods.

**`@staticmethod`** is just a plain function namespaced inside the class — no `self`, no `cls`. Use it when the logic is logically related to the class but doesn't touch instance or class state. It's honestly the weakest of the three; often a module-level function is just as good. A legitimate use is a small helper that you want discoverable on the class and overridable:

```python
class Temperature:
    @staticmethod
    def c_to_f(c): return c * 9 / 5 + 32
```

Senior note: don't reach for `@staticmethod` just to "tidy up" — if it never uses the class at all and isn't part of the type's vocabulary, a free function is clearer.

### Q37. @property and the descriptor protocol (__get__/__set__/__delete__) — how do properties work under the hood, and when do you write a custom descriptor?

A descriptor is any object that lives on a *class* and defines at least one of `__get__`, `__set__`, `__delete__`. When you access `instance.attr` and `attr` is a descriptor on the type, Python invokes the descriptor instead of just returning the attribute. This is the mechanism behind methods, `@property`, `@classmethod`, `@staticmethod`, and `__slots__`.

The crucial distinction is **data vs non-data**. A descriptor that defines `__set__` or `__delete__` is a *data descriptor* and wins over the instance `__dict__`. One defining only `__get__` is *non-data* and is shadowed by an instance attribute of the same name. That's why `@property` (which defines all three) can't be accidentally overwritten by `self.x = ...`, while a plain method (non-data) *can* be shadowed by an instance attribute.

`property` is itself a class implementing the descriptor protocol; `@property` just builds one whose `__get__` calls your getter:

```python
class Circle:
    def __init__(self, r): self._r = r

    @property
    def area(self):
        return 3.14159 * self._r ** 2   # computed, read-only
```

**Write a custom descriptor when you'd otherwise copy-paste the same `@property` logic across many attributes** — validation, type-coercion, lazy/cached computation, logging. One descriptor class, reused on N attributes, beats N near-identical properties. Use `__set_name__` (3.6+) to learn the attribute name automatically:

```python
class Positive:
    def __set_name__(self, owner, name):
        self.name = "_" + name
    def __get__(self, obj, objtype=None):
        if obj is None: return self
        return getattr(obj, self.name)
    def __set__(self, obj, value):
        if value < 0: raise ValueError(f"{self.name} must be >= 0")
        setattr(obj, self.name, value)

class Account:
    balance = Positive()
```

That said — for one or two attributes, a `@property` is more readable; reach for a custom descriptor only when reuse actually pays for the indirection. `functools.cached_property` is a ready-made non-data descriptor for the lazy-compute case.

### Q38. Key dunder methods: __repr__ vs __str__, __eq__ + __hash__ (the contract), __call__. What breaks if __eq__ without __hash__?

**`__repr__` vs `__str__`.** `__repr__` is for developers — unambiguous, ideally `eval`-able, shown in the REPL, debugger, and inside container reprs. `__str__` is for end users — readable. If you only write one, write `__repr__`: `str()` falls back to `__repr__`, but not the reverse. The convention:

```python
def __repr__(self): return f"Point(x={self.x!r}, y={self.y!r})"
```

**`__call__`** makes an instance callable, so `obj()` runs `type(obj).__call__(obj, ...)`. Good for stateful function-objects: a configured strategy, a partial-with-state, a caching wrapper, or any "function that needs to remember things" where a closure gets awkward.

**The `__eq__`/`__hash__` contract.** Two rules, enforced by every dict and set:

1. If `a == b` then `hash(a) == hash(b)`. (The reverse need not hold — collisions are fine.)
2. Hash must be stable for the object's lifetime — so hashable objects should be effectively immutable in the fields that define equality.

**What breaks without `__hash__`:** here's the gotcha. The moment you define `__eq__` in a class, CPython *automatically sets* `__hash__ = None`. The reasoning is sound — the default identity-based hash would violate rule 1 for your new equality — but the consequence surprises people: your objects become **unhashable**, and `set()`/dict keys raise `TypeError: unhashable type`.

```python
class Point:
    def __init__(self, x, y): self.x, self.y = x, y
    def __eq__(self, other):
        return (self.x, self.y) == (other.x, other.y)

{Point(1, 2)}   # TypeError: unhashable type: 'Point'
```

Fix: define `__hash__` consistently with `__eq__`, usually over the same fields as a tuple:

```python
    def __hash__(self):
        return hash((self.x, self.y))
```

If the object is mutable and you *want* it unmappable, leaving `__hash__ = None` is actually the correct, safe outcome. And if you want eq-and-hash for free, `@dataclass(frozen=True)` generates both correctly — which is the cleaner answer in most code.

### Q39. What is __slots__ and when is it worth it (memory, attribute control)? What does it cost you?

By default every instance carries a `__dict__` — a per-instance hash table holding its attributes. That's flexible (you can attach arbitrary attributes) but the dict has real per-object overhead. `__slots__` replaces it: you declare the allowed attribute names, and CPython lays them out as fixed C-level slots (implemented as data descriptors on the class) with no per-instance dict.

```python
class Point:
    __slots__ = ("x", "y")
    def __init__(self, x, y): self.x, self.y = x, y
```

**When it's worth it:** you're creating *many* instances (millions of small objects — points, tree nodes, graph edges, parsed records) and memory or cache locality matters. The savings are substantial — often 40-50% per instance for small objects — and attribute access is marginally faster. It also gives you **attribute control** as a side benefit: `p.typ = 1` (a typo for `p.x`) raises `AttributeError` instead of silently creating a junk attribute.

**What it costs you:**

- **No dynamic attributes** — you can't add an attribute not in `__slots__` (that's often a feature, but it bites monkeypatching and some libraries).
- **No `__dict__`** unless you add `"__dict__"` to `__slots__` — which defeats the memory win entirely.
- **No `__weakref__`** by default, so `weakref.ref(obj)` fails unless you add `"__weakref__"` to the slots.
- **Inheritance friction**: slots only help if *every* class in the hierarchy uses them; a single base class with a `__dict__` reintroduces it. Multiple inheritance of two slotted classes with non-empty slots raises a layout conflict.
- Some pickling and `copy` edge cases need care (modern protocols handle it, but `__getstate__`/`__setstate__` assumptions can break).

Senior take: don't reach for `__slots__` reflexively — it's a memory optimisation, not a style. Profile with `tracemalloc` first. The ergonomic modern path is `@dataclass(slots=True)` (3.10+), which gives you slots without hand-writing them.

### Q40. @dataclass — what does it generate, and how does it compare to namedtuple / attrs / a plain class? frozen and eq behaviour.

`@dataclass` (3.7+) is a code generator: from class-level annotated fields it synthesises `__init__`, `__repr__`, and `__eq__` by default, plus optionally ordering, hashing, and slots. You write the *shape*, it writes the boilerplate:

```python
from dataclasses import dataclass

@dataclass
class Point:
    x: int
    y: int = 0   # default
```

**`eq` behaviour:** with `eq=True` (default) it generates field-wise `__eq__` comparing a tuple of the fields — but only between instances of the *same* class. Set `eq=False` and you fall back to identity equality.

**`frozen` behaviour:** `frozen=True` makes instances immutable by generating `__setattr__`/`__delattr__` that raise `FrozenInstanceError`. The hashing interaction is the part to get right:

| `eq` | `frozen` | generated `__hash__` |
|------|----------|----------------------|
| True | False | `None` (unhashable — mirrors the `__eq__`-without-`__hash__` rule) |
| True | True | a real hash over the fields (hashable) |
| False | any | inherited from `object` (identity hash) |

So a mutable `@dataclass` is unhashable by default (sensible — its fields can change), and `@dataclass(frozen=True)` is the clean way to get a hashable value object with correct `__eq__` *and* `__hash__`. You can force it with `@dataclass(unsafe_hash=True)`, but the name is a warning.

**Versus the alternatives:**

- **`namedtuple`** is a *tuple* — immutable, indexable, unpackable, iterable, and tiny in memory. Great for lightweight records that should behave like tuples (and interop with code expecting tuples). But it's awkward to add methods/defaults to, and being a tuple means `Point(1,2) == (1,2)` is `True`, which can be a footgun. Dataclasses are real classes: not iterable/indexable, mutable by default, easy to add behaviour.
- **`attrs`** is the third-party library dataclasses were inspired by. It does more: validators, converters, richer field control, `__slots__` ergonomics that predate stdlib support, and it runs on older Pythons. Reach for `attrs` when you need validation/conversion declaratively; stdlib `@dataclass` covers the common case with zero dependencies.
- **Plain class** — only when you need full control and the generated methods would fight you. For a data holder, hand-writing `__init__`/`__repr__`/`__eq__` is just unmaintained boilerplate.

Default choice in 2026: `@dataclass(slots=True)` for mutable records, `@dataclass(frozen=True, slots=True)` for hashable value objects, `attrs` when you need validation, `namedtuple` only when you genuinely want tuple semantics.

---

## Inheritance, MRO & Metaclasses

### Summary

**What this topic covers** — How CPython resolves attribute and method lookup across multiple base classes (the Method Resolution Order, computed by C3 linearization), how `super()` cooperates with that order rather than naively calling "the parent," when to reach for mixins versus abstract base classes, and the class-creation machinery itself: `type` as the default metaclass, custom metaclasses, and the modern lighter-weight hooks `__init_subclass__` and `__set_name__` that replace most metaclass usage in 2026 code.

**Mental model** — A class is itself an object, and the thing that creates it is its metaclass — by default `type`. When you write `class C(A, B):`, Python computes a single linear ordering of `C` and all its ancestors, the MRO, stored on `C.__mro__`. Attribute lookup walks that list left to right and stops at the first hit. C3 linearization guarantees this order is *monotonic* (a class always precedes its parents) and respects the *local precedence* you declared in the bases tuple; if no consistent order exists, the class statement raises `TypeError` at definition time. `super()` is not "my parent" — it is a proxy that, given the current class and instance, dispatches to the *next* class in the instance's MRO. That distinction is the whole reason cooperative multiple inheritance works: each class hands off to whoever comes next in the runtime linearization, which depends on the concrete subclass, not on any single class's static view of its bases.

**Key terms**
- **MRO** — Method Resolution Order; the linear search list on `cls.__mro__`, ending in `object`.
- **C3 linearization** — the algorithm computing the MRO; merges parents' linearizations preserving monotonicity and local precedence order.
- **Monotonicity** — if A precedes B in one class's MRO, it does so in every subclass's MRO.
- **Cooperative `super()`** — zero-arg `super()` resolves to the next type after the current class in the *instance's* MRO.
- **Metaclass** — the class of a class; `type(C)` is `C`'s metaclass, default `type`.
- **`type(name, bases, namespace)`** — the three-arg call that builds a class dynamically.
- **ABC** — Abstract Base Class via `abc.ABC` / `ABCMeta`; can't instantiate while abstract methods remain.
- **`@abstractmethod`** — marks a method that subclasses must override before instantiation.
- **Mixin** — a small class supplying behavior via inheritance, not meant to stand alone or be instantiated.
- **`__init_subclass__`** — classmethod hook on a base, run when a subclass is *defined*.
- **`__set_name__`** — descriptor hook run when the owning class is created, telling the descriptor its attribute name.
- **Virtual subclass** — registered via `ABC.register`, passes `isinstance` without inheriting.

**Why interviewers ask this** — Multiple inheritance is where Python's object model stops being intuitive, so it separates people who memorized "Python supports multiple inheritance" from people who understand *how*. A junior says `super()` calls the parent class and gets the diamond problem wrong. A senior explains that `super()` depends on the runtime MRO, can name a class that isn't even a base of the current class, and knows that every method in a cooperative chain must accept and forward `**kwargs` or the chain breaks. The metaclass questions are a deliberate filter: the strong answer is usually "I wouldn't use a metaclass here — `__init_subclass__` covers registration and `__set_name__` covers descriptors." Reaching for a metaclass when a hook suffices signals over-engineering; knowing *when* a metaclass is genuinely required (interfering with class creation itself, framework-level magic) signals depth.

**Common confusions**
- **"`super()` calls the parent class."** It calls the next class in the *instance's* MRO, which may be a sibling.
- **"The MRO is depth-first."** It's C3, not naive DFS — Python 2.2's pre-C3 DFS had the diamond bug.
- **"A metaclass and a base class do the same thing."** A base contributes to the MRO; a metaclass controls how the class object is *built*.
- **"`@abstractmethod` makes the method uncallable."** It only blocks instantiation while abstract methods remain unoverridden; the body still runs if a subclass calls `super()`.
- **"`isinstance` requires inheritance."** ABC `register` creates virtual subclasses that pass `isinstance` with no inheritance.

**What follows from this topic** — Descriptors (`__set_name__`, `__get__`/`__set__`) underpin `property`, `dataclasses`, and ORM fields. Cooperative `super()` recurs in `__init__` chains and context-manager mixins. Metaclass and `__init_subclass__` registration patterns power plugin systems and serialization frameworks, and tie directly into typing — `Protocol`, `Generic`, and the 3.12 type-parameter syntax all interact with the class-creation machinery discussed here.

### Q41. Multiple inheritance + the diamond problem: explain C3 linearization, __mro__, and how Python resolves the order.

The diamond problem: `D` inherits from `B` and `C`, both of which inherit from `A`. When you look up a method on a `D` instance, in what order are `B`, `C`, and `A` searched — and is `A` searched once or twice? Naive depth-first (Python's pre-2.3 behavior) would visit `A` before `C`, meaning an override on `C` could be silently shadowed by `A`. C3 fixes this.

C3 linearization produces an ordering that satisfies two constraints: **monotonicity** (a child always appears before all its parents) and **local precedence** (the left-to-right order you wrote in the bases tuple is preserved). The algorithm merges the linearizations of each parent plus the list of parents, repeatedly taking the head of a list that doesn't appear in the *tail* of any other list.

```python
class A: pass
class B(A): pass
class C(A): pass
class D(B, C): pass

print([c.__name__ for c in D.__mro__])
# ['D', 'B', 'C', 'A', 'object']
```

`A` appears exactly once, after both `B` and `C` — so an override on `C` is found before falling through to `A`. That's the fix.

The genuinely important consequence: C3 can fail. If you write inconsistent bases, the class statement raises immediately:

```python
class X: pass
class Y: pass
class A(X, Y): pass
class B(Y, X): pass
class C(A, B): pass
# TypeError: Cannot create a consistent method resolution order (MRO)
# for bases X, Y
```

`A` demands `X` before `Y`; `B` demands `Y` before `X`; no linear order satisfies both. This is a *definition-time* error, which I like — you find out at import, not at some runtime lookup. When debugging an unexpected method being called in a deep hierarchy, the first thing I do is print `__mro__`; it's the ground truth that resolves every "why did *that* method run?" question.

### Q42. How does cooperative super() actually work in multiple inheritance — why is it not just 'call the parent'? Show a mixin chain.

`super()` with no args is sugar for `super(__class__, self)`, where `__class__` is a compiler-injected cell referring to the class the method is *lexically* defined in. It returns a proxy that looks up the requested attribute starting at the position *after* `__class__` in `type(self).__mro__`. The crucial word is `type(self)` — the MRO is the *instance's*, not the defining class's. So "the next class" is determined at runtime by the concrete subclass, and can be a class that the current class has never heard of.

That's why "call the parent" is wrong. In single inheritance the next-in-MRO happens to be the parent, so the simplification holds and people internalize it. In multiple inheritance it breaks: a class's `super()` may dispatch to a *sibling* in the diamond.

```python
class Base:
    def greet(self, **kw):
        return ["base"]

class Loud(Base):
    def greet(self, **kw):
        return ["LOUD"] + super().greet(**kw)

class Polite(Base):
    def greet(self, **kw):
        return ["please"] + super().greet(**kw)

class Greeter(Loud, Polite):
    pass

print(Greeter().greet())
# ['LOUD', 'please', 'base']
```

Inside `Loud.greet`, `super()` resolves not to `Base` but to `Polite`, because in `Greeter().__mro__` the order is `Greeter, Loud, Polite, Base, object`. `Loud` was written without any knowledge of `Polite` — they cooperate purely through the MRO.

Two rules make cooperative chains survive in practice. First, **every method in the chain must call `super()` and forward `**kwargs`**; if `Loud` had hard-coded `Base.greet(self)` or dropped kwargs, `Polite` would be skipped or would crash on unexpected arguments. Second, **the root class must absorb the chain** — `Base.greet` doesn't call `super()` because `object` has no `greet`. A common bug is a mixin's `__init__` calling `super().__init__()` but a sibling's `__init__` accepting required positional args; the fix is the keyword-only-`**kwargs`-cooperative-`__init__` convention, or simply not using multiple inheritance for stateful constructors.

### Q43. Mixins and ABCs (abc.ABC / ABCMeta, @abstractmethod) — when do you use each to share/enforce behaviour?

They solve opposite problems. A **mixin** *provides* behavior — concrete methods you compose into a class via inheritance, typically depending on a small contract the host class fulfills. An **ABC** *enforces* a contract — it declares abstract methods the subclass must implement and refuses instantiation until they're all overridden.

```python
class JsonMixin:                       # provides
    def to_json(self):
        import json
        return json.dumps(self.as_dict())   # relies on host's as_dict()

from abc import ABC, abstractmethod
class Serializable(ABC):               # enforces
    @abstractmethod
    def as_dict(self) -> dict: ...

class User(JsonMixin, Serializable):
    def __init__(self, name): self.name = name
    def as_dict(self): return {"name": self.name}
```

`Serializable()` raises `TypeError: Can't instantiate abstract class` because `as_dict` is abstract. Once `User` overrides it, instantiation works, and `JsonMixin` supplies `to_json` for free. Note the layering: the ABC pins down *what* must exist; the mixin assumes it exists and builds on it.

`abc.ABC` is just a convenience base whose metaclass is `ABCMeta`; you can equally write `class Foo(metaclass=ABCMeta)`. `ABCMeta` also gives you `register()` for **virtual subclasses** — a class passes `isinstance(x, MyABC)` without inheriting, which is how `collections.abc` lets unrelated types claim to be a `Sequence`. The tradeoff: registration skips the abstract-method check, so it's an assertion of conformance, not an enforced one.

My practical guidance for 2026: if you only need a *structural* contract (duck typing checked by a type checker), reach for `typing.Protocol` instead of an ABC — it's checked statically by mypy/pyright with zero runtime inheritance and no metaclass conflicts. Use a real ABC when you need *runtime* enforcement (`isinstance` checks, blocking instantiation) or want to ship shared concrete helpers alongside the abstract methods. Use a plain mixin when there's no contract to enforce, just reusable behavior — and keep mixins small, stateless, and single-purpose, because they all land in the MRO and a fat mixin is where cooperative-`super()` bugs breed.

### Q44. Metaclasses: what is `type` as a metaclass, how do you create classes dynamically with type(), and what's a legitimate metaclass use case (registration, validation)?

`type` is the metaclass of almost every class — `type(int)` is `type`, and `type(YourClass)` is `type` unless you specify otherwise. Called with one argument it tells you an object's type; called with *three* it builds a class. The class statement is essentially sugar for a three-arg `type` call:

```python
def area(self): return self.w * self.h
Rect = type("Rect", (object,), {"area": area, "sides": 4})
# equivalent to:  class Rect: sides = 4; def area(self): ...
```

A custom metaclass subclasses `type` and overrides `__new__` or `__init__` to intervene *as the class object is created* — before any instance exists. The class body's namespace, name, and bases all pass through your hands.

The two canonical legitimate uses are **registration** and **validation**:

```python
class PluginMeta(type):
    registry = {}
    def __new__(mcs, name, bases, ns):
        cls = super().__new__(mcs, name, bases, ns)
        if not ns.get("abstract"):
            if "run" not in ns:                       # validation
                raise TypeError(f"{name} must define run()")
            PluginMeta.registry[name] = cls           # registration
        return cls

class Plugin(metaclass=PluginMeta):
    abstract = True

class Backup(Plugin):
    def run(self): ...
# PluginMeta.registry == {"Backup": <class Backup>}
```

Every subclass auto-registers and is validated at definition time — you can't ship a `Plugin` missing `run()`, the import fails. Frameworks lean on this: Django's `Model`, SQLAlchemy's declarative base, Python's own `enum.EnumMeta` and `ABCMeta` are all metaclasses doing exactly this kind of class-creation interception.

The honest caveat: **metaclasses are rarely the right answer in 2026.** They don't compose — combining two classes with different metaclasses raises `TypeError: metaclass conflict`, and that lands on your users. For the two examples above, `__init_subclass__` (Q45) does registration and validation with no metaclass and no conflict risk. Reserve a metaclass for when you must control the class *namespace* itself (e.g. `__prepare__` to use an ordered or custom mapping during class body execution) or override behavior that only the metaclass sees. If a hook can do it, use the hook.

### Q45. __init_subclass__ and __set_name__ — the lighter-weight alternatives to a metaclass. When do they suffice?

Both landed in 3.6 (PEP 487) specifically to drain the swamp of trivial metaclasses. They cover the two most common reasons people wrote one — reacting to subclass creation, and giving a descriptor its attribute name — without any of the metaclass-conflict baggage.

`__init_subclass__` is an implicit classmethod on a base, invoked whenever a subclass is *defined*. It receives the new subclass's `cls` plus any class-keyword arguments. This replaces metaclass `__new__`/`__init__` for **registration and per-subclass validation**:

```python
class Plugin:
    registry = {}
    def __init_subclass__(cls, /, key=None, **kw):
        super().__init_subclass__(**kw)        # cooperate!
        if "run" not in cls.__dict__:
            raise TypeError(f"{cls.__name__} must define run()")
        Plugin.registry[key or cls.__name__] = cls

class Backup(Plugin, key="backup"):
    def run(self): ...
```

That's the entire Q44 metaclass, minus the metaclass — and crucially it composes: a subclass can mix in other bases without metaclass conflicts. Note the class-keyword `key="backup"` passed right in the bases list; that's the clean channel for parametrizing subclass creation.

`__set_name__(self, owner, name)` is a descriptor hook the interpreter calls once, at class-creation time, for every class attribute that defines it — handing the descriptor the *name it was bound to*. Before 3.6 you needed a metaclass to discover attribute names; now the descriptor learns its own name:

```python
class Field:
    def __set_name__(self, owner, name):
        self.name = name
        self.private = f"_{name}"
    def __get__(self, obj, objtype=None):
        return getattr(obj, self.private, None)
    def __set__(self, obj, value):
        setattr(obj, self.private, value)

class Model:
    title = Field()        # __set_name__ tells it self.name == "title"
```

This is exactly how `dataclasses`, ORM field declarations, and modern descriptor-based validators avoid metaclasses.

When do they *not* suffice? When you must intervene before the class body executes (`__prepare__` to swap the namespace mapping), change the class's actual `type`/metaclass, or affect classes that don't inherit from your base (a metaclass catches every subclass transitively through the metaclass-of-the-metaclass; `__init_subclass__` only fires for descendants of the class that defines it). For everything else — and that's the overwhelming majority of real code — `__init_subclass__` plus `__set_name__` is the correct, conflict-free, readable choice.

---

## Typing & Type Hints

### Summary

**What this topic covers** — This topic is about Python's gradual type system: the annotation syntax (`x: int`, function signatures, `Optional`, `Union`, the `|` operator), the tooling that gives annotations teeth (mypy, pyright/Pylance, IDEs, runtime libraries like Pydantic), generics via `TypeVar` and the 3.12 type-parameter syntax, structural typing with `Protocol`, and the adjacent feature of structural pattern matching (`match`/`case`). The throughline: CPython itself treats annotations as essentially inert metadata, so everything useful happens in static analysis or in libraries that choose to read them at runtime.

**Mental model** — Think of type hints as a *separate, optional layer* that rides on top of dynamic Python. CPython evaluates annotations (or stores them as strings under `from __future__ import annotations` / PEP 563) and stashes them in `__annotations__`, then ignores them — no checking, no coercion, no overhead at call time. The type checker is a wholly separate program (mypy or pyright) that reads your source and the typeshed stubs, builds its own model of what *should* be true, and complains where reality diverges. So you maintain two mental views simultaneously: the runtime view (duck typing, whatever object actually flows through) and the static view (what the checker has proven). When they disagree, you either have a bug or a place where you tell the checker to trust you (`cast`, `# type: ignore`, `Any`). Senior intuition is knowing which layer a given construct lives in — `isinstance` is runtime, `Protocol` is mostly static, `match` straddles both.

**Key terms**
- **Type hint / annotation** — syntactic metadata on a name or parameter; stored in `__annotations__`, not enforced by CPython.
- **mypy** — the reference static type checker; conservative, gradual, batch-run in CI.
- **pyright / Pylance** — Microsoft's fast checker (TS-based), powers VS Code; stricter inference, better at narrowing.
- **typeshed** — the community repo of stub (`.pyi`) files describing the stdlib and popular packages.
- **gradual typing** — mixing typed and untyped code; `Any` is the escape hatch that disables checking for a value.
- **`TypeVar`** — a type variable enabling generics; binds the same type across a signature.
- **`Protocol`** — structural type; conformance by shape (methods/attributes), not by inheritance.
- **narrowing** — the checker refining a type within a branch (e.g. after `if x is not None`).
- **`cast` / `# type: ignore`** — manual overrides telling the checker to trust you.
- **PEP 604 `X | Y`** — union syntax (3.10+) replacing `Union[X, Y]`.
- **PEP 563 / `from __future__ import annotations`** — annotations stored as strings, evaluated lazily.

**Why interviewers ask this** — Type hints separate engineers who *use* Python from those who *maintain* large Python. A junior says "types make code safer." A senior knows they are unenforced at runtime, that mypy and pyright disagree in instructive ways, that `Optional[X]` is just `X | None` and is the single biggest source of silent bugs, and that `Protocol` lets you type duck-typed code without forcing inheritance — the most Pythonic part of the type system. The interviewer is probing whether you understand the *two-layer* nature: that adding `-> int` does nothing at runtime, that a function annotated to return `User` can still return `None`, and that you reach for tools (strict mypy in CI, pyright in the editor) rather than trusting annotations to be true. They also want to see judgment: when to type strictly, when `Any` is honest, when annotations are noise.

**Common confusions**
- **"Type hints are enforced at runtime"** — CPython never checks them; a mis-typed value flows through happily until something else breaks.
- **"`Optional[X]` means the argument is optional"** — it means `X | None`; optionality of *arguments* comes from defaults, not from `Optional`.
- **"mypy and pyright are interchangeable"** — they have different inference, narrowing, and strictness defaults; code clean under one can fail the other.
- **"`Protocol` requires inheritance"** — the whole point is structural conformance with no base class.
- **"`match` is just a switch statement"** — it destructures and binds, which `if`/`elif` chains cannot do cleanly.
- **"Annotations are always real type objects at runtime"** — under PEP 563 / string annotations they're strings until you resolve them.

**What follows from this topic** — Typing connects to dataclasses (annotations *are* the field spec), to ABCs and the data-model topic (`Protocol` vs nominal `abc`), and to async (typing coroutines and `Awaitable`). The runtime-vs-static split echoes the broader CPython theme that language features and implementation details live on different layers. Pattern matching feeds into the control-flow and data-model discussions, since custom classes opt into matching via `__match_args__`.

### Q46. Type hints are optional and not enforced at runtime — so what are they for, and what enforces them (mypy/pyright, IDEs)?

The first thing to be clear about: CPython does **nothing** with your annotations at call time. `def f(x: int) -> str:` does not check that `x` is an `int` or that you return a `str`. The annotations are evaluated (unless you've opted into string annotations) and stored in `f.__annotations__`, and then the interpreter moves on. You can call `f("hello")` and CPython is perfectly happy.

```python
def add(a: int, b: int) -> int:
    return a + b

add("foo", "bar")  # runs fine, returns "foobar" — no TypeError from the hints
```

So what are they *for*? Three audiences. First, **static checkers** — mypy and pyright read your source plus typeshed stubs and prove (or disprove) consistency before you ship. Run them in CI with `mypy --strict` or pyright in strict mode; that's where annotations earn their keep. Second, **your editor** — Pylance (pyright under the hood) gives autocomplete, go-to-definition, and inline errors driven entirely by hints. Third, **runtime libraries that opt in**: Pydantic, FastAPI, `dataclasses`, `attrs`, and `typing.get_type_hints()` all *choose* to read annotations and act on them. That's library behavior, not language behavior — Pydantic validates because Pydantic decided to, not because Python enforces anything.

My strong opinion: treat the type checker as a test suite. It's a different program proving different invariants, and it belongs in CI gating merges. mypy is conservative and gradual (great for incrementally typing a legacy codebase); pyright is faster and infers/narrows more aggressively (great in-editor). I run pyright in the editor and mypy `--strict` in CI, and I accept that they occasionally disagree — that disagreement usually points at genuinely ambiguous code. The escape hatches are `Any` (disables checking for a value — use honestly, not as a silencer), `typing.cast` (assert a type without runtime cost), and `# type: ignore[code]` (always with the specific error code, never bare).

### Q47. Optional[X] / Union / the X | Y syntax (3.10+), and what None handling looks like. Common Optional bugs.

`Optional[X]` is *exactly* `Union[X, None]`, which since 3.10 (PEP 604) you write as `X | None`. I prefer `X | None` everywhere now — it's shorter, reads naturally, and works in `isinstance` (`isinstance(x, int | str)`). `Optional[X]` is not deprecated, but I treat `X | None` as the house style.

The single most important point — and a classic interview trap: **`Optional` says nothing about whether an *argument* is optional.** Optionality of arguments comes from having a default value. These are independent axes:

```python
def f(x: int | None):        # required argument, may be None
def g(x: int | None = None): # optional argument, defaults to None
def h(x: int = 0):           # optional argument, never None
```

The classic bug is forgetting that a value can be `None` and indexing/calling/attribute-accessing it. The checker catches it *if* you've narrowed honestly:

```python
def first_char(s: str | None) -> str:
    return s[0]   # mypy/pyright error: s may be None
```

The fix is **narrowing** — guard the `None` case and let the checker prove the rest:

```python
def first_char(s: str | None) -> str:
    if s is None:
        raise ValueError("need a string")
    return s[0]   # here s is narrowed to str
```

A subtler one is the **mutable-default-meets-Optional** pattern. You write `def f(items: list[int] = [])` (a refcounted mutable shared across calls — a separate footgun), so people "fix" it with `items: list[int] | None = None` and then `items = items or []`. Watch out: `or []` also replaces an explicitly-passed empty list, which is sometimes wrong. Use `if items is None: items = []` if you must distinguish "not passed" from "passed empty." Finally, prefer `if x is None` over `if not x` — `not x` is true for `0`, `""`, `[]`, and `False`, conflating "absent" with "falsy," which is the cause of a huge fraction of real-world `Optional` bugs.

### Q48. Generics: TypeVar and the new 3.12 type-parameter syntax (e.g. a generic first() function). How do you write a generic function/class?

A generic ties types together across a signature. The old way uses an explicit `TypeVar`:

```python
from typing import TypeVar, Sequence

T = TypeVar("T")

def first(seq: Sequence[T]) -> T:
    return seq[0]
```

The `T` binds: pass a `list[int]` and the checker knows the return is `int`; pass a `list[str]` and it knows `str`. That's the whole point — without the `TypeVar`, you'd have to annotate the return as `Any` and lose the connection between input and output.

Python 3.12 (PEP 695) added inline **type-parameter syntax**, which I strongly prefer in new code — no module-level `TypeVar`, the scope is local to the function or class:

```python
def first[T](seq: Sequence[T]) -> T:   # 3.12+
    return seq[0]

class Box[T]:                          # 3.12+ generic class
    def __init__(self, value: T) -> None:
        self._value = value
    def get(self) -> T:
        return self._value

type ListOrSet[T] = list[T] | set[T]   # 3.12 generic type alias
```

For generic **classes** the older style is `class Box(Generic[T]):` with a module-level `T`; the 3.12 `class Box[T]:` form is cleaner and you no longer import `Generic`. You can bound a type parameter (`def f[T: Comparable](...)` / `TypeVar("T", bound=Comparable)`) to require capabilities, or constrain it to a fixed set (`TypeVar("T", int, str)`). 3.12 also added `TypeVarTuple`/`*Ts` (variadic generics, e.g. shape-typed arrays) and `ParamSpec` for typing decorators that preserve a wrapped function's signature — reach for `ParamSpec` the moment you write a decorator and want the checker to keep the inner signature instead of collapsing it to `Callable[..., Any]`.

### Q49. Protocol (structural / duck typing) vs ABCs (nominal) — when do you reach for typing.Protocol, and why is it powerful for Pythonic code?

This is the most Pythonic corner of the type system, so it's worth getting right. An **ABC** (`abc.ABC`) is *nominal*: a class is a `Sequence` because it inherits from `Sequence` (or registers with it). A **`Protocol`** is *structural*: a class satisfies it if it has the right shape — the right methods and attributes — regardless of inheritance. Protocol is duck typing made checkable.

```python
from typing import Protocol

class Closeable(Protocol):
    def close(self) -> None: ...

def shutdown(resource: Closeable) -> None:
    resource.close()
```

Any object with a `close(self) -> None` method satisfies `Closeable` — a file, a socket, a DB connection, your own class — *without* importing or inheriting anything. That's the power: you type against behavior, and you can retroactively describe types you don't own (third-party classes, stdlib objects). It's the static-typing expression of "if it quacks like a duck."

| | ABC (nominal) | Protocol (structural) |
|---|---|---|
| Conformance | by inheritance/registration | by shape |
| Works on code you don't own | no (must register) | yes |
| `isinstance` | always | only with `@runtime_checkable` (checks method *names* only) |
| Best for | closed hierarchies you control | duck-typed interfaces, retrofitting types |

When do I reach for which? **Protocol** when I'm describing "anything that can do X" — especially across library boundaries or for dependency injection, where forcing a shared base class would be intrusive. **ABC** when I own the hierarchy and want to *share implementation* (concrete methods, `super()` calls) and enforce that subclasses override abstract methods at instantiation time — that enforcement is real and runtime, unlike Protocol which is mostly static. One caveat: `@runtime_checkable` makes `isinstance(x, Closeable)` work, but it only checks that the method *names* exist, not their signatures — so it's a weaker guarantee than the static check.

### Q50. match/case (structural pattern matching, 3.10+) — show matching on a class/tuple/mapping, and how it differs from a chain of if/elif.

`match`/`case` (PEP 634, Python 3.10+) is *structural pattern matching*, not a switch statement. The difference that matters: it **destructures and binds** in the same step. A `if`/`elif` chain tests conditions; `match` tests *shape* and pulls values out.

```python
def describe(point):
    match point:
        case (0, 0):
            return "origin"
        case (0, y):                  # binds y
            return f"on y-axis at {y}"
        case (x, 0):                  # binds x
            return f"on x-axis at {x}"
        case (x, y):
            return f"at {x}, {y}"
        case _:                       # wildcard / default
            return "not a 2-tuple"
```

It matches classes by their `__match_args__`, mappings by keys, and supports guards and capture:

```python
from dataclasses import dataclass

@dataclass
class Circle:
    radius: float

@dataclass
class Rect:
    w: float
    h: float

def area(shape):
    match shape:
        case Circle(radius=r):                 # class pattern, keyword
            return 3.14159 * r * r
        case Rect(w=w, h=h) if w == h:         # guard
            return f"square {w*w}"
        case Rect(w=w, h=h):
            return w * h

def route(request: dict):
    match request:
        case {"method": "GET", "path": path}:  # mapping pattern, extra keys ignored
            return f"GET {path}"
        case {"method": method}:
            return f"{method} request"
```

Two gotchas that bite people. First, a **bare name is a capture, not a comparison** — `case Color.RED:` matches the enum, but `case x:` binds *everything* to `x` (it's the wildcard, like `_` but named). To compare against a variable you must use a dotted name or a guard. Second, **dataclasses give you `__match_args__` for free** (positional `case Circle(r)` works); plain classes need you to define `__match_args__` or use keyword patterns.

When is `match` actually better than `if`/`elif`? When you're dispatching on the *structure* of data — parsing ASTs, handling tagged unions / event types, walking JSON shapes. There the destructuring eliminates a pile of `isinstance` + index + attribute-access boilerplate and reads declaratively. For a simple value test (`if status == 200`), a plain `if` is clearer and I'd leave it alone — `match` earns its keystrokes only when there's shape to destructure.

---

## The GIL, Threading & Multiprocessing

### Summary

**What this topic covers** — This topic is about how CPython actually executes concurrent code: the Global Interpreter Lock (GIL), why it exists, what it protects, and the practical consequences for threading, multiprocessing, and the `concurrent.futures` abstraction layered on top. It covers the I/O-bound vs CPU-bound distinction that determines whether threads buy you anything, the real routes to CPU parallelism (separate processes, C extensions that release the GIL, native libraries like NumPy), and the genuine thread-safety hazards that survive despite the GIL. It is explicitly CPython-centric — the GIL is an implementation detail of CPython, not a language feature of Python.

**Mental model** — Picture one talking stick in a room full of threads: only the thread holding the stick may execute Python bytecode. CPython uses reference counting for memory management, and a refcount increment/decrement is not itself atomic, so without a global lock two threads touching the same object's refcount could corrupt it and crash the interpreter. The GIL is that talking stick — the cheapest correctness mechanism. A thread holds the GIL while running bytecode and releases it (a) when it blocks on I/O, (b) periodically (every ~5ms by default, the "switch interval"), and (c) inside C code that explicitly drops it. So threads give you *concurrency* (overlapping waits) but not *parallelism* (simultaneous compute) for pure-Python code. The instant you leave the interpreter — a `read()` syscall, a NumPy matmul, a C extension — the GIL can be released and other threads run. The whole subject is reasoning about *where* the stick is held versus released.

**Key terms**
- **GIL** — a single mutex in the CPython interpreter; one thread executes bytecode at a time. A CPython implementation detail, absent in Jython/IronPython.
- **Reference counting** — CPython's primary GC: every object tracks how many references point to it; the GIL makes refcount updates safe.
- **Cyclic GC** — the secondary collector that reclaims reference cycles refcounting can't.
- **Switch interval** — `sys.setswitchinterval()`, default 5ms, after which a running thread is asked to yield the GIL.
- **I/O-bound** — work dominated by waiting (network, disk, DB); the GIL is released during the wait.
- **CPU-bound** — work dominated by computation in Python bytecode; the GIL serializes it.
- **GIL release** — C code wrapping work in `Py_BEGIN_ALLOW_THREADS` / `Py_END_ALLOW_THREADS` to run lock-free.
- **multiprocessing** — separate OS processes, each with its own interpreter and GIL; true parallelism, IPC cost.
- **concurrent.futures** — a high-level `Executor` API (`ThreadPoolExecutor`, `ProcessPoolExecutor`) returning `Future`s.
- **Per-interpreter GIL** — 3.12 (PEP 684): each subinterpreter can own its own GIL.
- **Free-threaded build** — 3.13 experimental `--disable-gil` build (PEP 703) that removes the GIL entirely.

**Why interviewers ask this** — The GIL is the single most misunderstood part of Python, so it's a fast filter. A junior says "Python can't do threads" or "use multiprocessing for everything" — cargo-cult rules without the model. A senior explains *why* the GIL exists (refcount safety), *when* it's released (I/O and C code), and therefore predicts correctly that 50 concurrent HTTP requests scale fine on threads while a CPU-bound loop won't. The senior signal is reaching for the right tool by reasoning about where time is spent rather than reciting a heuristic, knowing the real escape hatches (NumPy, C extensions, processes), and being current on the 3.12/3.13 trajectory. The trap question — "is `+=` atomic?" — separates people who've actually debugged a race from those who assume the GIL makes everything safe.

**Common confusions**
- **"The GIL makes Python thread-safe"** — it protects interpreter internals, not your data; multi-bytecode operations still race.
- **"Threads are useless in Python"** — they're excellent for I/O-bound work where the GIL is released during waits.
- **"Multiprocessing is always faster"** — process startup and pickling IPC can dwarf the gain for small or chatty workloads.
- **"`x += 1` is atomic because it's one line"** — it's load/add/store bytecodes; the GIL can switch mid-sequence.
- **"The GIL is part of the Python language"** — it's a CPython implementation detail.

**What follows from this topic** — Releasing the GIL during I/O is exactly what makes `asyncio` viable, so the async topic builds on this. Reference counting connects to the memory-management topic (cyclic GC, `weakref`, `tracemalloc`). Pickling for `ProcessPoolExecutor` ties to serialization. And the performance topic — `cProfile` to find whether you're CPU- or I/O-bound — is the prerequisite for choosing correctly between everything discussed here.

### Q51. What IS the GIL, precisely? It's a CPython implementation detail — a mutex ensuring one thread executes bytecode at a time. What does it protect (refcounts) and why does it exist?

The GIL is a single mutex inside the CPython interpreter that guarantees only one thread executes Python bytecode at any instant. It is emphatically a CPython implementation detail — Jython and IronPython have no GIL because they sit on the JVM/CLR garbage collectors. When people say "Python has a GIL" they mean "CPython has a GIL."

The reason it exists is reference counting. Every CPython object carries a refcount, and almost every operation — assigning a name, passing an argument, returning a value — bumps it up or down via `Py_INCREF`/`Py_DECREF`. Those are plain non-atomic integer operations. If two threads incremented the same object's refcount simultaneously without synchronization, you'd get lost updates: a refcount drops to zero while references still exist, the object is freed, and you get a use-after-free crash. The GIL is the cheapest fix — one coarse lock around the whole interpreter instead of a fine-grained lock on every object (which would add atomic-operation overhead to *every* refcount touch and risk deadlocks).

So the GIL protects interpreter internals: refcounts, the memory allocator, and other shared C-level state. It is *not* a feature you asked for; it's the consequence of choosing refcounting as the memory model in 1991 and never being able to remove it without breaking the C API and slowing single-threaded code.

A thread holds the GIL while running bytecode and gives it up in three situations: it blocks on I/O (a syscall), the switch interval elapses (`sys.setswitchinterval()`, default 5ms) and another thread is waiting, or C code explicitly releases it. The historical alternative — making single-threaded code as fast as it is while still being thread-safe — is why every serious GIL-removal attempt stalled until PEP 703's free-threaded build finally landed a viable path in 3.13.

### Q52. I/O-bound vs CPU-bound: why does threading help I/O-bound work (GIL released during blocking I/O) but not CPU-bound (use multiprocessing)?

The whole answer turns on *when the GIL is released*. CPython releases the GIL around blocking syscalls — `socket.recv`, `file.read`, a DB driver waiting on the network. While thread A is parked in the kernel waiting for bytes, it isn't running bytecode, so it drops the stick and thread B can run. With 50 threads each waiting on an HTTP response, all 50 waits overlap and your wall-clock time collapses to roughly the slowest single request instead of the sum. That's why threading is genuinely great for I/O-bound work.

CPU-bound work is the opposite. A pure-Python loop crunching numbers holds the GIL the entire time it runs bytecode, releasing it only briefly every switch interval. Two CPU-bound threads don't run in parallel — they *take turns*, and you even pay a small overhead for the context switching. So threading a CPU-bound job is at best break-even, often slightly slower.

```python
import time, threading

def cpu_bound(n):
    while n > 0:
        n -= 1

# two threads ~ same wall time as one (serialized by GIL):
t0 = time.perf_counter()
ts = [threading.Thread(target=cpu_bound, args=(40_000_000,)) for _ in range(2)]
for t in ts: t.start()
for t in ts: t.join()
print("threads:", time.perf_counter() - t0)
```

For CPU-bound work you reach for `multiprocessing` (or `ProcessPoolExecutor`): each process has its own interpreter and its own GIL, so they truly run on separate cores. The cost is that processes don't share memory cheaply — arguments and results are pickled and sent over a pipe — so the workload needs enough compute per task to amortize that overhead.

The senior move is to *measure first*: run `cProfile` or just time it. If most time is in `recv`/`read`/`select`, you're I/O-bound — threads or `asyncio`. If it's in your own Python functions, you're CPU-bound — processes or push the hot loop into NumPy/C.

### Q53. threading vs multiprocessing vs concurrent.futures (ThreadPoolExecutor/ProcessPoolExecutor) — when do you reach for each? Shared memory vs IPC cost.

Think of it as two axes: *what isolates the work* (threads share an address space, processes don't) and *what API you drive it through* (raw `threading`/`multiprocessing` vs the unified `concurrent.futures.Executor`).

| | threading | multiprocessing | concurrent.futures |
|---|---|---|---|
| Parallelism | I/O only (GIL) | true CPU parallelism | both, via the executor you pick |
| Memory | shared address space | separate; IPC via pickle | follows thread vs process pool |
| Best for | I/O-bound | CPU-bound | most code — clean `Future` API |
| Main cost | races on shared state | startup + pickling overhead | thin wrapper, same costs underneath |

My default is `concurrent.futures`. It gives one consistent API — submit work, get `Future`s, `executor.map`, clean shutdown via context manager — and you flip between `ThreadPoolExecutor` and `ProcessPoolExecutor` with a one-line change once you know whether you're I/O- or CPU-bound. You only drop to raw `threading` when you need primitives the executor doesn't expose (a long-lived daemon thread, `Condition`, `Event`), and to raw `multiprocessing` when you need `Queue`, `Pipe`, shared-memory blocks, or fine control over start methods.

```python
from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor

# I/O-bound: threads, GIL released during the request
with ThreadPoolExecutor(max_workers=32) as ex:
    results = list(ex.map(fetch_url, urls))

# CPU-bound: processes, real cores
with ProcessPoolExecutor() as ex:
    results = list(ex.map(crunch, chunks))
```

The shared-memory vs IPC tradeoff is the thing to be precise about. Threads share everything — zero copy, but you own the synchronization. Processes share nothing by default: every argument and return value is pickled, piped to the worker, and unpickled. That's a real tax — anything unpicklable (lambdas, open sockets, local closures) fails outright, and shipping a 500MB DataFrame to each worker can cost more than the computation. For large arrays, `multiprocessing.shared_memory` (3.8+) lets processes map the same buffer and skip the copy. Rule of thumb: processes pay off when compute-per-task is large relative to the size of what you pass in and out.

### Q54. How do you get real CPU parallelism in Python today — multiprocessing, C extensions releasing the GIL, native libs (numpy)? Note the 3.12 per-interpreter GIL and 3.13 free-threaded build (PEP 703).

There are four routes, in rough order of how often I reach for them.

**1. Separate processes.** `ProcessPoolExecutor`/`multiprocessing` — each process has its own GIL, so they run on real cores. The classic, portable answer for CPU-bound Python. Cost is pickling/IPC, as covered above.

**2. Native libraries that release the GIL.** NumPy, SciPy, pandas, PyTorch do their heavy math in C/Fortran/BLAS and drop the GIL during the compute. So a NumPy matmul on a background thread genuinely runs in parallel with other Python — you get parallelism *without* processes because the hot loop isn't bytecode. This is the highest-leverage option: vectorize into NumPy and a lot of your "CPU-bound Python" stops being Python at all.

**3. Your own C/Cython/Rust extension.** Anything wrapping its work in `Py_BEGIN_ALLOW_THREADS ... Py_END_ALLOW_THREADS` (or Cython's `nogil`, or PyO3 releasing the GIL) computes lock-free while other threads run. This is how you parallelize a custom hot loop without spawning processes.

**4. Subinterpreters with per-interpreter GIL (3.12, PEP 684).** Each subinterpreter can hold its *own* GIL, so multiple subinterpreters in one process can run Python in parallel — lighter than processes, isolated from each other. As of 3.12 the C API exists; the friendlier `interpreters` stdlib module (PEP 734) lands in 3.13/3.14, so it's still early for production.

**5. The free-threaded build (3.13, PEP 703).** The big one: an experimental CPython build (`--disable-gil`, the "free-threaded" / 3.13t binaries) that removes the GIL entirely, making refcounting thread-safe through biased reference counting and finer locking. Pure-Python threads finally run on multiple cores. The caveats in 2026: it's experimental, single-threaded code is somewhat slower, and C extensions must be rebuilt and verified thread-safe. Don't assume your dependency stack supports it yet — check before betting on it.

For most teams today the honest answer is still: vectorize into NumPy where you can, and use `ProcessPoolExecutor` for the rest. Free-threading is the future you should track, not yet the default you ship.

### Q55. Thread-safety in Python: is `+= 1` on a shared int atomic? What about list.append? When do you still need a Lock despite the GIL?

`x += 1` on a shared variable is **not** atomic, and this is the canonical Python gotcha. It compiles to multiple bytecodes — roughly load the value, add one, store it back. The GIL can be released *between* those bytecodes (at the switch interval), so two threads can both load `5`, both compute `6`, and both store `6` — one increment is lost.

```python
import threading

counter = 0
def bump():
    global counter
    for _ in range(1_000_000):
        counter += 1   # NOT atomic: load, add, store

ts = [threading.Thread(target=bump) for _ in range(4)]
for t in ts: t.start()
for t in ts: t.join()
print(counter)   # almost never 4_000_000
```

The fix is a `Lock` (or use `itertools.count`, or an `atomics`-style primitive):

```python
lock = threading.Lock()
def bump():
    global counter
    for _ in range(1_000_000):
        with lock:
            counter += 1
```

`list.append()`, by contrast, **is** effectively atomic in CPython — it's a single C-level operation that completes while holding the GIL, so concurrent appends won't corrupt the list or lose elements. Same for `dict[key] = value`, `list.pop()`, and similar single-method calls on built-in containers. But lean on this carefully: it's a CPython implementation guarantee, not language semantics, and the free-threaded build changes the calculus — don't write code whose correctness depends on it.

So when do you still need a `Lock` despite the GIL? Whenever a logically-single operation spans more than one bytecode/method and another thread can observe the in-between state. Read-modify-write (`+=`, `-=`, `x = x or default`), check-then-act (`if k not in d: d[k] = compute()` — two threads both pass the check), and any invariant across multiple objects (transferring between two accounts, updating a counter *and* a list together). The GIL guarantees the interpreter won't corrupt *itself*; it guarantees nothing about *your* multi-step invariants. The mental test: if correctness requires several operations to be indivisible, you need explicit synchronization — a `Lock`, `RLock`, or a thread-safe `queue.Queue` to hand work between threads instead of sharing mutable state at all.

---

## Async / Asyncio

### Summary

**What this topic covers** — This topic is about `asyncio`: CPython's single-threaded concurrency model built on coroutines, the event loop, and cooperative multitasking. It covers what `await` actually does at the bytecode/state-machine level, how async compares to threads and processes, structured concurrency primitives (`gather`, `TaskGroup`, `create_task`), the classic pitfall of blocking the loop, and the async cleanup protocols (`async with`, `async for`). The mental anchor: async gives you concurrency without parallelism — one thread, many in-flight I/O operations.

**Mental model** — Picture a single thread running an event loop: an infinite `while` loop that, on each tick, asks the OS (via `epoll`/`kqueue`/IOCP through `selectors`) "which of my sockets are ready?" and resumes whichever coroutines were waiting on those. A coroutine is a resumable function; `await` is a *yield point* — it suspends the current coroutine and hands control back to the loop, which is free to run something else until the awaited thing completes. Crucially, control only ever leaves a coroutine at an `await`. Between two `await`s, your code runs atomically with respect to other tasks — no other task can interleave, no preemption, no data race on plain variables. That's why it's called *cooperative*: a task that never awaits (a tight CPU loop, or a blocking `requests.get`) monopolizes the loop and starves everything else. There is exactly one thread doing the work, so async buys you concurrency (overlapping waits) but not parallelism (overlapping computation).

**Key terms**
- **Coroutine** — what a `async def` function returns when called: a paused, awaitable object. Calling it runs *nothing* until awaited or scheduled.
- **Event loop** — the scheduler; runs ready callbacks and resumes coroutines when their I/O is ready. One per thread, accessed via `asyncio.get_running_loop()`.
- **`await`** — suspends the current coroutine, yielding control to the loop until the awaitable resolves.
- **Awaitable** — anything you can `await`: a coroutine, a `Task`, or an object with `__await__`.
- **Task** — a coroutine wrapped and *scheduled* on the loop via `asyncio.create_task()`; runs concurrently with the awaiter.
- **Future** — a low-level placeholder for a result that will arrive later; `Task` is a `Future` subclass.
- **Cooperative scheduling** — tasks yield voluntarily at `await`; no preemption.
- **`run_in_executor` / `to_thread`** — offload blocking work to a thread or process pool so the loop stays responsive.
- **Structured concurrency** — `TaskGroup` (3.11): child tasks are bounded by a scope; the block won't exit until all finish or one fails.
- **Cancellation** — delivered by raising `asyncio.CancelledError` at the next `await` inside a task.

**Why interviewers ask this** — Async is where confident-sounding candidates fall apart. A junior says "async makes code faster" or "async is like threads but lighter." A senior knows async makes *I/O-bound* code more *scalable* (thousands of idle connections on one thread) and does nothing for CPU-bound work — in fact it makes it worse, because the GIL aside, one CPU-bound coroutine blocks the *entire* loop with no preemption to save you. The strong signal is whether you understand that `await` is a cooperative yield, that the loop is single-threaded, and that calling `time.sleep` or `requests.get` inside a coroutine is a correctness bug, not just slow. Interviewers also probe error semantics: what happens to sibling tasks when one in a `gather` raises, and how `TaskGroup` fixed the leak-and-swallow problems of the old model.

**Common confusions**
- **"async is faster than threads"** — no; it's more *scalable* for many I/O waits, and equal-or-slower for everything else. It dodges thread-switch and lock overhead, not computation.
- **"`await` runs the coroutine in the background"** — no; `await` *waits* for it inline. `create_task` is what runs things concurrently.
- **"async uses multiple cores"** — no; one thread, one core. Use `multiprocessing` for parallel CPU.
- **"calling an `async def` runs it"** — no; it returns a coroutine object that does nothing until awaited (and warns "coroutine was never awaited").
- **"`asyncio.gather` cancels siblings on error"** — only with `return_exceptions=False` does it *propagate*, but it does *not* cancel the others by default; `TaskGroup` does.

**What follows from this topic** — Async sits on the same foundation as the GIL and threading topics: all three are CPython concurrency stories, and the right one depends on whether your bottleneck is I/O or CPU. It connects to context managers and generators (the sync `with`/`for` protocols you already know, extended with `__aenter__`/`__anext__`), to `functools`/`contextlib` (`asynccontextmanager`), and forward to the 3.13 free-threaded build, which changes the threads-vs-async calculus by finally allowing true parallel Python threads.

### Q56. Explain the asyncio event loop and coroutines — what does `await` actually do, and why are async tasks cooperative (single-threaded)?

A coroutine is a resumable function. When you call an `async def`, you get back a coroutine object — nothing has executed yet. The event loop is what actually drives it: a single-threaded scheduler that maintains a queue of ready callbacks and a set of file descriptors registered with the OS via `selectors` (epoll/kqueue/IOCP). Each iteration it runs ready callbacks, then blocks in one `select()` call until a socket is readable/writable or a timer fires, then resumes whatever was waiting.

`await expr` does two things. It evaluates `expr` to an awaitable, and if that awaitable isn't already done, it *suspends the current coroutine* and yields control all the way back to the loop. Mechanically, coroutines are built on the generator machinery — `await` ultimately bottoms out in a `yield` to the loop, passing up the Future the coroutine is now waiting on. The loop arranges a callback so that when that Future completes (the socket's data arrived), it resumes your coroutine right after the `await`, with the result.

The single-threaded, cooperative part is the key insight: control leaves a coroutine *only* at an `await`. There's no preemption. Between two `await` points, your code runs to completion with no other task interleaving — which is why you rarely need locks for ordinary shared state in async code.

```python
async def fetch(n):
    print(f"start {n}")
    await asyncio.sleep(1)   # suspends here; loop runs other tasks
    print(f"done {n}")

async def main():
    await asyncio.gather(fetch(1), fetch(2))  # both finish in ~1s, not 2s
```

Both `sleep`s overlap because each `await asyncio.sleep` yields to the loop. Replace it with `time.sleep(1)` and you get 2 seconds and a frozen loop — because `time.sleep` never yields. That's the whole game: cooperative means you must hit an `await` for anything else to run.

### Q57. How does asyncio compare to threading for concurrency? When is async the right model (many I/O-bound connections) vs threads vs processes?

All three are different answers to "do two things at once," and the right one depends entirely on your bottleneck.

| Model | Parallelism | Best for | Cost |
|---|---|---|---|
| `asyncio` | None (1 thread) | Thousands of concurrent I/O waits | Cooperative — one blocking call freezes everything; viral `async` colouring |
| `threading` | None for Python bytecode (GIL); yes for I/O/C calls | Moderate I/O concurrency, blocking libraries | Preemptive — locks, races; ~MB stack per thread |
| `multiprocessing` | True (separate interpreters) | CPU-bound work | IPC/pickling overhead; heavy startup |

`asyncio` wins when you have *many* connections that are mostly idle — a web server handling 10k WebSockets, a scraper hitting thousands of URLs. One thread can hold tens of thousands of suspended coroutines because each is just a small object, not an OS thread with a megabyte stack. Threads top out around a few thousand before context-switch and memory overhead bite.

Threads win when you need I/O concurrency but your libraries are blocking and synchronous (a legacy DB driver with no async variant). The GIL is released during blocking I/O and many C extensions, so threads do overlap I/O — they just don't overlap Python *computation*. Threads are also preemptive, so you don't have the "one bad call freezes the world" failure mode; the cost is real locks and real data races.

Processes win for CPU-bound work, full stop. Neither async nor threads give you parallel Python computation under the standard GIL build. Use `multiprocessing` or `concurrent.futures.ProcessPoolExecutor`.

My rule of thumb: I/O-bound and many connections → `asyncio`. I/O-bound but stuck with blocking libs, or just a handful of tasks → threads. CPU-bound → processes. And on 3.13's experimental free-threaded build (PEP 703, `--disable-gil`), threads finally get real parallelism, which shifts some CPU work back toward `threading` — but that build is still experimental in 2026.

### Q58. Run things concurrently: asyncio.gather vs asyncio.TaskGroup (3.11) vs create_task. What does each give you for errors/cancellation?

`create_task` is the primitive: it schedules a coroutine on the loop and returns a `Task` that runs concurrently — you don't await it immediately. The danger is fire-and-forget: if you never await or keep a reference, exceptions get swallowed and the GC may warn "Task was destroyed but it is pending." You also must hold a strong reference yourself, because the loop only keeps a weak one.

`gather` runs many awaitables concurrently and collects results in order. Its error handling is the historical foot-gun. With the default `return_exceptions=False`, the *first* exception propagates to the awaiter immediately — but the **other tasks are not cancelled**; they keep running detached, and their later exceptions may surface as "never retrieved." With `return_exceptions=True`, exceptions come back as result values instead of raising, so nothing is lost but nothing is cancelled either.

`TaskGroup` (3.11+) is the structured-concurrency fix and what I reach for now. The `async with` block doesn't exit until every child task finishes. If any task raises, the group **cancels all siblings**, waits for them, and re-raises the failures bundled in an `ExceptionGroup` — caught with `except*`. No leaked tasks, no swallowed errors.

```python
# Old way — sibling keeps running after the first failure
results = await asyncio.gather(a(), b(), c())

# 3.11 structured concurrency
try:
    async with asyncio.TaskGroup() as tg:
        ta = tg.create_task(a())
        tb = tg.create_task(b())
    # both guaranteed done here; one failing cancels the other
except* ValueError as eg:
    for exc in eg.exceptions:
        log(exc)
```

Rule: use `TaskGroup` for related work that should live and die together; use `gather(..., return_exceptions=True)` only when you genuinely want best-effort independent results; use bare `create_task` for true background tasks whose references you manage.

### Q59. The blocking-in-async pitfall: what happens if you call a blocking/CPU-bound function inside a coroutine, and how do you fix it (run_in_executor / to_thread)?

Because the loop is one thread and scheduling is cooperative, a blocking call inside a coroutine freezes the *entire* loop. `time.sleep(5)`, a synchronous `requests.get`, a `psycopg2` query, reading a big file with plain `open().read()`, or a tight CPU loop — none of them hit an `await`, so the loop never gets control back. Every other task, every timer, every incoming connection stalls until the call returns. This is the single most common async bug, and it's a correctness problem, not just a perf nit: heartbeats miss, timeouts fire late, throughput collapses to serial.

For **blocking I/O**, offload it to a thread so the loop stays free. `asyncio.to_thread` (3.9+) is the clean way; `loop.run_in_executor(None, ...)` is the older, more configurable form:

```python
# Bad — freezes the loop
data = requests.get(url).text

# Good — runs in a thread, loop keeps serving other tasks
data = await asyncio.to_thread(requests.get, url)
text = data.text
```

This works because the blocking call now lives on a worker thread, and the GIL is released during the actual I/O syscall, so the loop thread runs normally. Even better, where a real async library exists (`httpx`, `aiofiles`, `asyncpg`), use it instead of wrapping a blocking one — native async avoids the thread-pool hop entirely.

For **CPU-bound** work, threads don't help because the GIL serializes Python computation — you'd just move the freeze to a thread that still hogs the GIL. Use a process pool: `loop.run_in_executor(ProcessPoolExecutor(), heavy_fn, arg)`. The function and args must be picklable. Quick litmus test when an async app feels sluggish: anything synchronous in the hot path that isn't preceded by `await` is a suspect — profile with `cProfile`, or enable `loop.slow_callback_duration` and asyncio debug mode to get warnings for callbacks that run too long.

### Q60. async context managers (async with) and async generators (async for) — when do you need them, and what's the cleanup story?

You need the async variants whenever *setup or teardown itself does I/O*. A normal `with` calls `__enter__`/`__exit__` synchronously — fine for a lock or a file handle, useless for acquiring a database connection from an async pool, which requires an `await`. So `async with` calls `__aenter__`/`__aexit__`, both coroutines, letting acquisition and release suspend the loop instead of blocking it. Same story for `async for`: an async generator's `__anext__` is awaitable, so each iteration can await I/O — streaming rows from `asyncpg`, lines from an async socket, pages from a paginated API.

```python
@contextlib.asynccontextmanager
async def db_conn(pool):
    conn = await pool.acquire()        # awaitable setup
    try:
        yield conn
    finally:
        await pool.release(conn)       # awaitable teardown, runs even on error

async def stream(pool):
    async with db_conn(pool) as conn:
        async for row in conn.cursor("SELECT ..."):  # awaits each batch
            process(row)
```

`contextlib.asynccontextmanager` is the ergonomic way to write one — the `finally` block is your teardown and it runs on normal exit, exception, *and* cancellation (the `CancelledError` is raised at the `yield`, propagating into the `finally`).

The cleanup gotcha is async generators specifically. Their teardown is itself async, so if a generator is abandoned mid-iteration, Python can't run the cleanup synchronously during GC — there may be no running loop. `asyncio.run()` handles this for you by calling `loop.shutdown_asyncgens()` on exit, which drives every pending async generator's `aclose()`. If you drive the loop manually, you must call it yourself or risk leaked resources and "async generator ignored GeneratorExit" warnings. Practically: prefer `async with`/`asynccontextmanager` for anything holding a resource, let `asyncio.run` own the loop lifecycle, and don't half-consume an async generator without closing it.

---

## Memory Management & GC

### Summary

**What this topic covers** — How CPython allocates, tracks, and frees objects: reference counting as the primary reclamation mechanism, the generational cyclic garbage collector that catches what refcounting can't, the hazards of `__del__` finalizers, `weakref` as the tool for non-owning references and caches, and the practical workflow for hunting memory leaks in a long-running service with `tracemalloc` and `objgraph`. Everything here is **CPython-specific** — refcounting is an implementation detail, not a language guarantee. PyPy, GraalPy, and other implementations use tracing GC and have none of it.

**Mental model** — Think of two layers. The fast, eager layer is **reference counting**: every object carries an integer (`ob_refcnt`) of how many references point at it, and the instant that count hits zero the object is deallocated — deterministically, right there, no GC pass required. This is why CPython frees a local variable the moment its function returns and why file handles often close promptly. The slow, occasional layer is the **cyclic GC**, which exists solely to clean up reference cycles (`a.ref = b; b.ref = a`) that refcounting alone can never reclaim because the counts never reach zero. The GC only tracks container objects (things that can hold references — lists, dicts, instances), not atomic objects like `int` or `str`. So memory in CPython is "mostly refcounted, occasionally swept." Most objects die by refcount; only the tangled ones wait for the collector. In the free-threaded 3.13 build the GIL no longer protects refcount increments, so they became atomic — which is partly why removing the GIL costs single-threaded performance.

**Key terms**
- **Reference count (`ob_refcnt`)** — per-object integer; object is freed when it reaches zero.
- **`sys.getrefcount(obj)`** — reports the count, always +1 because the call itself holds a temporary reference.
- **Cyclic GC** — the `gc` module's mark-and-sweep collector for unreachable reference cycles.
- **Generation** — one of three buckets (0, 1, 2) holding tracked objects by survival age.
- **Threshold** — allocation-minus-deallocation counts that trigger a gen-0 collection (default `(700, 10, 10)`).
- **`gc.collect()`** — forces a full collection; returns the count of unreachable objects found.
- **Finalizer (`__del__`)** — method called when an object is about to be destroyed.
- **`weakref`** — a reference that does not increment the refcount and doesn't keep the target alive.
- **`WeakValueDictionary`** — a dict whose values are weak; entries vanish when the value is otherwise collected.
- **`gc.garbage`** — list of uncollectable objects (historically cycles with `__del__`; rare post-3.4).
- **Arena/pool (pymalloc)** — CPython's small-object allocator carving 256 KiB arenas for sub-512-byte objects.
- **Resurrection** — a finalizer re-storing a reference to `self`, aborting destruction.

**Why interviewers ask this** — Memory is where Python's "it just works" abstraction leaks, and it separates people who've shipped long-running services from people who've only written scripts. A junior says "Python has a garbage collector" and stops. A senior knows the GC is the *secondary* mechanism, that refcounting does most of the work deterministically, that `__del__` is a footgun, that you can leak memory with a global cache or an accidental cycle holding a giant object, and that the diagnosis tools are `tracemalloc` and `objgraph` — not guesswork. The strongest signal is someone who can explain *why* a particular object isn't being freed (a lingering reference in a traceback, a closure, a module-level list, a logging handler) and reach for the right instrument. This question also surfaces whether a candidate understands that "leak" in Python usually means "unintended liveness," not C-style lost pointers.

**Common confusions**
- **"The garbage collector frees all my objects."** — No; refcounting frees the overwhelming majority eagerly. The GC only handles cycles.
- **"`del x` frees the object."** — `del` removes one binding and decrements the refcount; the object is freed only if that count hits zero.
- **"Disabling the GC with `gc.disable()` stops all reclamation."** — Refcounting still runs; you only lose cycle collection.
- **"`sys.getrefcount` returns the true count."** — It's always one higher because the argument itself is a reference.
- **"`__del__` is like a C++ destructor — deterministic and safe."** — Its timing is unreliable and it can break cycle collection.

**What follows from this topic** — Refcounting under the GIL connects directly to the **Concurrency / GIL** topic (atomic refcounts are why free-threading is hard) and to **C extensions** (manual `Py_INCREF`/`Py_DECREF` discipline). Deterministic cleanup ties into **context managers** (`with`, `contextlib`) as the *correct* alternative to `__del__`. And the leak-hunting workflow overlaps with **profiling** (`cProfile` for time, `tracemalloc` for space).

### Q61. How does CPython manage memory? Explain reference counting as the primary mechanism — what increments/decrements a refcount, and when is an object freed?

CPython's primary memory-management mechanism is **reference counting**, and this is an implementation detail — not part of the Python language. Every object has a `ob_refcnt` field counting how many references point at it. When that count drops to zero, the object is deallocated *immediately and synchronously* — its `tp_dealloc` runs, its own references are decremented (possibly triggering a cascade of frees), and its memory is returned to the allocator. This determinism is why CPython reclaims a local list the instant a function returns, without waiting for any GC pass.

A refcount **increments** whenever you create a new reference: binding to a variable, appending to a list, passing as an argument (the parameter is a new reference), storing in an attribute or dict, or capturing in a closure. It **decrements** when a reference goes away: `del`, rebinding the name, a local going out of scope at function exit, removing from a container, or an exception traceback being cleared.

```python
import sys
x = [1, 2, 3]
sys.getrefcount(x)   # e.g. 2 — one for x, one for the getrefcount argument
y = x
sys.getrefcount(x)   # 3
del y
sys.getrefcount(x)   # 2
```

Always remember `getrefcount` reports **one extra** because the call holds a temporary reference to its argument. Two CPython quirks distort the picture for small immutables: **small integers** (`-5` to `256`) and many short strings/identifiers are **interned** and shared process-wide, so their refcounts are large and meaningless — never reason about object lifetime from an interned literal's count.

Underneath refcounting sits **pymalloc**, CPython's small-object allocator: it manages 256 KiB arenas subdivided into pools and blocks for objects under 512 bytes, which is why allocating millions of tiny objects is fast but why freed memory often isn't returned to the OS (arenas are reused, not always released). The headline tradeoff of refcounting: cleanup is deterministic and cache-friendly, but it can't reclaim cycles, and every increment/decrement is overhead — under free-threaded 3.13 those operations must be atomic, which is a real single-thread cost.

### Q62. Reference counting can't handle cycles — explain the cyclic garbage collector, the three generations, and when it runs.

Reference counting has one fatal blind spot: **cycles**. If `a` references `b` and `b` references `a`, then even after every external reference is dropped, both objects still see a refcount of 1 from each other. The counts never reach zero, so refcounting alone leaks them. CPython's **cyclic garbage collector** (the `gc` module) exists for exactly this case and *only* this case.

```python
import gc
a = {}; b = {}
a['b'] = b; b['a'] = a   # cycle
del a, b                 # refcounts stay at 1 each — leaked by refcounting alone
gc.collect()             # returns a nonzero count; the cycle is reclaimed
```

The collector tracks only **container** objects — things capable of holding references (lists, dicts, sets, instances, tuples-of-containers). Atomic objects like `int` and `str` can't form cycles, so the GC never tracks them (`gc.is_tracked(obj)` confirms). It uses a mark-and-sweep variant: it computes "effective" refcounts by subtracting internal references found within the tracked set; any object whose effective count is zero is reachable only from within a cycle and is collected.

It's **generational** with three generations (0, 1, 2) based on the hypothesis that most objects die young. New tracked objects start in gen 0. A gen-0 collection runs when (allocations − deallocations) exceeds the gen-0 threshold — **default `(700, 10, 10)`** (`gc.get_threshold()`). Survivors are promoted to gen 1; gen 1 is collected after 10 gen-0 collections, and gen 2 (the full, expensive sweep) after 10 gen-1 collections. So the GC runs on an **allocation cadence, not a timer** — a service that allocates nothing triggers no collections.

Operationally: it's safe to `gc.disable()` in latency-sensitive, short-lived, or fork-heavy workloads (Instagram famously did this to avoid copy-on-write page faults after fork), since refcounting still frees everything acyclic — but you then own the risk of cycles accumulating. A common tuning move is calling `gc.freeze()` after startup to move long-lived objects out of the scanned generations. Since 3.4 (PEP 442) the collector can finalize objects with `__del__` even in cycles, so `gc.garbage` is almost always empty now.

### Q63. `__del__` finalizers and reference cycles — why is `__del__` a footgun, and how do weakref / weakref.WeakValueDictionary help break cycles / build caches?

`__del__` is the method CPython calls when an object is about to be destroyed, and it's a footgun for several reasons. **First, timing is unreliable**: it fires when the refcount hits zero, which under refcounting is often prompt — but if the object is in a cycle, it fires whenever the *cyclic GC* gets around to it, which may be much later or, at interpreter shutdown, in an unpredictable order where module globals are already `None`. **Second, exceptions in `__del__` are swallowed** — they're printed to stderr and ignored, so failures hide. **Third, resurrection**: a finalizer can store `self` somewhere and abort its own destruction, which is confusing. **Fourth**, pre-3.4 a `__del__` inside a reference cycle made the whole cycle *uncollectable* (dumped into `gc.garbage`); PEP 442 fixed that, but `__del__` still complicates collection.

The senior rule: **don't use `__del__` for resource cleanup.** Use context managers (`with`, `__enter__`/`__exit__`) for deterministic release, and `weakref.finalize` if you genuinely need a finalizer — it's callback-based, runs predictably, and doesn't suffer the resurrection/ordering traps.

```python
import weakref
class Conn:
    def __init__(self, name): self.name = name
c = Conn("db")
weakref.finalize(c, lambda n: print(f"closing {n}"), c.name)  # don't capture c itself
del c   # prints "closing db" deterministically
```

`weakref` is the tool for **non-owning references**: a weak reference doesn't increment the refcount, so it doesn't keep the target alive. This breaks cycles — a child holding a *weak* back-reference to its parent means the parent can still be collected. The classic application is **caches that shouldn't pin memory**: `weakref.WeakValueDictionary` holds weak references to its values, so once nothing else references a value, its entry vanishes automatically. That's exactly what you want for an identity-map / instance cache — the cache never extends an object's lifetime. (`WeakKeyDictionary` is the mirror, keyed weakly, for attaching metadata to objects you don't own.) Note weak refs aren't supported on every type — plain `int`, `str`, `tuple`, and `list` instances can't be weakly referenced unless subclassed; custom classes and most containers can.

### Q64. How would you find and diagnose a memory leak in a long-running Python service (tracemalloc, objgraph, growing refcounts)?

First, reframe: in CPython a "memory leak" almost never means a lost C pointer — it means **unintended liveness**. Some reference is keeping objects alive longer than you think: a module-level list that only grows, an unbounded cache or `lru_cache`, a logging handler accumulating records, closures capturing large objects, `__pycache__` of tracebacks holding frames, or an event-listener list nobody unsubscribes from. The job is to find *what still references the growing objects*.

Step one is confirming it's real and locating the type. **`tracemalloc`** is the primary tool — it's in the stdlib and attributes allocations to source lines. Start tracing early, snapshot periodically, and diff:

```python
import tracemalloc
tracemalloc.start(25)               # keep 25 frames of traceback per alloc
snap1 = tracemalloc.take_snapshot()
# ... run a unit of work that you suspect leaks ...
snap2 = tracemalloc.take_snapshot()
for stat in snap2.compare_to(snap1, 'lineno')[:10]:
    print(stat)                     # top growth sites, by file:line and size delta
```

The `compare_to` diff is the key move — absolute snapshots are noisy; *growth between snapshots under steady-state load* is the signal. Complement it with `gc.get_objects()` plus a `collections.Counter` of `type(o).__name__` snapshotted at intervals to see *which class* is multiplying.

Once you know the type, **`objgraph`** (third-party) answers "why is it alive." `objgraph.show_growth()` prints object-count deltas between calls; then `objgraph.show_backrefs([obj], max_depth=N)` renders the **reference chain holding the object**, which usually points straight at the culprit global or cache. That backref graph is the thing that turns "I'm leaking `Session` objects" into "the leak is this module-level `_active` dict that never gets entries removed."

A few sharp checks: call `gc.collect()` and see if memory drops — if it does, you have an uncollected cycle, possibly with `__del__`; inspect `gc.garbage`. Watch `sys.getrefcount` or per-type counts trending up across requests. Beware false positives: pymalloc arenas don't always return freed memory to the OS, so RSS can plateau high without an actual leak — trust `tracemalloc`'s tracked totals over RSS. And rule out C-extension leaks (NumPy buffers, native handles) separately, since `tracemalloc` only sees Python-level allocations unless the extension cooperates.

---

## Exceptions & Context Managers

### Summary

**What this topic covers** — This topic is about how Python signals, propagates, classifies, and recovers from errors, and how the `with` statement gives you deterministic resource cleanup. It spans the `BaseException`/`Exception` split, the full `try`/`except`/`else`/`finally` machinery, exception chaining (`raise from`), the 3.11 exception-group/`except*` story for concurrent failures, the context-manager protocol (`__enter__`/`__exit__`), the `@contextlib.contextmanager` generator shortcut, and the EAFP-over-LBYL philosophy that pervades idiomatic Python.

**Mental model** — Think of exceptions as a second return channel that unwinds the call stack until something catches it, running `finally` blocks and `__exit__` methods on the way out. An exception is just an object; `raise` sets it as the "in-flight" exception and starts the unwind. `try` marks a frame as interested: `except` clauses are tested top-to-bottom by `isinstance`, `else` runs only if the `try` body completed without raising, and `finally` always runs — even through `return`, `break`, or a re-raise. A `with` block is sugar over a `try`/`finally`: `__enter__` runs on entry, `__exit__` runs on exit and gets told whether an exception is propagating, so it can clean up unconditionally and optionally suppress. The senior insight is that exceptions and context managers are the *same* control-flow story viewed from two angles — one is "how do I react to an error", the other is "how do I guarantee cleanup regardless of error".

**Key terms**
- **`BaseException`** — root of the hierarchy; catching it catches `KeyboardInterrupt`, `SystemExit`, `GeneratorExit` too.
- **`Exception`** — base for ordinary errors you should normally catch; subclass of `BaseException`.
- **`else` clause** — runs only when the `try` body raised nothing; narrows what `try` "guards".
- **`finally` clause** — runs unconditionally for cleanup; can override the propagating exception (avoid).
- **Implicit chaining (`__context__`)** — set automatically when an exception is raised while handling another.
- **Explicit chaining (`__cause__`)** — set by `raise X from err`; renders "The above exception was the direct cause".
- **`ExceptionGroup`** — a container holding multiple concurrent exceptions (3.11).
- **`except*`** — matches and peels matching exceptions out of a group, leaving the rest to propagate.
- **Context manager** — object with `__enter__`/`__exit__`; powers `with`.
- **`__exit__(exc_type, exc, tb)`** — returns truthy to suppress the in-flight exception.
- **EAFP** — "Easier to Ask Forgiveness than Permission" — try and catch.
- **LBYL** — "Look Before You Leap" — check preconditions first (race-prone).

**Why interviewers ask this** — Exception handling separates people who write happy-path scripts from people who build systems that fail safely. A junior catches `Exception` broadly, swallows tracebacks, and leaks file handles. A senior knows that bare `except:` also eats `KeyboardInterrupt`, that `finally` with a `return` silently discards the live exception, that `raise from` preserves the diagnostic chain, and that `__exit__` returning `True` is a subtle footgun that hides bugs. Interviewers probe `else` because almost nobody uses it, yet it cleanly separates "code that might fail" from "code that runs on success" — a candidate who explains it well signals real fluency. The 3.11 exception-group material is a senior filter: it shows whether you've actually run `asyncio.TaskGroup` in anger and understand structured concurrency, where one logical operation can fail in several places at once.

**Common confusions**
- **"`except Exception` catches everything"** — it misses `KeyboardInterrupt`/`SystemExit`, which subclass `BaseException` directly.
- **"`else` is just extra code after `try`"** — no; `else` runs *only* if no exception was raised, and isn't itself guarded by the `except`.
- **"`raise` and `raise from None` are the same"** — `from None` deliberately suppresses the chain.
- **"`finally` can't change what propagates"** — a `return`/`raise` in `finally` replaces the in-flight exception.
- **"`__exit__` returning `None` suppresses the error"** — only a *truthy* return suppresses; `None` lets it propagate.
- **"Exception groups are just tuples of errors"** — they're a real type with `.exceptions`, matched by `except*`, not regular `except`.

**What follows from this topic** — Context managers connect directly to the **Iterators & Generators** topic (`@contextmanager` is a generator) and to **Concurrency** (locks, pools, and `asyncio` resources are all context managers; `ExceptionGroup` is born from `TaskGroup`). EAFP ties into **Duck Typing & the Data Model** — you `try` an operation and let the protocol decide. And `finally`/`__exit__` semantics underpin the **Memory & Resource Management** discussion of why you don't rely on `__del__` for deterministic cleanup.

### Q65. Walk the exception hierarchy (BaseException vs Exception) and the full try / except / else / finally semantics — what's `else` for?

The root is `BaseException`. Directly under it sit the things you almost never want to catch by accident: `KeyboardInterrupt` (Ctrl-C), `SystemExit` (from `sys.exit()`), and `GeneratorExit`. Everything else you'd normally handle lives under `Exception`. That split is the whole point of the hierarchy: `except Exception:` lets Ctrl-C and interpreter shutdown pass through, while a bare `except:` (equivalent to `except BaseException:`) traps them and can wedge your program. Rule: catch `Exception` or narrower; never bare-`except` unless you immediately re-raise.

The four clauses have distinct jobs. `try` is the guarded body. `except` clauses are tested in order by `isinstance`, so order from most specific to most general or the specific ones become dead code. `else` runs only if the `try` body raised nothing. `finally` always runs.

`else` is the one people skip. Its purpose is to keep the `try` body as small as possible — only the line that can raise — so an exception from the *success* path doesn't get accidentally caught by your handler:

```python
try:
    conn = pool.acquire()      # only thing we're guarding
except PoolEmpty:
    return None
else:
    return conn.run(query)     # if run() raises KeyError, it is NOT caught above
finally:
    log.debug("acquire attempt done")
```

Without `else`, you'd put `conn.run(query)` inside `try`, and a `KeyError` from `run()` would wrongly hit handlers meant for `acquire()`.

The footgun is `finally` with control flow. A `return`, `break`, or `raise` inside `finally` *replaces* whatever was propagating — including a live exception — and the original silently vanishes. Never `return` from `finally`; use it purely for cleanup.

### Q66. Exception chaining: `raise X from err` vs bare `raise` — how do you preserve the cause and avoid swallowing tracebacks?

There are three moves and they mean different things. A bare `raise` (no expression) inside an `except` re-raises *the current* exception with its original traceback intact — use it when you wanted to do some side-effect (log, rollback) but not change the error. `raise NewError(...)` from within a handler raises a new exception but Python *implicitly* chains the original onto `__context__`, so the traceback prints "During handling of the above exception, another exception occurred." `raise NewError(...) from err` sets `__cause__` explicitly and prints "The above exception was the direct cause" — this is the right form when you're deliberately translating a low-level error into a domain one.

```python
try:
    value = config["timeout"]
except KeyError as err:
    raise ConfigError("timeout is required") from err   # __cause__ = err
```

Use `from err` whenever you wrap-and-rethrow. It's the difference between a reviewer seeing the real `KeyError` at the bottom of the chain versus a bare `ConfigError` with no idea what triggered it.

`raise X from None` deliberately *suppresses* the chain — useful when the underlying error is noise (e.g. you reimplemented a lookup and don't want the internal `KeyError` leaking into a public API's traceback). Use it sparingly; it discards diagnostics.

The classic anti-pattern that swallows tracebacks:

```python
except Exception as e:
    raise RuntimeError(str(e))      # loses traceback, loses type, loses chain
```

Stringifying the error throws away everything useful. Either re-`raise` bare, or `raise RuntimeError(...) from e`. And never catch-log-swallow silently (`except Exception: pass`) — that's how production incidents become unfindable.

### Q67. Exception groups and `except*` (3.11) — what problem (concurrent failures from TaskGroup) do they solve?

Pre-3.11, an exception was a single object unwinding a single stack. That model breaks under structured concurrency: when you run ten tasks in an `asyncio.TaskGroup` and three of them fail, which one do you raise? Picking one loses the other two. `ExceptionGroup` solves this by being a real exception that *carries a collection* of exceptions, so the group can surface all concurrent failures at once.

```python
async def main():
    async with asyncio.TaskGroup() as tg:
        tg.create_task(fetch("a"))
        tg.create_task(fetch("b"))   # if both raise, you get an ExceptionGroup
```

You handle groups with `except*` (note the star), which is fundamentally different from `except`: it *splits* the group, peeling out the exceptions that match the type and running that handler, while letting non-matching exceptions continue propagating in a residual group. Multiple `except*` clauses can therefore all fire for a single group:

```python
try:
    await main()
except* ConnectionError as eg:
    log.warning("network failures: %r", eg.exceptions)
except* ValueError as eg:
    log.error("bad data: %r", eg.exceptions)
```

The `eg` bound in each clause is itself an `ExceptionGroup` containing only the matched leaves. Don't mix `except` and `except*` in the same `try` — it's a `SyntaxError`. You can also raise groups manually (`raise ExceptionGroup("batch failed", [err1, err2])`) for any fan-out operation, not just asyncio. `contextlib.suppress` and friends were updated to understand groups, and there's `BaseExceptionGroup` for when the group might contain `KeyboardInterrupt`-style members. This is the senior tell: groups exist because "one operation, many simultaneous failures" needed a first-class representation.

### Q68. Context managers: the __enter__/__exit__ protocol and the `with` statement. How does __exit__ handle exceptions and resource cleanup?

A context manager is any object with `__enter__` and `__exit__`. The `with obj as x:` statement calls `obj.__enter__()` and binds its return value to `x` (note: `x` is whatever `__enter__` *returns*, not `obj` itself — for files they happen to be the same object, but they needn't be). On leaving the block — normally or via exception — `__exit__(exc_type, exc, tb)` runs. That `try/finally` guarantee is the whole value proposition: cleanup happens even if the body raises, `return`s, or `break`s.

The signature carries the exception state. On a clean exit, all three args are `None`. If an exception is propagating, they hold its type, value, and traceback, letting `__exit__` decide what to do — roll back a transaction, close a socket, whatever. The subtle part is the *return value*: if `__exit__` returns a **truthy** value, the in-flight exception is **suppressed** (swallowed); any falsy value (including the easy-to-forget implicit `None`) lets it propagate. So a cleanup method that accidentally `return True`s will silently eat every error in the block — a real bug I've seen ship.

```python
class Transaction:
    def __enter__(self):
        self.conn = pool.acquire()
        return self.conn
    def __exit__(self, exc_type, exc, tb):
        if exc_type is None:
            self.conn.commit()
        else:
            self.conn.rollback()
        self.conn.close()
        return False          # propagate any exception — do NOT swallow
```

`contextlib.ExitStack` is the tool for a *dynamic* number of resources (e.g. opening N files in a loop) — it stacks `__exit__` callbacks and unwinds them in reverse on exit, far cleaner than nested `with`s. And remember `__del__` is *not* a substitute: it fires at an undefined time under refcounting and not at all on some shutdown paths, which is exactly why deterministic `with`-based cleanup exists.

### Q69. @contextlib.contextmanager — write a context manager as a generator. And explain EAFP vs LBYL as a Python design philosophy.

`@contextlib.contextmanager` lets you write a context manager as a generator instead of a class: everything before `yield` is `__enter__`, the yielded value is what `as` binds, and everything after `yield` is `__exit__`. The catch is that you must wrap the `yield` in `try/finally` so cleanup runs even when the body raises — the exception is *re-raised at the `yield` point*, so a bare `finally` is how you guarantee teardown:

```python
from contextlib import contextmanager

@contextmanager
def transaction(pool):
    conn = pool.acquire()
    try:
        yield conn            # body runs here; exception re-raised at this line
        conn.commit()
    except Exception:
        conn.rollback()
        raise                 # re-raise to propagate, like __exit__ returning False
    finally:
        conn.close()
```

This is the idiomatic way for simple setup/teardown; reach for a class when you need state across methods, reuse, or a non-trivial suppression policy. To suppress in the generator form you'd swallow the exception instead of re-raising — but be deliberate, same footgun as `__exit__` returning truthy.

**EAFP vs LBYL.** LBYL ("Look Before You Leap") checks preconditions first: `if key in d: use(d[key])`. EAFP ("Easier to Ask Forgiveness than Permission") just does it and catches the failure: `try: use(d[key]) except KeyError: ...`. Python idiom strongly favors EAFP for two reasons. First, *correctness under races*: in LBYL, the world can change between the check and the use (the classic `if os.path.exists(p): open(p)` TOCTOU bug — the file can vanish in between), whereas EAFP's `try: open(p) except FileNotFoundError` is atomic. Second, *duck typing*: you can't enumerate every precondition for "does this object behave like a file", but you *can* try the operation and let the protocol decide. EAFP also tends to be faster on the happy path because `try` setup is nearly free in CPython when no exception fires — you only pay when you actually raise. The senior nuance: EAFP is the default, but catch *narrowly* (`except KeyError`, not `except Exception`) or you'll mask the very bugs you should be surfacing.

---

## Strings, Bytes & Encoding

### Summary

**What this topic covers** — This topic is about the hard boundary CPython draws between `str` (an immutable sequence of Unicode code points) and `bytes` (an immutable sequence of 8-bit values), the `encode`/`decode` operations that bridge them, how strings are formatted (f-strings, the format spec mini-language), and the encoding bugs that bite at every I/O boundary — files, sockets, subprocess pipes, HTTP. It is the practical "text is not bytes" lesson that separates engineers who've shipped multilingual systems from those who haven't.

**Mental model** — Think of `str` as *meaning* and `bytes` as *transport*. A `str` is a logical sequence of Unicode scalar values; how many bytes it takes on the wire is undefined until you pick an encoding. `encode` serializes `str` → `bytes`; `decode` parses `bytes` → `str`. The two are inverses *only* if the codec round-trips and the bytes are valid. Internally (PEP 393, CPython-specific) a `str` uses a flexible representation — Latin-1, UCS-2, or UCS-4 storage chosen by the widest code point — so `len(s)` is O(1) and counts *code points*, not bytes and not user-perceived characters (a grapheme like an emoji-with-skin-tone may be several code points). The cardinal rule: decode bytes to `str` at the moment they enter your program, work in `str` everywhere internally, and encode back to `bytes` only at the exit. This "Unicode sandwich" keeps the messy encoding question pinned to the edges.

**Key terms**
- **Code point** — an integer Unicode assigns to a character (e.g. `U+00E9` for é); `str` is a sequence of these.
- **Code unit** — the fixed-width pieces an encoding uses (UTF-8 uses 1–4 bytes; UTF-16 uses 2-byte units).
- **Grapheme cluster** — what a user calls "a character"; may span multiple code points (flags, skin-tone emoji).
- **UTF-8** — variable-width, ASCII-compatible, the default for the modern web and the right choice ~always.
- **Codec** — an encode/decode pair registered by name (`'utf-8'`, `'latin-1'`, `'ascii'`).
- **`errors=` handler** — `'strict'` (default, raises), `'replace'` (), `'ignore'`, `'backslashreplace'`, `'surrogateescape'`.
- **Mojibake** — text decoded with the wrong codec; é becomes `Ã©` when UTF-8 bytes are read as Latin-1.
- **BOM** — byte-order mark; `utf-8-sig` strips/writes it, plain `utf-8` does not.
- **Interning** — CPython dedups some short strings/identifiers so `is` happens to work — an implementation detail, never rely on it.
- **`surrogateescape`** — smuggles undecodable bytes into the `str` as lone surrogates so they can round-trip back out.

**Why interviewers ask this** — Encoding is where confident juniors quietly ship bugs that only surface on a Turkish customer's name or a Japanese filename. A junior says "just call `.decode()`"; a senior asks *which* encoding, *where* the boundary is, and *what happens* on malformed input. The signal interviewers want: do you understand that `len()` counts code points (not bytes, not graphemes), that there is no such thing as "plain text" without a declared encoding, that defaults are platform-dependent and therefore dangerous, and that the fix is architectural (the Unicode sandwich) rather than a sprinkle of `try/except`. Bonus signal: knowing `''.join` beats `+=` and *why*, and being fluent in the format mini-language under pressure.

**Common confusions**
- **"`len(s)` gives the number of characters a user sees."** No — it counts code points; `len('👨‍👩‍👧')` is 5, not 1.
- **"`str` and `bytes` are interchangeable; just add `b`."** They never compare equal and can't be concatenated; mixing them raises `TypeError`.
- **"Latin-1 / `ascii` is fine, it's just English."** Until one accented name or smart-quote arrives and it explodes or corrupts silently.
- **"`is` works for string comparison because `'a' is 'a'`."** That's interning — a CPython quirk; always use `==`.
- **"The default encoding is UTF-8."** Historically platform-dependent (cp1252 on Windows); only guaranteed if you pass `encoding=` or run with UTF-8 mode.

**What follows from this topic** — Immutability ties straight into the **data model / memory** topics (refcounts, why rebinding in a loop allocates) and into **performance profiling** (`join` vs `+=`, `tracemalloc`). The `errors='surrogateescape'` handler reappears in **filesystem and subprocess** topics. f-string internals connect to **the compiler/bytecode** topic (f-strings compile to `FORMAT_VALUE`/`BUILD_STRING` ops). And the "decode at the edge" discipline is the same boundary thinking that governs **serialization** (JSON, pickle) elsewhere in the primer.

### Q70. str vs bytes: what's the difference, where's the encode/decode boundary, and why is `'cafe'.encode('utf-8')` length subtle for non-ASCII?

`str` is an immutable sequence of Unicode *code points*; `bytes` is an immutable sequence of integers in `0..255`. They are different types that never compare equal (`'a' == b'a'` is `False`) and can't be concatenated — `'x' + b'y'` raises `TypeError`. Indexing also differs: `b'abc'[0]` gives the *int* `97`, while `'abc'[0]` gives the one-char `str` `'a'`.

The boundary is `encode`/`decode`. `str.encode(enc)` serializes to `bytes`; `bytes.decode(enc)` parses back to `str`. Always name the encoding explicitly — relying on the default invites platform-dependent bugs.

The length subtlety: under UTF-8, ASCII characters are one byte each, but anything outside ASCII takes 2–4 bytes. The literal `'cafe'` is pure ASCII, so it's 4 code points and 4 bytes. But the moment you mean *café* with a real é (`U+00E9`), the byte length diverges from the character length:

```python
s = 'café'          # 4 code points
len(s)               # 4
b = s.encode('utf-8')
len(b)               # 5  — é is two bytes (0xC3 0xA9)
b                    # b'caf\xc3\xa9'
```

So `len(str)` counts code points and `len(bytes)` counts bytes, and they only coincide for ASCII. This trips up off-by-one slicing, buffer-size assumptions, and "max 20 chars" validators that are really counting bytes. The senior reflex: decide whether a limit means code points or bytes, and never assume one byte per character.

One more trap — even `len(str)` isn't "characters a human sees." A composed é can be one code point (`U+00E9`) or two (`e` + combining accent `U+0301`); they look identical but have different `len`. Use `unicodedata.normalize('NFC', s)` before comparing or measuring user-facing text.

### Q71. Strings are immutable — what does that mean for performance, and why is `''.join(parts)` preferred over `+=` in a loop?

Immutability means every "modification" creates a new object. `s = s + 'x'` doesn't grow `s` in place — it allocates a fresh string, copies the old contents plus the new char, and rebinds the name. The original is untouched (and may be garbage-collected if nothing else references it).

In a loop, `+=` is the classic quadratic trap. Building an N-character string one piece at a time copies a growing prefix on each iteration, so total work is roughly O(N²):

```python
# O(n^2) in the general case — avoid
out = ''
for part in parts:
    out += part

# O(n) — build a list, join once
out = ''.join(parts)
```

`''.join` is linear: it makes one pass to compute the total size, allocates the result buffer once, and copies each piece in exactly once. That single up-front allocation is the whole win.

A caveat for honesty: CPython has a *specific* optimization that detects `s += x` when `s` has refcount 1 and resizes in place, which can make naive `+=` look fine in microbenchmarks. But it's a fragile, CPython-only implementation detail (PyPy doesn't do it; it breaks the instant another reference exists), so don't lean on it. `join` is correct everywhere and reads better.

For incremental text where you genuinely can't collect a list first, use `io.StringIO` and `.write()`, then `.getvalue()` once. For interpolating a handful of values, an f-string is both fastest and clearest — `join` is for *many* pieces, not for gluing three variables together.

### Q72. f-strings and the format spec mini-language — formatting numbers/dates/alignment; f-string `=` debugging (3.8) and nested quotes (3.12).

f-strings (PEP 498, 3.6+) evaluate expressions inline and compile to bytecode — no runtime `str.format` parsing — so they're the fastest interpolation. The format spec after `:` is the same mini-language `format()` and `str.format` use: `{value:[[fill]align][sign][#][0][width][grouping][.precision][type]}`.

Common specs in interview-grade form:

```python
n = 1234567.8915
f'{n:,.2f}'        # '1,234,567.89'  — thousands sep, 2 dp
f'{n:_.2f}'        # '1_234_567.89'  — underscore grouping
f'{0.1276:.1%}'    # '12.8%'         — percent
f'{255:#06x}'      # '0x00ff'        — hex, zero-padded width 6, 0x prefix
f'{42:<8}|'        # '42      |'     — left align in width 8
f'{42:>8}|'        # '      42|'     — right align
f'{42:^8}|'        # '   42   |'     — center
f'{"hi":*^10}'     # '****hi****'    — custom fill char
```

Dates use the datetime spec, which f-strings pass straight to `__format__`:

```python
from datetime import datetime
dt = datetime(2026, 6, 10, 14, 5)
f'{dt:%Y-%m-%d %H:%M}'   # '2026-06-10 14:05'
```

The `=` self-documenting form (3.8) prints `expr=value`, invaluable for logging/debugging — and it preserves the expression text verbatim:

```python
x = 5
f'{x=}'          # 'x=5'
f'{x*2=}'        # 'x*2=10'
f'{x=:.3f}'      # 'x=5.000'  — combine with a spec
```

Before 3.12, the f-string grammar was a separate, restricted parser: you couldn't reuse the same quote character inside the braces, so nesting forced you to swap quote styles. Python 3.12 (PEP 701) made f-strings part of the normal grammar, so this now works:

```python
# 3.12+: same quotes inside and out, arbitrary nesting, multiline, backslashes
f"{d["key"]}"
f"{'\n'.join(items)}"
```

On pre-3.12, write `f"{d['key']}"` (swap to single quotes inside) — a fact worth stating in an interview since it shows you track version-gated syntax.

### Q73. Common Unicode/encoding bugs at I/O boundaries (UnicodeDecodeError, default encodings) — how do you handle text robustly?

Almost every encoding bug lives at an I/O edge: `open()`, `subprocess`, sockets, `requests`. The root cause is a *default* encoding you didn't choose. Historically `open()` used `locale.getpreferredencoding()` — cp1252 on Windows, UTF-8 on most Linux — so the same code read a file fine on the dev's Mac and raised `UnicodeDecodeError` in production on Windows. The single most impactful habit: **always pass `encoding=` explicitly.**

```python
# fragile — uses the platform default
open('data.txt').read()

# robust — explicit, deterministic everywhere
open('data.txt', encoding='utf-8').read()
```

`UnicodeDecodeError` means the bytes aren't valid in the codec you named — usually you guessed the wrong encoding, or the data is genuinely binary/corrupt. Don't paper over it with `errors='ignore'` (that silently drops data) reflexively. First confirm the *real* encoding; reach for the `errors=` handler only when you've decided how to treat bad bytes:

| handler | effect | when |
|---|---|---|
| `'strict'` | raises (default) | you want to know about bad data |
| `'replace'` | bad bytes → `` | display, lossy, never round-trips |
| `'ignore'` | drops bad bytes | rarely correct; silent loss |
| `'backslashreplace'` | `\xNN` escapes | logging/debugging raw bytes |
| `'surrogateescape'` | smuggles bytes into lone surrogates | round-tripping unknown bytes (filenames) |

`surrogateescape` is the senior's tool for filenames and other OS data of unknown encoding: undecodable bytes become lone surrogates in the `str`, and re-encoding with the *same* handler reproduces the original bytes exactly — so you can pass paths through without corrupting them.

Modern fixes worth naming: Python 3.7+ UTF-8 Mode (`PYTHONUTF8=1` or `-X utf8`) forces UTF-8 for `open()` and stdio regardless of locale; and PEP 686 makes UTF-8 mode the default in a future release. For files where you control the format, prefer `utf-8` (and `utf-8-sig` only if a BOM-emitting tool like Excel produced it). For subprocess, pass `text=True, encoding='utf-8'` rather than decoding raw bytes yourself. The architectural answer the interviewer wants: enforce the **Unicode sandwich** — decode at every input edge, keep `str` internally, encode at every output edge — so encoding is a property of your boundaries, not a recurring surprise scattered through the code.

---

## Modules, Packaging & Environments

### Summary

**What this topic covers** — This topic covers how CPython turns `import` statements into loaded module objects, how modules and packages differ, the modern packaging stack (`pyproject.toml`, build backends, wheels, sdists) that replaced `setup.py`/`distutils`, how virtual environments and tools like `pip`, `poetry`, and `uv` isolate and lock dependencies, and the runtime semantics of module caching in `sys.modules` — including the import side effects and circular-import traps that fall out of "module code runs exactly once."

**Mental model** — Think of `import x` as three steps: *find* (locate the source via `sys.path` and finders), *load/execute* (run the module's top-level code once, top to bottom), and *bind* (attach the resulting module object to a name in the importing namespace). The crucial invariant: the execute step happens **once per interpreter**, and the resulting module object is cached in `sys.modules`. Every subsequent `import` of the same name is just a dict lookup that re-binds the already-built object — no re-execution. A package is just a module backed by a directory; its `__init__.py` *is* the package's body. Packaging is a separate concern entirely: it is about producing a distributable artifact (a wheel) and declaring metadata so that someone else's `pip install` can reconstruct your importable modules in *their* environment, isolated from system Python. Keep "how do I import this" and "how do I ship this" mentally distinct — they share file layout but almost nothing else.

**Key terms**
- **Module** — a single `.py` file (or C extension) that, once executed, becomes a module object.
- **Package** — a directory of modules; a *regular* package has `__init__.py`, a *namespace* package (PEP 420) does not.
- **`sys.modules`** — the interpreter-wide cache mapping dotted names to loaded module objects; the source of import idempotency.
- **`sys.path`** — the ordered list of directories searched for top-level imports.
- **Finder / loader** — the import machinery (`importlib`) that locates a spec and executes the module.
- **sdist** — a source distribution (`.tar.gz`): your source plus metadata, built on the target machine.
- **wheel** — a built distribution (`.whl`): a zip of installable files, no build step at install time. Faster, the default.
- **Build backend** — the tool (`setuptools`, `hatchling`, `flit`, `pdm`, `maturin`) that turns source into wheels/sdists, declared in `[build-system]`.
- **`pyproject.toml`** — the PEP 517/518/621 standard project file: build system + project metadata + tool config.
- **Lockfile** — a fully-resolved, pinned, hashed dependency graph (`poetry.lock`, `uv.lock`, `requirements.txt` with hashes) for reproducible installs.
- **Virtual environment** — an isolated `site-packages` + interpreter symlink so projects don't share global dependencies.

**Why interviewers ask this** — Packaging is where juniors and seniors diverge sharply. A junior can `pip install requests` and write `import requests`; they often can't explain why a circular import sometimes works and sometimes throws `ImportError`, why their `setup.py` is "deprecated," or why CI installs differ from their laptop. A senior treats reproducibility as a first-class engineering concern: they pin and lock, they know an sdist runs arbitrary build code while a wheel doesn't (a supply-chain consideration), they understand that `import` side effects and import order create real coupling, and they can debug a `ModuleNotFoundError` by reasoning about `sys.path` and the active environment rather than randomly reinstalling. The signal interviewers want is whether you understand the *machinery* well enough to diagnose problems no Stack Overflow answer covers exactly.

**Common confusions**
- **"`__init__.py` is required for a package"** — false since 3.3; namespace packages (PEP 420) work without it. It's still the right default for regular packages.
- **"Imports re-run the module each time"** — no; the first import executes, the rest are `sys.modules` lookups.
- **"Relative imports are about the filesystem"** — they're about package position; they fail when a file is run as a script (`__package__` is unset).
- **"`pip install -e .` and `pip install .` are interchangeable"** — editable installs link your source; regular installs copy a built snapshot.
- **"Circular imports always fail"** — they fail only when a name isn't bound *yet* at the moment of access; deferring the access often fixes it.

**What follows from this topic** — Import side effects connect to the **GIL and import lock** (imports are serialized), to **testing** (monkeypatching and `sys.modules` injection), and to **startup performance** (lazy imports, `importlib`). Build backends like `maturin` tie into **C extensions and the C-API**. Dependency isolation underpins **reproducible deployment** and **typing** workflows where `mypy` resolves the same packages your runtime does.

### Q74. How does the import system work — modules vs packages, __init__.py, absolute vs relative imports, and what `if __name__ == '__main__'` is for?

`import` does three things: **find** the module (consult `sys.meta_path` finders, which for normal code walk `sys.path`), **execute** its top-level code exactly once, and **bind** a name in your namespace. The executed module object is cached in `sys.modules` keyed by its dotted name, so the second `import foo` anywhere in the process is just a dict lookup — the code does not run again.

A **module** is one `.py` file. A **package** is a directory; its `__init__.py` runs when the package is first imported and *is* the package body. Since Python 3.3, a directory without `__init__.py` is a **namespace package** (PEP 420) — useful for splitting one logical package across multiple distributions, but for a normal library you want a regular package with an explicit `__init__.py` so import behavior is unambiguous and you control the public surface.

**Absolute vs relative**: prefer absolute imports (`from myapp.db import session`) — they're unambiguous and survive file moves better. Relative imports (`from .db import session`, `from ..util import log`) resolve against the current package via `__package__`. The classic trap: relative imports break when you run a file directly (`python myapp/db.py`), because as a script `__name__ == "__main__"` and `__package__` is empty, so there's no package to be relative *to*. Run modules with `python -m myapp.db` instead.

`if __name__ == '__main__':` exists because the entry-point module is given the name `"__main__"`, while any *imported* module gets its dotted name. The guard lets a file act as both an importable library and a runnable script — the block runs only when executed directly, not when imported. It's also mandatory for `multiprocessing` on spawn-based platforms (Windows/macOS default), which re-imports the main module in child processes; without the guard you get an infinite spawn loop.

```python
# math_utils.py
def double(x): return x * 2

if __name__ == "__main__":   # runs only via `python math_utils.py`
    print(double(21))        # not when `import math_utils`
```

### Q75. Modern packaging: pyproject.toml, build backends, wheels vs sdist. What replaced setup.py / distutils?

`distutils` was removed from the standard library in **Python 3.12** (deprecated in 3.10 via PEP 632). The modern standard is `pyproject.toml`: PEP 518 introduced `[build-system]` (what tool builds your project), PEP 517 defined the build-backend interface, and PEP 621 standardized `[project]` metadata (name, version, dependencies, entry points). `setup.py` isn't *forbidden* — `setuptools` still supports it — but it's no longer the interface; it's now just one possible backend's config, and a static `pyproject.toml` is strongly preferred because it's declarative and tool-agnostic.

A minimal modern file:

```toml
[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[project]
name = "myapp"
version = "1.2.0"
requires-python = ">=3.10"
dependencies = ["httpx>=0.27", "pydantic>=2"]

[project.scripts]
myapp = "myapp.cli:main"
```

The **build backend** is pluggable: `setuptools` (legacy-compatible, ubiquitous), `hatchling` (clean default), `flit` (simple pure-Python), `pdm`, or `maturin` for Rust/PyO3 extensions. You build artifacts with the frontend `python -m build`, which produces both distribution types.

| | sdist (`.tar.gz`) | wheel (`.whl`) |
|---|---|---|
| Contents | source + metadata | pre-built, installable files |
| Install step | runs the build backend on *your* machine | unzip + copy, no build |
| Speed | slow | fast (the default pip prefers) |
| C extensions | compiled at install time (needs toolchain) | shipped pre-compiled per platform/ABI |
| Risk | executes arbitrary build code | none at install |

Pip prefers a matching wheel and falls back to the sdist. For compiled packages you publish multiple platform-specific wheels (via `cibuildwheel`); the `manylinux` tag covers broad Linux compatibility. Ship both an sdist (so source is always available) and wheels (so most users skip compilation).

### Q76. Virtual environments and dependency management: venv, pip, and modern tools (poetry, uv). Why isolate, and how do you pin/lock dependencies?

You isolate because system Python is shared: two projects needing `numpy 1.x` and `numpy 2.x` can't coexist in one global `site-packages`, and installing into the OS Python can break system tooling. A virtual environment is just a directory with its own `site-packages` and a symlink (or copy) of the interpreter; activating it puts its `bin/` first on `PATH`. The stdlib `python -m venv .venv` is the baseline — no dependency, always available.

`pip` installs into the active environment. But `pip install` alone gives you **dependency resolution**, not **reproducibility**: `requirements.txt` with loose specifiers (`httpx>=0.27`) resolves differently next week as new versions release. The fix is a **lockfile** — a fully pinned, hashed, transitive resolution. With plain pip the lo-fi version is `pip freeze > requirements.txt` (flat, no hashes by default) or `pip-tools`' `pip-compile`, which generates a hashed, annotated lock from a high-level input.

Modern tools fold env creation, resolution, and locking into one workflow:

| Tool | Lockfile | Notes |
|---|---|---|
| `venv` + `pip` | none (manual `freeze`) | stdlib baseline, always works |
| `pip-tools` | `requirements.txt` (compiled, hashed) | thin layer over pip |
| `poetry` | `poetry.lock` | mature resolver, manages `pyproject.toml` + venv |
| `uv` | `uv.lock` | Rust, 10–100× faster installs/resolution; drop-in for pip and venv |

As of 2026, **`uv`** has become the default recommendation for new projects: it manages the env, resolves and locks deterministically, caches aggressively, and is fast enough to run in CI without caching tricks. The principle is constant regardless of tool: **declare loose constraints in `pyproject.toml`, commit a strict lockfile, and install from the lock in CI/production** (`uv sync --frozen`, `poetry install`, or `pip install -r requirements.txt --require-hashes`). Pin with hashes so a compromised or yanked release can't silently substitute different bytes — that's a supply-chain control, not just reproducibility.

### Q77. Module-level code runs once on first import (caching in sys.modules) — what are the implications (import side effects, circular imports) and how do you avoid circular-import errors?

Because a module's top-level code executes exactly once and the result is cached in `sys.modules`, **module level is effectively a singleton initializer**. That's powerful and dangerous. Anything you do at import time — opening a DB connection, reading an env var, registering a signal handler, instantiating a logger — happens once, in import order, as a side effect of *someone* importing you. Heavy or impure import-time work makes startup slow and tests brittle (you can't easily reset it). The senior habit: keep module bodies cheap and declarative; do real work inside functions/classes, not at top level. If you must do expensive setup, defer it (lazy initialization, or a `get_x()` accessor).

**Circular imports** are the most common fallout. `A` imports `B` while `B` imports `A`. The mechanic: when `import A` starts, Python immediately puts a *partially populated* `A` into `sys.modules`, then runs `A`'s body. If that body imports `B`, and `B`'s body does `from A import thing` before `A` has finished defining `thing`, the lookup fails — `A` exists in `sys.modules` but the name isn't bound yet. Note `import A` (binding the module) usually survives the cycle; `from A import thing` (binding a specific attribute eagerly) is what breaks.

```python
# a.py
from b import helper          # triggers importing b mid-way through a
def thing(): ...

# b.py
from a import thing           # ImportError: 'thing' not defined yet
def helper(): return thing()
```

Fixes, in order of preference: **(1) restructure** — the cycle usually signals a missing module; extract the shared piece into `c.py` that both import. **(2) Defer the import** — move `from a import thing` *inside* `helper()` so it runs at call time, after both modules are fully loaded. **(3) Import the module, not the name** — `import a` then reference `a.thing` lazily, since the module object is in `sys.modules` even when partial. For type-only cycles, guard imports with `if TYPE_CHECKING:` and use string annotations (or `from __future__ import annotations`) so they never execute at runtime. Restructuring is the real fix; the deferred-import tricks are tactical patches that hide coupling you'd ideally remove.

---

## Testing & Tooling

### Summary

**What this topic covers** — This topic covers how senior Python engineers actually verify and maintain code: pytest as the de-facto test runner (fixtures, parametrization, markers), the `unittest.mock` library and its sharp edges (where to patch, which Mock subclass to use), testing asynchronous code, measuring and interpreting coverage, and the static-analysis toolchain — ruff/black for lint and format, mypy/pyright for types, and pre-commit to wire it all into the commit lifecycle. The throughline is *confidence per unit of effort*: which tools catch which class of bug, and where each one is blind.

**Mental model** — Think of quality tooling as a layered filter, each layer catching a different bug class at a different cost. Formatters (`black`/`ruff format`) eliminate style arguments entirely — zero bugs caught, infinite review-time saved. Linters (`ruff`) catch *lexically local* mistakes: unused imports, shadowed names, mutable default args, `==` vs `is`. Type checkers (`mypy`/`pyright`) catch *contract* mistakes across function boundaries without running code — the wrong shape passed three calls away. Tests catch *behavioral* mistakes — the code runs but computes the wrong answer. Each layer is cheaper and faster than the one above it but catches less; you want the cheap fast layers to absorb as much as possible so expensive tests focus on real logic. Coverage is a *meta-tool*: it measures which lines tests touch, not whether assertions are meaningful. A senior treats coverage as a floor and a missing-test detector, never a quality score.

**Key terms**
- **Fixture** — a pytest function (decorated `@pytest.fixture`) that supplies setup/teardown via dependency injection by parameter name.
- **Parametrize** — `@pytest.mark.parametrize` runs one test body across many input/expected pairs, each a separately-reported case.
- **Marker** — a tag (`@pytest.mark.slow`) for selecting/skipping/configuring tests via `-m`.
- **Conftest** — `conftest.py`, an auto-discovered module for fixtures/hooks shared across a directory tree.
- **Mock/MagicMock** — auto-speccing stand-in objects recording calls; `MagicMock` also implements dunder methods.
- **AsyncMock** — a Mock whose calls return awaitables, for patching coroutines.
- **patch** — `unittest.mock.patch` temporarily replaces an attribute on a target for the test's duration.
- **Coverage** — percent of lines (or branches) executed during the test run, via `coverage.py`/`pytest-cov`.
- **ruff** — a fast Rust-based linter and formatter that subsumes flake8, isort, pyupgrade, and black.
- **mypy/pyright** — static type checkers reading annotations; pyright (Pylance) is faster and stricter on inference.
- **pre-commit** — a git-hook framework running tools on staged files before each commit.

**Why interviewers ask this** — Test and tooling questions separate people who *write* code from people who *ship and maintain* it. A junior says "pytest is nicer than unittest"; a senior explains *why* — plain `assert` with rich introspection, fixtures over inheritance, parametrization replacing copy-paste. The mock question is a precise filter: the "patch where it's looked up, not where it's defined" rule trips up most candidates, and getting it right signals real debugging scars. The coverage question is a values question — a senior immediately volunteers that 100% coverage with no assertions proves nothing, that branch coverage matters more than line coverage, and that mutation testing is the real rigor. Interviewers want to hear opinions backed by tradeoffs: when you'd reach for `pyright` over `mypy`, why `ruff` replaced four tools, what pre-commit catches that CI shouldn't be the first to find.

**Common confusions**
- **"You patch the function where it's defined."** No — you patch it in the namespace where the code-under-test *looks it up*.
- **"100% coverage means the code is well-tested."** Coverage measures execution, not assertion quality; tests with no asserts still count.
- **"MagicMock and Mock are interchangeable."** Only `MagicMock` supports dunders (`__len__`, `__enter__`); plain `Mock` raises on them.
- **"AsyncMock is exotic."** Since 3.8 `patch` auto-detects async targets and substitutes `AsyncMock` for you.
- **"mypy and ruff overlap, pick one."** They catch disjoint bug classes — lint vs. types — and you want both.
- **"Fixtures are just setup functions."** They compose, have scopes, and yield for teardown — a DI system, not a `setUp`.

**What follows from this topic** — Testing async code connects directly to the asyncio and concurrency topics (event loops, `await`, `asyncio.gather`). Mocking pressure often reveals tight coupling, linking to dependency-injection and design questions. Coverage and profiling are siblings — both instrument execution — pointing toward the performance topic (`cProfile`, `tracemalloc`). Type checking ties back to typing/generics and the 3.12 type-parameter syntax. And pre-commit/CI hooks are where packaging, reproducible environments, and the broader build/deploy story begin.

### Q78. pytest vs unittest — why is pytest the modern default? Show fixtures, parametrize, and markers.

`unittest` is the stdlib's xUnit port: you subclass `TestCase`, write `self.assertEqual(...)`, and share setup through `setUp`/inheritance. It works, it ships with Python, and it's fine for tiny projects. pytest won the ecosystem because it removes ceremony: plain functions, plain `assert`, and a fixture model that beats inheritance for sharing state.

The killer feature is **assertion introspection**. You write `assert result == expected` and on failure pytest rewrites the AST to show you both operands, the diff, and the offending element — no need to learn 30 `assertX` method names. That alone replaces most of `unittest`'s API surface.

**Fixtures** are dependency injection by parameter name, with scopes and teardown via `yield`:

```python
import pytest

@pytest.fixture
def db():
    conn = connect(":memory:")
    yield conn          # everything after yield is teardown
    conn.close()

@pytest.fixture(scope="session")
def api_key():
    return "test-key"

def test_insert(db):    # pytest sees the param name, injects the fixture
    db.execute("INSERT ...")
    assert db.query("SELECT count(*)") == 1
```

Fixtures compose (a fixture can request other fixtures), have scopes (`function`/`class`/`module`/`session`), and live in `conftest.py` to be shared across a directory without imports.

**Parametrize** collapses copy-pasted tests into one body, each case reported separately:

```python
@pytest.mark.parametrize("n, expected", [(0, 1), (1, 1), (5, 120)])
def test_factorial(n, expected):
    assert factorial(n) == expected
```

**Markers** tag tests for selection. Register them in `pyproject.toml` (`[tool.pytest.ini_options] markers = [...]`) so `--strict-markers` flags typos:

```python
@pytest.mark.slow
def test_full_pipeline(): ...
# run with:  pytest -m "not slow"
```

My opinion: reach for pytest by default. The one place `unittest` still earns its keep is when you can't add a dependency — but pytest can *run* `unittest.TestCase` classes unchanged, so even a legacy codebase can adopt the runner incrementally.

### Q79. Mocking with unittest.mock: patch (decorator/context), Mock vs MagicMock vs AsyncMock, and the 'patch where it's looked up' gotcha.

`unittest.mock` gives you three things: replacement objects (`Mock`, `MagicMock`, `AsyncMock`), the `patch` family to swap attributes temporarily, and assertion helpers (`assert_called_once_with`, `.call_args`).

**Mock vs MagicMock vs AsyncMock.** `Mock` records calls and auto-creates child attributes. `MagicMock` is `Mock` plus pre-configured **dunder** methods, so it works as a context manager, supports `len()`, iteration, `__getitem__`, etc. — that's why `patch` defaults to `MagicMock`. `AsyncMock` returns an awaitable when called, so `await mock()` works; since 3.8 `patch` auto-substitutes it when the target it's replacing is a coroutine function.

| Type | Records calls | Dunders | Call returns |
|------|--------------|---------|--------------|
| `Mock` | yes | no (raises) | a `Mock` |
| `MagicMock` | yes | yes | a `MagicMock` |
| `AsyncMock` | yes | yes | an awaitable |

**patch as decorator or context manager** — both inject the mock; decorator args fill bottom-up:

```python
from unittest.mock import patch

@patch("myapp.service.requests.get")
def test_fetch(mock_get):
    mock_get.return_value.json.return_value = {"ok": True}
    assert fetch() == {"ok": True}
    mock_get.assert_called_once()

# or scoped:
with patch("myapp.service.requests.get") as mock_get:
    ...
```

**The gotcha** — patch where it's *looked up*, not where it's *defined*. If `myapp/service.py` does `from requests import get` and then calls `get(...)`, that name now lives in `myapp.service`. Patching `requests.get` does nothing — your module already bound its own reference.

```python
# service.py
from requests import get
def fetch(): return get(URL).json()

# WRONG — patches the original, not the local binding
@patch("requests.get")
# RIGHT — patches the name service actually uses
@patch("myapp.service.get")
```

This is the single most common mocking bug. The fix is mechanical once you internalize it: the patch target is `<module-under-test>.<name-as-used-there>`. A defensive habit is `import requests` then call `requests.get(...)`, which keeps the lookup on the `requests` module and makes the patch target obvious. And always pass `autospec=True` (or use `create_autospec`) so the mock rejects calls with the wrong signature instead of silently accepting anything.

### Q80. How do you test async code and measure coverage? What does high coverage NOT tell you?

**Testing async.** A coroutine does nothing until awaited inside a running event loop, so you can't just call `await` in a plain `def test`. Use `pytest-asyncio` (or `anyio`): mark the test and write it `async def`.

```python
import pytest

@pytest.mark.asyncio
async def test_fetch_user():
    user = await fetch_user(42)
    assert user.id == 42
```

Patch coroutines with `AsyncMock` so the awaited call returns a value, not a coroutine you forgot to await. Test concurrency behavior explicitly — `asyncio.gather`, timeouts, cancellation — because that's where async bugs live; a swallowed `CancelledError` or an un-awaited coroutine (which raises a `RuntimeWarning: coroutine was never awaited`) won't surface from a happy-path test. Set `asyncio_mode = "auto"` in config to drop the per-test marker.

**Coverage.** Run `pytest --cov=myapp --cov-branch`. The `--cov-branch` flag is the important one: line coverage only checks each line executed; **branch coverage** checks each edge — both the taken and not-taken side of every `if`. A line `if x: do()` can be 100% line-covered while you never test the false branch.

```toml
[tool.coverage.report]
fail_under = 85
show_missing = true
```

**What high coverage does NOT tell you.** Coverage measures *execution*, not *verification*. A test that runs every line but asserts nothing yields 100% and proves nothing. It can't tell you whether your assertions are meaningful, whether edge cases (empty input, overflow, concurrency races) exist, or whether the *spec* is right. The honest rigor is **mutation testing** (`mutmut`, `cosmic-ray`): it injects bugs — flip a `<` to `<=`, delete a line — and checks whether your tests catch them. Surviving mutants are the tests coverage flattered. I treat coverage as a floor (CI fails under ~85%) and a missing-test radar (the `show_missing` lines), never as a quality grade — and I'd rather have 80% coverage with sharp assertions than 100% with `assert response is not None`.

### Q81. The tooling stack: ruff/black (lint+format), mypy/pyright (types), and pre-commit — what does each catch that the others don't?

These are four non-overlapping layers. Confusing them is the tell of someone who's never run them in anger.

**Formatters — black / `ruff format`.** Deterministic code layout: line length, quote style, trailing commas. They catch *nothing* logically — they end every style argument in code review and make diffs minimal. `ruff format` is a near-drop-in black reimplementation; most teams now run just ruff for both lint and format.

**Linter — ruff.** Catches *lexically local* problems without type information: unused imports/variables, shadowed builtins, mutable default arguments (`def f(x=[])`), `== None`, unreachable code, bad comprehensions, import ordering. ruff replaced flake8 + isort + pyupgrade + autoflake + dozens of plugins and runs ~100x faster (Rust). This is the layer that catches the *mutable-default-arg* footgun statically.

**Type checkers — mypy / pyright.** Catch *contract* violations across boundaries by reading annotations, no execution required: passing `str` where `int` is declared, a function returning `None` on a path that's typed non-optional, calling a method that doesn't exist on the type. ruff cannot do this — it has no type model. mypy is the reference implementation; **pyright** (the engine behind Pylance/VS Code) is faster, has stronger inference, and is what I default to for editor feedback, with mypy in CI for a second opinion.

| Tool | Catches | Runs code? | Needs types? |
|------|---------|-----------|--------------|
| black/ruff format | layout | no | no |
| ruff (lint) | local lexical bugs | no | no |
| mypy/pyright | cross-boundary type bugs | no | yes (annotations) |
| pytest | behavioral bugs | yes | no |

**pre-commit** is the orchestrator, not a checker. It's a git-hook framework that runs ruff/black/mypy on **staged files** before the commit lands, so style and lint failures never reach CI or a reviewer. It catches the *human* failure mode — forgetting to run the tools — and keeps the feedback loop at commit time (seconds) instead of CI time (minutes). The pattern I ship: pre-commit runs the fast layers (format + lint, on changed files only) locally; CI re-runs everything plus mypy and the full test suite on the whole tree, because pre-commit only sees staged files and can be bypassed with `--no-verify`. Local hooks are convenience; CI is the gate.

---

## Performance, Idioms & Pitfalls

### Summary

**What this topic covers** — This topic is about writing Python that is both idiomatic and fast, and about the recurring traps that bite even experienced engineers. It spans CPython's performance model (interpreted bytecode plus C-implemented builtins), how to profile rather than guess, the idioms that happen to be both Pythonic *and* fast, the classic gotchas (mutable defaults, late-binding closures, `is` vs `==`), and the EAFP-vs-LBYL stylistic divide. The throughline: senior Python is about knowing where the interpreter overhead lives and how to push hot work into C without sacrificing readability everywhere else.

**Mental model** — Think of CPython as a dispatch loop executing bytecode, where every operation — an attribute lookup, a `+`, a list `append` — costs interpreter overhead, but the *work inside* a builtin or C extension runs at C speed with no per-iteration interpreter tax. So performance is dominated by **how many bytecode operations execute in your hot path**, not by clever algebra. A pure-Python loop over a million items pays a million rounds of dispatch; the same operation expressed as `sum(...)`, a comprehension, or a numpy vectorised call pays once to enter C and then runs flat-out. The senior move is never to micro-optimise blindly: measure with `cProfile` to find *where*, drop to `line_profiler` for *which line*, and only then decide whether to vectorise, cache, restructure the algorithm (big-O beats constants), or accept the cost. Premature optimisation distorts readable code for gains that profiling would show are irrelevant. Most "slow Python" is actually an algorithmic problem or an accidental O(n²) hiding in a `list` membership test.

**Key terms**
- **Bytecode dispatch** — the per-operation interpreter overhead; the thing builtins amortise away.
- **Vectorisation** — replacing a Python loop with a single C-level array operation (numpy, pandas).
- **Hot loop** — the small fraction of code where most runtime is spent; the only place micro-optimisation pays.
- **`cProfile`** — stdlib deterministic profiler answering "which functions cost the most?".
- **`line_profiler`** — third-party `@profile` line-level timing answering "which line in this function?".
- **`tracemalloc`** — stdlib allocation tracker for memory growth and leak hunting.
- **Mutable default argument** — a default evaluated once at `def` time and shared across calls — a classic bug.
- **Late binding** — closures capture variables by reference, resolved at call time, not definition time.
- **Interning** — CPython caches small ints (-5..256) and some strings, making `is` *accidentally* work.
- **EAFP** — "easier to ask forgiveness than permission": try the operation, catch the exception.
- **LBYL** — "look before you leap": check preconditions before acting; race-prone and verbose.
- **`functools.lru_cache`** — memoisation decorator that turns repeated pure computation into a dict lookup.

**Why interviewers ask this** — Performance and pitfalls separate engineers who *write* Python from those who *understand* it. A junior says "Python is slow, rewrite it in Go." A senior says "let me profile it — 95% of the time is in this one O(n²) membership test, swap the list for a set and we're done." The signal is discipline: do you reach for a profiler or do you guess? Do you know *why* a comprehension beats a manual loop (fewer bytecode ops, no repeated `LOAD_METHOD` for `append`) rather than treating it as a style preference? The gotchas are a second filter — every one of mutable defaults, late binding, and `is`-vs-`==` is a real production bug, and a candidate who's been burned by them and can explain the mechanism has paid their dues. Interviewers also want to see you respect readability: the senior doesn't sacrifice clarity across the whole codebase to shave microseconds off cold code.

**Common confusions**
- **"Comprehensions are just sugar with the same speed as a for-loop."** They're measurably faster — the loop and `append` are specialised into bytecode with no repeated method lookup.
- **"`is` works for comparing numbers/strings."** It works *by accident* via interning for small ints and some literals; it breaks silently for larger values. Use `==`.
- **"Optimise everything for speed."** 95% of code isn't hot; optimising it costs readability for nothing.
- **"`try/except` is expensive so avoid it."** Setting up a `try` is nearly free in CPython; only *raising* costs.
- **"Default arguments are re-evaluated each call."** They're evaluated *once*, at function definition.

**What follows from this topic** — This connects to the GIL and concurrency topics (when vectorising isn't enough, you reach for `multiprocessing`, `concurrent.futures`, or in 3.13 the free-threaded build), to memory and the data-model topics (refcounting, `__slots__`, generators for streaming), and to the testing/tooling topics (`pytest-benchmark`, `mypy`, `ruff` catching some of these gotchas statically). It's the practical capstone where the data model meets the real-world question "why is this slow, and what do I do about it?"

### Q82. Python's performance model: it's interpreted with C-implemented builtins — so what makes code slow, and what's the senior move (profile first, push hot loops into C/numpy/vectorise)?

CPython compiles your source to bytecode and runs it in an evaluation loop. Every bytecode op — `LOAD_FAST`, `BINARY_OP`, `CALL` — costs interpreter overhead. The builtins and stdlib (`sum`, `sorted`, `list.append`, `re`, `json`) are written in C, so once you're *inside* them the per-element work pays no interpreter tax. The single biggest determinant of speed is therefore **how many bytecode operations run in your hot path**. A pure-Python loop over 10⁶ elements pays 10⁶ rounds of dispatch; `sum(xs)` pays once to enter C.

That reframes "what's slow." It's rarely arithmetic — it's the *count* of Python-level operations and, far more often, the *algorithm*. The classic killer is an accidental O(n²): `if x in big_list` inside a loop. Swap `big_list` for a `set` and O(n²) becomes O(n). Big-O beats constant-factor micro-optimisation every time; no amount of vectorising rescues a quadratic.

The senior move is a discipline, not a trick:

1. **Profile first.** `cProfile` to find the hot function, `line_profiler` for the hot line. Never optimise from intuition — humans are reliably wrong about where time goes.
2. **Fix the algorithm.** Right data structure (`set`/`dict` for membership, `heapq` for top-k, `bisect` for sorted lookup) usually dwarfs everything else.
3. **Push the hot loop into C.** Vectorise with numpy, use builtins/comprehensions over manual loops, or memoise with `functools.lru_cache`.
4. **Only then reach further** — Cython, a C extension, PyPy, or the experimental 3.13 JIT.

Numpy is the canonical example: `arr * 2 + 1` does the whole array in one C call versus a Python loop doing a million dispatches. The cost is that numpy only helps for homogeneous numeric data — for heterogeneous business logic the win is restructuring and caching, not vectorising. And remember the readability budget: optimise the 5% that's hot, leave the rest clear.

### Q83. How do you profile a slow Python program — cProfile for where, line_profiler for which line, memory profilers for allocations? Don't guess.

Different tools answer different questions; reaching for the wrong one wastes time.

**Where is the time going? — `cProfile`.** Stdlib, deterministic, function-level. Run `python -m cProfile -o out.prof myscript.py`, then inspect with `pstats` or, far better, a flame graph via `snakeviz out.prof`. Sort by `cumulative` to find expensive call trees, by `tottime` to find functions slow *in themselves*. cProfile adds per-call overhead so absolute numbers inflate, but the *ratios* are what you care about. For sampling production with near-zero overhead, use `py-spy` (no code changes, attaches to a running PID).

```python
import cProfile, pstats
with cProfile.Profile() as pr:
    run_workload()
pstats.Stats(pr).sort_stats("cumulative").print_stats(20)
```

**Which line in this function? — `line_profiler`.** Once cProfile points at a function, `kernprof -l -v script.py` with `@profile` on the function gives per-line hit counts and time. This is where you discover the O(n²) `in` test or the redundant `.strip()` called a million times.

**What's allocating / leaking? — `tracemalloc` (stdlib) and `memory_profiler`.** `tracemalloc.start()`, then `take_snapshot().statistics("lineno")` shows top allocation sites; snapshot-diffing finds growth. For per-line memory use `memory_profiler`'s `@profile`. Use these when RSS climbs or you suspect a leak — often an unbounded cache, a lingering reference, or a reference cycle the cyclic GC handles late.

The meta-rule: **don't guess, measure, and measure the realistic workload.** Profilers lie about absolute time but tell the truth about proportion. Profile representative input sizes — an O(n²) bug is invisible at n=10. And `timeit` is for micro-benchmarks of small snippets, not whole programs (it disables GC and loops for statistical stability — great for "is `dict.get` faster than `try/except` here", useless for finding the hot function).

### Q84. Pythonic idioms that are also fast: comprehensions, generators, local-variable binding in hot loops, str.join, built-in functions over manual loops.

The happy truth in Python is that the idiomatic form is usually the fast one, because it pushes work into C.

**Comprehensions over manual append loops.** `[f(x) for x in xs]` is faster than building a list with `.append` in a loop — the comprehension uses specialised bytecode (`LIST_APPEND`) and avoids re-resolving `list.append` each iteration. Same for set/dict comprehensions.

**Generators for streaming.** A generator expression `sum(x*x for x in xs)` computes lazily with O(1) memory; the list version `sum([x*x for x in xs])` materialises the whole list first. For pipelines and large/infinite sequences, generators win on memory and often on time (no intermediate allocation). `itertools` (`chain`, `islice`, `groupby`) keeps this in C.

**`str.join` over `+=` concatenation.** Strings are immutable, so `s += piece` in a loop is O(n²) — each `+=` copies the whole accumulated string. `"".join(pieces)` is one pass, O(n):

```python
# O(n^2): each += copies the whole string so far
out = ""
for p in pieces: out += p
# O(n): join sizes once, copies once
out = "".join(pieces)
```

**Built-ins over hand-rolled loops.** `sum`, `min`, `max`, `any`, `all`, `map`, `sorted` run their iteration in C. `any(p(x) for x in xs)` beats a manual loop *and* short-circuits.

**Local-variable binding in hot loops.** `LOAD_FAST` (local) is faster than `LOAD_GLOBAL` / attribute lookup. In a tight loop, bind the method or function to a local once:

```python
append = result.append          # bind once
sqrt = math.sqrt
for x in data:
    append(sqrt(x))             # LOAD_FAST, not LOAD_GLOBAL + LOAD_ATTR
```

This is a genuine micro-optimisation — only do it in measured hot loops, never as a default style; it trades clarity for speed and most code isn't hot enough to justify it.

### Q85. Round up the classic gotchas in one card: mutable default args, late-binding closures, `is` vs `==` for value comparison, relying on dict order pre-3.7, shadowing builtins (list, id), float equality.

These are the bugs every Python engineer eventually ships once.

**Mutable default arguments.** The default is evaluated *once at `def` time* and shared across all calls:

```python
def add(item, bucket=[]):     # BUG: one list, shared forever
    bucket.append(item); return bucket
add(1); add(2)                # -> [1, 2], not [2]

def add(item, bucket=None):   # FIX: sentinel
    if bucket is None: bucket = []
    bucket.append(item); return bucket
```

**Late-binding closures.** Closures capture *variables*, not values, resolved at call time. The loop-in-lambda trap:

```python
fns = [lambda: i for i in range(3)]
[f() for f in fns]            # -> [2, 2, 2], all see final i
fns = [lambda i=i: i for i in range(3)]  # FIX: default-arg captures value now
```

**`is` vs `==`.** `is` is identity, `==` is value. It *accidentally* works for small ints (CPython interns -5..256) and some interned strings, then breaks silently:

```python
256 is 256      # True  (interned)
1000 is 1000    # often False — DON'T rely on it
```

Use `is` only for `None`, `True`, `False`, and sentinels. Use `==` for values.

**Dict ordering.** Insertion order is guaranteed since 3.7 (an implementation detail in 3.6, then promoted to language spec). Code targeting older runtimes can't assume it — but on any supported Python today, ordering is safe.

**Shadowing builtins.** Naming a variable `list`, `dict`, `id`, `type`, `sum`, `str` rebinds the builtin in that scope and causes baffling `TypeError`s later. `ruff`/`pylint` flag these (`A001`/`builtins` rules).

**Float equality.** `0.1 + 0.2 == 0.3` is `False` — binary float can't represent these exactly. Use `math.isclose(a, b)` (or `pytest.approx` in tests), never `==` on computed floats.

### Q86. EAFP (try/except) vs LBYL (check-first) — why is EAFP often more Pythonic and sometimes faster, and when does LBYL win?

EAFP — "easier to ask forgiveness than permission" — means just do the thing and catch the exception if it fails. LBYL — "look before you leap" — means check the precondition first. Python idiom leans EAFP, and there are good reasons.

**EAFP avoids the race (TOCTOU).** Checking then acting has a window where state changes between the check and the act — a file gets deleted, a key gets popped by another thread. `try: open(path)` has no such gap; the operation and its failure are atomic from your code's view.

```python
# LBYL: race between exists() and open(); also two filesystem hits
if os.path.exists(path):
    f = open(path)
# EAFP: atomic, idiomatic
try:
    f = open(path)
except FileNotFoundError:
    ...
```

**EAFP is often faster on the happy path.** Setting up a `try` block is nearly free in CPython (and *completely* free since the 3.11 "zero-cost exceptions" rewrite — no setup cost when nothing is raised). So when the success case dominates, `try/except` beats a check that runs every single call:

```python
# happy path pays nothing extra in 3.11+
try:
    return cache[key]
except KeyError:
    cache[key] = compute(key); return cache[key]
```

**LBYL wins when exceptions are the common case or are expensive.** *Raising* and unwinding an exception is genuinely costly. If failures are frequent — say half your lookups miss — a check (or `dict.get(key, default)`, which is purpose-built for this) is faster and clearer than catching floods of `KeyError`. LBYL also reads better when the check is cheap and meaningful (`if not items: return`) or when you'd otherwise catch an exception so broad it hides real bugs.

The senior judgement: EAFP by default, especially for I/O and anything race-prone; switch to LBYL (or a dedicated API like `dict.get`, `getattr` with default) when the "exceptional" path is actually common. And never let EAFP degenerate into a bare `except:` that swallows `KeyboardInterrupt` and masks bugs — catch the *specific* exception you expect.
