import type { Diagram } from "./types";

export const NEARBY_FRIENDS: Diagram = {
  id: "nearby-friends",
  title: "Nearby Friends",
  question: "Design Nearby Friends",
  sourceId: "patterns",
  itemId: 14,
  overview: {
    shape:
      "This looks like a geo service and is really a write-rate problem: every indexed point moves, so the system is a funnel that sheds ten million position writes per second down to about forty-six thousand notifications, with a permission check on every path that produces an answer.",
    beats: [
      "The rate is set on the phone, before a byte leaves it. Motion classification runs on the sensor hub at single-digit milliamps against GPS at hundreds, so the device picks its own interval: five minutes when still, 30 seconds walking, 10 seconds driving, one minute in the background. That is the first 10x, and only the device knows its own motion state without a round trip.",
      "The Location Service is one deployable unit running four stages of the same request: write loc:{user_id} with a five minute expiry, pre-filter, check the permission pair, publish the crossing. The expiry is load-bearing: a user who stops reporting drops off the map by themselves, with no tombstone to write and no cleanup job chasing a billion keys.",
      "Contrast this with Q13, which is the whole point of the question. Proximity search over static places is a read problem: millions of businesses sit still, you index them once, and the spatial index narrows an otherwise unanswerable query. Here the points move ten million times a second and the candidate set was handed to you for free by a friend graph averaging 200 entries, so the read path needs no spatial structure at all.",
      "The cell scheme does not disappear, it changes job. Q13 uses it as a read index; here the same coarse cell is the write-placement key, so that everyone physically near the writer is already resident on the writer's shard and the pre-filter is a local set intersection rather than 20 scattered position reads. Around 85% of writes have no online, permitted friend in range and stop there.",
      "Delivery then splits by what the user is actually looking at. A map on screen polls its owner's online friends every ten seconds, which is stateless and joins the permission pair on the same read that produces the answer. A radius crossing, meaning bob is now nearby, is published to the writer's topic and pushed over a held-open socket, and there are only about 46k of those per second against ten million writes.",
      "Privacy is structural rather than a feature bolted on. Consent is bidirectional because unilateral location access is itself the abuse vector, permission is checked on the read rather than cached at fan-out so a revoke takes effect with a zero-length window, crossing events carry no coordinates at all, and history is opt-in and physically off the hot path.",
    ],
    crux:
      "The write amplification is on the wrong side of the system, and every write has to answer a question about other people before you know whether it mattered. Geographic sharding is what makes that question local and cheap, and it collapses exactly where the product is most valuable: a festival puts 50,000 mutually in-range users on one node, so the ordinary case and the interesting case want opposite layouts.",
    numbers: [
      "~10M location writes/s peak, ~1GB/s ingress",
      "pre-filter drops ~85%, leaving ~46k crossings/s",
      "poll path: 10M req/s, 200M key reads/s, ~400 cache nodes",
    ],
  },
  nodes: [
    {
      id: "history",
      label: "History store",
      sub: "Cassandra, (user_id, day_bucket)",
      kind: "database",
      col: 0,
      row: 1,
      detail: {
        what: "The opt-in tracking archive, written asynchronously and gated on actual movement: a point only when the user has moved more than 50m, plus an hourly heartbeat.",
        why: "A latest-only store and a tracking archive share nothing but the ingest, so this is a second system rather than a mode of the first. It is drawn on the far side of the write path, away from everything else, because that separation is the design: a history outage leaves the live product untouched, and 'we are not keeping this' becomes a checkable claim rather than a promise.",
        numbers: [
          "~30% opt in, 300M users",
          "~264 points/day vs 1,440 naive",
          "~240TB vs ~1.3PB, 30-day TTL",
        ],
        breaks:
          "Unbounded partitions if you key on user_id alone. The day bucket is what bounds a partition by the day rather than by the lifetime of the account, and for drivers and runners the bucket drops to an hour.",
        choice: {
          pick: "Wide-column, partitioned (user_id, day_bucket), 30-day TTL, movement-gated writes",
          instead: "Store every sampled point at 1/min under a user_id partition, and trim later.",
          decider:
            "Volume and partition growth. 300M opted-in users at 1,440 points/day for 30 days is ~1.3PB before replication; gating on 50m of movement gives ~264 points/day and ~240TB, a 5.5x cut, and the day bucket caps a partition at a few hundred rows instead of letting it grow for years.",
          flips:
            "A compliance or fleet-tracking product where a fixed-cadence trace is the deliverable and gaps are unacceptable, so you pay the petabyte and downsample into Parquet on a schedule instead.",
        },
      },
    },
    {
      id: "device",
      label: "alice's phone",
      sub: "sets its own rate, ~100B Protobuf",
      kind: "client",
      col: 1,
      row: 0,
      detail: {
        what: "The writer's device: it classifies motion on the sensor coprocessor, picks its sampling interval from that state using a policy table shipped as remote config, and posts { lat, lng, ts, motion_state } as roughly 100 bytes of Protobuf.",
        why: "It is a client rather than a third party: it runs our build and we are paged for it. It is one box rather than a phone plus a separate sampler because the classifier and the reporter are the same app binary — they ship together, fail together, and a single bad release changes both. That single box is nonetheless the first and largest attenuation stage in the whole system, because only the device knows whether it is moving without a round trip.",
        numbers: [
          "~500M concurrent reporters, ~100B per update",
          "5min still, 30s walking, 10s driving, 1min background",
          "30x fewer fixes still vs driving; classifier draws single-digit mA against GPS at hundreds",
        ],
        breaks:
          "Two failures, and the state machine is the subtler one. Promoting to a faster state on 5s of motion is cheap to get wrong; demoting needs 5 minutes of stillness or a phone nudged on a table oscillates and burns the battery the policy exists to save. The louder one is a location update storm: a bad release shipping 100 updates/s to a billion devices is a self-inflicted DDoS, so debounce to 1/s on the client and coalesce server-side per (user_id, cell).",
        choice: {
          pick: "The device sets its own rate from on-device motion state, tuned by remote config",
          instead: "The server tells each device when to report next, waking it with a silent push when the schedule changes.",
          decider:
            "Which lever is larger and measurable without a round trip. Motion state cuts the rate 10x from the walking rate of 1/30s to the stationary 1/5min and 30x from the driving rate of 1/10s, and the classifier costs single-digit mA. Server-directed suppression attacks the other waste, the 85% of writes nobody reads, worth maybe a further 5x, but it buys a wake mechanism and a round trip of latency whenever someone opens a map onto a sleeping device.",
          flips:
            "A share-with-one-person-for-an-hour product, where the watching set is small, explicit and known server-side, so suppression is exact rather than statistical and the 5x becomes closer to 50x. Also on any platform granting no background execution, where a server-scheduled wake is the only mechanism that exists.",
        },
      },
    },
    {
      id: "location-service",
      label: "Location Service",
      kind: "serviceGroup",
      col: 1,
      row: 1,
      detail: {
        what: "The write path as one deployable unit: accept POST /location, write the latest position, pre-filter against the local cell, join the permission pair on whatever survived, publish the crossing. Four stages of one request, on one fleet.",
        why: "The prose's own hot-path pseudocode is a single function — set, then crossings(), then permitted(), then publish() — and drawing those as peer services would claim an independence that does not exist. They deploy together, scale on the same signal, and each stage exists only to make the next one affordable. It is stateless on purpose: ten million writes a second arrive whether or not anybody is watching, so the tier that absorbs them has to scale on the shard map and nothing else.",
        numbers: [
          "~10M writes/s peak: 3.3M/s foreground, 6.7M/s background",
          "10M in, ~1.5M past the pre-filter, ~46k published",
          "sized 200x above the delivery fleet it feeds",
        ],
        breaks:
          "Batched samples after a network blip. The device buffers ~30 fixes in a tunnel and replays them with original timestamps, and the crossing evaluation has to run over that whole sequence rather than only the newest point, or a friend who walked past mid-tunnel is silently missed. Because the stages are one process, that replay cost lands on every stage at once.",
      },
    },
    {
      id: "ingest",
      label: "Write latest position",
      sub: "SET loc:{user_id}, ex=300",
      kind: "process",
      col: 1,
      row: 1,
      parent: "location-service",
      detail: {
        what: "The first stage: an unconditional overwrite of the user's single position key with a five minute expiry, carrying the previous cell forward from the request.",
        why: "The write is unconditional because permission is checked on the read, so there is no fan-out state to invalidate here and nothing to consult before storing. The expiry is the cleanup strategy: a user who stops reporting drops off every map by themselves, with no tombstone written and no job chasing a billion keys.",
        numbers: [
          "one key per user, five minute expiry",
          "~1GB/s ingress before TLS",
          "coalesced within a 1s window per (user_id, cell)",
        ],
        breaks:
          "If the expiry fires before the next report the user vanishes from friends' maps. Show a last-seen time rather than a confidently wrong dot, and republish on foreground.",
        choice: {
          pick: "Carry the previous position and cell in the write itself",
          instead: "Read the user's previous position back from the store before evaluating the crossing.",
          decider:
            "Shard migration. A 5km cell is crossed every ~4 minutes at 70km/h, and with ~200M users in motion at a mean 20 minute interval that is ~167k migrations/s, 1.7% of the write rate. The new cell's shard has never seen the user, so a read-back either misses or goes cross-node, and the enter/leave edge is lost at every boundary.",
          flips:
            "If the client cannot be trusted to report its own previous position, which for a spoofing-sensitive deployment is a real concern, and you accept a node-local read plus dual routing during migration windows instead.",
        },
      },
    },
    {
      id: "prefilter",
      label: "Pre-filter",
      sub: "friends ∩ cell, then haversine",
      kind: "process",
      col: 1,
      row: 2,
      parent: "location-service",
      detail: {
        what: "The stage that decides whether a write is interesting to anybody: intersect the writer's friend list, ~200 ids the service already holds because the graph changes on a timescale of days, with this cell's current membership set, then haversine whatever survives.",
        why: "Everything downstream is sized by what gets through here. The naive version fetches ~20 online friends' positions per write, which at 10M writes/s is 200M scattered reads with a 20-way fan-in on every write and a tail latency that makes it unbuildable. Geographic placement turns that into a local set intersection: a writer in Tokyo whose friends are all in London is not on any of their shards, so the question is answered by absence at memory speed.",
        numbers: [
          "~85% of writes stop here",
          "~20 online friends of ~200",
          "ordinary case: zero or one local candidate",
        ],
        breaks:
          "Crowds. A split stadium cell fans the intersection across up to 8 sub-shards, reintroducing exactly the scatter-gather that geographic sharding existed to remove, and crossing notifications go from 5s to 30-60s where the product matters most.",
        choice: {
          pick: "Filter before the bus, against the cell that already holds the nearby positions",
          instead: "Publish every position and let the delivery tier decide who cares.",
          decider:
            "What the delivery fleet then has to be sized for. Unconditional fan-out is 0.15 x 3 = 0.45 per write, so streaming positions is ~4.5M would-be pushes/s; filtering first and publishing only crossings is ~46k/s, 100x smaller, and the check is a local memory operation rather than a network hop.",
          flips:
            "A sub-second live-dot product for two people walking toward each other, where the answer is 'yes' on nearly every write anyway and the filter is pure overhead on the latency budget.",
        },
      },
    },
    {
      id: "acl-gate",
      label: "Permission check",
      sub: "both directions, on the survivors",
      kind: "process",
      col: 1,
      row: 3,
      parent: "location-service",
      detail: {
        what: "The second shedding point: for each candidate the distance test kept, join the bidirectional sharing pair and drop anything not currently permitted in both directions.",
        why: "It is a stage of this request rather than a check the delivery tier does later, and that placement is the privacy design: the verdict that leaves this service has already been authorised, so there is no cached permission anywhere downstream to go stale. Consent is bidirectional because a unilateral 'I can see where you are' is itself the abuse vector, not a scaling concern.",
        numbers: [
          "runs on ~15% of writes, ~3 candidates each",
          "~0.5ms on a cache miss",
          "both directions required for sharing to be live",
        ],
        breaks:
          "If this moves to a TTL cache on the delivery nodes, a revoked pair keeps receiving crossings for the length of the TTL, and indefinitely if the invalidation channel partitions.",
        choice: {
          pick: "Run the permission join after the distance test, not before it",
          instead: "Check permission first and only measure distance for permitted pairs.",
          decider:
            "Cost per write. The distance test is a local memory operation that answers no for ~85% of writes; the permission join is the more expensive of the two and may miss its cache at ~0.5ms. Ordering the cheap rejection first means the expensive check runs on ~1.5M writes/s instead of 10M/s.",
          flips:
            "If the permitted set were tiny and the local cell huge — a share-with-one-person product inside a stadium — where checking permission first would reject almost everything before any distance maths at all.",
        },
      },
    },
    {
      id: "publisher",
      label: "Crossing publisher",
      sub: "dedup (subject, observer, dir)",
      kind: "process",
      col: 1,
      row: 4,
      parent: "location-service",
      detail: {
        what: "The last stage: emit (subject, observer, entered|left, ts) to the writer's topic, with no coordinates in the payload, and deduplicate on (subject, observer, direction) before it goes.",
        why: "It gets its own stage because it owns a failure nothing else can see. During a cell split or merge the write is routed by both the previous and the current cell, so the same boundary crossing is evaluated twice; the deduplication here is the only thing standing between that and a doubled notification, which users complain about far more than a missing one.",
        numbers: [
          "~46k events/s out of ~10M writes/s in",
          "dedup window must exceed the migration window",
          "payload carries no lat/lng",
        ],
        breaks:
          "A dedup window shorter than the shard migration window. Then every user crossing a cell boundary while a split is in flight is notified twice, and the bug only appears under exactly the load that caused the split.",
        choice: {
          pick: "Deduplicate at the publisher on (subject, observer, direction), with a window longer than the migration window",
          instead: "Lean on exactly-once delivery from the bus, or deduplicate on the subscriber.",
          decider:
            "Where the duplicate is actually created. It is created upstream, by dual routing during a split, so both copies are distinct, legitimate publishes and no delivery guarantee on the bus can merge them. Only the publisher sees both.",
          flips:
            "If splits were coordinated rather than online — freeze the cell, drain, then resume — the duplicate never exists and the dedup state is pure cost.",
        },
      },
    },
    {
      id: "crossing-bus",
      label: "Crossing bus",
      sub: "Kafka, topic per user_id",
      kind: "queue",
      col: 1,
      row: 5,
      detail: {
        what: "One topic per user carrying crossing verdicts, buffered for the length of a subscriber's reconnect window.",
        why: "It decouples the write path from the socket fleet, so a delivery outage cannot back-pressure ingest and a subscriber that reconnects can be caught up from the log rather than losing the event. Reducing a position stream to a verdict is also what drops the delivery problem by two orders of magnitude and is a privacy control in its own right: an observer who is not looking at a map never receives a coordinate.",
        numbers: [
          "~46k events/s, about 4 crossings per user per day",
          "vs ~4.5M/s if you streamed positions",
          "200x below the ingest rate",
        ],
        breaks:
          "If the bus dies, arrival notifications stop while the map is untouched, because the map polls the store and never touched the bus. Background users are the ones who go silent, and a crossing older than a few minutes is not worth delivering on recovery.",
        choice: {
          pick: "Publish crossing verdicts to a per-user topic",
          instead: "Publish every position update and let subscribers compute their own crossings.",
          decider:
            "Message rate and what leaks. A friend walking past a coffee shop is one event rather than a hundred position updates, which is the 100x between 4.5M/s and 46k/s, and the reduction also means the wire never carries a coordinate to somebody who is not actively looking at a map.",
          flips:
            "A live moving-dot view, such as a two-person meet-up, where the product promise really is the position stream and a verdict is not the answer the user asked for.",
        },
      },
    },
    {
      id: "subscription",
      label: "Subscription Service",
      sub: "socket routes, hysteresis 1.5/2.0km",
      kind: "service",
      col: 1,
      row: 6,
      detail: {
        what: "Holds the sockets for users with a live view and routes crossing events from a publisher's topic to the subscribers who should see them.",
        why: "This is the only stateful thing on the delivery side, and it is affordable precisely because it is sized by crossings rather than positions. It is a separate deployable from the Location Service because it scales on concurrent sockets while that tier scales on write rate, and a socket fleet restarts on a completely different schedule from a stateless write fleet.",
        numbers: [
          "~46k events/s across the whole system",
          "notification target under 5s",
          "200x below the ingest rate",
        ],
        breaks:
          "Flapping without hysteresis. A single GPS fix with 100m of error at the boundary generates an enter and a leave in the same minute, and someone loitering on the line produces forty notifications instead of one.",
        choice: {
          pick: "Asymmetric thresholds, enter at 1.5km and leave at 2.0km, plus a 10 minute per-pair cooldown",
          instead: "A single radius threshold, with the crossing evaluated on each side of it.",
          decider:
            "GPS error at the boundary. Fixes carry ~100m of error, so a single threshold turns one loiterer into roughly 40 notifications; a 500m band plus a 10 minute cooldown collapses that to one, at the cost of up to 500m of ambiguity in what 'nearby' means.",
          flips:
            "A safety or geofencing product where a precise, auditable boundary matters more than notification comfort, and a late or suppressed crossing is the worse failure.",
        },
      },
    },
    {
      id: "friend-socket",
      label: "bob's phone, app closed",
      sub: "WebSocket, crossings only",
      kind: "client",
      col: 1,
      row: 7,
      detail: {
        what: "The observer's device holding an open socket, receiving { type: crossing, subject_id, direction, ts } and nothing else.",
        why: "This is the path that works when the app is closed, which is most of the hours it is installed. It is drawn as a separate client from the map view because they are different products with different freshness promises and different failure modes, not because they are different phones: the same device is usually both, one channel at a time.",
        numbers: [
          "crossing notification under 5s",
          "no coordinates on this channel",
          "about 4 crossings per user per day",
        ],
        breaks:
          "A dropped socket means missed arrivals rather than a broken map. Clients with a live view can detect arrivals themselves from polled positions, so the degradation is confined to users who are not looking.",
      },
    },
    {
      id: "shard-node",
      label: "Geo shard · one ~5km cell",
      kind: "zone",
      detail: {
        what: "The hot tier as the pre-filter sees it: one shard holding both the latest positions of everyone currently in a ~5km cell and the membership set naming them, placed by geohash rather than by user id.",
        why: "The frame is the point of the design. Positions and membership are two keyspaces that could have lived anywhere, and putting them on the same shard as each other is what turns 'does this writer have a friend nearby' into a memory operation instead of a 20-way scatter-gather across the fleet. Physical proximity and shard co-residency are made into the same thing.",
        numbers: [
          "placement key = geohash(lat, lng, 5), ~5km cell",
          "~60GB total for 500M reporters, ~400 nodes",
          "split above ~5k concurrent reporters, k=8 sub-shards",
        ],
        breaks:
          "Load follows population, which is exactly what a hash shard exists to prevent. A stadium cell holds 50,000 reporters inside a few hundred metres and the local scan the whole design depends on stops being small.",
      },
    },
    {
      id: "latest-loc",
      label: "Latest-position store",
      sub: "Redis Cluster, geohash(5), ex=300",
      kind: "cache",
      col: 2,
      row: 1,
      parent: "shard-node",
      detail: {
        what: "In-memory latest position per user: loc:{user_id} to (lat, lng, ts, prev_cell), five minute expiry, sharded on a coarse geographic cell rather than on the user key.",
        why: "It is a cache and not a database on purpose: nothing here is a system of record, every entry is replaced within minutes and expires on its own, and losing a node costs one report cycle because clients republish. That is also why the RPO for live positions is deliberately non-zero. This is Q13's cell scheme borrowed and repurposed — a read index there, a write-placement key here.",
        numbers: [
          "~60GB for 500M reporters at ~120B/entry",
          "~400 nodes, sized by 200M reads/s not by 60GB",
          "five minute expiry",
        ],
        breaks:
          "The fleet is operations-bound rather than memory-bound, which is unusual enough to say out loud. It is also where staleness shows: expire an entry or lag a migration and you either lose the dot or, worse, render a confidently wrong one.",
        choice: {
          pick: "Shard on geohash(lat, lng, precision 5), not on user id",
          instead: "Hash on user id, the default that spreads load evenly by construction.",
          decider:
            "Whether the pre-filter is local. Sharding on user id scatters the writer's ~20 online friends across the whole fleet: 10M scatter-gather operations per second, each waiting on the slowest of 20 shards. Geographic placement makes the same question a node-local set intersection, at the cost of ~167k shard migrations/s, which is 1.7% of the write rate and cheap.",
          flips:
            "If the product drops proximity notifications and becomes map-only. Then nothing needs a local intersection, the poll is a multi-get by user id anyway, and hash sharding removes the hot-cell problem entirely.",
        },
      },
    },
    {
      id: "cell-members",
      label: "Cell membership",
      sub: "cell:{geohash} to user_id set",
      kind: "cache",
      col: 2,
      row: 2,
      parent: "shard-node",
      detail: {
        what: "The set of user ids currently reporting from each cell, colocated with the shard that holds their positions and rebuilt from the next write cycle if it is lost.",
        why: "This is the other half of the pre-filter: without a membership set the shard cannot answer 'who is here' without scanning its whole keyspace, and the intersection against a 200-entry friend list is only cheap because both sides are already in memory on the same box. It is derived state, which is what makes it a cache rather than a store — a region recovering spends its time re-establishing this, not restoring it.",
        numbers: [
          "quiet cell: a few thousand reporters",
          "split threshold ~5k concurrent reporters",
          "sub-shards capped at k=8",
        ],
        breaks:
          "A split or merge while writes are in flight. Route by both the previous and current cell for the migration window, which is what makes the publisher's deduplication mandatory rather than defensive.",
        choice: {
          pick: "Split any cell above ~5k reporters into at most 8 hash sub-shards",
          instead: "Let a hot cell keep growing, or subdivide the geohash to a finer precision under load.",
          decider:
            "The cost of the crowd case. A stadium cell is 50,000 users inside a few hundred metres, all mutually in range; capping at k=8 bounds the pre-filter at 8 cross-node reads per write instead of an unbounded local scan of thousands. Finer precision does not help, because the users really are all within one radius of each other.",
          flips:
            "If crowd behaviour becomes a first-class product rather than a tail case, where the answer is a per-event ephemeral index built only for cells over the threshold, which is a different system with a different failure mode.",
        },
      },
    },
    {
      id: "map-client",
      label: "bob's map view",
      sub: "foreground, polls on a timer",
      kind: "client",
      col: 3,
      row: 0,
      detail: {
        what: "A phone with the map on screen, pulling its owner's online friends' positions every ten seconds.",
        why: "It is drawn separately from the socket path because it is a different promise: the map wants coordinates and tolerates ten seconds of staleness, whereas the notification wants a verdict within five and carries no coordinates at all. It is also the reason a bus outage is survivable — a client with a live view can detect arrivals itself from what it polled.",
        numbers: [
          "~100M foreground clients at peak",
          "1 poll per 10s",
          "map staleness target under 10s",
        ],
        breaks:
          "Ten seconds of staleness is invisible for a dot 400m away and obvious for one walking toward you, which is the freshness cost the whole stateless design is paid for with. Positions it has already pulled are also the part of a revoke that nothing on the server can reach.",
      },
    },
    {
      id: "nearby-api",
      label: "GET /nearby",
      sub: "stateless, multi-get + pair join",
      kind: "service",
      col: 3,
      row: 1,
      detail: {
        what: "A stateless read endpoint returning the positions of the caller's online, permitted friends, at whatever precision each pair has agreed.",
        why: "This is the whole read path, and it deliberately has no spatial index behind it. You never ask who in the world is near me, you ask which of my 200 friends are near me, and ~20 of them are online, which is a multi-get rather than a query. It is a separate service from the write tier because it scales on foreground clients while that one scales on reporters, and the two numbers move independently.",
        numbers: [
          "10M requests/s at a 10s timer",
          "~20 keys per request, 200M key reads/s",
          "~400 cache nodes at ~500k ops/s each",
        ],
        breaks:
          "Cost is linear in online friends. An account with thousands of live sharing pairs degrades its own read path first, which at least fails locally, and is why the visible set gets capped at a few hundred.",
        choice: {
          pick: "Poll the latest-position store on a 10s timer",
          instead: "Push every position to every in-radius permitted friend over a held-open socket.",
          decider:
            "The freshness the product actually promises, with the crossover around 5 seconds. At 10s, polling costs 10M req/s and 200M key reads/s, roughly 400 cache nodes, and zero delivery-side state. Matching push would mean a 3s timer, 33M req/s and 667M key reads/s, about 3x the fleet, for a difference nobody perceives on a dot 400m away.",
          flips:
            "Genuinely sub-second freshness, such as a two-person meet-up view or a child-safety product. It also flips on graph shape rather than latency: above roughly 200 online friends per user the poll does 2B reads/s and push is cheaper on every axis.",
        },
      },
    },
    {
      id: "perm-cache",
      label: "Permission cache",
      sub: "read-through, invalidated on write",
      kind: "cache",
      col: 3,
      row: 3,
      detail: {
        what: "The read-through tier in front of the sharing pairs, holding (enabled, precision_m, expires_at) per directed pair and evicted by an explicit invalidation on every share write rather than by a TTL.",
        why: "It exists as its own tier because both paths that produce an answer join permission on themselves, and their combined read rate is ~10M/s — several orders of magnitude past what the transactional store behind it can serve. Drawing it inside that store would hide the one property the whole privacy argument rests on: the eviction is driven by the write, so there is no interval during which a revoked pair is still served.",
        numbers: [
          "read at ~10M/s, the poll rate",
          "~0.5ms on a miss",
          "revoke-to-effect: zero by construction",
        ],
        breaks:
          "Switch this to a TTL and the safety property silently becomes a latency property. A 5s TTL gives single-digit milliseconds of exposure when healthy, tens under load, and unbounded exposure if the invalidation channel partitions — and nothing in the metrics looks different until someone tests a revoke.",
        choice: {
          pick: "Check on the read, against a cache invalidated on write",
          instead: "Check at fan-out against a per-node permission cache fed by an invalidation stream on a 5s TTL.",
          decider:
            "The size of the revocation window, which is a safety property rather than a latency one. Read-time checks run at the read rate, 10M/s at a 10s timer, and are current by construction, so the window is zero. Zero against 'usually milliseconds, occasionally never' is not a close call for location data.",
          flips:
            "If delivery becomes push-per-position, where the route is the answer and there is no read to attach the check to. Then build it honestly: TTL at 5s, tear the socket route down on revoke rather than only evicting the entry, and fail closed when the control plane partitions.",
        },
      },
    },
    {
      id: "perm-db",
      label: "Sharing pairs",
      sub: "Postgres, share_pairs, both ways",
      kind: "database",
      col: 3,
      row: 4,
      detail: {
        what: "The system of record for consent: (user_id, friend_id, enabled, precision_m, expires_at), written by POST /share and requiring both directions to be enabled before sharing is live.",
        why: "It is transactional rather than a wide-column store because a grant or a revoke has to be atomic across a pair and immediately visible to the invalidation it triggers. Read-your-writes on a revoke is the whole guarantee; an eventually consistent store would give the revoking user a UI that says 'stopped' while a replica keeps answering yes.",
        numbers: [
          "one row per directed pair, ~40B each",
          "written at share and revoke rates, not at read rates",
          "both directions required for sharing to be live",
        ],
        breaks:
          "Revocation reaches the next read and nothing already delivered. Positions already in a friend's client memory, or logged by a modified client since the day sharing was granted, are not recoverable, and the UI has to say so in words rather than implying revoke means erase.",
        choice: {
          pick: "Bidirectional consent: a pair is live only if both rows are enabled",
          instead: "Follower-style asymmetric subscription, as posts and photos use.",
          decider:
            "The threat model rather than a capacity number. A unilateral 'I can see where you are' is itself the abuse for location, so requiring both rows removes the vector by construction at the cost of one approval step. It does not cover coercion, where consent is real on paper, which is what the pause-without-notification path exists for.",
          flips:
            "Never for consumer location. It flips only for fleet or family-plan products where the asymmetry is the contract and is disclosed at the account level rather than negotiated per pair.",
        },
      },
    },
  ],
  edges: [
    {
      id: "e1",
      from: "device",
      to: "ingest",
      label: "POST /location, 10s-5min",
      animated: true,
      detail: {
        what: "The location update itself: ~100B of Protobuf carrying lat, lng, ts, accuracy, motion state and the previous cell.",
        why: "This is the hot path and the reason the whole system exists in this shape: 10M of these per second arrive whether or not anybody is watching, so every stage downstream is built to shed load rather than to serve a query. The interval on this arrow was already chosen on the phone, which is the largest single reduction in the system.",
        numbers: ["~10M writes/s peak", "~1GB/s before TLS", "10x fewer still than walking, 30x fewer than driving"],
        breaks:
          "Spoofed updates enter here. Impossible velocity and teleport checks quarantine the crude cases, but a spoofer moving at plausible speeds along real roads is undetectable from position data alone.",
      },
    },
    {
      id: "e2",
      from: "ingest",
      to: "latest-loc",
      label: "SET loc:{user}, ex=300",
      animated: true,
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "An unconditional overwrite of the user's single position key, landing on whichever shard owns the geohash of the new coordinates.",
        why: "The write is unconditional because permission is checked on the read, not here. That is what makes revocation a zero-window property: there is no fan-out state to invalidate, only a read that will start returning nothing. The shard it lands on is chosen by geography, which is what puts the writer's nearby friends on the same box.",
        numbers: ["one key per user", "five minute expiry", "~167k shard migrations/s, 1.7% of writes"],
        breaks:
          "If the expiry fires before the next report, the user vanishes from friends' maps. Show a last-seen time rather than a confidently wrong dot, and republish on foreground.",
      },
    },
    {
      id: "e3",
      from: "ingest",
      to: "history",
      label: "opt-in, moved >50m",
      dashed: true,
      fromSide: "left",
      toSide: "right",
      detail: {
        what: "An asynchronous, movement-gated append to the tracking archive, written only for users who explicitly opted in.",
        why: "Drawn dashed and on the opposite side of the write path from everything else because it must never be on the hot path: history is a separate product, and a candidate who lets it share the live write path has coupled a 240TB system to a 60GB one for no benefit.",
        numbers: ["~30% opt-in", "~264 points/day per active user", "hourly heartbeat even when still"],
        breaks:
          "Capturing history when the user expected ephemeral mode. Hard-gate the write behind the explicit flag and audit it, because this is the failure that is a privacy incident rather than an outage.",
      },
    },
    {
      id: "e4",
      from: "ingest",
      to: "prefilter",
      label: "prev cell + new position",
      animated: true,
      detail: {
        what: "The in-process hand-off to the crossing evaluation, carrying both the previous and current cell so the decision is a pure function of the request.",
        why: "There is no network here, which is the point of drawing these as stages of one service rather than as peers. The shard that owns the new cell has never seen this user before, so anything the evaluation needs about where they were has to travel with the write rather than be read back across the shard map.",
        numbers: ["~10M/s, every write reaches this stage"],
        breaks:
          "Without the previous position, the enter/leave edge is lost at every cell boundary, which at 70km/h is every four minutes.",
      },
    },
    {
      id: "e5",
      from: "prefilter",
      to: "cell-members",
      label: "friends ∩ this cell",
      animated: true,
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "The set intersection: the writer's ~200 friend ids against the user ids currently reporting from this cell, then a haversine on whatever survives.",
        why: "This is the operation the entire sharding scheme exists to make local. Both sides are already in memory on the shard the write just landed on, so a writer in Tokyo whose friends are all in London is answered by absence at memory speed with no network hop at all.",
        numbers: ["~85% answer no", "ordinary case: zero or one survivor", "naive alternative: 200M scattered reads/s"],
        breaks:
          "In a split cell the intersection fans across up to 8 sub-shards, so the crowd case runs precisely the scatter-gather this design removed everywhere else.",
      },
    },
    {
      id: "e6",
      from: "prefilter",
      to: "acl-gate",
      label: "~15% survive",
      detail: {
        what: "The candidates that were close enough, handed to the permission join: roughly 3 friends on the 15% of writes that had anybody nearby at all.",
        why: "This arrow is the funnel's first narrowing and it is why the expensive check is affordable. It is not animated because it is already 85% quieter than the arrow above it — the system does not spend its time here.",
        numbers: ["~1.5M writes/s reach this stage", "~3 candidates each"],
        breaks:
          "If the pre-filter's drop rate falls in a cell, this arrow gets heavier before anything else does, which is why per-cell drop rate is the load-bearing metric rather than latency.",
      },
    },
    {
      id: "e7",
      from: "acl-gate",
      to: "perm-cache",
      label: "permitted pair?",
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "The bidirectional sharing lookup for each surviving candidate, served from the read-through cache and falling through to the store on a miss.",
        why: "Running the check here, on the request that produces the verdict, rather than on the delivery nodes is what gives revocation a zero-length window. The same cache answers the poll path, which is deliberate: one tier, one invalidation rule, and no second copy of the permission state anywhere.",
        numbers: ["~0.5ms on a cache miss", "both directions required", "~1.5M evaluations/s, against 10M/s from the poll path"],
        breaks:
          "If this check moves to a TTL cache on the delivery nodes, a revoked pair keeps receiving crossings for the length of the TTL, and indefinitely if the invalidation channel partitions.",
      },
    },
    {
      id: "e8",
      from: "acl-gate",
      to: "publisher",
      label: "authorised crossings",
      detail: {
        what: "The pairs that passed both the distance test and the permission join, handed to the publisher to be deduplicated and emitted.",
        why: "Everything past this point is already authorised, which is the property that lets the delivery tier hold no permission state of its own. It also means the funnel is finished here: ten million writes have become tens of thousands of verdicts.",
        numbers: ["10M/s in at the top of this service, ~46k/s out"],
        breaks:
          "Publishing on every in-radius position instead of on the crossing puts 4.5M messages/s on the bus, which is the mistake this whole stage ordering exists to avoid.",
      },
    },
    {
      id: "e9",
      from: "publisher",
      to: "crossing-bus",
      label: "topic user.crossing.A",
      detail: {
        what: "The crossing verdict published to the writer's own topic as (subject, observer, entered|left, ts), with no coordinates in the payload.",
        why: "This is the funnel's narrow end and the reason the delivery tier is affordable: the fleet downstream is sized 200x below the ingest. It is not animated because the system does not spend its time here — that is the whole argument.",
        numbers: ["~46k events/s", "4 crossings per user per day", "vs ~4.5M/s if you streamed positions"],
        breaks:
          "A publish that succeeds after the pair was revoked. The window is zero for the check itself, but an event already on the bus still has to be stopped at the socket, which is why the route teardown exists as well.",
      },
    },
    {
      id: "e10",
      from: "crossing-bus",
      to: "subscription",
      label: "consume + route to sockets",
      detail: {
        what: "Crossing events consumed by the delivery tier and matched against the routing table of currently live sockets.",
        why: "The bus decouples the write path from the socket fleet so a delivery outage cannot back-pressure ingest, and so a subscriber that reconnects can be caught up from the log rather than losing the event entirely.",
        numbers: ["buffered for the reconnect window"],
        breaks:
          "A crossing older than a few minutes is not worth delivering: 'bob arrived' is a claim about now, and replaying stale ones after a recovery is worse than dropping them.",
      },
    },
    {
      id: "e11",
      from: "subscription",
      to: "friend-socket",
      label: "WS push, no coordinates",
      detail: {
        what: "The crossing delivered over the observer's open socket: subject id, direction and timestamp, with no lat/lng in the payload.",
        why: "The omission is deliberate. An observer who is not looking at a map has no need for coordinates, so withholding them means a compromised client cannot passively accumulate a track of somebody who merely consented to be told when they are nearby.",
        numbers: ["under 5s device write to socket delivery", "~46k/s across the whole fleet"],
        breaks:
          "A dropped socket loses the arrival rather than the map. Users with a live view never notice, because their poll would have shown the friend anyway.",
      },
    },
    {
      id: "e12",
      from: "map-client",
      to: "nearby-api",
      label: "GET /nearby every 10s",
      animated: true,
      detail: {
        what: "The map's periodic pull for its owner's online, permitted friends' positions.",
        why: "This is the arrow that replaces a per-position push and all its delivery-side state. Whoever is looking pays for the freshness they are looking at, and a screen that is switched off costs nothing at all.",
        numbers: ["10M requests/s", "one poll per 10s per foreground client"],
        breaks:
          "The poll fleet is the scaling ceiling, and the lever is the timer rather than the hardware: moving from a 10s to a 15s poll removes a third of it.",
      },
    },
    {
      id: "e13",
      from: "nearby-api",
      to: "latest-loc",
      label: "multi-get ~20 keys",
      animated: true,
      fromSide: "left",
      toSide: "right",
      detail: {
        what: "A multi-get over the caller's online friends' position keys, roughly 10% of a 200-friend list, fanned across whichever shards those friends currently sit on.",
        why: "No spatial index is consulted, which is the whole contrast with Q13: the candidate set was handed over by the friend graph, so 20 key reads and 20 distance computations are cheaper than any index that would have to be maintained under 10M writes/s. Note this read crosses cells freely — geographic placement exists for the write path, and costs the read path a scatter it can afford at 20 keys.",
        numbers: ["200M key reads/s in aggregate", "~500k ops/s per cache node"],
        breaks:
          "This is what makes the cache fleet operations-bound rather than memory-bound: 400 nodes for 60GB of data, sized entirely by read rate.",
      },
    },
    {
      id: "e14",
      from: "nearby-api",
      to: "perm-cache",
      label: "join on the read",
      animated: true,
      detail: {
        what: "The sharing check, joined onto the same request that produces the answer, including the agreed precision for each pair.",
        why: "Attaching the check to the read rather than caching a fan-out decision is what makes a revoke effective on the very next poll, with nothing to invalidate anywhere and no window in which a stale allow is served. It is the heaviest arrow into this cache, at the full poll rate.",
        numbers: ["~10M permission reads/s", "revoke-to-effect zero by construction"],
        breaks:
          "It reaches the next answer and nothing already delivered. Positions the friend's client already holds are gone, and treating revoke as erase is the wrong mental model to ship in a UI.",
      },
    },
    {
      id: "e15",
      from: "perm-cache",
      to: "perm-db",
      label: "read-through on miss",
      detail: {
        what: "The fall-through to the system of record on a cache miss, and the write path for grants and revocations in the other direction.",
        why: "The store never sees the 10M/s; it sees misses and writes. That is the only reason a transactional database is a defensible choice here, and it is why the cache is a real tier rather than an optimisation.",
        numbers: ["~0.5ms per miss", "write rate is share and revoke actions, not reads"],
        breaks:
          "An invalidation that does not land turns a zero-length revocation window into an unbounded one, and nothing downstream can tell the difference. The canary that revokes and immediately reads back is what catches it.",
      },
    },
    {
      id: "e16",
      from: "perm-db",
      to: "subscription",
      label: "revoke: drop the route",
      dashed: true,
      fromSide: "left",
      toSide: "right",
      detail: {
        what: "The control path a revoke takes to the delivery tier: tear down the socket route for that pair, not merely evict a cached entry.",
        why: "The read-time check gives a zero window on anything not yet evaluated, but a crossing that already passed the check and is in flight to a socket is past every gate this design has. Removing the route is the only thing that stops it. It is drawn because it is the one place where the push path needs a permission mechanism of its own.",
        numbers: ["fires at revoke rate, not at message rate", "target: no delivery after the revoke commits"],
        breaks:
          "If this is treated as a cache eviction rather than a teardown, an in-flight crossing lands after permission was withdrawn, and the user who revoked has no way to know it happened.",
      },
    },
  ],
};
