import type { Diagram } from "./types";

export const NETFLIX: Diagram = {
  id: "netflix",
  title: "Netflix",
  question: "Design Netflix (Video Streaming)",
  sourceId: "patterns",
  itemId: 31,
  overview: {
    shape:
      "This is a placement problem wearing a streaming problem's clothes: appliances inside ISPs already hold the bytes before anyone presses Play.",
    forces: [
      {
        constraint: "the catalogue is finite and known weeks ahead, ~20,000 titles, ~6,000 per country",
        decision: "treat delivery as a placement problem, not a routing problem: pre-position bytes via the Placement controller before any request",
        lights: ["placement", "forecast"],
      },
      {
        constraint: "~900 PB/day at retail transit prices would cost ~$650M/year against ~$150M/year owned",
        decision: "own settlement-free Open Connect appliances inside ISPs so the peak-hour byte never crosses a paid link",
        lights: ["oca", "edge-group"],
      },
      {
        constraint: "a country's relevant renditions are ~300 TB against a 200 TB appliance",
        decision: "forecast per (title, codec, rung, audio track) group and pin the resident set so LRU cannot evict it",
        lights: ["forecast", "placement", "oca"],
      },
      {
        constraint: "rights change daily across ~20,000 titles and must apply at the very next play",
        decision: "check entitlement and country on every session against Catalogue + rights, never bake availability into a cache",
        lights: ["catalogue", "e2"],
      },
      {
        constraint: "an appliance sits in a partner's rack, one of ~18,000 outside our trust boundary",
        decision: "DRM licence server issues short-lived device-bound keys; segments stay ciphertext at rest on the appliance",
        lights: ["drm", "oca"],
      },
    ],
    naive: {
      text: "A reader defaults to a commercial CDN model: buy delivery per byte and let anycast or a name-based lookup route each request to the nearest edge. That breaks at Netflix's ~900 PB/day, ~$650M/year at retail transit prices versus ~$150M/year for owned appliances. The Placement controller replaces per-request routing with nightly pre-positioning: an appliance already holds the bytes before anyone presses Play.",
      lights: ["placement", "oca"],
    },
    beats: [
      {
        text: "The catalogue is finite and known weeks ahead: roughly 20,000 titles, with about 6,000 licensed in any one country. That means the set of bytes anyone might ask for can be enumerated in advance. This single fact turns delivery from a routing problem into a planning problem, and everything distinctive here follows from it.",
        lights: ["catalogue"],
      },
      {
        text: "Content is prepared entirely offline. Each title gets a content-aware ladder of 8 to 12 rungs across three codecs, chosen from that title's own complexity rather than a fixed table. It is sliced into segments of a few seconds and encrypted under CENC, a standard for encrypting streamed video. The ladder is decided once and the bytes are delivered forever, which justifies thousands of CPU hours per title.",
        lights: ["encoder", "origin", "e20"],
      },
      {
        text: "Placement is the interesting decision. A controller computes a per-appliance target list of (title, codec, rung, audio track) groups from a regional forecast. It diffs that list against what the box reports holding, and pushes the delta in the local 02:00 to 06:00 window. Around 500 GB per appliance per night, roughly 9 PB across the fleet, moves against 900 PB delivered: every byte pushed is served about a hundred times.",
        lights: ["placement", "forecast", "oca", "e11", "e12", "e13", "e15"],
      },
      {
        text: "The arithmetic is unusually kind. A country's relevant renditions come to about 300 TB, and a storage appliance holds 200 TB. So the forecast is not picking 2% out of a haystack; it is choosing which third to leave off. The resident set is pinned, and only the remainder of the disk runs LRU, a policy that evicts whatever was least recently used. A plain LRU would otherwise evict the pre-positioned set during exactly the launch it was built for.",
        lights: ["oca", "placement"],
      },
      {
        text: "Session start is three small cloud calls: authenticate and check the country's rights, issue a manifest listing three or four ranked appliance URLs, then issue a short-lived DRM key. DRM is a system that encrypts and licenses content, and this key is bound to the device. Steering lives in the manifest rather than in a name-based lookup, because anycast, a routing technique that sends a request to the nearest server, cannot see inventory. It will happily route a client to a box that does not hold the title.",
        lights: ["playback-api", "catalogue", "manifest", "drm", "e1", "e2", "e3", "e4", "e5", "e6"],
      },
      {
        text: "Then the player takes over. It picks the next segment's rung from its own buffer occupancy: stepping up above 40 seconds of buffer and down immediately below 10, never more than one rung per segment. It heartbeats its position every 30 seconds. Those heartbeats are the only return path, and they feed the forecast that decides tomorrow's placement.",
        lights: ["client", "oca", "telemetry", "forecast", "e7", "e8", "e16", "e17"],
      },
    ],
    crux: {
      problem:
        "A title nobody forecast trends on a Saturday morning. The appliances near those viewers do not hold it. Every play then fills from a peer or from origin during the peak hour, through paid paths, at terabits per second.",
      handled:
        "A cache miss here is a planning failure with a bill attached, not a latency event, which is why origin_fill_rate per appliance is a paged metric. The response is an emergency targeted push before the demand curve steepens, with commercial CDN as an expensive backstop.",
    },
    numbers: [
      {
        value: "~900 PB/day delivered, ~130 Tbps at peak, ~32M concurrent",
        explain: "The daily and instantaneous delivery volume the whole appliance fleet is sized against; almost none of it touches the cloud control plane.",
      },
      {
        value: "~300 TB regional catalogue against a 200 TB appliance",
        explain: "A country's relevant renditions exceed one appliance's storage, so the forecast chooses which third to leave off rather than finding a needle in a haystack.",
      },
      {
        value: "~9 PB/day of nightly fill against 900 PB delivered, 100 to 1",
        explain: "Every byte pushed overnight is served roughly a hundred times the next day, which is what makes pre-positioning pay off even when the forecast is wrong.",
      },
    ],
  },
  nodes: [
    {
      id: "edge-group",
      label: "Data plane, inside the ISP",
      kind: "zone",
      detail: {
        what: "The half of the system that moves petabytes: an appliance in the viewer's own access network, plus the peer and exchange tiers it fills from.",
        why: "The control plane and the data plane never touch. One costs a few kilobytes per session and lives in the cloud; the other costs 900 PB a day and lives inside other people's buildings. Merging them would destroy both the economics and the routing.",
        numbers: [
          { value: "~18,000 appliances", explain: "130Tbps ÷ 18,000 ≈ 7.2Gbps average per box — modest enough that each appliance serves its own network alone, no shared hot path to overload." },
          { value: "~130 Tbps peak egress", explain: "The aggregate output of the fleet at peak viewing hours, the figure that would otherwise be paid transit." },
          { value: "$0 settlement cost on these ports", explain: "Appliances sit on settlement-free ports inside the ISP, so delivery bytes cross no paid link at all." },
        ],
        breaks: {
          failure: "Everything in this zone sits in a partner's rack, on their power and behind their routing policy.",
          handled:
            "There is no independent measurement point between the appliance and the home, so degradation is inferred by comparing appliance egress against player-reported throughput rather than measured directly.",
        },
      },
    },
    {
      id: "client",
      label: "Client player",
      sub: "buffer-based ABR, 4s segments",
      kind: "external",
      col: 0,
      row: 0,
      detail: {
        what: "The TV, phone or browser that fetches segments, runs the rung selection law and heartbeats its position back every 30 seconds.",
        why: "The rung decision has to live here because only the player can see its own buffer. The network underneath a two-hour session changes constantly: wifi contention, a cellular handoff, someone else in the house starting a download.",
        numbers: [
          { value: "step up above 40s of buffer, down below 10s", explain: "The hysteresis thresholds that stop the rung decision flapping on small buffer fluctuations." },
          { value: "one rung per segment, 120 to 240s buffer held", explain: "The buffer depth gives ABR 30 to 60 segments of history to smooth over, a low-variance signal." },
          { value: "~32M concurrent streams at peak", explain: "The concurrent session count this client-side decision has to work correctly for, with no coordination between sessions." },
        ],
        breaks: {
          failure: "Rung oscillation after a network handoff, and a startup with no buffer to read yet.",
          handled:
            "The first rung comes from historical per-ASN statistics rather than a measurement that does not exist yet, and occupancy-based ABR only takes over once the buffer has enough history.",
        },
        choice: {
          pick: "Buffer-occupancy ABR after startup, one rung per segment",
          instead: "Estimate recent throughput from the last few segments and pick the highest rung that fits.",
          decider:
            "Buffer depth against segment duration. With 4s segments and a 120 to 240s buffer, occupancy integrates 30 to 60 segments of history and stays low variance. A per-segment throughput estimate on cellular can have a coefficient of variation above 50% instead, and will oscillate the ladder.",
          flips:
            "When the buffer is too shallow to carry information: low-latency live at a 2 to 4 second target buffer, and the first few segments of any session. Both fall back to throughput.",
        },
      },
    },
    {
      id: "playback-api",
      label: "Playback API",
      sub: "auth, entitlement, verified geo",
      kind: "service",
      col: 1,
      row: 0,
      detail: {
        what: "The cloud call behind POST /play: authenticates the session, checks the viewer's country rights for the title, then fans out to the manifest service and the licence server.",
        why: "Keeping auth and rights in the cloud costs a few kilobytes per session and keeps rights changes as metadata changes. A title leaving a country stops being listed and stops getting keys, with nothing deleted across 18,000 boxes.",
        numbers: [
          { value: "~5 kB per session", explain: "The full control-plane payload per session, small enough that a handful of cloud regions can serve the whole world." },
          { value: "play start p99 under 1,000 ms", explain: "This budget covers all three serial cloud calls at session start. DRM alone can take up to 200ms of it, leaving the rest for playback-api and manifest before any byte is requested." },
          { value: "99.95% playback start success SLO", explain: "The reliability bar the control plane is held to for starting a session, independent of delivery quality." },
        ],
        breaks: {
          failure: "A regional cloud outage stops new sessions.",
          handled:
            "Streams already running are untouched, because they touch no cloud service until their licence expires. That is a deliberate property of keeping the control plane out of the playback path, not luck.",
        },
        choice: {
          pick: "Control plane in the cloud, active-active, never touching a video byte",
          instead: "One tier that serves both session setup and segments.",
          decider:
            "The two halves share nothing. Control is a few kB per session and needs a handful of regions; data is 900 PB a day and needs 18,000 boxes inside other networks. Sizing, placement and failure domain are different by four orders of magnitude.",
          flips: "A service small enough that one tier is cheaper to run than two, where the delivery volume never justifies its own topology.",
        },
      },
    },
    {
      id: "manifest",
      label: "Manifest + steering",
      sub: "inventory-aware, resolved per ASN",
      kind: "service",
      col: 1,
      row: 1,
      detail: {
        what: "Resolves the client address to an ASN, then filters the appliances serving it to those that are healthy, have headroom and actually hold this title's renditions.",
        why: "Inventory-aware steering is what makes a miss rare rather than merely cheap. It is also what gives the player a failover list, so an appliance dying mid-session is a brief quality dip while ABR re-converges, not a stall.",
        numbers: [
          { value: "3 to 4 ranked appliance URLs per play", explain: "The failover list handed to the player, so one appliance going down mid-session is a quality dip rather than a stall." },
          { value: "one uncacheable call per play", explain: "Manifest issuance cannot be cached, because it reflects live inventory and health, unlike a public catalogue page." },
          { value: "manifest_issue p99 is a gating metric", explain: "Latency here directly gates session start, so it is watched as closely as play start itself." },
        ],
        breaks: {
          failure: "This is the one component whose loss stops new sessions worldwide, even though every appliance is healthy.",
          handled: "A degraded mode returns a static per-ASN edge list with no inventory filter, trading a higher miss rate and a higher bill for staying up rather than failing closed.",
        },
        choice: {
          pick: "Steer in the manifest we issue ourselves",
          instead: "Steer with anycast or DNS the way a commercial CDN does.",
          decider:
            "Anycast and DNS route on network proximity, and neither can see inventory. They will send a client to a box that does not hold the object and let the miss sort itself out. With origin fill targeted under 5%, steering blind to what is resident is the fastest way to blow that budget.",
          flips: "A uniform cache where every node holds the same objects, so proximity is the only variable and there is nothing for inventory awareness to add.",
        },
      },
    },
    {
      id: "oca",
      label: "Open Connect appliance",
      kind: "service",
      sub: "200 TB SSD; misses fill from peers",
      col: 0,
      row: 2,
      parent: "edge-group",
      detail: {
        what: "A Linux box running a caching HTTP server, installed free inside an ISP's data centre on a settlement-free port, serving CENC-encrypted segments off SSD.",
        why: "This is the economic story. Bytes for a viewer in Chicago come from a box in Chicago, inside their own ISP, so the peak-hour byte never crosses a paid link. Every appliance also serves its own network independently, with no shared hot path to scale.",
        numbers: [
          { value: "200 TB per storage appliance, ~18,000 in the fleet", explain: "The per-box capacity the placement forecast has to fit a country's ~300 TB of relevant renditions into." },
          { value: "~2/3 of the disk is pinned by the controller, the rest runs LRU", explain: "The pinned fraction holds the forecast's target set; the remainder absorbs whatever the forecast missed." },
          { value: "~$500/month fully loaded per box", explain: "The all-in cost per appliance, the figure the crossover against commercial CDN pricing is computed from." },
        ],
        breaks: {
          failure: "The appliance removes the ISP's upstream transit from the path but not the access network itself.",
          handled:
            "Last-mile congestion looks identical in telemetry to an ISP quietly de-prioritising the box. The subscriber blames us either way, so there is no clean way to attribute the slowdown from here.",
        },
        choice: {
          pick: "Own the hardware and place it inside access networks, given to the ISP",
          instead: "Buy delivery per byte from commercial CDNs and stay out of the hardware business.",
          decider:
            "Cost per site, not globally. About $500/month all-in per appliance buys 250 TB/month at an aggressive $0.002/GB, roughly 770 Mbps sustained or ~200 concurrent streams. Any ISP with a few tens of thousands of streaming households clears that. Globally it is ~$150M/year of fleet against ~$650M/year of CDN spend.",
          flips: "Below the crossover, which is most networks by count though a small share of traffic. Also in markets where hosting a content provider's hardware is commercially or legally off the table at any price.",
        },
      },
    },
    {
      id: "telemetry",
      label: "Playback telemetry",
      sub: "Kafka, 200 B every 30s",
      kind: "queue",
      col: 0,
      row: 3,
      detail: {
        what: "The only return path from the player: position heartbeats, rebuffer and rung-switch events, streamed onto a log and compacted downstream.",
        why: "This is what makes Continue Watching work and what feeds both the QoE loop that tunes ABR and the play counts the placement forecast trains on. It is also tiny, which is why it can cross the cloud boundary at all.",
        numbers: [
          { value: "~1.1M events/s at peak", explain: "32M concurrent streams heartbeating roughly every 30 seconds produces this aggregate event rate." },
          { value: "~220 MB/s, ~19 TB/day raw before compaction", explain: "At ~200 bytes per heartbeat, 1.1M events/s is this raw ingest volume before downstream compaction shrinks it." },
        ],
        breaks: {
          failure: "Backpressure must never reach the player, or a bookkeeping call becomes a rebuffer.",
          handled: "The resume position users actually notice is written on pause and on exit, not on the heartbeat path, so a blocked or dropped heartbeat never affects playback.",
        },
        choice: {
          pick: "Fire-and-forget heartbeats onto a durable log with a small client buffer",
          instead: "Write the position synchronously per beat and acknowledge it.",
          decider:
            "1.1M events/s at peak against a rebuffer budget of 0.5% of playback time. A synchronous write puts a cloud round trip in the player's loop 30 times a session, for data that is worth losing. Any regional wobble would then become a global quality incident.",
          flips: "When the event is billing-grade rather than analytics-grade, where losing a heartbeat costs money and the write has to be acknowledged.",
        },
      },
    },
    {
      id: "recs",
      label: "Personalised rows",
      sub: "offline model, per profile",
      kind: "service",
      col: 3,
      row: 0,
      detail: {
        what: "Ranked home-screen rows computed offline per profile and served from an in-memory cache as profile_id to a list of (title_id, score).",
        why: "The home screen is the strongest single predictor of what a country watches tomorrow. It is decided in-house, which is exactly why merchandising is weighted most heavily in the placement forecast.",
        numbers: [
          { value: "~300M memberships, multiple profiles each", explain: "The population this offline model ranks rows for; multiple profiles per membership multiply the row-computation workload." },
          { value: "rows scoped to the country's ~6,000 licensed titles", explain: "Rows are filtered to what is actually licensed in the viewer's country, so nothing unavailable is ever promoted." },
        ],
        breaks: {
          failure: "It closes a loop with the forecast: a title with no edge residency starts slower and opens at a lower rung, which depresses engagement.",
          handled:
            "That depresses its next forecast in turn, and there is no clean experiment to break the loop, because randomising residency means deliberately degrading real viewers.",
        },
        choice: {
          pick: "Batch model offline, ranked rows precomputed and cached in memory",
          instead: "Rank titles at request time on the browse call.",
          decider:
            "Read rate against model cadence. Every app open across ~300M memberships is a rows read, while the model output only changes on a daily cadence. Online ranking would spend CPU per request recomputing an answer that was already stable since last night.",
          flips: "Ranking that genuinely depends on in-session signals, where a row computed last night is already wrong by the time it is shown.",
        },
      },
    },
    {
      id: "catalogue",
      label: "Catalogue + rights",
      sub: "per-country view, wide-column",
      kind: "database",
      col: 2,
      row: 0,
      detail: {
        what: "Title metadata plus a rights table of (title_id, country, window_start, window_end), served as a per-country catalogue view.",
        why: "Licensing is per country, and windows open and close at midnight. Availability has to be a control-plane lookup on every play, rather than a property baked into anything cached or distributed.",
        numbers: [
          { value: "~20,000 titles globally", explain: "The full global catalogue size, small enough that every title's rights window can be enumerated rather than inferred." },
          { value: "~6,000 licensed in a given country", explain: "The subset actually available in one country at a time, which is what rows and placement are both scoped against." },
        ],
        breaks: {
          failure: "A client-supplied country would be a rights hole.",
          handled: "Geography is always resolved server-side from the connection, never accepted from the app, because rights holders audit exactly this.",
        },
        choice: {
          pick: "Wide-column store with an explicit per-country rights window table",
          instead: "Bake availability into the manifest or the edge configuration.",
          decider:
            "Rights change daily across ~20,000 titles and must take effect at the next play, not at the next deploy or cache TTL. When a title expires at midnight with 40,000 people mid-episode, the manifest stops listing it and the licence server refuses to reissue, and no bytes move.",
          flips: "A single-territory service with no per-country windows, where availability is a boolean on the title and a rights table is ceremony.",
        },
      },
    },
    {
      id: "drm",
      label: "DRM licence server",
      sub: "Widevine / PlayReady / FairPlay",
      kind: "service",
      col: 2,
      row: 1,
      detail: {
        what: "Issues a short-lived CENC content key bound to the requesting device and gated on the viewer's country.",
        why: "Segments sit encrypted on hardware in thousands of partner racks and the appliance never receives a key, so an ISP is hosting an opaque blob store. That property is what makes the commercial deal signable at all.",
        numbers: [
          { value: "licence issue p99 under 200 ms", explain: "The tightest of the three session-start SLOs — it alone can eat a fifth of the play-start budget, the last of three serial calls." },
          { value: "1 key per (device, session)", explain: "Keys are never baked into segments or shared across sessions, so revocation only ever needs to stop future issuance." },
        ],
        breaks: {
          failure: "Every play needs a key, so issuance sees the same instantaneous spike as a launch.",
          handled: "Servers are stateless and scaled to the launch calendar rather than steady state, and a seek or resume reuses the cached session key rather than re-issuing.",
        },
        choice: {
          pick: "CENC encryption at rest, keys only ever from the licence server",
          instead: "Plaintext segments protected by signed URLs, or encrypting at the edge.",
          decider:
            "The threat is not interception, it is a copy of the catalogue sitting on someone else's disk in ~18,000 buildings. A signed URL protects a transfer; it does nothing about the bytes at rest, and no rights holder signs off on that.",
          flips: "An entirely self-owned delivery fleet with no partner racks, where the storage is inside your own trust boundary and transport-level protection is enough.",
        },
      },
    },
    {
      id: "placement",
      label: "Placement controller",
      sub: "target set per appliance, nightly",
      kind: "service",
      col: 2,
      row: 3,
      detail: {
        what: "Computes a ranked target list of (title, codec, rung, audio track) segment groups per appliance. It diffs that list against the inventory the box reports, and has the box pull the difference in its local 02:00 to 06:00 window.",
        why: "Moving the expensive work in front of the request leaves the runtime path doing something simple: fetch a segment from a box that already has it. Every byte pushed to an edge is served roughly a hundred times, which is a great deal of room to be wrong.",
        numbers: [
          { value: "~500 GB per appliance per night", explain: "The typical nightly delta an appliance pulls, the forecast's output diffed against reported inventory." },
          { value: "~9 PB/day of fleet fill against 900 PB delivered, 100 to 1", explain: "Every byte pushed to the edge overnight is served roughly a hundred times during the following day." },
          { value: "~5 Tbps of fill, 4% of the 130 Tbps peak, in the quiet hours", explain: "Fill traffic is scheduled into the ISP's quiet hours, at a small fraction of the network's peak capacity." },
        ],
        breaks: {
          failure: "Without pinning, a plain LRU evicts the pre-positioned set during a global launch, exactly when it is needed.",
          handled: "Pinning is what stops the cache policy quietly undoing the placement policy. The pre-positioned set survives the exact demand spike it was built for, instead of arriving late through the expensive fill path.",
        },
        choice: {
          pick: "Forecast-driven pre-positioning with a pinned resident set",
          instead: "Treat every appliance as an ordinary pull-through cache filling on first request.",
          decider:
            "A country's relevant renditions are ~300 TB against a 200 TB appliance. The forecast is choosing which third to leave off, not picking 2% out of a haystack. A launch is ~1.7 PB of fill under either policy; pre-positioning just moves it from the peak hour to 3 a.m.",
          flips:
            "A user-generated corpus in the exabytes, where 200 TB is under 0.1% of the library and the popularity curve at that depth is unforecastable per access network. Pull-through with LRU is then simply correct.",
        },
      },
    },
    {
      id: "forecast",
      label: "Popularity forecast",
      sub: "merchandising plan weighted highest",
      kind: "service",
      col: 1,
      row: 3,
      detail: {
        what: "A per-region model over historical play counts by title, the release calendar, the device and language mix observed behind that specific appliance, and the merchandising plan.",
        why: "The output is segment groups, not whole titles. Two appliances in the same country hold materially different bytes. A smart-TV ISP wants the high rungs in HEVC and AV1; an Android-phone ISP wants the low rungs in H.264 and VP9.",
        numbers: [
          { value: "VOD popularity is close to Zipf with exponent near 1", explain: "A Zipf distribution means a small fraction of titles account for most viewing, which is what makes pre-positioning tractable at all." },
          {
            value: "a 20 TB box holding the top ~400 of 6,000 titles covers ~69% of viewing hours",
            explain: "A small slice of the catalogue, correctly forecast, covers most of what people actually watch.",
          },
        ],
        breaks: {
          failure: "A surprise hit nobody predicted live-fills across many appliances at once, during peak.",
          handled: "A live-fill rate spike across one region is the detection signal, and the response is an emergency targeted push before the demand curve steepens further.",
        },
        choice: {
          pick: "Forecast per (title, codec, rung, language) group, plus a residency floor",
          instead: "Rank whole titles and let the ladder land wherever it fits.",
          decider:
            "Device and language mix. Holding the wrong half of a ladder is the same as holding nothing. Audio and subtitle tracks are also a real fraction of a title once you carry thirty of them. The floor, the first episode of everything at two mid rungs, is 6,000 titles × ~3.6 GB ≈ 22 TB, about 10% of a 200 TB box.",
          flips: "A homogeneous device population with one codec and one language, where the ladder is not really a choice and title-level ranking says everything.",
        },
      },
    },
    {
      id: "origin",
      label: "Origin object store",
      sub: "2.4 PB servable, 40 PB mezzanine",
      kind: "database",
      col: 2,
      row: 2,
      detail: {
        what: "The authoritative encoded catalogue: every servable rendition, plus the cold mezzanine masters that never leave it.",
        why: "Origin is a fill source, not a delivery tier. It is sized for the nightly push and for the rare deep miss. The whole design exists so that almost nothing reads from it during the hours anyone is actually watching.",
        numbers: [
          { value: "~2.4 PB of servable renditions", explain: "The hot output tier: every encoded, packaged rendition currently servable to an appliance." },
          { value: "~40 PB of cold masters at ~500 GB per content-hour", explain: "The mezzanine archive, read only when a ladder is re-cut, roughly 17x the size of the servable output derived from it." },
          { value: "~120 GB per title", explain: "The average servable footprint per title across its full ladder of rungs and codecs." },
        ],
        breaks: {
          failure: "A rising origin_fill_rate is where the cost model fails first, since every fill byte is paid at retail during peak.",
          handled: "It is the single most important metric in the system, targeted under 5% at peak and paged above 10%, so a forecast miss is caught and corrected before it compounds.",
        },
        choice: {
          pick: "Object storage, servable renditions hot and mezzanine masters cold",
          instead: "Keep masters on the same tier, or re-encode from mezzanine on demand.",
          decider:
            "Access pattern against volume. Masters are ~40 PB against ~2.4 PB of output, a 17x difference. They are read only when a ladder is re-cut, a scheduled job with hours of slack rather than something a viewer waits on.",
          flips: "A catalogue small enough that the master archive is a rounding error, where one storage class is simpler than two.",
        },
      },
    },
    {
      id: "encoder",
      label: "Encode + package farm",
      sub: "content-aware ladder, 3 codecs",
      kind: "service",
      col: 3,
      row: 2,
      detail: {
        what: "Analyses each title's complexity, chooses its own ladder of 8 to 12 rungs across three codecs, cuts it into segments of a few seconds and packages them CENC-encrypted.",
        why: "The ladder is chosen once and the bytes are delivered forever. Animation with flat colour looks perfect at 1080p where a grainy action film needs three times the bitrate, and a fixed table has to be wrong for one of them.",
        numbers: [
          { value: "thousands of CPU hours per title across ~20,000 titles", explain: "The one-time encode cost per title, paid once and amortised over however many times the title is streamed." },
          { value: "~20% fewer bytes at the same perceptual quality, so ~180 PB/day that never moves", explain: "The saving a content-aware ladder buys over a fixed bitrate table, applied against the 900 PB/day delivery total." },
          { value: "~30 GB per content-hour of servable output", explain: "The average encoded output size per hour of content, after content-aware compression." },
        ],
        breaks: {
          failure: "A title whose encode finishes too late cannot be pre-positioned and gets pulled through at peak, at full price, in front of its largest audience.",
          handled:
            "The real deadline is the last fill window in the earliest timezone, roughly 36 hours before the launch timestamp. The encode queue is ordered against that deadline rather than the launch date.",
        },
        choice: {
          pick: "Content-aware per-title (and per-shot) ladder",
          instead: "One fixed bitrate table applied to everything.",
          decider:
            "Encode cost amortised over delivery. Thousands of CPU hours are paid once, against a catalogue of only ~20,000 titles. The published saving, around 20% of bytes at equal perceptual quality, is 180 PB a day off 900.",
          flips: "A catalogue of millions of items each watched a handful of times. There the encode cost per delivered byte is enormous and a fixed ladder is correct.",
        },
      },
    },
  ],
  edges: [
    {
      id: "e1",
      from: "client",
      to: "playback-api",
      fromSide: "right",
      toSide: "left",
      tier: "hot",
      step: 2,
      label: "POST /play",
      detail: {
        what: "Session start: device identity, profile and title id going to the cloud control plane.",
        why: "It is the only thing a viewer waits on that is not a video byte. It is also just a few kilobytes, which is precisely why it can live in a handful of cloud regions while delivery lives in 18,000 buildings.",
        numbers: [{ value: "play start p99 under 1,000 ms", explain: "This budget bounds only session start, never a running stream — once playing, a client never calls back through here until its licence needs renewal." }],
        breaks: {
          failure: "This call gates every new session; its loss means nobody can start a new stream.",
          handled: "Already-playing streams survive its loss entirely, since they touch no cloud service once running, so an outage looks like nobody being able to start rather than everybody stopping.",
        },
      },
    },
    {
      id: "e2",
      from: "playback-api",
      to: "catalogue",
      fromSide: "right",
      toSide: "left",
      tier: "control",
      label: "entitlement + country",
      detail: {
        what: "Checking that this account is entitled and that the title is inside its licensing window for the viewer's server-verified country.",
        why: "Rights live entirely in the control plane. A title leaving a market is therefore a metadata change, not a delete across the fleet. Enforcement happens at the only point that can be trusted.",
        breaks: {
          failure: "Trusting a client-supplied country here would be the rights hole.",
          handled: "The server derives country from the connection's own network path — IP geolocation on a verified session — rather than trusting any field the client app could report or spoof.",
        },
      },
    },
    {
      id: "e3",
      from: "playback-api",
      to: "manifest",
      fromSide: "bottom",
      toSide: "top",
      tier: "control",
      label: "issue manifest",
      detail: {
        what: "Handing the authorised (title, country, ASN, device) tuple to the service that knows what is resident where.",
        why: "Entitlement and steering are separate problems: one is about who you are, the other is about which boxes near you currently hold this title's renditions for your device class.",
        breaks: {
          failure: "Manifest issuance is stateful and uncacheable.",
          handled: "This hop cannot be collapsed into a CDN-cached response the way a public catalogue page could be, so it is provisioned as its own always-on service instead.",
        },
      },
    },
    {
      id: "e4",
      from: "playback-api",
      to: "drm",
      fromSide: "bottom",
      toSide: "top",
      tier: "control",
      label: "issue licence",
      detail: {
        what: "Requesting a short-lived content key for this title, bound to this device and gated on country.",
        why: "The key is issued per session rather than baked into the segments. Rights expiry is enforced at the next key request instead, without requiring anything to be deleted or re-encrypted.",
        numbers: [{ value: "licence issue p99 under 200 ms", explain: "Because this spikes as hard as playback at a launch, it's provisioned against the release calendar, not steady-state load, to hold 200ms under surge." }],
        breaks: {
          failure: "Key issuance spikes exactly as hard as playback does at a launch.",
          handled: "This path is kept stateless and provisioned against the release calendar rather than steady-state traffic, so it can absorb the spike.",
        },
      },
    },
    {
      id: "e5",
      from: "drm",
      to: "client",
      fromSide: "top",
      toSide: "top",
      tier: "control",
      label: "device-bound CENC key",
      offset: 40,
      detail: {
        what: "The content key returned to the player's DRM stack, short-lived and cached for the session.",
        why: "Only the device ever holds a key. The appliance serving the ciphertext never does, which is the property that makes putting a copy of the catalogue in a partner's rack acceptable to rights holders.",
        breaks: {
          failure: "If a title's rights lapse mid-session, the stream continues until this key expires.",
          handled: "Expiry is enforced at the next reissue rather than by interrupting playback, which trades a bounded delay in enforcement for never cutting off a viewer mid-scene.",
        },
      },
    },
    {
      id: "e6",
      from: "manifest",
      to: "client",
      fromSide: "left",
      toSide: "bottom",
      tier: "data",
      label: "3-4 ranked OCA URLs",
      offset: 70,
      detail: {
        what: "An HLS manifest listing the available rungs and three or four ranked appliance URLs to fetch segments from.",
        why: "Ranking rather than naming one box is what makes an appliance failure a quality dip instead of a stall. The player just moves to the next URL, and ABR re-converges under the buffer it already holds.",
        numbers: [
          { value: "3 to 4 ranked URLs", explain: "The failover list length; enough redundancy for an appliance outage without bloating the manifest." },
          { value: "8 to 12 rungs listed", explain: "The content-aware ladder size for this specific title, spanning its available codecs and quality levels." },
        ],
        breaks: {
          failure: "A stale manifest points at inventory that has since been evicted, turning what should be a hit into a fill.",
          handled: "A leaked manifest itself is harmless, since the segments it names are ciphertext; only staleness against real inventory is the risk, which is why manifest_issue latency is a gating metric.",
        },
      },
    },
    {
      id: "e7",
      from: "client",
      to: "oca",
      fromSide: "bottom",
      toSide: "top",
      tier: "hot",
      step: 3,
      label: "GET seg_00042.m4s",
      detail: {
        what: "The per-segment request: title, codec, rung and segment index, chosen fresh for each four seconds of video.",
        why: "The rung is decided per segment rather than per session. A choice made at second zero is either too low for the next two hours, or too high for the next ten seconds.",
        numbers: [
          { value: "one request per ~4s of playback", explain: "The segment duration sets the request cadence; each request is an independent rung decision." },
          { value: "~32M concurrent streams at peak", explain: "The concurrent load this per-segment request path has to sustain." },
        ],
        breaks: {
          failure: "Segments are immutable and addressed by (title, codec, rung, index).",
          handled: "There is no invalidation problem for the bytes themselves; every correctness question about what is available moves into the manifest instead.",
        },
      },
    },
    {
      id: "e8",
      from: "oca",
      to: "client",
      fromSide: "top",
      toSide: "bottom",
      tier: "hot",
      step: 4,
      label: "segment bytes, ~4 Mbps",
      offset: 60,
      detail: {
        what: "The video itself, served from SSD inside the viewer's own ISP and never touching the cloud.",
        why: "This is the arrow the whole design exists to shorten. At ~900 PB a day, whether these bytes cross a paid link or a settlement-free port inside the access network is the difference between roughly $650M and $150M a year.",
        numbers: [
          { value: "~4 Mbps weighted average", explain: "The average bitrate across the whole rung distribution and catalogue mix, used to size aggregate egress." },
          { value: "~130 Tbps at peak", explain: "32M concurrent streams at the weighted average bitrate is roughly this aggregate peak throughput." },
          { value: "~1.8 GB per viewing hour", explain: "The average data volume per hour of viewing at the weighted average bitrate." },
        ],
        breaks: {
          failure: "The appliance cannot fix the last mile; congestion in the access network is outside its control.",
          handled: "That congestion shows up as aggressive downward ABR on the player, which turns what would be a stall into a quality drop instead, the best available fallback.",
        },
      },
    },
    {
      id: "e10",
      to: "origin",
      fromSide: "right",
      toSide: "left",
      label: "miss: peer, IXP, then origin",
      from: "oca",
      tier: "hot",
      step: 5,
      detail: {
        what: "The deep miss: a segment nobody nearby holds, pulled from origin during whatever hour the viewer happened to press Play.",
        why: "Every byte on this arrow is one you pay for at retail, and it arrives at peak rather than at 3 a.m. It is treated as an incident signal, not as normal cache behaviour.",
        numbers: [{ value: "origin_fill_rate target under 5%, pages above 10%", explain: "The operating thresholds for this miss path; above 10% it is treated as an active incident." }],
        breaks: {
          failure: "A spike on this arrow means the forecast missed.",
          handled: "The response is an emergency targeted push before the demand curve steepens, with commercial CDN standing by as an expensive backstop for the meantime.",
        },
      },
    },
    {
      id: "e11",
      from: "placement",
      to: "oca",
      fromSide: "top",
      toSide: "bottom",
      tier: "control",
      label: "nightly delta 02:00-06:00",
      detail: {
        what: "The instruction: the diff between what this appliance holds and what the target list says it should hold, scheduled into its own local quiet window.",
        why: "Fill is the one large-volume transfer with nobody waiting on it. It can be pushed entirely into the hours when the ISP's network is empty, which is what makes the ISP happy to host the box.",
        numbers: [
          { value: "~500 GB per appliance per night", explain: "The typical nightly delta pushed to one appliance in its local quiet window." },
          { value: "~5 Tbps of fleet fill across a 4-hour window", explain: "The aggregate fill throughput across the fleet's roughly 4-hour nightly window." },
        ],
        breaks: {
          failure: "An appliance that misses its window is not merely stale; it will live-fill through paid paths during the next peak.",
          handled: "Completion is measured against the fill deadline rather than the launch date, so a fleet falling behind is caught with time left to react.",
        },
      },
    },
    {
      id: "e12",
      from: "origin",
      to: "oca",
      fromSide: "bottom",
      toSide: "bottom",
      tier: "data",
      label: "fill bytes, ~500 GB/night",
      detail: {
        what: "The actual pre-positioned bytes moving out to the edge: about 20 content-hours of genuinely new material a day plus forecast churn.",
        why: "This is the trade the whole programme rests on. ~9 PB a day of fill enables ~900 PB a day of delivery, so every byte pushed is served roughly a hundred times.",
        numbers: [{ value: "~9 PB/day of fleet fill against 900 PB delivered", explain: "The fill-to-delivery ratio that makes pre-positioning worthwhile even when the forecast is imperfect." }],
        breaks: {
          failure: "The instinctive objection is that this wastes bandwidth on content nobody ends up watching.",
          handled: "At 100-to-1 amortisation the forecast can be badly wrong and still pay for itself, which is the margin that makes imperfect forecasting acceptable.",
        },
      },
    },
    {
      id: "e13",
      from: "oca",
      to: "placement",
      fromSide: "bottom",
      toSide: "top",
      tier: "control",
      label: "inventory manifest",
      detail: {
        what: "Each appliance reporting what it currently holds, so the controller can diff rather than re-push.",
        why: "Placement is a delta problem. Without an accurate inventory the controller either re-sends bytes that are already resident or believes in bytes that were evicted from the unpinned remainder.",
        breaks: {
          failure: "Stale inventory poisons steering too, since the manifest service filters on this same state.",
          handled: "It is served from a read-optimised replica that tolerates only minutes of staleness, so a placement decision and a steering decision never disagree for long.",
        },
      },
    },
    {
      id: "e14",
      from: "placement",
      to: "manifest",
      fromSide: "right",
      toSide: "bottom",
      tier: "control",
      label: "inventory + health",
      detail: {
        what: "Fleet state feeding the steering filter: which boxes are up, which have headroom, and which actually hold this title's renditions.",
        why: "This edge is what separates the design from a generic CDN. Steering can only be inventory-aware if something already knows the inventory, and the controller that placed the bytes is the thing that knows.",
        breaks: {
          failure: "If this state goes stale or unavailable, steering loses its inventory awareness.",
          handled: "It degrades to a static per-ASN edge list instead, which stays up but raises the miss rate, and therefore the bill, rather than failing closed.",
        },
      },
    },
    {
      id: "e15",
      from: "forecast",
      to: "placement",
      fromSide: "right",
      toSide: "left",
      tier: "control",
      label: "target set per appliance",
      detail: {
        what: "The ranked list of segment groups each specific appliance should hold, split by that ISP's device and language mix.",
        why: "The forecast decides what is worth holding, and the controller decides how to get it there. Keeping them apart means the model can be retrained without touching the machinery that moves petabytes.",
        numbers: [{ value: "4 dimensions ranked: title, codec, rung, audio track", explain: "The forecast output is this granular, not just a title ranking, because device and language mix vary by appliance." }],
        breaks: {
          failure: "The strongest input is the merchandising plan, which is decided in-house.",
          handled: "The model's accuracy metrics flatter that input, and anything never promoted on the home screen is quietly penalised in the forecast whether or not it deserved to be.",
        },
      },
    },
    {
      id: "e16",
      from: "client",
      to: "telemetry",
      fromSide: "left",
      toSide: "left",
      tier: "data",
      label: "heartbeat /30s, 200 B",
      offset: 90,
      detail: {
        what: "Position, rung, rebuffer and switch events emitted every 30 seconds per stream.",
        why: "It is the only signal we have about what actually happened on the far side of a box in someone else's building. It is also small enough that shipping it to the cloud from 32M streams is irrelevant next to the video itself.",
        numbers: [
          { value: "~1.1M events/s", explain: "32M concurrent streams heartbeating roughly every 30 seconds produces this aggregate rate." },
          { value: "~220 MB/s, ~19 TB/day raw", explain: "The raw ingest volume at ~200 bytes per heartbeat, before downstream compaction." },
        ],
        breaks: {
          failure: "The player must never block on this arrow.",
          handled: "A heartbeat implemented as a synchronous dependency would turn an analytics outage into a global rebuffer event, so it stays fire-and-forget with a small client buffer.",
        },
      },
    },
    {
      id: "e17",
      from: "telemetry",
      to: "forecast",
      fromSide: "right",
      toSide: "left",
      tier: "control",
      label: "play counts, device mix",
      detail: {
        what: "Aggregated regional play counts, plus the device and language mix observed behind each specific appliance.",
        why: "This is what closes the loop from yesterday's viewing to tonight's placement. The per-appliance device mix is also why two boxes in the same country hold different halves of the same ladders.",
        breaks: {
          failure: "The loop is self-referential: residency shapes engagement, and engagement shapes the forecast.",
          handled: "There is no clean counterfactual to measure the loop's effect, because doing so means deliberately degrading real viewers' residency to find out.",
        },
      },
    },
    {
      id: "e18",
      from: "telemetry",
      to: "recs",
      fromSide: "bottom",
      toSide: "right",
      tier: "control",
      label: "watch history + QoE",
      offset: 110,
      detail: {
        what: "Per-profile watch history and completion feeding the offline ranking model, and quality signals feeding ABR tuning.",
        why: "Continue Watching and the ranked rows are both reads of the same event stream, which is why the heartbeat carries position rather than just liveness.",
        breaks: {
          failure: "The resume position users notice cannot come from the heartbeat stream alone.",
          handled: "It is written separately, on pause and exit, because a dropped fire-and-forget heartbeat would otherwise rewind a viewer's progress.",
        },
      },
    },
    {
      id: "e19",
      from: "recs",
      to: "client",
      fromSide: "top",
      toSide: "top",
      tier: "control",
      label: "ranked rows per profile",
      detail: {
        what: "The home screen: precomputed rows filtered to the titles licensed in this country.",
        why: "Browse is where the session actually starts. It is deliberately kept off the playback path, so a ranking outage degrades to a generic catalogue view rather than stopping anyone watching.",
        breaks: {
          failure: "What this row set promotes becomes the strongest input to tomorrow's placement forecast.",
          handled: "A merchandising change is therefore also a capacity decision, whether or not the team making it treats it as one, since it shifts what gets pre-positioned.",
        },
      },
    },
    {
      id: "e20",
      from: "encoder",
      to: "origin",
      fromSide: "left",
      toSide: "right",
      tier: "hot",
      step: 1,
      label: "ladder: 8-12 rungs, CENC",
      detail: {
        what: "Finished renditions, segmented and encrypted, written to origin as the authoritative copy.",
        why: "Publication to origin is the event that makes a title placeable. Nothing can be pre-positioned until the bytes it will hold exist and are final.",
        numbers: [
          { value: "~30 GB per content-hour", explain: "The average encoded, servable output size per hour of finished content." },
          { value: "~120 GB per title", explain: "The average total servable footprint per title, across its full ladder." },
        ],
        breaks: {
          failure: "Re-cutting a ladder after publication means re-filling every appliance that already holds it.",
          handled: "Encode decisions are effectively frozen once the nightly push has run, which is why the content-aware ladder choice happens once, offline, rather than being revisited.",
        },
      },
    },
    {
      id: "e21",
      from: "placement",
      to: "encoder",
      fromSide: "right",
      toSide: "bottom",
      tier: "control",
      label: "fill-window deadline",
      offset: 100,
      detail: {
        what: "The encoder queue ordered by each title's last useful fill window rather than by its launch date.",
        why: "For a Friday 00:00 UTC global drop, the earliest timezone's last window is Thursday morning, so the encode has to be locked by Wednesday. That is roughly 36 hours earlier than teams scheduling against the launch date assume.",
        breaks: {
          failure: "When the fleet is behind schedule, a full ladder cannot make its fill window.",
          handled:
            "The documented fallback is a reduced ladder: drop AV1 and the top 4K rung to make the window. A title shipping with two codecs is a quality regression; a title shipping unpositioned is a cost incident, and the reduced ladder is the lesser of the two.",
        },
      },
    },
  ],
};
