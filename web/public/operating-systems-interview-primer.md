---
type: interview-prep
---

# Operating Systems Interview Primer — 334 Questions

Comprehensive Q+A primer for operating-systems and CS-fundamentals interviews. A System Fundamentals companion to the System Design primers — the mechanisms and algorithms interviewers actually probe: how processes, threads, scheduling, synchronization, deadlock, memory, paging, file systems, I/O, interrupts, and the kernel really work. OS-conceptual and OS-agnostic (Linux/Windows/xnu examples), the CS-theory counterpart to the practical Linux primer — not command-line admin.

Each answer is interview-shaped: opinionated, concrete, with small ASCII diagrams (state machines, address-space layout, page-table translation), C-ish pseudocode, and comparison tables (process vs thread, scheduling algorithms, page-replacement algorithms, mutex vs semaphore, interrupt vs trap, paging vs segmentation, VM vs container). Warm-up ("process vs thread") to senior ("walk me through a page fault end-to-end", "design deadlock-free dining philosophers", "why does adding threads sometimes slow a program down").

1. [[#OS Fundamentals & Architecture]]
2. [[#Processes]]
3. [[#Threads]]
4. [[#CPU Scheduling]]
5. [[#Process Synchronization]]
6. [[#Deadlocks]]
7. [[#Inter-Process Communication (IPC)]]
8. [[#Memory Management]]
9. [[#Virtual Memory & Paging]]
10. [[#Page Replacement & Thrashing]]
11. [[#File Systems]]
12. [[#Storage & Disk I/O]]
13. [[#I/O Systems & Device Management]]
14. [[#Interrupts, Traps & System Calls]]
15. [[#Kernel & Protection]]
16. [[#Virtualization & Containers]]
17. [[#OS Security]]
18. [[#Boot Process & Initialization]]
19. [[#Performance & Observability]]
20. [[#Real-World Kernels]]
21. [[#Scenario & Interview Playbooks]]

## OS Fundamentals & Architecture

### Summary

**What this topic covers**

The foundation the whole primer rests on: what an operating system actually *is*, what it does, and how it's built. An OS is two things at once — a **resource manager** that arbitrates a machine's finite CPU, memory, and devices among competing programs, and an **abstraction layer** that turns raw, awkward hardware into clean, reusable concepts (processes, files, virtual memory, sockets). Every later topic — scheduling, paging, synchronization, deadlock, file systems — is just one of those responsibilities examined up close. The 16 questions here establish the vocabulary and the single most-asked structural idea in OS interviews: the **user-mode / kernel-mode** split and the **system call** that bridges it. Get this topic solid and the rest of the primer has somewhere to attach.

**Mental model**

Picture the OS as a *government* sitting between citizens (programs) and a shared territory (the hardware). Programs never touch the CPU scheduler, the disk controller, or physical RAM directly — they'd trample each other and crash the machine. Instead they make *requests*, and the OS — running with special privileges no ordinary program has — grants, queues, or denies them, enforcing isolation and fairness. Two layers make this work. First, the CPU itself supports **dual-mode operation**: a hardware **mode bit** says whether the processor is in privileged **kernel mode** (can execute any instruction, touch any memory, talk to devices) or restricted **user mode** (can't). Second, the only sanctioned door from user mode into kernel mode is the **system call** — a deliberate software trap that switches the mode bit, jumps to vetted kernel code, does the privileged work, and returns. So the mental picture is: *hardware at the bottom, the kernel as the sole privileged intermediary, applications on top talking to it exclusively through the narrow, guarded system-call interface.*

**Key terms**

- **Kernel** — the always-resident core of the OS that runs in privileged mode and manages CPU, memory, devices, and syscalls.
- **User mode vs kernel mode** — hardware-enforced privilege levels; privileged instructions (halt, set timer, I/O, load page table) are legal only in kernel mode.
- **Mode bit** — the CPU flag recording which mode is active; a syscall/interrupt sets it to kernel, `return-from-trap` restores user.
- **System call** — the controlled entry point from a user program into the kernel (e.g. `read`, `write`, `open`, `fork`, `exec`); implemented as a software trap.
- **Trap / software interrupt** — the synchronous CPU mechanism a syscall uses to switch mode and vector into the kernel.
- **Monolithic kernel** — all OS services (scheduler, FS, drivers, networking) run in one kernel address space; fast, large **TCB** (Linux).
- **Microkernel** — kernel keeps only the bare minimum (IPC, scheduling, basic memory); FS, drivers, etc. run as user-space servers; safer/modular, IPC overhead (Mach, QNX, seL4).
- **Hybrid kernel** — pragmatic middle ground (Windows NT, macOS XNU).
- **Mechanism vs policy** — *mechanism* is how you do something (context-switch machinery); *policy* is which choice to make (which process runs next). Good design separates them.
- **Trusted Computing Base (TCB)** — the code that must be correct for the system to be secure; bugs here are catastrophic. Smaller is better.
- **Multiprogramming / multitasking / multiprocessing** — several jobs resident to keep the CPU busy / rapid time-slicing for interactivity / genuinely parallel execution on multiple CPUs.

**Why interviewers ask this**

This is the altitude check. A junior answers "an OS is Windows or Linux, it runs your programs." A senior answers "it's a resource manager and abstraction layer; it runs privileged in kernel mode while apps run in user mode, and they cross that boundary only through system calls, which are traps." The user/kernel/syscall triad is the single highest-frequency conceptual question in OS interviews because it gates understanding of protection, virtual memory, scheduling, and security all at once. Interviewers also probe kernel architecture (monolithic vs microkernel) to see whether you understand the safety-vs-performance trade-off and the TCB idea — the same reasoning that shows up later in containers, hypervisors, and sandboxing. If you can crisply say *what* the OS does, *why* it needs privilege separation, and *how* the boundary is crossed, you've signalled real systems literacy.

**Common confusions**

- "The kernel and the OS are the same thing." The kernel is the privileged core; the OS also bundles user-space utilities, libraries, and shells.
- "A system call is just a function call." A library call stays in user mode; a syscall deliberately traps into the kernel, switching the mode bit — far more expensive and the only way to get privileged work done.
- "User mode can access hardware if it really wants to." No — privileged instructions and device registers are unreachable from user mode by hardware; attempting one traps.
- "Microkernels are just slower monoliths." They're a different structure: minimal kernel, services in user space, communicating by IPC — safer and more modular, paying IPC cost.
- "Multitasking = multiprocessing." Multitasking is time-slicing one (or more) CPUs to *appear* concurrent; multiprocessing is genuine parallel hardware.

**What follows from this topic**

Everything. **Processes** and **Threads** are the CPU/execution abstractions the kernel manages. **CPU Scheduling** is the *policy* deciding which process runs (mechanism vs policy in action). **Memory Management** and **Virtual Memory** are how the kernel virtualizes RAM behind the MMU. **Interrupts & I/O** are the events (traps and hardware interrupts) that drive the kernel's control flow — the "heartbeat" that lets it regain control. And **Virtualization & Security** revisit the privilege boundary at higher and lower altitudes (rings, hypervisors, containers). Keep the user/kernel/syscall picture in your head as you read on — it reappears in every single topic.

### Q1. What does an operating system actually do?

At the highest level, an OS does two jobs:

**1. Resource management** — the hardware (CPU, RAM, disks, network, GPU) is finite and shared. The OS decides *who gets what, when*: which process runs on the CPU, which pages of physical memory each process holds, whose I/O request the disk services next. It arbitrates contention and enforces fairness and isolation.

**2. Abstraction** — raw hardware is hostile to program against. The OS wraps it in clean, portable concepts:

- The CPU becomes **processes/threads** (each program thinks it owns the CPU).
- Physical RAM becomes **virtual address spaces** (each program thinks it owns all of memory).
- Disk blocks become **files and directories**.
- Network cards become **sockets**.

Concretely its responsibilities are: **process/CPU management** (create, schedule, terminate), **memory management** (allocate, protect, virtualize), **file & storage management**, **I/O & device management** (drivers, buffering), and **protection & security** (isolation, access control). Think of it as a government: it owns nothing you use directly, but it arbitrates every use.

### Q2. Explain kernel mode vs user mode. Why does the distinction exist?

Modern CPUs support **dual-mode operation** enforced by a hardware **mode bit**:

| | User mode | Kernel mode |
|---|---|---|
| Mode bit | user | kernel (privileged) |
| Runs | application code | the kernel |
| Privileged instructions | trap (illegal) | allowed |
| Direct hardware / device I/O | forbidden | allowed |
| Physical memory / page tables | no direct access | full access |

**Why it exists:** without it, any buggy or malicious program could halt the CPU, reprogram the interrupt controller, scribble on another process's memory, or read the disk directly — no isolation, no security, no stability. Restricting **privileged instructions** (halt, set the timer, load the page-table base register, do raw I/O) to kernel mode means the kernel stays the sole arbiter. A user program that *tries* a privileged instruction doesn't get away with it — the CPU traps into the kernel, which typically kills the offender.

The timer interrupt is the linchpin: only the kernel can set it, so it can always forcibly regain the CPU from a runaway user program. That's what makes preemptive multitasking possible.

### Q3. What is a system call, and how does it differ from a regular function call?

A **system call** is the controlled gateway from user mode into the kernel — the only sanctioned way a program gets privileged work done (I/O, process creation, memory mapping, networking).

A **library/function call** stays entirely in user mode: it's just a `call` to another address in your own address space. A **system call** must cross the privilege boundary, so it's implemented as a **software trap**:

```text
user program              kernel
-----------              ------
read(fd, buf, n)
  library stub sets
  syscall number + args
  executes SYSCALL  ----> trap: mode bit -> kernel
                          look up handler in syscall table
                          validate args, do privileged work
                          (read from disk into buf)
  <---------------------  return-from-trap: mode bit -> user
  return value n
```

Key differences: a syscall **switches the mode bit**, saves user state, dispatches through the **syscall table** by number, and is far more expensive than a plain call (mode switch, argument validation, possible scheduling). Examples: `read`, `write`, `open`, `close`, `fork`, `exec`, `mmap`, `socket`. Note `printf` is a *library* function that eventually calls the `write` *syscall* — the library is convenience wrapping the real kernel entry point.

### Q4. What happens, step by step, when a program makes a system call like read()?

```text
1. Program calls read(fd, buf, n) — actually a libc wrapper.
2. Wrapper puts the syscall NUMBER in a register, args in others.
3. Executes the trap instruction (SYSCALL / int 0x80 / svc).
4. CPU switches mode bit user -> kernel, jumps via the trap
   vector to the kernel's syscall entry point.
5. Kernel saves user registers, reads the syscall number,
   indexes the syscall table -> sys_read handler.
6. Kernel VALIDATES args (is fd open? is buf a legal user
   address? is n sane?) — never trust user input.
7. Does the privileged work: may copy from page cache, or
   block the process and issue disk I/O, scheduling something
   else meanwhile.
8. Puts the return value (bytes read, or -errno) in a register.
9. return-from-trap: restores user registers, mode bit -> user.
10. Wrapper returns the value to the caller.
```

The two senior-level details: **validation** (the kernel treats every user pointer and argument as hostile) and **blocking** (a syscall can put the process to sleep and run another — the syscall boundary is also a scheduling point).

### Q5. Compare monolithic, microkernel, and hybrid kernel architectures.

| | Monolithic | Microkernel | Hybrid |
|---|---|---|---|
| What's in the kernel | everything: scheduler, FS, drivers, net | bare minimum: IPC, scheduling, basic memory | core + some services in kernel |
| Services (FS, drivers) | kernel address space | user-space servers | mixed |
| Communication | direct function calls | message passing (IPC) | mixed |
| Speed | fast (no IPC hops) | slower (IPC overhead) | in between |
| TCB size | large | small | medium |
| Fault isolation | a driver bug can panic the kernel | a crashed server can be restarted | partial |
| Examples | Linux, BSD | Mach, QNX, seL4, MINIX 3 | Windows NT, macOS XNU |

**Monolithic** wins on performance — everything is a direct call in one address space — but any component's bug (say a driver) can take down the whole kernel, and the TCB is huge. **Microkernel** pushes drivers/FS/networking into user-space servers that talk via IPC; a crashed driver can be restarted without a panic, and the TCB shrinks (seL4 is formally verified) — the cost is IPC overhead on every cross-service call. **Hybrid** kernels (NT, XNU) pragmatically keep performance-critical services in the kernel while borrowing microkernel structure. Note Linux is "monolithic but modular" — loadable modules still run *in* the kernel address space, so they're not the isolation microkernels give.

### Q6. What is the difference between mechanism and policy? Why separate them?

**Mechanism** = *how* to do something. **Policy** = *what decision* to make.

- Scheduler: the *mechanism* is the context-switch machinery that can save one process and run another; the *policy* is which process to pick next (round-robin? priority?).
- Paging: the *mechanism* is the page-fault handler and page tables; the *policy* is which page to evict (LRU? Clock?).

Separating them means you can change the policy without rewriting the mechanism. Linux can swap CPU schedulers or I/O schedulers without touching the low-level switch code; a microkernel can even push policy into user space. It's the systems expression of "separate what varies from what stays fixed." Interviewers like this because it shows you see the OS as designed, not just a pile of features.

### Q7. Why do we need an operating system at all? Couldn't programs just run on the hardware?

They could (embedded firmware does), but you'd lose four things the OS provides:

- **Abstraction** — without it, every program would need to know the exact disk-controller registers, the physical memory map, the CPU's every quirk. The OS gives portable concepts (files, processes, sockets) so programs are written once, not per-machine.
- **Protection/isolation** — with multiple programs sharing one machine, you need something privileged to stop them corrupting each other's memory or hogging the CPU. Only the kernel, running with hardware privilege, can enforce that.
- **Sharing/multiplexing** — one CPU, many programs; finite RAM, many demands. The OS time-shares the CPU and space-shares memory so everyone makes progress.
- **Convenience** — services every program needs (buffered I/O, a filesystem, networking, a scheduler) are provided once by the OS instead of reimplemented per app.

Single-purpose bare-metal code can skip all this. The moment you want *multiple, isolated, portable* programs sharing *finite* hardware, you've reinvented an OS.

### Q8. What are the major responsibilities of an operating system?

Five classic areas:

1. **Process / CPU management** — create and terminate processes and threads, schedule them onto CPUs, provide synchronization and IPC, handle deadlocks.
2. **Memory management** — track what's in use, allocate/free, give each process a protected virtual address space, implement virtual memory (paging, swapping).
3. **File & storage management** — organize data into files and directories, manage free space, enforce permissions, implement the on-disk format.
4. **I/O & device management** — drivers, buffering/caching, spooling, presenting devices uniformly, moving data via DMA and interrupts.
5. **Protection & security** — isolate processes, enforce access control, authenticate users, defend against escalation.

A useful sixth: **networking** (protocol stacks, sockets) on any modern OS. Each maps to a topic in this primer.

### Q9. What is the Trusted Computing Base (TCB), and why does kernel size matter?

The **TCB** is the set of hardware + software that *must* be correct for the system's security guarantees to hold. If code in the TCB has a bug, an attacker can potentially bypass all protection. The kernel is squarely in the TCB — it runs with full privilege, so a kernel vulnerability is game-over (privilege escalation, arbitrary memory access).

That's the core argument *for* microkernels: by moving drivers, file systems, and networking out of the kernel into unprivileged user-space servers, you shrink the TCB. A bug in a user-space driver can't directly corrupt kernel memory. seL4 pushes this to the limit — a tiny kernel small enough to *formally verify*. Monolithic kernels take the opposite bet: a large TCB (every driver runs privileged) in exchange for speed and simplicity. This same "shrink the trusted core" reasoning reappears in sandboxing, hypervisors, and container isolation.

### Q10. What is the difference between multiprogramming, multitasking, and multiprocessing?

- **Multiprogramming** — keep several jobs *resident* in memory so that when one blocks on I/O, the CPU switches to another. The goal is **CPU utilization** — never let an expensive CPU idle waiting for slow disks. Historically batch-oriented, no time-slicing.
- **Multitasking (time-sharing)** — extend multiprogramming with a **timer** so the CPU rapidly switches between tasks on short quanta, giving each *interactive responsiveness*. The goal is **response time** — many users/programs each feel like they have the machine.
- **Multiprocessing** — genuinely *multiple CPUs/cores* executing in parallel. The goal is **throughput/parallelism** — real simultaneous execution, not just the illusion of it.

They stack: a modern OS is multiprogrammed (many jobs loaded), multitasking (time-sliced for interactivity), and multiprocessing (spread across cores). The distinction to nail in interviews: multitasking is *concurrency* (interleaving), multiprocessing is *parallelism* (simultaneity).

### Q11. What are the main types of operating systems (batch, time-sharing, real-time, distributed)?

- **Batch** — jobs submitted, queued, run without interaction; maximize throughput, no responsiveness needs. (Historical mainframes; still echoes in job schedulers.)
- **Time-sharing / interactive** — many users/processes share the machine via rapid time-slicing; optimize response time. (Desktop/server Linux, Windows, macOS.)
- **Real-time (RTOS)** — correctness depends on *meeting deadlines*, not just producing right answers. **Hard RTOS** (avionics, engine control) must never miss a deadline; **soft RTOS** (media playback) tolerates occasional slips. Scheduling is deadline/priority-driven and predictable, not fair. (VxWorks, QNX, FreeRTOS.)
- **Distributed** — resources span multiple networked machines presented (ideally) as one system; adds concurrency, partial failure, and consistency concerns.

Also worth naming: **embedded** OSes (tiny footprint, fixed function) and **network** OSes. The key axis interviewers probe is *what the OS optimizes for* — throughput, response time, or deadline guarantees — because that dictates the scheduler.

### Q12. How does a program on disk become a running process?

A program is a **passive** file (an executable — ELF on Linux, PE on Windows, Mach-O on macOS) sitting on disk. Turning it into a running **process** is the **loader's** job:

```text
1. exec() syscall names the executable.
2. Kernel/loader parses the binary header, checks it's valid
   and permitted to run.
3. Sets up a fresh virtual address space: maps the text
   (code) segment, initialized data, zeroes the BSS, sets up
   heap and stack.
4. Loads (or lazily demand-pages) the code and data.
5. Resolves/loads shared libraries (dynamic linker).
6. Sets the program counter to the entry point, builds the
   initial stack (argv, envp).
7. Returns to user mode — the CPU starts executing the
   program's first instruction. It is now a live process.
```

The one-liner: *a program is the recipe on disk; a process is the meal being cooked* — an active entity with an address space, registers, a PC, and OS bookkeeping (its PCB). The **Processes** topic picks up exactly here.

### Q13. What role do interrupts play — why are they called the OS's "heartbeat"?

The kernel isn't a background loop constantly running; most of the time a *user* program owns the CPU. So how does the kernel ever regain control? **Interrupts.** An interrupt is a hardware signal that forces the CPU to stop what it's doing, switch to kernel mode, and run a handler.

The **timer interrupt** is the "heartbeat": the kernel programs a timer before dispatching a user process, and when it fires, control snaps back into the kernel — which can then re-schedule. Without it, a user program in an infinite loop would own the CPU forever (cooperative-only systems had exactly this problem). Other interrupts: **device interrupts** (disk done, packet arrived, key pressed) let slow devices notify the CPU asynchronously instead of being polled; **traps/exceptions** (page faults, divide-by-zero, syscalls) are synchronous.

So the OS is fundamentally **event-driven**: it sets things in motion, cedes the CPU, and is re-entered by interrupts and traps. The **Interrupts & I/O** topic covers this in depth.

### Q14. Give concrete examples of these concepts across Linux, Windows, and macOS.

| Concept | Linux | Windows | macOS |
|---|---|---|---|
| Kernel architecture | monolithic + modules | hybrid (NT) | hybrid (XNU: Mach + BSD) |
| Kernel/user boundary | `SYSCALL`, syscall table | NT syscalls via `ntdll` | Mach traps + BSD syscalls |
| Process creation | `fork()` + `exec()` | `CreateProcess()` (combined) | `fork()`/`posix_spawn` + `exec()` |
| Executable format | ELF | PE (`.exe`) | Mach-O |
| First user process | `init` / `systemd` (PID 1) | `smss.exe` / `wininit` | `launchd` (PID 1) |
| Driver model | kernel modules | WDM/WDF drivers | kexts / DriverKit (user-space) |

The takeaways: all three enforce the same user/kernel split via traps; they differ in *packaging*. Windows fuses "create a process" into one call while Unix keeps the elegant `fork`+`exec` two-step. macOS's XNU literally stitches a Mach microkernel core to a BSD layer — a hybrid in the most literal sense. Being able to map one abstract concept onto three real systems is exactly the fluency interviewers want.

### Q15. Interview answer: "What is an operating system — walk me through kernel vs user mode and system calls."

A crisp, senior-sounding answer:

"An **operating system** is two things: a **resource manager** that shares the CPU, memory, and devices among programs, and an **abstraction layer** that turns raw hardware into clean concepts — processes, virtual memory, files, sockets.

To do that safely it relies on **dual-mode operation**. The CPU has a **mode bit**: the **kernel** runs in privileged mode where any instruction and all hardware are allowed; **applications** run in user mode where privileged instructions and direct device access are forbidden. That hardware-enforced boundary is what gives us isolation and stability — a buggy app can't scribble on the kernel or another process.

The one sanctioned way to cross from user to kernel is a **system call** — a *software trap*. When a program calls `read` or `fork`, a wrapper sets a syscall number and executes a trap instruction; the CPU flips to kernel mode, the kernel validates the arguments, does the privileged work, and returns to user mode. So a syscall is fundamentally different from a library call, which never leaves user mode.

Structurally the kernel can be **monolithic** (Linux — everything in one privileged address space, fast, big TCB) or **microkernel** (services in user space, safer, IPC overhead), with **hybrids** like Windows NT and macOS XNU in between."

That hits *what*, *why the boundary*, *how you cross it*, and *how kernels are built* — the four things the question is really testing.

### Q16. What's the difference between the kernel and the rest of the operating system?

The **kernel** is the privileged core that's always resident: scheduler, memory manager, syscall handlers, interrupt handlers, core drivers. It's the only part that runs in kernel mode.

The **rest of the OS** runs in user mode like any other program: the shell, system daemons/services, core utilities (`ls`, `cp`, `systemd` units, `launchd` agents), window server, package tools, and system libraries (libc). People loosely call the whole bundle "the OS," but only the kernel has hardware privilege.

Why it matters: (1) a crash in a user-space daemon doesn't panic the machine, but a kernel bug can; (2) this is exactly the line microkernels push — move as much as possible *out* of the kernel into restartable user-space servers to shrink the TCB. So "the OS" is kernel (privileged, trusted) + a large collar of unprivileged system software around it.

## Processes

### Summary

**What this topic covers**

The process — the OS's fundamental unit of *what's running*. This topic pins down the distinction between a **program** (a passive file on disk) and a **process** (an active execution with its own address space and state), then opens the hood: the **address-space layout** (text, data, BSS, heap, stack), the **Process Control Block** the kernel keeps per process, the **state machine** every process moves through, and the machinery of **context switching**. Then the Unix creation model — **fork()** (copy-on-write cloning), **exec()** (image replacement), **wait()** and exit status — and the lifecycle edge cases interviewers love: **zombies** and **orphans**. The 17 questions run from "what's the difference between a program and a process" up to "trace what the kernel does on a context switch" and "how many processes does `fork(); fork();` create."

**Mental model**

A process is a *program plus all the runtime state needed to execute it*: an address space, CPU registers, a program counter, open files, and kernel bookkeeping. The kernel gives every process the **illusion that it owns the whole machine** — its own private, contiguous-looking address space and its own CPU — and maintains that illusion by multiplexing real hardware underneath. The state that makes a process a process lives in two places: the **address space** (its memory — code, data, heap, stack) and the **PCB** (the kernel's per-process record — registers-when-not-running, state, scheduling info, page tables, open-file table). Running a process means the kernel loads its PCB's saved registers and page-table pointer into the CPU and lets it go; *pausing* it means the kernel saves that state back into the PCB and loads someone else's — that's a **context switch**, and it's pure overhead. Creation is the surprising part: `fork()` clones an existing process (returning *twice*), and `exec()` overwrites the clone's memory with a new program. That two-step is the whole Unix process model.

**Key terms**

- **Program vs process** — a program is a passive executable file; a process is that program *in execution*, with state.
- **Address space** — a process's view of memory: **text** (code), **data** (initialized globals), **BSS** (uninitialized globals), **heap** (grows up), **stack** (grows down), plus memory-mapped regions.
- **PCB (Process Control Block)** — the kernel's per-process struct: PID, state, saved registers + PC, page tables, scheduling info, open files, accounting.
- **Process state** — New, Ready, Running, Waiting/Blocked, Terminated.
- **Context switch** — saving one process's CPU state to its PCB and loading another's; overhead, no useful work.
- **fork()** — creates a child that's a (copy-on-write) copy of the parent; returns 0 in the child, the child's PID in the parent.
- **Copy-on-write (COW)** — parent and child share physical pages read-only after fork; a page is copied only when one writes it.
- **exec()** — replaces the current process's image with a new program (keeps the PID).
- **wait()** — parent blocks until a child exits and collects (reaps) its exit status.
- **Zombie** — a process that has terminated but whose parent hasn't `wait()`ed; its PCB lingers holding the exit status.
- **Orphan** — a process whose parent died first; it's re-parented to init (PID 1), which reaps it.
- **PID / init** — unique process identifier; PID 1 is the first process and ancestor/reaper of all others.

**Why interviewers ask this**

Processes are where OS theory meets everyday reality — shells, servers, containers all live and die by this model, so it's a fluency test. The junior/senior split shows fast. A junior says "fork makes a copy." A senior says "fork returns *twice* — 0 to the child, the child's PID to the parent — and thanks to copy-on-write the pages aren't actually duplicated until one side writes, which is why fork is cheap." The zombie/orphan questions are a favorite because they test whether you understand *who is responsible for cleanup* and what state the kernel is forced to retain. And "what's in a PCB" / "trace a context switch" reveal whether you know *why* switching is expensive — a foundation for the entire scheduling topic. Get the fork semantics and the zombie/orphan distinction crisp and you signal you've actually written systems code, not just read about it.

**Common confusions**

- "fork() returns once." It returns *twice* — once in each process, with different values — because after the call there are two processes.
- "fork() copies all the memory." Not with **copy-on-write** — pages are shared read-only and copied lazily only on the first write.
- "exec() creates a new process." No — `exec` *replaces* the current process's image; same PID, new program. Creation is `fork`'s job.
- "A zombie is still running." A zombie is *dead* — it holds no memory/CPU, just a PCB entry keeping its exit status until the parent reaps it.
- "Orphan and zombie are the same." Orphan = parent died first (re-parented to init, which reaps it). Zombie = child died first and parent hasn't reaped it (leak if the parent never does).
- "A process and a thread are the same unit." A process owns an address space; threads are execution contexts *within* it (next topic).

**What follows from this topic**

Processes set up almost everything downstream. Their **states** (Ready/Running/Waiting) are exactly what **CPU Scheduling** shuffles between, and **context switching** is the cost that scheduling tries to manage. Their **address spaces** are what **Memory Management** and **Virtual Memory** virtualize — and **copy-on-write**, introduced here via fork, is a core VM technique. Because separate processes have **isolated** address spaces, sharing data between them needs **IPC** (pipes, shared memory, signals) — its own topic. And the lighter-weight alternative to a whole process — an execution context that *shares* the address space — is the **Threads** topic, next.

### Q1. What is the difference between a program and a process?

A **program** is *passive*: an executable file sitting on disk (ELF, PE, Mach-O) — code and initial data, doing nothing.

A **process** is *active*: that program **in execution**. It has:

- an **address space** (its own memory: code, data, heap, stack),
- **CPU register state** including a program counter marking where it is,
- OS bookkeeping: a **PCB**, open files, a process ID, scheduling and accounting info.

Analogy: the program is a recipe; the process is the act of cooking it — and you can cook the same recipe multiple times at once. Run the same program twice and you get **two distinct processes** with separate address spaces and PIDs, executing independently. That one-to-many relationship (one program → many processes) is the crux of the distinction.

### Q2. Describe the memory layout of a process's address space.

```text
   high addresses
  +--------------------+
  |       stack        |  local vars, call frames, return
  |         |          |  addresses; GROWS DOWN
  |         v          |
  +--------------------+
  |                    |
  |   (unmapped gap /  |  <- mmap'd files & shared libs
  |    mmap region)    |     often live in here
  |                    |
  +--------------------+
  |         ^          |
  |         |          |
  |        heap        |  malloc/new; GROWS UP (via brk/mmap)
  +--------------------+
  |   BSS (uninit data)|  zero-initialized globals/statics
  +--------------------+
  |   data (init data) |  initialized globals/statics
  +--------------------+
  |   text (code)      |  the program instructions; read-only
  +--------------------+
   low addresses
```

- **Text** — machine code; read-only and often shared between processes running the same program.
- **Data** — globals/statics with explicit initial values.
- **BSS** — globals/statics that start at zero; takes no file space, just zeroed at load.
- **Heap** — dynamic allocation (`malloc`, `new`); grows **up** toward higher addresses.
- **Stack** — call frames, locals, return addresses; grows **down**. The gap between heap and stack is where they have room to grow (and where memory-mapped files/shared libraries sit).

Classic bug fuel: the stack and heap growing into each other, or a stack overflow from unbounded recursion.

### Q3. What is a Process Control Block, and what does it contain?

The **PCB** (called `task_struct` in Linux, `EPROCESS` in Windows) is the kernel's per-process record — the data structure that *is* the process from the OS's point of view. It holds everything needed to suspend and later resume the process:

- **PID** (and parent PID) — identity and lineage.
- **Process state** — New / Ready / Running / Waiting / Terminated.
- **CPU context** — saved **program counter** and **registers** (what's in the CPU when the process runs; saved here when it doesn't).
- **Memory-management info** — pointers to its **page tables** / base+limit, segment info.
- **Scheduling info** — priority, time slice, pointers linking it into ready/wait queues.
- **Open-file table / I/O status** — file descriptors, current working directory.
- **Accounting** — CPU time used, limits, PID owner/credentials.
- **IPC / signal state** — pending signals, handlers.

The PCB is the anchor of a **context switch**: to pause a process you dump the live CPU state *into* its PCB; to resume another you load *from* its PCB. The kernel keeps all PCBs in a process table.

### Q4. Walk through the process states and the transitions between them.

```text
             admit           dispatch
   [New] ------------> [Ready] ---------> [Running]
                          ^                  |  |
              I/O or      |                  |  | exit
              event done  |     preempt /    |  v
                          |     quantum      [Terminated]
                       [Waiting] <-----------+
                             (I/O or event wait)
```

- **New** — being created; PCB set up, not yet admitted to the ready queue.
- **Ready** — runnable, waiting only for a CPU. Lives in the **ready queue**.
- **Running** — currently executing on a CPU (at most one per core).
- **Waiting / Blocked** — cannot proceed until an event (I/O completion, lock, signal). Lives in a **wait queue** for that event.
- **Terminated** — finished; PCB lingers briefly until the parent reaps it (zombie window).

Key transitions: **dispatch** (Ready→Running, the scheduler picks it); **preempt** (Running→Ready, quantum expired or higher-priority arrived); **block** (Running→Waiting, it made a blocking call); **wake** (Waiting→Ready, its event fired — note it goes to *Ready*, not straight to Running). The crucial subtlety: a woken process is *ready*, not *running* — it still has to be scheduled.

### Q5. What is a context switch, and what exactly makes it expensive?

A **context switch** is the kernel swapping the CPU from one process to another: save the running process's CPU state into its PCB, load the next process's state from its PCB.

```text
save P1's registers + PC -> P1.PCB
switch page-table base register to P2's
flush/partly-flush the TLB
load P2's registers + PC <- P2.PCB
resume P2
```

It's **pure overhead** — no user work happens during it. The costs:

- **Direct**: saving/restoring registers, updating PCBs, running the scheduler. Microseconds.
- **Address-space switch**: loading the new page-table base register.
- **TLB flush**: the **TLB** caches virtual→physical translations for the *old* address space; switching processes invalidates most of it (mitigated by tagged TLBs/ASIDs). The new process then suffers a burst of TLB misses.
- **Cache pollution**: the CPU caches are warm for the old process; the new one starts cold and evicts the old data. This *indirect* cost often dwarfs the direct cost.

That's why switching *threads* of the same process is cheaper (same address space → no page-table swap, no TLB flush) and why excessive switching (thrashing, too-small quanta) tanks performance.

### Q6. Explain fork(). Why does it "return twice"?

`fork()` creates a new process — the **child** — that's a near-exact copy of the calling **parent**: same code, same open files, a copy of the address space. After it, **two** processes are executing the same code right after the `fork()` call. So the call returns *once in each*:

```c
pid_t pid = fork();
if (pid < 0) {
    // fork failed
} else if (pid == 0) {
    // CHILD: fork returned 0 here
} else {
    // PARENT: fork returned the child's PID here
}
```

- In the **child**, `fork()` returns **0**.
- In the **parent**, it returns the **child's PID** (a positive number).
- On failure, it returns **-1** in the parent (no child made).

That different return value is the *only* way the two identical processes tell themselves apart and branch into different behavior. "Returns twice" just means: one call, but afterward there are two processes each seeing a return.

### Q7. What is copy-on-write, and how does it make fork() efficient?

Naively, `fork()` would copy the parent's entire address space into the child — potentially gigabytes — usually wasted, since the child often calls `exec()` immediately and throws it all away. **Copy-on-write (COW)** avoids that:

```text
After fork(): parent and child page tables both point at the
SAME physical pages, all marked READ-ONLY.

Either one READS a page  -> fine, shared, no copy.
Either one WRITES a page  -> page fault -> kernel copies THAT
                             ONE page, gives the writer a
                             private writable copy, both
                             continue.
```

So no memory is actually duplicated at fork time; pages are copied lazily, one at a time, and only when actually modified. Pages that are never written (like the read-only **text** segment) are shared forever. This makes `fork()` cheap and near-instant, and makes the extremely common **fork-then-exec** pattern essentially free — `exec` replaces the image before most pages are ever touched. COW is also a general VM technique (used for efficient snapshots and memory dedup), previewed here.

### Q8. Explain exec(). How does it differ from fork()?

`exec()` **replaces** the current process's memory image with a *new program*. It does **not** create a process — same PID, same PCB, but the text/data/heap/stack are wiped and reinitialized from the new executable, and (on success) `exec` *never returns* because the old code no longer exists.

| | fork() | exec() |
|---|---|---|
| Creates a new process? | Yes (child) | No (same process) |
| PID | new for child | unchanged |
| Address space | copy of parent (COW) | replaced with new program |
| Returns | twice (0 / child PID) | never (on success) |
| Program that runs | same as parent | the new executable |

They're complementary: `fork` gives you a *new process running the old program*; `exec` gives you the *old process running a new program*. Compose them — `fork` then `exec` in the child — to get a *new process running a new program*, which is exactly how you launch a command (next question). Unix deliberately splits them so the child can adjust its environment (redirect files, change user) *between* the fork and the exec.

### Q9. Explain the fork-exec pattern: how does a shell run a command?

When you type `ls -l` in a shell, the shell does **fork + exec + wait**:

```c
pid_t pid = fork();          // 1. clone the shell
if (pid == 0) {
    // CHILD (still the shell's code, momentarily)
    // 2. optionally set up: redirect stdin/stdout, etc.
    execvp("ls", argv);      // 3. become `ls` — image replaced
    // only reached if exec FAILED
    perror("exec"); _exit(1);
} else {
    // PARENT (the shell)
    waitpid(pid, &status, 0);// 4. wait for `ls` to finish
    // 5. shell reads the exit status, prints the prompt again
}
```

The elegance: the **gap between fork and exec** is where the child, still running the shell's code but as a separate process, sets up the environment the new program should inherit — redirecting `>` to a file, wiring up pipes `|`, changing directory or user. *Then* it `exec`s. The parent shell `wait()`s so it knows when the command finished and with what exit code. This fork/exec/wait triad is the beating heart of every Unix shell and process launcher.

### Q10. What do wait() and exit status do, and why are they necessary?

When a process finishes, it calls `exit(status)` (or returns from `main`), passing a small integer — the **exit status** (0 = success by convention, non-zero = some error). But the process can't fully disappear yet: *someone needs to know it finished and why*. That's **wait()**:

- The **parent** calls `wait()` / `waitpid()` to **block until a child terminates**, then receives the child's exit status (and how it died — normal exit, or killed by which signal).
- Until the parent waits, the kernel **must retain a minimal record** of the dead child (its PID + exit status) so the status isn't lost. That lingering record is the **zombie**.
- `wait()` **reaps** the zombie: collects the status and lets the kernel free the last of the PCB.

So `wait()` serves two purposes: **synchronization** (the parent learns the child is done) and **cleanup** (reaping releases the zombie). A shell uses the status to decide `&&` / `||` chaining; a supervisor uses it to decide whether to restart a crashed worker.

### Q11. What is a zombie process? How is one created and cleaned up?

A **zombie** (defunct process) is a process that has **terminated but not yet been reaped** by its parent. It's already dead — it holds *no* memory, *no* CPU, runs *no* code — but the kernel keeps its **PCB entry** alive to preserve its **exit status** until the parent calls `wait()`.

```text
child exits  -> becomes ZOMBIE (PCB kept, status stored)
parent wait()-> status collected, PCB freed, zombie gone
```

- **Created** whenever a child exits before its parent has `wait()`ed for it. A brief zombie window is *normal*.
- **Problem** when a parent *never* waits — the zombies accumulate. Each holds a PID; enough of them exhaust the PID table and you can't fork new processes. It's a resource leak in the parent's logic.
- **Cleanup**: the parent must `wait()`/`waitpid()` (often triggered by handling the `SIGCHLD` signal the kernel sends when a child dies). If the *parent itself* dies, the zombie is re-parented to init (PID 1), which reaps it — so zombies from a dead parent resolve automatically.

You can't `kill` a zombie — it's already dead. You fix the parent (or kill the parent so init adopts and reaps the child).

### Q12. What is an orphan process, and what happens to it?

An **orphan** is a process whose **parent terminated first**, while the child is still running. The child is now parentless — but every process needs a parent to eventually reap it.

The OS handles this by **re-parenting**: the orphan is adopted by **init (PID 1)** (or a subreaper). When the orphan eventually exits, init `wait()`s for it and reaps it, so it never becomes a stuck zombie.

Contrast with zombies:

| | Zombie | Orphan |
|---|---|---|
| Who died? | the **child** (parent still alive) | the **parent** (child still alive) |
| State | dead, awaiting reaping | **alive and running** |
| Risk | leaks if parent never reaps | none — init adopts & reaps it |

Orphans are usually benign (init cleans up), and are sometimes *created deliberately*: **daemons** intentionally orphan themselves (fork, let the parent exit) so they get adopted by init and detach from the launching terminal.

### Q13. What is the process tree, and what is special about PID 1?

Processes form a **tree**: every process (except the first) has exactly one parent — the process that `fork()`ed it — and can have many children. The whole tree is rooted at **PID 1**, the first user-space process the kernel starts at boot (`init`, `systemd`, or `launchd`).

PID 1 is special:

- It's the **ancestor of every other process** — the root of the tree.
- It's the **universal reaper**: any process orphaned by a dead parent is re-parented to PID 1, which `wait()`s for it, preventing permanent zombies.
- It typically **launches and supervises** the rest of user space (services, login sessions).
- If PID 1 dies, the kernel **panics** — the system can't run without it.

In containers this matters practically: the container's PID 1 must reap adopted orphans, or zombies pile up inside the container — a common Docker gotcha solved by a proper init (like `tini`).

### Q14. How does a process terminate? What resources get cleaned up?

A process ends in one of a few ways:

- **Normal exit** — returns from `main` or calls `exit(status)`.
- **Killed by a signal** — e.g. `SIGKILL`, `SIGSEGV` (segfault), `SIGTERM` unhandled.
- **Fatal error** — illegal instruction, unrecoverable fault.
- Some systems allow a parent to terminate children (cascading termination).

On termination the kernel:

1. Closes the process's **open files**, releases locks, frees its **address space** (all pages), and releases most kernel resources it held.
2. **Retains a minimal PCB** with the PID and exit status → the process is now a **zombie**.
3. Sends **`SIGCHLD`** to the parent to notify it.
4. When the parent **`wait()`s**, the last of the PCB is freed and the PID is recycled. (If the parent already died, init reaps it.)

The nuance interviewers want: termination is a *two-phase* release — the bulk of resources are freed immediately, but the **PCB/exit status persists** until reaped. That gap is deliberate: it's how the parent learns the outcome.

### Q15. Classic puzzle: how many processes does `fork(); fork();` create?

Each `fork()` **doubles** the number of processes. Start with 1 (the original):

```text
start:            1 process   (P)
after 1st fork(): 2 processes (P, and child A)
after 2nd fork(): 4 processes (all existing processes fork)
```

So **4 processes total exist** at the end — the original plus **3 new children**. The trick: after the first `fork()` there are *two* processes, and *both* execute the second `fork()`, each producing a child → 2 becomes 4.

General rule: **n** consecutive `fork()` calls yield **2ⁿ** processes total (2ⁿ − 1 new children). Three forks → 8 processes; a loop of forks is how a **fork bomb** works — `while(1) fork();` doubles processes exponentially until the PID table and memory are exhausted and the machine grinds to a halt (which is why systems cap per-user process counts). Watch for the variant where a `fork()` is inside an `if` on the return value — then only one branch forks and the count is lower; draw the tree.

### Q16. Why do separate processes have isolated address spaces, and how do they communicate?

Each process gets its **own virtual address space**, and the kernel (via the MMU and page tables) ensures process A's addresses map to *different physical memory* than process B's. Address `0x400000` in A and in B point to different physical frames. This **isolation** is a core protection guarantee: a bug or exploit in one process **cannot read or corrupt another's memory**, and a crash in one doesn't take down the others. It's the whole reason we trust running untrusted programs side by side.

But isolation means processes *can't* just share a variable. To cooperate they need explicit **Inter-Process Communication (IPC)**:

- **Pipes / FIFOs** — byte streams between related (or named) processes.
- **Shared memory** — the kernel maps the *same* physical pages into both address spaces; fastest, but you must synchronize access yourself.
- **Message queues** — structured messages via the kernel.
- **Sockets** — works across machines too.
- **Signals** — asynchronous notifications.

The trade-off theme: **processes** buy strong isolation at the cost of needing IPC to share; **threads** (next topic) share an address space directly — cheaper communication, weaker isolation. IPC is its own topic later.

### Q17. Interview answer: "What is a process, what's in a PCB, and explain fork."

A tight answer stitching the topic together:

"A **process** is a *program in execution* — an active entity with its own **address space** (text, data, heap, stack), CPU register state including a program counter, and OS bookkeeping. The distinction from a program matters: the program is the passive file on disk; running it twice gives two independent processes with separate memory and PIDs.

The kernel tracks each process with a **Process Control Block** — its per-process record. The PCB holds the **PID**, the **state** (Ready/Running/Waiting), the **saved registers and program counter** for when it's not on the CPU, **memory info** like page-table pointers, **scheduling info** (priority, time slice), the **open-file table**, and accounting. The PCB is what a **context switch** saves and restores.

**fork()** creates a new process by cloning the caller. Its signature move is that it **returns twice** — 0 in the child, the child's PID in the parent — so the two otherwise-identical processes can branch. Crucially it uses **copy-on-write**: parent and child share physical pages read-only, and a page is only actually duplicated when one of them writes it, so fork is cheap. You usually pair it with **exec()**, which replaces the child's image with a new program — that fork-then-exec pattern is how a shell runs a command. And if the parent doesn't **wait()** for the child, the dead child lingers as a **zombie**; if the parent dies first, the child becomes an **orphan** adopted by init."

That covers *what a process is*, *what the kernel stores*, and *the fork/exec/wait/zombie lifecycle* — the full arc of the question.

## Threads

### Summary

**What this topic covers**

The thread — a lighter-weight unit of execution *inside* a process, and the basic unit the CPU scheduler actually dispatches. The whole topic pivots on one idea: **what threads share versus what they keep private**. Threads of a process share the address space (code, heap, globals, open files) but each has its *own* stack, registers, and program counter. That single share/private split explains both why threads are cheap and fast *and* why they're a minefield of race conditions. From there the topic covers **threads vs processes** (a full comparison), the **benefits and costs** of threads, **user-level vs kernel-level** threads and the **M:N threading models**, practical machinery like **thread pools** and **thread-local storage**, and the sharp modern caveats — the **GIL**, green threads/coroutines, and the crucial "why did *adding* threads make my program *slower*?" The 16 questions run from "what's the difference between a process and a thread" to senior traps about parallelism, blocking, and synchronization overhead.

**Mental model**

Think of a process as a house and threads as the people living in it. They **share** the house — the rooms, the fridge, the furniture (the address space: code, heap, globals, open files). But each person carries their **own** backpack — their private stack (local variables, call frames), registers, and program counter — that no one else touches. That's the entire model. Because they share the house, threads can pass data just by writing to shared memory (fast, no IPC) and are cheap to create and switch between (no address-space swap, no TLB flush). Because they share the house, they also step on each other: two threads writing the same global without coordination is a **race condition**, and *one* thread corrupting shared state or crashing can bring down *everyone* — the whole process dies. So a thread is the unit of *scheduling and parallelism*; the process remains the unit of *resources and isolation*. Every benefit and every bug of threading falls out of "shared address space, private stack."

**Key terms**

- **Thread** — a lightweight execution context within a process; the basic unit of CPU scheduling.
- **Shared (per process)** — address space: **code/text, heap, global data, open files**, and other process resources. All threads see the same copy.
- **Private (per thread)** — **stack**, **registers**, **program counter**, and **thread-local storage (TLS)**.
- **Thread vs process** — thread = execution context sharing memory; process = an isolated address space owning threads.
- **User-level thread** — managed by a user-space library; the kernel sees one process. Fast, but a blocking syscall blocks all and no true multicore parallelism.
- **Kernel-level thread** — scheduled by the OS; true parallelism and independent blocking, but heavier to create/switch.
- **Threading models** — **many-to-one** (M user threads : 1 kernel), **one-to-one** (each user thread ↔ a kernel thread; Linux/Windows today), **many-to-many (M:N)** (M user threads multiplexed over N kernel threads).
- **Thread pool** — a reusable, fixed set of worker threads that pull tasks from a queue; avoids create/destroy churn and bounds concurrency.
- **Thread-local storage (TLS)** — per-thread variables that look global but hold a distinct value in each thread.
- **Context switch (threads)** — cheaper than a process switch: same address space, so no page-table swap and no TLB flush.
- **GIL (Global Interpreter Lock)** — a runtime lock (e.g. CPython) letting only one thread execute bytecode at a time, capping CPU-bound thread parallelism.
- **Green threads / coroutines / fibers** — user-space-scheduled tasks, cheaper than OS threads but not OS-scheduled.

**Why interviewers ask this**

"Process vs thread" is possibly the single most common systems interview question, and "what do threads share" is the follow-up that separates memorizers from understanders. A junior lists "threads are lightweight." A senior explains the *share/private split* and immediately derives the consequences: shared heap → cheap communication *and* race conditions; private stack → each thread has its own locals; shared fate → one thread's crash kills the process. Interviewers push into **user vs kernel threads** and the **GIL** to see if you understand *when threads actually give you parallelism* versus when they just give you concurrency — the difference between speeding a program up and merely restructuring it. The killer senior question is "why does adding threads sometimes make things *slower*?" — testing whether you understand lock contention, context-switch overhead, and the GIL. Nail the share/private model and you can reason your way through all of it.

**Common confusions**

- "Threads have their own memory." Only their **stack, registers, and PC** are private — the **heap, globals, and code are shared**. That sharing is the whole point (and the whole danger).
- "More threads = more speed." Only up to the core count, and only if the work is parallelizable and low-contention. Past that, context-switch and lock overhead make it *slower*.
- "Threads give parallelism in any language." Not with a **GIL** (CPython, Ruby MRI) — CPU-bound threads run one at a time; you get concurrency, not parallelism.
- "User-level threads use multiple cores." Pure user threads run inside one kernel-scheduled entity → no true multicore parallelism, and one blocking syscall blocks them all.
- "A thread crashing just kills that thread." A segfault or unhandled fatal error in one thread typically **takes down the whole process** — shared address space, shared fate.
- "Threads always beat processes." Threads trade isolation for sharing; for fault isolation or security boundaries, separate **processes** are the right tool.

**What follows from this topic**

Threads are the entities the **CPU Scheduling** topic actually schedules onto cores (a "process on the CPU" is really one of its threads). Because threads **share** mutable state, they create the exact problem the **Synchronization** topic solves — race conditions, critical sections, mutexes, semaphores — and the **Deadlock** topic warns about (two threads each holding a lock the other wants). The cheapness of thread context switches (no page-table swap) contrasts with the process switch cost from the previous topic. And the share-vs-isolate trade-off links back to **Processes** and **IPC**: threads share memory directly and skip IPC, at the cost of isolation. Understanding *what threads share* is the prerequisite for every concurrency topic that follows.

### Q1. What is a thread, and how does it relate to a process?

A **thread** is a lightweight unit of execution *within* a process — a single sequential flow of control, and the basic unit the CPU scheduler dispatches. A process contains **one or more** threads; a traditional single-threaded process has exactly one.

The relationship: the **process** owns the resources — the address space, open files, the whole "container" — and **threads** are the active workers running *inside* that container, each executing code and each independently schedulable onto a CPU. Multiple threads in one process run concurrently (and, on multiple cores, truly in parallel), all sharing the process's memory.

Put differently: the process is the unit of **resource ownership and isolation**; the thread is the unit of **execution and scheduling**. When people say "the OS schedules a process onto the CPU," what's really scheduled is one of its *threads*. That split — resources in the process, execution in the thread — is why threads exist: you can have multiple flows of control sharing one set of resources without the cost of multiple processes.

### Q2. What do threads share, and what is private to each thread? (The key question.)

This is the concept the whole topic hangs on:

```text
   Process
  +-------------------------------------------+
  |  SHARED by all threads:                   |
  |    - text / code segment                  |
  |    - heap (malloc/new)                     |
  |    - global & static data                 |
  |    - open file descriptors, cwd           |
  |    - process-wide signal handlers         |
  |                                           |
  |   Thread 1        Thread 2      Thread 3   |
  |  +---------+     +---------+   +---------+  |
  |  | stack   |     | stack   |   | stack   |  |  <- PRIVATE
  |  | registers|    | registers|  | registers| |     per thread
  |  | PC      |     | PC      |   | PC      |  |
  |  | TLS     |     | TLS     |   | TLS     |  |
  |  +---------+     +---------+   +---------+  |
  +-------------------------------------------+
```

**Shared across all threads of a process:** the **address space** — code, **heap**, global/static variables — plus **open files**, working directory, and other process resources. Any thread can read/write the same heap object or global.

**Private to each thread:** its own **stack** (local variables, function call frames, return addresses), its **registers**, its **program counter**, and its **thread-local storage**.

Every property of threads derives from this: shared heap/globals → cheap direct communication *and* the possibility of **race conditions**; private stack → each thread has independent locals and call state. If you remember one thing about threads, remember this split.

### Q3. Compare threads and processes directly.

| | Process | Thread |
|---|---|---|
| Address space | own, **isolated** | **shared** with peers |
| Memory sharing | needs IPC | direct (shared heap/globals) |
| Creation cost | expensive (new address space, page tables) | cheap |
| Context-switch cost | high (page-table swap, TLB flush) | low (same address space) |
| Communication | IPC: pipes, shared memory, sockets | just read/write shared memory |
| Fault isolation | strong — one crash doesn't hit others | weak — one thread's crash kills the process |
| Private state | everything | stack, registers, PC, TLS |
| Owns resources | yes (files, memory) | shares the process's |

**When to use processes:** you need **isolation** — a fault or security boundary (browser tabs as separate processes, so one page crashing doesn't kill the browser; a compromised worker can't read a sibling's memory).

**When to use threads:** you need **cheap, tightly-coupled concurrency** sharing lots of data — a web server handling many requests over a shared cache, parallel computation over a shared array.

The one-line summary: **threads trade isolation for sharing.** You get cheaper creation/switching and effortless data sharing, and you pay with fragility (shared fate) and the burden of synchronization.

### Q4. What are the benefits of using threads?

- **Responsiveness** — a multithreaded app can keep responding on one thread (e.g. the UI) while another does slow work (a network fetch, a long computation). The app doesn't freeze.
- **Resource sharing** — threads share the process's memory by default, so passing data between them is free (no IPC setup, no copying). Great for workloads over shared state.
- **Economy** — creating and switching threads is far cheaper than processes: no new address space to build, no page-table swap or TLB flush on a switch. You can have thousands of threads where thousands of processes would be too heavy.
- **Scalability / parallelism** — on a multicore CPU, threads of one process can run **truly in parallel** on different cores, so a single application can use all the hardware. This is the big one: threads are how one program exploits multiple cores.

The through-line is **shared address space**: it's what makes sharing free, creation cheap, and switching light. The catch — those same benefits come bundled with the need to synchronize access to that shared state, which is the cost (next question).

### Q5. What are the costs and risks of threads?

The flip side of sharing:

- **Synchronization complexity** — shared mutable state means you must coordinate access with locks, condition variables, atomics. This is genuinely hard: forget to lock and you get a **race condition** (corrupt data, heisenbugs); lock wrongly and you get **deadlock** or destroyed performance.
- **Race conditions** — two threads touching the same data with at least one writing, without ordering, produces nondeterministic, hard-to-reproduce bugs. Entire topics (Synchronization, Deadlock) exist to manage this.
- **Weak fault isolation (shared fate)** — because threads share one address space, a bug in *one* thread (a wild pointer, a segfault, an unhandled fatal error) can corrupt shared memory or **crash the entire process**, taking all threads with it. Processes wouldn't have this.
- **Harder to reason about and debug** — nondeterministic interleavings mean bugs appear only under specific timing; testing is much harder.
- **Overhead at scale** — too many threads → context-switch churn and lock contention that can make things *slower*, not faster.

So threads aren't free concurrency — they're a trade: you gain cheap sharing and parallelism, you take on the entire burden of safe concurrent access.

### Q6. Explain user-level threads vs kernel-level threads.

**Kernel-level threads** are created and scheduled by the OS. The kernel knows about each one and can put each on a different core.

**User-level threads** are created and scheduled by a **user-space library**, invisible to the kernel — the kernel sees just one process (one schedulable entity).

| | User-level threads | Kernel-level threads |
|---|---|---|
| Managed by | user-space library | the OS kernel |
| Kernel aware of them? | no | yes |
| Create / switch cost | very cheap (no syscall) | heavier (kernel involvement) |
| True multicore parallelism | **no** (one kernel entity) | **yes** |
| A blocking syscall... | **blocks all** threads in the process | blocks only that thread |
| Scheduling | fast, custom, in-process | OS scheduler |

The two fatal limitations of *pure* user threads: (1) since the kernel schedules the whole process as one unit, user threads **can't run on multiple cores in parallel**; and (2) if one user thread makes a **blocking system call**, the kernel blocks the *entire process* — every other user thread stalls, because the kernel doesn't know there are others to run. Kernel threads fix both (true parallelism, independent blocking) but cost more per thread. Modern systems mostly use kernel threads (one-to-one), sometimes with user-space scheduling on top (M:N, or language runtimes' green threads) to get the best of both.

### Q7. Describe the many-to-one, one-to-one, and many-to-many threading models.

These map *user* threads to *kernel* threads:

```text
many-to-one (M:1)      one-to-one (1:1)       many-to-many (M:N)
 U U U U               U   U   U               U U U U U
  \|/ /                |   |   |                 \ | / |
   K                   K   K   K                 K   K   K
(1 kernel thread)   (1 kernel each)         (M user over N kernel)
```

- **Many-to-one** — many user threads multiplexed onto **one** kernel thread. Fast switching, but no multicore parallelism, and one blocking syscall blocks all. Mostly historical (early Java "green threads").
- **One-to-one** — each user thread maps to its **own** kernel thread. True parallelism, independent blocking — this is what **Linux (NPTL), Windows, and macOS** use today. Cost: each thread consumes kernel resources, so very large numbers get expensive.
- **Many-to-many (M:N)** — multiplex **M** user threads over **N** kernel threads (N ≤ M, often ≈ core count). Aims for the best of both: cheap user threads *and* real parallelism, with the runtime scheduling user threads onto a pool of kernel threads. Complex to implement; used by language runtimes (Go's goroutines are essentially M:N).

The practical takeaway: mainstream OS threads are **1:1**; **M:N** lives in language runtimes (Go, older Java, Erlang) to make millions of lightweight tasks feasible.

### Q8. What is a thread pool, and why use one?

A **thread pool** is a fixed (or bounded) set of pre-created worker threads that sit waiting, pulling **tasks** off a shared queue and executing them, then going back for the next:

```text
tasks -> [ queue ] -> worker1
                   -> worker2   (fixed set of N workers,
                   -> worker3    reused across many tasks)
                   -> worker4
```

Why not just spawn a thread per task?

- **Avoid create/destroy overhead** — spinning up a thread per request costs time and memory; a pool **reuses** threads across thousands of tasks, paying the creation cost once.
- **Bound concurrency** — an unbounded thread-per-task model lets a spike create tens of thousands of threads, exhausting memory and drowning in context-switch overhead. A pool caps concurrency at N, providing natural back-pressure (excess tasks queue).
- **Tunability** — you can size the pool to the hardware (≈ core count for CPU-bound work, higher for I/O-bound) and manage the queue.

This is the standard structure for servers and parallel work: a web server with a pool of workers handling requests, or a `ForkJoinPool` / `ThreadPoolExecutor` chewing through a task queue. The trade-off vs. thread-per-request: a pool bounds resource use and reuses threads, at the cost of tasks possibly queueing when all workers are busy.

### Q9. What is thread-local storage (TLS)?

**Thread-local storage** lets you declare a variable that *looks* global but holds a **separate value in each thread**. Every thread reading the "same" TLS variable sees its own private copy; writes by one thread don't affect another's.

```c
__thread int request_id;   // C/GCC: each thread's own copy
// thread_local in C++/C11; ThreadLocal<T> in Java
```

Why it's useful: it gives each thread private per-thread state **without** threading it through every function call and **without** locking — because there's no sharing, there's no race. Common uses: a per-thread `errno`, per-thread scratch buffers or memory arenas, a per-request context in a server where each worker thread handles one request at a time, per-thread random-number-generator state.

Conceptually TLS is a middle ground: globals are shared (need locks), locals are per-*call*, and TLS is per-*thread* — living for the thread's lifetime, visible across its call stack, invisible to other threads. It sidesteps synchronization precisely by not sharing.

### Q10. Why is a thread context switch cheaper than a process context switch?

Both save/restore CPU registers and the program counter. The difference is **the address space**:

- Switching between **processes** means switching **address spaces**: load a new page-table base register, and **flush the TLB** (the cache of virtual→physical translations, which belonged to the old process). The new process then eats a burst of TLB misses, and the CPU caches are cold for it. That indirect cost is the expensive part.
- Switching between **threads of the same process** keeps the **same address space** — same page tables, same TLB entries, same warm caches. **No page-table swap, no TLB flush.** You just swap the private per-thread state (registers, PC, stack pointer).

```text
process switch:  save regs + swap page tables + FLUSH TLB + cold cache
thread switch:   save regs                    (same page tables/TLB/cache)
```

So a same-process thread switch avoids the most costly parts of a process switch. (Switching between threads of *different* processes is still a full process switch — the cheapness only applies within one address space.) This is a big reason threads are the go-to for fine-grained concurrency.

### Q11. What is the GIL, and why does it limit thread parallelism in some languages?

A **Global Interpreter Lock (GIL)** is a single lock in a language runtime that permits **only one thread to execute the interpreter's bytecode at a time**. CPython and Ruby MRI famously have one. Even on a 16-core machine with 16 threads, **only one runs Python bytecode at any instant** — the others wait for the GIL.

Why it exists: it makes the interpreter's internals (reference-count-based memory management, built-in data structures) thread-safe *cheaply and simply*, without fine-grained locking everywhere.

The consequence: for **CPU-bound** work, threads in CPython give you **concurrency but not parallelism** — they can't speed up computation because they can't run bytecode simultaneously. Adding threads to a CPU-bound Python program yields ~no speedup (sometimes a slowdown from GIL contention).

The nuance interviewers want: the GIL is **released during blocking I/O** (and inside C extensions like NumPy). So threads *do* help **I/O-bound** Python — while one thread waits on the network, another runs. The escape hatches for CPU-bound parallelism: use **multiple processes** (`multiprocessing`, no shared GIL), a C extension that releases the GIL, or a GIL-free build. (This is why "just add threads" is language-dependent advice.)

### Q12. What are green threads, fibers, and coroutines, and how do they differ from OS threads?

These are all **user-space-scheduled** units of execution — lightweight tasks the *language runtime* (not the OS kernel) schedules, as opposed to OS threads the kernel schedules.

- **Green threads** — threads implemented and scheduled entirely in user space (the runtime), invisible to the kernel. Very cheap; historically many-to-one so no true parallelism, though modern versions (Go's goroutines) multiplex over kernel threads (M:N) to get parallelism too.
- **Fibers** — cooperatively-scheduled user threads: a fiber runs until it *explicitly yields*, then another runs. No preemption, so switches are cheap and predictable.
- **Coroutines** — functions that can **suspend and resume**, yielding control at `await`/`yield` points. The basis of `async/await` (Python asyncio, JS, Rust, Kotlin). A single OS thread runs an **event loop** that drives thousands of coroutines, switching whenever one awaits I/O.

How they differ from OS threads:

| | OS thread | Green thread / coroutine |
|---|---|---|
| Scheduled by | kernel | language runtime (user space) |
| Cost | KBs–MBs stack, syscall to switch | tiny; switch is a function return |
| How many feasible | thousands | millions |
| Preemption | yes (timer) | usually cooperative (yield/await) |
| True parallelism | yes | only if mapped onto multiple kernel threads |

The appeal: you can run **millions** of coroutines/goroutines where OS threads would exhaust memory — ideal for massively concurrent I/O (100k open connections). The catch: cooperative ones need explicit yield points, and a single blocking call that *doesn't* yield can stall the whole event loop.

### Q13. When do threads NOT help — or even make a program slower?

Threads are not free speed. They fail to help (or backfire) when:

- **The work is CPU-bound under a GIL** — CPython threads can't run bytecode in parallel, so a CPU-bound task sees no speedup and often a slowdown from GIL contention. (Use processes instead.)
- **Synchronization overhead dominates** — if threads spend more time fighting over a shared lock than doing work, adding threads increases **contention**: they serialize on the lock *and* pay context-switch costs. You can add threads and watch throughput *drop*.
- **Too many threads for the cores** — beyond ~core-count for CPU-bound work, extra threads just add context-switch overhead and cache thrashing with no parallelism gain.
- **False sharing** — threads writing different variables that happen to sit on the **same cache line** ping-pong that line between cores' caches, silently killing performance even without logical sharing.
- **The task is inherently sequential** — Amdahl's Law: if 90% of the work must be serial, no number of threads gets you past a ~10% speedup.

The senior insight behind "why did adding threads slow it down?": **more threads ≠ more parallelism.** Parallelism is bounded by cores *and* by how much of the work is genuinely independent; contention, switching, and cache effects can make the parallel version slower than the serial one. Measure before threading.

### Q14. How do web servers use threads: thread-per-request vs thread pool vs event loop?

Three classic concurrency architectures for handling many simultaneous connections:

- **Thread-per-request** — spawn a new thread for every incoming request; it does its work and dies. **Simple** and each request gets a dedicated thread, but a traffic spike creates thousands of threads → memory blowout and context-switch meltdown. No back-pressure. Rarely used raw at scale.
- **Thread pool** — a fixed set of worker threads pull requests from a queue (Q8). **Bounds concurrency**, reuses threads, gives back-pressure (excess requests queue). The workhorse model for CPU-bound-ish request handling (traditional Java/servlet servers). Cost: if all workers block on slow I/O, new requests wait.
- **Event loop (async, single/few threads)** — one thread runs an event loop driving thousands of **non-blocking** I/O operations via coroutines/callbacks (Node.js, nginx, Python asyncio). Superb for **I/O-bound** workloads with huge connection counts (10k+ idle connections cost almost nothing). Cost: a single **CPU-bound** or **blocking** call stalls the whole loop, and the programming model is trickier.

The rule of thumb: **thread pool** for balanced/CPU-bound work needing simple blocking code; **event loop** for massively concurrent **I/O-bound** work. Many modern servers combine them: an event loop per core (a small pool of event-loop threads) to use all cores while staying async.

### Q15. Spot the concurrency issue: two threads incrementing a shared counter.

```c
int counter = 0;          // shared global (shared heap/data)

void *worker(void *arg) {
    for (int i = 0; i < 1000000; i++)
        counter++;        // NOT atomic!
    return NULL;
}
// start two threads running worker(), join both.
// Expected: 2,000,000.  Actual: usually LESS.
```

**The bug:** `counter++` is not one operation — it's **read, increment, write** (load, add, store). With two threads interleaving:

```text
Thread A: read counter (5)
Thread B: read counter (5)
Thread A: add 1 -> 6, write 6
Thread B: add 1 -> 6, write 6   <- one increment LOST
```

Both read 5, both write 6 — two increments produce +1. This is a classic **race condition** on shared state (private stacks, but a **shared** global — the share/private split in action). Because the threads share the address space, they share `counter`, and unsynchronized read-modify-write races.

**The fix:** make the update **atomic / mutually exclusive** — a **mutex** around `counter++`, or an atomic instruction (`atomic_fetch_add` / a CAS loop). This is exactly the **critical section** problem the Synchronization topic formalizes. The lesson: any time two threads touch shared data with at least one writing and no ordering, you have a bug — the whole reason concurrency needs synchronization primitives.

### Q16. Interview answer: "Process vs thread, what do threads share, and user vs kernel threads."

A complete answer pulling the topic together:

"A **process** is an isolated address space that owns resources; a **thread** is a unit of execution *inside* a process and the thing the scheduler actually dispatches. A process has one or more threads.

The key is **what threads share versus what's private**. Threads of a process **share the address space** — the code, the **heap**, global variables, and open files — so they can communicate just by reading and writing shared memory, no IPC needed. What's **private** to each thread is its **stack, registers, and program counter**, plus thread-local storage. That share/private split explains everything: shared heap makes threads cheap to create, cheap to switch (no page-table swap or TLB flush), and easy to share data — but it also means **race conditions** are possible and one thread crashing can take down the **whole process**, because they share fate. Processes trade that: strong isolation, at the cost of expensive creation and needing IPC to share.

On **user vs kernel threads**: user-level threads are managed by a library and invisible to the kernel — very cheap, but the kernel schedules the process as one unit, so they can't use multiple cores and a single blocking syscall blocks them all. Kernel-level threads are scheduled by the OS, giving true multicore parallelism and independent blocking, at higher per-thread cost. Modern systems (Linux, Windows, macOS) use **one-to-one** kernel threads; language runtimes sometimes layer **M:N** user scheduling (Go's goroutines) on top for millions of cheap tasks."

That delivers the comparison, the share/private model that's the heart of the topic, and the user/kernel distinction with its real-world mapping.
## CPU Scheduling

### Summary

**What this topic covers**

How the OS decides which of the many *ready* processes/threads gets the one (or few) physical CPUs, and for how long. A modern box has dozens of runnable threads and a handful of cores, so the CPU is time-multiplexed: the scheduler picks, the dispatcher switches, and the illusion of concurrency emerges. This topic spans the **scheduler layers** (long/short/medium-term), the **dispatcher**, **preemptive vs non-preemptive** policy, the **metrics** we optimise (utilisation, throughput, turnaround, waiting, response), the **classic algorithms** (FCFS, SJF/SRTF, Round-Robin, Priority, Multilevel Queue, MLFQ), the **cost of a context switch**, **multicore** concerns (affinity, load balancing, per-CPU run queues), and what real kernels do (Linux **CFS**, now **EEVDF**). The 17 questions run from "how does Round-Robin work" and Gantt-chart arithmetic up to "why favour I/O-bound jobs" and "how does CFS actually pick the next task".

**Mental model**

Picture a single cashier (the CPU) and a queue of customers (ready threads). Scheduling is the queue discipline. Non-preemptive = each customer is served until they *choose* to leave (or go wait for something, i.e. block on I/O). Preemptive = a timer buzzer forces the cashier to rotate customers even mid-transaction. Every rotation has a cost — the cashier must put down the current customer's paperwork and pick up the next (the **context switch**: save registers/PC, swap memory maps, reload). That cost is pure overhead: no user work happens during it, which is why the time **quantum** can't be too small. The deep tension is throughput vs responsiveness: batch a few big jobs back-to-back and you finish the most work per hour, but interactive users hate the lag; slice finely and everyone feels snappy but overhead eats you. Real schedulers (MLFQ, CFS) resolve this by *watching behaviour* — jobs that yield quickly to wait for I/O are treated as interactive and boosted; CPU-hogs sink to lower priority.

**Key terms**

- **Scheduler** — the policy: chooses *which* ready thread runs next.
- **Dispatcher** — the mechanism: performs the context switch, mode switch, and jump to the chosen thread's PC. Its cost is **dispatch latency**.
- **Preemptive** — OS can forcibly revoke the CPU (timer interrupt); enables responsiveness & fairness but needs synchronisation on shared kernel data.
- **Non-preemptive / cooperative** — a thread keeps the CPU until it blocks or exits.
- **CPU burst** — a stretch of computation between two I/O waits; scheduling really schedules bursts.
- **Turnaround time** — completion time − arrival time (total time in system).
- **Waiting time** — time spent in the ready queue (turnaround − service time).
- **Response time** — first-run time − arrival (latency to *first* CPU); what interactive users feel.
- **Convoy effect** — short jobs stuck behind one long job under FCFS, tanking average waiting time.
- **Quantum / time slice** — the max run length before RR preempts.
- **Starvation** — a (low-priority) job never scheduled; fixed by **aging** (raise priority the longer it waits).
- **MLFQ** — multiple priority queues; jobs demote on CPU use, promote on waiting — approximates SJF without predicting bursts.

**Why interviewers ask this**

Scheduling is the cleanest test of "do you understand the concurrency-vs-hardware tradeoff". A junior recites the algorithm names; a senior explains *why* RR's quantum size is a tuning knob (too large degrades to FCFS, too small drowns in context-switch overhead), why SJF is provably optimal for average waiting time yet unusable in practice (you can't know burst lengths, and it starves long jobs), and why real systems land on MLFQ/CFS. Gantt-chart problems (compute average waiting/turnaround) check that you can actually *do the arithmetic* under pressure, not just talk. And the "why does favouring I/O-bound jobs raise throughput" question separates people who've internalised that I/O and CPU overlap from people who memorised definitions. It's also a gateway: get scheduling and you're primed for synchronisation and deadlock, since preemption is exactly what creates race conditions.

**Common confusions**

- **Waiting time ≠ response time.** Waiting = total time in ready queue; response = time to *first* execution. RR optimises response, not necessarily waiting.
- **Preemptive ≠ Round-Robin.** RR is one preemptive policy; SRTF and preemptive priority are also preemptive.
- **SJF isn't "shortest job wins overall"** — it's shortest *next CPU burst*. And SRTF is just preemptive SJF.
- **A context switch is not free** — it's hundreds of ns to microseconds plus cache/TLB pollution afterward.
- **Higher priority number ≠ higher priority** — Linux nice values run −20 (highest) to +19 (lowest); conventions invert between systems.
- **The scheduler doesn't create parallelism** — on one core it's still one-at-a-time; it creates the *illusion* via fast switching.

**What follows from this topic**

Preemption is the reason **Process Synchronization** exists: the moment the OS can yank the CPU mid-update, shared state can be left half-written, giving race conditions. Priority scheduling introduces **starvation**, which reappears in **Deadlocks** alongside its cousins livelock and priority inversion. The context-switch cost previews why threads (cheaper switches) beat processes, and why excessive threading can *slow* a program. Real-time scheduling (rate-monotonic, EDF) is the strict-deadline cousin of everything here.

### Q1. Why does the OS need a CPU scheduler at all?

A machine has one or a few CPUs but many processes and threads that are *ready* to run at any instant. The scheduler multiplexes the physical CPUs across that ready set to (a) keep the CPU busy — utilisation — and (b) give every job timely progress — responsiveness.

The key enabler is that programs alternate **CPU bursts** and **I/O waits**. While one process blocks on a disk read, its CPU would otherwise sit idle; the scheduler hands that CPU to another ready process. Overlapping one job's I/O with another's computation is where most of the throughput win comes from. Without a scheduler you'd either run one program to completion at a time (batch, terrible interactivity) or waste the CPU whenever anyone waited on I/O.

### Q2. Distinguish the long-term, short-term, and medium-term schedulers, and the dispatcher.

- **Long-term (admission) scheduler** — decides which jobs enter the system / are admitted to the ready pool. Controls the **degree of multiprogramming**. On modern interactive OSes it barely exists; prominent in batch systems. Runs infrequently (seconds/minutes).
- **Short-term (CPU) scheduler** — picks the next ready thread to run on a free CPU. Runs *very* often (every few ms or on every block/preempt), so it must be fast. This is "the scheduler" people usually mean.
- **Medium-term scheduler** — **swaps** processes out of memory to disk and back to relieve memory pressure or reduce multiprogramming; part of virtual-memory management.

The **dispatcher** is the mechanism the short-term scheduler invokes: it performs the **context switch** (save/restore registers + PC), switches from kernel to user **mode**, and **jumps** to the resumption address in the chosen program. The time it takes is **dispatch latency** — pure overhead.

### Q3. What is the difference between preemptive and non-preemptive scheduling?

**Non-preemptive (cooperative)**: once a thread has the CPU it keeps it until it *voluntarily* yields — by blocking on I/O, waiting, or terminating. Simple, no mid-execution races on kernel data, but one runaway or long job monopolises the CPU (bad responsiveness, possible starvation of others). FCFS and plain SJF are non-preemptive.

**Preemptive**: the OS can forcibly take the CPU away, typically driven by a periodic **timer interrupt** (or when a higher-priority job becomes ready). Enables fairness, responsiveness, and time-sharing — but the kernel must now protect shared data structures that a thread might be updating when preempted, which is precisely what creates the need for synchronisation. RR, SRTF, and preemptive priority are preemptive.

```text
timer interrupt fires
  -> CPU traps to kernel
  -> short-term scheduler runs
  -> if a better/other task should run, dispatcher switches
```

### Q4. What scheduling criteria/metrics matter, and how do they trade off?

| Metric | Definition | Want |
|---|---|---|
| CPU utilisation | fraction of time CPU is busy | maximise |
| Throughput | jobs completed per unit time | maximise |
| Turnaround time | completion − arrival | minimise |
| Waiting time | time in ready queue | minimise |
| Response time | first-run − arrival | minimise |

The core tension is **throughput vs response time**. A batch scheduler that runs a few long jobs back-to-back maximises throughput (few context switches, high utilisation) but gives terrible response time. A finely-sliced time-sharing scheduler gives great response time but spends more time context-switching, lowering throughput. Turnaround favours getting jobs *done*; response favours getting them *started*. Interactive systems weight response; batch/HPC systems weight throughput.

### Q5. Walk through FCFS scheduling and the convoy effect.

**First-Come-First-Served**: a FIFO ready queue, non-preemptive. Simplest possible policy. Fair in arrival order, no starvation.

The killer is the **convoy effect**: one long CPU-bound job at the front makes every short job behind it wait, ballooning average waiting time. Example:

```text
P1 burst=24, P2 burst=3, P3 burst=3, all arrive ~t0 in that order
Gantt: | P1 (0-24) | P2 (24-27) | P3 (27-30) |
Waiting: P1=0, P2=24, P3=27  -> avg = 17
```

Reverse the order (short jobs first) and average waiting drops to 3. Same jobs, 5x worse just from ordering — that's the convoy effect. It's also why a single CPU-hog behind which I/O-bound jobs queue can devastate a system's interactivity.

### Q6. Explain SJF and SRTF. Why is SJF optimal, and why can't we just use it?

**SJF (Shortest-Job-First)**: pick the ready job with the smallest *next CPU burst*; non-preemptive. **SRTF (Shortest-Remaining-Time-First)**: the preemptive version — if an arriving job has a shorter remaining burst than the running one, preempt.

SJF is **provably optimal for average waiting time**: given a fixed set of jobs, running shortest-first minimises the sum of everyone's waiting because short jobs impose the least delay on those behind them.

Two reasons it's impractical:
1. **You can't know the next burst length.** Real schedulers *estimate* it with an exponential average of past bursts (`τ(n+1) = α·t(n) + (1−α)·τ(n)`), but it's a guess.
2. **Starvation.** A steady stream of short jobs can indefinitely postpone a long job.

So SJF is the theoretical yardstick; MLFQ approximates it *observationally* (short jobs reveal themselves by finishing/yielding fast) without needing predictions.

### Q7. How does Round-Robin work, and how does quantum size affect it?

Round-Robin is FCFS **plus preemption on a time quantum**. Each ready job runs for at most one quantum `q`; if it hasn't finished, it's preempted and sent to the back of the queue. It's the classic time-sharing policy: fair (everyone gets a turn) and responsive (short response time, bounded by `(n−1)·q`).

The **quantum size is the tuning knob**:
- **Too large** → RR degrades toward **FCFS** (jobs finish within their slice, no rotation, convoy risk returns).
- **Too small** → responsiveness is great but **context-switch overhead dominates** — if `q` approaches switch cost, a big fraction of CPU is spent switching, not working.

Rule of thumb: `q` should be large enough that ~80% of CPU bursts finish within one quantum, typically 10–100 ms. Turnaround under RR is usually worse than SJF, but response time is far better.

### Q8. Work a Gantt-chart problem: compute average waiting and turnaround time.

Given (all arrive at t=0): P1 burst 6, P2 burst 8, P3 burst 7, P4 burst 3. Use **SJF** (non-preemptive).

Order by burst: P4(3), P1(6), P3(7), P2(8).

```text
Gantt: | P4 0-3 | P1 3-9 | P3 9-16 | P2 16-24 |
```

| Job | Burst | Completion | Turnaround (C−0) | Waiting (TA−burst) |
|---|---|---|---|---|
| P4 | 3 | 3 | 3 | 0 |
| P1 | 6 | 9 | 9 | 3 |
| P3 | 7 | 16 | 16 | 9 |
| P2 | 8 | 24 | 24 | 16 |

- **Average turnaround** = (3+9+16+24)/4 = **13.0**
- **Average waiting** = (0+3+9+16)/4 = **7.0**

For comparison, FCFS order P1,P2,P3,P4 would give average waiting = (0+6+14+21)/4 = 10.25 — SJF wins, as expected.

### Q9. Explain priority scheduling, starvation, and aging.

**Priority scheduling** assigns each job a priority and always runs the highest-priority ready job (preemptive or non-preemptive variants). SJF is a special case where priority = inverse of predicted burst.

The hazard is **starvation** (indefinite blocking): a stream of high-priority jobs can keep a low-priority job from ever running. The apocryphal MIT story: a low-priority job submitted in 1967 was found still waiting in 1973.

The fix is **aging**: gradually raise a job's priority the longer it waits in the ready queue. Eventually even the lowest-priority job ages up to the top and runs, guaranteeing **bounded waiting**. Aging turns "eventually never" into "eventually soon".

### Q10. What are Multilevel Queue and Multilevel Feedback Queue (MLFQ) scheduling?

**Multilevel Queue**: partition the ready set into *separate* queues by class (e.g. system > interactive > batch), each with its own policy, and schedule *between* queues (often fixed priority or time-slicing). Jobs are permanently assigned to a queue — rigid.

**Multilevel Feedback Queue (MLFQ)**: multiple priority queues where **jobs move between queues based on observed behaviour**:
- A new job enters the top (highest-priority, shortest quantum).
- If it uses its whole quantum (CPU-bound), it's **demoted** to a lower queue with a longer quantum.
- If it yields early to wait for I/O (interactive), it stays high (or is boosted).
- Periodic **priority boost** lifts everyone back up to prevent starvation and adapt to phase changes.

The genius: MLFQ **approximates SJF without predicting burst lengths** — short/interactive jobs naturally reveal themselves and get favoured, CPU-hogs sink. This is the model most general-purpose schedulers historically used (Windows, older Unix, macOS).

### Q11. Why isn't a context switch free, and what does it actually cost?

A context switch is pure overhead — no user work happens during it. Direct cost: save the outgoing thread's registers, PC, and stack pointer into its PCB/TCB; load the incoming thread's; if switching *processes*, also switch the page-table base register (and often flush or tag the **TLB**) and update memory maps.

The sneaky **indirect** cost is cache/TLB pollution: the new thread's working set isn't in the L1/L2 cache or TLB, so it runs slow (cache-cold) for a while after resuming — this can dwarf the direct register-saving cost. Thread switches within one process are cheaper than process switches because the address space (and thus TLB, with tagged TLBs) is shared. This overhead is exactly why RR's quantum can't be tiny and why oversubscribing threads can slow a program down.

### Q12. How does scheduling change on multiprocessor / multicore systems?

Several new concerns appear:

- **Load balancing** — keep work spread across cores. **Push migration** (a task periodically moves overloaded cores' work) and **pull migration** (idle cores steal from busy ones).
- **Processor affinity** — a thread prefers the core it last ran on because its data is warm in that core's cache; migrating it forces a cache-cold restart. **Soft affinity** = preference; **hard affinity** = pinned (e.g. `taskset`).
- **Per-CPU run queues** — instead of one global ready queue (a lock-contention bottleneck), each core keeps its own queue and balances periodically. Reduces contention and improves affinity.
- **NUMA awareness** — prefer scheduling a thread on a core near its memory node.

The tension: load balancing wants to move threads around; affinity wants to keep them put. Schedulers balance the two.

### Q13. How does the Linux CFS scheduler work (and what is EEVDF)?

**CFS (Completely Fair Scheduler)** models an ideal in which every runnable task gets an equal *fraction* of the CPU. Each task accrues **virtual runtime (vruntime)** — roughly real CPU time consumed, weighted by its **nice** value (lower nice → vruntime advances slower → more CPU). CFS always runs the task with the **smallest vruntime**, kept in a **red-black tree** keyed by vruntime (O(log n) pick/insert). A task that's been starved has low vruntime, so it runs next; a hog's vruntime climbs and it steps aside. There's no fixed timeslice — the target latency is divided among runnable tasks. Nice values (−20..+19) scale each task's weight.

Since ~2024 Linux replaced CFS's core with **EEVDF (Earliest Eligible Virtual Deadline First)**, which adds an explicit per-task **virtual deadline** derived from a requested latency, improving handling of latency-sensitive tasks while keeping the fairness model. The interview-level point: fair-share, vruntime, RB-tree, nice weighting — approximating equal CPU without fixed priorities or burst prediction.

### Q14. Why does favouring I/O-bound jobs improve overall throughput?

An **I/O-bound** job has short CPU bursts and spends most of its time waiting on devices; a **CPU-bound** job has long bursts and rarely waits. If you prioritise the I/O-bound job, it quickly does its little computation and then **issues its I/O and blocks** — releasing the CPU to a CPU-bound job while the device works in parallel.

That overlap is the win: the disk/network and the CPU are both busy at once. If instead you let the CPU-bound job run first, the I/O device sits idle the whole time, and the I/O-bound job can't even *start* its slow device operation. By keeping I/O-bound jobs' requests flowing, you maximise device utilisation *and* CPU utilisation simultaneously — higher total throughput. This is also why MLFQ boosting interactive/I/O jobs is a good default.

### Q15. What is real-time scheduling — rate-monotonic vs EDF?

Real-time systems have **deadlines**, not just performance goals; a late result is a failure (hard RT) or a degradation (soft RT). Scheduling must be *predictable*, not just fast.

- **Rate-Monotonic (RMS)** — static priority: the shorter a task's period, the higher its priority. Simple, analysable; schedulable if CPU utilisation ≤ n(2^(1/n) − 1) (≈69% as n→∞). Optimal among *fixed-priority* schemes.
- **Earliest-Deadline-First (EDF)** — dynamic priority: always run the task whose **absolute deadline is soonest**. Optimal for single-processor and can schedule up to 100% utilisation, but degrades unpredictably under overload.

**Gang scheduling** is a related idea for parallel jobs: schedule all threads of a job *simultaneously* across cores so they can communicate without waiting on descheduled peers — important for tightly-coupled HPC/parallel workloads.

### Q16. What's the difference between thread scheduling and process scheduling?

On a modern kernel, the **thread (kernel-level) is the unit of scheduling**, not the process. The scheduler picks runnable threads; a process is just the address space + resources several threads may share.

Two contention scopes exist:
- **PCS (process-contention scope)** — with a many-to-many/user-level threading model, the thread *library* schedules user threads onto a smaller set of kernel threads; contention is *within* the process.
- **SCS (system-contention scope)** — the kernel schedules kernel threads against *all* threads system-wide. Linux and Windows use 1:1 threading, so effectively everything is SCS.

Practical upshot: switching between two threads of the same process is cheaper than switching processes (shared address space → no page-table/TLB reload), which is one reason threads are favoured for concurrency within an app.

### Q17. Which scheduling algorithm would you choose, and why?

There's no universal winner — match policy to workload:

- **Interactive / desktop / general-purpose OS** → MLFQ-style or a fair scheduler like **CFS/EEVDF**. You want good response time and automatic favouring of interactive jobs without predicting bursts.
- **Batch / HPC throughput** → something close to **SJF/FCFS** with big quanta; response time doesn't matter, minimise switching overhead.
- **Soft real-time / multimedia** → priority with reservations, or **EDF** for deadline guarantees.
- **Simple embedded** → RR or fixed-priority; predictability and simplicity beat cleverness.

The reasoning the interviewer wants: articulate the throughput-vs-response tradeoff, note that pure SJF is optimal-but-impractical (unknown bursts + starvation), that RR's quantum is a tuning knob, and that real systems converge on adaptive, behaviour-driven schedulers (MLFQ, CFS) because they approximate SJF's benefits while staying fair and starvation-free via aging/boosts.

## Process Synchronization

### Summary

**What this topic covers**

What goes wrong when concurrent threads/processes touch shared data, and the machinery that fixes it. When execution can interleave arbitrarily (thanks to preemptive scheduling and multicore), an innocent-looking `count++` can lose updates. This topic defines the **race condition** and the **critical-section problem**, the three properties any correct solution needs (**mutual exclusion, progress, bounded waiting**), the hardware foundations (**test-and-set**, **CAS**, atomic instructions, **spinlocks**), the higher-level **primitives** (**mutex**, **semaphore**, **monitor/condition variable**), and the **classic problems** every course drills — **producer-consumer/bounded-buffer**, **readers-writers**, **dining philosophers** — plus real hazards like **priority inversion**, **livelock**, **starvation**, and lock **granularity/contention**. The 17 questions run from "what is a race condition" and "mutex vs semaphore" up to "spot the bug in this concurrent code" and "solve the bounded buffer".

**Mental model**

Think of shared state as a whiteboard multiple people scribble on simultaneously. A **race condition** is two people reading the same number, each adding one in their head, and both writing back — the board ends up +1 instead of +2 because the read-modify-write wasn't **atomic**. The fix is a rule: only one person at the whiteboard at a time — a **critical section** guarded by a lock. Everything else is variations on *how* you enforce that one-at-a-time rule and *how threads wait* for their turn. Two waiting styles: **busy-wait** (spin, burning CPU checking a flag — good only if the wait is shorter than a context switch, i.e. short critical sections on multicore) and **block** (sleep, let the OS wake you — good for longer waits). The whole art is picking the right primitive (mutex for exclusion, semaphore for counting resources or signalling, condition variable for "wait until a predicate holds") and keeping critical sections *small* so contention stays low. Correctness first: a solution must guarantee no two threads are ever inside the section together (mutual exclusion), someone always makes progress (no deadlock), and no one waits forever (bounded waiting).

**Key terms**

- **Race condition** — outcome depends on the timing/interleaving of threads accessing shared state where ≥1 writes.
- **Critical section** — code that accesses shared state and must run with mutual exclusion.
- **Mutual exclusion** — at most one thread inside the critical section at a time.
- **Progress** — if no one is in the section, a thread wanting in isn't blocked indefinitely by threads not contending.
- **Bounded waiting** — a limit on how many times others enter before a waiting thread gets its turn (no starvation).
- **Atomic** — indivisible; happens fully or not at all, with no visible intermediate state.
- **Test-and-set / CAS** — atomic hardware read-modify-write instructions; the building blocks of locks.
- **Spinlock** — a lock that busy-waits; cheap for very short holds on multicore, wasteful otherwise.
- **Mutex** — a binary lock with **ownership**: only the locking thread may unlock.
- **Semaphore** — a counter with atomic `wait`(P)/`signal`(V); no ownership; **binary** (≈mutex) or **counting** (N resources).
- **Monitor / condition variable** — a construct bundling mutual exclusion with `wait`/`signal`/`broadcast`; wait *in a loop* on a predicate.
- **Priority inversion** — a high-priority thread blocked on a lock held by a low-priority thread; fixed by **priority inheritance**.

**Why interviewers ask this**

Concurrency bugs are the ones that reach production, survive testing, and page you at 3am — so interviewers care a lot. A junior can define a mutex; a senior can *spot a race in code*, explain why `x++` isn't atomic (load/increment/store), and choose the right primitive with justification (mutex vs semaphore is the single most-asked concurrency question). The classic problems (producer-consumer, readers-writers, dining philosophers) test whether you can *compose* primitives correctly — using the wrong semaphore or acquiring locks in the wrong order is where candidates fall down. Senior signal also includes knowing the *failure modes*: deadlock, livelock, starvation, priority inversion (the Mars Pathfinder story is a favourite), and the visibility/reordering issues that make lock-free code so hard. Getting this right proves you can be trusted with shared mutable state.

**Common confusions**

- **A race condition isn't a deadlock** — a race is *corruption from interleaving*; a deadlock is *everyone stuck waiting*. Different bugs.
- **`x++` is not atomic** — it's three steps (load, add, store); a preemption between them loses updates even on one core.
- **Mutex ≠ binary semaphore** — a mutex has **ownership** (only the locker unlocks) and often priority-inheritance; a binary semaphore is just a 0/1 counter any thread can signal.
- **`if` vs `while` on a condition variable** — always re-check the predicate in a `while` loop; spurious wakeups and Mesa semantics mean the condition may be false when you wake.
- **A spinlock isn't "faster"** — it's only better than blocking when the expected wait is shorter than a context switch; otherwise it burns a whole core doing nothing.
- **Volatile ≠ atomic / lock** — visibility is not mutual exclusion; publishing a value doesn't make a read-modify-write safe.

**What follows from this topic**

The failure modes previewed here explode in **Deadlocks** — dining philosophers *is* the circular-wait condition, and lock-ordering is the standard cure. Priority inversion ties back to **CPU Scheduling** (it's a scheduling pathology). The busy-wait-vs-block decision connects to context-switch cost from scheduling. And the whole topic exists *because* of preemption and multicore parallelism introduced earlier — synchronisation is the tax you pay for concurrency.

### Q1. What is a race condition? Give the canonical example.

A **race condition** occurs when two or more threads access shared state concurrently, **at least one writes**, and there's **no synchronisation ordering** — so the result depends on the *timing* of the interleaving. Run it twice, get different answers.

The canonical example is a shared counter increment. `count++` compiles to three separate operations:

```text
R1 = load count      // read
R1 = R1 + 1          // modify
store count = R1      // write
```

Two threads each doing `count++` on count=5, expecting 7:

```text
T1: load count (5)
T2: load count (5)      <- reads before T1 stored
T1: add -> 6, store 6
T2: add -> 6, store 6   <- overwrites, lost update
result: 6, not 7
```

One increment vanished. This happens even on a single core (preemption between steps), and more readily on multicore (true parallelism). The read-modify-write wasn't **atomic**.

### Q2. State the critical-section problem and its three requirements.

The **critical section** is the code region where a thread accesses shared state. The problem: design an entry/exit protocol so concurrent threads use their critical sections safely. Any correct solution must satisfy three properties:

1. **Mutual exclusion** — if one thread is executing in its critical section, no other thread may be in *its* critical section at the same time.
2. **Progress** — if no thread is in the critical section and some threads want to enter, only threads *not* in their remainder section participate in the decision, and the choice can't be postponed indefinitely. (No idle deadlock — someone gets in.)
3. **Bounded waiting** — there's a bound on how many times *other* threads can enter their critical sections after a thread requests entry and before it's granted. (No starvation.)

Mutual exclusion is correctness; progress rules out deadlock; bounded waiting rules out starvation. A lock that provides exclusion but lets one thread jump the queue forever violates bounded waiting.

### Q3. Why isn't `x++` atomic, and why does atomicity matter?

`x++` is **read-modify-write**: the CPU loads x into a register, increments the register, and stores it back — three distinct machine steps (and on load-store RISC architectures, always separate instructions). Between any two steps the thread can be **preempted** (or another core can interleave), so two increments can both read the same old value and one update is lost (see Q1).

**Atomicity** means an operation appears **indivisible** — it either happens completely or not at all, with no observable intermediate state, and no other thread can interleave inside it. Only atomic operations are safe to run concurrently without a lock. That's why hardware provides atomic instructions (fetch-and-add, CAS) and why languages provide `AtomicInteger` / `std::atomic` — they make the whole read-modify-write one indivisible step. Without atomicity (or a lock enforcing it), concurrent updates corrupt shared state.

### Q4. What hardware support underlies locks — test-and-set and compare-and-swap?

Software-only mutual exclusion (Peterson's algorithm) works but is slow and doesn't scale; real locks build on **atomic read-modify-write instructions** the CPU guarantees are indivisible:

**Test-and-Set** — atomically read a flag and set it to true, returning the old value:

```c
// atomic in hardware
bool test_and_set(bool *lock) {
    bool old = *lock;
    *lock = true;
    return old;
}
// spinlock acquire:
while (test_and_set(&lock)) ; // spin until we observe old==false
```

**Compare-and-Swap (CAS)** — atomically: if `*ptr == expected`, set `*ptr = new` and report success:

```c
bool cas(int *ptr, int expected, int newval) {
    if (*ptr == expected) { *ptr = newval; return true; }
    return false;
}
```

CAS is strictly more powerful and is the foundation of **lock-free** data structures (retry loops: read, compute, CAS, retry on failure). Both give the atomicity needed to build mutexes, semaphores, and everything above them.

### Q5. What is a spinlock, and when is it appropriate?

A **spinlock** is a lock whose waiter **busy-waits** (spins in a tight loop testing the lock) instead of sleeping. Built directly on test-and-set/CAS.

**Appropriate when**: the expected wait is **shorter than a context switch**, and you're on **multicore** so the lock holder can be running on another core and release it soon. Very short critical sections in kernel code (e.g. protecting a per-CPU list for a few instructions) are the textbook case — blocking would cost more than spinning.

**Wasteful when**: the critical section is long, or you're on a **single core** (spinning can't help — the holder can't run while you burn the only CPU spinning; you should have yielded). A spinning thread consumes 100% of a core doing nothing. Real kernels use adaptive/hybrid locks that spin briefly then block. The decision is the same busy-wait-vs-block tradeoff, quantified by comparing spin time to switch cost.

### Q6. Compare mutex, semaphore, and monitor.

| | Mutex | Semaphore | Monitor / CV |
|---|---|---|---|
| Purpose | Mutual exclusion | Counting resources / signalling | Exclusion + conditional waiting |
| State | Locked/unlocked | Integer counter ≥ 0 | Lock + condition variables |
| Ownership | Yes — only locker unlocks | No — any thread may signal | Yes (implicit, one thread in monitor) |
| Operations | lock / unlock | wait(P) / signal(V) | enter/exit + wait / signal / broadcast |
| Level | Low | Low | High (language construct) |

- **Mutex** — binary, owned. For protecting a critical section. Enables priority inheritance.
- **Semaphore** — a counter. `wait` decrements (blocks at 0); `signal` increments (may wake a waiter). **Binary** semaphore (0/1) ≈ mutex but *without ownership*; **counting** semaphore tracks N interchangeable resources (e.g. 5 DB connections). Also great for *signalling* between threads (producer signals consumer).
- **Monitor** — bundles a mutex with **condition variables** so you can atomically release the lock and wait for a predicate, then re-acquire on wake. The high-level construct (Java `synchronized`+`wait/notify`, `pthread_cond_t`).

### Q7. Mutex vs semaphore — what's the real difference and when do you use each?

This is *the* concurrency interview question. Two real distinctions:

1. **Ownership.** A **mutex** is owned by the thread that locked it — only that thread can unlock it. A **semaphore** has no ownership — any thread can `signal` it, including one that never `wait`ed.
2. **Purpose / semantics.** A mutex answers "may I enter the critical section?" (a lock). A semaphore is a *counter*: it answers "is a resource available?" (counting) or acts as a *signal* between threads.

**Use a mutex** for mutual exclusion — protecting shared data one-thread-at-a-time. You want ownership (so unlock is disciplined) and priority inheritance.

**Use a (counting) semaphore** to manage a pool of N interchangeable resources (connection pool, N parking spots), or as a **signalling** mechanism where thread A tells thread B "an event happened / an item is ready" — the signaller isn't the waiter, so ownership would be wrong. Rule of thumb: mutex = locking, semaphore = counting/signalling.

### Q8. What is a monitor and a condition variable, and why must you wait in a loop?

A **monitor** is a high-level synchronisation construct that bundles: (a) an implicit **mutex** so only one thread is "in the monitor" at a time, and (b) one or more **condition variables** for waiting on predicates. A **condition variable** supports:
- `wait(cv)` — atomically release the monitor lock and sleep until signalled, then re-acquire the lock before returning.
- `signal(cv)` — wake one waiter; `broadcast` — wake all.

You **must re-check the predicate in a `while` loop**, not an `if`:

```c
lock(mtx);
while (!buffer_has_item)      // NOT if
    wait(not_empty, mtx);
item = take();
unlock(mtx);
```

Reasons: **Mesa semantics** (used by nearly everything — Java, pthreads) means `signal` merely makes the waiter *runnable*; by the time it re-acquires the lock, another thread may have consumed the condition, so it must recheck. Also **spurious wakeups** can wake a waiter with no signal at all. Under **Hoare semantics** the signaller immediately yields the lock to the waiter (predicate guaranteed on wake) — cleaner but rarely implemented because it's costly. Always loop.

### Q9. Solve the producer-consumer (bounded buffer) problem.

A fixed-size buffer; producers add items, consumers remove them. Producers must block when full, consumers when empty, and buffer access must be mutually exclusive. Use **three semaphores**:

```c
semaphore mutex = 1;   // protects the buffer
semaphore empty = N;   // count of free slots
semaphore full  = 0;   // count of filled slots

// Producer
wait(empty);           // block if no free slot
wait(mutex);
   enqueue(item);
signal(mutex);
signal(full);          // one more item available

// Consumer
wait(full);            // block if nothing to consume
wait(mutex);
   item = dequeue();
signal(mutex);
signal(empty);         // one more free slot
```

Key points: `empty`/`full` are **counting** semaphores enforcing the capacity/availability limits; `mutex` is binary for the buffer update. **Order matters** — always `wait(empty/full)` *before* `wait(mutex)`. Reversing them (grab mutex, then block on full) causes **deadlock**: you'd sleep holding the lock nobody else can take.

### Q10. Explain the readers-writers problem and its starvation risk.

Shared data read by many, written by few. Rule: **any number of readers concurrently** (reads don't conflict), but a **writer needs exclusive access** (no other readers or writers). Maximises read concurrency.

A basic solution (reader-preference): the first reader locks out writers, the last reader releases; a counter tracks active readers, guarded by a mutex, plus a write-lock semaphore.

The problem is **starvation**:
- **Reader-preference** — as long as *some* reader is always active, writers wait forever (writer starvation). Common in naive solutions.
- **Writer-preference** — block new readers once a writer is waiting; now a stream of writers can starve readers.

Fair solutions add a queue/turnstile so waiting writers eventually get priority without permanently locking out readers. Real systems use `pthread_rwlock` / `ReadWriteLock` and often let you choose the policy. The interview point: acknowledge the concurrency win *and* name the starvation tradeoff.

### Q11. Explain dining philosophers and how to make it deadlock-free.

Five philosophers around a table, one fork between each pair; a philosopher needs **both** neighbouring forks to eat. Naive solution: each picks up the **left fork, then the right**. If *all five* grab their left fork simultaneously, everyone holds one fork and waits forever for the right — **deadlock via circular wait** (it hits all four Coffman conditions at once).

Fixes (each breaks one condition):
- **Resource ordering** — number the forks; everyone always picks up the **lower-numbered fork first**. This breaks circular wait: someone gets both. The canonical, cleanest fix.
- **Limit diners** — allow at most **4** philosophers at the table (a counting semaphore initialised to 4); with 4 competing for 5 forks, at least one can always eat. Breaks hold-and-wait's cycle.
- **Arbiter/waiter** — a central mutex/monitor grants permission to pick up forks; serialises acquisition. Breaks the race but limits concurrency.
- **Atomic both-or-none** — pick up both forks in one critical section, or neither. Breaks hold-and-wait.

Dining philosophers is really a lesson about circular wait and lock ordering.

### Q12. What is busy-waiting vs blocking, and when is each right?

**Busy-waiting (spinning)**: the thread loops testing a condition, staying on the CPU. Zero wake-up latency (you notice the moment it changes) but **wastes CPU** the whole time you wait.

**Blocking (sleeping)**: the thread gives up the CPU and the OS puts it to sleep, waking it when the resource frees. No CPU wasted while waiting, but you pay **two context switches** (sleep + wake) and some latency.

Choose by comparing **expected wait time to context-switch cost**:
- Wait likely **shorter** than a switch, and **multicore** (holder can run elsewhere) → **spin**. Short kernel critical sections.
- Wait likely **longer**, or **single core**, or unknown → **block**. Anything user-level or contended.

Hybrid **adaptive** locks spin briefly, then block if the lock isn't released quickly — the best of both.

### Q13. What is priority inversion, and how is it fixed? (Mars Pathfinder)

**Priority inversion**: a **high**-priority thread H is blocked waiting on a lock held by a **low**-priority thread L. If a **medium**-priority thread M (that doesn't need the lock) preempts L, then L can't run to release the lock, so H — the highest priority — is indirectly blocked by M. Priorities are effectively inverted.

The famous case: **NASA's 1997 Mars Pathfinder** rover kept resetting on Mars. A high-priority bus-management task blocked on a mutex held by a low-priority meteorological task, while medium-priority tasks starved the low one; a watchdog timer saw the high task miss its deadline and reset the system. JPL diagnosed it remotely and patched it.

**Fix: priority inheritance** — while L holds a lock that H wants, L **temporarily inherits H's priority**, so it can't be preempted by M and runs to release the lock quickly, then reverts. (Alternative: **priority ceiling** — a lock's holder runs at the lock's predefined ceiling priority.) That patch is exactly what fixed Pathfinder.

### Q14. Distinguish deadlock, livelock, and starvation.

- **Deadlock** — a set of threads each **stuck waiting** for a resource held by another; none can proceed, ever. State is frozen. (Needs all four Coffman conditions.)
- **Livelock** — threads are **actively changing state** in response to each other but **make no progress** — like two people stepping side-to-side in a corridor, each yielding to the other forever. CPU is busy; work isn't getting done. Often arises from naive deadlock-avoidance ("detect contention, back off, retry" where everyone backs off in lockstep). Randomised backoff breaks it.
- **Starvation** — a thread **waits indefinitely** though the system as a whole makes progress; it's just always passed over (e.g. low priority under priority scheduling, or writers under reader-preference locks). Not deadlocked — others *are* running. Fixed by aging/fairness.

Nutshell: deadlock = stuck-together-forever; livelock = spinning-together-uselessly; starvation = left-behind-indefinitely.

### Q15. What is lock granularity, and how does it affect contention?

**Granularity** = how much data one lock protects.

- **Coarse-grained** — one big lock covers a large structure (e.g. a single lock for an entire hash map, or the old **Big Kernel Lock**). Simple, easy to reason about, deadlock-resistant (few locks), but **high contention**: threads serialise even when touching unrelated data, killing scalability on many cores.
- **Fine-grained** — many small locks (e.g. one lock per hash bucket, or per row). **Low contention**, high parallelism — but complex, more overhead per operation, and **more deadlock risk** (multiple locks → ordering discipline required) plus subtle bugs.

The tradeoff is **simplicity/safety vs scalability**. Start coarse; refine to fine-grained only where profiling shows the lock is a bottleneck. Alternatives that sidestep locks: lock-free structures (CAS), per-thread/sharded data, RCU (read-copy-update) for read-mostly workloads.

### Q16. Implement a thread-safe counter three ways.

**1. Mutex** — protect the read-modify-write:

```c
mutex m;  long count = 0;
void inc() { lock(m); count++; unlock(m); }
```

**2. Atomic instruction** — no lock, hardware fetch-and-add:

```c
atomic_long count = 0;
void inc() { atomic_fetch_add(&count, 1); }   // single indivisible op
```

**3. CAS retry loop** — lock-free with compare-and-swap:

```c
void inc() {
    long old;
    do { old = count; } while (!cas(&count, old, old + 1));
}
```

Tradeoffs: the mutex is simplest and generalises to multi-step operations but has lock overhead and can block. The atomic fetch-and-add is fastest for this exact case and never blocks. The CAS loop shows the lock-free pattern but wastes work under high contention (many retries). For a *single* counter, prefer the atomic. For a high-contention counter, consider **sharded/striped** counters (per-thread partials summed on read) to avoid the shared cache line ping-ponging between cores.

### Q17. Spot the concurrency bug: two threads, a shared balance.

```c
// shared: int balance = 100;
void withdraw(int amt) {
    if (balance >= amt)       // check
        balance -= amt;       // act
}
```

**Bug: a check-then-act race (TOCTOU).** Two threads each call `withdraw(100)` on balance=100. Both evaluate `balance >= amt` while balance is still 100 (neither has decremented yet), both pass the check, both subtract → balance = −100. The account is overdrawn; the invariant "balance never goes negative" is violated because the **check and the act aren't atomic together**.

**Fix — make check+act one critical section:**

```c
void withdraw(int amt) {
    lock(m);
    if (balance >= amt)
        balance -= amt;
    unlock(m);
}
```

Now the guard and the update are indivisible; the second thread sees balance=0 and its check fails. The general lesson: it's not enough to make each *statement* atomic — the *invariant-preserving sequence* (read the condition, then modify based on it) must be atomic as a whole. This is the same shape as the lost-update race, and why "just use volatile/atomic on the variable" doesn't fix check-then-act.

## Deadlocks

### Summary

**What this topic covers**

The specific failure where a set of threads/processes each hold a resource and wait on one another in a cycle, so none ever proceeds. This topic nails the precise definition, the **four Coffman (necessary) conditions** that must *all* hold for deadlock to be possible, the **resource-allocation graph** (RAG) used to reason about and detect it, and the **four strategies** for dealing with it — **prevention**, **avoidance** (the **Banker's algorithm** and safe states), **detection & recovery**, and the **ostrich algorithm** (ignore it). It also disentangles deadlock from its cousins **livelock** and **starvation**, covers single- vs multi-instance resources, and drills the canonical practical skill: **spotting and fixing a lock-ordering deadlock** (two threads locking A/B in opposite order → impose a global lock order). The 16 questions run from "what are the four conditions" to "walk a Banker's safety check" and "fix this deadlock".

**Mental model**

Deadlock is a **cycle of waiting**. Picture a four-way intersection where four cars each entered and now block the car to their left; each waits for the one ahead to move, and none can — gridlock. Two mental tools. First, the **four conditions as an AND gate**: deadlock is *possible* only if mutual exclusion, hold-and-wait, no-preemption, AND circular-wait all hold; knock out *any one* and deadlock cannot occur. That's the whole theory of prevention — pick a condition and structurally forbid it. Second, the **safe state**: at any moment the system is "safe" if there exists *some* order in which every process can obtain its maximum future needs and finish; avoidance (Banker's) simply refuses any allocation that would leave no such order. The practical reality: prevention and avoidance are expensive and restrictive, so most general-purpose OSes just don't bother (the ostrich) and rely on programmers using **consistent lock ordering** to kill circular wait by convention. Databases, where deadlocks are common and cheap to undo, instead *detect* (wait-for graph cycle) and *recover* (abort a victim transaction).

**Key terms**

- **Deadlock** — a set of processes each holding a resource and waiting for one held by another; permanently stuck.
- **Coffman conditions** — the four necessary conditions; all must hold simultaneously.
- **Mutual exclusion** — a resource is non-shareable; only one holder at a time.
- **Hold and wait** — a process holds ≥1 resource while requesting more.
- **No preemption** — resources can't be forcibly taken from a holder.
- **Circular wait** — a closed chain of processes, each waiting for the next's resource.
- **Resource-allocation graph (RAG)** — processes + resources as nodes, request/assignment edges; a cycle indicates deadlock (definitively, for single-instance resources).
- **Safe state** — a state from which some execution order lets all processes finish.
- **Banker's algorithm** — an avoidance algorithm that grants a request only if the resulting state is safe.
- **Detection & recovery** — allow deadlock, find it via the wait-for graph, then kill/roll back a victim.
- **Ostrich algorithm** — ignore deadlock (bury your head); acceptable when it's rare and prevention is costlier than a reboot.
- **Livelock / starvation** — related non-progress states, distinct from deadlock (see below).

**Why interviewers ask this**

Deadlock is where the abstract concurrency theory meets a concrete diagnostic skill every backend/systems engineer needs. A junior can recite "the four conditions"; a senior can look at two functions that lock `A` then `B` versus `B` then `A` and immediately say "that's a circular wait, impose a lock order to fix it" — the single most practically useful thing in this topic. Interviewers probe whether you understand that breaking *any one* Coffman condition suffices (and the cost of each), whether you can distinguish deadlock from livelock and starvation (a common muddle), and whether you know why real OSes choose the ostrich while databases choose detection. The Banker's algorithm tests whether you can execute a **safety check** by hand — an exercise in careful state reasoning. Overall it signals: can this person prevent, diagnose, and fix the concurrency bug that most often takes down production systems?

**Common confusions**

- **A cycle in a RAG always means deadlock** — only for **single-instance** resources. With multiple instances a cycle is *necessary but not sufficient*; you need a detection algorithm.
- **Deadlock = starvation** — no. Deadlock is a *cyclic* permanent stuck; starvation is one process indefinitely passed over while others progress.
- **Avoidance = prevention** — different. Prevention structurally negates a condition (always true); avoidance dynamically refuses unsafe *requests* using future-need knowledge (Banker's).
- **"Unsafe state" = deadlock** — an unsafe state only *risks* deadlock; it may still avoid it depending on timing. Safe → definitely no deadlock; unsafe → maybe.
- **You must break all four conditions** — no, breaking **one** is enough to make deadlock impossible.
- **Deadlock and livelock look the same** — in deadlock threads are blocked/idle; in livelock they're actively running and changing state, just not progressing.

**What follows from this topic**

Deadlock is the acute form of the hazards introduced in **Process Synchronization** — dining philosophers *is* circular wait, and mutex/lock acquisition order is exactly where real deadlocks are born. The recovery step (preempt a resource, roll back) connects to memory/transaction rollback ideas. The ostrich-vs-detection choice mirrors an engineering theme throughout OS design: the cost of a guarantee vs the rarity of the failure it prevents. And priority inversion / starvation from the synchronisation topic sit right beside deadlock as the family of "threads that never make progress" bugs.

### Q1. What exactly is a deadlock?

A **deadlock** is a situation in which a set of processes (or threads) are **permanently blocked**, each holding at least one resource and **waiting to acquire a resource held by another** process in the set. Because every process in the set is waiting on another in the set, **none can ever proceed** — the waiting is circular and nothing releases.

The classic two-thread shape:

```text
Thread 1: holds lock A, wants lock B
Thread 2: holds lock B, wants lock A
-> T1 waits for T2 to release B; T2 waits for T1 to release A. Forever.
```

The defining feature is *permanence*: unlike a thread that's merely slow or temporarily blocked, deadlocked threads will never make progress without outside intervention (kill, rollback, or forced resource preemption). It differs from starvation (a process passed over but the system progresses) and livelock (processes active but not progressing).

### Q2. What are the four Coffman conditions, and why do they matter?

Deadlock is possible **only if all four hold simultaneously**:

1. **Mutual exclusion** — at least one resource is non-shareable; only one process can hold it at a time.
2. **Hold and wait** — a process holds at least one resource while waiting to acquire additional ones.
3. **No preemption** — resources cannot be forcibly taken from a process; they're released only voluntarily.
4. **Circular wait** — there exists a set {P0, P1, …, Pn} where P0 waits for a resource held by P1, P1 for P2, …, Pn for P0 — a closed cycle.

Why they matter: they're **necessary conditions**, so they form the complete toolkit for **prevention** — if you can *structurally guarantee that even one of them can never hold*, deadlock becomes impossible. Every prevention technique is "which condition am I killing, and what does it cost me?" (e.g. impose a total lock order → circular wait can't form).

### Q3. How do you break each of the four conditions to prevent deadlock?

| Condition | How to break it | Cost / downside |
|---|---|---|
| Mutual exclusion | Make resources shareable (e.g. read-only, or use lock-free/optimistic access) | Many resources are inherently exclusive (printer, write lock) — often impossible |
| Hold and wait | Require a process to request **all** resources up front, atomically; or release all before requesting more | Low utilisation (resources held but unused); possible starvation; must know needs in advance |
| No preemption | Allow the OS to **preempt** a resource — if a process can't get all it needs, release what it holds and retry | Only works for saveable/restorable state (CPU, memory), not e.g. a half-written file or lock |
| Circular wait | Impose a **total ordering** on resources; require each process to acquire them in increasing order | The most practical for locks (lock ordering); but you must know/enforce the global order, restricting design |

The takeaway senior candidates give: **total resource ordering (killing circular wait) is the practical winner** for software locks — it costs almost nothing at runtime and just requires a coding convention.

### Q4. What is a resource-allocation graph, and how does it show deadlock?

A **resource-allocation graph (RAG)** is a directed graph with two node types:
- **Process** nodes (circles): P1, P2, …
- **Resource** nodes (squares), with a dot per instance.

And two edge types:
- **Request edge** P → R: process P is waiting for resource R.
- **Assignment edge** R → P: an instance of R is allocated to P.

```text
   P1 ---request--> R2 ---assigned--> P2
   ^                                   |
   |                                   request
   assigned                            |
   R1 <---------------------------------
   (R1 assigned to P1; P2 requesting R1)  -> cycle P1->R2->P2->R1->P1
```

**Reading it**: For **single-instance** resources, a **cycle in the RAG is a definitive deadlock** — the cycle *is* the circular wait. For **multi-instance** resources, a cycle is **necessary but not sufficient**: another process might release an instance and break the wait, so you must run a detection algorithm. No cycle ⇒ no deadlock, always.

### Q5. What are the four strategies for handling deadlock?

1. **Prevention** — structurally ensure one of the four Coffman conditions can *never* hold (e.g. total lock ordering). Deadlock becomes impossible by construction, but the constraints reduce flexibility/utilisation.
2. **Avoidance** — allow the conditions but *dynamically refuse* any resource request that would move the system into an **unsafe** state, using advance knowledge of each process's **maximum claim** (the **Banker's algorithm**). Safe but requires knowing max needs and is runtime-expensive.
3. **Detection & recovery** — allow deadlocks to happen, periodically run a **detection** algorithm (cycle in the wait-for graph), and **recover** by aborting/rolling back a process or preempting a resource. Used by databases.
4. **Ostrich algorithm** — ignore the problem; assume deadlock is rare enough that the cost of prevention/detection isn't worth it, and just reboot/kill if it ever happens. What most general-purpose OSes (Linux, Windows) do for user-level locks.

The choice is an economic one: frequency of deadlock × cost of an occurrence vs cost of the guarantee.

### Q6. Explain the Banker's algorithm and safe states.

The **Banker's algorithm** (Dijkstra) is a **deadlock-avoidance** algorithm: like a banker who only grants a loan if he can still satisfy everyone's credit line, the OS grants a resource request only if the resulting state is **safe**. It needs four data structures (for m resource types, n processes):

- **Available[m]** — free instances of each resource.
- **Max[n][m]** — each process's maximum claim.
- **Allocation[n][m]** — currently held.
- **Need[n][m]** = Max − Allocation — still required.

A state is **safe** if there's an ordering (a "safe sequence") in which each process can get its remaining `Need` from `Available` (plus what earlier finishers release), run to completion, and free its resources. On each request the algorithm *tentatively* grants it, runs a **safety check**, and only commits if the result is safe; otherwise the requester waits. Safe ⇒ deadlock impossible; unsafe ⇒ deadlock *possible* (so refuse). The costs: every process must declare its **max needs up front**, and the safety check is O(n²·m) per request — impractical for general OSes, but the canonical teaching model.

### Q7. Walk through a Banker's safety check.

3 resource types (A,B,C), total = (10,5,7). Current state:

```text
        Alloc      Max        Need = Max-Alloc
P0      0 1 0      7 5 3       7 4 3
P1      2 0 0      3 2 2       1 2 2
P2      3 0 2      9 0 2       6 0 0
P3      2 1 1      2 2 2       0 1 1
P4      0 0 2      4 3 3       4 3 1

Allocated total = (7,2,5); Available = total - allocated = (3,3,2)
```

Find a safe sequence — repeatedly pick a process whose `Need ≤ Available`, "finish" it, and add its allocation back to Available:

```text
Available = (3,3,2)
P1 Need (1,2,2) <= (3,3,2)? yes -> finish, Available += (2,0,0) = (5,3,2)
P3 Need (0,1,1) <= (5,3,2)? yes -> finish, Available += (2,1,1) = (7,4,3)
P4 Need (4,3,1) <= (7,4,3)? yes -> finish, Available += (0,0,2) = (7,4,5)
P0 Need (7,4,3) <= (7,4,5)? yes -> finish, Available += (0,1,0) = (7,5,5)
P2 Need (6,0,0) <= (7,5,5)? yes -> finish, Available += (3,0,2) = (10,5,7)
```

All five finished → **safe sequence <P1, P3, P4, P0, P2>** exists → the state is **safe**. If a new request arrived, you'd tentatively apply it and re-run this check; if no safe sequence exists afterward, deny the request.

### Q8. How does deadlock detection and recovery work?

**Detection**: let deadlocks happen, then periodically look for them. For **single-instance** resources, build a **wait-for graph** (collapse the RAG: an edge Pi → Pj means Pi waits for a resource held by Pj) and search for a **cycle** — a cycle is a deadlock. For **multi-instance** resources, run a Banker-style detection scan (like the safety check but with actual current requests). Detection has a cost/frequency tradeoff: run it often (catch deadlocks fast, more overhead) or rarely (cheaper, but deadlocks linger and grow).

**Recovery** options once a deadlock is found:
- **Process termination** — abort all deadlocked processes (drastic) or abort one at a time until the cycle breaks (re-check after each; choose the cheapest victim).
- **Resource preemption** — forcibly take a resource from a process and give it to another, **rolling back** the victim to a safe checkpoint. Must avoid always picking the same victim (→ starvation), so factor in a rollback count.

Choosing the **victim** minimises cost (priority, work done so far, resources held, how many rollbacks already).

### Q9. What is the ostrich algorithm and why do real OSes use it?

The **ostrich algorithm** is deliberately **ignoring** the possibility of deadlock — "stick your head in the sand." The system provides no prevention, avoidance, or detection for (most) resources; if a deadlock ever occurs, the user/operator notices and reboots or kills the offending processes.

General-purpose OSes like **Linux and Windows** take this stance for user-level resource/lock deadlocks because:
- Deadlocks among well-written applications are **rare**.
- Prevention/avoidance imposes **constant overhead and restrictions** on *every* operation to guard against an infrequent event.
- Detection+recovery for arbitrary user locks is expensive and the OS often can't safely roll back application state anyway.

So the **economically rational** choice is to do nothing and let the rare case be handled by a kill/reboot. The OS *does* guard specific internal resources with careful lock ordering, but it doesn't police application-level deadlocks. Databases make the opposite choice because there deadlocks are common and cheaply undone by aborting a transaction.

### Q10. Distinguish deadlock, livelock, and starvation.

- **Deadlock** — processes are **blocked** in a cycle, each waiting on another; **no CPU activity**, permanent, needs all four Coffman conditions. Nothing changes without intervention.
- **Livelock** — processes are **not blocked**; they keep **actively changing state** in response to each other but make **no forward progress**. Classic: two people meeting in a hallway, each politely stepping the same way repeatedly; or two threads that each detect contention, release their lock, back off, and retry *in lockstep* forever. CPU is busy, work isn't done. Fixed by **randomised backoff** to break the symmetry.
- **Starvation** — a single process **waits indefinitely** while the system as a whole **makes progress**; it's just perpetually passed over (low priority, or writer-preference locks). Not cyclic, not everyone stuck. Fixed by **aging/fairness**.

One-liner: deadlock = stuck in a cycle; livelock = busy but going nowhere; starvation = left behind while others advance.

### Q11. Spot and fix the deadlock: two threads locking A and B.

```c
// Thread 1                 // Thread 2
lock(A);                    lock(B);
lock(B);                    lock(A);   // opposite order!
   // work                     // work
unlock(B);                  unlock(A);
unlock(A);                  unlock(B);
```

**The bug**: the two threads acquire the *same two locks in opposite orders*. Interleave them so T1 holds A and T2 holds B; now T1 blocks on B (held by T2) and T2 blocks on A (held by T1) → **circular wait → deadlock**. All four Coffman conditions are present.

**The fix — impose a global lock ordering** (break circular wait). Decide a canonical order (e.g. by address, or A-before-B always) and make *every* thread acquire in that order:

```c
// Both threads:
lock(A);        // always A before B
lock(B);
   // work
unlock(B);
unlock(A);
```

Now no cycle can form — whoever gets A first will get B, finish, and release. When locks are chosen dynamically, order by a stable key (`if (&x < &y) { lock(x); lock(y); } else { lock(y); lock(x); }`). This lock-ordering discipline is the single most important practical deadlock cure.

### Q12. Why does dining philosophers deadlock, and which condition does each fix break?

Deadlock arises when all five philosophers pick up their **left fork first** simultaneously: each holds one fork (hold-and-wait), forks are exclusive (mutual exclusion), no one can steal a fork (no preemption), and everyone waits on the next philosopher's fork in a ring (**circular wait**) — all four conditions, so it deadlocks.

Each standard fix removes one condition:
- **Resource (fork) ordering** — pick up the lower-numbered fork first → **breaks circular wait** (one philosopher grabs both low forks; no ring).
- **Limit to 4 diners** (semaphore=4) → **breaks hold-and-wait/circular wait** (with 4 processes and 5 forks, one always completes).
- **Arbiter/waiter grants forks** → serialises acquisition, **breaks circular wait**.
- **Pick up both forks atomically or neither** → **breaks hold-and-wait** (never hold one while waiting for the other).

It's the textbook demonstration that breaking *any single* Coffman condition suffices.

### Q13. Single-instance vs multiple-instance resources — how does that change deadlock reasoning?

**Single-instance** resources (one printer, one specific mutex): a resource is held by exactly one process. Here a **cycle in the resource-allocation / wait-for graph is exactly a deadlock** — necessary *and* sufficient. Detection is simple cycle-finding.

**Multiple-instance** resources (a pool of N identical items — say 5 DB connections, or M memory frames): several processes can hold instances of the same type. Now a **cycle is necessary but not sufficient** for deadlock: a process outside the immediate cycle, or one holding a spare instance, might release an instance that satisfies a waiter and breaks the chain. So you can't just look for a cycle — you need a **detection algorithm** (Banker-style: repeatedly find a process whose current request can be satisfied from `Available`, pretend it finishes and releases, and see if everyone can complete). If some processes can never be satisfied, those are deadlocked. This is why the Banker's algorithm works over instance *counts*, not graph edges.

### Q14. How do databases handle deadlocks?

Databases embrace **detection and recovery** rather than prevention, because concurrent transactions routinely take row/table locks in data-dependent orders that can't be globally ordered in advance, yet a transaction is **cheap to undo** (that's what transactions are for).

Mechanism:
- The DB maintains a **wait-for graph** of transactions (Ti → Tj if Ti waits for a lock held by Tj).
- A background checker (or on-demand, when a lock wait exceeds a timeout) **searches for a cycle**.
- On finding one, it picks a **victim** (usually the transaction with the least work done / fewest locks / lowest priority) and **aborts and rolls it back**, releasing its locks so the others proceed. The victim gets a "deadlock detected" error and typically **retries**.

So a well-written app just catches the deadlock error and retries the transaction. (Some systems, like older MySQL configs, fall back to a **lock-wait timeout** as a cruder proxy for detection.) This is the pragmatic opposite of the OS's ostrich choice — feasible precisely because DB state is checkpointed and rollback-able.

### Q15. When would you choose prevention vs avoidance vs detection vs ostrich?

Match the strategy to how often deadlock happens and how costly each occurrence and each guarantee is:

- **Prevention (e.g. lock ordering)** — default for **application/systems code**. Cheap at runtime, just a discipline; use total resource ordering to kill circular wait. Choose when you control the code and can enforce an order.
- **Avoidance (Banker's)** — only when you **know max resource claims in advance** and deadlock is costly, e.g. some real-time or resource-reservation systems. Rare in practice due to overhead and the max-claim requirement.
- **Detection & recovery** — when deadlocks are **expected and cheap to undo**: databases, transactional systems, some distributed systems. You accept occasional deadlock and roll back a victim.
- **Ostrich** — general-purpose OS kernels for **user-level** deadlocks, where they're rare and the cost of universal guarding outweighs an occasional kill/reboot.

The senior framing: it's a cost/benefit decision — `P(deadlock) × cost(deadlock)` vs `cost(guarantee)`.

### Q16. How would you prevent deadlocks in a large multithreaded codebase?

Practical, layered approach (mostly about killing **circular wait** and **hold-and-wait**):

- **Global lock ordering** — define a canonical acquisition order for all locks (by a stable key/address or a documented hierarchy) and acquire strictly in that order. This is the primary defence; it makes circular wait structurally impossible.
- **Minimise lock scope** — hold locks for the shortest time; never call into unknown/callback code while holding a lock (it may grab another lock and invert your order).
- **Avoid nested locks where possible** — one lock at a time can't deadlock; prefer coarser single locks or lock-free structures for hot paths.
- **Use `tryLock` with timeout/backoff** — if you can't get all needed locks, release what you hold and retry (breaks hold-and-wait); add **randomised backoff** to avoid livelock.
- **Lock-free / higher-level constructs** — atomics, concurrent collections, message passing, or a single-threaded event loop sidestep the problem entirely.
- **Tooling** — deadlock detectors / lock-order validators (e.g. ThreadSanitizer, Linux `lockdep`) catch order violations in testing before they reach production.

The one-line answer interviewers want: **impose a consistent lock ordering** to eliminate circular wait, keep critical sections small, and lean on tooling to enforce it.
## Inter-Process Communication (IPC)

### Summary

**What this topic covers**

How separate processes — which by design cannot see each other's memory — actually talk to each other, and how the OS mediates that conversation. This topic has 15 questions covering the two foundational paradigms (**shared memory** vs **message passing**), the concrete mechanisms Unix/Windows expose (**pipes** and **FIFOs**, **message queues**, **shared memory segments**, **sockets**, **signals**, **memory-mapped files**, and the low-level **eventfd/futex**), how to choose among them (speed, data size, whether the processes are related, whether they're on the same machine, complexity), and why threads get "IPC" for free while processes have to work for it. The through-line: IPC is the price of process isolation. Isolation is the feature — one process crashing or misbehaving can't corrupt another — and IPC is the controlled hole you punch through that wall when cooperation is required.

**Mental model**

Start from the wall. Every process has its own virtual address space (see the Memory Management and Virtual Memory topics); a pointer in process P1 is meaningless in P2. So any data exchange must go through something *both* can reach — and the only thing both can reach is the kernel (or a kernel-arranged shared region). That gives you exactly two shapes. Either the OS **maps one physical region into both address spaces** (shared memory) — after setup, exchanging data is just reading and writing memory at full speed, no kernel involvement per exchange, but the two processes now share mutable state and must synchronize it themselves with a semaphore or mutex. Or the OS **acts as a courier** (message passing) — `send()` copies your data into the kernel, `receive()` copies it out into the other process; the kernel serializes access so there are no shared-state races, but every message pays a copy and a couple of mode switches. Every named mechanism is one of these two shapes with a different addressing scheme and lifetime. Signals are the degenerate case: a "message" with no payload but the number itself.

**Key terms**

- **Shared memory** — one physical region mapped into multiple address spaces; fastest IPC (no per-exchange copy), but the app must synchronize access.
- **Message passing** — exchange via kernel `send`/`receive`; no shared mutable state, safer, but pays copy + mode-switch cost per message.
- **Pipe** — unidirectional in-kernel byte stream between *related* processes (parent/child); the shell `|`.
- **Named pipe / FIFO** — a pipe with a filesystem name, so *unrelated* processes can open it.
- **Message queue** — a kernel-held queue of discrete, typed messages that persists independent of any single reader.
- **Socket** — bidirectional endpoint; **Unix domain sockets** locally, **TCP/UDP** across machines. The only mechanism here that spans hosts.
- **Signal** — an asynchronous software interrupt delivered to a process (SIGINT, SIGTERM, SIGKILL, SIGSEGV); carries only its number.
- **Semaphore** — the synchronization primitive paired with shared memory to coordinate access.
- **Memory-mapped file (mmap)** — a file's pages mapped into memory; two processes mapping the same file share those pages.
- **Direct vs indirect** — messages named to a specific process (direct) vs sent to a named **mailbox/port** any process can read (indirect).
- **Blocking vs non-blocking** — synchronous send/receive that waits vs asynchronous that returns immediately.
- **futex / eventfd** — fast kernel-assisted primitives for wakeups and lightweight signaling between processes/threads.

**Why interviewers ask this**

IPC sits at the junction of memory, concurrency, and systems design, so it's a fast probe for depth. A junior answer lists "pipes, sockets, shared memory" as trivia. A senior answer reasons about the tradeoff: shared memory is fastest *but you've reintroduced all the race conditions IPC was supposed to avoid*, so it's only a win when you also add synchronization and the data volume justifies it. Interviewers listen for whether you connect IPC back to isolation (why does this problem even exist?), whether you know that sockets are the only option across machines, and whether you can pick the right tool for a scenario — "processes on the same box exchanging megabytes many times a second" should trigger "shared memory + semaphore," not "let's send it over a socket." The signal question specifically tests whether you understand asynchronous delivery and its constraints (async-signal-safety).

**Common confusions**

- "Shared memory is always fastest, so always use it" — it's fastest *per byte after setup*, but you pay in complexity (synchronization) and it doesn't cross machines. For a one-byte notification it's overkill.
- "Pipes are bidirectional" — a plain pipe is *unidirectional*; you need two pipes, or a socketpair, for two-way flow.
- "A signal can carry data" — a classic signal carries only its number (real-time signals `sigqueue` can carry a small value, but don't assume rich payloads).
- "Message passing has no copies" — it copies data through the kernel; that copy is exactly what shared memory avoids.
- "Threads need IPC too" — threads in one process share the address space, so they communicate by just touching shared variables; they need *synchronization*, not IPC mechanisms.
- "SIGKILL can be caught and cleaned up" — SIGKILL (and SIGSTOP) cannot be caught, blocked, or ignored.

**What follows from this topic**

Shared-memory IPC is useless without the synchronization primitives from the Process Synchronization topic — a semaphore or mutex guarding the shared region is mandatory, and the producer-consumer/bounded-buffer problem *is* the canonical shared-memory IPC pattern. The copy cost of message passing ties directly to Memory Management (why copying pages is expensive) and to the fork/copy-on-write mechanism in Virtual Memory. Sockets bridge into networking. And the whole topic only exists because of the address-space isolation established by paging — remove that isolation (as threads do) and IPC collapses into ordinary shared-variable concurrency.

### Q1. Why do processes need IPC at all — why can't they just share variables like threads do?

Because of **address-space isolation**. Each process has its own virtual address space, and the MMU (see Virtual Memory) makes a pointer in one process physically unable to reach another process's memory. That isolation is a *feature* — it's why one process segfaulting or corrupting its heap can't take down another — but it means there's no shared variable to write to.

Threads are the contrast that makes this clear: threads live *inside one process*, so they share the same address space — the same heap, the same globals. Two threads communicate by one writing a variable and the other reading it. No kernel, no copy. (They still need *synchronization* to avoid races, but that's a different problem from IPC.)

So IPC is the set of OS-provided mechanisms that punch a controlled hole through the isolation wall: either the kernel maps a region into both processes (shared memory), or the kernel ferries the data across (message passing). Either way the kernel is involved because the kernel is the only entity that can see both address spaces.

### Q2. Explain the two fundamental IPC paradigms and their tradeoffs.

Every IPC mechanism is one of two shapes:

| | Shared memory | Message passing |
|---|---|---|
| How | OS maps one region into both address spaces | `send`/`receive` copy data through the kernel |
| Speed | Fastest — no kernel copy per exchange | Slower — copy + mode switches per message |
| Synchronization | App must do it (semaphore/mutex) | Kernel serializes; no shared-state races |
| Data volume | Great for bulk / high throughput | Overhead dominates for large data |
| Complexity | Higher (you own the race conditions) | Lower (safer by construction) |
| Cross-machine | No | Yes (if the transport is a socket) |

**Shared memory**: after a one-time setup, exchanging data is just reading/writing memory — CPU speed, no syscall per exchange. The catch: you've reintroduced shared mutable state, so you must coordinate access yourself, typically with a semaphore.

**Message passing**: `send()` copies your buffer into the kernel, `receive()` copies it out to the peer. The kernel serializes everything, so there are no data races — but every message pays for a copy and kernel entry/exit. Simpler and safer; slower for bulk data.

Rule of thumb: **high-throughput bulk data on one machine → shared memory + semaphore. Discrete messages, simplicity, or crossing a machine boundary → message passing.**

### Q3. What is a pipe, and how does the shell use it?

A **pipe** is a unidirectional, in-kernel byte stream with two ends: you write bytes into one end, read them out the other, FIFO order. It's a message-passing mechanism with an anonymous, buffered channel. Plain pipes work only between **related** processes (a parent creates the pipe, then `fork()`s — the child inherits the file descriptors).

The shell `|` is the canonical use. `ls | grep txt` runs like this:

```text
# shell creates a pipe, then forks two children
pipe(fd);                 // fd[0]=read end, fd[1]=write end
// child 1 (ls):   dup2(fd[1], STDOUT)  -> writes go into the pipe
// child 2 (grep): dup2(fd[0], STDIN)   -> reads come from the pipe
// ls's stdout is now grep's stdin
```

The kernel buffers the stream (a pipe has a finite capacity, ~64KB on Linux). If the buffer fills, the writer blocks; if it's empty, the reader blocks — that back-pressure is automatic flow control. This gives you the classic producer-consumer relationship for free.

### Q4. What's the difference between a pipe and a named pipe (FIFO)?

A plain **pipe** is anonymous — it exists only as file descriptors, so the only way another process gets access is to *inherit* those descriptors across `fork()`. That restricts pipes to **related** processes (parent/child/sibling).

A **named pipe** (FIFO) has a name in the filesystem (`mkfifo /tmp/myfifo`). Any process — completely **unrelated**, started independently — can `open("/tmp/myfifo")` and read or write it. The pathname is the rendezvous point:

```text
# terminal A
mkfifo /tmp/f
cat /tmp/f          # blocks, reading

# terminal B (unrelated process)
echo hello > /tmp/f # unblocks A, prints "hello"
```

Semantically it's still a unidirectional byte stream with the same blocking/back-pressure behavior; the name just removes the "must be related" constraint. It's a file in the directory but has no data blocks on disk — the bytes live in a kernel buffer, same as a pipe.

### Q5. What is a signal? Walk through what SIGINT, SIGKILL, and SIGSEGV mean.

A **signal** is an asynchronous software interrupt delivered to a process — the OS's way of saying "something happened" by interrupting normal flow and (if a handler is installed) jumping to a handler function. It's the lightest IPC: the payload is essentially just the signal number.

Common ones:

- **SIGINT (2)** — interrupt from the keyboard (Ctrl-C). Default action: terminate. Catchable — programs trap it to clean up.
- **SIGTERM (15)** — polite "please terminate" request. Catchable, so a process can shut down gracefully. The default `kill` signal.
- **SIGKILL (9)** — forcible kill. **Cannot be caught, blocked, or ignored** — the kernel just destroys the process. Use when SIGTERM is ignored.
- **SIGSEGV (11)** — segmentation fault: the process touched memory it isn't allowed to (an invalid page). Default: terminate + core dump. This is the fault mechanism from Virtual Memory surfacing as a signal.

A handler is installed with `signal()`/`sigaction()`. When the signal arrives, the kernel interrupts the process, runs the handler, then resumes. Because it interrupts at an arbitrary point, handlers must be **async-signal-safe** (see Q6).

### Q6. What is async-signal-safety and why does it constrain signal handlers?

A signal can be delivered at *any* instruction boundary — including in the middle of a `malloc()` or `printf()`. If your handler then calls `malloc()` too, it can re-enter the allocator while its internal data structures are half-updated → corruption or deadlock (the allocator's own lock is already held by the interrupted code).

So a handler may only call **async-signal-safe** functions — a specific whitelist (POSIX defines it) of functions guaranteed to be re-entrant, like `write()`, `_exit()`, `sig_atomic_t` assignments. `malloc`, `printf`, most of stdio, and anything taking a lock are **not** safe.

The standard idiom is to do almost nothing in the handler — just set a `volatile sig_atomic_t flag = 1;` — and let the main loop notice the flag and do the real work:

```c
volatile sig_atomic_t stop = 0;
void handler(int sig) { stop = 1; }   // safe: just a flag write
// main loop:
while (!stop) { /* work */ }
cleanup();
```

This constraint is why signals are for *notification*, not for shipping data or doing complex work.

### Q7. Compare the main IPC mechanisms across the dimensions that matter.

| Mechanism | Direction | Data | Relationship needed | Cross-machine | Sync built in? |
|---|---|---|---|---|---|
| Pipe | Unidirectional | Byte stream | Related (fork) | No | Yes (blocking) |
| Named pipe (FIFO) | Unidirectional | Byte stream | Unrelated (by name) | No | Yes (blocking) |
| Message queue | Uni/bi | Discrete messages | Unrelated (by key/name) | No | Yes (blocking) |
| Shared memory | N/A (direct RW) | Bulk, any structure | Unrelated (by key) | No | **No — you add a semaphore** |
| Socket | Bidirectional | Byte/datagram | Unrelated | **Yes** | Yes (blocking) |
| Signal | To a process | Just the number | Need target PID | No | Async, no data |
| mmap file | N/A (direct RW) | File-backed pages | Unrelated (by path) | No | No — you add sync |

The two axes that most often decide an interview scenario: **does it cross a machine boundary?** (only sockets do) and **how much data?** (bulk → shared memory/mmap; a notification → signal; a stream → pipe/socket).

### Q8. When would you choose shared memory over message passing, and what's the catch?

Choose **shared memory** when you're moving a lot of data, many times, between processes on the same machine, and the per-exchange copy cost of message passing would dominate. Classic cases: a database and its clients, high-frequency trading pipelines, a video frame buffer shared between a producer and a display process. After the one-time `shmget`/`mmap` setup, exchanging data is a raw memory write — no syscall, no copy.

**The catch**: you've recreated exactly the problem IPC was avoiding — two processes writing the same memory concurrently is a **race condition**. Shared memory gives you *no* synchronization. You must pair it with a **semaphore** (or mutex in shared memory) to coordinate: e.g. the producer signals "data ready," the consumer waits on it. Get the synchronization wrong and you get torn reads, lost updates, or a deadlock — the full concurrency problem set from the Synchronization topic.

So the real comparison isn't "shared memory vs message passing," it's "shared memory + I-own-the-synchronization vs message passing + the-kernel-owns-it." You trade safety for speed.

### Q9. What are message queues and how do they differ from pipes?

A **message queue** is a kernel-maintained queue of **discrete, typed messages** (POSIX `mq_*` or older System V `msg*`). A sender `send`s a whole message; a receiver `receive`s a whole message. Key differences from a pipe:

- **Message boundaries are preserved.** A pipe is a raw byte *stream* — if you write 10 bytes then 20 bytes, the reader might read all 30 at once. A message queue keeps each message as a distinct unit.
- **Messages can be typed/prioritized.** A receiver can ask for a specific message type or highest priority first, not just FIFO.
- **Persistence & decoupling.** The queue exists in the kernel independent of any process; a sender can enqueue and exit, and a reader can pick it up later. It's named (by key or `/name`), so unrelated processes use it.

Pipes are for a continuous byte stream between two cooperating processes (a shell pipeline). Message queues are for discrete, possibly prioritized units between decoupled producers and consumers.

### Q10. What are sockets, and why are they special among IPC mechanisms?

A **socket** is a bidirectional communication endpoint. Two properties make it special:

1. **It's the only mechanism here that works across machines.** With TCP or UDP, the two endpoints can be on different hosts connected by a network — the same API that does local IPC does distributed IPC. Every other mechanism (pipes, shared memory, signals, message queues) is same-machine only.
2. **It has two flavors matched to two needs.** **Unix domain sockets** (`AF_UNIX`) stay on the local machine and are fast — no network stack, the kernel just moves bytes between two local endpoints. **Internet sockets** (`AF_INET`, TCP/UDP) go over the network.

This is why network servers are socket-based: the abstraction scales from "two processes on this box" to "client in another datacenter" with the same `send`/`recv` calls. The cost is that even local Unix sockets are message-passing (a kernel copy per exchange), so for bulk local data shared memory is still faster — but sockets win the moment you might need to cross a machine boundary.

### Q11. What are memory-mapped files, and how do they enable IPC?

`mmap()` maps a file's contents directly into a process's address space, so file bytes appear as memory you can read/write with ordinary pointers — the kernel pages data in on demand and writes dirty pages back to the file.

For IPC: if two processes `mmap` the **same file** with `MAP_SHARED`, the kernel maps the *same physical pages* into both address spaces. Now one process writing to that memory is instantly visible to the other — it's shared memory, backed by a file:

```c
int fd = open("/tmp/shared", O_RDWR);
char *p = mmap(NULL, SIZE, PROT_READ|PROT_WRITE, MAP_SHARED, fd, 0);
// both processes that mmap this file see each other's writes to p[]
```

It's effectively shared memory with a name (the file path) and optional persistence (changes survive in the file). Like all shared memory, it has **no built-in synchronization** — you still need a semaphore/mutex to coordinate. Anonymous shared mmap (`MAP_ANONYMOUS | MAP_SHARED`) gives the same page-sharing without a backing file, commonly used between a parent and child after fork.

### Q12. Briefly, what are eventfd and futex used for?

Both are low-level Linux primitives that make cross-process/thread signaling cheap.

**futex** ("fast userspace mutex") is the kernel building block under mutexes, semaphores, and condition variables. The idea: in the *uncontended* case, lock/unlock is a pure userspace atomic compare-and-swap with **no syscall at all**; the kernel is only invoked (via the `futex` syscall) when a thread actually has to *wait* or *wake* someone. That's why modern mutexes are fast — the common path never enters the kernel. Placed in shared memory, a futex synchronizes across processes.

**eventfd** is a kernel-maintained counter exposed as a single file descriptor: writing adds to the counter, reading drains it, and — crucially — it's pollable with `select`/`epoll`. That makes it the standard way to wake up an event loop from another thread or process: "something happened, come look." It's a lightweight, one-fd alternative to the self-pipe trick.

You wouldn't reach for these first in an interview, but knowing that futex is *why* locks are cheap and that eventfd integrates notifications into an epoll loop signals real systems depth.

### Q13. Walk through a producer-consumer over a pipe versus over shared memory.

**Over a pipe** (message passing) — the pipe *is* the buffer and gives you synchronization for free:

```text
producer:  write(pipe_wr, item, size);   // blocks if pipe buffer full
consumer:  read(pipe_rd, buf, size);     // blocks if pipe buffer empty
```

The kernel's pipe buffer bounds the queue; full → producer blocks (back-pressure), empty → consumer blocks. You write zero synchronization code. Cost: every item is copied into the kernel and back out.

**Over shared memory** — you build the bounded buffer yourself and must synchronize it:

```text
shared: buffer[N], in, out
empty = semaphore(N)   // free slots
full  = semaphore(0)   // filled slots
mutex = semaphore(1)

producer:  wait(empty); wait(mutex); buffer[in]=item; in=(in+1)%N; signal(mutex); signal(full);
consumer:  wait(full);  wait(mutex); item=buffer[out]; out=(out+1)%N; signal(mutex); signal(empty);
```

No per-item kernel copy — data is written straight into shared memory — but *you* wrote the three-semaphore dance, and any mistake is a race or deadlock. This is the exact tradeoff of Q2 made concrete: the pipe is safe and simple but copies; shared memory is fast but you own the correctness.

### Q14. Why do threads not need these IPC mechanisms?

Because threads in one process **share the address space**. The heap, global variables, and any dynamically allocated data are all directly reachable from every thread — there's no isolation wall to punch through. Thread A stores into a global; thread B reads it. That's the whole "IPC" story for threads: ordinary memory access.

What threads *do* need is **synchronization** — mutexes, condition variables, semaphores — because now multiple threads touch the same variables concurrently and can race. But that's a different problem from the *reachability* problem IPC solves. Processes have both problems (can't reach + must coordinate); threads have only the second.

This is exactly why shared-memory IPC feels like "threads for processes": you deliberately give two processes a shared region, and the moment you do, you inherit the thread-style synchronization burden. The isolation you gave up is precisely the isolation that made processes safer than threads in the first place.

### Q15. How do two processes communicate — and how would you pick a mechanism for a given scenario?

The one-line answer: **they can't touch each other's memory, so they go through the kernel — either by sharing a kernel-mapped memory region (shared memory) or by passing messages the kernel copies between them (message passing); everything else is a variation on those two.**

Then pick by the scenario's constraints:

- **A small notification / "something happened"** → a **signal** (or eventfd for an event loop). No data, just the event.
- **A byte stream between a parent and child** → a **pipe**. Between unrelated processes → a **FIFO**.
- **Discrete, prioritized messages between decoupled producers/consumers** → a **message queue**.
- **High-throughput bulk data, same machine, exchanged constantly** → **shared memory (or mmap) + a semaphore**. Fastest, but you own the synchronization.
- **Anything that might cross a machine boundary** → a **socket** (Unix domain locally, TCP/UDP over the network).

The senior move is to name the deciding axis out loud: how much data, how often, related processes or not, same machine or not, and how much synchronization complexity you're willing to own. Those five questions pick the mechanism almost every time.

## Memory Management

### Summary

**What this topic covers**

How the OS hands out physical memory to processes and maintains the illusion that each process owns a large, private, contiguous address space — *before* we add virtual memory and paging (the next topic). This topic has 16 questions covering **logical vs physical addresses** and the **MMU** that translates between them, **address binding** (compile/load/execution time), **contiguous allocation** with **base and limit registers**, the two kinds of **fragmentation** (external vs internal), allocation strategies (**first/best/worst-fit**), **segmentation** vs **paging** as two ways to carve an address space, memory protection, the **stack vs heap** and how each is managed, and **allocators** (malloc/free, free lists, buddy, slab) with the bugs they enable (leaks, dangling pointers, double-free). The arc of the topic is a problem-driven story: contiguous allocation is simple but fragments and doesn't scale, which is *why* paging exists — this topic sets up that motivation.

**Mental model**

Think of memory management as solving three problems at once: **allocation** (who gets which physical bytes), **protection** (P1 must not read or corrupt P2), and **abstraction** (every process should see a clean, large, contiguous address space regardless of the messy physical reality). The key enabling trick is **indirection**: the CPU never emits a physical address directly. It emits a *logical* (virtual) address, and a hardware unit — the **MMU** — translates it to a physical address on every access. That one layer of indirection buys everything: you can *relocate* a process by changing the translation, *protect* memory by checking bounds during translation, and later (virtual memory) *lie* about how much RAM exists. In the simplest scheme the translation is just "add a base register"; segmentation makes it "per-segment base+limit"; paging makes it "look up a page table." Everything in this topic is a point on that spectrum from a single base register to a full page table.

**Key terms**

- **Logical / virtual address** — the address the CPU/program generates; meaningful only within a process's address space.
- **Physical address** — the actual RAM address on the memory bus.
- **MMU (Memory Management Unit)** — hardware that translates logical→physical on every memory access at runtime.
- **Address binding** — when a program's addresses are fixed to actual locations: **compile-time**, **load-time**, or **execution-time** (the last requires the MMU and enables relocation).
- **Base & limit registers** — base gives the start of a process's physical block; limit bounds its size — together they do relocation + protection in contiguous allocation.
- **External fragmentation** — enough total free memory exists, but it's split into non-contiguous holes too small to satisfy a request.
- **Internal fragmentation** — memory handed out in fixed chunks larger than requested; the unused slack *inside* a chunk is wasted.
- **First / best / worst-fit** — strategies for choosing which free hole to allocate from.
- **Segmentation** — divide the address space into variable-size logical **segments** (code/data/stack), each with its own base+limit; matches the programmer's view; suffers external fragmentation.
- **Paging** — divide memory into fixed-size **pages/frames**; no external fragmentation, small internal fragmentation (next topic).
- **Compaction** — shuffling allocated blocks together to coalesce free holes; fixes external fragmentation but is expensive.
- **Allocator** — the library-level manager of the heap (malloc/free) using free lists, buddy, or slab schemes.

**Why interviewers ask this**

This topic separates people who've only ever `malloc`'d from people who understand what's underneath. The signal senior candidates give: they frame memory management as *indirection for relocation and protection*, not just "the OS gives you RAM." The two fragmentation types are a favorite because candidates constantly mix them up — getting "external = free memory you can't use because it's scattered; internal = allocated memory you're wasting inside a block" crisp is an instant tell. Segmentation vs paging tests whether you understand *why* the industry moved to fixed-size pages (external fragmentation is fatal at scale). And the base+limit / MMU questions test whether you actually understand how hardware enforces process isolation — the thing that makes a segfault a segfault. It's also a natural launchpad: a good answer here flows straight into "…and that's why we page."

**Common confusions**

- **External vs internal fragmentation** — the single most-confused pair. External = *between* allocations (scattered free holes); internal = *within* an allocation (slack you were given but didn't ask for).
- "The CPU works with physical addresses" — no; the CPU emits *logical* addresses and the MMU translates them. That indirection is the whole game.
- "Segmentation and paging are the same idea" — segmentation uses *variable*-size logical units (and fragments externally); paging uses *fixed*-size units (and doesn't).
- "malloc asks the OS for memory every time" — usually not; the allocator grabs big chunks from the OS (`sbrk`/`mmap`) and sub-allocates from its own free lists in userspace.
- "The stack and heap are managed the same way" — the stack is auto-managed by the compiler via the frame pointer (LIFO, push/pop on call/return); the heap is manually or GC-managed and fragments.
- "Best-fit wastes the least memory" — best-fit minimizes leftover *per allocation* but tends to litter tiny unusable holes, often fragmenting *worse* than first-fit.

**What follows from this topic**

This topic is the on-ramp to **Virtual Memory & Paging**: contiguous allocation's fatal flaw (external fragmentation + inability to exceed physical RAM) is exactly the problem paging solves, and the base/limit → segment table → page table progression continues directly there. The MMU introduced here becomes the address-translation hardware that the TLB accelerates. Protection via base/limit generalizes to per-page permission bits and the segfault path. And the allocator/heap discussion connects to IPC (shared-memory regions are allocated too) and to any language-runtime or GC topic.

### Q1. What is the difference between a logical address and a physical address?

A **logical address** (a.k.a. virtual address) is what the CPU generates when a program runs — it's relative to the process's own address space. A **physical address** is the actual location on the RAM chips, on the memory bus.

They differ because of a deliberate layer of **indirection**: the program is written and compiled as if it owns memory starting at some address, but it's actually loaded somewhere else in physical RAM (and, with virtual memory, may not be fully in RAM at all). The **MMU** translates logical→physical on every single memory access at runtime.

```text
CPU emits logical addr ──► [ MMU translate ] ──► physical addr ──► RAM
```

Why bother? Three payoffs: **relocation** (a process can sit anywhere in physical memory; just change the translation), **protection** (the MMU checks each access against the process's bounds), and **virtual memory** (the translation can point to disk, enabling more virtual memory than physical). The set of all logical addresses a process can generate is its *logical address space*; the set of corresponding physical addresses is its *physical address space*.

### Q2. What is the MMU and what does it do on every memory access?

The **MMU (Memory Management Unit)** is a hardware component (part of the CPU) that translates **logical addresses to physical addresses at runtime**, on every load, store, and instruction fetch.

In the simplest scheme its job is: take the logical address, add the process's **base** register, and check it's below the **limit** — if not, raise a trap (segfault). In a paging system its job is: split the address into a page number and offset, look up the page number in the page table to get a frame, and combine frame+offset (accelerated by the TLB — next topic).

The crucial points for an interview:

- It runs **in hardware, per access** — translation can't be a slow software step or every instruction would crawl.
- It's what makes **isolation** real: because P1's addresses only ever translate to P1's physical frames, P1 *cannot even name* P2's memory. A pointer bug in P1 traps instead of corrupting P2.
- It's the enforcement point for **protection bits** (read/write/execute permissions), so writing to read-only memory or executing data faults.

Without an MMU (some tiny embedded chips), all processes share one flat physical space with no protection.

### Q3. Explain the three types of address binding.

Address binding is *when* a program's symbolic addresses get tied to real memory locations:

- **Compile-time binding** — the compiler generates absolute physical addresses. Only works if you know at compile time exactly where the program will load. Rigid: move it and you must recompile. (Old MS-DOS `.COM` files.)
- **Load-time binding** — the compiler generates *relocatable* code; final addresses are computed when the program is loaded into memory. You can load it anywhere, but once loaded it can't move (relocating means re-doing the binding).
- **Execution-time (run-time) binding** — addresses stay logical until the instruction actually executes, and the **MMU** translates them on the fly. This is what real systems use: a process can be *moved in physical memory even while running*, swapped out and back to a different location, and paged. It requires hardware support (the MMU).

The progression is compile → load → execution = increasing flexibility, requiring increasing hardware support. Execution-time binding is what enables virtual memory, relocation, and swapping — everything modern.

### Q4. What is contiguous memory allocation, and how do base and limit registers support it?

**Contiguous allocation** gives each process a *single contiguous block* of physical memory. The whole process image (code, data, heap, stack) lives in one run of physical addresses.

Two registers make this safe and relocatable:

- **Base register** — the physical start address of the process's block.
- **Limit register** — the length (or top) of the block.

On every access the MMU does:

```text
if (logical_addr < limit)
    physical_addr = base + logical_addr;   // relocate
else
    TRAP;                                   // protection violation (segfault)
```

That single check delivers **relocation** (the process thinks it starts at 0; base slides it anywhere) and **protection** (anything ≥ limit is outside the process and traps, so it can't touch other processes). Context-switching just reloads base/limit for the next process.

The problem it creates (see Q5/Q6): as processes of different sizes come and go, free memory gets carved into scattered holes — **external fragmentation** — and a process can't be larger than a single contiguous free hole. That fatal limitation is what drives paging.

### Q5. What is the difference between internal and external fragmentation?

This is the single most-confused pair in the topic, so be crisp:

- **External fragmentation** — total free memory is sufficient, but it's split into **non-contiguous holes**, none big enough for the request. The waste is *between* allocations. Example: 100MB free but as ten scattered 10MB holes, and you need 15MB contiguous — you fail despite plenty of free memory. Afflicts contiguous allocation and segmentation.
- **Internal fragmentation** — memory is handed out in **fixed-size chunks larger than requested**, and the leftover slack *inside* the chunk is wasted and unusable by anyone else. The waste is *within* an allocation. Example: you ask for 5KB, the system allocates a 8KB page, 3KB is dead. Afflicts fixed partitioning and paging (the last page).

```text
External:  [P1][free][P2][free][P3][free]   free bits scattered, can't combine
Internal:  [P1 uses 5K | 3K wasted ][P2 ...]  waste sealed inside the block
```

Mnemonic: **ex**ternal = **ex**terior to allocations (holes between them); **in**ternal = **in**side an allocation. Paging trades external fragmentation (eliminated) for a little internal fragmentation (the last partial page).

### Q6. What is compaction and why is it expensive?

**Compaction** is the fix for external fragmentation: physically relocate the allocated blocks so they sit adjacent, sliding all the scattered free holes together into one large contiguous free region.

```text
before:  [P1][ free ][P2][ free ][P3][ free ]
after:   [P1][P2][P3][      free (coalesced)      ]
```

Now a large request that couldn't fit in any single hole fits in the combined space.

It's expensive because:

- It requires **copying large amounts of memory** — physically moving process images around, which is slow and stalls the affected processes.
- It only works if binding is **execution-time** (the MMU/base register lets you move a process and just update its base). With compile/load-time binding you couldn't relocate at all.
- You must pause/relocate live processes, so it hurts responsiveness.

Because compaction is so costly, it's largely a *symptom-treatment*. The real answer the industry adopted was to stop requiring contiguity at all — that's **paging**, which eliminates external fragmentation by design, so compaction becomes unnecessary.

### Q7. Compare first-fit, best-fit, and worst-fit allocation strategies.

When allocating from a list of free holes, which hole do you pick?

| Strategy | Picks | Pro | Con |
|---|---|---|---|
| **First-fit** | The first hole big enough (scan from start) | Fast; good in practice | Clutters the front of memory with fragments |
| **Best-fit** | The *smallest* hole that fits | Minimizes leftover per allocation | Slow (scans all); leaves many *tiny* unusable slivers → often worse overall fragmentation |
| **Worst-fit** | The *largest* hole | Leftover hole stays big enough to reuse | Slow; quickly consumes the big holes you'd want for large requests |

The counterintuitive result: **best-fit is not best**. By always shaving the tightest hole it litters memory with fragments too small to ever use, and studies (and practice) show **first-fit** is usually as good or better on both speed and utilization. Worst-fit generally performs poorly. Interview takeaway: name first-fit as the pragmatic default, and be ready to explain *why* best-fit's local optimization backfires globally.

### Q8. What is segmentation?

**Segmentation** divides a process's address space into **variable-size logical segments** that match the programmer's mental model: a code segment, a data segment, a stack segment, a heap segment, etc. Each segment is a logically distinct unit that can grow independently and gets its own protection.

A logical address is a pair **(segment number, offset)**. A per-process **segment table** stores, for each segment, a **base** (where it starts in physical memory) and a **limit** (its length):

```text
logical (seg=2, offset=100)
   -> segment_table[2] = { base=8000, limit=400 }
   -> if 100 < 400:  physical = 8000 + 100 = 8100
   -> else: TRAP (out of segment bounds)
```

Advantages: it matches the logical structure of a program (you can share just the code segment between processes, set the code segment read-execute and the data segment read-write), and segments can grow.

The fatal flaw: because segments are **variable-sized** and each must be contiguous in physical memory, segmentation suffers **external fragmentation** exactly like contiguous allocation — free memory gets carved into holes that don't fit the next segment. That's why pure segmentation lost to paging.

### Q9. Compare segmentation and paging.

| | Segmentation | Paging |
|---|---|---|
| Unit | Variable-size logical **segments** (code/data/stack) | Fixed-size **pages/frames** |
| Address | (segment #, offset) | (page #, offset) |
| Table | Segment table (base + limit per segment) | Page table (frame # per page) |
| View | Matches programmer's logical structure | Purely physical, invisible to the programmer |
| External fragmentation | **Yes** (variable sizes leave holes) | **No** (any page fits any frame) |
| Internal fragmentation | Minimal | **Yes** — the last partial page |
| Sharing/protection | Natural, per logical segment | Per page (less semantically meaningful) |

The decisive difference is **fixed vs variable size**. Because pages are all the same size, *any* free frame can hold *any* page — there's no "this hole is the wrong size" problem, so **no external fragmentation**. The cost is a little internal fragmentation (a process's last page is usually not full) and losing the natural logical grouping segmentation gave you. Modern systems overwhelmingly use paging; some (x86) historically combined both.

### Q10. Why would you combine segmentation and paging?

Because they solve different problems and their weaknesses cancel. Segmentation gives you the **logical structure and protection** the programmer wants (distinct code/data/stack segments, per-segment permissions and sharing). Paging gives you **no external fragmentation and easy physical allocation**. Pure segmentation fragments externally; pure paging loses logical structure.

**Segmented paging** does both: the address space is divided into logical segments, but each segment is then **paged** rather than being one contiguous physical block. So you keep segmentation's logical view and protection, but because each segment is broken into fixed-size pages, those pages can scatter across any free frames — killing external fragmentation.

The classic example is x86, which has a segmentation layer (segment selectors → linear address) feeding into a paging layer (linear → physical). In practice modern OSes (Linux, Windows) set segmentation up as a near no-op (flat segments covering the whole space) and rely almost entirely on paging — segmentation's logical benefits turned out not to be worth the complexity once paging was universal. So the honest interview answer: you *can* combine them to get both benefits, but the industry effectively chose "just paging."

### Q11. How does the OS enforce memory protection?

Protection is enforced by the **MMU during translation**, on every access — it's not a periodic check, it's inline with each load/store/fetch.

Two mechanisms depending on the scheme:

- **Base/limit (contiguous/segmentation)**: the MMU verifies the address falls within the process's block (`offset < limit`). Anything outside traps immediately. This bounds a process to its own memory.
- **Per-page permission bits (paging)**: each page-table entry carries **read / write / execute** bits (plus a user/supervisor bit). The MMU checks the access type against the bits: writing a read-only page, executing a no-execute page, or a user-mode process touching a kernel page all raise a **protection fault** → the kernel delivers **SIGSEGV**.

```text
access page -> PTE says {present, R=1, W=0, X=0}
  read:  ok
  write: PROTECTION FAULT -> trap -> SIGSEGV
```

The general principle: because *all* memory access is funneled through hardware translation, the OS gets a mandatory checkpoint on every access essentially for free. A violation traps into the kernel, which typically kills the offending process. This is the machinery behind "segmentation fault" and behind features like W^X (write-xor-execute) and NX/DEP that harden against exploits.

### Q12. What is the difference between the stack and the heap, and how is each managed?

Both live in a process's address space but are managed completely differently:

| | Stack | Heap |
|---|---|---|
| Allocation | Automatic, LIFO | Manual (`malloc`/`free`) or GC |
| Managed by | Compiler, via the stack/frame pointer | The allocator library + programmer |
| Speed | Very fast (just move the pointer) | Slower (search free lists) |
| Lifetime | Tied to function call (freed on return) | Until explicitly freed / collected |
| Fragments? | No (strict LIFO) | Yes |
| Typical bugs | Overflow (too deep recursion) | Leaks, dangling pointers, double-free |

**Stack**: on each function call the compiler pushes a **stack frame** (return address, saved registers, locals, parameters) by decrementing the stack pointer; on return it pops by restoring the pointer. Allocation/free is a single register adjustment — nearly free — and strictly LIFO, so it never fragments. But it's small and fixed-ish; unbounded recursion overflows it.

**Heap**: for data that must outlive the creating function or whose size isn't known at compile time. The allocator carves the heap into blocks on request and reclaims them on free, maintaining free lists. Flexible and large, but the programmer (in C/C++) owns correctness — mismanagement causes leaks (never freed), dangling pointers (used after free), and double-frees (see Q14).

### Q13. What does a memory allocator (malloc/free) actually do under the hood?

`malloc`/`free` manage the **heap in userspace**, sitting between your program and the OS. Crucially, `malloc` does *not* call into the kernel on every allocation — that would be far too slow. Instead:

- The allocator obtains **large chunks** of memory from the OS occasionally via `sbrk` (grow the heap) or `mmap` (map a region), then **sub-allocates** from those chunks itself.
- It tracks free blocks in **free lists** (linked lists of available blocks, often bucketed by size). `malloc(n)` searches for a suitable free block (first/best-fit); `free(p)` returns the block to a list and coalesces adjacent free blocks to fight fragmentation.
- Each block carries **metadata** (size, free/used, links) usually in a header just before the returned pointer — which is why writing before your buffer can corrupt the allocator.

Common allocator schemes:

- **Free lists / segregated fits** (glibc's ptmalloc, jemalloc, tcmalloc) — size-bucketed lists, per-thread arenas to reduce lock contention.
- **Buddy system** — memory in power-of-two blocks; split a block in half ("buddies") to satisfy a request, merge buddies on free. Fast coalescing, some internal fragmentation. Used by the Linux kernel's page allocator.
- **Slab allocator** — pre-allocated caches of fixed-size objects (e.g. kernel structs); allocation is just grabbing a pre-formed slot. Near-zero fragmentation for objects of that size, very fast. Used in kernels for frequently allocated fixed structures.

### Q14. What bugs do manual allocators enable — leaks, dangling pointers, double-free?

Because the programmer owns `malloc`/`free` correctness (in C/C++, absent a GC), three classic bugs arise:

- **Memory leak** — memory is allocated but never `free`d and the pointer is lost. It stays reserved forever; a long-running process's memory grows until it's killed (OOM). Not immediately fatal, but a slow death.
- **Dangling pointer (use-after-free)** — you `free(p)` but keep using `p`. The block may have been reallocated to something else, so reads return garbage and writes corrupt unrelated data. A major security vulnerability class (exploitable to hijack control flow).
- **Double-free** — calling `free(p)` twice. The second free corrupts the allocator's internal free-list metadata (it links a block that's already linked), which can crash later or be exploited to overwrite arbitrary memory.

```c
char *p = malloc(16);
free(p);
free(p);          // DOUBLE FREE — corrupts allocator metadata
char *q = malloc(16);
*p = 'x';         // DANGLING/USE-AFTER-FREE — p may now alias q's block
// (and if we'd never freed p and lost it → LEAK)
```

Mitigations: set pointers to `NULL` after free (makes double-free/UAF a safe null deref), use RAII/smart pointers (C++), garbage collection or ownership (Java, Go, Rust), and tools like ASan/Valgrind. These bugs are exactly why memory-safe languages exist.

### Q15. Work through a fragmentation calculation.

**Internal fragmentation with pages.** Page size = 4KB. A process needs exactly 15KB. Pages are allocated whole, so it gets ⌈15/4⌉ = 4 pages = 16KB. Internal fragmentation = 16KB − 15KB = **1KB wasted** in the last page. On average, internal fragmentation is about half a page per process (here up to ~4KB), which is why very large pages waste more.

**External fragmentation with contiguous allocation.** Memory holes (in KB): `[10][20][5][30]`, total free = 65KB. A request for **35KB** arrives. There's 65KB free — but no *single* hole ≥ 35KB, so the request **fails**. That's external fragmentation: sufficient total, unusable because scattered. Compaction would slide the holes together into one 65KB region, then it fits.

**Base + limit translation.** base = 20000, limit = 500. Logical address 350: `350 < 500` ✓ → physical = 20000 + 350 = **20350**. Logical address 600: `600 < 500` ✗ → **TRAP (segfault)**, because it's outside the process's block.

These three little computations — internal waste from rounding up to pages, external failure from scattered holes, and the base+limit add-and-check — are exactly the kind of thing interviewers ask you to do on a whiteboard to confirm you understand the mechanisms, not just the vocabulary.

### Q16. Why doesn't fixed contiguous allocation scale, and how does paging fix it?

Contiguous allocation has two structural problems that get worse as systems grow:

1. **External fragmentation** — processes of varying sizes come and go, carving free memory into scattered holes. Eventually you have plenty of *total* free memory but no single hole large enough. Compaction fixes it but is expensive (copying live memory).
2. **A process can't exceed a single contiguous free hole**, and it can't exceed physical RAM at all. You can't run a program bigger than the largest available block.

**Paging** fixes both by dropping the contiguity requirement. Divide the address space into fixed-size **pages** and physical memory into equal **frames**; a per-process **page table** maps each page to *any* frame:

- Because pages are **fixed-size**, any page fits any frame → **no external fragmentation** (only a little internal fragmentation on the last page).
- Because a process's pages can be **scattered across arbitrary frames**, it doesn't need one big contiguous block.
- And because the page table can mark pages as "on disk," a process can be **larger than physical RAM** — the foundation of virtual memory.

So the story of this whole topic ends by handing off to the next one: contiguous allocation is simple but fragments and can't scale past RAM; paging trades a small amount of internal fragmentation and a translation table for the elimination of external fragmentation and the ability to over-commit memory. That's **Virtual Memory & Paging**.

## Virtual Memory & Paging

### Summary

**What this topic covers**

The mechanism that lets each process believe it has a huge, private, contiguous memory even though physical RAM is smaller and shared — and how a memory access actually gets from a virtual address to a byte in RAM (or triggers a fetch from disk). This topic has 18 questions covering the **core idea of virtual memory**, **paging** (pages ↔ frames), the **page table** and its bits, **address translation** step by step, **multi-level and inverted page tables**, the **TLB** (the cache that makes translation fast, and why context switches hurt it), **demand paging** and the full **page-fault path** end to end, **minor vs major faults** and their cost, page-size tradeoffs, **copy-on-write** (cheap fork), and shared pages. It deliberately stops before **page-replacement algorithms and thrashing** (LRU/Clock/FIFO/Belady, working set) — those are the next topic; here we build the machinery, there we decide *which page to evict* when memory is full.

**Mental model**

Virtual memory is a giant, mostly-lazy lookup table plus a lie. The lie: every process is told "you have a 2^48-byte private address space starting at 0." The reality: only the pages you're actively touching are in RAM; the rest are on disk or don't exist yet. The lookup table: a per-process **page table** maps virtual page → physical frame. Every memory access splits the virtual address into a **page number** (which table entry) and an **offset** (which byte within the page), looks up the frame, and concatenates frame+offset. Because doing that lookup in RAM on every access would double memory traffic, a hardware cache — the **TLB** — remembers recent translations so the common case skips the table walk. And because loading everything up front is wasteful, pages are brought in **on demand**: touch a page that isn't resident and the hardware traps to the kernel (a **page fault**), which finds the page, drops it in a frame, and restarts your instruction as if nothing happened. Hold those four ideas — table, split-and-lookup, TLB cache, fault-on-demand — and the rest is detail.

**Key terms**

- **Virtual memory** — the abstraction of a large, private, contiguous address space that can exceed physical RAM by keeping inactive pages on disk.
- **Page / frame** — fixed-size block of the virtual address space (page, e.g. 4KB) / of physical memory (frame, same size).
- **Page table** — per-process map from virtual page number → physical frame number, plus status bits.
- **Valid/present bit** — is this page currently in RAM? If not, accessing it faults.
- **Dirty bit / referenced bit** — has the page been written / recently accessed? (Used by replacement, next topic.)
- **Offset** — the low bits of a virtual address selecting a byte within a page; passes through translation unchanged.
- **TLB (Translation Lookaside Buffer)** — small, fast hardware cache of recent virtual→physical translations; a **hit** skips the page-table walk.
- **Page-table walk** — the (hardware or software) traversal of the page table(s) on a TLB miss.
- **Demand paging** — load a page only on first access, not up front (lazy loading).
- **Page fault** — a trap raised when a program accesses a page not currently in RAM (or an illegal page).
- **Minor vs major fault** — page already in memory (just needs a mapping) vs must be read from disk.
- **Copy-on-write (COW)** — after fork, parent and child share pages read-only and copy a page only on the first write.
- **Multi-level page table** — page table that is itself paged, to avoid one giant flat table for a huge address space.
- **ASID / PCID** — tags on TLB entries so a context switch needn't flush the whole TLB.

**Why interviewers ask this**

This is the deepest-signal topic in OS fundamentals, so it's where interviewers separate memorizers from people who understand the machine. The two set-piece questions — "walk me through address translation" and "walk me through a page fault end to end" — reward candidates who can trace the whole path (split the address → TLB → page table → present bit → trap → disk → frame → restart) and punish hand-waving. The TLB is a favorite because it connects to performance intuition (*why* is a context switch expensive? *why* do random access patterns thrash?). Copy-on-write tests whether you know how `fork()` is actually cheap. And the interviewer is listening for the economic framing: disk is ~100,000× slower than RAM, so the entire design is organized around keeping the page-fault rate near zero — a candidate who quantifies that understands why virtual memory works at all.

**Common confusions**

- "The page table is searched linearly" — no; the virtual page *number* directly *indexes* the table (it's an array lookup), and the TLB caches recent results. Inverted tables are the exception.
- "A page fault means an error" — a *minor/major* page fault is normal, expected operation (demand paging). Only an access to an invalid page is the error (→ SIGSEGV).
- "The TLB caches data" — it caches *translations* (virtual page → frame), not memory contents; that's the CPU's L1/L2 data caches.
- "Bigger pages are strictly better" — bigger pages shrink the page table and improve TLB coverage but increase internal fragmentation and read-in cost.
- "fork() copies all the parent's memory" — modern fork shares pages **copy-on-write**; it copies a page only when one side writes it.
- "Translation always walks the page table" — only on a TLB *miss*; a TLB *hit* (the overwhelming common case) skips it entirely.
- "Context switches are cheap" — beyond saving registers, they often flush the TLB (unless ASIDs are used), so the new process runs slow until the TLB refills.

**What follows from this topic**

This topic builds the *machinery*; the next one — **Page Replacement & Thrashing** — supplies the *policy*: when demand paging needs a free frame and none exists, *which* resident page do you evict? That's where FIFO (and Belady's anomaly), Optimal, LRU and its Clock/second-chance approximations, the working-set model, and thrashing live — all of which assume the page-fault mechanism established here. The TLB and page tables also connect forward to performance and security (Meltdown/Spectre exploited speculative page-table/permission behavior), and copy-on-write ties back to `fork()` in the Processes topic and to the copy costs discussed in IPC.

### Q1. What is virtual memory and what problem does it solve?

**Virtual memory** gives each process the illusion of a large, contiguous, private address space that can be **bigger than physical RAM**, by keeping only the actively-used pages in memory and the rest on disk (swap). The OS + MMU translate the process's virtual addresses to physical frames on the fly, faulting pages in from disk when they're first touched.

It solves three problems at once:

1. **Capacity** — programs can be larger than physical RAM (and the sum of all running programs can exceed RAM), because only the working set needs to be resident. You get the illusion of near-infinite memory.
2. **Isolation** — each process has its *own* address space and page table, so it literally cannot name another process's memory. One process's bug can't corrupt another.
3. **Simplicity of allocation** — each process sees a clean, contiguous space starting at 0, regardless of how fragmented physical memory is; the page table hides the scatter. This also enables sharing (map the same frame into two processes) and cheap `fork` (copy-on-write).

The enabling trick throughout is **indirection**: virtual addresses are translated, not used directly, so the OS can put a page anywhere, on disk, shared, or copy-on-write — and the program never knows.

### Q2. What is paging and how do pages relate to frames?

**Paging** divides the **virtual** address space into fixed-size **pages** and **physical** memory into equal-size **frames** (same size, e.g. 4KB). Any virtual page can be placed in any physical frame; the **page table** records the mapping.

```text
Virtual pages          Physical frames
[ page 0 ] ───────────► [ frame 5 ]
[ page 1 ] ───────────► [ frame 2 ]
[ page 2 ] ──(on disk)  (not resident)
[ page 3 ] ───────────► [ frame 9 ]
```

The consequences of fixed size:

- **No external fragmentation** — because every page is the same size as every frame, any free frame can hold any page; there's never a "hole of the wrong size" problem.
- **A little internal fragmentation** — a process's memory rarely divides evenly, so the last page is usually partly empty (on average half a page wasted per region).
- **Pages need not be contiguous in RAM** — page 0 and page 1 can be in frames 5 and 2, physically far apart, but the process sees them as adjacent virtual addresses. That's what lets a process be scattered across whatever frames are free.

Paging is the mechanism that made contiguous allocation's fragmentation and scaling problems (previous topic) go away.

### Q3. What is a page table and what information does each entry hold?

A **page table** is a per-process data structure that maps each **virtual page number (VPN)** to a **physical frame number (PFN)**. It's the source of truth the MMU consults to translate addresses. Per-process, because each process has its own address space — a context switch swaps the active page table (on x86, reload CR3).

Each **page-table entry (PTE)** holds the frame number *plus* status/control bits:

- **Valid/present bit** — is this page currently in a physical frame? If 0, accessing it triggers a **page fault** (it's on disk, or the address is illegal).
- **Protection bits** — read / write / execute permissions; violating them traps (→ SIGSEGV). Also a user/supervisor bit.
- **Dirty (modified) bit** — set by hardware when the page is written. On eviction, a clean page can be dropped for free; a dirty page must be written back to disk.
- **Referenced (accessed) bit** — set when the page is accessed; used by page-replacement algorithms (next topic) to approximate LRU.
- **Frame number** — the physical frame this page maps to (meaningful only if valid).

```text
VPN ──► PTE: [ frame# | valid | R/W/X | dirty | referenced ]
```

The valid bit is the linchpin of demand paging; the dirty and referenced bits feed replacement policy.

### Q4. Walk me through virtual-to-physical address translation with an example.

A virtual address is split into two parts: the high bits are the **page number** (which page table entry) and the low bits are the **offset** (which byte within the page). The offset passes through translation *unchanged*; only the page number is translated to a frame number.

Concrete example. Page size = 4KB = 2^12, so the **offset is 12 bits**. Suppose a 32-bit virtual address, so **page number = top 20 bits**.

```text
Virtual address (32 bits):  [ 20-bit page number | 12-bit offset ]

Translate virtual address 0x00002ABC:
  page number = 0x00002   (top 20 bits)
  offset      = 0xABC     (low 12 bits)

  page_table[0x00002] -> frame number = 0x00007 (say), valid=1

  physical address = (frame << 12) | offset
                   = 0x00007000 | 0xABC
                   = 0x00007ABC
```

Steps: (1) split the address; (2) index the page table with the page number to get the frame number (checking the valid bit — if invalid, page fault); (3) concatenate frame number with the untouched offset to form the physical address. In hardware this is a **TLB lookup first** (Q6); the page-table access only happens on a TLB miss. Note the offset is unchanged because the byte's position *within* a page is identical in the page and the frame — only the block's location moves.

### Q5. Why do we need multi-level page tables?

Because a single flat page table for a large address space would be enormous. Consider a 48-bit virtual address space with 4KB pages: that's 2^36 pages, and at ~8 bytes per PTE the table would be 2^39 bytes = **512 GB per process** — absurd, especially since most of the address space is unused.

**Multi-level (hierarchical) page tables** fix this by **paging the page table itself**. The virtual page number is split into several fields, each indexing one level:

```text
[ L1 index | L2 index | L3 index | L4 index | offset ]   (x86-64: 4 levels)

CR3 -> L1 table -> L2 table -> L3 table -> L4 table -> frame
```

The win: you only allocate the lower-level tables for regions of the address space that are actually used. A process touching a few gigabytes needs only a handful of second/third/fourth-level tables, not the full fan-out — the sparse, mostly-empty address space costs almost nothing.

The tradeoff: a page-table *walk* now takes **multiple memory accesses** (4 for x86-64, one per level) instead of one. That's exactly why the **TLB** matters so much — it caches the final translation so the multi-level walk is skipped on the common path.

### Q6. What is the TLB and why is it essential?

The **TLB (Translation Lookaside Buffer)** is a small, very fast, fully/highly-associative hardware cache inside the MMU that stores recent **virtual-page → physical-frame** translations. It exists because the page table lives in RAM, and walking it on *every* memory access — especially a multi-level walk of 4 accesses — would make every memory reference several times slower.

On each access the MMU checks the TLB first:

- **TLB hit** — the translation is cached; you get the frame number immediately, skipping the page-table walk. This is the overwhelmingly common case (hit rates ~99%), because programs exhibit **locality** — they keep touching the same handful of pages.
- **TLB miss** — not cached; do the full page-table walk (hardware-walked on x86, sometimes software-walked on MIPS), then **install** the resulting translation in the TLB (evicting an old entry) so the next access to that page hits.

```text
access ──► [TLB] ─hit──► frame  (fast: ~1 cycle)
             │
            miss
             ▼
        page-table walk (slow: multiple RAM accesses)
             ▼
        install into TLB, retry
```

The TLB is why virtual memory is affordable: locality means the expensive translation is amortized to near-zero. It caches *translations*, not data (that's the separate L1/L2 caches). Its small size is exactly why access patterns with poor locality (huge random strides) suffer — they miss the TLB constantly.

### Q7. Why do context switches hurt TLB performance, and how do ASIDs/PCIDs help?

TLB entries are translations for a *specific* process's address space — virtual page 5 means different frames in P1 and P2. So on a naive context switch, the kernel must **flush the entire TLB**, because leaving P1's entries around would let P2 translate its addresses using P1's mappings — a correctness disaster (P2 would read P1's memory).

The cost: after the flush, the newly scheduled process starts with a **cold TLB** — every early memory access misses and pays a full page-table walk until the TLB refills with its working set. That's a big hidden chunk of context-switch cost, on top of saving/restoring registers. Frequent context switching (or lots of processes) means constantly cold TLBs.

**ASIDs / PCIDs** (Address Space IDs / Process-Context IDs on x86) fix this by **tagging each TLB entry with the process it belongs to**. The MMU only treats an entry as a hit if its ASID matches the current process. Now P1's and P2's translations can **coexist** in the TLB, so a context switch needn't flush — it just changes the current ASID. When you switch back to P1, its still-warm entries are valid again. This turns context switches from "TLB catastrophe" into "cheap," which is why modern CPUs and kernels use them (and why the Meltdown mitigation's forced TLB flushes were so costly on CPUs without PCID).

### Q8. What is demand paging?

**Demand paging** is loading a page into memory **only when it's first accessed**, rather than loading the whole program up front. It's lazy loading applied to memory.

When a process starts (or `mmap`s a file), the OS sets up its page table but marks most pages **not present** (valid bit = 0) — nothing is actually read from disk yet. The first time the process touches such a page, the access **faults**, and the kernel brings *that page* in on the spot (Q9). Pages that are never touched are never loaded.

Why it's a win:

- **Faster startup** — a program that's 500MB on disk but only exercises 20MB of code/data pays to load ~20MB, not 500MB.
- **Less memory used** — only the actual **working set** is resident, so more processes fit in RAM.
- **Enables over-commit** — since only touched pages consume frames, the OS can promise more virtual memory than it has physical RAM, betting most of it won't be touched at once.

The bet relies on **locality**: programs use a small, slowly-changing subset of their pages at any time. Demand paging is what makes "a process bigger than RAM" and "many processes sharing RAM" actually work — at the price of occasional page faults.

### Q9. Walk me through a page fault from start to finish.

A **page fault** is a trap raised by the MMU when a program accesses a page whose valid bit is 0. Here's the full path:

```text
1. CPU accesses virtual address; MMU finds PTE valid bit = 0  ──► TRAP to kernel
2. Kernel page-fault handler runs. Is this address legal for the process
   (in a mapped region with the right permissions)?
      NO  ──► illegal access ──► deliver SIGSEGV (segfault). Done.
      YES ──► it's a valid page that just isn't resident. Continue.
3. Find where the page's contents live: the backing store —
   swap space, or a file (for mmap'd / executable pages), or zero-fill (new page).
4. Find a free frame. If none free ──► run page replacement (next topic):
   pick a victim; if the victim is dirty, write it back to disk first.
5. Schedule the disk read to load the page into the chosen frame.
   The process BLOCKS (goes to Waiting) while the (slow) I/O happens;
   the scheduler runs someone else.
6. I/O completes. Update the PTE: set frame number, valid bit = 1, permissions.
   Install the translation in the TLB.
7. RESTART the faulting instruction. To the process it's as if nothing happened —
   the access now succeeds.
```

The three things interviewers want to hear: (1) the fault handler **first distinguishes a legal-but-not-resident page from an illegal access** (the latter is the segfault case); (2) it may have to **evict a victim** (write it back if dirty) to get a frame; (3) it **restarts the faulting instruction** so the program continues transparently. The whole thing is invisible to the program except as a time delay.

### Q10. What is the difference between a minor and a major page fault?

Both are page faults (the page wasn't mapped for this access), but they differ enormously in cost because one touches disk and the other doesn't:

- **Minor (soft) fault** — the page is **already in physical memory**, it just isn't mapped in *this* process's page table yet, so no disk I/O is needed. Examples: the page is in the OS's page cache (another process already loaded that file), a copy-on-write page being wired up, a freshly zero-filled page, or a shared library already resident. The handler just fixes up the PTE. Fast — microseconds.
- **Major (hard) fault** — the page is **not in memory at all** and must be **read from disk** (swap or a file). This pays real disk/SSD latency and blocks the process. Slow — hundreds of microseconds to milliseconds.

```text
minor: page in RAM already ──► just update the page table          (fast)
major: page on disk        ──► read from disk into a frame, then map (slow)
```

Why it matters: `major` faults are the expensive ones you want to minimize (they mean you're actually going to disk). Tools report both (`ps`, `/proc`, `getrusage` distinguish `minflt` vs `majflt`). A process with a soaring **major** fault rate is thrashing (next topic); a high *minor* fault count is often benign.

### Q11. How expensive is a page fault, and how do you compute effective access time?

A major page fault is catastrophically expensive *relative to RAM* because it involves disk I/O. Rough orders of magnitude: an L1 cache hit ~1ns, a RAM access ~100ns, an SSD read ~100,000ns (100µs), a spinning-disk read ~10,000,000ns (10ms). So a disk page fault is on the order of **100,000× to a million× slower than a normal memory access**. That single fact dictates the entire design: keep the fault rate microscopically low.

**Effective Access Time (EAT)** quantifies the damage. With page-fault probability `p`, memory access time `ma`, and fault service time `pf`:

```text
EAT = (1 - p) * ma  +  p * pf
```

Example: `ma` = 100ns, `pf` = 8,000,000ns (8ms disk service), fault rate `p`:

```text
p = 0        -> EAT = 100 ns
p = 0.001    -> EAT = 0.999*100 + 0.001*8,000,000 ≈ 100 + 8,000 = 8,100 ns   (81× slower!)
p = 0.0000001 -> EAT ≈ 100 + 0.8 = 100.8 ns   (<1% slowdown)
```

The lesson the numbers scream: because `pf` is so vast, even a **tiny** fault rate destroys performance. A 1-in-1000 fault rate makes memory 80× slower. To keep the slowdown under a few percent you need fault rates around 1-in-a-million or better — which is exactly what locality + a well-sized working set + the TLB deliver in practice. This is also the setup for the *thrashing* discussion in the next topic (what happens when RAM is too small to hold working sets and `p` explodes).

### Q12. What are the tradeoffs of a larger page size?

Page size is a fundamental knob with pros and cons on both sides:

**Larger pages (e.g. 2MB / 1GB "huge pages" vs 4KB):**

- **Smaller page tables** — fewer pages to map for the same memory, so fewer PTEs and shallower/less walking.
- **Better TLB coverage** — each TLB entry covers more memory, so a fixed-size TLB spans a larger working set → far fewer TLB misses (big win for large-memory workloads like databases and JVMs).
- **Fewer page faults** — each fault brings in more data; fewer transfers for sequential access, and disk I/O is more efficient in big blocks.

**But larger pages cost:**

- **More internal fragmentation** — the last page's waste is bigger; a process needing 10KB with 2MB pages wastes almost 2MB.
- **Higher fault/read-in cost** — bringing in a huge page reads a lot of data, some of which may never be used (wasted I/O and memory).
- **Coarser granularity** — protection, sharing, and copy-on-write all happen per page, so big pages make them less precise.

That's why real systems use **both**: a small base page (4KB) for fine-grained general use, plus optional **huge pages** for workloads that touch lots of memory with good locality (databases, VMs) where TLB coverage dominates. The tradeoff is fundamentally table-size/TLB-coverage/fault-efficiency (favor big) vs fragmentation/precision/wasted-I/O (favor small).

### Q13. What is copy-on-write and how does it make fork() cheap?

`fork()` is supposed to give the child a *complete copy* of the parent's address space. Copying gigabytes eagerly would be absurdly slow — especially since the child usually immediately calls `exec()` and throws it all away. **Copy-on-write (COW)** avoids the copy until it's actually needed.

How it works: on `fork()`, the parent and child **share the same physical frames**, and every shared page is marked **read-only** in both page tables (a COW flag records that it's really shared-writable-someday). No data is copied — fork is nearly instant.

Then, the first time *either* process **writes** a shared page:

```text
1. Write to a read-only COW page ──► protection fault ──► trap to kernel.
2. Kernel sees it's a COW page (not a real error).
3. Kernel allocates a new frame, copies the page's contents into it.
4. Updates the writing process's PTE to point at the private copy, marks it writable.
5. Restart the write. Now each process has its own copy of just that page.
```

So only pages that are actually modified get copied, and only one page at a time, on demand. If the child `exec()`s immediately, essentially *nothing* gets copied. This is why `fork()` is fast on modern Unix. The same trick underlies efficient process snapshotting, `vfork` optimizations, and redis-style fork-based persistence. It's a beautiful example of the whole virtual-memory theme: because access goes through the page table, the OS can share, protect, and lazily copy pages invisibly to the program.

### Q14. How are pages shared between processes?

Because translation goes through per-process page tables, the OS can map the **same physical frame into multiple processes' page tables** — giving controlled sharing without copying. Two big uses:

- **Shared libraries** — libc, and other `.so`/DLLs, are read-only executable code. Rather than every process loading its own copy, the OS loads the library's pages **once** into physical frames and maps those same frames into every process that uses it. Dozens of processes share one physical copy of libc, saving enormous memory. Because the pages are read-only, sharing is safe.
- **Explicit shared memory (IPC)** — `shmget`/`mmap(MAP_SHARED)` deliberately map the same frames into two processes' address spaces so writes by one are visible to the other. This is the shared-memory IPC mechanism from the IPC topic — fast because there's no copy, but requiring synchronization because both can write.

Copy-on-write (Q13) is a special case: pages shared read-only after fork, privatized on write.

The enabling insight is the same throughout the topic: the **virtual→physical mapping is per-process and arbitrary**, so the same physical frame can appear at different virtual addresses in different processes, read-only or read-write, shared or private — all transparent to the programs, all enforced by the MMU and the permission bits in the PTEs.

### Q15. Briefly, what is an inverted page table and when is it used?

A normal page table has **one entry per virtual page, per process** — so with huge virtual address spaces and many processes, the tables (even multi-level) consume a lot of memory. An **inverted page table** flips the relationship: there's **one entry per physical frame**, shared system-wide, and each entry records *which process + virtual page* currently occupies that frame.

```text
Normal:    per process, indexed by virtual page number  -> frame
Inverted:  one global table, indexed by frame number    -> (pid, virtual page)
```

The benefit: the table size is proportional to **physical** memory (fixed, small) rather than the sum of all processes' **virtual** address spaces — a big memory saving when virtual spaces are vast.

The cost: you can no longer *index* by virtual page number to find the frame; you have to **search** for the entry whose (pid, vpage) matches — implemented with a **hash table** to keep it fast. It also complicates shared pages (one physical frame, but potentially multiple virtual mappings). Used on architectures like PowerPC and older IA-64. For an interview, know it exists, know the tradeoff (saves memory, costs a hash lookup instead of a direct index), and that most mainstream systems use hierarchical (multi-level) tables instead.

### Q16. What determines whether a memory access to an invalid page is a normal page fault or a segfault?

Every access to a not-present page traps into the kernel identically — the *hardware* just sees "valid bit = 0." The kernel's page-fault handler then **decides** which kind it is by consulting the process's memory-region metadata (the list of legal mappings — VMAs on Linux):

- **Legal-but-not-resident** — the faulting address falls within a **mapped region** the process is allowed to access, with permissions matching the access type (e.g. it's within the heap, a mmap'd file, or the stack's growable area, and the page is merely swapped out or never-yet-loaded). → The kernel services it: bring the page in (demand paging), fix the PTE, restart the instruction. Normal operation.
- **Illegal access** — the address is **not in any valid mapping** (a wild/NULL pointer dereference), or it *is* mapped but the permission is wrong (writing a read-only page, executing NX memory). → The kernel delivers **SIGSEGV**; the process typically dies with "segmentation fault" and a core dump.

```text
fault ──► handler checks: is addr in a legal VMA with matching permission?
            yes ──► demand-page it in, retry   (normal page fault)
            no  ──► SIGSEGV                      (segmentation fault)
```

So "page fault" and "segfault" aren't different hardware events — a **segfault is the outcome when the page fault handler determines the access was illegal**. This is why the very first step of the page-fault path (Q9) is the legality check. It's also why touching a freed/dangling pointer sometimes segfaults and sometimes silently corrupts: it segfaults only if the address landed outside any valid mapping.

### Q17. What is prepaging, and how does it differ from demand paging?

Pure **demand paging** is reactive: it loads a page *only after* it faults. That means a process starting up (or resuming after being swapped out) takes a **burst of page faults** — one per page in its working set — as it touches each page for the first time. Each fault is a separate, latency-bound disk trip.

**Prepaging (prefetching)** is proactive: the OS **loads pages before they're accessed**, guessing what the process will need, to avoid that flurry of faults. Two common triggers:

- **On startup / swap-in** — bring in the process's whole expected working set at once, in one efficient bulk I/O, rather than fault-by-fault.
- **On a fault, read ahead** — when a page faults, also bring in the next few sequential pages, betting on **spatial locality** (sequential access is common). Great for streaming through a file.

The tradeoff is a **bet on locality**: if the prefetched pages *are* used, you win big — bulk sequential I/O is far more efficient than many random faults, and the process never stalls. If they're *not* used, you've wasted disk bandwidth and frames on pages the process didn't want (and maybe evicted useful pages). So prepaging pays off exactly when access is predictable (sequential scans, known working sets) and hurts when it's random. Real systems prefetch conservatively (readahead heuristics) and back off when their guesses prove wrong.

### Q18. The interview one-liner: what is virtual memory, how does translation and the TLB work, and what happens on a page fault?

The three-part answer an interviewer wants, tightened:

**What virtual memory is.** Each process gets a large, private, contiguous **virtual** address space that can exceed physical RAM. Only the actively-used pages are in RAM; the rest sit on disk. The illusion buys capacity (run programs bigger than RAM), isolation (each process has its own page table, can't touch others), and easy allocation/sharing.

**How translation + the TLB work.** Memory is split into fixed-size **pages** (virtual) and **frames** (physical); a per-process **page table** maps page → frame. A virtual address = **page number + offset**; translation replaces the page number with a frame number and leaves the offset alone. Doing that lookup in RAM every access would be slow, so the **TLB** — a small hardware cache of recent translations — is checked first: a **hit** gives the frame in ~1 cycle; a **miss** walks the (multi-level) page table and caches the result. Locality makes hits ~99%.

**What happens on a page fault.** Access a page whose valid bit is 0 → **trap to the kernel**. The handler first checks legality: illegal → **SIGSEGV**; legal-but-not-resident → find the page (disk/swap), grab a free frame (evicting a victim if none free, writing it back if dirty), read the page in while the process blocks, update the PTE + TLB, and **restart the faulting instruction**. To the program it's just a pause.

Then hand off: "…and *which* page to evict when memory is full — FIFO, LRU, Clock, the working-set model, and thrashing — is page replacement, the next topic."
## Page Replacement & Thrashing

### Summary

**What this topic covers**

What the OS does when demand paging runs out of free frames: it must **replace** a resident page to make room for the one being faulted in. This topic is the mechanism (the page-fault-triggered eviction path, the dirty-bit write-back), the **algorithms** that pick the victim (Optimal, FIFO, LRU and its cheap approximations Clock/second-chance), the classic exam skill of **counting page faults** for a reference string under each algorithm, **Belady's anomaly**, **frame allocation** policy (how many frames each process gets, global vs local replacement), and the failure mode when a process has too few frames for what it's actively touching: **thrashing**, formalised by the **working set model** and controlled by page-fault-frequency and admission control. The 16 questions here run from "what is a page fault vs a page replacement" up to "diagnose why this box is thrashing and fix it." It sits directly downstream of demand paging and the page table — assume you already know what a page fault is; here we decide *which frame it evicts*.

**Mental model**

Physical RAM is a small, fully-occupied set of **frames**; the sum of every process's virtual pages is much larger. Paging works at all only because of **locality of reference** — over any short window a process touches a tiny, slowly-drifting subset of its pages (its **working set**), so most accesses hit resident frames and faults are rare. Replacement is a **caching problem**: RAM is a cache for the disk-backed address space, and you want to evict the block you'll need again farthest in the future. You can't see the future, so you approximate it from the past (LRU) or approximate LRU cheaply (Clock). As long as every process's working set fits in RAM, the fault rate stays low. Push the degree of multiprogramming too high and the working sets no longer collectively fit; every fault steals a frame another process needed, so *that* process faults, and the system collapses into **thrashing** — all disk, no compute. The whole topic is: minimise faults, and keep working sets resident.

**Key terms**

- **Page replacement** — on a fault with no free frame, choosing a resident page to evict so its frame can be reused.
- **Victim page** — the page chosen for eviction.
- **Dirty bit (modified bit)** — set by hardware on write; a dirty victim must be written back to disk before eviction, a clean one can be dropped.
- **Optimal (OPT / MIN)** — evict the page whose next use is farthest in the future; provably minimal faults, but unimplementable — the benchmark.
- **FIFO** — evict the oldest-loaded page; ignores usage and suffers Belady's anomaly.
- **Belady's anomaly** — for some strings, *adding* frames *increases* faults (FIFO only, not stack algorithms).
- **LRU (Least Recently Used)** — evict the page unused for the longest; a strong OPT approximation, but true LRU needs per-access timestamp/stack updates.
- **Reference bit** — set by hardware on any access; the cheap signal LRU approximations use.
- **Second-chance / Clock** — circular scan; a page with reference bit set gets a second chance (bit cleared, skipped); cheap approximate-LRU.
- **Working set** — the set of pages a process referenced in the last Δ accesses; keep it resident to avoid faults.
- **Thrashing** — too little RAM for the working sets → the system spends almost all its time paging, CPU utilisation collapses.
- **Prepaging** — bringing in a batch of expected pages proactively instead of one fault at a time.

**Why interviewers ask this**

It's the sharpest test of whether you understand virtual memory as a *cache*, not just a lookup table. A junior can define a page fault; a senior can count faults for a reference string under FIFO/LRU/OPT, explain *why* LRU beats FIFO (recency correlates with reuse; age doesn't), and reproduce Belady's anomaly on demand. The thrashing question is a favourite because it's an operational reality: "the server got slow and CPU dropped to 5% when we added more workers — why?" A strong answer names thrashing, ties it to working sets exceeding RAM, and reaches for the *right* fix (reduce multiprogramming / add RAM), not the wrong one (add more workers — which makes it worse). Clock comes up because it's what real kernels actually ship, so it separates textbook LRU from production reality.

**Common confusions**

- "A page fault always means an error." No — a fault is the *normal* demand-paging mechanism; only an invalid-address fault is an error.
- "Page replacement happens on every fault." Only when there's no free frame; if a frame is free, no eviction is needed.
- "LRU and Optimal are the same." LRU looks at the *past*, OPT at the *future*; LRU is an approximation and can be much worse on some strings.
- "More frames always means fewer faults." True for stack algorithms (LRU/OPT) but *false* for FIFO — that's Belady's anomaly.
- "Clock is just FIFO." Clock uses the reference bit to give recently-used pages a reprieve, so it approximates LRU, not FIFO.
- "Thrashing means the disk is full." It means RAM is too small for the active working set; the disk is busy *paging*, not full.
- "Adding more processes always increases throughput." Past a point it triggers thrashing and throughput crashes.

**What follows from this topic**

This closes out the virtual-memory arc that began with paging, the page table, and the TLB. The victim eventually gets written to (or read from) disk, which hands off to **File Systems** (where those pages live as swap or memory-mapped files) and to **Storage & Disk I/O** (why a fault that hits disk costs millions of cycles, and why the page/buffer cache exists). Thrashing also connects back to **CPU scheduling** and the degree of multiprogramming: the scheduler's admission decisions are exactly what a working-set or page-fault-frequency policy constrains.

### Q1. When does page replacement happen, and what does the OS do step by step?

Replacement happens on a **page fault** *when there is no free frame* to hold the incoming page. If a free frame exists, the OS just loads the page — no eviction. When memory is full:

```text
1. Trap: process references a page that's valid but not resident → page fault.
2. Find a free frame. If none, run the replacement algorithm to pick a VICTIM.
3. Is the victim DIRTY (modified bit set)?
      yes → write it back to its backing store (swap/file) first.
      no  → just drop it (disk copy is still current) — saves one write.
4. Update the victim's page-table entry: valid bit = 0 (now non-resident).
5. Read the faulting page from disk into the freed frame.
6. Update the faulting page's PTE: frame number + valid bit = 1.
7. Restart the faulting instruction.
```

The **dirty bit** is the key optimisation: a clean page's on-disk copy is still authoritative, so eviction is free (no write). Only dirty pages pay the write-back cost — which is why some algorithms prefer to evict clean pages. Each page-in that also requires a write-back costs *two* disk I/Os, so keeping the fault rate and the dirty-eviction rate low is the whole game.

### Q2. What is the goal of a page-replacement algorithm?

Minimise the **page-fault rate** for a given number of frames — equivalently, evict the page **least likely to be used soon** so you don't immediately fault it back in. Since RAM is a cache for the disk-backed address space, this is exactly the cache-eviction problem: you want to keep the pages you'll reuse and discard the ones you won't. Every algorithm below is a different guess at "least likely to be used soon" — OPT knows it, LRU infers it from recency, Clock approximates LRU cheaply.

### Q3. Explain the Optimal (OPT/MIN) algorithm.

**Rule:** evict the page whose *next* reference is **farthest in the future** (or never used again). This provably yields the **minimum possible** number of faults for any reference string and frame count — it's the theoretical benchmark every other algorithm is measured against.

It's **unimplementable** in practice because it requires knowing the future reference string. Its value is diagnostic: run OPT offline on a trace to see how close your real algorithm gets. If LRU is near-OPT on your workload, don't bother optimising; if there's a big gap, there's headroom.

### Q4. Walk through counting page faults for a reference string under FIFO, LRU, and OPT.

Reference string `7 0 1 2 0 3 0 4 2 3`, **3 frames**, all initially empty. `*` marks a fault.

```text
FIFO (evict oldest-loaded):
ref  7* 0* 1* 2* 0  3* 0* 4* 2* 3*
frames:
 [7][7,0][7,0,1][0,1,2][0,1,2][1,2,3][2,3,0][3,0,4][0,4,2][4,2,3]
faults = 9

LRU (evict least-recently-used):
ref  7* 0* 1* 2* 0  3* 0  4* 2* 3*
 [7][7,0][7,0,1][2,0,1][2,0,1][2,0,3][2,0,3][4,0,3][4,0,2][4,3,2]
faults = 8

OPT (evict page used farthest in future):
ref  7* 0* 1* 2* 0  3* 0  4* 2  3
 [7][7,0][7,0,1][2,0,1][2,0,1][2,0,3][2,0,3][2,4,3][2,4,3][2,4,3]
faults = 7
```

Pattern to remember: **OPT ≤ LRU ≤ FIFO** on typical strings (OPT is optimal; LRU usually beats FIFO because recency predicts reuse). The interview move is to build the frame table column by column and mark faults — narrate the eviction choice at each fault.

### Q5. What is FIFO replacement and what's wrong with it?

**Rule:** evict the page that has been **in memory the longest** (oldest load time) — a simple FIFO queue of frames.

Problems: (1) it **ignores usage** — a page loaded long ago but hammered constantly (e.g. a hot loop's code) gets evicted just for being old; (2) it suffers **Belady's anomaly** (next question). Its only virtue is cheapness — a pointer to the oldest frame, no per-access bookkeeping. Real systems don't use pure FIFO; they use Clock, which is FIFO's scan structure *plus* the reference bit to protect recently-used pages.

### Q6. Explain Belady's anomaly with an example.

**Belady's anomaly:** giving FIFO **more frames** can cause **more** faults — the opposite of the intuition that more memory always helps.

Classic string `1 2 3 4 1 2 5 1 2 3 4 5`:

```text
FIFO with 3 frames → 9 faults
FIFO with 4 frames → 10 faults   ← more frames, MORE faults
```

It happens because FIFO's eviction order isn't a subset relationship: the set of pages resident with N frames is not guaranteed to be a superset of the set resident with N−1 frames, so adding a frame can evict a page you were about to reuse. Algorithms that *don't* suffer it are **stack algorithms** (LRU, OPT), where the resident set with N frames always contains the resident set with N−1 frames — so more frames can never hurt. Belady's anomaly is essentially the reason "just use LRU/Clock, not FIFO."

### Q7. Explain LRU and why it approximates Optimal well.

**LRU (Least Recently Used):** evict the page that has gone **unused for the longest time**. It's OPT with the arrow of time reversed — OPT looks at the farthest *future* use, LRU at the farthest *past* use. It works because of **temporal locality**: a page used recently is likely to be used again soon, so the least-recently-used page is a good guess for "least likely to be used soon."

LRU is a **stack algorithm**, so it's immune to Belady's anomaly. On most real workloads it comes close to OPT. Its weakness is pathological scans: a sequential pass over data larger than RAM (e.g. a big table scan) defeats LRU completely — every page is used exactly once, so LRU evicts pages that would have been reused. That's why some systems special-case scan-resistant eviction.

### Q8. Why is true LRU expensive to implement in hardware?

True LRU requires knowing the exact recency order of *every* frame on *every* memory access. Two textbook implementations, both costly:

- **Timestamp/counter:** stamp each page's PTE with a clock value on every reference; on eviction, scan for the smallest. Cost: a memory write on *every* access, plus an O(frames) scan on eviction.
- **Stack:** maintain a doubly-linked stack of page numbers; on each reference, unlink the page and move it to the top. Cost: pointer surgery on *every* access.

Doing per-access bookkeeping in hardware for every load/store is prohibitively expensive, so real MMUs don't. Instead hardware provides a single cheap **reference bit**, and the OS approximates LRU from it (Clock). That's the whole reason approximations exist.

### Q9. How does the Clock (second-chance) algorithm work?

Clock is the workhorse **LRU approximation** real kernels ship. Frames sit in a **circular list** with a "hand" pointer; each frame has a hardware **reference bit** (set on any access).

```text
On a fault needing a victim, starting at the hand:
  look at the frame under the hand:
    reference bit == 0  → this is the victim. Evict it. Advance hand.
    reference bit == 1  → give it a SECOND CHANCE:
                            clear the bit to 0, advance the hand, repeat.
```

A page that's been touched since the hand last passed (bit = 1) survives one sweep but has its bit cleared; if it isn't touched again before the hand returns, it gets evicted. This cheaply approximates LRU: recently-used pages keep resetting their bit and survive, cold pages get caught with bit = 0. It's called "clock" because the hand sweeps around like a clock face. Cost is O(1) amortised with only a single bit per frame — hence its ubiquity.

### Q10. What is the enhanced (second-chance) clock using reference AND dirty bits?

Enhanced Clock ranks victims by the pair **(reference bit, dirty bit)** to prefer evicting pages that are both cold *and* clean (clean = no write-back cost):

| Class | (ref, dirty) | Meaning | Preference |
|---|---|---|---|
| 0 | (0, 0) | not used, clean | **evict first** — free, no write-back |
| 1 | (0, 1) | not used, dirty | evict, but must write back |
| 2 | (1, 0) | used, clean | keep if possible |
| 3 | (1, 1) | used, dirty | **keep** — hot and expensive |

The hand sweeps looking for a class-0 page; if none is found in the first pass, it lowers standards (clearing reference bits as it goes) and takes the lowest available class. This saves disk writes by favouring clean victims — a dirty eviction costs *two* I/Os (write-back + read-in), a clean one costs one.

### Q11. What are LFU and MFU replacement?

Both use a per-page **reference count**:

- **LFU (Least Frequently Used):** evict the page with the **smallest** count — assumes rarely-used pages won't be needed. Problem: a page used heavily during startup builds a huge count and then sticks around uselessly forever (stale frequency); needs *aging* (decay counts over time) to be viable.
- **MFU (Most Frequently Used):** evict the **most**-used page — argues the low-count page was just brought in and hasn't had its turn yet.

Neither approximates OPT as well as LRU/Clock, and both are more expensive (a counter per page), so they're rarely used as primary policies. They show up mostly as textbook contrasts and inside hybrid caches (e.g. ARC, LFU-with-aging in some object caches).

### Q12. How are frames allocated among processes — equal vs proportional, global vs local?

Two orthogonal decisions:

**How many frames each process gets:**
- **Equal allocation:** split frames evenly — simple but wasteful (a tiny process and a huge one get the same).
- **Proportional allocation:** give each process frames in proportion to its virtual size (or priority) — a 200-page process gets more than a 20-page one. Better fit to actual need.

**Whose frames can a fault steal (replacement scope):**
- **Local replacement:** a faulting process can only evict *its own* frames. Predictable per-process behaviour; a process can't be hurt by others, but can't borrow spare frames either.
- **Global replacement:** a faulting process can evict *any* process's frame. Higher overall throughput and adapts to changing demand, but a process's fault rate now depends on others' behaviour — and global replacement is what makes system-wide thrashing possible. Most real systems use global replacement with working-set or PFF guards to bound the damage.

### Q13. Explain the working set model.

The **working set** W(t, Δ) is the set of pages a process referenced in the last **Δ** memory accesses (the working-set window). By locality, this set is small and stable over short periods and drifts as the process moves between phases (e.g. init → main loop → shutdown).

The model's prescription: **keep each process's entire working set resident**, and the process will fault rarely (only when its working set shifts). Summing working-set sizes across all runnable processes gives the total frame demand D. The admission rule: if D ≤ available frames, everyone fits — run them all. If **D > frames**, the system is over-committed → **suspend/swap out** a process to shrink demand. This is the theoretical basis for preventing thrashing: the scheduler admits processes only while their combined working sets fit in RAM. Choosing Δ matters — too small misses the true locality, too large includes stale pages.

### Q14. What is the page-fault-frequency (PFF) scheme?

PFF controls allocation by **measuring the fault rate directly** instead of tracking working sets explicitly. Define an acceptable fault-rate band [low, high] per process:

```text
if fault rate > HIGH  → process has too few frames → GIVE it more frames
if fault rate < LOW   → process has more than it needs → TAKE frames away
```

If the fault rate is too high and **no free frames** exist to give, that's the thrashing signal → **suspend a process** and free its frames for the others. PFF is a practical, feedback-driven alternative to computing working sets: the fault rate is a direct proxy for "does this process have enough frames for its current locality?" It's cheaper to measure and self-correcting.

### Q15. What is thrashing, what causes it, and how do you fix it?

**Thrashing:** a process (or the whole system) has **too few frames for its working set**, so almost every memory access faults; the CPU spends nearly all its time waiting on disk paging in/out instead of executing. Throughput collapses.

The classic curve — and the trap:

```text
CPU utilisation
   ^
   |            _____ peak
   |          /      \
   |        /          \        ← past here, adding more processes
   |      /              \        makes utilisation CRASH (thrashing)
   |    /                  \___________
   +--------------------------------------> degree of multiprogramming
```

The seductive-but-wrong feedback loop: CPU utilisation is low → scheduler thinks "add more processes to use the idle CPU" → more processes means less RAM each → working sets no longer fit → more faults → *even lower* CPU utilisation → scheduler adds *more* processes → collapse.

**Causes:** degree of multiprogramming too high; too little physical RAM; a single process with a working set larger than RAM; global replacement letting one greedy process steal everyone's frames.

**Fixes:** (1) **reduce the degree of multiprogramming** — suspend/swap out processes so the rest fit; (2) **working-set or PFF admission control** — only admit a process if its working set fits; (3) **add physical RAM**; (4) local (not global) replacement to contain the damage to the offending process; (5) a better replacement algorithm if the fault rate is high despite adequate frames.

### Q16. How do locality of reference and prepaging relate to all this?

**Locality of reference** is *why paging works at all.* If programs accessed memory uniformly at random, no small cache (RAM) could hold a useful fraction of the address space and the fault rate would be catastrophic. In reality programs exhibit **temporal locality** (a page used now is likely reused soon → LRU/Clock are effective) and **spatial locality** (nearby addresses are used together → whole-page granularity and read-ahead pay off). Locality is what makes the working set small, stable, and worth keeping resident.

**Prepaging** exploits spatial/phase locality to cut *fault count*: instead of faulting pages in one at a time (a fault, and its full disk-latency stall, per page), the OS proactively brings in a **batch** of pages it expects to be needed — e.g. on process start-up (load the initial working set at once) or when swapping a suspended process back in (restore its whole working set together). The tradeoff: if the guess is wrong, you've wasted I/O and frames on pages that never get used. Done well against real locality, prepaging amortises disk latency and smooths the fault curve.

## File Systems

### Summary

**What this topic covers**

How the OS turns a flat array of disk blocks into named files and directories you can create, read, seek in, and delete — and keeps that structure intact across crashes. This topic is the **file** and **directory** abstractions, the **open-file** machinery (per-process fd table → system-wide open-file table → inode), the **inode** and why a file's *name* lives in a directory entry rather than in the inode (which is what makes **hard links** and **symbolic links** possible), the three **allocation methods** (contiguous, linked/FAT, indexed) with the classic Unix direct + single/double/triple **indirect** block scheme and its max-file-size calculation, **free-space management**, **journaling** for crash consistency (versus copy-on-write filesystems), the **VFS** layer that makes ext4/NTFS/FAT/NFS all look the same to applications, and mounting. Its 16 questions run from "what's an inode" to "why does journaling prevent corruption" to "what happens to a symlink when its target is deleted." It sits on top of **Storage & Disk I/O** (the block device beneath) and connects to virtual memory (memory-mapped files, swap, the page cache).

**Mental model**

A disk is a giant numbered array of fixed-size **blocks** with no notion of "file." A file system is the bookkeeping that imposes structure on top: it decides which blocks belong to which file, how to find a file by name, and which blocks are free. Think of it as three lookups chained together: **name → inode number** (via a directory, which is just a special file mapping names to inode numbers), **inode number → metadata + block pointers** (via the inode table), and **block pointers → data blocks** (via direct and indirect pointers). The crucial design decision is that the *name is not in the inode* — it's in the directory entry — so one inode (one file) can have many names (hard links) and directories are just files whose contents are name→inode mappings. Everything else — allocation strategy, free-space tracking, journaling — is about making those three lookups fast, space-efficient, and crash-safe.

**Key terms**

- **File** — a named collection of bytes plus metadata (attributes); the fundamental storage abstraction.
- **Inode** — on-disk structure holding a file's metadata (size, permissions, timestamps, owner) and pointers to its data blocks; identified by inode number. The name is *not* in it.
- **Directory** — a special file mapping names → inode numbers; the structure that gives files their names.
- **File descriptor (fd)** — a small per-process integer indexing into the process's open-file table.
- **Open-file table** — system-wide table of open files, each entry holding the current file **offset** and a pointer to the inode; fds point here.
- **Hard link** — a second directory entry pointing at the *same* inode; equal-status name for one file, tracked by the inode's link count.
- **Symbolic (soft) link** — a separate file whose contents are a *path* to another file; can dangle if the target is deleted.
- **Allocation method** — how a file's blocks are laid out: contiguous, linked (FAT), or indexed.
- **Indirect block** — a block full of pointers to data blocks (single), or to other pointer blocks (double/triple), letting inodes address huge files.
- **Journaling** — a write-ahead log of intended changes so a crash can be recovered to a consistent state by replay or rollback.
- **VFS (Virtual File System)** — a kernel abstraction layer giving every filesystem a uniform interface (open/read/write/…).
- **Mounting** — grafting a filesystem onto a directory in the existing namespace.

**Why interviewers ask this**

File systems are where "understands the OS abstraction" meets "understands durability." A junior can say a file has a name and some bytes; a senior can explain that the name is in the directory, the metadata is in the inode, and *why* that separation is what makes hard links work — and can then reason about what happens to open file descriptors when a file is unlinked (the data survives until the last fd closes). The inode indirect-block max-size calculation is a beloved whiteboard problem because it tests whether you can reason from a data-structure layout to a concrete number. Journaling is the durability litmus test: can you explain why a crash mid-write corrupts a filesystem and how a write-ahead log fixes it? Hard-vs-soft links, and their behaviour on target deletion, catch people who've only used the commands without understanding the model.

**Common confusions**

- "The filename is stored in the inode." No — it's in the *directory entry*; the inode has no name. This is the single most important fact in the topic.
- "A hard link is a copy." No — it's another name for the *same* inode/data; edits through either name are visible through both.
- "Deleting a file frees its space immediately." Only when the inode's link count hits zero *and* no process has it open; open fds keep the data alive.
- "A symlink and a hard link are basically the same." A symlink is a separate file holding a *path* and can dangle; a hard link is a peer directory entry to the same inode and can't dangle.
- "Journaling means every byte is written twice." Default (metadata/ordered) journaling logs *metadata*, not full data; full data journaling is the slow opt-in.
- "The VFS is a filesystem." It's an *interface layer*; real filesystems (ext4, NTFS) plug into it.
- "Contiguous allocation is best because it's fast." Fast to read, but suffers external fragmentation and can't grow — which is why nobody uses it for general-purpose filesystems.

**What follows from this topic**

Everything here rides on **Storage & Disk I/O**: allocation methods are chosen partly to minimise seeks on an HDD (contiguous is seek-optimal, linked is seek-hostile), and the **page/buffer cache** that makes file reads fast is a storage-layer concern. Journaling's durability guarantees depend on the storage layer honouring write ordering and `fsync` (which is why write-back caches and barriers matter). The inode/page interaction shows up in **virtual memory** via memory-mapped files and swap. And the VFS abstraction is conceptually the same "uniform interface over diverse backends" move that containers and device drivers make elsewhere in the OS.

### Q1. What does a file system actually do?

A file system organises, names, stores, and retrieves data on persistent storage, presenting the **file and directory abstraction** over a raw array of fixed-size disk blocks. Concretely it provides four things:

1. **Naming** — map human names (and hierarchical paths) to on-disk data via directories.
2. **Allocation** — decide which blocks hold which file's data and track them (the allocation method).
3. **Free-space management** — know which blocks are unused so new data has somewhere to go.
4. **Metadata + protection** — store each file's size, timestamps, owner, and permissions, and enforce access.

Above these it exposes operations — create, open, read, write, seek, truncate, delete — and below them it talks to the block device. It also increasingly guarantees **crash consistency** (journaling / copy-on-write) so a power loss doesn't corrupt the structure.

### Q2. What is a file, and what metadata does it carry?

A **file** is a named, ordered collection of bytes — the OS imposes no structure on the contents (it's just bytes; interpretation is the application's job). Alongside the data, the file system stores **attributes / metadata**, almost all of which live in the **inode**:

- **Name** — the exception: stored in the *directory entry*, not the inode.
- **Size** in bytes.
- **Type** — regular file, directory, symlink, device, etc.
- **Permissions / ownership** — owner, group, mode bits (or ACLs).
- **Timestamps** — created, last modified (mtime), last accessed (atime), inode-changed (ctime).
- **Location** — the block pointers (direct + indirect) telling the FS where the data lives.
- **Link count** — how many hard links (directory entries) point at this inode.

### Q3. Explain the file-descriptor / open-file-table machinery.

Three chained tables, which is what makes `dup`, `fork`-sharing, and independent offsets all work:

```text
Per-process fd table        System-wide open-file table         Inode table
   fd 0 ─┐
   fd 1 ─┼─► entry: {offset=0, mode=r} ──► inode (metadata + blocks)
   fd 3 ─┘
   (another process)
   fd 4 ───► entry: {offset=512, mode=w} ─► (same inode)
```

- **fd table** (per process): the small integers your code uses (`0/1/2` = stdin/out/err). Each slot points into the open-file table.
- **Open-file table** (system-wide): one entry per `open()` call, holding the current **file offset** and access mode, and a pointer to the inode. Two independent `open()`s of the same file get *separate* offsets; `dup()`/`fork()` *share* one entry (so they share an offset).
- **Inode** (one per file): the actual metadata and block pointers, reference-counted so it stays alive while any fd or link references it.

This is why `read()` advances *your* offset without disturbing another process reading the same file, and why unlinking an open file doesn't free it until the last fd closes.

### Q4. How do directories work, and how does path resolution happen?

A **directory** is just a special file whose contents are a table of `(name → inode number)` entries. Directory structures evolved:

- **Single-level** — one flat namespace (early systems); name collisions across users.
- **Two-level** — a directory per user; still no nesting.
- **Tree** — the standard: directories nest arbitrarily, giving hierarchical paths.
- **Acyclic graph** — allow shared subtrees via links, but forbid cycles (which would break reference counting and traversal).

**Path resolution** walks the tree one component at a time. For `/home/alice/f`: start at the root inode (a known inode number), read its data to find `home`'s inode number, read *that* directory to find `alice`, then find `f`. An **absolute** path starts at `/` (root); a **relative** path starts at the process's current working directory. Every directory contains two special entries: **`.`** (itself) and **`..`** (its parent) — which is how `cd ..` works and how the resolver climbs back up.

### Q5. What is an inode, and why isn't the filename in it?

An **inode** is the on-disk structure that *is* the file: it holds all the metadata (size, type, permissions, owner, timestamps, link count) plus the **pointers to the data blocks**. Each inode has a unique **inode number**; the inode table is indexed by it.

The filename is deliberately kept out of the inode and placed in the **directory entry** instead. That separation is the whole design:

- **One inode, many names** → **hard links**. Two directory entries can point at the same inode number; the file has two equal-status names. The inode's **link count** tracks how many; the data is freed only when the count hits zero.
- **Directories are just files** mapping names to inode numbers, which keeps the model uniform.
- **Rename is cheap** — you change a directory entry, not the file's data or inode.

So "a file" is really *an inode plus its data blocks*; names are external references to it.

### Q6. Hard link vs symbolic (soft) link — including what happens when the target is deleted.

| | Hard link | Symbolic (soft) link |
|---|---|---|
| What it is | Another directory entry → same inode | A separate file whose *contents* are a path string |
| Points to | The inode (data) directly | A pathname (resolved at access time) |
| Cross-filesystem? | No (inode numbers are per-FS) | Yes |
| Link to a directory? | No (would risk cycles) | Yes |
| If target is deleted | Data survives while link count > 0 | Link **dangles** — resolves to a missing path |
| Extra inode? | No (shares the target's) | Yes (its own inode holding the path) |

**On deletion:** delete one hard-link name and the file's link count merely drops; as long as another hard link remains, the data is fully intact and reachable — there is no "original," all hard links are peers. Delete the target of a **symlink** and the symlink still exists but now points at nothing — a **dangling link** that fails on access. This asymmetry (hard links keep data alive; symlinks can dangle) is the classic interview payoff.

### Q7. Explain contiguous file allocation and its tradeoffs.

**Contiguous allocation** stores a file in a run of consecutive blocks; the inode needs only a **start block + length**.

- **Pros:** excellent **sequential** read (no seeks between blocks) and simple **random access** (block = start + offset). Minimal metadata.
- **Cons:** **external fragmentation** — as files are created and deleted, free space breaks into scattered holes, and eventually no single hole is big enough for a new file even though total free space suffices. And files **can't grow** past their allocated run without being relocated, which forces you to guess final size up front.

Because of these, general-purpose filesystems don't use it — but it lives on where files are write-once and size-known (some archive/media formats, CD-ROM/ISO layouts).

### Q8. Explain linked allocation and FAT.

**Linked allocation** gives each file a chain: each data block contains a pointer to the *next* block; the inode holds only the first (and maybe last) block pointer.

- **Pros:** no external fragmentation (any free block works), and files grow trivially (append a block, fix a pointer).
- **Cons:** **terrible random access** — to read block N you must traverse blocks 0..N−1. Each block also loses space to the pointer. Worst of all, a **single corrupted pointer loses the entire rest of the file** — the chain is severed.

**FAT (File Allocation Table)** is the important variant: it pulls the "next block" pointers *out* of the data blocks and into a single **table** at the front of the volume, indexed by block number. Random access improves (you can chase the chain in the in-memory FAT without reading data blocks), and the FAT can be cached wholesale. It's still a linked list, but a much more practical one — hence its long life in FAT16/FAT32 on removable media.

### Q9. Explain indexed allocation and the Unix inode's direct + indirect pointers.

**Indexed allocation** gives each file an **index block** listing *all* its data-block numbers. This delivers **direct random access** (jump straight to the Nth pointer) with **no external fragmentation** and no chain to corrupt. The cost is the index block's space overhead, and a single index block caps file size.

The classic **Unix inode** solves the size cap with a **multi-level** scheme — a mix that keeps small files cheap and still supports huge files:

```text
inode block pointers:
  12 direct pointers        → point straight at data blocks (small files: no indirection)
   1 single-indirect ptr    → points to a block of pointers → data
   1 double-indirect ptr    → points to a block of (single-indirect) pointer blocks
   1 triple-indirect ptr    → points to a block of (double-indirect) pointer blocks
```

Small files (the common case) use only the 12 direct pointers — one lookup, no indirect blocks. Large files progressively engage single → double → triple indirection, each level multiplying reach by the number of pointers per block. It's a beautifully economical design: O(1) access for small files, near-unbounded capacity for large ones.

### Q10. Compute the maximum file size for a Unix inode.

Assume **4 KB blocks** and **4-byte** block pointers → a block holds **1024** pointers. Inode = 12 direct + 1 single + 1 double + 1 triple indirect.

```text
pointers per block  P = 4096 / 4 = 1024

direct:    12          blocks
single:    P    = 1024 blocks
double:    P^2  = 1024^2      = 1,048,576 blocks
triple:    P^3  = 1024^3      = 1,073,741,824 blocks

total blocks ≈ 12 + 1024 + 1,048,576 + 1,073,741,824
             ≈ 1,074,791,436 blocks
max size = blocks × 4 KB ≈ 1,074,791,436 × 4096
         ≈ 4.4 TB   (dominated by the triple-indirect term ≈ 4 TB)
```

The method matters more than the number: **pointers-per-block = block size / pointer size**, then sum `direct + P + P² + P³` blocks and multiply by block size. The triple-indirect term dominates; the direct/single/double terms are rounding error. Change the block or pointer size and you rerun the same arithmetic.

### Q11. How is free space managed?

Two main approaches to tracking which blocks are unused:

- **Bitmap (bit vector):** one bit per block — 1 = free, 0 = used (or vice versa). Compact, and makes finding a *run* of contiguous free blocks easy (scan for consecutive 1s), which helps allocation locality. The whole bitmap can be cached in memory for a modest volume. Downside: for a huge volume the bitmap itself is large.
- **Free list:** thread the free blocks into a linked list (each free block points to the next free block). No separate structure needed, but finding contiguous free space is hard and traversing to allocate can cause seeks. Often optimised with **grouping** (a block holds the addresses of *n* free blocks) to amortise.

Bitmaps are the common modern choice because contiguity-awareness (for reducing fragmentation and seeks) is worth the space.

### Q12. Why do crashes corrupt file systems, and how does journaling fix it?

A single logical operation (say, appending to a file) requires **several** independent disk writes — update the inode's size and block pointers, mark the new block used in the free-space bitmap, write the data. If the machine **crashes between them**, the on-disk structure is left **inconsistent**: e.g. a block marked used but referenced by no inode (leak), or referenced by an inode but still marked free (future double-allocation → corruption). The old fix was **fsck**, a full-volume scan at boot to detect and repair such inconsistencies — correct but agonisingly slow on large volumes.

**Journaling** applies write-ahead logging. Before touching the real structures, the FS writes a description of the intended change to a **journal** (log), then commits it, *then* applies the change ("checkpoints") to the actual metadata, then clears the journal entry:

```text
1. write intended changes to journal   (log record)
2. commit  the journal transaction      (durable marker)
3. apply   changes to real FS structures
4. free    the journal entry
```

After a crash, recovery just scans the journal: transactions that were **committed but not yet applied** are **replayed**; transactions not yet committed are **discarded (rolled back)**. Either way the FS reaches a consistent state in seconds, not a full-volume scan.

### Q13. Compare journaling modes and journaling vs copy-on-write.

**Journaling modes** (ext3/ext4 terminology; NTFS journals metadata too) trade safety for speed:

| Mode | What's journaled | Safety | Cost |
|---|---|---|---|
| **Writeback** | Metadata only; data written whenever | Metadata consistent, but data may be stale/garbage after crash | Fastest |
| **Ordered** (default) | Metadata only, but data is forced to disk *before* the metadata that references it | No garbage-in-file; the sane default | Moderate |
| **Data (full)** | Metadata *and* data both journaled | Strongest — data is crash-consistent too | Slowest (everything written twice) |

**Copy-on-write filesystems (ZFS, btrfs)** take a different route entirely: they never overwrite live data in place. A change writes new blocks and then atomically flips a pointer (ultimately the root) from the old version to the new. The old version stays consistent until the switch, so a crash simply leaves you on the previous good state — no journal replay needed, and snapshots come almost for free. The tradeoff is fragmentation and write-amplification from constantly relocating blocks.

### Q14. What is the VFS (Virtual File System) layer?

The **VFS** is a kernel abstraction layer that defines a **uniform interface** — a set of operations like `open`, `read`, `write`, `lookup`, `mkdir` on abstract objects (inode, dentry, file, superblock) — that *every* concrete filesystem implements. Applications call `read()` on a file descriptor and neither they nor most of the kernel know or care whether the bytes come from **ext4**, **NTFS**, **FAT**, a **network filesystem (NFS)**, or a pseudo-filesystem like `/proc`.

```text
      application:  read(fd, ...)
             │  (same syscall regardless of backend)
           [ VFS ]  ── dispatches via per-FS operation tables
        ┌────┼────┬─────────┐
      ext4  NTFS  FAT       NFS
```

Each filesystem registers a table of function pointers; the VFS routes generic operations to the right implementation. This is the "common interface over diverse backends" pattern — the same idea as device drivers behind a device interface — and it's what lets you mount an ext4 disk, a FAT USB stick, and an NFS share into one namespace and use them identically.

### Q15. What is mounting, and what's the role of block size?

**Mounting** grafts a filesystem onto a **mount point** — an existing directory in the current namespace — so its tree appears seamlessly at that path. `mount /dev/sdb1 /mnt/usb` makes the USB stick's root appear as `/mnt/usb`; from then on paths under `/mnt/usb` resolve into that filesystem. The VFS records the mount and redirects path resolution at the mount point. Unmounting detaches it (and flushes cached writes first).

**Block size** is the filesystem's allocation unit (e.g. 4 KB). It's a fundamental tradeoff:

- **Larger blocks** → less per-file metadata and fewer indirect lookups for big files, better sequential throughput — but more **internal fragmentation** (a 1-byte file still consumes a whole block; the slack is wasted).
- **Smaller blocks** → less waste on tiny files, but more metadata and more seeks for large files.

Because most filesystems hold many small files, block size is chosen to balance the wasted tail against large-file efficiency; some filesystems add sub-block packing (tail-packing) to reclaim the slack.

### Q16. What role does the buffer/page cache play, and how does fsck fit in?

**Buffer / page cache:** the OS caches recently used disk blocks (and file pages) in RAM. Reads that hit the cache skip the disk entirely; writes are usually **buffered** in the cache and flushed later (write-back). This is what makes filesystems usably fast — disk is ~10⁵–10⁶× slower than RAM — and it enables **read-ahead** (prefetching sequential blocks you're likely to want next). The durability cost: a buffered write not yet flushed is lost on a crash, which is why `fsync()` exists to force a file's data to durable storage, and why journaling carefully orders journal writes relative to cache flushes. (This is the storage-layer topic's page cache viewed from the filesystem's side.)

**fsck (file-system check):** the consistency-repair tool that scans a volume for structural inconsistencies — blocks marked used but unreferenced, inodes with wrong link counts, cross-linked blocks — and repairs them. On a **journaled** filesystem, boot-time recovery is normally just a fast journal replay, and a full fsck is reserved for suspected corruption beyond what the journal covers (e.g. hardware faults). On a non-journaled filesystem, a full fsck after an unclean shutdown was mandatory and slow — which is precisely the pain journaling was invented to remove.

## Storage & Disk I/O

### Summary

**What this topic covers**

The persistent-storage layer *beneath* the file system: the physical devices and the OS machinery that moves bytes to and from them. This topic is **HDDs vs SSDs** (spinning platters with seek + rotational latency versus NAND flash with uniform random access but erase-before-write and wear), the disk **access-time formula**, **disk-scheduling algorithms** that minimise head movement on an HDD (FCFS, SSTF, SCAN/C-SCAN, LOOK/C-LOOK) and why they barely matter on an SSD, **RAID** levels and their capacity/performance/fault-tolerance tradeoffs, the **page/buffer cache** (read hits, write-back buffering, read-ahead, dirty pages, `fsync`), **DMA** (moving data device↔memory without burning CPU per byte), block vs character devices, the full **I/O path** from syscall to device, and a high-level tie to block/file/object storage and NVMe vs SATA. Its 15 questions run from "why is an SSD faster than an HDD" to "compute total head movement under SCAN" to "what does the page cache actually do." It's the foundation the **File Systems** topic sits on, and it explains why a page fault that hits disk (from the virtual-memory topic) is so catastrophically expensive.

**Mental model**

Storage is a hierarchy defined by a brutal latency gap: RAM access is ~100 ns, an SSD read ~100 µs (1000×), an HDD seek ~10 ms (100,000×). Every design decision in this topic is about hiding or minimising that gap. On an **HDD**, the enemy is mechanical movement — the head must physically **seek** to the right track and wait for the platter to **rotate** the sector underneath it — so the OS reorders requests (disk scheduling) and lays files out contiguously to minimise head travel; random access is disastrous, sequential is fine. On an **SSD** there's no head, so random access is nearly as fast as sequential and scheduling is almost irrelevant — but flash can't overwrite in place (erase-before-write) and wears out, shifting the concern to write amplification and endurance. Above both sits the **page cache**, absorbing reads (serve from RAM) and buffering writes (flush later), and **DMA**, which lets the device fill memory while the CPU does real work. Think: *the device is glacially slow, so cache aggressively, reorder cleverly, and never make the CPU babysit a transfer.*

**Key terms**

- **Seek time** — time for an HDD head to move to the target track; the dominant, mechanical cost of random HDD access.
- **Rotational latency** — time for the platter to spin the target sector under the head (avg = half a revolution).
- **Transfer time** — time to actually read/write the bits once positioned.
- **SSD (NAND flash)** — no moving parts; uniform low-latency random access, but erase-before-write, write amplification, and finite write endurance.
- **Wear leveling / TRIM** — spreading writes across cells to extend SSD life; TRIM tells the SSD which blocks are free so it can erase them ahead of time.
- **Disk scheduling** — reordering pending I/O requests to minimise HDD head movement (FCFS, SSTF, SCAN, C-SCAN, LOOK, C-LOOK).
- **RAID** — combining multiple disks for performance (striping) and/or redundancy (mirroring/parity).
- **Striping / mirroring / parity** — spread data for speed / duplicate for redundancy / compute recovery info to survive failures.
- **Page/buffer cache** — RAM cache of disk blocks; reads hit it, writes buffer in it (dirty pages) and flush later.
- **Read-ahead (prefetch)** — proactively reading blocks likely to be needed next.
- **Write-back vs write-through** — buffer writes and flush later (fast, risks loss) vs write to disk immediately (safe, slow).
- **DMA (Direct Memory Access)** — a controller transfers data between device and memory directly, interrupting the CPU only on completion.

**Why interviewers ask this**

This is where systems-performance intuition lives. A junior knows an SSD is "faster"; a senior can say *why* — no seek/rotational latency — and can reason about the consequences: why disk scheduling matters on an HDD but not an SSD, why databases care about sequential vs random I/O, why a filesystem lays files out contiguously. The scheduling-algorithm calculation (total head movement for a request sequence under SCAN vs SSTF) is a standard whiteboard problem that tests whether you can execute an algorithm precisely. RAID questions probe whether you understand the capacity/performance/fault-tolerance triangle — "which RAID for a write-heavy database that must survive a disk failure?" is a real decision. The page cache and DMA come up because they explain observed behaviour ("why did my second read get faster?", "why doesn't a big file copy peg the CPU?") — signal that you understand the machine, not just the API.

**Common confusions**

- "SSDs are just fast disks." They have fundamentally different characteristics — no seek, but erase-before-write and wear — so the OS/FS should treat them differently (e.g. TRIM, no seek-minimising scheduling).
- "Disk scheduling speeds up SSDs." Barely — with no seek, reordering for head movement is pointless; SSDs use much simpler queuing.
- "RAID is a backup." It's *availability*, not backup — RAID 1 faithfully mirrors your `rm -rf` to both disks. You still need backups.
- "RAID 5 has no downside." The **write penalty**: every small write requires read-old-data + read-old-parity + write-new-data + write-new-parity (4 I/Os).
- "Write-back cache means my data is safe once `write()` returns." No — it's in RAM until flushed; only `fsync()` (or write-through) guarantees durability.
- "DMA makes the CPU copy faster." DMA *removes* the CPU from the copy entirely; it's freed to do other work and is interrupted only on completion.
- "Rotational latency and seek time are the same." Seek = head moving across tracks; rotational latency = platter spinning the sector around.

**What follows from this topic**

This is the bedrock under **File Systems** — allocation methods (contiguous vs linked vs indexed) are chosen largely to minimise seeks on the media this topic describes, and the page/buffer cache is shared machinery between the two. It closes the loop with **Page Replacement & Thrashing** and virtual memory: a page fault that must hit disk pays the full seek+rotational latency (or SSD read) described here, which is *why* the page-fault path is so expensive and why thrashing collapses throughput. DMA and the I/O path connect to **interrupts vs polling** and device drivers. And the block/file/object framing gestures at distributed and cloud storage, where the same latency-hiding principles reappear at network scale.

### Q1. Compare HDDs and SSDs.

| | HDD | SSD |
|---|---|---|
| Mechanism | Spinning magnetic platters + moving head | NAND flash, no moving parts |
| Random access | **Slow** (seek + rotational latency) | **Fast** (uniform, no mechanical delay) |
| Sequential access | Fast (once positioned) | Fast |
| Latency | ~5–10 ms | ~50–100 µs |
| In-place overwrite | Yes | **No** — erase-before-write (erase a whole block, then write) |
| Wear | Effectively unlimited writes | **Finite** write endurance → wear leveling |
| Special OS support | Disk scheduling helps | **TRIM**, no seek-scheduling needed |
| Cost/GB | Cheaper | More expensive |

The essential difference: an HDD's cost is **mechanical and position-dependent** — random access is orders of magnitude slower than sequential because the head must physically move and the platter must rotate. An SSD's access time is **uniform** regardless of location, so random ≈ sequential. But flash **can't overwrite in place**: it must erase a whole (large) block before rewriting, causing **write amplification**, and each cell tolerates only a finite number of writes, so the controller does **wear leveling** and relies on **TRIM** to know which blocks are free to pre-erase. This is why the OS/FS should treat them differently — seek-minimising layout and scheduling are pointless on an SSD, while TRIM and write-amplification-awareness are essential.

### Q2. Describe HDD geometry and the disk access-time formula.

An HDD is a stack of **platters** on a spindle. Each platter surface is divided into concentric **tracks**; each track into fixed-size **sectors**; the set of same-radius tracks across all platters is a **cylinder**. A per-surface **head** on a moving arm reads/writes; all heads move together, so all tracks in a cylinder are accessible without further seeking.

**Access time** for a request breaks into three parts:

```text
access time = seek time + rotational latency + transfer time

  seek time         = time to move the head to the target track   (mechanical, dominant for random I/O)
  rotational latency = time for the sector to rotate under the head (avg = ½ revolution)
  transfer time     = time to read/write the bits                  (usually smallest)
```

For example, at 7200 RPM one revolution is ~8.3 ms, so **average rotational latency ≈ 4.15 ms**; an average seek is another several ms. The takeaway: for small random reads, **seek + rotational latency utterly dominate** transfer, which is exactly why reducing head movement (disk scheduling, contiguous layout) matters — and why SSDs, having neither seek nor rotation, win so decisively on random workloads.

### Q3. Why does disk scheduling exist, and what problem does it solve?

Multiple processes issue disk I/O concurrently, so at any moment the disk driver holds a **queue** of pending requests for different track positions. On an HDD, servicing them in arrival order can send the head lurching back and forth across the platter, and **seek time dominates** access time — so the *order* you service requests in directly determines total head travel and thus throughput and latency. **Disk scheduling** reorders the queue to **minimise total head movement** (and/or bound worst-case waiting). It's a pure win on an HDD because seeks are the bottleneck. On an **SSD** it's nearly irrelevant — there's no head, so no position-dependent cost to optimise — which is why SSDs use simple, near-FCFS queuing (and rely on deep parallel queues, e.g. NVMe, instead).

### Q4. Walk through FCFS, SSTF, SCAN, C-SCAN, LOOK, and C-LOOK.

Assume the head is at track **53** and the pending queue is `98, 183, 37, 122, 14, 124, 65, 67` (disk tracks 0–199).

- **FCFS (First-Come-First-Served):** service in arrival order. Fair, no starvation, but wildly inefficient head movement (53→98→183→37→…). Baseline.
- **SSTF (Shortest-Seek-Time-First):** always service the **closest** pending request next (53→65→67→37→14→98→122→124→183). Much less movement than FCFS, but can **starve** far-away requests if nearby ones keep arriving — a greedy local optimum.
- **SCAN (elevator):** the head sweeps in one direction servicing everything in its path, hits the end, then reverses. Like a lift. No starvation; requests just behind the head wait a full sweep. From 53 heading down: 53→37→14→0→(reverse)→65→67→98→122→124→183.
- **C-SCAN (Circular SCAN):** sweep one direction servicing requests, but at the end **jump straight back** to the start without servicing, then sweep again. Gives **more uniform wait times** than SCAN (which favours the middle) by treating the disk as circular.
- **LOOK / C-LOOK:** the practical refinements of SCAN / C-SCAN — instead of driving to the physical end of the disk, the head only goes as far as the **last request** in each direction, then reverses (LOOK) or jumps back (C-LOOK). Saves the wasted travel to track 0/199 when there's nothing there. Real HDD schedulers are LOOK-family.

### Q5. Compute the total head movement for a scheduling algorithm.

Head at **53**, queue `98, 183, 37, 122, 14, 124, 65, 67`, disk 0–199.

**FCFS** — service in order:
```text
53→98→183→37→122→14→124→65→67
|53-98|+|98-183|+|183-37|+|37-122|+|122-14|+|14-124|+|124-65|+|65-67|
= 45 + 85 + 146 + 85 + 108 + 110 + 59 + 2 = 640 tracks
```

**SSTF** — always nearest next:
```text
53→65→67→37→14→98→122→124→183
12 + 2 + 30 + 23 + 84 + 24 + 2 + 59 = 236 tracks
```

**SCAN** — sweep down to 0, then up:
```text
53→37→14→0→65→67→98→122→124→183
(53-0) + (183-0) = 53 + 183 = 236 tracks
```

**C-LOOK** — sweep up to the last request, jump back to the lowest, continue up:
```text
53→65→67→98→122→124→183 → (jump to 14) → 14→37
(183-53) + (183-14) + (37-14) = 130 + 169 + 23 = 322 tracks
```

Method: order the requests per the algorithm's rule, sum the absolute differences between consecutive head positions. SSTF and SCAN crush FCFS here. On an **SSD**, none of this matters — every access costs the same regardless of "track," so you'd just serve FCFS with deep parallelism.

### Q6. What is RAID and what problem does it solve?

**RAID (Redundant Array of Independent Disks)** combines multiple physical disks into one logical volume to gain **performance** (spread I/O across disks — *striping*), **redundancy** (survive disk failures — *mirroring* or *parity*), or both. The insight: a single disk is a bottleneck and a single point of failure; N disks can serve N times the I/O in parallel, and with redundancy the array survives a disk death without data loss. RAID levels are different points on the **capacity / performance / fault-tolerance** triangle — you can't max all three, so you pick per workload. Crucially, RAID provides **availability, not backup**: it protects against *hardware* failure, not against `rm -rf`, corruption, or ransomware, which it faithfully replicates to every disk.

### Q7. Compare RAID 0, 1, 5, 6, and 10.

| Level | Technique | Min disks | Usable capacity | Fault tolerance | Notes |
|---|---|---|---|---|---|
| **RAID 0** | Striping | 2 | 100% | **None** | Fastest R/W; any disk dies → all data lost |
| **RAID 1** | Mirroring | 2 | 50% | 1 disk (per mirror) | Simple, fast reads; expensive (half capacity) |
| **RAID 5** | Striping + distributed parity | 3 | (N−1)/N | 1 disk | Good read speed; **write penalty** from parity |
| **RAID 6** | Striping + *double* parity | 4 | (N−2)/N | **2 disks** | Survives 2 failures; heavier write penalty |
| **RAID 10** | Mirror **then** stripe (1+0) | 4 | 50% | 1 per mirror (often more) | Fast + resilient; used for write-heavy DBs |

- **RAID 0** — pure speed, zero safety; use only for scratch/throwaway data.
- **RAID 1** — mirror; every write goes to both disks, reads can be served from either. Costs half your capacity.
- **RAID 5** — parity distributed across all disks; loses one disk's worth of capacity, survives one failure. Its catch is the **write penalty** (next question).
- **RAID 6** — two independent parity blocks, survives *two* simultaneous failures — valuable for large arrays where rebuild times are long and a second failure during rebuild is a real risk.
- **RAID 10** — mirror pairs, then stripe across them: combines RAID 1's resilience with RAID 0's speed and has **no parity write penalty**, which is why write-heavy databases favour it despite the 50% capacity cost.

### Q8. Explain the RAID 5 write penalty.

Parity means each stripe stores `parity = data_1 XOR data_2 XOR … XOR data_n`. To update **one** block, the array must keep parity consistent, which — for a small write — costs **four** I/Os:

```text
1. READ  the old data block
2. READ  the old parity block
3. compute new parity:  new_parity = old_parity XOR old_data XOR new_data
4. WRITE the new data block
5. WRITE the new parity block
   → 2 reads + 2 writes for a single logical write
```

So a small random write incurs ~4× the I/O of a plain disk — the **write penalty** — and it concentrates load on the parity operations. This is why RAID 5 is fine for read-heavy or large-sequential-write workloads but poor for small-random-write-heavy ones (e.g. transactional databases), where **RAID 10** — which just writes to both mirror members, no read-modify-write — is preferred. RAID 6, with two parity blocks, has an even heavier penalty (6 I/Os per small write).

### Q9. What does the page/buffer cache do?

The **page/buffer cache** is a region of RAM where the OS keeps recently and frequently used disk blocks. It sits between the file system and the block device and does two big things:

- **Reads:** a read first checks the cache; on a **hit** it's served from RAM (~100 ns) and never touches the disk (~ms). This is why re-reading a file, or reading a file a neighbour just wrote, is dramatically faster — and why benchmarks warm up the cache.
- **Writes (write-back):** a `write()` normally just updates the cached page (marking it **dirty**) and returns immediately; the kernel **flushes** dirty pages to disk later, in batches, in a good order. This absorbs write bursts, coalesces repeated writes to the same block, and lets the disk scheduler optimise the flush.

It also enables **read-ahead / prefetching** (next question). The cost is durability risk: a dirty page not yet flushed is lost on a crash, which is why `fsync()` exists to force it out. The page cache is effectively the same idea as CPU caches and the TLB — exploit locality to hide a slow lower level — applied to storage, and it's what makes disk-backed systems usable at all.

### Q10. Explain read-ahead, write-back vs write-through, and fsync.

**Read-ahead (prefetching):** when the OS detects **sequential** access, it proactively reads the *next* blocks into the page cache before they're requested, so by the time the app asks, the data is already in RAM. It turns a series of blocking disk reads into cache hits — a big win for streaming/scan workloads. (Useless-to-harmful for random access, so the OS detects the pattern first.)

**Write-back vs write-through** — the durability/performance dial for cached writes:

| | Write-back | Write-through |
|---|---|---|
| On write | Update cache, mark dirty, return; flush later | Write to cache **and** disk before returning |
| Speed | Fast (absorbs bursts, coalesces) | Slow (every write waits on disk) |
| Crash safety | Unflushed writes are **lost** | Data is durable immediately |

**`fsync(fd)`** bridges the gap: with a write-back cache, it forces all of a file's dirty pages (and its metadata) to durable storage and blocks until the device confirms. Databases and journaling filesystems call `fsync` at commit points precisely because "the `write()` returned" does *not* mean "the data is on disk." This ordering — write to cache for speed, `fsync` at durability boundaries — is the standard reconciliation of the two.

### Q11. What is DMA and why does it matter?

**DMA (Direct Memory Access)** lets a dedicated **DMA controller** transfer data directly between a device and main memory **without the CPU copying each byte**. The alternative — **programmed I/O (PIO)** — makes the CPU execute a load/store for every word, so a large transfer *pegs a core* doing nothing but shuffling bytes.

```text
Programmed I/O:  CPU ── byte ── device   (CPU busy for the whole transfer)

DMA:
  1. CPU tells the DMA controller: source, destination, length. Then goes to do other work.
  2. DMA controller moves the data device ↔ memory on its own.
  3. On completion, the controller raises an INTERRUPT.
  4. CPU handles the single completion interrupt.
```

So DMA turns "CPU babysits N bytes" into "CPU sets up once, gets one interrupt at the end," freeing it for real computation during the (slow) transfer. It's why copying a large file, or streaming from an NVMe SSD, doesn't saturate the CPU. DMA is a cornerstone of efficient I/O and ties directly to the **interrupt** mechanism — the device interrupts only on completion rather than per byte.

### Q12. What's the difference between block and character devices?

- **Block devices** — accessed in fixed-size **blocks**, addressable and **random-access**, and sit behind the **page/buffer cache** and block layer. Disks, SSDs, USB drives. You can seek to any block; the OS buffers and schedules I/O. File systems live on block devices.
- **Character devices** — accessed as a **stream of bytes**, typically **sequential**, usually **unbuffered** by the block cache. Keyboards, serial ports, terminals, `/dev/null`, `/dev/random`. No notion of seeking to "block N"; you read/write bytes as they flow.

The distinction drives how the kernel handles them: block devices get the caching + scheduling machinery (because reordering and buffering pay off for addressable storage), character devices get a simpler direct path (because a byte stream has nothing to reorder). It also surfaces in the device-driver interface — the two device classes register different operation sets.

### Q13. Trace the I/O path from an application read to the device.

```text
application:  read(fd, buf, n)
     │  system call → user→kernel mode switch
     ▼
   VFS          — generic read on the file object
     │
     ▼
 page cache     — HIT? copy from RAM, done. MISS? continue ↓
     │
     ▼
 file system    — translate file offset → logical block numbers
     │
     ▼
 block layer    — build block I/O requests, merge adjacent ones
     │
     ▼
 I/O scheduler  — reorder/queue requests (matters for HDD, less for SSD)
     │
     ▼
 device driver  — program the controller; set up DMA
     │
     ▼
 device (disk/SSD) — performs the transfer; DMA fills memory
     │
     ▼
 interrupt      — device signals completion → driver wakes the process
     │
     ▼
 data returned to the app's buffer; syscall returns
```

The key beats for an interview: a **page-cache hit short-circuits the whole lower path** (RAM speed, no device I/O); on a miss the request descends through the FS, block layer, and scheduler to the driver, which uses **DMA** to move data and an **interrupt** to signal completion, waking the blocked process. This is also the path a **page fault** takes when it must fetch from swap — which is why a fault-to-disk costs on the order of a million CPU cycles.

### Q14. What's the difference between block, file, and object storage?

Three abstraction levels, increasingly high-level, and the same latency-hiding principles reappear at each scale:

- **Block storage** — raw fixed-size blocks addressed by number; no notion of files. What a disk/SSD (or a cloud block volume like EBS) exposes; a file system or database is layered on top. Lowest-level, highest control, attach-to-one-host semantics.
- **File storage** — the file-and-directory abstraction with hierarchical paths and shared access (NFS, SMB, cloud file shares). What this topic's file-system layer provides, optionally over a network.
- **Object storage** — opaque **objects** (blob + metadata) in a **flat namespace**, addressed by key via an HTTP API, with no in-place edit (replace-the-whole-object) but near-infinite scale and durability (S3, GCS, Azure Blob). Ideal for large, write-once, read-many data — backups, media, data lakes.

The progression trades **fine-grained control and low latency** (block) for **scale, durability, and simplicity** (object). Cloud systems mix all three: a VM boots off block storage, mounts file shares, and archives to object storage.

### Q15. NVMe vs SATA, briefly — and why the SSD changes the calculus.

**SATA** is an interface designed in the HDD era: a single command queue, modest depth, and a protocol (AHCI) built around the assumption that the device is slow and serial — fine for a spinning disk, a bottleneck for fast flash. **NVMe** is a protocol built *for* SSDs, riding the **PCIe** bus: it exposes **many deep parallel queues** (thousands of commands each), drastically lower per-command overhead, and far higher bandwidth — letting flash's inherent parallelism (many NAND chips) actually be exploited. An NVMe SSD can deliver several GB/s and vastly more IOPS than a SATA SSD on the same flash.

This is the storage-side echo of the whole topic's theme: because an **SSD has no seek**, the old optimisations (elevator scheduling, contiguous layout to avoid head travel) stop mattering, and the new bottleneck becomes **interface parallelism and per-I/O software overhead** — exactly what NVMe attacks. The OS adapts by using simpler, multi-queue block schedulers (or none) for NVMe rather than the seek-minimising elevator algorithms an HDD needs. The device changed, so the calculus — what's worth optimising — changed with it.
## I/O Systems & Device Management

### Summary

**What this topic covers**

How the OS turns a chaotic zoo of physical devices — disks, keyboards, network cards, GPUs, printers — into a small, uniform set of abstractions that programs can use through a handful of system calls. Three concern areas live here: (1) the **device landscape and the driver model** — how block, character, and network devices differ and how **device drivers** let one kernel talk to thousands of distinct devices through a common interface; (2) the **CPU↔device data-exchange mechanisms** — programmed I/O (polling), interrupt-driven I/O, and DMA, and when each is the right tool; and (3) the **application-facing I/O models** — blocking, non-blocking, asynchronous, and multiplexed (`select`/`poll`/`epoll`/`kqueue`) I/O, plus the software layers, buffering, caching, and spooling that sit between a `read()` call and the spinning platter. The 15 questions here move from "what does a device driver do" to "blocking vs epoll for a 10k-connection server."

**Mental model**

Picture a stack. At the bottom is hardware you cannot trust to be uniform. At the top is a program that just wants `read(fd, buf, n)` to work. In between, the OS builds a **layered I/O subsystem**: a user-space library (libc) wraps the syscall; the kernel's device-independent I/O layer does naming, buffering, caching, and scheduling; a per-device **driver** translates generic requests ("read block 42") into this-device commands (poke these controller registers); and an **interrupt handler** wakes things up when the hardware finishes. The driver is the pivot — it presents a fixed interface *upward* (open/read/write/ioctl) and speaks device-specific *downward*, so adding a new disk means writing a driver, not changing the kernel. The second axis is *who waits*: the CPU can busy-wait (polling), go do other work and be interrupted (interrupts), or hand a whole transfer to a **DMA** engine and be interrupted only once at the end (bulk I/O). Fast tiny transfers favor polling; slow sporadic devices favor interrupts; big block transfers favor DMA.

**Key terms**

- **Block device** — random-access, fixed-size blocks (disks, SSDs); addressable and cacheable.
- **Character device** — byte-stream, no seek (keyboard, serial port, `/dev/random`).
- **Network device** — packet-oriented, exposed via sockets rather than the file namespace on most systems.
- **Device driver** — a kernel module translating the OS's uniform device interface into device-specific register commands; the abstraction that lets one kernel drive thousands of devices.
- **Device controller** — hardware between the CPU and the physical device, exposing **registers** (status, control, data) the driver reads/writes.
- **Programmed I/O / polling** — the CPU busy-waits reading a status register until the device is ready; simple, wastes CPU.
- **Interrupt-driven I/O** — the device raises an **interrupt** when ready; the CPU does other work meanwhile and the handler services it.
- **DMA (Direct Memory Access)** — a DMA controller moves a whole block device↔memory without the CPU, interrupting once on completion.
- **I/O multiplexing** — one thread waits on many descriptors at once via `select`/`poll`/`epoll`/`kqueue`.
- **Buffering** — single/double/circular buffers decouple producer and consumer speeds and reconcile transfer sizes.
- **Spooling** — buffering a device's entire job (e.g. a print job) because the device can't interleave streams from multiple processes.
- **Memory-mapped I/O** — device registers appear in the physical address space and are accessed with ordinary loads/stores (vs port-mapped I/O's special `in`/`out` instructions).

**Why interviewers ask this**

I/O is where "I know the theory" meets "I've actually built a server." A junior candidate describes `read()` as if it were free and instantaneous. A senior candidate knows a syscall crosses the user/kernel boundary, may block the thread, and that the difference between a thread-per-connection blocking server and an `epoll` event loop *is the C10K problem*. Interviewers use this topic to check whether you understand the real cost model of I/O: that a disk read is ~100,000× slower than a cache hit, that busy-waiting for it wastes millions of cycles, that DMA exists precisely so the CPU isn't the bottleneck, and that async/batched I/O is how high-throughput systems hide latency. Getting "polling vs interrupts vs DMA" and "blocking vs async" right signals you can reason about performance, not just correctness.

**Common confusions**

- "Polling is always bad." — For a device that completes in nanoseconds (a fast NVMe queue, a 100GbE NIC under load), polling can *beat* interrupts because it avoids interrupt/context-switch overhead. It's bad for slow, sporadic devices.
- "DMA means no interrupts." — DMA still interrupts once, on completion; it just eliminates the per-byte/per-word CPU involvement.
- "Non-blocking and asynchronous are the same." — Non-blocking returns immediately with "not ready, try again" (you still poll). Asynchronous (AIO) starts the operation and notifies you when it's *done*.
- "`epoll` makes I/O faster." — It doesn't speed up any single I/O; it lets one thread *scale* to many descriptors without O(n) rescans, which is a throughput/scalability win, not a latency one.
- "The driver does the physical I/O." — The driver issues commands to the *controller*; the controller and DMA engine move the bytes.

**What follows from this topic**

I/O sits on the interrupt machinery detailed in **Interrupts, Traps & System Calls** — every non-polled transfer ends in an ISR — and every `read()`/`write()` is a **system call** crossing into kernel mode. The buffer/page cache reuses the virtual-memory machinery from the paging topics, and disk scheduling / storage-device characteristics live in the storage topic. The kernel's device-independent layer and driver isolation preview **Kernel & Protection** (a buggy driver in a monolithic kernel can crash everything).

### Q1. What does a device driver do, and why is it the key I/O abstraction?

A **device driver** is a kernel module that sits between the OS's generic, device-independent I/O layer and one specific piece of hardware. It presents a **fixed interface upward** — a standard set of entry points like `open`, `read`, `write`, `ioctl`, `release` — and speaks **device-specific commands downward**, poking the device controller's registers and handling its interrupts.

The point is decoupling. The kernel's I/O subsystem knows how to talk to "a block device"; it does *not* know the difference between a Samsung NVMe SSD and a decade-old SATA disk. The driver hides that difference. Add new hardware → write a driver → the rest of the kernel and every application are unchanged.

```text
  application:  read(fd, buf, n)
       │  (syscall)
  kernel I/O subsystem  ── uniform interface ──►  driver A (NVMe)
                                              ├─►  driver B (USB HID keyboard)
                                              └─►  driver C (e1000 NIC)
                                                     │ device-specific registers
                                                  hardware
```

That is why "the driver is the abstraction that lets the kernel talk to thousands of devices via a common API" — it's the pluggable translation layer.

### Q2. Compare block devices, character devices, and network devices.

| | Block device | Character device | Network device |
|---|---|---|---|
| Access | Random-access, addressable blocks | Sequential byte stream | Packet/frame oriented |
| Unit | Fixed-size block (e.g. 4 KB) | Single bytes | Packets |
| Examples | HDD, SSD, USB stick | Keyboard, serial port, `/dev/null` | Ethernet/Wi-Fi NIC |
| Cacheable | Yes (buffer/page cache) | Usually not | No (packets are transient) |
| Typical API | `read`/`write`/`seek`, mmap | `read`/`write`, no seek | Sockets (`send`/`recv`) |

**Block devices** support seeking and are backed by the buffer/page cache — you can read block 42 then block 7. **Character devices** are streams: no seek, bytes arrive/leave in order. **Network devices** are special enough that most OSes expose them through the socket API rather than the file namespace, because packets, addressing, and protocol stacks don't fit the "stream of bytes at a path" model.

### Q3. Explain programmed I/O (polling), interrupt-driven I/O, and DMA, and when to use each.

**Programmed I/O / polling** — the CPU repeatedly reads the controller's status register in a loop until the device signals ready, then transfers a word. Dead simple, zero interrupt overhead, but the CPU **busy-waits**, burning cycles doing nothing useful.

```c
// programmed I/O: CPU busy-waits
while ((status_reg & READY) == 0)   // spin
    ;
data = data_reg;                    // one word
```

**Interrupt-driven I/O** — the CPU issues the request and goes off to run other threads. When the device is ready it raises an **interrupt**; the handler transfers the data and wakes the waiting process. Efficient for slow or sporadic devices, but pays an interrupt + context-switch cost per transfer unit.

**DMA (Direct Memory Access)** — for bulk transfers, the CPU programs a **DMA controller** with source, destination, and length, then goes away entirely. The DMA engine moves the *whole block* between device and memory and raises a **single interrupt** on completion.

| | Polling | Interrupt-driven | DMA |
|---|---|---|---|
| CPU during transfer | Busy-waits | Free (until IRQ) | Free (whole transfer) |
| Interrupts | None | One per unit | One per block |
| Best for | Very fast/frequent tiny transfers | Slow, sporadic devices | High-throughput bulk I/O |
| Downside | Wastes CPU | Per-transfer overhead | Setup cost, needs a DMA engine |

Rule of thumb: poll when the wait is shorter than an interrupt's overhead; interrupt when waits are long and unpredictable; DMA when you're moving kilobytes or megabytes.

### Q4. Why is busy-waiting on a disk read wasteful? What does the OS do instead?

A disk read takes on the order of milliseconds (SSD: tens of microseconds; HDD: ~10 ms). A CPU runs billions of instructions per second. Busy-waiting on a status register for a 10 ms HDD read means spinning through **tens of millions of cycles** doing literally nothing — cycles that could have run other threads.

So for disks the OS uses **interrupt-driven I/O plus DMA**: it issues the request, **blocks** the calling process (moves it off the CPU to the waiting state), and schedules something else. The DMA controller transfers the block; on completion it raises an interrupt; the handler marks the block ready and moves the process back to the ready queue. The CPU stayed busy with real work the entire time, and the process only "wakes" when its data is actually available.

### Q5. What are device controllers and registers, and how does the driver use them?

A **device controller** is the hardware interface between the CPU and the physical device (the disk controller, the NIC's MAC/PHY, the USB host controller). The device itself (a spinning platter, a radio) is messy analog hardware; the controller presents a clean digital interface: a small bank of **registers**.

Typically:
- **Status register** — read-only; is the device busy/ready/errored?
- **Control/command register** — write-only; "start a read," "reset," "enable interrupts."
- **Data register(s)** — the word(s) to transfer.

The driver drives the device by reading and writing these registers. "Start a read of block 42 into memory": write the block number and target address to command/address registers, set the START bit in the control register, then either poll the status register or wait for the completion interrupt. The registers are exposed to the CPU via **memory-mapped I/O** (see Q11) or **port-mapped I/O**.

### Q6. Walk me through the layers of I/O software from `read()` to the hardware.

```text
  user program        read(fd, buf, n)
        │
  user-space library   libc wrapper → traps into kernel (syscall)
        │
  kernel I/O subsystem naming, permission check, buffering,
        │              caching, I/O scheduling  (device-independent)
        │
  device driver        translate "read block 42" → controller commands
        │
  interrupt handler    services completion IRQ, copies data, wakes process
        │
  hardware             controller + DMA move the actual bytes
```

**User-space library** — `read()` is a thin wrapper that marshals arguments and executes the trap instruction. **Device-independent kernel layer** — resolves the fd, checks permissions, consults the buffer/page cache (maybe the data is already there → no hardware I/O at all), allocates buffers, and applies I/O scheduling. **Driver** — turns the generic request into device-specific register writes. **Interrupt handler** — the bottom of the descent: when the device finishes it fires an IRQ, the handler copies/acknowledges and wakes the sleeping process. Each layer only knows about the ones directly above and below it, which is why the design scales to thousands of devices.

### Q7. What is buffering in I/O and why does the OS do it?

**Buffering** is holding data in kernel (or library) memory between the producer and consumer of an I/O stream. It solves three problems:

- **Speed mismatch** — a fast producer and slow consumer (or vice versa) can't run in lockstep. A buffer lets the producer fill while the consumer drains at its own pace.
- **Transfer-size mismatch** — the network delivers 1500-byte packets but the application reads 1 byte at a time; the buffer reassembles the stream.
- **Copy semantics** — the kernel can copy the user's data into a buffer so the app can reuse its buffer immediately while the write is still in flight.

Flavors: **single buffer** (fill one, then process — producer stalls while consumer runs); **double buffering** (fill buffer B while consuming buffer A, then swap — overlaps I/O and compute); **circular/ring buffer** (a queue of buffers for continuous high-rate streams like audio or a NIC ring). Double and circular buffering are how the OS keeps a device continuously busy instead of stop-start.

### Q8. What's the difference between blocking, non-blocking, and asynchronous I/O?

**Blocking (synchronous)** — `read()` puts the thread to sleep until data is available, then returns it. Simple to reason about; the thread does nothing else while waiting. This is the model behind thread-per-connection servers.

**Non-blocking** — `read()` on a non-blocking fd returns *immediately*: data if ready, or `EWOULDBLOCK` if not. You must **poll** (retry later), typically in a loop with `select`/`epoll` so you're not spinning.

**Asynchronous (AIO)** — you *submit* the operation (`io_uring`, POSIX AIO, IOCP on Windows) and it starts in the background; you're **notified when it completes** (callback, completion queue, signal). The difference from non-blocking: non-blocking tells you "not ready, ask again"; async tells you "it's done, here's the result."

```text
blocking:      read() ──────[thread asleep]────── returns data
non-blocking:  read() → EWOULDBLOCK; read() → EWOULDBLOCK; read() → data
async:         submit(read) → (do other work) ── completion event → data
```

### Q9. What is I/O multiplexing and how do select/poll/epoll/kqueue relate to the C10K problem?

**I/O multiplexing** lets a *single thread* wait on *many* file descriptors at once and be told which are ready. Instead of one thread per connection (each blocked in `read`), one thread runs an **event loop**: "tell me which of these 10,000 sockets have data," then service exactly those.

- **`select`/`poll`** — you pass the whole set of descriptors on *every* call; the kernel scans all of them → **O(n) per call**. Fine for dozens of fds, brutal at thousands.
- **`epoll`** (Linux) / **`kqueue`** (BSD/macOS) — you *register* interest once; the kernel maintains the readiness state and hands you back **only the ready descriptors** → **O(ready)**, not O(total).

The **C10K problem** is "how do I serve 10,000 simultaneous connections on one box?" Thread-per-connection collapses under context-switch and memory overhead at that scale. `epoll`/`kqueue`-based event loops (nginx, Node.js, Redis) solve it: one (or a few) threads multiplex tens of thousands of mostly-idle connections cheaply. That's why the modern high-concurrency server is an event loop over `epoll`, not a thread pool of blocking reads.

### Q10. What is spooling, and how does it differ from buffering?

**Spooling** (Simultaneous Peripheral Operations On-Line) buffers an *entire job* for a device that **cannot interleave** streams from multiple processes. The canonical example is a **printer**: if two processes wrote to it concurrently, you'd get interleaved garbage — half of Alice's document, half of Bob's. So each process's output is spooled to a per-job file/queue on disk, and a spooler daemon feeds complete jobs to the printer one at a time.

The distinction from plain buffering: **buffering** smooths a speed/size mismatch for a *single* stream and typically lives in memory; **spooling** *serializes whole jobs* from *multiple* producers to a device that must see them atomically, and is usually disk-backed. Print queues, batch job schedulers, and outgoing mail queues are spooling.

### Q11. Memory-mapped I/O vs port-mapped I/O — what's the difference?

Both are ways for the CPU to reach a device controller's registers.

**Memory-mapped I/O (MMIO)** — device registers are assigned addresses in the physical **address space**. The CPU accesses them with ordinary `load`/`store` instructions; a store to address `0xFED0_0000` goes to a device register, not RAM. Pros: no special instructions, all the addressing modes work, easy to program. This is dominant on modern architectures (and the only option on ARM/RISC-V).

**Port-mapped I/O (PMIO)** — devices live in a **separate I/O address space** accessed by special instructions (x86 `in`/`out`). Keeps device space distinct from memory but needs dedicated opcodes and can't use normal memory operations.

A subtlety: MMIO regions must be marked **non-cacheable**, because a read from a status register must actually hit the device every time — caching it would return stale status.

### Q12. Why is a syscall/context-switch per I/O expensive, and how do batching and async help?

Every blocking `read()`/`write()` crosses the **user/kernel boundary** (a mode switch: save state, switch stacks, run the handler) and, if it blocks, triggers a **context switch** to another process (save/restore registers, page-table base, and TLB/cache pollution afterward). Individually cheap-ish (hundreds of ns to low microseconds), but at millions of tiny I/Os per second the overhead dominates — you spend more time entering/leaving the kernel than doing work.

Two mitigations:
- **Batching** — do more per crossing. `readv`/`writev` (scatter-gather) move many buffers in one syscall; `io_uring` submits and reaps *hundreds* of operations per syscall via shared ring buffers, amortizing the boundary crossing to near zero.
- **Async** — don't block. Submit work and keep the thread running instead of paying a context switch to sleep and another to wake. Combined with batching (`io_uring`), a single thread can drive enormous I/O throughput with very few kernel crossings.

This is why high-performance systems favor large sequential I/Os, vectored calls, and completion-based async over a syscall-per-byte design.

### Q13. Blocking thread-per-connection vs an epoll event loop for a network server — which and why?

**Thread-per-connection (blocking)** — each client gets a thread that blocks in `read`. Trivially simple to write; each request is straight-line code. But every thread costs a stack (often ~1 MB) and scheduling/context-switch overhead. At thousands of mostly-idle connections you drown in memory and switch cost — the **C10K** wall.

**Event loop (`epoll`/`kqueue`)** — one (or a per-core handful of) thread(s) register all sockets and process only the ready ones. Memory per connection is a few KB of state, not a whole stack; there's no per-connection context switching. This is nginx, Redis, Node.js, Envoy.

Guidance: for **high fan-out, mostly-idle, I/O-bound** workloads (web servers, proxies, chat), use an **event loop** — it's what makes 100k+ connections per box feasible. For **modest concurrency with CPU-heavy per-request work**, thread-per-connection (or a bounded thread pool) is simpler and lets the scheduler use all cores. Modern systems often combine both: a small pool of event-loop threads (one per core) plus a worker pool for blocking/CPU-bound tasks.

### Q14. How does an interrupt service the completion of an I/O at the hardware level?

Tie this to the interrupt mechanism (see the Interrupts topic). For interrupt-driven or DMA I/O the sequence on completion is:

```text
  device finishes  → raises interrupt request (IRQ) on its line
       │
  CPU finishes current instruction, saves state (PC, registers)
       │
  looks up handler via the interrupt vector (by IRQ number)
       │
  runs the ISR: acknowledge device, copy/verify data,
                mark the I/O request complete, wake the waiting process
       │
  restore state, return (iret); scheduler may now run the woken process
```

The key idea: the CPU wasn't watching the device — the **device announced itself** via the IRQ, the vector table mapped that IRQ to the right driver's **ISR**, and the ISR did the minimum needed to finish the transfer and unblock whoever was waiting. For DMA, the ISR fires once for the whole block (the data is already in memory); for programmed interrupt-driven I/O it may fire per word/packet.

### Q15. What is top-half vs bottom-half (deferred) interrupt handling, and why split the work?

An ISR should run **fast** — it typically runs with interrupts disabled (or at high priority), so a slow ISR delays every other interrupt and hurts latency. But real device servicing (processing a received network packet, walking a completion queue) can be substantial. The fix is to split it:

- **Top half** — the actual ISR. Do the bare minimum: acknowledge the device (so it stops asserting the IRQ), grab the data or note what happened, and **schedule** the rest of the work. Return fast.
- **Bottom half** — the deferred work, run later with interrupts *enabled*, at a lower priority. Linux implements this with **softirqs**, **tasklets**, and **workqueues**; the concept is "do the urgent acknowledgment now, do the heavy processing soon."

Example: a NIC's top half just says "packets arrived, ack the IRQ, raise a softirq"; the bottom half (softirq) actually pulls packets off the ring and pushes them up the network stack. This keeps interrupt latency low while still getting the work done, and it's why high-throughput drivers care a lot about the top/bottom split.

## Interrupts, Traps & System Calls

### Summary

**What this topic covers**

The single most important mechanism in an operating system: how control transfers *into* the kernel. Almost everything the OS does starts with either an **interrupt** (something external happened) or a **trap** (the running instruction needs the kernel). This topic unifies three things students usually learn separately: (1) **hardware interrupts** — asynchronous events from devices (timer, disk, NIC, keyboard); (2) **traps and exceptions** — synchronous events caused by the current instruction (a deliberate syscall, a recoverable fault like a page fault, or an unrecoverable abort); and (3) **the system call mechanism** — how a user program safely asks the kernel to do privileged work. Along the way: the interrupt vector table, the handling sequence, priorities/masking/nesting, why syscalls are expensive, the timer interrupt as the heartbeat of preemptive scheduling, signals, and the async-vs-sync distinction that is the heart of the whole topic. 16 questions, from "interrupt vs trap" to "walk me through a `read()` syscall end-to-end."

**Mental model**

There are exactly two ways the CPU stops running your instruction stream and jumps into the kernel, and the axis that separates them is **timing relative to the current instruction**. An **interrupt** is *asynchronous*: a device yanks a wire at an arbitrary moment, unrelated to whatever instruction you happen to be executing. A **trap/exception** is *synchronous*: it is *caused by* the instruction currently executing — a `syscall` instruction, a memory access that faults, a divide by zero. In both cases the hardware does the same choreography: finish/abort the current instruction, save enough state to resume, switch to **kernel mode**, index an **interrupt vector table** by a number to find the handler, run the handler, restore state, return. A **system call is just a deliberate trap** — the program executes a special instruction *on purpose* to cross into the kernel, because it needs a privileged operation it isn't allowed to perform itself. Hold onto async-vs-sync and "a syscall is a trap you asked for" and the whole topic falls into place.

**Key terms**

- **Hardware interrupt** — asynchronous signal from an external device; can arrive between any two instructions. **Maskable** (can be temporarily ignored) vs **non-maskable (NMI)** (e.g. hardware failure).
- **Trap / exception** — synchronous event caused by the executing instruction.
- **Software trap** — a deliberate exception used to request kernel service (a syscall).
- **Fault** — a recoverable exception; the handler fixes the condition and *restarts* the instruction (e.g. page fault).
- **Abort** — an unrecoverable exception (e.g. machine-check hardware error).
- **Interrupt vector table (IVT / IDT)** — array mapping interrupt/exception number → handler address.
- **Interrupt service routine (ISR)** — the handler that runs in response to an interrupt/trap.
- **System call** — the API by which a user program requests a privileged kernel operation via a trap.
- **Mode bit / dual-mode operation** — hardware flag: kernel mode (privileged) vs user mode (restricted).
- **Timer interrupt** — periodic hardware interrupt that returns control to the OS, enabling preemption.
- **Signal** — a "software interrupt" delivered to a *process* by the kernel (e.g. `SIGSEGV`, `SIGINT`).
- **Top/bottom half** — split of interrupt work into a fast handler plus deferred processing.

**Why interviewers ask this**

This is the topic that separates people who've *used* an OS from people who *understand* one. Anyone can say "the program calls `read`." The signal an interviewer wants: do you know that `read` isn't a normal function call — it's a **trap** that switches the CPU into kernel mode, that arguments must be **validated because the kernel can't trust a user pointer**, that the call is *expensive* because of the mode switch and cache/TLB effects, and that preemptive multitasking only works because of the **timer interrupt**? Juniors conflate interrupts and traps, or think a syscall is "just a function in the OS library." Seniors can draw the async-vs-sync line cleanly, explain the vector-table dispatch, and reason about why syscalls cost enough that people build `vDSO` and `io_uring` to avoid them. Getting "interrupt vs trap vs exception" and "how does a syscall actually work" right is a strong senior signal.

**Common confusions**

- "Interrupts and traps are the same." — No: interrupts are **asynchronous** (external, unrelated to the current instruction); traps are **synchronous** (caused by the current instruction). This is the whole point.
- "A system call is a function call into the OS library." — A libc *wrapper* is a normal function, but the actual crossing is a **trap** that changes privilege mode; you can't just `call` kernel code.
- "A page fault is an error." — A page fault is a *fault*: recoverable. The handler loads the page and **restarts** the instruction. Only an *invalid* access becomes `SIGSEGV`.
- "The OS decides to preempt whenever it wants." — The OS can only regain the CPU when *some* interrupt fires; the **timer interrupt** is what guarantees it periodically gets control.
- "Signals are hardware interrupts." — Signals are a kernel→process notification ("software interrupts" for processes), delivered in software; distinct from hardware IRQs.
- "The kernel can trust pointers a syscall passes." — Never. User-supplied pointers/lengths must be validated and copied carefully (`copy_from_user`) or a malicious program reads/writes kernel memory.

**What follows from this topic**

The timer interrupt is the enabler of the preemptive **CPU scheduling** topic — without it there's no preemption. The **page fault** mentioned here is elaborated end-to-end in the virtual-memory topics. Every entry in **I/O Systems** ends in an interrupt (device completion) and every I/O syscall crosses the boundary described here. The dual-mode/privilege machinery and the "validate user pointers" discipline lead directly into **Kernel & Protection**, where the syscall interface is analyzed as the OS's controlled attack surface.

### Q1. What's the difference between an interrupt, a trap, and an exception?

The organizing distinction is **synchronous vs asynchronous** — timing relative to the currently executing instruction.

- **Interrupt (hardware interrupt)** — **asynchronous**. Raised by an *external device* (timer, disk, NIC, keyboard) at an arbitrary time, unrelated to whatever instruction the CPU is running. It can arrive between any two instructions.
- **Trap** — **synchronous**, and *deliberate*. Caused by the executing instruction on purpose — the classic example is a **system call** (a "software trap"). Also used for debugger breakpoints.
- **Exception** — **synchronous**, caused by the executing instruction as a *side effect*, often unintentionally: a **fault** (recoverable, e.g. page fault — fix and restart), or an **abort** (unrecoverable, e.g. machine-check error).

```text
             caused by current instruction?
   NO (external, any time) ─────► INTERRUPT   (async: timer, disk, NIC)
   YES ─┬─ deliberate ──────────► TRAP        (sync: syscall, breakpoint)
        └─ side-effect ─────────► EXCEPTION    (sync: page fault, div-by-zero)
```

In casual usage "trap" and "exception" overlap (both are synchronous), and "trap" is often used as the umbrella term for any synchronous kernel entry. The line you must never blur is **interrupt = asynchronous/external**, **trap/exception = synchronous/instruction-caused**.

### Q2. Walk me through the interrupt/trap handling sequence step by step.

Whether it's a hardware interrupt or a trap, the hardware+kernel choreography is nearly identical:

```text
1. Finish (or abort) the current instruction to a clean point.
2. Save CPU state — at least the PC and status flags; enough to resume.
3. Switch to kernel mode (set the mode bit).
4. Determine the cause → an interrupt/exception NUMBER.
5. Index the interrupt vector table by that number → handler address.
6. Jump to and run the ISR (interrupt service routine / handler).
7. Restore the saved state.
8. Return to user mode (iret) — resume the interrupted program
   (or, for a fault, RESTART the faulting instruction).
```

Two nuances. For an **interrupt**, step 1 finishes the current instruction (nothing was wrong with it); the program resumes at the *next* instruction. For a **fault** (e.g. page fault), the instruction couldn't complete, so after the handler fixes the condition, step 8 **re-executes the same instruction**. The hardware saves just enough state to make either resumption possible; the ISR (in software) saves any additional registers it clobbers.

### Q3. What is the interrupt vector table and how is it used?

The **interrupt vector table** (on x86, the **IDT** — Interrupt Descriptor Table) is an array indexed by **interrupt/exception number** whose entries hold the **address of the corresponding handler** (plus, on x86, the privilege level and segment). It's the dispatch mechanism.

When an interrupt or trap occurs, the hardware produces a number identifying it — IRQ 0 is the timer, IRQ 1 the keyboard, vector 14 is the page fault, vector 0 divide-by-zero, `int 0x80`/`syscall` routes to the system-call entry. The CPU uses that number to index the table and jumps to the stored handler address. The kernel sets up this table at boot and registers a handler per number. This indirection is what lets the same "an interrupt happened" hardware path fan out to hundreds of distinct handlers — the number *is* the routing key.

### Q4. Hardware interrupt vs software trap — give concrete examples of each.

**Hardware interrupts (asynchronous, external):**
- **Timer** — fires every few ms; enables preemptive scheduling.
- **Disk/SSD completion** — "your block is ready."
- **NIC** — "a packet arrived."
- **Keyboard/mouse** — "a key was pressed."

These arrive independent of your code — your program could be doing arithmetic and a packet interrupt fires.

**Software traps / exceptions (synchronous, instruction-caused):**
- **System call** — `syscall`/`int 0x80`/`svc`, a deliberate trap to request kernel service.
- **Page fault** — accessing a not-present page; recoverable.
- **Divide-by-zero** — `int / 0`.
- **Invalid opcode** — CPU hit an instruction it doesn't recognize.
- **General protection fault** — an illegal/privileged access → often `SIGSEGV`.

The mental test: could this happen while running a *different* instruction? If yes (device events), it's an interrupt. If it's *this specific instruction's* doing (this memory access, this divide, this `syscall`), it's a trap/exception.

### Q5. Explain the system call mechanism in detail.

A user program can't directly execute privileged operations (touch hardware, change page tables, talk to disk). So it *asks* the kernel via a **system call**, which is a controlled trap:

```text
1. libc wrapper: put the syscall NUMBER in a register (e.g. rax on x86-64)
   and the ARGUMENTS in registers (rdi, rsi, rdx, ...).
2. Execute the trap instruction: `syscall` (x86-64) / `int 0x80` (old x86)
   / `svc` (ARM).
3. CPU switches to kernel mode and jumps to the fixed syscall entry point.
4. Kernel: dispatch by number through the syscall table → the handler.
5. Handler VALIDATES arguments (never trust user pointers), does the work.
6. Put the return value in a register (rax); set errno on error.
7. Return to user mode (sysret/iret); the wrapper hands the result back.
```

Key points an interviewer wants:
- The **libc wrapper** (`read`, `write`, `open`) is *not* the syscall — it's a thin function that sets up registers and executes the trap. The privilege crossing is the trap instruction.
- **The user/kernel boundary is a trust boundary.** Arguments — especially **pointers and lengths** — must be validated and copied via `copy_from_user`/`copy_to_user`. A user pointer could point at kernel memory or unmapped memory; blindly dereferencing it is a privilege-escalation or crash bug.
- Dispatch is **by number**, indexed into a syscall table — the same table-driven pattern as the interrupt vector.

### Q6. Why are system calls relatively expensive, and how do vDSO/batching reduce the cost?

A syscall isn't a plain function call — it's a **privilege-mode switch**, and it has second-order costs:

- **Mode switch** — save user state, switch stacks, enter the kernel, and on return restore everything. Hundreds of cycles minimum.
- **Pipeline/serialization** — the trap and return serialize the pipeline.
- **Cache and TLB effects** — kernel code and data evict some of your working set; on return you take cache/TLB misses re-warming user state. Post-Spectre/Meltdown mitigations (KPTI) made the boundary even pricier by switching page tables on entry/exit.

Reductions:
- **vDSO (virtual dynamic shared object)** — the kernel maps a page of read-only code/data into every process so calls like `gettimeofday`/`clock_gettime` execute *entirely in user space* (reading a kernel-maintained data page) with **no trap at all**.
- **Batching** — amortize the crossing over many operations: `readv`/`writev` (one call, many buffers), `sendmmsg`/`recvmmsg`, and especially **`io_uring`**, which submits and completes hundreds of operations through shared ring buffers per syscall. Fewer crossings → the fixed cost is spread thin.

The takeaway: on a hot path, *count your syscalls*, because each is far more expensive than an ordinary function call.

### Q7. Why is the timer interrupt essential? What breaks without it?

The **timer interrupt** is the OS's heartbeat — a hardware interrupt that fires periodically (say every 1–10 ms). It's what makes **preemptive multitasking** possible.

Here's the problem it solves: once the CPU is running a user process, the OS isn't running — it handed the CPU away. If that process never voluntarily makes a syscall and never yields (imagine `while(1){}`), how does the OS *ever* get the CPU back? Without a timer, it can't — a single runaway process would freeze the whole machine (this is exactly how cooperative-multitasking systems like classic Mac OS / Windows 3.x could hang).

The timer interrupt guarantees the OS periodically regains control **regardless of what the process does**: every tick, the timer fires, control traps into the kernel, and the scheduler runs — it can update time accounting, check if the running process has used its quantum, and **preempt** it in favor of another. So the timer interrupt is the precondition for Round-Robin, CFS, time slicing, and preemption in general. Turn it off and preemptive scheduling — and any guarantee of fairness or responsiveness — is gone.

### Q8. What's the difference between a library call and a system call?

| | Library call | System call |
|---|---|---|
| Runs in | User mode | Traps into kernel mode |
| Cost | Ordinary function call (cycles) | Mode switch + cache/TLB effects |
| Example | `strlen`, `qsort`, `printf`'s formatting | `read`, `write`, `open`, `fork`, `mmap` |
| Privilege | None needed | Performs privileged work on your behalf |

A **library call** is just a function in a userspace library (libc, your app's code); it executes in your process, in user mode, at function-call cost. A **system call** crosses into the kernel via a trap to do something you're not privileged to do yourself.

The confusing part: many library functions *wrap* syscalls. `printf` formats the string in user space (library work) and then calls `write` (a syscall) to actually output it. `malloc` is a library call that *occasionally* makes the `brk`/`mmap` syscall when it needs more memory from the kernel, but usually just hands out memory it already owns — which is exactly why `malloc` is fast most of the time.

### Q9. What are signals, and how do they differ from hardware interrupts?

A **signal** is a **software interrupt delivered to a process** by the kernel — an asynchronous notification that something happened: `SIGINT` (Ctrl-C), `SIGSEGV` (bad memory access), `SIGKILL`/`SIGTERM` (termination), `SIGCHLD` (a child changed state), `SIGALRM` (timer expired).

The analogy to hardware interrupts is deliberate: just as a hardware interrupt diverts the CPU to an ISR, a signal diverts a process to its **signal handler**, then (usually) resumes where it was. But the levels are different:

| | Hardware interrupt | Signal |
|---|---|---|
| Target | The **CPU/kernel** | A **process** |
| Source | A hardware device | The kernel (often on behalf of another process or an exception) |
| Handler | Kernel ISR (kernel mode) | User-space signal handler (user mode) |
| Delivery | Hardware wire → vector table | Software, checked on kernel→user return |

Note the tie-in: some signals *originate* from hardware exceptions — a memory-protection **fault** the kernel can't fix becomes `SIGSEGV` delivered to your process. So "invalid pointer → CPU exception (trap) → kernel handler → deliver `SIGSEGV` to the process" is the full chain, and it shows the two levels connecting.

### Q10. Walk me through a `read()` system call from the application to the data and back.

```text
app:    n = read(fd, buf, count);
  1. libc wrapper loads syscall number (SYS_read) + args (fd, buf, count)
     into registers, executes `syscall`.
  2. CPU switches to kernel mode, jumps to the syscall entry point.
  3. Kernel dispatches by number → sys_read; VALIDATES fd and that
     [buf, buf+count) is a writable user region.
  4. Resolve fd → open file → inode/socket. Check the page/buffer cache:
       - HIT:  copy data from cache to user buf (copy_to_user). Done fast.
       - MISS: issue I/O to the driver; BLOCK the process (sleep),
               scheduler runs someone else.
  5. (on miss) device + DMA transfer the block into a kernel buffer;
     completion INTERRUPT fires → ISR marks data ready, wakes the process.
  6. Kernel copies data into the user's buf, sets return value = bytes read.
  7. sysret → back to user mode; the wrapper returns n to the caller.
```

This one answer stitches the whole primer together: it's a **trap** (this topic), it **validates user pointers** (protection), it consults the **page cache** and may **page-fault**/block (VM + scheduling), and on a miss it ends in a **device completion interrupt** (I/O). The senior move is to mention the fast path (cache hit → no blocking, no hardware I/O) versus the slow path (miss → block, DMA, wake).

### Q11. Explain interrupt priorities, masking, and nesting.

Real machines get many interrupts, sometimes simultaneously, and some are more urgent than others — so interrupts have **priorities**.

- **Priorities** — each interrupt source has a priority level. A higher-priority interrupt can preempt a lower-priority handler; a lower-priority one waits.
- **Masking** — the CPU can temporarily **disable** (mask) interrupts, e.g. while in a critical region of kernel code that must not be interrupted, or to block same/lower-priority interrupts while servicing one. **Maskable** interrupts can be deferred this way; a **non-maskable interrupt (NMI)** cannot — it's reserved for things you must never ignore (hardware failure, watchdog).
- **Nesting** — if interrupts are left enabled during a handler, a higher-priority interrupt can fire *mid-handler*, nesting one ISR inside another (the state is saved on a stack, so it unwinds correctly).

Why it matters: a slow ISR that runs with interrupts masked delays everything else (motivating the top/bottom-half split — see Q14). And masking is a real **synchronization tool** in the kernel: on a uniprocessor, disabling interrupts is one way to protect a data structure the interrupt handler also touches.

### Q12. What is the mode bit and dual-mode operation, and how do they relate to traps?

The CPU has a **mode bit** implementing **dual-mode operation**: **kernel (supervisor) mode** where all instructions are allowed, and **user mode** where **privileged instructions** are forbidden (I/O instructions, halt, loading the page-table base register, disabling interrupts, modifying the mode bit itself). User code runs with the bit = user; the kernel runs with it = kernel.

The connection to traps: **the only way to flip from user to kernel mode is via an interrupt or trap.** You can't just set the bit — a `mov` to it in user mode is itself a privileged (forbidden) operation. So the mode transition is *bundled into* the interrupt/trap hardware path: when a trap or interrupt fires, the hardware atomically switches to kernel mode **and** jumps to a kernel-controlled handler address (from the vector table). This is what makes the boundary secure — user code can enter the kernel only at the specific, kernel-defined entry points, never at an address of its choosing. If a user program tries a privileged instruction directly, the CPU raises a **general protection fault** (a trap) and the kernel typically kills it. Dual-mode + trap-controlled entry is the hardware foundation of all OS protection.

### Q13. What happens when a user program divides by zero or dereferences a null pointer?

Both are **synchronous exceptions** — the *current instruction* triggers them — so the hardware traps into the kernel:

**Divide-by-zero:** the `div` instruction raises exception vector 0. The CPU saves state, switches to kernel mode, and vectors to the divide-error handler. On Unix the kernel translates this into a **`SIGFPE`** delivered to the process; with no handler installed, the default action terminates the process (often with a core dump).

**Null/invalid pointer dereference:** accessing address 0 (or any unmapped/protected page) raises a **page fault** (vector 14). The page-fault handler checks the faulting address against the process's memory map. If it's a *valid* page that's merely not resident (demand paging, COW), the handler fixes it and **restarts** the instruction — no error at all. If it's genuinely invalid (address 0, or writing a read-only page), the kernel converts it to **`SIGSEGV`**, and the default action kills the process ("Segmentation fault").

The lesson: the *same* page-fault mechanism serves both normal demand paging (recoverable, silent) and illegal accesses (fatal `SIGSEGV`) — the handler decides which by consulting the process's address-space map.

### Q14. What is top-half vs bottom-half interrupt handling and why defer work?

An ISR often runs with interrupts disabled or at elevated priority, so it must be **short** — a slow handler delays every other interrupt and hurts system latency. But some device work is genuinely heavy. The solution is to split interrupt handling into two parts:

- **Top half** — the immediate ISR. Do only the time-critical minimum: acknowledge the device (deassert the IRQ), grab whatever data must be captured now, and **schedule** the rest. Return quickly, re-enabling interrupts.
- **Bottom half** — the deferred processing, run *later* with interrupts enabled at lower priority. Linux implements it via **softirqs**, **tasklets**, and **workqueues**.

Example: a network card's top half notes "packets arrived, ack, raise a softirq"; the bottom-half softirq later pulls the packets off the ring and runs them up the protocol stack. This keeps **interrupt latency** low (short top halves) while still doing the substantial work soon after. It's the same principle behind keeping ISRs minimal, generalized into a two-tier design.

### Q15. Maskable vs non-maskable interrupts — what's the difference and why have both?

**Maskable interrupts** can be temporarily **disabled** (masked) by the CPU/kernel — the vast majority of device interrupts (timer, disk, NIC, keyboard) are maskable. The kernel masks them briefly while executing a critical region that an interrupt handler must not disrupt, then unmasks. If you couldn't mask them, you couldn't protect kernel data structures shared with handlers.

**Non-maskable interrupts (NMIs)** *cannot* be disabled — they always get through. They're reserved for conditions too important to ever ignore: a hardware failure (memory parity/ECC error, imminent power loss), a watchdog timer firing because the system is wedged, or a hardware debugger. You want an NMI precisely for "the kernel might be stuck with interrupts disabled, but we still must react."

The tradeoff is why both exist: **maskable** gives the kernel the *control* it needs to build critical sections and manage priorities; **non-maskable** gives a *guaranteed* escape hatch for catastrophic events that mustn't be deferrable. A well-designed system uses masking liberally for normal devices and reserves the NMI for genuine emergencies.

### Q16. How does a trap enforce the boundary between user and kernel — why can't a program just jump into kernel code?

Protection rests on two hardware facts working together:

1. **Kernel memory is protected.** The kernel's code and data are mapped with permissions that forbid user-mode access. If user code tries to *jump to* or read kernel memory directly, the MMU raises a fault — you can't just `call 0xffffffff81000000`.
2. **The mode switch is welded to the vector table.** The only way to gain kernel privilege is a trap/interrupt, and when one fires the hardware jumps to an address the **kernel** chose (from the IDT), not one the user supplied. So user code enters the kernel *only* at sanctioned entry points — the syscall entry, the fault handlers — never in the middle of a function it picked.

Put together: a program can't "jump into the kernel" because (a) it can't reach kernel addresses without faulting, and (b) even the legitimate entry — the `syscall` trap — lands at a fixed kernel-controlled dispatcher, which then *validates the request and its arguments* before doing anything. This is why the **syscall interface is the entire controlled attack surface** between an untrusted program and the privileged kernel: it's the one narrow, guarded doorway, and everything about traps is designed to make it the *only* one.

## Kernel & Protection

### Summary

**What this topic covers**

The kernel's privileged position and the machinery by which the OS enforces **isolation and protection** — how one buggy or malicious process is prevented from reading another's memory, corrupting the kernel, or seizing the hardware. Three concern areas: (1) **the privilege model** — kernel space vs user space, dual-mode operation and protection rings, privileged instructions, and the hardware that enforces the line; (2) **kernel architectures** — monolithic vs microkernel vs hybrid, the mechanism/policy split, kernel modules, and the security/performance tradeoffs between them; and (3) **protection and access control** — per-process memory isolation via page tables, the access matrix (capabilities vs ACLs), user IDs and least privilege, the trusted computing base, the syscall attack surface, and containers/sandboxes as extra confinement. The theme: a user program can only affect the world through **system calls the kernel validates**, so a buggy app crashes only itself while a kernel bug can take down everything. 15 questions, from "kernel vs user space" to "why are microkernels used in safety-critical systems."

**Mental model**

Think of the kernel as the one program the hardware *trusts absolutely* — and everything else as untrusted code that must be *contained*. The hardware gives the OS two tools: a **privilege mode** (kernel vs user; only kernel mode may run privileged instructions or touch the page-table base) and **per-process page tables** (each process sees only its own address space; the kernel's memory and other processes' memory simply aren't mapped, or are mapped no-access). Together these mean a user process is boxed: it can compute on its own memory, but the *only* way it can affect the outside world — files, other processes, devices — is by asking the kernel through a **system call**, which the kernel validates before acting. So protection isn't a wall the app runs into occasionally; it's the shape of the whole system. The design question that follows — *how much* code do you put inside the trusted kernel? — is what separates **monolithic** (everything in, fast but fragile) from **microkernel** (almost nothing in, robust but chatty) architectures.

**Key terms**

- **Kernel space vs user space** — the kernel's protected memory/privilege domain vs the restricted domain user processes run in; user code can't read/write kernel memory or other processes' memory.
- **Dual-mode operation** — the CPU mode bit: kernel (privileged) vs user (restricted).
- **Protection rings** — hardware privilege levels; on x86, **Ring 0** (kernel) … **Ring 3** (user).
- **Privileged instruction** — one only executable in kernel mode (I/O, halt, load page-table base, disable interrupts).
- **Trusted computing base (TCB)** — the set of components that must be correct for security to hold; smaller is more auditable and secure.
- **Monolithic kernel** — all OS services (scheduler, memory, drivers, FS) run in kernel space (Linux).
- **Microkernel** — only the minimum (IPC, scheduling, address spaces) in the kernel; drivers/FS run as user-space servers (Mach, QNX, seL4).
- **Kernel module** — dynamically loadable code that extends a monolithic kernel without a rebuild.
- **Mechanism vs policy** — separate *how* something can be done (mechanism) from *what* should be done (policy).
- **Access matrix** — rows = domains/subjects, columns = objects, cells = allowed rights; realized as **capabilities** (per-subject) or **ACLs** (per-object).
- **Least privilege** — grant each component only the rights it needs; don't run everything as root.
- **Attack surface** — the exposed interface (notably the syscall boundary) an attacker can try to exploit.

**Why interviewers ask this**

This topic reveals whether you understand *why* an OS is safe to run untrusted code, which is the whole reason operating systems exist. Junior answers: "the kernel manages everything" — true but empty. Senior answers connect the **hardware** (mode bit, rings, MMU page tables) to the **guarantee** (isolation) to the **consequence** (a segfault kills your process but not the machine; a kernel bug can). Interviewers also probe the **monolithic vs microkernel** tradeoff because it's a genuine engineering decision with real stakes — performance (IPC overhead) vs robustness (fault isolation) — and it's where you can show you understand that Linux chose speed with loadable modules while seL4 chose a tiny, formally-verified TCB for safety-critical use. Knowing *how the OS protects processes from each other*, in terms of the actual mechanisms, is a strong senior signal.

**Common confusions**

- "User space and kernel space are different RAM chips." — No, it's the same physical memory; the distinction is **privilege and page-table mappings**, enforced by the MMU, not separate hardware.
- "Microkernels are just smaller monolithic kernels." — The difference is *architectural*: in a microkernel drivers/FS run as **isolated user-space processes** communicating by message passing, not as kernel code.
- "Microkernels are always slower, so they're worse." — They pay IPC overhead but gain fault isolation; for **safety-critical/high-assurance** systems (avionics, seL4) that robustness is worth more than raw speed.
- "Root/admin bypasses the kernel." — Root has more *privileges granted by the kernel* (it can call more things), but still runs in **user mode** and goes through syscalls; it doesn't run in Ring 0.
- "A kernel bug is like any other bug." — A user bug is contained to one process; a **kernel** bug runs with full privilege and can corrupt anything — that's why kernel code is held to a far higher bar.
- "Isolation means processes can never share memory." — They can, but only when the kernel *explicitly* sets up a shared mapping (shared memory IPC); the default is isolation.

**What follows from this topic**

The isolation mechanism *is* the per-process **page tables** from the virtual-memory topics — protection and paging are the same machinery viewed from two angles. The syscall/trap boundary that confines processes is exactly the mechanism dissected in **Interrupts, Traps & System Calls**, and the "validate user pointers" discipline is a protection concern. Containers and sandboxes preview OS-level virtualization (namespaces + cgroups) covered in the virtualization topic. And the mechanism/policy split recurs in scheduling (the scheduler is mechanism; the policy is which thread to pick).

### Q1. What's the difference between kernel space and user space?

**Kernel space** is the privileged domain where the kernel executes: it runs in **kernel mode**, can execute any instruction, and its memory holds the kernel's code and data structures. **User space** is where ordinary processes run: in **user mode**, restricted, each in its own address space.

The two guarantees that define the boundary:
- A user process **cannot read or write kernel memory** — those pages are mapped no-access-from-user (or unmapped) in its page table. An attempt faults.
- A user process **cannot read or write another process's memory** — each process has its own page table, so another process's pages simply aren't in its address space.

Violations raise a hardware fault (typically → `SIGSEGV`). Crucially, "kernel space" and "user space" are **not different physical memory** — it's the same RAM; the difference is *privilege level* plus *what the MMU maps and with what permissions*. Crossing from user to kernel space happens only through the controlled trap/syscall doorway.

### Q2. Explain dual-mode operation and protection rings.

**Dual-mode operation** is the CPU's most basic protection feature: a **mode bit** selecting **kernel (supervisor) mode** — all instructions permitted — or **user mode** — privileged instructions forbidden. User code runs in user mode; the kernel runs in kernel mode; you switch only via a trap/interrupt (which the hardware welds to a kernel-chosen entry point).

**Protection rings** generalize this to more than two levels. x86 has four rings, 0–3, in decreasing privilege:

```text
   Ring 0  ── kernel        (full privilege)
   Ring 1  ── (rarely used, sometimes drivers/hypervisor guests)
   Ring 2  ── (rarely used)
   Ring 3  ── user apps      (least privilege)
```

In practice mainstream OSes use only **Ring 0 (kernel)** and **Ring 3 (user)** — the middle rings are largely unused (virtualization added a separate "Ring -1" / VMX root mode for hypervisors). **Privileged instructions** — I/O instructions, `hlt`, loading the page-table base register (CR3), disabling interrupts, changing the mode — execute only in Ring 0; attempting them in Ring 3 raises a general protection fault. The hardware enforces the ring check on every instruction, which is what makes the isolation trustworthy rather than advisory.

### Q3. What are privileged instructions and why must they be restricted to kernel mode?

**Privileged instructions** are operations that could subvert protection or the whole machine if any process could run them, so the hardware permits them **only in kernel mode**. Examples:

- **I/O instructions** — direct device access; unrestricted I/O would let a process read another's disk data or reprogram hardware.
- **Loading the page-table base register** (CR3 on x86) — whoever controls the page tables controls what memory is visible; a process that could reload it could map *anyone's* memory, destroying isolation.
- **Disabling interrupts** — a process that masks the timer interrupt could refuse to be preempted and hang the machine.
- **`hlt` / halt** — stopping the CPU.
- **Modifying the mode bit / segment/control registers.**

If a user-mode program attempts any of these, the CPU raises a **general protection fault** (a trap) and the kernel typically terminates it. The point: these are exactly the levers that enforce isolation and fairness, so they must be reachable *only* through the kernel — which is why a process wanting I/O must ask via a **system call** rather than doing it itself.

### Q4. How does the OS protect one process's memory from another?

Through **per-process page tables** plus the **MMU**. Each process has its own page table mapping *its* virtual addresses to physical frames. Another process's frames are simply **not present** in this mapping — there's no virtual address the process can even form that reaches them. On every memory access the MMU translates through the current process's page table and checks the permission bits; an access to an unmapped or protection-violating address raises a **page fault**, which for a genuinely illegal access the kernel turns into `SIGSEGV`.

```text
  process A vaddr ─┐                    ┌─ frame 7  (A's)
                   ├─ MMU + A's table ──┤
                   ┘                    └─ frame 3  (A's)
  process B vaddr ─┐                    ┌─ frame 9  (B's)
                   ├─ MMU + B's table ──┤   (B has NO mapping to 7 or 3)
                   ┘                    └─ frame 5  (B's)
```

Historically, before paging, the same isolation was done with **base and limit registers** — hardware bounds checked on every access, so a process could only touch `[base, base+limit)`. Paging is the modern, finer-grained version. Either way the enforcement is **hardware on every access**, so isolation can't be bypassed in software. Sharing is possible but must be *explicit*: the kernel maps the same frame into both page tables (shared-memory IPC). Default = isolated; sharing = opt-in and kernel-mediated.

### Q5. Compare monolithic, microkernel, and hybrid kernel architectures.

The axis is **how much runs inside the trusted kernel**.

| | Monolithic | Microkernel | Hybrid |
|---|---|---|---|
| In kernel | Everything: scheduler, MM, drivers, FS, net | Bare minimum: IPC, scheduling, address spaces | Monolithic-ish core, some services separated |
| Drivers/FS | Kernel space | User-space servers (message passing) | Mostly kernel space |
| Speed | Fast (no inter-service IPC) | Slower (IPC overhead per request) | Fast |
| Robustness | A driver bug can crash the whole kernel | A driver crash doesn't kill the kernel | In between |
| TCB size | Large | Small (more auditable/verifiable) | Large-ish |
| Examples | Linux, classic Unix, BSD | Mach, QNX, seL4, MINIX 3 | Windows NT, macOS XNU |

**Monolithic** — all OS services share one kernel address space and call each other as functions: fast, because there's no IPC between subsystems, but a bug in *any* driver runs with full privilege and can corrupt/crash everything. Linux mitigates rigidity with **loadable kernel modules** (add a driver at runtime without rebuilding) — but modules still run *in* the kernel.

**Microkernel** — only IPC, basic scheduling, and address-space management live in the kernel; drivers, file systems, and network stacks run as **isolated user-space server processes** that communicate by **message passing**. A crashed driver is just a dead process you can restart — the kernel survives. Cost: every service request becomes IPC (context switches, copies), historically a performance hit (the famous critique of Mach).

**Hybrid** — pragmatic middle ground: a largely monolithic kernel that borrows microkernel structure (Windows NT, macOS XNU, which wraps a Mach core with a BSD monolith).

### Q6. Why are microkernels favored for safety-critical systems despite the IPC overhead?

Because in a microkernel the **trusted computing base is tiny**, and fault isolation is architectural. In safety-critical or high-assurance domains — avionics, medical devices, defense, secure enclaves — the priority isn't raw throughput; it's *guaranteeing* the system won't be compromised or crash the wrong component.

Two payoffs:
- **Fault isolation** — a driver or file system is just a user-space process. If it has a bug and crashes, it doesn't take down the kernel; a supervisor can restart it. In a monolithic kernel that same driver bug is a kernel panic. QNX (used in cars, medical, industrial control) is prized for exactly this resilience.
- **Verifiability** — a small kernel is small enough to *formally prove correct*. **seL4** is a microkernel with a machine-checked mathematical proof that its implementation matches its specification and enforces its security properties. You cannot formally verify millions of lines of a monolithic kernel; you *can* verify ~10k lines of microkernel. A smaller TCB is a smaller thing that must be trusted, and thus a smaller thing that can go wrong.

So the IPC overhead is a price paid deliberately for **robustness and assurance** — the right tradeoff when a failure could kill someone, wrong when you just want a fast server (hence Linux's monolithic choice).

### Q7. What is the trusted computing base, and why does a smaller kernel improve security?

The **trusted computing base (TCB)** is the set of hardware and software components that **must be correct** for the system's security guarantees to hold. If anything in the TCB has a bug or is malicious, security can be violated *regardless* of how careful everything outside the TCB is. The kernel is the heart of the software TCB — it runs with full privilege, so a kernel flaw is a total compromise.

Smaller TCB → more secure, for two reasons:
- **Less code = fewer bugs and a smaller attack surface.** Every line of privileged code is a potential vulnerability; millions of lines (a monolithic kernel with hundreds of drivers) is an enormous surface. A microkernel's ~10k trusted lines has vastly fewer places to hide a flaw.
- **Auditability/verifiability.** A small TCB can be reviewed thoroughly or even **formally verified** (seL4). A giant one cannot.

This is the core argument for microkernels and for pushing drivers/services *out* of the kernel: code that isn't in the TCB, even if buggy, can't directly break security — it's confined like any other user process. "Keep the TCB small" is a foundational security principle, and kernel architecture is where it bites hardest.

### Q8. What is the access matrix, and how do capabilities differ from access control lists?

The **access matrix** is the general model of protection: a table where **rows are subjects/domains** (users, processes), **columns are objects** (files, devices, memory segments), and each **cell lists the rights** that subject has on that object (read, write, execute, own).

```text
            file1     file2     printer
  alice     r,w       r         w
  bob       r         r,w,own   -
```

The matrix is sparse, so real systems store it one of two ways:

- **Access Control List (ACL)** — store the matrix **by column**: each *object* carries the list of who may do what (`file2: {alice:r, bob:rw}`). This is how Unix/Windows file permissions work. Easy to answer "who can access this object?" and to revoke by editing the object's list; harder to answer "what can this subject access?"
- **Capabilities** — store the matrix **by row**: each *subject* holds unforgeable tokens ("capabilities"), each naming an object plus rights (`alice holds: {file1:rw, file2:r, printer:w}`). Possessing the capability *is* the authorization — like a key. Easy to answer "what can this subject do?" and to delegate (hand over a capability); revocation is harder. Microkernels like seL4 are **capability-based**: every kernel operation requires presenting a capability, which makes authorization explicit and auditable.

The tradeoff is essentially per-object vs per-subject bookkeeping, with mirror-image strengths in the "who/what can access" queries and in delegation vs revocation.

### Q9. How is a process confined — what can it actually do to affect the outside world?

A user process is boxed by the mechanisms above: it runs in **user mode** (no privileged instructions) inside its **own page table** (can't see other memory). Within that box it can compute freely on its own memory — but computing on your own memory doesn't *change* anything outside. The **only** way a process can affect the outside world — read/write a file, send a packet, create a process, talk to a device, share memory — is by making a **system call**.

And every system call is **validated by the kernel** before it acts: it checks permissions (does this process's UID have rights to this file?), validates arguments (is this pointer a legal user address?), and enforces policy. So the process's entire power over the world is *exactly* the set of syscalls the kernel is willing to perform on its behalf, subject to the kernel's checks.

This is why the **syscall interface is the confinement boundary**: narrow it (seccomp filters that whitelist allowed syscalls), and you shrink what a compromised process can do. Containers and sandboxes are built on precisely this observation — restrict the syscalls and the namespaces a process can reach, and you've confined it further without any new hardware mechanism.

### Q10. What are user IDs and least privilege, and why is running everything as root dangerous?

**User IDs (UIDs)** are how the kernel attaches an identity to a process for access-control decisions. On Unix, **root (UID 0)** is the superuser — the kernel skips most permission checks for it — while normal users have unprivileged UIDs whose access is filtered through file permissions/ACLs. (Note: root is still a *user-mode* identity with broad *granted* privileges; it is not Ring 0.)

**Least privilege** is the principle that every component should hold only the rights it actually needs, for only as long as it needs them. A web server that serves static files needs to read those files and bind a port — not to reformat the disk or read `/etc/shadow`.

Running everything as **root** violates this catastrophically: if a root process is compromised (a buffer overflow, an injection), the attacker inherits *all* of root's privileges — they can read every file, install kernel modules, create users, disable logging, and own the machine. The same exploit against an unprivileged, sandboxed service yields only that service's narrow rights. This is why daemons **drop privileges** after startup (bind the port as root, then `setuid` to a dedicated low-privilege user), why containers run as non-root, and why "don't run as root" is security 101. Least privilege turns a total compromise into a contained one.

### Q11. Why does a segfault kill only your process, but a kernel bug can take down the whole machine?

Because of **where the buggy code runs and what it's isolated by**.

A user process runs in **user mode** inside its **own page table**. When it dereferences a bad pointer, the MMU raises a page fault, the kernel sees the access is illegal, and delivers **`SIGSEGV`** — the default action of which is to terminate *that one process*. Nothing else is affected, because the faulting code never had access to anything else: the hardware confined it. The rest of the system — other processes, the kernel — is fully isolated from it. That isolation is the entire point: untrusted code can crash *itself* and no more.

A **kernel bug** is different in kind. Kernel code runs in **kernel mode** with **full privilege** and access to *all* physical memory and hardware. A bad pointer dereference or logic error in the kernel isn't caught by a higher authority — there *is* no higher authority. It can corrupt arbitrary memory, wedge a lock, or hit an unrecoverable fault, and the response is a **kernel panic / BSOD** — the whole machine goes down. There's nothing to isolate the kernel *from* itself.

This asymmetry is exactly why the kernel/TCB is held to a far higher standard and why architectures that shrink the kernel (microkernels) or push code out of it (drivers as user processes) improve robustness: they move buggy code from the "can crash everything" side of the line to the "can only crash itself" side.

### Q12. What is the attack surface of the system-call interface, and how is it reduced?

The **syscall interface is the one sanctioned doorway** from untrusted user code into the privileged kernel — which makes it the kernel's primary **attack surface**. Every syscall is kernel code running with full privilege, acting on arguments supplied by a possibly-malicious process. Classic risks:

- **Unvalidated arguments** — especially pointers and lengths. If a handler dereferences a user pointer without checking it (`copy_from_user`/`copy_to_user` exist for this), a process can trick the kernel into reading/writing kernel memory → info leak or privilege escalation.
- **Bugs in handlers** — a memory-safety flaw in *any* of the hundreds of syscalls (or `ioctl` sub-commands) is a potential kernel exploit; historically a huge source of local privilege-escalation CVEs.
- **Confused-deputy / TOCTOU** — the kernel acting on user-controlled state that changes between check and use.

Reductions:
- **Rigorous argument validation** — never trust a user pointer; validate ranges, copy carefully.
- **Syscall filtering** — **seccomp-BPF** lets a process (or its launcher) whitelist the syscalls it may make; a sandboxed process that can't call `ptrace`, `mount`, or arbitrary `ioctl`s has a far smaller surface to attack.
- **Smaller/verified kernels** — fewer syscalls and less privileged code (microkernels) shrink the surface intrinsically.

The general principle: the boundary is unavoidable, so you *harden* it (validate) and *narrow* it (filter, minimize) rather than pretend it isn't there.

### Q13. What do kernel modules add, and what's the tradeoff of loadable kernel code?

**Kernel modules** are dynamically **loadable** pieces of kernel code — a driver, a filesystem, a network protocol — that can be inserted into and removed from a running monolithic kernel *without* rebuilding or rebooting it (`insmod`/`modprobe` on Linux). They give a monolithic kernel much of the **extensibility** of a microkernel's pluggable servers: you ship a lean base kernel and load only the drivers a given machine needs, and vendors distribute drivers separately.

The catch — and the crucial security point — is that **a module runs *in* the kernel, in Ring 0, with full privilege.** It is *not* isolated like a microkernel's user-space server. So:
- A buggy module can corrupt kernel memory or panic the machine, exactly like built-in kernel code.
- A malicious or signed-but-vulnerable module is a direct path to full compromise — which is why loading modules requires root and why systems use **module signing** and lockdown modes to restrict what can be loaded.

So modules are a *packaging/flexibility* win, not an *isolation* win. This is precisely the line between the monolithic approach (extensible but the extension is trusted) and the microkernel approach (the driver is a contained, restartable process). Understanding that distinction — loadable ≠ isolated — is a senior tell.

### Q14. What is the mechanism-vs-policy separation, and why does it matter for kernel design?

**Mechanism** is *how* something can be done; **policy** is *what* should be done. Good OS design **separates** them: the kernel provides flexible mechanisms, and leaves the (changeable, debatable) policy decisions to a higher, easily-modifiable layer.

Examples:
- **Scheduling** — the *mechanism* is the context switch and the ability to run any ready thread; the *policy* is which thread to pick (Round-Robin? priority? CFS?). Linux even makes the policy pluggable (scheduling classes).
- **Memory** — the *mechanism* is paging and the page tables; the *policy* is which page to evict (LRU/Clock).
- **Access control** — the *mechanism* is the permission-check hook on each operation; the *policy* is the actual rules (Unix perms, SELinux labels).

Why it matters: policies change often and vary by workload; mechanisms are hard to get right and change rarely. If you bake a policy into the mechanism, you must modify trusted, hard-to-change kernel internals every time the policy should change. Keeping them separate lets you tune or replace policy (a new scheduler, a new security module like SELinux/AppArmor) without touching the delicate mechanism — safer, more flexible, and easier to reason about. Microkernels take this to the extreme: push as much *policy* as possible out into user-space servers, leaving the kernel as pure mechanism.

### Q15. Kernel vs user space, monolithic vs microkernel, and how the OS protects processes — give me the whole picture.

The unifying story:

**The line.** The hardware provides **dual-mode operation** (kernel vs user, via the mode bit/rings) and an **MMU with per-process page tables**. The kernel runs privileged in **kernel space**; every process runs restricted in **user space**, in its own address space. This gives two guarantees: a process can't run privileged instructions, and can't touch memory outside its own map. Both are enforced by hardware on every instruction/access, so they're not bypassable in software.

**How processes are protected from each other.** Separate page tables mean process A literally has no address that names process B's memory; the MMU faults on any stray access (→ `SIGSEGV`). The *only* way a process affects anything beyond its own memory is a **system call**, which the kernel **validates** (permissions, argument sanity) before acting. So each process is a sealed box with one guarded door.

**The design question — how big is the trusted kernel?** Monolithic (Linux) puts *everything* — drivers, FS, scheduler — in kernel space: fast (no inter-service IPC) but fragile (any driver bug can panic the machine) and a large TCB, softened by loadable modules. Microkernel (seL4, QNX) keeps only IPC/scheduling/address-spaces in the kernel and runs drivers/FS as **isolated user-space servers**: robust (a driver crash is a restartable process), small verifiable TCB, but pays IPC overhead. Hybrid (Windows NT, macOS XNU) splits the difference.

**The consequence.** Because untrusted code is boxed, a **user bug crashes only its own process**; because the kernel is the one fully-privileged component with no higher authority, a **kernel bug can crash everything** — which is why we keep the TCB small, apply least privilege, harden and narrow the syscall attack surface, and, in the highest-assurance settings, formally verify a tiny microkernel. Kernel vs user space is the line; monolithic vs microkernel is *where you draw it*; and protecting processes from each other is *what the line buys you*.
## Virtualization & Containers

### Summary

**What this topic covers**

How one physical machine is made to run many isolated environments, and the two dominant technologies for doing it: **virtual machines** (hardware virtualization via a hypervisor) and **containers** (OS-level virtualization via kernel primitives). This is where OS fundamentals meet the cloud: a VM virtualizes the *hardware* so each guest runs its own full kernel, while a container virtualizes the *operating system* so many isolated user-spaces share one host kernel. The 16 questions here walk from "what is a hypervisor" and "type-1 vs type-2" through the mechanics of how virtualization actually works (trap-and-emulate, hardware assist, nested page tables) to the heart of the topic — how a container is built from Linux **namespaces** + **cgroups** — and the crucial engineering decision of **VMs vs containers**: isolation strength versus weight and density. It closes with the security nuance (a container is *not* a VM-grade sandbox) and the modern hybrid (microVMs, containers-in-VMs).

**Mental model**

Draw the stack twice. For a **VM**: hardware → **hypervisor** → [guest kernel → guest user-space] × N. The hypervisor is a thin layer that carves the real CPU/RAM/devices into virtual ones; each VM boots a whole OS that believes it owns the machine. Strong isolation, because each guest has its own kernel and the hypervisor is the only shared boundary. For a **container**: hardware → **host kernel** → [isolated user-space] × N, all sharing that *one* kernel. There is no guest OS — a container is just a set of processes the kernel has been told to show a restricted view of the world (namespaces) and cap the resources of (cgroups). That single difference — *own kernel vs shared kernel* — explains everything downstream: VMs are heavy (GBs, seconds to boot, can run a different OS) and strongly isolated; containers are light (MBs, milliseconds to start, must match the host kernel) and more weakly isolated. Most clouds run containers *inside* VMs to get both.

**Key terms**

- **Hypervisor / VMM** — the layer that creates and runs virtual machines, virtualizing CPU, memory and devices.
- **Type-1 (bare-metal)** — hypervisor runs directly on hardware (ESXi, Xen, Hyper-V, KVM); best performance/isolation; servers and cloud.
- **Type-2 (hosted)** — hypervisor runs as an app on a host OS (VirtualBox, VMware Workstation); convenient for desktops.
- **Guest vs host** — the guest OS runs *inside* the VM; the host is the machine (or OS) underneath.
- **Trap-and-emulate** — the classic technique: let the guest run natively, trap privileged instructions to the hypervisor to emulate.
- **Hardware-assisted virtualization** — Intel VT-x / AMD-V; CPU support that makes x86 cleanly virtualizable (a guest ring below ring 0).
- **Nested page tables / EPT** — hardware two-level address translation (guest-virtual → guest-physical → host-physical) so the MMU handles memory virtualization.
- **Paravirtualization** — guest is modified to call the hypervisor directly (hypercalls) instead of trapping, for speed.
- **Namespace** — Linux primitive isolating what a process can **see** (pid, net, mnt, uts, ipc, user).
- **cgroup (control group)** — Linux primitive that **limits and accounts** what a process can **use** (CPU, memory, I/O, pids).
- **Container image** — a layered, union/overlay filesystem bundling the app plus its user-space dependencies.
- **microVM** — a lightweight VM (Firecracker, Kata, gVisor) that adds a hypervisor boundary back around container-like workloads.

**Why interviewers ask this**

Virtualization sits exactly on the seam between OS theory and how modern infrastructure is actually deployed, so it separates candidates who *use* Docker from those who understand *why it works*. The junior answer is "a VM is a computer inside a computer and Docker is like a lightweight VM." The senior answer names the mechanism: a container shares the host kernel and is built from namespaces (visibility) + cgroups (resource limits) — it is not a lightweight VM, it is not virtualizing hardware at all. Getting the **VMs vs containers** tradeoff right (isolation vs weight vs density) and the security caveat (shared kernel = a kernel exploit escapes the container) signals someone who can make real deployment decisions rather than repeat marketing.

**Common confusions**

- "A container is a lightweight VM." No — a VM virtualizes hardware and runs its own kernel; a container shares the host kernel and virtualizes the OS. Different mechanism entirely.
- "Containers are as secure/isolated as VMs." No — the shared kernel is a much larger attack surface; a kernel exploit escapes the container. VMs have a stronger (hypervisor) boundary.
- "The hypervisor is the host OS." Not for type-1 — a bare-metal hypervisor *is* the lowest layer; there is no host OS beneath it.
- "Docker images contain an OS." They contain a user-space filesystem (libc, binaries) but **no kernel** — they borrow the host's.
- "Namespaces and cgroups do the same thing." No — namespaces control what you *see*, cgroups control what you *use*. You need both.
- "You must choose VM or container." In practice you run containers inside VMs (as most clouds and Kubernetes do) for density *and* isolation.

**What follows from this topic**

This topic is the culmination of the earlier mechanics: namespaces build on the **process** and **PID** model, cgroups build on **CPU scheduling** and **memory** management, overlay filesystems build on the **file systems** topic, and the isolation discussion feeds directly into **OS Security** (namespaces, seccomp, and capabilities as sandboxing) and boot (a VM boots a full kernel via the same power-on → bootloader → kernel path). It ties conceptually to the practical Docker and Linux primers — here we explain *why* those tools behave as they do.

### Q1. What is a hypervisor, and what's the difference between Type-1 and Type-2?

A **hypervisor** (or VMM, Virtual Machine Monitor) is the software layer that creates and runs virtual machines: it virtualizes the CPU, memory and devices so multiple guest operating systems can share one physical machine, each believing it owns the hardware.

| | Type-1 (bare-metal) | Type-2 (hosted) |
|---|---|---|
| Runs on | Directly on hardware | On top of a host OS, as an app |
| Examples | ESXi, Xen, Hyper-V, KVM* | VirtualBox, VMware Workstation, Parallels |
| Performance | Higher (thin layer, direct hardware) | Lower (goes through host OS) |
| Isolation | Stronger | Weaker |
| Use case | Servers, data centers, cloud | Desktops, dev/test |

The one-liner: a **type-1** hypervisor *is* the lowest software layer (no host OS beneath it), giving the best performance and isolation for servers and cloud; a **type-2** runs as an application inside an ordinary OS, which is convenient on a laptop but slower.

(*KVM is interesting — it turns the Linux kernel itself into a type-1 hypervisor, so it's often called a hybrid.)

### Q2. How does virtualization actually work at the CPU level? Why wasn't x86 originally virtualizable?

The classic technique is **trap-and-emulate**: let the guest run natively on the real CPU for ordinary instructions, but when the guest tries a *privileged* instruction (one that only ring-0 code may run), the CPU **traps** into the hypervisor, which **emulates** the instruction's effect on the virtual hardware and returns. The guest kernel runs in a de-privileged mode and never notices.

The problem: **classic x86 was not virtualizable** (Popek-Goldberg sense). Some privileged instructions didn't trap when run un-privileged — they just silently did the wrong thing or leaked host state — so pure trap-and-emulate was impossible. Early solutions:

- **Binary translation** (VMware's original trick) — rewrite the guest's kernel instruction stream on the fly to intercept the bad instructions.
- **Paravirtualization** (Xen) — modify the guest OS to replace privileged instructions with explicit **hypercalls** into the hypervisor.
- **Hardware-assisted virtualization** (Intel **VT-x** / AMD **AMD-V**, ~2006) — the CPU added a new mode *below* ring 0 (a "root" mode for the hypervisor and a "non-root" mode for the guest), so privileged guest instructions cleanly trap to the hypervisor. This is what made fast, unmodified-guest virtualization mainstream.

### Q3. How is memory virtualized? What are nested page tables / EPT?

Without hardware help, the guest has its own page tables mapping guest-virtual → guest-physical, but "guest-physical" isn't real — it must be mapped again to host-physical. The hypervisor kept **shadow page tables** merging both levels, trapping every guest page-table update. Correct but expensive.

**Nested page tables** (Intel **EPT**, AMD **RVI/NPT**) solve it in hardware: the MMU now walks *two* levels of translation on a miss —

```text
guest-virtual --(guest page table)--> guest-physical --(EPT / nested page table)--> host-physical
```

The guest manages its own page tables freely (no trap), and the hardware transparently applies the second (hypervisor-controlled) translation. This dramatically cut virtualization overhead. It's the memory-management analogue of VT-x for the CPU.

### Q4. What does a VM give you, and what does it cost?

**What you get:**
- **Strong isolation** — each VM has its own kernel; the only shared boundary is the hypervisor.
- **Run different OSes** — Windows guest on a Linux host, old kernel on new hardware, etc.
- **Encapsulation** — the whole machine is a file: **snapshot**, clone, **live-migrate** to another host, roll back.
- Hardware consolidation — many under-utilized servers become VMs on one box.

**What it costs:**
- **Weight** — each VM carries a *full OS*: gigabytes of RAM and disk, its own kernel, drivers, services.
- **Slow boot** — seconds to minutes (a real OS boot sequence).
- **Overhead** — CPU/memory/IO virtualization tax (small with hardware assist, non-zero).
- **Density** — you can pack far fewer VMs than containers on the same host.

That cost profile is exactly what containers were invented to avoid.

### Q5. What is a container, and how is it different from a VM?

A **container** is an isolated user-space instance that **shares the host kernel** — there is no guest OS. It's really just a set of processes that the kernel has been told to (a) show a restricted view of the system to, and (b) cap the resources of. This is **OS-level virtualization** (Docker, LXC, Podman).

Because there's no guest kernel to boot and no hardware to virtualize, a container is **lightweight**: an image is megabytes (just the app + its user-space libraries), it starts in **milliseconds**, and you can pack hundreds on a host.

```text
   VMs                              Containers
┌─────┐┌─────┐┌─────┐          ┌────┐┌────┐┌────┐┌────┐
│app  ││app  ││app  │          │app ││app ││app ││app │
│libs ││libs ││libs │          │libs││libs││libs││libs│
│guest││guest││guest│  <-full  └────┘└────┘└────┘└────┘
│ OS  ││ OS  ││ OS  │   kernel  ┌──────────────────────┐
└─────┘└─────┘└─────┘   each    │   shared host kernel  │
┌──────────────────┐            └──────────────────────┘
│    hypervisor    │            ┌──────────────────────┐
├──────────────────┤            │       hardware        │
│     hardware     │            └──────────────────────┘
└──────────────────┘
```

The key difference is the shared kernel: it makes containers cheap, but it also makes their isolation weaker than a VM's.

### Q6. How are containers built from Linux kernel primitives? (namespaces + cgroups)

This is the crux. A container isn't a special object in the kernel — it's ordinary processes combined with two features, plus a filesystem trick:

**Namespaces — isolate what a process can SEE.** Each namespace virtualizes one global resource so the container gets its own view:
- **pid** — its own process tree; the container's first process is PID 1, can't see host processes.
- **net** — its own network stack: interfaces, IP, routing, ports.
- **mnt** — its own filesystem mount points / root.
- **uts** — its own hostname and domain name.
- **ipc** — its own System V IPC / POSIX message queues.
- **user** — its own uid/gid mapping (uid 0 inside can map to unprivileged uid outside).

**cgroups (control groups) — LIMIT and account what a process can USE:** cap and measure CPU, memory, block I/O, and the number of pids. This is what stops one container from starving the others.

**Union/overlay filesystem** (OverlayFS) — stacks read-only image layers with a thin writable layer on top, giving fast, deduplicated, layered images.

**Capabilities + seccomp** — drop root capabilities and restrict the syscalls the container may make, shrinking the attack surface.

So: **namespaces give the illusion of a private machine, cgroups enforce fair resource use, overlayfs supplies the root filesystem, and seccomp/capabilities confine it.** "Docker" is orchestration around these kernel features.

### Q7. Namespaces vs cgroups — what does each one do?

Easy to confuse; they're complementary halves:

| | Namespaces | cgroups |
|---|---|---|
| Controls | What a process can **see** | What a process can **use** |
| Purpose | Isolation / visibility | Resource limiting + accounting |
| Examples | pid, net, mnt, uts, ipc, user | CPU shares, memory limit, I/O, pids max |
| Effect | Container has its own process tree, network, root FS, hostname | Container capped at e.g. 2 CPUs and 512 MB |

Mnemonic: **namespaces = view, cgroups = resources.** A container needs both — visibility isolation without resource limits lets one container starve the host; limits without isolation lets containers see and signal each other's processes.

### Q8. VMs vs containers — give me the full comparison.

| Dimension | Virtual Machine | Container |
|---|---|---|
| Virtualizes | Hardware | The OS (user-space) |
| Kernel | Own guest kernel per VM | Shares the host kernel |
| Isolation | Strong (hypervisor boundary) | Weaker (shared kernel) |
| Weight | Heavy — GBs, full OS | Light — MBs, app + libs |
| Boot / start | Seconds to minutes | Milliseconds to sub-second |
| Density per host | Tens | Hundreds+ |
| Run a different OS? | Yes (Windows on Linux) | No — must match host kernel |
| Attack surface | Small (hypervisor) | Large (whole kernel syscall API) |
| Best for | Strong isolation, mixed OSes, untrusted multi-tenant | Density, fast scaling, microservices, CI |

The single sentence that captures it: **a VM gives strong isolation at high cost because each has its own kernel; a container gives high density at lower isolation because they share one kernel.** They're not competitors so much as different points on the isolation/weight curve.

### Q9. When should you use a VM vs a container vs both?

- **VM** when you need **strong isolation** (untrusted or hostile multi-tenant workloads), must run a **different OS or kernel**, or need whole-machine snapshot/migration.
- **Container** when you want **density, fast startup, and easy packaging** — microservices, stateless web apps, CI jobs, anything you scale up and down quickly and that trusts the host kernel.
- **Both (containers-in-VMs)** — the standard cloud/Kubernetes pattern: run each tenant's containers inside a VM. You get containers' density and packaging *inside* a VM's strong isolation boundary. Cloud providers do this so one customer's container can't threaten another's via a kernel bug — the VM boundary contains the blast radius.

The mental default in 2026: containers for packaging and scaling, VMs (or microVMs) for the isolation boundary around them.

### Q10. Why does a container start in milliseconds but a VM in seconds?

Because a VM does a **real OS boot** and a container does not.

Starting a VM: the hypervisor allocates virtual hardware, then the guest runs firmware → bootloader → **kernel initialization** (decompress kernel, set up paging, probe and initialize drivers) → **init** brings up services and the login target. That's the entire boot sequence — seconds at best.

Starting a container: there's no kernel to boot — the host kernel is already running. The runtime just creates the namespaces, sets up cgroup limits, mounts the overlay filesystem, and `exec`s the container's process. That's a handful of syscalls — milliseconds.

The difference is precisely the guest kernel: a container skips the entire "power-on to init" pipeline because it reuses the host's already-booted kernel.

### Q11. Is a container a real security boundary? What's the risk of a shared kernel?

**A container is not a VM-grade sandbox.** Because every container shares the one host kernel, the *entire kernel syscall interface* is the attack surface. If a process finds a kernel vulnerability, it can escalate and **escape the container** to the host and thus to every other container on it. A VM, by contrast, only exposes the much smaller hypervisor interface — an escape requires a hypervisor bug, which is rarer.

So containers give **isolation, not a hard security boundary**. Mitigations shrink the surface: drop capabilities, apply **seccomp** filters (restrict syscalls), use **user namespaces** (so container-root isn't host-root), SELinux/AppArmor. But for genuinely untrusted code you add a real boundary:

- **Kata Containers** — run each container inside a lightweight VM.
- **Firecracker** — minimal microVM (used by AWS Lambda/Fargate) with a tiny hypervisor.
- **gVisor** — a user-space kernel that intercepts container syscalls so they never hit the host kernel directly.

These "microVM" approaches bridge the gap: near-container startup and density with near-VM isolation.

### Q12. What is live migration, and how do snapshots work?

A VM's entire state — CPU registers, RAM, virtual devices, disk — lives in the hypervisor, so it can be **captured as data**:

- **Snapshot** — freeze and save the VM's full state (memory + disk) to a file. You can roll back to it later, or clone it. Great for testing (snapshot, break things, restore).
- **Live migration** — move a *running* VM to another physical host with near-zero downtime. The hypervisor **pre-copies** memory pages to the destination while the VM keeps running, iteratively re-copying pages that changed (dirty pages), then briefly pauses to copy the last delta and CPU state, and resumes on the new host. Used for load balancing and draining a host for maintenance without stopping services.

Containers can be checkpoint/restored too (CRIU), but it's less mature — this encapsulation is a classic VM strength.

### Q13. What is paravirtualization and how does it differ from full virtualization?

**Full virtualization** — the guest OS is unmodified and doesn't know it's virtualized; the hypervisor handles the illusion via trap-and-emulate (aided by VT-x). Maximum compatibility.

**Paravirtualization** — the guest OS is **modified** to be aware it's virtualized and cooperates with the hypervisor, replacing slow-to-virtualize privileged operations with explicit **hypercalls** (a call directly into the hypervisor, analogous to a syscall into a kernel). Xen pioneered this. It's faster because you avoid the cost of trapping and emulating, but it requires a modified guest kernel.

In practice the two blend: even fully-virtualized guests use **paravirtualized drivers** (virtio for disk/network) for I/O speed while relying on hardware assist for CPU/memory. So modern VMs are "hardware-assisted full virtualization with PV drivers."

### Q14. What does an overlay/union filesystem do for container images?

A container image is built in **layers**, and a union/overlay filesystem (OverlayFS on Linux) stacks them into one view:

- Each image layer (base OS libs, then your dependencies, then your app) is a **read-only** layer.
- Layers are **shared and deduplicated** across images and containers — if ten containers use the same base layer, it's stored once.
- When a container runs, the runtime adds a thin **writable layer** on top. Reads fall through to lower layers; a write triggers **copy-on-write** — the file is copied up into the writable layer and modified there, leaving the shared layers untouched.

Benefits: images are small (you ship only your layer's diff), pulls are fast (cached layers are reused), and many containers from one image cost almost no extra disk. It's the same copy-on-write idea used by `fork()`, applied to filesystems.

### Q15. How do serverless functions and isolates fit into this picture?

Serverless (FaaS) pushes the isolation/density tradeoff to an extreme: run tiny, short-lived pieces of code with the *lowest possible* startup latency and cost, while still isolating tenants.

- **microVMs** — AWS Lambda runs functions in **Firecracker** microVMs: a stripped-down VM that boots in ~milliseconds yet keeps a real hypervisor boundary. Best of both: VM isolation, near-container startup.
- **V8 isolates** (Cloudflare Workers) — go further: many tenants share a single process, isolated by the language runtime's **isolate** mechanism rather than by the kernel or a hypervisor. Startup is sub-millisecond and memory per tenant is tiny, but isolation now depends on the runtime's correctness (a narrower, application-level boundary).

The theme across VMs → containers → microVMs → isolates is a sliding scale: as you make the unit lighter and faster to start, the isolation boundary generally gets thinner, and engineers pick the point that matches how much they trust the code.

### Q16. In one answer: what's a hypervisor, VM vs container, and how do containers actually isolate?

**Hypervisor** — the layer that creates virtual machines by virtualizing hardware; type-1 runs bare-metal (ESXi, KVM, Xen — cloud/servers), type-2 runs as an app on a host OS (VirtualBox — desktops).

**VM vs container** — a **VM** virtualizes *hardware*: each runs its own full guest kernel behind the hypervisor, giving **strong isolation** but heavy weight (GBs, seconds to boot), and it can even run a different OS. A **container** virtualizes the *OS*: many isolated user-spaces **share the host kernel**, so there's no guest OS — they're **light** (MBs, millisecond start) and dense, but isolation is **weaker** because a kernel exploit escapes to the host.

**How containers isolate** — not magic, just two Linux kernel features plus a filesystem: **namespaces** restrict what a process can *see* (its own pid tree, network, mount/root, hostname, ipc, users), **cgroups** restrict what it can *use* (CPU, memory, I/O, pids), an **overlay filesystem** supplies the layered root, and **seccomp/capabilities** confine syscalls. Because they share the kernel, containers give isolation but not a VM-grade security boundary — for untrusted code you wrap them in a microVM (Firecracker/Kata/gVisor). Most clouds run containers *inside* VMs to get density and isolation at once.

## OS Security

### Summary

**What this topic covers**

How an operating system tries — and sometimes fails — to protect processes and data from each other and from malicious code. Security is the OS's job precisely because it's the one component that runs privileged and mediates every access to hardware, memory, and other processes. The 15 questions here cover the goals (confidentiality, integrity, availability applied to an OS), the two pillars of access control — **authentication** (who are you) and **authorization** (what may you do: DAC vs MAC vs RBAC, capabilities vs ACLs, least privilege) — and then the concrete arms race: **memory-safety exploits** (buffer overflow / stack smashing) and the OS/compiler defenses that answer them (**stack canaries, DEP/NX, ASLR**), **privilege escalation**, **SUID** binaries as attack surface, **sandboxing** (seccomp, namespaces, chroot/jails, dropping capabilities), the **syscall interface** as *the* boundary the kernel must defend, high-level **side-channel/hardware attacks** (Spectre/Meltdown, KPTI), **rootkits** and kernel integrity (secure boot, code signing), audit logging, and full-disk encryption.

**Mental model**

Think of the OS as the referee that every access must go through, and security as making that referee un-bypassable and un-foolable. Two questions frame almost everything: **"Who is this principal?"** (authentication) and **"Is this principal allowed to do this?"** (authorization). Underneath sits the hardware guarantee that makes it enforceable — **dual-mode** operation (user vs kernel) and memory protection via the MMU — so user code physically cannot touch kernel memory or another process's pages except through the **syscall** gate. Attacks are attempts to break that model: trick the referee (confused deputy, SUID abuse), get past it (buffer overflow hijacks control flow *inside* a process; privilege escalation crosses the user→root boundary), or go under it (side-channel leaks across the isolation boundary, rootkits compromise the referee itself). Every defense — canaries, NX, ASLR, least privilege, seccomp, secure boot — is a way to keep that boundary intact or limit the blast radius when it's breached.

**Key terms**

- **Authentication** — verifying *who* a principal is (passwords + salted hashes, MFA, biometrics, tokens).
- **Authorization / access control** — deciding *what* an authenticated principal may do.
- **DAC (discretionary)** — the resource owner sets permissions (Unix rwx, ACLs).
- **MAC (mandatory)** — the system enforces labels/policy the user can't override (SELinux, AppArmor).
- **RBAC** — permissions granted via roles rather than to individuals.
- **Principle of least privilege** — every component runs with the minimum rights it needs.
- **Buffer overflow / stack smashing** — writing past a buffer to overwrite a return address and hijack control flow.
- **Stack canary** — a guard value placed before the saved return address; a changed canary aborts the program.
- **DEP / NX** — mark data pages non-executable so injected code can't run.
- **ASLR** — randomize memory layout so attackers can't predict addresses.
- **Privilege escalation** — gaining rights you shouldn't have (vertical: user→root; horizontal: another user).
- **Sandboxing** — confining a process (seccomp, namespaces, chroot/jail, dropped capabilities) to limit damage.
- **Side channel** — leaking secrets via indirect signals (timing, cache state) — e.g. Spectre/Meltdown.
- **Rootkit** — malware that compromises the kernel to hide itself and gain total control.

**Why interviewers ask this**

OS security is where "I know the concepts" meets "I understand the mechanism," so it's a strong senior filter. Anyone can say "use strong passwords"; the signal is whether you can explain *why* running as root is dangerous (least privilege / blast radius), *how* a buffer overflow actually hijacks control flow and how **canaries + NX + ASLR** each defeat a different step of it, and the distinction between **authentication** and **authorization** (and DAC vs MAC). Interviewers also probe understanding of the **isolation boundary** — the syscall interface, dual-mode, and what Spectre/Meltdown broke — because it reveals whether you understand that the kernel must treat *all* user input and pointers as hostile. The best candidates frame security as defense-in-depth and blast-radius reduction, not a checklist.

**Common confusions**

- "Authentication and authorization are the same." No — authentication is *who you are*, authorization is *what you're allowed to do*. You can be authenticated and still denied.
- "Passwords are stored in the database." Properly, only **salted hashes** are stored; the plaintext should never be persisted.
- "ASLR/NX/canaries are one thing." They're three independent mitigations attacking different steps of an exploit; each can be bypassed alone, which is why they're layered.
- "NX stops all buffer overflows." No — NX stops *injected code* from running, but **ROP** reuses existing executable code to bypass it.
- "Running as root is fine if the code is trusted." Least privilege is about *blast radius when it's wrong* — a bug in root code compromises everything; the same bug in a confined process doesn't.
- "A container is a security boundary as strong as a VM." No — it shares the kernel; a kernel exploit escapes it (see Virtualization & Containers).

**What follows from this topic**

Security is the payoff of the whole primer: it rests on **dual-mode / kernel vs user mode** and **system calls** (the boundary), on **virtual memory** and the **MMU** (why one process can't read another's pages, and what ASLR randomizes), on **processes** (privilege, SUID, the confused deputy), and on **virtualization** (namespaces/seccomp as sandboxing, VM vs container isolation strength). It also connects to **boot** — secure boot and the chain of trust are how the OS defends its own integrity from the first instruction.

### Q1. What are the security goals of an operating system?

The classic **CIA** triad, applied to the OS as the enforcer:

- **Confidentiality** — a process (or user) can't read data it isn't authorized to: another process's memory, another user's files, kernel memory. Enforced by memory protection (MMU), file permissions, and the user/kernel boundary.
- **Integrity** — data and code can't be modified by unauthorized principals: you can't overwrite another process's memory, tamper with system files, or patch the running kernel. Enforced by access control and code signing / secure boot.
- **Availability** — authorized users can actually use the system; the OS must prevent one process from starving others of CPU, memory, or file descriptors (denial of service). Enforced by scheduling, quotas, and cgroup-style resource limits.

The OS is uniquely responsible for these because it's the one privileged component mediating every access to hardware and to other processes — it's the referee, so if it's compromised, none of the three hold.

### Q2. Authentication vs authorization — what's the difference?

- **Authentication** — establishing *who a principal is*. "Prove you're alice." Mechanisms: something you **know** (password), **have** (token, phone), or **are** (biometric); combined as **MFA**. The login process validates credentials and, on success, attaches an identity (uid) to the session.
- **Authorization** — deciding *what that identity is allowed to do*. "alice is authenticated — may she read `/etc/shadow`?" Enforced on every access via permissions, ACLs, or policy.

They're sequential and distinct: authentication happens once at login, authorization happens on every subsequent operation. You can be perfectly authenticated and still denied (you're definitely alice, but alice can't write to root's files). Confusing the two is a classic junior tell — "log in" is authentication; "access denied" is authorization.

### Q3. How does the OS authenticate users and store passwords safely?

The login flow: the user supplies a credential, the OS verifies it against stored data, and on success starts a session with that user's identity.

Passwords must **never** be stored in plaintext. Instead the OS stores a **salted hash**:

```text
stored = hash(salt + password), with the salt stored alongside
login:  hash(salt + entered) == stored ?
```

- **Hashing** — a one-way function; you can verify a guess but can't reverse the hash to the password. Use a *slow*, purpose-built function (bcrypt, scrypt, Argon2) so brute-forcing is expensive — not fast hashes like plain SHA-256.
- **Salt** — a unique random value per user, mixed in before hashing. It defeats precomputed **rainbow tables** and ensures two users with the same password get different hashes.

Beyond passwords: **MFA** (a second factor so a stolen password alone is useless), **biometrics**, and **tokens/keys** (SSH keys, hardware tokens). On Unix, hashes live in `/etc/shadow`, readable only by root.

### Q4. Explain DAC, MAC, and RBAC.

Three models for authorization:

| Model | Who sets policy | Example |
|---|---|---|
| **DAC** (discretionary) | The resource **owner** decides | Unix `rwx` permissions, ACLs — you `chmod` your own file |
| **MAC** (mandatory) | The **system** enforces labels; users can't override | SELinux, AppArmor — policy set by admin, applies even to root |
| **RBAC** (role-based) | Permissions attach to **roles**, users get roles | "admin", "auditor" roles; common in enterprise |

**DAC** is flexible but risky — if a user (or malware running as them) owns a file, it can loosen its permissions, so a compromised process can spread. **MAC** is stricter — even a compromised root process is constrained by system policy it can't change, which is why SELinux/AppArmor are used to contain services. **RBAC** scales administration: manage roles, not thousands of individual grants. Real systems combine them (Unix DAC + SELinux MAC layered on top).

### Q5. What's the difference between an access matrix, ACLs, and capabilities?

The **access matrix** is the conceptual model: a big table of *subjects* (users/processes) × *objects* (files/devices), each cell listing allowed operations. It's too large to store directly, so systems store it one of two ways — by column or by row:

- **ACL (Access Control List)** — store it **by object**: each object carries a list of "who can do what." Unix file permissions and Windows ACLs work this way. Easy to answer "who can access this file?"; harder to answer "what can this user access?" and to revoke a user everywhere.
- **Capability** — store it **by subject**: each process holds unforgeable **tokens** ("capabilities") naming objects it may access and how. Possessing the capability *is* the authorization. Easy delegation and least privilege; harder global revocation. Linux **capabilities** (`CAP_NET_BIND_SERVICE`, etc.) split root's powers into such tokens.

ACLs answer "who can touch X"; capabilities answer "what can P touch." They're transposes of the same matrix.

### Q6. What is the principle of least privilege, and why is running as root dangerous?

**Least privilege**: every user, process, and component should run with the **minimum rights needed** to do its job — nothing more. The point isn't distrust of the code; it's about the **blast radius when something goes wrong**.

Running as **root/admin** means a single bug or compromise gives the attacker *total* control — read any file, load kernel modules, disable logging, install a rootkit. The same bug in a process that dropped to an unprivileged user, in a container, or with dropped capabilities is contained: the attacker gets only what that confined context could do.

Concrete applications:
- Services run as dedicated low-privilege users (`www-data`), not root.
- **Privilege separation** — a program does the tiny privileged part (e.g. bind port 80) as root, then **drops privileges** for the rest.
- Grant a specific **capability** instead of full root.
- Use MAC (SELinux) to constrain even root.

Every one of these limits how much a mistake can cost.

### Q7. Walk me through a buffer overflow / stack smashing attack.

A **buffer overflow** happens when a program writes more data into a fixed-size buffer than it holds, spilling into adjacent memory. On the stack, that adjacent memory includes the **saved return address**.

```text
stack (grows down)          attacker input overflows buf...
┌───────────────────┐
│ saved return addr │  <-- overwrite this to hijack control flow
├───────────────────┤
│ saved frame ptr   │
├───────────────────┤
│ char buf[64]      │  <-- unbounded write (e.g. strcpy) starts here
└───────────────────┘
```

Classic exploit steps:
1. The program copies attacker-controlled input into `buf` with no bounds check (`strcpy`, `gets`).
2. The attacker supplies **more than 64 bytes**, overwriting the saved **return address**.
3. When the function returns, execution jumps to the attacker's chosen address — historically, to shellcode the attacker also placed on the stack.

Result: the attacker redirects the program's control flow and runs their own code with the program's privileges (catastrophic if it's a SUID-root or network service). This single bug class drove decades of OS/compiler defenses — canaries, NX, ASLR — covered next.

### Q8. How do stack canaries, DEP/NX, and ASLR each defend against overflows?

Three independent mitigations, each breaking a different step of the classic exploit:

- **Stack canary** — the compiler places a random guard value **between local buffers and the saved return address**. Before returning, it checks the canary; if an overflow overwrote the return address it also clobbered the canary, so the mismatch is detected and the program **aborts** instead of jumping. Defeats step 2 (silently overwriting the return address).
- **DEP / NX (Data Execution Prevention / No-eXecute)** — mark data pages (stack, heap) **non-executable** via the MMU. Even if the attacker gets their shellcode onto the stack and redirects to it, the CPU **refuses to execute** data as code. Defeats step 3 (running injected code).
- **ASLR (Address Space Layout Randomization)** — randomize the base addresses of the stack, heap, libraries, and executable each run, so the attacker **can't predict** where to jump or where their payload is. Defeats the assumption of known addresses.

Together they're **defense in depth**: canaries make hijacking the return address hard, NX makes injected code non-runnable, ASLR makes it hard to find anything to jump to. Each is bypassable alone (see next), which is exactly why they're layered.

### Q9. If NX stops injected code from running, how do attackers still exploit overflows?

They stop *injecting* code and start *reusing* it — **Return-Oriented Programming (ROP)**.

NX makes attacker-supplied data non-executable, but the program's own code (libc, the binary) is legitimately executable. In ROP, the attacker overwrites the stack with a chain of **return addresses** pointing at short existing instruction sequences ending in `ret` — called **gadgets**. Each gadget does a tiny operation (load a register, call a syscall) and returns to the next, so by chaining gadgets the attacker synthesizes arbitrary behavior **using only existing executable code** — no injected code, so NX never triggers.

This is the arms race: NX answered code injection, ROP answered NX, and **ASLR** answers ROP by hiding where the gadgets are — which is why attackers then chase **info leaks** to defeat ASLR, prompting finer-grained ASLR and control-flow integrity (CFI). The lesson for an interview: no single mitigation is sufficient; security is layered because every defense has a counter.

### Q10. What is privilege escalation, and what's the difference between vertical and horizontal?

**Privilege escalation** is gaining rights you're not supposed to have.

- **Vertical** — moving to a *higher* privilege level: user → root/admin, or user-space → kernel. Achieved by exploiting a bug in privileged code — a **setuid-root** binary, a kernel vulnerability reachable via a syscall, a service running as root. This is the dangerous one: it gives total control.
- **Horizontal** — moving *sideways* to another peer's privileges at the same level: accessing user bob's files or session while logged in as alice. No new privilege *level*, but a breach of isolation between equals.

Defenses tie back to earlier answers: **least privilege** shrinks how much a vertical escalation is worth, MAC (SELinux) constrains even root, and careful validation at the **syscall boundary** closes the kernel bugs that vertical escalation exploits. Interviewers like this because it forces you to connect "a bug in privileged code" to "why we run things unprivileged in the first place."

### Q11. Why are SUID/privileged binaries a security risk?

A **SUID** (set-user-ID) binary runs with the privileges of its **owner** (often root), not the user who launched it — that's how an ordinary user runs `passwd` to edit the root-owned `/etc/shadow`. Useful, but it's a deliberate, controlled **privilege boundary crossing**, which makes every SUID-root binary a prime attack target:

- If the binary has *any* exploitable bug (a buffer overflow, a command injection, an unsafe use of user-controlled input or environment variables), exploiting it yields **root** — it's a ready-made vertical privilege escalation.
- Its **entire input surface** — arguments, environment, files it opens — is attacker-controlled, so it must validate everything defensively.

Mitigations: minimize the number of SUID binaries, keep them tiny and audited, drop privileges as early as possible (privilege separation), and prefer **capabilities** (grant just `CAP_NET_BIND_SERVICE` instead of full SUID-root). Auditors routinely enumerate SUID binaries (`find / -perm -4000`) precisely because they're the classic escalation path.

### Q12. What sandboxing and confinement techniques does the OS provide?

Sandboxing limits the **blast radius** of a compromised process by restricting what it can do, even if it's fully taken over:

- **seccomp** — restrict which **syscalls** a process may make (e.g. allow read/write/exit, deny everything else). Since the syscall interface is the process's only door to the kernel, narrowing it dramatically shrinks the attack surface.
- **Namespaces** — give the process an isolated view (own pid/net/mount/user namespace) so it can't see or touch the rest of the system (the basis of containers).
- **Capabilities dropping** — remove privileges the process doesn't need (drop everything except the one capability it requires).
- **chroot / jails** — confine the process to a subtree of the filesystem so it can't reach files outside it (FreeBSD **jails** and Solaris **zones** are hardened versions).
- **MAC (SELinux/AppArmor)** — system policy caps what the process may do regardless of Unix permissions.

These compose: a hardened service might run as a non-root user, in a namespace, chrooted, with a seccomp filter and dropped capabilities under an AppArmor profile — so even a full compromise yields very little. This is defense-in-depth applied to a single process.

### Q13. Why is the syscall interface the critical security boundary?

The **syscall interface** is the *only* legitimate way user code enters the kernel — it's the single door in the wall between unprivileged user mode and all-powerful kernel mode. That makes it the boundary the kernel must defend absolutely:

- Every argument crossing it is **attacker-controlled**. A user-supplied **pointer** might point into kernel memory, be unmapped, or change between check and use (**TOCTOU**). The kernel must validate every pointer and copy user data carefully (`copy_from_user`), never trusting that user memory is valid or benign.
- A single missing check — an unvalidated length, an integer overflow in a size argument, a pointer used without verification — becomes a **vertical privilege escalation** (user → kernel), the most severe kind.

This is also why **seccomp** (restricting the set of reachable syscalls) is such a powerful sandbox: fewer reachable syscalls means less kernel code an attacker can reach and fewer bugs they can trigger. The whole security model rests on this boundary being un-bypassable (hardware dual-mode enforces it) and un-foolable (the kernel validates all input).

### Q14. Explain Spectre/Meltdown at a high level. Why were they a big deal?

They're **side-channel** attacks exploiting **speculative/out-of-order execution** — a hardware optimization — to leak data across isolation boundaries that software thought were airtight.

The core idea: modern CPUs *speculatively* execute instructions ahead of knowing whether they should (past a branch or a permission check). Speculation is rolled back architecturally if wrong — but it leaves a **microarchitectural trace in the cache**. An attacker speculatively accesses secret memory (e.g. kernel memory), then uses a **cache-timing** side channel to read out the secret bit by bit from which cache lines are now fast to access — even though the illegal access was never "really" performed.

- **Meltdown** — reads **kernel memory** from a user process by racing the permission check with speculation.
- **Spectre** — tricks another process (or the kernel) into speculatively leaking *its own* data across the isolation boundary.

They were a big deal because they broke isolation at the **hardware** level — the OS/MMU boundary that everything relies on — affecting nearly all CPUs and not fixable purely in software. Mitigations were costly: **KPTI (Kernel Page Table Isolation)** unmaps kernel memory from user page tables (adding TLB-flush overhead on every syscall), plus microcode updates and compiler barriers. The lesson: isolation guarantees are only as strong as the hardware underneath them.

### Q15. In one answer: how does the OS keep processes isolated and secure — ASLR/DEP/canaries, DAC vs MAC, privilege escalation?

**Isolation foundation** — hardware **dual-mode** (user vs kernel) plus the **MMU** mean a process physically can't read another's memory or the kernel's, and can only enter the kernel through the **syscall** gate, where the kernel validates every argument. That's the wall; everything else defends it.

**Access control** — two questions: **authentication** (who are you — salted-hash passwords, MFA) and **authorization** (what may you do). Authorization comes in flavors: **DAC** (owner sets permissions — Unix rwx), **MAC** (system-enforced labels even root can't override — SELinux), **RBAC** (permissions via roles). Governed by **least privilege** — run everything with the minimum rights so a compromise has a small blast radius.

**Memory-safety defenses** — against **buffer overflows** (overwriting a return address to hijack control flow), three layered mitigations: **stack canaries** (detect the overwrite), **DEP/NX** (injected code won't execute), **ASLR** (attacker can't predict addresses). Layered because each is individually bypassable (ROP beats NX, info leaks beat ASLR).

**Escalation & containment** — **privilege escalation** is gaining rights you shouldn't (vertical user→root via a kernel/SUID bug; horizontal to a peer). Contain the fallout with **sandboxing**: seccomp (restrict syscalls), namespaces/chroot, dropped capabilities. And the boundary itself can be attacked below the OS — **Spectre/Meltdown** leak across it via speculative-execution side channels — while **secure boot** and code signing defend the kernel's own integrity from bootkits and rootkits. Security is defense-in-depth: keep the boundary intact, and shrink the blast radius when it isn't.

## Boot Process & Initialization

### Summary

**What this topic covers**

The full journey from pressing the power button to a login prompt — one of the best "walk me through what happens when…" interview questions because it threads through firmware, storage, the kernel, and user-space in strict order. The 15 questions here cover the sequence stage by stage: (1) **power-on → firmware** (BIOS or UEFI running POST and finding a boot device), (2) **BIOS vs UEFI** (MBR/512-byte-sector legacy vs EFI System Partition, GPT, and Secure Boot), (3) **the bootloader** (GRUB and its job: load the kernel + **initramfs** into memory and jump to it), (4) **kernel initialization** (decompress, set up paging and the scheduler, initialize drivers, mount the real root filesystem), and (5) **the first user-space process, init / PID 1** (systemd vs SysV init vs launchd starting every service). It also covers the **Secure Boot chain of trust**, why an **initramfs** is needed at all (the chicken-and-egg driver problem), runlevels vs systemd targets, and why **PID 1** is special.

**Mental model**

Think of boot as a **relay race of trust and capability**, where each stage does just enough to load and hand control to the next, more capable one. At power-on the CPU can execute almost nothing — it starts at a fixed address in **firmware** (BIOS/UEFI), which knows how to talk to basic hardware and read a boot device. Firmware loads a small **bootloader**, whose only real job is to find and load the **kernel** (and a temporary root filesystem, the **initramfs**) into RAM and jump to it. The **kernel** then builds the full machine abstraction — memory management, scheduler, drivers — enough to mount the *real* root filesystem. Finally it starts **PID 1 (init)**, the ancestor of all user-space, which brings up services, networking, and the login prompt. Two threads run through it: **increasing capability** (each stage can do more than the last) and, on modern systems, a **chain of trust** (each stage cryptographically verifies the next). Understanding boot is understanding that a running system is bootstrapped, not born whole.

**Key terms**

- **Firmware (BIOS/UEFI)** — code the CPU runs first, at a fixed address; initializes hardware and finds a boot device.
- **POST** — Power-On Self-Test; firmware checks RAM, CPU, and devices before booting.
- **BIOS** — legacy 16-bit firmware; boots from the 512-byte **MBR** on the first sector.
- **UEFI** — modern firmware; boots EFI executables from an **EFI System Partition**, supports **GPT**, disks >2 TB, and Secure Boot.
- **MBR (Master Boot Record)** — first 512-byte sector holding stage-1 bootloader + partition table (legacy).
- **ESP (EFI System Partition)** — a FAT partition holding UEFI bootloader executables.
- **Bootloader (GRUB)** — loads the kernel + initramfs into memory and transfers control; may show a menu / multiboot.
- **Kernel** — the OS core; initializes memory, scheduler, drivers, then mounts the root filesystem.
- **initramfs / initrd** — a temporary root filesystem in RAM containing drivers needed to reach the real root.
- **init / PID 1** — the first user-space process; ancestor of all others (systemd, SysV init, launchd).
- **systemd target / runlevel** — the named system state to reach (multi-user, graphical) and the services it implies.
- **Secure Boot** — firmware verifies each stage's signature to prevent bootkits (part of a chain of trust).

**Why interviewers ask this**

"What happens when you power on a computer (or type a URL, or run a program)?" is a canonical systems question because it rewards *ordered, mechanistic* understanding rather than memorized facts. A junior answer is "it turns on and Windows/Linux loads." A senior answer names the stages in order and explains *why* each exists: why firmware is at a fixed address, why there's a separate bootloader, why an **initramfs** is needed (the chicken-and-egg problem of needing a driver to read the disk that holds the driver), what changes between **BIOS and UEFI**, what **PID 1** is and why the system panics if it dies. It also surfaces security awareness (the Secure Boot chain of trust) and connects to the rest of the OS — paging, scheduler, drivers, and processes all get initialized here. It's a great integrative closer because it touches every earlier topic.

**Common confusions**

- "BIOS and UEFI are the same, just newer." UEFI is a full replacement with a different boot mechanism (ESP + EFI apps + GPT + Secure Boot), not just a reskin of BIOS.
- "The bootloader runs the OS." The bootloader only **loads** the kernel into memory and jumps to it; the kernel runs the OS.
- "The initramfs is the real root filesystem." It's a *temporary* one in RAM used only to get the drivers needed to mount the real root, then pivoted away from.
- "PID 1 is just another process." It's special — it's the ancestor of all user-space, it **reaps orphaned** children, and if it dies the **kernel panics**.
- "systemd and the kernel are the same thing." systemd is the **first user-space** process the kernel starts; it's not part of the kernel.
- "Secure Boot encrypts the disk." No — Secure Boot **verifies signatures** of boot components (integrity/authenticity); disk **encryption** (confidentiality) is separate.

**What follows from this topic**

Boot is where every other topic gets switched on. Kernel initialization sets up the **virtual memory / paging** and **scheduler** you studied earlier, probes and loads the **device drivers** and **file systems**, and the mounting of the real root ties to the **file systems** and **I/O** topics. Starting **PID 1** connects straight to the **process** model (fork/exec, orphans and zombies, why init reaps them). The Secure Boot chain of trust links to **OS Security** (code signing, kernel integrity, defending against rootkits). And a VM or container "boots" via variations of this same path — a VM runs the whole sequence on virtual hardware, while a container skips it entirely by reusing the host's already-booted kernel (see Virtualization & Containers).

### Q1. Walk me through what happens from power-on to a login prompt.

The canonical five stages, each loading and handing off to the next:

```text
power on
   │
   ▼
1. FIRMWARE (BIOS/UEFI): CPU starts at a fixed address → POST
   (self-test), initialize hardware, find a boot device
   │
   ▼
2. BOOTLOADER (GRUB): loaded by firmware; locate & load the
   KERNEL + initramfs into RAM, then jump to the kernel
   │
   ▼
3. KERNEL INIT: decompress, set up memory management/paging,
   start the scheduler, initialize drivers, mount initramfs,
   then pivot to the real ROOT FILESYSTEM
   │
   ▼
4. INIT (PID 1): kernel starts the first user-space process
   (systemd / SysV init / launchd)
   │
   ▼
5. SERVICES: init starts daemons, brings up networking, reaches
   the default target/runlevel, launches the login / display manager
   │
   ▼
login prompt
```

The theme: at each step the running code can do a little more than the previous one, and its job is mainly to load and transfer control to the next stage. Firmware can barely read a disk; the kernel can run a whole OS.

### Q2. What does the firmware (BIOS/UEFI) do, and why does the CPU start there?

When power is applied, the CPU begins executing at a **fixed, hardwired address** — it has no OS, no drivers, nothing loaded in RAM, so it *must* start from code at a known location: the **firmware** (BIOS or UEFI), stored in non-volatile flash on the motherboard.

The firmware's job:
1. **POST (Power-On Self-Test)** — check that essential hardware (CPU, RAM, basic devices) is present and working.
2. **Initialize hardware** — bring up the memory controller, buses, and enough of the platform to be usable.
3. **Find a boot device** — search configured devices (disk, USB, network) in order for something bootable.
4. **Load and hand off** — read the first-stage bootloader (from the MBR on BIOS, or an EFI app on the ESP on UEFI) into memory and transfer control to it.

The CPU starts in firmware because it's the only code guaranteed to be present and addressable at power-on — everything else has to be loaded *by* it. This is the first link in the boot relay.

### Q3. BIOS vs UEFI — what's the difference?

| | BIOS (legacy) | UEFI (modern) |
|---|---|---|
| Age / mode | Decades old, 16-bit real mode | Modern replacement, 32/64-bit |
| Boots from | 512-byte **MBR** on first sector | EFI executables on the **ESP** |
| Partitioning | MBR (max 4 primary partitions, ≤2 TB disks) | **GPT** (many partitions, >2 TB disks) |
| Boot logic | Runs raw code from sector 0 | A boot manager runs EFI apps by name |
| Security | None | **Secure Boot** (signature verification) |
| Speed / features | Slower, minimal | Faster init, richer pre-boot environment |

**BIOS** reads the **Master Boot Record** — the first 512-byte sector — which contains a tiny stage-1 bootloader plus the partition table, and runs it. That 512-byte constraint is why BIOS needs a multi-stage bootloader.

**UEFI** is a small operating environment in its own right: it understands a FAT filesystem (the **EFI System Partition**), reads **EFI executable** bootloaders as files, supports **GPT** for large disks and many partitions, boots faster, and adds **Secure Boot**. Modern systems are UEFI; BIOS survives mostly as a compatibility mode.

### Q4. What is the MBR, and why did BIOS need a multi-stage bootloader?

The **MBR (Master Boot Record)** is the very first **512-byte sector** of a BIOS boot disk. It packs three things into those 512 bytes: a tiny **stage-1 bootloader** (~446 bytes of code), the **partition table** (4 entries × 16 bytes), and a 2-byte boot signature.

446 bytes is nowhere near enough code to understand a filesystem, show a menu, or load a Linux kernel. So BIOS boot is **multi-stage**:

- **Stage 1** (in the MBR) — barely enough code to locate and load stage 2.
- **Stage 2** (e.g. GRUB's core, stored elsewhere on disk) — the real bootloader: it understands filesystems, reads config, shows a menu, and loads the kernel + initramfs.

This staging exists purely because of the 512-byte MBR limit. UEFI removes the constraint — bootloaders are just **EFI executable files** on the FAT-formatted ESP, so there's no cramped first-sector stage and the whole multi-stage dance largely disappears.

### Q5. What is the bootloader's job? What does GRUB do?

The bootloader's single core job: **locate the OS kernel, load it (plus the initramfs) into memory, and jump to it.** It's the bridge between firmware (which can barely read a disk) and the kernel (which runs the OS).

**GRUB** (GRand Unified Bootloader), the common Linux bootloader:
- Understands **filesystems**, so it can read the kernel and config from an ordinary partition (unlike raw firmware).
- Shows a **boot menu** — pick a kernel version, an OS (**multiboot** / dual-boot), or recovery mode.
- Reads its config to find the **kernel image** and matching **initramfs**.
- Loads both into memory, passes the kernel its **command-line parameters** (e.g. which partition is root), and transfers control to the kernel's entry point.

On BIOS, GRUB is that multi-stage MBR loader; on UEFI, GRUB (or `systemd-boot`, or the kernel's own EFI stub) is an **EFI application** the firmware launches from the ESP. Either way, once GRUB jumps to the kernel, its work is done.

### Q6. What is an initramfs/initrd, and why is it needed?

The **initramfs** (or older **initrd**) is a small, temporary **root filesystem loaded into RAM** by the bootloader alongside the kernel. It contains just enough — drivers, kernel modules, and a minimal init script — to get the system far enough to mount the **real** root filesystem.

It exists to solve a **chicken-and-egg problem**:

> To read the real root filesystem, the kernel needs the right driver (for the disk controller, RAID, LVM, encryption, or the filesystem type). But that driver lives *on* the root filesystem the kernel can't read yet.

The initramfs breaks the cycle: the bootloader loads it into RAM (no disk driver needed — it's already in memory), the kernel mounts it as a temporary root, runs its init to **load the drivers** needed for the real root, then **pivots** to the actual root filesystem and continues booting.

This keeps the kernel itself small and generic — instead of compiling every possible disk/filesystem driver into the kernel, distributions ship a lean kernel plus an initramfs tailored to the machine's hardware.

### Q7. What happens during kernel initialization?

Once the bootloader jumps to the kernel, the kernel builds the full machine abstraction from almost nothing:

1. **Decompress** itself (kernels ship compressed) and set up the initial execution environment.
2. **Set up memory management** — initialize paging, build the kernel's page tables, switch on the MMU, and set up the physical/virtual memory maps.
3. **Initialize core subsystems** — start the **scheduler**, set up interrupt handling (the IDT/interrupt vectors), timers, and per-CPU state.
4. **Detect and initialize devices/drivers** — probe hardware, load the drivers compiled in or provided by the initramfs.
5. **Mount the initramfs** as a temporary root and run its init to load whatever's needed for the real root.
6. **Pivot to the real root filesystem** — mount it and free the initramfs.
7. **Start PID 1** — the kernel creates the first user-space process (init) and hands off; from here the system is driven from user space.

By the end, all the mechanisms from earlier topics — paging, scheduling, drivers, the VFS — are live. The kernel's last boot act is to `exec` init.

### Q8. What is init / PID 1, and why is it special?

**init** is the **first user-space process** the kernel starts, and it always has **PID 1**. It's special for several reasons:

- **Ancestor of all user-space** — every other process descends from PID 1 (via fork/exec). The kernel starts nothing else in user space directly.
- **Bootstraps the system** — it starts all services/daemons, brings up networking, and reaches the configured default state (target/runlevel), ultimately launching the login prompt or display manager.
- **Reaps orphans** — when a process's parent dies, the orphan is **reparented to PID 1**, whose duty is to `wait()` on such children so they don't linger as **zombies**. (Ties directly to the process-model topic.)
- **If it dies, the system panics** — because it's the root of everything and the reaper of last resort, the kernel **panics** if PID 1 exits. It must run for the entire uptime of the system.

Implementations: **systemd** (modern Linux), **SysV init** (traditional), **launchd** (macOS). It's the handoff point from kernel to a running, usable system.

### Q9. systemd vs SysV init — what changed?

Both are **PID 1** implementations that bring up the system, but they differ in model:

| | SysV init (traditional) | systemd (modern) |
|---|---|---|
| Startup | **Sequential** — run scripts in order | **Parallel** — start independent services concurrently |
| Config unit | Shell scripts in `/etc/init.d`, **runlevels** | Declarative **unit** files, **targets** |
| Dependencies | Implicit, via numbered ordering | Explicit dependency graph; socket/D-Bus activation |
| Speed | Slower (serial) | Faster (parallel, lazy activation) |
| Scope | Just starts services | Service manager: logging (journald), cgroups, timers, mounts |

**SysV init** runs numbered shell scripts sequentially for a given **runlevel** — simple but slow and serial. **systemd** models everything as **units** (services, sockets, mounts, timers) with an explicit dependency graph, so it starts independent services in **parallel** and can lazily activate a service on first socket connection. It boots faster and centralizes service supervision (restart-on-failure, resource control via cgroups, unified logging). It was controversial for absorbing so many responsibilities into PID 1, but it's now the default across most Linux distributions.

### Q10. Runlevels vs systemd targets — what's the relationship?

Both express **"what state should the system be in — which set of services should be running?"**

**Runlevels** (SysV) are numbered system states:
- 0 = halt, 1 = single-user (maintenance), 3 = multi-user + networking (no GUI), 5 = multi-user + graphical, 6 = reboot.

You switch runlevel and init starts/stops the scripts associated with it.

**systemd targets** are the modern equivalent — named units that group services and can depend on each other. The common mappings:
- `poweroff.target` ↔ 0, `rescue.target` ↔ 1, `multi-user.target` ↔ 3, `graphical.target` ↔ 5, `reboot.target` ↔ 6.

The differences: targets have **descriptive names** instead of numbers, and they're **composable** — `graphical.target` pulls in `multi-user.target` which pulls in `basic.target`, forming a dependency chain rather than a flat number. The **default target** (what the system boots into) replaces the old default runlevel. Same concept — "reach this operational state" — with a graph instead of a ladder.

### Q11. What is Secure Boot and the chain of trust?

**Secure Boot** is a UEFI feature that ensures **only cryptographically signed, trusted code runs at each boot stage**, forming a **chain of trust** from power-on upward:

```text
firmware  --verifies-->  bootloader  --verifies-->  kernel  --verifies-->  modules/drivers
(trusted keys      (signature checked   (signature      (signed modules)
 in firmware)       before running)      checked)
```

Each stage checks the **digital signature** of the next stage against trusted keys **before** transferring control. If any component is unsigned or tampered with, boot is refused.

The threat it defends against is **bootkits/rootkits** — malware that infects the bootloader or kernel *before* the OS and its security tools even load, making it nearly invisible and giving it total control. Because it runs first, ordinary OS defenses can't catch it — so the defense has to start at the firmware.

Related: **Measured Boot / TPM** — instead of (or in addition to) refusing to boot, each stage records a hash ("measurement") of the next into a **TPM** chip, producing a tamper-evident log you can later verify (used for remote attestation and to unlock disk encryption only if the boot chain is unmodified). Note Secure Boot is about **integrity/authenticity**, distinct from disk **encryption** (confidentiality).

### Q12. Why do BIOS and UEFI boot differently — summarize the two paths.

Same goal (get the kernel running), two mechanisms:

**BIOS path:**
```text
power on → BIOS → POST → read 512-byte MBR from disk sector 0
        → MBR stage-1 loads stage-2 (GRUB core)
        → GRUB reads kernel + initramfs from the filesystem, jumps to kernel
```

**UEFI path:**
```text
power on → UEFI → POST → read the EFI System Partition (FAT)
        → boot manager launches a bootloader EFI executable (e.g. grubx64.efi)
          [Secure Boot verifies its signature first]
        → bootloader loads kernel + initramfs, jumps to kernel
```

The key differences: BIOS runs **raw code from a fixed 512-byte sector** and needs multi-stage loading to overcome that limit; UEFI treats bootloaders as **named EFI files on a real (FAT) partition**, understands **GPT** for large disks, can verify signatures via **Secure Boot**, and provides a proper **boot manager** to choose among installed OSes. From the kernel's perspective onward (stages 3–5), the two paths converge — kernel init and PID 1 are the same.

### Q13. What are kernel parameters / the kernel command line?

The **kernel command line** is a string of parameters the **bootloader passes to the kernel** at handoff, configuring how the kernel initializes — before any config file on disk is even readable. GRUB stores it (e.g. in `linux ... root=/dev/sda2 ro quiet`), and you can edit it at the boot menu for one-off changes.

Common uses:
- **`root=`** — tell the kernel which device/partition holds the real root filesystem to pivot to after the initramfs.
- **`ro` / `rw`** — mount root read-only initially (fsck-safe) or read-write.
- **`quiet` / `splash`** — control boot verbosity.
- **`single` / `init=/bin/bash`** — boot to single-user/maintenance mode or a specific init, useful for recovery (e.g. resetting a forgotten password).
- Hardware/debug flags — disable a feature, set memory limits, enable a driver option.

It matters because it's the earliest configuration channel — the kernel needs to know things (like where root is) *before* it can read any files. In recovery scenarios (like the classic "reset root password" interview aside), editing the command line to boot a shell as init is the standard trick.

### Q14. In a VM or a container, does this whole boot sequence still happen?

- **VM** — **yes, the full sequence runs**, just on **virtual** hardware. The hypervisor presents virtual firmware (a virtual BIOS/UEFI), a virtual disk with an MBR/ESP, etc., and the guest runs POST → bootloader → **its own kernel** initialization → its own PID 1. That's exactly why a VM takes **seconds** to boot — it's doing the real thing end-to-end. It also has its own kernel, which is what makes VM isolation strong.
- **Container** — **no, almost none of it happens.** A container **shares the host's already-booted kernel**, so there's no firmware, no bootloader, no kernel initialization, and no separate init doing hardware bring-up. The container runtime just sets up namespaces and cgroups and `exec`s the container's first process (which *becomes* PID 1 *inside* the container's pid namespace). That's why a container starts in **milliseconds** — it skips the entire power-on-to-kernel pipeline.

This contrast is a clean way to tie the boot topic to Virtualization & Containers: the difference between "boots a kernel" (VM) and "reuses the host kernel" (container) is exactly the presence or absence of this whole sequence.

### Q15. In one answer: what happens when you power on a computer — BIOS vs UEFI, the bootloader, PID 1?

**Power-on → firmware.** The CPU starts executing **firmware** at a fixed address (it's the only code guaranteed present). Firmware runs **POST**, initializes hardware, and finds a boot device.

**BIOS vs UEFI.** **BIOS** (legacy) reads a 512-byte **MBR** from sector 0 and runs raw code, needing multi-stage loading; **UEFI** (modern) reads **EFI executables** from the **EFI System Partition**, supports **GPT** and disks >2 TB, boots faster, and adds **Secure Boot** (signature verification forming a chain of trust firmware → bootloader → kernel).

**Bootloader.** Firmware loads the **bootloader** (**GRUB**), whose job is to **locate and load the kernel + an initramfs into RAM and jump to the kernel**. The **initramfs** is a temporary in-RAM root filesystem holding the drivers needed to mount the *real* root — solving the chicken-and-egg problem of needing a driver to read the disk that holds the driver.

**Kernel init.** The kernel decompresses, sets up **paging** and the **scheduler**, initializes **drivers**, mounts the initramfs, then pivots to the **real root filesystem**.

**PID 1.** The kernel starts the first user-space process, **init (PID 1)** — **systemd** (modern, parallel, unit/target-based), SysV init, or launchd. It starts services, brings up networking, reaches the default target/runlevel, and launches the login prompt. **PID 1 is special**: it's the ancestor of all processes, it **reaps orphans**, and if it dies the **kernel panics**. That's the full relay from a dead machine to a login prompt.
## Performance & Observability

### Summary

**What this topic covers**

How to reason about *why* a system is slow and how to *find out*, from CS-fundamentals first principles — not a tuning cookbook. Three concern areas: (1) the **cost model** — order-of-magnitude latency intuition (register/cache → RAM → SSD → HDD → network) and the price of the OS mechanisms you invoke (a context switch, a system call, a page fault); (2) the **method** — the USE method (Utilization, Saturation, Errors) applied across the four resources (CPU, memory, disk, network) to localize a bottleneck, plus classifying a workload as CPU-bound / memory-bound / I/O-bound / lock-bound; and (3) the **instruments** — what `top`, `vmstat`, `iostat`, `perf`, `strace`, and modern **eBPF** actually measure, what load average and iowait really count, and how to read a flame graph. The 15 questions here turn the mechanisms from earlier topics (scheduling, paging, syscalls) into observable, measurable quantities — and teach you to *measure before you optimize*.

**Mental model**

Every operation has a price, and the prices span ~9 orders of magnitude. A CPU instruction hitting L1 is ~1ns; main memory is ~100ns (a 100x cliff); an SSD read is microseconds; an HDD seek is ~10ms (10 million ns); a cross-continent round trip is ~150ms. When a system is "slow," you are almost always paying one of these prices more often than you think — a major page fault turned a 1ns memory access into a 10ms disk read, or a lock forced a 100ns operation into a 10µs context switch and reschedule. So performance analysis is a hunt: *which resource is the bottleneck, and which expensive event is being triggered too often?* Don't guess — the intuitive culprit (CPU) is frequently idle while the machine waits on disk (iowait) or blocks on a lock. Start from the workload (what is it trying to do), measure utilization and saturation of each resource with a systematic method, find the one that's pegged or queuing, then drill down with a profiler or tracer to the specific code path or syscall. Optimize that; re-measure. Amdahl's law caps the payoff, so optimize the biggest slice.

**Key terms**

- **Latency numbers** — the order-of-magnitude table every engineer memorizes: L1 ~1ns, RAM ~100ns, SSD read ~16µs, HDD seek ~10ms, network RTT ~0.5ms (LAN) to ~150ms (global).
- **Context-switch cost** — direct (save/restore registers, switch page tables) + indirect (TLB flush, cold caches after) — roughly 1–10µs of pure overhead per switch.
- **System-call cost** — the user↔kernel mode-switch plus cache/pipeline effects; hundreds of ns to ~1µs, which is why batching (io_uring), vDSO, and buffering matter.
- **Page fault** — **minor** (page in memory, just not mapped — cheap) vs **major** (must read from disk — a huge multi-ms stall).
- **USE method** — for every resource check **U**tilization, **S**aturation (queue depth/wait), **E**rrors; find the saturated one.
- **Load average** — the count of tasks **runnable + in uninterruptible sleep (D-state)**, averaged over 1/5/15 min — NOT pure CPU demand.
- **iowait** — CPU time idle *because* it's waiting on outstanding disk I/O; high iowait = I/O-bound.
- **RSS vs VSZ** — resident set (physical RAM actually used) vs virtual size (address space reserved).
- **eBPF** — safe, JIT'd programs run in the kernel for low-overhead custom tracing (bcc, bpftrace) — the modern observability revolution.
- **Flame graph** — a visualization of sampled stacks; width = time spent; the wide plateau is the hot path.
- **Tail latency (p99/p99.9)** — the slow requests; caused by GC pauses, major faults, lock contention, context switches, noisy neighbors.
- **Amdahl's law** — speedup is capped by the serial fraction; parallelism has diminishing returns.

**Why interviewers ask this**

Performance separates people who can *build* a system from people who can *operate* one under load. The junior tell is guessing — "it's slow, let me add caching / more threads" without measuring. The senior signal is method: "I'd characterize the workload, run the USE method to find which resource is saturated, and only then drill in." Interviewers especially probe two reflexes: the **latency-number intuition** (do you know a disk seek is ~10⁷x a cache hit, so a chatty disk pattern is the first suspect?) and the **"high load but idle CPU"** puzzle (do you know load average counts D-state tasks, so the answer is iowait or blocked threads, not CPU?). Getting those right shows you reason from mechanisms to metrics. It also reveals whether you know the modern toolset (perf, eBPF) or are stuck on `top`.

**Common confusions**

- "High load average means the CPU is maxed" — no; load counts runnable **and** uninterruptible-sleep tasks, so high load with idle CPU means I/O wait or blocked/D-state threads.
- "CPU at 100% means CPU-bound" — check the breakdown: if it's mostly `sys` or `iowait`, the real cost is syscalls or disk, not your computation.
- "More threads = faster" — past the core count (for CPU-bound work) more threads add context-switch and lock-contention overhead and *slow it down*.
- "A page fault is cheap" — a *minor* fault is; a *major* fault is a disk I/O and one of the most expensive things a running program can hit.
- "Average latency is fine" — averages hide the tail; p99 is what users feel, and it has different causes than the mean.
- "Memory used is bad" — Linux uses free RAM as page cache; "used" including cache is healthy — watch swap activity and major faults instead.

**What follows from this topic**

This is where CPU Scheduling, Virtual Memory & Paging, System Calls, and Synchronization become *measurable*. The context-switch and syscall costs here explain why the scheduling and threading tradeoffs in those topics matter in practice; the page-fault cost explains thrashing; lock contention ties to the deadlock/synchronization topic. It also sets up **Real-World Kernels** (the /proc, perf, and eBPF interfaces are Linux-specific) and the **Scenario & Interview Playbooks** capstone, where "why is my system slow?" is answered end-to-end with the USE method.

### Q1. What are the "latency numbers every engineer should know," and why do they matter?

They're an order-of-magnitude table so you can reason about cost without measuring:

```text
L1 cache reference            ~1 ns
Branch mispredict             ~3 ns
L2 cache reference            ~4 ns
Mutex lock/unlock             ~15 ns
Main memory (RAM) reference   ~100 ns      <-- the big cliff
Context switch                ~1-10 us
SSD random read               ~16 us
Read 1 MB sequential from RAM ~3 us
Read 1 MB from SSD            ~50 us
Round trip within datacenter  ~500 us (0.5 ms)
HDD seek                      ~10 ms       <-- 10,000,000x an L1 hit
Read 1 MB from HDD            ~20 ms
Packet CA -> Netherlands -> CA ~150 ms
```

Why it matters: they let you sanity-check a design in your head. "This request does 100 random disk reads" — at 10ms each that's 1 second, obviously too slow, so batch or cache. "This is memory-bound at 100ns/access over a 1GB array" — that's ~10ms of RAM latency you can't wish away. The single most useful fact is the **RAM cliff** (~100x slower than cache) and the **disk cliff** (~10⁵x slower than RAM): whenever something drops off cache or out of RAM, you pay orders of magnitude. Performance work is largely about keeping the hot data in the fast tiers.

### Q2. What does a context switch actually cost, and why does excessive switching tank throughput?

A context switch has **direct** and **indirect** costs.

**Direct** (the visible part): save the outgoing task's registers, PC, and stack pointer to its kernel stack / PCB; if switching to a different process, load the new page-table base (e.g. write CR3 on x86), which on older CPUs **flushes the TLB**; restore the incoming task's registers; return to user mode. This is ~1µs.

**Indirect** (the expensive part): after the switch, the CPU caches (L1/L2, TLB, branch predictors) are full of the *old* task's data. The new task runs with **cold caches** and suffers a burst of cache and TLB misses until it warms back up. This pollution can cost far more than the direct save/restore — several µs of effective stall.

```text
   [Task A running, caches hot for A]
        | timer/IRQ or block on lock
        v
   save A regs -> load B page table (TLB flush) -> restore B regs   (direct)
        v
   [Task B runs with COLD caches: TLB misses, L1/L2 misses]         (indirect)
```

So if you have far more runnable threads than cores, or heavy lock contention forcing threads to block and wake repeatedly, the CPU spends its time switching and re-warming caches instead of doing work. Throughput collapses even though the CPU looks "busy." The fix is fewer runnable threads (size pools to cores for CPU-bound work), less contention (finer locks / lock-free), and batching.

### Q3. What does a system call cost, and how do vDSO / io_uring reduce it?

A syscall is a controlled **mode switch** from user to kernel: a trap instruction (`syscall` on x86-64), the CPU raises privilege, jumps to the kernel entry, the kernel validates args, does the work, and returns — dropping privilege. The mode switch itself plus the pipeline/cache disruption costs hundreds of ns to ~1µs. That's cheap next to a disk seek but ruinous if you do millions of them (e.g. `read()` one byte at a time).

Three mitigations:
- **Buffering / batching**: read 64KB per syscall instead of 1 byte; buffered I/O in libc does this for you. Fewer crossings.
- **vDSO** (virtual dynamic shared object): the kernel maps a page of read-only data + code into every process so calls like `gettimeofday()`/`clock_gettime()` execute **in user space** with no trap at all.
- **io_uring**: submission/completion ring buffers shared between user space and kernel let you queue many I/O operations and reap results with *few or zero* syscalls — amortizing the crossing cost across thousands of operations. This is why high-performance servers moved from `epoll`+`read`/`write` to io_uring.

### Q4. Minor vs major page fault — what's the cost difference, and how do you measure the fault rate?

A **page fault** is a trap the MMU raises when a virtual page has no valid mapping. Two kinds:

- **Minor (soft) fault**: the page is already in physical RAM but not mapped in *this* process's page table yet — e.g. it's in the page cache, or a copy-on-write page, or a freshly demand-zeroed page. The kernel just fixes the page-table entry. Cost: ~1µs, no disk.
- **Major (hard) fault**: the page is **not** in RAM and must be read from disk (from the file or from swap). The faulting thread **blocks** on disk I/O — ~10ms on HDD, ~tens of µs on SSD. This is the killer: one major fault can stall a thread longer than millions of instructions.

Measure it: `ps -o min_flt,maj_flt -p <pid>`, or `/proc/<pid>/stat` fields, or `vmstat` (the `si`/`so` swap-in/out columns show swap-driven major faults), or `perf stat -e minor-faults,major-faults`. A rising **major** fault rate under steady load means you're short on RAM and paging from disk — likely **thrashing**. Minor faults are normal and mostly harmless.

### Q5. Explain the USE method for finding a bottleneck.

USE (Brendan Gregg) is a systematic checklist: for **every resource**, check three things.

- **U — Utilization**: the fraction of time the resource was busy (CPU %, disk %util, memory used, NIC bandwidth used).
- **S — Saturation**: the degree of queued/unserviced work (run-queue length, disk I/O queue depth, swap activity, TCP backlog). Saturation is often the *real* signal — a resource can be 100% utilized and fine, but saturation means work is *waiting*.
- **E — Errors**: error counts (disk errors, dropped packets, ECC errors, failed allocations).

Apply it across the four resources:

| Resource | Utilization | Saturation | Errors |
|---|---|---|---|
| CPU | `top` %busy | run-queue len (load avg, `vmstat r`) | (rare) |
| Memory | used vs total | swap in/out, major faults | OOM kills |
| Disk | `iostat %util` | `iostat aqu-sz`, iowait | I/O errors |
| Network | bandwidth used | retransmits, drops, backlog | NIC errors |

You sweep the table, find the resource that's saturated or erroring, and *that's* your bottleneck. It stops you from tunnel-visioning on CPU when the disk queue is 50 deep. Once localized, drill in with a profiler (CPU) or tracer (I/O) to the exact code/path.

### Q6. What does load average actually count, and why can load be high while the CPU is idle?

Load average is the exponentially-weighted moving average (over 1, 5, 15 minutes) of the number of tasks that are **runnable OR in uninterruptible sleep (D-state)**. On Linux it is specifically *not* just CPU demand:

- **Runnable** tasks want CPU (either running or waiting in the run queue).
- **Uninterruptible-sleep (D-state)** tasks are blocked in the kernel on something that can't be interrupted — almost always **disk I/O** (or sometimes NFS, a lock).

So a load of 20 on a 4-core box could mean:
- 20 CPU-hungry threads fighting over 4 cores (CPU-bound, run queue backed up), **or**
- 4 threads computing + 16 threads stuck waiting on a slow disk (I/O-bound), with the **CPU nearly idle**.

That's why "high load, idle CPU" is the classic diagnostic: it means the load is dominated by **D-state / iowait**, not computation. You confirm with `top`/`vmstat` (look at the `wa` iowait column and the `b`/blocked count) and `ps` for D-state processes. Compare load to core count: load ≈ cores is fully-utilized; load ≫ cores *with* high CPU% is CPU-saturated; load ≫ cores with *low* CPU% is I/O-bound.

### Q7. Break down CPU utilization — what do user, system, iowait, steal, and idle mean?

`top`/`mpstat` splits CPU time into buckets; each spike tells a different story:

- **user (`us`)**: running application code in user mode. High = your computation is the cost (CPU-bound). Profile the app.
- **system/kernel (`sy`)**: running kernel code on the app's behalf — syscalls, network stack, page management. High `sy` = too many/expensive syscalls, heavy context switching, or lock contention in the kernel.
- **iowait (`wa`)**: CPU **idle** but there's outstanding disk I/O it could run if the data arrived. High = I/O-bound; the disk, not the CPU, is the limit. (Note: iowait is still idle time — the CPU *could* do other work.)
- **steal (`st`)**: (in VMs) time the hypervisor gave your vCPU's slot to *another* tenant. High steal = noisy neighbor / oversubscribed host; a cloud problem, not yours.
- **idle (`id`)**: doing nothing, no pending I/O.
- (also **nice**, **irq**, **softirq** — time in reprioritized tasks and interrupt handling.)

The diagnostic move: if you're "slow" but idle is high and iowait is high → disk-bound. If `sy` is high → syscall/kernel overhead. If `us` is pegged → genuinely compute-bound, go profile. High `st` in the cloud → your host is oversubscribed.

### Q8. What memory metrics matter, and how do you spot thrashing?

Key distinctions:
- **RSS (resident set size)**: physical RAM the process actually occupies right now.
- **VSZ / virtual size**: total address space reserved (includes unmapped/lazy regions and shared libs) — usually much bigger than RSS and not directly a memory-pressure signal.
- **Page cache**: free RAM Linux uses to cache file data. It shows as "used" but is reclaimable — `free -m` separates `used` from `buff/cache` and shows `available` (the number that actually matters).
- **Swap used / swap activity**: pages evicted to disk. Swap *space used* is not itself alarming; **swap I/O rate** (`vmstat si`/`so`) is.

**Thrashing** is the failure mode: the working set exceeds RAM, so the kernel constantly evicts pages that are about to be needed again, causing a storm of **major page faults** and swap I/O. Symptoms: `si`/`so` continuously high, iowait high, major-fault rate high, throughput collapses while the CPU sits idle waiting on disk. The system spends more time paging than computing. Fix: reduce the working set, add RAM, or cap memory so the OOM killer trims a runaway process rather than dragging the whole box into swap.

### Q9. What are /proc and /sys, and why are they central to observability on Linux?

`/proc` and `/sys` are **pseudo-filesystems** — they contain no real files on disk; reading a "file" invokes kernel code that materializes the current state on the fly. They are the primary window into the running kernel, and nearly every tool (`top`, `ps`, `vmstat`, `free`) is really just a pretty-printer over them.

- **`/proc`** exposes process and kernel state:
  - `/proc/<pid>/status`, `/stat` — per-process CPU, memory, state (R/S/D/Z).
  - `/proc/<pid>/fd/` — open file descriptors; `/maps` — the memory map (segments, libs); `/smaps` — per-mapping RSS.
  - `/proc/meminfo`, `/proc/stat`, `/proc/loadavg`, `/proc/interrupts` — system-wide counters.
- **`/sys`** (sysfs) exposes device and kernel-object state — block devices, CPU topology, tunables, driver parameters.

Because everything is a readable file, observability is scriptable with no special API: `cat /proc/loadavg`, or watch `/proc/<pid>/stat`. This is the concrete form of Unix's "everything is a file." The downside is that reading is a *sample* (a snapshot each time you read), which is why higher-fidelity, event-driven tracing (perf, ftrace, eBPF) exists alongside it.

### Q10. Survey the Linux performance toolset — what does each tool measure?

Rough map from broad to deep (the "drill-down" order):

- **top / htop** — live per-process CPU%, memory, load, state. First glance.
- **vmstat** — system-wide: run-queue (`r`), blocked (`b`), swap I/O (`si`/`so`), CPU breakdown. Good for CPU-vs-memory-vs-I/O triage.
- **iostat -x** — per-disk utilization, queue size (`aqu-sz`), await, throughput. The disk USE check.
- **mpstat -P ALL** — per-CPU breakdown (spot one hot core vs balanced load).
- **pidstat** — per-process CPU, memory, I/O, context switches over time.
- **sar** — historical/recorded system activity (trends over hours).
- **free** — memory: used vs cache vs available, swap.
- **strace / ltrace** — trace a process's **syscalls** / library calls (which syscall is slow or looping). High overhead — diagnostic, not production.
- **perf** — CPU **profiler** and hardware-counter tool: `perf top`, `perf record`/`report`, cache-miss and cycle counters; produces flame graphs.
- **ftrace** — the built-in kernel function tracer.
- **eBPF (bcc / bpftrace)** — programmable, low-overhead custom tracing of almost any kernel/user event.

The pattern: USE-method triage with vmstat/iostat/top to find the resource, then strace/perf/eBPF to find the exact cause.

### Q11. What is eBPF and why is it called a revolution in observability?

**eBPF** (extended Berkeley Packet Filter) lets you run small, sandboxed programs **inside the kernel**, attached to almost any event — a syscall entry, a function call (kprobe/uprobe), a tracepoint, a network packet, a scheduler event — without changing kernel code or loading a risky module.

How it's safe and fast: you write a small program (often via **bcc** or **bpftrace**), a kernel **verifier** proves it can't crash or loop forever (bounded loops, no arbitrary memory access), it's **JIT-compiled** to native code, and it runs in-kernel aggregating data into maps that user space reads. Because it runs at the event source and aggregates in-kernel, overhead is tiny compared to `strace` (which traps on every syscall) or sampling.

Why it's a revolution: before eBPF you were limited to what fixed tools and `/proc` counters exposed. Now you can answer *custom, ad-hoc* questions in production safely — "histogram of disk I/O latency by process," "which functions are causing off-CPU time," "count TCP retransmits per connection" — with a one-liner (`bpftrace`) and near-zero overhead. It underpins modern tools (Cilium networking, bcc's `biolatency`/`execsnoop`, continuous profilers). For interviews: it's the answer to "how would you debug this in production without adding overhead or a code change?"

### Q12. What is a flame graph and how do you read one?

A **flame graph** visualizes **sampled** stack traces. You profile by periodically (say 99x/sec) sampling the call stack of the running threads; identical stacks are collapsed and counted. The graph plots:

- **x-axis = proportion of samples** (NOT time order — it's sorted alphabetically for merging). **Width = how often that function was on-CPU.**
- **y-axis = stack depth** — callers at the bottom, callees stacked above.

```text
  |__string_format__|   <- narrow: rarely sampled
  |______parse______|______serialize______|
  |___________handle_request________________|
  |_________________main____________________|   <- base: always present
```

You read it by scanning for **wide plateaus at the top** — a function that is wide *and* has little above it is spending CPU *itself* (the hot leaf), which is your optimization target. Wide towers deep down are just common call paths. This immediately answers "where is the CPU time going?" far better than a flat function list, because it shows the code path, not just totals. **Sampling** (this) is low-overhead and statistical; **instrumentation** (counting every call) is exact but perturbs timing — flame graphs are the sampling approach, and `perf` + eBPF both produce them.

### Q13. What causes tail latency (p99), and why isn't the average enough?

The **average** hides the tail because most requests are fast; p99/p99.9 captures the slow 1%/0.1% that users actually notice (and that fan out badly — a page making 100 backend calls will hit its slowest backend's tail almost every time). Averages can look great while a real fraction of users has a terrible experience.

Common tail-latency causes — all things that *occasionally* stall an otherwise-fast request:
- **GC pauses** — a stop-the-world collection freezes the request mid-flight.
- **Major page faults** — an unlucky request touches a paged-out page and eats a disk read.
- **Lock contention** — the request happens to arrive when a hot lock is held.
- **Context switches / scheduling delay** — the thread got descheduled and waited in the run queue.
- **Noisy neighbors / CPU steal** — in a shared/cloud host, another tenant grabbed the CPU.
- **Queueing** — the request landed behind a burst; queueing delay explodes as utilization nears 100% (why you keep utilization comfortably below saturation).

The senior move: measure percentiles, then attribute the tail to one of these mechanisms (e.g. correlate p99 spikes with GC logs or major-fault counters) rather than chasing the mean.

### Q14. What is Amdahl's law and what does it say about adding cores?

**Amdahl's law** bounds the speedup from parallelism by the fraction of work that is inherently **serial**. If a fraction *p* of the work can be parallelized and (1−p) is serial, then with *N* processors:

```text
Speedup(N) = 1 / ( (1 - p) + p/N )

As N -> infinity:  Speedup -> 1 / (1 - p)
```

So if 10% of the work is serial (p = 0.9), the maximum possible speedup is 1/0.1 = **10x — no matter how many cores you throw at it.** Even with infinite processors the serial 10% dominates. This is why "just add more threads/cores" hits a wall: the serial fraction (locks, coordination, I/O barriers, the single-threaded setup phase) caps you.

Implications: (1) find and shrink the serial fraction — often it's a shared lock or a sequential I/O step, which ties back to lock contention and context-switch costs; (2) beyond a point, extra threads only add context-switch and contention overhead, actively *slowing* the program (see Q2); (3) contrast with **Gustafson's law**, which observes that in practice we scale the *problem size* with cores, so parallelism stays useful for larger workloads. For interviews, Amdahl's law is the crisp reason parallel speedup saturates.

### Q15. A service has high load average but the CPUs are ~90% idle, and p99 latency is spiking. Walk me through diagnosing it.

Reason from the USE method and the load-average definition.

**Step 1 — interpret the symptom.** High load + idle CPU means the load is dominated by **non-CPU** tasks: either uninterruptible-sleep (D-state, i.e. disk I/O) or blocked threads. The CPU isn't the bottleneck.

**Step 2 — check iowait and disk saturation.** `vmstat 1` / `top`: is `wa` (iowait) high and the blocked (`b`) count large? `iostat -x 1`: is a disk at ~100% util with a deep queue and high await? If yes → **I/O-bound**. Then find the culprit: `pidstat -d`, or eBPF `biolatency`/`biosnoop`, or `iotop`. Likely a major-fault/swap storm (`si`/`so` in vmstat, rising `maj_flt`) → out of RAM and thrashing; or a slow/failing disk; or a chatty query pattern doing random reads.

**Step 3 — if disk is fine, suspect blocking/locks.** D-state or off-CPU waits without disk activity point to lock contention, a slow downstream dependency, or threads parked on a mutex/DB pool. Use `perf sched`/off-CPU flame graphs or eBPF `offcputime` to see *what* they're waiting on. A saturated connection pool or a hot lock produces exactly this: idle CPU, threads all blocked, latency tail exploding.

**Step 4 — tie to p99.** The tail spikes because each request occasionally lands on the stall (major fault, or waiting behind the contended resource). Confirm by correlating p99 spikes with the fault/swap or lock-wait metric.

**Conclusion:** the fix follows the found resource — add RAM / shrink working set (thrashing), speed up or cache the I/O, or reduce contention / enlarge the pool. The lesson: **measure before optimizing**, and don't assume "slow" means "CPU."

## Real-World Kernels

### Summary

**What this topic covers**

How the textbook mechanisms (scheduling, paging, syscalls, IPC) map onto the operating systems people actually ship and run. Three concern areas: (1) the **big three general-purpose kernels** — Linux (monolithic + modules), Windows NT (hybrid, Executive + HAL), and macOS/XNU (Mach microkernel + BSD + I/O Kit) — their architectures, process/thread models, filesystems, and the tradeoffs each makes; (2) the **Unix lineage & POSIX** that lets Linux, macOS, and BSD share concepts and a portable API (fork/exec, signals, file descriptors, everything-is-a-file), plus how mobile OSes (Android on Linux, iOS on XNU) diverge; and (3) the **specialized kernels** — RTOSes (FreeRTOS, VxWorks, QNX, Zephyr) built for **determinism** with real-time scheduling (Rate-Monotonic, EDF), embedded OSes and unikernels, and the **microkernel resurgence** (seL4, formally verified). The 15 questions here answer "Linux vs Windows vs macOS," "what is an RTOS," "hard vs soft real-time," and "why would you pick one kernel over another" — grounding the theory in real systems.

**Mental model**

Every real kernel is a set of *tradeoff decisions* over the same problem: manage hardware, isolate processes, schedule work. The axes are **generality vs determinism vs footprint vs security**. A general-purpose OS (Linux/Windows/macOS) optimizes for **throughput and versatility** on unknown workloads — it will happily add latency (paging, fair scheduling, background work) to maximize overall utilization. An **RTOS** optimizes for **predictable worst-case latency** — it will sacrifice throughput and features to *guarantee* a task meets its deadline, because in an airbag or a pacemaker a late-but-correct answer is a failure. An **embedded/unikernel** optimizes for **footprint** — the smallest code that does one job. And **architecture** (monolithic vs microkernel vs hybrid) trades performance (everything in-kernel, fast, but one bug crashes all) against isolation/verifiability (services in user space, slower IPC, but a driver crash is contained). Read any real OS as "which point on these axes did they pick, and why does their target market demand it?"

**Key terms**

- **Monolithic kernel** — all core services (scheduler, VM, filesystems, drivers) run in one privileged address space; fast, but a bug anywhere can crash the kernel. Linux, with **loadable modules** for flexibility.
- **Microkernel** — only the bare minimum (IPC, scheduling, address spaces) in kernel mode; drivers/filesystems run as user-space servers. Isolated and verifiable, but IPC overhead. seL4, QNX, Mach.
- **Hybrid kernel** — a monolithic-ish kernel with microkernel-influenced structure. Windows NT, XNU.
- **XNU** — macOS/iOS kernel: **Mach** microkernel core + **BSD** Unix layer + **I/O Kit** driver framework.
- **POSIX** — the portable OS API standard (fork/exec, signals, fds, pthreads) that Unix-family systems implement, enabling source portability.
- **Everything is a file** — Unix design: devices, pipes, sockets exposed through the file-descriptor API.
- **CFS / EEVDF** — Linux's fair-share process schedulers (red-black-tree based).
- **RTOS** — real-time OS guaranteeing **bounded, deterministic** latency (FreeRTOS, VxWorks, QNX, Zephyr).
- **Hard vs soft real-time** — hard: a missed deadline is a total system failure; soft: a missed deadline degrades quality.
- **Rate-Monotonic (RMS)** — fixed-priority RT scheduling: shorter period → higher priority.
- **EDF (Earliest-Deadline-First)** — dynamic RT scheduling: the task with the nearest deadline runs next; higher achievable utilization than RMS.
- **Priority inversion / inheritance** — a low-priority task holding a lock blocks a high-priority one; inheritance temporarily raises its priority to fix it.
- **Unikernel** — app + just-enough-OS compiled into a single specialized image.

**Why interviewers ask this**

It tests whether you can connect abstract OS theory to the systems you'll actually build and operate. Juniors know "Linux" as a black box; seniors can say *why* Linux is monolithic, what NT does differently, and when a general-purpose OS is the wrong tool. The RTOS questions are a favorite because they force the real-time distinction: do you understand that an airbag controller needs a *guaranteed* worst-case response, not a fast *average*, and that this is a fundamentally different design goal? Knowing RMS vs EDF signals depth in scheduling theory beyond "Round Robin." And the Unix/POSIX lineage question checks whether you understand *why* code ports across Linux/macOS/BSD but not Windows — i.e. that a shared API standard, not shared code, is what enables portability. It also surfaces cloud awareness (Linux + KVM under nearly everything).

**Common confusions**

- "Real-time means fast" — no; it means **predictable / bounded**. An RTOS can be *slower* on average but *guarantees* a worst-case deadline. Determinism, not speed.
- "Linux is a microkernel" — it's **monolithic** (with modules). Mach and QNX are microkernels; XNU and NT are hybrids.
- "macOS is just BSD" / "macOS is Linux" — neither; XNU is Mach + BSD + I/O Kit, and it shares no kernel code with Linux (both are Unix-*like* via POSIX).
- "POSIX means they share code" — POSIX is an **API standard**; systems implement it independently, which is why *source* ports but binaries don't.
- "Android is just Linux" — it's a Linux *kernel* plus a completely different userland (managed runtime, permission/lifecycle model, aggressive power management).
- "Windows is Unix underneath" — it isn't; NT is an independent design (Executive, object manager, Win32) with a different process/thread/API model. WSL2 runs a *real* Linux kernel in a VM to bridge the gap.

**What follows from this topic**

This grounds every earlier mechanism in a real implementation: the scheduling topic's CFS is Linux's, the paging topic's page cache is Linux's, the syscall path differs on NT. The RTOS material extends CPU Scheduling into real-time scheduling (RMS/EDF) and revisits priority inversion from Synchronization. The microkernel-vs-monolithic axis connects to the kernel-architecture and virtualization topics (containers share the host Linux kernel; clouds run Linux + KVM). It sets up the **Scenario & Interview Playbooks** capstone, where "why an RTOS not Linux for an airbag" is a canonical question.

### Q1. Describe the Linux kernel architecture.

Linux is a **monolithic kernel with loadable modules**. All core subsystems — process scheduler, memory manager, virtual filesystem, network stack, and device drivers — run together in a single privileged kernel address space. That's fast (subsystems call each other as plain function calls, no IPC), but a bug in any part can take down the whole kernel.

Key pieces:
- **Process/thread model**: everything is a **task** (`task_struct`). There's no hard kernel distinction between processes and threads — both are created by **`clone()`**, and "threads" are just tasks that share address space, file descriptors, and signals. `fork()` is `clone()` with nothing shared (plus copy-on-write).
- **Scheduler**: **CFS** (Completely Fair Scheduler, red-black tree of tasks by virtual runtime), being replaced by **EEVDF** in recent kernels; plus real-time scheduling classes (SCHED_FIFO/RR).
- **Memory**: demand-paged virtual memory with a unified **page cache** (free RAM caches file data), multi-level page tables, huge pages, swap.
- **Filesystems**: **ext4**, **XFS**, **btrfs**, all behind the **VFS** abstraction; `/proc` and `/sys` pseudo-filesystems expose kernel state ("everything is a file").
- **Modules**: drivers and filesystems can be loaded/unloaded at runtime (`insmod`/`modprobe`) — monolithic performance with runtime flexibility.
- **Userland glue**: **systemd** as init/service manager.

Open-source, and utterly dominant in servers, cloud, and (as the kernel under) Android.

### Q2. How does the Windows NT kernel differ from Linux?

Windows NT is a **hybrid kernel** — monolithic performance with some microkernel-influenced structure — and an independent design, *not* Unix-derived.

| | Linux | Windows NT |
|---|---|---|
| Architecture | Monolithic + modules | Hybrid (Executive + microkernel-ish kernel layer) |
| Hardware abstraction | in-kernel | explicit **HAL** (Hardware Abstraction Layer) |
| Core services | subsystems | the **Executive** (object mgr, memory mgr, I/O mgr, process mgr) |
| Primary API | POSIX / syscalls | **Win32** API |
| Everything is... | a file | an **object** (managed by the Object Manager, with handles) |
| Filesystem | ext4/xfs/btrfs | **NTFS** |
| Config | text files, /proc | the **Registry** (hierarchical binary store) |
| Process creation | fork()+exec() | **`CreateProcess`** (no fork; process built fresh) |
| Async I/O | epoll/io_uring | **I/O Completion Ports** (the native, mature async model) |
| Threading extra | — | **fibers** (user-scheduled lightweight threads) |

The deep differences: NT has **no fork** (you construct a process directly, so the copy-on-write fork idioms of Unix don't apply); it models kernel resources as **objects with handles** rather than file descriptors and paths; its native async I/O (**IOCP**) is a completion model (tell me when it's done) versus Linux's traditional readiness model (tell me when I can act), and it uses the **Registry** instead of scattered text config. NT was designed by a team (led by Dave Cutler, from VMS) as its own OS, which is why concepts don't line up 1:1 with Unix.

### Q3. What is XNU and how is macOS structured?

**XNU** ("X is Not Unix") is the kernel of macOS and iOS — a **hybrid** combining three lineages:

- **Mach microkernel** (core): provides the low-level primitives — tasks/threads, virtual memory, scheduling, and **Mach ports** for IPC. Mach is a true microkernel design, but in XNU it runs in the kernel address space (for speed), not as isolated servers.
- **BSD layer** (on top of Mach): the **Unix** personality — the POSIX process model, users/permissions, signals, sockets, the **VFS**, and the BSD system-call interface. This is why macOS is a certified Unix and much Unix software builds on it.
- **I/O Kit**: a C++ driver framework for writing device drivers in a structured, object-oriented way.

Around the kernel: **Darwin** is the open-source core (XNU + BSD userland); **launchd** is the init/service manager (analogous to systemd); **APFS** is the modern copy-on-write filesystem (snapshots, cloning, encryption).

So macOS is genuinely Unix under the hood (POSIX, fork/exec, everything-is-a-file via the BSD layer) but built on a Mach core, sharing **no kernel code with Linux** — they're relatives via the Unix/POSIX standard, not the same codebase. iOS uses the same XNU core with a heavily sandboxed, app-lifecycle userland on top.

### Q4. What is the Unix lineage and POSIX, and why do they enable portability?

The historic **Unix** (Bell Labs, 1970s) established a design that most non-Windows systems inherited: processes created by **fork/exec**, **signals** for async notification, **file descriptors** as the universal I/O handle, **everything is a file** (devices, pipes, sockets all use `read`/`write`), a hierarchical filesystem, and a small set of composable tools. Linux, the BSDs, macOS, Solaris, and AIX all descend from or reimplement this model.

**POSIX** (Portable Operating System Interface) is the IEEE **standard** that codifies this common API: the syscalls (`fork`, `exec`, `open`, `read`, `write`, `pipe`, `signal`), the pthreads threading API, shell and utility behavior. Crucially, POSIX standardizes the *interface*, not the implementation.

Why that enables portability: if you write to the POSIX API, your **source code** compiles and runs on any POSIX-conforming system — Linux, macOS, BSD — because they all expose the same function contracts, even though their kernels are entirely different codebases. That's why `nginx`, `redis`, or a C program using `fork`/`sockets` builds everywhere Unix-like, but not on Windows (which implements Win32, not POSIX natively — hence WSL). Portability comes from the shared *standard*, not shared code.

### Q5. How do mobile OSes (Android, iOS) build on these kernels?

Both reuse a desktop-class kernel but replace the userland and execution model for a constrained, battery-powered, touch, app-store world.

**Android**:
- **Kernel**: the **Linux** kernel (with vendor patches), providing the same process/paging/driver model.
- **Runtime**: apps run on a **managed runtime** (ART, ahead-of-time/JIT compiled) rather than as raw native processes — memory-safe, GC'd.
- **App model**: a **component + lifecycle** model (Activities/Services with onCreate/onPause callbacks) — the system can pause/kill apps freely to reclaim resources.
- **Permissions**: a per-app **permission** model with each app sandboxed under its own Linux UID.
- **Power**: aggressive management — wakelocks, Doze, background execution limits — because battery is the scarce resource.

**iOS**:
- **Kernel**: **XNU** (same core as macOS).
- **App model**: heavily **sandboxed** native apps, strict lifecycle and background limits, code-signing enforced.

The theme: the kernel is inherited, but the layers above enforce sandboxing, lifecycle-driven resource reclamation, and power thrift that a desktop OS doesn't. "Android is Linux" is only true at the kernel layer; everything a developer touches is different.

### Q6. What is an RTOS and how does it differ from a general-purpose OS?

A **Real-Time Operating System** guarantees **bounded, deterministic** response times — a task will run within a known worst-case latency, every time. The goal is **predictability, not throughput or average speed**.

The contrast:

| | General-purpose OS | RTOS |
|---|---|---|
| Optimizes for | throughput, fairness, versatility | worst-case latency / determinism |
| Scheduling | fair-share (CFS), best average | strict **priority preemption**, RMS/EDF |
| Latency | good average, unbounded tail | **bounded worst case** |
| Paging | demand paging, swap | often **no paging** (page faults = unpredictable stalls) |
| Footprint | large | tiny (kernel can be a few KB) |
| Examples | Linux, Windows, macOS | FreeRTOS, VxWorks, QNX, Zephyr |

How an RTOS gets determinism: a fully **preemptive, priority-based** scheduler (the highest-priority ready task *always* runs immediately); **bounded** interrupt latency and kernel critical sections; **no demand paging** (everything resident, so no surprise disk stall); priority-inheritance mutexes to bound blocking. It sacrifices features and average throughput to make the worst case *provable*.

Used where a late answer is a failure: automotive (airbags, engine control), aerospace (flight control), medical devices (pacemakers, infusion pumps), industrial controllers. QNX (a **microkernel** RTOS) powers cars and safety systems precisely because isolation + determinism together matter there.

### Q7. Explain hard vs soft real-time with examples.

The difference is the *consequence of missing a deadline*.

- **Hard real-time**: missing a deadline is a **total system failure** — potentially catastrophic. The system must *guarantee* every deadline, proven by worst-case analysis. Examples: an **airbag** must fire within milliseconds of a crash — late is useless or lethal; anti-lock brakes; flight control surfaces; a pacemaker's timing. You'd never build these on a general-purpose OS because it can't *guarantee* the worst case.
- **Soft real-time**: missing a deadline **degrades quality** but the system still functions. Occasional misses are tolerable. Examples: **video/audio streaming** (a late frame is a glitch, not a disaster), a game's frame rate, a live dashboard, VoIP. Best-effort-with-usually-good-latency is fine.
- (**Firm real-time** sits between: a late result is simply useless/discarded but not catastrophic — e.g. a stale sensor reading in some control loops.)

The key interview point: hard real-time is about **provable worst-case guarantees**, which drives the whole design (RTOS, no paging, static analysis, priority scheduling). Soft real-time just wants good typical latency and can run on a tuned general-purpose OS.

### Q8. Compare Rate-Monotonic and Earliest-Deadline-First scheduling.

Both schedule **periodic** real-time tasks (each task runs every period P with a deadline and a compute time C), but assign priority differently.

**Rate-Monotonic (RMS)** — **static/fixed** priority: the **shorter the period, the higher the priority** (higher rate → higher priority). Priorities are fixed at design time. Simple, predictable, and preemptive. Its schedulability bound: a set of *n* tasks is guaranteed schedulable if total utilization Σ(Cᵢ/Pᵢ) ≤ n(2^(1/n) − 1), which converges to **~69% (ln 2)** as n grows. So RMS may leave ~31% of CPU unusable in the worst case to keep guarantees.

**Earliest-Deadline-First (EDF)** — **dynamic** priority: at any instant, run the task whose **deadline is nearest**. Priorities change as deadlines approach. EDF is **optimal** for single-processor preemptive scheduling: it can schedule any task set with total utilization **≤ 100%**.

| | RMS | EDF |
|---|---|---|
| Priority | static (by period) | dynamic (by deadline) |
| Max guaranteed utilization | ~69% | 100% |
| Implementation | simple, predictable | more overhead, deadline tracking |
| Overload behavior | lower-priority tasks miss predictably | can cascade/domino unpredictably |

Tradeoff: RMS is simpler and degrades predictably under overload (you know which tasks miss), which is why safety-critical systems often prefer it despite lower utilization; EDF squeezes out full CPU utilization but is harder to analyze and behaves worse when overloaded.

### Q9. What is priority inversion and how is it solved in a real-time system?

**Priority inversion**: a **high**-priority task is blocked waiting for a resource (lock) held by a **low**-priority task, and a **medium**-priority task (that doesn't need the lock) preempts the low task — so the medium task effectively runs *ahead* of the high task, inverting the priority order. The high task is stuck indefinitely.

```text
High:   -- wants lock L (held by Low) --------- BLOCKED -------------->
Med:                      ==== runs, preempts Low ====
Low:    == holds L == (preempted, can't release L) .....................
        Result: High waits on Med, even though High > Med.
```

This famously nearly doomed the **Mars Pathfinder** mission (a watchdog kept resetting it).

Fixes:
- **Priority inheritance**: while a low-priority task holds a lock a high-priority task wants, the low task **temporarily inherits** the high priority — so it can't be preempted by medium tasks, finishes fast, and releases the lock. Priority drops back after. (This is what fixed Pathfinder.)
- **Priority ceiling protocol**: each lock has a "ceiling" = the priority of the highest task that may use it; a task holding the lock runs at that ceiling, preventing inversion and also avoiding deadlock.

RTOS mutexes typically offer priority inheritance as an option precisely because bounded blocking is required for the worst-case guarantees.

### Q10. What are embedded OSes and unikernels?

**Embedded OSes** are tiny, specialized systems for devices with tight memory/power/CPU budgets and often a fixed, known workload — microcontrollers, IoT sensors, appliances. Many are RTOSes (**FreeRTOS**, **Zephyr**), some are stripped-down Linux (Yocto/Buildroot builds). Traits: small footprint (KBs–low MBs), no MMU sometimes, static configuration, direct hardware access, long-running reliability. The design goal is doing one job well within severe constraints, not general versatility.

**Unikernels** take specialization further: compile the **application plus only the OS functionality it actually uses** (just the needed drivers, network stack, memory management) into a **single, self-contained image** that boots directly on a hypervisor or bare metal — no separation between app and kernel, no unused OS code, often a single address space.

Benefits: tiny image, fast boot (milliseconds), small attack surface (no shell, no unused services, no multi-user), and low overhead (no user/kernel mode-switch cost since it's one address space). Costs: hard to debug (no shell/tools), one app per image, and a less mature ecosystem — so they've stayed niche (serverless-style, network appliances) rather than mainstream. Examples: MirageOS, Unikraft, IncludeOS. Conceptually they're the extreme end of the "footprint" axis.

### Q11. What is the microkernel resurgence, and what is seL4?

Microkernels lost the 1990s performance argument to monolithic kernels (Linux won) because moving drivers/filesystems into user-space servers made everything communicate via **IPC**, which was slower than in-kernel function calls. But they're resurging for one reason: **security and verifiability**.

The microkernel idea: keep only the irreducible core in privileged mode — IPC, scheduling, and address-space management — and run drivers, filesystems, and networking as isolated **user-space servers**. A crashing or compromised driver can't take down the kernel or touch memory it wasn't granted; the *trusted computing base* is tiny.

**seL4** is the landmark: a microkernel with a **formal, machine-checked mathematical proof** of correctness — proven to be free of whole classes of bugs (no buffer overflows, no null derefs) and to enforce its security properties, with worst-case execution time bounds (so it's also usable for hard real-time). Because the kernel is small (~10k lines), such a proof is *feasible* — you cannot formally verify millions of lines of monolithic kernel.

Where it matters: safety- and security-critical systems — avionics, defense, medical, secure enclaves, automotive — where "we mathematically proved the kernel can't fail this way" is worth the IPC overhead. Modern IPC optimizations and hardware have also narrowed the old performance gap. QNX (commercial microkernel RTOS) shows the same isolation payoff in cars.

### Q12. How do clouds and hypervisors relate to these kernels?

Virtually all public cloud runs on **Linux + KVM**. **KVM** (Kernel-based Virtual Machine) turns the Linux kernel itself into a **type-1-like hypervisor**: with hardware virtualization support (Intel VT-x / AMD-V), the host Linux kernel schedules **virtual machines** as if they were processes, each running a full guest OS. So the "hypervisor" isn't separate — it's a Linux kernel module, with a userspace component (QEMU) emulating devices.

The stack:
- **Type-1 (bare-metal) hypervisors** run directly on hardware (Xen, VMware ESXi, Hyper-V, and KVM-as-part-of-Linux) — used by clouds for strong VM isolation between tenants.
- **Type-2 (hosted)** run on top of a host OS (VirtualBox, VMware Workstation) — for desktops/dev.
- **Containers** (Docker/Kubernetes) are **not** VMs — they share the **host Linux kernel**, isolated by **namespaces** (separate views of PIDs, mounts, network) + **cgroups** (resource limits). Lighter than VMs (no guest kernel) but weaker isolation (shared kernel = shared attack surface).

So the picture: cloud hosts run Linux; on top, KVM runs tenant VMs (each a full OS) for hard isolation, and *inside* those, containers pack many workloads sharing that guest's kernel. This ties directly to the virtualization/containers topic — the kernel is the shared substrate the whole industry stands on.

### Q13. When would you pick a general-purpose OS vs an RTOS vs an embedded OS?

Match the OS to the *dominant constraint*:

- **General-purpose OS (Linux/Windows/macOS)** — when the workload is **varied and unknown**, you need a rich ecosystem (drivers, libraries, tooling), and **average throughput** matters more than worst-case latency. Servers, desktops, phones, cloud. You accept unbounded tail latency (paging, fair scheduling) in exchange for versatility and performance.
- **RTOS (FreeRTOS/VxWorks/QNX/Zephyr)** — when a **missed deadline is a failure** and you need a *provable* worst-case response. Safety-critical and control systems: automotive (airbags, ABS, engine), aerospace (flight control), medical (pacemakers), industrial robotics. You give up features and average throughput to guarantee determinism.
- **Embedded/minimal OS (or bare metal / unikernel)** — when **resources are tiny** (a microcontroller with KB of RAM), the workload is **fixed and known**, and you want minimal footprint, power draw, and attack surface. IoT sensors, appliances, network appliances.

The decision tree: *Is there a hard deadline whose miss is catastrophic?* → RTOS. *Are resources severely constrained with a fixed job?* → embedded/unikernel. *Otherwise, do you want ecosystem and general versatility?* → general-purpose OS. Real products often nest these (an infotainment Linux system alongside a QNX/RTOS safety controller in the same car).

### Q14. Why does an airbag controller use an RTOS instead of Linux?

Because the requirement is a **hard real-time guarantee**, and Linux — a general-purpose, throughput-optimized OS — cannot provide one.

An airbag must deploy within a few **milliseconds** of crash detection. *Every single time.* A response that's usually 2ms but occasionally 50ms is not merely slow — it can be lethal. That demands a **provable worst-case latency**, and Linux introduces unbounded sources of delay:
- **Demand paging / swap** — a page fault could stall for a disk read at the worst moment (RTOS: no paging, everything resident).
- **Fair scheduling (CFS)** — optimizes average fairness, not "the critical task runs *right now*" (RTOS: strict priority preemption, highest-priority task always runs immediately).
- **Unbounded interrupt/kernel latency** — long non-preemptible sections, deferred work, unpredictable interrupt handling (RTOS: bounded, analyzable interrupt latency and critical sections).
- **Priority inversion** without inheritance could block the critical task (RTOS mutexes offer priority inheritance).
- Huge, complex codebase that's impractical to certify to safety standards (ISO 26262). An RTOS is small enough to analyze/certify.

An RTOS trades away throughput, features, and generality — none of which the airbag needs — to make the **worst-case response provably bounded**, which is exactly what the airbag *does* need. That's the whole point: real-time means *guaranteed*, not *fast on average*.

### Q15. Briefly — what is WSL and the Linux-on-Windows story?

Developers want the Linux/POSIX toolchain (bash, gcc, the Unix syscall behavior) on Windows machines. Microsoft's answer evolved:

- **WSL 1**: a **translation layer** — a Windows subsystem that intercepted Linux syscalls and translated them to NT kernel calls in real time. Clever, but incomplete syscall coverage and slow filesystem behavior, because it was *emulating* Linux on the NT kernel.
- **WSL 2** (current): runs a **real, actual Linux kernel** in a lightweight, highly-integrated **VM** (via Hyper-V). Full syscall compatibility (it *is* Linux), much faster, with seamless file and network integration with Windows.

Why WSL exists at all traces back to Q4: Windows implements **Win32**, not POSIX, so Linux software doesn't run natively — you either translate the API (WSL 1) or run a genuine Linux kernel (WSL 2). Microsoft chose to ship real Linux rather than keep chasing translation completeness. It's the pragmatic bridge across the Unix/NT divide, and it's why "Linux on Windows" today means "a real Linux kernel in a tuned VM," not emulation.

## Scenario & Interview Playbooks

### Summary

**What this topic covers**

The capstone — the classic "explain this," "walk me through it," and "spot the bug" OS interview questions, answered end-to-end, pulling together every mechanism from the earlier topics. This isn't new theory; it's the *integration* topic where processes, threads, syscalls, paging, scheduling, synchronization, deadlock, IPC, and virtualization all show up in the single realistic questions interviewers actually ask. The 17 questions are the canonical set: "what happens when you run a program," "walk me through a page fault / a system call," "process vs thread — when each," "explain and fix a race condition," "solve producer-consumer / dining philosophers," "spot this deadlock," "why do more threads slow it down," "why is my system slow," "how does virtual memory exceed RAM," "how does the OS run 100 processes on 4 cores," "container vs VM," "how do processes share data," "interrupt vs system call," and "how does the OS stop one program crashing the machine." Each answer names the concept being tested and gives the mechanism-level walkthrough with the code, interleaving, or diagram.

**Mental model**

Answer every OS interview question by **reasoning from the mechanism**: don't recite a definition, describe *what the CPU, kernel, and MMU actually do, step by step*. Four reflexes carry most questions. (1) **Layer discipline** — always separate **process vs thread** (address space vs execution context), **physical vs virtual** (RAM vs the per-process address space the MMU translates), **sync vs deadlock** (a race is missing mutual exclusion; a deadlock is circular waiting *with* it), and **user vs kernel mode** (the privilege boundary crossed by a trap). (2) **The trap trio** — a huge fraction of questions reduce to a controlled entry into the kernel: **system call** (deliberate), **page fault** (MMU-triggered), **interrupt** (device-triggered). Know all three paths cold. (3) **Concrete numbers** — quote latency intuition (a major fault is ~10ms = a disk read; a context switch ~µs) to show you reason about cost. (4) **For "spot the bug," trace the interleaving** — write the two threads' operations on separate lines and find an ordering that breaks. Do these and you can derive the answer live instead of memorizing.

**Key terms**

- **fork + exec** — the Unix two-step to run a program: duplicate the process (COW), then replace its image.
- **loader / dynamic linker** — maps the executable (ELF/PE) into the address space and resolves shared libraries.
- **demand paging** — pages are loaded lazily on first access via minor/major faults, not all up front.
- **trap** — a synchronous, deliberate entry to the kernel (syscall or fault); vs an **interrupt** (asynchronous, device-driven).
- **race condition** — a non-deterministic bug from unsynchronized concurrent access with ≥1 write.
- **critical section / mutex** — the code that must run under mutual exclusion, and the lock that enforces it.
- **producer-consumer / bounded buffer** — the canonical coordination problem; solved with semaphores or a monitor.
- **dining philosophers** — the canonical deadlock problem; solved by breaking circular wait (resource ordering).
- **lock ordering** — acquire locks in a global order everywhere to prevent deadlock.
- **working set / thrashing** — the pages a process actively needs; too little RAM → constant paging.
- **time-slicing** — the scheduler multiplexes many tasks onto few cores via context switches.
- **isolation / dual-mode** — virtual memory + user/kernel mode + the MMU keep a buggy process from harming others.

**Why interviewers ask this**

These *are* the interview. "What happens when you run a program" and "walk me through a page fault" are the two most common OS questions in existence precisely because they're **infinitely scalable** — you can answer in one sentence or descend for twenty minutes into COW, the dynamic linker, TLB shootdowns, and page-replacement policy. The interviewer keeps asking "and then?" to find the depth of your model. The scenario questions ("why is it slow," "spot the deadlock," "why did threads slow it down") test whether you can *apply* the mechanisms to a real symptom rather than recite them — the difference between someone who read the textbook and someone who has debugged production. The junior answer is a definition; the senior answer is a *causal trace* through hardware and kernel, with the tradeoffs and the fix, quoting cost intuition where it matters.

**Common confusions**

- "Running a program is just exec" — it's **fork *then* exec** (the shell forks a child, which execs), and most of the work (paging, linking) happens lazily *as it runs*.
- "A race and a deadlock are similar bugs" — opposite: a race is **too little** locking (no mutual exclusion); a deadlock is locking that **circularly waits**. Adding locks fixes a race but can *cause* a deadlock.
- "More threads always help" — only for parallelizable, CPU-bound work up to core count; beyond that (or for I/O-bound/contended/GIL'd code) they *slow* it via context-switch and contention overhead.
- "Virtual memory is RAM" — virtual memory is an *address-space abstraction*; it lets total virtual size exceed RAM by paging to disk, at the risk of thrashing.
- "An interrupt and a syscall are the same" — both enter the kernel, but a syscall is a **synchronous, deliberate trap** from your code; an interrupt is an **asynchronous** signal from a device.
- "Containers are lightweight VMs" — containers share the **host kernel** (namespaces + cgroups); VMs run a **full guest OS** on a hypervisor. Different isolation, different cost.

**What follows from this topic**

Nothing follows — this is the destination. Every earlier topic feeds in: Processes & Threads (fork/exec, process vs thread), System Calls & Interrupts (the trap paths), Virtual Memory & Paging (page faults, thrashing, VM > RAM), CPU Scheduling (100 processes on 4 cores, why more threads slow down), Synchronization (races, producer-consumer, mutexes), Deadlock (dining philosophers, lock ordering), IPC (how processes share data), Virtualization (container vs VM), and Performance (why is it slow, USE method). If you can answer these 17 end-to-end, you can hold an OS interview at any depth — because these questions *are* the interview, and each one is a thread you pull to reveal the whole system underneath.

### Q1. What happens, end to end, when you run/execute a program?

Take `./myprog` typed in a shell. The full lifecycle:

1. **fork()** — the shell duplicates itself, creating a child process (copy-on-write address space; nothing is actually copied until written).
2. **exec()** — the child calls `execve("./myprog", ...)`. The kernel **discards the child's old address space** and loads the new program: it reads the executable header (**ELF** on Linux, **PE** on Windows, Mach-O on macOS), and **memory-maps** the segments — text (code), data, BSS — into a fresh virtual address space. It sets up the **stack** (with argv/envp) and an empty **heap**.
3. **Dynamic linking** — if dynamically linked, the kernel also maps the **dynamic linker** (`ld.so`), which loads the required **shared libraries** (libc, etc.) and resolves symbols (often lazily, on first call, via the PLT/GOT).
4. **Jump to entry** — control transfers to `_start` (in the C runtime), which sets up the runtime and calls **`main()`**.
5. **Demand paging as it runs** — almost nothing was physically loaded yet. As the program touches code and data, **page faults** (mostly minor) fault the pages in from the file on demand. The stack and heap grow via faults too.
6. **Syscalls for I/O** — every `printf`, `read`, `open` traps into the kernel (Q2).
7. **exit & reaping** — `main` returns / `exit()` runs; the kernel frees the address space and leaves a **zombie** (exit status) until the **parent `wait()`s** and reaps it. If the parent died first, `init`/systemd adopts the **orphan** and reaps it.

*Concept tested:* the whole process lifecycle — fork/exec, the loader, dynamic linking, demand paging, and reaping — and how much is *lazy*.

### Q2. Walk me through a system call end to end.

A syscall is a **synchronous, deliberate trap** from user mode into the kernel. Take `read(fd, buf, n)`:

```text
user mode                          kernel mode
---------                          -----------
libc read() wrapper
  put syscall# + args in registers
  execute `syscall` (trap) ------->  CPU raises privilege, jumps to
                                     kernel syscall entry handler
                                       - look up # in syscall table
                                       - validate fd, buf, n (security!)
                                       - do the work (read from page
                                         cache, or block on disk I/O)
                                       - if it blocks: scheduler runs
                                         another task meanwhile
                                       - place return value in a register
  <----- `sysret` / iret ---------   drop privilege, return to user
resume after read(), got n bytes
```

Key points: (1) the **mode switch** (user→kernel privilege change) is the essence — it costs hundreds of ns to ~1µs plus cache effects; (2) the kernel **must validate** all arguments (you can't trust a user pointer); (3) if the call blocks (disk not ready), the kernel **deschedules** your thread and runs someone else, waking you when the I/O completes; (4) this is why chatty syscall patterns are slow and batching / io_uring / vDSO help.

*Concept tested:* the user/kernel boundary, the trap mechanism, and syscall cost.

### Q3. Walk me through a page fault, end to end.

A page fault is a **trap raised by the MMU** when a program touches a virtual address whose page-table entry isn't valid/present.

```text
1. CPU issues virtual address -> MMU walks page table (or TLB)
2. PTE not present / not mapped -> MMU raises a PAGE FAULT trap
3. Kernel page-fault handler runs, classifies it:
     a. Invalid address (not in any VMA) -> SIGSEGV, kill process
     b. MINOR fault: page IS in RAM (page cache / COW / zero page)
          -> just fix the PTE, maybe COW-copy. Fast (~1us).
     c. MAJOR fault: page is on disk (file or swap)
          -> find a free frame (evict one via page-replacement if
             none free -> maybe write a dirty page out)
          -> issue disk read; BLOCK the thread (scheduler runs others)
          -> disk finishes (interrupt), fill frame, update PTE
4. Kernel returns; CPU RETRIES the faulting instruction -> now succeeds.
```

The crucial distinction is **minor** (in memory, ~1µs) vs **major** (disk read, ~10ms on HDD — a huge stall). A storm of major faults because the **working set** exceeds RAM is **thrashing**. Note the instruction is *restarted*, transparently to the program — demand paging is invisible except as latency.

*Concept tested:* the MMU, demand paging, minor vs major cost, page replacement, and thrashing.

### Q4. Process vs thread — what's the difference and when do you use each?

| | Process | Thread |
|---|---|---|
| Address space | its own (isolated) | **shared** with siblings |
| Shares | nothing (separate memory) | heap, globals, file descriptors, code |
| Private | everything | just stack + registers + PC |
| Creation cost | heavy (new address space) | light |
| Switch cost | heavier (page-table/TLB) | lighter (same address space) |
| Failure blast radius | isolated — a crash kills only it | **shared** — one crash/corruption can take down all threads |
| Communication | IPC (pipes, shared mem, sockets) | shared memory directly (needs sync) |

**Use processes** when you want **isolation and fault containment** — a crash or security compromise in one shouldn't touch the others (e.g. Chrome runs each tab in a process; a database with worker processes). You pay more to create/switch and must use IPC, but you get safety.

**Use threads** when tasks must **share data cheaply** and you want low creation/switch cost and easy communication through shared memory (e.g. a web server handling requests, a UI thread + worker threads). The price is you **must synchronize** shared access (mutexes) and one bad thread can corrupt the whole process.

*Concept tested:* the address-space-vs-execution-context distinction and the isolation/sharing tradeoff.

### Q5. Explain a race condition and how you'd fix it.

A **race condition** is a bug where the result depends on the **non-deterministic timing** of concurrent threads accessing shared state, with at least one write, and no synchronization. The classic is `count++`, which looks atomic but is three operations:

```text
count++  =  (1) load count -> reg
            (2) reg = reg + 1
            (3) store reg -> count

Two threads, count = 0, want final 2:
  T1 load(0)                      reg1=0
                 T2 load(0)       reg2=0
  T1 add                          reg1=1
                 T2 add           reg2=1
  T1 store(1)    count=1
                 T2 store(1)      count=1   <-- LOST UPDATE! should be 2
```

The interleaving lost an update. **Fix**: make the read-modify-write a **critical section** protected by a **mutex** (mutual exclusion — only one thread inside at a time):

```c
pthread_mutex_lock(&m);
count++;                 // now atomic w.r.t. other threads
pthread_mutex_unlock(&m);
```

Alternatives: an **atomic** instruction (`atomic_fetch_add`, compiles to a lock-prefixed/CAS instruction — faster, lock-free) or a language-level atomic type. The general rule: any shared mutable state touched concurrently with ≥1 writer needs mutual exclusion or atomics.

*Concept tested:* critical sections, non-atomic read-modify-write, and mutex/atomic fixes.

### Q6. Design a solution to the producer-consumer (bounded buffer) problem.

Producers add items to a fixed-size buffer, consumers remove them. Three constraints: producers block when **full**, consumers block when **empty**, and buffer access is **mutually exclusive**. The classic solution uses **three semaphores**:

```c
sem_t empty;   // = N  (free slots)
sem_t full;    // = 0  (filled slots)
sem_t mutex;   // = 1  (mutual exclusion on the buffer)

// Producer
sem_wait(&empty);        // wait for a free slot (blocks if full)
sem_wait(&mutex);        // enter critical section
  buffer[in] = item; in = (in + 1) % N;
sem_post(&mutex);
sem_post(&full);         // signal: one more item available

// Consumer
sem_wait(&full);         // wait for an item (blocks if empty)
sem_wait(&mutex);
  item = buffer[out]; out = (out + 1) % N;
sem_post(&mutex);
sem_post(&empty);        // signal: one more free slot
```

`empty`/`full` are **counting** semaphores that do the blocking coordination (backpressure both ways); `mutex` is a **binary** semaphore protecting the buffer indices. **Order matters**: take the counting semaphore *before* the mutex — reversing them (`mutex` then `full`) deadlocks (a full-buffer producer would sleep holding the mutex, blocking consumers forever).

The **monitor** alternative wraps the buffer with a lock + two **condition variables** (`notFull`, `notEmpty`), `wait()`-ing and `signal()`-ing on them inside the lock — cleaner and how Java (`synchronized` + `wait/notify`) or a `BlockingQueue` does it.

*Concept tested:* semaphores vs monitors, counting vs binary, and the acquire-order pitfall.

### Q7. In dining philosophers, where's the deadlock and how do you fix it?

Five philosophers around a table, one fork between each pair; each needs **both** neighboring forks to eat. Naive solution: each picks up left fork, then right fork.

**The deadlock**: if *all five* pick up their **left** fork simultaneously, every fork is held, and everyone waits forever for their right fork. This satisfies all four **Coffman conditions** — mutual exclusion (forks), hold-and-wait (holding left, waiting right), no preemption (can't steal a fork), and **circular wait** (P0→P1→P2→P3→P4→P0).

Fixes all target **circular wait**, the breakable condition:

- **Resource ordering (best)**: number the forks; each philosopher always picks up the **lower-numbered fork first**. Now philosopher 4 grabs fork 0 before fork 4, breaking the cycle — someone always gets both.
- **Limit concurrency**: allow at most **4** philosophers at the table at once (a counting semaphore = 4); with 4 competing for 5 forks, at least one can always eat.
- **Asymmetry**: odd philosophers pick left-then-right, even ones right-then-left — breaks the uniform cycle.
- **All-or-nothing**: grab both forks atomically (under a mutex) or neither.

The canonical answer is **resource ordering** — assign a global order to resources and always acquire in that order. It's the same fix as general lock-ordering (Q8).

*Concept tested:* the Coffman conditions and breaking circular wait.

### Q8. Spot and fix this deadlock.

```c
// Thread 1                    // Thread 2
lock(A);                       lock(B);
lock(B);   // waits for B      lock(A);   // waits for A
// ... work ...                // ... work ...
unlock(B); unlock(A);          unlock(A); unlock(B);
```

**The bug**: the two threads acquire the **same two locks in opposite order**. Interleave them:

```text
T1: lock(A)  -> holds A
T2: lock(B)  -> holds B
T1: lock(B)  -> BLOCKS (T2 holds B)
T2: lock(A)  -> BLOCKS (T1 holds A)
   -> circular wait: T1 waits on T2 waits on T1. DEADLOCK.
```

All four Coffman conditions hold; the culprit is **circular wait** created by inconsistent lock ordering.

**Fix — global lock ordering**: define a total order over locks and have **every** thread acquire them in that order (say always A before B):

```c
// Both threads:
lock(A);
lock(B);
// ...
unlock(B); unlock(A);
```

Now no cycle can form — whoever gets A first will get B, the other waits only on A. Other options: a single coarser lock (simpler, less concurrency), `trylock` with backoff (release and retry if you can't get the second), or a lock hierarchy enforced by tooling. But **consistent ordering** is the standard, zero-overhead fix.

*Concept tested:* recognizing circular wait from lock-order inversion and fixing it with lock ordering.

### Q9. Why does adding more threads sometimes make a program slower?

Because threads have costs that eventually outweigh the parallelism, and many workloads can't use them:

- **Context-switch overhead** — more runnable threads than cores means the scheduler time-slices, and each switch costs µs plus **cold caches/TLB** afterward (Q from Performance). Past core count, you're paying to switch, not compute.
- **Lock contention** — if threads share a hot lock, adding threads just adds waiters; they serialize on the lock and spend time blocking/waking (each a context switch). You've *reduced* effective parallelism to one-at-a-time plus overhead.
- **False sharing** — threads writing different variables that sit on the **same cache line** cause the line to ping-pong between cores' caches, silently killing performance.
- **The workload isn't CPU-bound** — if it's **I/O-bound**, threads mostly wait on disk/network; more threads don't speed a fixed disk. If there's a **GIL** (Python) or a global lock, only one thread runs CPU code at a time regardless.
- **Amdahl's law** — the serial fraction caps speedup; beyond that, extra threads add overhead for no gain.

The senior framing: **size the pool to the workload** — roughly core-count for CPU-bound work; more only helps I/O-bound work (to overlap waiting), and even then contention and switching set a ceiling. Measure, don't assume linear scaling.

*Concept tested:* context-switch cost, contention, false sharing, and workload classification.

### Q10. Why is my system slow — high load average but the CPU looks idle?

**High load + idle CPU** means the load is dominated by tasks that aren't using the CPU — because load average counts **runnable *plus* uninterruptible-sleep (D-state)** tasks, not just CPU demand. So the bottleneck is elsewhere. Diagnose with the **USE method**:

1. **Confirm it's I/O**: `vmstat 1` / `top` — is **iowait** (`wa`) high and the **blocked** count large? `iostat -x 1` — a disk at ~100% util with a deep queue? → **I/O-bound / disk-saturated**.
2. **Is it paging?** — `vmstat` `si`/`so` (swap in/out) high and **major faults** climbing? → out of RAM, **thrashing**; the working set exceeds physical memory so it's constantly paging from disk.
3. **If disk is idle too** — threads are **blocked on locks or a slow dependency** (D-state without disk). Off-CPU profiling (eBPF `offcputime`, `perf sched`) shows what they wait on — often a contended lock or an exhausted connection pool.

The fix follows the found resource: add RAM / shrink the working set (thrashing), speed up or cache the I/O, or reduce contention / enlarge the pool. The point interviewers want: **don't equate "slow" with "CPU"** — reason from what load average actually counts, then localize the saturated resource with the USE method before changing anything.

*Concept tested:* load-average semantics, iowait/D-state, thrashing, and the USE method.

### Q11. How does virtual memory let a program use more memory than physical RAM?

Through **paging + swap + demand paging**, and the key insight that a program rarely needs *all* its memory at once.

Each process gets a large **virtual address space** that the **MMU** translates to physical frames via its **page table**. Not every virtual page needs a physical frame at the same time — only the pages in active use (the **working set**) must be resident. Pages not currently needed can live **on disk** (in **swap** or backed by a file), with their page-table entries marked "not present."

```text
Virtual pages:   [A][B][C][D][E][F][G][H]   (bigger than RAM)
Physical frames: [A][C][ ][F]               (only the working set)
On disk (swap):  [B][D][E][G][H]
```

When the program touches a non-resident page, a **major page fault** fires: the kernel evicts a resident page (writing it to swap if dirty, via a **page-replacement** policy like LRU/Clock), loads the needed page from disk, and resumes. So total virtual size across all processes can far exceed physical RAM — the illusion is maintained by shuffling pages between RAM and disk.

The catch: if the **working set exceeds RAM**, you get constant faulting — **thrashing** — and performance collapses (Q10). Virtual memory buys capacity and isolation, but only works well when the *active* set fits in RAM.

*Concept tested:* paging, swap, demand paging, working set, and the thrashing limit.

### Q12. How does an OS run 100 processes on 4 cores?

By **time-slicing** (time-division multiplexing) — creating the *illusion* of concurrency by rapidly switching the few cores among many tasks.

- Only **4 tasks truly run at any instant** (one per core). The other 96 are in the **ready queue** (runnable) or **blocked** (waiting on I/O).
- The **scheduler** picks which ready task each core runs next. On a timer **interrupt** (say every few ms — the **time quantum**) or when a task **blocks** on I/O, the kernel performs a **context switch**: save the current task's registers/PC, pick another from the ready queue (Linux CFS picks the one with least virtual runtime for fairness), restore its state, resume it.
- Because switches happen thousands of times per second, each task makes steady progress and *appears* continuous to the user — like a chef tending many pots, stirring each briefly in rotation.
- Blocked tasks cost nothing while waiting; when their I/O completes (a device interrupt), they re-enter the ready queue.

The tradeoff: switching is **pure overhead** (µs + cache effects), so more tasks than cores means more switching. Fairness, responsiveness (short quantum = snappier but more overhead), and throughput are balanced by the scheduling policy.

*Concept tested:* time-slicing, the scheduler, the ready queue, context switches, and concurrency-vs-parallelism.

### Q13. Container vs VM — which and why?

Both isolate workloads, but at different layers:

| | Virtual Machine | Container |
|---|---|---|
| Isolates via | hypervisor emulating hardware | kernel **namespaces** + **cgroups** |
| Runs | a full **guest OS** (own kernel) | just the app + libs, **shares host kernel** |
| Boot time | seconds (boot an OS) | milliseconds (start a process) |
| Overhead | heavy (GBs, full OS per VM) | light (MBs, no guest kernel) |
| Isolation strength | **strong** (hardware boundary) | weaker (shared kernel = shared attack surface) |
| Density | fewer per host | many per host |

A **container** is really just Linux processes with restricted views: **namespaces** give each container its own PID/mount/network/user view (it thinks it has its own system), and **cgroups** cap its CPU/memory/I/O. No guest kernel — they all share the host's.

**Choose containers** when you want density, fast startup, and efficient packaging of many services, and you trust the workloads (same tenant/team) — the standard for microservices and CI. **Choose VMs** when you need **strong isolation** — running untrusted or multi-tenant code, different OS kernels (Windows guest on Linux host), or a hard security/compliance boundary. In practice clouds nest both: VMs for tenant isolation, containers inside for packing workloads (Q from Real-World Kernels).

*Concept tested:* OS-level (namespaces/cgroups) vs hardware virtualization and the isolation-vs-efficiency tradeoff.

### Q14. How do two processes share data?

Processes have **separate address spaces**, so they can't just share a variable — they need **IPC**. The main mechanisms, and when to use each:

- **Shared memory** — the OS maps the **same physical pages** into both address spaces; they read/write it directly. **Fastest** (no kernel copy after setup) but you must add your **own synchronization** (semaphores/mutexes) — it's just shared bytes. Use for high-bandwidth data exchange.
- **Pipes / FIFOs** — a unidirectional byte stream; anonymous pipes between parent/child, named FIFOs between unrelated processes. Simple, the kernel handles buffering/sync. Use for streaming/producer-consumer.
- **Message queues** — discrete messages with boundaries preserved, kernel-managed. Use for structured, decoupled messaging.
- **Sockets** — bidirectional streams; work **across machines** (network) as well as locally (Unix domain sockets). Use for client/server and distributed communication.
- **Signals** — tiny asynchronous notifications (just a number, e.g. SIGTERM) — for events/control, not data transfer.
- **Memory-mapped files** (`mmap`) — map a file into both processes' address spaces; share via the file, backed by the page cache.

The tradeoff axis: **shared memory** is fastest but needs manual sync; **pipes/queues/sockets** are safer and sync-free (kernel-mediated copies) but slower; **sockets** alone scale across hosts. Pick by bandwidth, structure, and locality.

*Concept tested:* IPC mechanisms and the speed-vs-safety-vs-reach tradeoff.

### Q15. What's the difference between an interrupt and a system call?

Both switch the CPU into kernel mode, but their **origin and timing** differ fundamentally:

| | System call (trap) | Interrupt |
|---|---|---|
| Source | the **running program** (software) | a **hardware device** (or timer) |
| Timing | **synchronous** — at a known instruction | **asynchronous** — any time |
| Purpose | request a kernel service | notify the CPU of an external event |
| Example | `read()`, `write()`, `open()` | disk done, packet arrived, timer tick, keypress |
| Predictable? | yes — you called it | no — arrives whenever the device is ready |

A **system call** is a **trap** (a *synchronous* exception): your code deliberately executes a trap instruction to enter the kernel and ask for something. It happens exactly where you put it.

An **interrupt** is **asynchronous**: a device raises a signal on the interrupt line, the CPU finishes the current instruction, saves state, and jumps via the **interrupt vector** to the device's handler (ISR) — regardless of what the program was doing. The program is oblivious; it gets paused and resumed.

Both share the mechanism of entering the kernel and using a vector/table, and both are forms of the broader "trap/interrupt" family (synchronous **exceptions/traps** — syscalls and faults — vs asynchronous **interrupts**). The essence: a syscall is *you asking*; an interrupt is the *hardware telling*.

*Concept tested:* synchronous traps vs asynchronous interrupts and the dual-mode entry mechanism.

### Q16. How does the OS stop one buggy program from crashing the whole machine?

Through **isolation and protection**, enforced by hardware the OS configures. Three cooperating mechanisms:

1. **Virtual memory / address-space isolation** — each process gets its **own virtual address space**, and the **MMU** translates its addresses through **its own page table**. A process literally *cannot name* another process's or the kernel's physical memory — an out-of-bounds access resolves to an unmapped page and triggers a fault (**SIGSEGV**), killing only that process. One program's wild pointer can't corrupt another's memory.
2. **Dual-mode operation (user vs kernel)** — the CPU runs apps in **unprivileged user mode**, where dangerous instructions (accessing hardware, changing page tables, disabling interrupts) are **forbidden**. To do anything privileged, the app must go through a **system call** — a controlled kernel entry point where the kernel **validates** the request. A buggy program can't directly touch hardware or other processes; it can only ask the kernel, which checks first.
3. **The kernel as arbiter** — the kernel mediates all resource access (CPU via preemptive scheduling so no process can hog a core, memory via the allocator, devices via drivers) and can **kill** a misbehaving process without affecting others.

So a crash is *contained*: the offending process dies, the kernel reclaims its resources, and everyone else runs on. The boundary is enforced by **hardware** (MMU + privilege rings) that user code can't bypass — that's why software isolation is trustworthy.

*Concept tested:* protection via virtual memory, dual-mode operation, the MMU, and the kernel as trusted arbiter.

### Q17. Tie it together — how would you approach any OS interview question you haven't seen?

A meta-playbook, since interviewers invent scenarios:

1. **Identify the layer.** Is this about a **process or a thread**? **Physical or virtual** memory? **User or kernel** mode? Naming the layer correctly is half the answer and avoids the classic mix-ups.
2. **Find the mechanism.** Most questions reduce to one of a few kernel actions: a **trap** (syscall / page fault / interrupt), a **context switch**, an **MMU translation**, or a **synchronization** primitive. Describe what the CPU/kernel/MMU *actually does*, step by step — a causal trace, not a definition.
3. **Quote the cost.** Anchor with latency intuition — a major fault ≈ a 10ms disk read, a context switch ≈ µs + cold caches, RAM ≈ 100x cache. It shows you reason about *why* something is slow.
4. **For "spot the bug," trace the interleaving.** Write each thread's steps on separate lines and search for an ordering that breaks (lost update = race; circular wait = deadlock). Then name the fix (mutex/atomic for a race; lock ordering for a deadlock).
5. **For "why is it slow," run the USE method.** Localize the saturated resource (CPU/memory/disk/network) before proposing a fix; don't assume it's the CPU.
6. **State the tradeoff.** Every OS decision is a tradeoff (isolation vs sharing, throughput vs latency, generality vs determinism) — naming it signals seniority.

Do these six and you can *derive* an answer to a question you've never seen, at whatever depth the interviewer probes — which is exactly what they're testing.

*Concept tested:* whether you have a transferable model of the OS, not memorized answers.
