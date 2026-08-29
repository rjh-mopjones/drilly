import type { Diagram } from "./types";

export const ZOOM: Diagram = {
  id: "zoom",
  title: "Zoom",
  question: "Design Zoom (Video Conferencing)",
  sourceId: "patterns",
  itemId: 33,
  overview: {
    shape:
      "Two planes sharing nothing: a tiny stateful WebSocket carrying join, mute and layout, and a UDP media path to a relay that forwards already-encoded video and never decodes.",
    forces: [
      {
        constraint: "Signalling tolerates 200ms and must never lose a message; media is two orders of magnitude larger and drops rather than retries",
        decision: "Signalling runs on a separate reliable WebSocket fleet, sized and scaled independently of the UDP media path",
        lights: ["signalling", "publisher", "sfu"],
      },
      {
        constraint: "Mesh costs (N-1) x 1.5 Mbps up per sender, crossing a flat 2.5 Mbps relay cost at just three participants",
        decision: "An SFU relay forwards already-encoded packets and never decodes, keeping per-call uplink flat regardless of N",
        lights: ["sfu"],
      },
      {
        constraint: "A receiver with 3 Mbps down in a nine-person call cannot take eight 720p streams, which would be 12 Mbps",
        decision: "The Per-receiver allocator solves a small knapsack every 100 to 500ms, spending the bandwidth budget rather than filling it",
        lights: ["allocator", "e-decide"],
      },
      {
        constraint: "A frame that misses its 150ms playout deadline is wrong data, not late data",
        decision: "The Jitter buffer races repair against the deadline: retransmit under ~30ms RTT, FEC beyond ~70ms, concealment otherwise",
        lights: ["jitter", "e-play"],
      },
      {
        constraint: "Per-viewer egress is linear and never stops growing; 1000 viewers at 1.5 Mbps is 1.5 Gbps per presenter",
        decision: "A compositing MCU mixer plus CDN distribution replaces per-receiver relay egress for broadcast-only legs",
        lights: ["mcu", "cdn", "e-mcu", "e-cdn"],
      },
    ],
    naive: {
      text: "Connect every participant directly to every other participant, peer-to-peer, the way a two-person video call already works. Each client encodes its camera once, sends it directly to every other participant, and receives directly from each of them too. Total flows are N(N-1): eight people is 56 streams and seven encoder instances per client, which thermally throttles phones before the network even notices. Uplink is the real killer. Mesh costs (N-1) x 1.5 Mbps up for one 720p encode. By five participants a sender needs 6 Mbps up just to publish, a rate most home connections do not sustain. The SFU relay replaces this. Every sender publishes once, at a flat 2.5 Mbps regardless of how many people are in the call, and the relay forwards already-encoded packets without ever decoding a pixel.",
      lights: ["sfu", "publisher"],
    },
    beats: [
      {
        text: "Split the planes from the start. Signalling is stateful, must not lose a message, and a 200ms delay on a mute event is invisible. Media tolerates nothing, drops rather than retries, and is two orders of magnitude larger in every dimension, so the two fleets are sized independently.",
        lights: ["signalling", "publisher", "sfu", "e-ws", "e-pub"],
      },
      {
        text: "The topology falls out of uplink arithmetic. Mesh costs (N-1) x 1.5 Mbps up for a single 720p encode against a flat 2.5 Mbps to a relay, so the crossover is at three participants. By five, mesh needs 6 Mbps up. Total flows are N(N-1), so eight people is 56 streams and seven encoder instances per client.",
        lights: ["sfu"],
      },
      {
        text: "The sender publishes three times at once, 180p at 200 kbps, 480p at 800 kbps and 720p at 1.5 Mbps, and the relay picks which already-encoded version each receiver gets. That costs the sender 1.67x upload and buys a relay that never transcodes: roughly a tenth of a core per meeting instead of a core per composited output.",
        lights: ["publisher", "sfu", "e-pub", "e-egress"],
      },
      {
        text: "The picking is a control loop, not a setting. Receivers report per-packet arrival times, bandwidth is estimated from the delay trend rather than from loss. Every 100 to 500ms the relay solves a small knapsack per receiver: audio first at 150 kbps, then layers up to about 90 percent of the estimate.",
        lights: ["allocator", "jitter", "receiver", "e-twcc", "e-hint", "e-decide"],
      },
      {
        text: "Repair races the playout deadline and loses gracefully. Under about 30ms RTT a retransmit lands inside the 50 to 100ms jitter buffer and is free. Beyond about 70ms it arrives after the frame was due, so you pay 20 to 30 percent forward error correction instead. Playout is never delayed to wait for a fix.",
        lights: ["jitter", "e-play"],
      },
      {
        text: "Scale is regional relays cascading over the backbone, so every participant pays a short first mile. A compositing mixer hangs off to one side for the legs that can only accept one stream: dial-in, room systems, and a view-only audience handed to a CDN.",
        lights: ["cascade", "mcu", "cdn", "e-cascade", "e-mcu", "e-cdn"],
      },
    ],
    crux: {
      problem:
        "Late media is useless media, so the design triages instead of delivering. Every frame has a playout deadline, and one that misses it is not late data but wrong data.",
      handled:
        "The interesting question is what you give up first, per receiver, and how fast the loop notices. The Per-receiver allocator spends the bandwidth budget on audio first, then video layers by weighted priority, never the reverse. The Jitter buffer races repair against that same deadline rather than waiting for it to pass. Bring durability instincts here and you build a system that freezes instead of blurring.",
    },
    numbers: [
      { value: "~2.5 Mbps uplink for three simulcast layers, whatever N is", explain: "The fixed publish cost a sender pays once, regardless of how many receivers are on the call, the property that makes the relay topology scale." },
      { value: "150ms glass to glass, of which the jitter buffer is 50 to 100ms", explain: "The full latency budget from capture to display, and how much of it is deliberately spent absorbing network jitter." },
      { value: "~10% of a core per meeting on the relay, no transcode", explain: "The relay's actual compute cost, kept low specifically by never decoding or re-encoding any stream." },
    ],
  },
  nodes: [
    {
      id: "publisher",
      label: "Sending client",
      sub: "libwebrtc, 3 simulcast encodes",
      kind: "external",
      col: 0,
      row: 0,
      detail: {
        what: "The publishing endpoint: a camera, an Opus encoder, and three independent video encode chains running simultaneously, each with its own SSRC and its own keyframes.",
        why: "The relay refuses to transcode, so the only place three quality rungs can come from is the sender's hardware encoder, which is already running and has spare capacity. Pushing the cost onto the sender is what keeps the fleet at a few thousand relay hosts rather than a few hundred thousand.",
        numbers: [
          { value: "180p 200 kbps, 480p 800 kbps, 720p 1.5 Mbps", explain: "The three fixed rungs published simultaneously, each targeting a different receiver bandwidth tier." },
          { value: "~2.5 Mbps uplink regardless of participant count", explain: "200+800+1,500 kbps = 2.5 Mbps flat, whether 2 receivers or 200 — that flatness is what lets one relay topology serve every call size without resizing the sender's cost." },
          { value: "1.39M pixels per frame against 921k for 720p alone, ~1.5x the encode work", explain: "The combined pixel-processing cost of encoding all three rungs against encoding 720p alone." },
        ],
        breaks: {
          failure: "Uplink is the scarce direction on home connections. A sender on a thin link pays 1.67x to publish the extra layers.",
          handled: "When it cannot, it drops the top rung. Nobody in the call can then see that person sharply no matter how good their own connection is, an accepted limit of pushing encode cost to the sender.",
        },
        choice: {
          pick: "Simulcast: three independent encodes of the same camera",
          instead: "Scalable video coding, one bitstream with nested temporal and spatial layers.",
          decider:
            "On the merits SVC wins: the same per-receiver flexibility for roughly 20 percent less bitrate, and a layer switch that needs no keyframe at all. The blocker is installed base rather than the codec. Hardware decode coverage for VP9 and AV1 SVC on the phones people actually own lagged the specification by years.",
          flips:
            "When your endpoints are known to hardware-decode SVC, at which point simulcast is paying 1.67x upload for nothing. Date the claim when you make it, because this is the fact most likely to have moved.",
        },
      },
    },
    {
      id: "sfu",
      label: "SFU relay (region A)",
      sub: "forwards RTP, never decodes",
      kind: "service",
      col: 1,
      row: 0,
      detail: {
        what: "The selective forwarding unit: it ingests every publisher's three layers and forwards packets from exactly one of them to each receiver, treating the layers as three unrelated streams.",
        why: "It is the cheapest thing that still gives per-receiver adaptation. Nothing is decoded, so the participant on hotel wifi is served 180p out of the same ingress that feeds 720p to everybody else. One bad link is invisible to the rest of the call, which is the entire reason the relay exists rather than a mesh.",
        numbers: [
          { value: "~10% of a core per meeting against ~1 core per composited output", explain: "The compute cost of pure forwarding against what a compositing mixer would cost for the same meeting." },
          { value: "5-person meeting: 12.5 Mbps in, ~11 Mbps out", explain: "The typical ingress and egress bandwidth one meeting generates through this relay." },
          { value: "~800 concurrent 5-person meetings on a 16-core host at ~20 Gbps, where ~2M pps binds before bytes do", explain: "The capacity one relay host sustains, and the actual bottleneck: packet rate, not raw bandwidth." },
        ],
        breaks: {
          failure: "Pod crash mid-meeting. Per-meeting state is only a routing table and a set of bandwidth estimates, a few kilobytes.",
          handled: "Recovery is clients re-publishing to a backup rather than a media handover, and the call blips for roughly 30 seconds while the estimates settle.",
        },
        choice: {
          pick: "An SFU for every call with three or more participants",
          instead: "Full mesh up to four or five participants, so most calls never touch a media server.",
          decider:
            "Uplink arithmetic, and it is not close. Mesh is (N-1) x 1.5 Mbps up for one 720p encode against a flat 2.5 Mbps for all three simulcast layers. The crossover is at N=3, and by N=5 mesh wants 6 Mbps up and 6 down. Total flows are N(N-1): eight people is 56 streams and seven encoder instances per client.",
          flips:
            "N is exactly 2 and ICE finds a direct path. Mesh then wins on every axis: no relay hop worth 15 to 40ms, no server capacity, and media that never touches our infrastructure. That is the cheapest end-to-end encryption story available.",
        },
      },
    },
    {
      id: "allocator",
      label: "Per-receiver allocator",
      sub: "TWCC estimate, knapsack/receiver",
      kind: "service",
      col: 2,
      row: 1,
      detail: {
        what: "The control loop that answers one question per sender-receiver pair, over and over: which of this sender's three layers to forward right now, or none at all.",
        why: "A receiver with 3 Mbps down in a nine-person call cannot take eight 720p streams, which would be 12 Mbps. So the budget is spent rather than filled: audio is allocated first and is never sacrificed, then video layers are chosen to maximise a weighted quality score under the estimate.",
        numbers: [
          { value: "re-solved every 100 to 500ms, capped at ~90% of the estimate", explain: "The recompute cadence and safety margin under the bandwidth estimate this loop targets." },
          { value: "three concurrent speakers at 50 kbps is 150 kbps, ~5% of the budget", explain: "The small, fixed cost of the audio allocation this loop always protects first." },
          { value: "a 200-person call held at ~3 Mbps and 6 decodes per receiver", explain: "The result this loop achieves at scale: bounded bandwidth and bounded decode load regardless of call size." },
          { value: "phones hardware-decode 4 to 6 concurrent 480p streams, laptops 9 to 16", explain: "The device decode ceilings this allocation strategy is deliberately kept under." },
        ],
        breaks: {
          failure: "Upgrading a receiver to a higher layer needs a keyframe on that layer, and a keyframe is 5 to 10x a delta frame.",
          handled: "In a 50-person call an active-speaker change makes dozens of receivers want the same upgrade inside 100ms, so keyframe requests are coalesced rather than answered individually.",
        },
        choice: {
          pick: "Delay-gradient estimation, PLIs coalesced at one per 500ms, bottom layer always forwarded",
          instead: "Loss-based bandwidth estimation, and a keyframe served per upgrade request.",
          decider:
            "Timing on both halves. By the time packets drop a router queue has already added 100ms or more, so loss reacts to damage while the delay trend shows up 200 to 500ms earlier. Keeping the 200 kbps bottom layer on every receiver at all times makes a downgrade instantaneous rather than another keyframe request.",
          flips:
            "A fixed, known network such as a studio leg on dedicated capacity, where there is nothing to estimate and a static layer assignment is simpler and just as good.",
        },
      },
    },
    {
      id: "jitter",
      label: "Jitter buffer + repair",
      sub: "50-100ms, NACK / FEC / PLC",
      kind: "service",
      col: 2,
      row: 0,
      detail: {
        what: "The receiver-side buffer that absorbs reordering and network jitter, plus the loss repair that has to complete inside it: selective retransmit, forward error correction and concealment.",
        why: "Playout is never delayed to wait for a repair. Everything here is a race against the frame's deadline. A fix that lands after the frame was due is worse than useless, because the bandwidth it consumed was taken from frames that could still have arrived in time.",
        numbers: [
          { value: "50 to 100ms adaptive, the largest term you control at runtime", explain: "The buffer's own size, the single biggest lever available for trading latency against loss recovery." },
          { value: "at 30ms RTT a retransmit lands ~40ms later, inside the buffer", explain: "The retransmit round trip at a favourable RTT, comfortably inside the buffer's window." },
          { value: "beyond ~70ms RTT you pay FEC instead: 20 to 30 percent constant overhead", explain: "The fallback repair mechanism's bandwidth cost once retransmit can no longer land in time." },
          { value: "audio loss concealment target under 0.5 percent", explain: "The quality target for the fallback when neither retransmit nor FEC can recover a lost audio packet in time." },
        ],
        breaks: {
          failure: "The buffer trades directly against loss recovery and there is no setting that wins both.",
          handled: "Shorten it and fewer retransmits arrive in time, so more frames are concealed. Lengthen it and the conversation acquires the overlap problem that makes a call feel like a walkie-talkie.",
        },
        choice: {
          pick: "UDP with an adaptive buffer: retransmit inside the deadline, FEC beyond it",
          instead: "A reliable ordered transport for media, TCP or a QUIC stream, so nothing is ever lost.",
          decider:
            "Head-of-line blocking against the deadline. One lost packet on a 140ms path freezes the video for 280ms while it is repaired. The frames queued behind it then arrive as a burst the buffer has to absorb or discard anyway.",
          flips:
            "Content with no expiry. Screen share of a static slide runs a longer buffer and near-unlimited retransmit. A corrupted region persists until the next keyframe, and a reader would rather wait 200ms than squint at a smeared slide.",
        },
      },
    },
    {
      id: "receiver",
      label: "Receiving client",
      sub: "decode, composite, viewport",
      kind: "external",
      col: 3,
      row: 0,
      detail: {
        what: "The far endpoint: it decodes whichever layers it was given, lays out the tiles, and tells the relay what it is actually showing.",
        why: "The allocator's weights come from here rather than from the server guessing: which tile is pinned, which is the active speaker, and critically which tiles are scrolled off screen. The client unsubscribes from those outright, the single largest saving available in a large grid.",
        numbers: [
          { value: "~2.2 Mbps for a 5-person call: 1.5 speaker + 3 x 0.2 thumbnails + 0.05 audio", explain: "The typical receive bandwidth one client needs, well under the 2.5 Mbps a sender publishes." },
          { value: "decode and render is 15 to 25ms of the 150ms budget", explain: "Only 10-17% of the total — most of the 150ms is spent upstream in the 50-100ms jitter buffer and network transit, not on this last step." },
          { value: "dragging a thumbnail to full screen costs one RTT plus encoder turnaround, 50 to 100ms best case and up to the 500ms PLI floor at worst", explain: "The latency range a viewport change can incur, bounded by how quickly a keyframe request is honoured." },
        ],
        breaks: {
          failure: "Decode budget, not bandwidth, is what melts a device.",
          handled: "A pure SFU into a 1000-person webinar would ask a laptop to decode and composite roughly 1000 streams. Active-speaker selection thumbnails or pauses everyone else long before a mixer becomes necessary.",
        },
        choice: {
          pick: "Client-driven subscription: unsubscribe off-screen tiles, send pin and speaker hints upstream",
          instead: "Let the server infer intent from participant activity and the last known layout.",
          decider:
            "The server cannot see the screen, and off-screen tiles are the biggest saving on offer: holding a 200-person call at ~3 Mbps and 6 decodes depends on it. Resuming a paused tile costs a keyframe. The pause threshold carries hysteresis rather than tracking the active speaker instantly.",
          flips:
            "Fixed-layout endpoints such as room systems and broadcast legs, where the layout never changes and there is nothing useful for the client to report.",
        },
      },
    },
    {
      id: "signalling",
      label: "Signalling (WebSocket)",
      sub: "join, mute, layout, presence",
      kind: "service",
      col: 0,
      row: 1,
      detail: {
        what: "The stateful control plane: one WebSocket per participant carrying join and leave, mute, raise hand, layout and presence updates.",
        why: "It is a separate fleet because it is a different system in every dimension. It tolerates 200ms happily and must never lose a message. It is also two orders of magnitude smaller than the media plane in bandwidth, so sizing the two together would size both of them wrong.",
        numbers: [
          { value: "15M concurrent WebSocket connections at peak", explain: "The connection scale this fleet holds open, independent of media traffic." },
          { value: "~10 control events per participant per minute is ~2.5M events/s", explain: "The aggregate event throughput this fleet processes at peak." },
          { value: "200ms of delay on a mute event is invisible; 200ms on a frame is not", explain: "This roughly 100x tolerance gap is why control and media run on separate fleets, sized independently: one for connections, one for the 150ms glass-to-glass budget." },
        ],
        breaks: {
          failure: "Join storms against a single meeting ID.",
          handled: "Rate limits per IP and per meeting ID, short-lived JWTs bound to the invitee, and the waiting room all sit in front of relay allocation. An abuse spike costs signalling capacity and never media capacity.",
        },
        choice: {
          pick: "A separate WebSocket fleet on a reliable transport",
          instead: "Carrying control in-band on the media connection, via RTP header extensions or a data channel.",
          decider:
            "The two payloads have opposite requirements. Control is ~2.5M tiny events/s that must never be lost and tolerates 200ms; media is 12.5 Mbps per meeting that drops rather than retries. Sharing one transport means either control inherits the drops or media inherits the buffering.",
          flips:
            "A small deployment where running two fleets is not worth it, and a data channel on the existing peer connection is one fewer thing to operate.",
        },
      },
    },
    {
      id: "meeting-db",
      label: "Meeting metadata",
      sub: "wide-column, ~5 KB per meeting",
      kind: "database",
      col: 0,
      row: 2,
      detail: {
        what: "Per-meeting bookkeeping written by signalling: host, schedule, participant history, chat references and the recording URL.",
        why: "Nothing in the media path reads it, which is exactly the point. It is the durable record that a meeting existed, written at a rate the media plane would consider a rounding error. It is the only genuinely stateful thing in the control plane.",
        numbers: [
          { value: "~5 KB per meeting, 60M meetings/day, so ~300 GB/day", explain: "The per-meeting record size and the resulting aggregate daily write volume." },
          { value: "RPO zero: the control plane is replicated active-active", explain: "The durability guarantee this store maintains for meeting records." },
          { value: "~2 min for a full regional signalling failover", explain: "The recovery time target for this control-plane store during a regional outage." },
        ],
        breaks: {
          failure: "Nothing here constrains anything else in the design.",
          handled: "The failure that matters is availability during a join storm, not capacity, so this store is monitored on availability rather than throughput headroom.",
        },
        choice: {
          pick: "A wide-column store keyed by meeting_id",
          instead: "PostgreSQL.",
          decider:
            "Access pattern rather than scale: 300 GB/day of blind writes and single-key reads with no joins, never on the media path. Postgres would carry 60M rows/day comfortably for years. The honest decider is that this table follows the rest of the fleet rather than that it has outgrown a relational store.",
          flips:
            "When meeting analytics matter more than write volume, since real queries over scheduling and attendance are worth more than headroom nobody is using.",
        },
      },
    },
    {
      id: "cascade",
      label: "Cascade SFU (region B)",
      sub: "backbone hop, FEC pre-applied",
      kind: "service",
      col: 1,
      row: 2,
      detail: {
        what: "A second regional relay holding the other half of a cross-region meeting, bridged to the first over the backbone rather than over the public internet.",
        why: "Every participant should pay a short first mile, because the last mile is the expensive part and the part nobody controls. Cascading trades one provisioned backbone hop for the transatlantic leg that half the call would otherwise pay on every single packet.",
        numbers: [
          { value: "adds 30 to 50ms transatlantic", explain: "Added to a 10-30ms local first mile, this still beats letting a distant participant's last mile carry an unmanaged long-haul leg instead." },
          { value: "cascade root recomputed if median participant latency shifts by more than 20ms", explain: "The threshold that triggers a re-evaluation of which region should serve as the cascade root." },
          { value: "~10 to 25 Tbps per major region out of ~75 Tbps across the fleet", explain: "The bandwidth scale one major region's cascade traffic represents against the whole fleet." },
        ],
        breaks: {
          failure: "It breaks the bandwidth estimator's model of the path. Backbone congestion and last-mile congestion produce an identical delay gradient.",
          handled: "The relay degrades the receiver when the fault is upstream, which relieves nothing. A packet lost between relays also needs hop-by-hop retransmission, so a flapping link floods the root with NACKs.",
        },
        choice: {
          pick: "Regional relays with SFU-to-SFU cascading over the backbone",
          instead: "One relay per meeting, placed at the latency centroid of its participants.",
          decider:
            "The first mile dominates and is the part you cannot provision. Nearest-relay keeps it at 10 to 30ms for everybody and adds a 30 to 50ms backbone hop with dedicated capacity and pre-applied FEC. A single centroid relay instead puts an unmanaged long-haul leg on the last mile of every distant participant.",
          flips:
            "Meetings whose participants are all in one region, where the cascade buys nothing and the second relay is pure cost and one more failure domain.",
        },
      },
    },
    {
      id: "mcu",
      label: "MCU mixer",
      sub: "decode, composite, re-encode",
      kind: "service",
      col: 2,
      row: 2,
      detail: {
        what: "A compositing mixer that decodes every input, paints one gallery-view frame, re-encodes it, and hands each receiver exactly one stream regardless of call size.",
        why: "It exists for endpoints that can physically accept only one stream and for audiences large enough that per-receiver egress dominates. It is genuinely the wrong tool for interaction and genuinely the right one for broadcast. A hybrid webinar runs both at once: the panel talks over the relay while the mixer composites them for the audience.",
        numbers: [
          { value: "~1 core per distinct output layout", explain: "The compute cost this mixer incurs for each unique composited view it produces." },
          { value: "30 to 80ms of added transcode delay, target p99 under 80ms", explain: "The latency tax paid by any leg routed through this decode-composite-encode pipeline." },
          { value: "at 1000 viewers, relay egress is 1000 x 1.5 Mbps = 1.5 Gbps per presenter", explain: "The egress cost this mixer's downstream CDN path exists specifically to avoid." },
        ],
        breaks: {
          failure: "CPU scales with the number of active video inputs, so encode p99 climbs before anything else shows a symptom.",
          handled: "The levers are cutting the active-speaker count, pausing inactive participants, and scaling the mixer fleet horizontally, all applied before CPU exhaustion becomes visible elsewhere.",
        },
        choice: {
          pick: "Mixer only on view-only and fixed-function legs",
          instead: "Switch the whole meeting to a mixer past roughly 25 participants so receiver cost stays constant.",
          decider:
            "The receiver's decode budget settles it before the server's CPU does. Top 3 to 5 speakers at 480p or 720p with everyone else at 180p or paused holds a 200-person call at ~3 Mbps and 6 decodes. That is inside a laptop's 9 to 16 tiles, so the mixer is never actually needed for an interactive call.",
          flips:
            "The endpoint cannot accept multiple streams at all: PSTN dial-in, a SIP room system, an RTMP or HLS leg, or a browser without the codec.",
        },
      },
    },
    {
      id: "cdn",
      label: "CDN broadcast leg",
      sub: "HLS, 2 to 6s buffer",
      kind: "external",
      col: 2,
      row: 3,
      detail: {
        what: "The distribution path for a view-only audience: one composited stream segmented and handed to a CDN instead of a per-viewer relay subscription.",
        why: "Above roughly a thousand viewers you have stopped designing a conference. Nobody in that audience publishes anything, so the interactivity the 150ms budget buys them is worth nothing, and a buffered segmented stream costs a fraction of per-receiver egress.",
        numbers: [
          { value: "2 to 6 seconds of buffer, against 150ms on the interactive leg", explain: "The much larger, deliberately accepted latency for the broadcast-only viewing experience." },
          { value: "threshold is roughly 1000 view-only attendees", explain: "The audience size at which the design switches from relay egress to CDN distribution." },
          { value: "replaces 1.5 Gbps of relay egress per presenter with one encode plus fanout", explain: "The bandwidth this switch saves at the threshold audience size." },
        ],
        breaks: {
          failure: "The buffer is a product decision people forget they made.",
          handled: "The audience is seconds behind the panel, so anything interactive with them, Q and A, polls, applause, has to run over the signalling plane rather than in the video.",
        },
        choice: {
          pick: "HLS through a CDN once the view-only audience passes ~1000",
          instead: "Keep everyone on the relay with aggressive layer capping.",
          decider:
            "Per-viewer egress is linear and does not stop growing: 1000 viewers at 1.5 Mbps is 1.5 Gbps per presenter out of our own relays. A CDN pays one encode and fans out on infrastructure built for exactly this shape of traffic.",
          flips:
            "Audiences that genuinely interact, or any audience below the threshold, where 2 to 6 seconds of added delay costs more than the bandwidth saves.",
        },
      },
    },
    {
      id: "recorder",
      label: "Cloud recorder",
      sub: "subscribes as another receiver",
      kind: "service",
      col: 3,
      row: 2,
      detail: {
        what: "A mixer-style process that joins the meeting like any other receiver, decodes, composites to a layout, encodes to MP4 and uploads in chunks with checkpoints.",
        why: "There is no canonical rendering to record. Two receivers watching the same sender sit on different layers with different keyframe histories. Anything that wants a single picture has to construct one by subscribing and building it, which is why the recording is never exactly what any participant saw.",
        numbers: [
          { value: "checkpoints flushed every 5 to 10 seconds, lag target under 10s", explain: "The durability cadence and freshness target for this recording process." },
          { value: "~340 MB for a 30-minute composited 720p file", explain: "The typical output size for one recorded meeting." },
          { value: "assume 5% of meetings recorded: 3M recordings/day", explain: "The estimated fraction of total meeting volume this recorder has to process." },
        ],
        breaks: {
          failure: "A crash loses up to the checkpoint interval and there is no way to recover it, because the source frames were never durable anywhere.",
          handled: "Checkpointing bounds the loss window; it does not eliminate it, and the product does not publish the window, an accepted and disclosed limitation.",
        },
        choice: {
          pick: "A server-side recorder subscribing as an ordinary receiver",
          instead: "Recording client-side on the host's machine, or one server recording per receiver.",
          decider:
            "Fidelity against storage. Per-receiver recording is the only faithful option and multiplies an already-1 PB/day line by participant count; one composite matches nobody's actual experience but is the only version that fits.",
          flips:
            "End-to-end encrypted mode, where the relay only ever holds ciphertext, so client-side recording is the only thing that can work at all.",
        },
      },
    },
    {
      id: "object-store",
      label: "Recording store",
      sub: "MP4 chunks, 90-day retention",
      kind: "database",
      col: 3,
      row: 3,
      detail: {
        what: "Region-local object storage holding finished recordings alongside the chat log and transcription for each meeting.",
        why: "It is the largest storage line in the system by two orders of magnitude, and it is the only place this design stores media at all. Everything else deliberately keeps nothing, which is why the retention default is short rather than generous.",
        numbers: [
          { value: "3M recordings/day at ~340 MB is ~1 PB/day", explain: "The daily write volume this store absorbs from the recorder fleet." },
          { value: "~90 PB hot at the 90-day default retention", explain: "The steady-state footprint at the default retention window." },
          { value: "RPO ~10s: the last unflushed checkpoint can be lost", explain: "The durability guarantee for this store, bounded by the recorder's own checkpoint interval." },
        ],
        breaks: {
          failure: "Retention policy rather than capacity is the real control.",
          handled: "Moving the default from 90 days to a year quadruples the hot footprint with no other change anywhere in the system. Retention is the lever this design monitors, not raw capacity.",
        },
        choice: {
          pick: "Object storage, region-local, chunked uploads with lifecycle rules",
          instead: "Blobs in the metadata store, or a filesystem behind the recorder fleet.",
          decider:
            "1 PB/day of write-once, read-rarely media on a 90-day lifecycle. Object storage gives you lifecycle transitions and cheap tiers for free; petabyte blobs in a database turn backup and replication into the problem you spend the next year on.",
          flips:
            "Short-retention clips small enough to sit beside the meeting row, where an extra store and its lifecycle configuration is not worth the trouble.",
        },
      },
    },
  ],
  edges: [
    {
      id: "e-ws",
      from: "publisher",
      to: "signalling",
      tier: "control",
      label: "join · mute · layout",
      detail: {
        what: "Control messages over a persistent WebSocket: join and leave, mute, raise hand, layout changes and presence.",
        why: "This is the plane that is allowed to be reliable and ordered, because none of it expires. It is also the plane a client keeps when media is failing, which is how a session survives a network blip rather than dropping.",
        numbers: [
          { value: "15M concurrent connections", explain: "The scale of persistent connections this plane holds open at peak." },
          { value: "~2.5M events/s at peak", explain: "The aggregate event throughput this plane processes at peak load." },
        ],
        breaks: {
          failure: "A WebSocket disconnect mid-meeting looks like a departure unless session state is held server-side.",
          handled: "Reconnect carries a session token and the meeting state is still there, so a brief network blip does not remove someone from the call.",
        },
      },
    },
    {
      id: "e-meta",
      from: "signalling",
      to: "meeting-db",
      tier: "control",
      label: "meeting + participant state",
      detail: {
        what: "Durable writes of meeting creation, participant joins and leaves, and the recording reference once one exists.",
        why: "The control plane is the only part of this system with state worth persisting. It must survive a regional failover with zero data loss, which is why it is replicated active-active rather than cached.",
        numbers: [
          { value: "~5 KB per meeting", explain: "The typical write size this arrow carries per meeting event." },
          { value: "~300 GB/day", explain: "The aggregate daily write volume this arrow generates." },
        ],
        breaks: {
          failure: "If this write path stalls, meetings still run because the media plane never reads it.",
          handled: "The failure is silent until someone goes looking for a recording that was never linked, which is why write-path health here is monitored explicitly rather than inferred from call quality.",
        },
      },
    },
    {
      id: "e-alloc",
      from: "signalling",
      to: "sfu",
      tier: "control",
      label: "SFU endpoint + JWT",
      detail: {
        what: "The control plane picking the nearest healthy relay for a joining client and issuing a short-lived meeting token bound to that invitee.",
        why: "Allocation deliberately happens after authorisation and after the waiting room, so a join storm consumes signalling capacity and never causes a relay to be allocated. It is also where anycast routing sends a client to a different region during an outage.",
        numbers: [
          { value: "99.9% of media planes established within 3s of join", explain: "The window a client sits in after auth succeeds but before media flows — long enough to fail visibly if auth or relay allocation degrades under a join storm." },
          { value: "JWTs valid under 60s, cached at the signalling edge", explain: "The short lifetime of the token this arrow issues, limiting how long a leaked token stays useful." },
        ],
        breaks: {
          failure: "If token validation degrades under a join storm the whole meeting fails to start.",
          handled: "The auth 5xx rate is a paging signal and the rate limits sit in front of it, catching degradation before it becomes a full outage.",
        },
      },
    },
    {
      id: "e-pub",
      from: "publisher",
      to: "sfu",
      label: "ICE + publish, ~2.5 Mbps",
      tier: "hot",
      step: 1,
      detail: {
        what: "Connectivity setup (ICE, STUN with TURN as fallback) followed by the publish leg: RTP over UDP carrying all three simulcast layers plus Opus audio, once a path is found.",
        why: "No media flows until a path exists, and behind NAT a path has to be discovered rather than assumed. ICE over UDP with TURN only as fallback keeps most calls off a relay hop. Forcing everyone through TURN would spend 15 to 40ms on paths that never need it. Once connected, the sender uploads once regardless of participant count.",
        numbers: [
          { value: "~80 to 85 percent of attempts find a direct path", explain: "The other 15-20% pay TURN's extra 15-40ms relay hop — forcing everyone through TURN by default would cost that penalty on paths that never needed it." },
          { value: "2.5 Mbps up whatever N is", explain: "The fixed publish cost this leg carries, independent of call size." },
          { value: "Opus audio at 40 to 50 kbps", explain: "The bandwidth this leg spends on audio, a small fraction of the total upload." },
          { value: "first mile 10 to 30ms, relay hop adds 15 to 40ms", explain: "The two latency components this leg contributes to the overall glass-to-glass budget." },
        ],
        breaks: {
          failure: "Symmetric NAT and corporate firewalls that block UDP fail every path ICE tries to pair, falling back to TURN and sometimes TCP on 443.",
          handled: "This leg is also the sender's own uplink, so congestion here degrades that participant for everybody at once, which is why publish-side congestion is tracked as its own signal.",
        },
      },
    },
    {
      id: "e-egress",
      from: "sfu",
      to: "jitter",
      tier: "hot",
      step: 2,
      label: "one layer, ~2.2 Mbps",
      detail: {
        what: "The forwarding leg: packets from exactly one chosen layer per sender, plus audio, arriving at this receiver's buffer.",
        why: "Egress sits below ingress on purpose. The relay forwards one layer of three and discards the rest, so a 5-person meeting takes 12.5 Mbps in and pushes about 11 Mbps out. A slow receiver simply gets a smaller slice of the same ingress.",
        numbers: [
          { value: "1.5 speaker + 3 x 0.2 thumbnails + 0.05 audio ≈ 2.2 Mbps", explain: "A typical per-receiver egress breakdown for a 5-person call." },
          { value: "relay forwarding adds under 1ms because nothing is decoded", explain: "The near-zero processing latency this pure-forwarding step contributes." },
          { value: "second mile 10 to 30ms", explain: "The typical network latency for this leg, separate from the relay's own processing time." },
        ],
        breaks: {
          failure: "Persistent loss above roughly 20 percent on this leg exhausts FEC and retransmit.",
          handled: "The receiver drops to audio only with in-band redundancy rather than losing the call, a graceful degradation floor rather than a hard failure.",
        },
      },
    },
    {
      id: "e-play",
      from: "jitter",
      to: "receiver",
      tier: "hot",
      step: 3,
      label: "decode + render",
      detail: {
        what: "Frames leaving the buffer at their playout deadline, decoded and composited into the tile layout.",
        why: "The deadline is absolute: anything not here on time is discarded and concealed rather than waited for. Audio and video are aligned via RTP timestamps mapped to a common wall clock, and video is what waits, never audio.",
        numbers: [
          { value: "decode and render 15 to 25ms", explain: "The latency this final client-side step adds to the overall glass-to-glass budget." },
          { value: "total 105 to 215ms glass to glass", explain: "The full end-to-end latency range this whole pipeline achieves." },
        ],
        breaks: {
          failure: "Resuming a paused or dropped video stream arrives late relative to audio.",
          handled: "The player ramps the offset out over a second or two rather than jumping, which is visible as a brief drift rather than a jarring cut.",
        },
      },
    },
    {
      id: "e-twcc",
      from: "jitter",
      to: "allocator",
      tier: "data",
      label: "TWCC arrival reports",
      detail: {
        what: "Per-packet arrival timestamps reported back by sequence number, from which the sender and relay derive an available-bandwidth estimate.",
        why: "Comparing inter-arrival deltas against inter-departure deltas catches a queue building before anything is lost, which is 200 to 500ms of warning that loss-based estimation never gives you. Probing upward is deliberate padding, so a wrong guess wastes filler rather than corrupting real media.",
        numbers: [
          { value: "a consistent positive delay trend precedes loss by 200 to 500ms", explain: "The early-warning window this signal gives compared to waiting for actual packet loss." },
          { value: "a report showing >5% loss downgrades that receiver's target layer", explain: "The concrete trigger threshold that converts this signal into an allocation change." },
        ],
        breaks: {
          failure: "On a cascaded meeting the signal is ambiguous: backbone and last-mile congestion look identical in the gradient.",
          handled: "The loop degrades a receiver whose own link was fine, an accepted false-positive cost of a signal that cannot distinguish the two congestion sources.",
        },
      },
    },
    {
      id: "e-hint",
      from: "receiver",
      to: "allocator",
      tier: "data",
      label: "viewport + pin hints",
      detail: {
        what: "Client-side layout context: which tile is pinned, which is the active speaker, and which tiles are off screen and therefore unsubscribed.",
        why: "The weights in the allocator come from the client rather than the server guessing, because only the client knows what is rendered. Unsubscribing off-screen tiles outright is the largest single saving in a big grid and costs nothing to compute.",
        numbers: [{ value: "top 3 to 5 speakers at 480p or 720p, the rest at 180p or paused", explain: "The typical allocation pattern this hint stream drives for a larger call." }],
        breaks: {
          failure: "Resuming a paused tile needs a keyframe, so a hint stream that tracks the active speaker instantly generates keyframe churn.",
          handled: "The threshold carries hysteresis for exactly this reason, smoothing out rapid speaker changes rather than reacting to every one instantly.",
        },
      },
    },
    {
      id: "e-decide",
      from: "allocator",
      to: "sfu",
      tier: "control",
      label: "forward L0/L1/L2 or none",
      detail: {
        what: "The selection itself: for each sender-receiver pair, the target layer the forwarding loop should match packets against.",
        why: "This is the one decision in the media path and everything else is plumbing around it. Making it per receiver is what stops one participant's bad wifi from being visible to anybody else on the call.",
        numbers: [
          { value: "re-solved every 100 to 500ms", explain: "The cadence at which this decision is recomputed for every sender-receiver pair." },
          { value: "sum of chosen layers held under ~90% of the estimate", explain: "The safety margin this decision always leaves against the bandwidth estimate." },
          { value: "audio allocated first at a fixed 50 kbps, never sacrificed", explain: "The one allocation priority that never changes regardless of contention elsewhere." },
        ],
        breaks: {
          failure: "The degradation ladder has to be ordered and reversible.",
          handled: "Top layer off the least important tiles first, then everyone but the speaker to 180p, then pause non-speakers, then audio only, an explicit ordered sequence rather than an arbitrary cutoff.",
        },
      },
    },
    {
      id: "e-pli",
      from: "sfu",
      to: "publisher",
      tier: "control",
      label: "PLI, 1 per 500ms",
      detail: {
        what: "A picture loss indication sent upstream asking the sender for an immediate keyframe on a layer some receiver wants to switch up to.",
        why: "A decoder cannot start mid group-of-pictures, so an upgrade is invisible until a keyframe arrives. The sender's periodic one is 1 to 3 seconds away, far too slow for a UI action. Requesting one is the only way to make a tile sharpen when someone expands it.",
        numbers: [
          { value: "a keyframe is 5 to 10x a delta frame", explain: "The bandwidth cost multiple this request triggers relative to ordinary frames." },
          { value: "coalesced behind a floor of one per 500ms", explain: "The rate limit applied to this request to prevent keyframe storms." },
          { value: "best case 50 to 100ms, worst case 500ms", explain: "Bounded by the PLI coalescing floor of one request per 500ms — best case catches the next slot immediately, worst case waits a full cycle." },
        ],
        breaks: {
          failure: "This is the one coupling between receivers: a slow receiver's upgrade request produces an oversized frame that every receiver on that layer pays for.",
          handled: "PLIs are coalesced and the bottom layer is always forwarded, so downgrades never need a request at all, only upgrades do.",
        },
      },
    },
    {
      id: "e-cascade",
      from: "sfu",
      to: "cascade",
      tier: "hot",
      step: 4,
      label: "backbone, FEC pre-applied",
      detail: {
        what: "Relay-to-relay forwarding of every stream a participant in the other region has subscribed to, over dedicated backbone capacity.",
        why: "It keeps each participant's first mile local, which is the leg that actually costs latency and that nobody can provision. The inter-relay link is the one hop we own end to end, so it is optimised separately with FEC applied up front.",
        numbers: [
          { value: "adds 30 to 50ms transatlantic", explain: "The one leg deliberately over-provisioned with dedicated capacity and pre-applied FEC, so every participant's local first mile stays the leg that matters most." },
          { value: "retransmit budget capped per hop at 2 retries, not end to end", explain: "The retry policy applied specifically at this hop, rather than across the whole path." },
        ],
        breaks: {
          failure: "A flapping backbone link makes the cascade root see a flood of NACKs from every downstream bridge at once.",
          handled: "Retransmit budgets are per hop rather than end to end, which is exactly why this pathology cannot cascade further upstream.",
        },
      },
    },
    {
      id: "e-mcu",
      from: "sfu",
      to: "mcu",
      tier: "hot",
      step: 5,
      label: "view-only leg",
      detail: {
        what: "The relay subscribing the mixer to the panel's streams so it can decode them and paint one composited layout.",
        why: "Only the legs that cannot take multiple streams go through here. Keeping the mixer downstream of the relay rather than in front of it means an interactive call never pays the transcode, and a webinar can run both paths simultaneously.",
        numbers: [
          { value: "~1 core per distinct output layout", explain: "The compute cost this arrow imposes on the mixer for each unique composited view it feeds." },
          { value: "30 to 80ms transcode delay", explain: "The latency this leg adds, paid only by the fixed-function endpoints that need it." },
        ],
        breaks: {
          failure: "Mixer CPU saturates as active video inputs grow.",
          handled: "The guard is capping the active-speaker count feeding it rather than adding capacity after the fact, treating the input count as the thing to bound directly.",
        },
      },
    },
    {
      id: "e-cdn",
      from: "mcu",
      to: "cdn",
      tier: "data",
      label: "one composited stream",
      detail: {
        what: "The mixer's single encoded output pushed into CDN distribution as segments for a view-only audience.",
        why: "It converts a per-viewer cost into a fanout problem, which is the only way an audience of thousands is affordable. The audience is not in the conversation, so trading 2 to 6 seconds of buffer for that saving costs them nothing they were using.",
        numbers: [
          { value: "replaces 1.5 Gbps of relay egress at 1000 viewers", explain: "The bandwidth this arrow saves by moving distribution off the relay fleet entirely." },
          { value: "2 to 6s buffer", explain: "The latency this distribution path accepts in exchange for that saving." },
        ],
        breaks: {
          failure: "Anyone promoted from the audience to the panel has to move from the CDN leg back onto the relay.",
          handled: "This is a full renegotiation and a visible several-second jump, an accepted cost since audience-to-panel promotion is rare relative to normal viewing.",
        },
      },
    },
    {
      id: "e-rec",
      from: "sfu",
      to: "recorder",
      tier: "data",
      label: "subscribes like a receiver",
      detail: {
        what: "The recorder taking an ordinary subscription to the meeting, with its own bandwidth estimate and its own layer selection.",
        why: "Nothing in the media path is durable, so a recording has to be constructed by watching rather than by reading a log. That is also why it is honest to say the file corresponds to no participant's experience.",
        numbers: [
          { value: "one more receiver in the allocator's budget", explain: "How the allocator treats the recorder: as an ordinary subscriber competing for bandwidth like any other." },
          { value: "may hold 720p from a sender the humans saw at 180p", explain: "A concrete example of how the recorder's own bandwidth estimate can diverge from what participants actually experienced." },
        ],
        breaks: {
          failure: "If the recorder's own link is the congested one, it records less than anyone actually saw.",
          handled: "Nothing in the meeting surfaces that at the time, an accepted blind spot since the recorder's health is not treated as a call-quality signal.",
        },
      },
    },
    {
      id: "e-store",
      from: "recorder",
      to: "object-store",
      tier: "data",
      label: "MP4 chunks every 5-10s",
      detail: {
        what: "Checkpointed chunk uploads: composited MP4 segments flushed to object storage as the meeting runs, not at the end of it.",
        why: "A long meeting held entirely in a process's memory is a single crash away from being gone. Chunking bounds the exposure to the checkpoint interval and lets a restarted recorder resubscribe and resume into the same output.",
        numbers: [
          { value: "flush every 5 to 10 seconds", explain: "The checkpoint cadence that bounds this arrow's worst-case data loss window." },
          { value: "~340 MB per 30-minute recording", explain: "The typical total volume this arrow moves for one meeting recording." },
          { value: "~1 PB/day in aggregate", explain: "The fleet-wide daily volume this arrow carries across all concurrent recordings." },
        ],
        breaks: {
          failure: "The chunk in flight at crash time is lost outright.",
          handled: "The frames behind it were never stored anywhere durable and cannot be replayed, an accepted bounded loss rather than something the design tries to eliminate entirely.",
        },
      },
    },
  ],
};
