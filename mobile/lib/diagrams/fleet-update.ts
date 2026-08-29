import type { Diagram } from "./types";

export const FLEET_UPDATE: Diagram = {
  id: "fleet-update",
  title: "Fleet Update",
  question: "Design a System to Push a Software Update to 500 Million Devices",
  sourceId: "patterns",
  itemId: 56,
  overview: {
    shape:
      "Two planes that meet only on the device: a control plane of tiny check-in requests that decides who gets the update and when, and a data plane of enormous immutable bytes that has no opinion about anything.",
    beats: [
      {
        text: "Do the arithmetic before drawing a box. About 460M reachable devices at a ~25MB delta is ~11.5PB of egress per release, which is ~76Gbps spread over 14 days, ~1.1Tbps compressed into 24 hours and ~4.3Tbps into 6. Nothing about the artifact changed, so duration is the capacity knob and every other decision is downstream of where you set it.",
        lights: ["device-fleet", "cdn", "e3"],
      },
      {
        text: "The release pipeline turns one build into a small matrix: one delta per source version per variant, capped at the versions covering ~90% of the fleet, with a full artifact for the tail. That is ~144 objects and ~17GB, small enough that every PoP holds the entire release. Cache hit rate is a rounding error from 100%, so this is an egress problem rather than a caching problem.",
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
        text: "The loop closes through a permanent 1% holdback that never receives anything. Crash rate moves for reasons that have nothing to do with your build, so the analyser compares an admitted cohort against a concurrent never-updated one and halts on effect size and significance together. Without the holdback an automatic halt is superstition, and a halt that fires on noise gets muted within a month.",
        lights: ["holdback", "health-analyser", "e13", "e14"],
      },
      {
        text: "Deliberately not built: no push channel, because polling reaches more devices than push and delivering a notification is not delivering an update. No peer assist, on the arithmetic. No per-device progress table, because 500M rows of mutable state buys a compliance feature nobody asked for when cohort-level accounting answers every real question.",
        lights: ["checkin", "cdn", "rollout-state"],
      },
    ],
    crux:
      "You cannot recall a device. Halting stops new devices receiving the build and does precisely nothing for the ones that already took it, so the only blast-radius control you own is how few devices you had admitted at the moment you noticed.",
    numbers: [
      "11.5PB per release: ~76Gbps over 14 days, ~1.1Tbps over 24h",
      "~5,800 check-ins/s jittered against ~8.3M/s synchronised",
      "0.1% band = 500k devices, 5% = 25M, and there is no undo",
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
        why: "It carries almost no bytes and an enormous number of requests, which is the exact inverse of the data plane. Keeping the two independently deployable matters because the day you most need the control plane is the day the data plane is melting, and the check-in path is the only channel that still reaches a device you have already broken.",
        numbers: ["~5,800 req/s, ~1.2MB/s of responses", "against 11.5PB on the data plane"],
        breaks:
          "If the control plane is unavailable the check-in path serves a static 'nothing for you', which stalls the rollout silently rather than failing loudly, so you have to alert on progress flatlining.",
        choice: {
          pick: "Control plane and data plane deployed and scaled independently",
          instead: "One service that both decides and serves bytes.",
          decider:
            "The two have nothing in common: ~5,800 req/s of ~200 byte answers against 11.5PB of immutable objects, and the check-in tier needs 99.99% availability with an RTO of ~2 minutes because it is the only remaining channel to a broken device. Coupling them means a CDN origin incident takes away your ability to halt.",
          flips:
            "A fleet small enough that one service serves both, roughly under a million devices, where the operational cost of two tiers outweighs the isolation.",
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
        numbers: ["12 source versions x 12 variants = 144 artifacts", "~25MB delta against a ~120MB full build"],
        breaks:
          "The matrix grows with the number of live versions, so a slow rollout policy feeds straight back into generation cost and cache dilution: 12 x 12 is fine, 40 x 20 is not.",
        choice: {
          pick: "Per-version binary deltas, capped at the versions covering ~90% of the fleet",
          instead: "Ship the full ~120MB artifact to every device.",
          decider:
            "460M x 25MB is ~11.5PB; the same fleet at ~120MB is ~55PB and roughly five times the bill and the duration. Google's file-by-file patching reported updates averaging 65% smaller than the full app, so a ~4.8x reduction is a defensible assumption rather than a hopeful one.",
          flips:
            "Devices with no prior version, and the long tail beyond the ~90% cap, which are served the full artifact because generating a delta for every ancient build costs more than the bytes it saves.",
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
        numbers: ["~144 objects, ~17GB per release", "RPO zero for artifacts and signing metadata"],
        breaks:
          "Signing key compromise. A system that can be induced to install arbitrary bytes on 500M devices is the most valuable target in the company, so keys are short-lived and verified against a pinned offline root.",
        choice: {
          pick: "Immutable content-addressed objects, signature verified on the device",
          instead: "Mutable named paths such as latest.bin, with TLS as the integrity story.",
          decider:
            "A ~17GB working set fits at every PoP, so immutability costs nothing and buys ~100% cache hit rate with no invalidation path at all. TLS only tells the device the CDN answered; a signature verified before apply tells it the bytes are yours, which is the only claim worth making across a third-party edge.",
          flips:
            "Never for the artifact itself. Mutable pointers are fine for the release metadata the controller owns, which is precisely why that lives in the control plane and not here.",
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
        numbers: ["~76Gbps average, ~230Gbps at diurnal peak", "~15k concurrent transfers at the 14-day pace"],
        breaks:
          "A cache miss storm when a band opens on a freshly published artifact. Pre-position the ~17GB set at every PoP first and open bands on a schedule, never on release publish.",
        choice: {
          pick: "Commodity CDN with committed egress, no peer assist in v1",
          instead: "Peer assisted distribution, with devices serving bytes to nearby devices.",
          decider:
            "Annual egress against build cost. 11.5PB at ~$0.01/GB is ~$115k a release, ~$700k over six releases, and a 30% offload saves ~$200k against a subsystem that is comfortably a year of a small team plus permanent operational surface. Below roughly 1PB per release it is never worth it.",
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
        numbers: ["max 3 attempts, exponential backoff with full jitter"],
        breaks:
          "Partial application leaving an inconsistent state. A post-apply self-check reported on the next check-in is the detection, and staging before committing is the reason the device can fall back on its own.",
        choice: {
          pick: "The updater is versioned separately and ships on its own slower track",
          instead: "One artifact containing both the payload and the client that applies it.",
          decider:
            "This is the single failure with no forward path across 500M devices. The detection signal is that admitted cohorts' check-in rate falls below the holdback's, and by then those devices are silent for good; every other failure in this design is recoverable by a roll-forward, so the asymmetry justifies a whole extra release track.",
          flips:
            "When the platform owns the updater, an OS-level update service for example, so the thing that performs the update is not yours to break in the first place.",
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
        why: "It is drawn explicitly because its conditions, not your bandwidth, set the schedule. A device cooperates only when it is on an unmetered network, charging and idle, and that eligibility funnel is what turns a few hours of bytes into a fortnight of rollout.",
        numbers: ["~8% unreachable in a 14-day window, so ~460M reachable", "1 check-in per device per day"],
        breaks:
          "Conditions that are never satisfied. Devices that are never unmetered or never charged overnight simply never become eligible, which is why rollouts plateau at 78% and why 'rolled out to 100%' is a fiction.",
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
        numbers: ["~5,800 req/s average, ~17k/s at peak", "~200 byte negative, ~3ms cohort read"],
        breaks:
          "Fleet resynchronisation after a correlated event. A carrier outage returning 40M devices at once produces a spike orders of magnitude above baseline, and the fix is to shed load with a cheap empty answer rather than an error, because an error triggers a retry.",
        choice: {
          pick: "Jittered polling with a server-assigned next check-in interval",
          instead: "A push channel that tells devices an update is waiting, or a client-chosen fixed interval.",
          decider:
            "~5,800 req/s jittered against ~8.3M req/s if the fleet ever checks in together, and ~139k/s if every device picks a fixed local hour. Push reachability is also strictly worse than polling reachability: a device that is off misses a push permanently but will poll when it wakes.",
          flips:
            "Urgent security releases, where push earns its place as an accelerant that wakes devices to poll sooner, but never as the delivery mechanism, because then your progress metric quietly becomes 'notifications sent'.",
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
        numbers: ["cohort = token % 1000, stable for the life of the device", "halt is one write the check-in tier reads on its normal path"],
        breaks:
          "Losing the ability to halt while a bad build is admitting. The halt path is kept independent of the analyser and the release pipeline for exactly that reason, and rehearsed quarterly.",
        choice: {
          pick: "Server-assigned stable cohorts, admitted in bands by the controller",
          instead: "The device hashes its own id against the target version and self-selects.",
          decider:
            "Whether you will ever need to change your mind, weighed against a lookup on ~5,800 req/s that already happens. Server assignment buys halt, per-variant exclusion and re-targeting; self-hashing costs nothing and gives you none of it, and halting then means shipping new policy to devices that must first come and ask for it.",
          flips:
            "A fully static, air-gapped or extremely cheap distribution model where the check-in path must work with zero backend state at all.",
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
        why: "Since halt is not rollback, the ladder is the only blast-radius control that exists. Every band is a bet on how many devices you are willing to strand on a bad build, and expressing it as rows means a widen is an auditable write rather than someone's judgement at 2am.",
        numbers: ["0.1% = 500k devices, 1% = 5M, 5% = 25M", "soak ~24h on the early bands"],
        breaks:
          "Widening on a signal that has not had time to appear. Soak has to be expressed in device-usage-hours rather than wall clock, or you pass a band that nobody has actually exercised yet.",
        choice: {
          pick: "Start at 0.1% with a ~24h soak, widen 1 / 5 / 20 / 50 / 100",
          instead: "Start at 5%, which still sounds small, and move faster.",
          decider:
            "5% of 500M is 25 million devices with no recall against 500,000 at 0.1%, and the statistics do not need the bigger number: a 0.5 percentage point crash-rate regression is clearly significant against a 500k cohort within a day of usage. You are paying 24 hours to cut the blast radius 50x.",
          flips:
            "A metric so rare that 500k devices cannot produce enough events, in which case pick a leading indicator you can measure at 500k rather than gambling 25 million devices on it.",
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
        numbers: ["~144 artifact rows per release", "cohort read on ~5,800 req/s, writes per band open"],
        breaks:
          "Regional and carrier concentration. Cohorts are not evenly distributed across networks, so a band admitted purely by cohort id can hand one carrier a disproportionate share unless admission is weighted by network and region.",
        choice: {
          pick: "Cohort-level state, with cohorts derived deterministically from the device token",
          instead: "A per-device progress table tracking what each of 500M devices has.",
          decider:
            "500M rows of mutable state buys a compliance feature nobody asked for, and cohort-level accounting answers every question you actually have. Deriving the cohort from the token also makes assignments regenerable, so their RPO is not zero and losing the KV is survivable.",
          flips:
            "A hard compliance deadline, which genuinely requires per-device accounting and an escalation path and turns a fire-and-forget system into one that chases individual stragglers.",
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
        numbers: ["~1.4B events per release, ~280GB raw", "~30GB after sampling success at 1%"],
        breaks:
          "Sampled success makes precise progress accounting impossible, which is fine until someone asks for a compliance number. Progress is read from the unsampled check-in version census instead.",
        choice: {
          pick: "Sample success at 1%, keep every failure, report on the next check-in",
          instead: "Report immediately and keep every event.",
          decider:
            "~1.4B events at ~200B is ~280GB per release and drops to ~30GB while losing nothing that matters, because success events are interchangeable and failure events are not. Delaying the report to the next check-in also removes a 460M-message spike aligned with the band you just opened.",
          flips:
            "A release small enough that the whole event stream is cheap, where full fidelity on success is worth having for latency and quality analysis.",
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
        numbers: ["time to halt SLO under 30 minutes", "1 of 12 variants can regress invisibly in a fleet average"],
        breaks:
          "Halting on noise. An analyser that fires weekly gets muted within a month, and a muted halt is worse than no halt because everyone believes it is protecting them.",
        choice: {
          pick: "Automatic halt requiring both effect size and significance, evaluated per variant",
          instead: "A dashboard threshold on the fleet-wide aggregate that a human watches.",
          decider:
            "Every minute between a regression becoming observable and admission stopping is measured in devices, so the SLO is under 30 minutes and no human meets it reliably at 3am. Fleet aggregates also hide a variant-specific fire: one broken hardware variant is invisible in a number averaged across twelve.",
          flips:
            "The first few releases, before you have enough history to know what a normal delta looks like, where an automatic halt would mostly be firing on your own ignorance.",
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
        numbers: ["~1% of 500M = ~5M devices", "membership rotates once per release"],
        breaks:
          "A static holdback strands the same devices on an old version forever, which is why membership rotates: the cohort is permanent, the members are not.",
        choice: {
          pick: "A permanent 1% holdback with rotating membership",
          instead: "No holdback, comparing the admitted cohort against the previous week's baseline.",
          decider:
            "5M devices experiencing the same day is the only way to attribute a 0.4 percentage point crash-rate move to the build rather than to the world. Without it every automatic halt is a coin toss, and the cost is 1% of the fleet running one version behind for one release.",
          flips:
            "Fleets small enough that 1% cannot produce statistically meaningful event counts, where a longer soak on a larger admitted band is the only comparison available.",
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
        numbers: ["~144 objects, ~17GB per release"],
        breaks:
          "If the pipeline can be induced to sign arbitrary bytes, every control below this line is decorative, which is why signing keys are short-lived and rooted offline.",
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
        numbers: ["~17GB per release", "edge hit ratio SLO above 99%"],
        breaks:
          "Opening a band on release publish rather than on a schedule is exactly the mistake this edge exists to prevent, and the symptom is an origin spike that looks like a CDN fault.",
      },
    },
    {
      id: "e3",
      from: "cdn",
      to: "update-client",
      tier: "hot",
      label: "25MB delta, ranged GET",
      detail: {
        what: "The actual payload transfer: ~25MB streamed with resumable ranges to a device that has decided it is allowed to spend the bandwidth.",
        why: "This is where the entire 11.5PB lives, and it is deliberately the dumbest hop in the system. The CDN knows nothing about cohorts, bands or halt, so a decision made in the control plane never has to propagate through a cache.",
        numbers: ["~25MB per device, ~40s at ~5Mbps", "~380 devices/s starting a download at the 14-day pace"],
        breaks:
          "Corrupt or truncated artifacts. The device refuses on a digest mismatch and re-requests with backoff, and never applies unverified bytes no matter how many times it fails.",
      },
    },
    {
      id: "e4",
      from: "update-client",
      to: "device-fleet",
      tier: "hot",
      label: "verify, stage, commit",
      detail: {
        what: "Digest and signature verification, then applying the delta and staging the result before committing it, ending in one of four outcomes: applied, failed to verify, failed to apply, or rolled back.",
        why: "Stage-then-commit is the only rollback that exists anywhere in this design, and it is local to the device. Once the commit lands there is no remote mechanism to undo it, which is the fact the entire band ladder is built around.",
        numbers: ["4 possible outcomes per attempt"],
        breaks:
          "A partial apply that leaves an inconsistent state and is only visible on the next check-in, which is why the device keeps the ability to fall back to its prior state without asking anyone.",
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
        numbers: ["3 conditions must hold at once"],
        breaks:
          "Devices that never satisfy them never update, and they are concentrated in particular regions and price tiers, so the admitted-to-eligible step is where a plateaued rollout is almost always diagnosed.",
      },
    },
    {
      id: "e6",
      from: "update-client",
      to: "checkin",
      tier: "hot",
      label: "~200B fingerprint",
      detail: {
        what: "The poll: current version, variant, region and rollout token, sent on a server-assigned schedule with full jitter.",
        why: "Devices must ask before they can receive, so this is the request that happens 500M times a day whether or not a release exists. It is also, unsampled, the census that tells you the true version distribution across the fleet.",
        numbers: ["~5,800 req/s jittered, ~8.3M/s if synchronised", "sleep(random(0, interval)), not interval/2 + random"],
        breaks:
          "Equal jitter is not enough after a mass event. A carrier outage or a power cut resynchronises the fleet, and only full jitter across the whole interval spreads the returning wave flat.",
      },
    },
    {
      id: "e7",
      from: "checkin",
      to: "update-client",
      tier: "hot",
      label: "none, or url + not_before",
      offset: 60,
      detail: {
        what: "The answer: usually empty, and when it is not, an artifact URL, digest, signature, conditions and a not_before timestamp minutes to hours out. Every response, empty or not, also carries the next check-in interval.",
        why: "It carries a time rather than a yes, and that is the whole trick. Admitting a 1% band is admitting 5M devices, and if they all acted on their next check-in you would have a 5M-device spike against the CDN and the telemetry pipeline at once.",
        numbers: ["~95% of responses are empty, at ~200 bytes"],
        breaks:
          "A client with a hardcoded interval is a client you cannot slow down, so the interval always comes from the server even when there is nothing to say.",
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
        numbers: ["~3ms per read", "read replicas serve the ~95% negative locally"],
        breaks:
          "If this read ever becomes a write, or ever depends on the release pipeline, the most available service you operate inherits the availability of the least.",
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
        why: "Every widen is a deliberate, auditable decision about how many devices you are prepared to strand, which is why it is a row in a table rather than a config push or a runbook step.",
        numbers: ["0.1% -> 1% -> 5% -> 20% -> 50% -> 100%"],
        breaks:
          "Opening a band before its predecessor has soaked long enough in real device usage means the ladder is theatre: you have spent the wait without buying the signal.",
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
        numbers: ["cohort = token % 1000, admitted if cohort < ceiling"],
        breaks:
          "Admitting purely on cohort id ignores that cohorts are not evenly spread across carriers and regions, so a band can quietly hand one network far more than its share.",
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
        numbers: ["~3 events per device per update", "~1.4B events per release"],
        breaks:
          "Outcome reporting lags the actual apply by up to one check-in interval, so progress dashboards trail reality by hours and someone will read that as a stall.",
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
        numbers: ["~30GB per release after sampling"],
        breaks:
          "Failures cluster exactly when the system is already unhappy, so the ingest path has to survive a correlated burst that arrives precisely when you most need to see it.",
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
        numbers: ["2 conditions: effect size past a threshold and 95% confidence"],
        breaks:
          "The most important comparison here is not crash rate but check-in rate: admitted cohorts checking in less than the holdback is the signature of the release having broken the update client, and a silent device reports nothing else.",
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
        numbers: ["time to halt SLO under 30 minutes"],
        breaks:
          "Halt stops admission and does nothing else. The devices that already took the build keep it, so this arrow bounds future damage and repairs none of the damage already done.",
      },
    },
  ],
};
