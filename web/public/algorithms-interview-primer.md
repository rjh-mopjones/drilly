---
type: interview-prep
---

# Algorithms Interview Primer — 322 Questions

The algorithms reference for the Data Structures & Algorithms track — the classic algorithm families and their analysis, concept-first and interview-focused. It sits between the Data Structures primer (the structures themselves) and the Patterns primer (recognition techniques): here you learn how each algorithm works, why it's correct, its complexity, and when to reach for it. Covers analysis & recurrences, sorting, searching, greedy, dynamic programming, graph algorithms, backtracking, strings, bit tricks, number theory, randomized algorithms, and complexity theory. Each topic opens with a Summary (mental model, key terms, core mechanics, trade-offs, common confusions, why interviewers ask) then runs ~15 question cards from warm-up to senior follow-up.

1. [[#Algorithmic Analysis & Recurrences]]
2. [[#Recursion & Divide and Conquer]]
3. [[#Comparison Sorting]]
4. [[#Linear-Time & Advanced Sorting]]
5. [[#Binary Search & Searching]]
6. [[#Greedy Algorithms]]
7. [[#Dynamic Programming Fundamentals]]
8. [[#Classic DP Problems & Patterns]]
9. [[#Graph Traversal & Topological Sort]]
10. [[#Shortest Path Algorithms]]
11. [[#Minimum Spanning Trees]]
12. [[#Advanced Graph Algorithms]]
13. [[#Backtracking & Constraint Search]]
14. [[#String Algorithms]]
15. [[#Bit Manipulation]]
16. [[#Number Theory & Mathematical Algorithms]]
17. [[#Randomized Algorithms & Selection]]
18. [[#Prefix Sums, Difference Arrays & Range Techniques]]
19. [[#Computational Geometry Basics]]
20. [[#Intractability: P, NP & Approximation]]
21. [[#Algorithm Design & Interview Playbook]]

## Algorithmic Analysis & Recurrences

### Summary

**What this topic covers**
How to answer one question about any algorithm: *"as the input gets big, how fast does the work grow?"* That is what Big-O measures — not seconds, but the **shape of the growth**. This topic builds the whole vocabulary: Big-O / Θ / Ω, why we ignore constants, best vs average vs worst case, amortized analysis (why an occasional expensive step is still cheap on average), how to turn a recursive algorithm into a **recurrence** and solve it (Master Theorem and recursion trees), space complexity, and the single most useful interview trick — reading the input size to guess the required complexity before you write any code.

**Mental model**
Big-O is a way of comparing algorithms that ignores everything machine-specific (CPU speed, language, constant factors) and keeps only how the work scales with input size `n`. Think of it as sorting algorithms into a few buckets: constant `O(1)`, logarithmic `O(log n)`, linear `O(n)`, `O(n log n)`, quadratic `O(n²)`, exponential `O(2ⁿ)`. Moving up a bucket eventually dominates any constant-factor advantage — an `O(n)` algorithm beats an `O(n²)` one once `n` is large enough, even if the `O(n²)` one is written in tight C and the `O(n)` one in Python. The whole game is: figure out which bucket your algorithm falls in, and whether that bucket is fast enough for the `n` you'll face.

**Key terms**
- **Big-O `O(...)`** — an *upper bound* on growth: "grows no faster than". The one you'll use 95% of the time.
- **Big-Theta `Θ(...)`** — a *tight* bound: upper and lower match, "grows exactly like".
- **Big-Omega `Ω(...)`** — a *lower bound*: "grows at least this fast".
- **Best / average / worst case** — the fastest, typical, and slowest input for a given `n`.
- **Amortized cost** — the average cost *per operation* across a long run, even if some single operations are expensive.
- **Recurrence** — an equation defining an algorithm's cost in terms of its cost on smaller inputs, e.g. `T(n) = 2·T(n/2) + n`.
- **Master Theorem** — a formula that solves the common "divide into `a` pieces of size `n/b`, do `f(n)` extra work" recurrences.
- **Recursion tree** — drawing out the recursive calls level by level and summing the work to solve a recurrence.
- **Space complexity** — extra memory used as `n` grows, *including* the recursion call stack.

**Core mechanics**
To find an algorithm's Big-O, count how the number of basic steps scales with `n`, then keep only the fastest-growing term and drop constants: `3n² + 100n + 7` becomes `O(n²)`. For **loops**, multiply: two nested loops over `n` is `n × n = O(n²)`; a loop that halves `n` each time is `O(log n)`. For **recursion**, write a recurrence and solve it. The Master Theorem handles the standard "split into equal parts" shape; the recursion-tree method handles the rest by summing the work at every level. Space is counted the same way, and the recursion stack counts: a function that recurses `n` deep uses `O(n)` stack even if each call uses `O(1)` locals.

**Trade-offs**
Big-O hides the constant factor, and constants matter for real, small inputs — an `O(n²)` insertion sort beats an `O(n log n)` merge sort for `n < ~16`, which is why real sort libraries switch to insertion sort on tiny pieces. Worst-case analysis is pessimistic but safe (you're guaranteed never worse); average-case is realistic but assumes an input distribution; amortized is the honest answer when costs are lumpy (a hash table insert is `O(1)` amortized even though the occasional resize is `O(n)`). Pick the lens that matches the guarantee you need.

**Common confusions**
"Big-O is the worst case" — no. Big-O is a *bound on growth*; you can state a best-case Big-O too. Worst/average/best are about *which input*; O/Θ/Ω are about *which bound*. "`O(log n)` — log of what base?" — the base doesn't matter for Big-O (changing base is just a constant factor), so we write `log n`. "Amortized means average case" — different: average case averages over *inputs*; amortized averages over a *sequence of operations* on one structure. "`O(1)` is always faster" — only asymptotically; a `O(1)` with a huge constant can lose to a small `O(n)` on real sizes.

**Why interviewers ask**
Complexity analysis is the language the rest of the interview is spoken in: you'll be asked "what's the time and space complexity?" after every problem, and "can you do better?" is a nudge to move down a bucket. The signal isn't reciting definitions — it's *reasoning*: inferring the target complexity from the constraints ("n up to 10⁵ → I need `O(n log n)` or better"), spotting that a nested loop is `O(n²)`, and knowing when the constant factor actually matters. Getting the complexity wrong makes a correct algorithm look wrong (and vice versa).

### What is the difference between Big-O, Big-Theta, and Big-Omega?

They answer *different questions* about the same function. Imagine your algorithm does `f(n)` steps.
- **Big-O `O(g)`** is an **upper bound**: `f` grows *no faster than* `g`. "It's at most this bad."
- **Big-Omega `Ω(g)`** is a **lower bound**: `f` grows *at least as fast as* `g`. "It's at least this expensive."
- **Big-Theta `Θ(g)`** is **both at once** (a tight bound): `f` grows *exactly like* `g`.

A worked example: linear search through `n` items. In the worst case it does `n` comparisons, so it's `O(n)`. It always does *at least* 1 comparison, so it's `Ω(1)`. Its worst case is *tightly* `Θ(n)` (both bounds are `n`). In everyday interview talk people say "O(n)" even when they mean the tight bound — that's fine and universally understood; reach for Θ only when the distinction matters.

### Why do we drop constants and lower-order terms?

Because Big-O is about **how the work grows**, not the exact count, and for large `n` the fastest-growing term swamps everything else. Take `f(n) = 3n² + 100n + 7`. At `n = 1000`: the `3n²` term is 3,000,000, the `100n` term is 100,000, the `7` is nothing. The `n²` part is already 97% of the total, and its share only grows. So we keep `n²` and write `O(n²)`. We drop the `3` for the same reason we ignore CPU speed: a 3× constant is a fixed multiplier that doesn't change the *bucket*. This is why an `O(n)` algorithm eventually beats an `O(n²)` one no matter the constants — growth rate wins in the end.

### What is the difference between best, average, and worst case?

These pick *which input of size `n`* you measure.
- **Best case** — the luckiest input (often useless for guarantees).
- **Worst case** — the unluckiest input; the guarantee you can promise. This is what Big-O usually refers to.
- **Average case** — expected cost over a realistic distribution of inputs.

Quicksort is the classic illustration: best `Θ(n log n)` (pivots split evenly), average `Θ(n log n)` (random pivots split well enough), worst `Θ(n²)` (every pivot is the smallest element, e.g. an already-sorted array with a naive pivot). You quote worst case when you need a guarantee and average case when the worst case is rare and you care about typical speed.

### How does average-case analysis differ from amortized analysis?

They average over different things. **Average case** averages over *many different inputs* and needs an assumption about how likely each input is. **Amortized** averages over a *sequence of operations on one data structure* and makes **no probabilistic assumption** — it's a guarantee about the total cost of the sequence. So "hash lookup is `O(1)` average case" (assuming keys hash uniformly) is a probabilistic claim, whereas "appending to a dynamic array is `O(1)` amortized" is a *worst-case guarantee over any sequence of appends* — no luck required.

### Explain amortized analysis with the dynamic array example.

A dynamic array (Python `list`, Java `ArrayList`) is a fixed block that **doubles** in size when full. Most appends just write into a free slot — `O(1)`. But when it's full, an append allocates a 2× block and copies everything over — `O(n)`. That one step looks expensive, so is append really cheap?

Yes, because the expensive copies are rare and their cost is spread thin. Doubling from 1 → n costs `1 + 2 + 4 + ... + n ≈ 2n` total copies across *all* appends. Add the `n` cheap writes and the whole sequence of `n` appends is `~3n` work, i.e. **`O(1)` per append amortized**.

```python
class DynamicArray:
    def __init__(self):
        self.data = [None]        # backing block
        self.n = 0                # number of items stored

    def append(self, x):
        if self.n == len(self.data):        # full -> grow
            new = [None] * (2 * len(self.data))   # double the capacity
            for i in range(self.n):         # O(n) copy, but rare
                new[i] = self.data[i]
            self.data = new
        self.data[self.n] = x               # O(1) common case
        self.n += 1
```

The key is doubling. If instead you grew by a fixed `+1` each time, every append copies everything and the total becomes `1 + 2 + ... + n = O(n²)` — `O(n)` amortized. Geometric growth is what makes it `O(1)`.

### What are the three methods of amortized analysis?

Three ways to prove the same "cheap on average over the sequence" result:
- **Aggregate** — bound the total cost of `n` operations, then divide by `n`. Simplest; the dynamic-array `3n / n = O(1)` above is aggregate.
- **Accounting (banker's)** — charge each cheap operation a little *extra* and store the surplus as "credit," then pay for expensive operations from saved credit. Each append pays 3: 1 to store itself, 2 saved to later fund copying itself and one older element.
- **Potential** — a mathematical version of accounting: define a "potential energy" function of the structure's state; the amortized cost is the actual cost plus the change in potential. Most general; used to prove splay-tree and Fibonacci-heap bounds.

For interviews, aggregate is almost always enough — just count the total work of the sequence.

### What is a recurrence relation and how do you form one?

A recurrence expresses an algorithm's cost `T(n)` in terms of its cost on **smaller inputs**, mirroring what the recursion does. You form it by reading the code: how many recursive calls, on inputs of what size, plus how much non-recursive work per call.

- Binary search recurses **once** on **half**, doing `O(1)` extra: `T(n) = T(n/2) + O(1)` → `O(log n)`.
- Merge sort recurses **twice** on **halves**, doing `O(n)` to merge: `T(n) = 2·T(n/2) + O(n)` → `O(n log n)`.
- Naive Fibonacci recurses **twice** on nearly the same size, `O(1)` extra: `T(n) = T(n−1) + T(n−2) + O(1)` → `O(2ⁿ)`.

Say it in words: "split into `a` subproblems of size `n/b`, and do `f(n)` work to split and combine." That sentence *is* the recurrence.

### State the Master Theorem and explain its three cases.

The Master Theorem instantly solves recurrences of the form `T(n) = a·T(n/b) + f(n)` — split into `a` pieces of size `n/b`, with `f(n)` extra work. Compare `f(n)` against the "leaf work" `n^(log_b a)` (how much work the recursion tree's leaves add up to):

| Case | Condition (which dominates) | Answer |
|---|---|---|
| 1 | `f(n)` smaller than `n^(log_b a)` | `Θ(n^(log_b a))` — leaves dominate |
| 2 | `f(n)` equal to `n^(log_b a)` | `Θ(n^(log_b a) · log n)` — balanced |
| 3 | `f(n)` larger than `n^(log_b a)` | `Θ(f(n))` — top level dominates |

Intuition: the recursion tree does work at every level. Either the top (the first `f(n)` call) dominates, or the bottom (all the tiny leaves) dominates, or they're balanced and every level costs the same so you multiply by the number of levels, `log n`.

### Apply the Master Theorem to merge sort.

Merge sort: `T(n) = 2·T(n/2) + O(n)`, so `a = 2`, `b = 2`, `f(n) = n`. The leaf work is `n^(log_b a) = n^(log₂ 2) = n¹ = n`. Compare: `f(n) = n` **equals** `n` — that's **Case 2**. So `T(n) = Θ(n · log n) = Θ(n log n)`.

Picture the tree: each level splits the array in half, so there are `log₂ n` levels, and every level does `O(n)` total merging work (the pieces get smaller but there are more of them). `n` work per level × `log n` levels = `n log n`.

### When does the Master Theorem NOT apply?

It only covers the "equal-size subproblems" shape, so it fails when:
- **Subproblems are unequal sizes**, e.g. `T(n) = T(n/3) + T(2n/3) + n` (quicksort-ish) — use a recursion tree or the Akra–Bazzi method.
- **`a` or `b` isn't constant**, or the split isn't by a constant factor, e.g. `T(n) = T(n−1) + n` (this is `O(n²)`, solved by expansion, not the Master Theorem).
- **`f(n)` isn't a clean polynomial**, e.g. `T(n) = 2T(n/2) + n/log n` falls in a gap between cases.

When it doesn't fit, fall back to the recursion-tree method below or just expand the recurrence a few times and spot the pattern.

### How do you solve a recurrence with the recursion-tree method?

Draw the tree of recursive calls, compute the work at each level, and sum. For `T(n) = 2·T(n/2) + n`:

```text
level 0:            n                     work = n
level 1:        n/2   n/2                 work = n
level 2:     n/4  n/4 n/4  n/4            work = n
   ...        (each level sums to n)
level log n:  1 1 1 ... 1  (n leaves)     work = n
```

Every level sums to `n`, and there are `log₂ n` levels (halving from `n` to `1`), so the total is `n × log n = Θ(n log n)`. The method generalises: if the per-level work *grows* down the tree, the leaves dominate (Master Case 1); if it *shrinks*, the root dominates (Case 3); if it's flat like here, you multiply by the depth (Case 2).

### What is space complexity and what counts toward it?

Space complexity is the **extra** memory an algorithm uses as `n` grows — usually not counting the input itself (that's a separate "auxiliary space" distinction, worth stating in an interview). It includes:
- Data structures you allocate (a hash set of the elements → `O(n)`).
- The **recursion call stack** — one frame per active call.
- Output, if you count it.

Example: iterative sum of an array is `O(1)` auxiliary (one accumulator). Merge sort is `O(n)` (the merge buffer). Recursively summing a list is `O(n)` *space* purely from the call stack, even though it computes the same thing as the `O(1)` loop.

### Does recursion depth count as space? Give an example.

Yes — each unfinished recursive call keeps a stack frame alive, so **maximum recursion depth is a space cost**. This is easy to miss.

```python
def sum_list(a, i=0):
    if i == len(a):          # base case
        return 0
    return a[i] + sum_list(a, i + 1)   # n frames deep before any returns
```

This is `O(n)` **space** (n stacked frames) even though each frame is tiny — and on a big list it will `RecursionError` (stack overflow) in Python. The equivalent loop is `O(1)` space. Balanced-tree recursion is gentler: recursing on a balanced binary tree is `O(log n)` depth, but a skewed (linked-list-shaped) tree is `O(n)`.

### How do you infer the target complexity from input constraints?

The input size tells you the complexity you're allowed — assume a machine does roughly `10⁸`–`10⁹` simple operations per second and the limit is ~1 second:

| `n` up to | Budget | Approach it hints |
|---|---|---|
| ≤ 12 | `O(n!)` | permutations, brute force |
| ≤ 20 | `O(2ⁿ)` | subsets, bitmask DP |
| ≤ 500 | `O(n³)` | Floyd–Warshall, interval DP |
| ≤ 5,000 | `O(n²)` | pairwise loops, simple DP |
| ≤ 10⁶ | `O(n log n)` or `O(n)` | sort, sliding window, hashing |
| ≤ 10⁹ | `O(log n)` or `O(√n)` | binary search on the answer, math |

Read the constraint *first*: it turns "what algorithm?" into "which of these buckets fits?", pruning most ideas before you write anything.

### If n can be up to 10⁹, what complexity must you target and why?

You cannot even *touch* every element — a single `O(n)` pass over 10⁹ items is ~1–10 seconds and usually too slow, and `O(n²)` (10¹⁸ operations) is hopeless. So `n = 10⁹` is a strong hint that the intended solution is **`O(log n)`, `O(√n)`, or `O(1)` math** — you're not meant to iterate the input. Typical moves: **binary search on the answer** (the answer is monotonic, so you probe values not elements), a **closed-form formula**, number-theoretic tricks, or `O(√n)` factorization. When you see a constraint that big, stop looking for an iteration and look for a formula or a search over the answer space.

### Is O(1) always faster than O(n) in practice?

No — Big-O describes growth *for large `n`*, and hides the constant factor. An `O(1)` operation with a giant constant (say, hashing a long string, or an `O(1)` that allocates and initialises a big table) can be slower than a small `O(n)` loop for realistic sizes. Real examples: for `n < ~16`, insertion sort's `O(n²)` beats merge sort's `O(n log n)` because its constant is tiny and it's cache-friendly; a hash lookup (`O(1)`) can be slower than scanning a 4-element array (`O(n)`) because of hashing overhead and cache misses. Big-O tells you who wins *eventually*; for small, fixed sizes, measure. The senior habit is to reason in Big-O first, then remember constants and cache behaviour when the input is small or the code is hot.

## Recursion & Divide and Conquer

### Summary

**What this topic covers**
Recursion is a function that solves a problem by calling itself on a smaller version of the same problem. **Divide and conquer** is the most important recursive pattern: split the problem into pieces, solve each piece recursively, then combine the answers. This topic covers how recursion actually runs (the call stack), how to write it correctly (base case + recursive case), how to turn a recursive idea into a recurrence and know its cost, the big divide-and-conquer examples (merge sort, binary search, Karatsuba multiplication), and the practical stuff — tail recursion, converting recursion to a loop, and when recursion is the wrong tool.

**Mental model**
Every recursion has two parts: a **base case** (a problem small enough to answer directly, no recursion) and a **recursive case** (break the problem into smaller instances of itself, call yourself, combine). The mental trick that makes recursion feel easy: **assume the recursive call already works.** Don't trace it in your head — trust that `solve(smaller)` returns the right answer, and just write the code that turns those sub-answers into the full answer. Divide and conquer is this idea applied to *balanced* splits: cut the input into (usually two) equal halves, recurse on each, and spend some work combining. The cost is captured by a recurrence like `T(n) = 2·T(n/2) + (combine work)`, which tells you the Big-O.

**Key terms**
- **Base case** — the smallest input you answer without recursing; without one you loop forever.
- **Recursive case** — reduce to a smaller instance and call yourself.
- **Call stack** — the pile of paused function calls; each recursive call adds a frame.
- **Stack overflow** — too many nested calls exhaust the stack (crash / `RecursionError`).
- **Divide and conquer** — split into subproblems, solve recursively, combine.
- **Combine step** — merging sub-answers into the whole answer; often where the real work is.
- **Tail recursion** — the recursive call is the *last* thing the function does; can run in `O(1)` stack.
- **Mutual recursion** — two functions that call each other (e.g. `isEven`/`isOdd`).

**Core mechanics**
Write the base case first, then the recursive case that shrinks the input toward the base. The machine runs it with a stack: calling a function pushes a frame (its locals and where to return); returning pops it. Divide-and-conquer algorithms recurse on parts and combine: merge sort's combine is the `O(n)` merge (this is the expensive part); binary search's "combine" is trivial (`O(1)`, just pick a half). Solve the recurrence (Master Theorem or recursion tree) for the complexity. When recursion depth is a problem, either make it tail-recursive, convert it to a loop with an explicit stack, or use memoization to cut repeated work.

**Trade-offs**
Recursion is often the *clearest* way to express tree/graph/divide-and-conquer logic — the code mirrors the structure. The costs are stack space (one frame per depth → `O(depth)` memory, and a crash risk on deep inputs) and, in languages without tail-call optimization (Python, Java), no automatic conversion to a loop. Iteration is usually faster (no call overhead) and safe from stack overflow but can be clumsier for naturally-recursive problems. Rule of thumb: recurse when the structure is recursive (trees, subdivisions) and the depth is small (`O(log n)`); prefer a loop when depth can be `O(n)`.

**Common confusions**
"Recursion is always slower/worse than iteration" — for tree-shaped problems it's clearer and the depth is only `O(log n)`; the overhead is negligible. "Divide and conquer is the same as dynamic programming" — no: D&C subproblems *don't overlap* (merge sort's halves are disjoint); DP is for *overlapping* subproblems where you cache results. "The base case is optional" — it's mandatory; without it you recurse forever. "More recursion = more elegant" — deep `O(n)` recursion overflows; sometimes a loop is simply correct where recursion crashes.

**Why interviewers ask**
Recursion is the backbone of trees, graphs, backtracking, and D&C — a huge fraction of interview problems. They want to see that you can write a clean base + recursive case, reason about the stack (space cost, overflow risk), and turn a recursive idea into a complexity via a recurrence. "Can you do it iteratively?" and "what's the space complexity including the stack?" are the standard follow-ups that separate people who *use* recursion from people who *understand* it.

### What are the two essential parts of any recursive function?

Every recursive function needs a **base case** and a **recursive case**.
- The **base case** is the smallest input you can answer immediately, with no further recursion — it stops the recursion. For factorial, that's `factorial(0) = 1`.
- The **recursive case** reduces the problem to a smaller version and calls itself, then uses that result. For factorial, `factorial(n) = n × factorial(n − 1)`.

```python
def factorial(n):
    if n == 0:            # base case: stop here
        return 1
    return n * factorial(n - 1)   # recursive case: shrink toward 0
```

The two rules that make it correct: (1) there **is** a base case, and (2) every recursive call moves **strictly closer** to it. Break either and you get infinite recursion → stack overflow.

### What is the call stack and how does recursion use it?

The call stack is the machine's pile of **paused function calls**. When function A calls B, A is paused and a **frame** for B is pushed on top — the frame holds B's local variables and the spot in A to return to. When B returns, its frame is popped and A resumes. Recursion just means the function on top is another copy of the same function.

Tracing `factorial(3)`: `factorial(3)` pushes and waits for `factorial(2)`, which pushes and waits for `factorial(1)`, which waits for `factorial(0)`. Now the stack is 4 frames deep. `factorial(0)` returns 1 (pop), `factorial(1)` returns 1 (pop), `factorial(2)` returns 2, `factorial(3)` returns 6. The **maximum depth of the stack is the space cost** — here `O(n)`.

### What causes a stack overflow in recursion and how do you prevent it?

A stack overflow happens when recursion goes **too deep** — the stack has a fixed size limit (Python defaults to ~1000 frames; the OS caps native stacks at a few MB), and exceeding it crashes. Two causes: (1) a **missing or unreachable base case** (infinite recursion), or (2) **legitimately deep** recursion, e.g. recursing over a 100,000-element linked list (`O(n)` depth).

Fixes: ensure the base case is always reached and each call shrinks the input; for genuinely deep recursion, **convert to iteration** with an explicit stack, or make it **tail-recursive** in a language that optimizes it. In Python you can raise the limit (`sys.setrecursionlimit`) as a band-aid, but the real fix is a loop:

```python
def sum_list_iterative(a):
    total = 0
    for x in a:              # O(1) stack, no overflow risk
        total += x
    return total
```

### How do you prove a recursive algorithm is correct?

By **induction**, which mirrors the recursion exactly:
1. **Base case**: show the algorithm is correct for the smallest input(s).
2. **Inductive step**: *assume* it's correct for all smaller inputs (the "inductive hypothesis"), then show that — given correct sub-answers — the combine step produces the correct full answer.

For merge sort: base case, a 1-element array is already sorted ✓. Inductive step: assume the two recursive calls correctly sort the two halves; then the merge step correctly interleaves two sorted halves into one sorted array ✓. This is the same "trust the recursive call" trick from the mental model, made rigorous — you never trace the whole thing, you just check the base and the one combine step.

### What is the divide-and-conquer paradigm?

Divide and conquer solves a problem in three steps: **divide** the input into smaller subproblems (usually equal-sized), **conquer** each by solving it recursively (base case for tiny inputs), and **combine** the sub-answers into the answer for the whole. The subproblems are **independent** (they don't share work) — that's the key difference from dynamic programming.

Classic examples and where the work lives:

| Algorithm | Divide | Combine | Cost |
|---|---|---|---|
| Merge sort | split in half | merge two sorted halves (`O(n)`) | `O(n log n)` |
| Binary search | pick a half | nothing (`O(1)`) | `O(log n)` |
| Quicksort | partition around a pivot (`O(n)`) | nothing | `O(n log n)` avg |
| Karatsuba | split digits | 3 recursive mults + adds | `O(n^1.585)` |

### What is the "combine" step and why does it matter most?

The combine step is where you stitch the sub-answers together — and it usually dominates the cost, because the divide is often trivial (just cut the array) while the combine touches all the data. In merge sort the combine (merging two sorted halves) is `O(n)` and is the *entire* reason the algorithm is `O(n log n)` rather than something cheaper. In binary search the combine is free (`O(1)`), which is exactly why it's `O(log n)` and not `O(n log n)`. When you design a D&C algorithm, the combine step's cost is the `f(n)` in the recurrence `T(n) = a·T(n/b) + f(n)` and it decides which Master Theorem case you land in — so it's the first thing to get right.

### Walk through merge sort as divide and conquer, with its complexity.

Merge sort: **divide** the array into two halves, **conquer** by recursively sorting each half, **combine** by merging the two sorted halves into one. Base case: a 0- or 1-element array is already sorted.

```python
def merge_sort(a):
    if len(a) <= 1:                  # base case
        return a
    mid = len(a) // 2
    left = merge_sort(a[:mid])       # conquer left half
    right = merge_sort(a[mid:])      # conquer right half
    return merge(left, right)        # combine

def merge(x, y):
    out, i, j = [], 0, 0
    while i < len(x) and j < len(y):
        if x[i] <= y[j]:             # <= keeps it stable (ties go left)
            out.append(x[i]); i += 1
        else:
            out.append(y[j]); j += 1
    out.extend(x[i:]); out.extend(y[j:])   # drain the rest
    return out
```

Recurrence: `T(n) = 2·T(n/2) + O(n)` (two half-size recursions + an `O(n)` merge) → `Θ(n log n)` in all cases. Micro-example: merging `[1,3]` and `[2]` → compare 1 vs 2 → take 1; compare 3 vs 2 → take 2; drain → take 3 → `[1,2,3]`. It's stable and needs `O(n)` extra space for the merge.

### Walk through binary search as divide and conquer, with its complexity.

Binary search finds a target in a **sorted** array: look at the middle; if it matches, done; if the target is smaller, recurse on the left half; if larger, recurse on the right half. Each step throws away half the array, so the "combine" is free.

```python
def binary_search(a, target, lo=0, hi=None):
    if hi is None: hi = len(a) - 1
    if lo > hi:                      # base case: not found
        return -1
    mid = lo + (hi - lo) // 2        # avoids overflow (see below)
    if a[mid] == target:
        return mid
    if target < a[mid]:
        return binary_search(a, target, lo, mid - 1)   # left half
    return binary_search(a, target, mid + 1, hi)       # right half
```

Recurrence: `T(n) = T(n/2) + O(1)` → `Θ(log n)`. Halving `n` down to 1 takes `log₂ n` steps — for a million items, only ~20 comparisons. (In practice write it as a loop to avoid the `O(log n)` stack.)

### What is Karatsuba multiplication and why is it faster than schoolbook?

Multiplying two `n`-digit numbers the schoolbook way multiplies every digit by every digit → `O(n²)`. Karatsuba is a D&C trick that does it in `O(n^1.585)`. Split each number into high and low halves: `x = a·10^m + b`, `y = c·10^m + d`. Naively `x·y` needs four half-size products (`ac`, `ad`, `bc`, `bd`). Karatsuba computes the middle term `ad + bc` from just **one** extra product using the identity `ad + bc = (a+b)(c+d) − ac − bd`, so it needs only **three** recursive multiplications instead of four: `T(n) = 3·T(n/2) + O(n)`. By the Master Theorem that's `Θ(n^(log₂ 3)) = Θ(n^1.585)`. The lesson: cutting the *number of subproblems* (4 → 3) changed the exponent — the combine work was cheap, so the leaf count dominated.

### How is divide and conquer different from dynamic programming?

Both break a problem into subproblems, but the subproblems relate differently. In **divide and conquer** the subproblems are **independent / non-overlapping** — merge sort's two halves share nothing, so you just solve each once. In **dynamic programming** the subproblems **overlap** — naive Fibonacci recomputes `fib(3)` many times — so DP *caches* each subproblem's answer (memoization or a table) to avoid the exponential blow-up. Quick test: if drawing the recursion tree shows the *same* subproblem appearing more than once, you want DP (cache it); if every subproblem is distinct, plain D&C is fine.

### How do you convert a recursive algorithm to an iterative one?

Use an **explicit stack** to replace the implicit call stack — you manually push the "work to do" and pop it in a loop. This removes stack-overflow risk and the call overhead.

```python
def inorder_iterative(root):
    result, stack, node = [], [], root
    while node or stack:
        while node:                  # go left as far as possible
            stack.append(node)
            node = node.left
        node = stack.pop()           # process
        result.append(node.val)
        node = node.right            # then go right
    return result
```

For **tail-recursive** functions the conversion is even simpler — just a loop that updates the arguments (no stack needed). The general recipe: whatever the recursion pushes on the call stack, you push on your own stack instead.

### What is tail recursion and why does it matter?

A call is **tail-recursive** when the recursive call is the *very last* action — its result is returned directly, with no further work after it. That matters because there's nothing to come back to, so a smart compiler can **reuse the current stack frame** instead of pushing a new one, running the recursion in `O(1)` stack (effectively a loop). Compare:

```python
def sum_normal(a, i=0):
    if i == len(a): return 0
    return a[i] + sum_normal(a, i + 1)    # NOT tail: must add after the call

def sum_tail(a, i=0, acc=0):
    if i == len(a): return acc
    return sum_tail(a, i + 1, acc + a[i]) # tail: nothing happens after
```

Languages with tail-call optimization (Scheme, Scala with `@tailrec`, most functional languages) run `sum_tail` in constant stack. The trick to make a recursion tail-recursive is to carry the running result in an **accumulator** argument so nothing is left to do after the call.

### Why doesn't Python optimize tail recursion, and what do you do about it?

Python (and the JVM/Java) deliberately **do not** optimize tail calls — Guido chose to keep full stack traces for debugging, so even a tail-recursive function pushes a frame per call and still overflows on deep input. So in Python, tail recursion buys you nothing for stack safety. The practical answer: **write a loop.** Any tail recursion converts mechanically to a `while` loop that updates the accumulator:

```python
def sum_loop(a):
    acc = 0
    for x in a:          # the accumulator pattern, as a loop
        acc += x
    return acc
```

Reach for recursion in Python when the depth is `O(log n)` (balanced trees, D&C); use a loop when depth can be `O(n)`.

### When is recursion the wrong choice?

Avoid recursion when: (1) the recursion depth can be `O(n)` on real inputs and the language doesn't optimize tail calls — you'll overflow (e.g. recursing down a long linked list in Python); (2) the subproblems **overlap** and you haven't added memoization — naive recursive Fibonacci is `O(2ⁿ)` and wasteful; (3) a simple loop is clearer and faster (summing an array). Recursion shines for genuinely recursive structures (trees, graphs, backtracking, D&C) with shallow depth; for flat, linear work a loop is simpler, faster, and can't overflow.

### What is mutual recursion and where does it appear?

Mutual recursion is when two (or more) functions call **each other** rather than themselves. The classic toy example:

```python
def is_even(n):
    return True if n == 0 else is_odd(n - 1)
def is_odd(n):
    return False if n == 0 else is_even(n - 1)
```

It shows up naturally in **recursive-descent parsers** (a `parse_expression` calls `parse_term` which calls `parse_factor` which can call back to `parse_expression` for a parenthesised sub-expression), in evaluating grammars, and in state machines where states transition into one another. The correctness reasoning is the same induction, just spread across the mutually-recursive functions; the shared base case (here `n == 0`) is what makes it terminate.

## Comparison Sorting

### Summary

**What this topic covers**
The sorts that order elements using only **comparisons** ("is a < b?") — bubble, insertion, selection, merge, quicksort, and heap sort. The mental model is a spectrum: the simple `O(n²)` sorts (easy, fine for tiny or nearly-sorted inputs) versus the `O(n log n)` sorts (merge, quick, heap) that scale. This topic covers how each one works with a worked example and code, their three key properties (stable? in-place? adaptive?), the `O(n log n)` "you can't beat this with comparisons" lower bound, quicksort's pivot problem, and the engineering reasons real libraries pick one over another.

**Mental model**
Sorting is putting elements in order, and a *comparison* sort is only allowed to ask "which of these two is smaller?" — it never looks at the actual values (that restriction is what caps it at `O(n log n)`). Picture two families: the **quadratic** family (bubble, insertion, selection) does a nested double-loop, placing one element per pass — dead simple, great for tiny inputs, hopeless for large ones. The **`n log n`** family (merge, quick, heap) uses divide-and-conquer or a heap to avoid the wasted comparisons. The three properties you always reason about: **stable** (equal elements keep their order), **in-place** (`O(1)` extra memory), and **adaptive** (faster on nearly-sorted input). No single sort wins all three, which is why libraries *hybridise*.

**Key terms**
- **Comparison sort** — orders using only "a < b?" checks; bounded below by `O(n log n)`.
- **Stable** — equal elements keep their original relative order (matters when sorting by a second key).
- **In-place** — uses `O(1)` (or `O(log n)` stack) extra memory, sorting within the array.
- **Adaptive** — runs faster on partially-sorted input (insertion sort is `O(n)` on sorted data).
- **Pivot** — the element quicksort partitions around.
- **Partition** — rearrange so everything `< pivot` is left of it and everything `>` is right.
- **Heapify** — build a heap in `O(n)`; the basis of heap sort.

**Core mechanics**
Bubble/insertion/selection are `O(n²)`: a nested pass moving one element into place per outer step. Insertion sort is the best of the three — adaptive (`O(n)` on nearly-sorted data), stable, in-place, tiny constant — which is why it's the base case inside industrial sorts. Merge sort splits and merges: `O(n log n)` **guaranteed**, stable, but `O(n)` extra space. Quicksort partitions around a pivot and recurses: `O(n log n)` **average**, `O(n²)` worst (bad pivots), in-place, not stable — but the fastest in practice (cache-friendly, small constants). Heap sort builds a max-heap then repeatedly extracts the max: `O(n log n)` **guaranteed** and in-place, but not stable and cache-unfriendly.

**Trade-offs**
The core tension is *worst-case guarantee vs raw speed vs space*. Quicksort is fastest and in-place but risks `O(n²)` and isn't stable. Merge sort guarantees `O(n log n)` and is stable but costs `O(n)` space. Heap sort guarantees `O(n log n)` *and* is in-place but is unstable and ~2–3× slower than quicksort (poor cache locality). The simple sorts lose asymptotically but win for `n < ~16` (tiny constant) and nearly-sorted data. Real libraries hybridise to get the best of all.

**Common confusions**
"Quicksort is `O(n log n)`" — only on *average*; its worst case is `O(n²)`, which is why pivot choice matters. Confusing **stable** with **in-place** — they're independent (heap sort is in-place but unstable; naive merge sort is stable but not in-place). Believing heap sort beats quicksort because both are `O(n log n)` — constants and cache behaviour make quicksort win. Thinking selection sort is adaptive — it always does `O(n²)` comparisons regardless of input. Assuming any sort can beat `O(n log n)` — comparison sorts can't; only non-comparison sorts (counting/radix) can, under restrictions.

**Why interviewers ask**
Sorting is the classic vehicle for testing complexity analysis, recursion, and engineering judgment in one problem. The signal isn't "can you code bubble sort" — it's "do you know *why* merge sort is stable and quicksort isn't, when `O(n²)` worst case is acceptable, and why the standard library chose what it chose." Common follow-ups: "why is quicksort preferred despite `O(n²)`?", "make quicksort's worst case unlikely", "when would you pick merge sort?", and "prove no comparison sort beats `O(n log n)`."

### What does it mean for a sort to be "comparison based"?

A comparison sort decides order using only **pairwise comparisons** — "is `a` less than `b`?" — and nothing about the elements' internal structure or value range. Bubble, insertion, selection, merge, quick, and heap sort are all comparison sorts. This generality (they work on anything with a defined ordering — numbers, strings, custom objects with a comparator) comes at a price: comparison sorts are provably bounded below by `Ω(n log n)` — they cannot be faster. Non-comparison sorts like counting sort and radix sort exploit the *actual key values* (e.g. integers in a known range) to beat that bound, but they aren't general-purpose (see the next topic).

### Why can't any comparison sort be faster than O(n log n)?

Because of a counting argument. There are `n!` possible orderings of `n` elements, and a comparison sort must be able to reach any of them. Each comparison has two outcomes (yes/no), so after `k` comparisons you can distinguish at most `2^k` cases. To tell apart all `n!` orderings you need `2^k ≥ n!`, i.e. `k ≥ log₂(n!)`. And `log₂(n!)` grows like `n log n` (Stirling's approximation). So **every** comparison sort needs at least about `n log n` comparisons in the worst case — no cleverness with comparisons alone escapes this floor. (Non-comparison sorts dodge it by *not* comparing.)

### Compare bubble, insertion, and selection sort.

All three are `O(n²)` but differ in useful ways.

```python
def insertion_sort(a):
    for i in range(1, len(a)):
        key, j = a[i], i - 1
        while j >= 0 and a[j] > key:   # shift bigger elements right
            a[j + 1] = a[j]
            j -= 1
        a[j + 1] = key                 # drop key into its slot
    return a
```

- **Bubble sort** repeatedly swaps adjacent out-of-order pairs, "bubbling" the largest to the end — stable, in-place, can stop early on sorted input (`O(n)` best case), but does the most swaps and is slowest in practice.
- **Selection sort** finds the minimum of the unsorted part and swaps it into place — in-place, **not** adaptive (always `O(n²)` comparisons), usually not stable, but does only `O(n)` swaps (handy when *writes* are expensive, e.g. flash memory).
- **Insertion sort** inserts each element into the sorted prefix (above) — stable, in-place, and **adaptive**: `O(n)` on nearly-sorted data. It's the practical winner and the base case inside real sorts.

### Why is insertion sort used inside industrial sort implementations?

Because for **small** arrays it beats the `O(n log n)` sorts despite its `O(n²)` bound. Its constant factor is tiny — a simple inner loop with excellent cache locality and branch prediction — and it's adaptive, so nearly-sorted runs cost `O(n)`. So Timsort (Python, Java objects) and introsort (C++ `std::sort`) recurse with merge/quicksort only until subarrays drop below a threshold (~16–64 elements), then finish each small piece with insertion sort. This hybrid captures insertion sort's low overhead exactly where the fancier sorts' overhead would dominate — and insertion sort is stable and in-place, so it doesn't compromise those properties.

### What does "stable" mean and when does it matter?

A sort is **stable** if elements that compare equal keep their original relative order. It matters whenever you sort by a *secondary* key. Sort records by name, then stably sort by department → within each department, names stay alphabetical. An unstable sort would scramble the first sort. It also matters when equal-key elements carry payloads you don't want reordered. Merge sort and insertion sort are stable; heap sort and typical in-place quicksort are not. This is exactly why Java uses Timsort (stable) for object arrays but a quicksort variant for primitives — equal primitives are indistinguishable, so stability is meaningless there.

### What does "in-place" mean, and is it the same as stable?

**In-place** means the sort uses only `O(1)` extra memory (sometimes `O(log n)` for the recursion stack) — it rearranges within the original array instead of allocating a copy. It is **independent** of stability. Heap sort is in-place but not stable; standard merge sort is stable but not in-place (it needs an `O(n)` merge buffer); quicksort is in-place but not stable; insertion sort is both. People conflate them because the insertion/merge examples happen to line up, but they're orthogonal: one is about **memory**, the other about **equal-element order**.

### Walk through how merge sort works and its complexity.

Merge sort recursively splits the array into halves until pieces are length 1 (trivially sorted), then **merges** pairs of sorted pieces back up. The merge takes two sorted lists and interleaves them by repeatedly taking the smaller front element — `O(n)` per level. (Full code is in the Recursion & Divide and Conquer topic.) The recurrence `T(n) = 2·T(n/2) + O(n)` gives `O(n log n)` in **best, average, and worst** case — it's not input-sensitive. It's stable (break merge ties toward the left half) but needs `O(n)` auxiliary space. That guaranteed worst case + stability make it the choice for **linked lists** (merge needs no random access) and **external / huge-data** sorts.

### Walk through how quicksort works and its complexity.

Pick a **pivot**, **partition** the array so everything less than the pivot is left of it and everything greater is right (the pivot lands in its final sorted spot), then recursively quicksort the left and right partitions.

```python
def quicksort(a, lo=0, hi=None):
    if hi is None: hi = len(a) - 1
    if lo >= hi: return a                 # base case: 0 or 1 element
    p = partition(a, lo, hi)
    quicksort(a, lo, p - 1)               # left of pivot
    quicksort(a, p + 1, hi)               # right of pivot
    return a

def partition(a, lo, hi):
    pivot = a[hi]                         # simple: last element as pivot
    i = lo                                # boundary of the "< pivot" region
    for j in range(lo, hi):
        if a[j] < pivot:
            a[i], a[j] = a[j], a[i]
            i += 1
    a[i], a[hi] = a[hi], a[i]             # put pivot in place
    return i
```

With balanced partitions the recurrence is `T(n) = 2·T(n/2) + O(n) = O(n log n)` (average). With consistently lopsided partitions (one side empty) it degrades to `T(n) = T(n−1) + O(n) = O(n²)`. It's in-place (`O(log n)` stack) and typically **not** stable, but its small constant and excellent cache locality make it the fastest general sort in practice.

### Why is quicksort O(n^2) worst case but preferred in practice?

The worst case happens when the pivot is consistently the smallest or largest element, so one partition is empty and the other has `n−1` elements — e.g. an already-sorted array with "last element as pivot." That's `O(n²)`. Yet quicksort is the default general-purpose sort because: (1) its **average** case is `O(n log n)` with a *smaller constant* than merge/heap sort; (2) it's **in-place** (no `O(n)` buffer); (3) it's extremely **cache-friendly** (it works on contiguous partitions, scanning linearly). The worst case is easy to make astronomically unlikely (randomize the pivot, or median-of-three), and industrial versions (introsort) *guarantee* `O(n log n)` by switching to heap sort if recursion gets too deep. So you get quicksort's speed with a safety net.

### How does pivot choice affect quicksort, and how do you make the worst case unlikely?

The pivot decides how balanced the partitions are, which decides the complexity. A bad, fixed choice ("always the last element") is `O(n²)` on sorted/reverse-sorted input — a real attacker can feed you exactly that. Better choices:
- **Random pivot** — pick a random index; now no *particular* input is a worst case, so it's `O(n log n)` with overwhelming probability.
- **Median-of-three** — pivot = median of first, middle, last; cheap and kills the sorted-input worst case.
- **Median-of-medians** — guarantees a good pivot in `O(n)`, making worst case `O(n log n)`, but the constant is too big to be worth it in practice.

The pragmatic combo (used by introsort): median-of-three pivot + a depth limit; if the recursion gets too deep (a sign of bad pivots), bail out to heap sort for a guaranteed `O(n log n)`.

### What is heap sort and what are its trade-offs?

Heap sort builds a **max-heap** from the array in `O(n)`, then repeatedly swaps the max (root) to the end and shrinks the heap, re-heapifying each time.

```python
import heapq
def heap_sort(a):
    h = a[:]                 # copy so we don't mutate input
    heapq.heapify(h)         # O(n) min-heap
    return [heapq.heappop(h) for _ in range(len(h))]   # n pops x O(log n)
```

Complexity: `O(n)` to build + `n` extractions × `O(log n)` = `O(n log n)` **worst case, guaranteed**, and it's **in-place** (the classic array version). The downsides: it's **not stable**, and it's ~2–3× slower than quicksort in practice because it jumps around memory (poor cache locality) and has unpredictable branches. Its niche: when you need a hard `O(n log n)` guarantee with `O(1)` extra space (which is why introsort uses it as the fallback).

### When would you choose merge sort over quicksort?

Choose merge sort when you need a **guaranteed** `O(n log n)` (no `O(n²)` risk), when you need **stability**, or when the data structure suits it: **linked lists** (merge only walks forward, no random access needed, and it can be done with `O(1)` extra space on a list), and **external sorting** of data too big for RAM (merge streams sorted runs from disk). Choose quicksort for in-memory arrays where raw speed matters and stability doesn't, and you're fine relying on randomization to avoid the worst case. Rule of thumb: arrays + speed → quicksort; linked lists, stability, or hard guarantees → merge sort.

### Which sorts are stable and which are in-place? Summarize.

| Sort | Time (avg / worst) | Stable? | In-place? | Adaptive? |
|---|---|---|---|---|
| Insertion | `O(n²)` / `O(n²)` (best `O(n)`) | yes | yes | yes |
| Selection | `O(n²)` / `O(n²)` | no | yes | no |
| Bubble | `O(n²)` / `O(n²)` (best `O(n)`) | yes | yes | yes |
| Merge | `O(n log n)` / `O(n log n)` | yes | no (`O(n)`) | no |
| Quicksort | `O(n log n)` / `O(n²)` | no | yes | no |
| Heap | `O(n log n)` / `O(n log n)` | no | yes | no |

Reading it: only insertion/bubble are adaptive; only merge is both stable and guaranteed `O(n log n)` (at the cost of space); only heap is both in-place and guaranteed `O(n log n)` (at the cost of stability and speed).

### What sorting algorithm does your language's standard library use, and why?

Real libraries hybridise to get guarantees *and* speed:
- **Python** `sorted`/`list.sort` → **Timsort**: a stable merge sort that finds already-sorted "runs" and merges them, with insertion sort for small runs. Chosen because real-world data is often partially sorted, and stability is expected.
- **Java** → **Timsort** for objects (stable, as callers expect), **dual-pivot quicksort** for primitives (fast, stability irrelevant).
- **C++** `std::sort` → **introsort**: quicksort + median-of-three, switching to heap sort past a recursion-depth limit (guaranteeing `O(n log n)`) and insertion sort for small pieces. Not stable; `std::stable_sort` is a separate call.

The theme: quicksort/merge for the bulk, insertion sort for small pieces, and a guarantee mechanism so the `O(n²)` worst case can't happen.

### Can any sort beat O(n log n)? When?

Yes — but only **non-comparison** sorts, and only under restrictions. Counting sort, radix sort, and bucket sort achieve `O(n)` by exploiting the *values* (e.g. integers in a bounded range, fixed-width keys) instead of comparing. They don't violate the `Ω(n log n)` lower bound because that bound is specifically about *comparison* sorts — these algorithms don't compare elements to each other at all. The catch: they need structured keys (small integers, fixed-length strings) and often extra space, so they're not general-purpose replacements. See the Linear-Time & Advanced Sorting topic for how they work.

### Why is selection sort rarely used despite being simple?

Because it's `O(n²)` *and* gives up the one advantage the other simple sorts have: it is **not adaptive** — it always scans the whole unsorted region to find the minimum, so it does `Θ(n²)` comparisons even on an already-sorted array, where insertion sort would finish in `O(n)`. It's also usually not stable. Its single redeeming trait is that it does only `O(n)` **swaps** (writes), which can matter when writing to memory is far more expensive than reading (e.g. certain flash/EEPROM scenarios). For almost every normal case, insertion sort dominates it — same simplicity, better on real inputs.

## Linear-Time & Advanced Sorting

### Summary

**What this topic covers**
The sorts that beat the `O(n log n)` comparison barrier — **counting sort**, **radix sort**, and **bucket sort** — by looking at the actual key *values* instead of only comparing pairs. They run in `O(n)` under the right conditions (small integer keys, fixed-width keys, uniformly-spread data). This topic covers how each works with code, exactly *why* they escape the `Ω(n log n)` lower bound (they don't compare), their conditions and space costs, plus the industrial hybrids (**Timsort**, **introsort**) and external sorting for data that doesn't fit in memory.

**Mental model**
Comparison sorts are stuck at `O(n log n)` because "is a < b?" only gives one bit of information per comparison. Non-comparison sorts cheat by using the key's *value* as an address. Counting sort: "if I know keys are integers 0–9, I can just tally how many of each and reconstruct the order — no comparisons." Radix sort: "I can't tally 32-bit integers (4 billion buckets), but I can counting-sort one digit at a time, least-significant first, and stability glues the passes together." Bucket sort: "if values are spread uniformly over a range, scatter them into buckets, sort each small bucket, concatenate." All three trade the generality of comparison sorts (which sort *anything* orderable) for speed on *structured* keys.

**Key terms**
- **Non-comparison sort** — orders using key values (as indices/digits), not pairwise comparisons; can be `O(n)`.
- **Counting sort** — tally occurrences of each key in a range `[0, k)`, then rebuild; `O(n + k)`.
- **Radix sort** — sort fixed-width keys digit by digit using a stable sub-sort (usually counting sort).
- **LSD** (least-significant-digit) — radix sort starting from the rightmost digit; **MSD** starts from the left.
- **Bucket sort** — scatter values into buckets by range, sort each bucket, concatenate; `O(n)` average for uniform data.
- **`k`** — the size of the key range (counting sort is only linear when `k = O(n)`).
- **External sort** — sorting data too big for RAM by merging sorted runs from disk.

**Core mechanics**
Counting sort needs keys in a small known range `[0, k)`: count each value into a size-`k` array, take a prefix sum to get final positions, then place each element (iterating right-to-left to stay stable) — `O(n + k)` time, `O(n + k)` space. Radix sort handles big keys by doing `d` passes of stable counting sort, one per digit, LSD-first — `O(d·(n + b))` for `d` digits in base `b`. Bucket sort splits `[min, max)` into `n` buckets, drops each element in its bucket, sorts buckets (insertion sort), and concatenates — `O(n)` average if elements spread evenly, `O(n²)` worst (all in one bucket).

**Trade-offs**
These sorts are faster than `O(n log n)` but **not general-purpose**: they need structured keys (small integers, fixed-width strings, uniformly-distributed reals) and often `O(n + k)` or `O(n·d)` extra space. Counting sort is useless if `k` is huge (sorting 64-bit IDs would need a `2^64` array). Radix sort fixes the range problem but its constant factor and `d` passes can make it lose to a well-tuned quicksort on general data, and it needs a stable sub-sort. Bucket sort assumes a uniform distribution — clustered data destroys it. So in practice comparison sorts (quicksort/Timsort) remain the default; you reach for these only when the keys fit the mould.

**Common confusions**
"Radix sort violates the `O(n log n)` lower bound" — no; that bound is for *comparison* sorts, and radix doesn't compare elements. "Counting sort is always `O(n)`" — only when `k = O(n)`; it's `O(n + k)`, so `k = 10⁹` makes it `O(k)`, i.e. terrible. "LSD radix — surely you'd sort by the most significant digit?" — LSD *must* go least-significant first and rely on each pass being stable, which is the subtle part. "Bucket sort is `O(n)`" — average case, on uniform data; adversarial input is `O(n²)`.

**Why interviewers ask**
This topic tests whether you understand *why* the `O(n log n)` bound exists and when it doesn't apply — a sign of real depth rather than memorised complexities. "You have 10 million 32-bit integers, sort them as fast as possible" is a classic that rewards "radix sort, `O(n)`" over "quicksort, `O(n log n)`." It also probes the stability requirement (radix breaks without a stable sub-sort) and the range/space trade-off (why counting sort fails on large key ranges).

### What is a comparison sort, and what is its fundamental speed limit?

A comparison sort orders elements using only "is `a` < `b`?" checks. Because each comparison yields one bit and there are `n!` possible orderings, any comparison sort needs at least about `log₂(n!) ≈ n log n` comparisons in the worst case — the `Ω(n log n)` lower bound. So merge/quick/heap sort are essentially optimal *among comparison sorts*. The only way to go faster is to **stop comparing** and instead use the key values themselves, which is exactly what counting/radix/bucket sort do — but only for keys that are structured enough (small integers, fixed-width) to be used as array indices.

### Why is O(n log n) a hard lower bound for comparison sorts?

Model any comparison sort as a **decision tree**: each internal node is one comparison with two branches (`<` or `≥`), and each leaf is a final ordering the algorithm can output. To sort correctly it must be able to produce any of the `n!` permutations, so the tree needs at least `n!` leaves. A binary tree with `n!` leaves has height at least `log₂(n!)`, and Stirling's approximation gives `log₂(n!) = Θ(n log n)`. The height is the worst-case number of comparisons, so **no comparison sort can do better than `Θ(n log n)` comparisons in the worst case**. It's a fundamental information-theoretic limit, not a failure of cleverness — and non-comparison sorts sidestep it by not building this tree at all.

### How does counting sort work and what is its complexity?

Counting sort sorts integers in a known small range `[0, k)` without any comparisons: tally how many of each value there are, then rebuild the array in order.

```python
def counting_sort(a, k):                 # a: ints in [0, k)
    count = [0] * k
    for x in a:                          # 1) tally
        count[x] += 1
    for i in range(1, k):                # 2) prefix sums -> final positions
        count[i] += count[i - 1]
    out = [0] * len(a)
    for x in reversed(a):                # 3) place right-to-left = stable
        count[x] -= 1
        out[count[x]] = x
    return out
```

Micro-example: `a = [2,0,2,1]`, `k = 3`. Tally → `[1,1,2]` (one 0, one 1, two 2s). Prefix → `[1,2,4]`. Placing gives `[0,1,2,2]`. Complexity: `O(n + k)` time and space. It's `O(n)` only when `k = O(n)`; if `k` is huge (large integers), the size-`k` count array makes it impractical — that's what radix sort fixes.

### Why must counting sort be stable, and how do you make it stable?

Stability matters because counting sort is the *sub-routine* radix sort calls on each digit — if it weren't stable, an earlier digit's ordering would be scrambled by a later pass, and radix would produce garbage. You make it stable by (1) computing **prefix sums** to know each value's ending position, and (2) placing elements by iterating the input **right-to-left**, decrementing the count each time. Right-to-left placement means equal keys are laid down in reverse-of-reverse = original order, so ties keep their relative order. (Iterating left-to-right with the same prefix-sum trick would reverse equal elements — a common bug.)

### How does LSD radix sort work, and why does starting from the least significant digit work?

LSD radix sort sorts fixed-width keys by doing one **stable counting sort per digit**, starting from the **least** significant (rightmost) digit and moving left.

```python
def radix_sort(a):                       # non-negative ints
    if not a: return a
    max_val = max(a)
    exp = 1
    while max_val // exp > 0:            # one pass per digit
        a = counting_sort_by_digit(a, exp)   # stable, on digit at 'exp'
        exp *= 10
    return a
```

Why LSD-first works: after sorting by the ones digit, the array is ordered by ones. Sorting *stably* by the tens digit orders by tens, and — because it's stable — ties on the tens digit keep their ones-digit order. Inductively, after processing all digits the array is fully sorted. Micro-example on `[170, 45, 75, 90, 2, 802]`: sort by ones → `[170,90,2,802,45,75]`; by tens → `[2,802,45,170,75,90]`; by hundreds → `[2,45,75,90,170,802]`. The stability at each step is *load-bearing* — without it the whole thing breaks.

### What is the time complexity of radix sort, and when does it beat comparison sorts?

Radix sort is `O(d·(n + b))` where `d` = number of digits and `b` = the base (bucket count, e.g. 10 or 256). For fixed-width keys (32-bit ints → `d = 4` bytes with base 256), `d` and `b` are constants, so it's effectively **`O(n)`**. It beats comparison sorts when: keys are integers or fixed-width strings, `n` is large, and `d` is small relative to `log n`. The rough rule: radix wins when `d < log₂ n` — i.e. the keys aren't too "wide" compared to how many of them there are. For sorting millions of 32-bit integers, radix (`O(n)`) clearly beats quicksort (`O(n log n)`); for a few hundred general objects, quicksort's small constant wins.

### How does bucket sort work and why is it O(n) on average but O(n^2) worst case?

Bucket sort assumes values are spread over a range (ideally **uniformly**). Split the range into `n` buckets, drop each element into its bucket, sort each bucket (insertion sort), then concatenate.

```python
def bucket_sort(a):                      # a: floats in [0, 1)
    n = len(a)
    buckets = [[] for _ in range(n)]
    for x in a:
        buckets[int(n * x)].append(x)    # value -> bucket index
    out = []
    for b in buckets:
        b.sort()                         # small; insertion sort in practice
        out.extend(b)
    return out
```

Average `O(n)`: with uniform data each bucket holds ~1 element, so sorting all buckets is `O(n)` total. Worst `O(n²)`: if the data is clustered so all `n` elements land in **one** bucket, you're just insertion-sorting `n` elements → `O(n²)`. So bucket sort is only linear when the distribution is (near-)uniform; skewed data kills it.

### When would you choose counting/radix/bucket sort over quicksort in practice?

- **Counting sort** — keys are integers in a small, known range (grades 0–100, ages 0–120, bytes 0–255). `O(n)` and dead simple.
- **Radix sort** — large volume of fixed-width integer or string keys (IDs, IP addresses, dates as `YYYYMMDD`), where `O(n)` beats `O(n log n)` and you can afford the `O(n)` extra space.
- **Bucket sort** — floating-point values known to be roughly uniform over a range.

Otherwise (general objects, arbitrary comparators, unknown ranges, unknown distributions), stick with quicksort/Timsort — the specialized sorts' preconditions don't hold, and comparison sorts' small constants and generality win.

### What is external merge sort and when do you need it?

You need it when the data is **too big to fit in RAM** (sorting a 1 TB file on a 16 GB machine). External merge sort works in two phases: (1) **run generation** — read chunks that *do* fit in memory, sort each in-RAM, write the sorted "run" back to disk; (2) **merge** — do a k-way merge of the sorted runs, streaming a little of each at a time, writing the merged output. It minimises the expensive part — disk I/O — by reading/writing each record only a few times. This is why merge sort (sequential access, mergeable) underlies database sorts and big-data frameworks, whereas quicksort (random access within a partition) is poorly suited to disk/tape.

### What is Timsort and why do Python and Java use it?

Timsort is the stable, adaptive hybrid used by Python (`sorted`/`list.sort`) and Java (object arrays). It scans for **runs** — maximal already-sorted stretches — and merges them, using insertion sort to extend short runs and clever merge rules (with a stack of pending runs kept balanced). It's `O(n log n)` worst case but `O(n)` on already-sorted or reverse-sorted input, which is common in real data (appending to a sorted list, concatenating sorted files). It's chosen because it's **stable** (callers rely on it), **adaptive** (fast on real, partially-ordered data), and has good worst-case guarantees — the best all-rounder for general object sorting.

### What is introsort and why does C++ use it instead of plain quicksort?

Introsort ("introspective sort") is C++ `std::sort`'s algorithm: it runs **quicksort** for speed, but *watches the recursion depth*; if it exceeds `~2·log₂ n` (a sign of bad pivots heading toward `O(n²)`), it **switches to heap sort** for the rest, guaranteeing `O(n log n)` worst case. It also finishes small subarrays with **insertion sort**. So it gets quicksort's average-case speed and cache-friendliness, heap sort's worst-case guarantee, and insertion sort's low overhead on tiny pieces — with the `O(n²)` risk removed. (It's not stable; `std::stable_sort` is the separate stable option.)

### Can any sort beat O(n log n)? Reconcile that with the lower bound.

Yes — counting, radix, and bucket sort achieve `O(n)`, and there's no contradiction. The `Ω(n log n)` bound is proven *specifically for comparison sorts* (algorithms whose only operation is comparing two elements). Non-comparison sorts don't compare elements to each other at all — they use the key's value directly as an array index (counting) or digit (radix), or its position in a range (bucket). By side-stepping the comparison model, they side-step its lower bound. The price is that they only work on **structured keys**; they can't sort arbitrary objects with a custom `<`, which comparison sorts do effortlessly.

### How would you sort a huge array of 32-bit integers as fast as possible?

**Radix sort** (LSD, base 256): treat each 32-bit integer as 4 bytes and do 4 stable counting-sort passes, one byte at a time. That's `O(4·(n + 256)) = O(n)` — linear in the number of integers — and beats any `O(n log n)` comparison sort at scale. Details worth mentioning: base 256 means each pass uses a 256-entry count array (cache-friendly); for **signed** integers, flip the sign bit (or handle the top byte specially) so negatives sort before positives. If the array fits in memory and you want the simplest fast option, this is the answer; if it doesn't fit, external merge sort. (If `n` were small, just use the library sort — radix's constant isn't worth it.)

### How do you sort with a custom comparator, and can you still use radix sort?

For arbitrary objects you provide a **comparator** — a function returning negative/zero/positive for `a<b`, `a==b`, `a>b` — and use a comparison sort (Timsort/introsort), which is `O(n log n)`. Radix/counting sort **cannot** use an arbitrary comparator, because they don't compare — they need the sort key to be decomposable into digits/indices. You can still use radix if you can map each object to a **fixed-width sortable key** (e.g. encode a struct as bytes such that byte-order equals your desired order — this is how databases build sort keys). But if the ordering is defined only by a comparator you can't reduce to digits, comparison sorting is your only option.

### Is stability worth the cost, and when does it actually matter?

Stability costs a little (a stable sort may need extra space, or can't use the fastest in-place quicksort), so it's worth it only when the order of equal keys carries meaning. It **matters** for: multi-key / secondary sorts (sort by date, then stably by name), preserving input order for equal elements shown to a user, and as the required sub-routine inside radix sort. It's **irrelevant** for primitives (two equal `int`s are indistinguishable — which is why Java uses unstable dual-pivot quicksort for primitive arrays but stable Timsort for objects). Rule: if you'll ever sort the same data by a second key, use a stable sort; otherwise don't pay for stability.

## Binary Search & Searching

### Summary

**What this topic covers**
Finding an element — or a *boundary* — in a sorted structure in `O(log n)` instead of `O(n)`. Binary search is deceptively simple to state and notoriously easy to get wrong: the real skill is the **loop invariant**, the **boundary variants** (lower bound, upper bound, first/last occurrence), and the leap to **binary search on the answer** (parametric search), where you binary-search over a *value range* using a monotonic predicate rather than over array indices. The topic also covers the search cousins — exponential, interpolation, ternary — and the two bugs that plague every implementation: off-by-one on the boundary, and integer overflow in the midpoint.

**Mental model**
Think of guessing a number between 1 and 100 where each guess is answered "higher" or "lower". Guessing 50 halves the possibilities no matter what the answer is; seven guesses is enough. That's binary search: **every comparison must eliminate half the remaining candidates**. The deeper idea is that the array isn't the point — the *sortedness* is. Any structure where you can ask a yes/no question whose answer is `no no no yes yes yes` along a line is searchable this way. A sorted array is just the most familiar such line; "is capacity `C` enough to ship everything in 5 days?" is another, and it lives on the number line of capacities, not on any array.

**Key terms**
- **Loop invariant** — a property true before and after every iteration; here: "if the target exists, it is inside the current interval."
- **Lower bound** — the first index whose value is `≥` target (where the target would be inserted, leftmost).
- **Upper bound** — the first index whose value is `>` target (insertion point, rightmost).
- **Monotonic predicate** — a boolean `f(x)` that is `false…false, true…true` across the range (or the reverse); the precondition for searching an answer space.
- **Parametric search / binary search on the answer** — binary-searching the *space of possible answers*, guided by a feasibility check.
- **Exponential (galloping) search** — double a bound until you overshoot, then binary-search the window.
- **Interpolation search** — guess the probe position by linear estimation on the *value*, not the midpoint.
- **Ternary search** — locate the extremum of a unimodal function by probing two points and discarding a third.
- **Half-open interval** — a range `[lo, hi)` that includes `lo` but excludes `hi`; the convention that makes boundary searches cleanest.

**Core mechanics**
Classic binary search keeps a candidate interval and halves it each step: compute `mid = lo + (hi - lo) // 2`, compare `a[mid]` to the target, discard the half that provably can't contain it. The invariant — "if the target exists, it's within the current interval" — is what guarantees correctness; every iteration must preserve it. Time `O(log n)` — each step halves what's left, so 1,000,000 items take about 20 steps — and `O(1)` space when iterative. The recurrence is `T(n) = T(n/2) + O(1) = O(log n)`. Boundary variants change only the comparison and which pointer moves: `lower_bound` pushes `lo` past values `<` target; `upper_bound` pushes `lo` past values `≤` target. For binary search on the answer, define `feasible(x)` that is monotonic in `x`, then binary-search the smallest (or largest) `x` where it holds — the "sorted array" is conceptual: it's the truth table of the predicate.

**Trade-offs**
Binary search needs sorted (or monotonically structured) data. If you must sort first that costs `O(n log n)`, so for a *single* lookup on unsorted data a linear scan wins outright. It pays off decisively for repeated lookups on static sorted data. Interpolation search averages `O(log log n)` on uniformly-distributed keys but degrades to `O(n)` on skewed input; binary search's `O(log n)` is unconditional, which is why it's the safe default. Hash tables give `O(1)` average point lookups but lose ordering and range queries — binary search keeps both. And on a sorted *array*, inserts are `O(n)`, so churning data wants a balanced tree instead.

**Common confusions**
The off-by-one wars: `lo <= hi` versus `lo < hi`, `hi = mid` versus `hi = mid - 1`. The fix is to pick one invariant and derive everything from it, not to guess-and-check until the tests pass. Computing `mid = (lo + hi) // 2` overflows for large indices in fixed-width integer languages — write `lo + (hi - lo) // 2`. Candidates think binary search only works on arrays; the real power is on the *answer space*. And they forget the data must be **monotonic with respect to the predicate** — binary search on a non-monotonic predicate silently returns garbage rather than failing loudly.

**Why interviewers ask**
Binary search is the ultimate "simple until it isn't" filter: anyone can state it, few write it bug-free first try, and fewer still recognise a problem that is secretly a binary search on the answer. The classic escalation goes "find the element" → "find the first element `≥ x`" → "minimise the maximum load across `k` partitions" — the same `log n` idea in progressively better disguises. It tests invariant reasoning and the ability to spot monotonic structure where none is advertised.

### Why is binary search O(log n) and linear search O(n)?

Linear search checks elements one at a time, so in the worst case (target absent, or last) it does `n` comparisons — `O(n)`. Binary search halves the remaining search space with each comparison: `n`, `n/2`, `n/4`, … down to 1. The number of halvings needed to reach a single element is `log₂ n`, hence `O(log n)`; the recurrence is `T(n) = T(n/2) + O(1)`.

In concrete numbers: on a **billion** sorted elements binary search needs about **30** comparisons (`2³⁰ ≈ 10⁹`), while linear search needs up to a billion — and doubling the data adds exactly *one* comparison. The catch is the precondition: binary search demands sorted data, linear search works on anything.

### State the binary search loop invariant and why it matters.

The invariant is: **"if the target exists, it lies within the current interval `[lo, hi]`."** Every iteration must preserve it — when you throw away a half you must be *certain* the target cannot be there. If `a[mid] < target`, then `a[mid]` and everything left of it are too small, so `lo = mid + 1` is safe.

```python
def binary_search(a, target):            # a sorted ascending
    lo, hi = 0, len(a) - 1               # invariant: answer, if any, in [lo, hi]
    while lo <= hi:                      # non-empty closed interval
        mid = lo + (hi - lo) // 2        # overflow-safe midpoint
        if a[mid] == target:
            return mid
        if a[mid] < target:
            lo = mid + 1                 # a[lo..mid] all too small - discard
        else:
            hi = mid - 1                 # a[mid..hi] all too big - discard
    return -1                            # interval empty: target absent
```

Trace `a = [1, 3, 5, 7, 9, 11]`, `target = 9`. Start `lo=0, hi=5`, `mid=2`, `a[2]=5 < 9` → `lo=3`. Now `mid=4`, `a[4]=9` → return `4`. Two comparisons for six elements.

Making the invariant explicit is the whole trick: it tells you whether the loop condition is `<=` or `<`, and whether a pointer moves to `mid` or `mid ± 1`. Bugs come from violating it, never from the concept.

### How do you avoid the integer overflow bug in the midpoint calculation?

The naive `mid = (lo + hi) / 2` overflows when `lo + hi` exceeds the maximum integer — a real bug that lived in Java's `Arrays.binarySearch` for nine years. With 32-bit signed ints the ceiling is about `2.1 × 10⁹`, so two indices past ~1.07 billion sum to a *negative* number, and a negative index either throws or reads memory it shouldn't.

The fix is `mid = lo + (hi - lo) / 2` — mathematically identical for `lo ≤ hi`, but the subtraction `hi - lo` is bounded by the array length, so nothing can overflow. Java also offers the unsigned shift `(lo + hi) >>> 1`, which reinterprets the overflowed sum as unsigned and still yields the correct midpoint. Python's integers are arbitrary-precision so it's a non-issue there, but write the safe form anyway: in Java, C, C++ or Rust it's a genuine trap and interviewers watch for it.

### What is the difference between lower bound and upper bound?

Both answer "where does the target belong?" in a sorted array that may contain duplicates. **Lower bound** returns the first index whose value is `≥` target — the leftmost insertion point that keeps order. **Upper bound** returns the first index whose value is `>` target — the rightmost such position. If the target is present, `lower_bound` points at its first occurrence and `upper_bound` one past its last, so `upper_bound - lower_bound` is exactly the **count** of equal elements.

```python
def lower_bound(a, target):              # first index with a[i] >= target
    lo, hi = 0, len(a)                   # half-open [lo, hi); hi = len is legal
    while lo < hi:
        mid = lo + (hi - lo) // 2
        if a[mid] < target:              # strictly less -> not a candidate
            lo = mid + 1
        else:
            hi = mid                     # a[mid] is a candidate; keep it
    return lo                            # == hi; may be len(a)

def upper_bound(a, target):              # first index with a[i] > target
    lo, hi = 0, len(a)
    while lo < hi:
        mid = lo + (hi - lo) // 2
        if a[mid] <= target:             # only change: <= instead of <
            lo = mid + 1
        else:
            hi = mid
    return lo
```

Micro-example: `a = [1, 2, 2, 2, 5]`, `target = 2`. `lower_bound` → `1`, `upper_bound` → `4`, so there are `4 - 1 = 3` twos. For `target = 3` both return `4` (the insertion point), and the empty span tells you 3 is absent. Both are `O(log n)`. Learn this half-open template as your default — most binary-search questions are a lower bound in disguise.

### How do you find the first and last occurrence of a value with duplicates?

Run two boundary searches. **First occurrence** = `lower_bound(target)`, valid only if that index is in range and the value there actually equals the target. **Last occurrence** = `upper_bound(target) - 1`, valid only if the span is non-empty.

```python
def first_last(a, target):
    lo = lower_bound(a, target)
    if lo == len(a) or a[lo] != target:  # target not present at all
        return (-1, -1)
    hi = upper_bound(a, target) - 1
    return (lo, hi)
```

On `a = [5, 7, 7, 7, 8, 8, 10]` with `target = 7`: `lower_bound` → `1`, `upper_bound` → `4`, so the answer is `(1, 3)`. With `target = 6`: `lower_bound` → `1`, but `a[1] = 7 ≠ 6`, so `(-1, -1)`.

Two `O(log n)` searches is still `O(log n)` — roughly 40 comparisons on a million elements. The point to internalise: a plain binary search returns *some* matching index, wherever the halving happened to land, not a boundary. Only the lower/upper-bound variants pin the extremes down deterministically.

### What is "binary search on the answer" and when do you use it?

Instead of searching over array indices, you binary-search over the **space of possible answers**, guided by a feasibility predicate. It applies when two conditions hold: (1) the answer is a number in a known range `[lo, hi]`, and (2) there's a predicate `feasible(x)` that is **monotonic** — if `x` works, every larger `x` also works (or every smaller one, for a maximisation).

The analogy: you're not looking for an item on a shelf, you're finding the temperature at which water boils by testing temperatures. You can't enumerate every candidate, but each test says which direction to go, and "does it boil?" only flips once.

The recipe is always the same three steps: bound the answer range, write `feasible(x)`, then run the *exact* `lower_bound` template over values instead of indices — `if feasible(mid): hi = mid else: lo = mid + 1`. Cost is `O(log(range) × cost_of_feasible)`; the range enters only logarithmically, so a billion candidate values cost ~30 feasibility checks. The tell in a problem statement is **"minimise the maximum"** or **"maximise the minimum"** with a condition you can check directly.

### Give a concrete example of parametric search / binary search on the answer.

"Ship all packages within `D` days; find the minimum ship capacity." The answer is a capacity, and it must lie between `max(weights)` (you must carry the heaviest package) and `sum(weights)` (one giant day). `feasible(cap)` = "can we deliver everything in `≤ D` days if no day exceeds `cap`?" — answered by a greedy `O(n)` scan.

```python
def ship_within_days(weights, D):
    def feasible(cap):                   # greedy: fill each day as full as possible
        days, load = 1, 0
        for w in weights:
            if load + w > cap:           # start a new day
                days += 1
                load = 0
            load += w
        return days <= D

    lo, hi = max(weights), sum(weights)  # answer is somewhere in here
    while lo < hi:
        mid = lo + (hi - lo) // 2
        if feasible(mid):
            hi = mid
        else:
            lo = mid + 1
    return lo
```

Worked micro-example: `weights = [1, 2, 3, 4, 5]`, `D = 2`. The range starts as `[5, 15]`.

- `mid = 10` → days `[1,2,3,4]` and `[5]` = 2 days, feasible → `hi = 10`.
- `mid = 7` → days `[1,2,3]`, `[4]`, `[5]` = 3 days, infeasible → `lo = 8`.
- `mid = 9` → days `[1,2,3]` and `[4,5]` = 2 days, feasible → `hi = 9`.
- `mid = 8` → days `[1,2,3]`, `[4]`, `[5]` = 3 days, infeasible → `lo = 9`.

`lo == hi == 9`, so the answer is **9**.

Total cost `O(n log(sum))` — an `O(n)` greedy check times about `log₂ 10 ≈ 4` iterations here, ~30 for realistic sums. Classics with the identical shape: Koko eating bananas (minimum eating speed), splitting an array to minimise the largest subarray sum, "smallest divisor given a threshold," and allocating books to students.

### What monotonicity condition must hold for binary search on the answer to be correct?

`feasible(x)` must be **monotonic** over the answer range: once it flips from false to true it never flips back. Formally, for a minimisation problem, `feasible(x) ⟹ feasible(x')` for all `x' ≥ x`. That guarantees exactly **one** boundary between the false region and the true region — and locating a single boundary is precisely what binary search does.

Sanity-check it the same way every time: argue that a larger `x` can *simulate* whatever a smaller `x` did. In the shipping example, any schedule valid at capacity `C` is still valid at `C + 1` — every day's load is still under the cap — so feasibility can only improve. That one sentence is the proof, and it's what an interviewer wants to hear.

If the predicate isn't monotonic — say it reads `false, true, false, true` — binary search still terminates and still returns *a* boundary, just not the one you want. It fails **silently**: the code looks right, passes small tests, and is wrong on the case that matters. Always verify monotonicity first.

### What is exponential search and when is it better than plain binary search?

Exponential search (galloping, or doubling search) finds a bracket first, then binary-searches inside it. Start with `bound = 1` and double — 1, 2, 4, 8, 16 — until `a[bound]` exceeds the target or you run off the end. The target must then lie in `[bound // 2, bound]`, a window you binary-search normally.

```python
def exponential_search(a, target):
    if not a: return -1
    if a[0] == target: return 0
    bound = 1
    while bound < len(a) and a[bound] < target:
        bound *= 2                       # 1, 2, 4, 8, ... gallop past the target
    lo = bound // 2
    hi = min(bound, len(a) - 1)          # target, if present, is in [lo, hi]
    while lo <= hi:                      # ordinary binary search on the window
        mid = lo + (hi - lo) // 2
        if a[mid] == target: return mid
        if a[mid] < target: lo = mid + 1
        else: hi = mid - 1
    return -1
```

It runs in `O(log i)` where `i` is the target's *position*, beating `O(log n)` when the target is near the front: finding item 10 in a million-element array takes ~4 doublings plus ~4 binary steps instead of ~20. Its real justification is **unbounded or unknown-length** sorted sequences — streams, infinite arrays, paginated APIs. You cannot compute a midpoint without a right endpoint, so you gallop to manufacture one.

### What is interpolation search and what is its complexity?

Interpolation search improves on binary search for **uniformly distributed numeric keys** by *guessing* where the target should be rather than always probing the middle. It's how you actually use a phone book: looking up "Smith" you open near the back, not at the halfway point.

Replace the midpoint with a linear estimate: `pos = lo + (target - a[lo]) * (hi - lo) // (a[hi] - a[lo])`. On `a = [10, 20, 30, …, 100]` searching for 70, the formula lands directly on index 6 — one probe, where binary search would take four.

On uniform data it averages `O(log log n)` — about 5 probes for a million elements versus 20. But the estimate assumes even spacing, and on skewed data like `[1, 2, 3, 4, 1000000]` it degrades to `O(n)`, crawling one position at a time. It also needs numeric keys you can do arithmetic on, and you must guard the division when `a[hi] == a[lo]`. Binary search's `O(log n)` is distribution-independent, which is why it's the default and interpolation search is a niche optimisation.

### What is ternary search and when do you use it?

Ternary search finds the **extremum** (peak or trough) of a **unimodal** function — one that strictly increases then strictly decreases, or vice versa. Note the difference from everything above: it locates a maximum or minimum, not a known value.

Probe two points `m1 = lo + (hi - lo)/3` and `m2 = hi - (hi - lo)/3`. If `f(m1) < f(m2)` (seeking a maximum), the peak cannot be left of `m1` — a unimodal function already past its peak at `m1` could not rise again by `m2` — so set `lo = m1`. Otherwise set `hi = m2`. Each iteration discards a third of the range.

Micro-example: maximise `f(x) = -(x - 3)²` on `[0, 6]`. Probes at 2 and 4 both give `-1` — a tie, so either end can go; take `hi = 4`. Next probes on `[0, 4]` are ~1.33 and ~2.67, giving `-2.79` and `-0.11`, so `lo` moves right. The interval keeps closing on 3, the true peak.

It runs in `O(log n)` probes with base `3/2`, so it needs *more* function evaluations per unit of progress than binary search's base 2 — roughly 1.7× as many. Use it for optimising unimodal cost functions, continuous or discrete. Never use it to find a value in a sorted array; binary search is strictly better there. Unimodality is a hard precondition — on a two-peaked function it converges to a local extremum.

### How do you binary search a rotated sorted array?

A rotated sorted array such as `[4, 5, 6, 7, 0, 1, 2]` is a sorted array cut at one pivot and swapped. The key observation: **at every step, at least one of the two halves is still properly sorted** — you can't cut a sorted array once and break both sides.

```python
def search_rotated(a, target):
    lo, hi = 0, len(a) - 1
    while lo <= hi:
        mid = lo + (hi - lo) // 2
        if a[mid] == target:
            return mid
        if a[lo] <= a[mid]:              # left half [lo, mid] is sorted
            if a[lo] <= target < a[mid]: # target inside that sorted range?
                hi = mid - 1
            else:
                lo = mid + 1
        else:                            # right half [mid, hi] is sorted
            if a[mid] < target <= a[hi]:
                lo = mid + 1
            else:
                hi = mid - 1
    return -1
```

Trace `a = [4,5,6,7,0,1,2]`, `target = 0`. `lo=0, hi=6, mid=3`, `a[3]=7`; `a[0]=4 ≤ 7` so the left half is sorted, and `0` is not in `[4, 7)` → `lo = 4`. Now `mid=5`, `a[5]=1`; `a[4]=0 ≤ 1` so that left half is sorted and `0` *is* in `[0, 1)` → `hi = 4`. Then `mid=4`, `a[4]=0` → return `4`.

Still `O(log n)`: you discard half every step. Rotation preserves enough local sortedness to keep the discard rule valid — you just decide *which* half to test by first working out which one is monotonic. Caveat: with **duplicates** (`[1,1,1,0,1]`), `a[lo] == a[mid]` tells you nothing, and the fallback of incrementing `lo` makes the worst case `O(n)`.

### Why choose `lo < hi` vs `lo <= hi`, and how do you pick termination?

The two styles correspond to two different invariants, and everything else follows from the choice.

`while lo <= hi` searches a **closed** interval `[lo, hi]` where every index including `hi` is a live candidate. You exit when `lo > hi` — the interval is empty, the target is absent. Pointers must move to `mid + 1` / `mid - 1`, because `mid` has been examined and excluding it is what guarantees progress. Use this for exact-match search returning an index or `-1`.

`while lo < hi` searches a **half-open** interval `[lo, hi)` and converges `lo` and `hi` onto a single boundary index, which it returns. Here `hi = mid` (not `mid - 1`), because `mid` might itself be the answer — you're narrowing, not excluding. Progress still holds because floor division keeps `mid < hi`. Use this for lower/upper bound and for binary search on the answer.

The failure modes: mixing conventions — `while lo <= hi` with `hi = mid` — **infinite-loops** when `lo == hi` and the predicate keeps sending you left, since `mid` stays equal to `lo` and `hi` never changes. Symmetrically, `while lo < hi` with `hi = mid - 1` can skip the answer. And if you ever pair `hi = mid` with `lo = mid`, you must round the midpoint *up* (`mid = lo + (hi - lo + 1) // 2`) or `lo` never advances past `hi - 1`. The rule: **pick the invariant first**, and the loop condition, pointer updates and return value are all forced. Consistency, not memorisation.

### When is binary search the wrong choice?

Four situations. **Unsorted data queried once** — sorting first costs `O(n log n)`, so a single `O(n)` linear scan is cheaper; only amortise the sort across many lookups. **Frequently changing data** — keeping a sorted array sorted costs `O(n)` per insert from the shifting, swamping the `O(log n)` you saved; a balanced BST (`O(log n)` insert *and* search) serves better. **Pure membership with no ordering needs** — a hash table's expected `O(1)` beats `O(log n)`. **Tiny inputs** — below roughly 30–50 elements a linear scan often wins on wall-clock time thanks to branch prediction and cache locality, despite losing asymptotically.

And the fundamental one: binary search requires **monotonic structure**. No sorted order, no monotonic predicate, no binary search — the technique simply doesn't apply, and forcing it produces confidently wrong answers.

### How does binary search compare to a hash table for lookups?

Hash tables give **expected `O(1)`** point lookups; binary search on a sorted array gives **`O(log n)`**. For pure "is `x` present?" on a static set, the hash table is asymptotically faster, and in practice usually faster too.

But binary search wins on everything **order-related** — operations a hash table cannot do without a full `O(n)` scan:

- **Range queries** — "all values between `a` and `b`" is `lower_bound(a)` to `upper_bound(b)`, `O(log n + k)` for `k` results.
- **Successor / predecessor** — "smallest value greater than `x`" is one `upper_bound` call.
- **Order statistics** — the k-th smallest is just index `k`.
- **Iteration in sorted order** — free; a hash table would need to sort first.

Binary search also has better **worst-case** guarantees — `O(log n)` always, whereas hashing degrades toward `O(n)` under adversarial collisions (hash-flooding attacks) — and a contiguous sorted array has excellent **cache locality** with no per-entry overhead, while a hash table carries load-factor slack and pointer chasing. Choose by *access pattern*: membership only → hash table; ordering, ranges or predecessor queries → sorted array plus binary search, or a balanced tree if the data also changes.

## Greedy Algorithms

### Summary

**What this topic covers**
Algorithms that build a solution one step at a time, always taking the locally best-looking option and never reconsidering. The paradigm is trivially easy to *code* and treacherous to *justify*: the difficulty is proving that locally optimal choices compose into a globally optimal result. This topic covers the two properties that make greedy correct (**greedy-choice property** and **optimal substructure**), the **exchange argument** used to prove it, canonical wins with code (interval scheduling, Huffman coding, fractional knapsack, MST), and the canonical failures (0/1 knapsack, coin change with arbitrary denominations) where greedy plausibly-but-wrongly seems right.

**Mental model**
Think of a hiker reaching for the highest peak by always walking uphill. On a single smooth hill, "always go up" reaches the top. On a bumpy range it strands you on a foothill, with the real summit across a valley you refused to descend into. Greedy algorithms are "always walk uphill": no memory, no lookahead, no backtracking. Dynamic programming is the hiker who surveys every route before committing — slower, never stranded. So the question is never "does greedy run fast?" (it always does) but "can I *prove* this landscape has no foothills?"

**Key terms**
- **Greedy choice** — commit to the best immediate option, with no lookahead and no backtracking.
- **Greedy-choice property** — some globally optimal solution contains the greedy first choice, so committing to it loses nothing.
- **Optimal substructure** — an optimal solution to the whole is built from optimal solutions to subproblems.
- **Exchange argument** — the standard proof: transform any optimal solution into the greedy one, swap by swap, without ever making it worse.
- **Greedy-stays-ahead** — the other standard proof: induct that the greedy's partial solution is at least as good as any rival's at every step.
- **Matroid** — the algebraic structure that guarantees greedy optimality (deep background, rarely required in interviews).
- **Fractional vs 0/1** — whether you may take part of an item; fractional is greedy-solvable, 0/1 is not.
- **Approximation ratio** — how far a non-optimal greedy can provably stray from the optimum (e.g. `2×` for list scheduling).

**Core mechanics**
The recipe is three lines: (1) sort or order candidates by a greedy criterion; (2) iterate, taking each candidate that doesn't break feasibility; (3) never undo. Cost is usually dominated by the sort — `O(n log n)`, meaning the work grows a little faster than the input size — plus a linear pass. Correctness rests on two pillars. **Greedy-choice property**: prove some optimal solution *agrees with* the greedy choice, so making it sacrifices nothing — typically via an exchange argument, showing any optimal solution that differs can be edited to match the greedy pick without getting worse. **Optimal substructure**: after committing the greedy choice, what remains is a smaller instance of the same problem, so induction carries optimality through. If either pillar fails, greedy fails.

**Trade-offs**
Greedy versus dynamic programming: greedy commits immediately and never revisits, so it's faster (often `O(n log n)` against DP's `O(n·W)` or `O(n²)`, "n squared" meaning doubling the input quadruples the work) and uses `O(1)`–`O(n)` space — but only when the greedy-choice property holds. DP explores and combines subproblem solutions: slower and heavier, but correct for the broader class where a local choice can be globally wrong. Rule of thumb: try to prove greedy correct; if you can't produce an exchange argument, fall back to DP. Greedy is a *special case* of what DP solves — when greedy works, DP would work too, just wastefully.

**Common confusions**
The cardinal error is assuming greedy works because it *feels* obvious — 0/1 knapsack by value density looks right and is wrong. Candidates confuse "I found a greedy that passes the examples" with "I proved it optimal"; passing tests is not a proof. Interval scheduling: the key is *earliest finish time*, not shortest duration and not earliest start. Coin change is greedy-optimal for canonical coin systems (US coins) but not arbitrary ones — `[1, 3, 4]` making 6 breaks it. And the greedy-choice property is not optimal substructure: a problem can have the second without the first, which is precisely the DP-only class.

**Why interviewers ask**
Greedy problems test *judgment and proof*, not coding — the code is five lines; the question is "why is this correct, and how do you know it's not one of the cases where greedy fails?" Interviewers want to see you propose a greedy, then either prove it with an exchange argument or spot the counterexample that kills it. The signature follow-up is "are you sure? construct an input where that fails" — and the strong candidate either defends with a proof sketch or immediately reaches for DP.

### What defines a greedy algorithm?

A greedy algorithm builds a solution incrementally, at each step making the choice that looks best *right now* by some local criterion, and never reconsidering. No backtracking, no lookahead, no exploring alternatives. Think of filling a shopping basket on a fixed budget by always grabbing the best-value item on the shelf and never putting anything back.

Because it commits immediately, it's fast — usually dominated by an initial sort, `O(n log n)`, meaning the running time grows just a little faster than the number of items. The entire subtlety is correctness: a greedy is valid only if those local choices provably compose into a globally optimal solution, which is *not* guaranteed for most problems. Coding a greedy is easy; justifying it is the real work, and the justification is what an interviewer grades.

### What two properties must a problem have for greedy to be optimal?

First, the **greedy-choice property**: there exists a globally optimal solution that makes the same first choice the greedy algorithm makes — so committing to the greedy choice never forecloses optimality. Second, **optimal substructure**: after making that choice, what remains is a smaller instance of the same problem, and an optimal solution to the whole is the greedy choice plus an optimal solution to the remainder.

Together they license an induction: the greedy first move is safe, and by induction the greedy solution to the rest is optimal, so the whole is optimal. Concretely for interval scheduling — pick the meeting that ends earliest (safe first move), then face the identical problem on the meetings starting after it ends (smaller instance of the same problem), and repeat. If either property is absent, greedy quietly produces suboptimal answers with no error to warn you.

### What is the exchange argument and how do you use it to prove a greedy correct?

The exchange argument proves the greedy-choice property. Take an arbitrary optimal solution `OPT` and show you can transform it, one swap at a time, into the greedy solution `G` without ever making it worse.

The three steps, every time:

1. Assume `OPT` differs from `G`; look at the *first* place they differ.
2. **Exchange** `OPT`'s choice there for the greedy choice, and argue the result is still feasible and no worse.
3. Repeat. Each swap moves `OPT` closer to `G` and never lowers its quality, so after finitely many swaps `OPT` has become `G` — therefore `G` is at least as good as `OPT`, hence optimal.

It's the standard proof pattern for interval scheduling, Huffman, fractional knapsack and MST. Sketching one — even in three sentences — is how you *demonstrate* correctness rather than assert it.

### Solve interval scheduling (activity selection) greedily and state why it works.

Given intervals with start and finish times, select the maximum number of non-overlapping ones. Greedy: sort by *earliest finish time*, then repeatedly take the next interval that starts at or after the last taken interval's finish.

```python
def activity_selection(intervals):           # intervals: list of (start, finish)
    intervals = sorted(intervals, key=lambda iv: iv[1])   # earliest FINISH first
    chosen, last_finish = [], float("-inf")
    for start, finish in intervals:
        if start >= last_finish:             # doesn't overlap the last pick
            chosen.append((start, finish))
            last_finish = finish
    return chosen
```

Micro-example: `[(0,6), (1,4), (3,5), (5,7), (5,9), (8,11)]`. Sorted by finish → `[(1,4), (3,5), (0,6), (5,7), (5,9), (8,11)]`. Take `(1,4)`; skip `(3,5)` and `(0,6)` (they start before 4); take `(5,7)`; skip `(5,9)`; take `(8,11)`. Answer: 3 activities.

**Exchange argument in words.** Let `OPT` be any optimal set in time order and `g` the greedy's first pick, the interval finishing earliest of all. If `OPT` starts with some other interval `o`, then `g` finishes no later than `o`, so swapping `o` for `g` leaves `g` disjoint from the rest of `OPT` — same size, still feasible, still optimal. Recurse on the intervals starting after `g` finishes; induction does the rest.

Complexity: `O(n log n)` for the sort plus one linear scan, and `O(1)` extra space beyond the sort.

A close cousin asks for the *minimum number of rooms* (or railway platforms) to hold **all** meetings rather than the largest non-overlapping subset. Same interval flavour, different greedy: process meetings by start time and reuse a room whose meeting has already ended.

```python
import heapq

def min_rooms(intervals):                    # intervals: list of (start, finish)
    ends = []                                # min-heap of finish times, rooms in use
    for start, finish in sorted(intervals):  # by start time
        if ends and ends[0] <= start:        # earliest-finishing room is free: reuse
            heapq.heappop(ends)
        heapq.heappush(ends, finish)
    return len(ends)                         # peak number of concurrent meetings
```

Micro-example: `[(0,30), (5,10), (15,20)]` → at `(5,10)` no room is free (30 > 5) so a second room opens; at `(15,20)` the 10-room has freed and is reused. Answer: 2 rooms. Cost: `O(n log n)` for the sort plus heap operations, `O(n)` space.

### Why is earliest-finish-time the right greedy key for interval scheduling, and why do the alternatives fail?

Earliest finish time frees the timeline as early as possible, maximising the room left for remaining choices — exactly what the exchange argument exploits, since the earliest-finishing interval can substitute for any other first pick without conflict.

The two tempting alternatives have three-element counterexamples:

- **Earliest start** fails: `[(0,10), (1,2), (3,4)]`. Greedy-by-start takes the all-day meeting `(0,10)` for 1 activity; the optimum takes the two short ones for 2.
- **Shortest duration** fails: `[(0,5), (4,6), (5,10)]`. The short `(4,6)` overlaps both longer intervals, which don't overlap each other — greedy-by-duration gets 1, the optimum gets 2.

Only earliest-finish provably preserves optimality. The general lesson: the *sort key* is where a greedy lives or dies, and a plausible-sounding key can die in three elements.

### How does Huffman coding work and why is the greedy choice optimal?

Huffman builds an optimal prefix-free binary code from character frequencies — frequent characters get short codewords, rare ones long, and no codeword is a prefix of another so decoding is unambiguous.

Greedy: put every character in a min-priority-queue keyed by frequency; repeatedly extract the two *lowest*-frequency nodes, merge them under a parent whose frequency is their sum, and reinsert. The final tree assigns each character the codeword spelled by its root-to-leaf path.

```python
import heapq
from itertools import count

def huffman(freqs):                          # freqs: dict of char -> frequency
    tie = count()                            # tie-breaker so heap never compares subtrees
    heap = [(f, next(tie), ch) for ch, f in freqs.items()]
    heapq.heapify(heap)
    while len(heap) > 1:
        f1, _, left = heapq.heappop(heap)    # two rarest nodes
        f2, _, right = heapq.heappop(heap)
        heapq.heappush(heap, (f1 + f2, next(tie), (left, right)))
    codes = {}
    def walk(node, prefix):
        if isinstance(node, tuple):          # internal node: 0 = left, 1 = right
            walk(node[0], prefix + "0")
            walk(node[1], prefix + "1")
        else:
            codes[node] = prefix or "0"      # lone-symbol edge case
    walk(heap[0][2], "")
    return codes
```

Micro-example with frequencies `a:5, b:2, c:1, d:1`. Merge the two rarest, `c` and `d`, into a node of weight 2. The heap now holds `b:2`, `(c,d):2`, `a:5`; merge `b` with `(c,d)` into weight 4; merge that with `a` into the root, weight 9. Codes: `a = 0`, `b = 10`, `c = 110`, `d = 111`. Total encoded length `5·1 + 2·2 + 1·3 + 1·3 = 15` bits, versus `9 × 2 = 18` for a fixed-width 2-bit code.

Optimality (exchange argument): in *any* optimal prefix tree the two lowest-frequency characters must be siblings at the greatest depth — otherwise you could swap them down with whatever sits there and the weighted path length `Σ freq_i · depth_i` would not increase. So merging the two rarest symbols first is safe, and optimal substructure (the merged node behaves as one symbol in a smaller instance) carries the rest. Complexity: `O(n log n)` — a heap push and pop per merge, `n − 1` merges.

### Explain fractional knapsack and why greedy solves it but 0/1 knapsack doesn't.

Fractional knapsack: items have a value and a weight, the sack has capacity `W`, and you may take *fractions* of items — think pouring grain rather than loading crates. Greedy: sort by value-to-weight ratio (value density) descending, take whole items while they fit, and take a fraction of the first item that doesn't fully fit so the sack ends up exactly full.

```python
def fractional_knapsack(items, capacity):    # items: list of (value, weight)
    items = sorted(items, key=lambda iw: iw[0] / iw[1], reverse=True)  # density
    total = 0.0
    for value, weight in items:
        if capacity <= 0:
            break
        take = min(weight, capacity)         # whole item, or the sliver that fits
        total += value * (take / weight)
        capacity -= take
    return total
```

Micro-example: capacity 50 with items `(60, 10)`, `(100, 20)`, `(120, 30)` — densities 6, 5 and 4 per unit weight. Take the first two whole (weight 30, value 160), then 20 of the last item's 30 units for `120 × 20/30 = 80`. Total 240, sack exactly full.

Why it's optimal: every unit of capacity holds the highest-density material still available. The exchange argument is one line — if a solution puts lower-density weight in the sack while higher-density weight sits outside, swap an equal weight of the two and the value strictly increases, so no such solution was optimal.

0/1 knapsack forbids fractions, so you cannot top off the last sliver of capacity, and taking the highest-density item can waste room a different combination would use fully. That all-or-nothing constraint destroys the greedy-choice property, and 0/1 knapsack needs DP in `O(n·W)` — items times capacity. The fractional version stays `O(n log n)`, dominated by the density sort.

### Give a concrete example where greedy fails and DP is required.

Take 0/1 knapsack with capacity 10 and items `(value 7, weight 6)`, `(value 5, weight 5)`, `(value 5, weight 5)`. Densities are about `1.17`, `1.0`, `1.0`, so greedy-by-density grabs the first item, has 4 capacity left, and nothing else fits — **value 7**. The optimum ignores the densest item and takes the two weight-5 items — **value 10**. Greedy loses 30% on a three-item input.

```python
def knapsack_01(items, capacity):            # items: list of (value, weight)
    dp = [0] * (capacity + 1)                # dp[c] = best value with capacity c
    for value, weight in items:
        for c in range(capacity, weight - 1, -1):   # right-to-left: use each item once
            dp[c] = max(dp[c], dp[c - weight] + value)
    return dp[capacity]

items = [(7, 6), (5, 5), (5, 5)]
knapsack_01(items, 10)                       # -> 10, versus greedy's 7
```

The instructive part: the *fractional* version of the same instance is greedy-solvable — take `(7, 6)` whole plus four-fifths of a weight-5 item for `7 + 4 = 11`. So it isn't the densities that break greedy, it's indivisibility. The last 4 units of capacity have no partial item to absorb them, and only a search over combinations finds that skipping the densest item pays. The DP above runs in `O(n·W)` time and `O(W)` space.

### When should you reach for greedy vs dynamic programming?

Reach for **greedy** when you can *prove* the greedy-choice property — interval scheduling, Huffman, fractional knapsack and MST all qualify. It's faster (typically `O(n log n)`) and lighter on memory.

Reach for **DP** when local choices can be globally wrong and you must weigh combinations of subproblem solutions: 0/1 knapsack, edit distance, longest common subsequence, coin change with arbitrary denominations.

The practical interview heuristic, in order:

1. Propose the obvious greedy out loud.
2. Spend thirty seconds trying to *break* it with a small adversarial input — three or four elements is usually enough.
3. If you break it, switch to DP; the failure means a choice's value depends on later choices, the signature of overlapping subproblems.
4. If you can't break it, sketch an exchange argument and commit.

Signals pushing towards DP: an all-or-nothing constraint, a capacity that can be left partly unused, or two choices whose relative merit flips depending on what comes later.

### Is greedy coin change always optimal?

No — it depends entirely on the coin system. Greedy (repeatedly take the largest coin `≤` the remaining amount) is optimal for *canonical* coin systems like US coins `[1, 5, 10, 25]`, but for arbitrary denominations it can fail.

The classic counterexample is coins `[1, 3, 4]` for amount 6: greedy takes 4, then 1, then 1 — three coins — while the optimum is `3 + 3`, two coins. Greedy's mistake is grabbing the 4 and stranding itself with a remainder that only 1s can fill.

```python
def greedy_coins(coins, amount):             # largest coin first, no lookahead
    used = []
    for c in sorted(coins, reverse=True):
        while amount >= c:
            amount -= c
            used.append(c)
    return used if amount == 0 else None

def dp_coins(coins, amount):                 # true minimum, O(amount * len(coins))
    INF = float("inf")
    best = [0] + [INF] * amount              # best[a] = fewest coins making a
    for a in range(1, amount + 1):
        for c in coins:
            if c <= a and best[a - c] + 1 < best[a]:
                best[a] = best[a - c] + 1
    return best[amount] if best[amount] < INF else None

greedy_coins([1, 3, 4], 6)                   # -> [4, 1, 1]   (3 coins)
dp_coins([1, 3, 4], 6)                       # -> 2           (3 + 3)
```

So the general minimum-coin problem is solved by DP in `O(amount × numCoins)` time and `O(amount)` space. Whether a coin system is "canonical" (greedy-safe) is itself non-trivial to verify — there's no quick eyeball test, which is why the safe interview answer is DP unless the denominations are stated to be canonical.

### What is optimal substructure and how does it differ from the greedy-choice property?

**Optimal substructure** means an optimal solution to the whole contains optimal solutions to its subproblems — solve the parts optimally and you can assemble the optimal whole. It's shared by *both* greedy and DP problems; it's what makes recursion and induction work at all.

The **greedy-choice property** is stronger: you can pick the locally best option *first, without solving any subproblems*, and still reach a global optimum.

The distinction in one line: 0/1 knapsack has optimal substructure (the best packing of capacity `W` contains the best packing of the leftover capacity after any fixed decision) but *lacks* the greedy-choice property, as shown above. That's the DP-only class. Optimal substructure is necessary for both paradigms; the greedy-choice property is the extra ingredient separating greedy-solvable from DP-only.

### How do you prove a greedy algorithm is correct in an interview?

Two standard approaches, and you should be able to name both.

1. **Exchange argument** — transform any optimal solution toward the greedy one swap at a time without worsening it. The go-to for scheduling, Huffman and MST.
2. **Greedy-stays-ahead** — induct that after each step the greedy's partial solution is at least as good as any rival's. For interval scheduling: after `k` picks the greedy's `k`-th interval finishes no later than any rival's `k`-th, so greedy never runs out of room first and schedules at least as many jobs.

Either way you are arguing the greedy-choice property plus optimal substructure — that's what the proofs are *for*. "It works on the examples" is not a proof, and interviewers explicitly probe for the exchange or stays-ahead argument. If you can produce neither in a couple of minutes, that's evidence too: say so, and pivot to DP.

### Why do MST algorithms (Kruskal, Prim) count as greedy, and why are they optimal?

Both build a minimum spanning tree — the cheapest set of edges connecting every vertex — by repeatedly adding the cheapest **safe** edge and never reconsidering. That's the greedy signature.

- **Kruskal** sorts all edges by weight and adds the next cheapest that doesn't form a cycle, using union-find to test connectivity (see the Data Structures primer). Cost: `O(E log E)` for `E` edges, dominated by the sort.
- **Prim** grows one tree from a start vertex, always adding the cheapest edge leaving the tree, using a heap of candidates. Cost: `O(E log V)` with a binary heap, for `V` vertices.

Optimality follows from the **cut property**: for any partition of the vertices into two sets, the minimum-weight edge crossing that partition belongs to some MST. The proof is an exchange argument — if a spanning tree omits that edge, add it, creating a cycle that contains some other crossing edge no cheaper, then delete that one; the tree stays spanning and the weight does not increase. Every edge Kruskal or Prim picks is a minimum crossing edge for some cut, so every pick is safe.

### Can a greedy give a good approximation even when it's not optimal?

Yes — greedy is the workhorse of *approximation algorithms* for NP-hard problems where exact optimisation is intractable. Greedy **set cover** repeatedly picks the set covering the most still-uncovered elements, achieving an `O(log n)` approximation ratio — within a `log n` factor of optimal, and provably no polynomial algorithm does meaningfully better unless `P = NP`.

```python
def greedy_set_cover(universe, sets):        # sets: list of set objects
    uncovered = set(universe)
    chosen = []
    while uncovered:
        best = max(sets, key=lambda s: len(s & uncovered))  # most new elements
        if not (best & uncovered):
            return None                      # universe is not coverable
        chosen.append(best)
        uncovered -= best
    return chosen
```

Micro-example: universe `{1,2,3,4,5}` with sets `{1,2,3}`, `{3,4}`, `{4,5}`. Greedy takes `{1,2,3}` (3 new), then `{4,5}` (2 new) — two sets, optimal here.

Greedy list scheduling on identical machines — assign each job to the least-loaded machine — gives a `2`-approximation for makespan: the finish time is never worse than twice the best possible. The pattern generalises. Even when greedy can't guarantee the optimum you can often *bound how far off* it is, so "greedy isn't optimal here" does not mean "greedy is useless" — a bounded approximation is frequently the best practical option.

### What is the single most common mistake candidates make with greedy problems?

Assuming a greedy is correct because it's intuitive and passes the sample inputs, without proving it or hunting for a counterexample. Greedy strategies are seductive — value density for 0/1 knapsack, shortest interval for scheduling, largest coin for coin change — and they are *wrong* in exactly the cases interviewers choose.

The disciplined loop is short enough to run every time: propose the greedy, immediately try to *break* it with a small adversarial input, then either sketch an exchange argument or switch to DP and say why. Treating "it seems obvious" as justification is the single behaviour separating weak greedy answers from strong ones — and both outcomes score well, because finding your own counterexample is as impressive as producing the proof.

## Dynamic Programming Fundamentals

### Summary

**What this topic covers**
Dynamic programming (DP) is **recursion plus remembering answers you have already computed**. It applies when a problem breaks into smaller versions of itself and those smaller versions keep coming back. Two properties must hold: *optimal substructure* (the best answer to the whole is built from best answers to smaller pieces) and *overlapping subproblems* (the same small piece is needed many times). This topic covers the mechanics — state, recurrence, base case, order, answer — with the same problem (Fibonacci) written four ways: naive recursion, top-down memoization, bottom-up tabulation, and space-optimized rolling variables. It also covers how to derive complexity, choose an iteration order, drop a dimension, and reconstruct the actual solution rather than just its value.

**Mental model**
Imagine computing `fib(50)` by hand. The naive recursion asks "what is `fib(49)`?" and "what is `fib(48)`?", and each of those re-asks the same questions again, forever, down a tree with billions of nodes — even though there are only 51 distinct questions in the whole problem. DP is nothing more cunning than keeping a notebook: before answering a question, check whether you already wrote the answer down; if so, read it off. That single change collapses an exponential tree into a linear walk. Everything else in DP — tables, loops, rolling arrays — is bookkeeping about *where the notebook lives* and *what order you fill it in*.

**Key terms**
- **State** — the minimal set of parameters that uniquely identifies one subproblem. `dp[i]` = "best answer considering the first `i` items."
- **Recurrence** (or **transition**) — the formula relating a state to smaller states, e.g. `dp[i] = max(dp[i-1], dp[i-2] + a[i])`.
- **Base case** — the smallest states you answer directly, without recursion.
- **Optimal substructure** — the optimum decomposes into sub-optima, so a recurrence exists at all.
- **Overlapping subproblems** — the recursion revisits identical states, so caching pays.
- **Memoization** — top-down: write the recursion, add a cache keyed by state.
- **Tabulation** — bottom-up: allocate a table, fill base cases, loop states in dependency order.
- **Iteration order** — the sequence tabulation uses so every dependency is already filled when read.
- **Rolling array** — keeping only the last few rows/values when dependencies reach back a bounded distance.

**Core mechanics**
Deriving a DP is a five-step recipe: **(1) state** — what does one cell mean, in a sentence; **(2) recurrence** — how does that cell follow from smaller cells; **(3) base case** — which cells are known outright; **(4) order** — in what sequence can you fill them so nothing is read before it is written; **(5) answer** — which cell (or aggregate of cells) is the final result. Once those five are fixed, the code is mechanical. The same recurrence has two implementations: memoization computes a state lazily the first time it is requested, tabulation computes every state in a fixed sweep. Complexity follows one formula: `time = (number of states) × (cost per transition)`, and `space = table size` before optimization. Fibonacci has `n` states and O(1) work each, so it is `O(n)` — linear — while the naive recursion is `Θ(φⁿ)` with `φ ≈ 1.618`, i.e. exponential, purely because it recomputes.

**Trade-offs**
Memoization is easier to write (you translate the recurrence literally), computes only the states actually reachable, and copes with sparse or awkwardly-ordered state spaces — but pays function-call overhead and can blow the recursion stack on long dependency chains. Tabulation avoids the stack, has tighter constants and better cache locality, and is the only form that unlocks rolling-array space reduction — but you must get the iteration order right and it may compute states you never needed. DP versus greedy: greedy is faster but only correct when a local choice provably extends to a global optimum; DP is the safe default when choices interact. DP versus plain divide-and-conquer: use DP when subproblems overlap; if they do not, D&C's independent splits already do the job.

**Common confusions**
Conflating *optimal substructure* with *overlapping subproblems* — you need both. Merge sort has substructure (sorted halves merge into a sorted whole) but zero overlap, so it is divide-and-conquer, not DP. Believing memoization and tabulation have different complexities — they do not; they differ in constants and stack usage. Under-specifying the state, so two genuinely different subproblems land in the same cache slot — this produces confidently wrong answers rather than a crash. Getting the iteration order backwards so a transition reads an unfilled cell. Optimizing space before the plain 2D version is correct. And assuming every recursion benefits from a cache — without overlap, the cache is pure overhead.

**Why interviewers ask**
DP separates candidates who can *model* a problem from those who pattern-match remembered solutions. The interviewer is watching you name the state out loud, justify the recurrence, and reason about order and complexity — the follow-ups ("can you make the state 1D?", "can you drop a dimension?", "top-down or bottom-up here?") all probe whether the model is yours or memorized. It is the canonical test of turning a fuzzy optimization request into a precise recurrence.

### What are the two conditions a problem must satisfy to be solvable by dynamic programming?

**Optimal substructure** and **overlapping subproblems**.

*Optimal substructure* means an optimal solution to the whole problem contains optimal solutions to its subproblems, so you can write the answer recursively. Shortest paths have it: if the shortest route from A to C goes through B, the A→B piece must itself be shortest, otherwise you could swap in a better piece and improve the whole. Longest *simple* paths do **not** have it — gluing two longest sub-paths can revisit a vertex, so the pieces do not compose.

*Overlapping subproblems* means the recursion asks the same question many times. `fib(5)` asks for `fib(3)` twice, `fib(2)` three times, `fib(1)` five times. That repetition is what a cache eliminates.

Both are required. Without substructure the recurrence is simply wrong. Without overlap the cache never gets a hit, so you have paid for a dictionary and gained nothing — that situation is ordinary divide-and-conquer.

### How does memoization differ from tabulation?

They are two implementations of the *same* recurrence, run from opposite ends. Here is the progression on Fibonacci, defined by `fib(n) = fib(n-1) + fib(n-2)` with `fib(0) = 0`, `fib(1) = 1`.

**Stage 1 — naive recursion.** Correct, and catastrophically slow, because nothing is remembered.

```python
def fib_naive(n):
    if n <= 1:
        return n
    return fib_naive(n - 1) + fib_naive(n - 2)
```

**Stage 2 — top-down memoization.** Same code, plus a notebook. On entry, look the state up; on exit, write it down.

```python
def fib_memo(n, cache=None):
    if cache is None:
        cache = {}
    if n <= 1:
        return n
    if n in cache:                 # already answered this exact question
        return cache[n]
    cache[n] = fib_memo(n - 1, cache) + fib_memo(n - 2, cache)
    return cache[n]
```

**Stage 3 — bottom-up tabulation.** No recursion at all: allocate the table, seed the base cases, sweep forward so every read hits a cell that was already written.

```python
def fib_table(n):
    if n <= 1:
        return n
    dp = [0] * (n + 1)             # dp[k] = fib(k)
    dp[1] = 1                      # base cases: dp[0] = 0, dp[1] = 1
    for k in range(2, n + 1):      # ascending: dp[k] needs k-1 and k-2
        dp[k] = dp[k - 1] + dp[k - 2]
    return dp[n]
```

The difference is direction and laziness, not complexity: both are `O(n)` time — linear in `n` — and `O(n)` space (memoization's cache plus its recursion stack; tabulation's array). Memoization is easier to derive, since it is the recurrence typed out verbatim, and it computes only the states actually reached. Tabulation avoids the recursion stack (`fib_memo(100000)` overflows in Python; `fib_table(100000)` does not), has tighter constants, and is the only form you can shrink with a rolling array — see the space-optimization card.

### What is a "state" in DP and why does choosing it well matter?

The state is the minimal set of parameters that fully determines a subproblem's answer — everything the answer depends on, and nothing more. Read `dp[i][w]` for knapsack out loud: "the best value achievable using only the first `i` items within capacity `w`." If you cannot say that sentence, you do not have a state yet.

Choosing it well *is* the problem. Too few parameters and two genuinely different subproblems collide in one cell, producing silently wrong answers. Too many and you multiply the state count, blowing up both time and memory. Because `time = states × transition cost`, the state definition literally sets your complexity.

Worked example — **House Robber**: given houses with values `a = [2, 7, 9, 3, 1]`, take a maximum-value subset with no two adjacent. The state is one number: `dp[i]` = best loot from the first `i` houses. At house `i` you either skip it (keep `dp[i-1]`) or rob it (take `a[i-1]` plus `dp[i-2]`, since `i-1` is then off-limits).

```python
def rob(a):
    n = len(a)
    dp = [0] * (n + 1)             # dp[i] = best loot from first i houses
    if n >= 1:
        dp[1] = a[0]               # base cases: dp[0] = 0, dp[1] = a[0]
    for i in range(2, n + 1):
        skip = dp[i - 1]
        take = dp[i - 2] + a[i - 1]
        dp[i] = max(skip, take)
    return dp[n]
```

Filling the table by hand:

| `i` | house value | `skip = dp[i-1]` | `take = dp[i-2] + a[i-1]` | `dp[i]` |
|---|---|---|---|---|
| 0 | — | — | — | 0 |
| 1 | 2 | — | — | 2 |
| 2 | 7 | 2 | 0 + 7 = 7 | 7 |
| 3 | 9 | 7 | 2 + 9 = 11 | **11** |
| 4 | 3 | 11 | 7 + 3 = 10 | 11 |
| 5 | 1 | 11 | 11 + 1 = 12 | **12** |

Answer `12`, from houses worth `2 + 9 + 1`. Note how thin the state is — a single index — and how much that buys: `n` states, O(1) per transition, so `O(n)` time. A careless state like "best loot from first `i` houses *and* whether house `i` was robbed" would work too, but doubles the table for no gain.

### How do you derive the time and space complexity of a DP solution?

One formula: **`time = (number of distinct states) × (work per transition)`**. Count the states by multiplying out the ranges of each state parameter; count the transition cost by looking at what the loop body does.

- Fibonacci: `n` states, O(1) transition → `O(n)`, linear.
- 0/1 knapsack `dp[i][w]`: `n·W` states, O(1) transition (take or skip) → `O(n·W)`.
- A transition that loops over `k` choices, e.g. "cut the rope at any of `k` positions": `O(n·W·k)`.
- Interval DP `dp[i][j]` with a split point scanned inside: `n²` states × `O(n)` transition → `O(n³)`, cubic.

Space is the table size, `O(number of states)`, before any optimization — plus the recursion stack if you went top-down.

This is why the interview reflex is "how many states, how expensive is each transition?" It gives the bound in one line, and it tells you which factor to attack: if the state count dominates, look for a redundant parameter to drop; if the transition dominates, look for a prefix sum or monotonic queue to replace the inner loop.

### Why is naive recursive Fibonacci exponential while the DP version is linear?

Because the naive version rebuilds an entire binary recursion tree, and that tree is enormously redundant. Expand `fib_naive(5)`: it calls `fib(4)` and `fib(3)`; `fib(4)` calls `fib(3)` and `fib(2)`; and so on. Count how many times each distinct value is computed:

| subproblem | times computed by `fib_naive(5)` | times computed by DP |
|---|---|---|
| `fib(4)` | 1 | 1 |
| `fib(3)` | 2 | 1 |
| `fib(2)` | 3 | 1 |
| `fib(1)` | 5 | 1 |
| `fib(0)` | 3 | 1 |

Fifteen calls to answer six distinct questions — and the ratio explodes with `n`. The number of calls satisfies `C(n) = 1 + C(n-1) + C(n-2)`, which grows like the Fibonacci numbers themselves: `Θ(φⁿ)` where `φ ≈ 1.618` is the golden ratio (people usually quote the looser `O(2ⁿ)`). Concretely, `fib_naive(40)` makes about 331 million calls and takes seconds to minutes in Python; `fib_memo(40)` makes about 40 and returns instantly. At `n = 90` the naive version would not finish in your lifetime, while the tabulated version is 90 additions.

The point is not that Fibonacci is important — it is that the work was exponential *only* because identical states were recomputed. There are just `n + 1` distinct subproblems; compute each once and the tree collapses to a line, `O(n)`. That is the entire value proposition of DP, visible in one example.

### What is the difference between optimal substructure and overlapping subproblems?

They answer different questions. Optimal substructure is about **correctness of the decomposition**: it says the optimum can be assembled from sub-optima, which is what licenses you to write a recurrence at all. Overlapping subproblems is about **efficiency**: it says those subproblems recur, which is what makes caching worthwhile.

Merge sort is the clean counter-example. It has optimal substructure — sorting each half correctly and merging yields a correctly sorted whole — but the two halves are disjoint, so no subproblem is ever seen twice. Adding a cache to merge sort slows it down. It is divide-and-conquer.

Longest simple path is the opposite counter-example: subproblems overlap heavily, but there is no optimal substructure (combining two longest sub-paths can reuse a vertex), so no valid recurrence exists and the problem is NP-hard.

You need both properties before DP is the right tool: substructure makes it *correct*, overlap makes it *fast*.

### How do you decide the iteration order for a bottom-up DP?

Fill states in an order where every dependency is already computed. Read the recurrence and let it dictate the loops: whatever appears on the right-hand side must have been written before the left-hand side is read.

- `dp[i]` depends on `dp[i-1]` → iterate `i` ascending.
- `dp[i][j]` depends on the cell above and the cell to the left → row-major, top-left to bottom-right.
- Interval DP `dp[i][j]` depends on shorter intervals → iterate by increasing interval length, not by `i`.
- 0/1 knapsack collapsed to a 1D array → iterate capacity **descending**, so the item is not reused within the same pass.

The general rule: build the dependency graph over states; it must be a DAG (directed acyclic graph — no cycles), and any topological order of it is a valid fill order. If the graph has a cycle, your recurrence is circular and DP does not apply.

Worked example — **unique paths in a grid**: count routes from the top-left to the bottom-right of a 3×4 grid moving only right or down. State: `dp[i][j]` = number of paths reaching cell `(i, j)`. Recurrence in words: *you arrive at a cell either from above or from the left, so its count is the sum of those two counts.* Base case: the first row and first column are all `1` (one straight-line route). Order: row-major, because `dp[i][j]` reads `dp[i-1][j]` (previous row, already done) and `dp[i][j-1]` (same row, already done this pass).

```python
def unique_paths(rows, cols):
    dp = [[1] * cols for _ in range(rows)]   # first row/col seeded to 1
    for i in range(1, rows):
        for j in range(1, cols):             # row-major = dependency order
            dp[i][j] = dp[i - 1][j] + dp[i][j - 1]
    return dp[rows - 1][cols - 1]
```

The filled table for `rows = 3`, `cols = 4`:

| | `j=0` | `j=1` | `j=2` | `j=3` |
|---|---|---|---|---|
| `i=0` | 1 | 1 | 1 | 1 |
| `i=1` | 1 | 2 | 3 | 4 |
| `i=2` | 1 | 3 | 6 | **10** |

Ten paths. Every cell is the sum of the one above and the one to its left, and each of those was filled earlier in the sweep — which is exactly what "correct iteration order" means. Complexity: `rows × cols` states, O(1) each → `O(rows·cols)`, linear in the number of cells.

### When would you prefer top-down memoization over bottom-up tabulation?

Prefer memoization when the state space is **sparse** — if only a small fraction of the theoretically-possible states is ever reachable, memoization computes just those while tabulation dutifully fills the whole table. Prefer it when the natural iteration order is awkward to express (interval DP, DP over subsets, digit DP), because recursion discovers the order for you. And prefer it when the recurrence is far easier to write recursively than to linearize — under interview time pressure it is usually the faster path from idea to working code.

Switch to tabulation when recursion depth risks a stack overflow (Python's default limit is around 1000 frames, so a chain of `n = 10⁵` states will crash), when constant factors and cache locality matter, or when you want rolling-array space reduction, which needs an explicit fill order.

A practical interview sequence: state the recurrence, write it memoized to get correctness, then say "and I can convert this to bottom-up in `O(n)` space, or `O(1)` with rolling variables."

### What is space optimization in DP and when can you apply it?

When a state depends only on a **bounded window** of previous states, you can throw the rest away. Fibonacci's `dp[k]` reads only `dp[k-1]` and `dp[k-2]`, so two variables suffice:

```python
def fib_rolling(n):
    if n <= 1:
        return n
    prev, curr = 0, 1              # prev = fib(k-2), curr = fib(k-1)
    for _ in range(2, n + 1):
        prev, curr = curr, prev + curr
    return curr
```

Same `O(n)` time, but `O(1)` space — constant, regardless of `n` — down from the `O(n)` array. The same idea scales up: a 2D DP whose row `i` depends only on row `i-1` can keep two rows (`O(cols)` instead of `O(rows·cols)`), and sometimes a single row updated in place — that is the 0/1 knapsack trick, where iterating capacity descending stops the in-place row from reusing an item twice in one pass.

The prerequisite is a **bounded dependency distance**. If a transition can reach arbitrarily far back (`dp[i]` scanning all `dp[j]` for `j < i`, as in longest increasing subsequence), you must keep the full table.

Two warnings. First, optimize only once the unoptimized version is correct — space tricks are where off-by-one bugs breed. Second, rolling arrays destroy the history, so they are generally incompatible with reconstructing the actual solution.

### How would you reconstruct the actual solution, not just its optimal value?

The DP table holds *values*; the interviewer often wants the *choices*. Two approaches. **Re-derive from the table**: keep the full table and walk backwards from the answer cell, at each step asking which predecessor could have produced the stored value — no extra memory, one backward pass of `O(path length)`. **Store back-pointers**: alongside each cell, record which choice produced it, then follow the pointers — simpler to read, but costs a parallel table.

Worked example — 0/1 knapsack with items `(weight, value) = (1,1), (3,4), (4,5), (5,7)` and capacity `7`. The optimum value is `9`. Re-deriving which items achieved it:

```python
def knapsack_items(weights, values, cap, dp):
    chosen, w = [], cap
    for i in range(len(weights), 0, -1):     # walk items backwards
        if dp[i][w] != dp[i - 1][w]:         # value changed => item i was taken
            chosen.append(i - 1)
            w -= weights[i - 1]              # free the capacity it used
    return chosen[::-1]
```

Tracing it: `dp[4][7] = 9` and `dp[3][7] = 9`, unchanged, so item 4 (weight 5) was **not** taken. `dp[3][7] = 9` but `dp[2][7] = 5`, changed, so item 3 (weight 4, value 5) **was** taken; drop to `w = 3`. `dp[2][3] = 4` but `dp[1][3] = 1`, changed, so item 2 (weight 3, value 4) **was** taken; drop to `w = 0`. `dp[1][0] = dp[0][0] = 0`, unchanged, so item 1 was not taken. Result: items 2 and 3, total weight `7`, total value `9` — matching the stored optimum.

The catch worth voicing in an interview: reconstruction needs the history, so it conflicts with aggressive rolling-array space optimization. You either keep the `O(n·W)` table, or keep a compact back-pointer structure, or use divide-and-conquer reconstruction (Hirschberg's trick) to get the path in linear space at the cost of doubling the time.

### Can every recursive problem be sped up with memoization?

No, and the two failure modes are worth naming.

**No overlap, no gain.** Memoization helps only when subproblems repeat. Merge sort's recursion never revisits a subproblem, so a cache adds hashing and memory cost for zero hits. Before adding a cache, ask: "will the same argument tuple ever arrive twice?" If not, skip it.

**Impure functions break it.** Memoization requires the result to be a pure function of the cached key. If the answer also depends on something outside the state — a mutable global, the order calls were made in, elapsed time, a random draw, an unmodelled parameter — the cache will hand back an answer computed under different circumstances. This is the same bug as under-specifying the state, and it is nasty precisely because it does not crash; it just returns a plausible wrong number.

### What distinguishes dynamic programming from greedy algorithms?

Greedy commits to the locally best choice at each step and never reconsiders. DP considers all relevant choices and lets the subproblem results decide.

Greedy is faster — often just a sort, `O(n log n)` — but only correct when the **greedy-choice property** holds: a locally optimal choice provably extends to some global optimum. Interval scheduling (always take the earliest-finishing compatible interval), Huffman coding (always merge the two lowest frequencies) and fractional knapsack all have such proofs.

DP is the safe choice when choices interact so that a locally best move can hurt you later. **0/1 knapsack** is the standard demonstration: with capacity 10 and items `(weight 6, value 30)`, `(weight 5, value 25)`, `(weight 5, value 25)`, greedy by value-per-weight grabs the first (ratio 5.0) and then cannot fit either other item, total `30`; DP takes the two weight-5 items for `50`.

The interview move: reach for DP by default, then say "and if I can prove the greedy-choice property here, greedy would be faster" — showing you know the shortcut exists without assuming it applies.

### What is the difference between DP and divide-and-conquer?

Both split a problem into subproblems and combine the results, so the distinction is entirely about **overlap**. Divide-and-conquer's subproblems are independent and disjoint: merge sort splits an array into two halves that share no elements, quickselect recurses into one side only. Each subproblem is solved once, combined once, and never needed again — so there is nothing to store. DP's subproblems overlap: the same state is required by many different parents, so you store each result and reuse it. That storage is the whole difference in implementation.

The practical signal: if a recursive solution keeps solving the same subproblem — the same argument tuple arriving again and again — that is the moment to add a cache and start calling it DP. Conversely, if you add a cache and it never hits, you had divide-and-conquer all along and should remove it.

### How do you turn a recurrence with multiple parameters into working code?

Map each state parameter to a table dimension, then follow the five-step recipe. Applied concretely to **0/1 knapsack** — items with weights `[1, 3, 4, 5]`, values `[1, 4, 5, 7]`, capacity `7`:

1. **State** — `dp[i][w]` = best value using only the first `i` items within capacity `w`. Two parameters, so a 2D table of size `(n+1) × (W+1)`.
2. **Recurrence** — in words: *for each item you either skip it, keeping the best from the previous items at the same capacity, or take it (if it fits), gaining its value on top of the best from previous items at the reduced capacity.* In symbols: `dp[i][w] = max(dp[i-1][w], dp[i-1][w - wᵢ] + vᵢ)`, with the second branch only when `wᵢ ≤ w`.
3. **Base case** — `dp[0][w] = 0` for all `w` (no items, no value). The zero row is the boundary the whole table grows from.
4. **Order** — `dp[i][*]` reads only row `i-1`, so iterate `i` ascending; within a row, `w` in any order.
5. **Answer** — `dp[n][W]`, the bottom-right cell.

```python
def knapsack(weights, values, cap):
    n = len(weights)
    dp = [[0] * (cap + 1) for _ in range(n + 1)]   # base: row 0 all zeros
    for i in range(1, n + 1):                      # ascending: row i needs row i-1
        wi, vi = weights[i - 1], values[i - 1]
        for w in range(cap + 1):
            best = dp[i - 1][w]                    # skip item i
            if wi <= w:                            # take item i, if it fits
                best = max(best, dp[i - 1][w - wi] + vi)
            dp[i][w] = best
    return dp[n][cap]
```

For the numbers above this returns `9` (items of weight 3 and 4, values 4 and 5, exactly filling capacity 7). Complexity straight from the formula: `(n+1)·(W+1)` states × O(1) transition = `O(n·W)` time and space. Note that `O(n·W)` is *pseudo-polynomial*, not polynomial — it scales with the numeric value of `W`, not with the number of bits used to write it, which is why 0/1 knapsack is still NP-hard.

The parameters, base cases, and order are the design work; the loops write themselves once those are fixed.

### A senior follow-up: your DP is correct but too slow or uses too much memory — how do you attack it?

Attack the two factors of `states × transition cost` separately, and measure which one dominates before you start.

**To cut time, shrink the state.** Look for a parameter that is redundant or derivable from the others — often one dimension is a function of the rest, or a boolean flag is already implied by the recurrence's structure. Dropping a dimension divides the runtime by that dimension's range.

**To cut time, speed the transition.** If the inner loop scans `k` choices, ask what structure it has. A sum over a contiguous window becomes a prefix sum, `O(k) → O(1)`. A minimum over a sliding window becomes a monotonic deque, `O(k) → O(1)` amortized. A transition of the form `dp[i] = min(dp[j] + cost(j, i))` may admit convex-hull or divide-and-conquer optimization when `cost` satisfies a quadrangle inequality, turning `O(n²)` into `O(n log n)`. Matrix exponentiation handles linear recurrences with huge `n` in `O(log n)` steps.

**To cut space, roll the table.** If row `i` reads only row `i-1`, keep two rows, or one row updated in the correct direction — `O(n·m)` becomes `O(m)`.

Then state the cost honestly: rolling arrays forfeit solution reconstruction unless you add back-pointers or use Hirschberg's reconstruction, and the transition optimizations only hold under conditions (convexity, monotonicity) you should say out loud rather than assume.

## Classic DP Problems & Patterns

### Summary

**What this topic covers**
The recurring DP *archetypes* an interviewer expects you to recognize on sight: **0/1 knapsack**, **unbounded knapsack / coin change**, **longest common subsequence (LCS)** and **edit distance**, **longest increasing subsequence (LIS)**, **grid/path counting**, **interval DP**, **bitmask DP**, and **DP on trees**. The previous topic covered the machinery — state, transition, memoization vs tabulation. This one is the vocabulary: each archetype has a signature state shape and a signature transition, and the skill being tested is pattern-matching an unfamiliar prompt onto the nearest archetype, then adapting the state to the twist.

**Mental model**
There are only about eight DP problems in interviews, wearing different costumes. Strip the story away and ask *what am I choosing?* If you're choosing a **subset** under a budget, that's knapsack. If you're **aligning two sequences**, that's the LCS grid. If you're **extending a chain**, that's LIS. If you're **walking a grid**, that's path counting. If you're **splitting a range into two ranges**, that's interval DP. If you must remember **which of a tiny set you've used**, that's a bitmask. If the input is a **tree**, it's post-order aggregation. Recognizing the costume takes seconds; inventing a bespoke recurrence takes twenty minutes and is usually buggy.

**Key terms**
- **0/1 knapsack** — pick a subset under a capacity to maximize value, each item usable **at most once**.
- **Unbounded knapsack** — same, but items are reusable any number of times (coin change is exactly this).
- **LCS** — longest subsequence (order-preserving, gaps allowed) common to two sequences.
- **Edit distance** (Levenshtein) — fewest insert/delete/replace operations turning one string into another.
- **LIS** — longest strictly increasing subsequence of an array.
- **Interval DP** — the state is a contiguous range `[i, j]`, built from smaller ranges via a split point.
- **Bitmask DP** — the state includes a subset encoded as the bits of an integer; viable only for tiny `n`.
- **Tree DP** — one state per node, combined from children in post-order.
- **Rolling array** — collapsing a 2-D table to one or two rows when a transition reads only the previous row.
- **Pseudo-polynomial** — polynomial in a numeric *value* (like capacity `W`) but exponential in its bit *length*.

**Core mechanics**
Knapsack: `dp[i][w] = max(dp[i-1][w], value[i] + dp[i-1][w - weight[i]])` — skip or take — in `O(n·W)` time (items times capacities), reducible to a single row of size `W`. LCS: `dp[i][j] = dp[i-1][j-1] + 1` on a match, else `max(dp[i-1][j], dp[i][j-1])`, in `O(n·m)`, the product of the two lengths. Edit distance: the same grid with a three-way `min` over delete/insert/replace. LIS: `O(n²)` (quadratic — every pair) by scanning all earlier indices, or `O(n log n)` (linearithmic) via patience sorting with binary search over a `tails` array. Coin change: `dp[a] = 1 + min over coins c of dp[a - c]`, `O(amount · coins)`. Grid paths: `dp[i][j] = dp[i-1][j] + dp[i][j-1]`, `O(n·m)`. Interval DP: `dp[i][j] = best over splits k of combine(dp[i][k], dp[k+1][j]) + cost`, typically `O(n³)` (cubic — `n²` ranges times an `n`-way split). Bitmask DP: `2ⁿ` masks times `n` or `n²` inner work, so `O(2ⁿ · n²)` for Held–Karp TSP. Tree DP: one post-order DFS, `O(n)` — linear, since each edge is used once.

**Trade-offs**
`O(n log n)` LIS is asymptotically better but doesn't hand you the actual subsequence without extra parent pointers; the `O(n²)` version reconstructs trivially. Rolling arrays shrink knapsack and LCS memory to one or two rows, but destroy the history you need to **reconstruct** the chosen items — a direct memory-versus-traceability trade. Bitmask DP is deliberately exponential: it's the "`n` is at most about 20" tool, not a scalable one. Interval DP's cubic cost is fine for `n` in the hundreds, hopeless for thousands (some problems admit Knuth's optimization down to `O(n²)`). And knapsack's `O(n·W)` is fast only when `W` is numerically small — it is not truly polynomial.

**Common confusions**
0/1 versus unbounded knapsack: the *only* difference in the 1-D code is the direction of the capacity loop (descending forbids reuse, ascending permits it), and getting it wrong silently solves a different problem rather than crashing. **Subsequence** (order-preserving, gaps allowed) versus **substring/subarray** (contiguous) — the first *inherits* a neighbouring state on mismatch, the second *resets to zero*. Coin change *count of ways* (coins on the outer loop, or you count permutations and over-report) versus *minimum coins* (loop order is irrelevant). LIS "strictly increasing" versus "non-decreasing" flips a `<` to a `≤` and `bisect_left` to `bisect_right`. And proposing bitmask DP when `n` is 10⁵.

**Why interviewers ask**
These archetypes are the shared vocabulary of DP interviews. Saying "this is unbounded knapsack with an extra dimension" in the first minute is the clearest signal of a prepared candidate, and it converts a scary open problem into a known recurrence. The follow-ups do the real filtering — *reduce the space*, *reconstruct the answer*, *handle this variant*, *why is that loop backwards?* — each distinguishing someone who understands the recurrence from someone who memorized the code.

### How do you recognize a 0/1 knapsack problem and set up its recurrence?

The signature: choose a **subset** of items, each usable **at most once**, to optimize a total value under a capacity/budget limit. Any prompt shaped like "pick some of these to maximize X without exceeding Y" is knapsack, whatever the story.

State: `dp[i][w]` = best value using only the first `i` items with capacity `w`. In plain English: *for each item you either leave it out, inheriting the best answer from the first `i-1` items at the same capacity, or put it in, paying its weight and collecting its value on top of the best answer at the reduced capacity.* In symbols: `dp[i][w] = max(dp[i-1][w], value[i] + dp[i-1][w - weight[i]])`, with `dp[0][*] = 0`.

```python
def knapsack(weights, values, W):
    n = len(weights)
    dp = [[0] * (W + 1) for _ in range(n + 1)]   # dp[i][w], items 1-indexed
    for i in range(1, n + 1):
        wi, vi = weights[i - 1], values[i - 1]
        for w in range(W + 1):
            dp[i][w] = dp[i - 1][w]              # skip item i
            if wi <= w:                          # or take it, if it fits
                dp[i][w] = max(dp[i][w], vi + dp[i - 1][w - wi])
    return dp[n][W]
```

Micro-example — items `(weight, value) = (1,1), (3,4), (4,5)`, capacity `W = 5`:

```text
capacity:      0  1  2  3  4  5
no items       0  0  0  0  0  0
+ (1,1)        0  1  1  1  1  1
+ (3,4)        0  1  1  4  5  5
+ (4,5)        0  1  1  4  5  6
```

The final cell is `6` — take `(1,1)` and `(4,5)`. Note `dp[3][5] = max(dp[2][5]=5, 5 + dp[2][1]=6)`: the "take it" branch wins by one.

Complexity: `n · W` cells at constant work each, so `O(n·W)` time — *items times capacities* — and `O(n·W)` space, reducible to one row. But `W` makes this **pseudo-polynomial**, not polynomial (see the dedicated card below).

### What is the difference between 0/1 and unbounded knapsack in code?

The state shape is identical. Once you collapse to a single rolling row, the *entire* difference is the direction of the capacity loop.

```python
def knapsack_01(weights, values, W):
    dp = [0] * (W + 1)
    for wi, vi in zip(weights, values):
        for w in range(W, wi - 1, -1):           # DESCENDING: each item once
            dp[w] = max(dp[w], vi + dp[w - wi])
    return dp[W]

def knapsack_unbounded(weights, values, W):
    dp = [0] * (W + 1)
    for wi, vi in zip(weights, values):
        for w in range(wi, W + 1):               # ASCENDING: item reusable
            dp[w] = max(dp[w], vi + dp[w - wi])
    return dp[W]
```

Why backwards for 0/1? When you write `dp[w]` from `dp[w - wi]`, you need `dp[w - wi]` to still hold the *previous* item's row — an answer that has **not** yet seen the current item. Descending, cell `w - wi` sits to the left and is untouched this pass, so it's still the old row. Ascending, it was already updated with the current item, so taking it again stacks a second copy — exactly what unbounded knapsack wants.

Micro-example: one item of weight 2, value 3, `W = 6`. Ascending gives `dp[2]=3`, `dp[4]=3+dp[2]=6`, `dp[6]=3+dp[4]=9` — used three times. Descending computes `dp[6]=3+dp[4]` while `dp[4]` is still `0`, so `dp[6]=3` — used once. Both are `O(n·W)`; one flipped loop bound is the whole distinction, and it fails **silently**.

### Explain the LCS recurrence and its complexity.

`dp[i][j]` = length of the longest common subsequence of the first `i` characters of `a` and the first `j` of `b`. In plain English: *if the two current characters match, that character can safely join the LCS, so take the answer with both strings one shorter and add one; if they differ, one of them must be discarded, so try dropping each and keep the better result.* In symbols: `dp[i][j] = dp[i-1][j-1] + 1` when `a[i-1] == b[j-1]`, else `max(dp[i-1][j], dp[i][j-1])`. Row 0 and column 0 are zero.

```python
def lcs(a, b):
    n, m = len(a), len(b)
    dp = [[0] * (m + 1) for _ in range(n + 1)]
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            if a[i - 1] == b[j - 1]:
                dp[i][j] = dp[i - 1][j - 1] + 1              # match: diagonal + 1
            else:
                dp[i][j] = max(dp[i - 1][j], dp[i][j - 1])   # drop one character
    out, i, j = [], n, m                                     # walk back for the string
    while i > 0 and j > 0:
        if a[i - 1] == b[j - 1]:
            out.append(a[i - 1]); i -= 1; j -= 1
        elif dp[i - 1][j] >= dp[i][j - 1]:
            i -= 1
        else:
            j -= 1
    return dp[n][m], "".join(reversed(out))
```

Micro-example — `a = "ABCB"`, `b = "BDCB"`:

```text
        ""  B  D  C  B
   ""    0  0  0  0  0
   A     0  0  0  0  0
   B     0  1  1  1  1
   C     0  1  1  2  2
   B     0  1  1  2  3
```

Answer `3`; the backward walk recovers `"BCB"`.

Complexity: one pass over an `n`-by-`m` grid, `O(n·m)` time — *the product of the two lengths* — and `O(n·m)` space, reducible to two rows if you only need the length. Reconstruction needs the full table. **Subsequence** means order-preserving but non-contiguous; longest common *substring* is a different recurrence.

### How is edit distance related to LCS?

Same grid, richer transition. `dp[i][j]` = minimum edits turning the first `i` characters of `a` into the first `j` of `b`. In plain English: *matching characters cost nothing, so carry the diagonal through; differing characters cost one edit, and you take the cheapest of three moves — delete from `a` (come from above), insert into `a` (come from the left), or replace (come from the diagonal).* In symbols: `dp[i][j] = dp[i-1][j-1]` on a match, else `1 + min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1])`. Base cases `dp[i][0] = i` (delete everything), `dp[0][j] = j` (insert everything).

```python
def edit_distance(a, b):
    n, m = len(a), len(b)
    dp = [[0] * (m + 1) for _ in range(n + 1)]
    for i in range(n + 1):
        dp[i][0] = i                       # delete all i chars of a
    for j in range(m + 1):
        dp[0][j] = j                       # insert all j chars of b
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            if a[i - 1] == b[j - 1]:
                dp[i][j] = dp[i - 1][j - 1]            # free match
            else:
                delete_ = dp[i - 1][j]
                insert_ = dp[i][j - 1]
                replace = dp[i - 1][j - 1]
                dp[i][j] = 1 + min(delete_, insert_, replace)
    return dp[n][m]
```

Micro-example — `a = "ab"`, `b = "bc"`:

```text
        ""  b  c
   ""    0  1  2
   a     1  1  2
   b     2  1  2
```

Answer `2` (replace `a`→`b`, then `b`→`c`). `dp[2][1] = 1` because `b` matches `b`, carrying the diagonal.

Complexity: `O(n·m)` time and space, reducible to two rows. The relationship worth saying out loud: both align two sequences on the same grid — LCS *maximizes* free diagonal matches, edit distance *minimizes* costed non-matches. With insert and delete only (no replace), the distance is exactly `n + m - 2·LCS(a, b)`.

### What are the two ways to solve Longest Increasing Subsequence and their complexities?

**Quadratic DP.** `dp[i]` = length of the longest increasing subsequence *ending exactly at index `i`*. In plain English: *look back at every earlier element smaller than me; the best chain I can join is the longest of theirs, plus myself.* In symbols: `dp[i] = 1 + max(dp[j])` over all `j < i` with `nums[j] < nums[i]`, defaulting to `1`. The answer is the maximum cell, not `dp[n-1]` — the LIS can end anywhere.

```python
def lis_quadratic(nums):
    n = len(nums)
    dp = [1] * n                    # every element is a length-1 subsequence
    prev = [-1] * n                 # back-pointers for reconstruction
    for i in range(n):
        for j in range(i):
            if nums[j] < nums[i] and dp[j] + 1 > dp[i]:
                dp[i] = dp[j] + 1
                prev[i] = j
    if not n:
        return 0, []
    best = max(range(n), key=lambda i: dp[i])
    seq = []
    while best != -1:               # walk the back-pointers
        seq.append(nums[best])
        best = prev[best]
    return max(dp), list(reversed(seq))
```

Micro-example — `nums = [10, 9, 2, 5, 3, 7, 101, 18]` gives `dp = [1, 1, 1, 2, 2, 3, 4, 4]`, answer `4` (e.g. `[2, 3, 7, 18]`).

**Linearithmic patience sorting.** Keep a `tails` array where `tails[k]` is the smallest possible tail of an increasing subsequence of length `k+1`, binary-searching each new element into it — see the next card.

Complexity: the DP is `O(n²)` time (quadratic — every element scans all earlier ones), `O(n)` space; patience sorting is `O(n log n)` (`n` elements, one binary search each), `O(n)` space. The faster version wins on speed; the quadratic one reconstructs the actual subsequence directly from `prev`.

### For LIS, how does the O(n log n) approach actually work and why is it correct?

Maintain `tails`, where `tails[k]` holds the **minimum possible tail value** over all increasing subsequences of length `k+1` seen so far. For each new element `x`, binary-search the first entry `≥ x` and overwrite it; if none exists, append.

```python
from bisect import bisect_left

def lis_length(nums):
    tails = []                       # tails[k] = min tail of an LIS of length k+1
    for x in nums:
        pos = bisect_left(tails, x)  # first index with tails[pos] >= x
        if pos == len(tails):
            tails.append(x)          # x extends the longest chain
        else:
            tails[pos] = x           # x is a better (smaller) tail for that length
    return len(tails)
```

Trace on `[10, 9, 2, 5, 3, 7, 101, 18]`:

```text
x=10  -> [10]
x=9   -> [9]             a length-1 chain ending lower is strictly better
x=2   -> [2]
x=5   -> [2, 5]          appended: 5 > 2, so a length-2 chain exists
x=3   -> [2, 3]          same length, lower tail
x=7   -> [2, 3, 7]
x=101 -> [2, 3, 7, 101]
x=18  -> [2, 3, 7, 18]
```

Correctness: `tails` stays sorted (a length-`k+1` chain contains a length-`k` prefix with a smaller tail), so binary search is valid. Keeping the smallest tail per length is a greedy exchange argument — a smaller tail is extendable by strictly more future elements and never fewer, so replacing never loses a solution. Two traps: `tails` is **not itself a valid subsequence** in general (its entries can come from incompatible positions), so reconstruction still needs parent pointers; and "strictly increasing" versus "non-decreasing" is `bisect_left` versus `bisect_right`. Complexity `O(n log n)` time, `O(n)` space.

### How does coin change (minimum coins) differ from coin change (number of ways)?

Both are unbounded knapsack in disguise, but one is a `min` recurrence and the other a `sum` — and only the second cares about loop order.

**Minimum coins.** `dp[a]` = fewest coins summing to `a`. In plain English: *the last coin placed is some `c`; what's left is `a - c`, already solved optimally.* In symbols: `dp[a] = 1 + min over coins c ≤ a of dp[a - c]`, with `dp[0] = 0` and `∞` for unreachable amounts.

**Number of ways.** `dp[a]` = number of distinct *combinations* (order irrelevant). Loop order is the whole problem: **coins outer, amount inner**.

```python
def min_coins(coins, amount):
    INF = float("inf")
    dp = [0] + [INF] * amount
    for a in range(1, amount + 1):
        for c in coins:                  # order irrelevant for a min
            if c <= a and dp[a - c] + 1 < dp[a]:
                dp[a] = dp[a - c] + 1
    return -1 if dp[amount] == INF else dp[amount]

def count_ways(coins, amount):
    dp = [0] * (amount + 1)
    dp[0] = 1                            # one way to make 0: take nothing
    for c in coins:                      # OUTER: fix the coin
        for a in range(c, amount + 1):   # INNER ascending: coin reusable
            dp[a] += dp[a - c]
    return dp[amount]
```

Micro-examples. Min coins with `coins = [1, 3, 4]`, `amount = 6` gives `dp = [0, 1, 2, 1, 1, 2, 2]` → `2` (`3 + 3`); greedy would take `4 + 1 + 1 = 3` coins, which is why this is DP and not greedy. Count ways with `coins = [1, 2]`, `amount = 3`: after coin 1, `dp = [1,1,1,1]`; after coin 2, `dp = [1,1,2,2]` → `2` (`1+1+1` and `1+2`). Swap the loops and you get `3`, because `1+2` and `2+1` are counted separately — you've silently switched from **combinations** to **permutations**.

Both are `O(amount · coins)` time — *amounts times coin types* — and `O(amount)` space.

### How do you count paths in a grid with DP?

`dp[i][j]` = number of distinct ways to reach cell `(i, j)`. With moves restricted to down and right, *every path into a cell arrives from directly above or directly left, and those sets are disjoint* — so `dp[i][j] = dp[i-1][j] + dp[i][j-1]`. Seed the top row and left column to `1` (one path along an edge); a blocked cell is `0` so nothing routes through it.

```python
def grid_paths(rows, cols, blocked=()):
    dp = [0] * cols
    dp[0] = 1                                  # start cell
    for i in range(rows):
        for j in range(cols):
            if (i, j) in blocked:
                dp[j] = 0                      # unreachable
            elif j > 0:
                dp[j] += dp[j - 1]             # dp[j] still holds the row above
    return dp[-1]
```

Micro-example — a 3×3 grid, no obstacles:

```text
1  1  1
1  2  3
1  3  6
```

Six paths, matching the closed form `C(4, 2) = 6`. The rolling single row works because each cell needs only the value above (still in `dp[j]` before the update) and the value to the left (`dp[j-1]`, already updated).

Complexity: `O(n·m)` time — one constant-time update per cell — and `O(m)` space rolling, `O(n·m)` for the full table. The minimum-cost-path variant swaps the sum for `cost[i][j] + min(above, left)`: same skeleton, `+` replaced by `min`.

### What is interval DP and what is its typical complexity?

Interval DP defines states over **contiguous ranges**: `dp[i][j]` = optimal answer for the range `i` to `j`. In plain English: *the last operation on this range splits it into a left and a right part; try every split point, solve both halves optimally, add the cost of joining them.* In symbols: `dp[i][j] = best over k in [i, j) of combine(dp[i][k], dp[k+1][j]) + cost(i, k, j)`. The critical detail is the **fill order** — iterate by increasing interval *length* so every sub-range is ready.

```python
def matrix_chain(dims):
    """Matrix i is dims[i-1] x dims[i]; return min scalar multiplications."""
    n = len(dims) - 1                                # number of matrices
    dp = [[0] * n for _ in range(n)]
    for length in range(2, n + 1):                   # by INCREASING length
        for i in range(n - length + 1):
            j = i + length - 1
            dp[i][j] = float("inf")
            for k in range(i, j):                    # every split point
                cost = (dp[i][k] + dp[k + 1][j]
                        + dims[i] * dims[k + 1] * dims[j + 1])
                dp[i][j] = min(dp[i][j], cost)
    return dp[0][n - 1] if n else 0
```

Micro-example — `dims = [10, 30, 5, 60]`: matrices `A` (10×30), `B` (30×5), `C` (5×60). `(AB)C` costs `10·30·5 + 10·5·60 = 4500`; `A(BC)` costs `30·5·60 + 10·30·60 = 27000`. The DP tries both splits and returns `4500` — a six-fold difference from bracket placement alone.

Family members: burst balloons, optimal binary search tree, palindrome partitioning, minimum cost to merge stones. Complexity: `O(n²)` ranges each trying up to `n` splits, so `O(n³)` time — *cubic* — and `O(n²)` space. Fine for `n` in the hundreds, hopeless in the thousands. A few of these satisfy the quadrangle inequality and admit **Knuth's optimization**, dropping it to `O(n²)`.

### When do you reach for bitmask DP and what limits it?

When the state must remember **which subset** of a small set is used or visited, and no cheaper summary (a count, a maximum) suffices — routing that visits every city once, assigning `n` tasks to `n` workers, "cover all elements". Encode the subset in the bits of an integer: bit `i` set means element `i` is used.

The canonical case is **Held–Karp** for TSP: `dp[mask][last]` = cheapest route starting at city 0, visiting exactly the cities in `mask`, currently at `last`.

```python
def tsp(dist):
    n = len(dist)
    INF = float("inf")
    dp = [[INF] * n for _ in range(1 << n)]      # 2^n masks x n endpoints
    dp[1][0] = 0                                 # mask {0}, sitting at city 0
    for mask in range(1 << n):
        for last in range(n):
            if dp[mask][last] == INF or not (mask >> last) & 1:
                continue
            for nxt in range(n):
                if (mask >> nxt) & 1:            # already visited
                    continue
                nmask = mask | (1 << nxt)
                cand = dp[mask][last] + dist[last][nxt]
                if cand < dp[nmask][nxt]:
                    dp[nmask][nxt] = cand
    full = (1 << n) - 1
    return min(dp[full][last] + dist[last][0] for last in range(1, n))
```

The loops give the complexity directly: `2ⁿ` masks × `n` endpoints × `n` next-cities = `O(2ⁿ · n²)` time — *exponential in the number of elements* — with `O(2ⁿ · n)` space. That's a huge win over the `O(n!)` brute force (for `n = 20`, about 4·10⁸ operations versus 2·10¹⁸), but the exponential is a hard wall: `2²⁰` is roughly a million masks, `2³⁰` is infeasible. Bitmask DP is a deliberate "`n ≤ about 20`" tool; proposing it for large `n` is the complexity-judgment failure the interviewer is watching for, where approximation or heuristics are the honest answer.

### How does DP on trees work?

Root the tree anywhere and traverse **post-order**, so every node is processed after all its children. Each node aggregates its children's finished states; the tree has no cycles, so one DFS visits each edge once and the dependency order comes for free.

The classic is **maximum-weight independent set** (pick nodes, no two adjacent, maximize value). Two states per node: `dp[v][0]` with `v` **excluded**, `dp[v][1]` with `v` **included**. In plain English: *if I take `v`, no child may be taken, so I add their excluded answers; if I skip `v`, each child does whatever is best for it.*

```python
import sys

def max_independent_set(adj, value, root=0):
    sys.setrecursionlimit(10 ** 6)
    excl = [0] * len(adj)
    incl = [0] * len(adj)

    def dfs(v, parent):
        incl[v] = value[v]
        excl[v] = 0
        for c in adj[v]:
            if c == parent:
                continue
            dfs(c, v)                        # children first: post-order
            incl[v] += excl[c]               # took v -> children excluded
            excl[v] += max(excl[c], incl[c]) # skipped v -> child chooses freely

    dfs(root, -1)
    return max(incl[root], excl[root])
```

Micro-example — root `r` (value 1) with children `a` (2) and `b` (3). Leaves give `incl[a]=2, excl[a]=0`, `incl[b]=3, excl[b]=0`. Then `incl[r] = 1 + 0 + 0 = 1` and `excl[r] = max(0,2) + max(0,3) = 5`, so the answer is `5` — skip the root, take both children.

Complexity: `O(n)` time — *linear*, one visit per node — and `O(n)` space plus `O(height)` recursion stack (go iterative if the tree can be a 10⁵-deep path). A common follow-up asks the answer *for every node as root*; a fresh DFS per root is `O(n²)`, so use **rerooting**: a second top-down pass handing each child the parent's answer with the child's own contribution removed, keeping it `O(n)`.

### Why is knapsack called "pseudo-polynomial" and why does it matter?

Because `O(n·W)` is polynomial in the numeric **value** of `W`, but the input spends only `log₂ W` bits writing `W` down. Measured against the true input *size* in bits, the runtime is exponential. That gap between "polynomial in the value" and "polynomial in the bit length" is exactly what pseudo-polynomial means.

Why it matters: 0/1 knapsack is **NP-hard**, and this DP is not a proof that P = NP. With `n = 100` items and `W = 10⁴` you fill a million cells — instant. With the same 100 items and `W = 10¹⁸` (a 60-bit number) the table has 10²⁰ cells and no machine will ever build it, even though the input file grew by a handful of characters. No truly polynomial algorithm is known, and none is expected.

The same label attaches to subset-sum and to coin change with a huge target. Interviewers probe it to see whether you distinguish the *value* of a number from the *size* of its encoding. If capacities are astronomically large, the honest answers are a fully-polynomial-time approximation scheme (FPTAS), branch and bound, or meet-in-the-middle at `O(2^(n/2))` for small `n`.

### How would you reconstruct which items are in the optimal knapsack?

Keep the **full 2-D table** — not the rolling row — then walk backwards from `dp[n][W]`, asking at each cell whether the value came from skipping the item or taking it.

```python
def knapsack_items(weights, values, W):
    n = len(weights)
    dp = [[0] * (W + 1) for _ in range(n + 1)]
    for i in range(1, n + 1):
        wi, vi = weights[i - 1], values[i - 1]
        for w in range(W + 1):
            dp[i][w] = dp[i - 1][w]
            if wi <= w:
                dp[i][w] = max(dp[i][w], vi + dp[i - 1][w - wi])
    chosen, w = [], W
    for i in range(n, 0, -1):
        if dp[i][w] != dp[i - 1][w]:      # value changed -> item i was taken
            chosen.append(i - 1)
            w -= weights[i - 1]           # refund its capacity
    return dp[n][W], sorted(chosen)
```

The rule in words: *if `dp[i][w] == dp[i-1][w]`, item `i` changed nothing, so step up to `(i-1, w)`; otherwise it was taken — record it and step to `(i-1, w - weight[i])`.* On the earlier example (`(1,1), (3,4), (4,5)`, `W = 5`, optimum 6): `dp[3][5]=6 ≠ dp[2][5]=5` → take item 3, go to `(2, 1)`; `dp[2][1]=1 = dp[1][1]` → skip item 2; `dp[1][1]=1 ≠ dp[0][1]=0` → take item 1. Chosen `{1, 3}`, weight 5, value 6.

Complexity: the backward walk is `O(n)` — *linear*, one step per item — on top of the `O(n·W)` fill. The trade-off to name out loud: reconstruction needs the history, so it is **incompatible** with the `O(W)` space optimization. If memory is tight, either keep the full table or use Hirschberg's divide-and-conquer trick (standard for LCS) to recover the answer in linear space at roughly double the time.

### How do you tell subsequence problems from substring/subarray problems?

Read the prompt for **contiguous** ("consecutive", "window", "block"). A **subsequence** keeps relative order but allows gaps, so its recurrence may *skip* an element by inheriting a neighbouring state. A **substring/subarray** must be unbroken, so a mismatch **resets** the running state to zero instead of inheriting.

The clearest illustration is longest common *substring* versus LCS on the identical grid:

```python
def longest_common_substring(a, b):
    n, m = len(a), len(b)
    dp = [[0] * (m + 1) for _ in range(n + 1)]
    best = 0
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            if a[i - 1] == b[j - 1]:
                dp[i][j] = dp[i - 1][j - 1] + 1     # extend the run
            else:
                dp[i][j] = 0                        # RESET, not max()
            best = max(best, dp[i][j])
    return best                                     # answer is the max cell
```

Two diagnostic differences from LCS: the mismatch branch is `0` rather than `max(dp[i-1][j], dp[i][j-1])`, and the answer is the **maximum over all cells** rather than the bottom-right corner (a contiguous run can end anywhere). On `a = "ABCB"`, `b = "BDCB"`, LCS is `3` (`"BCB"`) but the longest common substring is only `1`. Same `O(n·m)` grid, one changed line, completely different answer.

The fork recurs elsewhere: maximum-sum **subarray** is Kadane's algorithm (`best_here = max(x, best_here + x)` — the `max(x, ...)` is the reset, discarding a negative prefix), whereas maximum-sum *subsequence* is trivially "add all the positives". LIS is a subsequence problem; longest increasing *run* is contiguous and needs only a counter. Which one the prompt wants decides whether your transition **inherits or resets** — one of the most common sources of a confidently wrong DP answer.

### A senior follow-up: how would you approach a DP problem you have never seen before?

Match it to the nearest archetype by its **shape**, not its story, working a fixed checklist out loud:

1. **What am I choosing?** A subset (knapsack), an alignment of two sequences (LCS grid), a chain to extend (LIS), a path (grid DP), a partition of a range (interval DP), an ordering over a tiny set (bitmask), or a selection on a tree (tree DP).
2. **What must the state remember?** An index, a remaining budget, a visited set, a range, a "have I used my one free skip" flag. Under-specify it and distinct subproblems collide; over-specify it and the table explodes.
3. **Write the archetype's recurrence, then bend it.** "Knapsack with two capacities" is `dp[i][w1][w2]`; "LCS allowing at most `k` mismatches" is `dp[i][j][k]`. Adding a dimension to a known recurrence is far safer than inventing one.
4. **Sanity-check feasibility before coding**: `time = states × transition cost`. If that lands at 10¹² operations, the state is wrong — go back to step 2 and find a cheaper summary.
5. **Choose the implementation.** Top-down memoization if the state space is sparse or the order is awkward; bottom-up tabulation if you'll want a rolling array. Correct full table first, space optimization second.
6. **Pin down the base cases and the answer cell.** Is the answer `dp[n][m]`, or the max over all cells (LIS, longest common substring)? Getting this wrong is a common way to fail an otherwise correct recurrence.

Fast heuristics worth stating: `n ≤ 20` suggests a bitmask; two input sequences suggest an LCS-style grid; a range or a "merge adjacent things" story suggests interval DP; a budget or capacity suggests knapsack; a tree means post-order aggregation. And always run the tiniest instance by hand before writing code — a three-element example that breaks the recurrence saves the whole interview.

## Graph Traversal & Topological Sort

### Summary

**What this topic covers**
Systematic ways to visit every vertex and edge of a graph, and the structural facts those visits reveal. **Breadth-first search (BFS)** and **depth-first search (DFS)** are the two engines; everything else here is a thin layer bolted on top of one of them — connected components, topological sort, cycle detection, bipartite checking, DFS edge classification. All run in `O(V + E)` — "one visit per vertex plus one look at each edge" — on an adjacency-list graph. The traversal is cheap and nearly identical every time; the value is in what you *extract* while traversing.

**Mental model**
A graph is a maze and you're an explorer with a to-do list of rooms. **BFS is a flood**: pour water in at the source and it spreads outward one ring at a time, so every room is first reached by the shortest route. The to-do list is a **queue** — it always holds rooms at distance `d` followed by rooms at distance `d + 1`, which is why BFS hands you shortest hop counts for free. **DFS is one explorer with a ball of string**: walk down a corridor as far as it goes, and only when stuck back up to the last junction and try the next one. The to-do list is a **stack**, usually the language's own call stack. Because DFS *finishes* a room only after everything downstream of it is finished, it produces a natural "I'm done and so is everything I depend on" ordering — exactly what topological sort needs. The `visited` set is identical in both, and it's the entire reason the cost is linear rather than exponential.

**Key terms**
- **BFS** — level-order traversal using a queue; gives shortest paths in *unweighted* graphs.
- **DFS** — go-deep traversal using recursion or an explicit stack; backtracks when stuck.
- **Adjacency list** — `graph[u]` is the list of `u`'s neighbours; what makes traversal `O(V + E)`.
- **Connected component** — a maximal mutually-reachable set of vertices (undirected).
- **DAG** — directed acyclic graph: a directed graph with no cycles.
- **Topological sort** — a linear ordering of a DAG in which every edge points forward.
- **In-degree** — how many edges point *into* a vertex; the counter Kahn's drains.
- **Back edge** — a DFS edge to an ancestor still on the recursion stack; signature of a directed cycle.
- **Bipartite** — 2-colourable so that no edge joins two same-coloured vertices.
- **Strongly connected** (directed) — every pair of vertices mutually reachable.

**Core mechanics**
BFS: enqueue the source and mark it visited *when you enqueue it, not when you pop it*; then repeatedly dequeue a vertex and enqueue its unvisited neighbours. DFS: recurse into an unvisited neighbour, backtrack when all neighbours are visited; the recursion gives you discovery and finish times for free. Both are `O(V + E)` with adjacency lists — every vertex processed once, every adjacency list scanned once — and `O(V²)` with an adjacency matrix, where finding a vertex's neighbours means scanning a whole row however few edges exist. Topological sort has two flavours. **Kahn's**: repeatedly emit a vertex with in-degree `0` and decrement its neighbours' in-degrees; emitting fewer than `V` vertices means the leftovers are trapped in a cycle. **DFS-based**: append each vertex when it *finishes*, then reverse. Cycle detection: undirected needs "visited neighbour that isn't my parent"; directed needs the stronger "neighbour currently *on the recursion stack*". Bipartite check: 2-colour during BFS or DFS and fail on a same-coloured edge.

**Trade-offs**
BFS gives shortest unweighted paths, but the frontier can be wide — up to `O(V)` in the queue at once (a star graph enqueues everything). DFS uses memory proportional to path *depth*, often far less, and is the natural fit for topological order, cycle detection, and edge classification — but a 100,000-node chain blows Python's default recursion limit, so you convert to an explicit stack. Kahn's versus DFS topological sort: Kahn's detects cycles with a clean count check, is iterative, and lets you break ties deterministically by swapping the queue for a heap; DFS is terser and reuses finish-time structure. Neither BFS nor DFS handles *weighted* shortest paths — that's Dijkstra and Bellman-Ford territory.

**Common confusions**
Using BFS for shortest paths on a **weighted** graph — it only works when all edges cost the same. Marking visited on *dequeue* instead of *enqueue*, which lets a vertex enter the queue repeatedly. Directed versus undirected cycle detection: the directed case needs the *on-stack* distinction, not merely "visited", because an edge into an already-*finished* vertex closes no loop. Forgetting the parent exception undirected — the edge back the way you came is the same edge, not a cycle. Assuming a topological order is unique; it usually isn't. Expecting topological sort to work on a cyclic graph — it can't, and both algorithms *report* the violation rather than fail silently.

**Why interviewers ask**
Graph traversal is the substrate for a huge share of real problems: dependency resolution, build systems, scheduling, deadlock detection, network reachability, package managers, spreadsheet recalculation. Interviewers want to see you pick BFS versus DFS for a *reason*, state and justify the `O(V + E)` bound, and layer a structural query — cycle, order, component, colouring — on top of a bare traversal without rewriting it. The standard escalation on any traversal question is "now detect a cycle" or "now produce a valid build order", so both topological sorts and both cycle detections are high-leverage to know cold.

### When should you use BFS versus DFS?

Use **BFS** when you need shortest paths in an *unweighted* graph, level-by-level processing, or a minimum number of steps — its queue visits vertices in nondecreasing distance from the source. Use **DFS** when you need to go deep: topological sort, cycle detection, edge classification, connected components, enumerating all paths. Both are `O(V + E)`; the choice is about what structure you need, not speed. The memory profiles differ: DFS costs stack depth (longest path), BFS costs frontier width (widest level).

Everything starts with an adjacency list built from an edge list:

```python
from collections import defaultdict, deque

def build_graph(n, edges, directed=False):
    g = defaultdict(list)
    for u, v in edges:
        g[u].append(v)
        if not directed:
            g[v].append(u)      # undirected: store the edge both ways
    for u in range(n) if isinstance(n, int) else n:
        g.setdefault(u, [])     # isolated vertices still need an entry
    return g

def bfs(g, src):
    seen = {src}                            # mark on ENQUEUE, not on dequeue
    q = deque([src])
    order = []
    while q:
        u = q.popleft()                     # FIFO -> nearest first
        order.append(u)
        for v in g[u]:
            if v not in seen:
                seen.add(v)
                q.append(v)
    return order

def dfs(g, u, seen=None, order=None):
    seen = set() if seen is None else seen
    order = [] if order is None else order
    seen.add(u)
    order.append(u)                         # pre-order: record on entry
    for v in g[u]:
        if v not in seen:
            dfs(g, v, seen, order)
    return order
```

Micro-example on the directed graph `A→B, A→C, B→D, C→D`. BFS from `A`: queue `[A]` → pop `A`, push `B`, `C` → queue `[B, C]` → pop `B`, push `D` → queue `[C, D]` → pop `C` (`D` already seen) → pop `D`. Visit order `A, B, C, D`, distances `0, 1, 1, 2`. DFS from `A`: enter `A` → enter `B` → enter `D` (dead end, back up) → back to `A` → enter `C` (`D` already visited). Visit order `A, B, D, C`. Same graph, same cost, different shape.

### Why are BFS and DFS both O(V + E)?

Two separate charges add up. First, each vertex is marked visited and processed exactly once — you never re-enter a visited vertex — giving `O(V)`. Second, when you process a vertex you scan its adjacency list once; summing those lengths over all vertices scans every edge exactly once in a directed graph, twice in an undirected one (each edge sits in both endpoints' lists), giving `O(E)`. Total `O(V + E)`: one visit per vertex plus one look at each edge. The `V` term matters on its own because a graph can have many vertices and no edges — you still touch them all.

This bound assumes **adjacency lists**. With an **adjacency matrix**, asking "who are `u`'s neighbours?" means scanning a whole row of length `V` however few edges exist, so traversal becomes `O(V²)` — a quadratic blow-up on a sparse graph where `E ≈ V`. That's why real graph code uses adjacency lists, and why matrices are reserved for dense graphs or algorithms that genuinely need `O(1)` edge lookups.

### How do you find connected components in an undirected graph?

Loop over every vertex. Whenever you hit an unvisited one, launch a fresh BFS or DFS from it and stamp everything reachable with the same component id, then increment the id. Each traversal captures exactly one maximal mutually-reachable set, and since the traversals collectively touch each vertex and edge once, the *total* cost is `O(V + E)` — not `O(V + E)` per component.

```python
def connected_components(g, vertices):
    comp = {}                    # vertex -> component id
    cid = 0
    for s in vertices:
        if s in comp:
            continue
        q = deque([s])           # one BFS per undiscovered component
        comp[s] = cid
        while q:
            u = q.popleft()
            for v in g[u]:
                if v not in comp:
                    comp[v] = cid
                    q.append(v)
        cid += 1
    return comp, cid
```

Micro-example: undirected edges `1-2, 2-3, 4-5`, plus an isolated vertex `6`. Start at `1` → BFS reaches `1, 2, 3`, all stamped component `0`. Next unvisited is `4` → BFS reaches `4, 5`, component `1`. Next is `6` → BFS reaches only itself, component `2`. Result: three components. The directed analogue — **strongly connected components** — is *not* solvable by a plain traversal; reachability from `u` to `v` doesn't imply the reverse, so you need Tarjan's or Kosaraju's algorithm.

### Explain Kahn's algorithm for topological sort.

Kahn's is BFS applied to prerequisites. Compute every vertex's **in-degree** (how many edges point at it). Enqueue every vertex with in-degree `0` — those have no prerequisites and can go first. Then repeatedly dequeue a vertex, append it to the output, and decrement each neighbour's in-degree; when a neighbour's count hits `0` its last prerequisite is satisfied, so enqueue it. Stop when the queue empties.

```python
def kahn(g, vertices):
    indeg = {u: 0 for u in vertices}
    for u in vertices:
        for v in g[u]:
            indeg[v] += 1
    q = deque(u for u in vertices if indeg[u] == 0)
    out = []
    while q:
        u = q.popleft()
        out.append(u)
        for v in g[u]:
            indeg[v] -= 1        # one prerequisite of v is now satisfied
            if indeg[v] == 0:
                q.append(v)
    if len(out) < len(indeg):    # some vertices never freed -> cycle
        return None
    return out
```

Micro-example on `A→B, A→C, B→D, C→D`. In-degrees: `A:0, B:1, C:1, D:2`. Queue starts `[A]`. Pop `A`, emit it, decrement `B→0` and `C→0`, queue `[B, C]`. Pop `B`, emit, decrement `D→1`; `D` isn't ready, queue `[C]`. Pop `C`, emit, decrement `D→0`, queue `[D]`. Pop `D`, emit. Output `A, B, C, D` — 4 of 4 vertices, so no cycle. Cost is `O(V + E)`: each vertex is enqueued once and each edge is decremented once. The count check at the end is the whole cycle-detection story — if a cycle exists, every vertex in it permanently retains at least one incoming edge from another cycle member and can never reach in-degree `0`.

### How does DFS produce a topological ordering?

Run DFS and record each vertex the moment it **finishes** — that is, after every vertex reachable from it has already finished. Then reverse that finish list. The result is a valid topological order.

The correctness argument is one sentence: for any edge `u → v`, `v` always finishes before `u` (either DFS descends into `v` from `u` and returns, or `v` was already done before `u` started), so in the *reversed* finish order `u` comes before `v` — every edge points forward.

```python
def dfs_topo(g, vertices):
    WHITE, GREY, BLACK = 0, 1, 2
    color = {u: WHITE for u in vertices}
    out = []
    def visit(u):
        color[u] = GREY                  # on the recursion stack
        for v in g[u]:
            if color[v] == GREY:
                raise ValueError("cycle detected")
            if color[v] == WHITE:
                visit(v)
        color[u] = BLACK                 # finished: all descendants done
        out.append(u)                    # post-order append
    for u in vertices:
        if color[u] == WHITE:
            visit(u)
    return out[::-1]                     # reverse the finish order
```

Micro-example on `A→B, A→C, B→D, C→D`. Visit `A` (grey) → visit `B` (grey) → visit `D` (grey, no out-edges) → `D` finishes, `out = [D]` → `B` finishes, `out = [D, B]` → back at `A`, visit `C` → `C` sees `D` already black (fine, not a cycle) → `C` finishes, `out = [D, B, C]` → `A` finishes, `out = [D, B, C, A]`. Reversed: `A, C, B, D`. A different valid order from Kahn's `A, B, C, D` — both are correct. Cost `O(V + E)`.

### How do you detect a cycle in a directed graph?

Run DFS with **three colours**. *White* means unvisited, *grey* means currently on the recursion stack (entered but not finished), *black* means fully finished. If DFS ever follows an edge to a **grey** vertex, that vertex is an ancestor of the current one, the edge is a **back edge**, and you have a cycle. An edge to a black vertex is harmless — it's a cross or forward edge into a subtree that's already completely explored.

```python
def has_cycle_directed(g, vertices):
    WHITE, GREY, BLACK = 0, 1, 2
    color = {u: WHITE for u in vertices}
    def visit(u):
        color[u] = GREY
        for v in g[u]:
            if color[v] == GREY:         # back edge to an ancestor
                return True
            if color[v] == WHITE and visit(v):
                return True
        color[u] = BLACK                 # leaving u: no longer an ancestor
        return False
    return any(color[u] == WHITE and visit(u) for u in vertices)
```

Micro-example on `A→B, B→C, C→A`. Enter `A` (grey), enter `B` (grey), enter `C` (grey), `C` looks at `A` — grey — cycle found. Contrast with the DAG `A→B, A→C, B→D, C→D`: when `C` looks at `D`, `D` is already **black** (it finished under `B`), so no cycle is reported. That single colour distinction is the entire difference between a correct algorithm and one that cries wolf on every diamond. The alternative is to run Kahn's and check whether it emitted fewer than `V` vertices — same `O(V + E)` cost, no recursion.

### How does cycle detection differ for undirected graphs?

In an undirected graph you don't need colours — plain `visited` plus the **parent** you came from is enough. Traverse; if you reach a vertex that's already visited **and it isn't your parent**, you've closed a loop. The parent exception exists because the edge `u — v` is stored in both `g[u]` and `g[v]`, so walking from `u` to `v` and immediately seeing `u` in `v`'s list is just the same edge looked at twice, not a cycle.

```python
def has_cycle_undirected(g, vertices):
    seen = set()
    def visit(u, parent):
        seen.add(u)
        for v in g[u]:
            if v == parent:              # the edge we just came along
                continue
            if v in seen or visit(v, u): # visited non-parent -> cycle
                return True
        return False
    return any(u not in seen and visit(u, None) for u in vertices)
```

Micro-example: undirected `A-B, B-C, C-A`. Enter `A` (parent `None`), go to `B` (parent `A`), go to `C` (parent `B`), `C` sees `A` — visited, not its parent — cycle. Now the tree `A-B, B-C`: from `C` the only neighbour is `B`, which *is* the parent, so it's skipped and nothing is reported. Caveat: with parallel edges the parent check by vertex id wrongly skips the second one, so track *edge* ids instead. Union-find also works — if an edge's endpoints already share a set, it closes a cycle.

### Why can't plain "visited" tracking detect cycles in directed graphs?

Because a directed edge into an already-visited vertex is not necessarily a cycle. Take the diamond `A→B, A→C, B→D, C→D`. DFS goes `A → B → D`, finishes `D`, finishes `B`, then explores `C` and finds `D` already visited. With a single visited flag you'd shout "cycle!" — but there is none; you can't get from `D` back to `C`.

The fix is to distinguish "visited and still open" from "visited and done". A cycle exists only when the edge targets a vertex still **on the recursion stack** — an ancestor, meaning there's a path from the target down to you *and* an edge from you back to it. That's grey. A black vertex has been popped off the stack entirely; nothing reached through it leads back to the current path. Collapsing grey and black into one flag produces false positives on every diamond, every shared subtree, every re-converging branch — which is most real graphs. (Undirected graphs escape this because their edges are symmetric: an edge to a visited non-parent vertex genuinely does close a loop.)

### How do you check whether a graph is bipartite?

Attempt a **2-colouring**. Colour a source vertex `0`, then colour every neighbour the opposite colour of the vertex you came from, propagating with BFS or DFS. If you ever find an edge whose endpoints already share a colour, the graph is not bipartite. If you get through every component with no conflict, it is.

```python
def is_bipartite(g, vertices):
    color = {}
    for s in vertices:
        if s in color:
            continue
        color[s] = 0
        q = deque([s])                   # fresh BFS per component
        while q:
            u = q.popleft()
            for v in g[u]:
                if v not in color:
                    color[v] = 1 - color[u]   # flip
                    q.append(v)
                elif color[v] == color[u]:    # same-colour edge
                    return False
    return True
```

Micro-example: the 4-cycle `A-B, B-C, C-D, D-A`. Colour `A = 0`; `B = 1`, `D = 1`; from `B`, `C = 0`; from `D`, `C` is already `0` and `D` is `1` — no conflict, so bipartite (`{A, C}` versus `{B, D}`). Now the triangle `A-B, B-C, C-A`: `A = 0`, `B = 1`, `C = 0`, then edge `C-A` joins two `0`s — conflict, not bipartite. Cost `O(V + E)`. Equivalently, a graph is bipartite **iff it has no odd-length cycle**, and a colouring conflict is exactly the moment you close one. The fresh traversal per unvisited vertex is essential — a disconnected graph is bipartite only if every component is.

### What are the DFS edge classifications and what does each mean?

Every edge falls into one of four classes relative to the DFS tree, decided by the colour of the target when you look at it. **Tree edges** are the ones DFS actually traverses to reach a *white* vertex; together they form the DFS forest. **Back edges** point to a *grey* vertex — an ancestor still on the recursion stack — and in a directed graph their presence is exactly equivalent to a cycle. **Forward edges** point to a *black* descendant of the current vertex, reached earlier by a longer tree path. **Cross edges** point to a *black* vertex in a different subtree — neither ancestor nor descendant.

Forward and cross are told apart by discovery times: for an edge `u → v` into a black `v`, `disc[u] < disc[v]` means forward, otherwise cross. **Undirected graphs only ever have tree and back edges** — a would-be forward or cross edge would already have been traversed as a tree edge from the other end. This isn't trivia: it's the machinery behind directed cycle detection (back edge), Tarjan's strongly-connected-component algorithm, and bridge and articulation-point finding, which ask how far back a subtree's back edges reach.

### Is a topological ordering unique?

Generally no. Whenever two vertices have no directed path between them in either direction, they're mutually independent and can appear in either relative order, so a typical DAG has many valid topological sorts. In the diamond `A→B, A→C, B→D, C→D`, both `A, B, C, D` and `A, C, B, D` are valid — `B` and `C` are unordered relative to each other.

An ordering is unique exactly when the DAG contains a **Hamiltonian path** — a single directed chain through every vertex, forcing a total order. In Kahn's terms: "at every step the queue holds exactly one vertex"; if it ever holds two, you have a genuine choice and therefore at least two valid orders. Interviewers use this to check you say "*a* valid order" rather than "*the* order". If a specific order is required, add a tie-break: swap Kahn's `deque` for a min-heap and you get the lexicographically smallest topological sort in `O((V + E) log V)`.

### Can you run topological sort on a graph with a cycle?

No — topological sort is defined only for a DAG, and the reason is immediate: for a cycle `A→B→C→A`, a valid order would need `A` before `B`, `B` before `C`, and `C` before `A`, which is a contradiction. No linear arrangement can make all three edges point forward.

What matters in an interview is that both algorithms **detect** this rather than fail silently or loop forever. Kahn's emits fewer than `V` vertices — the cyclic ones never reach in-degree `0`, each held up by another cycle member — so `len(out) < V` is your flag, and the leftovers *are* the cyclic part, handy for error reporting. DFS-based sorting hits a back edge into a grey vertex and bails immediately. Often that detection is the actual goal: a build system reporting "circular dependency between `auth`, `config`, and `logging`" is running exactly this check and printing the vertices it couldn't order.

### How does BFS give shortest paths, and when does that break?

BFS's queue holds vertices in nondecreasing order of distance from the source: all the distance-`d` vertices come out before any distance-`d + 1` vertex. So the *first* time you reach a vertex is necessarily via a minimum-hop path, and you can record `dist[v] = dist[u] + 1` at the moment you enqueue it. Storing a parent pointer at the same time lets you rebuild the actual path by walking backwards from the target.

```python
def bfs_shortest(g, src, dst):
    dist = {src: 0}
    parent = {src: None}
    q = deque([src])
    while q:
        u = q.popleft()
        if u == dst:
            break                        # early exit: dst is finalised
        for v in g[u]:
            if v not in dist:
                dist[v] = dist[u] + 1    # first arrival = shortest
                parent[v] = u
                q.append(v)
    if dst not in dist:
        return None, None
    path, cur = [], dst
    while cur is not None:               # walk parents back to src
        path.append(cur)
        cur = parent[cur]
    return dist[dst], path[::-1]
```

Micro-example on `A→B, A→C, B→D, C→D`, source `A`, target `D`. Pop `A` (`dist 0`) → set `dist[B] = dist[C] = 1`, `parent[B] = parent[C] = A`. Pop `B` → set `dist[D] = 2`, `parent[D] = B`. Pop `C` → `D` already has a distance, skip. Pop `D`, break. Reconstruction walks `D → B → A`, reversed to `A, B, D`, length 2.

This is exact only for **unweighted** graphs, or graphs where every edge has equal weight. It breaks the instant weights differ: a two-hop path costing `1 + 1` beats a one-hop path costing `10`, and BFS — which counts hops, not cost — confidently returns the expensive one. Then you need Dijkstra (non-negative weights) or Bellman-Ford (negatives allowed). Useful middle case: **0-1 BFS**, where edges cost only `0` or `1` — use a `deque`, push zero-weight neighbours to the *front* and one-weight to the back, and you keep `O(V + E)`.

### How would you detect deadlock or a circular dependency in a real system with these tools?

Model it as a directed graph and run cycle detection — that's the whole trick. For deadlock, vertices are threads or transactions and an edge `T1 → T2` means "`T1` is waiting on a lock held by `T2`"; this is the classic *waits-for* graph, and a cycle in it *is* a deadlock. For build systems and package managers, vertices are targets or packages and edges are "depends on"; a cycle is an unsatisfiable circular dependency, and the absence of one lets you emit a topological order as the build sequence.

Either technique works. Pick Kahn's when you also want the order as output and want to avoid recursion limits on large dependency graphs; pick DFS when you want to *report the offending loop* — keep parent pointers, and when a back edge closes onto a grey vertex `w`, walk parents back from the current vertex until you hit `w` to print the exact cycle, `auth → config → logging → auth`. That message is usually worth more than the boolean. Databases run this continuously: a deadlock detector periodically builds the waits-for graph, finds a cycle, and aborts the cheapest transaction in it to break the loop.

### A senior follow-up: how do you avoid stack overflow when DFS-ing a very deep or large graph?

Convert the recursion into an **explicit stack** on the heap. Python's default recursion limit is about 1,000 frames, so a graph shaped like a long chain — a linked list, a deep dependency tree, a 200×200 grid traversed badly — will crash a recursive DFS long before it runs out of actual memory.

The pre-order version is a direct swap of the queue for a stack:

```python
def dfs_iterative(g, src):
    seen = {src}
    stack = [src]
    order = []
    while stack:
        u = stack.pop()                  # LIFO -> depth-first
        order.append(u)
        for v in reversed(g[u]):         # reversed = same order as recursion
            if v not in seen:
                seen.add(v)
                stack.append(v)
    return order
```

Post-order needs more care, because "finished" means *after* all descendants — and topological sort, finish times, and three-colour cycle detection all depend on it. The clean trick is to push each vertex twice with an entering/leaving marker:

```python
def dfs_postorder_iterative(g, vertices):
    seen = set()
    out = []
    for s in vertices:
        if s in seen:
            continue
        stack = [(s, False)]             # (vertex, is_leaving)
        while stack:
            u, leaving = stack.pop()
            if leaving:
                out.append(u)            # all descendants already appended
                continue
            if u in seen:
                continue
            seen.add(u)
            stack.append((u, True))      # schedule the "finish" event
            for v in g[u]:
                if v not in seen:
                    stack.append((v, False))
    return out[::-1]                     # reversed post-order = topo sort
```

The alternative is to store a neighbour index per stack frame so you resume a vertex's scan after each child returns — fiddlier, but no duplicate entries. Either way you trade the language's bounded call stack for a heap-allocated one that can grow to `O(V)`, and the complexity stays `O(V + E)`. Raising Python's recursion limit is the common quick patch, but it's fragile — the explicit stack is the real fix, and mentioning it unprompted signals you've shipped graph code.

## Shortest Path Algorithms

### Summary

**What this topic covers**
The algorithms that find cheapest routes through a graph: **BFS** for unweighted graphs, **0-1 BFS** for weights of only 0 or 1, **Dijkstra** for non-negative weights, **Bellman-Ford** for negative edges (plus negative-cycle detection), **DAG relaxation** in topological order, **Floyd-Warshall** for all-pairs, **Johnson's** for all-pairs on sparse graphs with negatives, and **A\*** for goal-directed search. Every one is built from a single three-line primitive — *edge relaxation* — and they differ only in **the order they relax edges** and **what that order lets them assume**.

**Mental model**
Picture `dist[v]` as "the cheapest route to `v` I have found *so far*" — a pessimistic guess starting at `∞` that only ever goes down. Relaxing edge `(u, v, w)` asks one question: *is going to `u` and then taking this edge cheaper than what I already had for `v`?* If yes, lower the guess. That is the whole toolbox. Correctness of every algorithm here reduces to one claim: **by the time you declare `dist[v]` final, every edge that could still have lowered it has already been relaxed.** BFS earns that by exploring in layers; Dijkstra by always finalising the currently-cheapest vertex; Bellman-Ford by brute force (relax everything `V-1` times, so a path of any length gets its chance); DAG relaxation by topological order (all predecessors finalised first); Floyd-Warshall by widening the set of allowed intermediate vertices one at a time.

**Key terms**
- **Edge relaxation** — the update `if dist[u] + w < dist[v]: dist[v] = dist[u] + w`; the primitive all these algorithms share.
- **Non-negative weights** — no edge below 0; the precondition Dijkstra's greedy choice depends on.
- **Settled / finalised** — a vertex whose distance can no longer improve. Not the same as "seen" or "in the queue".
- **Negative cycle** — a loop summing below zero; makes "shortest path" meaningless because each extra lap is cheaper.
- **Single-source** — cheapest routes from one origin to all vertices. **All-pairs** — every ordered pair.
- **Admissible heuristic** — an A\* estimate `h(v)` that never *over*estimates the true remaining cost.
- **Parent array** — records who improved you, so the path itself (not just its length) can be recovered.

**Core mechanics**
BFS explores in hop-layers, so the *first* arrival at a vertex is already optimal: `O(V + E)`, linear in vertices plus edges. 0-1 BFS keeps that linearity with a deque — weight-0 edges push to the **front**, weight-1 edges to the **back**. Dijkstra generalises BFS with a min-heap: pop the cheapest unsettled vertex, declare it final, relax its out-edges — `O((V + E) log V)`, roughly "one heap operation per edge, each costing a logarithm". Bellman-Ford ignores ordering and relaxes *every* edge `V-1` times: `O(V·E)`, "vertices times edges"; a `V`-th round that still improves something proves a negative cycle. DAG relaxation in topological order is `O(V + E)` and uniquely tolerates negative weights. Floyd-Warshall is DP over the allowed intermediate set with `k` outermost: `O(V³)` time (a cube in the vertex count), `O(V²)` space. A\* is Dijkstra keyed on `f(v) = g(v) + h(v)`.

**Trade-offs**
BFS is fastest but only correct when every edge costs the same. Dijkstra is the default for one source with non-negative weights, but *cannot* handle negatives and no amount of re-pushing patches that. Bellman-Ford's `O(V·E)` buys exactly two things: negative edges and cycle detection. Floyd-Warshall wins on small or dense graphs when you want the whole matrix; on large sparse graphs, Dijkstra-from-every-source at `O(V·(V + E) log V)` beats `O(V³)` comfortably. A\* can explore a fraction of what Dijkstra does given a good heuristic, but degenerates to exactly Dijkstra when `h = 0`.

**Common confusions**
The classic trap: *"add a constant to every weight so nothing is negative, then run Dijkstra."* Wrong — a constant per **edge** penalises many-hop paths more than few-hop ones, silently flipping which route is shortest. Second: believing Dijkstra *detects* negative edges. It doesn't; it returns a plausible wrong number. Third: conflating "in the heap" with "settled" — a vertex may sit in the heap several times with different keys, and is final only when **popped**. Fourth: thinking A\* is always optimal — only with an admissible heuristic (consistent, for the settle-once graph-search variant). Fifth: writing Floyd-Warshall with `k` inside, which produces right answers on some graphs and wrong ones on others.

**Why interviewers ask**
Shortest paths test whether you *match the algorithm to the graph's properties* rather than reaching for the one you memorised. The follow-up chain is almost scripted: "unweighted?" → BFS; "weights 0 or 1?" → 0-1 BFS; "non-negative?" → Dijkstra; "a DAG?" → topological relaxation; "negative edges?" → Bellman-Ford; "all pairs, dense?" → Floyd-Warshall; "all pairs, sparse, negatives?" → Johnson's; "huge grid with a known target?" → A\*. It also probes *why* Dijkstra's greedy step is valid and *why* negatives break it — one of the cleanest understanding-versus-memorisation signals in the interview.

### What does it mean to relax an edge, and why is it the core operation?

Relaxing edge `(u, v)` with weight `w` means: *if reaching `u` then taking this edge is cheaper than the best route to `v` I currently know, adopt it.* The name comes from treating `dist[v]` as an over-tight upper bound that you gradually "relax" downward toward the truth.

```python
def relax(u, v, w, dist, parent):
    """The one primitive. Returns True if dist[v] improved."""
    if dist[u] + w < dist[v]:          # cheaper route found
        dist[v] = dist[u] + w          # lower the estimate
        parent[v] = u                  # remember who improved us
        return True
    return False
```

Every algorithm here is that function plus a **schedule**: BFS in hop-layer order, 0-1 BFS in deque order, Dijkstra in increasing-distance order, DAG relaxation in topological order, Bellman-Ford in "all edges, repeatedly" order, Floyd-Warshall by allowed intermediate vertex. Two properties hold throughout: `dist[v]` is never *below* the true distance (it only ever records a real path's cost), and it never increases. So the only question any of these algorithms answers is *when am I allowed to stop?*

### Why does plain BFS give shortest paths on an unweighted graph?

BFS visits vertices in non-decreasing hop-distance: layer 0, then every layer-1 vertex, then layer-2. Because every edge costs 1, the *first* arrival at a vertex must be by a minimum-hop route — any later arrival comes from a same-or-deeper layer and cannot be shorter. That guarantee is what lets BFS use a plain FIFO queue instead of a heap, in `O(V + E)`.

```python
from collections import deque

def bfs_dist(adj, src):                      # adj: {u: [v, ...]}, unweighted
    dist = {src: 0}
    parent = {src: None}
    q = deque([src])
    while q:
        u = q.popleft()                      # FIFO = layer order
        for v in adj[u]:
            if v not in dist:                # first arrival is optimal
                dist[v] = dist[u] + 1
                parent[v] = u
                q.append(v)
    return dist, parent
```

**0-1 BFS** extends this to weights of only 0 or 1, still `O(V + E)`. Use a **deque**: a weight-0 edge does not increase the distance, so front-push that neighbour; a weight-1 edge back-pushes. The deque then holds at most two distinct distance values, in order — the monotone frontier a heap would give you, without the logarithm.

```python
def zero_one_bfs(adj, src, n):               # adj: {u: [(v, w) with w in {0,1}]}
    INF = float("inf")
    dist = [INF] * n
    dist[src] = 0
    dq = deque([src])
    while dq:
        u = dq.popleft()
        for v, w in adj[u]:
            if dist[u] + w < dist[v]:        # same relax step
                dist[v] = dist[u] + w
                dq.appendleft(v) if w == 0 else dq.append(v)
    return dist
```

Trace `0→1 (0)`, `0→2 (1)`, `1→2 (1)`, `2→3 (0)`. Start `dist = [0, ∞, ∞, ∞]`, deque `[0]`. Pop `0`: the 0-edge sets `dist[1] = 0`, front-pushed; the 1-edge sets `dist[2] = 1`, back-pushed → `[1, 2]`. Pop `1`: `0 + 1 = 1` is not below `dist[2] = 1`, no change. Pop `2`: the 0-edge gives `dist[3] = 1`. Final `dist = [0, 0, 1, 1]`.

### How does Dijkstra's algorithm work, step by step?

Set `dist[source] = 0`, everything else `∞`, push `(0, source)` into a min-heap. Repeatedly pop the smallest key; if that vertex is already settled, discard the entry; otherwise **settle** it (its distance is now final) and relax each out-edge, pushing improved neighbours back. Stop when the heap empties, or early once you pop the target.

The subtlety worth naming aloud is **lazy deletion**. Binary heaps cannot decrease the key of an item already inside, so instead of updating an entry you push a *new* one and skip the stale one when it surfaces. Hence the `if d > dist[u]: continue` guard, and hence a heap holding up to `O(E)` entries.

```python
import heapq

def dijkstra(adj, src):                      # adj: {u: [(v, w) with w >= 0]}
    dist = {src: 0}
    parent = {src: None}
    pq = [(0, src)]                          # (tentative distance, vertex)
    while pq:
        d, u = heapq.heappop(pq)
        if d > dist.get(u, float("inf")):
            continue                         # stale entry: u already settled
        for v, w in adj.get(u, ()):
            nd = d + w
            if nd < dist.get(v, float("inf")):
                dist[v] = nd                 # relax
                parent[v] = u
                heapq.heappush(pq, (nd, v))  # push, never decrease-key
    return dist, parent
```

Trace on `A→B (4)`, `A→C (1)`, `C→B (2)`, `B→D (5)`, `C→D (8)` from `A`. Pop `(0,A)` → settle `A`; `dist[B] = 4`, `dist[C] = 1`; heap `[(1,C), (4,B)]`. Pop `(1,C)` → settle `C`; `C→B` gives `1 + 2 = 3 < 4`, so `dist[B] = 3`, `parent[B] = C`; `C→D` gives `dist[D] = 9`; heap `[(3,B), (4,B), (9,D)]`. Pop `(3,B)` → settle; `B→D` gives `3 + 5 = 8 < 9`, push `(8,D)`. Pop `(4,B)` → stale, skipped. Pop `(8,D)` → settle at 8. Answer `A→C→B→D`, cost 8 — the tempting direct edge `A→B (4)` is not on it.

Cost `O((V + E) log V)`: one push per successful relaxation, one pop per entry, each logarithmic. A Fibonacci heap gives `O(E + V log V)` in theory, but loses on constants in practice.

### Why does Dijkstra require non-negative edge weights?

Dijkstra's justification is the greedy invariant: *the cheapest unsettled vertex can be finalised, because any other route to it must pass through an unsettled vertex whose distance is already ≥ its own, and adding more edges can only make things worse.* That last clause is where non-negativity does the work. With a negative edge available, adding edges can make a route **better**, and the invariant collapses.

Concrete 3-node counter-example: `S→A (2)`, `S→B (3)`, `B→A (-2)`. Dijkstra pops `S`, sets `dist[A] = 2` and `dist[B] = 3`, pops `A` at 2 and settles it. The true shortest route is `S→B→A = 3 - 2 = 1`. Since Dijkstra never revisits a settled vertex, it reports 2 and never notices. It fails **silently** — no error, just a wrong number — which is why "are weights non-negative?" is a clarifying question, not a debugging step.

### Can't I just add a constant to every weight to remove negatives and then use Dijkstra?

No, and it is one of the most common wrong answers in graph interviews. Adding `c` to every **edge** adds `c × (hop count)` to a path, so a 5-hop route is penalised five times as hard as a 1-hop route. Paths of different lengths shift by different amounts, so the *ordering* of paths can flip.

Same graph: `S→A (2)`, `S→B (3)`, `B→A (-2)`; add `c = 2` → `S→A (4)`, `S→B (5)`, `B→A (0)`. Now the direct edge costs 4 and `S→B→A` costs 5, so the reweighted graph prefers `S→A` — the opposite of the truth (2 versus 1). The one-hop path got `+2`, the two-hop path `+4`.

The *correct* reweighting is **Johnson's algorithm**: run Bellman-Ford once to get a **potential** `h(v)` per vertex, then set `w'(u,v) = w(u,v) + h(u) - h(v)`. The `h` terms telescope along a path — every intermediate vertex contributes `+h` once and `-h` once — so a path's new length is `original + h(start) - h(end)`, the same shift for *every* route between the same pair. Ordering is preserved and the new weights are provably non-negative. A per-vertex potential telescopes; a per-edge constant accumulates.

### How does Bellman-Ford work and what's its complexity?

Bellman-Ford abandons clever ordering: relax **all `E` edges**, then repeat, `V-1` times. The induction is simple — after round `i`, every shortest path using at most `i` edges is correct, because round `i` relaxes that path's `i`-th edge after earlier rounds fixed its prefix. No shortest path needs more than `V-1` edges (more would repeat a vertex), so `V-1` rounds settle everything.

```python
def bellman_ford(edges, n, src):             # edges: [(u, v, w)], vertices 0..n-1
    INF = float("inf")
    dist = [INF] * n
    parent = [None] * n
    dist[src] = 0
    for _ in range(n - 1):                   # V-1 rounds
        changed = False
        for u, v, w in edges:
            if dist[u] != INF and dist[u] + w < dist[v]:
                dist[v] = dist[u] + w
                parent[v] = u
                changed = True
        if not changed:                      # early exit: already converged
            break
    for u, v, w in edges:                    # one extra round
        if dist[u] != INF and dist[u] + w < dist[v]:
            return None, None                # a negative cycle is reachable
    return dist, parent
```

Trace with `S, A, B, C` and edges in the deliberately unhelpful order `A→C (3)`, `B→A (-3)`, `S→B (5)`, `S→A (4)`, source `S`. **Round 1:** the first two edges do nothing (their tails are `∞`); `S→B` sets `B = 5`; `S→A` sets `A = 4`. **Round 2:** `A→C` gives `C = 7`; `B→A` gives `5 - 3 = 2 < 4`, so `A = 2`. **Round 3:** `A→C` gives `2 + 3 = 5 < 7`, so `C = 5`. With `V = 4`, all three rounds were needed — the bound is not slack, it is the price of refusing to think about order.

Time `O(V·E)` — for each of `V-1` rounds, touch every edge — and space `O(V)`. The `changed` flag often terminates it far earlier in practice.

### How does Bellman-Ford detect a negative cycle?

Run one **extra** round after the `V-1`. If any edge still improves a distance, you have a "shortest" path apparently using `V` edges that beats every `V-1`-edge path — impossible when shortest paths are well defined, because a `V`-edge walk must repeat a vertex, and cutting that loop out would only help unless the loop is negative. So a successful relaxation on round `V` is a **proof** that a negative cycle is reachable.

To report the cycle rather than just its existence: remember a vertex `x` relaxed on that extra round, follow `parent` pointers `V` times from `x` (guaranteeing you land *inside* the cycle rather than on the tail leading into it), then walk parents from there until you return to that vertex.

Add `C→B (-4)` to the previous graph and `B→A (-3)`, `A→C (3)`, `C→B (-4)` forms a cycle of weight `-4`; every lap lowers all three distances, so the extra round always finds an improvement. Note detection only covers cycles **reachable from the source** — if you need *any* negative cycle in the graph, add a virtual source with weight-0 edges to every vertex first.

### What is a negative cycle and why does it make shortest paths ill-defined?

A negative cycle is a closed walk whose weights sum below zero. If one is reachable from the source *and* can reach the target, there is no shortest path: take the route, do a lap, and it is cheaper; do two laps and cheaper still. The set of achievable costs has no minimum — the infimum is `-∞`.

That is a definitional problem, not a numerical one, so every algorithm must take a position. Dijkstra *assumes* it away and misbehaves if you break the assumption. Bellman-Ford and Floyd-Warshall *detect* it and can answer "undefined" instead of returning nonsense. DAG relaxation is immune by construction — an acyclic graph has no cycles at all — which is why it is the one linear-time algorithm that accepts negative weights. If the interviewer asks about currency **arbitrage**, they are asking you to *find* a negative cycle (after a `-log` transform of exchange rates), and Bellman-Ford is the tool.

### How does Floyd-Warshall compute all-pairs shortest paths?

It is DP over the set of vertices you are **allowed to pass through**. Initialise `dist[i][j]` to the direct edge weight (`0` on the diagonal, `∞` if no edge). Then for each candidate intermediate `k` in turn, ask of every pair: *is `i → k → j` cheaper than what I have?* After iteration `k`, the invariant is exact: `dist[i][j]` is the cheapest route using only `{0..k}` as intermediates.

```python
def floyd_warshall(dist):                    # dist: V x V matrix, modified in place
    n = len(dist)
    nxt = [[j if dist[i][j] < float("inf") else None for j in range(n)]
           for i in range(n)]
    for k in range(n):                       # k OUTERMOST - this is the algorithm
        for i in range(n):
            dik = dist[i][k]
            if dik == float("inf"):
                continue                     # i cannot reach k; skip the row
            for j in range(n):
                if dik + dist[k][j] < dist[i][j]:
                    dist[i][j] = dik + dist[k][j]
                    nxt[i][j] = nxt[i][k]    # first hop from i toward j
    return dist, nxt
```

Trace on three vertices with `0→2 (5)`, `2→1 (1)`, `1→0 (2)`. Initial rows `[0, ∞, 5]`, `[2, 0, ∞]`, `[∞, 1, 0]`. **`k = 0`:** `dist[1][2] = dist[1][0] + dist[0][2] = 2 + 5 = 7`, row 1 → `[2, 0, 7]`. **`k = 1`:** `dist[2][0] = 1 + 2 = 3`, row 2 → `[3, 1, 0]`. **`k = 2`:** `dist[0][1] = 5 + 1 = 6`, row 0 → `[0, 6, 5]`. Every pair is now correct.

Cost `O(V³)` — a triple nested loop over the vertex set, a cube in the vertex count — and `O(V²)` space. Afterwards, `dist[i][i] < 0` means `i` sits on a negative cycle.

### Why must the intermediate-vertex loop be the outermost loop in Floyd-Warshall?

Because `k` indexes the **DP layer**, not a coordinate. The recurrence is `dist_k[i][j] = min(dist_{k-1}[i][j], dist_{k-1}[i][k] + dist_{k-1}[k][j])`: layer `k` is defined in terms of layer `k-1`, so the whole previous layer must be complete before any cell of layer `k` is computed. With `k` outermost, one full `i`/`j` sweep advances the matrix by exactly one layer — and the in-place version is safe because `dist[i][k]` and `dist[k][j]` provably cannot change during layer `k`.

Put `k` innermost and that collapses: for a fixed pair you would try every intermediate while most of the matrix still holds direct-edge values, so `dist[i][k]` may not yet be the true `i→k` distance. The result is not "slightly approximate" — it is a schedule that is right on some graphs and wrong on others, the worst kind of bug because your two-node test passes. The loop order *is* the algorithm: "let one more vertex become usable as a waypoint, then update everything."

### When would you run Floyd-Warshall versus Dijkstra from every source?

Floyd-Warshall is `O(V³)` regardless of density, needs `O(V²)` memory, and is six lines with no data structures. That makes it right on **small or dense** graphs (`E` approaching `V²`, where sparsity cannot be exploited anyway) and whenever you genuinely want the full matrix — graph diameter, transitive closure, `O(1)` pair queries, or a downstream DP indexed by pair.

Dijkstra from every source is `O(V·(V + E) log V)`. On a sparse graph with `E ≈ V` that is about `O(V² log V)` versus `O(V³)` — a factor of `V / log V`, which at `V = 10,000` is minutes versus days.

- **Dense, small, or you need the whole matrix** → Floyd-Warshall.
- **Large and sparse, non-negative weights** → Dijkstra from each source.
- **Large and sparse, negatives but no negative cycles** → Johnson's algorithm.
- **You only need one pair** → don't do all-pairs at all; one Dijkstra (or A\*) with early termination.

### What is A* and how does it differ from Dijkstra?

A\* is Dijkstra with a sense of direction. Dijkstra orders its frontier by `g(v)`, the confirmed cost from the source, so it expands as an ever-growing circle, spending most of its effort *away* from the goal. A\* orders by `f(v) = g(v) + h(v)`, where `h(v)` estimates the remaining cost, so the frontier stretches toward the target. Dijkstra is precisely A\* with `h(v) = 0`.

```python
import heapq

def a_star(neighbors, start, goal, h):       # h(v) -> estimated cost v..goal
    g = {start: 0}                           # confirmed cost so far
    parent = {start: None}
    pq = [(h(start), start)]                 # key is f = g + h
    while pq:
        f, u = heapq.heappop(pq)
        if u == goal:
            return g[u], parent              # optimal if h is admissible
        if f - h(u) > g.get(u, float("inf")):
            continue                         # stale entry, same as Dijkstra
        for v, w in neighbors(u):
            ng = g[u] + w                    # relax, then re-key with h
            if ng < g.get(v, float("inf")):
                g[v] = ng
                parent[v] = u
                heapq.heappush(pq, (ng + h(v), v))
    return None, parent
```

On a road network, Dijkstra explores a disc of radius equal to the trip length in every direction; A\* with straight-line distance explores something closer to an ellipse hugging the route, often expanding an order of magnitude fewer vertices for an identical answer. The worst-case bound is unchanged at `O((V + E) log V)` — the win is entirely in how much of the graph you actually touch.

### What makes an A* heuristic admissible, and why does it matter?

A heuristic is **admissible** if it never overestimates: `h(v) ≤ true distance from v to the goal`, with `h(goal) = 0`. Admissibility is what preserves optimality. Suppose A\* is about to pop the goal via a route costing `C` while a better route costing `C* < C` exists. Some vertex `x` on the better route is still queued, and its key is `f(x) = g(x) + h(x) ≤ g(x) + (true remaining from x) = C* < C` — so a min-heap would have popped `x` first. Contradiction. An admissible `h` can only *delay* unpromising directions, never discard a cheaper one.

**Consistency** (the triangle inequality `h(u) ≤ w(u, v) + h(v)`) is stronger: it implies admissibility and makes `f` non-decreasing along any path, so each vertex is finalised at most once — the exact analogue of Dijkstra's settle-once property, and what makes a closed set safe. A merely admissible-but-inconsistent `h` is still correct but may need re-expansions.

Practical heuristics: Euclidean distance for maps, **Manhattan** on a 4-directional grid, **Chebyshev** on an 8-directional grid, and `0` when you have nothing (giving Dijkstra back). Inflating `h` past admissibility — "weighted A\*" — is faster and gives up optimality: a fine trade for games, the wrong answer to "find the shortest path".

### How do you reconstruct the actual path, not just its length?

Maintain a `parent` map and write to it inside the relax step: whenever `(u, v)` improves `dist[v]`, set `parent[v] = u`. The relaxation that survives to the end is the one that produced the final distance, so following parents from the target back to the source traverses the shortest path in reverse — then reverse it. This is uniform across BFS, 0-1 BFS, Dijkstra, Bellman-Ford, DAG relaxation and A\*: one extra array.

```python
def reconstruct(parent, src, target):
    path = []
    v = target
    while v is not None:
        path.append(v)
        if v == src:
            break
        v = parent.get(v)
    else:
        return []                            # target unreachable from src
    return path[::-1]

def fw_path(nxt, i, j):                      # Floyd-Warshall variant
    if nxt[i][j] is None:
        return []
    path = [i]
    while i != j:
        i = nxt[i][j]                        # hop toward j
        path.append(i)
    return path
```

Floyd-Warshall needs the second shape because it has no single source: store `nxt[i][j]`, the **first hop** from `i` toward `j`, updating it to `nxt[i][k]` whenever routing through `k` wins, then walk forward. (The alternative convention stores `mid[i][j] = k` and recurses; both cost `O(V²)` extra space.) Two edge cases worth voicing: a vertex still at `∞` has no path, so return empty rather than something bogus; and with a negative cycle in range the path is undefined, so detect before reconstructing.

### An interviewer says weights can be negative but there are no negative cycles, and the graph is large and sparse — what do you use?

**Johnson's algorithm** for all-pairs; a single Bellman-Ford if they only want one source and accept `O(V·E)`. Johnson's gets Dijkstra's speed on a graph Dijkstra cannot legally run on:

1. Add a **virtual source** `q` with a weight-0 edge to every vertex — it reaches everything and creates no new cycles, since nothing points back into `q`.
2. Run **Bellman-Ford** from `q` to get potentials `h(v) = dist(q, v)`. Negative edges are handled here, once, in `O(V·E)`.
3. **Reweight** each edge to `w'(u,v) = w(u,v) + h(u) - h(v)`. This is non-negative because Bellman-Ford's convergence gives `h(v) ≤ h(u) + w(u,v)`, which rearranges to exactly `w'(u,v) ≥ 0`.
4. Run **Dijkstra** from every real source on the reweighted graph.
5. **Undo** the shift: the true distance is `dist'(s,t) - h(s) + h(t)`, since the potentials telescope and shift every `s→t` route identically.

Total `O(V·E + V·(V + E) log V)` — one Bellman-Ford plus `V` Dijkstras — beating Floyd-Warshall's `O(V³)` decisively on sparse graphs while still tolerating negatives. Step 3 is not the naive "add a constant" mistake precisely because the shift is per-**vertex** and telescopes, rather than per-edge and accumulating.

### How would you find the shortest path in a DAG, and can you beat Dijkstra?

Yes, outright: `O(V + E)` with no heap. In a directed acyclic graph, compute a topological order and relax each vertex's out-edges in that order. When you reach `u`, every path into `u` has already been processed — that is what topological order *means* — so `dist[u]` is already final and relaxing its out-edges propagates a finished value. One linear sweep, no priority queue, no logarithm.

```python
def dag_shortest_path(adj, order, src, n):   # order: topological order of 0..n-1
    INF = float("inf")
    dist = [INF] * n
    parent = [None] * n
    dist[src] = 0
    for u in order:                          # predecessors of u are all done
        if dist[u] == INF:
            continue                         # unreachable from src
        for v, w in adj[u]:
            if dist[u] + w < dist[v]:
                dist[v] = dist[u] + w
                parent[v] = u
    return dist, parent
```

Trace the DAG `A→B (4)`, `A→C (1)`, `C→B (2)`, `B→D (5)`, `C→D (8)` in topological order `A, C, B, D`. Process `A`: `dist[B] = 4`, `dist[C] = 1`. Process `C`: `1 + 2 = 3 < 4` so `dist[B] = 3`; `dist[D] = 9`. Process `B`: `3 + 5 = 8 < 9` so `dist[D] = 8`. Process `D`: no out-edges. One pass, same answer Dijkstra needed a heap to reach.

Two bonuses fall out free. **Negative weights are fine** — a DAG has no cycles, so no negative ones, and the topological argument never used non-negativity. And flipping `min` to `max` gives **longest path** in linear time, a problem that is NP-hard on general graphs — which is why critical-path scheduling and most "DAG-shaped DP" questions reduce to this loop.

## Minimum Spanning Trees

### Summary

**What this topic covers**
A minimum spanning tree (MST) is the cheapest set of edges that connects all vertices of a weighted, undirected graph without cycles. This topic covers the two classic greedy algorithms — Kruskal's (sort edges, add the cheapest that doesn't form a cycle, using union-find) and Prim's (grow one tree outward, always adding the cheapest edge leaving it, using a heap) — plus the *cut property* that explains why greedy is even correct here, and how MST differs from a shortest-path tree.

**Key terms**
*Spanning tree* — a subset of `V-1` edges connecting all `V` vertices with no cycle. *MST* — a spanning tree of minimum total edge weight. *Cut* — a partition of vertices into two non-empty sets; its *crossing edges* have one endpoint in each. *Light edge* — the minimum-weight edge crossing a given cut. *Cut property* — the theorem that a light edge across any cut is safe to include in some MST. *Cycle property* — the heaviest edge on any cycle is never in the MST. *Union-find (DSU)* — the disjoint-set structure Kruskal uses to test "would this edge close a cycle?" (internals live in the Data Structures primer).

**Core mechanics**
Kruskal: sort all edges by weight (`O(E log E)`), then scan them cheapest-first, adding an edge iff its endpoints are in different components (a union-find `find` check); stop at `V-1` edges. With union-find's near-constant operations, total time is dominated by the sort: `O(E log E) = O(E log V)`. Prim: start from any vertex, maintain a min-heap of edges crossing from the tree to the outside, repeatedly extract the lightest edge to a new vertex and add it: `O(E log V)` with a binary heap, or `O(E + V log V)` with a Fibonacci heap; on dense graphs an adjacency-matrix `O(V^2)` version wins. Both are greedy and both are justified by the cut property.

**Trade-offs**
Kruskal is edge-centric and shines on sparse graphs, and it's natural when edges are already sorted or arrive in sorted order; it needs a global sort and union-find. Prim is vertex-centric and grows a single connected tree, which is convenient when the graph is dense (the `O(V^2)` matrix form beats sorting `O(V^2)` edges) or given as an adjacency structure you can traverse. Kruskal handles a *disconnected* graph gracefully by producing a minimum spanning *forest*; Prim as usually written only spans the component of its start vertex.

**Common confusions**
The most common: assuming the MST also gives shortest paths between vertices — it does not. Confusing the cut property with the cycle property. Thinking the MST is unique — it is only when all edge weights are distinct. Forgetting that MST is defined for *undirected* graphs (the directed analogue, a minimum arborescence, needs Edmonds' algorithm, not Prim/Kruskal). Believing Prim needs non-negative weights like Dijkstra — it doesn't; MST algorithms work fine with negative edge weights because there's no notion of accumulating path cost.

**Why interviewers ask**
MSTs test greedy correctness reasoning: can you state the cut property and use it to argue why "always take the cheapest safe edge" actually produces an optimum? They also probe union-find fluency (via Kruskal) and heap usage (via Prim), and the sharp "MST vs shortest-path tree" distinction is a favorite trap. A frequent follow-up: "how would you detect whether the MST is unique?" or "the graph is disconnected — now what?"

### What exactly is a minimum spanning tree?
Given a connected, undirected graph with weighted edges, a spanning tree is any set of `V-1` edges that connects all `V` vertices without forming a cycle. The minimum spanning tree is the spanning tree whose edge weights sum to the smallest possible total. It captures "connect everything as cheaply as possible" — think laying cable to link all offices with the least total wire. Note it's undirected and about *connection cost*, not about distances between specific pairs.

### State the cut property and explain why it makes greedy work.
The cut property says: for any cut (any way of splitting the vertices into two non-empty groups), the minimum-weight edge crossing that cut belongs to *some* MST. Proof sketch by exchange: take any MST not containing that light edge `e`; adding `e` creates a cycle that must cross the cut on some other, heavier edge `e'`; swapping `e'` for `e` yields a spanning tree that's no heavier — still an MST. This is why both Kruskal and Prim can safely commit to a locally cheapest edge without backtracking.

### How does Kruskal's algorithm work?
Sort every edge by ascending weight. Walk them cheapest-first; for each edge, use union-find to check whether its two endpoints are already in the same component. If they're in different components, add the edge to the MST and `union` the components; if the same, skip it (adding it would create a cycle). Stop once you've selected `V-1` edges. Each accepted edge merges two components, and the cut property guarantees the cheapest cross-component edge is always safe.

### Why does Kruskal need union-find, and what's the complexity?
Union-find answers "are these two vertices already connected?" in near-constant amortized time (inverse-Ackermann, effectively `O(1)`) using union-by-rank and path compression. Without it, cycle-checking each edge would need a graph traversal and blow up the runtime. With it, Kruskal's cost is dominated by the initial edge sort: `O(E log E)`, which since `E <= V^2` equals `O(E log V)`. The union/find operations across all edges add only near-linear overhead.

### How does Prim's algorithm work?
Pick any start vertex and grow a single tree. Maintain the set of edges crossing from the current tree to vertices outside it, in a min-heap. Repeatedly extract the lightest crossing edge, add its outside endpoint (and that edge) to the tree, then push that vertex's edges to still-outside neighbors. Repeat until all vertices are in the tree. Each step adds the light edge of the cut (tree vs rest), so the cut property guarantees correctness.

### What's Prim's complexity, and when does the dense-graph version win?
With a binary heap keyed by each outside vertex's cheapest connecting edge, Prim runs in `O(E log V)` (a Fibonacci heap gives `O(E + V log V)`). On a *dense* graph where `E` is near `V^2`, that `log` factor hurts, and a simple adjacency-matrix implementation that scans all vertices to find the next-cheapest — `O(V^2)` with no heap — is actually faster and simpler. So: sparse graph → heap-based Prim or Kruskal; dense graph → `O(V^2)` Prim.

### Kruskal or Prim — how do you choose?
If the graph is sparse, or the edges are already sorted or streamed in sorted order, Kruskal is natural and clean. If the graph is dense, Prim's `O(V^2)` matrix form avoids sorting `~V^2` edges. If the graph might be disconnected and you want a spanning *forest*, Kruskal handles it for free. If you're already given adjacency lists and want to grow from a specific vertex, Prim fits. They produce equal-total-weight trees, so it's about the graph shape and inputs, not correctness.

### How is an MST different from a shortest-path tree?
They optimize different things. An MST minimizes the *total* weight of edges connecting everything; a shortest-path tree (e.g. from Dijkstra) minimizes each vertex's *distance from a specific root*. They are frequently different trees. Classic example: a triangle with a root, where a direct 3-cost edge to a far vertex is on the shortest-path tree, but the MST instead uses two 2-cost edges routed through the middle vertex. Don't reach for Prim/Kruskal when someone actually wants shortest paths.

### When is the MST unique?
The MST is guaranteed unique when all edge weights are distinct. With repeated weights, there can be multiple MSTs of equal total weight (you might swap two equal-weight edges that both safely close the same cut). A useful sufficient condition: for every cut, if the minimum crossing edge is *strictly* lighter than all other crossing edges, and similarly the max edge on every cycle is strictly heaviest, the MST is unique.

### How would you check whether a given graph has a unique MST?
Compute one MST, then for each non-tree edge `e`, find the maximum-weight edge on the tree path between `e`'s endpoints. If any non-tree edge has weight *equal* to that maximum path edge, you could swap them to get a different MST of the same weight — so the MST is not unique. If no such equal-weight swap exists anywhere, the MST is unique. (This path-max query can be answered efficiently with union-find-style processing or LCA techniques.)

### The graph is disconnected — what do MST algorithms produce?
There's no spanning tree of a disconnected graph, so the goal becomes a *minimum spanning forest*: an MST of each connected component. Kruskal produces it automatically — it just keeps adding safe edges and naturally ends with one tree per component (`V - (number of components)` edges total). Prim only spans the component containing its start vertex, so to cover a disconnected graph you must restart it from an unvisited vertex for each remaining component.

### Do MST algorithms work with negative edge weights?
Yes, unlike Dijkstra. Neither Kruskal nor Prim accumulates a running path cost that a negative edge could destabilize — they only ever compare individual edge weights to decide which is cheapest. You can add a large constant to every weight to make them all positive without changing which spanning tree is minimal (the total shifts by a fixed `(V-1) * constant` for *every* spanning tree, since all have exactly `V-1` edges). So negatives are harmless.

### State the cycle property and how it complements the cut property.
The cycle property says: for any cycle in the graph, the *maximum*-weight edge on that cycle is never part of any MST (assuming it's the unique max). Intuition: you could always drop that heaviest cycle edge and stay connected more cheaply. Where the cut property tells you which edges are *safe to add*, the cycle property tells you which are *safe to discard* — Kruskal's "skip an edge that would form a cycle" is exactly the cycle property in action.

### How does Borůvka's algorithm differ, and why does anyone care?
Borůvka's algorithm proceeds in rounds: in each round, *every* current component simultaneously selects its own cheapest outgoing edge, and all those edges are added at once, merging components. Since each round at least halves the number of components, it finishes in `O(log V)` rounds, `O(E log V)` total. It matters because its inherent parallelism makes it the basis for parallel and distributed MST algorithms and for modern near-linear-time hybrids, where sequential Prim/Kruskal don't parallelize as naturally.

### Can you use an MST to get a decent solution to the Traveling Salesman Problem?
Yes — the MST gives a classic approximation. Build the MST, do a preorder DFS walk of it, and shortcut past already-visited vertices to form a tour. For metric TSP (where triangle inequality holds), this yields a tour at most 2x the optimum, because the optimal tour minus one edge is itself a spanning tree (so `MST <= optimal tour`) and the walk uses each MST edge twice. The sharper Christofides algorithm improves the bound to 1.5x by adding a matching. It's a favorite "MSTs are useful beyond connectivity" follow-up.

## Advanced Graph Algorithms

### Summary

**What this topic covers**
This topic groups the "deeper" graph algorithms interviewers reach for once BFS/DFS and shortest paths are established: strongly connected components (SCCs) via Tarjan's and Kosaraju's algorithms, bridges and articulation points (the edges/vertices whose removal disconnects a graph), and network flow — max-flow / min-cut with Ford-Fulkerson, Edmonds-Karp, and Dinic, plus bipartite matching as its most common application. The unifying theme: they extract *structural* information (connectivity, cut points, capacity bottlenecks) that simple traversal alone doesn't reveal.

**Key terms**
*Strongly connected component* — a maximal set of vertices in a *directed* graph where every vertex can reach every other. *Bridge* — an edge whose removal increases the number of connected components. *Articulation point (cut vertex)* — a vertex whose removal does the same. *DFS discovery time / low-link* — the timestamp when DFS first reaches a vertex, and the lowest discovery time reachable from its subtree; the engine behind Tarjan and bridge-finding. *Flow network* — a directed graph with edge capacities, a source `s`, and a sink `t`. *Augmenting path* — an `s`-to-`t` path with spare capacity in the residual graph. *Min-cut* — the minimum total capacity you must remove to disconnect `s` from `t`.

**Core mechanics**
SCCs: Tarjan runs a single DFS tracking discovery times and low-link values, popping a component off a stack whenever it finds an SCC "root" (`low[v] == disc[v]`) — `O(V + E)`. Kosaraju does two passes: DFS to order vertices by finish time, then DFS on the *transposed* graph in that order, each tree being one SCC — also `O(V + E)`. Bridges/articulation points use the same low-link DFS: an edge `(u,v)` is a bridge when `low[v] > disc[u]`; `u` is an articulation point when a child `v` has `low[v] >= disc[u]` (with a special root rule). Max-flow: Ford-Fulkerson repeatedly finds an augmenting path in the residual graph and pushes flow; Edmonds-Karp fixes the path search to BFS (`O(V*E^2)`); Dinic layers the graph with BFS then pushes blocking flows with DFS (`O(V^2 * E)`, and `O(E * sqrt(V))` on unit-capacity/bipartite-matching graphs). Max-flow equals min-cut.

**Trade-offs**
Tarjan is one elegant DFS pass — usually preferred; Kosaraju needs two passes and the transposed graph but is arguably easier to explain and reason about. For flow, Ford-Fulkerson with a naive path search can be exponential (or non-terminating on irrational capacities), so you almost never use it raw — Edmonds-Karp (BFS augmenting paths) guarantees `O(V*E^2)`, and Dinic is the practical default, especially fast on unit-capacity and bipartite-matching graphs. Bipartite matching via Hopcroft-Karp gets `O(E * sqrt(V))`, the same bound Dinic achieves there.

**Common confusions**
SCCs are a *directed*-graph concept; the undirected analogue is just connected components (or biconnected components for the cut-vertex flavor). Confusing bridges (edges) with articulation points (vertices) — a graph can have one without the other. Mixing up the low-link conditions: bridges use strict `>`, articulation points use `>=`, and the DFS *root* is an articulation point iff it has two or more DFS children. For flow, forgetting the *residual/back edges* (which let the algorithm "undo" earlier flow) — without them max-flow is simply wrong. And assuming max-flow needs integer capacities: it doesn't for correctness, but integrality is what guarantees Ford-Fulkerson terminates.

**Why interviewers ask**
These separate candidates who *use* graph libraries from those who understand graph *structure*. SCC and low-link questions test whether you can reason about DFS timestamps rather than memorize code. Max-flow / min-cut is a genuinely powerful modeling tool — many "assignment", "scheduling", and "can we separate X from Y" problems reduce to it — so interviewers probe whether you can *recognize* a flow problem in disguise, not just run the algorithm. The classic senior follow-up: "reduce this bipartite matching / vertex-cover / edge-disjoint-paths problem to max-flow."

### What is a strongly connected component?
In a directed graph, a strongly connected component is a maximal set of vertices such that every vertex can reach every other vertex within the set, following edge directions. "Maximal" means you can't add another vertex and keep that mutual-reachability property. Every directed graph decomposes uniquely into SCCs, and if you contract each SCC to a single node you get a DAG (the *condensation*) — which is why SCC decomposition is often the first step before running DAG algorithms on a cyclic directed graph.

### How does Kosaraju's algorithm find SCCs?
Two DFS passes. First, run DFS on the original graph and push each vertex onto a stack when it *finishes* (post-order). Second, transpose the graph (reverse every edge) and repeatedly pop vertices from the stack; each DFS on the transposed graph, started from an unvisited popped vertex, visits exactly one SCC. The finish-order ensures you start each second-pass DFS from a "sink" SCC of the condensation, so it can't leak into other components. It's `O(V + E)` but touches the graph twice and needs the transpose.

### How does Tarjan's algorithm find SCCs in a single pass?
Tarjan runs one DFS maintaining two numbers per vertex: `disc[v]` (discovery time) and `low[v]` (the lowest `disc` reachable from `v`'s DFS subtree, including via one back edge). Vertices are pushed onto a stack as visited. When DFS finishes a vertex `v` with `low[v] == disc[v]`, `v` is the root of an SCC — pop the stack down to `v` and that popped set is the component. Single pass, `O(V + E)`, no transpose needed, which is why it's usually preferred.

### Tarjan or Kosaraju — which and why?
Both are `O(V + E)`. Tarjan is a single DFS with a bit of bookkeeping (disc/low/on-stack), so it's more efficient in constant factors and doesn't need to build a transposed graph. Kosaraju uses two passes and requires the transpose, but many people find its "finish-order then reverse-graph" story easier to explain and get correct under interview pressure. If you're comfortable with low-link, use Tarjan; if you want a clean explanation you won't fumble, Kosaraju is a fine choice.

### What is the low-link value and why is it so central?
`low[v]` is the smallest discovery time reachable from `v` by going down `v`'s DFS subtree and taking at most one back edge. Intuitively it answers "what's the earliest-discovered vertex `v`'s subtree can climb back to?" If a subtree can climb back above `v`, then removing the edge into it doesn't disconnect anything (there's an alternate route); if it can't, you've found a bridge or a cut structure. This single quantity powers Tarjan's SCCs, bridge finding, and articulation points — which is why it's worth understanding rather than memorizing.

### What is a bridge, and how do you find all bridges?
A bridge is an edge whose removal increases the number of connected components — a single point of failure in an undirected graph. Run a DFS computing `disc` and `low`. A tree edge `(u, v)` (with `v` a child of `u`) is a bridge exactly when `low[v] > disc[u]`: the subtree rooted at `v` has no back edge reaching `u` or anything above it, so that edge is the only link. One `O(V + E)` DFS finds them all. Bridges matter for network reliability and for decomposing a graph into 2-edge-connected components.

### What is an articulation point, and how does the condition differ from a bridge?
An articulation point (cut vertex) is a vertex whose removal disconnects the graph. Using the same low-link DFS, a non-root vertex `u` is an articulation point if it has a child `v` with `low[v] >= disc[u]` — meaning `v`'s subtree can't reach *above* `u`, so `u` holds it on. The DFS *root* is a special case: it's an articulation point iff it has two or more DFS children. Note the difference from bridges: articulation points use `>=` (the subtree may reach back to `u` itself but no higher), bridges use strict `>`.

### Can a graph have a bridge but no articulation point, or vice versa?
Yes to both directions. A single edge connecting two triangles: the connecting edge is a bridge, and each of its two endpoints is also an articulation point — so they often coincide. But consider two triangles sharing exactly one common vertex: that shared vertex is an articulation point, yet there's no bridge (every edge sits on a cycle). Conversely a simple path `a - b - c` has bridges `(a,b)` and `(b,c)`, and `b` is an articulation point — so a bridge's *internal* endpoints are cut vertices, but articulation points can exist with no bridge at all.

### Define a flow network and the max-flow problem.
A flow network is a directed graph where each edge has a non-negative capacity, plus a designated source `s` and sink `t`. A flow assigns each edge a value between 0 and its capacity, subject to conservation: at every vertex other than `s` and `t`, flow in equals flow out. The max-flow problem asks for the maximum total flow you can push from `s` to `t`. Think of pipes with capacity limits and you want the greatest throughput from source to sink.

### How does the Ford-Fulkerson method work?
Repeatedly find an augmenting path — a path from `s` to `t` in the *residual graph* where every edge still has spare capacity — and push as much flow along it as the tightest edge allows. Pushing flow updates residual capacities and, crucially, adds *back edges* that let later iterations cancel earlier flow. When no augmenting path remains, the flow is maximum. Ford-Fulkerson is a *method* (it doesn't specify how to pick the path); with integer capacities each augmentation raises flow by at least 1, so it terminates, but a bad path choice can make it very slow.

### Why do we need residual/back edges?
Back edges let the algorithm *reroute* flow it committed earlier that turned out to be suboptimal. When you push `f` units across edge `(u, v)`, you add a residual edge `(v, u)` with capacity `f`; a later augmenting path can travel that back edge, effectively canceling `f` units on `(u,v)` and sending them elsewhere. Without back edges, an early greedy choice could permanently block the true maximum, and Ford-Fulkerson would return a wrong (too-small) flow. The residual graph is what makes "greedy augmentation" provably reach the optimum.

### What's the difference between Ford-Fulkerson, Edmonds-Karp, and Dinic?
Ford-Fulkerson is the general augmenting-path method with the path-finding left unspecified — naive choices can be exponential (or non-terminating with irrational capacities). Edmonds-Karp pins it down to *BFS* for the augmenting path (shortest path in edges), which guarantees `O(V*E^2)` regardless of capacities. Dinic goes further: it builds a BFS *level graph*, then pushes a *blocking flow* with DFS along level-respecting edges, repeating in phases — `O(V^2 * E)` in general, and a superb `O(E * sqrt(V))` on unit-capacity graphs. Dinic is the practical default.

### State the max-flow min-cut theorem and why it matters.
The value of the maximum `s`-`t` flow equals the capacity of the minimum `s`-`t` cut — the cheapest set of edges whose removal disconnects `s` from `t`. It matters because it links an *optimization* (push the most flow) to a *structural* certificate (the bottleneck edges), and it gives a proof of optimality: when no augmenting path exists, the vertices reachable from `s` in the residual graph define exactly the min cut. Many problems are easier to model as "find the cheapest cut" and solved via max-flow, or vice versa.

### How does bipartite matching reduce to max-flow?
Given a bipartite graph with left set `L` and right set `R`, add a source `s` with capacity-1 edges to every vertex in `L`, direct each original `L`-to-`R` edge with capacity 1, and add capacity-1 edges from every `R` vertex to a sink `t`. The maximum flow equals the maximum matching: each unit of flow traces one matched `s -> l -> r -> t` path, and the capacity-1 constraints ensure each vertex is used at most once. Running Dinic here gives `O(E * sqrt(V))` — the same bound as the specialized Hopcroft-Karp algorithm.

### König's theorem and Hall's theorem — how do they connect to matching?
König's theorem states that in a bipartite graph, the size of the maximum matching equals the size of the minimum vertex cover — a special case of max-flow / min-cut, and the bridge to solving minimum vertex cover (and its complement, maximum independent set) in bipartite graphs in polynomial time. Hall's theorem gives the *existence* condition for a perfect matching on one side: a matching saturating `L` exists iff every subset `S` of `L` collectively has at least `|S|` neighbors in `R`. Interviewers love these because they turn a matching question into a clean combinatorial argument.

### Give an example of a problem that's secretly a max-flow problem.
Edge-disjoint paths: "how many paths from `s` to `t` share no edge?" Set every edge's capacity to 1 and compute max-flow — the answer is exactly the number of edge-disjoint paths (Menger's theorem). Others: assigning workers to tasks (bipartite matching), scheduling with capacity constraints, image segmentation ("cut" foreground from background as a min-cut), and project-selection / max-weight-closure problems. The senior skill is *recognizing* the reduction — spotting that "separate X from Y at minimum cost" or "match/assign under capacity limits" is a flow problem in disguise, then modeling the network correctly.

## Backtracking & Constraint Search

### Summary

**What this topic covers**
Backtracking is systematic exhaustive search that builds a solution one decision at a time and abandons a partial candidate the instant it can no longer lead to a valid answer. The mental model is a depth-first walk of a decision tree where you prune branches that violate constraints. It is the engine behind permutation/combination/subset generation, N-queens, sudoku, graph colouring, and constraint-satisfaction problems (CSPs). Branch and bound is the same idea extended to optimization, where you prune using a bound on the best achievable objective rather than a hard feasibility check.

**Key terms**
*Partial candidate / state* — the choices made so far. *Choice / candidate set* — the options available at the current step. *Constraint* — a rule a full solution must satisfy; a *pruning predicate* rejects partials that already violate it. *Choose / explore / unchoose* — the template: make a move, recurse, then undo it to restore state. *Feasibility pruning* — cut a branch that cannot satisfy constraints. *Bound* — in branch and bound, an optimistic estimate of the best objective reachable down a branch. *Search tree* — the tree of all partial candidates; leaves are complete assignments.

**Core mechanics**
The template is: if the state is a complete solution, record it; otherwise iterate over candidate choices, and for each one that passes the pruning check, apply it, recurse, then undo it. Correctness comes from exhaustiveness: without pruning you would enumerate every leaf, so every valid leaf is reached; pruning only removes branches that provably contain no valid leaf, so nothing valid is lost. Complexity is the number of nodes actually visited, which is why pruning matters so much: naive N-queens is O(n^n) but constraint checks cut it to roughly the number of valid placements. Space is O(depth) for the recursion stack plus whatever bookkeeping (used-columns sets, etc.) — usually O(n) — not the number of solutions, since we emit and discard.

**Trade-offs**
Backtracking beats brute-force generate-and-test because it prunes early instead of building full candidates then checking them. It beats DP when the state space has no overlapping subproblems to memoize, or when you must enumerate actual solutions rather than count/optimize. It loses to DP and greedy when the problem has optimal substructure you can exploit for polynomial time — backtracking stays exponential in the worst case. Versus BFS-style search it uses far less memory (stack depth, not frontier width) but does not find shortest paths.

**Common confusions**
Forgetting to unchoose — leaving mutated shared state (a `used[]` array, a board cell) corrupts sibling branches. Confusing subsets (2^n, include/exclude each element), permutations (n!, order matters, track used), and combinations (n choose k, enforce non-decreasing index to avoid duplicates). Trying to dedupe by post-filtering instead of skipping duplicate choices at the same tree level. Believing pruning changes worst-case Big-O — it changes the practical node count, not the exponential ceiling.

**Why interviewers ask**
Backtracking tests whether you can turn a vague "find all / does a valid arrangement exist" into a clean recursive template with correct state restoration, and whether you can reason about the exponential cost and where pruning bites. The classic follow-up is "how would you generate results without duplicates?" or "add a constraint and show where you prune."

### What is backtracking in one sentence?

Backtracking is depth-first search over the tree of partial solutions, where you extend a candidate one choice at a time and immediately abandon (backtrack from) any partial that cannot be completed into a valid solution. It is brute force made tractable by pruning: instead of building every full candidate and testing it, you test incrementally and cut dead branches early.

### What is the choose / explore / unchoose template?

```text
def backtrack(state):
    if is_complete(state):
        record(state)
        return
    for choice in candidates(state):
        if not valid(state, choice):
            continue          # prune
        apply(state, choice)  # choose
        backtrack(state)      # explore
        undo(state, choice)   # unchoose
```

The `undo` step is the heart of it: after exploring a branch you restore the state exactly as it was so the next sibling choice starts clean. Whether you mutate shared state and undo, or pass fresh copies down, is a style choice — mutate-and-undo is faster (no allocation) but must be disciplined.

### Why must you "unchoose" after recursing?

Because the state is shared across sibling branches. If you mark column 3 as used and recurse, then move to try column 4 without unmarking column 3, column 3 stays falsely occupied for the rest of the loop and for parent branches. Unchoosing restores the invariant "state reflects exactly the choices on the current root-to-node path." If instead you pass an immutable copy to each recursive call, there is nothing to undo — but you pay allocation cost on every node.

### How do you generate all subsets of a set?

Each element is independently in or out, so there are 2^n subsets. Two clean approaches. Recursive include/exclude: at index i, recurse once having added element i, once without, until i reaches n. Iterative cascade: start with [[]], and for each element append it to copies of every existing subset. Bitmask: iterate mask from 0 to 2^n - 1 and include element j when bit j of mask is set. All are O(2^n * n) to materialize (each of 2^n subsets costs up to O(n) to build/copy).

### How do you generate all permutations?

There are n! permutations. Track which elements are already used (a boolean array or a swap-in-place scheme). At each depth pick any unused element, mark it used, recurse to fill the next position, then unmark. The in-place variant swaps element i to the front, recurses on the suffix i+1, then swaps back — no extra used array. Cost is O(n! * n) since there are n! leaves and O(n) work to copy each finished permutation.

### How do you generate combinations (n choose k)?

Combinations are unordered, so you must avoid emitting {1,2} and {2,1} as different results. Enforce that choices are non-decreasing in index: the recursion takes a `start` index and only considers elements from `start` onward. When the current combination reaches size k, record it. Passing `start = i + 1` into the recursive call guarantees each element is used at most once and combinations come out in sorted order, which inherently prevents duplicates.

### How do you handle duplicates in the input when generating subsets/permutations?

Sort first so equal elements are adjacent, then skip a choice that repeats the previous choice at the same tree level. Concretely, in the loop `for i in range(start, n)`, skip when `i > start and nums[i] == nums[i-1]`. The `i > start` guard is critical: it allows the first occurrence of a value at this level but blocks the second, which is exactly the branch that would produce a duplicate result. Post-filtering with a set also works but wastes the work of generating the dupes.

### Explain the N-queens problem and its backtracking solution.

Place n queens on an n x n board so none attack another (no shared row, column, or diagonal). Place one queen per row, so the state is a column choice per row. Maintain three sets: used columns, used "/" diagonals (indexed by row + col), and used "\" diagonals (indexed by row - col). For each row, try each column whose three keys are all free; if free, place, recurse to the next row, then remove. A full assignment across all rows is a solution. This is far faster than checking all C(n^2, n) placements because the diagonal/column sets prune almost everything.

### What is the time complexity of N-queens?

The naive upper bound is O(n^n) (n columns per row, n rows), and even placing one queen per row without pruning is O(n!). With column and diagonal pruning the number of visited nodes is dramatically smaller — empirically it grows exponentially but far below n!. There is no known polynomial algorithm to count solutions; the value is that constraint propagation makes concrete sizes (n up to ~30 for one solution) tractable. The honest interview answer: exponential worst case, but pruning cuts the constant/branching factor enormously.

### How does backtracking solve Sudoku?

Find an empty cell, try digits 1-9, and place a digit only if it violates no row, column, or 3x3 box constraint; recurse; if the recursion dead-ends (some later cell has no legal digit), undo and try the next digit. It is a CSP: variables are cells, domains are 1-9, constraints are all-different per row/column/box. Plain backtracking works; adding heuristics — pick the empty cell with the fewest legal candidates (minimum-remaining-values), and propagate forced singles — turns most human-solvable boards nearly instant.

### What is a constraint satisfaction problem (CSP)?

A CSP is defined by variables, a domain of possible values for each, and constraints restricting which combinations are allowed; a solution assigns every variable a value satisfying all constraints. Sudoku, graph colouring, N-queens, and scheduling are CSPs. Backtracking is the default solver, sharpened by three ideas: variable ordering (minimum-remaining-values — assign the most constrained variable first to fail fast), value ordering (least-constraining-value first), and constraint propagation (forward checking / arc consistency) that prunes domains after each assignment.

### What is forward checking and how does it help?

After assigning a variable, forward checking removes the newly-inconsistent values from the domains of the *unassigned* variables that share a constraint. If any variable's domain becomes empty, you backtrack immediately instead of discovering the failure many levels deeper. It is cheap look-ahead that prunes doomed branches early. Arc consistency (the AC-3 algorithm) generalizes this by repeatedly propagating domain reductions until no more values can be eliminated, catching failures even earlier at higher cost per node.

### What is branch and bound and how does it differ from plain backtracking?

Branch and bound is backtracking for optimization. Alongside feasibility pruning it computes a *bound* — an optimistic estimate of the best objective achievable in a subtree — and prunes the subtree when that bound cannot beat the best complete solution found so far. Plain backtracking prunes only on hard constraint violations; branch and bound also prunes on "this branch can't possibly improve our answer." It is how you attack the travelling salesman and knapsack optimally in practice: exponential worst case, but a good bound function prunes vast regions.

### When would you choose backtracking over dynamic programming?

Choose backtracking when you must enumerate actual solutions (all subsets summing to a target, every valid board), when the state space lacks overlapping subproblems to memoize, or when constraints prune so aggressively that exhaustive search is fast enough. Choose DP when subproblems overlap and you only need a count or an optimum — DP reuses work and often turns exponential into polynomial. They combine: memoized backtracking (top-down DP) is backtracking plus a cache on the state, appropriate when the state repeats across branches.

### Why is exponential search sometimes acceptable in an interview?

Because for many problems it is provably the best known — enumerating all 2^n subsets or n! permutations is inherently exponential in output size, and NP-hard CSPs have no known polynomial algorithm. What interviewers want is that you (1) state the true complexity honestly, (2) prune to make realistic inputs tractable, and (3) know when a polynomial DP/greedy exists so you do not reach for exponential search needlessly. Saying "this is O(2^n), which is optimal because the output itself is size 2^n" is a strong, correct answer.

## String Algorithms

### Summary

**What this topic covers**
This topic is about doing things with strings faster than the obvious quadratic approach — chiefly pattern matching (find occurrences of a pattern P of length m inside a text T of length n) and string similarity (edit distance). The headline algorithms are KMP and Z-algorithm (linear matching via self-structure of the pattern), Rabin-Karp (hashing a sliding window), and Boyer-Moore (skip-ahead heuristics). Suffix arrays and suffix automata are advanced index structures for many-query problems; edit distance is the canonical string DP.

**Key terms**
*Pattern P, text T*, lengths m and n. *Prefix* — a start-anchored substring; *suffix* — an end-anchored one. *Border* — a string that is both a proper prefix and a proper suffix. *Failure function / prefix function (pi)* — for each position, the length of the longest proper border of that prefix; KMP's core table. *Z-array* — for each i, the length of the longest substring starting at i that matches a prefix of the string. *Rolling hash* — a hash updatable in O(1) as the window slides. *Suffix array* — sorted order of all suffixes. *Edit (Levenshtein) distance* — min insert/delete/substitute operations to transform one string into another.

**Core mechanics**
Naive matching slides P over T and compares up to m chars per position: O(n*m). KMP precomputes the prefix function in O(m), then scans T once never re-reading a character: on a mismatch it shifts P using the failure function instead of restarting, giving O(n + m) with O(m) space. The correctness rests on the invariant that the failure function tells you the longest already-matched prefix you can keep. Rabin-Karp hashes each length-m window with a rolling hash and compares hashes in O(1), verifying character-by-character only on a hash hit; O(n + m) expected, O(n*m) worst case under adversarial collisions. Z-algorithm computes the Z-array in O(n) using a maintained [l, r] match window and is an alternative linear matcher (run it on P + separator + T). Edit distance is an O(m*n) time, O(min(m,n)) space DP.

**Trade-offs**
KMP: guaranteed linear, single pass, tiny table — the safe default for one pattern in one text. Rabin-Karp: shines for *multiple* patterns of equal length (hash them into a set) and for 2D/substring-fingerprint problems, but needs collision handling. Boyer-Moore: sublinear in practice on natural text (often ~n/m comparisons) by skipping, which is why grep-family tools use it, but worst case is still O(n*m) without the Galil rule. Suffix array/automaton: heavy to build (O(n) or O(n log n)) but then answer many pattern queries in O(m log n) or O(m) — worth it only when you query the same text repeatedly.

**Common confusions**
Thinking the KMP failure function stores the shift distance — it stores the longest border length; the shift is derived from it. Conflating the Z-array with the prefix function (related but indexed differently). Believing Rabin-Karp is always linear — a single global modulus invites engineered collisions, so verify matches and consider double hashing. Assuming edit distance allows transpositions (that is Damerau-Levenshtein, a different recurrence). Off-by-one in hash removal of the leading character when the window slides.

**Why interviewers ask**
String matching separates candidates who only know O(n*m) naive from those who understand how to exploit structure (KMP), randomization (hashing), or skipping (Boyer-Moore) to hit linear/sublinear. Edit distance is the most-asked string DP and tests recurrence design plus space optimization. The favourite follow-up: "why is naive O(n*m), and how does KMP avoid re-scanning?"

### Why is naive string matching O(n*m)?

Naive matching aligns the pattern at each of the ~n starting positions in the text and, for each, compares characters until a mismatch or a full match — up to m comparisons. Worst case (e.g. text "aaaa…a", pattern "aaa…ab") every alignment compares nearly all m characters before failing on the last, giving O(n*m). The waste is that after a mismatch it throws away everything it learned and restarts the pattern from scratch one position over, re-reading text characters it already examined.

### What is the failure function (prefix function) in KMP?

For each prefix of the pattern, the failure function pi[i] is the length of the longest proper border of that prefix — the longest string that is both a proper prefix and a proper suffix of P[0..i]. Intuitively it answers: "if I have matched i+1 characters and the next one mismatches, what is the longest already-matched prefix I can fall back to without moving the text pointer?" It is precomputed in O(m) by a self-match of the pattern against itself, and it is the entire secret to KMP's linearity.

### How does KMP achieve O(n + m)?

It scans the text with a single pointer that never moves backward. It keeps a length j of how much of the pattern currently matches. On a mismatch, instead of resetting j to 0 and backing up in the text, it sets j = pi[j-1] — sliding the pattern forward by the largest safe amount implied by the border — and retries the same text character. Each text character causes at most one advance and a bounded number of failure-function fallbacks (amortized), so text processing is O(n); building pi is O(m). Total O(n + m), space O(m).

### Walk through building the KMP prefix function.

```python
def prefix_function(P):
    pi = [0] * len(P)
    k = 0                     # length of current longest border
    for i in range(1, len(P)):
        while k > 0 and P[i] != P[k]:
            k = pi[k - 1]     # fall back to next shorter border
        if P[i] == P[k]:
            k += 1
        pi[i] = k
    return pi
```

`k` tracks the current border length. When P[i] extends the border, k grows; when it breaks, we fall back through progressively shorter borders via `pi[k-1]` until we can extend or reach 0. The while loop's total iterations across all i are bounded (k rises at most n times, so it can fall at most n times), giving amortized O(m).

### How does Rabin-Karp use a rolling hash?

Treat each length-m window of the text as a number in some base b modulo a large prime. Compute the pattern's hash once and the first window's hash, then slide: the new hash is `(old - T[i]*b^(m-1)) * b + T[i+m]`, all mod p — O(1) per shift because you subtract the outgoing character's contribution and add the incoming one. When a window's hash equals the pattern's hash you have a *candidate*; verify character-by-character to rule out a collision. Expected O(n + m); worst case O(n*m) if many spurious hash hits force verification.

### When is Rabin-Karp the right choice over KMP?

When you search for many patterns at once (hash all patterns of a given length into a set, then one pass over the text checks each window's hash against the set — great for plagiarism/duplicate detection) and for 2D pattern matching or substring-fingerprint problems where a rolling hash extends naturally. For a single pattern in a single text, KMP's guaranteed linear time with no collision risk is usually cleaner. Rabin-Karp's Achilles heel is adversarial input engineered to collide, which you mitigate with a random modulus/base or double hashing.

### What is the Z-algorithm?

The Z-array of a string S gives, for each index i, the length of the longest substring starting at i that is also a prefix of S. It is computed in O(n) by maintaining a window [l, r] — the rightmost prefix-match seen so far — and reusing already-computed Z-values inside that window instead of re-comparing. For pattern matching, build S = P + sentinel + T; any position in the T region with Z-value equal to m marks a full occurrence of P. It is an alternative to KMP that many find more intuitive, with the same O(n + m) bound.

### How does Boyer-Moore skip characters?

Boyer-Moore matches the pattern against the current alignment *right-to-left*. On a mismatch it uses two heuristics to jump ahead by more than one position: the *bad-character rule* shifts so the mismatched text character aligns with its rightmost occurrence in the pattern (or past it entirely if absent), and the *good-suffix rule* shifts based on the already-matched suffix reappearing earlier in the pattern. On natural-language text this often examines only about n/m characters — sublinear — which is why tools like grep use Boyer-Moore variants. Worst case is O(n*m), tightened to O(n) by adding the Galil rule.

### What are suffix arrays and when are they worth it?

A suffix array is the array of starting indices of all suffixes of a string sorted in lexicographic order. It is built in O(n log n) (or O(n) with sophisticated algorithms) and, combined with an LCP (longest-common-prefix) array, supports fast substring queries: check whether P occurs via binary search in O(m log n), count occurrences, find the longest repeated substring, etc. The trade-off: it is a preprocessing-heavy *index* — you pay the build cost once to answer many queries against a fixed text. For a single search, KMP is simpler; for repeated queries on the same text, the suffix array amortizes beautifully.

### What is a suffix automaton at a glance?

A suffix automaton is the smallest deterministic automaton that recognizes all substrings of a string; it has O(n) states and edges and is built online in O(n) (for a fixed alphabet). Once built, checking whether any string is a substring is O(query length), and it answers counting-distinct-substrings and other structural questions elegantly. It is the heavier-artillery cousin of the suffix array — you would not reach for it in a typical coding interview, but knowing it exists and that it gives linear-size representation of all substrings signals depth.

### Define edit distance and its DP recurrence.

Edit (Levenshtein) distance between A and B is the minimum number of single-character insertions, deletions, and substitutions to turn A into B. Let dp[i][j] be the distance between the first i chars of A and the first j chars of B. If A[i-1] == B[j-1], dp[i][j] = dp[i-1][j-1] (no cost). Otherwise dp[i][j] = 1 + min(dp[i-1][j] delete, dp[i][j-1] insert, dp[i-1][j-1] substitute). Base cases: dp[i][0] = i, dp[0][j] = j. Time O(m*n), and space reduces to O(min(m,n)) because each row depends only on the previous one.

### How do you reduce edit distance to O(min(m,n)) space?

Each cell dp[i][j] depends only on the current and previous rows, so you keep two rows (or one row plus a saved diagonal value) instead of the full m x n table. Iterate over the longer string in the outer loop and keep rows of length equal to the shorter string, so the working memory is O(min(m,n)). The catch: this gives the distance value but discards the DP table needed to *reconstruct* the actual edit operations — if you need the alignment itself, either keep the full table or use Hirschberg's divide-and-conquer to recover it in O(m*n) time and O(min(m,n)) space.

### What are common string-hashing pitfalls?

Using a single small modulus invites collisions and adversarial attacks — prefer a large prime and often double hashing (two independent moduli). Integer overflow if you forget to take the modulus every step. Forgetting to precompute b^(m-1) mod p for the rolling removal, or getting its power wrong (off-by-one on the window length). Not verifying a hash match with an actual character comparison, so a collision produces a false positive. And picking a base smaller than the alphabet size, which collapses distinct characters. Treat a raw rolling hash as a fast filter, not proof of equality.

### KMP vs Rabin-Karp vs Boyer-Moore — how do you choose?

KMP: guaranteed O(n + m), single forward pass, no randomness — the default for one pattern, one text. Rabin-Karp: best when matching *many* equal-length patterns simultaneously or when a rolling fingerprint is natural (2D, substrings), at the cost of collision handling and worst-case O(n*m). Boyer-Moore: fastest in practice for large alphabets / natural text because it skips, making it the choice for real-world tools like grep, but its bookkeeping is heavier and worst case needs the Galil rule to stay linear. If unsure in an interview, implement KMP and mention the others as situational upgrades.

### How would you find the longest palindromic substring efficiently?

The naive expand-around-center approach is O(n^2): for each of the ~2n centers (each character and each gap), expand outward while characters mirror. To do it in O(n), use Manacher's algorithm, which transforms the string (inserting separators so odd/even cases unify) and maintains a current rightmost palindrome boundary, reusing mirror information much like the Z-algorithm reuses its window — each center's radius is computed in amortized O(1). Most interviews accept the clean O(n^2) expand-around-center and treat Manacher as a bonus for the follow-up "can you do linear?"

## Bit Manipulation

### Summary

**What this topic covers**
Bit manipulation is treating an integer as a fixed-width array of bits and using the bitwise operators to set, clear, test, and combine those bits directly. The core skills are masking (isolating or modifying specific bits), a handful of idioms (isolate/clear the lowest set bit, popcount, XOR tricks), enumerating subsets of a mask, and recognizing when a small set (n <= ~20-22) can be encoded as an integer to drive bitmask DP. The payoff is constant-factor speed and O(1)/O(word) space where a naive approach would use arrays or loops.

**Key terms**
*Bit / mask* — a bit is a single binary digit; a mask is an integer whose set bits select positions. *AND (&), OR (|), XOR (^), NOT (~)* — bitwise operators. *Shift* — `x << k` multiplies by 2^k, `x >> k` divides (arithmetic vs logical for signed values). *Set / clear / toggle / test* a bit at position i via `1 << i`. *Least significant bit (LSB)* — the lowest bit; *lowest set bit* `x & -x`. *Popcount / Hamming weight* — the number of set bits. *Two's complement* — how signed integers and negation work, which is why `-x = ~x + 1`. *Submask* — a mask whose set bits are a subset of another mask's.

**Core mechanics**
Single-bit operations use a one-hot mask `1 << i`: set with `x | (1<<i)`, clear with `x & ~(1<<i)`, toggle with `x ^ (1<<i)`, test with `(x >> i) & 1`. `x & -x` isolates the lowest set bit because in two's complement `-x` is `~x + 1`, which flips every bit above the lowest set bit and leaves that bit; ANDing keeps exactly it. `x & (x-1)` clears the lowest set bit, because subtracting 1 flips the lowest set bit and all zeros below it. Popcount is either the Kernighan loop (`x &= x-1` until zero — runs once per set bit) or a hardware/library intrinsic in O(1). XOR is its own inverse (`a ^ a = 0`, `a ^ 0 = a`) and commutative, which powers find-the-unique and in-place swap. Enumerating submasks of m is the idiom `sub = (sub - 1) & m`, which visits all 2^popcount(m) subsets in total O(3^n) across all masks.

**Trade-offs**
Bit tricks give large constant-factor wins and compact state (a whole subset in one register) but hurt readability, so reserve them for hot paths and genuine set-encoding. Bitmask DP turns "try every subset" from a hashmap-of-sets into an integer-indexed array — O(2^n) states — which is exact and fast but hard-capped: n beyond ~22 makes 2^n infeasible. Prefer clear array code for ordinary logic; reach for bits when the problem is inherently about subsets, parity, or when profiling demands it.

**Common confusions**
`1 << 31` or `1 << 63` overflowing a signed type (use unsigned or a wide/long literal). Operator precedence: `&`, `|`, `^` bind *looser* than `==`/`+`, so `x & 1 == 0` parses as `x & (1 == 0)` — always parenthesize. Arithmetic vs logical right shift on negative numbers (sign extension). Assuming `x & -x` works the same in a language without two's-complement/arbitrary-precision semantics (Python ints are unbounded, which changes `~x`). Forgetting that XOR-swap breaks when both operands alias the same location. Confusing "lowest set bit value" (`x & -x`) with "index of lowest set bit" (that value's log2 / count of trailing zeros).

**Why interviewers ask**
Bit questions reveal whether you understand the machine underneath the abstraction — two's complement, why `x & (x-1)` works, O(1) popcount — and whether you can spot that a small-set problem collapses into an integer. The classic escalation is single-number (XOR) → single-number-II (bit counts mod 3) → subset enumeration → full bitmask DP (travelling salesman, assignment), testing how far you can push the encoding.

### What do the bitwise operators do?

AND (`&`) yields 1 only where both bits are 1 — used to *test* and to *mask off* bits. OR (`|`) yields 1 where either is 1 — used to *set* bits. XOR (`^`) yields 1 where the bits differ — used to *toggle* and to *combine reversibly*. NOT (`~`) flips every bit — in two's complement `~x == -x - 1`. Left shift `x << k` multiplies by 2^k; right shift `x >> k` divides by 2^k (rounding toward negative infinity for arithmetic shift on signed values). These operate independently on each bit position with no carry, unlike arithmetic +.

### How do you set, clear, toggle, and test a single bit?

Build a one-hot mask `m = 1 << i`. Set bit i: `x | m`. Clear bit i: `x & ~m` (invert the mask so it is all 1s except position i, then AND). Toggle bit i: `x ^ m` (XOR flips exactly that bit). Test bit i: `(x >> i) & 1` (shift the bit down to position 0 and mask), or equivalently `(x & m) != 0`. These four are the vocabulary everything else builds on. Watch precedence — write `(x >> i) & 1`, never `x >> i & 1` if in doubt, and never `x & m == 0`.

### What does `x & -x` do and why?

It isolates the lowest set bit — returns a value with only that one bit set. In two's complement `-x == ~x + 1`. Negating flips all bits then adds 1, and the carry from the +1 ripples up through the trailing zeros and the lowest set bit, leaving everything below and including the lowest set bit "aligned" so that ANDing `x` with `-x` keeps exactly the lowest set bit and zeros everything else. Example: x = 0b10110, -x = 0b01010 (in two's complement), x & -x = 0b00010. It is the workhorse behind Fenwick-tree indexing and fast lowest-bit extraction.

### What does `x & (x - 1)` do?

It clears the lowest set bit — turns the rightmost 1 into 0 and leaves the rest unchanged. Subtracting 1 flips the lowest set bit to 0 and turns all the zeros below it into 1s; ANDing with the original x keeps the high bits, kills the borrowed low 1s, and clears that lowest bit. Example: x = 0b10100, x-1 = 0b10011, x & (x-1) = 0b10000. Two immediate uses: `x & (x-1) == 0` tests power-of-two (at most one set bit), and looping `x &= x - 1` counts set bits in one iteration per set bit.

### How do you count set bits (popcount)?

Three ways. Kernighan's loop: `count = 0; while x: x &= x - 1; count += 1` — iterates once per set bit, so O(number of set bits), better than O(word width) when bits are sparse. Library/hardware intrinsic: `popcount` / `bit_count()` / `__builtin_popcount` — effectively O(1). Precomputed table / SWAR parallel-bit-count: sum bits in chunks with masks like 0x5555… in O(log width) operations. In an interview, mention Kernighan for the elegant loop and the intrinsic for production; both are correct, differ in constant factors.

### How does XOR find the single non-duplicated element?

If every element appears twice except one, XOR all of them: pairs cancel because `a ^ a = 0`, and `x ^ 0 = x`, so the survivor is the unique element. It runs in O(n) time and O(1) space with a single accumulator — far better than a hash set. It works because XOR is commutative and associative, so order does not matter and duplicates annihilate regardless of position. The follow-up "what if the odd one out appears once but others appear three times?" needs a different trick: count each bit position mod 3.

### How do you find the element appearing once when all others appear three times?

XOR fails because triples do not cancel. Instead count, for each of the (say) 32 bit positions, how many input numbers have that bit set; take the count mod 3. Bits belonging to the tripled numbers contribute a multiple of 3 and vanish, leaving exactly the bits of the unique number. Reassemble those bits into the answer. That is O(n * word) time, O(1) space. A slicker O(1)-space variant uses two accumulators (`ones`, `twos`) implementing a mod-3 state machine over the bits, but the per-bit-count explanation is clearer to state.

### How do you swap two numbers with XOR, and why is it risky?

`a ^= b; b ^= a; a ^= b` swaps without a temporary: after the first line a holds a^b; the second makes b = (a^b)^b = a; the third makes a = (a^b)^a = b. It relies on XOR being self-inverse. The risk: if a and b are the *same memory location* (e.g. `swap(arr[i], arr[i])` with i == j), the first XOR zeroes it and the value is lost. It is also not faster than a temporary variable on modern CPUs and hurts readability — a party trick to know but rarely to ship.

### How do you enumerate all subsets of a bitmask?

Use the submask-descent idiom:

```python
sub = m
while sub > 0:
    process(sub)          # sub is a non-empty subset of m
    sub = (sub - 1) & m
process(0)                # include the empty subset if needed
```

`(sub - 1) & m` skips directly from one submask to the next-lower submask of m, ignoring bits not in m. It visits every one of the 2^popcount(m) subsets. Summed over all masks m from 0 to 2^n - 1, the total work is O(3^n), because each of the n bits is independently in the mask, in the submask, or in neither — three states.

### How do you check if a number is a power of two?

A positive power of two has exactly one set bit, so `x > 0 and (x & (x - 1)) == 0`. The `x > 0` guard matters: `x & (x-1) == 0` is also true for x = 0, which is not a power of two, and you must avoid misclassifying it. Related: `x & -x == x` also holds exactly for powers of two (and zero), since the lowest set bit equals the whole number only when there is a single bit. Powers of two are worth spotting because `x % powerOfTwo == x & (powerOfTwo - 1)` and `x / powerOfTwo == x >> log2(powerOfTwo)`.

### How do you compute x mod 2^k and x divided by 2^k with bits?

For non-negative x, `x % (2^k) == x & ((1 << k) - 1)` — the mask `(1<<k)-1` is k low ones, keeping only the remainder bits. And `x / (2^k) == x >> k`, a right shift dropping the low k bits. These are exact and fast for unsigned/non-negative values. The caveat is signed negatives: arithmetic right shift rounds toward negative infinity, not toward zero like integer division in many languages, and the AND-mask trick assumes a non-negative two's-complement value, so guard or use unsigned types when x can be negative.

### What is a bitmask and how does it encode a set?

A bitmask represents a subset of a universe of n items as an integer: bit i is 1 iff item i is in the set. Membership test is `(mask >> i) & 1`, add item is `mask | (1<<i)`, remove is `mask & ~(1<<i)`, set union is `a | b`, intersection `a & b`, difference `a & ~b`, and the full set is `(1 << n) - 1`. This packs an entire subset into one register, making subsets O(1) to compare/copy and letting you index a DP array by "which subset is done." It only works when n is small (roughly <= 22-24) because there are 2^n masks.

### What is bitmask DP and when do you use it?

Bitmask DP uses an integer mask as the DP state to represent "which subset of a small set has been used/visited," giving O(2^n) states (often times another dimension). Classic uses: travelling salesman (`dp[mask][i]` = shortest path visiting exactly the cities in mask, ending at i, in O(2^n * n^2)), assignment/matching problems, and counting Hamiltonian paths. You reach for it when the problem screams "try every subset" and n is small enough that 2^n is affordable. It is exact and fast for n up to ~20; beyond that 2^n explodes and you need approximation or a different structure. See the Dynamic Programming topic for the full recurrences.

### What are the most common bit-manipulation bugs?

Operator precedence: `&`, `|`, `^` bind looser than comparison and arithmetic, so `x & 1 == 0` means `x & (1 == 0)` — always parenthesize the bitwise part. Shift overflow: `1 << 31` overflows a 32-bit signed int (use `1u << 31` or a 64-bit literal). Sign extension: right-shifting a negative signed value fills with 1s (arithmetic shift), so logical vs arithmetic shift matters. Undefined behaviour shifting by >= the width. And in languages with arbitrary-precision integers (Python), `~x` and `x & -x` still work but negative masks behave differently than in fixed-width languages — know your integer model.

### Why do interviewers like bit-manipulation questions?

Because they expose the layer beneath the abstraction: whether you actually understand two's complement, why `x & (x-1)` clears the lowest bit, and that popcount can be O(1). They also test pattern recognition — seeing that a "choose a subset of n <= 20 items" problem is really an integer-indexed DP, or that a parity/uniqueness problem collapses to a single XOR. A strong candidate moves fluidly from the tricks (isolate lowest bit, count bits) to the modelling insight (encode the set as a mask) and states the constant-factor and space wins honestly.

## Number Theory & Mathematical Algorithms

### Summary

**What this topic covers**
The small toolbox of number-theoretic algorithms interviewers actually reach for: Euclid's GCD (and LCM through it), modular arithmetic with modular inverses, fast (binary) exponentiation, the Sieve of Eratosthenes, primality testing, and combinatorics (nCr) computed under a prime modulus. The mental model: most of these are logarithmic-time tricks that let you compute exact answers to enormous quantities without ever holding a huge number — you stay inside `mod m` the whole way. The recurring theme is "reduce the problem size by a constant factor each step" (exponentiation, GCD) or "sieve once, answer many" (primes, factorials).

**Key terms**
`gcd(a,b)` — largest integer dividing both. `lcm(a,b) = a / gcd(a,b) * b`. Modular arithmetic — doing arithmetic in the ring of residues mod m, where `(a+b) mod m`, `(a*b) mod m` are well-defined. Modular inverse of a — the x with `a*x ≡ 1 (mod m)`; it exists iff `gcd(a,m) = 1`. Fermat's little theorem — for prime p and a not divisible by p, `a^(p-1) ≡ 1 (mod p)`, so `a^(p-2)` is a's inverse. Fast exponentiation — computing `a^n` in `O(log n)` multiplications by squaring. Sieve of Eratosthenes — marking composites to list all primes up to n. nCr — binomial coefficient "n choose r". Coprime — gcd equals 1.

**Core mechanics**
Euclid's algorithm: `gcd(a,b) = gcd(b, a mod b)`, base case `gcd(a,0)=a`. Correctness rests on the invariant that the set of common divisors of (a,b) equals that of (b, a mod b). It runs in `O(log min(a,b))` — consecutive remainders drop by at least half every two steps (a Fibonacci-worst-case bound). Binary exponentiation reads the exponent's bits: `a^n = (a^(n/2))^2` for even n, `a * a^(n-1)` for odd, giving `T(n) = T(n/2) + O(1)` = `O(log n)` multiplications; keep every product `mod m` to bound number size. The sieve marks multiples of each prime p starting at `p*p`; total work is `n * sum(1/p)` = `O(n log log n)`, space `O(n)`. nCr mod prime p: precompute factorials and their inverses once (`O(n)` with a single modular inverse and a backward pass), then each query is `fact[n] * invfact[r] * invfact[n-r] mod p` in `O(1)`.

**Trade-offs**
Fermat's-inverse (`a^(p-2)`) needs a prime modulus and costs `O(log p)`; the extended-Euclid inverse works for any m coprime to a and is also `O(log m)` — reach for extended Euclid when the modulus isn't prime. Sieve vs trial division: sieve wins overwhelmingly when you need *all* primes or many primality checks up to a bound; trial division (`O(sqrt(n))` per number) wins for a single large query where n is too big to sieve. Precomputed factorials cost `O(n)` memory but turn each nCr into `O(1)` — worth it above a handful of queries; Pascal's triangle is simpler but `O(n^2)` time and memory.

**Common confusions**
You cannot divide under a modulus — you multiply by the modular inverse, and only when the divisor is coprime to m. `a % m` in most languages can be negative for negative a; normalize with `((a % m) + m) % m`. Forgetting to take mod *inside* the loop of exponentiation overflows 64-bit ints. LCM computed as `a*b/gcd` overflows if you multiply first — divide before multiplying. Fermat's inverse silently gives wrong answers if p isn't actually prime, or if a is a multiple of p (inverse doesn't exist). Sieving multiples from `2*p` instead of `p*p` still works but wastes time.

**Why interviewers ask**
These test whether you can keep numbers bounded and reason about complexity precisely rather than reaching for big-integer libraries. The classic angle is "compute nCr mod 1e9+7" or "a^b mod m for huge b" — a direct check of fast exponentiation and modular inverse. Follow-ups probe correctness of Euclid, when an inverse exists, and how you'd handle a non-prime modulus (CRT, extended Euclid). Strong candidates state the exact Big-O and the overflow guards without prompting.

### What is Euclid's algorithm and why does it terminate quickly?

`gcd(a,b) = gcd(b, a mod b)` with base case `gcd(a,0) = a`. It terminates because each step replaces `(a,b)` with `(b, a mod b)`, and `a mod b < b`, so the second argument strictly decreases toward 0. It's *fast* — `O(log min(a,b))` — because in two consecutive steps the larger value at least halves: if `b <= a/2` the remainder is already `< a/2`; if `b > a/2` then `a mod b = a - b < a/2`. The worst case is consecutive Fibonacci numbers, which is where the log base is the golden ratio.

### How do you compute LCM, and what's the overflow trap?

`lcm(a,b) = a / gcd(a,b) * b`. Divide by the gcd *first*, then multiply — writing `a * b / gcd` computes the full product before dividing, which can overflow 64-bit even when the true LCM fits. There is no separate LCM algorithm; it rides entirely on one gcd call, so it's `O(log min(a,b))`.

### Explain binary (fast) exponentiation.

To compute `a^n`, look at n in binary. Square the base repeatedly (`a, a^2, a^4, ...`) and multiply into the result only for bits of n that are set. Equivalently, recursively: `a^n = (a^(n/2))^2` if n even, `a * a^(n-1)` if odd. The recurrence `T(n) = T(n/2) + O(1)` gives `O(log n)` multiplications instead of `O(n)`.

```python
def power(a, n, m):
    result = 1
    a %= m
    while n > 0:
        if n & 1:
            result = result * a % m
        a = a * a % m
        n >>= 1
    return result
```

### Why take the modulus inside the loop rather than at the end?

Because `a^n` is astronomically large — it would need arbitrary-precision arithmetic and blow past 64-bit ints almost immediately. Since `(x*y) mod m = ((x mod m) * (y mod m)) mod m`, you can reduce after every multiplication and keep every intermediate below `m^2`, which fits in 64 bits for `m < ~3e9`. The final answer is identical; you've just never let the numbers grow.

### What is a modular inverse and when does it exist?

The modular inverse of a mod m is the x satisfying `a*x ≡ 1 (mod m)`. It exists *if and only if* `gcd(a, m) = 1` (a and m are coprime). Intuition: multiplication by a is a bijection on residues mod m exactly when a shares no factor with m, and a bijection means 1 has a preimage. When gcd > 1, a maps multiple residues together, so no inverse can undo it.

### How do you compute a modular inverse two different ways?

Two standard methods. (1) Fermat's little theorem, when m is prime: `a^(m-2) mod m` is the inverse, computed by fast exponentiation in `O(log m)`. (2) Extended Euclidean algorithm, for any m coprime to a: it finds x,y with `a*x + m*y = 1`, and x mod m is the inverse — also `O(log m)`. Use Fermat when the modulus is a known prime (like 1e9+7); use extended Euclid when it isn't.

### Why can't you just divide under a modulus?

Because division isn't defined in modular arithmetic — `(a / b) mod m` is meaningless in general. `10 / 2 = 5` but `10 mod 7 = 3` and `2 mod 7 = 2`, and `3/2` isn't an integer. Instead you multiply by the modular inverse: `a / b mod m` becomes `a * inverse(b, m) mod m`, valid only when `gcd(b,m)=1`. This is the single most common modular-arithmetic mistake.

### Describe the Sieve of Eratosthenes and its complexity.

Create a boolean array `is_prime[0..n]` all true, clear 0 and 1. For each i from 2 to sqrt(n), if `is_prime[i]`, mark every multiple of i starting at `i*i` as composite. What survives is prime. Starting at `i*i` (not `2*i`) is the key optimization — smaller multiples were already marked by smaller primes. Total marking work is `n * (1/2 + 1/3 + 1/5 + ...)` over primes, which is `O(n log log n)`; space is `O(n)`.

### When would you use trial division instead of a sieve?

For a *single* primality query on a number too large to sieve up to. Trial division checks divisors up to `sqrt(n)` — `O(sqrt(n))` per number — and needs only `O(1)` space. The sieve is `O(n log log n)` time and `O(n)` space, which only pays off when you need every prime up to n or will run many checks in that range. One big number: trial division (or Miller-Rabin). Many numbers in a range: sieve.

### How do you test primality for a single large n?

Trial division up to `sqrt(n)`, checking only 2 and odd numbers (or a 2,3 wheel) — `O(sqrt(n))`. For very large n where `sqrt(n)` is still too big, use the Miller-Rabin probabilistic test: it runs in `O(k log^3 n)` for k rounds and, with a fixed set of witness bases, is deterministic for all 64-bit integers. Interviewers usually accept `sqrt(n)` trial division unless they explicitly push on huge inputs.

### How do you compute nCr mod a prime efficiently?

`nCr = n! / (r! * (n-r)!)`. Under a prime mod p, division becomes multiplication by inverses: `fact[n] * invfact[r] % p * invfact[n-r] % p`. Precompute `fact[0..n]` in `O(n)`, compute `invfact[n]` with one Fermat inverse, then fill `invfact[i] = invfact[i+1] * (i+1) % p` backward in `O(n)`. After that, every nCr query is `O(1)`. This is the standard "combinatorics mod 1e9+7" setup.

### Why precompute inverse factorials backward instead of inverting each one?

Because a single modular inverse costs `O(log p)`, so inverting all n factorials directly would be `O(n log p)`. Instead compute just `invfact[n]` once, then use the identity `invfact[i] = invfact[i+1] * (i+1) mod p` to walk backward — each step is one multiplication, so the whole array is `O(n)` after a single `O(log p)` inversion. It's a classic constant-factor-that-matters optimization.

### What is Fermat's little theorem and how is it used here?

For a prime p and any a not divisible by p, `a^(p-1) ≡ 1 (mod p)`. Multiply both sides by `a^(-1)`: `a^(p-2) ≡ a^(-1) (mod p)`. So raising a to the `p-2` power gives its modular inverse — a one-liner via fast exponentiation. It underpins the whole nCr-mod-prime pipeline. The catch: p must genuinely be prime and a must not be a multiple of p.

### What is matrix exponentiation and when does it beat linear DP?

Any linear recurrence (like Fibonacci: `F(n) = F(n-1) + F(n-2)`) can be written as a matrix-vector product: state vector times a fixed transition matrix advances one step. To advance n steps, raise the matrix to the n-th power using binary exponentiation on matrices — `O(k^3 log n)` for a k-by-k matrix. This crushes an `O(n)` DP when n is astronomically large (like `10^18`), because it's logarithmic in n. The trade-off is the `k^3` factor, so it only wins when the state dimension k is small and n is huge.

### Show the Fibonacci matrix identity.

```text
| F(n+1)  F(n)   |   | 1  1 |^n
| F(n)    F(n-1) | = | 1  0 |
```

Raising `[[1,1],[1,0]]` to the n-th power (via binary exponentiation, all entries kept mod m) gives `F(n)` in the off-diagonal in `O(log n)` matrix multiplies. This is the canonical demonstration that matrix exponentiation turns an `O(n)` recurrence into `O(log n)`.

### How do you handle negative numbers under a modulus?

In C/C++/Java, `%` follows sign-of-dividend, so `-3 % 7` is `-3`, not `4`. Normalize with `((a % m) + m) % m` to force a value in `[0, m)`. Python's `%` already returns a non-negative result for positive m, so the guard is unnecessary there — but be explicit in interviews since the language matters. Getting a negative "answer" out of a mod computation is almost always this bug.

## Randomized Algorithms & Selection

### Summary

**What this topic covers**
Algorithms that use randomness to get simple, fast, robust behavior: randomized quicksort (random pivot to dodge adversarial inputs), quickselect and median-of-medians for finding the k-th smallest element (order statistics) in `O(n)`, reservoir sampling for uniform sampling from a stream of unknown length, and the Fisher-Yates shuffle for an unbiased permutation. The unifying idea: randomness converts *worst-case* guarantees you can't rely on into *expected-case* guarantees that hold regardless of input, and it does so with tiny, clean code.

**Key terms**
Order statistic — the k-th smallest element; the median is the n/2-th. Selection — finding an order statistic without fully sorting. Pivot — the element a partition step splits around. Partition — rearranging so elements < pivot precede it and > pivot follow (Lomuto or Hoare scheme). Las Vegas algorithm — always correct, running time is random (randomized quicksort, quickselect). Monte Carlo algorithm — running time is bounded, the *answer* may be wrong with small probability (Miller-Rabin). Reservoir sampling — streaming uniform sample. In-place — uses `O(1)` extra space.

**Core mechanics**
Randomized quicksort picks a uniformly random pivot, partitions in `O(n)`, and recurses on both sides. Expected comparisons are `O(n log n)`: any two elements are compared at most once, with probability `2/(j-i+1)`, and summing gives the `2n ln n` bound — crucially independent of the input order. Quickselect is quicksort that recurses into *only one* side (the side containing rank k), giving expected `T(n) = T(n/2) + O(n) = O(n)` by the geometric series, though worst case is `O(n^2)`. Median-of-medians picks a provably good pivot (median of group-of-5 medians) to guarantee each side is at most `~70%`, yielding deterministic `O(n)` — at a large constant. Reservoir sampling keeps the current pick and replaces it with the i-th stream element with probability `1/i`; induction shows every element ends with probability `1/n`. Fisher-Yates walks the array once, swapping index i with a uniform random index in `[i, n-1]`, producing each of the n! permutations equiprobably in `O(n)`.

**Trade-offs**
Randomized quicksort vs mergesort: quicksort is in-place (`O(log n)` stack) and cache-friendly but has `O(n^2)` worst case and isn't stable; mergesort guarantees `O(n log n)` but needs `O(n)` scratch. Quickselect vs sorting-then-indexing: quickselect is expected `O(n)` vs `O(n log n)` — win when you need one order statistic, not the full order. Quickselect vs median-of-medians: the randomized version is faster in practice with a smaller constant but has a bad worst case; median-of-medians guarantees `O(n)` but its constant makes it slower on typical inputs — use it only when adversarial worst-case matters (or as the pivot-picker inside introselect).

**Common confusions**
Randomization removes the *systematic* worst case (sorted input) but not the *possibility* of `O(n^2)` — it just makes it astronomically unlikely and input-independent. "Median-of-medians" is a pivot strategy for `O(n)` selection, not itself a sort. A naive shuffle that swaps each index with *any* index in `[0, n-1]` is biased — it produces `n^n` equally likely sequences, which don't divide evenly into `n!` permutations; Fisher-Yates must draw from `[i, n-1]`. Reservoir sampling's replacement probability is `1/i` at step i, not `1/n`. Las Vegas (quicksort) and Monte Carlo (Miller-Rabin) are different guarantees — don't conflate "randomized" with "possibly wrong."

**Why interviewers ask**
Selection ("find the k-th largest") is a top-tier interview question and the honest answer is quickselect, not "sort it." These test whether you can reason about *expected* complexity and probability, not just worst case. Fisher-Yates is a classic "is your shuffle actually uniform?" trap. Reservoir sampling checks streaming/one-pass thinking. The senior follow-up is always "what's the worst case and how do you defend against it?" — random pivot, median-of-medians, or introselect.

### Why does randomizing the pivot fix quicksort's worst case?

Deterministic quicksort (first/last pivot) hits `O(n^2)` on already-sorted input because every partition peels off one element. A *random* pivot makes the worst case depend on coin flips, not input order — no fixed input is bad anymore. Expected splits are balanced enough that expected time is `O(n log n)` for *every* input. The `O(n^2)` case still exists but requires a long run of unlucky pivots, with probability vanishingly small.

### Derive quicksort's expected O(n log n).

Consider the sorted order. Two elements at sorted ranks i and j are compared only if one of them is chosen as pivot before any element ranked strictly between them — probability `2/(j - i + 1)`. Summing over all pairs: `sum_i sum_j 2/(j-i+1)` is `O(n log n)` (each inner sum is a harmonic series `~2 ln n`). Total expected comparisons `~2n ln n ≈ 1.39 n log2 n`. The bound holds for any input because randomness is in the pivot, not the data.

### What is quickselect and what's its complexity?

Quickselect finds the k-th smallest element. Partition around a random pivot; if the pivot lands at index k you're done, otherwise recurse into *only the side* containing rank k. Because you discard one side, the expected recurrence is `T(n) = T(n/2) + O(n) = O(n)` (geometric series in the partition costs). Worst case is `O(n^2)` if pivots are consistently terrible, but expected is linear — strictly better than the `O(n log n)` of sort-then-index.

### Why is quickselect O(n) expected but quicksort O(n log n)?

Quicksort recurses into *both* partitions, so it does `O(n)` work at each of `O(log n)` levels — `O(n log n)`. Quickselect recurses into only *one* partition, so the subproblem sizes shrink geometrically: `n + n/2 + n/4 + ... = 2n = O(n)`. The single-sided recursion is the whole difference — you never pay to order the parts you don't care about.

### How does median-of-medians guarantee linear worst case?

Split the array into groups of 5, find each group's median (`O(1)` each, `O(n)` total), then recursively select the median *of those medians* as the pivot. That pivot is guaranteed greater than at least 30% and less than at least 30% of elements, so each recursion shrinks the problem to at most `~0.7n`. The recurrence `T(n) = T(n/5) + T(7n/10) + O(n)` solves to `O(n)` because `1/5 + 7/10 < 1`. It's deterministic `O(n)` — no luck required.

### If median-of-medians is O(n) worst case, why prefer randomized quickselect?

Constants. Median-of-medians does substantial extra work (grouping, recursive median-of-medians pivot selection) that inflates the hidden constant, making it slower than randomized quickselect on realistic inputs despite the better worst-case guarantee. In practice you use randomized quickselect and only fall back to median-of-medians when you must defend against a true adversary — which is exactly what introselect does.

### What is reservoir sampling and when do you need it?

Reservoir sampling picks a uniform random sample from a stream whose length you don't know in advance (or that's too large to store). Keep the first element as the current pick; for the i-th element, replace the pick with probability `1/i`. When the stream ends, the held element is uniformly random over all seen. It's one pass, `O(1)` memory (for a single sample), essential for streaming data or when n is unknown.

### Prove reservoir sampling is uniform.

By induction: after seeing i elements, each has probability `1/i` of being held. Element i is kept with probability `1/i` by construction. Any earlier element j was held with probability `1/(i-1)` and survives step i if we *don't* replace, i.e. with probability `(1 - 1/i) = (i-1)/i`; multiply: `1/(i-1) * (i-1)/i = 1/i`. So all i elements are equiprobable at every step, hence `1/n` at the end.

### Describe the Fisher-Yates shuffle.

Iterate i from 0 to n-1 (or n-1 down to 1), and swap `a[i]` with `a[j]` where j is a uniform random index in `[i, n-1]`. Each of the n! permutations is produced with equal probability `1/n!`, and it runs in `O(n)` time, in place. The invariant: after processing position i, positions `0..i` hold a uniformly random selection in random order.

### What's the classic bug that makes a shuffle biased?

Swapping `a[i]` with a random index in the *full* range `[0, n-1]` instead of `[i, n-1]`. That version generates `n^n` equally likely execution paths, but there are only `n!` permutations, and `n^n` is not divisible by `n!` — so some permutations become more likely than others. The fix is to draw only from indices not yet fixed: `[i, n-1]`.

### Monte Carlo vs Las Vegas — what's the difference?

A Las Vegas algorithm is *always correct*; only its running time is random (randomized quicksort, quickselect — you always get the sorted array / right element, just in expected time). A Monte Carlo algorithm has a *bounded* running time but may return a *wrong answer* with small, controllable probability (Miller-Rabin primality — it can call a composite "prime" with probability driven to near-zero by more rounds). Trade time for certainty: run more rounds to shrink Monte Carlo error.

### How do you turn a Monte Carlo algorithm into a Las Vegas one (and vice versa)?

If you can *verify* a Monte Carlo answer cheaply, wrap it in a retry loop: run until the check passes — now it's always correct with random running time (Las Vegas). Conversely, cap a Las Vegas algorithm's time and return a best-guess if it exceeds the budget — now running time is bounded but correctness isn't guaranteed (Monte Carlo). Verification is the hinge between the two.

### How would you pick a random element with weighted probability?

Weighted reservoir or prefix-sum sampling. For a fixed array, build a prefix-sum of weights (`O(n)`), draw a uniform value in `[0, total)`, and binary-search for the bucket — `O(log n)` per sample. For a stream, use the A-Res weighted reservoir variant (assign each item a key `u^(1/w)` for uniform u and keep the largest). The prefix-sum method is the usual interview answer for a static distribution.

### What is introselect and why is it used in real libraries?

Introselect (introspective select) runs randomized quickselect but *monitors recursion depth*; if it exceeds a threshold (signaling a bad-pivot streak), it switches to median-of-medians to guarantee `O(n)`. You get quickselect's fast average case with median-of-medians' worst-case safety net. Its sorting cousin, introsort (quicksort falling back to heapsort), is what `std::sort` uses for the same reason.

### Find the k-th largest — sort, heap, or quickselect?

Three options, different trade-offs. Sort then index: `O(n log n)`, dead simple, fine if you also need order. A size-k min-heap: `O(n log k)` time, `O(k)` space — best when k is small or data streams in. Quickselect: expected `O(n)`, in place, best when you need a single order statistic from an in-memory array and don't need the rest sorted. The strong answer names quickselect as optimal and the heap as the streaming/top-k choice.

## Prefix Sums, Difference Arrays & Range Techniques

### Summary

**What this topic covers**
Precomputation techniques that turn repeated range queries and range updates from `O(n)` each into `O(1)` or `O(log n)`: 1D and 2D prefix sums for static range-sum queries, difference arrays for batched range *updates*, sqrt decomposition as a general-purpose blockwise middle ground, and sparse tables for `O(1)` idempotent range queries (like range-minimum) on static data. The mental model: spend `O(n)` (or `O(n log n)`) once to build a structure, then answer many queries cheaply. Prefix sums and difference arrays are duals — one answers range queries, the other applies range updates.

**Key terms**
Prefix sum — `pre[i] = a[0] + ... + a[i-1]`, so `sum(l, r) = pre[r+1] - pre[l]`. Difference array — `diff[i] = a[i] - a[i-1]`; adding v over `[l, r]` is `diff[l] += v; diff[r+1] -= v`, then a prefix sum reconstructs a. 2D prefix sum — inclusion-exclusion over a rectangle. Sqrt decomposition — split into `~sqrt(n)` blocks, precompute per-block aggregates. Sparse table — precomputed answers for every power-of-two-length interval, enabling `O(1)` idempotent queries. Idempotent — an operation where `f(x, x) = x` (min, max, gcd), so overlapping ranges don't double-count. Static — no updates after building.

**Core mechanics**
1D prefix sum: build `pre` in `O(n)`, each range sum is `pre[r+1] - pre[l]` in `O(1)`. 2D: `pre[i][j]` is the sum of the rectangle from origin; a query rectangle uses inclusion-exclusion `pre[r2+1][c2+1] - pre[r1][c2+1] - pre[r2+1][c1] + pre[r1][c1]` in `O(1)` after `O(nm)` build. Difference array: to apply many range-add updates offline, record `+v` at l and `-v` at r+1 for each, then one prefix-sum pass materializes the final array — k updates in `O(k + n)` total instead of `O(kn)`. Sqrt decomposition: `~sqrt(n)` blocks, query touches at most two partial blocks (`O(sqrt(n))` elements) plus whole-block aggregates (`O(sqrt(n))` blocks) = `O(sqrt(n))` per query and update. Sparse table: `table[k][i]` answers the interval starting at i of length `2^k`, built by `table[k][i] = f(table[k-1][i], table[k-1][i + 2^(k-1)])` in `O(n log n)`; a query covers `[l, r]` with two overlapping power-of-two intervals in `O(1)` — valid only for idempotent f.

**Trade-offs**
Prefix sum vs Fenwick/segment tree: prefix sums give `O(1)` queries but `O(n)` per update (you'd rebuild) — perfect for *static* data, useless if values change often; for point-update + range-query use a Fenwick tree (`O(log n)` both), and for range-update + range-query use a segment tree with lazy propagation (both live in the Data Structures primer). Difference array vs segment tree: difference array handles *offline* batched range updates in `O(1)` each but needs a final `O(n)` pass and can't interleave queries; a lazy segment tree handles online interleaved updates and queries at `O(log n)`. Sparse table vs segment tree: sparse table is `O(1)` query but `O(n log n)` space and *no updates*; segment tree is `O(log n)` query but supports updates.

**Common confusions**
Off-by-one on prefix sums — decide whether `pre` is inclusive or exclusive and stick to it; the clean convention is `pre[0]=0`, `pre[i]=pre[i-1]+a[i-1]`, `sum(l,r)=pre[r+1]-pre[l]` for 0-indexed inclusive `[l,r]`. In 2D, forgetting the `+pre[r1][c1]` inclusion-exclusion term double-subtracts the overlap. Difference arrays apply updates but you must remember the final prefix-sum reconstruction, and they only work *offline* (all updates before any query). Sparse tables are only valid for *idempotent* operations — using one for range-*sum* double-counts the overlap and gives wrong answers (use a sparse table's disjoint variant or a Fenwick tree for sums). Sqrt decomposition's block size should be `~sqrt(n)` to balance the two `O(sqrt(n))` terms.

**Why interviewers ask**
Prefix sums are the single highest-leverage precomputation trick — "subarray sum equals k," "range sum query immutable," and countless problems collapse once you see them. Interviewers check whether you reach for `O(1)`-query precomputation instead of recomputing, and whether you know the *update* story (difference array offline, Fenwick/segment tree online). The classic follow-up: "now the array gets updated between queries — what changes?" — which separates candidates who memorized prefix sums from those who understand the query/update trade-off space.

### What is a prefix sum and how does it answer range queries in O(1)?

A prefix sum array stores cumulative totals: `pre[i]` = sum of the first i elements, with `pre[0] = 0`. Then the sum of any inclusive range `[l, r]` (0-indexed) is `pre[r+1] - pre[l]` — the big prefix minus the part before l. Building `pre` is one `O(n)` pass; every subsequent range-sum query is a single subtraction, `O(1)`. It's the canonical "precompute once, query many" trick.

### Give the standard prefix-sum indexing convention to avoid off-by-one.

Use a size-`n+1` array with `pre[0] = 0` and `pre[i] = pre[i-1] + a[i-1]`. Then for a 0-indexed inclusive range `[l, r]`, `sum = pre[r+1] - pre[l]`. The extra leading zero means `l = 0` needs no special case (`pre[0] = 0`). Pick this convention and never mix it with an inclusive-`pre` variant — inconsistency is where off-by-one bugs breed.

### How does a 2D prefix sum work?

`pre[i][j]` holds the sum of the rectangle from `(0,0)` to `(i-1, j-1)`. Build it with `pre[i][j] = a[i-1][j-1] + pre[i-1][j] + pre[i][j-1] - pre[i-1][j-1]` (inclusion-exclusion to avoid double-counting the overlap). A query for the rectangle `[(r1,c1),(r2,c2)]` inclusive is `pre[r2+1][c2+1] - pre[r1][c2+1] - pre[r2+1][c1] + pre[r1][c1]` — `O(1)` after `O(nm)` build.

### Why does the 2D query add back one corner term?

Inclusion-exclusion. Subtracting the top strip and the left strip each removes the top-left overlap rectangle *once* — so it's been subtracted twice. Adding `pre[r1][c1]` back restores that doubly-removed region exactly once. Forgetting this `+` term is the most common 2D-prefix-sum bug; the result under-counts by the top-left corner rectangle.

### What is a difference array and what problem does it solve?

A difference array `diff` stores consecutive differences: `diff[i] = a[i] - a[i-1]`. Its power is *range updates*: to add v to every element in `[l, r]`, you only touch two cells — `diff[l] += v` and `diff[r+1] -= v` — in `O(1)`. After applying all updates, a single prefix-sum pass over `diff` reconstructs the final array. It's the dual of prefix sums: prefix sums answer range queries, difference arrays apply range updates.

### How do difference arrays make k range updates O(k + n)?

Each range-add update is `O(1)` (two cell writes) regardless of the range's length, so k updates cost `O(k)`. Then one `O(n)` prefix-sum pass materializes the fully-updated array. Total `O(k + n)` versus the naive `O(kn)` of updating each range element-by-element. The catch: it's *offline* — you apply all updates first, then read; you can't interleave queries between updates.

### When can't you use a difference array?

When updates and queries interleave (online) — a difference array needs all updates applied before the reconstruction pass, so you can't ask for a current value mid-stream cheaply. It's also range-add only; arbitrary per-element updates or range-assign don't fit the two-cell trick directly. For online range-update-and-query, use a lazy-propagation segment tree (Data Structures primer).

### What is sqrt decomposition?

Split the array into `~sqrt(n)` contiguous blocks of size `~sqrt(n)`, and precompute an aggregate (sum, min, ...) per block. A range query walks at most two partial end blocks element-by-element (`O(sqrt(n))`) and combines the whole blocks in between via their precomputed aggregates (at most `sqrt(n)` blocks, `O(sqrt(n))`). Both query and point update are `O(sqrt(n))`. It's a simple, general middle ground — easier to code than a segment tree and flexible enough for many query types.

### Why is the block size sqrt(n)?

Because query cost is "partial elements" + "whole blocks" = `O(block_size) + O(n / block_size)`. Minimizing the sum of those two terms happens when they're equal: `block_size = n / block_size`, i.e. `block_size = sqrt(n)`, giving `O(sqrt(n))` overall. Larger blocks make the partial scan dominate; smaller blocks make the block count dominate.

### What is a sparse table and what is it for?

A sparse table precomputes the answer for every interval whose length is a power of two: `table[k][i]` covers `[i, i + 2^k - 1]`. It's built in `O(n log n)` via `table[k][i] = f(table[k-1][i], table[k-1][i + 2^(k-1)])`. It answers *idempotent* range queries (min, max, gcd) in `O(1)` on *static* data — but supports no updates. It's the go-to for immutable range-minimum queries.

### How does a sparse table answer a query in O(1)?

For range `[l, r]`, let `k = floor(log2(r - l + 1))`. Cover the range with *two* overlapping power-of-two intervals: one starting at l, one ending at r — `[l, l + 2^k - 1]` and `[r - 2^k + 1, r]`. Combine their two precomputed answers with `f`. Because `2^k` is at least half the range length, the two intervals fully cover `[l, r]`, and their overlap is harmless *only if* `f` is idempotent.

### Why does a sparse table require an idempotent operation?

Because its `O(1)` query uses two *overlapping* intervals, so any element in the overlap is counted twice. For min/max/gcd that's fine — `min(x, x) = x`, idempotency means double-counting doesn't change the answer. For *sum*, counting overlap elements twice inflates the result. So range-sum can't use the two-overlap trick; you'd need a Fenwick tree, prefix sums, or a disjoint sparse table variant instead.

### Prefix sum vs Fenwick tree vs segment tree — how do you choose?

Static data, range sum: prefix sums (`O(1)` query, no updates). Point update + range query: Fenwick/BIT (`O(log n)` both, compact). Range update + range query, or non-sum aggregates with updates: segment tree, with lazy propagation for range updates (`O(log n)`). The decision hinges on *whether values change* and *what operation* you need. Prefix sums are unbeatable when nothing updates; the trees earn their `O(log n)` by supporting updates. (Fenwick/segment trees live in the Data Structures primer.)

### How do prefix sums crack "count subarrays with sum k"?

Walk left to right tracking running prefix sum `s`. A subarray ending here with sum k exists for every earlier prefix equal to `s - k`. Keep a hash map of prefix-sum frequencies seen so far; at each index add `count[s - k]` to the answer, then increment `count[s]`. This is `O(n)` time, one pass — the prefix-sum + hashmap combination that shows up across dozens of subarray problems.

### The array now changes between queries — what breaks and what do you switch to?

A prefix-sum array breaks: a single element change invalidates every prefix from that index onward, so an update is `O(n)` (effectively a rebuild). For point updates with range-sum queries, switch to a Fenwick tree (`O(log n)` both). For range updates with range queries, switch to a lazy segment tree. Sparse tables also break (no updates) — for idempotent queries with updates, a segment tree replaces them. This "now it updates" pivot is the standard senior follow-up.

### When would you pick sqrt decomposition over a segment tree?

When you want something quick to implement and flexible for unusual queries, and `O(sqrt(n))` per operation is acceptable for the input size. Sqrt decomposition is far less error-prone to code under interview pressure than a lazy segment tree, and it adapts to odd query types (like "count of values > x in a range" via sorted blocks) where a segment tree needs more machinery. You pay `O(sqrt(n))` instead of `O(log n)`, which is fine up to `n ~ 10^5` and modest query counts.

## Computational Geometry Basics

### Summary

**What this topic covers**
The small toolkit of geometry primitives that show up in interviews and contests: representing points and vectors, the cross-product orientation test, building a convex hull, sweeping a line across the plane, finding the closest pair of points, and detecting whether two segments intersect. The unifying mental model is that almost everything reduces to the sign of a cross product (a 2x2 determinant) — "is C left or right of the ray A->B?" — done in integer arithmetic wherever possible.

**Key terms**
*Point / vector*: an ordered pair `(x, y)`; a vector is the difference of two points. *Cross product* (2D): `cross(u, v) = u.x*v.y - u.y*v.x`, a scalar equal to the signed area of the parallelogram; its sign gives orientation. *Orientation / CCW test*: sign of `cross(B-A, C-A)` — positive = counter-clockwise (left turn), negative = clockwise (right turn), zero = collinear. *Convex hull*: the smallest convex polygon enclosing a set of points. *Line sweep*: process events in sorted order (usually by x), maintaining an active set. *Collinear / degenerate*: cases where points line up or coincide, the source of most bugs.

**Core mechanics**
The cross product is the workhorse. `cross(B-A, C-A) > 0` means the path A->B->C turns left. Convex hull via **Andrew's monotone chain**: sort points by `(x, y)`, then build the lower hull left-to-right and the upper hull right-to-left, popping any point that fails to make a counter-clockwise turn (`cross <= 0`) — `O(n log n)`, dominated by the sort, `O(n)` extra space. **Graham scan** is equivalent but sorts by polar angle around the lowest point. **Closest pair** uses divide and conquer: sort by x, split, recurse on halves, then check a strip of width 2d around the dividing line where only a constant number of candidate neighbours per point exist — recurrence `T(n) = 2T(n/2) + O(n)` = `O(n log n)`. **Segment intersection** for two segments: they cross iff the endpoints of each straddle the other, tested with four orientation signs, plus explicit collinear-overlap handling when a sign is zero.

**Trade-offs**
Integer coordinates let you keep cross products exact — always prefer them; the moment you divide or take a square root you invite floating-point error. Monotone chain vs Graham scan: monotone chain is simpler to code correctly (sort by coordinate, no angle comparisons, no atan2), so it is the interview default. Brute-force closest pair is `O(n^2)` and fine up to a few thousand points; the divide-and-conquer version only pays off at scale and is fiddly to implement under time pressure.

**Common confusions**
Comparing floating-point cross products against `== 0` instead of an epsilon; using `atan2` for angle sorting and hitting precision/tie bugs; forgetting collinear points on a hull edge (decide up front whether to keep or drop them); overflow — cross products of large `int` coordinates need 64-bit accumulation; and conflating "segments intersect" (bounded) with "lines intersect" (infinite). Distances: compare squared distances to avoid `sqrt` entirely.

**Why interviewers ask**
Geometry problems test whether you can translate a visual/spatial idea into a robust numeric predicate and whether you respect precision. The classic angle is "convex hull, then reason about the hull" (diameter, rotating calipers) or "detect if any two of these segments cross." Follow-ups probe degenerate cases: duplicate points, all-collinear input, and vertical segments — the candidates who name these before coding stand out.

### What is the 2D cross product and what does its sign tell you?
For vectors `u` and `v`, `cross(u, v) = u.x*v.y - u.y*v.x`. It is a scalar equal to the signed area of the parallelogram they span. Applied as `cross(B-A, C-A)`, the sign tells you the turn direction of A->B->C: positive means C is to the left (counter-clockwise turn), negative means right (clockwise), zero means the three points are collinear. This single predicate underlies orientation tests, hull construction, and intersection tests.

### How does the orientation (CCW) test work and why prefer it over computing angles?
Compute `d = cross(B-A, C-A)` and branch on `sign(d)`. It answers "which side of line AB does C lie on" using only multiplications and subtractions. Prefer it over `atan2` or slopes because with integer coordinates it is exact — no division, no trig, no floating-point rounding. Slope-based tests divide by `dx` and blow up on vertical lines; angle-based tests accumulate `atan2` error and create tie-breaking headaches. The cross product sidesteps all of that.

### How do you compute a convex hull with Andrew's monotone chain?
Sort the points by `(x, y)`. Build the lower hull: iterate left to right, and while the last two hull points plus the new point do not make a counter-clockwise turn (`cross <= 0`), pop the last point; then push. Build the upper hull the same way iterating right to left. Concatenate, dropping the duplicated endpoints. It is `O(n log n)` time (the sort dominates; the scan is linear because each point is pushed and popped at most once) and `O(n)` space. It avoids polar-angle sorting entirely, which is why it is the safer choice in an interview.

### How does Graham scan differ from monotone chain?
Graham scan picks the lowest (then leftmost) point as a pivot, sorts the rest by polar angle around it, then walks the sorted list maintaining a stack, popping on non-left turns. It is also `O(n log n)`. The difference is the sort key: Graham uses angles (best done with cross-product comparators, not `atan2`), monotone chain uses plain coordinate order and builds two chains. Monotone chain has fewer edge cases (no pivot selection, no angle ties), so most people reach for it; the two produce the same hull.

### Why is a convex hull bounded below by O(n log n)?
Building the hull can sort numbers: place values `x_i` as points `(x_i, x_i^2)` on a parabola — all are on the hull, and reading them off the hull yields them in sorted order. So a comparison-based hull algorithm that beat `O(n log n)` would beat the sorting lower bound, which is impossible. Hence `O(n log n)` is optimal for comparison-based hull construction, and monotone chain/Graham both hit it.

### What is the line-sweep technique?
Imagine a vertical line sweeping left to right across the plane. You precompute "events" (segment endpoints, points, rectangle edges), sort them by x, and process them in order while maintaining an "active set" of objects currently intersecting the sweep line, usually in a balanced BST keyed by y. Work happens only at events, and neighbours in the active set are the only pairs that can interact. It turns many `O(n^2)` "check all pairs" problems into `O(n log n)` by exploiting sorted order and locality.

### How does line sweep detect if any two of n segments intersect?
The Bentley-Ottmann approach: events are segment endpoints (and, in the full version, discovered intersections). Sweep left to right; the active set holds segments crossing the sweep line, ordered by their y at the current x. On a left endpoint, insert the segment and test it against its immediate neighbours above and below; on a right endpoint, remove it and test the two segments that become adjacent. Any intersection first appears between segments that are adjacent in this order, so checking neighbours suffices. Detecting whether *any* intersection exists is `O(n log n)`.

### How does divide-and-conquer find the closest pair of points?
Sort points by x, split into left and right halves, recurse to get the minimum distance `d` in each. The only remaining candidates are pairs straddling the divide within horizontal distance `d`, so collect points in that strip, sort them by y, and for each compare against the next few (at most 7) points in y-order — geometry guarantees a constant bound. The recurrence `T(n) = 2T(n/2) + O(n)` solves to `O(n log n)`. Below a few thousand points the `O(n^2)` brute force is simpler and often faster in practice.

### How do you test whether two line segments intersect?
Compute four orientations: `o1 = orient(A,B,C)`, `o2 = orient(A,B,D)`, `o3 = orient(C,D,A)`, `o4 = orient(C,D,B)`. The general case: the segments cross iff `o1 != o2` and `o3 != o4` (each pair of endpoints straddles the other segment). Then handle collinear cases where an orientation is zero: a segment endpoint may lie on the other segment, which you confirm with a bounding-box (on-segment) check. Keeping everything in integer cross products makes the general case exact.

### Why compare squared distances instead of actual distances?
The Euclidean distance needs a `sqrt`, which is slow and introduces floating-point error. But `sqrt` is monotonic, so `dist(a,b) < dist(c,d)` iff `dx^2+dy^2 < ...`. For any comparison, sorting, or nearest-point query you can work entirely with squared distances and integer arithmetic, staying exact and avoiding the square root. Only compute the real distance at the very end if the problem actually needs the magnitude.

### What are the main floating-point precision pitfalls in geometry?
Testing a cross product or determinant against exact `0` when it is a float — use an epsilon, or better, keep integer coordinates so it really is exact. Dividing to get slopes or intersection points introduces rounding and division-by-zero on vertical lines. `atan2`-based angle sorts accumulate error and mis-order near-equal angles. Accumulating area or performing many chained operations drifts. Large integer coordinates overflow 32-bit multiplication — cross products need 64-bit. The senior instinct is: stay in integers, compare squared lengths, and only convert to float at the boundary.

### How do you compute the area of a simple polygon?
Use the shoelace (surveyor's) formula: `2*Area = sum over edges of (x_i * y_{i+1} - x_{i+1} * y_i)`, wrapping the last vertex to the first, then take half the absolute value. The signed sum before taking the absolute value also tells you the winding orientation: positive means the vertices are listed counter-clockwise, negative means clockwise. It is `O(n)`, uses only cross-product-style terms, and stays exact with integer coordinates.

### How do you determine if a point is inside a polygon?
Two standard methods. **Ray casting**: shoot a ray from the point (say, along +x) and count edge crossings — odd means inside, even means outside; handle vertices and horizontal edges carefully. It is `O(n)` per query and works for any simple polygon. **Winding number**: sum signed angles or use orientation tests; more robust for self-intersecting polygons. For a convex polygon you can do better — binary search on the fan of triangles from one vertex gives `O(log n)` per query after `O(n)` preprocessing.

### When would you actually reach for computational geometry in an interview?
When the problem is inherently spatial: "largest triangle from these points," "do these intervals/rectangles overlap," "closest pair," "is this polygon convex," "minimum enclosing shape." The tell is coordinates plus a question about containment, intersection, or extremal position. Recognise it, then reduce to primitives — usually a convex hull plus a linear scan, or a sweep. State your precision strategy (integers, squared distances) before coding; interviewers weight robustness heavily here.

### What is a rotating calipers and what does it solve?
After computing the convex hull, rotating calipers walks two (or more) pointers around the hull in tandem, exploiting the fact that as one support line rotates, the antipodal point advances monotonically. This computes the **diameter** (farthest pair of points) in `O(n)` after the `O(n log n)` hull, as well as the width, the minimum-area/perimeter bounding rectangle, and the maximum distance between two convex polygons. The key insight is monotonicity: you never move a pointer backwards, so the whole sweep is linear.

## Intractability: P, NP & Approximation

### Summary

**What this topic covers**
The theory of which problems are efficiently solvable and what to do when yours is not. It defines P, NP, NP-complete, and NP-hard; explains polynomial-time reductions and why one hard problem's difficulty transfers to another; catalogues the classic hard problems (SAT, TSP, subset-sum, vertex cover); and lays out the practical escape routes — approximation algorithms with provable ratios, heuristics, and smart exponential exact methods. The mental model: "efficiently solvable" means polynomial time, and NP-completeness is strong evidence (not proof) that no such algorithm exists.

**Key terms**
*P*: decision problems solvable in polynomial time. *NP*: decision problems whose "yes" answer can be *verified* in polynomial time given a certificate. *NP-hard*: at least as hard as every problem in NP (everything in NP reduces to it); need not be in NP itself. *NP-complete*: in NP *and* NP-hard — the hardest problems that are still verifiable. *Reduction*: a polynomial-time transformation of instances of A into instances of B such that the answer is preserved. *Certificate/witness*: the short proof that a "yes" instance is a yes. *Approximation ratio*: the guaranteed worst-case bound of a heuristic's cost relative to optimal.

**Core mechanics**
NP is about *verification*, not solving: given a proposed solution (a certificate), can you check it in polynomial time? For TSP-as-a-decision-problem "is there a tour under length k," a tour is the certificate — check its length in `O(n)`. P is contained in NP. The million-dollar open question is whether P = NP. **Reductions** are how hardness spreads: if A is NP-hard and A reduces to B in polynomial time, then B is NP-hard too, because a fast solver for B would give a fast solver for A. Cook-Levin proved SAT is NP-complete from first principles; every other NP-completeness proof reduces a known-hard problem to the new one. When you cannot avoid an NP-hard problem you pick a coping strategy: **approximation** (guaranteed within a factor, e.g. 2-approx vertex cover), **heuristics** (no guarantee but good in practice, e.g. simulated annealing for TSP), or **exact exponential** methods (branch-and-bound, `O(2^n)` DP for TSP via Held-Karp) that are acceptable when n is small.

**Trade-offs**
Approximation buys a provable quality guarantee at the cost of not being optimal; heuristics buy speed and simplicity at the cost of any guarantee; exact exponential methods buy optimality at the cost of scaling only to small n. FPTAS/PTAS schemes let you trade running time for accuracy continuously (subset-sum has an FPTAS). The engineering choice depends on whether you need a bound, whether n is bounded, and how much the last few percent of optimality is worth.

**Common confusions**
NP does not stand for "non-polynomial" — it is "nondeterministic polynomial," about verifiability. NP-hard is not a subset of NP: the halting problem is NP-hard but not in NP. "NP-complete" implies both in NP and NP-hard. P vs NP is *open* — no one has proven fast algorithms don't exist; NP-completeness is evidence, not a theorem of impossibility. And a 2-approximation does not mean "usually within 2%" — it means never worse than twice optimal in the worst case.

**Why interviewers ask**
Mostly to see that you *recognise* when a problem is intractable and stop hunting for a polynomial algorithm that likely doesn't exist. The classic angle: you propose brute force, they ask "can you do better," and the senior answer is "this is NP-hard (here's the reduction sketch), so I'd use an approximation/heuristic/exact-for-small-n." Naming a reduction from a known hard problem, or a concrete approximation ratio, is the signal they want.

### What does it mean for a problem to be in P?
A decision problem is in P if some algorithm solves it in time polynomial in the input size — `O(n^k)` for a fixed `k`. Polynomial is the community's proxy for "efficient/tractable" because it composes nicely (a polynomial of a polynomial is polynomial) and is robust across reasonable machine models. Sorting, shortest paths, matching, linear programming, and primality testing are all in P. The exponent can be large, but the class draws the practical line between "we have a scalable algorithm" and "we probably don't."

### What is NP, and why is it about verification?
NP is the class of decision problems where a "yes" answer has a certificate that can be *checked* in polynomial time, even if *finding* it seems hard. For "does this graph have a Hamiltonian cycle," the certificate is the cycle itself — verifying it visits every vertex once is easy; discovering it is not. The name is "nondeterministic polynomial": a nondeterministic machine could guess the certificate and verify it in polynomial time. Every problem in P is in NP (you can ignore the certificate and just solve it).

### What is the difference between NP-hard and NP-complete?
NP-hard means "at least as hard as everything in NP" — every NP problem reduces to it in polynomial time — but it need not be in NP or even be a decision problem (optimization TSP and the halting problem are NP-hard). NP-complete means both **in NP** and **NP-hard**: the hardest problems that still have polynomial-time-checkable certificates. So NP-complete is the intersection; NP-hard is the broader "at least this hard" bucket. Solving one NP-complete problem in polynomial time would collapse all of NP into P.

### What is a polynomial-time reduction and why does it matter?
A polynomial-time (many-one) reduction transforms instances of problem A into instances of problem B, in polynomial time, so that A's answer is "yes" exactly when the transformed B instance's answer is "yes." It matters because it transfers hardness: if A is NP-hard and A reduces to B, then B is NP-hard too — a polynomial solver for B plus the reduction would solve A in polynomial time. Reductions are the currency of complexity theory; almost every NP-completeness proof is "reduce a known NP-complete problem to mine."

### How do we know any problem is NP-complete in the first place?
The Cook-Levin theorem proved SAT (Boolean satisfiability) is NP-complete *directly*: it showed that the computation of any polynomial-time nondeterministic verifier can be encoded as a Boolean formula that is satisfiable iff the machine accepts. That gave the first NP-complete problem without relying on another. Every subsequent proof is a reduction: reduce SAT (or a descendant like 3-SAT) to your problem to show it's NP-hard, and exhibit a polynomial verifier to show it's in NP. Karp's 21 problems seeded the chain that now covers thousands.

### What does P vs NP actually ask, and what's the consensus?
It asks whether every problem whose solution can be *verified* quickly can also be *solved* quickly — formally, does P = NP? If yes, thousands of currently intractable problems (and much of cryptography's hardness assumptions) would fall to polynomial algorithms. It remains open, one of the Millennium Prize problems. The strong consensus is P != NP, but that is belief backed by decades of failed attempts to find fast algorithms, not proof. This is why "NP-complete" is treated as practical evidence of intractability rather than certainty.

### Why is SAT important and what is 3-SAT?
SAT asks whether a Boolean formula has an assignment making it true; it was the first proven NP-complete problem, so it anchors the whole theory. **3-SAT** restricts each clause to exactly three literals (conjunctive normal form) and is still NP-complete, which makes it the favourite starting point for reductions — its rigid structure is easy to map onto graphs, sets, and other combinatorial gadgets. In practice, modern SAT solvers (CDCL) crack huge industrial instances fast despite the worst-case hardness, which is a nice reminder that "NP-complete" is a worst-case statement.

### Why is the Travelling Salesman Problem hard, and is any version easy?
TSP asks for the minimum-length tour visiting every city once. The decision version ("is there a tour under length k") is NP-complete; the optimization version is NP-hard. General TSP is even hard to approximate. But structure helps: **metric TSP** (distances satisfy the triangle inequality) admits a 2-approximation via a minimum spanning tree, and the Christofides algorithm gives 1.5. Euclidean TSP has a PTAS. Held-Karp solves it exactly in `O(n^2 * 2^n)` time and `O(2^n)` space — fine for n around 15-20, hopeless beyond.

### What is subset-sum and why is its "efficient" DP not polynomial?
Subset-sum asks whether some subset of given integers sums to a target `T`. The classic DP fills a boolean table over `(index, achievable sum)` in `O(n*T)` time. That looks polynomial but `T` is a *value*, whose size in bits is `log T`, so `O(n*T)` is exponential in the input length — it's **pseudo-polynomial**. This is the textbook example of the distinction: polynomial in the numeric magnitude is not polynomial in the encoding size. Subset-sum (and partition) is NP-complete, and it has an FPTAS that trades accuracy for genuinely polynomial time.

### What is the vertex cover problem and its classic 2-approximation?
Vertex cover asks for the smallest set of vertices touching every edge; the decision version is NP-complete. A famous simple 2-approximation: repeatedly pick any uncovered edge `(u,v)`, add *both* endpoints to the cover, and remove all edges incident to either. Because those two vertices cover an edge that any valid cover must also cover with at least one endpoint, the matching you build lower-bounds the optimum, and you used at most twice as many vertices. It runs in `O(V + E)` and guarantees a cover no larger than twice optimal.

### What is an approximation ratio and what's the difference between PTAS and FPTAS?
The approximation ratio is the worst-case bound on `(algorithm's cost) / (optimal cost)` for a minimization problem (or the inverse for maximization) — a 2-approximation is never worse than twice optimal. A **PTAS** (polynomial-time approximation scheme) takes an accuracy parameter epsilon and runs in time polynomial in `n` for each fixed epsilon, but the dependence on `1/epsilon` may be exponential. An **FPTAS** is stronger: polynomial in *both* `n` and `1/epsilon`. Subset-sum has an FPTAS; general TSP has neither unless P = NP.

### When would you choose a heuristic over an approximation algorithm?
Choose a heuristic (local search, simulated annealing, genetic algorithms, greedy with restarts) when you need good solutions fast and can't afford — or don't have — an algorithm with a provable ratio, and when empirical quality matters more than a worst-case guarantee. Approximation algorithms are preferable when you must promise a bound (SLA, safety, contractual). In interviews the honest answer is often "no polynomial exact algorithm is likely, so I'd run a heuristic and validate empirically, or an approximation if I need the guarantee."

### How do exact exponential methods stay usable on NP-hard problems?
Two levers: bound the input size, and prune aggressively. **Branch-and-bound** explores the solution tree but discards subtrees whose optimistic bound can't beat the best solution found — worst case still exponential, but often fast. **Bitmask/DP over subsets** (Held-Karp for TSP, `O(2^n)` DP) is exact for small n. **Meet-in-the-middle** splits the input to turn `O(2^n)` into roughly `O(2^{n/2})` (great for subset-sum). And modern **SAT/ILP solvers** routinely crush large real instances despite worst-case hardness. The theme: exponential is acceptable when n is small or the structure prunes hard.

### How do you recognise an NP-hard problem in an interview, and what should you say?
Signals: the problem asks for an optimal subset/permutation/partition/assignment over a combinatorial space with interacting constraints, and no obvious greedy or DP with polynomial state fits — think tours, packings, colourings, cliques, general subset selection. When you spot it, say so: "this looks NP-hard — it reduces to/from [TSP, subset-sum, vertex cover, graph colouring], so I don't expect a polynomial exact algorithm." Then pivot to a plan: exact for small n (bitmask DP, branch-and-bound), an approximation with a stated ratio, or a heuristic. Naming the reduction and the coping strategy is exactly what they're grading.

### Are there problems between P and NP-complete?
If P != NP, then yes — Ladner's theorem guarantees "NP-intermediate" problems that are in NP but neither in P nor NP-complete. The suspected real-world examples are **integer factorization** and **graph isomorphism**: both in NP, no known polynomial algorithm, yet no NP-completeness proof (graph isomorphism now has a quasi-polynomial algorithm, strong evidence it isn't NP-complete). Factorization's presumed hardness underpins RSA. The takeaway: "not in P" and "NP-complete" are not the same claim; there is a middle tier.

## Algorithm Design & Interview Playbook

### Summary

**What this topic covers**
The meta-skill: given an unfamiliar problem, how to pick a technique, budget your complexity, reason out loud, and sanity-check before committing. It is the connective tissue over the whole primer — a decision procedure that walks from brute force through greedy, divide and conquer, dynamic programming, and graph modelling, using the input constraints as the main signal for what running time you're allowed to spend.

**Key terms**
*Paradigm*: a family of approaches — brute force, greedy, divide and conquer, dynamic programming, graph algorithms, backtracking. *Complexity budget*: the running time the input size implies you can afford. *State*: the variables that fully describe a subproblem in DP. *Optimal substructure*: an optimal solution is built from optimal solutions to subproblems. *Overlapping subproblems*: the same subproblem recurs, so memoize. *Greedy-choice property*: a locally optimal choice is globally safe. *Invariant*: something true at every step that argues correctness.

**Core mechanics**
Start with the brute-force solution to establish correctness and a baseline complexity — it also frames the problem's structure. Then read `n` to infer the budget: `n <= 20` invites `O(2^n)` or `O(n!)` backtracking; `n <= 500` allows `O(n^3)`; `n <= 5000`, `O(n^2)`; `n <= 1e5-1e6`, `O(n log n)` or `O(n)`; `n <= 1e18`, `O(log n)` or `O(1)` (math/binary-search-on-answer). Then match structure to paradigm: independent locally-optimal choices -> greedy; problem splits into equal independent halves -> divide and conquer; overlapping subproblems with optimal substructure -> DP; entities-and-relations or reachability/shortest-path -> model as a graph and run BFS/DFS/Dijkstra/union-find. Always verify the paradigm's precondition — greedy needs an exchange-argument proof, DP needs a state with no forward dependencies. Then state complexity, walk a tiny example, and check edge cases.

**Trade-offs**
Greedy is fastest to code and fastest to run but is *wrong* unless you can prove the greedy-choice property — the seductive trap. DP is general and provably optimal but costs memory and demands you nail the state and transition. Divide and conquer parallelizes and often hits `O(n log n)` but needs the subproblems to be independent. Brute force is always correct and is the right *first* answer to state, but rarely the final one. Picking the heaviest technique when a lighter one suffices wastes interview time; picking greedy when the problem needs DP produces a confidently wrong answer.

**Common confusions**
Reaching for DP when a greedy proof exists, or asserting greedy without a proof and getting a subtle counterexample; conflating "recursion" with "DP" (DP = recursion + memoization over overlapping subproblems); mis-sizing the budget by ignoring the constant or the hidden `log`; forgetting that `O(n*T)` DP is pseudo-polynomial; and optimizing before you have a correct baseline. Another trap: not restating the problem, so you solve the wrong one.

**Why interviewers ask**
The whole interview *is* this topic. They want to watch you narrow the space out loud: restate, give brute force, read the constraints, name candidate paradigms and why, prove the one you pick, then code and test. The classic follow-up is "make it faster" — which is really "show me you can move down the paradigm ladder and re-argue correctness." Structured reasoning beats a memorized answer; they are hiring the process.

### How do you choose an algorithmic paradigm for an unfamiliar problem?
Work a ladder. First state brute force to lock in correctness and a baseline. Then ask, in order: can a locally optimal choice be proven globally optimal (greedy)? Does it split into independent equal halves (divide and conquer)? Are there overlapping subproblems with optimal substructure (DP)? Is it really entities and relations, reachability, or shortest path (graph)? Does it need to try all configurations with pruning (backtracking)? Match the structure, then *verify the precondition* before committing — most wrong answers come from skipping that check.

### How do you infer the complexity budget from the input size?
Read the constraints as a target running time, assuming roughly `1e8-1e9` operations per second. `n <= 20`: exponential/factorial (`2^n`, `n!`) is fine — backtracking, bitmask DP. `n <= 100-500`: `O(n^3)` (Floyd-Warshall, interval DP). `n <= 5000`: `O(n^2)`. `n <= 1e5` to `1e6`: `O(n log n)` or `O(n)` — sort, sweep, hashing, linear DP. `n >= 1e9` or up to `1e18`: `O(log n)` or `O(1)` — binary search on the answer, closed-form math, matrix exponentiation. The size is the single strongest hint about which technique is even allowed.

### How do you recognise that a problem wants dynamic programming?
Two properties must hold: **optimal substructure** (an optimal answer is composed of optimal answers to subproblems) and **overlapping subproblems** (the naive recursion recomputes the same subproblems). Tells: "count the number of ways," "min/max cost to reach," choices at each step that affect the future, and a naive exponential recursion whose call tree repeats states. If subproblems *don't* overlap it's plain divide and conquer, not DP. If a greedy choice is provably safe, prefer greedy — it's cheaper.

### How do you know a greedy algorithm is actually correct?
You need the **greedy-choice property** (a locally optimal choice leads to a globally optimal solution) plus optimal substructure. Prove it with an **exchange argument**: assume an optimal solution differs from the greedy one at the first choice, then show you can swap in the greedy choice without making the solution worse — so a greedy solution is at least as good. Interval scheduling (pick the earliest finishing interval) and Huffman coding pass this; coin change with arbitrary denominations does not, which is why it needs DP. Never assert greedy without the exchange argument.

### When is divide and conquer the right tool?
When the problem splits into subproblems that are (a) the same shape, (b) roughly equal in size, and (c) independent, and whose solutions **combine** cheaply. Merge sort, quicksort, closest pair, and Karatsuba multiplication fit. The recurrence is usually `T(n) = a*T(n/b) + O(n^d)`, and the Master Theorem tells you the result — `T(n) = 2T(n/2) + O(n)` gives `O(n log n)`. If the subproblems overlap instead of being independent, it's DP; if the combine step is trivial, it may just be a linear scan.

### How do you decide to model a problem as a graph?
Look for entities with pairwise relationships and questions about connectivity, reachability, ordering, or shortest/cheapest paths. Cues: "is everything connected," "fewest steps," "any cyclic dependency," "cheapest route," "can we order these under constraints." Map entities to nodes and relations to edges (weighted/directed as needed), then reach for the standard tool: BFS for unweighted shortest path, Dijkstra for non-negative weights, topological sort for ordering/DAG dependencies, union-find for connectivity, DFS for cycle detection. Half the battle is spotting that a non-graph-looking problem (word ladder, state puzzle) *is* a graph.

### What is "binary search on the answer" and when does it apply?
When you can't directly compute the optimal value but you *can* cheaply check "is a value `x` feasible?" and feasibility is **monotonic** (if `x` works, everything larger — or smaller — works), binary search the answer space. Classic uses: minimize the maximum (ship packages in D days, split array to minimize largest sum), maximize the minimum. The complexity is `O(log(range) * cost_of_check)`. The tell is a min-max or max-min phrasing over a large numeric range where a direct formula is elusive but a feasibility predicate is easy.

### How should you reason out loud during a coding interview?
Narrate the funnel: restate the problem and confirm assumptions; give a brute-force solution with its complexity; read the constraints aloud and state the target complexity; propose candidate paradigms and say why each does or doesn't fit; pick one and *justify* it (exchange argument, DP state, recurrence); walk a tiny concrete example; then code, then test on edge cases. The interviewer is grading this narration as much as the code — a clear, self-correcting thought process signals you'll be maintainable to work with.

### What is the fastest way to find the DP state and transition?
Ask "what's the smallest set of variables that fully describes a subproblem?" — those are your state dimensions (index, remaining capacity, last choice, position in a grid). Write the transition as a recurrence over smaller states, define the base cases, and confirm there are **no forward dependencies** so an evaluation order exists (bottom-up) or memoize top-down. Then compute complexity as `(number of states) * (work per transition)`. If the state has too many dimensions, look for one you can drop (rolling array) or a greedy/math shortcut.

### What are the most common traps when picking an approach?
Asserting greedy without proof and hitting a counterexample; using DP where a greedy proof exists (over-engineering); confusing recursion with DP and blowing up on recomputation; mis-reading the budget by ignoring constants or a hidden `log`; treating pseudo-polynomial `O(n*T)` as polynomial; optimizing before you have a correct baseline; and solving a subtly wrong problem because you skipped restating it. Each is avoidable by the same discipline: baseline first, verify preconditions, size the budget honestly.

### How do you sanity-check an approach before writing code?
Run four quick checks. **Complexity**: multiply out states/operations and confirm it fits the budget. **Small example**: trace your logic on a size-2 or size-3 case by hand and confirm the expected output. **Edge cases**: empty input, single element, all-equal, negatives, duplicates, max size. **Precondition**: for greedy, does the exchange argument hold; for DP, is the state complete and acyclic. If any check fails, you catch it before burning ten minutes coding the wrong thing — far cheaper than debugging it live.

### When should you stop optimizing and just submit brute force?
When the constraints permit it. If `n <= 100` and brute force is `O(n^3)`, that's about `1e6` operations — instantly fast enough, and correct beats clever. Reading the budget tells you the *required* complexity; there is no prize for beating it. State this explicitly: "n is at most 500, so `O(n^2)` is ample — I'll do the straightforward DP rather than the `O(n log n)` trick." Matching effort to the budget is itself a senior signal; premature optimization wastes time and adds bugs.

### How do you handle "can you make it faster" follow-ups?
Treat it as a prompt to move down the paradigm ladder and re-argue correctness. Identify the current bottleneck (the dominant term), then ask what structure you haven't exploited: is a sort or hash removing an inner loop; is there a greedy choice replacing the DP; can precomputation (prefix sums, sparse tables) make each query cheaper; does the answer have a monotonic feasibility check enabling binary search. State the new complexity and re-verify correctness for the new method. The follow-up is testing flexibility, not a single memorized optimum.

### How do you sanity-check a recurrence or complexity claim?
Cross-check it three ways. Plug small `n` into the recurrence and expand a few levels to see the pattern. Apply the Master Theorem for `T(n) = a*T(n/b) + O(n^d)`: compare `d` against `log_b(a)`. And reason about total work per level times number of levels — merge sort does `O(n)` per level over `log n` levels = `O(n log n)`. If two of these disagree, you've made an arithmetic slip. Also confirm the *space* recurrence separately; recursion depth and memo tables are easy to under-count.

### What separates a senior from a junior in algorithm design?
A junior jumps to code with the first idea that seems to work; a senior narrows deliberately. Seniors restate the problem, give a baseline, read constraints to bound the search for a technique, name trade-offs explicitly, *prove* the chosen approach's precondition (exchange argument or DP state), and self-check with a small example and edge cases before coding. They also know when to stop — matching effort to the budget rather than gold-plating. The differentiator is disciplined, verbal, self-correcting reasoning under uncertainty, not raw pattern recall.
