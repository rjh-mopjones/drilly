---
type: interview-prep
---

# Networking Interview Primer — 334 Questions

Comprehensive Q+A primer for senior backend / DevOps / SRE networking interviews. Seventh entry in the DevOps track — sister note to the Linux, Kubernetes, Observability, Terraform, Docker, and CI/CD primers. The protocols and mechanics every backend engineer is expected to reason about: the OSI/TCP-IP models, IP & subnetting, TCP & UDP, DNS, HTTP, TLS, load balancing, proxies & CDNs, NAT & firewalls, latency vs bandwidth, sockets, cloud & modern networking, and packet-level troubleshooting.

Each answer is interview-shaped: opinionated, concrete, real commands (`dig`, `curl -v`, `tcpdump`, `ss`, `mtr`, `openssl s_client`), protocol accuracy, failure modes, and production tradeoffs. Backend/SRE framing, protocol-first and vendor-neutral.

1. [[#Networking Fundamentals & the OSI / TCP-IP Models]]
2. [[#IP Addressing & Subnetting]]
3. [[#The Link Layer & LAN]]
4. [[#Routing & the Network Layer]]
5. [[#TCP Deep Dive]]
6. [[#UDP & When to Use It]]
7. [[#DNS]]
8. [[#HTTP]]
9. [[#HTTPS & TLS]]
10. [[#Application-Layer Protocols]]
11. [[#Load Balancing]]
12. [[#Proxies, Reverse Proxies & API Gateways]]
13. [[#NAT, Firewalls & Network Security Basics]]
14. [[#CDNs & Edge]]
15. [[#Network Performance & Latency]]
16. [[#Sockets & Network Programming]]
17. [[#Network Troubleshooting Tools]]
18. [[#Network Security & Attacks]]
19. [[#Cloud & Virtual Networking]]
20. [[#Modern Networking]]
21. [[#Scenario & Troubleshooting Playbooks]]

---

## Networking Fundamentals & the OSI / TCP-IP Models

### Summary

**What this topic covers**

The conceptual scaffolding every networking interview rests on: what a network *is*, why we build protocols in layers, and the two reference models everyone argues over — the academic **OSI 7-layer model** and the pragmatic **TCP/IP 4-layer model** that the real internet actually runs. The 16 questions here establish the vocabulary and the mental furniture for everything that follows: where IP lives (layer 3), where TCP/UDP live (layer 4), where HTTP/TLS/DNS live (layer 7), and what a switch (L2) vs a router (L3) vs an L7 load balancer actually operate on. You'll also walk the full stack end-to-end via the canonical "what happens when you type a URL and press enter" question — DNS → TCP → TLS → HTTP → render — which previews every later topic. Get this topic solid and the rest of the primer is filling in detail; get it shaky and you'll mislabel layers for the whole interview.

**Mental model**

Think of layering as **separation of concerns for the wire**. Each layer solves one problem and hands a clean abstraction to the layer above, exactly like a well-factored codebase. The application (HTTP) doesn't care whether bits travel over fibre, copper, or Wi-Fi; the transport layer (TCP) turns an unreliable packet channel into a reliable byte stream; the network layer (IP) figures out how to get a packet across the planet; the link layer moves a frame to the next hop. Because the interfaces between layers are stable, you can swap Wi-Fi for Ethernet without rewriting your web server, and you can run HTTP, SSH, and email over the same IP substrate. The single most useful consequence for an engineer is **debugging by layer**: when something breaks, you isolate *which* layer failed — cable/NIC (L1/L2), IP reachability (L3, `ping`), port/connection (L4, `ss`/`telnet`), or the application/TLS (L7, `curl -v`). That discipline turns "the site is down" into a bisection instead of a guessing game.

**Key terms**

- **Protocol** — an agreed set of rules for format and exchange (TCP, IP, HTTP). Interoperability comes from shared protocols, not shared vendors.
- **Layer** — one horizontal slice of responsibility; talks to the layer directly above and below via a defined interface.
- **OSI model** — the 7-layer academic reference: Physical, Data Link, Network, Transport, Session, Presentation, Application.
- **TCP/IP model** — the practical 4-layer stack the internet runs: Link, Internet, Transport, Application.
- **Encapsulation** — each layer wraps the layer above's data in its own header (and sometimes trailer) as it goes down the stack; decapsulation strips them on the way up.
- **PDU (Protocol Data Unit)** — the name for the data at each layer: **segment** (L4/TCP), **datagram** (L4/UDP), **packet** (L3), **frame** (L2), **bits** (L1).
- **Header** — per-layer metadata (source/dest addresses, ports, flags) prepended to the payload.
- **Encapsulation order** — application data → TCP segment → IP packet → Ethernet frame → bits on the wire.
- **End-to-end principle** — keep the network dumb and fast; put intelligence (reliability, encryption) at the endpoints.
- **MAC vs IP vs port** — three addresses at three layers: MAC (L2, local link), IP (L3, host across the internet), port (L4, which process on the host).
- **Client / server / peer** — roles, not machines: the initiator, the responder, and (in P2P) a node that is both.
- **Bandwidth vs latency vs throughput** — capacity vs delay vs actual achieved rate; distinct and often confused.

**Why interviewers ask this**

Layering is the fastest way to tell whether a candidate *thinks* in systems or memorises trivia. A junior recites "OSI has 7 layers" and stalls; a senior uses layers as a **diagnostic and design tool** — "the TLS handshake failing means we're past L3/L4 connectivity, so it's certificate or SNI, not routing." Interviewers also probe the OSI-vs-real-world gap: knowing that Session and Presentation don't cleanly exist in the TCP/IP stack (they're folded into the application) signals you've actually operated systems rather than just read a textbook. And "what happens when you type a URL" is the classic because it's endless — the interviewer can stop you at any layer and drill. For backend/SRE roles, the signal is: can you localise a failure to a layer under pressure? That skill *is* the job during an incident.

**Common confusions**

- "OSI is what the internet runs on" — no; the internet runs the **TCP/IP** model. OSI is a teaching/reference model; Session and Presentation have no real dedicated protocols in practice.
- "A packet and a frame are the same thing" — different layers. A frame (L2) carries a packet (L3) which carries a segment (L4). Precision here signals competence.
- "Higher layer number = physically higher/faster" — the numbers are just abstraction levels, not performance tiers.
- "TCP is a layer-3 protocol" — TCP is **layer 4** (transport). IP is layer 3. This mix-up is an instant junior tell.
- "A switch and a router are interchangeable" — a switch is L2 (forwards by MAC within a LAN); a router is L3 (forwards by IP between networks). An L7 load balancer operates at the application layer entirely.
- "More bandwidth makes everything faster" — bandwidth is capacity; latency is delay. A fat pipe doesn't shrink RTT (covered in depth in the performance topic).

**What follows from this topic**

Everything. **IP Addressing & Subnetting** and **The Link Layer & LAN** zoom into layers 3 and 2. **TCP/UDP** owns layer 4 (the handshake, reliability, congestion control). **DNS**, **HTTP**, and **TLS** all live at layer 7. **Load balancing & proxies** splits precisely along the L4-vs-L7 line you learned here. And every **diagnostics** question — `ping` (L3), `ss` (L4), `curl -v`/`openssl s_client` (L7) — is really "which layer is broken?" Keep the layer map in your head; it's the index for the whole primer.

### Q1. What is a computer network, and why do we build protocols in layers?

A **network** is two or more devices that can exchange data over some medium (copper, fibre, radio). The interesting problems aren't "how do electrons move" — they're *reliability, addressing, routing, and interoperability across billions of heterogeneous devices*. Layering is how we tame that complexity.

**Layering = separation of concerns for the wire.** Each layer solves one problem and exposes a clean interface:

- The **application** (HTTP) worries about resources and verbs, not routing.
- **Transport** (TCP) turns unreliable packets into a reliable byte stream.
- **Network** (IP) gets a packet across the planet, hop by hop.
- **Link** moves a frame to the next physical device.

Two payoffs. **Interoperability**: anyone implementing the protocol interoperates, regardless of vendor or OS — that's why the internet works at all. **Substitutability**: you can swap Wi-Fi for Ethernet at L2 without touching your web server at L7, because the interface between layers is stable. The cost is a little header overhead per layer, which is a bargain for the flexibility.

### Q2. Describe the seven layers of the OSI model with a concrete example of each.

Top to bottom (mnemonic: **A**ll **P**eople **S**eem **T**o **N**eed **D**ata **P**rocessing):

| # | Layer | Job | Concrete example |
|---|-------|-----|------------------|
| 7 | Application | Interface to the user/app | HTTP, DNS, SMTP, SSH |
| 6 | Presentation | Encoding, encryption, compression | TLS, JPEG, UTF-8, gzip |
| 5 | Session | Establish/manage/tear down sessions | RPC session, NetBIOS |
| 4 | Transport | End-to-end delivery, ports | TCP, UDP |
| 3 | Network | Logical addressing, routing | IP, ICMP, routers |
| 2 | Data Link | Node-to-node on a link, MAC | Ethernet, ARP, switches |
| 1 | Physical | Bits on the medium | Cables, NICs, radio, voltage |

The honest caveat: layers 5 and 6 barely exist as standalone protocols in the real internet — TLS is often called "L6-ish" but really sits between L4 and L7 in practice. Interviewers love watching you acknowledge that gap rather than pretending OSI is gospel.

### Q3. What is the TCP/IP model and how does it map to OSI?

The **TCP/IP model** is the 4-layer stack the internet actually runs. It collapses OSI's top three and bottom two:

| TCP/IP (4) | Maps to OSI | Examples |
|------------|-------------|----------|
| Application | 5, 6, 7 | HTTP, DNS, TLS, SSH |
| Transport | 4 | TCP, UDP |
| Internet | 3 | IP, ICMP |
| Link | 1, 2 | Ethernet, ARP, Wi-Fi |

The key insight: the internet's designers didn't bother separating Session and Presentation — applications handle their own sessions and encoding. So when someone says "layer 7," in practice they mean "the application layer," which quietly includes what OSI called 5 and 6. TCP/IP is descriptive (it matches reality); OSI is prescriptive (a teaching scaffold). Interviewers use OSI for the vocabulary and TCP/IP for the truth.

### Q4. Walk me through encapsulation and decapsulation.

**Encapsulation** is what happens as data travels *down* the stack on the sender: each layer wraps the layer above's data in its own header (and L2 adds a trailer too).

```text
Application:  [ HTTP request                      ]   <- application data
Transport:    [ TCP hdr | HTTP request            ]   <- segment
Network:      [ IP hdr  | TCP hdr | HTTP request  ]   <- packet
Link:         [ Eth hdr | IP hdr | TCP hdr | ... | Eth trailer ]  <- frame
Physical:     10110100101110...                        <- bits
```

Each header carries that layer's addressing: TCP adds source/dest **ports**, IP adds source/dest **IP addresses**, Ethernet adds source/dest **MAC addresses**. The PDU gets a name at each layer: **segment** (TCP) → **packet** (IP) → **frame** (Ethernet) → **bits**.

**Decapsulation** is the reverse on the receiver: the NIC reads bits, L2 strips the Ethernet frame and checks the MAC, L3 strips the IP header and checks the destination IP, L4 strips the TCP header and delivers to the right port, and the application gets its clean HTTP request back. Every router along the path does a partial version — decapsulate to L3, make a routing decision, re-encapsulate in a *new* L2 frame for the next hop (which is why MACs change hop-to-hop but the IPs stay the same).

### Q5. Which layer do IP, TCP, HTTP, and Ethernet each operate at?

Memorise this table — mislabelling is the fastest way to lose credibility:

| Thing | Layer | Model role |
|-------|-------|-----------|
| Ethernet / MAC / ARP | 2 (Data Link) | Local delivery on a LAN |
| A **switch** | 2 | Forwards frames by MAC |
| IP / ICMP | 3 (Network) | Routing between networks |
| A **router** | 3 | Forwards packets by IP |
| TCP / UDP / ports | 4 (Transport) | End-to-end, process-to-process |
| An **L4 load balancer** | 4 | Balances by IP:port |
| TLS | ~6 / folded into 7 | Encryption |
| HTTP / DNS / SSH | 7 (Application) | The app protocol |
| An **L7 load balancer** | 7 | Routes by URL/host/header |

A neat sanity check: a device operates at the highest layer whose headers it *reads and acts on*. A switch reads MACs (L2); a router reads IPs (L3); an L7 LB reads the HTTP `Host` header and path (L7).

### Q6. Why is the layered model useful for debugging a production issue?

Because it turns "the site is broken" into a **binary search over layers**. You test each layer and localise the failure:

```bash
# L3 — is the host reachable at the IP layer?
ping api.acme.com

# L4 — is something listening on the port; can we open a TCP connection?
nc -vz api.acme.com 443        # or: ss -tnp

# L7 (app + TLS) — does the request/handshake actually work?
curl -v https://api.acme.com/health
openssl s_client -connect api.acme.com:443 -servername api.acme.com
```

If `ping` works but `nc` to :443 fails → L3 fine, L4 problem (nothing listening, or a firewall dropping the port). If `nc` connects but `curl` hangs on the TLS handshake → connectivity is fine, it's a cert/SNI/L7 issue. If DNS doesn't resolve at all, you never even reach L3. This layer-by-layer bisection is the single most valuable habit the model gives an SRE — it replaces flailing with a method.

### Q7. What is the end-to-end principle?

The idea that **the network core should stay dumb and fast, while intelligence lives at the endpoints**. Routers just forward packets; they don't guarantee delivery, order, or encryption. If you want reliability, TCP provides it *at the endpoints*. If you want confidentiality, TLS provides it *at the endpoints*. The network in the middle doesn't need to understand either.

This is why the internet scaled. A router doesn't track your TCP connection state or decrypt your traffic — it just moves packets, so it can be simple and blindingly fast. It also means you can invent new endpoint protocols (QUIC, HTTP/3) without upgrading every router on earth. The principle erodes at the edges — NAT, firewalls, and deep-packet-inspection middleboxes *do* inspect and modify traffic — and that erosion is exactly why deploying new transport protocols is hard (covered in the HTTP/3 and NAT questions).

### Q8. What's the difference between a switch, a router, and an L7 load balancer?

They operate at three different layers, which determines what they can "see":

- **Switch (L2)** — forwards **frames** based on destination **MAC address** within a single LAN. It learns which MAC lives on which port and builds a table. It has no concept of IP. Fast, dumb, local.
- **Router (L3)** — forwards **packets** based on destination **IP address**, between different networks. It makes routing decisions, decrements TTL, and re-frames the packet for the next hop. This is the device that connects your LAN to the internet.
- **L7 load balancer (application layer)** — terminates the connection and reads the actual **HTTP request** — host, path, headers, cookies — to decide where to route. It can send `/api/*` to one pool and `/static/*` to another, do TLS termination, and rewrite headers. Far more capable but heavier than an L4 LB (which only sees IP:port).

The rule: a device acts at the highest layer whose header it inspects.

### Q9. What are MAC addresses, IP addresses, and ports — and how do they relate across layers?

Three addresses at three layers, each answering a different question:

- **MAC address (L2)** — "which physical NIC on *this local link*?" A 48-bit hardware address (`00:1a:2b:3c:4d:5e`). Not routable; only meaningful within one LAN segment. Changes at every hop.
- **IP address (L3)** — "which *host*, anywhere on the internet?" A logical address (`192.168.1.10`). Stable end-to-end across the whole path.
- **Port (L4)** — "which *process/socket* on that host?" A 16-bit number (`443`). Lets one IP run many services.

The full identity of a network conversation is the **4-tuple**: `(source IP, source port, dest IP, dest port)`. An analogy: the IP is the street address of a building, the port is the apartment number, and the MAC is like "hand this to the courier standing next to you right now" — it only matters for the immediate handoff. Every router strips the old MACs and writes new ones for the next hop, while the IPs and ports ride unchanged from source to destination.

### Q10. What happens when you type a URL into your browser and press Enter? (high-level walkthrough)

The canonical whole-stack question. High level, layer by layer:

1. **DNS resolution (L7/UDP)** — the browser resolves `acme.com` to an IP. It checks caches (browser → OS → resolver), and if needed the resolver walks root → TLD (`.com`) → authoritative servers.
2. **TCP handshake (L4)** — the browser opens a TCP connection to that IP on port 443 via the 3-way handshake (SYN, SYN-ACK, ACK).
3. **TLS handshake (L6/7)** — for HTTPS, client and server negotiate a cipher, the server presents its certificate (validated against a trusted CA chain), and they derive session keys. TLS 1.3 does this in one round trip.
4. **HTTP request/response (L7)** — the browser sends `GET / HTTP/2` with headers (Host, cookies, Accept); the server responds with a status code and HTML.
5. **Render** — the browser parses HTML, fetches sub-resources (CSS, JS, images — often reusing the connection or opening new ones), builds the DOM, and paints.

Underneath every one of those steps, packets are being encapsulated (segment → packet → frame), routed hop-by-hop via IP, and framed onto each link via Ethernet/Wi-Fi with ARP resolving next-hop MACs. Interviewers stop you anywhere and drill — "how does DNS actually find the authoritative server?" or "what's in that TLS handshake?" — which is why this one question previews the entire primer.

### Q11. Do protocols always map cleanly onto the OSI layers?

No, and pretending they do is a tell. Real protocols smear across boundaries:

- **TLS** doesn't fit one OSI layer — it sits above TCP (L4) but below HTTP (L7), often labelled "L6-ish," but it's really its own thing.
- **ARP** is used *by* L3 (to resolve IP→MAC) but operates *at* L2 — it straddles the boundary.
- **ICMP** rides inside IP packets (so it looks L4-ish) but is considered part of L3.
- **QUIC** implements transport reliability (L4 behaviour) but runs *over* UDP in userspace and bundles TLS — deliberately blurring L4 through L7 to escape OS/middlebox ossification.

The lesson: OSI is a **map, not the territory**. Use it as shared vocabulary for locating things roughly, not as a rigid taxonomy. Seniors say "roughly L4" and move on; juniors get stuck insisting ARP must belong to exactly one layer.

### Q12. Why don't real networks match the OSI model perfectly?

Because OSI was designed by committee *before* the internet won, and the internet's TCP/IP stack — which was built by pragmatists shipping working code — is what actually deployed. The result:

- **Session and Presentation (L5/L6) never materialised as standalone protocols.** Applications handle their own session state and encoding, so those layers are effectively empty in practice.
- **The application layer is a catch-all** for everything OSI split into 5/6/7.
- **New protocols intentionally violate the layering** to work around real-world constraints — QUIC reimplements transport over UDP precisely because middleboxes (NAT, firewalls) had ossified TCP and made it un-upgradeable.

So OSI survives as a *teaching and communication* tool — it gives everyone a shared "layer 3 vs layer 7" vocabulary — while TCP/IP describes what's on the wire. Knowing both, and knowing *why* they differ, is the senior signal.

### Q13. What are the roles of client, server, and peer?

They're **roles in a conversation, not fixed identities**:

- **Client** — the initiator. Opens the connection, sends the first request. Your browser, `curl`, a mobile app.
- **Server** — the responder. Listens on a well-known port, waits for connections, serves responses. nginx, a database, an API.
- **Peer** — in peer-to-peer (P2P) systems, a node that acts as *both* client and server — it requests data from others and serves data to others simultaneously (BitTorrent, some blockchain and WebRTC setups).

A single machine can be all of these at once: your laptop is a client to `acme.com`, a server to your phone casting to it, and a peer in a mesh VPN. The role is defined per-connection by who initiates and who listens. This matters because firewalls, NAT, and load balancers all care about *direction* — inbound (someone connecting to your listening port) vs outbound (you connecting out) are treated very differently.

### Q14. What's the difference between bandwidth, latency, and throughput?

Three distinct things people constantly conflate (full treatment in the performance topic, but the intro matters):

- **Bandwidth** — the *capacity* of the link: max bits per second it *could* carry (e.g. 1 Gbps). Like the number of lanes on a motorway.
- **Latency** — the *delay* for one bit to travel end-to-end, usually measured as **RTT** (round-trip time) in milliseconds. Like how long the drive takes, regardless of lanes.
- **Throughput** — the *actual* achieved rate in practice, always ≤ bandwidth, limited by latency, packet loss, congestion, and protocol overhead. The traffic that actually gets through.

The trap: **more bandwidth does not reduce latency**. Upgrading from 100 Mbps to 1 Gbps won't make a request to a server 100 ms away arrive faster — the round trip is bounded by distance and the speed of light. This is why a CDN edge 10 ms away beats an origin 150 ms away even on a slower pipe, and why "just add bandwidth" fails to fix latency-bound workloads.

### Q15. If two hosts can ping each other but an application won't connect, which layers are you suspicious of?

`ping` succeeding proves **L3 (IP reachability)** works — packets get there and back. So the failure is *above* L3. Bisect upward:

```bash
# L4 — can we even open a TCP connection to the port?
nc -vz db.acme.com 5432
ss -tnp | grep 5432          # is anything actually LISTENing?

# L7 — connection opens but the app misbehaves?
curl -v https://api.acme.com/health
```

Prime suspects, in order:

- **L4 / firewall** — a firewall or security group dropping the specific port (ping is ICMP, a *different* protocol, so it can pass while TCP/443 is blocked). Symptom: `nc` times out.
- **Nothing listening** — the service is down or bound to the wrong interface (`127.0.0.1` instead of `0.0.0.0`). Symptom: **connection refused** (RST), not a timeout.
- **L7 / TLS** — connection opens but the handshake or app-level auth fails (bad cert, wrong SNI, app returning 500).

The "ping works but app doesn't" pattern is a classic because it *proves* the problem isn't routing, forcing you to reason about layers 4 and 7 — exactly the discipline the model teaches.

### Q16. Why does encapsulation add a header at every layer instead of one big header?

Because **each layer needs its own addressing and control fields, and only the peer layer on the other side should read them.** Separating headers keeps the layers independent:

- The **Ethernet header** (MACs) is stripped and rewritten at *every hop* — it's purely local. Bundling it with the IP header would force routers to rewrite fields that should stay untouched end-to-end.
- The **IP header** (source/dest IP, TTL) must survive end-to-end but be readable by every router for routing decisions.
- The **TCP header** (ports, sequence numbers, flags) is meant for the *destination host only* — routers never look at it.

Separate headers mean each layer can evolve independently: IPv6 changed the L3 header without touching TCP; QUIC changed the transport without touching IP. It also makes decapsulation clean — each layer peels exactly its own header and hands the rest up. The small per-layer overhead (a few dozen bytes) buys enormous modularity, which is the whole point of layering.

## IP Addressing & Subnetting

### Summary

**What this topic covers**

How hosts are addressed at layer 3 and how networks are carved up. The 17 questions cover **IPv4** structure (32 bits, dotted decimal, network vs host portions), **CIDR** notation and the prefix-length math, **subnetting** (computing network address, broadcast, usable host range, and host count for any prefix), **subnet masks**, **RFC1918 private ranges** and public-vs-private addressing, **NAT/PAT** and why it exists (IPv4 exhaustion), special addresses (loopback `127.0.0.1`, link-local `169.254`, APIPA, `0.0.0.0`), the **default gateway** and the same-subnet-vs-different-subnet decision, **DHCP**, and **IPv6** (128 bits, abbreviation, SLAAC, dual-stack, why adoption drags). Plus the address *types* — unicast, broadcast, multicast, anycast — and a worked subnetting example with VLSM. This is the topic interviewers use to check whether you can do arithmetic under pressure and whether you understand *why* a host decides to send a packet to its gateway or directly to a peer.

**Mental model**

An IPv4 address is **32 bits split into a network part and a host part**, and the *only* thing that tells you where the split is is the **prefix length** (the `/24`). Internalise that a subnet is just "all addresses that share the same network bits." Given a prefix, everything follows mechanically: the number of host bits is `32 − prefix`, the number of addresses is `2^(32−prefix)`, the first address is the **network address** (all host bits 0), the last is the **broadcast** (all host bits 1), and usable hosts are the ones in between — hence the famous **−2**. A `/24` has 8 host bits → 256 addresses → 254 usable. The second mental tool is the **same-subnet test**: a host ANDs its own IP and the destination IP with its subnet mask; if the network portions match, the destination is *local* (send the frame directly, resolve its MAC via ARP); if they differ, it's *remote* (send the frame to the **default gateway's** MAC and let the router handle it). Almost every "why can't this host reach that host" bug is a subnet-mask or gateway misconfiguration, so this test is the workhorse of the whole topic.

**Key terms**

- **IPv4 address** — a 32-bit L3 logical address, written as four dotted decimal octets (`192.168.1.10`).
- **Network vs host portion** — the prefix bits identify the network; the remaining bits identify the host within it.
- **CIDR / prefix length** — `/24` means the first 24 bits are the network; replaces old classful A/B/C addressing.
- **Subnet mask** — the same split expressed as a mask: `/24` = `255.255.255.0`.
- **Network address** — all host bits 0; names the subnet, not assignable to a host.
- **Broadcast address** — all host bits 1; reaches every host on the subnet, not assignable.
- **RFC1918** — private ranges `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`; not routable on the public internet.
- **NAT / PAT** — maps many private hosts onto one public IP by rewriting addresses (and ports, for PAT/overload).
- **Default gateway** — the router a host sends to when the destination is on a different subnet.
- **DHCP** — the protocol that auto-assigns IP, mask, gateway, and DNS to a host (DORA exchange).
- **Loopback / link-local / APIPA** — `127.0.0.1` (self), `169.254.0.0/16` (self-assigned when DHCP fails).
- **IPv6** — 128-bit addressing in hex groups; huge space, no NAT needed, SLAAC autoconfiguration.
- **Unicast / broadcast / multicast / anycast** — one-to-one / one-to-all / one-to-group / one-to-nearest.

**Why interviewers ask this**

Subnetting is the closest thing networking has to a **coding test** — it's arithmetic you either can or can't do live. A senior backend/SRE engineer designs VPC CIDR blocks, avoids overlapping subnets between environments, sizes subnets for autoscaling groups, and debugs "the pod can't reach the database" issues that are usually a route/mask problem. Interviewers ask "how many usable hosts in a /26?" to see if you panic or answer "62" instantly. They ask about the same-subnet test to see if you understand *why* a gateway exists, not just that it does. And NAT/private-vs-public comes up because every cloud network is private space behind NAT gateways — mislabelling `10.0.0.0/8` as public, or thinking `127.0.0.1` is reachable from another host, are disqualifying basics.

**Common confusions**

- "A `/24` gives 256 usable hosts" — it gives 256 *addresses* but **254 usable**; the network and broadcast addresses are reserved.
- "Private IPs are just a naming convention" — no; RFC1918 addresses are genuinely *not routable* on the public internet, which is exactly why NAT is required.
- "NAT is a security feature" — it's an address-conservation feature that happens to hide internal hosts; a stateful firewall provides the security, not NAT itself.
- "`127.0.0.1` and `192.168.x.x` are the same kind of address" — loopback never leaves the host; private ranges route within a LAN/VPC.
- "The subnet mask is optional" — without it a host can't tell local from remote destinations; it's essential to the routing decision.
- "IPv6 is just IPv4 with more digits" — different header, no broadcast (uses multicast), stateless autoconfiguration, and no NAT by design.
- "Higher `/` = bigger network" — the opposite; a larger prefix (`/26`) means *more* network bits and *fewer* hosts than a `/24`.

**What follows from this topic**

The default-gateway decision leads straight into **The Link Layer & LAN** — once a host knows the *next hop's IP*, it uses ARP to find that hop's MAC and frame the packet. Public-vs-private and NAT set up the **load balancing, proxy, and CDN** topics (public front-ends, private backends). DHCP and address autoconfiguration touch **DNS** (DHCP hands out resolver addresses). And the fact that IP delivery is unreliable and connectionless is exactly the gap that **TCP** fills at layer 4. Subnetting is the arithmetic spine that every network-design question hangs on.

### Q1. What is an IP address and what does it actually identify?

An **IP address is a layer-3 logical address** that identifies a *host's network interface* so packets can be routed to it across interconnected networks. "Logical" is the key word — unlike a MAC address (burned into hardware, meaningful only on the local link), an IP address is assigned by configuration and is **routable end-to-end**: it stays the same as a packet crosses dozens of routers between source and destination.

An **IPv4** address is **32 bits**, written as four dotted-decimal octets, each 0–255:

```text
192 . 168 . 1 . 10
└─8bits┘ ...          = 11000000.10101000.00000001.00001010
```

Crucially, an IP address has two parts — a **network portion** and a **host portion** — and the boundary between them is set by the *subnet mask / prefix length*, not by the address itself. That split is what makes routing scalable: routers make decisions on the network portion (millions of hosts collapse into one route), and only the final subnet cares about the host portion. An interface can also have multiple IPs, and one IP can move between interfaces — reinforcing that it's a *logical*, not physical, identifier.

### Q2. Explain CIDR notation.

**CIDR (Classless Inter-Domain Routing)** notation writes an address plus a **prefix length**: `192.168.1.0/24`. The number after the slash is *how many leading bits are the network portion*. Everything after those bits is the host portion.

```text
192.168.1.0/24
             └── first 24 bits = network, last 8 bits = host
```

CIDR replaced the old **classful** system (Class A = /8, B = /16, C = /24) which was hopelessly wasteful — an organisation needing 300 addresses had to take a whole Class B (65,536). CIDR lets you use *any* prefix length, so you allocate exactly what you need: a `/23` for ~500 hosts, a `/30` for a point-to-point link (4 addresses, 2 usable).

The two facts that fall out of the prefix immediately:
- **Host bits** = `32 − prefix`
- **Total addresses** = `2^(32 − prefix)`

So `/24` → 8 host bits → 256 addresses; `/26` → 6 host bits → 64; `/30` → 2 host bits → 4. Being fluent in this instant translation is the whole subnetting skill.

### Q3. How do you compute the number of usable hosts in a subnet?

Formula: **usable hosts = 2^(32 − prefix) − 2**.

The `2^(32 − prefix)` is the total address count. You subtract **2** because two addresses in every subnet are reserved:
- the **network address** (all host bits 0) — names the subnet itself
- the **broadcast address** (all host bits 1) — reaches every host on the subnet

Quick reference:

| Prefix | Host bits | Total addresses | Usable hosts |
|--------|-----------|-----------------|--------------|
| /24 | 8 | 256 | 254 |
| /25 | 7 | 128 | 126 |
| /26 | 6 | 64 | 62 |
| /27 | 5 | 32 | 30 |
| /28 | 4 | 16 | 14 |
| /30 | 2 | 4 | 2 |

The `/30` (2 usable) is the classic point-to-point link between two routers. The exception to the −2 rule: a `/31` (RFC 3021) is used for point-to-point links where both addresses are usable (no broadcast needed), and a `/32` is a single host route. If an interviewer asks "usable hosts in a /26?" the answer is **62**, instantly.

### Q4. Walk me through subnetting a /24 into four subnets.

Take `192.168.1.0/24` (256 addresses) and split into **four equal subnets**. Four subnets need 2 more network bits (`2^2 = 4`), so the new prefix is `/24 + 2 = /26`. Each `/26` has 64 addresses, 62 usable.

The subnets increment by 64 in the last octet:

| Subnet | Network | Usable range | Broadcast |
|--------|---------|--------------|-----------|
| 1 | 192.168.1.0/26 | .1 – .62 | 192.168.1.63 |
| 2 | 192.168.1.64/26 | .65 – .126 | 192.168.1.127 |
| 3 | 192.168.1.128/26 | .129 – .190 | 192.168.1.191 |
| 4 | 192.168.1.192/26 | .193 – .254 | 192.168.1.255 |

The mechanics: the **network address** has all host bits 0 (the multiples of 64: 0, 64, 128, 192). The **broadcast** has all host bits 1 (one below the next network: 63, 127, 191, 255). Usable hosts are everything strictly between. The "block size" trick: `256 − 192` (the mask's last octet for /26) = 64, so subnets step by 64. That block-size shortcut is how people subnet in their heads without writing out binary.

### Q5. What's the relationship between a subnet mask and a prefix length?

They're two notations for the **same split** between network and host bits. The subnet mask is a 32-bit value with 1s for the network portion and 0s for the host portion:

```text
/24  = 11111111.11111111.11111111.00000000 = 255.255.255.0
/26  = 11111111.11111111.11111111.11000000 = 255.255.255.192
/16  = 11111111.11111111.00000000.00000000 = 255.255.0.0
```

Common ones worth memorising:

| Prefix | Mask |
|--------|------|
| /8 | 255.0.0.0 |
| /16 | 255.255.0.0 |
| /24 | 255.255.255.0 |
| /25 | 255.255.255.128 |
| /26 | 255.255.255.192 |
| /27 | 255.255.255.224 |
| /28 | 255.255.255.240 |
| /30 | 255.255.255.252 |

The host uses the mask operationally: it **bitwise-ANDs** its own IP with the mask to get its own network address, and ANDs the destination IP with the mask to get the destination's network. Equal → same subnet. That's the whole point of the mask — CIDR is the compact human notation, the mask is what the kernel actually computes with.

### Q6. What are the RFC1918 private address ranges, and why do they exist?

Three ranges reserved for **private, non-internet-routable** use:

| Range | CIDR | Size | Typical use |
|-------|------|------|-------------|
| 10.0.0.0 – 10.255.255.255 | `10.0.0.0/8` | ~16.7M | Large enterprises, cloud VPCs |
| 172.16.0.0 – 172.31.255.255 | `172.16.0.0/12` | ~1M | Mid-size networks |
| 192.168.0.0 – 192.168.255.255 | `192.168.0.0/16` | ~65K | Home/small office |

They exist because of **IPv4 exhaustion**. There are only ~4.3 billion IPv4 addresses — nowhere near enough for every device on earth. Private ranges let millions of organisations *reuse the same addresses internally* (your `192.168.1.10` and mine don't collide because neither is globally routed). Internet routers are configured to **drop** any packet with an RFC1918 source or destination, so these addresses only work inside a LAN or VPC. To reach the public internet, private hosts go through **NAT**, which swaps their private source IP for a shared public one. Every cloud network you'll ever build (AWS VPC, GCP network) is RFC1918 space behind NAT gateways and load balancers.

### Q7. Explain NAT and why we need it.

**NAT (Network Address Translation)** rewrites the source (and/or destination) IP address in a packet's header as it crosses a router. The common form — **PAT / NAT overload / "masquerading"** — maps *many* private hosts onto *one* public IP by also rewriting the source **port** and tracking the mapping in a translation table:

```text
Inside (private)                 NAT router            Outside (public)
10.0.0.5:51000  ──────────────►  rewrites src to ──►  203.0.113.9:40001 ─► server
10.0.0.6:51000  ──────────────►  rewrites src to ──►  203.0.113.9:40002 ─► server
```

When the reply comes back to `203.0.113.9:40001`, the router looks up its table and forwards it to `10.0.0.5:51000`. The port is what disambiguates thousands of internal hosts sharing one public IP.

**Why it exists: IPv4 exhaustion.** NAT lets an entire office (or cloud VPC) share a handful of public IPs. A side effect is that internal hosts aren't directly reachable from outside — often mistaken for a security feature, but the real security is a **stateful firewall**; NAT just happens to drop unsolicited inbound because there's no table entry for it. NAT's downside is it breaks the end-to-end principle: protocols that embed IPs in their payload (FTP, SIP, some P2P) need special handling, and inbound connections require explicit port forwarding. IPv6's giant address space is meant to make NAT unnecessary.

### Q8. What are the loopback, link-local, and APIPA addresses?

Special-purpose ranges that never behave like normal routable addresses:

- **Loopback — `127.0.0.0/8`, usually `127.0.0.1`** ("localhost"). Traffic to it *never leaves the host* — it's looped back in the kernel. Used to talk to services on your own machine (`curl localhost:8080`). A common gotcha: a service bound to `127.0.0.1` is unreachable from *other* hosts; you must bind `0.0.0.0` (all interfaces) to accept external connections.
- **Link-local — `169.254.0.0/16`** (called **APIPA** on Windows). A host **self-assigns** an address from this range when it can't reach a DHCP server. It only works on the local link (never routed). Seeing a `169.254.x.x` address in the wild is a diagnostic: *DHCP failed* — the host couldn't get a real lease. In cloud (AWS/GCP), `169.254.169.254` is the well-known **metadata service** endpoint.

These come up in debugging: "the VM has a 169.254 address" instantly tells an SRE the DHCP path is broken, and "the app works locally but not from another box" is very often a `127.0.0.1`-vs-`0.0.0.0` bind mistake.

### Q9. How does a host decide whether to send a packet directly or via the default gateway?

It runs the **same-subnet test** using its subnet mask. For a destination IP:

1. Bitwise-AND **my IP** with **my mask** → my network address.
2. Bitwise-AND the **destination IP** with **my mask** → destination's network address.
3. **Equal?** The destination is on my subnet → send the frame *directly* to the destination (ARP for its MAC, frame it, done).
4. **Different?** The destination is remote → send the frame to the **default gateway's MAC** (ARP for the *gateway*, not the destination) and let the router forward it onward.

Worked example — my host is `192.168.1.10/24`, gateway `192.168.1.1`:

```text
Dest 192.168.1.50:  1.50 & /24 = 192.168.1.0 == my 192.168.1.0  → LOCAL, send direct
Dest 10.0.0.5:      10.0.0.5 & /24 = 10.0.0.0 != 192.168.1.0     → REMOTE, send to gateway
```

Note the packet's **destination IP is always the final destination** (`10.0.0.5`), but the **frame's destination MAC** is the gateway's — because MAC addressing is only ever next-hop. This is the exact seam between layer 3 (IP, end-to-end) and layer 2 (MAC/ARP, local), and it's why a wrong subnet mask or missing default route breaks connectivity in the classic ways.

### Q10. What is a default gateway and what happens without one?

The **default gateway** is the router a host sends packets to when the destination is **not on its local subnet** — it's the "route of last resort," matching `0.0.0.0/0` (everything). Without a more specific route, all off-subnet traffic goes here.

```bash
ip route
# default via 192.168.1.1 dev eth0     <- the default gateway
# 192.168.1.0/24 dev eth0              <- the directly-connected subnet
```

**Without a default gateway**, a host can still reach anything on its *own* subnet (that's a directly-connected route), but *any* destination outside the subnet fails — the host has nowhere to send the packet and returns "network unreachable." This is a classic misconfiguration symptom: **"I can ping other machines on my LAN but nothing on the internet"** almost always means a missing or wrong default gateway (or the gateway itself is down / not forwarding). The gateway must also be *on the same subnet* as the host — you can't point at a gateway you can't reach directly, which is a chicken-and-egg mistake people make when hand-configuring IPs.

### Q11. What is IPv6 and how does it differ from IPv4?

**IPv6** is the successor addressing scheme with **128-bit** addresses — `2^128` of them, effectively inexhaustible — written as eight groups of four hex digits:

```text
2001:0db8:0000:0000:0000:ff00:0042:8329
```

Abbreviation rules compress it: drop leading zeros in each group, and replace *one* run of all-zero groups with `::`:

```text
2001:db8::ff00:42:8329        (the same address, abbreviated)
::1                            (IPv6 loopback, = 127.0.0.1)
```

Key differences from IPv4:

| | IPv4 | IPv6 |
|---|------|------|
| Size | 32-bit | 128-bit |
| Notation | Dotted decimal | Hex groups, `::` |
| NAT | Ubiquitous | Not needed (enough addresses) |
| Broadcast | Yes | **No** — uses multicast instead |
| Autoconfig | DHCP | **SLAAC** (stateless) or DHCPv6 |
| Header | Variable, checksummed | Fixed 40 bytes, simpler |

**SLAAC (Stateless Address Autoconfiguration)** lets a host generate its own address from the router-advertised prefix + its interface ID — no DHCP server required. IPv6 restores the end-to-end principle: every device can have a globally unique address, so NAT becomes unnecessary. Most modern deployments run **dual-stack** (both IPv4 and IPv6 simultaneously) during the long transition.

### Q12. Why has IPv6 adoption been so slow despite IPv4 exhaustion?

Because **NAT worked well enough to relieve the pressure**, and migration has real costs with diffuse benefits:

- **NAT was the release valve.** Once you can hide a whole company behind one public IPv4 via NAT, the urgency to renumber everything evaporates. IPv6 solves a problem NAT already papered over.
- **No backward compatibility.** An IPv6-only host can't talk to an IPv4-only host directly — they're different protocols. So you run **dual-stack**, meaning you operate *both* networks at once: double the addressing plans, firewall rules, and monitoring, for no new features.
- **The chicken-and-egg problem.** Content providers won't go IPv6-only while clients are IPv4; ISPs won't push IPv6 while content is on IPv4. Everyone waits.
- **Tooling and habit.** Decades of scripts, ACLs, and muscle memory assume dotted-decimal IPv4. Ops teams are slower to trust IPv6 firewalling and troubleshooting.

Adoption *is* climbing (mobile carriers and large clouds lead), but it's a decades-long tail. The pragmatic reality for a backend engineer: design for dual-stack, don't assume IPv6 end-to-end, and know that your public-facing load balancer may speak IPv6 to clients while your VPC stays IPv4 internally.

### Q13. Compare unicast, broadcast, multicast, and anycast.

Four delivery models — *how many recipients, and which ones*:

| Type | Recipients | Example |
|------|-----------|---------|
| **Unicast** | Exactly one specific host | Normal TCP/HTTP — the 99% case |
| **Broadcast** | *All* hosts on the subnet | ARP requests, DHCP discover (IPv4 only) |
| **Multicast** | A *group* of subscribed hosts | Video streaming, routing protocols (OSPF), IPv6 neighbour discovery |
| **Anycast** | The *nearest* of several identical hosts | DNS root servers, CDNs, `8.8.8.8` |

**Unicast** is one-to-one and what you use for essentially all application traffic. **Broadcast** floods every host on the segment (the broadcast address, all host bits 1) — cheap for local discovery but doesn't cross routers, and IPv6 abolishes it in favour of multicast. **Multicast** sends one stream that the network duplicates only to subscribers — efficient for one-to-many like live video. **Anycast** is the clever one: the *same* IP address is advertised from many locations worldwide, and BGP routing delivers each client to the topologically nearest instance. That's how a CDN or a public DNS resolver like `8.8.8.8` gives everyone a low-latency, local response from one advertised address — foundational to the CDN topic later.

### Q14. How does a host get an IP address via DHCP?

**DHCP (Dynamic Host Configuration Protocol)** automatically leases a host its IP, subnet mask, default gateway, and DNS servers. The exchange is the four-step **DORA** handshake:

```text
1. DISCOVER  — client broadcasts "any DHCP servers out there?" (it has no IP yet)
2. OFFER     — server(s) reply "you can have 192.168.1.50, /24, gw .1, DNS ..."
3. REQUEST   — client broadcasts "I'll take that offer" (locks in one server)
4. ACK       — server confirms the lease and its duration
```

Because the client starts with *no* address, DISCOVER and REQUEST are **broadcast** (destination `255.255.255.255`) — this is one of the main reasons broadcast exists. The server hands out a **lease** with a finite lifetime; the client renews it (typically at 50% of the lease) to keep the address. If no DHCP server answers, the host falls back to a **link-local `169.254.x.x`** (APIPA) address — which is the tell that DHCP failed. DHCP is why you plug into any network and "it just works": no manual IP/mask/gateway/DNS entry. In cloud environments the equivalent is the platform assigning ENI/interface addresses automatically from the subnet's range.

### Q15. What is supernetting / route aggregation?

**Supernetting** is the opposite of subnetting: *combining* several smaller contiguous networks into one larger CIDR block with a **shorter** prefix, so it can be advertised as a single route.

Example — four adjacent /24s:

```text
192.168.0.0/24
192.168.1.0/24     ┐
192.168.2.0/24     ├── aggregate to ──►  192.168.0.0/22   (covers .0–.3)
192.168.3.0/24     ┘
```

Four `/24`s that share the first 22 bits collapse into one `/22`. The payoff is **routing table scalability**: instead of a backbone router carrying four routes, it carries one. Across the whole internet, CIDR aggregation is what keeps the global routing table from exploding — an ISP advertises one big block covering all its customers rather than thousands of individual prefixes. This is also why cloud providers hand you a contiguous VPC CIDR (`10.0.0.0/16`) and let you subnet *within* it: your route tables and peering stay compact because everything aggregates under one prefix. The rule for aggregation: the blocks must be contiguous and align on the supernet boundary.

### Q16. What is VLSM, and why does it matter?

**VLSM (Variable Length Subnet Masking)** means using **different prefix lengths for different subnets** within the same parent network, so each subnet is sized to its actual need instead of everything being uniform. CIDR makes this possible.

Say you own `10.0.0.0/24` and need: a web tier (100 hosts), an app tier (50 hosts), and three point-to-point links (2 hosts each). Uniform subnetting would force one size and waste addresses. VLSM sizes each:

| Subnet | Need | Prefix | Block | Range |
|--------|------|--------|-------|-------|
| Web | 100 | /25 (126 usable) | 10.0.0.0/25 | .0 – .127 |
| App | 50 | /26 (62 usable) | 10.0.0.128/26 | .128 – .191 |
| P2P #1 | 2 | /30 (2 usable) | 10.0.0.192/30 | .192 – .195 |
| P2P #2 | 2 | /30 | 10.0.0.196/30 | .196 – .199 |
| P2P #3 | 2 | /30 | 10.0.0.200/30 | .200 – .203 |

Allocate **largest-first** to avoid fragmentation. The point-to-point links get a `/30` (just 2 usable, exactly right for two routers) instead of wasting a whole `/24`. VLSM is everyday cloud-network design: you carve a VPC `/16` into public/private/database subnets of different sizes across availability zones, each sized to its workload. Doing it wrong — overlapping ranges or under-sizing a subnet an autoscaling group later outgrows — is a real production pain, which is why interviewers test it.

### Q17. What does the address 0.0.0.0 mean?

`0.0.0.0` is context-dependent — it means different things in different places, and knowing the distinctions is a nice senior signal:

- **As a route (`0.0.0.0/0`)** — the **default route**, "all destinations," matched only when nothing more specific applies. This is how the default gateway is expressed in a routing table.
- **As a bind/listen address** — "**all local interfaces**." A server bound to `0.0.0.0:8080` accepts connections on *every* interface (LAN, loopback, everything), unlike `127.0.0.1:8080` which only accepts local. This is the fix for "works locally but not from another host."
- **As a source address** — "**this host, unknown address**," used by a client in a DHCP DISCOVER before it has an IP (source `0.0.0.0`, destination `255.255.255.255`).

So the same four zeros mean "everywhere" (as a route), "all interfaces" (as a listen address), or "I don't have an address yet" (as a source). The bind-address meaning is the one that bites backend engineers most: forgetting to bind `0.0.0.0` in a container is a top cause of "the health check can't reach my service."

## The Link Layer & LAN

### Summary

**What this topic covers**

Layer 2 — how frames actually move between devices on the same local network, the layer *below* IP routing. The 15 questions cover **MAC addresses** (48-bit hardware addresses, format, local scope, why they're not routable), **Ethernet** (frame format, the CSMA/CD history, switched full-duplex today), **ARP** (resolving an IP to a MAC on the local link — the who-has/is-at exchange and the ARP cache), **switches** (L2 devices that learn MAC→port mappings and forward by destination MAC, the MAC/CAM table, flooding of unknown unicast), how switches differ from **hubs** (L1) and **routers** (L3), **VLANs** (logically segmenting one physical switch, 802.1Q tagging, access vs trunk ports), **MTU** and fragmentation (the 1500-byte Ethernet default, jumbo frames, the "small requests work, large ones hang" path-MTU symptom), **broadcast vs collision domains**, **spanning tree** (loop prevention), and security-relevant behaviours like **gratuitous ARP** and **ARP spoofing**. This is the plumbing beneath everything IP does — when the link layer is broken, no amount of correct IP config helps.

**Mental model**

Layer 2 is **"how do I hand this frame to the next device on this physical segment?"** — purely local, one hop. IP (L3) decides the *end-to-end path* and the *next-hop IP*; L2 does the actual handoff to that next hop using **MAC addresses**, which are only meaningful within a single broadcast domain and are *rewritten at every router hop*. The engine that makes a LAN work is the pair **ARP + switch learning**: ARP answers "what MAC owns this IP?" by broadcasting a question the whole segment hears, and a switch quietly learns "MAC X lives on port 3" by watching the *source* address of every frame, building a table so it can forward future frames only out the correct port instead of flooding. Hold two scopes in your head: a **collision domain** (shared medium where frames can collide — basically obsolete now that every switch port is its own full-duplex domain) and a **broadcast domain** (how far a broadcast like ARP reaches — one VLAN, bounded by routers). VLANs let you slice one physical switch into several independent broadcast domains, and routers are the *only* thing that separates broadcast domains. Almost every weird LAN bug — duplicate IPs, a host unreachable, "large downloads stall" — traces to ARP, MTU, or a VLAN/trunk misconfiguration.

**Key terms**

- **MAC address** — a 48-bit hardware address (`00:1a:2b:3c:4d:5e`) identifying a NIC on the local link; not routable.
- **OUI** — the first 24 bits of a MAC, a manufacturer identifier assigned by the IEEE.
- **Ethernet frame** — the L2 PDU: dest MAC, src MAC, EtherType, payload, FCS (checksum).
- **ARP** — Address Resolution Protocol; maps an IPv4 address to a MAC on the local network.
- **ARP cache** — a host's table of recently learned IP→MAC mappings (`ip neigh` / `arp -n`).
- **Switch** — an L2 device that learns MAC→port and forwards frames by destination MAC.
- **MAC / CAM table** — the switch's learned map of which MAC is reachable on which port.
- **Unknown-unicast flooding** — a switch floods a frame out all ports when the dest MAC isn't in its table yet.
- **Broadcast domain** — the set of devices a broadcast frame reaches; one VLAN, bounded by routers.
- **Collision domain** — a segment where frames can collide; one per switch port in modern full-duplex Ethernet.
- **VLAN / 802.1Q** — a logical L2 segment on shared physical switches; a 4-byte tag marks a frame's VLAN.
- **Trunk vs access port** — trunk carries many tagged VLANs (switch-to-switch); access carries one untagged VLAN (to a host).
- **MTU** — Maximum Transmission Unit, the largest frame payload; 1500 bytes for standard Ethernet.

**Why interviewers ask this**

L2 is where the "it works in theory but the packets aren't moving" incidents live, so it separates engineers who've *operated* networks from those who've only read about IP. A senior backend/SRE engineer is expected to diagnose duplicate-IP flapping (two hosts answering the same ARP), "the VM lost connectivity after a MAC change," and the notorious **MTU black hole** — small requests succeed, large payloads or file transfers hang — which is invisible unless you understand fragmentation and path-MTU discovery. VLAN and trunk questions probe whether you understand network *segmentation* for security and blast-radius control, a real design concern in data centres and clouds. And ARP is the gateway to a whole class of security topics (ARP spoofing / MITM). Interviewers can tell within two questions whether "MAC vs IP" is crisp in your head or mush — and if it's mush, every routing and firewall answer downstream gets shakier.

**Common confusions**

- "MAC addresses are routable / global" — they're **local-only**; routers strip and rewrite the MAC at every hop while the IP stays constant.
- "A switch and a router do the same thing" — a switch forwards by MAC within one L2 segment (no routing); a router forwards by IP *between* segments and separates broadcast domains.
- "ARP is a layer-3 protocol because it deals with IPs" — ARP *operates at L2* (it's how L3 gets its next-hop MAC); it lives on the L2/L3 boundary.
- "VLANs provide encryption/strong isolation" — they provide *logical segmentation* and separate broadcast domains, not cryptographic security; traffic between VLANs still needs a router and firewall.
- "Bigger MTU is always better" — jumbo frames help throughput *only if every device on the path agrees*; a mismatch causes silent drops.
- "Hubs and switches are interchangeable" — a hub (L1) is one shared collision domain that floods everything; a switch (L2) is per-port and forwards intelligently.
- "The ARP cache is permanent" — entries expire; stale entries cause transient "host unreachable" after an IP moves NICs.

**What follows from this topic**

L2 is the floor the whole stack stands on. The **same-subnet-vs-gateway** decision from the IP topic *ends* here: once L3 picks a next-hop IP, ARP finds its MAC and the switch delivers the frame. **MTU** ripples up into **TCP** (MSS is derived from MTU, and path-MTU issues manifest as stalled connections and retransmits). **Broadcast domains and VLANs** underpin how cloud VPCs and data-centre fabrics isolate tenants. And **ARP spoofing** previews the **security/TLS** discussion — it's exactly the local-network MITM that TLS is designed to make useless even when the attacker sits in the path. Get L2 solid and the "why can't these two boxes talk" incidents become tractable.

### Q1. What is the job of the data-link layer?

The data-link layer (L2) is responsible for **node-to-node delivery of frames across a single physical link or local network segment.** Where IP (L3) figures out the end-to-end path across the whole internet, L2 handles just *one hop*: getting a frame from this device to the next device on the same wire, switch, or Wi-Fi cell.

Its concrete responsibilities:

- **Framing** — wrapping the L3 packet in a frame with local addressing (source/dest MAC) and a checksum.
- **Local addressing** — using MAC addresses to identify NICs on the segment.
- **Error detection** — the frame's FCS (checksum) lets the receiver discard corrupted frames.
- **Media access** — historically, arbitrating who transmits when on a shared medium (CSMA/CD for Ethernet, CSMA/CA for Wi-Fi).

The key mental separation: **L3 addresses are end-to-end and constant; L2 addresses are next-hop and rewritten at every router.** When you send a packet to a server across the internet, the destination IP is the server the whole way, but the destination MAC changes at every hop — first your gateway's MAC, then the next router's, and so on. L2 is the layer that makes each of those individual hops actually happen.

### Q2. What is a MAC address and how is it structured?

A **MAC (Media Access Control) address** is a **48-bit hardware address** that uniquely identifies a network interface on the local link. It's written as six hex octets:

```text
00:1a:2b:3c:4d:5e
└────┬────┘ └────┬────┘
   OUI          NIC-specific
(24 bits,      (24 bits,
 manufacturer)  device)
```

The first 24 bits are the **OUI (Organizationally Unique Identifier)** — an IEEE-assigned manufacturer prefix (so you can often tell a NIC's vendor from its MAC). The last 24 bits are assigned by that manufacturer to the individual device. In principle every NIC ships with a globally unique **burned-in address (BIA)**, but it can be overridden with a **locally administered address** (software-set MAC — used for privacy randomisation on Wi-Fi, virtualisation, and, less benignly, spoofing).

The defining property: **MAC addresses are layer-2, local-scope, and not routable.** A router will never forward a packet based on a MAC, and a MAC has no meaning outside its broadcast domain — it's rewritten at every hop. Contrast with an IP address, which is logical, configurable, and routable end-to-end. "MAC = physical/local, IP = logical/global" is the distinction to keep crisp.

### Q3. Explain how Ethernet works at a high level.

**Ethernet** is the dominant L2 technology for wired LANs. Data travels in **frames**:

```text
[ Dest MAC | Src MAC | EtherType | Payload (46–1500 bytes) | FCS ]
   6 bytes    6 bytes   2 bytes      the L3 packet            4 bytes
```

- **Dest/Src MAC** — who it's for and who sent it (local addresses).
- **EtherType** — what's inside (`0x0800` = IPv4, `0x86DD` = IPv6, `0x0806` = ARP).
- **Payload** — the IP packet; capped at the MTU (1500 bytes standard).
- **FCS** — a checksum so the receiver can drop corrupted frames.

Historically Ethernet was a **shared medium**: many hosts on one coax cable, so it used **CSMA/CD (Carrier Sense Multiple Access with Collision Detection)** — listen before sending, and if two hosts transmit at once, detect the collision, back off a random time, retry. That's why old Ethernet was a single **collision domain**.

Modern Ethernet is **switched and full-duplex**: every device has a dedicated port on a switch, each port is its own collision domain, and a host can send and receive simultaneously. Collisions essentially don't happen anymore, so CSMA/CD is legacy trivia — but interviewers still ask because understanding *why* switches replaced hubs (eliminating the shared collision domain) shows you grasp the evolution.

### Q4. What is ARP and why is it needed?

**ARP (Address Resolution Protocol)** maps a known **IP address to its MAC address** on the local network. It exists because of a fundamental mismatch: you *address hosts by IP* (L3), but you *deliver frames by MAC* (L2). Before a host can put a packet in a frame, it must learn the destination's MAC — that's ARP's job.

The exchange is a broadcast question and a unicast answer:

```text
Host A wants to reach 192.168.1.50 but doesn't know its MAC.

A → broadcast:  "Who has 192.168.1.50? Tell 192.168.1.10"   (ARP request, dest MAC = ff:ff:ff:ff:ff:ff)
B → A (unicast): "192.168.1.50 is at 00:1a:2b:3c:4d:5e"       (ARP reply)
```

A caches the result in its **ARP cache** so it doesn't re-ask for every frame:

```bash
ip neigh          # Linux: show the ARP/neighbour cache
arp -n            # older syntax
# 192.168.1.50 dev eth0 lladdr 00:1a:2b:3c:4d:5e REACHABLE
```

Crucial detail tied to the IP topic: if the destination is on a *different* subnet, the host doesn't ARP for the destination at all — it ARPs for the **default gateway** and sends the frame there. ARP only ever resolves the *next hop* on the local segment. Cache entries expire, which is why a host can be briefly unreachable right after its IP moves to a new NIC — until the stale mapping ages out. (IPv6 replaces ARP with NDP, Neighbor Discovery, but the concept is the same.)

### Q5. How does a switch learn where to send frames?

A switch builds its **MAC (CAM) table** by **learning from the source address of every frame it sees**, and forwards based on the **destination** address. The algorithm:

1. **Learn** — when a frame arrives on port 3 with source MAC `AA`, the switch records "MAC AA → port 3."
2. **Forward** — for the frame's *destination* MAC, look it up:
   - **Known** (in the table) → send *only* out that one port. This is the whole point — traffic stays isolated.
   - **Unknown** → **flood** it out every port except the one it arrived on (unknown-unicast flooding), so it reaches the destination wherever it is. When the destination replies, the switch learns *its* port too, and future frames are forwarded, not flooded.
3. **Age out** — entries expire after a timeout (typically ~5 min) so the table adapts when devices move.

```text
MAC Table (learned)
  AA:.. → port 1
  BB:.. → port 3
  Frame dest CC:.. (unknown) → flood all ports; learn CC when it replies
```

This is why a switch is far better than a hub: a hub (L1) blindly repeats every frame out every port (one big collision domain, no privacy); a switch (L2) learns and forwards selectively, giving each port its own collision domain and keeping unicast traffic point-to-point. Broadcast and unknown-unicast frames still flood, which is exactly why you segment large networks with VLANs and routers.

### Q6. What's the difference between a hub, a switch, and a router?

Three devices at three layers, each smarter than the last:

| | Hub | Switch | Router |
|---|-----|--------|--------|
| Layer | 1 (Physical) | 2 (Data Link) | 3 (Network) |
| Forwards by | Nothing — repeats bits | Destination MAC | Destination IP |
| Intelligence | None; floods all ports | Learns MAC→port | Full routing table |
| Collision domains | One (shared) | One per port | One per port |
| Broadcast domains | One | One (per VLAN) | **Separates** them |
| Connects | Devices on one segment | Devices on one LAN | Different networks |

A **hub** is a dumb repeater — every bit in one port goes out all others, so everyone shares one collision domain and sees everyone's traffic (obsolete). A **switch** learns which MAC is on which port and forwards frames only where they need to go, within a single LAN/broadcast domain — it does *not* route between networks. A **router** operates on IP addresses, connects *different* networks/subnets, and is the *only* device here that **separates broadcast domains** — a broadcast (ARP, DHCP) floods a whole L2 segment but stops at a router.

The one-liner: hub = repeat, switch = switch by MAC (local), router = route by IP (between networks). Modern "L3 switches" blur the line by doing both, but the conceptual boundary — MAC/local vs IP/between-networks — is what interviewers want.

### Q7. What is a VLAN and why would you use one?

A **VLAN (Virtual LAN)** logically segments a single physical switch (or a set of switches) into **multiple independent broadcast domains**. Ports assigned to VLAN 10 behave as one L2 network; ports in VLAN 20 are a completely separate L2 network — even though they share the same physical hardware. Traffic between VLANs *must* go through a router (or L3 switch), just like separate physical networks.

Why you'd use them:

- **Segmentation / security** — isolate finance from engineering, or production from dev, without buying separate switches. A compromised host in one VLAN can't directly reach another VLAN's hosts (inter-VLAN traffic passes a router where you enforce firewall rules).
- **Broadcast control** — a broadcast (ARP storm, DHCP) stays within its VLAN instead of flooding the entire physical network. Smaller broadcast domains = better performance and blast-radius containment.
- **Flexibility** — group users logically (by function) rather than physically (by which switch they're plugged into).

VLANs are tagged with **802.1Q**: a 4-byte tag inserted into the Ethernet frame carrying a 12-bit VLAN ID (so up to 4094 VLANs). This is the data-centre and cloud building block for multi-tenant isolation — though the security caveat matters: VLANs provide *logical* separation, not encryption, and misconfigured trunks can allow VLAN hopping.

### Q8. What's the difference between an access port and a trunk port?

Two roles a switch port can play, distinguished by how they handle VLAN tags:

- **Access port** — belongs to **exactly one VLAN** and carries **untagged** frames. This is what you plug an end device (laptop, server, printer) into — the device is oblivious to VLANs; the switch tags/untags on its behalf. Frames in, frames out, all belonging to that one VLAN.
- **Trunk port** — carries **multiple VLANs**, with frames **802.1Q-tagged** so the receiving switch knows which VLAN each frame belongs to. This is what connects **switch-to-switch** (or switch-to-router/hypervisor), letting many VLANs traverse a single physical link.

```text
[Host A]──access(VLAN10)──┐
                          [Switch 1]══trunk(VLAN10,20 tagged)══[Switch 2]
[Host B]──access(VLAN20)──┘
```

The mental model: an **access port is the edge** (one VLAN, untagged, facing a host); a **trunk is the backbone** (many VLANs, tagged, between infrastructure). A classic misconfiguration is a link that should be a trunk configured as access (only one VLAN passes, the rest silently vanish) — or a native-VLAN mismatch on a trunk causing traffic to leak between VLANs. The **native VLAN** on a trunk is the one VLAN whose frames travel *untagged*, a detail that matters for both compatibility and VLAN-hopping security.

### Q9. What is MTU and what happens when a packet exceeds it?

**MTU (Maximum Transmission Unit)** is the largest payload a frame can carry — **1500 bytes** for standard Ethernet. A packet bigger than the MTU can't fit in one frame, so something has to give:

- **Fragmentation** — traditionally, IPv4 could split an oversized packet into MTU-sized fragments, reassembled at the destination. It's inefficient (more headers, and losing one fragment means retransmitting the whole packet) and IPv6 *forbids* routers from fragmenting.
- **The DF (Don't Fragment) bit** — if set (as TCP normally does), a router that can't forward the too-big packet **drops it** and sends back an ICMP "Fragmentation Needed" message so the sender lowers its packet size. This is **Path MTU Discovery (PMTUD)**.

The dangerous failure mode: if a firewall or middlebox **blocks that ICMP message**, the sender never learns to shrink its packets. Result — the notorious **MTU black hole**:

```text
small requests (fit in MTU)          → work fine
large responses / file uploads       → silently dropped, connection HANGS
```

Symptom to memorise: **"the SSH login works but transferring a file stalls," or "the API returns small JSON fine but times out on large payloads."** That signature almost always means an MTU mismatch with blocked PMTUD — common with VPNs and tunnels (which add overhead, lowering the effective MTU below 1500). **Jumbo frames** (MTU ~9000) boost throughput in data centres but *only* if every device on the path agrees; one 1500-MTU device in the middle reintroduces the black hole.

### Q10. What's the difference between a broadcast domain and a collision domain?

Two different "domains" that describe how far two different things spread:

- **Collision domain** — the set of devices whose frames can *collide* on a shared medium. Relevant in the old hub/shared-coax era. In modern **switched full-duplex** Ethernet, **every switch port is its own collision domain**, so collisions are essentially extinct. A hub = one big collision domain; a switch = one per port.
- **Broadcast domain** — the set of devices a **broadcast frame** (dest MAC `ff:ff:ff:ff:ff:ff`, e.g. ARP or DHCP) reaches. A switch *forwards* broadcasts out all ports, so a whole switch (or VLAN) is one broadcast domain. Only a **router** (or a VLAN boundary) stops a broadcast.

```text
Switch splits COLLISION domains (one per port).
Router (or VLAN) splits BROADCAST domains.
```

The practical consequence: broadcasts don't scale. A huge flat L2 network means every ARP and DHCP broadcast hits every host, wasting CPU and bandwidth (and one misbehaving host can cause a **broadcast storm**). That's *why* you segment with VLANs and routers — to shrink broadcast domains. So the summary: switches solved the collision-domain problem; routers and VLANs solve the broadcast-domain problem. Confusing the two is a common interview stumble.

### Q11. Walk me through how a frame gets from host A to host B on the same LAN.

Concrete example: A (`192.168.1.10`) pings B (`192.168.1.50`), same `/24` subnet, connected via a switch.

1. **Same-subnet check (L3)** — A ANDs both IPs with its `/24` mask; both are `192.168.1.0`, so B is **local** — send directly, no gateway.
2. **ARP (L2 resolution)** — A doesn't know B's MAC. It **broadcasts** "Who has 192.168.1.50?" The switch floods the ARP request; B replies (unicast) "I'm at `00:...:50`." A caches it.
3. **Framing** — A builds an Ethernet frame: dest MAC = B's, src MAC = A's, EtherType = IPv4, payload = the ICMP-in-IP packet.
4. **Switch forwarding** — the frame arrives at the switch, which looks up B's MAC in its CAM table and sends it out *only* B's port (or floods once, if it hasn't learned B's port yet, then learns it).
5. **Delivery** — B's NIC sees a frame addressed to its own MAC, decapsulates up the stack (strips frame → checks IP → hands to ICMP), and replies. The reply retraces the path; both hosts and the switch now have each other cached.

Notice: **no router involved, and the MACs are the real hosts' MACs** (not a gateway's) because it's all local. If B were on a *different* subnet, step 1 flips to "remote," A would ARP for the **gateway** instead, and the frame's dest MAC would be the router's — the router then re-frames it toward B's network.

### Q12. What is spanning tree and what problem does it solve?

**STP (Spanning Tree Protocol, 802.1D)** prevents **layer-2 loops** in networks with redundant switch links. Redundant links are desirable for fault tolerance, but they create a deadly problem: unlike IP, an **Ethernet frame has no TTL**, so a broadcast frame caught in a physical loop circulates *forever*, multiplying at each switch — a **broadcast storm** that saturates the network and takes it down in seconds.

```text
   [Switch A]───────[Switch B]
        │               │
        └───[Switch C]──┘     <- a physical loop: a broadcast circles endlessly
```

STP solves this by having switches exchange **BPDUs** to discover the topology, elect a **root bridge**, and then **logically block** redundant ports so the active paths form a loop-free *tree*. If an active link fails, STP unblocks a standby port to restore connectivity — you keep the physical redundancy without the loop.

Classic STP convergence was slow (30–50 seconds), so **RSTP (Rapid STP, 802.1w)** is the modern default, converging in a few seconds. The takeaway for an SRE: if you ever see a network melt down right after someone patches in a redundant cable, suspect a loop and a spanning-tree failure. Cloud and modern data-centre fabrics increasingly avoid STP entirely (using L3 routing or protocols like TRILL/SPB), but STP is still everywhere in enterprise switching.

### Q13. What is gratuitous ARP and what is it used for?

A **gratuitous ARP** is an ARP message a host sends **unsolicited** — nobody asked "who has this IP," yet the host broadcasts "IP X is at my MAC" anyway. It's an announcement, not a question. Legitimate uses:

- **Detect duplicate IPs** — on boot or when configuring an interface, a host gratuitous-ARPs its own IP; if another host replies, there's an address conflict.
- **Update everyone's ARP caches after a change** — the most important use. When an IP **moves to a new MAC/NIC** — a **failover** to a standby server, a **VIP** shifting between load balancers, a **VM migrating** to a new host — the new owner sends a gratuitous ARP so every device and switch immediately updates its cache and starts sending frames to the new MAC. Without it, hosts would keep sending to the old (dead) MAC until their cache entries aged out — causing seconds-to-minutes of unreachability.

```text
Failover: standby takes over 192.168.1.100 →
  broadcasts gratuitous ARP "192.168.1.100 is at <standby MAC>"
  → switches relearn the port, clients update cache, traffic flows to standby
```

This is core to how HA / floating-IP setups (keepalived, VRRP, cloud VIP failover) achieve fast cutover. The flip side: because gratuitous ARP is *believed without verification*, it's also the mechanism attackers abuse — which leads straight to ARP spoofing.

### Q14. What is ARP spoofing and why is it dangerous?

**ARP spoofing (ARP poisoning)** is a local-network attack exploiting the fact that **ARP has no authentication** — a host believes any ARP reply it receives. The attacker sends forged ARP messages claiming *"the gateway's IP is at my MAC,"* poisoning victims' ARP caches so their traffic is sent to the **attacker** instead of the real gateway.

```text
Normal:   Victim ──frames──► Gateway MAC
Poisoned: Victim ──frames──► Attacker MAC ──(relays)──► Gateway
                   (attacker is now a man-in-the-middle)
```

Once in the path, the attacker can **eavesdrop** (read all traffic), **modify** it, or **drop** it (DoS). It's a classic **man-in-the-middle (MITM)** on a shared LAN — coffee-shop Wi-Fi, a compromised office network, a hostile data-centre neighbour.

Why it matters and what defends against it:

- **TLS is the real defence.** Even if an attacker MITMs the path, they can't decrypt properly-validated TLS traffic or forge a valid certificate — this is *exactly* the threat model TLS is built for, which is why "everything HTTPS" matters even on internal networks. (Attackers may try to strip TLS or present a bad cert; cert validation and HSTS are what stop that.)
- **Network-level mitigations** — **Dynamic ARP Inspection (DAI)** on switches (validates ARP against DHCP snooping bindings), static ARP entries for critical hosts, and port security.

This question is a nice bridge: it shows *why* the link layer's trusting design forces us to push security up to TLS at layer 7 — you can't trust L2, so you authenticate and encrypt end-to-end.

### Q15. Why can't a switch, on its own, connect two different subnets?

Because a switch operates **purely at layer 2 (MAC addresses)** and has **no concept of IP addresses or routing.** Connecting two different subnets is inherently a **layer-3** operation — it requires making a forwarding decision based on IP network addresses, which only a router (or L3 switch) does.

Walk through why it fails. Suppose host A (`192.168.1.10/24`) wants to reach host B (`10.0.0.5/24`), both plugged into the same dumb switch:

1. A runs the same-subnet test: `10.0.0.5` is **not** in A's `/24` → A decides the destination is **remote** and tries to send to its **default gateway**.
2. If there's no router/gateway, A has nowhere to send the packet — it returns "network unreachable." The switch never even gets a chance, because A won't ARP for a host it believes is off-subnet.

Even if you forced it, the switch only forwards frames by MAC within *one* broadcast domain; it won't rewrite IP headers, decrement TTL, or make routing decisions. Those are exactly the things a **router** does at the L2/L3 boundary: it terminates one subnet, strips the frame, examines the destination IP, consults its routing table, and re-frames the packet toward the next network.

The clean summary: **a switch moves frames *within* a network; a router moves packets *between* networks.** Different subnets are, by definition, different networks — so you need L3. (An "L3 switch" can do this because it's really a router and switch fused into one box.)
## Routing & the Network Layer

### Summary

**What this topic covers**

The network layer (OSI layer 3, the "Internet" layer in the TCP/IP model) and its one job: get a packet from a source host to a destination host **across** arbitrary interconnected networks, using logical addressing and routing. The link layer moves a frame between two nodes on the same wire; the network layer stitches thousands of those hops together into an end-to-end path. This topic has 16 questions covering how IP forwarding actually works (each router makes an independent next-hop decision, hop by hop), the routing table and longest-prefix match, the default gateway, static vs dynamic routing, the routing-protocol landscape (OSPF/IS-IS/RIP inside an org, **BGP** between organisations — the protocol that literally runs the internet), **ICMP** and the tools built on it (`ping`, `traceroute`), IP fragmentation and the DF bit, ECMP, asymmetric routing, and the switch-vs-router distinction. If you can explain what happens to a packet at every router between you and a server, you own this layer.

**Mental model**

Think of routing as a relay race where **no runner knows the whole course** — each only knows who to hand the baton to next. A packet carries a fixed destination IP the whole way. At every hop, a router looks only at that destination, consults its routing table, picks the single best-matching route, and forwards the packet out one interface toward the next router. It does **not** know or care about the rest of the path — routing is hop-by-hop and each decision is local and independent. This is why the internet scales: no device holds a map of everything, just "for these prefixes, send that way; for everything else, use the default route." A **TTL** field counts down by one at each hop so a misconfigured loop eventually kills the packet instead of circulating forever. Layer this over the physical reality — the internet is a **network of networks**: tens of thousands of autonomous systems (ASes) glued together by BGP peering and transit relationships. Your packet crosses several ASes, and within each, an interior protocol steers it hop to hop.

**Key terms**

- **IP address** — the layer-3 logical address identifying a host's network attachment; routable, unlike a MAC.
- **Routing table** — ordered set of `destination-prefix → next-hop/interface` entries; the forwarding decision source.
- **Longest-prefix match** — when multiple routes match a destination, the most specific (longest mask) wins.
- **Default route** — `0.0.0.0/0`, the catch-all matched only when nothing more specific does; points at the default gateway.
- **Default gateway** — the router a host sends any off-subnet packet to.
- **Next hop** — the neighbouring router IP a packet is forwarded to on its way toward the destination.
- **TTL (hop limit)** — decremented each hop; hitting 0 drops the packet and triggers an ICMP time-exceeded — the basis of traceroute.
- **IGP** — interior gateway protocol, run **within** one AS: OSPF, IS-IS (link-state), RIP (distance-vector).
- **BGP** — exterior gateway protocol run **between** ASes; path-vector, policy-driven; the internet's routing glue.
- **Autonomous system (AS)** — a network under one administrative/routing policy, identified by an ASN.
- **ICMP** — the network layer's control/error protocol: echo (ping), time-exceeded, destination-unreachable, frag-needed.
- **ECMP** — equal-cost multipath: spread traffic across multiple equally-good next hops.

**Why interviewers ask this**

Routing separates candidates who memorised the OSI layers from those who understand how a packet actually reaches a server. A junior says "the router sends it to the destination"; a senior explains hop-by-hop forwarding, longest-prefix match, and that no single device knows the full path. For backend/SRE work the payoff is diagnostic: when a service is unreachable, is it a routing black hole, a missing return route (asymmetric routing breaking a stateful firewall), an MTU/fragmentation problem silently dropping large packets, or a BGP withdrawal upstream? Understanding ICMP explains why `traceroute` works and why over-zealously blocking all ICMP breaks path-MTU discovery and makes connections mysteriously hang on large payloads. And knowing that BGP is policy-driven and trust-based explains the recurring headline: one operator fat-fingers a prefix and takes a chunk of the internet offline.

**Common confusions**

- "Routing and forwarding are the same." Routing is *building* the table (control plane); forwarding is *using* it per packet (data plane).
- "A router knows the whole path to the destination." It knows only the next hop. Path knowledge is distributed.
- "Switches and routers do the same thing." A switch forwards frames within one L2 segment by MAC; a router forwards packets between L3 networks by IP.
- "The default gateway is where all my traffic goes." Only off-subnet traffic; same-subnet traffic is delivered directly via ARP, no router involved.
- "Blocking ICMP is just good security." Blocking echo is fine; blocking *all* ICMP breaks path-MTU discovery and error signalling, causing silent hangs.
- "More specific route = higher metric wins." No — longest-prefix wins first; the metric only breaks ties among equally-specific routes.

**What follows from this topic**

Routing is the layer beneath everything transport-and-above. The TTL mechanic here underlies traceroute diagnostics you'll use in the "site is slow" scenarios of later topics. Fragmentation and MTU feed directly into TCP's MSS and the mysterious "large POSTs hang" bugs in the TCP deep-dive. The switch-vs-router distinction connects down to the link layer (ARP/MAC) and up to L4/L7 load balancing — an L4 load balancer is essentially routing on IP+port, while L7 routes on application content. And BGP's role as the internet's connective tissue frames why CDNs use anycast and why DNS and TCP both sit on top of a best-effort, hop-by-hop packet network that guarantees nothing.

### Q1. What is the job of the network layer, and how is it different from the link layer?

The **link layer** (L2) moves a *frame* between two directly-connected nodes on the same physical segment, addressed by MAC. It has no concept of "somewhere else on the internet."

The **network layer** (L3) moves a *packet* from a source host to a destination host **across many networks**, addressed by IP. Its two responsibilities:

- **Logical addressing** — IP addresses that are routable and hierarchical (unlike flat, location-independent MACs).
- **Routing/forwarding** — choosing a path across intermediate routers so the packet reaches a host that may be thousands of miles and dozens of hops away.

Rule of thumb: **the destination MAC changes at every hop; the destination IP stays the same end to end.** Each router rewrites the L2 framing for the next link but preserves the L3 destination.

### Q2. Walk me through what happens to a packet as it travels from router to router.

Hop-by-hop, each router acting independently:

1. Router receives a frame, strips L2 framing, reads the destination **IP** in the packet header.
2. It does a **longest-prefix-match** lookup in its routing table to find the best next hop and outgoing interface.
3. It **decrements the TTL** by one. If TTL hits 0, it drops the packet and sends an ICMP time-exceeded back to the source.
4. It resolves the next hop's MAC (ARP), builds a **new** L2 frame for the outgoing link, and forwards.
5. The next router repeats the whole process — with no knowledge of what the previous router decided.

The packet's destination IP never changes; only the L2 framing and TTL do. No single router knows the full path — each makes a purely local decision. That locality is exactly what lets the internet scale to billions of destinations.

### Q3. What is a routing table and how does longest-prefix match work?

A routing table is an ordered set of entries mapping a **destination prefix** to a **next hop and interface**:

```bash
$ ip route
default via 192.168.1.1 dev eth0          # 0.0.0.0/0 — catch-all
10.0.0.0/8 via 10.0.0.1 dev eth1          # whole private range
10.0.5.0/24 via 10.0.5.1 dev eth1         # more specific
192.168.1.0/24 dev eth0 proto kernel scope link  # directly connected
```

When a packet's destination matches **multiple** entries, the router picks the one with the **longest prefix** (most specific mask). A packet to `10.0.5.42`:

- matches `10.0.0.0/8` (8 bits)
- matches `10.0.5.0/24` (24 bits) ← **wins**, more specific
- matches `0.0.0.0/0` (0 bits, default)

Longest-prefix match runs first; **metrics only break ties** between equally-specific routes. The `default` route (`0.0.0.0/0`) matches everything and is chosen only when nothing more specific does.

### Q4. What is the default gateway, and how does a host decide whether to deliver locally or send to it?

The **default gateway** is the router a host uses for any destination **not on its own subnet**.

The host ANDs the destination IP with its own subnet mask and compares to its own network:

- **Same subnet** → deliver **directly**. ARP for the destination's MAC and send the frame straight to it. No router involved.
- **Different subnet** → send to the **default gateway**. ARP for the *gateway's* MAC, frame it to the gateway, and let it route onward.

```bash
# Host 192.168.1.50/24, gateway 192.168.1.1
# → 192.168.1.90  : same /24 → ARP + direct delivery
# → 93.184.216.34 : off-subnet → send to gateway 192.168.1.1
```

This is why "can't reach the internet but can ping local machines" points at a bad gateway/route, while "can't reach anything including the gateway" points at L2/link.

### Q5. What is the difference between static and dynamic routing?

**Static routing** — an admin manually configures routes (`ip route add ...`). Simple, predictable, no protocol overhead, no CPU/bandwidth cost. But it doesn't react to failure: if a link dies, the static route still points at it — a black hole until someone fixes it. Fine for small/stub networks and default routes.

**Dynamic routing** — routers run a **routing protocol** (OSPF, BGP…) that discovers topology, exchanges reachability, and **recomputes paths automatically** when links change. Scales to large networks and self-heals around failures, at the cost of protocol complexity, CPU, and convergence time (the window during which routers disagree after a change).

Most real networks use both: dynamic protocols for the interior, plus a static default route toward the upstream.

### Q6. Give me an overview of routing protocols — IGP vs EGP.

Two families, split by scope:

| | IGP (interior) | EGP (exterior) |
|---|---|---|
| Runs | **within** one AS | **between** ASes |
| Goal | find the *shortest/fastest* path | enforce *policy* + reachability |
| Examples | OSPF, IS-IS (link-state), RIP (distance-vector) | **BGP** (path-vector) |
| Metric | cost/hops/bandwidth | AS-path length + policy attributes |

- **OSPF / IS-IS** — link-state: every router floods its local links, all build an identical map, each runs Dijkstra to compute shortest paths. Fast convergence, used inside enterprises and ISPs.
- **RIP** — distance-vector, hop-count metric capped at 15; legacy, mostly gone.
- **BGP** — the single EGP that matters. It doesn't optimise for speed; it exchanges *which AS-paths reach which prefixes* and applies **policy** (who you'll route through, who you prefer). It's how independent networks agree on reachability.

### Q7. What is BGP and why do people say it "runs the internet"?

**BGP (Border Gateway Protocol)** is the protocol that glues the ~75,000 autonomous systems of the internet together. Each **AS** (an ISP, cloud, big enterprise — identified by an **ASN**) announces the IP prefixes it owns and the AS-paths by which they're reachable. BGP is:

- **Path-vector** — advertisements carry the full list of ASes to traverse, which prevents loops and drives selection.
- **Policy-driven** — selection isn't "shortest"; it's business policy (prefer a customer over a peer over a transit provider, honour contracts, shortest AS-path as a tiebreak).
- **Trust-based and slow to converge** — historically routers accept what neighbours announce.

That trust is the danger. If an operator mistakenly announces prefixes it doesn't own (or leaks a full table), BGP happily propagates it and traffic for those prefixes gets black-holed or hijacked **globally** — the classic "someone took a country/service offline with a BGP misconfig" outage. Mitigations: RPKI origin validation, prefix filtering, max-prefix limits.

### Q8. What is ICMP and what is it used for?

**ICMP (Internet Control Message Protocol)** is the network layer's control and error-signalling protocol — it carries diagnostics *about* IP, not user data. Key message types:

- **Echo request / reply** — the basis of `ping`; tests reachability and RTT.
- **Time exceeded** — sent when TTL hits 0; **powers traceroute**.
- **Destination unreachable** — with sub-codes: *network unreachable*, *host unreachable*, *port unreachable*, and *fragmentation needed (DF set)*.
- **Redirect** — "use a better gateway for this."

The frag-needed message is critical: it's how **path-MTU discovery** works. If you blanket-block ICMP at a firewall, echo stops (fine) but you also kill frag-needed and time-exceeded — so large packets get silently dropped with no error, and connections **hang** instead of failing cleanly. Allow ICMP types 3 and 11 even if you drop echo.

### Q9. How does traceroute actually work?

Traceroute abuses the **TTL** mechanic to make each router on the path identify itself:

1. Send a packet to the destination with **TTL = 1**. The first router decrements it to 0, drops it, and returns an **ICMP time-exceeded** — revealing hop 1's IP.
2. Send again with **TTL = 2**. It survives hop 1, dies at hop 2, which returns time-exceeded — revealing hop 2.
3. Increment TTL until the packet finally reaches the destination (which returns a port-unreachable or echo reply), and you've enumerated every hop.

```bash
$ traceroute example.com
 1  192.168.1.1      1.2 ms
 2  10.0.0.1         8.4 ms
 3  * * *                      # hop not replying to ICMP — normal, not necessarily broken
 4  93.184.216.34   24.1 ms
```

`* * *` means a hop didn't send time-exceeded (rate-limited or filtered) — usually harmless. `mtr` is the continuous, statistical version and is better for spotting loss at a specific hop.

### Q10. What is the difference between routing and forwarding?

Two planes:

- **Routing (control plane)** — the *process of building* the routing table: running protocols, exchanging topology, computing best paths. Relatively slow, happens continuously in the background.
- **Forwarding (data plane)** — the *per-packet act* of looking up the destination in the (already-built) forwarding table and shoving the packet out an interface. Extremely fast, often in hardware (ASIC/TCAM).

The routing table (RIB, Routing Information Base) is distilled into a forwarding table (FIB) optimised for line-rate lookups. This split is why a router can forward millions of packets per second while its routing protocols churn away separately — and why a control-plane hiccup (BGP flap) can disrupt paths even though the hardware forwarding path itself is fine.

### Q11. Explain IP fragmentation, reassembly, and the DF bit.

Every link has an **MTU** (max transmission unit, typically 1500 bytes on Ethernet). If a packet is larger than the next link's MTU, IPv4 lets a router **fragment** it into pieces that each fit, tagged so the **destination** (never an intermediate router) reassembles them.

Fragmentation is costly and fragile — a single lost fragment forces retransmission of the whole original packet. So the **DF (Don't Fragment) bit** exists: set it, and instead of fragmenting, a router that can't fit the packet **drops it and returns ICMP frag-needed** with the MTU it *can* handle. The sender then lowers its packet size. This is **path-MTU discovery**.

The failure mode: if that ICMP frag-needed is firewall-blocked, the sender never learns to shrink packets — small packets (handshake) succeed, large ones (a big POST or a TLS cert) vanish, and the connection hangs. This is the classic "PMTU black hole." IPv6 removes router fragmentation entirely — hosts must do PMTUD or fragment at the source.

### Q12. What is asymmetric routing and why can it cause problems?

**Asymmetric routing** is when the forward path (A→B) differs from the return path (B→A). On the raw internet this is *normal and fine* — each hop routes independently and BGP policy often makes the two directions diverge across different ASes.

It breaks things only where a device needs to see **both directions of a flow**:

- **Stateful firewalls / NAT** — they build state on the outbound SYN; if the reply comes back a different path that bypasses them, they drop it as "unsolicited."
- **Load balancers / IDS** — miss half the conversation, so they can't track or inspect the connection.

The fix isn't "force symmetry everywhere" (often impossible) but placing stateful devices where they reliably see both directions, or using flow-aware/ECMP-consistent hashing so both directions hit the same box.

### Q13. What is the difference between a switch and a router?

| | Switch (L2) | Router (L3) |
|---|---|---|
| Operates on | MAC addresses (frames) | IP addresses (packets) |
| Scope | one broadcast domain / LAN segment | between networks/subnets |
| Table | MAC address table (learned) | routing table (prefixes) |
| Decision | which port has this MAC | which next hop for this prefix |
| Changes header | no (just forwards frame) | rewrites L2 frame, decrements TTL |
| Broadcasts | floods within the segment | stops them (segments broadcast domains) |

A **switch** connects devices *within* a network and forwards by MAC. A **router** connects *different* networks and forwards by IP, making the hop-by-hop decisions that get a packet across the internet. Modern "L3 switches" blur this by doing both in hardware, but the conceptual split holds: L2 = within a segment, L3 = between segments.

### Q14. What are the different route types you'll see in a routing table — connected, static, dynamic?

- **Connected** — automatically installed for a subnet the router is directly attached to (an interface has an IP on it). No configuration needed; it's the most trustworthy route. Shown as `proto kernel scope link` in `ip route`.
- **Static** — manually configured by an admin (`ip route add 10.0.0.0/8 via ...`). Doesn't react to failures.
- **Dynamic** — learned from a routing protocol (OSPF, BGP…) and updated automatically as topology changes.

When multiple sources offer a route to the same prefix, routers use **administrative distance** to pick which to trust: connected (0) beats static (1) beats OSPF (110) beats BGP-external (20)… lower is more trusted. Administrative distance chooses *which protocol's route to install*; the protocol's own *metric* then chooses among that protocol's paths; and longest-prefix match sits above both.

### Q15. What is ECMP (equal-cost multipath)?

**ECMP** lets a router install and use **multiple next hops** for the same destination when they have equal cost, spreading traffic across them for more aggregate bandwidth and redundancy.

To avoid packet reordering within a single TCP flow (which hurts throughput), routers hash **per-flow**, not per-packet — typically a hash of the 5-tuple (src/dst IP, src/dst port, protocol) picks one path, so every packet of a given connection takes the *same* link, while different connections spread out.

```text
              ┌─ next-hop A ─┐
dst 10.0.0.0/8 ┤              ├─ same 5-tuple → same path (no reordering)
              └─ next-hop B ─┘
```

Gotchas: it interacts badly with **PMTU black holes** (different paths, different MTUs) and with **asymmetric routing** for stateful middleboxes. It's the backbone of leaf-spine datacentre fabrics and how you scale bandwidth beyond a single link.

### Q16. What is the difference between "network unreachable" and "host unreachable" ICMP messages?

Both are sub-codes of ICMP **destination-unreachable**, but they point at different failure locations:

- **Network unreachable** — a router has **no route** to the destination *network* at all (no matching prefix, no default). The failure is early on the path — the packet couldn't even find a way toward that subnet.
- **Host unreachable** — a router *did* reach the destination's network, but the **specific host** isn't answering (typically the last-hop router ARPs for the host and gets no reply — the machine is down or doesn't exist on that subnet).

Diagnostically: *network* unreachable ⇒ suspect routing/BGP/missing route upstream; *host* unreachable ⇒ you got to the right network, the target box itself is down or misconfigured. Contrast both with **port unreachable** (host is up, but nothing is listening on that UDP port) and plain **timeout** (silently dropped, usually a firewall). Which ICMP you get is a fast triage signal for "where on the path did this die."

## TCP Deep Dive

### Summary

**What this topic covers**

TCP — the transport protocol that turns IP's best-effort, drop-anything packet delivery into a **reliable, ordered, connection-oriented byte stream**. This is the protocol under HTTP, SSH, databases, and most of what you run in production, so interviewers dig deep. The 18 questions here cover the full lifecycle and mechanics: the **3-way handshake**, how reliability is achieved (sequence numbers, cumulative and selective ACKs, retransmission, RTO, fast retransmit), **flow control** (the receive window — don't overrun the *receiver*) versus **congestion control** (slow-start, cwnd, AIMD, Reno/CUBIC/BBR — don't overrun the *network*), graceful teardown (FIN/ACK four-way close) versus abortive **RST**, the connection **state machine** (and what a pile of `TIME_WAIT` or `CLOSE_WAIT` tells you), Nagle vs delayed-ACK and `TCP_NODELAY`, keep-alive, head-of-line blocking, the bandwidth-delay product, MSS, and SYN floods. This is the topic where "I've operated real systems" shows.

**Mental model**

TCP is a **contract layered over an unreliable postal service**. IP will drop, duplicate, delay, and reorder packets; TCP hides all of it behind a stream abstraction so the application just reads bytes in order. It does this with two counters and a feedback loop: every byte has a **sequence number**, the receiver **ACKs** what it has contiguously received, and anything unacknowledged after a timeout (or 3 duplicate ACKs) is **retransmitted**. Two *separate* control loops govern how fast you send. **Flow control** protects the *receiver* — it advertises a receive window (rwnd) saying "I have this much buffer left." **Congestion control** protects the *network* — the sender maintains its own congestion window (cwnd) and treats packet loss as a signal to slow down. The actual send rate is `min(rwnd, cwnd)`. Internalise those as two different problems solving two different overload scenarios and most TCP questions unlock. And remember every connection is a **state machine** — the socket states you see in `ss` are literally its nodes.

**Key terms**

- **3-way handshake** — SYN → SYN-ACK → ACK; synchronises initial sequence numbers before any data.
- **Sequence / ACK numbers** — byte offsets; how TCP orders data and detects loss/duplication.
- **Cumulative ACK** — "I have everything up to byte N"; the default ACK semantics.
- **SACK (selective ACK)** — "I also have this out-of-order block"; avoids re-sending already-received data.
- **RTO** — retransmission timeout, derived from measured RTT; fires when an ACK doesn't arrive.
- **Fast retransmit** — resend on 3 duplicate ACKs without waiting for the RTO.
- **rwnd (receive window)** — flow control: how much the *receiver* can currently buffer.
- **cwnd (congestion window)** — congestion control: how much the *sender* dares to have in flight.
- **AIMD** — additive-increase/multiplicative-decrease: the sawtooth of classic congestion control.
- **TIME_WAIT** — the active closer waits 2·MSL after closing to absorb stray packets.
- **CLOSE_WAIT** — the peer closed; *you* haven't yet — a pile of these means your app is leaking sockets.
- **RST** — abortive reset; immediate teardown, no graceful close.
- **MSS** — max segment size, the largest payload per segment, derived from the path MTU.
- **BDP** — bandwidth-delay product: bytes in flight needed to fill the pipe.

**Why interviewers ask this**

TCP is where operational maturity shows. A junior can define the handshake; a senior explains *why* it's three steps not two, distinguishes flow control from congestion control without blurring them, and reads a socket-state dump as a diagnosis. The questions are load-bearing for real incidents: p99 latency spikes under load (congestion/bufferbloat), a client running out of ephemeral ports because of `TIME_WAIT` pile-up, a server leaking file descriptors visible as `CLOSE_WAIT`, small-write latency from the Nagle/delayed-ACK interaction, throughput capped far below link speed because the window is too small for the BDP. Being able to reach for `ss -tan` and interpret the states is exactly the skill that turns a 2am outage from guesswork into diagnosis — which is why SRE and backend interviews lean on it.

**Common confusions**

- "Flow control and congestion control are the same." No — flow control protects the *receiver's buffer* (rwnd); congestion control protects the *network* (cwnd). Different problems, different windows.
- "TCP guarantees delivery." It guarantees *reliable, ordered delivery or notification of failure*. If the network truly fails, TCP resets/times out — it can't magic packets through.
- "TIME_WAIT is a bug." It's correct behaviour on the active closer; it exists to absorb delayed duplicates and ensure the final ACK lands.
- "CLOSE_WAIT and TIME_WAIT are similar." Opposite ends: TIME_WAIT = *you* closed actively (usually fine); CLOSE_WAIT = *peer* closed and your app hasn't (usually a bug).
- "A RST means an error occurred." Often it's just an abortive close or "connection refused" (nothing listening) — informative, not necessarily broken.
- "Bigger bandwidth = faster TCP." Not if the window can't cover the BDP; on high-latency links you need window scaling, not more Mbps.

**What follows from this topic**

TCP is the substrate for HTTP/1.1 and HTTP/2 — its ordered-stream guarantee is exactly what causes **TCP-level head-of-line blocking** that HTTP/2 couldn't escape and HTTP/3 fled to QUIC-over-UDP to avoid. The handshake RTT here is why connection reuse (keep-alive), TLS session resumption, and 0-RTT matter in the HTTP/TLS topics. The congestion-control mechanics underlie the "diagnose the slow site" and "p99 is spiky" scenarios. And the contrast with the next topic — UDP — is the cleanest way to see what TCP buys you and what it costs: everything TCP does automatically is something a UDP application must do itself or deliberately live without.

### Q1. What does TCP provide, and what does it build on?

TCP gives applications a **reliable, ordered, connection-oriented byte stream** on top of IP's best-effort datagram service. Concretely, four guarantees:

- **Reliable** — lost data is retransmitted; you get the bytes or the connection fails loudly.
- **Ordered** — bytes are delivered to the app in the order sent, even if packets arrive scrambled.
- **Connection-oriented** — an explicit handshake establishes shared state before data flows.
- **Byte-stream** — no message boundaries; the app reads a stream and must frame its own messages.

It adds, on top of IP: sequence numbers, ACKs and retransmission (reliability), a receive window (flow control), and cwnd/slow-start/AIMD (congestion control). IP itself promises *nothing* — it may drop, duplicate, delay, or reorder. TCP's entire job is to hide that unreliability behind a clean stream so the application layer never has to think about lost packets.

### Q2. Explain the 3-way handshake. Why three messages and not two?

```text
Client                          Server
  │ ── SYN, seq=x ──────────────▶ │   "let's talk, my ISN is x"
  │ ◀──── SYN-ACK, seq=y ack=x+1 ─│   "ok, my ISN is y, got yours"
  │ ── ACK, ack=y+1 ────────────▶ │   "got yours, we're synced"
  │        ESTABLISHED             │
```

Each side must **synchronise its initial sequence number (ISN)** with the other before data flows — that's the "SYN" (synchronise). The three steps are the minimum to prove **both directions work**:

1. Client's SYN proves the client can send.
2. Server's SYN-ACK proves the server received it *and* can send back.
3. Client's ACK proves the client received the server's ISN.

Two messages can't do it: after only SYN + SYN-ACK, the *server* has no confirmation the client received its sequence number, so the reverse direction is unverified and old duplicate SYNs couldn't be safely rejected. The third ACK closes that loop. The cost: the handshake adds **one full RTT** of latency before any application data — which is why connection reuse matters so much.

### Q3. How does TCP achieve reliability?

A layered set of mechanisms:

- **Sequence numbers** — every byte is numbered, so the receiver can detect gaps, duplicates, and reordering.
- **Cumulative ACKs** — the receiver acknowledges the highest contiguous byte received ("I have everything up to N").
- **Retransmission on timeout (RTO)** — if an ACK for sent data doesn't arrive within the RTO (computed from smoothed RTT + variance), the sender resends.
- **Fast retransmit** — waiting for the RTO is slow; if the sender sees **3 duplicate ACKs** (receiver keeps saying "still need N"), it infers that segment was lost and resends *immediately*.
- **SACK (selective ACK)** — lets the receiver say "I have N, and also blocks N+2..N+5," so the sender resends only the actual hole, not everything after it.
- **Checksums** — detect corruption; corrupt segments are dropped and retransmitted.

Together these turn a lossy channel into a reliable stream — the sender keeps unacknowledged data buffered and re-sends until acknowledged.

### Q4. What is TCP flow control and how does the receive window work?

Flow control stops a fast sender from **overrunning a slow receiver's buffer**. The receiver advertises a **receive window (rwnd)** in every ACK: "I currently have this many bytes of free buffer." The sender may have at most `rwnd` bytes unacknowledged in flight — no more.

- As the receiving app drains data from the buffer, rwnd grows and is advertised back, letting the sender speed up.
- If the app stops reading, the buffer fills, rwnd shrinks to **zero**, and the sender **stops**. It then sends periodic **window probes** until the receiver advertises a non-zero window again (so a lost window-update doesn't deadlock the connection).

Flow control is purely a **receiver-driven, end-to-end** mechanism — it knows nothing about the network in between. That's the job of congestion control, which is a completely separate loop.

### Q5. What is window scaling and why is it needed?

The TCP header's window field is only **16 bits** — max 65,535 bytes. On a high-latency, high-bandwidth link that's far too small: to keep the pipe full you need bytes-in-flight equal to the **bandwidth-delay product**, which can be megabytes.

The **window scaling** option (negotiated in the SYN) applies a left-shift multiplier to the advertised window, allowing windows up to ~1 GB. Without it, throughput on a "long fat network" is capped at `65535 / RTT` regardless of link speed — e.g. on a 100 ms RTT path that's only ~5 Mbit/s no matter how fat the pipe. Window scaling is why a 1 Gbit transfer across a continent can actually approach 1 Gbit. It's on by default in modern stacks; the classic gotcha is a middlebox stripping the option and silently crippling throughput.

### Q6. What is congestion control, and how is it different from flow control?

**Congestion control protects the *network*; flow control protects the *receiver*.** They're separate loops, and the sender obeys both: it may send at most `min(rwnd, cwnd)` bytes in flight.

Flow control (rwnd) is told to the sender explicitly by the receiver. Congestion control (**cwnd**, the congestion window) is *inferred* by the sender from the network's behaviour — there's no explicit signal, so **packet loss (or delay) is read as the network being overloaded**. The core algorithm:

- **Slow start** — begin with a small cwnd, double it each RTT (exponential ramp) to quickly find capacity.
- **Congestion avoidance (AIMD)** — past a threshold, grow cwnd by ~1 MSS per RTT (additive increase); on loss, **halve** it (multiplicative decrease). This produces the classic **sawtooth**.
- **Fast recovery** — after a fast retransmit, don't collapse all the way back to slow-start; halve and continue.

Without congestion control, senders would collectively overwhelm shared links and cause congestion collapse. It's the mechanism that makes the internet *fair* and *stable* under load.

### Q7. Compare Reno, CUBIC, and BBR congestion-control algorithms.

| | Reno (classic) | CUBIC (Linux default) | BBR (Google) |
|---|---|---|---|
| Loss signal | packet loss | packet loss | **not loss** — models bottleneck bandwidth + RTT |
| Growth | linear (AIMD) | cubic function of time since last loss | probes bandwidth + min-RTT |
| On buffers | fills buffers (bufferbloat) | fills buffers | keeps queues short → lower latency |
| Weakness | slow on high-BDP links | still loss-based; hurt by random loss | can be unfair to loss-based flows |

**Reno/NewReno** — the original AIMD sawtooth; simple but slow to recover on fat pipes and misreads random (non-congestion) loss as congestion.

**CUBIC** — Linux's default; grows the window as a cubic function so it ramps aggressively after a loss and plateaus near the last known limit. Better for high-BDP links but still loss-based, so it inflates buffers (**bufferbloat**) and treats any loss as congestion.

**BBR** — abandons loss-as-signal entirely; it *measures* the bottleneck bandwidth and minimum RTT and paces to that, keeping queues short and latency low. Great for lossy or high-BDP paths (and why it helps video/QUIC), but can starve loss-based flows sharing a link.

### Q8. Walk me through TCP connection teardown.

Graceful close is a **four-way** exchange because each direction is closed independently (TCP is full-duplex):

```text
Client                          Server
  │ ── FIN ─────────────────────▶ │   "I'm done sending"
  │ ◀──────────────────── ACK ─── │   "ok"
  │ ◀──────────────────── FIN ─── │   "I'm done too"
  │ ── ACK ─────────────────────▶ │   "ok"
  │  TIME_WAIT (2·MSL)             │  CLOSED
```

Either side sends **FIN** to say "I have no more data." The peer ACKs it, and may keep sending its own data (**half-close** — one direction shut, the other still open). When the peer is also done it sends its FIN, which the first side ACKs. The active closer then sits in **TIME_WAIT** for 2·MSL before fully releasing. Contrast with **RST**, which is an immediate, no-negotiation abort.

### Q9. What is TIME_WAIT and why does it exist? Why do I see thousands of them?

After the **active closer** sends its final ACK, it enters **TIME_WAIT** for **2·MSL** (twice the maximum segment lifetime, historically ~1–4 minutes total). Two reasons:

1. **Absorb delayed duplicates** — old segments from this connection could still be wandering the network; waiting ensures they expire before the same 4-tuple could be reused, so they can't corrupt a *new* connection.
2. **Guarantee the final ACK lands** — if the peer's last FIN is retransmitted (because our ACK was lost), we're still around to re-ACK it.

You see **thousands** on a busy **client or forward proxy** that opens many short-lived outbound connections and closes them actively — each parks in TIME_WAIT. The real danger is **ephemeral-port exhaustion**: with a finite outbound port range, too many simultaneous TIME_WAITs to the same destination and you can't open new connections. Fixes: **reuse connections** (keep-alive/pooling — the best fix), enable `net.ipv4.tcp_tw_reuse` for outbound, widen the ephemeral range, or spread across destination IPs. Do **not** just slash the timeout blindly — it exists for correctness.

### Q10. What is a TCP RST, and when do you get one?

A **RST (reset)** is an **abortive close** — it tears the connection down immediately with no FIN handshake, no TIME_WAIT, and discards any buffered data. You get one when:

- **Connection refused** — you SYN to a port with **nothing listening**; the host replies with RST. (This is *reachability confirmed, service absent* — distinct from a timeout, where the packet is silently dropped.)
- **Aborting a live connection** — an app closes with `SO_LINGER` set to 0, or sends to a socket the peer has already torn down.
- **Half-open recovery** — you send data on a connection the peer no longer knows about (e.g. it rebooted); it RSTs to say "I have no such connection."
- **Middlebox intervention** — a firewall/IDS injects RSTs to kill a connection.

Diagnostic value: **RST = you reached the host, it actively rejected/aborted** (fast failure). **Timeout = packet dropped**, usually a firewall or unreachable host (slow failure). That distinction is one of the most useful in network debugging.

### Q11. Walk me through the main TCP connection states.

The states you'll see in `ss`/`netstat`, roughly in lifecycle order:

- **LISTEN** — server waiting for incoming SYNs.
- **SYN-SENT** — client sent SYN, awaiting SYN-ACK.
- **SYN-RECV** — server got SYN, sent SYN-ACK, awaiting final ACK (a flood of these = SYN flood).
- **ESTABLISHED** — handshake complete, data flowing. The healthy steady state.
- **FIN-WAIT-1 / FIN-WAIT-2** — active closer sent FIN, awaiting ACK / peer's FIN.
- **CLOSE-WAIT** — peer sent FIN; **your** side must now close. Piling up = **your app isn't calling close()**.
- **LAST-ACK** — you sent your FIN in response, awaiting its ACK.
- **TIME-WAIT** — active closer waiting 2·MSL after closing.
- **CLOSED** — fully torn down.

The two diagnostic tells: many **TIME_WAIT** ⇒ you're actively closing lots of short connections (often benign, watch port exhaustion); many **CLOSE_WAIT** ⇒ a **socket leak in your application** — the peer hung up and your code never closed the file descriptor.

### Q12. I see thousands of CLOSE_WAIT sockets on my server. What does that mean?

It almost always means an **application bug: you're not closing sockets.**

`CLOSE_WAIT` is the state where the **peer has sent a FIN** (they're done) and the local TCP is waiting for **your application** to call `close()`. TCP can't advance past it on its own — it needs the app to close the descriptor. If they pile up:

- Your code accepted/opened connections and never closed them on some path (missing `close()`, a leaked handle, an exception skipping cleanup, an exhausted thread not finishing a request).
- Each stuck `CLOSE_WAIT` holds a **file descriptor**; enough of them and you hit the FD limit and can't accept new connections — the server effectively wedges.

```bash
$ ss -tan state close-wait | wc -l    # count them; if it grows unbounded, it's a leak
```

Fix it in the app (ensure every connection is closed in a `finally`/`defer`/`with`), not in the kernel. Contrast with TIME_WAIT, which is the *kernel's* correct behaviour on the side that closed first.

### Q13. Explain Nagle's algorithm and delayed ACK, and why they interact badly.

**Nagle's algorithm** reduces tiny-packet overhead: it withholds sending a small segment until either there's enough data to fill an MSS *or* all previously-sent data has been ACKed. Great for bulk throughput, coalesces small writes.

**Delayed ACK** reduces ACK traffic: the receiver waits up to ~40–200 ms before ACKing, hoping to piggyback the ACK on return data or batch multiple ACKs.

The bad interaction: sender writes a small request and Nagle **holds** it waiting for an ACK of prior data; the receiver **delays** that ACK waiting for more data or a timer. Result: a ~40–200 ms **stall** on every small request/response — deadly for latency-sensitive, request/response protocols (RPC, databases, interactive APIs).

The fix is **`TCP_NODELAY`**, which disables Nagle so small writes go out immediately:

```c
setsockopt(fd, IPPROTO_TCP, TCP_NODELAY, &one, sizeof(one));
```

Rule of thumb: bulk transfer → Nagle fine; latency-sensitive request/response → set `TCP_NODELAY`.

### Q14. What is TCP keep-alive and what is it for?

**TCP keep-alive** periodically sends a probe on an **idle** connection to check the peer is still there and to keep the connection state alive in stateful middleboxes (NAT/firewalls that time out idle flows).

By default it's *very* lazy — Linux waits ~2 hours idle before the first probe, then a few probes spaced minutes apart before declaring the connection dead. So it's useless for fast failure detection out of the box; you tune `tcp_keepalive_time`/`_intvl`/`_probes` (or set them per-socket) if you actually want to reap dead peers quickly.

Two distinct uses: (1) **detect a dead peer** that vanished without a FIN (crashed host, pulled cable) so you don't hold a zombie ESTABLISHED forever; (2) **keep NAT/firewall state warm** so a long-idle connection isn't silently dropped by a middlebox. For app-level liveness, an application-layer heartbeat (or HTTP/2 PING) is usually more responsive than relying on TCP keep-alive.

### Q15. What is head-of-line blocking at the TCP level?

Because TCP delivers a **strictly ordered byte stream**, a single lost segment blocks delivery of **everything behind it** — even bytes that already arrived — until the gap is retransmitted and filled. The receiver *has* the later data buffered but can't hand it to the application, because that would violate ordering. This is **TCP head-of-line (HOL) blocking**.

It's usually invisible for a single request, but it bites hard when you **multiplex many independent streams over one TCP connection** — which is exactly what **HTTP/2** does. One lost packet stalls *all* the concurrent HTTP/2 streams on that connection, not just the one whose data was lost, because they share the single ordered TCP stream.

This is *the* reason **HTTP/3 abandoned TCP** and moved to **QUIC over UDP**: QUIC implements per-stream ordering, so a loss in one stream doesn't block the others. You can't fix TCP HOL blocking within TCP — the ordered-stream guarantee that makes TCP useful is the same property that causes it.

### Q16. What is the bandwidth-delay product and why does it matter?

The **bandwidth-delay product (BDP)** = bandwidth × round-trip time — the number of bytes that can be "in the pipe" (unacknowledged, in flight) at once to keep a link fully utilised.

```text
BDP = 1 Gbit/s × 100 ms RTT
    = 1e9 bits/s × 0.1 s / 8
    ≈ 12.5 MB in flight to saturate the link
```

If your TCP window is **smaller than the BDP**, the sender exhausts its window and **stalls waiting for ACKs**, so you never fill the pipe — throughput is capped at `window / RTT` regardless of link capacity. This is why a fat but high-latency link ("long fat network") underperforms without **window scaling** and adequate socket buffers. It's also why "just buy more bandwidth" doesn't fix a latency-bound transfer: if the window can't cover the BDP, extra Mbps sit idle. Sizing buffers to ≥ BDP is the fix.

### Q17. What are SYN floods and SYN cookies?

A **SYN flood** is a DoS attack that abuses the handshake: the attacker sends a torrent of SYNs (often with spoofed source IPs) but **never sends the final ACK**. Each half-open connection sits in **SYN-RECV**, consuming an entry in the server's finite **SYN backlog** while it waits (and retransmits SYN-ACKs) for an ACK that never comes. Fill the backlog and the server can't accept **legitimate** new connections.

**SYN cookies** defeat this without keeping per-connection state. Instead of allocating a backlog entry on SYN, the server encodes the connection state into the **initial sequence number** of its SYN-ACK (a cryptographic hash of the 4-tuple + timestamp + MSS). It then *forgets* the connection entirely. If a legitimate final ACK arrives, its ACK number (ISN+1) lets the server **reconstruct** the state from the cookie — no memory was held in the meantime. So a flood of SYNs that never complete costs the server nothing.

```bash
sysctl -w net.ipv4.tcp_syncookies=1   # enabled by default on modern Linux
```

### Q18. Why does the TCP handshake add latency, and how do you observe connection states?

The **3-way handshake costs one full RTT** before any application byte can be sent (SYN → SYN-ACK → ACK, and only *then* does the client send its request). Add TLS on top and it's more round trips (TLS 1.2 = 2 RTT, TLS 1.3 = 1 RTT, 0-RTT resumption = 0). On a 100 ms path, that setup RTT is 100 ms of pure latency *per new connection* — which is why **connection reuse (HTTP keep-alive, connection pooling)** and **TLS resumption** matter so much: they amortise or eliminate the handshake cost across many requests.

To watch states live, `ss` (the modern `netstat`) reads the kernel's socket tables:

```bash
$ ss -tan                       # all TCP sockets + states, numeric
State    Recv-Q  Send-Q  Local Address:Port  Peer Address:Port
LISTEN   0       128     0.0.0.0:443         0.0.0.0:*
ESTAB    0       0       10.0.0.5:443        10.0.0.9:52344
TIME-WAIT 0      0       10.0.0.5:443        10.0.0.9:51002

$ ss -s                         # summary counts by state
$ ss -tan state time-wait | wc -l   # quantify TIME_WAIT pile-up
```

Reading these states is the fastest way to turn a vague "the server is acting up" into a specific diagnosis — a wall of SYN-RECV (flood), TIME_WAIT (port exhaustion), or CLOSE_WAIT (socket leak).

## UDP & When to Use It

### Summary

**What this topic covers**

UDP — the transport protocol that is almost the *absence* of a transport protocol. Where TCP is a thick reliability contract, UDP is a **thin wrapper over IP**: it adds ports (so multiple apps on a host can be addressed) and an optional checksum, and nothing else. No handshake, no acknowledgements, no retransmission, no ordering, no flow control, no congestion control. This topic's 15 questions cover what UDP is and isn't, the head-to-head **UDP vs TCP** comparison, **when to deliberately choose UDP** (real-time media, gaming, DNS, DHCP, NTP, SNMP), the tradeoffs you take on, **datagram semantics** (message boundaries preserved, unlike TCP's byte stream), **QUIC** (the modern UDP-based transport under HTTP/3 that rebuilds reliability in userspace and dodges TCP's head-of-line blocking), broadcast/multicast, amplification/reflection DDoS attacks, why DNS uses UDP, and how "connectionless" UDP is nonetheless tracked by NAT and firewalls. The theme: UDP isn't "worse TCP" — it's a *substrate* you build exactly the transport you need on top of.

**Mental model**

Think of UDP as **"IP with ports"** and TCP as **"a reliable stream service."** UDP hands your datagram to IP and walks away — fire-and-forget. It makes **zero promises**: the datagram may be lost, duplicated, or arrive out of order, and you'll get no notification either way. That sounds useless until you flip the framing: UDP gives you a **blank slate**. You pay for none of TCP's machinery (no handshake RTT, no head-of-line blocking, no congestion-control ramp), and in exchange you either (a) genuinely don't care about loss because stale data is worthless anyway (a video frame from 200 ms ago is useless — don't retransmit it, send the next one), or (b) you build your *own* reliability, ordering, and congestion control tuned to your application — which is exactly what QUIC does. The right question is never "is UDP reliable?" but "do I want the transport's opinions, or do I want to supply my own?" TCP has strong opinions; UDP has none.

**Key terms**

- **Connectionless** — no handshake, no per-connection state established before sending; just address and fire.
- **Datagram** — a self-contained message with preserved boundaries (one `send` = one `recv`), unlike TCP's byte stream.
- **Best-effort** — deliver if you can, drop silently if you can't; no acknowledgement.
- **Port** — 16-bit demultiplexing key so multiple apps share a host's IP.
- **Checksum** — integrity check; optional in IPv4, mandatory in IPv6.
- **QUIC** — reliable, multiplexed, encrypted transport built in userspace **over UDP**; HTTP/3's foundation.
- **Head-of-line blocking** — the ordering stall UDP avoids by having no ordering (and QUIC avoids per-stream).
- **Broadcast / multicast** — one-to-all / one-to-group delivery, only UDP can do it (TCP is strictly point-to-point).
- **Amplification / reflection attack** — spoof a victim's source IP, send a small query to a server that returns a big reply *to the victim*.
- **Stateless** — the server keeps no per-client connection state, so it scales cheaply and resists SYN-flood-style exhaustion.
- **NAT/firewall UDP tracking** — pseudo-connection state middleboxes invent (with short timeouts) to allow return datagrams.

**Why interviewers ask this**

UDP questions test whether you understand **tradeoffs**, not trivia. The junior answer is "UDP is unreliable, TCP is reliable, use TCP." The senior answer explains *when unreliability is a feature*: for real-time media, retransmitting a lost packet delivers it too late to matter, so TCP's guarantees actively *hurt* by stalling everything behind the loss. It also probes systems fluency: why does DNS start on UDP but fall back to TCP; why is UDP the darling of DDoS reflection; how does HTTP/3 get reliability *and* multiplexing over "unreliable" UDP; how does a stateless firewall handle a connectionless protocol. Getting QUIC right — that you can build TCP-grade reliability over UDP and *beat* TCP by escaping its head-of-line blocking — signals you actually understand what the transport layer is for, rather than treating TCP and UDP as a fixed either/or.

**Common confusions**

- "UDP is unreliable, so it's for unimportant data." No — it's for data where *you* control reliability (QUIC, game netcode) or where stale retransmits are worthless (live media).
- "QUIC is UDP, so HTTP/3 is unreliable." Wrong — QUIC rebuilds reliability, ordering, and congestion control in userspace; it's as reliable as TCP and avoids TCP's HOL blocking.
- "UDP has no flow/congestion control, so it's always faster." Only when the app is well-behaved; naive UDP can be *antisocial* and cause congestion collapse — you must add your own pacing.
- "UDP is connectionless so firewalls can't track it." They fake it — NAT/stateful firewalls invent short-lived pseudo-connections keyed on the 4-tuple.
- "TCP preserves message boundaries too." It doesn't — TCP is a byte stream; UDP preserves datagram boundaries (one send = one recv).
- "UDP checksums guarantee delivery." A checksum only detects corruption (and is optional in IPv4); it does nothing about loss.

**What follows from this topic**

UDP is the counterweight to the TCP deep-dive: everything TCP does for you automatically is something a UDP app must either implement or deliberately forgo, which is the cleanest way to *see* what a transport layer is. It connects forward to the HTTP topic through **QUIC and HTTP/3** — the payoff of "build your own transport over UDP" is escaping the TCP head-of-line blocking that limited HTTP/2. It connects to the DNS topic (why lookups ride UDP first) and to the routing/security topics (amplification attacks, broadcast/multicast, NAT's handling of connectionless flows). Master both TCP and UDP and you can reason about *any* protocol by asking which guarantees it needs and where those guarantees are enforced.

### Q1. What is UDP?

**UDP (User Datagram Protocol)** is a minimal, **connectionless** transport that sits directly on IP and adds almost nothing:

- **Ports** — a 16-bit source and destination port, so multiple applications on one host can be addressed independently (demultiplexing).
- **A length field and an optional checksum** — the checksum detects corruption (optional in IPv4, mandatory in IPv6).

That's essentially it. The UDP header is just **8 bytes** (vs TCP's 20+). No handshake, no acknowledgements, no sequence numbers, no retransmission, no ordering, no flow control, no congestion control. You hand UDP a datagram plus a destination, and it hands it to IP — **fire-and-forget**. The datagram may be lost, duplicated, or reordered, and the sender is never told. It is best described as **"IP with port numbers and an optional integrity check"** — a thin substrate rather than a service.

### Q2. Give me the full TCP vs UDP comparison.

| Property | TCP | UDP |
|---|---|---|
| Connection | Connection-oriented (3-way handshake) | Connectionless (just send) |
| Reliability | Guaranteed; retransmits lost data | None; best-effort, silent loss |
| Ordering | In-order delivery | No ordering |
| Duplicates | Detected/removed | Possible |
| Flow control | Yes (receive window) | No |
| Congestion control | Yes (cwnd, slow-start, AIMD) | No (app must add its own) |
| Head-of-line blocking | Yes (ordered stream) | No |
| Data model | Byte stream (no boundaries) | Datagrams (boundaries preserved) |
| Header size | 20+ bytes | 8 bytes |
| Setup latency | 1 RTT handshake before data | 0 — send immediately |
| Broadcast/multicast | No (point-to-point only) | Yes |
| Typical uses | HTTP, SSH, DBs, file transfer | DNS, DHCP, NTP, VoIP, video, gaming, QUIC |

The one-liner: **TCP trades latency and overhead for guarantees; UDP trades guarantees for latency, simplicity, and control.**

### Q3. When would you choose UDP over TCP?

Choose UDP when at least one of these holds:

- **Low latency matters more than reliability, and stale data is worthless.** Real-time **voice/video** and **online gaming**: a packet that arrives late is useless, so retransmitting it (as TCP would) only *delays* the fresh data behind it. Better to drop it and move on.
- **The exchange is tiny and a connection setup would dominate.** **DNS** queries are a single small request/response — paying a TCP handshake RTT for one packet is wasteful. Same logic for **DHCP**, **SNMP**, **NTP**.
- **You want to build your own transport.** If you need custom reliability, ordering, or congestion control tuned to your app, UDP is the blank slate to build on — this is exactly what **QUIC** does.
- **One-to-many delivery.** **Broadcast/multicast** (service discovery, streaming to many receivers) is only possible over UDP; TCP is strictly point-to-point.

Default to TCP; reach for UDP deliberately when one of the above clearly applies.

### Q4. What are the tradeoffs you take on by using UDP?

You inherit responsibility for everything TCP was doing silently:

- **No retransmission/ordering** — the application must either **tolerate** loss and reordering (live media: just skip) or **implement** its own recovery (sequence numbers, ACKs, reordering buffers). There's no free lunch — you either don't care or you rebuild it.
- **No congestion control** — this is the dangerous one. A naive UDP flood ignores network conditions and can be **antisocial**: it doesn't back off under congestion, so it can hurt itself and everyone sharing the link (congestion collapse). Well-behaved UDP apps (QUIC, WebRTC) add their *own* congestion control for this reason.
- **No flow control** — you can overrun a slow receiver.
- **Datagram size limits** — large datagrams get IP-fragmented (fragile: one lost fragment loses the whole datagram), so apps usually keep datagrams small.

The upside you get in return: no handshake latency, no head-of-line blocking, minimal overhead, and full control.

### Q5. Explain UDP datagram semantics versus TCP's byte stream.

This is a subtle but important difference. **UDP preserves message boundaries**: one `sendto()` of 100 bytes results in exactly one `recvfrom()` of 100 bytes on the other side. Datagrams are discrete, self-contained messages — the boundary is part of the semantics.

**TCP is a byte stream** with **no boundaries**: if you `write()` 100 bytes then 50 bytes, the receiver might `read()` 150 at once, or 80 then 70, or any split. TCP guarantees the *bytes* and their *order*, but not how they're chunked. So TCP applications must do their **own framing** (length prefixes, delimiters) to recover messages.

Consequence: with UDP you get natural message framing for free but must handle loss; with TCP you get reliability for free but must impose your own framing. The datagram model also means UDP has a practical **max message size** (bounded by IP; large ones fragment), whereas a TCP stream is effectively unbounded.

### Q6. What is QUIC and why does it matter?

**QUIC** is a modern, reliable, multiplexed, encrypted transport that runs **in userspace over UDP** — and it's the foundation of **HTTP/3**. It deliberately rebuilds, on top of "unreliable" UDP, everything you'd want from TCP *plus* fixes TCP's flaws:

- **Reliability + congestion control** — re-implemented in userspace, so it's as reliable as TCP.
- **Stream multiplexing without head-of-line blocking** — QUIC has independent streams with **per-stream** ordering, so a lost packet stalls only *its* stream, not all of them. This is the killer feature: it solves the TCP-level HOL blocking that hobbled HTTP/2.
- **Built-in TLS 1.3** — encryption is integral, not bolted on; the crypto and transport handshakes combine, cutting round trips.
- **0-RTT resumption** — a returning client can send data in the *first* packet, eliminating setup latency.
- **Connection migration** — a connection is identified by a connection ID, not the 4-tuple, so it survives an IP change (Wi-Fi → cellular) without reconnecting.

QUIC lives in userspace precisely *because* it's over UDP — it can evolve without waiting for OS kernels and middleboxes to update (TCP ossified because middleboxes mangle anything unfamiliar). It's the definitive proof that **"UDP" does not mean "unreliable"** — it means "you choose the guarantees."

### Q7. Why does using UDP as QUIC's base not make HTTP/3 unreliable?

Because **UDP is just the delivery substrate; QUIC supplies the reliability on top.** UDP contributes ports, a checksum, and the ability to send datagrams that middleboxes and kernels already pass through. Everything that makes a transport *reliable* — acknowledgements, retransmission, ordering, flow control, congestion control — QUIC re-implements in **userspace**, packet by packet.

The reason to build on UDP rather than TCP is twofold: (1) TCP's guarantees are **baked into the kernel and can't be changed** (you can't get per-stream ordering out of TCP — the single ordered stream *is* TCP), and (2) TCP is **ossified** — middleboxes on the internet inspect and mangle anything that doesn't look like plain old TCP, so a new TCP-based transport can't be deployed, whereas UDP passes through. So QUIC gets TCP-grade (better, actually) reliability while escaping TCP's head-of-line blocking and evolvability problems. HTTP/3 is fully reliable; it just achieves that reliability above UDP instead of via TCP.

### Q8. What are broadcast and multicast, and why are they UDP-only?

- **Broadcast** — send one datagram to **all** hosts on a subnet (e.g. `255.255.255.255` or the subnet broadcast). Used by DHCP discovery and ARP-adjacent protocols.
- **Multicast** — send one datagram to a **group** of interested hosts (a multicast group address, `224.0.0.0/4`), delivered only to subscribers. Used for service discovery (mDNS), IPTV/streaming, routing protocol updates.

These are **UDP-only** because they're fundamentally **one-to-many**, and TCP is **strictly point-to-point**: a TCP connection is a stateful handshake between exactly two endpoints, with per-connection ACKs and windows — none of which generalises to "all hosts" or "a group." You can't handshake with, or track ACKs from, an unknown set of receivers. UDP's stateless, connectionless, fire-and-forget model is the only thing that maps onto broadcast/multicast semantics.

### Q9. Are UDP checksums mandatory?

- **IPv4** — the UDP checksum is **optional**. A sender may set it to zero to skip integrity checking (historically for performance on trusted links). If present, it covers the UDP header, payload, and a pseudo-header of IP fields.
- **IPv6** — the UDP checksum is **mandatory**, because IPv6 dropped the header checksum at the IP layer, so UDP must provide the integrity check itself.

Crucially, the checksum only **detects corruption** — a receiver drops a datagram whose checksum doesn't match. It says **nothing** about delivery: it can't detect or recover a *lost* datagram, and there's no retransmission. So even with checksums on, UDP remains best-effort. If you need to know data actually arrived intact *and* in order, that's an application-layer (or QUIC-layer) responsibility, not something the checksum provides.

### Q10. Why is UDP abused for amplification/reflection DDoS attacks?

Because UDP is **connectionless and unauthenticated**, so an attacker can **spoof the source IP** with no handshake to prove identity — and some UDP services return a **much larger response than the request**. Combine those:

1. Attacker sends a small query to a public UDP server (open **DNS** resolver, **NTP**, memcached, SSDP) with the **source IP forged** to be the *victim's* address.
2. The server dutifully sends its **large** reply to the victim — who never asked.
3. Multiply across thousands of servers, and a modest attacker bandwidth is **amplified** (DNS ~50x, NTP `monlist` ~500x, memcached ~50,000x) into a flood that overwhelms the victim.

TCP can't be reflected this way: the handshake requires completing the 3-way exchange, which a spoofed source can't do (the SYN-ACK goes to the victim, not the attacker), so no data flows. Mitigations: disable open resolvers/services, **BCP38 source-address filtering** at ISPs to stop spoofing, rate-limit responses, and remove amplifying commands (NTP `monlist`).

### Q11. Why does DNS use UDP, and when does it fall back to TCP?

DNS uses **UDP by default** because a typical lookup is a **single small request and a single small response** — exactly the case where UDP shines. Paying a TCP handshake RTT (plus teardown and TIME_WAIT) for one tiny query would roughly triple the latency and load the resolver with connection state for billions of lookups. UDP's stateless fire-and-forget is ideal; if a reply is lost, the resolver just re-queries.

DNS **falls back to TCP** when:

- **The response is too large for a single UDP datagram** — historically >512 bytes, or beyond the EDNS0-negotiated size. The server sets the **truncated (TC) bit**, and the client **retries over TCP**. Common with DNSSEC (big signed responses) and large record sets.
- **Zone transfers (AXFR/IXFR)** — bulk replication between name servers is reliable, ordered, potentially huge, so it always uses **TCP**.

```bash
$ dig +tcp example.com     # force DNS over TCP
$ dig example.com          # UDP by default; watch for the TC flag on truncation
```

So DNS is the textbook "UDP first, TCP when you must" protocol.

### Q12. How do NAT and firewalls handle "connectionless" UDP?

They **fake a connection.** UDP has no handshake or teardown, so a **stateful firewall or NAT** can't watch for SYN/FIN — instead it invents a **pseudo-connection** the moment it sees an outbound datagram, keyed on the **4-tuple** (src IP:port, dst IP:port). It creates a mapping/state entry that **allows return datagrams** matching that tuple back in, then **expires the entry after a short idle timeout** (often ~30 s, far shorter than TCP's, since there's no explicit close to signal "done").

Consequences you have to design around:

- **Short idle timeouts** — a UDP flow that goes quiet gets its NAT mapping reaped, and subsequent inbound packets are dropped. Long-lived UDP sessions (VoIP, QUIC, game connections) send periodic **keep-alive** datagrams to keep the mapping warm.
- **NAT traversal is harder** — because there's no connection concept and mappings are ephemeral, peer-to-peer UDP needs techniques like **STUN/TURN/ICE** and **hole punching** to establish reachability.

So "connectionless" is true at the protocol level, but middleboxes impose a soft, timer-based notion of connection anyway.

### Q13. What does stateless simplicity buy a UDP server?

Because UDP keeps **no per-connection state**, a UDP server can be dramatically **simpler and more scalable** than a TCP one:

- **No connection bookkeeping** — no handshake to complete, no window/sequence state per client, no teardown, no TIME_WAIT. Each datagram is handled independently and forgotten.
- **Cheap fan-out** — a single socket can serve enormous numbers of clients because there's no per-client memory footprint (contrast TCP, where every connection holds buffers and state, and file-descriptor/memory limits cap concurrency).
- **Resistance to state-exhaustion attacks** — there's no half-open state to flood, so the SYN-flood style of attack (exhausting a connection backlog) doesn't apply the same way. (UDP has its *own* abuse vector — amplification — but not backlog exhaustion.)
- **Trivial restart/failover** — with no connection state to lose, a UDP server can restart or be load-balanced per-datagram without tearing down "connections."

This is why stateless request/response services (DNS, NTP) and high-fan-out telemetry (SNMP, syslog, StatsD) favour UDP — the statelessness *is* the feature.

### Q14. What are the socket-level differences between UDP and TCP programming?

The APIs diverge because one is connection-oriented and the other isn't:

```text
TCP server:  socket → bind → listen → accept → read/write per connection → close
UDP server:  socket → bind → recvfrom / sendto   (no listen, no accept)
```

- **No `listen`/`accept`** for UDP — there are no connections to accept. A single socket receives datagrams from **any** client via `recvfrom()`, which also tells you the **sender's address** so you know where to reply with `sendto()`.
- **Message vs stream calls** — UDP uses `sendto`/`recvfrom` on **whole datagrams** (boundaries preserved); TCP uses `read`/`write` on a **byte stream** and you must frame messages yourself.
- **Optional `connect()` on UDP** — you *can* `connect()` a UDP socket, but it doesn't do a handshake; it just fixes the default peer so you can use `send`/`recv` and receive ICMP port-unreachable errors back. It's a convenience, not a real connection.
- **Error visibility** — TCP surfaces errors (RST → connection reset); with UDP, a dropped datagram is usually silent (though a `connect()`ed UDP socket may deliver an ICMP-derived error).

The mental shift: TCP programming is *per-connection*; UDP programming is *per-datagram*.

### Q15. UDP has no congestion control — why is that a problem, and what do well-behaved apps do about it?

TCP's congestion control is what keeps the internet **stable and fair**: when links get congested, TCP senders back off, so shared capacity is divided reasonably and the network doesn't collapse. UDP does **none** of this — a UDP sender will happily blast at full rate regardless of loss or congestion. That's **antisocial**: an unthrottled UDP flow can (a) crowd out well-behaved TCP flows sharing the link, and (b) in aggregate contribute to **congestion collapse**, where the network is so overloaded that goodput craters.

So responsible UDP applications **implement their own congestion control** rather than rely on the transport:

- **QUIC** ships full congestion control (CUBIC/BBR-style) in userspace — it's every bit as network-friendly as TCP.
- **WebRTC / real-time media** use algorithms like Google Congestion Control (GCC) that adapt bitrate to estimated available bandwidth.
- **Game and custom protocols** add pacing and rate-limiting.

The lesson: "no congestion control" is a property of *raw* UDP, not of *systems built on* UDP. Using UDP well means either genuinely sending so little that it doesn't matter, or taking on the responsibility TCP would otherwise have handled for you.
## DNS

### Summary

**What this topic covers**

DNS — the Domain Name System — is the distributed database that turns human-friendly names (`api.acme.com`) into the IP addresses machines actually route to. It's the internet's phone book, and it's the single most common thing that "isn't the network but everyone blames the network." This topic has 17 questions spanning three concern areas: (1) the **resolution flow** — how a name becomes an IP, from your app's stub resolver out to the authoritative nameserver, and the difference between recursive and iterative queries; (2) the **data model** — the record types (A, AAAA, CNAME, MX, TXT, NS, SOA, PTR, SRV, CAA), the zone hierarchy, delegation, and the maddening "no CNAME at the apex" rule; and (3) the **operational reality** — caching and TTLs (why a change takes hours to "propagate"), the local resolution path on Linux, `dig`/`nslookup`/`host`, transport (UDP:53 with TCP fallback), privacy (DoH/DoT), DNS-based load balancing, and the failure modes (NXDOMAIN, SERVFAIL, stale cache) behind the saying "it's always DNS."

**Mental model**

Think of DNS as a **hierarchical, cached, delegated lookup**. The namespace is a tree read right-to-left: the root (`.`) delegates `.com` to the TLD nameservers, which delegate `acme.com` to Acme's authoritative nameservers, which hold the actual records. Nobody stores the whole tree — each level only knows how to point you one step down (a delegation via NS records). Your machine doesn't do this walk itself; it hands the whole job to a **recursive resolver** (your ISP's, or 8.8.8.8/1.1.1.1), which chases the referrals iteratively on your behalf and caches every answer for its TTL. So most lookups never leave the resolver's cache. The two words that trip people up: **recursive** describes a resolver that does the full walk and returns a final answer; **authoritative** describes a nameserver that owns a zone and answers from its own records. Caching is the whole reason DNS scales — and the whole reason changes are slow.

**Key terms**

- **Resolver (recursive)** — the server that does the full lookup walk and caches results; your app talks only to this.
- **Stub resolver** — the thin client library in your OS that just forwards to a recursive resolver.
- **Authoritative nameserver** — holds the real records for a zone; the source of truth.
- **Zone** — a slice of the namespace one org administers (e.g. `acme.com` and its subdomains).
- **Delegation** — a parent zone pointing to a child's nameservers via **NS** records.
- **TTL** — seconds a record may be cached; governs propagation speed.
- **A / AAAA** — name → IPv4 / IPv6 address.
- **CNAME** — alias one name to another; illegal at the zone apex.
- **MX / TXT / NS / SOA / PTR** — mail routing / arbitrary text (SPF, DKIM, verification) / delegation / zone metadata / reverse (IP → name).
- **NXDOMAIN / SERVFAIL** — "name doesn't exist" / "resolver failed to get an answer."
- **Anycast** — one IP announced from many locations; how root/public resolvers scale.

**Why interviewers ask this**

DNS is a proxy for whether you understand distributed systems, caching, and how the internet is actually glued together — and because DNS is behind a huge share of real outages. A junior explains "it turns names into IPs" and stops. A senior explains the delegation walk, knows that a CNAME can't sit at the apex (and why ALIAS/ANAME exist), can reason about why a record change didn't take effect (TTL still cached upstream), knows to lower TTL *before* a migration, and reaches for `dig +trace` instead of guessing. For SRE/backend roles this is bread-and-butter: DNS-based failover, GeoDNS, the `ndots` gotcha that makes Kubernetes DNS slow, split-horizon DNS in a VPC. The signal is whether you can diagnose "the deploy is live but users still hit the old server" in your sleep.

**Common confusions**

- "Propagation" is a myth — nothing propagates; old answers just expire from caches as their TTL runs out. You control it with TTL, not by waiting.
- Recursive vs authoritative — a nameserver can be one, the other, or (badly) both; they answer different questions.
- CNAME is not a redirect and can't coexist with other records at the same name, and never at the apex.
- A low TTL doesn't make DNS "faster" — it makes changes faster and lookups more frequent.
- Round-robin DNS is not real load balancing or failover — clients cache and DNS has no health checks.
- `nslookup` uses its own resolver logic, not your system resolver — its answers can mislead; prefer `dig`.

**What follows from this topic**

DNS is the first step of almost everything else in this primer. The "type a URL into the browser" walkthrough starts here before TCP, HTTP, and TLS. GeoDNS and round-robin connect to the **Load Balancing** topic (and its L4/L7 distinction). The transport section (UDP:53, TCP fallback) leans on **TCP/UDP**. SNI and the certificate name-match in **HTTPS & TLS** assume the hostname resolution you learned here. And the debugging mindset — cache-aware, layer-aware — is the same one you'll apply to every "the site is slow" question.

### Q1. What is DNS and why does it exist?

DNS is a globally distributed, hierarchical database that maps human-readable names to IP addresses (and other records). It exists because humans can't remember `93.184.216.34` but can remember `example.com`, and because the mapping needs to change (servers move, scale, fail over) without anyone reprinting the "phone book."

It's distributed and delegated by design: no single server holds all names. Each organisation runs authoritative nameservers for its own zone, and caching resolvers spread the read load. That's what lets it serve trillions of lookups a day with sub-second latency.

### Q2. Walk me through what happens when a name gets resolved, end to end.

Say your app looks up `api.acme.com`:

1. **Stub resolver** (OS) checks its cache and `/etc/hosts`, then forwards to the configured **recursive resolver** (`/etc/resolv.conf`).
2. Recursive resolver checks its cache. Miss → it starts the walk.
3. Asks a **root** server (`.`): "who handles `.com`?" → referral to the **TLD** nameservers.
4. Asks a **`.com` TLD** server: "who handles `acme.com`?" → referral (NS records) to Acme's **authoritative** nameservers.
5. Asks Acme's **authoritative** server: "what's the A record for `api.acme.com`?" → the answer, e.g. `A 203.0.113.10`.
6. Resolver caches the answer for its TTL and returns it to your stub resolver.

The client's query to the resolver is **recursive** ("give me the final answer"); the resolver's queries out to root/TLD/authoritative are **iterative** ("give me the answer or a referral").

```bash
dig +trace api.acme.com   # shows each hop: root -> .com -> authoritative
```

### Q3. Recursive vs iterative queries — what's the difference?

A **recursive** query asks the server to do all the work and return the final answer (or an error). Your stub resolver sends recursive queries to the recursive resolver.

An **iterative** query asks the server to answer if it can, or return a *referral* to a server closer to the answer. The recursive resolver sends iterative queries as it walks root → TLD → authoritative.

So "recursive resolver" is named for the service it provides to you, even though the walk it performs is iterative.

### Q4. Recursive resolver vs authoritative nameserver?

| | Recursive resolver | Authoritative nameserver |
|---|---|---|
| Role | Does the lookup on your behalf, caches | Owns a zone, answers from its records |
| Examples | ISP resolver, 8.8.8.8, 1.1.1.1 | Route 53, NS1, your BIND server |
| Answers | Any name (by walking) | Only names in its zones |
| Caches | Yes (that's the point) | No (it's the source of truth) |
| Flag in `dig` | `ra` (recursion available) | `aa` (authoritative answer) |

A misconfiguration classic is an "open recursive resolver" that will resolve for anyone — an amplification-attack vector.

### Q5. Explain the DNS hierarchy and delegation.

The namespace is a tree, read right-to-left:

```
.                      (root)
└── com                (TLD)
    └── acme.com       (domain / zone)
        └── api.acme.com   (subdomain / record)
```

Each level **delegates** the level below by publishing **NS** records pointing at the child's nameservers. The root delegates `.com` to Verisign's TLD servers; the TLD delegates `acme.com` to whatever nameservers Acme registered with the registrar. Delegation is what makes DNS scale — the root doesn't know about `api.acme.com`, only about who handles `.com`.

### Q6. Walk through the common DNS record types.

- **A** — name → IPv4 address.
- **AAAA** — name → IPv6 address.
- **CNAME** — alias: this name is really that name (resolve that instead). No other records may coexist; illegal at the apex.
- **MX** — mail servers for the domain, with a **priority** (lower = preferred).
- **TXT** — arbitrary text; used for SPF, DKIM, and domain-ownership verification.
- **NS** — delegation: the authoritative nameservers for a zone.
- **SOA** — "start of authority": zone metadata (primary NS, admin email, serial, refresh/retry/expire, negative-cache TTL). One per zone.
- **PTR** — reverse: IP → name (lives in the `in-addr.arpa` / `ip6.arpa` tree).
- **SRV** — service location (host + port), e.g. `_sip._tcp`.
- **CAA** — which CAs are allowed to issue certs for the domain.

### Q7. Why can't you put a CNAME at the zone apex, and what do you do instead?

The apex (`acme.com` with no subdomain) must carry an **SOA** and **NS** records. A CNAME says "I'm an alias, ignore all my other records" — which would conflict with the required SOA/NS. The DNS spec forbids a CNAME coexisting with any other record at the same name, so it's illegal at the apex.

The workaround is a provider-specific **ALIAS**/**ANAME** record (Route 53 "alias", Cloudflare "CNAME flattening"): the authoritative server resolves the target to an A/AAAA at query time and hands back the address, so from the wire it looks like a normal A record. Use it to point `acme.com` at a load balancer's DNS name.

### Q8. Explain TTL and DNS caching. Why does a change take time to "take effect"?

Every record carries a **TTL** (seconds). When a resolver caches an answer, it serves that cached copy until the TTL expires, then re-queries. Nothing "propagates" — old answers simply age out.

So if `api.acme.com` had a TTL of 3600 and you change the IP, resolvers that cached the old value keep serving it for up to an hour. That's the "propagation delay." The fix is planning: **lower the TTL** (e.g. to 60s) a day *before* a migration so caches turn over fast, cut over, then raise it back. **Negative caching** (governed by the SOA minimum) means NXDOMAIN answers are cached too — create a record and it can still return "not found" for a bit.

### Q9. Trace the local resolution path on a Linux box.

Order matters and varies by config, but typically:

1. **`/etc/hosts`** — static overrides checked first (great for testing).
2. **`/etc/nsswitch.conf`** — the `hosts:` line decides the source order (`files dns`, or `resolve` for systemd-resolved).
3. **`/etc/resolv.conf`** — which recursive resolver(s) to use, plus `search` domains and `ndots`.
4. On many distros, **systemd-resolved** sits at `127.0.0.53` and does the actual forwarding/caching.

```bash
cat /etc/resolv.conf
resolvectl status        # systemd-resolved view
getent hosts api.acme.com  # resolves the way the app does (respects nsswitch)
```

`getent` is underused — it resolves through the *system* path, unlike `dig`, so it catches `/etc/hosts` and nsswitch issues.

### Q10. What's the `ndots` gotcha in containers and Kubernetes?

`/etc/resolv.conf` has an `ndots` value (default 1, but Kubernetes sets it to **5**) plus a list of `search` domains. If a name has fewer dots than `ndots`, the resolver tries it as *relative* first — appending each search domain — before trying it as absolute.

In k8s, looking up `api.acme.com` (2 dots < 5) triggers lookups for `api.acme.com.default.svc.cluster.local`, `api.acme.com.svc.cluster.local`, etc. — several failed queries before the real one. That's extra latency and DNS load on every external call.

Fixes: use a **fully qualified name with a trailing dot** (`api.acme.com.`) to skip the search list, tune `ndots:2` via `dnsConfig`, or cache with NodeLocal DNS.

### Q11. Show me how you'd debug DNS with dig.

```bash
dig api.acme.com                 # full answer with TTLs and sections
dig +short api.acme.com          # just the IP(s)
dig @1.1.1.1 api.acme.com        # bypass local resolver, ask Cloudflare directly
dig +trace api.acme.com          # walk root -> TLD -> authoritative yourself
dig acme.com MX                  # a specific record type
dig NS acme.com                  # who's authoritative
dig -x 203.0.113.10              # reverse lookup (PTR)
dig acme.com SOA                 # zone metadata / serial
```

Comparing `dig @1.1.1.1` (fresh authoritative-ish answer) against `dig` (your cached resolver) is the fastest way to tell "the record is fixed but my resolver has a stale copy." `+trace` tells you *which* level of the hierarchy is broken.

### Q12. What transport does DNS use — UDP or TCP?

Historically **UDP port 53** for queries: small, one-shot, low overhead, and a lost packet just gets retried. DNS falls back to **TCP** when the response is too large to fit (originally >512 bytes; EDNS0 raised that) — the server sets the truncated (`TC`) bit and the client retries over TCP. **Zone transfers (AXFR/IXFR)** always use TCP because they're large and must be reliable.

Modern encrypted transports run over TCP/TLS or HTTPS (see DoT/DoH).

### Q13. What are DoH and DoT, and why do they exist?

Classic DNS is plaintext — anyone on the path can see and tamper with your lookups. Two encrypted transports fix the privacy/integrity gap:

- **DoT (DNS over TLS)** — DNS wrapped in TLS on port **853**. Easy for networks to identify (and block/allow) because it has its own port.
- **DoH (DNS over HTTPS)** — DNS carried inside HTTPS on **443**, indistinguishable from web traffic. Great for user privacy, controversial for network operators because it bypasses their local DNS policy/filtering.

Both stop on-path snooping and spoofing of *lookups*; they don't hide which site you ultimately connect to (that leaks via SNI — see the TLS topic).

### Q14. How is DNS used for load balancing, and what are its limits?

Several patterns:

- **Round-robin DNS** — return multiple A records; clients pick one (often the first). Spreads load crudely.
- **GeoDNS** — return different answers based on the client's (resolver's) location, steering users to the nearest region.
- **Weighted / latency-based** — provider returns records weighted by capacity or measured latency.

The catch is **caching and no health checks**. DNS has no idea a server is down, and clients/resolvers cache answers for the TTL, so a dead node keeps getting traffic until caches expire. Even a 60s TTL means up to a minute of errors, and some clients ignore TTLs entirely. That's why DNS is fine for *coarse* geo/traffic steering but you put a real **load balancer** (L4/L7, with health checks) behind the name for fast failover.

### Q15. What is anycast DNS and why do root servers and public resolvers use it?

**Anycast** announces the *same* IP address from many physically distributed servers via BGP; the network routes each client to the topologically nearest instance. There are 13 root server *addresses* but hundreds of physical instances worldwide, all via anycast. `8.8.8.8` and `1.1.1.1` work the same way.

Benefits: low latency (nearest node answers), massive DDoS resilience (attack traffic is spread across sites), and automatic failover (if a site drops, BGP reroutes to the next). It's why a single memorable IP can serve the whole planet.

### Q16. What's split-horizon (private) DNS?

Split-horizon DNS returns **different answers depending on who's asking**. Internal clients querying `api.acme.com` get a private RFC1918 address (`10.0.0.10`); external clients get the public one. It's implemented with separate internal/external views on the nameserver, or a cloud "private hosted zone" (Route 53) scoped to a VPC.

It keeps internal service addresses off the public internet and lets the same hostname resolve correctly inside and outside the network. A common gotcha: a laptop on VPN vs off VPN resolving the same name to different IPs and confusing everyone.

### Q17. Walk through common DNS failures and the "it's always DNS" meme.

The saying exists because DNS sits in front of everything, fails silently, and caches its failures. Common ones:

- **NXDOMAIN** — the name genuinely doesn't exist (typo, missing record, wrong zone).
- **SERVFAIL** — the resolver couldn't get a valid answer (broken authoritative server, DNSSEC validation failure, timeout).
- **Stale cache** — you changed a record but old TTLs are still cached upstream ("propagation delay").
- **Wrong/missing record** — CNAME loop, missing AAAA causing slow IPv6 fallback, wrong A after a migration.
- **Split-horizon confusion** — resolving differently on/off VPN.
- **ndots blowup** — slow lookups in k8s from search-domain expansion.

The debugging move: `dig @<authoritative>` vs `dig @<resolver>` vs `getent hosts` to localise whether it's the source of truth, the cache, or the local path. **DNSSEC** adds cryptographic signatures so resolvers can detect forged answers — but a botched key rollover causes SERVFAIL, so it's also a source of self-inflicted outages. Nine times out of ten the "network" outage is a TTL or a typo'd record.

## HTTP

### Summary

**What this topic covers**

HTTP is the request/response application protocol the web runs on — a stateless, originally text-based conversation between a client and a server, carried over TCP (and, for HTTP/3, over QUIC/UDP). This topic has 18 questions covering four concern areas: (1) the **message model** — the anatomy of a request and response, methods, status codes, and headers; (2) **semantics** — safe vs idempotent methods and why that governs retries, content negotiation, caching with ETags, and statelessness with cookies/sessions; (3) the **protocol evolution** — HTTP/1.1 keep-alive and head-of-line blocking, HTTP/2 multiplexing over one connection, and HTTP/3 over QUIC eliminating TCP-level HOL blocking; and (4) the **operational glue** — CORS, compression, connection reuse and latency, and the "what actually happens when you make an HTTP request" flow. This is the protocol you debug with `curl -v` every day.

**Mental model**

Think of HTTP as **a stateless exchange of self-describing messages**. Every request stands alone: a method (verb) + a target (URL path) + headers (metadata) + an optional body; the server replies with a status code + headers + optional body. "Stateless" means the server keeps no memory of you between requests — so any continuity (login, cart) must be carried *in* each request, via cookies or tokens. That single fact explains sessions, auth headers, and why HTTP scales horizontally (any server can handle any request). The second mental shift is that HTTP is layered on **TCP**: h1 and h2 ride TCP, so they inherit TCP's ordering guarantee — and its head-of-line blocking. Each protocol version is an attempt to move more data over fewer, better-used connections: h1 reuses a connection serially, h2 multiplexes streams over one, h3 swaps TCP for QUIC to kill the last HOL bottleneck. Everything else — methods, status codes, headers — is stable vocabulary layered on top.

**Key terms**

- **Request line** — method + path + version (`GET /users/1 HTTP/1.1`).
- **Status line** — version + status code + reason (`HTTP/1.1 200 OK`).
- **Method** — the verb: GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS.
- **Safe** — read-only, no side effects (GET, HEAD).
- **Idempotent** — repeating it has the same effect as doing it once (GET, PUT, DELETE).
- **Header** — key/value metadata (Host, Content-Type, Authorization, Cache-Control).
- **Status class** — 2xx success, 3xx redirect, 4xx client error, 5xx server error.
- **Keep-alive** — reusing one TCP connection for multiple requests.
- **Multiplexing** — many concurrent streams over one connection (h2/h3).
- **HOL blocking** — one stalled item blocking those behind it.
- **Cookie / token** — how a stateless protocol carries session identity.
- **CORS** — the browser's cross-origin request policy, enforced via preflight + headers.

**Why interviewers ask this**

HTTP is the protocol every backend and frontend engineer touches daily, so shallow knowledge shows fast. A junior knows GET and POST and that 404 means not found. A senior knows *why* PUT is idempotent and GET isn't-unsafe-to-retry-but-DELETE-is, can explain 502 vs 504 by pointing at which box failed (the upstream vs the timeout), knows what makes a request cacheable, and can trace the whole "type a URL" flow through DNS, TCP, TLS, and HTTP. The protocol-evolution questions (h1 → h2 → h3) separate people who've operated systems under load — who know that h2 solved app-layer HOL but not TCP HOL, and why h3 exists — from people who've only read the RFC titles. For SRE roles, the status-code and retry-semantics knowledge is directly load-bearing during incidents.

**Common confusions**

- "Safe and idempotent are the same" — safe implies no side effects at all; idempotent allows side effects as long as repeats don't add more.
- "POST is idempotent if I'm careful" — POST is *defined* as non-idempotent; that's why retries need idempotency keys.
- "301 and 302 are interchangeable" — 301 is permanent (cached/SEO-transferred), 302 temporary; browsers and search engines treat them very differently.
- "502 and 504 are both 'the server is down'" — 502 = bad response from upstream, 504 = upstream too slow; they point at different failures.
- "HTTP/2 removed head-of-line blocking" — only at the *application* layer; TCP-level HOL remains, which is exactly why HTTP/3 moved to QUIC.
- "HTTP is encrypted" — HTTP is plaintext; HTTPS is HTTP over TLS. Different topic.

**What follows from this topic**

HTTP sits directly on **TCP** (the handshake and keep-alive here are that topic's connections) and, over 443, inside **TLS** (the HTTPS topic). The status codes and the 502/504 distinction feed straight into **Load Balancing & Proxies** — those errors usually come *from* a reverse proxy or LB, not the origin. Caching headers connect to **CDNs**. And the "what happens when you type a URL" flow is the spine that stitches DNS, TCP, TLS, and HTTP into one story interviewers love to ask.

### Q1. What is HTTP and what are its defining characteristics?

HTTP (HyperText Transfer Protocol) is a **stateless, request/response application-layer protocol**. A client sends a request; the server sends back one response. Classic HTTP/1.x is human-readable text; HTTP/2 and /3 are binary but keep the same semantics.

The two defining traits: **stateless** (the server remembers nothing between requests — continuity is carried in cookies/tokens) and **client-initiated** (the server only speaks when spoken to; "push" mechanisms are workarounds). It runs over TCP for h1/h2 and over QUIC/UDP for h3.

### Q2. Describe the structure of an HTTP request and response.

A **request**:

```
GET /users/1 HTTP/1.1          <- request line: method, path, version
Host: api.acme.com             <- headers
Accept: application/json
Authorization: Bearer abc123
                               <- blank line
{optional body}
```

A **response**:

```
HTTP/1.1 200 OK                <- status line: version, code, reason
Content-Type: application/json <- headers
Content-Length: 27

{"id":1,"name":"alice"}        <- body
```

Both are: a start line, zero or more headers, a blank line, then an optional body. Simple enough to type by hand into `nc`.

### Q3. Walk through the HTTP methods. What's the difference between safe and idempotent?

- **GET** — retrieve; safe, idempotent.
- **HEAD** — like GET but headers only (no body); safe, idempotent.
- **POST** — create / submit; neither safe nor idempotent.
- **PUT** — replace the resource at a URL; idempotent (same result if repeated).
- **PATCH** — partial update; not guaranteed idempotent.
- **DELETE** — remove; idempotent (deleting twice leaves it deleted).
- **OPTIONS** — ask what's allowed (used by CORS preflight); safe.

**Safe** = no side effects (read-only). **Idempotent** = doing it N times has the same effect as doing it once. Safe implies idempotent, not vice versa: DELETE is idempotent but not safe.

### Q4. Why does the idempotency of a method matter for retries?

| Method | Safe | Idempotent | Safe to auto-retry? |
|---|---|---|---|
| GET / HEAD | Yes | Yes | Yes |
| PUT | No | Yes | Yes |
| DELETE | No | Yes | Yes |
| POST | No | No | No — may double-create |
| PATCH | No | Usually not | No |

When a request times out you often don't know if it succeeded. For idempotent methods you can just retry — worst case you overwrite with the same value. For **POST**, a blind retry might create two orders. That's why payment/order APIs use an **idempotency key**: the client sends a unique key, the server dedupes, and now the POST is safe to retry. Load balancers only auto-retry idempotent methods for the same reason.

### Q5. Walk me through the HTTP status code classes with the ones that matter.

- **2xx success** — 200 OK, **201 Created** (with a `Location`), **204 No Content** (success, empty body).
- **3xx redirect** — **301** moved permanently (cached, SEO weight transfers), **302/307** temporary, **304 Not Modified** (use your cached copy — a conditional-GET win).
- **4xx client error** — **400** bad request, **401** unauthenticated, **403** authenticated but forbidden, **404** not found, **409** conflict, **429** too many requests (rate limited).
- **5xx server error** — **500** internal error, **502** bad gateway, **503** service unavailable, **504** gateway timeout.

Two distinctions people miss: **401 vs 403** (who are you? vs you can't do that), and **301 vs 302** (permanent vs temporary — don't 301 something you'll move back).

### Q6. A load balancer returns 502 vs 504 — which layer failed?

Both come from a **proxy/LB acting as a gateway** to an upstream, but they mean different things:

- **502 Bad Gateway** — the proxy reached the upstream but got an **invalid or broken response** (upstream crashed mid-response, returned garbage, or refused the connection). The upstream is *broken*.
- **504 Gateway Timeout** — the proxy reached the upstream but it **didn't respond in time**. The upstream is *too slow* (or hung).

So during an incident: 502 → the app is erroring/crashing; 504 → the app is alive but slow (DB lock, saturated thread pool). They point your investigation at different failures. Contrast with **503 Service Unavailable**, which the LB itself returns when it has no healthy backends at all.

### Q7. Why is the Host header required, and what problem does it solve?

HTTP/1.0 didn't require it, but HTTP/1.1 made **Host mandatory** to enable **virtual hosting** — running many domains on one IP address. When a request arrives at `203.0.113.10`, the server needs to know whether you wanted `acme.com` or `example.com`; the TCP/IP layer only carries the IP. The `Host: acme.com` header disambiguates.

Without it, one IP could serve only one site. It's the HTTP-layer equivalent of SNI at the TLS layer (which solves the same problem for encrypted connections). A missing/wrong Host header is a common cause of unexpected 404s behind a reverse proxy.

### Q8. Explain the key HTTP headers you reach for.

- **Host** — target virtual host (required).
- **Content-Type** — the body's media type (`application/json`, `text/html`); drives parsing.
- **Content-Length** vs **Transfer-Encoding: chunked** — known-size body vs streamed body sent in chunks (size unknown up front).
- **Authorization** — credentials (`Bearer <token>`, `Basic <base64>`).
- **Accept** / **Accept-Encoding** / **Accept-Language** — content negotiation: what the client can handle.
- **User-Agent** — client identification.
- **Cache-Control** / **ETag** / **If-None-Match** / **Last-Modified** — caching and conditional requests.
- **Set-Cookie** / **Cookie** — session state.

### Q9. How does HTTP caching work with Cache-Control and ETag?

Two complementary mechanisms:

**Freshness** — `Cache-Control: max-age=3600` tells the client/CDN it may reuse the response for an hour without asking. `no-cache` means "you may store it but must revalidate every time"; `no-store` means "never store it."

**Validation** — when a cached copy expires, the client revalidates instead of re-downloading. The server sent an **ETag** (a content fingerprint) or **Last-Modified**; the client sends it back as **If-None-Match** / **If-Modified-Since**. If unchanged, the server replies **304 Not Modified** with no body — saving bandwidth.

```bash
curl -v -H 'If-None-Match: "abc123"' https://acme.com/logo.png
# -> HTTP/1.1 304 Not Modified   (body reused from cache)
```

This is the backbone of CDN and browser caching.

### Q10. HTTP is stateless — so how do sessions and logins work?

The server keeps no memory between requests, so identity must ride *in* each request. Two dominant patterns:

**Server-side sessions with cookies** — on login the server creates a session record and sends `Set-Cookie: sid=<random>`. The browser returns that cookie on every subsequent request; the server looks up the session. State lives on the server; the cookie is just a pointer.

**Stateless tokens** — the server issues a signed token (e.g. JWT) the client stores and sends in `Authorization: Bearer <token>`. The server verifies the signature without a lookup — scales better, but revocation is harder.

Cookie security flags matter: **HttpOnly** (JS can't read it — blocks XSS theft), **Secure** (HTTPS only), **SameSite** (Lax/Strict/None — controls cross-site sending, the main CSRF defence).

### Q11. What did HTTP/1.1 add over 1.0, and what were its limits?

HTTP/1.1's big addition was **persistent connections (keep-alive)** by default — reuse one TCP connection for many requests instead of a new handshake each time, saving a round trip (and, over TLS, a lot more). It also added chunked transfer encoding, the mandatory Host header, and better caching.

Its limits: requests on a connection are still **serialised** — one response must finish before the next starts. **Pipelining** (sending multiple requests without waiting) was specced but failed in practice because responses had to come back in order, causing **head-of-line blocking**, and buggy proxies mishandled it. Browsers worked around serialisation by opening **~6 parallel connections per origin** — wasteful, and it multiplies TCP slow-start.

### Q12. What problems does HTTP/2 solve and how?

HTTP/2 keeps HTTP semantics but changes the wire format:

- **Binary framing** — messages become binary frames instead of text lines, easier to parse and multiplex.
- **Multiplexing** — many concurrent **streams** interleave over **one** TCP connection. Requests no longer block each other at the application layer, and you no longer need 6 connections per origin.
- **Header compression (HPACK)** — repetitive headers (cookies, user-agent) are compressed and diffed, cutting overhead.
- **Server push** — server could proactively send resources (largely deprecated now; it rarely helped).

The catch: multiplexing solved **application-layer** HOL blocking, but everything still rides **one TCP connection**, so a single lost packet stalls *all* streams while TCP retransmits — **TCP-level head-of-line blocking**. That unsolved problem is exactly why HTTP/3 exists.

### Q13. What is HTTP/3 and what does QUIC give you?

HTTP/3 runs over **QUIC**, a transport built on **UDP** instead of TCP. It exists to kill the TCP-level head-of-line blocking that HTTP/2 couldn't.

- **No TCP HOL blocking** — QUIC implements independent streams itself; a lost packet only stalls *its* stream, not all of them.
- **Faster handshake** — QUIC folds the transport and TLS 1.3 handshakes together, so a connection is usually **1-RTT** (and **0-RTT** on resumption).
- **Connection migration** — a connection is identified by a connection ID, not the IP/port 4-tuple, so switching from Wi-Fi to cellular doesn't drop it.
- Encryption is **built in** (QUIC is always encrypted).

Cost: UDP is sometimes throttled/blocked by middleboxes, and moving congestion control into userspace uses more CPU. Clients typically try h3 and fall back to h2.

### Q14. Compare HTTP/1.1, HTTP/2, and HTTP/3.

| | HTTP/1.1 | HTTP/2 | HTTP/3 |
|---|---|---|---|
| Transport | TCP | TCP | QUIC (UDP) |
| Format | Text | Binary frames | Binary frames |
| Concurrency | 1 req/conn (serial) | Multiplexed streams | Multiplexed streams |
| App-layer HOL | Yes | Solved | Solved |
| TCP-layer HOL | Yes | **Still present** | Eliminated |
| Header compression | No | HPACK | QPACK |
| Handshake | TCP + TLS separate | TCP + TLS separate | Combined, 1-RTT/0-RTT |
| Encryption | Optional (via TLS) | Effectively required | Built in |

The through-line: each version moves more data over fewer, better-used connections and chips away at head-of-line blocking.

### Q15. What is CORS and why does the browser enforce it?

**CORS** (Cross-Origin Resource Sharing) is a browser security mechanism. By default the **same-origin policy** blocks JavaScript on `acme.com` from reading responses from a *different* origin (`api.other.com`). CORS is how a server *opts in* to allowing that.

For "non-simple" requests (custom headers, methods like PUT/DELETE), the browser first sends a **preflight** `OPTIONS` request asking "may I?"; the server answers with `Access-Control-Allow-Origin`, `-Allow-Methods`, `-Allow-Headers`. Only if those permit it does the browser send the real request and expose the response to JS.

Key point: **CORS is enforced by the browser, not the server** — it protects users, not APIs. `curl` ignores CORS entirely. So "CORS error" means the browser blocked *your JS from reading* a response the server actually returned.

### Q16. How does HTTP compression work?

The client advertises what it can decode via `Accept-Encoding: gzip, br`; the server compresses the body and marks it with `Content-Encoding: gzip` (or `br` for Brotli). The browser transparently decompresses.

**gzip** is universal and fast; **Brotli (br)** compresses text ~15-20% better and is standard for HTTPS static assets. Compression applies to text (HTML, CSS, JS, JSON) — not already-compressed formats like JPEG or video, where it wastes CPU for no gain. It's one of the cheapest latency wins for text-heavy responses.

### Q17. Walk me through exactly what happens when I make an HTTP request to a URL.

Take `curl https://api.acme.com/users/1`:

1. **DNS** — resolve `api.acme.com` to an IP (stub → recursive resolver → authoritative, cached by TTL).
2. **TCP handshake** — SYN / SYN-ACK / ACK to the IP on port 443.
3. **TLS handshake** — negotiate version/cipher, validate the certificate, derive a session key (1-2 RTT; less on resumption).
4. **Send the request** — `GET /users/1 HTTP/1.1` (or h2/h3 frames) with Host, Accept, Authorization headers.
5. **Server processing** — the request may pass through a reverse proxy / LB to an app server, which builds a response.
6. **Response** — status line, headers, body flow back; the client may reuse the connection (keep-alive) for the next request.
7. **Close or reuse** — connection kept alive for subsequent requests, or FIN-closed.

Each layer can fail distinctly (DNS NXDOMAIN, TCP timeout vs refused, TLS cert error, HTTP 4xx/5xx) — which is what makes this the ultimate diagnostic question.

### Q18. What is HTTP request smuggling, at a high level?

Request smuggling exploits **disagreement between two servers** (usually a front-end proxy and a back-end) about where one request ends and the next begins. It typically abuses the ambiguity between **Content-Length** and **Transfer-Encoding: chunked** headers: if the proxy honours one and the backend the other, an attacker can craft a body that the proxy sees as one request but the backend splits into two.

The "smuggled" second request gets prepended to the *next* user's request, enabling cache poisoning, auth bypass, or credential theft. The defence is making the whole chain parse length consistently (reject conflicting headers, prefer HTTP/2 end-to-end where framing is unambiguous). Worth knowing exists; deep exploitation is a security-specialist topic.

## HTTPS & TLS

### Summary

**What this topic covers**

TLS (Transport Layer Security — SSL's successor) is the protocol that turns plaintext HTTP into HTTPS. It provides three guarantees: **confidentiality** (encryption so eavesdroppers see nothing), **integrity** (MACs so tampering is detected), and **authentication** (certificates so you know you're really talking to `acme.com`). HTTPS is just HTTP running over TLS on port 443. This topic has 16 questions across four concern areas: (1) the **crypto foundations** — symmetric vs asymmetric encryption and why TLS uses both; (2) the **handshake** — how a connection is established, and the big TLS 1.2 → 1.3 improvement; (3) **certificates & PKI** — what a certificate is, the chain of trust, CAs, and how a client validates one; and (4) the **operational surface** — SNI, forward secrecy, mTLS, revocation, HSTS, TLS termination, and debugging cert problems with `openssl`. This is the topic behind every "your connection is not private" browser warning.

**Mental model**

Think of TLS as a **hybrid crypto system bootstrapped by certificates**. The problem: symmetric encryption is fast but needs both sides to share a secret key, and you can't send a key over a wire an attacker is watching. Asymmetric (public-key) crypto solves the bootstrap — anyone can encrypt to your public key, only your private key decrypts — but it's slow. So TLS uses **asymmetric crypto during the handshake** to authenticate the server and agree on a shared secret, then switches to a **fast symmetric session key** for the actual data. The certificate is what makes the asymmetric half trustworthy: it binds a public key to a domain name and is signed by a Certificate Authority your browser already trusts, forming a **chain of trust** from a root CA down to the site's leaf certificate. Once you internalise "asymmetric to establish trust and a key, symmetric to move bytes," the whole handshake — and why 1.3 is faster — falls into place.

**Key terms**

- **Confidentiality / integrity / authentication** — the three properties TLS provides.
- **Symmetric key** — one shared key encrypts and decrypts; fast (AES).
- **Asymmetric key pair** — public + private; used for the handshake/key exchange.
- **Session key** — the symmetric key derived per connection for bulk data.
- **Certificate (leaf)** — signed statement binding a public key to a domain.
- **CA (Certificate Authority)** — trusted issuer that signs certificates.
- **Chain of trust** — root → intermediate → leaf signature path.
- **Trust store** — the set of root CAs the OS/browser trusts.
- **SNI** — Server Name Indication: the hostname sent in the handshake so one IP serves many sites.
- **Forward secrecy** — past traffic stays safe even if the private key later leaks (via ephemeral DH).
- **mTLS** — mutual TLS: the client also presents a certificate.
- **HSTS** — header forcing browsers to always use HTTPS.

**Why interviewers ask this**

TLS is where security, networking, and operations meet, and the failures are constant (expired certs, name mismatches, broken chains). A junior says "HTTPS encrypts the connection" and stops. A senior can explain *why* both symmetric and asymmetric crypto are used, walk the handshake, describe how a browser validates a certificate (chain to a trusted root + not expired + hostname matches SAN + not revoked), and diagnose "untrusted issuer" as a missing intermediate. For backend/SRE roles the operational angle is load-bearing: where you terminate TLS (LB vs end-to-end), how mTLS secures service-to-service traffic in a zero-trust mesh, why forward secrecy matters, and how to automate renewal with Let's Encrypt so a cert never expires at 3am. It also reveals whether you understand *what SNI leaks* — a favourite senior follow-up.

**Common confusions**

- "TLS uses either symmetric or asymmetric crypto" — it uses **both**: asymmetric to bootstrap, symmetric for data.
- "SSL and TLS are the same" — SSL is the deprecated predecessor; everything today is TLS (1.2/1.3), though people still say "SSL."
- "The certificate encrypts the traffic" — the certificate *authenticates* and carries a public key; the *session key* encrypts traffic.
- "A self-signed cert is insecure" — it's cryptographically fine; it just isn't *trusted* because no CA vouches for it.
- "Forward secrecy protects future traffic" — it protects *past* traffic if the long-term key later leaks.
- "TLS hides which site I'm visiting" — the hostname leaks in plaintext via **SNI** (until ECH); TLS hides the *content*, not the destination name.

**What follows from this topic**

TLS sits directly on top of **TCP** (the handshake here happens after the TCP handshake) and underneath **HTTP** (HTTPS = HTTP-over-TLS; HTTP/3 folds TLS 1.3 into QUIC). SNI is the TLS-layer answer to the same virtual-hosting problem the Host header solves in HTTP. TLS **termination** connects straight to **Load Balancing & Proxies** — the LB usually holds the certificate and decrypts, then re-encrypts or forwards plaintext internally. And the certificate-validation logic here is what browsers run on every single HTTPS request, making it the security backbone of the whole "type a URL" flow.

### Q1. What does TLS actually provide, and what is HTTPS?

TLS gives three guarantees on a connection:

- **Confidentiality** — the data is encrypted, so on-path eavesdroppers see ciphertext only.
- **Integrity** — each record carries a MAC/AEAD tag, so tampering is detected and rejected.
- **Authentication** — the server proves its identity with a certificate, so you know you reached the real `acme.com` and not an impostor.

**HTTPS** is simply HTTP carried over a TLS connection, conventionally on port **443**. Nothing about HTTP's semantics changes — it's the same methods, headers, and status codes — they just travel inside an encrypted, authenticated channel.

### Q2. Explain symmetric vs asymmetric crypto and why TLS uses both.

| | Symmetric | Asymmetric |
|---|---|---|
| Keys | One shared secret | Public + private pair |
| Speed | Very fast | Slow (100-1000x) |
| Problem it solves | Bulk encryption | Key distribution / authentication |
| Example | AES, ChaCha20 | RSA, ECDSA, (EC)DH |

The dilemma: symmetric is fast but needs both parties to already share a key — impossible over a wire an attacker watches. Asymmetric solves that bootstrap (encrypt to a public key, only the private key decrypts) but is too slow for bulk data.

So TLS is **hybrid**: use **asymmetric** during the handshake to authenticate the server and agree on a shared secret, then derive a **symmetric session key** and encrypt all the actual traffic with that. Best of both — trustworthy setup, fast transfer.

### Q3. Walk me through the TLS 1.2 handshake.

Roughly 2 round trips before data flows:

1. **ClientHello** — client sends supported TLS versions, cipher suites, a random, and SNI (target hostname).
2. **ServerHello** — server picks a version + cipher, sends its random.
3. **Certificate** — server sends its certificate chain (leaf + intermediates).
4. **Key exchange** — with ECDHE, both sides exchange ephemeral DH parameters to agree on a shared secret (giving forward secrecy).
5. **Finished** — both derive the same session keys from the randoms + shared secret, and send an encrypted Finished to verify.
6. **Application data** — now encrypted with the symmetric session key.

The client validates the certificate (chain, expiry, hostname) before trusting anything. That's ~2 RTT of latency on top of the TCP handshake.

### Q4. What changed in TLS 1.3, and why does it matter?

TLS 1.3 is faster and safer:

- **1-RTT handshake** — the client sends its key-share guess in the ClientHello, so the server can reply with everything needed in one round trip (down from 2). Big latency win.
- **0-RTT resumption** — on a repeat visit the client can send application data in the very first flight using a pre-shared key (with a replay-safety caveat for non-idempotent requests).
- **Forward secrecy by default** — only ephemeral (EC)DHE key exchange is allowed; static-RSA key exchange is gone.
- **Pruned cipher suites** — all the weak/legacy algorithms (RC4, MD5, static RSA, CBC modes) removed, so it's misconfiguration-resistant.

Net: fewer round trips, forward secrecy always on, far fewer footguns. It's the default you want everywhere.

### Q5. What is a certificate and what's in it?

A certificate is a signed statement binding a **public key** to an **identity** (a domain name). Key fields:

- **Subject / SAN** — the domain(s) it's valid for (the **Subject Alternative Name** list is what browsers actually check; CN is legacy).
- **Public key** — the server's public key.
- **Issuer** — which CA signed it.
- **Validity** — not-before / not-after dates.
- **Signature** — the issuer's cryptographic signature over all the above.

The signature is the crux: a CA the client already trusts has vouched, "this public key really belongs to `acme.com`." Anyone can verify that signature with the CA's public key, so the cert can be sent in the clear.

### Q6. Explain the chain of trust and PKI.

Trust is anchored in **root CAs** whose certificates ship pre-installed in your OS/browser **trust store**. Roots are precious, so they don't sign server certs directly — they sign **intermediate** CA certificates, which sign the **leaf** (server) certificate:

```
Root CA  (in trust store, self-signed)
   └─ signs → Intermediate CA
                └─ signs → Leaf cert (acme.com)
```

To validate, the client walks the chain from the leaf up, verifying each signature, until it reaches a root it trusts. This is **PKI** (Public Key Infrastructure). Intermediates exist so a compromised intermediate can be revoked without invalidating the root — and so the root's private key can stay offline in a vault.

### Q7. How does a client validate a server's certificate?

Four checks, all must pass:

1. **Signature chain** — the leaf is signed by an intermediate signed by (eventually) a root in the trust store, with every signature valid.
2. **Validity dates** — current time is within not-before/not-after (expired certs are the #1 real-world failure).
3. **Hostname match** — the domain you connected to appears in the certificate's **SAN** list.
4. **Not revoked** — the cert hasn't been revoked (via CRL/OCSP/stapling).

Fail any one and the browser throws "your connection is not private." Each maps to a distinct error: untrusted issuer (chain), expired (dates), name mismatch (SAN), revoked. Knowing which check failed is how you debug fast.

### Q8. What's a Certificate Authority, and self-signed vs CA-signed?

A **CA** is an organisation trusted to verify identities and issue certificates — its root cert is in everyone's trust store. When it signs your cert, every browser transitively trusts you.

A **self-signed** certificate is signed by its own private key — no CA involved. It's cryptographically valid (encryption works fine) but **not trusted**, because nothing vouches for it, so browsers warn. Fine for internal testing or when you distribute your own CA to clients; unacceptable for the public web.

**Let's Encrypt** made CA-signed certs free and automatic via the **ACME** protocol: a client (certbot, Caddy) proves domain control by answering an HTTP or DNS challenge, gets a 90-day cert, and auto-renews. There's no longer any excuse for an expired public cert.

### Q9. What is SNI and what problem does it solve?

**Server Name Indication** is a field in the ClientHello carrying the hostname the client wants (`acme.com`). It solves virtual hosting for TLS: one IP can host many HTTPS sites, but the server must present the *right* certificate — and it needs to know which site you want *before* it can send a cert. SNI provides that hostname up front. It's the TLS-layer analogue of HTTP's Host header.

The catch: in standard TLS, SNI is sent **in plaintext**, so an eavesdropper learns which site you're visiting even though the content is encrypted — a privacy leak. **ECH (Encrypted Client Hello)**, the successor to the abandoned ESNI, encrypts the SNI to close that gap.

### Q10. What are cipher suites?

A cipher suite is the bundle of algorithms negotiated for a connection. In TLS 1.2 it names four choices, e.g. `ECDHE-RSA-AES128-GCM-SHA256`:

- **Key exchange** — ECDHE (ephemeral, gives forward secrecy).
- **Authentication** — RSA (how the server proves identity / signs).
- **Bulk cipher** — AES-128-GCM (the symmetric encryption for data).
- **MAC/PRF** — SHA256 (integrity / key derivation).

TLS 1.3 simplified this: the suite only names the symmetric cipher + hash (e.g. `TLS_AES_128_GCM_SHA256`), because key exchange is always ephemeral DH and auth is negotiated separately. Picking strong suites (AEAD ciphers, ECDHE) and disabling weak ones is core TLS hardening.

### Q11. What is forward secrecy and how is it achieved?

**Forward secrecy** (PFS) means that if the server's long-term private key is compromised *later*, an attacker still can't decrypt *past* recorded sessions. Without it, an adversary could record ciphertext today and decrypt everything retroactively the day they steal the key.

It's achieved with **ephemeral** key exchange — **ECDHE**: each session generates a fresh, throwaway Diffie-Hellman key pair to derive that session's secret, then discards it. The long-term certificate key only *signs* the exchange; it never encrypts the session secret. So there's no stored key that unlocks old traffic. TLS 1.3 mandates it; on 1.2 you enable it by preferring ECDHE suites over static-RSA.

### Q12. What is mTLS and when do you use it?

Normal TLS authenticates only the **server** to the client. **Mutual TLS (mTLS)** adds the reverse: the **client** also presents a certificate, and the server validates it. Now both ends are cryptographically identified.

The dominant use is **service-to-service authentication** in a **zero-trust** architecture — a service mesh (Istio, Linkerd) issues each workload a short-lived cert, and services only accept connections from peers with a valid mesh-issued cert. No shared secrets, no network-location trust; identity is the certificate. Also common for high-security APIs (banking, partner integrations) and admin endpoints. The cost is certificate lifecycle management for every client, which is why meshes automate issuance and rotation.

### Q13. How does certificate revocation work?

Sometimes a cert must be invalidated before it expires (private key leaked, mis-issued). Mechanisms:

- **CRL (Certificate Revocation List)** — the CA publishes a big list of revoked serials. Bulky and often stale; clients hate downloading it.
- **OCSP (Online Certificate Status Protocol)** — the client asks the CA "is this serial still valid?" in real time. Adds latency and leaks browsing to the CA, and "soft-fail" (proceed if the OCSP responder is down) undermines it.
- **OCSP stapling** — the *server* periodically fetches a signed OCSP response and staples it into the handshake, so the client gets fresh status with no extra request and no privacy leak. The practical winner.

Because revocation checking is unreliable, the industry increasingly relies on **short-lived certificates** (Let's Encrypt's 90 days, some down to days) so a compromised cert expires soon anyway.

### Q14. What is HSTS?

**HTTP Strict Transport Security** is a response header — `Strict-Transport-Security: max-age=31536000; includeSubDomains` — that tells the browser "for the next year, only ever contact this site over HTTPS." After seeing it once, the browser refuses plaintext HTTP and won't let the user click through cert warnings.

It closes the initial-request gap where a user typing `acme.com` (defaulting to HTTP) could be downgraded/intercepted before the redirect to HTTPS. For maximum protection sites can join the **HSTS preload list** baked into browsers, so even the first-ever visit is forced to HTTPS. It's a cornerstone defence against SSL-stripping downgrade attacks.

### Q15. Where do you terminate TLS — at the LB or end-to-end?

**TLS termination at the load balancer** — the LB holds the certificate, decrypts incoming HTTPS, and forwards plaintext HTTP to backends over the trusted internal network. Pros: centralised cert management, offloads crypto CPU from app servers, lets the L7 LB inspect/route on request content. Con: traffic is plaintext inside your network.

**End-to-end / TLS passthrough or re-encryption** — either the LB passes the encrypted stream straight through (L4, can't read content), or it terminates and **re-encrypts** to the backend. Needed for compliance (PCI, zero-trust) where plaintext must never touch the wire, even internally.

The trend in zero-trust environments is re-encryption or full mTLS between every hop, treating the internal network as untrusted. The decision trades operational simplicity against how much you trust your own network.

### Q16. How do you debug a TLS problem, and what are the common errors?

`openssl s_client` is the workhorse:

```bash
openssl s_client -connect acme.com:443 -servername acme.com   # -servername sends SNI
# shows the cert chain, negotiated version/cipher, and validation result

echo | openssl s_client -connect acme.com:443 2>/dev/null \
  | openssl x509 -noout -dates -subject -issuer   # expiry, subject, issuer

curl -vI https://acme.com     # -v shows the TLS handshake + cert summary
```

Common errors and their cause:

- **Certificate expired** — past not-after date; renew (automate it).
- **Name mismatch** — hostname not in the SAN list; wrong cert served or missing SAN entry.
- **Untrusted issuer / unable to verify** — usually a **missing intermediate**: the server must send leaf *and* intermediates; browsers may hide the gap by fetching intermediates, but stricter clients (curl, Java) won't.
- **Wrong chain order** — leaf must come first, then intermediates.
- **Protocol/cipher mismatch** — client and server share no acceptable version/suite (e.g. an old client against a TLS-1.3-only server).

Watch for **downgrade attacks** too — an attacker forcing a weaker protocol; HSTS and dropping legacy TLS versions defend against them.
## Application-Layer Protocols

### Summary

**What this topic covers**

Everything that rides *above* TCP and UDP — the protocols a backend engineer actually names in a design doc. The transport layer gives you a reliable byte stream (TCP) or a datagram (UDP); the application layer decides what those bytes *mean*. This topic tours the ones that come up in real systems: the real-time web trio (**WebSocket**, **Server-Sent Events**, long-polling), the RPC contenders (**gRPC**, and REST/GraphQL at the wire level), the operational plumbing (**SSH**, **NTP**, **DHCP**, **SNMP**), the messaging protocols (**SMTP/IMAP/POP3** for email, **MQTT** for IoT), file transfer (**FTP/SFTP**), and the cross-cutting ideas — well-known ports, stateful vs stateless, text vs binary, and protocol upgrade. The 15 questions move from "what port is that on" recall through "WebSocket vs SSE vs polling" design calls up to "pick a protocol for this scenario" judgement. The goal is a working map: given a problem (real-time updates, service-to-service RPC, bulk file transfer, streaming telemetry), you can name the right protocol and defend the choice.

**Mental model**

Think of the application layer as a menu, not a stack — you pick the protocol that matches the *interaction shape*, and it almost always sits on TCP (reliability) or, increasingly, UDP/QUIC (latency). Four interaction shapes cover most of it. (1) **Request/response** — client asks, server answers, connection can close: HTTP, gRPC-unary, DNS. (2) **Server push** — server sends unprompted updates: SSE (one-way), WebSocket (two-way), MQTT (pub/sub fan-out). (3) **Streaming** — a long-lived flow of many messages: gRPC streaming, WebSocket, video. (4) **Fire-and-forget / telemetry** — NTP, SNMP, syslog. The second axis is **text vs binary**: human-readable line protocols (HTTP/1.1, SMTP, FTP control) are debuggable with `telnet`/`nc` but verbose; binary protocols (gRPC/protobuf, HTTP/2 frames, DNS) are compact and fast but need tooling. When someone asks "which protocol?", answer by naming the interaction shape first, then the constraints (latency, payload size, browser support, existing infra), then the protocol.

**Key terms**

- **WebSocket** — full-duplex, persistent, bidirectional connection over a single TCP conn; opened by upgrading an HTTP request (`Upgrade: websocket`). Both sides send anytime. Chat, live dashboards, multiplayer.
- **Server-Sent Events (SSE)** — one-way server→client stream over a plain HTTP response (`text/event-stream`); auto-reconnects, carries `Last-Event-ID`. Simpler than WebSocket when you only push.
- **gRPC** — RPC framework over HTTP/2 using protobuf binary contracts; supports unary and streaming, generates typed client/server stubs. Default for internal service-to-service.
- **protobuf** — schema-defined binary serialization; the `.proto` file is the contract, codegen produces types in every language.
- **SSH** — encrypted remote shell on port 22; public-key auth; also does port forwarding (local `-L`, remote `-R`, dynamic SOCKS `-D`) and tunnels arbitrary TCP.
- **SMTP / IMAP / POP3** — send mail (SMTP, 25/587) vs retrieve mail (IMAP 143/993 keeps it on server, POP3 110/995 downloads-and-deletes).
- **NTP** — Network Time Protocol (UDP 123); keeps clocks synced; skew breaks TLS cert validity, TOTP, log correlation, and Kerberos.
- **DHCP** — auto-assigns IP/gateway/DNS via the DORA exchange (Discover, Offer, Request, Ack); UDP 67/68.
- **MQTT** — lightweight pub/sub over TCP (1883/8883) for IoT; tiny header, QoS levels, retained messages.
- **Well-known ports** — 0–1023 registered defaults (80 HTTP, 443 HTTPS, 22 SSH, 53 DNS, 25/587 SMTP, 5432 Postgres, 3306 MySQL, 6379 Redis).
- **Stateful vs stateless** — does the protocol carry per-connection context (FTP, SSH) or treat each message independently (HTTP, DNS)?
- **Protocol upgrade** — starting on HTTP then switching to a different protocol on the same connection (`101 Switching Protocols` → WebSocket; HTTP/1.1→HTTP/2 via ALPN).

**Why interviewers ask this**

Application-layer questions separate people who've only ever called `fetch()` from people who've designed a system's communication. The junior signal is naming protocols and ports. The senior signal is *choosing* — "we needed server push to thousands of browsers, so SSE over WebSocket because we only push and SSE survives proxies and reconnects for free" is a sentence that ends interviews well. Backend and SRE interviewers probe this because the wrong protocol is expensive to unwind: picking WebSocket when SSE would do saddles you with connection-state management and load-balancer stickiness; picking REST for chatty internal RPC costs you latency and type-safety that gRPC gives free. They also use it to test breadth — an engineer who knows SSH tunneling, NTP skew, and DHCP DORA has actually operated systems, not just written app code.

**Common confusions**

- "WebSocket is a totally separate protocol from HTTP" — it *starts* as an HTTP request and upgrades; it reuses port 80/443 and the same TCP connection, which is exactly why it traverses firewalls.
- "SSE and WebSocket are interchangeable" — SSE is one-way (server→client) and text-only; WebSocket is bidirectional and binary-capable. If the client rarely sends, SSE is simpler and more robust.
- "gRPC is just REST with protobuf" — gRPC needs HTTP/2, supports true bidirectional streaming, and is not natively callable from a browser without a proxy (grpc-web). Different capability envelope.
- "SFTP is FTP with SSL" — no. SFTP is a *subsystem of SSH* (port 22), unrelated to FTPS (which is FTP + TLS). Easy way to look junior.
- "POP3 and IMAP do the same thing" — POP3 downloads and typically deletes (single-device); IMAP keeps mail server-side and syncs across devices.
- "Ports are security" — a port is just a rendezvous number; running SSH on 2222 is obscurity, not protection.

**What follows from this topic**

These protocols mostly ride the transport and TLS foundations from earlier topics and get *delivered* by the infrastructure in the next ones. WebSocket and SSE push the [[load-balancing]] topic hard — long-lived connections change health-checking and stickiness. gRPC's HTTP/2 requirement is exactly why [[proxies-reverse-proxies-api-gateways]] and service meshes matter. SMTP/DNS lean on the DNS and record-type material. And "which protocol for real-time?" is the same muscle as "which caching layer" — match the tool to the interaction shape.

### Q1. What is a WebSocket and how does it differ from plain HTTP?

A **WebSocket** is a full-duplex, persistent, bidirectional channel between client and server over a *single* TCP connection. Once open, either side can send a message at any time with no request needed — unlike HTTP's strict request-then-response.

It *starts* as HTTP: the client sends a normal GET with upgrade headers, the server answers `101 Switching Protocols`, and from then on the same TCP connection speaks the WebSocket framing protocol (`ws://` / `wss://`).

```http
GET /chat HTTP/1.1
Host: example.com
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==
Sec-WebSocket-Version: 13
```
```http
HTTP/1.1 101 Switching Protocols
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Accept: s3pPLMBiTxaQ9kYGzzhZRbK+xOo=
```

Key differences from HTTP: HTTP is half-duplex and stateless (each request independent, server can't initiate); WebSocket is full-duplex and stateful (the open connection *is* the state). Reach for it when the server must push and the client must send — chat, collaborative editing, live trading, multiplayer games.

### Q2. WebSocket vs SSE vs long-polling — when do you use each?

| | Direction | Transport | Reconnect | Binary | Best for |
|---|---|---|---|---|---|
| **Long-polling** | req/resp (faked push) | HTTP | manual | yes | legacy fallback |
| **SSE** | server→client only | HTTP (`text/event-stream`) | automatic | text only | live feeds, notifications, dashboards |
| **WebSocket** | bidirectional | upgraded TCP | manual | yes | chat, games, collab editing |

**Long-polling**: client makes a request, server holds it open until it has data, then responds; client immediately re-requests. Works everywhere but is wasteful and higher-latency.

**SSE**: one long-lived HTTP response the server writes events into. The browser's `EventSource` auto-reconnects and resumes via `Last-Event-ID`. Choose it when data flows *one way* — you only push. Simpler than WebSocket, survives most proxies, no special protocol.

**WebSocket**: choose when the client also sends frequently and you need low-latency two-way. Costs you connection-state management and load-balancer stickiness.

Rule of thumb: **only pushing? SSE. Two-way chat-like? WebSocket. Stuck on ancient infra? long-poll.**

### Q3. What is Server-Sent Events (SSE) and what are its limits?

SSE is a one-way, server→client streaming protocol built on an ordinary HTTP response with `Content-Type: text/event-stream`. The server keeps the response open and appends events as text:

```
data: {"price": 42.10}

event: alert
id: 1234
data: threshold breached

```

The browser API is trivial and the reconnection is *free* — `EventSource` reconnects automatically and sends the last `id` back as `Last-Event-ID` so the server can resume.

```javascript
const es = new EventSource("/prices");
es.onmessage = (e) => console.log(e.data);
```

Limits: **one-way only** (client can't send over the same stream — it makes normal requests for that), **text only** (base64 your binary), and under **HTTP/1.1 the ~6-connections-per-domain cap** bites because each SSE stream holds a connection — HTTP/2 multiplexing fixes this. Perfect for notifications, activity feeds, live logs, progress bars, and dashboards where the server pushes and the client just watches.

### Q4. What is gRPC and why is it popular for internal service-to-service calls?

**gRPC** is an RPC framework: you define services and messages in a `.proto` file, run codegen, and call remote methods as if they were local functions with typed request/response objects. It runs over **HTTP/2** and serializes with **protobuf** (compact binary).

```proto
service UserService {
  rpc GetUser(GetUserRequest) returns (User);
  rpc StreamEvents(EventFilter) returns (stream Event);
}
message GetUserRequest { string id = 1; }
```

Why it dominates internal traffic: (1) **strong typed contracts + codegen** — the `.proto` is a single source of truth across languages; no hand-written client SDKs drifting out of sync. (2) **HTTP/2 multiplexing** — many concurrent calls over one connection, no head-of-line blocking at the app layer. (3) **binary protobuf** is smaller and faster to parse than JSON. (4) **first-class streaming** — server, client, and bidirectional. (5) **deadlines, cancellation, and metadata** are built in.

The catch: it's not natively browser-callable (needs a grpc-web proxy), and binary payloads are harder to eyeball than JSON. So gRPC east-west between services, REST/JSON north-south to browsers.

### Q5. What are the four gRPC streaming modes?

gRPC supports four call shapes, all multiplexed over one HTTP/2 connection:

- **Unary** — one request, one response. The classic RPC. `rpc Get(Req) returns (Resp)`.
- **Server streaming** — one request, a stream of responses. `rpc List(Req) returns (stream Item)`. Good for large result sets, live feeds.
- **Client streaming** — a stream of requests, one response. `rpc Upload(stream Chunk) returns (Summary)`. Good for uploads, aggregation.
- **Bidirectional streaming** — both sides stream independently over the same call. `rpc Chat(stream Msg) returns (stream Msg)`. Good for interactive, real-time exchange.

Because HTTP/2 frames interleave, a bidi stream is genuinely full-duplex — neither side waits for the other. This is the capability REST simply doesn't have without bolting on WebSocket.

### Q6. REST vs gRPC vs GraphQL — compare them at the protocol level.

Keeping it to the *wire* (API design is its own topic):

| | REST | gRPC | GraphQL |
|---|---|---|---|
| Transport | HTTP/1.1 or 2 | HTTP/2 (required) | usually HTTP/1.1, one endpoint |
| Payload | JSON (text) | protobuf (binary) | JSON (text) |
| Contract | OpenAPI (optional) | `.proto` (mandatory) | schema (mandatory) |
| Shape | resource/verb (GET/POST) | method calls | single POST, query language |
| Streaming | no (needs WS/SSE) | native, 4 modes | subscriptions (over WS) |
| Browser-native | yes | no (needs grpc-web) | yes |
| Over/under-fetch | common | n/a | client picks fields |

**REST** — ubiquitous, cacheable via HTTP semantics, human-debuggable; you often over- or under-fetch. **gRPC** — fastest and most strongly typed, best for internal service-to-service; opaque on the wire, browser-hostile. **GraphQL** — one endpoint, the client specifies exactly the fields it wants (kills over-fetching), great for aggregating many backends for varied frontends; caching and rate-limiting are harder because everything is a POST to one URL.

Rough default: **REST for public APIs, gRPC internal, GraphQL when many clients need flexible, aggregated reads.**

### Q7. Explain SSH and its port-forwarding modes.

**SSH** (Secure Shell, TCP **22**) is an encrypted channel for remote shell access, file transfer (scp/sftp), and tunneling. Auth is usually **public-key** (your public key in the server's `~/.ssh/authorized_keys`, private key stays on your laptop) — stronger than passwords and non-interactive.

Its underrated superpower is **port forwarding** — tunneling arbitrary TCP over the encrypted session:

```bash
# Local forwarding (-L): reach a remote DB through the bastion as if local
ssh -L 5432:db.internal:5432 user@bastion   # then connect to localhost:5432

# Remote forwarding (-R): expose your local port on the remote host
ssh -R 8080:localhost:3000 user@public-host  # public-host:8080 -> your :3000

# Dynamic forwarding (-D): a local SOCKS proxy tunneling everything
ssh -D 1080 user@bastion   # point your browser's SOCKS proxy at localhost:1080
```

`-L` is the everyday "reach an internal service through a bastion" move. `-R` punches out from behind NAT. `-D` gives you a general SOCKS tunnel. All of it rides one authenticated, encrypted connection on port 22.

### Q8. Walk through the email protocols — SMTP vs IMAP vs POP3.

Email splits into **sending** and **retrieving**, and that's the whole mental model.

**SMTP** (Simple Mail Transfer Protocol) — **sends** mail: client→server submission and server→server relay. Port **25** for server-to-server relay, **587** for authenticated client submission (with STARTTLS), **465** for implicit TLS. SMTP only pushes mail *toward* mailboxes; it never retrieves.

**IMAP** (143, or 993 over TLS) — **retrieves** mail while *keeping it on the server*. Folders, flags, and read/unread state sync across all your devices. This is what you want in 2026.

**POP3** (110, or 995 over TLS) — **retrieves** by downloading to one device and (by default) deleting from the server. Single-device, offline-first, largely legacy.

```bash
# STARTTLS upgrades a plaintext SMTP submission to TLS on the same port 587
openssl s_client -starttls smtp -connect smtp.example.com:587
```

Interview trap: "which protocol sends email?" → SMTP, always. IMAP/POP3 only read.

### Q9. What is FTP, and what's the difference between active and passive mode?

**FTP** (File Transfer Protocol) is an old text-based protocol that splits into **two** connections: a **control** channel (port 21, commands) and a separate **data** channel (the actual file bytes). That split is the source of all its NAT pain.

- **Active mode**: the *server* opens the data connection *back to the client* (server:20 → client's chosen port). This breaks when the client is behind NAT/firewall — the inbound connection gets blocked.
- **Passive mode (PASV)**: the *client* opens both connections *to the server*. The server says "connect to me on this high port for data," and the client dials out. NAT-friendly, so passive is the default today.

FTP is plaintext (creds and data in the clear). Prefer **SFTP** (file transfer as an SSH subsystem, port 22 — unrelated to FTP) or **FTPS** (FTP + TLS). If someone says "SFTP is FTP over SSL," correct them: SFTP is SSH; FTPS is the TLS-over-FTP one.

### Q10. Why does NTP matter, and what breaks when clocks drift?

**NTP** (Network Time Protocol, UDP **123**) keeps machine clocks synchronized to reference time sources, hierarchically organized by *stratum* (stratum 0 = atomic/GPS, stratum 1 = directly attached, and so on). It corrects skew gradually to avoid jumping the clock backward.

Clock skew is a silent, vicious class of bug because so much *assumes* synced time:

- **TLS certificate validation** fails — a cert looks "not yet valid" or "expired" if your clock is off by hours/days, breaking HTTPS.
- **TOTP / 2FA** codes are time-derived; a skewed clock rejects valid codes.
- **Kerberos** rejects tickets outside a ~5-minute window.
- **Log correlation** across services becomes impossible — you can't order events if each host's timestamps drift.
- **Token/cache expiry, JWT `exp`/`nbf`, cron jobs, distributed locks** all misfire.

When an SRE sees "certificate not valid yet" or auth failing on *one* host, `ntpq -p` / `timedatectl` to check sync is an early move.

### Q11. What is DHCP and what is the DORA exchange?

**DHCP** (Dynamic Host Configuration Protocol, UDP **67** server / **68** client) auto-configures a device joining a network — handing out an IP address, subnet mask, default gateway, and DNS servers — so nothing has to be set by hand.

A new device knows nothing, so the handshake is **DORA**:

1. **Discover** — client broadcasts "any DHCP server out there?" (it has no IP yet, so it uses 0.0.0.0 → 255.255.255.255).
2. **Offer** — a server broadcasts back "here's an IP you can lease."
3. **Request** — client broadcasts "I'll take that one" (formalizing the choice, also so other servers know they're declined).
4. **Ack** — server confirms and commits the lease (with a lease duration; the client renews later).

The lease is time-bounded, which is why an address can change. When "my container/VM got a new IP after a reboot and my hardcoded config broke," DHCP lease churn is often why — a reason servers use static IPs, reservations, or DNS names instead.

### Q12. What are SNMP and MQTT used for?

Two niche-but-common protocols worth recognizing.

**SNMP** (Simple Network Management Protocol, UDP **161/162**) — the classic way to **monitor and manage network devices** (routers, switches, printers, UPSes). A manager polls *agents* for values addressed by OIDs in a MIB (interface throughput, CPU, error counts), and devices can push **traps** (161 poll, 162 trap) on events. If a question mentions "monitoring switch/router health," SNMP is the answer.

**MQTT** (Message Queuing Telemetry Transport, TCP **1883**, TLS **8883**) — a lightweight **publish/subscribe** protocol built for IoT and constrained networks. Clients publish to *topics*; a broker fans messages out to subscribers. Its tiny fixed header (as little as 2 bytes), **QoS levels** (0 at-most-once, 1 at-least-once, 2 exactly-once), retained messages, and last-will make it ideal for thousands of flaky, low-power sensors. Reach for MQTT for telemetry/IoT fan-out; reach for a full broker (Kafka/RabbitMQ) for backend event streaming.

### Q13. Give me a quick well-known port cheat sheet.

Ports 0–1023 are the "well-known" range with registered defaults. The set worth memorizing:

| Port | Protocol | Notes |
|---|---|---|
| 20/21 | FTP | data / control |
| 22 | SSH / SFTP | remote shell, tunnels |
| 25 | SMTP | server-to-server relay |
| 53 | DNS | UDP (queries) + TCP (zone/large) |
| 80 | HTTP | |
| 110 / 995 | POP3 / POP3S | mail download |
| 123 | NTP | UDP, time sync |
| 143 / 993 | IMAP / IMAPS | mail sync |
| 443 | HTTPS | HTTP over TLS; also HTTP/3 (QUIC/UDP) |
| 587 | SMTP submission | authenticated client send, STARTTLS |
| 1883 / 8883 | MQTT | IoT pub/sub |
| 3306 | MySQL | |
| 5432 | PostgreSQL | |
| 6379 | Redis | |
| 8080 | HTTP-alt | common app/proxy default |

The ones interviewers actually ask: 80/443, 22, 53, 25/587, 3306/5432/6379. Knowing 443 also carries HTTP/3 over UDP is a nice senior tell.

### Q14. What's the difference between a stateful and a stateless protocol?

A **stateless** protocol treats every message as independent — the server keeps no per-client context between requests. **HTTP** is the canonical example: each request must carry everything needed to serve it (which is why we bolt on cookies, tokens, and sessions to *simulate* state). DNS is stateless too. Statelessness is what makes horizontal scaling and load balancing easy — any server can handle any request, so you can add servers and put a load balancer in front without stickiness.

A **stateful** protocol maintains context across messages. **FTP** remembers your current directory and auth; **SSH** holds an authenticated session; a raw **TCP** connection is stateful (sequence numbers, window). Stateful is more efficient per-exchange (no re-establishing context) but harder to scale — the connection is pinned to one server, so failover and load balancing get complicated.

This is *the* reason backend design pushes toward stateless services with an external session store (Redis): it decouples "which server" from "which user," so the [[load-balancing]] layer can spray requests anywhere.

### Q15. I need real-time updates in a web app / an RPC layer / bulk file transfer — pick a protocol for each.

Match the interaction shape to the tool:

**Real-time browser updates** — if it's one-way server push (notifications, live prices, dashboards, progress), use **SSE**: dead simple, auto-reconnect, rides normal HTTP. If the client also sends frequently (chat, collab editing, games), use **WebSocket**. Only long-poll if you're stuck on ancient infrastructure. Under the hood, HTTP/3 push semantics may also fit but SSE/WS are the standard answers.

**Internal service-to-service RPC** — **gRPC**. Typed protobuf contracts, HTTP/2 multiplexing, streaming, deadlines, and cross-language codegen. Fall back to **REST/JSON** if you need browser-callable or maximum debuggability, or **GraphQL** when many varied clients need flexible aggregated reads.

**Bulk / secure file transfer** — **SFTP** (over SSH) for interactive/scripted secure transfer; **HTTPS** (a plain PUT/GET, or S3-style presigned URLs) for programmatic uploads at scale; **rsync over SSH** for incremental sync. Avoid plain FTP — plaintext creds.

The meta-answer interviewers want: name the shape (push / RPC / transfer), state the constraint (browser? internal? size?), then commit to a protocol and defend it.

## Load Balancing

### Summary

**What this topic covers**

How you take one logical service and spread its traffic across many backend servers — for scale, availability, and zero-downtime deploys. A load balancer (LB) is the traffic cop sitting in front of your fleet. This topic covers the big fork of **Layer 4 vs Layer 7** balancing, the **algorithms** that decide which backend gets the next request (round-robin, least-connections, hashing, and friends), **health checks** that pull dead backends out of rotation, **session affinity / sticky sessions** and why they're a smell, **TLS termination vs passthrough**, the **types** of LB (hardware, software like HAProxy/nginx/Envoy, cloud ALB/NLB, DNS/global), making the **LB itself highly available** (it's an obvious single point of failure), and the operational details — connection draining, preserving the client IP with `X-Forwarded-For`, global server load balancing, and how Kubernetes Services/Ingress fit. The 16 questions run from "why do load balancers exist" up to "design a globally load-balanced, highly-available edge." Load balancing is where "make it scale" and "make it not go down" become the same conversation.

**Mental model**

A load balancer is a **level of indirection**: clients talk to one stable address (a VIP or DNS name); the LB picks a healthy backend and forwards. Everything else is a consequence of *how much the LB understands* about the traffic. At **Layer 4** it only sees TCP/UDP — IPs, ports, connections — so it's fast, protocol-agnostic, and dumb: it forwards a connection and stays out of the way. At **Layer 7** it terminates the connection, parses HTTP, and can route on path/host/header/cookie, terminate TLS, retry, and rewrite — richer, but it does more work and must understand the protocol. The second core idea is **the LB must know which backends are alive** — that's health checking — and it must **not create new single points of failure**, so the LB itself is deployed in pairs or clusters with a floating IP or anycast. The third idea: **stickiness is a tax**. Any time you pin a user to a backend you've traded even distribution and clean failover for the convenience of local state — usually a sign the service should be stateless with an external store.

**Key terms**

- **VIP (virtual IP)** — the single front-facing address clients hit; the LB owns it and fans out behind it.
- **Layer 4 LB** — balances at transport level (IP:port/connection); fast, protocol-agnostic; no visibility into HTTP. (AWS NLB.)
- **Layer 7 LB** — balances at application level; routes by URL/host/header/cookie, terminates TLS, can cache/rewrite. (AWS ALB, nginx, Envoy.)
- **Round-robin / weighted RR** — rotate through backends evenly, or biased by capacity weight.
- **Least-connections** — send to the backend with the fewest active connections; better when request durations vary.
- **IP hash / consistent hashing** — map a key (client IP, session) to a backend deterministically; gives stickiness and minimal reshuffle when the pool changes.
- **Health check** — active (LB probes a `/healthz` path) or passive (LB watches real traffic for failures) removal of bad backends.
- **Session affinity / sticky session** — pinning a client to one backend (cookie- or IP-based) so its server-local state stays reachable.
- **TLS termination** — decrypting TLS *at the LB* so it can do L7 routing; vs **passthrough** (encrypted end-to-end to the backend).
- **Connection draining** — letting in-flight requests finish before removing a backend (deploys, scale-down).
- **X-Forwarded-For** — header the LB adds to preserve the original client IP after it becomes the apparent source.
- **GSLB / GeoDNS** — global server load balancing: DNS/anycast steering users to the nearest healthy region.

**Why interviewers ask this**

Load balancing is the hinge of every "design a scalable web service" question, so it's near-universal in backend and SRE interviews. The junior signal is "put a load balancer in front and round-robin." The senior signal is knowing the *consequences*: that L7 routing needs TLS termination which makes the LB CPU-bound, that sticky sessions sabotage even distribution and make deploys ugly, that a naive health check causes *flapping* under load, that the LB is itself a SPOF you must make HA, and that connection draining is why a deploy doesn't drop requests. Interviewers also use it to test whether you think about failure: "what happens when a backend dies mid-request?" and "how do you deploy without dropping traffic?" are load-balancing questions in disguise. Getting L4-vs-L7 crisp, and knowing when you *don't* need stickiness, marks someone who's operated real systems.

**Common confusions**

- "A load balancer and a reverse proxy are different things" — heavy overlap; load balancing is *one feature* of an L7 reverse proxy. nginx/Envoy are both.
- "L7 is just better than L4" — L7 is richer but slower and must understand the protocol; L4 is the right call for raw TCP/UDP throughput, non-HTTP traffic, or when you want end-to-end TLS.
- "Sticky sessions are a good default" — they're a crutch for stateful servers; they wreck even distribution and complicate failover. Prefer stateless + shared session store.
- "Round-robin is fair" — it's fair by *count*, not by *load*; one slow request per rotation and a backend drowns. Least-connections/least-response-time handle skew better.
- "The load balancer can't fail" — it's a textbook SPOF; you need active-passive (VRRP/floating IP) or active-active/anycast.
- "The backend sees the real client IP" — after an L7 LB, the source IP is the LB's; the real client is in `X-Forwarded-For` (which you must trust correctly).

**What follows from this topic**

Load balancing sits right next to [[proxies-reverse-proxies-api-gateways]] — an L7 LB *is* a reverse proxy, and API gateways add auth/rate-limiting on top of the same machinery. It leans on the [[application-layer-protocols]] material: long-lived WebSocket/SSE/gRPC connections change how you health-check and drain, and TLS termination ties back to the TLS handshake. And it's the practical face of the stateless-vs-stateful discussion: the reason to build stateless services is so the LB can spray requests anywhere. Global load balancing (GeoDNS + anycast) previews CDNs.

### Q1. Why do load balancers exist? What do they actually buy you?

Three things, and they compound:

**Scale (horizontal).** One server has a ceiling. A load balancer lets you put *N* servers behind one address and spread traffic across them, so you scale out by adding boxes instead of buying a bigger one. The LB is what makes "just add more servers" actually work.

**Availability.** If a backend crashes, the LB's health checks pull it from rotation and traffic keeps flowing to the survivors. No single server failure takes down the service — the whole point of redundancy is wasted without something routing around the dead node.

**Zero-downtime deploys & maintenance.** You can drain and remove one backend, deploy the new version, health-check it, add it back, and repeat — rolling through the fleet with no user-visible downtime. Blue/green and canary deploys are load-balancer maneuvers.

Bonus: a central place for **TLS termination, routing, and rate limiting** (at L7). The mental model: a load balancer is the indirection layer that decouples "the service clients call" from "the servers that happen to be running right now."

### Q2. Explain Layer 4 vs Layer 7 load balancing.

The fork is **how much the LB understands about the traffic.**

| | Layer 4 | Layer 7 |
|---|---|---|
| Operates on | TCP/UDP: IP + port, connections | HTTP: URL, host, headers, cookies |
| Routing | by connection / IP:port | by path, host, header, cookie, method |
| TLS | passthrough (usually) | can terminate |
| Speed | very fast, low overhead | more work per request |
| Protocol | agnostic (any TCP/UDP) | HTTP(S)/gRPC-aware |
| Visibility | little | full request content |
| Example | AWS NLB, LVS | AWS ALB, nginx, Envoy, HAProxy(http) |

**Layer 4** forwards packets/connections based on IP and port without looking inside. It's fast, cheap, and works for *any* protocol (databases, custom TCP, non-HTTP). It preserves the connection but can't make content decisions.

**Layer 7** terminates the connection and reads the HTTP request, so it can route `/api/*` to one pool and `/static/*` to another, split by hostname, do cookie-based routing, terminate TLS, add headers, cache, and retry. Richer, but slower and protocol-specific.

Rule: **L4 when you need raw throughput, non-HTTP traffic, or end-to-end TLS; L7 when you need content-based routing or TLS termination and app-aware features.** Many stacks do both (L4 NLB → L7 nginx).

### Q3. What load-balancing algorithms are there, and when do you use each?

- **Round-robin** — rotate evenly through backends. Simple; assumes requests are roughly equal cost. Fine for uniform, stateless workloads.
- **Weighted round-robin** — bias the rotation by capacity (a 2× box gets 2× traffic). Use for heterogeneous fleets.
- **Least-connections** — send to whoever has the fewest active connections. Better when request durations vary a lot (long-lived connections, mixed cheap/expensive requests) — round-robin can pile slow requests on one node.
- **Least-response-time** — least-connections plus latency; picks the backend that's both idle *and* fast. Good under variable backend health.
- **IP hash / consistent hashing** — hash a key (client IP or session id) to a backend, deterministically. Gives stickiness without a cookie; consistent hashing minimizes reshuffling when the pool changes size (great for cache affinity).
- **Random / power-of-two-choices** — pick two at random, send to the less-loaded of the two. Nearly as good as least-connections at a fraction of the coordination cost — popular at scale.

Default to **round-robin** for uniform stateless work, **least-connections** when request cost varies, **consistent hashing** when you need cache/session locality, and **power-of-two-choices** when you want least-connections behavior without global state.

### Q4. How do health checks work, and why does a backend "flap"?

A health check is how the LB decides a backend is eligible for traffic.

**Active** — the LB proactively probes each backend (e.g. `GET /healthz` every few seconds, or a TCP connect). After N consecutive failures it marks the backend *unhealthy* and stops sending traffic; after M consecutive successes it adds it back. This is the common case.

**Passive** — the LB infers health from *real* traffic: if live requests to a backend start timing out or returning 5xx, it ejects it (outlier detection, e.g. Envoy). No synthetic probes, but slower to notice an idle-but-dead node.

**Flapping** is a backend rapidly toggling healthy↔unhealthy. Classic cause: a **shallow health check under load** — `/healthz` returns 200 as long as the process is up, but the box is actually overloaded, so probes intermittently time out. It gets ejected, load shifts to peers (overloading *them*), it recovers, gets re-added, overloads again — oscillation. Fixes: **deep-but-cheap** health endpoints (check real dependencies without being expensive), hysteresis (require several consecutive results before flipping), slow-start/ramp-up when re-adding, and separating **liveness** (is the process up?) from **readiness** (can it serve right now?).

### Q5. What are sticky sessions, and why are they usually a bad idea?

**Session affinity / sticky sessions** pin a given client to the same backend for the duration of its session, so server-*local* state (an in-memory session, a local cache) stays reachable. Two flavors: **cookie-based** (the LB sets/reads a cookie naming the backend — precise) and **IP-based** (hash the client IP — breaks when many users share a NAT IP, or one user's IP changes).

Why it's a smell:

- **Uneven load** — stickiness fights the balancing algorithm; a few heavy users can hammer one backend while others idle.
- **Ugly failover** — if the pinned backend dies, that user's session is gone; they're bounced to a fresh backend that doesn't have their state.
- **Deploy pain** — draining a sticky backend means kicking every session on it.
- **Scaling lag** — new backends get no existing sessions, so scale-out doesn't relieve the hot nodes immediately.

The better answer is **stateless services + an external session store** (Redis/Memcached/DB). Any backend can serve any request because the state lives *outside* the process. Then you don't need stickiness at all, and the LB is free to balance cleanly. Reach for stickiness only when you truly can't externalize state.

### Q6. TLS termination vs passthrough at the load balancer — what's the tradeoff?

**Termination** — the LB holds the certificates and *decrypts* TLS. From there it speaks plaintext (or re-encrypted) HTTP to backends. This is required for any **L7 feature**: you can't route by URL/header, cache, or inspect a request you can't read. Upsides: centralized cert management, offloads crypto CPU from backends, enables content routing. Downside: traffic is plaintext *inside* your network between LB and backend unless you re-encrypt.

**Passthrough** — the LB forwards the encrypted TLS stream untouched (L4); the backend terminates TLS. Upsides: true end-to-end encryption, the LB never sees plaintext (good for strict compliance), backends own their certs. Downside: the LB is blind — no L7 routing, no caching, no header inspection.

**Re-encryption (TLS bridging)** — terminate at the LB (to get L7 features) then open a *fresh* TLS connection to the backend. Best of both: content routing *and* encrypted internal hops. Costs double the crypto.

Default: **terminate (or re-encrypt) at an L7 LB** for routing + central certs; **passthrough** when end-to-end encryption is non-negotiable or the traffic isn't HTTP.

### Q7. What types of load balancers exist?

Roughly four families:

- **Hardware** — dedicated appliances (F5 BIG-IP, Citrix ADC). Very high throughput, expensive, common in on-prem enterprise/data centers. Fading as software catches up.
- **Software** — run on commodity servers: **HAProxy** (fast L4/L7 TCP+HTTP), **nginx** (reverse proxy + L7 LB + static serving), **Envoy** (modern L7, dynamic config, the data plane behind service meshes and many gateways). Flexible, cheap, the default today.
- **Cloud-managed** — AWS **ALB** (L7), **NLB** (L4), **GLB**; GCP/Azure equivalents. You don't run the box; the cloud gives you a scalable, HA endpoint. Integrates with autoscaling and health checks.
- **DNS-based / GSLB** — balance at the DNS layer by handing out different IPs (round-robin DNS, or geo/health-aware GSLB). Coarse (DNS caching/TTL limits agility) but the standard way to balance *across regions*.

In practice you layer them: GSLB/GeoDNS picks a region, a cloud L4 NLB or anycast VIP fronts each region, and an L7 proxy (nginx/Envoy/ALB) does content routing inside it.

### Q8. The load balancer is a single point of failure — how do you make it highly available?

Right — if all traffic funnels through one LB and it dies, you're fully down. You never run a single LB. Options:

**Active-passive with a floating IP (VRRP).** Two LBs share a virtual IP; the active one owns it. A protocol like **VRRP/keepalived** heartbeats between them, and if the active dies the passive *takes over the VIP* (gratuitous ARP) within seconds. Simple, common on-prem.

**Active-active.** Multiple LBs all serving, traffic spread across them (often by upstream DNS or an L4 layer). Better resource use and no idle standby, but the LBs must share/replicate any state (e.g. sticky tables).

**Anycast.** The same IP is advertised from multiple locations via BGP; the network routes each client to the nearest/healthy instance. If one drops out of BGP, traffic reroutes automatically. This is how global edges and DNS (and cloud global LBs) achieve HA and locality at once.

**Cloud-managed LBs** hide all this — an AWS ALB/NLB is *already* a horizontally-scaled, multi-AZ HA service; you get the property for free.

The principle: push the redundancy up a level. Whatever fronts the LB (DNS, anycast, VRRP) must survive the LB dying.

### Q9. What is connection draining and why does it matter for deploys?

**Connection draining** (a.k.a. graceful backend removal / deregistration delay) means: when you take a backend out of rotation, the LB **stops sending it new** connections but lets **existing in-flight** requests finish (up to a timeout) before actually killing it.

Without it, a deploy or scale-down is brutal: you yank a backend and every request it was mid-serving gets a reset/500. Users see errors on every rollout.

With it, a rolling deploy is clean:

1. Mark backend "draining" — LB routes new traffic elsewhere.
2. Wait for its active requests to complete (or hit the drain timeout, e.g. 30s).
3. Now it's idle — stop the process, deploy, restart.
4. Health-check the new version, add it back to rotation.
5. Move to the next backend.

This is why "zero-downtime deploy" is really a load-balancer feature. It matters extra for **long-lived connections** (WebSocket, SSE, gRPC streams, big downloads) — the drain timeout must be long enough, or you cut them off anyway; sometimes you actively signal clients to reconnect. Kubernetes ties this to the pod `preStop` hook + readiness gate for the same reason.

### Q10. After an L7 load balancer, the backend sees the LB's IP, not the client's. How do you preserve the real client IP?

Correct — once an L7 LB terminates the connection and opens a new one to the backend, the backend's view of the *source IP* is the **LB**, not the user. That breaks logging, geo, rate-limiting, and allow-lists that key on client IP.

**HTTP: `X-Forwarded-For`.** The LB adds a header recording the original client IP (and appends to it through each hop): `X-Forwarded-For: 203.0.113.7, 10.0.0.5`. The app reads the *leftmost* client-supplied value it trusts. The modern standardized version is the `Forwarded:` header. Related: `X-Forwarded-Proto` (was it HTTPS?) and `X-Forwarded-Host`.

**The trust problem:** clients can *spoof* `X-Forwarded-For`, so your app must only trust it from *known* proxies — configure trusted proxy ranges and take the correct hop, or an attacker forges their apparent IP to bypass IP rate limits/allow-lists.

**L4 / non-HTTP: the PROXY protocol.** An L4 LB can't add HTTP headers, so it prepends a small **PROXY protocol** header to the TCP stream carrying the original src/dst IP:port; the backend (nginx/HAProxy/Envoy) parses it. This is how you keep the client IP through a TCP passthrough LB.

**Or: L4 with DSR/source-IP preservation** keeps the original source intact by not rewriting it — but that constrains topology.

### Q11. What is global server load balancing (GSLB)?

**GSLB** balances traffic across *multiple geographic regions/data centers*, not just servers within one. Two mechanisms:

**GeoDNS.** The authoritative DNS server answers the *same* hostname with *different* IPs depending on where the resolver is and which regions are healthy — send a European user to the Frankfurt VIP, a US user to Virginia. It's health- and latency-aware DNS. Coarse-grained because DNS caching/TTL limits how fast you can shift traffic (clients cache the answer for the TTL), so failover isn't instant.

**Anycast.** The *same* IP is announced from many locations via BGP; the internet's routing naturally sends each client to the topologically nearest instance, and withdrawing a route reroutes traffic automatically. Faster failover than DNS, used by CDNs and global DNS.

Typical layering: **GeoDNS/anycast** picks the region → a **regional L4 LB** fronts that region → an **L7 proxy** does content routing inside it → backends. GSLB gives you **lower latency** (users hit the nearest region), **disaster recovery** (a whole region can fail out), and **capacity spreading** across regions. It previews CDNs, which are GSLB + edge caching taken to the extreme.

### Q12. What is consistent hashing (and Maglev), and why do load balancers use it?

**Plain hashing** — `backend = hash(key) % N` — maps a key (client IP, session, cache key) deterministically to one of N backends, giving stickiness/locality without a cookie. The problem: when N changes (a backend added/removed), `% N` remaps *almost every* key, blowing away cache locality and stickiness for everyone.

**Consistent hashing** fixes this. Place backends and keys on a hash *ring*; a key goes to the next backend clockwise. Adding/removing a backend only reassigns the keys in *its* arc — roughly `1/N` of keys move, not all of them. **Virtual nodes** (each backend placed at many ring points) smooth out uneven distribution.

**Why LBs use it:** when you want **session or cache affinity** that survives fleet changes — e.g. routing a user consistently to the backend that has their cache warm, or sharding by user id, without a full reshuffle every scale event.

**Maglev** (Google's) is a consistent-hashing scheme tuned for LBs: it builds a lookup table that spreads keys very evenly *and* minimizes disruption when backends change, at line rate. It's the basis of several cloud L4 LBs. The one-liner: **consistent hashing = stickiness + locality that doesn't collapse when you scale.**

### Q13. How is a load balancer different from a reverse proxy?

Mostly overlap — the honest answer is "load balancing is *one feature* of an L7 reverse proxy."

A **reverse proxy** is a server-side intermediary that fronts backends and can do many things: TLS termination, caching, compression, request routing, header rewriting, static serving, rate limiting, and — yes — **load balancing** across a pool. nginx, HAProxy, and Envoy are reverse proxies that *include* load balancing.

A **load balancer**, in the narrow sense, is specifically the "distribute requests across N backends" function. A pure **L4** load balancer (AWS NLB, LVS) is *not* really a reverse proxy — it forwards connections at the transport layer without understanding or rewriting the application traffic. An **L7** load balancer, by contrast, *is* a reverse proxy, because to balance HTTP intelligently it must terminate and read the request.

So: **all L7 load balancers are reverse proxies; not all reverse proxies emphasize load balancing; and L4 load balancers are a separate, lower-level thing.** In interviews, say "an L7 LB and a reverse proxy are largely the same box; the difference is which feature you're emphasizing," and you'll sound right. More on the proxy side in [[proxies-reverse-proxies-api-gateways]].

### Q14. How do Kubernetes Services and Ingress relate to load balancing?

Kubernetes has load balancing baked in at two levels.

**Service (L4).** A `Service` gives a stable virtual IP + DNS name for a set of ephemeral pods (selected by label). `kube-proxy` (via iptables/IPVS/eBPF) load-balances connections across the healthy pod endpoints — a built-in **L4** balancer. `ClusterIP` is internal-only; `NodePort` exposes a port on every node; `type: LoadBalancer` asks the cloud to provision an external L4 LB (NLB) pointing at the nodes.

**Ingress / Gateway API (L7).** A `Service` can't do host/path routing or TLS termination. An **Ingress** (implemented by an ingress controller — nginx, Envoy, Traefik, or a cloud ALB) is the **L7** layer: it terminates TLS and routes `example.com/api` → service A, `example.com/app` → service B. The newer **Gateway API** is the more expressive successor.

So the typical path is: **cloud L4 LB → ingress controller (L7 reverse proxy) → Service (L4 across pods) → pod**. Readiness probes feed the health-checking, and pod `preStop` + endpoint removal give you connection draining. It's the same L4/L7 layering from this whole topic, just expressed in Kubernetes objects.

### Q15. Round-robin is spreading requests evenly by count, but one backend is overloaded and its p99 is spiking. What's going on and what do you change?

Round-robin is fair by **request count, not by load**. If request cost varies — some hit a slow query, hold a connection open, or do heavy work — even distribution *by count* still piles disproportionate *work* on whichever backend happened to catch the expensive ones. A backend nursing three long-running requests still gets its 1/N share of new ones and drowns; its queue grows, p99 climbs.

Diagnose: check whether request durations are skewed (mix of cheap and expensive endpoints, long-lived connections, or one slow backend/AZ), and whether connections are long-lived (WebSocket/gRPC/keep-alive) — round-robin distributes *new* connections, so if connections are sticky and long, load drifts as some persist and others churn.

Fixes, in order:
- Switch to **least-connections** or **least-response-time** so the LB accounts for how busy each backend actually is.
- If it's persistent connections, prefer least-connections (count reflects real load) or periodically rebalance.
- **power-of-two-choices** as a cheap, scalable alternative to global least-connections.
- If one backend is genuinely weaker/degraded, **weighted** RR or let health checks (outlier detection) eject it.
- Separately, ensure the slow endpoint isn't a shared-dependency problem (DB, downstream) that no algorithm fixes.

The lesson: round-robin assumes uniform cost. The moment cost varies, move to a **load-aware** algorithm.

### Q16. Design the load-balancing tier for a high-traffic, globally-available web service. Walk me through it.

I'd layer it from the edge inward, adding redundancy at every level so nothing is a SPOF.

**Global (steer to a region).** GeoDNS or **anycast** resolves the hostname to the nearest healthy region — European users to EU, US to us-east — with health-aware failover so a dead region drops out. This is GSLB: latency + disaster recovery.

**Regional edge (L4, HA).** Each region has a highly-available L4 entry point — a cloud **NLB** or an anycast VIP fronted by paired LBs with **VRRP/floating IP** (active-passive) or active-active. This is fast, protocol-agnostic, absorbs volume, and is itself redundant across AZs.

**L7 routing.** Behind the L4 layer, an **L7 reverse proxy** (Envoy/nginx/ALB) **terminates TLS** (central certs, offload crypto), routes by host/path (`/api`, `/static`, per-service), does rate limiting, adds `X-Forwarded-For`, and can re-encrypt to backends. Choose **least-connections** (request cost varies) with health checks (deep-but-cheap `/ready`, hysteresis to avoid flapping).

**Backends: stateless.** Services hold no local session state — sessions live in **Redis/DB** — so I need *no* sticky sessions and the L7 tier balances cleanly. Autoscaling adds/removes pods; **connection draining** + readiness gates make deploys and scale-down zero-downtime.

**Cross-cutting:** static/cacheable content served from a **CDN** in front of all this; health checks and outlier detection at each tier; observability on the LBs (p99, backend health, error rates). The through-line: **redundancy at every layer, stateless backends so balancing is free, and match the algorithm to the traffic.**

## Proxies, Reverse Proxies & API Gateways

### Summary

**What this topic covers**

The family of *intermediaries* that sit between clients and servers and forward requests — and the crucial distinction of *which side* they sit on. A **forward proxy** sits in front of clients (egress control, corporate filtering, caching, anonymity); a **reverse proxy** sits in front of servers and is the workhorse of web infrastructure (TLS termination, load balancing, caching, routing, security). On top of the reverse proxy this topic builds the **API gateway** (an L7 reverse proxy specialized for APIs — auth, rate limiting, request transformation, composition, versioning) and the **sidecar proxy / service mesh** (Envoy sidecars giving mTLS, retries, and circuit-breaking to service-to-service traffic). It covers the tooling (nginx, HAProxy, **Envoy**, Caddy, Traefik, Kong), the overlap between a reverse proxy and a load balancer, header handling (`X-Forwarded-For` / `Forwarded` and trusting them), the PROXY protocol, SSL bridging vs offloading, transparent vs explicit proxies, HTTP `CONNECT` tunneling, and how a request threads through *multiple* proxies (CDN → LB → reverse proxy → app). The 15 questions run from "what's a proxy" to "design the edge of a web service." This is where you show you understand the shape of modern web infrastructure.

**Mental model**

Every proxy is a **man-in-the-middle you *want*** — an intermediary that terminates one connection and originates another, giving it a place to add value (cache, encrypt, route, filter, authorize). The single most important axis is **which side it serves**: a **forward** proxy acts on behalf of *clients* (the client is configured to use it; it controls/observes outbound traffic), while a **reverse** proxy acts on behalf of *servers* (clients have no idea it exists; it fronts a fleet and shapes inbound traffic). Everything else is specialization along a ladder of increasing application-awareness: a plain reverse proxy does TLS/caching/routing; an **API gateway** is a reverse proxy that also knows about *APIs* (auth, quotas, transformation, composition); a **service mesh** pushes a tiny reverse proxy (Envoy) *next to every service* as a sidecar so even internal calls get mTLS, retries, and observability. The recurring question is "north-south vs east-west": gateways guard traffic entering the system; sidecars govern traffic *between* services inside it.

**Key terms**

- **Proxy** — an intermediary that forwards requests between client and server, terminating one side and originating the other.
- **Forward proxy** — client-side intermediary; the client is configured to route through it (egress filtering, caching, anonymity, corporate control).
- **Reverse proxy** — server-side intermediary; transparent to clients; fronts backend servers (nginx/HAProxy/Envoy/Caddy/Traefik).
- **API gateway** — an L7 reverse proxy specialized for APIs: auth/authz, rate limiting/quotas, transformation, routing, aggregation, versioning (Kong, Apigee, AWS API Gateway).
- **Service mesh** — sidecar proxies (Envoy) beside every service handling east-west traffic: mTLS, retries, circuit-breaking, observability (Istio, Linkerd).
- **Sidecar** — a proxy deployed alongside an app instance that transparently intercepts its network traffic.
- **North-south vs east-west** — traffic entering/leaving the system (gateway) vs traffic between internal services (mesh).
- **TLS offloading vs bridging** — terminate TLS at the proxy and go plaintext to backends (offload) vs re-encrypt to backends (bridge).
- **X-Forwarded-For / Forwarded** — headers preserving the original client IP/protocol/host across proxy hops.
- **PROXY protocol** — an L4 preamble carrying original src/dst so client IP survives a TCP-level proxy.
- **Transparent vs explicit proxy** — client unaware (traffic intercepted) vs client configured to use the proxy.
- **HTTP CONNECT** — the method that asks a proxy to open a raw TCP tunnel (used for HTTPS through a forward proxy).

**Why interviewers ask this**

Proxies are the connective tissue of every real system, so "design the edge of a web service" is a staple. The junior signal is "nginx serves my site." The senior signal is *reasoning about the roles*: knowing that a reverse proxy hides backend topology and terminates TLS so backends don't have to, that an API gateway is where you put cross-cutting API concerns (auth, rate limiting) so services don't each reinvent them, and that a service mesh trades real operational complexity for uniform mTLS and resilience — and knowing when that complexity *isn't* worth it. Interviewers also probe the gotchas that cause production incidents: trusting `X-Forwarded-For` from untrusted hops (an auth-bypass/IP-spoof vector), losing the client IP through an L4 hop, and the request path through *layers* of proxies. Getting forward-vs-reverse crisp and placing the API gateway vs mesh correctly marks someone who's seen production infrastructure.

**Common confusions**

- "Forward and reverse proxy are basically the same" — the *direction* is the whole point: forward serves clients (client configured), reverse serves servers (client oblivious).
- "A reverse proxy and a load balancer are different products" — huge overlap; load balancing is one feature of an L7 reverse proxy. nginx/Envoy are both.
- "An API gateway is just an LB with auth" — it's an L7 reverse proxy specialized for APIs: auth, quotas, transformation, composition, versioning, per-route policy — richer than balancing.
- "A service mesh replaces your API gateway" — no: gateway = north-south (edge), mesh = east-west (service-to-service). They compose.
- "TLS termination and offloading are always safe" — after offload, traffic is plaintext internally unless you re-encrypt (bridge); in zero-trust networks that matters.
- "The backend always sees the real client IP" — through proxies it sees the proxy's IP; you rely on `X-Forwarded-For`/PROXY protocol, which you must *trust correctly* or you enable spoofing.

**What follows from this topic**

This is the sibling of [[load-balancing]] — an L7 load balancer *is* a reverse proxy, and the two topics describe the same boxes from different angles. It's where the [[application-layer-protocols]] choices get *enforced*: gRPC's HTTP/2 needs a proxy that speaks it, WebSocket/SSE need proxies that don't buffer or time out long connections, and TLS termination ties back to the TLS handshake. Caching reverse proxies preview CDNs, and the service-mesh/mTLS material connects to zero-trust security. If you can draw the path CDN → LB → reverse proxy/gateway → service (+ sidecars), you've assembled the edge of a modern system.

### Q1. What is a proxy, and what's the difference between a forward and a reverse proxy?

A **proxy** is an intermediary that forwards requests between a client and a server — it terminates one connection and originates another, which gives it a place to add caching, filtering, encryption, or routing.

The defining question is **which side it serves.**

A **forward proxy** sits in front of *clients* and acts on their behalf. The client is *configured* to send traffic through it. Uses: corporate egress filtering ("block social media, log all outbound"), caching shared downloads, anonymity (the destination sees the proxy's IP, not the user's), and reaching the internet from a locked-down network. It knows about the *clients*; the destination servers are arbitrary.

A **reverse proxy** sits in front of *servers* and acts on their behalf. Clients have *no idea* it's there — they think they're talking to the real server. Uses: TLS termination, load balancing, caching, request routing, hiding backend topology, security. It knows about the *backends*; the clients are arbitrary.

```
Forward:  client → [forward proxy] → internet (proxy serves the client)
Reverse:  internet → [reverse proxy] → backends   (proxy serves the servers)
```

Same mechanism (forward a request), opposite side. "Forward = for clients, reverse = for servers" is the one-liner.

### Q2. What does a reverse proxy actually do? Name its jobs.

A reverse proxy fronts your backends and centralizes cross-cutting concerns so the app servers don't each reinvent them:

- **TLS termination** — hold the certs, decrypt HTTPS once, speak plaintext (or re-encrypt) to backends. Offloads crypto and centralizes cert management.
- **Load balancing** — spread requests across a backend pool (this is the L7-LB overlap).
- **Caching** — serve cacheable responses without hitting the origin.
- **Compression** — gzip/brotli responses at the edge.
- **Request routing** — route by host/path/header to different services (`/api`→A, `/img`→B).
- **Rate limiting / security / WAF** — throttle abusers, block bad requests, filter attacks before they reach the app.
- **Hiding backend topology** — clients see one address; you can move/scale/replace backends freely.
- **Serving static content** — files straight from the proxy, sparing the app.
- **Buffering slow clients** — absorb slow uploads/downloads so backend workers aren't tied up (the "slowloris" mitigation).
- **Header manipulation** — add `X-Forwarded-For`, security headers, etc.

The tools: **nginx** (the ubiquitous default), **HAProxy** (TCP+HTTP, very fast), **Envoy** (modern, dynamic config, the mesh/gateway data plane), **Caddy** (automatic HTTPS), **Traefik** (container-native, auto service discovery). The mental model: it's the **front door** where all edge concerns live.

### Q3. What's the difference between a reverse proxy and a load balancer?

Mostly overlap — **load balancing is one feature of an L7 reverse proxy.**

A **load balancer's** narrow job is distributing requests across N backends for scale and availability. A pure **L4** LB (AWS NLB) does this at the transport layer without reading the request — that one is *not* really a reverse proxy.

A **reverse proxy** is broader: TLS termination, caching, routing, compression, security, static serving — *and* load balancing. An **L7** load balancer (nginx, Envoy, ALB) is doing this by terminating and reading HTTP, so it *is* a reverse proxy.

So: an **L7 LB and a reverse proxy are essentially the same box** — you just emphasize the "distribute across backends" feature when you call it a load balancer, and the "front-door for all edge concerns" role when you call it a reverse proxy. An **L4 LB** is the separate, lower-level thing that isn't a reverse proxy. In an interview: "they overlap heavily; the LB is the balancing function, and an L7 reverse proxy includes that plus TLS/caching/routing." See [[load-balancing]] for the LB angle.

### Q4. What is an API gateway and what does it add over a plain reverse proxy?

An **API gateway** is an **L7 reverse proxy specialized for APIs.** It's the single entry point for all API clients, and it centralizes the cross-cutting concerns every API needs so the individual microservices don't each rebuild them:

- **AuthN / AuthZ** — validate JWTs/API keys/OAuth once at the edge; services trust the gateway.
- **Rate limiting & quotas** — per-client/per-plan throttling and usage limits.
- **Request/response transformation** — rewrite paths, headers, payloads; adapt legacy backends to a clean external API.
- **Routing to microservices** — map external routes to the right internal service.
- **API composition / aggregation** — fan one client request out to several services and stitch the responses (reduce chatty round-trips from mobile).
- **Versioning** — route `/v1` and `/v2` to different backends.
- **Observability** — centralized metrics, logging, tracing, analytics per API/consumer.

Over a plain reverse proxy, the gateway adds the **API-aware policy layer** — auth, quotas, per-consumer plans, developer portals, transformation. Tools: **Kong**, **Apigee**, **AWS API Gateway**, and Envoy-based gateways. The one-liner: **a reverse proxy that understands *APIs and their consumers*, so services stay thin and focus on business logic.**

### Q5. How does an API gateway relate to a service mesh?

They handle *different traffic directions* and compose rather than compete.

**API gateway = north-south.** It governs traffic entering (and leaving) the system at the *edge* — external clients → your services. Auth, rate limiting, the public API contract, quotas. One central chokepoint at the boundary.

**Service mesh = east-west.** It governs traffic *between* your internal services. Instead of a central box, it deploys a small proxy (**Envoy**) as a **sidecar** next to *every* service instance, transparently intercepting all its inbound/outbound calls. That gives every service-to-service hop uniform **mTLS**, **retries**, **timeouts**, **circuit-breaking**, **traffic-splitting** (canary), and **observability** — without app code changes. Istio and Linkerd are the common ones.

```
external → [API gateway]  (north-south, edge)
                 ↓
   serviceA[sidecar] ⇄ serviceB[sidecar]  (east-west, mesh)
```

They layer: the gateway is the front door; the mesh is the internal nervous system. Some setups use an Envoy-based gateway as the mesh's *ingress gateway*, unifying the data plane. But conceptually: **gateway guards the perimeter; mesh governs the interior.**

### Q6. Explain the sidecar proxy / service mesh model — and when is it not worth it?

A **service mesh** solves a real problem: in a big microservices system, every service needs mTLS, retries, timeouts, circuit-breaking, and tracing on its calls — and you *don't* want that logic re-implemented in every language/service. So the mesh moves it *out* of the app and into a **sidecar proxy** (usually **Envoy**) deployed next to each service instance. All the service's network traffic is transparently routed through its sidecar; the sidecars form the **data plane**, and a **control plane** (Istio, Linkerd) configures them centrally.

What you get, uniformly and language-agnostically: **automatic mTLS** between services (encryption + identity), **retries/timeouts/circuit-breaking** (resilience), **traffic shaping** (canary, blue/green, mirroring), and rich **observability** (golden metrics + distributed traces for free).

**When it's *not* worth it:** the complexity is substantial — a proxy per pod (latency + memory + CPU overhead), a control plane to run and upgrade, and a steep operational learning curve. If you have a handful of services, a monolith, or a small team, the mesh is usually *over-engineering* — you can get mTLS from the platform and resilience from a client library. Reach for a mesh when you have *many* services in *multiple languages* and genuinely need uniform, centrally-controlled mTLS/resilience/observability. Otherwise the sidecar tax outweighs the benefit.

### Q7. What are caching proxies and CDNs (at a high level)?

A **caching proxy** stores copies of responses so repeated requests are served without hitting the origin — cutting latency, origin load, and bandwidth. A **forward** caching proxy caches on the *client* side (a corporate proxy caching common downloads for all employees); a **reverse** caching proxy caches on the *server* side (nginx/Varnish caching origin responses for all users). Cacheability is driven by HTTP semantics — `Cache-Control`, `ETag`, `Expires`, `Vary`.

A **CDN** (Content Delivery Network) is a caching reverse proxy taken global: a fleet of **edge** servers spread worldwide, fronted by **anycast** so each user hits the nearest one. It caches static assets (and increasingly dynamic/edge-computed content) close to users, so:

- **Latency** drops — content is served from a nearby edge, not a distant origin (the speed-of-light floor matters).
- **Origin load** drops — most requests never reach it.
- **Scale/resilience** — the edge absorbs traffic spikes and DDoS, and shields the origin.

CDNs (Cloudflare, Fastly, CloudFront, Akamai) sit at the very front of the request path and also do TLS termination, compression, and WAF at the edge. They're the outermost layer in "CDN → LB → reverse proxy → app," and a natural extension of the caching-reverse-proxy idea to global scale.

### Q8. Transparent vs explicit proxies — what's the difference?

The difference is **whether the client knows it's using a proxy.**

**Explicit proxy** — the client is *configured* to use it (proxy settings in the OS/browser, `HTTP_PROXY` env var, a PAC file). The client deliberately sends requests to the proxy. Common for forward proxies: corporate outbound gateways where every browser is set to `proxy.corp:3128`.

**Transparent (intercepting) proxy** — the client is *unaware*; its traffic is silently redirected to the proxy by the network (routing/NAT/WCCP), with no client config. The client thinks it's talking directly to the destination. ISPs and captive portals use these to cache or filter without touching client settings.

Trade-off: **explicit** requires configuring every client (painful at scale, but honest and predictable) and clients *can* bypass it; **transparent** requires no client changes (great for enforcement) but is harder to debug (traffic is being rerouted invisibly) and struggles with HTTPS — intercepting TLS transparently means either a `CONNECT` tunnel (no inspection) or a MITM cert deployed to every client (invasive). Reverse proxies are, from the client's view, inherently "transparent" — the client just sees a normal server.

### Q9. How do X-Forwarded-For / Forwarded headers work, and why is trusting them a security issue?

When a request passes through a proxy, the backend's TCP source IP becomes the *proxy's* IP, not the client's. To preserve the origin, proxies add forwarding headers:

- **`X-Forwarded-For`** — a comma-separated chain of client IPs, appended at each hop: `X-Forwarded-For: 203.0.113.9, 10.0.0.4` (leftmost = original client).
- **`X-Forwarded-Proto`** — the original scheme (`https`), so an app behind a TLS-terminating proxy knows the client used HTTPS.
- **`X-Forwarded-Host`** — the original `Host`.
- **`Forwarded`** — the standardized (RFC 7239) single header combining these: `Forwarded: for=203.0.113.9;proto=https;host=example.com`.

**The security problem:** these are just *HTTP headers a client can set*. If your app blindly reads `X-Forwarded-For` to get "the client IP," an attacker sends `X-Forwarded-For: 127.0.0.1` (or any IP) to **spoof** their apparent address — bypassing IP allow-lists, IP-based rate limits, or geo rules, and poisoning logs.

The fix: only trust these headers from **known, trusted proxies.** Configure your trusted proxy IP ranges; then read the *correct hop* from the right (the last IP added by a proxy you *don't* control is the real client). Frameworks expose this as "trusted proxies" config — get it wrong and you've built an auth-bypass.

### Q10. What is the PROXY protocol and why do you need it?

An **L4 (TCP) proxy** — a load balancer or TCP passthrough — forwards raw bytes and *can't add HTTP headers* (it may not even be HTTP, and with TLS passthrough it can't read the stream). So `X-Forwarded-For` isn't available, and the backend loses the client's real IP: it only sees the proxy's IP.

The **PROXY protocol** (from HAProxy) solves this. The proxy prepends a small header to the *start of the TCP connection*, before any application data, carrying the original connection's source and destination IP:port:

```
PROXY TCP4 203.0.113.9 198.51.100.2 56324 443\r\n
<then the normal TLS/HTTP bytes follow…>
```

The backend (nginx, HAProxy, Envoy, or the app) is configured to *expect and parse* this preamble, recovers the real client IP, and then treats the rest of the stream normally. v2 is a binary format; both sides must agree to speak it (if the backend expects it and the proxy doesn't send it — or vice versa — the connection breaks).

Use it whenever you need the client IP through an **L4 / TLS-passthrough** hop — e.g. an AWS NLB in front of nginx, where you still want real client IPs for logging and rate limiting but can't rely on `X-Forwarded-For`.

### Q11. SSL/TLS offloading vs bridging — what's the difference?

Both start with the proxy **terminating** the client's TLS (holding the certs, decrypting), which is what lets an L7 proxy read and route the request. The difference is what happens on the *backend* leg:

**TLS offloading (termination only)** — the proxy decrypts and forwards **plaintext** HTTP to the backends. Backends do no crypto (CPU saved), cert management is centralized, and you get full L7 features. The catch: traffic between proxy and backend is **unencrypted** — fine on a trusted private segment, a real exposure in a zero-trust/shared network.

**TLS bridging (re-encryption)** — the proxy terminates the client TLS, does its L7 work, then opens a **fresh TLS connection** to the backend. You get content routing *and* end-to-end encryption on every hop. The cost is double the crypto (decrypt then re-encrypt) and certs on the backends too.

(Contrast both with **TLS passthrough**, where the proxy doesn't terminate at all — it forwards the encrypted stream to the backend, which terminates; the proxy stays blind, so no L7 features.)

Choose: **offload** for simplicity/performance on a trusted network; **bridge** when compliance/zero-trust demands encryption inside the perimeter *and* you still need L7 routing; **passthrough** when the backend must own TLS end-to-end.

### Q12. How does a forward proxy help in a locked-down network, and what is HTTP CONNECT?

In a security-hardened environment, servers often have **no direct internet access** — the firewall blocks all outbound traffic. But they still need to reach some external endpoints (package registries, cloud APIs, webhooks). The answer is a **forward proxy**: a single controlled egress point. Servers are configured (`HTTP_PROXY`/`HTTPS_PROXY`) to send outbound requests through it, and the proxy enforces an **allow-list** of permitted destinations, logs all egress, and can cache. Everything else stays firewalled. This gives you auditable, centralized, least-privilege outbound access — exactly what compliance wants.

**HTTP `CONNECT`** is how HTTPS works through such a forward proxy. The proxy can't cache or inspect an encrypted HTTPS request the normal way, so the client asks it to open a **raw TCP tunnel**:

```http
CONNECT example.com:443 HTTP/1.1
Host: example.com:443
```
```http
HTTP/1.1 200 Connection Established
```

After the `200`, the proxy just blindly pipes bytes between client and destination — the client does its normal TLS handshake *end-to-end* through the tunnel, so the proxy never sees the plaintext (it only knows the hostname/port, which is enough to allow-list). `CONNECT` is also the mechanism behind HTTPS-through-corporate-proxies and some VPN-like tunneling. The proxy stays an egress gatekeeper without breaking end-to-end encryption.

### Q13. Trace a request's path through multiple proxies from the browser to the app.

A modern request threads through *several* intermediaries, each adding one concern. A typical path:

```
browser
  → DNS resolves to a CDN anycast IP
  → [CDN edge]         TLS terminate, serve cached static, WAF, compress
  → [regional L4 LB]   fast transport-level spread, HA (NLB/anycast VIP)
  → [L7 reverse proxy / API gateway]
                       TLS (re)terminate, route by host/path, authN, rate limit,
                       add X-Forwarded-For
  → [service sidecar]  (if service mesh) mTLS, retries, tracing
  → app server         business logic
       → DB / cache / other services (each via its own sidecar)
```

At each hop the source IP changes, so the client IP is carried forward in `X-Forwarded-For`/`Forwarded` (or the PROXY protocol across L4 hops) — and each proxy must trust that header only from the hop below it. TLS may be terminated and re-originated multiple times (edge, then gateway, then mTLS internally). Caching short-circuits the path — a CDN hit never reaches the origin at all.

The point of the layering: **each proxy owns one job** — CDN (edge cache + DDoS), LB (spread + HA), reverse proxy/gateway (routing + auth + rate limit), mesh (internal mTLS + resilience) — so no single box is overloaded with responsibilities, and you can scale or swap each independently. Being able to draw this diagram is the "design the edge" answer.

### Q14. Design the edge of a web service — what sits between the internet and your app servers?

I'd place each concern at the layer that's cheapest to handle it, outermost first:

**1. DNS + CDN (global edge).** DNS (GeoDNS/anycast) points users at the nearest **CDN** edge. The CDN terminates TLS, serves cached static assets, compresses, and absorbs DDoS/WAF at the edge — most requests never touch my origin. Outermost layer, biggest latency win.

**2. Load balancer (regional, HA).** Dynamic traffic hits a highly-available **L4 LB** (cloud NLB or anycast VIP with VRRP failover) fronting each region — fast, redundant across AZs, no SPOF.

**3. Reverse proxy / API gateway (L7).** Behind it, an **L7 reverse proxy** (nginx/Envoy) or **API gateway** (Kong/Envoy) that: (re)terminates TLS, routes by host/path to the right service, does **authN/authZ once** at the edge, **rate limits**, adds `X-Forwarded-For`, and hides backend topology. For a public API this is the gateway with quotas and versioning.

**4. Services (stateless) + optional mesh.** Requests reach **stateless** app servers (sessions in Redis, so no stickiness needed and the LB balances cleanly). If it's a large polyglot microservice estate, a **service mesh** (Envoy sidecars) gives internal calls mTLS, retries, and tracing — but I'd skip the mesh for a small system; it's not worth the operational tax.

**Cross-cutting:** health checks + connection draining at each tier for zero-downtime deploys; observability (p99, error rates, tracing) on the proxies; TLS bridging internally if zero-trust requires it. The theme: **layered proxies, each owning one edge concern, with stateless backends behind them.** This ties [[load-balancing]] and [[application-layer-protocols]] together into one picture.

### Q15. When would you reach for a forward proxy vs a reverse proxy vs an API gateway vs a service mesh? Give me the decision.

Pick by **whose traffic you're governing and what you're adding:**

- **Forward proxy** — you need to control/observe **outbound** traffic *from your clients/servers*: corporate egress filtering, an allow-listed egress gateway for locked-down servers, shared download caching, or client anonymity. The client is configured to use it. Key marker: *client-side, outbound.*

- **Reverse proxy** — you need a **front door for your servers**: TLS termination, load balancing, caching, routing, compression, static serving, hiding backend topology. Any web service with more than one backend wants one (nginx/Envoy/Caddy). Key marker: *server-side, general web infra.*

- **API gateway** — you have **multiple APIs/microservices** and want to centralize *API-specific* cross-cutting concerns: auth, rate limiting/quotas, request transformation, composition, versioning, per-consumer plans, analytics. It's a reverse proxy specialized for APIs at the **north-south** edge. Key marker: *many services, one managed public API surface.*

- **Service mesh** — you have **many services in multiple languages** and need uniform **east-west** mTLS, retries, circuit-breaking, and observability *without* touching app code — and you can afford the operational complexity of sidecars + a control plane. Key marker: *large internal service estate, service-to-service concerns.* Skip it for small/simple systems.

They compose: forward proxy for egress, reverse proxy/gateway at the edge, mesh inside. The decision is direction (in/out, north-south/east-west) plus how API-aware or how uniform-across-services you need to be.
## NAT, Firewalls & Network Security Basics

### Summary

**What this topic covers**

The boundary layer between your machines and the rest of the network: how private hosts reach the internet through a shared public address (**NAT**), and how traffic is allowed or denied crossing that boundary (**firewalls**, **security groups**, **NACLs**, **WAFs**). This is the part of networking that generates the most 2 a.m. pages — "it works from my laptop but not from the pod", "the connection just hangs", "why is the client IP showing as the load balancer's" — and almost all of it comes down to understanding NAT rewriting and stateful filtering. The 15 questions here cover NAT in depth (SNAT/DNAT/PAT, connection tracking, NAT traversal), the stateful-vs-stateless distinction that unifies firewalls/security-groups/NACLs, the single most useful debugging signal in networking (**connection refused vs timeout**), and the cloud-native security-group model you'll be quizzed on in any AWS/GCP/Azure interview.

**Mental model**

Picture a border checkpoint with a ledger. NAT is the checkpoint **rewriting passports**: an outbound packet from `10.0.0.5:44321` gets its source rewritten to `203.0.113.9:51000` (the public IP plus a chosen port), and the checkpoint writes a row in its ledger — the **connection-tracking table** — so the reply addressed to `203.0.113.9:51000` can be rewritten back to `10.0.0.5:44321`. That ledger is the whole game. A **stateful firewall** is the same ledger idea applied to *permission*: once it sees you open a connection outbound, it auto-permits the return packets, because it remembers the flow. A **stateless** filter has no ledger — it judges every packet in isolation, so you must write rules for both directions. Everything else — SNAT, DNAT, PAT, security groups, NACLs — is a variation on "is there a state entry, and which direction did the flow start?" Hold that ledger picture and the rest is bookkeeping.

**Key terms**

- **NAT** — Network Address Translation; rewriting IP/port in packet headers so many private hosts share fewer public IPs.
- **SNAT / masquerade** — Source NAT; rewrites the *source* address for outbound traffic (masquerade = SNAT to whatever the egress interface's IP currently is).
- **DNAT / port forwarding** — Destination NAT; rewrites the *destination* to steer inbound traffic to an internal host.
- **PAT / NAPT / "overload"** — Port Address Translation; multiplexes many internal hosts onto one public IP by allocating a distinct source port per flow.
- **Conntrack table** — the kernel's connection-tracking state; every active flow is a row keyed by the 5-tuple (proto, src IP:port, dst IP:port).
- **Stateful firewall** — tracks connections; return traffic for an established flow is auto-allowed.
- **Stateless firewall / NACL** — evaluates each packet independently; return traffic needs its own rule.
- **Security group** — cloud, instance-level, **stateful**, allow-only (no deny rules).
- **NACL** — Network ACL; cloud, subnet-level, **stateless**, ordered numbered rules with explicit allow *and* deny.
- **Default-deny** — the baseline security posture: drop everything, then allow only what's needed.
- **DROP vs REJECT** — DROP silently discards (client sees a timeout); REJECT sends back an ICMP/RST (client sees connection refused).
- **WAF** — Web Application Firewall; L7 filtering of HTTP for SQLi/XSS/OWASP-class attacks.

**Why interviewers ask this**

NAT and firewalls are where networking theory meets on-call reality, so this is a strong senior/SRE signal. A junior can define NAT; a senior can explain *why* a symmetric NAT breaks a P2P video call, *why* the app logs show every request coming from `10.0.0.3`, and *why* a security-group misconfig produces a hang rather than an error. The connection-refused-vs-timeout question in particular is a litmus test: candidates who instantly map "timeout → packet dropped by a firewall or unreachable host" and "refused → reached the host, nothing listening (RST)" have actually debugged production networks. The cloud security-group-vs-NACL comparison is nearly a guaranteed question for any infra role, because getting the stateful/stateless distinction wrong causes real outages (people add an inbound NACL rule and forget the ephemeral-port return range).

**Common confusions**

- "NAT is a firewall" — NAT hides internal addresses as a *side effect* and isn't a security control; a firewall makes allow/deny decisions. They often live in the same box, which blurs the line.
- "A security group can block an IP" — no; security groups are allow-only. To deny a specific source you use a NACL (or a WAF/firewall).
- "Refused and timeout are the same failure" — they're opposite diagnoses. Refused = you reached the host. Timeout = you probably didn't (or a firewall silently dropped you).
- "Locking down inbound is enough" — egress filtering matters; unrestricted outbound is how compromised hosts exfiltrate data and reach C2.
- "The app sees the real client IP behind NAT/LB" — no; it sees the NAT/proxy address unless `X-Forwarded-For` (or PROXY protocol) carries the original.
- "NACL rules are all-or-nothing like security groups" — NACLs are *ordered*; the lowest-numbered matching rule wins, and there's an implicit deny at the end.

**What follows from this topic**

NAT traversal (STUN/TURN/ICE) connects forward to real-time/UDP media and QUIC. The stateful-connection idea builds directly on TCP state (ESTABLISHED/TIME_WAIT) from the transport topic. TLS termination and the `X-Forwarded-For` client-IP problem lead into load balancing and the CDN/edge topic that follows, where WAF and DDoS mitigation move to the network edge. And the default-deny/egress-filtering mindset previews zero-trust architecture.

### Q1. What is NAT and why does it exist?

**NAT (Network Address Translation)** rewrites the IP addresses (and usually ports) in packet headers as they cross a boundary router, so hosts using private addresses can share one or a few public addresses.

It exists primarily because of **IPv4 exhaustion**. There are only ~4.3 billion IPv4 addresses; there are far more devices. RFC1918 carved out private ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`) that anyone can reuse internally, and NAT lets a whole network of those private hosts reach the internet behind a single public IP.

A typical home or cloud setup: dozens of hosts on `192.168.1.0/24` all appear to the internet as one public address. The NAT device keeps a **connection-tracking table** mapping each internal flow to a unique public source port so it can route replies back.

The trade-off: NAT breaks the internet's original **end-to-end** model. An external host can't initiate a connection *to* an internal host without an explicit port-forward, which is why peer-to-peer apps need NAT traversal.

### Q2. Explain SNAT, DNAT, and PAT.

Three flavours of the same rewriting mechanism, differing in *what* gets rewritten and *which direction* the flow starts.

- **SNAT (Source NAT)** — rewrites the **source** address on *outbound* traffic. Your laptop `192.168.1.20` sends a packet; the router rewrites the source to its public IP so the reply can come back to the router. **Masquerade** is SNAT where the source is set dynamically to whatever the egress interface's IP currently is (used when the public IP is dynamic, e.g. DHCP/dial-up).
- **DNAT (Destination NAT)** — rewrites the **destination** on *inbound* traffic. Also called **port forwarding**: "traffic to public IP `:443` → forward to internal `10.0.0.10:8443`". This is how you expose an internal service.
- **PAT / NAPT ("NAT overload")** — Port Address Translation multiplexes *many* internal hosts onto *one* public IP by giving each flow a distinct source port. This is what people usually mean by "NAT" at home. The mapping key is the full 5-tuple, so two internal hosts can even talk to the same server on the same port simultaneously — the router disambiguates by the public source port it assigned.

```text
Internal host      NAT (PAT)                    Server
10.0.0.5:44321  →  203.0.113.9:51000  →  93.184.216.34:443
10.0.0.6:44321  →  203.0.113.9:51001  →  93.184.216.34:443
                   ^ distinct public ports let one IP serve both
```

### Q3. What is the connection-tracking (conntrack) table and why does it matter?

The **conntrack table** is the kernel's record of every active flow crossing a NAT/stateful-firewall. Each entry is keyed roughly by the 5-tuple — protocol, source IP:port, destination IP:port — plus the NAT translation and connection state (NEW, ESTABLISHED, etc.).

It matters for two reasons:

1. **Correctness** — it's how return traffic finds its way back. Without the mapping, the router wouldn't know that a reply to `203.0.113.9:51000` belongs to `10.0.0.5:44321`. It's also how a stateful firewall knows to auto-allow return packets.
2. **Capacity** — the table is finite. Under high connection churn (a proxy fronting millions of short-lived connections, or a SYN flood) you can **exhaust conntrack**. When it fills, new connections are dropped and you see errors like `nf_conntrack: table full, dropping packet` in dmesg.

```bash
# Inspect and size the table on Linux
conntrack -L | wc -l                       # current entries
sysctl net.netfilter.nf_conntrack_count    # current
sysctl net.netfilter.nf_conntrack_max      # limit
```

The fix for exhaustion is raising `nf_conntrack_max`, shortening timeouts for closed flows, or (for very high throughput) bypassing conntrack for stateless flows with `NOTRACK`.

### Q4. What's the difference between a stateful and a stateless firewall?

| | Stateful | Stateless |
|---|---|---|
| Tracks connections | Yes (conntrack table) | No |
| Return traffic | Auto-allowed for established flows | Needs its own explicit rule |
| Decision basis | The flow (5-tuple + state) | Each packet in isolation |
| Rule count | Fewer (one rule per direction of *initiation*) | More (rules for both directions) |
| Cost | More memory/CPU per flow | Cheap, fast |
| Cloud example | Security group | NACL |

A **stateful** firewall remembers that you opened an outbound connection, so when the reply comes back it's recognised as part of an ESTABLISHED flow and allowed automatically. You only write rules for the direction a connection *starts*.

A **stateless** firewall has no memory. If you allow outbound `:443` you must *also* allow the inbound return traffic — which arrives on a random high **ephemeral port** (typically `32768–60999`), so you end up allowing a wide port range inbound. This is the classic NACL gotcha: people add an inbound allow for `:443` and forget the ephemeral-port return range for their outbound connections.

### Q5. Compare cloud security groups and NACLs.

This is the near-guaranteed cloud-networking question. Both filter traffic, but at different layers with different semantics.

| | Security Group | NACL (Network ACL) |
|---|---|---|
| Level | Instance / ENI | Subnet |
| State | **Stateful** | **Stateless** |
| Rules | Allow-only | Allow **and** deny |
| Evaluation | All rules, any match allows | **Ordered** by rule number, first match wins |
| Return traffic | Automatic | Must be explicitly allowed |
| Default | Deny all inbound, allow all outbound | Default NACL allows all; custom denies all |

**Security groups** attach to the instance/ENI, are stateful (allow outbound → return is automatic), and are **allow-only** — you can't write a "deny this IP" rule. They're your primary, everyday control.

**NACLs** attach to the subnet, are stateless, and are **ordered** numbered rules with both allow and deny. Because they're stateless you must allow the ephemeral-port return range. Use them for coarse subnet-level guardrails or to *block* a specific bad IP (which security groups can't do).

Rule of thumb: default to security groups; reach for NACLs when you need an explicit deny or a subnet-wide blanket rule.

### Q6. Connection refused vs connection timeout — what's the difference and how do you use it to debug?

This is the single most useful diagnostic distinction in networking. The two failures point at completely different causes.

- **Connection refused** — you *reached the host*, but nothing was listening on that port (or something actively rejected you). TCP got an **RST** back. Fast failure (milliseconds). Cause: the service is down/not started, listening on a different port/interface, or a firewall configured to `REJECT`.
- **Connection timeout** — no response at all. The SYN went into a black hole. Slow failure (seconds, until the TCP retry budget expires). Cause: a firewall/security-group silently **DROP**ping the packet, wrong IP, host down, or a routing problem.

```bash
# Refused: RST comes back immediately
$ curl -v http://10.0.0.10:8080
*   Trying 10.0.0.10:8080...
* connect to 10.0.0.10 port 8080 failed: Connection refused

# Timeout: hangs, then gives up — packet was dropped
$ curl -v --connect-timeout 5 http://10.0.0.10:8080
*   Trying 10.0.0.10:8080...
* Connection timed out after 5001 milliseconds
```

**How to use it**: *Refused* means your packet made it there — focus on the service (is it up? right port? bound to `0.0.0.0` not `127.0.0.1`?). *Timeout* means your packet probably didn't arrive — focus on the path (security group, NACL, route table, firewall DROP rule). This is why firewalls default to DROP rather than REJECT: a timeout gives an attacker no information about whether the port exists.

### Q7. How do iptables/nftables chains and rules work?

Linux packet filtering is organised into **chains** — hook points where packets are inspected — each holding an ordered list of **rules**. In the `filter` table the three built-in chains are:

- **INPUT** — packets destined for the local host.
- **OUTPUT** — packets originating from the local host.
- **FORWARD** — packets routed *through* the host (this is where a router/NAT box does its filtering).

Each rule has a match (protocol, ports, source, conntrack state) and a target (ACCEPT, DROP, REJECT, or jump to another chain). Rules are evaluated top-to-bottom; first match wins. The chain's **policy** is the default if nothing matches.

```bash
# Default-deny inbound, but allow established/related return traffic (stateful)
nft add rule inet filter input ct state established,related accept
nft add rule inet filter input tcp dport 22 accept
nft add rule inet filter input drop            # policy: drop the rest

# The conntrack match is what makes it stateful:
iptables -A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
```

The `ct state established,related` rule is the crucial one — it's what turns a pile of packet rules into a *stateful* firewall, using the same conntrack table NAT relies on. `nftables` is the modern replacement for `iptables` (one framework, better syntax, atomic rule updates), but the mental model is identical.

### Q8. What is NAT traversal, and how do STUN, TURN, and ICE fit in?

NAT breaks peer-to-peer: if both peers are behind NAT, neither can initiate a connection to the other's private address, and neither knows its own public IP:port mapping. **NAT traversal** is the set of techniques that let them connect anyway — critical for WebRTC (video/voice), gaming, and file-sharing.

- **STUN (Session Traversal Utilities for NAT)** — a peer asks a public STUN server "what public IP:port do you see me coming from?" The server reflects it back, so the peer learns its NAT mapping and can share it. Cheap; works for most NAT types via **hole punching** (both peers send packets simultaneously so each side's NAT opens a return mapping).
- **TURN (Traversal Using Relays around NAT)** — when hole punching fails (symmetric NAT, strict firewalls), both peers relay their traffic through a public TURN server. Reliable but costs bandwidth, so it's the fallback.
- **ICE (Interactive Connectivity Establishment)** — the orchestration framework. Each peer gathers **candidates** (its local address, its STUN-discovered public address, a TURN relay address), the peers exchange the candidate lists, and ICE probes them in priority order to pick the best working path — direct if possible, relayed only if necessary.

The practical takeaway: WebRTC tries STUN/direct first and falls back to a TURN relay, which is why you provision TURN servers when a meaningful fraction of users are behind symmetric/corporate NAT.

### Q9. Briefly, what are the NAT types (full-cone, restricted, symmetric)?

They describe *how strictly* a NAT reuses and restricts its port mappings, which determines whether hole punching works.

- **Full-cone** — once an internal host sends out, the public mapping accepts inbound from *anyone*. Easiest to traverse.
- **Address-restricted cone** — the mapping only accepts inbound from IPs the host has already contacted.
- **Port-restricted cone** — stricter still: only from the exact IP:port already contacted.
- **Symmetric** — a *different* public port is allocated per destination. The mapping the peer learned via STUN (for one destination) won't match traffic from a different peer, so hole punching fails and you need TURN.

For interviews you rarely need more than: "cone NATs are traversable with STUN; **symmetric NAT** usually forces a TURN relay because the port mapping is destination-specific."

### Q10. What is carrier-grade NAT (CGNAT) and what problems does it cause?

**Carrier-grade NAT (CGNAT / LSN, large-scale NAT)** is NAT performed by the *ISP*, sharing one public IPv4 address across *many customers* — a second layer of NAT on top of the customer's home NAT. ISPs deploy it because they've run out of public IPv4 to give each subscriber.

Consequences:

- **No inbound reachability** — you can't port-forward from behind CGNAT, so self-hosting, some gaming, and P2P get harder; TURN relays become necessary more often.
- **Shared reputation** — many users share one public IP, so one abuser can get the whole IP rate-limited, CAPTCHA'd, or blocklisted (the "why does this site think I'm a bot" problem).
- **Attribution/logging** — a public IP no longer identifies one subscriber; law-enforcement/abuse tracing needs the source *port* and precise timestamps too.
- **Conntrack pressure** — the carrier's NAT tracks enormous connection volumes.

The real long-term fix is **IPv6**, which has enough addresses to give every device a globally routable one and eliminate NAT entirely.

### Q11. What's the difference between a firewall, a WAF, and an IDS/IPS?

They operate at different layers and answer different questions.

- **Firewall** — L3/L4 (network/transport). Decides allow/deny based on IP, port, protocol, and connection state. "Can this host talk to that host on that port?" Doesn't understand application content.
- **WAF (Web Application Firewall)** — L7 (application). Inspects the *HTTP* payload to block application-layer attacks: SQL injection, XSS, path traversal, the OWASP Top 10. "Is this HTTP request malicious?" It understands URLs, headers, and body — a network firewall can't.
- **IDS / IPS** — Intrusion Detection/Prevention. Monitors traffic for known attack **signatures** or anomalies. An **IDS** alerts (passive, out-of-band); an **IPS** actively blocks inline. Broader scope than a WAF (not just HTTP), often signature-driven (Snort/Suricata).

They're complementary, not alternatives. A typical stack: network firewall/security groups control who can connect at all, a WAF at the edge scrubs malicious HTTP, and an IDS/IPS watches for known exploit signatures across protocols. The WAF is the one that would catch `'; DROP TABLE users; --` in a query string — the firewall just sees a valid TCP connection to port 443.

### Q12. Why does "allow all outbound" (weak egress filtering) matter?

Most people lock down *inbound* and leave *outbound* wide open. That's a real risk.

If a host is compromised, unrestricted egress lets the attacker:

- **Exfiltrate data** to any external server.
- **Reach command-and-control (C2)** infrastructure to receive instructions.
- **Pull down second-stage malware**.
- **Pivot** to other services and cloud metadata endpoints.

**Egress filtering** — default-denying outbound and allowing only known destinations (your package registries, APIs, DNS) — contains the blast radius of a breach. It's a core part of **defense in depth** and increasingly a compliance requirement.

The classic cloud disaster it prevents: SSRF against the instance metadata endpoint (`169.254.169.254`) to steal credentials, then unrestricted outbound to ship them out. Blocking egress to unexpected destinations (and IMDSv2/metadata hardening) closes that path. The cost is operational — you have to enumerate legitimate destinations — which is why people skip it, and why interviewers use it to separate box-checkers from people who think about breach containment.

### Q13. What are a DMZ, network segmentation, and bastion/jump hosts?

Architectural patterns for limiting how far an attacker can move.

- **DMZ (demilitarized zone)** — a network segment for internet-facing services (web servers, reverse proxies), isolated from the trusted internal network. If a public-facing box is compromised, the DMZ boundary stops the attacker reaching internal databases directly.
- **Network segmentation** — dividing the network into zones (public/DMZ, app tier, data tier) with firewall rules between them, so a breach in one tier doesn't grant free movement to others. In the cloud this is public vs private subnets, tiered security groups, and separate VPCs. **Microsegmentation** takes it per-workload.
- **Bastion / jump host** — a single hardened, audited entry point for administrative access to a private network. Instead of exposing SSH on every internal host, you SSH to the bastion (which lives in the public subnet) and hop inward. It shrinks the attack surface to one heavily-monitored box and gives you a choke point for logging and MFA. Modern equivalents: SSM Session Manager, Teleport, or an identity-aware proxy — which remove even the bastion's public SSH port.

Together these enforce **least privilege at the network level**, the physical-topology complement to zero-trust.

### Q14. When a request passes through NAT or a load balancer, how do you preserve the real client IP?

By default you lose it. After NAT/proxying, the packet's source IP is the NAT device or the load balancer, so your application logs and rate-limiters see one internal address for everyone — useless for geolocation, abuse-blocking, or auditing.

Two standard fixes, depending on the layer:

- **L7 (HTTP) — `X-Forwarded-For`** — the reverse proxy/L7 load balancer adds an HTTP header carrying the original client IP (and appends each hop): `X-Forwarded-For: 203.0.113.7, 10.0.0.2`. The related `X-Forwarded-Proto` and `X-Forwarded-Host` preserve the original scheme/host. Your app reads the *left-most untrusted* entry — carefully, because clients can forge the header, so you only trust the portion added by *your* proxies.
- **L4 (TCP) — PROXY protocol** — an L4 load balancer can't add HTTP headers (it doesn't parse HTTP), so it prepends a small **PROXY protocol** preamble to the TCP stream carrying the original src/dst IP:port. The backend must be configured to expect and parse it.

```text
GET /api HTTP/1.1
Host: acme.com
X-Forwarded-For: 203.0.113.7        # real client, added by the LB
X-Real-IP: 203.0.113.7
```

The security caveat: never trust `X-Forwarded-For` blindly — strip and re-set it at your trust boundary so an external client can't spoof its way past IP-based rules.

### Q15. Walk me through what a stateful firewall does when a client opens a connection and gets a reply.

Trace one HTTPS request from a laptop behind a NAT/stateful-firewall out to `acme.com:443`:

1. **Outbound SYN** — laptop `192.168.1.20:52000` sends SYN to `93.184.216.34:443`. The firewall checks OUTPUT/FORWARD rules: outbound to `:443` is allowed. NAT rewrites the source to the public IP and an allocated port, e.g. `203.0.113.9:51000`. A **conntrack** entry is created in state NEW → SYN_SENT recording the mapping and the 5-tuple.
2. **Return SYN-ACK** — the server replies to `203.0.113.9:51000`. This inbound packet would normally be blocked by default-deny INPUT... except the firewall looks it up in conntrack, finds the matching flow, marks it **ESTABLISHED**, and auto-allows it. NAT reverses the translation back to `192.168.1.20:52000`.
3. **The handshake completes** and data flows; every subsequent packet in either direction matches the ESTABLISHED conntrack entry and passes without re-consulting the rule list.
4. **Close** — FIN/FIN-ACK (or RST) tears down; conntrack moves the entry to a closing state and eventually times it out, freeing the row and the public port.

The key insight to state out loud: **you never wrote an inbound "allow" rule for the reply.** The stateful firewall permitted the return traffic purely because it remembered you initiated the flow — that's the entire value proposition of statefulness, and the same conntrack machinery that makes NAT work.

## CDNs & Edge

### Summary

**What this topic covers**

How content gets served from *close to the user* instead of from one distant origin, and everything that follows from pushing logic and caching to the network edge. A **CDN (Content Delivery Network)** is a globally distributed fleet of caching servers; understanding it means understanding request routing (anycast vs GeoDNS), what's cacheable and how cache headers drive it, cache invalidation (the genuinely hard part), origin shielding, edge compute, TLS termination at the edge, and DDoS absorption. The 15 questions here span the warm-up ("what is a CDN and why use one") through the architecture ("CDN → LB → app, where does TLS terminate") to the senior nuance ("serve *dynamic* content through a CDN with stale-while-revalidate", "cache-busting vs purging", "when you *don't* need a CDN"). This is core system-design material — almost every "design Instagram/Netflix/a news site" question routes through a CDN.

**Mental model**

Think of the CDN as a **cache with a map of the world in front of your origin**. A user's request doesn't travel to your single server in `us-east-1`; it's routed to the nearest **edge PoP (point of presence)**. If that edge has the content (a **cache hit**), it's served immediately from ~10ms away. If not (a **cache miss**), the edge fetches from origin — possibly via a **mid-tier shield** — stores it, and serves it, so the next nearby user gets a hit. Two levers control everything: *routing* (how you get sent to the nearest edge — usually **anycast**, the same IP announced from every PoP, with BGP picking the closest) and *caching* (what the edge is allowed to store and for how long — driven by `Cache-Control`). The senior mental shift is that "static vs dynamic" is a spectrum, not a binary: with the right cache keys and `stale-while-revalidate`, even API responses and personalised pages can be partly served from the edge.

**Key terms**

- **CDN** — globally distributed network of caching/proxy servers that serve content near the user.
- **Edge / PoP** — a point of presence; a data center location housing edge servers close to users.
- **Origin** — your authoritative server; the source of truth the CDN caches in front of.
- **Cache hit / miss** — whether the edge already had the content; **hit ratio** is the fraction of hits.
- **Anycast** — one IP address announced from many locations; BGP routes each user to the nearest.
- **GeoDNS** — routing by returning different DNS answers based on the resolver's location.
- **TTL** — time-to-live; how long the edge may serve cached content before revalidating.
- **Cache key** — what identifies a cached object (URL + selected query params/headers).
- **Cache-busting / fingerprinting** — versioned URLs (`app.a1b2c3.js`) so a new deploy is a new object, no purge needed.
- **Purge / invalidation** — forcibly evicting cached content by URL or tag.
- **Origin shield / tiered caching** — a designated mid-tier PoP that absorbs misses so the origin sees one request, not many.
- **Edge compute** — running code at the edge (Cloudflare Workers, Lambda@Edge, CloudFront Functions).
- **stale-while-revalidate** — serve slightly-stale cached content instantly while refreshing it in the background.

**Why interviewers ask this**

CDNs are unavoidable in system design, and how you use one reveals your grasp of latency, caching, and failure modes. A junior says "add a CDN to make it faster." A senior explains *which* content is cacheable, how cache keys avoid fragmenting the hit ratio, why **cache-busting via fingerprinted URLs beats purging** (purge is slow, global, and race-prone), how **origin shielding** prevents a thundering-herd stampede on the origin during a cache-miss storm, and where TLS terminates and what that costs. The "cache invalidation is one of the two hard problems" line is a genuine signal — candidates who've operated a CDN know invalidation is where the bugs live. Interviewers also probe the boundaries: when a CDN *doesn't* help (highly dynamic, per-user, write-heavy) and how you serve dynamic content anyway (micro-caching, ESI, stale-while-revalidate).

**Common confusions**

- "CDNs only serve static files" — modern CDNs cache API responses, do edge compute, and serve dynamic content with short TTLs/SWR.
- "Purging is how you update content" — purging is the escape hatch; **versioned/fingerprinted URLs** are the primary pattern.
- "Anycast and GeoDNS are the same" — anycast steers at the IP/BGP layer per-packet; GeoDNS steers by handing out different DNS answers.
- "The CDN caches everything automatically" — it caches what your `Cache-Control` and cache-key config *permit*; a `Set-Cookie` or `Cache-Control: private` can silently disable caching.
- "Browser cache and CDN cache are one thing" — they're separate layers with separate keys; `Cache-Control` can address each (`s-maxage` targets shared/CDN caches).
- "A CDN removes the need for a load balancer" — no; the CDN is the *first* hop, then LB, then app. Cache misses still hit your infra.

**What follows from this topic**

TLS termination at the edge connects to the TLS/handshake topic. Anycast builds on BGP and DNS from the routing topics. DDoS mitigation and edge WAF tie back to the firewalls/security topic (WAF moves to the edge). And every latency lever here — cutting physical distance, reusing connections, fewer round trips — feeds directly into the next topic, network performance and latency, where we quantify *why* moving content closer is the highest-leverage optimization there is.

### Q1. What is a CDN and why would you use one?

A **CDN (Content Delivery Network)** is a globally distributed fleet of caching/proxy servers that serve your content from a location physically close to each user, instead of everyone hitting your single origin.

Four reasons to use one:

- **Latency** — serving from an edge ~10–30ms away beats a round trip to a distant origin (which could be 150ms+ across an ocean). Since latency is bound by the speed of light, *cutting distance is the biggest lever you have.*
- **Origin offload** — cache hits at the edge never touch your servers, so a huge fraction of traffic (often 80–95%) is absorbed before it reaches you. Cheaper and more scalable.
- **Absorbing spikes & DDoS** — the CDN's enormous distributed capacity soaks up traffic surges and volumetric attacks that would flatten a single origin.
- **Reliability** — the edge can serve stale content or a cached copy even if the origin is briefly down.

The classic use is static assets (JS, CSS, images, video), but modern CDNs also cache API responses, terminate TLS, run edge compute, and act as a security layer. In system design, a CDN is almost always the *first* box in the request path.

### Q2. How does a CDN actually serve a request end to end?

Walk the path of one request:

1. **Routing to the nearest edge** — DNS/anycast resolves the CDN hostname to the closest **PoP**. The user's request lands on an edge server ~tens of milliseconds away, not your origin.
2. **Cache lookup** — the edge computes the **cache key** (usually the URL, sometimes plus select headers/query params) and checks its store.
3. **Cache hit** — content is present and fresh → served immediately from the edge. Done. Your origin never sees it.
4. **Cache miss** — not present (or expired) → the edge fetches from the **origin**, often via a **mid-tier shield PoP** so the origin sees one request rather than one-per-edge. The response is stored per its `Cache-Control` and served to the user.
5. **Subsequent nearby requests** are now hits until the TTL expires or the object is purged.

```text
User → [nearest edge PoP] --hit--> served (~10ms)
                          \--miss--> [shield PoP] → Origin → cache → serve
```

The whole design goal is to make step 3 the common case and step 4 rare — that's what "cache hit ratio" measures.

### Q3. How does a CDN route a user to the nearest edge — anycast vs GeoDNS?

Two mechanisms, often combined.

**Anycast** — the CDN announces the *same IP address* from every PoP via **BGP**. The internet's routing fabric naturally delivers each user's packets to the topologically nearest PoP announcing that IP. One IP, many locations; routing happens at the network layer per-packet.

- Pros: fast failover (if a PoP dies, BGP reroutes to the next nearest automatically), simple client config, great for DDoS (attack traffic is spread across all PoPs).
- Cons: less precise (BGP "nearest" is topological, not always geographically/latency optimal); long-lived connections can occasionally re-route mid-session.

**GeoDNS / DNS-based steering** — the CDN's DNS server returns *different IP answers* depending on where the resolver is (and sometimes real-time PoP load/health). Routing happens at DNS-resolution time.

- Pros: can factor in load, health, and latency measurements; more control.
- Cons: relies on the resolver's location being representative of the user's (public resolvers like `8.8.8.8` break this unless EDNS Client Subnet is used); DNS TTLs slow failover.

Big CDNs (Cloudflare, Fastly) lean on **anycast**; others (classic Akamai) historically leaned on **DNS steering**. Many use a hybrid.

### Q4. What makes content cacheable, and how do cache headers control it?

Cacheability is driven mostly by HTTP response headers the origin sets.

- **`Cache-Control`** — the primary control. `public, max-age=3600` → cacheable by anyone for an hour. `private` → browser only, not the CDN. `no-store` → never cache. `s-maxage=86400` → a separate, longer TTL specifically for *shared* (CDN) caches. `no-cache` → cache but revalidate before serving.
- **`Expires`** — older absolute-timestamp equivalent of `max-age`; `Cache-Control` wins if both present.
- **`ETag` / `Last-Modified`** — validators. On expiry the edge sends a conditional request (`If-None-Match`); origin replies `304 Not Modified` if unchanged, avoiding a re-download.
- **`Vary`** — tells the cache to key on additional request headers (e.g. `Vary: Accept-Encoding` for gzip/brotli variants). `Vary: Cookie` or an over-broad `Vary` can shred your hit ratio.

Rules of thumb: **static, fingerprinted assets** get long TTLs (`max-age=31536000, immutable`). **HTML/dynamic** gets short TTLs or `no-cache` with an ETag. A stray `Set-Cookie` on a response often makes CDNs refuse to cache it — a common "why is my hit ratio zero" bug.

### Q5. Explain cache invalidation and why it's considered hard.

"There are only two hard things in computer science: cache invalidation and naming things." Invalidation is hard because your cached copies are distributed across dozens of PoPs, and you have to make them all agree that the old content is dead — fast, consistently, without a stampede.

Two approaches:

- **Purge / invalidate** — explicitly evict. **By URL** (`purge /logo.png`), **by tag/surrogate-key** (evict everything tagged `product-42` in one call — the powerful pattern for dynamic content), or **purge everything** (nuclear, causes a global miss storm on your origin). Purges take seconds to propagate globally and are inherently racy.
- **Versioned URLs / cache-busting** — the *better* default. Fingerprint the content into the filename: `app.a1b2c3.js`. A new deploy produces a *new URL*, so there's nothing to invalidate — old and new coexist, and clients mid-request aren't broken. The HTML that references the assets gets a short TTL; the fingerprinted assets get an effectively infinite one.

The senior answer: **prefer cache-busting to purging.** Purging is the escape hatch for content you can't version (a corrected news article at a stable URL), where tag-based purge shines. Relying on purge-everything for routine updates is a smell — it defeats the cache and hammers the origin.

### Q6. What is cache hit ratio and how do you improve it?

**Cache hit ratio** = hits / (hits + misses). It's the headline CDN metric: high ratio means most requests are served from the edge (fast, cheap, origin-protected); low ratio means requests leak through to your origin.

Ways to improve it:

- **Longer TTLs** where safe — the biggest lever. Short TTLs cause needless revalidation. Fingerprint static assets so you can set `max-age` to a year.
- **Normalise cache keys** — strip irrelevant query params (tracking params like `utm_*`, session IDs) from the key so `?utm_source=x` and the bare URL share one cached object. Sort/canonicalise params.
- **Tame `Vary`** — don't vary on high-cardinality headers (cookies, user-agent); each variant is a separate cached object that dilutes hits.
- **Avoid accidental `Set-Cookie`** on cacheable responses.
- **Origin shielding / tiered caching** — a mid-tier that consolidates misses so even the "miss" path warms fewer copies.
- **Cache dynamic content briefly** — micro-caching a hot API endpoint for even 1–5 seconds can turn a stampede into a trickle.

Measure it per-content-type: a 60% *overall* ratio might be 99% on assets and near-zero on HTML, pointing you at exactly what to fix.

### Q7. What are origin shielding and tiered caching, and what problem do they solve?

The problem: with dozens of edge PoPs, a **cache miss** (cold object, or a TTL expiry on a popular object) can happen at *many* PoPs at once — each independently fetching from your origin. That's a **thundering herd**: one popular-but-expired object can generate a burst of simultaneous origin requests, and under a traffic spike the origin gets stampeded.

**Origin shielding / tiered caching** inserts a **mid-tier** cache between the edge PoPs and the origin. All misses funnel through a designated shield PoP:

```text
Many edges --miss--> [single Shield PoP] --one request--> Origin
```

Now the origin sees *one* request for a cold object instead of N. The shield fetches once, caches, and fans the response back out to the edges. Benefits:

- **Massively reduced origin load** — the origin's traffic is proportional to unique-content churn, not user geography.
- **Better effective hit ratio** — an edge miss can still be a *shield* hit.
- **Stampede protection** — combined with **request coalescing** (the CDN collapses concurrent identical misses into a single origin fetch), a spike on one URL becomes a single origin call.

This is essential once you have global traffic; without it, expanding your PoP footprint paradoxically *increases* origin load.

### Q8. What is edge compute and what do you use it for?

**Edge compute** runs your code *on the CDN's edge servers* — Cloudflare Workers, AWS Lambda@Edge / CloudFront Functions, Fastly Compute@Edge — so logic executes ~10ms from the user instead of at a distant origin.

Typical uses (things you want *before* or *instead of* an origin round trip):

- **Personalization / A-B routing** — rewrite responses or pick a variant at the edge without a slow origin call.
- **Auth & token validation** — verify a JWT/signed cookie at the edge and reject bad requests before they cost origin resources.
- **Redirects & URL rewriting** — geolocation redirects, legacy-URL mapping, adding security headers.
- **Request/response transformation** — inject `X-Forwarded-*`, modify cache keys, stitch fragments.
- **API mediation** — small aggregations or rate-limiting at the edge.

The constraints matter: edge runtimes are lightweight (short CPU budgets, often V8 isolates rather than full containers, limited memory, no persistent local disk), so you push *latency-sensitive, stateless* logic there and keep heavy/stateful work at the origin. The payoff is dramatic for anything on the critical path — an auth check that would add a 150ms origin round trip becomes a sub-millisecond edge check.

### Q9. Can you serve dynamic or API content through a CDN? How?

Yes — the "CDNs are only for static files" belief is outdated. Several techniques let dynamic content benefit from the edge:

- **`stale-while-revalidate`** — `Cache-Control: max-age=10, stale-while-revalidate=60`. The edge serves the cached copy instantly (even once technically stale) and refreshes it in the background. Users never wait on the origin; content is at most seconds behind. Ideal for feeds, dashboards, product listings.
- **Micro-caching** — cache a hot, expensive endpoint for a *very short* TTL (1–5s). Even 1 second of caching collapses a thousand-RPS stampede into one origin request per second — huge origin relief for near-real-time data.
- **Tag/surrogate-key purging** — cache dynamic pages but purge precisely by tag when the underlying data changes, getting cache benefits with correctness on write.
- **Edge compute + edge KV** — assemble responses at the edge from cached fragments (ESI-style) or an edge datastore.
- **Cache the cacheable parts** — split a page: static shell cached long, per-user fragment fetched separately (or rendered client-side).

The judgement call is staleness tolerance: if seconds-old data is fine (most read paths), micro-caching/SWR is a massive win. Truly per-user, write-through, or must-be-current content (a bank balance) stays uncached and goes straight to origin.

### Q10. How does a CDN help with DDoS mitigation?

The CDN sits in front of your origin as a massive, distributed shield, which makes it the natural place to absorb attacks.

- **Volumetric absorption** — the CDN's aggregate capacity (terabits/sec across all PoPs, spread by **anycast**) dwarfs any single origin. A flood that would saturate your one pipe gets diluted across the global fleet, each PoP absorbing a slice.
- **Origin hiding** — if clients only ever reach the CDN and your origin IP is locked down (allow only CDN IPs to the origin), attackers can't hit the origin directly; they have to go through the CDN.
- **Edge WAF & rate limiting** — L7 attacks (HTTP floods, credential stuffing, SQLi) are filtered at the edge before consuming origin resources. Rate limits and bot management drop abusive clients early.
- **Caching as defense** — cached responses are served from the edge without ever touching the origin, so even a large request flood for cacheable content is absorbed for free.
- **Automatic scrubbing** — big CDNs detect attack patterns and null-route/challenge malicious traffic automatically.

The key architectural point: **lock the origin so it only accepts traffic from the CDN.** A CDN in front of an origin whose IP is still publicly reachable gives attackers a way to bypass all of the above.

### Q11. Where does TLS terminate in a CDN setup, and what's the trade-off?

Usually **at the edge**. The client's HTTPS connection (and its TLS handshake) terminates on the nearest edge PoP; the edge then talks to your origin over a *separate* connection.

Why terminate at the edge:

- **Latency** — the TLS handshake costs round trips (1–2 RTT). Doing it against an edge ~10ms away is far cheaper than against a distant origin ~150ms away. This is one of the biggest CDN latency wins, especially for new connections.
- **Session reuse / connection pooling** — the edge keeps warm, pooled connections to the origin, so most user requests skip an origin-side handshake entirely.
- **Cert management** — the CDN manages certs, OCSP stapling, and modern TLS (1.3, HTTP/3) for you.

The trade-off is the **edge-to-origin hop**: between the edge and origin, is traffic encrypted? Options are **full/strict TLS** (re-encrypt edge→origin, verifying the origin cert — the correct choice) versus **flexible** (edge→origin in plaintext — a security hole, since traffic is unencrypted on the leg you don't see). Always run **full (strict)** so the connection is encrypted end to end and the origin cert is validated. The subtle point interviewers want: TLS termination at the edge means the *CDN* sees your plaintext — which is fine (it's your CDN and does caching/WAF on it) but is a trust decision worth naming.

### Q12. Why are versioned/fingerprinted URLs preferred over purging for cache-busting?

Because a new version of the content becomes a *new object* with a *new URL*, so there is simply nothing to invalidate.

```text
Deploy 1:  <script src="/app.a1b2c3.js">   Cache-Control: max-age=31536000, immutable
Deploy 2:  <script src="/app.d4e5f6.js">   ← different URL, fetched fresh
```

The advantages over purging:

- **Instant & global** — no purge to propagate across PoPs; the moment the new HTML references the new filename, users fetch the new asset. No race window.
- **Atomic deploys** — old and new versions coexist. A user mid-session on the old HTML keeps loading old assets that are still cached; nobody gets a broken half-old-half-new page.
- **Aggressive caching** — because the URL is immutable-by-content, you can set a one-year TTL and never revalidate. Best possible hit ratio.
- **No stampede** — you're not evicting a hot object and forcing a global re-fetch.

The pattern: **fingerprinted assets get near-infinite TTL; the referencing HTML gets a short TTL (or is revalidated).** The only thing that needs to be "fresh" is the small HTML pointer. Purging is then reserved for the case fingerprinting can't handle — mutable content at a *stable* URL (a corrected article), where tag-based purge is the right tool.

### Q13. How does a CDN fit into the overall request path (CDN → LB → app)?

The CDN is the **first hop**, not a replacement for the rest of the stack. A full path for a cache *miss*:

```text
Client
  → DNS resolves to CDN (anycast)
  → nearest CDN edge PoP        (TLS terminates here; cache checked; WAF/rate-limit)
      ── cache hit → response returns here, origin untouched
      ── cache miss ↓
  → (origin shield PoP)
  → Load balancer (L4/L7)        (health checks, distributes across app instances)
  → Application server / API
  → Database / cache / services
```

Key points to make:

- **Cache hits short-circuit** everything after the edge — that's the whole point.
- **Only misses (and uncacheable requests) traverse the LB and app.** So your origin capacity is sized for miss traffic, not total traffic.
- Each layer has a job: **CDN** = caching + edge security + TLS; **LB** = distribution + health + TLS re-termination; **app** = business logic. Don't conflate them ("the CDN removes the need for a load balancer" is wrong — misses still need distributing across instances).
- The client IP must be **propagated** down the chain via `X-Forwarded-For` so the app/LB sees the real user, not the CDN edge.

### Q14. When do you *not* need a CDN?

A CDN isn't free (cost, config, another moving part, cache-invalidation complexity), and it doesn't help every workload. Skip or minimise it when:

- **All traffic is single-region and internal** — an internal admin tool used only by staff in one office/region gains little from global edges. The origin is already close.
- **Content is fully dynamic and per-user with zero cacheability** — if every response is unique and uncacheable (a real-time trading terminal, a personalized write-heavy dashboard), the CDN just becomes a pass-through proxy adding a hop. (Though edge compute/TLS-termination can still help latency.)
- **Write-heavy / API-mutation-heavy** — POSTs and mutations can't be cached; a CDN doesn't accelerate writes.
- **Very low traffic** — a hobby site with a handful of users doesn't need the scale; the operational overhead outweighs the benefit.
- **Strict data-residency/compliance** — caching content in arbitrary global PoPs may violate data-locality rules.

Even then, nuance: many "dynamic" apps still have *some* cacheable surface (static assets, avatars, public read endpoints), and a CDN's TLS termination + DDoS shield can justify it regardless. The honest senior answer is "measure your cacheable fraction and your geographic spread first" — don't cargo-cult a CDN onto a workload that can't use it.

### Q15. What are push vs pull CDNs, and what is multi-CDN?

**Pull vs push** describes how content gets *into* the CDN:

- **Pull CDN** — the default and most common. The edge is empty; on the first request for an object it *pulls* it from your origin (cache miss), caches it, and serves subsequent requests. You just set cache headers and point DNS at the CDN. Downside: the first user per PoP pays the miss latency, and expired objects re-pull.
- **Push CDN** — you proactively *upload* content to the CDN (or it's synced from a bucket) ahead of demand. Good for large files (video, big downloads) where you never want an origin pull, or content you want warm everywhere before a launch. More operational work (you manage what's there and when it expires).

**Multi-CDN** = using *two or more* CDN providers together, with a steering layer (DNS or a traffic manager) choosing between them per-request/region based on performance, cost, or availability. Reasons:

- **Resilience** — if one CDN has an outage or regional brownout, failover to the other. (Major CDN outages take down big chunks of the web; multi-CDN insures against that.)
- **Performance** — no single CDN is fastest everywhere; route each region to its best-performing provider.
- **Cost/negotiation** — commit-based pricing leverage and burst capacity.

The cost is complexity: consistent cache/purge behaviour, config drift, and observability across providers. It's a large-scale concern — most apps are fine on one good CDN.

## Network Performance & Latency

### Summary

**What this topic covers**

Why networked systems are slow, and specifically why the answer is almost always **latency, not bandwidth**. This topic separates the three metrics people constantly conflate — **bandwidth** (capacity), **throughput** (achieved rate), and **latency** (delay) — and then explores what actually governs response time: round trips, the speed-of-light floor, TCP behaviours (slow-start, congestion control, head-of-line blocking), buffering pathologies (bufferbloat), and the measurement discipline (percentiles, tail latency) that separates people who've run production systems from people who've read about them. The 16 questions here run from the warm-up ("bandwidth vs latency") through the mechanism ("why does each round trip cost an RTT", "what's the bandwidth-delay product") to the senior diagnosis ("my API is slow even though bandwidth is fine", "my p99 spikes under load — bufferbloat or congestion?"). This is the topic that makes you dangerous in a "the site is slow" incident.

**Mental model**

Bandwidth is the **width** of the pipe; latency is the **length** of the pipe. Widening a pipe (more bandwidth) lets you push more water per second, but it does *nothing* to make the first drop arrive sooner — that's set by how long the pipe is (distance) plus how long you spend at each end filling and draining it (queuing, processing, round trips). The dominant hidden cost is **round trips**: opening a TCP connection is a round trip, the TLS handshake is one or two more, and each of those is bound by RTT, which is bound by physics. So a request that needs several serial round trips before the first byte of data can be *150ms × N* before you've transferred a single byte — regardless of how "fast" your connection is. Internalise this and the optimisation playbook writes itself: **cut distance** (CDN/edge), **cut round trips** (connection reuse, TLS 1.3, HTTP/2/3), **cut retransmits** (avoid loss and bufferbloat). You can't buy your way past the speed of light; you can only stop paying its toll repeatedly.

**Key terms**

- **Bandwidth** — maximum capacity of a link, in bits/sec. The pipe's width.
- **Throughput** — the actual data rate achieved, always ≤ bandwidth, degraded by loss/congestion/protocol overhead.
- **Latency** — the delay for data to travel, one-way or as **RTT** (round-trip time). The pipe's length.
- **RTT** — round-trip time; the time for a packet to go and its reply to return. The unit that handshakes and requests are counted in.
- **Propagation delay** — distance ÷ speed of signal (~5µs/km in fiber, ~⅔ c); the irreducible physics floor.
- **Serialization/transmission delay** — time to clock bits onto the wire; depends on packet size and bandwidth.
- **Queuing delay** — time spent waiting in buffers along the path; the variable, load-dependent component.
- **Bandwidth-delay product (BDP)** — bandwidth × RTT; the amount of in-flight data a link can hold.
- **TCP slow-start** — TCP ramps its congestion window up from small, so short connections never reach full speed.
- **Head-of-line (HOL) blocking** — one stalled item blocks everything queued behind it (TCP-level; worse in HTTP/1.1).
- **Bufferbloat** — oversized buffers holding packets, adding huge queuing latency under load.
- **Jitter** — variation in latency; deadly for real-time media.
- **Tail latency (p99/p999)** — the slow end of the distribution; what users actually feel at scale.

**Why interviewers ask this**

"Add more bandwidth" is the single most common wrong answer to a performance question, so this topic is a fast senior filter. Anyone can define latency; a senior can explain *why doubling your bandwidth won't help a slow API*, decompose an RTT into propagation + queuing + processing, reason about how **round trips** (not throughput) dominate the time-to-first-byte for small requests, and diagnose a **p99 latency spike under load** as bufferbloat/queuing rather than raw slowness. The measurement angle matters too: candidates who talk in **percentiles and tail latency** (rather than averages) have operated systems at scale, because averages hide the p99 that determines user experience and SLOs. The "why is it slow even though bandwidth is fine" scenario is a direct test of whether you understand that physics, round trips, and cold connections — not the size of the pipe — are usually the culprit.

**Common confusions**

- "More bandwidth = lower latency" — the central misconception. Bandwidth is capacity; latency is delay. They're orthogonal; adding lanes to a highway doesn't shorten it.
- "Latency and throughput are the same" — high-latency links can have high throughput (with enough window/BDP); low-latency links can have low throughput (if congested).
- "A bigger buffer prevents packet loss so it's good" — oversized buffers cause **bufferbloat**: packets sit in queues adding latency instead of being dropped early (which TCP needs as a congestion signal).
- "TCP is at full speed instantly" — **slow-start** means short connections finish before reaching full throughput; connection reuse matters.
- "HTTP/2 fixed head-of-line blocking" — it fixed *application-layer* HOL, but TCP-level HOL remains; only **HTTP/3 over QUIC** removes it.
- "Averages describe performance" — the **tail** (p99/p999) is what users feel; averages lie.

**What follows from this topic**

This topic is the *why* behind the entire primer's optimisation advice. The round-trip cost explains why the CDN/edge topic (cutting distance) is the highest-leverage change. The handshake costs connect to the TLS topic (1.3's 1-RTT/0-RTT) and the HTTP topic (keep-alive, HTTP/2 multiplexing, HTTP/3 over QUIC). Congestion control, slow-start, and the BDP tie directly back to TCP internals. And the measurement discipline — percentiles and tail latency — is the lens you carry into every production incident: not "is it fast on average," but "what does p99 do under load, and is that physics, queuing, or a cold connection?"

### Q1. What's the difference between bandwidth, throughput, and latency?

Three distinct things people constantly conflate:

- **Bandwidth** — the *maximum capacity* of a link, in bits/sec. The theoretical top speed. The **width** of the pipe.
- **Throughput** — the *actual* data rate you achieve, always ≤ bandwidth. Degraded by protocol overhead, congestion, packet loss, and small windows. You have a 1 Gbps link (bandwidth) but measure 300 Mbps (throughput).
- **Latency** — the *delay* for data to travel, measured one-way or as **RTT** (round-trip time). The **length** of the pipe.

```text
Bandwidth  = how WIDE the pipe is   (capacity, bits/sec)
Throughput = how much water actually flows (achieved rate)
Latency    = how LONG the pipe is    (delay, ms)
```

The crucial insight: **bandwidth and latency are independent.** A transatlantic link can have enormous bandwidth but ~80ms of latency (physics — the ocean is wide). A short link can be low-latency but low-bandwidth. Throughput sits in between: it's what you actually get, limited by *whichever* of bandwidth, latency (via window size), or loss is the bottleneck. Interviewers ask this because "just add bandwidth" is the reflexive wrong fix for a latency problem.

### Q2. Why doesn't adding more bandwidth fix a latency problem?

Because latency is governed by **distance and delay**, not capacity. Widening the pipe lets you push more bits per second, but it can't make the first bit arrive sooner.

The dominant component of latency for most requests is **propagation delay** — the time for the signal to physically travel — which is bound by the speed of light (~5µs per km in fiber, about two-thirds of c in a vacuum). London to New York is ~5,500km, giving a floor of ~28ms one way, ~56ms RTT, *before* any queuing, processing, or the multiple round trips a real request needs. No amount of bandwidth changes that; you'd need to move the servers closer.

An analogy: a highway. Bandwidth is the number of lanes; latency is the length of the road. Adding lanes lets more cars travel *simultaneously* (throughput), but each car's *trip time* is unchanged — the road is just as long.

So for a small request (an API call, a DNS lookup), which is latency-bound, doubling bandwidth does nothing. Bandwidth only helps when you're **capacity-bound** — transferring large files where the pipe is genuinely full. "Buy more bandwidth" fixes slow *downloads*; it never fixes slow *round trips*.

### Q3. What are the components of network latency?

RTT decomposes into four parts; knowing which dominates tells you what to fix:

- **Propagation delay** — distance ÷ signal speed. ~5µs/km in fiber. Irreducible physics; the only fix is *less distance* (CDN/edge). Dominates for long-haul links.
- **Transmission / serialization delay** — time to clock the packet's bits onto the wire = packet_size ÷ bandwidth. This is where bandwidth *does* matter, but it's usually tiny for small packets (a 1500-byte packet on 1 Gbps ≈ 12µs). Dominates only for large packets on slow links.
- **Queuing delay** — time spent waiting in buffers at routers/switches along the path. **Highly variable**, load-dependent — this is the component that explodes under congestion and causes **bufferbloat**. The main source of latency *variation* (jitter).
- **Processing delay** — time for devices (routers, firewalls, the destination's kernel/app) to process the packet: routing lookups, NAT, TLS, application logic.

```text
Total latency = propagation + transmission + queuing + processing
                (distance)    (size/BW)      (load!)    (per-hop work)
```

The senior move is identifying which term dominates *your* problem: long-haul → propagation (add a CDN); congested → queuing (fix bufferbloat/capacity); slow server → processing (profile the app). `traceroute`/`mtr` help attribute latency to hops along the path.

### Q4. What is RTT and why do round trips matter so much?

**RTT (round-trip time)** is the time for a packet to reach the destination *and* its reply to return. It's the fundamental unit of interactive network cost, because most protocols are **request-response** — you send, then wait a full RTT for the answer before proceeding.

The reason round trips dominate: many operations are *serial* round trips that must complete before data flows.

```text
Cold HTTPS request over TCP + TLS 1.2, RTT = 100ms:
  DNS lookup             ~1 RTT   (100ms)
  TCP handshake (SYN/SYN-ACK/ACK) 1 RTT   (100ms)
  TLS 1.2 handshake      2 RTT   (200ms)
  HTTP request/response  1 RTT   (100ms)
  ─────────────────────────────────
  ~500ms before the first byte of content — on a "fast" connection
```

Every round trip is bound by RTT, which is bound by physics. So **reducing the number of round trips beats increasing bandwidth** for latency. That's the entire motivation behind:

- **TLS 1.3** (1-RTT handshake, 0-RTT resumption) vs TLS 1.2's 2-RTT.
- **Connection reuse / keep-alive** — amortize the handshake over many requests instead of paying it each time.
- **HTTP/2 multiplexing** — many requests over one already-warm connection, no new handshakes.
- **HTTP/3 / QUIC** — combines transport + TLS into fewer round trips (1-RTT, 0-RTT).

When you optimise latency, you're mostly *counting and eliminating round trips.*

### Q5. What is the bandwidth-delay product and why does it matter?

The **bandwidth-delay product (BDP)** = bandwidth × RTT. It's the amount of data that can be **in flight** (sent but not yet acknowledged) on a link at once — the link's "storage capacity."

```text
BDP = bandwidth × RTT
Example: 1 Gbps link, 100ms RTT
  = 1,000,000,000 bits/s × 0.1 s = 100,000,000 bits = 12.5 MB in flight
```

Why it matters: **TCP can only have one receive-window's worth of unacknowledged data outstanding.** If the window is smaller than the BDP, the sender fills the window, then *stalls* waiting for ACKs before sending more — you never fill the pipe, and throughput is capped far below bandwidth, no matter how fat the link.

This is the **long fat network (LFN)** problem: high bandwidth × high latency = large BDP. The original TCP window was 16 bits (max 64KB) — far too small for the 12.5MB above. The fix is **TCP window scaling** (RFC 1323), which lets the window grow to match large BDPs, plus adequate socket buffers on both ends.

The practical lesson: on high-BDP paths (satellite, transcontinental, high-speed WAN), throughput problems are often *window/buffer* problems, not bandwidth problems. Sizing send/receive buffers to ≥ BDP is a standard TCP-tuning move for bulk transfer over long distances.

### Q6. How does TCP slow-start affect the latency of short connections?

TCP doesn't start at full speed. **Slow-start** begins with a small **congestion window (cwnd)** — historically a few segments, now typically an initial window of ~10 segments (~14KB) — and *doubles* it each RTT until it hits a threshold or detects loss. This probes the path's capacity without instantly overwhelming it.

The consequence for **short connections**: they often *finish before ever reaching full throughput.* If your response is 200KB and each RTT only lets you grow the window by a doubling, you spend several round trips ramping up — and a small transfer completes while cwnd is still small. So the connection never uses the bandwidth available; it's latency-bound by the slow-start ramp.

This is a core reason **connection reuse matters so much**:

- A fresh connection pays the slow-start tax every time.
- A **kept-alive / pooled** connection stays "warm" — its cwnd has already grown, so subsequent requests transfer at full speed immediately.
- This is why HTTP keep-alive, HTTP/2 (one long-lived multiplexed connection), and connection pools dramatically improve real-world latency: they amortize both the handshake *and* the slow-start ramp.

Interview soundbite: "Short-lived connections live and die in slow-start, so they never see your bandwidth — reuse connections to escape the ramp."

### Q7. What is head-of-line blocking, and how do HTTP/1.1, HTTP/2, and HTTP/3 differ?

**Head-of-line (HOL) blocking** is when the *first* item in a queue stalls and blocks everything behind it, even though those later items are ready. It appears at two layers:

- **HTTP/1.1 (application-layer HOL)** — one request per connection at a time. A slow response blocks the connection; the browser works around it by opening ~6 parallel connections per host (each with its own handshake + slow-start cost). Pipelining tried to help but was effectively unusable.
- **HTTP/2** — **multiplexes** many streams over a *single* TCP connection, solving application-layer HOL: independent requests no longer wait for each other at the HTTP level. But it introduced a subtler problem: because everything shares one TCP connection, a *single lost TCP packet* stalls **all** streams until it's retransmitted — **TCP-level HOL blocking**. One drop blocks every multiplexed request.
- **HTTP/3 over QUIC** — runs over **UDP** with independent streams *at the transport layer*. A lost packet only stalls *its own* stream; the others keep flowing. This finally eliminates TCP-level HOL — the main reason HTTP/3 exists.

| | Transport | App-layer HOL | Transport-layer HOL |
|---|---|---|---|
| HTTP/1.1 | TCP, 1 req/conn | Yes | Yes |
| HTTP/2 | TCP, multiplexed | No | **Yes** (shared TCP) |
| HTTP/3 | QUIC/UDP, multiplexed | No | **No** |

The progression is a direct latency story: each version removes a layer of blocking so unrelated requests stop waiting on each other.

### Q8. What is bufferbloat and how do you fix it?

**Bufferbloat** is excessive latency caused by *oversized* network buffers. Router/modem vendors added big buffers thinking "more buffer = fewer drops = good." But when a buffer fills under load, packets *sit* in the queue for a long time instead of being dropped — adding hundreds of milliseconds of **queuing delay**.

The pathology: TCP relies on packet loss as its **congestion signal**. Oversized buffers *hide* congestion — packets are hoarded rather than dropped — so TCP doesn't back off, keeps sending, and the buffer stays full and deep. Result: latency balloons under load even though throughput looks fine. The classic symptom is a home connection where a big upload makes every *other* connection (video call, gaming) lag horribly — the upload has filled a fat buffer that everything else now queues behind.

```bash
# Detect it: ping while saturating the link — watch RTT explode under load
ping acme.com        # idle: 15ms
# start a big upload, ping again → 15ms jumps to 300ms+  = bufferbloat
```

The fix is **Active Queue Management (AQM)**: algorithms like **CoDel**, **FQ-CoDel**, and **CAKE** that keep queues short by dropping/marking packets *early* (before the buffer is huge), and *fair-queue* flows so one bulk transfer can't starve latency-sensitive ones. Modern Linux defaults to `fq_codel`. The insight interviewers want: *bigger buffers are not better* — a short, well-managed queue beats a deep one for latency.

### Q9. How do jitter and packet loss affect performance, and why does real-time media use UDP?

**Jitter** is the *variation* in latency — packets arriving 20ms, then 45ms, then 18ms apart. Average latency can look fine while jitter wrecks the experience, because real-time media needs *steady* delivery. Playback buffers hide jitter at the cost of added delay; too much jitter and the buffer under-runs, causing glitches.

**Packet loss** has an outsized effect on TCP throughput. Loss is TCP's congestion signal, so a lost packet triggers **retransmission** *and* a **congestion-window collapse** — TCP backs off hard and re-ramps via slow-start. Even 1–2% loss can cut TCP throughput dramatically, because throughput is inversely related to loss rate and RTT. And loss causes **HOL blocking** in HTTP/2 (one drop stalls all streams).

This is exactly why **real-time media (voice, video, gaming) uses UDP** (or QUIC/WebRTC over UDP):

- For a live call, a *retransmitted* packet arrives too late to be useful — the moment has passed. Better to skip it (conceal the gap) and keep playing.
- TCP's insistence on in-order reliable delivery is a *liability* here: its retransmit-and-back-off adds exactly the latency and jitter that ruins real-time.
- UDP gives up guarantees for *timeliness*; the app handles loss with concealment/FEC and jitter with a small buffer, prioritising low, steady latency over perfect delivery.

Rule of thumb: **TCP for correctness (files, APIs), UDP for timeliness (live media).**

### Q10. Explain congestion control and the TCP "sawtooth."

**Congestion control** is how TCP avoids overwhelming the network — it dynamically sizes the **congestion window (cwnd)**, the amount of unacknowledged data it will send, based on inferred network conditions.

The classic (Reno/CUBIC) behaviour is **AIMD — Additive Increase, Multiplicative Decrease**:

- **Additive increase** — while things are going well (ACKs arriving), grow cwnd *linearly*, gently probing for more capacity.
- **Multiplicative decrease** — on packet loss (the congestion signal), *halve* cwnd immediately and back off.

Plotting cwnd over time gives the characteristic **sawtooth**: a slow linear climb, a sharp drop on loss, climb again, drop again.

```text
cwnd
 │      /|      /|      /|
 │    /  |    /  |    /  |     ← additive increase (probe up)
 │  /    |  /    |  /    |
 │/      |/      |/      ↓     ← multiplicative decrease (halve on loss)
 └──────────────────────────► time
```

Phases: **slow-start** (exponential growth from small cwnd) until a threshold, then **congestion avoidance** (the linear AIMD sawtooth). Loss detected by triple-duplicate-ACK → fast recovery (halve); loss detected by timeout → back to slow-start.

Modern algorithms improve on this: **CUBIC** (Linux default) grows more aggressively on high-BDP links; **BBR** (Google) models *bandwidth and RTT directly* instead of treating loss as the only signal, which handles bufferbloat and lossy links far better. The interview point: TCP is *constantly* probing and backing off — throughput is dynamic, not fixed, and loss makes it collapse and re-climb.

### Q11. How do you measure latency, and why do percentiles and tail latency matter?

Measure latency at the right layer, and describe it with **percentiles, not averages.**

Tools:

```bash
ping acme.com              # ICMP RTT — basic reachability + round-trip time
mtr acme.com               # per-hop latency + loss along the path
curl -w "@curl-format" ... # break down DNS/connect/TLS/TTFB/total per request
```

Why percentiles over averages: latency distributions are **skewed with long tails**. An average of 50ms can hide a p99 of 800ms — meaning 1 in 100 requests is *terrible*. Users and SLOs live in the tail:

- **p50 (median)** — the typical experience.
- **p99 / p99.9** — the *tail*; the slow requests. At scale this is what users actually feel, because a single page load makes dozens of requests, so a user very likely hits your p99 on *some* of them.

**Tail latency matters more than the average** because of **fan-out amplification**: if a request fans out to 100 backends and waits for all, the *slowest* of 100 governs the response — so your p99 backend latency becomes your *median* user latency. This is why big services obsess over p99/p999 and use hedged requests, timeouts, and tail-tolerant designs. Reporting "average latency is fine" while p99 is spiking is exactly the mistake this question is designed to catch.

### Q12. How do you actually optimize network latency? Give me the playbook.

Since latency is dominated by *distance* and *round trips*, the playbook targets exactly those:

**Cut distance:**
- **CDN / edge** — serve content from a PoP near the user; the single biggest lever, because it attacks propagation delay directly.
- **Geographic distribution** — put compute/data in regions close to users; edge compute for logic.

**Cut round trips:**
- **Connection reuse / keep-alive / pooling** — escape repeated handshakes *and* slow-start.
- **TLS 1.3** — 1-RTT handshake (0-RTT resumption) vs 1.2's 2-RTT.
- **HTTP/2 multiplexing** — many requests over one warm connection; **HTTP/3/QUIC** to also kill TCP HOL.
- **Fewer requests** — bundle, batch, GraphQL/BFF aggregation; avoid chatty request waterfalls.

**Cut bytes / transfer time:**
- **Compression** (gzip/brotli), **caching** (browser + CDN), image optimization — less data = fewer round trips to transfer it.

**Cut queuing/loss:**
- **AQM (fq_codel)** to fight bufferbloat; adequate but not oversized buffers.
- **TCP tuning** — window scaling and buffer sizing for high-BDP paths; BBR for lossy links.

The meta-principle: **you can't beat physics, so stop paying its toll repeatedly.** Measure first (where is the time going — DNS? connect? TLS? TTFB? transfer?), then attack the dominant term. Reflexively "adding bandwidth" is not on this list for a reason.

### Q13. Roughly what's the speed-of-light budget for a global request?

Do the physics. Light in a vacuum is ~300,000 km/s; in fiber it's about **two-thirds** of that (~200,000 km/s), giving roughly **5µs per km**, or **1ms per 200km** one way.

Some real floors (one-way propagation, then ~RTT, before any queuing/processing):

```text
Same city (~50km):         ~0.25ms one way   → ~0.5ms RTT
Cross-country US (~4500km): ~22ms one way    → ~45ms RTT
London ↔ New York (~5500km): ~28ms one way   → ~56ms RTT
Halfway around the world (~20000km): ~100ms one way → ~200ms RTT
```

And that's the **theoretical minimum** — straight-line fiber, no queuing, no processing, one round trip. Reality is worse: fiber doesn't run in straight lines (it follows cable routes), each router adds processing, and a real request needs *multiple* round trips (DNS + TCP + TLS + HTTP). A single "simple" HTTPS request London→Sydney can easily be 1–1.5 seconds of accumulated round trips.

The takeaways interviewers want:
- **~100–200ms RTT is unavoidable for truly global distances** — no technology removes it.
- Therefore, for global users, **put content/compute near them** (CDN/edge/regional deployment) — you optimize latency by *shortening the distance*, because you can't speed up light.
- This is *why* the CDN topic is the highest-leverage latency work: it's the only thing that attacks the propagation floor.

### Q14. Why is mobile/wireless latency worse, and what changes?

Wireless adds several latency sources that wired links don't have, so even on a "fast" 5G/LTE connection, latency is higher and *far more variable* than fiber:

- **Radio scheduling & access** — a device must request and be granted a transmission slot by the tower before sending; this scheduling adds delay on each transmission, especially when the radio has gone idle and must re-establish (the "first packet after idle is slow" effect).
- **Retransmission at the link layer** — wireless is lossy (interference, fading), so the radio layer does its *own* retransmissions and error correction, adding latency and jitter beneath TCP.
- **Variable signal quality** — moving, obstacles, and cell congestion make latency swing wildly; **jitter** is much higher than wired.
- **Longer/variable paths** — traffic traverses the radio access network and mobile core before reaching the internet; older networks (3G) added hundreds of ms.
- **Power-saving states** — radios drop to low-power idle to save battery, and waking them (RRC state transitions) costs latency on the next request.

Implications for design: mobile magnifies the cost of **round trips** and **cold connections**, so connection reuse, HTTP/2/3, aggressive caching, prefetching, and minimizing chatty request-waterfalls matter *even more* on mobile. "Works fast on my office wifi" routinely means "painful on a congested cell at the edge of coverage" — which is why you test on realistic mobile network profiles, not just broadband.

### Q15. "My API is slow even though bandwidth is fine." Walk me through diagnosing it.

Bandwidth being fine is the clue: this is a **latency / round-trip / processing** problem, not a capacity one. Diagnose by decomposing where the time goes, front to back.

**1. Break down a single request's timing** — separate network from server:

```bash
curl -w "dns:%{time_namelookup} connect:%{time_connect} tls:%{time_appconnect} ttfb:%{time_starttransfer} total:%{time_total}\n" -o /dev/null -s https://api.acme.com/thing
```

- High **DNS** → slow/uncached resolver, low TTLs.
- High **connect** (TCP) → distance/RTT, or SYN retries (loss).
- High **TLS (appconnect)** → handshake round trips; are you on TLS 1.3? reusing sessions?
- High **TTFB but low transfer** → the *server* is slow (app/DB), not the network. This is the most common culprit.

**2. Distinguish the likely causes:**
- **Cold connections** — if each call opens a fresh TCP+TLS connection, you're paying handshakes + slow-start every time. Fix: keep-alive / connection pooling. Warm vs cold is often a 5x difference.
- **Round-trip waterfalls** — the endpoint internally makes serial calls (auth → service → DB → another service), each an RTT. Fix: parallelize/batch, cache, co-locate.
- **Geography** — client and server are far apart; every round trip costs the physics floor. Fix: CDN/edge, regional deployment.
- **Server processing / tail latency** — slow query, GC pause, lock contention, N+1. Check **p99**, not the average — the slowness may be intermittent (a spiky tail), not constant.

**3. The mental checklist:** DNS? handshake round trips? cold connection / slow-start? request waterfall? server-side (DB/CPU) at the tail? Bandwidth being fine rules out "the pipe is full" and points you at *round trips and processing* — which is where slow APIs almost always live.

### Q16. What TCP tuning knobs matter for performance, briefly?

A handful of kernel/socket settings materially affect throughput and latency; know what they do even if you rarely touch them.

- **Window scaling** (`net.ipv4.tcp_window_scaling`) — lets the TCP window exceed 64KB so you can fill high-**BDP** (long-fat) links. Essential for high-bandwidth, high-latency paths; on by default now.
- **Socket buffer sizes** (`tcp_rmem` / `tcp_wmem`, and autotuning) — the send/receive buffers must be ≥ BDP to keep the pipe full on long-haul transfers. Too small → throughput capped below bandwidth.
- **Congestion control algorithm** (`net.ipv4.tcp_congestion_control`) — **CUBIC** (default) for general use; **BBR** for lossy or bufferbloated paths (models bandwidth/RTT instead of treating loss as the only congestion signal) — often a big win for long-haul/video.
- **Initial congestion window** (initcwnd, ~10 segments) — larger initial window lets short connections deliver more before the slow-start ramp; helps small-response latency.
- **TCP Fast Open** (`tcp_fastopen`) — sends data in the SYN to save a round trip on connection setup (with caveats/middlebox issues).
- **`tcp_tw_reuse` / TIME_WAIT handling** — for servers churning huge numbers of short outbound connections, to avoid exhausting ephemeral ports (be careful with `tcp_tw_recycle`, which is removed/harmful behind NAT).
- **Queue discipline** (`fq_codel` / `cake` via `tc`) — AQM to fight **bufferbloat** and keep queuing latency low under load.

The framing to give: most of these are *defaults you should understand, not knobs you routinely turn.* You reach for them in specific situations — bulk transfer over long-fat networks (buffers + window scaling + BBR), high-connection-churn servers (TIME_WAIT/ephemeral ports), or latency-under-load problems (AQM). Measure first; tune the bottleneck.
## Sockets & Network Programming

### Summary

**What this topic covers**

The programmer's-eye view of the network: the **socket** — the OS abstraction your code actually holds when it talks to another machine — and everything that follows from it. This topic has 15 questions spanning what a socket *is* (protocol + local IP:port + remote IP:port, the 4-tuple that uniquely identifies a connection), the **Berkeley sockets API** call sequence that every server and client on the planet is built on, TCP vs UDP sockets, the **listen backlog**, port ranges and **ephemeral port exhaustion**, the file-descriptor nature of sockets and the `EMFILE` ceiling, **blocking vs non-blocking** I/O, **I/O multiplexing** (`select` → `poll` → `epoll`/`kqueue`), the **C10K problem** and the reactor/event-loop pattern that solved it, the classic concurrency models (thread-per-connection vs event-driven vs async), the socket options that matter in production (`TCP_NODELAY`, `SO_REUSEADDR`, `SO_REUSEPORT`, `SO_KEEPALIVE`), connection pooling, graceful shutdown and half-close, message framing over a byte stream, and zero-copy. This is where the protocol theory from earlier topics meets the code you write.

**Mental model**

A socket is a **file descriptor that happens to point at a network connection instead of a file on disk**. On Unix "everything is a file", and a socket is the network's file: you `read()` and `write()` bytes to it exactly as you would a file, and the kernel's TCP/IP stack turns those bytes into segments on the wire. The kernel owns two things you don't see directly: a **send buffer** and a **receive buffer** per socket. Your `write()` copies bytes into the send buffer and returns — it does not mean the peer received them; the stack drains that buffer at whatever rate congestion and flow control allow. Your `read()` pulls whatever is currently in the receive buffer, which may be *less* than one logical message or *more than one* — TCP is a **byte stream with no message boundaries**. That single fact drives half of all socket bugs. The other half come from treating a socket as if `write()` blocking, `read()` returning partial data, or the connection dying mid-flight were edge cases rather than the normal case.

**Key terms**

- **Socket** — the endpoint abstraction; a file descriptor bound to (protocol, local addr:port, remote addr:port).
- **4-tuple** — (src IP, src port, dst IP, dst port); uniquely identifies one TCP connection. The kernel demuxes incoming packets to sockets by this tuple.
- **Berkeley/POSIX sockets** — the standard C API (`socket`, `bind`, `listen`, `accept`, `connect`, `send`, `recv`, `close`) that every language wraps.
- **SOCK_STREAM / SOCK_DGRAM** — TCP (reliable, ordered stream) vs UDP (unreliable datagrams); `sendto`/`recvfrom` for UDP.
- **Listen backlog** — the queue of established-but-not-yet-`accept`ed connections; overflow drops or refuses new connections.
- **Ephemeral port** — the OS-assigned short-lived source port for outbound connections (Linux default 32768–60999).
- **File descriptor / EMFILE** — the small integer naming an open socket; hitting the per-process `ulimit -n` gives "too many open files".
- **Blocking vs non-blocking** — a blocking `read` sleeps until data arrives; a non-blocking one returns `EAGAIN`/`EWOULDBLOCK` immediately.
- **I/O multiplexing** — `select`/`poll`/`epoll`/`kqueue`: wait on many fds at once so one thread serves thousands of connections.
- **Reactor / event loop** — the pattern (nginx, Node, Netty, Redis) built on `epoll`: demultiplex readiness events to handlers.
- **TCP_NODELAY** — disables Nagle's algorithm (don't coalesce small writes) for latency-sensitive traffic.
- **Half-close** — one direction shut down (`shutdown(fd, SHUT_WR)` sends FIN) while the other stays open for reads.

**Why interviewers ask this**

Sockets are where a candidate reveals whether they understand the network *as an engineer who has debugged production* or as someone who has only called an HTTP library. Junior signal: "you open a socket and read the response." Senior signal: knowing that `write()` returning doesn't mean delivery, that `read()` gives you an arbitrary slice of a byte stream so you must frame messages yourself, that a server's scalability ceiling is set by its I/O model (thread-per-connection dies around 10K connections; `epoll`-based event loops scale to 100K+), and that "too many open files" and "cannot assign requested address" are *ephemeral-port and fd-limit* problems, not mysterious flakiness. For backend/SRE roles this predicts whether you can reason about why a service falls over under connection load, why connection pooling exists, and how nginx/Envoy actually serve traffic.

**Common confusions**

- "`write()` succeeded so the peer got the data" — no; it only means the bytes are in the kernel send buffer. Delivery is confirmed by protocol ACKs you never see, or by the peer's application-level response.
- "One `send` = one `recv`" — false for TCP. TCP is a stream; message boundaries are your responsibility (length-prefix or delimiter). It *is* true for UDP datagrams.
- "A socket is the port" — a socket is the whole 4-tuple; thousands of sockets share one listening port (that's how a server holds many connections on port 443).
- "Non-blocking I/O means faster I/O" — it means the call returns immediately instead of sleeping; throughput comes from *multiplexing* many fds, not from any single op being faster.
- "epoll is just a faster select" — it's algorithmically different: `select`/`poll` are O(n) in the fd set per call; `epoll` is O(ready) with kernel-side state. That difference is the C10K solution.
- "SO_REUSEADDR lets two servers share a port" — mostly it lets you rebind a port stuck in `TIME_WAIT`; `SO_REUSEPORT` is the option that actually load-balances one port across processes.

**What follows from this topic**

Sockets are the substrate under every other networking topic. The 4-tuple and `TIME_WAIT` connect back to the TCP state machine; ephemeral-port exhaustion and `TCP_NODELAY` connect to latency and congestion; the listen backlog and `epoll` event loop are how load balancers and reverse proxies (nginx/HAProxy/Envoy) multiplex thousands of connections. When you later diagnose "the API is slow under load" with `ss` and `tcpdump`, you're inspecting exactly the sockets and states described here. And connection pooling — reusing sockets to avoid repaying the handshake cost — is the client-side mirror of everything in this topic.

### Q1. What is a socket, really?

A socket is the **operating system's abstraction for one end of a network connection** — the API boundary between your application and the kernel's TCP/IP stack. Concretely it's a **file descriptor** (a small integer) that your code reads from and writes to like a file, but the bytes go to/from the network instead of disk.

A connected TCP socket is identified by a **4-tuple**: `(local IP, local port, remote IP, remote port)`. The kernel uses this tuple to demultiplex arriving packets — when a segment lands, the stack looks up which socket owns that 4-tuple and copies the payload into that socket's receive buffer. This is why one server can hold hundreds of thousands of connections on a single listening port: every connection has a different *remote* IP:port, so every 4-tuple is unique even though the local port (say 443) is shared.

Two buffers hide behind the descriptor: a **send buffer** (your `write` copies here, the stack drains it) and a **receive buffer** (the stack fills it, your `read` drains it). Almost every socket subtlety — partial reads, `write` blocking, backpressure — comes from those buffers filling or emptying.

### Q2. Walk me through the Berkeley sockets API for a TCP server and client.

The call sequence is the thing to have memorized.

**Server:**
```c
socket()   // create an endpoint -> returns an fd
bind()     // attach it to a local IP:port
listen()   // mark it passive; kernel starts queuing incoming connections (backlog)
accept()   // pull one completed connection off the queue -> a NEW fd for that client
read()/write()  // exchange bytes on the per-client fd
close()    // tear down that connection
```
`accept()` is the key: your listening socket stays listening; each `accept` hands you a *separate* connected socket for one client. You loop calling `accept` to serve many clients.

**Client:**
```c
socket()   // create endpoint
connect()  // initiate the 3-way handshake to the server's IP:port
write()/read()  // exchange bytes
close()    // send FIN, tear down
```
The client usually skips `bind` — the kernel auto-assigns an **ephemeral** source port on `connect`. `listen`/`accept` are server-only; `connect` is (normally) client-only.

### Q3. TCP sockets vs UDP sockets — what changes in the code and semantics?

| | TCP (`SOCK_STREAM`) | UDP (`SOCK_DGRAM`) |
|---|---|---|
| Type flag | `SOCK_STREAM` | `SOCK_DGRAM` |
| Connection | `connect`/`accept`, handshake | connectionless (optional `connect` just fixes the peer) |
| Data unit | byte stream, no boundaries | discrete datagrams, boundaries preserved |
| Calls | `read`/`write`, `send`/`recv` | `sendto`/`recvfrom` (address per packet) |
| Reliability | ordered, retransmitted, deduped | none — may drop, dup, reorder |
| Framing | you must frame messages | one `recvfrom` = one datagram |

The practical difference: with UDP, `recvfrom` returns exactly one datagram (or nothing) — message boundaries come for free but delivery does not. With TCP you get delivery for free but must reconstruct messages from an arbitrary byte stream yourself. UDP servers are typically a single socket handling all peers (address comes with each packet); TCP servers spawn a socket per connection via `accept`.

### Q4. What is the listen backlog and what happens when it fills?

`listen(fd, backlog)` sets the size of the kernel's **accept queue** — connections that have completed the 3-way handshake and are waiting for your app to call `accept()`. On Linux there are effectively two queues:

- **SYN queue** — half-open connections (SYN received, SYN-ACK sent, waiting for the final ACK).
- **Accept queue** — fully established, waiting for `accept()`. This is what `backlog` sizes (capped by `net.core.somaxconn`).

When the **accept queue is full**, the kernel either drops the incoming ACK (the client retransmits, appearing as a stall/latency spike) or, depending on config, refuses. When the **SYN queue** overflows under a SYN flood, SYN cookies kick in. Operationally: if your app is slow to `accept` (blocked, overloaded), the accept queue backs up and new clients see connection timeouts or long delays even though the server is "up". You can watch it with `ss -lnt` (the `Recv-Q` on a listening socket is the current accept-queue depth, `Send-Q` is the backlog limit).

### Q5. Explain ports and ephemeral port exhaustion.

Ports are 16-bit (0–65535), split by convention:
- **Well-known (0–1023)** — HTTP 80, HTTPS 443, SSH 22, DNS 53; binding these needs privilege.
- **Registered (1024–49151)** — assigned to specific apps (Postgres 5432, etc.).
- **Ephemeral (Linux default 32768–60999)** — the OS picks one of these as the *source* port for each outbound connection.

**Ephemeral port exhaustion**: each outbound TCP connection to the *same* destination IP:port consumes one ephemeral source port, held until the connection closes *and* clears `TIME_WAIT` (~60s on Linux). A service making thousands of short-lived outbound connections per second (e.g. a proxy hammering one backend) can exhaust the ~28K ephemeral ports, and new `connect()` calls fail with `EADDRNOTAVAIL` ("cannot assign requested address"). Fixes: **connection pooling / keep-alive** (reuse sockets), spread across more destination IPs/ports (the 4-tuple gives you more room), widen the ephemeral range, or enable `tcp_tw_reuse`. This is a classic production incident behind mysterious outbound-connection failures.

### Q6. Why are sockets file descriptors, and what's the "too many open files" limit?

On Unix, **everything is a file** — files, pipes, devices, and sockets all present as file descriptors, so the same `read`/`write`/`close`/`poll` calls work on all of them. That uniformity is why `epoll` can wait on a mix of sockets and pipes at once.

The cost: every open socket consumes an fd, and processes have a **per-process fd limit** (`ulimit -n`, default often 1024). A server holding many concurrent connections — plus files, plus pipes — hits the ceiling and the next `accept()`/`open()` fails with **`EMFILE` ("too many open files")**. Symptoms: the server stops accepting new connections while existing ones work, or logs flood with `EMFILE`.

```bash
ulimit -n                 # current soft limit
ls /proc/<pid>/fd | wc -l # fds a process currently holds
```
Fixes: raise the limit (`ulimit -n 100000`, `LimitNOFILE` in systemd), and fix fd leaks (sockets never `close`d). A leaking fd count that climbs monotonically is the tell.

### Q7. Blocking vs non-blocking I/O — what's the difference?

A **blocking** socket call sleeps the calling thread until it can make progress: a blocking `read()` on an empty socket parks until data arrives (or the connection closes); a blocking `write()` parks if the send buffer is full. Simple to program — one thread, straight-line code — but the thread can do nothing else while parked, so you need one thread per connection to serve many clients.

A **non-blocking** socket (`fcntl(fd, F_SETFL, O_NONBLOCK)`) never sleeps: if a `read()` has no data it returns immediately with `-1`/`EAGAIN` (a.k.a. `EWOULDBLOCK`), and a `write()` that can't fit returns `EAGAIN` or a short count. Your code must handle "not ready yet" as a normal return, which only makes sense paired with an **event notification** mechanism (`epoll`/`kqueue`) that tells you *when* the fd becomes readable/writable — otherwise you'd busy-spin. Non-blocking + multiplexing is the foundation of the event-loop model.

### Q8. Explain I/O multiplexing: select, poll, epoll.

I/O multiplexing lets **one thread wait on many sockets at once** and wake only for the ones that are ready. The evolution:

- **`select()`** — pass a bitmask of fds; kernel returns which are ready. Limited to `FD_SETSIZE` (usually 1024) and **O(n)**: it scans every fd on every call, and you rebuild the set each time. Fine for a handful of fds.
- **`poll()`** — same idea with an array instead of a bitmask, so no 1024 cap, but still **O(n)** per call — the whole array is copied to the kernel and scanned every time.
- **`epoll()` (Linux)** — you register fds once with `epoll_ctl`; `epoll_wait` then returns *only the ready ones* in **O(number of ready fds)**, with kernel-side state so nothing is rescanned or recopied. `kqueue` is the BSD/macOS equivalent. This is what lets one thread watch 100K sockets efficiently.

```c
int ep = epoll_create1(0);
epoll_ctl(ep, EPOLL_CTL_ADD, fd, &ev);   // register once
n = epoll_wait(ep, events, MAX, -1);      // returns only ready fds
```
The jump from O(n) to O(ready) is exactly what made C10K solvable.

### Q9. What is the C10K problem and how was it solved?

**C10K** (Dan Kegel, ~1999) is the question: how do you handle **10,000 concurrent connections on one machine**? The naive model — **one thread (or process) per connection** — falls over well before that: each thread costs ~1MB+ of stack plus scheduler and context-switch overhead, so 10K threads means gigabytes of RAM and a scheduler thrashing between them. And `select`/`poll` couldn't cope because they're O(n) per call.

The solution has two parts: (1) **non-blocking sockets + an O(ready) event notification mechanism** (`epoll`/`kqueue`), so a single thread can watch tens of thousands of fds cheaply; and (2) the **event-loop / reactor** architecture built on top — one (or a few) threads run a loop that waits for readiness events and dispatches tiny non-blocking handlers. nginx, Node.js, Redis, HAProxy, and Envoy are all built this way, which is why a single nginx worker serves tens of thousands of connections in a few hundred MB. The modern sequel is **C10M** (10 million), pushing work into kernel-bypass (DPDK) and userspace stacks.

### Q10. Compare thread-per-connection, event-driven, and async models.

**Thread-per-connection** (classic Java servlet, Apache prefork): one thread blocks on each connection. Dead simple to write — linear code, blocking calls — but memory and context-switch cost cap you at a few thousand connections. Great when connections are few and CPU-bound work dominates.

**Event-driven / reactor** (nginx, Node, Redis, Netty): a few threads run `epoll` loops dispatching non-blocking callbacks. Scales to 100K+ connections in little memory; ideal for I/O-bound, high-fan-out workloads. Cost: callback/"colored function" complexity, and **one blocking or CPU-heavy handler stalls the whole loop** ("don't block the event loop").

**Async / coroutines** (Go goroutines, Rust `async`, Java virtual threads, Python `asyncio`): you write straight-line code that *looks* blocking, but the runtime multiplexes it onto an event loop / small thread pool under the hood. Best of both — readable code with event-loop scalability — at the cost of a runtime/scheduler and sometimes subtle blocking-call footguns. This is where most modern servers land: Go's `net/http` gives you a goroutine per request but runs them over `epoll`.

### Q11. Which socket options matter in production?

- **`TCP_NODELAY`** — disables **Nagle's algorithm**, which otherwise buffers small writes to coalesce them into fewer packets. Nagle interacting with delayed-ACK causes ~40ms latency spikes on request/response protocols, so set `TCP_NODELAY` for anything latency-sensitive (RPC, databases, interactive). Most RPC libraries set it by default.
- **`SO_REUSEADDR`** — lets you `bind` a port still lingering in `TIME_WAIT`, so a restarted server doesn't fail with "address already in use". Standard for servers.
- **`SO_REUSEPORT`** — lets *multiple processes* bind the *same* port; the kernel load-balances incoming connections across them. Used to run N worker processes each with its own listening socket (avoids a shared-accept thundering herd).
- **`SO_KEEPALIVE`** — sends periodic probes on idle connections to detect dead peers and reap zombie connections (default interval is long — hours — so tune `tcp_keepalive_*` for faster detection).

### Q12. Why reuse connections? Explain keep-alive and connection pooling.

Opening a new TCP connection is expensive: a **TCP 3-way handshake** costs one round trip *before any data*, and if it's HTTPS, the **TLS handshake** adds another 1–2 RTTs. To a backend 50ms away, that's 100–150ms of pure setup per request — often more than the request itself.

**HTTP keep-alive** (persistent connections, default in HTTP/1.1) keeps the TCP connection open after a response so subsequent requests skip the handshake. **Connection pooling** is the client-side generalization: maintain a pool of already-established (and already-TLS'd) connections to each backend and hand them out per request, returning them afterward instead of closing. Every serious HTTP client, database driver, and service mesh sidecar pools connections.

Beyond latency, pooling avoids **ephemeral-port exhaustion** and `TIME_WAIT` buildup from churning connections (see Q5). The tradeoffs to tune: pool size (too small = queuing, too large = idle sockets and backend fd pressure), idle timeout, and max-lifetime (to pick up DNS changes and rebalance).

### Q13. Explain graceful shutdown and half-close.

TCP connections are **full-duplex** — two independent byte streams — and you can close one direction while keeping the other open. That's the **half-close**: `shutdown(fd, SHUT_WR)` sends a **FIN** on your send side, telling the peer "I'm done sending" while you can still `read` their remaining data. `close()`, by contrast, tears down both directions and releases the fd.

The canonical use: a client sends a request, calls `shutdown(SHUT_WR)` to signal end-of-request (the peer's `read` now returns EOF/0), then keeps reading the response. Servers use it for **graceful shutdown**: stop `accept`ing new connections, send FIN to signal no more data, drain in-flight requests, *then* fully close — so no client gets a mid-response `RST`. A blunt `close()` with unread data queued can instead send an `RST`, which the peer sees as "connection reset by peer". Graceful shutdown (drain, then FIN) is what lets you roll a deployment without dropping requests.

### Q14. TCP is a byte stream — how do you frame messages?

The number-one socket bug: assuming one `send` maps to one `recv`. It doesn't. TCP delivers an **undifferentiated byte stream** — a single `read` may return half a message, or two-and-a-half messages, depending on segmentation, Nagle, and buffer state. The application must impose its own message boundaries. Two standard approaches:

**Length-prefix (framing header):** write a fixed-size length field before each message, then the payload. The reader reads the length, then loops reading until it has exactly that many bytes. Robust, binary-safe, used by most RPC/binary protocols (Thrift, gRPC/HTTP2 frames, Kafka).
```
[4-byte length N][... N bytes of payload ...][4-byte length][payload]...
```

**Delimiter:** terminate each message with a sentinel (`\r\n` for HTTP headers/Redis RESP lines). Simple and human-readable, but you must escape or forbid the delimiter in the payload, so it suits text protocols.

Either way you must **loop your reads and writes**: `read` may return fewer bytes than a full frame (accumulate in a buffer), and `write` may accept fewer bytes than you gave it (a "short write" — loop until all are sent). HTTP itself combines both: `\r\n`-delimited headers, then a `Content-Length`/chunked-framed body.

### Q15. What is zero-copy (sendfile) and why does it matter?

Normally, serving a file over a socket copies the data four times: disk → kernel page cache, page cache → user-space buffer (`read`), user buffer → kernel socket buffer (`write`), socket buffer → NIC. The two user-space bounces are pure overhead when your app doesn't even look at the bytes — it's just shoveling a file to the network.

**Zero-copy** eliminates them. `sendfile()` (and `splice()`) tells the kernel to move data **directly from the page cache to the socket** without ever entering user space, cutting the copies and the associated context switches. For static-file and video serving this is a big throughput and CPU win — nginx, Kafka, and Netty all use `sendfile`. Kafka's throughput story leans heavily on it: it writes log segments to disk and `sendfile`s them straight to consumers.

The catch: zero-copy only works when you don't need to *transform* the bytes — you can't `sendfile` through TLS encryption in the classic path (though kernel TLS / `kTLS` now enables zero-copy for encrypted traffic too). It's the socket-layer manifestation of the general rule: the fastest work is the work you don't do.

## Network Troubleshooting Tools

### Summary

**What this topic covers**

The diagnostic toolkit and, more importantly, the **method** for figuring out why something on the network isn't working. This topic has 16 questions covering a systematic layer-by-layer approach (is the problem link, IP, routing, DNS, firewall, TLS, or application?) and the commands that answer each: **ping** (reachability + RTT), **traceroute/mtr** (the path), **dig** (DNS), **curl -v** (the whole HTTP+TLS+DNS+connect story with timing), **openssl s_client** (TLS handshake and cert chain), **ss/netstat** (sockets and connection states), **tcpdump/Wireshark** (packet capture), **nc/netcat** and the `/dev/tcp` bash trick (is the port open), **ip/arp** (link and routing), and **nmap** (port scanning, with the authorization caveat). It centers on the single most useful triage distinction in networking — **connection refused vs connection timeout vs DNS failure** — and walks the end-to-end "the API is slow/unreachable, diagnose it" flow.

**Mental model**

Troubleshooting is **binary search over the OSI/TCP-IP layers**. A request from your box to a service traverses: your network interface (link) → an IP route → possibly a DNS lookup to turn a name into an address → a TCP connection through firewalls → a TLS handshake → the HTTP request → the application's response. When something breaks, you don't guess — you probe each layer in order and let the *symptom* tell you which layer failed. Can you resolve the name (`dig`)? Can you reach the host at all (`ping`)? Where does the path stop (`traceroute`/`mtr`)? Is the port open, and does it **refuse** (something answered: RST) or **time out** (nothing answered: dropped)? Does TLS complete (`openssl s_client`)? Does the app respond, and how slowly (`curl -w`)? Each tool isolates one layer; the art is picking the *cheapest* probe that eliminates the most possibilities. Reach for `tcpdump` only when the higher-level tools have narrowed it and you need to see the actual packets.

**Key terms**

- **ICMP** — the protocol `ping`/`traceroute` use; note some networks block it, so "ping fails" ≠ "host down".
- **RTT** — round-trip time; `ping`'s latency number and the floor on every request.
- **Connection refused (RST)** — you reached the host but **nothing is listening** on that port; you got an active rejection.
- **Connection timeout** — packets were **silently dropped** (firewall/blackhole/host down); no answer at all.
- **NXDOMAIN / SERVFAIL** — DNS "name doesn't exist" vs "resolver failed"; different root causes.
- **Recursive resolver** — the DNS server (`/etc/resolv.conf`) you ask; `dig @host` overrides it.
- **Socket state** — `LISTEN`, `ESTABLISHED`, `TIME_WAIT`, `SYN-SENT`, `CLOSE_WAIT` — `ss` shows these; states diagnose *where* a connection is stuck.
- **pcap** — packet capture file (`tcpdump -w`), openable in Wireshark.
- **BPF filter** — the `host x and port y` expressions that narrow a capture.
- **Path MTU** — the smallest MTU along the route; a black-holed PMTU causes hangs on large payloads only.
- **Anycast** — one IP served from many locations; complicates "which server am I even hitting?"
- **Banner grab** — connecting raw (`nc`) to see what a service announces.

**Why interviewers ask this**

This is the most *practical* networking topic and the one that separates people who have carried a pager from people who have only read about networks. The junior answer to "the site is down" is "restart it" or "it's probably DNS"; the senior answer is a **method** — a deliberate sequence of probes that isolates the failing layer in minutes, plus fluency reading the output (a `RST` vs a timeout, a `SERVFAIL` vs `NXDOMAIN`, where `mtr` shows loss starting). Interviewers use "the API is unreachable/slow, walk me through diagnosing it" as an open-ended stage where they watch whether you form hypotheses, pick discriminating tests, and interpret results — exactly the SRE loop. Knowing the tools is table stakes; knowing *which one to reach for and what its output means* is the signal.

**Common confusions**

- "Ping failed, so the host is down" — many hosts and firewalls drop ICMP while serving TCP fine. Confirm with a TCP probe (`nc -zv`, `curl`) before declaring it dead.
- "Connection refused and connection timeout are the same failure" — they're opposite diagnoses: refused = reached host, port closed (RST); timeout = never reached / firewall dropped. This is the single most important triage distinction.
- "traceroute shows the exact latency to each hop" — intermediate hops deprioritize ICMP TTL-exceeded replies, so a middle hop showing high latency or `*` is often normal; only the *destination* row is authoritative.
- "curl works but the browser doesn't (or vice-versa)" — different DNS caches, proxies, TLS versions, and SNI; that divergence is itself a clue, not noise.
- "netstat/ss numbers are the app" — a pile of `CLOSE_WAIT` means *your app* isn't closing sockets; a pile of `TIME_WAIT` is normal on the active-close side. States point at *who* failed to close.

**What follows from this topic**

These tools are how every other topic gets *verified* in the real world: the TCP handshake and states you learned appear literally in `tcpdump` and `ss`; the DNS hierarchy shows up in `dig +trace`; the TLS handshake is what `openssl s_client` prints; connection refused vs timeout is the socket-layer `RST`-vs-drop distinction made visible. This topic is the bridge from theory to on-call practice, and it feeds directly into **Network Security & Attacks** — the same `nmap`, `tcpdump`, and packet analysis are what attackers *and* defenders use, and the "is this traffic normal?" judgment starts with knowing what normal looks like in these tools.

### Q1. How do you approach network troubleshooting systematically?

Work the **layers in order**, from local outward, and let each result eliminate possibilities — don't jump straight to `tcpdump`.

1. **Is it me or them?** Can other services reach the target? Does it fail from a second host? This splits "my box" from "the network/service".
2. **Name resolution** — does the hostname resolve, and to the *right* address? `dig +short host`.
3. **Reachability** — can I reach the host at all? `ping`, and if ICMP is blocked, a TCP probe `nc -zv host port`.
4. **Path** — where does traffic stop or lose packets? `mtr host`.
5. **Port/transport** — is the port open? Do I get **refused (RST)** or a **timeout**? That distinction (Q7) points at firewall vs not-listening.
6. **TLS** — does the handshake complete and is the cert valid? `openssl s_client -connect host:443`.
7. **Application** — does the app respond, with what status and how slowly? `curl -v -w`.

The discipline is picking the **most discriminating cheap test first**. "It's slow" and "it's down" branch differently: down → walk reachability/port; slow → `curl -w` timing breakdown to see *which phase* (DNS? connect? TLS? server processing?) is eating the time.

### Q2. How do you use ping, and how do you read its output?

`ping` sends **ICMP echo request** packets and times the **echo replies** — it answers "can I reach this host and what's the round-trip latency?"

```bash
ping -c 4 example.com
# 64 bytes from 93.184.216.34: icmp_seq=1 ttl=56 time=11.4 ms
# --- statistics --- 4 packets transmitted, 4 received, 0% packet loss
```
Read three things: **loss %** (any loss on a stable link is a red flag), **RTT** (the `time=` — your latency floor), and **jitter** (variance across replies — spiky RTT hints at congestion/bufferbloat).

Distinguish the failures:
- **"Request timeout"** — no reply; host down, unreachable, *or ICMP is just being dropped by a firewall*. Not proof the host is dead — confirm with a TCP probe.
- **"Unknown host" / "Name or service not known"** — DNS failed before any packet was sent; a resolution problem, not a reachability one.
- **"Destination host/net unreachable"** — a router actively told you it has no route (ICMP unreachable); a routing problem.

Because many hosts drop ICMP, ping success is strong evidence but ping *failure* is weak — always corroborate.

### Q3. Explain traceroute and mtr.

**traceroute** reveals the **path** — every router hop between you and the destination. It works by sending packets with increasing **TTL**: TTL=1 expires at the first router (which replies ICMP "time exceeded"), TTL=2 at the second, and so on, so each hop reveals itself.

```bash
traceroute example.com
# 1  router.lan (192.168.1.1)  0.5 ms
# 2  * * *                        <- hop not replying (or ICMP deprioritized)
# 8  example.com (93.184.x.x)   12 ms
```
Reading it: find **where latency jumps** or where hops turn to `* * *` and stay that way. A single middle hop with high latency or stars is usually *not* a problem — routers deprioritize generating ICMP replies. Only sustained loss *from a hop through the destination*, or the destination never appearing, indicates a real break.

**mtr** is traceroute + ping combined and *continuous* — it re-probes every hop repeatedly and shows a live loss/latency table per hop, which is far better for **intermittent** problems:
```bash
mtr -rw example.com   # report mode: Loss%, Avg, Best, Wrst per hop
```
Loss that *starts* at hop N and persists through the end points at hop N (or its link); loss at one hop that clears afterward is just that router rate-limiting ICMP.

### Q4. How do you debug DNS with dig?

`dig` is the DNS Swiss army knife — it shows exactly what a resolver returns, which is essential because "it works in the browser" hides caching.

```bash
dig example.com +short              # just the answer: 93.184.216.34
dig example.com A                   # full answer section, TTL, flags
dig @1.1.1.1 example.com            # ask a SPECIFIC resolver (bypass local cache)
dig example.com +trace              # walk root -> TLD -> authoritative yourself
dig -x 93.184.216.34                # reverse lookup (PTR)
dig example.com MX                  # mail records; swap for NS, TXT, CNAME, SOA
```
Key techniques: **`@resolver`** to compare your cache against an authoritative/public resolver (divergence = stale cache or a propagation issue); **`+trace`** to see the full delegation chain and catch a broken NS or a lame delegation; **TTL** in the answer tells you how long a stale record will linger. Distinguish **NXDOMAIN** (the name genuinely doesn't exist) from **SERVFAIL** (the resolver couldn't get an answer — often DNSSEC failure or an unreachable authoritative server). `nslookup`/`host` are lighter alternatives, but `dig` is the one that shows you everything.

### Q5. What can curl -v tell you, and how do you read the timing?

`curl -v` narrates the **entire request lifecycle** — DNS, TCP connect, TLS handshake, request, response — which is why it's often the single most useful command.

```bash
curl -v https://example.com
# * Trying 93.184.216.34:443...          <- DNS resolved, connecting (TCP)
# * Connected to example.com ... port 443 <- TCP handshake done
# * TLSv1.3 ... SSL connection using...   <- TLS handshake done, cipher shown
# * Server certificate: subject/issuer... <- cert chain
# > GET / HTTP/2                          <- request headers (>)
# < HTTP/2 200                            <- response headers (<)
```
Each line's prefix — `*` info, `>` sent, `<` received — tells you exactly how far it got. If it dies at "Trying..." it's a **connect** problem (firewall/timeout); if at the TLS lines, a **cert/TLS** problem; if you get `< HTTP/2 500`, the network is fine and it's the **app**.

Power flags:
- `-I` — headers only (HEAD request).
- `-L` — follow redirects (see the whole 301/302 chain).
- `--resolve example.com:443:10.0.0.5` — **override DNS** to test a specific backend/new IP before cutting DNS over.
- `-w` — a **timing breakdown** that pinpoints the slow phase:
```bash
curl -s -o /dev/null -w \
  'dns:%{time_namelookup} connect:%{time_connect} tls:%{time_appconnect} ttfb:%{time_starttransfer} total:%{time_total}\n' \
  https://example.com
```
If `ttfb` is huge but `connect`/`tls` are tiny, the network is fine and the **server** is slow; if `time_namelookup` dominates, it's **DNS**.

### Q6. How do you inspect a TLS handshake and certificate with openssl?

`openssl s_client` opens a raw TLS connection and dumps the handshake and certificate chain — the tool when HTTPS "just doesn't work" and you suspect certs.

```bash
openssl s_client -connect example.com:443 -servername example.com
```
`-servername` sends **SNI** (required for virtual-hosted TLS — without it you may get the wrong/default cert). Read the output for:
- **`Verify return code: 0 (ok)`** vs an error like `unable to get local issuer certificate` (a broken/incomplete **chain** — the server didn't send intermediates) or `certificate has expired`.
- The **certificate chain** (`Certificate chain` block) — is the full path leaf → intermediate → root present?
- **Protocol/cipher** negotiated (e.g. `TLSv1.3`).

Handy follow-ups:
```bash
# expiry dates:
openssl s_client -connect example.com:443 -servername example.com </dev/null 2>/dev/null \
  | openssl x509 -noout -dates
# is a specific TLS version refused?
openssl s_client -connect example.com:443 -tls1_2
```
A very common real bug this catches: the cert works in browsers (which cache intermediates) but fails in `curl`/apps because the server forgot to send the **intermediate** certificate.

### Q7. Connection refused vs connection timeout — what's the difference? (crucial)

This is the highest-value triage distinction in networking, and it comes down to **did anything answer?**

| | Connection refused | Connection timeout |
|---|---|---|
| Wire event | Host sent a **TCP RST** | Packets **silently dropped**, no reply |
| Meaning | Reached the host; **nothing listening** on that port (or the service crashed) | Never reached the service — **firewall** dropping, host down, or wrong route |
| Speed | **Immediate** | **Hangs** then times out (SYN retries, ~tens of seconds) |
| Typical cause | Service not started / crashed / wrong port | Firewall/security-group blocking, blackhole, host offline |

The mental model: **refused** means you knocked and someone shouted "nobody home for that" — the host is up, the port is closed. **Timeout** means you knocked and there was dead silence — your packets vanished, usually into a firewall's `DROP` rule.

Fast test:
```bash
nc -zv host 443        # "Connection refused" vs hanging then "timed out"
curl -v --connect-timeout 5 http://host:443
```
This immediately branches your investigation: refused → look at the *service* (is it running? right port? bound to `0.0.0.0` not `127.0.0.1`?); timeout → look at the *path* (security group, firewall, routing, is the host even up?).

### Q8. How do you find listening ports and connection states with ss/netstat?

`ss` (the modern replacement for `netstat`) shows sockets and their states — essential for "is my service even listening?" and "what's stuck?"

```bash
ss -tlnp          # TCP, Listening, numeric, with process  <- what's listening & who owns it
ss -tnp           # all TCP connections + owning process
ss -tn state time-wait | wc -l   # count TIME_WAIT sockets
ss -s             # summary counts by state
```
`-t` TCP, `-u` UDP, `-l` listening, `-n` numeric (skip DNS), `-p` process. The classic uses:
- **"Is it listening, and on which address?"** — `ss -tlnp | grep :5432`. If it's bound to `127.0.0.1:5432` instead of `0.0.0.0:5432`, remote clients get **connection refused** — a super common cause of Q7's refused case.
- **Who owns a port?** — the `-p` column gives PID/process, for "address already in use".
- **State diagnosis** — many **`TIME_WAIT`** on the client is normal (active-close side); many **`CLOSE_WAIT`** means *your app received a FIN but never called `close()`* — an fd leak in your code. Lots of **`SYN-SENT`** stuck means your outbound `connect`s aren't completing (Q7 timeout).

### Q9. When and how do you use tcpdump?

`tcpdump` captures actual packets off an interface — the tool of last resort when higher-level tools have narrowed the problem and you need ground truth (Is the SYN even leaving? Who's sending the RST? Is it retransmitting?).

```bash
tcpdump -ni eth0 host 10.0.0.5 and port 443   # filter to one peer+port, numeric
tcpdump -ni any 'tcp[tcpflags] & tcp-syn != 0' # just SYNs
tcpdump -ni eth0 port 53                       # watch DNS
tcpdump -w capture.pcap host 10.0.0.5          # write to file for Wireshark
```
Always use **`-n`** (skip DNS resolution so the capture doesn't itself generate traffic and lag) and a **BPF filter** (`host`, `port`, `tcp`, `and`/`or`) to avoid drowning in traffic. Reading a handshake:
```
IP a.1234 > b.443: Flags [S]     <- SYN (client -> server)
IP b.443 > a.1234: Flags [S.]    <- SYN-ACK
IP a.1234 > b.443: Flags [.]     <- ACK  (handshake complete)
```
Seeing a `[S]` with no `[S.]` reply = packets dropped (firewall/timeout). Seeing `[R]` (RST) right after the SYN = **refused**. Repeated `[S]` retransmits = the SYN-ACK isn't coming back. For deep analysis, `-w` a pcap and open it in **Wireshark**, which decodes protocols, follows a TCP stream, and flags retransmissions/out-of-order segments graphically.

### Q10. What is nc/netcat good for?

`nc` is the "just connect me a raw TCP/UDP socket" tool — perfect for quick port and connectivity checks.

```bash
nc -zv host 443           # is the port open? -z scan (no data), -v verbose
nc -zv host 20-25         # scan a small port range
nc -zvu host 53           # UDP check
nc -l 8080                # quick listener (test whether traffic reaches you)
echo -e "GET / HTTP/1.0\r\n" | nc example.com 80   # hand-craft a request / banner grab
```
The most common use is **`nc -zv host port`** to answer Q7's question cleanly: it prints "succeeded", "Connection refused", or hangs (timeout). Running `nc -l <port>` on one host and connecting from another isolates **which direction** a firewall is blocking — if the listener never sees the connection, traffic is dropped inbound. **Banner grabbing** (connecting and reading what the service announces) identifies what's actually running on a port.

There's also the pure-bash trick when `nc` isn't installed:
```bash
timeout 2 bash -c '</dev/tcp/host/443' && echo open || echo closed
```
Bash's `/dev/tcp/host/port` pseudo-device opens a TCP connection with no external tool — handy on minimal containers.

### Q11. Explain the ip and arp commands.

The `ip` suite (replacing legacy `ifconfig`/`route`) inspects the **link and network layers** on your own host — the first things to check for local misconfiguration:

```bash
ip addr           # interfaces and their IP addresses (do I even have an IP?)
ip route          # the routing table (what's my default gateway?)
ip route get 10.0.0.5   # which route/interface would be used to reach this IP
ip neigh          # the ARP/neighbor cache (L2 -> L3 mappings)
```
`ip route get <dest>` is underused and excellent: it tells you *exactly* which interface and gateway a packet to that destination would use — instantly catching "wrong default route" or "this traffic is going out the VPN when it shouldn't."

**ARP** maps IP addresses to **MAC addresses** on the local L2 segment. `ip neigh` (or legacy `arp -n`) shows the cache; a `FAILED`/incomplete entry for your gateway means an L2 problem (the host can't even find the router's MAC). ARP is also where **ARP spoofing** attacks live (a LAN MITM), which ties into the security topic. If `ip addr` shows no address or `ip route` has no default gateway, you've found the problem before touching anything remote.

### Q12. What is nmap and when is it appropriate?

`nmap` is a **port scanner and network mapper** — it probes a host (or range) to discover which ports are open, what services/versions run, and sometimes the OS.

```bash
nmap -p 1-1000 host        # scan the first 1000 ports
nmap -sV host              # service/version detection on open ports
nmap -Pn host              # skip host-discovery ping (useful when ICMP is blocked)
```
Legitimate uses: auditing **your own** infrastructure ("what ports did we accidentally leave exposed?"), verifying that a firewall change actually closed a port, and inventory. It's the fast way to answer "is anything listening I don't know about?"

**Authorization caveat (say this in an interview):** scanning hosts you don't own or lack explicit permission to test is, in many jurisdictions, illegal and will trip intrusion-detection systems. Only scan assets you own or have written authorization to assess. From the defensive side, unexpected nmap-style scans against your network are reconnaissance you should *detect and alert on* — which is exactly the bridge to the Network Security topic.

### Q13. How do you diagnose MTU / path-MTU problems?

MTU issues have a signature symptom: **small requests work, large ones hang** — SSH connects but a big transfer stalls, TLS handshake starts but wedges when the big certificate/data packet flows. That's because somewhere on the path an MTU is smaller than your packets, and if the ICMP "fragmentation needed" messages that would signal it are being dropped (a **PMTU black hole**), large packets just vanish with no error.

Probe it with a **don't-fragment ping** of increasing size:
```bash
# -M do = set Don't Fragment; -s = payload size (add 28 for IP+ICMP headers)
ping -M do -s 1472 host   # 1472+28 = 1500, standard Ethernet MTU
ping -M do -s 1473 host   # if this fails but 1472 works -> path MTU is 1500
# "Frag needed and DF set (mtu = 1400)"  <- the path MTU is smaller than 1500
```
When the largest size that succeeds is below 1500, something (often a **VPN/tunnel** or PPPoE link, which add encapsulation overhead) has a smaller MTU. Fixes: lower the interface MTU, or enable **MSS clamping** on the gateway so TCP negotiates a segment size that fits. This is a favorite "we only see it with big payloads / only over the VPN" mystery.

### Q14. How do you measure throughput vs latency?

Don't conflate them. **Latency** (RTT) is measured with `ping`/`curl -w` and is bounded by distance (speed of light). **Throughput** (bits/sec you can actually push) is a different question, and `ping` tells you nothing about it.

For throughput, **`iperf3`** is the standard — run a server on one host and a client on the other:
```bash
# on the server:
iperf3 -s
# on the client:
iperf3 -c server-host           # TCP throughput
iperf3 -c server-host -u -b 100M  # UDP at 100 Mbit/s (also reports loss/jitter)
```
It reports sustained bandwidth (and, for UDP, packet loss and jitter). Key insight for interviews: **more bandwidth doesn't fix latency**, and on a high-latency link TCP throughput can be capped by the **bandwidth-delay product** vs the window size, not by the link's raw capacity — so a "slow" transfer over a long fat pipe is often a window-tuning issue, not a bandwidth shortage. `curl -w`'s `speed_download` gives a quick real-world throughput number for an actual HTTP object without setting up iperf.

### Q15. Walk me through diagnosing "the API is unreachable" or "the API is slow."

I narrate it as a **layer walk**, branching on unreachable vs slow.

**Unreachable — isolate the failing layer top-down:**
```bash
dig +short api.example.com          # 1. does it resolve? to the right IP?
ping -c3 <that-ip>                   # 2. reachable? (ICMP may be blocked - weak signal)
nc -zv <ip> 443                      # 3. port open? REFUSED vs TIMEOUT (Q7 branch)
openssl s_client -connect api.example.com:443 -servername api.example.com  # 4. TLS ok?
curl -v https://api.example.com/health   # 5. does the app answer? what status?
```
The first step that fails names the culprit: no DNS → resolver/record problem; DNS ok but `nc` **refused** → service down or bound to the wrong interface; `nc` **timeout** → firewall/security-group/route; TLS error → cert/chain; HTTP 5xx → the app, network's fine.

**Slow — find which phase is slow with the timing breakdown:**
```bash
curl -s -o /dev/null -w \
 'dns:%{time_namelookup} conn:%{time_connect} tls:%{time_appconnect} ttfb:%{time_starttransfer} total:%{time_total}\n' \
 https://api.example.com
```
- `time_namelookup` large → **DNS** (slow/failing resolver).
- `time_connect` large → **network path / TCP** — check `mtr` for loss/latency.
- `time_appconnect` large → **TLS** negotiation cost.
- `ttfb` large but connect/tls tiny → the **server** is slow (app/DB), not the network — correlate with the service's own latency metrics and logs.

Then corroborate: compare from a second host (mine vs everyone's), check `ss -s`/`ss state syn-sent` for stuck connects, and only if it's still murky, `tcpdump` the handshake to see retransmits. Throughout, **correlate with logs and metrics** on both ends and, if the layer walk points at infrastructure you don't own, **escalate with the specific evidence** (the failing hop from `mtr`, the RST in `tcpdump`) rather than "it's slow."

### Q16. When do you escalate to a packet capture, and how do you correlate evidence?

Packet capture (`tcpdump`/Wireshark) is powerful but expensive to collect and read, so it's the **last** tool, not the first. Escalate to it when the higher-level tools have **narrowed the layer but disagree with the app's story**: `curl` says connection reset but the server logs show nothing; a connection "hangs" and you need to see whether SYNs leave and SYN-ACKs return; you suspect **retransmissions**, out-of-order delivery, or a mystery `RST` and need to know *which side* sent it. Capture on **both ends simultaneously** with a tight BPF filter (`host X and port Y`) so you can prove whether a packet that left one host ever arrived at the other — that single comparison resolves most "is it the network or the app?" arguments.

**Correlation** is the meta-skill: line up the packet capture, the app logs, the load balancer/proxy access logs, and the metrics **on a shared timeline** (synchronized clocks matter). A 500 in the app log at the same millisecond as a `RST` in the capture and a latency spike in the dashboard tells a coherent story; evidence from only one layer is a guess. Escalate to another team when your evidence points cleanly *outside* your boundary — e.g. `mtr` shows loss beginning at the ISP's hop, or the capture proves your SYN left and no SYN-ACK ever came back — and hand them the artifact (the pcap, the traceroute), not just "it's slow."

## Network Security & Attacks

### Summary

**What this topic covers**

Securing the network and understanding how it's attacked — the two sides of the same coin. This topic has 16 questions covering the **CIA triad** applied to the network (confidentiality, integrity, availability), **encryption in transit** and why plaintext protocols leak, **man-in-the-middle** attacks and how TLS + certificate validation stop them (and how that defense fails — untrusted CAs, ignored warnings, **SSL stripping** → HSTS), **DDoS** in its three flavors (volumetric, protocol/SYN-flood, application-layer) and mitigations, **DNS attacks** (cache poisoning, hijacking, and DNSSEC/DoH defenses), **ARP spoofing** (LAN MITM), **IP spoofing** and BCP38, **port scanning/reconnaissance**, firewalls and segmentation as defense, **VPNs** (IPsec/WireGuard/OpenVPN, site-to-site vs remote-access, split vs full tunnel), **zero-trust networking** and why a VPN is not zero trust, **service-to-service auth** (mTLS, SPIFFE/SPIRE), **rate limiting and WAFs**, TLS best practices, and the classic **exposure mistakes** (databases/Redis on `0.0.0.0`, SSRF, missing egress control). It closes with a "secure the network for a web service" scenario built on **defense in depth**.

**Mental model**

Network security is **defense in depth against an attacker who is already on the wire**. Assume the network is hostile: packets can be read, forged, replayed, redirected, and flooded. Every defense maps to one leg of the CIA triad — **confidentiality** via encryption in transit (TLS everywhere), **integrity** via authentication and cert/MAC validation (so a forged or altered packet is rejected), and **availability** via rate limiting, capacity, and DDoS mitigation. The old model was **perimeter security**: a hard firewall shell, a soft trusted interior. That model is dead — one breached host inside the perimeter owns everything. The modern model is **zero trust**: there is no trusted network location; every request is authenticated and authorized on its own merits, and services prove their identity to each other (mTLS) regardless of which network they're on. So you think in layers: encrypt every hop, authenticate every party, default-deny both ingress *and* egress, and assume any single control will fail — which is why you stack them.

**Key terms**

- **CIA triad** — Confidentiality (no eavesdropping), Integrity (no tampering), Availability (stays up).
- **MITM** — attacker sits between two parties, reading/altering traffic; defeated by TLS + cert validation.
- **SSL stripping** — downgrading a victim from HTTPS to HTTP so traffic is plaintext; defeated by **HSTS**.
- **HSTS** — `Strict-Transport-Security` header forcing browsers to use HTTPS only, closing the stripping window.
- **DDoS** — distributed denial of service; volumetric, protocol (SYN flood), or application-layer (L7).
- **Amplification/reflection** — spoof the victim's IP, send small queries to DNS/NTP that reply with huge responses *to the victim*.
- **DNS cache poisoning** — injecting forged records into a resolver's cache; DNSSEC signs records to prevent it.
- **ARP spoofing** — forging ARP replies to become the LAN gateway (MITM); mitigated by dynamic ARP inspection.
- **IP spoofing** — forging the source IP; **BCP38** ingress filtering by ISPs limits it.
- **VPN** — encrypted tunnel (IPsec/WireGuard/OpenVPN); site-to-site or remote-access, split or full tunnel.
- **Zero trust** — never trust network location; verify identity on every request (BeyondCorp, mTLS).
- **mTLS / SPIFFE** — mutual TLS so *both* sides prove identity; SPIFFE/SPIRE issues workload identities.
- **WAF** — application-layer firewall filtering SQLi/XSS/OWASP attacks and rate-limiting L7.

**Why interviewers ask this**

Security is where backend/SRE candidates reveal whether they think about *the adversary* or only the happy path. The junior signal is "we use HTTPS" as a talisman; the senior signal is understanding *what HTTPS actually protects against* (eavesdropping and tampering — via encryption + cert validation), *how it fails* (ignored cert warnings, SSL stripping, an untrusted CA), and *what it doesn't cover* (authorization, a compromised endpoint). Interviewers probe the difference between **authentication and encryption**, whether you'd put a database on `0.0.0.0`, whether you understand a VPN is a tunnel and *not* an identity/authorization system, and whether you can reason about DDoS classes and their distinct mitigations. For any role touching production, they want evidence you'd design **defense in depth** — encrypt, authenticate, segment, rate-limit, default-deny egress — rather than trusting a single perimeter firewall.

**Common confusions**

- "HTTPS means we're secure" — TLS protects data *in transit* against eavesdropping and tampering; it does nothing about authorization, injection, a compromised server, or a user clicking through a cert warning.
- "A VPN makes us secure / is zero trust" — a VPN is an encrypted tunnel that extends the network perimeter; once on it, a user/host is often *fully trusted*, which is the opposite of zero trust. VPN ≠ identity-based access control.
- "Encryption and authentication are the same" — encryption hides data (confidentiality); authentication proves identity (integrity/trust). TLS does both, but a self-signed cert gives you encryption *without* trustworthy authentication — which is exactly the MITM hole.
- "Our firewall blocks inbound, so we're protected" — egress matters as much: exfiltration, C2 callbacks, and SSRF all abuse *outbound* connections. Default-deny egress too.
- "DDoS is just a big flood" — there are distinct classes (volumetric, protocol/SYN, L7) with distinct mitigations; a WAF stops L7 floods but not a 500 Gbps volumetric attack, which needs upstream scrubbing/CDN/anycast.
- "Internal traffic doesn't need encryption" — the perimeter assumption; one compromised host makes your plaintext internal traffic an open book. Zero trust encrypts east-west (mTLS) too.

**What follows from this topic**

This topic is the security lens over everything earlier: TLS (from the protocols topic) is the confidentiality/integrity mechanism; the TCP handshake is what SYN floods abuse; DNS (its hierarchy and caching) is what poisoning and hijacking target; firewalls and load balancers are where segmentation, WAFs, and rate limiting live; and the diagnostic tools (`nmap`, `tcpdump`) are the same ones attackers and defenders use — reconnaissance you must *detect*. It also connects to the sockets topic (exposure = binding to `0.0.0.0`, egress control) and to system design broadly (zero trust and mTLS are architectural choices). If you can articulate defense in depth for a web service — encrypt in transit, authenticate every party, segment and default-deny both directions, rate-limit and WAF at L7, and assume any one control fails — you've tied the whole primer together.

### Q1. Apply the CIA triad to network security.

The **CIA triad** is the frame for *what* you're protecting, and each leg maps to concrete network defenses:

- **Confidentiality** — keep data unreadable to eavesdroppers on the wire. Mechanism: **encryption in transit** (TLS, IPsec, WireGuard). Threat it counters: passive sniffing / MITM reading traffic.
- **Integrity** — ensure data isn't altered or forged in flight, and that you're talking to who you think. Mechanisms: **authentication + message authentication codes** — TLS's cert validation and MACs, mTLS, DNSSEC signatures. Threat: tampering, injection, spoofing.
- **Availability** — keep the service reachable for legitimate users. Mechanisms: **rate limiting, capacity, DDoS mitigation** (CDN/anycast/scrubbing), redundancy. Threat: DoS/DDoS, resource exhaustion.

The value of the triad in an interview is that it forces you to name *which* property a control protects. HTTPS gives you confidentiality *and* integrity but nothing for availability — a DDoS still takes you down. A WAF and rate limiter protect availability and block injection (integrity) but don't encrypt. Good design covers all three deliberately, not by accident.

### Q2. Why do plaintext protocols leak, and what's the fix?

Anything sent unencrypted can be **read and modified by anyone on the path** — your local network, every router in between, the coffee-shop WiFi, a compromised switch. Plaintext protocols (HTTP, FTP, Telnet, plain SMTP, unencrypted database connections) put credentials, session tokens, and data on the wire in the clear. A passive attacker with a `tcpdump` on any hop sees it all; an active one can alter it (inject content, strip security headers).

The fix is **encryption in transit everywhere**: HTTPS instead of HTTP, SSH instead of Telnet, FTPS/SFTP instead of FTP, TLS on database and Redis connections, and encrypted service-to-service traffic (mTLS) even *inside* your own datacenter. TLS provides **confidentiality** (eavesdroppers see ciphertext) and **integrity** (tampering is detected via MACs) and, with proper cert validation, **authentication** (you're talking to the real server). The old excuse "it's internal, it's fine" is the perimeter fallacy — zero trust says encrypt east-west traffic too, because one foothold inside turns all your plaintext into a free read.

### Q3. Explain man-in-the-middle attacks and how TLS prevents them.

A **MITM** attacker positions themselves between two parties — via ARP spoofing on a LAN, a rogue WiFi AP, DNS hijacking, or BGP hijacking — so all traffic flows through them to be read or altered. Against plaintext, MITM is trivial and total.

**TLS defeats it with two mechanisms working together:**
1. **Encryption** (from the key exchange) means even sitting in the middle, the attacker sees only ciphertext — confidentiality.
2. **Certificate validation** means the client verifies the server's certificate is (a) signed by a **trusted CA**, (b) for the **right hostname**, and (c) **not expired/revoked**. An attacker can't present a valid cert for `example.com` because they can't get a trusted CA to sign one for a domain they don't control. This is the *authentication* half, and it's what actually stops MITM — encryption alone to an attacker's own cert would be encrypted-to-the-wrong-party.

**How the defense fails** (the interview follow-up):
- **Untrusted/rogue CA** — if the attacker can install a CA in the victim's trust store (corporate MITM proxies, malware), they can mint valid-looking certs. This is how TLS-inspecting proxies work.
- **Ignored cert warnings** — if the user clicks through "this connection is not private," they hand the session to the attacker.
- **SSL stripping** — the attacker keeps the *victim* on HTTP and only speaks HTTPS to the server, so the victim never gets a cert to validate (see Q4).

### Q4. What is SSL stripping and how does HSTS stop it?

**SSL stripping** (Moxie Marlinspike) is a MITM technique that never breaks TLS — it *avoids* it. The attacker sits between the victim and the site: it speaks **HTTPS to the real server** but serves the victim plain **HTTP**, rewriting `https://` links to `http://`. The victim's browser, if it started with `http://` (typing `example.com` defaults to HTTP), never sees a certificate to validate, sees a normal-looking page, and sends everything — including the login — in plaintext to the attacker, who relays it onward. No cert warning fires because there's no TLS on the victim's side.

**HSTS (HTTP Strict Transport Security)** closes the window. The server sends:
```
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
```
After seeing this once, the browser **refuses to make any plaintext HTTP request** to that domain for `max-age` seconds — it upgrades every request to HTTPS *before* it leaves, so there's no plaintext request for the attacker to intercept. The **`preload`** list (baked into browsers) even protects the very first visit, eliminating the trust-on-first-use gap. HSTS is why "just use HTTPS" is incomplete advice — without HSTS, the *downgrade* to HTTP is the hole.

### Q5. Explain the types of DDoS attacks and their mitigations.

**DDoS** overwhelms a target from many sources so legitimate users can't get through. Three classes, each attacking a different layer with a distinct mitigation:

| Class | How it works | Mitigation |
|---|---|---|
| **Volumetric** | Saturate the *bandwidth* with sheer volume, often via **amplification/reflection** (spoof victim's IP, send tiny queries to open DNS/NTP/memcached servers that reply with huge responses to the victim — 50x+ amplification) | Absorb upstream: **CDN/anycast** spreads load across many POPs; **scrubbing centers** filter; you can't fix a 500 Gbps flood at your own edge |
| **Protocol (L3/L4)** | Exhaust connection-tracking resources, classically the **SYN flood** — send SYNs, never complete the handshake, filling the backlog | **SYN cookies** (encode state in the SYN-ACK so no half-open state is kept), firewall rate limits, stateful filtering |
| **Application (L7)** | Look like real traffic — flood expensive endpoints (search, login, `POST`) to exhaust CPU/DB with far less bandwidth | **WAF + rate limiting**, caching, CAPTCHA/challenge, per-IP/token quotas, bot detection |

The interview point: **mitigations don't cross classes.** A WAF and rate limiter do nothing against a volumetric flood that fills your pipe upstream; anycast/scrubbing does nothing about an L7 flood of valid-looking requests hitting your database. Real defense layers all three — CDN/anycast for volume, SYN cookies for protocol, WAF/rate-limiting for L7 — plus **anycast** to spread and localize attack traffic.

### Q6. What are the main DNS attacks and defenses?

DNS is a high-value target because whoever controls name resolution controls where traffic goes.

- **Cache poisoning / spoofing** — inject forged records into a resolver's cache (classically by racing the real answer with a guessed query ID/source port, the Kaminsky attack), so users of that resolver get sent to the attacker's IP. Defenses: source-port randomization + query-ID randomization (raised the bar), and cryptographically, **DNSSEC**, which signs records so a resolver can verify authenticity and reject forgeries.
- **DNS hijacking** — redirect resolution by compromising the registrar account, changing NS records, or altering the resolver a client uses (malware editing `/etc/resolv.conf` or router DNS). Defenses: registrar lock, MFA on registrar, monitoring your NS records.
- **Eavesdropping/manipulation on the wire** — plain DNS is UDP plaintext, so on-path attackers see and can tamper with queries. Defenses: **DoH (DNS over HTTPS)** and **DoT (DNS over TLS)** encrypt the client↔resolver hop.

The nuance to state: **DNSSEC provides integrity/authenticity** (records aren't forged) but *not* confidentiality — queries are still visible; **DoH/DoT provide confidentiality** of the query but don't by themselves authenticate the record data. They're complementary, addressing different legs of CIA.

### Q7. Explain ARP spoofing and how to defend against it.

**ARP** resolves an IP to a MAC on the local L2 segment, and it's **unauthenticated** — a host simply broadcasts "who has 10.0.0.1?" and trusts whatever ARP reply comes back. **ARP spoofing/poisoning** abuses that: the attacker sends forged ARP replies claiming *the attacker's MAC* owns the gateway's IP (and tells the gateway it owns the victim's IP). Both sides update their ARP caches, and now all traffic between victim and gateway flows through the attacker — a full **LAN MITM**, from which they can sniff, alter, or SSL-strip.

It only works on the **local broadcast domain** (same subnet/VLAN), which both scopes the threat and points at the defenses:
- **Dynamic ARP Inspection (DAI)** on managed switches — validates ARP replies against a trusted DHCP-snooping table and drops forgeries.
- **Static ARP entries** for critical hosts (the gateway) — no reply can override them.
- **Port security / 802.1X** — authenticate devices onto the network.
- **Encrypt everything (TLS/mTLS)** — even a successful ARP MITM then only yields ciphertext, defanging it. This is the defense-in-depth point: assume L2 can be compromised and don't rely on it for confidentiality.

### Q8. What is IP spoofing and why does BCP38 matter?

**IP spoofing** is forging the **source address** of a packet. Because IP itself doesn't authenticate the source, an attacker can put any source IP in the header. Two big abuses: (1) **reflection/amplification DDoS** — spoof the *victim's* IP as the source of queries to open DNS/NTP servers, which then blast their large replies *at the victim*; and (2) evading source-based ACLs or forging the origin of attack traffic. Note that spoofing is mostly useful for **one-way / connectionless** attacks — TCP's handshake requires seeing the SYN-ACK, so you can't complete a spoofed TCP connection (the return packets go to the real owner).

**BCP38 (RFC 2827), "ingress filtering,"** is the network-operator defense: an ISP/edge network should **drop outbound packets whose source IP isn't from a range it actually originates.** If every provider did this, a host on Acme's network couldn't emit packets claiming to be from someone else's IP, and reflection/amplification attacks would largely collapse at the source. The tragedy is it's a **collective-action problem** — it protects *others*, not the deploying network, so adoption is incomplete decades on. Mentioning BCP38 signals you understand that some defenses are network-wide responsibilities, not just endpoint config.

### Q9. What is port scanning and reconnaissance, and how do you detect it?

**Reconnaissance** is the attacker's first phase: map the target's exposed surface before striking. **Port scanning** (Q12 in the tools topic — `nmap`) probes which ports are open, what services and versions run, and infers the OS — building a list of things to attack (an outdated OpenSSH, an exposed database, a management port). Other recon: DNS enumeration (subdomains, zone data), banner grabbing, and crawling public assets.

**Detection and defense (the blue-team side):**
- **IDS/IPS** (Snort, Suricata, Zeek) flag the tell-tale pattern of scanning — many connection attempts across many ports/hosts from one source in a short window.
- **Rate limiting / fail2ban** on connection attempts throttles or bans scanners.
- **Minimize the surface** so there's little to find: default-deny firewall, close unused ports, don't expose management interfaces publicly.
- **Log and alert** on connections to ports that should never receive external traffic — a hit on your database port from the internet is both an exposure *and* a signal.

The framing to give: recon is legitimate when you're auditing your own assets and hostile when it's someone probing yours, and the same `nmap`/packet tools serve both roles — which is why detection matters.

### Q10. How do firewalls and network segmentation provide defense?

A **firewall** enforces a policy on which traffic may pass, by IP/port/protocol (L3/L4 stateful firewalls, cloud security groups) or by application content (L7/WAF). The foundational principle is **default-deny**: block everything, then explicitly allow only what's needed — so a new, forgotten, or misconfigured service isn't reachable by default. This applies to **both ingress** (who can reach me) **and egress** (where I can connect out — critical for stopping exfiltration and C2, see Q15).

**Segmentation** divides the network into zones so a compromise in one doesn't reach everything:
- A **DMZ** holds internet-facing components (load balancers, reverse proxies) between the public internet and the trusted interior, so nothing external talks to internal systems directly.
- **Tiered segmentation** — web tier can reach the app tier, app tier can reach the database tier, but the web tier **cannot** reach the database directly. An attacker who pops the web server still can't touch the DB.
- **Micro-segmentation** (the zero-trust extreme) — policy per *workload*, not per subnet, often enforced by a service mesh, so even east-west traffic between two services is explicitly allowed or denied.

The point is **blast-radius reduction**: segmentation assumes a breach *will* happen and limits how far it spreads. Combined with default-deny both directions, it's the structural backbone of defense in depth.

### Q11. Compare VPN technologies and deployment models.

A **VPN** creates an **encrypted tunnel** over an untrusted network, so two endpoints (or a user and a network) communicate as if on a private link. The main technologies:

| | IPsec | WireGuard | OpenVPN |
|---|---|---|---|
| Layer | L3 (IP), kernel | L3, kernel, modern | L3/L2 over TLS, userspace |
| Crypto | configurable suites | fixed modern primitives | TLS-based, flexible |
| Complexity | high (IKE, SAs) | very simple config | moderate |
| Performance | fast | fastest, small codebase | slower (userspace) |
| Use | site-to-site standard | modern default, roaming | firewall-friendly (443/TCP) |

**Deployment models:**
- **Site-to-site** — connects two whole networks (office ↔ datacenter, or across clouds); gateways at each end, transparent to hosts.
- **Remote-access** — an individual user's device tunnels into a corporate network.

**Split vs full tunnel:** a **full tunnel** routes *all* the client's traffic through the VPN (more control/inspection, more load, and the VPN sees everything); a **split tunnel** sends only corporate-destined traffic through the tunnel and lets the rest go direct (faster, less load, but less visibility/control).

The critical caveat (Q12): a VPN authenticates you *onto a network* and encrypts the transit — but once you're on, you're often **broadly trusted**. That's the perimeter model, and it's exactly what zero trust rejects.

### Q12. What is zero-trust networking and why is a VPN not zero trust?

**Zero trust** discards the assumption that *network location implies trust*. The old model: get inside the perimeter (VPN in, or be on the corporate LAN) and you're trusted to reach internal resources. The flaw: one compromised device or one malicious insider inside the perimeter has broad lateral access. Zero trust's principle is **"never trust, always verify"** — there is no trusted network; **every request** is authenticated and authorized on its own, based on **identity** (user + device posture), not on which network it came from. Google's **BeyondCorp** is the canonical implementation: employees access apps over the public internet with no VPN, each request gated by identity, device state, and policy at an access proxy.

**Why a VPN is *not* zero trust:** a VPN is a tunnel that **extends the perimeter** — it authenticates you *once* to get onto the network, then largely trusts you. It grants **network-level** access (you can now reach a range of internal IPs), not **per-resource, per-request** authorization. Zero trust instead: authenticates every request, authorizes per-application (least privilege), checks device posture continuously, and **encrypts and authenticates service-to-service traffic (mTLS)** regardless of network. You can layer identity-aware proxies to get zero-trust *access* without any VPN. Saying "we have a VPN, so we're zero trust" is the tell that someone has the buzzword but not the model.

### Q13. How do services authenticate to each other? Explain mTLS and SPIFFE.

Inside a system, service A calling service B needs B to know *who is calling* and A to know it's really *B* — not an imposter that ARP-spoofed or SSRF'd its way in. **Mutual TLS (mTLS)** solves both directions: standard TLS authenticates the *server* to the client; mTLS adds a **client certificate** so the *client* also proves its identity. Both sides present certs, both validate, and you get an **encrypted, mutually-authenticated** channel — the east-west equivalent of HTTPS, and a core zero-trust building block (identity travels with the workload, not the network).

The operational hard part is **issuing and rotating certificates for every workload** at scale — thousands of short-lived pods, each needing a verifiable identity. **SPIFFE** (Secure Production Identity Framework For Everyone) is the standard: it defines a workload identity as a **SPIFFE ID** (a URI like `spiffe://acme.com/ns/prod/sa/payments`) embedded in an X.509 cert (an **SVID**). **SPIRE** is the reference implementation — it attests what a workload is (via node/workload attestation) and issues short-lived SVIDs automatically, so certs rotate constantly with no humans in the loop. Service meshes (Istio, Linkerd) typically bundle this: sidecars transparently do mTLS with mesh-issued identities, so app code gets mutual auth and encryption for free. The interview point: mTLS gives you *mutual authentication*, and SPIFFE/SPIRE make it *manageable* across a fleet.

### Q14. What do rate limiting and a WAF protect against?

Both are **L7 (application-layer)** defenses at your edge/gateway.

**Rate limiting** caps how many requests a client (by IP, API key, user, or token) may make per time window. It protects **availability** and abuse resistance: it blunts **L7 DDoS** and brute-force/credential-stuffing on login, stops scraping and API abuse, and shields expensive endpoints from being hammered. Algorithms are **token bucket** (allows bursts up to a bucket size, refilled at a steady rate) and **sliding window** (smoother counting). Return **`429 Too Many Requests`** with a `Retry-After`. It's applied at the API gateway, load balancer, or CDN.

**A WAF (Web Application Firewall)** inspects HTTP request *content* and blocks known attack patterns — the **OWASP** classics: **SQL injection**, **XSS**, path traversal, command injection, plus bad bots. Managed rulesets (OWASP Core Rule Set, Cloudflare/AWS WAF) ship signatures; you add custom rules. It's a **virtual patch** layer — it can block an exploit at the edge while you fix the underlying app bug.

The honest framing: a WAF is **defense in depth, not a substitute** for fixing the code — parameterized queries stop SQLi properly; the WAF is the backstop and buys time. Rate limiting and WAF together handle the "valid-looking but malicious" L7 traffic that lower-layer firewalls can't distinguish.

### Q15. What are common network exposure mistakes?

The recurring, high-impact ones:

- **Databases/Redis bound to `0.0.0.0` on the public internet** — the classic breach. Redis, MongoDB, Elasticsearch, and Postgres left listening on all interfaces with no auth (or default creds) get found by internet-wide scanners (Shodan) within *minutes* and dumped/ransomed. Fixes: bind to `127.0.0.1` or a private subnet, require auth, firewall/security-group to only the app tier (segmentation, Q10). Check with `ss -tlnp`.
- **SSRF (Server-Side Request Forgery)** at the network layer — an attacker tricks your server into making requests to internal targets it can reach but the attacker can't (the cloud **metadata endpoint** `169.254.169.254` to steal credentials, internal admin panels, `localhost` services). Defenses: validate/allowlist outbound URLs, block link-local and RFC1918 destinations from app egress, and use IMDSv2. This is why **egress control** matters as much as ingress.
- **No egress filtering** — if a compromised host can open arbitrary outbound connections, it can **exfiltrate data** and phone home to **C2**. Default-deny egress limits the damage of a breach.
- **Overly broad security groups / firewall rules** — `0.0.0.0/0` allow-all on management ports (SSH 22, RDP 3389, Kubernetes API, cloud consoles). Restrict to bastions/VPN/known IPs.
- **Exposed internal/management interfaces** — dashboards, `/metrics`, admin panels, `.git` directories reachable publicly.

The common thread: **default-deny both directions and segment**, so a mistake or a breach has a small blast radius. Complement with **network IDS/IPS** to detect the scanning and anomalous flows these mistakes attract.

### Q16. Walk me through securing the network for a web service (defense in depth).

I'd build it as **layers**, so no single failure is fatal — from the edge inward.

**Edge / ingress:**
- **CDN + DDoS protection** in front (anycast, scrubbing) to absorb volumetric attacks and cache.
- **TLS 1.3 everywhere** with strong ciphers, **HSTS** (with preload) to kill SSL stripping, automated cert rotation (short-lived certs, ACME), and OCSP stapling.
- **WAF + rate limiting** at the gateway — OWASP ruleset for SQLi/XSS, per-client quotas, `429`s, bot management.

**Perimeter / segmentation:**
- **Default-deny firewall** on both **ingress and egress**. Public traffic reaches only the load balancer/reverse proxy in a **DMZ**.
- **Tiered segmentation**: LB → app tier → data tier, each only able to reach the next. The database is on a **private subnet**, bound to a private interface, never `0.0.0.0`, reachable only from the app tier.
- **Egress control** — app can only reach the specific dependencies it needs, blocking exfil/C2 and SSRF to link-local/RFC1918.

**Internal / east-west (zero trust):**
- **mTLS between services** (service mesh, SPIFFE/SPIRE identities) so internal traffic is encrypted and mutually authenticated — no plaintext east-west, no trust by network location.
- **Least-privilege identity** on every request; secrets delivered via a vault, not baked into images, and never sent in plaintext.

**Detection & operations:**
- **IDS/IPS** and flow logs to spot scanning, anomalous egress, and lateral movement; alert on connections to ports that should never see them.
- **Patch and minimize surface** — close unused ports, no public management interfaces, IMDSv2 for cloud metadata.

The through-line: **assume every layer can fail**, so encrypt in transit, authenticate every party, segment and default-deny both directions, rate-limit and filter at L7, and instrument for detection. Defense in depth means the attacker has to beat *all* of it, not one thing.
## Cloud & Virtual Networking

### Summary

**What this topic covers**

How everything you learned about physical networking — subnets, routers, firewalls, NAT, load balancers — gets re-expressed as **software-defined** primitives you provision via API in a public cloud (AWS, GCP, Azure) and in container platforms (Kubernetes). The 15 questions here walk from the foundational abstraction (the **VPC** — your own isolated virtual network) up through subnets, gateways, cloud firewalls (security groups vs NACLs), private connectivity (peering, Transit Gateway, PrivateLink), the **overlay networks** and **SDN** that make it all work under the hood, container/Kubernetes networking, service mesh, hybrid connectivity (VPN vs Direct Connect), cloud load balancers, private access to managed services, cloud DNS, and the operational realities nobody warns you about — egress bills and cross-AZ charges. The theme: the *concepts* are the same as a datacenter, but you never touch a cable, everything is an API call, and the failure modes and cost model are new.

**Mental model**

A cloud network is a **datacenter you rent, described entirely in software**. Instead of racking a switch, you call an API that programs a distributed control plane; the cloud's hypervisors and smart NICs then enforce your intent on shared physical hardware. Two ideas unlock everything. (1) **The VPC is your blast radius and address space** — a private, isolated L3 network with a CIDR block you plan up front; inside it you carve subnets, attach gateways, and write route tables, exactly like a physical network, but nothing is real until traffic flows. (2) **Isolation is achieved by overlay + policy, not by physical separation** — your "private network" shares copper and silicon with thousands of other tenants; VXLAN/GENEVE tunneling plus SDN policy keeps them apart. So think in three planes: the **address/topology plane** (VPC, subnets, routes), the **security plane** (security groups, NACLs, policy), and the **connectivity plane** (gateways, peering, PrivateLink, VPN). Design top-down: pick CIDRs that won't collide with peers or on-prem, decide public vs private per subnet, then attach exactly the gateways each tier needs.

**Key terms**

- **VPC (Virtual Private Cloud)** — your isolated virtual L3 network in the cloud, defined by a CIDR block. AWS VPC is **regional**; GCP VPC is **global** (subnets are regional within it).
- **Subnet** — a slice of the VPC CIDR bound to one AZ/zone; "public" if its route table sends `0.0.0.0/0` to an Internet Gateway, "private" otherwise.
- **Internet Gateway (IGW)** — horizontally-scaled VPC component giving public subnets bidirectional internet reachability (needs a public IP).
- **NAT Gateway** — managed SNAT so private-subnet instances get *outbound-only* internet (patching, API calls) without being reachable inbound.
- **Security Group** — **stateful**, instance/ENI-level virtual firewall; allow-rules only, return traffic auto-permitted.
- **NACL (Network ACL)** — **stateless**, subnet-level firewall; allow and deny rules, ordered, you must permit return traffic explicitly.
- **VPC Peering** — private 1:1 connection between two VPCs; **non-transitive** (A–B and B–C does not give A–C).
- **Transit Gateway / hub** — a routing hub that connects many VPCs and on-prem, solving peering's mesh explosion.
- **PrivateLink / Private Service Connect** — reach a service (yours or a provider's) privately over the cloud backbone, no internet, via a private endpoint IP in your subnet.
- **Overlay network** — a virtual L2/L3 network tunneled (VXLAN/GENEVE) over the shared physical (underlay) network; how multi-tenancy and K8s pod networks work.
- **CNI (Container Network Interface)** — the plugin standard (Calico, Cilium, cloud VPC-CNI) that wires up pod networking in Kubernetes.
- **Direct Connect / Interconnect** — a dedicated private physical link between on-prem and the cloud, bypassing the public internet.

**Why interviewers ask this**

Every backend/SRE role now runs on cloud infrastructure, so "can you reason about a VPC" is table stakes. Junior candidates describe cloud networking as a pile of console clicks — they know the buttons but not the model. Senior candidates map cloud primitives back to fundamentals ("a security group is just a stateful firewall on the ENI; a NACL is a stateless one on the subnet") and can *design a topology*: public ALB tier, private app tier behind a NAT gateway, isolated DB subnets, least-privilege security groups, PrivateLink to managed services. The tell is whether you think about **failure and cost**: non-transitive peering, cross-AZ data charges, egress bills, the MTU gotcha in overlays, and the security consequence of an over-broad `0.0.0.0/0` rule. Cloud networking is where fundamentals meet the bill.

**Common confusions**

- "A security group is like a NACL" — no: SG is **stateful and instance-level**, NACL is **stateless and subnet-level**. You almost always use SGs for real policy and leave NACLs default.
- "VPC peering is transitive" — it is **not**. Hub-and-spoke needs a Transit Gateway.
- "Private subnet means no internet at all" — it means no *inbound* from the internet; outbound still works via a NAT gateway.
- "The VPC is a physical thing" — it's a control-plane construct; your traffic rides an overlay over shared hardware.
- "Cross-AZ / egress traffic is free" — it is a real, often surprising line item. Chatty cross-AZ services and fat egress to the internet dominate many cloud networking bills.
- "K8s pods talk to each other via NAT" — the K8s model is a **flat, NAT-free pod network**: every pod gets a routable IP and can reach every other pod directly.

**What follows from this topic**

This is the cloud recap that ties the whole primer together: the firewall material becomes security groups/NACLs, NAT becomes the NAT gateway, load balancing becomes NLB/ALB, DNS becomes Route53/Cloud DNS private zones, and TLS/mTLS becomes the service mesh. The overlay and eBPF threads continue in **Modern Networking**, and the design-and-diagnose muscle — "design a secure cloud topology", "two pods can't talk" — is exactly what **Scenario & Troubleshooting Playbooks** drills.

### Q1. How is networking different in the cloud versus a physical datacenter?

The concepts are identical; the *implementation* is software. In a datacenter you rack switches and routers, patch cables, and configure firewalls on physical appliances. In the cloud, **software-defined networking (SDN)** abstracts all of that: you describe the network you want via API/Terraform, and the provider's control plane programs its hypervisors and smart NICs to enforce it over shared physical hardware.

Practical differences that matter in an interview:

- **Everything is an API call** — a subnet, route, or firewall rule is created in seconds and version-controlled as code. No physical provisioning lead time.
- **Isolation is logical, not physical** — your "private" VPC shares hardware with other tenants; overlays + policy keep you apart (see Q9).
- **Elastic and horizontally scaled** — an Internet Gateway or NAT Gateway is a managed, auto-scaling service, not a box you size.
- **New cost model** — you pay for data movement (egress to internet, cross-AZ), which reshapes design.
- **Managed building blocks** — load balancers, DNS, VPN, and private-service access are services you consume, not software you run.

The senior framing: *the OSI model didn't change; the operational model did.* You still reason in subnets, routes, and firewalls — you just express them declaratively and inherit a new failure/cost surface.

### Q2. What is a VPC, and how do AWS and GCP differ in their VPC model?

A **VPC (Virtual Private Cloud)** is your own isolated, private virtual network in the cloud — an L3 network defined by a **CIDR block** (e.g. `10.0.0.0/16`). Inside it you carve subnets, attach gateways, write route tables, and apply firewalls. It's the top-level container for everything network.

The key scoping difference interviewers probe:

| | AWS VPC | GCP VPC |
|---|---|---|
| Scope | **Regional** (one region) | **Global** (spans all regions) |
| Subnet scope | One AZ | One region |
| Cross-region | Needs peering / Transit GW | Native within the same VPC |

So on AWS a VPC lives in one region and its subnets each live in one AZ; to span regions you peer VPCs or use a Transit Gateway. On GCP one VPC is global — subnets are regional but belong to the same global network, so instances in different regions share it natively.

**CIDR planning** is the part people skip and regret. Choose a private range (RFC1918: `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`) large enough to grow, non-overlapping with on-prem and any VPC you'll peer with. Overlapping CIDRs make peering impossible without NAT — plan the address space like you mean to keep it.

### Q3. Explain public vs private subnets and how route tables define them.

A subnet is a slice of the VPC CIDR bound to one AZ/zone (AWS) or region (GCP). Nothing about a subnet is intrinsically "public" or "private" — **the route table decides**:

- **Public subnet** — its route table has a default route `0.0.0.0/0 → Internet Gateway`. Instances with a public IP are reachable from and can reach the internet. Put internet-facing load balancers and bastion hosts here.
- **Private subnet** — no route to an IGW. Its `0.0.0.0/0` route (if any) points at a **NAT Gateway** for outbound-only access. Put app servers and databases here.

A classic three-tier topology, per AZ for HA:

```text
Public subnet   → ALB / bastion         (route 0.0.0.0/0 → IGW)
Private subnet  → app servers           (route 0.0.0.0/0 → NAT GW)
Private subnet  → database (RDS)         (no internet route at all)
```

Every subnet lives in exactly one AZ, so for high availability you replicate the tier across at least two AZs and let the load balancer spread traffic. The route table is the single source of truth for reachability — when something "can't reach the internet," the route table is the first thing to read.

### Q4. What's the difference between an Internet Gateway and a NAT Gateway?

Both connect a VPC to the internet, but in opposite directions:

- **Internet Gateway (IGW)** — a horizontally-scaled, highly-available VPC component enabling **bidirectional** internet traffic for resources that have a **public IP** in a **public subnet**. It performs 1:1 NAT between the private and public IP. Inbound *and* outbound.
- **NAT Gateway** — a managed service performing **source NAT (SNAT)** so instances in a **private subnet** get **outbound-only** internet (OS patches, calling external APIs, pulling images). The outside world cannot initiate connections to them. Deployed in a *public* subnet, it forwards private-subnet egress out through the IGW.

The reason this exists: you want your app servers to fetch dependencies and call third-party APIs, but you never want them directly reachable from the internet. NAT Gateway gives you that asymmetry — egress yes, ingress no.

Gotchas worth mentioning: the NAT Gateway is **AZ-scoped** (deploy one per AZ to avoid cross-AZ charges and a single point of failure), and it's a metered service — heavy egress through it both costs per-GB and can bottleneck. A cheaper alternative for reaching AWS services specifically is a **VPC endpoint** (Q13).

### Q5. Security groups vs network ACLs — when do you use each?

This is the cloud firewall recap and a near-guaranteed question.

| | Security Group | Network ACL (NACL) |
|---|---|---|
| Level | Instance / ENI | Subnet |
| State | **Stateful** (return traffic auto-allowed) | **Stateless** (must allow return explicitly) |
| Rules | Allow only | Allow **and** deny |
| Evaluation | All rules, permissive union | Ordered, first match wins |
| Default | Deny all inbound, allow all outbound | Allow all (default NACL) |

**Security groups** are your primary tool. Because they're stateful, you write only the inbound rule ("allow 443 from the ALB's SG") and the response is automatically permitted. You can reference other SGs as sources, which is how you express "app tier accepts traffic only from the LB tier" without hardcoding IPs.

**NACLs** are a coarse, stateless second layer at the subnet boundary. Their main real use is an explicit **deny** (e.g. block a bad IP range) since SGs can't deny. Most teams leave NACLs at default-allow and do all real policy in SGs.

Senior answer: layer them — NACLs for broad subnet guardrails, SGs for least-privilege instance policy — and always reference SGs by ID, not CIDR, for maintainable rules.

### Q6. Compare VPC peering, Transit Gateway, and PrivateLink.

Three ways to connect things privately, at increasing levels of abstraction:

- **VPC Peering** — a private, direct connection between **two** VPCs so their instances talk over the cloud backbone using private IPs. Simple and cheap, but **non-transitive**: peering A–B and B–C does **not** let A reach C. With N VPCs a full mesh needs N(N-1)/2 links — it explodes.
- **Transit Gateway (AWS) / Network hub** — a central routing hub. Every VPC and your on-prem attach once to the hub, which routes between them. Solves the peering mesh problem and is how you build hub-and-spoke at scale, with centralized route control.
- **PrivateLink / Private Service Connect** — not network-to-network but **service** access. It exposes a single service behind a private endpoint (an ENI with a private IP in your subnet). Your VPC reaches *that service* without any network-level connectivity, no route sharing, no CIDR overlap concerns, traffic never touches the internet. Ideal for consuming a SaaS/partner service or exposing your own internal service to other accounts with least privilege.

Rule of thumb: **two VPCs → peering; many VPCs + on-prem → Transit Gateway; expose/consume a specific service → PrivateLink**.

### Q7. What is an overlay network and why does the cloud rely on it?

An **overlay network** is a virtual network built *on top of* another physical network (the **underlay**) using **tunneling/encapsulation**. The cloud runs thousands of isolated tenant networks over the same shared physical fabric — overlays are how it keeps them separate and lets your `10.0.0.0/16` coexist with a neighbor's identical `10.0.0.0/16`.

The mechanism: **VXLAN** or **GENEVE** wraps each original L2 frame inside a UDP packet, adding a header with a virtual-network ID (VNI). The physical network only sees ordinary UDP between hypervisors; the VNI tells the receiving host which virtual network the inner frame belongs to. So one physical link carries many independent virtual networks — this is the essence of multi-tenant SDN and of Kubernetes pod networking (Q11).

The **MTU gotcha** every senior should name: encapsulation adds overhead (VXLAN ~50 bytes). If the physical MTU is 1500 and you don't shrink the overlay MTU (or enable jumbo frames on the underlay), full-size inner packets plus the tunnel header exceed 1500 and get fragmented or silently dropped — showing up as mysterious hangs on large transfers while pings and small requests work fine. It's a classic overlay debugging trap (see the path-MTU black hole in the troubleshooting topic).

### Q8. Explain the SDN concept of separating the control plane from the data plane.

**Software-Defined Networking (SDN)** decouples the two jobs a traditional router/switch bundles together:

- **Control plane** — the *decision-making*: how routes are learned, what the topology is, what policy applies. In SDN this is centralized in software (a controller) that has a global view.
- **Data plane (forwarding plane)** — the *actual moving of packets* according to the control plane's instructions, done at line rate in the hardware/hypervisor/smart NIC.

In a legacy network each device runs its own control plane locally (its own routing daemon), so the network is the emergent sum of many independent decisions — hard to reason about and slow to change. SDN pulls the control plane out into a central controller that programs every data-plane element via API. This is why cloud networking is "software-defined": one API call to the control plane reprograms the forwarding behavior across the fleet instantly, giving you the elastic, declarative networking you experience as a VPC.

The same split shows up everywhere in this primer: a **service mesh** has a control plane (Istio's `istiod`) configuring a fleet of data-plane proxies (Envoy sidecars); a load balancer has a control plane picking targets and a data plane forwarding packets. Recognizing the pattern is the senior move.

### Q9. How does networking work inside Kubernetes?

Kubernetes imposes a deliberately simple **flat network model** with three rules: every **pod gets its own routable IP**, every pod can reach every other pod **without NAT**, and nodes can reach all pods. No port-mapping gymnastics — a pod sees the same IP others use to reach it.

The pieces:

- **CNI (Container Network Interface)** — the plugin that implements pod networking. Options split into two styles: **overlay** (Calico VXLAN, Flannel — encapsulate pod traffic, works anywhere) vs **native/underlay routing** (AWS VPC-CNI gives each pod a real VPC IP; Calico BGP — no encapsulation, better performance, tighter cloud integration).
- **Services + kube-proxy** — a Service is a stable virtual IP (ClusterIP) load-balancing across pod replicas. Classically **kube-proxy** programs `iptables`/IPVS rules on every node to DNAT the service IP to a pod. Modern setups replace kube-proxy with **eBPF** (Cilium) for far better performance at scale (see Modern Networking).
- **Cluster DNS** — CoreDNS resolves service names (`svc.namespace.svc.cluster.local`) to ClusterIPs, giving pods service discovery by name.
- **NetworkPolicy** — the pod-level firewall (default is allow-all until you apply one), enforced by the CNI.

The senior tie-back: this is SDN and overlays applied to containers. "Two pods can't talk" almost always decomposes into CNI/routing, cluster DNS, or NetworkPolicy — exactly the decision tree in the troubleshooting topic.

### Q10. What is a service mesh and what networking problem does it solve?

A **service mesh** moves cross-cutting networking concerns — mTLS, retries, timeouts, traffic splitting, observability — **out of application code and into the network layer**, implemented as a fleet of proxies. It's SDN applied to service-to-service (east-west) traffic.

Architecture (the classic sidecar model):

- **Data plane** — an **Envoy** proxy injected as a **sidecar** next to every service instance. All the pod's inbound/outbound traffic is transparently routed through its sidecar, which does the actual work: **mTLS** encryption/identity between services, **L7 routing** (path/header-based canary and blue-green splits), retries, circuit breaking, and rich per-request telemetry.
- **Control plane** — e.g. Istio's `istiod`, which configures every sidecar with policy and certificates. Control/data plane separation again.

What it buys you: **zero-trust mTLS everywhere without touching app code**, uniform retries/timeouts, fine-grained traffic shaping, and consistent golden-signal metrics for every hop. The cost — a proxy per pod — is real (latency and resource overhead), which is exactly why the industry is shifting to **sidecar-less / ambient meshes and eBPF data planes** (Cilium), covered in Modern Networking.

### Q11. VPN vs Direct Connect/Interconnect — how do you connect on-prem to the cloud?

Two ways to bridge your datacenter and your VPC, trading cost against performance and consistency:

- **Site-to-site VPN** — an **IPsec** tunnel over the **public internet** between your on-prem gateway and the cloud VPN gateway. Encrypted, quick to stand up, cheap. But it inherits the public internet's variable latency, jitter, and bandwidth ceiling, and throughput is capped per tunnel.
- **Direct Connect (AWS) / Cloud Interconnect (GCP) / ExpressRoute (Azure)** — a **dedicated private physical link** (via a colo/partner) between on-prem and the cloud, bypassing the internet entirely. Consistent low latency, high dedicated bandwidth, and often lower egress rates. Costs more and takes weeks to provision.

Routing across either is typically dynamic via **BGP** — a **Cloud Router** on the cloud side exchanges routes with your on-prem router so networks are learned automatically rather than statically configured.

The senior pattern: **VPN as the quick start or backup path, Direct Connect as the primary for production/latency-sensitive/high-volume workloads** — often both, with VPN as automatic failover for the dedicated link. Hybrid connectivity is where cloud networking meets classic WAN engineering.

### Q12. Compare load balancers in the cloud — L4 vs L7 vs global.

The L4/L7 distinction from the load-balancing fundamentals maps directly onto cloud offerings (AWS names shown):

| Type | Example | Operates at | Use for |
|---|---|---|---|
| **L4 NLB** | Network Load Balancer | Transport (TCP/UDP) | Ultra-low latency, millions of conns, TCP/UDP, static IP, TLS passthrough |
| **L7 ALB** | Application Load Balancer | Application (HTTP/S) | Path/host routing, header rules, TLS termination, WebSockets, gRPC |
| **Global** | CloudFront / GCP Global LB | Edge (anycast) | Single anycast IP, route users to nearest region, DDoS edge |

- **L4 (NLB)** — forwards connections without inspecting content. Fast, preserves the client IP, handles non-HTTP protocols, gives you a static IP. Choose it when you need raw throughput or protocol transparency.
- **L7 (ALB)** — understands HTTP, so it can route by path (`/api` → one target group, `/img` → another), terminate TLS, do host-based routing for multi-tenant apps, and health-check at the HTTP level. The default for web apps.
- **Global** — anycast front door (CloudFront, GCP Global External LB) that terminates connections at the nearest edge and steers users to the closest healthy region, adding CDN caching and DDoS absorption.

Senior framing: often you **stack** them — a global/CDN edge in front, an ALB for L7 routing, sometimes NLB behind for a specific protocol tier.

### Q13. How do you reach managed cloud services privately, without the internet?

By default, calling a managed service (S3, DynamoDB, a database API) from a private subnet would route out through the NAT Gateway to a public endpoint — costing egress and traversing the internet edge. The private alternatives:

- **VPC Endpoints (AWS)** — two flavors. A **Gateway Endpoint** (S3, DynamoDB) adds a route so traffic to those services stays on the AWS backbone, free. An **Interface Endpoint** (PrivateLink) drops an ENI with a private IP in your subnet for most other services, so you call them over private IPs.
- **Private Google Access** — lets instances with only internal IPs reach Google APIs and services over Google's internal network rather than the internet.
- **Private Service Connect (GCP) / PrivateLink** — private endpoints for consuming managed or third-party services.

Why it matters, said like a senior: three wins at once — **security** (traffic never touches the public internet, and you can restrict the service to only your endpoint), **cost** (avoid NAT Gateway per-GB egress for high-volume service calls), and **performance** (stay on the provider's low-latency backbone). "Our S3 bill has a huge NAT egress line" is a real incident whose fix is a gateway endpoint.

### Q14. Why do egress and cross-AZ charges dominate cloud networking bills?

Because cloud providers price **data movement**, and the defaults quietly move a lot of it. The pricing tiers, cheapest to most expensive, are roughly:

1. **Same-AZ, private IP** — usually free.
2. **Cross-AZ** — charged **per GB in both directions** (you pay to send *and* receive across AZs).
3. **Egress to the internet** — the big one; charged per GB, and it adds up fast for media, backups, and chatty APIs.
4. **Cross-region** — also metered.

The traps that generate surprise bills:

- **Chatty microservices spread across AZs** — HA spreads replicas across AZs, but every cross-AZ call is billed. A hot service calling a database in another AZ millions of times a day is a line item.
- **NAT Gateway egress** — per-GB processing charge on everything private subnets send out; pulling large images or hitting S3 through NAT instead of a VPC endpoint (Q13) burns money.
- **Load balancer / replication cross-AZ** traffic.

Senior mitigations: keep hot traffic **AZ-local** where HA allows (topology-aware routing / same-zone reads), use **VPC endpoints** instead of NAT for AWS services, put a **CDN** in front to cut internet egress, and compress. The lesson: in the cloud, **network topology is a cost decision**, not just a performance one.

### Q15. Design a secure network topology for a public web service.

Walk it tier by tier, top-down — this is the capstone "design this" question.

**Address plan** — one regional VPC, e.g. `10.0.0.0/16`, subnets replicated across at least **two AZs** for HA.

```text
                 Internet
                    │
         [ CDN / WAF ]  ← edge caching + L7 filtering, DDoS absorption
                    │
   Public subnets:  [ ALB ]  (only 443 open to the world)
                    │  (SG: allow 443 from 0.0.0.0/0)
   Private subnets: [ App servers ]  (SG: allow app port ONLY from ALB's SG)
                    │             └─ egress via NAT GW for patches/APIs
   Isolated subnets:[ Database ]  (SG: allow 5432 ONLY from app SG; no internet route)
```

The layered controls:

- **Edge**: a CDN + WAF terminates TLS at the edge, caches static content, and filters malicious traffic before it reaches your infra.
- **Public tier**: only the **ALB** lives in public subnets; its security group allows 443 from the internet. Nothing else is internet-facing.
- **App tier**: in private subnets, security group accepts the app port **only from the ALB's security group** (SG-to-SG reference, no public IP). Outbound to the internet goes through a **NAT Gateway** per AZ.
- **Data tier**: in isolated subnets with **no internet route at all**; DB security group allows its port **only from the app tier's SG**.
- **Cross-cutting**: TLS in transit (and mTLS/service mesh east-west if microservices), least-privilege SGs referencing each other by ID, **VPC endpoints** for private access to managed services, private DNS zones, flow logs for audit, and multi-AZ everything.

The principles the interviewer is listening for: **defense in depth, least privilege, minimal public surface (only the LB), private-by-default, and HA across AZs** — the physical-network security model, re-expressed in cloud primitives.

## Modern Networking

### Summary

**What this topic covers**

The shifts a senior engineer in 2026 is expected to speak to fluently — the ways networking has genuinely changed in the last several years, and how to separate real, durable change from hype. The 15 questions span the protocol layer (**HTTP/3 and QUIC** moving the web off TCP onto UDP), the service-communication layer (**service mesh** maturing from per-pod sidecars toward **ambient/sidecar-less** and **eBPF-based** data planes), the kernel (**eBPF** rewriting how Linux does routing, load balancing, observability, and security), the security model (**zero-trust** replacing perimeter trust), addressing (**IPv6** finally growing, dual-stack, NAT64), VPNs (**WireGuard** displacing IPsec/OpenVPN), DNS/privacy (**DoH/DoT/ECH**), the enterprise WAN (**SD-WAN**), hardware offload (**smartNICs/DPUs**, programmable data planes), and the AI-driven frontier (**RDMA/RoCE/InfiniBand** fabrics for GPU clusters). It closes on judgment: what's proven, what's emerging, and where to invest learning.

**Mental model**

Modern networking is driven by three forces. (1) **Push functionality up into userspace and down into the kernel/hardware simultaneously** — QUIC pulls the transport into userspace so it can evolve without waiting for OS/middlebox upgrades, while eBPF and smartNICs pull packet processing into the kernel and silicon for speed. (2) **Trust moves from the network to identity** — "inside the perimeter" stops meaning "trusted"; every connection is authenticated and encrypted (mTLS, zero-trust), so the network becomes a hostile transport you never rely on for security. (3) **Efficiency at scale forces the sidecar/appliance model to dissolve** — a proxy per pod or a box per function doesn't scale to hyperscale, so the industry collapses those into shared, eBPF-accelerated, cloud-native layers. When you evaluate any "modern networking" claim, ask which force it serves and whether it's shipping in production at scale yet.

**Key terms**

- **QUIC** — a transport protocol over **UDP** with built-in TLS 1.3, multiplexed streams, and connection migration; the substrate for HTTP/3.
- **HTTP/3** — HTTP mapped onto QUIC, eliminating TCP-level head-of-line blocking and cutting handshake round-trips.
- **eBPF** — running sandboxed, verified programs inside the Linux kernel to customize networking/observability/security **without kernel modules**.
- **XDP (eXpress Data Path)** — an eBPF hook at the earliest point of the NIC driver for line-rate packet processing (DDoS drop, load balancing).
- **Cilium** — an eBPF-based CNI/data plane that can replace kube-proxy and run a sidecar-less service mesh.
- **Ambient / sidecar-less mesh** — a service mesh that drops the per-pod proxy for a shared per-node data plane, cutting overhead.
- **Zero-trust networking** — "never trust, always verify": access is granted by verified identity, not network location (BeyondCorp).
- **WireGuard** — a lean, modern VPN built into the Linux kernel using fixed modern crypto; far simpler and faster than IPsec/OpenVPN.
- **Dual-stack** — running IPv4 and IPv6 simultaneously; **NAT64/DNS64** let IPv6-only clients reach IPv4-only services.
- **DoH / DoT / ECH** — DNS-over-HTTPS, DNS-over-TLS, and Encrypted Client Hello: encrypting DNS queries and the SNI to close the last plaintext privacy leaks.
- **SD-WAN** — software-defined WAN: policy-driven, application-aware routing across multiple links (MPLS, broadband, LTE) for branch connectivity.
- **DPU / smartNIC** — a programmable NIC that offloads networking, security, and storage from the host CPU.
- **RDMA / RoCE / InfiniBand** — remote direct memory access fabrics giving ultra-low-latency, high-bandwidth, CPU-bypassing networking for HPC/AI clusters.

**Why interviewers ask this**

For senior/staff and SRE roles, this separates people who learned networking once and stopped from people who track where the field is going. Nobody expects you to have deployed everything here — they expect **informed judgment**: *why* the web moved off TCP, *why* eBPF is a genuine inflection rather than a buzzword, *why* AI training clusters need RoCE. The signal is your ability to explain the *problem* each shift solves (TCP HOL blocking, sidecar overhead, perimeter trust failing) and to hold a calibrated hype-vs-real opinion. Getting HTTP/3's motivation right, or explaining eBPF's advantage over iptables, tells an interviewer you read release notes and postmortems, not just tutorials from five years ago.

**Common confusions**

- "HTTP/3 is just HTTP/2 but faster" — it's a transport change: **HTTP/2 still suffers TCP head-of-line blocking; HTTP/3 over QUIC does not** because streams are independent at the transport layer.
- "QUIC is less secure because it's UDP" — QUIC has **TLS 1.3 built in and mandatory**; it's encrypted by default, arguably more so than TCP+TLS.
- "eBPF is just a faster iptables" — it's a general in-kernel programmability platform (networking, security, tracing), not a rule engine.
- "Zero-trust is a product you buy" — it's an architecture/principle (identity-based access), realized through mTLS, IdP, and policy, not a single appliance.
- "IPv6 isn't happening" — global adoption is well past 40% for major networks; dual-stack and IPv6-only mobile networks are mainstream.
- "Service mesh always means sidecars" — the trend is explicitly **away** from per-pod sidecars toward ambient/eBPF data planes.

**What follows from this topic**

This topic extends the recaps from **Cloud & Virtual Networking** (overlays, K8s, service mesh, zero-trust) into where they're heading, and it deepens the protocol fundamentals (TCP/UDP, TLS, HTTP versions, DNS) with their modern successors. The judgment it builds — knowing *why* a shift happened and *whether* it's production-ready — is the same judgment the **Scenario & Troubleshooting Playbooks** topic exercises when you diagnose a QUIC fallback, an mTLS failure, or a slow eBPF-loaded path.

### Q1. Why did the industry move HTTP off TCP onto QUIC with HTTP/3?

Because TCP had two structural limits you cannot fix without changing the transport:

**1. TCP head-of-line (HOL) blocking.** HTTP/2 multiplexes many streams over one TCP connection — but TCP is a single ordered byte stream. If one packet is lost, TCP holds back *every* stream's data until the retransmission arrives, even streams that had no loss. HTTP/2 removed application-layer HOL blocking but not transport-layer HOL blocking. **QUIC** implements independent streams *at the transport layer*, so a lost packet stalls only its own stream — the others keep flowing.

**2. Handshake latency and ossification.** TCP + TLS 1.2 needs multiple round-trips before data flows, and because TCP lives in the kernel and middleboxes inspect it, it's ossified — hard to evolve.

QUIC (running over UDP, in userspace) fixes both:

- **Built-in TLS 1.3** — connection setup and encryption merge into **1-RTT**, or **0-RTT** for resumed connections. Faster first byte.
- **Connection migration** — a connection is identified by a **connection ID**, not the 4-tuple, so it survives an IP change. Walk from wifi to cellular and your download doesn't drop.
- **Userspace evolvability** — QUIC lives in the application/library, so protocol improvements ship with an app update instead of waiting years for OS kernels and middleboxes.

**Fallback:** HTTP/3 is negotiated (Alt-Svc header / advertisement); if UDP/443 is blocked or QUIC fails, clients transparently fall back to HTTP/2 over TCP. So it's an upgrade, not a hard cutover.

### Q2. What is eBPF and why is it reshaping Linux networking?

**eBPF** lets you run small, sandboxed programs **inside the Linux kernel**, attached to hooks (packet arrival, syscalls, tracepoints), **without writing a kernel module or patching the kernel**. A verifier proves each program is safe (bounded loops, no bad memory access) before it's JIT-compiled to native code and run at kernel speed.

Why it's a genuine inflection, not hype:

- **Programmable data plane in the kernel** — instead of the rigid, linearly-scanned `iptables` chains (which degrade badly with thousands of rules), you run custom logic with hash-map lookups. Cilium uses this to do service load balancing and **replace kube-proxy** with far better performance at scale.
- **XDP (eXpress Data Path)** — an eBPF hook at the *earliest* point in the NIC driver, before the kernel builds an `sk_buff`. You can drop or redirect packets at line rate — used for DDoS mitigation and high-performance L4 load balancers (Meta's Katran, Cloudflare's edge).
- **Observability and security without instrumentation** — eBPF sees every packet, syscall, and connection, so tools (Cilium Hubble, Pixie, Falco) get deep network/security visibility with no app changes and low overhead.

The one-liner: **eBPF turns the kernel into a safely programmable platform**, which is why modern CNIs, service meshes, load balancers, and observability tools are all converging on it.

### Q3. How is the service mesh model evolving away from sidecars?

The original mesh injected an **Envoy sidecar into every pod**. It works and gives you mTLS, retries, and L7 routing transparently — but at hyperscale the cost is painful: a proxy per pod means real **per-request latency** (extra hops through two proxies), **memory/CPU overhead** multiplied by pod count, and operational friction (every pod restart to upgrade the mesh).

The industry response, two converging directions:

- **Ambient / sidecar-less mesh (Istio ambient)** — split the mesh into a lightweight **per-node** component handling mTLS/L4 (a shared `ztunnel`), and an optional per-namespace **waypoint** proxy only where you actually need L7 features. Most pods get zero-trust mTLS with **no sidecar at all**, and you pay for L7 processing only where it's used.
- **eBPF-based data planes (Cilium Service Mesh)** — push as much of the mesh's work as possible into the kernel via eBPF, avoiding userspace proxy hops for the common path and reserving Envoy only for genuine L7 needs.

The driver is the same force as everywhere else in this topic: **efficiency at scale collapses the per-instance model into a shared, kernel-accelerated layer.** In an interview, name the tradeoff — sidecars give maximal isolation and per-pod L7 power; ambient/eBPF trade some of that for large efficiency gains — and note it's an active, not settled, transition.

### Q4. What is zero-trust networking and how is it implemented?

**Zero-trust** replaces the old **perimeter model** — "inside the corporate network = trusted, outside = untrusted" — with **"never trust, always verify."** There is no trusted network location; every request is authenticated and authorized on its own merits regardless of where it originates. The canonical reference is Google's **BeyondCorp**.

Why the shift: the perimeter model fails the moment an attacker gets *inside* (phishing, a compromised host, a rogue insider) — flat internal trust means one foothold reaches everything. And with cloud, remote work, and SaaS, there is no single perimeter anymore.

How it's actually built (it's an architecture, not a product):

- **Identity is the control plane** — access decisions key off verified identity (an IdP / SSO for users, workload identity/SPIFFE for services), plus device posture and context, not IP address.
- **mTLS everywhere** — services mutually authenticate with certificates on every connection (this is exactly what a service mesh automates), so the network transport is treated as hostile.
- **Least-privilege, per-request authorization** — fine-grained policy per service/resource, continuously evaluated, not a one-time network-admittance check.
- **Microsegmentation** — NetworkPolicies/identity-based segmentation so a compromised workload can't move laterally.

Senior framing: zero-trust is why the network stops being a security boundary and identity + encryption take over — the same principle behind the service mesh and cloud security-group design.

### Q5. Why is IPv6 adoption finally accelerating, and how do you run it?

The forcing function is **IPv4 exhaustion**: the free pool ran out, addresses are now bought and leased at real cost, and carrier-grade NAT (stacking NAT to stretch IPv4) breaks applications and adds latency. IPv6's 128-bit space (~3.4×10^38 addresses) removes scarcity and restores true end-to-end addressing without NAT. Major mobile carriers run **IPv6-only** internally, large content networks are dual-stacked, and global adoption at big eyeball networks is well past 40%.

How you actually roll it out:

- **Dual-stack** — run IPv4 and IPv6 in parallel on the same hosts; clients prefer IPv6 (via **Happy Eyeballs**, racing both and using whichever connects first, falling back gracefully). This is the pragmatic default for a long transition.
- **IPv6-only + NAT64/DNS64** — for networks that want to drop IPv4 internally: **DNS64** synthesizes an IPv6 address for IPv4-only destinations, and **NAT64** translates the traffic at the edge, so IPv6-only clients still reach the legacy IPv4 internet.

Interview notes that show depth: IPv6 has **no broadcast** (uses multicast) and no NAT by design, so security shifts from "NAT hides me" to explicit **firewalling** (a stateful firewall, not address translation, provides the boundary). And SLAAC + ICMPv6 Neighbor Discovery replaces ARP/DHCP's role. The takeaway: IPv6 isn't a maybe anymore; dual-stack is the mainstream posture.

### Q6. What is WireGuard and why is it displacing IPsec/OpenVPN?

**WireGuard** is a modern VPN protocol built directly into the **Linux kernel**, designed to be radically simpler than its predecessors. Where **IPsec** is a sprawling suite (IKE, SAs, dozens of negotiable options) and **OpenVPN** runs in userspace over TLS with its own overhead, WireGuard is a few thousand lines of code with a fixed, opinionated modern crypto suite (Curve25519, ChaCha20-Poly1305, BLAKE2s) — no negotiation, no cipher downgrade surface.

Why it's winning:

- **Simplicity = security** — a tiny, auditable codebase versus IPsec's huge attack surface. Configuration is just public keys and allowed IPs, SSH-style.
- **Performance** — in-kernel and lean, it consistently outperforms OpenVPN and often IPsec on throughput and latency, with lower CPU.
- **Roaming** — it's connectionless/stateless at setup (uses public-key identity, not a session handshake per reconnect), so it handles clients changing IPs gracefully — great for mobile.
- **Modern crypto only** — no legacy algorithms to misconfigure.

It underpins consumer products (Tailscale, which layers a control plane and NAT traversal on top of WireGuard) and is increasingly the default for site-to-site and remote-access VPNs. The tradeoff to name: WireGuard is deliberately minimal — it lacks IPsec's enterprise features (complex policy, built-in dynamic key distribution at scale), which is exactly why overlays like Tailscale add a coordination layer around it.

### Q7. What are DoH, DoT, and ECH, and what privacy gap do they close?

Classic DNS and TLS leak *what sites you visit* even when the page content is encrypted. Three technologies plug the remaining plaintext holes:

- **DoT (DNS-over-TLS, port 853)** — wraps DNS queries in TLS. Encrypts them from eavesdroppers, on a dedicated port so it's easy for networks to see (and choose to allow/block) that DNS is happening.
- **DoH (DNS-over-HTTPS, port 443)** — sends DNS queries as HTTPS requests, blending into normal web traffic so they can't be trivially distinguished or selectively blocked. Same encryption, more censorship-resistant, but harder for network operators to manage/monitor — a real policy tension.
- **ECH (Encrypted Client Hello)** — closes the last leak: even with encrypted DNS, the TLS handshake's **SNI** field historically sent the target hostname in **plaintext** so anyone on-path could see which site you're connecting to. ECH encrypts the ClientHello (including SNI), removing that observability.

The through-line: the industry is systematically encrypting metadata, not just payloads. In an interview, the nuance that scores points is the **operational tension** — DoH in particular breaks the traditional model where enterprises/resolvers do DNS-based filtering, security, and split-horizon resolution, which is why it's simultaneously a privacy win and an operations headache.

### Q8. Why does AI/HPC networking need RDMA, RoCE, or InfiniBand?

Because large-model training is a **distributed** computation where thousands of GPUs must constantly exchange gradients (all-reduce) every step, and the network — not the GPUs — becomes the bottleneck. Standard TCP/IP networking is fatal here for two reasons: the **kernel networking stack adds latency and CPU overhead** (copies, context switches, interrupts) on every transfer, and TCP's latency variance stalls tightly synchronized collectives.

The fix is **RDMA (Remote Direct Memory Access)** — one machine writes directly into another's memory, **bypassing the CPU and kernel** on both ends (zero-copy, kernel-bypass). This gives microsecond latency and near-wire-speed bandwidth with almost no CPU cost. Two implementations:

- **InfiniBand** — a purpose-built lossless fabric (separate from Ethernet) with native RDMA; the traditional HPC/supercomputer choice, dominant in top-tier AI clusters.
- **RoCE (RDMA over Converged Ethernet)** — RDMA carried over Ethernet, so you can build RDMA fabrics on (specially configured, lossless/PFC) Ethernet gear and reuse Ethernet operational skills.

Why a senior should care even outside AI: it illustrates that at extreme scale, **the general-purpose kernel network stack is the enemy** — the same motivation behind eBPF/XDP, DPUs, and kernel-bypass frameworks like DPDK. AI training simply made ultra-low-latency, high-bandwidth, lossless fabrics a mainstream infrastructure concern rather than a niche HPC one.

### Q9. What is SD-WAN and what problem does it solve?

**SD-WAN (software-defined WAN)** applies SDN principles to the enterprise wide-area network connecting branch offices, datacenters, and cloud. Traditionally a branch backhauled all traffic over an expensive, rigid **MPLS** circuit to a central datacenter — including internet/SaaS traffic, which then hairpinned back out, adding latency and cost.

SD-WAN decouples the control plane from the underlying links and makes routing **application-aware and policy-driven** across *multiple* transports at once (MPLS, broadband internet, LTE/5G):

- **Centralized policy** — define intent ("send video conferencing over the lowest-latency path, bulk backups over cheap broadband, send SaaS straight to the internet") once, pushed to all sites.
- **Dynamic path selection** — continuously measure each link's latency/loss/jitter and steer each app's traffic over the best-performing path, failing over automatically.
- **Local internet breakout** — send SaaS/cloud traffic directly out from the branch instead of backhauling, cutting latency and MPLS cost.
- **Integrated security** — increasingly merged with cloud-delivered security (**SASE** — Secure Access Service Edge — combining SD-WAN + zero-trust + cloud firewalls).

The one-liner: **SD-WAN replaces expensive, static MPLS-centric WANs with cheap, software-controlled, application-aware multi-link connectivity** — and it's converging with zero-trust into SASE.

### Q10. How do smartNICs, DPUs, and programmable data planes change the picture?

The shared idea: **offload networking (and security and storage) off the host CPU into dedicated programmable hardware**, so the CPU is freed for application work and packet processing happens faster and more predictably.

- **SmartNIC / DPU (Data Processing Unit)** — a NIC with its own CPU cores, memory, and programmable accelerators (e.g. NVIDIA BlueField, AWS Nitro). It runs the virtual switching, overlay encap/decap (VXLAN/GENEVE), security groups, encryption, and even storage virtualization that used to burn host CPU cycles. In hyperscale clouds this is huge: the hypervisor's networking is offloaded to the DPU so nearly 100% of host CPU is sellable to tenants, and the DPU also forms a hardware security/isolation boundary.
- **Programmable data planes (P4, SDN)** — switches/NICs whose forwarding behavior is defined in software (the **P4** language) rather than fixed silicon, letting operators customize how packets are parsed and handled.
- **Kernel bypass (DPDK, XDP)** — the software-side cousin: move packet processing out of the slow general-purpose kernel path for line-rate throughput.

The pattern to articulate: at scale, **general-purpose CPUs and the general-purpose kernel stack can't keep up**, so networking is being pushed both **into the kernel programmably (eBPF/XDP)** and **out into dedicated silicon (DPUs)**. This is the same force behind RDMA and eBPF — specialize the fast path.

### Q11. Does HTTP/3 / QUIC matter for APIs and gRPC too, not just browsers?

Yes, and it's an under-appreciated point. QUIC's benefits aren't web-page-specific — they help any request/response or streaming workload, especially over lossy or mobile networks:

- **gRPC over HTTP/3** — gRPC is built on HTTP/2 and inherits its **TCP head-of-line blocking**: many concurrent gRPC streams share one TCP connection, so one lost packet stalls all of them. On QUIC, streams are transport-independent, so a loss on one RPC doesn't block the others — a real win for high-concurrency microservice and mobile-to-backend traffic.
- **Faster connection setup** — 1-RTT/0-RTT matters most for short-lived or intermittent API calls where the handshake dominates total time (mobile apps waking up, serverless cold paths).
- **Connection migration** — mobile API clients switching networks keep their connection alive instead of re-establishing.

The caveats a senior would raise: QUIC is **more CPU-intensive** than TCP today (userspace, per-packet crypto, less mature offload), so for high-throughput server-to-server traffic inside a datacenter on a reliable network, plain HTTP/2 over TCP is often still fine or better. QUIC's edge is **lossy/high-latency/mobile last-mile** paths. So the honest answer is "yes for internet-facing and mobile-facing APIs; evaluate carefully for east-west datacenter traffic."

### Q12. How has network observability changed with modern tooling?

The shift is from **sampling and manual instrumentation** to **kernel-native, always-on, identity-aware** visibility — largely powered by eBPF.

The old world: you inferred network health from application logs, sampled flow logs (NetFlow/sFlow), and occasional `tcpdump`. Gaps everywhere, and correlating a slow request to a network cause meant guesswork.

The modern world:

- **eBPF-based flow visibility** — tools like **Cilium Hubble** and **Pixie** attach eBPF programs to see *every* connection, DNS query, HTTP request, and policy drop with low overhead and no app changes. You get service-to-service maps and per-request golden signals for free.
- **Service-mesh telemetry** — the mesh's data plane emits consistent latency/error/traffic metrics and distributed traces for every hop, so east-west traffic is finally observable.
- **Identity-aware, not just IP-aware** — in a dynamic cloud/K8s world IPs churn constantly, so modern tools attribute traffic to *service identities* (pod/service/namespace), which is the only stable unit.
- **Distributed tracing (OpenTelemetry)** stitching network hops to application spans, so "the site is slow" resolves to a specific hop.

The senior point: dynamic, ephemeral infrastructure broke IP-and-port-based monitoring, and eBPF + mesh telemetry + tracing replaced it with continuous, identity-centric observability. This is what actually powers the diagnosis playbooks in the next topic at scale.

### Q13. What's hype versus real in modern networking?

The honest, calibrated take an interviewer wants:

**Real and production-proven:**

- **HTTP/3/QUIC** — deployed by every major browser and CDN; not speculative.
- **eBPF** — running in production at Meta, Google, Cloudflare, and in mainstream CNIs (Cilium). A genuine platform shift.
- **Zero-trust / mTLS** — architecturally mainstream; BeyondCorp-style access is standard at scale.
- **IPv6 dual-stack** and **WireGuard** — both boring-and-working now.
- **RDMA/RoCE for AI** — non-negotiable for large-model training; very real.

**Real but nuanced / not-for-everyone:**

- **Service mesh** — valuable at genuine microservice scale, but often over-adopted; small systems pay the complexity tax for little benefit. Ambient/eBPF meshes reduce, not eliminate, that tax.
- **QUIC for internal east-west** — evaluate; not a blanket win (Q11).

**Overhyped or over-applied:**

- **"Mesh/K8s/multi-cloud everything"** — frequently adopted as résumé-driven architecture before the scale that justifies it exists.
- **SASE branding** — the underlying tech (SD-WAN + zero-trust) is real; the marketing bundling is often noise.

The meta-skill being tested: can you resist cargo-culting? The senior answer names the *problem each thing solves* and applies it only when you actually have that problem. "We adopted a service mesh for eight services" is a red flag; "we adopted eBPF-based networking because iptables didn't scale to our service count" is sound.

### Q14. Where should an engineer invest their networking learning today?

Frame it as durable fundamentals plus high-leverage modern layers — and say *why* each:

**Non-negotiable fundamentals (never go stale):** the TCP/IP model, TCP/UDP behavior, DNS, TLS, HTTP semantics, and systematic diagnosis (`dig`, `curl -v`, `ss`, `tcpdump`, `mtr`). Everything modern is built on these, and every incident is debugged with them. This is the highest ROI, full stop.

**High-leverage modern layers (broad applicability):**

- **Cloud networking** — VPCs, subnets, security groups, load balancers, private connectivity. Nearly every job runs on this.
- **Kubernetes networking + eBPF/Cilium** — the direction the whole container ecosystem is moving; understanding the flat pod model, CNI, and eBPF pays off widely.
- **TLS/PKI and zero-trust/mTLS** — security is everyone's job now; certificate and identity fluency is universally useful.
- **HTTP/3/QUIC** — enough to reason about it and debug fallbacks.

**Specialize only if your domain demands it:** RDMA/RoCE (AI/HPC infra), DPUs/P4 (hyperscale/network engineering), SD-WAN/SASE (enterprise networking).

The judgment to voice: **depth on fundamentals beats breadth on buzzwords.** An engineer who can debug a TLS handshake and reason about congestion control will outperform one who can name every CNI but can't read a `tcpdump`. Learn the layer you operate at deeply, and keep a working mental model of the one below it.

### Q15. Summarize the biggest shifts and the single thread connecting them.

The headline shifts:

- **Transport**: TCP → **QUIC/HTTP3** (userspace, no HOL blocking, faster, migratable).
- **Kernel**: iptables/modules → **eBPF/XDP** (safe in-kernel programmability).
- **Service comms**: hand-rolled → **service mesh** → **ambient/eBPF sidecar-less**.
- **Security**: perimeter trust → **zero-trust + mTLS everywhere**.
- **VPN**: IPsec/OpenVPN → **WireGuard**.
- **Addressing**: IPv4+NAT → **IPv6 dual-stack**.
- **Privacy**: plaintext DNS/SNI → **DoH/DoT/ECH**.
- **Hardware**: host-CPU networking → **DPUs/smartNICs + RDMA fabrics**.

The single connecting thread: **specialize the fast path and stop trusting the network.** Functionality is being pushed *up* into evolvable userspace (QUIC) and *down* into the kernel (eBPF) and silicon (DPUs, RDMA) to escape the slow, ossified, general-purpose middle — while trust migrates from network location to cryptographic identity (zero-trust, mTLS, encrypted metadata). Every item above is one of those two forces at work. If you can state that thread and place any new technology on it, you're reasoning like a staff engineer rather than memorizing acronyms — which is exactly what the **Scenario & Troubleshooting Playbooks** topic then asks you to apply under pressure.

## Scenario & Troubleshooting Playbooks

### Summary

**What this topic covers**

The capstone. Every "walk me through it," "trace this request," "design this path," and "diagnose this failure" question an interviewer throws to see whether you can *apply* the whole primer under pressure rather than recite it. The 17 questions split into two families: **walkthroughs** (the definitive "what happens when you type google.com and press enter," tracing a request through CDN → LB → proxy → app → DB, and how a packet crosses the internet) and **diagnose/design scenarios** (the site is slow, connection refused vs timeout, can-ping-but-not-connect, flaky DNS, TLS failures, p99 latency spikes, packet loss, uploads hanging, port exhaustion, designing a secure path, pods that can't talk). Each answer is a layered decision tree with real command sequences — `dig`, `curl -v -w`, `openssl s_client`, `ss`, `tcpdump`, `mtr` — not hand-waving.

**Mental model**

Debug the network the way the packet travels: **layer by layer, and isolate where it breaks.** Walk the stack in order — **physical/link → IP/routing → transport (TCP/UDP) → DNS → TLS → application** — and at each layer ask "does it work here?" The moment you find the lowest broken layer, you've localized the fault; everything above is a symptom. Two compasses cut the search space fast. (1) **`curl -w` timing breakdown** tells you *which phase* is slow — DNS lookup, TCP connect, TLS handshake, time-to-first-byte, or transfer — so "the site is slow" becomes "TLS is slow" in one command. (2) **Connection refused vs connection timeout** tells you *how far* you got: **refused = you reached the host and nothing is listening (RST)**; **timeout = the packet vanished into a firewall or black hole (no reply)**. Always reproduce, always bisect (client vs network vs server, one variable at a time), and reason from what each tool's output *rules out*.

**Key terms**

- **Connection refused** — an RST came back: you reached the host, but no process is listening on that port (or a firewall actively rejects).
- **Connection timeout** — no reply at all: a firewall silently dropped it, wrong route, or host unreachable.
- **TTFB (time to first byte)** — time from request sent to first response byte; isolates server/backend think-time from transfer time.
- **`curl -w`** — prints a timing breakdown (`time_namelookup`, `time_connect`, `time_appconnect`, `time_starttransfer`, `time_total`).
- **`ss` / `netstat`** — socket states (LISTEN, ESTABLISHED, TIME_WAIT); is the service even listening?
- **`mtr`** — continuous `traceroute` + `ping` per hop; finds *where* on the path loss/latency appears.
- **`openssl s_client`** — opens a raw TLS connection to inspect cert chain, expiry, name, and protocol.
- **`dig`** — queries DNS directly; `+trace` walks root → TLD → authoritative; `@resolver` targets a specific server.
- **`tcpdump`** — captures packets to prove what actually went on the wire (SYN? SYN-ACK? RST?).
- **TIME_WAIT** — the 2·MSL state after a socket closes; huge counts on a busy proxy hint at ephemeral-port exhaustion.
- **Path MTU black hole** — large packets silently dropped because a link's MTU is smaller and ICMP "fragmentation needed" is blocked; small requests work, big transfers hang.
- **RST vs FIN** — RST is an abrupt reset (refused/aborted); FIN is a graceful close.

**Why interviewers ask this**

These questions are the whole point of a networking interview: fundamentals only matter if you can deploy them when something is on fire. Junior candidates guess ("maybe restart it?") or fixate on one layer. Senior candidates show a **method**: reproduce, go layer by layer, use the right tool to rule out each layer, and narrate what each result *means*. The "type a URL" walkthrough is the single most common systems question ever asked because it touches DNS, TCP, TLS, HTTP, proxies, CDNs, and rendering in one breath — the depth you go to is a direct proxy for seniority. And "the site is slow" or "connection refused vs timeout" reveal in seconds whether you own production or just deploy to it. The signal is **structured reasoning under ambiguity**, not trivia recall.

**Common confusions**

- "Connection refused and timeout are basically the same" — opposite meanings: **refused = reached, nothing listening; timeout = never got a reply.** This one distinction directs your entire investigation.
- "The site is slow, so add more bandwidth" — usually it's latency, DNS, TLS, TTFB, or a cold connection — bandwidth rarely fixes it. Measure first with `curl -w`.
- "`ping` works so the service is up" — `ping` tests ICMP reachability, not that the *service* on port 8080 is listening. Different layers.
- "TLS cert error means the cert is expired" — could be expiry, name mismatch, an incomplete chain, an untrusted root, or **client clock skew**. `openssl s_client` tells you which.
- "Packet loss means bad hardware" — often congestion/bufferbloat or one bad hop; `mtr` localizes it before you blame anything.
- "Large uploads hang, so the app is broken" — classic **path-MTU black hole**; the app is fine, the network is dropping big packets.

**What follows from this topic**

Nothing follows — this is where the primer lands. Every earlier topic feeds in: TCP/UDP and the handshake, DNS resolution, the TLS handshake, HTTP, load balancers and proxies, CDNs, cloud VPCs and security groups, and Kubernetes pod networking all reappear here as diagnostic surfaces. If you can walk the "type a URL" question end to end and turn "it's slow / it's refused / it's flaky" into a layered command sequence, you've demonstrated you can do the job, which is exactly what the interview is for.

### Q1. Walk me through what happens when you type google.com into your browser and press Enter.

The definitive senior answer walks every layer. Go deep but stay ordered:

**1. URL parse & preliminaries.** The browser parses the URL (scheme, host, path). It checks **HSTS** (should this be forced to HTTPS?) and its caches.

**2. DNS resolution — turn the name into an IP.** Check in order: browser cache → OS cache → `/etc/hosts` → the configured resolver. On a miss, the recursive resolver walks the hierarchy: **root** servers (→ `.com` TLD servers) → **TLD** (→ google.com's authoritative NS) → **authoritative** server returns the A/AAAA record. TTLs cache each step. (Increasingly this may be **DoH**, and the record often points at a CDN/anycast IP near you.)

**3. TCP handshake — establish a connection.** To the resolved IP:443, the **3-way handshake**: `SYN → SYN-ACK → ACK`. (Or a **QUIC/UDP** setup if HTTP/3.)

**4. TLS handshake — secure it.** ClientHello (with **SNI** = google.com, cipher list) → server cert + ServerHello → verify the cert chain against trusted roots, check name and expiry → agree keys. **TLS 1.3 is 1-RTT**. Now the channel is encrypted.

**5. HTTP request.** The browser sends `GET / HTTP/2` (or /3) with Host, cookies, Accept, User-Agent headers.

**6. Server side — the request rarely hits one box.** It usually lands at a **CDN edge / anycast** node first, which may serve cached content or forward to origin. At the origin it passes a **load balancer** → **reverse proxy** → application server, which may query **caches/databases** to build the response.

**7. Response & render.** Server returns a status + headers + HTML. The browser parses HTML, then fetches subresources (CSS, JS, images — each possibly its own DNS/TCP/TLS unless connections are reused), builds the DOM/CSSOM, runs JS, and paints. `keep-alive`/multiplexing reuse connections.

The tell of seniority is naming *caching at every layer*, *SNI/cert verification*, *the CDN/LB/proxy/app/DB chain*, and *HTTP/2-3 multiplexing* — not just "it looks up the IP and gets the page."

### Q2. Trace a request from a user through CDN → LB → reverse proxy → app → DB and back.

Follow it hop by hop, naming what each layer does:

```text
User → DNS (→ anycast CDN IP) → CDN edge → [cache hit? return]
     → origin LB (L4/L7) → reverse proxy → app server → cache/DB → back up
```

1. **DNS** resolves to an **anycast** address, steering the user to the nearest **CDN edge** PoP.
2. **CDN edge**: terminates TLS at the edge, checks its **cache**. On a hit for static/cacheable content, it returns immediately — the request never reaches your origin. On a miss (or dynamic content), it forwards to origin, often over a warm keep-alive connection.
3. **Load balancer** at the origin: an **L7 ALB** routes by path/host (`/api` vs `/static`), does health checks, and spreads across app instances; or an **L4 NLB** for raw connection forwarding.
4. **Reverse proxy** (nginx/Envoy): TLS termination (if not at edge), request routing, rate limiting, header manipulation, maybe response caching.
5. **App server**: runs business logic. Checks an **in-memory/Redis cache** first; on a miss queries the **database** (ideally a read replica for reads).
6. **Response** flows back up the same chain: app → proxy → LB → CDN (which may **cache** it per `Cache-Control`) → user.

Senior details to drop: **where TLS terminates** (edge vs origin, and re-encryption for zero-trust), **connection reuse/pooling** at each hop, **cache layers** (CDN, reverse proxy, app cache, DB buffer pool), and **read/write splitting** at the DB. The theme: most requests are absorbed by a cache long before the DB, and each hop adds latency you can measure.

### Q3. How does a packet get from your laptop to a server across the internet?

Trace it at the IP/link layer — this tests routing, ARP, and NAT understanding:

1. **Is the destination local or remote?** The laptop compares the destination IP to its own subnet/mask. Remote → send to the **default gateway**.
2. **ARP — find the gateway's MAC.** IP needs a link-layer address for the next hop. The laptop broadcasts **ARP** ("who has 192.168.1.1?"), the router replies with its MAC. The packet is framed with the router's MAC as destination (but the *IP* destination stays the server's).
3. **NAT at the home/edge router.** The router rewrites the private source IP (`192.168.1.x`) to its public IP and records the mapping (**source NAT / PAT**), so replies can be translated back.
4. **Hop by hop across the internet.** Each router looks up the destination IP in its routing table and forwards to the next hop. **BGP** is what stitched those inter-network routes together — the packet crosses multiple autonomous systems (ISP → transit → destination network). **TTL** decrements each hop (hits 0 → dropped, which is how `traceroute` works). Each hop re-frames with new link-layer addresses; the IP addresses persist end to end.
5. **Arrival.** The destination network routes it to the server's subnet; a final ARP resolves the server's MAC; the frame is delivered; the server's NIC hands the packet up its stack (IP → TCP → app).

The key mental model to state: **link-layer (MAC) addresses change at every hop; the IP addresses stay constant end-to-end** (except NAT rewriting the source). `traceroute` / `mtr` make this path visible.

### Q4. The website is slow — how do you diagnose it?

Don't guess — **measure which phase is slow** with one command, then drill:

```bash
curl -w "dns:%{time_namelookup} connect:%{time_connect} tls:%{time_appconnect} ttfb:%{time_starttransfer} total:%{time_total}\n" -o /dev/null -s https://acme.example.com
```

Read the breakdown and follow the tree:

- **`time_namelookup` high** → **DNS** is slow. Check the resolver (`dig @1.1.1.1 acme.example.com` vs the local resolver), TTLs, and CNAME chains.
- **`time_connect` high** (but DNS fine) → **TCP setup / network latency**. High RTT to the server — check `mtr` for a slow/distant path; is the user far from the region? Missing CDN?
- **`time_appconnect` high** → **TLS handshake** slow. Extra round-trips (TLS 1.2 vs 1.3?), large cert chain, OCSP stapling, or CPU-bound server.
- **`time_starttransfer` (TTFB) high** (connect + TLS fine) → the **server/backend** is slow: app compute, a slow DB query, cache misses, a downstream dependency. Pivot to app/DB profiling and tracing.
- **`time_total` >> TTFB** → the **transfer** is slow: large uncompressed payload, low bandwidth, or many round-trips. Check response size, gzip/brotli, and whether it's bandwidth or latency bound.

Then distinguish **latency vs bandwidth**: a slow *first byte* on a small response is latency (RTT, geography, cold connections); a slow *large download* is bandwidth/congestion. And check **CDN/edge**: is content served from a nearby PoP (`cache: HIT`) or hairpinning to a distant origin? The method — *isolate the phase, then dig into that layer only* — is what scores, not any single fix.

### Q5. Connection refused vs connection timeout — what does each tell you?

This is the single most useful diagnostic distinction in networking. They mean opposite things:

| | Connection **refused** | Connection **timeout** |
|---|---|---|
| Wire event | An **RST** (or ICMP port-unreachable) came back | **No reply at all** |
| Meaning | You **reached the host**; nothing is listening on that port (or a firewall actively rejects) | The packet **vanished** — silently dropped |
| Likely cause | Service down/not started, wrong port, listening on `127.0.0.1` only | Firewall/security-group DROP, wrong IP/route, host down/unreachable |
| Speed | **Fast** (immediate reject) | **Slow** (hangs until timeout) |

**Refused** is good news, oddly — the network path works and you found the host; the problem is the *service* (crashed, not started, bound to the wrong interface, wrong port). Check `ss -tlnp` on the server: is anything on that port, and on `0.0.0.0` vs `127.0.0.1`?

**Timeout** means the packet never got a response — something is **silently dropping** it. That's almost always a **firewall / security group / NACL** with a DROP rule, a routing problem, or the host being down. The silence is the clue: a firewall configured to *reject* would give you refused; one configured to *drop* gives you timeout.

Prove it with `tcpdump`: **refused** shows `SYN → RST`; **timeout** shows `SYN` with no reply (retransmitted SYNs). One packet capture ends the debate.

### Q6. I can ping the host but can't reach the service on port 8080 — what's going on?

`ping` succeeding tells you exactly one thing: **the host is up and ICMP reaches it at the IP layer.** It says nothing about a TCP service on 8080 — different layer. Three candidates, checked in order:

**1. Is the service even listening?** On the server:

```bash
ss -tlnp | grep 8080     # is anything LISTENing on 8080?
```

If nothing → the process is down or never bound. If it shows `127.0.0.1:8080` instead of `0.0.0.0:8080`, it's **bound to loopback only** — reachable locally but not from other hosts. Very common cause. Confirm locally: `curl localhost:8080` works but remote doesn't.

**2. Is a firewall dropping it?** Test the port from the client:

```bash
nc -vz host 8080          # or: curl -v telnet://host:8080
```

**Timeout** → firewall / security group / NACL is dropping 8080 (the `ping` got through because ICMP is allowed but 8080 isn't). **Refused** → reached the host, nothing listening (back to cause 1). This is exactly the refused-vs-timeout compass from Q5.

**3. Is it the right host/routing?** In cloud/K8s, "the host" you ping may not be where the service runs — check you're hitting the right instance/pod/service IP and the security group/NetworkPolicy allows 8080 from your source.

The senior move: state that `ping` and the service are **different layers**, then bisect with `ss` (server-side: is it listening?) and `nc` (client-side: refused or timeout?) to localize to service-down vs bind-address vs firewall.

### Q7. DNS resolves intermittently or to the wrong IP — how do you debug it?

DNS flakiness is usually caching, TTL, or multiple-answer issues. Query DNS directly to take the app out of the picture:

```bash
dig acme.example.com                 # what does my resolver return?
dig @1.1.1.1 acme.example.com        # what does a public resolver return?
dig +trace acme.example.com          # walk root → TLD → authoritative
dig acme.example.com +short          # just the IPs
```

Work through the causes:

- **Intermittent resolution** → often **multiple A records** and one backend is dead, or **round-robin DNS** handing out a bad IP some of the time. `dig` repeatedly and watch the answers rotate. Also check for one flaky resolver in a multi-resolver setup.
- **Wrong IP / stale answer** → **caching + TTL**. A record changed but old answers are cached until the TTL expires. Compare your resolver's answer to the authoritative one (`dig @<authoritative-NS>`); if they differ, it's cache/propagation. Low TTLs speed future changes.
- **Different answers in different places** → **split-horizon DNS** (internal vs external views return different IPs) or **GeoDNS/anycast** steering by location. Expected, not a bug — confirm which view you're in.
- **Recently changed record not visible** → **propagation delay**; bounded by the old TTL. `dig +trace` shows the authoritative truth regardless of caches.

The method: compare **your resolver** vs **a public resolver** vs **the authoritative server**. Where they diverge tells you whether it's caching (resolver stale), the authoritative data itself, or split-horizon/geo. `dig +trace` is your ground truth.

### Q8. A TLS handshake fails or the browser shows a cert error — how do you diagnose it?

Inspect the actual TLS connection instead of trusting the browser's summary:

```bash
openssl s_client -connect acme.example.com:443 -servername acme.example.com
# add -showcerts to see the full chain
echo | openssl s_client -connect acme.example.com:443 -servername acme.example.com 2>/dev/null | openssl x509 -noout -dates -subject -issuer
```

`-servername` is essential — it sends **SNI**, so you get the right cert on a multi-tenant host. Then check each failure mode:

- **Expired / not-yet-valid** → the `notBefore`/`notAfter` dates. Also check **client clock skew** — a wrong local clock makes a valid cert look expired. Very common and easily missed.
- **Name mismatch** → the cert's **Subject / SAN** doesn't include the hostname you're using (e.g. cert for `acme.example.com`, you hit `www.acme.example.com`). SANs must match.
- **Incomplete / broken chain** → the server didn't send the **intermediate** cert, so clients can't build a path to a trusted root. `openssl` shows `unable to get local issuer certificate`; browsers with cached intermediates may work while others fail — a classic "works on my machine" TLS bug. Fix: serve the full chain.
- **Untrusted root** → self-signed or a private CA the client doesn't trust.
- **Protocol / cipher mismatch** → client and server share no common TLS version/cipher (e.g. client requires TLS 1.2+ but server offers only 1.0). `openssl` reports the negotiated (or failed) protocol.

The method: `openssl s_client` gives you the raw chain, dates, subject/SAN, and negotiated protocol in one shot — read those and the cause is usually obvious. Rule out clock skew early; it fools people.

### Q9. p99 latency is spiky under load but the mean looks fine — what's happening?

A healthy mean with a bad tail means **most requests are fine and a minority hit something expensive** — you're debugging the tail, not the average. The usual suspects, roughly ordered:

- **Queueing / congestion (bufferbloat)** — under load, packets pile up in oversized buffers along the path or in the server's accept queue; queue wait dominates for unlucky requests. Classic bufferbloat signature: latency climbs sharply as throughput approaches capacity. Check queue depths and consider modern congestion control (BBR) / AQM (fq_codel).
- **Head-of-line blocking** — on HTTP/2-over-TCP, one lost packet stalls all multiplexed streams on that connection (the exact problem HTTP/3 solves). A few connections eat the loss, spiking their p99.
- **Connection cold-start** — new connections pay DNS + TCP + TLS handshake and TCP **slow-start** (small initial congestion window ramping up). Under load or with poor pooling, requests that must open fresh connections are far slower than those reusing warm ones. Fix with connection pooling / keep-alive.
- **GC / stop-the-world pauses** — server-side JVM/Go GC pauses freeze request handling periodically; requests unlucky enough to land in a pause spike. Correlate p99 spikes with GC logs.
- **Resource contention / lock waits / a slow shared dependency** (a saturated DB connection pool, a downstream at capacity) — tail requests wait on the contended resource.
- **Retries and timeouts amplifying under load** — aggressive retries add load exactly when the system is struggling, worsening the tail.

The senior approach: **tail latency is about variance, not throughput.** Look for queueing (bufferbloat), cold connections (slow-start/handshake), periodic pauses (GC), and contention — and reproduce with load while watching per-phase timing. "Add capacity" may help queueing but won't fix cold-start or GC.

### Q10. You see intermittent packet loss — how do you find where it's happening?

Localize the loss to a specific hop before blaming anything. `ping` tells you *that* there's loss; **`mtr`** tells you *where*:

```bash
mtr acme.example.com          # continuous per-hop loss% + latency
mtr -rw -c 100 acme.example.com   # report mode, 100 packets, wide
```

Read the per-hop table carefully — the interpretation is the skill:

- **Loss that starts at hop N and continues to the destination** → the real problem is at/after hop N (or its outbound link). That hop is your suspect.
- **Loss at a middle hop that does NOT appear at later hops** → usually a **red herring**: that router is just **deprioritizing ICMP** to its own control plane (rate-limiting replies) while still forwarding your actual traffic fine. Only loss that *persists to the destination* matters. This is the classic `mtr` misread interviewers probe for.
- **Loss only at the final hop / destination** → the server itself or its immediate network (overloaded, firewall rate-limiting).

Then reason about the location: loss inside your network → your problem (fix it); loss at an ISP/transit hop → open a ticket with evidence; loss only under load → congestion, not a broken link. Run `mtr` from **both directions** if you can, since routing is often asymmetric and the loss may be on the return path.

The key senior insight to state: **ignore mid-path ICMP loss that doesn't reach the destination** — it's rate-limited control traffic, not real forwarding loss. Only end-to-end loss is actionable.

### Q11. Small requests work but large uploads or downloads hang — what's the likely cause?

The signature — small stuff fine, big transfers stall — screams **MTU / path-MTU black hole**. Here's the mechanism:

Somewhere on the path a link has a smaller **MTU** than your interface (common with **VPN/overlay tunnels** — VXLAN/GENEVE/IPsec add header overhead, shrinking the usable MTU below 1500). Small packets fit and sail through, so pings and small requests work. A full-size 1500-byte packet doesn't fit that link. Normally the router would send an **ICMP "fragmentation needed"** message telling the sender to lower its packet size (Path MTU Discovery). But if a firewall **blocks ICMP** (over-aggressive "drop all ICMP" rules), that message never arrives — the big packets are silently dropped and the sender keeps retrying blindly. Result: the connection **hangs** on anything that sends large packets (uploads, big responses, TLS handshakes with large certs).

How to confirm and fix:

```bash
# Find the largest packet that gets through (DF = don't fragment)
ping -M do -s 1472 acme.example.com     # 1472 + 28 hdr = 1500; shrink until it succeeds
tracepath acme.example.com              # reports the path MTU directly
```

If `-s 1472` fails but smaller sizes succeed, you've got an MTU limit. Fixes: **stop blocking ICMP** (so PMTUD works), **lower the interface/tunnel MTU** to fit (e.g. 1400 on overlays), or **clamp TCP MSS** (`MSS clamping` on the gateway) so TCP never negotiates segments too big for the path.

Senior tell: the moment you hear "small works, large hangs," say **path-MTU black hole from blocked ICMP on a tunnel** — it's the textbook cause, and it explains why the app looks broken when the network is the culprit.

### Q12. A busy reverse proxy shows huge numbers of TIME_WAIT sockets — is that a problem?

First, know what **TIME_WAIT** is: after a TCP connection closes, the side that closed **actively** (sent the last FIN) holds the socket in TIME_WAIT for **2·MSL** (~60s on Linux). This is *by design* — it ensures late/duplicate packets from the old connection can't be misdelivered to a new connection reusing the same 4-tuple, and that the final ACK is retransmittable. So TIME_WAIT sockets are normal and mostly harmless in themselves.

When it *becomes* a problem: a busy proxy making **many short-lived outbound connections** to backends accumulates TIME_WAIT on the **client side** (the proxy). Each outbound connection consumes an **ephemeral port** for the (src-ip, src-port, dst-ip, dst-port) tuple, and the port stays reserved through TIME_WAIT. With a limited ephemeral port range (~28k by default) and tens of thousands of new connections per minute, you hit **ephemeral port exhaustion** — new outbound connections fail with "cannot assign requested address."

Diagnose:

```bash
ss -s                         # summary: counts by socket state
ss -tan state time-wait | wc -l
sysctl net.ipv4.ip_local_port_range   # how many ephemeral ports exist
```

The right fixes (in order of preference):

- **Reuse connections** — enable **keep-alive / connection pooling** to backends so you're not opening a fresh connection per request. This is the real fix: fewer connections, less TIME_WAIT.
- **`net.ipv4.tcp_tw_reuse=1`** — lets the kernel safely reuse TIME_WAIT sockets for new *outbound* connections (safe; uses timestamps). Preferred kernel knob.
- **Widen the ephemeral port range** — more ports to work with.
- Avoid `tcp_tw_recycle` — removed/dangerous, breaks behind NAT.

Senior framing: **TIME_WAIT is correct behavior, not a bug; the real issue is connection churn.** Fix the churn with pooling before touching sysctls.

### Q13. Design the network path and security for a public web service, end to end.

Trace the request path top to bottom, layering a security control at each tier — this ties the cloud topology to the request walkthrough:

```text
Users
  │  (DNS → anycast)
[ CDN + WAF ]         TLS terminate at edge; cache static; WAF filters injection/bots; DDoS absorb
  │
[ L7 Load Balancer ]  public subnet; SG allows only 443 from internet; health checks; path routing
  │  (re-encrypt / mTLS inward for zero-trust)
[ Reverse proxy / API gateway ]  authn, rate limiting, routing
  │
[ App servers ]       private subnets, no public IP; SG allows app port ONLY from LB's SG;
  │                   egress via NAT GW; mTLS east-west via service mesh
[ Cache (Redis) ]     private; SG from app SG only
  │
[ Database ]          isolated subnet, NO internet route; SG allows DB port ONLY from app SG;
                      encrypted at rest; reached privately (VPC endpoint / private link)
```

The controls, layer by layer:

- **Edge**: CDN caches and absorbs DDoS; **WAF** blocks common attacks (SQLi, XSS, bad bots) before they reach you; TLS terminates here.
- **Perimeter**: only the **load balancer** is internet-facing; its security group permits **443 from `0.0.0.0/0`** and nothing else. Re-encrypt inbound (or mTLS) so traffic isn't plaintext internally — zero-trust.
- **App tier**: **private subnets, no public IPs**; security group accepts traffic **only from the LB's SG** (reference by ID, not CIDR); outbound through a **NAT gateway**. Service-to-service is **mTLS via the mesh**.
- **Data tier**: **isolated subnets with no internet route at all**; DB SG allows its port **only from the app SG**; encryption in transit and at rest; reached over **private endpoints**, not the internet.
- **Cross-cutting**: least privilege everywhere, defense in depth, multi-AZ for HA, flow logs + observability, secrets in a manager, and TLS/mTLS on every hop.

The principles the interviewer wants named: **minimal public attack surface (only the LB), private-by-default, least-privilege SG-to-SG rules, defense in depth (WAF → LB → proxy → app → DB), and encryption end to end.**

### Q14. Two containers/pods can't talk to each other — how do you debug it in Kubernetes?

Decompose systematically — in K8s "can't connect" is almost always one of three layers: **network reachability, DNS, or NetworkPolicy.** Bisect them:

**1. Is it a name-resolution problem or a connectivity problem?** Try the **IP directly** vs the **service name** from inside the source pod:

```bash
kubectl exec -it src-pod -- sh
# connectivity by IP (bypasses DNS):
nc -vz <dest-pod-ip> 8080
# name resolution:
nslookup my-service            # or: dig my-service.namespace.svc.cluster.local
curl http://my-service:8080
```

- **IP works, name fails** → **cluster DNS** problem. Check CoreDNS is healthy (`kubectl get pods -n kube-system`), the service exists (`kubectl get svc`), and you're using the right FQDN (`svc.namespace.svc.cluster.local`).
- **Even the IP fails** → real network/policy issue, continue.

**2. Is the destination actually serving?** Is the Service selecting any pods?

```bash
kubectl get endpoints my-service    # empty = selector matches no ready pods
kubectl get pods -o wide            # are dest pods Running/Ready?
```

Empty endpoints (label selector mismatch or failing readiness probes) is a top cause — the service points at nothing.

**3. Is a NetworkPolicy blocking it?** By default pods allow all traffic, but once **any** NetworkPolicy selects a pod, it's default-deny for the unlisted directions:

```bash
kubectl get networkpolicy -A
```

Look for a policy that selects the destination (or source) but doesn't allow this traffic — the classic silent block. This maps to a security-group DROP in cloud terms: it shows as a **timeout**, not refused.

**4. Deeper**: CNI health (is the pod network up on that node?), cross-node routing, and `kubectl describe pod` for events.

The method mirrors Q6/Q5 but in K8s idiom: **name vs IP** (DNS vs network), **endpoints** (is anything there?), **NetworkPolicy** (is it blocked?), reasoning from refused-vs-timeout at each step.

### Q15. Walk me through debugging "connection reset" errors under load.

A **connection reset (RST)** means one side abruptly tore down an established connection — distinct from a graceful **FIN** close. Under load specifically, walk the likely causes:

- **Backend queue / backlog overflow** — the server's **accept queue (backlog)** is full, so the kernel rejects or resets new connections. Under a load spike, connections that can't be queued get reset. Check `ss -ltn` (the `Recv-Q`/`Send-Q` on the listening socket shows backlog usage) and the app's listen backlog / worker count.
- **Server hitting a limit** — max connections, worker/thread pool exhausted, file-descriptor limit (`ulimit -n`) reached — the server sheds load by resetting.
- **A middlebox / LB idle or hard timeout** — a load balancer or firewall silently drops the connection state, then the next packet on that "dead" connection gets an RST. Common with mismatched keep-alive timeouts between LB and backend.
- **App crash / restart** — a backend pod OOM-killed or redeployed mid-request resets everything it held. Correlate RSTs with deploy/restart events and OOM logs.
- **Half-open / stale connection reuse** — a pooled connection the peer already closed; sending on it earns an RST. Fix with connection health checks / shorter idle pooling.

Prove which with a capture on both ends:

```bash
tcpdump -ni any 'tcp[tcpflags] & tcp-rst != 0 and host acme.example.com'
ss -s ; ss -tan state established | wc -l    # connection counts under load
```

The senior structure: **who sent the RST and why** — server overload (backlog/limits), a middlebox timeout, an app crash, or stale pooled connections. Under load, backlog overflow and resource limits lead the list; correlate the RST timing with deploys, GC, and connection counts.

### Q16. A service works from inside the datacenter/VPC but not from the public internet (or vice versa) — how do you approach it?

This "works here, not there" split localizes fast because the *difference* between the two vantage points is the clue. Test from **both** sides and compare:

```bash
# from inside:            from outside:
curl -v https://svc       curl -v https://svc        # same command, two vantage points
dig svc                   dig svc                     # do they resolve the same?
```

Walk the likely differences:

- **DNS split-horizon** — internal DNS returns a **private IP**, external DNS returns a **public IP** (or NXDOMAIN). If it resolves internally but not externally, the public DNS record or the public LB simply doesn't exist. Compare `dig` from both sides (Q7).
- **Firewall / security group scope** — the SG/NACL allows the internal CIDR but not `0.0.0.0/0` (or vice versa). Internal traffic is permitted; external times out. This is a security-group scoping bug — shows as **timeout** from the blocked side.
- **No public path at all** — the service is in a **private subnet** with no Internet Gateway / public LB. Internal reaches it directly; external has no route in. Correct by design unless you *intended* it public — then you're missing the public LB/IGW.
- **Reverse** (works externally, not internally) — often **NAT hairpinning**: internal clients hitting the *public* IP of their own service fail because the router won't loop traffic back. Fix by using the internal name/IP internally (split-horizon DNS).
- **TLS/SNI or host-routing** differences — the LB routes by Host header; internal requests use a different name that isn't configured.

The method: **same request from both vantage points, diff the results.** Where they diverge — DNS answer, firewall reachability, or routing — is the fault. The refused-vs-timeout compass still applies at each side.

### Q17. Put it together — give me your general playbook for any networking incident.

The meta-answer that shows you have a repeatable method, not ad-hoc guessing:

**1. Reproduce and scope it.** Is it one user or everyone? One region/AZ or global? One endpoint or all? Started when (correlate with a deploy, config change, traffic spike)? Scope tells you where to look before you touch a tool.

**2. Walk the layers bottom-up and isolate the lowest broken one.** Physical/link → IP/routing → transport → DNS → TLS → application. At each: does it work here?

```bash
ping host                 # L3 reachability
mtr host                  # path + where loss/latency is
dig name                  # DNS resolves? right IP?
nc -vz host port          # transport: refused vs timeout
curl -v -w '...' url      # which phase is slow; HTTP status
openssl s_client ...      # TLS chain/expiry/name
ss -tlnp                  # is the service even listening (server-side)
tcpdump -ni any host ...  # ground truth on the wire
```

**3. Use the two compasses.** **`curl -w` timing** localizes *which phase* (DNS/connect/TLS/TTFB/transfer). **Refused vs timeout** localizes *how far you got* (reached-nothing-listening vs silently-dropped).

**4. Bisect, one variable at a time.** Client vs network vs server. Inside vs outside. IP vs name (network vs DNS). Warm vs cold connection. Each test should *rule out* a layer — reason from what the output eliminates, not what it might mean.

**5. Confirm the fix and understand the why.** Reproduce green, then explain the root cause — "blocked ICMP caused a PMTU black hole," "SG allowed internal CIDR only," "empty endpoints from a selector typo." A fix you can't explain isn't a fix.

The through-line for the whole primer: **networking debugging is layered bisection with the right tool at each layer, guided by refused-vs-timeout and phase-timing.** State that method and demonstrate it on any scenario, and you've shown you can own the network in production — which is what every question in this topic is really testing.
