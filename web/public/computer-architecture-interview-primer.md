## Architecture Fundamentals & the ISA

### Summary

**What this topic covers**

The bedrock the rest of the primer builds on: what a computer *architecture* actually is, where the hardware/software boundary sits, and the vocabulary — ISA, microarchitecture, word size, registers, addressing — that every later topic (pipelines, caches, memory, out-of-order execution) leans on. The single most important idea here is the **Instruction Set Architecture (ISA)**: the contract between the software that runs on a chip and the silicon that executes it. The ISA is what a compiler targets and what a binary is written in; the *microarchitecture* is a private implementation detail the ISA deliberately hides. Get this distinction crisp and the rest of computer architecture stops feeling like a pile of tricks and starts looking like a stack of well-defined layers. This topic also stakes out the big ISA families you will be asked to compare — x86-64, ARM/AArch64, RISC-V — and the RISC-vs-CISC framing interviewers still love.

**Mental model**

Think of the ISA as an **API for hardware**. Just as a REST API lets clients ignore how the server is built, the ISA lets a binary ignore how the CPU is built: it fixes the instructions, registers, addressing modes, data types, and memory model — the *visible* state and behaviour — while leaving *how* those instructions are carried out to the chip designer. That is why a 2010 Core i5 and a 2024 Ryzen both run the same x86-64 executable despite sharing almost no circuitry: they honour the same contract. Layer the whole system top to bottom: **application → programming language → ISA → microarchitecture → digital logic (gates) → transistors/physics**, each layer talking to its neighbours through a stable interface. The ISA is pivotal because it is the *narrow waist* — the one interface software commits to and hardware must preserve for decades. Change the microarchitecture every year; break the ISA and every binary in the world stops running.

**Key terms**

- **ISA (Instruction Set Architecture)** — the hardware/software contract: the instructions, registers, data types, addressing modes, and memory model visible to a program. Examples: x86-64, AArch64, RISC-V, MIPS, POWER.
- **Microarchitecture (µarch)** — a *specific implementation* of an ISA: pipeline depth, cache sizes, execution ports, branch predictor. Intel Golden Cove and AMD Zen 4 are different µarches of the same x86-64 ISA.
- **Architectural state** — the state the ISA guarantees is visible: general-purpose registers, program counter, flags, architected memory. Everything else (pipeline latches, caches, physical registers) is *microarchitectural* and hidden.
- **RISC** — Reduced Instruction Set Computer: fixed-length, load/store, many registers, simple instructions (ARM, RISC-V, MIPS).
- **CISC** — Complex Instruction Set Computer: variable-length, memory operands, rich addressing, some very complex instructions (x86/x86-64).
- **Micro-op (µop)** — an internal RISC-like operation a modern x86 core decodes complex instructions *into* before executing.
- **Word** — the natural unit of data for the machine, tied to register/ALU width (32-bit or 64-bit today).
- **Register** — a small, named, ultra-fast storage cell inside the CPU; the top of the storage hierarchy.
- **Addressing mode** — how an instruction names its operand (immediate, register, direct, register-indirect, base+index+displacement).
- **von Neumann architecture** — one memory holds both instructions and data on a shared bus.
- **Harvard architecture** — separate instruction and data memories/paths.
- **ABI (Application Binary Interface)** — the software-level conventions layered *above* the ISA (calling convention, stack layout, syscall numbers); an ISA is not enough to link binaries — the ABI pins the rest.

**Why interviewers ask this**

This topic separates candidates who *use* CPUs from those who *understand* them. A junior answer defines RISC vs CISC as "fewer instructions vs more" and stops. A senior answer knows that distinction has largely dissolved at the implementation level — modern x86 decodes CISC instructions into RISC-like µops, and Apple's ARM chips include some genuinely complex instructions — so the real differences today are **decode complexity, code density, and licensing/ecosystem**, not instruction count. Interviewers also probe the ISA/µarch split to check you understand *why* backward compatibility is possible and *why* two chips with wildly different performance can be binary-compatible. It is the concept that makes "the same program runs faster on a newer chip" a precise statement rather than magic. Expect this early, as a warm-up that sets up pipelining, hazards, and caches later.

**Common confusions**

- *ISA = microarchitecture* → No. The ISA is the contract; the microarchitecture is one implementation of it. Many µarches per ISA.
- *RISC always beats CISC* → Not anymore. x86 cracks CISC ops into µops internally, so the *core* is RISC-like; the CISC-ness is mostly a front-end decode cost, offset by better code density.
- *CISC instructions run in one "step"* → A complex x86 instruction may expand into several µops and take many cycles; ISA-level atomicity is not cycle-level simplicity.
- *von Neumann vs Harvard is an either/or in real CPUs* → Modern chips are von Neumann at the ISA/memory level but "modified Harvard" in the caches (split L1I / L1D).
- *A shared ISA means binaries just run* → You also need a matching ABI and OS; same ISA, different ABI (Linux vs Windows) still won't run each other's binaries.

**What follows from this topic**

Everything downstream is the microarchitecture keeping the ISA's promise while going faster: **pipelining** overlaps execution without changing architectural semantics; **hazards and branch prediction** are its cost; **caches** hide the gap between fast registers and slow DRAM; **out-of-order/superscalar** execution reorders µops while preserving the illusion of sequential ISA execution. The load/store discipline and the µop idea both reappear in later topics. The OS-policy side of virtual memory and interrupts, and the software memory model (locks, happens-before), live in the Operating Systems and Concurrency primers — here we meet only the hardware they stand on.

### Q1. What is an ISA, and what does it actually specify?

An **Instruction Set Architecture** is the formal contract a CPU exposes to software — the complete description of the machine as a programmer or compiler sees it. Concretely it specifies: the **instruction set** (opcodes and their semantics), the **register file** (how many general-purpose registers, their width, special registers like PC/SP/flags), the **data types and their widths** (byte/half/word/double, integer and floating-point formats), the **addressing modes** (how operands are located in memory), the **memory model** (byte ordering/endianness, alignment rules, and the ordering guarantees between memory operations), and the **exception/trap model** (how interrupts and faults are delivered). Crucially, it defines the *architectural state* — the registers and memory whose values the hardware must make appear to update exactly as the instruction stream dictates.

What the ISA deliberately does **not** specify is *how* any of this is implemented: pipeline depth, cache hierarchy, clock speed, how many instructions issue per cycle. That freedom is the whole point — it lets one ISA (x86-64) survive from 2003 to today across dozens of radically different chips. The ISA is the stable, slow-moving interface; the microarchitecture underneath churns every product cycle.

### Q2. Draw the abstraction stack from application down to transistors. Why does the ISA sit where it does?

```
  Application software        <- what the user runs
  High-level language / libs  <- C, Rust, JVM bytecode
  ---------------------------
  ISA  (the hardware/SW contract)   <== stable "narrow waist"
  ---------------------------
  Microarchitecture           <- pipeline, caches, predictors
  Register-transfer / logic   <- ALUs, muxes, registers (gates)
  Circuits / transistors      <- CMOS, physics
```

Each layer is implemented in terms of the layer below and offers a clean interface to the layer above, so a change inside one layer doesn't ripple outward. The ISA sits at the **narrow waist** on purpose: it is the one interface that both sides commit to for the long term. Above it, thousands of applications and compilers assume a fixed instruction set. Below it, chip designers reinvent everything freely. Because the contract holds, a decades-old binary still runs on a brand-new core, and a new compiler can target an old chip. Put the stable interface anywhere else and you'd break either binary compatibility (move it up) or design freedom (move it down). This layering is exactly why "abstraction" in architecture is an economic decision, not just tidiness — it's what lets hardware and software evolve independently.

### Q3. Architecture vs microarchitecture — give me a concrete example.

**Architecture (ISA)** is the contract; **microarchitecture** is one implementation of it. The classic example: x86-64 is a single ISA, but Intel's *Skylake*, *Golden Cove*, and AMD's *Zen 3*/*Zen 4* are all different microarchitectures of it. They differ in pipeline length, number of execution ports, reorder-buffer size, cache capacities, and branch-predictor design — yet all run the identical x86-64 instruction stream and produce identical architectural results. That's why you can drop a newer CPU into the same software stack and everything just runs, only faster.

The reverse also happens: *one microarchitecture family, one ISA, many products* (binned by clock and cache). And you can even implement *different ISAs on a shared design philosophy*. The practical test: if a change is visible to a correct program's results, it's architectural (part of the ISA); if it only affects *how fast* the program runs, it's microarchitectural. Cache size is microarchitectural — invisible to correctness, decisive for performance. The number of general-purpose registers is architectural — a program can name them, so it's part of the contract.

### Q4. RISC vs CISC — what's the real distinction, and does it still matter?

The textbook contrast: **CISC** (x86-64) has *variable-length* instructions, allows *memory operands* in arithmetic, offers *rich addressing modes*, and includes some very complex multi-step instructions. **RISC** (ARM/AArch64, RISC-V, MIPS) has *fixed-length* instructions (typically 32-bit, or 16/32 with a compressed extension), is *load/store* (only explicit load/store instructions touch memory; arithmetic works register-to-register), has *many general-purpose registers* (32 in AArch64 and RISC-V vs x86-64's 16), and keeps each instruction simple and regular.

Does it still matter? **Less than it used to, at the execution core.** Modern x86 chips *decode* their CISC instructions into RISC-like **micro-ops** and execute those on a fundamentally RISC-style out-of-order core — so internally, x86 is RISC-ish. Where the distinction genuinely persists:

| Axis | CISC (x86-64) | RISC (AArch64/RISC-V) |
|---|---|---|
| Instruction length | variable (1–15 bytes) | fixed (4 bytes; +2 with compression) |
| Decode | complex, power-hungry front end | simple, cheap, easy to widen |
| Code density | usually tighter | looser (compressed exts help) |
| Registers (GP) | 16 (32 with APX) | 32 |
| Memory operands in ALU ops | yes | no (load/store only) |

So the modern framing: RISC's fixed-length decode makes it **easier to build wide, low-power front ends** (part of why Apple's M-series can decode 8+ instructions/cycle cheaply), while x86's variable-length decode is a persistent power/complexity tax it mitigates with µop caches. It's an implementation-cost story now, not an instruction-count story.

### Q5. Why does x86 decode instructions into micro-ops? Walk me through it.

x86-64 instructions are variable-length (1 to 15 bytes) and some are semantically complex — a single instruction might read memory, do arithmetic, and write memory, or repeat a string operation. Executing such irregular, multi-step instructions *directly* on a fast pipeline would be a nightmare. So the front end **cracks** each architectural instruction into one or more **micro-ops (µops)**: small, uniform, RISC-like operations (a load, an add, a store) that the out-of-order back end can schedule freely.

The flow: **fetch** raw bytes → **length-decode** to find instruction boundaries (the hard, serial part of variable-length ISAs) → **decode** each instruction into µops (simple ones become 1 µop; complex ones may emit several, and truly complex ones invoke a **microcode ROM**) → those µops enter the rename/schedule/execute machinery. Because decode is expensive and repetitive, modern x86 cores add a **µop cache** (decoded-stream buffer) that stores already-decoded µops, letting hot loops skip the decoder entirely and saving significant power. The payoff: the messy CISC contract stays intact for software, while the core enjoys the regularity RISC designs get for free. Some µop fusion even goes the other way — *macro-op fusion* merges a compare-and-branch pair into one µop.

### Q6. von Neumann vs Harvard architecture — and what do real CPUs actually do?

**von Neumann**: a single memory holds *both* instructions and data, reached over one shared bus. Simple and flexible (code is just data, so you can load programs, JIT-compile, self-modify) — but the shared path creates the **von Neumann bottleneck**: instruction fetch and data access contend for the same bus.

**Harvard**: *separate* memories and buses for instructions and data, so you can fetch an instruction and a data word simultaneously. Common in DSPs and microcontrollers where determinism and fetch bandwidth matter.

Real general-purpose CPUs are **von Neumann at the ISA/main-memory level** — one unified address space, code and data live together in DRAM — but **"modified Harvard" in the cache hierarchy**: the L1 is split into a separate **L1 instruction cache** and **L1 data cache** with independent ports, giving Harvard-style parallel access for the hot path, while L2/L3 and DRAM remain unified. So you get von Neumann flexibility (programs are loadable data) *and* Harvard fetch bandwidth (simultaneous I-fetch and D-access) where it counts. This split is also why self-modifying code is expensive: you must flush/sync the I-cache, since it doesn't automatically see stores that landed in the D-cache.

### Q7. What determines a machine's "word size," and what does 64-bit actually buy you?

**Word size** is the machine's natural data unit — tied to the width of the general-purpose registers and the integer ALU. On a 64-bit ISA like x86-64 or AArch64, that's 64 bits: registers are 64 bits wide, native integer ops work on 64-bit values, and pointers are 64 bits. (Beware terminology: on x86 a "word" historically means 16 bits for legacy reasons — `WORD`=16, `DWORD`=32, `QWORD`=64 — a naming fossil, not the machine's actual word size.)

Going 64-bit buys two big things. First, a **larger virtual address space**: 32-bit pointers cap a process at 4 GiB of addressable memory, which real workloads blew past — 64-bit lifts that ceiling astronomically (current hardware implements ~48 or 57 bits of it, still hundreds of terabytes). Second, **wider integer arithmetic** in a single operation (64-bit adds/multiplies without carry juggling). The x86-64 transition also, almost incidentally, **doubled the register count** from 8 to 16 GP registers and added more via the new encoding — a bigger practical win than the width itself, since more registers means fewer stack spills. The cost: pointers are twice as big, so pointer-heavy structures use more cache/memory (which is why x32-style ABIs and pointer compression exist to claw some back).

### Q8. Walk me through the common addressing modes and why they exist.

Addressing modes are the ways an instruction names where its operand lives. The point is to express common access patterns compactly. The staples:

- **Immediate** — the operand is a constant baked into the instruction (`add r1, r1, #4`). Fast, no memory access.
- **Register** — operand is in a register (`add r1, r2, r3`). The RISC default.
- **Direct / absolute** — the instruction carries a full memory address. Rare on RISC (won't fit in a fixed word).
- **Register-indirect** — a register holds the address; the instruction dereferences it (`ld r1, [r2]`). The basis of pointer chasing.
- **Base + displacement** — address = register + constant offset (`ld r1, [r2, #8]`). The workhorse for struct fields and stack locals (`[sp, #16]`).
- **Base + index (+ scale + displacement)** — address = base + index×scale + offset. x86's `[rbx + rsi*8 + 16]` computes an array element `a[i]` in one instruction — great for CISC code density.

This is a sharp RISC/CISC divide: RISC keeps the set small and regular (mostly register, immediate, and base+displacement) so instructions stay fixed-length and decode stays trivial. CISC x86 offers the rich scaled-index mode, which packs array indexing into a single instruction — better code density, more decode complexity. The addressing modes an ISA exposes are part of its *contract* (architectural), so a compiler can rely on them.

### Q9. If the ISA is fixed for decades, how do chips keep getting faster?

Because performance lives almost entirely in the **microarchitecture**, which the ISA leaves unconstrained. The same x86-64 or AArch64 contract has been honoured by chips that got faster through: **higher clock frequency** (process shrinks); **deeper pipelines** and then **superscalar** issue (multiple instructions per cycle); **out-of-order execution** with register renaming to extract instruction-level parallelism; ever-larger, smarter **caches** and **branch predictors**; **SIMD** extensions (SSE→AVX-512, NEON/SVE) for data parallelism; and **more cores**. None of these change what a correct program computes — they only change how fast the architectural state is reached.

The ISA *does* evolve, but additively and slowly: new instruction extensions (AVX, AES-NI, AArch64's SVE) are opt-in, discovered via feature flags, so old binaries keep running while new ones exploit new hardware. That's the discipline the narrow-waist contract enforces: you may *extend* the ISA, but you must not *break* it. This is the precise answer to "why does my program run faster on a new chip without recompiling" — the microarchitecture improved while the contract it implements stayed put.

### Q10. Compare x86-64, AArch64, and RISC-V as ISAs. When would each win?

- **x86-64** — CISC, variable-length, 16 GP registers (32 with APX), dominant in desktops/laptops/servers. Its moat is **the software ecosystem and backward compatibility** — decades of binaries and tooling. Cost: complex, power-hungry variable-length decode. Wins where a mature x86 software base and raw single-thread throughput matter (traditional servers, Windows desktops).

- **AArch64 (ARMv8-A+)** — clean RISC, fixed 32-bit instructions, 32 GP registers, load/store. **Excellent performance-per-watt** and a wide, cheap front end (why Apple's M-series and AWS Graviton do so well). Licensed IP. Wins in mobile, laptops (Apple Silicon), and increasingly cloud servers where efficiency and core density rule.

- **RISC-V** — RISC, fixed/compressed, 32 GP registers, and crucially **an open, royalty-free, modular ISA** (a small base + optional standard extensions). No licensing, fully customizable. Wins in embedded, academia, custom accelerators, and anywhere you want to own the ISA without paying a licensor — its ecosystem is younger but growing fast.

The senior nuance: at the *core* level all three run RISC-style out-of-order engines internally, so the differences that decide real designs are **ecosystem, licensing/openness, decode-front-end power, and code density** — not some intrinsic performance ceiling of the instruction set itself.

### Q11. What's the difference between an ISA and an ABI? Why isn't the ISA enough to run a binary?

The **ISA** defines the instructions and machine state — enough to describe *what a single instruction does*. But a runnable program needs agreement on things the ISA leaves open: **which registers pass function arguments and return values, who saves which registers across a call (caller- vs callee-saved), how the stack is laid out and aligned, how the system-call interface is invoked and how syscalls are numbered, the object-file/executable format, and name-mangling/linking conventions.** That bundle is the **ABI (Application Binary Interface)** — a software-level contract layered *on top of* the ISA.

This is why "same ISA" does not imply "binaries interchange." A Linux x86-64 executable and a Windows x86-64 executable share the ISA but follow different ABIs (System V AMD64 vs Microsoft x64 calling conventions, different syscall mechanisms, PE vs ELF), so they can't run on each other's OS without a translation layer. The ISA is the *hardware* contract; the ABI is the *OS/toolchain* contract. You need both — plus a compatible OS — for a binary to actually execute. Interviewers use this to check you don't conflate "instruction compatibility" with "binary compatibility."

### Q12. The interview one-liner: the topic in one crisp paragraph.

The **ISA is the durable contract between software and hardware** — it fixes the instructions, registers, data types, addressing modes, and memory model that a binary depends on, while the **microarchitecture** is a free-to-change implementation of that contract, which is exactly why decades-old binaries run faster on brand-new chips without recompiling. **RISC vs CISC** (ARM/RISC-V vs x86-64) is now mostly a *decode-cost and code-density* distinction rather than an instruction-count one, because modern x86 cracks its CISC instructions into RISC-like **micro-ops** and runs them on a RISC-style core; real CPUs are **von Neumann** at the ISA level but **modified-Harvard** in their split L1 caches; and to actually run a program you need not just the ISA but a matching **ABI** and OS on top of it. Everything else in computer architecture — pipelining, caches, out-of-order execution — is the microarchitecture keeping the ISA's promise while going as fast as physics allows.


## Number Representation & Computer Arithmetic

### Summary

**What this topic covers**
This topic is about how a CPU stores numbers as fixed-width bit patterns and how its ALU and FPU actually compute with them. Two families dominate: integers (two's complement, fixed width, wraparound on overflow) and floating point (IEEE 754, a windowed scientific notation in binary). We also cover the byte-ordering conventions (endianness) that decide how those words sit in memory, fixed-point as the deterministic middle ground, and the very real performance gap between the integer and floating-point execution pipelines. Everything here is *hardware* semantics — the guarantees the silicon gives you — not the language-level `int`/`float` abstractions layered on top.

**Mental model**
A machine word is `N` bits with no inherent sign or scale — the *interpretation* lives in the instruction you apply, not the bits. Two's complement is the trick that lets one adder serve both signed and unsigned: it maps negatives so that `-x == (~x) + 1`, i.e. the top half of the range "wraps around" to represent negatives, and modular `2^N` arithmetic Just Works for add/sub/mul without a separate signed adder. Floating point is a different bargain entirely: instead of a fixed step of 1, it stores a sign, a binary exponent, and a fractional mantissa, giving you a *sliding* resolution — huge range, but the gaps between representable values grow as the magnitude grows. So integers are exact but bounded and evenly spaced; floats are approximate but span from `~10^-38` to `~10^38` (single) with roughly constant *relative* precision. Nearly every arithmetic bug at the hardware level is a mismatch between which of these two contracts you *thought* you had and which one you actually invoked.

**Key terms**
- **two's complement** — signed encoding where the MSB has weight `-2^(N-1)`; the standard for all mainstream ISAs.
- **sign / zero extension** — widening a value to more bits: replicate the sign bit (signed) or pad with zeros (unsigned).
- **overflow / wraparound** — a result that doesn't fit the width; wraps modulo `2^N`. Sets the carry (unsigned) or overflow (signed) flag on x86.
- **endianness** — byte order of a multi-byte word in memory: little-endian (LSB first, x86/ARM default) vs big-endian (network order).
- **IEEE 754** — the float standard: `binary32` (single), `binary64` (double), plus half/quad.
- **mantissa / significand** — the fractional precision bits; 23 (single) or 52 (double) stored, with an implicit leading 1.
- **exponent bias** — offset (127 single, 1023 double) so the stored exponent is unsigned but represents negatives too.
- **denormal / subnormal** — exponent field all-zero; fills the gap between 0 and the smallest normal, at reduced precision.
- **NaN / ±inf** — exponent all-ones; encodes "not a number" and signed infinities.
- **ULP** — Unit in the Last Place: the gap between adjacent representable floats at a given magnitude.
- **fixed-point** — integers with an implied binary scaling factor; deterministic fractional arithmetic.
- **catastrophic cancellation** — subtracting two near-equal floats, annihilating the significant bits and exposing rounding error.

**Why interviewers ask this**
It's a fast senior/junior separator. A junior recites "two's complement is how negatives are stored" and "floats are imprecise." A senior explains *why* two's complement won (one adder, one zero, no `-0`), can derive `-5` in 8 bits on the spot, knows signed overflow is *undefined behaviour* in C while unsigned is defined wraparound, and can say precisely why `0.1 + 0.2 != 0.3` (0.1 is a repeating binary fraction). In systems, embedded, finance, graphics, and ML roles this is load-bearing: it's the difference between a monetary rounding bug shipping to prod, an integer-overflow security hole (CVE-grade), and a numerically stable algorithm. Interviewers also probe it as a proxy for whether you understand that abstractions leak — that `float` is not "a number."

**Common confusions**
- "Signed overflow wraps like unsigned" → in C it's *undefined behaviour*; the compiler may assume it never happens and optimise accordingly. The *hardware* wraps, the *language* does not promise it.
- "Denormals are just very small floats" → they trade precision for range near zero and can be 10–100x slower (microcode/trap) unless flush-to-zero is enabled.
- "NaN == NaN" → false; NaN is unordered, so `x != x` is the canonical NaN test.
- "Endianness affects arithmetic" → no; it only affects how bytes are laid out in memory / on the wire, not register-level math.
- "Fixed-point is just int" → it's int *plus an implied scale*; you must shift after multiply.

**What follows from this topic**
Two's complement and word width set up the ALU and datapath discussion (how the adder and flags feed branches and the pipeline), and endianness resurfaces in the memory-hierarchy and I/O topics. Floating-point latency motivates the pipelining and superscalar topics — FP ops are deep, multi-cycle, and pipelined precisely because they're expensive. The exactness-vs-range tradeoff also underlies the SIMD/vector discussion, where packing many narrow integers or floats into one register is the whole game. Overflow and the signed/unsigned distinction connect straight to the OS/security material on integer-overflow vulnerabilities (whose software-mitigation side lives in the OS primer).

### Q1. Why did two's complement beat sign-magnitude and one's complement?

Three encodings can represent signed integers, but two's complement won decisively on hardware simplicity:

- **Sign-magnitude** (top bit = sign, rest = magnitude): intuitive, but has two zeros (`+0`, `-0`) and needs *separate* add/subtract logic depending on signs.
- **One's complement** (negate = flip all bits): also has `+0`/`-0`, and addition needs an "end-around carry."
- **Two's complement** (negate = flip bits `+ 1`): **one** representation of zero, and — the killer feature — the *same* binary adder computes both signed and unsigned addition/subtraction correctly, because everything is arithmetic modulo `2^N`.

Concretely in 8 bits: `+5 = 0000_0101`, `-5 = 1111_1011` (flip to `1111_1010`, add 1). Add them: `0000_0101 + 1111_1011 = 1_0000_0000`; the carry falls off the top and you get `0`. No special-casing, no negative zero. The range is asymmetric: `-128 … +127` (`-2^(N-1) … 2^(N-1)-1`), which is why `abs(INT_MIN)` overflows — there's no `+128`.

### Q2. Walk me through sign extension vs zero extension and when each is used.

When you widen a value into a larger register (say 8-bit → 32-bit), you must fill the new high bits:

- **Zero extension**: pad with zeros. Correct for **unsigned** values. `0xFF` (255) → `0x000000FF` (still 255).
- **Sign extension**: replicate the **sign bit**. Correct for **two's-complement signed** values. `0xFF` (-1 as int8) → `0xFFFFFFFF` (-1 as int32).

The bit pattern `0xFF` is *the same*; only the interpretation and hence the extension differ. x86-64 exposes this directly: `MOVZX` (move with zero extend) vs `MOVSX` (move with sign extend). A classic bug: loading a `signed char` and treating it unsigned, or vice versa — e.g. reading a byte `0x80` and getting `128` when you meant `-128`. Also note x86-64 quirk: 32-bit register writes *zero*-extend into the full 64-bit register automatically, but 8/16-bit writes do *not*, which trips people up.

### Q3. What exactly happens on integer overflow, and how does hardware signal it?

The result exceeds the width and wraps **modulo `2^N`**. In 8-bit unsigned: `255 + 1 = 0`. In 8-bit signed: `127 + 1 = -128`. The ALU computes the same bits either way; two condition flags distinguish the cases on x86:

- **Carry Flag (CF)** — set when *unsigned* result overflowed (carry out of the MSB).
- **Overflow Flag (OF)** — set when *signed* result overflowed (sign of result is wrong given operand signs).

The hardware always wraps deterministically. The *language* may not: in C, **unsigned overflow is defined** (wraps), but **signed overflow is undefined behaviour** — compilers exploit this, e.g. assuming `i + 1 > i` always holds to optimise loops, which can delete your overflow check. This is a real security surface: an unchecked `len + offset` overflow leading to a short allocation and heap overflow is a canonical CVE pattern. Mitigations: `-fwrapv`, `__builtin_add_overflow`, or checked arithmetic.

### Q4. Explain endianness and where it actually bites.

Endianness is the order in which the bytes of a multi-byte word are stored in memory (or transmitted). Take the 32-bit value `0x12345678`:

```
address:      +0    +1    +2    +3
little-endian: 78    56    34    12    (LSB at lowest address)
big-endian:    12    34    56    78    (MSB at lowest address)
```

x86-64 and (in practice) ARM/AArch64 are little-endian; big-endian is called "network byte order" because TCP/IP headers use it — hence `htonl`/`ntohl`. It **only matters at byte-granularity boundaries**: serialization, network protocols, binary file formats, casting a `uint8_t*` over a `uint32_t`, or DMA. Register-level arithmetic is endian-agnostic — the ALU sees the value, not the byte layout. Bi-endian CPUs (some ARM, POWER) can switch. A frequent bug: `memcpy`-ing a struct to disk on a little-endian box and reading it on a big-endian one, or vice versa — always serialize to a defined byte order.

### Q5. Lay out the IEEE 754 single-precision format field by field.

`binary32` is 32 bits: `[ sign : 1 ][ exponent : 8 ][ mantissa : 23 ]`. Value (for normalized numbers) is:

```
(-1)^sign  ×  1.mantissa (binary)  ×  2^(exponent - 127)
```

- **sign** — 1 bit, 0 = positive.
- **exponent** — 8 bits, stored with **bias 127** so it encodes roughly `-126 … +127` without a separate sign. All-zeros and all-ones are reserved (see below).
- **mantissa** — 23 stored bits, but there's an **implicit leading 1** for normalized numbers, giving 24 bits of precision (~7 decimal digits).

The reserved exponent codes carry the special values: **exponent = 0** → zero (mantissa 0) or **denormal** (mantissa ≠ 0, no implicit 1, fills the gap near zero); **exponent = all-ones (255)** → **±infinity** (mantissa 0) or **NaN** (mantissa ≠ 0). `binary64` (double) is the same shape scaled up: 1 / 11 / 52 bits, bias 1023, ~15–16 decimal digits, range ~`10^±308`.

### Q6. Why isn't 0.1 exact, and why does 0.1 + 0.2 != 0.3?

Because IEEE 754 is **binary** floating point, and `0.1` is `1/10` — a fraction whose denominator has a factor of 5, so in base 2 it's a *non-terminating repeating* fraction: `0.0001100110011…₂`. The mantissa has finite width (52 bits for double), so `0.1` is rounded to the nearest representable value, `≈ 0.1000000000000000055511151…`. Same for `0.2`. Their stored approximations sum to a value that rounds to `0.30000000000000004`, which is a *different* representable double than the rounded `0.3`. Hence the classic `0.1 + 0.2 == 0.3` → **false**.

The rule of thumb: a decimal fraction is exactly representable in binary FP only if its denominator is a power of two (`0.5`, `0.25`, `0.75` are exact; `0.1`, `0.2`, `0.3` are not). This is *not* a language bug — it's inherent to base-2 representation, and Python, JS, Java, C all do it.

### Q7. What are the IEEE 754 rounding modes, and why do they matter?

When a result can't be represented exactly, the FPU rounds per the current mode. The four (five) standard modes:

- **Round to nearest, ties to even** (RNE) — the default; on an exact tie, round to the even last digit. Chosen because it's unbiased (ties don't systematically round up, avoiding drift over many operations).
- **Round toward zero** (truncate) — used for float→int conversion in C.
- **Round toward +∞** (ceiling).
- **Round toward −∞** (floor).

Directed rounding (up/down) is essential for **interval arithmetic** and provably-correct bounds. RNE matters because naive "round half up" accumulates a positive bias — over a billion operations that bias becomes visible error. Every basic op (`+ − × ÷ √`) in IEEE 754 is **correctly rounded**: the result is *as if* computed to infinite precision then rounded once. This is what makes float behaviour portable and reasoned-about, despite the imprecision.

### Q8. What is catastrophic cancellation and how do you avoid it?

Catastrophic cancellation is the loss of significant digits when you **subtract two nearly-equal floating-point numbers**. Each operand already carries rounding error in its low bits; when you subtract, the leading equal digits cancel to zero and what's left is dominated by that error — you can go from ~16 significant digits to 1 or 0.

Worked example: computing `x = 1 - cos(θ)` for tiny `θ`. Say `cos(θ) = 0.9999999983`; subtract from 1 and you get `1.7e-9`, but only the *first few* digits are trustworthy — the rest is noise from `cos`'s rounding. Fixes:

- **Reformulate algebraically**: use the identity `1 - cos θ = 2 sin²(θ/2)`, which computes the small quantity directly without subtracting near-equal terms.
- The quadratic formula's classic fix: when `b² ≫ 4ac`, `(-b + √(b²-4ac))` cancels — compute the stable root via the product-of-roots relation instead.

The general lesson: exactness isn't lost by the subtraction itself (subtraction of nearby values is exact — Sterbenz's lemma); it's *exposed* — the error was already there, cancellation just removes the digits that were hiding it.

### Q9. Why is comparing floats with `==` a trap, and what should you do instead?

Because two mathematically-equal computations can yield *different* bit patterns due to rounding, operation ordering, or FP contraction (FMA). `0.1 + 0.2 == 0.3` is `false`. So exact `==` on computed floats is almost always a bug. Also NaN breaks the usual contract entirely: **`NaN == NaN` is false**, and *every* comparison with NaN returns false, so `x != x` is the idiomatic NaN test, and a naive `if (x == y)` silently mis-handles NaN.

The correct approach is **tolerance-based comparison**:
- **Absolute tolerance**: `|a - b| < ε` — fine near zero, wrong at large magnitudes (where 1 ULP already exceeds a fixed ε).
- **Relative tolerance**: `|a - b| <= ε * max(|a|, |b|)` — scale-invariant, but degenerate near zero.
- **ULP comparison**: reinterpret the bits as integers and check they're within `N` ULPs — robust but fiddly.

Practically: use a *combined* absolute-and-relative check (e.g. `isclose` in Python/`Math.ulp` reasoning in Java), and never `==` unless you're comparing to an exactly-representable constant like `0.0`.

### Q10. When would you use fixed-point instead of floating-point?

Fixed-point stores fractional values as plain integers with an **implied binary scaling factor** (a fixed number of fractional bits). A `Q16.16` value is a 32-bit int where the low 16 bits are the fraction: to store `3.5` you store `3.5 × 2^16 = 229376`. Addition/subtraction are just integer add/sub; **multiplication needs a shift** afterward (`(a * b) >> 16`) because the scales multiply.

Use it when you want **determinism and exactness at a fixed scale** and either lack cheap FP hardware or can't tolerate FP's variable rounding:

- **Money**: represent cents (or micro-units) as integers — no `0.1` rounding surprises. Databases use `DECIMAL`; languages offer `BigDecimal`.
- **Embedded / DSP without an FPU**: fixed-point is far cheaper than software-emulated float.
- **Deterministic simulation / lockstep multiplayer**: FP results can differ across CPUs/compilers; integer fixed-point is bit-identical everywhere.

The costs: limited range (overflow is a real risk — a `Q16.16` multiply overflows an int32, so you promote to int64 intermediate), manual scale bookkeeping, and no free dynamic range. It's exactness and portability bought with range and convenience.

### Q11. How does integer arithmetic compare to floating-point in throughput and latency?

Integer ops are the cheapest thing the CPU does; FP ops are deeper and pipelined. Representative modern x86-64 (Intel/AMD, order-of-magnitude — exact figures vary by microarchitecture):

| Operation | Latency (cycles) | Throughput (per cycle) |
|---|---|---|
| Integer add/sub/bitwise | 1 | 3–4 |
| Integer multiply (64-bit) | 3–4 | 1 |
| Integer divide | 20–90 | very low (not pipelined) |
| FP add/mul (scalar/SIMD) | 3–5 | 2 |
| FMA (fused multiply-add) | 4–5 | 2 |
| FP divide / sqrt | 10–20+ | low (not fully pipelined) |

Key points: **add is ~1 cycle; division (int *or* FP) is the expensive outlier** and often not pipelined, so back-to-back divides stall — compilers turn `x / constant` into multiply-by-reciprocal to avoid it. FP add/mul have *higher latency* than integer add (multi-cycle) but are **fully pipelined**, so throughput is high if you have independent work to fill the pipeline. **FMA** computes `a*b + c` with a *single* rounding and same latency as a bare multiply — it's the workhorse of dense linear algebra and ML kernels, effectively doubling FLOP throughput. And **SIMD** (SSE/AVX/NEON) packs 4/8/16 lanes per instruction, so real throughput is per-op-count × lane-count. The takeaway for hot loops: avoid division, expose independent operations to hide latency, and use FMA/SIMD.

### Q12. The interview one-liner: number representation in one crisp paragraph.

Computers store numbers as fixed-width bit patterns whose meaning comes from the instruction, not the bits: **two's complement** integers are exact, evenly spaced, and wrap modulo `2^N` on overflow (one adder serves signed and unsigned, one zero, negate = flip-plus-one) — while **IEEE 754** floats trade exactness for range by storing a sign, a biased binary exponent, and a fractional mantissa, giving constant *relative* precision but growing absolute gaps, non-representable decimals like `0.1`, reserved patterns for `±inf`/`NaN`/denormals, and the hazards of catastrophic cancellation and `==`; endianness only reorders bytes in memory, fixed-point buys determinism at a fixed scale, and at the pipeline level integer add is ~1 cycle while division and deep FP ops are the costly, hard-to-pipeline outliers you design hot loops around.


## The CPU Datapath & Pipelining

### Summary

**What this topic covers**

How a processor actually *executes* an instruction, and the single most important trick for making it fast: overlap. The **datapath** is the collection of hardware that carries an instruction from fetch to retire — the register file, the ALU, the memory ports, and the muxes and wires that route data between them, all steered by the **control** logic decoded from the opcode. A naïve **single-cycle** machine does the whole journey for one instruction before touching the next. **Pipelining** breaks that journey into stages and runs a different instruction in each stage simultaneously, the way a car assembly line has a different car at each station. This topic covers the classic MIPS/RISC-V **5-stage pipeline** (IF, ID, EX, MEM, WB), the difference between **latency** and **throughput**, why pipelining lets you crank the clock *and* approach one instruction per cycle, the **CPI**/performance equation you use to reason about all of it, and the tradeoffs of making the pipeline deeper. The reasons pipelines *stall* — hazards — are named here but developed in the next topic.

**Mental model**

A single-cycle CPU is one worker who fetches a part, machines it, inspects it, boxes it, and only *then* starts the next — the clock has to be long enough for the slowest possible instruction (a load that reads registers, computes an address, hits memory, and writes back). A pipeline is an assembly line: five workers, each owning one station, each holding a *different* instruction in the same cycle. Latency per instruction doesn't improve — an instruction still visits all five stations. But **throughput** does: once the pipe is full, one instruction *completes every cycle* instead of every five. And because each stage now does only 1/5 of the work, the clock period shrinks to the slowest single stage, so the clock frequency rises. The line only wins when it stays full and balanced: a stall anywhere inserts a bubble that ripples downstream, and an unbalanced stage (one that takes longer than the rest) sets the clock for everybody.

**Key terms**

- **Datapath** — the functional units and interconnect (register file, ALU, memory ports, muxes) that transform instruction inputs into results.
- **Control** — logic that decodes the opcode into the signals steering the datapath (ALU op, mux selects, write enables).
- **5 stages** — **IF** (instruction fetch), **ID** (decode + register read), **EX** (ALU / address calc), **MEM** (data-cache access), **WB** (write-back to register file).
- **Pipeline register** — the latch between two stages that carries an instruction's in-flight state forward each cycle (IF/ID, ID/EX, EX/MEM, MEM/WB).
- **Latency** — time for one instruction to traverse the whole pipe (still ~5 cycles).
- **Throughput** — instructions completed per unit time; the metric pipelining improves (ideally 1 per cycle).
- **CPI / IPC** — cycles per instruction and its reciprocal, instructions per cycle; the ideal scalar pipeline targets CPI = 1 (IPC = 1).
- **Performance equation** — `Time = Instructions × CPI × Clock-period` (the "iron law"); the three levers architects trade against each other.
- **Pipeline depth** — number of stages; deeper stages are shorter, so clock is higher, but the misprediction/flush penalty grows.
- **Bubble / stall** — a wasted cycle injected when an instruction can't advance (raises effective CPI above 1).
- **Hazard** — a reason a stall is needed (structural, data, control) — the subject of the next topic.
- **Superscalar** — issuing more than one instruction per cycle to push IPC above 1 (later topic).

**Why interviewers ask this**

Pipelining is *the* dividing line between someone who memorized "CPUs are fast" and someone who understands *why*. A junior recites "IF ID EX MEM WB." A senior can explain that pipelining doesn't reduce per-instruction latency — it trades latency for throughput — and can drive the performance equation to argue about a real change: "does this optimization cut instruction count, lower CPI, or raise clock, and what does it cost the other two?" It's the mental scaffold under every downstream topic — branch prediction exists because of pipeline flushes, out-of-order exists to keep CPI near 1, caches matter because a MEM-stage miss stalls the whole pipe. Interviewers also probe it because the reasoning ("throughput vs latency," "the slowest stage sets the clock") transfers directly to distributed systems and request pipelines.

**Common confusions**

- *"Pipelining makes each instruction faster"* → No — an individual instruction takes the same or slightly *longer* wall-clock time (register overhead); the win is that many are in flight, so throughput rises.
- *"A 5-stage pipeline is 5× faster"* → Ideal speedup ≈ depth, but pipeline-register overhead, unbalanced stages, and stalls erode it; real gains are well under 5×.
- *"Higher clock = faster CPU"* → Only if CPI and instruction count hold. A deeper pipe raises clock but can raise CPI (bigger flush penalty), sometimes netting *slower* — the Pentium 4 lesson.
- *"CPI is a constant"* → It's an average over a program; cache misses, mispredicts, and dependencies pull it well above the ideal 1.0.

**What follows from this topic**

Everything downstream is about protecting the one-instruction-per-cycle ideal this topic sets up. The very next topic — **hazards and forwarding** — explains why the pipe can't naïvely run and how bypassing, stalling, and branch prediction recover throughput. From there, **superscalar and out-of-order execution** push IPC above 1, and the **memory hierarchy** exists largely so the MEM stage rarely stalls the whole line.

### Q1. Walk me through the classic 5-stage pipeline. What happens in each stage?

Take a RISC-V/MIPS-style load:

- **IF (Instruction Fetch)** — read the instruction at the PC from the instruction cache; compute PC+4.
- **ID (Instruction Decode / register read)** — decode the opcode, generate control signals, read up to two source registers from the register file, sign-extend any immediate.
- **EX (Execute)** — the ALU does the work: an arithmetic op, or for a load/store it computes the effective address `base + offset`; for a branch it evaluates the condition and target.
- **MEM (Memory access)** — data-cache access: loads read, stores write. Non-memory instructions idle here (they just pass through).
- **WB (Write-back)** — write the ALU result or the loaded value back into the destination register.

Between each pair of stages sits a **pipeline register** (IF/ID, ID/EX, …) that latches the instruction's operands, control signals, and PC so the next stage has everything it needs the following cycle. In steady state five instructions occupy the five stages at once:

```
cycle:   1    2    3    4    5    6    7
i1:      IF   ID   EX   MEM  WB
i2:           IF   ID   EX   MEM  WB
i3:                IF   ID   EX   MEM  WB
```

By cycle 5 the pipe is full and one instruction retires every subsequent cycle.

### Q2. Single-cycle vs pipelined datapath — what actually changes?

A **single-cycle** datapath executes one complete instruction per clock. Its clock period must cover the *longest* instruction's whole path. In the canonical MIPS example that's a load: I-mem read + register read + ALU + D-mem read + register write ≈ 200+ ps summed across every unit. Every instruction — even a fast register-to-register add — pays that worst-case period, so the machine is slow and the hardware sits mostly idle (the ALU is unused while memory is being read, etc.).

**Pipelining** keeps the *same* datapath hardware but inserts latches to split it into five stages, then lets each stage work on a different instruction. Now the clock period is set by the *slowest single stage* (say ~200 ps rather than the ~800 ps sum), and every functional unit is busy every cycle. Latency per instruction is unchanged (or slightly worse, because of the latch delay you added at each boundary), but throughput jumps toward 5×. The tradeoff is complexity: you need pipeline registers, hazard detection, and forwarding — none of which the single-cycle machine needed.

There's a middle historical design, the **multi-cycle** datapath, which breaks the instruction into cycles to reuse one ALU and one memory port and shorten the clock — but it still finishes one instruction before starting the next, so it wins on hardware cost, not throughput. Pipelining is the design that overlaps.

### Q3. Distinguish latency from throughput in a pipeline. Which does pipelining improve?

**Latency** is how long one instruction takes end to end; **throughput** is how many complete per unit time. Pipelining improves **throughput**, not latency. An instruction still traverses all five stages, so its latency is ~5 cycles (and technically a hair worse than an unpipelined version because each stage boundary adds latch setup/propagation delay). What changes is that once the pipe is full, instructions *retire* one per cycle rather than one per five.

The assembly-line intuition: adding stations to a car factory doesn't build any single car faster — each car still visits every station — but the factory ships far more cars per hour. This distinction is the single most common interview trap on the subject, and it generalizes: any pipeline (CPU, GPU, a web request path, a data ETL) trades per-item latency for aggregate throughput, and you should be explicit about which one your workload cares about.

### Q4. Why does pipelining let you raise the clock frequency AND improve IPC?

Two independent wins, and it's worth keeping them separate.

**Clock frequency** rises because the clock period is bounded by the slowest *stage*, not the whole instruction. Cut the work per stage into 1/5, and (ignoring latch overhead) the minimum period drops ~5×, so frequency rises ~5×. This is a *clock-period* win in the performance equation.

**IPC** (equivalently, lower CPI) improves because of *overlap*: an unpipelined machine has CPI = 1 but a huge clock period; naïvely you might think overlap doesn't change CPI. The real framing is against a **multi-cycle** baseline where each instruction takes, say, 4–5 cycles (CPI ≈ 4–5). Pipelining overlaps those cycles so that, in steady state, one instruction completes per cycle — CPI drops toward 1 while the short clock period is retained. So relative to a multi-cycle design you win on *both* CPI and clock simultaneously; relative to single-cycle you win purely on clock. Either way the product `CPI × clock-period` shrinks dramatically. The catch is the ideal CPI = 1 is only reachable if hazards don't force stalls — which is what the next topic is about.

### Q5. State the CPU performance equation and use it.

The "iron law" of processor performance:

```
CPU time = Instruction_count × CPI × Clock_period
         = (Instructions × CPI) / Clock_frequency
```

Three levers, and almost every architectural decision moves one at the expense of another:

- **Instruction count** — set by the ISA and compiler. CISC does more per instruction (fewer instructions), RISC does less per instruction (more, but simpler and pipelineable).
- **CPI** — set by the microarchitecture. Pipelining, forwarding, and branch prediction push it toward 1; superscalar pushes IPC above 1; cache misses and mispredicts push it back up.
- **Clock period** — set by circuit design and pipeline depth. Deeper pipe → shorter period → higher frequency.

Worked example: a program runs 1e9 instructions at CPI 1.2 on a 3 GHz core → `1e9 × 1.2 × (1/3e9 s) = 0.4 s`. Now suppose a deeper pipeline raises the clock to 4 GHz but, because of a bigger branch-flush penalty, CPI climbs to 1.8: `1e9 × 1.8 / 4e9 = 0.45 s` — *slower*, despite the higher clock. That's exactly why "more GHz" isn't automatically faster, and why you always reason about all three terms together.

### Q6. If a 5-stage pipeline gives ~5× speedup in theory, why not in practice?

Four leaks:

1. **Fill and drain.** The first instruction still needs 5 cycles before anything retires, and the pipe empties at the end. Over N instructions the ideal is `N + 4` cycles, so speedup only approaches depth as N → ∞. For short bursts (and after every flush) the overhead is significant.
2. **Unbalanced stages.** Speedup = depth only if all stages take equal time. If one stage is slower, it sets the clock for all, so you can't shorten the period as much as depth suggests. Real pipelines fight to balance stage delays.
3. **Pipeline-register overhead.** Each latch adds setup + clk-to-Q delay (tens of ps). With 5 stages that's tolerable; with 20 it becomes a meaningful fraction of the (now tiny) stage delay, so the marginal return on depth falls.
4. **Stalls from hazards.** Data dependencies, unresolved branches, and structural conflicts inject bubbles that raise effective CPI above 1. A branch mispredict on a 5-stage pipe might waste 2–3 cycles; on a deep modern pipe, 15–20.

Net: realistic 5-stage designs deliver something well short of 5× — call it 3–4× against unpipelined — and the gap widens as you go deeper.

### Q7. What's the tradeoff in making the pipeline deeper (superpipelining)?

Deeper = more, shorter stages = shorter clock period = higher frequency. That's the upside, and it's why the Pentium 4 "Willamette/Prescott" line pushed to 20 then 31 stages chasing marketing GHz.

The downsides scale with depth:

- **Misprediction penalty grows.** When a branch is predicted wrong, every instruction fetched behind it must be flushed. The number flushed is roughly the number of stages between fetch and branch resolution — so a deeper pipe throws away *more* work per mispredict. Prescott's ~31 stages meant a mispredict cost ~30+ cycles; that's why it needed a very accurate predictor just to break even.
- **Forwarding and hazard logic get more complex** — more stages means more bypass paths and longer dependency chains, so stalls are more likely and more expensive.
- **Latch overhead** eats a rising share of each (shorter) stage, giving diminishing frequency returns.
- **Power** rises roughly with frequency (and voltage), which is what actually killed the deep-pipe race — the industry pivoted to wider (superscalar) and *multi-core* around 2005 rather than deeper.

Modern high-performance cores (Intel Golden Cove, Apple's cores, AMD Zen) sit around 14–20 pipeline stages — a deliberately moderate depth that balances clock against flush cost, paired with heavy branch prediction and wide out-of-order execution.

### Q8. Name the classes of pipeline hazard — but keep it brief; the next topic owns them.

Three classes, each a reason an instruction can't advance and a bubble must be inserted:

- **Structural hazard** — two instructions want the *same hardware resource* in the same cycle (e.g. a single memory port needed by IF and MEM at once). Solved by duplicating resources (split I-cache/D-cache).
- **Data hazard** — an instruction needs a result a still-in-flight earlier instruction hasn't written back yet (a read-after-write dependency). Mitigated by **forwarding/bypassing** and, when unavoidable (load-use), a stall.
- **Control hazard** — a branch changes the PC, but instructions after it were already fetched before the outcome is known; a wrong guess forces a **flush**. Mitigated by branch prediction.

That's the taxonomy — the mechanisms (forwarding paths, load-use interlocks, predictors, flush logic) are the entire subject of the following topic.

### Q9. How does a pipeline "flush" work, and what does it cost?

A **flush** discards instructions already in the pipeline that turn out to be wrong-path — most commonly after a mispredicted branch, but also on exceptions/traps. Mechanically, the control logic asserts a signal that turns the affected pipeline registers into **NOPs** (bubbles): their control signals are cleared so they can't write registers or memory, and they drain harmlessly. The correct PC is loaded into IF and fetching resumes down the right path.

The cost is the number of cycles of work thrown away, which equals roughly the distance (in stages) from fetch to where the branch resolved. On the classic 5-stage pipe, if branches resolve in EX (stage 3), a mispredict wastes ~2 cycles. On a modern 15–20-stage out-of-order core, a mispredict can cost 15–20 cycles — which, at IPC ~4, is *60–80 instructions* of lost issue slots. That enormous relative cost is precisely why branch predictors in modern cores hit >95–99% accuracy: at deep pipelines and high IPC, every wrong guess is ruinous, so prediction stops being an optimization and becomes a necessity.

### Q10. Worked example: compute throughput for single-cycle vs pipelined.

Assume stage delays: IF 200 ps, ID 100 ps, EX 200 ps, MEM 200 ps, WB 100 ps (sum = 800 ps).

**Single-cycle:** clock period must cover the whole path = 800 ps → 1.25 GHz. One instruction per cycle → throughput = 1.25e9 instr/s, latency 800 ps.

**Pipelined:** clock period = slowest stage = 200 ps → 5 GHz. After fill, one instruction retires per cycle → throughput ≈ 5e9 instr/s (4× the single-cycle machine, not 5×, because the slowest stage is 200 ps not the 160 ps a perfectly balanced 800/5 split would give — the *unbalanced-stage* penalty in action). Latency per instruction is now 5 × 200 = 1000 ps — *worse* than the single-cycle 800 ps.

That's the whole story in numbers: **4× the throughput, but each instruction is slightly slower to complete.** If your workload is a long stream of independent instructions, you take the 4× gladly; if it's a single latency-critical dependent chain, pipelining bought you nothing and cost you a little.

### Q11. Where do the register file's read and write happen, and why does the timing matter?

Register reads happen in **ID**, register writes in **WB** — stages 2 and 5. That three-stage gap is the root of most data hazards: an instruction that reads a register in ID may need a value that a preceding instruction won't write until its WB, several cycles later.

One classic microarchitectural trick softens this: the register file is designed to **write in the first half of a cycle and read in the second half**. That way an instruction writing back in WB and a younger instruction reading the *same* register in ID *in the same cycle* work correctly — the write lands before the read samples it. This "write-then-read" register file removes one cycle of stall for free, without any forwarding path. It's a small detail, but a favorite senior follow-up because it shows you understand that clock *phases* — not just cycle boundaries — are part of the design toolkit. Everything the half-cycle trick can't cover is handled by forwarding and interlocks in the next topic.

### Q12. The interview one-liner: the CPU datapath and pipelining in one crisp paragraph.

The datapath is the hardware road an instruction travels — fetch, decode/read-registers, execute, memory, write-back — and a single-cycle machine drives one instruction down the whole road before starting the next, forcing the clock to be as slow as the worst-case instruction. Pipelining latches the road into stages so a different instruction occupies each stage every cycle: per-instruction *latency* barely changes, but *throughput* rises toward one instruction per cycle while the clock speeds up (it's now bounded by the slowest single stage, not the whole path). You reason about all of it with the iron law — `time = instructions × CPI × clock-period` — where pipelining drives CPI toward the ideal 1 and shortens the clock, and where deeper pipelines buy higher frequency at the cost of a larger flush penalty on every branch mispredict. Everything downstream — forwarding, branch prediction, superscalar, caches — exists to defend that one-instruction-per-cycle ideal against the hazards that would stall the line.


## Pipeline Hazards & Forwarding

### Summary

**What this topic covers**

A pipeline overlaps the execution of consecutive instructions so that, ideally, one finishes every cycle. Hazards are the situations where that ideal breaks: cases where the next instruction *cannot* execute in the following clock cycle because the hardware isn't ready, the data isn't ready, or we don't yet know which instruction is next. This topic is the counterpart to the pipelining topic that precedes it — pipelining is the win, hazards are the tax, and the mechanisms here (forwarding, stalls, and the motivation for branch prediction) are how real CPUs claw the win back. We cover the three hazard classes — **structural**, **data**, and **control** — the RAW/WAR/WAW dependency taxonomy, why WAR and WAW are "name" hazards that register renaming eliminates, forwarding/bypassing, the one data hazard forwarding *can't* fully hide (the load-use hazard), bubbles and stalls, the historical MIPS branch delay slot, and how the cost of control hazards is what makes branch prediction (the next topic) worth building.

**Mental model**

Think of the classic 5-stage pipeline — **IF, ID, EX, MEM, WB** — as an assembly line where an instruction moves one station per cycle. A hazard is anything that forces a station to sit idle. There are exactly three reasons a station stalls. **Structural**: two instructions want the same physical resource in the same cycle (one memory port, one write port). **Data**: an instruction needs a value a still-in-flight predecessor hasn't written back yet. **Control**: a branch hasn't resolved, so we don't know which instruction should enter IF next. The key insight for data hazards is that the *result usually exists* deep in the pipeline (sitting in the EX/MEM latch) cycles before it is written to the register file — so instead of stalling, we build wires that **forward** it straight to the consuming ALU input. Forwarding turns most data hazards into zero-cost. The exceptions — load-use and unresolved branches — are exactly where the pipeline must insert **bubbles** (injected no-ops) or speculate.

**Key terms**

- **Hazard** — a condition that prevents the next instruction from executing in the next cycle without a wrong result.
- **Structural hazard** — two instructions contend for the same hardware unit in one cycle; fixed by duplicating the resource (separate I- and D-memory ports).
- **Data hazard** — an instruction depends on a result not yet available in the register file.
- **RAW (read-after-write)** — a *true* data dependency; consumer reads a register the producer hasn't written. The only hazard forwarding must handle.
- **WAR / WAW (write-after-read / write-after-write)** — *name* (false) dependencies; they only exist because two instructions reuse the same register name. Register renaming dissolves them.
- **Forwarding / bypassing** — routing a result from a pipeline latch (EX/MEM, MEM/WB) directly to a later instruction's ALU input, skipping the register file.
- **Load-use hazard** — a load feeding the very next instruction; the loaded value isn't ready until end of MEM, forcing exactly one stall even with forwarding.
- **Bubble / stall** — a cycle where a no-op is injected and downstream stages idle; costs one cycle of throughput.
- **Control (branch) hazard** — the pipeline fetches past a branch before knowing its outcome/target.
- **Delay slot** — an ISA-exposed instruction slot after a branch that always executes, hiding the branch latency (historical, MIPS/SPARC).
- **Register renaming** — mapping architectural registers to a larger physical register file so WAR/WAW disappear; core to out-of-order CPUs.

**Why interviewers ask this**

Hazards are the single best probe of whether a candidate actually understands pipelining or has only memorized "IF/ID/EX/MEM/WB." A junior answer names the five stages; a senior answer explains *why* `lw` followed by a dependent `add` costs a cycle but two dependent `add`s don't, and can draw the forwarding path that makes the difference. It also separates people who conflate the *dependency* (a property of the program) from the *hazard* (a property of the program on a specific pipeline). The strongest signal is knowing that RAW is fundamental but WAR/WAW are artifacts of finite register names — because that one distinction is the whole justification for register renaming and out-of-order execution, which is where the interview usually heads next.

**Common confusions**

- **"A dependency is a hazard."** No — a dependency is a program property; it becomes a hazard only if the pipeline can't satisfy it in time. A deep enough gap, or forwarding, makes the same dependency harmless.
- **"Forwarding eliminates all data stalls."** It eliminates ALU-to-ALU RAW stalls, but not the load-use case: the value is produced in MEM, needed in EX, and no wire runs backward in time — one bubble is unavoidable.
- **"WAR/WAW are real data hazards."** They're name hazards; there's no value flowing between the instructions, only a reused register. Rename and they vanish. They don't even arise in a simple in-order pipeline that writes in program order.
- **"Delay slots are how modern CPUs handle branches."** Delay slots are a 1980s RISC artifact; modern superscalar, out-of-order cores use branch prediction and speculation instead, and treat the delay slot as legacy baggage.

**What follows from this topic**

Structural and data hazards are largely *solved* — more ports and forwarding wires. The stubborn one is the control hazard: a mispredicted or unresolved branch can flush many in-flight instructions, and in a deep, wide modern pipeline that is enormously expensive. That cost is precisely what motivates the next topic, **branch prediction** — predictors, BTBs, and speculative execution — and, further out, the register renaming and out-of-order machinery that turn the RAW/WAR/WAW taxonomy introduced here into a full dynamic-scheduling story.

### Q1. What is a pipeline hazard, and what are the three classes?

A hazard is a condition that prevents the next instruction in the stream from executing in its designated clock cycle — if you let it proceed anyway, you'd get a wrong result or a resource conflict. There are exactly three classes. **Structural hazards**: two instructions need the same physical hardware resource in the same cycle (classically, one instruction wants to fetch from memory in IF while another accesses data in MEM, on a single-ported memory). **Data hazards**: an instruction needs an operand that a still-in-flight earlier instruction hasn't produced yet. **Control hazards** (a.k.a. branch hazards): the pipeline needs to fetch the next instruction, but a branch that decides *which* instruction that is hasn't resolved. The crucial framing: a hazard is a property of a *program running on a specific pipeline*, not of the program alone. Change the microarchitecture — add a memory port, add a forwarding path, add a predictor — and the same code has different hazards.

### Q2. Distinguish a dependency from a hazard.

A **dependency** is a relationship in the program: instruction B uses a value instruction A produces (or they write the same location). It exists in the source, independent of any hardware. A **hazard** is what happens when a dependency collides with the timing of a particular pipeline — B reaches the stage that needs A's result before A has made it available. The distinction matters because you fix them differently. You can't remove a true dependency (it's the algorithm), but you can stop it from being a hazard: forward the value, reorder independent work between A and B, or deepen the gap. Interviewers love this because candidates who blur the two can't reason about why forwarding works — forwarding doesn't touch the dependency, it just satisfies it earlier from a pipeline latch instead of the register file.

### Q3. Give a concrete structural hazard and how it's fixed.

The textbook case is a **single unified memory** feeding both instruction fetch (IF) and data access (MEM). In a 5-stage pipeline, on any given cycle one instruction is in IF while another is in MEM; if both must go through the same single-ported memory, they collide — a structural hazard. Fix: give the pipeline **separate instruction and data paths** — in modern terms, split L1 caches (L1I and L1D), which is exactly why every real CPU has a **Harvard-style** split L1 even though main memory is unified. Other structural hazards: a single register-file **write port** when two instructions want to write back in the same cycle, or a non-pipelined multi-cycle functional unit (e.g. an FP divider) that a second divide must wait on. General remedy: duplicate or pipeline the contended unit. Structural hazards are the "just spend transistors" class — usually the cheapest to design away.

### Q4. Walk through the RAW/WAR/WAW taxonomy. Which are true hazards?

Three data-dependence types, named by the access order:

| Type | Pattern | Nature |
|------|---------|--------|
| **RAW** (read-after-write) | B reads what A wrote | **True** dependency — real data flow |
| **WAR** (write-after-read) | B writes what A reads | **Anti**-dependency — name reuse |
| **WAW** (write-after-write) | B writes what A wrote | **Output** dependency — name reuse |

Only **RAW** is a true dependency: an actual value must flow from A to B, so you can never remove it, only satisfy it faster (forwarding). **WAR** and **WAW** are **name hazards** — there's no value passing between the instructions; they merely reuse the same architectural register name. If B wrote to a *different* register, the hazard would evaporate. That's the entire premise of **register renaming**: give the machine a large pool of physical registers and map each architectural write to a fresh physical one, and WAR/WAW simply cease to exist. Note that in a simple in-order pipeline that reads in ID and writes in WB (program order), WAR and WAW can't even cause a wrong result — they become live hazards only once you allow out-of-order or out-of-order completion.

### Q5. What is forwarding (bypassing), and how does it work?

Forwarding is dedicated datapath hardware that routes a result from an internal pipeline register *directly* to a later instruction's operand input, instead of waiting for it to be written to the register file and read back out. Consider `add x1, x2, x3` followed by `sub x4, x1, x5`. The `add` computes `x1` at the end of **EX** (cycle N), but doesn't write it to the register file until **WB** (cycle N+3). The `sub` needs `x1` at the start of *its* EX (cycle N+1). Without forwarding you'd stall ~2–3 cycles waiting for WB. With forwarding, a multiplexer on the ALU input can grab `x1` from the **EX/MEM pipeline latch** the very next cycle — zero stall. There are multiple forwarding paths: EX/MEM→EX (result one instruction ahead) and MEM/WB→EX (two ahead). A small **forwarding unit** compares the source register numbers of the instruction in EX against the destination registers of instructions in MEM and WB, and drives the muxes. For back-to-back ALU RAW dependencies, forwarding makes the hazard completely free.

### Q6. Why can't forwarding fully hide a load-use hazard?

Because a load produces its value one stage *later* than the ALU does. For `lw x1, 0(x2)` the loaded data isn't available until the **end of MEM** (cycle N+2 for an instruction that entered EX in N+1). But the dependent `add x3, x1, x4` needs `x1` at the **start of its EX**. If the `add` immediately follows the load, its EX would be cycle N+2 — the same cycle the data is still being read from memory. You'd have to forward the value *backward in time* by one cycle, which is impossible. So the hardware must insert exactly **one bubble** (or the compiler/scheduler must fill that slot with an independent instruction), delaying the `add`'s EX to N+3, at which point MEM/WB forwarding delivers the value. This is the **load-use hazard** (also "load delay slot"), and it's why good compilers try to schedule an unrelated instruction immediately after a load. One stall per un-hidden load-use pair; on a hot pointer-chasing loop that adds up.

### Q7. What is a bubble/stall, and how does the hardware create one?

A **bubble** is a no-op deliberately injected into the pipeline to buy time. When the hazard-detection logic sees a case it can't forward around (e.g. load-use), it does two things in that cycle: it **freezes** the earlier stages — the PC and the IF/ID register hold their current values so IF and ID re-do the same work next cycle — and it **de-asserts the control signals** of the instruction leaving ID, turning it into a harmless no-op (no register write, no memory write) that flows down EX/MEM/WB. The net effect is a one-cycle hole: throughput drops from one instruction/cycle to zero for that cycle, and CPI rises. Stalls are the universal fallback — anything you can't forward or predict, you stall. The engineering goal of everything else in this topic (extra ports, forwarding wires, prediction) is to *avoid* bubbles, because each one is pure lost throughput.

### Q8. Why are control hazards the expensive ones, and what's the naive cost?

When a branch enters the pipeline, the CPU must keep fetching *something* every cycle — but it doesn't yet know the branch outcome (taken/not-taken) or, for a taken branch, the target address. In the classic 5-stage MIPS pipeline the branch might not resolve until EX (or MEM in the original design), so the naive approach stalls until it's known — 1 to 3 lost cycles per branch. That sounds small until you count branches: roughly **1 in 5–6 instructions** is a branch in typical integer code. Worse, modern CPUs are deep (15–20+ stages) and wide (4–8 instructions/cycle), so a wrong guess means flushing *dozens* of in-flight instructions — a **misprediction penalty of ~15–20 cycles** on a big out-of-order core. That's why control hazards, not data hazards, dominate real-world pipeline stall budgets, and why they justify an entire predictor subsystem. This is the direct on-ramp to the branch-prediction topic that follows.

### Q9. What was a branch delay slot, and why did modern CPUs drop it?

A **branch delay slot** was an ISA-level trick used by early RISC designs (MIPS, SPARC, PA-RISC): the instruction *immediately after* a branch **always executes**, whether the branch is taken or not. The idea was to expose the pipeline's one-cycle branch latency to software — the compiler fills the slot with a useful instruction (ideally one that must run regardless), turning a mandatory bubble into real work. It was a clever match for a shallow, single-issue pipeline where the branch resolved exactly one stage after fetch. Modern CPUs **abandoned it** for two reasons: (1) it only hides *one* cycle, but deep pipelines have many cycles of branch latency, so it stopped paying off; and (2) it's a leaky abstraction baked into the ISA — it complicates out-of-order execution, exceptions, and interrupts, and forever ties the architecture to one pipeline depth. Branch prediction hides the latency *in hardware* without contaminating the ISA. RISC-V pointedly has **no** delay slot; AArch64 has none; even MIPS deprecated it. It's a museum piece worth knowing because it shows the historical alternative to prediction.

### Q10. Worked example: count the cycles for a short dependent sequence.

Take a 5-stage pipeline with full ALU forwarding and one load-use bubble:

```
lw   x1, 0(x2)    // load
add  x3, x1, x4   // uses x1 -> load-use, 1 bubble
sub  x5, x3, x6   // uses x3 (ALU result) -> forwarded, 0 bubble
or   x7, x5, x8   // uses x5 -> forwarded, 0 bubble
```

Cycle-by-cycle for `add`: it can't get `x1` until after `lw`'s MEM, so it stalls one cycle, then MEM/WB→EX forwarding supplies `x1`. The `sub` depends on `x3` (an ALU result available at end of `add`'s EX) — EX/MEM→EX forwarding covers it, no stall. The `or` similarly gets `x5` by forwarding. So four instructions that would take `4 + 4 = 8` cycles unpipelined-ish take: 5 (fill) + 3 (one per following instruction) + **1 bubble** = **9 cycles** instead of the ideal 8. One lost cycle, entirely due to the single load-use hazard; every other true dependency here is forwarded for free. If you reordered an independent instruction into the slot after `lw`, you'd hit the ideal 8.

### Q11. How does register renaming eliminate WAR and WAW hazards?

WAR and WAW are hazards only because two instructions reuse the same *architectural* register name — there's no real data flowing between them. Renaming breaks the coincidence. The hardware keeps a large **physical register file** (e.g. 180+ physical registers behind ~32 architectural ones on a modern x86-64 core) and a **rename/alias table** mapping each architectural register to a physical one. Every instruction that *writes* an architectural register is allocated a *fresh* physical register; subsequent readers of that architectural name are pointed at the new physical register. So if instruction A reads `x1` (old physical reg p5) and later instruction B writes `x1` (new physical reg p9), B's write goes to p9 and can't clobber the p5 that A still reads — the **WAR** is gone. Two writes to `x1` land in two different physical registers — the **WAW** is gone. Only **RAW** survives, because it reflects genuine data flow that no renaming can remove. This is why renaming is the enabling trick for out-of-order execution: it strips away the false dependencies so the scheduler only has to honor the true ones.

### Q12. The interview one-liner: pipeline hazards in one crisp paragraph.

A pipeline wins by overlapping instructions, and hazards are the three ways that overlap breaks — **structural** (two instructions want one resource, fixed with more ports/units), **data** (an operand isn't ready), and **control** (a branch hasn't resolved). Data hazards split into the true **RAW** dependency, which you satisfy cheaply by **forwarding** the result straight from a pipeline latch to the next ALU input, and the false **WAR/WAW** name hazards, which **register renaming** simply erases. Forwarding kills almost every data stall except the **load-use** case, where the loaded value arrives one stage too late and costs an unavoidable one-cycle **bubble**. Control hazards are the pricey ones — a mispredict on a deep, wide core flushes 15–20 cycles of work — which is exactly why the historical **delay slot** gave way to hardware **branch prediction**, the next topic.


## Branch Prediction & Speculation

### Summary

**What this topic covers**
Modern CPUs are deeply pipelined and issue several instructions per cycle, but roughly one in five instructions is a branch, and the pipeline needs to know the *next* instruction's address before the current branch has computed its outcome. Branch prediction is the microarchitectural machinery — the hardware that guesses branch direction (taken/not-taken) and target address early in the front end so fetch never stalls — and speculation is what the core does with that guess: it runs *ahead* on the predicted path, executing instructions whose results are held tentatively until the branch resolves. This topic covers why branches are so damaging to deep pipelines, static vs dynamic predictors, the evolution from 1-bit through 2-bit saturating counters to global-history and TAGE-class predictors, the supporting structures (BHT, BTB, return-address stack), the misprediction penalty, and how speculation feeds out-of-order execution — plus the security fallout (Spectre) that turned a performance feature into a side-channel.

**Mental model**
Picture the front end as a pipeline that must fetch a new instruction block every cycle. When it hits a conditional branch, the *condition* won't be known for another dozen-plus cycles (the compare may be waiting on a cache miss). The CPU cannot afford to wait, so it *bets*: a predictor keyed on the branch's address (and recent history) says "taken, target 0x4080," and fetch keeps streaming from there. Every instruction fetched after the branch is **speculative** — it may be executing down a path that will turn out wrong. The out-of-order engine happily renames, schedules, and executes these instructions, but they are not allowed to *retire* (commit architectural state) until the branch ahead of them is confirmed correct. If the guess was right, the work is "free" — the pipeline never bubbled. If it was wrong, the core squashes everything younger than the branch, restores the checkpoint, and refetches from the correct target. Prediction is therefore a bet on the common case; the whole performance model of a superscalar core rests on being right ~95–99% of the time.

**Key terms**
- **Static prediction** — a fixed guess baked in at compile/decode time (e.g. "backward branches taken"), no runtime state.
- **Dynamic prediction** — hardware learns per-branch behaviour at runtime from history tables.
- **BHT (Branch History Table / PHT)** — array of small counters indexed by branch address/history giving the direction guess.
- **2-bit saturating counter** — a 4-state (strong/weak × taken/not-taken) counter that needs two wrong guesses to flip; kills the anomaly-loop problem.
- **BTB (Branch Target Buffer)** — cache mapping branch PC → predicted target address, so the target is known at fetch, before decode.
- **Global history register (GHR)** — a shift register of recent taken/not-taken outcomes across all branches; captures correlation.
- **Local history** — per-branch history of that one branch's recent outcomes.
- **Tournament / hybrid predictor** — a meta-predictor that picks, per branch, between a local and a global predictor.
- **TAGE** — tagged geometric-history-length predictor; multiple tables indexed by increasingly long histories, state-of-the-art today.
- **RAS (Return Address Stack)** — a hardware stack that predicts function-return targets by mirroring call/return.
- **Misprediction penalty** — cycles lost flushing and refilling the pipeline on a wrong guess (~15–20 on modern cores).
- **Speculative execution** — running instructions on the predicted path before the branch resolves; results are squashable.

**Why interviewers ask this**
Branch prediction separates people who *say* "the CPU is pipelined" from people who understand what makes that pipeline actually deliver IPC. A junior answer defines a branch and stops. A mid-level answer explains 2-bit counters and the ~15-cycle flush. A senior answer connects prediction to the *cost model of the code they write*: why a well-predicted branch is nearly free but a data-dependent 50/50 branch in a hot loop can dominate runtime, why branchless code or `cmov` sometimes wins, and why sorting data before a branchy scan can 2–3× throughput. The very best candidates also know the security dimension — that speculation past a bounds check is exactly the Spectre bug — which signals they understand microarchitecture as a *system* with real-world consequences, not trivia.

**Common confusions**
- *Predicting direction vs predicting target* — the BHT answers "taken?", the BTB answers "to where?"; indirect branches and returns are hard because the *target* varies even when direction is trivially "taken."
- *"Mispredictions cost one cycle"* — no; it's the whole pipeline depth plus front-end refill, ~15–20 cycles, because everything after the branch must be squashed.
- *Speculation ≠ prediction* — prediction is the guess; speculation is executing on it. You can predict without a deep OoO window, but modern cores speculate aggressively across it.
- *Speculative work is invisible* — architecturally yes, but it leaves **microarchitectural** traces (cache state), which is the entire basis of Spectre.

**What follows from this topic**
Prediction is the front end feeding the out-of-order back end (pipelining and superscalar issue), so it pairs directly with the pipelining and OoO/register-renaming topics — speculation only pays off because a large instruction window hides latency behind correct guesses. The cache topic explains why the misprediction *and* the resolving compare can both stall on memory, and why speculative loads pollute caches. The Spectre angle ties into the memory-hierarchy and virtual-memory topics via cache timing side-channels; the software-visible mitigations (fences, retpolines) are where this hardware story meets the OS and compiler.

### Q1. Why do branches hurt a deep, wide pipeline so much — what's the actual cost?

Because fetch has to run *ahead* of resolution. A modern core has a front end of ~15–20 pipeline stages and issues 4–8 instructions per cycle, so between fetching a branch and knowing its outcome there are dozens of in-flight instructions. If the core simply stalled at every branch until the condition resolved, and branches are ~20% of instructions, throughput would collapse — you'd bubble the pipeline every fifth instruction. Prediction lets fetch keep streaming on a guessed path so the *common* case costs zero. The penalty only shows up on a **misprediction**: everything fetched after the branch is wrong, must be squashed, and the pipeline refills from the correct target. That refill is the pipeline depth plus front-end restart, empirically **~15–20 cycles** on Intel/AMD/Apple big cores. At a 95% hit rate with 20% branches, mispredicts still cost real IPC; at 99% they're nearly invisible. This is why the *cost of a branch is bimodal*: essentially free when predictable, brutally expensive when not.

### Q2. Static vs dynamic prediction — what does each do and when is static enough?

**Static** prediction decides at compile or decode time with no runtime state. Common heuristics: "backward branches taken" (loops iterate many times, the back-edge is usually taken) and "forward branches not taken" (error/early-exit paths). Compilers also encode hints via block layout so the fall-through is the likely path, and profile-guided optimization (PGO) lets the compiler lay out code so hot paths fall through. Static gets you maybe 70–85% accuracy — fine for very predictable loops, useless for data-dependent branches. **Dynamic** prediction learns each branch's actual behaviour at runtime in hardware tables, reaching 95–99%. Modern cores are overwhelmingly dynamic; static heuristics survive mainly as the *cold-start* default before the predictor has seen a branch, and as guidance for code layout. The interview point: static prediction is a property of the *binary*, dynamic prediction is a property of the *running program's history* — and the latter is why the same code runs faster once its branches "warm up."

### Q3. Walk me through a 1-bit predictor and why the 2-bit saturating counter replaced it.

A **1-bit** predictor stores, per branch, the last outcome: predict whatever happened last time. It's cheap but has a classic failure — the *loop* case. Consider a loop that iterates 10 times: the back-edge is taken 9 times then not-taken once on exit. A 1-bit predictor mispredicts **twice** per loop execution: once on the exit (predicts taken, was not-taken), and again on the *first* iteration of the next execution (it now predicts not-taken because that was the last outcome). The **2-bit saturating counter** fixes this with four states — Strongly-Taken (11), Weakly-Taken (10), Weakly-Not-Taken (01), Strongly-Not-Taken (00). It predicts taken in the top two states, not-taken in the bottom two, and only *moves one step* per outcome. Now a single loop-exit anomaly only nudges Strongly-Taken to Weakly-Taken — the prediction stays "taken," so the next execution's first iteration is correct. One misprediction per loop instead of two. The general principle: require **two consecutive** surprises before changing your mind, so one-off anomalies don't flip the prediction. This is the workhorse building block of every table-based predictor.

### Q4. What are the BHT and BTB, and why do you need both?

They answer two different questions. The **BHT** (Branch History Table, a.k.a. Pattern History Table) is an array of 2-bit counters indexed by branch address (often hashed with history). It answers **direction**: taken or not-taken. But knowing "taken" is useless without knowing *where to*, and the target isn't decoded until later in the pipeline. So the **BTB** (Branch Target Buffer) is a small cache mapping branch PC → predicted target address, consulted *at fetch* alongside the instruction address. Together, in the same cycle you fetch a block, the BTB says "there's a taken branch here going to 0x4080" and fetch redirects immediately — no decode needed. The BTB is essential for *unconditional* and *indirect* branches too, where direction is trivial but the target must be predicted. BTB misses (a branch never seen, or evicted) force the core to fall back to sequential fetch and correct later. A larger BTB captures more branch targets but costs area and access latency; front-end designers trade BTB size against the fetch-stage clock.

### Q5. Global vs local history — what's the difference and why does global history exist?

**Local history** tracks each branch's *own* recent outcomes — great for a branch with a repeating self-pattern (e.g. alternating T,N,T,N). **Global history** records the taken/not-taken outcomes of the *last N branches across the whole program* in a shift register (the GHR), then indexes the prediction table with (branch PC ⊕ global history). It exists to capture **correlation between different branches**. Classic example:

```
if (x < 5)  a();     // branch A
if (x > 8)  b();     // branch B
```

Branch B's outcome is correlated with A's because both depend on `x`. A per-branch local predictor can't see that; a global-history predictor learns "when the recent branch pattern was ...T, this branch goes N." Global schemes (gshare XORs PC with GHR to spread out table entries and reduce aliasing) dominate for correlated control flow, which is common in real code. The cost is **aliasing**: two unrelated (PC, history) pairs hashing to the same counter interfere. Longer histories capture deeper correlation but need bigger tables and warm up slower — the fundamental tension TAGE was built to resolve.

### Q6. What is a tournament predictor, and how does TAGE improve on it?

A **tournament (hybrid)** predictor runs *two* predictors in parallel — typically one local-history and one global-history — plus a **meta/chooser** table (itself 2-bit counters) that learns, *per branch*, which sub-predictor has been more accurate, and uses that one's answer. This wins because different branches suit different predictors: loops love local history, correlated `if`-chains love global. The Alpha 21264 famously shipped a tournament predictor. **TAGE** (TAgged GEometric history length) generalizes this. It has a base predictor plus several tagged tables, each indexed by a history of a *geometrically increasing* length (e.g. 4, 8, 16, 32, 64, 128 bits). On a lookup, all tables are probed; the matching entry from the table using the **longest** history that hits wins. Short-history tables catch branches needing little context; long-history tables catch deeply-correlated branches — without wasting a giant uniform table. Tags detect and avoid aliasing. TAGE (and its perceptron-predictor cousins, which sum weighted history bits and are used in AMD/Samsung cores) is the state of the art, hitting ~99%+ on many workloads. The takeaway: modern predictors index *multiple* history lengths and pick the most specific confident match.

### Q7. Why are function returns and indirect branches special, and what handles them?

For a normal conditional branch, the target is fixed; only the *direction* varies. For **returns** and **indirect branches** (virtual calls, `switch` jump tables, function pointers), the *direction* is trivially "taken" but the **target changes** call-to-call — so the BTB, which caches one target per PC, mispredicts constantly. **Returns** get a dedicated structure: the **Return Address Stack (RAS)**, a small hardware stack. On a `call`, the return address is pushed; on a `ret`, the predicted target is popped. Because call/return nest perfectly, the RAS predicts returns near-perfectly for reasonable call depths (typically 16–32 entries; deeper recursion overflows and degrades). General **indirect** branches need an indirect target predictor — effectively a BTB indexed by (PC ⊕ global history), so the same indirect branch can predict *different* targets depending on the path that reached it (an ITTAGE-style scheme). Megamorphic virtual dispatch — one call site hitting many types — is the pathological case and a real cost in OO/interpreter-heavy code, which is why JITs devirtualize and interpreters use computed-goto threading to spread branches across many predictable sites.

### Q8. Give me a worked example: how much does a mispredicting branch cost in a hot loop?

Take a loop scanning 100M elements with one data-dependent branch per element, say `if (arr[i] > threshold) count++;`, on a 3 GHz core with a ~17-cycle misprediction penalty. If the data is **sorted**, the branch is almost perfectly predictable (a long run of not-taken, then a long run of taken) — say 99.9% accuracy: ~100k mispredicts × 17 cycles ≈ 1.7M cycles ≈ 0.57 ms *from mispredicts*, negligible versus the loop body. If the data is **random** around the threshold, the branch is ~50/50 — the predictor can't do better than chance, ~50M mispredicts × 17 cycles ≈ 850M cycles ≈ **283 ms** purely in misprediction stalls. That's the famous "why is processing a sorted array faster" result — the same instructions, a 3× or more wall-clock difference, entirely from branch prediction. The engineering lessons: (1) sorting or partitioning to make branches predictable can pay for itself; (2) a 50/50 branch in a hot loop is a candidate for **branchless** code — a `cmov`, a bit-mask, or `count += (arr[i] > threshold)` — trading a possible mispredict for a guaranteed few-cycle data dependency.

### Q9. How does speculation feed out-of-order execution, and what happens on a misprediction?

Prediction is what lets the out-of-order (OoO) engine stay full. The predicted path streams instructions into the back end, where they're **renamed** (mapped to physical registers so wrong-path work can be discarded cleanly), dispatched into the scheduler, and executed as their operands become ready — *all speculatively*. Each in-flight branch takes a **checkpoint** of the register-rename state (or is tracked in the reorder buffer, ROB). Results compute but sit in the ROB/physical registers; they **retire in program order** only once every older instruction — including the branch they depend on — is confirmed. When the branch executes and the real outcome disagrees with the prediction, the core triggers a **flush**: squash every instruction younger than the branch in the ROB, roll the rename map back to the branch's checkpoint, steer fetch to the correct target, and refill. That's the ~15–20 cycle penalty. Crucially, speculation is *why* a large instruction window (100s of entries) helps: it lets the core execute far past cache-missing loads on the predicted path, overlapping latency — but only if predictions hold, because a mispredict throws away all that speculative work.

### Q10. Explain the security angle — how did branch prediction become Spectre?

Speculation was assumed safe because wrong-path work never *retires* — it can't change architectural registers or memory. Spectre (2018) broke that assumption: squashed speculative instructions leave **microarchitectural** traces, chiefly in the **cache**, that outlive the flush and are readable via timing. In **Spectre v1 (bounds-check bypass)**, an attacker trains the predictor to expect a bounds check to pass, then supplies an out-of-range index. The core speculatively executes `array2[array1[i]*512]` *past* the check, loading attacker-chosen out-of-bounds memory and using it to index a probe array — pulling a specific line into cache. The check then resolves false and the work is squashed, but the probe array's cache footprint reveals the secret byte via a timing scan (a Flush+Reload side channel). **Spectre v2 (branch target injection)** poisons the BTB/indirect predictor so a victim's indirect branch speculatively jumps to an attacker-chosen "gadget." Mitigations: `lfence` speculation barriers after sensitive checks (v1); **retpolines** and hardware IBRS/IBPB to isolate indirect-branch prediction (v2); and predictor-state flushing across privilege/context boundaries — all of which cost performance. The deep lesson interviewers want: architectural correctness and *microarchitectural* observability are different guarantees, and squashed speculation is not the same as never-having-happened.

### Q11. The interview one-liner: sum up branch prediction and speculation.

Deep, wide pipelines must fetch a dozen-plus instructions ahead of where any branch resolves, so the CPU *bets* on each branch's direction (2-bit saturating counters in a BHT, correlated via global/local history in tournament and TAGE-class predictors) and target (BTB for general branches, a return-address stack for returns), then **speculatively executes** down the predicted path through the out-of-order window — renaming so wrong-path work is squashable — retiring results only once the branch is confirmed; a correct guess is essentially free while a mispredict costs a full ~15–20-cycle pipeline flush, which is why a 50/50 branch in a hot loop can dominate runtime and why the very speculation that buys ~99% "free" prediction is also exactly the mechanism Spectre abuses to leak secrets through cache-timing side channels.


## Superscalar & Out-of-Order Execution

### Summary

**What this topic covers**
This topic is about how a modern high-performance CPU core extracts *instruction-level parallelism* (ILP) from an ordinary sequential instruction stream. A scalar in-order pipeline (the previous topic) can retire at best one instruction per cycle and stalls the whole machine the moment an instruction is waiting on a slow operand or a cache miss. The cores in your laptop and phone do far better: they fetch and decode several instructions per cycle (*superscalar*), issue them to execution units *out of program order* as their inputs become ready, run dozens of instructions "in flight" at once, and yet make it all *look* perfectly sequential to software. The machinery that pulls this off — register renaming, reservation stations, the reorder buffer, the load/store queue, and speculation — is the heart of every big out-of-order (OoO) core: Intel's P-cores, AMD Zen, Apple's Firestorm/Avalanche, Arm's Cortex-X.

**Mental model**
Think of the core as a small dataflow machine wearing a sequential disguise. The *frontend* (fetch, decode, rename) turns the program-order instruction stream into micro-ops tagged with their true data dependencies. The *backend* (schedulers, execution units, load/store units) then runs those micro-ops the instant their operands are ready, regardless of program order — a multiply that's waiting on a cache miss doesn't block an independent add sitting behind it. The trick that makes this safe is that *out-of-order execution is paired with in-order retirement*. Results are computed early and buffered in a *reorder buffer* (ROB), but architectural state (the registers and memory the ISA promises) is only committed in the original program order. So the machine speeds ahead speculatively and opportunistically, but the "official" view of the world advances one instruction at a time, exactly as written. If a branch was mispredicted or an exception fires, everything past that point is simply thrown away as if it never happened.

**Key terms**
- **ILP** — instruction-level parallelism; the number of independent instructions available to run simultaneously in a single thread.
- **Superscalar / multiple-issue** — fetching, decoding, and issuing more than one instruction per cycle; issue *width* is the peak per-cycle rate.
- **In-order vs out-of-order** — whether instructions execute in program order (simple, stall-prone) or are reordered by data readiness.
- **Register renaming** — mapping architectural registers to a larger pool of *physical registers* to remove false (WAR/WAW) dependencies.
- **Reservation station / scheduler** — the queue where a micro-op waits until its operands and a functional unit are available, then "wakes up" and issues.
- **Reorder buffer (ROB)** — in-order queue of all in-flight instructions that enforces in-order *retirement* and precise exceptions.
- **Load/store queue (LSQ)** — buffers in-flight memory ops and performs *memory disambiguation* (deciding whether a load may bypass unretired stores).
- **Speculation / squash** — running instructions past an unresolved branch, then discarding ("squashing") them on a mispredict.
- **Retire / commit** — the in-order act of making a completed instruction's result architecturally visible and freeing its resources.
- **Frontend / backend** — fetch+decode+rename vs schedule+execute+memory+retire; the two halves connected by the rename/dispatch stage.

**Why interviewers ask this**
This is the single best topic for separating "I memorized a 5-stage pipeline diagram" from "I understand why real chips are fast." A junior answer stops at "the CPU runs instructions in parallel." A senior answer can explain *why* renaming is necessary (false dependencies would otherwise serialize independent code), *why* the ROB exists (you cannot have precise exceptions or recover from a mispredict without in-order commit), and *why* a single cache miss doesn't stall a good core (independent work keeps flowing while the miss is serviced — memory-level parallelism). It also connects directly to performance you can measure: branch mispredict penalties, the cost of long dependency chains, and why IPC (instructions per cycle) on real workloads is ~1.5–4 even on a core that can *issue* 6–8.

**Common confusions**
- "Out-of-order means instructions *finish* out of order that the programmer sees." No — they *execute* out of order but *retire* in order; software never observes reordering (within a thread).
- "Renaming is an optimization you can skip." It's mandatory for OoO to help at all; without it WAR/WAW hazards would reserialize the very code you wanted to overlap.
- "The ROB is a cache." It's a small in-order FIFO of in-flight instructions (~200–630 entries), not a memory cache.
- "Speculation only means branch prediction." Prediction picks the path; *speculative execution* is running down it before you know it's right — and squashing if it wasn't.

**What follows from this topic**
Everything here rests on the pipelining and hazards topic (the stalls OoO is designed to hide) and on branch prediction (the accuracy that makes deep speculation pay off — one mispredict throws away ~15–20 cycles of work). The load/store queue and speculation tie directly into the memory-hierarchy topics: OoO exists largely to tolerate cache-miss latency by finding independent work, and speculative memory accesses are exactly what side-channel attacks like Spectre/Meltdown abused. The hardware memory-ordering rules the LSQ enforces are the microarchitectural side of the software memory model — the locks/atomics/happens-before layer is covered in the Concurrency primer.

### Q1. What is instruction-level parallelism, and what limits how much a core can exploit?

ILP is the number of instructions in a single sequential stream that are mutually independent and could, in principle, execute at the same time. A core exploits it by having multiple execution units and issuing several instructions per cycle. Three things cap the payoff: **true data dependencies** (a RAW chain — each instruction needs the previous result — is fundamentally serial no matter how wide the machine); **control dependencies** (branches; you can't run past them without speculating, and mispredicts throw work away); and **finite resources** (issue width, number of execution ports, ROB/scheduler/physical-register-file size, and memory bandwidth). Typical general-purpose integer code has limited ILP — sustained IPC of ~1.5–3 even on cores that can issue 6–8 wide — because dependency chains and branches are dense. Numerical/vector code and well-unrolled loops expose far more. This is why chips also pursue *thread*-level parallelism (SMT/hyperthreading feeds a second stream's independent instructions into the same backend to fill idle slots) and *data*-level parallelism (SIMD).

### Q2. What does "superscalar" mean, and how does issue width relate to real performance?

Superscalar means the core can fetch, decode, and issue more than one instruction per cycle — it has multiple parallel pipelines and dispatch ports rather than a single one. "Width" usually refers to the peak issue/decode rate: e.g. Apple's Firestorm decodes ~8 instructions wide, recent Intel P-cores and AMD Zen decode/rename ~4–6 wide with 6+ execution ports. But peak width is a ceiling you rarely touch. Sustained IPC on general code is much lower (~1.5–3) because dependency chains, branch mispredicts, and cache misses starve the backend. Going wider has sharply diminishing returns: doubling width doesn't double IPC, and it super-linearly grows the cost of the wakeup/select scheduler, the rename logic, and the register file (more read/write ports). That's why cores got *deeper* out-of-order windows (bigger ROBs) and better branch predictors rather than simply ever-wider — you need to *find* enough independent work to feed the width you already have.

### Q3. Walk me through the difference between in-order and out-of-order execution with an example.

Consider:
```
load  r1, [r2]      // (A) misses in L1/L2, ~200+ cycles to DRAM
add   r3, r1, r4    // (B) depends on A
mul   r5, r6, r7    // (C) independent of A and B
```
An **in-order** core issues in program order and must stall at B (it needs r1), and because issue is in-order, C is stuck behind B — the whole machine idles for hundreds of cycles waiting on one load. An **out-of-order** core dispatches all three into the backend. B waits in a reservation station for r1. C's operands (r6, r7) are ready, so C issues immediately and executes while A's miss is still outstanding. When A's data returns, B wakes up and executes. This is *memory-level parallelism*: the core keeps doing useful, independent work across a long-latency miss, and can even issue *further independent loads* to overlap multiple misses. Crucially, even though C computed before B, retirement is in program order, so architectural state updates A→B→C.

### Q4. Why is register renaming necessary? Distinguish the three hazard types.

There are three name-based hazards. **RAW** (read-after-write, "true dependency"): B genuinely needs A's result — this is real dataflow and renaming *cannot* remove it. **WAR** (write-after-read) and **WAW** (write-after-write) are *false* dependencies — they exist only because two instructions happen to name the *same architectural register*, not because data actually flows between them. Example: `add r1,r2,r3` followed by `add r1,r4,r5` both write `r1` (WAW), and if a reader of the first `r1` sits between them there's a WAR too. With only 16–32 architectural registers, the compiler reuses register names constantly, so WAR/WAW hazards are everywhere and would force independent instructions to serialize. **Register renaming** dissolves them: each *write* to an architectural register is allocated a fresh **physical register** from a large pool (e.g. ~200–630 physical entries behind 16–32 architectural names). The two `r1` writes get different physical registers, so they're now genuinely independent and can execute in either order. Renaming leaves only true RAW dependencies — the irreducible dataflow — for the scheduler to honor.

### Q5. Explain the components of Tomasulo's algorithm and what problem each solves.

Tomasulo (IBM 360/91, 1967) is the blueprint for dynamic scheduling. Its pieces: **Reservation stations** — per-execution-unit queues where an instruction sits until its operands are ready; each entry holds either a ready operand *value* or a *tag* naming the producer it's waiting on. **Register renaming via the tag/status table** — instead of pointing readers at architectural registers, each register maps to the tag of the instruction that will produce its latest value, which is what kills WAR/WAW hazards. **The common data bus (CDB)** — when a unit finishes, it broadcasts `(tag, value)` on the CDB; every reservation station and register slot waiting on that tag captures the value and "wakes up." That broadcast-and-match is the core wakeup mechanism. The insight Tomasulo contributed was *decoupling instruction issue (in-order, into stations) from execution (out-of-order, by data readiness)* using tag-based renaming and result forwarding. Modern cores are Tomasulo's descendants; the big addition since is the reorder buffer for precise exceptions (original Tomasulo had imprecise interrupts) and much larger physical register files instead of value-carrying stations.

### Q6. What is the reorder buffer, and why is in-order retirement essential for precise exceptions?

The ROB is an in-order circular FIFO holding an entry for *every* in-flight instruction, allocated at dispatch in program order and freed at retirement in program order. Out-of-order execution means an instruction can *complete* (compute its result and mark its ROB entry done) early and in any order — but it can only **retire** (commit architectural state, free its physical register and ROB slot) when it reaches the *head* of the ROB and all older instructions have retired. This in-order head is what makes exceptions *precise*: a **precise exception** means when a fault fires, all instructions before it have fully executed and none after it have modified any architectural state — so the OS sees a clean, restartable point (exactly the semantics needed for page faults, breakpoints, and clean context switches; the OS's *handling* of those is the OS primer's concern). Because faults are detected during execution but only *acted on* when the faulting instruction reaches the ROB head, any speculative/younger work sitting behind it is simply discarded. Without in-order retirement you'd have Tomasulo's original imprecise interrupts — unusable for demand paging or debuggable software. ROBs are large today: ~224 (Intel Golden Cove), ~256+ (Zen 4), and Apple's cores are famously deep (500–630+), because a bigger window means more independent instructions to hide long memory latencies.

### Q7. How are memory operations handled — what's the load/store queue and memory disambiguation?

Registers get renamed, but memory is trickier because a load and a store only conflict if they touch the *same address*, and addresses aren't known until the address computation executes. So OoO cores use a **load/store queue** (often split into a load queue and store queue) to track all in-flight memory ops in program order. Two guarantees it enforces: stores must not update the cache until they *retire* (they sit in a **store buffer** and only write memory in order, so a squashed store never corrupts memory), and a load must return the value of the *most recent older store to the same address*. **Memory disambiguation** is deciding, for a load, whether an older store with an as-yet-unknown address might alias it. Conservative cores stall the load until all older store addresses are known; aggressive cores **speculate** that there's no alias and let the load go early — with a **memory dependence predictor** (e.g. Intel's store-set predictor) to guess when to be cautious. If a younger load speculatively bypassed an older store that turns out to alias, the core detects it in the LSQ and squashes/replays from the load — a *memory-order violation*. When an older store *does* match a waiting load's address, the store's value is forwarded directly from the store buffer (**store-to-load forwarding**) rather than round-tripping through cache.

### Q8. Walk me through what happens on a branch mispredict in an OoO core.

The frontend predicts a branch's direction/target and keeps fetching and speculatively executing down the predicted path — those younger instructions occupy ROB entries and physical registers and may even execute and produce results, but nothing has *retired*. When the branch itself executes in the backend, the real outcome is compared to the prediction. On a **mispredict**: (1) all instructions younger than the branch in the ROB are **squashed** — flushed en masse; (2) the register rename map is rolled back to the branch's checkpoint so architectural mappings are correct; (3) speculative store-buffer entries and LSQ entries past the branch are discarded (this is *why* speculative stores never hit cache — they can be thrown away cleanly); (4) the frontend is redirected to the correct target and refills the now-empty pipeline. The cost is the **mispredict penalty** — roughly the pipeline depth from fetch to branch resolution, ~15–20 cycles on modern cores, during which the backend drains and refills. That's why branch prediction accuracy (95–99%+) is so valuable, and it's the same *speculative execution past an unresolved condition* that Spectre-class attacks exploited: the squash undoes architectural state but leaves microarchitectural traces (cache footprints) behind.

### Q9. Compare "physical register file" renaming with the older ROB/value-based approach.

Two ways to hold speculative results. **ROB-based (data-in-ROB)**: completed results live in the ROB entry (or in value-carrying reservation stations, as in textbook Tomasulo); at retire the value is copied from the ROB into the architectural register file. Simple, but every result gets copied twice and the ROB needs wide value storage. **Physical register file (PRF) renaming** — used by essentially all modern cores (Intel since Sandy Bridge, AMD Zen, Apple, Arm): there is *one* large PRF that holds both speculative and committed values; renaming allocates a physical register per write, and a **register alias table (RAT)** maps architectural names to physical registers. Retirement is cheap — no data movement, you just update which physical register is the "committed" one for that architectural name and free the old one. The PRF must be large enough to cover every in-flight write (hence ~180–630 physical registers behind 16–32 architectural). The tradeoff: PRF gives a bigger effective window and no result-copying, at the cost of a big multi-ported register file and careful free-list/reclaim logic. This is the dominant design today.

### Q10. Why split the core into a "frontend" and "backend," and where's the boundary?

The split reflects two very different jobs. The **frontend** is about *supply*: fetch bytes from the instruction cache, predict branches, decode (on x86, crack complex instructions into micro-ops; feed a micro-op cache to skip re-decoding hot loops), and **rename + dispatch** micro-ops into the backend. Its enemy is running out of instructions to supply — I-cache misses, decode bottlenecks, branch mispredicts (frontend-bound stalls). The **backend** is about *execution*: the schedulers/reservation stations, the execution ports (ALUs, load/store units, FPU/SIMD), the ROB, and the LSQ. Its enemy is running out of *independent work* or resources — a long dependency chain, a full ROB waiting on a cache miss, or port contention (backend-bound stalls). The rename/dispatch stage is the seam between them, and it's a natural choke point: it's where in-order program semantics get converted into the out-of-order dataflow the backend consumes. Performance tools (Intel's Top-down methodology, `perf`) categorize every stall as frontend-bound, backend-bound, bad-speculation, or retiring — a direct map onto this split, and the first question a performance engineer asks is which bucket dominates.

### Q11. Give me a concrete IPC estimate: how wide is a modern core and what do you actually get?

Take a recent big core — Intel Golden/Raptor Cove, AMD Zen 4, or Apple Firestorm. Structurally: decode/rename width ~4–8 (Apple ~8, Intel/AMD ~4–6), ~6–12 execution ports, a ROB of ~224–630 entries, ~180–600 physical registers, ~90–130 scheduler/reservation-station entries, and a load/store queue in the dozens each. So the *peak* is 6–8 instructions retired per cycle. In practice, sustained IPC on general-purpose integer code (branchy, pointer-chasing, cache-missing) is ~1.5–3; on clean, unrolled, cache-resident numeric loops you can approach 4+. The gap is the whole story of this topic: true dependency chains serialize, ~1–2% of branches mispredict at ~15–20 cycles each, and cache/DRAM misses (~4/12/40/200+ cycles for L1/L2/L3/DRAM) stall the ROB head. The out-of-order window exists precisely to hide those latencies by finding independent work — a ~600-entry window can keep the core busy across a couple of overlapping DRAM misses, which an in-order core cannot. The practical lesson for a senior engineer: reduce dependency chain length, keep working sets cache-resident, and make branches predictable, and the wide backend does the rest.

### Q12. The interview one-liner: superscalar out-of-order execution in one crisp paragraph.

A modern core is a dataflow engine hiding behind a sequential ISA: the frontend fetches, predicts branches, decodes, and *renames* architectural registers onto a large physical register file (killing false WAR/WAW hazards so only true data dependencies remain); the backend then issues those micro-ops out of program order — via reservation stations that "wake up" when operands broadcast ready — across multiple execution ports, running independent work while long-latency loads miss to memory; a reorder buffer forces *in-order retirement* so architectural state advances exactly as programmed, giving precise exceptions and clean recovery when a mispredicted branch is *squashed*; and a load/store queue disambiguates memory so speculative loads can bypass unretired stores safely. Net effect: a 6–8-wide core sustains ~1.5–3 IPC on real code by turning a single sequential stream into as much overlapping, speculative, out-of-order work as its ~200–600-instruction window can find — while never letting software see the reordering.


## The Memory Hierarchy & Latency Numbers

### Summary

**What this topic covers**

Every modern machine pretends to offer a single flat pool of fast memory. It is a lie the hardware works very hard to maintain. Underneath sits a *hierarchy* of storage technologies — registers, several levels of SRAM cache, DRAM main memory, flash SSD, spinning disk, and the network — each roughly 10x larger, 10x cheaper per byte, and 10x slower than the one above it. This topic is about why that pyramid exists, what the real sizes and latencies are at each level, and the one property of programs that makes the whole scheme work: **locality of reference**. Get this wrong and you write "correct" code that runs 50x slower than it should because it thrashes cache. It underpins caches, virtual memory, and essentially every performance discussion in systems.

**Mental model**

Think of it as a desk-and-library problem. Registers are the two or three papers in your hands (sub-nanosecond, ~a dozen 64-bit slots). L1 cache is the sheet on your desk (~4 cycles). L2 is the desk drawer (~12 cycles). L3/LLC is the filing cabinet in the room (~40 cycles). DRAM is the library down the hall (~60–100 ns, hundreds of cycles). The SSD is a warehouse across town (tens of µs), disk another town over (milliseconds), and the network is another continent. You cannot make all storage as fast as registers — SRAM that fast is enormous, power-hungry, and expensive per bit — so instead you keep the data you're *likely to touch next* as close as possible. The hardware bets that recently-used and nearby data will be reused (temporal and spatial locality), and that bet is right often enough that the effective latency of the whole system approaches L1 speed while its capacity approaches disk size.

**Key terms**

- **SRAM** — static RAM, 6 transistors/bit, no refresh, fast (~1 ns), used for registers and caches; expensive and low-density.
- **DRAM** — dynamic RAM, 1 transistor + 1 capacitor/bit, must be refreshed, ~50–100 ns; cheap and dense, used for main memory.
- **Cache line** — the unit of transfer between levels, almost universally **64 bytes** on x86-64 and AArch64. You never fetch one byte; you fetch a line.
- **Temporal locality** — if you touched an address, you'll likely touch it again soon (loop counters, hot objects).
- **Spatial locality** — if you touched an address, you'll likely touch its neighbours soon (array walks, struct fields).
- **LLC** — last-level cache, the largest shared cache (usually L3), shared across cores; a shared-contention point.
- **Hit / miss / miss penalty** — whether data is found at a level; the miss penalty is the extra latency to fetch from the next level down.
- **Latency vs bandwidth** — time for *one* access vs bytes/second sustained; two independent axes (see the confusion below).
- **The memory wall** — CPU speed has historically outrun DRAM latency, so memory, not compute, bounds most real programs.
- **Prefetcher** — hardware that predicts future accesses (e.g. sequential streams) and pulls lines in early to hide latency.
- **AMAT** — average memory access time = hit-time + miss-rate × miss-penalty; the summary metric for a hierarchy.

**Why interviewers ask this**

A junior recites "caches make things fast." A senior *quantifies* it: knows an L1 hit is ~4 cycles and a DRAM miss is ~200+ cycles, so a cache miss can cost as much as ~50–100 instructions of lost work, and can therefore reason about why an array-of-structs beats a struct-of-arrays for one access pattern and loses for another. The signal is whether you think about data *layout* and *access order* as first-class performance levers, not just Big-O. Being able to sketch the latency numbers, explain why a linked-list traversal is a cache disaster versus a contiguous array, and connect it to real 50x slowdowns is exactly the "systems-mechanical-sympathy" senior signal interviewers are hunting for.

**Common confusions**

- *"Latency and bandwidth are the same knob."* No — DRAM can deliver tens of GB/s of bandwidth while each individual random access still costs ~80 ns. Streaming loves bandwidth; pointer-chasing is latency-bound and bandwidth barely helps.
- *"Bigger cache is always better."* Larger caches are slower to access and burn more power; there's a size/latency sweet spot per level, which is exactly why the hierarchy is tiered rather than one big cache.
- *"A cache miss just costs a memory read."* It costs a *cache line* (64 B) fetch plus queueing, and stalls dependent instructions — the effective penalty is hundreds of cycles, not one.
- *"The OS manages the CPU caches."* It largely doesn't — caches are transparent hardware. The OS manages page **replacement** in DRAM (its policy side lives in the Operating Systems primer); the hardware manages cache fill/evict.

**What follows from this topic**

This is the foundation for the cache-organization topic (associativity, write policies, MESI coherence), for virtual memory and the TLB (the page walk is just another hierarchy traversal, cached), and for out-of-order execution — whose whole purpose is to find independent work to do while a load misses to DRAM. It also frames the "memory wall" that motivates SIMD, prefetching, and cache-friendly data structures.

### Q1. Walk me through the levels of the memory hierarchy, with rough sizes and why each exists.

Top to bottom, each level trades speed for capacity:

- **Registers** — ~16–32 architectural 64-bit registers (x86-64 has 16 GPRs, AArch64 has 31); sub-nanosecond, part of the datapath. Hold the operands the ALU is working on *right now*.
- **L1 cache** — split into **L1i** (instructions) and **L1d** (data), typically **32–64 KB each per core**, ~4–5 cycles. Split so an instruction fetch and a data load can happen the same cycle.
- **L2 cache** — ~256 KB to 2 MB per core, ~12–15 cycles. A larger backstop for L1 misses; usually private per core.
- **L3 / LLC** — shared across all cores, ~8–64 MB, ~40 cycles. Enables cheap inter-core data sharing and reduces DRAM traffic.
- **DRAM (main memory)** — GBs to TBs, ~60–100 ns. Cheap, dense, volatile.
- **SSD (flash)** — hundreds of GB to TBs, ~10–100 µs. Non-volatile, no seek, block-addressed.
- **Disk / network** — TBs / effectively unbounded, milliseconds+. The bottom of the pyramid.

Each level exists because the technology one step up cannot be built at the capacity of the step below without becoming unaffordable or too slow. The hierarchy lets the system present *large-and-fast* by keeping hot data high.

### Q2. Give me the "latency numbers every programmer should know" as a table, in cycles and nanoseconds.

Representative figures for a modern ~3 GHz core (1 cycle ≈ 0.3 ns). These are *order-of-magnitude* — real numbers vary by part — but the ratios are what matter.

| Operation | ~Latency | ~Cycles | Relative |
|---|---|---|---|
| Register access | ~0.3 ns | ~1 | 1x |
| L1 cache hit | ~1 ns | ~4 | ~4x |
| L2 cache hit | ~4 ns | ~12 | ~12x |
| L3 / LLC hit | ~13 ns | ~40 | ~40x |
| Main memory (DRAM) | ~80–100 ns | ~200–300 | ~250x |
| SSD random read | ~16 µs | ~50,000 | ~50,000x |
| Datacenter round trip | ~0.5 ms | ~1,500,000 | ~1.5M x |
| Disk seek (HDD) | ~5–10 ms | ~30,000,000 | ~30M x |
| Network US→Europe→US | ~150 ms | ~450,000,000 | ~450M x |

The load-bearing takeaway: the jump from L3 (~40 cycles) to DRAM (~250 cycles) is the cliff most hot code falls off. An L1 hit and a DRAM miss differ by ~50x, and the DRAM access alone is ~200 instructions the core could have retired.

### Q3. Explain temporal and spatial locality with a concrete example.

**Temporal locality** — reuse of the *same* address over time. In `for (i=0;i<n;i++) sum += a[i];`, the variables `sum` and `i` are touched every iteration; they live in registers/L1 and stay hot.

**Spatial locality** — use of *nearby* addresses. That same loop walks `a[0], a[1], a[2]…` in sequence. Because a cache line is 64 bytes, one miss on `a[0]` pulls in `a[0..15]` (for 4-byte ints), so the next 15 accesses are free L1 hits, and the hardware prefetcher spots the stride and pulls the *next* line before you ask. That's why a contiguous array scan runs near memory bandwidth, while a linked list of the same values — nodes scattered across the heap — misses on nearly every `->next` and runs an order of magnitude slower despite identical Big-O. Locality, not asymptotic complexity, is the difference.

### Q4. How expensive is a cache miss, really? Put it in instructions-lost terms.

A miss all the way to DRAM costs ~200–300 cycles. On a modern superscalar core retiring ~4 instructions/cycle, that's **~800–1200 instruction slots** of potential work stalled on a single load if nothing else can proceed. In practice out-of-order execution hides *some* of it by running independent instructions during the miss (that is literally why OoO exists — see the OoO topic), and multiple misses can overlap ("memory-level parallelism"). But dependent, pointer-chasing code — where each load's address comes from the previous load — cannot overlap and eats the full penalty per hop. This is why "reduce cache misses" often beats "reduce instruction count": one avoided DRAM miss can be worth a hundred saved arithmetic ops.

### Q5. Compare latency and bandwidth — why do people conflate them, and when does each dominate?

**Latency** is how long one access takes; **bandwidth** is how many bytes/second you can sustain with many in flight. DRAM today offers, say, ~50 GB/s of bandwidth but ~80 ns per random access — those describe different regimes.

- **Bandwidth-bound**: streaming a large array, a memcpy, a matrix multiply's inner loop. Accesses are predictable and can be pipelined/prefetched, so throughput is what counts. Wider memory channels and SIMD help.
- **Latency-bound**: chasing pointers, hash-table probes, tree traversals. Each access depends on the last, so you pay full latency serially and extra bandwidth is useless.

The mnemonic: bandwidth you can buy with more channels and parallelism; latency is closer to a law of physics. A useful relation is **Little's Law** — the number of outstanding requests needed to saturate bandwidth = bandwidth × latency; if the program can't keep that many loads in flight, it's latency-bound.

### Q6. What is the "memory wall" and how have architects responded to it?

The **memory wall** is the widening gap between how fast CPUs can compute and how fast DRAM can deliver data. From the 1980s to the 2000s CPU clock/IPC grew far faster than DRAM latency improved (DRAM latency has barely moved in decades — it's still ~50–100 ns), so memory, not arithmetic, became the bottleneck for most workloads. Architects couldn't make DRAM much faster, so they attacked it structurally:

- **Deeper cache hierarchies** (L1/L2/L3) to catch most accesses before DRAM.
- **Hardware prefetching** to fetch lines before they're demanded.
- **Out-of-order / larger instruction windows** to find independent work during misses.
- **More memory-level parallelism** — many outstanding misses at once (MSHRs / miss-status registers).
- **Wider memory** (more channels, HBM stacked DRAM) to raise bandwidth even if latency is stuck.

The wall is why doubling core count without feeding it enough bandwidth ("bandwidth wall") yields diminishing returns, and why cache-conscious code matters more than ever.

### Q7. How do caches actually exploit locality — what happens mechanically on an access?

On a load, the core indexes the L1 cache with part of the address and checks the tags for a match:

- **Hit**: the 64-byte line is present; the requested bytes are returned in ~4 cycles. Exploits **temporal locality** — data recently fetched is still resident.
- **Miss**: the line isn't there. The request goes to L2, then L3, then DRAM, and the *whole 64-byte line* is fetched and installed at each level on the way up, evicting some existing line (per the replacement policy, typically pseudo-LRU). Exploits **spatial locality** — because a whole line is loaded, the neighbours of the missed byte become future hits.

Alongside this, a **stride/stream prefetcher** watches the access pattern and, on detecting sequential or regular-stride access, issues fetches for lines you haven't asked for yet, so the demand miss never stalls. The net effect: for locality-rich code the average access time (AMAT = hit-time + miss-rate × miss-penalty) collapses toward L1 latency even though capacity is DRAM-sized. Coherence and write policies for these lines are covered in the cache-organization topic; the OS's page-replacement *policy* for DRAM is in the Operating Systems primer.

### Q8. Worked example: same data, two layouts — quantify the difference.

Sum one field over 10 million records, each record 64 bytes with an 8-byte `value` field.

**Array-of-structs, sequential**: you walk memory linearly. Each 64-byte line holds exactly one record, so it's one miss per record — but the prefetcher hides nearly all of it, and effective throughput approaches DRAM bandwidth. Call it ~1 useful access per line, streamed: on the order of a few ns amortized per record.

**Struct-of-arrays (just the `value` column, 8 bytes each, contiguous)**: now one 64-byte line holds **8 values**, so you take one miss per 8 records — 8x fewer lines touched, 8x less bandwidth, and it's still perfectly prefetchable. This is often ~5–8x faster for the summation.

**Random access (indices shuffled) over the array-of-structs**: every record is a fresh line, the prefetcher can't predict the pattern, and accesses are latency-bound at ~80 ns each — roughly **~20–50x slower** than the sequential SoA scan. Identical O(n) work; the layout and access order move performance by an order of magnitude. That's the whole lesson of the hierarchy in one example.

### Q9. Why can't we just build one giant fast cache and skip the hierarchy?

Three reasons, all physical/economic. First, **SRAM is expensive and low-density** — 6 transistors per bit versus DRAM's ~1; a register-speed store the size of DRAM would cost orders of magnitude more and not fit on the die. Second, **bigger is slower**: access latency grows with array size (more bits to decode, longer wires, more capacitance), so a 32 MB structure simply *cannot* be accessed in 4 cycles — the speed of L1 depends on it being small. Third, **power and area**: large fast SRAM burns static power and dominates the die. The hierarchy is the optimal answer: a tiny very-fast level catches most accesses, backed by progressively larger, slower, cheaper levels, so you approximate "all data at L1 speed" for a fraction of the cost. It's a caching strategy forced by the fact that no single technology is simultaneously fast, big, and cheap.

### Q10. The interview one-liner: the memory hierarchy in one crisp paragraph.

The memory hierarchy layers storage — registers, L1/L2/L3 caches, DRAM, SSD, disk, network — where each step down is roughly 10x bigger, cheaper, and slower, because no single technology is fast, dense, and cheap at once; it works because programs exhibit temporal locality (reuse) and spatial locality (neighbours), so the hardware keeps recently- and soon-to-be-used data close and, betting correctly most of the time, makes a DRAM-sized system feel L1-fast. The numbers that matter: L1 ~4 cycles, L2 ~12, L3 ~40, DRAM ~200+ cycles/~80 ns, SSD ~tens of µs, disk/network ~ms — so a cache miss to DRAM costs hundreds of lost instructions, which is why data *layout* and *access order* often beat algorithmic complexity, and why the "memory wall" (compute outrunning DRAM latency) is the defining performance constraint of modern architecture.


## Caches — Organization & Policy

### Summary

**What this topic covers**
This topic is about the on-chip SRAM caches that sit between the CPU core and DRAM, and the design decisions that govern them: how a cache is carved into lines, how an address maps to a location (direct-mapped, set-associative, fully-associative), how the tag/index/offset split works, which line gets evicted (replacement policy), what happens on a store (write policy), why misses happen at all (the three C's), how multi-level caches relate (inclusive/exclusive/NINE), and how the cache interacts with virtual memory (VIPT and friends). This is pure microarchitecture — the numbers that turn a 4-cycle L1 hit into a 200+-cycle DRAM miss and dominate the performance of real code. The OS owns page **replacement** and address-space policy; here we care only about what the hardware does on each access.

**Mental model**
A cache is a hardware hash table with a fixed, tiny number of slots per bucket. The "hash" is dead simple: take the physical (or virtual) address, chop off the low **offset** bits (which byte within a line), use the next **index** bits to pick a **set** (the bucket), and compare the remaining **tag** bits against every line in that set in parallel. Associativity is just the bucket depth: direct-mapped is one line per bucket (one comparator, fastest, most conflicts), fully-associative is one giant bucket (a comparator per line — a CAM — used only for tiny structures like TLBs), and N-way set-associative is the practical middle (typically 4–16 ways). Everything else — replacement, write policy, the C's — is bookkeeping layered on top of that lookup. Once you see "index picks the set, tag confirms the line, offset picks the byte," the whole subject collapses into arithmetic.

**Key terms**
- **Cache line / block** — the unit of transfer and tagging, almost universally **64 bytes** on x86-64 and ARM. You never fetch one byte from DRAM; you fetch a whole line.
- **Set** — a group of lines the index maps to; a lookup searches all ways in one set.
- **Way / associativity** — number of lines per set. L1D is often 8-way, L2 8–16-way, LLC 12–20-way.
- **Tag / index / offset** — the three fields an address is split into for lookup.
- **Valid bit / dirty bit** — is this line's data live; has it been modified since load (write-back only).
- **Replacement policy** — which line in a full set to evict: LRU, pseudo-LRU, random, RRIP.
- **Write policy** — write-back vs write-through; write-allocate vs no-write-allocate.
- **Write buffer / store buffer** — small queue that lets stores retire without stalling on the write.
- **The three C's** — compulsory, capacity, conflict misses (Hill's taxonomy).
- **Inclusion** — inclusive / exclusive / NINE relationship between cache levels.
- **VIPT** — virtually-indexed, physically-tagged: index the cache with the virtual address while translating, then tag-match on the physical address.
- **MSHR** — miss-status handling register; tracks outstanding misses so a non-blocking cache keeps serving hits.

**Why interviewers ask this**
Caches are the single highest-leverage topic for performance-sensitive roles, and they separate juniors from seniors cleanly. A junior can define "cache miss" and maybe recite the memory hierarchy. A senior can take a 48-bit address, a "32 KB, 8-way, 64 B line" spec, and derive the tag/index/offset split on the spot; explain why a stride-4096 access pattern thrashes an 8-way L1; reason about false sharing from the 64-byte line; and know that write-back plus write-allocate is the default and *why*. Interviewers use this to test whether you actually understand the machine your code runs on, because these facts directly explain 10x performance swings that no amount of algorithmic Big-O reasoning predicts.

**Common confusions**
- "Bigger cache is always faster" → capacity helps capacity misses but raises hit latency and power; associativity and line size matter as much.
- "The cache stores individual bytes/words" → it stores whole 64 B lines; a single-byte load pulls in 64 B and adjacent accesses ride for free (spatial locality).
- "Set-associative means slower because it searches" → all ways are compared in parallel by hardware; associativity costs area/power, not lookup cycles.
- "Write-through is safer so it's the default" → write-back is the default on-chip; write-through wastes bandwidth and is rare except in some L1s coupled to a write buffer.
- "Fully-associative eliminates conflict misses so use it everywhere" → the CAM cost is prohibitive beyond a few dozen entries; that's why real L1/L2 are set-associative.

**What follows from this topic**
The lookup here is what makes cache *coherence* (MESI/MOESI, covered in the coherence topic) and the *memory hierarchy* latency ladder meaningful — a coherence protocol operates on exactly these lines and dirty bits. The virtual-address angle (VIPT, the page-color constraint) connects to the **TLB and virtual memory** topic, and the store-buffer machinery here is the hardware substrate under the software memory model owned by the Concurrency primer. Prefetching and the three C's feed directly into how you *tune* real code.

### Q1. Walk me through what a cache line is and why 64 bytes.

A cache line (or block) is the atomic unit of allocation, transfer, tagging, and coherence in the cache. Everything happens at line granularity: a miss brings in a whole line from the next level, the tag identifies a whole line, and coherence protocols track state per line. On essentially all modern x86-64 (Intel, AMD) and 64-bit ARM designs, the line is **64 bytes**. That size is a compromise: larger lines amortize the fixed per-access DRAM latency over more bytes and exploit spatial locality (fetching a[i] gets a[i+1..i+7] of an 8-byte-element array for free), but they waste bandwidth and cache capacity when locality is poor, and they worsen **false sharing** — two threads touching different variables that land on the same 64 B line ping-pong the line between cores. 64 B has been the sweet spot for two decades. Practically, it means the low 6 bits of an address (log2 64) are the **offset** and never participate in which line you hit.

### Q2. Compare direct-mapped, set-associative, and fully-associative.

They differ only in how many places a given address may live.

- **Direct-mapped (1-way):** each address maps to exactly one line. One tag comparator, lowest latency and power, simplest. But two hot addresses that map to the same line evict each other endlessly (conflict misses), even when the rest of the cache is empty.
- **Fully-associative:** an address may live in *any* line. Zero conflict misses. But you need a comparator (CAM) per line, so it only scales to tiny structures — TLBs (e.g. 64 entries) and victim caches. You'd never build a 32 KB fully-associative cache.
- **N-way set-associative:** the practical middle. Lines are grouped into sets of N; an address maps to one set and may occupy any of its N ways, all compared in parallel. Typical: L1 8-way, L2 8–16-way, LLC 12–20-way. Each doubling of associativity roughly halves conflict misses with diminishing returns; beyond ~8–16 ways the miss-rate gain rarely justifies the added area, energy, and hit latency.

Rule of thumb (the "2:1 cache rule"): a direct-mapped cache of size N has about the same miss rate as a 2-way cache of size N/2.

### Q3. Work through the tag/index/offset split for a concrete cache.

Take a **32 KB, 8-way set-associative, 64 B line** L1 with **48-bit physical addresses** (typical x86-64 physical width).

- **Offset:** 64 B line → log2 64 = **6 bits**. Selects the byte within the line.
- **Number of sets:** total lines = 32 KB / 64 B = 512 lines. With 8 ways, sets = 512 / 8 = **64 sets**.
- **Index:** log2 64 = **6 bits**. Selects the set.
- **Tag:** the rest = 48 − 6 − 6 = **36 bits**. Stored alongside each line and compared to confirm a hit.

So address bits [5:0] = offset, [11:6] = index, [47:12] = tag. Note that [11:0] — the offset+index — are exactly the low 12 bits, i.e. the **page offset** of a 4 KB page. That's not a coincidence and it's what makes VIPT work (Q10): those 12 bits are identical in the virtual and physical address, so you can index with the virtual address while the TLB translates the tag. If you increased the cache to 64 KB by doubling sets to 128, the index would grow to 7 bits and now overlap the page frame — the page-color problem.

### Q4. How does the replacement policy work, and why is true LRU rare?

When a miss lands in a set whose ways are all valid, one must be evicted. True **LRU** (evict the least-recently-used way) is the theoretical target, but tracking exact recency order for N ways costs roughly N·log2(N) bits per set and complex update logic — expensive for 8- or 16-way caches. So real hardware uses approximations:

- **Pseudo-LRU (tree-PLRU):** a binary tree of 1-bit flags, N−1 bits per set, points "away" from the approximately-most-recent way. Cheap, close to LRU in hit rate. Common in L1/L2.
- **Random / round-robin:** one LFSR or counter for the whole cache. Almost free, and surprisingly competitive at high associativity where LRU's advantage shrinks. ARM has shipped random replacement in L1s.
- **RRIP / DRRIP (re-reference interval prediction):** modern LLC policy that predicts whether a line will be reused soon; handles scan/streaming patterns that defeat LRU (one pass over a big array evicts everything useful). Intel LLCs use RRIP-family policies.

The senior point: LRU is provably good for locality but pathological for streaming, so real designs bias toward scan-resistant approximations, not textbook LRU.

### Q5. Explain write-back vs write-through, and write-allocate vs no-write-allocate.

Two orthogonal decisions on a store.

**On a write hit — where does the update go?**
- **Write-through:** update the line *and* immediately push the write to the next level. Keeps levels consistent and simplifies coherence, but generates huge write traffic. Only viable behind a **write buffer** that absorbs the stores so the core doesn't stall.
- **Write-back:** update only this level's line and set its **dirty bit**. The line is written to the next level lazily, on eviction. Far less traffic (many writes to the same line collapse into one write-back). This is the default for on-chip caches.

**On a write miss — do we pull the line in?**
- **Write-allocate (fetch-on-write):** load the missing line into the cache, then apply the store. Pays off when the store is followed by more accesses to the line.
- **No-write-allocate (write-around):** send the store straight to the next level, don't cache it. Good for write-once streaming that won't be re-read.

The standard pairing is **write-back + write-allocate** (both bet on temporal/spatial reuse) and **write-through + no-write-allocate** (both bet against reuse). The dirty bit exists only in write-back caches; on eviction, a clean line is silently dropped while a dirty line must be written back — which is why a cache miss can cost *two* memory transactions (write-back the victim, fetch the new line).

### Q6. What is a write buffer / store buffer and why does it matter?

A **store/write buffer** is a small FIFO of pending stores between the core and the cache. When the core executes a store, it drops the address+data into the buffer and *retires the instruction* without waiting for the write to reach cache or memory — critical because a write-through would otherwise stall on every store, and even write-back stores can miss. The cache drains the buffer in the background, and loads to the same address are satisfied by **store-to-load forwarding** from the buffer. The architectural consequence is huge: the store buffer is precisely why a core can observe its *own* stores before other cores do, which is the hardware root of **x86-TSO** and store-load reordering. That memory-ordering semantics — fences, `mfence`, acquire/release — is where this connects to the software memory model owned by the Concurrency primer; here we just note the buffer is the physical cause.

### Q7. Explain the three C's and how you reduce each.

Mark Hill's taxonomy classifies every miss:

- **Compulsory (cold) misses:** first-ever reference to a line; unavoidable in an empty cache. Reduce with **larger lines** (fetch more per miss) and **prefetching** (hardware stride prefetchers, or software `prefetcht0`) — you can't stop the first touch, but you can hide its latency or pull it in early.
- **Capacity misses:** the working set exceeds the cache, so lines are evicted and re-fetched even under perfect placement. Reduce with a **bigger cache** or, far cheaper, **better locality in software** — blocking/tiling a matrix multiply so a tile fits in L1/L2 is the canonical fix.
- **Conflict misses:** lines that *would* fit are evicted because too many map to the same set. Reduce with **higher associativity**, a **victim cache** (small fully-associative buffer for recent evictions), or changing the access stride/data layout to avoid power-of-two strides that collide on the index bits.

A quick way to separate them: compulsory = misses in an infinite cache; capacity = extra misses in a finite fully-associative cache; conflict = the remaining misses a finite set-associative cache adds over fully-associative.

### Q8. A power-of-two stride tanks my loop's performance. Why?

Because conflict misses on the cache index. In the Q3 cache, the set index is address bits [11:6], and a set repeats every 4096 bytes (2^12). If you walk an array with a stride that is a multiple of 4096 — say iterating column-major over a `double A[N][512]` where each row is 512×8 = 4096 B — every access maps to the **same 64 sets** pattern, so you use only a fraction of the cache and evict live data after just 8 accesses (8-way). The cache is mostly empty but you thrash one set. Classic symptoms: performance falls off a cliff when a dimension is a power of two, and *padding* the row to 4096+64 bytes (so successive rows land in different sets) restores it. This is why numeric libraries pad leading dimensions away from powers of two, and it's a favorite senior interview trap — the fix is data-layout, not a bigger cache.

### Q9. Inclusive vs exclusive vs NINE — what's the difference and who uses which?

This governs whether a line in an inner cache (L1) must also sit in the outer cache (L2/LLC).

- **Inclusive:** every line in L1 is guaranteed present in the LLC. Simplifies coherence — a snoop from another core only needs to check the LLC; if it's absent there, it's absent everywhere, so the LLC acts as a snoop filter. Cost: the LLC wastes capacity duplicating L1/L2 contents, and evicting a line from the LLC forces a **back-invalidation** of the inner copy. Older Intel client LLCs were inclusive.
- **Exclusive:** a line lives in exactly one level; L1 and L2 never hold the same line. Maximizes effective capacity (total = sum of levels), so it's popular when the L2/L3 isn't much bigger than L1+L2. AMD has used exclusive/victim-style L3s. Cost: more complex fills (lines swap between levels on hit/miss) and coherence must probe multiple levels.
- **NINE (non-inclusive non-exclusive):** no guarantee either way — a line *may* be duplicated but isn't required to be. Most flexible; needs a separate snoop filter since the LLC is no longer a reliable directory. Intel's server (Skylake-SP onward) mesh LLCs went non-inclusive with a snoop filter.

The tradeoff is capacity efficiency vs coherence simplicity.

### Q10. Explain VIPT and the aliasing problem it creates.

The CPU issues **virtual** addresses, but caches should tag with **physical** addresses (so two virtual addresses aliasing the same physical page share one line). Naively you'd translate first (physically-indexed, physically-tagged — PIPT), but that serializes the TLB lookup before the cache access, adding latency. **VIPT (virtually-indexed, physically-tagged)** overlaps them: use the virtual address's low bits to select the set *while* the TLB translates in parallel, then compare the physical tag when translation completes. It works only if the **index bits fall entirely within the page offset**, because those bits are identical in VA and PA. For a 4 KB page (12-bit offset) and 64 B lines (6-bit offset), you get 6 index bits → 64 sets → at 8-way that's exactly a 32 KB cache. That's *why* L1 caches have historically been stuck near 32 KB per way-count.

If the index spills beyond the page offset (a bigger cache), the same physical line can map to different sets via different virtual addresses — the **synonym/aliasing** problem. Fixes: increase associativity to keep index within the offset (Intel's approach), enforce **page coloring** so the OS aligns the extra bits, or detect aliases in hardware. Apple's M-series sidesteps much of this by using **16 KB pages**, which gives 14 offset bits and room for a much larger VIPT L1 (192 KB on some cores) without aliasing. The MMU/TLB and page-walk hardware is developed in the virtual-memory topic; the OS-policy side of paging lives in the OS primer.

### Q11. How expensive is a miss, really — put cycles on the hierarchy.

Representative modern figures (order-of-magnitude; exact values vary by part and frequency):

- **L1 hit:** ~4–5 cycles, ~1 ns. Fully pipelined, several accesses in flight.
- **L2 hit:** ~12–15 cycles.
- **LLC (L3) hit:** ~40–75 cycles, and higher on many-core meshes where the slice is remote.
- **DRAM (LLC miss):** ~200–350 cycles, i.e. ~60–100 ns.
- **Remote NUMA-node DRAM:** add another ~50–100 ns.

The 50–100x gap between L1 and DRAM is the entire reason caches exist. Crucially, modern caches are **non-blocking**: an out-of-order core uses **MSHRs** to track ~10–20 outstanding misses and keeps executing independent instructions and serving cache hits while a miss is pending — this **memory-level parallelism** is why a program with 30% miss rate isn't 200x slower. The senior insight: what matters isn't the miss *rate* alone but how many misses you can overlap; latency you can't hide (a pointer-chasing linked list, where each load depends on the last) is what actually kills performance, because MLP collapses to one outstanding miss.

### Q12. The interview one-liner.

A cache is a hardware hash table of fixed-size (typically 64-byte) lines: the address splits into offset (byte-in-line), index (which set), and tag (which line in the set), associativity is just how many lines share a set, and the policy knobs — LRU/pseudo-LRU replacement, write-back+write-allocate defaults with dirty bits and a store buffer, inclusive/exclusive/NINE across levels, and VIPT to overlap translation with lookup — all exist to convert a 200-cycle DRAM access into a 4-cycle hit while managing the three C's (compulsory, capacity, conflict) that decide how often you actually pay full price.


## Cache Coherence & False Sharing

### Summary

**What this topic covers**

Every core in a modern CPU has its own private L1 and L2 caches, so the same 64-byte memory line can sit in a dozen places at once. **Cache coherence** is the hardware protocol that keeps those copies consistent — it guarantees that once a core writes a location, no other core can keep reading the stale value, and that all cores agree on the order of writes to any *single* location. This topic covers the coherence problem, the **MESI** family of state machines that solve it, how coherence traffic is carried (snooping on a shared bus vs a **directory** at scale), and the performance pathologies coherence creates: **cache-line bouncing** when cores fight over one line, and **false sharing** when two threads touch *different* variables that happen to land on the same line. This is where "just add threads" quietly stops scaling.

**Mental model**

Think of each cache line as a shared document with a single-writer / multiple-reader lock enforced in hardware. Many cores may hold a read-only (Shared) copy. The instant one core wants to write, the protocol must **invalidate** every other copy first — that core now holds the only valid, Modified copy; everyone else's is gone. The unit of this bookkeeping is the **cache line (64 bytes on x86-64 and most ARM)**, never the individual variable — the hardware has no idea your `int` is logically independent of the `int` next to it. Coherence is therefore invisible when it works and brutal when it doesn't: a write that hits in your own cache costs ~4 cycles, but a write to a line another core owns costs a **coherence miss** — dozens to a couple hundred cycles while the line is snooped, invalidated, and transferred core-to-core. The mental leap for interviews: correctness is free (hardware guarantees it), but *contention on a line* is a tax you pay per write, and false sharing makes you pay it without any logical sharing at all.

**Key terms**

- **Cache coherence** — all cached copies of a *single* location eventually agree; writes to that location are serialized and propagate.
- **Cache line** — the coherence granularity (64 B typical; 128 B on Apple silicon / some POWER); the whole line moves and is invalidated as a unit.
- **MESI** — Modified, Exclusive, Shared, Invalid: the four states each line-in-a-cache can be in.
- **Snooping** — every cache watches ("snoops") a shared bus/interconnect for others' reads and writes.
- **Directory** — a scalable alternative: a per-line record of which cores hold copies, so invalidations are point-to-point, not broadcast.
- **Invalidation protocol** — a write kills other copies (dominant); vs **update protocol** — a write pushes the new value to them (rare).
- **Coherence miss** — a miss caused not by capacity/conflict but by another core having invalidated your line (also called a *communication miss*).
- **Cache-line bouncing / ping-pong** — a hot line ricochets between cores' caches under write contention.
- **False sharing** — two cores write independent variables sharing one line; the line bounces though nothing is logically shared.
- **MOESI / MESIF** — 5-state extensions (AMD / Intel) adding Owned or Forward to cut memory traffic on cache-to-cache transfers.

**Why interviewers ask this**

Coherence separates people who think "more threads = more speed" from people who know why a parallelized counter can run *slower* than the serial version. A junior explains a `volatile` keyword or a mutex — the software view. A senior explains why a lock is expensive at the *hardware* level (the lock word's line bounces between cores), diagnoses a scaling cliff as false sharing, and reaches for padding, `@Contended`, or per-thread accumulators before touching the algorithm. Expect: "what's coherence," "walk me through MESI on a shared write," "here's a struct two threads hammer — why doesn't it scale," and "how would you find and fix false sharing." Strong answers use numbers (line size, coherence-miss latency) and name real tools (`perf c2c`).

**Common confusions**

- **Coherence ≠ consistency.** Coherence is about *one* location across caches; consistency (memory model / ordering across *different* locations) is the next topic. Coherence being perfect tells you nothing about reordering.
- **False sharing ≠ true sharing.** True sharing = threads actually touch the same variable. False sharing = they don't, but the line does — a pure layout accident, fixable without changing logic.
- **Reads are not free under contention.** A read of a line another core holds Modified forces that core to write back / downgrade; it's a coherence event too.
- **`volatile` (Java/C#) doesn't cause coherence** — coherence is always on in hardware; `volatile` controls compiler/ordering, not cache validity.

**What follows from this topic**

Coherence guarantees per-location agreement but deliberately says nothing about ordering *across* locations — that gap is the **memory consistency model** (x86-TSO, ARM/RISC-V weak ordering, store buffers, fences), the very next topic. The store buffer that a weak model exposes is also the thing that sits *in front of* the coherent cache. The programming-model side — locks, `happens-before`, atomics APIs — lives in the Concurrency primer; here we stay on the wire: MESI, snoop traffic, and line layout.

### Q1. What problem does cache coherence solve, and why does it exist?

With private per-core caches, one physical address can be cached in several cores at once. Core A caches `X = 0`, Core B caches `X = 0`; A writes `X = 1` into *its* cache. Without a protocol, B keeps reading the stale `0` from its own cache forever — the write is invisible. Coherence is the hardware contract that prevents this. Two guarantees: (1) **write propagation** — a write by one core eventually becomes visible to all; (2) **write serialization** — all cores observe writes to *a single location* in the same total order. It exists because caches are non-negotiable for performance (DRAM is ~60–100 ns, ~200+ cycles; L1 is ~1 ns) but multi-core sharing would be incorrect without it. Crucially, coherence is scoped to **one location at a time** — it does not order writes to *different* locations relative to each other; that's the memory consistency model.

### Q2. Walk me through the MESI states and what each means.

Each cache line, in each cache, is in one of four states:

| State | Valid? | Others may hold it? | Dirty (differs from memory)? | Meaning |
|-------|--------|--------------------|------------------------------|---------|
| **M** odified | yes | no | yes | This cache has the *only* copy and has changed it; memory is stale. Must write back before anyone else reads. |
| **E** xclusive | yes | no | no | Only copy, but clean (matches memory). Can silently transition to M on a write — no bus traffic. |
| **S** hared | yes | maybe | no | One of possibly several clean read-only copies. |
| **I** nvalid | no | — | — | Not present / stale; a read or write here misses. |

The E state is the quiet performance win: a core that loads a line no one else has gets it in E, then a later write upgrades E→M **for free** (no invalidation broadcast, because it already knows it's the sole holder). Without E (a plain MSI protocol) that same write would need a bus transaction just to confirm exclusivity.

### Q3. Trace the coherence traffic when two cores read a variable and then one writes it.

Line `L`, initially in memory only, both caches Invalid.

```
1. Core A reads L      -> A misses, fetches from memory.
                          No other holder -> A gets L in EXCLUSIVE.
2. Core B reads L      -> B misses, broadcasts a read.
                          A snoops it, downgrades E -> SHARED, supplies data.
                          Both A and B now hold L in SHARED.
3. Core A writes L     -> A must gain exclusivity. Issues an
                          invalidate (RFO = Read-For-Ownership).
                          B snoops it, drops its copy S -> INVALID.
                          A goes S -> MODIFIED, write lands in A's cache.
4. Core B reads L      -> B misses (it's Invalid now). A snoops,
                          supplies the dirty line (cache-to-cache),
                          writes back / shares. A: M -> S, B: I -> S.
```

Step 3's RFO is the expensive part — the write can't complete until B's copy is dead. Step 4 is a **coherence miss**: B's data was invalidated by another core, not evicted for capacity.

### Q4. Snooping vs directory-based coherence — what's the difference and why do directories scale?

**Snooping (broadcast):** every cache watches a shared medium; each coherence action (read-for-ownership, invalidate) is broadcast, and every cache checks whether it holds that line. Simple and low-latency for small counts, but every core sees *every* transaction — traffic grows ~O(N) per event and the shared bus becomes a bottleneck. Fine up to ~8–16 cores or within one ring/cluster.

**Directory-based:** a **directory** (distributed, often co-located with the memory controller or the LLC slices) records, per line, *which* cores hold a copy and in what state. To invalidate, the home node sends messages **only** to the sharers listed — point-to-point, not broadcast. Traffic scales with the number of actual sharers, not total cores, so it's how you build 64-, 128-, and multi-socket systems. Cost: an extra directory lookup/indirection on each miss (higher latency), plus storage for the sharer bitmap. Real chips are hybrids — snoop within a cluster/CCX, directory (or a snoop filter, which is a directory used purely to *suppress* needless broadcasts) across clusters and sockets.

### Q5. Invalidation vs update protocols — why did invalidation win?

On a write, you can either **invalidate** every other copy (they'll re-fetch if they need it later) or **update** them with the new value. Update sounds friendlier — a reader that keeps reading avoids a miss. But invalidation dominates real hardware because: (1) **write bursts** — a core that writes a line many times in a row pays *one* invalidation and then writes freely into M, whereas update would broadcast every single store; (2) **producers write more than consumers read** in the common case, so paying per-write is worse; (3) update wastes bandwidth pushing values to cores that will never read them again. Invalidation is lazy and cheaper on average. Update-style schemes survive only in niches. This is also exactly why **false sharing hurts** — under invalidation, each write nukes the other core's copy, forcing a re-fetch even though the *bytes it cares about* never changed.

### Q6. What is cache-line bouncing (ping-ponging), and how expensive is it?

When multiple cores repeatedly **write** the same line, the line can only ever be Modified in one cache at a time, so ownership ricochets: Core A writes (line M in A), Core B writes (invalidate A, transfer, M in B), A writes again (invalidate B, transfer back)… Each hop is a **coherence miss served core-to-core**. Ballpark costs: L1 hit ~4 cycles, L2 ~12, LLC ~40, DRAM ~200+, and a **cross-core cache-to-cache transfer is roughly LLC-to-DRAM territory — tens to low-hundreds of cycles, worse across sockets** (a remote-socket transfer can be 100–300+ ns). So a tight loop that would be ~4 cycles/iteration on private data becomes dozens–hundreds of cycles/iteration once the line bounces. This is why a naive shared atomic counter incremented by 16 threads can be *slower* than one thread: you've serialized them through the coherence fabric.

### Q7. Explain false sharing with a concrete example.

False sharing is cache-line bouncing with **no logical sharing** — the threads touch different variables that merely coexist on one 64-byte line.

```c
struct counters { long a; long b; };   // 8 + 8 bytes, SAME 64B line
struct counters c;

// Thread 0 loops:  c.a++;     // only ever touches a
// Thread 1 loops:  c.b++;     // only ever touches b
```

`a` and `b` are independent, but they share a line. Every `c.a++` on core 0 invalidates core 1's copy of the line (which it needs for `b`), and vice versa. The line ping-pongs on every iteration though neither thread reads the other's variable. Result: throughput collapses, often 3–10× slower than if the two counters lived on separate lines — a pure **memory-layout accident**, not a race. The program is 100% correct; it's just paying full coherence-miss latency for sharing that exists only in the byte layout.

### Q8. How do you detect false sharing?

Symptoms first: a parallel workload that scales sub-linearly or *negatively* as you add cores, with high last-level-cache-miss or coherence-miss counts and no obvious lock. Then confirm with tools:

- **`perf c2c`** (Linux "cache-to-cache") is the purpose-built tool — it identifies HITM (hit-modified) events, showing which cache lines are shared and *which offsets within the line* different threads touch. Two threads writing different offsets of one line is the false-sharing fingerprint.
- **`perf stat`** watching `mem_load_l3_hit_retired.xsnp_hitm` / cross-core HITM counters, or Intel VTune's "Contested Accesses" analysis.
- Reasoning from layout: look for hot per-thread fields packed into one struct/array with stride < 64 B (classic: `int results[NUM_THREADS]`, each thread writing its own slot on the same line).

The tell is always the same: a hot line, multiple cores, and *different byte offsets* — logically private data, physically shared line.

### Q9. How do you fix false sharing?

Force the contended data onto **separate cache lines**:

- **Padding** — pad each hot item out to 64 bytes so neighbors land on different lines:
  ```c
  struct counter { long v; char pad[64 - sizeof(long)]; };
  struct counter counters[N];   // each on its own line
  ```
- **Alignment** — `alignas(64)` (C++), `__attribute__((aligned(64)))`, or align allocations to the line size so a hot field starts a fresh line.
- **`@Contended`** — Java's `jdk.internal.vm.annotation.Contended` (needs `-XX:-RestrictContended`) tells the JVM to pad a field/class; the JDK uses it on `LongAdder` cells and the striped counters inside `ConcurrentHashMap`. .NET has no annotation but the same padding trick is common.
- **Per-thread / thread-local accumulation** — the best fix: give each thread its *own* line (or its own variable) and combine at the end. Java's `LongAdder` beats `AtomicLong` under contention precisely by striping across padded cells and summing lazily. This turns a bouncing line into N independent lines.

Tradeoff: padding wastes cache (a `long` now occupies a full 64 B line), so pad only genuinely hot, contended data — over-padding blows your cache footprint and hurts everything else. Note Apple silicon and some CPUs prefetch line *pairs*, so 128-byte padding is sometimes needed to fully isolate.

### Q10. What do MOESI and MESIF add over MESI, and why?

Both are 5-state extensions that optimize the case where a *dirty* line is shared, avoiding a needless write-back to memory.

- **MOESI** (AMD) adds **Owned**. In MESI, if core A holds a line Modified and core B wants to read it, A must write the dirty line back to memory (or downgrade to S with a write-back) before sharing. MOESI lets A keep the dirty data in the **Owned** state — A stays responsible for the line and supplies it directly to B **cache-to-cache without writing back to DRAM**. Others hold it Shared; A (Owner) still has the authoritative dirty copy. Saves memory bandwidth on shared-dirty data.
- **MESIF** (Intel) adds **Forward**. When a clean line is Shared across several caches and a new core requests it, *which* sharer answers? In plain MESI, memory answers or multiple caches respond redundantly. MESIF designates exactly **one** sharer as the **F** (Forward) copy — the single, designated responder — so cache-to-cache transfer is fast and unambiguous, and memory stays out of it. F is the most-recently-acquired sharer and passes the token on.

Both are latency/bandwidth optimizations on the same MESI skeleton; the correctness model (invalidate before write, one writer) is unchanged.

### Q11. Why can a mutex or an atomic counter become a hardware scalability bottleneck?

Because the lock word (or the atomic variable) is *one cache line*, and every core contending for it must acquire that line **Modified** to do its compare-and-swap / test-and-set. So the lock line ping-pongs across all contending cores — the coherence fabric, not the critical section, becomes the limit. A `lock cmpxchg` on x86 costs ~15–25 cycles uncontended but balloons to hundreds under contention as the line bounces, and the cost grows with core count and especially across sockets. This is *true* sharing (they really do all touch the lock), so padding won't help — the fixes are algorithmic: reduce contention (sharding, per-thread structures, `LongAdder`-style striping), use back-off or MCS/CLH queue locks that spin on a *local* line instead of the shared one, or avoid the shared write entirely. The lock APIs and memory-ordering semantics themselves are the Concurrency primer's territory; the point here is *why* they cost what they cost — coherence traffic on a hot line.

### Q12. The interview one-liner: cache coherence in one crisp paragraph.

Because every core caches memory privately, hardware runs a **coherence protocol — MESI and its MOESI/MESIF cousins** — that keeps all copies of any single 64-byte line in agreement: a write forces every other copy to **Invalid** (invalidation beats update because writers burst), so at most one core holds a line **Modified** at a time. Coherence is about *one location*; ordering *across* locations is the separate consistency model. It's carried by **snooping** (broadcast, small scale) or a **directory / snoop filter** (point-to-point messages to just the sharers, which is how you scale past ~16 cores and across sockets). Correctness is free, but contention isn't: a hot line **bounces** between cores at coherence-miss latency (tens-to-hundreds of cycles, worse cross-socket), and **false sharing** — two threads writing *different* variables that happen to share a line — pays that tax with zero logical sharing. Detect it with `perf c2c`; fix it by moving the data onto separate lines (padding, `alignas(64)`, `@Contended`) or, best, giving each thread its own line.


## Memory Consistency Models & Fences

### Summary

**What this topic covers**
A memory consistency model is the contract between hardware and software about the order in which one core's memory operations (loads and stores) become visible to other cores. Coherence (the previous topic) guarantees that all cores eventually agree on the value of a *single* location; consistency governs the allowed interleavings *across different* locations. This topic sits squarely in the hardware lane: store buffers, the reorderings a CPU is permitted to perform, and the barrier instructions (`mfence`, `dmb`, `fence`) that claw ordering back when you need it. The programming-model side — locks, `happens-before`, the C++/Java atomics API and their `memory_order` enums — is covered in the Concurrency primer; here we care about *why the metal reorders and what instruction fixes it*.

**Mental model**
Picture each core writing not to memory directly but to a private FIFO **store buffer** in front of its L1. A store retires into the buffer instantly so the pipeline never stalls; the buffer drains into the coherent cache later. The consequence: your *own* later loads can be satisfied from the buffer (store-to-load forwarding), but *another core's* loads can't see your store until it drains. So two cores can each write a flag, then each read the *other's* flag as still zero — a globally impossible interleaving under a naive mental model, yet perfectly legal hardware behaviour. That single structure — the store buffer — explains almost every surprising reordering on x86. Weaker ISAs (ARM, RISC-V) add more: loads and stores to *different* addresses can reorder freely in the memory system too. A **fence** is simply an instruction that forces buffered/in-flight operations to a defined ordering point before later ones proceed.

**Key terms**
- **Consistency model** — the set of memory-operation orderings a machine may expose to other cores.
- **Sequential consistency (SC)** — result equals *some* interleaving of the per-core program orders, with each core's order preserved. Intuitive, expensive.
- **Program order vs global/memory order** — the order in your source vs the order writes actually become visible.
- **Store buffer** — per-core FIFO that lets stores retire before reaching coherent cache; source of **store→load reordering**.
- **x86-TSO** — Total Store Order: x86's strong model; only store-then-load (to different addresses) reorders.
- **Weak / relaxed model** — ARMv8, RISC-V: loads and stores to different addresses reorder unless fenced.
- **Barrier / fence** — instruction (`mfence`, `dmb ish`, RISC-V `fence`) enforcing an ordering point.
- **Acquire / release** — one-directional ordering: acquire keeps later ops after it, release keeps earlier ops before it.
- **Store-to-load forwarding** — a core reads its own not-yet-drained store from the buffer.
- **Data dependency ordering** — on ARM/RISC-V, an address/data dependency orders two loads without a fence.

**Why interviewers ask this**
It separates engineers who *use* locks from those who understand *why* lock-free code is hard. A junior says "the CPU executes my instructions in order." A senior knows the hardware and the compiler both reorder, can name x86-TSO's single relaxation (store→load), knows ARM is weakly ordered so code that "works on my Intel laptop" breaks on Apple silicon or Graviton, and can point to where a fence or an acquire/release atomic is actually required. It's the concept behind Dekker's/Peterson's algorithms failing without fences, double-checked locking bugs, and the cost of `seq_cst`. Anyone writing schedulers, ring buffers, or drivers must know it.

**Common confusions**
- *Coherence solves ordering* → No. Coherence is per-location; consistency is cross-location. You can be fully coherent and still reorder.
- *x86 is sequentially consistent* → No. It's TSO — store→load reordering is real; Dekker's algorithm needs an `mfence`.
- *`volatile` (C/C++) gives ordering* → No. It stops compiler caching of a variable but emits no fence and permits hardware reordering; use atomics.
- *A fence flushes caches* → No. It orders *this core's* accesses relative to the ordering point; coherence already propagates values.
- *Only hardware reorders* → The compiler reorders too; you need both a compiler barrier and a hardware fence, which atomics provide together.

**What follows from this topic**
This is the capstone of the memory-system arc: it builds directly on cache **coherence** (MESI) and the **memory hierarchy**, and it's the hardware substrate under everything in the Concurrency primer. The acquire/release semantics here map onto the atomics API there; the store buffer here explains the lock-free data structures there. It also connects back to **out-of-order execution** — the reorder buffer commits in program order, but the store buffer is precisely where that in-order commitment is relaxed with respect to other cores.

### Q1. What exactly is a memory consistency model, and how does it differ from cache coherence?

Coherence is a per-address guarantee: all cores see writes to *one* location in a single agreed order, and a read returns the most recent write to *that* location. Consistency is the broader contract about ordering across *multiple* locations — given a core does `store X; store Y`, when (and in what order) do other cores observe X and Y? A system can be perfectly coherent yet allow another core to see Y updated before X. The consistency model is the precise specification of which such reorderings are permitted, and it's what you reason about when writing synchronization. Coherence is the mechanism; consistency is the observable contract.

### Q2. Define sequential consistency and explain why hardware doesn't give it for free.

Sequential consistency (Lamport, 1979): the result of any execution is the same as if all cores' operations were executed in *some* single total order, and within that order each core's operations appear in its program order. It's the model most programmers intuitively assume. Hardware doesn't provide it for free because SC would force every store to be globally visible before the next memory op on that core proceeds — meaning every store stalls the pipeline until it reaches coherent cache (potentially tens to hundreds of cycles on a miss). That kills performance. So real CPUs interpose store buffers and allow reorderings, trading the intuitive model for throughput, and hand you fences to recover SC-like ordering only where you pay for it.

### Q3. Walk me through how a store buffer causes store→load reordering.

Each core has a private FIFO store buffer between the pipeline and L1. When core A executes `store flagA = 1`, the value is written into A's store buffer and the instruction retires immediately — it hasn't reached coherent cache yet. A then executes `load flagB`. That load goes to the cache/coherence system and can complete *before* A's buffered store to flagA has drained. From another core's perspective, A's load appears to happen before A's store — a store→load reorder. The classic demonstration: two cores each do `store myflag=1; load otherflag`. Both stores sit in respective buffers, both loads read the still-zero other flag from cache. Both read 0 — impossible under SC, routine under TSO. Note store-to-load *forwarding*: A's own later load of flagA sees 1 from its buffer, even though other cores don't yet.

### Q4. Compare x86-TSO with ARM/RISC-V weak models. What can reorder on each?

x86 implements **TSO (Total Store Order)**, a *strong* model. The only reordering it exposes is store→load (a later load to a *different* address may pass an earlier buffered store). Load→load, store→store, and load→store orderings are all preserved; stores from any single core are seen by all others in program order (that's the "total store order"). This is why a lot of sloppy lock-free code accidentally works on Intel/AMD.

ARMv8 (AArch64) and RISC-V are **weakly/relaxed ordered**. Independent loads and stores to different addresses may reorder in essentially all four combinations unless a dependency or a barrier forbids it. There's no global store order guarantee by default. Consequences: code validated on x86 frequently exhibits real bugs on Apple M-series, AWS Graviton, or Ampere. Weak models let the hardware be simpler and faster but push the ordering burden onto software via explicit fences and acquire/release loads/stores (ARM's `ldar`/`stlr`).

### Q5. What are the x86 fence instructions and when do you actually need `mfence`?

x86 has three: `sfence` (orders stores before it against stores after it — mainly relevant for weakly-ordered write-combining/non-temporal stores), `lfence` (orders loads and also serializes the instruction stream — often used as a speculation/`rdtsc` barrier post-Spectre), and `mfence` (full barrier: no load or store may cross it in either direction). Because TSO only reorders store→load, the *only* reordering you need `mfence` to prevent in normal cacheable memory is exactly that store→load case — e.g. Dekker's or Peterson's mutual-exclusion algorithm, where each thread writes its "want" flag then reads the other's. Without an `mfence` between the store and the load, both buffered stores let both loads read stale zeros and both threads enter the critical section. A `LOCK`-prefixed RMW (like `lock xchg`, `lock cmpxchg`) also acts as a full barrier, which is why `xchg` is the common SC store idiom on x86.

### Q6. How do acquire and release semantics work at the hardware level?

They're *one-directional* fences, cheaper than a full barrier. A **release** store guarantees every memory operation *before* it in program order is visible before the store itself becomes visible — nothing sinks below it. An **acquire** load guarantees every operation *after* it stays after — nothing hoists above it. Pair them: writer does work then `release`-stores a flag; reader `acquire`-loads the flag then reads the work, and sees it. On ARMv8 this is a single instruction each: `stlr` (store-release) and `ldar` (load-acquire), with no separate `dmb` needed — the ordering is baked into the instruction. On x86, ordinary loads are already acquire and ordinary stores already release (thanks to TSO), so acquire/release costs *nothing extra* — only full SC (store→load) needs the `mfence`/`lock`. This asymmetry is exactly why `seq_cst` is pricier than `acquire`/`release` on x86 but they're closer in cost on ARM.

### Q7. A worked example: give me a two-core litmus test that breaks and the fix.

Store buffering (SB) litmus test. Initially `x = y = 0`.

```
Core 0:            Core 1:
  store x = 1        store y = 1
  r0 = load y       r1 = load x
```

Question: can `r0 == 0 && r1 == 0`? Under SC, no — one store must be globally first. Under x86-TSO and under ARM/RISC-V: yes. Both stores sit in store buffers; both loads read the other variable from cache before either store drains, so both read 0. This is a genuine, reproducible outcome (`litmus`/`herd` tools confirm nonzero probability on real silicon). The fix: place a full fence between each store and its load — `mfence` on x86, `dmb ish` on ARM, `fence rw,rw` on RISC-V — or make the accesses `seq_cst` atomics, which the compiler lowers to exactly those fences. That forces the store to drain before the load, restoring the SC guarantee that at least one load sees 1.

### Q8. How expensive is a full memory fence, and why?

Rough numbers: a full barrier (`mfence`, or a `lock`-prefixed RMW) on modern x86 costs on the order of tens of cycles — often quoted around 20–100+ cycles depending on store-buffer occupancy, because it must wait for the store buffer to drain to a coherent point. An uncontended `lock cmpxchg` is similar. On ARM a `dmb ish` is comparable in the tens-of-cycles range. Contrast: an ordinary load that hits L1 is ~4–5 cycles, and an acquire/release op on x86 adds essentially zero. The cost is *not* flushing caches — coherence handles value propagation — it's the ordering stall: later memory ops can't start until the fence's ordering constraint is satisfied. This is why high-performance lock-free code minimizes `seq_cst` and prefers acquire/release, and why a spinlock's fast path tries to avoid full barriers.

### Q9. Do compilers reorder memory operations too, and how does that interact with hardware?

Yes — and this bites people who fix only the hardware. An optimizing compiler freely reorders, hoists, sinks, and eliminates memory accesses across a sequence as long as *single-threaded* semantics are preserved; it has no idea another thread is watching. So you need ordering at *two* levels: a **compiler barrier** (prevents the compiler from moving accesses across a point — e.g. `asm volatile("" ::: "memory")` or `std::atomic_signal_fence`) *and* a **hardware fence** (prevents the CPU/memory system from reordering at runtime). C/C++11 and Java atomics with `memory_order` are the clean answer: a single `atomic` operation with the right ordering emits *both* the compiler constraint and the appropriate machine fence/instruction. This is precisely why `volatile` (in C/C++) is insufficient for cross-thread ordering — it constrains the compiler's caching of one variable but neither orders other accesses nor emits any hardware fence. (The full programming-model treatment of atomics, `happens-before`, and locks lives in the Concurrency primer.)

### Q10. The interview one-liner: the topic in one crisp paragraph.

A memory consistency model is the hardware's contract for how one core's loads and stores become visible to others; sequential consistency is the intuitive "some global interleaving of program orders" model, but CPUs don't give it free because store buffers let a store retire before it reaches coherent cache — producing store→load reordering — so x86 offers the strong TSO model (store→load is the *only* reordering) while ARM and RISC-V are weakly ordered (loads and stores to different addresses reorder freely), and you recover the ordering you need with fences (`mfence`/`dmb`/`fence`) or, better, one-directional acquire/release operations that are near-free on x86 and single instructions (`ldar`/`stlr`) on ARM — remembering that the compiler reorders too, so correct cross-thread code needs both a compiler barrier and a hardware fence, which is exactly what the atomics API (covered in the Concurrency primer) emits for you.


## Virtual Memory, TLB & Address Translation

### Summary

**What this topic covers**

This is the hardware machinery that turns the **virtual addresses** a program emits into the **physical addresses** that reach DRAM — the part of virtual memory that lives in silicon, not in the kernel. The star is the **MMU** (memory management unit), the on-chip block that translates every load, store, and instruction fetch. Behind it sit two structures: the **page table**, an in-memory tree the hardware walks to find a translation, and the **TLB** (translation lookaside buffer), a tiny fast cache of recent translations that keeps the walk off the critical path. We cover the x86-64 multi-level radix page table (4-level, now 5-level), how a walk proceeds, why the TLB is not optional, TLB miss handling in hardware vs software, how **ASID/PCID** tags avoid flushing the TLB on every context switch, how **huge pages** stretch TLB reach, what a walk costs, and how virtual addresses interact with the L1 cache (**VIPT**). The OS-policy side — page eviction, demand paging, and the page-fault handler — is covered in the Operating Systems primer; here we stay on the hardware that makes translation fast.

**Mental model**

Every memory reference a CPU makes is virtual, and *every one* must be translated before it can touch a cache or DRAM. If translation meant walking a 4-level page table each time, you'd pay four extra dependent memory loads per access and the machine would crawl. So the MMU keeps a **cache of translations** — the TLB — right next to the core. The common case: virtual page number hits in the TLB, the physical frame comes back in ~1 cycle, done. The rare case: TLB miss, and the **page-walk hardware** climbs the page-table tree (up to four or five dependent loads), installs the result in the TLB, and retries. Think of the TLB as an L1 cache *for address translation* and the page table as the backing store behind it. The whole design exists to make the translation "tax" on memory access effectively free in steady state, and to keep it invisible to the running program.

**Key terms**

- **MMU** — the hardware that translates virtual → physical addresses on every access and checks permissions; contains the TLB and the page-walk logic.
- **Virtual / physical address** — the address the program sees vs the one that indexes DRAM; the split is what gives each process its own isolated address space.
- **Page / frame** — the fixed-size unit of translation; a virtual **page** maps to a physical **frame**. Base page = 4KB on x86-64/ARM.
- **Page table** — the in-memory data structure mapping VPN → PFN; on x86-64 a multi-level radix tree rooted at the **CR3** register.
- **VPN / PFN** — virtual page number and physical frame number; translation replaces the VPN, keeps the page offset unchanged.
- **PTE** — page table entry: the leaf holding the frame number plus permission/status bits (present, writable, user, accessed, dirty, no-execute).
- **TLB** — translation lookaside buffer: a small associative cache of recent VPN→PFN translations; the fast path of every access.
- **TLB reach** — how much memory the TLB can map without a miss = entries × page size; the metric that decides whether your working set "fits."
- **Page-table walk** — the hardware (or software) traversal of the page-table tree on a TLB miss to find the translation.
- **ASID / PCID** — address-space identifier (ARM) / process-context identifier (x86); tags TLB entries by process so a context switch needn't flush.
- **Huge page** — a 2MB or 1GB mapping that consumes one TLB entry instead of hundreds/thousands, multiplying TLB reach.
- **VIPT** — virtually-indexed, physically-tagged: the L1 cache trick that overlaps TLB lookup with cache-set indexing.

**Why interviewers ask this**

Translation is where "I know virtual memory exists" separates from "I understand why it's fast." A junior says the OS maps virtual to physical and mentions page tables. A senior knows the *hardware* does the walk, that the TLB is what makes it viable, and can quantify it: a cold 4-level walk is potentially four dependent DRAM accesses (hundreds of cycles), which is why TLB reach and huge pages matter for databases, JVMs, and large heaps. Strong candidates connect it upward (VIPT ties translation to cache design) and sideways (PCID exists because context switches used to blow the TLB, and Meltdown/KPTI made that cost real again). It's a favorite because it forces you to reason about a hidden per-access cost that never appears in your source code.

**Common confusions**

- **"The TLB caches data."** No — it caches *translations* (VPN→PFN). Data lives in L1/L2/L3. Different caches, different purpose.
- **"A TLB miss means a page fault."** No. A TLB miss is usually resolved silently by the page walker finding a valid PTE. A **page fault** happens only when the PTE is absent/invalid — that's a trap into the OS, orders of magnitude more expensive.
- **"Bigger pages are strictly better."** Huge pages boost TLB reach but waste memory (internal fragmentation), complicate copy-on-write, and can cause allocation stalls. It's a tradeoff.
- **"Every process needs a full TLB flush on context switch."** Only without ASID/PCID. Tagged TLBs let entries from multiple address spaces coexist.
- **"Translation happens after the cache."** On modern L1s it happens *in parallel* (VIPT), not before or after.

**What follows from this topic**

Translation sits directly on top of the **cache hierarchy** — the VIPT discussion here is the hinge between the two, and it constrains L1 size. It leans on the **memory hierarchy** topic for the DRAM-latency numbers that make a walk expensive. PTE permission bits (no-execute, user/supervisor) are the hardware substrate for the protection model in the OS primer. And because every load ultimately produces a physical address, this topic quietly underpins the **cache coherence** and **memory consistency** topics that follow.

### Q1. What does the MMU do, and where does it sit in the pipeline?

The **MMU** is on-chip hardware that translates a virtual address to a physical one and checks permissions, on *every* instruction fetch, load, and store. It sits between the core and the memory subsystem: the pipeline generates a virtual address, the MMU translates it (via the TLB, falling back to a page-table walk), and only the resulting physical address is presented to the caches/DRAM. Alongside translation it enforces protection — reading the PTE's permission bits (writable, user/supervisor, no-execute) and raising a fault if the access is illegal. Because it's on the critical path of memory access, the entire design is built around making the common case (TLB hit) cost roughly one cycle.

### Q2. Walk me through an x86-64 page-table walk.

x86-64 uses a **4-level radix tree** (recently extended to **5-level** for larger address spaces). A 48-bit virtual address splits into four 9-bit indices plus a 12-bit page offset:

```
[ 47..39 | 38..30 | 29..21 | 20..12 | 11..0 ]
   PML4     PDPT     PD       PT      offset
```

The **CR3** register holds the physical base of the top-level table (PML4). The walker: (1) reads CR3, indexes it with the PML4 field → address of a PDPT; (2) indexes the PDPT → a PD; (3) indexes the PD → a PT; (4) indexes the PT → the leaf **PTE**, which yields the physical frame number; (5) concatenates frame number with the 12-bit offset → physical address. That's **four dependent memory accesses**, each potentially a cache miss. 5-level paging adds a PML5 level on top, extending virtual addresses to 57 bits and physical reach for machines with terabytes of RAM. The walk result is installed in the TLB so the next access to that page is a single-cycle hit.

### Q3. Why is the TLB essential — what breaks without it?

Without a TLB, *every* memory access would trigger a full page-table walk: four dependent loads on x86-64. That means each of your loads/stores/fetches becomes ~5 memory operations, and the dependent chain can't be hidden. Memory access would be roughly 4–5× slower in the best case and catastrophically worse when the page-table nodes themselves miss in cache. The TLB collapses that to ~1 cycle on a hit. Because programs exhibit strong spatial and temporal locality at page granularity, hit rates are typically **98–99%+**, so the amortized translation cost is near zero. The TLB is what makes paged virtual memory practical at all — it's not an optimization you can turn off.

### Q4. Describe the TLB hierarchy on a modern CPU.

Modern cores have a **multi-level TLB**, mirroring the data-cache hierarchy. Typically: separate small, fast **L1 TLBs** for instructions (iTLB) and data (dTLB) — on the order of 64–128 entries each, often split by page size (a set of 4KB entries plus a smaller set for 2MB entries). Behind them sits a larger unified **L2 TLB** (often called STLB) with ~1500–3000+ entries covering both instruction and data translations. An L1 TLB miss that hits in L2 costs a handful of cycles; only an L2 miss triggers the full page walk. Rough figures: L1 TLB hit ~1 cycle, L2 TLB hit ~7–10 cycles, full walk tens to hundreds of cycles depending on where the page-table nodes are cached.

### Q5. What is TLB reach and why does it matter?

**TLB reach** = number of TLB entries × page size — the total amount of memory the TLB can map before it starts missing. Example: 1536 L2-TLB entries × 4KB ≈ **6MB** of reach. That sounds fine until you run a database with a 50GB working set or a JVM with a 32GB heap — the working set dwarfs TLB reach, so you take TLB misses constantly and pay page walks on data you access all the time. This is the core motivation for huge pages: 1536 entries × 2MB ≈ **3GB** reach, and with 1GB pages a handful of entries cover the whole heap. TLB reach, not TLB hit rate in a microbenchmark, is the number that predicts whether a large-memory workload will thrash the TLB.

### Q6. Hardware vs software TLB miss handling — what's the difference?

On a TLB miss, something must walk the page table. Two designs:

- **Hardware-managed (x86-64, ARM):** a dedicated **page-walk state machine** in the MMU reads the page table directly and refills the TLB, transparently to software. The page-table format is fixed by the ISA. Fast, no pipeline flush, but rigid.
- **Software-managed (classic MIPS, older SPARC):** a TLB miss raises a lightweight **trap**, and an OS handler routine walks whatever page-table structure it likes and inserts the entry with a special instruction. Flexible (the OS chooses the format) but each miss costs a trap + handler (tens of cycles minimum) and pollutes the pipeline.

Mainstream chips (x86, ARMv8) went hardware-managed because TLB misses are frequent enough that the flexibility isn't worth the per-miss trap cost. The page walker also benefits from caching page-table entries in the normal data caches, and some CPUs add dedicated **page-walk caches** for the upper tree levels.

### Q7. How do ASID/PCID avoid a TLB flush on every context switch?

Naively, TLB entries are only valid for the current address space, so switching processes means **flushing the entire TLB** — after which the new process suffers a storm of TLB misses re-walking its whole working set. Tagged TLBs fix this: each entry is stamped with an **ASID** (ARM, "address space ID") or **PCID** (x86, "process-context ID"). A lookup matches only if both the VPN *and* the tag match the currently-active context. Now entries from many processes coexist in the TLB, and a context switch just changes the active tag (on x86, load CR3 with the PCID field, using the no-flush bit) — no flush, warm TLB for a process you're returning to. This became newly important after **Meltdown/KPTI**: kernel page-table isolation split each process into two address spaces and would have doubled TLB pressure, so PCID support was essential to keep the mitigation's cost tolerable.

### Q8. How do huge pages help, and what's the catch?

A **huge page** maps a large contiguous region (2MB or 1GB on x86-64) with a *single* PTE and thus a single TLB entry, instead of 512 or 262144 base-4KB entries. Benefits: (1) massively higher **TLB reach** — fewer TLB misses for large working sets; (2) a **shorter page walk** — a 2MB page terminates at the PD level (3 loads instead of 4), 1GB at the PDPT level (2 loads). Real workloads (databases, JVMs, HPC) can see meaningful speedups. The catches: **internal fragmentation** (a barely-used 2MB mapping wastes up to ~2MB); harder allocation (needs 2MB of *contiguous* physical memory, which fragmentation can deny — Linux **Transparent Huge Pages** can stall or spend CPU compacting); coarser **copy-on-write** and dirty-tracking (a single byte written dirties the whole huge page); and NUMA placement gets clumsier. So huge pages are a targeted tool for large-footprint apps, not a universal default.

### Q9. How expensive is a page-table walk, concretely?

It depends entirely on where the page-table nodes live. Best case: all four levels are hot in the L1/L2 data cache, so a 4-level walk is ~4 fast cache accesses — maybe 10–40 cycles. Worst case: each level misses to DRAM, and you pay **four dependent DRAM latencies** — at ~60–100ns each that's potentially **240–400ns**, i.e. hundreds of cycles, and they can't be parallelized because each level's result is the address of the next. Reality is usually in between: the upper levels (PML4/PDPT) are small and stay cached, so most walks touch DRAM only for the leaf. CPUs mitigate this with dedicated **page-walk caches** for interior nodes, and by allowing multiple outstanding walks. The takeaway: a TLB *miss* is cheap-ish if warm, but a *cold* walk on a large working set is a real, measurable stall — which is exactly what huge pages target.

### Q10. What is VIPT and why do CPUs use it for L1?

**VIPT** = virtually-indexed, physically-tagged. The problem: translation must happen before you can compare cache tags (which are physical), but waiting for the TLB before even *starting* the L1 lookup serializes two slow steps. VIPT overlaps them: the cache **index** bits come from the untranslated **page offset** (the low bits that translation never changes), so the L1 can begin selecting its set *in parallel* with the TLB translating the upper bits. When the TLB returns the physical frame number, it's used only for the **tag** comparison. This gives the speed of virtual indexing with the correctness of physical tagging (no aliasing/homonym problems). The constraint: `(ways) × (page size) ≥ cache size`, i.e. index+offset bits must fit within the page offset — which is a big reason L1 caches are commonly **32–48KB, 8-way**: that ceiling, not transistor budget, caps L1 size. Bump associativity and you can grow L1 while staying VIPT-safe; that's why you see 12-way L1s on newer parts.

### Q11. What happens on a TLB miss vs a page fault — and who handles each?

They're different events with vastly different costs. On a **TLB miss**, the page walker (hardware) traverses the page table; if it finds a **present, valid PTE**, it loads the translation into the TLB and the instruction retries — all in hardware, no OS involvement, tens of cycles. A **page fault** occurs when the walk finds the PTE **not present** (page swapped out, never allocated / demand-paged, or a protection violation like writing a read-only page). *That* raises a trap into the OS page-fault handler, which decides what to do: fetch from disk (major fault, milliseconds), allocate a zero page (minor fault), apply copy-on-write, or kill the process (segfault). So: TLB miss = hardware, fast; page fault = software trap into the OS, potentially millions of times slower. The **page-replacement policy, demand paging, and the fault handler itself are covered in the Operating Systems primer** — from the hardware side, all the MMU does is raise the fault when a PTE isn't usable.

### Q12. The interview one-liner: virtual memory address translation in one crisp paragraph.

Every address a CPU emits is virtual and must be translated to physical before it reaches memory; the **MMU** does this on every access, checking permissions as it goes. Translations live in a multi-level **page table** (x86-64: a 4- or 5-level radix tree rooted at CR3), but walking it costs up to four or five dependent memory loads, so the MMU caches recent translations in the **TLB** — an L1/L2 hierarchy that turns the common case into a ~1-cycle hit. TLB **reach** (entries × page size) decides whether a large working set fits; **huge pages** (2MB/1GB) extend reach and shorten walks at the cost of fragmentation; **ASID/PCID** tags let the TLB survive context switches without a flush; and **VIPT** overlaps translation with L1 indexing so the tax is nearly invisible. A TLB miss is resolved silently in hardware; only a missing PTE escalates to an OS page fault.


## DRAM & Main Memory

### Summary

**What this topic covers**
This topic is the main-memory tier that sits below the last-level cache and above storage: the DRAM devices themselves, how they are organised into channels, DIMMs, ranks, and banks, and the electrical "dance" the memory controller performs to move a cache line in or out. It is where the tidy von-Neumann abstraction of "memory is a flat array you index in one step" collapses into a device that is slow, stateful, must be periodically refreshed, and rewards you enormously for accessing it in the right order. Everything a cache is trying to avoid — the ~60–100 ns round trip to DRAM — happens here, so understanding DRAM explains *why* caches, prefetchers, and access-pattern-friendly data structures matter. The OS-policy side (which physical frames get allocated, NUMA placement policy) lives in the OS primer; here we stay on the device and controller.

**Mental model**
Picture DRAM not as an array but as a warehouse of 2-D grids. Each **bank** is a grid of rows × columns of tiny capacitors. You cannot read a bit directly — you must first **ACTIVATE** a whole row, which destructively dumps thousands of capacitors' charge onto a strip of sense amplifiers called the **row buffer**. Now that row is "open"; reads and writes hit the row buffer at low latency. To touch a *different* row in that bank you must **PRECHARGE** (close the current row, writing it back) and ACTIVATE the new one. So DRAM has a working-set-of-one-row-per-bank behaviour: sequential/local accesses that stay in the open row are cheap (a **row hit**), and jumping around is expensive (a **row conflict**). A modern chip has many banks (8–32) across ranks and channels, so the controller keeps *many* rows open at once and interleaves requests — that parallelism is how DRAM delivers tens of GB/s of bandwidth despite each individual access taking ~15 ns just at the array.

**Key terms**
- **DRAM cell (1T1C)** — one transistor + one capacitor storing a bit as charge; dense but leaky, so it must be *refreshed* every ~64 ms (or 32 ms at high temp).
- **SRAM** — 6-transistor cell used for caches; holds state without refresh, ~an order of magnitude faster and larger per bit, so it's small and on-die.
- **Channel** — an independent memory bus/controller path; more channels = more aggregate bandwidth and independent request streams.
- **DIMM** — the physical stick; carries one or more ranks of chips.
- **Rank** — a set of chips that respond together to form the full data width (e.g. 64 bits) on a chip-select.
- **Bank** — an independent grid within a chip with its own row buffer; the unit of parallelism inside a rank.
- **Row (page)** — the unit an ACTIVATE opens into the row buffer, typically 1–8 KB.
- **Column** — the slice of an open row a READ/WRITE (CAS) actually returns, one burst.
- **Row buffer** — sense-amp latch holding the currently open row; hits are fast, misses/conflicts pay ACTIVATE/PRECHARGE.
- **Memory controller** — on-CPU engine that turns physical addresses into bank/row/column commands and schedules them under timing constraints.
- **Refresh** — periodic re-reading/rewriting of rows to fight capacitor leakage; steals a small fraction of bandwidth.
- **ECC** — extra bits (typically SECDED) that detect/correct bit flips in server/workstation memory.

**Why interviewers ask this**
A junior treats memory as uniform and O(1): "I read `arr[i]`, it takes one step." A senior knows that the *pattern* of access dominates — a sequential scan can be 5–10× faster than a random walk over the same bytes purely because of row-buffer hits and prefetch, with no change in instruction count. The signal interviewers look for: can you explain why a hash-heavy, pointer-chasing structure murders memory bandwidth while an array scan saturates it; why "latency-bound" and "bandwidth-bound" workloads need opposite fixes; and why adding memory channels helps throughput but not the latency of a single dependent load. If you can connect DRAM structure to cache line size, prefetching, and NUMA, you're demonstrating that you understand the machine and not just the language.

**Common confusions**
- *"More channels / DDR5 lowers latency."* No — wider/faster memory raises **bandwidth**; the latency of one isolated random access barely moves and has been ~50–90 ns for years.
- *"DRAM latency is one number."* It's row-hit vs row-miss vs row-conflict; the same address stream can be 15 ns or 45+ ns at the array depending on the open row.
- *"Refresh is negligible / free."* It's small (~a few % of bandwidth) but grows with capacity and heat, and it's why DRAM is *dynamic*.
- *"A rank and a bank are the same."* Rank = chips selected together for data width; bank = independent grid enabling parallelism *within* a rank.
- *"DDR is twice the clock."* The core array clock barely rises; DDR doubles by transferring on both clock edges and widening prefetch, not by running the capacitors faster.

**What follows from this topic**
DRAM is the reason the **Caches** topic exists — the memory wall it creates is what caches, prefetchers, and cache-line-aware layout fight. Its bank/row structure explains why the **Virtual Memory** page-walk (itself a chain of dependent memory loads) is so costly and why the TLB matters. The multi-channel, multi-socket picture leads into NUMA, and the controller's reordering freedom connects to the **Memory Consistency** topic (the store buffer and reordering the Concurrency primer's software memory model has to reason about).

### Q1. Why does DRAM need refreshing but SRAM does not, and what does the cell look like?

A DRAM cell is **1T1C**: one access transistor gating one tiny capacitor. A "1" is charge on the capacitor, a "0" is no charge. Capacitors leak through the transistor and substrate, so within tens of milliseconds the charge decays past the reliable threshold — hence the whole array must be **refreshed** (every row read out and written back) roughly every **64 ms** (halved to ~32 ms at high temperature). That's the "dynamic" in DRAM. The upside is density: one transistor + one capacitor is tiny, so you get gigabytes cheaply.

SRAM stores a bit in a **6-transistor** cross-coupled latch that actively holds its state as long as it's powered — no refresh, and access is far faster (sub-nanosecond at the cell). The cost is area and power: ~6× the transistors per bit, so SRAM is reserved for small, fast structures on the CPU die — register files, caches, TLBs. This density-vs-speed split is exactly why the hierarchy exists: SRAM caches (fast, small) in front of DRAM (slow, huge).

### Q2. Walk me through the hierarchy: channel, DIMM, rank, bank, row, column.

Top to bottom, coarse to fine parallelism:

- **Channel** — an independent path from the CPU's memory controller to memory, with its own address/command/data bus. A desktop CPU has 2 channels; servers have 8–12. Channels operate fully in parallel — this is where aggregate bandwidth comes from.
- **DIMM** — the physical stick you plug in. A channel may have 1–2 DIMMs.
- **Rank** — a group of DRAM chips on a DIMM selected together to form the full bus width (64 data bits, or 72 with ECC). A single-rank DIMM has one such group; dual-rank has two, giving the controller another set of banks to interleave against.
- **Bank** — inside each chip, an independent 2-D array with its **own row buffer**. DDR4 has 16 banks (4 groups × 4); DDR5 has 32 (8 groups × 4). Banks are the key parallelism unit: the controller can have a different row open in each.
- **Row (page)** — one horizontal line of the bank's grid, ~1–8 KB, opened as a unit by ACTIVATE into the row buffer.
- **Column** — the specific chunk of the open row a READ/WRITE addresses; one column access streams out a **burst** (e.g. BL8/BL16) that adds up to a 64-byte cache line.

A physical address is decoded by the controller into (channel, rank, bank, row, column). How those bits are mapped — interleaving consecutive cache lines across channels/banks — is a big lever for spreading traffic and maximising parallelism.

### Q3. What is the row buffer, and explain row hit vs row miss vs row conflict.

The **row buffer** is the strip of sense amplifiers that latches an entire row after an ACTIVATE. It's effectively a tiny per-bank cache of exactly one row. Three cases for an incoming request to a bank:

- **Row hit** — the requested row is already open in the buffer. Just issue CAS (READ/WRITE). Cheapest: you pay only `tCL` (~15 ns), no ACTIVATE.
- **Row miss (empty)** — no row is open (bank was precharged/closed). Issue ACTIVATE then CAS: pay `tRCD + tCL`.
- **Row conflict** — a *different* row is open. You must PRECHARGE the old row (write it back), then ACTIVATE the new, then CAS: pay `tRP + tRCD + tCL` — roughly **3× a row hit**.

This is why access pattern dominates. A sequential scan keeps hitting the open row (row hits), so DRAM streams near peak bandwidth. A random pointer-chase across a big structure keeps conflicting, tripling per-access latency and killing throughput. The controller's **page policy** decides what to do after a request: **open-page** leaves the row open (bets on locality — good for sequential), **closed-page** auto-precharges immediately (bets on randomness — good for scattered server traffic). Real controllers use adaptive policies that watch the access stream.

### Q4. Walk me through the ACTIVATE / READ / PRECHARGE command dance and the key timings.

To read a byte that isn't in an open row:

1. **ACTIVATE (RAS — Row Address Strobe)**: send the row address; the row's charge is dumped onto the sense amps into the row buffer. This destroys the row's charge in the array (the sense amps also restore it). Time to be ready: **`tRCD`** (RAS-to-CAS delay), ~14–18 ns.
2. **READ (CAS — Column Address Strobe)**: send the column address; after **`tCAS`/`tCL`** (CAS latency, ~13–16 ns) the burst starts streaming on the data bus.
3. **PRECHARGE**: when you're done with this row and need another in the same bank, precharge to close it — the sense amps finish writing the row back and the bit lines are pre-charged to the reference voltage for the next ACTIVATE. Cost **`tRP`** (row precharge), ~14–18 ns.

So a cold random access ≈ `tRP + tRCD + tCL` on the array (~45 ns), plus queueing, bus, and controller overhead — landing at the ~60–100 ns you see from a CPU load that misses all caches. Those DDR "timing" numbers on a spec sheet (`CL-tRCD-tRP-tRAS`, e.g. `16-18-18-38`) are these values *in clock cycles*; because faster DDR runs a faster clock, the cycle counts rise even as the *nanoseconds* stay roughly flat — which is the whole story of why latency stagnates.

### Q5. What actually doubles across DDR generations, and why doesn't latency improve?

"DDR" = **Double Data Rate**: data transfers on both the rising and falling edge of the bus clock, so the data rate is 2× the clock. Across generations the transfer rate has climbed — DDR3 ~1600 MT/s, DDR4 ~2400–3200 MT/s, DDR5 ~4800–6400+ MT/s — mostly by:

- **Widening the internal prefetch**: DDR3 fetches 8n, DDR4 8n, DDR5 16n per column access, so each array read feeds a longer, faster burst on the pins.
- **Raising the I/O clock** and improving signalling.
- **More banks / bank groups** (DDR5: 32 banks, and it splits a channel into two independent 32-bit sub-channels) for more concurrency.

What barely changes is the **DRAM core array clock** — the capacitors, sense amps, and RAS/CAS physics are stubborn. So bandwidth roughly doubles per generation while **CAS latency in nanoseconds stays ~13–16 ns** and full random latency stays ~50–90 ns. That's the crux: generations buy you *throughput*, not *latency*. Bandwidth follows Moore-ish curves; memory latency has been nearly flat for two decades. This is the "memory wall," and it's why hiding latency (caches, prefetch, out-of-order execution, MLP) matters more than raw memory speed.

### Q6. If DDR5 doubles bandwidth, why doesn't my single-threaded pointer-chasing benchmark get faster?

Because that benchmark is **latency-bound**, not bandwidth-bound. Pointer chasing issues one load, waits for the result (~70 ns), then uses it to compute the next address — a *dependent* chain. There's no parallelism to exploit: only one request is in flight, so all that extra channel bandwidth sits idle. You're paying full DRAM round-trip latency per hop, and that latency didn't improve with DDR5.

Bandwidth helps only when you have **many independent requests outstanding** — a streaming scan, or code the out-of-order engine and prefetcher can run ahead on (this is **memory-level parallelism**, MLP). A CPU can keep maybe 10–20 outstanding misses per core (limited by miss-status/handling registers, MSHRs); saturating multi-channel DDR5 usually takes several cores streaming together.

The fixes are opposite for the two regimes. Latency-bound: reduce the number of dependent misses — better data layout (arrays over linked lists), pack hot fields, hint prefetch, or restructure to expose parallel independent accesses. Bandwidth-bound: reduce bytes moved (compression, smaller types), improve locality, or add channels/cores. Diagnosing which regime you're in is the senior move.

### Q7. What does the memory controller do, and how does scheduling reorder requests?

The **memory controller** (on the CPU die in modern parts) is the traffic cop between the last-level cache and the DRAM devices. Its jobs:

- **Address decode**: map physical address → (channel, rank, bank group, bank, row, column), choosing an interleaving that spreads consecutive cache lines across channels and banks for parallelism.
- **Command scheduling**: issue ACTIVATE/READ/WRITE/PRECHARGE/REFRESH while obeying dozens of timing constraints (`tRCD`, `tRP`, `tRAS`, `tFAW` — max four ACTIVATEs per window, `tWTR` write-to-read turnaround, bus turnaround on read/write switches).
- **Reordering**: it does *not* serve requests strictly FIFO. A common policy is **FR-FCFS** (First-Ready, First-Come-First-Served): prefer requests that hit an already-open row (ready now, cheap) over older requests that would conflict. This maximises row-buffer hit rate and throughput — at the cost of fairness, which matters when multiple cores/threads contend, so real controllers add anti-starvation and QoS logic.
- **Batching writes**: reads are latency-critical and writes usually aren't, so the controller queues writes and drains them in bursts to avoid costly read/write bus turnarounds.
- **Refresh management**: schedule refreshes without stalling demand traffic.

This reordering is invisible to software correctness (the cache-coherence/consistency machinery guarantees ordering as seen by cores) but hugely visible in performance.

### Q8. How much does ECC cost, and what does it protect against?

DRAM bits flip — from cosmic rays/alpha particles (transient "soft" errors) and from failing cells (hard errors). **ECC** (Error-Correcting Code) memory adds redundancy: classic server ECC is **SECDED** — Single Error Correct, Double Error Detect — using 8 extra bits per 64-bit word (hence 72-bit-wide ECC DIMMs). It silently corrects any single-bit flip and detects (but can't correct) two-bit flips, raising a machine-check so the system doesn't consume corrupt data.

Costs: ~12.5% more DRAM chips (the 72/64 ratio), a small latency/logic overhead, and ECC DIMMs cost more — which is why consumer desktops historically skip it and servers mandate it. At scale it's not optional: a fleet of thousands of machines sees measurable bit-flip rates, and silent data corruption is far worse than a logged, corrected event. DDR5 muddies the "do I have ECC?" question by adding **on-die ECC** — every DDR5 chip corrects internal single-bit errors to keep yields up at tiny geometries — but that is *not* the same as end-to-end **link/system ECC** across the bus; a DDR5 desktop stick without the extra chip still isn't protecting the data path. Advanced server schemes (Chipkill / SDDC) go further and survive an entire chip failing.

### Q9. Worked example — put numbers on a random vs sequential access over an array.

Take a 1 GB array and sum every byte two ways, 64-byte cache lines, ~70 ns full random DRAM latency, one channel ~20 GB/s.

- **Sequential scan**: the hardware prefetcher spots the stride and runs ahead, and consecutive lines mostly hit the open row (row hits). You become **bandwidth-bound**: 1 GB ÷ 20 GB/s ≈ **50 ms**. Per 64-byte line you're effectively paying ~3 ns of *amortised* time, not 70 ns, because dozens of lines are in flight and streaming.
- **Random walk** (touch lines in random order, dependent chain): no prefetch benefit, mostly **row conflicts**, one outstanding miss at a time. 1 GB ÷ 64 B ≈ 16.7M lines × ~70 ns ≈ **1.17 seconds**.

That's a **~20×** gap over the *identical* bytes and the *identical* instruction count — driven purely by DRAM row-buffer behaviour, prefetching, and MLP. This is the concrete reason "big-O is the same" is a trap: constants set by the memory system dominate real performance, and it's why cache-friendly layouts (structure-of-arrays, contiguous storage, sorting to restore locality) win.

### Q10. Explain bank-level parallelism and why address interleaving matters.

A single bank is nearly serial: while it's mid-ACTIVATE or mid-PRECHARGE you can't start another operation in it. But a rank has 16–32 **independent** banks, each with its own row buffer, and a controller can overlap operations across them — ACTIVATE bank 3 while bank 1 streams data while bank 5 precharges. This **bank-level parallelism (BLP)** is what lets DRAM approach its rated bandwidth despite each bank's slow cycle time; it's the memory-system analogue of pipelining/superscalar in the CPU.

The catch: parallelism only materialises if concurrent requests land in *different* banks/channels. That's controlled by **address interleaving** — how physical-address bits map to (channel, bank, row, column). A good mapping puts consecutive cache lines in different channels/banks so a streaming access spreads across them; a bad one (or a pathological stride equal to the interleave period) can hammer a single bank, serialising everything and gutting bandwidth. This is real: strided accesses whose stride aliases the bank-mapping bits show sudden throughput cliffs. `tFAW` (four-activate window) also caps how aggressively you can open banks, bounding BLP by power delivery. Senior takeaway: peak DRAM bandwidth is a *parallelism* achievement, and both the controller's interleaving and your access pattern have to cooperate to reach it.

### Q11. The interview one-liner: DRAM is a warehouse of leaky capacitor grids, not a flat array — each bank holds exactly one open row in its row buffer, so accesses that stay in that row are cheap (~15 ns) and jumps to another row triple the cost (ACTIVATE + PRECHARGE + CAS, ~45+ ns at the array, ~70 ns end-to-end); DDR generations and extra channels keep doubling *bandwidth* by widening prefetch and adding banks/parallelism while random-access *latency* stays stubbornly flat, which is precisely the memory wall that caches, prefetchers, and cache-friendly data layout exist to hide.


## SIMD & Data Parallelism

### Summary

**What this topic covers**
SIMD — Single Instruction, Multiple Data — is the hardware's way of exploiting *data-level parallelism* (DLP): one instruction applies the same operation to a whole vector of elements at once. This sits alongside instruction-level parallelism (ILP, extracted by the out-of-order engine) and thread-level parallelism (TLP, exploited by multiple cores). SIMD is the throughput lever inside a *single* core: wide vector registers, wide execution ports, and instructions like "add these 16 floats to those 16 floats" in one micro-op. It is what makes matrix multiply, image filters, video codecs, hashing, JSON parsing, and ML inference fast. This topic covers the register files and their widths, the element/lane model, how you actually emit SIMD (auto-vectorization vs intrinsics vs libraries), and the sharp edges: alignment, masking, horizontal ops, gather/scatter, and the AVX-512 frequency-throttling trap.

**Mental model**
Picture a scalar ALU as a single lane of a highway and a SIMD unit as a 4-, 8-, or 16-lane one. The register is no longer a 64-bit scalar but a 128/256/512-bit *bag of lanes*. A 512-bit register holds sixteen 32-bit floats, or eight 64-bit doubles, or sixty-four bytes — you choose the element type, and the same physical bits are reinterpreted. One `VADDPS` instruction fires all lanes in lockstep through a vector ALU. The cost of the instruction is roughly the same as its scalar cousin (same latency, comparable throughput), so if you keep all lanes full you get an N× speedup essentially for free on the compute side. The catch is *feeding* it: lanes must be independent, memory must stream in contiguously and ideally aligned, and any per-lane divergence (branches) has to become a *mask* rather than a jump. SIMD rewards regular, dense, branch-free array math and punishes pointer-chasing and irregular control flow.

**Key terms**
- **DLP** — data-level parallelism; the same op over many data elements. SIMD is the hardware expression of it.
- **Vector register** — wide register holding multiple elements: `xmm` (128b), `ymm` (256b), `zmm` (512b) on x86.
- **Lane / element** — one slot in the vector; a 256-bit register is 8 lanes of `f32` or 4 lanes of `f64`.
- **Vector width** — bits per register (128/256/512); with element size it fixes the lane count.
- **Auto-vectorization** — the compiler turning scalar loops into vector instructions automatically.
- **Intrinsics** — 1:1 C/C++ functions mapping to specific SIMD instructions (`_mm256_add_ps`).
- **Mask / predication** — a per-lane on/off bit vector selecting which lanes commit (AVX-512 `k0`–`k7`, SVE/RVV predicate registers).
- **Horizontal op** — reduction *across* lanes of one register (sum-of-lanes) vs the normal *vertical* lane-parallel op.
- **Gather / scatter** — vector loads/stores from *non-contiguous* addresses given a vector of indices.
- **Alignment** — data address being a multiple of the vector width (e.g. 32B for AVX); enables faster aligned loads.
- **Scalable vectors** — ARM SVE and RISC-V V: register width is a runtime property, code is width-agnostic.

**Why interviewers ask this**
SIMD separates engineers who know *of* vectorization from those who can make it happen. A junior says "the compiler vectorizes loops." A senior can explain *why the compiler didn't* — a `restrict`-less pointer that might alias, a loop-carried dependency, a `break` inside the loop, a function call that isn't inlined — and knows the fix (annotate aliasing, reassociate, mask the branch, or drop to intrinsics). Interviewers probe whether you understand the throughput math (does 8-wide float actually give 8×?), whether you know the memory side dominates (a gather is not a free vector load), and whether you know the gotchas that bite in production, above all AVX-512 downclocking. In HFT, HPC, graphics, and ML systems this is daily bread; the question filters for people who reason about the machine, not just the language.

**Common confusions**
- *"SIMD is multithreading."* No — SIMD is *within one thread/core*; TLP (threads) and DLP (SIMD) compose (a core can do both at once).
- *"Wider is always faster."* AVX-512 can *lower the core clock* to stay in power budget; a lightly-vectorized program can end up slower than AVX2. Measure.
- *"512-bit means 512 elements."* It's 512 *bits* — sixteen `f32`, not 512 anything.
- *"Auto-vectorization is automatic."* It's *opportunistic*; aliasing, reductions, and branches routinely defeat it silently.
- *"Gather is just a vector load."* A gather issues many cache accesses and is often several× slower than a contiguous load.

**What follows from this topic**
SIMD leans hard on the memory system covered in the caches and DRAM topics — vector code is usually *bandwidth*-bound, so streaming access, prefetch, and alignment matter more than the arithmetic. It complements the superscalar/out-of-order pipeline (ILP) and multicore (TLP): the three parallelism axes stack. The *software* side of concurrency (threads, locks, atomics) lives in the OS and Concurrency primers; here we stay in the hardware lane — the vector register file, execution ports, and mask hardware inside a single core.

### Q1. SIMD vs scalar — and how does SIMD relate to ILP and TLP?

Scalar code processes one element per instruction; SIMD processes many via one instruction over a *vector register*. The three parallelism axes are orthogonal and compose:

- **ILP (instruction-level)** — the out-of-order engine overlaps *independent* scalar instructions; you get it for free from the hardware.
- **DLP (data-level)** — SIMD: one instruction, many elements. You must express it (compiler or intrinsics).
- **TLP (thread-level)** — multiple cores/threads running in parallel.

They stack multiplicatively. A modern core might sustain 2 vector FMA units × 8 `f32` lanes (AVX2) × 2 flops/FMA = 32 flops/cycle *per core*, and with N cores you multiply again. SIMD is the per-core throughput multiplier; it does nothing for latency of a single dependent chain.

### Q2. Walk me through the x86 vector register widths and their history.

- **MMX (1996)** — 64-bit, reused the x87 FP registers. Integer only, obsolete.
- **SSE/SSE2 (1999–2001)** — 128-bit `xmm0`–`xmm15`. SSE added `f32`, SSE2 added `f64` and packed integers. This is the baseline every x86-64 CPU guarantees.
- **AVX (2011)** — 256-bit `ymm`, three-operand non-destructive encoding (VEX), FP focus.
- **AVX2 (2013)** — extends 256-bit to integers, adds gather.
- **AVX-512 (2016+)** — 512-bit `zmm0`–`zmm31` (32 registers), dedicated mask registers `k0`–`k7`, embedded broadcast and rounding. Fragmented into subsets (F, DQ, BW, VL, VNNI, …); support varies by part.

Element counts at 512 bits: 8×`f64`, 16×`f32`, 16×`i32`, 32×`i16`, 64×`i8`. The `xmm`/`ymm`/`zmm` registers alias — `xmm0` is the low 128 bits of `zmm0`.

### Q3. What about ARM and RISC-V — how does scalable vector length differ?

- **ARM NEON** — fixed **128-bit** SIMD, mandatory on AArch64. Apple Silicon and most phones lean on NEON heavily; a core often has 4 NEON units.
- **ARM SVE / SVE2** — *scalable*: register width is implementation-defined from 128 up to 2048 bits (in 128-bit steps). You write **vector-length-agnostic** code — a loop uses predicate registers and an "increment by vector length" instruction, so the *same binary* runs optimally on a 256-bit and a 512-bit machine (e.g. Fujitsu A64FX is 512-bit SVE).
- **RISC-V "V" extension** — same philosophy: a `vsetvl` instruction sets how many elements this iteration processes based on hardware `VLEN` and remaining count; code is width-portable and the tail loop vanishes.

Fixed-width (SSE/AVX/NEON) means recompiling for each width and hand-writing scalar remainder loops; scalable (SVE/RVV) trades a slightly more complex programming model for forward-portability and automatic tail handling.

### Q4. What are the ways to get SIMD into your program, and their tradeoffs?

Four rungs, increasing control and effort:

1. **Auto-vectorization** — write plain loops, let the compiler emit vectors (`-O3 -march=native`). Zero effort, portable, but fragile: it silently bails on anything it can't prove safe.
2. **Compiler hints/pragmas** — `#pragma omp simd`, `restrict`, `__builtin_assume_aligned`. Nudge the compiler past aliasing/dependency worries while keeping portable source.
3. **Intrinsics** — functions mapping 1:1 to instructions (`_mm256_fmadd_ps`, NEON `vaddq_f32`). Full control, but ISA-specific and verbose; you hand-manage widths, tails, masks.
4. **Libraries / DSLs** — Eigen, MKL, Highway, `std::experimental::simd`, xsimd, ISPC. You get expert-tuned kernels or a portable wrapper that picks the best ISA at runtime.

Rule of thumb: rely on auto-vec for the 90%, reach for a portable-SIMD library for hot kernels, and drop to raw intrinsics only for the last 10% where you must hand-schedule.

### Q5. Why does auto-vectorization fail? Give the concrete blockers.

The compiler must *prove* the transform is safe and profitable. It bails on:

- **Pointer aliasing** — `void f(float* a, float* b)`; if `a` and `b` might overlap, vectorizing changes results. Fix: `restrict` / `__restrict`.
- **Loop-carried dependencies** — `a[i] = a[i-1] + x` can't be lane-parallel. Reductions (`sum += a[i]`) *can* vectorize but only with reassociation, which reorders FP and needs `-ffast-math`/`#pragma omp simd reduction`.
- **Control flow inside the loop** — `break`, `continue`, `return`, or a data-dependent branch; must be turned into a mask, which the compiler may not attempt.
- **Non-inlined function calls** — an opaque call per iteration blocks it; needs inlining or a vector math library (libmvec).
- **Non-unit stride / indirect access** — `a[idx[i]]` forces gather; often deemed unprofitable.
- **Unknown trip count or bad alignment** — generates guarded scalar fallbacks.

The senior move: read the compiler's vectorization report (`-fopt-info-vec-missed`, `-Rpass-missed=loop-vectorize`) to see *exactly* why it declined.

### Q6. Why does alignment matter, and how much?

An *aligned* load requires the base address to be a multiple of the vector width (16B for SSE, 32B for AVX, 64B for AVX-512). Historically aligned loads used a distinct, faster instruction (`MOVAPS`) and a misaligned load (`MOVUPS`) faulted or was much slower. On modern Intel/AMD the *instruction* penalty for unaligned has largely vanished — but the real cost is **cache-line splitting**: a 32B AVX load whose address isn't 32B-aligned can straddle two 64-byte cache lines, costing an extra cache access and sometimes a page-boundary split. So align hot buffers to 64B (a full cache line) with `alignas(64)` / `posix_memalign` / `_mm_malloc`. Alignment also lets the compiler skip the scalar "peel" loop it otherwise inserts to reach an aligned boundary. Net: correctness rarely depends on alignment anymore, but throughput on streaming kernels still does.

### Q7. Explain masking / predication and why it beats branching in SIMD.

Lanes execute in lockstep, so you can't branch *per lane*. Instead you compute *all* lanes and use a **mask** to select which results commit. Example: `result = cond ? a : b` becomes `mask = cmp(cond); result = blend(mask, a, b)` — both `a` and `b` are computed, the mask picks per lane.

- Pre-AVX-512 you emulate masks with compare-to-all-ones vectors and `blendv`/`and`/`andnot`.
- **AVX-512** adds real mask registers `k0`–`k7`: nearly every instruction takes a `{k}` write-mask (only masked lanes update) and optionally `{z}` zero-masking. This makes masked stores, masked FMAs, and compressed gathers first-class.
- **SVE/RVV** are predication-first by design — the predicate register drives every vector op, and the *tail* of a loop is just a partial predicate, eliminating the remainder loop.

Predication trades doing redundant work (all lanes compute) for eliminating branch misprediction and keeping lanes packed — a win whenever divergence is data-dependent and unpredictable.

### Q8. What are horizontal operations and gather/scatter, and why are they slow?

**Horizontal (cross-lane) ops** reduce *across* the lanes of one register — e.g. summing the 8 lanes of a `ymm` to one scalar. Normal SIMD is *vertical* (lane i op lane i). Horizontal reductions need a shuffle-and-add tree (`log2(lanes)` steps) or dedicated `hadd`/reduce instructions, and they serialize at the end of a loop. Best practice: keep a *vector* accumulator across the whole loop and do a single horizontal reduce at the end, not one per iteration.

**Gather** loads elements from a vector of independent addresses (`a[idx[i]]`); **scatter** stores to them (AVX-512). Semantically one instruction, but the hardware must issue up to *one cache access per lane* — a 16-lane gather can touch 16 different cache lines. So a gather is often 4–10× slower than a contiguous load and only wins when the alternative is fully scalar. If you can restructure data to be contiguous (SoA layout), do that instead of gathering.

### Q9. Explain the AVX-512 frequency-throttling gotcha.

Wide 512-bit execution draws a lot of power, so many Intel server parts (notably Skylake-SP through Cascade Lake) **drop the core clock** when running heavy AVX-512 (and to a lesser degree AVX2) code — the "AVX offset." There are license levels: L0 (scalar/light) runs at full turbo, L1 (AVX2 heavy / light AVX-512) at a reduced clock, L2 (heavy AVX-512, e.g. dense FMA) at a still-lower clock. The transition also has hysteresis — a few dirty microseconds of reduced clock even after the vector code stops. Consequences:

- A program that only *occasionally* hits AVX-512 can slow down *the whole core*, including surrounding scalar and other threads, for a net loss.
- This is why some libraries and even glibc historically avoided AVX-512 by default, and why benchmarks must measure end-to-end, not just the kernel.

Later parts (Ice Lake onward, and AMD Zen 4/5's "double-pumped" then native AVX-512) greatly reduced or removed the penalty — but "measure, don't assume" remains the rule. The OS-scheduling interaction (which thread gets penalized) is an OS concern; the clock-licensing mechanism itself is hardware.

### Q10. Work the throughput math: how fast *should* a well-vectorized float kernel be?

Take a Haswell/Skylake core doing single-precision FMA:

- 2 FMA units, each 256-bit AVX2 = 8 `f32` lanes, 2 flops per FMA (a multiply + an add).
- Peak = 2 units × 8 lanes × 2 flops = **32 flops/cycle**. At 3 GHz that's ~96 GFLOP/s *per core* for `f32`.
- AVX-512 with 2×512-bit FMA units doubles the lanes to 16 → **64 flops/cycle** — *if* the core holds its clock (see Q9).

But you only hit that if you're **compute-bound**. Most kernels are **memory-bound**: DRAM bandwidth might be ~20–50 GB/s per socket. A SAXPY (`y = a*x + y`) does ~2 flops per ~12 bytes moved — an *arithmetic intensity* of ~0.17 flop/byte. By the roofline model, at 40 GB/s that caps you at ~7 GFLOP/s regardless of how wide your vectors are. Lesson: SIMD only helps once you're not starved for data — improve locality/reuse first, then widen. Always sanity-check a claimed speedup against the roofline; an "8-wide" kernel that stayed memory-bound gains nothing.

### Q11. The interview one-liner.

SIMD exploits data-level parallelism by making one instruction operate on a whole vector register of independent elements — 128-bit SSE/NEON, 256-bit AVX, 512-bit AVX-512, or the scalable widths of ARM SVE and RISC-V V — so a single core multiplies its arithmetic throughput (tens of flops/cycle) on regular, dense, branch-free array math; the hard part is never the add, it's *feeding the lanes*: you fight aliasing and dependencies and control flow to let the compiler (or your intrinsics) vectorize, you align and stream memory because vector kernels are usually bandwidth-bound, you turn branches into masks and cross-lane reductions into a single horizontal op, you avoid gather/scatter when a contiguous layout will do, and you *measure* — because a half-hearted AVX-512 kernel can down-clock the whole core and lose to plain AVX2.


## Multicore, SMP & NUMA

### Summary

**What this topic covers**
This topic is about putting many CPU cores on one machine and making them share memory sanely. It spans three layers: *why* we went multicore at all (single-core frequency scaling died at the power wall), *how* cores are glued together on-die (private L1/L2, shared last-level cache, an on-chip interconnect — ring, mesh, or crossbar), and *how* the memory system is organized across sockets (SMP/UMA where every core sees uniform memory latency, versus NUMA where memory is attached to specific sockets and remote access is markedly slower). It sits at the hardware boundary beneath the OS: the OS *policy* side — thread scheduling, `numactl`, page placement — belongs to the Operating Systems primer; here we care about the silicon and its latency structure.

**Mental model**
Picture a modern 2-socket server. Each socket is a chip with, say, 32 cores. Every core has private L1 (~32 KB) and L2 (~1 MB); all cores on that socket share a large L3/LLC (tens of MB) reachable over an on-chip mesh. Each socket has its own DRAM controllers and its own bank of DIMMs. A core reading memory *homed on its own socket* pays local latency (~80–100 ns). Reading memory *homed on the other socket* must hop across the inter-socket link (Intel UPI, AMD Infinity Fabric) — typically **1.5–2× the local latency**. That asymmetry *is* NUMA. The whole system is still cache-coherent: hardware guarantees one core sees another's writes, but enforcing that coherence generates snoop/directory traffic that itself crosses the interconnect. So performance is dominated by *where your data lives relative to the core touching it*, and by *how much coherence chatter your sharing pattern creates*.

**Key terms**
- **Multicore** — multiple independent CPU cores on one die, each a full execution pipeline.
- **SMT / hyperthreading** — one physical core exposing 2 (or more) logical threads that share execution units; boosts throughput, not peak single-thread speed.
- **SMP (symmetric multiprocessing)** — all cores are equal peers running one OS image over shared memory.
- **UMA (uniform memory access)** — every core sees the same memory latency; the classic single-socket / bus model.
- **NUMA (non-uniform memory access)** — memory latency depends on which socket/node owns the address.
- **NUMA node** — a socket plus its locally-attached memory controllers and DRAM.
- **LLC / L3** — last-level cache, shared by all cores on a socket.
- **On-chip interconnect** — the fabric linking cores/LLC slices: ring, 2D mesh, or crossbar.
- **Inter-socket link** — UPI (Intel), Infinity Fabric (AMD) carrying data + coherence between sockets.
- **ccNUMA** — cache-coherent NUMA: hardware keeps caches coherent across nodes.
- **First-touch** — allocator/OS policy that homes a page on the node of the core that first writes it.
- **Affinity** — pinning a thread (and its memory) to a node to keep accesses local.

**Why interviewers ask this**
A junior answer says "more cores = faster." A senior answer knows the machine is a *distance-structured* memory system and that scaling is bounded by Amdahl's law, coherence traffic, and contention — not core count. Interviewers use this to probe whether you can reason about *why* a 64-thread workload doesn't get 64× throughput, whether you understand false sharing and remote-memory penalties, and whether you'd reach for first-touch/affinity before blaming the CPU. It's the hardware substrate under every "our service doesn't scale past N threads" war story.

**Common confusions**
- *"NUMA means non-shared memory"* → No. It's still one coherent shared address space; only the *latency* is non-uniform. Distributed/message-passing clusters are a different thing.
- *"SMT doubles performance"* → It typically adds ~15–30% throughput by hiding stalls; two threads share one core's execution units, so compute-bound code sees little gain.
- *"More cores always helps"* → Amdahl caps you at 1/(serial fraction); coherence and memory-bandwidth contention can make added cores net-negative.
- *"L3 is per-core"* → L3/LLC is shared per socket; L1/L2 are private.

**What follows from this topic**
NUMA latency asymmetry only matters because caches exist — see the **caches / memory hierarchy** topic. Keeping those caches consistent across cores is the **cache coherence (MESI)** topic, and the ordering rules programs observe is **memory consistency**. The reason we went multicore in the first place is the **power wall**, covered in the power/energy topic. Software-side scheduling and page-placement policy live in the **Operating Systems** primer; locks and the software memory model live in **Concurrency**.

### Q1. Why did the industry pivot to multicore instead of just clocking single cores higher?

Dynamic power scales roughly as `P ∝ C·V²·f`, and pushing frequency `f` up historically also required raising voltage `V` to keep timing stable — so power grew faster than linearly with clock speed. By the mid-2000s single cores hit a **power (thermal) wall** around 3–4 GHz: you physically couldn't dissipate the heat from a hotter, faster single core in a socket-sized package. Meanwhile Moore's law kept delivering more transistors. The rational use of those transistors became *more cores at moderate clocks* rather than one heroic core. Two cores at 2 GHz can beat one at 3 GHz on parallel work while burning less power, because you dropped `V` and `f`. The catch: this shifted the burden to software — you now only benefit if your workload is parallelizable, which is exactly what Amdahl's law limits. (Full treatment of the power wall is in the power/energy topic.)

### Q2. Multicore vs SMT/hyperthreading — what's the actual difference?

**Multicore** gives you N *physical* cores, each with its own pipeline, ALUs, and private L1/L2 — genuine parallel execution. **SMT** (Intel calls it hyperthreading) makes *one* physical core present as 2+ logical CPUs that share the same execution units, caches, and ports; the core interleaves instructions from both threads to fill pipeline bubbles (e.g. while thread A waits on a cache miss, thread B's instructions issue). SMT is cheap area-wise (~5% die) and typically nets **~15–30% extra throughput** on mixed/memory-stalled workloads. But it is *not* two cores: on a compute-bound loop that already saturates the execution units, two SMT threads just contend and you gain almost nothing — sometimes you lose to cache pressure. That's why latency-sensitive HFT and some HPC shops *disable* SMT: they want deterministic single-thread performance and full private cache, not throughput. A "64-thread" chip is often 32 cores × 2 SMT.

### Q3. Walk me through the on-die cache and interconnect layout of a modern many-core chip.

Each core owns **private L1** (split I/D, ~32–48 KB each, ~4-cycle) and **private L2** (~256 KB–2 MB, ~12–15 cycle). All cores on the die share a **last-level cache (L3/LLC)**, tens of MB, physically sliced — one slice per core — and distributed around the die, ~40+ cycles to reach a slice. Cores, LLC slices, and memory controllers are wired by an **on-chip interconnect**:
- **Ring bus** (older Intel, up to ~10–12 cores): simple, but latency grows with hop count as core count rises.
- **2D mesh** (Intel Skylake-SP onward, many-core): cores/LLC slices as a grid; scales better, more uniform worst-case latency.
- **Crossbar** (some designs, and within smaller clusters): every-to-every, low latency but area/power cost grows as N².

AMD instead uses **chiplets (CCX/CCD)**: small clusters of cores each with their own L3, stitched together over Infinity Fabric — which introduces NUMA-like effects *within a single socket*.

### Q4. Define SMP/UMA vs NUMA and say when each applies.

**SMP** = symmetric multiprocessing: all cores are equal peers, one OS, shared memory. **UMA** = uniform memory access: every core reaches any memory address in the same time — the classic model for a single-socket system where all cores hit the same LLC and the same on-package memory controllers. **NUMA** = non-uniform memory access: memory is partitioned into *nodes*, each attached to a particular socket's controllers, so latency depends on whether the address is local or remote. In practice: a single-socket desktop/server is effectively UMA (ignore intra-die effects); a **multi-socket** server (2S, 4S, 8S) is NUMA — and modern chiplet CPUs are NUMA-ish even in one socket. NUMA is what you get when you scale memory bandwidth by giving each socket its own controllers, at the cost of latency asymmetry.

### Q5. How much slower is remote memory on a NUMA machine, and why?

Rule of thumb: remote access is **~1.5–2× local latency**. If local DRAM is ~80–100 ns, cross-socket is ~130–200 ns. The extra cost is the round trip over the inter-socket link (Intel **UPI**, AMD **Infinity Fabric**) plus the remote node's controller and any coherence resolution. It's not only latency — **remote bandwidth** is capped by the link, which is narrower than a socket's aggregate local DRAM bandwidth, so a workload that streams all its data from the other node can bottleneck on the interconnect long before DRAM. Worst case is a page whose *home* node is remote *and* the line is being written by cores on both sockets: now every access drags coherence traffic across UPI too. This is why NUMA-blind allocation ("malloc a huge array on thread 0, hammer it from 64 threads on both sockets") is a classic performance cliff.

### Q6. How do the OS and allocator keep accesses local — what's first-touch?

The key hardware fact: a physical page lives on exactly one NUMA node. The dominant policy is **first-touch**: `malloc`/`mmap` only reserves virtual address space; the physical page is allocated **on the node of the core that first *writes* (faults) it**, not the one that allocated it. So the idiom is *allocate then let each worker thread initialize its own slice* — parallel first-touch — so each thread's data is homed locally. Get this wrong (have thread 0 zero the whole array) and everything lands on node 0, and the other socket's threads pay remote latency forever. Tools/knobs: `numactl --cpunodebind/--membind`, `libnuma` (`numa_alloc_onnode`), `move_pages`, and thread **affinity** (`sched_setaffinity`, pinning) so threads don't migrate away from their data. Linux also has automatic NUMA balancing that samples faults and migrates pages/threads toward locality. (Scheduling/placement *policy* details are the OS primer's job; here the point is the hardware makes locality matter.)

### Q7. What is ccNUMA and how does coherence traffic scale with cores?

**ccNUMA** = cache-coherent NUMA: despite non-uniform memory, hardware still presents one coherent address space — a write by any core is eventually visible to all, enforced by the coherence protocol (MESI/MOESI, detailed in the coherence topic) extended *across* sockets over UPI/Infinity Fabric. The scaling problem: naive **snooping** broadcasts every coherence action to every cache, so traffic grows ~O(N²) and the shared bus/fabric saturates — untenable past a handful of cores. Large systems therefore use **directory-based coherence**: a directory tracks which nodes cache each line, so invalidations/updates are sent *point-to-point* only to sharers, cutting broadcast traffic. Even so, a heavily *shared, frequently written* line is a scalability killer: every writer must invalidate all remote copies, and each does a fabric round trip. That's the hardware reason a single hot atomic counter or a falsely-shared cache line can flatten a 64-core machine — the cores are fine; the coherence fabric is the bottleneck.

### Q8. Worked example: I have 64 cores and a workload that's 95% parallel. What throughput do I actually get?

Amdahl's law: speedup `S = 1 / (s + p/N)` where `s` is the serial fraction. With `s = 0.05`, `p = 0.95`, `N = 64`:
`S = 1 / (0.05 + 0.95/64) = 1 / (0.05 + 0.0148) ≈ 1 / 0.0648 ≈ 15.4×`.
So 64 cores buy you ~15×, not 64× — and the asymptote as `N→∞` is `1/s = 20×`. You are *hard-capped at 20×* by that 5% serial section, no matter how many cores you add. And this is *optimistic*: it ignores the real hardware taxes — coherence traffic on shared state, remote-NUMA latency, and memory-bandwidth contention — which make the measured curve bend *below* Amdahl and can even go *negative* (adding cores slows you down) once the fabric or DRAM saturates. The lesson interviewers want: shrink the serial fraction and the sharing, don't just add cores.

### Q9. What are the real limits to multicore scaling?

Four, roughly in order of how often they bite:
1. **Amdahl's law** — the serial fraction caps speedup at `1/s`; even 1% serial limits you to 100×.
2. **Coherence / synchronization** — hot shared lines, locks, and false sharing serialize on the coherence fabric; the classic fix for false sharing is padding/aligning to 64 B cache-line granularity.
3. **Memory bandwidth & interconnect contention** — N cores share finite DRAM and UPI/IF bandwidth; a bandwidth-bound kernel stops scaling once the memory system saturates, regardless of core count (the "memory wall").
4. **NUMA remoteness** — poor page placement makes cores pay 1.5–2× on every access, and remote bandwidth caps streaming workloads.

Above these sit power/thermal limits (dark silicon — you can't run all cores at max clock simultaneously). The practical message: past a point, scaling is a *software and data-placement* problem (reduce serial work, reduce sharing, place data locally), not a "buy more cores" problem.

### Q10. False sharing — what is it and why does it hurt NUMA/multicore especially?

False sharing is when two cores write *different* variables that happen to sit on the *same 64-byte cache line*. Coherence works at line granularity, so even though the variables are logically independent, each write invalidates the other core's copy of the whole line — the line "ping-pongs" between caches, and every bounce is a coherence transaction. On a single socket that's already expensive (~tens of ns per bounce); across sockets on NUMA it's *worse* because each ping-pong crosses UPI/Infinity Fabric. Classic case: an array of per-thread counters packed tightly, `counter[tid]++` in a hot loop — throughput collapses and doesn't improve with more threads. The fix is **cache-line padding/alignment**: give each hot per-thread datum its own 64 B line (e.g. `alignas(64)`, or padding structs). This is a top-tier "why doesn't my parallel code scale?" answer. (The software memory-model angle — atomics, `std::atomic` — is in the Concurrency primer.)

### Q11. The interview one-liner: sum up multicore, SMP, and NUMA.

We went multicore because single-core frequency hit the power wall, so performance now comes from *many* moderate-clock cores — each with private L1/L2, sharing an LLC over an on-chip ring/mesh/crossbar, and often stretched across multiple sockets. A single socket is effectively UMA; multi-socket (and chiplet) systems are **NUMA**, where memory is homed per node and remote access costs ~1.5–2× local, so you use **first-touch allocation and thread affinity** to keep data local. It's still one **cache-coherent** (ccNUMA) address space, but keeping caches coherent generates fabric traffic that — together with Amdahl's serial fraction, lock/false-sharing contention, and finite memory bandwidth — is what actually bounds scaling; core count rarely is.


## GPUs & Domain-Specific Accelerators

### Summary

**What this topic covers**

This topic is about the machines that sit next to the CPU when a general-purpose core is the wrong tool. A modern CPU spends most of its transistor and power budget making a *single* instruction stream finish fast — out-of-order execution, branch prediction, big caches, deep speculation. That is *latency* optimization. A GPU inverts the priorities: it throws away most of that per-thread machinery and spends the silicon on thousands of simple lanes plus enormous memory bandwidth, betting you have a mountain of independent work to run. That is *throughput* optimization. We cover how a GPU executes (SIMT, warps, divergence), how it hides memory latency by oversubscribing threads, its memory hierarchy and the coalescing rules that make or break bandwidth, when the model wins versus falls flat, and the broader move to fixed-function accelerators — TPUs, NPUs, systolic arrays — driven by the end of Dennard scaling. Where this brushes GPU scheduling as an OS problem or the software memory model, that belongs to the OS and Concurrency primers.

**Mental model**

Picture a CPU as a Formula-1 car: one driver, optimized to get *one* lap done fast. A GPU is a freight train — slow to start, terrible with one passenger, unbeatable moving ten thousand of them. The core trick is *latency hiding through parallelism*. A GPU doesn't try to make a memory load return quickly; a global access costs 300–600 cycles and it accepts that. Instead it keeps dozens of warps (groups of 32 threads) resident per core, and whenever one warp stalls on memory, the scheduler swaps in another that's ready — a zero-cost switch because every warp's registers are already live in a giant register file. With enough warps in flight the arithmetic units never idle: one warp's memory latency is overlapped by the compute of others. So a GPU's performance question is never "how fast is one thread" but "do I have enough parallel threads to keep the machine full."

**Key terms**
- **latency vs throughput** — time for *one* task to finish vs total work per unit time; CPUs optimize the former, GPUs the latter.
- **SIMT** — Single Instruction, Multiple Thread: many scalar threads execute in lockstep sharing one instruction fetch/decode, but each has its own registers and can be individually masked.
- **warp / wavefront** — the hardware scheduling quantum: 32 threads (NVIDIA warp) or 32/64 (AMD wavefront) that issue together. AMD's newer RDNA uses wave32.
- **SM / CU** — Streaming Multiprocessor (NVIDIA) or Compute Unit (AMD): a GPU core holding schedulers, SIMD lanes, register file, and shared memory.
- **warp divergence** — when threads in a warp take different branch paths; the hardware serially executes each path with the other lanes masked off, wasting throughput.
- **occupancy** — resident warps per SM divided by the hardware maximum; the lever for latency hiding, capped by registers-per-thread and shared-memory usage.
- **shared memory / scratchpad** — fast (~20–30 cycle) software-managed on-chip SRAM, banked, shared by a thread block; the GPU analog of a programmer-controlled L1.
- **coalescing** — combining the per-thread addresses of a warp into the fewest memory transactions; the single biggest global-bandwidth lever.
- **HBM / global memory** — high-bandwidth DRAM stacks feeding the GPU: 1–3 TB/s on datacenter parts, but 300+ cycle latency.
- **arithmetic intensity** — FLOPs per byte of memory traffic; high intensity favors the GPU, low intensity makes it memory-bound.
- **systolic array** — a 2-D grid of multiply-accumulate cells that pumps data rhythmically through itself; the heart of a TPU/NPU matmul engine.
- **Dennard scaling** — the (now-dead) rule that shrinking transistors kept power density constant; its end is *why* accelerators exist.

**Why interviewers ask this**

Heterogeneous compute is now table stakes — ML, graphics, HPC, even databases offload to GPUs. A junior answer says "GPUs are parallel, so they're faster." A senior answer explains *why* the model works (latency hiding via oversubscription, not raw clock), *when it fails* (branchy, pointer-chasing, low-parallelism, or low arithmetic-intensity code), and can name a concrete bottleneck: "memory-bound because access isn't coalesced," or "occupancy is register-limited so latency isn't hidden." The best signal is knowing the *shape* of a problem that maps to a GPU versus one that doesn't, and the industry's pivot to fixed-function silicon as general scaling stalled.

**Common confusions**
- "GPUs are just faster CPUs" → no; single-thread latency on a GPU is *worse*. They win only on abundant data parallelism.
- "More threads always help" → only up to the point where you have enough warps to hide latency; beyond that, register/shared-memory pressure cuts occupancy and hurts.
- "SIMT is the same as SIMD" → SIMT presents a per-thread programming model with independent control flow (masked), whereas SIMD exposes explicit vector width to the programmer.
- "The GPU is a general accelerator" → it's a *throughput* machine; irregular, serial, or latency-critical code belongs on the CPU.
- "A TPU is a small GPU" → a TPU is far *less* general — a systolic matmul engine, not a programmable SIMT machine.

**What follows from this topic**

This is where the [[SIMD]] idea scales out: a GPU is data-parallel execution taken to the extreme, and shares the [[caches]] and [[dram]] bandwidth concerns of the rest of the memory hierarchy. Coalescing and HBM tie directly to [[memhier]]; latency hiding is the counterpoint to the CPU's out-of-order [[ooo]] approach. The accelerator trend closes the loop opened by [[isa]] and the death of frequency scaling — when you can't make one core faster, you build a specialized one.

### Q1. Why is a CPU "latency-optimized" and a GPU "throughput-optimized," concretely in terms of where the transistors go?

A CPU spends its area and power on making one instruction stream finish fast: a wide out-of-order window, register renaming, aggressive branch prediction, deep speculation, and a large multi-level cache to keep data close (single-digit-ns L1/L2). On a big x86 core, the actual integer ALUs are a tiny fraction of the die — most of it is control logic and cache serving *one* thread's latency. A GPU deletes almost all of that. There's no big out-of-order engine, minimal branch prediction, and a comparatively small cache per lane. Instead the transistors go into thousands of simple ALUs, a massive register file (an SM can hold 256 KB of registers so it can keep many warps live), and wide memory controllers feeding HBM at 1–3 TB/s. The CPU says "make the one thing fast"; the GPU says "have so many things in flight that individual latency stops mattering." That's why a GPU can deliver tens of TFLOPs but has *worse* single-thread performance than a phone CPU.

### Q2. Walk me through SIMT execution and what a warp actually is.

SIMT — Single Instruction, Multiple Thread — is how a GPU reconciles "thousands of independent threads" with "I can't afford independent fetch/decode for each." Threads are grouped into **warps** of 32 (NVIDIA) or wavefronts of 32/64 (AMD). The hardware fetches *one* instruction per warp per cycle and issues it across 32 lanes, each lane executing that instruction on its own registers. So you write scalar per-thread code, but the machine runs it in lockstep bundles of 32. Each SM has multiple warp schedulers; on any cycle a scheduler picks a *ready* warp (one whose operands aren't waiting on memory) and issues it. Because there are typically dozens of resident warps, the scheduler almost always has something to run. The key distinction from SIMD: in SIMT each thread has its *own* program counter view and can be individually enabled/disabled via a mask, so threads can appear to branch independently — the hardware handles it (see divergence). SIMD, by contrast, exposes a fixed vector width the programmer must fill explicitly.

### Q3. What is warp divergence and how expensive is it?

A warp shares one instruction pointer, so all 32 lanes want to execute the same instruction. When a data-dependent branch sends some lanes down the `if` and others down the `else`, the hardware can't run both simultaneously. It **serializes**: it executes the `if` path with the non-taken lanes masked off (idle), then executes the `else` path with the other lanes masked off. In the worst case — a `switch` with all 32 lanes taking different paths — you can lose up to 32x throughput for that region. The cost is proportional to how many distinct paths the warp takes, not to the branch existing at all: a branch where all 32 threads agree is free. The practical rule is to structure data so threads *within a warp* follow the same control flow — e.g. sort or bucket work so divergence happens *between* warps (which is fine) rather than *within* one. Modern NVIDIA GPUs (Volta+) added independent thread scheduling with per-thread PCs, which relaxes some deadlock cases but doesn't remove the throughput penalty of divergence.

### Q4. How does a GPU hide memory latency without big caches?

By massive multithreading and near-zero-cost warp switching. A global-memory load costs roughly 300–600 cycles. On a CPU you'd stall or speculate around it; a GPU instead keeps many warps resident on each SM, and the moment the executing warp issues a long-latency load, the scheduler marks it not-ready and issues a *different* warp on the next cycle. The switch is free because every resident warp's registers already live in the SM's register file — there's no state to save or restore. If you have enough independent warps, by the time you cycle back to the first one its load has completed. This is "latency hiding through thread-level parallelism." The consequence: a GPU needs *oversubscription* to perform. Run one warp and you'll see the full 500-cycle stall exposed; run 40 warps of arithmetic-heavy work and the ALUs stay busy while loads resolve in the background. The register file and occupancy limits, not cache size, are what bound how much latency you can hide.

### Q5. Describe the GPU memory hierarchy and why coalesced access matters so much.

From fastest to slowest: **registers** (per-thread, ~0 extra cycles, but a finite pool shared across resident threads — using too many per thread cuts occupancy); **shared memory / scratchpad** (per-block, software-managed on-chip SRAM, ~20–30 cycles, banked into 32 banks); **L1** (often physically the same SRAM as shared memory, partitioned); a unified **L2** (a few MB, shared across all SMs, ~200 cycles); and **global memory** in HBM (GBs, 300–600 cycles, but 1–3 TB/s aggregate bandwidth). Coalescing is the rule that turns that bandwidth into delivered performance. The memory system serves global memory in fixed transactions (e.g. 32- or 128-byte segments). If the 32 threads of a warp access 32 consecutive, aligned words, the hardware **coalesces** them into one or two transactions — full bandwidth. If they access scattered addresses (a strided or pointer-chasing pattern), you get up to 32 separate transactions, most of each 128-byte line thrown away, so you use a fraction of your bandwidth. Getting coalescing right (structure-of-arrays layouts, aligned strides) is often a 5–10x difference and the first thing to check on a memory-bound kernel.

### Q6. What is occupancy and is higher always better?

Occupancy is the ratio of resident warps per SM to the hardware maximum (e.g. 48 or 64 warps). It's the knob for latency hiding: more resident warps means more independent work to swap in when one stalls. It's bounded by three shared resources — **registers per thread** (a bigger per-thread register footprint means fewer threads fit in the fixed register file), **shared memory per block** (more scratchpad per block means fewer blocks resident), and hardware warp/block limits. Higher occupancy is *not* automatically better, though. Once you have enough warps to fully hide memory latency, extra occupancy yields nothing — and pushing for it can *hurt* if you achieve it by spilling registers to memory or shrinking per-thread working sets. Many high-performance kernels deliberately run at moderate occupancy with lots of registers and shared memory per thread (higher arithmetic intensity, more instruction-level parallelism per thread) — the "maximize occupancy" advice is a starting heuristic, not a law. The real target is keeping the ALUs busy, which occupancy is only a proxy for.

### Q7. Give me a concrete example of a workload that wins on a GPU and one that loses.

**Wins:** dense matrix multiply (the workhorse of deep learning). An N×N matmul does O(N³) FLOPs over O(N²) data, so arithmetic intensity grows with N — tons of independent multiply-accumulates, regular access patterns that coalesce, and data reuse you can stage in shared memory. A GPU crushes this; it's why training runs on GPUs. Image processing, physics particle updates, and Monte Carlo simulations share the profile: abundant identical independent work, high compute-per-byte.
**Loses:** a pointer-chasing linked-list traversal or a branchy graph search over irregular data. Each step depends on the previous (no parallelism to hide latency), accesses are scattered (no coalescing — every load is a near-random 500-cycle miss), and control flow diverges heavily. You'd get a tiny fraction of peak and often *lose* to a single CPU core with a good cache and branch predictor. The general test: **high arithmetic intensity + data parallelism + regular access = GPU**; **serial dependencies, irregular access, or heavy divergence = CPU.**

### Q8. What's the difference between a GPU and a domain-specific accelerator like a TPU or NPU?

A GPU is still *programmable* and fairly general — a SIMT machine that runs arbitrary data-parallel kernels. A domain-specific accelerator narrows that dramatically to do one class of operation extremely efficiently. Google's TPU and the NPUs in phones/laptops are built around **matrix multiply and convolution** — the operations that dominate neural networks. Google's TPU centers on a large **systolic array** (the v1 was a 256×256 grid of multiply-accumulate units): weights and activations are streamed through a fixed mesh of MAC cells, each cell multiplying, accumulating, and passing data to its neighbor, so a whole matmul flows through the array without repeatedly fetching operands from memory. Because the dataflow is fixed and local, you eliminate the instruction-fetch, register-file, and cache overhead a GPU still pays per operation — yielding far more MACs per watt for that specific shape of work. The tradeoff is generality: a systolic array is nearly useless for anything that isn't matmul-shaped. NPUs make the same bet for on-device inference, often at low-precision (int8/int4) to pack more MACs per watt.

### Q9. Why has the industry pivoted to specialized accelerators — what's the "why now"?

Because the free lunch from general-purpose scaling ended. For decades, **Dennard scaling** meant each process shrink let you pack more transistors *and* keep power density flat, so clocks kept climbing and every chip got faster for free. Dennard scaling broke down around 2005–2006: you could no longer drop voltage in step with feature size, so power density rose and clocks stalled around 3–4 GHz. Moore's Law (more transistors) limped on longer but is now also slowing and getting expensive. This produced the "dark silicon" problem — you have more transistors than you can afford to power on at once. If you can't make a general core faster, the way to get more useful work per watt is to build hardware tuned to a specific task: strip out the general-purpose overhead (fetch/decode, speculation, caches) and hard-wire the common operation. That's the entire logic behind GPUs for graphics/ML, TPUs/NPUs for tensors, video codecs, crypto engines, and DSPs. Specialization trades flexibility for efficiency — and with general scaling dead, efficiency is the only lever left. Expect more, not fewer, fixed-function blocks on future SoCs.

### Q10. The interview one-liner: the topic in one crisp paragraph.

A CPU is latency-optimized — it burns most of its silicon making a single instruction stream finish fast — while a GPU is throughput-optimized, spending that budget on thousands of simple lanes and TB/s of HBM bandwidth to run a mountain of independent work; it executes in **SIMT** warps of 32 threads that issue in lockstep (paying a serialization penalty when they *diverge*), and it hides 300–600-cycle memory latency not with big caches but by keeping many warps resident and swapping to a ready one on every stall, so performance hinges on having enough parallelism (**occupancy**) and on **coalescing** each warp's accesses into few transactions; GPUs win on high-arithmetic-intensity, data-parallel, regular workloads like dense matmul and lose on serial, branchy, pointer-chasing ones — and as **Dennard scaling** died and you can no longer make a general core faster, the industry has pushed further still into domain-specific accelerators like TPUs/NPUs built on **systolic arrays** that hard-wire matmul for maximum MACs-per-watt at the cost of all generality.


## Storage, I/O, DMA & Interrupts

### Summary

**What this topic covers**
This is the plumbing between the CPU core and everything outside it — device registers, buses, DMA engines, interrupt controllers, and the storage stack. The CPU is fast (sub-nanosecond cycle) and devices are slow (microseconds to milliseconds), so the whole design problem is moving bulk data without paying for that gap on the core, and getting notified when work finishes without spinning. We look at how the CPU addresses a device (memory-mapped vs port-mapped I/O), how a DMA engine copies data behind the CPU's back and the cache-coherence hazard that creates, how PCIe carries the traffic, how interrupts (MSI/MSI-X, coalescing) vs polling (NAPI, busy-poll) trade latency against CPU cost, why NVMe replaced AHCI for SSDs, and what an IOMMU does. The OS's driver policy and scheduling live in the OS primer; here we stay on the silicon and the wires.

**Mental model**
Think of I/O as three separable questions: *how does the CPU name the device*, *who moves the bytes*, and *how does the CPU learn it's done*. Naming is memory-mapped I/O — device registers appear as physical addresses, so an ordinary load/store hits a device instead of DRAM (`writel`/`readl` in Linux). Moving bytes is DMA — you hand the device a descriptor ("copy 64 KB from this physical address list to your FIFO") and it drives the bus itself while the core runs other code. Learning it's done is an interrupt — the device posts a message that vectors the core into a handler. Every high-throughput device (NIC, NVMe SSD, GPU) is a DMA master with rings of descriptors in host DRAM and a doorbell register the CPU writes to say "new work queued." The art is amortizing the two expensive events — the doorbell write (MMIO, hundreds of ns) and the interrupt (context switch, ~1 µs) — across as many bytes as possible via batching and coalescing.

**Key terms**
- **MMIO** — memory-mapped I/O; device registers live in the physical address space, accessed by load/store, marked uncacheable/write-combining.
- **PMIO** — port-mapped I/O; a separate 64 KB x86 I/O space via `in`/`out` instructions; legacy, mostly dead outside PC boot devices.
- **DMA** — direct memory access; a device reads/writes host DRAM without CPU cycles per byte.
- **descriptor ring** — circular queue in DRAM describing buffers; producer/consumer indices; the doorbell tells the device the producer moved.
- **doorbell / MMIO write** — CPU store to a device register announcing queued work.
- **MSI / MSI-X** — Message-Signaled Interrupts; the device sends an interrupt as a memory write instead of asserting a pin; MSI-X gives up to 2048 vectors (per-queue, per-core).
- **interrupt coalescing** — device holds off the interrupt until N packets or T microseconds elapse, trading latency for fewer interrupts.
- **NAPI** — Linux hybrid: interrupt wakes a poll loop, then interrupts are masked and the driver polls the ring until drained.
- **IOMMU** — I/O MMU (Intel VT-d / AMD-Vi / ARM SMMU); translates and permission-checks device (bus) addresses, the DMA analogue of the MMU.
- **NVMe** — storage protocol over PCIe with up to 64 K queues of 64 K entries each; replaces single-queue AHCI/SATA.
- **cache coherence (DMA)** — the hazard that CPU caches and DMA'd DRAM disagree; solved by hardware-coherent DMA or explicit cache flush/invalidate.

**Why interviewers ask this**
A junior can define DMA and say "interrupts tell the CPU work is done." A senior explains *why a 100 GbE NIC would melt a core on pure interrupts* (14.8 Mpps at ~1 µs/interrupt is impossible), reaches for coalescing / NAPI / MSI-X-per-queue, and can reason about the cache-coherence trap on a non-coherent DMA path or the memory-ordering fence needed between a descriptor write and a doorbell. This topic is the tell for whether someone has actually written or debugged a driver or a high-performance data path versus only read about them. It also connects cleanly to caches, memory ordering, and virtualization — good candidates pull those threads.

**Common confusions**
- "DMA is faster memory copy" → DMA isn't faster per byte; it *offloads* the copy so the CPU isn't the mover.
- "Polling always wastes CPU" → at high packet rates polling wins; NAPI and busy-poll exist precisely because interrupts cost more than a poll when the ring is never empty.
- "MSI is just a faster pin" → MSI removes the shared pin entirely, enabling per-queue vectors steered to different cores, which is what makes multi-queue NICs scale.
- "NVMe is fast because SSDs are fast" → NVMe's win is deep parallel queues + low protocol overhead; AHCI's single 32-entry queue bottlenecks the SSD's internal parallelism.

**What follows from this topic**
DMA coherence ties straight back to the cache-coherence and memory-ordering topics — the descriptor/doorbell fence is the same store-ordering problem seen from the device side. MMIO's uncacheable/write-combining attributes come from the memory-hierarchy and virtual-memory topics (page attributes, MTRRs/PATs). The IOMMU is the virtual-memory topic applied to devices, and it's the enabler for safe device passthrough in the virtualization topic. Scheduling which core services an interrupt, and driver structure, belong to the OS primer.

### Q1. Memory-mapped I/O vs port-mapped I/O — what's the actual difference and which do modern systems use?

**MMIO** maps device registers into the normal physical address space. A register at physical `0xFED00000` is read/written with an ordinary `load`/`store`; the memory controller routes the transaction to the device instead of DRAM based on the address. Those pages are marked **uncacheable** (or write-combining for framebuffers) so the CPU doesn't cache stale device state or reorder/coalesce accesses. MMIO gives you the full address space, all addressing modes, and works identically across ISAs.

**PMIO** is an x86 legacy: a separate 16-bit (64 KB) I/O address space accessed only by the `in`/`out` instructions. It exists because the original 8086 had limited address pins; it survives for a few boot/legacy devices (PS/2, legacy PIC, PCI config via ports `0xCF8`/`0xCFC`). ARM and RISC-V have **no** separate I/O space at all — everything is MMIO.

Modern systems are essentially all-MMIO. Even PCIe config space, historically port-based, is now memory-mapped (ECAM/MMCONFIG). The one thing to remember: MMIO accesses bypass the cache and must not be reordered, so drivers use `readl`/`writel` with implied barriers, and a store to a device register is *not* like a store to DRAM — it can take hundreds of nanoseconds because it goes out over the interconnect to the device.

### Q2. Walk me through how a modern NIC or NVMe drive actually moves data — the DMA descriptor-ring flow.

Both use the same pattern: **descriptor rings in host DRAM plus a doorbell**.

1. The driver allocates a circular ring of descriptors in DRAM. Each descriptor points to a physical buffer (or a scatter-gather list) and carries length/flags.
2. To submit work (a packet to transmit, an NVMe read), the driver fills the next descriptor, advances its **producer index**, then writes the device's **doorbell** register (an MMIO store) to say "new entries past index N."
3. The device — a bus master — **DMA-reads** the descriptor from DRAM, then DMA-transfers the payload (reads buffer for TX/write, writes buffer for RX/read).
4. On completion the device writes a completion entry (or sets a status bit) into a completion ring in DRAM and raises an **MSI-X interrupt** (or the driver polls the completion ring).
5. The driver processes completions, advances the **consumer index**, and recycles buffers.

Two ordering hazards matter. Between writing the descriptor and ringing the doorbell you need a **write barrier** (`wmb()`/`dma_wmb()`) so the device can't see the doorbell before the descriptor lands in DRAM. And the completion the device DMA-writes must be visible before its interrupt is observed — hardware coherent DMA guarantees this on x86/ARM server parts. NVMe generalizes this to many independent submission/completion queue pairs, one per core, which is the whole reason it scales.

### Q3. DMA and cache coherence — what's the hazard and how is it resolved?

The CPU caches DRAM. A DMA engine reads/writes DRAM directly. So two ways to get corruption:

- **Device-writes / CPU-reads (RX):** device DMAs new data into a buffer, but the CPU's cache still holds the old cached line → CPU reads stale data.
- **CPU-writes / device-reads (TX):** CPU writes a buffer, the data sits dirty in cache and hasn't hit DRAM, device DMA-reads DRAM → device sends stale data.

Two resolution models:

- **Hardware-coherent DMA** (x86 servers, most ARM server SoCs): the DMA path snoops the caches, so DMA writes invalidate matching lines and DMA reads pull dirty data from cache. The driver does nothing special. This is why `dma_alloc_coherent` on x86 is basically free.
- **Non-coherent DMA** (many embedded ARM, some GPUs/accelerators): software must manage it. Before a device reads a buffer, **clean/flush** the cache to DRAM; after a device writes a buffer, **invalidate** the cache so the CPU refetches. Linux's streaming DMA API (`dma_map_single` / `dma_sync_single_for_device` / `_for_cpu`) exists precisely to insert these flush/invalidate ops on non-coherent platforms and compile to nothing on coherent ones.

A subtle related trap: false-sharing a cache line between a DMA buffer and CPU-touched data on a non-coherent system — the invalidate can clobber the CPU's neighboring writes. Hence DMA buffers are cache-line aligned and padded.

### Q4. Why do NICs and NVMe need MSI-X, and how is it different from a legacy pin interrupt?

Legacy interrupts assert a physical **pin** (INTx) routed through an interrupt controller. One pin = one interrupt line, often shared, and the CPU must read a device register to find out *what* happened. That doesn't scale to a multi-queue device on a many-core CPU.

**MSI** turns an interrupt into a **memory write**: the device DMA-writes a small payload to a special address (on x86, the LAPIC region `0xFEE00000`), and the value encodes the vector. No pin, no sharing, and the write is naturally ordered after the data DMA that preceded it.

**MSI-X** extends MSI to **up to 2048 independent vectors** per device, each with its own address/data pair in an on-device table. That's the key enabler for multi-queue: a 64-core server NIC gives each RX/TX queue pair its own MSI-X vector, steered (via the interrupt controller's affinity) to the core that owns that queue. Now interrupts for queue 7 land on core 7, which is also draining queue 7's ring — cache-local, no cross-core bouncing, no lock contention on a shared queue. Without MSI-X you can't build a NIC or NVMe drive that scales linearly with cores.

### Q5. Interrupts vs polling — when does each win, and what's NAPI doing?

**Interrupts** win at *low* load: the device is usually idle, so you don't want a core spinning; an interrupt wakes you only when there's work. Cost: ~1 µs per interrupt (pipeline flush, context save, handler entry) plus cache pollution.

**Polling** wins at *high* load: if the ring is essentially never empty, an interrupt per packet is pure overhead — you'd rather loop reading the ring and process a batch. At 100 GbE line rate (14.88 Mpps for 64-byte frames) you get ~67 ns per packet; a 1 µs interrupt each is physically impossible, so you *must* poll.

**NAPI** (Linux) is the hybrid that gets both: the first packet raises an interrupt; the driver then **masks that interrupt** and schedules a poll routine that drains the ring in a batch (up to a budget, e.g. 64 packets). When the ring empties, it re-enables the interrupt and goes back to sleep. So under light load you pay interrupt cost (good latency, low CPU); under heavy load you naturally switch to polling (high throughput, no interrupt storm). **Busy-poll** (`SO_BUSY_POLL`, DPDK-style pure polling) goes further for ultra-low-latency trading/HFT: a core spins on the ring continuously, burning 100% CPU to shave microseconds and jitter — worth it only when latency is worth more than the core.

### Q6. What is interrupt coalescing and what does it cost?

Interrupt coalescing tells the device: don't interrupt on *every* completion — hold off until you've accumulated **N** completions (`rx-frames`) *or* **T** microseconds have passed (`rx-usecs`), whichever comes first, then raise one interrupt for the batch. NIC knobs are exposed via `ethtool -C`.

The tradeoff is throughput vs latency:
- **More coalescing** (larger N/T) → fewer interrupts, less CPU, higher throughput, but each packet waits up to T µs before the CPU is told → higher, jitterier latency.
- **Less/no coalescing** → every packet interrupts immediately → lowest latency but the interrupt rate can saturate a core under load.

A throughput server might set `rx-usecs 50`; a latency-sensitive trading box sets it to `0` (interrupt immediately) or bypasses the kernel entirely with busy-poll/DPDK. Adaptive coalescing lets the driver tune N/T dynamically based on observed rate. Note NAPI already provides *implicit* coalescing (one interrupt then batch-poll), so on Linux the hardware coalescing mostly controls how aggressively you re-arm.

### Q7. Give me the PCIe mental model — lanes, generations, bandwidth.

PCIe is a **point-to-point serial** interconnect (not a shared bus despite the name), arranged as a tree of switches from a root complex. A link is **x1, x4, x8, or x16 lanes**; each lane is a differential pair each direction (full-duplex). Bandwidth scales with lanes × per-lane rate.

Per-lane rate by generation (each generation roughly doubles):
- Gen3: ~1 GB/s per lane (8 GT/s, 128b/130b encoding)
- Gen4: ~2 GB/s per lane (16 GT/s)
- Gen5: ~4 GB/s per lane (32 GT/s)
- Gen6: ~8 GB/s per lane (64 GT/s, PAM4)

So a **Gen4 x16** GPU link ≈ 32 GB/s each way; a **Gen4 x4** NVMe slot ≈ 8 GB/s (which is why consumer NVMe tops out around 7 GB/s — it's a 4-lane Gen4 link). Traffic is packetized (TLPs — transaction layer packets) with headers, so useful bandwidth is a bit below the raw number.

Two things senior candidates mention: PCIe latency is real (~hundreds of ns round-trip for a read completion, because a read is a request-then-response split transaction — this is why you *write* doorbells and let the device DMA rather than the CPU reading device memory in a loop), and lane count can be bifurcated (one x16 slot split into x8+x8) which matters for populating multiple NVMe/GPUs off limited CPU lanes.

### Q8. Compare HDD vs SSD vs NVMe — and why does NVMe use so many deep queues?

- **HDD:** spinning platters, a moving head. Latency dominated by **seek + rotational latency** — ~5–10 ms per random access. Sequential is fine (~200 MB/s), random IOPS are pitiful (~100–200). Inherently one head, so no parallelism to exploit.
- **SATA SSD:** NAND flash, no moving parts, ~50–100 µs latency, hundreds of MB/s. But it's stuck behind **AHCI/SATA**, a protocol designed for disks: **a single command queue of 32 entries**. The flash has dozens of independent NAND channels internally, but AHCI can't feed them in parallel.
- **NVMe SSD:** same flash, but a PCIe-native protocol built for it. **Up to 64K queues, each up to 64K entries**, each queue a submission/completion pair. Latency ~10–20 µs, millions of IOPS.

The queue design is the whole point. Flash gets its bandwidth from **internal parallelism** — many channels, dies, planes all busy at once. To saturate that you must have many outstanding requests in flight. NVMe gives **one queue pair per CPU core**, so each core submits (doorbell write) and reaps completions on its *own* lock-free queue — no cross-core locking, MSI-X interrupt steered back to the submitting core, and enough queue depth to keep every NAND channel busy. AHCI's single shallow queue serializes all of that and leaves the flash idle. Same media, ~10–50× the random IOPS.

### Q9. What does an IOMMU do and why do you need one?

An **IOMMU** (Intel VT-d, AMD-Vi, ARM SMMU) is the MMU for devices. Without it, a DMA-capable device uses raw **physical addresses** — a buggy or malicious device (or a driver) can DMA anywhere in RAM, reading secrets or corrupting the kernel. The IOMMU sits between devices and memory and translates device-visible **I/O virtual addresses (IOVAs)** to physical addresses, with per-device page tables and permissions.

Three big uses:
- **Protection / isolation:** a device can only touch memory the OS explicitly mapped for it. A NIC DMA to an unmapped address faults instead of scribbling on the kernel.
- **Virtualization / passthrough:** to give a VM direct access to a physical device, the guest programs DMA with *guest* physical addresses; the IOMMU translates guest→host so the device lands data in the right place. This is what makes SR-IOV VF passthrough and GPU passthrough safe.
- **32-bit devices / scatter-gather:** the IOMMU can present a contiguous IOVA range mapped to scattered physical pages, and map high memory below a device's addressing limit — replacing bounce buffers.

The cost is an **IOTLB** (the IOMMU has its own TLB) and translation overhead on the DMA path, plus map/unmap cost per I/O in strict mode (mitigated by deferred/lazy invalidation). The OS-policy side — when to map, IOMMU groups — is OS/driver territory; here the point is that it's page-table translation applied to bus masters.

### Q10. Worked example: why can't a 100 GbE NIC run on one interrupt per packet?

Take 100 GbE with minimum-size 64-byte frames. Line rate is ~**14.88 million packets/second** (each frame plus preamble/gap ≈ 84 bytes → 100e9 / (84×8) ≈ 14.88 Mpps). That's ~**67 ns per packet**.

An interrupt costs on the order of **1 µs** end to end (entry, handler, EOI, return, cache disturbance). One interrupt per packet would demand 14.88M interrupts/second × 1 µs = **14.88 seconds of interrupt handling per second** — i.e. ~15 cores doing nothing but taking interrupts, which is impossible on one core and wasteful on many. Even at 1500-byte frames (~8.1 Mpps) it's still ~8 cores of pure interrupt overhead.

The fix stack: **MSI-X** spreads queues across cores (say 16 queues → ~930 Kpps/core), **NAPI** switches each core to batch-polling under load so it takes ~one interrupt per *batch* of 64 packets instead of per packet, and **coalescing** caps the interrupt rate outright. Combined, a core handles its share by draining rings in tight loops with a handful of interrupts per millisecond. This is the canonical "do the math" question — the numbers are the answer: hardware event costs (1 µs interrupt, ~67 ns/packet budget) simply don't allow per-packet interrupts at line rate.

### Q11. The interview one-liner: I/O architecture is about bridging a fast core to slow devices without wasting cycles — the CPU *names* devices through memory-mapped registers, *offloads* bulk movement to DMA engines that read descriptor rings and DMA to/from host DRAM over point-to-point PCIe, and *learns of completion* through MSI-X interrupts steered per-queue per-core; the recurring engineering move is amortizing the two expensive events (the MMIO doorbell and the ~1 µs interrupt) across many bytes via batching, coalescing, and NAPI-style hybrid poll — which is exactly why 100 GbE and NVMe (many deep parallel queues) can't survive on per-event interrupts — while cache-coherence fences guard the descriptor/doorbell handoff and the IOMMU applies page-table translation to keep DMA masters honest.


## Assembly, Encoding & Calling Conventions

### Summary

**What this topic covers**

This is where the ISA meets reality: the concrete registers a program uses, how machine instructions are laid out as bytes, how the stack organizes a function's local storage, and the **calling convention / ABI** that lets separately-compiled functions call each other. Everything higher in this primer — pipelines, caches, out-of-order execution — is ultimately fed a stream of encoded instructions that manipulate a small set of named registers according to a rulebook nobody in the machine enforces but everyone agrees to obey. A senior engineer doesn't hand-write assembly daily, but reads *disassembly* constantly: to confirm the compiler vectorized a loop, to see whether a "cheap" abstraction spilled registers to the stack, to read a crash's register dump, or to understand why a hot function is slow. This topic is the literacy that turns `objdump -d` and a debugger from noise into signal.

**Mental model**

Think of the CPU as having a tiny scratchpad of ~16 named slots (the general-purpose registers) that it operates on at full speed, backed by a vast, slow tape (memory) it can only reach through explicit load/store addressing. An **instruction** is a byte-string that names an operation and its operands (registers, an immediate constant, or a memory address computed from registers). A **function** needs more scratch than 16 slots and must survive calling other functions, so it carves a **stack frame** out of memory — a downward-growing region addressed off the stack pointer. The **calling convention** is the treaty that makes independent compilation possible: it dictates which registers carry the first arguments, which holds the return value, and — critically — which registers a callee is allowed to clobber (**caller-saved**) versus must preserve (**callee-saved**). None of this is hardware-enforced; it's convention, encoded identically into every object file so a function compiled today links against one compiled a decade ago.

**Key terms**

- **General-purpose register (GPR)** — a small, named, single-cycle-access storage slot in the CPU core; x86-64 has 16 (`rax`, `rbx`, `rcx`, `rdx`, `rsi`, `rdi`, `rbp`, `rsp`, `r8`–`r15`), AArch64 has 31 (`x0`–`x30`) plus a zero register.
- **Immediate** — a constant operand encoded directly in the instruction bytes, not fetched from a register or memory.
- **Addressing mode** — the rule for computing an operand's memory address; x86's workhorse is `base + index*scale + displacement`.
- **Instruction encoding** — how an instruction is serialized to bytes: **variable-length** (x86, 1–15 bytes) vs **fixed-length** (ARM/RISC-V, 32 bits).
- **Stack frame** — the per-call region of the stack holding return address, saved registers, and locals, delimited by `rsp` (top) and optionally `rbp` (frame base).
- **Prologue / epilogue** — the boilerplate at a function's entry/exit that sets up and tears down the frame.
- **Red zone** — 128 bytes below `rsp` that a leaf function may use without adjusting `rsp` (System V AMD64 only).
- **Calling convention / ABI** — the binary contract covering argument passing, return values, register preservation, stack alignment, and struct layout.
- **Caller-saved (volatile)** — registers a called function may freely overwrite; the caller must save them if it needs them across the call.
- **Callee-saved (non-volatile)** — registers a called function must restore before returning.
- **Disassembly** — the reverse of assembly: machine bytes decoded back into human-readable mnemonics (`objdump -d`, `lldb`, Compiler Explorer).

**Why interviewers ask this**

The junior answer treats assembly as a black box: "the compiler handles it." The senior answer reads it fluently. Interviewers probe this to see whether you can debug at the level where abstractions leak — a corrupted stack, a miscompiled inline asm block, an ABI mismatch across an FFI boundary, a register dump in a core file. Being able to say "the first six integer args go in `rdi, rsi, rdx, rcx, r8, r9`, the return is in `rax`, and I can see this call spilled because `rbx` got pushed in the prologue" signals you can go one layer deeper than the source when a bug demands it. It also underpins performance work: judging whether an optimization actually landed requires reading the emitted instructions, not trusting the source. This is the fluency that separates "I write code" from "I understand what the machine does with it."

**Common confusions**

- *"Registers are memory."* — No: registers are named locations inside the core with no address; you can't take a pointer to `rax`. Memory is addressable and orders of magnitude slower.
- *"The stack grows up."* — On every mainstream ABI the stack grows **down** (toward lower addresses); `push` decrements `rsp`.
- *"The calling convention is enforced by the CPU."* — It's pure convention; violate it and you get silent corruption, not a fault. The hardware only knows the raw instructions.
- *"32-bit fixed encoding wastes space vs x86."* — Density is a real x86 advantage, but fixed-width makes decode trivially parallel; the tradeoff is deliberate, not an oversight.

**What follows from this topic**

Encoding density and decode complexity feed directly into pipeline front-ends (fixed-width ISAs decode several instructions per cycle without the x86 length-finding stage — see the pipelining and out-of-order topics). Register count interacts with the register renaming and hazard topics: more architectural registers means fewer stack spills and less pressure on the rename pool. The stack frame and red zone connect to the memory-hierarchy topic — the top of the stack is almost always hot in L1. And the caller/callee-saved split is exactly what determines how many registers survive a function boundary, which the compiler weighs against inlining.

### Q1. Name the x86-64 and AArch64 general-purpose registers and their conventional roles.

x86-64 has **16 GPRs**, 64-bit, each with narrower aliases (`rax`/`eax`/`ax`/`al`). By System V convention: `rax` holds return values (and syscall number); `rdi, rsi, rdx, rcx, r8, r9` carry the first six integer/pointer arguments; `rsp` is the stack pointer; `rbp` the frame pointer (optional, can be freed for general use with `-fomit-frame-pointer`); `rbx, r12–r15` are callee-saved; `r10, r11` are caller-saved scratch. Floating-point/SIMD lives in separate `xmm0–xmm15` (SSE) / `ymm`/`zmm` (AVX) registers.

AArch64 has **31 GPRs** `x0–x30` (64-bit; `w0–w30` are the 32-bit views), plus a special `xzr`/`wzr` **zero register** and a separate `sp`. `x0–x7` pass the first eight arguments and return values; `x8` is the indirect-result/syscall register; `x9–x15` caller-saved; `x19–x28` callee-saved; `x29` is the frame pointer (`fp`); `x30` is the link register (`lr`) holding the return address. The extra registers and the built-in link register are why AArch64 spills to the stack less than x86-64.

### Q2. Walk me through x86 addressing modes.

x86's general memory operand is `displacement(base, index, scale)`, computing the effective address as **`base + index*scale + displacement`**, where `scale ∈ {1,2,4,8}`. This one form covers a huge range:

- **Register direct**: `mov rax, rbx` — no memory touched.
- **Immediate**: `mov rax, 42`.
- **Register indirect**: `mov rax, [rbx]` — load from the address in `rbx`.
- **Base + displacement**: `mov rax, [rbx+8]` — struct field access.
- **Base + index*scale**: `mov rax, [rbx+rcx*8]` — array indexing where `rcx` is the index into an array of 8-byte elements; the `*8` is free, done in the address-generation unit.
- **RIP-relative**: `mov rax, [rip+0x1234]` — position-independent access to globals, the default in modern PIC.

The `scale` matching common element sizes (1/2/4/8) is why array indexing needs no separate shift instruction. AArch64 is more restrictive by design: addressing is base register plus a smaller set of offset/index/pre-/post-increment forms, keeping each instruction a fixed 32 bits.

### Q3. Compare variable-length (x86) vs fixed-length (ARM/RISC-V) instruction encoding. What's the tradeoff?

x86-64 instructions are **1 to 15 bytes**: a variable stream of optional prefixes, opcode, ModR/M, SIB, displacement, and immediate. ARM (AArch64) and RISC-V base ISA use a **fixed 32-bit** width (RISC-V's C extension adds optional 16-bit compressed forms, but at aligned boundaries).

The tradeoff is **code density vs decode complexity**:

- *Variable-length wins on density.* Common short instructions cost 2–3 bytes, so x86 binaries are compact, which helps instruction-cache footprint.
- *Fixed-length wins on decode.* You know every instruction starts on a 4-byte boundary, so a decoder can slice N instructions in parallel trivially. x86 must first *find* where each instruction ends before it can decode the next — an inherently serial length-decode step. Modern x86 hides this cost with a **micro-op cache** (decoded-µop cache / DSB) that skips re-decoding hot code, plus brute-force parallel length pre-decode, but it's real silicon and power spent on a problem RISC ISAs don't have.

This is a core reason wide front-ends were historically easier on RISC and why Apple's AArch64 cores decode 8+ instructions per cycle comfortably.

### Q4. Walk me through a function prologue and epilogue.

A typical x86-64 frame-pointer prologue/epilogue:

```
foo:
    push rbp            ; save caller's frame pointer
    mov  rbp, rsp       ; establish our frame base
    sub  rsp, 32        ; reserve 32 bytes of locals
    ...                 ; body: locals at [rbp-8], [rbp-16], ...
    mov  rsp, rbp       ; discard locals (or: leave)
    pop  rbp            ; restore caller's frame pointer
    ret                 ; pop return address into rip
```

The `push rbp; mov rbp, rsp` pair chains frame pointers into a linked list a debugger can walk to unwind the stack. `sub rsp, N` allocates locals. On exit, `leave` (`= mov rsp,rbp; pop rbp`) tears it down and `ret` pops the return address the `call` instruction pushed. With `-fomit-frame-pointer` the compiler skips the `rbp` dance and addresses locals off `rsp` directly, freeing `rbp` as a 16th GPR — common in optimized builds, at the cost of harder stack unwinding (mitigated by DWARF CFI). AArch64's equivalent uses `stp x29, x30, [sp, #-16]!` to push frame pointer and link register together.

### Q5. What is the red zone, and when can a function use it?

The **red zone** is a 128-byte region *below* `rsp` (i.e. `[rsp-128, rsp)`) that the System V AMD64 ABI guarantees signal handlers and interrupts won't clobber. A **leaf function** — one that calls nothing else — can therefore use it as scratch for locals **without adjusting `rsp` at all**, saving the `sub rsp, N` / `add rsp, N` pair.

```
leaf:
    mov  [rsp-8], rdi   ; stash a local in the red zone, no rsp change
    ...
    ret
```

It only works because nothing will push onto the stack beneath `rsp` to overwrite it. It's void the moment the function makes a `call` (the callee would trash it). Note it's a **System V** feature — the Windows x64 ABI has **no red zone**, and kernel code often compiles with `-mno-red-zone` because interrupt handlers *do* run on the same stack below `rsp`.

### Q6. Describe the System V AMD64 calling convention end to end.

For a call with integer/pointer arguments:

1. **Arguments**: first six in `rdi, rsi, rdx, rcx, r8, r9` (in that order). Further args pushed onto the stack, right-to-left, so arg 7 sits at the lowest address. Floating-point args go in `xmm0–xmm7`. For variadic functions, `al` holds the count of vector registers used.
2. **The call**: `call foo` pushes the 8-byte return address and jumps.
3. **Stack alignment**: `rsp` must be **16-byte aligned at the point of `call`** (so on entry to the callee, after the pushed return address, `rsp % 16 == 8`). Violating this crashes SSE/AVX code that uses aligned moves.
4. **Return value**: in `rax` (and `rdx:rax` for 128-bit returns; `xmm0` for floats). Small structs may be returned in `rax:rdx`; large ones via a hidden pointer in `rdi` (sret).
5. **Register preservation**: callee must restore `rbx, rbp, r12–r15` and `rsp`; everything else (`rax, rcx, rdx, rsi, rdi, r8–r11`, all `xmm`) is caller-saved and may be clobbered.

The Windows x64 convention differs: args in `rcx, rdx, r8, r9`, a mandatory 32-byte **shadow space**, no red zone, and a different callee-saved set — which is exactly why you can't blindly link objects built for different ABIs.

### Q7. Caller-saved vs callee-saved — why does the split exist and how does the compiler decide?

The split is an optimization of the *total* number of save/restore operations across a program. Neither party knows what the other needs, so a convention pre-assigns responsibility:

- **Caller-saved (volatile)**: the callee may freely clobber these. If the caller has a live value in one across a call, *the caller* spills it. Good for values that are dead by the call anyway — zero cost.
- **Callee-saved (non-volatile)**: the callee must preserve these, spilling only the ones it actually uses. Good for values the caller keeps live across many calls.

The compiler places a value in a callee-saved register when it's **live across a call** (so it survives without the caller spilling repeatedly), and in a caller-saved/scratch register when it's short-lived. A leaf function that never calls anything preferentially uses caller-saved registers so it needs *zero* prologue saves. The whole scheme minimizes dynamic push/pop count: hot values that cross calls pay one save in the callee that uses them, rather than one save per call site in the caller.

### Q8. Why would a senior engineer read disassembly? Give concrete scenarios.

Because the source is not what runs — the compiler's output is, and the two diverge in ways that matter:

- **Verify an optimization landed.** Did that loop actually vectorize to `ymm`/`vfmadd` instructions, or did an aliasing worry force scalar code? Compiler Explorer / `objdump -d` is the only ground truth. `-O2` vs `-O3` differences, autovectorization, inlining decisions — all visible only in the asm.
- **Explain a performance cliff.** A function got slow after a refactor; the disassembly shows the compiler now spills to the stack every iteration (register pressure) or emits a `div` where you expected a shift.
- **Read a crash.** A core dump gives you `rip` and a register file. Mapping `rip` back to an instruction, and reading `rdi`/`rsi` as the arguments per the ABI, tells you what blew up when there's no clean stack trace.
- **Debug ABI/FFI mismatches.** Calling C from Rust/assembly and getting garbage? The disassembly shows whether arguments landed in the right registers.
- **Trust but verify security-sensitive code.** Confirm a `memset` of a secret wasn't optimized away, or that a constant-time comparison stayed branchless.

You don't write assembly; you read it as the authoritative account of what the machine will do.

### Q9. Worked example: how expensive is a function call, in instructions and cycles?

Take a small non-leaf call under System V. The overhead beyond the useful work:

- **At the call site**: load up to 6 args into registers (often free — they're already there), `call` (1 instruction; pushes return address, ~cheap, well-predicted).
- **Prologue**: `push rbp; mov rbp,rsp` (2), plus one `push` per callee-saved register the function touches, plus `sub rsp, N` (1).
- **Epilogue**: mirror pops, `leave` or equivalent, `ret`.

For a trivial function that's ~6–10 instructions of pure overhead. In *cycles*, a correctly-predicted `call`/`ret` pair is only a few cycles thanks to the **return-address stack predictor**, and the pushes/pops hit hot L1 stack cache (~4–5 cycle loads, but pipelined). So a warm call is on the order of **~10–20 cycles** of overhead — cheap enough that it's usually noise, which is *why* inlining matters only for tiny hot functions where that overhead rivals the body. The expensive case is a mispredicted indirect `call` (virtual dispatch, function pointer) — a branch misprediction costs ~15–20 cycles of pipeline flush, dwarfing the call mechanics. That's the real cost of `virtual`/`dyn`, not the extra pointer load.

### Q10. A gotcha: what breaks if a function violates 16-byte stack alignment?

The System V ABI requires `rsp` 16-byte aligned at each `call`. Most integer code doesn't care, so a subtle misalignment bug can lurk invisibly — until code hits an instruction that *does* require alignment. SSE/AVX aligned moves like `movaps`/`movdqa`, which the compiler emits freely for local `double`/vector spills, **fault (`#GP`) on a misaligned address**. The classic symptom: a program that works fine until it calls into a math-heavy or vectorized function and then segfaults deep in library code with a clean-looking stack.

Common causes: hand-written assembly or a JIT that pushes an odd number of 8-byte values before a `call`, or an inline-asm block that leaves `rsp` off by 8. The fix is to account for the fact that `call` itself pushes 8 bytes — so inside a function you're at `rsp % 16 == 8` on entry, and your prologue must restore 16-byte alignment before any nested `call`. This is one of the most common ABI-violation bugs and a favorite interview trap because the failure surfaces far from its cause.

### Q11. The interview one-liner.

A calling convention is an unenforced treaty that makes separate compilation work: on System V AMD64, integer args go in `rdi, rsi, rdx, rcx, r8, r9` then the stack, the return in `rax`, `rbx/rbp/r12–r15` are callee-saved and everything else caller-saved, `rsp` is 16-byte aligned at each `call`, and a leaf function can scribble in the 128-byte red zone for free — and a senior engineer reads the disassembly rather than the source whenever the question is what the machine *actually* does, from verifying vectorization to decoding a crash's register dump.


## Performance Analysis

### Summary

**What this topic covers**

This topic is about reasoning quantitatively about how fast a program runs on real hardware, and *why*. It ties together the microarchitectural machinery from the rest of this primer (pipelines, caches, out-of-order execution, SIMD, memory hierarchy) into models you can actually compute with: the CPU performance equation, Amdahl's and Gustafson's laws for parallel scaling, and the roofline model for deciding whether you are limited by arithmetic throughput or by the memory system. It also covers the discipline of *measuring* honestly — hardware performance counters, benchmarking hygiene, and how to classify a hot loop as compute-, memory-, or latency-bound before you waste a week optimising the wrong thing.

**Mental model**

Every performance question reduces to a single identity: `wall_time = instructions × CPI × cycle_time`. These three factors are owned by different layers. The compiler and ISA set *instruction count*; the microarchitecture sets *CPI* (cycles per instruction — governed by pipeline stalls, cache misses, branch mispredicts, dependency chains); the process technology and voltage/frequency set *cycle time*. Optimisation means finding which factor dominates and attacking it, because the others are noise. A 3 GHz core retiring 4 instructions per cycle can do 12 billion instructions/second *in theory* — but a single L3 miss costs ~200+ cycles (~70 ns), during which the machine could have retired ~800 instructions. So a loop that "looks" compute-heavy is often just waiting on DRAM. The whole art is refusing to guess: model the ceiling, measure the actual, and close the gap between them with evidence from counters, not intuition.

**Key terms**

- **CPI / IPC** — cycles per instruction and its reciprocal, instructions per cycle. Modern wide cores retire ~1–4 IPC; a stalled loop can drop below 0.3.
- **Amdahl's law** — fixed-workload speedup ceiling set by the serial fraction: `S = 1 / ((1−p) + p/N)`.
- **Gustafson's law** — scaled speedup; grow the problem with the machine, so speedup ≈ `N − (1−p)(N−1)`.
- **Roofline model** — plots attainable FLOP/s against arithmetic intensity, capped by peak compute and by `peak_bandwidth × intensity`.
- **Arithmetic intensity** — FLOPs performed per byte moved from memory (FLOP/byte). Low = memory-bound, high = compute-bound.
- **Ridge point** — the intensity where the memory roof meets the compute roof; the break-even between the two regimes.
- **PMU / hardware performance counters** — on-chip registers counting micro-events (cache misses, branch mispredicts, cycles, retired instructions), read via `perf`, VTune, `perf_event_open`.
- **Compute-bound / memory-bound / latency-bound** — the three ways a loop stalls: out of ALU/FPU throughput, out of bandwidth, or waiting on a serial dependency chain.
- **Geometric mean** — the correct average for normalised benchmark ratios (arithmetic mean of ratios is meaningless).
- **Warmup / steady state** — discarding early iterations so caches, TLBs, branch predictors, and (in managed runtimes) JITs have converged.

**Why interviewers ask this**

Anyone can say "it's slow, add threads." The senior signal is refusing to optimise blind. A junior quotes clock speed and core count; a senior asks "what's the arithmetic intensity?" and "what does the miss rate say?" before touching code. The classic trap is proposing to parallelise a workload that's 30% serial (Amdahl caps you at ~3.3× no matter how many cores) or SIMD-vectorising a loop that's already saturating DRAM bandwidth (zero gain — you were memory-bound). Interviewers want to see you decompose `time = instructions × CPI × cycle` and name which term you're attacking, know when Amdahl vs Gustafson applies, and treat a benchmark number as a distribution with variance, not a single truth.

**Common confusions**

- "More cores = proportional speedup" → only if the serial fraction is tiny; Amdahl's ceiling bites hard.
- "GHz is performance" → clock is one of three factors; a higher-IPC core at lower clock often wins.
- "Vectorise/parallelise the hot loop" → useless if it's memory- or latency-bound; check the roofline first.
- "Average the speedup ratios" → use the geometric mean for normalised ratios, not arithmetic.
- "One run is a measurement" → without warmup and repeats you're measuring cold caches and noise.
- "High CPU utilisation = efficient" → a core spinning on cache-miss stalls shows 100% busy while doing almost nothing.

**What follows from this topic**

Performance analysis is the capstone that gives every other topic a number. The CPI term is where [[caches]], [[branch-prediction]], [[pipelining]], and [[out-of-order-execution]] cash out. Arithmetic intensity is set by the [[memory-hierarchy]] and bandwidth, and the compute roof by [[simd]] width and core count. Amdahl and Gustafson frame the limits of [[multicore]] and are why [[cache-coherence]] traffic matters at scale. Master this and the rest of the primer stops being trivia and becomes a toolkit for predicting — and then measuring — where the cycles actually go.

### Q1. Write down the CPU performance equation and explain who owns each term.

`Execution_time = Instruction_count × CPI × Clock_cycle_time` (equivalently `IC × CPI / frequency`). Three independent levers:

- **Instruction count** — set by the algorithm, compiler, and ISA. A better algorithm (O(n log n) vs O(n²)) or a CISC instruction that does more work per op reduces it.
- **CPI** — set by the microarchitecture and the program's behaviour on it: pipeline depth, cache miss rate, branch mispredicts, dependency chains, functional-unit contention. This is the term most software optimisation actually moves.
- **Cycle time** — set by process node, voltage/frequency, and pipeline stage delay. Largely outside software control (thermal/DVFS effects aside).

The trap the equation exposes: these interact. RISC lowers CPI but raises instruction count; a deeper pipeline shrinks cycle time but raises CPI (more stall penalty per mispredict). You optimise the *product*, not any single factor — which is why "our chip is 4 GHz" tells you almost nothing on its own.

### Q2. CPI versus IPC — when do you reach for each, and what values are realistic?

They're reciprocals (`IPC = 1/CPI`) but frame problems differently. **IPC** is the natural unit for a superscalar, out-of-order core because it can retire multiple instructions per cycle — a modern x86-64 or Apple core has ~6–8-wide retire and hits IPC of 1–4 on good code. You quote IPC when the question is "how well am I using this wide machine?" **CPI** is more natural when stalls dominate: a loop bottlenecked on L3/DRAM misses might show CPI of 3–5 (IPC 0.2–0.3), and thinking in "cycles per instruction" makes the added stall cycles legible. Rule of thumb: use IPC to talk about *utilisation of a wide core*, CPI to talk about *stall accounting*. If `perf stat` reports IPC of 0.4 on a hot loop, that's a red flag — the core is starved, almost certainly on memory or a serial dependency chain, and the fix is data-layout/prefetch, not more ALU work.

### Q3. State Amdahl's law and work a numeric example.

Amdahl's law bounds speedup on a **fixed** workload when you parallelise a fraction `p` across `N` processors: `S(N) = 1 / ((1−p) + p/N)`. The serial fraction `(1−p)` never speeds up, so as `N → ∞`, `S → 1/(1−p)`.

Worked example: a job is 95% parallelisable (`p = 0.95`). On 8 cores: `S = 1 / (0.05 + 0.95/8) = 1 / (0.05 + 0.11875) = 1/0.16875 ≈ 5.9×` — not 8×. On 32 cores: `S = 1/(0.05 + 0.0297) ≈ 12.5×` from 32 cores, a return of ~39% efficiency. The absolute ceiling is `1/0.05 = 20×` — buying 1000 cores gets you nowhere near it. The brutal lesson: a mere 5% serial section caps you at 20×, and the last few percent of serial code dominates the entire scaling story. This is why interviewers push back on "just add threads" — you must know `p` first.

### Q4. If Amdahl's law is so pessimistic, why do real supercomputers scale to millions of cores? (Gustafson's law)

Because Amdahl assumes the problem size is *fixed*. In practice people buy more cores to solve *bigger* problems in the same time, not the same problem faster. Gustafson's law captures this **scaled speedup**: if a run on `N` processors spends serial fraction `s` and parallel fraction `(1−s)` of its *time*, the scaled speedup is `S = N − s(N−1) = s + (1−s)·N`. The serial part stays a fixed cost while the parallel work grows with the machine, so speedup becomes roughly *linear* in `N` rather than hitting a ceiling.

The reconciliation: Amdahl and Gustafson are the same math viewed from opposite ends — Amdahl fixes the *workload*, Gustafson fixes the *runtime*. Weak scaling (grow problem with cores, Gustafson) looks great; strong scaling (fix problem, add cores, Amdahl) hits a wall. When someone reports "linear scaling to 10,000 nodes," ask whether they held the problem size fixed (strong, impressive) or grew it (weak, expected). Weather models, N-body sims, and training runs live in Gustafson's world; a latency-bound request handler lives in Amdahl's.

### Q5. Explain the roofline model and what the ridge point tells you.

Roofline plots **attainable performance** (FLOP/s, log axis) against **arithmetic intensity** (FLOP per byte of DRAM traffic, log axis). Two ceilings form the "roof":

- A slanted **memory roof**: `attainable = peak_bandwidth × arithmetic_intensity`. At low intensity you're limited by how fast you can feed data.
- A flat **compute roof**: `attainable = peak_FLOP/s`. Once you do enough math per byte, the ALUs/FPUs are the limit.

They meet at the **ridge point** — the intensity where `peak_FLOP/s = peak_bandwidth × intensity`, i.e. `ridge = peak_FLOP / peak_BW`. For a machine with, say, 1 TFLOP/s and 100 GB/s, the ridge is at 10 FLOP/byte. A kernel to the *left* (low intensity, e.g. SAXPY / vector add at ~0.1 FLOP/byte) is **memory-bound** — no amount of SIMD or extra cores helps; you must reduce traffic (blocking, fusion, better layout). A kernel to the *right* (dense matmul, ~10s of FLOP/byte after tiling) is **compute-bound** — now vectorisation and more FPUs pay off. Roofline's value is that it tells you *which optimisation is even worth trying* before you write any code, and it makes "we're at 30% of peak" actionable by showing which roof you're under.

### Q6. Walk me through deciding whether a hot loop is compute-, memory-, or latency-bound.

Three-step evidence-gathering, not guessing:

1. **Estimate arithmetic intensity.** Count FLOPs (or useful ops) and bytes touched per iteration. Low FLOP/byte (< the machine's ridge) → suspect memory-bound; high → suspect compute-bound.
2. **Read the counters.** `perf stat` gives IPC, `LLC-load-misses`, `mem_load_retired`. High miss rate + low IPC (< 0.5) with the core stalled on loads → **memory-bound** (bandwidth if streaming, capacity if working set > cache). High IPC near the core's width with functional units saturated → **compute-bound**.
3. **Check for serial dependency chains.** If misses are low *and* IPC is low *and* utilisation of any single unit isn't maxed, you're likely **latency-bound**: a chain of dependent ops (pointer chasing, a reduction with no ILP, dependent FP adds each ~4 cycles) where the machine can't find independent work. The tell is that the loop speeds up when you unroll and interleave independent accumulators, exposing ILP.

Fixes differ per class: memory-bound → cache blocking, prefetch, shrink/compact data, SoA layout; compute-bound → SIMD, better instruction selection, more cores; latency-bound → break the dependency chain, multiple accumulators, software pipelining, hide latency with more outstanding work.

### Q7. How do hardware performance counters (the PMU) work, and what do you read from them?

Every modern core has a **Performance Monitoring Unit** — a handful of programmable counter registers plus a fixed set of countable micro-events. You program a counter to increment on, say, `LLC-load-misses` or `br_misp_retired`, run the code, and read the register. On Linux `perf` wraps `perf_event_open(2)`; Intel VTune and AMD uProf give the same data with nicer attribution. Because there are only ~4–8 general counters, tools **multiplex** (time-slice events and scale up) when you ask for more, which adds sampling error — so measure the few events you care about directly.

The events that matter for the three-way diagnosis:

- **cycles / instructions** → IPC, the headline efficiency number.
- **cache-misses at each level** (`L1-dcache-load-misses`, `LLC-misses`) → memory pressure and where the working set spills.
- **branch-misses** (`br_misp_retired`) → mispredict cost; each is ~15–20 cycle pipeline flush.
- **stall / topdown counters** → modern Intel/ARM cores expose a "top-down" breakdown attributing every cycle to retiring, bad-speculation, front-end-bound, or back-end-bound, which points you straight at the bottleneck class.

Two gotchas: **skid** (the sampled instruction pointer lands a few instructions past the real culprit, so blame the neighbourhood not the exact line), and the observer effect (heavy sampling perturbs the very thing you measure — keep sampling frequency sane).

### Q8. What are the classic benchmarking pitfalls, and how do you avoid producing a lie?

- **No warmup.** The first iterations run with cold caches, cold TLBs, an untrained branch predictor, and (in JVM/JS/.NET) un-JITted code. Discard them; measure steady state.
- **Treating one run as the answer.** Runtime is a distribution. Report median and spread (or min for pure compute where noise is one-sided), not a single number. Frequency scaling (turbo/DVFS), interrupts, and noisy neighbours inject variance — pin frequency, pin the thread, run enough repeats.
- **Wrong average across a suite.** For *normalised* ratios (speedup vs a baseline) use the **geometric mean**; the arithmetic mean of ratios depends on which system you picked as baseline and is meaningless.
- **Measuring the wrong thing.** Dead-code elimination deletes your benchmark's body if the result is unused — consume it (`DoNotOptimize`/`std::atomic_signal_fence`, blackhole sinks). Constant folding precomputes at compile time. A microbenchmark that fits entirely in L1 tells you nothing about production where the data is in DRAM.
- **Ignoring the environment.** Debug vs release build, `-O2` vs `-O3`, CPU governor, ASLR, and hyperthread siblings all move numbers. State the config.

The senior habit: a benchmark result without variance, warmup, and a stated environment is an anecdote, not a measurement.

### Q9. A colleague says "utilisation is at 100%, the CPU is fully busy, so we're maxed out." Why might that be wrong?

Because "utilisation" as reported by the OS only means the core wasn't idle — it says nothing about whether it did useful work. A core stalled on a chain of L3/DRAM misses is, from the scheduler's view, 100% busy: it's dispatched, not halted, just waiting on memory. But its IPC might be 0.2, meaning ~90% of its issue slots are empty. This is the difference between **occupancy** and **efficiency**. The right instrument is the top-down PMU breakdown: if it reports the core is 70% **back-end-bound / memory-bound**, then those "busy" cycles are stall cycles and there's a 3–5× headroom locked behind the memory system. The fix isn't a faster clock or more of the same cores — it's reducing memory traffic (blocking, compaction, better layout) or exposing more memory-level parallelism so misses overlap. "100% utilised" and "efficient" are orthogonal; conflating them is how teams throw hardware at a problem that hardware can't fix.

### Q10. The interview one-liner: sum up performance analysis in one crisp paragraph.

Performance analysis is the discipline of turning "it's slow" into a number and a cause. It rests on one identity — `time = instructions × CPI × cycle_time` — where each factor is owned by a different layer, so you find the dominant one and attack it rather than guessing. Amdahl's law caps fixed-workload parallel speedup at `1/(1−serial_fraction)` (a 5% serial section limits you to 20×, no matter the core count), while Gustafson's law explains why growing the problem with the machine still scales; the roofline model, plotted as attainable FLOP/s against arithmetic intensity with its memory and compute roofs meeting at the ridge point, tells you whether you're memory- or compute-bound *before* you optimise. You confirm the diagnosis with hardware performance counters — IPC, cache misses, branch mispredicts, top-down stall breakdown — and you defend your numbers with benchmarking hygiene: warmup, repeats, geometric means for ratios, and consuming results so the compiler doesn't delete your work. The whole point is to never optimise blind: model the ceiling, measure the actual, and close the gap with evidence.


## Power, Thermals & Scaling Limits

### Summary

**What this topic covers**

This is the physics that shapes everything else in the machine. A modern CPU is a power-conversion device: it turns watts into heat while doing work, and the rate at which it can dissipate that heat — not the rate at which transistors can switch — is the real ceiling on performance. This topic covers where a chip's power goes (dynamic switching vs static leakage), the `V²·f` relationship that makes voltage the dominant knob, the two scaling laws behind 40 years of progress (Moore's Law on transistor *count*, Dennard scaling on power *density*), why Dennard scaling collapsed around 2005 and forced the pivot to multicore, and the consequences: dark silicon, heterogeneous/specialized computing, TDP, throttling and boost, and chiplets. It is the "why" behind your laptop having four big and four small cores instead of one 10 GHz core.

**Mental model**

Think of a CPU as a bucket of tiny capacitors (transistor gate + wire capacitance) that you charge and discharge every clock edge. Charging a capacitor to voltage `V` and dumping it takes energy proportional to `C·V²`. Do that `f` times per second across the fraction `α` of transistors that actually toggle, and you get dynamic power `P = α·C·V²·f`. The killer is the `V²` term: voltage appears squared in power, *and* you need higher voltage to clock faster, so raw frequency pushing is brutally expensive — power scales roughly with the cube of frequency in that regime. On top of dynamic power sits *static* (leakage) power: even an idle transistor leaks current through its gate and channel, and leakage grows exponentially as you thin the oxide and lower threshold voltage. Once you can't lower voltage any further without leakage exploding, the free lunch is over. The escape hatch is parallelism: two cores at half the frequency and lower voltage do the same work at a fraction of the power — *if* the workload parallelizes.

**Key terms**

- **Dynamic power** — `P_dyn = α·C·V²·f`; energy spent charging/discharging capacitance as gates switch. `α` is activity factor, `C` capacitance, `V` supply voltage, `f` clock frequency.
- **Static / leakage power** — power drawn even when idle, from sub-threshold and gate-oxide leakage. Grows exponentially as feature sizes and threshold voltage shrink; can be 20–40% of total on modern nodes.
- **DVFS (Dynamic Voltage-Frequency Scaling)** — hardware runtime lever that lowers both `V` and `f` together to cut power super-linearly; the basis of power/thermal management.
- **Moore's Law** — transistor *count* per chip roughly doubles every ~2 years. Still limping along (slower, costlier). Says nothing about power or speed.
- **Dennard scaling** — as transistors shrink, power *density* stays constant (V and current scale down with dimensions). This is what actually delivered "smaller = faster and cooler." Ended ~2005.
- **Power wall** — the point where you cannot clock a single core faster because you cannot remove the heat. Froze single-core clocks around 3–5 GHz.
- **TDP (Thermal Design Power)** — the sustained watts the cooling solution must dissipate; a design/thermal budget, not peak power.
- **Dark silicon** — the fraction of transistors that must stay powered off at any instant because powering them all would exceed the thermal budget.
- **Heterogeneous computing** — mixing core types and accelerators (P-cores + E-cores, GPU, NPU, fixed-function blocks) to get work done within a fixed power budget.
- **Chiplet** — a smaller die combined with others in one package (via an interposer/substrate) instead of one big monolithic die; improves yield and lets you mix process nodes.

**Why interviewers ask this**

A junior answer treats clock speed as the performance number and assumes chips got slower to improve because "smaller transistors." A senior answer names *which* scaling law broke, distinguishes Moore's Law (still alive, about count) from Dennard scaling (dead, about power density), and can explain *why* that break made multicore mandatory rather than optional — the `V²f` math, the leakage floor, and the fact that ILP had also plateaued. The strongest signal is connecting the dots: Dennard's end → power wall → multicore → Amdahl's Law limits → dark silicon → specialization/accelerators. If a candidate can explain why a phone SoC has a dozen different compute blocks or why data-center chips went chiplet, they understand that architecture in the last 20 years has been an exercise in spending a fixed power budget wisely, not chasing raw frequency.

**Common confusions**

- *"Moore's Law ended."* → Moore's Law (transistor count) is slowing but not the thing that broke in 2005; **Dennard scaling** (constant power density) is what ended and caused the frequency stall.
- *"Higher clock = proportionally more power."* → Power scales with `V²·f`, and higher `f` needs higher `V`, so it's closer to cubic — doubling frequency can roughly 8× the power.
- *"TDP is max power draw."* → TDP is a sustained *cooling* budget; short bursts (boost/PL2) legitimately exceed it.
- *"Dark silicon means wasted/broken transistors."* → They work fine; they're just power-gated off because the thermal budget can't feed all of them at once.
- *"More cores always = faster."* → Only for parallel work; Amdahl's Law caps the win, and serial code sees no benefit.

**What follows from this topic**

The power wall is the historical hinge for the whole primer. It explains why *pipelining and superscalar ILP* hit diminishing returns, why *multicore, SIMD, and GPUs* became the growth path (data/thread parallelism instead of frequency), and why *cache hierarchies* matter — moving data costs far more energy than computing on it. Heterogeneous computing connects to the *accelerators/GPU* and *ISA* topics; DVFS's *governor policy* lives in the Operating Systems primer, while the hardware mechanism is covered here. Amdahl's Law is the ceiling on the multicore escape hatch.

### Q1. Break down where a CPU's power goes. What are the two big buckets?

Two buckets: **dynamic** and **static**.

**Dynamic (switching) power** dominates when the chip is busy: `P_dyn = α·C·V²·f`. Every clock edge, transistors that change state charge or discharge their load capacitance. `α` is the activity factor (fraction of nodes toggling), `C` the switched capacitance, `V` supply voltage, `f` frequency. There's also a small short-circuit component during the brief moment both pull-up and pull-down networks conduct.

**Static (leakage) power** is drawn whether or not anything switches. Sub-threshold leakage (current through a nominally "off" transistor) and gate-oxide tunneling both rise sharply as you shrink features and lower threshold voltage. On older large nodes leakage was negligible; on modern sub-10nm nodes it can be a *third* or more of total power, which is exactly why chips aggressively power-gate and clock-gate idle blocks — you can't afford to leave them on doing nothing.

The design implication: dynamic power you fight with voltage/frequency scaling and reducing activity; static power you fight with power-gating, high-`V_t` (threshold) transistors on non-critical paths, and FinFET/GAA device structures that leak less.

### Q2. Why is voltage the most powerful lever? Walk through the V²f relationship.

Because voltage hits power *twice*. It appears literally squared in `P = α·C·V²·f`, and separately, a transistor switches faster at higher voltage, so higher `V` is what *lets* you raise `f`. Roughly, maximum frequency scales with `(V − V_t)²/V`, close to linear in `V` over the usable range.

So if you want to run 20% faster, you raise frequency 20% *and* must raise voltage to support it. Power goes up by the frequency factor times the voltage-squared factor — the combined effect is roughly **cubic** in performance. Concretely, pushing a core from 3 GHz to 4 GHz (33% faster) can more than double its power.

Run it the other way and it's the whole argument for multicore: drop voltage and frequency each ~20% and one core's power falls to maybe 40–50%. Two such cores do ~1.6× the aggregate work of the original single core at roughly the *same* total power. That's DVFS and multicore in one equation — you buy throughput with parallelism far more cheaply than with frequency.

### Q3. What is DVFS and how does it actually get used?

**Dynamic Voltage-Frequency Scaling** is the hardware's ability to shift `(V, f)` operating points at runtime, in microseconds. Because power is super-linear in the operating point, dropping to a lower `(V, f)` pair saves power far out of proportion to the performance lost — ideal when the workload is memory-bound or the chip is idle-ish.

Mechanically, the chip exposes a set of discrete P-states (performance states), each a validated `(V, f)` pair. A controller — partly OS *policy*, partly on-die power management firmware — picks the state based on utilization and thermal headroom. The OS-facing governor policy (which state to request, and when) lives in the Operating Systems primer; the mechanism (voltage regulators, PLLs, per-domain clock/power gating) is the hardware side covered here.

Two subtleties: (1) transitions aren't free — changing voltage means waiting for regulators to settle, so there's latency and hysteresis; (2) modern chips do it per-domain (per-core, per-cluster, uncore separately), so a background thread on an E-core cluster can idle low while a P-core boosts.

### Q4. Explain the difference between Moore's Law and Dennard scaling. Which one broke, and when?

They're constantly conflated but describe different things.

**Moore's Law** (1965) is an economic/count observation: the number of transistors you can put on a chip at minimum cost roughly *doubles every ~2 years*. It says nothing about speed or power — just density of devices. It's still going, though slower and much more expensive per node.

**Dennard scaling** (1974) is the physics that made shrinking *feel* free: as you scale transistor dimensions down by a factor `k`, you scale voltage and current down too, so **power density stays constant**. Same chip area, more (and faster) transistors, same heat. This is what actually delivered "each generation is faster *and* cooler at the same power."

**Dennard scaling broke around 2005.** You couldn't keep lowering voltage because threshold voltage couldn't drop without leakage exploding — the `V_t` floor. Voltage stalled, so shrinking transistors no longer cut power density; cramming more switching transistors into the same area meant more heat per mm². Frequencies froze in the 3–5 GHz band and have basically stayed there for two decades. Moore's Law kept giving us *more* transistors; Dennard's death meant we could no longer *power them all faster*.

### Q5. Why did the end of Dennard scaling force the pivot to multicore specifically?

Because it removed the two ways to spend extra transistors on single-thread speed.

By ~2005, architects had a growing transistor budget (Moore's Law) but two dead ends: (1) **frequency** was blocked by the power wall — you couldn't clock higher without melting the die; and (2) **ILP** (extracting more instruction-level parallelism from one thread via wider issue, deeper OoO, more speculation) had hit steep diminishing returns — each extra bit of IPC cost disproportionate power and area for a few percent gain.

Multicore was the only remaining way to convert transistors into performance *within the power budget*. Two simpler, slightly-lower-clocked cores deliver more aggregate throughput per watt than one heroic core (the `V²f` argument again). So around 2004–2006 Intel cancelled its high-frequency single-core roadmap (the Pentium 4/Tejas line) and everyone shifted to dual- then many-core.

The catch, and the reason it wasn't a clean win: multicore only helps *parallel* workloads. **Amdahl's Law** says a program that's 90% parallelizable maxes out at 10× no matter how many cores you add — the serial 10% dominates. So the burden shifted from hardware to software: performance now requires parallel programming, not a faster chip under the same code.

### Q6. What is "dark silicon" and why does it exist?

Dark silicon is the fraction of a chip's transistors that must be **powered off at any given moment** because turning them all on simultaneously would blow the thermal budget.

It's the direct arithmetic consequence of Moore's Law continuing while Dennard scaling stopped. Each new node gives you ~2× the transistors in the same area, but *without* the matching power-density reduction, you can only afford to keep a slice of them switching at once. Studies around 2011 estimated that at each node an increasing share — potentially over half — of a chip couldn't be lit up at full speed simultaneously within a fixed TDP.

This isn't waste in the "broken" sense; those transistors work. The architectural response is to *use the dark area cleverly*: fill it with **specialized accelerators** that sit idle most of the time but are enormously more energy-efficient than a general core when their specific job comes up (video codec, crypto, matrix-multiply/NPU, image signal processor). You'd rather have ten fixed-function blocks, nine of them dark at any instant, than a big general core doing everything inefficiently. Dark silicon is thus a major driver of heterogeneous, accelerator-rich SoCs.

### Q7. What is heterogeneous computing, and give concrete examples of the "big.LITTLE" idea and accelerators.

Heterogeneous computing means putting **different kinds of compute** on one chip and routing each task to the unit that does it most efficiently — because with a fixed power budget, efficiency (work per watt), not peak speed, is the scarce resource.

**Big.LITTLE / P+E cores:** mix high-performance cores with small energy-efficient ones. Arm's big.LITTLE and DynamIQ pair, say, Cortex-X/A7xx "big" cores with A5xx "little" cores. Apple Silicon (M-series, A-series) uses "performance" and "efficiency" cores. Intel's since Alder Lake ships P-cores + E-cores. Background/lightweight threads run on the small cores at a fraction of the power; bursty foreground work spins up the big cores. The OS *scheduler* decides placement (that policy is in the OS primer); the hardware *provides* the asymmetric cores and the fast migration path.

**Fixed-function accelerators:** a phone SoC bundles a GPU, an NPU/neural engine for ML inference, an image signal processor for the camera, video encode/decode blocks, DSPs, and crypto engines. Each is 10–100× more energy-efficient than doing the same task on a general CPU core — which is the whole point when your power budget is a few watts and your battery is finite. This is where the dark-silicon transistors go to earn their keep.

### Q8. Define TDP, throttling, and boost, and explain how they relate.

**TDP (Thermal Design Power)** is the sustained heat, in watts, that the cooling solution is *designed to dissipate* — a budget for cooler/heatsink sizing, not a hard power cap and not peak draw. A "65W TDP" CPU means "design cooling for 65W of continuous heat."

**Boost** exploits thermal *headroom*. When the chip is cool and only some cores are busy, it opportunistically raises `(V, f)` above the base clock — Intel Turbo Boost, AMD Precision Boost. Modern chips define short-term power limits (Intel's PL2) well above the sustained limit (PL1 ≈ TDP) with a time window (tau): burst hard for tens of seconds, then settle back. Boost is bounded by temperature, current, and power limits, whichever it hits first.

**Throttling** is the safety valve going the other way. On-die thermal sensors watch junction temperature; as it nears the limit (often ~90–100 °C, `T_junction_max`), the chip *reduces* `(V, f)` to cut heat and stay safe. There's usually a hard emergency shutdown above that.

They form one feedback loop: boost climbs while there's thermal and power headroom; throttling pulls back when the budget is exceeded; TDP is the sustained set-point the loop settles toward. This is why real-world performance depends heavily on cooling and enclosure — a chip in a thin fanless laptop throttles far sooner than the same silicon in a desktop tower.

### Q9. Worked example: quantify why two cores beat one faster core at the same power.

Take a single core at baseline `(V₀, f₀)` drawing power `P₀ = α·C·V₀²·f₀`, doing 1 unit of work per second.

Now imagine two design choices for the "next gen" within the same power budget `P₀`:

**Option A — push frequency 40%.** To hit `1.4·f₀` you need higher voltage; say `V` rises to `1.2·V₀` (roughly linear-ish). Power becomes `α·C·(1.2V₀)²·(1.4f₀) = 1.44 × 1.4 × P₀ ≈ 2.0·P₀`. You *doubled* power for **1.4×** the work. Ratio: 0.7× work per watt — you went *backwards* on efficiency.

**Option B — two cores at lower clock.** Drop each core to `0.8·f₀` and, because it's slower, lower voltage to `~0.85·V₀`. Per-core power ≈ `α·C·(0.85V₀)²·(0.8f₀) = 0.72 × 0.8 × P₀ ≈ 0.58·P₀`. Two of them draw `~1.16·P₀` — near the original budget — and (if the work parallelizes) deliver `2 × 0.8 = 1.6×` the throughput. Ratio: ~1.4× work per watt.

Same power envelope, and parallelism wins decisively: **1.6× vs 1.4× throughput**, and far better efficiency. That gap is the entire economic case for multicore. The load-bearing caveat is *"if the work parallelizes"* — Amdahl's Law claws back the win for serial-heavy code, which is why single-thread performance still matters and why we didn't just build 128 tiny cores and call it done.

### Q10. Why did the industry move to chiplets? What problem do they solve?

A chiplet design splits what would be one big monolithic die into several smaller dies co-packaged on an interposer or substrate (AMD's Zen "CCDs" + I/O die, Intel's tiles on Foveros/EMIB, Apple's UltraFusion linking two M-series dies). It's a packaging-level answer to problems the power/scaling era made acute:

- **Yield and cost.** Defects are roughly random per unit area, so yield falls sharply as die size grows — a single flaw can scrap a huge, expensive die. Four small chiplets tolerate defects far better (throw away one small die, not the whole thing), dramatically improving usable-die-per-wafer economics. Reticle limits also cap how big a single die can physically be.
- **Mix-and-match process nodes.** You can build the compute cores on the newest, most expensive node (where density/power matters most) and the I/O and analog on a cheaper, mature node (which doesn't shrink well and doesn't need to). Monolithic forces everything onto one node.
- **Modularity/scaling.** Assemble 8, 16, 32+ cores by adding chiplets instead of taping out a new giant die per SKU.

The tradeoff is that die-to-die links cost energy and latency versus on-die wires, and packaging is complex — so it's a deliberate bet that yield/cost/modularity wins outweigh the interconnect penalty. At today's node costs and core counts, that bet has clearly paid off for data-center and high-core-count parts.

### Q11. The interview one-liner: sum up power, thermals, and scaling limits in one crisp paragraph.

A modern processor is limited by heat, not switching speed: dynamic power `α·C·V²·f` (plus rising static leakage) means voltage — and therefore frequency — is punishingly expensive, roughly cubic in performance. For 40 years Moore's Law doubled transistor *count* while Dennard scaling kept power *density* flat, so shrinking made chips faster and cooler for free — until Dennard scaling died around 2005 when voltage could no longer fall against the leakage floor. That hit the power wall, froze clocks at 3–5 GHz, and — since ILP had also plateaued — forced the pivot to multicore, the only way to convert Moore's ongoing transistor bounty into throughput within a fixed thermal budget (bounded by Amdahl's Law). The same budget produced dark silicon (you can't power every transistor at once) and drove the answer to it: heterogeneous, specialized computing — big+little cores, GPUs, NPUs, fixed-function accelerators — plus DVFS, TDP-bounded boost/throttle loops, and chiplets for yield and node-mixing. In short, architecture since 2005 has been about spending a fixed power budget as cleverly as possible.


## Mechanical Sympathy — Writing Architecture-Aware Code

### Summary

**What this topic covers**

Every other topic in this primer describes what the hardware *does*: caches, coherence, pipelines, branch predictors, prefetchers, memory controllers. This topic is the payoff — how you *write code* so that the hardware runs it fast instead of fighting it. The term "mechanical sympathy" is borrowed from racing driver Jackie Stewart (you don't have to be an engineer to drive fast, but you drive faster if you understand the machine) and was brought to software by Martin Thompson of LMAX. The core discipline is **data-oriented design**: treat the memory hierarchy, the cache line, the prefetcher and the branch predictor as first-class constraints on your data layout and control flow, not implementation details the compiler will hide. On modern CPUs the arithmetic is essentially free and the bottleneck is *getting data to the ALU* — so you optimise the data path, not the instruction count.

**Mental model**

Picture the CPU as a very fast worker chained to a very slow warehouse. An L1 hit is ~4 cycles; a last-level-cache miss to DRAM is ~200–300 cycles (~60–100 ns). That is a ~70:1 gap — one cache miss costs what hundreds of adds cost. So the game is: **maximise the useful bytes per cache line you touch, and touch lines in an order the prefetcher can predict.** A cache line is 64 bytes; when you touch one byte you pay for 64. If those 64 bytes are all fields you need, the miss amortises; if 60 of them are fields you're skipping this pass, you've wasted ~94% of your memory bandwidth. Sequential, predictable access lets the hardware prefetcher run ahead and hide latency; pointer-chasing defeats it because the next address isn't known until the current load returns. Write code that streams.

**Key terms**

- **Data-oriented design (DOD)** — design around how data is laid out and accessed, not around objects/behaviour (OOP).
- **AoS (Array of Structs)** — `Particle[]`: each record's fields contiguous.
- **SoA (Struct of Arrays)** — parallel arrays, one per field: `float x[], float y[], …`.
- **Cache line** — 64 bytes; the unit of transfer between cache levels and the unit of coherence.
- **Spatial / temporal locality** — nearby-in-address / recently-used data is cheap to reach.
- **Hardware prefetcher** — detects sequential/strided access and fetches lines ahead of demand.
- **Padding / alignment** — bytes inserted so fields sit on natural boundaries; alignment = an address being a multiple of a size.
- **False sharing** — two threads write different variables that share one cache line, forcing coherence ping-pong.
- **Branch misprediction** — a wrong predicted branch flushes the pipeline (~15–20 cycles).
- **Working set** — the memory a phase of computation actively touches; fits-in-cache or it doesn't.
- **Arithmetic intensity** — FLOPs per byte moved; low intensity = memory-bound.

**Why interviewers ask this**

It separates people who know the theory of caches from people who can *use* it. A junior says "caches make memory faster." A senior says "this loop is memory-bound at ~10% of peak because it's chasing pointers through a linked list; convert the hot fields to a flat SoA array, and you'll get the prefetcher for free and roughly 5–10x." The signal is whether you reach for a *profiler and a layout change* before a micro-optimisation, whether you know a cache line is 64 bytes, and whether you can reason about false sharing in a threaded hot path. This is the daily bread of HFT, game engines, databases and numerical code.

**Common confusions**

- "The compiler optimises this for me." Compilers optimise *instructions*; they will not restructure your `struct` layout or turn AoS into SoA — data layout is your job.
- "Fewer instructions = faster." Not when you're memory-bound; a branch-free version doing *more* arithmetic often wins by avoiding pipeline flushes.
- "It's all about CPU speed." For most data-heavy code the ceiling is **DRAM bandwidth** (tens of GB/s), not GHz.
- "Alignment is just pedantry." Misalignment splits accesses across two lines and breaks atomicity guarantees.

**What follows from this topic**

This is the applied capstone: it draws directly on the caches / memory-hierarchy topic (line size, miss cost, prefetching), the cache-coherence topic (false sharing is MESI ping-pong you caused yourself), and the branch-prediction / pipelining topic (misprediction cost, branch-free code). The concurrency and lock-API side of shared data — where false sharing bites hardest — is owned by the Concurrency primer; here we stay on the hardware reason it hurts.

### Q1. What is "mechanical sympathy" and why does it matter more today than 20 years ago?

It's writing software that works *with* the underlying hardware rather than against it — matching data layout and control flow to caches, prefetchers, and branch predictors. It matters more now because the **memory wall** widened: CPU clocks plateaued around 3–5 GHz while per-core throughput kept climbing (wider issue, SIMD, more cores), but DRAM latency has barely moved (~60–100 ns for two decades). So the ratio of "cost of a cache miss" to "cost of an instruction" grew from maybe 10:1 to ~70:1. When compute is cheap and data movement is expensive, the program's *data access pattern* dominates performance — and that's the one thing the compiler won't fix for you.

### Q2. AoS vs SoA — explain the difference and when SoA wins.

**AoS (Array of Structs):** `struct P { float x,y,z; float mass; int id; } P arr[N];` — all of one particle's fields sit together. **SoA (Struct of Arrays):** `float x[N], y[N], z[N], mass[N]; int id[N];` — one array per field.

SoA wins when a pass touches *few fields across many records*. Say you only sum `mass`. With AoS, `mass` lands on the same 64-byte line as `x,y,z,id`, so each line you fetch carries maybe 4 useful bytes out of 64 — you burn ~94% of bandwidth on fields you skip, and stride past 20 bytes between each `mass`. With SoA, `mass[]` is a dense contiguous array: 16 masses per line, 100% useful, and the prefetcher streams it perfectly. That's often a 5–10x speedup and it SIMD-vectorises cleanly (16 contiguous floats = one AVX-512 load).

AoS wins when you touch *all fields of one record at a time* (e.g. process one particle fully) — then the fields you want are co-located and SoA would touch N different arrays (N cache lines) per record. Rule of thumb: **loop over records touching a subset of fields → SoA; touch whole records → AoS.** Game engines and columnar databases (Parquet, vectorised query engines) are SoA/columnar for exactly this reason.

### Q3. Why is sequential access so much faster than pointer chasing, in hardware terms?

Two mechanisms. First, **spatial locality**: sequential access uses all 64 bytes of each line you fault in, and consecutive lines are predictable. Second, and bigger, the **hardware prefetcher**: it watches the stream of misses, detects a stride (+64, +64, …), and issues loads for lines you *haven't asked for yet*, so the data is in L1/L2 before you demand it — latency hidden. Pointer chasing (`node = node->next`) defeats both: the address of the next node is *the result of the current load*, so the CPU cannot prefetch it — every hop is a serialized, dependent ~200-cycle miss with nothing to overlap it. A linked-list traversal of 1M nodes can be 10x+ slower than the same data in a flat array, even at the same "algorithmic" O(n). This is why `std::vector` beats `std::list`, and array-backed hash maps beat node-based ones, for almost all real workloads — Big-O ignores the constant that hardware cares about most.

### Q4. Explain struct padding and alignment. Walk through an example.

The compiler inserts **padding** so each field sits at an address that's a multiple of its size (natural alignment), because a misaligned access can straddle two cache lines and lose atomicity. Consider:

```
struct Bad { char a; long b; char c; };   // 1 + (7 pad) + 8 + 1 + (7 tail pad) = 24 bytes
struct Good { long b; char a; char c; };   // 8 + 1 + 1 + (6 tail pad) = 16 bytes
```

`Bad` wastes 8 bytes purely to field ordering: `b` (8-byte aligned) needs 7 pad bytes after `a`, and the struct is padded to a multiple of its largest member (8) so arrays stay aligned. **Reorder fields largest-to-smallest** and you reclaim it — here 24→16 bytes, a 33% shrink, meaning more records per cache line and fewer misses. You can force tight layout with `#pragma pack` / `__attribute__((packed))`, but beware: packed structs create *misaligned* fields, which on some ISAs fault and on x86 are merely slower — packing trades cache footprint for per-access cost, so measure. For hot data, the usual win is reorder-to-shrink, not pack.

### Q5. What is false sharing and how do you fix it?

False sharing is when two cores write *different* variables that happen to occupy the *same* 64-byte cache line. Coherence (MESI) tracks ownership per line, not per variable, so each write invalidates the other core's copy — the line ping-pongs across the interconnect even though the threads share no logical data. It can silently cost 10–100x on a hot counter.

Classic example: `long counters[NTHREADS]` where thread *i* increments `counters[i]`. Eight 8-byte counters fit in one line, so all eight threads fight over it. **Fix: pad each hot per-thread datum to its own cache line.**

```
struct alignas(64) PaddedCounter { long value; char pad[64 - sizeof(long)]; };
PaddedCounter counters[NTHREADS];   // each on its own line, no sharing
```

In Java, `@Contended` (with `-XX:-RestrictContended`) does this; C++17 exposes `std::hardware_destructive_interference_size` (usually 64). The tell in a profiler is a hot line with high coherence/HITM events and a per-thread write pattern. This is a hardware phenomenon (MESI on a line); the *lock and memory-model* view of shared state is the Concurrency primer's domain.

### Q6. Branch prediction — show a case where reordering data beats optimising code.

A mispredicted branch flushes the pipeline: ~15–20 wasted cycles on a modern deep-pipeline core. In a tight loop over data, an *unpredictable* branch is murder. The famous example:

```
for (i = 0; i < N; i++)
    if (data[i] >= 128) sum += data[i];   // random data → ~50% mispredict
```

On *random* data the predictor is right ~50% of the time and the loop crawls. **Sort `data` first** and the branch becomes almost always-false then always-taken — near-zero mispredicts — and the loop runs several times faster *even after paying for the sort*, because the branch is now perfectly predictable. Same instructions, different data order. The other fix is **branch-free code**: replace the `if` with arithmetic/predication so there's no branch to mispredict, e.g. `sum += data[i] & -(data[i] >= 128);` or a `cmov`. Branch-free does *more* work per element but has no flush — it wins precisely when the branch is unpredictable (~50/50). If a branch is highly predictable (99% one way), leave it as a branch; predication would waste the always-executed work.

### Q7. What is software prefetching and when should you use it?

`__builtin_prefetch(addr)` (compiling to `prefetcht0`/`prefetchnta`) tells the CPU to start pulling a line into cache *before* you demand it, so the ~200-cycle miss overlaps with useful work. You use it when the hardware prefetcher *can't* predict your access but *you* can — e.g. chasing pointers where you can compute the next node a few hops ahead, or a hash probe where you can prefetch the bucket while finishing the previous key. The pattern: prefetch element `i + K` while processing element `i`, tuning `K` so the fetch completes just in time (typically enough work to cover ~100 ns). Caveats: it's a hint, not a guarantee; too-early prefetch gets evicted, too-late doesn't help; and it competes for load-buffer/bandwidth. Reach for it only after a profiler shows demand-miss stalls the hardware prefetcher isn't covering — for sequential access the HW prefetcher already wins and manual prefetch just adds noise.

### Q8. What does "keep the working set in cache" mean in practice?

The **working set** is the memory a phase actively touches. If it fits in a cache level, accesses hit at that level's latency; if it spills, you fall to the next level's cost. Concrete numbers (rough, per core): L1 ~32 KB @ ~4 cyc, L2 ~256KB–1MB @ ~12 cyc, L3 ~a few–tens of MB (shared) @ ~40 cyc, DRAM @ ~200+ cyc. So a matrix multiply that streams whole rows blows L1; **blocking/tiling** it so each tile fits in L1/L2 turns repeated DRAM traffic into cache hits — often several-x faster with identical FLOPs. Same idea drives *keeping data structures small* (shrink the struct, use 32-bit indices instead of 64-bit pointers), *processing in cache-sized batches*, and *arena/pool allocation* so related objects sit close and stay resident. You're managing the working set to keep it under a cache capacity threshold — the single highest-leverage layout decision after "stop pointer chasing."

### Q9. Why is memory bandwidth, not CPU speed, often the real limit?

Because many loops have low **arithmetic intensity** — few FLOPs per byte moved. A DRAM channel delivers maybe ~20–50 GB/s; a big many-core socket maybe a few hundred GB/s aggregate. If your kernel does one add per 4-byte load (0.25 FLOP/byte), you saturate the bus long before the ALUs break a sweat — you're **memory-bound**, and no amount of clever arithmetic helps; only *moving fewer bytes* does (SoA, smaller types, blocking, compression). The **roofline model** captures this: plot performance vs arithmetic intensity and there's a slanted bandwidth ceiling before the flat compute ceiling; low-intensity code lives under the slope. This is exactly why the AoS→SoA and shrink-the-struct wins are so large — they cut bytes moved, and bytes moved is the currency you're actually spending. If a profiler shows you at 5% of peak FLOPs but near peak DRAM bandwidth, stop optimising math and start optimising layout.

### Q10. How do you actually find these problems — what do you measure?

Never guess; profile. Use hardware performance counters (`perf stat`/`perf record` on Linux, VTune, `Instruments` on Apple): watch **cache-miss rate** (LLC-load-misses), **misprediction rate** (branch-misses), **IPC** (instructions per cycle — low IPC with high miss rate = memory-bound stall), and coherence events (**HITM** flags false sharing). `perf c2c` is purpose-built to catch false sharing. The workflow: measure to find the hot loop, look at *why* it stalls (miss? mispredict? bandwidth?), then apply the matching fix — SoA/blocking for misses, sort/branch-free for mispredicts, padding for false sharing, smaller types for bandwidth. Then measure again. The discipline is what makes it engineering rather than folklore: layout changes can be 5–10x, so they're worth real measurement, but only on code the profiler says is hot.

### Q11. The interview one-liner: what is mechanical sympathy in one paragraph?

Mechanical sympathy is designing your data layout and control flow around how the CPU actually executes — because on modern hardware compute is nearly free and *moving data* is the bottleneck, so the winning moves are structural: lay data out contiguously and in access order (SoA over AoS, arrays over linked lists) so each 64-byte cache line is fully used and the hardware prefetcher can stream ahead instead of stalling on dependent pointer chases; shrink and reorder structs to fit more per line and keep the working set inside cache; pad hot per-thread data to its own line to avoid false-sharing coherence traffic; and make branches predictable (sort the data) or branch-free so the pipeline doesn't flush — all validated with hardware counters, because the real ceiling is usually DRAM bandwidth, not GHz.


## Scenario & Interview Playbooks

### Summary

**What this topic covers**
This is the closing synthesis topic: it stitches every earlier idea — caches, the memory hierarchy, pipelining, branch prediction, out-of-order execution, coherence, SIMD, NUMA, virtual memory — into a repeatable way to *reason about a performance question on the spot*. Interviews rarely ask "define MESI." They ask "this loop is 10x slower than I expected — why?" or "estimate the throughput of summing a 1GB array" or "we added threads and it got slower." The skill being tested is diagnosis: turning a vague symptom into a hypothesis about where in the machine the time is going, then confirming it with a back-of-the-envelope number. This topic gives you the framework and a set of worked drills so you can walk the hardware from symptom to root cause out loud.

**Mental model**
Almost every performance answer follows one arc: **is the code compute-bound or memory-bound, and where is the machine stalling?** Modern cores execute several instructions per cycle at ~3 GHz, so raw arithmetic is nearly free — a fused-multiply-add costs a few cycles and the core issues 4–6 of them per cycle. What is *not* free is feeding the core: a main-memory access is ~100 ns (~200–300 cycles), during which a naive design does nothing. So the default senior instinct is "assume it's memory, prove otherwise." You reason in a fixed order: (1) **arithmetic intensity** — flops per byte touched — tells you which wall you're near; (2) **access pattern** — sequential vs strided vs pointer-chasing — tells you whether the prefetcher and caches can hide latency; (3) **the stall sources** — cache misses, branch mispredicts, TLB/page-walk, coherence traffic, dependency chains; (4) **a number** — multiply the count of expensive events by their known latency and compare to the observed time. If the arithmetic matches, you've found it. The whole game is knowing the latency table cold and applying it.

**Key terms**
- **compute-bound** — limited by ALU/FPU throughput; the core is busy, caches keep up. Fix with better ISA use (SIMD, FMA), fewer ops.
- **memory-bound** — limited by how fast bytes arrive from cache/DRAM; the core stalls waiting. Fix with locality, blocking, prefetch.
- **arithmetic intensity** — flops per byte of memory traffic; the x-axis of the roofline model. Low intensity → memory-bound.
- **roofline model** — a plot of attainable GFLOP/s vs arithmetic intensity, capped by peak compute and by bandwidth × intensity.
- **back-of-the-envelope** — estimating runtime by counting expensive events × their latency, ignoring the cheap stuff.
- **latency vs bandwidth** — one access is ~100 ns (latency); a stream of them hits ~tens of GB/s (bandwidth). Different bottlenecks, different fixes.
- **stall** — cycles where the pipeline retires nothing, waiting on memory, a mispredict, or a dependency.
- **hot path** — the small fraction of code where most time is spent; the only place optimization pays (Amdahl).
- **false sharing** — two cores writing different variables that share one 64-byte line, bouncing it via coherence.
- **pointer chasing** — dependent loads (`node = node->next`) that serialize on latency because each address depends on the previous load.

**Why interviewers ask this**
This is the topic that separates someone who *memorized* architecture from someone who can *use* it. A junior lists facts ("caches are fast, DRAM is slow"). A senior hears "10x slower than expected," immediately asks about the access pattern, estimates the miss rate, multiplies by ~100 ns, and lands within 2x of reality — then proposes a fix (loop interchange, blocking, `alignas(64)`) with a reason. The signal is *structured diagnosis under uncertainty*: forming a hypothesis, attaching a number, and knowing which tool (perf counters, `perf stat`, cache miss rate) confirms it. It's also a proxy for whether you profile before optimizing.

**Common confusions**
- "It's slow so I need a faster algorithm" → often it's the *same* algorithm with a cache-hostile layout; fixing locality beats a better big-O here.
- "More threads = more speed" → only until you saturate memory bandwidth or hit coherence/lock contention; then it goes *negative*.
- "The CPU is at 100%, so it's compute-bound" → 100% util includes cycles stalled on memory; check IPC and miss counters, not just util.
- "Cache misses are rare" → a column-major traversal of a big matrix can miss on *every* access.

**What follows from this topic**
Nothing — this is the capstone. It pulls forward the caches and memory-hierarchy topics (miss cost, cache lines, prefetch), pipelining and branch prediction (mispredict cost), out-of-order (latency hiding limits), coherence and NUMA (scaling walls), SIMD (compute-bound wins), and virtual memory (TLB/page-fault cost). Treat the latency table below as the shared vocabulary of every answer.

### Q1. Compute-bound vs memory-bound — how do you actually tell?

Compute *arithmetic intensity*: **flops per byte of memory traffic**. Then compare against the machine's ratio of peak compute to peak bandwidth (the roofline "ridge point"). A modern server core does roughly tens of GFLOP/s and shares ~20–50 GB/s of DRAM bandwidth per socket (Apple/​server parts with wide or HBM memory hit hundreds of GB/s). The ridge is around 5–20 flops/byte on typical hardware.

- **SAXPY / vector add** (`y[i] = a*x[i] + y[i]`): 2 flops, ~24 bytes touched → ~0.08 flops/byte. Deeply **memory-bound**. Adding SIMD or more cores barely helps once bandwidth saturates.
- **Dense matrix multiply** (with blocking): reuses each loaded tile O(N) times → intensity grows with block size → **compute-bound**. This is why GEMM hits near-peak FLOPs and SIMD/FMA matter.

Practically: run `perf stat`. Low IPC (< 1) with high `cache-misses` and high `stalled-cycles-backend` → memory-bound. High IPC (2–4) with the FPU ports saturated → compute-bound. "CPU at 100%" doesn't distinguish them — a core stalled on DRAM still shows 100% utilization; you need IPC and miss counters.

### Q2. Back-of-the-envelope: throughput of summing a 1 GB array of `int32`.

This is a pure streaming reduction — one add per element, sequential access, perfectly prefetchable. So it is **bandwidth-bound**, not compute-bound; the adds hide entirely under the loads.

- Data = 1 GB. Sustainable single-thread DRAM read bandwidth ≈ 10–20 GB/s (one core rarely saturates the whole socket's channels).
- Time ≈ 1 GB ÷ ~15 GB/s ≈ **~65–70 ms**, single-threaded.
- The hardware prefetcher spots the sequential stride and streams lines ahead of use, so you pay ~bandwidth, *not* ~100 ns per access. The ~250M elements are 16M cache lines (64 B each); at ~100 ns *unhidden* that would be 1.6 s — the 20–25x gap is exactly what prefetch + overlap buy you.
- To go faster: multiple threads to use more memory channels (scales until bandwidth saturates, maybe 2–4x), and SIMD to widen each add — though SIMD barely matters here since you're memory-bound. Sanity check: if someone claims 5 ms, that implies ~200 GB/s — only plausible on HBM/Apple-class memory.

### Q3. This loop is 10x slower than expected — walk the architecture.

Canonical case: summing a large 2D matrix, but traversing **column-major** in a row-major (C/C++) array.

```
for (j = 0; j < N; j++)
    for (i = 0; i < N; i++)
        sum += a[i][j];   // stride-N access, jumps a whole row each step
```

Walk it: each `a[i][j]` for consecutive `i` is `N` elements apart in memory. If a row is bigger than a cache line (it is, for any real N), **every access touches a new 64-byte line** and, once N is large, a new page. So:

- **Cache**: ~0% spatial locality — a miss on nearly every load instead of 1 miss per 16 `int32`s. That alone is the ~10x.
- **Prefetcher**: a large fixed stride can defeat or under-serve the prefetcher, so latency isn't hidden.
- **TLB**: striding by a page each step thrashes the TLB and triggers repeated page-walks.

Fix: swap the loops (**loop interchange**) to row-major `a[i][j]` with `j` inner. Now 16 consecutive `int32`s share a line, the prefetcher locks on, and you're back to bandwidth-bound. Confirmed with `perf stat -e cache-misses,dTLB-load-misses` before/after. The lesson: same big-O, same instruction count — 10x from *layout*.

### Q4. A multithreaded counter doesn't scale past 1–2 threads — diagnose.

Two distinct failure modes; distinguish them.

**Case A — one shared atomic counter.** Every `fetch_add` needs the cache line in Modified state, so it ping-pongs between cores over the coherence fabric. Each transfer costs the inter-core / cross-socket latency (tens to ~100+ ns), and it's *serialized* — throughput collapses, often *below* single-thread. This is coherence contention, not a bug. Fix: per-thread local counters summed at the end (sharding), or reduce update frequency.

**Case B — false sharing.** Threads increment *separate* counters, but they sit in the same 64-byte line (e.g. `struct { long a, b, c, d; }` or adjacent array slots). The line still bounces even though there's no logical sharing. Diagnose by inspecting the layout; fix with `alignas(64)` padding so each counter owns its line. Signature in `perf`: high `HITM` (hit-modified) events. Confirm which case you're in by whether padding fixes it — false sharing vanishes with padding; true contention on one counter does not.

### Q5. Why did adding threads make it *slower*?

Run down the scaling walls in order:

1. **Amdahl's law** — if 10% of work is serial, max speedup is 10x no matter the thread count; and the parallel part has overhead. But *slower* means active anti-scaling, so:
2. **Memory bandwidth saturation** — for a memory-bound kernel (Q2), 2 threads may saturate the channels; more threads just contend, adding scheduling and coherence overhead for zero bandwidth gain.
3. **Coherence / false sharing** — shared or falsely-shared lines (Q4) turn added threads into added cache-line ping-pong.
4. **NUMA** — threads on socket 1 hammering memory physically attached to socket 0 pay the remote-access penalty (~1.5–2x latency, lower bandwidth) across the interconnect. Fix: pin threads and allocate memory first-touch on the local node.
5. **Lock contention / oversubscription** — more threads than cores causes context-switch churn (the software side lives in the OS primer).

The senior move is to *name which wall* with a number, not just list them: "it's memory-bound at ~30 GB/s, two threads already hit that, so thread 3+ only adds coherence traffic."

### Q6. Estimate the cost of a branch mispredict, a cache miss, and a page fault — with the latency table.

Keep this table in your head; every estimate is built from it (order-of-magnitude, ~3 GHz core so 1 cycle ≈ 0.3 ns):

| Event | Latency | ~Cycles |
|---|---|---|
| 1 instruction (retired) | ~0.3 ns | ~1 (issue 4–6/cyc) |
| L1 cache hit | ~1 ns | ~4 |
| L2 cache hit | ~4 ns | ~12 |
| L3 cache hit | ~12–20 ns | ~40 |
| Branch mispredict | ~5 ns | ~15–20 |
| Main memory (DRAM) | ~100 ns | ~200–300 |
| Same-socket cache-to-cache (HITM) | ~40–100 ns | ~150+ |
| TLB miss + page walk | ~10–100+ ns | tens–hundreds |
| Minor page fault (soft) | ~1–5 µs | thousands |
| SSD random read | ~16 µs | — |
| Major page fault (from SSD) | ~50–150 µs | — |
| Disk seek (HDD) | ~10 ms | — |

- **Branch mispredict**: the front-end fetched down the wrong path; the pipeline flushes ~15–20 in-flight stages → ~5 ns wasted. In a tight, unpredictable branch (50/50), that dominates. Fix: make it predictable, or branchless (`cmov`, masks).
- **Cache miss to DRAM**: ~100 ns ≈ ~300 cycles ≈ ~300 instructions of lost work *if* out-of-order can't find independent work to hide it. Pointer chasing can't → full stall.
- **Page fault**: a minor fault (page already in RAM, just mapping) is microseconds; a **major** fault (read from SSD) is ~100 µs — a *million* times a mispredict. One major fault in a hot loop destroys the budget.

### Q7. Estimate: traverse a linked list of 1M nodes scattered in memory — how long, and why can't the CPU hide it?

Each step is `node = node->next`: a **dependent load**. The address of the next load isn't known until the current load *returns*. So out-of-order execution — which hides latency by finding independent work — has nothing to overlap; the loads **serialize on latency**.

- If nodes are scattered (heap-allocated over time), each `next` likely misses to DRAM: ~100 ns per hop.
- 1M hops × ~100 ns ≈ **~100 ms**. Brutal, and it barely improves with a faster CPU because it's pure memory latency, not compute or bandwidth.
- Contrast with a 1M-element **array** sum: sequential, prefetchable, ~16K lines, streamed at bandwidth → **~1 ms** or less. Same element count, ~100x faster.

This is the canonical "data structures have a hardware cost" answer: linked lists are latency-bound pointer chases; arrays/vectors are bandwidth-friendly and prefetchable. It's *the* argument for `std::vector` over `std::list`, for flat/SoA layouts, and for arena allocation to keep nodes contiguous.

### Q8. How would you make this hot function faster from an architecture standpoint?

A checklist, applied in order of payoff (and *after* profiling to confirm it's actually hot — Amdahl):

1. **Confirm the bound** — memory or compute? (Q1). Don't SIMD a memory-bound loop or reblock a compute-bound one.
2. **Fix the access pattern** — sequential over strided; loop interchange; **cache blocking/tiling** so working sets fit in L1/L2 and get reused (raises arithmetic intensity).
3. **Improve layout** — struct-of-arrays over array-of-structs so a line carries only fields you use; `alignas(64)` to kill false sharing; pack hot fields together.
4. **Reduce misses** — prefetch (compiler/`__builtin_prefetch`) for predictable-but-non-trivial strides; shrink data types if precision allows.
5. **Help the front-end** — make branches predictable or branchless; unroll to expose ILP for the OoO engine.
6. **Use the ISA** — SIMD/FMA for compute-bound inner loops (auto-vectorize or intrinsics).
7. **Parallelize last** — only once single-thread is tight and there's bandwidth headroom; mind NUMA and false sharing.

State the *why* for each ("this is memory-bound with stride-N access, so blocking is the win, not SIMD") — that's the senior signal.

### Q9. The interview one-liner: how do you structure an architecture-performance answer?

Answer in four beats, out loud, every time: **(1) classify** — is it compute-bound or memory-bound, and what's the access pattern (sequential / strided / pointer-chasing)? **(2) locate the stall** — cache miss, branch mispredict, TLB/page-walk, coherence/false sharing, dependency chain, or bandwidth saturation? **(3) estimate** — count the expensive events and multiply by the latency table (L1 ~1 ns, DRAM ~100 ns, mispredict ~5 ns, major page fault ~100 µs) to predict the runtime and check it against what's observed; **(4) fix with a reason** — locality/blocking, layout/alignment, branchless, SIMD, or parallelism, chosen to match the bottleneck you named. In one sentence: *assume memory until proven otherwise, attach a number from the latency table, and let that number pick the fix.*


