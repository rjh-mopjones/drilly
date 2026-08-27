import type { Diagram } from "./types";

export const UNIQUE_ID_GENERATOR: Diagram = {
  id: "unique-id-generator",
  title: "Unique ID Generator",
  question: "Design a Unique ID Generator (Snowflake)",
  sourceId: "patterns",
  itemId: 4,
  overview: {
    shape:
      "There is no request path to draw. The system is a function inside your own process that packs three numbers into one 64-bit integer, and everything else on the diagram is either a claim made once at boot or a guard against the clock lying.",
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
    {
      id: "id-layout",
      label: "id = ts | worker | seq",
      kind: "group",
      x: 24,
      y: 464,
      w: 712,
      h: 108,
      detail: {
        what: "The 64-bit integer itself, cut into three disjoint fields with the sign bit left at zero.",
        why: "Everything else in this design is an argument about where to draw these boundaries and what to do when the clock lies. Uniqueness comes from the middle field, sortability from the first sitting in the high bits, burst capacity from the third.",
        numbers: ["1 sign + 41 ts + 10 worker + 12 seq = 64 bits = 8 bytes"],
        breaks:
          "The split is near-irreversible. IDs already minted decode under the old boundaries, so changing it means a flag day or spending a bit as an encoding marker.",
      },
    },
    {
      id: "caller",
      label: "Application process",
      sub: "needs a primary key",
      kind: "compute",
      x: 40,
      y: 0,
      w: 280,
      detail: {
        what: "Your own service, calling into the generator in-process at the moment it needs a key for a row it is about to write.",
        why: "This is the whole client story and it is why the design exists in this shape. There is no ID service to call and no SDK talking to a remote endpoint, so the caller's availability and the generator's are the same number by construction.",
        numbers: ["~4k IDs/s/node steady state", "issuance p99 target 1µs"],
        breaks:
          "Handing a raw ID to a customer or a partner. Timestamp, worker and sequence all decode, so two order IDs a day apart measure your daily volume and consecutive ones enumerate your orders.",
        choice: {
          pick: "Keep the raw ID internal and carry a separate opaque identifier at any external boundary",
          instead: "Hash the Snowflake at the boundary, or just expose it.",
          decider:
            "Whether ordering has to survive the boundary. Hashing destroys it, so cursor pagination over the external identifier stops working and you need a separate sort field or a signed cursor. Carrying 2 identifiers per row costs 1 extra indexed column on the hot tables instead, which at 10^10 rows is real but bounded.",
          flips:
            "IDs that never leave your own systems, where the second column is pure cost and a recurring class of bug where the wrong identifier gets logged, returned or joined on.",
        },
      },
    },
    {
      id: "lease-store",
      label: "Worker-id lease store",
      sub: "etcd / ZooKeeper, create-if-absent",
      kind: "store",
      x: 440,
      y: 0,
      w: 260,
      detail: {
        what: "A small strongly consistent store holding /snowflake/leases/{0..1023}, each entry naming its holder, process start time and expiry.",
        why: "This is the only coordination in the design and it happens once per process lifetime rather than once per ID. It has to be an exclusive claim rather than a registration, because the entire uniqueness argument rests on no two live processes holding the same slot.",
        numbers: [
          "1024 slots x ~50B ≈ 51KB of state",
          "~1KB/s/node heartbeats, ~1MB/s across 1000 nodes",
          "30s TTL so a dead node's slot returns",
        ],
        breaks:
          "It is checked at boot and never again, so exclusivity is asserted rather than enforced. A generator that loses its lease to a long GC pause or a partition keeps issuing under a worker id that has been handed to someone else.",
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
    {
      id: "generator",
      label: "Snowflake generator",
      sub: "in-process library, next_id()",
      kind: "compute",
      x: 40,
      y: 110,
      w: 280,
      detail: {
        what: "A roughly 20-line library linked into the application: read the clock, guard it, bump the sequence, OR the three fields together.",
        why: "Coordination was moved to boot so nothing on the issue path can be slow, throttled or down. A per-request call to a central allocator would put that service's p99 on every insert and make it the availability floor for every write in the system.",
        numbers: [
          "two shifts and an OR against process-local state",
          "tens of nanoseconds per call",
          "zero network calls after boot",
        ],
        breaks:
          "It holds last_ts in memory, so a crash and a 200ms restart leaves it with no record of what it already issued.",
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
      id: "orchestrator",
      label: "Orchestrator ordinal",
      sub: "StatefulSet / ECS task index",
      kind: "external",
      x: 440,
      y: 110,
      w: 260,
      detail: {
        what: "The scheduler that already assigns stable unique ordinals to instances, used directly as the worker id instead of claiming a lease.",
        why: "Where it exists it is stronger than anything you would build: the scheduler enforces exclusivity and keeps enforcing it during a network partition, which an expiring lease does not. It also deletes a boot-time dependency on a service that tends to be unhealthy exactly when you are trying to scale up.",
        numbers: ["ordinals 0..N-1, stable across restarts", "the 1024 slot ceiling still applies"],
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
      id: "rewind-guard",
      label: "Clock rewind guard",
      sub: "if now < last_ts: halt",
      kind: "compute",
      x: 40,
      y: 220,
      w: 280,
      detail: {
        what: "One comparison on every call: if the clock reads earlier than the last timestamp issued, stop issuing and alert.",
        why: "A rewind that keeps generating reissues IDs already handed out, and nothing downstream notices until a foreign key points at the wrong row months later. One node silent for a few seconds behind a load balancer is recoverable; duplicate primary keys are not.",
        numbers: [
          "one comparison, no measurable cost on the hot path",
          "a 5s live-migration step means 5s of silence on that node",
          "page on the first non-zero rewind count",
        ],
        breaks:
          "Halting is a genuine availability hole. A fleet-wide time event halts the fleet, and there is no way to keep issuing correctly through an arbitrary backwards step.",
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
      id: "clock",
      label: "Host clock",
      sub: "leap-smeared NTP, CLOCK_REALTIME",
      kind: "external",
      x: 440,
      y: 220,
      w: 260,
      detail: {
        what: "The wall clock the generator reads on every call, disciplined in the background by NTP or PTP.",
        why: "The timestamp field is not decoration: it is where uniqueness within a worker comes from and where sortability comes from. That puts a hardware oscillator and the daemon steering it inside the correctness argument, which is the trade this whole design made.",
        numbers: [
          "crystal drift 10 to 50 ppm, 1 to 4 seconds a day untended",
          "chrony makestep 1.0 3 fires on almost every fresh container",
          "alert on NTP offset above 100ms",
        ],
        breaks:
          "It steps backwards. NTP correction on container start, VM live migration, snapshot restore and an unsmeared positive leap second all rewind it.",
        choice: {
          pick: "A leap-smearing time source fleet-wide, PTP where the hardware supports it",
          instead: "Deriving the timestamp from CLOCK_MONOTONIC on a realtime base captured at startup.",
          decider:
            "Whether anyone downstream treats the decoded timestamp as accurate event time. A monotonic base cannot rewind at all, but the field then drifts from true UTC at the crystal's rate, 1 to 4 seconds a day.",
          flips:
            "When nothing consumes the decoded timestamp as event time and halting on a rewind is unacceptable. Then derive from monotonic and correct forward only, never backward.",
        },
      },
    },
    {
      id: "sequence-counter",
      label: "Sequence counter",
      sub: "seq = (seq + 1) & 0xFFF",
      kind: "compute",
      x: 40,
      y: 330,
      w: 280,
      detail: {
        what: "A per-millisecond counter, reset to 0 when the millisecond advances and masked to 12 bits when it has not.",
        why: "It is what lets one worker issue more than one ID inside the same millisecond without touching anything shared. Burst capacity comes from here; uniqueness across workers does not, which is why it can be the narrowest field.",
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
      id: "watermark",
      label: "Restart watermark",
      sub: "local disk, fsync now + 10s",
      kind: "store",
      x: 440,
      y: 330,
      w: 260,
      detail: {
        what: "One small file per host holding the highest timestamp this process has promised never to issue below, fsynced 10 seconds ahead of the clock.",
        why: "last_ts dies with the process, so a generator that crashes and restarts in 200ms on a host whose clock stepped back has no memory of what it issued. Persisting per ID is not on the table: an fsync is tens to hundreds of microseconds against an issue rate of up to 4M/s.",
        numbers: [
          "one fsync per 10s instead of 4 x 10^7",
          "up to 10s of restart latency inside the reserved window",
        ],
        breaks:
          "It is per host and dies with the disk, and it does nothing for a rewind larger than the window, which still needs the halt. A crash-looping process sleeping on it looks like a hang rather than a crash.",
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
      id: "ts-field",
      label: "Timestamp, 41 bits",
      sub: "ms since a custom epoch",
      kind: "bus",
      x: 40,
      y: 480,
      w: 300,
      detail: {
        what: "The high 41 bits: milliseconds since a custom epoch set to the product's launch date rather than to 1970.",
        why: "It sits at the top of the integer so sorting IDs as ordinary numbers also sorts them by creation time. That keeps B-tree inserts at the right edge of the index instead of splitting pages all over the tree, and it lets the ID double as a pagination cursor.",
        numbers: [
          "2^41 ms ≈ 69.7 years of runway",
          "anchored at 1970 the same 41 bits expire in 2039",
          "decode is (id >> 22) + epoch_ms, pure arithmetic",
        ],
        breaks:
          "Ordering is guaranteed across milliseconds, not within one. Two workers issuing in the same millisecond are ordered by worker id, which is arbitrary.",
        choice: {
          pick: "41 bits of milliseconds since a custom epoch, in the high bits",
          instead: "Milliseconds since the Unix epoch, or coarser 10ms ticks as Sonyflake uses.",
          decider:
            "Runway against resolution. 41 bits from 1970 saturates in 2039; from a 2020 launch date the same field runs about 69.7 years. Sonyflake's 39 bits of 10ms ticks buys 174 years and pays for it in resolution and in ordering granularity.",
          flips:
            "When you need a longer horizon or more machine bits than a 64-bit budget allows, at which point coarsening the tick is how you buy them back. Note that a 69-year horizon on a decision needing a flag day is not as comfortable a margin as it sounds.",
        },
      },
    },
    {
      id: "worker-field",
      label: "Worker id, 10 bits",
      sub: "1024 slots, fixed at boot",
      kind: "bus",
      x: 360,
      y: 480,
      w: 180,
      detail: {
        what: "The middle 10 bits: a number from 0 to 1023 that must be unique across every live process in the fleet.",
        why: "This field is where uniqueness actually comes from. Two workers can read the same millisecond and hold the same sequence value and still not collide, because the number space was cut into disjoint slices before the first request arrived.",
        numbers: [
          "2^10 = 1024 slots",
          "a 1k-node fleet is already at saturation",
          "a random pick collides above ~38 nodes by the birthday bound",
        ],
        breaks:
          "Two live processes holding the same value collide on every ID they issue in the same millisecond, no local check can see it, and the clock is irrelevant to it.",
        choice: {
          pick: "10 bits of worker against 12 of sequence",
          instead: "41 / 14 / 8, giving 16,384 workers at 256 IDs/ms each.",
          decider:
            "Peak concurrently-held slots against peak per-worker rate. 10/12 gives 1024 workers at 4.096M IDs/s each; 41/14/8 gives 16,384 workers at 256k IDs/s each. You have both numbers, so pick the split that clears them with margin.",
          flips:
            "Above roughly 1000 concurrently-held slots, which arrives earlier than instance count suggests because dead workers keep their slot until the lease expires. Decide once against a five-year fleet projection, because existing IDs decode under the old split.",
        },
      },
    },
    {
      id: "seq-field",
      label: "Sequence, 12 bits",
      sub: "0..4095 within one ms",
      kind: "bus",
      x: 560,
      y: 480,
      w: 160,
      detail: {
        what: "The low 12 bits: the counter's value, so IDs issued inside the same millisecond by the same worker differ.",
        why: "It absorbs bursts without either coordinating or lying about the time. Putting it in the low bits means it never disturbs the ordering the high bits provide, so a burst changes the last three hex digits and nothing that anyone sorts on.",
        numbers: [
          "2^12 = 4096 per millisecond per worker",
          "sign bit stays 0, so the value is a positive BIGINT everywhere",
        ],
        breaks:
          "It is the field that silently absorbs a clamped rewind if you make that mistake, and 4096 is far too narrow to absorb seconds.",
      },
    },
    {
      id: "sinks",
      label: "Downstream sinks",
      sub: "BIGINT PK, unique constraint",
      kind: "store",
      x: 40,
      y: 620,
      w: 300,
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
      sub: "worker id per host, rewind counter",
      kind: "store",
      x: 440,
      y: 620,
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
          "It is asynchronous. By the time a second host reports your worker id both have already been issuing, so this bounds the damage rather than preventing it.",
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
      id: "e1",
      from: "caller",
      to: "generator",
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
      id: "e2",
      from: "lease-store",
      to: "generator",
      label: "claim slot 0..1023, at boot",
      dashed: true,
      fromSide: "left",
      toSide: "right",
      detail: {
        what: "A create-if-absent claim on one lease path at boot, walking to the next id on failure.",
        why: "This is the single coordinated step in the design, and moving it to boot is precisely what makes the hot path local. One claim per process lifetime instead of one per ID means the store is never the bottleneck or the availability floor.",
        numbers: ["one claim per process lifetime", "30s TTL so a dead node's slot returns"],
        breaks:
          "If the store is unreachable at boot the process must refuse to start. A guessed worker id is silent corruption; a pod that will not start is a page.",
      },
    },
    {
      id: "e3",
      from: "orchestrator",
      to: "generator",
      label: "or: stable ordinal",
      dashed: true,
      fromSide: "left",
      toSide: "right",
      detail: {
        what: "The alternative source of the same field: the scheduler's ordinal handed to the process as configuration.",
        why: "Exactly one of these two arrows supplies the worker id, and where the ordinal exists it is the stronger of the two, because the scheduler keeps enforcing exclusivity through a partition while a TTL simply expires and hands your slot away.",
        numbers: ["ordinal is stable across restarts, unlike a re-claimed lease"],
        breaks:
          "An ordinal from a platform that does not really guarantee stability, or that lets the fleet exceed 1024, is worse than a lease because nothing observes the drift.",
      },
    },
    {
      id: "e5",
      from: "generator",
      to: "rewind-guard",
      label: "ts, last_ts",
      animated: true,
      detail: {
        what: "The call entering the guard carrying the freshly read timestamp and the last one this process issued.",
        why: "The check has to happen before anything is packed, because once an ID has been returned it is already inside somebody's write and there is no code path anywhere that will notice it was wrong.",
        breaks:
          "last_ts is process-local memory, so this comparison is completely blind across a restart. That hole is what the watermark exists to cover.",
      },
    },
    {
      id: "e4",
      from: "clock",
      to: "rewind-guard",
      label: "now_ms(), per call",
      animated: true,
      fromSide: "left",
      toSide: "right",
      detail: {
        what: "Reading the wall clock on every call. It is the only external fact the issue path depends on.",
        why: "The timestamp is read rather than counted because the field has to mean something to consumers who decode it back to a creation time. That is what drags a hardware oscillator into the correctness argument.",
        numbers: ["read once per next_id()", "CLOCK_REALTIME is the clock that can step"],
        breaks:
          "CLOCK_MONOTONIC cannot go backwards but has no epoch and resets on reboot, so it cannot be the field directly. It can only be the source of advance from a realtime base captured at startup.",
      },
    },
    {
      id: "e6",
      from: "rewind-guard",
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
      id: "e7",
      from: "rewind-guard",
      to: "sequence-counter",
      label: "ts >= last_ts",
      animated: true,
      detail: {
        what: "The clock passed the check, so the call proceeds to the per-millisecond counter.",
        why: "Splitting the two keeps the failure taxonomy honest. Everything above this line is a correctness problem that halts the node; everything below it is a resource problem that costs microseconds.",
        breaks:
          "Only guarded timestamps should reach here. If the guard clamps instead of halting, the counter silently becomes the thing absorbing a rewind, and 4096 is far too narrow for that.",
      },
    },
    {
      id: "e8",
      from: "sequence-counter",
      to: "ts-field",
      label: "ts << 22",
      animated: true,
      detail: {
        what: "The guarded millisecond shifted into the top 41 bits of the integer.",
        why: "22 is 10 plus 12, exactly the width of the two fields below it, which keeps the whole operation a bit-pack with no arithmetic to get wrong and no allocation at all.",
        numbers: ["(ts << 22) | (worker_id << 12) | seq"],
        breaks:
          "Change the split and this shift changes with it, while every ID already minted still decodes under the old one. That is why the layout is a flag day rather than a config change.",
      },
    },
    {
      id: "e9",
      from: "sequence-counter",
      to: "seq-field",
      label: "seq & 0xFFF",
      animated: true,
      detail: {
        what: "The counter's current value masked to 12 bits and dropped into the low end of the integer.",
        why: "It goes last so it cannot perturb the ordering the timestamp provides. A burst of 4000 IDs in one millisecond moves only the least significant field, which is exactly what you want from the field with no cross-worker meaning.",
        numbers: ["0 to 4095", "reset to 0 whenever the millisecond advances"],
        breaks:
          "If the mask wraps within the same millisecond without spinning first, the very next ID repeats one already issued in that millisecond.",
      },
    },
    {
      id: "e10",
      from: "generator",
      to: "worker-field",
      label: "worker id at boot",
      dashed: true,
      fromSide: "left",
      toSide: "top",
      offset: 70,
      detail: {
        what: "The worker id claimed at boot being stamped into the middle 10 bits of every ID this process will ever issue.",
        why: "It is dashed because nothing about it is per request. The value is decided once and is then a process-lifetime constant, which is the entire reason the issue path has no network dependency.",
        numbers: ["one value per process lifetime", "0 to 1023"],
        breaks:
          "It is never re-validated. If the lease expired an hour ago during a GC pause, this field keeps cheerfully stamping a slot somebody else now owns.",
      },
    },
    {
      id: "e11",
      from: "ts-field",
      to: "sinks",
      label: "sortable prefix",
      animated: true,
      fromSide: "bottom",
      toSide: "top",
      detail: {
        what: "The high bits arriving in the index, which is where they earn their place in the layout.",
        why: "Sorting the integers sorts by creation time, so new rows land at the right edge of the B-tree instead of splitting pages across the whole tree, and the ID doubles as a pagination cursor with no extra column.",
        numbers: ["decode is (id >> 22) + epoch_ms, no lookup"],
        breaks:
          "Anyone treating the decoded timestamp as accurate event time is silently depending on that host's NTP discipline, and nothing in the ID says so.",
      },
    },
    {
      id: "e12",
      from: "worker-field",
      to: "sinks",
      label: "uniqueness",
      fromSide: "bottom",
      toSide: "top",
      detail: {
        what: "The middle bits: the reason two rows written in the same millisecond by different hosts do not collide.",
        why: "This is the field the unique constraint downstream is really testing. Nothing at issue time verifies exclusivity, so the constraint is the only place in the entire system where the claim is ever checked.",
        breaks:
          "A collision is invisible to the generator and becomes visible only as a constraint violation, or as nothing at all wherever no constraint exists.",
      },
    },
    {
      id: "e13",
      from: "seq-field",
      to: "sinks",
      label: "burst headroom",
      fromSide: "bottom",
      toSide: "top",
      detail: {
        what: "The low bits, carrying within-millisecond ordering for a single worker and no meaning across workers.",
        why: "They are the difference between a per-worker ceiling of 1000 IDs/s and 4.096M. Downstream they are effectively noise, which is the correct role for the least significant field.",
        numbers: ["8 bytes per ID in total, ~32MB/s at 4M IDs/s"],
        breaks:
          "They make consecutive IDs from one worker trivially enumerable, which is half the reason these values must never reach a customer.",
      },
    },
    {
      id: "e14",
      from: "generator",
      to: "metrics",
      label: "worker id, rewinds",
      dashed: true,
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "Each generator reporting its worker id as a label, plus its rewind count and issuance latency, alongside normal application metrics.",
        why: "There is no server to instrument, so the process itself is the only observability point. Reporting the worker id as a dimension is what turns an otherwise undetectable collision into an alarm that fires before the writes land.",
        numbers: ["any worker id reported by two hosts pages immediately", "page on the first non-zero rewind"],
        breaks:
          "A process that halts on a rewind may also stop reporting, so the absence of the signal has to alarm as loudly as the signal itself.",
      },
    },
    {
      id: "e15",
      from: "lease-store",
      to: "metrics",
      label: "free slot gauge",
      dashed: true,
      fromSide: "right",
      toSide: "right",
      offset: 90,
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
  ],
};
