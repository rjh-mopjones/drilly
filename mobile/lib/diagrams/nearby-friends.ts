import type { Diagram } from "./types";

export const NEARBY_FRIENDS: Diagram = {
  id: "nearby-friends",
  title: "Nearby Friends",
  question: "Design Nearby Friends",
  sourceId: "patterns",
  itemId: 14,
  overview: {
    shape:
      "Every indexed point moves, so the system is a funnel that sheds ten million position writes a second down to about forty-six thousand notifications.",
    forces: [
      {
        constraint: "10M location writes/s while only ~46k crossings/s are ever delivered",
        decision: "Shed load in stages: pre-filter on distance, then check permission, then dedup at the publisher",
        lights: ["prefilter", "acl-gate", "publisher"],
      },
      {
        constraint: "~200 friends per user, ~20 online at once",
        decision: "GET /nearby does a multi-get against the friend graph; no spatial index exists on the read path",
        lights: ["nearby-api", "latest-loc"],
      },
      {
        constraint: "sharding by user id would scatter a writer's 20 online friends into 10M/s of scatter-gather",
        decision: "Shard the Latest-position store and Cell membership together by geohash(5), so proximity is co-residency",
        lights: ["latest-loc", "cell-members"],
      },
      {
        constraint: "10M reads/s hit the permission check; a 5s TTL cache would leave a revoke exposed for seconds",
        decision: "Permission check runs on the read/write path against a write-invalidated cache, never a TTL cache at fan-out",
        lights: ["acl-gate", "perm-cache", "perm-db"],
      },
      {
        constraint: "GPS carries ~100m of error right at a cell boundary",
        decision: "Subscription Service uses asymmetric enter/leave thresholds plus a 10-minute cooldown so a loiterer gets one notification",
        lights: ["subscription"],
      },
    ],
    naive: {
      text: "A reader defaults to a spatial index: store everyone's position in a structure built for proximity queries, then query it per request. That breaks at 10M writes a second, because a spatial index tuned for read-heavy queries over static points cannot be rebuilt continuously. The pre-filter replaces it with a local set intersection instead. Geohash sharding places the Latest-position store and Cell membership on the same node, so 'is anyone nearby' is answered from memory rather than an index lookup.",
      lights: ["prefilter", "latest-loc", "cell-members"],
    },
    beats: [
      {
        text: "The rate is set on the phone, before a byte leaves it. A motion classifier runs on the phone's low-power sensor hub, using single-digit milliamps against hundreds for GPS. It picks the reporting interval from the detected motion state: five minutes when still, 30 seconds walking, 10 seconds driving, one minute in the background. That is the system's first 10x reduction, and only the device knows its own motion state without a round trip.",
        lights: ["device", "e1"],
      },
      {
        text: "The Location Service is one deployable unit that runs four stages of the same request. It writes loc:{user_id} with a five minute expiry, pre-filters against the local cell, checks the permission pair, then publishes the crossing. The expiry is load-bearing: a user who stops reporting drops off the map by themselves. There is no tombstone to write and no cleanup job chasing a billion keys.",
        lights: ["location-service", "ingest", "prefilter", "acl-gate", "publisher"],
      },
      {
        text: "A search for nearby static places, like restaurants, is a read problem. Millions of businesses sit still, so you index them once and a spatial index narrows an otherwise unanswerable query. Nearby Friends is a write-rate problem instead, because every indexed point moves, ten million times a second. The friend graph hands over the candidate set for free, an average of 200 friends per user. So the read path needs no spatial index at all.",
        lights: ["prefilter"],
      },
      {
        text: "The geo cell scheme changes job rather than disappearing. A static-places search would use it as a read index; here the same coarse cell is the write-placement key instead. Everyone physically near the writer is already resident on the writer's shard, so the pre-filter is a local set intersection rather than 20 scattered position reads. About 85% of writes have no online friend in range at all, and stop right there before permission is even checked.",
        lights: ["shard-node", "prefilter", "cell-members"],
      },
      {
        text: "Delivery then splits by what the user is actually looking at. A map on screen polls its owner's online friends every ten seconds, which is stateless and joins the permission pair on the same read that produces the answer. A radius crossing, meaning a friend is now nearby, is published to the writer's topic and pushed over a held-open socket. A socket is a persistent two-way connection kept open for instant delivery, and there are only about 46k crossings a second against ten million writes.",
        lights: ["map-client", "nearby-api", "crossing-bus", "subscription", "friend-socket"],
      },
      {
        text: "Privacy is structural rather than a feature bolted on. Consent is bidirectional, because unilateral location access is itself the abuse vector. Permission is checked on the read rather than cached at fan-out, so a revoke takes effect with a zero-length window. Crossing events carry no coordinates at all, and history is opt-in and physically off the hot path.",
        lights: ["acl-gate", "perm-db", "friend-socket", "history"],
      },
    ],
    crux: {
      problem:
        "The write amplification sits on the wrong side of the system. Every write must answer a question about other people's permissions before anyone knows whether it mattered. Geographic sharding makes that question local and cheap, and it collapses exactly where the product is most valuable: a festival puts 50,000 mutually in-range users on one cell.",
      handled:
        "Cell splitting caps the fan-out at 8 sub-shards instead of an unbounded local scan, so the crowd case is still a scatter-gather but a bounded one. The ordinary case and the crowd case want opposite shard layouts, and splitting is the compromise between them rather than a fix for either.",
    },
    numbers: [
      {
        value: "~10M location writes/s peak, ~1GB/s ingress",
        explain: "500M concurrent reporters at their chosen interval average to roughly 10M writes/s at peak; every stage downstream exists to shed this rate.",
      },
      {
        value: "pre-filter drops ~85% of writes",
        explain: "Most writers have no friend inside their cell at that instant, so the local set intersection answers no from memory before permission is checked.",
      },
      {
        value: "~46k crossings/s delivered, ~200x below ingest",
        explain: "10M writes/s funnel through the 85% pre-filter drop and the publisher's state-change dedup down to ~46k genuinely new crossings/s.",
      },
      {
        value: "poll path: 10M req/s, 200M key reads/s",
        explain: "100M foreground clients poll every 10s; each pulls ~20 friend keys, turning 10M requests/s into 200M key reads/s across ~400 cache nodes.",
      },
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
        why: "A latest-only store and a tracking archive share nothing but the ingest, so this is a second system rather than a mode of the first. It is drawn on the far side of the write path, away from everything else, because that separation is the design. A history outage leaves the live product untouched, and 'we are not keeping this' becomes a checkable claim rather than a promise.",
        numbers: [
          { value: "~30% opt-in, ~300M users", explain: "300M of roughly 1B accounts choose to keep history; that population, not the full user base, is what the archive is sized against." },
          {
            value: "~264 points/day vs 1,440 naive",
            explain: "Gating writes on 50m of movement plus an hourly heartbeat cuts a naive 1/min cadence (1,440 points/day) to about 264 actual points/day.",
          },
          {
            value: "~240TB vs ~1.3PB, 30-day TTL",
            explain: "300M users × ~264 points/day × 30 days at the archive's row size is ~240TB, against ~1.3PB at the naive 1,440/day cadence.",
          },
        ],
        breaks: {
          failure: "Unbounded partitions if you key on user_id alone: a long-lived account's partition grows for the life of the account.",
          handled:
            "The day bucket caps a partition at a single day rather than an account's lifetime, and for drivers and runners it drops to an hour.",
        },
        choice: {
          pick: "Wide-column, partitioned (user_id, day_bucket), 30-day TTL, movement-gated writes",
          instead: "Store every sampled point at 1/min under a user_id partition, and trim later.",
          decider:
            "Volume and partition growth. 300M opted-in users at 1,440 points/day for 30 days is ~1.3PB before replication. Gating on 50m of movement gives ~264 points/day and ~240TB, a 5.5x cut. The day bucket also caps a partition at a few hundred rows instead of letting it grow for years.",
          flips:
            "A compliance or fleet-tracking product where a fixed-cadence trace is the deliverable and gaps are unacceptable. There you pay the petabyte and downsample into Parquet, a columnar file format, on a schedule instead.",
        },
      },
    },
    {
      id: "device",
      label: "alice's phone",
      sub: "sets own rate, ~100B protobuf",
      kind: "client",
      col: 0,
      row: 0,
      detail: {
        what: "The writer's device: it classifies motion on the sensor coprocessor and picks its sampling interval from that state. It posts { lat, lng, ts, motion_state } as roughly 100 bytes of Protobuf, a compact binary encoding.",
        why: "It is a client rather than a third party: it runs our build and we are paged for it. The classifier and the reporter are the same app binary, so they ship together and fail together. That single box is nonetheless the first and largest attenuation stage in the whole system, because only the device knows whether it is moving without a round trip.",
        numbers: [
          { value: "~500M concurrent reporters, ~100B per update", explain: "500M is the concurrent reporter population the whole write path is sized against; ~100B is the Protobuf payload's wire cost." },
          { value: "5min still, 30s walking, 10s driving, 1min background", explain: "The four motion states the on-device classifier picks between, each trading freshness against battery and network cost." },
          {
            value: "30x fewer fixes still vs driving; classifier draws single-digit mA against GPS at hundreds",
            explain: "The classifier itself costs single-digit milliamps against GPS's hundreds, so running it continuously is cheap next to the fixes it saves.",
          },
        ],
        breaks: {
          failure:
            "Two failures. The state machine can oscillate if it demotes to a slower state too eagerly, and a bad release can turn a billion devices into a self-inflicted update storm.",
          handled:
            "Demotion requires 5 minutes of continuous stillness, so a phone nudged on a table does not flap between states. A storming release is contained by debouncing to 1 update/s on the client and coalescing server-side per (user_id, cell).",
        },
        choice: {
          pick: "The device sets its own rate from on-device motion state, tuned by remote config",
          instead: "The server tells each device when to report next, waking it with a silent push when the schedule changes.",
          decider:
            "Which lever is larger and measurable without a round trip. Motion state cuts the rate 10x from walking to stationary, and 30x from driving to stationary, for single-digit milliamps. Server-directed suppression attacks the other waste, the 85% of writes nobody reads, worth maybe a further 5x. But it buys a wake mechanism and a round trip of latency whenever a sleeping device's friend opens a map.",
          flips:
            "A share-with-one-person-for-an-hour product, where the watching set is small, explicit and known server-side, so suppression is exact rather than statistical. Also any platform granting no background execution, where a server-scheduled wake is the only mechanism that exists.",
        },
      },
    },
    {
      id: "location-service",
      label: "Location Service",
      kind: "serviceGroup",
      col: 1,
      row: 0,
      detail: {
        what: "The write path as one deployable unit: accept POST /location, write the latest position, pre-filter against the local cell, join the permission pair on whatever survived, publish the crossing.",
        why: "The write path is genuinely a single function: set the position, evaluate crossings, check who is permitted, publish. Drawing those as peer services would claim an independence that does not exist. They deploy together and scale on the same signal. It is stateless on purpose, since ten million writes a second arrive whether or not anybody is watching.",
        numbers: [
          { value: "~10M writes/s peak: 3.3M/s foreground, 6.7M/s background", explain: "Background writes dominate because most reporters are not actively looking at the app at any given moment." },
          { value: "10M in, ~1.5M past the pre-filter, ~46k published", explain: "The three checkpoints of the funnel this service runs, ending at the crossings the delivery tier actually has to serve." },
          { value: "sized ~200x above the delivery fleet it feeds", explain: "10M writes/s against ~46k published crossings/s, which is why this tier and the delivery tier scale independently." },
        ],
        breaks: {
          failure:
            "Batched samples after a network blip. A device buffers up to ~30 fixes in a tunnel and replays them with their original timestamps once it reconnects.",
          handled:
            "The crossing evaluation runs over the whole replayed sequence, not just the newest point, or a friend who walked past mid-tunnel is silently missed. Because all four stages share one process, that replay cost lands on every stage at once.",
        },
        choice: {
          pick: "All four stages in one deployable, in-process",
          instead: "Four independent services, ingest, pre-filter, permission check, publisher, each scaled on its own metric.",
          decider:
            "Hops per write against a 10M/s write rate. In-process, a write crosses stage boundaries with zero network hops. Splitting into four services would add roughly 3 extra hops per write, about 30M extra RPCs/s, to buy an independence none of the stages currently need.",
          flips:
            "If one stage's load stopped tracking the others, for example the publisher going CPU-bound on dedup while ingest stays I/O-bound. Then splitting it out would let that stage scale on its own signal instead of over-provisioning the whole fleet for its worst stage.",
        },
      },
    },
    {
      id: "ingest",
      label: "Write latest position",
      sub: "SET loc:{user_id}, ex=300",
      kind: "process",
      col: 1,
      row: 0,
      parent: "location-service",
      detail: {
        what: "The first stage: an unconditional overwrite of the user's single position key with a five minute expiry, carrying the previous cell forward from the request.",
        why: "The write is unconditional because permission is checked on the read, so there is no fan-out state to invalidate here. The expiry is the cleanup strategy: a user who stops reporting drops off every map by themselves, with no tombstone written and no job chasing a billion keys.",
        numbers: [
          { value: "one key per user, five minute expiry", explain: "The whole latest-position store is one key per user; the expiry is what removes a stopped reporter with no tombstone write." },
          { value: "~1GB/s ingress before TLS", explain: "10M writes/s at ~100B each is ~1GB/s of raw payload arriving at this stage, before TLS overhead." },
          { value: "coalesced within a 1s window per (user_id, cell)", explain: "A burst of updates for the same user in the same cell within one second collapses to one write." },
        ],
        breaks: {
          failure: "If the expiry fires before the next report, the user vanishes from friends' maps entirely.",
          handled: "Clients show a last-seen time rather than a confidently wrong dot, and republish their position as soon as the app returns to the foreground.",
        },
        choice: {
          pick: "Carry the previous position and cell in the write itself",
          instead: "Read the user's previous position back from the store before evaluating the crossing.",
          decider:
            "Shard migration. A 5km cell is crossed every ~4 minutes at 70km/h, and with ~200M users in motion that is ~167k migrations/s, 1.7% of the write rate. The new cell's shard has never seen the user, so a read-back either misses or goes cross-node, and the enter/leave edge is lost at every boundary.",
          flips:
            "If the client cannot be trusted to report its own previous position. For a spoofing-sensitive deployment that is a real concern, worth a node-local read plus dual routing during migration windows instead.",
        },
      },
    },
    {
      id: "prefilter",
      label: "Pre-filter",
      sub: "friends ∩ cell, then haversine",
      kind: "process",
      col: 1,
      row: 1,
      parent: "location-service",
      detail: {
        what: "The stage that decides whether a write is interesting to anybody: it intersects the writer's ~200 friend ids with this cell's current membership set. Whatever survives gets a haversine check, the formula for straight-line distance between two coordinates.",
        why: "Everything downstream is sized by what gets through here. The naive version fetches ~20 online friends' positions per write, which at 10M writes/s is 200M scattered reads with tail latency that makes it unbuildable. Geographic placement turns that into a local set intersection instead. A writer in Tokyo whose friends are all in London is not on any of their shards, so the question is answered by absence at memory speed.",
        numbers: [
          { value: "~85% of writes stop here", explain: "Most writers have no online friend inside their current cell, so the intersection with the cell's membership returns empty." },
          { value: "~20 online friends of ~200", explain: "A typical user has ~200 friends but only ~20 online at once; the intersection only ever considers that smaller set." },
          { value: "ordinary case: zero or one nearby friend", explain: "Outside a crowd event, the intersection of a user's online friends with the local cell is almost always empty or a single hit." },
        ],
        breaks: {
          failure: "Crowds. A stadium-sized cell splits into up to 8 sub-shards, and the intersection then has to fan out across all of them.",
          handled:
            "That reintroduces exactly the scatter-gather that geographic sharding exists to remove, and crossing notifications slow from 5s to 30-60s. The design accepts this rather than fixing it: an unsplit cell of 50,000 co-located reporters is not scannable any other way.",
        },
        choice: {
          pick: "Filter before the bus, against the cell that already holds the nearby positions",
          instead: "Publish every position and let the delivery tier decide who cares.",
          decider:
            "What the delivery fleet then has to be sized for. Unconditional fan-out of every nearby pair is ~4.5M pushes/s. Distance-filtering here is a local memory operation, not a network hop. It is the first of the checks that bring the delivery fleet down to the ~46k/s it has to serve.",
          flips: "A sub-second live-dot product for two people walking toward each other, where the answer is yes on nearly every write and the filter is pure overhead.",
        },
      },
    },
    {
      id: "acl-gate",
      label: "Permission check",
      sub: "both directions, survivors only",
      kind: "process",
      col: 1,
      row: 2,
      parent: "location-service",
      detail: {
        what: "The second shedding point: for each nearby friend the distance test kept, join the bidirectional sharing pair and drop anything not currently permitted in both directions.",
        why: "It is a stage of this request rather than a check the delivery tier does later, and that placement is the privacy design. The verdict that leaves this service has already been authorised, so there is no cached permission anywhere downstream to go stale. Consent is bidirectional because a unilateral 'I can see where you are' is itself the abuse vector, not a scaling concern.",
        numbers: [
          { value: "runs on ~15% of writes, ~3 nearby friends each", explain: "Only the writes that survived the distance test reach this stage, each carrying about 3 nearby-friend candidates to check." },
          { value: "~0.5ms on a cache miss", explain: "At 0.5ms per miss, running this on all 10M writes/s instead of the filtered 1.5M/s would cost 6.7x more — why distance runs first." },
          { value: "2 rows, one per direction, both must be enabled", explain: "Bidirectional consent means both the subject's and the observer's rows must be enabled, or the pair is not authorised." },
        ],
        breaks: {
          failure: "If this check moved to a TTL cache on the delivery nodes instead, a revoked pair would keep receiving crossings for the length of the TTL.",
          handled:
            "The design avoids that by running the check here, against a cache invalidated on write rather than on a timer. A partitioned invalidation channel would otherwise let a revoke go unbounded, which the write-path check makes structurally impossible.",
        },
        choice: {
          pick: "Run the permission join after the distance test, not before it",
          instead: "Check permission first and only measure distance for permitted pairs.",
          decider:
            "Cost per write. The distance test is a local memory operation that answers no for ~85% of writes; the permission join is more expensive and may miss its cache at ~0.5ms. Ordering the cheap rejection first means the expensive check runs on ~1.5M writes/s instead of 10M/s.",
          flips: "If the permitted set were tiny and the local cell huge, a share-with-one-person product inside a stadium, checking permission first would reject almost everything before any distance maths.",
        },
      },
    },
    {
      id: "publisher",
      label: "Crossing publisher",
      sub: "dedup (subject, observer, dir)",
      kind: "process",
      col: 1,
      row: 3,
      parent: "location-service",
      detail: {
        what: "The last stage: emit (subject, observer, entered|left, ts) to the writer's topic only when the pair's state actually changed, with no coordinates in the payload, deduplicated on (subject, observer, direction).",
        why: "Most authorised pairs were already nearby on the previous write, so publishing only on a state change matters. It turns ~4.5M authorised evaluations a second into ~46k actual crossings. During a cell split, the same boundary crossing can be evaluated twice, once under the old cell and once under the new. That is what the dedup exists to catch.",
        numbers: [
          { value: "~4.5M authorised evaluations/s in, ~46k new crossings/s out", explain: "Publishing only on a state change collapses 4.5M evaluations/s to ~46k genuinely new crossings/s." },
          { value: "dedup window ~5min, longer than the ~4min average migration interval", explain: "The window has to exceed the average shard migration interval, or a boundary crossing during a split gets published twice." },
          { value: "0 lat/lng fields in the payload", explain: "The published crossing carries only subject, observer, direction and timestamp; withholding coordinates is a privacy control." },
        ],
        breaks: {
          failure: "A dedup window shorter than the shard migration window. A user crossing a cell boundary while a split is in flight can then be notified twice.",
          handled: "The dedup window is set to ~5 minutes, longer than the ~4 minute average migration interval, so a duplicate from dual routing is caught before it reaches a subscriber.",
        },
        choice: {
          pick: "Deduplicate at the publisher on (subject, observer, direction), with a window longer than the migration window",
          instead: "Lean on exactly-once delivery from the bus, or deduplicate on the subscriber.",
          decider:
            "Where the duplicate is created: upstream, by dual routing during a split, at the ~4min average migration interval. Both copies are distinct, legitimate publishes, so no delivery guarantee on the bus can merge them; only the publisher sees both.",
          flips: "If splits were coordinated rather than online, freeze the cell, drain, then resume, the duplicate never exists and the dedup state is pure cost.",
        },
      },
    },
    {
      id: "crossing-bus",
      label: "Crossing bus",
      sub: "Kafka, topic per user_id",
      kind: "queue",
      col: 1,
      row: 1,
      detail: {
        what: "One topic per user carrying crossing verdicts, buffered for the length of a subscriber's reconnect window.",
        why: "It decouples the write path from the socket fleet, so a delivery outage cannot back-pressure ingest and a reconnecting subscriber can be caught up from the log. Reducing a position stream to a verdict is also a privacy control: an observer who is not looking at a map never receives a coordinate.",
        numbers: [
          { value: "~46k events/s, about 4 crossings per user per day", explain: "The narrow end of the funnel: about 4 crossing events per user per day is what a friend graph and normal movement produce." },
          { value: "vs ~4.5M/s if you streamed positions", explain: "Publishing every authorised nearby position instead of only state changes would put ~100x more messages on this bus." },
          { value: "200x below the ingest rate", explain: "10M writes/s in against ~46k crossings/s published is the full funnel ratio the delivery tier is sized against." },
        ],
        breaks: {
          failure: "If the bus dies, arrival notifications stop, though the map is untouched because it polls the store and never touches the bus.",
          handled:
            "Background users, who rely only on notifications, are the ones who go silent. A crossing older than a few minutes is not worth delivering on recovery, so replay past that window is deliberately dropped.",
        },
        choice: {
          pick: "Publish crossing verdicts to a per-user topic",
          instead: "Publish every position update and let subscribers compute their own crossings.",
          decider:
            "Message rate and what leaks. A friend walking past a coffee shop is one event rather than a hundred position updates, roughly the 100x between 4.5M/s and 46k/s. The reduction also means the wire never carries a coordinate to somebody who is not actively looking at a map.",
          flips: "A live moving-dot view, such as a two-person meet-up, where the product promise really is the position stream and a verdict is not the answer the user asked for.",
        },
      },
    },
    {
      id: "subscription",
      label: "Subscription Service",
      sub: "socket routes, 1.5/2.0km band",
      kind: "service",
      col: 1,
      row: 2,
      detail: {
        what: "Holds the sockets for users with a live view and routes crossing events from a publisher's topic to the subscribers who should see them.",
        why: "This is the only stateful thing on the delivery side, affordable precisely because it is sized by crossings rather than positions. It is a separate deployable from the Location Service because it scales on concurrent sockets, while that tier scales on write rate. A socket fleet also restarts on a completely different schedule.",
        numbers: [
          { value: "~46k events/s across the whole system", explain: "The full delivery load this service handles, the same narrow end of the funnel every crossing passes through." },
          { value: "notification target under 5s", explain: "The freshness promise for the socket channel, from the device write that produced the crossing to the push landing on the observer's socket." },
          { value: "200x below the ingest rate", explain: "This service is sized by crossings, not by the 10M/s of raw position writes." },
        ],
        breaks: {
          failure: "Flapping without hysteresis, a design that requires crossing further before it reverses a state, again. A single GPS fix with ~100m of error near the boundary can generate an enter and a leave in the same minute.",
          handled: "Someone loitering exactly on the line would otherwise get forty notifications instead of one. Asymmetric enter/leave thresholds plus a 10-minute per-pair cooldown collapse that to a single notification.",
        },
        choice: {
          pick: "Asymmetric thresholds, enter at 1.5km and leave at 2.0km, plus a 10 minute per-pair cooldown",
          instead: "A single radius threshold, with the crossing evaluated on each side of it.",
          decider:
            "GPS error at the boundary. Fixes carry ~100m of error, so a single threshold turns one loiterer into roughly 40 notifications. A 500m band plus a 10 minute cooldown collapses that to one, at the cost of up to 500m of ambiguity in what 'nearby' means.",
          flips: "A safety or geofencing product where a precise, auditable boundary matters more than notification comfort, and a late or suppressed crossing is the worse failure.",
        },
      },
    },
    {
      id: "friend-socket",
      label: "bob's phone, app closed",
      sub: "WebSocket, crossings only",
      kind: "client",
      col: 1,
      row: 3,
      detail: {
        what: "The observer's device holding an open socket, receiving { type: crossing, subject_id, direction, ts } and nothing else.",
        why: "This is the path that works when the app is closed, which is most of the hours it is installed. It is a separate channel from the map view because they are different products with different freshness promises, not because they are different phones. The same device is usually both, one channel at a time.",
        numbers: [
          { value: "crossing notification under 5s", explain: "Same freshness target the delivery tier is measured against, from device write to socket push." },
          { value: "0 coordinates in this channel's payload", explain: "The privacy control repeated at the last hop: an observer not looking at a map receives no coordinates, only a verdict." },
          { value: "about 4 crossings per user per day", explain: "The typical load per subscriber, which is why this channel can stay a held-open socket rather than a heavier polling path." },
        ],
        breaks: {
          failure: "A dropped socket means missed arrivals rather than a broken map.",
          handled: "Clients with a live map view can detect arrivals themselves from their own polled positions, so the degradation is confined to users who are not currently looking.",
        },
      },
    },
    {
      id: "shard-node",
      label: "Geo shard · one ~5km cell",
      kind: "zone",
      detail: {
        what: "The hot tier as the pre-filter sees it: one shard holds both the latest positions of everyone in a ~5km cell, placed by geohash rather than by user id.",
        why: "The frame is the point of the design. Positions and membership are two keyspaces that could have lived anywhere. Putting them on the same shard is what turns 'does this writer have a friend nearby' into a memory operation. Physical proximity and shard co-residency are made into the same thing.",
        numbers: [
          { value: "placement key = geohash(lat, lng, 5), ~5km cell", explain: "Precision-5 geohash cells are roughly 5km across, the unit both write placement and the pre-filter's local scan operate on." },
          { value: "~60GB total for 500M reporters, ~400 nodes", explain: "500M reporters at ~120B per entry is ~60GB total, but the fleet is sized by the 200M reads/s the poll path generates, not by this figure." },
          { value: "split above ~5k concurrent reporters, k=8 sub-shards", explain: "The threshold at which a cell's local scan starts costing more than a bounded cross-shard fan-out; splitting caps the fan-out at 8." },
        ],
        breaks: {
          failure: "Load follows population, which is exactly what a hash shard exists to prevent. A stadium cell can hold 50,000 reporters inside a few hundred metres.",
          handled: "The local scan the whole design depends on stops being small at that point. Splitting the cell into up to 8 sub-shards bounds the fan-out instead of one node absorbing the whole crowd.",
        },
      },
    },
    {
      id: "latest-loc",
      label: "Latest-position store",
      sub: "Redis Cluster, geohash(5) ex=300",
      kind: "cache",
      col: 2,
      row: 0,
      parent: "shard-node",
      detail: {
        what: "In-memory latest position per user: loc:{user_id} to (lat, lng, ts, prev_cell), five minute expiry, sharded on a coarse geographic cell rather than on the user key.",
        why: "It is a cache and not a database on purpose: nothing here is a system of record, and every entry expires on its own. Losing a node costs one report cycle because clients republish, which is why the RPO for live positions, the recovery point objective, is deliberately non-zero. This borrows the geohash cell scheme a static-places proximity search would use as a read index, and repurposes it as a write-placement key.",
        numbers: [
          { value: "~60GB for 500M reporters at ~120B/entry", explain: "500M reporters × ~120B per entry (lat, lng, ts, prev_cell) is the total resident memory." },
          { value: "~400 nodes, sized by 200M reads/s not by 60GB", explain: "At roughly 500k ops/s per node, serving the poll path's 200M key reads/s needs about 400 nodes, far more than 60GB of data would require." },
          { value: "five minute expiry", explain: "Same expiry as the write path: a stopped reporter ages out of this store with no explicit delete." },
        ],
        breaks: {
          failure: "The fleet is operations-bound rather than memory-bound, which is the counterintuitive part of its sizing: 400 nodes to serve reads, not to hold 60GB.",
          handled: "This is also where staleness shows. An expired entry or a lagging shard migration either drops a dot or renders a confidently wrong one, which is why clients also show a last-seen time as a fallback.",
        },
        choice: {
          pick: "Shard on geohash(lat, lng, precision 5), not on user id",
          instead: "Hash on user id, the default that spreads load evenly by construction.",
          decider:
            "Whether the pre-filter is local. Sharding on user id scatters the writer's ~20 online friends across the whole fleet: 10M scatter-gather operations per second, each waiting on the slowest of 20 shards. Geographic placement makes the same question a node-local set intersection, at the cost of ~167k shard migrations/s.",
          flips: "If the product drops proximity notifications and becomes map-only. Then nothing needs a local intersection, the poll is a multi-get by user id anyway, and hash sharding removes the hot-cell problem entirely.",
        },
      },
    },
    {
      id: "cell-members",
      label: "Cell membership",
      sub: "cell:{geohash} to user_id set",
      kind: "cache",
      col: 2,
      row: 1,
      parent: "shard-node",
      detail: {
        what: "The set of user ids currently reporting from each cell, colocated with the shard that holds their positions and rebuilt from the next write cycle if it is lost.",
        why: "This is the other half of the pre-filter: without a membership set the shard cannot answer 'who is here' without scanning its whole keyspace. It is derived state, which is what makes it a cache rather than a store, so a recovering region spends its time re-establishing this rather than restoring it.",
        numbers: [
          { value: "quiet cell: a few thousand reporters", explain: "The ordinary cell size the local intersection is designed around, well under the 5k split threshold." },
          { value: "split threshold ~5k concurrent reporters", explain: "Above this many concurrent reporters, the local scan the pre-filter relies on stops being cheap enough to leave unsplit." },
          { value: "sub-shards capped at k=8", explain: "The cap bounds a crowd cell's fan-out to at most 8 cross-node reads per write instead of an unbounded local scan." },
        ],
        breaks: {
          failure: "A split or merge while writes are in flight, during which a write has to be routed by both the previous and the current cell.",
          handled: "That dual routing during the migration window is exactly what makes the publisher's deduplication mandatory rather than defensive, since the same crossing can otherwise be evaluated twice.",
        },
        choice: {
          pick: "Split any cell above ~5k reporters into at most 8 hash sub-shards",
          instead: "Let a hot cell keep growing, or subdivide the geohash to a finer precision under load.",
          decider:
            "The cost of the crowd case. A stadium cell is 50,000 users inside a few hundred metres, all mutually in range. Capping at k=8 bounds the pre-filter at 8 cross-node reads per write instead of an unbounded local scan. Finer precision does not help, because the users really are all within one radius of each other.",
          flips: "If crowd behaviour becomes a first-class product rather than a tail case, where the answer is a per-event ephemeral index built only for cells over the threshold.",
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
        why: "It is drawn separately from the socket path because it is a different promise. The map wants coordinates and tolerates ten seconds of staleness, whereas the notification wants a verdict within five and carries no coordinates. It is also the reason a bus outage is survivable, since a client with a live view can detect arrivals itself.",
        numbers: [
          { value: "~100M foreground clients at peak", explain: "The concurrent foreground population this service and the poll path are sized against." },
          { value: "1 poll per 10s", explain: "The polling interval that trades freshness for load; the whole request-rate figure for the poll path follows from it." },
          { value: "map staleness target under 10s", explain: "Looser than the socket channel's 5s because the user is actively looking rather than waiting for a push." },
        ],
        breaks: {
          failure: "Ten seconds of staleness is invisible for a dot 400m away, but obvious for a friend walking toward you.",
          handled: "That is the freshness cost the whole stateless design is paid for with. Positions the client has already pulled cannot be un-shown by a later revoke, since nothing on the server can reach data already delivered.",
        },
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
        why: "This is the whole read path, and it deliberately has no spatial index behind it. You never ask who in the world is near me, you ask which of my 200 friends are near me. About 20 of them are online, which makes this a multi-get rather than a query. It is a separate service from the write tier because it scales on foreground clients while that one scales on reporters.",
        numbers: [
          { value: "10M requests/s at a 10s timer", explain: "100M foreground clients polling every 10s produce 10M requests/s at this endpoint." },
          { value: "~20 keys per request, 200M key reads/s", explain: "Each request multi-gets roughly 20 online friends' positions; 10M requests/s × ~20 keys is 200M key reads/s in aggregate." },
          { value: "~400 cache nodes at ~500k ops/s each", explain: "200M reads/s divided by roughly 500k ops/s per node is what sizes the latest-position fleet." },
        ],
        breaks: {
          failure: "Cost is linear in online friends, so an account with thousands of live sharing pairs costs proportionally more to serve.",
          handled: "That account degrades its own read path first, which at least fails locally rather than affecting other users. Capping the visible set at a few hundred bounds the worst case.",
        },
        choice: {
          pick: "Poll the latest-position store on a 10s timer",
          instead: "Push every position to every in-radius permitted friend over a held-open socket.",
          decider:
            "The freshness the product actually promises, with the crossover around 5 seconds. At 10s, polling costs 10M req/s and 200M key reads/s, roughly 400 cache nodes, and zero delivery-side state. Matching push would mean a 3s timer, about 3x the fleet, for a difference nobody perceives on a dot 400m away.",
          flips:
            "Genuinely sub-second freshness, such as a two-person meet-up view or a child-safety product. It also flips on graph shape: above roughly 200 online friends per user the poll does 2B reads/s and push is cheaper on every axis.",
        },
      },
    },
    {
      id: "perm-cache",
      label: "Permission cache",
      sub: "read-through, write-invalidated",
      kind: "cache",
      col: 2,
      row: 3,
      detail: {
        what: "The read-through tier in front of the sharing pairs, holding (enabled, precision_m, expires_at) per directed pair. It is evicted by an explicit invalidation on every share write rather than by a TTL.",
        why: "It exists as its own tier because both paths that produce an answer join permission on themselves. Their combined read rate is ~10M/s, several orders of magnitude past what the transactional store behind it can serve. The eviction is driven by the write, so no interval exists during which a revoked pair is still served.",
        numbers: [
          { value: "read at ~10M/s, the poll rate", explain: "Both paths that check permission, the poll and the write path, together read this cache at roughly the 10M/s poll rate." },
          { value: "~0.5ms on a miss", explain: "The fall-through cost to Sharing pairs when this cache misses." },
          { value: "revoke-to-effect: zero by construction", explain: "Because the cache is invalidated on write rather than expired on a timer, there is no interval during which a revoked pair is still served." },
        ],
        breaks: {
          failure: "Switching this to a TTL would silently turn the safety property into a latency property.",
          handled:
            "A 5s TTL gives single-digit milliseconds of exposure when healthy, tens under load, and unbounded exposure if the invalidation channel partitions. Nothing in the metrics would look different until someone actually tested a revoke, which is why write-invalidation is kept instead.",
        },
        choice: {
          pick: "Check on the read, against a cache invalidated on write",
          instead: "Check at fan-out against a per-node permission cache fed by an invalidation stream on a 5s TTL.",
          decider:
            "The size of the revocation window, which is a safety property rather than a latency one. Read-time checks run at the read rate and are current by construction, so the window is zero. Zero against 'usually milliseconds, occasionally never' is not a close call for location data.",
          flips: "If delivery becomes push-per-position, where the route is the answer and there is no read to attach the check to. Then TTL at 5s, tear the socket route down on revoke, and fail closed when the control plane partitions.",
        },
      },
    },
    {
      id: "perm-db",
      label: "Sharing pairs",
      sub: "Postgres, share_pairs, both ways",
      kind: "database",
      col: 3,
      row: 3,
      detail: {
        what: "The system of record for consent: (user_id, friend_id, enabled, precision_m, expires_at), written by POST /share and requiring both directions to be enabled before sharing is live.",
        why: "It is transactional rather than a wide-column store because a grant or a revoke has to be atomic across a pair and immediately visible to the invalidation it triggers. Read-your-writes on a revoke is the whole guarantee: an eventually consistent store would give the revoking user a UI that says stopped while a replica keeps answering yes.",
        numbers: [
          { value: "one row per directed pair, ~40B each", explain: "The system of record is small: one row per directed sharing relationship, at roughly 40 bytes each." },
          { value: "far below the ~10M/s read rate: written at share/revoke rate only", explain: "This store only sees writes when a user grants or revokes sharing, orders of magnitude below the 10M/s the permission cache absorbs." },
          { value: "2 rows, one per direction, both must be enabled", explain: "Consent is bidirectional: a pair is live only when both the subject's and the observer's rows are enabled." },
        ],
        breaks: {
          failure: "Revocation reaches the next read and nothing already delivered.",
          handled: "Positions already sitting in a friend's client memory, or logged by a modified client, are not recoverable. The product has to say so in the UI rather than implying that revoke means erase.",
        },
        choice: {
          pick: "Bidirectional consent: a pair is live only if both rows are enabled",
          instead: "Follower-style asymmetric subscription, as posts and photos use.",
          decider:
            "The threat model rather than a capacity number. A unilateral 'I can see where you are' is itself the abuse for location, so requiring both rows removes the vector by construction at the cost of one approval step. It does not cover coercion, where consent is real on paper.",
          flips: "Never for consumer location. It flips only for fleet or family-plan products where the asymmetry is the contract and is disclosed at the account level rather than negotiated per pair.",
        },
      },
    },
  ],
  edges: [
    {
      id: "e1",
      from: "device",
      to: "ingest",
      tier: "hot",
      step: 1,
      label: "POST /location, 10s-5min",
      detail: {
        what: "The location update itself: ~100B of Protobuf carrying lat, lng, ts, accuracy, motion state and the previous cell.",
        why: "This is the hot path and the reason the whole system exists in this shape. 10M of these per second arrive whether or not anybody is watching, so every stage downstream is built to shed load. The interval on this arrow was already chosen on the phone, which is the largest single reduction in the system.",
        numbers: [
          { value: "~10M writes/s peak", explain: "The write rate every downstream stage is sized to shed rather than to serve as a query." },
          { value: "~1GB/s before TLS", explain: "10M writes/s at ~100B each is the raw payload arriving before TLS overhead." },
          { value: "10x fewer still than walking, 30x fewer than driving", explain: "The motion-state intervals chosen on the phone, before this write is even sent." },
        ],
        breaks: {
          failure: "Spoofed updates enter here. Impossible-velocity and teleport checks quarantine the crude cases.",
          handled: "A spoofer moving at plausible speeds along real roads is undetectable from position data alone; catching it would need signals this pipeline does not carry, like device attestation.",
        },
      },
    },
    {
      id: "e2",
      from: "ingest",
      to: "latest-loc",
      tier: "hot",
      step: 2,
      label: "SET loc:{user}, ex=300",
      detail: {
        what: "An unconditional overwrite of the user's single position key, landing on whichever shard owns the geohash of the new coordinates.",
        why: "The write is unconditional because permission is checked on the read, not here. That is what makes revocation a zero-window property: there is no fan-out state to invalidate, only a read that will start returning nothing. The shard it lands on is chosen by geography, which puts the writer's nearby friends on the same box.",
        numbers: [
          { value: "one key per user", explain: "The whole store is keyed on user_id, overwritten on every write." },
          { value: "five minute expiry", explain: "The cleanup mechanism: a stopped reporter ages out with no tombstone." },
          { value: "~167k shard migrations/s, 1.7% of writes", explain: "A 5km cell is crossed every ~4 minutes at 70km/h; across ~200M users in motion that is the migration rate." },
        ],
        breaks: {
          failure: "If the expiry fires before the next report, the user vanishes from friends' maps.",
          handled: "Rather than show a stale dot as if live, the client displays a last-seen timestamp and republishes its own position on foreground, resetting the 5-minute key before the next check.",
        },
      },
    },
    {
      id: "e3",
      from: "ingest",
      to: "history",
      tier: "control",
      label: "opt-in, moved >50m",
      detail: {
        what: "An asynchronous, movement-gated append to the tracking archive, written only for users who explicitly opted in.",
        why: "It sits deliberately apart from the write path because it must never be on the hot path. History is a separate product, and coupling it to the live write path would tie a 240TB system to a 60GB one for no benefit.",
        numbers: [
          { value: "~30% opt-in", explain: "30% of ~1B accounts is the ~300M population the history store is sized against — the fraction that ultimately caps the ~240TB archive." },
          { value: "~264 points/day per active user", explain: "The movement-gated cadence, well under the naive 1,440/day." },
          { value: "1 heartbeat/hour even when still", explain: "Guarantees a gap in the trace is never longer than an hour, even for a user who has not moved." },
        ],
        breaks: {
          failure: "Capturing history when the user expected ephemeral mode is a privacy incident, not an outage.",
          handled: "The write is hard-gated behind the explicit opt-in flag and audited. A regression that starts writing for non-opted-in users is caught by the audit, not by a customer report.",
        },
      },
    },
    {
      id: "e4",
      from: "ingest",
      to: "prefilter",
      tier: "data",
      label: "prev cell + new position",
      detail: {
        what: "The in-process hand-off to the crossing evaluation, carrying both the previous and current cell so the decision is a pure function of the request.",
        why: "There is no network here, which is the point of drawing these as stages of one service rather than as peers. The shard that owns the new cell has never seen this user before, so anything the evaluation needs about where they were has to travel with the write.",
        numbers: [{ value: "~10M/s, every write reaches this stage", explain: "No write is filtered before this hand-off; the funnel starts one stage later." }],
        breaks: {
          failure: "Without the previous position, the enter/leave edge is lost at every cell boundary, which at 70km/h is every four minutes.",
          handled: "The write carries the previous cell forward, so the evaluation always has both endpoints of the move without a cross-shard read.",
        },
      },
    },
    {
      id: "e5",
      from: "prefilter",
      to: "cell-members",
      tier: "data",
      label: "friends ∩ this cell",
      detail: {
        what: "The set intersection: the writer's ~200 friend ids against the user ids currently reporting from this cell, then a haversine on whatever survives.",
        why: "This is the operation the entire sharding scheme exists to make local. Both sides are already in memory on the shard the write just landed on. A writer in Tokyo whose friends are all in London is answered by absence at memory speed, with no network hop.",
        numbers: [
          { value: "~85% answer no", explain: "Most writers have no online friend inside their cell." },
          { value: "ordinary case: zero or one survivor", explain: "Outside a crowd event, the intersection almost always returns empty or a single hit." },
          { value: "naive alternative: 200M scattered reads/s", explain: "Fetching each of 20 online friends' positions per write, at 10M writes/s, would be this many scattered reads." },
        ],
        breaks: {
          failure: "In a split cell the intersection fans across up to 8 sub-shards.",
          handled: "The crowd case runs precisely the scatter-gather this design removed everywhere else, capped at 8 rather than unbounded, which is the accepted cost of a bounded split.",
        },
      },
    },
    {
      id: "e6",
      from: "prefilter",
      to: "acl-gate",
      tier: "data",
      label: "~15% survive",
      detail: {
        what: "The nearby friends that were close enough, handed to the permission join: roughly 3 per write on the 15% of writes that had anybody in range.",
        why: "This arrow is the funnel's first narrowing. It is why the expensive permission check is affordable, running against 1.5M writes/s rather than 10M/s, already 85% quieter than the arrow above it.",
        numbers: [
          { value: "~1.5M writes/s reach this stage", explain: "15% of the 10M/s ingest rate, the writes that had a nearby friend at all." },
          { value: "~3 nearby friends each", explain: "The average fan-out per surviving write, sizing the permission join's actual load." },
        ],
        breaks: {
          failure: "If the pre-filter's drop rate falls in a cell, this arrow gets heavier before anything else does.",
          handled: "Per-cell drop rate is monitored as the load-bearing metric, not latency, so a drift here is caught before it reaches the permission check.",
        },
      },
    },
    {
      id: "e7",
      from: "acl-gate",
      to: "perm-cache",
      tier: "data",
      label: "permitted pair?",
      detail: {
        what: "The bidirectional sharing lookup for each nearby friend that survived the distance test, served from the read-through cache and falling through to the store on a miss.",
        why: "Running the check here, on the request that produces the verdict, rather than on the delivery nodes is what gives revocation a zero-length window. The same cache answers the poll path, so there is one tier and one invalidation rule.",
        numbers: [
          { value: "~0.5ms on a cache miss", explain: "The latency cost paid only when the permission cache misses." },
          { value: "2 directions, both required", explain: "Both rows of the bidirectional pair must be enabled for the pair to pass." },
          { value: "~1.5M evaluations/s, against 10M/s from the poll path", explain: "This write-side check is a small fraction of the cache's total 10M/s combined load." },
        ],
        breaks: {
          failure: "If this check moves to a TTL cache on the delivery nodes, a revoked pair keeps receiving crossings for the length of the TTL.",
          handled: "It is not on a TTL: eviction is driven by the write, so exposure is bounded only by whether the invalidation channel itself is healthy.",
        },
      },
    },
    {
      id: "e8",
      from: "acl-gate",
      to: "publisher",
      tier: "data",
      label: "authorised pairs, ~4.5M/s",
      detail: {
        what: "The pairs that passed both the distance test and the permission join, authorised to be told about each other but not yet filtered down to an actual state change.",
        why: "Everything past this point is already authorised, which is the property that lets the delivery tier hold no permission state of its own. Most of these evaluations repeat a pair's already-published state.",
        numbers: [{ value: "~4.5M authorised evaluations/s in, ~46k/s new crossings out", explain: "The publisher's state-change dedup is what collapses this arrow's rate to the actual crossing rate." }],
        breaks: {
          failure: "Publishing on every in-radius position instead of on the crossing puts 4.5M messages/s on the bus.",
          handled: "The publisher stage exists precisely to check against last known state first, which is the ordering this whole path relies on.",
        },
      },
    },
    {
      id: "e9",
      from: "publisher",
      to: "crossing-bus",
      tier: "hot",
      step: 3,
      label: "topic user.crossing.A",
      detail: {
        what: "The crossing verdict published to the writer's own topic as (subject, observer, entered|left, ts), with no coordinates in the payload.",
        why: "This is the funnel's narrow end and the reason the delivery tier is affordable: the fleet downstream is sized 200x below ingest. The system does not spend its time here, which is the whole argument for this shape.",
        numbers: [
          { value: "~46k events/s", explain: "The rate the entire delivery fleet downstream is sized against." },
          { value: "4 crossings per user per day", explain: "The per-user rate that produces the aggregate 46k/s figure." },
          { value: "vs ~4.5M/s if you streamed positions", explain: "4.5M ÷ 46k ≈ 98x — publishing every authorised position instead of just crossings puts roughly two orders of magnitude more messages here." },
        ],
        breaks: {
          failure: "A publish that succeeds after the pair was revoked. The window is zero for the check itself, but an event already on the bus is already committed.",
          handled: "That event still has to be stopped at the socket, which is why the route teardown on revoke exists as a separate mechanism from the read-time check.",
        },
      },
    },
    {
      id: "e10",
      from: "crossing-bus",
      to: "subscription",
      tier: "hot",
      step: 4,
      label: "consume + route to sockets",
      detail: {
        what: "Crossing events consumed by the delivery tier and matched against the routing table of currently live sockets.",
        why: "The bus decouples the write path from the socket fleet, so a delivery outage cannot back-pressure ingest. A reconnecting subscriber can be caught up from the log rather than losing the event entirely.",
        numbers: [{ value: "buffered ~5min, the reconnect window", explain: "The retention on this topic, set to cover a typical client reconnect." }],
        breaks: {
          failure: "A crossing older than a few minutes is not worth delivering: bob arrived is a claim about now.",
          handled: "Replaying stale crossings after a recovery is worse than dropping them, so anything past the ~5min window is simply not delivered.",
        },
      },
    },
    {
      id: "e11",
      from: "subscription",
      to: "friend-socket",
      tier: "hot",
      step: 5,
      label: "WS push, no coordinates",
      detail: {
        what: "The crossing delivered over the observer's open socket: subject id, direction and timestamp, with no lat/lng in the payload.",
        why: "The omission is deliberate. An observer who is not looking at a map has no need for coordinates. Withholding them means a compromised client cannot passively accumulate a track of somebody who merely consented to be told when they are nearby.",
        numbers: [
          { value: "under 5s device write to socket delivery", explain: "The end-to-end freshness target for the notification path." },
          { value: "~46k/s across the whole fleet", explain: "The total push rate this socket fleet has to sustain." },
        ],
        breaks: {
          failure: "A dropped socket loses the arrival rather than the map.",
          handled: "The map itself refreshes independently through the poll path, so a dropped socket only costs the instant notification, not map correctness, for anyone with it open.",
        },
      },
    },
    {
      id: "e12",
      from: "map-client",
      to: "nearby-api",
      tier: "hot",
      step: 6,
      label: "GET /nearby every 10s",
      detail: {
        what: "The map's periodic pull for its owner's online, permitted friends' positions.",
        why: "This is the arrow that replaces a per-position push and all its delivery-side state. Whoever is looking pays for the freshness they are looking at, and a screen that is switched off costs nothing.",
        numbers: [
          { value: "10M requests/s", explain: "100M foreground clients polling every 10s." },
          { value: "one poll per 10s per foreground client", explain: "The tunable that sets the cost of this entire read path." },
        ],
        breaks: {
          failure: "The poll fleet is the scaling ceiling for the read side.",
          handled: "The lever is the timer rather than the hardware: moving from a 10s to a 15s poll removes a third of the load with no code change.",
        },
      },
    },
    {
      id: "e13",
      from: "nearby-api",
      to: "latest-loc",
      tier: "hot",
      step: 7,
      label: "multi-get ~20 keys",
      detail: {
        what: "A multi-get over the caller's online friends' position keys, roughly 10% of a 200-friend list, fanned across whichever shards those friends currently sit on.",
        why: "No spatial index is consulted, unlike a proximity search over static places. The nearby-friend set is handed over by the friend graph, so 20 key reads are cheaper than any index maintained under 10M writes/s. This read crosses cells freely, since geographic placement exists for the write path.",
        numbers: [
          { value: "200M key reads/s in aggregate", explain: "10M requests/s × ~20 keys each is the total load on the latest-position fleet." },
          { value: "~500k ops/s per cache node", explain: "The per-node throughput that, divided into 200M/s, sizes the fleet at ~400 nodes." },
        ],
        breaks: {
          failure: "This is what makes the cache fleet operations-bound rather than memory-bound.",
          handled: "400 nodes are provisioned for 60GB of data, sized entirely by read rate rather than by how much has to fit in memory.",
        },
      },
    },
    {
      id: "e14",
      from: "nearby-api",
      to: "perm-cache",
      tier: "data",
      label: "join on the read",
      detail: {
        what: "The sharing check, joined onto the same request that produces the answer, including the agreed precision for each pair.",
        why: "Attaching the check to the read rather than caching a fan-out decision is what makes a revoke effective on the very next poll, with nothing to invalidate anywhere. It is the heaviest arrow into this cache, at the full poll rate.",
        numbers: [
          { value: "~10M permission reads/s", explain: "The full poll rate, since every returned friend is permission-checked on this same request." },
          { value: "revoke-to-effect zero by construction", explain: "There is no cached fan-out decision to go stale between a revoke and the next check." },
        ],
        breaks: {
          failure: "It reaches the next answer and nothing already delivered.",
          handled: "Positions the friend's client already holds are gone; treating revoke as erase is the wrong mental model to ship in a UI.",
        },
      },
    },
    {
      id: "e15",
      from: "perm-cache",
      to: "perm-db",
      tier: "data",
      label: "read-through on miss",
      detail: {
        what: "The fall-through to the system of record on a cache miss, and the write path for grants and revocations in the other direction.",
        why: "The store never sees the 10M/s; it sees misses and writes. That is the only reason a transactional database is a defensible choice here, and it is why the cache is a real tier rather than an optimisation.",
        numbers: [
          { value: "~0.5ms per miss", explain: "The latency this arrow adds when the permission cache misses." },
          { value: "far below the ~10M/s read rate: writes are share/revoke actions only", explain: "This store's actual load is orders of magnitude below the cache's read rate." },
        ],
        breaks: {
          failure: "An invalidation that does not land turns a zero-length revocation window into an unbounded one.",
          handled: "A canary that revokes and immediately reads back catches this class of failure, since nothing downstream can otherwise tell the difference.",
        },
      },
    },
    {
      id: "e16",
      from: "perm-db",
      to: "subscription",
      tier: "control",
      label: "revoke: drop the route",
      detail: {
        what: "The control path a revoke takes to the delivery tier: tear down the socket route for that pair, not merely evict a cached entry.",
        why: "The read-time check gives a zero window on anything not yet evaluated, but a crossing already in flight to a socket is past every gate this design has. Removing the route is the only thing that stops it.",
        numbers: [
          { value: "fires per revoke, not per one of the ~46k/s crossing messages", explain: "This is a control-plane action triggered by a user action, not part of the data-plane crossing rate." },
          { value: "target: 0 deliveries after the revoke commits", explain: "The correctness bar this teardown path is held to." },
        ],
        breaks: {
          failure: "If this is treated as a cache eviction rather than a teardown, an in-flight crossing lands after permission was withdrawn.",
          handled: "Modelling it as a route teardown rather than an eviction is what stops that. The user who revoked has no way to know otherwise, so this path is tested directly.",
        },
      },
    },
  ],
};
