import type { Diagram } from "./types";

export const UNIQUE_ID_GENERATOR: Diagram = {
  id: "unique-id-generator",
  title: "Unique ID Generator",
  question: "Design a Unique ID Generator (Snowflake)",
  sourceId: "patterns",
  itemId: 4,
  overview: {
    shape:
      "There is no request path to draw. The system is a library inside your own process that packs three numbers into one 64-bit integer, guarded against the clock lying.",
    forces: [
      {
        constraint: "1024 worker slots exist, but a live process must never share one with another",
        decision: "Worker-id holder claims an exclusive lease once, at boot, from the lease store or a stable orchestrator ordinal, never per ID",
        lights: ["lease-store", "orchestrator", "worker-id-holder", "e-lease", "e-ordinal"],
      },
      {
        constraint: "Issuance must run at up to 4.096M IDs/s per node with no network hop on the path",
        decision: "The whole issue path is process-local: two shifts and an OR, 20 to 50 nanoseconds, zero network calls",
        lights: ["caller", "generator", "guard", "sequence", "pack"],
      },
      {
        constraint: "A rewind larger than the 4096-wide sequence would let the generator reissue an already-used id, with nothing downstream able to tell",
        decision: "The Clock read + rewind guard halts and pages on any backwards jump, rather than clamping and letting the sequence absorb it",
        lights: ["guard", "clock", "e-clock"],
      },
      {
        constraint: "last_ts lives only in process memory, and a 200ms crash-restart after a rewind loses it entirely",
        decision: "The Restart watermark fsyncs a reserved future timestamp every 10s, so a fast restart still knows what it must not issue below",
        lights: ["watermark", "e-watermark"],
      },
      {
        constraint: "All 64 bits, including the 12 low sequence bits, decode back to timestamp, worker and sequence with no lookup",
        decision: "The Public API boundary swaps the raw Snowflake for an opaque external identifier before it crosses a trust boundary",
        lights: ["boundary", "e-opaque"],
      },
    ],
    naive: {
      text: "Stand up a central ID service, one process owning a single counter, and have every caller make a network call to it for each new key. This makes uniqueness trivial: there is exactly one writer. It breaks on the write path's own numbers. Issuance in-process is 20 to 50 nanoseconds; a network round trip to a shared service is hundreds of microseconds, four orders of magnitude slower. It also makes that one service's availability and p99 the floor for every insert in the entire system. At ~4M IDs/s aggregate across a thousand-node fleet, the central service becomes a single point of contention no amount of read replicas fixes, because every request is a write. The Snowflake generator replaces the network call with 10 bits of pre-claimed identity. 1024 worker slots are handed out once, at boot, and after that every process manufactures its own IDs locally with zero coordination.",
      lights: ["generator", "lease-store", "caller"],
    },
    beats: [
      {
        text: "Boot is where the only coordination happens. A process either claims an exclusive lease on one of 1024 worker slots from a strongly consistent store, or it takes a stable ordinal the orchestrator already assigns. Either way it is one claim per process lifetime, and a process that cannot get a slot refuses to start rather than guessing.",
        lights: ["lease-store", "orchestrator", "worker-id-holder", "e-lease", "e-ordinal"],
      },
      {
        text: "After that the issue path is entirely local. next_id() reads the wall clock, compares it against the last timestamp used, bumps a per-millisecond counter, and ORs three fields together. Two shifts and an OR against process-local state, 20 to 50 nanoseconds, no socket, no lock, nothing that can be throttled or down.",
        lights: ["caller", "generator", "guard", "sequence", "pack", "e-call", "e-clock", "e-guard-seq", "e-seq-pack"],
      },
      {
        text: "The clock guard is the whole design in one comparison. If the clock reads earlier than the last timestamp issued, the generator stops and pages someone. Clamping to last_ts and letting the sequence absorb the difference looks like the graceful option and is exactly how duplicates get minted.",
        lights: ["guard", "clock", "e-clock"],
      },
      {
        text: "The sequence handles bursts and nothing else. It counts 0 to 4095 within a single millisecond on a single worker and resets when the millisecond advances. On overflow the generator spins until the clock ticks over, which converts the ceiling into a microsecond stall rather than a correctness bug.",
        lights: ["sequence"],
      },
      {
        text: "The layout is the contract. 41 bits of milliseconds since a custom epoch, 10 bits of worker, 12 bits of sequence, sign bit unused. The timestamp sits in the high bits so sorting the integers sorts by creation time, which keeps B-tree inserts at the right edge of the index.",
        lights: ["pack", "sinks", "e-sinks"],
      },
      {
        text: "Downstream is where a failure actually becomes visible. You cannot detect a duplicate by inspecting IDs, so the unique constraint on the ID column wherever it is a primary key is the real detector. The operational alarms on worker-id duplication and rewind counts are what fire before it.",
        lights: ["sinks", "metrics", "e-dupes", "e-telemetry"],
      },
    ],
    crux: {
      problem:
        "Uniqueness here is a guarantee by construction rather than something checked at runtime. It is only as strong as two premises: no other live process holds your worker id, and the wall clock moves forward.",
      handled:
        "Neither premise can be verified at the moment you issue an id. The Worker-id holder's lease is checked only at boot, never re-validated. The Clock read + rewind guard can only detect a rewind after it has already happened, never predict one. Downstream, the unique constraint on the ID column is the only place either failure is ever actually caught. The operational alarms on worker-id duplication and rewind counts exist to fire before it does.",
    },
    numbers: [
      { value: "41 / 10 / 12 bits in 64", explain: "The layout of every field: timestamp, worker id, sequence, leaving the sign bit unused. This split is what fixes every capacity number below it." },
      { value: "4096 IDs per ms per worker = 4.096M/s", explain: "The per-node ceiling, derived directly from the 12-bit sequence field: 2^12 values per millisecond." },
      { value: "1024 worker slots", explain: "The total concurrently-live process capacity, derived from the 10-bit worker field: 2^10 slots." },
      { value: "~69.7 years of epoch runway", explain: "How long the 41-bit timestamp field lasts before wrapping, starting from a custom epoch set at launch rather than 1970." },
    ],
  },
  nodes: [
    // --- column A: the things the generator depends on and does not own ---
    {
      id: "ntp",
      label: "NTP / PTP time source",
      sub: "chrony, leap smearing",
      kind: "external",
      col: 0,
      row: 0,
      detail: {
        what: "The daemon disciplining the host clock in the background, and the fleet-wide policy about how it corrects.",
        why: "It is not scenery: it is the component that actually moves the clock backwards. An NTP client steps rather than slews when the offset is large, so the correction itself is the rewind event the generator has to survive.",
        numbers: [
          { value: "chrony makestep 1.0 3 steps on almost every fresh container", explain: "The default correction policy that produces a sudden backward step rather than a gradual slew, exactly the event the guard exists to catch." },
          { value: "untended crystal drift 10 to 50 ppm, 1 to 4 seconds a day", explain: "How far an undisciplined clock wanders without correction, the baseline error this daemon is fighting." },
          { value: "alert on offset above 100ms, sampled every 10s", explain: "The monitoring threshold that gives early warning of a clock drifting far enough to need a large, risky correction." },
        ],
        breaks: {
          failure: "With no time source the clock drifts at the crystal's rate, and the correction on recovery is a step in whichever direction the drift went.",
          handled: "That correction is exactly the event the generator halts on, so a missing or misconfigured time source turns an ordinary restart into a guaranteed rewind incident.",
        },
        choice: {
          pick: "A leap-smearing time source fleet-wide, PTP where the hardware supports it",
          instead: "Handle the discontinuity inside the generator.",
          decider:
            "A positive leap second re-runs one whole UTC second, and the sequence is 4096 values wide within a single millisecond. There is no arrangement of 12 bits that absorbs 1000ms of repeated timestamps, so the only place to fix it is the time source.",
          flips:
            "Nowhere for leap seconds specifically, which the CGPM resolved in 2022 to retire by 2035 and none of which has been inserted since 2016. The general case, an arbitrary backwards step, still has to be handled in the generator.",
        },
      },
    },
    {
      id: "clock",
      label: "Host clock",
      sub: "CLOCK_REALTIME, steppable",
      kind: "external",
      col: 0,
      row: 1,
      detail: {
        what: "The wall clock the generator reads on every call, and the only external fact the issue path depends on.",
        why: "The timestamp field is not decoration: it is where uniqueness within a worker comes from and where sortability comes from. That puts a hardware oscillator inside the correctness argument, which is the trade this whole design made.",
        numbers: [
          { value: "read once per next_id()", explain: "The clock is consulted exactly once per call, never cached across calls or amortised over a batch." },
          { value: "a live-migration pause of 1 to several seconds resumes with a stale clock", explain: "A common real-world event that produces exactly the kind of backward jump the guard is built to catch." },
          { value: "a host with a dead RTC battery starts in 1970", explain: "An extreme failure mode: a hardware clock with no backup power boots with a wildly wrong time until NTP corrects it." },
        ],
        breaks: {
          failure: "It steps backwards. NTP correction on container start, VM live migration, snapshot restore and an unsmeared positive leap second all rewind it.",
          handled: "Nothing in the ID itself records that a rewind happened, which is exactly why the guard exists as a separate, explicit check rather than trusting the clock silently.",
        },
        choice: {
          pick: "Read CLOCK_REALTIME directly and halt on a detected rewind",
          instead:
            "Derive every timestamp as base_realtime + (monotonic_now - base_monotonic), captured once at startup.",
          decider:
            "Whether anyone downstream treats the decoded timestamp as accurate event time. A monotonic base cannot rewind at all, but the field then drifts from true UTC at the crystal's rate, 1 to 4 seconds a day.",
          flips:
            "When nothing consumes the decoded timestamp as event time and halting is unacceptable. Then derive from monotonic and correct forward only, never backward.",
        },
      },
    },
    {
      id: "orchestrator",
      label: "Orchestrator ordinal",
      sub: "StatefulSet / ECS task index",
      kind: "external",
      col: 0,
      row: 2,
      detail: {
        what: "The scheduler that already assigns stable unique ordinals to instances, used directly as the worker id instead of claiming a lease.",
        why: "Where it exists it is stronger than anything you would build: the scheduler enforces exclusivity and keeps enforcing it during a network partition, which an expiring lease does not. It also deletes a boot-time dependency on a service that tends to be unhealthy exactly when you are trying to scale up.",
        numbers: [
          { value: "ordinals 0 through fleet size minus 1, stable across restarts", explain: "The range and stability guarantee this scheme relies on: the same instance always gets the same ordinal." },
          { value: "the 1024 slot ceiling still applies", explain: "This path shares the same worker-id bit budget as the lease-based path; the ordinal must still fit under 1024." },
        ],
        breaks: {
          failure: "An autoscaling group of interchangeable instances gives neither a stable ordinal nor a cap below the slot count.",
          handled: "Nothing detects the drift until two hosts are issuing under the same id, which is why this path is only safe on schedulers that genuinely guarantee both properties.",
        },
        choice: {
          pick: "The scheduler's ordinal, where the platform provides one",
          instead: "An expiring lease from a coordination service.",
          decider:
            "Whether the orchestrator guarantees a stable unique ordinal and caps the fleet below 1024. A StatefulSet gives both, an autoscaling group of interchangeable pods gives neither.",
          flips:
            "Fleets whose scheduler makes no such promise, which is what the coordination service exists for. Do not introduce ZooKeeper solely to hand out worker ids.",
        },
      },
    },
    {
      id: "lease-store",
      label: "Worker-id lease store",
      sub: "etcd / ZooKeeper, create-if-absent",
      kind: "database",
      col: 0,
      row: 3,
      detail: {
        what: "A small strongly consistent store holding /snowflake/leases/{0..1023}, each entry naming its holder, process start time and expiry.",
        why: "This is the only coordination in the design and it happens once per process lifetime rather than once per ID. It has to be an exclusive claim rather than a registration, because the entire uniqueness argument rests on no two live processes holding the same slot.",
        numbers: [
          { value: "1024 slots x ~50B ≈ 51KB of state", explain: "The entire store's footprint is trivially small, regardless of fleet size." },
          { value: "~1KB/s/node heartbeats, ~1MB/s across 1000 nodes", explain: "The steady-state load this store absorbs to keep leases alive, small enough to be a non-issue at fleet scale." },
          { value: "30s TTL so a dead node's slot returns", explain: "The expiry window that reclaims an abandoned slot after a crash, bounding how long a slot can sit orphaned." },
          { value: "regional slices (0-340 / 341-680 / 681-1023) give cross-region uniqueness with no cross-region traffic", explain: "Partitioning the slot range by region avoids a cross-region round trip on every lease claim." },
        ],
        breaks: {
          failure: "Slot exhaustion during a rolling deploy. 700 instances plus an in-flight batch of 100 plus holders still inside their TTL is 800 to 900 of 1024.",
          handled: "Exhaustion surfaces as boot failures, by which point you already have an outage. Free-slot count is monitored as its own leading indicator rather than discovered at deploy time.",
        },
        choice: {
          pick: "An exclusive expiring lease claimed at boot, with the process refusing to start if it cannot get one",
          instead: "A worker id baked in by the provisioning system or a config file.",
          decider:
            "Fleet churn against the 1024 slots. Static assignment is safe only when the fleet cannot exceed the slot count and nothing reassigns hosts. Above roughly 100 instance replacements a day, hand-managed configuration drifts and two hosts eventually share an id.",
          flips:
            "A small fixed fleet well under 1024 that is never replaced automatically. There a config value is honest about what it is, and there is no service to be unavailable at boot.",
        },
      },
    },

    // --- column B: the caller and the one library it links in ---
    {
      id: "caller",
      label: "Application process",
      sub: "needs a primary key",
      kind: "service",
      col: 1,
      row: 0,
      detail: {
        what: "Your own service, calling into the generator in-process at the moment it needs a key for a row it is about to write.",
        why: "This is the whole client story and it is why the design exists in this shape. There is no ID service to call and no SDK talking to a remote endpoint, so the caller's availability and the generator's are the same number by construction.",
        numbers: [
          { value: "~4k IDs/s/node steady state", explain: "The typical issuance rate one node actually generates, far below its ceiling." },
          { value: "~1000 nodes ≈ 4M IDs/s aggregate", explain: "Fleet-wide issuance rate, the scale the whole design has to sustain in aggregate." },
          { value: "issuance p99 target 1µs", explain: "The latency budget one call to next_id() must stay inside." },
        ],
        breaks: {
          failure: "There is no ID service to page. When the generator halts on a rewind, this process is the outage.",
          handled: "Behind a load balancer it is a partial outage until the clock recovers, since other nodes keep issuing while the affected one halts, rather than the whole fleet stopping together.",
        },
        choice: {
          pick: "Call the generator library synchronously, in-process, on the write path",
          instead: "Pre-fetch a batch of IDs from a pool and hand them out from memory as writes happen.",
          decider:
            "Whether there is anything worth batching. Issuance is 20 to 50 nanoseconds against a steady ~4k IDs/s/node, three to four orders of magnitude below the 4.096M/s ceiling. A pool buys nothing at this rate and only adds a refill path that can itself run dry.",
          flips:
            "A caller issuing IDs in a tight loop at rates approaching the per-node ceiling. There batching a pool amortises the sequence-overflow spin across many calls instead of paying it per burst.",
        },
      },
    },
    {
      id: "generator",
      label: "Snowflake generator",
      kind: "serviceGroup",
      col: 1,
      row: 1,
      detail: {
        what: "A roughly 20-line library linked into the application process: hold the worker id claimed at boot, read the clock, guard it, bump the sequence, OR the three fields together.",
        why: "Coordination was moved to boot so nothing on the issue path can be slow, throttled or down. A per-request call to a central allocator would put that service's p99 on every insert and make it the availability floor for every write in the system. These stages are drawn inside one frame because they are one deployable: they start, halt and die together with the process that links them.",
        numbers: [
          { value: "two shifts and an OR against process-local state", explain: "The entire arithmetic cost of one issuance, no branching beyond the guard comparison." },
          { value: "20 to 50 nanoseconds per call", explain: "The measured latency of one next_id() call end to end." },
          { value: "zero network calls after boot", explain: "Nothing on the hot path touches the network once the worker id has been claimed." },
        ],
        breaks: {
          failure: "Everything it knows is process-local. last_ts and the sequence die with the process.",
          handled: "A crash and a 200ms restart leaves it with no record of what it already issued, which is precisely the hole the restart watermark is built to cover.",
        },
        choice: {
          pick: "An embedded library holding one worker id per process",
          instead: "A central ID service, or a ticket server leasing blocks of a single counter.",
          decider:
            "Whether you can afford a network hop and another service's availability on every insert. Local issuance is tens of nanoseconds against a ceiling of 4.096M IDs/s/node. An RPC is hundreds of microseconds and adds a dependency that has to be up for every write in the system.",
          flips:
            "When an auditor needs dense, contiguous numbering with no gaps, which is a real requirement in finance and which no pre-partitioned scheme can satisfy. Then a ticket server leasing blocks is the only option.",
        },
      },
    },
    {
      id: "guard",
      label: "Clock read + rewind guard",
      sub: "if now < last_ts: halt",
      kind: "process",
      col: 1,
      row: 1,
      parent: "generator",
      detail: {
        what: "The first stage of next_id(): read the wall clock once, compare it against the last timestamp this process issued, and stop issuing if it moved backwards.",
        why: "A rewind that keeps generating reissues IDs already handed out, and nothing downstream notices until a foreign key points at the wrong row months later. The check has to happen before anything is packed, because once an ID has been returned it is already inside somebody's write.",
        numbers: [
          { value: "one comparison, no measurable cost on the hot path", explain: "The rewind check adds no meaningful overhead to an already-nanosecond operation." },
          { value: "a 5s live-migration step means 5s of silence on that node", explain: "How long one node halts issuance after a typical VM-migration-induced backward step." },
          { value: "page on the first non-zero rewind count", explain: "The alerting threshold: even a single detected rewind is treated as an incident worth paging on." },
        ],
        breaks: {
          failure: "last_ts is process-local memory, so this comparison is completely blind across a restart.",
          handled: "That hole is what the watermark exists to cover. Halting itself is a genuine availability hole: a fleet-wide time event halts the fleet, an accepted cost of refusing to risk a duplicate.",
        },
        choice: {
          pick: "Halt issuance and alert on any detected rewind, rejoining once now > last_ts",
          instead:
            "Clamp the timestamp to last_ts and let the sequence absorb the difference, or spend a sequence bit as a rewind generation counter.",
          decider:
            "The size of the rewind against a 4096-wide sequence. Clamping looks graceful and is exactly how duplicates get minted, because a multi-second rewind exhausts 4096 and wraps into values already issued.",
          flips:
            "Rewinds of a few milliseconds, where sleeping until the clock passes last_ts turns it into a latency blip. A generation counter keeps you issuing, at the cost of halving the ceiling to 2048.",
        },
      },
    },
    {
      id: "sequence",
      label: "Sequence counter",
      sub: "seq = (seq + 1) & 0xFFF",
      kind: "process",
      col: 1,
      row: 2,
      parent: "generator",
      detail: {
        what: "A per-millisecond counter, reset to 0 when the millisecond advances and masked to 12 bits when it has not.",
        why: "It is what lets one worker issue more than one ID inside the same millisecond without touching anything shared. Burst capacity comes from here; uniqueness across workers does not, which is why it can be the narrowest field. Splitting it from the guard keeps the failure taxonomy honest: above that line is a correctness problem that halts the node, below it is a resource problem that costs microseconds.",
        numbers: [
          { value: "4096 IDs per millisecond per worker", explain: "The burst capacity this field provides, derived directly from its 12-bit width." },
          { value: "4.096M IDs/s/node ceiling", explain: "The same limit expressed per second: 4096 values every millisecond." },
          { value: "steady state ~4k IDs/s/node, three orders of magnitude below it", explain: "How far typical load sits from the theoretical ceiling, showing the margin is generous." },
        ],
        breaks: {
          failure: "Overflow inside one millisecond. Without the spin you reissue values already used in that millisecond.",
          handled: "With the spin you get a microsecond stall that shows up as latency micro-spikes, a correctness-preserving trade the design accepts deliberately.",
        },
        choice: {
          pick: "Spin until the wall clock ticks over when the sequence saturates",
          instead: "Return an error to the caller, or borrow bits from the worker field.",
          decider:
            "The stall is bounded by the remainder of one millisecond and only fires above 4096 IDs/ms, roughly 1000x steady state. An error at that point pushes a retry loop into every caller for a condition they cannot do anything about.",
          flips:
            "Sustained saturation, say above 100 overflowing milliseconds a second, which means the per-node ceiling is genuinely binding and the bit split rather than the spin is the thing to change.",
        },
      },
    },
    {
      id: "pack",
      label: "Pack 41 | 10 | 12",
      sub: "(ts<<22) | (worker<<12) | seq",
      kind: "process",
      col: 1,
      row: 3,
      parent: "generator",
      detail: {
        what: "The last stage: three disjoint fields shifted and ORed into one 64-bit integer with the sign bit left at zero.",
        why: "The layout is the contract, and this shift is where it is written down. The timestamp sits in the high bits so sorting the integers sorts by creation time. The worker sits in the middle because that is where uniqueness comes from, and the sequence sits at the bottom so a burst never disturbs the ordering above it. 22 is 10 plus 12, exactly the width of the two fields below, keeping the whole operation a bit-pack with no arithmetic to get wrong.",
        numbers: [
          { value: "1 sign + 41 ts + 10 worker + 12 seq = 64 bits = 8 bytes", explain: "The complete bit accounting for the format, using all 64 bits with the sign bit left unused." },
          { value: "2^41 ms ≈ 69.7 years, 2^10 = 1024 workers, 2^12 = 4096 per ms", explain: "The capacity each field's width provides, the three numbers the whole design is derived from." },
          { value: "decode is (id >> 22) + epoch_ms, pure arithmetic, no lookup", explain: "Recovering the original timestamp from an id costs one shift and one addition, no external state needed." },
        ],
        breaks: {
          failure: "The split is near-irreversible. IDs already minted decode under the old boundaries.",
          handled: "Changing the split means a flag day or spending a bit as an encoding marker. The bit widths are decided once against a long-term projection rather than tuned casually.",
        },
        choice: {
          pick: "41 timestamp / 10 worker / 12 sequence, sign bit unused",
          instead: "Shift bits toward the worker field, say 41 / 14 / 8.",
          decider:
            "Peak concurrently-held slots against peak per-worker rate. 10/12 gives 1024 workers at 4.096M IDs/s each; 41/14/8 gives 16,384 workers at 256 IDs/ms, or 256k IDs/s each. You have both numbers, so pick the split that clears them with margin.",
          flips:
            "Above roughly 1000 concurrently-held slots, which arrives earlier than instance count suggests because dead workers keep their slot until the lease expires. Decide once against a five-year fleet projection.",
        },
      },
    },
    {
      id: "worker-id-holder",
      label: "Worker-id holder",
      sub: "claim at boot, watch the lease",
      kind: "process",
      col: 1,
      row: 4,
      parent: "generator",
      detail: {
        what: "The boot-time stage: claim one slot exclusively, keep the heartbeat alive, hold the value for the process lifetime, and kill issuance if it ever observes the lease lost.",
        why: "It is drawn inside the generator rather than as a service because it is a thread in the same process. It is drawn separately from the pipeline because nothing about it is per request. The value is decided once, which is the entire reason the issue path has no network dependency.",
        numbers: [
          { value: "one claim per process lifetime, then 0 network calls per ID", explain: "The entire network footprint of this component, front-loaded to a single moment at process start." },
          { value: "30s lease TTL; release on SIGTERM returns the slot in milliseconds", explain: "The two different reclaim paths: a slow timeout for a crashed process, and a fast release for a graceful shutdown." },
          { value: "a random pick instead of a claim collides above ~38 nodes by the birthday bound", explain: "Why a claim-based scheme is necessary rather than optional: random assignment collides far too soon at any real fleet size." },
        ],
        breaks: {
          failure: "The lease is checked at boot and never again, so exclusivity is asserted rather than enforced.",
          handled: "A process that loses its lease to a long GC pause or a partition keeps stamping a slot somebody else now owns, a gap the background watcher only partially closes.",
        },
        choice: {
          pick: "A background watcher that kills issuance on observed lease loss",
          instead: "Trust the boot-time claim for the whole process lifetime.",
          decider:
            "The watcher is asynchronous and polls on a 5s to 10s interval, so it bounds the overlap window to roughly that long rather than closing it. Fencing properly means consulting something outside the process before every ID, which destroys the property the whole design exists for.",
          flips:
            "Orchestrator ordinals, where the scheduler enforces uniqueness rather than expiring a claim. There is no lease to lose, so there is nothing for the watcher to watch.",
        },
      },
    },

    // --- column C: what the generator writes to, and who reads it ---
    {
      id: "boundary",
      label: "Public API boundary",
      sub: "opaque id, never the raw ID",
      kind: "gateway",
      col: 2,
      row: 0,
      detail: {
        what: "Every place an ID would cross to a customer, a partner or a URL, and the point at which it must be swapped for something that decodes to nothing.",
        why: "Timestamp, worker and sequence are all recoverable from the integer. Two order IDs a day apart measure your daily volume, and consecutive ones enumerate your orders. There is no version of this where a compact, time-ordered, locally-generated ID is also unguessable, because the bits that make it sortable are the bits that make it readable.",
        numbers: [
          { value: "12 low bits make consecutive IDs from one worker trivially enumerable", explain: "How cheaply an attacker can walk an entire sequence of ids issued by one worker in one millisecond." },
          { value: "one extra indexed column on the hot tables", explain: "The storage cost of carrying a second, opaque identifier alongside the internal one." },
          { value: "at 10^10 rows that second column is real but bounded", explain: "The scale at which this extra column's cost becomes worth discussing, though still not prohibitive." },
        ],
        breaks: {
          failure: "Carrying two identifiers per row creates a recurring class of bug where the wrong one is logged, returned or joined on.",
          handled: "Nothing in either value announces which is which, so this discipline is enforced by convention and code review rather than by any property of the ids themselves.",
        },
        choice: {
          pick: "A separate opaque external identifier carried alongside the internal ID",
          instead: "Hash the Snowflake at the boundary, or just expose it.",
          decider:
            "Whether ordering has to survive the boundary, at the cost of the 1 extra indexed column measured above. Hashing destroys it, so cursor pagination over the external identifier stops working and you need a separate sort field or a signed cursor.",
          flips:
            "IDs that never leave your own systems, where the second column is pure cost. If the ID crosses a trust boundary at all, UUIDv7's 74 random bits win outright over any de-leaking scheme bolted onto a Snowflake.",
        },
      },
    },
    {
      id: "watermark",
      label: "Restart watermark",
      sub: "local disk, fsync now + 10s",
      kind: "database",
      col: 2,
      row: 1,
      detail: {
        what: "One small file per host holding the highest timestamp this process has promised never to issue below, fsynced 10 seconds ahead of the clock.",
        why: "last_ts dies with the process, so a generator that crashes and restarts in 200ms on a host whose clock stepped back has no memory of what it issued. Persisting per ID is not on the table: an fsync is tens to hundreds of microseconds against an issue rate of up to 4M/s.",
        numbers: [
          { value: "one fsync per 10s instead of 4 x 10^7", explain: "The write reduction this reserve-forward strategy achieves against fsyncing on every issued id." },
          { value: "up to 10s of restart latency inside the reserved window", explain: "The worst-case delay a restarting process may need to wait before it can safely resume issuing." },
        ],
        breaks: {
          failure: "It is per host and dies with the disk, and it does nothing for a rewind larger than the window, which still needs the halt.",
          handled: "A crash-looping process sleeping on it looks like a hang rather than a crash, so the sleep is logged loudly to distinguish the two cases.",
        },
        choice: {
          pick: "Reserve time forward: fsync now + 10s, refuse to issue below it, re-fsync only on crossing",
          instead: "fsync the last issued timestamp on every ID.",
          decider:
            "fsync cost against issue rate. Tens to hundreds of microseconds per fsync against up to 4.096M IDs/s is not a trade, it is impossible. Reserving forward costs one fsync per 10 seconds and pays for it entirely in restart latency.",
          flips:
            "Low, bounded issue rates where a durable last_ts per ID is affordable and you would rather pay microseconds per ID than up to 10 seconds on every restart.",
        },
      },
    },
    {
      id: "sinks",
      label: "Downstream sinks",
      sub: "BIGINT PK, unique constraint",
      kind: "database",
      col: 2,
      row: 3,
      detail: {
        what: "Every table, index and log line carrying the ID: as a primary key, as foreign keys elsewhere, and as a sort key.",
        why: "It is the only place a duplicate can actually be caught. You cannot detect one by inspecting IDs, so a unique constraint on the ID column wherever it is a primary key is the real detector. It costs nothing you were not already paying.",
        numbers: [
          { value: "8 bytes per key, stored once per index it appears in", explain: "The storage cost of one id, multiplied by however many indexes reference it." },
          { value: "8B x 4 indexes x 10^10 rows ≈ 320GB of extra index versus 128 bits", explain: "The concrete extra cost at large scale of choosing a 64-bit id over a 128-bit alternative." },
          { value: "~32MB/s of pure ID bytes at 4M IDs/s", explain: "The raw byte rate ids alone contribute at peak aggregate issuance." },
        ],
        breaks: {
          failure: "A duplicate landing anywhere without a unique constraint is silent corruption.",
          handled: "It surfaces months later as a foreign key pointing at the wrong row. Every table storing this id as a primary key is required to carry the constraint.",
        },
        choice: {
          pick: "A 64-bit Snowflake in existing BIGINT columns",
          instead:
            "UUIDv7: 128 bits of 48-bit millisecond prefix plus 74 random bits, standardised in RFC 9562 in 2024.",
          decider:
            "What 8 extra bytes per key cost at your row count. At 10^10 rows across four indexes that is roughly 320GB of extra index, plus the memory to keep the hot part resident. At 10^9 rows it is 32GB and not worth a conversation.",
          flips:
            "Greenfield systems under roughly 10^9 rows, or any ID that crosses a trust boundary, where 74 random bits are not enumerable and a Snowflake is.",
        },
      },
    },
    {
      id: "metrics",
      label: "Generator telemetry",
      sub: "worker-id gauge, rewind counter",
      kind: "database",
      col: 1,
      row: 5,
      detail: {
        what: "Per-node counters: the worker id each host reports, detected clock rewinds, free lease slots and sequence overflows.",
        why: "Every real failure here is invisible in the data until far too late, so the leading indicators have to be operational rather than data-level. Two hosts reporting the same worker id is an active correctness incident, and the first rewind predicts duplicates before they reach anything durable.",
        numbers: [
          { value: "workers_reporting_id above 1 pages immediately", explain: "The exact trigger for the most severe alarm this system has: two live processes claiming the same worker id." },
          { value: "free_lease_slots alert below 15% of 1024", explain: "The early-warning threshold for approaching slot exhaustion, well before a deploy actually fails to start." },
          { value: "gen_latency_p99 alert above 1µs", explain: "The latency regression threshold, since a healthy generator should never approach this." },
        ],
        breaks: {
          failure: "It is asynchronous. By the time a second host reports your worker id both have already been issuing.",
          handled: "This bounds the damage rather than preventing it. A process that halts on a rewind may also stop reporting, so the absence of a signal has to alarm as loudly as the signal.",
        },
        choice: {
          pick: "Alarm on worker-id duplication and on the first rewind event, backed by the unique constraint downstream",
          instead: "A sampled Bloom filter over emitted IDs, or a periodic distinct-count job.",
          decider:
            "Lag. A Bloom filter gives probabilistic live detection but trails the damage, and a distinct-count over billions of IDs is a batch tool. Both operational signals fire before a duplicate reaches a durable store, and they cost 2 counters rather than a pipeline.",
          flips:
            "Pre-production validation, where generating billions of IDs across N nodes into a distinct-count job is exactly the right test and there is no live incident to be late for.",
        },
      },
    },
  ],
  edges: [
    {
      id: "e-call",
      from: "caller",
      to: "guard",
      tier: "hot",
      step: 1,
      label: "next_id()",
      detail: {
        what: "An in-process function call at the moment the caller needs a key for a row it is about to write.",
        why: "This is the entire request path. There is no serialisation, no socket and no other service's tail latency sitting between a write and the ID it needs.",
        numbers: [
          { value: "20 to 50 nanoseconds", explain: "The full latency of this call, orders of magnitude below any network operation." },
          { value: "p99 issuance target 1µs", explain: "The latency target this call must stay comfortably inside." },
        ],
        breaks: {
          failure: "If this ever becomes an RPC, every insert in the system inherits that service's availability and its p99.",
          handled: "This is exactly the failure the whole design was built to avoid, which is why the call boundary here is enforced to stay in-process by design, not just by convention.",
        },
      },
    },
    {
      id: "e-ntp",
      from: "ntp",
      to: "clock",
      tier: "control",
      label: "steps the clock",
      detail: {
        what: "The background discipline of the host clock: a slew when the offset is small, a step when it is large.",
        why: "The step is the event that matters here, not the daemon running it. Everything the generator does about clocks is a response to what happens along this arrow.",
        numbers: [
          { value: "chrony makestep 1.0 3: steps if the offset exceeds 1s in the first 3 updates", explain: "The specific policy that produces a hard step rather than a gradual correction on a freshly started host." },
          { value: "a smeared leap second is spread over 24 hours instead", explain: "The alternative correction strategy that avoids a discontinuity entirely, when configured." },
        ],
        breaks: {
          failure: "The step can be backwards, and the generator finds out only by comparing against last_ts after the fact.",
          handled: "Nothing warns it in advance except a growing offset gauge, so the guard's after-the-fact detection is the actual defence rather than any predictive signal.",
        },
      },
    },
    {
      id: "e-clock",
      from: "clock",
      to: "guard",
      tier: "hot",
      step: 2,
      label: "now_ms(), per call",
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "Reading the wall clock on every call. It is the only external fact the issue path depends on.",
        why: "The timestamp is read rather than counted because the field has to mean something to consumers who decode it back to a creation time. That is what drags a hardware oscillator into the correctness argument. It reads CLOCK_REALTIME specifically, the one that can step backwards.",
        numbers: [
          { value: "1 syscall per next_id()", explain: "The exact system-call cost this read adds to every issuance." },
          { value: "read once per call", explain: "No caching or batching of clock reads across multiple calls." },
        ],
        breaks: {
          failure: "CLOCK_MONOTONIC cannot go backwards but has no epoch and resets on reboot, so it cannot be the field directly.",
          handled: "It can only be the source of advance from a realtime base captured at startup, an alternative design the choice below weighs directly.",
        },
      },
    },
    {
      id: "e-watermark",
      from: "guard",
      to: "watermark",
      tier: "control",
      label: "fsync now + 10s",
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "Persisting a timestamp the process promises not to issue below, written at startup and rewritten only when the clock crosses it.",
        why: "It closes the one hole the in-memory comparison cannot see: a crash and a fast restart after a rewind. Reserving time forward moves the durability cost from per ID to per 10 seconds, which is the difference between impossible and free.",
        numbers: [
          { value: "one fsync per 10s", explain: "The steady-state write rate to this file, independent of issuance rate." },
          { value: "up to 10s of restart sleep inside the window", explain: "The worst-case delay a restart may incur while waiting for the clock to cross the reserved watermark." },
        ],
        breaks: {
          failure: "A rewind larger than the reserved window still needs the halt.",
          handled: "A replacement host also inherits nothing, since the file is local to the disk that died. The watermark covers only the fast-restart case, not a full host replacement.",
        },
      },
    },
    {
      id: "e-guard-seq",
      from: "guard",
      to: "sequence",
      tier: "hot",
      step: 3,
      label: "ts >= last_ts",
      detail: {
        what: "The clock passed the check, so the call proceeds to the per-millisecond counter.",
        why: "Splitting the two stages keeps the failure taxonomy honest. Everything above this line is a correctness problem that halts the node; everything below it is a resource problem that costs microseconds.",
        breaks: {
          failure: "Only guarded timestamps should reach here.",
          handled: "If the guard clamps instead of halting, the counter silently becomes the thing absorbing a rewind, and 4096 is far too narrow for that. The guard must halt rather than clamp.",
        },
      },
    },
    {
      id: "e-seq-pack",
      from: "sequence",
      to: "pack",
      tier: "hot",
      step: 4,
      label: "seq & 0xFFF",
      detail: {
        what: "The counter's current value masked to 12 bits and handed to the pack step for the low end of the integer.",
        why: "It goes last so it cannot perturb the ordering the timestamp provides. A burst of 4000 IDs in one millisecond moves only the least significant field, which is exactly what you want from the field with no cross-worker meaning.",
        numbers: [
          { value: "0 to 4095", explain: "The full range of values this field can carry within one millisecond." },
          { value: "reset to 0 whenever the millisecond advances", explain: "The counter's reset condition, ensuring it never accumulates across millisecond boundaries." },
        ],
        breaks: {
          failure: "If the mask wraps within the same millisecond without spinning first, the very next ID repeats one already issued in that millisecond.",
          handled: "The spin at overflow exists precisely to prevent this wrap, converting what would be a correctness bug into a bounded stall instead.",
        },
      },
    },
    {
      id: "e-worker",
      from: "worker-id-holder",
      to: "pack",
      tier: "control",
      label: "worker id, fixed at boot",
      fromSide: "top",
      toSide: "bottom",
      detail: {
        what: "The worker id claimed at boot being stamped into the middle 10 bits of every ID this process will ever issue.",
        why: "This field is where uniqueness actually comes from. Two workers can read the same millisecond and hold the same sequence value and still not collide. The number space was cut into disjoint slices before the first request arrived, so it carries no per-request cost, a control input rather than part of the hot path.",
        numbers: [
          { value: "one value per process lifetime, 0 to 1023", explain: "This field never changes after boot, and its full range matches the 10-bit worker field width." },
          { value: "2^10 = 1024 slots; a 1k-node fleet is already at saturation", explain: "How close a real fleet size sits to the theoretical ceiling this field imposes." },
        ],
        breaks: {
          failure: "It is never re-validated. Two live processes holding the same value collide on every ID they issue in the same millisecond.",
          handled: "No local check can see this, and the clock is irrelevant to it, which is why worker-id duplication is caught only by the fleet-wide telemetry, never by the generator itself.",
        },
      },
    },
    {
      id: "e-lease",
      from: "lease-store",
      to: "worker-id-holder",
      tier: "control",
      label: "claim slot 0..1023 at boot",
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "A create-if-absent claim on one lease path at boot, walking to the next id on failure, then a heartbeat for as long as the process lives.",
        why: "This is the single coordinated step in the design, and moving it to boot is precisely what makes the hot path local. One claim per process lifetime instead of one per ID means the store is never the bottleneck or the availability floor.",
        numbers: [
          { value: "one claim per process lifetime", explain: "The entire lifetime cost of this coordination step, paid exactly once per process." },
          { value: "30s TTL so a dead node's slot returns", explain: "The reclaim window for a slot whose holder crashed without releasing it." },
        ],
        breaks: {
          failure: "If the store is unreachable at boot the process must refuse to start.",
          handled: "A guessed worker id is silent corruption; a pod that will not start is a page, which is why the design explicitly prefers failing loudly over guessing.",
        },
      },
    },
    {
      id: "e-ordinal",
      from: "orchestrator",
      to: "worker-id-holder",
      tier: "control",
      label: "or: stable ordinal",
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "The alternative source of the same field: the scheduler's ordinal handed to the process as configuration.",
        why: "Exactly one of these two arrows supplies the worker id, and where the ordinal exists it is the stronger of the two. The scheduler keeps enforcing exclusivity through a partition, while a TTL simply expires and hands your slot away.",
        breaks: {
          failure: "An ordinal from a platform that does not really guarantee stability, or that lets the fleet exceed 1024, is worse than a lease.",
          handled: "Nothing observes the drift in this case, which is why this path is only chosen when the scheduler's guarantee is verified, not merely assumed.",
        },
      },
    },
    {
      id: "e-sinks",
      from: "pack",
      to: "sinks",
      tier: "hot",
      step: 5,
      label: "8-byte sortable key",
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "The finished integer arriving in the index, which is where the high bits earn their place in the layout.",
        why: "Sorting the integers sorts by creation time, so new rows land at the right edge of the B-tree instead of splitting pages across the whole tree. The ID doubles as a pagination cursor with no extra column.",
        numbers: [
          { value: "2^41 ms ≈ 69.7 years of runway from a custom epoch", explain: "How long this format lasts before the timestamp field wraps, using a launch-date epoch rather than 1970." },
          { value: "anchored at 1970 the same 41 bits expire in 2039", explain: "The much shorter runway if the epoch were left at the Unix default instead." },
          { value: "decode is (id >> 22) + epoch_ms, no lookup", explain: "The exact arithmetic to recover the original timestamp from a stored id." },
        ],
        breaks: {
          failure: "Ordering is guaranteed across milliseconds, not within one: two workers issuing in the same millisecond are ordered by worker id, which is arbitrary.",
          handled: "Anyone treating the decoded timestamp as accurate event time is silently depending on that host's NTP discipline, an assumption that has to be documented rather than assumed safe.",
        },
        choice: {
          pick: "41 bits of milliseconds since a custom epoch set to the launch date",
          instead: "Milliseconds since the Unix epoch, or coarser 10ms ticks as Sonyflake uses.",
          decider:
            "Runway against resolution. 41 bits from 1970 saturates in 2039; from a 2020 launch date the same field runs about 69.7 years. Sonyflake's 39 bits of 10ms ticks buys 174 years and pays for it in resolution and in ordering granularity.",
          flips:
            "When you need a longer horizon or more machine bits than a 64-bit budget allows, at which point coarsening the tick is how you buy them back.",
        },
      },
    },
    {
      id: "e-opaque",
      from: "caller",
      to: "boundary",
      tier: "data",
      label: "opaque id at the edge",
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "The swap: whatever the application returns to a customer, a partner or a URL is not the raw integer.",
        why: "The generator has no idea where its output ends up, so this is a discipline enforced at the edge rather than a property of the ID. It is on the diagram because forgetting it is the failure that never shows up in any metric.",
        numbers: [{ value: "two identifiers per row: one internal BIGINT, one opaque external", explain: "The concrete cost of this discipline: every externally exposed row carries a second identifier alongside the internal one." }],
        breaks: {
          failure: "Nothing enforces it. The raw ID is a perfectly valid value to return.",
          handled: "The leak looks exactly like working code until someone reads your order volume off two receipts. This boundary is a code-review discipline rather than something the system can check for you.",
        },
      },
    },
    {
      id: "e-telemetry",
      from: "worker-id-holder",
      to: "metrics",
      tier: "control",
      label: "worker id, rewinds",
      detail: {
        what: "Each generator reporting its worker id as a label, plus its rewind count and issuance latency, alongside normal application metrics.",
        why: "There is no server to instrument, so the process itself is the only observability point. Reporting the worker id as a dimension is what turns an otherwise undetectable collision into an alarm that fires before the writes land.",
        numbers: [
          { value: "any worker id reported by two hosts pages immediately", explain: "The exact detection condition for the most severe failure mode this system has." },
          { value: "page on the first non-zero rewind", explain: "The threshold for escalating a clock rewind, treated as urgent from the very first occurrence." },
        ],
        breaks: {
          failure: "A process that halts on a rewind may also stop reporting.",
          handled: "The absence of the signal has to alarm as loudly as the signal itself, so silence from a previously reporting node is monitored as its own alert condition.",
        },
      },
    },
    {
      id: "e-slots",
      from: "lease-store",
      to: "metrics",
      tier: "control",
      label: "free slot gauge",
      fromSide: "bottom",
      toSide: "left",
      detail: {
        what: "The count of slots not currently held, scraped from the lease store rather than inferred from instance count.",
        why: "Exhaustion surfaces as boot failures during a deploy, by which point you already have an outage. This gauge is the only warning that arrives before that, and the number to graph is peak concurrently-held slots.",
        numbers: [
          { value: "alert below 15% of 1024 free", explain: "The threshold that gives operators warning before a deploy actually fails to claim a slot." },
          { value: "700 instances plus a batch of 100 plus draining holders is 800 to 900", explain: "A concrete example of how close normal deploy churn can push utilisation toward the ceiling." },
        ],
        breaks: {
          failure: "Dead workers hold their slot until the TTL expires, so the gauge lags reality by up to the lease TTL during a fast rolling deploy.",
          handled: "Releasing on SIGTERM returns slots in milliseconds instead, which is why graceful shutdown paths are relied on to keep the gauge accurate during normal deploys.",
        },
      },
    },
    {
      id: "e-dupes",
      from: "sinks",
      to: "metrics",
      tier: "control",
      label: "duplicate key errors",
      toSide: "right",
      detail: {
        what: "Unique-constraint violations on the ID column, which is the only place in the system where the uniqueness claim is ever actually checked.",
        why: "Nothing at issue time verifies exclusivity, so this is the ground truth. Duplicate-key errors clustered around a restart are the signature of the restart hole; spread across two hosts they are the signature of a shared worker id.",
        breaks: {
          failure: "It only fires where a constraint exists.",
          handled: "A duplicate landing in a log, an event stream or an unconstrained table is silent, and it stays silent until something joins on it. Every ID-bearing primary key is required to carry the constraint.",
        },
      },
    },
  ],
};
