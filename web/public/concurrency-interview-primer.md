---
type: interview-prep
---

# Concurrency & Parallelism Interview Primer — 334 Questions

Comprehensive Q+A primer for concurrency and parallelism interviews. A System Fundamentals companion to the Operating Systems primer — where OS covers kernel-level mechanism, this covers the **application-developer angle**: how to actually write, reason about, and debug correct concurrent programs. Memory models & happens-before, locks & lock-free/atomics/CAS, async/await & event loops, futures/channels/actors, language concurrency models (Java/Go/Rust/Python/C++/JS), concurrent data structures, contention & scaling, and spot-the-race debugging.

Each answer is interview-shaped: opinionated, concrete, with explicit T1/T2 thread interleavings, real code (Java/Go/Rust/Python/C++/JS), small ASCII diagrams (happens-before edges, event loop, channel pipelines), and comparison tables (concurrency vs parallelism, mutex vs semaphore vs monitor, lock-based vs lock-free, CSP vs actors, acquire/release vs seq-cst, language models). Warm-up ("concurrency vs parallelism", "what's a race condition") to senior ("explain the memory model & happens-before", "implement a lock-free stack and the ABA problem", "why false sharing kills scaling", "why is my multithreaded code slower").

1. [[#Concurrency Fundamentals & Mental Models]]
2. [[#Threads & Thread Lifecycle]]
3. [[#Shared State & Race Conditions]]
4. [[#Locks & Mutual Exclusion]]
5. [[#Semaphores, Monitors & Condition Variables]]
6. [[#Memory Models & Happens-Before]]
7. [[#Atomics & Lock-Free Programming]]
8. [[#Deadlock, Livelock & Starvation]]
9. [[#Classic Synchronization Problems]]
10. [[#Thread Pools & Executors]]
11. [[#Futures, Promises & Async Composition]]
12. [[#Async/Await & Event Loops]]
13. [[#Concurrent Data Structures]]
14. [[#Message Passing, Channels & CSP]]
15. [[#The Actor Model]]
16. [[#Parallelism Patterns & Data Parallelism]]
17. [[#Language Concurrency Models]]
18. [[#Concurrency Bugs & Debugging]]
19. [[#Scalability, Contention & Performance]]
20. [[#Distributed & Async Concurrency at Scale]]
21. [[#Scenario & Interview Playbooks]]

## Concurrency Fundamentals & Mental Models

### Summary

**What this topic covers**

The foundational vocabulary and reasoning tools for everything else in this primer. Before you touch a lock, a channel, or an atomic, you need crisp answers to: what is concurrency *versus* parallelism (they are not synonyms); why does concurrency exist at all if it makes code harder; what is the theoretical ceiling on speedup when you add cores (Amdahl vs Gustafson); what is the difference between a *task* (a unit of work) and a *thread* (a unit of execution); which of the two grand paradigms — **shared-memory** or **message-passing** — are you programming in; and are you optimizing for latency or throughput. This topic has 16 questions. It is deliberately conceptual: get these mental models wrong and every downstream topic (threads, races, locks, memory models) becomes a game of memorizing rules you can't derive. Get them right and most of the rest is corollary. The single most important sentence in the whole primer lives here: *concurrency is about structure (dealing with many things at once), parallelism is about execution (doing many things at once)*.

**Mental model**

Hold two axes in your head. **Axis one: structure vs execution.** Concurrency is a way of *structuring* a program as independently-progressing tasks that may interleave; it is a property of the code. Parallelism is *physically* running work at the same instant on multiple execution units; it is a property of the hardware run. A single-core machine can run a highly concurrent program (an event loop juggling 10,000 sockets) with zero parallelism. A `SIMD` vector add is parallel with essentially no concurrency. They are orthogonal — Rob Pike's "Concurrency is not parallelism" talk is the canonical framing. **Axis two: what limits me.** When you add cores, the serial fraction of your program does not shrink, so speedup saturates (Amdahl). But if you also grow the problem size to use the cores, the parallel fraction dominates and speedup keeps climbing (Gustafson). Which law applies depends on whether your workload is *fixed* or *scalable*. Everything else — determinism, latency, throughput — hangs off these two axes.

**Key terms**

- **Concurrency** — composition of independently-executing tasks; a structuring discipline. Dealing with many things at once.
- **Parallelism** — simultaneous execution on multiple processing units. Doing many things at once.
- **Task** — a logical unit of work (a function, a request, a goroutine). What you decompose the problem into.
- **Thread** — a unit of scheduling/execution the OS or runtime runs a task on. Tasks are mapped onto threads.
- **Amdahl's law** — with a fixed workload, speedup is capped by the serial fraction: `S(N) = 1 / (s + p/N)`.
- **Gustafson's law** — with a scalable workload, speedup grows roughly linearly: `S(N) = N − s·(N − 1)`.
- **Shared-memory paradigm** — threads communicate by reading/writing shared mutable state, guarded by locks/atomics.
- **Message-passing paradigm** — tasks communicate by sending messages over channels/mailboxes; "share memory by communicating."
- **Latency** — time to complete one operation (how long a single request takes).
- **Throughput** — operations completed per unit time (how many requests/sec).
- **Determinism** — same input always yields the same observable result and interleaving.
- **Nondeterminism** — outcome depends on scheduling/timing; the default in concurrent code.

**Why interviewers ask this**

This is the tell that separates people who have *reasoned* about concurrency from people who have only *used* a `Thread` class. A junior conflates concurrency and parallelism, thinks "more threads = faster," and cannot say why a program stops speeding up at 8 cores. A senior distinguishes structure from execution, reaches for Amdahl to explain the ceiling, knows that adding threads to an IO-bound service and to a CPU-bound loop are completely different decisions, and chooses shared-memory vs message-passing deliberately rather than by habit. Interviewers open here because the answers predict everything downstream: someone who can't articulate a race condition's *nondeterminism* won't reason correctly about memory models, and someone who thinks parallelism is free won't design for contention. It's also a cheap filter — thirty seconds of "concurrency vs parallelism" tells the interviewer which depth to pitch the rest of the interview at.

**Common confusions**

- "Concurrency and parallelism are the same thing." No — one is about program structure, the other about simultaneous execution. You can have either without the other.
- "More threads always means faster." False past the core count for CPU-bound work; adds context-switch and contention overhead, often *slower* (see Threads & Thread Lifecycle).
- "Amdahl says parallelism is pointless." No — Amdahl bounds *fixed-size* problems; Gustafson shows scalable problems keep benefiting. Both are true, for different regimes.
- "Concurrency needs multiple cores." No — an event loop is concurrent on one core.
- "Latency and throughput move together." They can trade off — batching raises throughput but adds latency; more parallelism can cut latency while contention caps throughput.
- "Nondeterminism is a bug." It's the *default* — the job is to constrain the observable behavior to be correct despite nondeterministic interleaving, not to eliminate interleaving.

**What follows from this topic**

Everything. The task-vs-thread distinction sets up **Threads & Thread Lifecycle** and later thread pools. The shared-memory paradigm opens directly onto **Shared State & Race Conditions**, locks, and memory models; the message-passing paradigm opens onto channels, CSP, and actors. Amdahl's serial fraction reappears as *lock contention* in the scaling topics and as *false sharing* in the hardware topics. Nondeterminism is the reason race conditions, memory models, and happens-before exist at all. If concurrency-vs-parallelism still feels fuzzy, pin it down before moving on — the rest of the primer silently assumes it.

### Q1. What is the difference between concurrency and parallelism?

**One-liner:** concurrency is *dealing with* many things at once (structure); parallelism is *doing* many things at once (execution). Rob Pike: "Concurrency is about structure, parallelism is about execution."

Concurrency is a way to *structure* a program as independently-progressing tasks that can be interleaved. Parallelism is the *physical* simultaneous execution of work on multiple cores. They are orthogonal:

| | Concurrent | Not concurrent |
|---|---|---|
| **Parallel** | Threads on a multicore box | One big SIMD/vector op |
| **Not parallel** | Event loop on one core (async IO) | A plain sequential loop |

```text
Concurrency (1 core, interleaved):   A A - B B - A - B B -   (tasks take turns)
Parallelism  (2 cores, simultaneous): A A A A A A            core 0
                                       B B B B B B            core 1
```

The practical upshot: you *design* for concurrency (decompose into tasks) and you *get* parallelism from the hardware if it's available. A well-structured concurrent program runs correctly on 1 core and speeds up on N. A parallel-only program (e.g. a data-parallel kernel) may have no interesting concurrency at all.

### Q2. Why does concurrency exist? What problems does it solve?

Three distinct motivations, often conflated:

1. **Latency hiding / responsiveness.** While one task blocks on IO (disk, network, user), another runs. A server handling 10k connections must not stall all of them because one is waiting on a slow socket. This is the dominant reason for concurrency in IO-bound systems — and it needs *zero* parallelism.

2. **Throughput via parallelism.** Split CPU-bound work across cores to finish faster. This is where concurrency meets multicore hardware; Moore's law stopped delivering single-thread speedups ~2005, so the only way to go faster is to go wide.

3. **Modeling.** Some problems are *naturally* concurrent — a GUI with a rendering loop plus background workers, a simulation of independent agents, a set of independent requests. Structuring them as concurrent tasks matches the problem's shape.

Note the split: reasons (1) and (3) are about *structure* and exist even on a single core; reason (2) is the one that genuinely needs parallel hardware. Interviewers like to hear you separate "I need concurrency because IO blocks" from "I need parallelism because I have CPU work and many cores."

### Q3. Explain Amdahl's law. What does it tell us about the limits of parallel speedup?

Amdahl's law bounds the speedup of a **fixed-size** workload when you add processors. If a fraction `s` of the work is inherently serial and `p = 1 − s` is parallelizable, then with N processors:

```text
Speedup(N) = 1 / ( s + p/N )
As N → ∞:   Speedup → 1 / s
```

The killer consequence is the `1/s` ceiling. If just **5%** of your program is serial, the *maximum* speedup — with infinite cores — is `1/0.05 = 20×`. You will never beat 20×, no matter how many cores you buy.

```text
serial fraction s   max speedup (N→∞)
     10%                 10×
      5%                 20×
      1%                100×
```

Interview payoff: this is *why* adding cores stops helping. The serial fraction — often lock-guarded critical sections, coordination, or unparallelizable dependencies — is the enemy. It also reframes optimization: shaving the serial 5% down to 2% raises your ceiling from 20× to 50×, which can matter more than adding cores. This same serial fraction shows up later as **lock contention** and **false sharing** — real-world serialization you didn't know you had.

### Q4. How does Gustafson's law differ from Amdahl's, and when does each apply?

Amdahl fixes the *problem size* and asks "how much faster with N cores?" Gustafson fixes the *time budget* and asks "how much *bigger* a problem can I solve with N cores?" — which is what people actually do with a supercomputer.

```text
Amdahl (fixed work):     Speedup = 1 / (s + p/N)         → saturates at 1/s
Gustafson (scaled work): Speedup = N − s·(N − 1)          → grows ~linearly with N
```

The reconciliation: as you add cores, you usually also *grow the workload* (higher resolution, more data, bigger models). When the parallel portion scales with the problem and the serial portion stays roughly constant, the serial *fraction* shrinks, so the Amdahl ceiling recedes. Gustafson is optimistic because it assumes scalable problems; Amdahl is pessimistic because it assumes a frozen one.

Which applies?
- **Amdahl** — latency-bound, fixed job: "make *this* render finish faster." Hard ceiling.
- **Gustafson** — throughput/scale-bound: "use the cluster to simulate a bigger domain." Near-linear scaling.

Both are correct; they answer different questions. Naming both, and saying *which regime you're in*, is the senior signal.

### Q5. What's the difference between a task and a thread?

A **task** is a *logical* unit of work — a function to run, a request to serve, a goroutine, a `Runnable`, a `Future`. A **thread** is a *physical(ish)* unit of execution the OS or a runtime schedules and runs code on. Tasks are what you *write*; threads are what tasks *run on*.

The decoupling is the whole point of modern concurrency:

```text
Tasks:   T1  T2  T3  T4  T5  ...  T1000     (cheap, thousands of them)
              \  |  /   (mapped onto)
Threads:   [th0] [th1] [th2] [th3]          (expensive, ~#cores of them)
```

- **1 task : 1 thread** — the naive model (`new Thread(task)`). Simple, but threads are expensive so you can't have millions.
- **M tasks : N threads** — a thread pool or an M:N runtime (goroutines, virtual threads) multiplexes many cheap tasks over few OS threads.

This is why you can spawn a million goroutines but not a million OS threads: goroutines are *tasks* scheduled onto a small pool of threads. Confusing the two leads to the classic mistake of sizing a thread pool by the number of tasks instead of by the number of cores / the blocking profile.

### Q6. What are the two major concurrency paradigms, and how do they differ?

**Shared-memory** and **message-passing** — two philosophically opposite answers to "how do concurrent tasks coordinate?"

| | Shared-memory | Message-passing |
|---|---|---|
| Communication | Read/write shared mutable state | Send messages over channels/mailboxes |
| Coordination | Locks, atomics, condition variables | Channel send/receive, `select` |
| Motto | Communicate by sharing memory | "Share memory by communicating" (Go) |
| Failure mode | Data races, deadlocks | Deadlock, unbounded queues, lost messages |
| Examples | Java threads + `synchronized`, C++ `std::atomic`, pthreads | Go channels, Erlang/Akka actors, CSP |

Shared-memory is closer to the hardware (threads literally share an address space) and can be faster, but every shared write is a hazard you must synchronize — it's easy to get wrong. Message-passing makes state *ownership* explicit: only one task owns a piece of data at a time, and you transfer ownership by sending, which structurally eliminates whole classes of races.

Neither is universally better. Shared-memory wins for fine-grained, high-performance data structures; message-passing wins for coarse-grained, decoupled components and distributed systems (where there *is* no shared memory). Many real systems mix both. Go's slogan captures the design bias: prefer moving data between tasks over letting many tasks poke at one blob of memory.

### Q7. What's the difference between latency and throughput, and how can they conflict?

**Latency** = time for one operation to complete (seconds per request). **Throughput** = operations completed per unit time (requests per second). They are *not* reciprocals once concurrency enters.

```text
Latency:    |---- one request: 100 ms ----|
Throughput: how many such requests finish per second, possibly overlapping
```

With concurrency you can have high latency *and* high throughput simultaneously: if each request takes 100 ms but you process 1,000 concurrently, throughput is ~10,000 req/s while per-request latency stays 100 ms. This is **Little's law**: `L = λ × W` (concurrency = arrival rate × latency).

They conflict because optimizations for one often hurt the other:
- **Batching** raises throughput (amortize fixed costs) but adds latency (wait to fill the batch).
- **Adding parallelism** can cut latency (split one job across cores) *or* raise throughput (run more jobs), but not both past the point where contention serializes access.
- **Queueing** smooths throughput under bursts but inflates tail latency.

Interview framing: always ask *which one the system optimizes for*. A trading system is latency-first (shave microseconds off one order). A batch analytics pipeline is throughput-first (maximize rows/sec, don't care about one row's latency). The right concurrency design differs completely.

### Q8. When does concurrency help, and when does it actively hurt?

**Helps when:**
- Work is **IO-bound** — tasks spend most of their time waiting (network, disk, DB). Overlapping the waits is nearly free and hugely improves responsiveness and throughput. This is the strongest case and needs no extra cores.
- Work is **CPU-bound and parallelizable** across multiple cores and the parallelizable fraction is large (low Amdahl serial fraction).
- The problem is **naturally concurrent** (independent requests, independent agents).

**Hurts when:**
- Work is **CPU-bound on a single core** (or a GIL-bound runtime) — concurrency just adds context-switching overhead with zero parallelism gain.
- **Contention is high** — tasks fight over the same lock/cache line; adding threads increases contention and can cause *negative* scaling (throughput drops as you add threads — "contention collapse").
- The task is **short** — thread creation / coordination cost dwarfs the work.
- Correctness cost is too high — introducing shared mutable state where a simple sequential solution would do adds race/deadlock risk for no real benefit.

Rule of thumb: reach for concurrency when you have *waiting* (IO) or *parallelizable CPU work on multiple cores*. Don't reach for it to speed up a tight, serial, single-core computation — you'll get complexity and bugs, not speed. Measure before and after; concurrency that doesn't move a metric is pure liability.

### Q9. What is nondeterminism in concurrent programs, and why is it the default?

A concurrent program is **nondeterministic** when its observable behavior depends on the *timing* and *interleaving* of tasks, which the scheduler chooses and which vary run to run. The same inputs can produce different outputs, different orderings, or different bugs on different executions.

Why it's the default: the OS/runtime scheduler is free to interleave threads at almost any instruction boundary, preempt at any time, and run them in any order across cores. You do not control when a thread is paused or resumed. So unless you *impose* ordering (via locks, happens-before edges, channels), the relative order of operations across threads is arbitrary.

```text
Two threads incrementing shared x (start x=0):
Run A:  T1 load, T1 store, T2 load, T2 store  → x = 2
Run B:  T1 load, T2 load, T1 store, T2 store  → x = 1   (lost update!)
```

Same code, same input, different result — purely because the scheduler interleaved differently.

This is *why* concurrency is hard and why the rest of this primer exists. The goal is never to eliminate nondeterminism (you can't control the scheduler) but to **constrain the observable behavior to be correct under every legal interleaving** — via synchronization that removes the *bad* interleavings while allowing the harmless ones. Nondeterminism also makes bugs "heisenbugs": they appear only under rare interleavings and vanish when you add logging (which changes the timing).

### Q10. Can you have concurrency without parallelism, and parallelism without concurrency?

Yes to both — they're orthogonal, and each direction has a canonical example.

**Concurrency without parallelism:** a single-threaded **event loop** (Node.js, Python `asyncio`, a GUI main loop). It juggles thousands of tasks by interleaving them on one core — when a task awaits IO, the loop switches to another ready task. Lots of concurrency (structure), zero parallelism (one core, one thing executing at any instant).

```text
1 core:  [task A runs] await → [task B runs] await → [task A resumes] ...
```

**Parallelism without (interesting) concurrency:** a **data-parallel** computation — a `SIMD` vector add, or `parallelFor` summing an array by splitting it into independent chunks. Multiple cores execute simultaneously (parallelism), but there's no interleaving of independent *tasks* coordinating — it's one operation spread across units. The chunks don't communicate; there's no concurrent *structure* to reason about.

```text
N cores:  core0: sum chunk 0 | core1: sum chunk 1 | ...   (simultaneous, independent)
```

The reason this distinction matters in practice: it tells you where your *complexity* lives. Concurrency without parallelism gives you interleaving hazards but no true simultaneity. Parallelism without concurrency gives you simultaneity but simple (often embarrassingly parallel) structure. The genuinely hard programs — shared mutable state across cores — have *both*, which is where data races live.

### Q11. Your program runs correctly on one core but breaks under real parallelism. Why?

Because a single core (or a runtime that only ever runs one thread at a time, like Python under the GIL for pure-Python code) provides *accidental* mutual exclusion. On one core, threads interleave but never execute *simultaneously*, and preemption points are relatively coarse, so many unsynchronized races just happen not to manifest. Add real cores and:

1. **True simultaneity exposes data races.** Two threads can now read-modify-write the same variable at literally the same instant. The lost-update interleaving that was rare on one core becomes common.

2. **Memory-visibility bugs surface.** On one core there's one cache and writes are trivially visible to the next-scheduled thread. Across cores, a write by T1 may sit in T1's store buffer / L1 cache and not be visible to T2 without a memory barrier. Missing `volatile`/atomic/lock means T2 reads stale data. (See Shared State & Race Conditions.)

3. **Reordering becomes observable.** Compiler and CPU reordering that was harmless when only one thread observed memory becomes visible when a second core watches.

The lesson: correctness on one core proves nothing about a parallel run. "It works on my machine" for concurrent code often means "my machine didn't schedule the bad interleaving." Correct concurrent code must be justified by the *memory model and synchronization*, not by observed runs. This is exactly why race detectors (Go `-race`, TSAN) exist — they flag unsynchronized access even when the run happened to produce the right answer.

### Q12. What does "embarrassingly parallel" mean, and why does it matter for design?

An **embarrassingly parallel** problem is one that splits into completely independent sub-tasks with little or no communication or shared state between them. Each worker takes a chunk, computes, and returns a result; there's nothing to coordinate mid-flight.

Examples: rendering different frames of a movie, resizing a million independent images, brute-forcing hashes, Monte Carlo simulations, mapping a function over an array, grep across independent files.

Why it matters:
- **It hits the best case of Amdahl's law** — the serial fraction is tiny (just split + merge), so speedup is near-linear in cores. These are the problems where "just add machines" actually works.
- **It sidesteps the hard part of concurrency** — no shared mutable state means (almost) no races, locks, or deadlocks. The engineering is about *distribution and aggregation*, not synchronization.
- **It's the target you refactor toward.** When a workload is *not* embarrassingly parallel, a common senior move is to *restructure* it to be — e.g. partition data by key so each partition is independent (sharding), or use map-reduce so the only coordination is the reduce step.

The contrast is a tightly-coupled problem (e.g. an iterative solver where every step depends on all others), where communication and synchronization dominate and scaling is hard. Recognizing which kind you have — and whether you can *make* it embarrassingly parallel — is a core design instinct.

### Q13. Why did concurrency become unavoidable for performance in the last two decades?

Because single-thread performance stopped growing. Through the 1990s and early 2000s, CPUs got faster mainly by raising clock speeds — you could write sequential code and it got faster every hardware generation for free ("the free lunch"). Around 2004–2006, clock scaling hit a **power/heat wall**: pushing frequency higher dissipated too much heat. Dennard scaling (power density staying constant as transistors shrank) broke down.

Chipmakers responded by using their still-growing transistor budgets (Moore's law kept going for a while) to add **more cores** rather than faster ones. So the hardware kept getting more capable, but only *if software could use multiple cores in parallel*.

The consequence, coined by Herb Sutter as "The free lunch is over": to get faster on new hardware, programs now *must* be concurrent/parallel. A single-threaded program on a 64-core machine uses ~1.5% of the chip. This is why concurrency moved from a niche systems-programming skill to a mainstream requirement, why languages grew first-class concurrency (goroutines, async/await, `java.util.concurrent`, Rust's fearless concurrency), and why interviewers care that you can actually reason about it. Note the caveat: this argument is about *CPU-bound* throughput. IO-bound concurrency (the other big driver) was always motivated by latency hiding, independent of core counts.

### Q14. Adding more threads to a CPU-bound task made it slower. What's going on?

Classic over-parallelization. For CPU-bound work, useful parallelism is capped at roughly the number of physical cores — you have N cores, so at most N threads can *actually* compute at once. Adding threads beyond that doesn't add compute; it adds overhead:

1. **Context-switch overhead.** More threads than cores means the scheduler time-slices them, and each switch costs a save/restore of registers plus cache/TLB pollution. Pure overhead, no extra work done.

2. **Cache thrashing.** Each thread has a working set. Oversubscription evicts each other's cache lines, so every thread runs slower than it would with the cache to itself.

3. **Contention.** If the threads share any state behind a lock, more threads means more time spent waiting on / fighting over the lock — the serial fraction (Amdahl) grows, and you can hit *contention collapse* where throughput actually drops as threads increase.

4. **False sharing.** Threads writing to different variables that share a cache line ping-pong that line between cores (covered in the scaling topic).

```text
throughput
   |        .-''-.          (peak near #cores)
   |      .'      '._
   |    .'            '-.___  (oversubscription: falls off)
   |  .'
   +----------------------------- threads
        #cores
```

Fix: size the pool to the core count for CPU-bound work (`Runtime.availableProcessors()`), not to the number of tasks. IO-bound work is the opposite — there you *want* more threads than cores because they're mostly blocked waiting (see the thread-pool sizing discussion later).

### Q15. What does it mean to say concurrency is a structuring tool, not a performance tool?

It means concurrency is fundamentally about *how you organize a program into independently-progressing pieces*, and speed is only *sometimes* a consequence. This reframes a common misconception ("I'll add threads to make it fast").

Concurrency buys you **structure**: a way to express "these things happen independently and may overlap" — a web server modeling each request as a task, a UI keeping the render loop responsive while work happens in the background, a pipeline where stages run independently. That structural clarity is valuable *even on one core with no speedup at all*, because it matches the problem's shape and keeps unrelated work from blocking each other.

**Performance** (going faster) comes from **parallelism** — and parallelism needs multiple execution units *and* a parallelizable workload. A well-structured concurrent program *enables* parallelism (the runtime can spread tasks across cores) but doesn't guarantee it: run it on one core and you get the structure without the speed.

Rob Pike's point: design for concurrency (good decomposition into tasks), and parallelism becomes available when the hardware offers it. If you conflate the two, you make two mistakes — you add threads expecting speed on single-core/IO-bound work (and get overhead), or you write tangled sequential code because "it's just one core anyway" (and lose the structural benefits). Keep them separate: concurrency is a *design* decision, parallelism is an *execution* outcome.

### Q16. What are the main hazards that make concurrent programming hard?

A concise map of what can go wrong — each is a topic later in this primer:

- **Data races** — unsynchronized concurrent access to shared memory with at least one write. Undefined/broken behavior. (Shared State & Race Conditions.)
- **Race conditions** — correctness bugs from bad interleavings (check-then-act, read-modify-write), which can exist even without a data race.
- **Visibility/reordering** — a write by one thread not seen by another, or operations observed out of order, because of caches, store buffers, and compiler/CPU reordering. (Memory models.)
- **Deadlock** — threads waiting on each other in a cycle, none progressing. (Locks/deadlock topics.)
- **Livelock / starvation** — threads active but making no progress, or one thread perpetually denied a resource.
- **Nondeterminism / heisenbugs** — bugs that appear only under rare interleavings and vanish when observed.
- **Contention & scaling limits** — locks, false sharing, cache coherence traffic that make added cores stop helping (Amdahl in the wild).

The reason this list matters: nearly every one is *invisible in a passing test run*. Concurrent code that "works" may just have avoided the bad interleaving. The discipline of concurrent programming is reasoning about *all legal interleavings and the memory model*, not trusting observed executions — and picking synchronization primitives that eliminate the hazardous interleavings while keeping the useful concurrency.

## Threads & Thread Lifecycle

### Summary

**What this topic covers**

The thread as the working programmer sees it: what a thread *is* from inside your code, how you create and `join` them, the lifecycle states a thread moves through (new → runnable → blocked/waiting → terminated), daemon threads, thread-local storage, and — the modern centerpiece — the distinction between **OS (kernel) threads**, **green/user threads**, and **virtual threads / coroutines** in an **M:N** scheduling model (Project Loom, Go's goroutines). It also covers the *cost* of a thread (stack memory, context-switch time) and the decision of when to spawn a raw thread versus hand work to a pool. This topic has 16 questions. It deliberately stays at the *programming* level — how you use and reason about threads — and complements the OS primer, which covers how the kernel scheduler and context switch are *implemented*. Here the question is always "how do I use this correctly and what does it cost me," not "how does the scheduler pick the next thread."

**Mental model**

A thread is an **independent path of execution through your code that shares the process's heap but has its own stack and registers (its own call stack and instruction pointer)**. Picture a process as an address space (heap, globals, open files) and threads as multiple "cursors" moving through the code simultaneously, each with a private stack of local variables but all seeing the same shared heap. That shared heap is exactly why races exist and why this topic hands off to Shared State. The second mental model is the **mapping question**: a thread you create in your language may map 1:1 to a kernel thread (Java platform threads, C++ `std::thread`), or many of your "threads" may be multiplexed onto few kernel threads by a runtime scheduler (goroutines, virtual threads) — an **M:N** model. The whole modern story (Loom, Go) is about making threads *cheap* by moving the scheduling into user space so you can have millions of them. Threads are cheap to *use* and expensive to *have*; that tension drives pools and virtual threads.

**Key terms**

- **Thread** — an independent execution path sharing the process address space, with its own stack, registers, and program counter.
- **Process vs thread** — a process owns the address space; threads live inside it and share memory. Cross-process needs IPC; cross-thread just shares the heap.
- **OS/kernel thread** — a thread the kernel schedules; 1:1 with a language thread in classic models. Expensive (MB-scale stack, syscall to switch).
- **Green/user thread** — a thread scheduled in user space by a runtime, invisible to the kernel.
- **Virtual thread (Project Loom)** — a JVM-managed lightweight thread multiplexed over a small pool of carrier (OS) threads; cheap, millions feasible.
- **M:N scheduling** — M user tasks multiplexed onto N OS threads by a runtime scheduler (Go's GMP, Loom).
- **Thread states** — new, runnable, blocked (lock), waiting/timed-waiting (`wait`/`join`/`sleep`), terminated.
- **Daemon thread** — a background thread that does not keep the JVM/process alive; killed when all non-daemon threads exit.
- **join** — block until another thread finishes; the basic "wait for completion" primitive.
- **Thread-local storage (TLS)** — per-thread variable slots; each thread sees its own value, avoiding sharing.
- **Context switch** — saving one thread's state and loading another's; costs cycles + cache/TLB effects.
- **Stack size** — each thread reserves a stack (often ~1 MB default); the main reason raw OS threads don't scale to millions.

**Why interviewers ask this**

Threads are the concrete unit almost everyone claims to know, so it's a fast depth probe. A junior can call `new Thread(...).start()` but can't say what states a thread passes through, why a blocked thread differs from a waiting one, or why you can't spawn a million OS threads. A senior explains the lifecycle precisely, knows a daemon thread won't keep the process alive (and the bug that causes), reaches for thread-local storage to avoid sharing, and — the current hot topic — can contrast platform threads with virtual threads / goroutines and explain the M:N model and *why* it exists (blocking IO cheaply). In 2026, "do you understand virtual threads / structured concurrency" is a frequent senior-Java question, and goroutines are table stakes for Go roles. Interviewers also probe cost: candidates who know a thread costs ~1 MB of stack and a context switch costs microseconds design better pools.

**Common confusions**

- "Threads have their own memory." Only their own *stack*; they *share* the heap — which is the whole source of data races.
- "Blocked and waiting are the same state." No — blocked = waiting to acquire a monitor lock; waiting = voluntarily paused via `wait()`/`join()`/`park()` until signaled.
- "Daemon vs user thread is about privilege." No — it's only about whether the thread keeps the process alive.
- "Virtual threads / goroutines run in parallel more than OS threads." They don't add cores; they make *blocking* cheap so you can have far more concurrent tasks. Parallelism is still bounded by cores.
- "A thread pool is just a list of threads." It's threads *plus* a work queue *plus* a sizing/rejection policy — the queue and sizing are where the design lives.
- "`Thread.sleep` releases the lock." It does not — a sleeping thread holds any locks it owns (a classic deadlock trap). `wait()` releases; `sleep()` doesn't.

**What follows from this topic**

The shared-heap property leads straight into **Shared State & Race Conditions** — threads sharing memory is *why* you need synchronization. Thread-local storage is one of the escape hatches (confinement) that topic discusses. The cost-of-a-thread and pool discussion feeds the thread-pool/executor and work-stealing topics. Virtual threads and the M:N model connect forward to async/await, coroutines, and event loops (they solve the same "cheap blocking" problem differently). And the lifecycle states (blocked/waiting) are the vocabulary you'll use when reasoning about locks, condition variables, and deadlock.

### Q1. What is a thread from a programmer's point of view?

A thread is an **independent path of execution through your program**. Concretely, it has:

- its own **program counter** (where it is in the code),
- its own **stack** (its call frames and local variables),
- its own **registers**,

but it **shares the rest of the process** with sibling threads — the heap, global/static variables, open file descriptors, and code. Multiple threads = multiple cursors running through the same program at the same time, each with a private notepad (stack) but all writing on the same whiteboard (heap).

```text
Process address space
+-----------------------------------------------+
|  Code   |   Heap (shared)   |  Globals (shared)|
+-----------------------------------------------+
   ^ T1 stack   ^ T2 stack   ^ T3 stack   (private per thread)
   PC1,regs1    PC2,regs2    PC3,regs3
```

The programmer-relevant consequences:
- Because threads **share the heap**, two threads touching the same object need synchronization — this is the entire reason races exist.
- Because each thread has its **own stack**, locals are automatically thread-private (a form of confinement); you don't share a local unless you deliberately publish it.
- Creating a thread is cheap to *express* (`new Thread(r).start()`) but the thread itself consumes real resources (a stack, a kernel scheduling entity in the classic model).

Contrast with a process: separate processes have separate address spaces and must use IPC (pipes, sockets, shared memory) to communicate, which is safer (isolation) but heavier. Threads trade isolation for cheap shared-memory communication.

### Q2. How do you create and join threads, and what does joining guarantee?

Creation depends on the language, but the shape is universal: hand a task (a function/closure) to a thread abstraction and start it; later, `join` to wait for it to finish and (crucially) to establish a happens-before edge.

```java
// Java
Thread t = new Thread(() -> doWork());
t.start();          // begins concurrent execution (NOT run(), which runs inline)
// ... do other work ...
t.join();           // block until t finishes
```

```go
// Go — a goroutine plus a WaitGroup to join
var wg sync.WaitGroup
wg.Add(1)
go func() { defer wg.Done(); doWork() }()
wg.Wait()           // block until the goroutine signals done
```

```rust
// Rust — join returns the thread's result and enforces ownership
let handle = std::thread::spawn(|| do_work());
let result = handle.join().unwrap();  // waits, propagates panic
```

Two things `join` guarantees:
1. **Completion** — the calling thread blocks until the target thread's work is done.
2. **Visibility / happens-before** — everything the joined thread did *happens-before* the `join` returns, so the joining thread sees all its writes without extra synchronization. This is why you can spawn a worker, `join` it, and safely read the result it wrote to a shared field.

Common mistake: calling `run()` instead of `start()` in Java — `run()` just executes the task on the *current* thread, no concurrency. And forgetting to `join` (or `WaitGroup.Wait`) means the main thread may exit or read results before the worker finishes.

### Q3. Walk through the states in a thread's lifecycle.

Using the JVM model (other runtimes are analogous):

```text
 NEW ──start()──▶ RUNNABLE ──▶ TERMINATED
                    │  ▲
      wants monitor │  │ lock acquired / notified / timeout / IO done
                    ▼  │
                 BLOCKED / WAITING / TIMED_WAITING
```

- **NEW** — thread object created, `start()` not yet called. No OS thread yet.
- **RUNNABLE** — eligible to run: either running on a core or sitting in the scheduler's ready queue. (The JVM lumps "running" and "ready" together; it can't tell whether the OS gave it a core right now.)
- **BLOCKED** — waiting to *acquire a monitor lock* (entering a `synchronized` block someone else holds). Specifically about lock contention.
- **WAITING** — voluntarily paused indefinitely until another thread signals it: `Object.wait()`, `Thread.join()`, `LockSupport.park()`.
- **TIMED_WAITING** — same but with a timeout: `sleep(ms)`, `wait(ms)`, `join(ms)`, `park(nanos)`.
- **TERMINATED** — `run()` returned or threw; the thread is dead and cannot restart.

The distinctions that matter in interviews: **BLOCKED vs WAITING**. BLOCKED is involuntary and lock-specific (I want a monitor someone holds). WAITING is voluntary and signal-driven (I called `wait()`/`join()` and I'll stay parked until notified). Also note a thread doing blocking IO is *RUNNABLE* in the JVM's eyes even though it's stuck in a syscall — the JVM can't see kernel-level blocking. Knowing these states is the vocabulary for reading a thread dump and diagnosing deadlock (all threads BLOCKED on each other's locks) vs a stuck `wait` (WAITING with no notifier).

### Q4. What are daemon threads and when do you use them?

A **daemon thread** is a background thread that **does not keep the process alive**. The JVM exits when all *non-daemon* (user) threads have finished, and at that moment any still-running daemon threads are **abruptly terminated** — no chance to finish, no `finally` blocks guaranteed to complete.

```java
Thread t = new Thread(this::backgroundWork);
t.setDaemon(true);   // must be set BEFORE start()
t.start();
// If main() returns and this is the only other thread, the JVM exits
// and t is killed mid-flight.
```

Use daemon threads for **background chores that should never prevent shutdown**: heartbeat/monitoring threads, cache-eviction sweepers, background metric flushers, JVM's own GC and finalizer threads. The semantics you want are "run while the app runs, die instantly when the app is done."

The classic **bug**: making a thread daemon when it's doing work you actually need to complete (writing a file, flushing a buffer). On shutdown it gets killed mid-write, corrupting output or losing data. Rule: daemon = "I don't matter enough to delay exit and it's fine to kill me abruptly." If the work must complete, keep it a user thread and coordinate an orderly shutdown (`join`, or an executor's `shutdown()` + `awaitTermination`).

Note the inverse hang: a rogue *non-daemon* thread (e.g. a thread pool you forgot to shut down) keeps the JVM alive after `main` returns — the program "won't exit" for no obvious reason. Non-daemon executor threads are a frequent cause.

### Q5. What is thread-local storage and when is it the right tool?

**Thread-local storage (TLS)** gives each thread its *own* copy of a variable behind a shared name. Every thread that reads the thread-local sees a value private to that thread; there is no sharing, so there is no race.

```java
// Each thread gets its own SimpleDateFormat (which is NOT thread-safe)
static final ThreadLocal<SimpleDateFormat> FMT =
    ThreadLocal.withInitial(() -> new SimpleDateFormat("yyyy-MM-dd"));

String format(Date d) { return FMT.get().format(d); }  // no synchronization needed
```

When it's the right tool:
- **Per-thread scratch/state for non-thread-safe objects** — `SimpleDateFormat`, `Random`, buffers, parsers. Rather than sharing one behind a lock, give each thread its own.
- **Implicit context propagation** — request IDs, user/security context, transaction handles, MDC logging context. The value travels with the thread instead of being threaded through every method signature.

The trade-offs / traps:
- **It's confinement, not magic.** The escape from races is that the object is never shared — so don't hand a thread-local's object to another thread.
- **Leaks with pooled threads.** In a thread pool, threads are reused, so a thread-local set during one task lingers into the next task on that same thread. Always `remove()` in a `finally` (or use a framework that scrubs them), or you leak memory and cross-contaminate requests. This is a very common production bug.
- **Doesn't cross async boundaries** cleanly — when work hops threads (executors, reactive, virtual-thread carriers), the thread-local doesn't automatically follow. Scoped values (Java 21+) and context propagation libraries address this.

TLS is one of the "escape hatches" from shared mutable state: instead of synchronizing access to one shared thing, give each thread its own — *confinement by construction*.

### Q6. OS threads vs green threads vs virtual threads — what's the difference?

Three points on the "who schedules the thread" spectrum:

| | OS / kernel thread | Green / user thread | Virtual thread (Loom) / goroutine |
|---|---|---|---|
| Scheduled by | Kernel scheduler | Language runtime (user space) | Language runtime over carrier OS threads |
| Mapping | 1:1 to kernel | N:1 (many on one kernel thread) | M:N (many on few kernel threads) |
| Cost | High (~1 MB stack, syscall switch) | Very low | Very low (~hundreds of bytes, growable stack) |
| Blocking IO | Blocks the kernel thread | Blocks *all* greens on that kernel thread (bad) | Runtime parks the virtual thread, frees the carrier |
| True parallelism | Yes (kernel spreads across cores) | No (one kernel thread) | Yes (carriers span cores) |
| Examples | Java platform thread, `std::thread`, pthread | Old Java green threads, early Ruby | Java virtual threads (21+), Go goroutines |

**OS threads** are the classic model: each language thread is a kernel thread. Real parallelism, but expensive — the ~1 MB stack and syscall-based context switch mean you top out at thousands, not millions.

**Green threads** (pure N:1) were an early attempt at cheap threads scheduled entirely in user space. Their fatal flaw: one green thread doing a *blocking* syscall blocks the single underlying kernel thread, freezing *all* the greens. And no multicore parallelism.

**Virtual threads / goroutines** are the modern M:N answer that fixes both: many cheap user-mode threads multiplexed over a small pool of kernel "carrier" threads. The runtime intercepts blocking operations — when a virtual thread blocks on IO, the runtime *unmounts* it from its carrier and runs another virtual thread there, so blocking is nearly free and you get multicore parallelism from the carrier pool. That's why you can run a million goroutines / virtual threads: they're cheap tasks, not kernel threads.

### Q7. What is the M:N threading model and what problem does it solve?

**M:N** means the runtime multiplexes **M** user-level tasks (goroutines, virtual threads) onto **N** OS/kernel threads (typically N ≈ number of cores), with a **user-space scheduler** deciding which task runs on which OS thread.

It solves the tension between two things you can't get from a single model:
- **1:1 (each task = one OS thread)** gives real parallelism and simple blocking, but threads are *expensive* (stack + kernel switch), capping you at thousands.
- **N:1 (all tasks on one OS thread)** makes tasks *cheap*, but a single blocking call freezes everyone and there's no multicore use.

M:N takes the best of both: tasks are cheap (like N:1) *and* run in parallel across cores (like 1:1).

```text
Goroutines / virtual threads (M, thousands+):
   g1 g2 g3 g4 g5 g6 ... g10000
         │  user-space scheduler multiplexes
   ┌─────┴─────┬─────────┬─────────┐
  OS thread   OS thread  OS thread  (N ≈ #cores, "carriers"/"P"s)
   core0       core1      core2
```

The crux is **cooperative-plus-preemptive scheduling around blocking**: when a task blocks (channel receive, IO, lock), the scheduler *parks* it and runs another task on that OS thread instead of wasting the thread. Go's runtime (the **GMP** model — Goroutines, Machine=OS thread, Processor=scheduling context) and Java's Loom both do this. The payoff for the programmer: you write **straight-line blocking code** ("call the DB, wait for the result") at massive scale, and the runtime turns blocking into cheap parking behind your back — no callback hell, no manual async state machines. It's the "cheap blocking" answer that async/await solves differently (see the async topics).

### Q8. Why can't you just spawn a million OS threads?

Two hard costs make OS threads a scarce resource:

1. **Stack memory.** Each OS thread reserves a stack — commonly ~1 MB (default on Linux/JVM platform threads, tunable but not free). A million threads × 1 MB ≈ **1 TB of address space / committed memory**. You run out of memory long before a million. Even at a more modest 256 KB, a million threads is 256 GB. The stack is *reserved per thread* and can't be shared.

2. **Scheduling / context-switch overhead.** The kernel scheduler must manage every thread. With far more runnable threads than cores, the scheduler thrashes — each **context switch** costs a syscall, register save/restore, and (worse) trashes the CPU cache and TLB, so real work slows down. Scheduling cost grows with thread count; you spend cycles switching instead of computing.

```text
1,000,000 OS threads × ~1 MB stack  ≈ 1 TB  →  impossible
1,000,000 goroutines × ~2–8 KB growable stack ≈ a few GB → routine
```

This is precisely the gap **virtual threads / goroutines** close. They (a) start with a tiny **growable** stack (kilobytes, resized on demand) instead of a fixed megabyte, and (b) are scheduled in **user space** over a small carrier pool, so there's no kernel scheduling entity per task and no syscall per switch. That's why "one goroutine per request" or "one virtual thread per request" scales to hundreds of thousands, while "one OS thread per request" (old servlet model) forced you into thread pools and bounded concurrency. The takeaway: OS threads are expensive *because* the kernel manages them with big fixed stacks; make threads cheap by managing them yourself with small growable stacks.

### Q9. What does a context switch actually cost, and why does it matter?

A **context switch** is saving the currently-running thread's state (registers, program counter, stack pointer) and loading another thread's state so it can run. It matters because it's pure overhead — no application work happens during the switch — and it has both a *direct* and a much larger *indirect* cost.

- **Direct cost** — saving/restoring registers and, for a *cross-process* switch or a kernel-mediated thread switch, a trip through the kernel (mode switch) and possibly a TLB flush. On the order of ~1–10 microseconds. That sounds tiny until you do it millions of times a second.

- **Indirect cost (the real killer)** — **cache pollution**. The incoming thread has a different working set, so it evicts the outgoing thread's cache lines. After the switch, both threads run "cold," suffering cache misses to refill L1/L2. This lost cache locality often dwarfs the direct switch cost and doesn't show up in a simple "switch takes X microseconds" figure.

Why it matters for design:
- **Oversubscription hurts.** More runnable threads than cores means more switching and more cache thrash — the reason adding threads to CPU-bound work slows it down (see Fundamentals). Size CPU-bound pools near the core count.
- **User-space scheduling is cheaper.** A goroutine/virtual-thread switch doesn't need a kernel round-trip (no mode switch), so it's far lighter than an OS-thread switch — part of why M:N runtimes scale.
- **Blocking is expensive twice** — a thread that blocks forces a switch out and later a switch back in, each with cache cost. This is why non-blocking / async designs and cheap parking (virtual threads) win under high concurrency.

The OS primer covers *how* the switch is implemented; the programmer takeaway is: switches aren't free, minimize needless ones (right-size pools, avoid lock contention that parks/wakes threads, prefer cheap user-mode scheduling for high fan-out).

### Q10. When should you spawn a raw thread versus use a thread pool?

Default to a **pool**; raw threads are the exception.

**Use a thread pool (executor) when:**
- You have **many short-to-medium tasks** (requests, jobs, events). Pools amortize thread-creation cost by reusing a fixed set of threads, and cap concurrency so you don't oversubscribe cores or exhaust memory.
- You need **backpressure / bounded resource use** — a bounded work queue plus a rejection policy protects the system under load. Unbounded thread creation (a `new Thread` per request) is a classic way to OOM under a traffic spike.
- You want **lifecycle management** — orderly shutdown, metrics, sizing tied to core count or IO profile.

**Spawn a raw thread when:**
- You need **one long-lived, dedicated thread** for a specific role — an event-dispatch loop, a single background monitor, a blocking listener — where pooling adds nothing.
- You need **special thread configuration** the pool doesn't give you (custom stack size, priority, a specific name, daemon status) for a one-off.

```java
// Prefer: bounded pool, sized to workload, orderly shutdown
ExecutorService pool = Executors.newFixedThreadPool(nThreads);
pool.submit(task);
pool.shutdown();

// Raw thread: only for a dedicated, long-lived role
Thread monitor = new Thread(this::monitorLoop, "health-monitor");
monitor.setDaemon(true);
monitor.start();
```

**The 2026 wrinkle:** with **virtual threads**, the calculus shifts for *IO-bound* work. Because virtual threads are cheap, "thread-per-task" (even a virtual thread per request) is viable again — you no longer need a bounded pool to avoid the cost of OS threads (`Executors.newVirtualThreadPerTaskExecutor()`). But you *still* pool/limit for **CPU-bound** work (bounded by cores) and to bound access to scarce downstream resources (DB connections). Rule: pool to *limit* a scarce resource; use cheap virtual threads when the only thing you were limiting was thread cost itself.

### Q11. Does `Thread.sleep()` release the locks a thread holds?

**No.** A sleeping thread keeps every lock it currently owns. `Thread.sleep(ms)` moves the thread to `TIMED_WAITING` for the duration but does *not* touch monitors. This is one of the most consequential differences between `sleep()` and `wait()`:

| | `Thread.sleep(ms)` | `Object.wait()` |
|---|---|---|
| Releases the monitor? | **No** — holds all locks | **Yes** — releases the monitor it's called on |
| Wakes on | Timeout | `notify()`/`notifyAll()` (or timeout, if `wait(ms)`) |
| Must hold the lock to call? | No | Yes — must be inside `synchronized` on that object |
| Purpose | Pause this thread | Wait for a condition another thread will signal |

The practical trap — sleeping inside a critical section deadlocks or serializes everything:

```java
synchronized (lock) {
    Thread.sleep(5000);   // still holding `lock` for 5s!
    // every other thread wanting `lock` is BLOCKED the whole time
}
```

If you need to *pause until a condition holds*, you almost never want `sleep` — you want `wait()` in a loop on a predicate (which releases the lock so another thread can change the condition and `notify` you). `sleep` is for "just pause this thread for a fixed time" (backoff, polling intervals, throttling), and even then, don't hold a lock across it. Getting this distinction right is a frequent interview and code-review flag; "why is my throughput terrible / why is this deadlocked" often traces to a `sleep` (or blocking call) inside a held lock.

### Q12. What happens to threads when the main thread exits?

Depends on whether the surviving threads are **user (non-daemon)** or **daemon** threads — this is exactly what the daemon flag controls.

- **Non-daemon (user) threads keep the process alive.** When `main` returns, the JVM does *not* exit if any non-daemon thread is still running. The process stays up until the last user thread finishes. So `main` finishing is *not* the same as the program ending.
- **Daemon threads do not keep the process alive.** Once the last non-daemon thread ends, the JVM exits and any remaining daemon threads are killed abruptly (no guaranteed `finally`).

```text
main() returns
   ├─ any non-daemon thread alive? ── yes ──▶ process keeps running
   └─ only daemon threads left?    ── yes ──▶ JVM exits, daemons killed
```

Two classic bugs this explains:
1. **"My program prints its result but won't exit."** A non-daemon thread is still alive — very often a thread pool you forgot to `shutdown()`, or a library's background thread. The JVM waits for it forever. Fix: shut down executors, or mark truly-background threads daemon.
2. **"My background daemon didn't finish its work."** On shutdown the daemon was killed mid-task. Fix: if the work must complete, make it a user thread and join it / use `shutdown()` + `awaitTermination()`.

Note this is JVM-specific framing; in C/pthreads, returning from `main` (calling `exit`) terminates the whole process and *all* threads immediately unless you `pthread_exit` from main. Go: when `main` returns, the program exits and all goroutines are torn down regardless — Go has no daemon/user distinction, so you must explicitly wait (`WaitGroup`, channels) for goroutines whose completion you care about.

### Q13. How do you stop a thread safely, and why is forceful termination dangerous?

**Cooperative cancellation** is the only safe way: signal the thread to stop and let it wind down at a safe point. Forceful termination (Java's deprecated `Thread.stop()`, killing at an arbitrary instruction) is dangerous because it can abort the thread *mid-update* — while it holds a lock or is halfway through mutating shared state — leaving locks unreleased or invariants broken and the whole program corrupted.

The idiomatic pattern is **interruption / a cancellation flag**, checked cooperatively:

```java
// Interruption: the thread checks and responds
while (!Thread.currentThread().isInterrupted()) {
    doChunkOfWork();
}
// called from elsewhere: worker.interrupt();
```

```java
// Blocking calls throw InterruptedException — don't swallow it
try {
    queue.take();                       // responds to interrupt
} catch (InterruptedException e) {
    Thread.currentThread().interrupt(); // restore the flag
    return;                             // exit cleanly
}
```

```go
// Go: cancellation via context (idiomatic)
func worker(ctx context.Context) {
    for {
        select {
        case <-ctx.Done():   // cancelled
            return
        default:
            doChunkOfWork()
        }
    }
}
```

Key points:
- **Interruption is a request, not a kill.** The thread must *cooperate* — check `isInterrupted()` and handle `InterruptedException`. Tight loops with no check can't be interrupted.
- **Don't swallow `InterruptedException`.** Either propagate it or restore the interrupt flag (`Thread.currentThread().interrupt()`) so callers up the stack still see the cancellation. Silently catching it is a common bug that makes threads un-cancellable.
- **Why forceful kill is banned:** `Thread.stop()` releases all the thread's monitors instantly, potentially exposing half-mutated objects to other threads — the reason it's deprecated. There's no safe way to yank a thread at an arbitrary point.

The rule: threads stop *themselves* in response to a request. Design long-running tasks to check for cancellation at safe boundaries.

### Q14. Are goroutines threads? How do they relate to OS threads?

**No — a goroutine is not an OS thread.** A goroutine is a lightweight, user-space *task* that Go's runtime multiplexes onto a small pool of OS threads (the M:N model). You can have hundreds of thousands of goroutines running on, say, 8 OS threads.

The Go runtime scheduler uses the **GMP** model:
- **G** — a goroutine (the task: stack, instruction pointer, state).
- **M** — a "machine," an actual OS thread that executes goroutines.
- **P** — a "processor," a scheduling context / run queue; `GOMAXPROCS` of them (defaults to the number of cores). A G runs on an M only while that M holds a P.

```text
G G G G G ...  (goroutines: cheap, ~2 KB growable stacks, thousands)
   ▼ scheduled by P's run queue
[P0]──[M0/core0]   [P1]──[M1/core1]   ...    (M ≈ #cores)
```

Why this design:
- **Cheap creation** — a goroutine starts with a ~2 KB **growable** stack (vs ~1 MB for an OS thread), so `go f()` is nearly free and millions are feasible.
- **Cheap blocking** — when a goroutine makes a blocking syscall or channel op, the runtime **parks** it and runs another goroutine on that M (or hands the P to another M), so the OS thread isn't wasted. Blocking IO written as straight-line code stays scalable.
- **Real parallelism** — with `GOMAXPROCS` P's on multiple M's, goroutines genuinely run in parallel across cores.

So the relationship: **goroutines are tasks; OS threads (M's) are the execution units they're scheduled onto.** This is the same insight as Java virtual threads — decouple "cheap task you write" from "expensive OS thread you run on." It's why Go's concurrency scales without you ever managing a thread pool.

### Q15. What's the difference between concurrency at the thread level and at the process level?

Both give you concurrent execution, but they differ fundamentally in **memory isolation**, which drives everything else:

| | Threads (same process) | Processes |
|---|---|---|
| Address space | **Shared** heap, globals, FDs | **Isolated** — separate address spaces |
| Communication | Direct shared memory (fast) | IPC: pipes, sockets, shared-memory segments, files |
| Failure isolation | One thread crash can take down the whole process | A crashed process doesn't corrupt siblings |
| Creation cost | Cheaper (share the address space) | Heavier (new address space, page tables) |
| Data races | Yes — shared mutable state | Structurally avoided (no shared memory by default) |
| Context switch | Cheaper (same address space, no TLB flush) | More expensive (address-space switch, TLB effects) |

**Threads** are the shared-memory paradigm: fast communication (just read/write the same object), but you inherit all of shared mutable state's hazards — races, locks, the need for a memory model.

**Processes** are the isolation play: a bug or crash in one process can't corrupt another's memory, and there are no data races *because there's nothing shared by default*. The cost is heavier communication (you must serialize data across an IPC boundary) and higher per-unit overhead.

This is why **Python's multiprocessing** is the standard escape from the GIL for CPU-bound work — separate processes each get their own interpreter and can truly parallelize, at the cost of pickling data between them (see the GIL discussion). It's also why fault-tolerant systems (Erlang, browsers with per-tab processes, Chrome's site isolation, Nginx workers) favor process isolation: a crash is contained. The design axis is **shared-memory speed (threads) vs isolation and safety (processes)** — the same shared-memory-vs-message-passing tension from the Fundamentals topic, now at the OS level.

### Q16. What is a thread dump and how do you use it to diagnose problems?

A **thread dump** is a snapshot of every thread in a process at one instant — each thread's name, **state** (RUNNABLE / BLOCKED / WAITING / TIMED_WAITING), current stack trace, and, critically, which **locks it holds** and which lock it's **waiting to acquire**. It's the single most useful artifact for diagnosing "the app is stuck/slow" in a threaded runtime.

How to get one (JVM): `jstack <pid>`, `kill -3 <pid>` (prints to stdout), or via a profiler / `ThreadMXBean`. Go: `SIGQUIT` (`kill -3`) dumps all goroutine stacks.

What you read it for:
- **Deadlock** — the JVM's dump *explicitly detects and prints deadlocks*: "Thread A holds lock L1, waiting for L2; Thread B holds L2, waiting for L1." Two (or more) threads BLOCKED on each other's monitors in a cycle. Instant diagnosis.

```text
"T1"  BLOCKED  waiting to lock <0xL2>  (held by "T2")
      holds <0xL1>
"T2"  BLOCKED  waiting to lock <0xL1>  (held by "T1")
      holds <0xL2>
    → cycle = deadlock
```

- **Lock contention / hot lock** — many threads all BLOCKED waiting for the *same* monitor means a serialization bottleneck (Amdahl's serial fraction in the flesh). Points you at the over-coarse lock to split.
- **Thread-pool exhaustion** — all pool threads BLOCKED/WAITING (e.g. on a downstream call) while the work queue backs up: the app "hangs" because there are no free workers.
- **A stuck `wait`** — a thread WAITING forever because no one calls `notify()` (a lost-wakeup or missing-signal bug).
- **A hot CPU thread** — a RUNNABLE thread with the same stack across successive dumps is likely spinning/looping; take two dumps a few seconds apart to spot it.

Technique: **take several dumps a few seconds apart** and compare. Threads stuck in the same frame across all of them are your problem; threads that move are fine. This is the programmer-level diagnostic complement to the OS primer's scheduler internals — you don't need kernel tracing, just the dump and the lifecycle-state vocabulary from Q3.

## Shared State & Race Conditions

### Summary

**What this topic covers**

The core disease of shared-memory concurrency and the precise vocabulary for it. Shared mutable state is *the* root problem: the moment two threads can read and write the same memory, correctness depends on interleaving, and interleaving is nondeterministic. This topic nails down the distinctions people routinely blur — **data race vs race condition** (not synonyms), the three separate concerns **atomicity, visibility, and ordering**, why the innocent-looking `count++` silently loses updates (shown as an explicit T1/T2 interleaving), the **check-then-act** and **read-modify-write** bug families, what a **critical section** is, and the two principled escapes that dodge synchronization entirely — **immutability** and **confinement**. It closes with **TOCTOU** (time-of-check-to-time-of-use), the same race dressed up as a security bug. This topic has 16 questions. It is the pivot of the whole primer: everything before motivates *why* this matters, and everything after (locks, atomics, memory models, lock-free) is a *tool for making shared state safe*. If you can't precisely explain a lost update, you can't evaluate any of those tools.

**Mental model**

Think of shared mutable state as a shared mutable document that many people edit with no coordination. Any single edit that isn't atomic (read the value, change it, write it back) can be *clobbered* by someone else editing between your read and your write. Three separate things can go wrong, and conflating them is the classic mistake: **atomicity** (my read-modify-write must happen as one indivisible step, or another thread interleaves and I lose an update), **visibility** (after I write, will other threads actually *see* the new value, or a stale cached one?), and **ordering** (will other threads observe my operations in the order I wrote them, or reordered by compiler/CPU?). A lock or a properly-used atomic addresses all three; a naive `volatile` addresses visibility/ordering but *not* atomicity of compound operations. The deepest reframing: the problem isn't threads, it's *shared* + *mutable*. Remove either — make it immutable, or confine it to one thread — and the race is gone by construction. Synchronization is what you're forced into when you insist on keeping state both shared and mutable.

**Key terms**

- **Shared mutable state** — memory reachable and writable by more than one thread; the root cause of races.
- **Data race** — two threads access the same location, at least one writes, with no synchronization ordering them. Undefined behavior in C/C++/Java-visibility terms.
- **Race condition** — a correctness bug whose outcome depends on timing/interleaving. Can exist *without* a data race.
- **Atomicity** — an operation completes as one indivisible step; no other thread can observe a partial state or interleave within it.
- **Visibility** — whether one thread's write becomes observable to another (defeated by caches / store buffers without a memory barrier).
- **Ordering** — the order in which one thread's memory operations appear to execute to another thread (defeated by reordering).
- **Read-modify-write (RMW)** — load, compute, store (e.g. `count++`); non-atomic by default, the source of lost updates.
- **Check-then-act** — test a condition then act on it as separate steps; the condition can change in between.
- **Lost update** — two RMWs interleave so one thread's write overwrites the other's; the update "disappears."
- **Critical section** — a region of code that accesses shared state and must run under mutual exclusion.
- **Immutability** — state that never changes after construction; inherently thread-safe (nothing to race on).
- **Confinement** — restricting state to a single thread (thread-local, stack locals) so it's never shared.
- **TOCTOU** — time-of-check-to-time-of-use; a race between validating a resource and using it (often a security hole).

**Why interviewers ask this**

This is the highest-signal area in a concurrency interview because the confusions are so common and so revealing. A junior says "a race condition is when two threads access the same variable" — which conflates data race and race condition and misses that the real issue is *timing-dependent incorrectness*. A senior distinguishes the two precisely, can construct the exact T1/T2 interleaving that loses a `count++` update, separates atomicity from visibility from ordering, and instinctively reaches for immutability or confinement *before* reaching for a lock. Interviewers use "why isn't `count++` thread-safe?" and "walk me through the interleaving" as a scalpel: it forces you to think in interleavings rather than in "it usually works." Getting the data-race-vs-race-condition distinction right is a strong senior tell because most candidates get it wrong, and it predicts whether you'll reason correctly about memory models and lock-free code later.

**Common confusions**

- "Data race and race condition are the same thing." No. A data race is unsynchronized memory access (a specific low-level hazard). A race condition is a timing-dependent correctness bug. You can have a race condition on properly-atomic operations (check-then-act on an atomic), and you can have a data race that happens not to cause a visible bug. Overlapping but distinct.
- "`count++` is atomic — it's one line." It's three operations (load, add, store). Another thread interleaves between them → lost update.
- "Making a field `volatile` makes `count++` thread-safe." No — `volatile` fixes visibility/ordering but not the *atomicity* of the read-modify-write. You need an atomic or a lock.
- "If it's a single write, I don't need synchronization." You may still have a *visibility* problem — another thread might never see the write without a barrier.
- "Synchronizing the getter fixes it." Not if the mutation is a compound check-then-act done outside a single lock; each individual access being synchronized doesn't make the *sequence* atomic.
- "Immutable objects still need locks to read." No — nothing changes, so there's nothing to race on; safe publication is the only concern.

**What follows from this topic**

This is the launch point for every mitigation. Atomicity failures (lost updates) motivate **locks/mutexes** and **atomics/CAS** (the lock-free way to make RMW atomic). Visibility and ordering failures motivate the **memory model / happens-before** topic (`volatile`, `synchronized`, barriers). Critical sections motivate mutual exclusion and, when locks compose badly, **deadlock**. Immutability and confinement are the *avoid-the-problem* strategies that thread through functional concurrency, persistent data structures, and message-passing (where ownership transfer replaces sharing). And TOCTOU bridges to security and to the check-then-act patterns in concurrent data structures. Master the interleaving reasoning here and the rest of the primer becomes "which tool removes which bad interleaving."

### Q1. Why is shared mutable state described as the root problem of concurrency?

Because a race requires the conjunction of three things — **shared** + **mutable** + **concurrent access** — and shared mutable state supplies the first two. Remove either and the hazard vanishes:

- **Shared but immutable** — many threads read the same object, but nothing changes, so there's no ordering-dependent outcome. Safe. (Immutability.)
- **Mutable but not shared** — one thread owns and mutates it; no other thread can observe intermediate states. Safe. (Confinement.)
- **Shared and mutable** — now the observable result depends on the *interleaving* of reads and writes, which the scheduler chooses nondeterministically. This is where races live.

```text
shared ───┐
mutable ──┼──▶ all three together ⇒ race hazard
concurrent┘     remove any one ⇒ safe
```

The reason it's called *the root* is that every concurrency bug family — lost updates, visibility staleness, torn reads, TOCTOU, most deadlocks (which arise from locking shared state) — traces back to threads coordinating over shared mutable memory. And every mitigation is a way to tame it: locks serialize access to it, atomics make individual updates indivisible, memory models define when writes to it become visible, and immutability/confinement remove the "shared" or "mutable" leg entirely.

The senior instinct that follows: **before synchronizing, ask whether the state needs to be shared and mutable at all.** Often the cleanest fix isn't a better lock — it's making the data immutable, confining it to one thread, or passing ownership via a channel so only one thread touches it at a time. Locks are what you're left with when you insist on shared mutability.

### Q2. What is the precise difference between a data race and a race condition?

They are related but distinct, and conflating them is the most common concurrency-interview mistake.

**Data race** — a *low-level, mechanical* condition: two threads access the **same memory location**, **at least one is a write**, and there is **no synchronization** (no happens-before edge) ordering them. It's defined in terms of the memory model. In C/C++ a data race is **undefined behavior**; in Java it means no guarantee of visibility/ordering (you may read stale or torn values).

**Race condition** — a *higher-level, semantic* condition: the program's **correctness depends on the relative timing/interleaving** of operations. It's a bug about *outcomes*, defined in terms of your program's intended behavior.

The four-quadrant truth that trips people up — you can have either without the other:

| | Race condition | No race condition |
|---|---|---|
| **Data race** | `count++` unsynchronized (both) | Benign unsynchronized flag read (data race, arguably harmless) |
| **No data race** | check-then-act on an *atomic* (race condition, no data race) | Correctly synchronized code |

The killer example of **race condition without data race**: two threads each do `if (!map.containsKey(k)) map.put(k, v)` on a `ConcurrentHashMap`. Every individual operation is atomic and synchronized — *no data race* — but the check-then-act sequence still races: both can pass the `containsKey` check before either `put`s. That's a race condition on thread-safe operations. (Fix: `putIfAbsent`.)

And **data race that's "harmless"**: an unsynchronized read of a boolean flag — mechanically a data race (UB in C++), even if in practice it "works." The point of the distinction: eliminating data races (with atomics/locks) does **not** automatically eliminate race conditions — you can build timing bugs out of perfectly atomic pieces. Saying this cleanly is a strong senior signal.

### Q3. Why isn't `count++` thread-safe? Walk through the interleaving.

Because `count++` is **not one operation** — it's a **read-modify-write** that the CPU performs as three separate steps:

```text
count++  ≡   1. LOAD   r ← count      (read current value)
             2. ADD    r ← r + 1       (compute new value)
             3. STORE  count ← r       (write it back)
```

Between any two of those steps, another thread can run. Here's the classic **lost update** with two threads incrementing from `count = 0`, expecting `2`:

```text
Time  T1                     T2                    count
 1    LOAD r1 ← 0                                    0
 2                           LOAD r2 ← 0             0      ← T2 read before T1 wrote
 3    ADD  r1 = 1                                    0
 4                           ADD  r2 = 1             0
 5    STORE count ← 1                                1
 6                           STORE count ← 1         1      ← overwrites T1's update!
```

Final `count = 1`, not `2`. One increment vanished — a **lost update**. Both threads read the same stale `0`, both computed `1`, both stored `1`. Under a *different* interleaving (T1 fully completes before T2 starts) you'd get the correct `2` — which is exactly why this bug is a **heisenbug**: it appears only under the "read-read-write-write" interleaving, which is rare under light load and common under contention.

Fixes, each addressing the non-atomicity:
- **Lock** — `synchronized`/`Lock` around the increment makes the three steps mutually exclusive.
- **Atomic** — `AtomicInteger.incrementAndGet()` or `count.fetch_add(1)` performs the RMW as a single hardware-atomic operation (CAS or fetch-and-add).

What does **not** fix it: making `count` `volatile`. `volatile` guarantees each *individual* read and write is visible/ordered, but it does nothing about the *gap* between the read and the write — two threads can still both read the same value and both write back. Visibility ≠ atomicity (see next questions).

### Q4. What are the three concerns — atomicity, visibility, and ordering — and why keep them separate?

Because a correct concurrent operation needs *all three*, and different tools provide different subsets — conflating them is how you write code that's "sort of" synchronized and still broken.

**Atomicity** — an operation happens as one indivisible step; no thread can interleave within it or observe a half-done state. `count++` fails atomicity (three steps). A "torn" read of a 64-bit value on a 32-bit platform (reading half the old and half the new value) fails atomicity.

**Visibility** — after thread T1 writes a value, does T2 actually *see* it? By default, no guarantee: T1's write may sit in its store buffer or L1 cache, and T2 keeps reading a stale cached copy. You can lose visibility even for a *single* write with no atomicity issue at all.

```text
T1: flag = true          // stuck in T1's store buffer / cache
T2: while (!flag) {}      // never sees the write → spins forever (visibility bug)
```

**Ordering** — do T2's observations of T1's operations happen in the order T1 wrote them? Compilers and CPUs **reorder** independent operations for speed. T1 writes `data` then `ready = true`; T2 may see `ready == true` but still read stale `data` because the writes were reordered or made visible out of order.

Why separate them:
- They **fail independently**: `count++` is an *atomicity* failure; a spinning `while(!flag)` is a *visibility* failure; the `data`/`ready` publication bug is an *ordering* failure.
- Tools cover **different subsets**: `volatile` (Java) / `atomic` with proper memory order gives **visibility + ordering** but **not** atomicity of compound RMW. A `synchronized` block / `Lock` gives **all three** for the code it guards. An `AtomicInteger.incrementAndGet` gives atomicity + visibility + ordering for that one operation.

Naming which of the three a given bug violates — and which a given primitive fixes — is the mark of someone who actually understands the memory model rather than sprinkling `synchronized` until the symptom disappears.

### Q5. What is a critical section, and what makes code need mutual exclusion?

A **critical section** is a region of code that accesses shared mutable state in a way that must **not overlap** with another thread's access to the same state — it has to execute as if it were indivisible. Mutual exclusion means at most one thread is inside the critical section (for that state) at a time.

Code needs mutual exclusion precisely when it performs a **compound operation on shared state that must appear atomic** — most commonly a **read-modify-write** or a **check-then-act** — where an interleaving in the middle would violate an invariant.

```java
// Critical section: the check and the two updates must be atomic together
synchronized (account) {
    if (account.balance >= amount) {   // check
        account.balance -= amount;     // act (part 1)
        recordWithdrawal(amount);      // act (part 2)
    }
}
```

Without mutual exclusion, two threads could both pass the `balance >= amount` check on the same balance and both withdraw — overdrawing the account (a check-then-act race).

What makes a section critical:
- It **touches shared mutable state** (a purely thread-local computation never needs a lock).
- The operation is **compound** (multiple steps that must not be split) *or* the invariant spans **multiple variables** that must change together (e.g. a transfer must debit and credit as one step, or an observer could see money vanish).

Design guidance that interviewers look for:
- **Keep critical sections small** — hold the lock for the minimum work. Long critical sections serialize threads (Amdahl's serial fraction) and can deadlock if they call out to other locks. Do IO and expensive computation *outside* the lock.
- **Guard the *state*, not scattered lines** — every access to a given piece of shared state must use the *same* lock; a getter synchronized on lock A and a setter on lock B provides no mutual exclusion at all.
- **The lock protects an invariant, not a variable** — think "what invariant must hold atomically," which tells you what must be inside one critical section together.

### Q6. Give an example of a check-then-act race and how to fix it.

**Check-then-act** = you test a condition, then act based on it, as *two separate steps* — and the condition can change between the check and the act. Even if each step is individually thread-safe, the *sequence* isn't atomic.

Canonical example — "put if absent" done by hand:

```java
// BROKEN: check-then-act, even on a ConcurrentHashMap
if (!cache.containsKey(key)) {   // CHECK
    cache.put(key, computeValue(key));  // ACT
}
```

The losing interleaving:

```text
T1                          T2                          result
containsKey(key) → false
                            containsKey(key) → false    both see "absent"
computeValue... put(key,A)
                            computeValue... put(key,B)   T2 overwrites A
```

Both threads pass the check, both compute, both put — you compute twice and one value clobbers the other. Note: `ConcurrentHashMap` makes each *operation* atomic, so there's **no data race** — but there's still a **race condition** because the check and act aren't a single atomic step.

Fixes — collapse check-and-act into **one atomic operation**:

```java
cache.putIfAbsent(key, value);                         // single atomic op
// or, to compute lazily exactly once:
cache.computeIfAbsent(key, k -> computeValue(k));      // atomic, computes at most once
```

Other classic check-then-act races and their atomic fixes:
- **Lazy init / singleton** — `if (instance == null) instance = new X();` → holder idiom, or double-checked locking done right, or an atomic.
- **Balance check then withdraw** — wrap both in one critical section (one lock).
- **`if (!list.contains(x)) list.add(x)`** on a shared list → hold one lock around both, or use a set with an atomic add.

The general rule: **whenever you see "test then modify shared state," the test and the modify must be inside the same atomic step** — one lock, or one atomic/CAS operation. Splitting them is a race condition even when each half is thread-safe.

### Q7. What is a lost update and under what interleaving does it occur?

A **lost update** is when two threads both read a value, both compute a new value from it, and both write back — so the second write **overwrites** the first, and one update silently disappears. It's the canonical symptom of a non-atomic **read-modify-write** on shared state.

The interleaving is "**read, read, write, write**" — both reads happen before either write, so both threads work from the same stale base:

```text
balance = 100; two threads each add 50, expecting 200:
T1                        T2                       balance
read  b1 ← 100                                       100
                          read  b2 ← 100             100   ← both read the same base
compute b1 = 150                                     100
                          compute b2 = 150           100
write balance ← 150                                  150
                          write balance ← 150        150   ← T1's +50 is LOST
```

Result `150`, not `200`. T1's deposit vanished. Contrast the *safe* interleaving where T1's write happens before T2's read ("read, write, read, write") → `200`. The bug only manifests when the reads straddle the writes, which is why it's intermittent and load-dependent.

Where it shows up in the wild: incrementing counters/metrics, updating a balance or inventory count, appending to a shared aggregate, "read row, modify, write row" in a database without a transaction or version check.

Fixes, by layer:
- **In memory** — make the RMW atomic: a lock around read+compute+write, or an atomic (`incrementAndGet`, `getAndAdd`, or a CAS loop).
- **In a database** — a transaction with appropriate isolation, `UPDATE ... SET x = x + 50` (atomic at the DB), or **optimistic concurrency** with a version column (write only if version unchanged; retry on conflict). This is the distributed analog and bridges to system design.

The unifying idea: a lost update is what happens when the "modify" isn't atomic with the "read" it was based on. Any fix works by making sure no other write can slip in between your read and your write — pessimistically (lock) or optimistically (CAS / version check + retry).

### Q8. How can `volatile` (visibility) not be enough to make an operation thread-safe?

Because `volatile` (Java) — like a plain `atomic` load/store with sufficient ordering — fixes **visibility and ordering** but does **nothing for the atomicity of a compound operation**. It guarantees every read sees the latest write and prevents reordering around it, but it does *not* make a read-modify-write indivisible.

The counterexample is exactly `count++`:

```java
volatile int count = 0;
count++;    // STILL a race: load, add, store — volatile doesn't fuse them
```

Even though each individual read and write of `count` is now visible and ordered, two threads can *both* read the same value, *both* increment, and *both* write back — the lost-update interleaving from Q3 is unaffected. `volatile` made the reads/writes visible; it didn't stop them from interleaving.

Where `volatile` *is* enough vs where it isn't:

| Scenario | `volatile` sufficient? |
|---|---|
| One thread writes, others only read a flag | Yes — pure visibility/ordering need |
| Publishing a reference after fully constructing the object | Yes — safe publication (visibility + ordering) |
| `count++` / any read-modify-write | **No** — needs atomicity → atomic or lock |
| Check-then-act across the field | **No** — sequence isn't atomic |
| Multiple fields that must change together | **No** — needs a lock |

The correct uses of `volatile`: a **status/stop flag** (`volatile boolean running`) where one thread sets it and others read it, and **safe publication** of an already-constructed immutable object (`volatile Config config` — writers build a new Config and swap the reference; readers always see a fully-formed one).

The rule to state in an interview: **`volatile` guarantees you see the *latest* value; it does not guarantee your update to that value is atomic.** For anything that reads-then-writes, you need an atomic type (`AtomicInteger`, `std::atomic` with a CAS/fetch-add) or a lock. This is the cleanest way to show you separate visibility from atomicity (Q4).

### Q9. How does immutability eliminate the need for synchronization?

Because a race needs **mutation**, and an immutable object has none. If an object's state can never change after construction, then:

- **No writes after publication** → no read-modify-write, no lost updates, no torn reads.
- **All threads always see the same state** → the only value that ever exists is the constructed one; there's nothing stale to read and nothing to coordinate.
- **No critical section** → there's no update to make atomic, so there's nothing to lock.

An immutable object is **thread-safe by construction**. Threads can share it freely, read it from any number of threads simultaneously, and never need a lock, because reading data that never changes can't race.

```java
public final class Point {          // final class
    private final int x, y;         // final fields, set once
    Point(int x, int y) { this.x = x; this.y = y; }
    int x() { return x; } int y() { return y; }
    // "mutation" returns a NEW object; the original is untouched
    Point withX(int nx) { return new Point(nx, y); }
}
```

To "change" immutable state you create a *new* object and swap the reference — which is why immutability pairs with cheap **persistent/structural-sharing** data structures (Clojure's vectors, Scala's `List`, Rust's `im`) so "copy on change" isn't wasteful.

The one remaining subtlety — **safe publication**: making the object immutable protects its *contents*, but you still must publish the *reference* safely so other threads see a fully-constructed object rather than a half-initialized one. In Java, `final` fields give this guarantee automatically (the JMM guarantees other threads see correctly-initialized `final` fields), which is why truly immutable objects (all-`final`) can be shared even via a data race without breaking. Publishing via a `volatile` field, a `synchronized` block, or a concurrent collection also works.

This is why the senior move is often "make it immutable" rather than "add a lock": you don't manage the shared-mutable problem, you *eliminate* one of its preconditions. It's the shared-but-not-mutable quadrant from Q1.

### Q10. What is thread confinement and how does it avoid races?

**Confinement** avoids races by ensuring the mutable state is **never shared** — it's reachable by only one thread, so concurrent access can't happen. It attacks the *other* leg of the shared+mutable pair (Q1): keep it mutable, but not shared.

Three forms, from strongest to most disciplined:

- **Stack confinement** — the state lives in a local variable / on the thread's own stack. Locals are inherently thread-private; as long as you never publish a reference to them elsewhere, no other thread can touch them. This is the default for most code and the reason not every variable needs a lock.

```java
void process(List<Item> input) {
    List<Result> local = new ArrayList<>();  // confined to this call/thread
    for (Item i : input) local.add(handle(i));  // no lock needed — not shared
    publish(local);  // only NOW does sharing (and safe publication) matter
}
```

- **Thread-local confinement** — explicit per-thread copies via `ThreadLocal` (Q on TLS in the threads topic): each thread gets its own instance of a non-thread-safe object (`SimpleDateFormat`, a `Random`, a per-request context). No sharing → no synchronization.

- **Ad-hoc / ownership confinement** — by convention/design, exactly one thread "owns" and mutates a piece of state at a time. This is the essence of **message-passing**: an object is confined to one goroutine/actor, and to hand it to another you *transfer ownership* by sending it over a channel (and stop touching your copy). "Share memory by communicating" is confinement enforced by discipline. Rust makes this a *compile-time* guarantee via ownership and the `Send`/`Sync` traits — the type system proves the state isn't shared unsynchronized.

Why it works: with no other thread able to observe or modify the state, there's no interleaving to reason about — the code is effectively single-threaded *with respect to that state*. Confinement is often cleaner and faster than locking because there's no contention and no lock overhead. The failure mode is **accidental publication** — leaking a reference to confined state (returning it, storing it in a shared field, capturing it in a lambda handed to another thread) silently breaks confinement and reintroduces the race. So the discipline is: keep it local, and if you must publish, do so safely and stop mutating it.

### Q11. Design a thread-safe counter. What are the options and trade-offs?

The task is to make the read-modify-write of `count++` atomic. Four idiomatic options, in rough order of increasing sophistication:

**1. Lock / `synchronized`** — mutual exclusion around the RMW.

```java
private long count = 0;
public synchronized void inc() { count++; }        // atomic via the intrinsic lock
public synchronized long get() { return count; }
```
Simple and obviously correct. Cost: lock acquire/release overhead and **contention** — under many threads they serialize on the lock, capping throughput.

**2. Atomic type (CAS-based)** — lock-free single-variable atomicity.

```java
private final AtomicLong count = new AtomicLong();
public void inc() { count.incrementAndGet(); }     // hardware fetch-and-add / CAS loop
public long get() { return count.get(); }
```
No lock; usually faster under moderate contention. Under *very* high contention, the CAS retry loop (many threads failing and retrying) becomes the bottleneck — all threads fight over one cache line.

**3. Striped / accumulator counter** — reduce contention by splitting the state.

```java
private final LongAdder count = new LongAdder();   // Java 8+
public void inc() { count.increment(); }           // updates one of many internal cells
public long get() { return count.sum(); }          // sums the cells
```
`LongAdder` keeps per-thread/per-stripe cells so threads rarely touch the same cache line, then sums on read. **Best for high write throughput** where you increment far more than you read. Trade-off: `sum()` isn't a perfectly atomic snapshot and uses more memory. This directly attacks the false-sharing / single-hot-line problem.

**4. Confinement (no sharing)** — if each thread can keep its own count and you aggregate at the end, you need *no* synchronization at all (thread-local counts summed once). Best when a running total isn't needed live.

| Option | Contention behavior | When to use |
|---|---|---|
| `synchronized`/lock | Serializes; simplest | Low contention, or you already hold a lock for other reasons |
| `AtomicLong` | Good, degrades under heavy write contention | General-purpose single counter |
| `LongAdder` | Excellent write throughput | Hot counter, write-heavy, infrequent reads |
| Thread-local + sum | No contention | Per-thread tallies aggregated at the end |

The interview point: there's no single "thread-safe counter" — the right choice depends on **read/write ratio and contention**. Naming `LongAdder` and *why* it beats `AtomicLong` under contention (splitting the hot cache line) is the senior signal; it shows you understand that the bottleneck at scale isn't correctness but the single contended memory location.

### Q12. Is a "single write, many reads" pattern automatically safe without synchronization?

**No** — a single writer with multiple readers is still not automatically safe, because you can have a **visibility** problem and/or a **torn-read / ordering** problem even with only one writer.

**Visibility:** the writer's update may sit in its cache/store buffer and never become visible to readers without a memory barrier.

```java
boolean ready = false;              // plain field, single writer
// Writer thread: ready = true;
// Reader thread: while (!ready) {} // may spin forever — never sees the write
```
One writer, no lost update, still broken — the reader reads a stale cached `false` indefinitely. Fix: make `ready` `volatile` (visibility + ordering).

**Ordering / publication:** the writer sets up data then flips a flag; readers may see the flag flipped but the data still stale, because the two writes were reordered or made visible out of order.

```java
data = compute();     // (1)
ready = true;         // (2)   — reader might see ready==true but stale data
```
Fix: `volatile ready` establishes a happens-before edge so a reader seeing `ready==true` also sees the `data` write. (This is the safe-publication pattern.)

**Torn reads:** on some platforms a wide value (a 64-bit `long`/`double` on a 32-bit JVM) can be written as two 32-bit halves; a reader can catch it mid-write and see a value that's half-old, half-new — even with a single writer. `volatile`/atomic makes the read/write indivisible.

So "single write, many reads" removes the *lost-update* (atomicity-of-RMW) worry — there's no competing writer — but it does **not** remove **visibility** or **ordering** worries. You still need to publish the value safely: mark it `volatile`, write it inside a lock the readers also use, use an `Atomic*`, or (for a set-once value) rely on `final`-field safe publication. The lesson ties back to Q4: atomicity is only one of three concerns; a single writer fixes atomicity but leaves visibility and ordering on the table.

### Q13. What is a TOCTOU bug and why is it both a concurrency and a security problem?

**TOCTOU — time-of-check-to-time-of-use** — is a race condition where you **check** a condition about a resource and then **use** the resource in a separate step, and the resource **changes in between**. It's exactly the check-then-act pattern (Q6), but the classic examples involve an external resource (a file, a permission) and an *adversary* who exploits the window, which makes it a security vulnerability.

The textbook example — a privileged program validating a file before writing it:

```c
// BROKEN: check and use are separate; the path can be swapped in between
if (access("/tmp/userfile", W_OK) == 0) {   // CHECK: caller allowed to write it?
    // <-- attacker replaces /tmp/userfile with a symlink to /etc/passwd here
    int fd = open("/tmp/userfile", O_WRONLY);  // USE: now opens /etc/passwd
    write(fd, data, len);
}
```

Between the `access` check and the `open`, an attacker swaps the file for a symlink to a protected file. The program checked one thing and used another — privilege escalation. The window is a **race**; the exploit is winning that race.

Why it's *both*:
- **Concurrency bug** — it's a race condition: correctness depends on nothing changing between check and use, which isn't guaranteed. Same shape as the lost-update / check-then-act family.
- **Security bug** — an attacker can *deliberately* trigger the bad interleaving (unlike a random scheduler, they aim for it), turning an intermittent bug into a reliable exploit. This appears in filesystem races, "check auth then perform action," "validate then deserialize," and database "check balance then debit" flows.

Fixes follow the same principle as all check-then-act: **make check-and-use one atomic operation**, or operate on a *stable handle* rather than a re-resolvable name:
- Use the resource *directly* and handle failure atomically (open with `O_CREAT|O_EXCL` and check the result, instead of "check then create"); operate on the file descriptor (`fstat`/`fchmod`) not the path, so the name can't be swapped.
- In app logic, wrap check+act in one transaction / one lock / one atomic (`putIfAbsent`, conditional `UPDATE ... WHERE version = ?`).
- Never assume a resource that was valid at check time is still the same resource at use time.

The unifying insight for the interview: **TOCTOU is a race condition (not necessarily a data race) whose defining feature is a gap between validation and action**; closing the gap — atomicity — is the fix, whether the "resource" is a memory location, a file, or a database row.

### Q14. Two threads read a value, both update it, and one update vanishes. Name the bug and three fixes.

The bug is a **lost update** caused by a non-atomic **read-modify-write** — both threads read the same base value before either writes back, so the second write clobbers the first (the read-read-write-write interleaving from Q7). The root concern is **atomicity**: the read and the write must be one indivisible step.

Three fixes, spanning pessimistic, optimistic, and structural approaches:

**1. Pessimistic locking — mutual exclusion.** Serialize the whole read-modify-write so no other thread can interleave.
```java
synchronized (lock) { value = value + delta; }   // or a Lock/RWLock, or DB SELECT ... FOR UPDATE
```
Simple, always correct. Cost: contention — threads wait; the critical section is Amdahl serial fraction.

**2. Optimistic concurrency — CAS / version check with retry.** Don't lock; assume no conflict, and detect one at write time. Read the value (and its version), compute, then write *only if it hasn't changed*; retry if it has.
```java
long cur, next;
do { cur = value.get(); next = cur + delta; }
while (!value.compareAndSet(cur, next));   // CAS: write only if still == cur
```
The DB analog is a **version column**: `UPDATE t SET val=?, version=version+1 WHERE id=? AND version=?` — zero rows updated means someone else won; reread and retry. Great under *low* contention (no lock overhead); degrades under high contention (many retries).

**3. Make the operation atomic at a lower layer — or eliminate the shared RMW.**
- Use an atomic/DB-atomic op: `AtomicLong.getAndAdd(delta)`, or `UPDATE t SET val = val + ? WHERE id = ?` (the database performs the RMW atomically).
- **Confinement / accumulation**: give each thread its own partial value and combine once at the end (`LongAdder`, thread-local sums, map-reduce) — no shared RMW at all, so nothing to lose.

The framing to give: this is the **pessimistic vs optimistic** axis. Pessimistic (locks) prevents conflict by exclusion — best when contention is high. Optimistic (CAS/version) detects conflict and retries — best when contention is low and you want to avoid lock overhead. Both work by guaranteeing your write is based on a value no one else has changed since your read. This same choice reappears in lock-free data structures and in distributed system design.

### Q15. Why can a race condition exist even when every individual operation is atomic and thread-safe?

Because thread-safety of the *pieces* doesn't compose into thread-safety of the *sequence*. Atomicity of each operation guarantees no thread sees a half-done *single* operation — but a bug can live in the **gaps between** operations, where another thread interleaves and changes the world your next operation assumes.

This is the **compound action** problem. `ConcurrentHashMap` makes `containsKey`, `get`, and `put` each individually atomic — yet:

```java
// Every call is atomic; the SEQUENCE is not → race condition, no data race
if (!map.containsKey(k)) {   // atomic — but true only "as of now"
    map.put(k, v);           // atomic — but another thread may have put k in the gap
}
```

Between the atomic `containsKey` and the atomic `put`, another thread can `put(k, ...)`. Both threads pass the check, both put — a lost/overwritten value. No operation was interrupted mid-flight (**no data race**), yet the outcome is wrong (**race condition**). The invariant you cared about ("only insert if absent") spans *two* operations, and nothing kept them atomic *together*.

The general principle: **a sequence of atomic operations is not itself atomic.** Other examples:
- `if (list.size() > 0) list.remove(0)` on a synchronized list — size can drop to 0 between the check and the remove → `IndexOutOfBounds`.
- `get` then `put` to increment a value in a concurrent map — two threads both read the same count.
- "Read balance (atomic), decide, write balance (atomic)" — the classic check-then-act.

The fix is to **make the *compound* action atomic**, either by:
- doing it in one call that's atomic as a whole (`putIfAbsent`, `computeIfAbsent`, `merge`, `getAndIncrement`), or
- wrapping the whole sequence in one lock so no other thread can interleave (client-side locking on the *same* lock the collection uses, or your own monitor).

This is *the* reason "I used a thread-safe collection" isn't enough, and why the data-race-vs-race-condition distinction (Q2) matters in practice: eliminating data races (thread-safe operations) leaves race conditions (unsynchronized compound logic) fully intact. You must reason about invariants that span multiple operations and keep those spans atomic.

### Q16. How do the escapes — locking, immutability, confinement, and atomics — compare as strategies for shared state?

They're the four principled ways to make shared state safe, and they attack the problem at different points. The senior skill is choosing the *cheapest one that fits*, not defaulting to locks.

| Strategy | How it makes state safe | Best when | Cost / limit |
|---|---|---|---|
| **Immutability** | Removes *mutation* — nothing to race on | Data set once, read many; config, value objects, messages | "Changes" allocate new objects; needs safe publication |
| **Confinement** | Removes *sharing* — one thread owns it | Per-request/per-thread state; ownership transfer via channels | Accidental publication breaks it; can't share live |
| **Atomics (CAS)** | Makes a single-variable RMW indivisible, lock-free | One hot variable (counter, flag, single reference/stack head) | Only single-location; compound/multi-var needs more; ABA; retry cost under contention |
| **Locking** | Serializes access — mutual exclusion over a region | Multi-variable invariants, compound critical sections | Contention, deadlock risk, blocks threads |

How to reason about the choice:

- **Prefer removing a precondition over managing it.** Immutability (no mutation) and confinement (no sharing) *eliminate* the race — no lock, no contention, no deadlock, and often faster. Reach for these *first*: "does this need to be shared and mutable at all?"
- **If you truly need shared mutation of one variable**, use an **atomic/CAS** — lock-free, no deadlock, good under moderate contention. This is the optimistic path.
- **If the invariant spans multiple variables or the action is a compound critical section**, you need a **lock** — atomics can't span multiple locations, so mutual exclusion is the tool. This is the pessimistic path.

They also **compose**: a system typically uses immutable *messages* passed between *confined* actors, with locks or atomics only in the few genuinely-shared hot spots. Message-passing is essentially "immutability + confinement + ownership transfer" so you rarely need locks at all. Rust encodes the whole hierarchy in the type system (`Send`/`Sync`, ownership) so the compiler forces you to pick a valid strategy — "fearless concurrency."

The one-sentence version to leave the interviewer with: **locks are the fallback, not the default — eliminate sharing (confinement) or mutation (immutability) when you can, use atomics for single-variable updates, and reserve locks for multi-variable invariants.** That ordering shows you understand shared state as a problem to *dissolve*, not merely to guard.
## Locks & Mutual Exclusion

### Summary

**What this topic covers**

The workhorse tool of shared-memory concurrency: the **lock** (mutex), and everything you need to use one correctly in application code. This is the *how do I write this* angle — the sister OS primer already explains how a futex or kernel mutex is implemented; here we care about which lock to reach for, how to hold it safely, and how to keep it from becoming your bottleneck. The 16 questions in this topic walk from "what is a critical section" up through **reentrant/recursive locks**, **read-write locks**, **spinlocks vs blocking locks**, **try-lock and timeouts**, **lock granularity** (coarse vs fine), **contention and lock convoys**, the iron rule of **always unlocking in `finally`/RAII/`defer`**, a preview of **lock striping**, and the senior-level judgement call of **when NOT to lock at all**. Deadlock gets its own topic; here we assume one lock at a time and focus on holding it correctly and cheaply.

**Mental model**

A lock does exactly one thing: it makes a **critical section** — the region between acquire and release — execute as if it were atomic with respect to every other thread that acquires the same lock. That "same lock" clause is the whole game. A lock protects *data*, not *code*; the mental discipline is to name, for every piece of mutable shared state, the one lock that guards it, and then never touch that state without holding that lock. Two threads using two different locks to guard the same variable is the same as no lock at all. Think of the lock as a talking stick: only the holder may touch the guarded data, and the moment you release it you must assume another thread changed everything. Holding a lock is *pure cost* — it serialises threads, so every instruction inside the critical section is a tax on scalability. So the second half of the mental model is economic: hold the lock for the shortest span over the smallest data that preserves the invariant, and get out.

**Key terms**

- **Critical section** — a region of code that must not run concurrently with itself; protected by a lock.
- **Mutex / mutual exclusion** — a lock with *ownership*: the thread that locks it must be the one that unlocks it.
- **Reentrant (recursive) lock** — a lock the *owning* thread can re-acquire without deadlocking, keeping a hold count; `ReentrantLock`, `synchronized`, `std::recursive_mutex`.
- **Read-write lock** — allows many concurrent readers *or* one exclusive writer; wins when reads vastly outnumber writes.
- **Spinlock** — busy-waits in a loop instead of sleeping; cheap for very short sections on multicore, disastrous if held long or oversubscribed.
- **Blocking lock** — parks the thread (kernel wait) on contention; the default general-purpose choice.
- **Try-lock** — non-blocking acquire that returns success/failure immediately (or after a timeout) instead of waiting.
- **Lock granularity** — coarse (one big lock) vs fine (many small locks); a trade-off of simplicity vs concurrency.
- **Lock contention** — multiple threads competing for the same lock; the direct enemy of scaling.
- **Lock convoy** — a pathology where threads pile up behind a contended lock and the whole system moves in lockstep, throughput collapsing.
- **Lock striping** — sharding one lock into N locks keyed by hash, so unrelated keys don't contend (preview of `ConcurrentHashMap`).

**Why interviewers ask this**

Locks are the first thing every candidate reaches for, so *how* you reach for them is a strong seniority signal. A junior answer is "wrap it in `synchronized` and move on." A senior answer names the invariant the lock protects, releases in a `finally`/RAII/`defer` so an exception can't strand it, reaches for a read-write lock only after checking that reads dominate *and* that writes are rare enough to matter, and knows that a coarse lock that's never contended beats a clever fine-grained scheme that's buggy. Interviewers probe the sharp edges — reentrancy (why does `synchronized` let a method call another `synchronized` method on `this`?), what a spinlock costs on a single core, why a read-write lock can *starve* writers — because those reveal whether you've actually debugged contention in production or only read about locks.

**Common confusions**

- "A lock protects code" — no, it protects *data*. Two threads locking different mutexes around the same variable are not synchronised at all.
- "Reentrant means thread-safe re-entry from any thread" — no; reentrancy only lets the *current owner* re-acquire. Another thread still blocks.
- "Read-write locks are always faster for read-heavy loads" — they have higher acquire overhead and can starve writers; under low contention a plain mutex often wins.
- "Spinlocks are faster than mutexes" — only for sub-microsecond sections on multicore. On a single core or when the holder is descheduled, a spinner burns a whole time slice doing nothing.
- "Finer locks are always better" — more locks means more acquire overhead, more chances to deadlock, and harder reasoning. Fine-grained locking is an optimisation you earn with a profiler.
- "If it compiles and passes tests, the locking is correct" — race bugs are timing-dependent (heisenbugs); passing tests proves nothing about a data race.

**What follows from this topic**

Locks are the foundation the next topics build on and react against. **Semaphores, Monitors & Condition Variables** extend the lock with the ability to *wait for a condition*, not just for exclusion. **Deadlock/Livelock** is what happens when you hold more than one lock at a time — the discipline of lock ordering. **Memory Models & Happens-Before** explains *why* a lock even makes writes visible to the next thread (acquire/release semantics). And the whole **lock-free / atomics** family exists precisely because of the costs catalogued here — contention, convoys, and the impossibility of holding a lock across a blocking operation. "When NOT to lock" is the bridge to all of them.

### Q1. What is a mutex, and what does it actually guarantee?

A **mutex** (mutual exclusion lock) guarantees that at most one thread executes inside its critical section — the code between `lock()` and `unlock()` — at any instant, *for threads using the same mutex object*. "Mutual exclusion" is one of two things it buys you; the other, often forgotten, is **visibility/ordering**: acquiring a lock establishes a happens-before edge with the previous release, so writes made under the lock by thread T1 are guaranteed visible to T2 when T2 next acquires it.

The critical framing: **a mutex protects data, not code.** The invariant is "nobody touches variable `x` without holding lock `L`." If one code path forgets the lock, or a second path uses a different lock, the protection evaporates silently.

```java
private final Object lock = new Object();
private int balance;                 // guarded by 'lock'

void deposit(int amt) {
    synchronized (lock) {            // acquire
        balance += amt;              // atomic w.r.t. other holders + visible to next acquirer
    }                                // release
}
```

Ownership matters: a mutex is owned by the thread that locked it, and only that thread may unlock it (unlike a semaphore). That ownership is what makes reentrancy and priority inheritance possible.

### Q2. What is a reentrant (recursive) lock and why does it exist?

A **reentrant** lock lets the thread that already holds it acquire it again without deadlocking; it keeps a **hold count** and only truly releases when the count returns to zero.

Why it exists: without reentrancy, this innocent code self-deadlocks —

```java
synchronized void outer() { inner(); }   // acquires 'this'
synchronized void inner() { /* ... */ }  // tries to acquire 'this' AGAIN
```

`outer()` holds the monitor on `this`, then calls `inner()`, which needs the *same* monitor. A non-reentrant lock would block the thread forever waiting on a lock it already owns. Java's `synchronized` and `ReentrantLock`, and C++'s `std::recursive_mutex`, are reentrant precisely so that a locked method can call another locked method on the same object.

The trade-off: reentrancy hides accidental double-locking, and a `std::mutex` (non-reentrant) is cheaper and catches self-deadlock bugs early. Rust deliberately has no reentrant `Mutex` — re-locking is a compile-friendly deadlock you're expected to avoid by design. Rule of thumb: reentrancy is a convenience for layered APIs, not a feature to design around.

### Q3. Explain read-write locks. When do they actually help?

A **read-write lock** (`ReentrantReadWriteLock`, `std::shared_mutex`, Rust's `RwLock`) separates two modes:

- **Read (shared) lock** — many threads may hold it simultaneously.
- **Write (exclusive) lock** — only one thread, and no readers, may hold it.

The idea: reads don't conflict with each other, so let them run in parallel; only writes need exclusivity.

```text
Readers:  R1 ─┐
          R2 ─┼── all run concurrently (shared)
          R3 ─┘
Writer:   ───── W blocks until all readers drain, then runs alone (exclusive)
```

It helps only when **reads massively outnumber writes AND the critical section is long enough** that the extra bookkeeping pays off. The catch is real:

- Higher acquire/release overhead than a plain mutex, so under low contention a `Mutex` is faster.
- **Writer starvation**: a steady stream of readers can keep the write lock perpetually blocked unless the implementation is write-preferring or fair.
- No upgrade: you usually can't atomically upgrade a read lock to a write lock without releasing first (deadlock risk if two readers both try).

In practice, for short critical sections, a plain mutex or a copy-on-write structure or an atomic often beats a read-write lock. Reach for it when the guarded section is expensive and read-dominated (a config cache read thousands of times per write).

### Q4. Spinlock vs blocking lock — how do you choose?

They differ in what a thread does *while it waits*:

| | Spinlock | Blocking (parking) lock |
|---|---|---|
| On contention | Busy-loops, burning CPU | Sleeps; OS reschedules another thread |
| Latency to acquire | Very low (no context switch) | Higher (park/unpark, syscall) |
| Wasted CPU while waiting | High | ~None |
| Good for | Sub-µs critical sections, multicore | Anything longer, or single core / oversubscribed |
| Danger | Holder descheduled → spinners waste a full time slice | Context-switch overhead if sections are tiny |

Choose a **spinlock** only when the critical section is measured in nanoseconds, you're on multiple cores (so the holder can actually be running on another core while you spin), and the section never blocks. Choose a **blocking lock** as the default for application code — the cost of a context switch is dwarfed by anything doing real work.

Most production mutexes are **adaptive/hybrid**: they spin a few hundred cycles hoping the holder releases quickly, then fall back to parking. That gets the best of both. The classic disaster is a spinlock held across a page fault or a preempted holder on a single core — every spinner wastes its entire quantum spinning on a lock whose owner isn't even scheduled.

### Q5. What is try-lock, and when do you use a timeout?

**Try-lock** attempts to acquire the lock and returns immediately with success or failure instead of blocking:

```java
if (lock.tryLock()) {
    try { /* got it — do work */ }
    finally { lock.unlock(); }
} else {
    // couldn't get it — do something else, don't block
}
```

Use cases:

- **Deadlock avoidance**: acquire lock A, then `tryLock` B; if B fails, release A and retry (back-off), breaking the hold-and-wait Coffman condition.
- **Responsiveness**: a UI or heartbeat thread that must never freeze can `tryLock` and skip the work rather than stall.
- **Contention probing**: fall back to a slower lock-free path if the fast lock is busy.

**Timed try-lock** (`tryLock(500, MILLISECONDS)`) blocks up to a bound, then gives up — used to bound worst-case latency and to detect a stuck holder (if you can't get a lock in 10s, something is wrong; log a thread dump). The rule: any time "wait forever" is an unacceptable answer, reach for a timeout.

### Q6. What is lock granularity, and what's the trade-off between coarse and fine?

**Granularity** is how much data one lock protects.

- **Coarse-grained**: one lock for the whole structure (e.g. one mutex around an entire map). Simple, easy to reason about, impossible to deadlock against itself — but every operation serialises, so it's a scaling ceiling.
- **Fine-grained**: many locks, each protecting a small slice (e.g. a lock per hash bucket, or per tree node). Threads touching different slices proceed in parallel — but you pay more acquire overhead, risk deadlock across locks, and make the code far harder to reason about.

```text
Coarse:  [ ------------- one lock ------------- ]   ← all ops serialise
Fine:    [L0][L1][L2][L3][L4][L5][L6][L7]           ← ops on L2 & L6 run in parallel
```

The engineering guidance: **start coarse.** A coarse lock that's never contended is free — measure first. Only when a profiler shows real contention on that lock do you split it, and even then prefer a structured pattern (striping, per-shard locks) over ad-hoc per-object locks that invite deadlock. Fine-grained locking is one of the most bug-prone optimisations in systems programming; don't pay its complexity tax speculatively.

### Q7. What is lock contention, and what is a lock convoy?

**Lock contention** is simply multiple threads trying to acquire the same lock at the same time. Some contention is fine; heavy contention means threads spend their time waiting instead of working, and adding cores stops helping — the lock is a serial bottleneck (Amdahl's law made concrete).

A **lock convoy** is a degenerate failure mode of heavy contention. Threads queue on a hot lock; each acquires, does a little work, releases, and immediately re-requests. Because the just-released thread often gets rescheduled and re-queues behind the others, the whole group marches in lockstep at the speed of the slowest critical section, with constant context-switching overhead. Throughput collapses far below what a single thread would achieve, and the lock is *always* held — CPUs are busy shuffling threads, not doing work.

```text
T1 ──lock──work──unlock──┐ (re-requests immediately)
T2      ──────wait──────lock──work──unlock──┐
T3            ─────────────wait────────────lock──…
      → everyone advances one-at-a-time, context-switching constantly
```

Fixes: reduce the critical-section size, shard the lock (striping), replace it with a lock-free structure or an atomic, batch work to amortise acquisition, or use back-off. The tell in production is high CPU with low throughput and a thread dump showing many threads blocked on one monitor.

### Q8. Why must you always release a lock in `finally` / RAII / `defer`?

Because if an exception (or early return) escapes the critical section before you unlock, the lock is **stranded forever** — every other thread that needs it blocks permanently. That's an instant, total deadlock caused by an unrelated bug.

Each language has an idiom that makes release automatic on *every* exit path:

```java
lock.lock();
try {
    doWork();                 // may throw
} finally {
    lock.unlock();            // runs no matter what
}
```
```cpp
{
    std::lock_guard<std::mutex> g(m);  // RAII: unlocks in destructor
    doWork();                          // even if this throws, ~lock_guard runs
}
```
```go
mu.Lock()
defer mu.Unlock()             // runs on any return, including panic unwind
doWork()
```

Java's `synchronized` block does this for you (the monitor releases on any exit, including exceptions) — which is one reason to prefer it over a raw `ReentrantLock` unless you need `tryLock`/timeouts/fairness. Rust goes furthest: the `MutexGuard` unlocks on drop *and* the borrow checker ties data access to holding the guard, so you literally cannot access the data without the lock, nor forget to release it.

### Q9. Preview: what is lock striping and what problem does it solve?

**Lock striping** shards a single lock into an array of N locks and routes each key to a stripe by hash: `locks[hash(key) % N]`. Operations on keys that hash to different stripes proceed fully in parallel; only operations colliding on the same stripe serialise.

```text
put("a") → stripe 3 ─┐
put("b") → stripe 7 ─┼── run concurrently
put("c") → stripe 1 ─┘
put("d") → stripe 3 ── serialises only with "a"
```

It's the standard fix for a coarse lock that's become a hot spot on a large keyspace — the concurrency win scales with N, at the cost of N times the lock memory and the loss of any operation that needs a *global* consistent view (e.g. `size()` must acquire all stripes or accept an estimate).

This is exactly how Java 7's `ConcurrentHashMap` worked (an array of segment locks, default 16), giving ~16-way write concurrency without a global lock. Java 8 went further — per-bin CAS with a lock only on collision — but striping remains the canonical mental model and the go-to answer for "how would you make this map scale under concurrent writes?" It's covered in depth under concurrent data structures.

### Q10. When should you NOT use a lock?

Locks are the default, but a senior engineer knows the cases where a lock is the *wrong* tool:

- **When there's no sharing.** Give each thread its own copy or its own shard (thread-local, per-core state) and combine at the end. No shared mutable state, no lock, no contention — the fastest concurrency is none.
- **When the data is immutable.** Immutable objects are thread-safe by construction; publish them safely once (see the memory-model topic) and read freely with zero synchronisation.
- **When a single atomic suffices.** A counter, a flag, or a single-pointer swap wants an atomic (`AtomicLong`, `std::atomic`, CAS), not a mutex — no blocking, no convoy.
- **When you'd hold it across a blocking call.** Never hold a lock across I/O, a network call, or a `wait` you don't control — you serialise everyone behind an unbounded stall. Copy what you need, release, then block.
- **When message passing fits better.** If ownership of the data can move between threads, a channel/actor ("share memory by communicating") sidesteps locking entirely.
- **When a concurrent data structure already exists.** Prefer `ConcurrentHashMap`/`BlockingQueue` over rolling your own lock around a plain map.

The meta-point: reach for the *weakest* coordination that preserves correctness — no sharing > immutability > atomic > lock > multiple locks — because each step up costs performance and adds bug surface.

### Q11. What is the difference between `synchronized` and `ReentrantLock` in Java?

Both are reentrant mutual-exclusion locks with the same memory-visibility guarantees. Differences that matter in an interview:

| | `synchronized` | `ReentrantLock` |
|---|---|---|
| Release | Automatic (block/method exit, even on exception) | Manual — you MUST `unlock()` in `finally` |
| Try-lock / timeout | No | Yes (`tryLock`, `tryLock(t, unit)`) |
| Interruptible wait | No | Yes (`lockInterruptibly`) |
| Fairness | No (JVM-chosen) | Optional (`new ReentrantLock(true)`) |
| Multiple conditions | One implicit wait set | Many (`newCondition()`) |
| JVM optimisation | Biased/lightweight locking, monitor in object header | Plain `AQS`-based |

Prefer `synchronized` for simple mutual exclusion — it's harder to misuse (no way to forget the unlock) and the JVM optimises it well. Reach for `ReentrantLock` when you specifically need a timeout, an interruptible or non-blocking acquire, fairness, or multiple condition variables on one lock. "Default to `synchronized`, upgrade to `ReentrantLock` for a concrete feature" is the answer that signals judgement.

### Q12. Is a `volatile`/atomic flag enough to protect a critical section, or do you need a lock?

A single `volatile` (Java) or `std::atomic` (C++) flag gives you **atomic, visible reads and writes of that one variable** — it is *not* a lock and cannot make a multi-step operation atomic.

It's sufficient when the shared state is a **single independent variable** and each thread only reads or writes it wholesale — a `volatile boolean running` stop-flag, a published pointer, a single counter via `getAndIncrement`. There's no invariant spanning multiple variables.

It's **not** sufficient the moment correctness depends on more than one field, or on a read-then-write staying atomic:

```java
// volatile does NOT save you here:
if (!initialized) {          // read
    init();                  // ... another thread can slip in here ...
    initialized = true;      // write  → double init (check-then-act race)
}
```

That's a **race condition** even though each individual access is atomic — a lock (or a CAS loop) is required to make the check-and-act indivisible. Rule: use an atomic/volatile for a *single* variable's visibility; use a lock (or a lock-free CAS protocol) whenever an invariant spans multiple variables or a compound "check then act / read then modify" must be indivisible.

### Q13. A method acquires a lock, then makes a slow network call while holding it. What's wrong and how do you fix it?

The bug is **holding a lock across a blocking operation.** The network call might take seconds; during all of it every other thread contending for that lock is blocked, so the whole system's throughput collapses to one-in-flight-at-a-time. You've turned a fast in-memory lock into a global serialisation point gated by network latency — a textbook contention/convoy generator, and a deadlock risk if the callee ever needs a lock you hold.

```java
// BAD
synchronized (lock) {
    var snapshot = cache.get(key);
    var result = httpClient.call(snapshot);  // seconds, holding the lock!
    cache.put(key, result);
}
```

Fix: **hold the lock only to read/write shared state, release it around the slow call.**

```java
// GOOD
Data snapshot;
synchronized (lock) { snapshot = cache.get(key); }   // brief
var result = httpClient.call(snapshot);              // no lock held
synchronized (lock) { cache.put(key, result); }      // brief
```

The subtlety: between the two critical sections another thread may have changed state, so you may need to re-validate (a compare-and-set on the cache, or drop the result if stale). That's the price of not blocking everyone — and it's almost always the right trade. General rule: **never do I/O, sleep, or call unknown code while holding a lock.**

### Q14. What is priority inversion, and how does it relate to locking?

**Priority inversion** happens when a high-priority thread is blocked waiting on a lock held by a low-priority thread, while a medium-priority thread — which doesn't need the lock — preempts the low-priority holder and runs. The result: the medium thread effectively outranks the high thread, because the high thread can't proceed until the low thread finishes the critical section, and the low thread can't run.

```text
High:  wants L ──────────────blocked on L───────────────►
Med:              runs (preempts Low, doesn't need L) ───►  ← starves Low
Low:   holds L ──preempted────────────────(can't release L)
```

The classic real-world case is the 1997 **Mars Pathfinder**, which kept resetting because a high-priority bus-management task blocked on a mutex held by a low-priority task that a medium task kept preempting.

The standard fix is **priority inheritance**: while a low-priority thread holds a lock that a high-priority thread wants, it *temporarily inherits* the high priority, so no medium thread can preempt it; it drops back after releasing. (An alternative is the priority-ceiling protocol.) This is primarily an RTOS concern; general-purpose schedulers mitigate it with aging. For an interview, the point is that locks can create *scheduling* pathologies, not just contention, and that ownership (which a mutex has and a semaphore lacks) is what makes priority inheritance possible.

### Q15. Two counters are each guarded by their own mutex. A thread reads both and asserts they're equal — but sometimes the assertion fails even though every writer keeps them equal. Why?

Because **each lock only makes its own variable's access atomic — there is no lock that makes reading *both* atomic together.** Between releasing lock A and acquiring lock B, a writer can slip in and update both counters, so the reader sees `a` from before the write and `b` from after it: a torn, inconsistent snapshot.

```text
Writer keeps a == b, updating both under their locks.
Reader:  lock A → read a=5 → unlock A
Writer:                       lock A→a=6→unlock; lock B→b=6→unlock
Reader:                                              lock B → read b=6 → unlock B
Reader sees a=5, b=6  → assertion fails, though a==b always held atomically
```

This is a **race condition without any data race** — every individual access was properly synchronised; the bug is that the *composite* read wasn't. Fixes:

- Guard *both* counters with the **same** lock, so the reader holds it across both reads (the invariant spans two variables → one lock).
- Or acquire both locks (in a fixed global order to avoid deadlock) for the duration of the read.
- Or make the pair a single immutable object published atomically, so a reader always sees a consistent `(a, b)`.

The lesson: a lock per variable protects each variable but not an invariant *between* variables. Invariants define lock scope, not fields.

### Q16. How do you decide between a coarse lock, lock striping, and a lock-free structure for a hot shared map?

A decision ladder, cheapest-to-reason-about first — and you only climb it with a profiler:

1. **Coarse lock (one mutex).** Start here. If it's not contended, it's effectively free and trivially correct. Ship it, then measure. Most "hot" maps aren't actually hot.
2. **Read-write lock.** If profiling shows reads dominate writes and sections are non-trivial, this lets readers run in parallel. Watch for writer starvation.
3. **Lock striping (N locks by hash).** If writes are frequent and spread across many keys, shard the lock so unrelated keys don't contend. Concurrency scales ~N-way; you lose cheap global operations like exact `size()`.
4. **Lock-free / purpose-built concurrent structure.** Use the platform's `ConcurrentHashMap` (per-bin CAS) before writing your own. Reach for hand-rolled lock-free only when even striping contends and you have the expertise to get memory ordering and reclamation right.

The senior signal is the *order* and the *evidence*: never jump to lock-free because it sounds fast — it's the hardest to get correct (memory ordering, ABA, reclamation) and only wins under genuine, measured high contention. Match the mechanism to the measured contention profile (read/write ratio, key spread, need for global views), not to intuition.

## Semaphores, Monitors & Condition Variables

### Summary

**What this topic covers**

Coordination beyond mutual exclusion: the primitives that let threads **wait for a condition** and **signal** each other, not merely take turns. A lock answers "may I touch this data?"; the tools here answer "may I proceed *yet*?" — a bounded buffer's consumer must wait until an item exists; a connection pool's borrower must wait until a connection frees up. The 16 questions cover the **counting vs binary semaphore**, the **monitor pattern** (a lock bundled with one or more condition variables), **condition variables** with `wait`/`notify`/`notifyAll` (`await`/`signal`), the single most-tested subtlety in this whole primer — **spurious wakeups and the rule to always wait in a `while` loop on the predicate** — **guarded blocks**, **signal vs broadcast**, building a **bounded buffer** (producer-consumer) with a monitor, and using a **semaphore for resource pools and rate limiting**. This is where you demonstrate you can build a correct blocking data structure by hand.

**Mental model**

Think of a **condition variable as a waiting room attached to a lock.** A thread holding the lock checks a predicate ("is the buffer non-empty?"); if it's false, the thread *atomically releases the lock and goes to sleep* in the waiting room (`wait`). Later, another thread that made the predicate true (added an item) wakes a sleeper (`notify`); the woken thread *re-acquires the lock* and re-checks the predicate before proceeding. The two invariants that make this correct: (1) you only ever call `wait`/`signal` while holding the lock, and (2) you **re-check the predicate in a loop**, never assume the thing you waited for is still true when you wake. A **monitor** is just this pattern packaged: one lock + condition variable(s) guarding an object so that its methods are mutually exclusive and can block on conditions. A **semaphore** is a lower-level cousin — a counter of permits with no ownership; `acquire` waits while the count is zero, `release` bumps it. Locks exclude, condition variables wait, semaphores count.

**Key terms**

- **Semaphore** — a counter of *permits*; `acquire` blocks while zero, `release` increments (and wakes a waiter). No ownership — any thread may release.
- **Counting semaphore** — permits > 1; models N interchangeable resources (a pool of connections).
- **Binary semaphore** — one permit; looks like a lock but has no ownership (any thread can release), so it's a *signal*, not a mutex.
- **Monitor** — an object whose methods run under one lock, plus condition variable(s) for waiting; Java's every-object `synchronized`+`wait`/`notify` is a built-in monitor.
- **Condition variable** — a wait set tied to a lock; supports `wait`/`await` and `notify`/`signal`.
- **Predicate** — the boolean the waiter is blocked on ("buffer not full"); always re-checked in a `while` loop.
- **Spurious wakeup** — `wait` returning without any `notify`; permitted by the spec, so you must loop.
- **`notify` / `signal`** — wake *one* waiter. **`notifyAll` / `broadcast`** — wake *all* waiters.
- **Guarded block** — the `while(!predicate) cond.wait();` idiom that safely blocks until a condition holds.
- **Bounded buffer** — a fixed-capacity producer-consumer queue; the canonical monitor exercise (two conditions: not-full, not-empty).
- **Lost wakeup** — a `notify` fired before the waiter called `wait`, so the signal is missed forever; avoided by checking the predicate under the lock before waiting.

**Why interviewers ask this**

This topic is the classic whiteboard filter: "implement a bounded blocking queue" or "implement a semaphore." It separates people who've *used* `BlockingQueue` from people who understand *why it's correct*. The tell is almost always the wait loop: a candidate who writes `if (empty) wait();` has a latent bug (spurious wakeup + lost-wakeup + the stale-predicate problem after `notifyAll`); a candidate who writes `while (empty) wait();` and can explain all three reasons why has done real concurrent programming. Interviewers also probe `notify` vs `notifyAll` (when is waking one safe?), why `wait` must be called holding the lock, and the semaphore-vs-mutex distinction (ownership). Getting the bounded buffer right — two conditions, loop on each, signal the *other* side — is a strong senior signal.

**Common confusions**

- "`if` is fine for the wait check" — no. Spurious wakeups, and `notifyAll` waking multiple threads for one item, both mean you must re-check in a `while` loop.
- "A binary semaphore is just a mutex" — no: a mutex has ownership (only the locker unlocks); a binary semaphore can be released by any thread, which is exactly what makes it a *signalling* tool.
- "`notify` wakes the thread I want" — it wakes *an arbitrary* waiter; if waiters are waiting on different conditions, waking the wrong one can stall you. Use `notifyAll` or separate condition variables.
- "You can call `wait`/`notify` without the lock" — no; it throws `IllegalMonitorStateException` in Java, and is UB/logic-error elsewhere. `wait` must atomically release a held lock.
- "`notifyAll` is wasteful, always use `notify`" — `notify` is an optimisation that's only safe when all waiters are interchangeable and each signal enables exactly one; when unsure, `notifyAll` is correct.
- "The signal is queued if no one's waiting" — condition-variable signals are *not* sticky; a `notify` with no waiter is lost. Semaphore releases, by contrast, *are* counted.

**What follows from this topic**

These primitives are the building blocks of nearly everything above them. The **bounded buffer** here *is* the producer-consumer core of thread pools (a work queue) and channels. Semaphores as resource pools preview connection pooling and rate limiting in system design. The wait-loop discipline reappears anywhere threads coordinate — futures, latches, barriers. And the whole "wait for a condition" model contrasts with **lock-free** approaches (CAS retry loops instead of blocking) and with **message passing** (a channel is a bounded buffer with a nicer API — "share memory by communicating"). The correctness argument you build here — predicate under lock, loop on wake, signal the counterpart — is the reusable template for every blocking coordination problem.

### Q1. What is a semaphore, and how does it differ from a mutex?

A **semaphore** is a counter of **permits**. Two operations: `acquire` (a.k.a. `P`/`wait`/`down`) blocks while the count is zero, otherwise decrements it; `release` (`V`/`signal`/`up`) increments it and wakes a waiter. It models "there are N interchangeable resources; wait until one is available."

The key difference from a mutex is **ownership**:

| | Mutex | Semaphore |
|---|---|---|
| Concept | Mutual exclusion (0/1, owned) | Counter of N permits (unowned) |
| Who releases | Only the thread that locked it | *Any* thread may release |
| Reentrant | Often (recursive locks) | No concept of it |
| Typical use | Protect a critical section | Limit concurrency; signal between threads |

Because a mutex has an owner, it supports reentrancy and priority inheritance; a semaphore has neither. A **binary semaphore** (one permit) looks like a mutex but *isn't* one — since any thread can `release`, it's used as a **signal** (thread A blocks on `acquire`, thread B does `release` to wake it), which a mutex can't express. Use a mutex to protect data; use a semaphore to *count* resources or to *signal* across threads.

### Q2. Counting vs binary semaphore — give a real use for each.

**Counting semaphore** (permits = N): limit how many threads may do something at once.

```java
Semaphore pool = new Semaphore(10);   // 10 DB connections
void query() throws InterruptedException {
    pool.acquire();                   // blocks if all 10 in use
    try { useConnection(); }
    finally { pool.release(); }       // return the permit
}
```

Here N interchangeable resources (connections, licences, download slots) are handed out; the 11th caller waits until someone releases.

**Binary semaphore** (permits = 1): a signal/handshake between two specific threads. Thread A waits for an event that thread B produces.

```java
Semaphore ready = new Semaphore(0);   // start EMPTY
// Thread A: wait until B says go
ready.acquire();
// Thread B: signal A
ready.release();
```

Because the semaphore starts at 0, A blocks until B releases — a one-shot handoff. Note this is *not* a mutex: A never "held" anything, and B (a different thread) does the release. That cross-thread signalling is precisely what a binary semaphore is for and what a mutex forbids.

### Q3. What is a monitor, and how does it relate to locks and condition variables?

A **monitor** is a synchronisation construct that bundles **a lock + one or more condition variables** around an object, so that (1) the object's methods run in mutual exclusion, and (2) a thread inside can *wait* for a condition and be *signalled* when it changes.

In Java the monitor is built into every object: `synchronized` provides the lock, and `wait()`/`notify()`/`notifyAll()` provide a single condition variable.

```java
class BoundedBox<T> {                 // a monitor
    private T value; private boolean full;
    synchronized void put(T v) throws InterruptedException {
        while (full) wait();          // wait on the condition
        value = v; full = true;
        notifyAll();                  // signal takers
    }
    synchronized T take() throws InterruptedException {
        while (!full) wait();
        full = false; notifyAll();
        return value;
    }
}
```

The `java.util.concurrent.locks` version separates the pieces explicitly: a `Lock` + one or more `Condition` objects from `lock.newCondition()`, which lets you have *distinct* wait sets (e.g. `notFull` and `notEmpty`) instead of one shared one. C++ uses `std::mutex` + `std::condition_variable`. The monitor is the *pattern*; lock + condition variables are the *ingredients*. The whole point over a bare lock is the ability to block on a *predicate*, not just on exclusion.

### Q4. Explain `wait`/`notify`/`notifyAll`. Why must they be called while holding the lock?

- **`wait()`** — atomically releases the lock and puts the thread to sleep in the monitor's wait set. When woken (by `notify`, `notifyAll`, spuriously, or interrupt) it re-acquires the lock before returning.
- **`notify()`** — wakes *one* arbitrary waiting thread.
- **`notifyAll()`** — wakes *all* waiting threads (they then contend to re-acquire the lock, one at a time).

They must be called while holding the lock for a critical reason: **to avoid the lost-wakeup race.** Consider `wait` releasing the lock and sleeping as two separate steps. If a producer could `notify` in the gap between the consumer checking the predicate and actually sleeping, the signal would fire with no one listening and be lost — the consumer sleeps forever. Requiring the lock makes "check predicate → decide to wait → release lock and sleep" atomic, and requires the notifier to hold the lock (so it can't run during that gap). Java enforces this: calling `wait`/`notify` without owning the monitor throws `IllegalMonitorStateException`. C++'s `condition_variable::wait` takes a `unique_lock` for the same reason.

```text
Consumer:  hold lock → check(empty) → wait{release lock + sleep}  ← atomic
Producer:  hold lock → add item → notify → release lock
The lock serialises these, so notify can't slip into the check→sleep gap.
```

### Q5. What is a spurious wakeup, and why must you wait in a `while` loop?

A **spurious wakeup** is `wait()` returning *without any thread having called `notify`* — permitted by the JVM/POSIX specs because implementing condition variables without allowing them would be slower on real hardware. So a returned `wait` does **not** prove the condition you wanted is now true.

There are actually *three* independent reasons the predicate might be false when you wake, all fixed by the same loop:

1. **Spurious wakeup** — you woke for no reason at all.
2. **`notifyAll` woke many** — one item, five woken consumers; four will find it already taken.
3. **Stale predicate** — between the `notify` and you re-acquiring the lock, another thread changed the state back.

Therefore the ironclad idiom is **check the predicate in a `while` loop, never an `if`:**

```java
synchronized (lock) {
    while (!conditionHolds()) {   // NOT if — re-check after every wake
        lock.wait();
    }
    // predicate is guaranteed true HERE, lock is held
    proceed();
}
```

This is the single most-tested detail in concurrency interviews. `if (!cond) wait();` is a bug even if it passes every test you run — it's a timing-dependent heisenbug. The `while` loop makes the code correct regardless of *why* you woke: it simply re-verifies the invariant before proceeding. C++'s `cv.wait(lock, pred)` overload *is* this loop, which is why it's preferred over the bare `cv.wait(lock)`.

### Q6. `notify` vs `notifyAll` — when is `notify` safe, and what breaks if you get it wrong?

`notify` wakes one arbitrary waiter; `notifyAll` wakes all. `notify` is cheaper (no thundering herd re-contending for the lock), but it's only **safe** when both conditions hold:

1. **All waiters are waiting on the same condition** and are interchangeable (any one can make progress), and
2. **Each `notify` enables exactly one** waiter to proceed.

If waiters are blocked on *different* predicates on the same monitor, `notify` can wake the *wrong* one — a thread that immediately re-checks, finds its predicate still false, and goes back to sleep, while the thread that *could* have proceeded is never woken. That's a **lost wakeup / stall**.

Classic trap — a bounded buffer using one condition and `notify`:

```text
Buffer full. Two producers waiting (on not-full), zero consumers waiting.
A consumer takes an item, calls notify() → wakes... another PRODUCER? No,
only producers are waiting, fine. But mix producers+consumers on ONE monitor
and notify() can wake a producer when only a consumer could proceed → deadlock.
```

Guidance: **use `notifyAll` unless you can prove `notify` is safe** (single condition, interchangeable waiters). Better still, use separate `Condition` objects (`notFull`, `notEmpty`) via `Lock.newCondition()` so each `signal` targets exactly the right wait set — then `signal` (one) is both safe and efficient. "Default to `notifyAll`, optimise to `notify`/`signal` with distinct conditions once proven" is the senior answer.

### Q7. What is a guarded block, and what's the lost-wakeup bug it must avoid?

A **guarded block** is the canonical pattern for "block until a condition becomes true":

```java
synchronized (lock) {
    while (!ready) {        // the guard
        lock.wait();
    }
    useResource();
}
```

The **lost-wakeup** bug it avoids: if you checked the predicate *outside* the lock, or signalled without the lock, a `notify` could fire in the window between the waiter deciding to wait and actually sleeping — the signal lands with no listener and vanishes, leaving the waiter asleep forever.

```text
BROKEN (check outside lock):
  Consumer: reads ready==false
  Producer: sets ready=true; notify()   ← no one is in wait() yet, lost!
  Consumer: enters wait() → sleeps forever
```

The guarded block prevents this because the predicate check and the `wait` happen *atomically under the same lock the notifier must also hold*: the notifier can't set `ready=true` and `notify` in that gap, because it needs the lock the consumer still holds until `wait` atomically releases it. Combined with the `while` (for spurious wakeups and stale predicates), the guarded block is the complete, correct template for condition waiting.

### Q8. Signal vs broadcast — how does this map across languages?

"Signal" wakes one waiter; "broadcast" wakes all. Same concept, different names:

| Language | Wake one | Wake all |
|---|---|---|
| Java (`Object` monitor) | `notify()` | `notifyAll()` |
| Java (`Condition`) | `signal()` | `signalAll()` |
| C++ (`condition_variable`) | `notify_one()` | `notify_all()` |
| POSIX (pthreads) | `pthread_cond_signal` | `pthread_cond_broadcast` |
| Python (`threading.Condition`) | `notify()` | `notify_all()` |

The decision is identical everywhere: **broadcast when waiters may be on different conditions or more than one can proceed; signal when waiters are interchangeable and each wake enables exactly one.** The cleaner design that lets you safely use *signal* is **multiple condition variables on one lock** — Java's `Condition`, C++ using two `condition_variable`s — so each `signal` targets precisely the waiters who can act. That avoids both the thundering-herd cost of broadcast and the wrong-waiter stall of a naive signal.

### Q9. Implement a bounded buffer (producer-consumer) with a monitor.

Two conditions — "not full" for producers, "not empty" for consumers — one lock. Using explicit `Condition`s so each `signal` targets the right side:

```java
class BoundedBuffer<T> {
    private final Queue<T> q = new ArrayDeque<>();
    private final int capacity;
    private final ReentrantLock lock = new ReentrantLock();
    private final Condition notFull  = lock.newCondition();
    private final Condition notEmpty = lock.newCondition();

    BoundedBuffer(int cap) { this.capacity = cap; }

    void put(T item) throws InterruptedException {
        lock.lock();
        try {
            while (q.size() == capacity) notFull.await();  // while-loop!
            q.add(item);
            notEmpty.signal();          // wake ONE consumer
        } finally { lock.unlock(); }     // release in finally
    }

    T take() throws InterruptedException {
        lock.lock();
        try {
            while (q.isEmpty()) notEmpty.await();
            T item = q.remove();
            notFull.signal();           // wake ONE producer
            return item;
        } finally { lock.unlock(); }
    }
}
```

The four things an interviewer checks: (1) **`while`, not `if`**, around every `await` — spurious wakeups and stale predicates; (2) **separate conditions** so a producer signals consumers and vice versa (with a single condition you'd need `signalAll`); (3) **unlock in `finally`**; (4) each side **signals the opposite side** after changing state. This monitor *is* the core of a `BlockingQueue`, a thread-pool work queue, and a channel — the same nine lines recur everywhere threads hand off work.

### Q10. Why is `if (buffer.isEmpty()) wait();` a bug even when your tests pass?

Because it uses `if` where it must use `while`. An `if` checks the predicate once, then — after `wait()` returns — proceeds *assuming the predicate is still true*. Three independent things can make that assumption false:

1. **Spurious wakeup** — `wait` can return with no `notify`; the buffer is still empty, but `if` doesn't re-check, so you dequeue from an empty buffer (NPE / corrupt state).
2. **`notifyAll` woke several consumers** for a single produced item — the first grabs it, the rest fall through the `if` and also try to take, but it's gone.
3. **Stale predicate** — between the producer's `notify` and this thread re-acquiring the lock, another consumer already took the item.

```text
Empty buffer. C1 and C2 both in wait().
Producer: add 1 item → notifyAll()
C1 wakes, re-locks, takes the item (buffer empty again)
C2 wakes, re-locks — with `if`, skips the check, take() on empty → BUG
```

Tests pass because these are **timing-dependent races** (heisenbugs) — they need a specific interleaving that a low-load unit test rarely hits, but production concurrency hits constantly. The fix is one word: `while (buffer.isEmpty()) wait();` re-verifies the invariant on every wake, so the code is correct regardless of why or how many woke.

### Q11. How would you use a semaphore for a resource pool and for rate limiting?

**Resource pool** — a counting semaphore initialised to the pool size gates access to N interchangeable resources:

```java
class ConnectionPool {
    private final Semaphore permits;
    private final BlockingQueue<Conn> idle;
    ConnectionPool(int size) {
        permits = new Semaphore(size);
        idle = new ArrayBlockingQueue<>(size);
        // ... prefill idle with `size` connections ...
    }
    Conn borrow() throws InterruptedException {
        permits.acquire();          // blocks if all in use
        return idle.take();
    }
    void giveBack(Conn c) {
        idle.add(c);
        permits.release();          // frees a permit → wakes a waiter
    }
}
```

**Rate limiting** — a semaphore caps *concurrent* in-flight work (a concurrency limiter). For a *per-second* rate limit, combine permits with a scheduler that releases N permits each second (a crude token bucket):

```java
Semaphore tokens = new Semaphore(100);          // 100 requests/sec cap
scheduler.scheduleAtFixedRate(() ->
    tokens.release(100 - tokens.availablePermits()), // refill to 100
    1, 1, TimeUnit.SECONDS);
// per request:
tokens.acquire();   // blocks when the second's budget is spent
```

The distinction worth stating: a semaphore natively limits **concurrency** (how many at once); turning it into a **rate** (how many per unit time) requires a refill mechanism. For real rate limiting, a proper token-bucket/leaky-bucket (e.g. Guava `RateLimiter`) is better, but the semaphore is the primitive underneath the concurrency-limiting case.

### Q12. Can you build a mutex from a semaphore, and a semaphore from a mutex + condition variable?

**Mutex from a binary semaphore** — yes, mechanically: a semaphore initialised to 1, `acquire` = lock, `release` = unlock.

```text
Semaphore m = new Semaphore(1);
m.acquire();  // "lock"
// critical section
m.release();  // "unlock"
```

But it's a *worse* mutex: a real mutex has **ownership** (only the locker may unlock, enabling reentrancy and priority inheritance and error-checking). A binary semaphore has no owner — any thread can `release`, and a double-`release` silently pushes the count to 2, breaking exclusion. So it works but loses safety.

**Semaphore from a mutex + condition variable** — also yes, and this is how they're often implemented:

```java
class MySemaphore {
    private int permits;
    private final Object lock = new Object();
    MySemaphore(int n) { permits = n; }
    void acquire() throws InterruptedException {
        synchronized (lock) {
            while (permits == 0) lock.wait();   // guarded block
            permits--;
        }
    }
    void release() {
        synchronized (lock) {
            permits++;
            lock.notify();                      // wake one waiter
        }
    }
}
```

The point of the exercise: these primitives are **inter-expressible** — mutex, semaphore, and condition variable are equivalent in power — but each expresses a *different intent* clearly. Pick the one whose semantics match the problem (exclusion → mutex, counting/signalling → semaphore, wait-for-predicate → condition variable) rather than emulating one with another.

### Q13. What is a lost wakeup, and how is it different from a spurious wakeup?

They're opposite failures:

- **Lost wakeup** — a `notify`/`signal` fires when *no thread is waiting yet* (or before the waiter reaches `wait`), so the signal is discarded and the waiter, arriving just after, sleeps forever. It's a **liveness bug** — the thread hangs. Cause: checking the predicate or signalling *without* the shared lock, so the notify slips into the gap between check and sleep.
- **Spurious wakeup** — a `wait` returns *without* any `notify` at all. It's a harmless *possibility* the spec allows; it only becomes a bug if you don't re-check the predicate.

```text
Lost wakeup (BAD design):        Spurious wakeup (normal):
  Producer: notify() [no waiter]   Consumer: wait()
  Consumer: wait() → hangs         (returns with no notify) → loop re-checks → waits again
```

Condition-variable signals are **not sticky** — a `notify` to an empty wait set is gone, unlike a semaphore `release` which *increments a counter* and is therefore remembered. That's exactly why the correct pattern pairs a **guarded block** (predicate checked under the lock → no lost wakeup) with a **`while` loop** (re-check on wake → tolerates spurious wakeups). One idiom defends against both. If you specifically need the signal to be remembered even when no one's waiting, use a semaphore (counted) or a latch, not a bare condition variable.

### Q14. Why does a condition variable need an associated lock, but a semaphore doesn't?

A **condition variable has no memory** — it's just a wait/wake mechanism over some predicate whose state lives in *other* variables. To use it correctly you must, atomically: (1) evaluate the predicate, (2) if false, sleep. Without a lock, another thread could change the predicate and signal in the gap between (1) and (2) → lost wakeup. The associated lock is what makes "check-then-sleep" and "change-then-signal" mutually exclusive, closing that gap. So the lock isn't optional decoration; it's load-bearing for correctness.

A **semaphore is self-contained** — its permit count *is* the state, and `acquire`/`release` are atomic on that internal counter. There's no separate predicate to check, so there's no check-then-act gap to protect, and no external lock is needed. A `release` with no waiter simply increments the count and is *remembered*, so there's no lost-wakeup problem to guard against either.

```text
Condition var: predicate lives OUTSIDE → need a lock to make check+wait atomic
Semaphore:     count lives INSIDE, ops atomic → self-synchronising, no lock needed
```

This is the deep reason semaphores are easier to use for simple counting/signalling but condition variables are more general — a CV can wait on *any* predicate you can express, at the cost of always pairing it with the lock that guards that predicate.

### Q15. Design a thread-safe blocking bounded queue. Which primitive would you actually use in production?

By hand you'd write the monitor from Q9: a lock + `notFull`/`notEmpty` conditions, `while`-loop predicates, signal the opposite side, unlock in `finally`. That's the interview answer that proves you understand the mechanism.

**In production you would not hand-roll it** — you'd use the platform's tested implementation:

| Need | Use |
|---|---|
| Java, bounded blocking FIFO | `ArrayBlockingQueue(capacity)` |
| Java, unbounded / linked | `LinkedBlockingQueue` |
| Java, hand-off (no buffer) | `SynchronousQueue` |
| Go | a buffered channel `make(chan T, n)` |
| Rust | `crossbeam::channel::bounded(n)` or `std::sync::mpsc` |
| Python | `queue.Queue(maxsize=n)` |

Stating this is itself a senior signal: you *can* build it, but you know that concurrent data structures are exactly where subtle bugs live (memory ordering, wakeup logic, fairness), so you reach for the vetted library and only hand-roll when you have a requirement it doesn't meet. Bonus: know that a Go **channel is literally a bounded buffer with a nicer API** — `ch <- x` blocks when full, `<-ch` blocks when empty — which is the "share memory by communicating" alternative to the whole lock+condition dance.

### Q16. A worker calls `notify()` after adding one item, but occasionally a consumer hangs even though items are available. What's the likely cause?

The most likely cause is **`notify()` waking the wrong waiter on a shared monitor.** If both producers and consumers `wait` on the *same* condition/monitor, a single `notify()` wakes *one arbitrary* waiter — which might be another **producer** (blocked on "not full"), not a consumer. The producer re-checks its predicate, finds the buffer still full-ish or irrelevant, and goes back to sleep; meanwhile the consumer that could have taken the item was never woken. The item sits there and the consumer hangs — a lost-wakeup-style stall.

```text
One monitor, one condition. Waiting: P1 (not-full), C1 (not-empty).
Consumer C0 adds nothing; a producer adds 1 item, notify() → wakes P1.
P1: buffer not full? maybe, re-waits.  C1: never woken → hangs with item present.
```

Two fixes:

1. **Use `notifyAll()`** instead of `notify()` — wakes everyone, so the right waiter definitely re-checks and proceeds. Correct, slightly less efficient.
2. **Use separate condition variables** (`notFull`, `notEmpty`) on one `Lock`, and `signal` the *specific* side — a producer signals `notEmpty`, a consumer signals `notFull`. Then a single `signal` always targets a thread that can actually make progress.

The general lesson: `notify()` is only safe when all waiters are interchangeable. Mixed waiters on one condition is the classic reason for "items available but a consumer is stuck" — reach for `notifyAll` or, better, distinct conditions.

## Memory Models & Happens-Before

### Summary

**What this topic covers**

The rules that decide **when a write by one thread becomes visible to a read by another**, and in **what order** operations appear to happen. This is the deepest, least-intuitive layer of shared-memory concurrency, and the one that separates senior engineers: correctness here depends not on locks-as-exclusion but on locks-as-*ordering*. The 16 questions cover **compiler and CPU reordering**, **sequential consistency vs relaxed** memory, **memory barriers/fences**, the **Java Memory Model** (happens-before, `volatile` = visibility + ordering but *not* atomicity, `synchronized`, `final`-field safe publication), the **C++ `std::memory_order`** family (relaxed / acquire / release / seq_cst), **safe publication**, **double-checked locking done right**, and the sharp classic — **why `volatile` alone doesn't make `count++` safe.** The OS primer covers cache-coherence hardware (MESI); here we stay at the *language-guarantee* level: what the JMM and C++ standard promise you, and how to write code that's correct regardless of what the hardware and JIT do underneath.

**Mental model**

Abandon the intuition that threads execute your source lines in order and immediately see each other's writes. **They don't.** The compiler/JIT reorders instructions, the CPU reorders loads and stores, and each core has store buffers and caches, so without synchronisation there is *no guarantee* another thread ever sees your write, or sees your writes in the order you made them. A memory model is the *contract* that restores order at specific points. The unifying concept is **happens-before**: a partial order over memory operations such that if action A *happens-before* B, then A's effects are visible to B. Program order within one thread is happens-before; the magic is the *inter-thread* edges — a lock release happens-before the next acquire of that lock; a `volatile` write happens-before every later read of it; a thread's `start()` happens-before the thread runs; the thread's actions happen-before a `join()` returns. Your job in concurrent code is to make sure that for every "T1 writes, T2 reads" pair you care about, there's a happens-before edge connecting them. No edge = **data race** = no guarantee about what T2 sees (in C++, undefined behaviour; in Java, a "benign"-looking but unspecified value).

**Key terms**

- **Reordering** — the compiler and CPU may execute memory operations in a different order than source, as long as *single-threaded* behaviour is preserved.
- **Happens-before** — a partial order; if A happens-before B, A's writes are visible to B. The core JMM/C++ abstraction.
- **Data race** — two threads access the same location, ≥1 writes, with no happens-before edge between them. UB in C++; unspecified visibility in Java.
- **Sequential consistency** — the ideal model: as if all threads' operations were interleaved in one global order consistent with each thread's program order. Intuitive but expensive.
- **Relaxed / weak model** — real hardware and language defaults allow more reordering than SC for performance.
- **Memory barrier / fence** — an instruction that forbids certain reorderings across it (LoadLoad, StoreStore, LoadStore, StoreLoad).
- **`volatile` (Java)** — guarantees visibility + ordering (happens-before on each access) for that field; does *not* make compound operations atomic.
- **`synchronized` / lock** — mutual exclusion *and* a happens-before edge from release to next acquire.
- **Safe publication** — making a fully-constructed object visible to other threads without them seeing a partially-built state.
- **`std::memory_order`** — C++ per-atomic ordering: `relaxed`, `acquire`, `release`, `acq_rel`, `seq_cst`.
- **Acquire/release** — an acquire-load pairs with a release-store to form a happens-before edge (one-directional fences).
- **Double-checked locking** — a lazy-init optimisation that's only correct with `volatile`/atomics.

**Why interviewers ask this**

This is the deep end — asked to distinguish senior from mid-level. Anyone can use a lock for exclusion; understanding that a lock is *also* a memory barrier, that `volatile` is about *ordering* not *atomicity*, and that a data race is UB and not merely "a stale read" is what marks someone who has debugged production concurrency or written a lock-free structure. The signature question — "why isn't `volatile int count; count++;` thread-safe?" — instantly reveals whether a candidate conflates visibility with atomicity. Follow-ups probe the JMM happens-before rules, whether they can implement double-checked locking correctly (and why the naive version is broken), and whether they know the C++ `memory_order` levels and when relaxed is safe. Getting this right signals you can reason about correctness at the level where the hardware and compiler stop cooperating with your intuition.

**Common confusions**

- "`volatile` makes operations atomic" — no. It makes single reads/writes visible and ordered; `count++` is still three non-atomic steps. Use an atomic or a lock for that.
- "Without a lock, reads are just stale/slightly old" — no. A data race is *undefined* — in C++ literally UB; in Java the value is unspecified and reorderings can make impossible-looking states appear.
- "The compiler won't reorder my code" — it will, and so will the CPU, as long as single-threaded semantics are preserved. Multithreaded correctness needs explicit ordering.
- "Java `volatile` == C++ `volatile`" — false. C++ `volatile` is for memory-mapped I/O and gives *no* thread-safety; use `std::atomic`. Java `volatile` ≈ C++ `atomic<T>` with `seq_cst`.
- "Sequential consistency is what my hardware does" — no; x86 is close-ish (TSO) but ARM/POWER are far weaker. Never rely on hardware ordering; rely on the language memory model.
- "Double-checked locking is a known-broken anti-pattern" — it was broken *before* the field was `volatile`; with `volatile` (Java 5+) it's correct.

**What follows from this topic**

This is the theoretical foundation under everything else in the primer. **Locks** work because release/acquire creates happens-before — that's *why* a mutex makes writes visible, not just exclusive. **Atomics and lock-free** algorithms are built entirely on `memory_order` / happens-before reasoning — CAS with acquire/release is how you publish without a lock, and getting the ordering wrong is how lock-free code breaks. **Safe publication** underpins the immutability-is-thread-safe story from the Locks topic (immutable objects with `final` fields are safe to share). And the `volatile`-doesn't-make-`count++`-atomic result is the bridge to the whole atomics/CAS family: once you see *why* you can't fix a compound operation with visibility alone, you understand why compare-and-swap exists.

### Q1. What is instruction reordering, and who does it?

Reordering means the memory operations of your program don't necessarily execute in source order. Three culprits, in layers:

1. **Compiler / JIT** — reorders and eliminates operations while preserving single-threaded semantics (hoisting a read out of a loop, reordering independent stores).
2. **CPU (out-of-order execution)** — issues instructions as their inputs become ready, not in program order.
3. **Memory system** — store buffers and caches mean your store may sit in a buffer, invisible to other cores, and loads may be satisfied out of order.

The golden rule each layer obeys: **preserve the behaviour of a single thread in isolation.** So `a = 1; b = 2;` (independent) may be reordered freely — a lone thread can't tell. But another thread *can* tell:

```text
Initial: a = 0, b = 0
T1:  a = 1;        T2:  if (b == 1)
     b = 1;                 assert a == 1;   // CAN FAIL!
```

Intuitively, if T2 sees `b==1`, T1 must have run `a=1` first. But nothing stops T1's two independent stores being reordered (or T2's loads), so T2 can see `b==1` while `a` is still 0. The assertion can fail on real hardware. This is why you can't reason about multithreaded code by "reading the source top to bottom" — you need explicit ordering (a memory model) to forbid the harmful reorderings.

### Q2. Sequential consistency vs relaxed memory models — what's the difference and why not always use SC?

**Sequential consistency (SC)** is the intuitive model: the program behaves as if there is a single global order of all memory operations, and each thread's operations appear in that order in program order. It's what most people *assume* is happening.

**Relaxed / weak models** allow more reordering than SC — stores may become visible to different threads at different times, loads and stores may be reordered across each other — in exchange for not paying for expensive synchronisation on every access.

Why not always SC? **Cost.** Enforcing a single global order requires the hardware to serialise memory operations with fences and inter-core coordination on essentially every access, defeating store buffers, caches, and out-of-order execution — a large performance hit. Real hardware is weak by default: x86 is **TSO** (Total Store Order — fairly strong, allows only store→load reordering); ARM and POWER are much weaker. So both hardware and language defaults choose relaxed models for speed, and give you *tools* (fences, `volatile`, atomics, locks) to buy back the ordering you specifically need, where you need it.

```text
SC:       one global interleaving, program order preserved  → intuitive, slow
Relaxed:  reorderings allowed, per-thread views can differ   → fast, needs fences
```

The practical stance: write code that's correct under the *weak* model (using happens-before/fences), and you're correct everywhere; code that only works under SC will break on ARM.

### Q3. What is a memory barrier (fence), and what kinds are there?

A **memory barrier** (fence) is an instruction that forbids certain reorderings of memory operations across it — it's how you locally restore ordering in a relaxed model. The four fine-grained kinds, named by what they order:

- **LoadLoad** — loads before the barrier complete before loads after it.
- **StoreStore** — stores before complete (become visible) before stores after.
- **LoadStore** — loads before complete before stores after.
- **StoreLoad** — stores before become visible before loads after; the **most expensive** (must drain the store buffer), and the one x86 needs an explicit `mfence`/`lock` for.

You rarely write these by hand; higher-level primitives emit them:

```text
volatile write / release-store  → StoreStore + LoadStore before it
volatile read  / acquire-load   → LoadLoad + LoadStore after it
lock release                    → release barrier
lock acquire                    → acquire barrier
full fence (seq_cst)            → all four, incl. StoreLoad
```

The mental model: **acquire** = "no operation after me floats above me" (a one-way barrier for later ops), **release** = "no operation before me sinks below me" (a one-way barrier for earlier ops). A release-store paired with an acquire-load of the same variable forms a happens-before edge — everything before the release is visible after the acquire. Full (seq_cst) fences are two-way and the costly StoreLoad is why sequentially-consistent atomics are slower than acquire/release.

### Q4. Explain the Java Memory Model and happens-before. Give the main happens-before rules.

The **Java Memory Model (JMM)** defines, for a given program, which values a read is allowed to see. Its central abstraction is **happens-before**: a partial order over actions such that **if A happens-before B, then A's memory effects are visible to and ordered before B.** If there's *no* happens-before edge between a write and a read of the same non-`final` field, and at least one is a write, you have a **data race** and the read may see a stale or unexpected value.

The main happens-before edges you compose:

- **Program order** — within a single thread, each action happens-before the next in source order.
- **Monitor lock** — an `unlock` of a monitor happens-before every subsequent `lock` of the *same* monitor.
- **`volatile`** — a write to a `volatile` field happens-before every subsequent read of that field.
- **Thread start** — `Thread.start()` happens-before any action in the started thread.
- **Thread join** — every action in a thread happens-before another thread's successful `join()` on it.
- **Transitivity** — if A hb B and B hb C, then A hb C.

```text
T1:  data = 42;          //  (1)
     ready = true;       //  (2) volatile write
                              ↓ happens-before
T2:  if (ready)          //  (3) volatile read sees true
        use(data);       //  (4) GUARANTEED to see data == 42
```

Because (2) is a volatile write and (3) a volatile read of the same field, (2) hb (3); by program order (1) hb (2) and (3) hb (4); by transitivity (1) hb (4), so T2 sees `data == 42`. Remove `volatile` and the edge vanishes — T2 might see `ready==true` but `data==0`. Correct Java concurrency is the discipline of *ensuring a happens-before edge exists* for every cross-thread read you depend on.

### Q5. Why doesn't `volatile int count; count++;` make the increment thread-safe?

Because `volatile` guarantees **visibility and ordering of individual reads and writes**, but `count++` is **not** a single read or write — it's three separate operations: read `count`, add 1, write `count` back. `volatile` makes each of those three steps visible, but does nothing to make the *sequence* atomic. Two threads can interleave and lose an update:

```text
count = 0 (volatile)
T1: read count → 0        T2: read count → 0
T1: add 1 → 1             T2: add 1 → 1
T1: write count = 1       T2: write count = 1
Final count = 1, not 2 — one increment lost (read-modify-write race)
```

Both threads read 0 (each read is perfectly *visible* and fresh), both compute 1, both write 1. `volatile` prevented staleness but not the lost update, because the bug is a **race condition on a compound operation**, not a visibility problem.

The fixes provide *atomicity* for the whole read-modify-write:

```java
AtomicInteger count = new AtomicInteger();
count.incrementAndGet();          // atomic RMW via CAS — correct
// or:
synchronized (lock) { count++; }  // lock makes the 3 steps indivisible
```

This is *the* canonical memory-model interview question. The one-line answer: **`volatile` gives you visibility, not atomicity; `count++` needs atomicity, so use an atomic (CAS) or a lock.** Reserve `volatile` for a single flag/reference that one thread writes and others read wholesale.

### Q6. When IS `volatile` the right tool in Java?

`volatile` is exactly right when you have a **single field** that threads read and write *wholesale* (no compound read-modify-write), and you need **visibility + ordering** but not atomicity across multiple variables. Concretely:

- **A stop/status flag** — one thread sets it, others poll it:

```java
private volatile boolean running = true;
void stop()  { running = false; }         // writer
void loop()  { while (running) { work(); } } // reader sees the change promptly
```

Without `volatile`, the JIT may hoist `running` into a register and loop forever, never seeing the write.

- **Safe publication of an immutable object** — build it fully, then publish via one volatile write; readers that see the reference see a fully-constructed object (the volatile write's release ordering guarantees the constructor's writes are visible).

- **The `volatile` field in double-checked locking** — see the DCL question.

- **The "double-check" read in one-writer/many-reader snapshots.**

The boundaries: `volatile` does **not** help if (a) the update is a read-modify-write (`count++`, `x = x + y`) → use an atomic; (b) an invariant spans multiple fields → use a lock; (c) you need to wait for a condition → use a lock + condition variable. The mental test: "is this one variable that I only ever *set* or *get*, never *update-based-on-its-own-value*, and is there no multi-field invariant?" If yes, `volatile`; otherwise, a stronger tool.

### Q7. How do `final` fields give you safe publication in Java?

The JMM makes a special guarantee for **`final` fields**: if an object is properly constructed (the `this` reference doesn't escape during construction), then any thread that obtains a reference to the object — *even through a data race* — is guaranteed to see the **correctly initialised values of its `final` fields**, without any further synchronisation.

```java
class Point {
    final int x, y;                    // final → safely published
    Point(int x, int y) { this.x = x; this.y = y; }
}
// Thread A: shared = new Point(3, 4);   (even via a non-volatile field)
// Thread B: reads shared → guaranteed to see x==3, y==4 (never 0,0)
```

The mechanism: the end of the constructor has a **freeze** on final fields — a StoreStore barrier ensuring the final-field writes are complete and visible before the object reference can be published. This is *why immutable objects (all-`final`) are inherently thread-safe to share*: you can hand them to other threads with no locks and they'll always observe a consistent, fully-built state.

The caveats: (1) it only covers `final` fields — non-final fields of the same object still need synchronisation; (2) it breaks if `this` **escapes** during construction (e.g. registering a listener that captures `this` before the constructor finishes), because then another thread can grab the reference before the freeze. This guarantee is the JMM's foundation for the "make it immutable" concurrency strategy and for records' thread-safety.

### Q8. Explain C++ `std::memory_order`. What do relaxed, acquire, release, and seq_cst mean?

C++ atomics let you specify, per operation, *how much ordering* you need — trading strength for speed:

| Order | Guarantee | Use for |
|---|---|---|
| `relaxed` | Atomicity only; **no** ordering/sync with other vars | Counters where only the final total matters |
| `acquire` (on loads) | No later op moves *before* it; pairs with a release | Reading a flag/pointer that publishes data |
| `release` (on stores) | No earlier op moves *after* it; pairs with an acquire | Publishing data via a flag/pointer |
| `acq_rel` (on RMW) | Both acquire and release | CAS in lock-free structures |
| `seq_cst` (default) | Acquire/release **plus** a single global total order | When you need SC reasoning; safest, slowest |

The workhorse is the **acquire/release pair**: a `release` store and an `acquire` load *of the same atomic* form a happens-before edge, so everything the writer did before the release is visible to the reader after the acquire.

```cpp
std::atomic<bool> ready{false};
int data = 0;
// Producer:
data = 42;
ready.store(true, std::memory_order_release);   // publish
// Consumer:
while (!ready.load(std::memory_order_acquire)) {}  // acquire
assert(data == 42);   // GUARANTEED — release/acquire edge
```

`relaxed` gives *no* such edge — it's only safe when the atomic is independent of other data (e.g. a statistics counter). `seq_cst` (the default when you omit the order) adds a global total order across *all* seq_cst operations, which is easiest to reason about but requires the expensive StoreLoad fence. Rule: default to `seq_cst`, drop to acquire/release when you understand the pairing and need the speed, and use `relaxed` only for genuinely independent atomics.

### Q9. What is safe publication, and what are the ways to achieve it in Java?

**Safe publication** means making an object visible to other threads such that they see it **fully constructed** — never a partially-initialised state. The danger without it: the reference write and the constructor's field writes can be reordered, so another thread sees a non-null reference to a half-built object.

```java
// UNSAFE publication:
Map<String,String> map;
void init() { map = new HashMap<>(); map.put("k","v"); }
// Another thread reading `map` may see the reference before put() is visible,
// or even before the HashMap's internals are initialised → corruption.
```

The safe idioms (each establishes a happens-before edge between construction and the reader's access):

1. **Static initializer** — the class-init lock publishes safely: `static final Map<String,String> M = build();`.
2. **`volatile` field / `AtomicReference`** — write the reference through it; the volatile write's release ordering makes the construction visible.
3. **`final` field** — the constructor freeze guarantees final fields are visible (Q7).
4. **Guarded by a lock** — write and read the reference under the same lock; release-acquire carries the construction across.
5. **Via a thread-safe collection** — e.g. put into a `ConcurrentHashMap`/`BlockingQueue`, which publishes safely on your behalf.

The unifying principle: publication is safe when there's a happens-before edge from "object fully constructed" to "other thread reads the reference." Immutable objects (all-`final`) are the easiest case — they're safe to publish *any* way. For mutable objects, use one of the five idioms; a plain field assignment is a data race.

### Q10. Implement double-checked locking correctly, and explain why the naive version is broken.

Double-checked locking lazily initialises a shared singleton while avoiding locking on the common (already-initialised) path:

```java
class Holder {
    private volatile Singleton instance;          // volatile is ESSENTIAL
    Singleton get() {
        Singleton local = instance;                // 1st check (no lock)
        if (local == null) {
            synchronized (this) {
                local = instance;
                if (local == null) {               // 2nd check (locked)
                    local = new Singleton();
                    instance = local;              // volatile write publishes safely
                }
            }
        }
        return local;
    }
}
```

Why the **naive version without `volatile` is broken**: `instance = new Singleton()` is not atomic — it's (a) allocate memory, (b) run the constructor, (c) assign the reference to `instance`. The compiler/CPU may reorder (b) and (c), so `instance` becomes non-null *before the constructor finishes.* A second thread doing the first check sees non-null, skips the lock, and returns a **partially-constructed object** → crashes or corrupt state.

```text
Without volatile, reordered:
  T1: allocate → assign instance (non-null) → [constructor not run yet]
  T2: 1st check: instance != null → return HALF-BUILT object  ✗
```

`volatile` fixes it two ways: it forbids the (b)/(c) reordering (release semantics on the write), and it gives the reading thread an acquire that sees the fully-constructed object. This was *the* motivating example for adding these guarantees to the Java 5 JMM; pre-Java-5, DCL was genuinely unfixable. (In modern code, prefer the **initialization-on-demand holder idiom** — a static nested class — which the JVM makes lazy and thread-safe for free with no `volatile` and no explicit locking.)

### Q11. What's the difference between a data race and a race condition, at the memory-model level?

They're distinct, and the distinction is precise:

- A **data race** is a *memory-model* violation: two threads access the same memory location, at least one writes, and there is **no happens-before edge** ordering them. It's defined purely in terms of the memory model. In **C++ it's undefined behaviour** (the compiler may do literally anything); in **Java it's not UB** but the read's value is *unspecified* and surprising reorderings can appear.
- A **race condition** is a *correctness* bug: the program's result depends on timing/interleaving. It's about program logic, not the memory model.

The key insight is they're **independent**:

```text
Data race, no race condition:   two threads racing on a stats counter you never
                                read precisely — a bug in theory (UB in C++) but
                                the "wrong" value doesn't break correctness.

Race condition, NO data race:   check-then-act on a properly-synchronised atomic —
   if (map.containsKey(k))       every access is atomic (no data race), but the
       map.remove(k);            compound op isn't → another thread removes between
                                 the check and the act → logic bug.
```

So you can have either without the other. Fixing a data race (add synchronisation/happens-before) doesn't necessarily fix a race condition (you may still have a non-atomic compound operation), and vice versa. In an interview: **data race = no happens-before edge on a shared location (a memory-model fault); race condition = timing-dependent incorrect behaviour (a logic fault).** The counterexample (race condition on an atomic, no data race) is the answer that shows you truly understand the difference.

### Q12. Is Java's `volatile` the same as C++'s `volatile`? What about `std::atomic`?

**No — they are completely different, and confusing them is a classic trap.**

- **Java `volatile`** — a *concurrency* construct. It gives visibility + ordering (happens-before on each access) and prevents reordering around the field. It's roughly equivalent to a C++ `std::atomic<T>` with `seq_cst` ordering for a single field.
- **C++ `volatile`** — a *hardware/compiler* construct with **no thread-safety whatsoever.** It tells the compiler "don't optimise away or cache accesses to this location" — meant for memory-mapped I/O registers and signal handlers. It provides **no atomicity, no ordering between threads, no happens-before.** Using C++ `volatile` for thread communication is a bug.
- **C++ `std::atomic<T>`** — the *correct* concurrency tool, the analogue of Java `volatile` (and more): atomic operations with selectable `memory_order`.

```text
Java volatile x        ≈  C++ std::atomic<T> x  (seq_cst)
C++ volatile T x       ≈  "don't optimise this access" — NOT thread-safe
```

So: in Java, use `volatile` for cross-thread visibility. In C++, use `std::atomic` for cross-thread visibility and reserve `volatile` for device registers. The names collide but the semantics don't — a candidate who says "I'll make it `volatile`" in a C++ concurrency context and means thread-safety is signalling a gap.

### Q13. Two threads write a flag and read data with no synchronization. Walk through what can go wrong.

```java
// Shared, NOT volatile:
int data = 0;
boolean ready = false;

// T1 (producer):        // T2 (consumer):
data = 42;               while (!ready) { /* spin */ }
ready = true;            System.out.println(data);   // expect 42
```

Three distinct failures, all from the missing happens-before edge:

1. **T2 never terminates.** The JIT sees `ready` unchanged within T2's loop and hoists it into a register — T2 spins forever even after T1 sets `ready = true`, because nothing forces T2 to re-read main memory.

2. **T2 prints 0.** Even if T2 does see `ready == true`, there's no ordering guarantee that `data = 42` is visible. Without a happens-before edge, T2 can observe `ready == true` while still seeing the stale `data == 0`.

3. **Reordering makes it worse.** T1's two independent writes (`data`, `ready`) can be reordered — `ready = true` may become visible *before* `data = 42`. So T2 can see the flag set and the data unwritten even on a "reasonable" execution.

```text
No happens-before edge between T1's writes and T2's reads → data race
→ T2 may: spin forever, see data==0, or see reordered state. All legal.
```

The fix is one keyword: make `ready` **`volatile`**. Then T1's `ready = true` (volatile write) happens-before T2's `ready == true` (volatile read); by program order `data = 42` precedes the write and the print follows the read; transitivity guarantees T2 sees `data == 42`, and the volatile read forbids hoisting so the loop terminates. One `volatile` on the flag fixes all three problems — because the flag's happens-before edge *carries the ordinary `data` write across with it.*

### Q14. When is a `relaxed` atomic (C++) or a plain atomic operation safe to use?

`relaxed` gives you **atomicity but zero ordering** — the operation is indivisible, but it establishes *no* happens-before relationship with any other variable. It's safe precisely when **the atomic is independent: no other memory's visibility depends on it, and you only care about the atomic's own eventual value, not ordering relative to other data.**

The textbook safe case is a **statistics counter** where you only read the total after all threads have joined:

```cpp
std::atomic<long> hits{0};
// many threads:
hits.fetch_add(1, std::memory_order_relaxed);   // no ordering needed — just count
// after join:
std::cout << hits.load();                        // total is correct
```

Each increment is atomic (no lost updates), and since nothing else's visibility depends on the counter's ordering, relaxed is both correct and fastest (no fences).

It is **not** safe the moment the atomic is used to *publish* other data — a flag guarding a payload, a pointer to a constructed object, a "done" signal that the reader uses to access other writes. Those need at least **acquire/release** to carry the other writes across the happens-before edge; relaxed would let the reader see the flag set but the payload stale.

```text
Safe relaxed:   independent counter, event tally, seqlock version bump (with care)
NOT relaxed:    flag/pointer that publishes data → need release (write) / acquire (read)
```

Rule of thumb: if the answer to "does any *other* variable's visibility ride on this atomic?" is no, relaxed is fine; if yes, you need acquire/release (or seq_cst).

### Q15. Why is `x86` "getting away with it" a dangerous thing to rely on?

x86 has a relatively **strong** memory model — TSO (Total Store Order): it preserves store→store, load→load, and load→store ordering, and only allows store→load reordering (a later load bypassing an earlier store to a different address via the store buffer). Because of this, a lot of *technically-racy* code **appears to work on x86** — missing `volatile`, absent fences, under-synchronised publication often produce the expected result on Intel/AMD, because the hardware happens to provide most of the ordering you forgot to ask for.

The danger is threefold:

1. **ARM and POWER are far weaker.** They freely reorder loads and stores in ways x86 never does. Code that "works" on your x86 laptop can break — silently, intermittently — on an ARM server, an Apple-silicon Mac, or a mobile device. As ARM datacentres proliferate, this is no longer hypothetical.

2. **The compiler/JIT reorders regardless of hardware.** Even on x86, the *compiler* can reorder your source, so a missing `volatile` can break on x86 too, independent of the CPU.

3. **It hides the bug from testing.** The code passes every test on the dev machine, then fails in production on different hardware — the worst kind of heisenbug to diagnose.

```text
x86 (TSO):   only store→load reordering  → forgiving, hides races
ARM/POWER:   loads & stores reorder freely → exposes every missing fence
Compiler:    reorders on ALL platforms     → source-level races break anywhere
```

The discipline: **write to the language memory model, not the hardware.** Use `volatile`/`atomic`/locks to *express* the ordering you need; then the compiler and every CPU are obligated to honour it. Relying on x86's incidental strength is relying on an accident that your next deployment target won't reproduce.

### Q16. How do the Java and C++ memory models compare, and what's the one rule that keeps you safe in both?

Both are built on the same core idea — **happens-before** — but expose it differently:

| | Java (JMM) | C++ (std) |
|---|---|---|
| Core relation | happens-before | happens-before (via sequenced-before + synchronizes-with) |
| Simple visibility tool | `volatile` (always ≈ seq_cst) | `std::atomic` with chosen `memory_order` |
| Ordering granularity | Coarse — `volatile` is all-or-nothing | Fine — relaxed/acquire/release/acq_rel/seq_cst per op |
| Data race outcome | Unspecified value (**not** UB) | **Undefined behaviour** |
| Safe publication | `final` fields, `volatile`, locks, static init | atomics with release/acquire, mutexes |
| `volatile` keyword | Concurrency primitive | **Not** for concurrency (device I/O only) |

The differences: Java trades control for simplicity (`volatile` gives you seq_cst-strength ordering with no knobs; a data race yields a garbage-but-defined value). C++ gives you the full `memory_order` dial for performance, but the price is that a data race is *undefined behaviour* — the program may do anything, so the bar for correctness is absolute.

**The one rule that keeps you safe in both:** *for every pair of "one thread writes X, another reads X" that your correctness depends on, establish a happens-before edge between them* — via a lock (release→acquire), a `volatile`/atomic with sufficient ordering (release write paired with acquire read), thread start/join, or safe publication of an immutable object. If you can trace a happens-before chain from every write to every dependent read, you have no data races and the reader sees what you intend — on x86, on ARM, in Java, and in C++. Concurrency correctness at this level *is* the discipline of connecting writes to reads with happens-before edges.
## Atomics & Lock-Free Programming

### Summary

**What this topic covers**

The layer beneath locks: hardware-provided **atomic** read-modify-write instructions and the lock-free algorithms built on top of them. Three concern areas: (1) the **primitives** — atomic types (`AtomicInteger`, `std::atomic`, `AtomicReference`), **compare-and-swap (CAS)**, fetch-and-add, and LL/SC, plus the CAS retry loop that turns a single-word atomic into an arbitrary update; (2) the **hazards** — the **ABA problem** and the memory-reclamation problem, and their fixes (tagged/versioned pointers, hazard pointers, epoch-based reclamation, RCU); and (3) the **algorithms & tradeoffs** — the progress hierarchy (**lock-free vs wait-free vs obstruction-free**), the Treiber stack, the Michael-Scott queue, and the engineering judgment of *when lock-free actually beats a mutex* and when it's a trap. This topic has 16 questions. It assumes you already understand memory ordering (acquire/release, seq-cst) from the memory-model topic — CAS without the right ordering is a silent bug.

**Mental model**

Think of a lock-free update as **optimistic concurrency at the word level**: read the current value, compute the new value off to the side, then atomically swap it in *only if nothing changed underneath you*. That "only if" is CAS. If someone raced you, CAS fails, and you loop and retry with the fresh value. No thread ever waits for another to release anything — a stalled thread (descheduled, page-faulted, even crashed mid-operation) can never block the others, because there's no lock to hold. That's the whole point and the whole difficulty: correctness now depends on the fact that *any* interleaving of these tiny atomic steps still leaves the structure consistent. You design for "what if I'm suspended for a full second right here?" The cost you pay is that reasoning gets much harder (the ABA problem, safe memory reclamation, subtle ordering requirements) and that under heavy contention the retry loops can waste more CPU than a mutex would. Lock-free is a scalpel, not a hammer.

**Key terms**

- **Atomic operation** — completes indivisibly; no other thread observes a half-done state. Backed by a hardware instruction, not a lock.
- **CAS (compare-and-swap)** — `CAS(addr, expected, new)`: atomically, if `*addr == expected` set `*addr = new` and report success, else report failure. The universal building block.
- **CAS retry loop** — read → compute → CAS; on failure re-read and retry. The standard lock-free update pattern.
- **Fetch-and-add (FAA)** — atomically add and return the old value; wait-free, ideal for counters/ticket locks.
- **LL/SC (load-linked / store-conditional)** — ARM/RISC-V/Power primitive: SC succeeds only if no write hit the address since the LL. Sidesteps ABA at the hardware level.
- **ABA problem** — a value reads A, changes to B, then back to A; a naive CAS(expected=A) succeeds even though the world moved. Corrupts pointer-based structures.
- **Lock-free** — system-wide progress guaranteed: *some* thread always makes progress; individual threads may starve.
- **Wait-free** — the strongest: *every* thread finishes in a bounded number of its own steps, regardless of others.
- **Obstruction-free** — the weakest: a thread makes progress if it eventually runs alone (no contention); allows livelock.
- **Treiber stack** — the canonical lock-free stack: push/pop via a single CAS on the head pointer.
- **Michael-Scott queue** — the standard lock-free MPMC FIFO queue, using separate head/tail with a "help the other guy" swing step.
- **Hazard pointers / epoch reclamation** — schemes to safely free memory in a lock-free structure where another thread might still be reading it.

**Why interviewers ask this**

This is a senior/staff filter. Anyone can call `AtomicInteger.incrementAndGet()`; the signal is whether you know *what it compiles to* (a CAS loop or a fetch-and-add) and *why that matters*. A junior says "lock-free is faster." A senior says "lock-free guarantees progress and avoids priority inversion and convoying, but under high contention CAS-failure retries can burn more cycles than an uncontended mutex, and the real cost is that you now own the ABA and memory-reclamation problems." The ABA question specifically separates people who've read about lock-free from people who've *debugged* it. Being able to write a Treiber stack on a whiteboard, explain exactly where ABA bites it, and then reason about how you'd free popped nodes safely is a strong staff-level signal.

**Common confusions**

- "Lock-free means no locking, so it's always faster" — false. It means non-blocking *progress*. Under contention it can be slower than a good mutex due to wasted retries and cache-line ping-pong.
- "Lock-free means wait-free" — no. Lock-free permits individual threads to retry forever (starve); wait-free bounds every thread's steps. Most real "lock-free" structures are lock-free, not wait-free.
- "CAS solves everything" — CAS on a single word is powerful, but multi-word invariants need more (DCAS, LL/SC, or careful single-word design), and CAS alone doesn't tell you when it's safe to free memory.
- "ABA only matters in theory" — it's a real, shipped bug class in pointer-based lock-free stacks/queues in languages without GC. GC accidentally hides it (a node can't be reused while referenced); manual memory management exposes it.
- "Atomic means synchronized" — atomic gives you atomicity of one operation; it does **not** give you the ordering/visibility of a critical section spanning several operations. Check-then-act across two atomics is still a race.
- "`volatile` (Java) gives me CAS" — no. `volatile` gives visibility/ordering, not atomic read-modify-write. You need `Atomic*`/`VarHandle` for CAS.

**What follows from this topic**

Atomics are the floor that everything non-blocking stands on. The memory-ordering discipline here (why a CAS needs acquire/release, why a lazy publish uses release) is the memory-model topic applied. The concurrent-data-structures topic is largely "these algorithms, productized" — `ConcurrentLinkedQueue` *is* Michael-Scott, `ConcurrentHashMap` bins use CAS. The contention/scaling topic explains *why* your beautiful lock-free structure can still crawl (false sharing on the head pointer, CAS-failure storms). And the deadlock topic is the flip side: lock-free structures can't deadlock, but they can livelock — which is the next topic.

### Q1. What does "atomic" actually mean, and why isn't `count++` atomic?

**Atomic** means the operation is indivisible: no other thread can observe it half-finished, and it appears to happen at a single instant. Hardware provides a handful of these (atomic load, atomic store, CAS, fetch-and-add) as single instructions with the right bus/cache-coherence guarantees.

`count++` looks like one operation but compiles to three:

```text
   load  r1, [count]     // read
   add   r1, r1, 1       // modify
   store [count], r1     // write
```

Two threads can interleave between the load and the store and lose an update:

| step | T1                | T2                | count |
|------|-------------------|-------------------|-------|
| 1    | load r1 = 0       |                   | 0     |
| 2    |                   | load r1 = 0       | 0     |
| 3    | add r1 = 1        |                   | 0     |
| 4    |                   | add r1 = 1        | 0     |
| 5    | store count = 1   |                   | 1     |
| 6    |                   | store count = 1   | 1     |

Two increments, final value 1 — a **lost update**. The fix is to make the whole read-modify-write atomic: a mutex, or an atomic primitive like `AtomicInteger.incrementAndGet()` (a CAS loop or a hardware fetch-and-add). "Atomicity" is one of the three concurrency concerns (with visibility and ordering); this question is testing whether you conflate "single line of source" with "single machine operation."

### Q2. Explain compare-and-swap (CAS). Write the semantics precisely.

CAS is a single atomic instruction (`cmpxchg` on x86, emulated via LL/SC on ARM) that conditionally writes:

```text
bool CAS(addr, expected, new):        // executed atomically
    if *addr == expected:
        *addr = new
        return true
    else:
        return false                   // someone changed it; you lose
```

The power of CAS is that it lets you make an update *conditional on nothing having changed since you looked*. That's optimistic concurrency: you don't lock, you gamble, and CAS is the atomic "did I win the gamble?" check. It's a **universal primitive** — Herlihy's result is that CAS (consensus number ∞) can implement any wait-free object for any number of threads, which fetch-and-add and test-and-set (finite consensus numbers) cannot.

Some flavors return the *witnessed* value instead of a bool (`compareAndExchange`), which saves a re-read on failure. In Java it's `AtomicInteger.compareAndSet(expected, new)` / `VarHandle.compareAndSet`; in C++ `std::atomic::compare_exchange_weak/_strong`; the `weak` form may fail spuriously (LL/SC can) and is meant to live inside a retry loop.

### Q3. Show a CAS retry loop. Why do you need the loop?

You need the loop because CAS can fail: another thread beat you to the update. On failure you re-read the fresh value and try again. Atomic increment, hand-written:

```java
int incrementAndGet(AtomicInteger a) {
    int cur, next;
    do {
        cur  = a.get();          // read current
        next = cur + 1;          // compute new value off to the side
    } while (!a.compareAndSet(cur, next));  // publish iff unchanged
    return next;
}
```

The pattern generalizes to *any* pure function of the current value: read, compute `next = f(cur)`, CAS. If it fails, someone else moved the value; loop with the new `cur`. This is exactly `AtomicInteger.updateAndGet(f)` / `getAndAccumulate`.

Two caveats. (1) `f` must be **side-effect-free and idempotent-safe** — it can run several times before one attempt sticks, so no logging-with-effects or external mutation inside it. (2) This is **lock-free but not wait-free**: an unlucky thread can lose the CAS race indefinitely under sustained contention. In practice for a plain counter, prefer `getAndAdd`/`LongAdder` (fetch-and-add is wait-free and doesn't spin); the CAS loop is for updates hardware doesn't have a dedicated instruction for.

### Q4. What is fetch-and-add, and why prefer it over a CAS loop for a counter?

**Fetch-and-add (FAA)** atomically adds a delta and returns the previous value, in one hardware instruction (`lock xadd` on x86):

```text
FAA(addr, delta):          // atomic
    old = *addr
    *addr = old + delta
    return old
```

The difference from a CAS loop is **progress**: FAA is **wait-free** — it always completes in a bounded number of steps, no retry, no spinning. A CAS-loop counter is only lock-free: under contention threads keep losing the race and retrying, so throughput collapses and latency has a fat tail. For a hot shared counter, FAA (`AtomicLong.getAndIncrement` maps to `xadd` when it can) wins.

The deeper scaling point: even FAA serializes on **one cache line** — every core fighting over the same address causes coherence ping-pong (MESI traffic). That's why Java's `LongAdder` beats `AtomicLong` under high contention: it *strips* the counter across multiple cells (per-thread-ish), each FAA'd independently, and sums them only on `sum()`. Trade exact-instant readability for scalability. The lesson: the atomic op matters less than *how many cores hammer the same line*.

### Q5. Explain the ABA problem. Give a concrete scenario where it corrupts a structure.

The **ABA problem**: a CAS checks *equality of value*, but you actually care about *"has nothing happened since I looked?"* If a location goes A → B → A, a CAS expecting A succeeds — even though the world changed underneath you. For plain integer counters this is harmless. For **pointers in a lock-free structure it's catastrophic**, because the pointer can be the same address while the object it points to has been freed and a *different* object reallocated there.

Concrete: a Treiber stack `top → A → B → C`. Thread T1 starts a pop: reads `top = A`, reads `A.next = B`, is about to `CAS(top, A, B)` — then gets descheduled.

| step | T1                          | T2                                   |
|------|-----------------------------|--------------------------------------|
| 1    | reads top=A, A.next=B       |                                      |
| 2    | *(suspended)*               | pop A; pop B; stack is now top→C     |
| 3    | *(suspended)*               | push A back (reuse node A); top→A→C   |
| 4    | CAS(top, A, B) → **succeeds!** |                                   |

T1's CAS sees `top == A` and swaps in `B`. But B was already popped and freed — `top` now points at reclaimed/garbage memory. The stack is corrupted. The value matched (A==A); the *meaning* didn't. Note GC languages dodge the classic pointer-ABA because node A can't be freed and reused while T1 still references it — but the logical ABA (a slot reverting to a stale-but-equal value) can still bite you.

### Q6. How do you fix ABA? Compare tagged pointers, hazard pointers, and epoch reclamation.

Three families, solving two intertwined problems (ABA detection *and* safe memory reclamation):

**Tagged / versioned pointers (fix the detection).** Pack a monotonic counter next to the pointer and CAS both together (double-width CAS, `cmpxchg16b` on x86, or `AtomicStampedReference` in Java). Every update bumps the tag, so A-with-tag-7 never equals A-with-tag-9 — the A→B→A cycle changes the tag and your CAS correctly fails. Cheap and simple; needs a wide-CAS and enough tag bits to make wraparound implausible. Doesn't by itself solve *when to free* memory.

**Hazard pointers (fix reclamation).** Before dereferencing a node, a thread publishes it in a per-thread "hazard" slot. A thread wanting to free a node scans all hazard slots; if any thread has it marked, defer the free (retire list). Guarantees no one frees memory you're reading. Bounded memory, robust, but adds a store+fence on every access and a scan on reclaim.

**Epoch-based reclamation / RCU (fix reclamation, faster).** Threads announce an "epoch" on entering a critical region; memory is only freed once all threads have moved past the epoch in which it was retired. Very low read-side overhead (great for read-heavy structures — this is Linux **RCU**), but a single stalled reader can pin memory and balloon the retire list.

| approach          | solves         | read overhead | memory bound | notes                          |
|-------------------|----------------|---------------|--------------|--------------------------------|
| tagged pointer    | ABA detection  | ~0            | n/a          | needs wide CAS + tag bits      |
| hazard pointers   | reclamation    | store+fence   | tight        | per-access publish, scan to free |
| epoch / RCU       | reclamation    | very low      | loose        | stalled reader pins memory     |

In practice: GC languages get reclamation for free; C/C++/Rust lock-free code pairs a tag *or* uses hazard pointers / epochs. LL/SC hardware avoids ABA entirely because SC fails on *any* intervening write, not just a value change.

### Q7. Distinguish lock-free, wait-free, and obstruction-free. Give the progress guarantee of each.

A hierarchy of **non-blocking progress guarantees**, strongest first:

- **Wait-free** — *every* thread completes its operation in a **bounded number of its own steps**, no matter what other threads do. No starvation possible. Strongest, hardest, often slowest in the common case (FAA counters, some wait-free queues).
- **Lock-free** — the **system as a whole always makes progress**: at any point, *some* thread completes in a bounded number of steps. Individual threads may retry forever (starve), but the structure never globally stalls. Treiber stack, Michael-Scott queue.
- **Obstruction-free** — a thread completes in bounded steps **if it eventually runs without contention** (others suspended). Permits **livelock** when threads keep interfering. Weakest; e.g. some STM designs.

```text
wait-free  ⊂  lock-free  ⊂  obstruction-free  ⊂  (blocking)
 every        some           only-if-alone       none guaranteed
 thread       thread                              (a lock is here)
 bounded      progresses
```

All three are **non-blocking**: no thread holds a lock whose loss (crash, descheduling, page fault) can freeze others. That's the key contrast with lock-based code, where a thread suspended inside a critical section blocks everyone waiting on that lock. Interview trap: candidates say "lock-free" when they mean "non-blocking" or "wait-free." Most production "lock-free" structures are exactly lock-free — not wait-free — which is why they can starve a thread and why bounded latency isn't guaranteed.

### Q8. Implement a lock-free (Treiber) stack. Walk through push and pop.

The Treiber stack is the "hello world" of lock-free: a singly linked list where every op is a single CAS on `head`.

```java
class TreiberStack<T> {
    static final class Node<T> { final T item; Node<T> next; Node(T i){item=i;} }
    private final AtomicReference<Node<T>> head = new AtomicReference<>();

    void push(T item) {
        Node<T> n = new Node<>(item);
        Node<T> cur;
        do {
            cur = head.get();       // read current top
            n.next = cur;           // point new node at it
        } while (!head.compareAndSet(cur, n));  // publish iff head unchanged
    }

    T pop() {
        Node<T> cur, next;
        do {
            cur = head.get();
            if (cur == null) return null;   // empty
            next = cur.next;
        } while (!head.compareAndSet(cur, next)); // swing head past cur
        return cur.item;
    }
}
```

**Push**: build the node, link it to whatever `head` is now, then CAS `head` from `cur` to the new node. If another push/pop moved `head` first, CAS fails; re-read and retry.

**Pop**: read `head`, read its `next`, CAS `head` from `cur` to `next`. Success means you atomically detached `cur`.

Two things to say out loud in an interview: (1) this is **lock-free, not wait-free** — a thread can lose the CAS race indefinitely under contention. (2) In a **non-GC** language `pop` has the **ABA bug from Q5** and a use-after-free on the popped node — you'd add a tagged head pointer plus hazard pointers/epochs to reclaim `cur` safely. Also, a single `head` line is a **contention/false-sharing hotspot**, which is why a stack is a poor lock-free choice under heavy multi-core push/pop.

### Q9. Sketch the Michael-Scott queue and its "helping" step.

The Michael-Scott queue is the standard **lock-free MPMC FIFO** (it's what Java's `ConcurrentLinkedQueue` is based on). Keys: a linked list with separate `head` (dequeue end) and `tail` (enqueue end), and a **dummy sentinel node** so head/tail are never null and enqueue/dequeue don't contend on the same pointer.

Enqueue is a **two-step, non-atomic-looking-but-safe** operation:
1. CAS the *last node's* `next` from null to the new node (this logically appends it).
2. CAS `tail` from the old last node to the new node (this "swings" the tail forward).

Because those are two separate CASes, a thread can observe the queue **between** them — tail lagging one node behind reality. The elegant trick is **helping**: any thread that notices `tail.next != null` knows an enqueue is half-done and **advances `tail` itself** via CAS before proceeding. So no thread is blocked by another's incomplete operation — that's what makes it lock-free rather than "lock-free until someone stalls mid-enqueue."

```text
tail ─┐                          after step 1, before step 2:
      v
  ...[X]──next──►[NEW]           tail still points at X (lagging).
      ▲                          Any thread may CAS(tail: X → NEW)  ← "helping"
   lagging
```

Dequeue reads `head` (the sentinel), takes `head.next`'s value, and CASes `head` forward. The "helping" pattern — threads completing each other's operations — is the general technique that turns multi-step lock-free algorithms into ones with a real progress guarantee.

### Q10. When does lock-free actually win over a mutex — and when is a mutex the right call?

Reach for lock-free when the *blocking* nature of a lock is the problem, not raw speed:

**Lock-free wins when:**
- You cannot tolerate a thread being **blocked by a suspended/crashed holder** — real-time systems, signal handlers, code that must not deadlock or suffer priority inversion.
- **Very short** critical sections (one counter, one pointer swing) where mutex overhead dominates the actual work.
- **Read-mostly** hot structures where readers must never block writers or each other (RCU-style).
- You need **progress guarantees** for latency SLOs — no unbounded convoy/priority-inversion stalls.

**A mutex wins when:**
- The critical section is **non-trivial** (touches multiple words / maintains a multi-field invariant) — expressing that lock-free is brutally hard and often needs unavailable multi-word CAS.
- **Contention is high** — CAS-failure retries and cache-line ping-pong can make lock-free *slower* than an uncontended-ish mutex, and burn CPU while doing it (a blocked thread on a mutex sleeps; a losing CAS thread spins).
- You value **correctness and maintainability** — mutex code is auditable; lock-free code has ABA, reclamation, and memory-ordering footguns that eat weeks.

The honest senior answer: **default to a mutex** (or a well-tested concurrent collection). Go lock-free only with a measured bottleneck, a tiny critical section, and a real need for non-blocking progress — and then reach for a *library* implementation (`ConcurrentLinkedQueue`, `LongAdder`, `crossbeam`), not a hand-rolled one. "I wrote my own lock-free queue" is usually a red flag, not a brag.

### Q11. Why does a CAS loop under high contention perform worse than expected?

Because every failed CAS is **wasted work plus cache-coherence traffic**. Walk the failure mode:

1. N cores all read the same `head`/counter line into their caches (Shared state, MESI).
2. One core CASes successfully — its write **invalidates** that line in every other core's cache.
3. The other N-1 cores' CASes now fail; they must **re-fetch** the line (coherence miss ~tens–hundreds of cycles), recompute, and retry.
4. Repeat. Only one winner per round; throughput is bounded by serialized cache-line ownership transfers, and it can *degrade* as you add cores — **contention collapse**.

```text
core0 CAS ok ──► invalidates line in core1..N
core1..N: cache miss ─► refetch ─► CAS fail ─► refetch ─► ...  (livelock-ish churn)
```

So the atomic instruction is cheap; the **coherence protocol on one hot line** is the cost. Fixes: **reduce contention on the line** — stripe/shard the state (`LongAdder`, per-core counters), use **backoff** (exponential backoff between retries, like Ethernet CSMA) so cores don't stampede, or use fetch-and-add (wait-free, one winner-less-retry model) instead of CAS where the operation allows. And watch **false sharing**: pad hot atomics to their own cache line so unrelated atomics don't invalidate each other. This is the bridge to the contention/scaling topic: lock-free removes locks but not the cache-coherence physics.

### Q12. What is LL/SC and how does it avoid ABA that CAS suffers?

**LL/SC (load-linked / store-conditional)** is the RISC alternative to CAS, on ARM, RISC-V, and Power:

```text
LL  reg, [addr]      // load and "link" — start watching this address
... compute ...
SC  [addr], val      // store ONLY if no write to addr since the LL; report success/fail
```

The crucial difference from CAS: SC succeeds based on **"was there any write to this location since I linked?"**, not **"is the value still equal to expected?"** So the A→B→A sequence — which CAS can't see — makes SC **fail**, because there *were* writes, even though the value returned to A. LL/SC is therefore **immune to ABA at the primitive level**.

Caveats: SC can **fail spuriously** (a context switch, an interrupt, a cache-line eviction, or a write to a *nearby* address in the same reservation granule can clear the link), so LL/SC always lives in a retry loop — which is exactly why C++'s `compare_exchange_weak` exists and is allowed to fail spuriously (it maps naturally onto LL/SC). You also can't nest arbitrary work between LL and SC (some archs forbid another load). x86 has no LL/SC — it offers `cmpxchg` (CAS) and thus needs the tagged-pointer trick for ABA. Knowing that "CAS vs LL/SC" is an *architecture* difference, and that LL/SC dodges ABA, is a strong low-level signal.

### Q13. Does using a garbage-collected language make lock-free programming safe?

It removes **one** of the two hard problems, not both.

**What GC gives you:** automatic **safe memory reclamation**. In the Treiber-stack ABA scenario, node A can't be freed and its memory reused while thread T1 still holds a reference to it — the GC sees that reference. So the classic *use-after-free / pointer-reuse* form of ABA can't happen. This is why Java/Go/C# lock-free code doesn't ship hazard pointers or epochs — the GC *is* the reclamation scheme.

**What GC does NOT give you:**
- **Logical ABA still exists.** If your CAS logic depends on "the head is still A therefore nothing changed," and the structure went A→B→A with A *re-pushed*, your CAS succeeds on a stale premise even though A's meaning changed. `AtomicStampedReference` exists in Java precisely for this.
- **Memory ordering / visibility.** You still must use `Atomic*`/`VarHandle` with correct acquire/release semantics; a plain field publish can be reordered. GC doesn't fence for you.
- **Progress/contention.** Lock-free-not-wait-free starvation, CAS-retry storms, false sharing — all unchanged.
- **GC pauses** can undercut the very non-blocking guarantee you went lock-free for (a stop-the-world pause blocks everyone), which is one reason latency-critical systems sometimes avoid GC languages.

So GC makes lock-free *much* easier (no hazard pointers) but not *safe* — you still own ordering, logical ABA, and contention.

### Q14. What's the difference between an atomic operation and a critical section? When does atomicity of one op not save you?

An **atomic operation** makes a *single* read-modify-write indivisible. A **critical section** (mutex) makes an *arbitrary sequence* of operations mutually exclusive. The gap between them is the **check-then-act** race:

```java
// counter is AtomicInteger — each op is atomic, but the PAIR is not
if (counter.get() < LIMIT) {     // check  (atomic)
    counter.incrementAndGet();   // act    (atomic)
}                                // ...but another thread ran between them!
```

Two threads can both read `LIMIT-1`, both pass the check, both increment → you exceed LIMIT. Each individual op was atomic; the **invariant spanning them** was not protected. This is a **race condition without a data race** — no memory rule was violated, the logic is just wrong under interleaving.

The fixes tell the whole story:
- Fold check-and-act into **one** atomic: a CAS loop (`do { c=get(); if(c>=LIMIT) return false; } while(!compareAndSet(c, c+1));`), or a dedicated atomic like `getAndIncrement` with a bound check via CAS.
- Or take a **mutex** around both operations — the general answer when the invariant spans more than one word.

The lesson: atomics protect a **single location**; when correctness depends on a relationship **across locations or across time**, you need CAS-that-encompasses-the-whole-decision or a lock. "I used atomics so it's thread-safe" is a classic false-confidence bug.

### Q15. What memory ordering does a CAS need, and why can relaxed CAS be wrong?

A CAS in a real algorithm usually isn't just changing a number — it's **publishing** or **acquiring** data reachable through that pointer, so it needs the right ordering or other threads see torn/stale state.

Take the Treiber `push`: the CAS that installs the new node must **release** — it has to guarantee that the writes initializing the node (`n.item`, `n.next`) are visible *before* the node becomes reachable via `head`. The matching `pop` CAS (or the read of `head`) must **acquire** — so that after seeing the new head, it also sees those initializing writes. Get this wrong with `memory_order_relaxed` and a popping thread can observe the node but read a **garbage/uninitialized `item`** — a classic publish-without-a-fence bug.

```cpp
// C++: publish with release, consume with acquire
Node* n = new Node(v);
n->next = head.load(std::memory_order_relaxed);
while(!head.compare_exchange_weak(n->next, n,
        std::memory_order_release,      // success: publish n's contents
        std::memory_order_relaxed)){}   // failure: just a retry, relaxed ok
```

`relaxed` is fine when you only care about **atomicity of the value itself and no surrounding data is being published** — e.g. a statistics counter no one reads-then-dereferences. The rule of thumb: **relaxed for standalone counters; acquire/release when the atomic gates access to other memory**; seq-cst when you need a single global order across multiple atomics (and can afford the fence). This is the memory-model topic showing up exactly where it bites hardest.

### Q16. You need a highly concurrent counter. Walk through your options from simplest to most scalable.

Escalate only as contention demands — don't jump to lock-free reflexively:

1. **`long` + `synchronized`/mutex.** Correct, dead simple. Fine for low contention. Blocks; a hot lock convoys under load. Baseline.
2. **`AtomicLong` (CAS loop or `xadd`).** Non-blocking. `getAndIncrement` maps to hardware fetch-and-add where possible (wait-free); otherwise a CAS loop (lock-free). Good until many cores hammer it — then the **single cache line** becomes the bottleneck (Q4/Q11).
3. **`LongAdder` / striped counter.** *This is the right default for a hot counter.* Spreads the count across multiple cells so different threads FAA different cache lines; `sum()` adds them up. Trades exact-instant reads (`sum` isn't a linearizable snapshot) for near-linear write scaling. Choose this when writes ≫ reads.
4. **Per-core / per-thread sharding.** The extreme: each thread owns a counter (thread-local or per-CPU), aggregate on read. Zero write contention; reads are O(cores). This is what metrics systems and the kernel's per-CPU counters do.

```text
contention →   mutex   <   AtomicLong   <   LongAdder   <   per-core shard
readability →  best        good             ok              read-side cost
```

The interview point isn't "always use LongAdder" — it's demonstrating you (a) know exact reads vs write-scalability is the tradeoff, (b) understand *why* AtomicLong stops scaling (one hot line, not the atomic op), and (c) reach for a battle-tested striped structure instead of hand-rolling. Measure first; if the counter isn't hot, `AtomicLong` or even a mutex is perfectly fine.

## Deadlock, Livelock & Starvation

### Summary

**What this topic covers**

The failure modes of *blocking* concurrency — the ways threads stop making progress even though nothing crashed. Three concern areas: (1) **deadlock** — the four **Coffman conditions**, the canonical two-lock A/B vs B/A cycle, and the prevention playbook (**global lock ordering**, try-lock + backoff, lock timeouts, coarsening); (2) the **cousins** — **livelock** (threads busy but making no progress), **starvation** (a thread perpetually denied a resource), and **priority inversion** (a low-priority thread blocking a high-priority one, plus priority inheritance and the Mars Pathfinder story); and (3) the **operational skill** — how to actually diagnose a deadlock from a thread dump, and how to design lock hierarchies that make deadlock structurally impossible. This topic has 15 questions. Where the OS primer covers how the *scheduler* and *lock primitives* work in the kernel, this topic is the **application programmer's** angle: how your `synchronized` blocks and `Lock` acquisitions deadlock, and how you prevent and debug that in real code.

**Mental model**

Deadlock is a **cycle in the wait-for graph**. Draw threads and the resources (locks) they hold and want as a directed graph: an edge from thread → lock it's waiting for, and lock → thread that holds it. A **cycle** in that graph is a deadlock — everyone in the cycle waits for the next, forever, and no scheduler magic breaks it. Everything else follows from this picture. The four Coffman conditions are just "what must be true for such a cycle to be possible," and every prevention technique **removes one condition** to make the cycle impossible: impose a **total order** on locks and you can't form a cycle (an edge always points "up" the order); allow preemption/timeouts and "no preemption" breaks; grab all locks at once and "hold-and-wait" breaks. Livelock and starvation are the *no-cycle* siblings: threads aren't stuck in a wait-graph cycle, they're either uselessly reacting to each other (livelock) or being perpetually skipped (starvation). The mental discipline: for any two locks that a thread might hold simultaneously, **decide their global order up front** and never violate it.

**Key terms**

- **Deadlock** — a set of threads each waiting for a resource held by another in the set; no one proceeds. A cycle in the wait-for graph.
- **Coffman conditions** — the four simultaneously-necessary conditions: mutual exclusion, hold-and-wait, no preemption, circular wait.
- **Mutual exclusion** — a resource is held by at most one thread at a time.
- **Hold-and-wait** — a thread holds ≥1 resource while blocking to acquire another.
- **No preemption** — a resource can't be forcibly taken; only the holder releases it.
- **Circular wait** — a cycle T1→T2→…→Tn→T1 of "waiting for a lock the next holds."
- **Lock ordering (lock hierarchy)** — a global total order on all locks; always acquire in that order. Kills circular wait.
- **Livelock** — threads keep changing state in response to each other but make no forward progress (two people stepping side-to-side in a hallway).
- **Starvation** — a thread is perpetually denied a resource it needs (unfair locks, priority always losing).
- **Priority inversion** — a high-priority thread is blocked by a low-priority thread holding a lock, while a medium-priority thread preempts the low one.
- **Priority inheritance** — the holder of a lock temporarily inherits the priority of the highest-priority waiter, so it can finish and release.
- **Try-lock / lock timeout** — attempt to acquire without blocking forever; on failure, back off and release what you hold — breaks hold-and-wait.

**Why interviewers ask this**

Deadlock is where "I can write threaded code" meets "I can write *correct* threaded code." Juniors can produce the two-lock deadlock by accident; the signal is whether you can (1) name the four Coffman conditions and, more importantly, map each to a **prevention** technique, (2) reach for **global lock ordering** as the default fix rather than sprinkling timeouts, and (3) *diagnose* a hang in production — dumping threads, reading the "waiting to lock <0x...> which is held by" chain, and identifying the cycle. Priority inversion + the Mars Pathfinder anecdote is a classic staff-level question because it shows you understand a subtle, real, ship-it-and-it-resets-on-Mars failure and its fix (priority inheritance). The deep tell: someone who says "just add a timeout" vs someone who says "impose a lock hierarchy so the cycle can't form, and use try-lock+backoff only where a strict order is impossible."

**Common confusions**

- "Deadlock and livelock are the same" — no. Deadlock: threads **blocked**, doing nothing, CPU idle. Livelock: threads **running**, burning CPU, still no progress. A thread dump shows the former as BLOCKED/WAITING; the latter looks *busy*.
- "Starvation is deadlock" — starvation is one thread perpetually losing; the *rest of the system makes progress*. Deadlock is a mutually-stuck set.
- "More locks = safer" — more locks = more ordering constraints = more deadlock surface. Fewer, coarser locks (or lock-free) can be safer.
- "Lock ordering only matters if I lock in the same function" — it matters **globally**, across the whole program, including transitive calls into libraries that lock.
- "A timeout fixes deadlock" — a timeout lets you *detect and recover*, but if you just retry in the same order you get livelock or repeated deadlock. Prevention (ordering) is better than cure.
- "Priority inversion is a scheduling bug" — it's an *interaction* between priorities and shared locks; the fix (priority inheritance / ceiling) is a locking-protocol change, not just a scheduler tweak.

**What follows from this topic**

This is the dark twin of the locks/mutex material: everything you lock, you can deadlock. Livelock connects straight to the atomics topic — a lock-free CAS retry storm or an obstruction-free algorithm under contention is a livelock. Starvation and fairness connect to thread-pool and lock design (fair vs unfair locks, `ReentrantLock(true)`). Priority inversion bridges to real-time systems and to the classic synchronization problems (next topic), where dining philosophers is literally a deadlock/starvation lab. And the diagnosis skill — reading a thread dump — is the practical payoff that shows up in every on-call rotation.

### Q1. State the four Coffman conditions and map each to a prevention technique.

All **four must hold simultaneously** for deadlock to be possible; break **any one** and deadlock cannot occur.

| Coffman condition | Meaning | Break it by |
|---|---|---|
| **Mutual exclusion** | resource held exclusively | use shareable/lock-free structures, immutable data (often unavoidable) |
| **Hold-and-wait** | hold one lock while waiting for another | acquire all locks at once, or try-lock + release-on-fail |
| **No preemption** | can't force-release a held lock | lock timeouts / try-lock so a thread gives up and releases |
| **Circular wait** | cycle in the wait-for graph | **global lock ordering** — acquire locks in a fixed total order |

The practical takeaway: **circular wait is the easiest to attack**, and attacking it (global lock ordering) is the standard prevention. Mutual exclusion is usually intrinsic (that's why you're locking), and eliminating hold-and-wait (grab everything up front) hurts concurrency and can starve. So in real systems: default to **lock ordering**, fall back to **try-lock + backoff** (which breaks both hold-and-wait and no-preemption) where a strict order isn't feasible. Naming the four *and* mapping them to fixes — rather than just reciting them — is the difference between a memorized answer and understanding.

### Q2. Show a two-lock deadlock with an explicit interleaving.

Two threads, two locks, opposite orders — the textbook cycle:

```java
// Thread T1                    // Thread T2
synchronized (A) {              synchronized (B) {
    synchronized (B) {              synchronized (A) {
        // ...                          // ...
    }                               }
}                               }
```

The fatal interleaving:

| step | T1                    | T2                    | wait-for graph        |
|------|-----------------------|-----------------------|-----------------------|
| 1    | lock A ✓              |                       | T1 holds A            |
| 2    |                       | lock B ✓              | T2 holds B            |
| 3    | lock B … **blocks**   |                       | T1 → B (held by T2)   |
| 4    |                       | lock A … **blocks**   | T2 → A (held by T1)   |

Now the wait-for graph has a cycle: `T1 → B → T2 → A → T1`. Neither can proceed; both are BLOCKED forever.

```text
   holds A       wants B
 T1 ───────► [A]  [B] ◄─────── T2
    ◄─────── [B]  [A] ───────►
   wants B        holds A       →  CYCLE = deadlock
```

The bug isn't the locks — it's that **T1 acquires A-then-B while T2 acquires B-then-A**. If both acquired in the same order (say always A before B), step 4 could never form the cycle: whoever got the first lock would get the second, finish, and release. That's the entire justification for global lock ordering, coming next.

### Q3. How does global lock ordering prevent deadlock? Prove informally why it works.

**Global lock ordering**: define a single total order over all locks (`A < B < C < …`) and require every thread to acquire locks in **increasing** order, releasing in any order. Fix the Q2 example by making T2 also take A before B:

```java
// Both threads now acquire in the SAME order: A then B
synchronized (A) {
    synchronized (B) {
        // ...
    }
}
```

**Why it works (informal proof):** suppose a deadlock existed. Then there's a cycle `T1 → T2 → … → Tn → T1` where each Ti holds a lock and waits for the next's. But every thread acquires strictly in increasing order, so if Ti *holds* lock Lᵢ and *waits for* Lⱼ, then Lᵢ < Lⱼ. Following the cycle, the "waited-for" lock strictly increases at every hop — yet the cycle returns to the start, implying some lock is strictly less than itself. Contradiction. So **no cycle can form** — circular wait (Coffman #4) is eliminated by construction.

Practicalities: the order must be **global and stable** — often by a fixed rank field, or by comparing identity hash / an assigned ID when locks are dynamic (e.g. transferring between two accounts: always lock the lower account id first). The hard part is **transitive** ordering across modules and libraries you call while holding a lock — a callback that locks something "below" your held lock reintroduces the cycle. This is why "don't call foreign/alien code while holding a lock" is a standard rule.

### Q4. What if you can't impose a static lock order? (try-lock + backoff)

Sometimes locks are chosen dynamically and no natural total order exists (or the order isn't known until runtime). Use **try-lock with backoff**: attempt the second lock without blocking; if it fails, **release everything you hold**, back off a random interval, and retry the whole acquisition. This breaks **hold-and-wait** (you don't keep the first lock while stuck) and **no preemption** (you voluntarily give up).

```java
while (true) {
    a.lock();
    if (b.tryLock()) {           // don't block on the second lock
        try { /* critical section */ return; }
        finally { b.unlock(); a.unlock(); }
    }
    a.unlock();                  // release what we hold — break hold-and-wait
    Thread.sleep(random.nextInt(backoffMillis));  // avoid lockstep livelock
}
```

The critical detail is the **randomized backoff**. Without it, two threads can repeatedly grab their first lock, fail the second, release, and retry *in lockstep* — a **livelock** (busy, no progress). Randomized/exponential backoff desynchronizes them so one wins. This is exactly the Ethernet CSMA/CD strategy. Downsides vs static ordering: wasted work on retries, potential starvation of an unlucky thread, and you must make the critical section **retry-safe** (no committed side effects before both locks are held). Prefer static lock ordering when possible; use try-lock + backoff when it isn't (e.g. acquiring an unpredictable set of locks). Java's `ReentrantLock.tryLock(timeout)` and Rust's `try_lock` support this; plain `synchronized` cannot (it can't try-lock), which is one reason to use explicit `Lock`s where deadlock risk is real.

### Q5. How do deadlock detection and recovery work when you can't prevent it?

When prevention is impractical, **detect and recover** — the database/OS approach:

**Detection.** Maintain (or periodically build) the **wait-for graph** and look for a **cycle**. Databases do exactly this: a lock manager tracks "transaction T waits for lock held by T'," and a background detector runs cycle detection (DFS) on that graph. On a cycle, deadlock exists. Cheaper heuristics: **timeouts** — if a thread waits longer than a threshold, *assume* deadlock (may false-positive under mere contention, but simple).

**Recovery.** Break the cycle by **preempting a victim**:
- **Abort a transaction/thread** in the cycle and roll it back (DBs pick a *victim* — usually the one with least work done or fewest locks, to minimize wasted work — and return a "deadlock detected, transaction aborted" error; the client retries). This is why you write DB transactions to be **retry-safe**.
- **Force-release** a resource (rare in general threading — you usually can't safely yank a mutex mid-critical-section, which is why app code prefers prevention).

```text
detector: build wait-for graph → run cycle detection (DFS)
   cycle found → choose victim (min cost) → abort + rollback → others proceed
```

The tradeoff vs prevention: detection lets you run at full concurrency (no ordering constraints) and pay only when a deadlock actually happens, at the cost of building the graph and rolling back victims. Prevention (lock ordering) has zero runtime detection cost but constrains how you code. General-purpose app code favors **prevention**; databases favor **detection + victim rollback** because they already have rollback machinery and can't impose a global lock order on arbitrary user transactions.

### Q6. What is livelock? How is it different from deadlock, and how do you fix it?

**Livelock**: threads are **actively running and changing state in response to each other, but making no forward progress**. The classic image: two people meet in a hallway, both step left, both step right, both step left — politely blocking each other forever while *moving the whole time*.

Contrast with deadlock:

| | Deadlock | Livelock |
|---|---|---|
| Thread state | BLOCKED / WAITING (asleep) | RUNNABLE (busy) |
| CPU usage | idle | **high** (spinning) |
| In a thread dump | stuck on a lock, easy to spot | looks *healthy* — hard to spot |
| Cause | cyclic waiting | repeated mutual reaction / retry |

Concrete livelock: the try-lock + backoff of Q4 **without** randomized backoff — two threads lock A/B, each fails the second, both release and retry in perfect lockstep, forever. Or two threads in a message system each politely yielding to the other. Or a lock-free CAS loop where every thread's CAS keeps failing because others keep succeeding-then-being-undone.

**Fixes:** inject **asymmetry** so the symmetric dance breaks — **randomized/exponential backoff** (the standard cure), priorities, or a tiebreaker (lower-ID thread proceeds, higher yields). The essence: livelock is a **symmetry** problem; break the symmetry and someone makes progress. Because livelock burns CPU and *looks* like the system is working, it's often harder to diagnose than deadlock — watch for high CPU with zero throughput.

### Q7. What is starvation and what causes it? How does it relate to fairness?

**Starvation**: a thread is **perpetually denied** a resource it needs to progress, while *other* threads keep making progress. Unlike deadlock (a mutually-stuck set) or livelock (everyone stuck), starvation is **one loser in an otherwise-live system**.

Common causes:
- **Unfair locks.** A non-fair mutex hands the lock to whoever grabs it fastest — often the thread that just released it (cache-hot). Under load, a "barging" thread monopolizes it and a waiter never gets a turn.
- **Priority scheduling.** A low-priority thread never runs because higher-priority threads are always ready (this shades into priority inversion when a lock is involved).
- **Reader/writer imbalance.** A stream of readers holding a shared lock can starve a writer forever (see the readers-writers problem, next topic).
- **Resource pools.** A thread always losing the race for a connection/permit.

**Fairness** is the cure and the tradeoff. A **fair lock** (FIFO queue of waiters — `ReentrantLock(true)`, or `Semaphore(permits, true)`) guarantees no thread waits forever: bounded waiting. But fairness **costs throughput** — it forces the lock to hand off to the next-in-line even when a barging thread could have run immediately with a hot cache, causing more context switches. So the default is usually *unfair* (fast, may starve under pathological load); switch to fair when you have measured starvation or a latency SLO that a fat tail violates. The senior nuance: fairness trades **average throughput for tail latency / no-starvation guarantees** — a deliberate choice, not a free win.

### Q8. Explain priority inversion and tell the Mars Pathfinder story.

**Priority inversion**: a **high**-priority thread is blocked waiting on a lock held by a **low**-priority thread — and a **medium**-priority thread that needs no lock **preempts the low-priority holder**, so the low thread never runs to release the lock, so the high thread stays blocked *indefinitely by a medium-priority thread it should outrank*. Priorities are effectively inverted.

```text
H (high)  ──wants lock──► held by L
L (low)   ──holds lock, but is PREEMPTED by──► M
M (medium)──runs freely, no lock──────────────┘
Result: H waits on L, L can't run because M hogs CPU → H blocked by M. Inverted.
```

**Mars Pathfinder (1997).** The lander kept **resetting** on Mars — a watchdog timer fired, forcing a system reset and losing data. Root cause: a high-priority **bus management** task shared a mutex (VxWorks) with a low-priority **meteorological data** task. When a medium-priority **communications** task (long-running, no mutex) preempted the low-priority task *while it held the mutex*, the high-priority bus task blocked on that mutex, missed its deadline, and the watchdog reset the system. Classic priority inversion. JPL diagnosed it by reproducing on a replica on Earth (they'd left debugging/tracing enabled — a lesson in shipping observability), and **fixed it by enabling priority inheritance** on that mutex — uploaded a patch to a spacecraft on another planet. It's the canonical war story because it's real, subtle, high-stakes, and has a clean textbook fix.

### Q9. How do priority inheritance and priority ceiling protocols fix priority inversion?

Both make the **lock holder** run at a boosted priority so it can finish and release, un-blocking the high-priority waiter — attacking the "the holder gets starved by a medium thread" mechanism.

**Priority inheritance (PIP).** When a high-priority thread H blocks on a lock held by low-priority L, **L temporarily inherits H's priority** for as long as it holds that lock. Now L outranks the medium thread M, can't be preempted by it, finishes its critical section fast, releases the lock, and drops back to its base priority — H proceeds. Dynamic, reactive, only kicks in when contention actually happens. This is what fixed Pathfinder. Downside: chains of inheritance can get complex, and it doesn't prevent deadlock.

**Priority ceiling (PCP).** Each lock is assigned a **ceiling** = the priority of the highest-priority thread that will *ever* acquire it. A thread that takes the lock is immediately raised to that ceiling. This is proactive (boost on acquire, not on contention) and has a nice bonus: it **prevents deadlock** among these locks and bounds blocking to at most one critical section (important for hard real-time schedulability analysis). Downside: needs to know all users of a lock up front to compute ceilings.

```text
Priority Inheritance:  boost L to H's priority WHEN H blocks on L's lock (reactive)
Priority Ceiling:      boost holder to lock's precomputed ceiling ON acquire (proactive)
```

Rule of thumb: general-purpose RTOS/mutex code uses **priority inheritance** (POSIX `PTHREAD_PRIO_INHERIT`, VxWorks); hard real-time systems needing provable bounds and deadlock-freedom use **priority ceiling**.

### Q10. Given a hung service, how do you diagnose a deadlock from a thread dump?

Concrete on-call procedure:

**1. Capture the dump.** `jstack <pid>` (Java), `kill -3 <pid>` (dumps to stdout), or a JFR/async-profiler snapshot; `gstack`/`gdb` for native; `go` prints all goroutine stacks on `SIGQUIT`. Grab **two or three dumps a few seconds apart** — if stacks don't move, threads are truly stuck (deadlock), not just slow.

**2. Find BLOCKED threads and read the lock chain.** The JVM often does the work for you — `jstack` prints a **"Found one Java-level deadlock"** section listing the cycle. Manually, look for:

```text
"T1" ... BLOCKED
   waiting to lock <0x00007f...a> (a com.acme.Account)
   which is held by "T2"
"T2" ... BLOCKED
   waiting to lock <0x00007f...b> (a com.acme.Account)
   which is held by "T1"
```

That "waiting to lock X held by Y, and Y waiting to lock … held by X" is the **cycle** — the wait-for graph edges, printed. Match the `<0x...>` lock identities to close the loop.

**3. Confirm it's deadlock, not livelock or slow I/O.** Deadlock → threads BLOCKED/WAITING, **0% CPU**, stacks frozen across dumps. **High CPU + moving stacks + no progress** → livelock/spin. **Threads in `SocketRead`/`park` on a pool** with an empty pool → resource exhaustion/pool starvation, not a lock cycle.

**4. Root-cause & fix.** Identify the two lock-acquisition sites and their **order** — the fix is almost always to make them acquire in a consistent global order (Q3), or to shrink/eliminate the nested locking. Add the reproduction as a test.

The signal in an interview: you know deadlocked threads are **BLOCKED with idle CPU**, you read the "held by / waiting for" chain to find the cycle, and you take *multiple* dumps to distinguish a hang from mere slowness.

### Q11. Does a deadlock always involve two or more locks? Can one lock deadlock?

Deadlock needs a **cycle in the wait-for graph**, which classically needs ≥2 resources — but several single-lock or lock-adjacent hangs get called "deadlock":

- **Self-deadlock on a non-reentrant lock.** A thread acquires lock L, then (often via a recursive call) tries to acquire L again. A **non-reentrant** mutex blocks it — the thread waits for a lock it holds itself. One lock, one thread, deadlocked. **Reentrant** locks (`ReentrantLock`, `synchronized`, Rust `parking_lot::ReentrantMutex`) fix exactly this by counting recursion depth for the owning thread. (Plain `std::mutex` in C++ is *not* reentrant — re-locking is UB/deadlock; use `recursive_mutex` if you truly need it, though needing it is often a design smell.)
- **Missed signal / lost wakeup.** A thread `wait()`s on a condition that was already signaled before it started waiting — it sleeps forever. Not a lock cycle, but a permanent hang. Fix: always check the predicate in a `while` loop before waiting (guarded blocks).
- **Waiting on yourself.** A thread blocking on a future/latch that only *it* was supposed to complete.

So strictly, the *four-Coffman-condition circular-wait* deadlock needs ≥2 resources. But "my thread is hung forever" has single-lock causes too — non-reentrancy and lost wakeups being the common ones. A strong answer distinguishes the formal definition (cycle, ≥2 resources) from the practical family of permanent hangs, and names reentrancy as the single-lock culprit.

### Q12. Why is "just add a timeout to every lock" a bad general deadlock strategy?

Timeouts are a **detection/recovery** tool, not a **prevention**, and used naively they trade a clean deadlock for messier failures:

1. **They don't prevent the cycle — they just time out of it.** You still hit the deadlock; you just give up after N ms. That's better than hanging forever, but you've converted a hang into an *error you must handle everywhere*.
2. **Retrying in the same order → repeated deadlock or livelock.** If both threads time out and immediately retry acquiring in their original conflicting order, they can deadlock again, or ping-pong in lockstep (livelock). You need randomized backoff *and* ideally an order fix — at which point ordering alone would've solved it.
3. **False positives under mere contention.** A long-but-legitimate critical section can exceed the timeout, aborting work that wasn't deadlocked — flakiness and wasted rollback.
4. **Partial-work cleanup.** On timeout you must **release held locks and undo partial side effects** to retry safely; getting that wrong leaks locks or corrupts state.
5. **Tuning nightmare.** The "right" timeout is workload-dependent and drifts; too short → false aborts, too long → long hangs.

The senior stance: **prevent** with global lock ordering; use **try-lock/timeout + randomized backoff** only where a static order is genuinely impossible (dynamic lock sets), and treat timeout as a *safety net / detector*, not the primary strategy. Databases legitimately use timeout/detection + rollback — but they have transactional rollback machinery; app code usually doesn't.

### Q13. Why is calling foreign/alien code while holding a lock a deadlock risk?

Because you **lose control of what locks get acquired next**, which silently breaks your lock ordering and can form a cycle you can't see.

When you call an unknown callback, listener, virtual method, or library function **while holding lock L**, that code might:
- Acquire **another lock M** — and if elsewhere someone acquires M then L, you've created the A/B vs B/A cycle *transitively*, across module boundaries you never audited.
- **Call back into your object** (re-entrancy) and try to re-acquire L — self-deadlock if L is non-reentrant, or worse, re-enter an inconsistent, half-updated state.
- **Block** (I/O, wait on a future) indefinitely while holding L, causing a **lock convoy** — every other thread queues behind L, and your "quick" critical section becomes a system-wide stall.

```text
you:      lock L → call listener.onEvent()   // alien code
listener: lock M                             // now you hold L, want M
elsewhere: lock M → call you → lock L         // holds M, wants L  → CYCLE
```

The rule (from Java Concurrency in Practice / .NET guidance): **do the minimum inside the lock; never invoke alien code while holding a lock.** Compute what you need under the lock, **copy it out, release the lock, then call the callback** ("open call"). This keeps your lock ordering local and analyzable. It's also why UI frameworks and observer patterns are notorious deadlock sources — firing listeners under a lock. Recognizing this is a strong signal you've debugged real production deadlocks, not just the two-lock toy.

### Q14. Design a bank transfer between two accounts that never deadlocks.

The naive version deadlocks: transfer(A→B) locks A then B; a concurrent transfer(B→A) locks B then A — classic cycle. Fix by **imposing a global lock order** on accounts, e.g. by a unique account id:

```java
void transfer(Account from, Account to, long amount) {
    // Establish a total order: always lock the lower id first.
    Account first  = from.id < to.id ? from : to;
    Account second = from.id < to.id ? to   : from;
    synchronized (first.lock) {
        synchronized (second.lock) {
            from.debit(amount);
            to.credit(amount);
        }
    }
}
```

Now *every* transfer, regardless of direction, acquires locks in **ascending id order**, so no cycle can form (Q3's proof). Handle the edge cases in interview: (1) **`from.id == to.id`** (self-transfer or duplicate) — you'd deadlock re-locking the same lock if non-reentrant; guard with `if (from == to) return;` or use a reentrant lock. (2) **Equal ids on distinct objects** — fall back to a stable tiebreaker (`System.identityHashCode`, handling the rare collision with a third "gate" lock).

Alternative designs worth mentioning: **try-lock + backoff** (Q4) if you can't order; a **single coarse lock** over the whole account set (simple, low-concurrency, fine if transfers are rare); or **lock-free/optimistic** — read balances, compute, CAS both via an STM or a version check, retrying on conflict (no locks, no deadlock, but ABA/retry concerns). The expected answer is **lock ordering by id** — it's the canonical demonstration that you know how to make deadlock structurally impossible.

### Q15. How do you design a lock hierarchy for a whole system, and how do you enforce it?

**Design.** Assign every lock a **level (rank)** reflecting a layering of the system — coarse/outer locks get lower ranks, fine/inner locks higher, matching the natural call direction. The rule: a thread may only acquire a lock of a **strictly higher rank** than any lock it currently holds. This is global lock ordering generalized to a layered architecture: outer subsystem locks before inner, and never "upward." Group locks by subsystem, document the total (or partial) order, and design so call chains only ever descend the hierarchy.

**Enforce.** Ordering bugs are invisible until they deadlock in production, so make violations *loud*:
- **A tracking lock wrapper.** Keep a thread-local stack of currently-held lock ranks; on every acquire, assert the new rank > top-of-stack, else throw/log immediately — so the *offending acquisition* is caught, not the eventual hang. (jOOQ/Google's `CycleDetectingLockFactory` in Guava does exactly this; WebKit and the Linux kernel's **lockdep** do it at runtime, learning the observed order and flagging any inversion.)
- **Static analysis / annotations.** Clang Thread Safety Analysis (`GUARDED_BY`, `ACQUIRED_BEFORE`) checks lock order at compile time; similar linters exist for Java.
- **Tests + stress.** Run cycle-detecting lock factories under heavy concurrency in CI so an inversion trips a test, not a customer.
- **Discipline rules.** "No alien calls under a lock" (Q13), keep critical sections short, prefer a single lock per subsystem to shrink the hierarchy.

The mature answer: don't rely on humans to remember the order — **encode the rank and let a tool (lockdep-style runtime check or static analyzer) fail fast on inversion.** Prevention beats detection, and *enforced* prevention beats *documented* prevention.

## Classic Synchronization Problems

### Summary

**What this topic covers**

The canonical coordination puzzles every concurrency course and many interviews use, because each isolates one specific trap and has a known-correct solution. Three concern areas: (1) **producer-consumer / bounded buffer** — the foundational "hand work between threads without busy-waiting, blocking on full and empty" problem, solved with a monitor (mutex + two condition variables) or a `BlockingQueue`; (2) **readers-writers** — allowing concurrent readers but exclusive writers, and the **writer-starvation** trap plus its fair variants; and (3) the **coordination classics** — **dining philosophers** (the deadlock lab, with three deadlock-free solutions: resource ordering, an arbitrator, and limited seating), the **sleeping barber**, and the **cigarette smokers** problem. This topic has 15 questions. Each is framed as "here's the naive attempt, here's the trap it falls into, here's the correct solution" — because the *value* of these problems is that they teach a reusable failure pattern (lost wakeups, spurious wakeups, starvation, deadlock, the need to signal under the lock), not the whimsical story.

**Mental model**

Treat every classic problem as a **thin story wrapped around one hard synchronization idea** — solve the idea, not the fable. The recurring toolkit is the **monitor**: a mutex protecting shared state, plus **condition variables** on which threads `wait` for a predicate and `signal` when they change it. Three disciplines make monitor code correct and show up in *every* one of these problems: (1) **always wait in a `while` loop** re-checking the predicate, never an `if` — because of spurious wakeups and because another thread may invalidate the condition between your wakeup and your re-acquiring the lock; (2) **check-and-wait must be atomic under the lock** — releasing the lock and sleeping is one indivisible step (that's what `wait()`/`await()` gives you) or you get **lost wakeups**; (3) **signal the right waiters** — `notifyAll` is safe-but-costly, `notify`/`signal` is efficient-but-dangerous when waiters wait on different predicates. Once you see producer-consumer as "block on a predicate (not full / not empty)," readers-writers as "count readers, gate writers," and dining philosophers as "avoid a resource cycle," the stories dissolve into the same monitor mechanics plus a deadlock/starvation avoidance strategy.

**Key terms**

- **Bounded buffer** — a fixed-capacity queue between producers and consumers; producers block when full, consumers block when empty.
- **Producer-consumer** — the pattern of decoupling work generation from work processing via a shared buffer; the basis of thread pools and pipelines.
- **Monitor** — a mutex plus one or more condition variables; the standard structure for all these problems (`synchronized`+`wait`/`notify`, `Lock`+`Condition`, `std::condition_variable`).
- **Condition variable** — a queue of threads waiting for a predicate; `wait` atomically releases the lock and sleeps, `signal`/`notify` wakes one, `broadcast`/`notifyAll` wakes all.
- **Spurious wakeup** — `wait` returns without a corresponding signal; forces the `while`-loop predicate re-check.
- **Lost wakeup** — a signal fires before the waiter is waiting, and is missed forever; avoided by checking the predicate under the lock before waiting.
- **Readers-writers** — concurrent shared reads, exclusive writes; variants prioritize readers, writers, or fairness.
- **Writer starvation** — a continuous stream of readers prevents any writer from ever acquiring the lock (reader-preference readers-writers).
- **Dining philosophers** — N philosophers, N forks, each needs both neighbors' forks; the canonical deadlock/starvation problem.
- **Resource ordering** — assign forks/locks a global order and acquire in that order; breaks the philosophers' deadlock cycle.
- **Arbitrator / waiter** — a central authority that grants permission to pick up forks, serializing the risky step.
- **Sleeping barber / cigarette smokers** — coordination problems about efficiently waking the right party and avoiding deadlock from an over-clever signaling scheme.

**Why interviewers ask this**

These problems are a compact way to test whether you can **write correct monitor code under pressure** and whether you know the classic traps by name. The junior-vs-senior signal is sharp: a junior writes producer-consumer with an `if (full) wait();` and a `notify()`; a senior writes `while (full) await();`, explains *why the `while`* (spurious + stolen wakeups), knows to **signal under the lock**, and reaches for `notEmpty`/`notFull` **separate condition variables** (or `notifyAll`) to avoid waking the wrong party. Dining philosophers specifically tests whether you can *recognize a deadlock* (all grab left fork) and produce **more than one** deadlock-free fix with their tradeoffs (ordering = simple but can starve; arbitrator = no deadlock but a bottleneck; limited seating = elegant). Readers-writers tests whether you *volunteer* the writer-starvation problem before being asked. Getting these right signals you can be trusted with real coordination code; fumbling the `while` loop or lost-wakeup is a strong negative.

**Common confusions**

- "Use `if` to check the condition before `wait`" — **wrong; use `while`.** Spurious wakeups and stolen wakeups (another thread grabbed the resource between signal and your re-lock) mean the predicate must be re-checked after every wake.
- "`notify` and `notifyAll` are interchangeable" — `notify` wakes *one arbitrary* waiter; if waiters wait on different conditions in the same monitor, it can wake the wrong one and stall the system. Use `notifyAll`, or separate condition variables.
- "Signal, then take the lock" — you must hold the lock when changing the predicate and signaling (in most models), or you race into a **lost wakeup**.
- "Readers-writers is just a lock" — the trap is **starvation** (writers under reader-preference, readers under writer-preference); the interesting part is the fairness policy.
- "Dining philosophers is solved by picking up the left fork first" — that's the **deadlock**, not the solution. Everyone grabbing left → circular wait.
- "A `BlockingQueue` is cheating" — no; in production it's the *right* answer to producer-consumer. Hand-rolling the monitor is the *interview* exercise to prove you understand what the queue does internally.

**What follows from this topic**

These problems are the applied form of everything prior. Producer-consumer *is* the engine of the thread-pool/executor topic (the pool is producers submitting tasks to a bounded work queue that worker-consumers drain) and of channel/CSP pipelines (a buffered channel is a bounded buffer). Readers-writers connects to concurrent data structures (`ReadWriteLock`, `StampedLock`, copy-on-write) and to the lock-free/optimistic material (a `StampedLock` optimistic read is readers-writers without blocking readers). Dining philosophers is a direct application of the deadlock topic — resource ordering *is* global lock ordering, the arbitrator *is* coarse locking, and limited seating *is* a semaphore breaking hold-and-wait. Master these and you have concrete, reusable templates for real coordination code, plus the vocabulary to explain why a given design does or doesn't starve or deadlock.

### Q1. Solve the bounded-buffer producer-consumer problem. Show the full monitor solution.

A fixed-capacity buffer; producers block when it's **full**, consumers block when it's **empty**, no busy-waiting. Use a monitor: one lock, **two condition variables** (`notFull`, `notEmpty`):

```java
class BoundedBuffer<T> {
    private final Queue<T> q = new ArrayDeque<>();
    private final int capacity;
    private final ReentrantLock lock = new ReentrantLock();
    private final Condition notFull  = lock.newCondition();
    private final Condition notEmpty = lock.newCondition();
    BoundedBuffer(int cap){ capacity = cap; }

    void put(T item) throws InterruptedException {
        lock.lock();
        try {
            while (q.size() == capacity)   // WHILE, not if
                notFull.await();           // atomically releases lock + sleeps
            q.add(item);
            notEmpty.signal();             // wake a waiting consumer
        } finally { lock.unlock(); }
    }

    T take() throws InterruptedException {
        lock.lock();
        try {
            while (q.isEmpty())            // WHILE, not if
                notEmpty.await();
            T item = q.remove();
            notFull.signal();              // wake a waiting producer
            return item;
        } finally { lock.unlock(); }
    }
}
```

Four things to defend in an interview: (1) **`while` not `if`** — on wakeup, re-check the predicate (spurious wakeups; another consumer may have emptied the slot you were signaled about). (2) **`await()` atomically releases the lock and sleeps** — that atomicity is what prevents a lost wakeup between "check full" and "sleep." (3) **Two separate conditions** so a `put` wakes a *consumer* (`notEmpty`) and a `take` wakes a *producer* (`notFull`) — never the wrong party. (4) release the lock in **`finally`**. In production you'd just use `ArrayBlockingQueue` — this hand-roll is proving you know what it does inside.

### Q2. Why must you wait in a `while` loop, not an `if`? Show the bug an `if` causes.

Two independent reasons force the `while`:

**1. Spurious wakeups.** POSIX condition variables (and Java) are permitted to return from `wait` **without any signal**. If you used `if (empty) wait();`, a spurious wakeup falls through to `q.remove()` on an *empty* queue → exception/corruption. `while (empty) wait();` re-checks and goes back to sleep.

**2. Stolen / stale wakeups (the deeper reason).** Even with a real signal, the predicate can be **false again** by the time you re-acquire the lock. Interleaving with one item and two consumers waiting:

| step | Producer         | Consumer C1              | Consumer C2        | queue |
|------|------------------|--------------------------|--------------------|-------|
| 1    |                  | while empty → wait       | while empty → wait | 0     |
| 2    | put x; signal    |                          |                    | 1     |
| 3    |                  | wakes, must re-lock      |                    | 1     |
| 4    |                  | *(not yet locked)*       | (barges in) lock, take x | 0 |
| 5    |                  | acquires lock, resumes   |                    | 0     |

If C1 had used `if`, at step 5 it proceeds to `remove()` on an **empty** queue — C2 stole the item between the signal and C1 re-locking. With `while`, C1 re-checks `empty`, finds it true, and waits again. Correct. This is why the rule is absolute: **a condition wait is always inside a loop that re-tests the predicate.** `if` is the single most common concurrency bug in hand-written monitor code.

### Q3. When do you use `notify` vs `notifyAll` (signal vs broadcast)?

`notify`/`signal` wakes **one arbitrary** waiting thread; `notifyAll`/`broadcast` wakes **all** of them (they then re-contend for the lock and re-check predicates).

**Use `notifyAll` when** waiters in the same monitor may be waiting on **different predicates** and a single `notify` might wake a thread that can't proceed while leaving one that could **asleep** — a **lost wakeup** that can deadlock the system. Classic trap: a single-condition bounded buffer where both producers and consumers wait on the *same* condition variable. A `put` does `notify()`, which might wake **another producer** (still blocked on "full") instead of a consumer — the consumer that could have run stays asleep, and progress stalls. `notifyAll` avoids this by waking everyone; the wrong ones re-check and go back to sleep.

**Use `notify`/`signal` when** it's provably safe: **all waiters wait on the same predicate** and are interchangeable, and waking exactly one is enough (e.g., the two-condition-variable buffer of Q1, where `notEmpty.signal()` can *only* wake consumers). Then `notify` is far cheaper — `notifyAll` with N waiters causes a **thundering herd**: all wake, all contend for the one lock, all but one re-sleep, wasting context switches.

```text
notifyAll  → correct-by-default, but thundering herd (N wakeups, 1 proceeds)
notify     → efficient, but ONLY safe when all waiters are equivalent
best       → separate condition variables → signal exactly the right group
```

The senior move: prefer **separate condition variables per predicate** (Java `Condition`, which is why `Lock` beats intrinsic `synchronized` here) so you can `signal` precisely and cheaply, sidestepping the notify-vs-notifyAll dilemma entirely.

### Q4. What's a lost wakeup, and how does the monitor prevent it?

A **lost wakeup**: a signaler fires `notify` **before** the waiter has started waiting, so the waiter misses it and sleeps forever. The danger window is between a thread *checking the predicate* and *going to sleep* — if the signal lands in that gap and you weren't yet waiting, it's gone.

The buggy shape (releasing the lock, or checking without it, before sleeping):

```text
Consumer                         Producer
  sees queue empty
      ── window ──►               put(x); signal()   // signal lands here, no one waiting
  goes to sleep                                       // ...missed. Consumer sleeps forever.
```

The monitor prevents this with **two rules working together**:
1. **Hold the lock while checking the predicate AND while calling `wait`.** The producer must also hold the lock to modify the queue and signal — so it *cannot* run its `put`+`signal` while the consumer is between "check empty" and "sleep," because the consumer holds the lock the whole time.
2. **`wait()` atomically releases the lock and enqueues the thread as a waiter.** This is the crucial primitive: the release-and-sleep is indivisible. The consumer is *registered as waiting* at the exact instant it gives up the lock, so any subsequent signal (which needs the lock) will find it.

So the invariant is: **check the predicate and wait while holding the lock; signal while holding the lock.** Break either — e.g. `if (empty) { } lock.lock(); cond.await();` with a gap, or signaling without the lock in a model that requires it — and the wakeup can slip through. This is *why* `wait`/`await` must be called with the monitor held (Java throws `IllegalMonitorStateException` if you don't) — the API enforces the correctness rule.

### Q5. Solve readers-writers allowing concurrent readers. Where does it go wrong?

Allow **many concurrent readers** OR **one exclusive writer**. Naive reader-preference solution:

```java
class RWLock {
    private int readers = 0;
    private final ReentrantLock lock = new ReentrantLock();
    private final Condition canWrite = lock.newCondition();

    void startRead()  { lock.lock(); readers++; lock.unlock(); }
    void endRead()    { lock.lock(); if (--readers == 0) canWrite.signal(); lock.unlock(); }

    void startWrite() {
        lock.lock();
        while (readers > 0) canWrite.await();   // wait until no readers
        // (write exclusively; real impl also blocks new writers/readers)
    }
    void endWrite()   { canWrite.signal(); lock.unlock(); }
}
```

**Where it goes wrong: writer starvation.** This is **reader-preference** — a reader can `startRead()` any time `readers > 0` without waiting. So if readers keep arriving before the count hits zero, `readers` **never reaches 0**, a waiting writer's `while (readers > 0)` never falls through, and the **writer waits forever** even though it's been queued the whole time. Under a steady read load, writes are starved indefinitely.

This is the *point* of readers-writers as an interview problem: the obvious solution has a **starvation** bug, and recognizing/naming it before being prompted is the signal. The fix is a fairness policy (next question). In production, don't hand-roll: Java's `ReentrantReadWriteLock` (optionally fair), `StampedLock` (optimistic reads, no reader blocking at all), Go's `sync.RWMutex` (which already resolves a pending writer so readers can't starve it), or Rust's `RwLock`.

### Q6. How do you fix writer starvation in readers-writers? Compare the fairness variants.

Three standard policies, trading reader throughput against writer latency:

**Reader-preference (the starving one).** New readers join freely whenever any reader is active. Max read throughput, **starves writers**. Only acceptable when writes are rare and latency-insensitive.

**Writer-preference.** A **waiting writer blocks new readers** from starting — once a writer is queued, arriving readers wait behind it; the writer runs as soon as current readers drain. Prevents writer starvation, but a steady stream of writers can now **starve readers**. Implemented by tracking `waitingWriters` and gating `startRead` on it:

```text
startRead: while (activeWriter || waitingWriters > 0) canRead.await();
startWrite: waitingWriters++; while (activeReaders>0 || activeWriter) canWrite.await();
            waitingWriters--; activeWriter = true;
```

**Fair / FIFO (bounded waiting).** Serve readers and writers in **arrival order** (a queue). No one starves; a batch of readers that arrive together still run concurrently, but a writer that arrived first goes first. This is the balanced default (`ReentrantReadWriteLock(true)`), at some throughput cost from the ordering discipline.

| policy | starves | best when |
|---|---|---|
| reader-preference | writers | reads ≫ writes, writes latency-tolerant |
| writer-preference | readers | writes must be timely, reads tolerant |
| fair / FIFO | neither (bounded wait) | balanced / SLO on both |

Beyond fairness policies: **`StampedLock` optimistic reads** sidestep the whole conflict — readers grab a version stamp, read without locking, then validate; they never block writers and only retry if a write intervened (readers-writers meets optimistic concurrency). And **copy-on-write** (`CopyOnWriteArrayList`) makes reads lock-free entirely at the cost of expensive writes — ideal for read-mostly, rarely-written data.

### Q7. Present the dining philosophers problem and show why the naive solution deadlocks.

Five philosophers around a table, five forks, one between each pair. To eat, a philosopher needs **both** the fork on their left and the one on their right. They alternate thinking and eating. The naive solution: each philosopher picks up their **left** fork, then their **right** fork.

```java
void philosopher(int i) {
    while (true) {
        think();
        forks[i].lock();                 // left fork
        forks[(i + 1) % 5].lock();       // right fork
        eat();
        forks[(i + 1) % 5].unlock();
        forks[i].unlock();
    }
}
```

**The deadlock.** If **all five** pick up their left fork *simultaneously*, every fork is held, and each philosopher waits forever for their right fork — which is their neighbor's left fork.

| philosopher | holds (left) | waits for (right) |
|---|---|---|
| P0 | fork0 | fork1 (held by P1) |
| P1 | fork1 | fork2 (held by P2) |
| P2 | fork2 | fork3 (held by P3) |
| P3 | fork3 | fork4 (held by P4) |
| P4 | fork4 | fork0 (held by P0) |

That's a perfect **circular wait** — a cycle `P0→P1→P2→P3→P4→P0` in the wait-for graph — hitting all four Coffman conditions. This is *the* point of the problem: the intuitive symmetric solution deadlocks, and dining philosophers is a lab for the deadlock-prevention techniques. Three known-good fixes follow.

### Q8. Give three deadlock-free solutions to dining philosophers and their tradeoffs.

Each breaks a different Coffman condition:

**1. Resource ordering (break circular wait).** Number the forks; every philosopher picks up the **lower-numbered fork first**. This makes one philosopher (the one whose right fork is lower-numbered — e.g. P4, who'd grab fork0 before fork4) acquire in the *opposite* order, breaking the symmetry and thus the cycle. Equivalent to **global lock ordering** from the deadlock topic.

```java
int a = Math.min(i, (i+1)%5), b = Math.max(i, (i+1)%5);
forks[a].lock(); forks[b].lock();   // always lower fork first
```
Tradeoff: simple, no central coordinator, high concurrency. Can still allow **starvation** of an individual philosopher (not deadlock).

**2. Arbitrator / waiter (break hold-and-wait).** A central **waiter** grants permission to pick up forks; a philosopher must ask the waiter, who only allows a pickup if **both** forks are free — so no one ever holds one fork while waiting for the other. Equivalent to a coarse lock over the acquire step.
Tradeoff: trivially deadlock-free and starvation-free (waiter can enforce fairness), but the waiter is a **serialization bottleneck** — reduces parallelism.

**3. Limited seating (break hold-and-wait via a semaphore).** Allow **at most N-1 philosophers** (4 of 5) to sit/attempt to eat at once, using a counting semaphore with 4 permits. With at most 4 competing for 5 forks, **at least one** can always get both — deadlock impossible (pigeonhole).

```java
Semaphore seats = new Semaphore(4);
seats.acquire();  forks[i].lock(); forks[(i+1)%5].lock();
eat();
forks[(i+1)%5].unlock(); forks[i].unlock();  seats.release();
```
Tradeoff: elegant, decentralized, good concurrency; the semaphore is the only shared point. Widely considered the cleanest.

| solution | breaks | pro | con |
|---|---|---|---|
| resource ordering | circular wait | simple, no coordinator | possible starvation |
| arbitrator/waiter | hold-and-wait | no deadlock/starvation | central bottleneck |
| limited seating | hold-and-wait | elegant, parallel | needs the seat semaphore |

A fourth, **Chandy-Misra** (fork tokens with clean/dirty state), even guarantees fairness in a fully distributed way — worth a mention for staff-level. The interview win is producing **more than one** fix and stating what each trades.

### Q9. Even with the deadlock fixed, how can dining philosophers still starve a philosopher?

Fixing **deadlock** (no cycle) doesn't guarantee **fairness** — an individual philosopher can still be perpetually beaten to the forks:

- **Resource ordering** prevents the cycle, but a philosopher's two forks may be **continuously held** by their two neighbors in alternation. Every time this philosopher wants to eat, one of the needed forks is busy; they *never* get both simultaneously while the system as a whole keeps making progress (other philosophers eat). That's **starvation**, not deadlock — the rest of the table thrives.
- **Unfair locks** compound it: if `forks[i].lock()` is non-fair, a neighbor who just released and immediately re-requests can **barge** ahead of the philosopher who's been waiting.

The distinction to articulate: **deadlock** = a stuck *set*, no progress anywhere; **starvation** = one *individual* denied forever while others progress. Deadlock-freedom (liveness of the system) is weaker than starvation-freedom (liveness of *every* thread).

**Fixes for starvation specifically:** use **fair** locks/semaphores (FIFO waiter queues, `ReentrantLock(true)`) so a long-waiting philosopher eventually wins; the **arbitrator** can enforce fairness directly (grant in arrival order); or **Chandy-Misra**'s clean/dirty fork protocol, which is provably starvation-free. The lesson generalizes: when you "solve" a concurrency problem, ask **both** questions — can it deadlock? and can any single thread starve? — because the techniques for the two differ.

### Q10. Solve the sleeping barber problem. What's the trap?

**Setup:** a barbershop with one barber, one barber chair, and N waiting-room chairs. If no customers, the barber **sleeps**. A customer arriving: wakes the barber if asleep; sits in a waiting chair if the barber's busy but chairs are free; **leaves** if all chairs are full. The challenge is coordinating wake-ups and seat-counting without lost wakeups or races.

**The trap** is a **lost wakeup / race on the customer count**: a customer checks "is the barber asleep?" and, before it signals, the barber checks "any customers?" sees none, and goes to sleep — now the customer thinks it woke the barber but the barber is asleep, and both wait forever. It's the lost-wakeup problem (Q4) wearing a costume, plus a race on how many customers are waiting.

Clean semaphore solution: guard the shared `waiting` count with a mutex, and use two semaphores to hand off:

```java
Semaphore customers = new Semaphore(0);  // # customers ready for a haircut
Semaphore barber    = new Semaphore(0);  // barber ready to cut
Semaphore mutex     = new Semaphore(1);  // protects `waiting`
int waiting = 0;                          // customers in waiting room

void customer() {
    mutex.acquire();
    if (waiting < CHAIRS) {
        waiting++;
        customers.release();   // announce a customer (wake barber if sleeping)
        mutex.release();
        barber.acquire();      // wait for barber to be ready
        getHaircut();
    } else {
        mutex.release();       // shop full — leave
    }
}
void barber() {
    while (true) {
        customers.acquire();   // sleep here until a customer signals
        mutex.acquire(); waiting--; mutex.release();
        barber.release();      // signal the waiting customer
        cutHair();
    }
}
```

Why it's correct: the **`customers` semaphore counts pending customers**, so a signal that arrives before the barber waits isn't lost — the semaphore *remembers* it (unlike a bare condition variable), and the barber's `customers.acquire()` will pass immediately. The `mutex` makes the check-and-increment of `waiting` atomic so no two customers race the count or the full-shop decision. The general lesson: a **counting semaphore stores signals**, which is exactly the antidote to the lost-wakeup trap when a "wake" can precede the "wait."

### Q11. What does the cigarette smokers problem teach?

**Setup:** three smokers, each with an infinite supply of **one** ingredient (one has tobacco, one has paper, one has matches). An **agent** repeatedly places **two** random ingredients on the table. The smoker holding the **third** ingredient should grab the two, make a cigarette, and smoke. Constraint: the agent can't be modified, and you can't just have smokers grab ingredients greedily.

**The trap it teaches: deadlock from smokers grabbing the wrong ingredients.** If each smoker naively tries to pick up *whichever* ingredient it sees, you deadlock — e.g. the agent puts down tobacco and paper; the "matches" smoker should act, but if the "tobacco" and "paper" smokers each grab the *one* item they don't have and then wait for the second, they hold-and-wait in a cycle. Simple semaphores on each ingredient don't work because **you can't atomically wait for a specific *combination* of two signals** with one-ingredient-per-semaphore.

**The solution: an intermediary ("pusher") layer.** Instead of smokers watching raw ingredients, dedicated **pusher** threads watch the ingredient semaphores, track *which combination* is currently on the table via shared state under a mutex, and then signal the **one specific smoker** whose third ingredient completes the set. The pushers translate "two ingredients are present" into "smoker X, go" — turning an un-expressible "wait for this exact pair" into a single targeted signal.

The enduring lesson (Patil's point when he posed it): **semaphores alone can't conveniently express waiting on a conjunction of conditions** — you often need an extra coordination layer (a helper thread, or richer state under a monitor) to decode a *combination* of events into a single actionable wakeup. It's a caution against trying to encode complex "wait for A **and** B specifically" logic directly in a pile of independent semaphores; add an intermediary that computes the predicate and signals precisely.

### Q12. Design a thread pool's work queue as a producer-consumer problem.

A thread pool **is** producer-consumer: callers **produce** tasks by submitting them; the pool's **worker threads consume** by draining a shared **bounded work queue** and running each task. This reframes the entire executor around Q1's bounded buffer.

```text
submit(task) ─► [ bounded work queue ] ─► workerN.take() ─► task.run()
  producers        (BlockingQueue)          consumers (fixed pool)
```

The mapping and the design decisions it forces:
- **The buffer = the task queue.** Bounded (`ArrayBlockingQueue`) applies **backpressure**: when full, `submit` blocks (or the pool's **rejection policy** fires — `CallerRunsPolicy`, throw, drop). An *unbounded* queue is the classic footgun — it never blocks producers, so under overload it grows until OOM instead of pushing back. This is the producer-consumer "block when full" made real.
- **Workers = consumers** doing `while(running){ task = queue.take(); task.run(); }` — `take()` **blocks when empty** so idle workers sleep instead of busy-waiting (the "block when empty" half).
- **No busy-waiting, correct handoff** — exactly why you use a `BlockingQueue`/monitor, not a polled list.
- **Pool sizing** is the consumer-count knob (CPU-bound ≈ #cores; I/O-bound higher), and **queue capacity** is the buffer size — together they bound memory and latency.

The interview payoff: showing that `ThreadPoolExecutor` (core/max threads, a `BlockingQueue`, a rejection policy) is precisely the bounded-buffer producer-consumer pattern productized, with the rejection policy being the "buffer full" branch and backpressure being *why* you bound the queue. It also explains work-stealing pools as a variant: **per-worker deques** (many small buffers) instead of one shared queue, to cut contention on the single queue lock.

### Q13. In `wait`/`notify`, why must the shared state be modified under the same lock as the wait?

Because the **predicate check, the state that makes it true/false, and the wait/signal must all be serialized by one lock** — otherwise a modification can slip into the gap between a waiter checking the predicate and going to sleep, producing a **lost wakeup** (Q4).

Concretely, the waiter does, under lock L: check predicate → (false) → `wait()` (atomically releases L + sleeps). The signaler must, **also under lock L**: change the state → signal. If the signaler modified the state and signaled **without** holding L, this interleaving loses the wakeup:

```text
Consumer (holds L)                 Producer (NOT holding L)
  checks queue empty → true
       ── gap ──►                   q.add(x)          // modifies state w/o L
                                    cond.signal()     // signal — but consumer
  cond.await() (sleeps)                                //   isn't waiting yet → LOST
  ... sleeps forever
```

By requiring the producer to hold L to modify `q` and signal, the producer **cannot** run during the consumer's "gap" — the consumer holds L continuously from the check until `await()` atomically releases it. So any state change + signal is forced to happen either fully before the check (consumer sees the updated predicate, doesn't wait) or fully after `await()` has registered the consumer as a waiter (signal reaches it). No lost middle ground.

This is *why* Java mandates you hold the monitor to call `wait`/`notify` (else `IllegalMonitorStateException`), and why `pthread_cond_signal` is conventionally called with the mutex held. The rule in one line: **mutate the condition and signal under the same lock that guards the wait.** (Semaphores are exempt because they *count* — a `release` before an `acquire` is remembered, not lost — which is why the sleeping barber uses semaphores.)

### Q14. Bounded buffer with multiple producers and consumers — what breaks vs the single-pair case, and does it still work?

The Q1 monitor solution **already handles** many producers and many consumers correctly, *provided* you followed the two rules — which is exactly why they matter. Walk the multi-party stressors:

**What could break (and why the correct solution survives):**
- **`while` loop is now mandatory, not optional.** With multiple consumers, a `notEmpty.signal()` from one `put` can wake consumer C1, but C2 may **barge in and steal** the single item before C1 re-acquires the lock (the Q2 interleaving). Only the `while`-recheck saves C1 from `remove()`-ing an empty queue. In the single-consumer case an `if` might *accidentally* work; multi-consumer makes the `while` non-negotiable.
- **Signal precision matters more.** If you'd (wrongly) used **one** condition variable for both full and empty, a `put`'s `notify` could wake **another producer** instead of a consumer — with multiple producers now present, that wrong-party wakeup is common and stalls the system. Two condition variables (or `notifyAll`) fix it.
- **Lock still serializes the critical section**, so the queue's internal state (`size`, links) is never seen half-updated by concurrent `put`/`take` — the mutex is what makes N-to-M safe. There's no *new* data race introduced by adding parties.

**So: yes, it still works** — the monitor solution is inherently N-producers/M-consumers safe. That's the elegance: nothing about the code assumes a single pair. The scaling *concern* isn't correctness but **contention** — all producers and consumers serialize on one lock, so under high throughput that lock becomes the bottleneck. The production answer is a `LinkedBlockingQueue` (separate put/take locks — "two-lock queue") or a lock-free MPMC queue (Michael-Scott) to let producers and consumers proceed without contending on a single mutex. The interview signal: recognizing that the *correctness* was already handled by `while` + separate conditions, and the *only* multi-party issue is **contention/scaling**, addressed by splitting the lock.

### Q15. Which real-world primitive would you reach for instead of hand-rolling each classic problem?

The classics are *teaching* exercises; in production you use battle-tested primitives. The mapping every senior should have ready:

| Classic problem | Reach for (Java / general) |
|---|---|
| Producer-consumer / bounded buffer | `ArrayBlockingQueue` / `LinkedBlockingQueue`; Go **buffered channel**; `BlockingCollection` (.NET) |
| Readers-writers | `ReentrantReadWriteLock` (fair option), `StampedLock` (optimistic reads), Go `sync.RWMutex`, Rust `RwLock`; or **copy-on-write** for read-mostly |
| Dining philosophers (bounded resource contention) | Global **lock ordering** + `ReentrantLock`, or a `Semaphore` for limited seating; generally: acquire multiple locks in a canonical order |
| Sleeping barber (wake on work available) | A `BlockingQueue` (workers block on `take`), a thread pool, or a counting `Semaphore` |
| Cigarette smokers (wait on a combination) | A monitor/`Condition` computing the compound predicate, or an actor/channel select that decodes the combination |
| Rate/permit limiting | `Semaphore` (counting), a token-bucket limiter |
| One-time coordination / phases | `CountDownLatch`, `CyclicBarrier`, `Phaser`, `CompletableFuture` |

The rule: **don't hand-roll `wait`/`notify` in production.** The `java.util.concurrent` primitives (Doug Lea's) are correct, tested, and handle the `while`-loop, fairness, and lost-wakeup subtleties you'd have to re-derive — the whole point of these classic problems is to understand *what those primitives do inside* so you pick the right one and reason about its starvation/fairness/backpressure behavior. When an interviewer asks you to "implement producer-consumer," they want the monitor to prove understanding; when a code reviewer sees a hand-rolled monitor in a PR, they want a `BlockingQueue`. Know both, and know which context you're in.
## Thread Pools & Executors

### Summary

**What this topic covers**

Pools are the workhorse of server-side concurrency: instead of spawning a fresh OS thread per task, you keep a fixed set of worker threads pulling tasks off a queue. This topic covers *why* pooling exists (thread creation and context-switch cost, memory per thread), the anatomy of an executor (worker threads + a **work queue** + a **rejection policy**), **pool sizing** (CPU-bound vs IO-bound, Little's law, the classic formula), the full `ThreadPoolExecutor` parameter set (core/max/keepAlive/queue/rejection), the notorious **unbounded-queue OOM trap**, **fork-join & work-stealing** for divide-and-conquer parallelism, scheduled executors, the new **virtual-thread executors** (Project Loom), and how to shut a pool down cleanly. The 16 questions here move from "why pool at all" to "size a pool for this workload" to "design a work-stealing scheduler." This is the most *operationally* important concurrency topic — most production concurrency bugs are pool misconfigurations, not lock bugs.

**Mental model**

A thread pool is a **bounded resource in front of an unbounded demand**. Think of it as a restaurant: a fixed number of waiters (threads), a queue of waiting orders (the task queue), and a policy for what happens when both waiters and the waiting area are full (rejection). The two knobs that actually matter are **how many threads** and **how big the queue** — and they trade off against each other in a way most people get backwards. A big queue *hides* backpressure: tasks pile up invisibly, latency climbs, and if the queue is unbounded you eventually OOM instead of failing fast. A small (or zero) queue *surfaces* backpressure early: callers get rejected and can shed load. The right pool is one that (1) has enough threads to keep your bottleneck resource (CPU or downstream IO) saturated, and (2) has a bounded queue plus a rejection policy so overload degrades predictably instead of collapsing. Everything else — keep-alive, work stealing, scheduling — is refinement on those two decisions.

**Key terms**

- **Core pool size** — threads kept alive even when idle (the steady-state worker count).
- **Max pool size** — the ceiling; extra threads spawned only when the queue is full (for bounded queues).
- **Work queue** — where submitted tasks wait; bounded (`ArrayBlockingQueue`), unbounded (`LinkedBlockingQueue`), or synchronous handoff (`SynchronousQueue`).
- **keepAliveTime** — how long non-core threads linger idle before being reaped.
- **Rejection policy** — what a saturated pool does: `AbortPolicy` (throw), `CallerRunsPolicy` (run on caller — natural backpressure), `DiscardPolicy`, `DiscardOldestPolicy`.
- **CPU-bound vs IO-bound** — whether a task spends its time computing (needs ≈ #cores threads) or waiting (can use many more).
- **Little's law** — `L = λ × W`: concurrency needed = arrival-rate × service-time; the basis of pool sizing.
- **Work stealing** — idle workers steal tasks from the *tail* of busy workers' deques; the core of ForkJoinPool.
- **Fork/join** — recursively split a task, run subtasks in parallel, join results (divide and conquer).
- **Virtual threads** — JVM-scheduled lightweight threads (Loom); millions cheap, so you pool *tasks* differently or not at all.
- **Graceful shutdown** — stop accepting new work, drain in-flight tasks, then terminate (`shutdown` vs `shutdownNow`).

**Why interviewers ask this**

Pool sizing is the single most common concurrency question in backend interviews because it's where theory meets a pager. A junior answers "make the pool bigger for more throughput" — which is wrong for CPU-bound work (more threads than cores just adds context-switch overhead and cache thrash) and dangerous for IO-bound work if the queue is unbounded. A senior candidate reaches for Little's law, distinguishes CPU-bound from IO-bound, and — critically — asks about the **queue and rejection policy**, because they've been paged at 3am for an `Executors.newFixedThreadPool()` whose unbounded queue swallowed a traffic spike and OOM'd the JVM. The give-away senior signal is treating the pool as a load-shedding device, not just a speed-up device: "what happens when we're overloaded?" is the real question hiding inside "how do I size this pool?"

**Common confusions**

- "More threads = more throughput." Only up to the point your bottleneck saturates; past that, throughput *drops* from context-switching and contention.
- "`newFixedThreadPool` is safe." Its queue is **unbounded** — a load spike queues without limit until OOM. Always prefer an explicit `ThreadPoolExecutor` with a bounded queue.
- "maxPoolSize controls concurrency." With an unbounded queue, max is never reached — the queue fills first and threads never grow past core.
- "Fork/join is just a thread pool." It's a *work-stealing* pool tuned for recursive splitting; blocking IO inside it starves the common pool.
- "Shutdown kills running tasks." `shutdown()` lets in-flight tasks finish; only `shutdownNow()` interrupts them (and interruption is cooperative).
- "Virtual threads make pools obsolete." They remove the need to pool for *blocking IO*, but CPU-bound work still needs a bounded parallelism limiter.

**What follows from this topic**

Pools are the substrate the next two topics run on. **Futures, Promises & Async Composition** is about the *results* that pool-submitted tasks produce and how to compose them without blocking a worker. **Async/Await & Event Loops** is the alternative execution model — a tiny pool (often one thread per core) that never blocks, trading pooled blocking threads for cooperative coroutines. The rejection/backpressure theme here reappears there as "never block the event loop," and the sizing math (Little's law) is exactly what tells you when an event loop beats a thread pool.

### Q1. Why use a thread pool instead of creating a new thread per task?

Creating an OS thread is expensive in three ways, and a pool amortizes all three.

**Creation cost** — each `new Thread()` is a syscall that allocates a kernel thread and a stack (typically ~1MB reserved on the JVM). Spawning one per request means thousands of allocations under load; a pool creates its workers once and reuses them.

**Memory** — thread stacks dominate. 10,000 concurrent requests × 1MB = 10GB of stack alone. A pool caps live threads, so memory is bounded regardless of load.

**Scheduling overhead** — more runnable threads than cores means the OS time-slices between them, and every context switch flushes caches and TLBs. A pool sized near the core count keeps the CPU productive instead of shuffling.

The fourth, subtler win is **backpressure**: an unbounded thread-per-task model has no natural limit, so a traffic spike spawns unbounded threads and the box falls over. A pool's queue + rejection policy turns "spike" into "bounded latency then load-shed" instead of "crash." (Virtual threads change the memory/creation math — see Q15 — but not the backpressure argument.)

### Q2. How should you size a thread pool for CPU-bound vs IO-bound work?

The split hinges on how much time a task spends *waiting* vs *computing*.

**CPU-bound** (compression, hashing, in-memory transforms): threads ≈ **number of cores** (often `cores + 1` to cover the occasional page fault). More threads than cores can't run in parallel — they just context-switch and thrash caches, so extra threads *reduce* throughput.

**IO-bound** (DB calls, HTTP, disk): threads spend most of their life blocked, so you want *many more* threads than cores to keep the CPU busy while others wait. The formula:

```text
threads = cores × targetUtilization × (1 + waitTime / computeTime)
```

If a task spends 90% waiting and 10% computing, `waitTime/computeTime = 9`, so on 8 cores at 100% target you'd want ~80 threads. The ratio is what matters — measure it, don't guess.

**Little's law** gives the same answer from the demand side: `concurrency = arrivalRate × latency`. If 500 req/s each take 40ms downstream, you need `500 × 0.04 = 20` threads in flight to keep up. Size the pool to that, add headroom, and cap the queue.

The senior move: measure actual wait/compute ratio in production, and remember these are *different pools* — never share one pool between CPU-bound and blocking work.

### Q3. Walk through the ThreadPoolExecutor parameters and how a task flows through them.

```java
new ThreadPoolExecutor(
    corePoolSize,      // threads kept alive when idle
    maximumPoolSize,   // hard ceiling on threads
    keepAliveTime,     // idle timeout for non-core threads
    TimeUnit.SECONDS,
    workQueue,         // where tasks wait
    threadFactory,     // names, daemon flag, priority
    rejectionHandler); // what to do when saturated
```

The routing logic on `execute()` is the part people get wrong:

```text
1. threads < core?          -> start a new core thread, run task
2. else queue.offer(task)?  -> queued, a worker will pick it up
3. queue full & threads<max -> start a new (non-core) thread
4. else                     -> hand to rejection handler
```

The counter-intuitive consequence: **the queue is preferred over new threads**. With an *unbounded* queue, step 2 always succeeds, so steps 3–4 never fire and `maximumPoolSize` is dead config. That's why an unbounded queue quietly pins you at `corePoolSize` and hides overload. To actually use `max`, you need a bounded queue (or a `SynchronousQueue`, which has zero capacity so every task forces the thread/reject decision immediately).

### Q4. What are the rejection policies and when would you use each?

When the pool is saturated (queue full, threads at max), the `RejectedExecutionHandler` decides the fate of the task:

| Policy | Behaviour | Use when |
|---|---|---|
| `AbortPolicy` (default) | Throws `RejectedExecutionException` | Caller can handle failure / retry; you want a loud signal |
| `CallerRunsPolicy` | Runs the task on the **submitting thread** | You want automatic backpressure — the producer slows down because it's now doing the work |
| `DiscardPolicy` | Silently drops the task | Task is best-effort (metrics, cache warming) and loss is acceptable |
| `DiscardOldestPolicy` | Drops the oldest queued task, retries this one | Freshest data wins (e.g. live price ticks) |

`CallerRunsPolicy` is the quiet hero for backpressure: when the pool is full, the thread that *submits* work is forced to execute it, which stalls that thread's submission loop and naturally throttles the incoming rate — no separate rate limiter needed. The trap is if the caller is an event-loop or a request thread you can't afford to block; then abort-and-shed is safer.

### Q5. Why is Executors.newFixedThreadPool() considered dangerous in production?

Because its queue is **unbounded** (`LinkedBlockingQueue` with no capacity), which converts a load spike into an out-of-memory crash.

```text
Traffic spike: 10,000 req/s arrive, pool runs 8 at a time
  -> queue grows without limit: 9,992 ... 50,000 ... 500,000 tasks
  -> each queued task holds references (request, payload)
  -> heap fills -> OutOfMemoryError -> JVM dies
```

You never get backpressure or rejection — the queue absorbs everything until the heap is gone, and by then latency is minutes and you're dropping the *whole* JVM instead of shedding a few requests. `newCachedThreadPool` has the opposite failure: a `SynchronousQueue` + effectively unbounded max, so a spike spawns unbounded *threads* instead of unbounded queue entries — same crash, different resource.

The fix is to always construct `ThreadPoolExecutor` explicitly with a **bounded** queue and a rejection policy:

```java
new ThreadPoolExecutor(8, 8, 0L, TimeUnit.MILLISECONDS,
    new ArrayBlockingQueue<>(1000),          // bounded
    new ThreadPoolExecutor.CallerRunsPolicy()); // backpressure
```

Now overload = predictable rejection/throttling, not silent memory growth. This is the single most common concurrency production incident.

### Q6. Explain fork/join and work stealing. Why is a per-worker deque better than a shared queue?

Fork/join is for **recursive divide-and-conquer**: split a task into subtasks, fork them to run in parallel, then join their results.

```java
class SumTask extends RecursiveTask<Long> {
    protected Long compute() {
        if (hi - lo <= THRESHOLD) return sumDirectly();
        int mid = (lo + hi) >>> 1;
        SumTask left  = new SumTask(lo, mid);
        left.fork();                  // schedule async
        long r = new SumTask(mid, hi).compute(); // do right here
        return left.join() + r;       // wait for left
    }
}
```

The scheduling trick is **work stealing**. Each worker has its *own* double-ended queue (deque). It pushes and pops its own subtasks from the **head** (LIFO — great cache locality, the freshest subtask is hottest). When a worker runs dry, it **steals** from the **tail** of a *random busy worker's* deque (FIFO — the oldest, biggest, least-likely-to-be-contended task).

Why a deque beats one shared queue:

- **Low contention** — owner and thieves touch opposite ends, so the common case (owner pop from head) is lock-free/uncontended. A single shared queue is a hot lock every worker fights over.
- **Locality** — LIFO on your own tasks keeps recently-created data in cache.
- **Load balancing for free** — idle workers pull work toward themselves instead of a dispatcher pushing it.

The caveat: **never do blocking IO in a fork/join pool.** A blocked worker can't be stolen from, and the common pool has only `cores-1` threads by default — a few blocking tasks starve the whole pool. (`ManagedBlocker` exists but is rarely the right answer; use a separate pool for blocking work.)

### Q7. How do scheduled executors work, and what's the gotcha with scheduleAtFixedRate vs scheduleWithFixedDelay?

`ScheduledThreadPoolExecutor` runs tasks after a delay or periodically, backed by a **delay queue** (a priority queue ordered by next-run time). The two periodic modes differ in how they handle a slow task:

```text
scheduleAtFixedRate(task, 0, 10, SECONDS):
  fires at 0, 10, 20, 30...  measured from START of each run.
  If a run takes 15s, the next fires immediately (it's overdue),
  and runs can bunch up / overlap-serialize -> "catch-up" storms.

scheduleWithFixedDelay(task, 0, 10, SECONDS):
  waits 10s AFTER each run finishes.
  If a run takes 15s, next starts at 25s. No bunching, no catch-up.
```

**Fixed-rate** is for keeping a cadence (e.g. emit a heartbeat every second, tolerate drift). **Fixed-delay** is for "do X, rest, repeat" where overlap would be harmful (e.g. poll a slow endpoint). The classic bug: using fixed-rate for a task that occasionally runs longer than the period, then wondering why you get a thundering herd of catch-up executions after a slow one. Also note: an uncaught exception in a scheduled task **silently cancels all future runs** — always wrap the body in try/catch.

### Q8. What are virtual-thread executors (Project Loom) and how do they change pool sizing?

Virtual threads (Java 21+) are lightweight threads scheduled by the **JVM**, not the OS. A virtual thread is a small heap object with a resizable stack; when it blocks on IO, the JVM *unmounts* it from its carrier (platform) thread and mounts another — so a handful of OS threads multiplex millions of virtual threads.

```java
try (var exec = Executors.newVirtualThreadPerTaskExecutor()) {
    for (var req : requests)
        exec.submit(() -> handleBlocking(req)); // blocks freely, cheaply
}
```

What changes:

- **You stop pooling for blocking IO.** The whole reason to pool blocking threads was that OS threads are scarce. Virtual threads are cheap, so "thread per request" is fine again — one virtual thread per task, blocking calls and all. The pool *is* the task count.
- **Write blocking code, get async performance.** No callbacks, no `CompletableFuture` chains — plain sequential blocking code that scales like an event loop.
- **CPU-bound work still needs a limiter.** Virtual threads don't add cores; for CPU work you still cap parallelism (a semaphore or a fixed platform-thread pool).
- **Pitfalls:** `synchronized` blocks can **pin** a virtual thread to its carrier (blocking the carrier); prefer `ReentrantLock`. And thread-locals on millions of threads can bloat memory.

The mental shift: pools existed to ration OS threads; Loom makes OS threads no longer the scarce resource for IO, so the pool's job shrinks back to *just* limiting CPU parallelism.

### Q9. How do you shut down a thread pool gracefully without losing in-flight work?

`shutdown()` and `shutdownNow()` differ in what happens to work already in the system:

```java
pool.shutdown();               // stop accepting new tasks; let queued+running finish
if (!pool.awaitTermination(30, TimeUnit.SECONDS)) {
    List<Runnable> dropped = pool.shutdownNow(); // interrupt running, drain queue
    if (!pool.awaitTermination(10, TimeUnit.SECONDS))
        log.error("pool did not terminate");
}
```

The standard **two-phase drain**: call `shutdown()` (rejects new submissions, but running and queued tasks complete), wait a grace period, and if it doesn't finish call `shutdownNow()` (interrupts running threads and returns the never-started tasks so you can log/persist them). 

Two things people miss:

- **`shutdownNow` only *interrupts*** — it doesn't force-stop. A task that ignores `Thread.interrupted()` (e.g. a tight compute loop with no interrupt check) keeps running. Interruption is cooperative; your task code has to honour it.
- **You must `awaitTermination`** — `shutdown()` returns immediately; without the await, your process may exit or your resources close while workers are still draining.

For request-serving apps, wire this into the container's lifecycle hook (Spring `@PreDestroy`, a shutdown hook) so deploys drain rather than drop in-flight requests.

### Q10. What's the difference between submit() and execute(), and where do exceptions go?

`execute(Runnable)` is fire-and-forget: it returns void, and an **uncaught exception propagates to the thread's `UncaughtExceptionHandler`** (by default printing a stack trace and killing that worker, which the pool then replaces).

`submit(Callable/Runnable)` returns a `Future`, and here's the trap: **an exception thrown by the task is *captured* inside the Future, not thrown or logged.** It stays silent until someone calls `future.get()`, which then throws it wrapped in `ExecutionException`.

```text
execute(() -> { throw new RuntimeException(); })
   -> stack trace on stderr, worker dies & is replaced (loud)

submit(() -> { throw new RuntimeException(); })
   -> exception stored in Future, NOTHING printed (silent!)
   -> only surfaces if/when you call future.get()
```

This is a real bug source: teams switch `execute` to `submit`, stop checking the returned Futures, and suddenly errors vanish. If you `submit` fire-and-forget work, either always `get()` the result, or override `afterExecute()` / attach a handler to surface the swallowed exception. For scheduled tasks the same rule bites harder — a swallowed exception cancels all future runs.

### Q11. Why should you never share one thread pool between blocking and CPU-bound work? (bulkheading)

Because a slow/blocked workload will **starve** the fast one, and one dependency's outage takes down unrelated features. The fix is **bulkheading** — separate pools per workload class, like watertight compartments in a ship.

```text
Shared pool (8 threads):
  Downstream service X hangs. 8 requests to X block all 8 threads.
  Now unrelated CPU-bound work (auth, rendering) can't get a thread.
  One slow dependency -> whole service unresponsive.

Bulkheaded:
  pool-io-serviceX  (bounded, e.g. 20)  <- X hangs, only this saturates
  pool-io-serviceY  (bounded)           <- unaffected
  pool-cpu          (= #cores)          <- unaffected
```

Isolation gives you (1) **failure containment** — a hung dependency saturates only its own pool and gets rejected there; (2) **correct sizing** — CPU pools want ≈ cores, IO pools want the wait/compute-ratio count, and one pool can't satisfy both; (3) **clear backpressure** — each pool's bounded queue + rejection sheds load for just that dependency. This is the resilience pattern behind Hystrix/resilience4j bulkheads.

### Q12. What is a thread pool deadlock, and how do dependent tasks cause it?

A pool deadlocks when tasks in the pool **wait on results from other tasks that can't get a thread** because the pool is full of waiters.

```text
Pool size = 2.
Task A (thread 1): submits Task A' to same pool, blocks on A'.get()
Task B (thread 2): submits Task B' to same pool, blocks on B'.get()
Queue: [A', B']  -- but both threads are blocked waiting.
No thread free to run A' or B'. Deadlock forever.
```

This is **thread starvation deadlock**: the pool has no free worker to run the subtasks the current workers depend on. It's insidious because it only triggers when the pool happens to fill with *dependent parent* tasks — works fine under light load, deadlocks under a specific spike.

Fixes: (1) **never submit-and-block within the same pool** — use `thenCompose`/`CompletableFuture` composition so the parent doesn't hold a thread while waiting; (2) use a pool that understands dependencies (ForkJoinPool's `join` can help run pending work); (3) size the pool larger than the max dependency depth (fragile — prefer the first two). The general principle: blocking a pooled thread on another pooled task is the recipe.

### Q13. What is thread confinement and how does ThreadLocal fit thread pools?

**Thread confinement** is achieving thread-safety by ensuring an object is only ever touched by one thread — no sharing means no synchronization needed. `ThreadLocal` is the API for it: each thread gets its own independent copy of a variable (classic uses: `SimpleDateFormat` which isn't thread-safe, per-request context, DB connections).

The pool-specific gotcha: **pooled threads are reused**, so a `ThreadLocal` set during one task is *still there* when the same worker runs the next, unrelated task.

```text
Task 1 on worker-3: threadLocal.set(userA)  ... forgets to clear
Task 2 on worker-3: threadLocal.get() -> userA  (WRONG user!)
```

This causes two bugs: (1) **data leakage / wrong-tenant** — one request sees another's context; a genuine security bug in multi-tenant systems; (2) **memory leaks** — the value is pinned for the life of the (long-lived) worker thread. Always clear in a finally:

```java
try { ctx.set(user); handle(req); }
finally { ctx.remove(); }   // critical on pooled threads
```

Frameworks that propagate context across async boundaries (MDC, `Scoped Values` in modern Java) exist precisely because naive ThreadLocal + pools + async hand-offs lose or leak context.

### Q14. How do you design a bounded work-queue with backpressure from scratch?

The core is a **bounded blocking queue** plus a decision for what producers do when it's full — that decision *is* your backpressure policy.

```java
// bounded queue: producers block when full, consumers block when empty
BlockingQueue<Task> q = new ArrayBlockingQueue<>(1000);

// Producer choice when full:
q.put(task);                       // BLOCK the producer (natural backpressure)
boolean ok = q.offer(task);        // REJECT immediately (shed load)
q.offer(task, 100, MILLISECONDS);  // wait a bit, then reject (bounded wait)

// Consumer:
Task t = q.take();                 // block until work available
```

The whole design is the two choices: **bounded capacity** (so memory can't blow up) and **producer-full behaviour** (`put` = block/slow the source; `offer` = reject/shed). Blocking is right when the producer *can* slow down (a batch reader); rejecting is right when it can't (inbound network requests you must answer fast — reject with 503).

Beyond that: use `SynchronousQueue` (capacity 0) for direct hand-off when you want zero buffering; add a **watermark** (resume producing only when the queue drains below, say, 25%) to avoid thrashing at the boundary; and for multi-stage pipelines, bound *every* stage so backpressure propagates upstream from the slowest stage. This is exactly what `ThreadPoolExecutor` gives you out of the box (bounded queue + rejection handler) — hand-rolling it is only for custom pipelines.

### Q15. Compare platform-thread pools, virtual threads, and event loops as concurrency models. When does each win?

Three ways to handle many concurrent tasks, trading off differently:

| | Platform-thread pool | Virtual threads (Loom) | Event loop (async/await) |
|---|---|---|---|
| Unit cost | ~1MB stack, OS-scheduled | ~KB heap, JVM-scheduled | one stack frame / state machine |
| Max concurrency | thousands | millions | millions |
| Blocking IO | wastes a scarce thread | fine — unmounts on block | forbidden — blocks everything |
| Code style | blocking, sequential | blocking, sequential | callbacks / async-await |
| CPU-bound | good (= cores) | still need a limiter | bad (one thread stalls loop) |
| Best for | mixed/CPU work, pre-Java 21 | high-concurrency blocking IO in Java | high-concurrency IO in Node/Python/Go-style |

**Platform pool** wins for CPU-bound work and remains the pragmatic default before Java 21. **Virtual threads** win when you have huge IO-bound concurrency *and* want to keep simple blocking code (the sweet spot Loom was built for). **Event loops** win in single-threaded runtimes (Node, Python asyncio) and when you want the lowest per-task memory — at the cost of the "colored function" tax and the absolute rule that you never block the loop. The convergence: virtual threads let the JVM give you event-loop-like scaling *without* the async programming model — the runtime does the unmounting the event loop made you do by hand. This directly sets up the next two topics.

### Q16. Your service's latency spikes and thread dumps show most pool threads BLOCKED on the same lock/downstream. What's happening and how do you fix it?

This is **pool exhaustion via a slow dependency**, the most common production concurrency incident. The chain:

```text
Downstream DB/service slows from 20ms -> 2s
  -> each request holds its pool thread 100x longer
  -> Little's law: needed threads = arrivalRate × latency shoots up
  -> pool fills, queue fills, new requests rejected/timeout
  -> even requests NOT touching the slow dependency are starved
  -> whole service looks down, though only one dependency is slow
```

Thread dump signature: dozens of workers all `BLOCKED`/`WAITING` at the same stack frame (a socket read, a lock acquire). That co-location is the tell — it's not random contention, it's one bottleneck.

The fixes, in order of leverage:

1. **Bulkhead** — give the slow dependency its own bounded pool so its saturation can't starve everything else (Q11).
2. **Timeouts everywhere** — a call with no timeout can hold a thread forever; bound it so threads recycle.
3. **Circuit breaker** — after N failures/timeouts, fail fast instead of queueing more doomed calls (stops the pile-up).
4. **Backpressure/shedding** — bounded queue + reject (503) so you degrade instead of collapse.
5. **Longer term:** virtual threads remove the "thread is the scarce resource" failure mode for the blocking case, though you still want timeouts and circuit breakers.

The senior framing: the root cause isn't the pool — it's an unbounded wait on a dependency with no isolation. The pool just makes the blast radius the whole service.

## Futures, Promises & Async Composition

### Summary

**What this topic covers**

A future/promise is a **placeholder for a value that isn't ready yet** — a handle to an in-flight computation. This topic covers the future-vs-promise distinction (read side vs write side), the two ways to *use* a future — **blocking `get()`** vs **non-blocking composition** — and why the second is what makes async code scale. It covers **callback hell** and how combinators (`thenApply`, `thenCompose`, `thenCombine`, `allOf`/`anyOf`; JS `Promise.all`/`race`) flatten it; **error propagation** through async chains, **timeouts**, and **cancellation**; concrete `CompletableFuture` and JS `Promise` examples; the **fan-out/fan-in** pattern; and an intro to **structured concurrency**, which fixes the scoping and leak problems futures introduce. The 16 questions run from "what is a future" to "compose these five async calls with timeouts and cancellation" to "why is structured concurrency better than raw futures." This topic is the bridge between "I have a thread pool" (previous topic) and "I never block a thread" (next topic).

**Mental model**

A future is a **box that will eventually contain a value (or an error)**. The whole art is: *don't open the box by blocking on it — instead, describe what to do once it's full, and hand that description back to the runtime.* Blocking `get()` throws away the entire benefit: you've turned an async computation back into a synchronous wait, tying up a thread that could be doing other work. Composition (`thenApply`, `thenCompose`) is the opposite — you attach a continuation that fires *when the value arrives*, and your thread moves on. Think of it as building a **dependency graph of computations** up front: "when A and B are both done, combine them; when that's done, transform it; if anything fails, route to this handler." You declare the graph, the runtime executes it as results trickle in, and no thread is ever parked waiting. The failure everyone makes is treating a future like a value you can just read — you can, but the moment you do, you're back to blocking-thread concurrency.

**Key terms**

- **Future** — the *read* side: a handle you observe/await for a result. (Java's original `Future` is blocking-only.)
- **Promise** — the *write* side: the producer's handle to *fulfill* or *reject* the future. (JS merges both; Java's `CompletableFuture` is both.)
- **Combinator / continuation** — a function attached to run when the future completes (`thenApply`, `.then`).
- **thenApply vs thenCompose** — `map` (returns a plain value) vs `flatMap` (returns another future — avoids nesting).
- **thenCombine** — join two independent futures into one when both complete.
- **allOf / anyOf (Promise.all / race)** — wait for *all* / the *first* of many futures.
- **Callback hell** — deeply nested callbacks; the pyramid-of-doom that combinators exist to flatten.
- **Error propagation** — a failure short-circuits the chain to the nearest handler (`exceptionally`/`handle`, `.catch`).
- **Cancellation** — signalling a future's work to stop (`cancel`, `AbortController`, cooperative).
- **Fan-out / fan-in** — launch N async tasks in parallel (out), aggregate their results (in).
- **Structured concurrency** — child tasks are scoped to a parent; the parent doesn't return until all children finish or are cancelled.
- **Completion stage** — Java's interface for a step in an async pipeline (`CompletableFuture` implements it).

**Why interviewers ask this**

Because async composition is where "knows the API" separates from "understands the model." A junior writes `future.get()` in the middle of a request handler — technically correct, silently blocking a thread and defeating the point. A senior builds a non-blocking pipeline, handles the error and timeout paths (which juniors forget entirely — the happy path is easy, the failure path is the job), and knows the `thenApply` vs `thenCompose` distinction cold because getting it wrong gives you a `CompletableFuture<CompletableFuture<T>>`. The deepest signal is whether the candidate reaches for **structured concurrency** or at least worries about the leaks raw futures cause: an orphaned future whose failure no one observes, a fan-out where one failure should cancel the siblings but doesn't. Anyone can chain a `.then`; the interview is about the error, timeout, and cancellation edges.

**Common confusions**

- "Future and promise are the same." They're the read side and the write side; JS/`CompletableFuture` merge them, but conceptually a promise *produces* what a future *consumes*.
- "`thenApply` and `thenCompose` are interchangeable." Use `thenApply` for sync transforms; if your function itself returns a future, you *must* use `thenCompose` or you get nested futures.
- "`get()` is how you use a future." Blocking `get()` is the escape hatch, not the tool — it re-serializes async work.
- "Exceptions propagate like sync try/catch." They short-circuit to `exceptionally`/`.catch`, but an *unobserved* future can swallow the error entirely.
- "`Promise.all` fails fast and cancels the rest." It *rejects* on the first failure, but the other promises **keep running** — JS promises aren't cancellable by default.
- "Async means parallel." Composing futures on a single-threaded event loop is concurrent, not parallel; parallelism needs multiple threads/cores underneath.

**What follows from this topic**

Futures are the *result* abstraction; the next topic, **Async/Await & Event Loops**, is the *syntax and runtime* that make composing them ergonomic — `async/await` is largely syntactic sugar over the `CompletableFuture`/`Promise` chains here, desugared into a state machine. The "never block on `get()`" rule becomes "never block the event loop." Structured concurrency, introduced here, is the through-line to safe cancellation and to Go's goroutine+channel model. And the fan-out/fan-in pattern is the async twin of the fork/join parallelism from the Thread Pools topic.

### Q1. What's the difference between a future and a promise?

They're the two ends of the same pipe: a **future is the read side, a promise is the write side.**

- **Future** — a *read-only* handle to a result that will exist later. You can await it, attach callbacks, check if it's done — but you can't *set* its value. The consumer holds this.
- **Promise** — the *writable* handle the producer keeps. The producer calls `resolve(value)` or `reject(error)` on the promise, which fulfills the future observing it.

```text
producer ──holds──> Promise ──(resolve/reject)──┐
                                                 ▼
consumer ──holds──> Future  <──(observes result)─┘
```

The catch: languages split this differently. **JavaScript** merges them — a `Promise` is both (you construct it with an executor that gets `resolve`/`reject`, and you `.then()` the same object). **Java's original `Future`** is read-only and blocking (only `get()`), with no write side exposed. **`CompletableFuture`** is Java's unified type — it's both a future you compose *and* a promise you can `complete(value)` manually. **C++** cleanly separates `std::future` (read) from `std::promise` (write). The interview point: know that "promise" implies the producer can fulfill it, and a raw "future" may be observe-only.

### Q2. Why is blocking on get() an anti-pattern, and what should you do instead?

Because `get()` **converts async work back into a blocked thread**, throwing away the reason you went async.

```java
// ANTI-PATTERN: thread parks here doing nothing until result arrives
User u = userFuture.get();        // blocks
Order o = orderFuture.get();      // blocks again, serially
render(u, o);
```

On a thread-pool worker this ties up a scarce thread; on an event loop it's catastrophic (freezes *everything*). And chaining `get()` calls **serializes** work that could overlap — the two calls above run back-to-back instead of concurrently.

The fix is **composition** — describe the continuation and return, so no thread waits:

```java
userFuture.thenCombine(orderFuture, (u, o) -> render(u, o))
          .thenAccept(this::send);
// this thread returns immediately; render fires when BOTH are ready,
// and the two fetches overlap
```

Now the fetches run concurrently, nothing blocks, and the "then" fires on a pool thread when inputs are ready. The rule of thumb: `get()`/`join()` belongs only at the very edge of the program (a `main`, a test, or a boundary you've deliberately chosen to be synchronous), never in the middle of a pipeline.

### Q3. What is callback hell and how do combinators solve it?

Callback hell (the "pyramid of doom") is what happens when async steps depend on each other and you express the dependency by *nesting* callbacks:

```js
getUser(id, (err, user) => {
  if (err) return handle(err);
  getOrders(user, (err, orders) => {
    if (err) return handle(err);
    getShipping(orders, (err, ship) => {
      if (err) return handle(err);       // error handling repeated everywhere
      render(user, orders, ship);        // creeping ever rightward
    });
  });
});
```

Problems: it marches rightward indefinitely, error handling is duplicated at every level (and easy to forget one), and you can't easily run independent steps in parallel.

Combinators flatten it into a **linear chain** where each step returns a future and errors funnel to one handler:

```js
getUser(id)
  .then(user   => getOrders(user).then(orders => ({user, orders})))
  .then(({user, orders}) => getShipping(orders)
        .then(ship => render(user, orders, ship)))
  .catch(handle);   // ONE error path for the whole chain
```

`async/await` (next topic) makes it read like sync code — but under the hood it's exactly this combinator chain. The key wins: one error handler, no rightward drift, and combinators like `Promise.all` let you fan out independent steps in parallel instead of nesting them.

### Q4. Explain thenApply vs thenCompose vs thenCombine.

They're `map`, `flatMap`, and `zip` for futures — the distinction is what your function returns.

**`thenApply`** — transform the value with a **synchronous** function (`T -> U`). It's `map`.

```java
cf.thenApply(user -> user.getName());   // CompletableFuture<String>
```

**`thenCompose`** — your function itself returns a **future** (`T -> CompletableFuture<U>`); `thenCompose` flattens it. It's `flatMap`. Use this for *dependent* async calls (B needs A's result).

```java
// WRONG: thenApply gives CompletableFuture<CompletableFuture<Order>>
cf.thenApply(user -> fetchOrders(user));       // nested! 
// RIGHT: thenCompose flattens to CompletableFuture<Order>
cf.thenCompose(user -> fetchOrders(user));
```

**`thenCombine`** — join **two independent** futures when both complete (`(T,U) -> V`). It's `zip`. Use for parallel calls whose results you merge.

```java
userCF.thenCombine(accountCF, (user, acct) -> new Profile(user, acct));
```

The mnemonic: `thenApply` if the function returns a *plain value*, `thenCompose` if it returns *another future*, `thenCombine` to *merge two* futures. The single most common bug is using `thenApply` where the mapper returns a future, producing a `CompletableFuture<CompletableFuture<T>>` that never seems to complete.

### Q5. How do you run N async calls in parallel and wait for all of them (fan-out/fan-in)?

**Fan-out**: launch all N calls without awaiting each (so they overlap). **Fan-in**: aggregate once all complete.

```java
List<CompletableFuture<Price>> futures = symbols.stream()
    .map(s -> fetchPriceAsync(s))          // fan-out: all fire concurrently
    .collect(toList());

CompletableFuture<Void> all = CompletableFuture.allOf(
    futures.toArray(new CompletableFuture[0]));

CompletableFuture<List<Price>> result = all.thenApply(v ->
    futures.stream().map(CompletableFuture::join)  // join is safe: all done
           .collect(toList()));                     // fan-in
```

```js
const results = await Promise.all(symbols.map(fetchPrice)); // JS equivalent
```

The critical detail: **build the whole list of futures first, then `allOf`**. If you `join()` inside the map, you serialize them (each waits before the next starts) — the exact bug Q2 warns about. `allOf` returns `Void`, so after it completes you re-collect by `join`ing each (now non-blocking since all are done).

Failure semantics matter: `allOf` completes exceptionally if *any* future fails, but the **others keep running** — there's no automatic sibling cancellation. If you want "fail one, cancel the rest," that's structured concurrency (Q13). For "take the first," use `anyOf` / `Promise.race`.

### Q6. How does error propagation work through an async chain?

An exception **short-circuits** the chain — subsequent `thenApply`/`thenCompose` steps are *skipped* — and flows to the nearest error handler, mirroring sync try/catch but across async boundaries.

```java
fetchUser(id)                         // throws -> skip next two steps
    .thenApply(this::enrich)          // skipped
    .thenCompose(this::loadOrders)    // skipped
    .exceptionally(ex -> fallbackUser())   // catches, provides recovery value
    .thenAccept(this::render);        // resumes with recovered value
```

The handler choices:

- **`exceptionally(fn)`** — runs only on failure, returns a recovery value (like `catch` that substitutes a default).
- **`handle((val, ex) -> ...)`** — runs on *both* success and failure; you inspect which happened. Good for logging + transforming.
- **`whenComplete((val, ex) -> ...)`** — side-effect on completion (both paths) but *doesn't* alter the result — the exception still propagates.

```js
fetchUser(id).then(enrich).then(loadOrders)
  .catch(err => fallbackUser());   // JS: one catch for the whole chain
```

The dangerous gotcha: a wrapped `CompletionException`/`ExecutionException` — exceptions get wrapped as they cross stages, so unwrap with `ex.getCause()`. And the silent killer: an **unobserved** future — if nothing attaches a handler or awaits it, a thrown exception vanishes with no log (JS at least warns on unhandled rejection; Java doesn't).

### Q7. How do you add a timeout to a future, and why is it essential?

Because an async call with no timeout can hang **forever**, holding resources and cascading into pool exhaustion. Every network-bound future needs a bound.

```java
// Java 9+: built-in
cf.orTimeout(2, TimeUnit.SECONDS);                 // fail with TimeoutException
cf.completeOnTimeout(fallback, 2, TimeUnit.SECONDS); // or resolve to a default
```

```js
// JS: race the work against a timer
const withTimeout = (p, ms) => Promise.race([
  p,
  new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))
]);
await withTimeout(fetchUser(id), 2000);
```

The JS pattern reveals the mechanism: `Promise.race` resolves/rejects as soon as the *first* settles — pit the real work against a timer, and whichever wins decides. 

The senior nuances: (1) a timeout **doesn't cancel the underlying work** by default — the original request keeps running, still consuming a connection/thread; you often want to *also* cancel (Q8) to reclaim it. (2) Layer timeouts with retries and circuit breakers carefully — a 2s timeout with 3 retries is a 6s worst case, which may exceed the *caller's* timeout. (3) Prefer timeouts at the client/connection layer too, so the socket actually closes.

### Q8. How does cancellation work, and why is it hard?

Cancellation signals a future's underlying work to stop — but it's **cooperative** and inconsistently supported, which is why it's a classic senior gotcha.

```java
boolean cancelled = future.cancel(true);   // mayInterruptIfRunning
```

The trap in Java: `CompletableFuture.cancel()` completes the future with a `CancellationException` **but does not interrupt or stop the running task** — the computation keeps going, its result simply discarded. Real cancellation requires the task to *check* a flag or respond to interruption:

```java
while (!Thread.currentThread().isInterrupted()) { ...work... } // cooperative
```

JavaScript is worse: **native Promises aren't cancellable at all.** The idiom is `AbortController`:

```js
const ctrl = new AbortController();
fetch(url, { signal: ctrl.signal });   // passes cancellation into fetch
ctrl.abort();                          // fetch rejects with AbortError
```

Go models it cleanly with `context.Context` — a cancellation signal you thread through call chains, and every blocking op selects on `ctx.Done()`.

Why it's hard: (1) you can't safely *force-kill* a thread (it might hold locks), so cancellation must be cooperative — the work has to opt in by checking; (2) cancellation must **propagate** to children/siblings (cancel a parent, all fan-out children should stop) which raw futures don't do — this is a core reason structured concurrency exists (Q13); (3) partial work and resource cleanup on cancel need care (close that half-opened connection).

### Q9. Show a real CompletableFuture pipeline: fetch a user, then their orders in parallel, combine, with fallback.

```java
CompletableFuture<Response> pipeline =
    fetchUserAsync(userId)                              // async, non-blocking
        .thenCompose(user ->                            // dependent: need user first
            fetchOrdersAsync(user.id())                 // these two run
                .thenCombine(fetchPrefsAsync(user.id()),// in PARALLEL
                    (orders, prefs) -> new Response(user, orders, prefs)))
        .orTimeout(3, TimeUnit.SECONDS)                 // bound the whole thing
        .exceptionally(ex -> Response.degraded(userId));// fallback on any failure

pipeline.thenAccept(this::send);   // no blocking; fires when ready
```

Reading the graph:

```text
fetchUser
   │ (thenCompose — orders/prefs depend on user)
   ├──> fetchOrders ─┐
   └──> fetchPrefs  ─┴─(thenCombine)──> Response ──(timeout/fallback)──> send
```

The design decisions on display: `thenCompose` because orders *depend* on the user (need the id); `thenCombine` because orders and prefs are *independent* of each other and should overlap; `orTimeout` to bound the whole pipeline; `exceptionally` for a single degraded-response fallback covering every failure in the chain. Note there's **no `get()` anywhere** — the calling thread returns immediately and the pipeline completes itself on pool threads. That's the target shape for all async composition.

### Q10. What's the difference between Promise.all, allSettled, race, and any?

Four ways to combine multiple promises, differing in *when they settle* and *how they treat failures*:

| Combinator | Settles when | On failure |
|---|---|---|
| `Promise.all` | **all** fulfill | rejects on the **first** rejection (fast-fail) |
| `Promise.allSettled` | **all** settle (fulfill or reject) | never rejects — returns array of `{status, value/reason}` |
| `Promise.race` | the **first** settles (either way) | first to reject wins if it's first to settle |
| `Promise.any` | the **first** to **fulfill** | rejects only if **all** reject (`AggregateError`) |

```js
await Promise.all([a, b, c]);        // all results, or blow up on first error
await Promise.allSettled([a, b, c]); // always get all outcomes, inspect each
await Promise.race([work, timeout]); // whoever finishes first (timeout pattern)
await Promise.any([mirror1, mirror2]); // first success (redundant requests)
```

Use `all` when you need every result and any failure is fatal; `allSettled` when partial success is fine and you want to report per-item (batch jobs, dashboards querying N services); `race` for timeouts or "first response wins"; `any` for redundancy (query 3 mirrors, take the fastest success). Java's `allOf` ≈ `all` (but note `allOf` still runs the losers), `anyOf` ≈ `race`. The common bug: using `all` for a batch where one bad item shouldn't kill the whole batch — `allSettled` is what you wanted.

### Q11. In Java, when does a CompletableFuture stage run on which thread?

This trips up everyone. The rule: a **non-async** stage (`thenApply`) runs on **whatever thread completed the previous stage** — possibly the thread that called `complete()`, possibly the caller's thread if it's already done. An **`...Async`** stage (`thenApplyAsync`) runs on the **ForkJoinPool.commonPool()** (or an executor you pass).

```java
cf.thenApply(f1)                 // runs on the thread that completed cf
  .thenApplyAsync(f2)            // runs on commonPool
  .thenApplyAsync(f3, myPool);   // runs on myPool
```

Two consequences that cause real bugs:

1. **Accidental hijacking**: if `cf` is already complete when you attach `thenApply`, it runs *synchronously on your current thread* — so a "cheap" transform that's actually expensive silently blocks your caller (or your event loop / request thread).
2. **commonPool starvation**: the default `...Async` pool is the shared `ForkJoinPool.commonPool()` with only `cores-1` threads. Doing blocking IO in `thenApplyAsync` without a custom executor starves *every* async task in the JVM. **Always pass your own executor** for blocking work.

The safe habit: pass an explicit executor to every `...Async` stage that might block, and don't assume a non-async stage runs off your thread.

### Q12. Are async and parallel the same thing? Can single-threaded code be async?

No — **async is about *not waiting*; parallel is about *simultaneous execution*.** They're orthogonal.

**Async single-threaded** (Node.js, Python asyncio): one thread, but when a task hits IO it yields and the thread picks up another ready task. Many operations are *in flight* concurrently, but only one *runs* at any instant. Fully async, zero parallelism.

```text
1 thread, 3 async HTTP calls:
  t0: start A (yields on IO) → start B (yields) → start C (yields)
  t1: A's response ready → process A → C ready → process C → B ...
  All 3 network waits OVERLAP, but processing is one-at-a-time.
```

**Parallel** (thread pool on 8 cores): multiple tasks literally execute at the same instant on different cores.

The relationship: async gives you **concurrency** (progress on many things by overlapping their *waits*); parallelism gives you **simultaneity** (progress by using more *cores*). You can have async without parallelism (asyncio), parallelism without async (a synchronous fork/join), both (a multi-threaded event loop / Go's runtime), or neither. The practical takeaway: async is a *huge* win for IO-bound work (the waits overlap on one thread) but does **nothing** for CPU-bound work — you can't parallelize computation with async alone; you need real threads/cores (Q from the event-loop topic covers why CPU work kills the loop).

### Q13. What is structured concurrency and what problem does it solve?

Structured concurrency makes concurrent tasks respect **lexical scope**: child tasks are launched inside a scope, and the scope **doesn't return until all children complete (or are cancelled)** — just like a block doesn't exit until its statements finish.

The problems it fixes with raw futures:

- **Leaks** — fire a `CompletableFuture` in a method, method returns, future is orphaned; its failure is unobserved, its work uncancelled.
- **No cancellation propagation** — in a fan-out, if one branch fails you usually want to cancel the siblings; raw `allOf` lets them run on pointlessly.
- **Lost errors** — an exception in a detached future silently disappears.

```java
// Java 21+ structured concurrency
try (var scope = new StructuredTaskScope.ShutdownOnFailure()) {
    var user  = scope.fork(() -> fetchUser(id));   // child tasks
    var order = scope.fork(() -> fetchOrder(id));
    scope.join();            // wait for both
    scope.throwIfFailed();   // propagate first failure
    return new Response(user.get(), order.get());
}   // scope close guarantees BOTH children are done or cancelled
```

The guarantee: if `fetchUser` fails, `ShutdownOnFailure` **cancels `fetchOrder`** and the scope propagates the error — no orphans, no leaked work, errors surface. It maps concurrent lifetimes onto the call stack, so "the method that started the work waits for it" — the same discipline structured programming (no goto) brought to control flow. Kotlin coroutine scopes, Swift task groups, and Go's `errgroup` are the same idea. This is the direction all modern async is heading.

### Q14. Why can an unobserved/orphaned future hide bugs?

Because a future that no one **awaits or attaches a handler to** can *swallow its exception entirely* — the work fails, and nothing ever tells you.

```java
// BUG: fire-and-forget, result never observed
CompletableFuture.runAsync(() -> chargeCard(order));  // throws? -> silent
// method returns "successfully"; the charge quietly failed, no log, no retry
```

Nothing calls `join()`, nothing attaches `exceptionally`, so the `CompletionException` has nowhere to go and vanishes. In production this looks like "some charges just don't happen" with zero errors in the logs — a nightmare to diagnose.

JavaScript is slightly safer: an unhandled promise rejection at least emits an `unhandledRejection` warning/event (and crashes Node by default in recent versions), but a *forgotten* `await` still silently loses ordering and error handling:

```js
async function handle() {
  saveAudit(event);        // BUG: missing await — errors lost, may run after response
  return respond();
}
```

The defenses: (1) **always attach a terminal handler** (`exceptionally`/`whenComplete`/`.catch`) to fire-and-forget futures, at minimum to log; (2) enable lint rules (`no-floating-promises` in TS) that flag un-awaited promises; (3) use **structured concurrency** so orphans are impossible by construction — every child is owned by a scope that observes it. Unobserved futures are to async what swallowed exceptions are to sync code.

### Q15. Compare futures/promises across Java, JavaScript, Python, and Rust.

The abstraction is universal; the ergonomics and execution model differ sharply:

| | Java `CompletableFuture` | JS `Promise` | Python `asyncio` | Rust `Future` |
|---|---|---|---|---|
| Read/write | unified (both) | unified | `Future`/`Task` + `await` | `Future` trait |
| Execution | eager (runs on submit) | eager (runs on creation) | eager once scheduled | **lazy** (does nothing until polled/awaited) |
| Runs on | thread pool (real parallelism) | single event loop | single event loop | executor you choose (tokio, async-std) |
| Compose | `thenCompose`/`thenCombine`/`allOf` | `.then`/`Promise.all` | `await`, `asyncio.gather` | `.await`, `join!`, `select!` |
| Cancellation | cooperative, weak | `AbortController` | `task.cancel()` (throws in coroutine) | drop the future (clean!) |

The standout differences: **Rust futures are lazy** — creating one does nothing; work happens only when an executor polls it, which makes cancellation as simple as *dropping* the future (its `Drop` runs cleanup). Java is the odd one out with **true parallelism** (its futures run on a real thread pool, so CPU-bound composition parallelizes), whereas JS and Python futures are concurrent-but-single-threaded (one event loop, no CPU parallelism — Python's GIL and JS's single thread). Python's `cancel()` actually *injects* a `CancelledError` into the awaiting coroutine, giving real (if cooperative) cancellation, unlike Java's discard-the-result model. The interview point: the *word* "future" is portable, but eager-vs-lazy, single-vs-multi-threaded, and cancellation semantics are not — know which runtime you're in.

### Q16. How do async/await and futures relate — is async/await just sugar over promises?

Largely, yes — **`async/await` is syntactic sugar that lets you write future-composition code as if it were sequential blocking code**, and the compiler desugars it back into a state machine over the underlying futures.

```js
// async/await version:
async function load(id) {
  const user   = await fetchUser(id);
  const orders = await fetchOrders(user);
  return render(user, orders);
}

// desugars conceptually to the promise chain:
function load(id) {
  return fetchUser(id).then(user =>
         fetchOrders(user).then(orders =>
         render(user, orders)));
}
```

Each `await` is a *suspension point*: the function pauses, returns control to the event loop, and resumes when the awaited future resolves — the compiler splits your function at each `await` into states of a resumable state machine (Q in the next topic covers the desugaring in detail). `try/catch` around `await` maps to `.catch`/`exceptionally`; the whole thing runs on the same futures.

Two important caveats: (1) `await` **serializes** by default — `await a; await b;` runs them one after another, so for parallelism you still reach for the combinators (`await Promise.all([a, b])`); juniors accidentally serialize independent calls this way constantly. (2) An `async` function *always* returns a future/promise, even if its body looks synchronous — which is the root of the "colored functions" problem in the next topic. So async/await doesn't replace futures; it's the *ergonomic front-end* to them, and you drop back to raw combinators exactly when you need explicit fan-out or racing.

## Async/Await & Event Loops

### Summary

**What this topic covers**

This is the runtime and programming model behind single-threaded async: the **event loop** (Node.js, Python asyncio, browser JS) that juggles thousands of concurrent operations on one thread by never blocking. It covers how the loop works (a queue of ready callbacks, IO delegated to the OS/`epoll`), **cooperative vs preemptive** scheduling, **coroutines** (stackful vs stackless), how `async/await` **desugars into a state machine**, the cardinal rule to **never block the event loop** (CPU work and sync IO), the **"colored functions"** problem (sync and async don't mix freely), **task vs microtask** queue ordering, when async beats threads and when it doesn't, and how **goroutines** offer a third path (async ergonomics without the coloring). The 15 questions run from "what is the event loop" to "why does one slow CPU call freeze my whole Node server" to "explain the microtask queue ordering" to "goroutines vs async/await." This topic ties the primer together: it's the alternative to the thread-pool model, and it explains why modern runtimes (Loom, Go) try to give you async scaling *without* the async syntax tax.

**Mental model**

Picture **one chef in a kitchen with many timers.** The chef (the single thread) never stands idle waiting for water to boil — they start the pot, set a timer, and immediately move to chopping vegetables. When a timer dings (an IO operation completes), they come back and take the next step. The event loop *is* that discipline: a loop that repeatedly asks "what's ready to make progress?" and runs the next ready callback to completion, delegating all the *waiting* (network, disk, timers) to the OS so the thread is never parked. The catch that explains every event-loop bug: **there is only one chef.** If any single step takes a long time — a big CPU computation, a synchronous file read — the chef is stuck on it, *every other timer piles up*, and the whole kitchen stalls. That's why "never block the event loop" is the entire discipline of async programming: your job is to keep every callback short and to push all waiting onto the OS, so the one thread keeps flowing between thousands of concurrent operations.

**Key terms**

- **Event loop** — the single-threaded loop that dequeues and runs ready callbacks until the queue is empty, delegating IO to the OS.
- **Cooperative scheduling** — tasks run until they *voluntarily* yield (at an `await`); no preemption.
- **Preemptive scheduling** — the scheduler forcibly interrupts a task (OS threads); no cooperation needed.
- **Coroutine** — a function that can suspend and resume, preserving local state across suspensions.
- **Stackful vs stackless** — coroutine keeps its own full call stack (can yield from nested calls; goroutines, Loom) vs stores only local state in a state machine (yield only at `await`; JS/Rust/Python).
- **State machine desugaring** — the compiler transforms an `async` function into a resumable object with a "which step am I on" state.
- **Never block the event loop** — the rule: no CPU-heavy or synchronous-blocking work on the loop thread.
- **Colored functions** — `async` functions can only be *awaited* by other async functions; sync callers can't call them naturally.
- **Task (macrotask) vs microtask** — two queues; microtasks (resolved promises) drain fully *between* each macrotask (timers, IO).
- **`epoll`/`kqueue`/IOCP** — OS readiness-notification mechanisms the loop uses to know which IO is ready.
- **Reactor pattern** — the design pattern the event loop implements: demultiplex events, dispatch to handlers.

**Why interviewers ask this**

Because event-loop understanding is the difference between someone who's *used* Node/Python-async and someone who *understands* it — and the gap shows up as production outages. The signature junior mistake is a synchronous `JSON.parse` of a huge payload, a `bcrypt` in a request handler, or a `fs.readFileSync` on the hot path — any of which freezes a Node server for *all* users, and the junior can't explain why "my code is async but the server hangs." A senior explains the single-threaded model, spots the blocking call, and knows the fixes (worker threads, offload to a pool, chunk the work). The deeper signals: explaining the **microtask vs macrotask** ordering (a genuinely tricky bit that predicts output), articulating the **colored-functions** tension as a real design cost, and knowing *when async is the wrong tool* (CPU-bound work — you need threads/cores, not a loop). It's also where interviewers probe whether you understand that "async" ≠ "parallel."

**Common confusions**

- "Async means multi-threaded." The event loop is **single-threaded**; concurrency comes from interleaving, not parallelism.
- "Async makes everything faster." Only IO-bound work — for CPU-bound work a single-threaded loop is *slower* and blocks everyone.
- "`await` blocks." `await` *yields* — it suspends this task and frees the thread to run others; it's the opposite of blocking.
- "`setTimeout(fn, 0)` runs immediately." It's a macrotask — it runs *after* all pending microtasks (resolved promises) drain.
- "Node is fully single-threaded." The JS runs on one thread, but libuv has a background **thread pool** for file IO and some crypto/DNS.
- "async/await removed callbacks." It's sugar *over* the same callback/promise machinery — the callbacks are still there, generated by the compiler.

**What follows from this topic**

This closes the concurrency arc. The event loop is the counterpart to the **Thread Pools** model: instead of many blocking threads, one non-blocking thread — and the "never block the loop" rule is the exact mirror of "don't block a pool worker on a dependency." **Async/await** here is the syntax that consumes the **futures/promises** from the previous topic; the state-machine desugaring explains *how* `.then` chains become sequential-looking code. And the goroutine comparison points forward to message-passing concurrency (channels/CSP) — the runtimes that try to unify the two worlds by giving you cheap stackful coroutines (Go, Loom) so you write blocking-style code that scales like an event loop.

### Q1. What is an event loop and how does it achieve concurrency on one thread?

An event loop is a single thread running a loop that repeatedly **takes the next ready callback and runs it to completion**, while delegating all *waiting* (network, disk, timers) to the OS so the thread is never parked.

```text
while (true) {
    task = readyQueue.dequeue();   // next callback whose IO/timer is ready
    run(task);                     // run to completion (no preemption)
    // IO ops started here register with the OS (epoll) and return immediately;
    // their callbacks are enqueued LATER, when the OS says they're ready
}
```

The concurrency comes from **overlapping the waits**, not from multiple threads. When a callback starts a network read, it doesn't wait — it hands the socket to the OS (`epoll`/`kqueue`) and returns. The thread immediately runs the next ready callback. Thousands of connections can be "in progress" because at any instant the thread is only *processing* one, while the OS holds all the ones that are *waiting*.

```text
1 thread, 10k connections:
  9,998 are parked in the OS (waiting on socket readiness) — cost ≈ zero
  1 is having its callback run right now
  1 just became ready, queued next
```

This is the **reactor pattern**: demultiplex readiness events from the OS, dispatch each to its handler. It's spectacularly efficient for IO-bound work (a chat server, an API gateway) because you pay for connections in cheap kernel state, not in ~1MB thread stacks. The entire model rests on one assumption: **every callback returns quickly** — which is why blocking the loop is fatal (Q4).

### Q2. Explain cooperative vs preemptive scheduling. Which does async/await use?

The distinction is **who decides when a task stops running**.

**Preemptive** (OS threads): the scheduler can **forcibly interrupt** a task at any instant (a timer interrupt fires, the OS saves its state and switches). Tasks need no cooperation — even an infinite loop gets suspended so others run. This is how threads share a core.

**Cooperative** (async/await, coroutines): a task runs until it **voluntarily yields** — and the only yield points are `await`. The scheduler *cannot* interrupt; it waits for the task to hand control back.

```text
Cooperative:  taskA runs ──await──> yields ──> taskB runs ──await──> yields ...
              (a task with NO await, or an infinite CPU loop, NEVER yields
               → it monopolizes the thread → everything else starves)

Preemptive:   taskA runs ──[interrupt]──> taskB ──[interrupt]──> taskA ...
              (the OS forces switches; no task can monopolize a core)
```

Async/await is **cooperative**. This is the double-edged sword: cooperative scheduling is *cheap* (no OS involvement, no lock overhead on shared state between yields — you have a guarantee no one else runs until your next `await`), but it means a single task that never yields (a CPU-heavy loop, a `while(true)`) **freezes the entire event loop**. Preemption would have interrupted it; cooperation trusts it to yield, and CPU-bound code doesn't. That trust is exactly what "never block the event loop" is about.

### Q3. What are coroutines, and what's the difference between stackful and stackless?

A **coroutine** is a function that can **suspend** (pause, saving its local state) and later **resume** from exactly where it left off — unlike a normal function that runs start-to-finish. `async` functions are coroutines; `await` is a suspension point.

The stackful/stackless split is about **how much state is saved** and **where you can suspend from**:

**Stackless** (JS, Python, Rust, C++20): the coroutine saves only its **local variables and a resume-point**, compiled into a state machine object (Q5). It can suspend **only from its own body** — you can't `await` from inside a regular helper function it calls, because that helper has an ordinary stack frame with nowhere to save. Cheap (a small heap object), but "async infects the call chain."

**Stackful** (Go goroutines, Java Loom virtual threads, Lua): the coroutine has its **own full, growable call stack**. It can suspend from **anywhere**, including deep inside nested helper calls — because the whole stack is preserved. More memory per coroutine (a stack, even if small/resizable), but no coloring problem: any function can yield, so you write normal blocking-looking code.

```text
Stackless: async fn A() { helper(); await x; }
           helper() CANNOT await — only A's own body can suspend.
           → the "colored function" tax (Q7)

Stackful:  goroutine runs A() -> helper() -> deep() -> blocks on IO
           ANY frame can yield; the whole stack parks & resumes.
           → plain blocking code, no coloring
```

This single design choice explains the biggest ergonomic difference in concurrency models: stackless gives you `async/await` (and function coloring), stackful gives you goroutines/virtual threads (blocking-style code that still scales).

### Q4. Why must you never block the event loop, and what does "blocking" mean here?

Because there's **one thread**, so any operation that occupies it for a long time stalls **every** other connection — the server goes unresponsive for all users at once, not just the slow request.

"Blocking" the loop means two things:

**1. CPU-heavy work** — a big loop, `JSON.parse` of a 50MB payload, image resizing, `bcrypt`/`pbkdf2` with high cost, a regex catastrophe. The thread is busy *computing*, so it can't run any other callback.

```text
Request A: synchronous bcrypt (200ms of CPU)
  → the thread is pinned for 200ms
  → all 5,000 other connections' callbacks WAIT 200ms
  → p99 latency for EVERYONE spikes; server looks hung
```

**2. Synchronous IO** — `fs.readFileSync`, a blocking DB driver call, `execSync`. The thread *waits* on IO instead of delegating it — the one thing the event loop exists to avoid.

The fixes:

- **Offload CPU work** to a **worker thread** (Node `worker_threads`, Python `run_in_executor` / a process pool) or a separate service.
- **Always use the async IO API** (`fs.promises.readFile`, async DB driver) so IO goes to the OS, not the loop thread.
- **Chunk** long computations, yielding (`await`/`setImmediate`) between chunks so other callbacks interleave.

The diagnostic tell: your Node app's event-loop lag metric spikes, or requests that should be fast intermittently take hundreds of ms — someone put a synchronous CPU call or a `...Sync` on the hot path.

### Q5. How does async/await desugar into a state machine?

The compiler splits an `async` function at each `await` into **states**, generating a resumable object that remembers "which step am I on" and its local variables. Each `await` becomes: register a continuation on the awaited future, save state, return control to the loop; on resume, jump to the next state.

```js
async function load(id) {
  const user = await fetchUser(id);   // suspension point 1
  const ords = await fetchOrders(user); // suspension point 2
  return summarize(user, ords);
}
```

desugars conceptually to:

```text
state = 0; user; ords;
resume(input):
  switch (state):
    case 0: fut = fetchUser(id); state = 1;
            fut.onDone(resume); return;     // yield to loop
    case 1: user = input; fut = fetchOrders(user); state = 2;
            fut.onDone(resume); return;     // yield to loop
    case 2: ords = input; return summarize(user, ords); // done
```

The key insight: **local variables that live across an `await` are lifted into the state object** (heap-allocated), because the C stack frame is gone once the function yields — this is exactly why stackless coroutines can only suspend from their own body (a called helper's stack frame has nowhere to be saved), which is the mechanical root of the coloring problem. Rust makes this explicit — an `async fn` compiles to an enum of states implementing `Future::poll`, and the compiler even computes the struct size (hence "futures are lazy — nothing runs until polled"). C#'s `async` and Kotlin's `suspend` do the same transform. Understanding this demystifies async: it's not magic threading, it's a compiler turning your sequential code into a callback-driven state machine you'd have written by hand.

### Q6. Explain the difference between the task (macrotask) and microtask queues. What does this code print?

Event-loop runtimes have **two** queues, and microtasks have priority: after each macrotask, the loop **drains the entire microtask queue** before taking the next macrotask.

- **Macrotasks (tasks)**: `setTimeout`, `setInterval`, IO callbacks, `setImmediate`. One per loop turn.
- **Microtasks**: resolved-promise callbacks (`.then`, `await` continuations), `queueMicrotask`, `process.nextTick` (Node, even higher priority). **All** drained between macrotasks.

```js
console.log('1');
setTimeout(() => console.log('2'), 0);      // macrotask
Promise.resolve().then(() => console.log('3')); // microtask
console.log('4');
```

Output: **1, 4, 3, 2**.

```text
sync run:        print 1, schedule timeout(2), schedule microtask(3), print 4
                 → sync done. Stack empty.
drain microtasks: run 3          ← microtasks BEFORE any macrotask
next macrotask:   run 2
```

The rule: `1` and `4` are synchronous (run first, in order); then the loop drains microtasks (`3`) *before* touching the macrotask queue (`2`) — so the promise callback beats the zero-delay timer. This is a favorite interview question because it predicts real behavior: a flood of promise `.then`s can **starve** macrotasks (and IO callbacks) since microtasks fully drain each turn — an infinite microtask chain freezes the loop just like a CPU loop. In Node, `process.nextTick` is drained *even before* the promise microtask queue, so `nextTick` recursion can starve everything.

### Q7. What is the "colored functions" problem?

It's the observation that in stackless-coroutine languages, functions come in two incompatible **colors** — sync and async — and the colors don't mix freely, so "async-ness" virally spreads up your entire call chain.

The rules that make it painful:

- An `async` function can only be meaningfully consumed by `await`, and `await` is only allowed **inside another `async` function**.
- A sync function therefore **can't call an async one** and get its result directly — it would have to block (defeating the point) or itself become async.
- So the moment one deep function becomes async (e.g. you swap a sync DB call for an async one), **every caller up the stack must also become async**.

```text
sync main() -> sync service() -> sync repo()
  repo() switches to async DB driver → must become `async repo()`
  → service() must `await repo()` → must become `async service()`
  → main() must become `async main()`
  One async leaf repaints the whole tree.  ← the tax
```

You also get **duplicated APIs** (`readFile` vs `readFileSync`) and awkward bridges (`asyncio.run`, blocking on a future) at the sync/async boundary. It's a real, cited design cost of async/await. The languages that *don't* have it are the **stackful** ones (Q3): Go goroutines and Java virtual threads let any function suspend, so there's no "async color" — a function is just a function, and the runtime handles the yielding. That's a big part of why Loom and Go are attractive: same IO scalability, no coloring.

### Q8. When does async/event-loop concurrency beat threads, and when does it lose?

It's a workload question: **async wins for IO-bound, high-concurrency work; it loses for CPU-bound work.**

**Async wins when:**

- **Massive IO-bound concurrency** — 100k idle-ish connections (chat, streaming, API gateway, proxies). Each costs a cheap continuation, not a ~1MB thread stack. A thread-per-connection model would exhaust memory; the event loop sails.
- **Lots of waiting, little computing** — the whole point is overlapping waits on one thread with near-zero per-task overhead and no lock contention (single thread = no data races on shared state between yields).

**Async loses when:**

- **CPU-bound work** — one thread can use one core. A compute-heavy task both fails to parallelize *and* blocks every other task (Q4). Threads/processes across cores are what you need — Node needs `worker_threads`, Python needs multiprocessing (the GIL blocks CPU threading too).
- **You need true parallelism** — async gives concurrency, not parallelism (previous topic, Q12). For throughput on multi-core compute, you want a thread pool sized to cores.
- **Blocking libraries are unavoidable** — if your ecosystem's drivers are synchronous, the event loop can't help; you're forced back to threads.

```text
10k concurrent DB queries (IO-bound):  event loop >> thread pool (memory)
1k image transforms (CPU-bound):        thread pool >> event loop (cores)
Mixed:                                   event loop for IO + worker pool for CPU
```

The pragmatic architecture is often **both**: an event loop for the IO front-end, offloading CPU chunks to a worker pool — which is exactly the hybrid model Node/Python async apps use in practice.

### Q9. Is Node.js truly single-threaded? Explain libuv's thread pool.

**The JavaScript runs on one thread** — your callbacks, promise handlers, and the event loop itself are single-threaded, and that's the model you reason about. But Node as a *process* is **not** single-threaded: libuv (the C library under Node) maintains a background **thread pool** (default 4 threads, `UV_THREADPOOL_SIZE`) for operations the OS can't do asynchronously via `epoll`.

```text
JS thread (event loop) ── delegates ──> libuv
   ├─ network IO ────────> OS epoll/kqueue (no thread pool needed — truly async)
   └─ file IO, DNS lookup,
      some crypto (pbkdf2) ─> libuv THREAD POOL (4 threads) — runs off-loop,
                              posts the callback back to the event loop
```

The split matters because:

- **Network IO** is natively async at the OS level (`epoll`), so it needs no thread pool — this is where the loop scales to 100k connections.
- **File IO and DNS** have no portable async OS API, so libuv fakes async by running them on the thread pool and calling you back.
- **Some CPU crypto** (`crypto.pbkdf2`, `crypto.randomBytes` async variants) also uses the pool — which is why the *async* crypto APIs don't block the loop but the *sync* ones do.

Consequences: the default pool of 4 means heavy concurrent file/crypto work can bottleneck (bump `UV_THREADPOOL_SIZE`), and CPU work in *your JS* still needs `worker_threads` (a separate mechanism — real V8 isolates on OS threads) because libuv's pool is internal to Node's own operations, not for your JavaScript.

### Q10. Compare goroutines to async/await. Why do goroutines avoid the coloring problem?

Both let you handle huge IO concurrency cheaply, but goroutines do it with **stackful coroutines + a runtime scheduler**, which sidesteps async/await's coloring tax.

| | async/await (JS/Py/Rust) | Goroutines (Go) |
|---|---|---|
| Coroutine type | stackless (state machine) | stackful (own growable stack) |
| Suspend from | only own body (`await`) | anywhere, incl. nested calls |
| Syntax | explicit `async`/`await` | none — plain function calls |
| Coloring problem | yes | **no** |
| Scheduler | cooperative, single loop | M:N preemptive-ish over a thread pool |
| Parallelism | single-threaded (one core) | multi-core (real parallelism) |

```go
func handle(w http.ResponseWriter, r *http.Request) {
    user := fetchUser(id)          // looks blocking, but the goroutine yields
    orders := fetchOrders(user)    // no `await`, no async keyword
    render(w, user, orders)
}
go handle(...)   // spawn: costs ~2KB, millions are fine
```

Why no coloring: because goroutines are **stackful**, any function can block/suspend — when `fetchUser` does IO, the Go runtime parks the *whole goroutine* (its entire stack) and runs another on the same OS thread, resuming later. There's no need to mark functions `async` because the runtime, not the compiler, handles suspension; a function is just a function. The `go` keyword spawns, blocking calls *look* blocking but scale like async, and Go's **GMP scheduler** multiplexes millions of goroutines over a small pool of OS threads *across cores* — so you also get real parallelism, unlike a single event loop. This is the same bet Java's virtual threads (Loom) make: give the runtime stackful coroutines so developers write simple blocking code that scales like an event loop, no coloring, no `async` keyword.

### Q11. Trace how one CPU-heavy request can freeze an async server, and how to fix it.

Because the event loop is one thread, a single request doing synchronous CPU work **pins that thread**, and every concurrent request queues behind it.

```text
t=0    100 clients connected, server humming (all IO-bound, loop flows)
t=0    Request X calls a synchronous fibonacci(45) / big JSON.parse / sync bcrypt
       → the loop thread starts computing, 800ms of pure CPU
t=0..800ms  loop thread is PINNED. It cannot:
            - accept new connections
            - run any other request's callback
            - fire timers, respond to health checks
t=800ms handshake resumes; all 99 other requests were frozen the whole time
Result: p99 latency +800ms for EVERYONE, health check may fail → restart loop
```

The tell in monitoring: **event-loop lag** spikes to hundreds of ms, and unrelated fast endpoints intermittently hang. It's not "the slow endpoint is slow" — it's "the slow endpoint makes *everything* slow," which is the signature of loop blocking.

Fixes, by approach:

1. **Offload to a worker thread** (`worker_threads` in Node, `loop.run_in_executor(pool, fn)` in Python) — the CPU work runs on another thread/core, the loop stays free.
2. **Offload to a separate service/queue** — push heavy jobs to a background worker process.
3. **Chunk and yield** — break the computation into slices, `await setImmediate()` / `asyncio.sleep(0)` between them so other callbacks interleave (mitigation, not real parallelism).
4. **Use the async variant** — if it's `bcrypt`/`crypto`, use the async API (runs on libuv's pool), not the sync one.

The principle: keep every loop callback short; anything CPU-heavy must leave the loop thread.

### Q12. How do Python's asyncio and the GIL relate? Does asyncio give parallelism?

They're solving different problems, and together they explain why Python concurrency is confusing.

**asyncio** is Python's event loop — cooperative, single-threaded async IO via `async`/`await`. It gives **concurrency for IO-bound work**: thousands of overlapping network/DB waits on one thread, exactly like Node.

**The GIL** (Global Interpreter Lock) is a mutex that lets **only one thread execute Python bytecode at a time**, even on a multi-core machine. It exists to make CPython's memory management thread-safe.

The relationship: asyncio **doesn't fight the GIL — it sidesteps it** by being single-threaded in the first place (no contention if there's one thread). But it also inherits the GIL's core limitation:

```text
asyncio:  great for IO-bound   (one thread, overlap the waits)  ✓
asyncio:  useless for CPU-bound (one thread, one core, blocks loop) ✗
threads:  useless for CPU-bound (GIL serializes bytecode)        ✗
          fine for IO-bound     (GIL released during blocking IO)  ✓
```

So **neither asyncio nor threads give you CPU parallelism in Python** — for that you need **multiprocessing** (separate processes, separate GILs) or native extensions that release the GIL (NumPy, `concurrent.futures.ProcessPoolExecutor`). asyncio gives concurrency, not parallelism. The decision tree: IO-bound → asyncio (or threads); CPU-bound → multiprocessing. (Free-threaded CPython 3.13+ with the GIL optionally disabled is beginning to change this, letting threads actually parallelize CPU work — but it's experimental and not yet the default.)

### Q13. What is backpressure in an async/streaming context and why does it matter?

Backpressure is the mechanism by which a **slow consumer tells a fast producer to slow down**, so data doesn't pile up unbounded in memory. Without it, an async pipeline where the producer outpaces the consumer buffers indefinitely and OOMs — the async twin of the unbounded-queue trap from the thread-pool topic.

```text
Fast source (read file @ 500MB/s) ──> slow sink (upload @ 5MB/s)
  Without backpressure: 495MB/s accumulates in a buffer → memory blows up
  With backpressure:    sink signals "pause" → source stops reading until "resume"
```

How runtimes provide it:

- **Node streams** — `writable.write()` returns `false` when its buffer is full; a well-behaved producer stops and waits for the `'drain'` event. `pipe()` / `pipeline()` wire this automatically.
- **Reactive libraries** (RxJS, Reactor, Akka Streams) — the `Flow`/`Publisher-Subscriber` protocol has the subscriber `request(n)` items, so the producer only sends what's demanded (demand-driven).
- **Go channels** — a bounded channel *is* backpressure: `ch <- x` blocks when the channel is full, naturally stalling the producer.
- **async iterators** — `for await...of` pulls one item at a time; the producer's `next()` isn't called until the consumer is ready (pull-based, inherently back-pressured).

Why it matters at senior level: it's the correctness property that keeps streaming systems from falling over under load. The failure mode — "it works in dev, OOMs in prod under a big file / traffic spike" — is a classic missing-backpressure bug. The general principle mirrors the whole primer: **bound your buffers and propagate slowness upstream**, whether the buffer is a thread-pool queue, a channel, or a stream's internal buffer.

### Q14. Spot the bug: this async code doesn't run in parallel. Why, and how do you fix it?

```js
async function loadAll(ids) {
  const results = [];
  for (const id of ids) {
    results.push(await fetchUser(id));  // BUG: awaits each before starting next
  }
  return results;
}
```

The bug is **accidental serialization**. `await` suspends the loop iteration until *this* `fetchUser` resolves before starting the next one, so N calls that could overlap run strictly back-to-back:

```text
Serial (the bug):   fetch1 ──done──> fetch2 ──done──> fetch3   = 3 × latency
Parallel (fixed):   fetch1 ─┐
                    fetch2 ─┼──all done──>                     = 1 × latency
                    fetch3 ─┘
```

If each call is 100ms and there are 10 ids, this takes 1000ms instead of ~100ms. `await` inside a loop is the single most common async performance bug.

The fix: **start all the calls first (fan-out), then await them together** with `Promise.all`:

```js
async function loadAll(ids) {
  return Promise.all(ids.map(id => fetchUser(id)));  // all fire, then await all
}
```

`ids.map(...)` (no `await` in the mapper) launches every `fetchUser` immediately, returning an array of pending promises; `Promise.all` awaits the whole set concurrently. Nuance: sometimes serial *is* intentional (rate-limiting a downstream, or each call depends on the previous), and unbounded fan-out can overwhelm a service — then you want a **concurrency-limited** map (e.g. `p-limit`, or chunked `Promise.all`) rather than either extreme. But the reflexive fix for "my async loop is slow" is: are you awaiting inside the loop when you meant to fan out?

### Q15. Compare thread-per-request, event loop, and virtual threads as server concurrency models.

Three ways to handle many concurrent requests, which is really the whole primer in one table:

| | Thread-per-request | Event loop (async) | Virtual threads / goroutines |
|---|---|---|---|
| Concurrency unit | OS thread (~1MB) | continuation / state machine | stackful coroutine (~KB) |
| Max concurrent | thousands | millions | millions |
| Scheduling | preemptive (OS) | cooperative (one loop) | runtime M:N (mostly cooperative) |
| Code style | blocking, sequential | `async/await`, colored | blocking, sequential (no coloring) |
| CPU parallelism | yes (many cores) | no (one thread) | yes (many cores) |
| Blocking IO | fine (but thread is pricey) | forbidden (freezes loop) | fine (runtime parks it) |
| Weakness | memory at high concurrency | coloring + no CPU parallelism | younger ecosystems / pinning gotchas |
| Examples | classic Java/Spring, Rails | Node, Python asyncio | Go, Java Loom |

The arc the table tells: **thread-per-request** is the simplest to write (blocking, sequential) but doesn't scale to huge concurrency because threads are expensive. The **event loop** scales to millions of IO-bound connections on one cheap thread, but you pay with the async programming model (coloring, "never block the loop") and get no CPU parallelism. **Virtual threads / goroutines** are the synthesis: keep the simple blocking-style code *and* get event-loop-like IO scaling *and* real multi-core parallelism, by having the runtime do the suspending that the event loop made you do by hand.

That convergence is the punchline of the whole concurrency primer: the industry spent a decade forcing developers into callbacks and `async/await` to escape the cost of OS threads — and the endgame (Loom, Go) is runtimes that make cheap threads again, so you can write straightforward sequential code that still scales. Understanding *why* each model exists — and its failure mode — is what the interview is really testing.
## Concurrent Data Structures

### Summary

**What this topic covers**

How to build and choose data structures that multiple threads can hammer on at once without corruption, and why "just wrap the whole thing in a lock" is both correct and usually wrong. Three concern areas live here: (1) **what thread-safety actually means** for a container — internal invariants preserved under concurrent access, and the trap that individually-safe operations don't compose into safe *compound* operations; (2) **the strategy spectrum** — coarse-grained locking, **lock striping** (`ConcurrentHashMap`'s segmented/CAS-per-bin design), **copy-on-write** (`CopyOnWriteArrayList`), lock-free/CAS structures (Treiber stack, Michael-Scott queue), and immutable/persistent structures; and (3) **queues as the workhorse** — blocking vs lock-free, and the SPSC/MPSC/MPMC taxonomy that decides which algorithm you can even use, including ring buffers and the LMAX Disruptor. The 16 questions here move from "what makes a structure thread-safe" to designing a bounded blocking queue and reasoning about a lock-free stack's ABA hazard.

**Mental model**

Think of a concurrent data structure as a **state machine with an invariant** (a linked list's `next` pointers form one chain; a map's size matches its entries). Thread-safety means: no interleaving of the exposed operations can ever expose or leave a broken invariant. There are only a few ways to get there. **Lock the whole thing** (one mutex, simple, serializes everything). **Partition the locking** so unrelated operations don't contend (striping/sharding). **Never mutate shared state** — either copy-on-write on every change, or use persistent immutable structures where "modify" returns a new version sharing most of the old. Or **make each step a single atomic CAS** so there's no window to protect (lock-free). The right choice is dictated by the read/write ratio and contention: mostly-reads → copy-on-write or immutability; balanced high-contention → striping or lock-free; a handoff between stages → a queue. The killer subtlety is that thread-safe *methods* do not give you thread-safe *transactions*.

**Key terms**

- **Thread-safe** — behaves correctly under concurrent access with no external synchronization needed; invariants always hold.
- **Compound operation** — check-then-act / read-modify-write across two calls (e.g. `if (!map.containsKey(k)) map.put(k,v)`); atomic per-call ≠ atomic across calls.
- **Coarse-grained lock** — one lock for the entire structure; simple, serializes all access.
- **Lock striping / fine-grained locking** — many locks each guarding a partition (bucket/segment), so disjoint keys proceed in parallel.
- **Copy-on-write (COW)** — mutations copy the whole backing array; readers see an immutable snapshot with zero locking.
- **Lock-free** — system-wide progress guaranteed; some thread always completes even if others stall (no locks, CAS retry loops).
- **Blocking queue** — `take()`/`put()` block when empty/full; the standard producer-consumer handoff.
- **SPSC / MPSC / MPMC** — single/multi producer × single/multi consumer; fewer contenders on an end enable cheaper algorithms.
- **Ring buffer** — fixed-size circular array with head/tail indices; the basis of the Disruptor.
- **Persistent data structure** — immutable structure whose "updates" return new versions sharing structure with the old (e.g. HAMT).
- **Weakly consistent iterator** — traverses without locking, reflects some-but-not-all concurrent mutations, never throws `ConcurrentModificationException`.

**Why interviewers ask this**

This topic separates people who *use* `ConcurrentHashMap` from people who understand *why* it scales and *when it still bites you*. A junior answer is "it's thread-safe, so I can use it from many threads." A senior answer names the compound-operation trap (`putIfAbsent`/`compute` exist precisely because `get`-then-`put` races), explains lock striping vs the pre-Java-8 segment array, and picks the right structure from the workload: COW for a rarely-changing listener list, a bounded `BlockingQueue` for backpressure between stages, a lock-free queue only when profiling shows lock contention is the bottleneck. Interviewers also probe whether you know that "thread-safe" is a per-operation guarantee, not a magic wand — the classic follow-up is "you used a `ConcurrentHashMap`, why do you still have a race?"

**Common confusions**

- "It's a concurrent collection, so my code is thread-safe" — only each *method* is atomic; `get` then `put` is still a race. Use `putIfAbsent`/`compute`/`merge`.
- "`ConcurrentHashMap` locks the map" — it doesn't lock reads at all and only locks/CASes a single bin on writes; concurrent writers to different bins don't contend.
- "`Collections.synchronizedMap` == `ConcurrentHashMap`" — the former wraps every method in one lock (serialized, and iteration needs manual external locking); the latter is striped and has weakly-consistent iterators.
- "Copy-on-write is cheap" — reads are free, but every write copies the entire array; O(n) per mutation makes it a disaster for write-heavy use.
- "Lock-free means faster" — only under real contention; uncontended, a plain lock is often faster and always simpler. Lock-free trades throughput-under-contention for retry overhead and hard reclamation problems (ABA).
- "`size()` on a concurrent map is exact" — it's an estimate/snapshot under concurrent mutation; don't build logic on it.

**What follows from this topic**

Concurrent structures are the bridge between the shared-memory topics (locks, atomics/CAS, the memory model) and the message-passing world. The blocking queue is literally the shared-memory implementation of a **channel** — which the next topic, Message Passing & CSP, reframes as the primary abstraction rather than a helper. Lock-free queues lean on everything from the atomics/CAS and memory-model topics (ABA, happens-before on publication). And the contention behavior of striping vs COW previews the scaling topic (false sharing, per-core sharding). If you can explain why `ConcurrentHashMap` scales and `CopyOnWriteArrayList` doesn't for writes, you understand the core tension of this whole primer.

### Q1. What does it actually mean for a data structure to be "thread-safe"?

A data structure is **thread-safe** if it behaves correctly when accessed concurrently from multiple threads, with no additional synchronization required by the caller, regardless of how the runtime interleaves those accesses. "Correctly" means two things: its internal invariants are never observably broken (a linked list stays a single well-formed chain; `size` matches the actual entry count), and each exposed operation appears **atomic** — it either fully happens or doesn't, never half-applied.

Concretely a thread-safe structure must handle three concerns from the memory-model topic: **atomicity** (a `put` that touches three fields can't be seen half-done), **visibility** (a write by T1 becomes visible to T2's later read — usually via a lock release / `volatile` / CAS establishing happens-before), and **ordering** (no reordering exposes a partially-constructed node).

The critical caveat: thread-safety is defined **per operation**. It says nothing about sequences of operations. `queue.isEmpty()` and `queue.poll()` are each atomic, but "if not empty, poll" is not — another thread can drain it in between. That's the compound-operation trap (see Q4).

### Q2. Coarse-grained locking vs lock striping — walk through `ConcurrentHashMap`.

**Coarse-grained**: one lock guards the whole structure. Correct and trivial, but every operation serializes — throughput doesn't improve with cores, and a slow operation blocks all others.

**Lock striping**: partition the data and give each partition its own lock, so operations on different partitions run fully in parallel. `ConcurrentHashMap` is the canonical example.

```text
Coarse:                      Striped (per-bin):
  [ ONE LOCK ]                bin0  bin1  bin2  bin3 ...
   |  |  |  |                  |     |     |     |
  all ops serialize          independent writers don't contend
```

`ConcurrentHashMap` design (Java 8+):
- **Reads never lock.** `get` walks a bin using `volatile` reads; visibility comes from happens-before on the writers' CAS/publish. Reads scale perfectly.
- **Writes lock (or CAS) a single bin, not the map.** Inserting the first node in an empty bin is a CAS (lock-free fast path). A collision synchronizes on that bin's head node only. Two writers hashing to different bins never contend.
- **Resizing is concurrent** — multiple threads cooperatively transfer bins, and a bin being moved is marked with a forwarding node so readers/writers help or wait per-bin.

Pre-Java-8 used a fixed array of ~16 `Segment` sub-maps (concurrency level = 16 writers max). Java 8 dropped segments for **per-bin CAS + synchronized**, giving finer granularity and better scaling. Net effect: near-linear read scaling and write scaling bounded only by how many keys collide into the same bin.

### Q3. `Collections.synchronizedMap` vs `ConcurrentHashMap` — when would you pick each?

| | `synchronizedMap`(HashMap) | `ConcurrentHashMap` |
|---|---|---|
| Locking | One lock, every method | Per-bin CAS/lock; reads lock-free |
| Read scaling | Serialized | Near-linear |
| Iteration | Must externally `synchronized(map){…}` or risk `ConcurrentModificationException` | Weakly consistent, no lock, never throws CME |
| `null` keys/values | Allowed | **Not** allowed (ambiguity with "absent") |
| Atomic compound ops | None built in | `putIfAbsent`, `compute`, `merge`, `computeIfAbsent` |

Pick `ConcurrentHashMap` for essentially all concurrent map use — it's strictly better under contention and offers the atomic compound operations you actually need. `synchronizedMap` is a quick retrofit to make an existing single-threaded map "safe enough" for low-contention use, but its iteration story is a footgun: iterating requires holding the lock for the whole loop, which reintroduces serialization. The null-key restriction on `ConcurrentHashMap` is deliberate: with concurrent readers, `map.get(k) == null` can't distinguish "absent" from "present with null value" without a race, so nulls are banned.

### Q4. Why isn't "wrap it in a lock" always enough? Show the compound-operation bug.

Because a lock (or a concurrent collection) makes each *call* atomic, but real logic spans multiple calls, and the lock is released between them. Classic check-then-act:

```java
// BROKEN even with a ConcurrentHashMap:
if (!map.containsKey(key)) {   // T1 and T2 both see "absent"
    map.put(key, compute());   // both put -> one overwrites / double work
}
```

```text
T1: containsKey(key) -> false
T2: containsKey(key) -> false     (interleaves before either put)
T1: put(key, v1)
T2: put(key, v2)                  key ends up v2; v1's work wasted / lost
```

Each individual method is atomic and the map's invariants are fine — but the *compound* "insert if absent" is not atomic, so the intended invariant ("compute once") is violated. Fixes:

- Use the structure's **built-in atomic compound op**: `map.putIfAbsent(key, v)` or `map.computeIfAbsent(key, k -> compute())` (which also computes at most once).
- Or hold **one lock across the whole check-then-act**, turning the two calls into one critical section.

This is the single most common concurrency bug with "thread-safe" collections: developers assume per-method safety composes. It doesn't.

### Q5. Explain copy-on-write. When is `CopyOnWriteArrayList` the right choice — and when is it a trap?

**Copy-on-write**: the backing array is never mutated in place. Every write (`add`/`set`/`remove`) takes a lock, **copies the entire array**, applies the change to the copy, then atomically swaps in the new array (a `volatile` reference). Readers just read the current `volatile` array reference and never lock — they operate on an immutable snapshot.

```text
readers ---> [ array v1 ]        (no lock, snapshot semantics)
writer:  copy v1 -> mutate -> publish v2 (volatile swap)
readers already iterating v1 finish on v1, unaffected
```

Consequences:
- **Reads/iteration: free and safe.** Iterators reflect the array at creation time — no CME, no locking, but they won't see later writes.
- **Writes: O(n) each** (full array copy) plus a lock.

Right choice when reads massively dominate writes and the collection is small: **listener/observer lists, config/subscriber sets, routing tables** that change rarely at startup or reconfig but are read on every event. It shines because event dispatch never blocks on a mutation.

Trap: any write-heavy or large collection. Appending N items becomes O(N²) copying; memory churns with garbage arrays. If you're calling `add` in a loop, COW is the wrong structure — reach for `ConcurrentLinkedQueue`, a `ConcurrentHashMap`-backed set, or a properly locked structure.

### Q6. Blocking vs lock-free queues — how do you choose?

**Blocking queue** (`ArrayBlockingQueue`, `LinkedBlockingQueue`): `put` blocks when full, `take` blocks when empty, using a lock + condition variables. This blocking *is the feature* — it gives you **backpressure** (fast producer parks until the consumer catches up) and lets consumer threads sleep instead of spin. It's the default for producer-consumer handoffs and thread-pool work queues.

**Lock-free queue** (`ConcurrentLinkedQueue`, Michael-Scott algorithm): never blocks; enqueue/dequeue are CAS retry loops. Unbounded, so no built-in backpressure, and an empty `poll()` returns `null` rather than waiting (you must spin or park yourself).

| | Blocking queue | Lock-free queue |
|---|---|---|
| Empty/full behavior | Parks the thread | Returns null / never blocks |
| Backpressure | Built in (bounded) | You build it |
| Under contention | Lock + condvar overhead | CAS retries, no context switch |
| Consumer idle | Sleeps (cheap) | Spins or you park it |
| Use when | Handoff needs backpressure / rate-matching | Very high throughput, you manage flow |

Rule of thumb: reach for a **bounded `BlockingQueue`** first — it's simpler, gives backpressure for free, and blocking-when-idle is efficient. Move to lock-free only when profiling shows the queue lock is the bottleneck under heavy contention.

### Q7. What do SPSC, MPSC, and MPMC mean, and why does the count of producers/consumers change the algorithm?

They classify a queue by how many threads touch each end: **S**ingle or **M**ultiple **P**roducers × single/multiple **C**onsumers.

- **SPSC** — one producer, one consumer. The cheapest: with only one writer to the tail and one reader of the head, you often need **no CAS at all** — plain `volatile`/atomic index reads/writes with the right fences suffice (each end has a single owner). This is the fastest possible queue.
- **MPSC** — many producers, one consumer. Producers must CAS to claim a slot/link the tail; the single consumer can read the head without contending with other consumers.
- **MPMC** — many of both. Every operation on both ends contends, so both head and tail need CAS (or per-slot sequence numbers, as in Vyukov's bounded MPMC ring).

Fewer contenders on an end means you can drop synchronization on that end. That's why libraries ship *different* queue implementations per pattern (JCTools has `SpscArrayQueue`, `MpscArrayQueue`, etc.): specializing to the actual pattern removes CAS operations and cache-line ping-pong, often doubling throughput. Using an MPMC queue when your topology is really SPSC leaves a lot of performance on the table. So the first design question is always: *how many producers, how many consumers?*

### Q8. What is a ring buffer, and what makes the LMAX Disruptor fast?

A **ring buffer** is a fixed-size array used circularly: a producer sequence and a consumer sequence advance monotonically, and `index = sequence & (size - 1)` (power-of-two size) wraps around. Slots are **pre-allocated once**, so steady-state operation does zero allocation and produces zero garbage.

The **LMAX Disruptor** is a high-performance ring-buffer framework. What makes it fast:
- **No per-item allocation / GC pressure** — slots are reused; you mutate entries in place.
- **Single-writer principle + sequence claiming** — producers claim a slot via one atomic increment; consumers track their own sequence and batch whatever's available.
- **Mechanical sympathy**: sequences are **cache-line padded** to avoid *false sharing* (see the scaling topic), and the array layout is cache-friendly (contiguous, prefetchable).
- **No locks on the hot path** — coordination is memory barriers on published sequences, not mutexes, so no lock contention or convoying.
- **Multicast for free** — multiple consumers can each read the same slots at their own pace (a dependency graph), which a linked queue can't do cheaply.

```text
      producer seq --v
  [ e0 ][ e1 ][ e2 ][ e3 ][ e4 ][ e5 ]   (wraps around)
             ^-- consumer seq
```

It's the go-to when you need millions of messages/sec with predictable low latency (trading, logging pipelines) and can fix the buffer size.

### Q9. Sketch a lock-free (Treiber) stack and explain the ABA problem.

A **Treiber stack** is a singly-linked stack where push/pop are CAS loops on the `head` pointer:

```java
void push(T v) {
    Node n = new Node(v);
    Node h;
    do { h = head.get(); n.next = h; }
    while (!head.compareAndSet(h, n));   // retry if head moved
}
T pop() {
    Node h;
    do {
        h = head.get();
        if (h == null) return null;
    } while (!head.compareAndSet(h, h.next));  // <-- ABA lurks here
    return h.value;
}
```

**ABA**: `pop` reads `head == A` and plans to CAS it to `A.next`. Before the CAS, other threads pop A, pop B, then push A back. `head` is `A` again — the CAS *succeeds* because the pointer value matches — but `A.next` now points at freed/reused memory, corrupting the stack.

```text
T1: read head=A, remember A.next=B, pause
T2: pop A, pop B, push A   (head: A->B->... becomes A->? )
T1: CAS(head, A -> B)  succeeds! but B was removed -> corruption
```

The pointer went A→B→A, so equality can't detect the change. Fixes: **tagged/versioned pointers** (CAS a {pointer,counter} pair with double-width CAS so the counter always differs), **hazard pointers** or **epoch-based reclamation** (don't reuse a node while another thread might still reference it), or a GC'd language where the node isn't freed while referenced (Java sidesteps *use-after-free*, but ABA can still cause logical corruption with reused sentinels). ABA is *the* reason lock-free memory reclamation is hard.

### Q10. Design a thread-safe bounded blocking queue with locks and condition variables.

Bounded buffer / producer-consumer. One lock, two condition variables — one for "not full" (producers wait), one for "not empty" (consumers wait). Always wait in a `while` loop on the predicate (spurious wakeups + the fact that another thread may grab the slot first).

```java
class BoundedQueue<T> {
    private final Object[] buf;
    private int count, head, tail;
    private final ReentrantLock lock = new ReentrantLock();
    private final Condition notFull  = lock.newCondition();
    private final Condition notEmpty = lock.newCondition();

    BoundedQueue(int cap) { buf = new Object[cap]; }

    void put(T x) throws InterruptedException {
        lock.lock();
        try {
            while (count == buf.length) notFull.await(); // wait until space
            buf[tail] = x; tail = (tail + 1) % buf.length; count++;
            notEmpty.signal();          // wake one consumer
        } finally { lock.unlock(); }
    }
    @SuppressWarnings("unchecked")
    T take() throws InterruptedException {
        lock.lock();
        try {
            while (count == 0) notEmpty.await();  // wait until item
            T x = (T) buf[head]; head = (head + 1) % buf.length; count--;
            notFull.signal();           // wake one producer
            return x;
        } finally { lock.unlock(); }
    }
}
```

Key points to say out loud: (1) **`while`, not `if`** around `await` — spurious wakeups and lost races demand re-checking the predicate. (2) Use **two** conditions so a producer's signal wakes a consumer, not another producer (avoids useless wakeups / possible signal loss with a single condition). (3) `signal` inside the lock; the awaiter re-acquires the lock on wakeup. (4) `finally` guarantees unlock. This is exactly what `ArrayBlockingQueue` does internally.

### Q11. What are immutable and persistent data structures, and how do they help concurrency?

An **immutable** structure never changes after construction, so it is **thread-safe with zero synchronization** — no writes means no data races, and readers need no locks or visibility fences (once safely published). The concurrency story becomes trivial: share freely.

The catch is "modification." A naive immutable list copies everything on each change — O(n) per update. **Persistent data structures** solve this with **structural sharing**: an "update" returns a *new version* that reuses most of the old version's nodes, changing only the path to the modified element.

```text
Immutable map update (HAMT / tree):
  old root ---> [ A ][ B ][ C ]
  new root ---> [ A'][ B ][ C ]   (only A' is new; B,C shared)
```

Examples: Clojure's vectors/maps (HAMT — hash array mapped trie, ~O(log32 n) updates), Scala's immutable collections, Java's `List.of`/`Map.of` (immutable but not structurally-sharing on update). Because old versions stay valid, you get **snapshot isolation for free** (a reader holds a consistent version while writers produce new ones — MVCC-flavored), and lock-free publishing is just a `volatile`/atomic reference swap to the new root. This is why functional-first languages lean on persistent structures for concurrency: the hard problem (coordinating mutation) is designed away.

### Q12. What is a concurrent skip list and why use it over a locked tree?

A **skip list** is a probabilistic ordered structure: a base linked list with several "express lane" linked lists above it, each level skipping over more nodes, giving O(log n) search/insert/delete expected. Java's `ConcurrentSkipListMap`/`Set` use it as the concurrent **sorted** map/set.

Why a skip list rather than a balanced tree (red-black/AVL) for concurrency: **tree rebalancing rotates subtrees**, which touches many nodes and is painful to make lock-free — a rotation must atomically re-point several parent/child links. Skip-list inserts and deletes are **local**: you CAS a few `next` pointers to splice a node in/out at each level, with no global rebalancing. That locality makes a **lock-free** implementation tractable (CAS the base-level link to logically insert/delete, then fix up express lanes lazily). Result: an ordered map with lock-free reads, weakly-consistent iteration, and good scaling — at the cost of more memory (tower pointers) and cache-unfriendly pointer chasing versus an array-backed tree. Use it when you need a **concurrent sorted** map/navigable set (range queries, `ceilingKey`, `firstKey`); use `ConcurrentHashMap` when you only need hashing (it's faster and denser).

### Q13. Why do concurrent collections offer weakly consistent iterators instead of fail-fast ones?

A **fail-fast** iterator (plain `ArrayList`/`HashMap`) tracks a modification counter and throws `ConcurrentModificationException` if the collection changes during iteration — a debugging aid for single-threaded misuse, not a concurrency guarantee. Under real concurrency it's useless: it would throw constantly, since other threads legitimately mutate the collection.

A **weakly consistent** iterator (`ConcurrentHashMap`, `ConcurrentLinkedQueue`, `ConcurrentSkipListMap`):
- **Never throws CME** — it tolerates concurrent modification.
- Traverses **without locking** the whole structure, so iteration doesn't serialize other threads.
- Reflects the state at *some* point — it will see elements present at iterator creation, *may or may not* see insertions/removals that happen during iteration, but never sees an element twice or in a corrupt state.

The tradeoff is **no snapshot guarantee**: you can't assume the iteration is a consistent point-in-time view. If you need an exact snapshot, either use `CopyOnWriteArrayList` (iterator = true immutable snapshot) or copy under a lock. Weak consistency is the deliberate price for lock-free, scalable traversal — the collection chooses "keep making progress and never crash" over "give an exact frozen view."

### Q14. You need a cache shared by many threads. Which structure and why?

Default answer: **`ConcurrentHashMap` with `computeIfAbsent`** for the "load once on miss" pattern.

```java
ConcurrentHashMap<Key, Value> cache = new ConcurrentHashMap<>();
Value get(Key k) {
    return cache.computeIfAbsent(k, this::expensiveLoad); // atomic, loads once
}
```

Why: `computeIfAbsent` makes check-then-load **atomic per key**, so concurrent misses on the same key don't all trigger the expensive load (avoids the Q4 compound-op race and cache stampede). Reads are lock-free and scale; writes only lock the affected bin.

Caveats to raise:
- The mapping function **must not** modify the same map (re-entrancy/deadlock) and should be quick or side-effect-free; a slow loader holds the bin lock, blocking other writers to that bin. For expensive loads, store a `Future`/`CompletableFuture` as the value so only one thread computes while others await the future.
- Plain `ConcurrentHashMap` has **no eviction / TTL / size bound** — it grows forever. For a real cache use **Caffeine** (or Guava `LoadingCache`): concurrent, with size/weight/TTL eviction, async loading, and stampede protection built in.
- If entries are immutable and the set changes rarely, an immutable map swapped atomically (`volatile` reference) can beat a mutable concurrent map for read-only-heavy workloads.

### Q15. Why can't you just make any single-threaded structure thread-safe by adding a lock around every method?

You *can* make it **safe** that way (this is exactly `Collections.synchronizedX`), but it's usually wrong for three reasons:

1. **Compound operations still race.** Per-method locking doesn't cover check-then-act sequences (Q4). Callers must lock across multiple calls, and if the wrapper doesn't expose the lock, they can't. So "thread-safe methods" quietly fail to make client transactions atomic.
2. **It serializes everything and kills scaling.** One lock means one thread in the structure at a time — no read parallelism, no disjoint-write parallelism. On a many-core box, a hot coarse-locked collection becomes a **contention bottleneck** (lock convoy, cache-line ping-pong on the lock word) that can make adding threads *slower*. Purpose-built concurrent structures use striping/CAS/COW to let disjoint operations proceed in parallel.
3. **Iteration and composite invariants leak.** Iterators, `size`-then-`remove`, or any operation exposing internal state need the lock held *across* the operation, which the wrapper can't enforce.

So: locking-around-methods is a correct *stopgap* for low-contention retrofits, but a real concurrent structure is co-designed with its synchronization strategy — choosing striping vs COW vs lock-free based on the workload — precisely because uniform coarse locking is either unsafe (compound ops) or unscalable (contention). "Add a lock" solves *a* problem; it doesn't solve *the* problem.

### Q16. `ConcurrentHashMap` vs a lock-free `ConcurrentLinkedQueue` — same idea or different, and when each?

Different structures for different jobs, though both are "concurrent." A map is **keyed random-access shared state**; a queue is a **handoff channel between threads** (producer→consumer ordering).

- Use `ConcurrentHashMap` when threads **look things up / update by key**: caches, registries, counters (`merge(k, 1, Integer::sum)`), dedup sets. It's optimized for parallel reads and disjoint-key writes.
- Use a **queue** when threads **hand work to each other**: producer-consumer, work distribution, event pipelines. Then the sub-choice is:
  - **Bounded `BlockingQueue`** (`ArrayBlockingQueue`) — you want **backpressure** and idle consumers to sleep. Default for thread pools.
  - **`ConcurrentLinkedQueue`** (lock-free, unbounded, Michael-Scott) — extreme throughput, no blocking, and you handle emptiness/flow yourself. No backpressure, so an unbounded queue can grow without limit if producers outpace consumers (a memory-leak / OOM risk).

The tell of a strong answer: recognizing that a queue is the shared-memory realization of a **channel**, which is the entire premise of the next topic — you can build the same producer-consumer system either by sharing a concurrent queue (shared-memory style) or by "sharing memory by communicating" over a channel (CSP style). Same problem, two paradigms.

## Message Passing, Channels & CSP

### Summary

**What this topic covers**

The second grand paradigm of concurrency: instead of many threads sharing mutable state behind locks, independent processes **communicate by sending messages**, and the message passing *is* the synchronization. This topic is built around **channels** (Go's `chan`, the concrete artifact), **CSP** (Hoare's Communicating Sequential Processes, the theory), and Go as the mainstream embodiment — goroutines + channels + `select`. The 16 questions cover: buffered vs unbuffered channels and their rendezvous semantics; `select` for multiplexing; the standard Go patterns (pipelines, fan-in/fan-out, worker pools); `context` for cancellation and timeouts; **backpressure** via bounded channels; how deadlocks arise from unbuffered channels; and the honest tradeoffs of channels vs locks. The framing slogan, from Rob Pike: **"Don't communicate by sharing memory; share memory by communicating."** You still have shared data — but exactly one goroutine owns it at a time, and ownership is transferred *through* the channel, so there's nothing to lock.

**Mental model**

Picture goroutines as workers connected by conveyor belts (channels). A worker never reaches into another's workspace; it puts a finished item on a belt and forgets it. An **unbuffered** channel is a **synchronous handoff / rendezvous**: sender and receiver must both arrive; whoever comes first blocks until the other shows up, then the value passes and both proceed. A **buffered** channel is a bounded mailbox: send blocks only when full, receive only when empty. Because the channel operation both moves the value *and* synchronizes the two goroutines (establishing happens-before), you don't separately lock the data — the value's ownership moves with it. `select` lets one goroutine wait on several channels at once (the message-passing analog of waiting on multiple condition variables). Cancellation and timeouts are themselves messages: a closed `Done` channel is a broadcast "stop." Design flows as **graphs of stages** connected by channels; the shape of the graph (pipeline, fan-out, fan-in) is your concurrency structure.

**Key terms**

- **Message passing** — concurrency by sending values between isolated units, not by sharing memory.
- **CSP (Communicating Sequential Processes)** — Hoare's formalism: independent processes synchronize by communicating over channels; the basis for Go and occam.
- **Channel** — a typed conduit; sending/receiving both transfers a value and synchronizes the two parties.
- **Unbuffered channel** — capacity 0; send and receive **rendezvous** (both block until paired).
- **Buffered channel** — capacity N; send blocks only when full, receive only when empty; decouples sender/receiver rate up to N.
- **`select`** — wait on multiple channel operations; proceeds with whichever is ready (random among several ready), with optional `default` for non-blocking.
- **Goroutine** — a lightweight, runtime-scheduled coroutine (a few KB stack, multiplexed onto OS threads by the GMP scheduler).
- **Pipeline** — stages connected by channels, each stage a goroutine transforming values.
- **Fan-out / fan-in** — split work across N workers reading one channel; merge N result channels into one.
- **Backpressure** — a bounded channel forces a fast producer to block when the consumer lags, matching rates.
- **`context.Context`** — Go's standard mechanism to propagate cancellation, deadlines, and timeouts across goroutines via a `Done()` channel.
- **Close** — `close(ch)` signals "no more values"; receivers drain remaining values then get the zero value with `ok == false`; a common broadcast-to-many signal.

**Why interviewers ask this**

Message passing is the "other half" of concurrency, and many candidates only know locks. Interviewers want to see you (a) reach for channels when the problem is a *flow of work* rather than shared state, and (b) still know when a plain `sync.Mutex` is the better tool. A senior Go answer explains unbuffered-channel rendezvous precisely, uses `select` + `context` for cancellation/timeouts instead of leaking goroutines, and identifies backpressure as a *feature* of bounded channels — not just "make it buffered to avoid blocking." The classic deadlock question ("this program hangs, why?") tests whether you truly understand that an unbuffered send needs a ready receiver. And the "channels vs mutex" question tests judgment: the idiomatic-Go crowd sometimes over-uses channels where a mutex-guarded counter is simpler and faster.

**Common confusions**

- "Buffering makes channels asynchronous / removes blocking" — it only defers blocking until the buffer fills; a full buffered channel blocks the sender exactly like an unbuffered one. Buffering ≠ unlimited.
- "Message passing has no shared memory" — under the hood there is memory; the discipline is that ownership is *transferred*, so only one goroutine touches it at a time. (Go still has data races if you keep touching shared data after sending it — `go build -race` exists for a reason.)
- "Unbuffered send returns once the value is buffered" — there's no buffer; the send blocks until a receiver takes it (rendezvous).
- "`select` with no ready case busy-waits" — no; without `default` it blocks efficiently until a case is ready. `default` is what makes it non-blocking (and potentially a spin loop).
- "Closing a channel from the receiver / closing twice is fine" — closing is the *sender's* job; sending on or closing a closed channel panics. Receivers detect close via the `ok` flag.
- "Channels are always faster/cleaner than locks" — for simple shared counters or caches, a mutex is simpler and lower-overhead; channels add scheduling and allocation cost.

**Why this matters / what follows**

This topic reframes the queue from the previous topic (Concurrent Data Structures) as a **first-class abstraction** rather than a helper — a channel is essentially a typed, synchronizing blocking queue, and buffered-channel backpressure is the same backpressure a bounded `BlockingQueue` gives you. It pairs directly with the next topic, **The Actor Model**, which is the other message-passing style: CSP uses *anonymous* channels (processes name the pipe), while actors use *named* recipients (you address a mailbox). The cancellation/timeout patterns here (`context`) connect to structured concurrency and the futures/async topics. And the "channels vs locks" judgment ties straight back to the shared-memory topics — knowing both paradigms, and when each fits, is the senior signal this whole primer is building toward.

### Q1. What does "share memory by communicating" mean, and how is it different from shared-memory concurrency?

It's Go's design slogan (Rob Pike): **"Don't communicate by sharing memory; share memory by communicating."** In shared-memory concurrency, multiple threads reach into the *same* variables and you bolt on locks to keep them from stepping on each other — the data sits still and threads take turns. In message passing, the data **moves**: one goroutine owns a piece of state, does its work, then sends it down a channel to the next owner. At any moment exactly one goroutine holds it, so there's nothing to lock.

```text
Shared memory:                 Message passing:
  T1 --\                          G1 --[chan]--> G2 --[chan]--> G3
        [ state + lock ]          (ownership of the value moves along)
  T2 --/                          only the current owner touches it
```

The synchronization is *implicit in the send/receive*: handing the value over the channel both transfers ownership and establishes a happens-before edge, so the receiver safely sees everything the sender wrote. You trade "many threads + explicit locks around shared data" for "isolated goroutines + explicit channels between them." The data still lives in memory — the *discipline* is that you pass it rather than share it.

### Q2. Buffered vs unbuffered channels — what's the difference in blocking behavior?

**Unbuffered** (`make(chan T)`, capacity 0): a **rendezvous**. A send blocks until some goroutine is ready to receive; a receive blocks until some goroutine is ready to send. The value passes only when *both* are present — it's a synchronous handoff, and it also synchronizes the two goroutines in time.

**Buffered** (`make(chan T, N)`): a bounded queue of capacity N. Send blocks only when the buffer is **full**; receive blocks only when it's **empty**. Up to N sends can complete without any receiver present, decoupling producer and consumer rates by N.

```text
Unbuffered (cap 0):           Buffered (cap 2):
 send ---|                     send send send | (3rd blocks: full)
         |-- must meet         [ x ][ y ]
 recv ---|                     recv drains, freeing slots
```

Key nuance: buffering does **not** make sends "async forever" — a full buffered channel blocks the sender exactly like an unbuffered one. The buffer just gives slack equal to its capacity. Use unbuffered for tight synchronization / guaranteed handoff (the receiver has definitely taken it before the sender continues); use a small buffer to smooth bursty rates while still bounding memory and preserving backpressure.

### Q3. What is CSP and how does Go implement it?

**CSP (Communicating Sequential Processes)** is Tony Hoare's 1978 formalism for concurrency: a system is a set of independent **sequential processes** that have no shared state and coordinate solely by **communicating over channels**, where communication is a synchronized event (both parties rendezvous). It's a *theory* — you can reason about (even model-check) the composition of processes purely from their communication behavior. Languages before Go used it too (occam, on the Transputer).

Go implements CSP pragmatically:
- **Processes → goroutines**: `go f()` spawns a lightweight, runtime-scheduled process.
- **Channels → `chan T`**: typed, first-class, synchronizing conduits (Go adds *buffered* channels, which pure CSP doesn't have — pure CSP channels are unbuffered rendezvous).
- **Guarded choice → `select`**: wait on multiple channel operations, proceed with whichever is ready.

Go deliberately isn't *pure* CSP: goroutines *can* still share memory (Go has `sync.Mutex`, and `go build -race` exists because you can misuse it), whereas strict CSP forbids shared state. But the idiomatic style — isolated goroutines connected by channels, structured as pipelines and worker pools — is CSP in practice. The slogan "share memory by communicating" is Go telling you to *prefer* the CSP style even though the language doesn't force it.

### Q4. Explain `select`. What are its semantics with multiple ready cases and with `default`?

`select` lets one goroutine wait on **several channel operations at once**, blocking until one can proceed — the message-passing analog of waiting on multiple condition variables.

```go
select {
case v := <-in:        // receive ready
    handle(v)
case out <- result:    // send ready
    // sent
case <-ctx.Done():     // cancellation signal
    return ctx.Err()
case <-time.After(2 * time.Second):  // timeout
    return errTimeout
}
```

Semantics:
- If **no case is ready**, `select` **blocks** efficiently (no busy-wait) until one becomes ready.
- If **multiple cases are ready**, it picks one **uniformly at random** — this is deliberate, to prevent starvation and to keep programs from depending on case order.
- A **`default` case** makes the `select` **non-blocking**: if nothing else is ready, `default` runs immediately. This is how you do a non-blocking send/receive or poll — but a `select { default: }` in a tight loop is a **busy-wait**, so use it carefully.

`select` is the workhorse for combining data channels with control channels: receive work, honor cancellation (`ctx.Done()`), and enforce timeouts (`time.After`) all in one construct — the idiomatic way to avoid goroutine leaks.

### Q5. Show a pipeline pattern in Go.

A **pipeline** chains stages, each a goroutine that reads from an input channel, transforms values, and sends to an output channel. Stages run concurrently; the channels connect them and provide backpressure.

```go
func gen(nums ...int) <-chan int {
    out := make(chan int)
    go func() { defer close(out); for _, n := range nums { out <- n } }()
    return out
}
func sq(in <-chan int) <-chan int {
    out := make(chan int)
    go func() {
        defer close(out)
        for n := range in { out <- n * n } // range ends when 'in' is closed
    }()
    return out
}
func main() {
    for r := range sq(sq(gen(2, 3))) { // 2,3 -> 4,9 -> 16,81
        fmt.Println(r)
    }
}
```

```text
gen ──chan──> sq ──chan──> sq ──chan──> main (consumer)
```

Conventions that make pipelines correct: each stage **closes its output** when done (`defer close(out)`), and downstream stages **`range`** over the input so they terminate automatically when the upstream closes. Values flow lazily — an unbuffered channel means `gen` only produces as fast as `sq` consumes (backpressure all the way up). The remaining hard part is *early termination* (consumer stops before draining), which needs a cancellation/`done` channel or `context` so upstream goroutines don't block forever and leak (see Q7/Q11).

### Q6. Show fan-out / fan-in and a worker pool.

**Fan-out**: start N worker goroutines all receiving from the *same* input channel — the runtime hands each queued item to one free worker, distributing load. **Fan-in**: merge the workers' output channels back into one.

```go
func worker(jobs <-chan int, results chan<- int, wg *sync.WaitGroup) {
    defer wg.Done()
    for j := range jobs {        // many workers share 'jobs' (fan-out)
        results <- heavy(j)
    }
}
func main() {
    jobs := make(chan int, 100)
    results := make(chan int, 100)
    var wg sync.WaitGroup

    for w := 0; w < runtime.NumCPU(); w++ { // pool sized to cores (CPU-bound)
        wg.Add(1)
        go worker(jobs, results, &wg)
    }
    go func() { for _, j := range inputs { jobs <- j }; close(jobs) }()
    go func() { wg.Wait(); close(results) }() // fan-in: close when all done
    for r := range results { use(r) }
}
```

```text
             ┌─> worker1 ─┐
 jobs chan ──┼─> worker2 ─┼──> results chan  (fan-in)
             └─> worker3 ─┘
      (fan-out: N workers share one input)
```

This is a **worker pool**: a fixed number of goroutines (bounding concurrency, unlike spawning one goroutine per job) draining a jobs channel. Size the pool ~`NumCPU` for CPU-bound work, higher for IO-bound (Little's law — enough workers to cover the latency). The `WaitGroup` + "close results when all workers finish" is the standard fan-in shutdown; ranging over `results` then terminates cleanly.

### Q7. How do you do cancellation and timeouts with `context`?

`context.Context` is Go's standard way to propagate **cancellation, deadlines, and timeouts** across a tree of goroutines. Its `Done()` method returns a channel that's **closed** when the context is cancelled or expires; goroutines `select` on it to bail out.

```go
ctx, cancel := context.WithTimeout(parent, 2*time.Second)
defer cancel() // always call cancel to release resources / stop the timer

func worker(ctx context.Context, in <-chan Job) error {
    for {
        select {
        case <-ctx.Done():          // cancelled or timed out
            return ctx.Err()        // context.Canceled or DeadlineExceeded
        case j, ok := <-in:
            if !ok { return nil }
            process(ctx, j)         // pass ctx down so sub-calls also cancel
        }
    }
}
```

How it works: cancellation is a **broadcast via channel close** — closing `Done()` unblocks *every* goroutine selecting on it simultaneously, and it propagates down the context tree (cancelling a parent cancels all children). `WithTimeout`/`WithDeadline` auto-cancel when time runs out; `WithCancel` gives you a manual `cancel()`. Rules: pass `ctx` as the first argument down every blocking/IO call, always `defer cancel()` (even on the timeout variant, to free the timer), and check `ctx.Done()` in any loop or select that could block. This is *the* idiom for not leaking goroutines when the caller gives up.

### Q8. What is backpressure and how do channels provide it?

**Backpressure** is a fast producer being forced to slow down when the consumer can't keep up — flow control that prevents unbounded queue growth (memory blowup) and matches rates end to end. A **bounded** channel provides it for free: when the channel (buffer) is full, the **send blocks**, so the producer literally cannot get ahead of the consumer by more than the buffer size.

```text
producer --> [ chan cap N ] --> consumer
if consumer slow -> buffer fills -> producer's send BLOCKS
=> producer rate throttled to consumer rate (minus N slack)
```

This is why you should think hard before making a channel large or "unbounded-ish": an oversized buffer *hides* backpressure, letting the producer race ahead, pile up memory, and turn a latency problem into an OOM. A small bounded buffer (even capacity 0, unbuffered) keeps the producer honest. Contrast with an unbounded queue / unbuffered-off design where a producer can enqueue forever — the classic failure mode of the lock-free `ConcurrentLinkedQueue` from the previous topic. In a pipeline, backpressure **propagates**: if the final consumer stalls, each stage's channel fills in turn and the stall pushes all the way back to the source. That automatic, compositional flow control is one of the biggest practical wins of channel-based design.

### Q9. This program deadlocks. Why?

```go
func main() {
    ch := make(chan int) // unbuffered
    ch <- 42             // send blocks: no receiver ready
    fmt.Println(<-ch)    // never reached
}
```

It deadlocks (Go's runtime detects it: `fatal error: all goroutines are asleep - deadlock!`). An **unbuffered** send is a rendezvous — it blocks until *another* goroutine is ready to receive. Here `main` is the only goroutine; it blocks on `ch <- 42` waiting for a receiver, but the receiver (`<-ch`) is the *next line in the same goroutine*, which can never run because the send never returns. Classic self-deadlock.

```text
main: ch <- 42   (blocks, waiting for a receiver)
      <-ch        <- would receive, but we never get here
      => nobody else exists to receive => deadlock
```

Fixes: (1) do the receive in a **separate goroutine** so there's someone to rendezvous with —
```go
go func() { fmt.Println(<-ch) }()
ch <- 42
```
or (2) make the channel **buffered** (`make(chan int, 1)`) so the send completes into the buffer without a waiting receiver, then the receive drains it. This is the archetypal unbuffered-channel deadlock: an unbuffered send *requires* a concurrently-ready receiver.

### Q10. What happens when you close a channel? What are the rules?

`close(ch)` signals **"no more values will be sent."** After closing:
- **Receivers keep draining** any buffered values, then receive the element **zero value** with the comma-ok flag `false`: `v, ok := <-ch` → `ok == false` means closed and drained. A `for v := range ch` loop **exits automatically** when the channel is closed and drained — this is how pipeline stages know to stop.
- **Sending on a closed channel panics.** So does **closing an already-closed channel**, and closing a `nil` channel.

Rules of thumb:
- **Only the sender closes**, and only when it's the *sole* sender — a receiver must never close (it can't know the sender is done, and closing would make the sender panic).
- With **multiple senders**, don't have them close the shared channel (racy double-close/send-after-close). Instead coordinate shutdown separately — e.g. a `done`/`context` channel to tell senders to stop, and a `sync.WaitGroup` so one owner closes only after all senders have finished.
- Closing is a great **broadcast**: closing a `done` channel unblocks *all* goroutines receiving on it at once (used by `context`).

```go
close(jobs)                 // signal workers: no more jobs
for j := range jobs { ... } // each worker's loop ends when drained
```

Reading from a closed channel is non-blocking and always succeeds (zero value); that asymmetry (receive-safe, send-panics) is why close direction matters.

### Q11. How do goroutines leak, and how do you prevent it?

A **goroutine leak** is a goroutine that blocks forever and is never collected — it holds its stack and any captured references until the process exits. The runtime does *not* garbage-collect a blocked goroutine (it might still be reachable via its channels), so leaks accumulate as latent memory and resource drains.

Most common cause: a goroutine blocked on a **channel send/receive that will never complete** because the other side went away. Classic case — a producer feeding a channel whose consumer stopped early:

```go
// LEAK: if the caller stops ranging early, gen's goroutine blocks on send forever
func gen(nums ...int) <-chan int {
    out := make(chan int)
    go func() { for _, n := range nums { out <- n } }() // no way to cancel
    return out
}
```

Prevention:
- **Give every goroutine a cancellation path** — `select` on a `ctx.Done()` / `done` channel alongside the work channel, so it can exit when the caller gives up.
```go
go func() {
    defer close(out)
    for _, n := range nums {
        select {
        case out <- n:
        case <-ctx.Done(): return  // caller cancelled -> goroutine exits
        }
    }
}()
```
- **Close channels** so `range` loops terminate.
- Ensure the number of sends/receives balances (e.g. fan-in must consume all worker outputs, or workers block on `results <-`).
- Bound with `context` timeouts so nothing blocks indefinitely.

The mental rule: for every goroutine you start, be able to answer *"how does this one end?"* If the answer is "when this channel op completes" — make sure it always will.

### Q12. Channels vs mutexes — when should you use each in Go?

Both are legitimate; the Go proverb is "use whichever is more *expressive* for the problem," but there's real guidance.

| Use a **channel** when… | Use a **mutex** when… |
|---|---|
| Transferring **ownership** of data between goroutines | Protecting a small piece of **shared state** in place |
| Coordinating a **flow of work** (pipeline, worker pool) | Guarding a cache/counter/map accessed by many |
| Signaling **events / cancellation** (done, timeout) | The critical section is tiny and hot |
| You want **backpressure** built in | You just need mutual exclusion, no handoff |

Guidance: reach for a **channel** when the problem is fundamentally about *passing things along* or *orchestrating goroutines*. Reach for a **`sync.Mutex`** (or `sync/atomic`) when you have plain shared state — a counter, a config map, a cache — where a channel would just be a slow, allocating, harder-to-read reimplementation of a lock. A mutex-guarded `map` is simpler and faster than funneling every access through a goroutine + channel. The anti-pattern is idiomatic-Go zealotry: wrapping a simple counter in a channel and goroutine ("the counter goroutine") when `atomic.AddInt64` or a `sync.Mutex` is one line and much cheaper. Match the tool to the shape of the problem: **flow → channels, state → mutex.**

### Q13. How does Go's scheduler run millions of goroutines? (GMP, briefly)

Goroutines are **not** OS threads — they're user-space, runtime-scheduled coroutines multiplexed onto a small pool of OS threads. That's why you can have hundreds of thousands cheaply: a goroutine starts with a tiny (~2–8 KB) growable stack, versus ~1 MB for an OS thread.

The scheduler is **GMP**:
- **G** — a goroutine (its stack + state).
- **M** — an OS thread ("machine"), the thing that actually executes code.
- **P** — a "processor" / scheduling context (there are `GOMAXPROCS` of them, ~= number of cores); a P holds a **local run queue** of runnable Gs and must be held by an M to run Go code.

An M grabs a P, pulls a G off P's local queue, and runs it. When a G **blocks on a channel or syscall**, the scheduler parks that G and runs another — cooperatively, at safe points (channel ops, function calls, etc.), so one blocked goroutine doesn't stall others. **Work-stealing** keeps cores busy: an idle P steals Gs from another P's queue. On a **blocking syscall**, the M detaches from its P so another M can pick up the P and keep running goroutines. The upshot for the programmer: blocking a goroutine (on a channel receive, say) is *cheap* — it just yields the thread to another goroutine — which is exactly what makes the channel-per-stage, goroutine-per-connection style practical.

### Q14. What is the `-race` flag and what class of bug does it catch?

`go build -race` / `go test -race` enables the **race detector** (built on ThreadSanitizer). It instruments memory accesses and synchronization events at runtime, builds a **happens-before** graph, and reports a **data race** when two goroutines access the same memory location, at least one access is a **write**, and there's **no happens-before ordering** between them (no channel op, mutex, `WaitGroup`, atomic, etc. separating them).

```text
DATA RACE
  Write at 0x00c0000180a0 by goroutine 7:
     main.increment()  counter.go:12
  Previous read at 0x00c0000180a0 by goroutine 6:
     main.report()     counter.go:20
```

Crucial properties to state:
- It's a **dynamic** detector: it only flags races on code paths and interleavings that **actually execute** during the run. A race on a rarely-hit path won't be found unless that path runs — so run it under realistic load / stress tests, and it complements (not replaces) careful design.
- **Very few false positives** — if it reports a race, it's real (a genuine unsynchronized concurrent access), even if that particular run "looked fine." Data races are undefined behavior in Go's memory model, so "it worked" is luck.
- ~5–10× slower and more memory, so it's a testing/CI tool, not for production.

It catches the exact bug class that message passing is *supposed* to prevent — but Go lets you share memory anyway, so `-race` is the safety net for when you (or a library) touch shared data after "sending" it.

### Q15. Compare CSP-style channels with the actor model at a high level.

Both are message passing with no shared state, but they differ in **who is named**:

| | CSP / channels (Go) | Actor model (Erlang, Akka) |
|---|---|---|
| Named entity | The **channel** (the pipe) | The **actor** (the recipient) |
| Endpoints | Anonymous processes; anyone with the channel can send/recv | Each actor has an identity/address; you send *to an actor* |
| Coupling | Processes coupled via a shared channel | Sender knows the recipient's address, not vice-versa |
| Sync model | Often **synchronous** rendezvous (unbuffered) | **Asynchronous** — send to a mailbox, never blocks |
| Buffering | Channel may be unbuffered or bounded | Mailbox is (conceptually) unbounded per actor |
| Multiplexing | `select` over many channels | One mailbox per actor; behavior dispatches on message |

In CSP you think in terms of **conduits between anonymous workers** — the channel is the first-class thing, and a goroutine may read/write many channels and `select` among them. In the actor model you think in terms of **addressable stateful entities** — each actor owns a mailbox, processes one message at a time, and you send *to a named actor*, which fits naturally across machines (location transparency). CSP's synchronous rendezvous gives tight coupling/backpressure by default; actors are asynchronous by default (mailbox absorbs bursts, which is why mailbox overflow/backpressure becomes its own concern — the next topic). Neither is strictly better: channels suit in-process pipelines; actors suit distributed, supervised, stateful systems.

### Q16. Design a rate limiter / semaphore using channels.

A buffered channel makes a clean **counting semaphore**: its capacity is the number of permits. Acquire = send (blocks when full), release = receive.

```go
sem := make(chan struct{}, maxConcurrent) // N permits

func handle(job Job) {
    sem <- struct{}{}        // acquire: blocks if N already in flight
    defer func() { <-sem }() // release a permit
    process(job)
}
```

Only `maxConcurrent` goroutines can hold a permit at once, so this **bounds concurrency** (e.g. cap simultaneous outbound calls). `struct{}{}` is a zero-size value — the channel carries no data, just the count.

For a **rate limiter** (X per second, not just concurrency), gate on a ticker-fed channel:

```go
limiter := time.Tick(200 * time.Millisecond) // 5/sec
for req := range requests {
    <-limiter        // wait for the next tick before proceeding
    go serve(req)
}
```

Each receive from `limiter` blocks until the ticker emits, throttling to the tick rate; buffer the ticker channel or use `golang.org/x/time/rate` (token bucket) if you need bursts. The elegance is that both patterns reuse the same primitive — a channel's blocking-when-empty/full behavior *is* the waiting/permit logic, no explicit locks or condition variables. This is the channel-as-synchronization idea (Q1) applied to flow control, and it's the message-passing counterpart to the `Semaphore` you'd use in the shared-memory world.

## The Actor Model

### Summary

**What this topic covers**

The third major concurrency paradigm (after shared-memory and CSP-style channels): a system built from **actors** — independent units that each bundle **private state + a mailbox + a behavior**, communicate *only* by asynchronous messages, and share **no memory whatsoever**. Popularized by Erlang/OTP (telecom, 1980s) and brought to the JVM by Akka, and to Rust/others since. The 16 questions cover: what an actor is and why "no shared memory" eliminates data races by construction; asynchronous message passing and mailboxes; **supervision trees** and the **"let it crash"** philosophy; **location transparency** (an actor reference works the same whether the actor is local or on another machine); how actors differ from CSP channels (named recipients vs anonymous pipes); **backpressure** and mailbox overflow; **ordering guarantees** (per-sender FIFO, but no global order); and the crucial judgment call — when actors genuinely fit (stateful, distributed, fault-tolerant systems) versus when they're overkill (simple in-process parallelism).

**Mental model**

Think of an actor as a **person at a desk with an inbox**. They read one letter at a time, and in response to a letter they may: change what's on their desk (private state), send letters to other people (whose addresses they know), or hire new people (spawn child actors). Nobody else can reach onto their desk — the *only* way to affect an actor is to send it a message. Because an actor processes **one message at a time to completion**, its state is touched by exactly one thread of control at a time, so **there are no locks and no data races inside an actor** — the concurrency is between actors, not inside them. Failures are handled by *hierarchy*: each actor has a **supervisor** (its parent) that decides what to do when a child crashes — restart it, stop it, escalate. So instead of defensive try/catch everywhere, you **let it crash** and let the supervisor restore a known-good state. Design is: *what are the entities, what state does each own, and who supervises whom?*

**Key terms**

- **Actor** — a unit of computation = private **state** + a **mailbox** + a **behavior** (message handler); the only thing that can mutate the state is the actor itself, processing its own messages.
- **Mailbox** — the actor's incoming message queue; messages are enqueued asynchronously and processed one at a time.
- **Message (asynchronous)** — an immutable value sent to an actor's address; **send is fire-and-forget** (non-blocking), unlike a synchronous call.
- **Address / ActorRef** — a handle used to send to an actor without knowing where it physically runs (enables location transparency).
- **Behavior** — how an actor reacts to a message; it can change for the next message (a state machine).
- **Supervision tree** — parent actors supervise children; the hierarchy defines fault handling.
- **Let it crash** — don't defensively handle every error inside the actor; crash and let the supervisor restart to a clean state.
- **Supervision strategy** — the parent's policy on child failure: restart, resume, stop, or escalate (one-for-one vs all-for-one).
- **Location transparency** — sending to an ActorRef is identical whether the actor is in-process or on a remote node.
- **Mailbox overflow / backpressure** — because sends are async and mailboxes conceptually unbounded, a slow actor's mailbox can grow without limit unless you bound it or apply backpressure.
- **Erlang/OTP, Akka** — the canonical actor runtimes (BEAM VM + OTP behaviors; JVM/Scala).

**Why interviewers ask this**

Actors are the model behind highly-available, distributed, stateful systems (telecom switches with "nine nines," WhatsApp's Erlang backend, Akka clusters), so this probes whether you can reason about fault tolerance and stateful concurrency *without* locks. A junior answer says "actors are objects that send messages." A senior answer explains *why* the no-shared-state + one-message-at-a-time design eliminates data races, articulates **let-it-crash** and supervision as a fault-tolerance strategy (not just error handling), and — critically — knows the **limits**: actors don't magically give you distributed transactions, message delivery is at-most/at-least-once (not exactly-once), ordering is only per-sender, and mailbox overflow is a real failure mode. The strongest signal is judgment: recognizing that actors are *overkill* for a simple parallel `map` and *ideal* for millions of stateful, independently-failing entities.

**Common confusions**

- "Actors process messages in parallel" — no; each actor processes its mailbox **one message at a time**. Parallelism is *across* actors. That serialization is exactly what removes the need for locks.
- "Message passing is synchronous like a method call" — actor sends are **asynchronous fire-and-forget**; you don't wait for a result (request/reply is built *on top* via a reply message or a future).
- "No shared memory means no bugs" — you trade data races for *different* bugs: deadlock-by-message (two actors each awaiting the other), mailbox overflow, lost/duplicated messages, and ordering surprises.
- "Delivery is guaranteed and exactly-once" — base actor semantics are **at-most-once** (Akka) or best-effort; exactly-once requires acks/idempotency/dedup you build yourself.
- "Let it crash means ignore errors" — it means *don't tangle recovery into business logic*; the supervisor handles recovery systematically. It's more disciplined error handling, not less.
- "Actors == CSP" — both are message passing, but actors name the **recipient** (mailbox/address) and are asynchronous; CSP names the **channel** and is often synchronous.

**What follows from this topic**

Actors are the endpoint of the message-passing arc that began with the queue (Concurrent Data Structures) and the channel (Message Passing & CSP): a mailbox is a per-actor queue, and actor messaging is CSP's dual — named recipients instead of anonymous channels, async instead of rendezvous. The "no shared mutable state → no data races" argument closes the loop with the shared-memory topics (locks, atomics, the memory model): actors don't *solve* those problems so much as *structurally avoid* them. And supervision/let-it-crash bridges directly into distributed systems and system design — location transparency, at-least-once delivery + idempotency, and backpressure are the same concerns you meet in microservices and message queues (Kafka, SQS). Knowing all three paradigms — and when each fits — is the senior-level synthesis this primer is built to produce.

### Q1. What is an actor? Define it precisely.

An **actor** is the fundamental unit of computation in the actor model (Hewitt, 1973), consisting of three things bundled together:

1. **Private state** — data only the actor itself can read or mutate. No other actor, and no thread, can touch it directly.
2. **A mailbox** — an incoming message queue. Other actors communicate with this actor *only* by placing messages in its mailbox.
3. **A behavior** — a message handler that, in response to a single message, may do any combination of three things: **(a) send** a finite number of messages to other actors (whose addresses it knows), **(b) create** new (child) actors, and **(c) change its behavior/state** for the next message it processes.

```text
   messages in
       │
       ▼
  ┌─────────────┐
  │  [mailbox]  │  one message at a time
  │      │      │
  │   behavior ─┼──> send to others / spawn children / change state
  │      │      │
  │  private state (nobody else can touch)
  └─────────────┘
```

The defining constraints: **no shared memory** (the only way to affect an actor is to send it a message) and **one message at a time** (an actor processes its mailbox sequentially, to completion, before taking the next). Everything else about the model — freedom from data races, supervision, location transparency — follows from those two rules.

### Q2. Why does the actor model have no data races, without any locks?

Because of the two structural constraints, not because of any synchronization primitive:

1. **No shared mutable state.** An actor's state is private; no other actor can read or write it. The classic data-race precondition — "two threads access the same memory, at least one writes" — **can never occur**, because there's no shared memory to race on. The only interaction is message passing, and messages are (by convention/enforcement) immutable values that are *handed over*, not shared.

2. **One message at a time.** An actor processes its mailbox **sequentially** — it fully handles one message before starting the next. So its private state is only ever touched by a *single* logical thread of control at any instant. Inside the behavior you write plain, single-threaded code: no locks, no `volatile`, no atomics, no memory-model reasoning.

```text
Actor A's state:  touched only by A, only while handling one message
  msg1 -> handle (mutate state) -> done
  msg2 -> handle (mutate state) -> done   (never overlaps msg1)
```

The concurrency in the system is **between** actors (many actors run on many cores simultaneously), never **inside** an actor. So the model doesn't *solve* data races with clever locking — it makes them **structurally impossible** by construction. The cost is that all coordination becomes explicit message passing, which introduces its own bug classes (Q11) — but data races, the hardest shared-memory bug, are simply designed out.

### Q3. What does asynchronous message passing mean here, and how does request/reply work if sends don't return a value?

**Asynchronous, fire-and-forget**: when actor A sends a message to actor B (`b ! msg` in Erlang, `b.tell(msg)` in Akka), the send returns **immediately** — A does not block, does not wait for B to process it, and gets **no return value**. The message is just enqueued in B's mailbox; B will process it whenever it gets to it. This is fundamentally unlike a synchronous method call, where the caller blocks until the callee returns.

So how do you get a **result** back? You build request/reply *on top* of one-way sends: A includes its own address in the message, and B, when done, **sends a reply message back** to A.

```text
A --("compute X, reply to me")--> B
                                  B processes, then:
A <--("result of X")------------- B
A handles the reply as just another incoming message
```

Frameworks wrap this pattern: Akka's `ask` (`?`) returns a **`Future`/`CompletableStage`** that completes when the reply arrives (and times out otherwise), so it *looks* synchronous to the caller while staying non-blocking underneath. Erlang's `gen_server:call` does the same with a hidden reply-and-wait. Key implications: you must handle **timeouts** (the reply might never come — the actor could be busy or dead), and because replies are just messages, a slow or crashed B doesn't block A — A keeps handling its own mailbox. Asynchrony is what lets millions of actors interleave on a few threads without any of them blocking each other.

### Q4. Explain supervision trees and the "let it crash" philosophy.

In traditional code you scatter defensive `try/catch` everywhere, trying to anticipate and recover from every error inline — which tangles error handling into business logic and is fragile (you can't foresee every failure). The actor model inverts this: **let it crash.**

**Let it crash**: don't defensively handle unexpected errors inside the actor. If something goes wrong, let the actor **fail fast and crash** — its (possibly corrupted) state is discarded — and rely on a **supervisor** to restart it into a **known-good initial state**. The insight: a fresh restart from a clean state is often more reliable than trying to patch up partially-corrupted state you didn't anticipate. Many transient faults (a bad message, a dropped connection) simply vanish on restart.

**Supervision tree**: actors are arranged in a **hierarchy** — every actor has a parent (its supervisor). When a child crashes, it doesn't just die silently; the failure is **signaled to its parent**, which applies a **supervision strategy**:

```text
        Supervisor
        /    |    \
   WorkerA WorkerB WorkerC   <- if WorkerB throws, Supervisor decides:
```
- **Restart** the child (re-init to clean state) — the default for transient errors.
- **Resume** (keep state, ignore the error) — for benign faults.
- **Stop** the child permanently.
- **Escalate** — the supervisor can't handle it, so it fails too, pushing the decision up the tree.

Strategies also choose scope: **one-for-one** (restart only the failed child) vs **all-for-one** (restart all siblings, when they share fate). This structure localizes failure — a crash is contained to a subtree and handled by policy, not by ad-hoc inline recovery. It's the core of Erlang/OTP's famed reliability ("nine nines" in telecom): the system is *designed to survive component failure*, not to prevent all failures.

### Q5. What is location transparency and why does it matter?

**Location transparency** means you interact with an actor through an **address / reference (ActorRef)** and the code to send a message is **identical** whether that actor lives in the same process, on another core, or on a machine across the network:

```text
recipientRef ! message      // same code regardless of where recipientRef is
```

The runtime (Akka Cluster, Erlang distribution) handles the difference: local delivery is a mailbox enqueue; remote delivery serializes the message and ships it over the network — but your code doesn't change.

Why it matters:
- **Scaling / distribution for free-ish**: you can move actors across nodes, or scale out to a cluster, **without rewriting logic** — the same actor code runs local or remote. This is why actors underpin distributed systems (Akka Cluster, distributed Erlang).
- **It forces good design**: because a send might be remote, the model *makes* you treat all communication as **asynchronous, possibly-failing message passing** from the start — no assuming a call is a fast in-memory return. That discipline is exactly what a distributed system needs.
- **Enables mobility & resilience**: actors can be relocated (rebalanced across a cluster) or restarted on a different node after a machine dies, and their references still resolve.

The honest caveat: location transparency is **not** "the network is invisible." A remote send has real latency, can fail or drop, and serialization has cost — the abstraction hides the *code difference*, not the *physics*. You still design for timeouts, at-least-once delivery, and partial failure (Q9, Q10). But making local and remote *look the same* is precisely what lets an actor system grow from one machine to a cluster without a rewrite.

### Q6. Actors vs CSP channels — what's the real difference?

Both are message-passing, no-shared-state models, but they differ on **what is named** and on **synchrony**:

| | Actor model (Erlang, Akka) | CSP / channels (Go) |
|---|---|---|
| First-class named thing | The **actor** (recipient address) | The **channel** (the pipe) |
| How you send | To a **specific actor** by its address | Into a **channel**; you don't name the receiver |
| Endpoints | Each actor has identity; one mailbox per actor | Processes are anonymous; anyone holding the channel |
| Synchrony | **Asynchronous** — enqueue to mailbox, never block | Often **synchronous** rendezvous (unbuffered) |
| Buffering | Mailbox, conceptually unbounded (overflow risk) | Channel: unbuffered or bounded (backpressure) |
| Fan-in of inputs | One mailbox multiplexes all senders | `select` over multiple channels |
| Fits | Stateful, supervised, **distributed** entities | In-process **pipelines** / worker graphs |

The crisp way to say it: **actors name the receiver; channels name the conduit.** In actors you think "who am I talking to?" — you hold a reference to a stateful entity and send it messages, which maps naturally onto distribution (the entity can be anywhere) and onto the entity owning its state and lifecycle (supervision). In CSP you think "what pipe does this flow through?" — goroutines are anonymous and coordinate via shared channels, which maps naturally onto in-process dataflow pipelines and `select`-based multiplexing. Consequences follow from synchrony: CSP's unbuffered rendezvous gives **built-in backpressure** (sender blocks), while actor sends are async, so **mailbox overflow / backpressure** becomes something you must manage explicitly (Q7). Neither subsumes the other; they're duals suited to different problem shapes.

### Q7. What happens when an actor's mailbox fills up? How do you handle backpressure?

Because actor sends are **asynchronous and non-blocking** and mailboxes are **conceptually unbounded**, a **slow consumer** is a real hazard: if actor A receives messages faster than it can process them, its mailbox **grows without bound** — consuming memory until the process OOMs (or, with a bounded mailbox, messages get **dropped**). Unlike CSP's unbuffered channel, where a fast sender simply *blocks* (automatic backpressure), an actor sender by default just keeps piling messages onto the mailbox and races ahead. This is the actor model's characteristic failure mode.

Ways to apply backpressure:
- **Bounded mailboxes** — cap the mailbox; on overflow, either drop messages (with a defined policy) or, better, signal the sender. Dropping alone isn't backpressure — you also need the sender to *learn* it's overwhelming the receiver.
- **Explicit pull / work-pull pattern** — invert the flow: the consumer *requests* N items when ready (`Ready(n)` messages), so producers only send what the consumer asked for. This is exactly what **Reactive Streams** formalizes (demand signaling), and what **Akka Streams** implements on top of actors to give end-to-end backpressure the raw actor model lacks.
- **Ack-based throttling** — the producer waits for an ack every K messages before sending more, bounding in-flight work.
- **Rate limiting / dropping with intent** — for telemetry-style loads, deliberately shed load (sample, drop oldest) rather than let the mailbox explode.

The key interview point: the raw actor model gives you asynchrony but **not** backpressure for free — you must design it in. This is precisely the tradeoff versus CSP, where the synchronous channel bakes backpressure into the send. It's why higher-level frameworks (Akka Streams, Reactive Streams) exist on top of actors.

### Q8. What ordering guarantees do actor messages have?

The standard guarantee (Erlang, Akka) is **per-sender (pairwise) FIFO ordering, and nothing more**:

- If actor **A sends m1 then m2 to actor B**, then B will process **m1 before m2** — messages from a *single sender to a single recipient* are delivered in send order.
- There is **no global ordering** and **no cross-sender ordering**. If A sends m1 to B and C sends m3 to B, B may see them in either order — the two senders' messages interleave arbitrarily.

```text
A --m1--> B     Guaranteed: B sees m1 before m2 (same sender A)
A --m2--> B
C --m3--> B     No guarantee where m3 falls relative to m1/m2
```

Consequences to call out:
- You **cannot** assume a total order of events across actors. If a protocol needs "step X before step Y" from *different* senders, you must **enforce it explicitly** (sequence numbers, a coordinating actor, or request/reply so the next step only fires after an ack).
- Combined with **at-most-once delivery** (Q9), even the per-sender FIFO guarantee only holds for messages that *are* delivered — a dropped message doesn't get re-ordered, it just vanishes, so downstream logic must tolerate gaps.
- Because an actor processes one message at a time, *within* the actor there's a clean sequential order of handling — but the order in which messages *arrive* from multiple senders is nondeterministic.

This weak-but-useful guarantee is deliberate: enforcing global order would require expensive coordination and kill the model's scalability. You get just enough (per-sender FIFO) to reason about a single conversation, and you build stronger ordering on top only where you actually need it.

### Q9. What are the message-delivery guarantees, and why isn't it exactly-once?

Base actor systems provide **at-most-once** delivery (Akka's default) or best-effort delivery (Erlang): a message is delivered **zero or one times** — it will **never be duplicated**, but it **may be lost** (e.g. the recipient's node crashes, the network drops it, the mailbox overflows). There's no built-in retransmission.

Why not **exactly-once**? Because exactly-once delivery is **impossible to guarantee at the transport level** in a distributed system with failures — it's a classic result. The sender can't distinguish "message lost" from "message delivered but the ack was lost":

```text
A --msg--> B      Did B get it?
A  ...ack lost... A can't tell: resend (risk duplicate) or not (risk loss)
```

So you must choose:
- **At-most-once** (send and forget): never duplicates, may lose. Cheap; fine when loss is tolerable.
- **At-least-once** (retry until acked): never loses, **may duplicate**. You get this by having the sender retry unacked messages (Akka's persistence/`AtLeastOnceDelivery`).

**Exactly-once *processing*** is then achieved not at the transport but at the application level: use **at-least-once delivery + idempotency/dedup** — tag each message with a unique ID, and have the receiver ignore IDs it has already processed. The *effect* is exactly-once even though delivery is at-least-once.

This is the same lesson as distributed messaging generally (Kafka, SQS): don't chase exactly-once *delivery*; design **idempotent** receivers and use at-least-once + dedup. An interviewer raising this is checking that you won't naively assume the actor framework makes messaging reliable and ordered for free.

### Q10. Walk through a concrete Akka/Erlang-style actor example.

A bank-account actor: private balance, handles deposit/withdraw/query messages, no locks anywhere. Erlang-flavored `gen_server` pseudocode:

```text
% state = current balance (private to this actor)
init(Initial) -> {ok, Initial}.

handle(Msg, Balance) ->
    case Msg of
        {deposit, Amt}            -> {ok, Balance + Amt};
        {withdraw, Amt} when Amt =< Balance -> {ok, Balance - Amt};
        {withdraw, _}             -> crash();   % let it crash: bad request
        {query, ReplyTo}          -> ReplyTo ! {balance, Balance},
                                     {ok, Balance}
    end.
```

What's happening and why it's safe:
- The **balance is private state**; the only way to change it is to send this actor a message. Two concurrent `deposit`s can't corrupt it because the actor processes **one message at a time** — the second deposit sees the balance the first one left. **No lock needed**, yet no lost update (contrast the `count++` race from the shared-memory topics — here it's structurally impossible).
- `query` shows **request/reply**: the caller passes its own address (`ReplyTo`); the actor sends the result back as a new message.
- An invalid withdraw **crashes** the actor (let-it-crash); its **supervisor** restarts it to a clean state, or an application-level reply signals the error — recovery is the supervisor's job, not tangled into the handler.

Akka (typed) is the same shape: an immutable `Behavior` receives a message, returns the next `Behavior` (possibly with updated state), and sends replies via `replyTo ! Result`. The takeaway: mutating shared-looking state (an account balance) becomes trivially correct because the actor serializes access to its own state — the model turns a locking problem into a message-ordering problem.

### Q11. If there are no data races, what bugs *do* actor systems have?

Removing shared memory removes data races, but it introduces a different bug catalog — and interviewers love to check you know the model isn't a silver bullet:

- **Deadlock by message / communication deadlock.** Two actors each blocked waiting for a reply from the other (using synchronous `ask`), or a request/reply cycle where each is waiting on the other's message. No locks involved, but the system still hangs. (Mitigated by timeouts on `ask` and avoiding synchronous call chains.)
- **Mailbox overflow / unbounded growth** (Q7) — a slow actor's mailbox grows until OOM, because sends are async and don't backpressure by default.
- **Lost and duplicated messages** (Q9) — at-most-once loses; at-least-once duplicates. Non-idempotent handlers then misbehave.
- **Ordering surprises** (Q8) — assuming a global order that doesn't exist; a message from actor C races a message from actor A.
- **Livelock** — actors endlessly bouncing messages (retries, ping-pong) making no real progress.
- **State-machine bugs** — since behavior changes per message, receiving a valid message in an unexpected state (protocol violations) is a common logic error.
- **Poison messages** — a message that always crashes the actor; with naive supervision it crashes → restarts → reprocesses the same message → crashes forever (a restart loop). Needs a dead-letter queue / max-restart backoff.

The theme: actors convert **memory-level** concurrency bugs (races, torn reads) into **protocol-level** and **flow-control** bugs (deadlock-by-message, overflow, ordering, delivery). Arguably these are easier to reason about (they're at the level of "who sent what to whom") — but they don't vanish. Message passing changes the *kind* of concurrency bug, it doesn't eliminate concurrency bugs.

### Q12. When do actors fit well, and when are they overkill?

**Actors fit when** the problem is **many independent, stateful entities that can fail independently and may be distributed**:

- **Stateful entities at scale** — millions of chat sessions, IoT devices, game players, shopping carts, connections. Each is naturally an actor owning its own state (Akka Cluster Sharding, Orleans "virtual actors"). The one-message-at-a-time rule serializes each entity's state cleanly.
- **Fault-tolerant / always-on systems** — telecom switches, messaging backends (WhatsApp on Erlang), where supervision + let-it-crash give resilience and self-healing.
- **Distributed systems** — location transparency lets you spread entities across a cluster and relocate/restart them across nodes.
- **Long-lived stateful protocols** — where each entity is a state machine reacting to events over time.

**Actors are overkill when**:
- The task is **simple in-process parallelism** — a parallel `map`, a fork-join over a dataset, a thread pool crunching CPU-bound work. A `parallelStream`, an executor, or channels are simpler; introducing actors, mailboxes, and supervision is ceremony with no payoff.
- You need **shared read-mostly state** with occasional writes — a `ConcurrentHashMap` cache is far simpler than routing every access through an actor (which also serializes and can bottleneck).
- You need **strong consistency / transactions across entities** — actors give you per-actor serialization, **not** distributed transactions; coordinating a consistent update across many actors is *harder*, not easier (you're back to sagas, 2PC, consensus).
- **Latency-critical, single-machine** hot paths — the message-dispatch/mailbox overhead can cost more than a direct lock.

The senior signal is exactly this judgment: actors are a **structuring tool for stateful, failure-prone, distributed concurrency**, not a general replacement for threads and locks. Reaching for actors to parallelize a numeric loop is as much a mis-fit as using a raw mutex to build a distributed fault-tolerant service. Match the model to the problem: **shared-memory for tight in-process data parallelism, CSP for in-process pipelines, actors for stateful distributed entities.**

### Q13. How is an actor's mailbox related to the queues and channels from the earlier topics?

They're the same underlying idea — a thread-safe queue used for handoff — surfaced at three different levels of abstraction:

- **Concurrent Data Structures topic**: a `BlockingQueue` / lock-free queue is the *primitive* — an explicit shared structure that producers and consumers both reference.
- **Message Passing & CSP topic**: a **channel** wraps that queue as a *first-class typed conduit*; you name the pipe, and send/receive synchronize.
- **Actor model**: a **mailbox** is a queue that's **private to one actor** — you don't name the queue, you name the *actor*, and its mailbox is an implementation detail of "sending it a message."

```text
queue      : shared structure, both ends reference it explicitly
channel    : named conduit; anonymous endpoints; often synchronous
mailbox    : per-actor queue; you name the recipient, not the queue; async
```

Concretely, an actor framework literally *implements* mailboxes with concurrent queues (e.g. Akka default mailbox = a `ConcurrentLinkedQueue`-style MPSC structure — **many** senders, **one** consumer: the actor itself). That MPSC shape is exactly the SPSC/MPSC/MPMC taxonomy from the concurrent-data-structures topic: an actor mailbox is **MPSC** because any actor can send but only the owning actor reads. So the whole message-passing arc is one idea — a synchronizing queue — with progressively more structure and ownership rules layered on: raw queue → named channel → per-entity mailbox behind an address. Recognizing this unifies the three topics: they're not three unrelated tools but one primitive (the concurrent queue) wearing three different abstraction hats.

### Q14. Compare the three concurrency paradigms: shared-memory, CSP, and actors.

| | Shared memory | CSP / channels | Actors |
|---|---|---|---|
| Core idea | Threads share state, coordinate with locks | Processes pass values over channels | Entities pass async messages to mailboxes |
| Named thing | The **data** (+ its lock) | The **channel** | The **actor** (address) |
| State | **Shared**, mutable | Owned, transferred via channel | **Private** per actor |
| Sync | Locks / atomics / condvars | Send/recv rendezvous (often sync) | Async fire-and-forget |
| Data races | Possible (must prevent) | Avoided by transfer discipline | Structurally impossible |
| Backpressure | Manual (bounded queues) | Built-in (unbuffered send blocks) | Manual (mailbox unbounded) |
| Distribution | Single machine (shared address space) | In-process (usually) | Local **or** remote (transparent) |
| Fault model | Crash corrupts shared state | Goroutine leak / deadlock | Supervision / let-it-crash |
| Exemplars | Java threads, C++ `std::thread`, pthreads | Go, occam | Erlang/OTP, Akka, Orleans |

The through-line: as you move left→right you **give up shared mutable state** in exchange for **isolation**, trading data-race bugs for protocol/flow bugs, and gaining distributability. Shared-memory is the most powerful and the most dangerous (fastest for tight in-process data sharing, but every access is a potential race). CSP isolates via *transferring* ownership through channels and gives synchronous backpressure — great for in-process pipelines. Actors push isolation furthest (fully private state, async, addressable, supervised) — the price is manual backpressure and weaker delivery/ordering guarantees, the reward is fault tolerance and location transparency for distributed stateful systems. No paradigm dominates; the senior skill is picking per problem — and real systems mix them (a Go service uses channels *and* a mutex-guarded cache; an Akka app has actors *and* concurrent collections inside).

### Q15. What is a "virtual actor" (Orleans-style) and how does it differ from classic actors?

Classic actors (Erlang, Akka) are **explicitly managed**: you *create* an actor, hold its `ActorRef`, *supervise* it, and are responsible for *stopping* it and handling its lifecycle. You must know whether an actor exists and manage its placement.

**Virtual actors** (Microsoft **Orleans**' "grains", also Akka's approach evolving toward this) make actors **always-exist, on-demand** entities addressed by a stable **identity** (e.g. `Account/alice`) rather than a physical reference:

- **Always addressable** — you send to `Account/alice` and the runtime **activates** the grain on some node if it isn't currently in memory, or routes to it if it is. You never "create" it; it conceptually always exists.
- **Automatic lifecycle** — the runtime **deactivates** idle grains (frees memory) and **reactivates** them on the next message, transparently. You don't manage placement, activation, or garbage collection.
- **Transparent placement & failover** — the runtime decides which node hosts a grain, rebalances, and reactivates elsewhere after a node failure — with automatic single-activation guarantees per identity.

```text
Classic actor:  you spawn it, hold ref, supervise, stop it (explicit lifecycle)
Virtual actor:  address by identity; runtime activates/deactivates/places it
```

The tradeoff: virtual actors dramatically **simplify the programming model** for huge numbers of stateful entities (millions of user/session grains) — you write pure logic and let the runtime handle distribution, activation, and persistence — at the cost of **less explicit control** over lifecycle and supervision than classic OTP-style trees give you. It's the actor model optimized for *cloud-scale stateful services*: the framing "identity, not instance" is the key mental shift. This is why Orleans powers things like large online games' backend state — you get "a stateful object per player" without managing where any of them physically live.

### Q16. Design a chat system's presence/room service using actors — sketch the actor topology.

Model each **stateful entity** as an actor; the topology mirrors the domain:

```text
                 SupervisorRoot
                 /            \
          RoomShard        UserShard
          /   |   \         /   |   \
     Room#1 Room#2 ...  User:alice User:bob ...
       |                    |
   (member set,         (connection, presence,
    recent msgs)         unread counts)
```

- **One `UserSession` actor per connected user** — private state = their WebSocket handle, presence status, subscriptions. Incoming messages from that user go to their actor; it's a natural per-user serialization point (no locks around per-user state). Millions of them → **cluster sharding** by user id (location transparency spreads them across nodes).
- **One `Room` actor per chat room** — private state = the member set (references to the `UserSession` actors) and maybe recent history. A "post message" message to the room fans out to each member's `UserSession` (which forwards to that user's socket). The room processes joins/leaves/posts one at a time, so membership updates never race.
- **Supervision**: a `RoomShard`/`UserShard` supervisor per node supervises its actors; if a `Room` crashes (poison message, bug), the supervisor **restarts** it to a clean state, rehydrating membership from a store — a crash affects only that room, not the whole service (**fault isolation**).

Why actors fit here (ties to Q12): it's exactly the sweet spot — **many independent, stateful, long-lived entities** (users, rooms), **distributed** across a cluster, each **failing independently**. Presence and messaging are naturally per-entity state machines; supervision gives resilience; location transparency + sharding gives horizontal scale. Concerns to raise: **ordering** (per-sender FIFO means one user's messages stay ordered to a room, but two users' posts interleave — usually fine, or add sequence numbers), **backpressure** (a slow client's `UserSession` mailbox could grow — bound it / drop or apply reactive-streams demand), and **delivery** (at-least-once + client-side dedup so a reconnecting user doesn't miss or double-show messages). This is essentially how real actor-based chat backends (WhatsApp on Erlang, Discord's Elixir presence) are structured.
## Parallelism Patterns & Data Parallelism

### Summary

**What this topic covers**

This topic is about the *shapes* of parallel computation — the recurring structural patterns you reach for once you've decided a problem is worth running on multiple cores (or GPUs). Where earlier topics dealt with correctness primitives (locks, atomics, memory models), this one is about **decomposition**: how do you carve a problem into pieces that run simultaneously, and how do you recombine the results? Three concern areas live here: (1) **the two axes of decomposition** — task parallelism (different operations at once) vs data parallelism (the same operation over many data elements at once); (2) **the pattern catalogue** — map-reduce, parallel-for, divide-and-conquer / fork-join, pipeline parallelism, scatter/gather, SIMD/vectorization, and GPU/SIMT; and (3) **the economics** — granularity vs overhead, embarrassingly-parallel vs coordination-heavy, and how to pick a decomposition that actually pays off. The 16 questions here move from "task vs data parallelism" through fork-join and SIMD to "how do I choose a decomposition and know it will scale."

**Mental model**

Think of parallelism as answering two questions in order. First, **what runs at the same time?** If it's *different code paths on different data* (parse a file while compressing another), that's **task parallelism** — you're overlapping heterogeneous work. If it's *the same operation applied to every element of a big collection* (add two arrays, filter a billion rows), that's **data parallelism** — homogeneous work, and it's the kind that scales best because it's regular and predictable. Second, **how do the pieces combine?** A pure `map` needs no combine; a `reduce` needs an associative combine; a pipeline hands partial results downstream; divide-and-conquer merges sub-results. The single most important dial is **granularity**: too fine and coordination/scheduling overhead dwarfs the useful work; too coarse and you can't fill all the cores or you get load imbalance. The winning mental picture is a spectrum from **embarrassingly parallel** (zero coordination, near-linear speedup) to **coordination-heavy** (frequent synchronization, quickly Amdahl-bound). You're always trying to slide a problem toward the embarrassing end.

**Key terms**

- **Task parallelism** — different, often heterogeneous, tasks execute concurrently; decomposition is by *function*.
- **Data parallelism** — the same operation applied across many data elements in parallel; decomposition is by *data*.
- **Map-reduce** — map a function over elements independently, then reduce with an associative (ideally commutative) combiner.
- **Parallel-for** — a loop whose iterations are independent and split across workers (`#pragma omp parallel for`, `IntStream.range().parallel()`).
- **Fork-join** — recursively split a task, run halves in parallel, join the results; backed by a work-stealing pool.
- **Work stealing** — idle workers steal tasks from the tail of busy workers' deques to balance load.
- **SIMD** — Single Instruction, Multiple Data: one CPU instruction operates on a vector of lanes (SSE/AVX/NEON).
- **SIMT** — Single Instruction, Multiple Threads: the GPU model, many threads run the same kernel in lockstep warps.
- **Pipeline parallelism** — stages run concurrently, each item flows stage→stage; throughput bound by the slowest stage.
- **Scatter/gather** — distribute (scatter) chunks to workers, collect (gather) results back.
- **Embarrassingly parallel** — no inter-task communication needed; the easy, near-linear-speedup case.
- **Granularity** — the amount of work per parallel task relative to the overhead of creating/scheduling it.

**Why interviewers ask this**

Anyone can say "use threads." The signal here is whether you can look at a workload and *name the right pattern* plus *predict whether it will scale*. Junior answers reach for raw threads and hand-rolled work splitting; senior answers say "this is a map-reduce, the combine is associative so I can tree-reduce, and it's embarrassingly parallel except for the final merge." Interviewers probe whether you understand that **not all parallelism is equal** — data parallelism vectorizes and GPU-offloads, task parallelism doesn't; that **granularity is a tunable** with a real cost model; and that adding cores past the point where coordination dominates makes things *slower* (a preview of Amdahl's law). They also want to see you distinguish parallelism-for-throughput (pipelines, batch) from parallelism-for-latency (divide-and-conquer on one request).

**Common confusions**

- "Task and data parallelism are the same" — no. Task = different operations; data = same operation over many elements. Most real systems mix both (a pipeline of stages where each stage is data-parallel).
- "More tasks = more speed" — only until scheduling/coordination overhead and load imbalance dominate. Granularity has a sweet spot.
- "SIMD is just multithreading" — SIMD is *within one core/thread*: one instruction, many lanes. It's orthogonal to (and composes with) multiple threads.
- "Map-reduce needs Hadoop" — map-reduce is a *pattern* (parallel map + associative reduce). Hadoop/Spark are one distributed implementation; `parallelStream().reduce()` is another, in-process.
- "Parallel streams are always faster" — the split/merge and boxing overhead often loses for small or cheap-per-element workloads; measure.
- "Embarrassingly parallel means bad/embarrassing" — it means *ideal*: no coordination, near-linear scaling. It's the goal, not an insult.

**What follows from this topic**

Decomposition patterns are the *how* that the scaling limits (Amdahl/Gustafson, false sharing, contention) constrain — pick a coordination-heavy decomposition and you hit those walls fast. Fork-join and work-stealing connect straight back to thread pools and executors. The data-parallel/SIMD/GPU thread also sets up the language-models topic (which languages expose vectorization and GPU offload cleanly) and the debugging topic (data-parallel code has fewer race surfaces than task-parallel code with shared state). If you internalize one thing: **choose the decomposition that minimizes coordination, then tune granularity.**

### Q1. What is the difference between task parallelism and data parallelism?

They differ in *what* you split.

| | Task parallelism | Data parallelism |
|---|---|---|
| Split by | Function / operation | Data elements |
| Work per unit | Heterogeneous | Homogeneous (same op) |
| Example | Parse + compress + upload concurrently | Add two 1M-element arrays |
| Scales via | More distinct tasks | More cores / SIMD lanes / GPU |
| Vectorizable? | Generally no | Yes |
| Load balance | Can be uneven (tasks differ) | Usually even |

**Task parallelism**: you have several *different* jobs and run them at once. Think a web request that concurrently fetches from a DB, calls a cache, and hits a downstream API. Decomposition is by *activity*.

**Data parallelism**: you have *one* operation and a large collection, and you apply it to all elements simultaneously. Think `image.pixels.map(brighten)`. Decomposition is by *data*.

Most real systems are hybrids: a **pipeline** (task-parallel stages) where each stage runs a **parallel-for** (data-parallel) over its batch. Data parallelism is the one that scales furthest because it's regular — it maps onto SIMD lanes and GPU threads, not just cores.

### Q2. What is the map-reduce pattern and what property must the reduce have?

Map-reduce is: **map** an independent function over every element (fully parallel, no coordination), then **reduce** the results with a combiner.

```text
input:   [ e1  e2  e3  e4  e5  e6  e7  e8 ]
map:     [ f(e1) f(e2) ... f(e8) ]        // parallel, independent
reduce:   (((...⊕...)))                   // associative combine → result
```

The reduce operator `⊕` **must be associative** so the runtime can combine in any grouping — crucially, as a *tree* rather than a left-fold:

```text
tree reduce (log depth, parallel):
   a b   c d   e f   g h
    \|    \|    \|    \|
    ab    cd    ef    gh
      \  /        \  /
      abcd        efgh
          \      /
          abcdefgh
```

Associativity lets you split the array into chunks, reduce each chunk on its own core, then reduce the partials — O(log n) depth instead of O(n). **Commutativity** additionally lets results arrive in any order (handy for unordered parallel streams). Sum, max, min, count, string-concat (associative, not commutative), and set-union are fine. Average is *not* directly associative — you carry `(sum, count)` and divide at the end. This is why `Stream.reduce` demands an associative accumulator and why a bad (non-associative) combiner silently corrupts parallel results while looking fine sequentially.

### Q3. Explain divide-and-conquer / fork-join parallelism.

Fork-join parallelizes recursive divide-and-conquer: split the problem, **fork** sub-problems to run in parallel, then **join** (wait) and combine.

```java
class SumTask extends RecursiveTask<Long> {
    final long[] a; final int lo, hi;
    protected Long compute() {
        if (hi - lo <= THRESHOLD) {          // small enough: do it directly
            long s = 0;
            for (int i = lo; i < hi; i++) s += a[i];
            return s;
        }
        int mid = (lo + hi) >>> 1;
        SumTask left  = new SumTask(a, lo, mid);
        left.fork();                          // run left asynchronously
        SumTask right = new SumTask(a, mid, hi);
        long r = right.compute();             // do right on this thread
        long l = left.join();                 // wait for left
        return l + r;
    }
}
```

Key points: (1) There's a **sequential threshold** — below some size, recursing costs more than just looping. Tuning it is the granularity knob. (2) It runs on a **work-stealing pool** (`ForkJoinPool`), so idle cores steal pending sub-tasks and stay busy even with uneven splits. (3) The idiom is `fork()` one half and `compute()` the other on the current thread — forking *both* wastes a thread. Fork-join is the backbone of Java parallel streams, `Arrays.parallelSort`, and Cilk/TBB-style parallelism. It targets **latency** on a single big task, not throughput across many.

### Q4. What is SIMD / vectorization and how does it differ from multithreading?

**SIMD (Single Instruction, Multiple Data)** packs several data elements into a wide register and applies one instruction to all "lanes" at once. A 256-bit AVX register holds 8 `float`s; one `vaddps` adds 8 pairs in a single instruction.

```text
scalar:  a0+b0, then a1+b1, then a2+b2, ...   (8 instructions)
SIMD:    [a0 a1 a2 a3 a4 a5 a6 a7]
       + [b0 b1 b2 b3 b4 b5 b6 b7]            (1 instruction, 8 lanes)
```

The crucial distinction: **SIMD is parallelism *within a single thread/core*.** Multithreading spreads work across cores; SIMD widens the work each core does per instruction. They **compose** — 8 cores × 8 SIMD lanes ≈ 64× on ideal data-parallel code. You get SIMD from: auto-vectorization by the compiler (needs no aliasing, no data dependencies, contiguous access), explicit intrinsics (`_mm256_add_ps`), or portable APIs (Java Vector API, `std::simd`, Rust `std::simd`). Vectorization *loves* data parallelism and *hates* branches (divergent lanes) and gather/scatter (non-contiguous memory). It's the reason data-parallel decomposition scales further than task-parallel: the same regularity that lets you split across cores also lets you fill vector lanes.

### Q5. How does the GPU / SIMT model relate to SIMD and CPU threads?

**SIMT (Single Instruction, Multiple Threads)** is the GPU's model. You write a **kernel** — the body of the inner loop for *one* data element — and launch thousands to millions of threads, one per element. The hardware groups threads into **warps** (32 on NVIDIA) that execute the same instruction in lockstep.

```text
CPU (few big cores):   [core][core][core][core]  ~8-64 threads, deep caches, branch prediction
GPU (many tiny lanes): thousands of threads in warps, run same kernel, huge memory bandwidth
```

Relationship to SIMD: SIMT is "SIMD with a friendlier programming model" — you write scalar per-thread code and the hardware runs a warp of threads as a SIMD group. The key hazards:

- **Warp divergence**: if threads in a warp take different `if` branches, the warp executes both paths serially with lanes masked off — branchy code kills GPU throughput.
- **Memory coalescing**: adjacent threads should touch adjacent memory so accesses merge into few transactions.
- **Occupancy & host↔device transfer**: GPUs win only when arithmetic intensity is high and you amortize the PCIe copy.

GPUs excel at *massively* data-parallel, regular, arithmetic-heavy work (matmul, convolutions, rendering) and are poor at branchy, pointer-chasing, low-parallelism work — which stays on the CPU.

### Q6. What does "embarrassingly parallel" mean, and why do we love it?

An **embarrassingly parallel** problem splits into tasks that need **no communication or synchronization** with each other — each produces its result independently, and there's little-to-no combine.

Examples: rendering each frame of a movie, hashing each file in a directory, running the same simulation with 10,000 different seeds, resizing a batch of images, brute-forcing a keyspace partitioned by range.

Why we love it:

- **Near-linear speedup** — no coordination overhead means N cores ≈ N× (the serial fraction in Amdahl's law is tiny).
- **Trivial fault handling** — a failed task just reruns; no shared state to corrupt.
- **Scales horizontally** — the same shape distributes across machines, not just cores (this is what map's "map" step is).

The opposite end is **coordination-heavy** work — frequent locking, fine-grained data sharing, ordering dependencies — where synchronization dominates and speedup saturates quickly. The whole art of parallel design is *transforming* problems toward the embarrassing end: partition data so workers don't share, replicate read-only state instead of locking it, and defer combining to a single final reduce.

### Q7. What is pipeline parallelism and what bounds its throughput?

Pipeline parallelism runs a sequence of **stages** concurrently, streaming items through them — like an assembly line. While stage 2 processes item *i*, stage 1 already works on item *i+1*.

```text
items → [ Stage A ] → [ Stage B ] → [ Stage C ] → out
         parse         transform      write
time →
 t1:      A(x1)
 t2:      A(x2)         B(x1)
 t3:      A(x3)         B(x2)         C(x1)
 t4:      A(x4)         B(x3)         C(x2)
         (all three stages busy = steady state)
```

**Throughput is bound by the slowest stage** (the bottleneck), not the sum of stages. If A takes 1ms, B takes 5ms, C takes 1ms, the pipeline emits one item every 5ms no matter how fast A and C are. Latency for one item is still the sum (7ms), but steady-state *throughput* is 1/5ms.

Consequences: you **balance** stages (split the slow one, or run multiple parallel workers on stage B), and you need **bounded buffers between stages** for backpressure so a fast producer doesn't overrun a slow consumer. Pipelines are task-parallel across stages and often data-parallel within a stage. They're everywhere: CPU instruction pipelines, video encoders, Unix pipes, streaming ETL, ML training (pipeline-parallel model layers across GPUs).

### Q8. When are parallel streams (or parallel-for) worth it, and when do they backfire?

Parallel-for / parallel streams split an iteration space across a work-stealing pool. They pay off only when the parallel win exceeds the split/merge/coordination overhead.

**Worth it when:**
- The collection is **large** (rule of thumb: ≥ ~10k elements, but it depends on per-element cost).
- Per-element work is **substantial and CPU-bound** (real computation, not a field read).
- The source **splits cheaply and evenly** — arrays, `ArrayList`, ranges (good `Spliterator`); *not* `LinkedList` or `Iterator`-based sources.
- The operation is **stateless and side-effect-free**, and any reduce is associative.

**Backfires when:**
- Cheap per-element work — boxing/unboxing and task overhead dominate (`list.parallelStream().mapToInt(...)` on small ints often loses).
- The lambda **blocks on I/O** — you're tying up the common `ForkJoinPool`, starving everything else that shares it.
- **Ordering** is required (`forEachOrdered`) — you pay for parallelism then serialize the output.
- **Shared mutable state** in the lambda — now you've got a data race, or you've added locking that serializes it anyway.

```java
// Good: big, CPU-bound, associative reduce
long primes = LongStream.rangeClosed(2, 10_000_000).parallel().filter(this::isPrime).count();

// Bad: tiny work, boxing, ordering — slower than sequential
list.parallelStream().map(String::trim).collect(toList());
```

Always **measure** — parallel streams are a micro-benchmark trap. And never run blocking work on the shared common pool; supply your own `ForkJoinPool` if you must.

### Q9. What is the scatter/gather pattern?

Scatter/gather distributes a large input across workers (**scatter**), lets each process its chunk independently, then collects and combines the partial results (**gather**).

```text
        ┌────────── scatter ──────────┐
input → │ chunk1  chunk2  chunk3  chunk4│
        └───┬───────┬───────┬──────┬───┘
          worker  worker  worker  worker   (parallel, independent)
        ┌───┴───────┴───────┴──────┴───┐
        │  p1      p2      p3      p4   │
        └────────── gather ────────────┘ → combine → result
```

It's the concrete mechanism under map-reduce and parallel-for: partition, fan out, fan in. Design considerations:

- **Chunking strategy**: static (equal ranges up front — simple, but suffers if work per element varies) vs dynamic (a shared queue / work-stealing — better load balance, more coordination).
- **The gather is the serial tail** — if combining is expensive or contended, it caps your speedup (Amdahl). Prefer a *tree* gather (combine pairs) over a single thread collecting all.
- **Scatter cost**: copying/partitioning the data isn't free; for cheap operations it can outweigh the compute win.

You see scatter/gather in MPI collectives (`MPI_Scatter`/`MPI_Gather`), distributed query engines, and any "split the array, sum the parts" parallel routine.

### Q10. How do you choose a decomposition strategy for a given problem?

Walk a short decision path:

1. **Is the work independent?** If tasks share little/no state → aim for **embarrassingly parallel** (scatter/gather, parallel-for). This is the best case; twist the problem toward it (partition data, replicate read-only state).
2. **Same op over many elements, or different ops?** Same op → **data parallelism** (parallel-for, SIMD, GPU). Different ops that can overlap → **task parallelism** (pipeline, async tasks).
3. **Is it recursive / tree-shaped?** → **fork-join** divide-and-conquer with a sequential cutoff.
4. **Is it a stream with distinct processing steps?** → **pipeline**, then balance/replicate the bottleneck stage.
5. **Optimizing latency or throughput?** Latency of one big task → divide-and-conquer. Throughput of many items → pipeline / batch data-parallel.

Then sanity-check the economics: estimate the **serial fraction** (Amdahl), the **coordination cost**, and the **granularity** (work per task ≫ scheduling overhead). If the serial/combine part is large or the tasks are tiny, parallelism won't pay — say so. The senior move is to *name the pattern and predict the speedup ceiling before writing code.*

### Q11. Explain the overhead-vs-granularity tradeoff.

Every parallel task carries fixed overhead: creating/scheduling it, enqueueing to a pool, cache/context effects, and combining its result. **Granularity** = useful work per task. The tradeoff:

```text
too fine-grained:              too coarse-grained:
 tiny tasks, overhead dominates  few big tasks, cores idle / imbalance
 ├─┼─┼─┼─┼─┼─┼─┼─┤               ├───────┼───────┤
 speedup ↓ (overhead)            speedup ↓ (underutilization)
                sweet spot: task ≫ overhead, enough tasks to fill cores
```

- **Too fine**: if a task does 100ns of work but costs 1µs to schedule, you spend 10× more on coordination than computation — parallelism makes it *slower*.
- **Too coarse**: with 4 tasks on 16 cores, 12 cores sit idle; and if one task is much bigger (load imbalance), everyone waits for the straggler.

The fix is a **sequential cutoff / chunking**: batch small items so each task is meaty enough to amortize overhead, but keep enough tasks (typically several × core count) that work-stealing can balance load. Fork-join's `THRESHOLD` and OpenMP's `schedule(dynamic, chunk)` are exactly this knob. Rule of thumb: aim for tasks large enough that overhead is <10% of task time, and count ≈ 2–8× cores so stragglers can be stolen around.

### Q12. Why can adding more parallel workers make a program slower?

Several distinct mechanisms, and a good answer names them:

- **Amdahl's law**: the serial fraction caps speedup. If 10% is serial, max speedup is 10× no matter how many cores — and past that point, extra workers add only overhead.
- **Coordination/synchronization overhead**: more workers → more contention on shared locks, atomics, or the combine step. Contention can *collapse* throughput (everyone spinning/blocking on one lock).
- **Overhead exceeds work (bad granularity)**: tiny tasks where scheduling costs more than the computation.
- **False sharing**: workers writing to different variables that share a cache line ping-pong that line between cores — pure memory-traffic waste.
- **Memory-bandwidth saturation**: data-parallel loops over big arrays are often bandwidth-bound; adding cores past the point where they saturate the memory bus yields nothing.
- **Oversubscription**: more runnable threads than cores → context-switch thrash and cache pollution.

```text
speedup
  ▲        ___ ideal (linear)
  │      /
  │    / ___------ real (rolls over, then DECLINES)
  │  //  
  └──────────────► workers
         sweet spot ^   past here: overhead/contention win
```

The senior point: parallelism has a **cost model**; more cores is not free, and the curve typically peaks then *declines*. Measure to find the peak.

### Q13. What is load balancing in parallel work, and how does work stealing help?

**Load imbalance** happens when tasks take unequal time, so some workers finish early and idle while others are still grinding — the whole computation waits for the slowest (straggler). Static equal-range splitting is vulnerable: if element cost varies (e.g. some inputs hit a slow path), equal *counts* don't mean equal *time*.

**Work stealing** fixes this dynamically. Each worker owns a **double-ended queue (deque)** of tasks:

```text
worker pushes/pops its OWN tasks from the BOTTOM (LIFO — cache-hot, no contention)
idle worker STEALS from the TOP of a victim's deque (FIFO — big, old tasks)

W1: [t8 t7 t6] ← W1 pops bottom
W2: []  → steals t6 from top of W1   (rebalances automatically)
```

Popping your own from the bottom (LIFO) keeps recently-created, cache-hot subtasks local and needs no synchronization. Stealing from the *top* grabs the oldest/largest task (which tends to spawn more subtasks, spreading work well) and minimizes contention with the owner. This is how `ForkJoinPool`, Go's scheduler, Cilk, and Rust's Rayon stay balanced without central coordination. The alternatives — a single shared queue (contention bottleneck) or static partitioning (imbalance) — are both worse for irregular workloads.

### Q14. Design a parallel merge sort. Where's the parallelism and where's the limit?

Merge sort is naturally fork-join: recursively sort halves in parallel, then merge.

```java
class ParallelSort extends RecursiveAction {
    int[] a; int lo, hi;
    protected void compute() {
        if (hi - lo < CUTOFF) { Arrays.sort(a, lo, hi); return; } // seq base case
        int mid = (lo + hi) >>> 1;
        invokeAll(new ParallelSort(a, lo, mid),                    // both halves
                  new ParallelSort(a, mid, hi));                   // in parallel
        merge(a, lo, mid, hi);                                     // combine
    }
}
```

Parallelism lives in the **recursive splits** — the sort of the two halves is embarrassingly parallel (disjoint index ranges, no sharing). The **sequential cutoff** switches to an insertion/`Arrays.sort` base case so tiny subarrays don't drown in fork overhead.

The limit is the **merge step**. A naive merge is O(n) *sequential* work at each level, and the top-level merge processes all n elements on one thread — that's the Amdahl tail. Speedup with a serial merge tops out around O(log n)-ish because the merges dominate. To go further you parallelize the merge itself (parallel merge via binary-searching the split point of one half into the other, giving O(log² n) span). Takeaway: the split is trivially parallel; **the combine is the bottleneck**, which is the general lesson of divide-and-conquer parallelism.

### Q15. Contrast latency-oriented and throughput-oriented parallelism.

They optimize different things and favor different patterns.

| | Latency-oriented | Throughput-oriented |
|---|---|---|
| Goal | Finish *one* task faster | Complete *more* tasks per unit time |
| Pattern | Divide-and-conquer / fork-join | Pipeline, batch data-parallel |
| Splits | One request across cores | Many requests across cores |
| Example | Parallelize one big matrix multiply | Serve 10k requests concurrently |
| Metric | Time to result | Items/sec |
| Idle risk | Cores idle between requests | Bottleneck stage caps rate |

**Latency**: you have one important task and want its wall-clock time down, so you split *it* across cores (parallel sort of one array, fork-join reduce of one dataset). Fewer, bigger requests.

**Throughput**: you have a flood of independent tasks and want max steady-state rate, so you keep all cores busy with *different* items — a pipeline or a pool processing a queue. You may deliberately *increase* per-item latency (batching) to raise throughput.

The confusion to avoid: optimizing one can hurt the other. Batching raises throughput but adds latency; splitting one request across all cores lowers its latency but wastes capacity if requests are already plentiful. Know which you're paid to optimize — a request server usually wants throughput (don't burn 16 cores on one request when 16 requests are waiting), while a batch job on idle hardware wants latency.

### Q16. How do GPU and CPU parallelism differ, and when do you reach for a GPU?

| | CPU | GPU |
|---|---|---|
| Cores | Few (4–64), large, out-of-order | Thousands of tiny lanes |
| Model | MIMD (independent threads) | SIMT (warps in lockstep) |
| Strength | Branchy, latency-sensitive, low parallelism | Massive, regular, arithmetic-heavy data parallelism |
| Memory | Deep caches, latency-optimized | High bandwidth, throughput-optimized |
| Branches | Cheap (branch prediction) | Expensive (warp divergence) |
| Transfer | Data already in RAM | Must copy over PCIe (amortize it) |

**Reach for a GPU when** the workload is (1) *massively data-parallel* — the same kernel over millions of elements; (2) *arithmetic-intense* — high compute-to-memory ratio so you're not just moving data; (3) *regular* — coalesced memory access, minimal divergent branching; and (4) *big enough* to amortize the host↔device transfer. Matrix multiply, convolutions, dense linear algebra, ray tracing, and neural-net training/inference are the sweet spot.

**Stay on the CPU when** the work is branchy, pointer-chasing, has low parallelism, small data, or is dominated by transfer overhead — the GPU's thousands of lanes sit idle or diverge. The mental rule: GPUs trade latency and flexibility for enormous *throughput on regular data-parallel math*. If your inner loop is a clean `for each element: do the same FLOPs`, it's a GPU candidate; if it's `if this then walk that pointer`, it isn't.

## Language Concurrency Models

### Summary

**What this topic covers**

This topic compares how mainstream languages actually let you write concurrent code — because the primitives from earlier topics (threads, locks, atomics, channels, async/await) are exposed *very* differently across Java, Go, Rust, Python, C++, and JavaScript, and the differences drive real design decisions. It's a comparison-heavy topic (expect tables). Three concern areas: (1) **the threading substrate** — OS threads vs green/virtual threads vs goroutines vs a single event loop, and who schedules them; (2) **the sharing discipline** — shared-memory-plus-locks (Java, C++) vs message-passing (Go channels) vs compile-time-enforced ownership (Rust) vs "you basically can't share, use processes" (Python's GIL, JS workers); and (3) **the CPU-bound question** — which of these languages can actually use multiple cores for CPU-bound work, and why Python famously struggles. The 16 questions run from "compare goroutines and threads" through the GIL and Rust's `Send`/`Sync` to "which language would you pick for CPU-bound parallelism and why."

**Mental model**

Put each language on two axes. **Axis 1 — what's the unit of concurrency and who schedules it?** OS-scheduled kernel threads (Java pre-Loom, C++ `std::thread`), or *runtime*-scheduled lightweight tasks multiplexed onto a small pool of OS threads (Go goroutines, Java virtual threads, Rust async tasks, JS/Python event-loop coroutines). Runtime scheduling is cheap (millions of goroutines, blocking is fine) but needs cooperative yield points. **Axis 2 — how is shared mutable state disciplined?** Java/C++ trust you with locks and a memory model (powerful, footgun-heavy). Go says "don't communicate by sharing memory; share memory by communicating" (channels), but still *allows* shared memory with `sync`. Rust encodes the discipline in the *type system* — `Send`/`Sync` and ownership make data races a *compile error*. Python and JS mostly *sidestep* sharing: Python's GIL serializes bytecode (so use processes for CPU work), and JS runs one thread with an event loop (workers don't share memory, they message). The whole topic is: pick the language whose model matches your workload's sharing and CPU needs.

**Key terms**

- **Green / virtual thread** — user-space thread scheduled by the language runtime, not the OS (Java virtual threads, Go goroutines).
- **Goroutine** — Go's lightweight thread; grows its stack dynamically, multiplexed by the GMP scheduler.
- **GMP scheduler** — Go's runtime scheduler: **G**oroutines run on **M**achine (OS) threads via logical **P**rocessors (GOMAXPROCS).
- **JMM** — Java Memory Model; defines happens-before, `volatile`, `synchronized` semantics.
- **`Send` / `Sync`** — Rust marker traits: `Send` = safe to move across threads, `Sync` = safe to share `&T` across threads.
- **`Arc<Mutex<T>>`** — Rust's canonical shared-mutable-state: atomically reference-counted pointer around a mutex.
- **GIL** — Global Interpreter Lock; one lock that lets only one thread execute Python bytecode at a time.
- **`std::memory_order`** — C++ atomic ordering: `relaxed`, `acquire`, `release`, `acq_rel`, `seq_cst`.
- **Event loop** — single-threaded scheduler pulling callbacks/tasks off a queue (JS, Python asyncio).
- **Web Worker** — separate JS thread with its own heap; communicates by `postMessage` (no shared mutable state, except `SharedArrayBuffer`).
- **Fearless concurrency** — Rust's guarantee: if it compiles, it has no data races.
- **Free-threaded Python** — Python 3.13+ optional build (PEP 703) that removes the GIL.

**Why interviewers ask this**

This question separates people who've only used one language's concurrency from people who understand the *tradeoffs*. The classic probe is "Python threads for a CPU-bound loop — will they help?" (No — the GIL serializes them; you want `multiprocessing`.) A junior answers from habit ("just use threads"); a senior reasons about the *substrate*: is sharing safe, does the runtime schedule cheaply, can it use all cores? Interviewers also use this to test depth on a language you claim — Go people should explain the GMP scheduler and `-race`; Rust people should explain `Send`/`Sync` and why `Rc` isn't `Send`; Java people should know virtual threads changed the "threads are expensive" calculus. It's also a proxy for whether you'd pick the right tool for a real system rather than forcing your favorite language onto a workload it's bad at.

**Common confusions**

- "Python can't do parallelism" — imprecise. Python *threads* can't parallelize *CPU-bound* work (GIL), but they parallelize *I/O-bound* work fine, and `multiprocessing` (or free-threaded 3.13+, or native extensions releasing the GIL) gives true CPU parallelism.
- "Goroutines are OS threads" — no, they're runtime-scheduled and multiplexed onto a few OS threads; you can have millions.
- "Rust makes concurrency safe at runtime" — it makes data races a *compile-time* error via the type system; there's little runtime cost.
- "Node.js is fully single-threaded" — your JS runs on one thread (the event loop), but libuv uses a background thread pool for file I/O and DNS, and you can spawn worker threads.
- "Virtual threads make Java as fast as Go" — they make *blocking* code cheap and scalable, but they're not a silver bullet for CPU-bound work (still bounded by cores).
- "The GIL is a bug" — it's a deliberate tradeoff that simplified CPython's memory management and C-extension ecosystem; removing it (PEP 703) is hard precisely because so much depends on it.

**What follows from this topic**

The language you pick determines which earlier-topic tools are even available: Go pushes you toward channels/CSP, Rust toward ownership and `Arc<Mutex<T>>`, Java toward `java.util.concurrent` and now virtual threads, C++ toward raw `std::atomic` and memory orders. It also sets up the debugging topic — each language ships different race-detection tooling (Go `-race`, C++/Rust ThreadSanitizer, Java thread dumps / jcstress). And it connects back to the parallelism-patterns topic: only languages with true multicore threads (Java, Go, Rust, C++) run CPU-bound data-parallel code across cores natively; Python and JS reach for processes/workers instead.

### Q1. Compare goroutines with OS threads.

| | OS thread | Goroutine |
|---|---|---|
| Scheduled by | OS kernel | Go runtime (GMP) |
| Initial stack | ~1–8 MB fixed | ~2–8 KB, grows/shrinks |
| Creation cost | Microseconds, syscall | Nanoseconds, no syscall |
| How many | Thousands | Millions |
| Blocking | Blocks the kernel thread | Runtime parks it, reuses the thread |
| Context switch | Kernel, expensive | User-space, cheap |

A goroutine is a **user-space (green) thread**. `go f()` schedules `f` onto Go's runtime, which multiplexes many goroutines onto a small pool of OS threads. Because stacks start tiny (~2KB) and grow on demand, you can run *millions* of goroutines — something impossible with OS threads (whose fat fixed stacks and kernel scheduling cap you at thousands).

The magic is **blocking is cheap**: when a goroutine makes a blocking syscall or channel op, the runtime detaches it and runs another goroutine on that OS thread, so blocking one goroutine doesn't waste a core. This is why idiomatic Go writes straight-line blocking code (`resp := http.Get(...)`) at massive concurrency, no async/await coloring. Java virtual threads (Loom) copied this model onto the JVM. The catch: goroutines need **yield points** (channel ops, syscalls, function calls) to be preempted; a tight CPU loop with no calls could once starve others (fixed by async preemption in Go 1.14+).

### Q2. Explain Go's GMP scheduler.

GMP is Go's runtime scheduler with three entities:

```text
G = goroutine (the work)
M = machine — an OS thread (does the actual running)
P = processor — a logical scheduling context; count = GOMAXPROCS (≈ #cores)

   P0 ── local run queue: [G G G]      global run queue: [G G ...]
   │                                        ▲ overflow / steal source
   M0 (OS thread) runs a G from P0's queue
   P1 ── [G G]      M1 runs it
   idle P steals half of another P's queue  (work stealing)
```

- A **P** holds a **local run queue** of runnable goroutines and represents "permission to run Go code." There are `GOMAXPROCS` of them (default = #cores), which is what bounds true parallelism.
- An **M** is an OS thread; to run Go code it must hold a P. Ms are created as needed (e.g., when one blocks in a syscall).
- When a goroutine makes a **blocking syscall**, the M blocks with it, but the runtime **hands the P to another M** so the other goroutines on that P keep running — cores stay busy.
- Idle Ps **steal** goroutines from other Ps' queues (work stealing) for load balance; a global queue catches overflow and newly-woken goroutines.

This is why Go gives cheap concurrency *and* real parallelism: P count caps parallelism to cores, while G/M decoupling makes blocking and millions of goroutines cheap. Network I/O goes through an integrated poller (netpoller) so blocked network goroutines don't even consume an M.

### Q3. What guarantees do Rust's `Send` and `Sync` provide?

They're **marker traits** the compiler uses to make thread-safety a *type-system* property:

- **`Send`**: a type is safe to *move* (transfer ownership) to another thread. Almost everything is `Send`; notable exception is `Rc<T>` (non-atomic refcount — moving it across threads could race the count).
- **`Sync`**: a type is safe to *share* by reference (`&T`) across threads. `T: Sync` ⟺ `&T: Send`. `Mutex<T>` is `Sync` (it synchronizes access); `Cell`/`RefCell` are *not* `Sync` (interior mutability with no locking).

The payoff: `thread::spawn` requires its closure to be `Send`, and sharing a reference across threads requires `Sync`. So if you try to send an `Rc` to another thread or share a `RefCell`, **it doesn't compile**:

```rust
let data = Rc::new(5);
thread::spawn(move || { println!("{}", data); }); // ERROR: Rc<i32> is not Send
```

Fix it by using the thread-safe versions — `Arc` (atomic refcount, `Send + Sync`) and `Mutex`:

```rust
let data = Arc::new(Mutex::new(0));
let d = Arc::clone(&data);
thread::spawn(move || { *d.lock().unwrap() += 1; }); // compiles: Arc<Mutex<i32>> is Send+Sync
```

These traits are **auto-derived** (a struct is `Send`/`Sync` if all its fields are), so the guarantee composes automatically. Combined with the borrow checker (no aliased mutable references), this is what makes Rust's concurrency **"fearless"**: data races are caught at compile time, not in production.

### Q4. What is "fearless concurrency" in Rust and how is it achieved?

"Fearless concurrency" is Rust's claim that **if concurrent code compiles, it has no data races** — you can add threads without fear of the classic shared-memory bugs. It's achieved by the same **ownership + borrowing** rules that give memory safety, extended to threads:

1. **Ownership**: each value has one owner; moving it to a thread transfers ownership, so two threads can't both own (and mutate) the same value.
2. **Borrow checker**: you can have *many* `&T` (shared, read-only) *or one* `&mut T` (exclusive), never both. A data race needs two threads, one writing, unsynchronized — the aliasing rule forbids exactly that.
3. **`Send`/`Sync` marker traits** (see prior question): the compiler refuses to move non-thread-safe types across threads or share non-`Sync` types.

To *legitimately* share mutable state you must use types that uphold the rules at runtime — `Arc<Mutex<T>>` or `Arc<RwLock<T>>` or atomics — and the type system *forces* you to (you literally can't reach the inner value without locking). 

The honest caveat: "fearless" covers **data races**, not **all** concurrency bugs. Rust does *not* prevent **deadlocks**, **livelock**, or logical **race conditions** (e.g., a check-then-act across two separate locked operations). So `Arc<Mutex<T>>` still lets you deadlock by acquiring locks in inconsistent order. What Rust eliminates is the whole category of "forgot to synchronize a shared write" — the subtlest and most common concurrency bug in C++/Java.

### Q5. Why don't Python threads speed up CPU-bound work? Explain the GIL.

The **GIL (Global Interpreter Lock)** is a single mutex in CPython that permits **only one thread to execute Python bytecode at a time.** Even on a 16-core machine, N Python threads running a CPU-bound loop run *one at a time*, round-robining the GIL:

```text
2 threads, CPU-bound, on a 16-core box:
  T1: [run][ ][run][ ]...   ← holds GIL
  T2: [ ][run][ ][run]...   ← waits for GIL
  never truly simultaneous → no speedup (often slightly SLOWER from lock overhead + switching)
```

So threads give you *no* CPU parallelism; they only add contention. Why does it exist? It made CPython's reference-counting memory management and the huge C-extension ecosystem simple and fast for the single-threaded case — every C extension could assume no concurrent access.

**Threads still help for I/O-bound work**, because a thread *releases the GIL while blocked* on I/O (socket read, disk, `sleep`). So 100 threads each waiting on HTTP responses overlap fine. The GIL only bites when threads want the *CPU* simultaneously.

Your options for real CPU parallelism in Python:

| Approach | Parallel CPU? | How |
|---|---|---|
| `threading` | No (GIL) | Good for I/O-bound only |
| `multiprocessing` | Yes | Separate processes, separate GILs; pay IPC/serialization |
| `asyncio` | No | Single thread, event loop — for high-concurrency I/O |
| C extension / NumPy | Yes | Releases the GIL in native code |
| Free-threaded 3.13+ | Yes | GIL-less CPython build (PEP 703) |

Default answer in an interview: "For CPU-bound Python, use `multiprocessing` (or push the hot loop into NumPy/native code); threads won't help because of the GIL."

### Q6. multiprocessing vs asyncio vs threading in Python — when each?

| | threading | multiprocessing | asyncio |
|---|---|---|---|
| Parallel CPU | No (GIL) | Yes (separate GILs) | No |
| Best for | Blocking I/O, few tasks | CPU-bound work | High-concurrency I/O |
| Unit | OS thread | OS process | Coroutine on one thread |
| Sharing | Shared memory (careful) | IPC / pickling (expensive) | Shared memory (single thread) |
| Overhead | Low | High (fork + serialize) | Very low |
| Scale | Hundreds of threads | ~#cores processes | Tens of thousands of tasks |

- **`threading`**: use for **I/O-bound** work with a modest number of blocking calls — file/network/db where the GIL is released during the wait. Simple blocking code, but no CPU parallelism.
- **`multiprocessing`**: use for **CPU-bound** work. Each process has its own interpreter and GIL, so they run on all cores. Cost: process startup, and data must be **pickled** across the boundary (so large shared state is painful — use shared memory or minimize transfer).
- **`asyncio`**: use for **massive I/O concurrency** — tens of thousands of sockets — on a single thread via an event loop and `async/await`. No thread overhead, but everything must be non-blocking (`await`), and a single blocking call (or CPU-heavy coroutine) **stalls the whole loop**. Also no CPU parallelism.

Rule of thumb: **CPU-bound → multiprocessing; lots of I/O → asyncio; some blocking I/O with simple code → threading.** You can combine them (async event loop that offloads CPU work to a process pool).

### Q7. How does free-threaded Python (3.13+) change the picture?

Python 3.13 shipped an **experimental free-threaded build** (PEP 703) that **removes the GIL**, letting threads run Python bytecode truly in parallel across cores.

What changes:
- CPU-bound multithreading finally scales — a parallel `for` across threads can use all cores without `multiprocessing`'s process/pickle overhead.
- Shared-memory concurrency in pure Python becomes real, so you now *need* the locking discipline (mutexes, atomics) that the GIL previously papered over.

What's tricky / why it's not the default yet:
- It's an **opt-in separate build** (`python3.13t`), not standard CPython.
- Removing the GIL made reference counting need atomic ops and biased/deferred reclamation, which **slows single-threaded code** somewhat (the gap is narrowing across releases).
- The **C-extension ecosystem** assumed the GIL; extensions must be updated and marked GIL-safe or the interpreter falls back.
- Pure-Python code that was *accidentally* thread-safe because of the GIL can now expose real data races.

Interview framing: free-threading is the long-term fix that makes Python threads a genuine CPU-parallelism tool, but as of 2026 it's still stabilizing — for production CPU-bound work today you'd still typically reach for `multiprocessing` or native code, while watching free-threading mature.

### Q8. Compare Java platform threads and virtual threads (Project Loom).

| | Platform thread | Virtual thread |
|---|---|---|
| Backed by | One OS thread | Runtime, mounted on a carrier OS thread |
| Cost | ~1MB stack, kernel-scheduled | Tiny, heap-stored continuation |
| How many | Thousands | Millions |
| Blocking | Blocks the OS thread | Unmounts; carrier runs another VT |
| Scheduled by | OS | JVM (ForkJoinPool carriers) |
| Introduced | Always | Java 21 (finalized) |

A **platform thread** is a thin wrapper over an OS thread — expensive, so historically you pooled them and wrote async/reactive code to scale I/O. **Virtual threads** (Project Loom) are JVM-scheduled green threads multiplexed onto a small pool of **carrier** OS threads. When a virtual thread blocks (I/O, `synchronized`-free lock, sleep), the JVM **unmounts** it from its carrier and runs another — so blocking is cheap.

The payoff: you can write **simple blocking, thread-per-request code** and still handle millions of concurrent connections, retiring most of the reason to use callback/reactive frameworks for I/O concurrency. This mirrors Go's goroutines on the JVM.

Caveats: (1) virtual threads help **I/O-bound** concurrency, not CPU-bound throughput (still capped by cores). (2) Certain operations **pin** a virtual thread to its carrier (historically `synchronized` blocks and native calls), preventing unmount — prefer `ReentrantLock` in hot paths (pinning on `synchronized` was being addressed in later releases). (3) Don't *pool* virtual threads — create one per task; they're cheap by design.

### Q9. How does JavaScript achieve concurrency with a single thread?

JS execution is **single-threaded**: one call stack, one **event loop**. Concurrency comes from *not blocking* that thread — you register callbacks for async operations and the runtime invokes them later.

```text
   ┌─────────────┐   call stack (runs one thing at a time)
   │  run to     │
   │ completion  │
   └─────┬───────┘
         │ when stack empties, event loop pulls next task
   ┌─────▼─────────────────────────────────────┐
   │ microtask queue (Promises)  ← drained first │
   │ macrotask queue (timers, I/O callbacks)     │
   └─────────────────────────────────────────────┘
   async I/O runs OUTSIDE JS (libuv thread pool / OS), 
   posts its callback to a queue when done
```

Key points:
- **Run-to-completion**: each task runs fully before the next; no preemption, so no data races on JS heap state within a task. This is why JS has no locks.
- **The async work isn't done by JS** — timers, network, and (in Node) file I/O run in the host (browser APIs / libuv's background thread pool), then queue a callback. The single JS thread just orchestrates.
- **Microtasks (Promises/`await`) drain before the next macrotask**, which is why a resolved Promise's `.then` runs before a `setTimeout(…, 0)`.
- The cardinal sin is **blocking the loop** — a long synchronous computation (or `JSON.parse` of a huge string) freezes *everything* because there's only one thread.

For CPU parallelism you step outside the model: **Web Workers** (browser) or **worker_threads** (Node) — separate threads with separate heaps that communicate by message passing.

### Q10. Compare C++ concurrency primitives and `std::memory_order`.

C++ gives you low-level, zero-overhead building blocks and *expects* you to get the memory model right.

- **`std::thread`** — a real OS thread; you must `join()` or `detach()` (destroying a joinable thread calls `terminate()`). `std::jthread` (C++20) auto-joins and supports cooperative cancellation via `stop_token`.
- **`std::mutex` / `std::lock_guard` / `std::unique_lock`** — RAII locking; the guard releases on scope exit (exception-safe). `std::scoped_lock` locks multiple mutexes deadlock-free.
- **`std::atomic<T>`** — lock-free atomic operations (`load`, `store`, `fetch_add`, `compare_exchange`).
- **`std::condition_variable`**, **`std::future`/`std::promise`/`std::async`** — signaling and value-passing.

The distinctive part is **`std::memory_order`**, which lets you choose *how much ordering* an atomic op enforces — trading safety for speed:

| Order | Guarantee | Use |
|---|---|---|
| `relaxed` | Atomicity only, no ordering | Counters, stats |
| `acquire` (load) | No later op moves before it | Lock acquire, consume a flag |
| `release` (store) | No earlier op moves after it | Lock release, publish data |
| `acq_rel` | Both (for read-modify-write) | CAS in a lock-free structure |
| `seq_cst` | Global total order (default) | When in doubt / correctness first |

```cpp
std::atomic<bool> ready{false};
int data = 0;
// producer:
data = 42;
ready.store(true, std::memory_order_release);   // publishes data
// consumer:
while (!ready.load(std::memory_order_acquire)); // sees data == 42 after
```

`acquire`/`release` pairs establish a happens-before edge cheaply (often free on x86, cheaper than a full fence on ARM). Default to `seq_cst` for correctness; drop to `acquire`/`release` only when profiling shows the fence cost matters and you've proven the ordering is sufficient. Getting this wrong is undefined behavior that appears only under specific hardware reordering — the hardest class of bug.

### Q11. "Share memory by communicating" — what does Go's philosophy mean?

Go's slogan is **"Do not communicate by sharing memory; instead, share memory by communicating."** Instead of multiple goroutines locking a shared variable, you give ownership of data to one goroutine and pass it between goroutines over **channels**.

```go
// Shared-memory style (Go allows it, but discouraged as the default):
var mu sync.Mutex
var count int
// every goroutine: mu.Lock(); count++; mu.Unlock()

// Channel style (idiomatic): one owner, others send requests
ch := make(chan int)
go func() {                      // sole owner of `total`
    total := 0
    for v := range ch { total += v }
}()
ch <- 5; ch <- 3                 // producers send; no locks
```

The idea: at any moment, **one goroutine owns the data**; passing it over a channel *transfers* that ownership, so there's no simultaneous access to synchronize. This turns synchronization into *communication*, which is easier to reason about — the channel both moves the value and provides the happens-before ordering (a send happens-before the corresponding receive).

Important nuance: this is a **default preference, not a prohibition**. Go still ships `sync.Mutex`, `sync.RWMutex`, `atomic`, and the Go team explicitly says use a mutex when it's simpler (e.g., protecting a small counter or a cache). The channel philosophy shines for *pipelines and ownership handoff*; a plain mutex is often clearer for *shared state with simple invariants*. Overusing channels for everything leads to convoluted code — pick the tool that makes the invariant obvious.

### Q12. What is `Arc<Mutex<T>>` in Rust and why the two layers?

`Arc<Mutex<T>>` is Rust's canonical pattern for **shared mutable state across threads**, and it's two wrappers because they solve two different problems:

- **`Mutex<T>`** provides *synchronized mutation*: to touch the `T` you must `.lock()`, which gives exclusive access and blocks other threads. This satisfies the borrow checker's "one mutable access at a time" rule at runtime.
- **`Arc<T>`** (Atomically Reference-Counted) provides *shared ownership*: multiple threads each hold a clone of the pointer, and the value is dropped when the last `Arc` goes away. It's the thread-safe version of `Rc` (whose non-atomic refcount isn't `Send`).

You need both because each alone is insufficient: a bare `Mutex<T>` has a *single* owner (can't be shared by multiple threads), and a bare `Arc<T>` gives *shared read-only* access (`&T`) but no way to mutate. Combine them and you get shared *and* mutable:

```rust
let counter = Arc::new(Mutex::new(0));
let mut handles = vec![];
for _ in 0..8 {
    let c = Arc::clone(&counter);          // share ownership
    handles.push(thread::spawn(move || {
        let mut n = c.lock().unwrap();     // exclusive access
        *n += 1;                            // safe mutation
    }));                                    // lock auto-released at scope end
}
for h in handles { h.join().unwrap(); }
```

The lock is released automatically when the `MutexGuard` drops (RAII), so you can't forget to unlock. Compare with `Arc<RwLock<T>>` when reads vastly outnumber writes. The type is verbose *on purpose*: it makes "this is shared, mutable, and must be locked" visible in the signature, and the compiler won't let you reach the inner value without going through the lock.

### Q13. Which language would you choose for CPU-bound parallelism, and why?

Frame it as: **you need true multicore execution with tight, predictable performance.** That rules out anything with a GIL or single event loop as the *primary* mechanism.

| Language | CPU-bound parallelism | Notes |
|---|---|---|
| **Rust** | Excellent | Native threads + `Send`/`Sync` catch data races at compile time; Rayon makes parallel-for trivial; no GC pauses. Top pick for correctness + speed. |
| **C++** | Excellent | Native threads, `std::atomic`, SIMD; max control and performance, but you own the memory-model correctness. |
| **Go** | Very good | Real parallelism (GOMAXPROCS), goroutines cheap; GC pauses small; less SIMD/low-level control. |
| **Java** | Very good | Real threads, mature `java.util.concurrent`, fork-join; JIT is fast; GC and warm-up to consider. |
| **Python** | Poor (natively) | GIL blocks thread parallelism; use `multiprocessing`, native/NumPy, or free-threaded 3.13+. |
| **JavaScript** | Poor | Single event loop; use worker threads with message passing for CPU work. |

**My pick: Rust** for greenfield CPU-bound parallel work — you get C++-class performance and true multicore threads, plus the type system eliminates data races at compile time (huge for the hardest-to-debug bug class), and libraries like Rayon turn a loop into a parallel loop with one method call. **C++** if you need existing libraries, ultimate control, or SIMD intrinsics. **Go or Java** if team familiarity and ecosystem outweigh squeezing the last 20% — both give genuine multicore parallelism with far less ceremony. **Not Python or JS** as the compute engine — you'd offload the hot path to processes, native extensions, or workers. Always caveat: "and I'd measure, because the right answer depends on the existing stack and where the hot loop lives."

### Q14. Compare the sharing/synchronization discipline across Java, Go, Rust, and Python.

| | Java | Go | Rust | Python |
|---|---|---|---|---|
| Default sharing model | Shared memory + locks | Channels (CSP), locks allowed | Ownership; `Arc<Mutex>` to share | Mostly avoid sharing (GIL/processes) |
| Data-race prevention | Programmer discipline + JMM | Programmer discipline; `-race` detector | **Compile-time** (`Send`/`Sync`) | GIL serializes bytecode |
| Primitive threads | Platform + virtual threads | Goroutines | OS threads | Threads (GIL-bound) |
| Lightweight concurrency | Virtual threads (Loom) | Goroutines | async tasks (Tokio) | asyncio |
| CPU parallelism | Yes | Yes | Yes | No (use multiprocessing) |
| Message passing | `BlockingQueue`, actors (Akka) | Channels (built-in) | `mpsc` channels | `multiprocessing.Queue` |

The spectrum runs from **"trust the programmer"** (Java, C++) through **"nudge toward messaging"** (Go) to **"enforce at compile time"** (Rust), with Python **sidestepping** shared-memory concurrency via the GIL and processes. Java and Go both *allow* shared-memory-with-locks and message-passing, but Go's culture prefers channels while Java's prefers `java.util.concurrent` structures. Rust is the outlier: it makes the discipline mandatory and machine-checked, so "forgot to lock" is a compile error rather than a production heisenbug. Python's model means you rarely fight data races in pure Python (the GIL serializes you), but you also can't get CPU parallelism from threads — the tradeoff is inverted.

### Q15. How do Go channels compare with Java's concurrency utilities for message passing?

Both support message-passing, but channels are a *language primitive* in Go while Java offers them as *library* constructs.

| | Go channel | Java (`BlockingQueue` etc.) |
|---|---|---|
| Level | Language keyword (`chan`, `<-`, `select`) | Library (`java.util.concurrent`) |
| Buffering | Unbuffered (rendezvous) or buffered | `ArrayBlockingQueue`, `LinkedBlockingQueue`, `SynchronousQueue` |
| Multiplex | `select` over many channels | No direct equivalent (poll loops / `CompletableFuture`) |
| Close semantics | `close(ch)`; receivers see closed | Sentinel value / poison pill convention |
| Cancellation | `context.Context` | `Future.cancel`, interruption |
| Idiom | Goroutines + channels (CSP) | Executors + futures + queues |

Go's `select` is the standout — it waits on multiple channel operations at once (send, receive, timeout, cancellation) and picks whichever is ready, which is how you build fan-in, timeouts, and cancellation cleanly:

```go
select {
case v := <-work:  handle(v)
case <-ctx.Done(): return          // cancellation
case <-time.After(time.Second): timeout()
}
```

Java has no single `select`; you compose `CompletableFuture` (`anyOf`, `thenCompose`) or use a `BlockingQueue` with a poison-pill/sentinel to signal completion and interruption for cancellation. Java's tools are more *object-oriented and composable* (futures chaining), Go's are more *structural and built-in* (channels + goroutines + select as the fabric of the language). With virtual threads, Java's blocking-queue-per-worker style now scales similarly to Go's goroutine-per-connection style.

### Q16. Do virtual threads / goroutines eliminate the need for thread pools and async frameworks?

Mostly for **I/O-bound concurrency**, yes — and that's the point. The historical reason for thread pools and callback/reactive frameworks was that OS threads were *expensive*, so you couldn't afford one-per-request and had to either pool a few and queue work, or write non-blocking async code to multiplex many connections onto few threads. Goroutines and virtual threads make threads *cheap*, so you can go back to the simple **thread-per-task / thread-per-request** model at massive scale:

```java
// Java 21 — one virtual thread per task, no pool sizing, no reactive plumbing
try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
    for (var req : requests) executor.submit(() -> handle(req)); // blocking code, millions of tasks
}
```

What they replace: the *I/O-scaling* motivation for bounded thread pools and for callback/reactive/async-await frameworks whose main job was avoiding blocked OS threads. You write straightforward blocking code and the runtime multiplexes it.

What they *don't* replace:
- **CPU-bound parallelism still needs bounded parallelism** ≈ #cores — you don't want a million CPU-hungry tasks thrashing; a sized pool or `ForkJoinPool` is still right.
- **Rate limiting / resource bounding** — you may still want a semaphore or bounded pool to cap concurrent DB connections, even if threads are free.
- **Don't pool virtual threads** — they're cheap; pooling them is an anti-pattern. Pools remain for *scarce resources*, not for the threads themselves.

So: for high-concurrency I/O, virtual threads/goroutines let you drop the pool-and-async ceremony. For CPU-bound work and for bounding scarce downstream resources, sized pools and backpressure still matter.

## Concurrency Bugs & Debugging

### Summary

**What this topic covers**

This is the practical, in-the-trenches topic: how concurrency bugs actually manifest, why they're uniquely hard to catch, and the tools and techniques for finding them. Everything earlier taught you how to write correct concurrent code; this teaches you what to do when it's *wrong* — often intermittently, in production, at 3am. Three concern areas: (1) **why these bugs are hard** — heisenbugs, non-determinism, timing-dependence, and why a race that fires one in a million runs is still a bug that will find you; (2) **the tooling** — race detectors (Go `-race`, ThreadSanitizer, Java jcstress/thread dumps), stress and fuzz testing, and reading thread dumps to spot deadlocks; and (3) **the bug catalogue** — the recurring mistakes (forgot to lock, wrong lock, non-atomic compound operations, broken double-checked locking, blocking the event loop, leaked threads) and how to diagnose each. The 16 questions run from "what's a heisenbug" through "read this thread dump and find the deadlock" to a systematic catalogue of the classic mistakes.

**Mental model**

Treat a concurrency bug as a **latent ordering assumption that the scheduler is free to violate.** Your sequential intuition assumes operations happen in program order and atomically; concurrency breaks both, and the failure only appears for *specific interleavings* that the OS scheduler produces rarely and unpredictably. So the debugging mindset is different from sequential debugging: you can't just re-run and reproduce, because the timing that triggered the bug won't recur on demand — that's the **heisenbug** property (observing it, with logging or a debugger, changes the timing and hides it). The right response is to stop relying on reproduction and instead: (1) reason about *what interleaving would explain this symptom* (T1/T2 step tables), (2) use **tooling that detects the bug's cause rather than its symptom** — a race detector flags an unsynchronized shared access *even on a run where the bug didn't manifest*, and (3) **stress-test** to widen the interleaving space (many threads, injected delays, `-race`, TSan). You're hunting the missing happens-before edge, not the crash.

**Key terms**

- **Heisenbug** — a bug that changes or vanishes when you observe it (add logging, attach a debugger), because observation perturbs timing.
- **Data race** — two threads access the same memory, ≥1 write, no synchronization/ordering; undefined behavior (C++) or a visibility bug (Java).
- **Race condition** — a correctness bug that depends on timing/interleaving; can exist even without a data race (e.g. check-then-act on atomics).
- **Race detector** — a tool that instruments memory accesses to flag unsynchronized shared access (Go `-race`, ThreadSanitizer).
- **ThreadSanitizer (TSan)** — Clang/GCC dynamic race detector using shadow memory + happens-before tracking.
- **Thread dump** — a snapshot of every thread's stack and lock state; the primary tool for diagnosing deadlocks and hangs.
- **Deadlock** — threads mutually blocked, each holding a lock the other needs; no progress ever.
- **Livelock** — threads actively change state in response to each other but make no progress (two people stepping aside in a hallway).
- **Starvation** — a thread never gets a resource it needs (unfair scheduling/locking).
- **Stress / fuzz testing** — running many threads / injecting random delays to widen the interleaving space and surface rare races.
- **Double-checked locking** — a lazy-init optimization that's subtly broken without `volatile` (visibility of a partially-constructed object).
- **jcstress** — the Java Concurrency Stress test harness for probing JMM-level races.

**Why interviewers ask this**

Writing correct concurrent code is one skill; *debugging* it under pressure is a rarer, more senior one. Interviewers use this to see whether you've actually been burned — anyone who has will immediately say "you can't just re-run it, it's a heisenbug, reach for `-race`/TSan." Juniors try to reproduce and add print statements (which hides the bug); seniors reason about interleavings, use race detectors that find the *cause* not the symptom, and know that "it passed 10,000 times" doesn't prove absence of a race. The bug catalogue is a direct competence probe: can you spot a non-atomic `count++`, a broken double-checked lock, a wrong-lock-object mistake, or a blocked event loop by reading code? And "read this thread dump" tests whether you can operate the tools that resolve real production incidents.

**Common confusions**

- "It passed the tests, so it's correct" — concurrency tests passing means *those interleavings* were fine; the bug lives in interleavings you didn't hit. Absence of failure ≠ absence of race.
- "Adding logging will help me find it" — often the opposite: logging adds timing/synchronization that *hides* the heisenbug. Use a race detector instead.
- "A deadlock and a livelock are the same" — deadlock = everyone blocked/stuck (threads not runnable); livelock = everyone busy but no progress (threads runnable, spinning).
- "`-race`/TSan proves my code is race-free" — they only detect races on *executed* interleavings; they find real bugs but can't prove absence. Still, if they flag something, it's real.
- "Double-checked locking is a good idiom" — only when done exactly right (`volatile`/`atomic`); the naive version is a classic broken optimization.
- "Blocking the event loop just makes that one request slow" — no, it freezes *every* request, because there's one thread for all of them.

**What follows from this topic**

This topic is where every earlier concept gets tested against reality: the memory model shows up as the missing happens-before a race detector flags; lock ordering shows up as the cycle in a thread dump; atomicity shows up as the non-atomic `count++`; the event loop shows up as a blocked Node/asyncio process. It also connects to the language-models topic — each language ships different tooling (Go's built-in `-race`, C++/Rust TSan, Java thread dumps and jcstress) — and to testing discipline generally: because you can't rely on reproduction, you invest in race detectors in CI, stress tests, and designs that minimize sharing so there's less to get wrong. The meta-lesson: **prevent by design (immutability, message passing, fewer shared writes), detect with tooling, and reason in interleavings when you must debug.**

### Q1. What is a heisenbug and why are concurrency races so hard to reproduce?

A **heisenbug** is a bug that **changes behavior or disappears when you try to observe it** — named after Heisenberg's uncertainty principle. Concurrency races are the archetype: the bug depends on a precise *interleaving* of threads that the OS scheduler produces rarely and non-deterministically.

Why they resist reproduction:

- **Timing-dependent**: the bug fires only when, say, T2's write lands between T1's read and T1's write. That window might be nanoseconds wide and hit one run in a million.
- **Observation perturbs timing**: adding a `print`/log statement, attaching a debugger, or even running under different load changes thread scheduling — and the vulnerable interleaving no longer occurs. The bug "goes away" the moment you look.
- **Environment-sensitive**: core count, CPU load, cache state, and OS scheduler all shift the interleaving, so it reproduces on prod but not your laptop.

```text
The bad interleaving (rare):        The common interleaving (fine):
 T1: read x=0                        T1: read x=0
 T2: read x=0   ← both read stale    T1: write x=1
 T1: write x=1                       T2: read x=1
 T2: write x=1  ← lost update        T2: write x=2
```

The consequence for debugging: **you cannot rely on re-running to reproduce.** Instead you (1) reason about which interleaving explains the symptom, and (2) use tools that detect the *unsynchronized access itself* (race detectors) rather than waiting for the crash. "Passed 10,000 times" proves nothing — you just didn't hit the window.

### Q2. What's the difference between a data race and a race condition?

They overlap but are distinct, and precision here is a senior signal.

- **Data race** — a *low-level, memory-model* violation: two threads access the same memory location, at least one writes, and there's no synchronization ordering between them. In C++ it's **undefined behavior**; in Java it's a **visibility/tearing** hazard. It's defined purely by the memory accesses.
- **Race condition** — a *higher-level correctness* bug: the program's result depends on the timing/interleaving of operations. It's about the *logic being wrong* under some schedule.

The key insight: **you can have one without the other.**

```text
Race condition WITHOUT a data race — check-then-act on an atomic:
  if (map.containsKey(k))     // T1 checks: absent
                              // T2 inserts k
      map.put(k, v);          // T1 inserts anyway — logic race, but each op is thread-safe

Data race WITHOUT an obvious logic bug — unsynchronized flag read:
  // T1: done = true;   T2: while(!done){}   ← may loop forever (visibility) — a data race
```

A `ConcurrentHashMap` eliminates *data races* on its internal state, but `containsKey`-then-`put` is still a *race condition* — you need an atomic `putIfAbsent`/`computeIfAbsent`. Conversely, an unsynchronized `boolean flag` is a data race whose fix (`volatile`/atomic) restores visibility. Practical takeaway: race detectors catch **data races**; **race conditions** need reasoning about atomicity of compound operations, and tools help less.

### Q3. Spot the bug: `count++` from multiple threads.

```java
class Counter {
    private int count = 0;
    void increment() { count++; }   // BUG: not atomic
    int get() { return count; }
}
// 10 threads each call increment() 1000 times → expected 10000, actual < 10000
```

`count++` is **not one operation** — it's a read-modify-write triple: `load count; add 1; store count`. Between the load and the store, another thread can slip in:

```text
 T1: load count → 5
 T2: load count → 5      ← reads the SAME stale value
 T1: add 1 → 6
 T1: store count = 6
 T2: add 1 → 6           ← operates on stale 5
 T2: store count = 6     ← LOST UPDATE: should be 7, is 6
```

This is the canonical **non-atomic compound operation** race — two increments, one lost. There's also a *visibility* problem (`get()` may see a stale value) but the atomicity bug is the headline. Fixes, in order of preference:

- **`AtomicInteger`** — `count.incrementAndGet()` does the RMW atomically via CAS. Best for a simple counter (lock-free, scales well).
- **`synchronized`** on both `increment` and `get`, or a `ReentrantLock` — heavier, but needed if you update multiple fields together.
- **`LongAdder`** — under high contention, spreads the count across cells to reduce CAS contention; read sums them.

Marking `count` merely `volatile` is **not enough** — `volatile` fixes visibility but `count++` is still a non-atomic RMW, so lost updates persist. That's the classic trap.

### Q4. How does a race detector like Go's `-race` or ThreadSanitizer work?

They instrument every memory access at runtime and track the **happens-before** relationship between accesses to each location. When two threads access the same address, at least one writes, and there's **no happens-before edge** ordering them (no shared lock, channel op, or atomic linking them), it reports a data race.

```text
Shadow memory: for each app memory location, store recent access metadata
  (which thread, read/write, vector clock).
On each access:
  compare with prior accesses to that location
  if conflicting (≥1 write) AND not ordered by happens-before → REPORT race
```

- **Go `-race`**: built into the toolchain — `go test -race`, `go run -race`. Uses the same ThreadSanitizer runtime under the hood. Tracks goroutine synchronization (channel send/recv, mutex, `sync/atomic`) to build the happens-before graph.
- **ThreadSanitizer (TSan)**: `clang -fsanitize=thread` / GCC; works for C, C++, and Rust. Uses **shadow memory** and per-thread **vector clocks**.

Crucial properties: (1) It detects a race **even on a run where the bug didn't produce wrong output** — because it flags the *missing synchronization*, not the *symptom*. That defeats the heisenbug problem. (2) It only sees **executed** interleavings, so you must exercise the code path (run your test suite under `-race`) — it can't prove absence of races, only find present ones. (3) Costs ~5–15× slowdown and extra memory, so it's a CI/test tool, not production. Rule: **run your concurrency tests under `-race`/TSan in CI** — a flagged race is almost always real.

### Q5. How does stress and fuzz testing help find concurrency bugs?

Since rare interleavings are the problem, you deliberately **widen the space of interleavings you explore** so the bad one surfaces during testing rather than in production.

Techniques:
- **High concurrency / repetition**: run the operation with many threads, many iterations, on a multicore box — more threads and more runs sample more interleavings. `for i in {1..10000}; do go test -race -run TestConcurrent; done`.
- **Delay/schedule injection**: insert randomized `sleep`/yield/`Thread.yield()` at suspect points to force uncommon orderings (the "noise injection" TSan and some harnesses do automatically). This pries open the tiny windows that rarely hit naturally.
- **jcstress (Java)**: a purpose-built harness that runs two+ methods against shared state billions of times across many schedules and records the *distribution of outcomes*, revealing JMM-level races (e.g., seeing a partially-published object).
- **Model checking / systematic exploration**: tools like Loom (Rust), CHESS, or `rr`'s chaos mode *enumerate or bias* interleavings rather than sampling randomly, giving stronger coverage for small units.
- **Combine with a race detector**: stress *plus* `-race`/TSan is the strongest combo — stress exercises the interleaving, the detector flags the missing sync even if output looked fine.

The honest limit: stress testing raises the *probability* of hitting a bug but never *proves* correctness — the interleaving space is astronomically large. That's why prevention-by-design (immutability, message passing) and static reasoning still matter.

### Q6. Read this thread dump — how do you find a deadlock?

A **thread dump** snapshots every thread's stack and the locks each **holds** vs **waits for**. A deadlock shows as a **cycle**: T1 holds A wants B, T2 holds B wants A.

```text
"Thread-1" ... BLOCKED
   waiting to lock <0xAAA> (a LockB)     ← wants B
   holding <0xBBB> (a LockA)             ← holds A
   at Service.transfer(Service.java:20)

"Thread-2" ... BLOCKED
   waiting to lock <0xBBB> (a LockA)     ← wants A
   holding <0xAAA> (a LockB)             ← holds B
   at Service.transfer(Service.java:20)
```

Reading it:
1. Find threads in **`BLOCKED`** state that are **"waiting to lock"** a monitor.
2. Note the object id each is **holding** and the id each is **waiting** for.
3. Trace the wait-for chain: T1 waits for `0xAAA` which T2 holds; T2 waits for `0xBBB` which T1 holds → **cycle = deadlock**.

The JVM often does this for you: **`jstack <pid>`** (or `kill -3 <pid>`, or jconsole/VisualVM) prints a **"Found one Java-level deadlock"** section naming the threads and the lock cycle. In Go, sending `SIGQUIT` dumps all goroutine stacks, and the runtime prints **"fatal error: all goroutines are asleep - deadlock!"** when *every* goroutine is blocked. 

The fix is almost always **global lock ordering** — make every code path acquire A before B (e.g., order by object identity/hash) so no cycle can form. The dump gives you the two stack lines (both at `transfer:20`) that acquire in inconsistent order.

### Q7. Fix this deadlock.

```java
void transfer(Account from, Account to, int amt) {
    synchronized (from) {          // T1: transfer(a,b) locks a
        synchronized (to) {        // T2: transfer(b,a) locks b, then each waits → DEADLOCK
            from.debit(amt);
            to.credit(amt);
        }
    }
}
```

The bug is **inconsistent lock ordering**: `transfer(a,b)` locks a→b while a concurrent `transfer(b,a)` locks b→a, forming a cycle. Fix by imposing a **global order** so both always acquire in the same sequence:

```java
void transfer(Account from, Account to, int amt) {
    Account first  = from.id < to.id ? from : to;   // consistent order by id
    Account second = from.id < to.id ? to   : from;
    synchronized (first) {
        synchronized (second) {
            from.debit(amt);
            to.credit(amt);
        }
    }
}
```

Now every thread locks the lower-id account first, so no cycle can form — deadlock impossible. (Guard the `from == to` / equal-id case if self-transfer is possible, e.g., with a tie-breaker or an early return.)

Alternative fixes: (1) **`tryLock` with timeout + backoff** — attempt both locks, release and retry on failure (avoids the hold-and-wait Coffman condition, but can livelock without jitter). (2) A **single coarse lock** for all transfers — simplest, kills parallelism. (3) **`java.util.concurrent`** higher-level constructs. Global ordering is the standard, most scalable answer and the one interviewers want.

### Q8. Diagnose the difference between deadlock, livelock, and starvation.

All three are "no useful progress," but the mechanism and the thread state differ.

| | Deadlock | Livelock | Starvation |
|---|---|---|---|
| Threads are | Blocked (not runnable) | Runnable, actively spinning | Runnable but never scheduled/served |
| Progress | None, ever | None, but CPU busy | Some threads progress, victim doesn't |
| Cause | Circular wait on locks | Threads react to each other endlessly | Unfairness (priority, greedy peers) |
| CPU usage | Idle (parked) | High (busy) | Normal |
| Classic example | A holds L1 wants L2, B holds L2 wants L1 | Two people stepping aside in a hallway | Low-priority thread starved by high-priority ones |

- **Deadlock**: threads are **blocked** forever in a wait cycle. Detectable in a thread dump as a lock cycle; CPU is *idle*.
- **Livelock**: threads are **running** and changing state in response to each other but never advance — e.g., two threads that each detect a conflict, both back off, both retry, both conflict again. Distinctive tell: high CPU but zero throughput. Common with naive `tryLock`-and-retry without randomized backoff.
- **Starvation**: the system *is* making progress, but a *particular* thread perpetually loses — it can't acquire a lock because others keep grabbing it (unfair lock), or a low-priority thread never gets CPU (a form of which is **priority inversion**). Fix with **fair locks** (`new ReentrantLock(true)`), aging, or bounded waiting.

Diagnosis path: thread dump shows a lock cycle → deadlock; high CPU with no progress and threads looping in retry code → livelock; one thread perpetually `BLOCKED`/`WAITING` while peers progress → starvation. Fixes: lock ordering (deadlock), randomized backoff/step-down (livelock), fairness/aging (starvation).

### Q9. How do you add logging to concurrent code without changing the timing?

The danger is that logging *is* synchronization: `System.out.println`/a synchronized logger adds a lock and I/O that reorders threads and **hides the heisenbug** (or creates a new one). Techniques to observe without perturbing:

- **Log to a lock-free / per-thread buffer**, flush later. Append to a thread-local ring buffer or a lock-free MPSC queue in memory; a separate thread drains it to disk *off* the hot path. No shared lock in the critical section → minimal timing change.
- **Use async / non-blocking logging** (e.g., Log4j2 async appenders, LMAX Disruptor) so the logging call returns immediately and I/O happens elsewhere.
- **Prefer post-hoc tools over inline prints**: race detectors (`-race`/TSan), thread dumps (`jstack`), flight recorders (**JFR**), `perf`/eBPF tracing, and `strace` observe *without* editing the code path's synchronization.
- **Record, don't print**: capture cheap monotonic timestamps + thread id + event id into a preallocated array; reconstruct the interleaving *after* the run. Avoid formatting strings inline (allocation/locking).
- **Sample instead of log everything** to keep overhead below the threshold that changes scheduling.

The meta-point: any observation changes timing *somewhat*; the goal is to make the perturbation **small and lock-free** so the vulnerable interleaving still occurs. When precise reproduction matters, deterministic replay tools (`rr`) record the actual schedule so you can replay the exact interleaving under a debugger.

### Q10. Why is naive double-checked locking broken, and how do you fix it?

Double-checked locking (DCL) lazily initializes a singleton, checking the field *outside* the lock to avoid synchronizing on the common (already-initialized) path.

```java
class Broken {
    private static Singleton instance;              // BUG: not volatile
    static Singleton get() {
        if (instance == null) {                     // 1st check (no lock)
            synchronized (Broken.class) {
                if (instance == null)               // 2nd check (locked)
                    instance = new Singleton();     // (a) alloc (b) construct (c) assign
            }
        }
        return instance;
    }
}
```

The bug: `instance = new Singleton()` is **not atomic** — it allocates, runs the constructor, and assigns the reference, and the compiler/CPU may **reorder** so the reference is published *before* the object is fully constructed. Another thread hitting the first `if (instance == null)` (no lock, no happens-before) can see a **non-null but half-initialized** object and use it:

```text
 T1: allocate memory
 T1: publish reference (reorder!)   ← instance != null now
 T2: sees instance != null, returns it
 T1: run constructor                ← too late: T2 already used a broken object
```

**Fix: declare the field `volatile`.** In the Java Memory Model (since Java 5), `volatile` prevents that reordering and creates a happens-before edge, so any thread seeing a non-null `instance` also sees the fully-constructed object.

```java
private static volatile Singleton instance;   // the one-word fix
```

Better still, avoid DCL entirely: the **initialization-on-demand holder idiom** (static nested class) gets lazy, thread-safe init for free from the class loader, or just use an `enum` singleton. In C++, use `std::call_once`/`std::once_flag`, or a function-local `static` (guaranteed thread-safe init since C++11), or an `atomic` with acquire/release. The general lesson: **safe publication requires a memory barrier** — you can't cheat visibility with an ordinary field.

### Q11. What does "blocking the event loop" mean and how do you detect it?

In single-threaded event-loop runtimes (Node.js, Python asyncio, browsers), **one thread runs all tasks**. If any callback does long **synchronous** work — a tight CPU loop, a huge `JSON.parse`, a synchronous file read, `bcrypt` on the main thread — the loop can't pull the next task, so **every** pending request, timer, and I/O callback stalls, not just the current one.

```text
Healthy loop:              Blocked loop:
 [t1][t2][t3][t4] ...        [====== long sync task ======][t2][t3]
 each task short,            everything queued behind it — whole server frozen
 loop stays responsive       (timers late, requests hang, health checks fail)
```

Detecting it:
- **Event-loop lag metrics**: measure the delay of a `setInterval`/timer that *should* fire on schedule; if it's late, the loop is blocked. Node's `perf_hooks.monitorEventLoopDelay()` or libraries like `blocked-at` report this and often the offending stack.
- **Profiling**: a CPU profile (`node --prof`, `--cpu-prof`, clinic.js, py-spy for asyncio) shows a long synchronous frame hogging the single thread.
- **Symptoms**: throughput cliff, rising p99 latency across *all* endpoints simultaneously, missed heartbeats/health checks, `asyncio` "Executing <Task> took X seconds" warnings (`loop.slow_callback_duration`).

Fixes: move CPU-heavy work **off the loop** — Node **worker_threads**/child processes, Python `run_in_executor` (thread/process pool), or chunk the work with `setImmediate`/`await asyncio.sleep(0)` to yield. Use **async, non-blocking** APIs for I/O (never the `...Sync` variants on the hot path). The rule: **the event loop thread must never do long synchronous work.**

### Q12. What is a thread/goroutine leak and how do you catch it?

A **thread leak** is threads (or goroutines) that are created but never terminate — they block forever, so they accumulate, consuming stacks, memory, and scheduler capacity until the process degrades or OOMs.

Common causes:
- A **goroutine blocked on a channel** no one will ever send to / receive from (e.g., producer exits without closing; consumer waits forever). This is the #1 Go leak.
- A worker blocked in a **queue take** or on a lock that's never released.
- **Unbounded thread creation** — spawning a thread per request without a pool, so a traffic spike creates thousands.
- Missing **cancellation / timeout** — a goroutine waiting on a downstream that hung, with no `context` deadline.

```go
func leak() {
    ch := make(chan int)     // unbuffered
    go func() { val := <-ch; use(val) }()  // blocks forever — nobody sends
    return                   // goroutine leaked
}
```

Catching them:
- **Go**: `runtime.NumGoroutine()` trending up over time; the **pprof goroutine profile** (`/debug/pprof/goroutine?debug=2`) shows every goroutine's stack — leaked ones pile up at the same blocking line. `go test` with `goleak` (uber-go/goleak) fails tests that leave goroutines behind.
- **Java**: thread count climbing (JMX `ThreadMXBean`, VisualVM, `jstack` showing many threads parked at the same `park`/`take`); heap dumps show retained thread objects.
- **General**: alert on thread/goroutine count as a metric; a monotonic rise under steady load = a leak.

Prevention: always give blocking operations a way out — **`context.Context` with timeout/cancel**, `close(ch)` to unblock receivers, `select` with a `ctx.Done()` case, bounded pools instead of per-request threads, and ensure every spawned worker has a guaranteed termination path.

### Q13. Spot the bug: this "thread-safe" cache isn't.

```java
class Cache {
    private final Map<String, Value> map = new ConcurrentHashMap<>();
    Value getOrCompute(String key) {
        Value v = map.get(key);          // check
        if (v == null) {
            v = expensiveCompute(key);   // ... T2 does the same here
            map.put(key, v);             // act — two computes, one wins
        }
        return v;
    }
}
```

`ConcurrentHashMap` makes each *individual* operation thread-safe, but the **check-then-act** sequence (`get` → compute → `put`) is **not atomic** as a whole. Two threads can both see `null`, both run `expensiveCompute` (wasted work, and worse if compute has side effects or the two values differ), and both `put`:

```text
 T1: get(k) → null
 T2: get(k) → null          ← both miss
 T1: compute(k)  (expensive, maybe side-effecting)
 T2: compute(k)  (duplicated)
 T1: put(k, v1)
 T2: put(k, v2)             ← last write wins; callers may hold different objects
```

This is a **race condition without a data race** — the map's internals are fine, but the compound operation's logic is wrong. Fix with the map's **atomic compound method**:

```java
Value getOrCompute(String key) {
    return map.computeIfAbsent(key, this::expensiveCompute);  // atomic: computes at most once per key
}
```

`computeIfAbsent` performs the check-and-insert atomically, guaranteeing `expensiveCompute` runs **at most once per key** and all callers get the same object. (Caveat: don't have the compute lambda recursively touch the same map — it can deadlock/`ConcurrentModificationException` on some versions; and for a truly expensive compute you might store a `Future`/memoized task to avoid holding a bin lock.) The general lesson: **thread-safe building blocks don't make compound operations atomic** — you must use the provided atomic method or add your own synchronization.

### Q14. Give a catalogue of the most common concurrency bugs.

The recurring mistakes an interviewer wants you to recognize on sight:

- **Forgot to lock** — a shared field written without any synchronization → data race, lost updates, visibility bugs. Fix: guard *all* accesses (reads too) with the same lock or make it atomic/`volatile`.
- **Wrong lock (lock on the wrong object)** — different threads synchronize on *different* monitors (e.g., `synchronized(this)` in instances that should share a lock, or locking a mutable/boxed field). No mutual exclusion despite looking locked. Fix: one designated, `final` lock object per shared invariant.
- **Non-atomic compound operation** — `count++`, check-then-act, get-then-put; each part is safe but the sequence isn't. Fix: atomics/`computeIfAbsent`/hold a lock across the whole sequence.
- **Inconsistent lock ordering** — acquiring locks in different orders on different paths → deadlock. Fix: global lock ordering.
- **Broken double-checked locking** — lazy init without `volatile` publishes a half-constructed object. Fix: `volatile`/holder idiom.
- **Blocking the event loop** — long synchronous work on the single-threaded loop freezes everything. Fix: offload to workers, use async I/O.
- **Leaking threads/goroutines** — blocked forever on a channel/queue with no cancellation. Fix: timeouts, `context`, close channels, bounded pools.
- **Assuming visibility without a barrier** — a flag set by one thread never seen by another (no `volatile`/synchronization) → infinite loop. Fix: `volatile`/atomic/`synchronized`.
- **Spurious wakeup / `if` instead of `while`** — waking from `wait()` and not re-checking the predicate. Fix: always wait in a `while(!condition)` loop.
- **Holding a lock during a blocking call / callback** — invites deadlock (lock convoy, reentrancy). Fix: do I/O and callbacks *outside* the lock.

Each maps back to the three fundamentals: **atomicity** (compound ops), **visibility** (missing barriers), **ordering** (lock ordering, DCL).

### Q15. Why does "it passed 10,000 times" not prove a concurrency test is correct?

Because a passing run only tells you **that particular interleaving was fine** — and the number of possible interleavings is astronomically larger than any test count.

For `n` threads each doing `k` atomic steps, the number of possible orderings is roughly `(nk)! / (k!)^n` — combinatorially enormous. Your 10,000 runs sample a *tiny, biased* corner of that space: on your hardware, under your load, the scheduler tends to produce the *same common* interleavings over and over, precisely avoiding the rare window that triggers the bug. The vulnerable ordering might occur one run in ten million — or only under production's core count and load.

```text
interleaving space:  ████████████████████████████  (all possible orderings)
your 10k runs hit:   ░  ← same tiny cluster, biased by your scheduler
the bug lives here:                          ✗  ← rare window, never sampled
```

This is the flip side of the heisenbug: **absence of failure is not evidence of correctness** for concurrent code. What *does* raise confidence:

- **Race detectors** (`-race`/TSan) — flag the *missing synchronization* even on a passing run, so you don't need to hit the bad interleaving.
- **Systematic tools** — jcstress, Loom (Rust), model checkers that *enumerate or bias* interleavings rather than sampling naturally.
- **Formal reasoning** — prove the happens-before edges exist; design to minimize sharing so there's less to prove.

So the right answer: "10,000 passes reduces my worry slightly but proves nothing; I'd run it under a race detector and a stress harness, and better, design out the shared mutable state so the race can't exist."

### Q16. Walk through debugging an intermittent production hang.

A structured approach, because you can't just reproduce it:

**1. Capture state before restarting.** The instinct is to restart; resist it until you grab evidence. Take a **thread dump** (`jstack <pid>` / `kill -3`, or `SIGQUIT` for Go goroutine dump) — ideally *several* seconds apart. A hang is frozen, so the dump is a clean snapshot.

**2. Classify the hang from the dump.**
- Threads **BLOCKED** in a lock **cycle** → **deadlock** (the dump often says "Found one Java-level deadlock"). CPU near zero.
- Threads **WAITING**/parked on a condition/channel that's never signaled, or all goroutines asleep → **lost wakeup / leak / missing signal**. CPU near zero.
- **High CPU** but no throughput, threads spinning in retry code → **livelock** or a hot spin loop.
- One **shared resource** (DB pool, connection semaphore) exhausted, everyone waiting to acquire → **resource starvation / pool exhaustion** (a very common "hang").

**3. Corroborate with metrics.** Event-loop lag (Node/asyncio), thread/goroutine count trend (leak?), lock-wait time, DB pool saturation, GC pauses. Two dumps compared: if the same threads sit at the same stack line, they're stuck there.

**4. Form an interleaving hypothesis.** From the stuck stack lines, reason about *what ordering* produces this state — e.g., "producer exited without closing the channel, consumers wait forever," or "these two stacks acquire locks in opposite order."

**5. Reproduce narrowly + confirm the fix.** Extract the suspect path into a stress test under `-race`/TSan / jcstress to force the interleaving, confirm the bug, apply the fix (lock ordering, close/timeout/`context`, `volatile`, bound the pool), and prove it under the same stress harness.

**6. Prevent recurrence.** Add the race detector to CI, add timeouts/cancellation so a future hang self-heals, alert on the leading indicator (pool saturation, goroutine count, event-loop lag). The theme: **evidence first (dumps + metrics), classify, hypothesize an interleaving, force it with tooling, then design the whole class of bug out.**
## Scalability, Contention & Performance

### Summary

**What this topic covers**

This is the topic where concurrency stops being about *correctness* and starts being about *why your correct program doesn't get faster when you add cores*. It covers the hardware and statistical laws that bound multithreaded scaling: **Amdahl's law** (serial fraction caps speedup), **Little's law** (concurrency = throughput × latency, used for sizing pools), and the memory-hierarchy realities — **cache coherence / MESI**, **false sharing** (two threads writing different variables that share a cache line), and **NUMA** (memory-access cost depends which socket owns the RAM). It also covers the counterintuitive failure mode where **adding threads makes you slower** (lock contention collapse), the standard cures (per-core sharding, thread-local aggregation, read-mostly tricks like RCU and seqlocks), the limits of lock-free scaling, and how you actually *measure* contention (profilers, flame graphs, lock profilers). The 16 questions here run from "explain Amdahl's law with numbers" to "why does false sharing kill scaling and how do you fix it."

**Mental model**

Stop thinking of a multicore machine as N independent CPUs and start thinking of it as N cores fighting over **one shared memory system and one set of coherence buses**. A thread that "just increments a counter" is really issuing a request across the coherence fabric to gain exclusive ownership of a cache line, and every other core that touches that line has to give it up. Scaling is therefore governed by two ceilings. The first is *algorithmic*: Amdahl says any serial fraction `s` caps speedup at `1/s` no matter how many cores — 5% serial means 20× is the absolute limit. The second is *physical*: even "parallel" work contends on shared cache lines, locks, and memory bandwidth, so real curves peak and then *decline* as you add threads. The senior instinct is to treat every shared mutable location as a scaling liability and to design so that the common path touches **only core-local state** — sharded counters, thread-local buffers, immutable snapshots — reconciling globally only rarely. Measure before you tune: contention is invisible in a single-threaded profile and only shows up under concurrent load.

**Key terms**

- **Amdahl's law** — speedup ≤ `1 / (s + (1−s)/N)`; serial fraction `s` bounds it at `1/s`.
- **Gustafson's law** — if problem size grows with cores, achievable speedup scales roughly linearly; the optimistic counterpart to Amdahl.
- **False sharing** — distinct variables on the same 64-byte cache line, causing coherence traffic even with no logical sharing.
- **Cache line** — unit of coherence, typically 64 bytes; the granularity at which ownership ping-pongs.
- **MESI** — cache-coherence protocol (Modified/Exclusive/Shared/Invalid) that keeps per-core caches consistent.
- **Cache-line ping-pong** — a line bouncing Modified→Invalid between cores on every write; the mechanism behind false sharing and hot-lock contention.
- **NUMA** — Non-Uniform Memory Access; remote-socket memory is slower than local-socket memory.
- **Contention collapse** — throughput *decreasing* past a thread count because coordination cost dominates.
- **Little's law** — `L = λ × W` (in-flight = arrival-rate × time-in-system); used to size pools and queues.
- **Sharding / striping** — splitting one hot structure into per-core/per-key pieces to spread contention.
- **RCU (Read-Copy-Update)** — read-mostly technique: readers are lock-free, writers copy and swap, reclaim after a grace period.
- **`@Contended` / padding** — inserting slack so a hot field owns its cache line, killing false sharing.

**Why interviewers ask this**

This is the topic that separates "I can make it correct" from "I can make it *fast*." A junior writes a `synchronized` counter, sees it work, and stops. A senior anticipates that the same counter under 32 threads will be slower than one thread and reaches for `LongAdder`, sharding, or an atomic *before* the bottleneck ships. Interviewers use it to probe whether you understand that hardware is not free abstraction: that a cache miss is ~100× a hit, that a contended lock serializes everything, that "add more threads" is not a scaling strategy. The strongest signal is a candidate who reaches for a *measurement* ("I'd profile lock hold time / look at a flame graph") rather than guessing, and who can quote Amdahl to explain *why* the eighth core bought almost nothing.

**Common confusions**

- "More threads = more throughput" — only until contention or bandwidth saturates; past that, throughput *drops*.
- "Amdahl's law is pessimistic and irrelevant" — it's exact for fixed problem size; Gustafson only rescues you if the problem *grows*.
- "False sharing is a form of a data race" — no; it's a *performance* bug with correct results. No race, just coherence traffic.
- "Atomics are lock-free so they scale" — a single hot atomic still ping-pongs one cache line and serializes; lock-free ≠ contention-free.
- "NUMA doesn't matter for my app" — a thread reading remote-socket memory can pay 1.5–2× latency; matters a lot for large heaps.
- "Reader-writer locks always help read-heavy workloads" — the shared-lock bookkeeping itself contends; RCU/seqlocks/immutability often beat them.

**What follows from this topic**

This is where the shared-memory story hits its ceiling — and that ceiling is the reason the next topic, **Distributed & Async Concurrency at Scale**, exists: when one machine can't scale a hot structure, you shard it across machines and trade coherence for eventual consistency. The false-sharing and atomics material connects back to memory models and CAS; the sizing math (Little's law, Amdahl) feeds thread-pool tuning. And the debugging instinct here — *measure contention, don't guess* — is exactly the muscle the final **Scenario & Interview Playbooks** topic drills.

### Q1. State Amdahl's law and work a concrete example. Why does it kill naive "just add cores" scaling?

Amdahl's law: if a fraction `s` of a program is inherently serial and `(1−s)` is perfectly parallelizable across `N` cores, the overall speedup is

```text
speedup(N) = 1 / ( s + (1 - s)/N )
```

As `N → ∞`, the parallel term vanishes and speedup → `1/s`. The serial fraction is a hard ceiling.

Concrete numbers with `s = 0.05` (5% serial):

```text
 N=1  : 1.00x
 N=2  : 1.90x
 N=4  : 3.48x
 N=8  : 5.93x
 N=16 : 9.14x
 N=32 : 12.55x
 N=inf: 20.00x   <- absolute ceiling, 1/0.05
```

You buy a 32-core machine and get **12.5×**, not 32×. You buy 1000 cores and still never beat **20×**. The lesson: the serial fraction — lock acquisition, a single shared counter, I/O flushed under one mutex, JVM warmup, coordinator steps — is what you must attack. Shaving `s` from 5% to 1% raises the ceiling from 20× to 100×; that's worth far more than more cores. This is why senior engineers hunt for the *serial* bottleneck first and treat "add threads" as the last lever, not the first.

Amdahl assumes fixed problem size. Its optimistic sibling, **Gustafson's law**, notes that in practice you often grow the problem to fill the machine (bigger datasets, more requests), and then the parallel fraction dominates and speedup scales roughly linearly. Both are true; which applies depends on whether your workload is fixed-size (Amdahl) or scale-out (Gustafson).

### Q2. What is false sharing, why does it destroy scaling, and how do you fix it?

**False sharing** is when two threads write to two *different* variables that happen to live on the **same cache line** (typically 64 bytes). Logically there's no sharing — but the cache-coherence protocol tracks ownership at cache-line granularity, so each write forces the other core's copy to be invalidated. The line **ping-pongs** between cores' caches, and both threads stall on coherence traffic despite touching independent data.

```text
Cache line (64 bytes):  [ counterA | counterB | ... ]
                            ^T1 writes   ^T2 writes
T1 writes A -> line goes Modified in T1's cache, Invalid in T2's
T2 writes B -> line goes Modified in T2's cache, Invalid in T1's
... every write bounces the whole line -> ~100-cycle miss each time
```

Symptom: a "perfectly parallel" per-thread counter array scales *worse* than a single lock, and performance gets worse the more threads you add. It's a pure performance bug — results are correct.

Fix by **padding** each hot variable onto its own cache line, or by letting the runtime do it:

```java
// Java: JDK-blessed annotation (needs -XX:-RestrictContended for user code)
@jdk.internal.vm.annotation.Contended
volatile long counter;

// Or use LongAdder, which internally shards + pads to avoid false sharing.
```

```cpp
struct alignas(64) PaddedCounter { std::atomic<long> v; };
PaddedCounter counters[NUM_THREADS];  // each owns its own line
```

The general rule: give any independently-mutated hot field its own cache line, or shard so each thread writes only to core-local, cache-line-aligned state.

### Q3. Explain cache coherence and the MESI protocol at a level relevant to writing fast concurrent code.

Every core has its own L1/L2 cache. **Cache coherence** is the hardware guarantee that they all agree on the value of any memory location despite these private copies. **MESI** is the canonical protocol; each cached line is in one of four states:

| State | Meaning | Others can have it? |
|---|---|---|
| **Modified** | This core has the only copy, dirty (differs from RAM) | No |
| **Exclusive** | Only copy, clean | No |
| **Shared** | Clean copy, possibly cached elsewhere | Yes (read-only) |
| **Invalid** | Stale, must refetch | — |

The rule that matters for performance: **a write requires exclusive ownership**. To write a line, a core must transition it to Modified, which means broadcasting an invalidation that flips every other core's copy to Invalid. So:

- **Read-shared** data is cheap — many cores hold it Shared, no traffic.
- **Write-shared** data is expensive — every write triggers cross-core invalidation and the next reader takes a coherence miss (~tens to ~100+ cycles).

This is *why* a single hot atomic counter doesn't scale (its line lives Modified in one core at a time and bounces), why false sharing hurts (unrelated writes still force ownership transfer), and why read-mostly designs win (keep the hot line Shared). You don't program MESI directly, but every scaling decision — shard the counter, keep readers lock-free, pad hot fields — is really "avoid write-sharing a cache line."

### Q4. What is NUMA and when does it affect concurrent programs?

**NUMA** (Non-Uniform Memory Access) describes multi-socket machines where each CPU socket has its own attached RAM. A core accessing memory on its **local** node is fast; accessing memory on a **remote** node goes across the inter-socket interconnect (UPI/Infinity Fabric) and costs noticeably more — often 1.5–2× the latency and lower bandwidth.

```text
   Socket 0                 Socket 1
 [cores][L3]--local--[RAM0] [RAM1]--local--[L3][cores]
    |                                            |
    +--------- interconnect (remote) ------------+
             slower, bandwidth-limited
```

It bites concurrent programs in a few ways:

- **First-touch allocation**: on Linux a page is physically placed on the node of the thread that *first writes* it, not the one that `malloc`'d it. Allocate-on-one-thread, use-on-many is a classic anti-pattern — all pages land on one node and every other socket pays remote cost. Initialize data on the thread that will use it.
- **Thread migration**: the scheduler moving a thread to another socket suddenly makes all its hot data remote. Pin threads (`taskset`, `numactl`, thread affinity) for latency-critical work.
- **Large shared heaps**: a big JVM/DB heap spanning nodes means unpredictable access cost; NUMA-aware allocators and per-node arenas help.

Practical guidance: for most services it's a second-order effect, but for high-throughput data-plane software (databases, in-memory caches, HFT) NUMA-awareness — local allocation, thread pinning, per-node sharding — is a real multiplier.

### Q5. Why can adding more threads make a program *slower*? Walk through contention collapse.

Because past a point, threads spend more time **coordinating** than **working**. The throughput-vs-threads curve rises, peaks, then *declines* — that decline is contention collapse.

```text
throughput
   |         .--.__
   |       .'      '--.____
   |     .'               '----____   <- collapse
   |   .'
   | .'
   +------------------------------ threads
       peak here      too many here
```

Mechanisms:

1. **Lock contention**: with a hot lock, only one thread makes progress in the critical section; the rest spin or sleep. Adding threads just lengthens the wait queue. If the lock protects 10% of the work, Amdahl caps you — but *convoying* makes it worse than Amdahl predicts.
2. **Context-switch / scheduling overhead**: more runnable threads than cores means the OS time-slices, and each switch flushes caches and TLBs. Work gets done in smaller, colder slices.
3. **Cache-line ping-pong**: more writers to shared state = more coherence traffic per operation, so *per-op cost rises* with thread count.
4. **Lock convoy**: threads pile up behind a lock, get released in a burst, all contend again — the system oscillates instead of flowing.

The fix is rarely "fewer threads" alone; it's **reduce the serial/shared fraction**: shard the hot lock, replace it with per-thread accumulation, make the hot path touch only local state, or size the pool to the actual parallelism available (≈ cores for CPU-bound). The counterintuitive senior move: sometimes you *remove* threads and get faster.

### Q6. How do per-core sharding and thread-local aggregation eliminate contention? Use a counter as the example.

The problem: one shared counter is one cache line that every thread must own to write. Under load it ping-pongs and serializes. The fix is to **spread the writes across many cells** so threads rarely collide, and reconcile only when someone reads the total.

```text
Naive:   all threads -> [ one atomic long ]      (1 hot line, serialized)

Sharded: T1 -> cell[hash(T1)]
         T2 -> cell[hash(T2)]   each cell on its own cache line
         T3 -> cell[hash(T3)]   writes almost never collide
         ...
 sum() = cell[0] + cell[1] + ... + cell[k-1]     (rare, read-time only)
```

This is exactly what Java's `LongAdder` does: a base value plus a padded `Cell[]` striped by a per-thread probe; contention dynamically grows the table. Writes scatter across cells (no ping-pong), and `sum()` walks the cells. You trade an *exact instantaneous read* (the sum is a snapshot that may miss in-flight updates) for near-linear write scaling.

```java
LongAdder hits = new LongAdder();
hits.increment();      // scatters to a per-thread cell, no global contention
long total = hits.sum(); // reconciles cells; approximate under concurrent writes
```

The general pattern — **thread-local accumulate, global combine** — is everywhere: per-thread partial sums in a parallel reduction, per-core allocator arenas, per-shard metrics, `ThreadLocal` scratch buffers. It works whenever the operation is associative and you can tolerate reading a slightly-stale aggregate. It's the single most effective contention cure after "don't share at all."

### Q7. Even lock-free code has scaling limits. What are they?

Lock-free (e.g. a CAS retry loop or a Treiber stack) removes *blocking* — no thread can be stalled by another holding a lock — but it does **not** remove **contention**. The limits:

- **The hot cache line still ping-pongs.** A CAS on a single shared location requires exclusive ownership of that line, exactly like a lock's word. Under N writers the line bounces N-ways and the atomic serializes at the coherence layer. Lock-free ≠ contention-free.
- **CAS retry storms.** Under high contention, many threads read the same value, all attempt CAS, one wins, the rest *fail and retry*. Wasted work grows with thread count; throughput can collapse similarly to lock contention. This is why `LongAdder` (sharded) beats a single `AtomicLong` under contention despite both being lock-free.
- **No wait-freedom.** Lock-free only guarantees *some* thread progresses; an individual thread can be starved by continual retries. Wait-free algorithms bound per-thread steps but are much more complex and often slower in the common case.
- **Memory reclamation is hard.** Lock-free structures with removal need hazard pointers / epoch-based / RCU reclamation to avoid ABA and use-after-free, which adds overhead and complexity.

So the win from lock-free is **latency predictability and no convoying**, not automatic scaling. To actually scale writes you still need to *reduce sharing* — shard the atomic, batch updates, or go read-mostly. Lock-free shines for low-to-moderate contention and for avoiding priority inversion; it is not a substitute for a contention-free data layout.

### Q8. How do you use Little's law to size a thread pool or connection pool?

**Little's law**: for any stable system, `L = λ × W`, where `L` = average number of requests in the system concurrently, `λ` = arrival/throughput rate, `W` = average time each request spends in the system. It's distribution-free — holds for any stable queue.

For pool sizing, rearrange: the number of concurrent workers you need to sustain throughput `λ` at latency `W` is `L = λ × W`.

Example — an I/O-bound service:

```text
Target throughput  λ = 2000 requests/sec
Avg request time   W = 50 ms = 0.05 s   (mostly waiting on a downstream DB)
Required concurrency L = 2000 * 0.05 = 100 in-flight

=> you need ~100 worker threads / DB connections to sustain 2000 rps.
   Fewer -> requests queue and W balloons; the pool is the bottleneck.
```

Two refinements:

- **CPU-bound work**: `W` is nearly all CPU, so useful concurrency ≈ number of cores; a threads-per-core ≈ 1 pool is right and Little's law just confirms you can't beat `cores/W_cpu`.
- **I/O-bound work**: `W` is dominated by *waiting*, so `L` can be far larger than core count — the classic Brian Goetz formula `threads = cores × (1 + wait/compute)` is Little's law in disguise.

The senior point: you don't guess pool size, you *derive* it from measured latency and target throughput — and if raising the pool doesn't raise throughput, the bottleneck is downstream, not the pool.

### Q9. How do you actually measure lock contention in production? What do you look at?

You can't fix contention you can't see, and it's invisible in a single-threaded profile. The toolkit:

- **Lock/monitor profilers.** JVM: `-XX:+PrintConcurrentLocks`, JFR (Java Flight Recorder) records *monitor blocked* events with the contended monitor and stacks; async-profiler has a `lock` mode. These tell you *which lock* and *how long threads waited on it*. That's the number that matters — total blocked time, not lock count.
- **Flame graphs.** An **on-CPU** flame graph shows where cycles go; an **off-CPU** (wall-clock) flame graph shows where threads are *blocked/waiting* — contention shows up as wide plateaus in `park`/`lock`/`futex` frames. Off-CPU profiling is the key trick: on-CPU hides the problem because a blocked thread burns no CPU.
- **Thread dumps.** Repeated `jstack` (or `kill -3`) samples; if many threads are `BLOCKED` on the same monitor, that's your hot lock. Also finds deadlocks (JVM detects and prints them).
- **OS/hardware counters.** `perf stat` for context-switch rate and cache-miss rate; high involuntary context switches or a rising `cache-misses` under load hint at contention/false sharing. `perf c2c` on Linux specifically detects **false sharing** (cache-line contention with the offending addresses).
- **Metrics.** Latency percentiles that balloon under load while CPU is *not* saturated is the signature of contention/queueing (Little's law: `W` rising means `L` is capped by the bottleneck).

The method: reproduce under representative concurrent load, capture an off-CPU flame graph or lock profile, find the widest wait, and confirm with a thread dump. Then attack that one lock — shard it, shrink the critical section, or go lock-free.

### Q10. What are read-mostly optimizations like RCU and seqlocks, and when do they beat a reader-writer lock?

A `ReadWriteLock` lets many readers share or one writer exclude — but the shared-lock bookkeeping (a counter/flag every reader must CAS or update) is *itself* a write-shared cache line, so under heavy read traffic the lock's own state ping-pongs and readers contend on it. For truly read-mostly data, you want readers that touch **no shared writable state at all**.

**RCU (Read-Copy-Update)** — used heavily in the Linux kernel:

```text
Readers:  lock-free. Just dereference the current pointer. No writes, no waiting.
Writers:  copy the structure, modify the copy, atomically swap the pointer,
          then wait for a "grace period" (until all pre-existing readers finish)
          before freeing the old version.
```

Readers pay essentially nothing; the cost moves entirely to writers (and to deferred reclamation). Perfect when reads vastly outnumber writes (routing tables, config, caches).

**Seqlock (sequence lock)** — reader-side optimistic:

```text
Writer:  seq++ (now odd) ... write fields ... seq++ (now even)
Reader:  s1 = seq (retry if odd); read fields; s2 = seq;
         if s1 != s2  -> a write happened mid-read, retry.
```

Readers take no lock and only *retry* if a writer intervened — great for small, frequently-read, rarely-written data (timestamps, kernel `gettimeofday`). Downside: readers can't tolerate a torn read of pointers they dereference, so it's for value-like data.

When they beat RW locks: **read-dominated** workloads where the RW lock's shared counter becomes the bottleneck. In the JVM world the idiomatic equivalent is a `volatile` reference to an **immutable snapshot** (copy-on-write): readers just read the reference (lock-free, cache-friendly), writers build a new immutable version and swap the pointer — RCU without the reclamation machinery, since GC handles the old version.

### Q11. Why does a single `AtomicLong` counter become a bottleneck under many threads, and what do you replace it with?

An `AtomicLong.incrementAndGet()` is a CAS (or LOCK XADD) on **one memory word**, which lives on **one cache line**. To perform the atomic RMW, a core must acquire exclusive (Modified) ownership of that line. With N threads incrementing, the line bounces between all N cores — each increment costs a coherence miss, and on pure-CAS implementations threads also *retry* when they lose the race. The result: per-increment cost rises with thread count, and total throughput plateaus or collapses. It's lock-free but not contention-free (see the lock-free limits question).

Replacement: **`LongAdder`** (or `LongAccumulator` for non-sum reductions). It shards the count across a padded `Cell[]` keyed by a per-thread probe, so different threads hit different cache lines and almost never collide; `sum()` walks the cells at read time.

```text
AtomicLong :  T1 T2 T3 T4  -> [ one word ]        writes serialize, line ping-pongs
LongAdder  :  T1->cell0  T2->cell1  T3->cell2 ... writes scatter, near-linear scaling
              sum() = cell0 + cell1 + ...          approximate under concurrent writes
```

Trade-off: `LongAdder` gives up an exact atomic *read* — `sum()` is a snapshot that may not reflect concurrent in-flight increments, and it uses more memory. Rule of thumb: **`AtomicLong` for low contention or when you need exact `get`/CAS semantics; `LongAdder` for hot metrics/counters** where you write far more than you read the total. This is the sharding principle applied to the smallest possible structure.

### Q12. Compare data parallelism and task parallelism from a scaling standpoint.

Both split work across cores, but they scale differently and hit different bottlenecks.

| | **Data parallelism** | **Task parallelism** |
|---|---|---|
| Split by | Same operation over many data elements | Different operations / independent tasks |
| Example | Sum an array in parallel; SIMD; `parallelStream`; GPU | Pipeline stages; fork-join of heterogeneous subtasks |
| Load balance | Easy if elements are uniform; skew hurts | Harder; tasks have different durations |
| Scaling limit | Memory bandwidth, false sharing on the reduce step | Critical-path length (longest dependency chain), sync points |
| Ideal shape | Embarrassingly parallel, minimal shared state | DAG of dependent tasks; work-stealing helps |

Scaling insight for **data parallelism**: the map phase scales beautifully (independent, cache-friendly if partitioned by contiguous ranges), but the **reduce** phase is a serial-ish merge — do it as a *tree* reduction (log-depth) and use thread-local partials to avoid a shared accumulator, or Amdahl's serial fraction (the final combine) caps you. Watch for false sharing when threads write adjacent output slots.

Scaling insight for **task parallelism**: your ceiling is the **critical path** — the longest chain of dependent tasks — no matter how many cores (a form of Amdahl). Work-stealing schedulers (fork-join) keep cores busy by stealing from the tail of others' deques, which is why they excel at irregular task graphs. Over-decomposition (more, smaller tasks than cores) improves load balance up to the point where per-task overhead dominates.

Practically: reach for data parallelism when you have a big uniform dataset and one operation; reach for task parallelism when you have a heterogeneous DAG. Many real systems combine both (parallel pipeline stages, each internally data-parallel).

### Q13. What is memory bandwidth saturation and how does it cap parallel speedup independently of Amdahl?

Amdahl blames the *serial fraction* of your code; **bandwidth saturation** is a separate ceiling from the *hardware*. All cores share a finite path to main memory (memory controllers + interconnect). A **memory-bound** kernel — one that streams large arrays and does little arithmetic per byte (low *arithmetic intensity*) — can saturate total memory bandwidth with just a few cores. Past that point, adding cores gives *zero* speedup because they're all waiting on the same saturated memory bus, even though the code is embarrassingly parallel and has near-zero serial fraction.

```text
speedup
   |      compute-bound: keeps scaling
   |     /
   |    /____ memory-bound: flatlines at BW ceiling
   |   /
   +----------------------- cores
      few cores saturate the bus
```

The diagnostic frame is the **roofline model**: performance is bounded by `min(peak_compute, arithmetic_intensity × peak_bandwidth)`. Low-intensity kernels (vector add, memcpy, sparse traversal) sit under the bandwidth roof; more cores don't move them.

Cures are about **moving less data**, not adding threads: improve cache locality (blocking/tiling so data is reused while hot in cache), increase arithmetic intensity (fuse passes so you touch each byte once and do more with it), compress or use smaller types, and be NUMA-aware so each core uses local bandwidth. This is why "my parallel loop doesn't scale past 4 cores" is often a bandwidth story, not a locking story — and why you check `perf` memory-bandwidth counters, not just lock profiles.

### Q14. Why is contention often worse than Amdahl predicts, and what is a lock convoy?

Amdahl models the serial fraction as *fixed work done one-at-a-time*. Real lock contention is worse because the coordination cost **grows with the number of waiters** and can induce pathological dynamics Amdahl doesn't capture.

A **lock convoy** is the classic pathology:

```text
1. Many threads need a hot lock held for a short time.
2. Thread A holds it; B, C, D... arrive and *block* (park -> OS sleep).
3. A releases -> wakes one waiter, but that wake + context switch costs
   far more than the critical section itself.
4. Threads proceed in lock-step single file, each paying a full
   sleep/wake/context-switch per acquisition. The queue never drains;
   the system oscillates and throughput craters.
```

The convoy makes the *effective* serial fraction balloon: not just the critical section, but the scheduling overhead per handoff, multiplied by the waiter count. You also get:

- **Cache effects**: each new lock holder takes coherence misses on the data the previous holder left in *its* cache.
- **Fairness vs throughput tension**: strict-FIFO (fair) locks avoid starvation but force handoffs and worsen convoys; unfair locks let a thread re-acquire and stay cache-hot (barging), improving throughput at the cost of fairness.

Cures: **shrink the critical section** (do work outside the lock), **shard the lock**, use a **try-lock + backoff** or lock-free path to avoid parking, or eliminate the shared state (thread-local aggregation). The meta-lesson: contention has *super-linear* cost, so the payoff from removing a hot lock is often bigger than Amdahl's linear model suggests.

### Q15. You profiled and found one method eating 90% of wall-clock but low CPU. What's happening and how do you confirm?

Low CPU with high **wall-clock** time means the threads are **not computing — they're waiting**: blocked on a lock, parked on a condition, or stalled on I/O. An on-CPU profiler under-reports this exactly because a waiting thread burns no cycles, so it's a signature of contention or blocking, not a hot loop.

How to confirm and localize:

1. **Off-CPU / wall-clock profile.** Switch from on-CPU sampling to off-CPU (async-profiler `wall` or `lock` mode, JFR monitor-blocked events, or `perf` off-CPU). The wide frame will now be visible — look for `park`, `futex`, `lock`, `Object.wait`, or a socket read.
2. **Thread dumps.** Take several `jstack` snapshots a second apart. If many threads sit `BLOCKED` on the same monitor → hot lock. If they're `WAITING` on a condition → producer/consumer imbalance or a downstream stall. If `RUNNABLE` inside a socket read → downstream latency (Little's law: `W` dominated by remote wait).
3. **Distinguish the three causes**:
   - **Lock contention** → BLOCKED on a monitor; fix by sharding/shrinking the critical section.
   - **I/O / downstream** → RUNNABLE in read or WAITING on a future; the fix is upstream capacity or async, not local threads.
   - **Coordination/condition wait** → WAITING; a queue or pool is starved/imbalanced.

The trap to avoid: throwing more threads at it. If the bottleneck is a downstream service or a single hot lock, more threads just deepen the queue and raise latency (contention collapse). Fix the *wait*, not the *worker count*.

### Q16. Give a checklist for diagnosing and fixing a concurrent program that doesn't scale.

A repeatable senior playbook, in order — measure first, tune last:

1. **Establish the baseline curve.** Plot throughput vs thread count (1, 2, 4, 8, 16...). Does it plateau, or *collapse*? A plateau suggests a fixed serial fraction (Amdahl) or bandwidth ceiling; a collapse suggests contention/convoy.
2. **Compute the serial fraction.** From the curve, back out `s` via Amdahl. If `s` is large, no number of cores helps — find and shrink the serial region (a global lock, a single counter, an ordered output step).
3. **Is it CPU-bound or wait-bound?** Compare CPU utilization to throughput. High wall-clock + low CPU = waiting → take an **off-CPU flame graph** and thread dumps to find the wait.
4. **Find the hot lock.** Lock profiler / JFR monitor-blocked / repeated `jstack`. The metric is *total blocked time on a monitor*, not lock count.
5. **Check for false sharing / bandwidth.** `perf c2c` for cache-line contention; `perf stat` for cache-miss and memory-bandwidth counters. Padding or a memory-bound kernel shows here.
6. **Apply the right fix**:
   - Hot lock → shrink critical section, shard the lock, or go lock-free.
   - Hot atomic/counter → `LongAdder` / per-thread aggregation.
   - False sharing → pad / `@Contended` / align.
   - Read-mostly → immutable snapshot / RCU / seqlock.
   - Bandwidth-bound → improve locality (tiling), raise arithmetic intensity, NUMA-local allocation.
   - Wrong pool size → derive from Little's law (`L = λ × W`).
7. **Re-measure the curve.** Confirm the fix moved the ceiling; don't trust reasoning without the new numbers. Iterate on the *next* bottleneck.

The through-line: contention is invisible without concurrent-load measurement, hardware isn't free, and the biggest wins come from *removing sharing*, not adding threads.

## Distributed & Async Concurrency at Scale

### Summary

**What this topic covers**

This is the bridge from in-process concurrency to **system design**: the same problems — shared mutable state, races, coordination, ordering — reappear when the "threads" are separate processes or machines, but now with the extra cruelty that the network can drop, delay, duplicate, and reorder messages, and any node can crash mid-operation. It covers **optimistic vs pessimistic concurrency control** (version/CAS vs locks, at data-store scale), **idempotency** and the **at-least-once + dedup** pattern that makes unreliable messaging safe, **backpressure** and **load shedding** so a fast producer can't drown a slow consumer, **rate limiting** (token bucket), **distributed locks** and why they're dangerous without **fencing tokens**, **sagas** and compensation as the alternative to distributed transactions, **event-driven concurrency** with queues, and the **eventual consistency** you inherit when you give up global locking. The 16 questions run from "optimistic vs pessimistic locking" to "why is a Redis lock unsafe and what's a fencing token."

**Mental model**

Take every hard-won lesson from single-machine concurrency and re-derive it under three new axioms: (1) **there is no shared memory** — coordination happens by passing messages that can be lost, delayed, duplicated, or reordered; (2) **any participant can fail independently** at any instant, including *after* doing the work but *before* acknowledging it; and (3) **there is no global clock** — you cannot reason with wall-clock timestamps to order events. Under these axioms, a "lock" is no longer a memory word but a lease that can silently expire while you still think you hold it; "exactly-once" is a fiction you *approximate* with at-least-once delivery plus idempotent, deduplicated handlers; and a "transaction across services" becomes a saga of local commits stitched with compensating undo actions. The senior instinct is to assume every message will be *retried* and every operation *duplicated*, and to design handlers that are safe to run twice — because at scale they will be.

**Key terms**

- **Optimistic concurrency control (OCC)** — assume no conflict; read a version, write only if it's unchanged (compare-and-set); retry on conflict.
- **Pessimistic concurrency control** — lock the row/resource up front so no one else can touch it; blocks, risks deadlock.
- **Idempotency** — applying an operation once and applying it N times produce the same result; the enabler of safe retries.
- **At-least-once + dedup** — accept that delivery may duplicate, then make the effect exactly-once via idempotency/dedup keys.
- **Backpressure** — a slow consumer signals upstream to slow down instead of silently buffering to death.
- **Load shedding** — deliberately dropping/rejecting excess work to protect the system when overloaded.
- **Token bucket** — rate limiter: tokens refill at rate R, each request spends one, burst up to bucket size B.
- **Distributed lock** — a lease held in an external store (Redis/ZK/etcd); unsafe without a **fencing token**.
- **Fencing token** — a monotonically increasing number handed out with a lock so a stale holder's writes are rejected.
- **Saga** — a long-lived transaction as a sequence of local transactions, each with a compensating action to undo it.
- **Eventual consistency** — replicas may diverge briefly but converge if writes stop; the cost of avoiding global coordination.
- **CAS (compare-and-swap)** — the atomic primitive underneath OCC, from CPU words up to conditional writes in databases.

**Why interviewers ask this**

Because at scale, *every* CRUD endpoint is a concurrency problem. Two users editing the same record, a retry that double-charges a card, a queue that melts under a traffic spike, a "distributed lock" that lets two workers run the same job — these are the daily failures of real systems, and they're all this topic. Interviewers use it to test whether you can carry concurrency reasoning across the network boundary: do you know that a network timeout means "unknown," not "failed"? That a lock lease can expire mid-critical-section? That "exactly-once delivery" is impossible but exactly-once *processing* is achievable with idempotency? The junior answer reaches for a distributed lock and calls it done; the senior answer reaches for idempotency and fencing tokens *first*, treats locks as a last resort, and knows the CAP-flavored trade-offs they're accepting.

**Common confusions**

- "Exactly-once delivery is achievable" — it isn't over an unreliable network; you get at-least-once (or at-most-once) delivery and engineer exactly-once *effects* with idempotency.
- "A distributed lock is just a mutex on the network" — a mutex can't silently expire while you hold it; a lease can. Without fencing, a paused lock holder corrupts data.
- "Retries are safe" — only if the operation is idempotent. Blind retries on non-idempotent operations double-charge, double-ship, double-send.
- "Optimistic locking is always better" — only under low contention; under high conflict it degenerates into a retry storm and pessimistic locking wins.
- "Backpressure = a bigger buffer" — an unbounded buffer just delays and worsens the collapse (and can OOM); backpressure *slows the producer* or sheds load.
- "A timeout means the operation failed" — it means *unknown*; the work may have completed after you gave up. This is why idempotency matters.

**What follows from this topic**

This topic is where the primer's shared-memory foundations pay off at system scale — CAS becomes OCC, memory-model publication becomes replication and eventual consistency, and lock ordering becomes saga orchestration. It leans on the previous topic's scaling laws (you distribute precisely because one machine's contention ceiling is real) and it sets up the final **Scenario & Interview Playbooks** topic, where "design a rate limiter" and "make this retry safe" become concrete whiteboard problems. It is also the natural handoff to a dedicated system-design study track: distributed transactions, consensus, and CAP live one layer beyond here.

### Q1. Compare optimistic and pessimistic concurrency control. When do you pick each?

Both prevent two writers from clobbering each other; they differ on *when* they check for conflict.

**Pessimistic** — lock first, then work. Acquire an exclusive lock on the row/resource (`SELECT ... FOR UPDATE`, a distributed lock), do your read-modify-write, release. No one else can touch it meanwhile.

**Optimistic (OCC)** — work first, check at commit. Read the data plus a **version** (or timestamp). Do your computation. On write, atomically assert *the version is still what you read* (compare-and-set); if it changed, someone else won — you get a conflict and **retry**.

```sql
-- Optimistic: version-checked update, no locks held across think-time
UPDATE account SET balance = :new, version = version + 1
WHERE id = :id AND version = :expected_version;
-- rows_affected = 0  => conflict, reread and retry
```

| | Pessimistic | Optimistic |
|---|---|---|
| Conflict cost | Low (serialized) | High (retry work) |
| No-conflict cost | High (lock overhead, blocking) | Low (just a version check) |
| Contention fit | High contention | Low contention |
| Failure risk | Deadlock, lock convoy, holding across think-time | Retry storm, starvation of unlucky writer |
| Holds resources | While thinking/over network | No |

Rule of thumb: **OCC when conflicts are rare** (most web CRUD — two people rarely edit the same record simultaneously) because it avoids all lock overhead on the happy path and never holds a lock across user think-time. **Pessimistic when conflicts are frequent or the work is expensive to redo** (hot inventory row, financial ledger under contention) because retrying wastes more than locking. OCC is just CAS lifted to database scale.

### Q2. What is idempotency and why is it the foundation of reliable distributed systems?

An operation is **idempotent** if performing it once and performing it many times yield the same end state. `SET balance = 100` is idempotent; `balance = balance + 100` is not. `DELETE user 5` is idempotent (deleting twice leaves it deleted); "send email" is not (two emails).

It's foundational because **the network forces retries**. When a client sends a request and the response times out, the client cannot tell whether the server (a) never got it, (b) did the work but the ack was lost, or (c) is just slow. Its only safe options are retry (risk duplication) or give up (risk lost work). If the operation is idempotent, **retry is always safe** — duplicates are harmless — so the whole failure model collapses to "just retry until you get an ack."

You make non-idempotent operations idempotent with an **idempotency key**: the client generates a unique key per logical operation and sends it with every retry; the server records processed keys and returns the *original* result on duplicates instead of redoing the work.

```text
Client -> POST /charge  {amount:50, Idempotency-Key: "abc-123"}   (times out)
Client -> POST /charge  {amount:50, Idempotency-Key: "abc-123"}   (retry)
Server: key "abc-123" already processed -> return the stored charge, do NOT charge again
```

Stripe, payment APIs, and message consumers all rely on this. The senior framing: design every mutating handler to be safe to run twice, because at scale it *will* run twice.

### Q3. Explain "at-least-once delivery + dedup" and why it beats chasing exactly-once.

Message systems offer three delivery semantics:

- **At-most-once** — send and forget; may lose messages, never duplicates. Fine for lossy telemetry.
- **At-least-once** — retry until acked; never loses, but **may duplicate** (the ack got lost, so you resend). The practical default.
- **Exactly-once *delivery*** — impossible over an unreliable network in general (it's equivalent to consensus on delivery under failures).

Since you can't get exactly-once *delivery*, you engineer exactly-once *processing* = **at-least-once delivery + idempotent, deduplicated consumers**:

```text
Producer: publish msg with a stable message-id; retry on no-ack (=> possible duplicate)
Broker:   at-least-once delivery, may redeliver on consumer crash before ack
Consumer: seen(msg.id)? -> skip (already applied)
          else -> apply effect AND record msg.id  (ideally in one atomic transaction)
```

The key detail is **atomicity of "apply + mark seen"**: if you process then crash before recording the id, you'll reprocess on redelivery. Solutions: dedup table updated in the same DB transaction as the effect (transactional outbox/inbox pattern), or an idempotent effect where reapplying is a no-op.

Why this beats chasing true exactly-once: at-least-once is *simple and robust* (just retry), and pushing the dedup responsibility to the consumer localizes the hard part to one place you control. Kafka's "exactly-once semantics" is really this pattern implemented for you (idempotent producer + transactional consume-process-produce), not magic that defeats the network.

### Q4. What is backpressure? What happens without it, and how is it implemented?

**Backpressure** is a feedback signal from a slow consumer back to a fast producer that says "slow down — I can't keep up." Without it, the mismatch has to go *somewhere*, and every option is bad:

```text
No backpressure, producer faster than consumer:
  unbounded queue -> memory grows without limit -> OOM / GC death
  fixed buffer, drop -> silent data loss
  fixed buffer, block-forever -> the producer's thread hangs
Result: latency climbs, then the system falls over. (Contention collapse's cousin.)
```

Implementations, roughly in order of sophistication:

- **Bounded blocking queue** — the simplest: a `put` on a full queue *blocks* the producer until space frees. The blocking *is* the backpressure — the producer naturally paces to the consumer's rate. (This is the in-process bounded producer-consumer.)
- **Pull-based / demand signaling** — the consumer *requests* N items and the producer only sends that many (Reactive Streams `request(n)`, gRPC flow control, TCP's receive window). The consumer controls the rate explicitly.
- **Credit/token schemes** — the consumer grants credits; the producer spends them and stalls at zero.
- **Bounded queue + load shedding** — when the buffer is full, *reject* new work (return 429/503, drop low-priority) rather than block, to keep latency bounded (see next question).

Across the network you can't block the remote producer directly, so backpressure becomes: stop reading the socket (TCP backpressure propagates), reject with a retry-after, or lower the consumer's advertised demand. The principle is universal — **make the slow stage's limit visible upstream** instead of hiding it in an ever-growing buffer.

### Q5. What is load shedding and how does it relate to backpressure?

**Load shedding** is deliberately **dropping or rejecting** work when the system is overloaded, to protect the health of the requests you *do* serve. Backpressure says "slow down"; load shedding says "I'm not even going to try this one." They're complementary: backpressure paces cooperative producers, load shedding defends against load you can't slow (a traffic spike, a retry storm, an uncooperative client).

Why shed instead of queue everything? Because an overloaded system that accepts all work degrades for *everyone* — latency climbs past timeouts, so clients retry, adding *more* load (a **retry storm** / metastable failure). Shedding keeps the accepted subset fast:

```text
Overloaded:
  accept-all  -> everyone gets 30s latency -> everyone times out & retries -> collapse
  shed excess -> reject 20% fast with 503  -> the other 80% stay at 50ms -> system survives
```

Techniques:

- **Admission control**: reject when a concurrency limit or queue depth is exceeded (return 429/503 with `Retry-After`).
- **Priority shedding**: drop low-value traffic first (background jobs, non-paying tier) to preserve critical paths.
- **Timeout-based**: if a request has already waited longer than its deadline in queue, drop it — serving a response nobody's waiting for is wasted work.
- **Adaptive (LIFO under stress)**: serve newest requests first when overloaded so at least some meet their deadline instead of everything missing.

The senior point: an overload strategy is *mandatory* — you either choose how to shed, or the system chooses for you (by falling over). Pair it with client-side **exponential backoff + jitter** so rejected clients don't synchronize into another spike.

### Q6. Explain the token bucket rate-limiting algorithm and contrast it with leaky bucket.

**Token bucket** meters a rate while allowing controlled bursts. A bucket holds up to `B` tokens; tokens are added at a steady rate `R` per second (capped at `B`). Each request must remove one token; if the bucket is empty, the request is rejected (or delayed).

```text
capacity B = 10 tokens, refill R = 5 tokens/sec
tokens refill: min(B, tokens + R * elapsed)
request: if tokens >= 1 { tokens -= 1; allow } else { reject }

=> steady state: 5 req/s sustained
=> burst: a full bucket lets 10 requests through instantly, then throttles to 5/s
```

It's cheap (two numbers: `tokens`, `last_refill`), lazily computed (no background timer — recompute tokens on each request from elapsed time), and burst-friendly, which matches real traffic. In a distributed setting you keep the counter in Redis (often via a Lua script for atomicity) keyed per client/API key.

**Leaky bucket** instead models a fixed-rate *output*: requests enter a queue and drain at a constant `R`; the queue smooths bursts into a steady stream (overflow is dropped).

| | Token bucket | Leaky bucket |
|---|---|---|
| Bursts | Allowed (up to B) | Smoothed away |
| Output rate | Bursty then capped | Constant |
| Models | Allowance you accrue | A queue draining steadily |
| Use when | APIs that tolerate bursts | Traffic shaping to a strict constant rate |

Two lighter cousins: **fixed-window** counters (simple but allow 2× bursts at window edges) and **sliding-window log/counter** (smoother, more memory). Token bucket is the default for API rate limiting because it's simple *and* burst-tolerant.

### Q7. Why are distributed locks dangerous, and what is a fencing token?

An in-process mutex has a guarantee a distributed lock **cannot**: while you hold it, you *definitely* hold it. A distributed lock is really a **lease** in an external store (Redis/ZK/etcd) with a TTL, and the danger is that the lease can **expire while you still believe you hold it** — a GC pause, a long syscall, network delay, or VM freeze can stall your process past the TTL. The store then hands the lock to another worker, and now **two workers act as the exclusive holder simultaneously**, corrupting whatever the lock was protecting.

```text
T1 acquires lock (TTL 10s) ---- [ 15s GC pause ] ----> T1 wakes, thinks it holds the lock, writes
                          lease expires at 10s
                                 T2 acquires lock at 10s, writes
=> both T1 and T2 write. Mutual exclusion violated.
```

A **fencing token** fixes the *effect*. The lock service hands out a **monotonically increasing number** with each grant. The protected resource (DB, storage) remembers the highest token it has seen and **rejects any write carrying a lower token**:

```text
T1 gets token 33, pauses.
T2 gets token 34, writes with 34 -> resource records "last=34"
T1 wakes, writes with 33 -> resource sees 33 < 34 -> REJECTED
```

Even though both briefly "held" the lock, the stale holder's writes are fenced out. The deeper lessons: (1) a distributed lock is a *performance* optimization (avoid duplicate work), not a *correctness* guarantee, unless the resource itself enforces fencing; (2) prefer designs that don't need the lock at all — idempotency + a conditional/CAS write on the resource gives you correctness without the lease's sharp edge. This is Martin Kleppmann's well-known critique of naive Redlock.

### Q8. What is a saga and when do you use it instead of a distributed transaction?

A **distributed transaction** (2-phase commit across services/databases) gives ACID atomicity across nodes but is usually avoided at scale: it holds locks across the network for the whole protocol (blocking, low throughput), and the classic 2PC is a **blocking protocol** — if the coordinator dies after "prepare," participants are stuck holding locks indefinitely. Most microservice architectures reject it.

A **saga** replaces one big distributed transaction with a **sequence of local transactions**, one per service, each with a **compensating action** that semantically undoes it. If any step fails, you run the compensations for the completed steps in reverse:

```text
Order saga (happy path):  reserve-inventory -> charge-card -> ship
If charge-card FAILS:
   run compensations backward: release-inventory   (undo the reserve)
=> no global lock, no 2PC; each service commits locally and independently.
```

Two orchestration styles:

- **Orchestration** — a central saga coordinator tells each service what to do and issues compensations. Easier to reason about and monitor; the coordinator is a focal point.
- **Choreography** — services react to each other's events with no central brain. More decoupled, but the overall flow is emergent and harder to trace.

Trade-offs you accept: sagas give **atomicity** (all-or-nothing via compensation) but **not isolation** — intermediate states are *visible* to others (someone can see the inventory reserved before the order fully completes), so you need countermeasures (semantic locks, commutative updates, re-reads). Compensations must be idempotent and, ideally, always-succeeding (you can't "un-send" an email — you send an apology). Use a saga whenever a business process spans multiple services/databases and you need eventual atomicity without global locking — which at microservice scale is nearly always.

### Q9. How does event-driven concurrency with queues change the concurrency model?

Putting a **queue** (Kafka, SQS, RabbitMQ) between producers and consumers converts *synchronous, tightly-coupled* concurrency into *asynchronous, decoupled* concurrency, and that changes what you worry about:

```text
Sync:   Service A --calls--> Service B   (A blocks; A's latency = A + B; A fails if B down)
Async:  Service A --enqueue--> [ queue ] --deque--> Service B
        A returns immediately; B processes when able; queue absorbs bursts
```

What you gain:

- **Temporal decoupling** — the producer doesn't wait for the consumer; the queue is a buffer (built-in backpressure if bounded, elastic if not).
- **Load leveling** — spikes fill the queue; consumers drain at their own rate instead of being overwhelmed (the distributed cousin of a bounded producer-consumer).
- **Independent scaling** — add consumers to raise throughput; the queue is the work-distribution mechanism (competing consumers pattern).
- **Fault isolation** — a consumer crash doesn't fail the producer; messages wait and get redelivered.

What you now have to handle (the costs):

- **At-least-once + duplicates** — redelivery means consumers must be idempotent/dedup (see earlier questions).
- **Ordering** — most queues only guarantee order *within a partition/key*; parallel consumers reorder globally. If you need per-entity order, partition by entity key.
- **Eventual consistency** — the producer's world and consumer's world are momentarily out of sync; downstream reads may not reflect the just-enqueued event yet.
- **Poison messages / DLQs** — a message that always fails must be shunted to a dead-letter queue, or it blocks/retries forever.

The mental shift: you stop thinking in *call-and-return* and start thinking in *events and eventual reactions* — the same shift as going from synchronous method calls to message-passing actors, now across machines.

### Q10. What is eventual consistency and what does it force you to handle in application code?

**Eventual consistency** is the guarantee that if writes stop, all replicas will *eventually* converge to the same value — but at any given moment, different replicas (or a replica vs the primary) may return *different, stale* values. It's the price of avoiding global coordination: to stay available and fast under partitions (the AP side of CAP), you let replicas diverge briefly instead of blocking every read/write on a global agreement.

Where it shows up: read replicas lagging the primary, multi-region databases, caches, CDNs, and any async/event-driven pipeline (the consumer's view trails the producer's).

What it forces you to handle in application code:

- **Read-your-own-writes**: a user updates their profile, then re-reads from a lagging replica and sees the *old* value. Fix: route reads to the primary for that user briefly (sticky/"read from leader after write"), or read from a cache you updated synchronously.
- **Stale reads in decisions**: never make an irreversible decision (charge, ship, allocate) on possibly-stale data without a conditional/version check at the authoritative store (OCC). Verify at the point of commit.
- **Conflict resolution**: concurrent writes to different replicas can conflict; you need a merge strategy — last-write-wins (lossy), version vectors, or CRDTs (conflict-free replicated data types that merge deterministically).
- **Idempotent, commutative operations**: design updates so order and duplication don't matter (increment/merge rather than absolute set), so convergence is automatic.
- **UI/UX**: show "pending" states; don't imply an async effect has fully propagated when it hasn't.

The senior framing: eventual consistency isn't a bug to paper over — it's a deliberate trade for availability and scale, and correct systems *design around* the staleness window (bounded staleness, monotonic reads, causal consistency) rather than pretending it's zero.

### Q11. A payment API endpoint might be called twice due to a client retry. How do you make it safe?

The scenario: client sends `POST /charge`, the response is lost to a timeout, the client retries — and you must not double-charge. This is the canonical **idempotency key** problem.

Design:

1. **Client generates a unique idempotency key per logical charge** (a UUID), and sends the *same* key on every retry of that charge (`Idempotency-Key: abc-123`).
2. **Server records keys and their results.** On receipt, look up the key:
   - Unseen → process the charge, store `(key -> result, status)` **atomically with the charge itself**, return the result.
   - Seen + completed → return the *stored* result, do **not** charge again.
   - Seen + in-progress → the first request is still running; return 409/retry-after (avoid concurrent double-execution).

```text
BEGIN TX
  INSERT INTO idempotency(key, status) VALUES ('abc-123','in_progress')
     ON CONFLICT (key) DO NOTHING;         -- returns 0 rows if duplicate
  if 0 rows: read existing row -> if completed return stored result; else 409
  else: perform charge; UPDATE idempotency SET status='completed', result=... WHERE key='abc-123'
COMMIT
```

Critical details: the **dedup record and the effect must commit atomically** (same transaction, or a transactional outbox) — otherwise you can charge then crash before recording the key, and the retry charges again. Give keys a TTL (e.g. 24h) to bound storage. Handle the concurrent-duplicate race (two retries arriving together) with a unique constraint on the key so exactly one wins the insert.

The general principle: **timeout ≠ failure**; the only safe way to retry a non-idempotent operation is to make it idempotent with a dedup key enforced atomically at the data store.

### Q12. Design a distributed rate limiter for an API across many servers.

The challenge: a single-server token bucket is easy, but with N app servers each limiting locally, the global limit becomes N × the intended rate. You need **shared state**.

**Approach — centralized counter in Redis (token bucket):**

Keep per-client bucket state (`tokens`, `last_refill_ts`) in Redis, keyed `ratelimit:{clientId}`. Every server runs the same atomic check-and-decrement against Redis:

```text
-- executed as one atomic Redis Lua script (no check-then-act race):
now = time()
tokens = min(B, stored_tokens + R * (now - last_refill))
if tokens >= 1 then
   tokens = tokens - 1;  save(tokens, now);  return ALLOW
else
   save(tokens, now);    return DENY
end
```

Atomicity (Lua script or `INCR`+`EXPIRE` for fixed-window) is essential — otherwise two servers read the same count and both allow. Redis is the single source of truth, so the global limit is enforced regardless of which server handles the request.

**Trade-offs and refinements:**

- **Latency/availability**: every request now hits Redis. Mitigate with a **local token cache**: each server checks out a *batch* of tokens from Redis and spends them locally, refilling when low — fewer round-trips, slightly looser global bound. This is the sharding/aggregation pattern again.
- **Fail-open vs fail-closed**: if Redis is down, do you allow (fail-open, prioritize availability) or reject (fail-closed, protect the backend)? Usually fail-open with a conservative local fallback limit.
- **Algorithm choice**: fixed-window is cheapest but allows edge bursts; sliding-window-counter is smoother; token bucket allows controlled bursts. Pick per SLA.
- **Hot keys**: a single very-hot client can make its Redis key a bottleneck — shard that key or accept approximate limiting.

The senior points: (1) the primitive is still a CAS/atomic against shared state, just now in Redis; (2) there's an inherent accuracy-vs-latency trade — perfectly precise global limiting requires a round-trip per request; local batching trades a little precision for a lot of throughput.

### Q13. Compare in-process concurrency primitives with their distributed equivalents.

The same problems reappear across the network, with weaker guarantees and new failure modes. The mapping is worth internalizing:

| In-process | Distributed equivalent | New failure mode across the network |
|---|---|---|
| Mutex / lock | Distributed lock / lease (Redis, ZooKeeper, etcd) | Lease expires while you think you hold it → need fencing tokens |
| CAS on a word | Conditional write / OCC version check (`WHERE version = ?`) | Same idea, survives; the clean one that ports well |
| `volatile` / publication | Replication + memory/consistency model | Replica lag → eventual consistency, stale reads |
| Bounded blocking queue | Message queue / broker (Kafka, SQS) | At-least-once → duplicates; ordering only per-partition |
| Condition variable / wait-notify | Pub/sub, event notification, long-poll | Lost notifications; need redelivery / at-least-once |
| Thread pool | Worker fleet / competing consumers | Workers crash mid-task → need idempotency + redelivery |
| Atomic counter | Distributed counter (Redis INCR, sharded) | Round-trip cost; hot-key contention; sharding needed |
| Transaction (ACID) | Distributed txn (2PC) or **saga** | 2PC blocks; sagas give atomicity but not isolation |
| Memory barrier / ordering | Causal/ordering guarantees, vector clocks | No global clock → can't order by wall time |

Two through-lines: (1) **CAS/OCC ports beautifully** — a conditional write on a versioned row is the distributed CAS and is the safest coordination primitive to reach for; (2) **locks port badly** — a lease isn't a mutex, so prefer idempotency + conditional writes over distributed locks whenever you can. And everywhere, the network adds *partial failure* and *no global clock*, which is why "just do what I did in-process" quietly breaks.

### Q14. What is the transactional outbox pattern and what problem does it solve?

The problem: a service needs to **atomically** (a) update its database AND (b) publish an event about that change. If you write the DB then publish, a crash in between loses the event (DB updated, no one notified); if you publish then write, a crash loses the DB change (event fired, no state). You can't wrap a DB commit and a message-broker publish in one transaction — they're different systems (**dual-write problem**).

The **transactional outbox** solves it by making the publish part of the *same* DB transaction:

```text
BEGIN TX
   UPDATE orders SET status='paid' WHERE id=42;
   INSERT INTO outbox(event) VALUES ('OrderPaid{id:42}');   -- same transaction!
COMMIT   -- either both happen or neither

Separately, a relay process:
   poll outbox for unsent rows -> publish to broker -> mark sent (or delete)
   (at-least-once: a crash after publish, before mark => republish => duplicates)
```

Because the business update and the outbox insert commit atomically, you never lose an event or fire a phantom one. A separate **message relay** (a poller, or **change-data-capture** tailing the DB log like Debezium) reads the outbox and publishes to the broker. Delivery is **at-least-once** (the relay may republish after a crash), so consumers still need to be idempotent — but the crucial atomicity between state and event is guaranteed.

The symmetric consumer-side pattern is the **inbox**: record processed message-ids in the same transaction as the effect, giving exactly-once *processing* on top of at-least-once delivery. Together, outbox + inbox are how event-driven systems stay consistent without distributed transactions.

### Q15. What is the thundering herd / cache stampede problem in a concurrent distributed system, and how do you prevent it?

**Thundering herd** (a.k.a. cache stampede) happens when a popular cache entry expires and, in the same instant, thousands of concurrent requests all miss the cache and **simultaneously hit the backing database to recompute the same value**. The database, sized for the cache-hit rate, gets hammered by N identical expensive queries at once and can collapse — potentially cascading into a wider outage.

```text
t0: hot key "top_products" in cache, serving 10k rps from cache
t1: key TTL expires
t1: all 10k concurrent requests miss -> all 10k query the DB for the same thing
    -> DB overload -> latency spike -> maybe more expiries -> metastable failure
```

Prevention techniques:

- **Request coalescing / single-flight**: only *one* request recomputes the value; the rest **wait** for that single computation and share its result (Go's `singleflight`, a per-key in-flight lock/promise). Turns N backend hits into 1.
- **Locked recompute with stale-while-revalidate**: the first miss takes a short lock and recomputes; concurrent requests are served the **stale** value until the new one lands, instead of piling onto the DB.
- **Early / probabilistic expiration**: recompute *before* the TTL with a small random probability that rises as expiry nears (XFetch), so refreshes spread out over time instead of synchronizing at the exact expiry instant.
- **Jittered TTLs**: never expire many keys at the same timestamp — add randomness to TTLs so expirations desynchronize.
- **Background refresh**: a scheduled job refreshes hot keys proactively so they never expire under live traffic.

The unifying idea is the same as in-process false-sharing/contention avoidance: **don't let many workers converge on the same hot resource at the same instant** — coalesce them, serve stale, or spread the work over time.

### Q16. Why does "just retry on failure" cause cascading failures, and how do you retry safely?

Naive retries turn a small hiccup into an outage through a **retry storm**. When a downstream service slows or errors, every caller retries; retries multiply the request rate (2–3× per client) exactly when the service is *least* able to handle it, deepening the overload — a self-reinforcing **metastable failure** that persists even after the original trigger is gone.

```text
DB blips -> requests fail -> every client retries 3x -> 3x load on the struggling DB
        -> more failures -> more retries -> DB stays down long after the blip
```

Safe retry design:

- **Only retry idempotent operations** (or ones guarded by an idempotency key) — otherwise retries double-apply effects.
- **Exponential backoff + jitter**: wait `base * 2^attempt`, plus randomness, so retries spread out instead of synchronizing into coordinated waves. Jitter is the part people forget and it's essential.
- **Cap retries and total time (deadline/budget)**: bounded attempts; don't retry past the caller's deadline (a response nobody's waiting for is wasted load).
- **Retry budgets / token bucket on retries**: allow retries only up to, say, 10% of the request rate — so a mass failure can't multiply load without bound.
- **Circuit breaker**: after a failure threshold, **stop calling** the failing dependency entirely for a cool-down (open state), fail fast, then probe with a few requests (half-open) before resuming. This gives the downstream room to recover instead of being retried to death.
- **Load shedding on the receiver** (from the earlier question) as the defensive complement.

The senior framing: retries are a **load amplifier**, so they must be *rate-limited, backed-off, jittered, deadline-bounded, and circuit-broken*. "Just retry" without these is how a 30-second downstream blip becomes a 30-minute outage.

## Scenario & Interview Playbooks

### Summary

**What this topic covers**

This is the applied, no-new-theory topic: given a broken snippet, **spot the data race and fix it**; given a requirement, **design a thread-safe X** (counter, cache, LRU, rate limiter, connection pool, bounded producer-consumer, work queue); given a hang, **fix the deadlock**; and given an interviewer, **reason out loud like a senior engineer**. It's where everything from the earlier topics — memory models, locks, atomics, condition variables, thread pools, contention — gets exercised on concrete problems. It also covers the *meta* skill that actually gets you the offer: a repeatable method for attacking any concurrency question (identify the shared mutable state, name the three concerns — atomicity, visibility, ordering — pick the cheapest primitive that covers them, then argue correctness by walking an adversarial interleaving). The 17 questions here are deliberately problem-shaped: spot-the-bug snippets, design katas, a deadlock fix, a "why is my code slower" diagnosis, a debugging walkthrough of an intermittent failure, and an explicit interview-strategy playbook.

**Mental model**

Every concurrency problem reduces to the same four-step reflex, and interviews reward *visibly running that reflex*. (1) **Find the shared mutable state** — the only thing that can race is memory that is both written and shared; circle it. (2) **Name what can break on it** — *atomicity* (a compound operation like `x++` or check-then-act interleaving), *visibility* (one thread's write not seen by another without a happens-before edge), and *ordering* (reordered reads/writes). (3) **Pick the cheapest primitive that covers exactly those concerns** — immutability or confinement if you can avoid sharing at all; an atomic/CAS for a single variable; a lock for a multi-variable invariant; a concurrent collection for a container; a condition variable for waiting. (4) **Prove it by adversarial interleaving** — draw a T1/T2 step table and try to break your own solution. Most "spot the bug" answers fall straight out of steps 1–2; most "design X" answers fall out of steps 3–4. Say all four steps aloud and you look senior even on a problem you haven't seen.

**Key terms**

- **Shared mutable state** — memory written by one thread and read/written by another; the root of all races. Remove it and the bug vanishes.
- **Check-then-act** — read a value, then act on it assuming it's unchanged (e.g. `if (!map.contains(k)) map.put(k)`); a compound-action race even over thread-safe pieces.
- **Read-modify-write (RMW)** — load/modify/store (`count++`); non-atomic unless done under a lock or with an atomic.
- **Confinement** — avoiding sharing by keeping state thread-local or stack-local; the cheapest "fix."
- **Guarded-by** — the discipline of documenting which lock protects which field; the backbone of correct locking.
- **Compound invariant** — a correctness rule spanning multiple fields (e.g. two balances summing to a constant) that must be updated atomically together, forcing a lock over per-field atomics.
- **Lock ordering** — acquiring multiple locks in a globally consistent order to prevent deadlock.
- **Double-checked locking** — the lazy-init pattern; only correct with `volatile` on the reference.
- **Heisenbug** — a bug that changes or vanishes under observation (logging/debugger) because it alters timing.
- **Stress/loop testing** — running an operation from many threads in a tight loop to surface rare interleavings.

**Why interviewers ask this**

Because this is the closest proxy to the actual job. Anyone can recite "a data race is two unsynchronized accesses"; the question is whether you can *look at real code and see the race*, *design a structure that survives concurrent abuse*, and *debug a hang under pressure*. These questions are pass/fail signal for on-call readiness. The strongest candidates don't just produce a correct answer — they externalize the method (state the shared state, the three concerns, the interleaving that breaks the naive version), consider the *contention* profile not just correctness (they'll mention `LongAdder` vs `synchronized`, a striped lock vs one big lock), and know the standard library primitive instead of hand-rolling a buggy lock. Fumbling a spot-the-race or hand-rolling double-checked locking without `volatile` is a strong negative signal precisely because this is bread-and-butter senior work.

**Common confusions**

- "Using a thread-safe collection makes my code thread-safe" — no; **compound actions** (check-then-act, iterate-then-modify) still race even over a `ConcurrentHashMap`. Use its atomic methods (`putIfAbsent`, `compute`) or a lock.
- "`volatile` makes `count++` safe" — no; `volatile` gives visibility/ordering, not atomicity of the read-modify-write. Use an atomic or a lock.
- "If it passes tests, it's correct" — concurrency bugs are probabilistic; passing once means nothing. Stress-test, and know that absence of a crash ≠ absence of a race.
- "Adding a lock is always the fix" — sometimes it's the *cause* of the next problem (deadlock, contention). Prefer removing sharing; if you lock, define the ordering.
- "More threads will make my slow code fast" — often the opposite (contention, GIL, bandwidth); measure before adding threads.
- "Double-checked locking is broken" — it *was* broken pre-Java-5 / without a fence; with a `volatile` reference (or a `std::atomic` with proper ordering) it's correct — and the holder/initialization-on-demand idiom sidesteps it entirely.

**What follows from this topic**

Nothing follows — this is the capstone. It cashes in the memory-model, atomics, locking, condition-variable, thread-pool, and contention material from every prior topic on concrete problems, and it hands you the *method* to walk into the interview and apply all of it under pressure. The one habit to carry out: **name the shared mutable state and the three concerns before you write a line of code** — it's the tell that separates candidates who *understand* concurrency from candidates who've merely memorized its vocabulary.

### Q1. Spot the data race and fix it: a counter incremented by many threads.

```java
class Counter {
    private int count = 0;
    void increment() { count++; }      // <-- the bug
    int get() { return count; }
}
```

Two bugs in one line. `count++` is a **read-modify-write**: load `count`, add 1, store. It is *not* atomic, so two threads interleave and **lose updates**:

```text
count = 5
T1: read 5              T2: read 5
T1: add -> 6            T2: add -> 6
T1: write 6             T2: write 6      <- two increments, count is 6 not 7
```

Second, `count` isn't `volatile`, so `get()` on another thread may never see updates (**visibility**) and can read a stale value indefinitely. So this fails on both *atomicity* and *visibility*.

Fixes, cheapest first:

```java
// 1. AtomicInteger — atomic RMW + visibility, lock-free. Best for a single counter.
private final AtomicInteger count = new AtomicInteger();
void increment() { count.incrementAndGet(); }
int get() { return count.get(); }

// 2. synchronized — also correct; heavier, but needed if you have a multi-field invariant.
synchronized void increment() { count++; }
synchronized int get() { return count; }

// 3. LongAdder — if this is a HOT counter under high contention, beats AtomicInteger
//    (sharded cells avoid cache-line ping-pong); get() via sum() is approximate.
```

The reasoning to say aloud: shared mutable state = `count`; concerns = atomicity (RMW) + visibility; a single variable → an atomic is the cheapest primitive that covers both. Reach for `synchronized` only if the counter is part of a larger invariant, and `LongAdder` if it's hot.

### Q2. Why is this check-then-act code not thread-safe even with a ConcurrentHashMap?

```java
ConcurrentHashMap<String, User> cache = new ConcurrentHashMap<>();

User getOrCreate(String id) {
    if (!cache.containsKey(id)) {      // check
        cache.put(id, loadUser(id));   // act   <-- race window between the two
    }
    return cache.get(id);
}
```

The map is thread-safe, but the **sequence of two operations is not atomic**. The classic mistake: assuming thread-safe *pieces* compose into a thread-safe *compound action*. Two threads interleave in the gap:

```text
T1: containsKey(id) -> false
T2: containsKey(id) -> false          (T1 hasn't put yet)
T1: put(id, loadUser(id))             loadUser called
T2: put(id, loadUser(id))             loadUser called AGAIN, overwrites T1's value
=> loadUser runs twice; two different User objects may exist transiently
```

If `loadUser` is expensive or has side effects (opens a connection, registers the object), running it twice is a real bug. Fix with an **atomic compound operation** the map provides:

```java
// atomic "put if absent, else return existing" — computeIfAbsent runs the loader
// at most once per key, holding the bin lock so no duplicate load.
User getOrCreate(String id) {
    return cache.computeIfAbsent(id, this::loadUser);
}
```

`computeIfAbsent` collapses check-then-act into one atomic call. (Caveat: the mapping function must not modify the same map or block, and if `loadUser` can be slow you may prefer a value that is a memoizing `Future` to avoid holding the bin lock — but for the interview, `computeIfAbsent` is the right answer.) Lesson: thread-safe collection + non-atomic *compound* logic = still racy; use the collection's atomic methods.

### Q3. Design a thread-safe LRU cache. What are the concurrency pitfalls?

An LRU cache needs a hash map (O(1) lookup) plus a recency ordering (evict the least-recently-used). The concurrency subtlety: **every read mutates recency**, so even "gets" are writes, which defeats naive read-optimization.

**Simple correct version — guarded LinkedHashMap:**

```java
class LruCache<K,V> {
    private final LinkedHashMap<K,V> map;
    LruCache(int capacity) {
        // accessOrder=true makes get() move the entry to the tail (MRU)
        map = new LinkedHashMap<>(capacity, 0.75f, true) {
            protected boolean removeEldestEntry(Map.Entry<K,V> e) { return size() > capacity; }
        };
    }
    synchronized V get(K k) { return map.get(k); }     // get MUTATES order -> must lock
    synchronized void put(K k, V v) { map.put(k, v); }
}
```

`synchronized` on *both* methods is mandatory because `get` reorders the list — a common trap is thinking reads are safe to leave unlocked. Correct but a single lock serializes everything (the scaling ceiling from the contention topic).

**Pitfalls and scaling refinements:**

- **Reads are writes**: recency updates make a plain read-write lock unhelpful (readers still mutate). This is why a global lock is the honest starting point.
- **Contention**: one lock over the whole cache is a bottleneck under load. Options: **shard** into N segments each with its own lock+LRU (key hashed to a segment) — spreads contention N-ways at the cost of approximate global LRU. This is what production caches (Guava/Caffeine) evolve toward.
- **Better**: use a purpose-built concurrent cache (**Caffeine**) that decouples recency tracking from the read path using ring buffers + amortized replay, so reads are nearly lock-free while approximating LRU/LFU. In an interview, name this: "for real workloads I'd use Caffeine rather than hand-roll it, because it solves exactly the read-is-a-write contention problem."

Say the method aloud: shared mutable state = map + recency list; concern = atomicity of (lookup + reorder) and (put + evict); single invariant across two structures → needs a lock; then optimize contention by sharding.

### Q4. Fix this deadlock: two methods that lock two accounts in opposite orders.

```java
void transfer(Account from, Account to, int amt) {
    synchronized (from) {
        synchronized (to) {          // T1: transfer(A,B) locks A then B
            from.debit(amt);         // T2: transfer(B,A) locks B then A
            to.credit(amt);          // classic AB-BA deadlock
        }
    }
}
```

The deadlock (all four Coffman conditions present; the fixable one is **circular wait**):

```text
T1: transfer(A -> B)          T2: transfer(B -> A)
T1: lock A  (held)            T2: lock B  (held)
T1: wait for B ...            T2: wait for A ...
=> T1 holds A wants B, T2 holds B wants A -> circular wait -> hang forever
```

**Fix 1 — global lock ordering.** Always acquire locks in a consistent order (e.g. by a unique account id), so a cycle is impossible:

```java
void transfer(Account from, Account to, int amt) {
    Account first  = from.id() < to.id() ? from : to;
    Account second = from.id() < to.id() ? to   : from;
    synchronized (first) {
        synchronized (second) {   // both threads now lock lower-id first -> no cycle
            from.debit(amt);
            to.credit(amt);
        }
    }
}
// (handle from.id() == to.id() as a no-op / guard against self-transfer)
```

**Fix 2 — try-lock with backoff.** Acquire with `tryLock`, and if you can't get both, release and retry (breaks *hold-and-wait*):

```java
while (true) {
    if (from.lock.tryLock()) {
        try {
            if (to.lock.tryLock()) {
                try { from.debit(amt); to.credit(amt); return; }
                finally { to.lock.unlock(); }
            }
        } finally { from.lock.unlock(); }
    }
    Thread.sleep(random backoff);   // avoid livelock
}
```

Prefer **lock ordering** — it's deterministic and cheap. Use try-lock/backoff when you can't impose a global order. In the interview, name the Coffman condition you're breaking (circular wait for ordering, hold-and-wait for try-lock) — that's the senior tell.

### Q5. Design a thread-safe bounded producer-consumer (blocking queue).

Requirements: producers put items, consumers take them; the buffer has a fixed capacity; a `put` on a full buffer **blocks** until space frees; a `take` on an empty buffer **blocks** until an item arrives. The blocking is what provides **backpressure**.

**Best answer — use the library:**

```java
BlockingQueue<Task> q = new ArrayBlockingQueue<>(1000);
// producer
q.put(task);      // blocks if full  <- backpressure
// consumer
Task t = q.take();// blocks if empty
```

But interviewers usually want you to **implement it** to show you understand condition variables:

```java
class BoundedBuffer<T> {
    private final Queue<T> q = new ArrayDeque<>();
    private final int capacity;
    private final ReentrantLock lock = new ReentrantLock();
    private final Condition notFull  = lock.newCondition();
    private final Condition notEmpty = lock.newCondition();
    BoundedBuffer(int capacity) { this.capacity = capacity; }

    void put(T item) throws InterruptedException {
        lock.lock();
        try {
            while (q.size() == capacity) notFull.await();  // WHILE, not if
            q.add(item);
            notEmpty.signal();                             // wake a waiting consumer
        } finally { lock.unlock(); }
    }
    T take() throws InterruptedException {
        lock.lock();
        try {
            while (q.isEmpty()) notEmpty.await();           // WHILE, not if
            T item = q.remove();
            notFull.signal();                               // wake a waiting producer
            return item;
        } finally { lock.unlock(); }
    }
}
```

The three things interviewers are checking:

1. **Wait in a `while`, not an `if`** — guards against *spurious wakeups* and against another thread grabbing the slot between signal and reacquire (re-check the predicate).
2. **Two separate conditions** (`notFull`, `notEmpty`) so a producer wakes only consumers and vice versa — using one condition + `signalAll` works but wastes wakeups.
3. **Unlock in `finally`** — always release even on exception.

Mention the trade-off: `signal` (one waiter) is cheaper than `signalAll` but only correct when any single waiter can proceed and you use distinct conditions — which is exactly this setup.

### Q6. Make this lazy singleton thread-safe. Show the wrong and right ways.

```java
// BROKEN under concurrency: two threads both see null and both construct.
class Config {
    private static Config instance;
    static Config get() {
        if (instance == null) instance = new Config();  // check-then-act race
        return instance;
    }
}
```

Race: two threads both read `instance == null`, both construct → two singletons (and worse, one may publish a *partially constructed* object due to reordering).

**Wrong-ish fix — synchronize the whole method** (correct but serializes every read forever):

```java
static synchronized Config get() {          // correct but a lock on the hot read path
    if (instance == null) instance = new Config();
    return instance;
}
```

**Double-checked locking — correct only with `volatile`:**

```java
private static volatile Config instance;    // volatile is MANDATORY here
static Config get() {
    if (instance == null) {                 // 1st check, no lock (fast path)
        synchronized (Config.class) {
            if (instance == null)           // 2nd check, under lock
                instance = new Config();
        }
    }
    return instance;
}
```

Without `volatile`, another thread can see a **non-null but not-fully-constructed** `instance` because the write publishing the reference can be reordered ahead of the constructor's field writes. `volatile` inserts the happens-before/ordering fence that forbids that. (In C++ the analogue is `std::atomic` with acquire/release ordering; the pre-Java-5 memory model made DCL genuinely unfixable, which is why it has a bad reputation.)

**Best answer — sidestep the whole problem with the initialization-on-demand holder idiom:**

```java
class Config {
    private Config() {}
    private static class Holder { static final Config INSTANCE = new Config(); }
    static Config get() { return Holder.INSTANCE; }  // JVM guarantees safe, lazy, once
}
```

The JVM guarantees a class is initialized lazily (on first use of `Holder`) and exactly once with full memory safety — no `volatile`, no locking, no DCL subtlety. This is the idiom to lead with; use it to show you know DCL *and* know the cleaner alternative. (Or, if eager init is acceptable, an `enum` singleton.)

### Q7. Spot the bug: a flag used to stop a worker thread that never stops.

```java
class Worker implements Runnable {
    private boolean running = true;          // <-- not volatile: the bug
    public void run() {
        while (running) { doWork(); }        // may loop forever
    }
    public void stop() { running = false; }  // set from another thread
}
```

This is a **visibility** bug, not an atomicity one. The worker thread reads `running` in a tight loop; the JVM/JIT is free to **hoist the non-volatile read out of the loop** (there's no happens-before edge forcing it to re-read shared memory), effectively caching `true` in a register. Another thread calling `stop()` writes `running = false`, but the worker never observes it and spins forever.

```text
T-worker: while(running) ...   // JIT: cached 'running=true', reads register, never memory
T-main:   running = false       // written to memory, but worker isn't re-reading it
=> worker loops forever; works "sometimes" in debug builds because the JIT optimizes less
```

It's a classic **heisenbug**: adding a `println` (which has memory-barrier-ish side effects) or running with the debugger often "fixes" it by disrupting the optimization — which is how you know it's a visibility problem.

Fix — establish visibility with `volatile` (or an atomic, or the built-in interrupt mechanism):

```java
private volatile boolean running = true;   // volatile forces a fresh read each check
```

`volatile` guarantees every read sees the latest write (no caching in a register, plus ordering). For the cleanest idiom, prefer `Thread.interrupt()` + `Thread.currentThread().isInterrupted()`, which is the JDK's designed cooperative-cancellation mechanism and also breaks out of blocking calls. The general rule: **any variable used to signal between threads must have a happens-before edge** — `volatile`, `synchronized`, an atomic, or a concurrent structure.

### Q8. Design a thread-safe connection pool.

A connection pool hands out a bounded set of reusable connections: `acquire()` returns an idle connection (or **blocks/times out** if none available), `release()` returns it to the pool. It's a **bounded resource** problem — a counting semaphore plus a thread-safe idle set.

```java
class ConnectionPool {
    private final BlockingQueue<Conn> idle;
    private final Semaphore permits;          // caps total in-flight = pool size

    ConnectionPool(int size) {
        idle = new LinkedBlockingQueue<>();
        permits = new Semaphore(size);
        for (int i = 0; i < size; i++) idle.add(createConn());
    }

    Conn acquire(long timeout, TimeUnit u) throws InterruptedException {
        if (!permits.tryAcquire(timeout, u))  // block up to timeout for a permit
            throw new TimeoutException("pool exhausted");
        Conn c = idle.poll();
        return isValid(c) ? c : createConn();  // validate; replace dead connections
    }

    void release(Conn c) {
        if (isValid(c)) idle.offer(c); else idle.offer(createConn());
        permits.release();                     // always release the permit
    }
}
```

Key design points an interviewer probes:

- **Semaphore bounds the resource**: `size` permits cap concurrent checkouts; `tryAcquire(timeout)` gives **backpressure with a timeout** instead of unbounded waiting (fail fast when the pool is exhausted rather than hang).
- **`release()` must always run** — wrap usage in try/finally (or hand callers a closeable wrapper) so a thrown exception doesn't leak a permit/connection. Leaked permits shrink the pool until it deadlocks — a classic production bug.
- **Validate on borrow/return**: connections die (network, DB restart); check liveness and replace, or you hand out dead connections.
- **Fairness / starvation**: a fair semaphore (`new Semaphore(size, true)`) prevents a thread from being perpetually starved under load, at some throughput cost.
- **Don't hold the pool lock across I/O**: the pool coordinates *handing out* connections; actual query I/O happens outside any pool lock, or the pool serializes everything.

Say the method aloud: shared mutable state = the idle set + the count of outstanding connections; concern = don't exceed capacity (semaphore) and don't corrupt the idle set (thread-safe queue); waiting with a deadline = `tryAcquire(timeout)`.

### Q9. Why is my multithreaded code slower than the single-threaded version? Walk through the diagnosis.

Counterintuitive but common. Run through the usual culprits in order:

1. **Contention on a shared lock or hot variable.** If all threads funnel through one `synchronized` block or one `AtomicLong`, they serialize — you pay locking/coherence overhead *on top of* the original work, so it's *slower* than single-threaded. Fix: shard the state (`LongAdder`, striped locks), shrink the critical section. This is the #1 cause.
2. **The work is I/O-... no, it's the GIL (Python).** If this is CPython and the work is CPU-bound, the **GIL** serializes bytecode execution — threads *cannot* run Python code in parallel, and you just added context-switch and lock overhead. Fix: `multiprocessing`, a native extension that releases the GIL, or free-threaded 3.13+. (In Java/Go/C++ this specific cause doesn't apply.)
3. **Task granularity too fine.** If each task is tiny, the overhead of dispatching to the pool, queueing, and synchronizing dwarfs the actual work. Fix: batch work into coarser chunks so useful work per synchronization dominates.
4. **False sharing.** Per-thread counters packed into one array share cache lines and ping-pong (from the contention topic). Fix: pad/align.
5. **Over-subscription.** More threads than cores → context-switch thrashing, cache/TLB flushes each switch. Fix: size the pool to ≈ cores for CPU-bound work.
6. **Memory-bandwidth bound.** A streaming kernel saturates the bus with a few threads; more threads just wait. Fix: locality/tiling, not more threads.

Diagnosis method: measure the throughput-vs-threads curve (does it collapse or never start?), take an **off-CPU flame graph / thread dump** to see if threads are BLOCKED (contention) or RUNNABLE-but-slow (bandwidth/GIL). The meta-lesson to state: parallelism has *overhead*, and it only pays off when the parallel work is large relative to the coordination cost — otherwise Amdahl plus contention makes N threads slower than 1.

### Q10. Which primitive would you use and why? Walk through choosing for several scenarios.

The senior move is a **decision framework**, not a memorized list. Ask: *how many variables does the invariant span, do I only read or also write, and how contended is it?*

| Scenario | Primitive | Why |
|---|---|---|
| One counter, hot | `LongAdder` | Sharded cells avoid cache-line ping-pong; approximate reads OK |
| One counter, exact reads / low contention | `AtomicInteger`/`AtomicLong` | Lock-free CAS, atomic RMW + exact `get` |
| One reference swapped atomically (config, cache snapshot) | `volatile` ref to immutable object, or `AtomicReference` | Readers lock-free; writer swaps pointer (copy-on-write) |
| Invariant across *multiple* fields | `synchronized` / `ReentrantLock` | Only a lock makes a multi-field update atomic as a unit |
| Read-heavy, rare writes, multi-field | `ReadWriteLock` or copy-on-write snapshot | Concurrent readers; or lock-free reads via immutable snapshot |
| Bounded resource / permits | `Semaphore` | Counts available permits, blocks past the limit |
| Producer/consumer handoff | `BlockingQueue` | Built-in blocking + backpressure; no hand-rolled wait/notify |
| Wait for a condition to become true | `Condition` / wait-notify in a `while` | Guarded blocks with predicate re-check |
| One-time initialization | holder idiom / `volatile` DCL | Lazy, safe, once |
| Independent per-thread scratch | `ThreadLocal` / confinement | No sharing at all — the cheapest "primitive" |

The reasoning script to say aloud: "First, can I **avoid sharing** — confine it or make it immutable? If not, is the invariant on **one variable** (→ atomic) or **several** (→ lock)? Is it **read-mostly** (→ snapshot/RWLock/RCU)? Is it a **resource limit** (→ semaphore) or a **handoff** (→ blocking queue)? Then I'd pick the cheapest one that covers atomicity, visibility, and ordering for exactly that shape, and check the contention profile." Interviewers care far more about that reasoning than the specific choice.

### Q11. Spot the race: a lazily-initialized field guarded by a null check inside a getter.

```java
class Parser {
    private Map<String,Rule> rules;          // not volatile
    Rule ruleFor(String name) {
        if (rules == null) {                 // check
            rules = loadRules();             // act: build the map
        }
        return rules.get(name);
    }
}
```

Two distinct problems:

**Atomicity (check-then-act):** two threads both see `rules == null` and both call `loadRules()`. Wasteful if `loadRules` is expensive, and if it has side effects (registers listeners, opens files), doing it twice is a bug.

**Visibility / unsafe publication (the nastier one):** even with a single initializer, `rules` is not `volatile`, so another thread can see `rules` as **non-null but referencing a partially-constructed map**. The write publishing the reference can be reordered *before* the writes that populate the map's internal arrays, so a reader can observe a `Map` object whose internal state isn't fully visible — a crash or wrong result, intermittently.

```text
T1: rules = <new HashMap, fields not yet visible to T2>   (reference published early)
T2: rules != null -> rules.get(name)  -> reads half-built internals -> NPE/garbage
```

Fixes:

```java
// Correct DCL: volatile + double check
private volatile Map<String,Rule> rules;
Rule ruleFor(String name) {
    Map<String,Rule> local = rules;          // read volatile once
    if (local == null) {
        synchronized (this) {
            local = rules;
            if (local == null) rules = local = loadRules();
        }
    }
    return local.get(name);
}
// Or best: initialize eagerly in the constructor / use the holder idiom if it's a singleton,
// or make 'rules' an immutable map built once so publication is safe.
```

The lesson mirrors the singleton question: **lazy init of a shared field needs `volatile` (or a lock, or safe eager publication)** — a bare null-check getter is both a duplicate-init race and an unsafe-publication race.

### Q12. Design a thread-safe rate limiter (in-process). How does it differ from a counter?

An in-process token-bucket limiter. Unlike a counter (which just needs an atomic RMW), a rate limiter has a **time-dependent invariant** — tokens accrue with elapsed time — so the tricky part is computing refill and spending a token **atomically together**.

```java
class TokenBucket {
    private final double ratePerNano;   // refill rate
    private final double capacity;
    private double tokens;
    private long lastRefillNanos;
    private final ReentrantLock lock = new ReentrantLock();

    TokenBucket(double ratePerSec, double capacity) {
        this.ratePerNano = ratePerSec / 1e9;
        this.capacity = capacity;
        this.tokens = capacity;
        this.lastRefillNanos = System.nanoTime();
    }

    boolean tryAcquire() {
        lock.lock();
        try {
            long now = System.nanoTime();
            tokens = Math.min(capacity, tokens + (now - lastRefillNanos) * ratePerNano);
            lastRefillNanos = now;
            if (tokens >= 1.0) { tokens -= 1.0; return true; }  // spend
            return false;                                        // throttled
        } finally { lock.unlock(); }
    }
}
```

Why a lock and not a bare atomic: the operation is a **read-modify-write across two fields** (`tokens` and `lastRefillNanos`) that must be consistent with each other — refill-then-check-then-spend is a compound action. You *can* do it lock-free with an `AtomicReference<State>` holding both fields and a CAS retry loop (state = `{tokens, lastRefill}`), which scales better under contention; the lock version is simpler and fine for moderate rates.

Contrast with a counter: a counter's invariant is on **one value** with **no time dependence**, so `AtomicInteger` suffices. The rate limiter couples **two fields plus wall-clock time**, so it needs either a lock or a CAS over a combined immutable state object — a good example of "how many variables does the invariant span" driving the primitive choice. (For the *distributed* version, this state moves to Redis with a Lua script for atomicity — see the distributed topic.)

### Q13. Debugging walkthrough: an intermittent test failure that only happens on CI under load. How do you attack it?

This screams **race condition / heisenbug** — non-deterministic, load-dependent, disappears under a debugger. A structured attack:

1. **Confirm it's concurrency, not flakiness from elsewhere.** Is the failing code touching shared mutable state from multiple threads? Does it fail more with more parallelism (CI runs many tests concurrently)? Intermittent + concurrent + timing-sensitive = race hypothesis.
2. **Make it reproducible.** Rare interleavings need *pressure*: run the suspect operation from many threads in a tight loop thousands of times (`@RepeatedTest`, a stress harness), pin CPU, add small random jitter/`Thread.yield()` at suspect points to widen the race window. The goal is to turn a 1-in-10000 failure into a 1-in-10.
3. **Use a race detector.** Go: `go test -race` (TSan) flags data races directly with both stacks. Java: run under `-ea`, use jcstress for memory-model tests, or thread-dump on hang. C/C++/Rust: ThreadSanitizer. A race detector often points straight at the unsynchronized field.
4. **Read for the four smells.** Shared mutable field without `volatile`/lock (visibility); check-then-act on shared state (atomicity); lock acquired inconsistently (partial synchronization); two locks in different orders (deadlock — but that hangs, doesn't fail a value check).
5. **Don't be fooled by "fixes" that just hide it.** Adding a `println` or `sleep` that makes it pass is a *diagnosis* (confirms timing-sensitivity), not a fix — it perturbs timing. The real fix restores a happens-before edge or makes the compound action atomic.
6. **Fix, then re-stress.** Apply the synchronization fix and re-run the stress harness enough times that statistical confidence is high — a single green run means nothing for a probabilistic bug.

The meta-point interviewers want: concurrency bugs are **probabilistic**, so you *amplify* the probability (stress, jitter, race detectors) rather than hoping to catch them, and you prove the fix by failing to reproduce under heavy stress — not by one passing run.

### Q14. Design a work queue with N worker threads (a thread pool). What are the design decisions?

A pool = a **thread-safe task queue** + a fixed set of worker threads that loop pulling and running tasks. The point is to amortize thread-creation cost and bound concurrency.

```java
class WorkQueue {
    private final BlockingQueue<Runnable> queue;
    private final Thread[] workers;
    private volatile boolean running = true;

    WorkQueue(int n, int capacity) {
        queue = new LinkedBlockingQueue<>(capacity);   // bounded => backpressure
        workers = new Thread[n];
        for (int i = 0; i < n; i++) {
            workers[i] = new Thread(() -> {
                while (running || !queue.isEmpty()) {
                    try { queue.take().run(); }        // blocks when empty
                    catch (InterruptedException e) { Thread.currentThread().interrupt(); break; }
                    catch (RuntimeException e) { log(e); } // one bad task must not kill the worker
                }
            });
            workers[i].start();
        }
    }
    void submit(Runnable t) throws InterruptedException { queue.put(t); } // blocks if full
    void shutdown() { running = false; workers... interrupt(); }
}
```

Design decisions to raise (this is really "explain `ThreadPoolExecutor`"):

- **Bounded vs unbounded queue.** Unbounded risks OOM under a producer spike (and hides backpressure); bounded gives **backpressure** and forces a **rejection policy** when full (block the submitter, discard, run-on-caller-thread). Prefer bounded.
- **Pool sizing.** CPU-bound ≈ number of cores; I/O-bound higher, derived from Little's law (`threads = cores × (1 + wait/compute)`). Too many → context-switch thrash; too few → underutilization.
- **Worker resilience.** A task throwing must **not** kill the worker thread — catch inside the loop, log, continue. Losing workers silently shrinks the pool to zero (a real prod bug).
- **Graceful shutdown.** Stop accepting, drain in-flight, interrupt on timeout — the `shutdown()`/`shutdownNow()` distinction.
- **Load balancing / work-stealing.** One shared queue is simplest but its head is a contention point; **per-worker deques with work-stealing** (fork-join) scale better for many small/recursive tasks — idle workers steal from the tail of busy workers' deques.

Best answer in practice: "I'd use `ThreadPoolExecutor` (or `ForkJoinPool` for recursive/divide-and-conquer work) rather than hand-roll this — but here's how it works internally," then hit the sizing, bounded-queue, rejection-policy, and worker-resilience points to show you understand *why* the library is shaped the way it is.

### Q15. Spot the bug: reading and writing a shared HashMap from multiple threads without synchronization.

```java
Map<String,Integer> counts = new HashMap<>();   // NOT thread-safe
// many threads:
counts.merge(key, 1, Integer::sum);             // concurrent structural modification
```

`HashMap` is **not** thread-safe, and concurrent structural modification (put/resize) can corrupt it in ways worse than a lost update:

- **Lost updates** — the `merge` read-modify-write interleaves and drops increments (atomicity).
- **Corrupted internal structure** — concurrent `put`s during a **resize** can leave the bucket arrays inconsistent; historically (pre-Java 8) this could produce an **infinite loop** in `get()` (a cycle in a bucket's linked list), pinning a CPU at 100% forever. Post-Java-8 it won't infinite-loop but can still lose data, throw, or return garbage.
- **Visibility** — writes may not be visible across threads.

```text
T1: put(k1,..) triggers resize, rehashing bucket array
T2: put(k2,..) mid-resize -> sees half-migrated table -> lost entry / corrupted node
=> nondeterministic: data loss, ConcurrentModificationException, or (old JDKs) CPU spin
```

Fixes, by need:

```java
// 1. ConcurrentHashMap — designed for this; merge/compute are atomic per key
ConcurrentHashMap<String,Integer> counts = new ConcurrentHashMap<>();
counts.merge(key, 1, Integer::sum);            // atomic, lock-free-ish per bin

// 2. If you must use a plain map, guard EVERY access with the same lock
synchronized (lock) { counts.merge(key, 1, Integer::sum); }  // serializes all access

// 3. For a hot count-by-key, ConcurrentHashMap<K, LongAdder> or computeIfAbsent + adder
counts.computeIfAbsent(key, k -> new LongAdder()).increment();
```

Lesson: `HashMap` under concurrency isn't just "might lose an update" — it can **corrupt** and hang. Reach for `ConcurrentHashMap` and its atomic `compute`/`merge` methods, or guard the plain map with a lock consistently on *every* access (a half-synchronized map is still broken).

### Q16. Spot the subtle bug: a `size` counter kept alongside a thread-safe collection.

```java
class Inbox {
    private final ConcurrentLinkedQueue<Msg> q = new ConcurrentLinkedQueue<>();
    private final AtomicInteger size = new AtomicInteger();

    void add(Msg m)  { q.add(m); size.incrementAndGet(); }   // two atomic ops, not one
    Msg  poll()      { Msg m = q.poll(); if (m != null) size.decrementAndGet(); return m; }
    int  size()      { return size.get(); }
}
```

Each individual operation is atomic, but the **pair** (`queue op` + `counter op`) is **not atomic together**, so `size()` can transiently disagree with the actual queue contents — and worse, the two can drift permanently under the wrong interleaving:

```text
add():  q.add(m)   ....................  size.incrementAndGet()
                    ^ another thread's poll() can run here:
poll(): q.poll() returns m  -> size.decrementAndGet()   // decrements BEFORE add incremented
=> counter can momentarily read negative, or reflect a state that never existed
```

Even without permanent drift, `size()` is only ever an **approximation** because it's a separate atomic from the queue mutation — there's no instant where both are guaranteed consistent to an outside reader. If some logic does `if (size() < LIMIT) add(...)` you have a **check-then-act** race on top (the size can change between check and add).

Fixes:

- **Don't maintain a separate counter.** `ConcurrentLinkedQueue.size()` is O(n) but consistent; if you rarely need size, just use it. The separate `AtomicInteger` is a premature optimization that introduced a consistency bug.
- **If you need O(1) size *and* consistency**, the count and the collection must be updated under **one lock** (e.g. a `synchronized` wrapper or `ArrayBlockingQueue`, which maintains an accurate count under its own lock). You cannot get a consistent (contents, size) pair from two independent lock-free structures.
- **If an approximate size is acceptable** (metrics, capacity heuristics), document that `size()` is approximate and never use it in a correctness-critical check-then-act.

Lesson: composing two individually-atomic structures does **not** give you an atomic *relationship* between them — a recurring theme (check-then-act, the earlier map+size question). Consistency across two pieces of state requires a single point of synchronization.

### Q17. What's your general strategy for reasoning out loud about any concurrency problem in an interview?

A repeatable script that makes you look senior even on an unfamiliar problem. State it explicitly as you go:

1. **Identify the shared mutable state.** "The only thing that can race is memory that's both written and shared — let me find it." Point at the exact fields. If there's none (immutable, confined, stack-local), say so — you're done.
2. **Name the three concerns for that state.** *Atomicity* (is there a compound/read-modify-write or check-then-act?), *visibility* (is there a happens-before edge, or could a thread see a stale/partial value?), *ordering* (could reordering break an invariant, e.g. unsafe publication?). Most bugs are one of these; naming them shows you have a framework, not just intuition.
3. **State the invariant and its span.** "The correctness rule is X; it spans one field (→ atomic/CAS) or several (→ a lock)." This directly drives the primitive.
4. **Pick the cheapest primitive that covers exactly those concerns** — in order of preference: *avoid sharing* (immutability/confinement) > *atomic* (single var) > *lock* (multi-field) > *concurrent collection* / *semaphore* / *blocking queue* for the standard shapes. Prefer a library primitive over hand-rolling.
5. **Prove it with an adversarial interleaving.** Draw a T1/T2 step table and *try to break your own solution* — the interviewer was about to do exactly that, so beat them to it. For race questions, this exposes the bug; for design questions, it validates the fix.
6. **Then address contention/scaling.** "This is correct; under high load the single lock/atomic is a bottleneck, so I'd shard / use `LongAdder` / go read-mostly." Showing you separate *correctness* from *performance* is a strong senior signal.
7. **Mention testing.** "I'd stress-test with many threads in a loop and run a race detector, because passing once proves nothing for a probabilistic bug."

The through-line: **externalize the method**. Interviewers can't see you think, so narrate the framework — shared state, the three concerns, the invariant span, the cheapest primitive, the breaking interleaving. That narration is what distinguishes someone who *understands* concurrency from someone who's memorized its vocabulary, and it's exactly what makes the rest of this primer usable under pressure.
