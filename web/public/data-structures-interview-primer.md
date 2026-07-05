---
type: interview-prep
---

# Data Structures Interview Primer — 324 Questions

The foundational structures reference for the Data Structures & Algorithms track — the classic curriculum from arrays to graphs to the advanced structures, concept-first and interview-focused. Where the Patterns primer drills algorithmic recognition and NeetCode 150 / LeetCode Design give worked problems, this primer is the layer underneath: what each structure is, how it works in memory, its real complexity, the trade-offs, and the reasoning for "which structure would you use for X". Each topic opens with a Summary (mental model, key terms, core mechanics, trade-offs, common confusions, why interviewers ask) then runs ~15 question cards from warm-up to senior follow-up.

1. [[#Data Structures Foundations & Complexity]]
2. [[#Arrays & Dynamic Arrays]]
3. [[#Strings]]
4. [[#Linked Lists]]
5. [[#Stacks]]
6. [[#Queues & Deques]]
7. [[#Hash Tables]]
8. [[#Sets & Maps]]
9. [[#Trees & Traversals]]
10. [[#Binary Search Trees]]
11. [[#Balanced BSTs]]
12. [[#Heaps & Priority Queues]]
13. [[#Tries (Prefix Trees)]]
14. [[#Graphs]]
15. [[#Union-Find (Disjoint Set Union)]]
16. [[#Segment Trees & Fenwick Trees (BIT)]]
17. [[#Skip Lists & Balanced-Tree Alternatives]]
18. [[#Probabilistic Data Structures]]
19. [[#B-Trees & B+ Trees]]
20. [[#Specialized & Composite Structures]]
21. [[#Choosing the Right Data Structure — Interview Playbook]]

## Data Structures Foundations & Complexity

### Summary

**What this topic covers**
This is the mental model that makes every later structure make sense: the separation between an *abstract data type* (the contract — what operations exist and what they promise) and an *implementation* (the concrete memory layout and code that fulfils that contract), plus the complexity language you use to reason about both. A "stack" is an ADT: push, pop, peek, LIFO order. It can be implemented on an array or a linked list, with wildly different constants but the same interface. Interviewers live in this gap: "which structure" is really "which implementation of which ADT, given these access patterns."

**Key terms**
*ADT* — an interface plus behavioural guarantees (List, Map, Set, Queue, Stack). *Implementation* — the data layout realising it (array, hash table, red-black tree). *Big-O* — asymptotic upper bound on growth as input size n goes to infinity. *Big-Theta* — tight bound (both upper and lower). *Amortized* — average cost per operation across a sequence, even if individual ops spike. *Space complexity* — extra memory beyond the input. *In-place* — O(1) auxiliary space. *Cache locality* — how well access patterns exploit CPU cache lines.

**Core mechanics**
Big-O drops constants and lower-order terms: `3n^2 + 5n + 100` is `O(n^2)`. It describes scaling, not absolute speed — an `O(n)` scan of a contiguous array often beats an `O(log n)` walk of a pointer-chasing tree at realistic n because of cache behaviour. Complexity classes ranked: `O(1)` < `O(log n)` < `O(n)` < `O(n log n)` < `O(n^2)` < `O(2^n)` < `O(n!)`. Amortized analysis (aggregate, accounting, or potential method) proves that expensive operations are rare enough that the *sequence* averages out — the canonical case being dynamic-array doubling.

**Trade-offs**
The universal tension is time vs space and read-speed vs write-speed. A hash table buys `O(1)` average lookup with extra memory (load factor headroom) and lost ordering. A sorted array gives `O(log n)` search but `O(n)` insert. Contiguous memory (arrays) wins on cache locality and random access; pointer-based memory (linked lists, trees) wins on cheap splicing and growth without reallocation. There is rarely a strictly best structure — only the best fit for a given read/write/order/memory profile.

**Common confusions**
Big-O is a worst-case *bound*, not the actual runtime, and not the average — candidates conflate all three. Amortized O(1) is not the same as always-O(1): a single append can be O(n). Dropping constants is legitimate asymptotically but dangerous operationally — a "slower" O(n) algorithm frequently beats an O(log n) one in practice. And "space" means *auxiliary* space: recursion stack frames count, so a "no extra memory" recursive solution using O(log n) stack depth is not truly in-place.

**Why interviewers ask**
This is the foundation that reveals whether you *reason* about structures or just memorised a table. The classic angle: "you need fast lookups by key and ordered iteration — what do you use, and why not just a hash map?" A strong candidate names the ADT, picks an implementation, states the complexity of each operation you'll actually perform, and justifies the trade-off against the specific access pattern — rather than reflexively reaching for the structure they know best.

### What is the difference between an abstract data type and a data structure?

An ADT is a *specification*: a set of operations and the guarantees they make, independent of implementation. "Queue" is an ADT — enqueue, dequeue, FIFO order. A data structure is the *concrete realisation*: the memory layout and algorithms that satisfy that contract. A queue can be implemented with a ring buffer (array) or a linked list; both honour the ADT but differ in cache behaviour, memory overhead, and constant factors. Thinking in this two-layer way lets you swap implementations without touching callers, and lets you answer "which structure" by first pinning down the contract.

### What does Big-O notation actually measure?

Big-O describes how an algorithm's resource use (time or space) grows as input size n grows, as an asymptotic upper bound. It deliberately ignores constant factors and lower-order terms because those are dwarfed as n increases — `O(n^2)` will eventually dominate `O(n)` regardless of constants. Crucially it measures *scaling*, not wall-clock speed, and it's typically stated for the worst case unless you say otherwise. It answers "how does this degrade as the problem gets bigger", which is exactly what matters when you can't predict production data sizes.

### Why do we drop constants and lower-order terms in Big-O?

Because asymptotic analysis is about behaviour as n approaches infinity, where the highest-order term dominates. In `2n^2 + 100n + 500`, once n is large the `n^2` term swamps everything, so we call it `O(n^2)`. Constants are dropped because they're implementation- and hardware-dependent — the *class* of growth is what's portable across machines. The caveat: at the small or medium n you actually run in production, those "ignored" constants can decide the winner, so Big-O guides architecture, not micro-optimisation.

### What is the difference between Big-O, Big-Theta, and Big-Omega?

Big-O is an upper bound (grows *no faster than*), Big-Omega is a lower bound (grows *no slower than*), and Big-Theta is a tight bound (both — the function is sandwiched). Saying an algorithm is `O(n^2)` is technically true even if it's actually `O(n)`, because O is just an upper bound; `Theta(n)` is the precise claim. In interviews people say "O" but usually mean the tight bound. Being able to distinguish them signals rigour — e.g. comparison sorting is `Omega(n log n)`, a *lower* bound proving you can't do better.

### What is amortized complexity and how does it differ from average-case?

Amortized complexity is the average cost per operation *across a worst-case sequence* of operations — it's a guarantee, not a probabilistic average. Average-case, by contrast, assumes a probability distribution over inputs and can be defeated by an adversary. Dynamic-array append is amortized O(1): even though occasional appends trigger an O(n) resize, the total cost of n appends is O(n), so each averages to O(1) with no assumptions about input distribution. Amortized bounds hold even for the most hostile sequence; average-case bounds don't.

### Give an example where an O(n) algorithm beats an O(log n) one in practice.

Searching a small-to-medium array. A linear scan of a contiguous array is `O(n)` but streams sequential memory that the CPU prefetches into cache lines, running at near-memory-bandwidth. A binary search tree lookup is `O(log n)` but chases pointers to scattered heap addresses, each a potential cache miss costing hundreds of cycles. For a few thousand elements the linear scan often wins outright. This is why real libraries switch algorithms by size (e.g. insertion sort under a threshold) — asymptotics tell you the crossover exists, not where it is.

### What is space complexity, and does the call stack count?

Space complexity measures the *auxiliary* memory an algorithm needs beyond its input, as a function of input size. And yes — the recursion call stack absolutely counts. A recursive traversal that appears to allocate nothing still uses O(depth) stack space: O(log n) for a balanced tree, O(n) for a degenerate one or an unbalanced recursion. This is why a "no extra data structures" recursive solution isn't necessarily O(1) space, and why converting recursion to iteration with an explicit stack doesn't magically reduce space — it just moves it to the heap.

### What does "in-place" mean, and is it the same as O(1) space?

In-place means an algorithm transforms its input using only O(1) auxiliary space — it mutates the given array/structure rather than allocating a proportional copy. It's often treated as synonymous with O(1) space, though some definitions permit O(log n) (e.g. quicksort's recursion stack is sometimes still called "in-place"). The distinction matters: in-place saves memory but usually destroys the original input, which is a real trade-off when the caller still needs it. Reversing an array by swapping ends inward is the textbook in-place, O(1)-space operation.

### How do you decide which data structure to use for a problem?

Start from the *access pattern*, not the structure. Ask: what operations dominate (lookup by key, lookup by index, insert at ends vs middle, min/max, range queries, ordered iteration)? What are their frequencies? Do you need ordering? What's the memory budget? Then match: frequent key lookups with no ordering → hash table; ordered lookups + range queries → balanced BST or sorted array; repeated min/max extraction → heap; LIFO/FIFO → stack/queue; index access + append → dynamic array. The structure falls out of the profile; leading with "I always use a HashMap" is the anti-pattern.

### What is cache locality and why does it matter more than Big-O sometimes?

Cache locality is how well an access pattern reuses data already in fast CPU cache. Modern memory hierarchies make a cache hit ~1ns and a main-memory miss ~100ns — a 100x gap that Big-O ignores entirely. Contiguous structures (arrays) exhibit *spatial locality*: accessing one element pulls neighbouring elements into the same cache line, so the next access is nearly free. Pointer-based structures scatter data across the heap, so each hop risks a miss. This is why an array-backed structure with "worse" asymptotics routinely outperforms a theoretically superior pointer-based one.

### What is the difference between value semantics and reference semantics?

With value semantics, assigning or passing a variable copies the whole value — mutating the copy leaves the original untouched (primitives everywhere; structs in C#/Go/Rust; all objects in C++ by default). With reference semantics, the variable holds a handle to shared underlying data, so two references see each other's mutations (objects in Java/Python/JavaScript). This governs correctness and cost: value semantics avoids aliasing bugs but copies can be O(n); reference semantics is cheap to pass but invites accidental shared-state mutation. Knowing which your language uses for a given type is essential to reasoning about a structure's real cost.

### Why can two implementations of the same ADT have very different performance?

Because the ADT only fixes the *interface and guarantees*, not the memory layout — and layout drives constants, cache behaviour, and even which operations are cheap. A List ADT backed by a dynamic array gives O(1) random access but O(n) middle insertion; backed by a doubly linked list it gives O(1) splice-at-a-node but O(n) indexing. Same contract, inverted performance profile. This is the whole point of the ADT/implementation split: you pick the implementation whose cheap operations match your hot path.

### What complexity classes should you recognise on sight, from best to worst?

`O(1)` constant (hash lookup, array index), `O(log n)` logarithmic (binary search, balanced tree ops), `O(n)` linear (a single scan), `O(n log n)` linearithmic (efficient comparison sorts, heap-building a sorted output), `O(n^2)` quadratic (nested loops over the input, naive pair comparisons), `O(2^n)` exponential (subset enumeration, naive recursion without memoisation), and `O(n!)` factorial (permutation generation, brute-force travelling salesman). Recognising these instantly lets you sanity-check a solution: if you've written triple-nested loops over n, you know you're at `O(n^3)` and should look for a better structure.

### An interviewer says your solution is "O(n) space" — you thought it was O(1). Where might the hidden space be?

Several usual suspects. Recursion: your call stack is O(depth). Slicing/substrings: many languages copy on slice, so `arr[1:]` in a loop is silently O(n) per call. Building an output collection: if you return a new array/map of size proportional to input, that's O(n) output space (sometimes excluded, sometimes not — clarify). Hidden allocations: string concatenation in a loop, boxing of primitives, or an intermediate hash set for deduplication. The fix is to walk through *every* allocation, including implicit ones the language performs, rather than counting only the variables you explicitly declared.

### How do you reason about the complexity of a solution that combines multiple structures?

Add sequential phases, multiply nested ones, and take the max when one dominates. If you build a hash map in O(n), then for each of n elements do an O(log n) heap operation, total is `O(n) + O(n log n) = O(n log n)` — the dominant term wins. Nested loops multiply: an outer O(n) loop each doing an O(n) inner scan is O(n^2). Watch for hidden multipliers inside library calls (a `contains` on a list is O(n), turning an innocent loop into O(n^2)). State each phase's cost explicitly, then combine — this is exactly the reasoning interviewers want narrated aloud.

## Arrays & Dynamic Arrays

### Summary

**What this topic covers**
The array is the foundational contiguous structure and the one every other structure is built on or compared against. This topic covers the fixed-size array (a constant-length block of contiguous memory) and the dynamic array (a growable wrapper — Java's `ArrayList`, C++'s `vector`, Python's `list`, Go's slice) that gives you append-as-you-go while preserving the array's killer feature: O(1) random access. The core magic to understand is how a dynamic array delivers amortized O(1) append on top of a fixed-size backing store.

**Key terms**
*Contiguous memory* — elements laid out back-to-back at computable addresses. *Random access* — reading index i in O(1) via `base + i * elementSize`. *Capacity* vs *size* — the backing array's allocated length vs the number of elements currently in use. *Resize/grow* — allocating a larger backing array and copying elements over. *Growth factor* — the multiplier (usually 1.5x or 2x) applied on resize. *Slice/view* — a window over an existing array's memory without copying. *Amortized O(1)* — the average append cost across many appends.

**Core mechanics**
An array's elements sit at consecutive addresses, so index i is a single arithmetic computation and a load — genuinely O(1), no traversal. A dynamic array keeps a backing array plus a `size` counter. Append writes to `backing[size]` and increments — O(1) — until `size == capacity`. Then it allocates a new array (typically 2x capacity), copies all n elements over (O(n)), and appends. Because capacity grows geometrically, resizes get rarer as the array grows, so the copies amortize to O(1) per append. Insert/delete at index i is O(n) because the tail must shift.

**Trade-offs**
Arrays win decisively on random access (O(1) vs a linked list's O(n)) and cache locality (contiguous = prefetcher-friendly). They lose on middle insertion/deletion (O(n) shifting vs a linked list's O(1) splice at a known node) and on growth: a resize is an O(n) copy and can briefly hold both old and new arrays (up to ~3x peak memory with 2x growth). Dynamic arrays also carry slack — allocated-but-unused capacity — trading memory for amortized-cheap appends. For index-heavy, append-heavy, iteration-heavy workloads the array is almost always the right default.

**Common confusions**
Candidates say "arrays are O(1)" without distinguishing access (O(1)) from insert/delete (O(n)). They forget that append is amortized O(1), not worst-case O(1) — a single append can trigger an O(n) resize. They assume removing from the end and the middle cost the same (end is O(1), middle is O(n)). And they conflate `size` with `capacity`, or think shrinking is automatic (most implementations never shrink the backing array unless you ask). Slices confuse too: a slice often *shares* memory with its parent, so mutating one can mutate the other.

**Why interviewers ask**
Arrays are the substrate of the whole interview — two pointers, sliding window, in-place partitioning all live here — so mastery is table stakes. The signature question is "why is append amortized O(1)?", which tests whether you understand geometric growth and amortized analysis rather than reciting a cheat sheet. The follow-ups probe whether you know when the array's O(n) middle-insert bites, when you'd reach for a linked list or deque instead, and whether you understand the memory cost of growth. It separates people who *use* arrays from people who *understand* them.

### What makes array random access O(1)?

Because elements are stored contiguously and are all the same size, the address of index i is computed directly as `base_address + i * element_size` — one multiplication and one addition, then a single memory load. There's no traversal, no searching; the position is arithmetic. This is the array's defining superpower and the reason it underpins so many other structures. It's also why arrays require fixed-size elements (or fixed-size pointers to variable-size data): variable-size elements would break the constant-time address calculation.

### Why is appending to a dynamic array O(1) amortized but O(n) worst case?

Most appends just write to the next free slot and bump a counter — O(1). But when the backing array is full, the dynamic array allocates a bigger one (usually 2x) and copies all n existing elements — that single append is O(n). The trick is that doubling makes resizes exponentially rare: to reach size n you copy roughly `n + n/2 + n/4 + ... ≈ 2n` elements *total* across all resizes, so n appends cost O(n) total, i.e. O(1) each on average. Amortized O(1), worst-case O(n) for the unlucky append that triggers the copy.

### Why does the growth factor matter, and why 2x or 1.5x specifically?

The growth factor trades wasted memory against resize frequency. It must be greater than 1 for appends to amortize to O(1) — additive growth (e.g. "+10 each time") gives O(n) amortized because resizes stay frequent. 2x is simple and gives few resizes but can waste up to ~50% memory and needs up to 3x peak during a copy. 1.5x (used by many `vector` implementations) wastes less and, with some allocators, allows reusing previously freed blocks since `1.5^k` sums can fit in prior gaps that 2x can't. Both are geometric, so both preserve amortized O(1); the choice is a memory-vs-frequency tuning knob.

### What is the difference between an array's size and its capacity?

Size is the number of elements currently stored and visible to the user; capacity is the length of the underlying backing array — how many elements it *could* hold before needing to resize. A dynamic array with size 5 might have capacity 8, meaning three slots are allocated but unused. Appends are cheap while `size < capacity`; the expensive resize happens only when they're equal. This slack is the memory price you pay for amortized-O(1) appends, and it's why iterating should use size, never capacity.

### Why is inserting into the middle of an array O(n)?

Because contiguity must be preserved: to insert at index i, every element from i to the end must shift one position right to open a gap, and there are up to n such elements. Deletion from the middle is symmetric — everything after the removed slot shifts left to close the gap. Only insertion/deletion at the *end* avoids shifting (O(1) amortized). This O(n) middle cost is the array's central weakness and the reason a linked list or a balanced structure can win when middle mutations dominate.

### When would you choose a linked list over a dynamic array?

Rarely, and only for specific patterns: when you frequently insert or delete at *known positions* in the middle (a linked list splices in O(1) once you hold the node) and you don't need random access by index. Real examples: an LRU cache's recency list, or a structure where you hold node references and constantly move elements between positions. But if you have to *search* for the position first, that's O(n) and the linked list's advantage evaporates — plus its per-node pointer overhead and cache-hostile scattering usually make a dynamic array or deque faster in practice. Default to the array; justify the list.

### What is a slice or view, and how does it differ from a copy?

A slice (Go slice, Python's `memoryview`, Rust's `&[T]`, a NumPy view) is a lightweight descriptor — a pointer, a length, and often a capacity — that references a window into an existing array's memory *without copying it*. Creating one is O(1). The consequence is aliasing: mutating through the slice mutates the underlying array and any other slice over the same region. A copy, by contrast, allocates fresh O(n) memory and is independent. The gotcha is that languages differ — Python's `list[1:]` copies, but NumPy's `arr[1:]` is a view — so you must know your language's semantics to avoid surprise mutations or surprise costs.

### How are multidimensional arrays laid out in memory?

Two ways. *Row-major* (C, C++, Python NumPy default) stores each row contiguously — element `[i][j]` sits at `base + (i * ncols + j) * size`. *Column-major* (Fortran, MATLAB, R) stores each column contiguously. The layout dictates which traversal order is cache-friendly: in row-major, iterating the inner (column) index in the inner loop streams sequential memory and is fast; iterating rows in the inner loop strides across memory and thrashes the cache. Getting the loop nesting to match the layout can be a several-x speedup with identical Big-O — a classic performance gotcha.

### What is the difference between a true 2D array and an array of arrays?

A true 2D array is a single contiguous block of `rows * cols` elements with computed offsets — one allocation, perfect locality (C's `int a[3][4]`, NumPy 2D). An array of arrays (a "jagged" array — Java's `int[][]`, most row-of-rows in managed languages) is an array of *pointers*, each pointing to a separately-allocated row that may live anywhere on the heap. The jagged form allows ragged rows and cheap row swaps (swap pointers) but costs an extra indirection per access and scatters rows across memory, hurting cache locality. Knowing which your language gives you explains surprising performance differences.

### Does removing the last element of a dynamic array shrink its capacity?

Almost never automatically. Most implementations (Java `ArrayList`, C++ `vector`, Python `list`) keep the backing capacity after removals to avoid thrashing — repeatedly shrinking then growing would destroy the amortized guarantees. So a list that grew to a million then shrank to ten still holds a million-slot backing array until you explicitly release it (`trimToSize()`, `shrink_to_fit()`, reassigning). This is a real memory leak vector in long-lived structures: the size is tiny but the retained capacity is huge. Amortized-O(1) append is bought partly by *not* shrinking eagerly.

### How do you delete from an array in O(1) if you don't care about order?

Swap the target element with the last element, then remove the last (which is O(1) — no shifting). This "swap-and-pop" turns an O(n) middle deletion into O(1) at the cost of destroying element order. It's a staple trick for unordered collections, object pools, and entity systems where you just need *a* fast-removable bag. If order must be preserved you're back to O(n) shifting — so the technique is a direct trade of ordering for speed.

### Why can a resize temporarily use 3x the array's memory?

During a growth resize, the old backing array still exists (holding n elements) while the new one is allocated (holding 2n capacity) and elements are copied across. For the duration of the copy, both live simultaneously: n (old) + 2n (new) = 3x the logical data size in peak resident memory. This transient spike matters for large arrays near a memory ceiling — a resize of a structure using 40% of RAM can OOM even though the final footprint fits. It's an argument for pre-sizing (`reserve`/`ensureCapacity`) when you know the target size, which skips the intermediate resizes entirely.

### What is the benefit of pre-allocating capacity when you know the size?

If you know you'll append n elements, calling `reserve(n)` / `ensureCapacity(n)` / `make([]T, 0, n)` allocates the full backing array once up front. This eliminates every intermediate resize — no repeated O(n) copies, no memory spikes, no reallocation churn — turning n appends into n genuine O(1) writes. The total work drops from "sum of geometric copies" to a single allocation plus n writes. It's one of the cheapest, highest-leverage optimisations for hot append loops, and interviewers like to see you reach for it when the final size is known or bounded.

### Why are arrays more cache-friendly than pointer-based structures?

Because contiguity gives spatial locality: when the CPU loads one element it pulls the surrounding cache line (typically 64 bytes) into fast cache, so the next several sequential accesses are essentially free. Iterating an array streams predictably, letting the hardware prefetcher stay ahead. A linked list or tree scatters nodes across the heap, so each hop is a potential cache miss (~100x slower than a hit) and the prefetcher can't guess where the next node lives. This is why arrays routinely beat asymptotically-comparable pointer structures in real benchmarks — the constant hidden inside "O(n) traversal" is far smaller for the array.

### How would you implement a dynamic array from scratch, and what invariants must you maintain?

Hold a backing array, a `capacity`, and a `size`. Invariants: `0 <= size <= capacity`, elements `[0, size)` are valid, and `[size, capacity)` are unused slack. `get(i)`/`set(i)` bounds-check against size then index the backing array — O(1). `append(x)`: if `size == capacity`, allocate a new array of `capacity * 2` (or an initial small constant like 4 or 8 if empty), copy elements over, then write `backing[size] = x` and increment size. `removeLast` decrements size (optionally nulling the slot to avoid holding a reference). The whole design rests on geometric growth to keep append amortized O(1); linear growth would break the invariant that resizes stay rare.

### An interviewer asks how Python's list, Java's ArrayList, and Go's slice differ under the hood. What's the answer?

All three are dynamic arrays over a contiguous backing store, but the details differ. Python's `list` stores an array of *pointers* to boxed objects (so it's heterogeneous but every element is an indirection), over-allocates on a mild growth schedule, and never auto-shrinks. Java's `ArrayList` stores an `Object[]` (also references, with boxing for primitives — hence `int[]` vs `ArrayList<Integer>` performance gaps), grows ~1.5x, and doesn't auto-shrink. Go's slice is a value struct `{pointer, len, cap}` over a backing array of *inline* values (no boxing), grows ~2x then ~1.25x for large sizes, and — critically — slices can *share* backing arrays, so appending to one slice can mutate another or trigger a copy depending on capacity. The shared-backing semantics of Go slices is the classic gotcha the interviewer is fishing for.

## Strings

### Summary

**What this topic covers**
Strings look like a primitive but are a data structure: a sequence of characters, almost always backed by a contiguous array of code units. This topic covers how strings are laid out, the pivotal decision of *immutability vs a mutable buffer*, the encoding layer (bytes vs code points vs grapheme clusters) that trips up length and indexing, and why naive string building is a hidden O(n^2) trap. Strings are where "an array of chars" collides with "human text is more complicated than that".

**Key terms**
*Code unit* — the fixed-size storage element (a byte in UTF-8, a 16-bit unit in UTF-16). *Code point* — one Unicode scalar value (may span multiple code units). *Grapheme cluster* — what a user perceives as one character (may span multiple code points, e.g. an emoji with a skin-tone modifier). *Immutable string* — cannot be modified after creation; "edits" produce new strings. *StringBuilder/buffer* — a mutable, growable char array for efficient assembly. *Interning* — deduplicating identical string values to one shared instance. *Rope* — a tree of string fragments for cheap concatenation/edits.

**Core mechanics**
A string is typically a length plus a contiguous block of code units — so indexing a *code unit* is O(1), just like an array. Immutable strings (Java, C#, Python, JavaScript) can never change in place, which makes them safely shareable, hashable, and interbable but means every "modification" allocates a new string and copies. Mutable buffers (`StringBuilder`, Go's `strings.Builder`, a `char[]`) grow like a dynamic array, giving amortized O(1) append and turning O(n^2) concatenation into O(n). Encoding sits underneath: in UTF-8 a code point is 1-4 bytes, so byte-length, code-point-count, and grapheme-count are three different numbers.

**Trade-offs**
Immutability buys safety (no aliasing surprises), free sharing, cache-able hash codes, and thread-safety, at the cost of allocation churn on edits. Mutable buffers buy cheap in-place assembly at the cost of the safety guarantees. Contiguous storage gives O(1) indexed access and great locality but makes substring/insert O(n) (copy); a rope inverts that — O(log n) concatenation and edits at the cost of slower indexing and worse locality. UTF-8 is compact for ASCII and byte-oriented; UTF-16 gives "constant-size" units only if you ignore surrogate pairs (you shouldn't).

**Common confusions**
The big one: `length` is not the number of user-visible characters. In UTF-16 languages `"😀".length == 2` (a surrogate pair); byte length, code-point count, and grapheme count all differ. Candidates index into strings assuming one unit = one character and corrupt multibyte text. They build strings with `s += x` in a loop, unaware each `+=` copies the whole string (O(n^2) total). They think substring is free — in many languages it's an O(n) copy. And they assume `==` compares content when in some languages it compares references unless interned.

**Why interviewers ask**
Strings are the most common interview substrate — parsing, sliding windows, palindromes — so the mechanics matter, and the immutability/encoding subtleties separate people who've shipped real i18n-aware software from those who haven't. The signature trap is the O(n^2) concatenation loop: do you reach for a `StringBuilder`? The signature depth question is Unicode: do you know that "reverse a string" can shatter an emoji if you reverse code units? It reveals both your grasp of array-backed structures and your awareness that real-world text is messier than `char[]`.

### Is a string just an array of characters?

Mechanically, mostly yes — a string is a length plus a contiguous array of fixed-size code units, which is why indexed access is O(1). But two things complicate the "just an array" view. First, most modern strings are *immutable*, so unlike an array you can't assign to `s[i]`. Second, one code unit isn't necessarily one character: with UTF-8 or UTF-16, a single user-perceived character can span multiple units, so "the i-th character" and "the i-th code unit" diverge. So: array-backed, yes; a plain mutable char array, no.

### What does it mean for a string to be immutable, and why do languages do it?

Immutable means the string's contents can never change after construction — any operation that appears to modify it (concatenation, replace, uppercase) actually allocates and returns a *new* string, leaving the original intact. Java, C#, Python, and JavaScript all do this. The motivations: strings can be freely shared without defensive copies, used safely as hash-map keys (their hash never changes and can be cached), interned/deduplicated, and passed across threads without locking. The cost is allocation churn — repeated edits create garbage — which is exactly why every such language also ships a mutable builder.

### Why is building a string with repeated concatenation in a loop O(n^2)?

Because strings are immutable, each `result += chunk` doesn't append in place — it allocates a brand-new string and copies *all* the existing characters plus the new ones. If you do this n times with growing content, you copy roughly `1 + 2 + 3 + ... + n ≈ n^2/2` characters total: O(n^2). The fix is a mutable buffer (`StringBuilder`, `strings.Builder`, `"".join(list)`), which grows like a dynamic array with amortized O(1) appends, making the whole assembly O(n). Spotting and fixing this loop is one of the most common string interview signals.

### How does a StringBuilder achieve efficient appends?

It's a dynamic array of characters under the hood: a growable backing buffer plus a length. Appending writes into the free space at the end — O(1) — and when the buffer fills, it grows geometrically (typically doubling), copying the contents once. By the same amortized argument as a dynamic array, n characters' worth of appends cost O(n) total instead of the O(n^2) you'd get from immutable concatenation. Only when you're done do you materialise the final immutable string in a single O(n) copy. It trades the immutable string's safety for mutable, cheap assembly during the build phase.

### What is the difference between a byte, a code unit, a code point, and a grapheme cluster?

A *byte* is 8 bits of raw storage. A *code unit* is the fixed-size element of an encoding — 1 byte in UTF-8, a 16-bit unit in UTF-16. A *code point* is a single Unicode scalar value (like U+0041 'A' or U+1F600 '😀') and may require multiple code units to encode. A *grapheme cluster* is what a human calls "one character" and may combine multiple code points — an emoji with a skin-tone modifier, or a base letter plus a combining accent. Length and indexing give different answers at each level, which is the root of most string bugs.

### What is UTF-8 and why is it so widely used?

UTF-8 is a variable-width encoding of Unicode: a code point takes 1 to 4 bytes, with ASCII (U+0000–U+007F) encoded as a single byte identical to its ASCII value. This ASCII-compatibility means existing ASCII text is already valid UTF-8, and byte-oriented code often "just works". It's compact for Latin text, has no byte-order-mark ambiguity, and is self-synchronising (you can find character boundaries from any byte). The trade-off is that indexing the k-th *code point* is O(n) — you must scan from the start because characters aren't fixed-width — which is why UTF-8 strings are byte-indexed, not character-indexed.

### Why does `"😀".length` return 2 in JavaScript and Java?

Because both use UTF-16 internally, and the emoji U+1F600 lies outside the Basic Multilingual Plane, so it's encoded as a *surrogate pair* — two 16-bit code units. `.length` counts code units, not code points or user-perceived characters, so it reports 2. This is the canonical Unicode gotcha: indexing `str[0]` gives you half a surrogate pair (a meaningless lone surrogate), and naive iteration or reversal splits the emoji. To count actual characters you iterate code points (e.g. `[...str]` in JS, `codePointCount` in Java) or, for true user-perceived characters, grapheme clusters via a segmentation library.

### Why is taking a substring not always O(1)?

Because in most modern languages a substring is a *copy*: it allocates a new string and copies the selected O(k) characters, so it's O(k) time and space. Older Java (pre-7u6) shared the parent's char array so substring was O(1) — but that caused memory leaks (a tiny substring pinned a huge parent array alive), which is exactly why they changed it to copy. Some languages/types (Rust's `&str` slices, Go's string slicing, C++ `string_view`) give you O(1) *views* that share memory instead of copying — fast, but they alias the parent's lifetime. So the cost depends entirely on whether your language copies or views.

### What is string interning and when is it useful?

Interning stores only one canonical copy of each distinct string value in a pool, so all equal strings become the *same* object. It's enabled by immutability (a shared instance can't be mutated out from under you). Benefits: memory savings when the same values recur (identifiers, enum-like tags, parsed tokens), and O(1) equality via reference comparison instead of O(n) character comparison. Java auto-interns string literals and offers `String.intern()`; Python interns short/identifier-like literals. The trap is that interned-ness is inconsistent — `==` in Java may pass for literals but fail for runtime-built strings — so you must still use `.equals()` for correctness.

### What is a rope and when would you use one instead of a flat string?

A rope is a binary tree whose leaves hold small string fragments and whose internal nodes store the length of their left subtree. It represents a large string as a structure of pieces rather than one contiguous block. This makes concatenation O(1) or O(log n) (just create a parent node — no copying) and insert/delete in the middle O(log n), versus O(n) for a flat string. The costs are O(log n) indexed access instead of O(1), worse cache locality, and per-node overhead. Ropes shine in text editors and version-control diffs — anywhere you edit huge strings frequently — but for typical short strings a flat contiguous string wins on simplicity and locality.

### What is the complexity of common string operations?

For a contiguous immutable string of length n: indexed access to a code unit is O(1); length is O(1) (stored). Concatenation is O(n + m) (must copy both). Substring is O(k) for the k-length result (copy) in copying languages, O(1) for view types. Search (naive `indexOf`) is O(n*m) worst case, O(n + m) with KMP/Boyer-Moore. Comparison/equality is O(n) worst case (O(1) to fail on length mismatch or first differing char). Building via immutable concatenation in a loop is O(n^2); via a builder it's O(n). Knowing these lets you avoid the quadratic traps.

### How do you reverse a string correctly when it contains emoji or accents?

Not by reversing code units — that shatters surrogate pairs (splitting an emoji into garbage) and detaches combining marks from their base characters (an accent lands on the wrong letter). Correct reversal operates on *grapheme clusters*: segment the string into user-perceived characters (using a Unicode segmentation library — `Intl.Segmenter` in JS, ICU elsewhere), then reverse that sequence. Reversing code points is better than code units (keeps emoji intact) but still breaks combining sequences. This question is a favourite because "reverse a string" sounds trivial until Unicode makes it genuinely hard.

### Why should you compare strings with `.equals()` rather than `==` in Java?

Because `==` compares object references (identity), not content, and two strings with identical characters can be distinct objects. String literals are interned so `"foo" == "foo"` happens to be true, but a runtime-constructed string (`new String("foo")`, or one built from input) is a different object, so `== "foo"` is false even though the text matches. `.equals()` compares character by character and gives the answer you actually want. Languages differ here — Python's `==` compares content, but relying on identity (`is`) for strings is the analogous mistake — so knowing your language's semantics is essential.

### How does hashing an immutable string benefit from immutability?

Because the string's contents can never change, its hash code is a stable function of those contents — so it can be *computed once and cached*. Java's `String` does exactly this: the first `hashCode()` call computes the O(n) hash and stores it; every subsequent call is O(1). This is a major reason immutable strings are ideal hash-map keys: the key's hash is fixed and cached, lookups don't recompute it, and there's no risk of a key mutating after insertion and landing in the wrong bucket (a classic bug with mutable keys). Immutability makes the string safe *and* fast as a key.

### When would you deliberately choose a mutable char buffer over immutable strings?

Whenever you're assembling or repeatedly editing text in a hot path: parsing and building output, constructing large payloads, streaming transformations, or any loop that would otherwise trigger O(n^2) immutable concatenation. The mutable buffer (`StringBuilder`, `strings.Builder`, `char[]`, `bytearray`) gives amortized O(1) appends and in-place edits, then you freeze it into an immutable string once at the end. You accept losing thread-safety and free sharing *during* the build phase in exchange for eliminating allocation churn. The rule of thumb: immutable for storing and passing strings around, mutable buffer for building them.

## Linked Lists

### Summary

**What this topic covers**
A linked list stores a sequence as a chain of independently allocated nodes, each holding a value plus one or more pointers to its neighbours. Unlike an array, the elements are not contiguous in memory — the structure IS the pointers. The mental model: you never index into a linked list, you *walk* it, following references one hop at a time from a head pointer.

**Key terms**
*Node* — a value plus pointer(s). *Head* — pointer to the first node; *tail* — the last. *Singly linked* — each node points only to `next`; *doubly linked* — nodes also point to `prev`. *Circular* — the tail's `next` points back to the head (or a doubly-linked ring) rather than to null. *Sentinel* (or *dummy*) node — a placeholder node that is never data, used to avoid null-checking edge cases. *Splice* — relinking pointers to insert or remove a node in O(1).

**Core mechanics**
Each node is a separate heap allocation, so nodes scatter across memory. To reach index k you follow `next` k times: O(n) random access, no arithmetic shortcut. But if you already *hold* a node reference, insert and delete are O(1) — you rewire two or four pointers, no shifting. In a singly linked list, deleting a node requires its predecessor (to fix `prev.next`), which is why doubly linked lists are common: they let you splice out any node given only that node. The head pointer is the invariant you must never lose; a dropped head leaks the whole list.

**Trade-offs**
Versus a dynamic array: linked lists win at O(1) insert/delete *at a known position* and never need reallocation/copy, so they suit queues, LRU caches, and adjacency lists. They lose almost everywhere else. Random access is O(n). Every node costs an extra 8-16 bytes of pointer overhead plus an allocator header, and the scattered layout destroys cache locality — iterating a linked list can be 10-100x slower than iterating an array of the same length even though both are O(n). In practice, "use a dynamic array unless you have a specific reason not to."

**Common confusions**
Candidates claim "linked list insertion is O(1)" without the caveat: it's O(1) only if you already have the node/position — *finding* the position is still O(n). They forget that deleting the tail of a singly linked list is O(n) (you need the predecessor). They lose the list by reassigning `head` before saving `head.next` during a reversal. And many believe linked lists are faster than arrays for "lots of inserts" — usually false once cache effects dominate.

**Why interviewers ask**
Linked lists are the classic test of pointer discipline: can you manipulate references without losing the list, drawing the before/after pointer diagram in your head? Reversal, cycle detection, and merge are pointer-choreography puzzles that reveal whether you reason about aliasing and edge cases (empty list, single node, operating on the head). The dummy-node trick and the two-pointer technique are the tells that separate someone who has internalised the structure from someone reciting it.

### What is a linked list and how does it differ from an array?

A linked list is a chain of nodes, each holding a value and a pointer to the next node; the list is defined entirely by these pointers. An array stores elements in one contiguous block. The consequence: arrays give O(1) indexed access via address arithmetic but O(n) insert/delete in the middle (shifting); linked lists give O(1) splice at a known node but O(n) access because you must walk from the head. Arrays also have far better cache locality.

### What's the difference between singly, doubly, and circular linked lists?

A singly linked list's node points only forward (`next`), so you can traverse in one direction and need a node's predecessor to delete it. A doubly linked list adds a `prev` pointer, enabling backward traversal and O(1) deletion of any node you hold, at the cost of an extra pointer per node and two extra links to maintain per operation. A circular list makes the last node point back to the first (rather than null), which is handy for round-robin scheduling or ring buffers where "wrap around" is natural.

### Why is random access O(n) in a linked list?

Because there is no address arithmetic. In an array, element k lives at `base + k * size`, computed in one step. Linked list nodes are scattered across the heap, so the only way to reach the k-th node is to start at the head and follow `next` k times. There is no shortcut, and no amount of caching the layout helps because the layout can change on any insert.

### If insertion is O(1), why do people say linked lists are slow?

The O(1) only applies once you're *at* the insertion point holding the relevant node. Getting there is O(n). On top of that, each node is a separate allocation with pointer overhead and poor cache locality, so walking a linked list touches a fresh cache line per node and stalls on memory. A contiguous array, even doing O(n) shifts, often beats a linked list on real hardware because it streams through cache. Big-O hides the constant factors that dominate here.

### What is a sentinel (dummy) node and why use one?

A sentinel is a non-data placeholder node — typically a dummy head (and sometimes a dummy tail) — that always exists so the "real" list never has a null boundary. It eliminates special-casing: inserting or deleting at the front becomes identical to doing it in the middle because there's always a predecessor node to relink. In interview code, `dummy = Node(); dummy.next = head; ... return dummy.next` removes a whole class of head-pointer edge-case bugs.

### How do you reverse a singly linked list?

Walk the list maintaining three pointers — `prev`, `curr`, `next` — and flip each link as you go:

```python
prev = None
curr = head
while curr:
    nxt = curr.next   # save before we clobber it
    curr.next = prev  # reverse the link
    prev = curr
    curr = nxt
return prev           # new head
```

It's O(n) time, O(1) space. The classic bug is not saving `curr.next` before overwriting it, which severs the rest of the list.

### How do you detect a cycle in a linked list?

Use Floyd's tortoise-and-hare: advance a slow pointer one node and a fast pointer two nodes per step. If they ever meet, there's a cycle; if fast reaches null, there isn't. It's O(n) time and O(1) space. The alternative — a hash set of visited nodes — is also O(n) time but O(n) space, so Floyd's is preferred when space matters.

### Why does Floyd's algorithm's fast pointer eventually meet the slow one?

Once both pointers are inside the cycle, the fast pointer gains one node of ground on the slow pointer every step (it moves 2, slow moves 1, net +1). In a cycle of length L, the gap shrinks by one each step and is bounded by L, so they must coincide within L steps — the fast pointer can never "jump over" the slow one because the gap changes by exactly one at a time.

### How do you find the node where a cycle begins?

After the tortoise and hare meet inside the cycle, reset one pointer to the head and advance both one step at a time; they meet at the cycle's entry node. This falls out of the distance arithmetic: the distance from the head to the entry equals the distance from the meeting point to the entry (modulo the cycle length). It's the standard follow-up to plain cycle detection.

### How do you find the middle of a linked list in one pass?

Two-pointer again: a slow pointer moves one node, a fast pointer two nodes; when fast reaches the end, slow is at the middle. One traversal, O(n) time, O(1) space, no need to count the length first. For even-length lists, decide up front whether you want the lower or upper middle — the loop condition (`fast and fast.next`) controls which.

### How do you delete a node given only a pointer to it (not the head)?

For a middle node in a singly linked list, you can't fix the predecessor's `next`, so instead copy the *next* node's value into the current node and delete the next node — effectively "becoming" your successor. This is O(1) but has two caveats: it fails for the tail node (no successor to copy), and it's semantically dodgy if other references point at the specific node object. A doubly linked list avoids the trick entirely.

### When would you choose a linked list over a dynamic array in production?

When you need frequent O(1) insertion/deletion at positions you already hold references to, and you don't need random access — e.g. an LRU cache (doubly linked list of usage order, spliced on every access), a scheduler's run queue, or the intrusive lists used in kernels. Also when you specifically must avoid the reallocation/copy spikes of a growing array. Otherwise, default to a dynamic array.

### What is an intrusive linked list?

An intrusive list stores the `next`/`prev` pointers *inside* the data object itself rather than in separate node wrappers. This avoids a second allocation per element and lets the same object live in multiple lists simultaneously (one set of links per list). It's common in high-performance systems code (the Linux kernel's `list_head` is the canonical example) because it eliminates allocation overhead and indirection.

### How do you merge two sorted linked lists?

Use a dummy head and a `tail` pointer; repeatedly attach whichever of the two current nodes is smaller, advancing that list, until one runs out, then attach the remainder. It's O(n + m) time and O(1) extra space because you're relinking existing nodes, not copying — one of the places a linked list genuinely shines over arrays, which would need to shift or allocate. This is also the merge step of a linked-list merge sort.

### Why is merge sort often preferred over quicksort for linked lists?

Merge sort only needs sequential access and O(1) splicing to combine sublists, both of which linked lists do cheaply, and it needs no random access or auxiliary array — you rewire pointers in place for O(1) extra space (ignoring recursion). Quicksort relies on efficient random access for partitioning and good cache behaviour, neither of which a linked list provides, so its advantages evaporate. Merge sort is also stable, which is frequently desired.

## Stacks

### Summary

**What this topic covers**
A stack is a last-in, first-out (LIFO) collection: you add and remove only at one end, the "top". Think of a stack of plates — you take the one you put down most recently. It's an abstract data type defined by its two core operations, `push` and `pop`, not by any particular implementation; both arrays and linked lists can back it.

**Key terms**
*Push* — add an element to the top. *Pop* — remove and return the top element. *Peek* (or *top*) — read the top without removing it. *LIFO* — last-in-first-out ordering. *Stack overflow* — pushing past a bounded stack's capacity (or blowing the call stack via runaway recursion). *Stack underflow* — popping an empty stack. *Monotonic stack* — a stack kept sorted (increasing or decreasing) by popping violators, used for "next greater element"-style problems.

**Core mechanics**
Every operation touches only the top, so `push`, `pop`, and `peek` are all O(1). Backed by a dynamic array, the top is the array's end: push appends, pop truncates — O(1) amortized, with the occasional O(n) resize on growth. Backed by a singly linked list, push/pop happen at the head — always O(1), no resize, but with per-node allocation overhead and worse locality. The array version is the default in practice because of cache friendliness. The invariant is simply that you only ever access the most recently added, still-present element.

**Trade-offs**
Array-backed: excellent locality, amortized O(1), but resize spikes and a fixed capacity if you preallocate. Linked-list-backed: true worst-case O(1) push/pop and unbounded growth without copying, but pointer overhead and cache misses. Versus a queue, a stack reverses processing order — choosing between them is choosing whether the most-recent or least-recent item should be handled next. A stack uses O(n) space for n elements either way; the choice is about constant factors and worst-case guarantees.

**Common confusions**
Candidates conflate the *stack data structure* with the *call stack* (the region of memory holding function-call frames) — related concept, different things. They forget to check for underflow before popping. In monotonic-stack problems they struggle to decide whether to keep an increasing or decreasing stack and whether to store values or indices (usually indices). And some assume a stack must be a linked list; it's an ADT, and array backing is more common and faster.

**Why interviewers ask**
Stacks reveal whether you recognise LIFO structure in disguise — balanced parentheses, expression evaluation, DFS, undo/redo, backtracking, and the recursion-to-iteration conversion all reduce to a stack. The monotonic stack in particular is a favourite because it turns naive O(n^2) scans ("for each element find the next greater one") into O(n), and spotting that opportunity is a strong senior signal. It's a small ADT with outsized problem-solving leverage.

### What is a stack and what are its core operations?

A stack is a LIFO collection supporting `push` (add to top), `pop` (remove from top), and usually `peek`/`top` (read the top without removing) and `isEmpty`. All are O(1). The defining property is that the element removed is always the one added most recently — order of removal is the reverse of order of insertion.

### How do you implement a stack with an array vs a linked list?

Array-backed: keep a dynamic array; push appends to the end, pop removes the last element, top is the last index. Operations are O(1) amortized (with occasional resize). Linked-list-backed: push and pop at the head node, each O(1) worst case with no resizing. The array version has better cache locality and is the usual default; the linked version guarantees no resize pause and grows without copying. Both are O(n) space.

### Why is a dynamic-array stack O(1) amortized rather than always O(1)?

Because pushes occasionally trigger a resize: when the backing array fills, it allocates a larger array (typically double) and copies the existing elements, an O(n) operation. But doubling means resizes get geometrically rarer, so the O(n) cost is spread across many O(1) pushes — averaged over any sequence of operations, each push is O(1). Any single push, though, can be O(n) in the worst case.

### What's the difference between the stack data structure and the call stack?

The call stack is a specific region of memory the runtime uses to manage function calls — each call pushes a *stack frame* (return address, parameters, locals) and each return pops one. It *is* a stack, structurally, which is why they share a name, but it's a concrete machine mechanism, whereas the stack data structure is a general ADT you use in your own code. Deep or infinite recursion overflows the call stack; that's a different thing from overflowing a stack object you allocated.

### How does a stack relate to recursion?

Recursion uses the call stack implicitly: each recursive call pushes a frame holding that call's state. Any recursive algorithm can be rewritten iteratively with an explicit stack that stores the same state you'd otherwise keep in frames. This is how you convert, say, a recursive DFS into an iterative one, or avoid a stack-overflow crash on deep inputs by moving the recursion onto the heap.

### How would you check if a string of brackets is balanced?

Scan left to right; push every opening bracket; on a closing bracket, pop and check it matches the expected opener. The string is balanced if every close matches (and the stack isn't empty when you hit a closer) and the stack is empty at the end. O(n) time, O(n) space. The stack naturally captures the "most recently opened must close first" nesting rule — pure LIFO.

### How do you evaluate an arithmetic expression using stacks?

For postfix (Reverse Polish), scan tokens: push operands; on an operator, pop the top two, apply, push the result — the final stack value is the answer. For infix, the shunting-yard algorithm uses an operator stack plus precedence rules to convert to postfix (or evaluate directly). Stacks work because operator application is inherently LIFO: the most recently seen operands and operators bind first.

### What is a monotonic stack and what problem does it solve?

A monotonic stack keeps its elements in sorted order (strictly increasing or decreasing) by popping any element that would violate the order before pushing the new one. It solves "nearest greater/smaller element" families — next greater element, daily temperatures, largest rectangle in a histogram, stock span — in O(n) total instead of the naive O(n^2), because each element is pushed and popped at most once.

### Walk through a monotonic stack for "next greater element".

Iterate the array keeping a stack of *indices* whose "next greater" is still unknown, maintained so their values are decreasing. For each new value, while the value at the stack's top index is smaller, pop it and record the current value as its answer (it just found its next greater element); then push the current index. Anything left on the stack at the end has no greater element to its right. Each index is pushed and popped once, so O(n).

### Why store indices rather than values in a monotonic stack?

Indices give you both the value (via a lookup) and the position, so you can compute distances/widths — e.g. "how many days until a warmer temperature" or the width of a histogram bar's rectangle — which value-only storage can't. It's strictly more information at the same cost, so indices are the safe default for these problems.

### How do you implement a min-stack (O(1) getMin)?

Keep a second stack that tracks the running minimum: on each push, push `min(newValue, currentMin)` onto the aux stack; on pop, pop both. `getMin` reads the top of the aux stack in O(1). It trades O(n) extra space for O(1) minimum queries. A space optimisation stores the min only when it changes, or encodes deltas, but the two-stack version is the clean, expected answer.

### What happens on stack overflow and underflow?

Underflow is popping or peeking an empty stack — your code should guard against it (return an error/None) rather than crash. Overflow, for a data-structure stack, means exceeding a fixed preallocated capacity (a dynamic-array stack instead resizes). The more famous "stack overflow" is the call stack running out of space — usually unbounded or too-deep recursion — which crashes the program; the fix is a base case, tail-call form, or an explicit heap stack.

### When would you use a stack in real systems, beyond interview puzzles?

Undo/redo histories (push each action; pop to undo), browser back navigation, expression and syntax parsing in compilers and calculators, the runtime call stack itself, DFS and backtracking (explicit stack), and "balancing"/matching problems like XML/HTML tag validation. Anywhere the rule is "handle the most recently added thing first", a stack is the natural fit.

### How do you implement DFS iteratively with a stack?

Push the start node; then loop: pop a node, process it if unvisited (marking it), and push its unvisited neighbours. This mirrors the recursive call stack explicitly, avoiding recursion-depth limits on large or deep graphs. Note the visit order differs slightly from recursive DFS depending on neighbour push order, and you typically mark visited on pop (or guard on push) to avoid reprocessing.

### Can a stack be implemented using two queues, and why would you?

Yes — it's a classic exercise demonstrating you understand both ADTs: you can make push O(1)/pop O(n) or push O(n)/pop O(1) by shuffling elements between two queues to reverse the ordering. In practice you'd never do this (a stack is trivial to implement directly), but it shows the ordering relationship between LIFO and FIFO and how one can simulate the other. The mirror problem — a queue from two stacks — is more genuinely useful.

## Queues & Deques

### Summary

**What this topic covers**
A queue is a first-in, first-out (FIFO) collection: you add at the back and remove from the front, like a line at a checkout. A deque (double-ended queue) generalises this to allow O(1) insertion and removal at *both* ends. Both are ADTs defined by where you're allowed to add and remove, independent of the backing store.

**Key terms**
*Enqueue* — add to the back; *dequeue* — remove from the front. *FIFO* — first-in-first-out. *Front/head* and *back/tail* — the two ends. *Deque* — double-ended queue; push/pop at either end. *Circular (ring) buffer* — a fixed-size array reused cyclically via modular indexing, so the queue "wraps around" instead of shifting. *Blocking queue* — a thread-safe queue where consumers block when empty and producers block when full. *Priority queue* — despite the name, ordered by priority not arrival, and is really a heap, not a true FIFO queue.

**Core mechanics**
Enqueue and dequeue are O(1). A naive array queue that dequeues by shifting everything left is O(n) — the fix is a circular buffer: keep `head` and `tail` indices and advance them modulo capacity, so no element ever moves. When `tail` catches `head`, the buffer is full (you distinguish full from empty with a count or a spare slot). A linked-list queue keeps a head pointer for dequeue and a tail pointer for enqueue, both O(1). A deque is typically a doubly linked list or a growable circular buffer so both ends are O(1). The invariant: elements leave in the same order they arrived (for a plain queue).

**Trade-offs**
Circular buffer: contiguous, cache-friendly, zero per-op allocation, but fixed capacity (must resize or reject when full) — ideal for bounded producer/consumer pipelines and streaming. Linked-list queue: unbounded and never resizes, but pointer overhead and cache misses. Versus a stack, a queue processes oldest-first — the right choice when fairness or arrival order matters (scheduling, BFS). A deque costs a little more per node than a singly linked queue but subsumes both stack and queue, so it's the pragmatic default in many standard libraries (Python's `collections.deque`).

**Common confusions**
Candidates implement an array queue with O(n) dequeue-by-shift and miss the circular-buffer fix. They mix up full-vs-empty detection in a ring buffer (both can show `head == tail`). They think a "priority queue" is a kind of FIFO queue — it's a heap ordered by priority. And they reach for a stack where BFS needs a queue (or vice versa), not realising the container choice alone flips a traversal between depth-first and breadth-first.

**Why interviewers ask**
Queues are the backbone of BFS, level-order traversal, and scheduling, so recognising "process in arrival order / explore level by level" and reaching for a queue is a core competency. The ring buffer tests whether you can implement O(1) operations with modular arithmetic and handle the fiddly full/empty boundary. The sliding-window-maximum problem, solved with a monotonic deque, is a favourite senior question because the naive solution is O(nk) and the deque solution is O(n) — spotting that is the payoff.

### What is a queue and what are its core operations?

A queue is a FIFO collection with `enqueue` (add to the back) and `dequeue` (remove from the front), plus usually `peek`/`front` and `isEmpty`. Elements are removed in the same order they were added — the oldest waiting element leaves next. All core operations are O(1) with a proper implementation. It's the natural structure whenever arrival order or fairness matters.

### How is a queue different from a stack?

Both restrict where you add and remove, but a stack is LIFO (add and remove at the same end — most recent leaves first) and a queue is FIFO (add at the back, remove from the front — oldest leaves first). That single difference changes processing order entirely: swap a stack for a queue in a graph traversal and DFS becomes BFS. Choose based on whether the most-recent or least-recent pending item should be handled next.

### Why is a naive array-based queue inefficient, and how do you fix it?

If you dequeue by removing index 0 and shifting every remaining element left, each dequeue is O(n). The fix is a circular (ring) buffer: keep separate `head` and `tail` indices and advance them modulo the array capacity, so dequeue just moves `head` forward and nothing shifts. That makes both enqueue and dequeue O(1). The cost is a fixed capacity you must manage (resize or reject when full).

### How does a circular buffer work?

You store elements in a fixed array and track a `head` (next to dequeue) and `tail` (next free slot). Enqueue writes at `tail` and does `tail = (tail + 1) % capacity`; dequeue reads at `head` and does `head = (head + 1) % capacity`. The indices wrap around the end of the array back to the start, so the physical storage is reused cyclically — no element ever moves, giving O(1) operations with perfect cache locality.

### How do you distinguish a full from an empty circular buffer?

The trap: both empty and full can produce `head == tail`. Three standard fixes: (1) keep an explicit `count` of elements and compare against capacity; (2) leave one slot always empty, so "full" is `(tail + 1) % capacity == head` (wastes one slot); or (3) keep separate ever-increasing read/write counters and take them modulo capacity for indexing. The count-based approach is the clearest and most common.

### What is a deque and when would you use one?

A deque (double-ended queue) supports O(1) insertion and removal at *both* the front and the back, generalising both stack and queue. Use it when you need to add/remove from either end — a work-stealing scheduler (push/pop your own end, steal from the other), an undo buffer with a size cap (drop from the far end), a browser history, or the sliding-window-maximum algorithm. Python's `collections.deque` and Java's `ArrayDeque` are the go-to implementations.

### How is a deque typically implemented?

Two common ways: a doubly linked list, where front and back both have direct pointers so all four operations (push/pop front/back) are trivially O(1); or a growable circular buffer (like Java's `ArrayDeque`), which gives O(1) amortized operations with far better cache locality and no per-element allocation. The circular-buffer version is usually faster in practice; the linked-list version guarantees no resize pauses and unbounded growth.

### Why does BFS use a queue?

BFS explores a graph level by level — all nodes at distance 1, then distance 2, and so on. A queue enforces exactly that order: you enqueue a node's neighbours when you visit it, and because it's FIFO, you finish processing everything at the current level before anything at the next level comes off the front. Swap the queue for a stack and you'd get DFS instead, because LIFO would dive down the most recently discovered branch first.

### How do you do a level-order tree traversal?

Enqueue the root; then loop while the queue is non-empty: to process one full level at a time, record the current queue size `n`, dequeue exactly `n` nodes, and enqueue each of their children. Each batch of `n` is one level. This is a direct application of BFS to a tree and is O(n) time, O(w) space where w is the maximum level width.

### What is the sliding-window-maximum problem and how does a deque solve it?

Given an array and a window of size k, report the maximum of each window as it slides. The naive approach rescans each window in O(nk). A monotonic deque of *indices*, kept so their values are decreasing, solves it in O(n): before adding a new index, pop smaller values from the back (they can never be the max while the new element is in-window); pop the front if it's slid out of the window; the front is always the current window's maximum. Each index is pushed and popped once.

### Why is the sliding-window-maximum deque monotonic decreasing?

Because if a new element is larger than elements sitting at the back of the deque, those smaller elements can never again be a window maximum — the new, larger element will be in every window they are, and it dominates. So we discard them immediately, keeping the deque decreasing from front to back. That guarantees the front is always the largest in-window element, readable in O(1).

### What is a priority queue and how is it different from a regular queue?

A priority queue removes the highest- (or lowest-) priority element next, regardless of insertion order — so it is *not* FIFO despite the name. It's almost always implemented as a binary heap, giving O(log n) insert and O(log n) remove-max/min with O(1) peek. Use it for scheduling by importance, Dijkstra's algorithm, or merging k sorted streams. A plain queue orders purely by arrival; a priority queue orders by a key.

### What is a blocking queue and where is it used?

A blocking queue is a thread-safe queue where `dequeue` blocks (waits) when the queue is empty and, if bounded, `enqueue` blocks when it's full. It's the backbone of the producer-consumer pattern: producers hand off work, consumers pull it, and the queue handles synchronisation and back-pressure so a fast producer can't overwhelm a slow consumer. Java's `BlockingQueue` implementations (`ArrayBlockingQueue`, `LinkedBlockingQueue`) are the canonical examples.

### What is back-pressure and how does a bounded queue provide it?

Back-pressure is a system slowing its producers when consumers can't keep up, preventing unbounded memory growth. A bounded queue provides it naturally: once full, it either blocks the producer (blocking queue) or rejects/drops the item, forcing the producer to wait or shed load rather than pile work into an ever-growing buffer. An unbounded queue offers no back-pressure and risks running out of memory under sustained overload — a common production failure mode.

### How would you implement a queue using two stacks?

Keep an `inbox` stack and an `outbox` stack. Enqueue pushes onto `inbox`. Dequeue pops from `outbox`; if `outbox` is empty, first pour all of `inbox` into it (which reverses the order, restoring FIFO), then pop. Each element is moved between stacks at most once, so dequeue is O(1) amortized even though a single transfer is O(n). It's a neat demonstration that two LIFO structures compose into a FIFO one.

### When would you pick a linked-list queue over a circular-buffer queue?

Choose the linked-list queue when the size is unpredictable or unbounded and you must never reject an item or pay a resize pause — it grows one node at a time with no copying. Choose the circular buffer when you have a known capacity bound, want maximum throughput and cache locality, and can apply back-pressure when full — typical in high-performance streaming, networking, and audio pipelines. The buffer wins on speed and locality; the list wins on unbounded flexibility.

## Hash Tables

### Summary

**What this topic covers**
A hash table stores key-value pairs (or just keys, for a hash set) in a backing array of `m` slots, using a hash function to convert each key into an index. The mental model: it trades memory for speed, turning a search that would be O(n) in a list into an expected O(1) lookup by computing "where should this live?" instead of scanning. Almost every language's dictionary/map/set is a hash table under the hood, so this is the highest-leverage data structure to understand cold.

**Key terms**
*Hash function* — maps a key to an integer, ideally spreading keys uniformly across `[0, m)`. *Bucket/slot* — an array index where entries land. *Collision* — two distinct keys hashing to the same slot. *Load factor* `alpha = n/m` — entries over capacity; the single knob that governs performance. *Separate chaining* — each slot holds a list of colliding entries. *Open addressing* — collisions are resolved by probing other slots; the entry lives directly in the array. *Rehash/resize* — rebuilding into a larger array when `alpha` gets too high. *Tombstone* — a "deleted" marker used in open addressing.

**Core mechanics**
Insert: compute `index = hash(key) mod m`, then place the entry. In chaining you append to the bucket's list; in open addressing you probe forward until you find an empty slot. Lookup: hash to a slot, then compare keys (hashes are lossy, so you must verify equality) either along the chain or along the probe sequence. The invariant that keeps it fast is a bounded load factor: keep `alpha` under ~0.75 (open addressing) or ~1.0 (chaining) and the expected chain/probe length stays O(1). Cross that threshold and you resize — allocate a bigger array (usually 2x) and reinsert every element, because indices depend on `m`.

**Trade-offs**
Hash tables give expected O(1) insert/lookup/delete but destroy ordering — you cannot ask for "the smallest key" or iterate in sorted order without an O(n log n) sort. A balanced BST gives O(log n) operations but keeps keys ordered and supports range queries. Chaining tolerates high load factors and simple deletion but costs a pointer-chase per lookup and poor cache locality. Open addressing is cache-friendly (everything's in one contiguous array) and pointer-free but degrades sharply as `alpha` approaches 1 and makes deletion awkward. Space overhead is real: you're always paying for empty slots to keep `alpha` low.

**Common confusions**
Candidates conflate O(1) *average* with O(1) *guaranteed* — worst case is O(n) when everything collides. Many forget that a good hash isn't enough: `mod m` with a bad `m` (or a power-of-two mask on low-entropy hashes) reintroduces clustering. People assume deletion in open addressing is "just clear the slot" — it isn't; that breaks probe chains, hence tombstones. And a classic senior trap: using a mutable object as a key, then mutating it, so its hash changes and the entry becomes unreachable.

**Why interviewers ask**
Hash tables are the workhorse behind "reduce this to O(n) with a set/map" — the single most common optimization in coding interviews. Asking about collisions, load factor, and resizing separates people who *use* dictionaries from people who *understand* them. The deep-cut questions (amortized analysis of resize, why hash DoS is a real attack, open vs chained) reveal whether a candidate can reason about the constant factors and failure modes that matter in production systems.

### What is a hash table and what problem does it solve?

A hash table stores key-value pairs in an array, using a hash function to compute an index from each key. It solves the "fast membership and lookup" problem: instead of scanning a list in O(n) to find a key, you compute its slot directly and check there, giving expected O(1) insert, lookup, and delete. That's why it's the default structure for dictionaries, caches, symbol tables, and deduplication.

### What makes a good hash function?

Three properties: it should be *deterministic* (same key always yields the same hash), *uniform* (keys spread evenly across the output range to minimize collisions), and *fast* to compute. Uniformity matters most — a hash that clusters keys into a few slots turns your O(1) table into an O(n) list. For adversarial settings you also want it to be hard to predict, so an attacker can't deliberately force collisions.

### What is a collision and why is it unavoidable?

A collision is when two distinct keys hash to the same slot. It's unavoidable because you're mapping a huge (often infinite) key space into a finite array of `m` slots — by the pigeonhole principle, once you have more possible keys than slots, some must share. The birthday paradox makes it worse than intuition suggests: collisions appear surprisingly early even in a sparsely filled table. So the design question is never "avoid collisions" but "resolve them cheaply."

### Separate chaining vs open addressing — what's the difference?

In separate chaining, each slot points to a list (or small tree) of all entries that hashed there; collisions just get appended. In open addressing, every entry lives directly in the array, and a collision sends you probing to another slot until you find an empty one. Chaining is simpler and handles high load factors gracefully; open addressing is more cache-friendly and avoids per-entry pointer overhead but degrades badly as the table fills.

### How does linear probing work, and what's its weakness?

Linear probing resolves a collision by checking the next slot, then the next, incrementing by one until it finds an empty one: `index = (hash + i) mod m` for `i = 0, 1, 2, ...`. Its weakness is *primary clustering*: occupied slots tend to form long contiguous runs, and any key hashing anywhere into a run has to traverse the whole thing. One cluster feeds the next, so probe lengths grow faster than load factor alone would predict. Its virtue is excellent cache locality — you're scanning adjacent memory.

### How do quadratic probing and double hashing improve on linear probing?

Quadratic probing uses `index = (hash + c1*i + c2*i^2) mod m`, so probes spread out with increasing gaps, breaking up primary clusters (though it can suffer *secondary* clustering — keys with the same initial hash follow the same probe path). Double hashing uses a second hash function for the step size: `index = (hash1 + i*hash2(key)) mod m`, so different keys probe in different patterns, essentially eliminating clustering. Double hashing gives the best distribution but costs a second hash computation and worse cache locality than linear probing.

### What is the load factor and why does it matter so much?

Load factor `alpha = n/m` is the ratio of stored entries to array slots — it's the master dial for performance. For chaining, expected chain length is exactly `alpha`, so lookups stay O(1) as long as `alpha` is bounded. For open addressing, expected probes grow roughly like `1/(1-alpha)`, which explodes as `alpha` nears 1 (at 0.9 you average ~10 probes). Keeping `alpha` below a threshold (~0.75 open, ~1.0 chained) is what preserves the O(1) guarantee; letting it climb silently turns your table into a slow list.

### What happens during a resize/rehash and why can't you just copy the array?

When `alpha` crosses the threshold, you allocate a larger array (typically double) and *reinsert every existing entry*. You can't memcpy the old array because each entry's index is `hash(key) mod m`, and `m` just changed — the old indices are meaningless in the new array. So you re-hash all `n` keys, an O(n) operation. This is why a single insert can occasionally be O(n): it triggered a full rebuild.

### Why is insertion O(1) amortized despite O(n) resizes?

Because resizes are rare and get geometrically rarer. If you double capacity each time, inserting `n` elements triggers resizes at sizes 1, 2, 4, 8, ..., n — the total reinsertion work is `1 + 2 + 4 + ... + n < 2n`, which is O(n) spread across n inserts, so O(1) per insert on average. The trick is doubling (geometric growth): if you instead grew by a fixed amount, resizes would happen constantly and insertion would degrade to O(n) amortized.

### When is a hash table's worst case O(n), and does it matter in practice?

Worst case is O(n) when every key collides into one slot (or one probe chain), collapsing the table into a linear scan. In practice it's rare with a good hash and random data — but it's a real attack vector: if an adversary knows your hash function, they can craft keys that all collide, a *hash-flooding* DoS. Mitigations include randomized/seeded hashes (SipHash, used by Rust, Python, and others) and degrading a long chain into a balanced tree (Java's HashMap converts a bucket to a red-black tree past 8 entries, capping worst case at O(log n)).

### Why is deletion tricky in open addressing, and what's a tombstone?

You can't simply empty a slot on deletion, because lookups rely on unbroken probe chains — an empty slot signals "stop, not found," so clearing a middle slot would make later entries in the chain unreachable. A *tombstone* is a special "deleted" marker: probes skip past it (so chains stay intact) but inserts can reuse it. The cost is that tombstones accumulate and lengthen probe sequences over time, so heavily-churned tables need periodic rehashing to clear them out.

### What is Robin Hood hashing?

Robin Hood hashing is an open-addressing variant that minimizes variance in probe distance. When inserting, if the entry you're placing has probed farther from its ideal slot than the entry currently sitting there, you evict the "richer" resident and continue inserting it instead — robbing from the rich (short probe distance) to give to the poor. This equalizes probe lengths across all keys, dramatically improving worst-case lookup time and making the table tolerate higher load factors before degrading.

### Why must you verify key equality after hashing to a slot?

Because hashing is lossy and collisions exist — landing on a slot only tells you a key *might* be there, not that it *is*. Two different keys can hash to the same index, so after computing the slot you must compare the actual key for equality to confirm you have the right entry (and not a colliding neighbor). This is why hash-based structures need both a good `hashCode`/`__hash__` *and* a correct `equals`/`__eq__`; getting one right and the other wrong produces silent lookup failures.

### What's the contract between hashCode and equals (or __hash__ and __eq__)?

The rule: if two objects are equal, they must have the same hash. (The converse need not hold — equal hashes don't imply equality, that's just a collision.) Break this and the table breaks: two "equal" objects with different hashes land in different buckets, so you can insert a key and then fail to find it with an equal key. This is why you must always override both together, and why mutable fields used in `equals` must not change while the object is a key — a changed hash strands the entry in the wrong bucket.

### When would you choose a tree-based map over a hash map?

Choose a tree map (balanced BST, e.g. red-black) when you need *ordering*: sorted iteration, range queries ("all keys between x and y"), floor/ceiling lookups, or a predictable O(log n) worst case rather than a probabilistic O(1) with an O(n) tail. Choose a hash map when you only need point lookups and want the fastest average performance and don't care about order. Rule of thumb: hash map by default; tree map the moment "in sorted order" or "range" enters the requirements.

### How do languages map to these implementations in practice?

Most standard libraries use open addressing today for cache performance: Python's `dict` uses open addressing (with a compact, insertion-ordered layout since 3.6), Rust's `HashMap` uses SwissTable-style open addressing with SipHash, and Go's `map` uses bucketed chaining with 8 entries per bucket. Java's `HashMap` uses separate chaining that upgrades hot buckets to red-black trees. C++ `std::unordered_map` mandates chaining by spec (for iterator/reference stability), while `std::map` is the ordered, tree-based alternative. Knowing your language's choice tells you its collision behavior and iteration-order guarantees.

## Sets & Maps

### Summary

**What this topic covers**
Sets and maps are *abstract data types* (ADTs) — interfaces defined by behavior, not implementation. A *set* is a collection of unique elements answering "is x present?"; a *map* (dictionary/associative array) stores key-value pairs answering "what's the value for key k?". The key insight for interviews: the same ADT has two dominant implementations — hash-backed (unordered, expected O(1)) and tree-backed (ordered, O(log n)) — and choosing correctly is a design signal.

**Key terms**
*Set* — unique elements, membership testing. *Map/dictionary* — keys mapped to values, unique keys. *Ordered* (tree-backed) — iterates in sorted key order, O(log n) ops. *Unordered* (hash-backed) — no order guarantee, expected O(1) ops. *Multiset/bag* — allows duplicates, tracks counts. *Multimap* — one key maps to multiple values. *Insertion-ordered* — iterates in the order elements were added (a third flavor, distinct from sorted). *ADT vs data structure* — the interface vs the concrete implementation behind it.

**Core mechanics**
A map is the fundamental structure; a set is just a map whose values are irrelevant (a map from key to "present"). Both provide insert, delete/remove, and contains/lookup. Hash-backed versions compute a slot from the key's hash for expected O(1) operations but no ordering. Tree-backed versions (balanced BSTs) keep keys in sorted order, paying O(log n) per operation but enabling range queries, ordered iteration, and floor/ceiling. A multiset augments a map with counts (key to integer); a multimap augments values into collections (key to list/set of values).

**Trade-offs**
Hash-backed wins on raw speed: expected O(1) vs O(log n), and it's the right default. Tree-backed wins whenever order matters — sorted iteration, "next key after x," range scans, or a hard worst-case bound (O(log n) guaranteed vs hash's O(n) tail). Hash sets need a good hash function and equality; tree sets need a comparator/ordering. Memory-wise, hash structures pay for empty slots to keep load factor low; trees pay for per-node pointers. Insertion-ordered maps add a bit of bookkeeping (a linked list threading the entries) on top of a hash table.

**Common confusions**
The biggest: assuming iteration order. A hash set's order is unspecified and can change across insertions or versions — relying on it is a classic bug. Conversely, people forget *ordered* has two meanings: sorted-by-key (tree) vs insertion-order (linked hash) — very different. Candidates also conflate the ADT with a structure ("a set is a hash table") — a set is an interface; the hash table is one implementation. And multiset vs set: needing counts (word frequencies) means a multiset/counter, not a plain set.

**Why interviewers ask**
Set/map selection is the everyday decision that reveals whether a candidate reasons about requirements. "Do you need order?" "Do you need range queries?" "Are duplicates counts or distinct values?" — the right answer picks the structure that matches, and the wrong one either over-pays (tree when hash suffices) or breaks (hash when order is required). It also probes standard-library fluency: knowing that Java's `TreeMap` is sorted while `HashMap` isn't, or that Python's `dict` is insertion-ordered, is exactly the practical knowledge interviewers want to confirm.

### What is the difference between an abstract data type and a data structure?

An abstract data type (ADT) is defined by its *behavior* — the operations it supports and their contracts — independent of how it's built. "Map" is an ADT: it promises insert, lookup, and delete on unique keys. A *data structure* is a concrete implementation of that behavior: a hash table and a red-black tree are two different data structures that both implement the map ADT. The distinction matters because it lets you reason about *what you need* (the interface) separately from *what it costs* (the implementation).

### What is a set and what are its core operations?

A set is a collection of unique elements with no duplicates, optimized for membership testing. Its core operations are `add(x)`, `remove(x)`, and `contains(x)` — all expected O(1) in a hash set. Sets also support the algebraic operations: union, intersection, and difference. The defining property is uniqueness: adding an element that's already present is a no-op. You reach for a set whenever the question is "have I seen this?" — deduplication, visited-tracking, membership filters.

### What is a map, and how does it relate to a set?

A map (dictionary, associative array) stores key-value pairs where each key is unique, and answers "what value is associated with key k?" in expected O(1). A set is essentially a map with no meaningful values — a map from element to "present." That's why many languages implement one in terms of the other (Java's `HashSet` is backed by a `HashMap` with a dummy value). The map is the more general structure; the set is the degenerate case where you only care about the keys.

### What's the difference between an ordered and an unordered map?

An unordered map is hash-backed: expected O(1) operations, no iteration-order guarantee. An ordered map is tree-backed (balanced BST): O(log n) operations, but keys iterate in sorted order and you get range queries, floor/ceiling, and min/max. The names in standard libraries reflect this: C++ `std::map` (ordered/tree) vs `std::unordered_map` (hash); Java `TreeMap` vs `HashMap`. Choose unordered by default for speed; choose ordered the moment sorted traversal or range operations are required.

### What is a multiset (bag), and when would you use one?

A multiset allows duplicate elements and tracks how many times each appears — effectively a map from element to count. You use it whenever you need frequencies rather than mere presence: word counts, character histograms for anagram checks, tallying occurrences. Python's `collections.Counter`, C++ `std::multiset`, and Java via `Map<T, Integer>` or Guava's `Multiset` all fill this role. The tell in a problem: "how many times" or "most frequent" means multiset/counter, not a plain set.

### What is a multimap, and how does it differ from a regular map?

A multimap maps a single key to *multiple* values, unlike a regular map where each key has exactly one value. Conceptually it's a map from key to a collection (list or set) of values. Use it for one-to-many relationships: an index from a word to all document IDs containing it, or from a phone area code to all its cities. You can hand-roll it as `Map<K, List<V>>`, or use `std::multimap`, Guava's `Multimap`, or Python's `defaultdict(list)`.

### Does a hash set guarantee any iteration order?

No — a plain hash set (or hash map) makes no ordering promise. Iteration order depends on hash values, table size, and insertion history, and can change when the table resizes or across language versions. Relying on it is a subtle, portability-breaking bug. If you need order you must pick the right variant: a *sorted* order needs a tree-backed set; a stable *insertion* order needs a linked-hash variant (Java's `LinkedHashSet`, or Python's `dict` which guarantees insertion order since 3.7).

### What's the difference between sorted order and insertion order?

Sorted order iterates by the keys' natural comparison (1, 2, 3... or "a", "b", "c") and requires a tree-backed structure or an explicit sort — O(log n) per op. Insertion order iterates in the sequence elements were *added*, regardless of value, and is provided by a hash table threaded with a linked list (O(1) ops, order preserved). They're completely different guarantees: Python's `dict` is insertion-ordered, Java's `TreeMap` is sorted, Java's `LinkedHashMap` is insertion-ordered. Confusing them is a common interview slip.

### When should you use a tree-backed set/map instead of a hash-backed one?

Use tree-backed whenever you need any of: sorted iteration, range queries ("all keys in [a, b]"), nearest-key lookups (floor/ceiling/successor/predecessor), min/max in O(log n), or a guaranteed O(log n) worst case instead of hash's probabilistic O(1) with an O(n) tail. If you need none of those — just point lookups and membership — use hash-backed for the faster average performance. The one-line heuristic: "Do I ever need these in order, or ask for a range?" Yes to tree, no to hash.

### How do you compute set union, intersection, and difference, and what do they cost?

Union combines all unique elements of both sets; intersection keeps only elements in both; difference keeps elements in the first but not the second. With hash sets, each is O(|A| + |B|): iterate one set, probe the other in O(1) per element. A key optimization for intersection: iterate the *smaller* set and probe the larger, so cost is O(min(|A|, |B|)). With sorted (tree) sets, you can merge in a single linear pass over both, which also yields the result in sorted order.

### How does a set help you detect duplicates or cycles?

For duplicates: iterate the collection, and for each element try to add it to a set — if `add` reports it was already present (or `contains` is true), you've found a duplicate, all in O(n). For cycle detection (e.g. in a linked list or graph traversal), track *visited* nodes in a set; if you reach a node already in the set, there's a cycle. Both exploit the set's O(1) membership test to replace what would otherwise be an O(n^2) nested scan.

### Why can't you use a mutable object as a key safely?

A hash-backed map places a key by its hash and finds it by re-computing that hash. If you mutate a field that participates in the key's hash/equality after insertion, its hash changes — but the entry stays in the old bucket, now unreachable: lookups compute the *new* bucket and find nothing. In a tree-backed map, mutating a field used by the comparator breaks the sort invariant, corrupting the tree. The rule: keys must be immutable (or at least, the fields used for hashing/comparison must never change while it's a key).

### What standard-library types map to these ADTs across languages?

Java: `HashMap`/`HashSet` (hash), `TreeMap`/`TreeSet` (sorted), `LinkedHashMap`/`LinkedHashSet` (insertion-ordered). C++: `std::unordered_map`/`unordered_set` (hash) vs `std::map`/`std::set` (sorted, tree), plus `multimap`/`multiset`. Python: `dict`/`set` (hash, and `dict` is insertion-ordered), `collections.Counter` (multiset), `collections.defaultdict` (easy multimap); no built-in sorted map (use `sortedcontainers` or a heap). Knowing this mapping cold is exactly the fluency interviewers check.

### How would you implement a sorted map if your language only has a hash map?

Options depend on the access pattern. If you build once and query many times, keep a hash map for O(1) lookups plus a sorted array (or maintain keys in a separate sorted structure) for range/ordered access. For dynamic inserts with ordered queries, use a balanced BST library (Java's `TreeMap`, Python's `sortedcontainers.SortedDict`, or a skip list). If you only need the top-k or repeated min/max, a heap may suffice instead of a full sorted map. The point: match the auxiliary structure to which ordered operations you actually need.

### What's the interview tell that you should reach for a set or map?

Watch for these phrases: "seen before," "unique," "duplicate," "count of," "look up by," "group by," "have we already." Any O(n^2) brute force that repeatedly *searches* a collection is usually a set/map waiting to happen — replace the inner scan with an O(1) membership or lookup to collapse it to O(n). "How many times" points to a multiset/counter; "all the values for this key" points to a multimap; "in sorted order" or "range" points to a tree-backed variant.

## Trees & Traversals

### Summary

**What this topic covers**
A tree is a hierarchical, connected, acyclic structure of nodes with parent-child relationships — one root, no cycles, exactly one path between any two nodes. This topic covers the vocabulary (root, leaf, height, depth), the shapes (binary, complete, balanced), how trees are stored (pointers vs arrays), and the four canonical traversals (pre-order, in-order, post-order, level-order). Trees are the backbone of BSTs, heaps, tries, parsers, and file systems, so the traversals here are reused everywhere.

**Key terms**
*Root* — the top node, no parent. *Leaf* — a node with no children. *Internal node* — has at least one child. *Edge* — a parent-child link. *Depth* of a node — edges from the root to it (root is depth 0). *Height* of a node — edges on the longest path down to a leaf (a leaf has height 0); tree height is the root's height. *Subtree* — a node plus all its descendants. *Binary tree* — at most two children per node. *n-ary* — up to n children.

**Core mechanics**
Each node holds a value and references to its children (and sometimes its parent). Pointer representation is a node object with `left`/`right` fields (or a children list for n-ary) — flexible, the default. Array representation stores nodes at computed indices: for a node at index `i` (0-based), children are at `2i+1` and `2i+2`, parent at `(i-1)/2` — compact and cache-friendly but wasteful unless the tree is nearly complete (this is exactly how heaps are stored). Traversals are the fundamental operations: DFS (pre/in/post-order) goes deep via recursion or an explicit stack; BFS (level-order) goes wide via a queue. Every traversal visits all `n` nodes once, so all are O(n) time.

**Trade-offs**
Pointer representation handles arbitrary, sparse, changing trees but costs a pointer dereference per step (poor locality) and per-node allocation overhead. Array representation is compact and cache-friendly with no pointers, but only efficient for complete/near-complete trees — a sparse tree wastes exponential space on absent nodes. For traversal, recursion is clean but uses O(h) stack space and can overflow on a deep (skewed) tree; an explicit stack/queue moves that to the heap and avoids the crash. DFS uses O(h) memory; BFS uses O(w) where `w` is the max width — for a balanced tree the bottom level holds ~n/2 nodes, so BFS can cost O(n) memory.

**Common confusions**
Height vs depth is the perennial mix-up: depth counts *down from the root*, height counts *up from the leaves*. Off-by-one on whether these count nodes or edges (both conventions exist — state yours). "Complete" vs "full" vs "perfect" get muddled: *full* = every node has 0 or 2 children; *complete* = all levels filled except possibly the last, which fills left-to-right; *perfect* = all levels completely full. And a big one: in-order traversal only yields *sorted* output for a binary *search* tree, not for any binary tree.

**Why interviewers ask**
Trees test recursion fluency — the ability to define an operation in terms of its subtrees is a core skill, and traversals are the cleanest possible exercise in it. Knowing which traversal to reach for (in-order for sorted BST output, level-order for shortest-path-by-depth or level grouping, post-order for computing something about a node from its children, like heights or deletions) shows a candidate can match a tool to a shape. The recursive-vs-iterative follow-up probes whether they understand the call stack, and balance questions set up the entire BST/AVL/red-black discussion.

### What defines a tree, and how is it different from a general graph?

A tree is a connected, acyclic graph with a designated root, giving it a hierarchy of parent-child relationships. The defining properties: exactly one root (no parent), every other node has exactly one parent, there are no cycles, and there's exactly one path between any two nodes. A tree with `n` nodes always has exactly `n-1` edges. A general graph can have cycles, multiple paths, disconnected components, and no notion of "root" — the tree is the special, constrained case.

### What's the difference between the height and the depth of a node?

Depth measures *downward from the root*: it's the number of edges from the root to the node, so the root has depth 0. Height measures *upward from the leaves*: it's the number of edges on the longest path from the node down to a leaf, so every leaf has height 0. The height of the *tree* is the height of its root (equivalently, the maximum depth of any node). They're mirror concepts — easy to swap under pressure, so define which you mean.

### What are a root, a leaf, and an internal node?

The root is the single topmost node with no parent — the entry point to the tree. A leaf (or external node) is a node with no children — the bottom of a branch. An internal node is any node with at least one child, i.e. everything that isn't a leaf. In a non-empty tree there's always exactly one root; a tree can be a single node that is simultaneously the root and a leaf.

### What's the difference between a full, complete, and perfect binary tree?

*Full* (a.k.a. proper): every node has either 0 or 2 children — no node has exactly one child. *Complete*: every level is completely filled except possibly the last, and the last level is filled left-to-right with no gaps (this is the shape heaps require). *Perfect*: every internal node has two children *and* all leaves are at the same depth — every level is completely full, giving exactly `2^(h+1) - 1` nodes. Perfect implies both complete and full; the converses don't hold.

### What does it mean for a tree to be balanced, and why does it matter?

A tree is balanced when its height stays O(log n) — no root-to-leaf path is dramatically longer than another (the exact rule varies: AVL bounds sibling subtree heights within 1; red-black uses color invariants). It matters because tree operations cost O(h): on a balanced tree that's O(log n), but on a degenerate tree that's collapsed into a linked list (insert sorted data into a naive BST), h = n and every operation degrades to O(n). Self-balancing trees (AVL, red-black) exist precisely to guarantee that O(log n) bound.

### How does the array representation of a tree work?

You store node values in a flat array by position, using index arithmetic instead of pointers. For a node at 0-based index `i`: its left child is at `2i+1`, right child at `2i+2`, and parent at `(i-1)/2` (integer division). This is exactly how binary heaps are stored. It's compact (no pointer overhead) and cache-friendly (nodes are contiguous), but it only works well for complete trees — a sparse or skewed tree leaves huge gaps of unused slots, wasting up to exponential space.

### When would you use pointer representation over array representation?

Use pointers (node objects with `left`/`right`/child references) for any tree that is sparse, unbalanced, or changes shape a lot — BSTs, tries, parse trees, general n-ary trees. Pointers handle arbitrary structure with space proportional to the actual node count. Use the array representation only when the tree is complete or nearly so, like a heap, where the index arithmetic is cheap and the contiguous layout gives cache wins. Rule of thumb: array for complete/heap-shaped, pointers for everything else.

### What are the three depth-first traversals and how do they differ?

All three visit a node and recurse on both subtrees; they differ in *when* the node itself is processed relative to its children. *Pre-order*: node, then left subtree, then right (root first — good for copying/serializing a tree). *In-order*: left, node, right (for a BST this yields sorted order). *Post-order*: left, right, then node (children processed before the parent — good for deletions and computing a node's value from its children, like heights). "Pre/in/post" refers to where the *root* falls in the sequence.

### Why does in-order traversal of a BST produce sorted output?

Because a BST's invariant is that everything in a node's left subtree is smaller than the node, and everything in its right subtree is larger. In-order traversal visits *left subtree, then node, then right subtree* — so it emits all smaller values, then the node, then all larger values, recursively at every level. The result is a fully sorted ascending sequence. Note this is specific to binary *search* trees; in-order on an arbitrary binary tree yields no meaningful order.

### What is level-order traversal and how do you implement it?

Level-order (breadth-first) visits nodes level by level, top to bottom, left to right. You implement it with a queue: enqueue the root, then repeatedly dequeue a node, process it, and enqueue its children. To process one level at a time (e.g. to build a list-per-level), record the queue's size at the start of each iteration and dequeue exactly that many nodes before moving on. It's the go-to for "shortest path by number of edges," "nodes at each depth," and level-grouping problems.

```text
queue = [root]
while queue not empty:
    level_size = len(queue)
    for i in range(level_size):
        node = queue.dequeue()
        visit(node)
        if node.left:  queue.enqueue(node.left)
        if node.right: queue.enqueue(node.right)
```

### How do you convert a recursive traversal to an iterative one?

You simulate the call stack explicitly. For DFS, replace recursion with an explicit stack: push the root, then loop — pop a node, process it, and push its children (in reverse of the order you want to visit them, since a stack is LIFO). Pre-order is the most direct. In-order and post-order iterative versions are trickier because you must track whether you've already descended into the left subtree, often using a "last visited" pointer or pushing nodes twice. For BFS you use a queue instead of a stack — that's the only difference from iterative DFS.

### When would you choose iterative traversal over recursive?

Choose iterative when the tree can be deep enough to overflow the call stack — a skewed tree of height n means n stack frames, and languages without tail-call optimization (Python, Java) will crash on inputs of ~10^4–10^5 depth. Iterative moves that memory to an explicit heap-allocated stack you control, avoiding the overflow. You might also prefer iterative when you need to pause/resume traversal or have fine control over the order. Otherwise, recursion is cleaner and clearer — use it as the default and reach for iterative when depth is a real risk.

### What are the space complexities of DFS versus BFS on a tree?

DFS uses O(h) auxiliary space, where h is the tree height — the recursion (or explicit stack) only holds the current root-to-node path. For a balanced tree that's O(log n); for a skewed tree it's O(n). BFS uses O(w) space, where w is the maximum width — the queue holds an entire level at its widest. For a balanced binary tree the last level holds ~n/2 nodes, so BFS is O(n). The practical takeaway: on a wide, balanced tree DFS is far more memory-efficient; on a deep, skewed tree BFS avoids the deep call stack.

### How do you compute the height of a binary tree?

Recursively, via post-order logic: a node's height is 1 plus the max of its children's heights, with an empty subtree contributing a height of -1 (so a leaf comes out to height 0, counting edges) or 0 (if you count nodes). You must compute both children's heights *before* the node's, which is exactly post-order. It's O(n) time (every node visited once) and O(h) stack space.

```python
def height(node):
    if node is None:
        return -1          # empty subtree; use 0 to count nodes
    return 1 + max(height(node.left), height(node.right))
```

### How do you choose which traversal to use for a given problem?

Match the traversal to what you need. Need values in sorted order from a BST, or the k-th smallest? *In-order*. Need to serialize, clone, or explore a tree top-down (prefix expression, directory listing)? *Pre-order*. Need to compute a property of a node from its children, or delete/free a tree safely, or evaluate a postfix expression? *Post-order* (children before parent). Need shortest path by depth, level-by-level grouping, or the nodes nearest the root first? *Level-order (BFS)*. The processing order you require dictates the traversal.

### What's the difference between a binary tree and an n-ary tree, and how does representation change?

A binary tree caps each node at two children (`left`, `right`); an n-ary tree allows any number, so each node holds a *list* (or map) of children instead of fixed fields. The traversals generalize: pre-order and post-order extend naturally (visit node before/after iterating its child list), and BFS is unchanged. In-order has no clean meaning for n-ary trees since "the node" has no single left/right split. Tries and file-system trees are common n-ary examples; the children-list representation is standard since the branching factor varies per node.

## Binary Search Trees

### Summary

**What this topic covers**
A binary search tree (BST) is a binary tree where every node's key is greater than all keys in its left subtree and less than all keys in its right subtree. That single ordering invariant, applied recursively, turns a tree into a searchable dictionary: at each node you compare, then descend left or right, halving the search space when the tree is balanced. The mental model is "binary search made into a linked structure" — the same divide-and-conquer as binary search on a sorted array, but with O(log n) insert and delete because you re-link pointers instead of shifting elements.

**Key terms**
*BST invariant* — for every node, `left subtree keys < node key < right subtree keys`. *In-order traversal* — visit left, node, right; on a BST this yields keys in sorted ascending order. *Height* — longest root-to-leaf path in edges; determines operation cost. *Successor* — the next-larger key (leftmost node of the right subtree, or an ancestor). *Predecessor* — the next-smaller key. *Degenerate tree* — a BST shaped like a linked list, height O(n). *Leaf* — node with no children.

**Core mechanics**
Search, insert, and delete all follow the same descent: compare the target to the current node and go left if smaller, right if larger. Search returns the node or falls off the bottom. Insert descends to the empty slot where the key belongs and hangs a new leaf there. Delete has three cases: a leaf is simply removed; a node with one child is replaced by that child; a node with two children is replaced by its in-order successor (the smallest key in its right subtree), which by construction has at most one child and can be spliced out cleanly. Every operation costs O(h) where h is the height — O(log n) if balanced, O(n) if degenerate. Nothing in a plain BST enforces balance; the shape is a pure artifact of insertion order.

**Trade-offs**
Versus a hash table: a BST is slower for pure point lookups (O(log n) vs O(1) average) but keeps keys *ordered*, so it gives you range queries, min/max, successor/predecessor, and sorted iteration for free — a hash table gives you none of those. Versus a sorted array: the array is more cache-friendly and supports binary search in O(log n), but insert/delete cost O(n) from shifting, while a balanced BST does them in O(log n). The BST's Achilles' heel is that its guarantees are only "if balanced" — an unbalanced BST is strictly worse than both alternatives.

**Common confusions**
The classic mistake is thinking a BST is *inherently* O(log n) — it is not; a plain BST degenerates to O(n) on sorted or nearly-sorted input, which is a common real-world case. Another is confusing the BST invariant (a global ordering across whole subtrees) with the heap invariant (only parent-vs-child, no left/right ordering) — they are different structures for different jobs. Candidates also botch two-child deletion, forgetting that you must promote the successor's *value* and then delete the successor node, not just unlink the target.

**Why interviewers ask**
BSTs are the canonical test of recursive thinking and invariant reasoning. Asking you to validate a BST, find the k-th smallest, or delete a node reveals whether you truly understand that in-order traversal equals sorted order and that correctness hinges on an invariant you must preserve through every mutation. The honest "it degenerates on sorted input" answer separates people who memorized "trees are log n" from people who understand *why*, and sets up the natural follow-up: balanced trees.

### What is the binary search tree invariant?
For every node in the tree, all keys in its left subtree are strictly less than the node's key, and all keys in its right subtree are strictly greater. Crucially this applies to the *entire* subtree, not just the immediate children — a node's left child and every descendant of that child must be smaller. This recursive ordering is what lets you discard half the tree at each comparison during a search.

### How do you search for a key in a BST?
Start at the root and compare the target to the current key. If equal, you found it. If the target is smaller, descend into the left child; if larger, descend right. Repeat until you match or fall off a null pointer, which means the key is absent. Each step drops one level, so the cost is O(h) — the tree's height.

### Why is in-order traversal of a BST sorted?
In-order traversal visits the left subtree, then the node, then the right subtree, recursively. Because the invariant guarantees left-subtree keys are all smaller and right-subtree keys are all larger, this visitation order emits keys in ascending sorted order. This is the single most useful BST property: it means a BST is implicitly a sorted collection, and many interview problems ("k-th smallest", "validate BST", "range sum") reduce to reasoning about the in-order sequence.

### How do you insert a node into a BST?
Descend from the root exactly as if searching for the key. When you reach the null pointer where the key *would* live, create a new leaf node there and link it to its parent. Insertion never restructures existing nodes in a plain BST — it only adds a leaf — so it costs O(h). The final shape depends entirely on the order keys arrived in.

### How do you delete a node with two children?
You cannot simply remove it — that would orphan two subtrees. Instead, find its in-order successor: the smallest key in its right subtree, reached by going right once then left as far as possible. Copy the successor's key into the node being "deleted", then delete the successor node. The successor has at most one child (it can have no left child, since it's the leftmost of that subtree), so removing it reduces to the easy one-child or leaf case. Using the predecessor (largest of the left subtree) works symmetrically.

### What are the three cases for BST deletion?
(1) *Leaf* — just unlink it from its parent. (2) *One child* — replace the node with its single child, splicing it into the parent's pointer. (3) *Two children* — replace the node's key with its in-order successor's key, then recursively delete that successor. Handling these three cases correctly, especially the third, is a very common interview checkpoint.

### What is a node's successor, and how do you find it?
The successor is the node with the next-larger key. Two cases: if the node has a right subtree, the successor is the leftmost (smallest) node of that subtree. If it has no right subtree, the successor is the lowest ancestor for which the node lies in the left subtree — you walk up until you move up-and-right. With parent pointers this is O(h); without them you track the candidate during the downward search.

### Why does a BST degenerate into a linked list?
If keys are inserted in sorted (or reverse-sorted) order, each new key is larger (or smaller) than everything so far, so it always attaches to the same side. The tree becomes a single long chain with height O(n), and every operation degrades to O(n) — no better than scanning a linked list. This is not a rare pathological case; monotonically increasing keys (timestamps, auto-increment IDs) are extremely common, which is exactly why self-balancing trees exist.

### What is the time complexity of BST operations?
Search, insert, and delete are all O(h), the height of the tree. For a balanced BST, h = O(log n), giving O(log n) operations. For a degenerate BST, h = O(n), giving O(n). Space is O(n) for storage plus O(h) for the recursion or explicit stack during traversal. The gap between the balanced and degenerate cases is the whole reason balancing matters.

### How would you check if a binary tree is a valid BST?
The naive mistake is to only compare each node against its immediate children — that misses violations deeper in a subtree. The correct approach carries a valid `(min, max)` range down the recursion: the root may be anything, its left child must be in `(min, node.key)`, its right child in `(node.key, max)`, tightening bounds as you descend. Equivalently, do an in-order traversal and verify each emitted key is strictly greater than the previous one.

### How do you find the minimum and maximum keys in a BST?
The minimum is the leftmost node — follow left children from the root until there is no left child. The maximum is the rightmost node — follow right children to the end. Both cost O(h). This is why a BST gives you min/max cheaply, unlike a hash table which would need a full O(n) scan.

### How do you find the k-th smallest element in a BST?
Do an in-order traversal and stop at the k-th visited node, since in-order yields sorted order. This is O(k) into the traversal, O(h) space. If you need repeated k-th queries, augment each node with the size of its subtree; then you can navigate directly: compare k to the left subtree's size to decide whether the answer is in the left subtree, is the current node, or is the (k - leftSize - 1)-th in the right subtree — turning each query into O(h).

### When would you choose a BST over a hash table?
Choose a BST (in practice, a balanced one) whenever you need *ordering*: range queries ("all keys between 100 and 200"), sorted iteration, min/max, or successor/predecessor. A hash table beats it on raw point-lookup speed (O(1) average vs O(log n)) but is fundamentally unordered — it cannot answer "what's the next-largest key" without scanning everything. If you only ever do exact-key get/put, prefer the hash table.

### Can a BST hold duplicate keys?
A plain BST assumes distinct keys, and duplicates make the invariant ambiguous (does an equal key go left or right?). Common resolutions: forbid duplicates and store a count per node, consistently send equals to one side (e.g. treat `>=` as "go right"), or make the tree a multimap where each node holds a list of values. Whatever you pick must be applied identically in search, insert, and delete or the tree breaks.

### What's the difference between the BST invariant and the heap invariant?
The BST invariant is a *horizontal* ordering: left < node < right, giving a globally sorted structure and O(log n) search for an arbitrary key. The heap invariant is only *vertical*: each parent compares to its children (parent <= children in a min-heap), with no ordering between siblings or left/right. As a result a heap gives O(1) access to the min/max but O(n) search for an arbitrary key — it's optimized for priority access, not lookup. They're different tools; do not conflate them.

## Balanced BSTs

### Summary

**What this topic covers**
A self-balancing BST is an ordinary binary search tree augmented with rules that keep its height at O(log n) no matter what order keys arrive in. The two canonical families are AVL trees and Red-Black (RB) trees; both use local *rotations* to restore balance after inserts and deletes. The mental model: same in-order-sorted structure and same O(h) operations as a plain BST, but with an enforced ceiling on h, so the "if balanced" caveat becomes a guarantee. This is the machinery behind Java's `TreeMap`/`TreeSet` and C++'s `std::map`/`std::set`.

**Key terms**
*Rotation* — a local, O(1) pointer re-link (left or right) that changes a subtree's shape while preserving in-order order. *Balance factor* (AVL) — height(left) minus height(right) for a node; must stay in {-1, 0, +1}. *Height-balanced* — every node's two subtree heights differ by at most a constant. *Red-Black properties* — coloring rules (root black, no red-red parent-child, equal black-height on all root-to-null paths) that bound height. *Black-height* — number of black nodes on any path from a node to a leaf. *Rebalancing* — the fix-up after insert/delete that restores the invariant.

**Core mechanics**
The atomic operation is the rotation: a right rotation at node X makes X's left child the new subtree root and re-hangs the middle subtree, all in O(1), and it *never* violates the BST ordering. AVL trees track a balance factor per node; after an insert or delete they walk back up to the root and, wherever a node's balance factor hits ±2, apply one or two rotations to fix it — keeping subtree heights within 1 of each other. Red-Black trees instead color nodes red or black and enforce that no red node has a red child and that every root-to-null path crosses the same number of black nodes; violations are repaired with recolorings and up to a constant number of rotations. Both guarantee height O(log n), so search/insert/delete are O(log n) worst case, not just average.

**Trade-offs**
AVL trees are more strictly balanced (height <= ~1.44 log n) so they give *faster lookups*, but they do more rotational work on insert/delete to maintain that tightness. Red-Black trees are more loosely balanced (height <= 2 log n) so lookups are slightly slower, but they rebalance with fewer rotations (O(1) amortized) and less structural churn, making them better for *write-heavy* workloads. That's why most standard-library maps use RB trees — a good all-round default — while AVL shines in read-dominated scenarios like in-memory indexes. Both cost O(n) space plus a little metadata per node (a height/balance-factor or a color bit).

**Common confusions**
Candidates often think a rotation can break the sort order — it cannot; that's the whole point, rotations preserve the in-order sequence. Another confusion is believing RB trees are "kept perfectly balanced": they are not, they can be up to twice the minimum height, which is still O(log n). People also assume balanced trees beat hash tables generally — they don't for point lookups; the reason to pay for a balanced tree is *ordered* operations with worst-case guarantees. Finally, many forget that deletion rebalancing is materially harder than insertion, especially in RB trees.

**Why interviewers ask**
Few interviews ask you to code a full RB tree — it's notoriously fiddly — but they very much probe whether you understand *why* balancing exists, what a rotation does, and the AVL-vs-RB trade-off. Knowing that `TreeMap` is a Red-Black tree, that it gives O(log n) *worst case* (unlike a hash map's O(1) *average* but O(n) worst case), and that it maintains sorted order is exactly the kind of systems-level fluency that separates a senior candidate from someone who only knows the array-and-hashmap basics.

### Why does a plain BST need balancing at all?
Because a plain BST's height depends entirely on insertion order, and common inputs — sorted timestamps, sequential IDs — produce a degenerate O(n)-tall chain where every operation is O(n). Balancing enforces an O(log n) height ceiling regardless of input order, converting the BST's "average case O(log n)" into a "worst case O(log n)" guarantee. Without it, a BST is a liability in any system that might see ordered data.

### What is a tree rotation?
A rotation is a local restructuring that changes the shape of a subtree while preserving the BST ordering. A right rotation at node X promotes X's left child L to be the subtree root, makes X the right child of L, and re-attaches L's old right subtree as X's new left subtree. It touches only a constant number of pointers, so it's O(1), and because it respects the in-order sequence, the tree remains a valid BST. Rotations are the primitive both AVL and RB trees use to rebalance.

### Do rotations preserve the sorted order of the tree?
Yes, always — this is the defining property of a rotation and the reason it's safe. A rotation only rearranges the vertical relationships between a node, one child, and one grandchild-subtree; the left-to-right in-order sequence of all keys is unchanged. That's why you can rebalance freely without ever re-sorting: the invariant is preserved by construction.

### What is an AVL tree?
An AVL tree is a height-balanced BST where every node's balance factor — the height of its left subtree minus the height of its right — is kept in {-1, 0, +1}. After each insert or delete, the tree checks balance factors on the path back to the root and applies rotations wherever the factor reaches ±2. This keeps the height within about 1.44 log n, giving very fast, tightly-bounded O(log n) lookups.

### What are the four AVL rotation cases?
The four imbalance shapes are Left-Left, Right-Right, Left-Right, and Right-Left, named for the path to the deeper grandchild. LL and RR are fixed with a single rotation (right and left respectively). LR and RL are "doubles": you first rotate the child to convert them into an LL or RR case, then rotate the node. So every AVL fix-up is at most two rotations — O(1) structural work per rebalance.

### What is a Red-Black tree?
A Red-Black tree is a BST where each node carries a red or black color bit and the coloring obeys rules that bound the height to at most 2 log n. The core rules: the root is black, red nodes cannot have red children (no two reds in a row), and every path from a node down to a null leaf crosses the same number of black nodes. Inserts and deletes restore these properties with recolorings plus at most a constant number of rotations, giving O(log n) worst-case operations with low rebalancing cost.

### What are the Red-Black tree properties?
(1) Every node is red or black. (2) The root is black. (3) Every null leaf is treated as black. (4) A red node's children are both black (no red-red edge). (5) Every root-to-null path has the same number of black nodes (equal black-height). Properties 4 and 5 together force the longest path to be at most twice the shortest, which is what caps the height at O(log n).

### How does a Red-Black tree guarantee O(log n) height?
The equal-black-height rule (5) means all root-to-leaf paths have the same count of black nodes, and the no-red-red rule (4) means reds can't stack up. So the longest possible path (alternating red/black) is at most twice the shortest possible path (all black). Since the all-black path length is O(log n), the longest path — the height — is at most 2 log n, keeping every operation logarithmic.

### AVL vs Red-Black: when would you pick each?
Pick AVL for read-heavy workloads: it's more rigidly balanced (shorter trees), so lookups are faster. Pick Red-Black for write-heavy or mixed workloads: it tolerates more imbalance and so does fewer rotations per insert/delete, giving cheaper mutations. Red-Black is the pragmatic default (hence its use in standard libraries), while AVL wins when you query far more than you modify, such as a mostly-static in-memory index.

### Why do standard library maps use Red-Black trees?
Because RB trees offer the best *balance of concerns* for a general-purpose ordered map: guaranteed O(log n) search/insert/delete, sorted iteration, and cheap rebalancing (O(1) amortized rotations) that keeps mixed read/write workloads fast. Java's `TreeMap`/`TreeSet` and C++'s `std::map`/`std::set` all use RB trees. AVL would give marginally faster reads but pays more on every write, which is the wrong trade-off for a library that can't assume the workload.

### Which real data structures use balanced BSTs?
Java's `TreeMap` and `TreeSet`, and C++'s `std::map`, `std::set`, `std::multimap`, `std::multiset`, are all Red-Black trees. The Linux kernel uses RB trees extensively (process scheduling, virtual memory areas). Databases and filesystems more often use B-trees/B+-trees — a generalization to high fan-out that's better for disk — but the in-memory, sorted-map slot is dominated by Red-Black trees.

### How is deletion different from insertion in a balanced BST?
Deletion is significantly harder to rebalance. Insertion can only create one localized violation that a bounded fix-up resolves. Deletion can remove a black node, reducing the black-height on one path (in RB) or unbalancing a chain of ancestors (in AVL), so the fix-up may need to propagate multiple levels up the tree with several recolorings/rotations. Both stay O(log n), but delete has more cases and is where implementations most often have bugs — which is exactly why interviewers rarely ask you to code it live.

### Do balanced BSTs beat hash tables?
Not for raw point lookups — a hash table is O(1) average versus a balanced tree's O(log n). You choose a balanced BST when you need what a hash table can't give: sorted iteration, range queries, min/max, successor/predecessor, and a *worst-case* O(log n) guarantee (a hash table degrades to O(n) on collisions or a bad resize). It's an ordering-and-guarantees choice, not a speed-of-single-lookup choice.

### What's the difference between height-balanced and weight-balanced?
Height-balanced (AVL) constrains the *heights* of a node's two subtrees to differ by at most a constant. Weight-balanced constrains the *sizes* (node counts) of the two subtrees to stay in some ratio. RB trees are neither strictly — they use a coloring argument that indirectly bounds height. Most interview discussion centers on height-balanced (AVL) and the coloring-based RB approach; weight-balanced trees (and their cousins like scapegoat trees) are the rarer, more specialized option.

### Are balanced BSTs cache-friendly compared to arrays?
No — pointer-linked trees scatter nodes across the heap, so traversals suffer cache misses that a contiguous array avoids. This is why, despite matching Big-O, a sorted array with binary search often *outperforms* a balanced BST for read-mostly data, and why disk/cache-aware designs favor B-trees (high fan-out, many keys per cache line/page) over binary trees. Big-O tells you the asymptotic story; the constant factors from memory layout decide many real choices.

## Heaps & Priority Queues

### Summary

**What this topic covers**
A priority queue is an abstract data type that always gives you fast access to the highest-priority element; a binary heap is the standard array-backed implementation of it. The mental model: a complete binary tree with a simple parent-child ordering rule, but stored flat in an array with no pointers, where a node at index i has its children at 2i+1 and 2i+2. It's the go-to structure whenever you repeatedly need "the smallest/largest remaining item" — Dijkstra, top-k, event scheduling, and heapsort all lean on it.

**Key terms**
*Priority queue (PQ)* — the ADT: insert with a priority, and extract the min (or max). *Binary heap* — the array-encoded complete-binary-tree implementation. *Heap property* — each parent is <= (min-heap) or >= (max-heap) its children. *Complete tree* — every level full except possibly the last, filled left to right (this is what lets it pack into an array with no gaps). *Sift-up (bubble-up)* — restore the heap after inserting at the end. *Sift-down (heapify-down)* — restore it after removing the root. *Heapify* — build a heap from an unordered array in O(n).

**Core mechanics**
The heap lives in a plain array. Node i's parent is at (i-1)/2, its children at 2i+1 and 2i+2 — pure index arithmetic, no pointers, cache-friendly. *Insert*: append to the end, then sift up, swapping with the parent while it violates the order, O(log n). *Extract-min* (min-heap): the root is the answer; move the last element to the root and sift it down, swapping with the smaller child until the property holds, O(log n). *Peek* the min in O(1). *Build-heap* from n items: sift-down each non-leaf from the bottom up — this is O(n), not O(n log n), because most nodes are shallow. The heap only maintains the parent-child invariant; it is deliberately *not* fully sorted.

**Trade-offs**
A heap gives O(1) access to the extreme and O(log n) insert/extract, but O(n) to find or delete an arbitrary non-root element — it's optimized for one end, not general lookup. Versus a balanced BST: the BST keeps everything sorted (O(log n) arbitrary search, ordered iteration) but a heap is simpler, has better constant factors and cache behavior, and builds in O(n). If you only ever need the min or max repeatedly, a heap wins; if you need ordered scans or arbitrary search, use a tree. Versus a sorted array: the array gives O(1) min but O(n) insert — the heap trades a slightly slower min for much faster insertion.

**Common confusions**
The biggest one: a heap is *not* sorted. In-order traversal of a heap is meaningless; only the root is guaranteed extreme. Candidates also wrongly assume build-heap is O(n log n) — inserting n items one by one is, but bottom-up heapify is O(n). Another trap is confusing heap-the-data-structure with "the heap" region of process memory (dynamic allocation) — unrelated. And people forget that changing an element's priority ("decrease-key" in Dijkstra) requires either knowing its index or lazily pushing a new entry and skipping stale ones on pop.

**Why interviewers ask**
Heaps are the backbone of a huge class of problems — top-k, merge-k-sorted-lists, median-of-a-stream, and any greedy algorithm that repeatedly picks the best option. Interviewers ask because recognizing "I need the k largest, so I'll keep a size-k heap" is a load-bearing pattern, and because explaining why build-heap is O(n) or why extract is O(log n) tests whether you understand the array encoding rather than just calling `heapq`/`PriorityQueue`. It's one of the highest-leverage structures to know cold.

### What is a priority queue?
A priority queue is an abstract data type where each element has a priority, and the two core operations are insert (add an element with a priority) and extract-min or extract-max (remove and return the highest-priority element). Unlike a FIFO queue, order of removal is by priority, not arrival. It's an interface, not an implementation — a binary heap is the usual implementation, but you could back it with a sorted array, a balanced BST, or a Fibonacci heap depending on the performance profile you need.

### What is a binary heap and how does it relate to a priority queue?
A binary heap is a complete binary tree obeying the heap property (parent <= children for a min-heap), and it's the most common concrete implementation of the priority queue ADT. It gives O(1) peek at the extreme, O(log n) insert and extract, and O(n) construction. When someone says "use a priority queue," they almost always mean a binary heap under the hood — e.g. Python's `heapq`, Java's `PriorityQueue`.

### How is a binary heap stored in an array?
As a flat array with no pointers, exploiting the complete-tree shape. The root is at index 0; for a node at index i, its parent is at (i-1)/2, its left child at 2i+1, and its right child at 2i+2. Because a complete tree has no gaps except at the end of the last level, the array packs densely. This index arithmetic replaces pointer chasing, giving excellent cache locality and zero per-node pointer overhead.

### What is the heap property?
In a min-heap, every parent's key is less than or equal to both its children's keys, so the minimum sits at the root. In a max-heap, every parent is greater than or equal to its children, putting the maximum at the root. Note this is only a *parent-child* constraint — there's no ordering between siblings or across subtrees, which is why a heap is not fully sorted and can't do fast arbitrary search.

### How does insertion (sift-up) work?
Append the new element to the end of the array (the next open leaf slot, preserving completeness), then "sift up": compare it to its parent and swap if it violates the heap property, repeating until it's in the right place or reaches the root. Since the tree height is O(log n) and you move up at most one level per swap, insertion is O(log n).

```text
insert(x):
  append x at index n; n += 1
  i = n - 1
  while i > 0 and heap[parent(i)] > heap[i]:   # min-heap
    swap(heap[i], heap[parent(i)])
    i = parent(i)
```

### How does extract-min (sift-down) work?
The root holds the minimum, so save it as the return value. Move the last element into the root position and shrink the array by one (keeping the tree complete), then "sift down": repeatedly swap the element with its *smaller* child while it's larger than that child, until the heap property is restored. Height is O(log n) and you descend at most one level per swap, so extract-min is O(log n).

### Why is building a heap from n elements O(n) and not O(n log n)?
If you insert n elements one at a time, each insert is O(log n), giving O(n log n). But bottom-up heapify — running sift-down on every non-leaf node from the last one up to the root — is O(n). The reason: sift-down cost is proportional to a node's *height*, and most nodes are near the bottom with tiny height. Summing height over all nodes gives a series that converges to O(n), not O(n log n). This is a classic interview "gotcha" worth knowing precisely.

### What's the difference between a min-heap and a max-heap?
A min-heap keeps the smallest element at the root (each parent <= children); a max-heap keeps the largest (each parent >= children). They're structurally identical — just the comparison direction flips. To simulate a max-heap with a min-heap-only library (like Python's `heapq`), negate the keys on the way in and out. The choice depends on which extreme you need cheap access to.

### Why is finding an arbitrary element in a heap O(n)?
Because the heap property only orders parents against children, not siblings or subtrees, there's no way to know which branch holds an arbitrary target — you may have to scan the whole array, O(n). This is the heap's deliberate limitation: it's specialized for accessing *one* extreme cheaply and sacrifices general search. If you need fast arbitrary lookup, use a balanced BST or a hash map (or maintain a side index into the heap).

### How do you implement "decrease-key" for something like Dijkstra?
Decrease-key lowers an element's priority and sifts it up to restore order — but it requires knowing the element's current index, so you keep a hash map from element to heap position, updated on every swap (O(log n) per operation). Most practical implementations skip this: they use *lazy deletion* — push a fresh entry with the new priority and, on pop, discard any entry whose priority is stale. Lazy deletion is simpler and usually fast enough, at the cost of a larger heap.

### How do you find the k largest elements in a stream?
Maintain a *min*-heap of size k. Push each incoming element; whenever the heap exceeds size k, pop the minimum. After processing, the heap holds the k largest, with the k-th largest at its root. This is O(n log k) time and O(k) space — far better than sorting all n elements (O(n log n)) when k is small. Using a min-heap (not a max-heap) is the counter-intuitive key: the root is the *weakest survivor*, the one to evict.

### How does heapsort work and what are its properties?
Heapsort builds a max-heap from the array in O(n), then repeatedly swaps the root (the max) with the last element, shrinks the heap by one, and sifts the new root down — extracting elements in descending order into the tail of the array. Total time is O(n log n) worst case, and it sorts *in place* with O(1) extra space. Its downside versus quicksort is worse cache behavior (jumpy access) and versus mergesort it's not stable, so it's less used in practice despite its guarantees.

### What is a d-ary heap and when is it useful?
A d-ary heap generalizes the binary heap so each node has d children instead of 2; node i's children occupy indices d*i+1 through d*i+d. Increasing d makes the tree shallower, so sift-up (insert/decrease-key) is faster — O(log_d n) — but sift-down (extract) is slower because you must compare against all d children. A 4-ary heap is a common sweet spot for decrease-key-heavy algorithms like Dijkstra, and it also tends to be more cache-friendly than a binary heap.

### When would you use a heap instead of sorting?
Use a heap when you need incremental or partial access to extremes rather than a full ordering: repeatedly extracting the min/max (Dijkstra, Prim, event simulation), top-k or the k-th largest (O(n log k) beats a full O(n log n) sort), streaming medians (two heaps), or merging k sorted lists. If you need the *entire* sequence sorted once and never touch it again, a sort is simpler. The heap wins when items arrive over time or you only need part of the order.

### How do you find the running median of a stream with heaps?
Maintain two heaps: a max-heap for the lower half of the values and a min-heap for the upper half, kept balanced in size (differing by at most one). The median is the top of the larger heap, or the average of the two tops when sizes are equal. Each insertion rebalances in O(log n), giving O(log n) per element and O(1) median queries — the canonical two-heap pattern.

### What real-world algorithms and systems rely on heaps?
Dijkstra's and Prim's algorithms use a min-heap priority queue to always expand the cheapest frontier node. OS and event-driven schedulers use heaps to pick the next task or timer by deadline. Huffman coding builds its tree by repeatedly extracting the two lowest-frequency nodes. Top-k analytics, k-way merges (used in external sorting and log merging), and bandwidth/rate schedulers all use heaps. Anywhere a greedy algorithm repeatedly needs "the best remaining option," a heap is the enabling structure.

## Tries (Prefix Trees)

### Summary

**What this topic covers**
A trie (prefix tree, pronounced "try") is a tree where each node represents a position in a string and each edge is labelled with one character. A word is a path from the root down to a node flagged as a word-end. The mental model: instead of storing whole strings, you store the *shared prefixes once* and branch only where strings diverge. It is the data structure behind autocomplete, spell-checkers, IP routing tables, and any problem where "words sharing a prefix" is the natural grouping.

**Key terms**
*Node* — a position; usually holds a children map and an `isEnd` (or `isWord`) boolean. *Edge/character* — the labelled transition to a child. *Prefix* — any path from the root; every node corresponds to exactly one prefix. *Word-end marker* — the flag distinguishing "car" as a stored word from "car" as merely a prefix of "cart". *Radix/Patricia trie (compressed trie)* — a trie where chains of single-child nodes are collapsed so each edge carries a *string*, not a single char. *Fanout / alphabet size* — number of possible children per node (26 for lowercase Latin, 256 for bytes).

**Core mechanics**
Each node stores children, typically as a hash map `char -> node` or a fixed array of size R (the alphabet). `insert(word)` walks/creates one node per character, then sets `isEnd` on the last node — O(L) for a length-L word, independent of how many words are already stored. `search(word)` walks the same path and checks `isEnd` at the end — O(L). `startsWith(prefix)` is identical but skips the `isEnd` check — it just asks "does this path exist?" That prefix query in O(L) with no dependence on N (the number of words) is the whole point. The invariant: the node reached by walking string S *is* the prefix S, and its subtree contains exactly the stored words beginning with S.

**Trade-offs**
Versus a hash set: a hash set gives O(L) exact lookup too (you still hash all L characters) but *cannot* answer "all words with prefix X", enumerate in sorted order, or find longest-prefix matches — a trie does all three naturally. The cost is memory: a naive array-per-node trie with R=26 wastes huge amounts of space on null pointers when the tree is sparse. Tries win on prefix-heavy workloads and dictionaries with lots of shared prefixes; they lose to a hash set when you only ever do exact-match lookups and memory is tight. Compressed (radix) tries reclaim most of the wasted space by merging single-child chains.

**Common confusions**
Believing a trie is faster than a hash set for exact lookup — both are O(L); the trie's advantage is *prefix operations*, not raw speed. Forgetting the `isEnd` flag and treating every node as a word (so "cat" being present wrongly implies "ca" is a word). Conflating node count with word count — a trie of N words has up to O(N*L) nodes, not N. Assuming O(1) operations — trie ops are O(L) in the key length, not constant. Thinking the alphabet must be 26 — it is whatever your symbol set is (bytes, Unicode, DNA bases, even bits in a binary trie).

**Why interviewers ask**
Tries separate candidates who reach for a hash map on every string problem from those who recognise when *structure over the key* buys something. The classic angle: "implement autocomplete" or "given a dictionary, find all words with prefix X" — the naive answer scans every word (O(N*L)); the trie answer is O(L + k) for k matches. Follow-ups probe memory (array vs map children, radix compression), the word-end subtlety, and when a trie is *not* worth it versus a plain sorted list plus binary search. It is a compact test of "do you pick the data structure the access pattern demands."

### What is a trie and how does it differ from a binary search tree?
A trie is a tree keyed on the *characters of a string*: each node is a prefix, each edge a character, and a word is a root-to-node path with an end marker. A BST is keyed on *whole-value comparisons* — each node holds a complete key and you branch left/right by comparing. In a trie the key is distributed across the path (the node "cat" is reached only via c-a-t), so shared prefixes are stored once and lookup cost depends on key length L, not tree size. A BST lookup is O(log N) comparisons where each comparison may itself scan the string; a trie lookup is O(L) with no dependence on N.

### How do you insert a word into a trie?
Start at the root. For each character, look for a child edge with that character; if it exists, descend into it, otherwise create a new node and descend. After consuming the last character, mark that final node `isEnd = true`. Cost is O(L) for a length-L word regardless of how many words the trie already holds, because you only touch the L nodes on this word's path.

```text
insert("cat"):
  root -> [c] -> [a] -> [t]*   (* = isEnd)
insert("car") reuses c,a then branches:
  root -> [c] -> [a] -> [t]*
                    \-> [r]*
```

### What is the difference between search and startsWith?
Both walk the trie one character at a time following child edges. `search(word)` succeeds only if the full path exists *and* the final node has `isEnd = true` — otherwise "car" would falsely match when only "cart" was inserted. `startsWith(prefix)` succeeds if the full path merely exists; it never checks `isEnd`, because a prefix need not be a stored word. Both are O(L) in the query length.

### Why is trie lookup O(L) and not O(1) or O(log n)?
You must inspect each of the L characters of the key to walk the corresponding L edges, so the lower bound is the key length itself. There is no dependence on N, the number of stored words — adding more words does not lengthen any single path. This is often quoted as "independent of dictionary size," which is the trie's real selling point, but it is not O(1): a very long key still costs O(L).

### When does a trie beat a hash set, and when does a hash set win?
A trie wins whenever you need *prefix* semantics: autocomplete, "all words starting with X", longest-prefix match (routing), or sorted enumeration. A hash set wins for pure exact-match membership when memory matters: both are O(L) per operation (a hash still reads all L characters to compute the hash), but the hash set has far less pointer overhead and better cache behaviour. Rule of thumb: no prefix queries -> hash set; prefix queries central -> trie.

### How does a trie power autocomplete?
Walk the trie down the typed prefix in O(P) for a prefix of length P; you land on the node representing that prefix. Every stored word beginning with the prefix is a descendant with `isEnd = true`, so you DFS/BFS the subtree collecting end-marked nodes. Total cost is O(P + size-of-subtree), or O(P + k) if you stop after k suggestions — vastly better than scanning the whole dictionary. Many implementations also cache the top-k completions or a popularity score at each node to rank suggestions.

### How do you store a node's children, and what is the trade-off?
Two common choices. A *fixed array* of size R (e.g. 26) gives O(1) child access with no hashing and implicit alphabetical order, but wastes a full array of mostly-null pointers per node — brutal on memory for sparse tries or large alphabets. A *hash map* `char -> node` stores only present children, saving space on sparse nodes, at the cost of hashing overhead and losing implicit ordering. Choose array for small dense alphabets where speed matters; hash map for large or sparse alphabets (Unicode, bytes).

### What is a compressed trie (radix / Patricia trie)?
A radix trie collapses every chain of single-child nodes into one edge labelled with the whole substring. So instead of `t -> e -> s -> t` as four nodes, a lone word "test" becomes a single edge "test". This dramatically cuts node count and memory when the trie has long non-branching runs, while preserving all prefix operations. The cost is more complex insert/split logic: inserting a word that diverges mid-edge requires splitting that edge into a shared prefix and two branches.

### How much memory does a trie use compared to storing the strings directly?
It depends entirely on prefix sharing. With heavy sharing (a real dictionary), common prefixes are stored once, which can *save* space versus N independent strings. With little sharing plus array children, a trie can *explode* — up to O(N * L * R) pointer slots in the pathological array-per-node case. The number of nodes is bounded by the total number of distinct prefixes across all words, up to O(sum of word lengths). Radix compression is the standard fix when memory is the concern.

### How do you delete a word from a trie?
Walk to the word's final node and clear its `isEnd` flag — the word is now logically absent. Optionally, prune bottom-up: if that node has no children and is not itself another word's end, remove it, then check its parent, and so on up the path until you hit a node that is either a branch point or an end marker. Pruning reclaims memory but you must stop the moment a node is still needed (has children or `isEnd`), or you would delete a valid shorter word or a shared prefix.

### How would you count the number of words with a given prefix efficiently?
Store a `count` (subtree word-count) in each node, incremented along the whole path on every insert and decremented on delete. Then "how many words start with X" is a single O(P) walk to X's node followed by reading its `count` — no subtree traversal at all. Without the cached count you would have to DFS the entire subtree, which is O(subtree size).

### How do you find the longest word in a trie that is a prefix of a given string?
This is the "longest-prefix match" used in IP routing and word segmentation. Walk the trie following the input string's characters; each time you pass through a node with `isEnd = true`, record it as the best match so far. Stop when you can no longer descend (no matching child) or you exhaust the input. The last recorded end marker is the longest stored word that prefixes the input — done in O(L) over the input length.

### Can a trie store things other than lowercase letters?
Yes — the "alphabet" is whatever symbol set you choose. Use 256 children for arbitrary bytes, the Unicode range (better via a hash map than a giant array) for international text, four symbols for DNA (A/C/G/T), or two children for a *binary trie* keyed on the bits of integers. Binary tries underpin fast XOR/maximum-pair problems and IP prefix matching, where you walk bit by bit from the most significant bit.

### When is a trie the wrong choice?
When you never do prefix work: for exact-match membership a hash set is smaller and simpler. When keys are long and mostly unique with little shared prefix, a naive trie wastes memory for no sharing benefit (reach for a radix trie or just a hash set). When the dataset is small, a sorted array plus binary search is often good enough and far simpler. And when keys are not naturally sequential/decomposable into a small symbol alphabet, the per-character model does not fit — a trie's value comes from exploiting structure in the key, and if there is none to exploit, it is pure overhead.

## Graphs

### Summary

**What this topic covers**
A graph is a set of *vertices* (nodes) connected by *edges* (relationships). Unlike trees, graphs allow cycles, disconnected pieces, multiple edges, and arbitrary connectivity — they model anything relational: roads, social networks, dependencies, state machines, the web. This topic is specifically about *how you represent a graph in memory* — adjacency list, adjacency matrix, edge list — and the terminology and trade-offs that decide which one you reach for, because that choice dominates the complexity of every algorithm you then run on it.

**Key terms**
*Vertex/node* and *edge*. *Directed* — edges have a direction (u->v is not v->u), as in a Twitter follow. *Undirected* — edges are symmetric, as in Facebook friendship. *Weighted* — edges carry a value (distance, cost, capacity). *Degree* — number of edges at a vertex; for directed graphs split into *in-degree* (arrows in) and *out-degree* (arrows out). *Sparse* vs *dense* — few edges (E close to V) vs many (E close to V^2). *Path*, *cycle*, *connected component*, *DAG* (directed acyclic graph). *Adjacency* — u and v are adjacent if an edge joins them.

**Core mechanics**
Three representations. An *adjacency list* stores, per vertex, a list of its neighbours — total space O(V + E), "is u adjacent to v?" costs O(degree(u)), and iterating a vertex's neighbours is optimal (you touch only real edges). An *adjacency matrix* is a V-by-V grid where cell [u][v] marks an edge (or holds its weight) — space O(V^2), edge existence and weight lookup are O(1), but iterating neighbours costs O(V) even for a vertex with one edge. An *edge list* is just an array of (u, v, weight) triples — space O(E), trivial to store and sort, but answering "are u and v adjacent?" means scanning all edges O(E). The invariant to remember: your representation fixes the cost of the two questions algorithms ask most — "who are u's neighbours?" and "is there an edge u-v?".

**Trade-offs**
Adjacency list is the default for the sparse graphs that dominate real problems: O(V + E) memory and neighbour iteration that traversals (BFS/DFS) love. Adjacency matrix shines only when the graph is dense, when you need O(1) edge-existence checks, or when you want to do linear-algebra-style operations (transitive closure, counting paths via matrix powers) — but its O(V^2) memory is fatal for large sparse graphs (a million vertices would need a trillion cells). Edge list is ideal when the algorithm consumes edges directly and doesn't need adjacency queries — Kruskal's MST sorts the edge list; Bellman-Ford relaxes every edge each round.

**Common confusions**
Defaulting to a matrix because it "looks simpler" and then blowing the memory budget on a sparse graph. Forgetting that an undirected edge appears *twice* in an adjacency list (once in each endpoint's list) and that the matrix is symmetric. Confusing in-degree and out-degree, or assuming a directed graph's total in-degree differs from its out-degree (they are equal — every edge contributes one of each). Thinking neighbour iteration on a matrix is cheap — it is O(V) per vertex, O(V^2) to sweep the whole graph even if there are only a handful of edges. Assuming a graph is connected or acyclic when the problem never promised it.

**Why interviewers ask**
Representation choice is the first real decision in almost every graph problem, and it silently sets the complexity of everything downstream — pick a matrix for a sparse million-node graph and your O(V^2) memory sinks you before you write a line of BFS. Interviewers want to hear you ask "sparse or dense? directed? weighted?" and justify the structure against the operations the algorithm needs. The classic angle: "how would you represent this graph, and why?" A crisp answer — adjacency list for sparse traversal, matrix for dense/O(1)-edge-check, edge list for edge-centric algorithms like Kruskal — signals you think about data layout, not just algorithms in the abstract.

### What is the difference between a graph and a tree?
A tree is a special connected, acyclic, undirected graph with exactly V-1 edges and a single path between any two nodes. A general graph relaxes all of that: it may have cycles, be disconnected (multiple components), have more than V-1 edges (up to V^2), be directed, and have multiple edges or self-loops. Every tree is a graph, but graph algorithms must additionally handle cycles (a `visited` set to avoid infinite loops) and disconnection (you may need to start a traversal from several vertices to reach everything).

### What is an adjacency list and what are its costs?
An adjacency list stores, for each vertex, a collection of its neighbours (often `Map<Vertex, List<Vertex>>` or an array of lists). Space is O(V + E). Iterating a vertex u's neighbours is O(degree(u)) — optimal, since you touch only actual edges. Checking "is u adjacent to v?" is O(degree(u)) because you scan u's list. It is the standard representation for sparse graphs and the natural fit for BFS/DFS, whose whole job is "visit my neighbours."

### What is an adjacency matrix and when is it worth the O(V^2) memory?
It is a V-by-V grid where entry [u][v] is 1 (or the edge weight) if an edge exists, else 0 (or infinity). Edge existence and weight lookup are O(1), and it is symmetric for undirected graphs. It costs O(V^2) memory regardless of edge count, and iterating a vertex's neighbours is O(V). It is worth it when the graph is *dense* (E near V^2, so you were going to use ~V^2 space anyway), when you need constant-time edge checks, or for matrix-algebra tricks like counting length-k paths via matrix powers.

### What is an edge list and what is it good for?
An edge list is simply an array of edges, each a tuple (u, v) or (u, v, weight). Space is O(E), and it is the simplest possible representation. Its strength is algorithms that process *all edges* rather than querying adjacency: Kruskal's MST sorts the edge list by weight then unions endpoints; Bellman-Ford relaxes every edge V-1 times. Its weakness is adjacency queries — "is u adjacent to v?" or "who are u's neighbours?" both require an O(E) scan.

### How do you decide which representation to use?
Ask three questions: is the graph sparse or dense, and what operations dominate? Sparse graph with traversal/neighbour queries -> adjacency list (the common default). Dense graph or frequent O(1) edge-existence checks -> adjacency matrix. Edge-centric algorithm that just iterates edges (Kruskal, Bellman-Ford) -> edge list. Then sanity-check memory: an adjacency matrix on a million-vertex sparse graph needs ~10^12 cells and is a non-starter, so the list wins by default at scale.

### What do "sparse" and "dense" mean, and where is the crossover?
Sparse means the edge count E is close to V (roughly O(V)); dense means E is close to the maximum V^2 (roughly O(V^2)). Most real-world graphs — road networks, social graphs, dependency graphs — are sparse: each node connects to a small, roughly constant number of others. The crossover for representation is memory: below ~V^2/word-size edges the adjacency list's O(V+E) beats the matrix's fixed O(V^2); only when E approaches V^2 does the matrix's constant-factor edge access justify its footprint.

### What is the degree of a vertex, and what is in-degree vs out-degree?
Degree is the number of edges incident to a vertex. In an undirected graph that is just the neighbour count (a self-loop counts twice by convention). In a directed graph it splits: *out-degree* is the number of edges leaving the vertex, *in-degree* the number entering. On Twitter, your out-degree is who you follow and your in-degree is your follower count. A handshake fact: the sum of all degrees equals 2E in an undirected graph, and total in-degree equals total out-degree equals E in a directed one.

### How do you represent a weighted graph in each format?
Adjacency list: store neighbours as (neighbour, weight) pairs instead of bare vertices. Adjacency matrix: put the weight in cell [u][v] and use a sentinel (0 or infinity, chosen so it can't be confused with a real weight) for "no edge". Edge list: each entry becomes a triple (u, v, weight). Weighted representation is what algorithms like Dijkstra (adjacency list plus a priority queue) and Floyd-Warshall (matrix) build on.

### How does an undirected graph differ from a directed one in memory?
In an undirected adjacency list every edge u-v is stored *twice* — v appears in u's list and u in v's — so an undirected list has 2E total entries. In a matrix the undirected graph is *symmetric* ([u][v] == [v][u]), so you can store just the upper triangle to halve memory. A directed graph stores each edge once (only u->v), giving an asymmetric matrix and single-entry adjacency lists. Forgetting the double-entry for undirected lists is a classic bug that makes edges effectively one-way.

### Why is iterating all neighbours slow on an adjacency matrix?
Because the matrix has no notion of "which cells are edges" — to find vertex u's neighbours you must scan its entire row of V cells and check each for a non-zero entry, an O(V) operation even if u has only one neighbour. Sweeping every vertex's neighbours is therefore O(V^2). An adjacency list stores only real edges, so the same sweep is O(V + E). For sparse graphs traversed with BFS/DFS this difference is the whole ballgame.

### What is a connected component, and how does it affect traversal?
A connected component is a maximal set of vertices all reachable from each other (for directed graphs the analogue is a *strongly* connected component, reachable both ways). A single BFS/DFS only explores the component containing its start vertex, so to cover a possibly-disconnected graph you loop over all vertices and launch a new traversal from any not-yet-visited one — the number of launches equals the number of components. Assuming the graph is one connected blob is a common source of "why did my algorithm miss half the nodes" bugs.

### What is a DAG and why does it matter?
A DAG is a *directed acyclic graph* — directed edges with no cycles. It matters because acyclicity unlocks a *topological ordering*: a linear sequence of vertices where every edge points forward. That ordering is exactly what you need for scheduling with dependencies, build systems, course prerequisites, and dynamic programming over the graph. Detecting whether a directed graph is a DAG (via cycle detection in DFS or Kahn's algorithm) is a frequent interview subtask.

### How much memory does each representation use for a graph with V=10^6 and E=2*10^6?
Adjacency list: O(V + E) ~ 3 million entries — a few tens of MB, entirely practical. Edge list: O(E) ~ 2 million triples — similar order, fine. Adjacency matrix: O(V^2) = 10^12 cells — a terabyte-plus even at one bit per cell, completely infeasible. This is the concrete reason the adjacency list is the default for large real-world (sparse) graphs and why proposing a matrix at this scale is an immediate red flag.

### If you need O(1) edge-existence checks on a sparse graph without an O(V^2) matrix, what do you do?
Keep the adjacency list but back each vertex's neighbours with a hash set instead of a plain list, or maintain a global hash set of (u, v) pairs. That gives expected O(1) "is u adjacent to v?" while preserving O(V + E) memory and O(degree) neighbour iteration — you get the matrix's fast edge check without its quadratic footprint. The trade is hashing overhead and slightly worse cache locality than a packed array; for most sparse graphs it is the pragmatic best of both worlds.

### How would you represent a graph that changes over time (edges added and removed)?
An adjacency list with hash-set neighbour collections handles dynamic edges well: adding or removing an edge is expected O(1), and neighbour iteration stays O(degree). An adjacency matrix also supports O(1) add/remove but only if V is fixed and small enough to afford O(V^2) memory — growing V means reallocating the whole grid. An edge list makes insertion O(1) (append) but deletion O(E) (find then remove), so it is poor for churn. For heavily dynamic graphs the hash-set-backed adjacency list is usually the right call.

## Union-Find (Disjoint Set Union)

### Summary

**What this topic covers**
Union-Find, also called Disjoint Set Union (DSU), maintains a collection of disjoint sets under two operations: `find(x)` (which set does x belong to?) and `union(x, y)` (merge the sets containing x and y). It answers *dynamic connectivity* — "are these two elements in the same group, and can I keep merging groups efficiently?" — in near-constant amortized time. The mental model: each set is a rooted tree; the root is the set's canonical representative, and two elements are in the same set exactly when they share a root.

**Key terms**
*Representative/root* — the canonical element identifying a set; `find` returns it. *parent[]* — the array where each element points to its parent, and a root points to itself. *find(x)* — follow parent pointers up to the root. *union(x, y)* — link the root of one set under the root of the other. *Path compression* — during `find`, re-point visited nodes directly at the root to flatten the tree. *Union by rank* — attach the shorter tree under the taller one (rank ~ an upper bound on height). *Union by size* — attach the smaller tree under the larger (size = element count). *Inverse Ackermann alpha(n)* — the astronomically slow-growing function bounding amortized cost.

**Core mechanics**
Represent the sets as an array `parent[]` where `parent[x]` is x's parent and a root satisfies `parent[x] == x`. `find(x)` walks up until it hits a root. `union(x, y)` calls `find` on both and, if the roots differ, points one root at the other. Naively this can degrade into a long chain making `find` O(n). Two optimizations fix that. *Union by rank/size* keeps trees shallow by always hanging the smaller/shorter tree under the bigger/taller one, bounding height at O(log n) on its own. *Path compression* flattens the path during every `find` by re-pointing each visited node straight at the root. Applied *together*, the amortized cost per operation drops to O(alpha(n)) — inverse Ackermann — which is at most 4 or 5 for any n that fits in the universe, i.e. effectively constant.

**Trade-offs**
DSU is spectacular at what it does — near-O(1) merges and same-set queries in O(n) space — but it is deliberately limited: it supports *union* but not *split/un-merge* (removing an edge is not supported without extra machinery), and it tells you *whether* two elements are connected, not the actual path between them. Compared to running BFS/DFS to test connectivity (O(V+E) per query), DSU shines when connectivity queries and merges are *interleaved and numerous* — it answers each in amortized O(alpha(n)) after cheap updates. If the graph is static and you ask connectivity once, a single traversal is simpler; if edges stream in and you must repeatedly test connectivity, DSU wins decisively.

**Common confusions**
Believing one optimization is enough — path compression alone gives O(log n) amortized, union by rank alone gives O(log n) worst case; you need *both* for the near-constant alpha(n) bound. Confusing rank with exact height (rank is an upper bound that path compression can render loose, which is fine — you don't update ranks during compression). Trying to *undo* a union or delete an element — vanilla DSU can't. Mutating a root's parent to a non-root and breaking the "roots point to themselves" invariant. And quoting O(1) as if it were literally constant rather than the amortized inverse-Ackermann bound.

**Why interviewers ask**
Union-Find is the cleanest example of amortized analysis paying off and of picking the exact structure a dynamic-connectivity problem demands. It is the engine of Kruskal's MST (union edges cheapest-first, skipping any that would form a cycle), of counting connected components, of detecting cycles in an undirected graph as you add edges, and of dynamic equivalence problems (grid percolation, account merging, friend circles). The classic angle: "as edges arrive one at a time, efficiently report the number of connected components" — the DSU answer is amortized O(alpha(n)) per edge. It reveals whether a candidate knows this specialized tool and can articulate *why* the two optimizations together buy near-constant time.

### What problem does Union-Find solve?
It solves *dynamic connectivity*: maintaining a partition of elements into disjoint sets while efficiently (1) merging two sets and (2) asking whether two elements are in the same set. The word "dynamic" is key — the groupings change over time as you union, and you interleave those merges with membership queries. It is the go-to structure when connectivity relationships are built up incrementally, as in "process these edges one by one and keep telling me how the components look."

### How are the sets represented internally?
As a forest of rooted trees stored in a single `parent[]` array. `parent[x]` holds x's parent; a root is its own parent (`parent[x] == x`). Every element in the same tree — reachable by walking parent pointers to the same root — belongs to the same set, and that root is the set's representative. This array-of-parents layout is why the whole structure fits in O(n) space and why operations are simple pointer walks.

### How do find and union work in their basic form?
`find(x)` follows parent pointers from x upward until it reaches a root (a node whose parent is itself) and returns that root. `union(x, y)` finds both roots; if they are equal the elements are already together and nothing happens, otherwise it points one root at the other, merging the two trees into one.

```text
find(x):
  while parent[x] != x:
    x = parent[x]
  return x

union(x, y):
  rx, ry = find(x), find(y)
  if rx != ry:
    parent[rx] = ry
```

### Why can naive Union-Find degrade to O(n) per operation?
Because naive `union` may always attach a tall tree under a small one, building a long chain — in the worst case a linked list of n elements. Then `find` on the deepest element walks all n parent pointers, so both `find` and any `union` that calls it become O(n). A sequence of such unions gives O(n) per operation, no better than a linked list. The two optimizations exist precisely to prevent this pathological chaining.

### What is union by rank?
Union by rank keeps trees shallow by always attaching the tree of *lower rank* under the root of *higher rank*, where rank is an upper bound on the tree's height. If both roots have equal rank, pick either as the new root and increment its rank by one. Because you never make the taller tree taller unnecessarily, height stays O(log n). Rank is a cheap proxy for height — you don't recompute actual heights, you just carry this bound.

### What is union by size, and how does it differ from union by rank?
Union by size attaches the tree with *fewer elements* under the root of the larger tree, tracking a `size[]` count per root instead of a rank. It achieves the same O(log n) height bound and the same asymptotic guarantees as union by rank. The practical difference is what you track: size gives you the element count of each set for free (useful when the problem asks "how big is this component?"), whereas rank tracks a height bound. Either works; pick size when you need component sizes.

### What is path compression?
Path compression flattens the tree during `find`: once you locate the root, you re-point every node visited on the way up to point *directly* at the root. Subsequent `find` calls on those nodes then reach the root in one hop. It costs nothing extra asymptotically (you already walked the path) and dramatically shortens future traversals.

```text
find(x):        # with path compression
  if parent[x] != x:
    parent[x] = find(parent[x])   # re-point x straight at root
  return parent[x]
```

### Why do you need both path compression and union by rank/size?
Each optimization alone gives only O(log n) amortized per operation — union by rank bounds height at O(log n), and path compression alone also yields O(log n) amortized. It is the *combination* that collapses the amortized cost to O(alpha(n)), inverse Ackermann, which is effectively constant. They are complementary: union by rank/size keeps trees from growing tall in the first place, and path compression flattens whatever depth does occur. Using only one leaves logarithmic factors on the table.

### What is the inverse Ackermann function and why is it "effectively constant"?
The Ackermann function grows unimaginably fast, so its inverse alpha(n) grows unimaginably *slowly* — alpha(n) is at most 4 for any n up to roughly the number of atoms in the observable universe, and 5 for absurdly larger values. So although O(alpha(n)) is technically not O(1), for every input you will ever run it is bounded by a tiny constant. That is why practitioners describe optimized Union-Find as "near-constant" or "essentially O(1) amortized" per operation.

### How is Union-Find used in Kruskal's algorithm for MST?
Kruskal builds a minimum spanning tree by sorting all edges by weight ascending, then greedily adding each edge *unless* it would create a cycle. Union-Find is the cycle test: for edge (u, v), if `find(u) == find(v)` the endpoints are already connected so adding the edge forms a cycle — skip it; otherwise `union(u, v)` and keep the edge. After sorting (O(E log E)), the DSU work is O(E * alpha(V)), so DSU is the piece that makes the connectivity checks cheap enough for the whole algorithm to be efficient.

### How do you count connected components with Union-Find?
Initialize a counter to n (every element starts as its own singleton set). Each time a `union` actually merges two *different* sets, decrement the counter by one; if the two elements were already in the same set, leave it unchanged. After processing all edges, the counter holds the number of connected components. This gives amortized O(alpha(n)) per edge, ideal for the streaming-edges version of the problem.

### How does Union-Find detect a cycle in an undirected graph?
Process edges one at a time. For each edge (u, v), call `find` on both endpoints: if they already share a root, this edge connects two already-connected vertices and therefore closes a cycle — report it. Otherwise `union(u, v)` and continue. This detects the first cycle-forming edge in amortized O(alpha(n)) per edge, and is exactly the check Kruskal uses to *avoid* cycles. (Note it applies to undirected graphs; directed-cycle detection uses DFS coloring instead.)

### Can Union-Find split a set or remove an element?
Not in its standard form — it supports only *union* (merge), never split or delete. Path compression and lazy tree structure make undoing a merge impossible without extra machinery, because you have thrown away the history of how the tree was built. If you need un-merge, you use a different approach: an offline technique (process operations in reverse so deletions become additions), a *rollback/undoable* DSU that forgoes path compression so it can record and revert changes, or a fully separate dynamic-connectivity structure. Interviewers sometimes probe this limitation to see if you know DSU's boundaries.

### When would you use Union-Find instead of BFS/DFS for connectivity?
Use DSU when connectivity queries and merges are *interleaved and numerous* — edges arrive over time and you must repeatedly answer "are these connected?" or "how many components now?" Each operation is amortized O(alpha(n)) after cheap array updates, far better than re-running an O(V+E) traversal per query. Use BFS/DFS when the graph is static and you need connectivity once, or when you need the *actual path* between nodes — which DSU cannot give you, since it only tracks membership, not routes.

### What are some classic problems where Union-Find is the right tool?
Kruskal's MST (cycle-free greedy edge selection); counting connected components or "number of provinces / friend circles"; detecting a redundant edge that creates a cycle; dynamic equivalence problems like "accounts merge" (unioning accounts sharing an email) and "equations satisfiability" (a==b, b!=c consistency); grid problems like number-of-islands variants and percolation (union adjacent open cells, ask if top connects to bottom); and any "process a stream of merge operations, answer same-group queries" scenario. The tell is *dynamic grouping with same-set queries* — that is DSU's home turf.

## Segment Trees & Fenwick Trees (BIT)

### Summary

**What this topic covers**
This topic covers the two workhorse structures for range queries with updates: the segment tree and the Fenwick tree (Binary Indexed Tree, or BIT). Both answer "aggregate over range `[l, r]`" while the underlying array keeps mutating, in `O(log n)` per operation. The mental model: a plain prefix-sum array gives `O(1)` range-sum but `O(n)` updates; these structures buy back cheap updates by storing partial aggregates in a tree instead of one flat cumulative row.

**Key terms**
*Range query*: fold an associative operation (sum, min, max, gcd) over `a[l..r]`. *Point update*: change one element. *Range update*: add a delta to every element in `[l, r]`. *Prefix sum*: cumulative array where `pre[i] = a[0]+...+a[i]`. *Segment tree*: a binary tree where each node owns an interval and stores its aggregate. *Lazy propagation*: deferring a pending range update on a node until a child is actually visited. *Fenwick tree / BIT*: a flat array that stores partial sums indexed by the low bit trick, supporting prefix-sum and point-update in `O(log n)`.

**Core mechanics**
A segment tree over `n` leaves is a near-complete binary tree with `~2n` to `4n` nodes; each internal node stores `agg(left child, right child)`. A query walks down splitting `[l, r]` into `O(log n)` canonical node-intervals and folds their aggregates. A point update rewrites one leaf and re-folds its `O(log n)` ancestors. Range updates need lazy propagation: you stamp the delta on the highest fully-covered nodes and push it down only when a later query descends through them. A Fenwick tree is subtler and tighter: `tree[i]` holds the sum of a block of length `i & (-i)` ending at `i`. Prefix-sum walks down by `i -= i & (-i)`; update walks up by `i += i & (-i)`. Both loops run `O(log n)` iterations.

**Trade-offs**
Prefix-sum array: `O(1)` query, `O(n)` update, `O(n)` space, immutable-friendly. BIT: `O(log n)` both, `~n` words, tiny constant, sums/invertible ops only. Segment tree: `O(log n)` both, `~4n` nodes plus a lazy array, but handles *any* associative op and supports range updates and range-min/max where a BIT struggles. Rule of thumb: static array with only queries, use prefix sums; point-update plus prefix/range-sum, use a BIT for its speed and simplicity; range-min/max, range assignment, or range-add-range-query, reach for a segment tree with lazy propagation.

**Common confusions**
Candidates conflate "prefix sum" with "Fenwick tree" — a prefix-sum array can't be updated cheaply; that's the whole reason BIT exists. Another trap: thinking a BIT does range-min. It can't in general, because min isn't invertible (you can't subtract a prefix), whereas range-sum works because sum is invertible. People also forget a segment tree needs lazy propagation for range updates — without it, a range-add is `O(n log n)`. And the `4n` sizing: a recursive segment tree can touch indices up to `~4n`, so undersizing the array corrupts it.

**Why interviewers ask**
These structures separate candidates who memorized LeetCode from those who understand the query-vs-update tension. The classic angle: "range sum with updates" — a strong candidate names all three options and picks based on op-invertibility and update type, rather than reflexively coding a segment tree. Bit-manipulation fluency (`i & -i`) and the invariant reasoning behind lazy propagation are strong senior signals.

### What problem do segment trees and Fenwick trees solve that a plain array doesn't?

They solve range queries with mutation. A plain array gives `O(1)` element access but `O(n)` range-sum. A prefix-sum array flips that: `O(1)` range-sum but `O(n)` to apply any update, because one changed element invalidates every downstream cumulative entry. Segment trees and BITs sit in the middle: `O(log n)` for both range query and update, which is the right trade when the data mutates and you query ranges repeatedly.

### How does a Fenwick tree compute a prefix sum in O(log n)?

Each index `i` in the BIT stores the sum of a contiguous block ending at `i` whose length is `i & (-i)` — the value of its lowest set bit. To get `prefix(i)`, you accumulate `tree[i]`, then jump to `i -= i & (-i)`, repeating until `i` hits 0. Each step strips one set bit, so the loop runs at most as many times as there are bits in `i`, giving `O(log n)`.

```text
prefix(i):
  s = 0
  while i > 0:
    s += tree[i]        # block ending at i
    i -= i & (-i)       # drop lowest set bit
  return s
```

### How does a Fenwick tree apply a point update?

To add `delta` to element `i`, you update every BIT block that covers `i` by walking *up*: `tree[i] += delta`, then `i += i & (-i)`, repeating while `i <= n`. Adding the low bit jumps to the next block that contains `i`. Like the prefix walk, it touches `O(log n)` entries. Note the asymmetry: prefix-sum walks by *subtracting* the low bit, update walks by *adding* it.

### Why is a Fenwick tree 1-indexed?

The low-bit trick `i & (-i)` needs a nonzero index to make progress; at `i = 0` the low bit is 0 and the loop would never advance (or spin). One-indexing makes 0 the natural sentinel that terminates the prefix walk and keeps the block math clean. If your data is 0-indexed, you shift by one when talking to the BIT.

### How do you get a range sum [l, r] from a Fenwick tree?

Compute `prefix(r) - prefix(l-1)`. This works because sum is *invertible*: the contribution of `a[0..l-1]` can be subtracted off. That invertibility requirement is exactly why a vanilla BIT handles sum, xor, and count but not min or max — you can't recover `min(a[l..r])` from `min(prefix r)` and `min(prefix l-1)`.

### How is a segment tree structured in memory?

Usually a flat array of size `~4n`, treating it as an implicit binary tree: node `1` is the root, node `k` has children `2k` and `2k+1`. Each node owns an interval; leaves map to single elements, internal nodes store `agg(children)`. The `4n` sizing comes from the tree not being perfectly balanced when `n` isn't a power of two — the recursion can address indices up to nearly `4n`, so a `2n` array can overflow.

### How does a segment tree answer a range query in O(log n)?

The query `[l, r]` recurses from the root. If a node's interval is fully inside `[l, r]`, return its stored aggregate. If it's disjoint, return the identity (0 for sum, +inf for min). Otherwise recurse into both children and combine. The key fact: `[l, r]` decomposes into `O(log n)` fully-covered "canonical" nodes across the tree, so at most `~2 log n` nodes are visited.

### What is lazy propagation and why do you need it?

Lazy propagation defers range updates. Without it, adding a delta to `[l, r]` would touch every leaf — `O(n)`. Instead, when a node's interval is fully covered by the update, you adjust that node's aggregate and stamp a "pending" delta in a parallel lazy array, then stop. The pending delta is *pushed down* to children only when a later operation actually descends through that node. This keeps range-update and range-query both at `O(log n)`.

### When would you pick a BIT over a segment tree?

When the operation is invertible (sum, count, xor), you only need point updates plus prefix/range queries, and you care about constant factors or code brevity. A BIT is roughly half the memory of a segment tree, has a tiny constant, and is a dozen lines. Reach for a segment tree only when you need non-invertible aggregates (min/max/gcd), range updates with lazy propagation, or you're storing richer per-node state.

### Can a Fenwick tree do range updates?

Yes, with a trick: use a *difference array* representation. To add `delta` to `[l, r]`, do `update(l, +delta)` and `update(r+1, -delta)`; then `prefix(i)` of the BIT gives the current value at index `i`. For range-update *and* range-query, you maintain two BITs (the standard "range update range query" construction). It's elegant but if you also need min/max, a lazy segment tree is the cleaner answer.

### Why is min/max harder than sum for these structures?

Because min and max are not invertible. Range-sum works on a BIT via `prefix(r) - prefix(l-1)` — you subtract off the unwanted prefix. There's no "subtract" for min: knowing `min(a[0..r])` and `min(a[0..l-1])` tells you nothing about `min(a[l..r])`. Segment trees handle min/max fine because they *combine* canonical sub-intervals directly rather than subtracting prefixes, but a plain BIT cannot.

### What's the space complexity of each option?

Prefix-sum array: exactly `n` (or `n+1`). Fenwick tree: `n+1` words — as lean as it gets for a mutable structure. Segment tree: `~2n` to `4n` nodes, doubled again if you carry a lazy array. So for pure point-update sum queries, the BIT is the memory-frugal choice; the segment tree pays for its generality in space.

### How would you find the k-th smallest element with a Fenwick tree?

Build a BIT over value-frequencies (index = value, stored = count). Then binary-search on the bit positions: walk down from the highest bit, at each step tentatively adding the low-bit block and checking whether its cumulative count is still below `k`. This "binary lifting on a BIT" finds the k-th element in `O(log n)` instead of `O(log^2 n)` for a naive binary search over prefix queries — a classic senior follow-up.

### When does a plain prefix-sum array still beat both?

When the data is static (built once, never mutated) and you only run range-sum queries. Then `O(1)` per query with `O(n)` preprocessing and `O(n)` space is unbeatable — no tree needed. The moment updates enter, or you need range-min on a static array (where a sparse table gives `O(1)` min queries), the calculus changes. Always ask "does it mutate?" before reaching for a tree.

### How do you extend a segment tree to store more than one aggregate per node?

Store a small struct per node — for example, sum, min, max, and count — and define a `merge(left, right)` that combines all fields at once. Queries and updates are unchanged in shape; only the combine function grows. This is how you get "range sum and range max simultaneously" or maintain the max-subarray aggregate per node. The rule: as long as your state has an associative `merge` and an identity, a segment tree can carry it.

## Skip Lists & Balanced-Tree Alternatives

### Summary

**What this topic covers**
This topic covers the skip list — a probabilistic, multi-level linked list that delivers `O(log n)` expected search, insert, and delete without the rotation machinery of a balanced binary search tree — plus its cousins the treap and other randomized BSTs. The mental model: take a sorted linked list, then add express lanes above it so search can skip ahead in big strides instead of crawling node by node.

**Key terms**
*Skip list*: a stack of sorted linked lists where each higher level is a sparse "express lane" over the one below. *Level / tower*: how many lanes a given node participates in; chosen randomly at insert. *Promotion probability `p`*: the coin-flip chance (usually `0.5`) a node is copied up to the next level. *Expected time*: average over the randomness, not a guaranteed worst case. *Treap*: a BST that also obeys a heap on random priorities, staying balanced in expectation. *Randomized BST*: any tree that uses randomness (priorities or random rebuild choices) instead of strict balance rules to stay `O(log n)`.

**Core mechanics**
A skip list keeps `~log n` levels. Level 0 is the full sorted list; each node is promoted to level `k+1` with probability `p`, so level 1 has `~n/2` nodes, level 2 has `~n/4`, and so on. Search starts at the top-left, moves right while the next key is `<=` target, and drops a level when it would overshoot — descending `~log n` levels and taking `O(1/p)` expected steps per level, so `O(log n)` overall. Insert finds the position, flips coins to pick the new node's height, and splices it into every level up to that height by rewiring forward pointers. No rotations, no rebalancing pass — just local pointer surgery.

**Trade-offs**
Versus a red-black or AVL tree, a skip list trades *guaranteed* `O(log n)` for *expected* `O(log n)`, and in return you get dramatically simpler code — no rotation cases, no color invariants. It uses extra pointers (`~1/(1-p)` per node on average, `~2` at `p=0.5`), so more memory than a lean BST. It shines for concurrent structures: because updates are local pointer swaps, lock-free and fine-grained-locking implementations are far easier than rebalancing a shared tree. That's why Redis uses skip lists for sorted sets and why `java.util.concurrent` ships `ConcurrentSkipListMap`.

**Common confusions**
The big one: skip lists are `O(log n)` *expected*, not worst case — an unlucky run of coin flips can degrade a search, though the probability is astronomically small for large `n`. Candidates also over-focus on memory ("wasteful pointers") while missing the real win: concurrency and implementation simplicity. Another confusion is thinking treaps and skip lists are unrelated — both replace deterministic balancing with randomness; the treap does it inside a BST via priorities, the skip list via node heights.

**Why interviewers ask**
Skip lists probe whether you understand that randomization can replace complex invariants, and whether you know what real systems actually use (Redis, LevelDB memtables, Java's concurrent maps). The classic angle: "implement an ordered map without a balanced BST" or "why does Redis use a skip list for ZSET instead of a tree?" — the expected answer touches range queries, rank operations, and lock-friendliness.

### What is a skip list in one sentence?

A skip list is a sorted linked list augmented with multiple levels of "express lane" forward pointers, so search can skip over many elements at once and reach any key in `O(log n)` expected time. It's an ordered dictionary built from probabilistic layering rather than tree balancing.

### How does search work in a skip list?

Start at the head of the top (sparsest) level. Move right as long as the next node's key is less than or equal to the target. When the next key would overshoot, drop down one level and continue. You keep dropping until level 0, where you either land on the key or confirm it's absent. Each level contributes `O(1)` expected horizontal steps and there are `~log n` levels, so search is `O(log n)` expected.

### How are node heights chosen, and why randomly?

At insertion, a node's height is set by repeated coin flips: start at level 1, and while a flip comes up heads (probability `p`, typically `0.5`), promote it one level higher. This yields a geometric distribution — about half the nodes stay at level 1, a quarter reach level 2, and so on. The randomness makes the level populations self-balancing *in expectation* without the structure ever inspecting global shape or rebalancing.

### Why is a skip list O(log n) expected but not worst case?

Because heights come from coin flips, a pathological run could, in principle, make many nodes the same height and collapse the express lanes, degrading a search toward `O(n)`. But that requires an extraordinarily unlikely sequence of flips; for large `n` the probability of significant deviation is vanishingly small. So the *expected* and *with-high-probability* bounds are `O(log n)`, while the absolute worst case is `O(n)` — just never observed in practice.

### Why would you choose a skip list over a balanced BST?

Simplicity and concurrency. A red-black tree's insert/delete has many rotation and recoloring cases that are error-prone to implement; a skip list insert is just "find position, flip coins, splice pointers." And because updates are local, concurrent skip lists (lock-free or lane-locked) are far more tractable than concurrently rebalancing a tree. If you need an ordered map under contention, a skip list is often the pragmatic winner.

### Why does Redis use a skip list for sorted sets?

Redis ZSETs need ordered-by-score access, range queries, and rank ("give me elements ranked 10 to 20"). A skip list gives `O(log n)` insert/delete/search plus efficient range scans by walking level 0 forward, and it augments cleanly with span counts to support `O(log n)` rank queries. Redis pairs it with a hash map (member to score) so both point lookups and ordered operations are fast. The authors also cite simpler implementation than a balanced tree.

### How does a skip list support rank / order-statistic queries?

Store, on each forward pointer, the number of level-0 nodes it skips (its "span"). During a search you sum the spans of every forward pointer you traverse; that running sum is the rank of the node you land on. This turns "what's the index of key X?" and "give me the k-th element" into `O(log n)` operations — the same augmentation an order-statistic tree does with subtree sizes.

### What's the memory overhead of a skip list?

Each node carries forward pointers equal to its height. With promotion probability `p`, the expected number of pointers per node is `1/(1-p)` — at `p=0.5` that's about 2 pointers per node on average. So a skip list uses more pointer memory than a lean BST (which has 2 child pointers regardless), but the overhead is a small constant, and lowering `p` trades a little speed for less memory.

### What does the promotion probability p control?

`p` tunes the speed/space trade-off. Higher `p` (denser upper levels) means fewer horizontal steps per level but more levels and more pointers — more memory, faster-ish search. Lower `p` means fewer pointers and levels but more steps per level. `p = 0.5` is the common default (halving each level); `p = 0.25` is also popular in practice because it cuts memory with only a modest constant-factor cost to search time.

### What is a treap and how does it stay balanced?

A treap is a binary search tree that is *also* a heap on randomly assigned priorities: it obeys BST order on keys and heap order on priorities. Because priorities are random, the tree's shape matches what you'd get by inserting keys in random order — expected height `O(log n)`. Insertions do a normal BST insert then rotate the node up until its priority satisfies the heap property; the randomness of priorities keeps it balanced in expectation without deterministic rules.

### How does a skip list compare to a treap?

Both replace strict balancing with randomness, so both give `O(log n)` expected operations with simple code. A treap is a genuine BST (pointer-per-child, recursion-friendly, easy to split/merge on a key). A skip list is a layered linked list (better for forward range scans and easier concurrency). Choose a treap when you want tree operations like split/merge; choose a skip list for ordered range iteration and concurrent access.

### Can you delete from a skip list efficiently?

Yes. Search for the node while recording, at each level, the last node before the target (the "update" pointers). If found, unlink it at every level it participates in by rewiring those recorded predecessors' forward pointers past it. Then trim any now-empty top levels. Like insert, it's `O(log n)` expected and involves only local pointer changes — no global rebalancing.

### Are skip lists cache-friendly?

Less so than a contiguous array or a B-tree. Following forward pointers chases scattered heap nodes, causing cache misses, and the multiple levels add indirection. B-trees pack many keys per cache-line-sized node and are the on-disk/in-memory choice when locality dominates. Skip lists win on implementation simplicity and concurrency, not raw cache locality — which is why databases favor B-trees for indexes but skip lists for in-memory ordered sets.

### Where are skip lists used in real systems besides Redis?

LevelDB and RocksDB use a skip list for the in-memory "memtable" that buffers writes before flushing to disk — its concurrent-friendly, ordered nature fits a write-heavy log. Java's `ConcurrentSkipListMap` and `ConcurrentSkipListSet` are the standard lock-free-ish ordered concurrent collections. Anywhere you need an ordered structure with cheap concurrent updates, a skip list is a common pick.

### If skip lists are only O(log n) expected, why trust them in production?

Because the probability of meaningful deviation shrinks exponentially with `n`, and the randomness is under your control (it comes from an internal RNG, not adversarial input), so there's no user-triggerable worst case the way a hash table has collision attacks. For large `n` the bound holds with overwhelming probability, and the operational simplicity plus concurrency benefits outweigh the theoretical worst case that essentially never materializes.

## Probabilistic Data Structures

### Summary

**What this topic covers**
This topic covers structures that trade exactness for dramatic space savings by allowing controlled, bounded error: Bloom filters (approximate set membership), Count-Min Sketch (approximate frequencies), and HyperLogLog (approximate cardinality). The mental model: instead of storing the elements, store a compact fingerprint that answers a specific question — "have I seen this?", "how many times?", "how many distinct?" — with a small, tunable probability of being wrong.

**Key terms**
*Bloom filter*: a bit array plus `k` hash functions giving membership tests with false positives but no false negatives. *False positive*: says "present" when absent. *False negative*: says "absent" when present. *Counting Bloom filter*: replaces bits with small counters so deletion is possible. *Count-Min Sketch*: a 2D counter grid estimating item frequencies with over-counting only. *HyperLogLog (HLL)*: estimates the number of distinct items using the position of the leftmost set bit in hashes. *Cardinality*: the count of distinct elements.

**Core mechanics**
A Bloom filter hashes each inserted key with `k` independent hashes and sets those `k` bits in an `m`-bit array. Membership hashes the query and checks whether *all* `k` bits are set — if any is 0 the item is definitely absent; if all are 1 it's *probably* present (other items may have set those bits). Nothing is ever removed, so false negatives are impossible. Count-Min Sketch uses `d` rows, each with its own hash into `w` buckets; increment all `d` cells on insert, and estimate a count by taking the *minimum* of the `d` cells (min cancels collision inflation). HyperLogLog buckets hashes and, per bucket, remembers the maximum number of leading zeros seen — a run of `r` leading zeros suggests `~2^r` distinct items — then harmonic-means across buckets for a robust cardinality estimate.

**Trade-offs**
The universal trade is space and speed for accuracy. A Bloom filter storing set membership uses `~1.44 * log2(1/epsilon)` bits per element regardless of key size — a URL set that would be gigabytes as strings becomes megabytes of bits — but you accept an `epsilon` false-positive rate and lose the ability to enumerate or (in the plain version) delete. HyperLogLog counts *billions* of distinct items in `~1.5 KB` with a few-percent error — impossible to match exactly without storing every distinct key. The catch is always the same: you cannot get the elements back, and answers carry bounded error, so these fit "big and approximate is fine" workloads, not "must be exact."

**Common confusions**
The classic error is claiming Bloom filters have false negatives — they don't; the asymmetry (false positives yes, false negatives no) is the whole point and dictates where they're safe. People also think you can delete from a plain Bloom filter — you can't, because clearing a bit might unset a bit shared with another key (that's what the Counting Bloom fixes). Another mix-up: conflating Count-Min (frequencies) with HyperLogLog (distinct count) — different questions, different sketches. And overfilling: a Bloom filter's error rate degrades as it fills past its designed load, so you must size for expected `n` up front.

**Why interviewers ask**
These structures reveal whether a candidate can reason about *acceptable error* and space/accuracy trade-offs at scale — a systems-design maturity signal. The classic angle: "how would you check if a URL was already crawled across a billion-page crawl?" or "count unique visitors without storing every visitor ID." A strong answer names the right sketch, states the error type, and places the filter correctly (e.g. Bloom filter in front of a slow disk/DB to skip lookups for definitely-absent keys).

### What is a Bloom filter and what does it answer?

A Bloom filter is a compact probabilistic set that answers "is this element possibly in the set?" It's an `m`-bit array with `k` hash functions. It gives one of two answers: "definitely not present" or "possibly present." It never stores the elements themselves, so it's tiny relative to the data — at the cost of an occasional false positive.

### Why does a Bloom filter have false positives but never false negatives?

Insertion only ever *sets* bits, never clears them. So every bit that should be set for a present element is guaranteed set — a query for a present element always finds all `k` bits set, hence no false negatives. A false positive happens when a *different* set of insertions happens to have set all `k` of a query's bits; the filter can't tell those bits apart from a genuine membership, so it says "possibly present." Absence is certain, presence is probabilistic.

### How does a membership check work mechanically?

Hash the query key with the same `k` hash functions to get `k` bit positions. Check each: if *any* of those bits is 0, the element was definitely never inserted — return "absent." If *all* `k` are 1, return "possibly present." The one-zero-means-absent rule is what makes the no-false-negative guarantee hold.

### Why can't you delete from a standard Bloom filter?

Because bits are shared across elements. Clearing the `k` bits of the element you want to remove might zero a bit that another still-present element also relies on, which would then produce a false *negative* — breaking the core guarantee. Plain Bloom filters are therefore insert-only. To support deletion you use a Counting Bloom filter.

### How does a Counting Bloom filter enable deletion?

It replaces each bit with a small counter (often 4 bits). Insert increments the `k` counters; delete decrements them. A slot is "set" if its counter is greater than 0. Because you decrement rather than blindly clear, removing one element doesn't wipe out a slot another element still needs. The cost is several times more memory than a plain bit-array Bloom filter, plus a small risk of counter overflow.

### How do you choose the size m and hash count k?

Given expected element count `n` and target false-positive rate `epsilon`, the optimal bit count is `m = -(n * ln(epsilon)) / (ln 2)^2`, and the optimal number of hashes is `k = (m/n) * ln 2`. Intuitively, `k` should set about half the bits — too few hashes underuses the array, too many saturate it. A handy result: the optimal filter needs about `1.44 * log2(1/epsilon)` bits per element, independent of how big the keys are.

### What determines a Bloom filter's false-positive rate in practice?

The fill ratio. As you insert more elements, more bits flip to 1, so the chance that a random query's `k` bits are all coincidentally set rises. The rate is roughly `(1 - e^(-k*n/m))^k`. This means a filter sized for `n` elements degrades if you push far past `n` — which is why you must size for the expected load up front and, if you can't bound `n`, use a scalable Bloom filter that adds capacity.

### Where do Bloom filters actually get used?

As a cheap negative cache in front of an expensive lookup. Examples: a database or LSM-tree (Cassandra, RocksDB) checks a Bloom filter before hitting disk for a key — "definitely not present" skips the disk read entirely. A web crawler uses one to avoid re-fetching URLs. A CDN or browser checks a Bloom filter of malicious URLs. The pattern: put the filter where a "definitely absent" answer lets you skip slow work, and only pay the slow path on a hit (real or false).

### What is a Count-Min Sketch and what does it estimate?

A Count-Min Sketch estimates the frequency of items in a stream using sub-linear space. It's a grid of `d` rows by `w` columns of counters, with one hash function per row. To record an item, increment one cell per row (the column its row-hash picks). To estimate its count, read the cell in each row and take the *minimum*. It over-counts (never under-counts) because collisions only add to counters.

### Why take the minimum in a Count-Min Sketch?

Each row's cell for an item may be inflated by *other* items that collided into the same bucket — so every estimate is greater than or equal to the true count. Since collisions differ across rows, the least-inflated row gives the tightest estimate, so the minimum across rows is the best (and still an over-estimate). More rows lower the chance that *all* rows collided badly, tightening the bound.

### What is HyperLogLog and what problem does it solve?

HyperLogLog estimates *cardinality* — the number of distinct elements — in a massive stream using a tiny, fixed amount of memory (about 1.5 KB for billions of items with ~2% error). The intuition: hash each element and look at the run of leading zeros in the hash; seeing a hash with `r` leading zeros is evidence you've observed roughly `2^r` distinct values, because such hashes are rare. It answers "how many unique?" without storing the uniques.

### How does HyperLogLog avoid being fooled by one lucky hash?

Two ways. First, it splits elements into many buckets (by the first few hash bits) and tracks the max leading-zero count *per bucket*, then combines the buckets — so one freak long run only affects one bucket. Second, it combines buckets with the *harmonic mean*, which suppresses the influence of outlier buckets. Plus bias corrections for very small and very large cardinalities. The result is a stable estimate with predictable error around `1.04/sqrt(m)` for `m` buckets.

### Can you merge two probabilistic structures? Why does that matter?

Yes, and it's a major operational win for distributed systems. Two Bloom filters over the same `m` and hashes merge with a bitwise OR. Two HyperLogLogs merge by taking the per-bucket maximum. Count-Min Sketches merge by adding cells. This means each shard computes its own sketch and you combine them at the end to get a global answer — count unique visitors across 100 servers by merging 100 HLLs, no central set required.

### When should you NOT use a probabilistic structure?

When errors are unacceptable or you need to enumerate elements. Don't use a Bloom filter where a false positive causes a correctness or safety failure with no verification step (e.g. "is this password breached" where a false positive wrongly blocks a valid password — unless you accept that). Don't use HLL when you need the *exact* distinct count for billing or audits. And none of these let you list the members back — if you need the actual data, store the actual data.

### How would you design "has this URL been crawled?" for a billion-page crawl?

Use a Bloom filter as the front-line check. Before crawling a URL, test the filter: "definitely not seen" means crawl it (then insert it); "possibly seen" means skip, accepting a small false-positive rate that occasionally skips a genuinely new URL — usually fine for a crawler. The filter fits in memory (megabytes for a billion URLs at a modest error rate) where a real hash set of URL strings would need many gigabytes. If skipping a new URL is unacceptable, back the filter with an exact store checked only on filter hits.

### How do you pick between Bloom, Count-Min, and HyperLogLog?

Match the question to the sketch. "Is X in the set?" — Bloom filter (membership). "How many times has X appeared?" — Count-Min Sketch (frequency). "How many *distinct* things have I seen?" — HyperLogLog (cardinality). They're not interchangeable: a Bloom filter can't count occurrences, an HLL can't test individual membership, and Count-Min can't tell you the number of distinct keys. Interviewers love this triage because it shows you map the problem to the right approximate tool rather than reaching for an exact structure that won't scale.

## B-Trees & B+ Trees

### Summary

**What this topic covers**
B-trees and B+ trees are balanced, multiway search trees built for one specific reality: your data lives on a device where a single access (a disk seek, an SSD page read, a network round-trip to storage) costs thousands of times more than a CPU comparison. Instead of a binary node with 1 key and 2 children, a B-tree node holds hundreds or thousands of keys and children, so the tree stays extremely shallow. The mental model: a self-balancing search tree redesigned to minimize the number of *blocks touched*, not the number of comparisons. This is the structure under almost every relational database index and many filesystems.

**Key terms**
*Order / fanout (b or m)*: the max number of children a node can have; a node with `m` children holds up to `m-1` keys. *Node = page = block*: a node is sized to one storage page (commonly 4KB-16KB). *Fanout*: effective branching factor, often 100-1000+. *B+ tree*: a B-tree variant where all actual records/values live only in the leaves, internal nodes hold *only* keys as a routing directory, and the leaves are chained in a linked list. *Leaf-linking*: sibling leaves point to each other for fast range scans. *External-memory (I/O) model*: cost = number of block transfers, not instructions. *Splitting/merging*: how nodes stay within their fill bounds on insert/delete.

**Core mechanics**
A B-tree of order `m` keeps every node (except root) at least half full (between `ceil(m/2)-1` and `m-1` keys), all leaves at the same depth. Search walks from root, doing a binary search *within* each node's sorted keys, then descending one child. With fanout `b`, height is `O(log_b n)` and that's the number of block reads. Insert descends to a leaf and adds the key; if the node overflows, it *splits* in two and pushes the median key up, possibly cascading to the root (that's how the tree grows a level — from the top). Delete may *borrow* from a sibling or *merge* two nodes to keep the half-full invariant. B+ trees add: values only in leaves, so internal nodes pack more keys (higher fanout), and range queries walk to the first leaf then follow the leaf chain linearly.

**Trade-offs**
Versus an in-memory balanced BST (red-black/AVL): a BST has height `O(log2 n)` — for a billion keys that's ~30 pointer chases, each potentially a cache/disk miss. A B+ tree with fanout 500 has height `~3-4`, so 3-4 block reads. Same asymptotic `O(log n)`, but the base of the log is huge, which is the entire point when each level is an I/O. The cost: nodes are partly empty (typically ~50-70% full), so B-trees waste some space and need in-node search. Versus a hash index: B+ trees keep data ordered, so they support range scans, prefix/`ORDER BY`, and `BETWEEN`; a hash index gives `O(1)` point lookups but can't range-scan at all.

**Common confusions**
"B stands for binary" — no; a B-tree is explicitly *not* binary, fanout is high. Confusing B-tree with B+ tree: in a plain B-tree, values can sit in internal nodes and there is no leaf linked-list; the B+ tree's value-in-leaves + linked leaves design is why databases prefer it for range scans. Thinking the tree grows at the leaves — it grows at the *root* via median promotion, which is what keeps all leaves at equal depth. Assuming higher fanout is free — bigger nodes mean more in-node comparison work and larger reads; node size is tuned to the page size, not maximized blindly.

**Why interviewers ask**
It's the cleanest test of whether you understand that *algorithms live on hardware*. Anyone can recite `O(log n)`; the signal is explaining why a database picks a B+ tree over a red-black tree when both are `O(log n)` — because the external-memory model counts block transfers and fanout shrinks the height to 3-4 reads. It also surfaces systems literacy: indexes, pages, why `SELECT ... WHERE x BETWEEN` is fast on a B+ tree index and a hash index can't do it. Great candidates connect the data structure to the machine.

### What problem do B-trees solve that a binary search tree does not?

The cost model. A balanced BST minimizes the number of comparisons, assuming every node access is roughly equal cost — true in RAM. But when data lives on disk or SSD, one node access is a block read costing ~10^4-10^6x a CPU comparison. A BST for a billion keys is ~30 levels deep, so a lookup could be ~30 disk reads. A B-tree packs hundreds of keys per node (one node = one page), so its fanout is large and its height is only 3-4. Fewer levels means fewer block transfers, which is the metric that actually matters on storage.

### What is the difference between a B-tree and a B+ tree?

In a plain B-tree, keys *and their associated values/records* can live in internal nodes as well as leaves, and there's no ordering link between leaves. In a B+ tree: (1) internal nodes store *only keys*, acting as a pure routing directory; all values live in the leaves. (2) Because internal nodes carry no payload, they fit more keys per page, giving higher fanout and a shallower tree. (3) Leaves are connected in a doubly linked list. The payoff is range queries — find the start leaf via the tree, then walk the leaf chain linearly instead of re-traversing from the root. This is why nearly all database indexes are B+ trees, not classic B-trees.

### Why do databases and filesystems use B+ trees?

Because their workload is dominated by storage I/O and by both point *and* range queries. B+ trees minimize block reads (shallow, high-fanout) and keep keys sorted, so `WHERE x = 5`, `WHERE x BETWEEN 5 AND 50`, `ORDER BY x`, and prefix lookups all use the same index. The linked leaves make range scans a sequential walk — very cache- and prefetch-friendly. Nodes map cleanly to pages, so the buffer pool caches hot internal nodes (often the top 2-3 levels stay resident in RAM), meaning a lookup is frequently just 1 real disk read at the leaf. Filesystems (NTFS, HFS+, ext4's htree, XFS) use them for directory indexing and extent maps for the same reasons.

### What is fanout, and how does it determine the height of the tree?

Fanout is the effective branching factor — how many children a node has. Height is `O(log_fanout n)`. The base of the logarithm is the fanout, so raising it collapses the height fast. With fanout 2 (a BST), a billion keys need ~30 levels. With fanout 500, `log_500(10^9) ≈ 3.3`, so ~4 levels. Since each level typically costs one block read, high fanout directly converts to fewer I/Os per query. Fanout is set by how many keys fit in one page: `fanout ≈ page_size / (key_size + pointer_size)`.

### Why is node size chosen to match the disk/page size?

Because storage transfers happen in fixed-size blocks (a 4KB page, an SSD page, a filesystem block) — you can't read half a page cheaply; the device fetches the whole block regardless. So you make one node exactly one block: every node access is exactly one transfer, and you pack as many keys into that block as possible to maximize fanout. Making nodes smaller than a page wastes the transfer (you paid for a full block but used part of it and got lower fanout). Making them larger means multiple block reads per node and larger in-node scans, negating the benefit.

### Walk through what happens when you insert into a full B-tree node.

You always insert at a leaf. Descend from the root to the correct leaf. If the leaf has room, insert the key in sorted position — done. If the leaf is full (already `m-1` keys), *split*: divide it into two half-full nodes and promote the *median* key up into the parent as a separator. If that parent is now also full, it splits too, promoting its median — this can cascade up. If the root splits, a new root is created with a single key and the tree gains one level. This top-down growth is exactly why every leaf stays at the same depth and the tree stays balanced.

### How does deletion keep the tree balanced?

Deletion must preserve the invariant that every non-root node is at least half full. Remove the key from its leaf; if the leaf still has at least `ceil(m/2)-1` keys, you're done. If it *underflows*, first try to *borrow* (rotate) a key from an adjacent sibling that has spare keys, moving through the parent separator. If no sibling can spare one, *merge* the underflowing node with a sibling and pull the separator key down from the parent, which shrinks the parent by one key — this can cascade up and, at the root, may remove a level. Borrow-then-merge mirrors the split logic of insertion in reverse.

### What is the external-memory (I/O) model and why does it favor B-trees?

The external-memory model measures cost as the number of block transfers between fast memory and slow storage, not the number of CPU instructions. Under this model, an in-node binary search over hundreds of keys is "free" (it happens in RAM once the block is loaded), while descending to a child is "expensive" (a potential block read). B-trees are optimal here: they minimize the number of nodes on the root-to-leaf path by maximizing keys per block. This is the formal justification for why `O(log_b n)` block reads beats `O(log2 n)` in practice — the model counts the thing that actually costs milliseconds.

### Roughly how many disk reads does a lookup in a large B+ tree take?

Usually 3-4 in the worst case, and often just 1 in practice. A B+ tree with fanout ~500 holding a billion rows is only ~4 levels deep, so ≤4 block reads. But the top levels are tiny and hot — the root is one page, level 2 is a few hundred pages — so the buffer pool keeps the upper internal nodes resident in RAM. The only guaranteed physical read is the leaf. That's why a well-tuned index lookup on a huge table is effectively one I/O.

### Why can a B+ tree do fast range queries when a hash index cannot?

A hash index scatters keys across buckets by hash value, deliberately destroying any ordering — so "give me all keys between 5 and 50" has no locality; there's no way to enumerate a range without scanning everything. A B+ tree keeps keys in sorted order and links the leaves. A range query finds the first qualifying leaf with one `O(log n)` descent, then walks the leaf linked-list sequentially until it passes the upper bound. That's `O(log n + k)` for `k` results, and the sequential leaf walk is prefetch-friendly. Ordering is the feature hashing throws away.

### What determines whether internal nodes stay cached in memory?

The shape of the tree. Internal nodes are a tiny fraction of total nodes — with fanout `b`, only about `1/b` of nodes are non-leaf, and the top levels are a handful of pages. The buffer pool (a fixed-size RAM cache of pages) naturally keeps the frequently traversed upper levels resident because *every* query touches the root and level 2. So even a multi-terabyte index keeps its top ~2-3 levels in RAM for free, and physical I/O is confined to the leaf level. This is why B+ tree height, not total size, drives real latency.

### How does a clustered index differ from a secondary index in B+ tree terms?

A *clustered* index stores the full row data directly in the B+ tree leaves, ordered by the index key — so the table *is* the tree, and a range scan over the key reads whole rows sequentially. A *secondary* (non-clustered) index stores only the index key plus a pointer (or the primary key) in its leaves; resolving the full row requires a second lookup into the clustered index (a "bookmark lookup"). This is why range scans on the clustered key are fast, why secondary-index queries that fetch many columns can be slow, and why a *covering* index (one that includes all needed columns in its leaves) avoids the second lookup.

### Why are B-tree nodes typically only 50-70% full rather than packed tight?

Because splits and merges leave slack. After a split, two nodes are each about half full; nodes fill up again as more keys arrive, so the steady-state average is around 50-70% occupancy for random inserts. This is a deliberate trade: some wasted space in exchange for cheap `O(log n)` inserts/deletes that only touch one path. If you need higher density (read-mostly data), *bulk-loading* builds a densely packed tree bottom-up, and some systems use a "fill factor" or B*-tree redistribution (share keys across three siblings before splitting) to push occupancy toward ~66-75%.

### When would you NOT use a B-tree?

When your workload doesn't need ordering and data fits in RAM. For pure point lookups on in-memory data, a hash table gives `O(1)` and beats a B-tree's `O(log n)` with no need for range support. For write-heavy workloads with lots of random inserts, an *LSM-tree* (log-structured merge tree, as in RocksDB/Cassandra) often wins because it turns random writes into sequential appends and defers ordering to background compaction — B-trees suffer write amplification from in-place page updates and splits. And for tiny datasets, the constant factors and page overhead of a B-tree aren't worth it over a sorted array.

### How does a B-tree compare to a red-black tree, given both are O(log n)?

They optimize different cost models. A red-black tree is a binary balanced tree tuned for *in-memory* use: fanout 2, height `~2*log2 n`, each node a small heap allocation with two child pointers. A B-tree is tuned for *block* storage: high fanout, height `log_b n`, each node a full page. In RAM with random access, the red-black tree's simpler nodes and pointer chasing are fine. On disk, the red-black tree is a disaster — 30+ pointer dereferences could be 30 seeks. Same Big-O, radically different constant factor because the base of the log differs by two orders of magnitude. Choose by where the data lives.

### What is write amplification in a B-tree, and how do LSM-trees address it?

Write amplification is the ratio of bytes actually written to storage versus bytes of logical data changed. In a B-tree, updating a single row rewrites its entire page (and split/merge cascades rewrite more pages, plus write-ahead log entries), so a tiny logical write can cost several full-page physical writes — hard on SSDs and throughput. LSM-trees instead buffer writes in a memtable and flush them as sorted, immutable runs appended sequentially, then merge runs in the background (compaction). This makes writes sequential and batched, cutting write amplification for insert-heavy loads — at the cost of read amplification (a read may check several runs) and background compaction I/O. It's the classic read-optimized (B-tree) vs write-optimized (LSM) trade.

## Specialized & Composite Structures

### Summary

**What this topic covers**
Sometimes no single textbook structure hits your complexity target, so you *compose* two or more primitives kept in sync, each covering the other's weakness. The canonical example: a hash map gives `O(1)` lookup but no ordering; a doubly linked list gives `O(1)` splice but no lookup — glue them and you get an LRU cache with `O(1)` get *and* eviction. This topic is the pattern of "combine structures to buy an operation you couldn't get from either alone," plus the standard composites interviewers expect: LRU, LFU, monotonic deque, sparse table, interval tree, and order-statistics tree.

**Key terms**
*Composite structure*: two structures maintained together so an operation missing from one is served by the other. *LRU (least-recently-used)*: evicts the entry unused for the longest time. *LFU (least-frequently-used)*: evicts the entry with the fewest accesses. *Monotonic deque/stack*: a deque whose contents stay sorted, used for sliding-window min/max. *Sparse table*: a precomputed table for `O(1)` static range queries on idempotent operations (min, max, gcd). *Interval tree*: an augmented BST for "which intervals overlap this point/range." *Order-statistics tree*: a balanced BST augmented with subtree sizes to answer rank/select. *Augmentation*: storing extra derived data in nodes to answer richer queries.

**Core mechanics**
The recurring trick is a *back-pointer* or *index* that lets one structure locate an element inside the other in `O(1)`. In LRU, the hash map maps key -> the list node, so on `get` you find the node instantly and splice it to the front in `O(1)`; eviction pops the tail. In a monotonic deque, you pop elements from the back that can never again be the answer, so each element is pushed and popped once — `O(1)` amortized per step, `O(n)` for a whole window sweep. A sparse table precomputes answers for every power-of-two length in `O(n log n)` time / space, then answers any range in `O(1)` by overlapping two intervals. Order-statistics and interval trees augment each BST node with a summary (subtree size, or max endpoint) maintained during rotations.

**Trade-offs**
Composites buy speed with memory and complexity: LRU stores a hash map *and* a linked list (roughly 2x pointers per entry) to get `O(1)` on both operations. LFU adds a third layer (frequency buckets) for `O(1)` at the cost of more bookkeeping and trickier code. Sparse tables give `O(1)` queries but only for *static* data and idempotent operations — one update forces a full rebuild, so a segment tree (`O(log n)` query, `O(log n)` update) wins the moment data changes. Augmented trees add `O(1)` maintenance per rotation for powerful queries but demand you keep the augmentation correct through every insert/delete. The meta-trade: more moving parts to keep in sync, more ways to introduce bugs.

**Common confusions**
Thinking LRU needs a sorted structure or a timestamp scan — it doesn't; the linked-list *order* is recency, so no comparison or sort is needed. Believing a monotonic deque stores the whole window — it stores only candidates that could still be the max/min, often far fewer. Confusing sparse table with segment tree — sparse table is static and `O(1)`; segment tree is dynamic and `O(log n)`. Forgetting that sparse table's `O(1)` trick needs an *idempotent* operation (min/max/gcd, where overlapping the two halves is harmless); sum is *not* idempotent, so range-sum needs a prefix-sum array or Fenwick tree instead. Forgetting to update the hash map's back-pointer when you move or delete the list node — a classic LRU bug.

**Why interviewers ask**
Composite-structure questions (LRU is the most-asked design question in the industry) test whether you can reason about complexity *targets* and reach them by combination, not memorization. Anyone can describe a hash map; the signal is realizing that hitting `O(1)` for both lookup and eviction *requires* two structures glued by a back-pointer, and articulating exactly how they stay in sync. It reveals whether you think in invariants, whether you handle the fiddly delete/move cases, and whether you can pick the right specialized tool (sparse table vs segment tree vs Fenwick) for a stated constraint.

### How does an LRU cache achieve O(1) for both get and put?

Combine a hash map with a doubly linked list. The list holds entries in recency order — most-recently-used at the head, least-recently-used at the tail. The hash map maps `key -> the list node`. On `get(key)`: look up the node via the map (`O(1)`), unlink it and splice it to the head (`O(1)` because it's doubly linked and you have the node directly). On `put`: if the key exists, update and move to head; if not, create a head node and add to the map, and if over capacity, evict the tail node and remove its key from the map (`O(1)`). The map gives instant location; the doubly linked list gives instant reordering and eviction. Neither alone suffices.

### Why a doubly linked list and not a singly linked one for LRU?

Because eviction and reordering require removing a node *in place* in `O(1)`, and to unlink a node you must fix its predecessor's `next` pointer. A singly linked list doesn't give you the predecessor without an `O(n)` scan from the head. A doubly linked list stores `prev`, so given a node (which the hash map hands you directly), you splice it out in `O(1)` by rewiring `node.prev.next` and `node.next.prev`. That constant-time in-place removal is exactly what makes both the "move to front on access" and "drop the tail on evict" operations `O(1)`.

### How does an LFU cache work, and why is it harder than LRU?

LFU evicts the *least-frequently-used* entry, so it must track an access count per key and, on eviction, find the key with the minimum count — breaking ties by recency. The `O(1)` design uses three parts: a `key -> (value, freq)` map, a `freq -> doubly-linked-list of keys at that frequency` map, and a `minFreq` pointer. On access, bump the key's freq, move it from its old freq-list to the `freq+1` list, and update `minFreq` if its old list emptied. On eviction, drop the LRU tail of the `minFreq` list. It's harder than LRU because you maintain buckets *by frequency*, keep recency order *within* each bucket, and carefully track `minFreq` — three interlocking structures instead of two.

### What is a monotonic deque and what problem does it solve?

A monotonic deque is a double-ended queue whose elements are kept in monotonic (increasing or decreasing) order by *value*, used to answer sliding-window maximum/minimum in `O(n)` total. For window max, you keep a decreasing deque of *candidate indices*: before pushing a new element at the back, pop all smaller elements off the back (they can never be the max while this larger, newer element is in the window). The front is always the current window's max. You also pop the front when its index falls out of the window. Each element is pushed once and popped once, so the whole sweep is `O(n)` — beating the naive `O(n*k)` recompute or an `O(n log k)` heap.

### Why does a monotonic deque give O(1) amortized per element?

Because each element enters the deque exactly once (one push) and leaves exactly once (one pop) over the entire pass. Within a single step you might pop several elements off the back, but every one of those was pushed by some earlier step and can only be popped once — the total number of pops across all `n` steps is at most `n`. Summing, the whole traversal does `O(n)` deque operations for `n` elements, hence `O(1)` amortized per element even though an individual step's worst case is `O(k)`. This is the classic amortized-analysis "each element pays for its own push and pop" argument.

### What is a sparse table and when is it the right choice?

A sparse table precomputes range answers for every interval whose length is a power of two, storing `table[k][i] = answer for the range starting at i of length 2^k`. It's built in `O(n log n)` time and space. A query on `[l, r]` picks the largest `k` with `2^k <= (r-l+1)` and combines two overlapping intervals of length `2^k` that together cover `[l, r]` — an `O(1)` answer. It's the right choice for *static* arrays (no updates) with an *idempotent* associative operation like min, max, or gcd, where you want the fastest possible query. If the array changes, or the operation isn't idempotent (like sum), use something else.

### Why does the sparse table O(1) query only work for idempotent operations?

Because the `O(1)` query covers `[l, r]` with two power-of-two blocks that *overlap* in the middle when the range length isn't itself a power of two. For min/max/gcd, counting the overlapping region twice is harmless — `min(a, a) = a` — so overlap is fine. For sum, counting elements twice gives the wrong total, so you can't overlap; you'd need to tile with non-overlapping blocks, which reintroduces an `O(log n)` factor. That's why range-min uses a sparse table but range-sum uses a prefix-sum array (`O(1)` query, also static) or a Fenwick/segment tree if updates are needed.

### Sparse table vs segment tree — how do you choose?

By whether the data changes. A sparse table gives `O(1)` queries but is static — any update forces an `O(n log n)` rebuild — and only works for idempotent operations. A segment tree gives `O(log n)` queries *and* `O(log n)` point/range updates, works for any associative operation (sum, min, max, xor), and supports lazy propagation for range updates. So: static array, idempotent op, want the absolute fastest query -> sparse table. Data mutates, or you need sums, or you need range updates -> segment tree. For static range *sum* specifically, a plain prefix-sum array beats both.

### What is an interval tree and what query is it built for?

An interval tree is a balanced BST of intervals, keyed by their low endpoints and *augmented* so each node stores the maximum high endpoint in its subtree. It answers "which stored intervals overlap a given point or query interval" in `O(log n + k)` for `k` matches (or `O(log n)` to find just one overlap). The augmented `max` lets you prune: while searching, if a subtree's stored max-high is less than your query's low, no interval in it can overlap, so you skip it entirely. It's the go-to for scheduling/calendar conflict detection, "find all events active at time t," and computational-geometry range problems.

### What is an order-statistics tree and how does the augmentation work?

An order-statistics tree is a balanced BST (red-black or AVL) where each node stores the *size of its subtree*. That single augmentation unlocks two `O(log n)` operations: *select(k)* — find the k-th smallest element — by comparing `k` to the left subtree's size and descending left or right; and *rank(x)* — how many elements are `< x` — by summing left-subtree sizes along the search path. The subtree-size field is cheap to maintain: on insert/delete and during rotations you adjust counts along the path in `O(1)` per node. It turns a plain ordered set into one that also answers "what's the median" or "how many are below this value" in log time.

### What is the general pattern behind these composite structures?

Identify the operation each primitive can't do cheaply, then pair it with a structure that can, linked so one can find elements in the other in `O(1)`. Hash map (fast lookup, no order) + linked list (fast splice, no lookup) = LRU. BST (ordered) + subtree-size augmentation = rank/select. BST (ordered) + max-endpoint augmentation = interval overlap. Array + power-of-two precomputation = `O(1)` range-min. The unifying idea is either a *back-pointer/index* connecting two containers, or an *augmentation* storing derived summaries in nodes — both maintained as an invariant on every mutation.

### What is augmentation and what is the rule for keeping it correct?

Augmentation is storing extra derived data in each node so the structure answers richer queries — subtree size for rank/select, max endpoint for interval overlap, subtree sum for range sums. The rule (from CLRS): an augmentation is maintainable in a balanced BST if each node's augmented value can be computed *from the node's own key plus its children's augmented values*. If that holds, you can restore all augmentations after an insert, delete, or rotation by recomputing along the `O(log n)` affected path — keeping every operation's asymptotic cost unchanged. Violate it (need info from the whole tree, not just children) and you can't maintain it cheaply.

### How would you design a data structure with O(1) insert, delete, and getRandom?

Combine a dynamic array with a hash map. The array stores the elements; the hash map maps `value -> its index in the array`. Insert: append to the array, record its index in the map — `O(1)`. `getRandom`: pick a random array index — `O(1)`. Delete is the clever part: to remove a value in `O(1)` without leaving a hole, look up its index, swap that element with the *last* array element (updating the moved element's index in the map), then pop the last element and erase the key. The array gives uniform random access; the map gives `O(1)` location; swap-with-last gives `O(1)` deletion. It's the same "two structures with a back-pointer index" pattern as LRU.

### When is composing two structures the wrong call?

When a single structure already meets the target, or when the sync overhead outweighs the benefit. Two structures mean double the memory, double the mutation points, and a maintained invariant that's easy to break (forget to update the back-pointer on delete and you get a dangling reference or a stale cache). If your access pattern is simple point lookups, a plain hash map beats an LRU's map+list. If the data is small or the operation is rare, `O(n)` on one structure can be simpler and faster in practice than the constant-factor overhead of a composite. Reach for composition only when a stated complexity target genuinely can't be met by one primitive.

### How does the "swap with last" trick enable O(1) array deletion, and what's its limitation?

To delete an element from the middle of an array without an `O(n)` shift, you overwrite it with the last element and shrink the array by one — moving the last element into the gap in `O(1)`. Paired with a `value -> index` hash map, you can locate the target instantly and update the moved element's index. The limitation: it *destroys ordering*. The array no longer reflects insertion or sorted order, so it only works when order doesn't matter (sets, random-access pools). If you need to preserve order, you can't swap-with-last; you're back to `O(n)` shifting or a linked structure.

### Why do these composite structures show up so often in system design and caching?

Because caches and hot-path systems have hard `O(1)` requirements per request and multiple simultaneous access patterns — look up by key, evict by policy, sample randomly — that no single structure satisfies. LRU/LFU are the eviction policies behind CPU caches, database buffer pools, CDNs, and Redis `maxmemory` policies, all needing `O(1)` per operation at high throughput. The composite pattern is how you meet several `O(1)` guarantees at once. Interviewers lean on them because they mirror real production constraints: a slow eviction policy stalls every request behind it, so the constant factor and the `O(1)` guarantee genuinely matter.

## Choosing the Right Data Structure — Interview Playbook

### Summary

**What this topic covers**
This is the meta-skill: given a problem, systematically pick the data structure that hits the required complexity, and *reason it out loud* so an interviewer follows your logic. The framework is a pipeline — enumerate the operations you need, attach a complexity target to each, then choose the structure whose costs match. It ties together everything in the primer (arrays, hashes, trees, heaps, graphs, composites) into a decision procedure and a fluent Big-O recall table, plus the classic trade-offs and the "what would you use for X" drills interviewers actually run.

**Key terms**
*Operation profile*: the set of operations a problem needs (insert, lookup, delete, min, range, ordered iteration) and their frequencies. *Complexity target*: the acceptable Big-O per operation, usually implied by input size and time limits. *Access pattern*: random vs sequential, read-heavy vs write-heavy, point vs range. *Amortized*: average cost per operation over a sequence (dynamic-array append is `O(1)` amortized). *Ordered vs unordered*: whether you need keys sorted / range queries. *Stability of data*: static (build once) vs dynamic (frequent mutation). *Constant factors*: the hidden multiplier Big-O ignores, which decides ties in practice.

**Core mechanics**
Run the pipeline: (1) List the operations and roughly how often each runs. (2) Assign each a target from the input size — `n` up to ~10^8 suggests `O(n)` or `O(n log n)`; `n` up to ~10^5 tolerates `O(n log n)` or even `O(n^2)`; huge `n` with per-op queries demands `O(1)` or `O(log n)`. (3) Match: need `O(1)` keyed lookup -> hash table; need ordering + `O(log n)` ops -> balanced BST / skip list; need fast min/max + insert -> heap; need range-min on static data -> sparse table; need both `O(1)` lookup and ordered eviction -> composite (hash map + linked list). (4) Sanity-check the loser cases: what's the worst-case, does it degrade (hash collisions -> `O(n)`), does it fit in memory.

**Trade-offs**
The recurring axes: *Array vs linked list* — arrays give `O(1)` random access and cache locality but `O(n)` middle insert; lists give `O(1)` splice-with-a-reference but `O(n)` indexing and poor locality. *Hash vs balanced tree* — hash is `O(1)` average but unordered with `O(n)` worst case; tree is `O(log n)` guaranteed with ordered iteration and range queries. *Heap vs sorted array* — heap gives `O(1)` peek and `O(log n)` insert but no full ordering; sorted array gives `O(log n)` search and ordered scan but `O(n)` insert. *Memory vs speed* — hash tables and composites trade extra memory (and pointer chasing) for time; tries trade memory for prefix speed. Constant factors and cache behavior break ties Big-O can't see.

**Common confusions**
Quoting hash-table `O(1)` as if it were guaranteed — it's `O(1)` *average*; adversarial or bad-hash collisions make it `O(n)`, which matters in security contexts. Assuming a linked list is faster than an array for insertions — only if you already hold a reference to the position; finding the position is `O(n)`, and arrays often win in practice on cache locality. Reaching for a balanced BST when a hash table suffices, paying `O(log n)` for ordering you don't need. Forgetting that "sorted" is a feature you pay for — if you never range-query or iterate in order, an unordered structure is cheaper. Optimizing the wrong operation — pick the structure for the operation on the hot path, not the rare one.

**Why interviewers ask**
"What structure would you use for X" is the fastest probe of whether you can map requirements to tools under pressure — the daily work of engineering. It's not about reciting Big-O (necessary but not sufficient); it's the reasoning: naming the operations, attaching targets, comparing two candidates, and justifying the winner including its worst case. Strong candidates think out loud: "I need lookups and ordered range scans, so hash is out despite `O(1)` — I'll use a balanced BST at `O(log n)`; if I only needed point lookups I'd switch to a hash." That narrated trade-off reasoning is the entire signal.

### What is the framework for choosing a data structure in an interview?

Work backwards from operations to structure. First, enumerate every operation the problem needs and how often each runs — insert, lookup, delete, find-min, range query, ordered iteration. Second, attach a complexity target to the hot-path operations, inferred from input size and the time limit. Third, match: pick the structure whose costs meet those targets, comparing the two closest candidates. Fourth, check the failure modes — worst case, memory footprint, does it degrade. Then say the reasoning out loud: "I need `O(1)` lookup by key and I don't need ordering, so a hash map beats a tree." The narration is what the interviewer is grading.

### How do you infer the complexity target from the input size?

Use the time budget (~10^8 simple operations per second as a rule of thumb) and the constraint on `n`. If `n <= ~10^8`, you need roughly linear, `O(n)` or `O(n log n)`. If `n <= ~10^5-10^6`, `O(n log n)` is comfortable and `O(n^2)` may just barely pass. If `n <= ~500-1000`, `O(n^2)` or `O(n^3)` is fine. If `n <= ~20`, exponential `O(2^n)` or `O(n!)` is expected (subset/permutation search). If there are many queries `q` over the data, the target is *per-query*: `q` queries at `O(log n)` or `O(1)` each. Reading the constraints tells you the target before you pick the tool.

### Array vs linked list — how do you decide?

Ask whether you need random access and how you insert. An array (dynamic array/vector) gives `O(1)` indexed access and excellent cache locality, with `O(1)` amortized append but `O(n)` insert/delete in the middle (elements shift). A linked list gives `O(1)` insert/delete *if you already hold a reference to the node*, but `O(n)` to index or search, and poor cache locality from scattered nodes. Choose the array by default — locality makes it faster in practice for most workloads, including many insertions. Choose the linked list only when you frequently splice at positions you already hold a reference to (LRU's recency list, a free-list, an intrusive queue).

### Hash table vs balanced BST — when does each win?

Hash table wins when you need fast keyed access and *don't* need order: `O(1)` average insert/lookup/delete, at the cost of no ordering, `O(n)` worst case under collisions, and no efficient range queries. Balanced BST (red-black, AVL) or skip list wins when you need *ordering*: `O(log n)` guaranteed insert/lookup/delete plus ordered iteration, range queries (`BETWEEN`, floor/ceiling, successor/predecessor), and a hard worst-case bound. Rule of thumb: point lookups only -> hash; range queries, ordered iteration, or worst-case guarantees -> tree. Databases use B+ trees (not hashes) for exactly this reason — they need range scans.

### Heap vs sorted array vs balanced BST for priority access?

If you only ever need the min (or max) repeatedly plus inserts, use a *heap*: `O(1)` peek, `O(log n)` insert and extract-min, but no efficient search or full ordering. If the data is static and you need ordered traversal and binary search, use a *sorted array*: `O(log n)` search, `O(1)` ordered scan, but `O(n)` insert. If you need dynamic ordering *and* arbitrary search/delete/range, use a *balanced BST*: `O(log n)` everything, ordered iteration, at higher constant factors and memory. The heap is the specialist — cheapest for "give me the extreme repeatedly," but it can't answer "is x present" or "give me sorted order" cheaply.

### What structure would you use to detect duplicates in a stream?

A hash set. Insert each element and check membership in `O(1)` average; if it's already present, it's a duplicate. Total `O(n)` time, `O(n)` space. If memory is tight and a small false-positive rate is acceptable, a *Bloom filter* gives probabilistic membership in far less space (no false negatives, occasional false positives). If the stream is sorted or you need to know *which* duplicates and how many, a hash *map* to counts works. If you need duplicates within a sliding window of size `k`, keep a hash set of the last `k` elements, evicting as the window slides.

### What structure would you use for autocomplete / prefix search?

A *trie* (prefix tree). Each node represents a character; a path from the root spells a prefix, and you store words along the paths. Looking up all completions of a prefix is `O(p)` to walk to the prefix node (where `p` is prefix length), then a traversal of that subtree to collect words — independent of the total dictionary size. Tries also naturally deduplicate shared prefixes, saving space when many keys share leading characters. For ranked autocomplete, augment each node with the top-k completions or their frequencies. Alternatives: a sorted array + binary search for prefix range works but is worse for incremental typing; a ternary search tree trades some speed for less memory than a wide trie.

### What structure gives you the running median of a stream?

Two heaps: a max-heap holding the smaller half and a min-heap holding the larger half, kept balanced in size (differ by at most one). The median is the top of the larger heap (or the average of both tops when sizes are equal). Each insert rebalances in `O(log n)`, and reading the median is `O(1)`. This "two heaps straddling the middle" pattern is the standard answer — it beats re-sorting (`O(n log n)` per query) and beats a single sorted structure with `O(n)` inserts. An order-statistics tree also works (`O(log n)` insert, `O(log n)` select-median) and additionally supports arbitrary rank queries.

### How would you design a structure for range-sum queries with updates?

If the array is *static* (no updates), a prefix-sum array answers any range sum in `O(1)` after `O(n)` preprocessing. If there are *point updates* and range-sum queries, use a *Fenwick tree (BIT)*: `O(log n)` update and `O(log n)` prefix-sum, with tiny constant factors and simple code. If you need *range updates* as well as range queries, use a *segment tree with lazy propagation*: `O(log n)` for both. Choose by mutation: static -> prefix sums; point-update -> Fenwick; range-update -> segment tree. Note range *sum* rules out a sparse table (sum isn't idempotent), unlike range *min*.

### When do you reach for a graph structure instead of a tree or array?

When the relationships form a network with cycles, many-to-many connections, or arbitrary edges — not a strict hierarchy or a linear sequence. Signals: "connections," "dependencies," "routes/paths," "network," "who is reachable from whom," "shortest path," "cycle detection," "ordering with prerequisites" (topological sort). Represent it as an adjacency list for sparse graphs (`O(V + E)` space, efficient traversal) or an adjacency matrix for dense graphs or `O(1)` edge lookups. A tree is just the special case of a connected acyclic graph, so if the problem has cycles or multiple paths between nodes, you're in graph territory.

### How do you reason about memory vs speed when choosing?

Name the trade explicitly and tie it to the constraint. Hash tables, tries, and composite structures (LRU) spend extra memory — load-factor slack, per-node pointers, duplicated indices — to buy `O(1)` operations. If memory is the binding constraint (embedded, massive dataset, tight cache), you may accept slower `O(log n)` structures with less overhead (a compact sorted array over a hash map), or probabilistic structures (Bloom filter, count-min sketch, HyperLogLog) that trade exactness for tiny footprints. Also weigh *cache locality*: a contiguous array can beat an asymptotically-equal pointer-based structure because it avoids cache misses. State which resource is scarce, then pick the side of the trade that protects it.

### Why can't you just use a hash table for everything?

Because hashing throws away order and offers no worst-case guarantee. It can't do range queries, ordered iteration, floor/ceiling/successor, or "k-th smallest" — all `O(n)` on a hash table but `O(log n)` on a balanced tree. Its `O(1)` is *average*; adversarial input or a poor hash collapses it to `O(n)` per operation (a real denial-of-service vector — algorithmic complexity attacks). It has no cheap min/max (a heap does that in `O(1)` peek). And its memory overhead (load-factor slack + buckets) can exceed a compact array. Hash tables are the right default for unordered point lookups — and the wrong tool the moment you need ordering, ranges, extremes, or hard guarantees.

### How should you talk through a data-structure choice out loud in an interview?

Narrate the pipeline. State the operations: "I need to insert, look up by key, and get the minimum, all frequently." Attach targets: "with `n` up to a million and many queries, I want `O(log n)` or better per op." Name candidates and compare: "a hash map gives `O(1)` lookup but can't give me the min cheaply; a heap gives me the min but not keyed lookup — so I'll combine them, or use a balanced BST for `O(log n)` on both." Justify including the downside: "the tree costs `O(log n)` versus the hash's `O(1)`, but I need ordering, so it's worth it." Then mention the worst case. That explicit requirement -> target -> comparison -> justification chain is the whole point.

### What is the difference between amortized, average, and worst-case complexity, and why does it matter for choosing?

*Worst case* bounds any single operation. *Average case* is the expected cost over random inputs (hash-table `O(1)` lookup). *Amortized* is the average over a *sequence* of operations, guaranteed regardless of input (dynamic-array append is `O(1)` amortized — occasional `O(n)` resizes averaged across many `O(1)` appends). It matters because they fail differently: a hash table's `O(1)` average degrades to `O(n)` on adversarial collisions (bad for latency-sensitive or security-sensitive systems); a dynamic array's amortized `O(1)` is robust but has occasional `O(n)` spikes (bad for hard-real-time). If tail latency or worst-case guarantees matter, prefer a balanced tree's guaranteed `O(log n)` over a hash's average `O(1)`.

### Give a quick Big-O recall for the common structures.

Dynamic array: index `O(1)`, append `O(1)` amortized, insert/delete-middle `O(n)`, search `O(n)` (`O(log n)` if sorted). Hash table: insert/lookup/delete `O(1)` average, `O(n)` worst; unordered. Balanced BST / skip list: insert/lookup/delete `O(log n)`; ordered iteration and range queries supported. Binary heap: peek `O(1)`, insert/extract `O(log n)`; no search. Trie: insert/lookup `O(L)` in key length `L`; prefix queries efficient. Stack/queue/deque: push/pop/enqueue/dequeue `O(1)`. Fenwick tree: update/prefix-sum `O(log n)`. Segment tree: query/update `O(log n)`. Sparse table: build `O(n log n)`, query `O(1)` (static, idempotent). Union-Find: near-`O(1)` amortized (inverse-Ackermann) per op with path compression + union by rank.

### What's a common mistake candidates make when choosing structures?

Optimizing the wrong operation. Candidates pick a structure that's fast on an operation the problem rarely does while ignoring the hot path — e.g. choosing a sorted array (fast search) when the workload is insert-heavy (`O(n)` inserts kill it), or a balanced tree when the problem never range-queries and a hash map's `O(1)` would win. The other frequent mistake is quoting average-case as guaranteed — assuming hash-table `O(1)` holds under adversarial input, or forgetting that a linked-list insert is only `O(1)` once you've already paid `O(n)` to find the position. Always identify the *most frequent* operation first, and always state the worst case, not just the happy path.

### How do you choose between a B-tree, a hash index, and an LSM-tree for a storage engine?

By the read/write/range mix. A *B+ tree* is the default for read-heavy or mixed workloads that need range scans and ordered access — `O(log n)` block reads, shallow, cache-friendly for point *and* range queries; databases use it for general indexes. A *hash index* is for pure point lookups with no range needs — `O(1)` but can't range-scan or order. An *LSM-tree* is for write-heavy workloads — it batches random writes into sequential appends and compacts in the background, minimizing write amplification (RocksDB, Cassandra), trading higher read amplification and background compaction cost. So: mixed with ranges -> B+ tree; point-only -> hash; write-dominated -> LSM. The choice is driven by which operation dominates and whether ordering is required.
