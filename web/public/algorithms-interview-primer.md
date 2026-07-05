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
This topic is about how you *measure* an algorithm before you run it: asymptotic notation (Big-O, Theta, Omega), the distinction between best/average/worst case, amortized analysis, how to solve the recurrence relations that recursive algorithms produce (including the Master Theorem), and space complexity. The mental model: analysis is about *growth rate as input grows without bound*, not stopwatch time. Constants and lower-order terms are noise; what survives is how the cost scales. A senior candidate also reads the problem's input constraints backwards to *infer the target complexity* the interviewer expects.

**Key terms**
*Big-O* — asymptotic upper bound, "grows no faster than". *Omega* — asymptotic lower bound, "grows no slower than". *Theta* — tight bound, O and Omega together. *Best/average/worst case* — the input that minimizes/expects/maximizes cost for a *fixed* input size n; orthogonal to the O/Theta axis. *Amortized cost* — average cost per operation across a worst-case sequence, not an average over random inputs. *Recurrence* — an equation defining T(n) in terms of T on smaller inputs, e.g. T(n) = 2T(n/2) + O(n). *Master Theorem* — a closed-form solver for divide-and-conquer recurrences of the form T(n) = a T(n/b) + f(n). *Auxiliary space* — extra memory beyond the input.

**Core mechanics**
Big-O formally means: T(n) is O(g(n)) if there exist constants c > 0 and n0 such that T(n) <= c*g(n) for all n >= n0. That "for all n >= n0" is why constants and lower terms drop: 3n^2 + 100n + 7 is O(n^2) because for large n the n^2 term dominates. To analyze code, count operations as a function of n: sequential blocks add (take the max), nested loops multiply, and recursion becomes a recurrence you solve. The Master Theorem compares f(n) against n^(log_b a): if f is polynomially smaller, T(n) = Theta(n^(log_b a)); if equal (within a log factor), you gain a log; if f is polynomially larger (and regular), T(n) = Theta(f(n)). Amortized analysis (aggregate, accounting, or potential method) proves that expensive operations are rare enough that the *sequence* is cheap — dynamic array doubling is the canonical case: any single push may cost O(n) to resize, but n pushes cost O(n) total, so O(1) amortized.

**Trade-offs**
Asymptotic analysis deliberately throws away constants, so it can mislead at real-world sizes: an O(n log n) algorithm with a huge constant can lose to an O(n^2) one for small n (this is why library sorts switch to insertion sort under ~16 elements). Theta is more informative than O but you often can only prove O. Worst-case bounds are honest but pessimistic; average-case is realistic but assumes an input distribution you must state. Amortized O(1) is a *sequence* guarantee — it does not bound a single operation's latency, which matters for real-time systems.

**Common confusions**
Big-O is an *upper bound*, not "the worst case" — you can say bubble sort is O(n^2) worst case and O(n) best case; O and case-analysis are independent axes. Saying "worst case Big-O" is fine, but "average-case Omega" is equally valid. Amortized is not average-case: amortized holds even for adversarial input, average assumes randomness. People also over-tighten: writing O(2n) or O(n^2 + n) is not wrong but not simplified. And log base is irrelevant in O (change of base is a constant factor) — but the base *matters* inside the Master Theorem's n^(log_b a).

**Why interviewers ask**
Complexity analysis is the fastest signal of whether you can reason about scale rather than just pass tests. The classic angle: "what's the complexity?" then "can you do better?" — where "better" is a target you should *infer from constraints* (n <= 20 hints exponential/bitmask; n <= 10^5 hints O(n log n); n <= 10^9 hints O(log n) or O(1) math). A senior follow-up probes space-time trade-offs and whether your average-case claim states its distribution.

### What is the difference between Big-O, Big-Theta, and Big-Omega?

They bound growth from different directions. Big-O is an upper bound: T(n) is O(g) if T grows no faster than g (T(n) <= c*g(n) for large n). Big-Omega is a lower bound: T grows no slower than g. Big-Theta is a tight bound — both O and Omega hold, so T grows *exactly* like g up to constants. In interviews people say "O(n log n)" loosely to mean the tight bound, but strictly, saying an algorithm is O(n^2) only claims it is no worse than that; it could secretly be faster. Use Theta when you can prove the bound is tight, O when you can only prove the ceiling.

### Why do we drop constants and lower-order terms?

Because Big-O measures asymptotic growth as n approaches infinity, and there for any fixed constants the highest-order term dominates. 5n^2 + 1000n + 50 and n^2 both grow quadratically — double n and both roughly quadruple. The definition bakes this in: T(n) is O(g(n)) if T(n) <= c*g(n) for all n beyond some n0, and you are free to pick c large enough to absorb constants and n0 large enough to absorb lower terms. The caveat: constants are *not* irrelevant in practice; they just are not what asymptotic notation is designed to capture.

### What is the difference between best, average, and worst case?

They fix the input *size* n and vary *which* input of that size you feed in. Worst case is the input maximizing cost (quicksort on already-sorted data with a naive pivot: O(n^2)). Best case minimizes it (quicksort with perfectly balanced pivots: O(n log n)). Average case is the expected cost over a distribution of inputs (quicksort with random pivots: O(n log n) expected). This axis is independent of O/Theta: each case can itself be given an O, Omega, or Theta bound. Interviewers usually want worst case unless you flag an average-case assumption explicitly.

### How does average-case analysis differ from amortized analysis?

Average-case averages over a *distribution of inputs* and assumes some input is random — if the assumption is violated, the bound can fail. Amortized averages over a *sequence of operations on a single data structure* and holds for *any* sequence, including adversarial ones. Example: a hash table is O(1) *average* case (assuming good hashing and no adversary crafting collisions), whereas dynamic-array append is O(1) *amortized* — even an adversary choosing the worst push sequence cannot make n pushes cost more than O(n). One relies on randomness; the other is a worst-case guarantee spread across operations.

### Explain amortized analysis with the dynamic array example.

A dynamic array (Java ArrayList, C++ vector, Python list) stores elements in a fixed block and doubles capacity when full. A single append is usually O(1), but when the block fills, it allocates a block twice as large and copies everything — O(n) for that one push. Amortized analysis shows this is rare: starting empty, resizes happen at sizes 1, 2, 4, 8, ..., n, and the total copy work is 1 + 2 + 4 + ... + n < 2n = O(n). Spread across n pushes, that is O(1) amortized per push. The doubling is essential — growing by a *constant* amount instead would make total copy work O(n^2), i.e. O(n) amortized per push.

### What are the three methods of amortized analysis?

