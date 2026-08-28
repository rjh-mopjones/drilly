import type { Diagram } from "./types";

export const NETFLIX: Diagram = {
  id: "netflix",
  title: "Netflix",
  question: "Design Netflix (Video Streaming)",
  sourceId: "patterns",
  itemId: 31,
  overview: {
    shape:
      "A placement problem wearing a streaming problem's clothes: a cloud control plane that costs kilobytes per session and never touches a video byte, and a fleet of appliances inside ISPs that already hold the bytes before anyone presses Play.",
    beats: [
      "The catalogue is finite and known weeks ahead, roughly 20,000 titles with about 6,000 licensed in any one country, so the set of bytes anyone might ask for can be enumerated. That single fact is what turns delivery from a routing problem into a planning problem, and everything distinctive here follows from it.",
      "Content is prepared entirely offline. Each title gets a content-aware ladder of 8 to 12 rungs across three codecs, chosen from that title's own complexity rather than a fixed table, sliced into segments of a few seconds and encrypted under CENC. The ladder is decided once and the bytes are delivered forever, which is what justifies thousands of CPU hours per title.",
      "Placement is the interesting decision. A controller computes a per-appliance target list of (title, codec, rung, audio track) groups from a regional forecast, diffs it against what the box reports holding, and pushes the delta in the local 02:00 to 06:00 window. Around 500 GB per appliance per night, roughly 9 PB across the fleet, against 900 PB delivered: every byte pushed is served about a hundred times.",
      "The arithmetic is unusually kind. A country's relevant renditions come to about 300 TB and a storage appliance holds 200 TB, so the forecast is not picking 2% of a haystack, it is choosing which third to leave off. The resident set is pinned and only the remainder of the disk runs LRU, because a plain LRU would evict the pre-positioned set during exactly the launch it was built for.",
      "Session start is three small cloud calls: authenticate and check the country's rights, issue a manifest listing three or four ranked appliance URLs, issue a short-lived DRM key bound to the device. Steering lives in the manifest rather than in DNS because anycast cannot see inventory and will happily route a client to a box that does not hold the title.",
      "Then the player takes over. It picks the next segment's rung from its own buffer occupancy, stepping up above 40 seconds and down immediately below 10, never more than one rung per segment, and heartbeats its position every 30 seconds. Those heartbeats are the only return path and they feed the forecast that decides tomorrow's placement.",
    ],
    crux:
      "A title nobody forecast trends on a Saturday morning. The appliances near those viewers do not hold it, so every play fills from a peer or from origin during the peak hour rather than at 3 a.m., through paid paths, at terabits per second. A cache miss here is a planning failure with a bill attached, not a latency event, which is why origin fill rate per appliance is a paged metric rather than a dashboard one.",
    numbers: [
      "~900 PB/day delivered, ~130 Tbps at peak, ~32M concurrent",
      "~300 TB regional catalogue against a 200 TB appliance",
      "~9 PB/day of nightly fill against 900 PB delivered, 100 to 1",
    ],
  },
  nodes: [
    {
      id: "edge-group",
      label: "Data plane, inside the ISP",
      kind: "zone",
      x: 24,
      y: 344,
      w: 312,
      h: 202,
      detail: {
        what: "The half of the system that moves petabytes: an appliance in the viewer's own access network, plus the peer and exchange tiers it fills from.",
        why: "The control plane and the data plane never touch. One costs a few kilobytes per session and lives in the cloud, the other costs 900 PB a day and lives inside other people's buildings, and merging them would destroy both the economics and the routing.",
        numbers: ["~18,000 appliances", "~130 Tbps peak egress", "settlement-free ports"],
        breaks:
          "Everything in this zone sits in a partner's rack on their power and behind their routing policy, so we have no independent measurement point between the appliance and the home.",
      },
    },
    {
      id: "client",
      label: "Client player",
      sub: "buffer-based ABR, 4s segments",
      kind: "external",
      x: 40,
      y: 0,
      w: 280,
      detail: {
        what: "The TV, phone or browser that fetches segments, runs the rung selection law and heartbeats its position back every 30 seconds.",
        why: "The rung decision has to live here because only the player can see its own buffer, and the network underneath a two-hour session changes: wifi contention, a cellular handoff, someone else in the house starting a download.",
        numbers: [
          "step up above 40s of buffer, down below 10s",
          "one rung per segment, 120 to 240s buffer held",
          "~32M concurrent streams at peak",
        ],
        breaks:
          "Rung oscillation after a network handoff, and a startup with no buffer to read, which is why the first rung comes from historical per-ASN statistics rather than a measurement that does not exist yet.",
        choice: {
          pick: "Buffer-occupancy ABR after startup, one rung per segment",
          instead: "Estimate recent throughput from the last few segments and pick the highest rung that fits.",
          decider:
            "Buffer depth against segment duration. With 4s segments and a 120 to 240s buffer, occupancy integrates 30 to 60 segments of history and is low variance, whereas a per-segment throughput estimate on cellular can have a coefficient of variation above 50% and will oscillate the ladder.",
          flips:
            "When the buffer is too shallow to carry information: low-latency live at a 2 to 4 second target buffer, and the first few segments of any session. Both fall back to throughput.",
        },
      },
    },
    {
      id: "playback-api",
      label: "Playback API",
      sub: "auth, entitlement, server-verified geo",
      kind: "service",
      x: 40,
      y: 110,
      w: 280,
      detail: {
        what: "The cloud call behind POST /play: authenticates the session, checks the viewer's country rights for the title, then fans out to the manifest service and the licence server.",
        why: "Keeping auth and rights in the cloud costs a few kilobytes per session and keeps rights changes as metadata changes. A title leaving a country stops being listed and stops getting keys, with nothing deleted across 18,000 boxes.",
        numbers: ["a few kB per session", "play start p99 under 1,000 ms", "99.95% playback start success SLO"],
        breaks:
          "A regional cloud outage stops new sessions. Streams already running are untouched because they touch no cloud service until their licence expires, which is a deliberate property rather than luck.",
        choice: {
          pick: "Control plane in the cloud, active-active, never touching a video byte",
          instead: "One tier that serves both session setup and segments.",
          decider:
            "The two halves share nothing. Control is a few kB per session and needs a handful of regions; data is 900 PB a day and needs 18,000 boxes inside other networks. Sizing, placement and failure domain are different by four orders of magnitude.",
          flips:
            "A service small enough that one tier is cheaper to run than two, where the delivery volume never justifies its own topology.",
        },
      },
    },
    {
      id: "manifest",
      label: "Manifest + steering",
      sub: "inventory-aware, resolved per ASN",
      kind: "service",
      x: 40,
      y: 220,
      w: 280,
      detail: {
        what: "Resolves the client address to an ASN, filters the appliances serving it to those that are healthy, have headroom and actually hold this title's renditions, and returns three or four ranked URLs plus the rung list.",
        why: "Inventory-aware steering is what makes a miss rare rather than merely cheap. It is also what gives the player a failover list, so an appliance dying mid-session is a brief quality dip while ABR re-converges, not a stall.",
        numbers: ["3 to 4 ranked appliance URLs per play", "one uncacheable call per play", "manifest_issue p99 is a gating metric"],
        breaks:
          "This is the one component whose loss stops new sessions worldwide even though every appliance is healthy. Degraded mode returns a static per-ASN edge list with no inventory filter, trading a higher miss rate and a higher bill for staying up.",
        choice: {
          pick: "Steer in the manifest we issue ourselves",
          instead: "Steer with anycast or DNS the way a commercial CDN does.",
          decider:
            "Anycast and DNS route on network proximity and cannot see inventory, so they will send a client to a box that does not hold the object and let the miss sort itself out. With origin fill targeted under 5%, steering that is blind to what is resident is the fastest way to blow that budget.",
          flips:
            "A uniform cache where every node holds the same objects, so proximity is the only variable and there is nothing for inventory awareness to add.",
        },
      },
    },
    {
      id: "oca",
      label: "Open Connect appliance",
      sub: "200 TB SSD, pinned resident set",
      kind: "service",
      x: 40,
      y: 360,
      w: 280,
      detail: {
        what: "A Linux box running a caching HTTP server, installed free inside an ISP's data centre on a settlement-free port, serving CENC-encrypted segments off SSD.",
        why: "This is the economic story. Bytes for a viewer in Chicago come from a box in Chicago inside their own ISP, so the peak-hour byte never crosses a paid link, and every appliance serves its own network independently with no shared hot path to scale.",
        numbers: [
          "200 TB per storage appliance, ~18,000 in the fleet",
          "controller-placed segments are pinned, only the remainder runs LRU",
          "~$500/month fully loaded per box",
        ],
        breaks:
          "The appliance removes the ISP's upstream transit from the path but not the access network itself. Last-mile congestion looks identical in our telemetry to an ISP quietly de-prioritising the box, and the subscriber blames us either way.",
        choice: {
          pick: "Own the hardware and place it inside access networks, given to the ISP",
          instead: "Buy delivery per byte from commercial CDNs and stay out of the hardware business.",
          decider:
            "Cost per site, not globally. About $500/month all-in per appliance buys 250 TB/month at an aggressive $0.002/GB, which is ~770 Mbps sustained or roughly 200 concurrent streams. Any ISP with a few tens of thousands of streaming households clears that. Globally it is ~$150M/year of fleet against ~$650M/year of CDN spend.",
          flips:
            "Below the crossover, which is most networks by count though a small share of traffic, and in markets where hosting a content provider's hardware is commercially or legally off the table at any price.",
        },
      },
    },
    {
      id: "peer-ix",
      label: "Peer OCA / IXP fill",
      sub: "miss path before origin",
      kind: "service",
      x: 40,
      y: 470,
      w: 280,
      detail: {
        what: "The fill hierarchy on a miss: a peer appliance on the same network, then an appliance at an exchange where the ISP peers, then a backbone site, then origin.",
        why: "Being absent from a box is meant to cost a few milliseconds of first-segment latency, not a failure and not an origin byte. The bottom third of the country's catalogue is deliberately not resident, so this path is load-bearing by design.",
        numbers: ["origin fill targeted under 5% at peak", "the omitted third of the catalogue lives one hop away"],
        breaks:
          "The first two tiers sit inside networks we do not own, so promoting a tier is a commercial negotiation rather than a capacity decision, and the hierarchy is deepest where the business relationship is strongest, not where the traffic is heaviest.",
        choice: {
          pick: "Peer, then exchange, then backbone, then origin",
          instead: "Go straight to origin on any miss.",
          decider:
            "Every origin byte is billed and arrives at the worst moment. A launch that missed the push is the same ~1.7 PB of fill either way, but going direct puts 3.8 Tbps of origin egress into the peak hour instead of into a peering fabric that is already paid for.",
          flips:
            "A thin fleet with no peer density in the region, where the extra hops just add latency to a miss that was always going to reach origin.",
        },
      },
    },
    {
      id: "telemetry",
      label: "Playback telemetry",
      sub: "Kafka, 200 B every 30s, fire and forget",
      kind: "queue",
      x: 40,
      y: 600,
      w: 280,
      detail: {
        what: "The only return path from the player: position heartbeats, rebuffer and rung-switch events, streamed onto a log and compacted downstream.",
        why: "This is what makes Continue Watching work and what feeds both the QoE loop that tunes ABR and the play counts the placement forecast trains on. It is also tiny, which is why it can cross the cloud boundary at all.",
        numbers: ["~1.1M events/s at peak", "~220 MB/s, ~19 TB/day raw before compaction"],
        breaks:
          "Backpressure must never reach the player. The resume position users actually notice is written on pause and on exit, not on the heartbeat path, because a blocked heartbeat would become a rebuffer for a bookkeeping call.",
        choice: {
          pick: "Fire-and-forget heartbeats onto a durable log with a small client buffer",
          instead: "Write the position synchronously per beat and acknowledge it.",
          decider:
            "1.1M events/s at peak against a rebuffer budget of 0.5% of playback time. A synchronous write puts a cloud round trip in the player's loop 30 times a session for data that is worth losing, and any regional wobble becomes a global quality incident.",
          flips:
            "When the event is billing-grade rather than analytics-grade, where losing a heartbeat costs money and the write has to be acknowledged.",
        },
      },
    },
    {
      id: "recs",
      label: "Personalised rows",
      sub: "offline model, precomputed per profile",
      kind: "service",
      x: 440,
      y: 0,
      w: 240,
      detail: {
        what: "Ranked home-screen rows computed offline per profile and served from an in-memory cache as profile_id to a list of (title_id, score).",
        why: "The home screen is the strongest single predictor of what a country watches tomorrow, and it is decided in-house, which is exactly why merchandising is weighted most heavily in the placement forecast.",
        numbers: ["~300M memberships, multiple profiles each", "rows scoped to the country's ~6,000 licensed titles"],
        breaks:
          "It closes a loop with the forecast. A title with no edge residency starts slower and opens at a lower rung, which depresses engagement, which depresses its next forecast, and there is no clean experiment because randomising residency means degrading real viewers.",
        choice: {
          pick: "Batch model offline, ranked rows precomputed and cached in memory",
          instead: "Rank candidates at request time on the browse call.",
          decider:
            "Read rate against model cadence. Every app open across ~300M memberships is a rows read, while the model output changes on a daily cadence, so online ranking spends CPU per request recomputing an answer that was stable since last night.",
          flips:
            "Ranking that genuinely depends on in-session signals, where a row computed last night is already wrong by the time it is shown.",
        },
      },
    },
    {
      id: "catalogue",
      label: "Catalogue + rights",
      sub: "per-country view, wide-column",
      kind: "database",
      x: 440,
      y: 110,
      w: 240,
      detail: {
        what: "Title metadata plus a rights table of (title_id, country, window_start, window_end), served as a per-country catalogue view.",
        why: "Licensing is per country and windows open and close at midnight, so availability has to be a control-plane lookup on every play rather than a property baked into anything cached or distributed.",
        numbers: ["~20,000 titles globally", "~6,000 licensed in a given country"],
        breaks:
          "Geography must be server-verified. A client-supplied country is a rights hole, and rights holders audit exactly this.",
        choice: {
          pick: "Wide-column store with an explicit per-country rights window table",
          instead: "Bake availability into the manifest or the edge configuration.",
          decider:
            "Rights change daily across ~20,000 titles and must take effect at the next play, not at the next deploy or cache TTL. When a title expires at midnight with 40,000 people mid-episode, the manifest stops listing it and the licence server refuses to reissue, and no bytes move.",
          flips:
            "A single-territory service with no per-country windows, where availability is a boolean on the title and a rights table is ceremony.",
        },
      },
    },
    {
      id: "drm",
      label: "DRM licence server",
      sub: "Widevine / PlayReady / FairPlay",
      kind: "service",
      x: 440,
      y: 220,
      w: 240,
      detail: {
        what: "Issues a short-lived CENC content key bound to the requesting device and gated on the viewer's country.",
        why: "Segments sit encrypted on hardware in thousands of partner racks and the appliance never receives a key, so an ISP is hosting an opaque blob store. That property is what makes the commercial deal signable at all.",
        numbers: ["licence issue p99 under 200 ms", "keys cached per device for the session"],
        breaks:
          "Every play needs a key, so issuance sees the same instantaneous spike as a launch. Servers are stateless and scaled to the launch calendar rather than to steady state, and a seek or resume must not re-issue.",
        choice: {
          pick: "CENC encryption at rest, keys only ever from the licence server",
          instead: "Plaintext segments protected by signed URLs, or encrypting at the edge.",
          decider:
            "The threat is not interception, it is a copy of the catalogue sitting on someone else's disk in ~18,000 buildings. A signed URL protects a transfer; it does nothing about the bytes at rest, and no rights holder signs off on that.",
          flips:
            "An entirely self-owned delivery fleet with no partner racks, where the storage is inside your own trust boundary and transport-level protection is enough.",
        },
      },
    },
    {
      id: "placement",
      label: "Placement controller",
      sub: "target set per appliance, nightly delta",
      kind: "service",
      x: 440,
      y: 360,
      w: 240,
      detail: {
        what: "Computes a ranked target list of (title, codec, rung, audio track) segment groups per appliance, diffs it against the inventory the box reports, and has it pull the difference in its local 02:00 to 06:00 window.",
        why: "Moving the expensive work in front of the request leaves the runtime path doing something simple: fetch a segment from a box that already has it. Every byte pushed to an edge is served roughly a hundred times, which is a great deal of room to be wrong.",
        numbers: [
          "~500 GB per appliance per night",
          "~9 PB/day of fleet fill against 900 PB delivered, 100 to 1",
          "~5 Tbps of fill, 4% of the 130 Tbps peak, in the quiet hours",
        ],
        breaks:
          "Pinning is what stops the cache policy quietly undoing the placement policy. Without it, a plain LRU evicts the pre-positioned set during a global launch to make room for what is being requested right now, which is the pre-positioned set arriving late through the expensive path.",
        choice: {
          pick: "Forecast-driven pre-positioning with a pinned resident set",
          instead: "Treat every appliance as an ordinary pull-through cache filling on first request.",
          decider:
            "Catalogue size against edge storage. A country's relevant renditions are ~300 TB and a storage appliance holds 200 TB, so the forecast is choosing which third to leave off rather than picking 2% out of a haystack. A launch is ~1.7 PB of fill under either policy; pre-positioning just moves it from the peak hour to 3 a.m.",
          flips:
            "A user-generated corpus in the exabytes, where 200 TB is under 0.1% of the library and the popularity curve at that depth is unforecastable per access network. Pull-through with LRU is then simply correct, and that is Q11.",
        },
      },
    },
    {
      id: "forecast",
      label: "Popularity forecast",
      sub: "merchandising plan weighted highest",
      kind: "service",
      x: 440,
      y: 470,
      w: 240,
      detail: {
        what: "A per-region model over historical play counts by title, the release calendar, the device and language mix observed behind that specific appliance, and the merchandising plan.",
        why: "The output is segment groups, not titles, because two appliances in the same country hold materially different bytes: a smart-TV ISP wants the high rungs in HEVC and AV1, an Android-phone ISP wants the low rungs in H.264 and VP9.",
        numbers: [
          "VOD popularity is close to Zipf with exponent near 1",
          "a 20 TB box holding the top ~400 of 6,000 titles covers ~69% of viewing hours",
        ],
        breaks:
          "A surprise hit nobody predicted, which live-fills across many appliances at once during peak. A live-fill rate spike across one region is the detection signal, and the response is an emergency targeted push.",
        choice: {
          pick: "Forecast per (title, codec, rung, language) group, plus a residency floor",
          instead: "Rank whole titles and let the ladder land wherever it fits.",
          decider:
            "Device and language mix. Holding the wrong half of a ladder is the same as holding nothing, and audio and subtitle tracks are a real fraction of a title once you carry thirty of them. The floor, the first episode of everything at two mid rungs, is 6,000 titles x ~3.6 GB = ~22 TB, about 10% of a 200 TB box.",
          flips:
            "A homogeneous device population with one codec and one language, where the ladder is not really a choice and title-level ranking says everything.",
        },
      },
    },
    {
      id: "origin",
      label: "Origin object store",
      sub: "2.4 PB servable, 40 PB mezzanine",
      kind: "database",
      x: 440,
      y: 580,
      w: 240,
      detail: {
        what: "The authoritative encoded catalogue: every servable rendition, plus the cold mezzanine masters that never leave it.",
        why: "Origin is a fill source, not a delivery tier. It is sized for the nightly push and for the rare deep miss, and the whole design exists so that almost nothing reads from it during the hours anyone is watching.",
        numbers: ["~2.4 PB of servable renditions", "~40 PB of cold masters at ~500 GB per content-hour", "~120 GB per title"],
        breaks:
          "origin_fill_rate per appliance is the single most important metric in the system, targeted under 5% at peak and paged above 10%, because it is where the cost model fails first.",
        choice: {
          pick: "Object storage, servable renditions hot and mezzanine masters cold",
          instead: "Keep masters on the same tier, or re-encode from mezzanine on demand.",
          decider:
            "Access pattern against volume. Masters are ~40 PB against ~2.4 PB of output, a 17x difference, and they are read only when a ladder is re-cut, which is a scheduled job with hours of slack rather than something a viewer waits on.",
          flips:
            "A catalogue small enough that the master archive is a rounding error, where one storage class is simpler than two.",
        },
      },
    },
    {
      id: "encoder",
      label: "Encode + package farm",
      sub: "content-aware ladder, 3 codecs",
      kind: "service",
      x: 440,
      y: 690,
      w: 240,
      detail: {
        what: "Analyses each title's complexity, chooses its own ladder of 8 to 12 rungs across three codecs, cuts it into segments of a few seconds and packages them CENC-encrypted.",
        why: "The ladder is chosen once and the bytes are delivered forever. Animation with flat colour looks perfect at 1080p where a grainy action film needs three times the bitrate, and a fixed table has to be wrong for one of them.",
        numbers: [
          "thousands of CPU hours per title across ~20,000 titles",
          "~20% fewer bytes at the same perceptual quality, so ~180 PB/day that never moves",
          "~30 GB per content-hour of servable output",
        ],
        breaks:
          "The real deadline is the last fill window in the earliest timezone, roughly 36 hours before the launch timestamp. A title whose encode finishes on Thursday evening cannot be pre-positioned and gets pulled through at peak, at full price, in front of its largest ever audience.",
        choice: {
          pick: "Content-aware per-title (and per-shot) ladder",
          instead: "One fixed bitrate table applied to everything.",
          decider:
            "Encode cost amortised over delivery. Thousands of CPU hours are paid once against a catalogue of only ~20,000 titles, and the published saving of around 20% of bytes at equal perceptual quality is 180 PB a day off 900.",
          flips:
            "A catalogue of millions of items each watched a handful of times. There the encode cost per delivered byte is enormous and a fixed ladder is correct, which is the user-generated version of this problem.",
        },
      },
    },
  ],
  edges: [
    {
      id: "e1",
      from: "client",
      to: "playback-api",
      label: "POST /play",
      dashed: true,
      detail: {
        what: "Session start: device identity, profile and title id going to the cloud control plane.",
        why: "It is the only thing a viewer waits on that is not a video byte, and it is a few kilobytes, which is precisely why it can live in a handful of cloud regions while delivery lives in 18,000 buildings.",
        numbers: ["play start p99 under 1,000 ms"],
        breaks:
          "This call gates every new session. Already-playing streams survive its loss entirely, so an outage looks like nobody being able to start rather than everybody stopping.",
      },
    },
    {
      id: "e2",
      from: "playback-api",
      to: "catalogue",
      label: "entitlement + country",
      dashed: true,
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "Checking that this account is entitled and that the title is inside its licensing window for the viewer's server-verified country.",
        why: "Rights live entirely in the control plane, so a title leaving a market is a metadata change rather than a delete across the fleet, and enforcement happens at the only point that can be trusted.",
        breaks:
          "Trusting a client-supplied country here is the rights hole. Geography has to be resolved server-side from the connection, never accepted from the app.",
      },
    },
    {
      id: "e3",
      from: "playback-api",
      to: "manifest",
      label: "issue manifest",
      dashed: true,
      detail: {
        what: "Handing the authorised (title, country, ASN, device) tuple to the service that knows what is resident where.",
        why: "Entitlement and steering are separate problems: one is about who you are, the other is about which boxes near you currently hold this title's renditions for your device class.",
        breaks:
          "Manifest issuance is stateful and uncacheable, so this hop cannot be collapsed into a CDN-cached response the way a public catalogue page could be.",
      },
    },
    {
      id: "e4",
      from: "playback-api",
      to: "drm",
      label: "issue licence",
      dashed: true,
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "Requesting a short-lived content key for this title, bound to this device and gated on country.",
        why: "The key is issued per session rather than baked into the segments, so rights expiry is enforced at the next key request instead of requiring anything to be deleted or re-encrypted.",
        numbers: ["licence issue p99 under 200 ms"],
        breaks:
          "Key issuance spikes exactly as hard as playback does at a launch, so this path has to be stateless and provisioned against the release calendar.",
      },
    },
    {
      id: "e5",
      from: "drm",
      to: "client",
      label: "device-bound CENC key",
      dashed: true,
      fromSide: "top",
      toSide: "right",
      offset: 40,
      detail: {
        what: "The content key returned to the player's DRM stack, short-lived and cached for the session.",
        why: "Only the device ever holds a key. The appliance serving the ciphertext never does, which is the property that makes putting a copy of the catalogue in a partner's rack acceptable to rights holders.",
        breaks:
          "If a title's rights lapse mid-session the stream continues until this key expires, because expiry is enforced at reissue rather than by interrupting playback.",
      },
    },
    {
      id: "e6",
      from: "manifest",
      to: "client",
      label: "3-4 ranked OCA URLs",
      dashed: true,
      fromSide: "left",
      toSide: "left",
      offset: 70,
      detail: {
        what: "An HLS manifest listing the available rungs and three or four ranked appliance URLs to fetch segments from.",
        why: "Ranking rather than naming one box is what makes an appliance failure a quality dip instead of a stall: the player just moves to the next URL and ABR re-converges under the buffer it already holds.",
        numbers: ["3 to 4 ranked URLs", "8 to 12 rungs listed"],
        breaks:
          "A leaked manifest is harmless because the segments are ciphertext, but a stale one points at inventory that has since been evicted, which turns a hit into a fill.",
      },
    },
    {
      id: "e7",
      from: "client",
      to: "oca",
      label: "GET seg_00042.m4s",
      animated: true,
      detail: {
        what: "The per-segment request: title, codec, rung and segment index, chosen fresh for each four seconds of video.",
        why: "The rung is decided per segment rather than per session because a choice made at second zero is either too low for the next two hours or too high for the next ten seconds.",
        numbers: ["one request per ~4s of playback", "~32M concurrent streams at peak"],
        breaks:
          "Segments are immutable and addressed by (title, codec, rung, index), so there is no invalidation problem for bytes; every correctness question moves into the manifest instead.",
      },
    },
    {
      id: "e8",
      from: "oca",
      to: "client",
      label: "segment bytes, ~4 Mbps",
      animated: true,
      fromSide: "right",
      toSide: "right",
      offset: 60,
      detail: {
        what: "The video itself, served from SSD inside the viewer's own ISP and never touching the cloud.",
        why: "This is the arrow the whole design exists to shorten. At ~900 PB a day, whether these bytes cross a paid link or a settlement-free port inside the access network is the difference between roughly $650M and $150M a year.",
        numbers: ["~4 Mbps weighted average", "~130 Tbps at peak", "~1.8 GB per viewing hour"],
        breaks:
          "The appliance cannot fix the last mile. Congestion in the access network shows up as aggressive downward ABR, which turns a stall into a quality drop and nothing better.",
      },
    },
    {
      id: "e9",
      from: "oca",
      to: "peer-ix",
      label: "miss: peer, then IXP",
      detail: {
        what: "A request for a segment group this box does not hold, escalating to a peer appliance on the same network and then to one at the exchange where the ISP peers.",
        why: "The omitted third of the catalogue has to be one cheap hop away, otherwise leaving anything off the box stops being a planning decision and starts being a quality decision.",
        numbers: ["target under 5% of requests reach beyond the local box"],
        breaks:
          "These tiers live in networks we do not own, so adding one is a negotiation with a partner rather than a capacity purchase, and it is unavailable exactly where the relationship is weakest.",
      },
    },
    {
      id: "e10",
      from: "peer-ix",
      to: "origin",
      label: "last resort, paged >5%",
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "The deep miss: a segment nobody nearby holds, pulled from origin during whatever hour the viewer happened to press Play.",
        why: "Every byte on this arrow is one you pay for at retail, and it arrives at peak rather than at 3 a.m., so it is treated as an incident signal rather than as normal cache behaviour.",
        numbers: ["origin_fill_rate target under 5%, pages above 10%"],
        breaks:
          "A spike here means the forecast missed. The response is an emergency targeted push before the demand curve steepens, with commercial CDN standing by as an expensive backstop.",
      },
    },
    {
      id: "e11",
      from: "placement",
      to: "oca",
      label: "nightly delta 02:00-06:00",
      dashed: true,
      fromSide: "left",
      toSide: "right",
      detail: {
        what: "The instruction: the diff between what this appliance holds and what the target list says it should hold, scheduled into its own local quiet window.",
        why: "Fill is the one large-volume transfer with nobody waiting on it, so it can be pushed entirely into the hours when the ISP's network is empty, which is what makes the ISP happy to host the box.",
        numbers: ["~500 GB per appliance per night", "~5 Tbps of fleet fill across a 4-hour window"],
        breaks:
          "An appliance that misses its window is not merely stale, it will live-fill through paid paths during the next peak, which is why completion is measured against the fill deadline rather than against the launch date.",
      },
    },
    {
      id: "e12",
      from: "origin",
      to: "oca",
      label: "fill bytes, ~500 GB/night",
      fromSide: "left",
      toSide: "right",
      detail: {
        what: "The actual pre-positioned bytes moving out to the edge: about 20 content-hours of genuinely new material a day plus forecast churn.",
        why: "This is the trade the whole programme rests on. ~9 PB a day of fill enables ~900 PB a day of delivery, so every byte pushed is served roughly a hundred times.",
        numbers: ["~9 PB/day of fleet fill against 900 PB delivered"],
        breaks:
          "The instinctive objection is that this wastes bandwidth on content nobody watches. At 100 to 1 amortisation the forecast can be badly wrong and still pay for itself.",
      },
    },
    {
      id: "e13",
      from: "oca",
      to: "placement",
      label: "inventory manifest",
      dashed: true,
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "Each appliance reporting what it currently holds, so the controller can diff rather than re-push.",
        why: "Placement is a delta problem. Without an accurate inventory the controller either re-sends bytes that are already resident or believes in bytes that were evicted from the unpinned remainder.",
        breaks:
          "Stale inventory poisons steering too, because the manifest service filters on the same state; that is why it is served from a read-optimised replica tolerating only minutes of staleness.",
      },
    },
    {
      id: "e14",
      from: "placement",
      to: "manifest",
      label: "inventory + health",
      dashed: true,
      fromSide: "left",
      toSide: "right",
      detail: {
        what: "Fleet state feeding the steering filter: which boxes are up, which have headroom, and which actually hold this title's renditions.",
        why: "This edge is what separates the design from a generic CDN. Steering can only be inventory-aware if something already knows the inventory, and the controller that placed the bytes is the thing that knows.",
        breaks:
          "If this state goes stale or unavailable, steering degrades to a static per-ASN edge list, which stays up and raises the miss rate, and therefore the bill.",
      },
    },
    {
      id: "e15",
      from: "forecast",
      to: "placement",
      label: "target set per appliance",
      dashed: true,
      fromSide: "top",
      toSide: "bottom",
      detail: {
        what: "The ranked list of segment groups each specific appliance should hold, split by that ISP's device and language mix.",
        why: "The forecast decides what is worth holding and the controller decides how to get it there; keeping them apart means the model can be retrained without touching the machinery that moves petabytes.",
        numbers: ["ranked (title, codec, rung, audio track) groups"],
        breaks:
          "The strongest input is the merchandising plan, which is decided in-house, so the model's accuracy metrics flatter it and anything never promoted is quietly penalised.",
      },
    },
    {
      id: "e16",
      from: "client",
      to: "telemetry",
      label: "heartbeat /30s, 200 B",
      fromSide: "left",
      toSide: "left",
      offset: 90,
      detail: {
        what: "Position, rung, rebuffer and switch events emitted every 30 seconds per stream.",
        why: "It is the only signal we have about what actually happened on the far side of a box in someone else's building, and it is small enough that shipping it to the cloud from 32M streams is irrelevant next to the video.",
        numbers: ["~1.1M events/s", "~220 MB/s, ~19 TB/day raw"],
        breaks:
          "The player must never block on this. A heartbeat that becomes a synchronous dependency turns an analytics outage into a global rebuffer event.",
      },
    },
    {
      id: "e17",
      from: "telemetry",
      to: "forecast",
      label: "play counts, device mix",
      dashed: true,
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "Aggregated regional play counts, plus the device and language mix observed behind each specific appliance.",
        why: "This is what closes the loop from yesterday's viewing to tonight's placement, and the per-appliance device mix is why two boxes in the same country hold different halves of the same ladders.",
        breaks:
          "The loop is self-referential: residency shapes engagement, engagement shapes the forecast, and there is no clean counterfactual because measuring it means deliberately degrading real viewers.",
      },
    },
    {
      id: "e18",
      from: "telemetry",
      to: "recs",
      label: "watch history + QoE",
      dashed: true,
      fromSide: "right",
      toSide: "right",
      offset: 110,
      detail: {
        what: "Per-profile watch history and completion feeding the offline ranking model, and quality signals feeding ABR tuning.",
        why: "Continue Watching and the ranked rows are both reads of the same event stream, which is why the heartbeat carries position rather than just liveness.",
        breaks:
          "The resume position users notice is written on pause and exit, not derived from the heartbeat stream, because a dropped fire-and-forget beat would otherwise rewind them.",
      },
    },
    {
      id: "e19",
      from: "recs",
      to: "client",
      label: "ranked rows per profile",
      dashed: true,
      fromSide: "left",
      toSide: "right",
      detail: {
        what: "The home screen: precomputed rows filtered to the titles licensed in this country.",
        why: "Browse is where the session actually starts, and it is deliberately off the playback path so that a ranking outage degrades to a generic catalogue view rather than stopping anyone watching.",
        breaks:
          "What this row set promotes is the strongest input to tomorrow's placement forecast, so a merchandising change is also a capacity decision whether anyone treats it as one or not.",
      },
    },
    {
      id: "e20",
      from: "encoder",
      to: "origin",
      label: "ladder: 8-12 rungs, CENC",
      fromSide: "top",
      toSide: "bottom",
      detail: {
        what: "Finished renditions, segmented and encrypted, written to origin as the authoritative copy.",
        why: "Publication to origin is the event that makes a title placeable. Nothing can be pre-positioned until the bytes it will hold exist and are final.",
        numbers: ["~30 GB per content-hour", "~120 GB per title"],
        breaks:
          "Re-cutting a ladder after publication means re-filling every appliance that holds it, so encode decisions are effectively frozen once the nightly push has run.",
      },
    },
    {
      id: "e21",
      from: "placement",
      to: "encoder",
      label: "fill-window deadline",
      dashed: true,
      fromSide: "right",
      toSide: "right",
      offset: 100,
      detail: {
        what: "The encoder queue ordered by each title's last useful fill window rather than by its launch date.",
        why: "For a Friday 00:00 UTC global drop, the earliest timezone's last window is Thursday morning, so the encode has to be locked by Wednesday. That is roughly 36 hours earlier than teams scheduling against the launch date assume.",
        breaks:
          "When the fleet is behind, the documented fallback is a reduced ladder: drop AV1 and the top 4K rung and make the window. A title that ships with two codecs is a quality regression; a title that ships unpositioned is a cost incident.",
      },
    },
  ],
};
