import type { Diagram } from "./types";

export const ZOOM: Diagram = {
  id: "zoom",
  title: "Zoom",
  question: "Design Zoom (Video Conferencing)",
  sourceId: "patterns",
  itemId: 33,
  overview: {
    shape:
      "Two planes that share nothing: a tiny stateful WebSocket carrying join, mute and layout, and a UDP media path to a relay that forwards already-encoded video and never decodes a pixel.",
    beats: [
      "Split the planes before anyone asks why. Signalling is stateful, must not lose a message, and a 200ms delay on a mute event is invisible. Media tolerates nothing, drops rather than retries, and is two orders of magnitude larger in every dimension, so the two fleets are sized independently.",
      "The topology falls out of uplink arithmetic in fifteen seconds. Mesh costs (N-1) x 1.5 Mbps up for a single 720p encode against a flat 2.5 Mbps to a relay, so the crossover is at three participants and by five mesh needs 6 Mbps up. Total flows are N(N-1), so eight people is 56 streams and seven encoder instances per client.",
      "The sender publishes three times at once, 180p at 200 kbps, 480p at 800 kbps and 720p at 1.5 Mbps, and the relay picks which already-encoded version each receiver gets. That costs the sender 1.67x upload and buys a relay that never transcodes: roughly a tenth of a core per meeting instead of a core per composited output.",
      "The picking is a control loop, not a setting. Receivers report per-packet arrival times, bandwidth is estimated from the delay trend rather than from loss, and every 100 to 500ms the relay solves a small knapsack per receiver: audio first at 150 kbps, then layers up to about 90 percent of the estimate.",
      "Repair races the playout deadline and loses gracefully. Under about 30ms RTT a retransmit lands inside the 50 to 100ms jitter buffer and is free; beyond about 70ms it arrives after the frame was due, so you pay 20 to 30 percent forward error correction instead. Playout is never delayed to wait for a fix.",
      "Scale is regional relays cascading over the backbone so every participant pays a short first mile, plus a compositing mixer hung off to one side for the legs that can only accept one stream: dial-in, room systems, and a view-only audience handed to a CDN.",
    ],
    crux:
      "Late media is useless media, so the design triages instead of delivering. Every frame has a playout deadline and one that misses it is not late data but wrong data, which means the interesting question is what you give up first, per receiver, and how fast the loop notices. Bring durability instincts here and you build a system that freezes instead of blurring.",
    numbers: [
      "~2.5 Mbps uplink for three simulcast layers, whatever N is",
      "150ms glass to glass, of which the jitter buffer is 50 to 100ms",
      "~10% of a core per meeting on the relay, no transcode",
    ],
  },
  nodes: [
    {
      id: "media-plane",
      label: "Media plane · RTP over UDP · 150ms budget",
      kind: "group",
      x: 24,
      y: 94,
      w: 312,
      h: 422,
    },
    {
      id: "publisher",
      label: "Sending client",
      sub: "libwebrtc, three simulcast encodes",
      kind: "external",
      x: 40,
      y: 0,
      w: 280,
      detail: {
        what: "The publishing endpoint: a camera, an Opus encoder, and three independent video encode chains running simultaneously, each with its own SSRC and its own keyframes.",
        why: "The relay refuses to transcode, so the only place three quality rungs can come from is the sender's hardware encoder, which is already running and has spare capacity. Pushing the cost onto the sender is what keeps the fleet at a few thousand relay hosts rather than a few hundred thousand.",
        numbers: [
          "180p 200 kbps, 480p 800 kbps, 720p 1.5 Mbps",
          "~2.5 Mbps uplink regardless of participant count",
          "1.39M pixels per frame against 921k for 720p alone, ~1.5x the encode work",
        ],
        breaks:
          "Uplink is the scarce direction on home connections. A sender on a thin link pays 1.67x to publish the extra layers, and when it cannot it drops the top rung, so nobody in the call can see that person sharply no matter how good their own connection is.",
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
      id: "ice",
      label: "ICE + STUN/TURN",
      sub: "direct path, relay fallback",
      kind: "compute",
      x: 40,
      y: 110,
      w: 280,
      detail: {
        what: "Candidate gathering and connectivity checks that find a working UDP path between a client behind NAT and the relay, with a TURN server carrying the media when no direct pair survives.",
        why: "Almost every participant sits behind a NAT that will not accept unsolicited UDP. STUN tells a client its public mapping so a pair can be punched open, and TURN is the honest fallback: an SFU with the forwarding intelligence removed, existing purely so the call connects at all.",
        numbers: [
          "~80 to 85 percent of 1:1 attempts find a direct path",
          "a relay hop costs 15 to 40ms of the 150ms budget",
          "first mile budgeted at 10 to 30ms once the path is up",
        ],
        breaks:
          "Symmetric NAT and corporate firewalls that block UDP outright fail every candidate pair, so the call falls back to TURN and sometimes to TCP on 443, paying both the extra hop and the head-of-line blocking the whole design exists to avoid.",
        choice: {
          pick: "ICE over UDP, TURN only as a fallback",
          instead: "Relay everything through TURN, or tunnel all media over TCP on 443.",
          decider:
            "The 15 to 40ms a relay hop adds, against a budget where the jitter buffer alone claims 50 to 100ms of 150ms. Since 80 to 85 percent of paths do not need a relay, forcing everyone through one spends real latency on the majority to simplify the minority.",
          flips:
            "Locked-down enterprise networks where UDP never leaves the building, and a TCP/443 TURN path is the only thing that connects at all.",
        },
      },
    },
    {
      id: "sfu",
      label: "SFU relay (region A)",
      sub: "forwards RTP, never decodes",
      kind: "compute",
      x: 40,
      y: 220,
      w: 280,
      detail: {
        what: "The selective forwarding unit: it ingests every publisher's three layers and forwards packets from exactly one of them to each receiver, treating the layers as three unrelated streams.",
        why: "It is the cheapest thing that still gives per-receiver adaptation. Nothing is decoded, so the participant on hotel wifi is served 180p out of the same ingress that feeds 720p to everybody else, and one bad link is invisible to the rest of the call. That isolation is the entire reason the relay exists rather than a mesh.",
        numbers: [
          "~10% of a core per meeting against ~1 core per composited output",
          "5-person meeting: 12.5 Mbps in, ~11 Mbps out",
          "~800 concurrent 5-person meetings on a 16-core host at ~20 Gbps, where ~2M pps binds before bytes do",
        ],
        breaks:
          "Pod crash mid-meeting. Per-meeting state is only a routing table and a set of bandwidth estimates, a few kilobytes, so recovery is clients re-publishing to a backup rather than a media handover, and the call blips for roughly 30 seconds while the estimates settle.",
        choice: {
          pick: "An SFU for every call with three or more participants",
          instead: "Full mesh up to four or five participants, so most calls never touch a media server.",
          decider:
            "Uplink arithmetic, and it is not close. Mesh is (N-1) x 1.5 Mbps up for one 720p encode against a flat 2.5 Mbps for all three simulcast layers, so the crossover is at N=3 and by N=5 mesh wants 6 Mbps up and 6 down. Total flows are N(N-1): eight people is 56 streams and seven encoder instances per client, which is why phones thermally throttle out of mesh calls before the network does.",
          flips:
            "N is exactly 2 and ICE finds a direct path. Mesh then wins on every axis: no relay hop worth 15 to 40ms, no server capacity, and media that never touches our infrastructure, which is the cheapest end-to-end encryption story available.",
        },
      },
    },
    {
      id: "allocator",
      label: "Per-receiver allocator",
      sub: "TWCC estimate, knapsack per receiver",
      kind: "compute",
      x: 40,
      y: 330,
      w: 280,
      detail: {
        what: "The control loop that answers one question per sender-receiver pair, over and over: which of this sender's three layers do I forward to this receiver right now, or none at all.",
        why: "A receiver with 3 Mbps down in a nine-person call cannot take eight 720p streams, which would be 12 Mbps. So the budget is spent rather than filled: audio is allocated first and is never a candidate for sacrifice, then video layers are chosen to maximise a weighted quality score under the estimate.",
        numbers: [
          "re-solved every 100 to 500ms, capped at ~90% of the estimate",
          "three concurrent speakers at 50 kbps is 150 kbps, ~5% of the budget",
          "a 200-person call held at ~3 Mbps and 6 decodes per receiver",
          "phones hardware-decode 4 to 6 concurrent 480p streams, laptops 9 to 16",
        ],
        breaks:
          "Upgrading a receiver to a higher layer needs a keyframe on that layer, and a keyframe is 5 to 10x a delta frame. In a 50-person call an active-speaker change makes dozens of receivers want the same upgrade inside 100ms, and a sender that answers every request produces exactly the congestion the upgrade was meant to exploit.",
        choice: {
          pick: "Delay-gradient estimation, PLIs coalesced at one per 500ms, bottom layer always forwarded",
          instead: "Loss-based bandwidth estimation, and a keyframe served per upgrade request.",
          decider:
            "Timing on both halves. By the time packets drop a router queue has already added 100ms or more, so loss reacts to damage while the delay trend shows up 200 to 500ms earlier. And keeping the 200 kbps bottom layer on every receiver at all times makes a downgrade instantaneous rather than another keyframe request, which matters precisely because downgrades happen when the link is already in trouble.",
          flips:
            "A fixed, known network such as a studio leg on dedicated capacity, where there is nothing to estimate and a static layer assignment is simpler and just as good.",
        },
      },
    },
    {
      id: "jitter",
      label: "Jitter buffer + repair",
      sub: "50-100ms adaptive, NACK / FEC / PLC",
      kind: "compute",
      x: 40,
      y: 440,
      w: 280,
      detail: {
        what: "The receiver-side buffer that absorbs reordering and network jitter, plus the loss repair that has to complete inside it: selective retransmit, forward error correction and concealment.",
        why: "Playout is never delayed to wait for a repair. Everything here is a race against the frame's deadline, and a fix that lands after the frame was due is worse than useless because the bandwidth it consumed was taken from frames that could still have arrived in time.",
        numbers: [
          "50 to 100ms adaptive, the largest term you control at runtime",
          "at 30ms RTT a retransmit lands ~40ms later, inside the buffer",
          "beyond ~70ms RTT you pay FEC instead: 20 to 30 percent constant overhead",
          "audio loss concealment target under 0.5 percent",
        ],
        breaks:
          "The buffer trades directly against loss recovery and there is no setting that wins both. Shorten it and fewer retransmits arrive in time, so more frames are concealed; lengthen it and the conversation acquires the overlap problem that makes a call feel like a walkie-talkie.",
        choice: {
          pick: "UDP with an adaptive buffer: retransmit inside the deadline, FEC beyond it",
          instead: "A reliable ordered transport for media, TCP or a QUIC stream, so nothing is ever lost.",
          decider:
            "Head-of-line blocking against the deadline. One lost packet on a 140ms path freezes the picture for 280ms while it is repaired, and the frames queued behind it then arrive as a burst the buffer has to absorb or discard anyway. The rule is retransmit while RTT is under about half the buffer and FEC beyond it, and reliable delivery at no RTT at all.",
          flips:
            "Content with no expiry. Screen share of a static slide runs a longer buffer and near-unlimited retransmit, because a corrupted region persists until the next keyframe and a reader would rather wait 200ms than squint at a smeared slide.",
        },
      },
    },
    {
      id: "receiver",
      label: "Receiving client",
      sub: "decode, composite, report viewport",
      kind: "external",
      x: 40,
      y: 550,
      w: 280,
      detail: {
        what: "The far endpoint: it decodes whichever layers it was given, lays out the tiles, and tells the relay what it is actually showing.",
        why: "The allocator's weights come from here rather than from the server guessing. Which tile is pinned, which is the active speaker, and critically which tiles are scrolled off screen, because the client unsubscribes from those outright and that is the single largest saving available in a large grid.",
        numbers: [
          "~2.2 Mbps for a 5-person call: 1.5 speaker + 3 x 0.2 thumbnails + 0.05 audio",
          "decode and render is 15 to 25ms of the 150ms budget",
          "dragging a thumbnail to full screen costs one RTT plus encoder turnaround, 50 to 100ms best case and up to the 500ms PLI floor at worst",
        ],
        breaks:
          "Decode budget, not bandwidth, is what melts a device. Pure SFU into a 1000-person webinar would ask a laptop to decode and composite roughly 1000 streams, which is why active-speaker selection thumbnails or pauses everyone else long before a mixer becomes necessary.",
        choice: {
          pick: "Client-driven subscription: unsubscribe off-screen tiles, send pin and speaker hints upstream",
          instead: "Let the server infer intent from participant activity and the last known layout.",
          decider:
            "The server cannot see the screen, and off-screen tiles in a large grid are the biggest saving on offer: holding a 200-person call at ~3 Mbps and 6 decodes depends on it. Resuming a paused tile costs a keyframe, which is why the pause threshold carries hysteresis rather than tracking the active speaker instantly.",
          flips:
            "Fixed-layout endpoints such as room systems and broadcast legs, where the layout never changes and there is nothing useful for the client to report.",
        },
      },
    },
    {
      id: "signalling",
      label: "Signalling (WebSocket)",
      sub: "join, mute, hand, layout, presence",
      kind: "compute",
      x: 440,
      y: 0,
      w: 260,
      detail: {
        what: "The stateful control plane: one WebSocket per participant carrying join and leave, mute, raise hand, layout and presence updates.",
        why: "It is a separate fleet because it is a different system in every dimension. It tolerates 200ms happily, it must never lose a message, and it is two orders of magnitude smaller than the media plane in bandwidth, so sizing the two together would size both of them wrong.",
        numbers: [
          "15M concurrent WebSocket connections at peak",
          "~10 control events per participant per minute is ~2.5M events/s",
          "200ms of delay on a mute event is invisible; 200ms on a frame is not",
        ],
        breaks:
          "Join storms against a single meeting ID. Rate limits per IP and per meeting ID, short-lived JWTs bound to the invitee, and the waiting room all sit in front of relay allocation, so an abuse spike costs signalling capacity and never media capacity.",
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
      kind: "store",
      x: 440,
      y: 110,
      w: 260,
      detail: {
        what: "Per-meeting bookkeeping written by signalling: host, schedule, participant history, chat references and the recording URL.",
        why: "Nothing in the media path reads it, which is exactly the point. It is the durable record that a meeting existed, written at a rate the media plane would consider a rounding error, and it is the only genuinely stateful thing in the control plane.",
        numbers: [
          "~5 KB per meeting, 60M meetings/day, so ~300 GB/day",
          "RPO zero: the control plane is replicated active-active",
          "~2 min for a full regional signalling failover",
        ],
        breaks:
          "Nothing here constrains anything, which makes it the easiest place in this design to waste interview time. The failure that matters is availability during a join storm, not capacity.",
        choice: {
          pick: "A wide-column store keyed by meeting_id",
          instead: "PostgreSQL.",
          decider:
            "Access pattern rather than scale: 300 GB/day of blind writes and single-key reads with no joins, never on the media path. Postgres would carry 60M rows/day comfortably for years, so the honest decider is that this table follows the rest of the fleet rather than that it has outgrown a relational store.",
          flips:
            "When meeting analytics matter more than write volume, since real queries over scheduling and attendance are worth more than headroom nobody is using.",
        },
      },
    },
    {
      id: "cascade",
      label: "Cascade SFU (region B)",
      sub: "backbone hop, FEC pre-applied",
      kind: "compute",
      x: 440,
      y: 220,
      w: 260,
      detail: {
        what: "A second regional relay holding the other half of a cross-region meeting, bridged to the first over the backbone rather than over the public internet.",
        why: "Every participant should pay a short first mile, because the last mile is the expensive part and the part nobody controls. Cascading trades one provisioned backbone hop for the transatlantic leg that half the call would otherwise pay on every single packet.",
        numbers: [
          "adds 30 to 50ms transatlantic",
          "cascade root chosen on median participant latency",
          "~10 to 25 Tbps per major region out of ~75 Tbps across the fleet",
        ],
        breaks:
          "It breaks the bandwidth estimator's model of the path. Backbone congestion and last-mile congestion produce an identical delay gradient, so the relay degrades the receiver when the fault is upstream, which relieves nothing and costs that participant their picture for no benefit. A packet lost between relays also needs hop-by-hop retransmission, so a flapping link floods the root with NACKs.",
        choice: {
          pick: "Regional relays with SFU-to-SFU cascading over the backbone",
          instead: "One relay per meeting, placed at the latency centroid of its participants.",
          decider:
            "The first mile dominates and is the part you cannot provision. Nearest-relay keeps it at 10 to 30ms for everybody and adds a 30 to 50ms backbone hop that has dedicated capacity and pre-applied FEC; a single centroid relay puts an unmanaged long-haul leg on the last mile of every distant participant.",
          flips:
            "Meetings whose participants are all in one region, where the cascade buys nothing and the second relay is pure cost and one more failure domain.",
        },
      },
    },
    {
      id: "mcu",
      label: "MCU mixer",
      sub: "decode, composite, re-encode",
      kind: "compute",
      x: 440,
      y: 330,
      w: 260,
      detail: {
        what: "A compositing mixer that decodes every input, paints one gallery-view frame, re-encodes it, and hands each receiver exactly one stream regardless of call size.",
        why: "It exists for endpoints that can physically accept only one stream and for audiences large enough that per-receiver egress dominates. It is genuinely the wrong tool for interaction and genuinely the right one for broadcast, and a hybrid webinar runs both at once: the panel talks over the relay while the mixer composites them for the audience.",
        numbers: [
          "~1 core per distinct output layout",
          "30 to 80ms of added transcode delay, target p99 under 80ms",
          "at 1000 viewers, relay egress is 1000 x 1.5 Mbps = 1.5 Gbps per presenter",
        ],
        breaks:
          "CPU scales with the number of active video inputs, so encode p99 climbs before anything else shows a symptom. The levers are cutting the active-speaker count, pausing inactive participants, and scaling the mixer fleet horizontally.",
        choice: {
          pick: "Mixer only on view-only and fixed-function legs",
          instead: "Switch the whole meeting to a mixer past roughly 25 participants so receiver cost stays constant.",
          decider:
            "The receiver's decode budget settles it before the server's CPU does. Top 3 to 5 speakers at 480p or 720p with everyone else at 180p or paused holds a 200-person call at ~3 Mbps and 6 decodes, inside a laptop's 9 to 16 tiles, so the mixer is never actually needed for an interactive call.",
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
      x: 440,
      y: 440,
      w: 260,
      detail: {
        what: "The distribution path for a view-only audience: one composited stream segmented and handed to a CDN instead of a per-viewer relay subscription.",
        why: "Above roughly a thousand viewers you have stopped designing a conference. Nobody in that audience publishes anything, so the interactivity the 150ms budget buys them is worth nothing, and a buffered segmented stream costs a fraction of per-receiver egress.",
        numbers: [
          "2 to 6 seconds of buffer, against 150ms on the interactive leg",
          "threshold is roughly 1000 view-only attendees",
          "replaces 1.5 Gbps of relay egress per presenter with one encode plus fanout",
        ],
        breaks:
          "The buffer is a product decision people forget they made. The audience is seconds behind the panel, so anything interactive with them, Q and A, polls, applause, has to run over the signalling plane rather than in the video.",
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
      kind: "compute",
      x: 440,
      y: 550,
      w: 260,
      detail: {
        what: "A mixer-style process that joins the meeting like any other receiver, decodes, composites to a layout, encodes to MP4 and uploads in chunks with checkpoints.",
        why: "There is no canonical rendering to record. Two receivers watching the same sender sit on different layers with different keyframe histories, so anything that wants a single picture has to construct one by subscribing and building it, which is why the recording is never exactly what any participant saw.",
        numbers: [
          "checkpoints flushed every 5 to 10 seconds, lag target under 10s",
          "~340 MB for a 30-minute composited 720p file",
          "assume 5% of meetings recorded: 3M recordings/day",
        ],
        breaks:
          "A crash loses up to the checkpoint interval and there is no way to recover it, because the source frames were never durable anywhere. Checkpointing bounds the loss window; it does not eliminate it, and the product does not publish the window.",
        choice: {
          pick: "A server-side recorder subscribing as an ordinary receiver",
          instead: "Recording client-side on the host's machine, or one server recording per receiver.",
          decider:
            "Fidelity against storage. Per-receiver recording is the only faithful option and multiplies an already-1 PB/day line by participant count; one composite matches nobody's actual experience but is the only version that fits. The recorder also has its own bandwidth estimate, so it may hold 720p from a sender the humans saw at 180p.",
          flips:
            "End-to-end encrypted mode, where the relay only ever holds ciphertext, so client-side recording is the only thing that can work at all.",
        },
      },
    },
    {
      id: "object-store",
      label: "Recording store",
      sub: "MP4 chunks, 90-day retention",
      kind: "store",
      x: 440,
      y: 660,
      w: 260,
      detail: {
        what: "Region-local object storage holding finished recordings alongside the chat log and transcription for each meeting.",
        why: "It is the largest storage line in the system by two orders of magnitude, and it is the only place this design stores media at all. Everything else deliberately keeps nothing, which is why the retention default is short rather than generous.",
        numbers: [
          "3M recordings/day at ~340 MB is ~1 PB/day",
          "~90 PB hot at the 90-day default retention",
          "RPO ~10s: the last unflushed checkpoint can be lost",
        ],
        breaks:
          "Retention policy rather than capacity is the real control. Moving the default from 90 days to a year quadruples the hot footprint with no other change anywhere in the system, and nothing else in the design moves the number at all.",
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
      label: "join · mute · layout",
      dashed: true,
      detail: {
        what: "Control messages over a persistent WebSocket: join and leave, mute, raise hand, layout changes and presence.",
        why: "This is the plane that is allowed to be reliable and ordered, because none of it expires. It is also the plane a client keeps when media is failing, which is how a session survives a network blip rather than dropping.",
        numbers: ["15M concurrent connections", "~2.5M events/s at peak"],
        breaks:
          "A WebSocket disconnect mid-meeting looks like a departure unless session state is held server-side; reconnect carries a session token and the meeting state is still there.",
      },
    },
    {
      id: "e-meta",
      from: "signalling",
      to: "meeting-db",
      label: "meeting + participant state",
      dashed: true,
      detail: {
        what: "Durable writes of meeting creation, participant joins and leaves, and the recording reference once one exists.",
        why: "The control plane is the only part of this system with state worth persisting, and it must survive a regional failover with zero data loss, which is why it is replicated active-active rather than cached.",
        numbers: ["~5 KB per meeting", "~300 GB/day"],
        breaks:
          "If this write path stalls, meetings still run because the media plane never reads it, so the failure is silent until someone goes looking for a recording that was never linked.",
      },
    },
    {
      id: "e-alloc",
      from: "signalling",
      to: "sfu",
      label: "SFU endpoint + JWT",
      dashed: true,
      detail: {
        what: "The control plane picking the nearest healthy relay for a joining client and issuing a short-lived meeting token bound to that invitee.",
        why: "Allocation deliberately happens after authorisation and after the waiting room, so a join storm consumes signalling capacity and never causes a relay to be allocated. It is also where anycast routing sends a client to a different region during an outage.",
        numbers: ["99.9% of media planes established within 3s of join", "JWTs short-lived and cached at the signalling edge"],
        breaks:
          "If token validation degrades under a join storm the whole meeting fails to start, which is why the auth 5xx rate is a paging signal and the rate limits sit in front of it.",
      },
    },
    {
      id: "e-ice",
      from: "publisher",
      to: "ice",
      label: "candidate pairs, STUN",
      detail: {
        what: "Candidate gathering and connectivity checks: the client learns its public mapping and probes every address pair until one works.",
        why: "No media flows until a path exists, and behind NAT a path has to be discovered rather than assumed. Doing it up front is what lets the media plane be plain UDP with no connection semantics of its own.",
        numbers: ["~80 to 85 percent find a direct path", "the rest fall back to TURN"],
        breaks:
          "Every candidate pair failing means the call either relays through TURN, paying 15 to 40ms, or does not connect at all on networks that block UDP entirely.",
      },
    },
    {
      id: "e-pub",
      from: "ice",
      to: "sfu",
      label: "3 layers, 2.5 Mbps up",
      animated: true,
      detail: {
        what: "The publish leg: RTP over UDP carrying all three simulcast layers plus Opus audio, up the established path to the relay.",
        why: "The sender uploads once regardless of how many people are in the call, which is the whole reason a relay beats a mesh. Cost is flat in N here, where mesh grows linearly and the client's encoder count grows with it.",
        numbers: ["2.5 Mbps up whatever N is", "Opus audio at 40 to 50 kbps", "first mile 10 to 30ms"],
        breaks:
          "This leg is the sender's own uplink, so congestion here degrades that participant for everybody at once, unlike receive-side congestion which is isolated per receiver.",
      },
    },
    {
      id: "e-egress",
      from: "sfu",
      to: "jitter",
      label: "one layer, ~2.2 Mbps",
      animated: true,
      detail: {
        what: "The forwarding leg: packets from exactly one chosen layer per sender, plus audio, arriving at this receiver's buffer.",
        why: "Egress sits below ingress on purpose. The relay forwards one layer of three and discards the rest, so a 5-person meeting takes 12.5 Mbps in and pushes about 11 Mbps out, and a slow receiver simply gets a smaller slice of the same ingress.",
        numbers: ["1.5 speaker + 3 x 0.2 thumbnails + 0.05 audio ≈ 2.2 Mbps", "relay forwarding adds under 1ms because nothing is decoded", "second mile 10 to 30ms"],
        breaks:
          "Persistent loss above roughly 20 percent on this leg exhausts FEC and retransmit, at which point the receiver drops to audio only with in-band redundancy rather than losing the call.",
      },
    },
    {
      id: "e-play",
      from: "jitter",
      to: "receiver",
      label: "decode + render",
      animated: true,
      detail: {
        what: "Frames leaving the buffer at their playout deadline, decoded and composited into the tile layout.",
        why: "The deadline is absolute: anything not here on time is discarded and concealed rather than waited for. Audio and video are aligned via RTP timestamps mapped to a common wall clock, and video is what waits, never audio.",
        numbers: ["decode and render 15 to 25ms", "total 105 to 215ms glass to glass"],
        breaks:
          "Resuming a paused or dropped video stream arrives late relative to audio, so the player ramps the offset out over a second or two rather than jumping, which is visible as a brief drift.",
      },
    },
    {
      id: "e-twcc",
      from: "jitter",
      to: "allocator",
      label: "TWCC arrival reports",
      dashed: true,
      offset: 30,
      fromSide: "left",
      toSide: "left",
      detail: {
        what: "Per-packet arrival timestamps reported back by sequence number, from which the sender and relay derive an available-bandwidth estimate.",
        why: "Comparing inter-arrival deltas against inter-departure deltas catches a queue building before anything is lost, which is 200 to 500ms of warning that loss-based estimation never gives you. Probing upward is deliberate padding, so a wrong guess wastes filler rather than corrupting real media.",
        numbers: ["a consistent positive delay trend precedes loss by 200 to 500ms", "a report showing >5% loss downgrades that receiver's target layer"],
        breaks:
          "On a cascaded meeting the signal is ambiguous: backbone and last-mile congestion look identical in the gradient, so the loop degrades a receiver whose own link was fine.",
      },
    },
    {
      id: "e-hint",
      from: "receiver",
      to: "allocator",
      label: "viewport + pin hints",
      dashed: true,
      offset: 60,
      fromSide: "left",
      toSide: "left",
      detail: {
        what: "Client-side layout context: which tile is pinned, which is the active speaker, and which tiles are off screen and therefore unsubscribed.",
        why: "The weights in the allocator come from the client rather than the server guessing, because only the client knows what is rendered. Unsubscribing off-screen tiles outright is the largest single saving in a big grid and costs nothing to compute.",
        numbers: ["top 3 to 5 speakers at 480p or 720p, the rest at 180p or paused"],
        breaks:
          "Resuming a paused tile needs a keyframe, so a hint stream that tracks the active speaker instantly generates keyframe churn; the threshold carries hysteresis for exactly this reason.",
      },
    },
    {
      id: "e-decide",
      from: "allocator",
      to: "sfu",
      label: "forward L0/L1/L2 or none",
      dashed: true,
      detail: {
        what: "The selection itself: for each sender-receiver pair, the target layer the forwarding loop should match packets against.",
        why: "This is the one decision in the media path and everything else is plumbing around it. Making it per receiver is what stops one participant's bad wifi from being visible to anybody else on the call.",
        numbers: ["re-solved every 100 to 500ms", "sum of chosen layers held under ~90% of the estimate", "audio allocated first, never sacrificed"],
        breaks:
          "The degradation ladder has to be ordered and reversible: top layer off the least important tiles, then everyone but the speaker to 180p, then pause non-speakers, then audio only at ~50 kbps with in-band redundancy.",
      },
    },
    {
      id: "e-pli",
      from: "sfu",
      to: "publisher",
      label: "PLI, 1 per 500ms",
      dashed: true,
      offset: 90,
      fromSide: "left",
      toSide: "left",
      detail: {
        what: "A picture loss indication sent upstream asking the sender for an immediate keyframe on a layer some receiver wants to switch up to.",
        why: "A decoder cannot start mid group-of-pictures, so an upgrade is invisible until a keyframe arrives, and the sender's periodic one is 1 to 3 seconds away, far too slow for a UI action. Requesting one is the only way to make a tile sharpen when someone expands it.",
        numbers: ["a keyframe is 5 to 10x a delta frame", "coalesced behind a floor of one per 500ms", "best case 50 to 100ms, worst case 500ms"],
        breaks:
          "This is the one coupling between receivers: a slow receiver's upgrade request produces an oversized frame that every receiver on that layer pays for, which is why PLIs are coalesced and the bottom layer is always forwarded so downgrades never need one.",
      },
    },
    {
      id: "e-cascade",
      from: "sfu",
      to: "cascade",
      label: "backbone, FEC pre-applied",
      detail: {
        what: "Relay-to-relay forwarding of every stream a participant in the other region has subscribed to, over dedicated backbone capacity.",
        why: "It keeps each participant's first mile local, which is the leg that actually costs latency and that nobody can provision. The inter-relay link is the one hop we own end to end, so it is optimised separately with FEC applied up front.",
        numbers: ["adds 30 to 50ms transatlantic", "per-hop retransmit budgets to cap NACK amplification"],
        breaks:
          "A flapping backbone link makes the cascade root see a flood of NACKs from every downstream bridge at once, which is why retransmit budgets are per hop rather than end to end.",
      },
    },
    {
      id: "e-mcu",
      from: "sfu",
      to: "mcu",
      label: "view-only leg",
      detail: {
        what: "The relay subscribing the mixer to the panel's streams so it can decode them and paint one composited layout.",
        why: "Only the legs that cannot take multiple streams go through here. Keeping the mixer downstream of the relay rather than in front of it means an interactive call never pays the transcode, and a webinar can run both paths simultaneously.",
        numbers: ["~1 core per distinct output layout", "30 to 80ms transcode delay"],
        breaks:
          "Mixer CPU saturates as active video inputs grow, so the guard is capping the active-speaker count feeding it rather than adding capacity after the fact.",
      },
    },
    {
      id: "e-cdn",
      from: "mcu",
      to: "cdn",
      label: "one composited stream",
      detail: {
        what: "The mixer's single encoded output pushed into CDN distribution as segments for a view-only audience.",
        why: "It converts a per-viewer cost into a fanout problem, which is the only way an audience of thousands is affordable. The audience is not in the conversation, so trading 2 to 6 seconds of buffer for that saving costs them nothing they were using.",
        numbers: ["replaces 1.5 Gbps of relay egress at 1000 viewers", "2 to 6s buffer"],
        breaks:
          "Anyone promoted from the audience to the panel has to move from the CDN leg back onto the relay, which is a full renegotiation and a visible several-second jump.",
      },
    },
    {
      id: "e-rec",
      from: "sfu",
      to: "recorder",
      label: "subscribes like a receiver",
      detail: {
        what: "The recorder taking an ordinary subscription to the meeting, with its own bandwidth estimate and its own layer selection.",
        why: "Nothing in the media path is durable, so a recording has to be constructed by watching rather than by reading a log. That is also why it is honest to say the file corresponds to no participant's experience.",
        numbers: ["one more receiver in the allocator's budget", "may hold 720p from a sender the humans saw at 180p"],
        breaks:
          "If the recorder's own link is the congested one, it records less than anyone actually saw, and nothing in the meeting surfaces that at the time.",
      },
    },
    {
      id: "e-store",
      from: "recorder",
      to: "object-store",
      label: "MP4 chunks every 5-10s",
      detail: {
        what: "Checkpointed chunk uploads: composited MP4 segments flushed to object storage as the meeting runs, not at the end of it.",
        why: "A long meeting held entirely in a process's memory is a single crash away from being gone. Chunking bounds the exposure to the checkpoint interval and lets a restarted recorder resubscribe and resume into the same output.",
        numbers: ["flush every 5 to 10 seconds", "~340 MB per 30-minute recording", "~1 PB/day in aggregate"],
        breaks:
          "The chunk in flight at crash time is lost outright, because the frames behind it were never stored anywhere durable and cannot be replayed.",
      },
    },
  ],
};