*Aggregate*: bound the total cost of a sequence of n operations, then divide by n. Simple but coarse. *Accounting (banker's)*: overcharge cheap operations and store the surplus as "credit" on the data structure, then spend that credit to pay for expensive operations; if credit never goes negative, the charged rate is a valid amortized bound. *Potential method*: define a potential function Phi mapping the structure's state to a non-negative number; the amortized cost of an operation is its actual cost plus the change in Phi. It is the most powerful and generalizes the accounting method. All three prove the same kind of result; potential is the go-to for formal proofs.

### What is a recurrence relation and how do you form one?

A recurrence expresses an algorithm's running time T(n) in terms of its cost on smaller inputs. You form it by reading the recursive structure: how many subproblems (a), how much smaller each is (n/b or n-1), and the non-recursive work per call (f(n)). Merge sort makes 2 recursive calls on halves plus O(n) to merge, giving T(n) = 2T(n/2) + O(n). Binary search makes 1 call on a half plus O(1), giving T(n) = T(n/2) + O(1). A naive recursive Fibonacci gives T(n) = T(n-1) + T(n-2) + O(1). Solving the recurrence yields the closed-form complexity.

### State the Master Theorem and explain its three cases.

For T(n) = a T(n/b) + f(n) with a >= 1, b > 1, compare f(n) to the "watershed" n^(log_b a). Case 1: if f(n) = O(n^(log_b a - e)) for some e > 0 (f is polynomially smaller), the leaves dominate and T(n) = Theta(n^(log_b a)). Case 2: if f(n) = Theta(n^(log_b a)) (they match), work is even across levels and you gain a log: T(n) = Theta(n^(log_b a) * log n). Case 3: if f(n) = Omega(n^(log_b a + e)) and the regularity condition a*f(n/b) <= c*f(n) holds, the root dominates and T(n) = Theta(f(n)). The intuition is a tug-of-war between the number of leaves and the work at the top.

### Apply the Master Theorem to merge sort.

Merge sort: T(n) = 2T(n/2) + O(n), so a = 2, b = 2, f(n) = n. The watershed is n^(log_b a) = n^(log_2 2) = n^1 = n. Since f(n) = Theta(n) matches the watershed, this is Case 2: T(n) = Theta(n * log n) = Theta(n log n). Intuitively the recursion tree has log_2 n levels, each doing O(n) total merge work, so n * log n. Binary search T(n) = T(n/2) + O(1) has a=1, b=2, watershed n^0 = 1, f = O(1) matching, so Case 2 gives Theta(log n).

### When does the Master Theorem NOT apply?

It only covers T(n) = a T(n/b) + f(n) with constant a, constant b > 1, and f asymptotically positive. It fails when: subproblems differ in size (T(n) = T(n/3) + T(2n/3) + n — use the recursion-tree or Akra-Bazzi method); a or b is not constant; f falls in the *gap* between cases (polynomially between, e.g. f(n) = n/log n vs watershed n — no polynomial separation, Case 1/3 fail, Case 2 does not match either); the regularity condition of Case 3 fails; or the recursion subtracts rather than divides (T(n) = T(n-1) + n — that is a different family, solved by summation to Theta(n^2)).

### How do you solve a recurrence with the recursion-tree method?

Draw the tree: the root does f(n) work and has a children each doing f(n/b), and so on down to the base case. Sum the work *per level*, then sum across levels. For T(n) = 2T(n/2) + n: level 0 does n, level 1 does 2*(n/2) = n, level k does n — every level does n, and there are log_2 n levels, so total is n log n. For T(n) = 2T(n/2) + n^2: level k does n^2 / 2^k, a geometric series dominated by the root, giving Theta(n^2). The tree method is your fallback when the Master Theorem does not apply, and it builds the intuition the theorem formalizes.

### What is space complexity and what counts toward it?

Space complexity is how memory grows with input size. You usually report *auxiliary* space — extra memory beyond the input itself — because the input is a fixed cost the caller already paid. Count: allocated data structures (a hash set of size n is O(n)), and the recursion call stack (each frame holds locals and a return address). Recursive algorithms are the classic trap: recursion depth d means O(d) stack space even if no explicit structure is allocated. Merge sort is O(n) auxiliary (the merge buffer); in-place quicksort is O(log n) auxiliary from its recursion stack in the average case, O(n) worst case.

### Does recursion depth count as space? Give an example.

Yes — every unresolved recursive call keeps a stack frame alive, so the maximum recursion depth is auxiliary space. Naive recursive factorial or a linear-chain recursion of depth n uses O(n) stack even though it allocates no data structure, and can blow the stack for large n. Quicksort's space is dominated by recursion depth: balanced partitions give O(log n) depth, but worst-case partitions (sorted input, bad pivot) give O(n) depth. This is why "recurse on the smaller partition, loop on the larger" (tail-call elimination by hand) bounds quicksort's stack to O(log n) even in the worst case.

### How do you infer the target complexity from input constraints?

Read the maximum n and work backwards from roughly 10^8 operations per second. n <= 12 or so: factorial O(n!) or O(n^2 * 2^n) permutation/DP is fine. n <= 20-24: O(2^n) bitmask subset DP. n <= 500: O(n^3) (Floyd-Warshall, interval DP). n <= 5000: O(n^2). n <= 10^5 or 10^6: O(n log n) — sort or a heap-based sweep. n <= 10^7-10^8: O(n) linear scan only. n up to 10^9 or 10^18: O(log n) or O(1) — binary search on the answer, or closed-form math. This reverse-inference tells you which algorithm family the interviewer is fishing for before you have written a line.

### If n can be up to 10^9, what complexity must you target and why?

Roughly O(log n) or O(1). At 10^9, even a single linear pass is about a billion operations — borderline for a 1-2 second limit, and anything super-linear is hopeless. That constraint is a strong hint the intended solution is binary search (on a sorted array or "binary search on the answer"), a closed-form mathematical formula (arithmetic/geometric sums, combinatorics), matrix exponentiation for linear recurrences (O(log n) via fast exponentiation), or a number-theoretic trick like gcd. If the value 10^9 is a *value range* rather than a count, it also often signals you should not iterate over the range at all.

### Is O(1) always faster than O(n) in practice?

No — asymptotically yes, but for small n the constants dominate. An O(1) hash lookup involves hashing, a modulo, and possible collision probing; a linear scan of a 4-element array may be faster because it is cache-friendly and branch-predictable. This is exactly why real libraries use hybrid strategies: introsort/Timsort fall back to insertion sort for small subarrays because insertion sort's tiny constant beats merge/quicksort's overhead under ~16 elements. Big-O tells you who wins *eventually*; profiling tells you who wins at *your* n. A senior answer names the crossover and says "measure it".

## Recursion & Divide and Conquer

### Summary

**What this topic covers**
Recursion — a function calling itself on a smaller input — and the divide-and-conquer paradigm built on top of it: split a problem into independent subproblems, solve each recursively, and *combine* their results. The mental model is a call stack of paused frames, each waiting for its child to return. Canonical examples are merge sort, binary search, and Karatsuba multiplication. This topic also covers converting recursion to iteration and the special case of tail recursion.

**Key terms**
*Base case* — the input small enough to answer directly without recursing; without it, infinite recursion and stack overflow. *Recursive case* — reduces the problem toward the base case. *Call stack* — the LIFO stack of activation records (frames), each holding locals, arguments, and the return address. *Divide and conquer (D&C)* — divide into subproblems, conquer (solve recursively), combine. *Combine step* — merging subproblem answers into the whole answer; often where the real work lives. *Tail recursion* — a recursive call that is the last action, with nothing left to do after it returns. *Recursion tree* — the tree of all recursive calls, whose shape gives the complexity.

**Core mechanics**
Each call pushes a frame onto the call stack; the frame stays until its recursive children return, then the function finishes with their results and pops. Correctness of recursion is proved by induction: assume the recursive call is correct on smaller input (the inductive hypothesis), show the base case is correct, and show the combine step is correct — then the whole is correct. D&C's complexity comes from its recurrence T(n) = a T(n/b) + (combine cost), solved by the Master Theorem. Merge sort: split in half (a=2, b=2), combine by merging in O(n), giving O(n log n). Binary search: one half (a=1, b=2), O(1) combine, giving O(log n). Karatsuba multiplies two n-digit numbers with 3 (not 4) recursive multiplications of n/2-digit halves plus O(n) additions: T(n) = 3T(n/2) + O(n) = O(n^1.585), beating schoolbook O(n^2).

**Trade-offs**
Recursion is expressive — tree/graph and D&C algorithms read almost like their mathematical definition — but each call costs a stack frame and a jump, so deep recursion risks stack overflow and carries call overhead an equivalent loop avoids. Iteration is faster and space-flat but can be clumsy for inherently branching problems. D&C shines when subproblems are *independent* (parallelizable, no shared work); when they *overlap*, plain D&C recomputes and you want dynamic programming (memoization) instead. The combine step is the crux: if combining costs more than the divide saves, D&C is not worth it.

**Common confusions**
Forgetting or mis-stating the base case is the number-one bug — it must be reachable and terminate. People conflate D&C with dynamic programming: both recurse, but D&C subproblems are *disjoint* (merge sort's halves never overlap) while DP subproblems *overlap* and are cached. Another confusion: thinking all recursion is O(depth) space — it is O(max depth), and tail-recursive functions in optimizing languages can be O(1). And "tail recursion" is not just "recursion that returns a value"; it is recursion where the call is the *very last* operation, so nothing is pending on the stack afterward.

**Why interviewers ask**
Recursion tests whether you can define a problem in terms of itself, identify the base case, and trust the recursion (the "recursive leap of faith"). D&C tests whether you see how to break a problem, and whether you can analyze the resulting recurrence. Classic follow-ups: "what's the space complexity?" (probing whether you count the stack), "convert this to iterative" (probing stack simulation and tail-call understanding), and "why is this O(n log n)?" (probing recurrence analysis). It is also a proxy for comfort with trees, backtracking, and graph traversal, which are all recursive.

### What are the two essential parts of any recursive function?

A base case and a recursive case. The *base case* is the smallest input you can answer directly without further recursion — it stops the recursion and prevents infinite descent. The *recursive case* breaks the problem into a smaller instance (or instances) of itself and calls the function on it, moving toward the base case. Every recursive path must eventually hit a base case, and each recursive call must make *progress* (strictly smaller input) toward it. Miss the base case, or fail to shrink the input, and you get infinite recursion and a stack-overflow crash.

### What is the call stack and how does recursion use it?

The call stack is a LIFO stack of activation records ("stack frames"), one per in-progress function call, each storing that call's parameters, local variables, and the return address to resume at when it finishes. When a function recurses, a new frame is pushed for the child call while the parent's frame stays paused beneath it; control only returns to the parent after the child pops. So a recursion of depth d has d frames stacked simultaneously — that is why recursion depth is the algorithm's space cost, and why too-deep recursion overflows the fixed-size stack (a StackOverflowError / segfault).

### What causes a stack overflow in recursion and how do you prevent it?

Recursion that goes too deep — more nested calls than the fixed call-stack size allows — overflows. Two root causes: (1) a missing or unreachable base case, or an input that never shrinks, giving *infinite* recursion; (2) legitimately deep recursion on large input (e.g. recursing per element on a list of 10^6). Prevent it by ensuring the base case is reachable and every call strictly reduces the problem, and for deep-but-finite cases, convert to iteration with an explicit stack, use tail recursion in a language that eliminates it, or increase the stack limit as a last resort. Interviewers love case (2) as a "your recursion is correct but won't scale" trap.

### How do you prove a recursive algorithm is correct?

By induction on input size. First, the *base case*: show the algorithm returns the right answer for the smallest input. Then the *inductive step*: assume (the inductive hypothesis) that the recursive calls return correct answers for all smaller inputs, and show that given those correct sub-answers, your combine step produces the correct answer for input n. If both hold, correctness follows for all n. This mirrors the "recursive leap of faith" — you trust the recursive call works on smaller input rather than tracing it, and just verify the base case and the combine logic.

### What is the divide-and-conquer paradigm?

A three-step strategy: *divide* the problem into smaller, independent subproblems of the same type; *conquer* by solving each subproblem recursively (base case for the smallest); *combine* the subproblem solutions into the answer for the original. Merge sort divides the array in half, recursively sorts each half, and combines by merging two sorted halves. Binary search divides by discarding half the search space each step. Its power is turning an O(n^2) or O(n) problem into O(n log n) or O(log n) when the divide-and-combine overhead is low. The key requirement is that subproblems be *independent* — no shared sub-work.

### What is the "combine" step and why does it matter most?

Combine is where you stitch subproblem answers into the full answer, and it usually determines the overall complexity via the recurrence T(n) = a T(n/b) + (combine cost). In merge sort the divide is trivial (compute a midpoint) but the *merge* is the O(n) combine that, summed over log n levels, produces O(n log n). In binary search combine is O(1) (just return the winning half). If the combine step is expensive it can dominate: an O(n^2) combine would swamp the recursion. Analyzing D&C is largely analyzing the combine cost — that is what the Master Theorem's f(n) measures.

### Walk through merge sort as divide and conquer, with its complexity.

Divide: split the array into two halves at the midpoint (O(1)). Conquer: recursively merge-sort each half; base case is a subarray of length 0 or 1, already sorted. Combine: merge the two sorted halves into one sorted array by repeatedly taking the smaller front element — O(n) per merge. The recurrence is T(n) = 2T(n/2) + O(n). The recursion tree has log_2 n levels, each doing O(n) total merge work, so T(n) = O(n log n) in *all* cases (best, average, worst — merge sort is not input-sensitive). Space is O(n) auxiliary for the merge buffer.

### Walk through binary search as divide and conquer, with its complexity.

On a *sorted* array, compare the target to the middle element. If equal, done. If the target is smaller, recurse on the left half; if larger, recurse on the right half — each step discards half the remaining elements. Base case: the search range is empty (not found). The recurrence is T(n) = T(n/2) + O(1), which by the Master Theorem (or the recursion tree of depth log_2 n, O(1) per level) gives O(log n) time. It is D&C with only *one* subproblem and a trivial O(1) combine. The classic bug is the off-by-one in the boundary update (lo = mid + 1 vs lo = mid) causing an infinite loop.

### What is Karatsuba multiplication and why is it faster than schoolbook?

Karatsuba multiplies two n-digit numbers faster than the O(n^2) schoolbook method. Split each number into high and low halves: x = x1*B + x0, y = y1*B + y0. Schoolbook needs four half-size products (x1y1, x1y0, x0y1, x0y0). Karatsuba's trick computes the middle term x1y0 + x0y1 as (x1+x0)(y1+y0) - x1y1 - x0y0, reusing two products it already has — so only *three* half-size multiplications plus O(n) additions. The recurrence drops from T(n) = 4T(n/2) + O(n) = O(n^2) to T(n) = 3T(n/2) + O(n) = O(n^(log_2 3)) = O(n^1.585). It is the textbook proof that reducing the *branching factor* a beats shaving the combine cost.

### How is divide and conquer different from dynamic programming?

Both solve a problem via subproblems, but D&C subproblems are *independent/disjoint* while DP subproblems *overlap*. Merge sort's two halves share no elements, so solving them separately wastes nothing — pure D&C. Naive recursive Fibonacci re-solves fib(n-2) many times because the call tree overlaps; that overlap is exponential waste, and DP fixes it by *memoizing* (caching) each subproblem's answer so it is computed once. Rule of thumb: if the recursion tree recomputes the same subproblem, you want DP (top-down memoization or bottom-up tabulation); if every subproblem is fresh, plain D&C is optimal.

### How do you convert a recursive algorithm to an iterative one?

Two paths. If the recursion is *tail recursive* (the recursive call is the last action), rewrite it as a simple loop that updates the accumulator/parameters in place — no stack needed. If it is *non-tail* (work happens after the recursive call, like tree post-order traversal), simulate the call stack explicitly with an in-code stack data structure: push the work you would have recursed into, pop and process in a loop until empty. The explicit stack replaces the call stack, giving you the same O(depth) space but avoiding call overhead and the stack-overflow limit. Some patterns (like computing a running sum) collapse to a single loop with no stack at all.

### What is tail recursion and why does it matter?

Tail recursion is when the recursive call is the *last* operation in the function — its return value is returned directly, with nothing left to compute afterward. That matters because there is no pending work in the caller's frame, so an optimizing compiler can *reuse* the current frame instead of pushing a new one (tail-call optimization / elimination), turning the recursion into a loop and reducing space from O(depth) to O(1) with no stack-overflow risk. `return factorial(n-1) * n` is *not* tail recursive (the multiply happens after the call returns); `return factHelper(n-1, acc*n)` is. Scheme/Scala/Kotlin guarantee TCO; Java, Python, and JS generally do not.

### Rewrite a non-tail recursion into tail-recursive form. What is the trick?

Introduce an *accumulator* parameter that carries the partial result so the recursive call becomes the final action. Naive factorial `factorial(n) = n * factorial(n-1)` is non-tail because the multiplication waits for the call to return. Add an accumulator:

```python
def fact(n, acc=1):
    if n <= 1:
        return acc          # base case returns the accumulated result
    return fact(n - 1, acc * n)   # tail call: nothing pending after it
```

Now the multiply happens *before* the recursive call, the call is the last action, and a TCO-capable runtime runs it in O(1) space. The general trick: move the post-call work into the argument passed down.

### Why doesn't Python optimize tail recursion, and what do you do about it?

Python's designers deliberately omit tail-call optimization: Guido has argued it hurts debuggability (it erases stack frames from tracebacks) and that clear loops are preferred over clever recursion in Python's philosophy. So a tail-recursive Python function still pushes a frame per call and hits the default recursion limit (about 1000) on deep input. The fix: write it as an explicit `while` loop (trivial for tail recursion since there is no pending work), or use an explicit stack for non-tail recursion, or — rarely and reluctantly — raise `sys.setrecursionlimit`, which risks a real interpreter crash. In an interview, converting to a loop is the expected answer.

### When is recursion the wrong choice?

When the recursion is deep and linear (e.g. processing a long list element-by-element) it wastes a stack frame per element and risks overflow — a loop is strictly better. When subproblems overlap heavily, plain recursion is exponential and you need DP. When the language lacks TCO and depth can be large, tail recursion still overflows. And when the iterative version is just as clear (summing an array, linear search), recursion adds call overhead for no readability gain. Recursion earns its keep on genuinely branching/tree-shaped problems (traversals, backtracking, D&C) where the recursive definition is far clearer than manual stack management.

### What is mutual recursion and where does it appear?

Mutual recursion is when two or more functions call each other in a cycle rather than a single function calling itself — e.g. `isEven(n)` calls `isOdd(n-1)` and `isOdd(n)` calls `isEven(n-1)`. It appears naturally in recursive-descent parsers (a `parseExpression` calls `parseTerm` which calls `parseFactor` which can call back to `parseExpression` for parenthesized subexpressions) and in state machines. Its correctness and termination arguments are the same as single recursion — every cycle must strictly reduce toward a base case — but the recursion tree spans multiple functions. Interviewers rarely require it but may mention it to test whether you recognize the pattern in grammar/parsing questions.

## Comparison Sorting

### Summary

**What this topic covers**
The comparison-based sorts — bubble, insertion, selection, merge, quick, and heap sort — that order elements using only pairwise comparisons. The mental model is a spectrum: simple O(n^2) sorts that are easy and good for tiny/nearly-sorted inputs, versus the O(n log n) sorts (merge, quick, heap) that scale. This topic covers their time complexity, stability, in-place-ness, the O(n log n) comparison lower bound, quicksort's pivot problem, and the engineering reasons libraries pick one over another.

**Key terms**
*Comparison sort* — sorts using only "is a < b?" comparisons; bounded below by O(n log n). *Stable* — equal elements keep their original relative order (matters when sorting by a secondary key). *In-place* — uses O(1) or O(log n) auxiliary space, sorting within the input array. *Adaptive* — runs faster on partially-sorted input (insertion sort is O(n) on sorted data). *Pivot* — the element quicksort partitions around. *Partition* — rearranging so elements less than the pivot precede it and greater follow. *Heapify* — building a heap in O(n), the basis of heap sort.

**Core mechanics**
Bubble/insertion/selection are O(n^2): they do a nested pass, moving one element into place per outer iteration. Insertion sort is the best of the three — adaptive (O(n) on nearly-sorted data), stable, in-place, tiny constant — which is why it is the base case of industrial sorts. Merge sort recursively splits and merges: O(n log n) *guaranteed* in all cases, stable, but O(n) extra space. Quicksort partitions around a pivot and recurses on each side: O(n log n) *average*, O(n^2) worst (bad pivots), in-place, not stable — but the fastest in practice due to cache-friendliness and small constants. Heap sort builds a max-heap in O(n) then repeatedly extracts the max: O(n log n) worst-case *guaranteed*, in-place, but not stable and cache-unfriendly. The O(n log n) floor comes from the decision-tree argument: n! possible orderings need log_2(n!) = Theta(n log n) comparisons to distinguish.

**Trade-offs**
The core three-way tension is worst-case guarantee vs speed vs space. Quicksort wins raw speed and is in-place but risks O(n^2) and is unstable. Merge sort guarantees O(n log n) and is stable but costs O(n) space. Heap sort guarantees O(n log n) *and* is in-place but is unstable and ~2-3x slower than quicksort due to poor cache locality and branch prediction. Simple sorts lose asymptotically but win for n < ~16 (tiny constant) and for nearly-sorted data (insertion sort's adaptivity). Real libraries hybridize to get the best of all.

**Common confusions**
"Quicksort is O(n log n)" — only on *average*; its worst case is O(n^2), which is why the pivot choice matters. Confusing stable with in-place: they are independent properties (heap sort is in-place but unstable; a naive merge sort is stable but not in-place). Believing heap sort is faster than quicksort because both are O(n log n) worst/average — constants and cache behavior make quicksort win in practice. Thinking selection sort is adaptive — it always does O(n^2) comparisons regardless of input order. And assuming every sort can beat O(n log n) — comparison sorts cannot; only non-comparison sorts (counting/radix) can, under restrictions.

**Why interviewers ask**
Sorting is the canonical vehicle for testing complexity analysis, recursion, and engineering judgment in one problem. The signal is not "can you code bubble sort" but "do you know *why* merge sort is stable and quicksort is not, when O(n^2) worst case is acceptable, and why the standard library chose what it chose." Classic follow-ups: "why is quicksort preferred despite O(n^2)?", "make quicksort's worst case unlikely", "when would you pick merge sort over quicksort?", and "prove no comparison sort beats O(n log n)". It reveals whether you reason about constants, stability, and memory, not just Big-O.

### What does it mean for a sort to be "comparison based"?

A comparison sort determines order using only pairwise comparisons between elements — questions of the form "is a less than b?" — and nothing about the elements' internal structure or value range. Bubble, insertion, selection, merge, quick, and heap sort are all comparison sorts. This generality (they work on anything with a defined ordering) comes at a price: comparison sorts are provably bounded below by Omega(n log n). Non-comparison sorts like counting sort and radix sort exploit the actual key values (e.g. integers in a known range) to beat that bound, but they are not general-purpose.

### Why can't any comparison sort be faster than O(n log n)?

Because of a decision-tree lower-bound argument. Any comparison sort's execution is a binary decision tree where each internal node is a comparison with two outcomes, and each leaf is one of the n! possible orderings of the input. To sort correctly, the tree must have at least n! leaves (one per possible permutation). A binary tree with n! leaves has height at least log_2(n!), and by Stirling's approximation log_2(n!) = Theta(n log n). The height is the worst-case number of comparisons, so *every* comparison sort needs Omega(n log n) comparisons in the worst case. No cleverness with comparisons alone escapes this floor.

### Compare bubble, insertion, and selection sort.

All three are O(n^2) but differ meaningfully. *Bubble sort* repeatedly swaps adjacent out-of-order pairs, "bubbling" the largest to the end each pass — stable, in-place, and can detect a sorted array early (O(n) best case with a swap flag) but does the most swaps and is the slowest in practice. *Selection sort* finds the minimum of the unsorted region and swaps it into place — in-place, *not* adaptive (always O(n^2) comparisons), not stable in its usual form, but does only O(n) swaps (useful when writes are expensive). *Insertion sort* inserts each element into its sorted prefix — stable, in-place, and *adaptive*: O(n) on nearly-sorted data. Insertion sort is the practical winner of the three.

### Why is insertion sort used inside industrial sort implementations?

Because for small arrays it beats the O(n log n) sorts despite its O(n^2) bound. Its constant factor is tiny — a simple inner loop with great cache locality and branch prediction — and it is *adaptive*, running in O(n) when data is nearly sorted. So Timsort (Python, Java objects) and introsort (C++ std::sort) recurse with merge/quicksort only until subarrays drop below a threshold (~16-64 elements), then finish with insertion sort. This hybrid captures insertion sort's low overhead on the small subproblems where the asymptotically better sorts' overhead would dominate. It is also stable and in-place, so it does not compromise those properties.

### What does "stable" mean and when does it matter?

A sort is stable if elements comparing equal retain their original relative order. It matters whenever you sort by a *secondary* key or do multi-key sorting: sort records by name, then stably sort by department, and within each department names stay alphabetical — instability would scramble the first sort. It also matters when equal-key elements carry distinguishable payloads you do not want reordered. Merge sort and insertion sort are stable; heap sort and typical in-place quicksort are not. This is why Java uses Timsort (stable) for object arrays but a quicksort variant for primitives, where stability is meaningless since equal primitives are indistinguishable.

### What does "in-place" mean, and is it the same as stable?

In-place means the sort uses only O(1) (or sometimes O(log n) for recursion stack) auxiliary memory beyond the input — it rearranges within the original array rather than allocating a copy. It is *independent* of stability. Heap sort is in-place but not stable; standard merge sort is stable but not in-place (it needs an O(n) merge buffer); quicksort is in-place but not stable; insertion sort is both. Candidates often conflate the two because insertion/merge examples happen to line up, but they are orthogonal properties — one is about *memory*, the other about *equal-element ordering*.

### Walk through how merge sort works and its complexity.

Merge sort recursively splits the array into halves until subarrays have length 1 (trivially sorted), then merges pairs of sorted subarrays back up. The merge takes two sorted lists and interleaves them into one sorted list by repeatedly appending the smaller of the two front elements — O(n) per merge level. Recurrence T(n) = 2T(n/2) + O(n) gives O(n log n) in best, average, *and* worst case — it is not input-sensitive. It is stable (break merge ties toward the left half) but needs O(n) auxiliary space for the merge buffer. That guaranteed worst case and stability make it the choice for linked lists and external/large-data sorts.

### Walk through how quicksort works and its complexity.

Pick a pivot, *partition* the array so everything less than the pivot is left of it and everything greater is right (the pivot lands in its final sorted position), then recursively quicksort the left and right partitions. Base case: a partition of size 0 or 1. With balanced partitions the recurrence is T(n) = 2T(n/2) + O(n) = O(n log n), which is the average case. With consistently unbalanced partitions (one side empty) it degrades to T(n) = T(n-1) + O(n) = O(n^2). It is in-place (O(log n) stack) and typically *not* stable, but its small constant and excellent cache locality make it the fastest general sort in practice.

### Why is quicksort O(n^2) worst case but preferred in practice?

The worst case happens when the pivot is consistently the smallest or largest element, so each partition shrinks by just one and you get n levels of O(n) work — O(n^2). This occurs with a naive first/last-element pivot on already-sorted or reverse-sorted input. Yet quicksort dominates in practice because its *average* case is O(n log n) with a very small constant, it sorts *in place* (unlike merge sort's O(n) buffer), and its sequential partition scan is extremely cache-friendly and branch-predictor-friendly. Randomizing or median-of-three pivot selection makes the O(n^2) case astronomically unlikely, and introsort caps it hard by switching to heap sort — so you keep quicksort's speed with a worst-case guarantee.

### How does pivot choice affect quicksort, and how do you make the worst case unlikely?

The pivot decides partition balance, which decides whether you get O(n log n) or O(n^2). A fixed first/last-element pivot is O(n^2) on sorted input — the common real-world case, so it is dangerous. Better strategies: *random pivot* (expected O(n log n) regardless of input, defeats adversarial *ordering* though not an adversary who sees your RNG); *median-of-three* (median of first, middle, last — cheap and handles sorted input well); or *median-of-medians* (guarantees O(n log n) but with a constant so large it is rarely used). Production code combines median-of-three with an introsort fallback to heap sort once recursion depth exceeds ~2 log n, guaranteeing O(n log n) worst case.

### What is heap sort and what are its trade-offs?

Heap sort builds a max-heap from the array in O(n) (bottom-up heapify), then repeatedly swaps the root (the max) to the end of the array and sifts the new root down, shrinking the heap by one each time — extracting elements in sorted order. Each of the n extractions costs O(log n), so total is O(n log n) in *all* cases, and it is *in-place* (O(1) auxiliary). The trade-offs: it is *not stable*, and despite matching quicksort's asymptotic bound it runs ~2-3x slower in practice because heap operations jump around memory (poor cache locality) and its sift-down branches are hard to predict. See the Data Structures primer for heap internals.

### When would you choose merge sort over quicksort?

When you need a *guaranteed* O(n log n) worst case (quicksort risks O(n^2)), when you need *stability* (merge sort is stable, quicksort is not), when sorting a *linked list* (merge sort needs no random access and can merge in O(1) extra space on lists, while quicksort's partition wants random access), or when doing *external sorting* of data too big for RAM (merge sort streams sorted runs from disk and merges them, the classic external-sort algorithm). You accept its O(n) auxiliary memory in exchange. If memory is tight and average speed matters more than worst-case guarantees, you pick quicksort instead.

### Which sorts are stable and which are in-place? Summarize.

Stable: insertion, bubble, and merge sort (and Timsort). Not stable: selection (in its usual form), quicksort, and heap sort. In-place (O(1)-O(log n) auxiliary): insertion, bubble, selection, quicksort, and heap sort. Not in-place: standard merge sort (O(n) buffer). The two clean summary points: merge sort trades space for stability + guaranteed O(n log n); heap sort trades stability for in-place + guaranteed O(n log n); quicksort trades worst-case guarantee for in-place speed. Insertion sort is the only one that is stable, in-place, *and* adaptive — just not scalable.

### What sorting algorithm does your language's standard library use, and why?

Most use a *hybrid*. C++ `std::sort` uses introsort: quicksort for speed, switching to heap sort when recursion gets too deep (capping the worst case at O(n log n)) and to insertion sort for small subarrays. Python's `sorted`/`list.sort` and Java's `Arrays.sort` for objects use Timsort: a stable, adaptive merge sort that detects existing sorted "runs" and merges them, running near O(n) on real-world partially-ordered data and O(n log n) worst case. Java sorts *primitives* with a dual-pivot quicksort (stability is irrelevant for indistinguishable primitives, and it is faster/in-place). The theme: no single textbook sort is used raw — libraries combine them to get guarantees, stability where needed, and adaptivity.

### Can any sort beat O(n log n)? When?

Only *non-comparison* sorts, and only under restrictions on the keys. Counting sort sorts n integers in a known range [0, k) in O(n + k) by tallying occurrences — linear when k is O(n), but useless for large ranges or arbitrary comparables. Radix sort sorts fixed-width integers/strings in O(d * (n + b)) by sorting digit-by-digit (d digits, base b) using a stable counting sort per digit — effectively O(n) for bounded-width keys. Bucket sort is O(n) *expected* for uniformly distributed inputs. All of these exploit key *values*, sidestepping the comparison lower bound. General comparison sorts on arbitrary orderings cannot beat O(n log n) — the decision-tree proof forbids it.

### Why is selection sort rarely used despite being simple?

Because it is O(n^2) *unconditionally* — it always scans the entire unsorted region to find each minimum, so it does not improve on sorted or nearly-sorted input (unlike insertion sort's O(n) best case). It is also not stable in its standard swap form. Its one redeeming trait is that it performs only O(n) swaps total (versus insertion/bubble's O(n^2) writes), which matters when writes are far more expensive than reads (e.g. sorting data in flash memory with limited write cycles). But for general use, insertion sort dominates it — same simplicity, same in-place property, plus stability and adaptivity — so selection sort is mostly a teaching example.

## Linear-Time & Advanced Sorting

### Summary

**What this topic covers**
The sorts that escape the comparison model. Counting sort, radix sort, and bucket sort don't compare elements to each other — they exploit structure in the keys (small integer range, fixed digit width, uniform distribution) to hit O(n) or O(nk) instead of O(n log n). This topic also covers the reason O(n log n) is a *wall* for comparison sorts (the decision-tree lower bound), how sorting works when the data doesn't fit in RAM (external merge sort), and what the standard libraries actually run under the hood (Timsort, introsort). The mental model: comparison sorts ask "is a < b?"; non-comparison sorts ask "what bucket does a's key fall into?".

**Key terms**
*Comparison sort* — orders elements using only pairwise comparisons (`<`). *Counting sort* — tally occurrences of each key value, then emit in key order. *Radix sort* — sort by digits/bytes, least-significant-digit (LSD) or most-significant-digit (MSD) first. *Bucket sort* — scatter into buckets by value range, sort each, concatenate. *Stable sort* — equal keys keep their input order (radix depends on this). *k* — key range (counting) or number of digits (radix). *External sort* — sorts data larger than memory using disk passes. *Timsort* — Python/Java's adaptive merge sort. *Introsort* — C++'s quicksort/heapsort/insertion hybrid.

**Core mechanics**
Counting sort: allocate a count array of size k, tally each key, take a prefix sum to get final positions, place each element (iterating input right-to-left for stability). Time O(n + k), space O(n + k) — linear only when k = O(n). Radix sort: run a stable counting sort per digit, from least significant to most significant; d digits over base b gives O(d(n + b)). LSD radix works because a stable sort on digit i preserves the order established by digits 0..i-1. Bucket sort: with n items uniformly spread over the range, drop each into one of n buckets, insertion-sort each bucket; expected O(n) because each bucket holds O(1) items on average, worst case O(n^2) if everything lands in one bucket. External merge sort: sort memory-sized chunks (runs), write them to disk, then k-way merge the runs with a heap — minimizing disk passes is the whole game.

**Trade-offs**
Non-comparison sorts win when keys are bounded integers or short fixed-width strings and n is large — radix on 32-bit ints in 4 byte-passes is often faster than quicksort. They lose when k is huge (counting sort with k = 2^32 is absurd), when keys are floats/strings of unbounded length, or when you need in-place (they need O(n) auxiliary space). Comparison sorts are general-purpose and in-place-capable; that generality costs the log n factor.

**Common confusions**
"Radix sort is O(n), so it beats quicksort" ignores the hidden d and b: it's O(d·n), and d can dominate. Counting sort's linearity is conditional on k = O(n) — state that constraint or you're wrong. Candidates forget radix *requires* a stable inner sort; an unstable per-digit pass corrupts higher digits. Bucket sort's O(n) is *expected under uniform input*, not worst case. And the Omega(n log n) bound only applies to comparison sorts — quoting it to dismiss radix is a classic error.

**Why interviewers ask**
It separates people who memorized "sorting is n log n" from people who understand *why* and *when* that bound holds. The lower-bound proof tests whether you can reason about information content. The follow-up is almost always "can you sort these faster than n log n?" — and the correct move is to ask about the key domain. Knowing your language's stdlib sort (Timsort vs introsort) signals you understand real systems, not just textbook algorithms.

### What is a comparison sort, and what is its fundamental speed limit?

A comparison sort determines order using only pairwise comparisons — it never inspects the internal structure of a key, only asks "is a < b?". Merge sort, quicksort, heapsort, and insertion sort are all comparison sorts. The fundamental limit is Omega(n log n) comparisons in the worst case (and on average) for any comparison-based algorithm. No amount of cleverness gets a general comparison sort below n log n. To beat it you must leave the comparison model entirely and exploit structure in the keys.

### Why is O(n log n) a hard lower bound for comparison sorts?

Model any comparison sort as a binary decision tree: each internal node is one comparison with two outcomes, and each leaf is one possible output permutation. To sort correctly the tree must have a distinct reachable leaf for every one of the n! permutations of the input. A binary tree with at least n! leaves has height at least log2(n!). By Stirling's approximation, log2(n!) = Theta(n log n). The height of the tree is the worst-case number of comparisons, so every comparison sort needs Omega(n log n) comparisons. It's an information-theoretic argument: you need enough yes/no answers to distinguish n! outcomes.

### How does counting sort work and what is its complexity?

Counting sort sorts integer keys in a known small range [0, k). Steps: (1) allocate a count array of size k and tally how many times each key appears; (2) convert counts to a prefix sum so count[v] tells you the final position for key v; (3) iterate the input from right to left, placing each element at its computed position and decrementing the count. Iterating right-to-left keeps it stable. Time is O(n + k), space O(n + k). It's linear only when k = O(n); with a huge key range it degenerates.

### Why must counting sort be stable, and how do you make it stable?

Stability matters because counting sort is the workhorse inside radix sort, and radix breaks if the per-digit sort reorders equal digits. You make counting sort stable by using the prefix-sum positions and iterating the input array from the *last* element to the first: elements with equal keys are placed right-to-left into descending slots, which preserves their original left-to-right order. If you iterate left-to-right with the same prefix sums, you reverse equal-key order and lose stability.

### How does LSD radix sort work, and why does starting from the least significant digit work?

LSD radix sort processes digits from least significant to most significant, running a stable counting sort on each digit position. After sorting on digit 0, the array is ordered by the ones place. Sorting stably on digit 1 orders by the tens place while *preserving* the ones-place order among ties — so ties on the tens place stay sorted by ones. Inductively, after processing digit i the array is correctly sorted on digits 0..i. When the top digit is done, the whole array is sorted. Stability of the inner sort is exactly what makes this induction hold.

### What is the time complexity of radix sort, and when does it beat comparison sorts?

For n keys of d digits in base b, radix sort runs d passes of counting sort, each O(n + b), giving O(d(n + b)). Treating d and b as constants (e.g. 32-bit integers sorted as 4 byte-passes with b = 256) it's O(n). It beats comparison sorts when n is large and keys are fixed-width and bounded — sorting millions of 32-bit integers or fixed-length strings. It loses when keys are long or variable-length (d grows), when b is chosen too large (wasting the O(b) term), or when you can't afford the O(n + b) auxiliary space. The honest statement is O(d·n): linear in n but with a factor for key width.

### How does bucket sort work and why is it O(n) on average but O(n^2) worst case?

Bucket sort assumes keys are roughly uniformly distributed over a range. Create n buckets, map each element to a bucket by its value (e.g. floor(n * key) for keys in [0, 1)), then sort each bucket (usually insertion sort) and concatenate. Under uniform input each bucket holds O(1) elements in expectation, so the per-bucket sorts total O(n) and the whole thing is expected O(n). Worst case, all n elements hash into one bucket and that bucket's insertion sort is O(n^2). So bucket sort's speed is a property of the input distribution, not a guarantee — skewed data destroys it.

### When would you choose counting/radix/bucket sort over quicksort in practice?

Choose them when the keys have exploitable structure and you're sorting a lot of data. Counting sort: small integer keys (ages 0-120, byte values, small enum codes) — a single linear pass. Radix sort: large arrays of fixed-width integers, IP addresses, or fixed-length strings; databases and GPU sorts use it heavily. Bucket sort: floating-point keys known to be uniformly distributed. Stick with quicksort/introsort when keys are arbitrary comparables (custom objects, variable strings), when the range is unknown or huge, or when you need in-place sorting with O(log n) stack space rather than O(n) buckets.

### What is external merge sort and when do you need it?

External merge sort sorts data too large to fit in RAM — think sorting a 500 GB file on a machine with 16 GB of memory. Phase 1 (run generation): read a memory-sized chunk, sort it in RAM, write the sorted "run" to disk; repeat until the whole file is split into sorted runs. Phase 2 (merge): do a k-way merge of the runs, keeping one block per run in memory and using a min-heap to pick the next smallest element, streaming output to disk. The cost model is dominated by disk I/O passes, so you maximize k (the merge fan-in) to minimize the number of passes. This is the sort behind databases and MapReduce shuffle stages.

### What is Timsort and why do Python and Java use it?

Timsort is an adaptive, stable merge sort designed for real-world data that's often partially ordered. It scans for existing ascending or descending "runs" in the data, extends short runs with insertion sort to a minimum length, and merges runs using a balancing rule with a galloping mode that skips through long stretches where one run dominates. On already-sorted or nearly-sorted input it approaches O(n); worst case stays O(n log n). It's stable (required for Python's sort semantics) and exploits the reality that logs, timestamped records, and appended data have pre-existing order. Python's `list.sort` and Java's `Arrays.sort` for objects both use it.

### What is introsort and why does C++ use it instead of plain quicksort?

Introsort (introspective sort) is a hybrid that fixes quicksort's O(n^2) worst case while keeping its speed. It starts as quicksort but tracks recursion depth; if the depth exceeds ~2·log2(n) (a sign quicksort is degenerating on bad pivots), it switches that subrange to heapsort, which guarantees O(n log n). For small subarrays (typically < 16 elements) it falls back to insertion sort, which has low overhead on tiny inputs. C++'s `std::sort` uses introsort: you get quicksort's cache-friendly average performance with a hard O(n log n) worst-case guarantee, without relying on randomized pivots alone.

### Can any sort beat O(n log n)? Reconcile that with the lower bound.

Yes — counting, radix, and bucket sort run in linear time, and that does *not* contradict the lower bound, because the Omega(n log n) bound applies only to *comparison* sorts. Those algorithms never compare elements to each other; they use the keys' values directly as array indices (counting), digit positions (radix), or bucket assignments (bucket). By stepping outside the comparison model they sidestep the decision-tree argument entirely. The catch: they require assumptions about the keys (bounded integer range, fixed width, uniform distribution) that a general comparison sort doesn't need.

### How would you sort a huge array of 32-bit integers as fast as possible?

If the range is bounded and n is large, use LSD radix sort: treat each integer as 4 bytes and run 4 stable counting-sort passes with base 256 — O(4n) ≈ O(n), and it's cache-reasonable and parallelizable. If the range is tiny (say values 0-1000), a single counting sort in O(n + k) beats radix. If memory is tight or the keys might be arbitrary objects rather than plain ints, fall back to introsort. The senior move is to first ask about the key domain and available memory before naming an algorithm — the "fastest" sort is entirely a function of the input's structure.

### How do you sort with a custom comparator, and can you still use radix sort?

With a custom comparator you're back in the comparison model, so you use a comparison sort — pass the comparator to `std::sort`/`Arrays.sort`/`sorted(key=...)`. Radix and counting sort can't take an arbitrary comparator because they don't compare; they read key structure directly. You *can* sometimes adapt them by computing a *sort key* — a function mapping each element to an integer or fixed-width tuple whose natural order matches your desired order — then radix-sorting on that derived key. If your ordering can't be expressed as such a key (e.g. it depends on pairwise relationships), you're stuck with comparison sorting.

### Is stability worth the cost, and when does it actually matter?

Stability — preserving the input order of equal-keyed elements — matters whenever you sort by a secondary key after a primary one. Sort records by date, then stably by department, and within each department they stay date-ordered; without stability that second sort scrambles the first. It's essential inside radix sort. The cost is that stable sorts typically need O(n) auxiliary space (stable merge sort) rather than in-place operation; some in-place sorts (heapsort, plain quicksort) are not stable. Python and Java default to stable sorts; C++ `std::sort` is *not* stable (use `std::stable_sort` when you need it). Know your language's default — it's a common trap.

## Binary Search & Searching

### Summary

**What this topic covers**
Finding an element — or a boundary — in a sorted structure in O(log n) instead of O(n). Binary search is deceptively simple to state and notoriously easy to get wrong: the real skill is the loop invariant, the boundary variants (lower bound, upper bound, first/last occurrence), and the leap to "binary search on the answer" (parametric search), where you binary-search over a *value range* using a monotonic predicate rather than over array indices. This topic also covers the search variants — exponential, interpolation, ternary — and the two bugs that plague every implementation: off-by-one on the boundary and integer overflow in the midpoint.

**Key terms**
*Loop invariant* — the property held before/after every iteration (the answer lives in [lo, hi]). *Lower bound* — first index whose value is >= target. *Upper bound* — first index whose value is > target. *Monotonic predicate* — a boolean f(x) that is false...false, true...true (or vice versa) across the range; the precondition for binary search on the answer. *Parametric search* — binary-searching the answer space guided by a feasibility predicate. *Exponential search* — double a bound until you overshoot, then binary search the window. *Interpolation search* — guess the position by linear estimation on value. *Ternary search* — find the extremum of a unimodal function.

**Core mechanics**
Classic binary search maintains a candidate interval and halves it each step: compute mid = lo + (hi - lo) / 2, compare a[mid] to the target, discard the half that can't contain the answer. The invariant — "if the target exists, it's within the current interval" — is what guarantees correctness; every iteration must preserve it. Time O(log n), space O(1) iterative. The recurrence is T(n) = T(n/2) + O(1) = O(log n). Boundary variants change the comparison and which pointer moves: lower_bound moves lo past values < target; upper_bound moves lo past values <= target. Binary search on the answer: define a predicate feasible(x) that's monotonic in x, then binary-search the smallest (or largest) x for which it holds — the array is conceptual, the "sorted structure" is the truth table of the predicate.

**Trade-offs**
Binary search needs sorted (or monotonically-structured) data; if you must sort first that's O(n log n), so for a single lookup on unsorted data linear scan wins. It beats linear search decisively for repeated lookups on static sorted data. Interpolation search averages O(log log n) on uniform data but degrades to O(n) on skewed input; binary search's O(log n) is unconditional. Hash tables give O(1) average lookup but lose ordering and range queries — binary search keeps both.

**Common confusions**
The off-by-one wars: `lo <= hi` vs `lo < hi`, `hi = mid` vs `hi = mid - 1`. The fix is to pick one invariant and derive everything from it, not to guess-and-check. Computing mid as `(lo + hi) / 2` overflows for large indices — use `lo + (hi - lo) / 2`. Candidates think binary search only works on arrays; the real power is on the *answer space*. And they forget the data must be *monotonic* w.r.t. the predicate — binary search on a non-monotonic predicate silently returns garbage.

**Why interviewers ask**
Binary search is the ultimate "simple until it isn't" filter: anyone can state it, few write it bug-free on the first try, and fewer still recognize when a problem is secretly a binary-search-on-the-answer. The classic follow-up escalates from "find the element" to "find the first element >= x" to "minimize the maximum load across k partitions" — the same log n idea wearing progressively better disguises. It tests invariant reasoning and the ability to spot monotonic structure.

### Why is binary search O(log n) and linear search O(n)?

Linear search checks elements one at a time, so in the worst case (element absent or last) it does n comparisons — O(n). Binary search halves the remaining search space with each comparison: n, n/2, n/4, ... down to 1. The number of halvings to reach a single element is log2(n), giving O(log n) — the recurrence is T(n) = T(n/2) + O(1). Concretely, searching a billion sorted elements takes ~30 comparisons instead of a billion. The catch is binary search requires sorted data, while linear search works on anything.

### State the binary search loop invariant and why it matters.

The invariant is: "if the target exists in the array, it lies within the current search interval [lo, hi]." Every iteration must preserve this — when you discard a half, you must be certain the target can't be there. If a[mid] < target, everything at or below mid is too small, so you set lo = mid + 1, keeping the invariant. Getting the invariant explicit is the whole trick: it tells you exactly whether to use `<=` or `<` in the loop condition and whether to move the pointer to `mid` or `mid ± 1`. Bugs come from violating the invariant, not from the concept.

### How do you avoid the integer overflow bug in the midpoint calculation?

The naive `mid = (lo + hi) / 2` can overflow when lo + hi exceeds the integer maximum — a real bug that lived in Java's `Arrays.binarySearch` and the JDK for years. The fix is `mid = lo + (hi - lo) / 2`: mathematically identical, but the subtraction stays within bounds since hi - lo can't overflow when both are valid indices. In languages with big integers (Python) it's a non-issue, but in Java/C/C++/Rust it's a genuine trap and interviewers watch for it.

### What is the difference between lower bound and upper bound?

Both find insertion points in a sorted array with duplicates. Lower bound returns the first index whose value is >= target — the leftmost position where target could be inserted while keeping order. Upper bound returns the first index whose value is > target — the rightmost such position. If the target is present, lower_bound points at its first occurrence and upper_bound points just past its last. Their difference, upper_bound - lower_bound, is the count of elements equal to the target. Both run in O(log n) and differ only in whether the comparison is `<` (lower) or `<=` (upper) when deciding to move lo.

### How do you find the first and last occurrence of a value with duplicates?

Run two boundary searches. First occurrence = lower_bound(target): binary search for the leftmost index with value >= target, then check that array[index] == target. Last occurrence = upper_bound(target) - 1: find the leftmost index with value > target and step back one. Both are O(log n), so finding the full range of a duplicated value is O(log n) total. The key is that a plain binary search returns *some* matching index, not a boundary — you need the lower/upper-bound variants to pin down the extremes.

### What is "binary search on the answer" and when do you use it?

Instead of searching over array indices, you binary-search over the *space of possible answers*, guided by a feasibility predicate. It applies when: (1) the answer is a number in a known range [lo, hi], and (2) there's a monotonic predicate feasible(x) — if x works, every larger (or smaller) x also works. Example: "minimize the max load when splitting an array into k contiguous parts." Guess a capacity C; feasible(C) = "can we split into <= k parts each with sum <= C?" is monotonic (bigger C is easier). Binary-search the smallest feasible C. The "sorted array" is conceptual — it's the truth table false...false, true...true of the predicate.

### Give a concrete example of parametric search / binary search on the answer.

"Ship packages within D days; find the minimum ship capacity." Capacity is the answer, ranging from max(package) to sum(packages). Define feasible(cap) = "can we deliver all packages in <= D days if each day's load <= cap?" — computed by a greedy O(n) scan. This predicate is monotonic: more capacity never needs more days. Binary-search the smallest capacity where feasible is true. Total cost O(n log(sum)). Other classics: Koko eating bananas (min eating speed), splitting an array to minimize the largest subarray sum, and "smallest divisor given a threshold." The tell is "minimize the maximum" or "maximize the minimum" with a checkable predicate.

### What monotonicity condition must hold for binary search on the answer to be correct?

The predicate feasible(x) must be *monotonic* over the answer range: once it flips from false to true (or true to false) it never flips back. Formally, if feasible(x) is true then feasible(x') is true for all x' >= x (for a "minimize" problem). This guarantees a single boundary between the false region and the true region, which is exactly what binary search locates. If the predicate isn't monotonic — it flips multiple times — binary search will converge to *a* boundary but not necessarily the right one, silently returning a wrong answer. Always verify (and be ready to argue) monotonicity before applying the technique.

### What is exponential search and when is it better than plain binary search?

Exponential search (aka galloping or doubling search) finds a range first, then binary-searches it. Start with bound = 1 and double it (1, 2, 4, 8, ...) until array[bound] exceeds the target or you pass the end; now the target lies in [bound/2, bound], a window you binary-search. It runs in O(log i) where i is the target's position — faster than O(log n) binary search when the target is near the front. Its real use is *unbounded or infinite* sorted sequences where you don't know n upfront (streams, unbounded arrays): you can't compute a midpoint without a right boundary, so you gallop to find one.

### What is interpolation search and what is its complexity?

Interpolation search improves on binary search for *uniformly distributed* numeric keys by guessing the probe position rather than always taking the middle. Instead of mid = (lo + hi)/2, it estimates where the target should be by linear interpolation: pos = lo + (target - a[lo]) * (hi - lo) / (a[hi] - a[lo]) — like looking up "Smith" near the end of a phone book, not the middle. On uniformly distributed data it averages O(log log n), remarkably fast. But on skewed or clustered data the estimate is bad and it degrades to O(n) worst case. Binary search's O(log n) is distribution-independent, which is why it's the safe default.

### What is ternary search and when do you use it?

Ternary search finds the extremum (max or min) of a *unimodal* function — one that strictly increases then strictly decreases (or vice versa). It splits the range into thirds with two probes m1 and m2; by comparing f(m1) and f(m2) it discards one third that can't contain the peak, since unimodality guarantees the extremum isn't in the eliminated region. It runs in O(log n) probes (base 3/2). Use it for optimizing unimodal continuous or discrete functions — e.g. minimizing a convex cost. Note it finds *extrema*, not a target value; for locating a known value in a sorted array, binary search is strictly better (fewer function evaluations per step).

### How do you binary search a rotated sorted array?

A rotated sorted array (e.g. [4,5,6,7,0,1,2]) has one pivot; at each step at least one half [lo, mid] or [mid, hi] is still properly sorted. Compute mid, then determine which half is sorted by comparing a[lo] to a[mid]: if a[lo] <= a[mid] the left half is sorted, else the right half is. Check whether the target falls within the sorted half's value range; if so, search that half, otherwise search the other. It stays O(log n) — you still halve each step. The insight is that rotation preserves enough local sortedness to keep binary search's discard rule valid; you just decide the discard by which half is monotonic.

### Why choose `lo < hi` vs `lo <= hi`, and how do you pick termination?

The two loop styles correspond to two invariants. `while (lo <= hi)` searches a *closed* interval [lo, hi] where every index including hi is a live candidate; you exit when lo > hi (empty interval), and pointers move to mid ± 1. `while (lo < hi)` searches a *half-open* interval and converges lo and hi to a single boundary index (common for lower/upper-bound style), moving hi = mid (not mid - 1). The rule: pick the invariant first, then the loop condition, the pointer updates, and the return value all follow deterministically. Mixing conventions — `lo <= hi` with `hi = mid` — causes infinite loops. Consistency, not memorization, is the fix.

### When is binary search the wrong choice?

When the data isn't sorted and you'll query it only once — sorting to enable binary search costs O(n log n), so a single O(n) linear scan is cheaper. When the structure changes frequently, keeping it sorted for binary search is expensive (each insert is O(n) in an array); a balanced BST or hash structure may serve better. When you need O(1) exact-match lookups and don't care about order, a hash table beats O(log n). And binary search fundamentally requires *monotonic* structure — if there's no sorted order or monotonic predicate to exploit, it doesn't apply at all.

### How does binary search compare to a hash table for lookups?

Hash tables give expected O(1) point lookups; binary search on a sorted array gives O(log n). For pure "is x present" queries on a static set, the hash table is asymptotically faster. But binary search on sorted data wins on everything *order-related*: range queries ("all values between a and b"), successor/predecessor, finding the k-th smallest, and returning results in sorted order — all natural for a sorted array or tree, all impossible or expensive for a hash table. Binary search also has better worst-case guarantees (hashing can degrade to O(n) with collisions) and better cache locality on contiguous arrays. Choose by whether you need ordering and range operations, not just membership.

## Greedy Algorithms

### Summary

**What this topic covers**
Algorithms that build a solution one step at a time, always taking the locally best-looking option and never reconsidering. The paradigm is trivially easy to *code* and treacherous to *justify*: the whole difficulty is proving that a sequence of locally optimal choices yields a globally optimal result. This topic covers the two properties that make greedy correct (greedy-choice property and optimal substructure), the exchange argument used to prove correctness, canonical wins (interval scheduling, Huffman coding, fractional knapsack), and the canonical failures (0/1 knapsack, coin change with arbitrary denominations) where greedy plausibly-but-wrongly seems right.

**Key terms**
*Greedy choice* — commit to the best immediate option without lookahead or backtracking. *Greedy-choice property* — some globally optimal solution contains the greedy first choice (so committing to it loses nothing). *Optimal substructure* — an optimal solution is built from optimal solutions to subproblems. *Exchange argument* — proof technique: transform any optimal solution into the greedy one, swap by swap, without worsening it. *Matroid* — the algebraic structure guaranteeing greedy optimality (deep background, rarely required). *Fractional vs 0/1* — whether you may take part of an item; fractional is greedy-solvable, 0/1 is not.

**Core mechanics**
The recipe: (1) sort or order candidates by a greedy criterion; (2) iterate, taking each candidate that doesn't violate feasibility; (3) never undo. Cost is usually dominated by the sort — O(n log n) — plus a linear pass. Correctness rests on two pillars. Greedy-choice property: prove that some optimal solution *agrees with* the greedy choice, so you never sacrifice optimality by making it — typically via an exchange argument, showing any optimal solution that differs can be edited to match the greedy pick without getting worse. Optimal substructure: after committing the greedy choice, the remaining problem is a smaller instance of the same problem, so induction carries the optimality through. If either pillar fails, greedy fails.

**Trade-offs**
Greedy vs dynamic programming: greedy commits immediately and never revisits, so it's faster (often O(n log n) vs DP's O(n·W) or O(n^2)) and uses O(1)-O(n) space, but it only works when the greedy-choice property holds. DP explores and combines subproblem solutions, so it's slower and heavier but correct for the broader class where a locally optimal choice can be globally wrong. Rule of thumb: try to prove greedy correct; if you can't produce an exchange argument, fall back to DP. Greedy is a *special case* of problems DP can also solve — when greedy works, DP would too but wastefully.

**Common confusions**
The cardinal error is assuming greedy works because it *feels* obvious — 0/1 knapsack by value-density looks right and is wrong. Candidates confuse "I found a greedy that passes the examples" with "I proved it optimal"; passing tests is not a proof. Interval scheduling: the correct key is *earliest finish time*, not shortest duration or earliest start — a classic trap. Coin change is greedy-optimal for canonical coin systems (US coins) but not arbitrary ones ({1,3,4} making 6). And greedy-choice property is not the same as optimal substructure — a problem can have one without the other.

**Why interviewers ask**
Greedy problems test *judgment and proof*, not coding — the code is five lines; the question is "why is this correct, and how do you know it's not one of the cases where greedy fails?" Interviewers want to see you propose a greedy, then either prove it with an exchange argument or spot the counterexample that kills it. The signature follow-up is "are you sure? construct an input where that fails" — and the strong candidate either defends with a proof sketch or immediately reaches for DP.

### What defines a greedy algorithm?

A greedy algorithm builds a solution incrementally, at each step making the choice that looks best *right now* according to some local criterion, and never reconsidering past choices. No backtracking, no lookahead, no exploring alternatives. Because it commits immediately, it's fast — usually dominated by an initial sort, O(n log n). The entire subtlety is correctness: a greedy is only valid if those locally optimal choices provably compose into a globally optimal solution, which is *not* guaranteed for most problems. Coding a greedy is easy; justifying it is the real work.

### What two properties must a problem have for greedy to be optimal?

First, the **greedy-choice property**: there exists a globally optimal solution that makes the same first choice the greedy algorithm makes — so committing to the greedy choice never forecloses optimality. Second, **optimal substructure**: after making that choice, what remains is a smaller instance of the same problem, and an optimal solution to the whole is the greedy choice plus an optimal solution to the remainder. Together they license an inductive argument: the greedy first move is safe, and by induction the greedy solution to the rest is optimal, so the whole is optimal. If either property is absent, greedy can produce suboptimal answers.

### What is the exchange argument and how do you use it to prove a greedy correct?

The exchange argument proves the greedy-choice property. You take an arbitrary optimal solution OPT and show you can transform it, one swap at a time, into the greedy solution G without ever making it worse. Concretely: if OPT differs from G in its first choice, argue you can *exchange* OPT's choice for the greedy choice and get a solution that's still feasible and no worse (often provably at least as good). Repeat, and OPT converges to G with quality never decreasing — so G is at least as good as OPT, hence optimal. It's the standard proof pattern for interval scheduling, Huffman, and fractional knapsack. In an interview, sketching an exchange argument is how you *demonstrate* correctness rather than assert it.

### Solve interval scheduling (activity selection) greedily and state why it works.

Given intervals with start/finish times, select the maximum number of non-overlapping ones. Greedy: sort by *earliest finish time*, then repeatedly take the next interval whose start is >= the last taken interval's finish. O(n log n) for the sort. Why it works (exchange argument): the interval finishing earliest leaves the most room for the rest, so some optimal solution includes it — if an optimal solution's first interval finishes later, swap it for the earliest-finishing one; it still doesn't overlap the rest and keeps the count the same. Inductively the greedy is optimal. The crucial detail is the sort key: earliest *finish*, not earliest start or shortest duration.

### Why is earliest-finish-time the right greedy key for interval scheduling, and why do the alternatives fail?

Earliest finish time frees up the timeline as early as possible, maximizing room for remaining choices — that's exactly what the exchange argument exploits. Earliest *start* fails: a single interval that starts first but runs very long can block many short later intervals (one long meeting starting at 9am blocks the whole day). Shortest *duration* fails too: a short interval sitting in the middle can overlap two longer intervals that don't overlap each other, so picking the short one loses a count of 2 for a gain of 1. Only earliest-finish provably preserves optimality; the other two have easy two- or three-interval counterexamples.

### How does Huffman coding work and why is the greedy choice optimal?

Huffman builds an optimal prefix-free binary code from character frequencies. Greedy: put all characters in a min-priority-queue keyed by frequency; repeatedly extract the two *lowest*-frequency nodes, merge them under a new parent whose frequency is their sum, and reinsert; the final tree gives each character a codeword by root-to-leaf path. O(n log n) via the heap. Optimality (exchange argument): in an optimal prefix tree the two lowest-frequency characters must be siblings at the greatest depth — if they weren't, you could swap them downward without increasing the weighted path length. So merging the two rarest symbols first is a safe greedy choice, and optimal substructure carries the rest. It minimizes total encoded length sum(freq_i * depth_i).

### Explain fractional knapsack and why greedy solves it but 0/1 knapsack doesn't.

Fractional knapsack: items have value and weight, capacity W, and you may take *fractions* of items. Greedy: sort by value-to-weight ratio (value density) descending, take whole items greedily, and take a fraction of the first item that doesn't fully fit to fill W exactly. O(n log n). It's optimal because you can always fill every unit of capacity with the best available density — the exchange argument swaps any lower-density weight in a solution for higher-density weight, strictly improving it. 0/1 knapsack forbids fractions, so you can't top off the last bit of capacity; greedily taking the highest-density item can waste capacity that a different combination would use better. 0/1 knapsack needs DP (O(n·W)) because the all-or-nothing constraint breaks the greedy-choice property.

### Give a concrete example where greedy fails and DP is required.

0/1 knapsack: capacity 10; items A (value 60, weight 10), B (value 40, weight 6), C (value 40, weight 5). Greedy by value density picks A (density 6) for value 60 and stops — capacity full. But B + C (weight 11) doesn't fit either; B alone or... actually take B and C: weight 6+5=11 > 10, so pick B (40, w6) then nothing fits well. Cleaner example: capacity 4, items (value 3, weight 3) density 1.0 and two items (value 2, weight 2) density 1.0 each — greedy is fine here. The classic: capacity 5, items (v10,w5), (v6,w3), (v5,w2). Greedy density picks the w5 item for value 10; but the w3+w2 combo gives value 11. Greedy is beaten because the last unit of capacity can't be filled fractionally, so DP is required.

### When should you reach for greedy vs dynamic programming?

Reach for greedy when you can *prove* the greedy-choice property — when a locally optimal choice is provably part of some global optimum (interval scheduling, Huffman, fractional knapsack, MST). It's faster (typically O(n log n)) and lighter. Reach for DP when local choices can be globally wrong and you need to consider combinations of subproblem solutions — 0/1 knapsack, edit distance, longest common subsequence, coin change with arbitrary denominations. The practical heuristic: propose a greedy and try to construct a counterexample; if you can't and you can sketch an exchange argument, use greedy; if you find a counterexample, the presence of overlapping subproblems and conflicting choices signals DP.

### Is greedy coin change always optimal?

No — it depends on the coin system. Greedy (repeatedly take the largest coin <= remaining amount) is optimal for *canonical* coin systems like US coins {1, 5, 10, 25}: for any amount it yields the fewest coins. But for arbitrary denominations it can fail. Classic counterexample: coins {1, 3, 4}, amount 6. Greedy takes 4 + 1 + 1 = 3 coins; optimal is 3 + 3 = 2 coins. Because greedy fails for general denominations, the general minimum-coin-change problem is solved with DP in O(amount * numCoins). Whether a coin system is "canonical" (greedy-safe) is itself a non-trivial property to verify.

### What is optimal substructure and how does it differ from the greedy-choice property?

Optimal substructure means an optimal solution to the whole problem contains optimal solutions to its subproblems — solve the parts optimally and you can assemble the optimal whole. It's shared by *both* greedy and DP problems; it's what makes recursion/induction work. The greedy-choice property is stronger and more specific: it says you can pick the locally best option *first, without solving any subproblems*, and still reach a global optimum. DP problems have optimal substructure but *lack* the greedy-choice property — you can't commit to one choice up front, you must try choices and combine. So: optimal substructure is necessary for both; the greedy-choice property is the extra ingredient that separates greedy-solvable from DP-only.

### How do you prove a greedy algorithm is correct in an interview?

Two standard approaches. (1) **Exchange argument**: take any optimal solution and show you can transform it toward the greedy solution one swap at a time without worsening it, concluding the greedy is at least as good — the go-to for scheduling, Huffman, MST. (2) **Greedy-stays-ahead**: prove by induction that after each step the greedy's partial solution is at least as good as any other solution's corresponding partial (e.g. greedy has scheduled at least as many jobs by any time t). Either way you must argue the greedy-choice property and optimal substructure. Saying "it works on the examples" is not a proof; interviewers explicitly probe for the exchange or stays-ahead argument.

### Why do MST algorithms (Kruskal, Prim) count as greedy, and why are they optimal?

Both build a minimum spanning tree by repeatedly adding the cheapest safe edge. Kruskal sorts edges and adds the next cheapest that doesn't form a cycle (using union-find — see the Data Structures primer for the structure). Prim grows a tree from a start vertex, always adding the cheapest edge leaving the current tree (using a heap). Both are greedy: locally cheapest safe edge, no reconsideration. Optimality follows from the **cut property**: for any partition of vertices into two sets, the minimum-weight edge crossing the cut is in some MST — an exchange argument shows swapping any crossing edge for the minimum one doesn't increase total weight. Each greedy edge is a minimum crossing edge for some cut, so it's safe. Kruskal is O(E log E); Prim is O(E log V) with a binary heap.

### Can a greedy give a good approximation even when it's not optimal?

Yes — greedy is a workhorse for *approximation algorithms* on NP-hard problems where exact optimization is intractable. Greedy set cover picks the set covering the most uncovered elements each round and achieves an O(log n) approximation ratio — provably no polynomial algorithm does much better unless P=NP. Greedy job scheduling on machines (list scheduling) gives a 2-approximation for makespan. The pattern: even when greedy can't guarantee the optimum, you can often *bound how far off* it is, giving a fast algorithm with a proven quality guarantee. So "greedy isn't optimal here" doesn't mean "greedy is useless" — a bounded approximation is frequently the best practical option.

### What is the single most common mistake candidates make with greedy problems?

Assuming a greedy is correct because it's intuitive and passes the sample inputs, without proving it or hunting for a counterexample. Greedy strategies are seductive — value-density for 0/1 knapsack, shortest-interval for scheduling, largest-coin for coin change — and they're *wrong* in exactly the cases interviewers pick. The disciplined approach is: propose the greedy, then immediately try to *break* it with a small adversarial input; if you can't break it, sketch an exchange argument to prove it; if you can break it, switch to DP. Treating "it seems obvious" as sufficient justification is the mistake that separates weak from strong greedy answers.

## Dynamic Programming Fundamentals

### Summary

**What this topic covers**
Dynamic programming (DP) solves problems by breaking them into overlapping subproblems and reusing each subproblem's answer instead of recomputing it. It applies when a problem has *optimal substructure* (an optimal answer is built from optimal answers to smaller instances) and *overlapping subproblems* (the same smaller instances recur many times). The whole discipline is: define a state, write a recurrence (transition), decide an evaluation order, and store results in a table. If you can write the recurrence, the code is mechanical.

**Key terms**
*State* — the minimal set of parameters that uniquely identifies a subproblem (e.g. `dp[i]` = best answer considering the first `i` items). *Transition* — the recurrence relating a state to smaller states. *Optimal substructure* — optimal solution decomposes into optimal sub-solutions. *Overlapping subproblems* — the recursion tree revisits identical states. *Memoization* — top-down recursion that caches results. *Tabulation* — bottom-up iteration that fills a table. *Base case* — the smallest states answered directly. *Iteration order* — the sequence in which tabulation fills states so every dependency is ready before it is used.

**Core mechanics**
Two implementations of the same recurrence. *Top-down (memoization):* write the natural recursion, add a cache keyed by state; on entry, return the cached value if present, else compute and store. Only states actually reachable get computed. *Bottom-up (tabulation):* allocate the table, seed base cases, loop states in dependency order, apply the transition. Complexity is the same for both and follows a simple formula: `time = (number of states) x (cost per transition)`; `space = table size` (before optimization). For Fibonacci, `n` states, O(1) transition, so O(n) time; naive recursion is O(2^n) because it recomputes. Correctness rests on the recurrence being exact for the base cases and each transition only depending on already-correct smaller states.

**Trade-offs**
Memoization is easier to write (translate the recurrence literally), computes only reachable states, and handles sparse or hard-to-order state spaces — but pays recursion overhead and risks stack overflow on deep chains. Tabulation avoids the stack, has better constant factors and cache locality, and enables rolling-array space optimization — but you must nail the iteration order and it may compute states you never needed. DP vs greedy: DP is safe when local choices interact; greedy is faster but only correct when a local optimum is provably global. DP vs plain divide-and-conquer: use DP when subproblems overlap, otherwise D&C's independent splits are fine.

**Common confusions**
Confusing *optimal substructure* with *overlapping subproblems* — you need both; merge-sort has substructure but no overlap (so it is not DP). Thinking memoization and tabulation give different complexities — they do not; they trade constant factors and stack usage. Under-specifying the state so two genuinely different subproblems collide in one cache slot (a wrong-answer bug). Getting the iteration order backwards so a transition reads an unfilled cell. Over-optimizing space before the 2D version is correct. Assuming every recursive problem is DP — without overlap you gain nothing from a cache.

**Why interviewers ask**
DP separates candidates who can *model* a problem from those who only pattern-match. The interviewer watches you name the state, justify the recurrence, and reason about order and complexity — the "1D vs 2D state", "can you drop a dimension", and "top-down vs bottom-up" follow-ups probe depth. It is the canonical test of turning a fuzzy optimization into a precise recurrence.

### What are the two conditions a problem must satisfy to be solvable by dynamic programming?

Optimal substructure and overlapping subproblems. *Optimal substructure* means an optimal solution to the whole is composed of optimal solutions to subproblems — so you can define the answer recursively (shortest paths have it; longest *simple* paths do not). *Overlapping subproblems* means the recursion revisits the same subproblem repeatedly, so caching pays off. Both are required: without substructure the recurrence is wrong; without overlap a cache buys nothing and you may as well use divide-and-conquer.

### How does memoization differ from tabulation?

They implement the same recurrence from opposite directions. Memoization is top-down: you write the natural recursion and cache each result keyed by state, computing a state lazily the first time it is requested. Tabulation is bottom-up: you allocate a table, fill base cases, then iterate states in dependency order applying the transition. Same asymptotic time and space. Memoization is easier to derive and skips unreachable states; tabulation avoids recursion-stack limits, has tighter constants, and unlocks rolling-array space savings.

### What is a "state" in DP and why does choosing it well matter?

The state is the minimal set of parameters that fully identifies a subproblem — everything the answer depends on and nothing more. `dp[i][w]` for knapsack means "best value using the first `i` items within capacity `w`". Choosing it well is the whole game: too few parameters and distinct subproblems collide (wrong answers); too many and you blow up time and memory. The state count directly sets your complexity, so a tighter state is both correct and faster.

### How do you derive the time and space complexity of a DP solution?

`time = (number of distinct states) x (work per transition)`. If there are `n * W` states and each does O(1) work, it is O(n*W). A transition that loops over `k` choices makes it O(n*W*k). Space is the table size, `O(number of states)`, before optimization. This is why the interview reflex is "how many states, how expensive is each transition" — it gives the bound directly and tells you which dimension to attack for speedups.

### Why is naive recursive Fibonacci exponential while the DP version is linear?

Naive `fib(n) = fib(n-1) + fib(n-2)` rebuilds an entire binary recursion tree, recomputing `fib(k)` an exponential number of times — O(2^n) roughly (actually O(phi^n)). There are only `n` distinct subproblems, so caching each once collapses the tree to O(n) time. It is the textbook demonstration of overlapping subproblems: the work is exponential only because identical states are recomputed.

### What is the difference between optimal substructure and overlapping subproblems?

Optimal substructure is about *correctness of decomposition* — the optimum is assembled from sub-optima, so a recurrence exists. Overlapping subproblems is about *efficiency* — those subproblems recur, so caching helps. Merge sort has optimal substructure (sorted halves merge into a sorted whole) but no overlap (the halves are disjoint), so it is divide-and-conquer, not DP. You need both properties before DP is the right tool.

### How do you decide the iteration order for a bottom-up DP?

Fill states in an order where every state's dependencies are already computed. Read the recurrence: if `dp[i]` depends on `dp[i-1]`, iterate `i` ascending. For grid `dp[i][j]` depending on top and left neighbors, go row-major top-left to bottom-right. For 0/1 knapsack's rolling 1D array you iterate capacity *descending* to avoid reusing an item within the same pass. A quick check: the dependency graph over states must be a DAG, and you fill in a topological order of it.

### When would you prefer top-down memoization over bottom-up tabulation?

When only a small fraction of the state space is reachable (memoization computes just those), when the natural iteration order is awkward to express, or when the recurrence is far easier to write recursively than to linearize. Interval DP and DP over irregular states often read cleaner top-down. Switch to tabulation when recursion depth risks a stack overflow, when constant factors and cache locality matter, or when you want rolling-array space reduction.

### What is space optimization in DP and when can you apply it?

When a state only depends on a bounded window of previous states, you can discard the rest. Fibonacci needs only the last two values — O(1) space instead of O(n). A 2D DP whose row `i` depends only on row `i-1` can keep two rows, or even one row updated in place, cutting O(n*m) to O(m). The prerequisite is a *bounded dependency distance*; if a transition reaches arbitrarily far back you must keep the full table. Optimize only after the unoptimized version is correct.

### How would you reconstruct the actual solution, not just its optimal value?

Two options. Store back-pointers: alongside each `dp` cell, record which choice produced it, then walk the pointers from the final state to the base case. Or, if you kept the full table, reconstruct by re-deriving at each step which predecessor achieved the stored optimum. Back-pointers cost extra memory but give O(path length) reconstruction; re-deriving saves memory but costs a second pass. Note reconstruction is generally incompatible with aggressive rolling-array space optimization, since you need the history.

### Can every recursive problem be sped up with memoization?

No. Memoization only helps when subproblems overlap. Merge sort's recursion never revisits a subproblem, so a cache adds overhead for zero benefit. Memoization also requires the function to be *pure* over its state — the result must depend only on the cached parameters, not on external mutable context. If the "state" you would cache on does not fully determine the output, caching produces wrong answers.

### What distinguishes dynamic programming from greedy algorithms?

Greedy commits to a locally optimal choice at each step and never reconsiders; DP considers all relevant choices and lets subproblem results decide. Greedy is faster (often O(n log n) with a sort) but only correct when a greedy-choice property holds — a local optimum provably extends to a global one (as in Huffman coding or interval scheduling). When choices interact so that a locally best move can hurt globally (0/1 knapsack, edit distance), you need DP. A safe interview move: reach for DP, then note if a greedy shortcut is provably valid.

### What is the difference between DP and divide-and-conquer?

Both split a problem into subproblems, but divide-and-conquer's subproblems are *independent and non-overlapping* (merge sort, quickselect), so results are combined once and never reused. DP's subproblems *overlap*, so it stores and reuses results. If you find yourself solving the same subproblem repeatedly in a D&C recursion, that is the signal to add memoization and treat it as DP.

### How do you turn a recurrence with multiple parameters into working code?

Map each parameter to a table dimension. `dp[i][j]` becomes a 2D array; the recurrence becomes the assignment inside nested loops. Seed the base cases (usually `i == 0` or `j == 0` boundaries). Order the loops so each cell's dependencies are filled first. The transition — the max/min/sum over the recurrence's cases — is the loop body. The parameters, base cases, and order are the design work; the code writes itself once those are fixed.

### A senior follow-up: your DP is correct but too slow or uses too much memory — how do you attack it?

Attack the state count and the transition cost separately. To cut *time*: shrink the state (drop a redundant parameter), or speed the transition — replace an inner loop with a precomputed prefix sum, a monotonic-queue optimization, or a convex-hull / divide-and-conquer optimization where the recurrence structure allows. To cut *space*: apply a rolling array when dependencies are bounded, or store only the frontier. Always confirm which factor dominates first — profile the `states x transition` product rather than guessing, and note that some space optimizations forfeit solution reconstruction.

## Classic DP Problems & Patterns

### Summary

**What this topic covers**
The recurring DP archetypes an interviewer expects you to recognize on sight: 0/1 knapsack, longest common subsequence (LCS) and edit distance, longest increasing subsequence (LIS), coin change, grid/path counting, interval DP, bitmask DP, and DP on trees. Each has a signature state shape and transition. The skill is pattern-matching a new problem onto the nearest archetype, then adapting the state.

**Key terms**
*0/1 knapsack* — pick a subset under a capacity to maximize value, each item used at most once. *Unbounded knapsack* — items reusable (coin change is this shape). *LCS* — longest subsequence common to two sequences. *Edit distance* — min insert/delete/replace operations to transform one string into another. *LIS* — longest strictly increasing subsequence. *Interval DP* — state is a range `[i, j]`, built from smaller ranges. *Bitmask DP* — state includes a subset encoded as bits, for small `n`. *Tree DP* — states defined per node, combined from children via post-order.

**Core mechanics**
Knapsack: `dp[i][w] = max(dp[i-1][w], value[i] + dp[i-1][w-weight[i]])`; O(n*W), reducible to one row. LCS: `dp[i][j] = dp[i-1][j-1]+1` if chars match else `max(dp[i-1][j], dp[i][j-1])`; O(n*m). Edit distance: same grid with a three-way min over insert/delete/replace. LIS: O(n^2) DP, or O(n log n) via patience sorting with binary search over "tails". Coin change: unbounded knapsack, `dp[a] = min over coins of dp[a-coin]+1`; O(amount*coins). Grid paths: `dp[i][j] = dp[i-1][j] + dp[i][j-1]`; O(n*m). Interval DP: `dp[i][j]` from splits `k` in `(i, j)`; O(n^3) typical. Bitmask DP: `2^n` subsets x `n`, so O(2^n * n) or O(2^n * n^2) — only viable for `n` up to about 20. Tree DP: post-order, each node aggregates children in O(children).

**Trade-offs**
LIS in O(n log n) is faster but the patience-sorting version does not directly yield the subsequence without extra bookkeeping; the O(n^2) DP reconstructs more easily. Bitmask DP is exponential — it is a deliberate "n is tiny" tool, not a scalable one. Interval DP's O(n^3) is fine for `n` in the hundreds, not thousands. Rolling arrays shrink knapsack/LCS memory but complicate reconstruction. Choosing the right archetype early saves you from inventing a bespoke, buggy recurrence.

**Common confusions**
0/1 vs unbounded knapsack — the loop direction over capacity differs (descending forbids reuse, ascending permits it); getting it wrong silently changes the problem. Subsequence (order-preserving, non-contiguous) vs substring (contiguous) in LCS-type problems. Coin change *count of ways* (sum, order of loops matters to avoid double counting) vs *min coins* (a min recurrence). LIS "strictly" vs "non-decreasing" flips a `<` to `<=` and a `lower_bound` to `upper_bound`. Forgetting bitmask DP is exponential and proposing it for large `n`.

**Why interviewers ask**
These archetypes are the vocabulary of DP interviews. Recognizing that a prompt is "just LCS with a twist" or "unbounded knapsack" is the signal of a prepared candidate. The follow-ups — reduce the space, reconstruct the answer, handle a variant — test whether you understand the recurrence or merely memorized code.

### How do you recognize a 0/1 knapsack problem and set up its recurrence?

Signature: choose a subset of items, each usable at most once, to optimize a value under a capacity/budget constraint. State `dp[i][w]` = best value from the first `i` items within capacity `w`. Transition: `dp[i][w] = max(dp[i-1][w], value[i] + dp[i-1][w - weight[i]])` — skip item `i` or take it. Base case `dp[0][*] = 0`. Time O(n*W), space reducible to O(W) with a 1D array iterated capacity-*descending* so each item is used once. Note `W` makes this *pseudo-polynomial*, not truly polynomial.

### What is the difference between 0/1 and unbounded knapsack in code?

The state shape is identical; the capacity loop direction differs. In the 1D rolling version, 0/1 knapsack iterates capacity *descending* so an item can be added at most once per pass. Unbounded knapsack (each item reusable any number of times — coin change is exactly this) iterates capacity *ascending*, which lets the same item be re-consumed within one pass. One flipped loop bound is the entire difference between "use once" and "use many".

### Explain the LCS recurrence and its complexity.

For strings `a` (length n) and `b` (length m), `dp[i][j]` = length of the longest common subsequence of the first `i` chars of `a` and first `j` of `b`. If `a[i-1] == b[j-1]`, `dp[i][j] = dp[i-1][j-1] + 1`; otherwise `dp[i][j] = max(dp[i-1][j], dp[i][j-1])`. Base cases are the zero row and column. Time O(n*m), space O(n*m) or O(min(n,m)) with two rows. Subsequence means order-preserving but non-contiguous — do not confuse it with longest common *substring*, which resets to 0 on a mismatch.

### How is edit distance related to LCS?

Same grid, richer transition. `dp[i][j]` = minimum edits to turn the first `i` chars of `a` into the first `j` of `b`. If the chars match, `dp[i][j] = dp[i-1][j-1]`; else `dp[i][j] = 1 + min(dp[i-1][j] (delete), dp[i][j-1] (insert), dp[i-1][j-1] (replace))`. Base cases: `dp[i][0] = i`, `dp[0][j] = j` (delete-all / insert-all). O(n*m) time and space, reducible to two rows. It is LCS's cousin: matches carry the diagonal for free, mismatches take a costed min.

### What are the two ways to solve Longest Increasing Subsequence and their complexities?

O(n^2) DP: `dp[i]` = length of the longest increasing subsequence ending at index `i` = `1 + max(dp[j])` over all `j < i` with `nums[j] < nums[i]`; answer is the max cell. O(n log n) patience sorting: maintain a `tails` array where `tails[k]` is the smallest possible tail of an increasing subsequence of length `k+1`; for each element, binary-search its insertion point and overwrite. The length of `tails` at the end is the answer. The n log n version wins on speed; the n^2 version reconstructs the actual subsequence more directly via back-pointers.

### For LIS, how does the O(n log n) approach actually work and why is it correct?

You keep `tails`, where `tails[k]` holds the minimum tail value over all increasing subsequences of length `k+1`. Each new element `x` replaces the first `tails` entry that is `>= x` (via binary search), or appends if `x` exceeds all of them. Correctness: `tails` stays sorted, and keeping the smallest possible tail for each length maximizes the chance to extend later — a greedy-on-a-DP argument. The array's length equals the LIS length, though `tails` itself is not necessarily a valid subsequence. Strict vs non-decreasing decides `lower_bound` vs `upper_bound`.

### How does coin change (minimum coins) differ from coin change (number of ways)?

*Minimum coins*: `dp[a]` = fewest coins summing to amount `a` = `min over coins c of dp[a - c] + 1`, base `dp[0] = 0`, infinity if unreachable. Loop order does not affect correctness. *Number of ways*: `dp[a]` = count of combinations; you must loop *coins on the outer loop, amount inner* so each combination is counted once regardless of order — swapping the loops counts permutations instead and over-counts. Both are unbounded-knapsack shaped, O(amount * coins), but the ways version's loop nesting is the classic trap.

### How do you count paths in a grid with DP?

`dp[i][j]` = number of ways to reach cell `(i, j)`. For moves down/right only, `dp[i][j] = dp[i-1][j] + dp[i][j-1]`, with the top row and left column seeded to 1 (a single path along the edge). Obstacles set `dp[i][j] = 0`. Time and space O(n*m), space reducible to one row since each cell needs only the current row's left neighbor and the previous row's value. Minimum-cost path variants swap the sum for `cost[i][j] + min(top, left)`.

### What is interval DP and what is its typical complexity?

Interval DP defines states over contiguous ranges: `dp[i][j]` = optimal answer for the subarray/substring from `i` to `j`, built by trying every split point `k` between them: `dp[i][j] = best over k of combine(dp[i][k], dp[k+1][j]) + cost`. Classic cases: matrix-chain multiplication, burst balloons, optimal BST, palindrome partitioning. You fill by increasing interval length so sub-ranges are ready. Typical complexity O(n^3) — O(n^2) states times an O(n) split loop — acceptable for `n` in the hundreds. Some problems admit Knuth's optimization to O(n^2).

### When do you reach for bitmask DP and what limits it?

When the state must track *which subset* of a small set is used or visited — traveling-salesman-style routing, assignment problems, "cover all elements". Encode the subset as an integer bitmask; state is `dp[mask][...]`. Held-Karp TSP is `dp[mask][last]` = shortest path visiting `mask` ending at `last`, O(2^n * n^2). The hard limit is exponential blowup: `2^n` masks means `n` up to roughly 20 (2^20 is about a million). If `n` is large, bitmask DP is the wrong tool — that is the interviewer's cue to check your complexity judgment.

### How does DP on trees work?

Root the tree, then post-order traverse so every node is processed after its children. Each node's state aggregates its children's already-computed states — e.g. `dp[node][0/1]` for "max independent set" (node excluded / included), where included = `value[node] + sum(dp[child][0])` and excluded = `sum(max(dp[child][0], dp[child][1]))`. One DFS, O(n) total since each edge is used once. Problems needing answers "for every node as root" use *rerooting*: a second pass that adjusts each child's answer using the parent's, keeping it O(n) instead of O(n^2).

### Why is knapsack called "pseudo-polynomial" and why does it matter?

Its O(n*W) runtime is polynomial in the *value* of the capacity `W`, but `W` takes only `log W` bits to write down, so the runtime is exponential in the *input size*. That is the definition of pseudo-polynomial. It matters because 0/1 knapsack is NP-hard: the DP is efficient only when `W` is numerically small; if capacities are huge (say 10^18), the table is infeasible and no known truly polynomial algorithm exists. Interviewers probe this to see whether you understand the difference between "value" and "size" complexity.

### How would you reconstruct which items are in the optimal knapsack?

Keep the full 2D table (not the rolling 1D one), then walk backward from `dp[n][W]`. At each `(i, w)`: if `dp[i][w] == dp[i-1][w]`, item `i` was not taken — move to `(i-1, w)`; otherwise it was taken — record it and move to `(i-1, w - weight[i])`. This O(n) backward pass recovers the chosen set. The catch: it needs the history, so it is incompatible with the O(W) space optimization — a common reconstruction-vs-memory trade-off.

### How do you tell subsequence problems from substring/subarray problems?

Subsequence keeps relative order but allows gaps (LCS, LIS) — the recurrence can "skip" an element by carrying a previous state forward. Substring/subarray requires contiguity — a mismatch or break *resets* the running state to zero rather than inheriting a neighbor's. Longest common *substring* uses `dp[i][j] = dp[i-1][j-1]+1` on match but `0` on mismatch (versus LCS's `max` inheritance). Spotting which one the prompt wants determines whether your transition inherits or resets, and it is a frequent source of wrong answers.

### A senior follow-up: how would you approach a DP problem you have never seen before?

Match it to the nearest archetype by its *shape*, not its story. Ask: what am I choosing (subset, ordering, partition, path)? What must the state remember (an index, a remaining budget, a visited set, a range)? That maps onto knapsack, LIS/LCS, interval DP, bitmask, or tree DP. Write the recurrence from the archetype, adapt the transition to the twist, compute `states x transition` to sanity-check feasibility, then decide top-down vs bottom-up and whether space can be squeezed. If `n` is tiny, suspect bitmask; if the input is two sequences, suspect an LCS-style grid; if it is a range, suspect interval DP.

## Graph Traversal & Topological Sort

### Summary

**What this topic covers**
Systematic ways to visit every vertex/edge of a graph and the structural facts those traversals reveal. Breadth-first search (BFS) and depth-first search (DFS) are the two engines; on top of them sit connected components, topological sort, cycle detection, bipartite checking, and edge classification. All run in O(V + E) on an adjacency-list graph — the traversal is cheap; the value is what you *extract* while traversing.

**Key terms**
*BFS* — level-order traversal using a queue; finds shortest paths in *unweighted* graphs. *DFS* — go-deep traversal using recursion or an explicit stack. *Connected component* — a maximal set of mutually reachable vertices (undirected). *Topological sort* — a linear ordering of a DAG where every edge points forward. *DAG* — directed acyclic graph. *Kahn's algorithm* — BFS-based topological sort using in-degrees. *Back edge* — an edge to an ancestor in the DFS tree, the signature of a cycle in a directed graph. *Bipartite* — vertices 2-colorable with no same-color edge. *Strongly connected* (directed) — mutually reachable both directions.

**Core mechanics**
BFS: enqueue the source, mark visited, dequeue and enqueue unvisited neighbors; the visit order is by increasing distance, giving shortest hop counts. DFS: recurse into an unvisited neighbor, backtrack when stuck; naturally produces a DFS tree with discovery/finish times. Both are O(V + E) with adjacency lists (each vertex and edge touched once), O(V^2) with an adjacency matrix. Topological sort two ways: *Kahn's* — repeatedly emit a zero-in-degree vertex and decrement its neighbors' in-degrees (a queue); if you emit fewer than V vertices, a cycle exists. *DFS-based* — push each vertex onto a stack on finish, then reverse. Cycle detection: undirected — any edge to an already-visited non-parent vertex; directed — a back edge to a vertex currently on the recursion stack ("gray" node). Bipartite check: BFS/DFS 2-coloring, conflict on a same-colored edge means not bipartite.

**Trade-offs**
BFS gives shortest unweighted paths and finds them level by level but can hold a wide frontier in memory (up to O(V)). DFS uses stack-depth memory (O(V) worst case, but often less) and is the natural fit for topological order, cycle detection, and edge classification — but recursion can overflow the stack on deep graphs (use an explicit stack). Kahn's vs DFS topological sort: Kahn's detects cycles cleanly (count check) and is iterative; DFS is terse and gives finish-time structure for free. Neither BFS nor DFS handles weighted shortest paths — that is Dijkstra/Bellman-Ford territory.

**Common confusions**
Using BFS for shortest paths on a *weighted* graph — it only works when all edge weights are equal. Directed vs undirected cycle detection: the directed case needs the *on-stack* (recursion-stack) distinction, not merely "visited", because a cross edge to a finished vertex is not a cycle. Forgetting the parent exception in undirected cycle detection (the edge back to your parent is not a cycle). Assuming topological sort is unique — it is generally not; many valid orders exist. Thinking a graph with a cycle has a topological order — it does not; topo sort requires a DAG.

**Why interviewers ask**
Graph traversal is the substrate for a huge fraction of real problems — dependency resolution, build systems, scheduling, deadlock detection, network reachability. Interviewers check that you pick BFS vs DFS for the right reason, know the O(V + E) bound and why, and can layer a structural query (cycle, order, component, coloring) on top of a bare traversal. The classic escalation is "now detect a cycle" or "now produce a valid build order".

### When should you use BFS versus DFS?

Use BFS when you need shortest paths in an *unweighted* graph, level-by-level processing, or the minimum number of steps — its queue visits vertices in nondecreasing distance from the source. Use DFS when you need to go deep: topological sort, cycle detection, edge classification, connected components, or exploring all paths. DFS uses recursion-stack memory proportional to depth; BFS uses queue memory proportional to the frontier width. Both are O(V + E); the choice is about what structure you need, not speed.

### Why are BFS and DFS both O(V + E)?

Each vertex is marked visited and processed exactly once — O(V). For each vertex you scan its adjacency list, and across all vertices that scans every edge once (undirected: twice) — O(E). Summing gives O(V + E). This holds for adjacency-list representation. With an adjacency matrix, finding a vertex's neighbors costs O(V) regardless of edge count, making traversal O(V^2) — which is why sparse graphs use adjacency lists.

### How do you find connected components in an undirected graph?

Iterate over all vertices; whenever you hit an unvisited one, launch a BFS or DFS from it, marking everything reachable with the same component id, then increment the id. Each traversal captures one maximal mutually-reachable set. Total cost O(V + E) because every vertex and edge is touched once across all the traversals combined. For the directed analogue (strongly connected components) you need Tarjan's or Kosaraju's algorithm, not a plain traversal.

### Explain Kahn's algorithm for topological sort.

Compute every vertex's in-degree. Enqueue all zero-in-degree vertices (no prerequisites). Repeatedly dequeue a vertex, append it to the output, and decrement each neighbor's in-degree; when a neighbor's in-degree hits zero, enqueue it. Continue until the queue empties. It is O(V + E): each vertex enqueued once, each edge relaxed once. If the output contains fewer than V vertices, some vertices never reached in-degree zero — they are trapped in a cycle, so no topological order exists.

### How does DFS produce a topological ordering?

Run DFS; when a vertex *finishes* (all its descendants are fully explored), push it onto a stack. After visiting every vertex, pop the stack — that reversed finish-time order is a valid topological sort. Correctness: a vertex finishes only after all vertices it points to have finished, so it lands *before* them in the reversed order, meaning every edge points forward. It is O(V + E). To also detect cycles here, track on-stack vertices and flag any back edge.

### How do you detect a cycle in a directed graph?

Do a DFS with three vertex states: unvisited (white), in the current recursion stack (gray), and fully finished (black). If DFS reaches a gray vertex — one currently on the recursion stack — you have found a back edge, which means a cycle. Reaching a black vertex is fine (it is a cross or forward edge, not a cycle). The gray/on-stack distinction is essential: plain "visited/not-visited" cannot tell a genuine cycle from a harmless edge into an already-finished subtree. Alternatively, run Kahn's and check if it emits fewer than V vertices.

### How does cycle detection differ for undirected graphs?

In an undirected graph you DFS/BFS and treat *any* edge to an already-visited vertex as a cycle — *except* the edge back to the vertex you just came from (your parent), which is the same undirected edge, not a cycle. So you pass the parent down and skip it. (With a union-find structure you can alternatively detect a cycle by finding an edge whose endpoints already share a set.) The directed case is harder because it needs the recursion-stack state; the undirected case only needs visited-plus-parent.

### Why can't plain "visited" tracking detect cycles in directed graphs?

Because a directed edge into an already-visited vertex is not necessarily a cycle. If that vertex is fully *finished* (its whole subtree explored and popped), the edge is a cross or forward edge and closes no loop. A cycle exists only when the edge targets a vertex still *on the recursion stack* — an ancestor. So you must distinguish "visited and still open" (gray) from "visited and done" (black). Collapsing both into one "visited" flag produces false positives.

### How do you check whether a graph is bipartite?

Attempt a 2-coloring. BFS or DFS from each unvisited vertex, coloring the source, then coloring every neighbor the opposite color of the current vertex. If you ever find an edge whose endpoints already share a color, the graph is not bipartite. If you finish with no conflict, it is. O(V + E). Equivalent statement: a graph is bipartite iff it has no odd-length cycle, which is exactly what a coloring conflict during traversal reveals. Remember to start a fresh traversal per component so disconnected parts are all checked.

### What are the DFS edge classifications and what does each mean?

Relative to the DFS tree: *tree edges* are the edges DFS traverses to reach unvisited vertices (they form the DFS forest). *Back edges* go to an ancestor (a gray/on-stack vertex) — their presence means a cycle in directed graphs. *Forward edges* go to an already-finished descendant. *Cross edges* connect vertices in different subtrees or previously finished ones (neither ancestor nor descendant). Undirected graphs only ever have tree and back edges. Edge classification underpins cycle detection, strongly-connected-component algorithms, and bridge/articulation-point finding.

### Is a topological ordering unique?

Generally no. Whenever two vertices have no directed path between them, they can appear in either relative order, so a DAG usually has many valid topological sorts. It is unique only when the DAG has a Hamiltonian path — a single chain forcing a total order (in Kahn's terms, exactly one vertex has in-degree zero at every step). Interviewers use this to check you understand that "a valid order" is not "the order"; a specific one may require a tie-breaking rule (e.g. lexicographically smallest via a priority queue in Kahn's).

### Can you run topological sort on a graph with a cycle?

No — topological sort is defined only for a DAG. A cycle makes a consistent forward ordering impossible: each vertex in the cycle would have to come before another that comes before it. Both algorithms *detect* this rather than fail silently: Kahn's emits fewer than V vertices (the cyclic ones never reach in-degree zero), and DFS-based sorting finds a back edge. That detection is often the actual goal — e.g. reporting a circular dependency in a build graph.

### How does BFS give shortest paths, and when does that break?

In BFS the queue processes vertices in nondecreasing order of distance from the source, so the first time you reach a vertex is via a minimum-hop path — record distance as parent-distance + 1. This is exact for *unweighted* graphs (or graphs where every edge has equal weight). It breaks the moment edges have differing weights: a two-hop path can be cheaper than a one-hop path, which BFS cannot see. Then you need Dijkstra (non-negative weights) or Bellman-Ford (negative weights allowed). A special case, 0-1 BFS with a deque, handles weights of only 0 and 1.

### How would you detect deadlock or a circular dependency in a real system with these tools?

Model resources/tasks as vertices and "waits-for" or "depends-on" relationships as directed edges, then run directed cycle detection (DFS with on-stack tracking, or Kahn's and check the emitted count). A cycle is precisely a deadlock or a circular dependency. This is how build systems order compilation (topological sort of the dependency DAG) and how schedulers flag unsatisfiable job graphs. If you also want to *report* the offending loop, keep parent pointers during DFS and walk back from the vertex where the back edge closed to reconstruct the cycle.

### A senior follow-up: how do you avoid stack overflow when DFS-ing a very deep or large graph?

Convert the recursion to an explicit stack. Push the start vertex; loop while the stack is non-empty, popping a vertex and pushing its unvisited neighbors. For post-order needs (topological sort, finish times) either push each vertex twice with an "entering/leaving" marker, or track an iterator/index per stack frame so you resume a vertex's neighbor scan after processing a child. This trades the bounded call stack for a heap-allocated stack that can grow to O(V), sidestepping the language's recursion-depth limit on graphs with long paths (deep chains, near-linked-list shapes).

## Shortest Path Algorithms

### Summary

**What this topic covers**
This topic is the family of algorithms that find shortest paths in graphs: BFS for unweighted graphs, Dijkstra for non-negative weights, Bellman-Ford for graphs with negative edges (and negative-cycle detection), Floyd-Warshall for all-pairs, and A* for goal-directed search with a heuristic. The mental model: each one is a disciplined way of relaxing edges — improving a tentative distance `d[v]` whenever a shorter route through some `u` is discovered — and they differ mainly in the *order* in which they process vertices and the assumptions that order relies on.

**Key terms**
*Edge relaxation* — the operation `if d[u] + w(u,v) < d[v]: d[v] = d[u] + w(u,v)`. *Non-negative weights* — no edge weight below 0; the precondition Dijkstra needs. *Negative cycle* — a cycle whose total weight is negative; makes "shortest path" undefined (you can loop forever getting shorter). *Single-source* — shortest paths from one origin to all vertices. *All-pairs* — shortest paths between every ordered pair. *Admissible heuristic* — an A* estimate `h(v)` that never overestimates the true remaining distance. *Priority queue / min-heap* — the structure Dijkstra and A* use to always expand the closest unfinished vertex (see the Data Structures primer for the heap itself).

**Core mechanics**
BFS explores in layers, so on an unweighted graph the first time you reach a vertex is via a shortest path: `O(V + E)`. Dijkstra generalizes this — pop the closest unsettled vertex from a min-heap, settle it, relax its edges: `O((V + E) log V)` with a binary heap. Its invariant: when a vertex is popped, its distance is final, which holds *only* if no negative edge can later undercut it. Bellman-Ford instead relaxes *every* edge `V-1` times: `O(V*E)`; after `V-1` rounds all shortest paths (which have at most `V-1` edges) are found, and a `V`-th round that still relaxes something proves a negative cycle. Floyd-Warshall is dynamic programming over an intermediate-vertex set: `O(V^3)` time, `O(V^2)` space. A* is Dijkstra with priority `f(v) = g(v) + h(v)`, steering the search toward the goal.

**Trade-offs**
BFS is fastest but only correct when every edge costs the same. Dijkstra is the default for a single source with non-negative weights — near-linear, but it *cannot* handle negatives. Bellman-Ford is slower (`O(V*E)`) but tolerates negative edges and detects negative cycles — the price you pay for that generality. Floyd-Warshall wins when you need *all pairs* on a small/dense graph and love its three-line simplicity; on sparse graphs, running Dijkstra from each source (`O(V*(V+E) log V)`) usually beats `O(V^3)`. A* can be dramatically faster than Dijkstra with a good heuristic but degrades to Dijkstra when `h = 0`.

**Common confusions**
The big one: "just add a constant to make all weights non-negative, then run Dijkstra." That breaks — adding a constant penalizes paths with more edges unequally, changing which path is shortest. Another: thinking Dijkstra detects negative cycles (it doesn't; it can silently return wrong answers). Confusing "settled" with "visited" — a vertex can be pushed to the heap multiple times; it's *final* only when popped. Believing A* is always optimal — it is only when the heuristic is admissible (and consistent, for the graph-search version). Forgetting Floyd-Warshall's loop order: the intermediate vertex `k` must be the *outermost* loop.

**Why interviewers ask**
Shortest paths test whether you can match an algorithm to graph properties rather than reflexively reaching for one tool. The classic follow-up chain: "unweighted?" → BFS; "non-negative weights?" → Dijkstra; "negative edges?" → Bellman-Ford; "all pairs on a dense graph?" → Floyd-Warshall; "huge grid with a goal?" → A*. It also probes whether you understand *why* Dijkstra's greedy choice is correct and *why* it fails on negatives — a real understanding-vs-memorization signal.

### What does it mean to relax an edge, and why is it the core operation?
Relaxing edge `(u, v)` means: if the best known distance to `u` plus the edge weight beats the best known distance to `v`, update `d[v] = d[u] + w(u,v)` and record `u` as `v`'s predecessor. Every shortest-path algorithm here is just a policy for *which edges to relax and in what order*. BFS relaxes in layer order, Dijkstra in increasing-distance order, Bellman-Ford relaxes everything repeatedly. Correctness reduces to: by the time you finalize a vertex, all edges that could improve it have already been relaxed.

### Why does plain BFS give shortest paths on an unweighted graph?
BFS processes vertices in non-decreasing order of distance from the source — layer 0, then all layer-1 vertices, then layer-2, and so on. Because every edge has the same cost, the first time BFS reaches a vertex it must be via a minimum-hop path; any later route would go through a same-or-farther layer and can't be shorter. It runs in `O(V + E)` and needs only a FIFO queue, no priority queue.

### How does Dijkstra's algorithm work, step by step?
Initialize `d[source] = 0`, all others infinity, and push the source into a min-heap keyed by distance. Repeatedly pop the vertex `u` with the smallest tentative distance; if it's already settled, skip it. Otherwise settle it (its distance is now final) and relax each outgoing edge, pushing any improved neighbor back into the heap. Continue until the heap empties (or you pop the target). With a binary heap the cost is `O((V + E) log V)`; with a Fibonacci heap it's `O(E + V log V)` in theory, though binary heaps win in practice.

### Why does Dijkstra require non-negative edge weights?
Dijkstra's correctness rests on the greedy invariant: the closest unsettled vertex can be finalized because no *future* path could reach it more cheaply. A negative edge violates this — you might settle `v` at distance 5, then later discover a path through a not-yet-settled vertex plus a negative edge that reaches `v` at distance 3. Since Dijkstra never revisits a settled vertex, it locks in the wrong 5. No amount of re-pushing fixes the fundamental ordering assumption.

### Can't I just add a constant to every weight to remove negatives and then use Dijkstra?
No. Adding a constant `c` to each edge adds `c * (number of edges)` to a path's total, so paths with more edges are penalized more than paths with fewer. This can change which path is actually shortest, giving a wrong answer. (The correct reweighting is Johnson's algorithm, which uses Bellman-Ford to compute vertex potentials `h(v)` and reweights edges as `w(u,v) + h(u) - h(v)` so path comparisons are preserved.)

### How does Bellman-Ford work and what's its complexity?
Bellman-Ford relaxes *all* `E` edges, and repeats that pass `V-1` times. Any shortest path has at most `V-1` edges, and after `i` passes every shortest path using at most `i` edges is correct, so `V-1` passes settle everything. Total time is `O(V*E)`, space `O(V)`. It's slower than Dijkstra but makes no sign assumption about weights, which is exactly why it's the go-to when negative edges are present.

### How does Bellman-Ford detect a negative cycle?
After the `V-1` relaxation passes, run one more pass. If any edge can *still* be relaxed (some `d[v]` still decreases), then a shortest path with `V` edges appears to beat one with `V-1` — impossible in a graph without a negative cycle. So a successful relaxation on the `V`-th pass proves a negative cycle is reachable, and you can trace predecessor pointers back into it to report the cycle itself.

### What is a negative cycle and why does it make shortest paths ill-defined?
A negative cycle is a closed loop whose edge weights sum to less than zero. If such a cycle is reachable from the source and can reach the target, there is no shortest path: each extra lap around the cycle lowers the total distance without bound, so the infimum is negative infinity. Algorithms must therefore either assume no negative cycle (Dijkstra) or explicitly detect one (Bellman-Ford, Floyd-Warshall) rather than return a meaningless number.

### How does Floyd-Warshall compute all-pairs shortest paths?
It's DP over an allowed set of intermediate vertices. `dist[i][j]` starts as the direct edge weight (or infinity). Then for each intermediate vertex `k`, update every pair: `dist[i][j] = min(dist[i][j], dist[i][k] + dist[k][j])`. The invariant after iteration `k`: `dist[i][j]` is the shortest path using only intermediates from `{0..k}`.

```python
for k in range(n):
    for i in range(n):
        for j in range(n):
            if dist[i][k] + dist[k][j] < dist[i][j]:
                dist[i][j] = dist[i][k] + dist[k][j]
```

It runs in `O(V^3)` time and `O(V^2)` space, and a negative `dist[i][i]` afterward flags a negative cycle.

### Why must the intermediate-vertex loop be the outermost loop in Floyd-Warshall?
Because the DP recurrence depends on having fully computed shortest paths through `{0..k-1}` before considering `k`. Putting `k` innermost would let you use `k` as an intermediate before its own via-lower-vertices distances are finalized, producing wrong results. The order encodes the subproblem dependency: "add one more allowable intermediate vertex at a time."

### When would you run Floyd-Warshall versus Dijkstra from every source?
Floyd-Warshall is `O(V^3)` regardless of density and is trivially simple to code, so it shines on small or dense graphs, or when you literally need the full distance matrix (e.g. transitive closure, graph diameter). Running Dijkstra from each source is `O(V * (V + E) log V)`, which is far better on large *sparse* graphs. Rough rule: dense or small → Floyd-Warshall; large and sparse (and non-negative weights) → repeated Dijkstra; large sparse *with negatives* → Johnson's algorithm.

### What is A* and how does it differ from Dijkstra?
A* is Dijkstra with a goal-directed twist: it orders the frontier by `f(v) = g(v) + h(v)`, where `g(v)` is the known cost from the source and `h(v)` is a heuristic estimate of the remaining cost to the goal. Dijkstra is exactly A* with `h(v) = 0` — it expands uniformly in all directions. A good heuristic makes A* expand mostly toward the goal, so it can settle far fewer vertices, which matters on big grids and maps.

### What makes an A* heuristic admissible, and why does it matter?
A heuristic is *admissible* if it never overestimates the true remaining cost: `h(v) <= actualDistance(v, goal)` for all `v`. Admissibility guarantees A* returns an optimal path, because it never prematurely discards a route that could still turn out cheapest. A stronger property, *consistency* (`h(u) <= w(u,v) + h(v)`), additionally guarantees each vertex is expanded at most once in graph search — the analogue of Dijkstra's "settle once" property. Straight-line (Euclidean) distance is a classic admissible heuristic for maps.

### How do you reconstruct the actual path, not just its length?
Keep a `predecessor` (parent) array: whenever relaxing `(u, v)` improves `d[v]`, set `parent[v] = u`. At the end, walk `parent` pointers from the target back to the source and reverse the list. This works uniformly across BFS, Dijkstra, Bellman-Ford, and A*. For Floyd-Warshall you keep a `next[i][j]` matrix (the first hop from `i` toward `j`) and follow it forward.

### An interviewer says weights can be negative but there are no negative cycles, and the graph is large and sparse — what do you use?
Johnson's algorithm. Add a virtual source connected to every vertex with weight-0 edges, run Bellman-Ford once from it to get potentials `h(v)`, then reweight every edge to `w(u,v) + h(u) - h(v)` — now all non-negative and preserving shortest-path orderings — and finally run Dijkstra from each real source on the reweighted graph. Total `O(V*E + V*(V+E) log V)`, which beats Floyd-Warshall's `O(V^3)` on sparse graphs while still handling negatives.

### How would you find the shortest path in a DAG, and can you beat Dijkstra?
Yes. In a directed acyclic graph, process vertices in topological order and relax each one's outgoing edges as you go. Because a vertex is only relaxed after every predecessor is finalized, one linear sweep suffices — `O(V + E)`, beating Dijkstra's log factor, and it works with negative weights too (a DAG can't contain a cycle, so no negative cycle is possible). This is the standard trick for shortest/longest paths in DAG-structured DP.

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
