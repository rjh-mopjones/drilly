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
      "The Location Service writes one key per user, loc:{user_id} holding lat, lng and a timestamp with a five minute expiry, and keeps no history on the hot path. The expiry is load-bearing: a user who stops reporting drops off the map by themselves, with no tombstone to write and no cleanup job chasing a billion keys.",
      "Contrast this with Q13, which is the whole point of the question. Proximity search over static places is a read problem: millions of businesses sit still, you index them once, and the spatial index narrows an otherwise unanswerable query. Here the points move ten million times a second and the candidate set was handed to you for free by a friend graph averaging 200 entries, so the read path needs no spatial structure at all.",
      "The cell scheme does not disappear, it changes job. Q13 uses it as a read index; here the same coarse cell is the write-placement key, so that everyone physically near the writer is already resident on the writer's node and the pre-filter is a local set intersection rather than 20 scattered position reads. Around 85% of writes have no online, permitted friend in range and stop there.",
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
      id: "shard-node",
      label: "Geo shard node, one ~5km cell",
      kind: "zone",
      x: 16,
      y: 194,
      w: 680,
      h: 200,
      detail: {
        what: "One shard of the hot tier: the cell's latest positions, its current membership set, and the pre-filter that runs against both.",
        why: "The pre-filter has to ask whether any of the writer's friends is nearby, and that is only cheap if those friends are already on this machine. Sharding on a coarse geographic cell rather than on user id is what makes physical proximity and shard co-residency the same thing.",
        numbers: ["placement key = geohash(lat, lng, 5)", "~5km cell", "split above ~5k concurrent reporters"],
        breaks:
          "Load follows population, which is what a hash shard exists to prevent. A stadium cell holds 50,000 reporters inside a few hundred metres and the local scan the design depends on stops being small.",
      },
    },
    {
      id: "device",
      label: "Mobile client",
      sub: "POST /location, ~100B Protobuf",
      kind: "external",
      x: 40,
      y: 0,
      w: 280,
      detail: {
        what: "The phone: takes a GPS fix on its current schedule and posts { lat, lng, ts, motion_state } as roughly 100 bytes of Protobuf.",
        why: "It is drawn as external because it is the only part of the system whose binding constraint is battery rather than capacity, and because you cannot trust it: a modified client can inject impossible movement and a buggy build can ship 100 updates a second to a billion devices.",
        numbers: ["~100B per update", "~500M concurrent reporters", "~1GB/s ingress before TLS"],
        breaks:
          "A location update storm. Debounce to 1/s on the client and coalesce server-side within a 1s window per (user_id, cell), because a bad release is a self-inflicted DDoS.",
      },
    },
    {
      id: "sampler",
      label: "Device sampler",
      sub: "motion state, remote-config table",
      kind: "external",
      x: 440,
      y: 0,
      w: 240,
      detail: {
        what: "On-device logic that classifies motion on the sensor coprocessor and picks the report interval from a policy table the server ships as remote config.",
        why: "This is the first and largest attenuation stage, and it has to be here: only the device knows whether it is moving without a round trip, and a phone reporting every five seconds all day is dead in about four hours.",
        numbers: ["5min still, 30s walking, 10s driving, 1min background", "30x fewer fixes still vs driving", "classifier draws single-digit mA vs GPS at hundreds"],
        breaks:
          "The state machine, not the numbers. Promoting to a faster state on 5s of motion is cheap to get wrong; demoting needs 5 minutes of stillness or a phone nudged on a table oscillates and burns the battery the policy exists to save.",
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
      sub: "stateless, carries prev cell",
      kind: "service",
      x: 40,
      y: 100,
      w: 280,
      detail: {
        what: "Accepts POST /location, writes the latest (lat, lng, ts) under loc:{user_id} with a five minute expiry, then hands the write to the pre-filter.",
        why: "Ten million writes a second arrive whether or not anyone is watching, so this tier exists to be stateless and horizontally scalable on the shard map, and to make the crossing evaluation a pure function of the request rather than something that needs a read-back.",
        numbers: ["~10M writes/s peak", "3.3M/s foreground, 6.7M/s background", "five minute expiry per key"],
        breaks:
          "Batched samples after a network blip. The device buffers ~30 fixes in a tunnel and replays them with original timestamps, and crossings have to be evaluated over that sequence or a friend who walked past mid-tunnel is silently missed.",
        choice: {
          pick: "Carry the previous position and cell in the write itself",
          instead: "Read the user's previous position back from the store before evaluating the crossing.",
          decider:
            "Shard migration. A 5km cell is crossed every ~4 minutes at 70km/h, and with ~200M users in motion at a mean 20 minute interval that is ~167k migrations/s, 1.7% of the write rate. The new cell's node has never seen the user, so a read-back either misses or goes cross-node, and the enter/leave edge is lost at every boundary.",
          flips:
            "If the client cannot be trusted to report its own previous position, which for a spoofing-sensitive deployment is a real concern, and you accept a node-local read plus dual routing during migration windows instead.",
        },
      },
    },
    {
      id: "history",
      label: "History store",
      sub: "Cassandra, (user_id, day_bucket)",
      kind: "database",
      x: 440,
      y: 100,
      w: 240,
      detail: {
        what: "The opt-in tracking archive, written asynchronously and gated on actual movement: a point only when the user has moved more than 50m, plus an hourly heartbeat.",
        why: "A latest-only store and a tracking archive share nothing but the ingest, so this is a second system rather than a mode of the first. Keeping it physically separate is also what lets a history outage leave the live product untouched, and what makes 'we are not keeping this' a checkable claim.",
        numbers: ["~30% opt in, 300M users", "~264 points/day vs 1,440 naive", "~240TB vs ~1.3PB, 30-day TTL"],
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
      id: "prefilter",
      label: "Pre-filter",
      sub: "local set intersection",
      kind: "service",
      x: 40,
      y: 230,
      w: 280,
      detail: {
        what: "The stage that decides whether a write is interesting to anybody: intersect the writer's friend list with this node's cell membership, then haversine whatever survives.",
        why: "Everything downstream is sized by what gets through here. The naive version fetches ~20 online friends' positions per write, which at 10M writes/s is 200M scattered reads with a 20-way fan-in on every write and a tail latency that makes it unbuildable.",
        numbers: ["~85% of writes stop here", "~20 online friends of ~200", "ordinary case: zero or one local candidate"],
        breaks:
          "Crowds. A split stadium cell fans the intersection across up to 8 sub-shards, reintroducing exactly the scatter-gather that geographic sharding existed to remove, and crossing notifications go from 5s to 30-60s where the product matters most.",
        choice: {
          pick: "Filter before the bus, on the node that already holds the nearby positions",
          instead: "Publish every position and let the delivery tier decide who cares.",
          decider:
            "What the delivery fleet then has to be sized for. Unconditional fan-out is 0.15 x 3 = 0.45 per write, so streaming positions is ~4.5M would-be pushes/s; filtering first and publishing only crossings is ~46k/s, 100x smaller, and the check is a local memory operation rather than a network hop.",
          flips:
            "A sub-second live-dot product for two people walking toward each other, where the answer is 'yes' on nearly every write anyway and the filter is pure overhead on the latency budget.",
        },
      },
    },
    {
      id: "latest-loc",
      label: "Latest-position store",
      sub: "Redis Cluster, geohash(5), ex=300",
      kind: "database",
      x: 440,
      y: 210,
      w: 240,
      detail: {
        what: "In-memory latest position per user: loc:{user_id} to (lat, lng, ts, prev_cell), five minute expiry, sharded on a coarse geographic cell rather than the user key.",
        why: "This is Q13's cell scheme borrowed and repurposed. There it is a read index that narrows millions of static businesses down to a candidate set; here the friend graph already gave you the candidate set, so the cell's only remaining job is deciding which shard a write lands on, which is what makes the pre-filter local.",
        numbers: ["~60GB for 500M reporters at ~120B/entry", "~400 nodes, sized by 200M reads/s not by 60GB", "five minute expiry"],
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
      kind: "database",
      x: 440,
      y: 310,
      w: 240,
      detail: {
        what: "The set of user ids currently reporting from each cell, colocated with the shard that holds their positions.",
        why: "This is the other half of the pre-filter: without a membership set the node cannot answer 'who is here' without scanning its whole keyspace, and the intersection against a 200-entry friend list is only cheap because both sides are already in memory on the same box.",
        numbers: ["quiet cell: a few thousand reporters", "split threshold ~5k concurrent reporters", "sub-shards capped at k=8"],
        breaks:
          "A split or merge while writes are in flight. Route by both the previous and current cell for the migration window and deduplicate on (subject, observer, direction) at the publisher, with a dedup window longer than the migration window or one boundary crossing notifies twice.",
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
      id: "permissions",
      label: "Permission store",
      sub: "share_pairs, read-through cache",
      kind: "database",
      x: 440,
      y: 470,
      w: 240,
      detail: {
        what: "Bidirectional pair records (user_id, friend_id, enabled, precision_m, expires_at), fronted by a read-through cache invalidated on write rather than by TTL.",
        why: "Both directions are required for sharing to be live because a unilateral 'I can see where you are' is itself the abuse, not a scaling concern. Reading it on the path that produces the answer is what makes revocation a property of the design rather than a race the operator hopes to win.",
        numbers: ["~200B directed pairs, ~8TB at 40B/row, ~24TB replicated", "read at ~10M/s, the poll rate", "revoke-to-effect: zero by construction"],
        breaks:
          "Revocation reaches the next read and nothing already delivered. Positions already in a friend's client memory, or logged by a modified client since the day sharing was granted, are not recoverable, and the UI has to say so in words.",
        choice: {
          pick: "Check permission on the read, joined on the path that produces the answer",
          instead: "Check at fan-out against a per-node permission cache fed by an invalidation stream.",
          decider:
            "The size of the revocation window, which is a safety property rather than a latency one. Read-time checks run at the read rate, 10M/s at a 10s timer, and are current by construction, so the window is zero. A 5s-TTL fan-out cache gives single-digit milliseconds when healthy, tens under load, and unbounded if the control plane partitions.",
          flips:
            "If delivery becomes push-per-position, where the route is the answer and there is no read to attach the check to. Then build it honestly: TTL at 5s, tear the socket route down on revoke rather than only evicting the entry, and fail closed when the control plane partitions.",
        },
      },
    },
    {
      id: "crossing-bus",
      label: "Crossing bus",
      sub: "Kafka, topic per user_id",
      kind: "queue",
      x: 40,
      y: 420,
      w: 280,
      detail: {
        what: "One topic per user carrying crossing events (subject, observer, entered|left, ts), with no coordinates in the payload.",
        why: "Reducing a position stream to a verdict is what drops the delivery problem by two orders of magnitude, and it is also a privacy control: an observer who is not currently looking at a map never receives coordinates, so a compromised or merely curious client cannot passively accumulate a track.",
        numbers: ["~46k events/s, about 4 crossings per user per day", "vs ~4.5M/s if you streamed positions", "payload carries no lat/lng"],
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
      x: 40,
      y: 530,
      w: 280,
      detail: {
        what: "Holds the sockets for users with a live view and routes crossing events from a publisher's topic to the subscribers who should see them.",
        why: "This is the only stateful thing on the delivery side, and it is affordable precisely because it is sized by crossings rather than positions. The routing table has to be in memory, sticky to a connection, and torn down on revoke so an in-flight crossing cannot land after permission is withdrawn.",
        numbers: ["~46k events/s across the whole system", "notification target under 5s", "200x below the ingest rate"],
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
      label: "Friend's phone",
      sub: "WebSocket, crossings only",
      kind: "external",
      x: 40,
      y: 640,
      w: 280,
      detail: {
        what: "The observer's device holding an open socket, receiving { type: crossing, subject_id, direction, ts } and nothing else.",
        why: "This is the path that works when the app is closed, which is most of the hours it is installed. It exists as a separate channel from the map poll because a notification and a moving dot are different products with different freshness promises.",
        numbers: ["crossing notification under 5s", "no coordinates on this channel"],
        breaks:
          "A dropped socket means missed arrivals rather than a broken map. Clients with a live view can detect arrivals themselves from polled positions, so the degradation is confined to users who are not looking.",
      },
    },
    {
      id: "map-client",
      label: "Map view",
      sub: "foreground, polls on a timer",
      kind: "external",
      x: 840,
      y: 210,
      w: 240,
      detail: {
        what: "A phone with the map on screen, pulling its owner's online friends' positions every ten seconds.",
        why: "It is drawn separately from the socket path because it is a different promise: the map wants coordinates and tolerates ten seconds of staleness, whereas the notification wants a verdict within five and has no coordinates at all.",
        numbers: ["~100M foreground clients at peak", "1 poll per 10s", "map staleness target under 10s"],
        breaks:
          "Ten seconds of staleness is invisible for a dot 400m away and obvious for one walking toward you, which is the freshness cost the whole stateless design is paid for with.",
      },
    },
    {
      id: "nearby-api",
      label: "GET /nearby",
      sub: "stateless, multi-get + ACL join",
      kind: "service",
      x: 840,
      y: 320,
      w: 240,
      detail: {
        what: "A stateless read endpoint returning the positions of the caller's online, permitted friends, at whatever precision each pair has agreed.",
        why: "This is the whole read path, and it deliberately has no spatial index behind it. You never ask who in the world is near me, you ask which of my 200 friends are near me, and ~20 of them are online, which is a multi-get rather than a query.",
        numbers: ["10M requests/s at a 10s timer", "~20 keys per request, 200M key reads/s", "~400 cache nodes at ~500k ops/s each"],
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
  ],
  edges: [
    {
      id: "e1",
      from: "sampler",
      to: "device",
      label: "sets the report interval",
      dashed: true,
      fromSide: "left",
      toSide: "right",
      detail: {
        what: "The motion state feeding the sampling policy: 5min still, 30s walking, 10s driving, 1min background.",
        why: "Drawn as a control path because it carries no location data, only the decision about how often to produce some. This single arrow is worth 10x on the ingest rate and is the difference between a phone that lasts a day and one that dies in four hours.",
        numbers: ["10x still vs walking, 30x vs driving"],
        breaks:
          "A client stuck in high-frequency mode drains batteries silently. Detection is the sample-interval distribution by motion state, and the lever is remote config rather than a release.",
      },
    },
    {
      id: "e2",
      from: "device",
      to: "location-service",
      label: "POST /location, 5s-5min",
      animated: true,
      detail: {
        what: "The location update itself: ~100B of Protobuf carrying lat, lng, ts, accuracy, motion state and the previous cell.",
        why: "This is the hot path and the reason the whole system exists in this shape: 10M of these per second arrive whether or not anybody is watching, so every stage downstream is built to shed load rather than to serve a query.",
        numbers: ["~10M writes/s peak", "~1GB/s before TLS"],
        breaks:
          "Spoofed updates enter here. Impossible velocity and teleport checks quarantine the crude cases, but a spoofer moving at plausible speeds along real roads is undetectable from position data alone.",
      },
    },
    {
      id: "e3",
      from: "location-service",
      to: "latest-loc",
      label: "SET loc:{user}, ex=300",
      animated: true,
      fromSide: "right",
      toSide: "top",
      detail: {
        what: "An unconditional overwrite of the user's single position key, with a five minute expiry.",
        why: "The write is unconditional because permission is checked on the read, not here. That is what makes revocation a zero-window property: there is no fan-out state to invalidate, only a read that will start returning nothing.",
        numbers: ["one key per user", "five minute expiry"],
        breaks:
          "If the expiry fires before the next report, the user vanishes from friends' maps. Show a last-seen time rather than a confidently wrong dot, and republish on foreground.",
      },
    },
    {
      id: "e4",
      from: "location-service",
      to: "history",
      label: "opt-in, moved >50m",
      dashed: true,
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "An asynchronous, movement-gated append to the tracking archive, written only for users who explicitly opted in.",
        why: "Drawn dashed and off to the side because it must never be on the hot path: history is a separate product, and a candidate who lets it share the live write path has coupled a 240TB system to a 60GB one for no benefit.",
        numbers: ["~30% opt-in", "~264 points/day per active user"],
        breaks:
          "Capturing history when the user expected ephemeral mode. Hard-gate the write behind the explicit flag and audit it, because this is the failure that is a privacy incident rather than an outage.",
      },
    },
    {
      id: "e5",
      from: "location-service",
      to: "prefilter",
      label: "prev cell + new position",
      animated: true,
      detail: {
        what: "The write handed to the crossing evaluation, carrying both the previous and current cell so the decision is a pure function of the request.",
        why: "The node that owns the new cell has never seen this user before, so anything the evaluation needs about where they were has to travel with the write rather than be read back across the shard map.",
        numbers: ["~167k shard migrations/s, 1.7% of writes"],
        breaks:
          "Without the previous position, the enter/leave edge is lost at every cell boundary, which at 70km/h is every four minutes.",
      },
    },
    {
      id: "e6",
      from: "prefilter",
      to: "cell-members",
      label: "friends ∩ this cell",
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "The local set intersection: the writer's ~200 friend ids against the user ids currently reporting from this node's cell.",
        why: "This is the operation the entire sharding scheme exists to make local. A writer in Tokyo whose friends are all in London is not on any of their nodes, so the question is answered by absence at memory speed with no network hop at all.",
        numbers: ["~85% answer no", "ordinary case: zero or one survivor"],
        breaks:
          "In a split cell the intersection fans across up to 8 sub-shards, so the crowd case runs precisely the scatter-gather this design removed everywhere else.",
      },
    },
    {
      id: "e7",
      from: "prefilter",
      to: "permissions",
      label: "permitted pair?",
      dashed: true,
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "The permission join on the crossing evaluation, run only for candidates that survived the distance check.",
        why: "It is second rather than first because it is the more expensive of the two checks and there is no reason to pay for it on a write that was going to be dropped anyway. Running it here rather than at fan-out is what gives revocation a zero-length window.",
        numbers: ["~0.5ms on a cache miss", "both directions required"],
        breaks:
          "If this check moves to a TTL cache on the delivery nodes, a revoked pair keeps receiving crossings for the length of the TTL, and indefinitely if the invalidation channel partitions.",
      },
    },
    {
      id: "e8",
      from: "prefilter",
      to: "crossing-bus",
      label: "~46k crossings/s",
      animated: true,
      detail: {
        what: "The surviving crossings published to the writer's topic as (subject, observer, entered|left, ts).",
        why: "This is the funnel's narrow end and the reason the delivery tier is affordable: 10M writes in, 85% dropped, and only genuine radius crossings published, so the fleet downstream is sized 200x below the ingest.",
        numbers: ["10M/s in, ~46k/s out", "4 crossings per user per day"],
        breaks:
          "Publishing on every in-radius position instead of on the crossing puts 4.5M messages/s on the bus, which is the mistake this arrow exists to avoid.",
      },
    },
    {
      id: "e9",
      from: "crossing-bus",
      to: "subscription",
      label: "topic user.crossing.A",
      animated: true,
      detail: {
        what: "Crossing events consumed by the delivery tier and matched against the routing table of currently live sockets.",
        why: "The bus decouples the write path from the socket fleet so a delivery outage cannot back-pressure ingest, and so a subscriber that reconnects can be caught up from the log rather than losing the event entirely.",
        numbers: ["buffered for the reconnect window"],
        breaks:
          "A crossing older than a few minutes is not worth delivering: 'bob arrived' is a claim about now, and replaying stale ones after a recovery is worse than dropping them.",
      },
    },
    {
      id: "e10",
      from: "subscription",
      to: "friend-socket",
      label: "WS push, no coordinates",
      animated: true,
      detail: {
        what: "The crossing delivered over the observer's open socket: subject id, direction and timestamp, with no lat/lng in the payload.",
        why: "The omission is deliberate. An observer who is not looking at a map has no need for coordinates, so withholding them means a compromised client cannot passively accumulate a track of somebody who merely consented to be told when they are nearby.",
        numbers: ["under 5s device write to socket delivery"],
        breaks:
          "The route must be torn down on revoke, not merely evicted from a cache, or a crossing already in flight lands after permission was withdrawn.",
      },
    },
    {
      id: "e11",
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
      id: "e12",
      from: "nearby-api",
      to: "latest-loc",
      label: "multi-get ~20 keys",
      animated: true,
      fromSide: "left",
      toSide: "right",
      detail: {
        what: "A multi-get over the caller's online friends' position keys, roughly 10% of a 200-friend list.",
        why: "No spatial index is consulted, which is the whole contrast with Q13: the candidate set was handed over by the friend graph, so 20 key reads and 20 distance computations are cheaper than any index that would have to be maintained under 10M writes/s.",
        numbers: ["200M key reads/s in aggregate", "~500k ops/s per cache node"],
        breaks:
          "This is what makes the cache fleet operations-bound rather than memory-bound: 400 nodes for 60GB of data, sized entirely by read rate.",
      },
    },
    {
      id: "e13",
      from: "nearby-api",
      to: "permissions",
      label: "join on the read",
      fromSide: "left",
      toSide: "right",
      detail: {
        what: "The sharing check, joined onto the same request that produces the answer, including the agreed precision for each pair.",
        why: "Attaching the check to the read rather than caching a fan-out decision is what makes a revoke effective on the very next poll, with nothing to invalidate anywhere and no window in which a stale allow is served.",
        numbers: ["~10M permission reads/s", "revoke-to-effect zero by construction"],
        breaks:
          "It reaches the next answer and nothing already delivered. Positions the friend's client already holds are gone, and treating revoke as erase is the wrong mental model to ship in a UI.",
      },
    },
  ],
};
