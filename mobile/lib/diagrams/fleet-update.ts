import type { Diagram } from "./types";

export const FLEET_UPDATE: Diagram = {
  id: "fleet-update",
  title: "Fleet Update",
  question: "Design a System to Push a Software Update to 500 Million Devices",
  sourceId: "patterns",
  itemId: 56,
  overview: {
    shape:
      "Two planes meet only on the device: a tiny control plane deciding who gets the update, and a data plane of enormous bytes with no opinion at all.",
    forces: [
      {
        constraint: "460M reachable devices at a ~25MB delta is ~11.5PB of egress per release",
        decision: "Duration becomes the only capacity knob: spread it over 14 days at ~76Gbps rather than 24 hours at ~1.1Tbps",
        lights: ["device-fleet", "cdn", "e3"],
      },
      {
        constraint: "A synchronised fleet checking in together is ~8.3M req/s against a jittered ~5,800 req/s",
        decision: "The Check-in service assigns each device a fully jittered next-check-in interval rather than a fixed schedule",
        lights: ["checkin", "e6", "e7"],
      },
      {
        constraint: "A 5% band with no recall is 25M devices committed to a build with no way back",
        decision: "The Rollout controller admits through a Band ladder that widens in six steps with a soak between each",
        lights: ["rollout-controller", "band-ladder", "e9"],
      },
      {
        constraint: "A 0.5 percentage point crash-rate regression has to be told apart from ordinary daily noise",
        decision: "The Health analyser compares each admitted cohort against a concurrent 1% holdback rather than last week's numbers",
        lights: ["health-analyser", "holdback", "e13"],
      },
      {
        constraint: "500M devices of mutable per-device state would be a compliance feature nobody asked for",
        decision: "Rollout state tracks cohorts, not individual devices, deriving cohort membership deterministically from the device token",
        lights: ["rollout-state", "rollout-controller"],
      },
    ],
    naive: {
      text: "Ship the full build straight from one origin to every device as soon as it is ready, and keep a row per device tracking whether it has updated yet. At ~120MB per device across 460M reachable devices that is ~55PB. Compressing delivery into a single day needs roughly 5.1Tbps of sustained bandwidth, which no CDN commits to on demand. A device told to update immediately also starts its download in the same few minutes as every other device, so the origin sees a synchronised spike rather than steady traffic. The Release pipeline replaces the full artifact with a ~17GB delta matrix, and the CDN pre-positions it at every edge before any band opens. The Rollout controller then staggers admission over days so downloads never arrive together.",
      lights: ["release-pipeline", "cdn", "rollout-controller"],
    },
    beats: [
      {
        text: "Do the arithmetic before drawing a box. About 460M reachable devices at a ~25MB delta is ~11.5PB of egress per release, which is ~76Gbps spread over 14 days, ~1.1Tbps compressed into 24 hours and ~4.3Tbps into 6. Nothing about the artifact changed, so duration is the capacity knob and every other decision is downstream of where you set it.",
        lights: ["device-fleet", "cdn", "e3"],
      },
      {
        text: "The release pipeline turns one build into a small matrix. One delta per source version per variant, capped at the versions covering ~90% of the fleet, with a full artifact for the tail. That is ~144 objects and ~17GB, small enough that every PoP holds the entire release. Cache hit rate is a rounding error from 100%, so this is an egress problem rather than a caching problem.",
        lights: ["release-pipeline", "artifact-store", "cdn", "e1", "e2"],
      },
      {
        text: "The control plane is where a naive design dies. Devices poll on a server-assigned, fully jittered schedule and 95% of calls answer 'nothing for you' in ~200 bytes with no write, which is ~5,800 req/s. The same fleet checking in during one synchronised minute is ~8.3M req/s, three orders of magnitude worse, so jitter is not a nicety, it is the load design.",
        lights: ["checkin", "e6", "e7"],
      },
      {
        text: "The rollout controller decides and the device obeys. A stable cohort assigned at first contact, bands admitting cohorts progressively, and a not_before timestamp that smears arrivals inside a band so admitting 1% is not a 5M-device spike. Then the device gates on unmetered, charging and idle, and those conditions are the real schedule: they are why a rollout takes days when the bytes would take hours.",
        lights: ["rollout-controller", "band-ladder", "device-fleet", "e5", "e7", "e9"],
      },
      {
        text: "The loop closes through a permanent 1% holdback that never receives anything. Crash rate moves for reasons that have nothing to do with your build. The analyser compares an admitted cohort against a concurrent never-updated one, and halts on effect size and significance together. Without the holdback an automatic halt is superstition, and a halt that fires on noise gets muted within a month.",
        lights: ["holdback", "health-analyser", "e13", "e14"],
      },
      {
        text: "Deliberately not built: no push channel, because polling reaches more devices than push and delivering a notification is not delivering an update. No peer assist, on the arithmetic. No per-device progress table, because 500M rows of mutable state buys a compliance feature nobody asked for when cohort-level accounting answers every real question.",
        lights: ["checkin", "cdn", "rollout-state"],
      },
    ],
    crux: {
      problem:
        "You cannot recall a device. Halting stops new devices from receiving the build but does nothing for devices that already took it. The only blast-radius control you own is how few devices were admitted at the moment you noticed.",
      handled:
        "The Band ladder keeps early admission small: 500,000 devices at 0.1%. A bad build discovered during soak strands only a small fraction of the fleet, not all of it. The Health analyser's under-30-minute halt SLO bounds how long a regression keeps admitting before the controller stops it. Nothing in the design repairs a device that already committed a bad update. Fixing that would need a second forced update cycle, which costs another full rollout.",
    },
    numbers: [
      {
        value: "11.5PB per release: ~76Gbps over 14 days, ~1.1Tbps over 24h",
        explain:
          "460M reachable devices × ~25MB delta ≈ 11.5PB. Spread over 14 days that is ~76Gbps average; compressed into 24 hours it is ~1.1Tbps, which sets how urgently a duration has to be chosen.",
      },
      {
        value: "~5,800 check-ins/s jittered against ~8.3M/s synchronised",
        explain:
          "500M devices at 1 check-in/day average ~5,800/s. If the whole fleet woke on the same schedule instead, the same total lands inside one minute: ~8.3M/s, roughly 1,400x worse.",
      },
      {
        value: "0.1% band = 500k devices, 5% = 25M, and there is no undo",
        explain:
          "The first band admits 500,000 devices; the fourth admits 25 million. Because halting cannot recall an update, the size of the smallest survivable mistake is set entirely by which band you were on when you noticed.",
      },
      {
        value: "~144 artifacts, ~17GB total against ~55PB of full builds",
        explain:
          "12 source versions x 12 variants = 144 signed deltas at ~25MB each, plus a full artifact for the tail: ~17GB total. That fits at every CDN edge, so pre-positioning removes the origin from the hot path entirely.",
      },
      {
        value: "time to halt SLO under 30 minutes",
        explain:
          "The Health analyser must detect a regression and the Rollout controller must stop admission inside 30 minutes of the effect becoming observable. Every extra minute of admission at a live band is thousands more devices with no way back.",
      },
    ],
  },
  nodes: [
    {
      id: "control-plane",
      label: "Control plane",
      sub: "tiny requests, huge request count",
      kind: "zone",
      detail: {
        what: "The half of the system that decides who gets the update and when: cohorts, bands, the halt switch and the endpoint devices actually talk to.",
        why: "Keeping the two planes independently deployable matters. The day you most need the control plane is the day the data plane is melting. The check-in path is the only channel that still reaches a device you have already broken.",
        numbers: [
          {
            value: "~5,800 req/s, ~1.2MB/s of responses",
            explain: "Steady-state check-in traffic at ~200 bytes per negative answer times ~5,800 req/s; this is the entire control plane's load.",
          },
          {
            value: "against 11.5PB on the data plane in the same release",
            explain:
              "The control plane's ~1.2MB/s sits many orders of magnitude below the data plane's petabyte-scale egress, which is why the two are deployed and scaled independently.",
          },
        ],
        breaks: {
          failure:
            "If the control plane is unavailable the check-in path serves a static 'nothing for you', which stalls the rollout silently rather than failing loudly.",
          handled:
            "Progress is alerted on directly: a flatlining admission rate pages on its own, since the failure mode produces no errors to trigger a standard alert.",
        },
        choice: {
          pick: "Control plane and data plane deployed and scaled independently",
          instead: "One service that both decides and serves bytes.",
          decider:
            "The two have nothing in common: ~5,800 req/s of ~200-byte answers against 11.5PB of immutable objects. The check-in tier needs 99.99% availability with an RTO of ~2 minutes, since it is the only remaining channel to a broken device. Coupling them means a CDN origin incident takes away your ability to halt.",
          flips: "A fleet small enough that one service serves both, roughly under a million devices, where the operational cost of two tiers outweighs the isolation.",
        },
      },
    },
    {
      id: "release-pipeline",
      label: "Release pipeline",
      sub: "delta matrix, bsdiff-style",
      kind: "service",
      col: 0,
      row: 0,
      detail: {
        what: "Takes one build and emits a matrix of signed deltas, one per (source version, variant) pair, plus a full artifact for the tail.",
        why: "Delta size sits linearly inside every number in this design: it multiplies the egress bill, the duration at fixed bandwidth and the time a device spends on someone else's connection. Halving 25MB to 12MB halves the release, which is why binary diffing is not a micro-optimisation here.",
        numbers: [
          {
            value: "12 source versions x 12 variants = 144 artifacts",
            explain: "Each of 12 live source versions gets a delta for each of 12 device variants; that product, not the fleet size, sets how many objects the pipeline emits.",
          },
          {
            value: "~25MB delta against a ~120MB full build",
            explain: "A delta patches only what changed since the source version, so it costs a fraction of the full artifact whatever the fleet size.",
          },
        ],
        breaks: {
          failure:
            "The matrix grows with the number of live source versions. A slow rollout policy feeds straight back into generation cost and cache dilution: 12x12 is fine, 40x20 is not.",
          handled:
            "Capping deltas at the versions covering ~90% of the fleet keeps the matrix bounded, whatever the tail of old versions grows to. Stragglers pay for a full-artifact download instead.",
        },
        choice: {
          pick: "Per-version binary deltas, capped at the versions covering ~90% of the fleet",
          instead: "Ship the full ~120MB artifact to every device.",
          decider:
            "460M x 25MB is ~11.5PB. The same fleet at ~120MB is ~55PB, roughly five times the bill and the duration. Google's file-by-file patching reported updates averaging 65% smaller than the full app, so a ~4.8x reduction is a defensible assumption rather than a hopeful one.",
          flips:
            "Devices with no prior version, and the long tail beyond the ~90% cap. Both are served the full artifact, because generating a delta for every ancient build costs more than the bytes it saves.",
        },
      },
    },
    {
      id: "artifact-store",
      label: "Signed artifact store",
      sub: "content addressed, immutable",
      kind: "database",
      col: 1,
      row: 0,
      detail: {
        what: "Object storage keyed by digest, holding the ~144 artifacts of a release with their signatures and index rows.",
        why: "Content addressing makes an artifact immutable by construction, which removes invalidation entirely and lets the whole release be pre-positioned at the edge before any band opens. The signature is what lets you serve those bytes over infrastructure you do not trust.",
        numbers: [
          { value: "~144 objects, ~17GB per release", explain: "The full delta matrix plus signatures and index rows; small enough that every edge PoP can hold the whole release at once." },
          {
            value: "RPO zero for artifacts and signing metadata",
            explain: "Once signed and published an artifact is immutable, so there is nothing to lose: any replica is byte-identical to the original, which is what RPO zero means here.",
          },
        ],
        breaks: {
          failure: "Signing key compromise. A system that can be induced to install arbitrary bytes on 500M devices is the most valuable target in the company.",
          handled: "Keys are short-lived and every verification chains to a pinned offline root, so a compromised signing key is rotated out rather than trusted indefinitely.",
        },
        choice: {
          pick: "Immutable content-addressed objects, signature verified on the device",
          instead: "Mutable named paths such as latest.bin, with TLS as the integrity story.",
          decider:
            "A ~17GB working set fits at every PoP, so immutability costs nothing and buys ~100% cache hit rate with no invalidation path at all. TLS only tells the device the CDN answered. A signature verified before apply tells the device the bytes are genuinely yours, which is the only claim worth making across a third-party edge.",
          flips: "Never for the artifact itself. Mutable pointers are fine for the release metadata the controller owns, which is precisely why that lives in the control plane and not here.",
        },
      },
    },
    {
      id: "cdn",
      label: "CDN edge PoPs",
      sub: "committed egress, ranged GETs",
      kind: "external",
      col: 2,
      row: 0,
      detail: {
        what: "A commodity CDN in front of the artifact store, holding the entire release at every PoP and streaming resumable ranges to devices.",
        why: "This is the easiest caching problem you will ever be given, because every device on earth wants the same dozen objects. The hard part is not hit rate, it is the bill, and the bill is set by the schedule the controller chose rather than by anything cache-shaped.",
        numbers: [
          {
            value: "~76Gbps average, ~230Gbps at diurnal peak",
            explain: "11.5PB spread over 14 days averages ~76Gbps; real traffic is not flat, so the diurnal peak runs roughly 3x that.",
          },
          {
            value: "~15k concurrent transfers at the 14-day pace",
            explain: "460M devices downloading over 14 days at ~40s per transfer works out to roughly 15,000 devices mid-download at any instant.",
          },
        ],
        breaks: {
          failure: "A cache miss storm when a band opens on a freshly published artifact.",
          handled: "Pre-position the ~17GB set at every PoP first and open bands on a schedule, never on release publish, so a band never meets a cold edge.",
        },
        choice: {
          pick: "Commodity CDN with committed egress, no peer assist in v1",
          instead: "Peer assisted distribution, with devices serving bytes to nearby devices.",
          decider:
            "Annual egress against build cost. 11.5PB at ~$0.01/GB is ~$115k a release, ~$700k over six releases. A 30% offload saves ~$200k against a subsystem that costs a year of a small team plus permanent operational surface. Below roughly 1PB per release it is never worth it.",
          flips:
            "Devices on shared unmetered networks, corporate LANs, campuses or set-top boxes behind one router, where Windows Delivery Optimization reports peers supplying 10% to 50% of update bytes. On consumer mobile it is indefensible, because you are spending someone else's data allowance to cut your own bill.",
        },
      },
    },
    {
      id: "update-client",
      label: "Update client",
      sub: "separately versioned track",
      kind: "service",
      col: 2,
      row: 1,
      detail: {
        what: "Your code on someone else's device: it checks in, evaluates conditions, fetches, verifies the digest and signature, applies the delta and stages the result.",
        why: "It is the last remaining channel to the device and the only component in this design whose failure is unrecoverable. Everything else can be fixed by shipping something new, but a device that cannot ask for an update cannot be given one.",
        numbers: [
          {
            value: "max 3 attempts, exponential backoff with full jitter",
            explain: "After 3 failed download attempts the client gives up until the next scheduled check-in rather than hammering the CDN in a tight retry loop.",
          },
        ],
        breaks: {
          failure: "Partial application leaving an inconsistent state.",
          handled:
            "A post-apply self-check reported on the next check-in is the detection, and staging before committing is the reason the device can fall back on its own.",
        },
        choice: {
          pick: "The updater is versioned separately and ships on its own slower track",
          instead: "One artifact containing both the payload and the client that applies it.",
          decider:
            "This is the single failure with no forward path across 500M devices. The detection signal is admitted cohorts' check-in rate falling below the holdback's, and by then those devices are silent for good. Every other failure in this design is recoverable by a roll-forward, so the asymmetry justifies a whole extra release track.",
          flips: "When the platform owns the updater, an OS-level update service for example, so the thing that performs the update is not yours to break in the first place.",
        },
      },
    },
    {
      id: "device-fleet",
      label: "500M devices",
      sub: "unmetered, charging, idle",
      kind: "external",
      col: 0,
      row: 1,
      detail: {
        what: "The fleet you do not own: a dozen live versions across hundreds of hardware variants, mostly offline at any given instant, in regions and price tiers you do not control.",
        why: "It is drawn explicitly because its conditions, not your bandwidth, set the schedule. A device cooperates only when it is on an unmetered network, charging and idle. That eligibility funnel turns a few hours of bytes into a fortnight of rollout.",
        numbers: [
          {
            value: "~8% unreachable in a 14-day window, so ~460M reachable",
            explain: "Some devices are offline, decommissioned or never satisfy the eligibility conditions in any given window; 460M of 500M is what the whole design is sized against.",
          },
          { value: "1 check-in per device per day", explain: "The average polling cadence; it is what turns 500M devices into ~5,800 check-ins/s rather than a bursty, unpredictable load." },
        ],
        breaks: {
          failure: "Conditions that are never satisfied.",
          handled:
            "Devices that are never unmetered or never charged overnight simply never become eligible. That is why rollouts plateau around 78%, and why 'rolled out to 100%' is a fiction.",
        },
      },
    },
    {
      id: "checkin",
      label: "Check-in service",
      sub: "anycast, 95% answer empty",
      kind: "service",
      col: 2,
      row: 2,
      parent: "control-plane",
      detail: {
        what: "The stateless endpoint devices poll: it reads rollout state for the device's cohort and answers either empty or an artifact URL with a not_before timestamp.",
        why: "It must be the most boring and most available service you operate, because it is the only channel to a device once that device is broken. It never writes on the negative path and never depends on the release pipeline being healthy.",
        numbers: [
          {
            value: "~5,800 req/s average, ~17k/s at peak",
            explain: "Steady-state polling load and its diurnal peak; this is the entire number the service has to be provisioned for, since it never writes on the negative path.",
          },
          {
            value: "~200 byte negative, ~3ms cohort read",
            explain: "The dominant response is a tiny empty answer built from one fast cohort-state read, which is why this service scales far more cheaply than its request count implies.",
          },
        ],
        breaks: {
          failure: "Fleet resynchronisation after a correlated event. A carrier outage returning 40M devices at once produces a spike orders of magnitude above baseline.",
          handled: "The fix sheds load with a cheap empty answer rather than an error, because an error triggers a client retry that makes the spike worse.",
        },
        choice: {
          pick: "Jittered polling with a server-assigned next check-in interval",
          instead: "A push channel that tells devices an update is waiting, or a client-chosen fixed interval.",
          decider:
            "~5,800 req/s jittered against ~8.3M req/s if the fleet ever checks in together, and ~139k/s if every device picks a fixed local hour. Push reachability is also strictly worse than polling reachability: a device that is off misses a push permanently but will poll when it wakes.",
          flips:
            "Urgent security releases, where push earns its place as an accelerant that wakes devices to poll sooner. It never becomes the delivery mechanism, because then the progress metric quietly becomes 'notifications sent'.",
        },
      },
    },
    {
      id: "rollout-controller",
      label: "Rollout controller",
      sub: "cohorts, bands, halt switch",
      kind: "service",
      col: 0,
      row: 2,
      parent: "control-plane",
      detail: {
        what: "The single place that answers 'does this device get it, and when': it assigns cohorts, opens bands under policy, sets conditions and owns the halt.",
        why: "Concentrating the decision server-side means 500M devices never decide anything for themselves, so you retain the ability to change your mind after the release has shipped. That ability is the whole point, given that the devices themselves have no undo.",
        numbers: [
          {
            value: "cohort = token % 1000, stable for the life of the device",
            explain: "Assignment is deterministic from the device's own token, so cohort membership never needs to be looked up anywhere beyond a modulo.",
          },
          {
            value: "halt is one write the check-in tier reads on its normal path",
            explain: "Halting changes no code path, only a value the check-in tier already reads on every request, which is why it works even when everything else is broken.",
          },
        ],
        breaks: {
          failure: "Losing the ability to halt while a bad build is admitting.",
          handled: "The halt path is kept independent of the analyser and the release pipeline for exactly that reason, and it is rehearsed quarterly.",
        },
        choice: {
          pick: "Server-assigned stable cohorts, admitted in bands by the controller",
          instead: "The device hashes its own id against the target version and self-selects.",
          decider:
            "Whether you will ever need to change your mind, weighed against a lookup on ~5,800 req/s that already happens. Server assignment buys halt, per-variant exclusion and re-targeting. Self-hashing costs nothing and gives you none of that, and halting then means shipping new policy to devices that must first come and ask for it.",
          flips: "A fully static, air-gapped or extremely cheap distribution model where the check-in path must work with zero backend state at all.",
        },
      },
    },
    {
      id: "band-ladder",
      label: "Band ladder",
      sub: "0.1 -> 1 -> 5 -> 20 -> 50 -> 100%",
      kind: "database",
      col: 1,
      row: 2,
      parent: "control-plane",
      detail: {
        what: "The ladder as data rather than as a runbook: one row per band with the admitted cohort ceiling, minimum soak, smear window and status.",
        why: "Since halt is not rollback, the ladder is the only blast-radius control that exists. Every band is a bet on how many devices you are willing to strand on a bad build. Expressing it as rows means a widen is an auditable write rather than someone's judgement at 2am.",
        numbers: [
          {
            value: "0.1% = 500k devices, 1% = 5M, 5% = 25M",
            explain: "The ladder's early rungs, in absolute devices: this is the actual blast radius each band represents, not the percentage.",
          },
          {
            value: "soak ~24h on the early bands",
            explain: "Each early band waits roughly a day of real device usage before widening, long enough for a crash-rate regression to show up in the health analyser.",
          },
        ],
        breaks: {
          failure: "Widening on a signal that has not had time to appear.",
          handled: "Soak is expressed in device-usage-hours rather than wall clock, so a band cannot pass before it has actually been exercised by enough devices.",
        },
        choice: {
          pick: "Start at 0.1% with a ~24h soak, widen 1 / 5 / 20 / 50 / 100",
          instead: "Start at 5%, which still sounds small, and move faster.",
          decider:
            "5% of 500M is 25 million devices with no recall, against 500,000 at 0.1%. The statistics do not need the bigger number: a 0.5-point crash-rate regression is clearly significant against a 500k cohort within a day of usage. You are paying 24 hours to cut the blast radius 50x.",
          flips:
            "A metric so rare that 500k devices cannot produce enough events. In that case, pick a leading indicator measurable at 500k rather than gambling 25 million devices on it.",
        },
      },
    },
    {
      id: "rollout-state",
      label: "Rollout state",
      sub: "Postgres releases + KV cohorts",
      kind: "database",
      col: 2,
      row: 3,
      parent: "control-plane",
      detail: {
        what: "Release and band rows in Postgres, plus a KV keyed by device holding cohort, holdback flag, variant, region and carrier hash.",
        why: "The check-in path reads this on every call and is overwhelmingly read-only, so regional replicas serve the ~95% negative locally. Writes are release-shaped, a handful per day, which is why the two halves live in different stores.",
        numbers: [
          { value: "~144 artifact rows per release", explain: "One row per signed artifact in the release matrix; small enough that the release table is never the bottleneck." },
          {
            value: "cohort read on ~5,800 req/s, writes per band open",
            explain: "Reads happen on every check-in; writes happen only a handful of times a day, when a band opens, which is why the two live in different stores.",
          },
        ],
        breaks: {
          failure: "Regional and carrier concentration.",
          handled:
            "Cohorts are not evenly distributed across networks, so a band admitted purely by cohort id can hand one carrier a disproportionate share unless admission is weighted by network and region.",
        },
        choice: {
          pick: "Cohort-level state, with cohorts derived deterministically from the device token",
          instead: "A per-device progress table tracking what each of 500M devices has.",
          decider:
            "500M rows of mutable state buys a compliance feature nobody asked for, and cohort-level accounting answers every question you actually have. Deriving the cohort from the token also makes assignments regenerable, so their RPO is not zero and losing the KV is survivable.",
          flips: "A hard compliance deadline, which genuinely requires per-device accounting and an escalation path and turns a fire-and-forget system into one that chases individual stragglers.",
        },
      },
    },
    {
      id: "telemetry",
      label: "Telemetry ingest",
      sub: "1% success, failures whole",
      kind: "queue",
      col: 3,
      row: 2,
      detail: {
        what: "The append-only stream of apply outcomes, batched onto the next check-in rather than sent the moment an update lands.",
        why: "500M immediate acknowledgements is a self-inflicted denial of service, and failures cluster exactly when the system is already unhappy. Piggybacking on a call that already exists removes an entire ingest spike from the design.",
        numbers: [
          { value: "~1.4B events per release, ~280GB raw", explain: "Roughly 3 events per updated device times ~460M devices; the size the ingest pipeline would carry without sampling." },
          {
            value: "~30GB after sampling success at 1%",
            explain: "Sampling success events at 1% while keeping every failure whole cuts the volume by roughly 90% without losing the signal a halt decision would cite.",
          },
        ],
        breaks: {
          failure: "Sampled success makes precise progress accounting impossible.",
          handled: "This is fine until someone asks for a compliance number. Progress is read from the unsampled check-in version census instead, which stays exact regardless of sampling.",
        },
        choice: {
          pick: "Sample success at 1%, keep every failure, report on the next check-in",
          instead: "Report immediately and keep every event.",
          decider:
            "~1.4B events at ~200B is ~280GB per release and drops to ~30GB while losing nothing that matters, because success events are interchangeable and failure events are not. Delaying the report to the next check-in also removes a 460M-message spike aligned with the band you just opened.",
          flips: "A release small enough that the whole event stream is cheap, where full fidelity on success is worth having for latency and quality analysis.",
        },
      },
    },
    {
      id: "health-analyser",
      label: "Health analyser",
      sub: "effect size + significance",
      kind: "service",
      col: 3,
      row: 3,
      detail: {
        what: "A stream job computing crash rate, battery and engagement per admitted cohort bucket against the holdback, with confidence intervals, and driving widen or halt.",
        why: "A halt has to be a statement rather than a vibe. Comparing an admitted cohort against last week compares against a different world, so the analyser only ever works on a difference against a concurrent population.",
        numbers: [
          {
            value: "time to halt SLO under 30 minutes",
            explain: "The maximum time allowed between a regression becoming observable and admission stopping; every extra minute here is measured in newly admitted devices.",
          },
          {
            value: "1 of 12 variants can regress invisibly in a fleet average",
            explain: "A hardware-specific regression on one of 12 variants can be diluted below the noise floor of a fleet-wide average, so the analyser scores per variant, not just overall.",
          },
        ],
        breaks: {
          failure: "Halting on noise.",
          handled: "An analyser that fires weekly gets muted within a month, and a muted halt is worse than no halt because everyone believes it is still protecting them.",
        },
        choice: {
          pick: "Automatic halt requiring both effect size and significance, evaluated per variant",
          instead: "A dashboard threshold on the fleet-wide aggregate that a human watches.",
          decider:
            "Every minute between a regression becoming observable and admission stopping is measured in devices, so the SLO is under 30 minutes and no human meets it reliably at 3am. Fleet aggregates also hide a variant-specific fire: one broken hardware variant is invisible in a number averaged across twelve.",
          flips: "The first few releases, before you have enough history to know what a normal delta looks like, where an automatic halt would mostly be firing on your own ignorance.",
        },
      },
    },
    {
      id: "holdback",
      label: "1% holdback",
      sub: "5M devices, never admitted",
      kind: "database",
      col: 3,
      row: 4,
      detail: {
        what: "A permanent cohort, roughly 1% of the fleet, that receives no release at all and exists purely as a concurrent baseline.",
        why: "Crash rate, battery drain and engagement all move for reasons that have nothing to do with your build. A concurrent holdback controls for the day, the weather, the football and the third-party outage in a way that last week's numbers cannot.",
        numbers: [
          {
            value: "~1% of 500M = ~5M devices",
            explain: "The holdback's size; large enough to produce statistically meaningful crash-rate and engagement comparisons against an admitted cohort of similar size.",
          },
          { value: "membership rotates once per release", explain: "The cohort is permanent but its members change each release, so no single device is stuck a version behind forever." },
        ],
        breaks: {
          failure: "A static holdback strands the same devices on an old version forever.",
          handled: "Membership rotates every release while the 1% cohort itself stays permanent, so the baseline keeps working without permanently penalising any one device.",
        },
        choice: {
          pick: "A permanent 1% holdback with rotating membership",
          instead: "No holdback, comparing the admitted cohort against the previous week's baseline.",
          decider:
            "5M devices experiencing the same day is the only way to attribute a 0.4 percentage point crash-rate move to the build rather than to the world. Without it every automatic halt is a coin toss, and the cost is 1% of the fleet running one version behind for one release.",
          flips: "Fleets small enough that 1% cannot produce statistically meaningful event counts, where a longer soak on a larger admitted band is the only comparison available.",
        },
      },
    },
  ],
  edges: [
    {
      id: "e1",
      from: "release-pipeline",
      to: "artifact-store",
      tier: "data",
      label: "144 signed artifacts",
      detail: {
        what: "The generated delta matrix being written as content-addressed objects with their signatures and index rows.",
        why: "Signing happens once, at build time, in the pipeline that already has the keys. Everything downstream, including the CDN, then handles bytes it is not trusted to alter, because the device verifies before it applies.",
        numbers: [{ value: "~144 objects, ~17GB per release", explain: "The full signed delta matrix landing in one write, ready for the CDN to pre-position at every edge." }],
        breaks: {
          failure: "If the pipeline can be induced to sign arbitrary bytes, every control below this line is decorative.",
          handled: "Signing keys are short-lived and rooted offline, so a compromised build key expires quickly rather than remaining a standing risk.",
        },
      },
    },
    {
      id: "e2",
      from: "artifact-store",
      to: "cdn",
      tier: "data",
      label: "pre-position ~17GB",
      detail: {
        what: "The whole release being pushed to every PoP before any band opens.",
        why: "The working set is ~17GB, so pre-positioning is cheap and removes the origin entirely from the hot path. Opening a band against a cold edge instead turns the first minute of a rollout into an origin request storm.",
        numbers: [
          { value: "~17GB per release", explain: "The whole release, pushed to every PoP in one pass before any device is told it exists." },
          { value: "edge hit ratio SLO above 99%", explain: "With the full release resident at every PoP, almost every device request should be an edge hit rather than an origin fetch." },
        ],
        breaks: {
          failure: "Opening a band on release publish rather than on a schedule is exactly the mistake this edge exists to prevent.",
          handled: "The symptom is an origin spike that looks like a CDN fault, which pre-positioning removes by guaranteeing every PoP already has the bytes before a band can open.",
        },
      },
    },
    {
      id: "e3",
      from: "cdn",
      to: "update-client",
      tier: "hot",
      step: 3,
      label: "25MB delta, ranged GET",
      detail: {
        what: "The actual payload transfer: ~25MB streamed with resumable ranges to a device that has decided it is allowed to spend the bandwidth.",
        why: "This is where the entire 11.5PB lives, and it is deliberately the dumbest hop in the system. The CDN knows nothing about cohorts, bands or halt, so a decision made in the control plane never has to propagate through a cache.",
        numbers: [
          {
            value: "~25MB per device, ~40s at ~5Mbps",
            explain: "One delta transfer at a typical mobile speed; this is the actual bandwidth cost, everything else in the design is about when it happens.",
          },
          { value: "~380 devices/s starting a download at the 14-day pace", explain: "460M devices spread over 14 days averages to roughly 380 new downloads starting every second." },
        ],
        breaks: {
          failure: "Corrupt or truncated artifacts.",
          handled: "The device refuses on a digest mismatch and re-requests with backoff, and it never applies unverified bytes no matter how many times it fails.",
        },
      },
    },
    {
      id: "e4",
      from: "update-client",
      to: "device-fleet",
      tier: "hot",
      step: 4,
      label: "verify, stage, commit",
      detail: {
        what: "Digest and signature verification, then applying the delta and staging the result before committing it. It ends in one of four outcomes: applied, failed to verify, failed to apply, or rolled back.",
        why: "Stage-then-commit is the only rollback that exists anywhere in this design, and it is local to the device. Once the commit lands there is no remote mechanism to undo it, which is the fact the entire band ladder is built around.",
        numbers: [{ value: "4 possible outcomes per attempt", explain: "Applied, failed to verify, failed to apply, or rolled back; every attempt ends in exactly one of these four." }],
        breaks: {
          failure: "A partial apply that leaves an inconsistent state, visible only on the next check-in.",
          handled: "The device keeps the ability to fall back to its prior state on its own, without waiting for a server decision, because it may already be unreachable.",
        },
      },
    },
    {
      id: "e5",
      from: "device-fleet",
      to: "update-client",
      tier: "control",
      label: "unmetered, charging, idle",
      offset: 70,
      detail: {
        what: "The device's own state, evaluated after the server has said yes but before a single byte is requested.",
        why: "Conditions are what stop you spending someone else's data allowance, and they are also the real pacing mechanism: unmetered network, charging, and idle, all three at once. The bytes would take hours; the conditions are why it takes a fortnight.",
        numbers: [{ value: "3 conditions must hold at once", explain: "Unmetered, charging and idle all have to be true simultaneously before a single byte is requested; any one missing blocks the download entirely." }],
        breaks: {
          failure: "Devices that never satisfy them never update, and they are concentrated in particular regions and price tiers.",
          handled:
            "The admitted-to-eligible step is where a plateaued rollout is almost always diagnosed, since the gap is conditions never being met rather than anything the control plane did wrong.",
        },
      },
    },
    {
      id: "e6",
      from: "update-client",
      to: "checkin",
      tier: "hot",
      step: 1,
      label: "~200B fingerprint",
      detail: {
        what: "The poll: current version, variant, region and rollout token, sent on a server-assigned schedule with full jitter.",
        why: "Devices must ask before they can receive, so this is the request that happens 500M times a day whether or not a release exists. It is also, unsampled, the census that tells you the true version distribution across the fleet.",
        numbers: [
          {
            value: "~5,800 req/s jittered, ~8.3M/s if synchronised",
            explain: "The gap between a fully jittered schedule and every device polling at once; jitter is roughly three orders of magnitude of headroom.",
          },
          {
            value: "sleep(random(0, interval)), not interval/2 + random",
            explain: "Jittering the whole interval spreads devices flat across it; jittering only half the interval still leaves a visible clump at the midpoint.",
          },
        ],
        breaks: {
          failure: "Equal jitter is not enough after a mass event.",
          handled: "A carrier outage or a power cut resynchronises the fleet, and only full jitter across the whole interval spreads the returning wave flat again.",
        },
      },
    },
    {
      id: "e7",
      from: "checkin",
      to: "update-client",
      tier: "hot",
      step: 2,
      label: "none, or url + not_before",
      offset: 60,
      detail: {
        what: "The answer: usually empty, and when it is not, an artifact URL, digest, signature, conditions and a not_before timestamp minutes to hours out. Every response, empty or not, also carries the next check-in interval.",
        why: "It carries a time rather than a yes, and that is the whole trick. Admitting a 1% band is admitting 5M devices. If they all acted on their next check-in, that is a 5M-device spike against the CDN and telemetry at once.",
        numbers: [{ value: "~95% of responses are empty, at ~200 bytes", explain: "Only about 1 in 20 check-ins gets a real answer; the rest is the cost of finding out nothing has changed." }],
        breaks: {
          failure: "A client with a hardcoded interval is a client you cannot slow down.",
          handled: "The interval always comes from the server, even when the answer is empty, so the controller retains the ability to slow the whole fleet down.",
        },
      },
    },
    {
      id: "e8",
      from: "checkin",
      to: "rollout-state",
      tier: "control",
      label: "cohort + holdback flag",
      detail: {
        what: "The lookup behind every check-in: which cohort this device is in, whether it is in the holdback, and which band is currently open.",
        why: "It is a single-key read served by a regional replica, which is what keeps the negative path from ever touching the release database. The halt switch is read here too, on the same normal path, so halting works when everything upstream is broken.",
        numbers: [
          {
            value: "~3ms per read",
            explain: "A single-key cohort-state lookup served from a regional replica; fast enough that it never becomes the bottleneck at ~5,800 req/s.",
          },
          {
            value: "read replicas serve the ~95% negative locally",
            explain: "Almost every check-in resolves to 'nothing for you' from a local replica, so the vast majority of load never crosses a region.",
          },
        ],
        breaks: {
          failure: "If this read ever becomes a write, the check-in path stops being trivially scalable.",
          handled: "Keeping it read-only and independent of the release pipeline means the most available service in the system never inherits the availability of a less available one.",
        },
      },
    },
    {
      id: "e9",
      from: "rollout-controller",
      to: "band-ladder",
      tier: "control",
      label: "opens the next band",
      detail: {
        what: "The controller advancing the ladder: a write that raises the admitted cohort ceiling and stamps the band's open time.",
        why: "Every widen is a deliberate, auditable decision about how many devices you are prepared to strand. That is why it is a row in a table, rather than a config push or a runbook step.",
        numbers: [{ value: "0.1% -> 1% -> 5% -> 20% -> 50% -> 100%", explain: "The full ladder; each widen is a separate audited write, never a jump to a later rung." }],
        breaks: {
          failure: "Opening a band before its predecessor has soaked long enough in real device usage means the ladder is theatre.",
          handled: "Soak is measured in device-usage-hours, so a band cannot advance until enough devices have actually run it long enough to surface a regression.",
        },
      },
    },
    {
      id: "e10",
      from: "band-ladder",
      to: "rollout-state",
      tier: "control",
      label: "admitted_cohort_max",
      detail: {
        what: "The current band's cohort ceiling and smear window landing where the check-in path can read it.",
        why: "This is the join between policy and traffic. The check-in tier does not evaluate a rollout plan, it compares one integer, which is what keeps a 5,800 req/s path free of any release logic.",
        numbers: [
          {
            value: "cohort = token % 1000, admitted if cohort < ceiling",
            explain: "The single comparison the check-in path makes; it is why a 5,800 req/s service can stay free of any rollout logic beyond one integer test.",
          },
        ],
        breaks: {
          failure: "Admitting purely on cohort id ignores that cohorts are not evenly spread across carriers and regions.",
          handled: "A band can quietly hand one network far more than its share unless admission is weighted by network and region rather than cohort id alone.",
        },
      },
    },
    {
      id: "e11",
      from: "checkin",
      to: "telemetry",
      tier: "data",
      label: "outcomes on next check-in",
      detail: {
        what: "Apply outcomes and version fingerprints riding along on a call that was going to happen anyway.",
        why: "Reporting immediately would mean 460M messages arriving in the shape of the band you just opened. Batching onto the next check-in spreads the reporting load across the same jitter that already spreads the requests.",
        numbers: [
          { value: "~3 events per device per update", explain: "Download start, apply outcome and a post-apply self-check, batched onto the next check-in rather than sent immediately." },
          { value: "~1.4B events per release", explain: "~460M devices x ~3 events each; this is the volume the telemetry ingest path is sized for." },
        ],
        breaks: {
          failure: "Outcome reporting lags the actual apply by up to one check-in interval.",
          handled: "Progress dashboards trail reality by hours, which someone will read as a stall unless the lag itself is a labelled, expected property of the design.",
        },
      },
    },
    {
      id: "e12",
      from: "telemetry",
      to: "health-analyser",
      tier: "data",
      label: "1% success, all failures",
      detail: {
        what: "The sampled outcome stream feeding cohort health metrics: crash rate, battery, engagement, bucketed by cohort and variant.",
        why: "Failures are kept whole because they are the signal, and successes are sampled because they are interchangeable. That asymmetry cuts ~280GB to ~30GB per release without losing anything a halt decision would cite.",
        numbers: [{ value: "~30GB per release after sampling", explain: "Sampling success at 1% while keeping every failure whole; the size the health analyser actually ingests per release." }],
        breaks: {
          failure: "Failures cluster exactly when the system is already unhappy.",
          handled: "The ingest path has to survive a correlated burst that arrives precisely when it is most needed, which is why failures are never sampled while successes are.",
        },
      },
    },
    {
      id: "e13",
      from: "health-analyser",
      to: "holdback",
      tier: "control",
      label: "vs never-updated 5M",
      detail: {
        what: "The comparison that makes a halt decision defensible: admitted cohort metrics against the concurrent never-updated population.",
        why: "It controls for everything that is not your build. The same day, the same third-party outage, the same weather, so the difference is attributable and comes with a confidence interval instead of a hunch.",
        numbers: [
          {
            value: "2 conditions: effect size past a threshold and 95% confidence",
            explain: "A halt requires both a large enough gap and enough confidence that the gap is real, so a noisy but tiny difference never triggers it alone.",
          },
        ],
        breaks: {
          failure: "The most important comparison here is not crash rate but check-in rate.",
          handled:
            "Admitted cohorts checking in less than the holdback is the signature of a release that broke the update client itself, since a silent device reports nothing else at all.",
        },
      },
    },
    {
      id: "e14",
      from: "health-analyser",
      to: "rollout-controller",
      tier: "control",
      label: "widen or halt",
      offset: 90,
      detail: {
        what: "The feedback that closes the loop: either the band has soaked cleanly and may widen, or admission stops immediately.",
        why: "This is the only lever anyone has once a build is out, and it is deliberately asymmetric. Widening is a scheduled decision with a soak behind it; halting is a single write that takes effect on the next check-in of every device.",
        numbers: [{ value: "time to halt SLO under 30 minutes", explain: "The same SLO that bounds the analyser; this edge is where that decision actually reaches the controller and takes effect." }],
        breaks: {
          failure: "Halt stops admission and does nothing else.",
          handled: "The devices that already took the build keep it, so this arrow bounds future damage and repairs none of the damage already done.",
        },
      },
    },
  ],
};
