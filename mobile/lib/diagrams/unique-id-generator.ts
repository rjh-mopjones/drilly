import type { Diagram } from "./types";

export const UNIQUE_ID_GENERATOR: Diagram = {
  id: "unique-id-generator",
  title: "Unique ID Generator",
  question: "Design a Unique ID Generator (Snowflake)",
  sourceId: "patterns",
  itemId: 4,
  overview: {
    shape:
      "There is no request path to draw. The system is a library inside your own process that packs three numbers into one 64-bit integer, and everything else on the diagram is either a claim made once at boot or a guard against the clock lying.",
    beats: [
      "Boot is where the only coordination happens. A process either claims an exclusive lease on one of 1024 worker slots from a strongly consistent store, or it takes a stable ordinal the orchestrator already assigns. Either way it is one claim per process lifetime, and a process that cannot get a slot refuses to start rather than guessing.",
      "After that the issue path is entirely local. next_id() reads the wall clock, compares it against the last timestamp used, bumps a per-millisecond counter, and ORs three fields together. Two shifts and an OR against process-local state, tens of nanoseconds, no socket, no lock, nothing that can be throttled or down.",
      "The clock guard is the whole design in one comparison. If the clock reads earlier than the last timestamp issued, the generator stops and pages someone. Clamping to last_ts and letting the sequence absorb the difference looks like the graceful option and is exactly how duplicates get minted.",
      "The sequence handles bursts and nothing else. It counts 0 to 4095 within a single millisecond on a single worker and resets when the millisecond advances. On overflow the generator spins until the clock ticks over, which converts the ceiling into a microsecond stall rather than a correctness bug.",
      "The layout is the contract. 41 bits of milliseconds since a custom epoch, 10 bits of worker, 12 bits of sequence, sign bit unused. The timestamp sits in the high bits so sorting the integers sorts by creation time, which keeps B-tree inserts at the right edge of the index.",
      "Downstream is where a failure actually becomes visible. You cannot detect a duplicate by inspecting IDs, so the unique constraint on the ID column wherever it is a primary key is the real detector, and the operational alarms on worker-id duplication and rewind counts are what fire before it.",
    ],
    crux: "Uniqueness here is a guarantee by construction rather than something checked at runtime, so it is only as strong as its two premises: that no other live process holds your worker id, and that the wall clock moves forward. Neither can be verified at the moment you issue an ID.",
    numbers: [
      "41 / 10 / 12 bits in 64",
      "4096 IDs per ms per worker = 4.096M/s",
      "1024 worker slots",
      "~69.7 years of epoch runway",
    ],
  },
  nodes: [
    // --- column A: the things the generator depends on and does not own ---
    {
      id: "ntp",
      label: "NTP / PTP time source",
      sub: "chrony, leap smearing",
      kind: "external",
      x: 40,
      y: 0,
      w: 260,
      detail: {
        what: "The daemon disciplining the host clock in the background, and the fleet-wide policy about how it corrects.",
        why: "It is not scenery: it is the component that actually moves the clock backwards. An NTP client steps rather than slews when the offset is large, so the correction itself is the rewind event the generator has to survive.",
        numbers: [
          "chrony makestep 1.0 3 steps on almost every fresh container",
          "untended crystal drift 10 to 50 ppm, 1 to 4 seconds a day",
          "alert on offset above 100ms, sampled every 10s",
        ],
        breaks:
          "With no time source the clock drifts at the crystal's rate and the correction on recovery is a step in whichever direction the drift went, which is exactly the event the generator halts on.",
        choice: {
          pick: "A leap-smearing time source fleet-wide, PTP where the hardware supports it",
          instead: "Handle the discontinuity inside the generator.",
          decider:
            "A positive leap second re-runs one whole UTC second, and the sequence is 4096 values wide within a single millisecond. There is no arrangement of 12 bits that absorbs 1000ms of repeated timestamps, so the only place to fix it is the time source.",
          flips:
            "Nowhere for leap seconds specifically, which the CGPM resolved in 2022 to retire by 2035 and none of which has been inserted since 2016. The general case, an arbitrary backwards step from a migration or a snapshot restore, still has to be handled in the generator.",
        },
      },
    },
    {
      id: "clock",
      label: "Host clock",
      sub: "CLOCK_REALTIME, steppable",
      kind: "external",
      x: 40,
      y: 190,
      w: 260,
      detail: {
        what: "The wall clock the generator reads on every call, and the only external fact the issue path depends on.",
        why: "The timestamp field is not decoration: it is where uniqueness within a worker comes from and where sortability comes from. That puts a hardware oscillator inside the correctness argument, which is the trade this whole design made.",
        numbers: [
          "read once per next_id()",
          "a live-migration or snapshot restore resumes with a stale clock",
          "a host with a dead RTC battery starts in 1970",
        ],
        breaks:
          "It steps backwards. NTP correction on container start, VM live migration, snapshot restore and an unsmeared positive leap second all rewind it, and nothing in the ID records that it happened.",
        choice: {
          pick: "Read CLOCK_REALTIME directly and halt on a detected rewind",
          instead:
            "Derive every timestamp as base_realtime + (monotonic_now - base_monotonic), captured once at startup.",
          decider:
            "Whether anyone downstream treats the decoded timestamp as accurate event time. A monotonic base cannot rewind at all, but the field then drifts from true UTC at the crystal's rate, 1 to 4 seconds a day.",
          flips:
            "When nothing consumes the decoded timestamp as event time and halting is unacceptable. Then derive from monotonic and correct forward only, never backward. Many teams depend on that timestamp without saying so, which is why the naive read plus a halt remains the common answer.",
        },
      },
    },
    {
      id: "orchestrator",
      label: "Orchestrator ordinal",
      sub: "StatefulSet / ECS task index",
      kind: "external",
      x: 40,
      y: 320,
      w: 260,
      detail: {
        what: "The scheduler that already assigns stable unique ordinals to instances, used directly as the worker id instead of claiming a lease.",
        why: "Where it exists it is stronger than anything you would build: the scheduler enforces exclusivity and keeps enforcing it during a network partition, which an expiring lease does not. It also deletes a boot-time dependency on a service that tends to be unhealthy exactly when you are trying to scale up.",
        numbers: [
          "ordinals 0..N-1, stable across restarts",
          "the 1024 slot ceiling still applies",
        ],
        breaks:
          "An autoscaling group of interchangeable instances gives neither a stable ordinal nor a cap below the slot count, and nothing detects the drift until two hosts are issuing under the same id.",
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
      x: 40,
      y: 450,
      w: 260,
      detail: {
        what: "A small strongly consistent store holding /snowflake/leases/{0..1023}, each entry naming its holder, process start time and expiry.",
        why: "This is the only coordination in the design and it happens once per process lifetime rather than once per ID. It has to be an exclusive claim rather than a registration, because the entire uniqueness argument rests on no two live processes holding the same slot.",
        numbers: [
          "1024 slots x ~50B ≈ 51KB of state",
          "~1KB/s/node heartbeats, ~1MB/s across 1000 nodes",
          "30s TTL so a dead node's slot returns",
          "regional slices (0-340 / 341-680 / 681-1023) give cross-region uniqueness with no cross-region traffic",
        ],
        breaks:
          "Slot exhaustion during a rolling deploy. 700 instances plus an in-flight batch of 100 plus holders still inside their TTL is 800 to 900 of 1024, and exhaustion surfaces as boot failures, by which point you already have an outage.",
        choice: {
          pick: "An exclusive expiring lease claimed at boot, with the process refusing to start if it cannot get one",
          instead: "A worker id baked in by the provisioning system or a config file.",
          decider:
            "Fleet churn against the 1024 slots. Static assignment is safe only when the fleet cannot exceed the slot count and nothing reassigns hosts; above roughly 100 instance replacements a day, or on any deploy that starts the new instance before the old one stops, hand-managed configuration drifts and two hosts eventually share an id.",
          flips:
            "A small fixed fleet well under 1024 that is never replaced automatically, where a config value is honest about what it is and there is no service to be unavailable at boot.",
        },
      },
    },

    // --- column B: the caller and the one library it links in ---
    {
      id: "caller",
      label: "Application process",
      sub: "needs a primary key",
      kind: "service",
      x: 500,
      y: 0,
      w: 260,
      detail: {
        what: "Your own service, calling into the generator in-process at the moment it needs a key for a row it is about to write.",
        why: "This is the whole client story and it is why the design exists in this shape. There is no ID service to call and no SDK talking to a remote endpoint, so the caller's availability and the generator's are the same number by construction.",
        numbers: [
          "~4k IDs/s/node steady state",
          "~1000 nodes ≈ 4M IDs/s aggregate",
          "issuance p99 target 1µs",
        ],
        breaks:
          "There is no ID service to page. When the generator halts on a rewind, this process is the outage, and behind a load balancer it is a partial one until the clock recovers.",
      },
    },
    {
      id: "generator",
      label: "Snowflake generator",
      kind: "serviceGroup",
      x: 500,
      y: 146,
      w: 320,
      h: 562,
      detail: {
        what: "A roughly 20-line library linked into the application process: hold the worker id claimed at boot, read the clock, guard it, bump the sequence, OR the three fields together.",
        why: "Coordination was moved to boot so nothing on the issue path can be slow, throttled or down. A per-request call to a central allocator would put that service's p99 on every insert and make it the availability floor for every write in the system. These stages are drawn inside one frame because they are one deployable: they start, halt and die together with the process that links them.",
        numbers: [
          "two shifts and an OR against process-local state",
          "tens of nanoseconds per call",
          "zero network calls after boot",
        ],
        breaks:
          "Everything it knows is process-local. last_ts and the sequence die with the process, so a crash and a 200ms restart leaves it with no record of what it already issued.",
        choice: {
          pick: "An embedded library holding one worker id per process",
          instead: "A central ID service, or a ticket server leasing blocks of a single counter.",
          decider:
            "Whether you can afford a network hop and another service's availability on every insert. Local issuance is tens of nanoseconds against a ceiling of 4.096M IDs/s/node; an RPC is hundreds of microseconds and adds a dependency that has to be up for every write in the system.",
          flips:
            "When an auditor needs dense, contiguous numbering with no gaps, which is a real requirement in finance and which no pre-partitioned scheme can satisfy. Then a ticket server leasing blocks is the only option, and it is also the only one that survives a machine with a broken clock.",
        },
      },
    },
    {
      id: "guard",
      label: "Clock read + rewind guard",
      sub: "if now < last_ts: halt",
      kind: "process",
      x: 540,
      y: 190,
      w: 240,
      detail: {
        what: "The first stage of next_id(): read the wall clock once, compare it against the last timestamp this process issued, and stop issuing if it moved backwards.",
        why: "A rewind that keeps generating reissues IDs already handed out, and nothing downstream notices until a foreign key points at the wrong row months later. The check has to happen before anything is packed, because once an ID has been returned it is already inside somebody's write.",
        numbers: [
          "one comparison, no measurable cost on the hot path",
          "a 5s live-migration step means 5s of silence on that node",
          "page on the first non-zero rewind count",
        ],
        breaks:
          "last_ts is process-local memory, so this comparison is completely blind across a restart. That hole is what the watermark exists to cover, and halting itself is a genuine availability hole: a fleet-wide time event halts the fleet.",
        choice: {
          pick: "Halt issuance and alert on any detected rewind, rejoining once now > last_ts",
          instead:
            "Clamp the timestamp to last_ts and let the sequence absorb the difference, or spend a sequence bit as a rewind generation counter.",
          decider:
            "The size of the rewind against a 4096-wide sequence. Clamping looks graceful and is exactly how duplicates get minted, because a multi-second rewind exhausts 4096 and wraps into values already issued.",
          flips:
            "Rewinds of a few milliseconds, where sleeping until the clock passes last_ts turns it into a latency blip. A generation counter keeps you issuing, at the cost of halving the ceiling to 2048, breaking time-ordering across the boundary, and needing to survive a restart itself.",
        },
      },
    },
    {
      id: "sequence",
      label: "Sequence counter",
      sub: "seq = (seq + 1) & 0xFFF",
      kind: "process",
      x: 540,
      y: 320,
      w: 240,
      detail: {
        what: "A per-millisecond counter, reset to 0 when the millisecond advances and masked to 12 bits when it has not.",
        why: "It is what lets one worker issue more than one ID inside the same millisecond without touching anything shared. Burst capacity comes from here; uniqueness across workers does not, which is why it can be the narrowest field. Splitting it from the guard keeps the failure taxonomy honest: above that line is a correctness problem that halts the node, below it is a resource problem that costs microseconds.",
        numbers: [
          "4096 IDs per millisecond per worker",
          "4.096M IDs/s/node ceiling",
          "steady state ~4k IDs/s/node, three orders of magnitude below it",
        ],
        breaks:
          "Overflow inside one millisecond. Without the spin you reissue values already used in that millisecond; with it you get a microsecond stall that shows up as latency micro-spikes.",
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
      x: 540,
      y: 450,
      w: 240,
      detail: {
        what: "The last stage: three disjoint fields shifted and ORed into one 64-bit integer with the sign bit left at zero.",
        why: "The layout is the contract, and this shift is where it is written down. The timestamp sits in the high bits so sorting the integers sorts by creation time; the worker sits in the middle because that is where uniqueness comes from; the sequence sits at the bottom so a burst never disturbs the ordering above it. 22 is 10 plus 12, exactly the width of the two fields below, which keeps the whole operation a bit-pack with no arithmetic to get wrong and no allocation at all.",
        numbers: [
          "1 sign + 41 ts + 10 worker + 12 seq = 64 bits = 8 bytes",
          "2^41 ms ≈ 69.7 years, 2^10 = 1024 workers, 2^12 = 4096 per ms",
          "decode is (id >> 22) + epoch_ms, pure arithmetic, no lookup",
        ],
        breaks:
          "The split is near-irreversible. IDs already minted decode under the old boundaries, so changing it means a flag day or spending a bit as an encoding marker.",
        choice: {
          pick: "41 timestamp / 10 worker / 12 sequence, sign bit unused",
          instead: "Shift bits toward the worker field, say 41 / 14 / 8.",
          decider:
            "Peak concurrently-held slots against peak per-worker rate. 10/12 gives 1024 workers at 4.096M IDs/s each; 41/14/8 gives 16,384 workers at 256 IDs/ms, or 256k IDs/s each. You have both numbers, so pick the split that clears them with margin.",
          flips:
            "Above roughly 1000 concurrently-held slots, which arrives earlier than instance count suggests because dead workers keep their slot until the lease expires. Decide once against a five-year fleet projection, because existing IDs decode under the old split.",
        },
      },
    },
    {
      id: "worker-id-holder",
      label: "Worker-id holder",
      sub: "claim at boot, watch the lease",
      kind: "process",
      x: 540,
      y: 580,
      w: 240,
      detail: {
        what: "The boot-time stage: claim one slot exclusively, keep the heartbeat alive, hold the value for the process lifetime, and kill issuance if it ever observes the lease lost.",
        why: "It is drawn inside the generator rather than as a service because it is a thread in the same process, but it is drawn separately from the pipeline because nothing about it is per request. The value is decided once, which is the entire reason the issue path has no network dependency.",
        numbers: [
          "one claim per process lifetime, then 0 network calls per ID",
          "30s lease TTL; release on SIGTERM returns the slot in milliseconds",
          "a random pick instead of a claim collides above ~38 nodes by the birthday bound",
        ],
        breaks:
          "The lease is checked at boot and never again, so exclusivity is asserted rather than enforced. A process that loses its lease to a long GC pause or a partition keeps stamping a slot somebody else now owns.",
        choice: {
          pick: "A background watcher that kills issuance on observed lease loss",
          instead: "Trust the boot-time claim for the whole process lifetime.",
          decider:
            "The watcher is asynchronous, so it bounds the overlap window by its poll interval rather than closing it. Fencing properly means consulting something outside the process before every ID, which destroys the property the whole design exists for, so a partial fix is the only fix available here.",
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
      x: 960,
      y: 0,
      w: 260,
      detail: {
        what: "Every place an ID would cross to a customer, a partner or a URL, and the point at which it must be swapped for something that decodes to nothing.",
        why: "Timestamp, worker and sequence are all recoverable from the integer. Two order IDs a day apart measure your daily volume, and consecutive ones enumerate your orders. There is no version of this where a compact, time-ordered, locally-generated ID is also unguessable, because the bits that make it sortable are the bits that make it readable.",
        numbers: [
          "12 low bits make consecutive IDs from one worker trivially enumerable",
          "one extra indexed column on the hot tables",
          "at 10^10 rows that second column is real but bounded",
        ],
        breaks:
          "Carrying two identifiers per row creates a recurring class of bug where the wrong one is logged, returned or joined on, and nothing in either value announces which is which.",
        choice: {
          pick: "A separate opaque external identifier carried alongside the internal ID",
          instead: "Hash the Snowflake at the boundary, or just expose it.",
          decider:
            "Whether ordering has to survive the boundary. Hashing destroys it, so cursor pagination over the external identifier stops working and you need a separate sort field or a signed cursor.",
          flips:
            "IDs that never leave your own systems, where the second column is pure cost. Also note that if the ID crosses a trust boundary at all, UUIDv7's 74 random bits win outright over any de-leaking scheme bolted onto a Snowflake.",
        },
      },
    },
    {
      id: "watermark",
      label: "Restart watermark",
      sub: "local disk, fsync now + 10s",
      kind: "database",
      x: 960,
      y: 190,
      w: 260,
      detail: {
        what: "One small file per host holding the highest timestamp this process has promised never to issue below, fsynced 10 seconds ahead of the clock.",
        why: "last_ts dies with the process, so a generator that crashes and restarts in 200ms on a host whose clock stepped back has no memory of what it issued. Persisting per ID is not on the table: an fsync is tens to hundreds of microseconds against an issue rate of up to 4M/s.",
        numbers: [
          "one fsync per 10s instead of 4 x 10^7",
          "up to 10s of restart latency inside the reserved window",
        ],
        breaks:
          "It is per host and dies with the disk, and it does nothing for a rewind larger than the window, which still needs the halt. A crash-looping process sleeping on it looks like a hang rather than a crash, so log the sleep loudly.",
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
      x: 960,
      y: 450,
      w: 260,
      detail: {
        what: "Every table, index and log line carrying the ID: as a primary key, as foreign keys elsewhere, and as a sort key.",
        why: "It is the only place a duplicate can actually be caught. You cannot detect one by inspecting IDs, so a unique constraint on the ID column wherever it is a primary key is the real detector, and it costs nothing you were not already paying.",
        numbers: [
          "8 bytes per key, stored once per index it appears in",
          "8B x 4 indexes x 10^10 rows ≈ 320GB of extra index versus 128 bits",
          "~32MB/s of pure ID bytes at 4M IDs/s",
        ],
        breaks:
          "A duplicate landing anywhere without a unique constraint is silent corruption, and it surfaces months later as a foreign key pointing at the wrong row.",
        choice: {
          pick: "A 64-bit Snowflake in existing BIGINT columns",
          instead:
            "UUIDv7: 128 bits of 48-bit millisecond prefix plus 74 random bits, standardised in RFC 9562 in 2024.",
          decider:
            "What 8 extra bytes per key cost at your row count. At 10^10 rows across four indexes that is roughly 320GB of extra index plus the memory to keep the hot part resident; at 10^9 rows it is 32GB and not worth a conversation.",
          flips:
            "Greenfield systems under roughly 10^9 rows, or any ID that crosses a trust boundary, where 74 random bits are not enumerable and a Snowflake is. Then UUIDv7 wins outright: no allocation scheme, no halt logic, no bit budget to regret, and a native uuidv7() in PostgreSQL 18.",
        },
      },
    },
    {
      id: "metrics",
      label: "Generator telemetry",
      sub: "worker-id gauge, rewind counter",
      kind: "database",
      x: 500,
      y: 760,
      w: 260,
      detail: {
        what: "Per-node counters: the worker id each host reports, detected clock rewinds, free lease slots and sequence overflows.",
        why: "Every real failure here is invisible in the data until far too late, so the leading indicators have to be operational rather than data-level. Two hosts reporting the same worker id is an active correctness incident, and the first rewind predicts duplicates before they reach anything durable.",
        numbers: [
          "workers_reporting_id above 1 pages immediately",
          "free_lease_slots alert below 15% of 1024",
          "gen_latency_p99 alert above 1µs",
        ],
        breaks:
          "It is asynchronous. By the time a second host reports your worker id both have already been issuing, so this bounds the damage rather than preventing it. A process that halts on a rewind may also stop reporting, so the absence of a signal has to alarm as loudly as the signal.",
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
      label: "next_id()",
      animated: true,
      detail: {
        what: "An in-process function call at the moment the caller needs a key for a row it is about to write.",
        why: "It is drawn short and solid because that is the entire request path. There is no serialisation, no socket and no other service's tail latency sitting between a write and the ID it needs.",
        numbers: ["tens of nanoseconds", "p99 issuance target 1µs"],
        breaks:
          "If this ever becomes an RPC, every insert in the system inherits that service's availability and its p99, which is the failure the whole design was built to avoid.",
      },
    },
    {
      id: "e-ntp",
      from: "ntp",
      to: "clock",
      label: "steps the clock",
      dashed: true,
      detail: {
        what: "The background discipline of the host clock: a slew when the offset is small, a step when it is large.",
        why: "Drawn as its own arrow because the step is the event, not the daemon. Everything the generator does about clocks is a response to what happens along this arrow.",
        numbers: [
          "chrony makestep 1.0 3: steps if the offset exceeds 1s in the first 3 updates",
          "a smeared leap second is spread over 24 hours instead",
        ],
        breaks:
          "The step can be backwards, and the generator finds out only by comparing against last_ts after the fact. Nothing warns it in advance except a growing offset gauge.",
      },
    },
    {
      id: "e-clock",
      from: "clock",
      to: "guard",
      label: "now_ms(), per call",
      animated: true,
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "Reading the wall clock on every call. It is the only external fact the issue path depends on.",
        why: "The timestamp is read rather than counted because the field has to mean something to consumers who decode it back to a creation time. That is what drags a hardware oscillator into the correctness argument.",
        numbers: ["read once per next_id()", "CLOCK_REALTIME is the clock that can step"],
        breaks:
          "CLOCK_MONOTONIC cannot go backwards but has no epoch and resets on reboot, so it cannot be the field directly. It can only be the source of advance from a realtime base captured at startup.",
      },
    },
    {
      id: "e-watermark",
      from: "guard",
      to: "watermark",
      label: "fsync now + 10s",
      dashed: true,
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "Persisting a timestamp the process promises not to issue below, written at startup and rewritten only when the clock crosses it.",
        why: "It closes the one hole the in-memory comparison cannot see: a crash and a fast restart after a rewind. Reserving time forward moves the durability cost from per ID to per 10 seconds, which is the difference between impossible and free.",
        numbers: ["one fsync per 10s", "up to 10s of restart sleep inside the window"],
        breaks:
          "A rewind larger than the reserved window still needs the halt, and a replacement host inherits nothing because the file is local to the disk that died.",
      },
    },
    {
      id: "e-guard-seq",
      from: "guard",
      to: "sequence",
      label: "ts >= last_ts",
      animated: true,
      detail: {
        what: "The clock passed the check, so the call proceeds to the per-millisecond counter.",
        why: "Splitting the two stages keeps the failure taxonomy honest. Everything above this line is a correctness problem that halts the node; everything below it is a resource problem that costs microseconds.",
        breaks:
          "Only guarded timestamps should reach here. If the guard clamps instead of halting, the counter silently becomes the thing absorbing a rewind, and 4096 is far too narrow for that.",
      },
    },
    {
      id: "e-seq-pack",
      from: "sequence",
      to: "pack",
      label: "seq & 0xFFF",
      animated: true,
      detail: {
        what: "The counter's current value masked to 12 bits and handed to the pack step for the low end of the integer.",
        why: "It goes last so it cannot perturb the ordering the timestamp provides. A burst of 4000 IDs in one millisecond moves only the least significant field, which is exactly what you want from the field with no cross-worker meaning.",
        numbers: ["0 to 4095", "reset to 0 whenever the millisecond advances"],
        breaks:
          "If the mask wraps within the same millisecond without spinning first, the very next ID repeats one already issued in that millisecond.",
      },
    },
    {
      id: "e-worker",
      from: "worker-id-holder",
      to: "pack",
      label: "worker id, fixed at boot",
      dashed: true,
      fromSide: "top",
      toSide: "bottom",
      detail: {
        what: "The worker id claimed at boot being stamped into the middle 10 bits of every ID this process will ever issue.",
        why: "This field is where uniqueness actually comes from. Two workers can read the same millisecond and hold the same sequence value and still not collide, because the number space was cut into disjoint slices before the first request arrived. It is dashed because nothing about it is per request.",
        numbers: [
          "one value per process lifetime, 0 to 1023",
          "2^10 = 1024 slots; a 1k-node fleet is already at saturation",
        ],
        breaks:
          "It is never re-validated. Two live processes holding the same value collide on every ID they issue in the same millisecond, no local check can see it, and the clock is irrelevant to it.",
      },
    },
    {
      id: "e-lease",
      from: "lease-store",
      to: "worker-id-holder",
      label: "claim slot 0..1023 at boot",
      dashed: true,
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "A create-if-absent claim on one lease path at boot, walking to the next id on failure, then a heartbeat for as long as the process lives.",
        why: "This is the single coordinated step in the design, and moving it to boot is precisely what makes the hot path local. One claim per process lifetime instead of one per ID means the store is never the bottleneck or the availability floor.",
        numbers: ["one claim per process lifetime", "30s TTL so a dead node's slot returns"],
        breaks:
          "If the store is unreachable at boot the process must refuse to start. A guessed worker id is silent corruption; a pod that will not start is a page.",
      },
    },
    {
      id: "e-ordinal",
      from: "orchestrator",
      to: "worker-id-holder",
      label: "or: stable ordinal",
      dashed: true,
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "The alternative source of the same field: the scheduler's ordinal handed to the process as configuration.",
        why: "Exactly one of these two arrows supplies the worker id, and where the ordinal exists it is the stronger of the two, because the scheduler keeps enforcing exclusivity through a partition while a TTL simply expires and hands your slot away.",
        numbers: ["ordinal is stable across restarts, unlike a re-claimed lease"],
        breaks:
          "An ordinal from a platform that does not really guarantee stability, or that lets the fleet exceed 1024, is worse than a lease because nothing observes the drift.",
      },
    },
    {
      id: "e-sinks",
      from: "pack",
      to: "sinks",
      label: "8-byte sortable key",
      animated: true,
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "The finished integer arriving in the index, which is where the high bits earn their place in the layout.",
        why: "Sorting the integers sorts by creation time, so new rows land at the right edge of the B-tree instead of splitting pages across the whole tree, and the ID doubles as a pagination cursor with no extra column.",
        numbers: [
          "2^41 ms ≈ 69.7 years of runway from a custom epoch",
          "anchored at 1970 the same 41 bits expire in 2039",
          "decode is (id >> 22) + epoch_ms, no lookup",
        ],
        breaks:
          "Ordering is guaranteed across milliseconds, not within one: two workers issuing in the same millisecond are ordered by worker id, which is arbitrary. And anyone treating the decoded timestamp as accurate event time is silently depending on that host's NTP discipline.",
        choice: {
          pick: "41 bits of milliseconds since a custom epoch set to the launch date",
          instead: "Milliseconds since the Unix epoch, or coarser 10ms ticks as Sonyflake uses.",
          decider:
            "Runway against resolution. 41 bits from 1970 saturates in 2039; from a 2020 launch date the same field runs about 69.7 years. Sonyflake's 39 bits of 10ms ticks buys 174 years and pays for it in resolution and in ordering granularity.",
          flips:
            "When you need a longer horizon or more machine bits than a 64-bit budget allows, at which point coarsening the tick is how you buy them back. A 69-year horizon on a decision needing a flag day is not as comfortable a margin as it sounds.",
        },
      },
    },
    {
      id: "e-opaque",
      from: "caller",
      to: "boundary",
      label: "opaque id at the edge",
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "The swap: whatever the application returns to a customer, a partner or a URL is not the raw integer.",
        why: "The generator has no idea where its output ends up, so this is a discipline enforced at the edge rather than a property of the ID. It is on the diagram because forgetting it is the failure that never shows up in any metric.",
        numbers: ["two identifiers per row: one internal BIGINT, one opaque external"],
        breaks:
          "Nothing enforces it. The raw ID is a perfectly valid value to return, so the leak looks exactly like working code until someone reads your order volume off two receipts.",
      },
    },
    {
      id: "e-telemetry",
      from: "worker-id-holder",
      to: "metrics",
      label: "worker id, rewinds",
      dashed: true,
      detail: {
        what: "Each generator reporting its worker id as a label, plus its rewind count and issuance latency, alongside normal application metrics.",
        why: "There is no server to instrument, so the process itself is the only observability point. Reporting the worker id as a dimension is what turns an otherwise undetectable collision into an alarm that fires before the writes land.",
        numbers: [
          "any worker id reported by two hosts pages immediately",
          "page on the first non-zero rewind",
        ],
        breaks:
          "A process that halts on a rewind may also stop reporting, so the absence of the signal has to alarm as loudly as the signal itself.",
      },
    },
    {
      id: "e-slots",
      from: "lease-store",
      to: "metrics",
      label: "free slot gauge",
      dashed: true,
      fromSide: "bottom",
      toSide: "left",
      detail: {
        what: "The count of slots not currently held, scraped from the lease store rather than inferred from instance count.",
        why: "Exhaustion surfaces as boot failures during a deploy, by which point you already have an outage. This gauge is the only warning that arrives before that, and the number to graph is peak concurrently-held slots.",
        numbers: [
          "alert below 15% of 1024 free",
          "700 instances plus a batch of 100 plus draining holders is 800 to 900",
        ],
        breaks:
          "Dead workers hold their slot until the TTL expires, so the gauge lags reality by up to the lease TTL during a fast rolling deploy. Releasing on SIGTERM returns slots in milliseconds instead.",
      },
    },
    {
      id: "e-dupes",
      from: "sinks",
      to: "metrics",
      label: "duplicate key errors",
      dashed: true,
      toSide: "right",
      detail: {
        what: "Unique-constraint violations on the ID column, which is the only place in the system where the uniqueness claim is ever actually checked.",
        why: "Nothing at issue time verifies exclusivity, so this is the ground truth. Duplicate-key errors clustered around a restart are the signature of the restart hole; spread across two hosts they are the signature of a shared worker id.",
        numbers: ["free where the ID is already a primary key"],
        breaks:
          "It only fires where a constraint exists. A duplicate landing in a log, an event stream or an unconstrained table is silent, and it stays silent until something joins on it.",
      },
    },
  ],
};
