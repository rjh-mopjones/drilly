---
type: interview-prep
---

# Security Interview Primer — 331 Questions

Comprehensive Q+A primer for application-security and security-engineering interviews. A System Fundamentals companion covering the broad **AppSec / security-engineering** discipline — complementing (not duplicating) the API Design primer's API-security topic and the Operating Systems primer's OS-security topic. Defensive and educational throughout: every weakness is paired with its mitigation. Covers threat modeling, cryptography, authentication & authorization, the web vulnerability classes (injection, XSS, CSRF, SSRF), the OWASP Top 10, session/token security, secure SDLC, AppSec testing (SAST/DAST/SCA), secrets & supply-chain security, network/cloud/container security, memory-safety vulnerabilities, incident response, privacy & compliance, secure-design patterns, and security scenario playbooks.

Each answer is interview-shaped: opinionated, concrete, with vulnerable-vs-fixed code pairs, ASCII diagrams (TLS handshake, OAuth flow, trust boundaries), and comparison tables (symmetric vs asymmetric, authN vs authZ, RBAC vs ABAC, SAST vs DAST, hashing vs encryption vs encoding). Warm-up ("CIA triad", "hashing vs encryption", "what is XSS") to senior ("design secure authentication", "threat-model a file-upload feature", "walk me through the TLS handshake", "secure a software supply chain", "respond to a breach").

1. [[#Security Fundamentals & Threat Modeling]]
2. [[#Cryptography Basics]]
3. [[#Applied Cryptography & Key Management]]
4. [[#Authentication]]
5. [[#Authorization & Access Control]]
6. [[#Web Security: Injection]]
7. [[#Web Security: XSS & Content Injection]]
8. [[#Web Security: CSRF, SSRF & Request Attacks]]
9. [[#OWASP Top 10]]
10. [[#Session & Token Security]]
11. [[#Secure Software Development (SSDLC)]]
12. [[#Application Security Testing]]
13. [[#Secrets Management & Supply-Chain Security]]
14. [[#Network, Transport & Cloud Security]]
15. [[#Container & Kubernetes Security]]
16. [[#Memory Safety & Low-Level Vulnerabilities]]
17. [[#Common Vulnerabilities & Exploitation Concepts]]
18. [[#Incident Response & Security Monitoring]]
19. [[#Privacy, Compliance & Governance]]
20. [[#Secure Design Patterns & Defense in Depth]]
21. [[#Security Scenario & Interview Playbooks]]

## Security Fundamentals & Threat Modeling

### Summary

**What this topic covers**

The conceptual bedrock every security engineer is expected to reason from — the vocabulary and mental habits that every later topic (crypto, authN/authZ, injection, the OWASP classes, secure SDLC) silently assumes. Three concern areas live here: (1) the **security properties** we're actually protecting — the CIA triad (confidentiality, integrity, availability) plus authenticity and non-repudiation; (2) the **design principles** that make systems resistant by construction — defense in depth, least privilege, fail secure, secure defaults, minimizing attack surface, and drawing trust boundaries; and (3) the **structured way to find problems before attackers do** — threat modeling with STRIDE, data-flow diagrams, and attack trees, driven by the risk equation `risk = likelihood × impact`. The 16 questions in this topic move from warm-up ("what is the CIA triad") to senior design work ("threat-model this feature end-to-end"). This isn't checklist security — it's learning to think adversarially about your own systems so you can defend them.

**Mental model**

Stop thinking "is this feature done?" and start thinking "how does this feature fail, and who benefits when it does?" Security is not a component you bolt on — it's a property of the whole system, and it's only as strong as the weakest path an attacker can walk. Two lenses help. First, the **attacker's economic view**: attackers are rational: they follow the cheapest path to the highest-value asset. Your job is to make every path more expensive than the reward. Second, the **trust-boundary view**: draw where data crosses from a less-trusted zone (the internet, a user's browser, a third-party API) into a more-trusted one (your app server, your database). Every crossing is where validation, authentication, and authorization must happen — bugs cluster at boundaries. Defense in depth accepts that any single control will eventually fail, so you layer independent controls; when the WAF misses the payload, the parameterized query still saves you. Least privilege and fail-secure are the same instinct applied to blast radius: grant the minimum, and when something breaks, break closed (deny) rather than open (allow).

**Key terms**

- **CIA triad** — confidentiality (only authorized parties read data), integrity (data isn't tampered with), availability (systems stay up for legitimate users).
- **Authenticity** — the data/message genuinely comes from who it claims; **non-repudiation** — the sender can't later deny having sent it (digital signatures, audit logs).
- **Defense in depth** — layered, independent controls so no single failure is fatal.
- **Least privilege** — every user, process, and service gets the minimum access needed, and no more.
- **Fail secure / fail closed** — on error, default to denying access rather than granting it.
- **Secure defaults** — the out-of-the-box configuration is the safe one; security shouldn't require opt-in.
- **Attack surface** — the sum of all points where an attacker can interact with the system (endpoints, inputs, dependencies, ports).
- **Trust boundary** — the line between zones of differing trust; where data crosses, it must be validated/authenticated.
- **Threat modeling** — structured analysis of what can go wrong with a system before/while building it.
- **STRIDE** — Spoofing, Tampering, Repudiation, Information disclosure, Denial of service, Elevation of privilege — a threat taxonomy.
- **Attack tree** — a tree with the attacker's goal at the root and paths to achieve it as branches.
- **Risk** — `likelihood × impact`; drives what you fix first.

**Why interviewers ask this**

These questions separate candidates who *memorized vulnerabilities* from candidates who can *reason about systems*. A junior lists the CIA triad and stops. A senior uses it as a lens: "for this payments feature, integrity and non-repudiation dominate; for this public content CDN, availability dominates." A junior thinks input validation is *the* fix for injection; a senior knows it's one defense-in-depth layer and the real fix is parameterized queries. The threat-modeling question is the single highest-signal design question in a security interview — it reveals whether you can take an unfamiliar feature, decompose it into data flows and trust boundaries, enumerate what can go wrong with STRIDE, and prioritize by risk. That's the day-job of a security engineer. Interviewers also probe whether you understand security is *everyone's* responsibility and belongs early in design ("shift left"), not a gate at the end.

**Common confusions**

- "Security means confidentiality/encryption" — it's equally about integrity and availability; encrypting data that then gets deleted by a ransomware worm is still a breach of availability.
- "Least privilege slows everyone down" — it shrinks blast radius; when (not if) a credential leaks, least privilege is the difference between one bucket and the whole account.
- "Fail secure = crash" — it means *deny by default* on error, not necessarily crash; a null auth check that returns "allowed" is fail-open and catastrophic.
- "We have a firewall/WAF, so we're covered" — perimeter controls are one layer; defense in depth assumes they'll be bypassed.
- "Threat modeling is a one-time document" — it's a living activity done per-feature at design time, revisited when the design changes.
- "Risk = severity" — risk is likelihood *times* impact; a critical bug that's unreachable is lower risk than a medium bug on your login page.

**What follows from this topic**

Everything. The CIA triad frames why we hash passwords (confidentiality/integrity) and rate-limit (availability). Trust boundaries frame every injection, XSS, and SSRF question — they all happen where untrusted data crosses into trusted execution. Least privilege reappears in authorization (RBAC/ABAC), cloud IAM, and container security. Threat modeling is the design-time discipline that AppSec testing (SAST/DAST) automates and validates later. If this topic feels abstract, it won't stay that way — every concrete vulnerability in the primer is an instance of a principle stated here.

### Q1. What is the CIA triad, and why is it the foundation of security?

The CIA triad is the three core properties security aims to preserve:

- **Confidentiality** — only authorized parties can read the data. Broken by data leaks, eavesdropping, weak access control. Defended with encryption, access control, least privilege.
- **Integrity** — data is accurate and hasn't been tampered with. Broken by injection, man-in-the-middle modification, unauthorized writes. Defended with hashing/HMAC, digital signatures, input validation, transactions.
- **Availability** — the system is usable by legitimate users when needed. Broken by DDoS, ransomware, resource exhaustion. Defended with redundancy, rate limiting, autoscaling, backups.

It's the foundation because every control maps to one or more of these, and every requirement is a *tradeoff* between them. The senior move is to note the triad is **contextual**: for a stock-trading engine, integrity and non-repudiation dominate; for a public news site, availability dominates; for a health record, confidentiality dominates. Two extensions matter in practice: **authenticity** (the data genuinely comes from the claimed source) and **non-repudiation** (the sender can't deny sending it) — both delivered by digital signatures and tamper-evident audit logs.

### Q2. Explain defense in depth with a concrete example.

Defense in depth means layering **independent** controls so that no single failure compromises the system. The key word is *independent* — two controls that fail for the same reason aren't two layers.

Concrete example: protecting a database of user records behind a web app.

```
Internet
  │  ← Layer 1: WAF / rate limiting (blocks obvious attacks, DDoS)
Load balancer + TLS termination
  │  ← Layer 2: authentication (who are you?)
App server
  │  ← Layer 3: authorization (are you allowed THIS record?)
  │  ← Layer 4: parameterized queries (injection can't reach the DB)
Database
  │  ← Layer 5: least-privilege DB user (read-only where possible)
  │  ← Layer 6: encryption at rest + column-level encryption for PII
Data
```

If an attacker slips a payload past the WAF (Layer 1), the parameterized query (Layer 4) still neutralizes it. If they steal a DB credential, least privilege (Layer 5) limits what it can touch, and encryption at rest (Layer 6) protects a stolen disk. The philosophy: **assume every layer will eventually be breached**, and make sure the next one still stands. The anti-pattern is a "crunchy shell, soft center" — a hard perimeter with a flat, fully-trusted interior, which is exactly what zero-trust architectures reject.

### Q3. What is the principle of least privilege and how do you apply it?

Least privilege: every user, service, process, and credential gets **exactly** the access it needs to do its job — no standing admin, no wildcard scopes, no "just in case" permissions. The reason is blast radius: credentials leak, services get compromised, insiders go rogue. Least privilege ensures the damage is bounded.

Applying it in practice:

- **Database**: the app's runtime user has `SELECT/INSERT/UPDATE` on its tables, not `DROP`, not access to other schemas. Migrations run under a separate privileged user.
- **Cloud IAM**: scope roles to specific resources and actions, prefer short-lived credentials over long-lived keys, no `*:*` policies. (See the Cloud & Infra topic.)
- **Services**: microservices authenticate to each other and are authorized only for the specific endpoints they call.
- **Time-bound / just-in-time**: elevate privilege only for the duration of a task, then drop it (sudo model, JIT access).

The senior nuance: least privilege is a *design* constraint, not a cleanup task. Retrofitting it means untangling over-broad grants nobody dares revoke. Bake it in — start from deny-all and add grants deliberately.

### Q4. What does "fail secure" mean, and why do secure defaults matter?

**Fail secure** (fail closed): when a component errors or a check can't complete, it defaults to **denying** access, not granting it. The classic anti-pattern:

```javascript
// ❌ Fail-open: any error grants access
function canAccess(user, resource) {
  try {
    return authService.check(user, resource);
  } catch (e) {
    return true; // "auth service is down, let them through" — catastrophic
  }
}

// ✅ Fail-secure: error → deny
function canAccess(user, resource) {
  try {
    return authService.check(user, resource);
  } catch (e) {
    log.error("authz check failed", e);
    return false; // deny on uncertainty
  }
}
```

**Secure defaults** is the same instinct at configuration time: the out-of-the-box state should be the safe one, so security doesn't depend on someone remembering to turn it on. A database that ships with no password, an S3 bucket that's public by default, a framework with debug mode on in prod — these are insecure defaults that cause breaches at scale precisely because most people never change defaults. Good examples of secure defaults: cookies `Secure`+`HttpOnly` by default, TLS required, deny-all firewall rules, MFA on by default. If the safe path requires opt-in, most of your fleet will be unsafe.

### Q5. What is an attack surface and how do you reduce it?

The attack surface is the complete set of points where an attacker can attempt to interact with or extract data from a system: every exposed endpoint, input field, open port, API, file upload, third-party dependency, admin interface, and human (social engineering). The bigger it is, the more ways in.

Reducing it:

- **Remove what you don't need** — disable unused endpoints, close ports, uninstall unused packages/services, delete dead feature flags. Every dependency is attack surface (see supply-chain topics).
- **Minimize exposure** — put internal services on private networks, not the public internet; gate admin panels behind VPN/zero-trust; don't expose the DB port.
- **Reduce trust granted to inputs** — validate and canonicalize at every trust boundary; the fewer places untrusted data reaches sensitive code, the smaller the surface.
- **Least functionality** — distroless/minimal container images ship fewer binaries an attacker can abuse (see Container security).

The mental model: attack surface is inventory. You can't defend what you don't know is exposed, so surface reduction starts with an accurate asset/endpoint inventory, then aggressively cuts anything not justified.

### Q6. What are trust boundaries and why do they matter for security?

A trust boundary is the line between two zones that trust each other to different degrees — for example, the browser (fully attacker-controlled) and your server, or your server and a third-party payment API, or one microservice and another. Data changes trust level when it crosses.

They matter because **bugs cluster at boundaries**. Every classic vulnerability is a failure to properly handle data crossing a boundary:

- Injection = untrusted input crosses into a SQL/shell interpreter without parameterization.
- XSS = untrusted input crosses into the browser's HTML/JS context without encoding.
- SSRF = an untrusted URL crosses into your server's outbound-request capability.
- Deserialization = untrusted bytes cross into object construction.

The practical rule: **at every trust boundary, re-authenticate, re-authorize, and validate/encode** — never assume the caller already did it. A frequent senior insight: client-side validation is UX, not security, because the client is on the *untrusted* side of the boundary; the server must re-validate everything. Threat modeling is largely the act of drawing these boundaries on a data-flow diagram and asking what could go wrong at each crossing.

### Q7. Walk me through how you'd threat-model a new feature.

Threat modeling answers four questions (Adam Shostack's framing): *What are we building? What can go wrong? What are we going to do about it? Did we do a good job?*

My process:

1. **Decompose the system** — draw a data-flow diagram: external entities (users, third parties), processes (services), data stores (DBs, caches), and data flows between them. Mark **trust boundaries** where data crosses trust levels.
2. **Enumerate threats** — walk each element/flow through **STRIDE**: could this be Spoofed? Tampered? Repudiated? Information-disclosed? Denial-of-serviced? Elevated? STRIDE is a prompt list so you don't miss a category.
3. **Rate and prioritize** — for each threat, estimate `risk = likelihood × impact`. Focus effort on high-risk items; explicitly accept or defer low ones.
4. **Decide mitigations** — for each significant threat, choose: mitigate (add a control), eliminate (remove the feature/data), transfer (insurance, third party), or accept (with sign-off).
5. **Validate** — did the design close the threats? Feed the findings into security requirements, code review, and test cases.

The senior signal is doing this **at design time** (shift left) and keeping it lightweight — a whiteboard DFD and a STRIDE pass on the risky flows, not a 40-page document nobody reads.

### Q8. Explain STRIDE and give a mitigation for each category.

STRIDE is a threat taxonomy — each letter is a threat class and maps to a violated security property, with a canonical mitigation:

| Threat | Violates | Example | Mitigation |
|---|---|---|---|
| **S**poofing | Authenticity | Attacker impersonates a user/service | Strong authentication, MFA, mutual TLS |
| **T**ampering | Integrity | Modifying data in transit or at rest | TLS, HMAC/signatures, input validation, integrity checks |
| **R**epudiation | Non-repudiation | User denies performing an action | Tamper-evident audit logs, digital signatures |
| **I**nformation disclosure | Confidentiality | Leaking PII, error stack traces | Encryption, access control, least privilege, generic errors |
| **D**enial of service | Availability | Flooding, resource exhaustion | Rate limiting, quotas, autoscaling, timeouts |
| **E**levation of privilege | Authorization | User gains admin rights | Least privilege, robust authZ checks, sandboxing |

The value of STRIDE is completeness: given a component, you systematically ask all six questions rather than only imagining the attacks you already know. Note each maps cleanly to CIA-plus (spoofing→authenticity, repudiation→non-repudiation), which is why the fundamentals and threat modeling are the same muscle.

### Q9. How do you prioritize which vulnerabilities to fix first?

By **risk = likelihood × impact**, not by raw severity or by whatever's loudest in the scanner.

- **Impact** — what's the blast radius if exploited? Data sensitivity (PII, credentials, payment data), number of records, whether it enables further compromise (a foothold for lateral movement).
- **Likelihood** — how reachable and how easy? Is it internet-facing or behind auth? Does exploitation need a rare precondition? Is there a public exploit? Is it being actively exploited in the wild (KEV)?

Practical layering on top of the base equation:

- **CVSS** gives a standardized 0–10 base score, but it's a starting point, not a verdict — a CVSS 9.8 on an internal service no one can reach is lower *real* risk than a CVSS 6 on your public login.
- **Exploitability context** — CISA KEV (known-exploited) and EPSS (exploit-prediction) sharpen likelihood.
- **Compensating controls** — if a WAF rule or network segmentation already blocks the path, real risk drops.

Concretely: a broken-access-control bug letting any user read any other user's records (IDOR) on a public endpoint beats a theoretical timing side-channel every time. Communicate priority in business terms — "this exposes all customer PII" — not just a CVE number.

### Q10. What is an attack tree and when would you use one?

An attack tree is a hierarchical diagram with the **attacker's goal at the root** and the ways to achieve it as branches, refined down to concrete leaf actions. AND/OR nodes express whether a parent requires all children or just one.

```
Goal: Read another user's private messages
├── OR: Compromise their account
│    ├── OR: Phish credentials
│    ├── OR: Credential stuffing (reused password)
│    └── OR: Session hijack (steal cookie via XSS)
├── OR: Exploit broken access control (IDOR on /messages/:id)
└── OR: Compromise the database
     ├── AND: SQL injection reachable
     └── AND: DB user can read messages table
```

You use it to reason about a *specific high-value asset or goal* from the attacker's perspective — complementary to STRIDE, which sweeps the whole system for threat categories. Attack trees are great for prioritization (which branch is cheapest for the attacker?), for red-team planning, and for finding the branch you forgot to defend. The insight they surface: an attacker only needs *one* OR-path to succeed, so your defenses must hold on *every* branch — which is exactly why defense in depth and closing the weakest path matter.

### Q11. Why is client-side validation not a security control?

Because the client sits on the **untrusted side** of the trust boundary. Anything running in the user's browser or app — JavaScript validation, disabled buttons, hidden fields, min/max attributes — is fully under the attacker's control. They can bypass your UI entirely and send crafted requests directly with `curl`, a proxy like Burp, or the browser console.

```javascript
// Client-side check — UX only, trivially bypassed
if (amount < 0) { showError("no negative amounts"); return; }

// Attacker just sends the raw request:
// POST /transfer  {"amount": -1000000}
```

Client-side validation is valuable for **user experience** — fast feedback, fewer round trips — but it is **not** a security boundary. The rule: **validate on the server, always, for every request**, treating the client as hostile. This generalizes: authorization, rate limits, price calculations, and business rules must all be enforced server-side. Trusting client-supplied data (a hidden `price` field, an `isAdmin` flag, a `userId` you don't verify against the session) is the root cause of countless real breaches, including mass-assignment and IDOR bugs.

### Q12. Why is "security is everyone's job" and "shift left" more than a slogan?

Because the cost and effectiveness of security are dominated by *when* you address it. A threat caught in design is a whiteboard conversation; the same flaw caught in production is an incident, a breach notification, and a costly retrofit. Studies consistently show fixing a defect late costs an order of magnitude more than fixing it early — "shift left" means moving security activities (threat modeling, secure design, code review, automated scanning) as early in the SDLC as possible.

"Everyone's job" follows from the fact that security is a whole-system property: a perfect crypto library doesn't help if a developer logs the plaintext password, a secure framework doesn't help if ops ships an S3 bucket public, and the best WAF doesn't help against a phished employee. Security engineers can't manually inspect every line — so the model is to **build guardrails**: secure defaults, paved-road frameworks, automated CI gates (SAST/SCA/secret-scanning), and a culture of security champions embedded in teams. The security team's leverage is enabling everyone else to do the secure thing by default, not being the sole gatekeeper.

### Q13. How does thinking like an attacker help you defend a system?

Defenders naturally reason about the *happy path* — how the feature is supposed to work. Attackers reason about the *unhappy paths* — every way the feature can be abused. To defend well, you have to deliberately adopt the adversarial lens: for each feature, ask "if I wanted to abuse this, what would I do?"

Examples of the shift:

- A password-reset flow: the defender sees "user gets an email." The attacker sees "can I enumerate valid emails from the response? Can I brute-force the token? Does the old session survive the reset? Can I trigger resets for other people?"
- A file upload: the defender sees "user uploads an avatar." The attacker sees "can I upload a web shell? A polyglot file? A 10GB zip bomb? A path-traversal filename?"

This is **not** about acquiring offensive tooling to attack others — it's about applying adversarial imagination to your *own* systems so you close gaps before real attackers find them. The discipline that makes it systematic is threat modeling (STRIDE forces you through spoofing/tampering/etc.), abuse-case analysis (write the negative user stories), and, with authorization, penetration testing and red-teaming to validate the defenses hold.

### Q14. What's the difference between a vulnerability, a threat, and a risk?

These are distinct and frequently conflated:

- **Vulnerability** — a weakness in the system (an unpatched library, a missing authorization check, a weak password policy). It's a property of *your* system.
- **Threat** — a potential event or actor that could exploit a vulnerability (a cybercriminal, a malicious insider, an automated bot, even a flood or hardware failure). It's external.
- **Risk** — the *combination*: the likelihood a threat exploits a vulnerability, times the impact if it does. `Risk = likelihood × impact`.

A vulnerability with no credible threat, or with negligible impact, is low risk. A threat with no matching vulnerability can't hurt you. Risk is what you actually manage, and you manage it by four levers: **reduce likelihood** (patch the vuln, add controls), **reduce impact** (least privilege, encryption, segmentation), **transfer** (insurance, outsourcing), or **accept** (with documented sign-off). The reason precise language matters: it forces the conversation onto risk — the thing the business can prioritize — rather than an undifferentiated pile of scanner findings.

### Q15. What is a "confused deputy" and how does it relate to security design?

A confused deputy is a program with legitimate elevated privileges that is tricked by a less-privileged party into misusing those privileges on the attacker's behalf. The deputy isn't malicious — it's *confused* about who it's really acting for.

Classic web instances:

- **SSRF** — your server (the deputy) has network access to internal services; an attacker supplies a URL and the server dutifully fetches an internal metadata endpoint for them.
- **CSRF** — the user's browser (the deputy) holds their session cookie; an attacker's page tricks it into sending an authenticated request the user never intended.
- **Cloud IAM** — a service with a powerful role executes attacker-influenced actions.

The design lesson: **privilege must be tied to the actual requester's authority, not the deputy's ambient authority**. Fixes follow that principle — SSRF: strict outbound allowlists so the deputy can't be aimed at internal targets; CSRF: anti-CSRF tokens / `SameSite` cookies so the request must prove intent, not just carry a cookie; capability-based designs that pass an explicit, scoped token instead of relying on ambient authority. It's a recurring pattern worth naming because once you see it, SSRF, CSRF, and many privilege-escalation bugs are the same shape.

### Q16. Design the security controls for a public-facing file-upload feature. Threat-model it.

I'll threat-model first, then map controls.

**Data flow / trust boundary**: untrusted user → HTTPS → app server → storage → later served back to users. Two boundary crossings dominate: (1) untrusted bytes entering our storage, (2) those bytes being served back to other users' browsers.

**STRIDE-driven threats and mitigations:**

- **Tampering / Elevation (malicious content)** — user uploads a web shell, executable, or polyglot. *Mitigations*: validate content by magic bytes not just extension, store outside the web root, store with a randomized non-executable name, never let the storage directory execute code, serve from a separate sandboxed domain.
- **Information disclosure via XSS** — an uploaded SVG/HTML runs script when viewed. *Mitigations*: serve user content from a cookieless sandbox domain, force `Content-Disposition: attachment` / correct `Content-Type` with `X-Content-Type-Options: nosniff`, strip active content from SVGs, apply CSP. (See the XSS topic.)
- **DoS (availability)** — zip bombs, huge files, many files. *Mitigations*: enforce size limits (at the proxy and app), file-count/rate limits per user, scan-time timeouts, decompression bounds.
- **Injection via filename / path traversal** — `../../etc/passwd` filenames. *Mitigations*: never trust the client filename; generate your own, canonicalize and reject traversal sequences.
- **Malware distribution** — the file is clean to us but malicious to downloaders. *Mitigation*: antivirus/content scanning before the file is retrievable.
- **Spoofing / authZ** — one user reads another's files (IDOR). *Mitigations*: authorize every download against the session, use unguessable IDs, don't rely on obscurity.

**Cross-cutting**: authenticate uploads, log securely (no file contents/PII in logs), encrypt at rest, and rate-limit. The senior framing: the two riskiest moments are *ingestion* (what did we just store?) and *serving* (whose browser will run this?), and the sandbox-domain + content-disposition combo is the highest-leverage control for the second.

## Cryptography Basics

### Summary

**What this topic covers**

The cryptographic primitives every engineer must be able to reason about — not to implement (you should never roll your own), but to *use correctly* and to explain in an interview. Three concern areas: (1) the **two families of encryption** — symmetric (AES, one shared key, fast) vs asymmetric (RSA/ECC, key pairs, slow but solves key distribution) and when each is used; (2) the **three things people constantly confuse** — hashing vs encryption vs encoding, which do completely different jobs; and (3) the **protocols that combine primitives** into real-world security — digital signatures, Diffie-Hellman key exchange, HMAC, certificates/PKI, and the TLS handshake that ties them all together to give you the padlock in the browser. The 16 questions here range from "what's the difference between hashing and encryption" to "walk me through the entire TLS handshake." The throughline is a single rule that will keep you safe: **use well-vetted primitives in well-vetted constructions, correctly — don't invent crypto.**

**Mental model**

Cryptography gives you a small toolbox, and every tool provides a *specific* property — the skill is matching tool to goal, not memorizing algorithms. Want confidentiality (secrecy)? Encryption. Want integrity + authenticity of a message with a shared secret? HMAC. Want integrity + authenticity + non-repudiation with public verifiability? Digital signatures. Want a fixed-size fingerprint that's one-way? A hash. The genius of modern TLS is *composition*: asymmetric crypto is slow but solves the "how do two strangers agree on a key over a wire an attacker is watching" problem (via key exchange and certificates); symmetric crypto is fast but needs a shared key. So TLS uses asymmetric crypto **once** at the start to authenticate the server and agree on a fresh symmetric key, then switches to fast symmetric encryption (AES-GCM) for the actual data. Every property has a matching failure mode when misused — a great mode (GCM) with a reused nonce leaks everything; a great cipher (AES) in ECB mode reveals patterns. Correctness is in the *construction*, not just the algorithm.

**Key terms**

- **Symmetric encryption** — one shared secret key encrypts and decrypts (AES). Fast; key distribution is the hard part.
- **Asymmetric / public-key** — a keypair: public key encrypts / verifies, private key decrypts / signs (RSA, ECC). Slow; solves key distribution.
- **Block vs stream cipher** — block ciphers (AES) encrypt fixed-size blocks and need a *mode*; stream ciphers (ChaCha20) produce a keystream.
- **Mode of operation** — how a block cipher processes multi-block data: **GCM** (authenticated, preferred), **CBC** (needs separate MAC), **ECB** (broken — never use).
- **IV / nonce** — a per-message unique value that keeps identical plaintexts from producing identical ciphertexts; must be unique (GCM) and sometimes random.
- **Hashing** — one-way fixed-size fingerprint (SHA-256); no key, not reversible.
- **HMAC** — keyed hash proving integrity + authenticity to someone with the shared key.
- **Digital signature** — sign with a private key, anyone verifies with the public key; gives integrity + authenticity + non-repudiation.
- **Diffie-Hellman** — a key-exchange protocol letting two parties derive a shared secret over a public channel.
- **Certificate / PKI** — a CA-signed binding of a public key to an identity; the chain of trust up to a root CA.
- **Forward secrecy** — compromising the long-term key later doesn't decrypt past sessions (ephemeral DH).
- **Encoding** — a *reversible*, keyless representation change (Base64, URL-encoding); **not** security.

**Why interviewers ask this**

Cryptography is where sloppy thinking gets exposed fastest. The hashing-vs-encryption-vs-encoding question is a near-universal filter: a junior says "hashing is encryption you can't reverse" (wrong framing) or calls Base64 "encryption" (dangerous); a senior crisply states each has a *different purpose* — hashing for fingerprints/passwords, encryption for confidentiality, encoding for data representation. The TLS-handshake question separates people who've operated real systems from people who've only read about them — can you explain how two strangers establish an encrypted, authenticated channel, and why it uses *both* asymmetric and symmetric crypto? Interviewers also probe judgment: do you know to reach for a library and a standard construction rather than writing your own? "Don't roll your own crypto" isn't gatekeeping — it's that subtle implementation bugs (timing, padding, nonce handling) break otherwise-perfect algorithms.

**Common confusions**

- "Hashing is a kind of encryption" — no; encryption is reversible with a key, hashing is one-way with no key. Different goals.
- "Base64 encrypts the data" — Base64 is *encoding*, fully reversible by anyone; it provides zero confidentiality.
- "Asymmetric crypto replaced symmetric" — no; asymmetric is slow and used to *bootstrap* a symmetric key, which does the bulk work.
- "The IV/nonce is secret" — it isn't; it's sent in the clear. Its job is *uniqueness*, not secrecy — and reusing it is catastrophic.
- "A longer key always means more secure" — key length matters within an algorithm, but a strong 256-bit key in ECB mode is still broken; construction beats key size.
- "TLS encrypts, so the server is trusted" — TLS gives an encrypted channel to *whoever holds the cert*; identity assurance comes from the *certificate validation*, not the encryption.

**What follows from this topic**

This topic is the primitive layer; Applied Crypto & Key Management builds the operational layer on top — how to hash passwords (a *deliberately slow* hash, not SHA-256), how to manage keys at scale (envelope encryption, KMS/HSM, rotation), and the mistakes that break correct primitives (ECB, nonce reuse, hardcoded keys, weak randomness). Digital signatures reappear in supply-chain security (artifact signing, Sigstore) and JWTs (alg confusion). TLS/PKI reappears in network security (mTLS, HSTS, cert pinning). Get the primitives and their *purposes* straight here, and the applied topics become "apply the right tool operationally" rather than "learn crypto from scratch."

### Q1. What's the difference between symmetric and asymmetric encryption?

| | Symmetric | Asymmetric (public-key) |
|---|---|---|
| Keys | One shared secret | Key pair: public + private |
| Speed | Fast (hardware AES) | Slow (100–1000×) |
| Algorithms | AES, ChaCha20 | RSA, ECC (ECDH/ECDSA) |
| Key distribution | Hard — must share secret securely | Easy — publish the public key |
| Typical use | Bulk data encryption | Key exchange, signatures, small payloads |

**Symmetric** uses the same key to encrypt and decrypt. It's fast and ideal for bulk data, but has a chicken-and-egg problem: how do two parties agree on the secret key without an eavesdropper capturing it?

**Asymmetric** solves that. Data encrypted with the public key can only be decrypted with the matching private key (and vice versa for signatures). You can publish your public key freely. The cost is speed — it's far too slow for bulk data.

The real-world answer is **you use both**: asymmetric crypto (or Diffie-Hellman) to *establish* a shared symmetric key over an untrusted channel, then symmetric crypto (AES-GCM) for the actual data. That hybrid is exactly what TLS does. So the interview-correct statement is not "which is better" but "they solve different problems and are composed together."

### Q2. Explain the difference between hashing, encryption, and encoding.

These are constantly confused and do completely different jobs:

| | Purpose | Reversible? | Key? | Example |
|---|---|---|---|---|
| **Encoding** | Represent data in another format | Yes, by anyone | No | Base64, URL-encoding, ASCII |
| **Encryption** | Confidentiality | Yes, with the key | Yes | AES, RSA |
| **Hashing** | Fixed-size one-way fingerprint | No | No (or keyed for HMAC) | SHA-256, bcrypt |

- **Encoding** transforms data for safe transport/storage (e.g. Base64 to put binary in JSON). It is **fully reversible by anyone** — it provides *zero* security. Calling Base64 "encryption" is a red-flag mistake.
- **Encryption** protects **confidentiality**: only someone with the key can recover the plaintext. Reversible *by design*, but only with the key.
- **Hashing** produces a fixed-size digest that's **one-way** — you can't recover the input. Used for integrity checks, deduplication, and (with a slow, salted variant) password storage. Good hashes are collision-resistant and avalanche (tiny input change → totally different output).

Rule of thumb: encode for *format*, encrypt for *secrecy*, hash for *fingerprint/integrity*. If someone says "we encoded the passwords," that's a breach waiting to happen.

### Q3. What properties make a cryptographic hash function secure, and where is SHA-256 the wrong choice?

A secure cryptographic hash has:

- **Deterministic** — same input always gives the same digest.
- **One-way (preimage resistance)** — infeasible to find an input producing a given hash.
- **Second-preimage resistance** — given an input, infeasible to find a different input with the same hash.
- **Collision resistance** — infeasible to find *any* two inputs with the same hash. (MD5 and SHA-1 are broken here — don't use them.)
- **Avalanche effect** — flipping one input bit changes ~half the output bits.
- **Fast** to compute.

That last property — *fast* — is exactly why SHA-256 is the **wrong** choice for passwords. Its speed lets an attacker who steals your hash database try billions of guesses per second on a GPU. For passwords you want a *deliberately slow*, salted, memory-hard function: **bcrypt, scrypt, or Argon2** (covered in the Applied Crypto topic). SHA-256 is right for file integrity, HMAC, digital signatures, content addressing, and blockchain — anywhere you want a fast fingerprint of data you're not trying to make expensive to brute-force. The mistake to avoid in interviews: never say "we hash passwords with SHA-256 and a salt" as if that's sufficient — it isn't, because it's too fast.

### Q4. What is a block cipher mode of operation, and why is ECB dangerous?

A block cipher like AES only encrypts one fixed-size block (128 bits) at a time. A **mode of operation** defines how you chain blocks to encrypt a message of arbitrary length. The mode matters as much as the cipher.

**ECB (Electronic Codebook)** encrypts each block independently with the same key. The fatal flaw: **identical plaintext blocks produce identical ciphertext blocks**, so structure in the data leaks straight through. The famous demonstration is the "ECB penguin" — encrypting a bitmap in ECB leaves the image outline clearly visible, because repeated pixels map to repeated ciphertext. ECB never provides semantic security. Never use it.

Better modes:

- **GCM (Galois/Counter Mode)** — the modern default. It's an **AEAD** mode: it provides confidentiality *and* built-in authentication (a tag that detects tampering). Needs a unique nonce per message.
- **CBC (Cipher Block Chaining)** — each block is XORed with the previous ciphertext, so patterns don't leak; needs a random IV and, crucially, a **separate MAC** (encrypt-then-MAC), or it's vulnerable to padding-oracle attacks.

The takeaway: prefer an **authenticated** mode (AES-GCM or ChaCha20-Poly1305) so you get integrity for free, and never hand-roll encrypt-then-MAC when a library gives you AEAD.

### Q5. What is an IV/nonce, is it secret, and what happens if you reuse one?

An **IV (initialization vector) / nonce (number used once)** is a per-message value fed into the cipher so that encrypting the *same plaintext* twice yields *different ciphertext*. Without it, patterns leak (that's the ECB problem generalized).

Key facts:

- **It is not secret.** The IV/nonce is transmitted alongside the ciphertext in the clear. Its security job is **uniqueness** (and for CBC, unpredictability/randomness), not secrecy.
- **Reusing a nonce is catastrophic**, especially in stream-cipher-like and counter modes (GCM, CTR). If two messages are encrypted with the same key+nonce, XORing the two ciphertexts cancels the keystream and leaks the XOR of the plaintexts — and for GCM, nonce reuse can also let an attacker forge the authentication tag, destroying integrity entirely.

```
GCM with reused (key, nonce):
  C1 = P1 ⊕ keystream
  C2 = P2 ⊕ keystream
  C1 ⊕ C2 = P1 ⊕ P2   ← plaintext relationship leaks; tag forgery becomes possible
```

Practical guidance: let a vetted library manage nonces; use a random 96-bit nonce for GCM (or a counter you can *guarantee* never repeats under a given key), and rotate the key well before you approach nonce-space exhaustion. This is one of the most common real-world crypto failures — revisited in the Applied Crypto "common mistakes" question.

### Q6. What is a digital signature and what does it guarantee?

A digital signature uses **asymmetric** crypto in reverse of encryption: the signer hashes the message and encrypts (signs) that hash with their **private** key; anyone can verify by decrypting the signature with the signer's **public** key and comparing it to their own hash of the message.

```
Sign:   signature = Enc(privateKey, Hash(message))
Verify: Hash(message) == Dec(publicKey, signature)  ?
```

It guarantees three properties:

- **Integrity** — if the message changed, the hash won't match; tampering is detected.
- **Authenticity** — only the holder of the private key could have produced a signature that verifies with the public key.
- **Non-repudiation** — because only the signer holds the private key, they can't later deny signing (unlike HMAC, where either party with the shared key could have created it).

Signatures underpin TLS certificates (a CA signs your cert), code/artifact signing (Sigstore, package signing — see supply-chain security), JWTs (the server signs the token), and software updates. Contrast with **HMAC**: both prove integrity+authenticity, but HMAC uses a *shared* secret (so no non-repudiation and no public verifiability), while signatures use a *keypair* (public verifiability + non-repudiation). Choose HMAC when the two parties already share a secret and speed matters; choose signatures when verifiers are many/untrusted or you need non-repudiation.

### Q7. Explain how Diffie-Hellman lets two parties agree on a key over an open channel.

Diffie-Hellman (DH) solves the seemingly impossible: two strangers derive a **shared secret** while an eavesdropper watches every message, yet the eavesdropper can't compute the secret.

The intuition (colors analogy): both agree on a public base color, each mixes in a private secret color, they exchange the mixtures publicly, then each mixes their own private color into the received mixture. Both end up with the same final color, but an eavesdropper who saw only the public base and the two mixtures can't separate out a private color (un-mixing is hard).

Mathematically it rests on the **discrete-log problem**: given a public base `g` and modulus `p`, each side picks a private exponent (`a`, `b`), sends `g^a mod p` and `g^b mod p`, and both compute `g^(ab) mod p` as the shared secret. Recovering `a` from `g^a mod p` is computationally infeasible for large parameters. Elliptic-curve DH (ECDH) does the same over elliptic curves with much smaller keys.

Two critical points: (1) plain DH gives you a shared key but **no authentication** — it's vulnerable to a man-in-the-middle who does DH with each side separately; TLS fixes this by having the server **sign** its DH parameters with its certificate. (2) Using **ephemeral** DH (a fresh keypair per session, ECDHE) gives **forward secrecy** — see the next question.

### Q8. What is forward secrecy and why does it matter?

Forward secrecy (also "perfect forward secrecy," PFS) means that compromising a server's long-term private key **in the future** does **not** let an attacker decrypt **past** recorded sessions. Each session's encryption key was derived from *ephemeral* keys that were thrown away after the session.

Why it matters: without forward secrecy, an attacker can passively record all your encrypted traffic today, then — months or years later — steal or compel the server's private key and retroactively decrypt everything. This "harvest now, decrypt later" threat is real for long-lived secrets and is a driver for post-quantum planning.

How it's achieved: use **ephemeral Diffie-Hellman** (ECDHE) for key exchange. The server's long-term certificate key is used only to *authenticate* (sign) the exchange, not to derive the session key. The actual session key comes from per-session ephemeral DH keypairs that are discarded afterward, so there's nothing persistent left to steal that would unlock past sessions. This is why modern TLS 1.3 **mandates** forward-secret key exchange (ECDHE) and removed old RSA key-transport, where the session key *was* protected directly by the long-term key and thus had no forward secrecy.

### Q9. What is HMAC and how does it differ from just hashing data?

HMAC (Hash-based Message Authentication Code) is a **keyed** hash that proves a message's **integrity and authenticity** to anyone holding the shared secret key. It combines a hash function (e.g. SHA-256) with a secret key in a specific nested construction:

```
HMAC(K, m) = H( (K ⊕ opad) || H( (K ⊕ ipad) || m ) )
```

The difference from a plain hash: a bare `H(message)` proves nothing about *who* produced it — an attacker who modifies the message can simply recompute the hash. HMAC requires the secret key to produce a valid tag, so a recipient who shares the key can verify both that the message wasn't tampered with *and* that it came from someone with the key.

A subtle but important point: you can't safely build a MAC by naively prepending the key to a message and hashing (`H(K || m)`) with older Merkle-Damgård hashes — that's vulnerable to **length-extension attacks**. HMAC's nested structure specifically defends against that, which is exactly why you use the standard HMAC construction from a library rather than inventing your own keyed hash (a concrete instance of "don't roll your own crypto"). Also: always compare MACs with a **constant-time** comparison to avoid timing side channels. HMAC vs digital signature: HMAC is symmetric (shared key, fast, no non-repudiation); signatures are asymmetric (public verification, non-repudiation).

### Q10. Walk me through the TLS handshake end to end.

TLS establishes an **encrypted, authenticated** channel between client and server. Here's the TLS 1.3 handshake (the modern one — faster, forward-secret by default):

```
Client                                              Server
  │  ClientHello                                        │
  │  - supported TLS versions, cipher suites            │
  │  - client's ephemeral ECDHE public key (key_share)  │
  │  - random nonce                                     │
  │ ──────────────────────────────────────────────────>│
  │                                    ServerHello       │
  │  - chosen cipher suite                              │
  │  - server's ephemeral ECDHE public key              │
  │  - random nonce                                     │
  │  {Certificate}          (encrypted from here)       │
  │  {CertificateVerify} = sign(handshake, privKey)     │
  │  {Finished} = MAC over handshake                    │
  │ <──────────────────────────────────────────────────│
  │  (both derive the same session keys via ECDHE)      │
  │  {Finished}                                         │
  │ ──────────────────────────────────────────────────>│
  │  === encrypted application data (AES-GCM) ===       │
```

Step by step:

1. **ClientHello** — client offers TLS versions and cipher suites, sends a random nonce and its **ephemeral** ECDHE public key.
2. **ServerHello** — server picks a cipher suite, sends its own random nonce and ephemeral ECDHE public key. Both sides now compute the **shared secret** via ECDHE and derive symmetric session keys. (Forward secrecy comes from these ephemeral keys.)
3. **Authentication** — the server sends its **certificate** (public key + identity, signed by a CA) and a **CertificateVerify**: a signature over the handshake transcript using its long-term private key. This proves the server actually owns the certificate's private key — defeating a man-in-the-middle.
4. **Certificate validation (client side)** — client checks the cert chains to a trusted root CA, isn't expired/revoked, and matches the hostname (SNI). This is where *identity* assurance comes from, not the encryption.
5. **Finished** — both sides send a MAC over the whole handshake so any tampering with earlier messages is detected.
6. **Application data** — everything now flows encrypted with fast symmetric AES-GCM (or ChaCha20-Poly1305).

The elegant part: asymmetric crypto (ECDHE + the cert signature) is used *once* to authenticate the server and agree on a key with forward secrecy, then symmetric crypto does the bulk work. TLS 1.3 does this in **one round trip** (1-RTT); TLS 1.2 needed two.

### Q11. What is a certificate and how does PKI establish a chain of trust?

A **certificate** (X.509) is a signed document binding a **public key** to an **identity** (a domain name like `example.com`), plus metadata (validity dates, issuer, allowed uses). The binding is trustworthy because a **Certificate Authority (CA)** has digitally *signed* it, vouching that they verified the requester controls that identity.

**PKI (Public Key Infrastructure)** is the system of CAs, certificates, and trust that makes this scale. Trust is established through a **chain**:

```
Root CA (self-signed, in the OS/browser trust store)
   │  signs
Intermediate CA
   │  signs
example.com's certificate (leaf)
```

Your browser ships with a list of trusted **root CAs**. When it receives `example.com`'s leaf certificate, it verifies the leaf was signed by an intermediate, the intermediate by a root, and that root is in its trust store — a **chain of trust** anchored at a root it already trusts. Each link is verified by checking the signature with the issuer's public key.

Validation also checks: the cert isn't **expired**, it hasn't been **revoked** (CRL / OCSP / OCSP stapling), and the **hostname matches** (SNI/SAN). The whole model's weakness is CA compromise or mis-issuance — if any trusted CA is tricked into issuing a cert for your domain, the padlock lies. Mitigations include **Certificate Transparency** logs (public append-only logs of issued certs so you can detect rogue issuance) and, historically, cert pinning. Let's Encrypt automated this whole flow and drove HTTPS to near-ubiquity.

### Q12. Why should you "never roll your own crypto"?

Because the algorithms are the *easy* part — the **implementation and construction** are where security is won or lost, and both are full of non-obvious traps that have taken the field decades to discover and standardize away:

- **Timing side channels** — a naive string comparison of MACs/tokens leaks secrets by how long it takes; you need constant-time comparison.
- **Padding oracles** — CBC without proper authentication leaks plaintext via error messages (Lucky 13, POODLE).
- **Nonce/IV mishandling** — reuse breaks GCM entirely (see the nonce question).
- **Weak randomness** — using a non-cryptographic RNG for keys/IVs makes them predictable.
- **Length-extension** — naive keyed hashing is forgeable; that's why HMAC exists.
- **Insecure defaults** — choosing ECB, a broken curve, or a deprecated hash.

Even world-class cryptographers have shipped subtly broken implementations; a general engineer under deadline has no chance. The correct move is to **use a vetted, high-level library** (libsodium/NaCl, the platform's TLS stack, a maintained AEAD API) that exposes misuse-resistant interfaces and makes the safe path the default. The rule isn't "crypto is forbidden" — it's "use standard primitives, in standard constructions, through audited libraries, and let experts handle the sharp edges." Rolling your own protocol (not just algorithm) is equally dangerous — key exchange, session handling, and authentication composition are where real systems break.

### Q13. If someone says "we Base64-encoded the API keys before storing them," what's wrong?

Everything about the *intent*. Base64 is **encoding**, not encryption — it's a fully reversible, keyless transformation that anyone can undo in one command (`base64 -d`). It provides **zero** confidentiality. Storing secrets Base64-encoded is functionally the same as storing them in plaintext, with a thin coat of obfuscation that fools no one.

```javascript
// This is NOT protection:
const stored = Buffer.from(apiKey).toString('base64'); // reversible by anyone
```

What they *should* do depends on the secret's nature:

- **API keys / tokens the app must use later** — these need to be recovered, so **encrypt** them (AES-GCM) with a key managed by a **KMS/secrets manager** (Vault, cloud KMS), ideally via **envelope encryption**. Better yet, store them *in* the secrets manager, not your DB.
- **User passwords** — never recoverable; **hash** them with a slow, salted algorithm (Argon2/bcrypt), never encode or encrypt.

The confusion here is exactly the hashing-vs-encryption-vs-encoding trap: Base64 solves a *transport/representation* problem (safely putting bytes in text), never a *security* problem. Spotting this claim in a design review is a quick tell about a team's crypto literacy — and it's a real, common source of leaked credentials.

### Q14. When would you use symmetric vs asymmetric encryption in a real system?

You almost always use **both**, each for what it's good at:

**Reach for symmetric (AES-GCM) when:**

- Encrypting **bulk data** — files, database columns, disk volumes, message payloads. It's orders of magnitude faster and hardware-accelerated.
- Both parties already share (or can derive) a key — e.g. after a TLS handshake, or a service encrypting its own data at rest.

**Reach for asymmetric (RSA/ECC) when:**

- **Establishing a shared key** with someone you don't already share a secret with (key exchange / TLS bootstrapping).
- **Digital signatures** — code signing, certificates, JWTs, verifying software updates, where verifiers are many and untrusted.
- Encrypting a **small** payload for a specific public-key holder (e.g. a symmetric key, or a short message).

The canonical pattern is **hybrid encryption / envelope encryption**: generate a random symmetric **data key**, encrypt the actual data with it (fast), then encrypt *that data key* with the recipient's public key or a KMS master key (slow but small). TLS, PGP, and cloud KMS all work this way. So the interview-correct answer isn't "asymmetric is more secure" — it's "asymmetric solves key distribution and identity; symmetric does the heavy lifting; compose them." This directly sets up the envelope-encryption question in the Applied Crypto topic.

### Q15. What is a man-in-the-middle attack and how does TLS prevent it?

A **man-in-the-middle (MITM)** attacker sits between two parties, relaying (and possibly modifying) messages while each side believes it's talking directly to the other. Against unauthenticated key exchange, MITM is devastating: the attacker does a separate key exchange with each side, decrypting, reading, and re-encrypting everything in the middle — both sides see a "secure" connection to the attacker.

Encryption alone doesn't stop this: plain Diffie-Hellman gives you a private channel but you don't know *who's on the other end*. The missing ingredient is **authentication**.

TLS prevents MITM primarily through **certificate authentication**:

- The server proves its identity with a **certificate** signed by a trusted CA, and a **CertificateVerify** signature proving it holds the cert's private key. An attacker can't forge a valid cert for `example.com` because they can't get a CA to sign one (and can't produce the private key).
- The client **validates** the chain to a trusted root, checks expiry/revocation, and — critically — checks the **hostname** matches. A cert for `attacker.com` presented for `example.com` fails validation.
- The **Finished** MAC over the handshake transcript ensures no message was tampered with mid-handshake.

Residual risks and defenses: a **compromised or coerced CA** could mis-issue a cert (mitigated by Certificate Transparency and, historically, cert pinning); **users clicking through cert warnings** defeats the model (mitigated by HSTS, which forbids the bypass); and stripping TLS to plain HTTP (mitigated by HSTS + redirect). This is why "TLS is on" and "the identity is verified" are distinct claims — the encryption is worthless without the certificate validation that authenticates the peer.

### Q16. What's the difference between encryption at rest and in transit, and do you need both?

They protect data in two different states against two different threats:

- **In transit** — data moving over a network (client↔server, service↔service). Threat: eavesdropping and tampering on the wire (MITM, sniffing). Defense: **TLS** (and mTLS between services). Protects the data while it's *flowing*.
- **At rest** — data sitting in storage (disks, databases, backups, object storage). Threat: someone who obtains the storage — a stolen disk, a leaked backup, an over-permissive bucket, a compromised DB host. Defense: **disk/volume encryption, database/column encryption**, encrypted backups, with keys held in a KMS.

You need **both**, because they cover disjoint threats and neither substitutes for the other. TLS does nothing for a stolen backup tape; disk encryption does nothing for traffic sniffed on the network. Together with a third state — **data in use** (in memory), addressed by newer confidential-computing/enclave tech — they form the standard "protect data in all states" model.

Two senior caveats: (1) at-rest encryption at the *disk* level only protects against physical theft — if an attacker has valid DB access, the data is decrypted for them transparently, so at-rest encryption is not a substitute for access control. (2) The hard part of both is **key management** — where the keys live, who can use them, and how they rotate — which is the subject of the Applied Crypto & Key Management topic.

## Applied Cryptography & Key Management

### Summary

**What this topic covers**

The operational half of cryptography — using the primitives from Cryptography Basics correctly at scale in real systems. Three concern areas: (1) **password storage done right** — why you never use a fast hash like SHA-256/MD5, and how bcrypt/scrypt/Argon2 with salt (and optionally pepper) and a tuned work factor defend against offline cracking; (2) **managing keys at scale** — envelope encryption (DEK/KEK), KMS and HSM, key rotation, and the at-rest vs in-transit split from an operational lens; and (3) **the mistakes that break otherwise-correct crypto** — ECB mode, nonce/IV reuse, hardcoded keys, and weak (non-CSPRNG) randomness — each paired with its fix. The 16 questions here are the ones that decide whether a system that *uses* good algorithms is actually secure, because in practice crypto rarely fails because AES was broken — it fails because a key was hardcoded in the repo, a nonce was reused, or passwords were SHA-256'd. This is where cryptographic *knowledge* becomes cryptographic *engineering*.

**Mental model**

Two shifts define this topic. First, for **passwords**, invert your usual instinct about hashing: normally "fast" is a virtue, but for password storage **slow is the whole point**. You're not fingerprinting data — you're deliberately making each guess expensive so that an attacker who steals your hash database can only try a handful of passwords per second instead of billions. Salt defeats precomputation (rainbow tables) and makes identical passwords hash differently; a tunable work factor lets you stay ahead of Moore's law. Second, for **keys**, think in terms of a **key hierarchy and blast radius**: you never protect a million records directly with one master key you can't rotate. Instead, each piece of data gets its own **data key**, and those data keys are protected by a **master key** that lives in a hardened KMS/HSM and never leaves it. This makes rotation cheap (re-encrypt small keys, not petabytes of data) and contains damage (a leaked data key exposes one blob, not everything). The recurring lesson: the algorithms are solved; the *operations* — key storage, rotation, randomness, mode/nonce discipline — are where real systems live or die.

**Key terms**

- **Password hashing function** — a *deliberately slow*, salted one-way function for storing passwords: **bcrypt**, **scrypt**, **Argon2** (never plain SHA/MD5).
- **Salt** — a unique, random, per-password value stored alongside the hash; defeats rainbow tables and makes equal passwords hash differently.
- **Pepper** — a secret value added to all passwords, stored *separately* from the DB (e.g. in a KMS/app config), so a DB-only leak isn't enough to crack.
- **Work factor / cost** — a tunable parameter (bcrypt rounds, Argon2 memory/time) making each hash slower as hardware improves.
- **DEK (Data Encryption Key)** — the symmetric key that actually encrypts data.
- **KEK (Key Encryption Key) / master key** — a key that encrypts DEKs; lives in a KMS/HSM.
- **Envelope encryption** — encrypt data with a DEK, encrypt the DEK with a KEK, store the wrapped DEK next to the data.
- **KMS (Key Management Service)** — a managed service that generates, stores, rotates, and gates access to keys.
- **HSM (Hardware Security Module)** — tamper-resistant hardware where keys are generated and used but never exported.
- **Key rotation** — periodically replacing keys so exposure of any single key is time-bounded.
- **CSPRNG** — a cryptographically secure pseudo-random number generator (the only acceptable source for keys, IVs, tokens, salts).
- **Argon2id** — the current recommended password KDF; memory-hard, resists GPU/ASIC cracking.

**Why interviewers ask this**

"How do you store passwords?" is one of the most common security interview questions *precisely because* so many candidates get it wrong. A junior answers "hash with SHA-256 and a salt" and thinks that's secure; a senior explains *why* that's inadequate (SHA-256 is far too fast) and reaches for Argon2/bcrypt with a tuned cost. The key-management questions separate people who've only encrypted a toy string from people who've run crypto in production — do you understand *where the key lives*, how you rotate it without re-encrypting everything, and why a hardcoded key in the repo is game over regardless of how strong AES is? The "spot the crypto mistake" questions (ECB, nonce reuse, `Math.random()` for tokens) test whether you can catch the failures that actually cause breaches. Overall this topic reveals operational maturity: the difference between knowing crypto and *shipping* crypto safely.

**Common confusions**

- "SHA-256 + salt is fine for passwords" — no; it's too fast (billions of guesses/sec on a GPU). Use a slow, memory-hard KDF (Argon2/bcrypt/scrypt).
- "Salt is secret" — salt is *not* secret; it's stored in plain next to the hash. Its job is uniqueness/anti-precomputation, not secrecy. (Pepper *is* secret and stored separately.)
- "Encrypting at rest means the master key is safe" — only if the key lives somewhere hardened (KMS/HSM); a key in the same DB or config file as the data protects nothing.
- "We rotate keys, so old data is safe" — rotation limits *future* exposure; you must also plan how existing data is re-wrapped/re-encrypted.
- "`Math.random()` is random enough for a token" — it's a non-cryptographic PRNG and predictable; use a CSPRNG for anything security-relevant.
- "Envelope encryption is overkill" — it's the standard because it makes rotation cheap and bounds blast radius; direct-with-master-key doesn't scale or rotate.

**What follows from this topic**

This is where the crypto primitives meet the rest of the primer. Password hashing connects directly to Authentication (MFA, credential stuffing, breached-password checks). Key management underpins secrets management and supply-chain security (signing keys), and the "never hardcode keys / never commit secrets" rule connects to secret scanning in the AppSec-testing and secrets topics. KMS/HSM and envelope encryption reappear in cloud security (KMS-backed encryption, IMDS for credentials) and container security (secrets handling). The randomness and nonce discipline here is the operational enforcement of the correctness the Cryptography Basics topic described. Master this, and you can look at a real system's crypto and tell whether it's genuinely secure or merely uses secure-sounding algorithms.

### Q1. How do you securely store user passwords?

Use a **slow, salted, memory-hard password hashing function** — **Argon2id** (current best), **bcrypt**, or **scrypt** — never a fast general-purpose hash.

```javascript
// ❌ WRONG — fast hash, crackable at billions/sec on a GPU
const hash = sha256(password + salt);

// ✅ RIGHT — deliberately slow, salted KDF (library handles salt + params)
import argon2 from 'argon2';
const hash = await argon2.hash(password); // embeds salt + params in the output string
// verify:
const ok = await argon2.verify(hash, submittedPassword);
```

The essentials:

- **Never store plaintext, and never encrypt** (encryption is reversible — a leaked key exposes every password). Passwords should be **one-way hashed** so even you can't recover them.
- **Use a slow KDF.** The point is to make each guess expensive. Argon2/bcrypt/scrypt are *designed* to be slow and (Argon2/scrypt) memory-hard to resist GPU/ASIC cracking.
- **Salt per-password**, automatically (these libraries generate and store the salt in the output string). Salt defeats rainbow tables and ensures two users with the same password get different hashes.
- **Tune the work factor** so a single hash takes ~250–500ms on your hardware, and raise it over time.
- **Optionally add a pepper** — a secret stored *outside* the DB (in a KMS/HSM) — so a database-only leak still can't be cracked.

Then wrap this with the rest of good auth hygiene: MFA, rate limiting/lockout on login, and checking new passwords against known-breached lists (see the Authentication topic).

### Q2. Why is SHA-256 (or MD5) the wrong choice for hashing passwords?

Because they're **too fast** — the exact opposite of what password storage needs. SHA-256 and MD5 are general-purpose hashes designed to fingerprint data quickly; a modern GPU computes **billions** of SHA-256 hashes per second. So if an attacker steals your password table, they can run an offline brute-force / dictionary attack testing enormous numbers of candidate passwords per second, cracking most real-world passwords quickly.

MD5 has the additional sin of being **cryptographically broken** (practical collisions), but the speed problem alone disqualifies SHA-256 too, even salted:

```
Attacker with stolen hashes:
  SHA-256 + salt:  ~10,000,000,000 guesses/sec/GPU   → weak passwords fall in seconds
  bcrypt (cost 12): ~a few thousand guesses/sec/GPU   → same attack takes years
  Argon2id (memory-hard): even worse for the attacker — memory cost defeats GPU parallelism
```

Salt does **not** fix this: salt prevents *precomputation* (rainbow tables) and forces the attacker to crack each hash separately, but it does nothing to slow down a per-hash brute force. The fix is a **deliberately slow, memory-hard KDF** (Argon2/bcrypt/scrypt) whose cost you can tune upward as hardware improves. The one-line interview answer: "SHA-256 is fast, and for passwords fast is the enemy — use Argon2 or bcrypt, which are slow by design."

### Q3. Explain salt vs pepper in password hashing.

Both add extra input to a password before hashing, but they defend against different things and are stored differently:

| | Salt | Pepper |
|---|---|---|
| Secret? | No — public | Yes — secret |
| Unique per user? | Yes | No (one global value, or few) |
| Stored where? | Alongside the hash in the DB | *Separately* — KMS, HSM, app config, not the DB |
| Defends against | Rainbow tables; identical passwords hashing alike | An attacker who steals *only* the DB |

**Salt** is a random, unique-per-password value stored right next to the hash. It ensures two users with the same password get different hashes (defeating rainbow-table precomputation and hiding password reuse). Salt being public is fine — its job isn't secrecy, it's uniqueness. Modern KDFs (bcrypt/Argon2) generate and embed the salt automatically.

**Pepper** is a single secret value applied to all passwords (often as an HMAC key or an extra input), but crucially stored *outside* the database — in a secrets manager, KMS, or HSM. The point: if an attacker exfiltrates the password table via SQL injection but *doesn't* also compromise the app's secret store, they can't crack anything because they're missing the pepper. It's a defense-in-depth layer on top of the KDF, not a replacement for it. The common mistake is storing the pepper in the same database (useless) or treating salt as if it needed to be secret (it doesn't).

### Q4. What is a work factor and why must it be tunable?

A **work factor** (also cost factor / cost parameters) controls how *expensive* each password hash is to compute — bcrypt's `cost` (rounds, exponential: cost 12 = 2^12 iterations), scrypt's CPU/memory parameters, or Argon2's time, memory, and parallelism settings.

It must be **tunable** because of Moore's law: hardware keeps getting faster, so a work factor that took 250ms in 2015 might take 5ms today, making offline cracking far cheaper. A tunable cost lets you *raise* the difficulty over time to keep each hash expensive for attackers, holding the line as GPUs/ASICs improve — without changing algorithms.

Practical guidance:

- **Tune to your hardware and UX budget** — aim for roughly 250–500ms per hash on your auth servers. Too low = weak; too high = you DoS your own login and burn CPU.
- **Argon2 adds a *memory* cost** — memory-hardness is what defeats massively parallel GPU/ASIC attacks (they have lots of compute but limited fast memory per core), which is why Argon2id is the modern recommendation over bcrypt.
- **Upgrade transparently** — on each successful login, if the stored hash used an old (lower) cost, re-hash the password at the new cost and update the record. That migrates users to stronger parameters without forcing resets.

The reason interviewers like this: it shows you understand password storage as an ongoing arms race with a tuning knob, not a one-time "we hash them" checkbox.

### Q5. What is envelope encryption and why is it used?

Envelope encryption is a **two-tier key scheme**: you encrypt your data with a **Data Encryption Key (DEK)**, then encrypt the DEK itself with a **Key Encryption Key (KEK)** — the "master key" — and store the encrypted (wrapped) DEK right next to the ciphertext.

```
Plaintext ──encrypt with──> DEK ──encrypts──> Ciphertext
   DEK ──encrypt with──> KEK (master key, lives in KMS/HSM) ──> Wrapped DEK
Stored together: [ Ciphertext | Wrapped DEK ]
KEK never leaves the KMS.
```

To decrypt: send the wrapped DEK to the KMS, which uses the KEK to unwrap it (the KEK never leaves the KMS), get the plaintext DEK back in memory, decrypt the data, then discard the DEK.

Why it's the standard pattern:

- **Cheap rotation** — to rotate the master key you only re-encrypt the small DEKs (kilobytes), not petabytes of data. To rotate a DEK you re-encrypt just that one object.
- **Bounded blast radius** — each object (or tenant/file) can have its own DEK, so a single leaked DEK exposes only that object, not everything.
- **The master key stays protected** — the KEK lives only in a hardened KMS/HSM and is never exposed to your app or written to disk; your servers only ever handle wrapped DEKs and short-lived plaintext DEKs in memory.
- **Performance** — bulk data is encrypted locally with fast symmetric DEKs; the KMS is only called for the small wrap/unwrap operations.

Every major cloud KMS (AWS/GCP/Azure) implements exactly this, and it's how you should design any at-scale encryption-at-rest system.

### Q6. What's the difference between a KMS and an HSM, and when do you need each?

Both manage cryptographic keys, but at different levels:

- **HSM (Hardware Security Module)** — dedicated, tamper-resistant *hardware* that generates, stores, and uses keys such that the key material **never leaves the device** in plaintext. You send data *to* the HSM to be signed/encrypted; you can't extract the key. Tamper attempts zeroize the keys. It's the hardware root of trust, often certified (FIPS 140-2/3).
- **KMS (Key Management Service)** — a *managed service* (usually cloud) that provides key lifecycle management: create, store, rotate, gate access via IAM policies, audit-log every use, and integrate with other services. Cloud KMS is typically *backed by* HSMs under the hood.

When you need each:

- **Most applications** should use a **KMS** — it gives you envelope encryption, IAM-gated access, automatic rotation, and audit logging with almost no operational burden. This covers the vast majority of "encrypt our data at rest / manage our keys" needs.
- **Reach for a dedicated HSM (or KMS with dedicated/single-tenant HSM backing)** when you have strict compliance mandates (PCI-DSS for payment keys, PKI root CA keys, code-signing keys) requiring keys to *provably* never exist outside certified hardware, or you need the strongest possible protection for a small number of extremely high-value keys (e.g. your CA's root private key, kept offline in an HSM).

The unifying principle: keys should live in something *purpose-built to protect them*, not in your application config, environment variables checked into a repo, or a database column. KMS/HSM exists so that even a full application compromise doesn't hand the attacker your master keys.

### Q7. Why and how do you rotate cryptographic keys?

**Why rotate:** every key has a limited safe lifetime. Rotation bounds the damage of an undetected compromise (a leaked key only decrypts data from its active window), limits the amount of ciphertext under any single key (reducing cryptanalysis and nonce-exhaustion risk), and satisfies compliance requirements (PCI-DSS, etc.). If you *never* rotate, a single key compromise — possibly years ago and undetected — exposes *everything*.

**How, without re-encrypting the world:** this is exactly where **envelope encryption** pays off.

- **Rotating the master key (KEK):** generate a new KEK version in the KMS, and re-encrypt only the **DEKs** (small) with it. The bulk ciphertext is untouched because it's still encrypted under its DEK. Cloud KMS can do this automatically on a schedule, keeping old key versions around to decrypt existing wrapped DEKs while new writes use the new version.
- **Rotating a DEK:** decrypt the affected data with the old DEK and re-encrypt with a new one — needed on actual DEK compromise, done per-object so scope is small.
- **Signing/asymmetric keys:** publish the new public key, sign new artifacts with the new private key, and keep the old public key trusted for a validity window so existing signatures still verify.

Operational must-haves: **support multiple key versions simultaneously** (so you can decrypt old data while encrypting new data with the new key), tag ciphertext with its key ID/version, and have a **break-glass** rotation path for emergency compromise (which may require actually re-encrypting data, not just re-wrapping DEKs). The design goal is that routine rotation is cheap enough to do often.

### Q8. What is a CSPRNG and why does it matter for security?

A **CSPRNG (Cryptographically Secure Pseudo-Random Number Generator)** is a random number generator whose output is unpredictable even to an attacker who has seen previous outputs — it's seeded from high-entropy sources and designed so you can't infer past or future values. It matters because **the security of nearly every crypto operation depends on unpredictable random values**: encryption keys, IVs/nonces, salts, session IDs, password-reset tokens, API keys, CSRF tokens, TLS randoms.

The classic failure is using a **non-cryptographic** PRNG (like `Math.random()`, `java.util.Random`, C's `rand()`), which is fast and statistically "random-looking" but **predictable** — its internal state can often be recovered from a few outputs, letting an attacker predict the next "random" token, guess session IDs, or reconstruct a key.

```javascript
// ❌ Predictable — a non-crypto PRNG for a security token
const token = Math.random().toString(36).slice(2);

// ✅ CSPRNG
import { randomBytes, randomUUID } from 'crypto';
const token = randomBytes(32).toString('hex');   // 256 bits of secure randomness
const id = randomUUID();                          // CSPRNG-backed
```

Use the platform CSPRNG: Node `crypto.randomBytes`/`randomUUID`, browser `crypto.getRandomValues`, Java `SecureRandom`, Python `secrets`/`os.urandom`, Go `crypto/rand`. The rule: **anything security-relevant must come from a CSPRNG.** Weak randomness has caused real, catastrophic breaks — predictable session tokens, guessable password-reset links, and even reused ECDSA nonces that leaked private keys.

### Q9. Spot the vulnerability: `encrypt(data, key, mode='ECB')`. What's wrong and how do you fix it?

The problem is **ECB (Electronic Codebook) mode**. ECB encrypts each block independently with the same key, so **identical plaintext blocks always produce identical ciphertext blocks** — structural patterns in the data leak straight through the "encryption," and it provides no integrity/tamper detection at all.

```python
# ❌ ECB leaks patterns; identical blocks → identical ciphertext
cipher = AES.new(key, AES.MODE_ECB)
ct = cipher.encrypt(pad(data))

# ✅ AES-GCM: authenticated encryption, unique nonce, integrity built in
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
import os
aesgcm = AESGCM(key)
nonce = os.urandom(12)                 # unique per message, from a CSPRNG
ct = aesgcm.encrypt(nonce, data, associated_data)  # returns ciphertext + auth tag
# store nonce alongside ct; decrypt verifies the tag and rejects tampering
```

**The fix:** use an **authenticated (AEAD) mode** — **AES-GCM** or **ChaCha20-Poly1305** — with a unique, CSPRNG-generated nonce per message. AEAD gives you confidentiality *and* integrity (a tamper-evident authentication tag) in one construction, so you also close the door on padding-oracle-style attacks you'd risk with unauthenticated CBC.

The reason to recognize ECB on sight: it's a textbook "uses AES so it must be secure" trap — the algorithm is fine, the *mode* destroys the security. The "ECB penguin" image (a picture encrypted in ECB whose outline is still visible) is the canonical demonstration that ECB must never be used for real data.

### Q10. Spot the vulnerability: a config file with `AES_KEY = "hardcoded-secret-key-123"` committed to the repo. What's the problem and the fix?

The problem is a **hardcoded secret in source control** — one of the most common and damaging real-world crypto failures. Even if you use AES perfectly, a hardcoded key means:

- **Anyone with repo access has the key** — every developer, every CI system, every contractor, and anyone who ever clones or forks it.
- **It's in git history forever** — deleting it in a later commit does *not* remove it; it's recoverable from history (and likely already scraped if the repo was ever public).
- **You can't rotate it easily** — it's baked into code and often the same across all environments.
- **Public-repo bots find these in seconds** — automated scanners continuously harvest committed keys/tokens from public repos.

The fixes, layered:

- **Never commit secrets.** Load keys from a **secrets manager / KMS** (Vault, cloud KMS/Secrets Manager) at runtime, or at minimum from environment/config injected by the deployment platform — never checked into the repo.
- **Use envelope encryption** so the app handles wrapped DEKs and the real master key lives only in the KMS/HSM.
- **Add automated secret scanning** to CI and pre-commit hooks (gitleaks, truffleHog, GitHub secret scanning) to block secrets before they land.
- **If a secret was ever committed, rotate it immediately** and treat it as compromised — then scrub history if needed. Rotation, not just deletion, is the required response, because the old value is already exposed.

This connects to the broader secrets-management and secret-scanning discipline in the AppSec-testing and supply-chain topics.

### Q11. What is nonce/IV reuse and why is it so dangerous in practice?

A nonce (or IV) must be **unique per encryption under a given key**. Reusing the same (key, nonce) pair breaks the security guarantees — and it's a shockingly common real-world bug because nonces are easy to mishandle (a fixed constant, a counter that resets on restart, a low-entropy source).

Why it's dangerous depends on the mode, and for counter-based/AEAD modes like **GCM and CTR** it's catastrophic:

- These modes work by generating a **keystream** from (key, nonce) and XORing it with plaintext. If two messages use the same (key, nonce), they use the *same keystream*, so `C1 ⊕ C2 = P1 ⊕ P2` — the XOR of the two plaintexts leaks, often enough to recover both.
- For **GCM specifically**, nonce reuse is even worse: it can leak the **authentication subkey**, letting an attacker **forge** valid authentication tags — destroying integrity entirely, not just confidentiality.

```
Reused (key, nonce) in GCM/CTR:
  C1 ⊕ C2 = P1 ⊕ P2      → confidentiality gone
  + GCM auth key exposure → attacker can forge messages (integrity gone)
```

**The fixes:**

- Let a **vetted library manage nonces**; never hardcode or reuse one.
- For GCM, use a **random 96-bit nonce from a CSPRNG** per message (collision probability is negligible within a key's safe message budget), or a **strictly monotonic counter** you can *guarantee* never repeats (careful across restarts/instances).
- **Rotate the key** well before approaching the nonce budget for that key.
- Consider **misuse-resistant** modes (AES-GCM-SIV) where accidental nonce reuse degrades gracefully instead of catastrophically.

### Q12. What are the most common crypto mistakes you look for in a code review?

The failures are almost never "the algorithm is weak" — they're misuse. My checklist:

- **Passwords with a fast hash** — SHA-256/MD5 (even salted) instead of Argon2/bcrypt/scrypt. *Fix:* slow, memory-hard KDF with tuned cost.
- **ECB mode** — `MODE_ECB` anywhere. *Fix:* AES-GCM (authenticated).
- **Nonce/IV reuse** — a constant or resettable counter, or a fixed IV. *Fix:* unique CSPRNG nonce per message; rotate keys before budget exhaustion.
- **Hardcoded keys/secrets** — keys in source, config, or env-in-repo. *Fix:* KMS/secrets manager, secret scanning in CI, rotate anything committed.
- **Weak randomness** — `Math.random()`/`rand()` for keys, tokens, IVs, salts. *Fix:* CSPRNG (`crypto.randomBytes`, `SecureRandom`, `secrets`).
- **Home-rolled crypto** — custom "encryption," custom keyed hashing (`H(K||m)`), custom protocols. *Fix:* vetted libraries (libsodium) and standard constructions.
- **Unauthenticated encryption** — CBC/CTR without a MAC (padding-oracle risk). *Fix:* AEAD (GCM/Poly1305), or encrypt-then-MAC via a library.
- **Non-constant-time comparison** — comparing MACs/tokens/hashes with `==`. *Fix:* constant-time compare (`crypto.timingSafeEqual`, `hmac.compare_digest`).
- **Deprecated primitives** — MD5, SHA-1, DES, RSA-1024, small/custom curves. *Fix:* SHA-256+, AES-256, RSA-2048+/ECC on standard curves.
- **Reversible password storage** — encrypting (recoverable) instead of hashing passwords. *Fix:* one-way KDF.
- **Missing cert validation** — disabling TLS verification (`verify=False`) to "make it work." *Fix:* validate the chain and hostname.

The theme: correct crypto is about *construction and operations*, and every item above pairs a recognizable smell with a concrete fix.

### Q13. Where should encryption keys live, and where should they never live?

**Never** in:

- **Source code / version control** — hardcoded constants, committed config. It's in history forever and scraped from public repos in seconds.
- **The same store as the data it protects** — a key in a DB column next to the ciphertext, or in the same backup, protects nothing against whoever grabs that store.
- **Plaintext env vars or config files shipped in the image** — better than source, but still exposed to anyone who reads the container/host, leaks via logs, or dumps the environment.
- **Client-side code** — anything shipped to a browser/mobile app is extractable; there are no secrets on the client.

**Should** live in:

- **A KMS / HSM** — the master key (KEK) is generated in and never leaves hardened, access-controlled, audit-logged storage; your app only handles **wrapped DEKs** (envelope encryption) and short-lived plaintext DEKs in memory.
- **A secrets manager** (Vault, cloud Secrets Manager) — for keys/credentials the app must retrieve, fetched at runtime over an authenticated channel, with access gated by IAM and every access logged, and rotation supported.

The guiding principle: keys should be **as protected as, or more protected than, the data they unlock**, accessed via least-privilege identity, with every use auditable and rotation possible. If compromising the *data store* also hands over the *key*, your encryption is decorative. This is why "we encrypt at rest" is an incomplete claim until you can answer "and where does the key live, who can use it, and how does it rotate?"

### Q14. How do you handle secrets (API keys, DB passwords, tokens) in an application securely?

Treat secrets as first-class, managed material — never as ordinary config or code:

- **Store them in a dedicated secrets manager** — HashiCorp Vault, AWS Secrets Manager, GCP Secret Manager, Azure Key Vault. The app fetches them at runtime over an authenticated, TLS channel, with access gated by least-privilege IAM and every retrieval **audit-logged**.
- **Never commit secrets** to git (not even in `.env` files that get checked in) and never bake them into container images. Add **secret scanning** (gitleaks/truffleHog/GitHub secret scanning) as a pre-commit hook and CI gate to catch leaks before they land.
- **Inject at runtime**, not build time — via the secrets manager SDK, a sidecar/agent, or the platform's secret mounting (K8s secrets backed by a real secrets store, not base64 in a manifest — see container security). Prefer short-lived, dynamically-generated credentials (e.g. Vault dynamic DB creds, cloud IAM roles / workload identity) over long-lived static keys.
- **Rotate regularly and on any suspected exposure**; design the app to pick up rotated secrets without downtime. Any secret that *was* exposed (committed, logged, shared) is compromised — rotate it, don't just remove it.
- **Keep secrets out of logs, errors, URLs, and client code** — scrub them from log output and stack traces, never put them in query strings, and never ship them to the browser/mobile client.

The mental model: secrets have a lifecycle (issue → distribute → use → rotate → revoke) that a secrets manager exists to run for you. Hand-rolling it with env vars and hoping is how credentials end up in a breach.

### Q15. How would you design encryption-at-rest for a multi-tenant SaaS storing sensitive customer data?

I'd build on **envelope encryption with a KMS**, and add per-tenant isolation:

- **Master key (KEK) in KMS/HSM** — never leaves the KMS; access gated by IAM; rotated on a schedule with old versions retained to unwrap existing DEKs.
- **Per-tenant (or per-object) DEKs** — each tenant's data is encrypted with its own DEK, and that DEK is wrapped by the KEK and stored alongside the data. This **bounds blast radius**: a leaked DEK exposes one tenant, not the whole fleet, and lets you **cryptographically delete** a tenant by destroying their DEK (useful for GDPR erasure and offboarding).
- **AES-256-GCM** for the actual encryption — authenticated, with a unique CSPRNG nonce per operation, so you get integrity plus confidentiality.
- **Rotation strategy** — routine KEK rotation only re-wraps DEKs (cheap); on suspected DEK compromise, re-encrypt just that tenant's data with a fresh DEK.
- **Access control still required** — at-rest encryption protects stolen disks/backups, but a valid app query decrypts transparently, so it is *not* a substitute for authorization; enforce tenant isolation in the data layer too (row-level security, tenant-scoped queries) to prevent cross-tenant reads (IDOR).
- **In-transit encryption** (TLS/mTLS) for all data movement, and **encrypted, tested backups** using the same KMS-backed keys.
- **Auditing** — log every KMS key use so you can detect anomalous decryption patterns.

The layered result: KMS protects the master key, DEKs isolate tenants and enable crypto-shredding, GCM ensures integrity, and access control ensures encryption isn't the *only* thing standing between one tenant and another's data.

### Q16. A developer wants to encrypt data so it can be decrypted later, and reaches for the same approach used for passwords. What's the mistake?

The mistake is conflating two fundamentally different goals: **recoverable confidentiality** (you need to get the data back) versus **verification without recovery** (you never need the original).

- **Passwords** should be **hashed** with a one-way KDF (Argon2/bcrypt) precisely *because you never want to recover them* — you only ever check a submitted password against the stored hash. One-way is a feature: even you can't leak what you can't reverse.
- **Data you must read back later** (a stored API key you'll call with, a document, a payment token you'll charge) must be **encrypted**, not hashed — hashing is irreversible, so a hashed API key is just destroyed data. Encryption is reversible *with the key*.

So the correct approach for recoverable data is **symmetric encryption (AES-GCM) with proper key management** — a KMS-backed key, envelope encryption (DEK/KEK), unique nonces, and integrity via the AEAD tag:

```javascript
// Recoverable secret → ENCRYPT (not hash)
import { randomBytes, createCipheriv } from 'crypto';
const nonce = randomBytes(12);
const cipher = createCipheriv('aes-256-gcm', dek, nonce);  // dek unwrapped from KMS
const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
const tag = cipher.getAuthTag();               // store nonce + tag + ciphertext
```

The general rule to state in an interview: **hash what you only need to verify; encrypt what you need to read back** — and never encrypt passwords (reversible = a key leak exposes them all) nor hash data you must recover (irreversible = data loss). Getting this distinction right is the applied version of the hashing-vs-encryption confusion from the Cryptography Basics topic.
## Authentication

### Summary

**What this topic covers**

Authentication is proving *who* a request comes from — establishing identity before any authorization decision runs. This topic spans the full modern stack: password handling under current **NIST 800-63B** guidance (length over rotation, breached-password screening, no forced composition rules); multi-factor authentication and its ranking (**SMS < TOTP < WebAuthn**); the cryptographic mechanics of **TOTP** and the phishing-resistant public-key model behind **WebAuthn / passkeys / FIDO2**; **session management** — how you turn a one-time login into a stateful identity that survives across requests without re-authenticating; secure password *storage* (which ties straight into the password-hashing material — bcrypt/scrypt/Argon2 + salt, never plain SHA); the risk surface of **account recovery** (the reset flow is usually the weakest link); and the attacks that target the login endpoint itself — **credential stuffing**, brute force, password spraying — plus their defenses: rate limiting, lockout, breached-password checks, and CAPTCHA. The 16 questions move from "what are the three authentication factors" up to "design end-to-end secure authentication for a new service."

**Mental model**

Authentication answers one question: *is this entity who it claims to be?* Think of it as a pipeline with three distinct phases that are attacked separately. **(1) Enrollment** — how a credential is created and stored (password hashing, key registration). **(2) The authentication event** — the moment of proving identity (password check, TOTP verification, WebAuthn challenge-response). **(3) Session continuity** — after login, how you *remember* the user without re-proving identity on every request (session cookies or tokens). A break in any phase compromises the whole. Weak storage means a database leak becomes an account takeover; a weak auth event means credential stuffing works; weak session handling means a stolen cookie is a permanent login. The single most important shift for candidates: **authentication is not just "the login form."** Password reset, "remember me," session refresh, and MFA fallback are all authentication surfaces, and attackers go for the weakest one. Assume the password will leak; layer factors so that one compromised factor isn't game over.

**Key terms**

- **Authentication factor** — something you *know* (password), *have* (phone, security key), *are* (biometric). MFA combines two+ categories.
- **MFA / 2FA** — requiring evidence from two or more distinct factor categories; 2FA is MFA with exactly two.
- **TOTP** — Time-based One-Time Password (RFC 6238): a 6-digit code derived from a shared secret + current 30-second time window via HMAC.
- **WebAuthn / FIDO2 / passkey** — public-key authentication where the private key never leaves the device; phishing-resistant because the signature is bound to the origin.
- **Session** — server-recognized state that keeps a user logged in after the auth event, referenced by a session ID (cookie) or token.
- **Session fixation** — attacker sets a victim's session ID *before* login so they share the post-login session; fix by rotating the ID on privilege change.
- **Credential stuffing** — replaying username/password pairs leaked from *other* breaches, exploiting password reuse.
- **Password spraying** — trying a few common passwords against *many* accounts to dodge per-account lockout.
- **Breached-password check** — screening new/changed passwords against known-compromised lists (e.g. HIBP k-anonymity range API).
- **Passwordless** — authenticating without a stored secret the user types — magic links, passkeys, WebAuthn.
- **SSO** — Single Sign-On: one identity provider authenticates you once for many relying-party apps (via OIDC/SAML).
- **Account recovery** — the flow to regain access when a factor is lost; a parallel authentication path and a frequent bypass.

**Why interviewers ask this**

Authentication is where security theory meets a feature every product ships, so it's a reliable senior/junior discriminator. Juniors describe the happy path ("check the password, set a cookie") and stop. Seniors immediately name the *storage* concern (bcrypt/Argon2 + per-user salt, never SHA-256), the *session* concern (HttpOnly/Secure/SameSite, rotate on login, idle + absolute timeout), the *recovery* concern (the reset flow bypasses the password entirely, so it must be as strong), and the *attack* concern (rate-limit and lockout to blunt stuffing, screen breached passwords). The question "design authentication for us" is a favorite because it has no single right answer — the interviewer watches whether you reason about threat models, factor tradeoffs (usability vs SMS interceptability), and failure modes, or just recite one library. Naming passkeys/WebAuthn as the phishing-resistant endgame signals you're current.

**Common confusions**

- "MFA means two passwords." No — two of the *same* category (two things you know) isn't MFA. The factors must be from different categories.
- "SMS 2FA is secure." It's better than nothing but weak — SIM-swap and SS7 interception defeat it. NIST discourages SMS as a factor; prefer TOTP or WebAuthn.
- "TOTP secrets can be stored like passwords (hashed)." No — TOTP verification needs the *plaintext* shared secret to recompute the code, so it's encrypted at rest, not hashed.
- "Passkeys and passwords are both 'something you know'." Passkeys are *something you have* (a private key on your device) — that's why they resist phishing and credential stuffing.
- "Authentication and authorization are the same." They're distinct — authN is *who you are*, authZ is *what you may do*. See the next topic.
- "Long sessions are fine if the cookie is HttpOnly." HttpOnly stops JS theft, not network/XSS-adjacent theft or physical access; you still need rotation and timeouts.

**What follows from this topic**

Authentication establishes identity; the **Authorization & Access Control** topic that follows decides what that identity is *allowed* to do — the two are constantly conflated and interviewers probe the seam. Secure password *storage* here is the applied face of the cryptography/hashing material (bcrypt/scrypt/Argon2, salt, work factor). Session and token security (cookie flags, JWT pitfalls, OAuth/OIDC, session fixation) is its own deep topic — this summary only opens it. And the attacker-side view (credential stuffing, brute force) connects to rate limiting, monitoring, and incident response elsewhere in the primer.

### Q1. What are the three authentication factors, and what makes something "multi-factor"?

The three factor *categories*:

- **Something you know** — password, PIN, security question.
- **Something you have** — phone (for TOTP/SMS), hardware security key, smart card, passkey (private key on device).
- **Something you are** — biometrics: fingerprint, face, iris.

(Sometimes extended with *somewhere you are* — geolocation — and *something you do* — behavioral biometrics.)

**Multi-factor** means combining factors from **two or more different categories**. A password + a security question is *not* MFA — both are "something you know," so a single database leak or phishing page captures both. A password (know) + a TOTP code from your phone (have) *is* MFA: the attacker now needs your password *and* physical possession of your seeded device. The whole value of MFA is that the factors fail independently — a phished password alone doesn't grant access.

### Q2. How should you store user passwords? Walk through it.

Never store plaintext, and never store a fast hash (`SHA-256`, `MD5`) even "with a salt" — those are built for speed, so a GPU brute-forces billions per second. Use a **slow, memory-hard password-hashing function** with a per-user **salt** and a tuned **work factor**.

```python
# ❌ Vulnerable: fast hash, brute-forceable at billions/sec on a GPU
hashed = hashlib.sha256(password.encode()).hexdigest()

# ✅ Fixed: Argon2id — memory-hard, salted, tunable work factor
from argon2 import PasswordHasher
ph = PasswordHasher()             # generates a random salt per hash
stored = ph.hash(password)        # store this whole string
ph.verify(stored, password_input) # raises on mismatch
```

Key points:

- **Salt** (random, per-user, stored alongside the hash) defeats precomputed rainbow tables and ensures two users with the same password get different hashes. Modern PHFs embed the salt in the output string.
- **Work factor** (Argon2 memory/iterations, bcrypt cost) is tuned so a single hash takes ~250-500ms — painful at scale for an attacker, invisible to one login. Raise it as hardware improves.
- **Algorithm choice**: **Argon2id** (current OWASP first choice), **scrypt**, or **bcrypt** (battle-tested, but 72-byte input cap). Not PBKDF2 unless FIPS-constrained.
- **Pepper** (optional): a secret added to all passwords, stored *outside* the DB (in a KMS/HSM), so a DB-only leak isn't enough. Complements, doesn't replace, the salt.

### Q3. What does current NIST guidance (800-63B) say about password policies, and why did it change?

The 2017+ NIST guidance overturned a decade of "complexity theater":

- **Length over composition** — require a minimum length (8+, allow up to 64+), but **drop** forced "uppercase + number + symbol" rules. Composition rules push users toward predictable patterns (`Password1!`).
- **No periodic forced rotation** — only force a reset on evidence of compromise. Scheduled 90-day rotations just produce `Spring2026` → `Summer2026`.
- **Screen against breached-password lists** — reject passwords known to be compromised (check against a corpus like Have I Been Pwned via k-anonymity).
- **Allow all characters incl. spaces/emoji, support paste** — so password managers work.
- **No password hints or knowledge-based questions** — "mother's maiden name" is public-record and defeats the point.

The rationale: usability *is* security. Rules that frustrate users produce weaker passwords and workarounds. Effort shifts from arbitrary complexity to what actually helps — length, breach screening, and MFA.

### Q4. How does TOTP work, and where's the shared secret stored?

**TOTP** (Time-based One-Time Password, RFC 6238) is HOTP with the counter set to the current time window:

```
code = HOTP(secret, floor(current_unix_time / 30))
     = truncate( HMAC-SHA1(secret, T) ) mod 10^6
```

At enrollment the server generates a random **shared secret** and shows it as a QR code (an `otpauth://` URI); the authenticator app stores it. Both sides then independently compute the same 6-digit code from `secret + time`, no network round-trip. The server accepts codes from the current window ±1 to tolerate clock skew.

Security notes:

- **The secret must be stored *encrypted at rest, not hashed*** — verification requires recomputing the HMAC, which needs the plaintext secret. This differs fundamentally from passwords (hashed) — a common interview trap.
- TOTP is *phishable*: a real-time phishing proxy can relay the 6-digit code. It stops credential stuffing and offline replay, but not a live man-in-the-middle. WebAuthn fixes that.
- Enforce **one-time use per window** server-side to prevent replay within the 30s.

### Q5. What is WebAuthn / FIDO2 / passkeys, and why is it "phishing-resistant"?

**WebAuthn** (the browser API) + **CTAP** (the authenticator protocol) = **FIDO2**. It's **public-key authentication**: at registration the authenticator (security key, phone, laptop TPM) generates a key pair, sends the **public** key to the server, and keeps the **private** key on the device — it never leaves, never transmits.

```
Login challenge-response:
  Server → random challenge
  Device → signs (challenge + origin) with private key   [user gesture: biometric/PIN]
  Server → verifies signature against stored public key
```

Why it's **phishing-resistant** — the two properties that matter:

1. **Origin binding** — the signature includes the requesting origin (`alice.acme.com`). A phishing site at `alice-acme.evil.com` gets a signature bound to the *wrong* origin, which the real server rejects. The user *can't* be tricked into handing over a reusable secret because there's no secret to hand over.
2. **Nothing shared to steal** — no password, no OTP travels the wire, so credential stuffing, replay, and database-leak reuse are all moot; the server only ever holds public keys.

**Passkeys** are WebAuthn credentials that sync across a user's devices (via iCloud Keychain, Google Password Manager, etc.), making the model usable for consumers without carrying a physical key. This is the current gold standard and the "passwordless" endgame.

### Q6. What's the difference between authentication and a session, and how do you manage sessions securely?

The **authentication event** happens once (you prove identity). A **session** is how the server *remembers* you across the many subsequent stateless HTTP requests without re-authenticating each one. After login the server issues a session identifier — either an opaque **session ID** stored server-side, or a signed **token** (JWT) — carried by the client, usually in a cookie.

Secure session management:

- **Cookie flags**: `HttpOnly` (JS can't read it → blunts XSS theft), `Secure` (HTTPS only), `SameSite=Lax/Strict` (blunts CSRF).
- **Rotate the session ID on privilege change** — especially right after login (prevents session fixation) and on step-up MFA.
- **High-entropy, unpredictable IDs** — ≥128 bits from a CSPRNG, so they can't be guessed or enumerated.
- **Two timeouts**: an **idle timeout** (e.g. 15-30 min of inactivity) and an **absolute timeout** (e.g. 8-24h) after which re-auth is required regardless.
- **Server-side invalidation on logout** — for opaque sessions, delete the record; the client-side cookie clear alone isn't enough.

Opaque server-side sessions are trivially revocable (delete the record); self-contained JWTs are not, which is why they need short expiry + refresh tokens — that tradeoff is its own topic.

### Q7. What is session fixation, and how do you prevent it?

**Session fixation**: the attacker obtains or sets a *known* session ID and tricks the victim into authenticating under it — e.g. by planting `?sessionid=ABC` in a link, or setting the cookie via an XSS/subdomain. If the server keeps the *same* session ID before and after login, the victim's now-authenticated session shares the attacker's known ID, and the attacker rides it.

```
Attacker gets session ABC → sends victim a link that sets session=ABC
Victim logs in → server keeps ABC, now authenticated
Attacker uses ABC → is logged in as victim
```

**Fix: regenerate the session ID on any privilege elevation**, above all immediately after successful authentication. The pre-login ID the attacker knew is discarded; the post-login session gets a fresh, unknown ID. One line in most frameworks (`session.regenerate()` / `request.changeSessionId()`). Also don't accept session IDs from URL parameters, and set `HttpOnly`/`Secure`/`SameSite`.

### Q8. What is credential stuffing, and how is it different from brute force? How do you defend?

**Brute force** = trying many passwords against *one* account. **Password spraying** = a few common passwords against *many* accounts (to stay under per-account lockout). **Credential stuffing** = replaying *real* username/password pairs leaked from *other* sites' breaches, betting on password reuse — and it's alarmingly effective because people reuse passwords.

The distinction matters because the defenses differ. Per-account lockout stops brute force but *not* stuffing (each stolen pair is one attempt against one account) or spraying (spread across accounts). Defenses, layered:

- **Rate limiting** — per-IP *and* per-account throttling; the per-account limit catches brute force, per-IP catches distributed attempts (though botnets spread across IPs).
- **Breached-password screening** — reject passwords known to be compromised at signup/change; a stuffed credential often *is* a known-breached one.
- **MFA** — the definitive mitigation: a correct password alone no longer grants access, so stuffing yields nothing.
- **Anomaly detection** — flag logins from new devices/geos/impossible travel; step up to MFA on risk.
- **CAPTCHA / bot detection** on suspicious volume, and **device fingerprinting**.
- **Credential-stuffing-aware monitoring** — a spike in login failures across many accounts from few IPs is the signature.

### Q9. Why is the password-reset / account-recovery flow often the weakest link, and how do you harden it?

Account recovery is a *parallel authentication path* — it grants full account access **without the password**. Attackers ignore the hardened login form and attack recovery instead, so it must be at least as strong.

Common weaknesses and fixes:

- **Knowledge-based questions** ("first pet") — public/guessable. Remove them entirely.
- **Predictable/long-lived reset tokens** — use high-entropy, single-use tokens that expire in ~15-60 min and are invalidated after use or a new request.
- **User enumeration** — "no account with that email" leaks which emails are registered. Return an identical "if an account exists, we've sent a link" response regardless.
- **Reset links over insecure channels / logged** — don't put tokens in referrer-leaking URLs or logs.
- **MFA bypass on reset** — resetting the password shouldn't silently drop the account's MFA. Require the second factor (or a recovery code) to complete recovery, and notify the user out-of-band on any reset.
- **Host header / open-redirect poisoning** — building the reset link from an attacker-controlled `Host` header sends the token to the attacker. Use a fixed, configured base URL.

### Q10. What is SSO, and how does it relate to OAuth 2.0 / OIDC / SAML?

**Single Sign-On** lets a user authenticate once with a central **Identity Provider (IdP)** and then access many **relying-party** apps without logging in again. The apps *delegate* authentication to the IdP.

- **SAML** — XML-based, the enterprise workhorse; the IdP sends a signed XML assertion to the service provider. Common in B2B/corporate SSO.
- **OIDC (OpenID Connect)** — a thin identity layer on top of **OAuth 2.0**; the IdP returns a signed **ID token** (a JWT) asserting *who* the user is. The modern default for web/mobile.
- **OAuth 2.0** — strictly an *authorization* framework (delegated access to resources), **not** authentication on its own. Using raw OAuth access tokens as proof of identity is a classic mistake — that's what OIDC's ID token is *for*.

Benefits: one strong credential + MFA to secure, central revocation, less password sprawl. Risk: the IdP becomes a single point of failure and a high-value target — compromise it and you compromise every downstream app, so it gets the strongest protection (phishing-resistant MFA, tight monitoring).

### Q11. What is passwordless authentication, and what are its tradeoffs?

**Passwordless** removes the typed shared secret entirely. Main forms:

- **Passkeys / WebAuthn** — device-held private key + biometric gesture. The strongest form: phishing-resistant, nothing to steal server-side, nothing to phish.
- **Magic links** — a one-time login link emailed to the user. Convenient, but only as strong as the email account, and links can leak via forwarding/referrers/shared inboxes; keep them single-use and short-lived.
- **Email/SMS OTP** — a one-time code sent per login. SMS inherits SIM-swap/interception risk.

Tradeoffs: passwordless eliminates the biggest attack surface (reusable, phishable, breach-able passwords) and kills credential stuffing outright. The costs are **recovery** (lose the device/email and you need a robust backup path — recovery codes, a second passkey) and **adoption/UX** friction. The recovery path can reintroduce all the weakness you removed, so design it as carefully as the primary flow. Best practice today: passkeys primary, with well-designed backup factors.

### Q12. A login endpoint returns "invalid password" for a real user but "no such account" for an unknown one. What's wrong?

That's **username enumeration**. The differing responses let an attacker discover which emails/usernames are registered — valuable for targeted phishing, credential stuffing (confirming which of a leaked list are valid here), and prioritizing brute force. The same leak appears via **timing** (a real account runs the expensive hash; a fake one returns instantly) and via **signup** and **password-reset** responses.

Fixes:

- **Uniform response** — a single generic "invalid email or password" for every failed login, regardless of which part was wrong.
- **Constant-time behavior** — run a dummy hash comparison even when the account doesn't exist, so response time doesn't reveal existence.
- **Consistent reset/signup messaging** — "if an account exists, we've sent an email."
- Layer **rate limiting** so even a subtle oracle can't be probed at scale.

Full elimination is hard (side channels leak), so the goal is to make enumeration expensive and unreliable, not just to fix the obvious message.

### Q13. Should you implement account lockout after N failed attempts? What are the tradeoffs?

Lockout blunts brute force but is a double-edged tool:

- **Pro**: caps guesses per account, so online brute force against one account becomes impractical.
- **Con — denial of service**: an attacker who knows a username can *deliberately* lock a victim out by failing on purpose. Hard lockouts turn a login form into a DoS vector.
- **Con — doesn't stop stuffing/spraying**: those make ≤1 attempt per account, staying under any threshold.

Better than a hard permanent lockout:

- **Exponential backoff / progressive delays** — each failure adds delay, slowing automation without permanently locking a legitimate user.
- **Temporary, self-clearing lockout** (e.g. 15 min) rather than "call support."
- **CAPTCHA after N failures** — gates automation while letting real users through.
- **Risk-based response** — combine with device/geo signals; step up to MFA rather than block.
- And ultimately **MFA + breached-password screening**, which address the attacks lockout can't (stuffing/spraying).

### Q14. How do you rate-limit authentication endpoints effectively?

Rate limiting must cut across several dimensions because a single axis is easy to evade:

- **Per account** — caps guesses against one target (brute force).
- **Per IP** — caps volume from one source, but botnets and residential proxies spread across thousands of IPs, so IP alone is weak against distributed stuffing.
- **Global / per-endpoint** — a spike in total login failures is itself the signature of a stuffing campaign; trip stricter controls (CAPTCHA, Attack Mode) above a baseline.
- **By device fingerprint / behavioral signals** — since IPs rotate.

Implementation notes: use a **token-bucket or sliding-window** counter in a shared fast store (e.g. Redis) so it holds across horizontally-scaled instances; fail *closed* (deny) if the limiter is unavailable for auth; return `429` with `Retry-After`; and don't leak whether the account exists in the throttle response. Rate limiting is a *slowing* control — pair it with MFA and breach screening, which actually neutralize stolen credentials rather than just slowing their use.

### Q15. What's the risk of storing the "remember me" token, and how do you do it safely?

"Remember me" creates a **long-lived persistent credential** — often 30+ days — which is a fat target: steal it and you have a durable login bypassing the whole auth flow, including MFA if you're not careful.

Do it safely:

- **Don't store the raw token in the DB** — treat it like a password: store a **hash** of it, so a DB leak doesn't hand out live tokens.
- **Use the "selector + validator" split** — a lookup ID (selector) plus a secret (validator) that's hashed; look up by selector, compare hashed validator in constant time.
- **Random, high-entropy, single-series-per-device** tokens; **rotate on each use** so a stolen-then-reused token can be detected (theft detection: if an old validator reappears, invalidate the whole series).
- **Bind to device where possible**, set `HttpOnly`/`Secure`/`SameSite`, and give it an **absolute expiry**.
- **Re-authenticate (step-up) for sensitive actions** — a "remember me" session should grant browsing, not password changes or payments without a fresh proof.

### Q16. Design end-to-end secure authentication for a new web service. Walk me through it.

I'd structure it by the three phases and layer defenses:

**Enrollment / storage.** Passwords hashed with **Argon2id** (per-user salt embedded, work factor ~250-500ms, optional pepper in KMS). Enforce NIST policy: 8+ char minimum, no composition rules, **screen against breached-password lists**, allow long passphrases and paste.

**The auth event.** Offer **passkeys / WebAuthn as the primary factor** (phishing-resistant, passwordless) with password + **TOTP MFA** as the fallback — explicitly *not* SMS unless unavoidable. Uniform error messages and constant-time checks to prevent **enumeration**. **Rate limit** per-account + per-IP + global, with progressive backoff and CAPTCHA on anomaly. Risk-based step-up (new device/geo → require MFA).

**Session continuity.** On success, **regenerate the session ID** (anti-fixation). Prefer opaque, server-side, revocable sessions; if JWTs, keep them short-lived with rotating refresh tokens. Cookies `HttpOnly` + `Secure` + `SameSite=Lax`. Idle + absolute timeouts. Server-side invalidation on logout.

**Recovery.** Single-use, short-lived, high-entropy reset tokens over a fixed base URL (no Host-header poisoning); require the second factor to complete recovery; out-of-band notification on any reset or password change; recovery codes / backup passkey for lost devices.

**Cross-cutting.** All over TLS (**HSTS**). Security logging of auth events (success/failure/lockout/MFA) — but never log passwords or tokens — feeding anomaly detection and incident response. Everything behind this only *establishes identity*; every downstream request still enforces **authorization** server-side.

## Authorization & Access Control

### Summary

**What this topic covers**

Authorization decides *what an authenticated identity is allowed to do* — it runs *after* authentication and is, per the current OWASP Top 10, the **#1 web application risk (Broken Access Control)**. This topic covers the foundational **authN-vs-authZ** distinction interviewers open with; the three canonical access-control models — **RBAC** (roles), **ABAC** (attributes/policies), and **ACL** (per-object permission lists) — and when each fits; the **principle of least privilege** and **deny-by-default** as the design defaults; **privilege escalation** in its two forms, vertical (become an admin) and horizontal (become another user at the same level); the single most common concrete access-control bug, **IDOR / BOLA** (Broken Object-Level Authorization), with a vulnerable-vs-fixed pair; the **confused deputy** problem that explains *why* server-side, per-request checks are non-negotiable; externalized **policy engines** (OPA) for consistent decisions; and the two rules that prevent most real breaches — **always enforce authorization server-side** and **deny by default**. The 16 questions run from "what's the difference between authN and authZ" to "design an authorization system for a multi-tenant SaaS."

**Mental model**

Every request is a claim: *"this identity wants to perform this action on this resource."* Authorization is the gate that evaluates that triple — **subject × action × object** — and returns allow or deny, on *every* request, on the *server*. Two failure modes dominate. **(1) Function-level** — the user reaches an operation they shouldn't (a regular user hits `/admin`). **(2) Object-level** — the user performs a legitimate operation but on someone *else's* resource (`GET /orders/1002` when they own `1001`). Object-level is the sneaky one because the endpoint and action are perfectly valid — only the *ownership* check is missing, and it's missing per-object, so it hides behind working happy-path tests. The mental discipline: authorization is not a login gate you pass once; it's re-evaluated at the point of *every* resource access, and the check must compare the *authenticated* identity (from the trusted session, never from a request parameter) against the specific object being touched. Assume every ID in a URL will be tampered with, and default to deny.

**Key terms**

- **Authentication (authN)** — proving *who* you are. **Authorization (authZ)** — deciding *what you may do*. AuthN first, then authZ.
- **RBAC** — Role-Based Access Control: permissions attach to roles, roles attach to users.
- **ABAC** — Attribute-Based Access Control: decisions from attributes of subject, resource, action, and environment, expressed as policies.
- **ACL** — Access Control List: a per-object list of which subjects have which permissions on *that* object.
- **Least privilege** — grant the minimum access needed for the task, nothing more.
- **Deny by default** — absence of an explicit grant means denied; the safe default.
- **Privilege escalation** — gaining rights beyond those assigned: **vertical** (to a higher level, e.g. user→admin) or **horizontal** (to a peer's resources).
- **IDOR / BOLA** — Insecure Direct Object Reference / Broken Object-Level Authorization: accessing an object by its identifier without an ownership/permission check.
- **Confused deputy** — a privileged component tricked into misusing its authority on behalf of a less-privileged caller.
- **Policy engine / OPA** — externalized decision service (e.g. Open Policy Agent + Rego) that centralizes authz logic away from app code.
- **Multi-tenancy** — many customers' data in one system; tenant isolation is an authorization boundary.
- **PEP / PDP** — Policy Enforcement Point (where the check is enforced) vs Policy Decision Point (where the decision is computed).

**Why interviewers ask this**

Broken Access Control is #1 on the OWASP Top 10 for a reason: it's the most common serious bug in real apps, it's business-logic-specific (no library fully solves it), and it's invisible to the happy path — so it's a superb interview probe. Juniors treat authorization as "check the user is logged in" and stop at role checks; they miss that a logged-in user can still access *other users'* objects (IDOR/BOLA). Seniors immediately separate authN from authZ, distinguish function-level from object-level checks, insist the identity comes from the *server-side session* not a client parameter, and reach for deny-by-default. The "spot the IDOR" and "design authorization for multi-tenant SaaS" questions reveal whether you can reason about *every request re-evaluated against the specific object*, tenant isolation, and where to enforce (server, not client). Mentioning least privilege, confused deputy, and externalized policy (OPA) signals depth.

**Common confusions**

- "If you're authenticated, you're authorized." No — authN is a prerequisite, not a grant. Authenticated users still need per-action, per-object checks.
- "Hiding the admin button is access control." That's client-side *obscurity*. The endpoint is still reachable directly; enforcement must be server-side.
- "RBAC solves everything." Roles explode combinatorially for fine-grained/contextual rules (owner-only, time-based, tenant-scoped) — that's where ABAC/ReBAC come in.
- "IDOR needs a role check." No — the user often has the right *role*; what's missing is the *ownership* check on the specific object.
- "Sequential IDs cause IDOR." Guessable IDs make it *easier*, but UUIDs don't fix it — the missing authorization check is the bug, not the ID format.
- "Authorization can be done on the frontend for speed." Never as the enforcement point — the client is attacker-controlled. Client checks are UX only.

**What follows from this topic**

Authorization consumes the identity that **Authentication** established — the two are a pipeline and interviewers probe the seam constantly. Broken Access Control is #1 in the **OWASP Top 10** covered elsewhere; IDOR/BOLA is also the top item in the API-security list of the companion API primer, so cross-reference rather than duplicate. The "enforce server-side" rule connects to why client-side validation is never a security control (see Injection and the general never-trust-the-client principle). Multi-tenant isolation ties into cloud/data security. And least privilege recurs everywhere — IAM roles, DB accounts (see Injection), container capabilities, secrets access.

### Q1. What's the difference between authentication and authorization?

**Authentication (authN)** answers *"who are you?"* — verifying identity (password, passkey, token). **Authorization (authZ)** answers *"what are you allowed to do?"* — deciding whether that verified identity may perform a given action on a given resource.

Order matters: **authN first, authZ second.** You establish identity, then gate every action against it. A mnemonic: authN is the bouncer checking your ID at the door; authZ is the wristband that says which rooms you can enter.

They fail differently and are fixed differently. An authN failure lets the wrong *person* in (weak passwords, no MFA). An authZ failure lets the *right person do the wrong thing* (a user reading another user's records). Conflating them is the classic junior tell — and the seam between them is where real bugs live: being authenticated is *not* being authorized, so every request still needs its own authorization decision.

### Q2. Compare RBAC, ABAC, and ACL. When would you use each?

| | ACL | RBAC | ABAC |
|---|---|---|---|
| Grants based on | Per-object subject list | User's role(s) | Attributes (subject, resource, action, env) |
| Granularity | Per-object | Per-role/permission | Arbitrary, contextual |
| Example | "alice can read file X" | "editors can publish" | "allow if `user.dept == doc.dept` and time is business hours" |
| Scales well when | Few objects, explicit sharing | Stable job functions | Fine-grained/contextual rules |
| Pain point | Explodes with many objects | Role explosion for combos | Policy complexity, harder to audit |

- **ACL** — a list attached to each object naming who can do what. Great for explicit sharing (filesystem permissions, "share this doc with bob"). Doesn't scale when you have millions of objects and broad rules.
- **RBAC** — permissions bundle into roles; assign roles to users. The workhorse for apps with clear job functions (admin, editor, viewer). Simple to reason about and audit; suffers **role explosion** when you need many contextual variants.
- **ABAC** — decisions computed from attributes and expressed as policies. Handles "owner-only," "same tenant," "manager of the requester," time/location rules — things RBAC can't without inventing a role per case. More powerful, but policies get complex and harder to audit.

Many real systems combine them: RBAC for coarse function-level access + ABAC/ownership checks for object-level (e.g. "editors can edit *their own* org's docs"). **ReBAC** (relationship-based, à la Google Zanzibar) is a fourth model for graph-shaped permissions.

### Q3. What is the principle of least privilege, and where does it apply?

**Least privilege**: every subject — user, service, process, token — gets the **minimum** access required to do its job, and nothing more. It shrinks the blast radius: if any component is compromised, the attacker inherits only its narrow rights, not the keys to everything.

It applies at every layer:

- **Users** — a support agent can read tickets, not delete the database.
- **Application DB accounts** — the app connects with a user that can `SELECT/INSERT/UPDATE` on its tables, not `DROP` or superuser (this also limits injection damage).
- **Service-to-service** — each microservice gets scoped credentials, not a god token.
- **Cloud IAM** — roles scoped to specific resources/actions, not `*:*`.
- **Containers** — run non-root, drop Linux capabilities.
- **OAuth scopes** — request only the scopes the feature needs.

The corollary is **deny by default** — start from zero and grant explicitly. It's easier to add a needed permission after a legitimate failure than to discover, post-breach, that everything was permitted.

### Q4. What is deny-by-default, and why does it matter more than it sounds?

**Deny by default** means the *absence* of an explicit allow is treated as a deny — the system fails closed. The alternative, allow-by-default (deny only what's explicitly blacklisted), is a security disaster because you can never enumerate every dangerous case: any new endpoint, resource, or role you forget to blacklist is *open*.

It matters because software grows. With deny-by-default, a new endpoint added next quarter is **inaccessible until someone grants access** — a safe failure. With allow-by-default, that same endpoint is **exposed until someone remembers to lock it** — and people forget. The same logic drives:

- **Default-deny firewall rules** (whitelist allowed traffic).
- **CORS** — no `Access-Control-Allow-Origin` means blocked.
- **Route guards** that require an explicit permission annotation, failing shut if none is present.

The design test: "if a developer forgets to add an authorization check, does the request get denied or allowed?" It must be *denied*. Frameworks that require opt-*in* access (deny by default) prevent whole classes of Broken Access Control bugs that opt-*out* frameworks invite.

### Q5. Explain vertical vs horizontal privilege escalation.

**Privilege escalation** = gaining access beyond what you were granted. Two directions:

- **Vertical** — moving to a *higher* privilege level. A regular user gains admin rights: hitting `/admin/deleteUser` that only checks *authentication* not *role*, or exploiting a bug that grants elevated permissions. This is the "become an admin" case.
- **Horizontal** — moving *sideways* to a peer's resources at the *same* privilege level. User A reads User B's invoices — same role, different owner. **IDOR/BOLA is the canonical horizontal escalation.**

```
Vertical:   user  ─────►  admin        (gain higher rights)
Horizontal: userA ──►  userB's data     (same rights, other owner)
```

Both are Broken Access Control. Vertical is often caught because "admin" is an obvious boundary people test; horizontal slips through because every action is legitimate for *some* user — only the ownership scoping is wrong. Defenses: role/permission checks for vertical, and **per-object ownership checks** (resolve the object scoped to the current user) for horizontal.

### Q6. What is IDOR / BOLA? Show a vulnerable example and the fix.

**IDOR** (Insecure Direct Object Reference), a.k.a. **BOLA** (Broken Object-Level Authorization), is accessing an object by its identifier **without verifying the requester is allowed that specific object**. The endpoint and action are valid; the *ownership check* is missing.

```javascript
// ❌ Vulnerable: fetches by the id in the URL, no ownership check.
// GET /api/orders/1002 returns anyone's order — swap the id, read others'.
app.get('/api/orders/:id', requireAuth, async (req, res) => {
  const order = await db.orders.findById(req.params.id);
  res.json(order);
});

// ✅ Fixed: scope the lookup to the authenticated user (from the session,
// never from a request parameter). Non-owned ids simply return 404.
app.get('/api/orders/:id', requireAuth, async (req, res) => {
  const order = await db.orders.findOne({
    id: req.params.id,
    userId: req.user.id,          // trusted identity from the session
  });
  if (!order) return res.sendStatus(404);
  res.json(order);
});
```

The fix's essence: **always constrain the query by the authenticated owner**, and take the identity from the trusted session, not from any client-supplied field. Note the fixed version returns `404` (not `403`) to avoid confirming the object exists. IDOR is OWASP's #1 web risk and the top API-security risk — it's ubiquitous because the missing check is per-object and invisible to happy-path tests.

### Q7. Does switching from sequential IDs to UUIDs fix IDOR?

No — and believing it does is a dangerous half-measure. UUIDs make object identifiers *unguessable*, which raises the effort to *find* other objects, but **the vulnerability is the missing authorization check, not the ID format**. If the server still returns any object whose ID you present, the object reference is still insecure — the attacker just needs to *obtain* valid UUIDs, which leak constantly: from referrer headers, logs, shared links, other API responses, browser history, or a former collaborator who still knows the ID.

UUIDs are **defense in depth** (good — use them, they prevent trivial enumeration), but the **primary fix is the server-side ownership check**: resolve every object scoped to the authenticated user and deny (404) anything they don't own. "We use UUIDs so we're safe from IDOR" is exactly the kind of statement an interviewer wants you to correct.

### Q8. What is the confused deputy problem?

A **confused deputy** is a program with legitimate elevated privileges that gets *tricked by a less-privileged caller* into misusing those privileges on the caller's behalf. The deputy has the authority; the attacker supplies the target; the deputy fails to check whether *this caller* should be allowed *this target*.

Classic examples:

- **CSRF is a confused-deputy attack** — the browser (deputy, holding the victim's session cookie) is tricked by an attacker's page into sending an authenticated request the user never intended.
- **SSRF** — the server (deputy, sitting inside the trusted network) is tricked into fetching an attacker-chosen internal URL it shouldn't reach.
- A backup service running as root that will archive any path a user names.

The fix is to make the deputy check **authority per request, not per capability** — the decision must consider *who* is asking and *whether they specifically* may act on the requested target, rather than "I have permission, so I'll do it." Capability-based security (unforgeable tokens that bundle the right *with* the reference) is one structural answer; in practice it means passing and checking the *caller's* authorization, not just the deputy's.

### Q9. Where must authorization checks be enforced, and why not the client?

**On the server, on every request, at the point of resource access — never as the enforcement point on the client.** The client (browser, mobile app) is entirely attacker-controlled: they can open dev tools, replay requests in `curl`/Postman, modify JS, and bypass any UI. Hiding an admin button or disabling a field is **UX, not security** — the underlying endpoint is still directly reachable.

```
Client-side "check":  hide /admin button   → attacker just calls POST /admin/deleteUser directly
Server-side check:    endpoint verifies req.user has 'admin' before acting  → actually enforced
```

Concretely: every endpoint independently verifies (a) the caller's *function-level* rights (role/permission for this action) and (b) *object-level* rights (they own/may access this specific resource), using identity from the trusted session. This is also why you can't trust a JWT's claims blindly if the token is client-held without integrity — and why authorization can't live only in an API gateway if individual services are directly reachable. Client checks are fine to *improve UX* (don't show what won't work); they must never be the thing standing between an attacker and the data.

### Q10. What are policy engines like OPA, and when would you use one?

A **policy engine** externalizes authorization decisions out of scattered app code into a dedicated, declarative policy that a central engine evaluates. **Open Policy Agent (OPA)** is the common one, with policies written in **Rego**; others include Cedar (AWS) and OpenFGA/Zanzibar-style systems.

The split is **PEP vs PDP**: your service is the **Policy Enforcement Point** (it asks and enforces the answer), OPA is the **Policy Decision Point** (it evaluates the policy and returns allow/deny). Your code says `is this allowed?`, passing the subject/action/resource/context; the engine answers.

Use one when:

- Authorization logic is **duplicated across many services** and drifting — centralizing gives one consistent, testable source of truth.
- You need **fine-grained/contextual (ABAC-style)** rules that role checks scattered in code can't express cleanly.
- You want authz **decoupled from deployment** — security teams update policy without shipping app code, and policy is version-controlled, testable, and auditable.

Tradeoffs: a network hop / sidecar and operational complexity; you still enforce the *answer* in the service (the PEP). For a small app, in-code checks are simpler; OPA earns its keep at scale and across polyglot services.

### Q11. How do you design authorization for a multi-tenant SaaS?

The governing rule: **tenant isolation is an authorization boundary, and every data access must be scoped to the caller's tenant, enforced server-side, deny-by-default.** The nightmare bug is cross-tenant data leakage — Acme reading Globex's records.

Design points:

- **Every query carries the tenant ID from the trusted session/token**, and *every* data access filters by it: `WHERE tenant_id = :currentTenant`. Never take the tenant from a client parameter.
- **Enforce it structurally, not by discipline** — e.g. a mandatory query layer / ORM scope / row-level security (Postgres RLS) so a developer *can't* forget the tenant filter. Relying on every hand-written query to remember it is how leaks happen.
- **Two tiers of role**: tenant-scoped roles (admin *within* Acme) plus the object-level ownership checks *inside* the tenant.
- **Deny by default** — a request with no resolvable tenant is rejected.
- **Test with cross-tenant probes** — automated tests that authenticate as tenant A and try tenant B's IDs, expecting 404/403.
- Consider **database-per-tenant** or schema isolation for high-assurance/regulated tenants; shared-schema-with-tenant-column is cheaper but leans entirely on that filter being airtight.

Layer least privilege throughout: services and DB accounts scoped so a compromise can't cross tenants either.

### Q12. A logged-in user changes `?role=admin` in a request and gains admin access. What went wrong?

The server **trusted a client-supplied value as an authorization decision**. Authorization must be derived from the *server-side* identity and the server's own record of that user's roles — never from a request parameter, hidden form field, cookie the client can edit, or unverified header.

```
Bad:  if (request.param('role') === 'admin') { ... }   // client controls it
Good: if (session.user.roles.includes('admin')) { ... } // server-side source of truth
```

This is **mass-assignment / parameter tampering** feeding vertical privilege escalation. Related instances: an editable `isAdmin` field auto-bound from the request body into the user object, a `user_id` in the body overriding the session user, or a client-set JWT claim trusted without verifying the token's signature/issuer. Fixes: take roles/identity from the trusted session (or a *verified* token), never bind privilege fields from user input (allowlist bindable fields), and re-check authorization server-side on every action.

### Q13. What's the difference between function-level and object-level authorization? Why do you need both?

- **Function-level** (a.k.a. operation-level): *may this user perform this kind of action at all?* — "can a `viewer` call `DELETE /posts`?" A role/permission check on the operation.
- **Object-level**: *may this user perform it on this specific resource?* — "this `editor` can delete posts, but can they delete *post #42*, which belongs to another org?" An ownership/relationship check on the instance.

You need both because they catch different escalations. Function-level alone stops a viewer from deleting *anything*, but lets an editor delete *everyone's* posts — horizontal escalation / BOLA. Object-level alone lets a viewer touch objects they "own" but shouldn't be able to delete at all. OWASP even splits them: **Broken Function-Level Authorization (BFLA)** and **Broken Object-Level Authorization (BOLA)** are separate API risks. Robust authorization = check the *action* is permitted for the role **and** the *specific object* is permitted for that user, on every request.

### Q14. How do you prevent Broken Access Control, the OWASP #1 risk?

Broken Access Control is #1 because it's common, high-impact, and business-logic-specific. A layered prevention checklist:

- **Deny by default** — no explicit grant means denied; new endpoints are locked until opened.
- **Enforce server-side on every request** — never rely on hidden UI or client checks.
- **Centralize the mechanism** — one reusable authorization layer/middleware rather than ad-hoc `if` checks copy-pasted per endpoint (which drift and get forgotten).
- **Object-level ownership checks** — scope every resource query to the authenticated user/tenant (kills IDOR/BOLA).
- **Least privilege + role checks** for function-level access.
- **Don't trust client-supplied identity/role/tenant** — derive from the session or a verified token; guard against mass assignment.
- **Rate-limit and log access-control failures**, and alert on spikes (probing signature).
- **Test it** — automated tests that attempt cross-user and cross-role access and assert denial; include IDOR probes in security review.
- Disable **directory listing**, protect metadata/backup files, and invalidate tokens/sessions on logout.

The throughline: make the safe path the *default* and the check *impossible to forget*, because the bug is almost always an *omitted* check, not a wrong one.

### Q15. What is "step-up" authorization, and when do you use it?

**Step-up** (or re-authentication / elevation) requires a *stronger or fresher* proof of identity before a *sensitive* action, even for an already-logged-in user. The insight: not all actions carry equal risk, so authorization can be **contextual to the operation's sensitivity**, not a one-time gate at login.

Use it for high-impact operations:

- Changing password, email, or MFA settings.
- Adding a payee / making a large payment / transferring funds.
- Deleting an account or exporting all data.
- Accessing an admin console from an ordinary session.

Typical implementations: re-prompt for the password, require a fresh MFA/TOTP/passkey challenge, or check the *age* of the session ("authenticated within the last 5 minutes"). This limits the damage from a hijacked-but-idle session or a "remember me" login — a stolen session cookie can browse, but can't drain the account without passing the step-up. It's the authorization-side complement to session management: sensitive actions demand recent, strong authentication.

### Q16. How would you audit an existing application for authorization flaws?

I'd combine code review, testing, and tooling, targeting the *omitted check*:

**Map the surface.** Enumerate every endpoint/operation and, for each, the intended subject × action × object rules. Gaps between "what's documented" and "what's enforced" are where bugs hide.

**Code review for the pattern, not just presence.** Look for endpoints that fetch by a client-supplied ID *without* scoping to the authenticated user (IDOR/BOLA); authorization derived from client input (`req.body.role`, editable JWT claims, mass assignment); admin/function checks missing on privileged routes; and any authz done only in the UI. Prefer finding a *centralized* enforcement layer — scattered per-endpoint `if`s are a smell.

**Dynamic testing.** Authenticate as a low-priv user and try privileged endpoints (vertical). Authenticate as user A and request user B's object IDs — sequential *and* harvested UUIDs — expecting 404/403 (horizontal/BOLA). In multi-tenant apps, run cross-tenant probes. Tamper with roles/tenant params. Tools like Burp's Autorize automate "replay this request as a different user and diff the response."

**Tooling & process.** SAST/DAST flags some patterns but authz logic is app-specific, so it needs manual/business-logic review and abuse-case testing. Add **regression tests** that assert denial for cross-user/cross-role access so fixed IDORs don't reappear. Verify **deny-by-default** by adding a probe endpoint with no explicit grant and confirming it's inaccessible.

## Web Security: Injection

### Summary

**What this topic covers**

Injection is what happens when **untrusted input is interpreted as code/commands** because it was mixed into a query or command string instead of being kept strictly as *data*. This topic centers on **SQL injection** — how it works conceptually and its definitive fix, **parameterized queries / prepared statements** (with ORMs as the common safe abstraction) — shown as a vulnerable-vs-fixed pair. It generalizes to the whole injection family: **OS command injection**, **NoSQL injection**, **LDAP** and **XPath injection**, and the ORM-layer gotchas that reintroduce the bug even when you "used an ORM." The through-line is the *root cause* — **string concatenation that blurs the code/data boundary** — and the correct hierarchy of defenses: **separate code from data (parameterization) as the primary fix**, with **input validation and output/escaping as defense-in-depth, not the primary control**, plus supporting mitigations — **least-privilege database accounts**, careful use of stored procedures, and allowlisting for the parts that genuinely can't be parameterized (identifiers). Injection sits at #3 on the OWASP Top 10. The 15 questions run from "what is SQL injection and how do you stop it" to "audit a data-access layer for injection across SQL, NoSQL, and shell."

**Mental model**

Every injection is the same bug wearing different clothes: a program builds a *string* — a SQL statement, a shell command, an LDAP filter — by **concatenating trusted template text with untrusted input**, then hands the whole string to an interpreter. The interpreter can't tell which parts the developer *meant* as structure (keywords, quotes, operators) and which arrived from the user; if the user's data contains characters that *are* structure in that language (`'`, `;`, `--`, `$`, `|`, `)`), it changes the meaning of the command. The fix is always the same idea: **keep code and data in separate channels** so the interpreter is told the structure *up front* and the user input can only ever land in a *value slot*, never be parsed as syntax. For SQL that's a prepared statement with bound parameters; for shell it's passing an argument *array* to `exec` instead of a string to a shell; for LDAP/XPath it's the API's escaping/parameter facility. The wrong mental model — "I'll strip out the bad characters" — is a losing game of blacklists; the right one is "the input is never parsed as code in the first place."

**Key terms**

- **Injection** — untrusted input interpreted as code/commands by mixing it into a command string.
- **SQL injection (SQLi)** — injecting SQL syntax via input concatenated into a query; can read/modify/destroy data or bypass authentication.
- **Parameterized query / prepared statement** — the query structure is sent with placeholders (`?`, `$1`, `:name`); values are bound *separately* and can never become syntax. The primary fix.
- **ORM** — Object-Relational Mapper; parameterizes by default, but raw-query and interpolation escape hatches reintroduce SQLi.
- **Command injection** — user input reaches an OS shell, letting attackers run arbitrary commands (`;`, `|`, `` ` ``, `$()`).
- **NoSQL injection** — injecting operators/objects (e.g. `{"$ne": null}`) into document-DB queries, often via unparsed JSON.
- **LDAP injection** — injecting filter syntax (`*`, `)`, `(`) into an LDAP query, e.g. to bypass auth.
- **XPath injection** — injecting into an XPath expression that queries XML.
- **Input validation** — checking input conforms to expected format; *defense in depth*, not the primary injection fix.
- **Output escaping / encoding** — neutralizing characters for a target context; the primary fix for *XSS*, a secondary one here.
- **Least-privilege DB account** — the app's DB user has only the rights it needs, limiting what a successful SQLi can do.
- **Blind SQLi** — no direct output; the attacker infers data from boolean responses or time delays.

**Why interviewers ask this**

Injection is a canonical, decades-old vuln that *still* tops breach reports, so it's a fast read on whether a candidate understands the *why*, not just a memorized rule. The tell-tale junior answer is "sanitize the input" or "escape the quotes" — treating injection as a filtering problem. The senior answer names the **root cause (mixing code and data)**, gives the **primary fix as parameterization/prepared statements** that structurally separate the two, and correctly *demotes* input validation to defense-in-depth. Strong candidates also know the fix generalizes (command injection → argument arrays, not shells; NoSQL → don't pass unparsed objects into query operators), spot the **ORM escape hatches** that reintroduce SQLi, add **least-privilege DB accounts** to cap the blast radius, and handle the one thing parameters *can't* bind — table/column identifiers — with an allowlist. The live-fire question is "spot the vulnerability and fix it," where they want to see you reach for bound parameters, not a `replace("'", "''")`.

**Common confusions**

- "Escaping/sanitizing input is the fix." It's fragile and secondary. **Parameterization** is the primary fix; blacklist escaping misses encodings and edge cases.
- "Using an ORM makes me immune." Only until someone calls `raw()` or string-interpolates into a query builder — ORMs have escape hatches that reintroduce SQLi.
- "Input validation stops injection." It reduces surface (defense in depth) but a valid-looking value (`O'Brien`) can still break a concatenated query; validation is not a substitute for parameterization.
- "Stored procedures are automatically safe." Only if they don't themselves build dynamic SQL via concatenation internally.
- "Prepared statements can parameterize anything." No — you can bind *values*, not identifiers (table/column names) or keywords; those need an allowlist.
- "It's only SQL." The same bug hits shell commands, LDAP, XPath, NoSQL, XML, and more — same root cause, same class of fix.
- "NoSQL databases don't have injection." They do — operator injection via unparsed input (`{"$gt": ""}`) is a real, common bug.

**What follows from this topic**

Injection is #3 in the **OWASP Top 10** and the archetype of the never-trust-input principle that also underpins **XSS** (where the fix is context-aware *output encoding*, not input parameterization — a deliberate contrast) and the broader input-handling topics. The **least-privilege DB account** mitigation is the database face of the least-privilege principle from **Authorization**. Command injection connects to the **memory-safety / OS** material and SSRF (server tricked into acting). And the "keep code and data separate" mental model recurs in template injection (SSTI), XXE, and insecure deserialization elsewhere in the primer — all variants of untrusted data crossing into an execution context.

### Q1. What is SQL injection and how does it work?

**SQL injection** is when untrusted input is concatenated into a SQL statement, letting an attacker inject SQL *syntax* that changes the query's meaning. The database can't distinguish the developer's intended structure from user-supplied characters that happen to be SQL syntax.

Classic authentication bypass — the app builds a login query by string concatenation:

```sql
-- App does: "SELECT * FROM users WHERE user = '" + input + "' AND pass = '" + pw + "'"
-- Attacker enters username:  alice' --
-- Resulting query:
SELECT * FROM users WHERE user = 'alice' --' AND pass = '...'
```

The injected `'` closes the string early and `--` comments out the rest — the password check vanishes, and the attacker logs in as `alice`. Other payloads use `UNION SELECT` to exfiltrate data from other tables, `; DROP TABLE` to destroy data, or **blind** techniques (boolean/time-based) to extract data one bit at a time when there's no direct output.

The essence: user data crossed the boundary from *value* into *code*. The fix (next question) removes that boundary crossing entirely.

### Q2. How do you fix SQL injection? Show the vulnerable and fixed code.

The primary fix is **parameterized queries / prepared statements**: send the query *structure* with placeholders, and bind the user values *separately*, so they can never be parsed as SQL syntax.

```python
# ❌ Vulnerable: user input concatenated into the SQL string
query = "SELECT * FROM users WHERE email = '" + email + "'"
cursor.execute(query)

# ✅ Fixed: parameterized — the driver sends structure and values separately.
# The value can never become SQL syntax, even if it contains quotes/semicolons.
cursor.execute("SELECT * FROM users WHERE email = %s", (email,))
```

Why it works: with a prepared statement the database receives the query template *first* and compiles its structure, *then* receives the parameter values — which are treated purely as data bound into value slots. There is no string for the attacker's `' OR 1=1 --` to break out of; it just becomes a (nonexistent) email literally containing those characters.

This is not escaping — nothing is being cleaned. The code/data channels are *structurally separate*. Every mainstream driver and ORM supports it (`?`, `$1`, `:name`, `%s` placeholders). Use it for **every** query that includes external input, without exception.

### Q3. Why is string concatenation the root cause of injection, not "bad input"?

Because the vulnerability is created the moment you **build a command by concatenating structure and data into one string** — the "bad input" only *exploits* a boundary you already erased. When you write `"... WHERE id = " + input`, you've handed the interpreter a single string and asked it to figure out which parts are code; any input that contains syntax characters will be *correctly* parsed as syntax by a working interpreter. The input isn't malformed from the database's view — it's doing exactly what SQL says those characters do.

This reframing matters because it points at the right fix. If the problem were "bad input," the fix would be filtering — an endless, leaky blacklist (encodings, Unicode, valid-but-dangerous values like `O'Brien`). Because the real problem is *the concatenation that mixes code and data*, the fix is to **never concatenate** — use a mechanism (bound parameters) that keeps the two channels separate so input *cannot* be interpreted as code regardless of its contents. Fix the boundary, not the input.

### Q4. Is input validation enough to stop injection? Where does it fit?

No — **input validation is defense in depth, not the primary fix.** It's valuable but insufficient on its own, and treating it as *the* solution is a classic mistake.

Why it's not enough:

- Many legitimate values contain dangerous characters — `O'Brien`, `1; DROP` inside a free-text comment, an email with a quote. You can't reject all of them without breaking real users.
- Blacklist filtering is endlessly evadable (encodings, case, Unicode, whitespace tricks).
- Even perfectly validated input can break a concatenated query if you didn't parameterize.

Where it *does* fit: as an **allowlist** of expected format ("this field must be a positive integer," "this must be one of these enum values"), it shrinks the attack surface and catches obviously malicious input early. It's essential for the things parameters *can't* handle — validating/allowlisting **identifiers** (table/column/sort-direction) that can't be bound. So: **parameterize as the primary control, validate (allowlist) as a complementary layer.** Both, in that priority order.

### Q5. Does using an ORM protect you from SQL injection? What are the gotchas?

Mostly yes, by default — ORMs and query builders parameterize the queries they generate, so ordinary `User.find({ email })`-style calls are safe. But an ORM is **not automatic immunity**; it has escape hatches that reintroduce SQLi the instant you use them wrong:

```python
# ❌ Raw query with interpolation — SQLi, ORM or not
User.objects.raw("SELECT * FROM users WHERE name = '%s'" % name)
db.query(f"SELECT * FROM users WHERE id = {user_id}")   # f-string into raw SQL

# ✅ Parameterized even in raw mode
User.objects.raw("SELECT * FROM users WHERE name = %s", [name])
```

The common gotchas:

- **`.raw()` / `.rawQuery()` / `execute()`** with string-interpolated input.
- **String interpolation into a query-builder fragment** (`.where("age > " + n)` instead of `.where("age > ?", n)`).
- **Ordering/identifier by user input** — `ORDER BY {col}` can't be parameterized, so it's often concatenated → inject via an allowlist of permitted columns instead.
- **`LIKE`/JSON/array operators** where the escaping burden shifts to you.

So the rule is: ORMs help, but **audit every raw/interpolated path**, and never assume "we use an ORM" ends the conversation.

### Q6. What is command injection and how do you prevent it?

**Command (OS) injection** is injection's shell cousin: user input reaches a system shell, letting the attacker append or alter OS commands. Shell metacharacters (`;`, `|`, `&&`, `` ` ``, `$()`) turn one command into many.

```python
# ❌ Vulnerable: input goes to a shell that interprets metacharacters
# filename = "x.txt; rm -rf /important"  → runs the rm too
os.system("cat " + filename)
subprocess.run(f"convert {filename} out.png", shell=True)

# ✅ Fixed: pass an argument array, no shell — input is a single literal arg
subprocess.run(["cat", filename])          # shell=False (default)
subprocess.run(["convert", filename, "out.png"])
```

The fix mirrors SQL parameterization: **don't build a command string for a shell — pass the program and its arguments as a separate array (`execve`-style), with no shell involved.** Then the filename is exactly one argument, and `; rm -rf` inside it is just a weird filename, not extra commands.

Additional layers: avoid invoking the shell at all where a native library call works (read the file in-process instead of `cat`); if you *must* pass to a shell, allowlist-validate the input; and run with least privilege so even a successful injection is contained.

### Q7. What is NoSQL injection? Give an example.

Yes, NoSQL databases have injection too — it just uses **operators and object structure** instead of SQL syntax. It commonly happens when an app passes **unparsed user input (often JSON) directly into a query**, letting the attacker smuggle in query operators.

```javascript
// ❌ Vulnerable: request body spread straight into the query.
// Normal login: { user: "alice", pass: "secret" }
// Attack body:  { user: "alice", pass: { "$ne": null } }
//  → "password not equal to null" is true → auth bypass
db.users.findOne({ user: req.body.user, pass: req.body.pass });

// ✅ Fixed: coerce to expected primitive types + validate, so operator
// objects can't reach the query. (And check a HASHED password, not ==.)
const user = String(req.body.user);
const pass = String(req.body.pass);
const record = await db.users.findOne({ user });
if (record) await verifyHash(pass, record.passwordHash);
```

The attacker replaces a string value with an operator object like `{"$ne": null}`, `{"$gt": ""}`, or a `$where` JavaScript expression, changing the query's logic. Prevention: **enforce expected types** (cast to string/number), **validate input schemas**, never pass raw request objects into queries, and disable server-side JS evaluation (`$where`) where possible.

### Q8. What are LDAP and XPath injection?

Both are the same code-vs-data bug in different query languages:

- **LDAP injection** — user input concatenated into an LDAP **search filter**. Filters use parentheses and operators: `(&(user=alice)(pass=secret))`. Injecting `*` or extra filter clauses can bypass authentication or widen a search. Example: a username of `*)(uid=*))(|(uid=*` can turn a targeted lookup into "match everything," bypassing the intended constraint.

- **XPath injection** — user input concatenated into an **XPath** expression that queries an XML document (e.g. an XML-based user store). Injecting `' or '1'='1` into `//user[name='INPUT' and pass='...']` makes the predicate always true — the XML analog of SQL auth bypass.

Prevention is the same family of fix as SQLi:

- Use the API's **parameterized/escaping facility** — LDAP libraries offer filter-encoding functions that escape the special characters (`*`, `(`, `)`, `\`, NUL) per RFC 4515; XPath libraries support variable binding (`XPathVariableResolver`) so input is a bound value, not expression syntax.
- **Allowlist-validate** input where the format is known.
- Never build the filter/expression by raw string concatenation.

### Q9. Are stored procedures a defense against SQL injection?

Not automatically — it depends on *how the procedure is written*. A stored procedure is safe against injection **only if it uses parameters and does not itself build dynamic SQL by concatenating those parameters into a string** internally.

```sql
-- ❌ Vulnerable stored proc: builds dynamic SQL from the parameter
CREATE PROCEDURE getUser(@name VARCHAR(50)) AS
  EXEC('SELECT * FROM users WHERE name = ''' + @name + '''');  -- concatenation!

-- ✅ Safe: parameter used directly, no dynamic string building
CREATE PROCEDURE getUser(@name VARCHAR(50)) AS
  SELECT * FROM users WHERE name = @name;
```

The myth is that "using a stored procedure" is inherently safe. It's not — if the proc concatenates the parameter into an `EXEC`/`sp_executesql` string, the injection just moved *inside* the procedure. And you must still **call** the procedure with bound parameters from the app (not by concatenating into the `EXEC procName '...'` call string). Stored procedures can be part of a defense (they encapsulate and can enforce least privilege), but the actual protection is the same as always: **parameterized use of input, no concatenation** — at both the call site and inside the procedure.

### Q10. How do least-privilege database accounts limit injection damage?

Parameterization *prevents* injection; least-privilege DB accounts *cap the blast radius if prevention fails* — classic defense in depth. The app should connect with a database user that has **only the permissions it actually needs**, so a successful SQLi can't do arbitrary damage.

Concretely:

- Grant `SELECT/INSERT/UPDATE/DELETE` on **only the tables the app uses**, not `db_owner`/superuser.
- **Don't grant `DROP`, `ALTER`, or admin** rights to the app account — so injection can't destroy schema or create backdoors.
- Use **separate accounts per service/role** — e.g. a read-only account for reporting queries means an injection there can't write at all.
- Deny access to system tables/procedures where feasible (limits privilege escalation and data-store fingerprinting).
- Restrict file-read/write and OS-command DB features (`xp_cmdshell`, `LOAD_FILE`, `INTO OUTFILE`) that turn SQLi into full server compromise.

So even if an attacker injects, a read-only, single-table account means they can read that table — not dump the whole database, drop tables, or pivot to the OS. It's the database instance of the least-privilege principle from access control.

### Q11. What is blind SQL injection, and why does it still matter if there's no visible output?

**Blind SQL injection** is SQLi where the app *doesn't* return the query's results or error in the response — but the injection still changes behavior the attacker can observe, so they extract data indirectly, one bit at a time.

Two flavors:

- **Boolean-based** — the attacker injects a condition and watches whether the page renders differently for true vs false (e.g. "valid" vs "not found"), reading each bit of data from the difference. `... AND SUBSTRING(password,1,1)='a'` → page A means yes.
- **Time-based** — when there's *no* visible difference at all, the attacker injects a conditional delay (`IF(condition, SLEEP(5), 0)`) and infers the answer from the response *time*.

It matters because "we don't show SQL errors / query results" is **not** a defense — attackers automate blind extraction (tools walk the whole database bit-by-bit) and it's slow but reliable. Suppressing error messages is good hygiene (don't leak schema/DB type) but does *nothing* to fix the underlying injection. The only real fix remains **parameterized queries**; blind SQLi is just proof that hiding output doesn't remove the vulnerability.

### Q12. You need to sort by a user-selected column — but you can't parameterize a column name. What do you do?

Correct — **bound parameters can only fill *value* slots, not identifiers** (table names, column names, `ASC`/`DESC`, keywords). So `ORDER BY ?` doesn't work, and the tempting fallback — concatenating the user's column name — is exactly how injection sneaks back in.

The fix is an **allowlist / mapping**: never pass the user's string into the query, only use it to *select* from a fixed set of known-safe identifiers you control.

```javascript
// ❌ Vulnerable: user string concatenated as an identifier
const sql = `SELECT * FROM products ORDER BY ${req.query.sort}`;

// ✅ Fixed: map user input to a fixed allowlist of real columns
const columns = { name: "name", price: "price", date: "created_at" };
const col = columns[req.query.sort] ?? "name";      // unknown → safe default
const dir = req.query.dir === "desc" ? "DESC" : "ASC";
const sql = `SELECT * FROM products ORDER BY ${col} ${dir}`;
```

Because `col` and `dir` can *only* ever be values from your hardcoded set, no user input reaches the SQL as syntax — even though we're still building the string, the untrusted input never enters it. This allowlist pattern is the standard answer for any place parameterization structurally can't reach.

### Q13. What's the difference between how you fix injection versus how you fix XSS?

Same principle ("never let untrusted data become code"), but **opposite ends of the pipeline and different mechanisms** — a favorite interviewer contrast:

| | Injection (SQL/cmd/LDAP) | XSS |
|---|---|---|
| Where the danger is | Input crossing into a **query/command** interpreter (server-side, on the way *in*) | Data crossing into an **HTML/JS** interpreter (in the browser, on the way *out*) |
| Primary fix | **Parameterize** — separate code/data channels *before* execution | **Context-aware output encoding** — encode data for the exact output context when *rendering* |
| Timing | At query execution | At output/render |

The key insight: for injection you fix it at **input-to-interpreter** time by *binding parameters*, whereas for XSS you fix it at **output-to-browser** time by *encoding for context* (HTML body vs attribute vs JS vs URL each need different encoding). You can't parameterize your way out of XSS (there's no "prepared statement" for HTML), and you can't rely on output encoding to stop SQLi. Both *also* use input validation as defense-in-depth, and neither should rely on it as the primary control. Knowing *why* the primary fix differs (structural separation vs contextual encoding) is the senior signal.

### Q14. Injection is #3 on the OWASP Top 10 — what's the one-line prevention, and what falls under "injection" now?

**One-line prevention:** use a **safe API that keeps commands and data separate — parameterized queries / prepared statements (or a safe ORM) — for every query built with external input**, and treat input validation and least-privilege accounts as supporting layers.

Modern OWASP folds a broad family under "Injection," because they share the root cause (untrusted input reaching an interpreter):

- **SQL / NoSQL / ORM** injection.
- **OS command** injection.
- **LDAP / XPath / XML (XXE-adjacent)** injection.
- **Expression Language / template injection (SSTI)** and header/CRLF injection.
- **Cross-Site Scripting (XSS)** — as of the current Top 10, XSS is categorized *within* Injection (data injected into the browser's HTML/JS interpreter), even though its primary fix is output encoding rather than parameterization.

So in an interview, define injection by its *mechanism* (input interpreted as code) rather than by SQL alone, give the primary fix as **separating code from data at the interpreter boundary**, and note the fix specializes per interpreter (bound params for SQL, arg arrays for shell, filter-encoding for LDAP, output encoding for XSS).

### Q15. Audit this data-access layer for injection risks across SQL, NoSQL, and shell. What do you look for?

I'd sweep for the single pattern — **untrusted input concatenated/interpolated into any interpreted string** — across every backend, then check the layered defenses:

**SQL.** Grep for string concatenation / f-strings / template literals building queries, `.raw()`/`execute()` calls, and `ORDER BY`/identifier interpolation. Every query with external input must use **bound parameters**; identifiers must go through an **allowlist**. Confirm the ORM isn't being bypassed via raw escape hatches.

**NoSQL.** Look for request bodies/objects passed **unparsed** into queries (`findOne(req.body)`), missing **type coercion** (so `{$ne:null}` operator objects can slip in), and any `$where`/server-side JS eval. Enforce expected primitive types and schema validation.

**Shell / OS.** Find `system()`, `exec`, `subprocess(..., shell=True)`, backticks, and any command built from input. Convert to **argument-array** invocation with no shell; prefer native library calls over shelling out.

**LDAP/XPath/templates.** Check filters/expressions/templates built from input; require the library's **escaping/parameter facility**, and confirm template engines auto-escape and aren't fed user-controlled templates (SSTI).

**Cross-cutting.** Verify **least-privilege DB accounts** (no superuser/DROP), that errors aren't leaking schema (blind-SQLi hygiene), that **input validation/allowlisting** exists as defense-in-depth, and add **regression tests** with injection payloads. The deliverable: a prioritized list where each finding names the concatenation site and its parameterized/array/allowlist fix.
## Web Security: XSS & Content Injection

### Summary

**What this topic covers**

Cross-site scripting (XSS) is the injection of attacker-controlled markup or script into a page so that it executes in a victim's browser inside *your* origin — stealing sessions, keylogging, rewriting the DOM, or pivoting to CSRF. This topic covers the three canonical variants (**stored**, **reflected**, **DOM-based**), the one primary fix that actually works (**context-aware output encoding**), the defence-in-depth layers around it (**Content Security Policy**, sanitization libraries like **DOMPurify**, **HttpOnly** cookies, **Subresource Integrity**, template auto-escaping), and the traps that reintroduce XSS after you thought you'd fixed it (`dangerouslySetInnerHTML`, `innerHTML`, `mutation XSS`). The 16 questions here go from "what is XSS and why is it dangerous" to "spot and fix a DOM-based sink" and "design a CSP for a real app." This complements the API Design primer's API-security topic and the Injection topic elsewhere in this primer — XSS is *injection into the browser's HTML/JS parser*, the mirror image of SQL injection into a database parser.

**Mental model**

Think of the browser as an interpreter that mixes **data** and **code** in one stream: HTML. XSS happens whenever attacker data crosses the boundary and is parsed as code. The whole discipline is keeping that boundary intact. The attacker's data can arrive and land in many *contexts* — inside an HTML element, inside an attribute, inside a `<script>` block, inside a URL, inside a CSS value — and each context has different metacharacters that break out of "data" into "code." So the fix is never one universal escape; it's *encode for the context the value lands in*. Modern frameworks (React, Angular, Vue) auto-escape by default, which is why raw XSS is rarer in framework code — but every framework has an escape hatch (`dangerouslySetInnerHTML`, `v-html`, `bypassSecurityTrustHtml`) that hands the raw HTML parser attacker data, and that's where bugs live. Treat every one of those as a code review red flag.

**Key terms**

- **Stored (persistent) XSS** — payload saved server-side (DB, comment, profile) and served to every viewer.
- **Reflected XSS** — payload bounced straight back in the response from a request parameter; needs a lure.
- **DOM-based XSS** — the injection never touches the server; client-side JS reads a source (`location.hash`) and writes a sink (`innerHTML`).
- **Output encoding** — converting metacharacters to entities (`<` → `&lt;`) so data renders as text, not markup. The primary fix.
- **Context** — where the value lands: HTML body, attribute, JS string, URL, CSS. Each needs a different encoding.
- **CSP (Content Security Policy)** — a response header restricting which script/style/img sources may load and execute; defence-in-depth, not a primary fix.
- **DOMPurify** — a battle-tested HTML sanitizer for cases where you must allow *some* user HTML.
- **HttpOnly cookie** — a cookie JS cannot read; limits session theft if XSS still occurs.
- **SRI (Subresource Integrity)** — a hash on a `<script>`/`<link>` so a tampered CDN asset is rejected.
- **Sink** — a DOM API that parses/executes a string as code (`innerHTML`, `eval`, `document.write`, `setAttribute('href', …)`).
- **Mutation XSS (mXSS)** — HTML that's safe as text but becomes dangerous after the browser re-parses/normalizes the DOM.

**Why interviewers ask this**

XSS is the most common serious web vuln in the wild, so it's a reliable signal for whether a candidate has actually shipped web code securely. Junior candidates say "sanitize input" and stop — which is the *wrong* primary fix and reveals they've memorised a slogan. Senior candidates say "encode on output, for the context, and add CSP as defence-in-depth," distinguish the three XSS types, know why `HttpOnly` limits but doesn't prevent XSS, and can point at the exact sink in a snippet. The strongest signal is naming *where* the fix goes (output, contextually) versus where juniors put it (input, generically), and knowing that framework auto-escaping already solves 95% of cases — so the interesting bugs are in the escape hatches.

**Common confusions**

- "Input validation stops XSS" — it's defence-in-depth, not the fix. Output encoding for the render context is the fix; the same byte is safe in one context and dangerous in another.
- "HttpOnly cookies prevent XSS" — no. They limit *impact* (attacker can't read the cookie) but the script still runs and can act as the user.
- "CSP is a replacement for encoding" — no. CSP is a second wall; a good CSP turns many XSS bugs into non-events, but you still encode.
- "React makes XSS impossible" — until someone uses `dangerouslySetInnerHTML` or builds a `javascript:` URL.
- "Sanitizing once is enough" — mutation XSS shows sanitized HTML can still turn dangerous after the browser re-parses it; sanitize with a library that accounts for this and re-check after DOM mutations.

**What follows from this topic**

XSS pairs directly with the **CSRF/SSRF/request attacks** topic (XSS defeats most CSRF defences, since script in your origin can read anti-CSRF tokens) and with **session & token security** (why tokens in `localStorage` are XSS-exfiltratable but `HttpOnly` cookies aren't). It sits under **OWASP Top 10** A03 Injection. The output-encoding-vs-input-validation lesson generalises to every injection class in this primer.

### Q1. What is cross-site scripting (XSS) and why is it dangerous?

XSS is an injection vulnerability where attacker-controlled data is rendered by the browser as **executable markup or script** inside your site's origin. Because the script runs *as your origin*, it inherits everything the user's session can do.

Concretely, an XSS payload can: read the DOM and exfiltrate anything on the page; steal non-`HttpOnly` cookies and tokens from `localStorage`; make authenticated requests as the user (defeating CSRF tokens, since it can read them); keylog form input; rewrite the page to phish credentials; and pivot deeper. It's dangerous precisely because the same-origin policy — the browser's main isolation boundary — is *bypassed*: the malicious code is running from inside the trusted origin, so it's on the right side of that wall.

The mental one-liner: **XSS is remote code execution in your users' browsers.**

### Q2. Explain the difference between stored, reflected, and DOM-based XSS.

| | Stored (persistent) | Reflected | DOM-based |
|---|---|---|---|
| Where payload lives | Server-side store (DB, comment) | In the request, echoed in response | Never leaves the browser |
| Trigger | Any user views the page | Victim clicks a crafted link | Client JS reads a source into a sink |
| Server sees payload? | Yes (stored + served) | Yes (reflected) | Often **no** (`#fragment` isn't sent) |
| Blast radius | Everyone who views it | Whoever follows the lure | Whoever follows the lure |
| Example sink | Rendered comment body | Search term echoed on results page | `el.innerHTML = location.hash` |

**Stored** is the worst — self-propagating, hits every viewer (classic "worm" like the old MySpace Samy). **Reflected** needs social engineering to deliver the link. **DOM-based** is sneaky because the vulnerable code is entirely client-side; a server-side WAF or template escaper never sees it — the flaw is JS writing an untrusted **source** to a dangerous **sink**.

### Q3. What is the primary defence against XSS, and why is input validation not it?

The primary defence is **context-aware output encoding**: when you render untrusted data, encode it for the exact context it lands in so the browser treats it as *data*, not *code*.

Input validation is defence-in-depth, not the fix, for one reason: **the same byte is safe or dangerous depending on where it's rendered.** A quote `"` is harmless in an HTML text node but breaks out of an HTML attribute; a `<` is dangerous in HTML body but fine inside a JS string literal. You can't decide at input time what's "safe" because you don't yet know the output context — and over-strict input validation breaks legitimate data (O'Brien, 3 < 5, `<script>` in a security tutorial).

```javascript
// Vulnerable: raw interpolation into HTML
el.innerHTML = "Hello " + username;      // username = <img src=x onerror=alert(1)>

// Fixed: encode for HTML context (or don't touch the parser at all)
el.textContent = "Hello " + username;    // textContent never parses markup
```

Validate input for *correctness* (an email looks like an email), but rely on **output encoding** — ideally your framework's automatic escaping — to stop XSS.

### Q4. What does "context-aware" encoding mean? Give the contexts.

It means the encoding you apply depends on where in the document the value is being inserted, because each context has different characters that escape "data" into "code."

- **HTML element/body context** — encode `< > & " '` to HTML entities. `<div>{{ value }}</div>`.
- **HTML attribute context** — same plus always quote the attribute; unquoted attributes let a space start a new attribute. `<input value="{{ value }}">`.
- **JavaScript string context** — Unicode/`\x` escape; never drop raw data into a `<script>` block. Ideally pass data via `data-*` attributes or JSON, not inline JS.
- **URL context** — URL-encode, and validate the scheme: reject `javascript:`/`data:` so `<a href="{{ url }}">` can't run script.
- **CSS context** — CSS-escape; untrusted CSS can exfiltrate data and, historically, run script in old browsers.

The failure mode is applying HTML encoding to a value that lands in a JS or URL context — it looks "escaped" but is still exploitable. This is why you use a library/framework that knows the context, rather than a single hand-rolled `escapeHtml()`.

### Q5. Spot the vulnerability and fix it.

```javascript
// A search results page
const term = new URLSearchParams(location.search).get("q");
document.getElementById("results").innerHTML =
  "<h2>Results for " + term + "</h2>";
```

This is **DOM-based reflected XSS**. The untrusted source is `location.search`; the sink is `innerHTML`, which parses the string as HTML. `?q=<img src=x onerror=alert(document.cookie)>` executes.

Fix — stop feeding the HTML parser untrusted data. Use a text sink:

```javascript
const term = new URLSearchParams(location.search).get("q");
const h2 = document.createElement("h2");
h2.textContent = "Results for " + term;   // textContent = data, not markup
const results = document.getElementById("results");
results.replaceChildren(h2);
```

If you genuinely must render user-supplied *HTML* (e.g. a rich-text comment), sanitize with DOMPurify first: `el.innerHTML = DOMPurify.sanitize(userHtml)`. Never `innerHTML` a raw untrusted string.

### Q6. What is a Content Security Policy (CSP) and how does it help against XSS?

CSP is a response header that tells the browser which sources are allowed to load and execute content — scripts, styles, images, frames, connections. It's a **second wall**: even if an XSS payload lands in the DOM, a good CSP can stop it from executing or from phoning home.

```http
Content-Security-Policy: default-src 'self';
  script-src 'self' 'nonce-r4nd0m';
  object-src 'none';
  base-uri 'none'
```

Key wins: with a strict `script-src` you disallow inline scripts (so `<img onerror=…>` and `<script>…</script>` injections don't run) and only allow scripts carrying the per-response **nonce** or a **hash**. `object-src 'none'` and `base-uri 'none'` close common bypasses.

Caveats: CSP is **defence-in-depth, not a primary fix** — you still encode output. Avoid `'unsafe-inline'` and `'unsafe-eval'` (they neuter the policy). Prefer **nonce-based** or **hash-based** strict CSP over host allowlists, which are easy to bypass via open redirects or JSONP endpoints on allowed hosts. Roll it out with `Content-Security-Policy-Report-Only` and a report endpoint first.

### Q7. When must you allow user-supplied HTML, and how do you do it safely?

When the product genuinely needs rich content — comment bodies, WYSIWYG editors, markdown that renders to HTML, email templates. Encoding to plain text would destroy the feature, so you must **sanitize**: parse the HTML, drop dangerous elements/attributes, and emit a safe subset.

Do **not** hand-roll this with regex — HTML is not regular, and parser quirks (comments, malformed tags, mutation XSS) will defeat you. Use a maintained, browser-aware sanitizer:

```javascript
import DOMPurify from "dompurify";

// Allow formatting, strip scripts/handlers/dangerous URLs
const clean = DOMPurify.sanitize(userHtml, {
  ALLOWED_TAGS: ["b", "i", "em", "strong", "a", "p", "ul", "ol", "li"],
  ALLOWED_ATTR: ["href"],
});
el.innerHTML = clean;
```

DOMPurify strips `<script>`, event handlers (`onerror`), `javascript:` URLs, and is hardened against mutation XSS. Keep the allowlist tight (allowlist tags/attrs, don't blocklist), sanitize on the server too if the HTML is stored, and keep the library updated — sanitizer bypasses are found and patched regularly.

### Q8. How does `HttpOnly` help, and what does it *not* protect against?

`HttpOnly` is a cookie flag that makes the cookie invisible to JavaScript (`document.cookie` can't read it). This limits the **impact** of XSS: an attacker who achieves script execution can't simply read your session cookie and replay it from their own machine.

What it does **not** do: it does not prevent XSS, and it does not stop the injected script from *acting as the user*. Even without reading the cookie, the script runs in your origin, so it can issue authenticated requests (the browser attaches the cookie automatically), scrape the page, submit forms, and change account settings — a "session-riding" attack. So `HttpOnly` narrows the blast radius (no cookie exfiltration to reuse elsewhere) but the session is still effectively compromised while the page is open.

Pair `HttpOnly` with `Secure` (HTTPS-only) and `SameSite`, and treat it as one layer — the real fix is preventing the XSS in the first place.

### Q9. Why is storing session tokens in `localStorage` risky compared to cookies?

`localStorage` is readable by any JavaScript running on the page. If you ever have an XSS bug, the payload can do `localStorage.getItem('token')` and exfiltrate the token in one line — and unlike an `HttpOnly` cookie, there's no browser flag to hide it from script.

An `HttpOnly` cookie can't be read by JS at all, so an XSS attacker can *use* the session (by riding it) but can't *steal* the token to replay elsewhere or after the tab closes. The trade-off: cookies are automatically attached to requests, which introduces CSRF risk — handled with `SameSite` and anti-CSRF tokens.

Rule of thumb: prefer `HttpOnly; Secure; SameSite` cookies for session tokens. If you must use bearer tokens in JS (some SPA/mobile flows), you're accepting that XSS = token theft, so your XSS defences (encoding + strict CSP) have to be that much tighter, and you lean on short token lifetimes plus refresh rotation.

### Q10. What is Subresource Integrity (SRI) and what threat does it address?

SRI lets you pin a cryptographic hash on an external `<script>` or `<link>` so the browser refuses to execute the resource if its bytes don't match — defending against a **compromised or tampered CDN / third-party host**.

```http
<script src="https://cdn.example.com/lib.js"
        integrity="sha384-BASE64HASH"
        crossorigin="anonymous"></script>
```

If an attacker breaches the CDN and swaps `lib.js` for a malicious version, the hash no longer matches and the browser blocks it. This closes a real supply-chain path: you trust your own origin's CSP, but third-party scripts run with full privileges in your page. SRI turns "any CDN compromise = XSS on every page" into "tampered asset = blocked."

Limits: SRI works for static, versioned assets. It doesn't help for resources that legitimately change per request, and you must update the hash whenever you bump the dependency version. It complements CSP (`require-sri-for script` / careful `script-src`) rather than replacing it — this ties into the supply-chain security topic.

### Q11. How does framework auto-escaping (React/Angular/Vue) prevent XSS, and where does it fail?

Modern frameworks treat rendered values as **data by default**. `<div>{userInput}</div>` in React, `{{ userInput }}` in Angular/Vue — the framework HTML-encodes the value for you, so markup renders as inert text. That single default eliminates the vast majority of XSS.

It fails at the **escape hatches**, where you explicitly tell the framework to trust raw HTML:

```jsx
// React — the classic trap
<div dangerouslySetInnerHTML={{ __html: userHtml }} />   // raw HTML parser

// Vue:  <div v-html="userHtml">
// Angular: [innerHTML]="userHtml"  or  bypassSecurityTrustHtml(userHtml)
```

Each of these feeds the HTML parser attacker data — back to square one. Other gaps: building `href`/`src` from user input (`<a href={userUrl}>` with `javascript:`), injecting into inline `<script>`/`<style>`, and server-side template injection if you concatenate into templates. So the rule is: trust the default, treat every escape hatch as a review checkpoint, and if you use one, sanitize (DOMPurify) first.

### Q12. What is DOM-based XSS and why can server-side defences miss it?

DOM-based XSS is XSS where the vulnerable data flow is **entirely in client-side JavaScript**: a script reads an untrusted **source** and writes it to a dangerous **sink**, without the server ever generating the injected markup.

```javascript
// Source: URL fragment (never sent to the server)
// Sink: innerHTML (parses HTML)
document.querySelector("#panel").innerHTML = decodeURIComponent(location.hash.slice(1));
```

Server-side defences miss it because the payload often never reaches the server — the `#fragment` isn't transmitted, and even query params that are sent are used by *client* code the server template never touches. A server-side output encoder or WAF sees a clean response; the exploit happens after the page loads.

Common sources: `location.*`, `document.referrer`, `postMessage` data, `window.name`. Common sinks: `innerHTML`, `outerHTML`, `document.write`, `eval`, `setTimeout(string)`, `element.setAttribute('href'|'src', …)`. Fixes: use safe sinks (`textContent`, `setAttribute` with validated values), avoid `eval`/`Function`, sanitize with DOMPurify before any HTML sink, and adopt **Trusted Types** (`require-trusted-types-for 'script'` in CSP) to make dangerous sinks reject raw strings at runtime.

### Q13. What is mutation XSS (mXSS)?

Mutation XSS is an XSS that arises because the browser **re-parses and normalizes** HTML after it's inserted, turning a string that looked safe at sanitization time into a dangerous one.

The mechanism: a sanitizer inspects an HTML string and deems it clean, but when that string is assigned to `innerHTML`, the browser's parser "fixes up" malformed or ambiguous markup — closing tags, re-interpreting content in certain contexts (`<svg>`, `<math>`, `<noscript>`, `<template>`, mis-nested tags) — and the mutated DOM contains an executable node that wasn't visible in the original string.

Defence: don't rely on naive or regex-based sanitizers. Use **DOMPurify**, which is specifically hardened against known mXSS vectors and parses in the same engine that will render. Keep it updated (new mXSS bypasses are found periodically), sanitize as close to the sink as possible, and prefer not inserting user HTML at all. This is the strongest argument against "I wrote my own HTML sanitizer" — mXSS is exactly the class of bug hand-rolled sanitizers miss.

### Q14. How would you build a Content Security Policy for a real application?

Start strict, roll out in report-only, then enforce.

1. **Report-only first.** Ship `Content-Security-Policy-Report-Only` with `report-to`/`report-uri` and watch what would break for a week — you'll discover every inline script and third-party dependency without breaking prod.
2. **Prefer nonces/hashes over host allowlists.** Generate a per-response nonce, stamp it on your own scripts, and use `script-src 'nonce-xxx' 'strict-dynamic'`. `'strict-dynamic'` lets your trusted scripts load their own dependencies without you maintaining a host list (which is bypass-prone).
3. **Lock the dangerous directives.** `object-src 'none'`, `base-uri 'none'` (stops `<base>` hijacking), `frame-ancestors 'none'` (anti-clickjacking, replaces X-Frame-Options).
4. **Never use `'unsafe-inline'`/`'unsafe-eval'`** in `script-src` — they defeat the point. Refactor inline handlers to addEventListener.
5. **Add Trusted Types** for DOM XSS: `require-trusted-types-for 'script'`.

```http
Content-Security-Policy:
  default-src 'self';
  script-src 'nonce-{{nonce}}' 'strict-dynamic';
  object-src 'none';
  base-uri 'none';
  frame-ancestors 'none';
  require-trusted-types-for 'script';
  report-to csp-endpoint
```

Then flip from report-only to enforcing. It's defence-in-depth: it makes XSS bugs far less exploitable, but you still encode output.

### Q15. Threat-model a comment feature that renders user-submitted rich text.

Trust boundary: the comment crosses from an untrusted author to every other viewer's browser — classic **stored XSS** surface.

Walk the STRIDE-relevant flow:

- **Ingestion** — the comment is untrusted input. Don't try to make it "safe" here by stripping tags with regex (mutation XSS, encoding bypasses). Store it as-is or as sanitized HTML, but sanitize authoritatively on **output/render**.
- **Rendering** — the core risk. If it's plain text, use `textContent`/framework auto-escaping and you're done. If it's rich HTML, run it through **DOMPurify** with a tight tag/attr allowlist (`b i em a[href] p ul li`), and validate that `href` schemes are `http(s)` only (no `javascript:`).
- **Defence-in-depth** — serve a strict **CSP** (nonce-based, `object-src 'none'`) so even a sanitizer bypass likely can't execute; set session cookies `HttpOnly; Secure; SameSite=Lax` so a successful XSS can't trivially steal the session token.
- **Abuse cases** — markdown that expands to HTML (sanitize *after* markdown→HTML, not before), embedded images used for CSS-exfil or tracking, `<a target=_blank>` reverse-tabnabbing (add `rel="noopener noreferrer"`), and oversized/nested content as a DoS.
- **Monitoring** — CSP violation reports flag attempted injections; log and alert.

The one-line summary: encode/sanitize on output, add CSP + `HttpOnly` as layers, and never trust regex to parse HTML.

### Q16. What is the relationship between XSS and CSRF?

They're different attacks, and XSS is strictly more powerful — importantly, **XSS defeats CSRF defences.**

CSRF tricks a victim's browser into sending an authenticated request the user didn't intend, but the attacker is *blind* — same-origin policy stops them reading the response or any page content. That's why anti-CSRF tokens work: the attacker can't read the secret token to include it.

XSS runs code *inside* your origin, so it can read the anti-CSRF token straight from the DOM/cookie and forge a perfectly valid request — including the response. So if you have XSS, your CSRF protection is void. That's also why "we have CSRF tokens" is no defence against XSS, and why fixing XSS is the higher priority.

| | CSRF | XSS |
|---|---|---|
| Attacker runs code in your origin? | No (blind) | Yes |
| Can read responses/tokens? | No | Yes |
| Primary fix | Anti-CSRF token + SameSite | Output encoding + CSP |

This directly motivates the next topic: CSRF, SSRF and request-forgery attacks.

## Web Security: CSRF, SSRF & Request Attacks

### Summary

**What this topic covers**

This topic groups the attacks that abuse *who is making a request and to where* — the browser or server is coerced into sending a request it shouldn't, or trusting an origin it shouldn't. It covers **CSRF** (Cross-Site Request Forgery — the victim's authenticated browser is tricked into performing an action) with its defences (anti-CSRF tokens, **SameSite** cookies, double-submit); **SSRF** (Server-Side Request Forgery — the server is tricked into making requests to internal/cloud-metadata endpoints) with allowlists and metadata blocking; **open redirect**; **clickjacking** (X-Frame-Options / `frame-ancestors`); and **CORS misconfiguration** — the most misunderstood of the set. The 16 questions run from "what is CSRF" to "spot the SSRF in this image-fetch endpoint" and "why is `Access-Control-Allow-Origin: *` with credentials impossible." The unifying theme: **the confused-deputy problem** — a trusted party (browser, server) is manipulated into misusing its authority.

**Mental model**

Two families. **Client-side request forgery (CSRF, clickjacking)**: the attacker can't read your data but can make the *victim's browser* do something using its ambient authority (cookies auto-attached). The defence is to require a secret the attacker can't supply (a token) or to stop cookies riding cross-site (`SameSite`). **Server-side request forgery (SSRF)**: the attacker feeds your *server* a URL, and the server — sitting inside the trusted network with access to internal services and the cloud metadata endpoint — fetches it on their behalf. The defence is to never let user-controlled URLs reach internal targets: allowlist destinations, block private/link-local ranges. **CORS** is the odd one out — it's not an attack, it's a browser mechanism people *misconfigure* into one by reflecting arbitrary origins with credentials. Across all of them, ask: "whose authority is being borrowed, and what secret or check would break the abuse?"

**Key terms**

- **CSRF** — forcing a logged-in victim's browser to send an unwanted authenticated request (state-changing).
- **Anti-CSRF token** — an unpredictable per-session/per-request secret the server checks; the cross-site attacker can't read it.
- **SameSite cookie** — `Strict`/`Lax`/`None`; controls whether a cookie rides cross-site requests. `Lax` is a strong default CSRF mitigation.
- **Double-submit cookie** — send the CSRF token both as a cookie and a header/field; server checks they match. Stateless.
- **SSRF** — coercing the *server* into making a request to an attacker-chosen URL, often internal.
- **Cloud metadata endpoint** — `169.254.169.254`, the link-local address exposing cloud instance credentials; the classic SSRF target.
- **IMDSv2** — session/token-hardened metadata service that blunts SSRF against cloud credentials.
- **Open redirect** — an endpoint that redirects to a user-supplied URL, used for phishing and to bypass allowlists.
- **Clickjacking** — framing your site invisibly so the victim clicks attacker-chosen UI ("UI redress").
- **X-Frame-Options / `frame-ancestors`** — controls who may frame your page; the anti-clickjacking headers.
- **CORS** — Cross-Origin Resource Sharing; response headers that relax same-origin *reads* for allowed origins. Not an attack surface unless misconfigured.
- **Confused deputy** — a privileged component tricked into misusing its authority on an attacker's behalf; the pattern behind CSRF and SSRF.

**Why interviewers ask this**

These attacks reveal whether a candidate understands the **browser security model** (same-origin policy, ambient cookie authority) and **network trust boundaries**, not just syntax. The tell: many engineers conflate CSRF and XSS, think CORS *prevents* CSRF (it doesn't — CORS governs reads, CSRF is about writes), or believe input validation stops SSRF (allowlisting the destination is what stops it). Senior signal is naming the *right* defence for each — `SameSite` + token for CSRF, destination allowlist + metadata blocking for SSRF, `frame-ancestors` for clickjacking — and explaining CORS correctly (it *loosens* restrictions; a wildcard-with-credentials misconfig leaks data). Getting the CORS/CSRF distinction right in particular separates people who've reasoned about the browser model from people who've copied headers off a blog.

**Common confusions**

- "CORS prevents CSRF" — false. CORS controls whether JS can *read* a cross-origin response; simple form-style CSRF writes don't need to read anything. A permissive CORS config can even *enable* data theft.
- "SSRF is just an outbound firewall problem" — the app must allowlist destinations and block internal ranges; egress firewalls help but are bypassable via DNS rebinding and redirects.
- "SameSite=Lax fully solves CSRF" — it stops most cross-site cookie attachment, but top-level GET navigations still send `Lax` cookies, so state-changing GETs remain exposed; keep tokens.
- "Validating that a URL starts with our domain stops SSRF/open redirect" — `https://evil.com/@internal` and similar tricks bypass naive prefix checks.
- "Clickjacking needs an XSS" — no; it only needs your page to be frameable.

**What follows from this topic**

This links tightly to **XSS** (which defeats CSRF tokens), **session & token security** (`SameSite`, cookie flags), **cloud & infra security** (IMDSv2, egress control, why SSRF is catastrophic in cloud), and **OWASP Top 10** (A10 SSRF, A01 Broken Access Control, A05 Security Misconfiguration for CORS/headers). The confused-deputy pattern recurs in OAuth redirect-URI abuse and in API authorization.

### Q1. What is CSRF and how does the attack work?

CSRF (Cross-Site Request Forgery) tricks a logged-in victim's browser into sending a **state-changing authenticated request** the user never intended. It exploits **ambient authority**: the browser automatically attaches your session cookie to any request to your site, even one triggered from a *different* site.

The flow: the victim is logged into `bank.example.com`. They visit `evil.com`, which contains:

```html
<form action="https://bank.example.com/transfer" method="POST" id="f">
  <input type="hidden" name="to" value="attacker">
  <input type="hidden" name="amount" value="10000">
</form>
<script>document.getElementById("f").submit();</script>
```

The browser submits the form to the bank *with the victim's session cookie attached*, and the transfer executes as the victim. The attacker never sees the response (same-origin policy blocks that) — they don't need to; the side effect is the goal.

Key preconditions: a state-changing endpoint, cookie-based session auth, and no unpredictable secret required. Break any one and CSRF fails — which is exactly what the defences do.

### Q2. How do anti-CSRF tokens work, and why do they stop the attack?

The server issues an unpredictable, per-session (or per-request) secret token, embeds it in the legitimate form/page, and **requires it back** on every state-changing request — validating it server-side.

```html
<form action="/transfer" method="POST">
  <input type="hidden" name="csrf_token" value="9f2c…random…a1">
  ...
</form>
```

It works because of the **same-origin policy**: the cross-site attacker's page can't *read* the token — it's in a response from your origin, which SOP forbids the attacker's JS from reading. So the attacker can forge the request but can't include the correct token, and the server rejects it.

Requirements to be effective: the token must be cryptographically random, tied to the user's session, validated on the server for *every* mutating request (POST/PUT/PATCH/DELETE), and not leak via URLs (which end up in logs/referrers). Note the caveat: if the site has **XSS**, the attacker's script runs in your origin and can read the token — so CSRF tokens assume no XSS.

### Q3. What are SameSite cookies and how do they mitigate CSRF?

`SameSite` is a cookie attribute controlling whether the browser attaches the cookie on **cross-site** requests. It attacks CSRF at the root — ambient cookie authority.

- **`SameSite=Strict`** — cookie never sent on any cross-site request. Strongest, but breaks legitimate inbound links (user clicking a link to your app arrives logged-out on first navigation).
- **`SameSite=Lax`** — cookie sent on top-level GET navigations (clicking a link) but *not* on cross-site POSTs, iframes, or background requests. Good default: kills form-POST CSRF while keeping links working. Modern browsers default to `Lax`.
- **`SameSite=None`** — cookie sent cross-site; **must** be paired with `Secure`. Needed for legitimate cross-site contexts (embedded widgets, some SSO).

```http
Set-Cookie: session=…; HttpOnly; Secure; SameSite=Lax
```

Caveat — `Lax` is not a complete fix: it still sends the cookie on **top-level GET navigations**, so a state-changing GET endpoint (which you shouldn't have anyway) remains exploitable, and `Lax` doesn't cover every browser/edge case. Best practice is **defence-in-depth**: `SameSite=Lax` cookies *and* anti-CSRF tokens, plus making all mutations non-GET.

### Q4. What is the double-submit cookie pattern and when would you use it?

Double-submit is a **stateless** CSRF defence: the server sets the CSRF token as a cookie *and* the client echoes the same value in a request header (or hidden field). The server accepts the request only if the two match.

```http
Set-Cookie: csrf=RANDOMTOKEN; Secure; SameSite=Lax
X-CSRF-Token: RANDOMTOKEN     # sent by client JS on each mutating request
```

Why it works without server-side session state: the attacker can set/guess neither value from a cross-site context — they can't read the cookie (SOP) to copy it into the header, and cross-site JS can't add custom headers to a simple request without triggering CORS preflight (which your server won't approve).

Use it when you're stateless/token-based or across services where storing per-session CSRF tokens server-side is awkward (SPAs, microservices). Hardening: use the **signed/HMAC** double-submit variant so an attacker who can set cookies on a sibling subdomain can't inject a matching pair; combine with `SameSite`. It's a solid, scalable choice — just don't rely on the naive plain variant against subdomain-cookie-injection attackers.

### Q5. What is SSRF and why is it so dangerous in cloud environments?

SSRF (Server-Side Request Forgery) is when an attacker supplies a URL that your **server** then fetches — coercing your server, which lives *inside* the trusted network, to make requests on the attacker's behalf.

```python
# Vulnerable: server fetches a user-supplied URL
url = request.args["image_url"]
resp = requests.get(url)          # attacker sets url = http://169.254.169.254/...
```

It's devastating in cloud because the server can reach things the attacker can't: internal admin panels, databases, and above all the **cloud metadata endpoint** at `169.254.169.254`, which historically hands out the instance's IAM credentials. One SSRF → steal instance credentials → pivot across the account. This is exactly how several large breaches (e.g. the 2019 Capital One incident) escalated: SSRF to metadata to credentials to data.

Why the network alone doesn't save you: the request originates from *inside* your perimeter, so it's already past the firewall. The fix has to be in the app (destination allowlisting + blocking internal ranges) plus hardening the metadata service (IMDSv2).

### Q6. How do you prevent SSRF?

Layered controls, because any single one is bypassable:

1. **Allowlist destinations, don't blocklist.** If the feature fetches from a known set of hosts, allow only those. Blocklists (`if host == '169.254.169.254'`) miss alternate encodings, DNS names resolving to internal IPs, IPv6, and redirects.
2. **Resolve then validate, and block private/link-local ranges.** Resolve the hostname to an IP and reject `127.0.0.0/8`, `10/8`, `172.16/12`, `192.168/16`, `169.254/16` (link-local/metadata), `::1`, and IPv6 unique-local — *after* DNS resolution, and re-check after any redirect (DNS rebinding / TOCTOU).
3. **Disable redirects** or re-validate every hop (an allowed host can 302 to `169.254.169.254`).
4. **Don't let user URLs hit internal services** — front outbound fetches with a dedicated egress proxy that enforces the allowlist and strips to the metadata range.
5. **Harden the metadata service** — enforce **IMDSv2** (session tokens, hop limit) so a naive SSRF can't read credentials.
6. **Least privilege on the instance role** so even a successful SSRF yields minimal creds.

```python
ip = resolve(host)
if is_private_or_link_local(ip):        # after resolution
    raise Reject("destination not allowed")
resp = requests.get(url, allow_redirects=False, timeout=5)
```

Validation-plus-allowlist at the app layer is the primary fix; egress firewalls and IMDSv2 are the safety net.

### Q7. Spot the SSRF and fix it.

```python
# Endpoint that generates a thumbnail from a remote image
@app.post("/thumbnail")
def thumbnail():
    src = request.json["url"]
    img = requests.get(src, timeout=5).content   # <-- fetches any URL
    return make_thumbnail(img)
```

The vulnerability: `src` is fully attacker-controlled, so `POST {"url":"http://169.254.169.254/latest/meta-data/iam/security-credentials/"}` makes the server fetch cloud IAM credentials and (depending on response handling) leak them. Internal-only services are reachable the same way.

Fix — validate the resolved destination against an allowlist and block internal ranges, disable redirects, and lock the scheme:

```python
ALLOWED_SCHEMES = {"https"}

def safe_fetch(url):
    parts = urlparse(url)
    if parts.scheme not in ALLOWED_SCHEMES:
        raise Reject("scheme")
    ip = ipaddress.ip_address(socket.gethostbyname(parts.hostname))
    if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved:
        raise Reject("internal destination")
    return requests.get(url, allow_redirects=False, timeout=5).content
```

Better still, if the sources are known (say, only your own object storage), allowlist those specific hosts and skip user-supplied URLs entirely. Add IMDSv2 and a least-privilege instance role as defence-in-depth.

### Q8. What is an open redirect and why does it matter?

An open redirect is an endpoint that sends the browser to a **user-supplied destination** without validating it:

```python
# Vulnerable
return redirect(request.args["next"])     # ?next=https://evil.com/phish
```

On its own it seems minor, but it's dangerous as a **force multiplier**: attackers craft `https://trusted.example.com/login?next=https://evil.com` links — the domain the victim sees and trusts is yours, but they land on the attacker's phishing page. It also **bypasses allowlists** (SSRF filters, OAuth `redirect_uri` checks, email link scanners) that trust your domain, and can be chained to leak tokens in the URL/fragment.

Fixes: prefer redirecting to a **relative path** or a value chosen from a server-side allowlist/map (`next=dashboard` → `/dashboard`), not a raw URL. If you must accept URLs, validate that the target is same-origin (parse it and compare host, don't prefix-match — `https://evil.com\@you.com` and `//evil.com` defeat naive checks). For login/OAuth flows, register exact `redirect_uri`s.

### Q9. What is clickjacking and how do you prevent it?

Clickjacking ("UI redress") loads your site in a transparent or disguised iframe on the attacker's page and overlays it so the victim, thinking they're clicking the attacker's UI, actually clicks *your* buttons — confirming a payment, changing a setting, granting a permission — with their authenticated session.

Prevent it by telling the browser your pages may not be framed by other origins:

```http
Content-Security-Policy: frame-ancestors 'none'      # or 'self', or specific origins
X-Frame-Options: DENY                                # legacy fallback
```

- **`frame-ancestors`** (CSP) is the modern, flexible control — `'none'`, `'self'`, or an allowlist of origins that may frame you. Preferred.
- **`X-Frame-Options: DENY|SAMEORIGIN`** is the older header; keep it for old-browser coverage but `frame-ancestors` supersedes it.

Set these on all authenticated/sensitive pages by default. Frame-busting JavaScript is not sufficient (bypassable). For extra safety on critical actions, require re-authentication or an explicit confirmation step that a hidden click can't satisfy.

### Q10. What is CORS, and why doesn't it protect against CSRF?

CORS (Cross-Origin Resource Sharing) is a browser mechanism that **relaxes** the same-origin policy for **reads**: it lets a server opt in to allowing specific other origins' JavaScript to *read* its responses via `Access-Control-Allow-Origin` and friends.

The crucial point: CORS governs whether cross-origin JS may **read a response**, not whether a request may be **sent**. CSRF doesn't need to read anything — a forged form POST changes state and the attacker doesn't care about the response. So CORS is irrelevant to (and cannot prevent) CSRF.

Worse, people invert it: they think a restrictive CORS policy blocks CSRF, or they *loosen* CORS thinking it's a firewall. Neither is true — CORS only ever *grants* read access. If anything, a permissive CORS config (Q11) creates a *new* problem: it can let a malicious origin read sensitive cross-origin data. Keep the mental split: **CORS = who can read my responses; CSRF defence = tokens + SameSite for who can trigger my writes.**

### Q11. What does a CORS misconfiguration look like, and how do you get it right?

The classic misconfig is **reflecting the request's `Origin` back with credentials allowed**:

```http
# Vulnerable: reflect any origin + allow cookies
Access-Control-Allow-Origin: https://evil.com     # echoed from request
Access-Control-Allow-Credentials: true
```

This tells the browser "any site may make credentialed requests to me *and read the response*," so `evil.com`'s JS can pull the victim's authenticated data. Note `Access-Control-Allow-Origin: *` **with** `Allow-Credentials: true` is rejected by browsers — which is why attackers rely on origin *reflection* to get a specific-origin echo.

Getting it right:

- **Allowlist exact origins.** Compare the incoming `Origin` against a hardcoded set; echo it only on a match. Never blindly reflect, never use regex that matches `evil-example.com` or `example.com.evil.com`.
- **Only send `Allow-Credentials: true` for trusted origins** that genuinely need cookies/auth — and never with `*`.
- **Scope `Allow-Methods`/`Allow-Headers`** to what's needed.
- **Default to no CORS headers** — if a resource doesn't need cross-origin reads, don't emit them at all.

CORS is about *reads*, so a misconfig is a data-confidentiality bug, not a CSRF one.

### Q12. Compare CSRF, XSS, and SSRF.

| | CSRF | XSS | SSRF |
|---|---|---|---|
| Confused deputy | Victim's **browser** | — (direct code exec) | Your **server** |
| Attacker runs code in your origin? | No | Yes | No |
| Reads responses? | No (blind) | Yes | Yes (server-side) |
| Typical target | State-changing action as the user | Session/DOM in browser | Internal services, cloud metadata |
| Primary fix | Anti-CSRF token + `SameSite` | Output encoding + CSP | Destination allowlist + block internal ranges |

The through-line: CSRF and SSRF are both **confused-deputy** attacks (a trusted party is tricked into misusing its authority) while XSS is direct code execution in the browser. XSS is the most powerful — it can *perform* CSRF and read anything. SSRF is the most dangerous server-side because it reaches inside your network. Each has a distinct primary fix; don't cross the wires (a CSRF token does nothing against SSRF, and CORS does nothing against CSRF).

### Q13. Which endpoints need CSRF protection, and which don't?

**Need it:** any **state-changing** request authenticated by an **ambient credential** (cookies) — POST/PUT/PATCH/DELETE that create, update, delete, or transfer. Form submissions, "change email," "add admin," "transfer funds," "delete account."

**Don't need it (or it's moot):**

- **Safe, idempotent reads** (GET/HEAD) that change nothing — though beware: a GET that changes state is a bug that reintroduces CSRF, so keep GETs side-effect-free.
- **APIs authenticated by a non-ambient credential** — e.g. a `Bearer` token in an `Authorization` header that the client adds explicitly. The browser doesn't auto-attach it cross-site, so there's nothing to forge. (This is why pure token-header APIs are often CSRF-immune — but the moment you use cookies, CSRF is back.)
- **Requests already gated by a custom header** that triggers CORS preflight the attacker can't satisfy.

Practical guidance: use cookie sessions with `SameSite=Lax` + CSRF tokens on all mutations; or use `Authorization: Bearer` tokens (not cookies) and you sidestep CSRF at the cost of handling token storage/XSS. Decide the auth model deliberately — the CSRF story follows from it.

### Q14. Threat-model an endpoint that fetches a user-supplied webhook/callback URL.

The feature — "we'll POST events to your URL" — is an **SSRF machine** by design, so treat the URL as hostile.

Trust boundary: a user-controlled URL causes *your server* to originate a request from inside your network. STRIDE-style risks and mitigations:

- **Reach internal services / metadata (Information Disclosure, Elevation)** — allowlist is hard here (customer URLs are arbitrary), so: resolve the host and **reject private/loopback/link-local/reserved ranges** (incl. IPv6), re-validate after DNS resolution and on **every redirect** (disable redirects if possible), and route egress through a **proxy** that enforces this and can't reach `169.254.169.254`. Enforce **IMDSv2** and a least-privilege instance role.
- **DNS rebinding / TOCTOU** — a host that resolves public at check time and internal at fetch time; mitigate by pinning the validated IP for the actual connection, or using a proxy that validates the connected IP.
- **Protocol abuse** — restrict scheme to `https` (block `file:`, `gopher:`, `dict:` which enable deeper SSRF).
- **DoS / resource abuse** — timeouts, response-size caps, no following of huge/slow responses, rate limits per tenant.
- **Data exfil via error messages** — don't reflect the fetched response body/headers back to the caller (blind SSRF is far less useful).
- **Delivery integrity** — sign your webhook payloads (HMAC) so *receivers* can verify, and verify their endpoint ownership on registration.

Summary: block internal ranges post-resolution, disable/re-validate redirects, restrict scheme, egress-proxy, IMDSv2, least privilege, and don't echo responses.

### Q15. Walk through how you'd secure cookie-based sessions against request-forgery attacks end to end.

Layer the cookie flags and the request checks:

1. **Cookie flags** — `Set-Cookie: session=…; HttpOnly; Secure; SameSite=Lax`. `HttpOnly` (XSS can't read it), `Secure` (HTTPS only), `SameSite=Lax` (kills cross-site POST CSRF while keeping inbound links working). Use `Strict` for the most sensitive apps if the UX allows.
2. **Anti-CSRF tokens** on every mutating request (POST/PUT/PATCH/DELETE) — synchronizer token or signed double-submit — as defence-in-depth behind `SameSite`, because `Lax` still allows top-level GET cookie attachment and has browser edge cases.
3. **All mutations are non-GET and side-effect-free GETs** — so `SameSite=Lax` fully covers them.
4. **Anti-clickjacking** — `frame-ancestors 'none'` (+ `X-Frame-Options` fallback) so the session can't be abused via UI redress.
5. **Custom-header requirement / CORS discipline** — require a header like `X-Requested-With` or the CSRF header so cross-site simple requests can't reach mutating endpoints; keep CORS origins allowlisted and don't reflect origins with credentials.
6. **Session hygiene** — rotate the session ID on login (anti-fixation), short idle timeouts, server-side revocation on logout, re-auth for high-risk actions.

The point: no single control is complete — `SameSite` + tokens + header check + `HttpOnly` + `frame-ancestors` compose into a policy where forging or riding a session request is blocked at multiple layers.

### Q16. Why is "the request came from our own domain" not a safe authorization check?

Because attackers can make requests *appear* to come from your domain, and "same origin" is not the same as "authorized user intent."

Several failure modes: a **CSRF** request originates from the victim's browser and carries your cookies, so it *is* same-origin from the server's view — yet the user never intended it. An **open redirect** or **SSRF** lets an attacker launder a request through your trusted domain, so a downstream allowlist keyed on "our domain" is bypassed. The **`Referer`/`Origin` header** can be absent, stripped by privacy tools, or spoofed in non-browser clients, so trusting it as the sole check is fragile.

The correct model is to authenticate *and authorize the specific action* on the server: verify the user's identity (session/token), verify an **unpredictable secret** for state changes (CSRF token), and enforce **object-level authorization** (is *this* user allowed to act on *this* resource — the IDOR/BOLA check). Origin/`Referer` checks are a useful *additional* signal for CSRF defence, never the primary authorization decision. Authorization is about *what this authenticated principal may do*, not *where the packet appears to come from*.

## OWASP Top 10

### Summary

**What this topic covers**

The OWASP Top 10 is the industry's consensus list of the most critical web-application security risks, refreshed every few years by the Open Worldwide Application Security Project from real-world vulnerability data and practitioner surveys. This topic walks the **current (2021) Top 10** — A01 Broken Access Control, A02 Cryptographic Failures, A03 Injection, A04 Insecure Design, A05 Security Misconfiguration, A06 Vulnerable & Outdated Components, A07 Identification & Authentication Failures, A08 Software & Data Integrity Failures, A09 Security Logging & Monitoring Failures, A10 SSRF — giving one clear prevention for each, explaining how the list has **evolved** (renames, merges, the new categories), and showing how to actually **use it** as a design/review checklist rather than recite it. The 16 questions run from "what is the Top 10 and what is it *for*" to per-category deep-dives and "how would you use it to review a new service." Every specific vuln class here is expanded in this primer's other topics (injection, XSS, CSRF/SSRF, crypto, authN/Z) — the Top 10 is the **map**, those topics are the terrain.

**Mental model**

Treat the Top 10 as **categories of risk, not a checklist of bugs** — it's a prioritised taxonomy for *awareness and coverage*, not a certification you "pass." Two shifts matter in the 2021 edition. First, it moved toward **root causes over symptoms**: "Insecure Design" (A04) and "Software & Data Integrity Failures" (A08) are about *how you build*, not a specific payload — a signal that the industry cares about secure design and supply chain, not just filtering inputs. Second, the ranking is **data-driven** (incidence across hundreds of thousands of apps) tempered by survey input for emerging risks. Use it two ways: as a **design-time** lens (does our architecture address each category?) and as a **review/test** lens (map findings to categories to spot blind spots). Crucially, the Top 10 is a floor, not a ceiling — it's the *minimum* awareness bar, not a complete security program (which is what the OWASP ASVS is for).

**Key terms**

- **OWASP** — Open Worldwide Application Security Project; nonprofit publishing the Top 10, ASVS, cheat sheets.
- **A01 Broken Access Control** — users acting outside their permissions (IDOR/BOLA, missing server-side checks); #1 risk.
- **A02 Cryptographic Failures** — weak/missing crypto exposing data (was "Sensitive Data Exposure").
- **A03 Injection** — untrusted data interpreted as code (SQL, command, LDAP); XSS folded in here in 2021.
- **A04 Insecure Design** — flaws in the design itself, unfixable by clean implementation; new in 2021.
- **A05 Security Misconfiguration** — insecure defaults, verbose errors, open cloud config; absorbed XXE.
- **A06 Vulnerable & Outdated Components** — using dependencies with known CVEs.
- **A07 Identification & Authentication Failures** — weak auth, session, credential handling (renamed from "Broken Authentication").
- **A08 Software & Data Integrity Failures** — trusting unverified code/data; supply-chain and insecure deserialization; new in 2021.
- **A09 Security Logging & Monitoring Failures** — inability to detect/respond to breaches.
- **A10 SSRF** — server coerced into requesting attacker-chosen URLs; added by community survey in 2021.
- **ASVS** — Application Security Verification Standard; the deeper, exhaustive checklist beyond the Top 10.

**Why interviewers ask this**

The Top 10 is the lingua franca of AppSec, so it's a fast read on breadth: can the candidate name the current categories, or are they stuck on the 2013/2017 list (which reveals stale knowledge)? Junior signal is reciting the list; senior signal is (1) knowing the **2021 changes** and *why* they happened (rise of supply-chain attacks → A08; design maturity → A04; access control being the empirically #1 problem), (2) giving a *concrete prevention* per category, and (3) understanding what the list is **for** — awareness and coverage, not a compliance checkbox, and that "we passed a Top 10 scan" is not "we're secure." The best candidates connect categories to real incidents and to the specific defences elsewhere in this primer.

**Common confusions**

- "The Top 10 is a complete security checklist" — no; it's an awareness/prioritisation document. Use **ASVS** for exhaustive requirements.
- "It's ranked by severity" — it's ranked primarily by *prevalence/data* (with survey input), not raw impact; a lower-ranked item can be catastrophic in your app.
- "Injection = SQL injection" — injection spans SQL, NoSQL, OS command, LDAP, XPath, and (since 2021) XSS.
- "Insecure Design can be fixed by better coding" — no; a design flaw survives a perfect implementation. It needs threat modeling at design time.
- "SSRF is niche" — it earned its own slot precisely because cloud metadata makes it high-impact.

**What follows from this topic**

Every category maps to a deeper topic: A01 → access control/IDOR, A02 → cryptography & password storage, A03 → injection & XSS, A05/A06/A08 → security misconfiguration & **supply-chain security**, A07 → authentication & session/token security, A09 → incident response & monitoring, A10 → the CSRF/SSRF topic. The Top 10 is the index; treat it as the entry point into the specific defences, and pair it with **secure SDLC** (shift-left, threat modeling) to address the root-cause categories (A04, A08).

### Q1. What is the OWASP Top 10 and what is it for?

The OWASP Top 10 is a periodically-updated, community-driven **awareness document** listing the ten most critical web-application security risk categories, published by OWASP. It's derived from data across hundreds of thousands of real applications plus practitioner surveys for emerging threats.

Its purpose is **awareness and prioritisation**: giving engineering teams a shared vocabulary and a starting map of "where the serious risk usually is," so security effort goes to the highest-value areas first. It's widely referenced in compliance (PCI-DSS nods to it), security training, and vendor questionnaires.

What it is *not*: a complete checklist or a certification. "We handle the Top 10" means you've covered the common categories, not that you're secure — for exhaustive requirements you use the OWASP **ASVS** (Application Security Verification Standard). Think of the Top 10 as the *floor* for security awareness and the entry point into deeper controls, not the ceiling.

### Q2. How has the Top 10 evolved, and what changed in the 2021 edition?

The list is refreshed every three to four years as vulnerability data and the threat landscape shift. The 2021 edition (current) made several notable moves:

- **Broken Access Control jumped to #1 (A01)** — it was the most prevalent serious issue in the data. Access-control bugs are everywhere and high-impact.
- **Two root-cause categories were added:** **A04 Insecure Design** (design-level flaws, a push toward secure-by-design and threat modeling) and **A08 Software & Data Integrity Failures** (supply-chain and update integrity, reflecting SolarWinds-era attacks and insecure deserialization).
- **A10 SSRF was added** via the community survey — not top by raw incidence, but flagged as important/high-impact due to cloud metadata exposure.
- **Renames/merges:** "Sensitive Data Exposure" → **A02 Cryptographic Failures** (focus on the cause, not the symptom); **XSS merged into A03 Injection**; **XXE merged into A05 Security Misconfiguration**; "Broken Authentication" → **A07 Identification & Authentication Failures**; logging rose to **A09**.

The theme: a shift toward **root causes** (design, supply chain) and away from purely symptom-based categories — signalling the industry cares about *how software is built and sourced*, not just input filtering.

### Q3. A01 Broken Access Control — what is it and the one prevention?

**What:** users act outside their intended permissions — viewing/editing other users' records (**IDOR/BOLA**), accessing admin functions without the admin role (privilege escalation), or performing actions the UI hid but the API didn't block. It's #1 because it's pervasive and directly exposes data.

```http
GET /api/orders/1024      # I'm user A; order 1024 belongs to user B — and it returns it
```

**One prevention:** **enforce authorization server-side on every request, denying by default**, and check that the authenticated principal owns/may access the *specific object* — not just that they're logged in. Concretely: centralise access checks, deny by default, verify object ownership (`order.user_id == session.user_id`) rather than trusting client-supplied IDs, and never rely on hiding UI elements. Use unpredictable IDs as defence-in-depth, but the real fix is the server-side object-level check on every access.

### Q4. A02 Cryptographic Failures — what is it and the one prevention?

**What:** sensitive data (passwords, PII, payment data, tokens) is exposed because crypto is missing, weak, or misused — plaintext storage, unencrypted transport, weak algorithms (MD5/SHA1 for passwords, DES), hardcoded keys, reused nonces, or bad randomness. Formerly "Sensitive Data Exposure"; renamed to point at the **cause**.

**One prevention:** **classify sensitive data, then encrypt it in transit and at rest with strong, current algorithms — and don't roll your own crypto.** Concretely: TLS everywhere (HSTS), AES-GCM for data at rest, **Argon2/bcrypt/scrypt with per-user salt** for passwords (never plain SHA), keys in a **KMS/secret manager** (never in code), and proper randomness (CSPRNG). Minimise what you store in the first place — the safest sensitive data is the data you didn't keep.

### Q5. A03 Injection — what is it and the one prevention?

**What:** untrusted input is interpreted as **code/commands** by a downstream interpreter — SQL, NoSQL, OS command, LDAP, XPath, and (since 2021) **XSS**. The archetype:

```sql
-- Vulnerable: string concatenation
"SELECT * FROM users WHERE name = '" + input + "'"    -- input = ' OR '1'='1
```

**One prevention:** **never build interpreter strings by concatenation — use parameterized queries / prepared statements** (and context-aware output encoding for XSS).

```sql
-- Fixed: parameterized
SELECT * FROM users WHERE name = ?      -- input bound as data, never parsed as SQL
```

Parameterization keeps the code/data boundary intact: the query structure is fixed, user input is bound as pure data. Use ORMs/prepared statements for SQL, safe APIs (no `exec` with shell strings) for commands, and **output encoding** for XSS. Input validation is helpful defence-in-depth but is *not* the primary fix — the fix is separating code from data at the interpreter.

### Q6. A04 Insecure Design — what is it and the one prevention?

**What:** flaws in the **design itself** — missing or weak security controls that no amount of clean coding can fix because the problem is architectural. Example: a "reset password via security question" flow whose questions are publicly discoverable, or a checkout that trusts a client-supplied price. A perfect implementation of an insecure design is still insecure. New in 2021, signalling the industry's move toward secure-by-design.

**One prevention:** **do threat modeling during design** — build in security requirements, abuse cases, and secure design patterns *before* coding. Concretely: run STRIDE/attack-tree analysis on new features, define trust boundaries, write abuse/misuse cases alongside user stories, use reference architectures and secure design patterns, and add security acceptance criteria. This is the "shift-left" idea: catching a design flaw on a whiteboard is orders of magnitude cheaper than after it ships. It pairs directly with the secure-SDLC topic.

### Q7. A05 Security Misconfiguration — what is it and the one prevention?

**What:** the system is insecure because of how it's *configured*, not a code bug — default credentials left on, unnecessary features/ports enabled, verbose error messages/stack traces leaking internals, missing security headers, overly permissive cloud storage (public S3 buckets), directory listing, or an unpatched-but-configurable default. Absorbed **XXE** in 2021 (an XML-parser misconfiguration).

**One prevention:** **harden with secure defaults and automate configuration** — a repeatable, minimal, locked-down baseline applied consistently across environments. Concretely: remove/disable unused features and default accounts, deny by default, disable directory listing and verbose errors in prod, set security headers (CSP, HSTS, `frame-ancestors`), disable external entity resolution in XML parsers (kills XXE), and enforce config via **infrastructure-as-code** with drift detection and CSPM scanning so dev/stage/prod don't diverge. Configuration is code — review and scan it like code.

### Q8. A06 Vulnerable & Outdated Components — what is it and the one prevention?

**What:** using libraries, frameworks, runtimes, or OS packages with **known vulnerabilities (CVEs)** — an outdated dependency, an unpatched server, a transitive package you didn't even know you pulled in. Modern apps are mostly third-party code, so this is a huge, often-invisible surface (e.g. Log4Shell hit apps that never directly imported Log4j).

**One prevention:** **continuously inventory dependencies and patch known-vulnerable ones — automate SCA in CI.** Concretely: maintain an **SBOM** (software bill of materials), run **Software Composition Analysis** (dependency scanning) on every build to flag CVEs, remove unused dependencies, pin versions with lockfiles, prefer maintained libraries, and have a fast patch process for critical advisories. You can't defend components you don't know you're running — visibility (SBOM + SCA) is the prerequisite to patching.

### Q9. A07 Identification & Authentication Failures — what is it and the one prevention?

**What:** weaknesses in confirming identity and managing sessions — permitting weak/breached passwords, no protection against **credential stuffing/brute force**, weak session management (predictable IDs, no rotation, no timeout), insecure recovery flows, or missing MFA. Renamed from "Broken Authentication" to include *identification*.

**One prevention:** **use strong, standards-based authentication with MFA, and manage sessions securely.** Concretely: follow NIST password guidance (length over arbitrary complexity, screen against breached-password lists), offer/enforce **MFA** (TOTP, or better **WebAuthn/passkeys**), rate-limit and lock out on repeated failures to blunt credential stuffing, store passwords with **Argon2/bcrypt + salt**, rotate the session ID on login (anti-fixation), set `HttpOnly; Secure; SameSite` cookies, and expire/revoke sessions properly. Prefer proven identity providers/SSO over rolling your own. Ties into the authentication and session/token topics.

### Q10. A08 Software & Data Integrity Failures — what is it and the one prevention?

**What:** trusting code or data whose **integrity you haven't verified** — auto-updating from an unsigned source, pulling build plugins/dependencies from untrusted registries, insecure deserialization of attacker-controlled objects, or a CI/CD pipeline that can be tampered with. New in 2021, driven by high-profile **supply-chain attacks** (SolarWinds-style compromise, malicious package updates).

**One prevention:** **verify integrity and provenance of all code and critical data with digital signatures.** Concretely: verify signatures on dependencies and updates, pin versions with lockfiles and checksums, use trusted registries and guard against **dependency confusion/typosquatting**, sign your own artifacts (**Sigstore**) and aim for **SLSA** provenance, secure the CI/CD pipeline (least privilege, no unreviewed steps), and **never deserialize untrusted data** with dangerous formats — use signed/simple data formats and integrity checks. This is the supply-chain category; it pairs with the secrets & supply-chain topic.

### Q11. A09 Security Logging & Monitoring Failures — what is it and the one prevention?

**What:** you can't **detect, alert on, or investigate** attacks because logging/monitoring is inadequate — auth failures and high-value actions aren't logged, logs lack detail or aren't centralised, there's no alerting, and breaches go unnoticed for months. The gap that turns a small incident into a major undetected breach.

**One prevention:** **log security-relevant events, centralise and monitor them, and alert on suspicious patterns** — with an incident-response plan ready to act. Concretely: log authentication successes/failures, access-control denials, input-validation failures, and high-value transactions with enough context (who, what, when, where) to investigate; ship to a centralised, tamper-resistant store (**SIEM**); set alerts for anomalies (spikes in 401s/403s, credential stuffing); and rehearse the IR runbook. Critically, **never log secrets, passwords, tokens, or full PII** — logs are themselves a target. This category pairs with the incident-response & monitoring topic.

### Q12. A10 SSRF — what is it and the one prevention?

**What:** the application fetches a **user-supplied URL** and the server makes that request from inside the trusted network — letting an attacker reach internal services or, most damagingly, the **cloud metadata endpoint** (`169.254.169.254`) to steal instance credentials. It was added to the 2021 list via community survey because cloud architectures made it high-impact.

**One prevention:** **allowlist permitted destinations and block requests to internal/link-local ranges — never send user-controlled URLs to internal services.** Concretely: allowlist schemes (`https`) and hosts, resolve the hostname and reject private/loopback/**link-local (169.254/16)**/reserved IPs *after* resolution, disable or re-validate redirects, route egress through a validating proxy, enforce **IMDSv2**, and apply a least-privilege instance role so even a successful SSRF yields little. Covered in depth in the CSRF/SSRF topic.

### Q13. Is the Top 10 ordered by severity? How should you interpret the ranking?

No — it's ordered primarily by **prevalence and data** (incidence rates across the analysed application population), tempered by **survey input** for emerging risks. It is *not* a severity ranking.

The practical implications: (1) A lower-ranked category can be **catastrophic in your specific app** — SSRF is A10 but was the pivot in the Capital One breach; rank it by *your* context, not the list position. (2) The list reflects *how common* a class of flaw is in the wild, which is a decent proxy for "where you're statistically likely to have a problem," but your own threat model should reweight it. (3) Two categories (A04 Insecure Design, A10 SSRF) got their placement partly from survey/community input rather than pure data, precisely because raw incidence undercounts high-impact-but-less-frequent risks.

So: use the ranking to guide *where to look first*, but drive remediation priority off **risk = likelihood × impact** for your application, not off the ordinal number.

### Q14. How would you use the Top 10 as a checklist to review a new service?

Use it as a **coverage lens**, walking each category against the design and the code — but remember it's a floor, not the whole review.

A quick pass per category:

- **A01 Access Control** — is every endpoint's authorization enforced server-side, object-level, deny-by-default? Any IDOR?
- **A02 Crypto** — TLS + HSTS? Sensitive data encrypted at rest? Passwords with Argon2/bcrypt? Keys in a KMS?
- **A03 Injection** — parameterized queries everywhere? Output encoding for XSS? No shell string-building?
- **A04 Insecure Design** — did we threat-model this? Any trust-boundary or business-logic gaps?
- **A05 Misconfig** — hardened config, security headers, no verbose errors, no public buckets, XML external entities disabled?
- **A06 Components** — SCA clean? SBOM current? No known-CVE dependencies?
- **A07 AuthN** — MFA, rate limiting, breached-password checks, secure sessions?
- **A08 Integrity** — signed dependencies/artifacts, locked versions, no untrusted deserialization, hardened CI/CD?
- **A09 Logging** — security events logged/centralised/alerted, no secrets in logs?
- **A10 SSRF** — any user-supplied URLs the server fetches? Allowlisted + internal ranges blocked?

Map every review finding to a category to expose blind spots, then go deeper with **ASVS** and threat modeling for anything sensitive. The Top 10 gives you breadth of coverage; it doesn't replace design-level analysis.

### Q15. Why isn't "we pass an OWASP Top 10 scan" the same as being secure?

Because the Top 10 is an **awareness taxonomy**, not a security *program*, and an automated scan only finds a subset of even those categories.

Three gaps. First, **scanners miss whole categories** — A04 Insecure Design and much of A01 Broken Access Control are business-logic and design problems no scanner reliably detects; they need human threat modeling and manual testing. Second, the Top 10 is a **floor of common risks**, deliberately only ten categories — the OWASP **ASVS** has hundreds of requirements for a reason; a real program covers far more (authorization edge cases, tenancy isolation, abuse cases, privacy). Third, "passing a scan" measures the *tool's* coverage, not your risk — false negatives are silent, and a clean DAST run says nothing about a logic flaw that lets user A drain user B's account.

The mature framing: use the Top 10 for shared vocabulary and baseline coverage, use ASVS for depth, and combine SAST/DAST/SCA with **threat modeling, secure design review, and manual pen testing**. Security is a continuous process, not a scan result.

### Q16. Map each Top 10 category to its deeper defence in this primer.

The Top 10 is the index; here's where each category's real defence lives:

| Category | Deeper topic / defence |
|---|---|
| A01 Broken Access Control | AuthZ: RBAC/ABAC, object-level checks, IDOR/BOLA fixes |
| A02 Cryptographic Failures | Cryptography + applied crypto: TLS, AES-GCM, Argon2 password hashing, KMS |
| A03 Injection | Injection + XSS: parameterized queries, output encoding |
| A04 Insecure Design | Secure SDLC: threat modeling, abuse cases, secure-by-design |
| A05 Security Misconfiguration | Cloud/infra + config hardening, security headers, IaC scanning |
| A06 Vulnerable Components | Supply chain: SCA, SBOM, dependency pinning |
| A07 Identification & Auth Failures | Authentication + session/token security: MFA, WebAuthn, session hygiene |
| A08 Integrity Failures | Supply chain: signing (Sigstore), SLSA, no untrusted deserialization |
| A09 Logging & Monitoring | Incident response & monitoring: SIEM, IR lifecycle, no-secrets-in-logs |
| A10 SSRF | CSRF/SSRF topic: allowlists, block link-local/metadata, IMDSv2 |

The takeaway: don't stop at the Top 10 label. Each category is a doorway into a specific set of controls and a specific interview topic — the Top 10 tells you *what class of risk* you're facing; the deeper topic tells you *exactly how to defend it*. Pair the map (Top 10) with the terrain (each defence) and a root-cause lens (secure SDLC) for a complete story.
## Session & Token Security

### Summary

**What this topic covers**

How a web application remembers *who you are* between requests, and every way that memory gets stolen, forged, or replayed. HTTP is stateless, so authentication produces a **credential the browser carries** — a session cookie or a bearer token — and the security of the whole app collapses to: can an attacker obtain, forge, or reuse that credential? This topic covers cookie security flags (`Secure`/`HttpOnly`/`SameSite`), **session fixation** and session lifecycle (idle vs absolute timeout, rotation on privilege change), **JWT security** (the `alg:none` and algorithm-confusion traps, weak signing secrets, the no-revocation problem and the short-expiry-plus-refresh answer), **refresh-token rotation** and reuse detection, the **token storage** debate (cookie vs `localStorage` and its XSS tradeoff), and the **OAuth 2.0 / OIDC** pitfalls interviewers love — redirect-URI validation, **PKCE**, and the `state`/`nonce` parameters. The 16 questions move from "what do the cookie flags do" to "design token auth for a mobile app plus SPA plus first-party API." This builds directly on the Authentication and XSS/CSRF material and complements the API Design primer's API-security topic.

**Mental model**

Think of a session credential as a **physical key to the building**. Three questions decide its safety: (1) *Can someone copy the key in transit or at rest?* → `Secure` (HTTPS-only), `HttpOnly` (JS can't read it), encryption, don't log it. (2) *Can someone trick your browser into using the key on the attacker's behalf?* → `SameSite`, anti-CSRF tokens, redirect-URI validation. (3) *If the key is stolen, how fast does it stop working, and can you tell?* → short expiry, rotation, revocation, reuse detection, anomaly logging. Stateful sessions keep the "who" on the server (a random session ID indexes server state) — trivially revocable, but needs a shared store. Stateless tokens (JWT) put the claims *in* the token, signed — no lookup needed, scales horizontally, but you can't easily un-issue one. Almost every token vulnerability is a variation of "the server trusted something the client could control": the `alg` header, an unvalidated redirect, a claim nobody verified.

**Key terms**

- **Session cookie** — server-issued opaque random ID; server holds the state. Revoke by deleting server-side.
- **`HttpOnly`** — cookie flag blocking JavaScript (`document.cookie`) access; the single best defense against XSS-driven session theft.
- **`Secure`** — cookie only sent over HTTPS, never cleartext HTTP.
- **`SameSite`** — `Strict`/`Lax`/`None`; controls whether the cookie rides along on cross-site requests; the primary structural CSRF defense.
- **Session fixation** — attacker sets/knows the victim's session ID *before* login; fixed by rotating the ID on authentication.
- **JWT** — JSON Web Token: base64url `header.payload.signature`; self-contained, signed, verifiable without a DB lookup.
- **`alg:none` / algorithm confusion** — JWT attacks where the token dictates its own verification algorithm; fixed by pinning the expected algorithm server-side.
- **Access vs refresh token** — short-lived access token for API calls; long-lived refresh token exchanged for new access tokens; rotate refresh tokens on use.
- **PKCE** — Proof Key for Code Exchange: binds the OAuth authorization code to the client that started the flow; defeats code interception.
- **`state` / `nonce`** — OAuth/OIDC anti-CSRF (`state`) and replay/binding (`nonce`) parameters.
- **Redirect-URI validation** — exact-match allowlisting of OAuth callback URLs; loose matching enables token theft.

**Why interviewers ask this**

Session and token handling is where most real-world account-takeover bugs live, so it separates people who've *shipped and secured* auth from people who've only wired up a login form. Junior signal: "I use JWTs because they're stateless and modern" with no awareness of revocation, storage, or the `alg` trap. Senior signal: articulating the *tradeoffs* — knowing that `localStorage` tokens are XSS-exfiltratable while `HttpOnly` cookies are CSRF-exposed, that JWT's headline feature (no server lookup) is also its headline weakness (no easy revocation), and that "short expiry + rotating refresh tokens + reuse detection" is how the industry squares that circle. Interviewers also probe OAuth because half of engineers can't explain what `state` is for or why the authorization-code-plus-PKCE flow replaced the implicit flow. Getting the cookie flags exactly right is a fast credibility check.

**Common confusions**

- "`HttpOnly` stops CSRF" — no. `HttpOnly` stops XSS *reading* the cookie; CSRF works precisely because the browser *sends* the cookie automatically without JS reading it. Different attack, different flag (`SameSite`/tokens).
- "JWTs are more secure than sessions" — they're not more secure, they're differently traded-off. Sessions revoke instantly; JWTs scale without a shared store. Neither is inherently safer.
- "Signed means encrypted" — a standard JWT is *signed, not encrypted*. Anyone can base64-decode and read the payload. Never put secrets or sensitive PII in it.
- "Store the JWT in `localStorage` so it's easy to attach" — that exposes it to any XSS on your origin. Prefer `HttpOnly` cookies (plus CSRF defense) unless you have a specific reason not to.
- "PKCE is only for mobile/public clients" — modern guidance (OAuth 2.1) applies PKCE to *all* authorization-code flows, including confidential web clients.
- "Rotating the session ID is optional" — rotating on login is the fix for session fixation; skipping it is a real, exploitable bug.

**What follows from this topic**

This sits between **Authentication** (how you prove identity in the first place — passwords, MFA, WebAuthn) and **Authorization** (what the identity is allowed to do — RBAC/ABAC, IDOR). The XSS topic explains *why* `HttpOnly` and token-in-`localStorage` matter; the CSRF topic explains `SameSite` and anti-CSRF tokens; the cryptography topic explains the HMAC/RSA signatures under JWT and the TLS that makes `Secure` meaningful. OAuth/OIDC connects onward to SSO and the API-security topic in the API Design primer. If session handling is shaky, revisit those neighbors — session security is where all of them converge on a single stolen-key question.

### Q1. What do the Secure, HttpOnly, and SameSite cookie flags each protect against?

Three orthogonal flags, three distinct threats. Set all three on any session/auth cookie.

| Flag | What it does | Threat it mitigates |
|---|---|---|
| `Secure` | Cookie only sent over HTTPS | Network sniffing / MITM on cleartext HTTP |
| `HttpOnly` | JavaScript can't read `document.cookie` | XSS exfiltrating the session cookie |
| `SameSite` | Restricts cross-site sending (`Strict`/`Lax`/`None`) | CSRF (cookie auto-attached to forged cross-site requests) |

```http
Set-Cookie: sid=<opaque-random>; Secure; HttpOnly; SameSite=Lax; Path=/; Max-Age=3600
```

Key nuance: they defend *different* attacks and don't substitute for each other. `HttpOnly` does nothing against CSRF (the browser still auto-sends the cookie); `SameSite` does nothing against XSS reading it (well, `HttpOnly` covers that). `SameSite=Lax` is a sane default (sent on top-level GET navigations, blocked on cross-site POST/`fetch`); `Strict` is tighter but breaks "click a link from email and stay logged in"; `None` *requires* `Secure` and re-opens CSRF exposure, so pair it with anti-CSRF tokens.

### Q2. What is session fixation and how do you prevent it?

**Session fixation** is when an attacker causes the victim to authenticate under a session ID the attacker *already knows*, then rides that same session after login.

Attack shape: the attacker obtains a valid session ID (e.g., the app accepts a session ID from a URL parameter, or the attacker plants one via a subdomain cookie), tricks the victim into using it, the victim logs in, and — if the server keeps the same ID across the login boundary — the attacker now shares an authenticated session.

The fix is one line of discipline: **rotate (regenerate) the session identifier on every privilege change**, especially at login.

```javascript
// After successful authentication:
req.session.regenerate((err) => {   // issue a brand-new session ID
  req.session.userId = user.id;      // bind identity to the NEW id
});
```

Also: never accept session IDs from URLs or untrusted input (cookies only), scope cookies tightly (`Domain`/`Path`), and re-authenticate for sensitive actions. Rotating on login means the pre-login ID the attacker planted is dead the moment authentication succeeds.

### Q3. Idle timeout vs absolute timeout — why have both?

They cap different risks, so use both.

- **Idle (inactivity) timeout** — session expires after N minutes of *no activity* (e.g., 15–30 min for sensitive apps). Limits the window when a user walks away from an unlocked device or a token sits unused.
- **Absolute timeout** — session expires N hours/days after *creation* regardless of activity (e.g., 8–24 hours). Caps the total lifetime so a stolen-but-actively-used session can't live forever by staying "active."

Without an absolute cap, an attacker who steals an active session and keeps it warm never gets logged out. Without an idle cap, an abandoned session on a shared machine stays open. Sensitive operations (changing password, payment) should also demand **re-authentication** even inside a live session. On timeout, invalidate server-side, not just client-side — deleting the cookie without killing the server record leaves a replayable ID.

### Q4. Walk me through JWT security pitfalls. What's the alg:none attack?

A JWT is `base64url(header).base64url(payload).signature`. The header names the signing algorithm. The classic pitfalls:

**`alg:none`** — the spec defines an "unsecured" JWT with `{"alg":"none"}` and *no* signature. A naive verifier that trusts the header's `alg` will accept a token with any payload and an empty signature — instant forgery. Fix: **pin the expected algorithm server-side** and reject `none`.

**Algorithm confusion (RS256 → HS256)** — if the server verifies with a "figure out the algorithm from the header" call, an attacker changes `alg` from `RS256` (asymmetric) to `HS256` (symmetric) and signs the token using the *public* RSA key as the HMAC secret. The server, holding that public key, validates it. Fix: pin the algorithm; never let the token pick.

```javascript
// Vulnerable: trusts the token's own alg header
jwt.verify(token, key);
// Fixed: pin the algorithm explicitly
jwt.verify(token, key, { algorithms: ['RS256'] });
```

**Weak secret** — HS256 with a short/guessable secret is brute-forceable offline. Use a long, high-entropy key.

**No revocation + sensitive payload** — see Q5 and Q7. Don't put secrets/PII in the (readable) payload; can't easily revoke, so keep expiry short.

### Q5. JWTs can't be revoked easily. How do you handle logout and compromised tokens?

Right — that's JWT's core tension. A self-contained signed token is valid until it expires; the server does no lookup, so there's nothing to "delete." Options, usually combined:

1. **Short-lived access tokens** (5–15 min) + **long-lived refresh tokens**. The damage window for a leaked access token is tiny; real "logout" and revocation happen at the refresh-token layer, which *is* stored server-side and can be deleted.
2. **Server-side denylist / revocation list** for access tokens you need to kill early — keyed by a `jti` (token ID) with a TTL equal to the token's remaining lifetime. This reintroduces a lookup, trading away some of JWT's statelessness for revocability.
3. **Token versioning** — store a per-user `tokenVersion`; embed it in the JWT; bump it to invalidate all outstanding tokens (password change, "log out everywhere"). Requires reading the version, so again a lookup.

The honest interview answer: pure stateless JWTs and instant revocation are in tension. Pick short expiry + refresh rotation for most apps; add a denylist only for the "kill it now" cases.

### Q6. Explain refresh-token rotation and reuse detection.

**Refresh-token rotation** means every time a refresh token is used to mint a new access token, you *also issue a new refresh token and invalidate the old one*. A refresh token is single-use.

Why: refresh tokens are long-lived and high-value. If one leaks and is used, rotation lets you *detect* it. Because the legitimate client and the attacker now both hold what they think is the current refresh token, one of them will present an *already-used* (invalidated) token.

**Reuse detection**: if a refresh token that has already been rotated away is presented again, treat it as compromise — invalidate the entire token family / session for that user and force re-authentication.

```
login → issue RT1 (family F)
use RT1 → invalidate RT1, issue RT2   (normal)
attacker replays RT1 → already used → REVOKE family F, force re-login
```

Store refresh tokens hashed server-side, bind them to a client/device, and give them an absolute lifetime. Rotation converts "silent long-lived theft" into "detectable one-time race."

### Q7. Where should I store tokens in the browser — cookie or localStorage?

The core tradeoff is *which attack you're more exposed to*:

| Storage | XSS exposure | CSRF exposure | Auto-sent? |
|---|---|---|---|
| `localStorage` / JS-readable | High — any XSS reads and exfiltrates it | None (JS attaches it manually) | No |
| `HttpOnly` cookie | Low — JS can't read it | Yes — browser auto-attaches it | Yes |

**Recommendation:** prefer an **`HttpOnly`, `Secure`, `SameSite` cookie** and add CSRF defense (SameSite + anti-CSRF token). Rationale: XSS is extremely common and a JS-readable token is a *direct* credential exfiltration; CSRF is well-understood and structurally mitigated by `SameSite` plus tokens.

`localStorage` is tempting for SPAs (easy to attach as `Authorization: Bearer`) but means *any* script injection = token theft. If you must (e.g., cross-domain API with no cookie option), then invest heavily in XSS prevention (CSP, output encoding) and keep access tokens very short-lived. Note: neither storage location matters if you have XSS — an attacker with script execution can also just *use* the `HttpOnly` cookie by making requests from the page. `HttpOnly` raises the bar (no silent exfiltration to reuse later), it doesn't make you immune.

### Q8. What is PKCE and what attack does it prevent?

**PKCE** (Proof Key for Code Exchange, "pixie") hardens the OAuth 2.0 **authorization-code** flow against **authorization-code interception**.

The threat: in the code flow, the auth server redirects back to the client with a `code`, which the client swaps for tokens. On a public client (mobile app, SPA) an attacker who intercepts that redirect (malicious app registered for the same URI scheme, network capture) could steal the code and redeem it.

PKCE binds the code to the specific client instance that started the flow:

```
1. Client generates random  code_verifier
2. Sends  code_challenge = SHA256(code_verifier)  on the /authorize request
3. Gets back the authorization code
4. Redeems code at /token, presenting the original code_verifier
5. Auth server checks SHA256(code_verifier) == stored code_challenge
```

A stolen code is useless without the matching `code_verifier`, which never left the legitimate client. PKCE replaced the deprecated implicit flow and, under OAuth 2.1, is recommended for **all** clients — confidential ones too, not just public.

### Q9. What are the state and nonce parameters in OAuth/OIDC for?

Different jobs, both anti-tampering:

- **`state`** (OAuth) — a random, unguessable value the client generates, sends on `/authorize`, and verifies on the callback. It's **CSRF protection for the OAuth flow**: it ensures the callback the client receives corresponds to a flow *this user actually started*, not one an attacker injected. Bind it to the user's session and reject a mismatch.
- **`nonce`** (OIDC) — a random value the client sends that the identity provider echoes *inside the signed ID token*. The client checks it matches. This **binds the ID token to this specific authentication request** and prevents ID-token replay.

Rule of thumb: `state` protects the *browser redirect* (transport-level CSRF/mix-up); `nonce` protects the *ID token* (replay). Omitting `state` is a classic OAuth CSRF hole ("login CSRF" — attacker logs the victim into the attacker's account). Always generate both fresh per flow, from a CSPRNG, and validate on return.

### Q10. Why is redirect-URI validation so important in OAuth, and how should it be done?

The redirect URI is where the auth server sends the authorization code / tokens. If validation is loose, an attacker redirects the credential to *their* server.

The attack: attacker crafts an authorize request with a redirect URI they control but that *passes* a sloppy check — e.g., the server does a prefix/substring match and `https://app.example.com.attacker.com` or `https://app.example.com/../evil` slips through, or an open-redirect on the legitimate domain bounces the code onward.

Defenses:

- **Exact-match allowlisting**: pre-register full redirect URIs and require an *exact* string match — no wildcards, no prefix matching, no substring logic.
- No open redirects anywhere on the registered domains (they can be chained to leak the code).
- Combine with PKCE and `state` so an intercepted code is still unusable.
- Reject requests whose redirect URI isn't in the registered set — fail closed.

"Validate the redirect URI by exact match" is the one-line answer interviewers want; loose matching is one of the most common real-world OAuth misconfigurations.

### Q11. Compare session-based auth and token-based (JWT) auth.

| | Session (stateful) | JWT / token (stateless) |
|---|---|---|
| Where state lives | Server (store indexes session ID) | In the token (signed claims) |
| Revocation | Instant (delete server record) | Hard — needs short expiry + denylist |
| Scaling | Needs shared/sticky session store | No lookup; scales horizontally easily |
| Storage | `HttpOnly` cookie | Cookie or `localStorage` (tradeoffs) |
| CSRF | Exposed (cookie auto-sent) → needs `SameSite`/tokens | Depends on storage |
| Payload visibility | Opaque ID reveals nothing | Base64 payload is readable (not secret) |
| Best fit | First-party web apps, need instant revoke | APIs, microservices, mobile, cross-service auth |

Neither is "better." Sessions win when you control the backend and want instant revocation and simplicity. Tokens win for distributed systems, third-party APIs, and stateless horizontal scaling. Many real systems are hybrid: a session cookie for the first-party web app, JWTs for the service-to-service and mobile API. Choose by revocation needs and topology, not by which sounds more modern.

### Q12. What is SAML and how does it differ from OIDC?

Both are **federated SSO** protocols — an Identity Provider (IdP) vouches for a user to a Service Provider / Relying Party — but from different eras and stacks.

- **SAML 2.0** — XML-based, browser-redirect/POST of signed XML **assertions**. Ubiquitous in enterprise/B2B SSO (Okta, ADFS, corporate apps). Heavier; XML signature validation is fiddly and historically a source of signature-wrapping bugs.
- **OIDC (OpenID Connect)** — a thin identity layer on **OAuth 2.0**, using JSON and JWT **ID tokens**. Lighter, mobile/SPA-friendly, the default for modern consumer and API auth.

```
SAML:  XML assertions,   enterprise SSO,   older, browser-centric
OIDC:  JWT ID tokens,     OAuth-based,      modern, API/mobile-friendly
```

Interview-level takeaway: SAML for legacy/enterprise integrations you don't control; OIDC for anything greenfield. Both rely on **signature validation** for trust — the common failure mode in SAML is accepting an assertion whose signature wasn't properly verified (XML signature wrapping), the analog of the JWT `alg` trap.

### Q13. How would you design authentication and session handling for a first-party SPA plus a mobile app hitting the same API?

Frame it by client type and revocation needs, not one-size-fits-all.

**First-party web SPA (same site as API):** use an **`HttpOnly`, `Secure`, `SameSite=Lax` session cookie** (or a cookie-stored short-lived token). Browser sends it automatically; JS can't read it (XSS-resistant); add anti-CSRF tokens for state-changing requests. Server-side session store gives instant revocation.

**Mobile app / cross-origin clients:** OAuth 2.0 **authorization-code flow with PKCE**, issuing a **short-lived access token (JWT)** + **rotating refresh token**. Store the refresh token in the platform secure store (Keychain/Keystore), not plain storage. Access token in memory.

**Shared API layer:** validate the bearer JWT (pin `alg`, check `exp`/`aud`/`iss`), enforce authorization server-side per request. Keep a refresh-token store with rotation + reuse detection for revocation and "log out everywhere."

Cross-cutting: TLS/HSTS everywhere, rate-limit auth endpoints, MFA on the login, rotate session ID on login, short access-token TTL. The theme: cookies for the browser, tokens for the app, one server-side revocation point.

### Q14. Someone reports they stayed logged in after "logging out." What went wrong and how do you fix it?

Classic symptom of **client-side-only logout**. The app cleared the cookie/token in the browser but never invalidated the credential server-side, so a copy still works.

Likely causes:

- **Session not destroyed server-side** — logout deleted the cookie but left the session record; replaying the old ID re-authenticates.
- **JWT still valid** — you "logged out" by dropping the token client-side, but the signed token is valid until `exp`; anyone holding a copy still passes verification.
- **Refresh token not revoked** — access token expired but the untouched refresh token silently mints new ones.

Fixes: on logout, **destroy the server-side session** (and clear the cookie); for tokens, **revoke the refresh token** and, if you need immediate access-token death, add the `jti` to a denylist until it expires. Support "log out everywhere" via a per-user token version bump. And keep access tokens short so the residual window is minutes, not hours. The root lesson: logout is a *server-side* state change, not just clearing the client.

### Q15. Is base64-encoding sensitive data inside a JWT safe? Why or why not?

No. Base64url is **encoding, not encryption** — it's reversible by anyone with no key. A standard (JWS) JWT is *signed*, which guarantees integrity and authenticity (nobody tampered with it) but provides **zero confidentiality**. Paste the payload into any decoder and you read every claim.

```
eyJhbGciOiJIUzI1NiJ9.eyJ1c2VyIjoiYWxpY2UiLCJyb2xlIjoiYWRtaW4ifQ.<sig>
                       └─ base64url-decodes to: {"user":"alice","role":"admin"}
```

So: never put passwords, full PII, secrets, or anything you wouldn't hand the client into a JWT payload. Put a user ID and coarse claims (roles, scopes) — things the user is allowed to know about themselves. If you genuinely need a confidential token, use **JWE** (JSON Web Encryption) instead of plain JWS, or keep the data server-side and reference it by an opaque ID. This is the same *encoding vs encryption* confusion that shows up in the cryptography topic — encoding is for transport format, not secrecy.

### Q16. What's the difference between authentication cookies scoped Lax vs Strict vs None for SameSite?

`SameSite` controls whether a cookie is attached to requests originating from a *different* site — the structural lever against CSRF.

- **`Strict`** — cookie sent *only* for same-site requests. Even clicking a link to your site from an external page arrives with no cookie, so the user looks logged-out on first hit. Maximum CSRF protection; worst UX for cross-site entry points. Good for high-value actions.
- **`Lax`** (modern browser default) — cookie sent on same-site requests *and* on top-level GET navigations (clicking a link), but **not** on cross-site POST/`fetch`/iframe/image requests. Blocks the classic CSRF form-POST while keeping "click a link from email and you're logged in." The sweet spot for most auth cookies.
- **`None`** — cookie sent on *all* cross-site requests; **requires `Secure`**. Needed for legitimate third-party/embedded contexts (cross-site iframes, some SSO). Re-opens CSRF exposure, so it *must* be paired with anti-CSRF tokens.

Default to `Lax` for session cookies; `Strict` for the most sensitive; `None` only when a cross-site use case forces it, and then add token-based CSRF defense on top.

## Secure Software Development (SSDLC)

### Summary

**What this topic covers**

How security stops being a gate at the end and becomes a property built in throughout — the **Secure Software Development Lifecycle**. The organizing idea is **shift left**: the earlier you catch a security flaw, the exponentially cheaper it is to fix, so you push security *activities* (not just testing) into requirements, design, and coding rather than bolting a pentest onto the finished product. This topic covers security requirements and **abuse/misuse cases**, **secure by design** and **secure by default**, **threat modeling during design**, **secure code review** (what a reviewer actually looks for), **security gates in CI**, developer **security training** and **security champions**, the cost-of-fixing-late curve, **paved roads / secure-defaults libraries**, and how all of this integrates into agile without becoming a bureaucratic drag. The 15 questions run from "what does shift-left mean" to "how do you embed security into a two-week sprint team without a dedicated security engineer." It complements the AppSec Testing topic (which covers the *tools*) and the threat-modeling material in the fundamentals topic.

**Mental model**

Picture the SDLC as a pipeline — requirements → design → code → build → test → deploy → operate — and imagine a security activity **layered onto each stage** rather than a single checkpoint at the end. Requirements: what are the abuse cases and security requirements? Design: threat-model the architecture, pick secure defaults. Code: secure coding standards, code review, SAST in the editor/PR. Build: SCA, secret scanning, signed artifacts. Test: DAST, fuzzing, pentest. Operate: logging, monitoring, IR. The economic engine underneath is the **cost curve**: a flaw caught in design is a whiteboard conversation; the same flaw caught in production is an incident, a patch, a disclosure, and reputational damage — often 10–100× costlier. Security's job in a mature org is not to be the department of "no" at the end, but to **make the secure path the easy path** — paved roads, secure-by-default libraries, and templates so that the average developer does the right thing without being a security expert.

**Key terms**

- **Shift left** — move security activities earlier (requirements/design/code) where fixes are cheap.
- **SSDLC** — security woven through every SDLC phase, not a final gate.
- **Abuse/misuse case** — a requirement written from the attacker's perspective ("an attacker must not be able to…").
- **Secure by design** — security is an architectural property decided up front, not patched on.
- **Secure by default** — the out-of-the-box configuration is the safe one; insecurity requires a deliberate opt-out.
- **Threat modeling** — structured analysis (e.g., STRIDE) of what can go wrong in a design and how to mitigate it.
- **Secure code review** — human review focused on security-relevant code (authz, input handling, crypto, secrets).
- **Security gate** — an automated CI check that can fail the build on security criteria (critical CVE, leaked secret).
- **Security champion** — an embedded developer on a team who carries security context and liaises with the security team.
- **Paved road / golden path** — a supported, secure-by-default way to build things so teams don't reinvent (insecurely).
- **Cost-of-fixing curve** — the empirical finding that defect remediation cost rises sharply the later it's found.

**Why interviewers ask this**

Because the difference between a mid and a senior engineer is often whether they think security is *someone else's phase* or *their design responsibility*. Junior signal: "we run a pentest before release" and nothing upstream. Senior signal: talking about abuse cases in the ticket, threat modeling in the design doc, SAST in the PR, and secure defaults in the shared libraries — security as a continuous property with a cost rationale. Interviewers also want to see you balance *rigor vs velocity*: a candidate who'd bolt heavyweight ceremony onto a two-week sprint and grind delivery to a halt is as much a problem as one who ignores security. The strong answer shows you can make security *lightweight and automated* (paved roads, CI gates, champions) so it scales without a security engineer per team. It's a systems-thinking and culture question as much as a technical one.

**Common confusions**

- "Shift left means test earlier" — testing is part of it, but shift-left is broader: requirements, design, and secure defaults matter *more* than earlier testing.
- "Secure by design and secure by default are the same" — design is *how you architect it*; default is *how it ships configured*. A well-designed system can still ship with an insecure default.
- "SSDLC is a waterfall thing" — it maps onto agile/DevSecOps fine; the activities become per-sprint and automated rather than big up-front phases.
- "A pentest at the end covers us" — a late pentest finds a sample of bugs expensively; it doesn't build security in and can't catch design flaws cheaply.
- "Security champions replace the security team" — they *scale* it by embedding context, they don't replace specialists.
- "More gates = more secure" — noisy, blocking gates that teams learn to bypass are worse than a few high-signal ones.

**What follows from this topic**

This is the *process* spine that the **AppSec Testing** topic plugs tools into (SAST/DAST/SCA/secret-scanning are the automation inside these gates) and that the **threat modeling** material in fundamentals feeds (design-phase analysis). **Secrets & supply chain** provides the build-stage controls (signing, SBOM, dependency pinning) that SSDLC gates enforce. **Incident response** is the operate-stage bookend. If you understand SSDLC as "security as a continuous, automated, culturally-owned property," the rest of the primer is the menu of specific controls you slot into each stage.

### Q1. What does "shift left" mean and why does it matter economically?

**Shift left** means moving security activities *earlier* in the development lifecycle — into requirements, design, and coding — instead of concentrating them at the end (a pre-release pentest or a post-deploy scan).

The economic argument is the whole point. The cost of fixing a defect rises sharply the later it's found:

```
Design    → cheap    (change a diagram / a decision)
Code      → cheap-ish (change a few lines in review)
Test      → moderate  (bug ticket, re-test cycle)
Production→ expensive (incident, hotfix, disclosure, reputation)
```

A missing-authorization check spotted in a design review is a five-minute conversation. The same check missing in production is a data breach, an emergency patch, customer notifications, and possibly regulatory fines. Shifting left also catches a whole *class* of problems — **design flaws** — that late testing structurally can't fix cheaply (you can't pentest your way out of a fundamentally insecure architecture). The practical implication: invest in threat modeling, secure defaults, and PR-time SAST, because that's where the leverage is.

### Q2. What are abuse cases / misuse cases and how do you use them?

A normal **use case** describes what a legitimate user does ("user resets their password"). An **abuse case** (or misuse case) describes what an *attacker* tries to do to the same feature ("attacker enumerates valid accounts via the reset endpoint," "attacker brute-forces the reset token").

You write them alongside requirements, from the attacker's perspective, as testable negative requirements:

```
Feature: password reset
  Use case:   a user requests a reset link to their email
  Abuse case: an attacker MUST NOT be able to
              - discover whether an email is registered (enumeration)
              - guess or brute-force the reset token
              - reuse a reset link after it's consumed or expired
```

The value: they turn "be secure" into concrete acceptance criteria that inform design (rate limiting, generic responses, high-entropy single-use tokens) and testing. They force the team to think adversarially *before* writing the happy path. In agile, they live in the ticket as security acceptance criteria or as explicit negative user stories, so security is a definition-of-done item, not an afterthought.

### Q3. Distinguish secure by design from secure by default.

Related but distinct:

- **Secure by design** — security is an *architectural* decision made up front. The system's structure inherently limits harm: least privilege, trust boundaries, defense in depth, fail-secure, minimizing attack surface. You designed it so that a compromise is contained.
- **Secure by default** — the system's *out-of-the-box configuration* is the safe one. Insecurity requires a deliberate, conscious opt-out. Encryption on by default, no default passwords, least-privilege roles by default, ports closed by default.

The distinction matters because you can get one without the other. A beautifully designed system can still ship with an insecure default (debug mode on, a permissive CORS policy, a wildcard IAM role in the starter template), and users overwhelmingly keep defaults. Conversely, safe defaults can't rescue a fundamentally flawed architecture.

The senior move is to combine them: design for containment *and* make the templates, libraries, and framework defaults land teams in the safe configuration automatically — so doing the secure thing requires no extra effort and doing the insecure thing requires deliberate action.

### Q4. What is threat modeling and when in the SDLC do you do it?

**Threat modeling** is a structured exercise to answer four questions about a design: *What are we building? What can go wrong? What are we going to do about it? Did we do a good job?* You do it **during design**, before the code exists, because that's when mitigations are cheapest and design flaws are still on a whiteboard.

Common approach — **STRIDE** over a data-flow diagram with trust boundaries:

```
Spoofing            → authentication
Tampering           → integrity (signatures, validation)
Repudiation         → logging / non-repudiation
Information disclosure→ encryption, access control
Denial of service   → rate limiting, quotas
Elevation of privilege→ authorization, least privilege
```

Draw the DFD (processes, data stores, flows, external entities), mark the **trust boundaries** (where data crosses from less-trusted to more-trusted — network edge, process boundary, user input), and walk each element through STRIDE, recording threats and mitigations. In agile, do it lightweightly per significant feature or architectural change — a 30-minute whiteboard session on the design doc, not a quarterly ceremony. The output is a prioritized list of threats and the mitigations that become security requirements/tests.

### Q5. What does a reviewer actually look for in a secure code review?

Security review is *targeted* — you focus attention on the security-relevant code, not every line. The high-yield checklist:

- **Authorization checks** — is every sensitive operation checking that *this* user may act on *this* object? (IDOR/BOLA is the #1 class.)
- **Input handling** — untrusted input reaching queries (SQLi → parameterized?), commands (command injection), HTML (XSS → output encoding?), file paths (traversal), deserializers (insecure deserialization).
- **Authentication & session** — password handling (hashed with bcrypt/argon2?), session rotation, token validation (pinned `alg`?).
- **Secrets** — hardcoded keys/passwords/tokens, secrets in logs.
- **Crypto usage** — rolling their own, ECB mode, reused nonces, weak randomness (`Math.random` for tokens).
- **Error handling & logging** — leaking stack traces/PII, logging secrets, failing open instead of secure.
- **Dependencies** — new packages: reputable? pinned? known CVEs?

Practical tip: grep the diff for the dangerous sinks (`eval`, `exec`, `innerHTML`, string-concatenated SQL, `Math.random`, `pickle`/`readObject`) and the authz boundaries. Automate what you can (SAST catches the mechanical patterns) so human review focuses on **logic and authorization**, which tools miss.

### Q6. How do you add security gates to CI without blocking the team constantly?

A **security gate** is an automated CI check that can fail the build. The failure mode to avoid is noisy, low-signal gates that teams learn to rubber-stamp or bypass. Design them for **high signal**:

- **Fail the build only on high-confidence, high-severity findings** — a leaked secret, a critical CVE in a direct dependency, a SAST finding at high severity. Report (don't block) on the rest.
- **Tune out false positives** aggressively and maintain a triaged suppression list with justification, so the gate stays trustworthy.
- **Make it fast** — gates that add 20 minutes get disabled. Run heavy scans (full DAST, fuzzing) out-of-band; keep in-PR checks quick (secret scan, SCA, incremental SAST on the diff).
- **Give actionable output** — the failure message should say exactly what and how to fix, ideally at the PR line.
- **Break-glass with accountability** — allow an override for emergencies, but log who and why.

The governing principle: a gate is only as good as the team's trust in it. A few sharp, fast, low-false-positive gates that teams respect beat a wall of blocking scans they route around.

### Q7. What is a security champion and why does the model work?

A **security champion** is a developer *embedded on a delivery team* who takes on extra security responsibility — reviewing designs for threats, being the first point of contact for security questions, championing secure practices, and liaising with the central security team.

Why the model works: security teams are always vastly outnumbered by developers (ratios of 1:100+ are normal). A central team can't be in every design review or PR. Champions **scale security context into every team** — someone with the vocabulary to say "did we threat-model this?" or "that's an IDOR" in the room where decisions happen, without waiting on a ticket to a bottlenecked security team.

They don't replace specialists — deep pentesting, crypto review, and IR still need experts. Champions are a *distribution* mechanism: they carry lightweight practices outward and pull hard problems back to the center. It also builds culture and career growth, and it means security requirements are advocated by a peer on the team rather than imposed from outside, which lands far better.

### Q8. Explain the cost-of-fixing-late curve and its implications.

The empirical observation (from decades of software-engineering data) is that the cost to remediate a defect **increases sharply the later in the lifecycle it's discovered** — roughly order-of-magnitude jumps between phases.

```
Requirements/Design : 1x     (change a decision)
Coding              : ~5x    (change code in review)
Testing             : ~10x   (bug cycle, re-test)
Production          : ~30–100x (incident, patch, disclosure, fines)
```

Implications for how you invest:

1. **Front-load cheap activities** — threat modeling and secure requirements cost little and prevent expensive design flaws. Highest ROI in the whole program.
2. **Automate the mechanical catches early** — SAST/secret-scan in the PR catches coding-phase bugs at coding-phase cost.
3. **Design flaws dominate the tail** — the most expensive production security incidents are usually *architectural* (missing authorization model, bad trust boundary), which only design-phase work catches cheaply. You can't test them out late.

This curve is the entire economic justification for shift-left and SSDLC: security-early isn't ideology, it's cost control.

### Q9. What are "paved roads" / golden paths and how do they improve security?

A **paved road** (or golden path) is a supported, opinionated, **secure-by-default** way to do a common task — a service template, an auth library, a deployment pipeline — that teams are encouraged to use instead of assembling their own.

The security logic: most vulnerabilities come from teams *reinventing* security-sensitive plumbing (auth, crypto, input handling, deploy config) and getting it subtly wrong. If the platform team provides a golden path where the framework template already has secure headers, CSRF protection, parameterized DB access, secret management, and hardened deploy defaults baked in, then the *average* developer gets security for free by staying on the road.

```
Off-road: every team hand-rolls auth  → N chances to get it wrong
Paved:    one vetted auth library     → fix once, everyone benefits
```

It also concentrates security effort: harden the shared library once and every consumer improves; patch a CVE centrally and it propagates. The strategic goal from Q3 realized — **make the secure path the path of least resistance**, so security scales without policing every team. The tradeoff is you must keep the paved road genuinely easier and up to date, or teams go off-road.

### Q10. How does secure development fit into an agile / DevSecOps workflow?

You decompose the heavyweight SSDLC activities into small, per-sprint, mostly-automated pieces so they ride along with delivery instead of gating it.

- **Backlog/requirements** — security acceptance criteria and abuse cases attached to stories; definition-of-done includes them.
- **Design** — lightweight threat modeling per significant feature (a 30-min whiteboard on the design doc), not a quarterly phase.
- **Coding** — secure coding standards, IDE/PR SAST, secret scanning, security-aware code review; a security champion in the team.
- **Build/CI** — automated gates: SCA for CVEs, secret scan, artifact signing (the "Sec" injected into CI/CD → DevSecOps).
- **Deploy** — secure-by-default infrastructure-as-code, config scanning.
- **Operate** — logging, monitoring, alerting, and an IR runbook; feed incidents back into requirements.

The philosophy shift is **DevSecOps**: security is automated into the pipeline and *owned by the team*, not handed to a separate gate at the end. The key is keeping each activity lightweight and automated — the failure mode is bolting waterfall-era security ceremony onto two-week sprints and killing velocity, which just gets security bypassed.

### Q11. A team ships a pentest two weeks before every quarterly release. What's wrong and what would you change?

The problem: security is a **single late gate**. A pre-release pentest:

- Finds a *sample* of bugs at the most expensive point to fix them (Q8) — right before release, forcing either a slipped date or shipping known issues.
- **Cannot catch design flaws cheaply** — architecture problems surface when they're baked in and costly to unwind.
- Creates a bottleneck and a false sense of coverage — a time-boxed pentest samples, it doesn't prove absence of vulnerabilities.
- Provides no *feedback loop* into how the team builds — the same bug classes recur next quarter.

What I'd change: keep the pentest (external adversarial testing is valuable) but **shift the bulk of security left**. Add threat modeling in design, abuse cases in tickets, SAST/SCA/secret-scanning in CI, secure defaults via paved roads, and a security champion on the team. Move to continuous delivery of security rather than a quarterly cliff. The pentest becomes a *validation* of a system that's already been built securely, catching the residual, rather than the only line of defense discovering everything at the worst moment.

### Q12. What's the difference between security requirements, secure coding standards, and secure defaults?

Three different levers at three levels:

- **Security requirements** — *what* the system must (not) do, phrased as testable criteria. "Passwords must be hashed with argon2id"; "an attacker must not enumerate accounts." Written at requirements time, often from abuse cases. They're the *goals*.
- **Secure coding standards** — *how* developers write code to meet those goals. "Always use parameterized queries"; "never use `Math.random` for tokens"; "encode output by context." They're the *rules of construction*, enforced by review and SAST.
- **Secure defaults** — the *baseline configuration* teams inherit so they meet requirements without effort. Framework ships with CSRF protection on, TLS enforced, least-privilege roles. They're the *starting point*.

They reinforce each other: requirements define the target, standards tell developers how to hit it, and defaults make hitting it the automatic outcome. The best programs push as much as possible *down* into defaults and automation — a rule enforced by a linter/gate beats a rule written in a wiki nobody reads, which beats a requirement with no mechanism behind it.

### Q13. How do you make developer security training actually stick?

Generic annual compliance training ("watch this video on phishing") is famously ineffective — it's abstract, forgotten, and disconnected from the code. What works is **contextual, hands-on, and just-in-time**:

- **Relevant to their stack** — teach the vuln classes and fixes in the languages and frameworks they actually use, with their codebase's patterns.
- **Hands-on** — deliberately-vulnerable apps, capture-the-flag exercises, "break this then fix it." People remember exploiting an SQLi far more than reading about one.
- **Just-in-time** — surface guidance at the moment of relevance: SAST feedback in the PR with an explanation and a fix link, so learning happens in the flow of work.
- **Reinforced by champions** — a peer on the team who models and explains secure practices day to day.
- **Metrics-informed** — track which vuln classes recur and target training there.

The mental model: training isn't a once-a-year event, it's a *continuous feedback system* where the tools teach as they gate, champions coach in context, and developers learn by doing. Culture beats curriculum — the goal is a team that instinctively asks "what could go wrong here?"

### Q14. Where do design-phase security activities pay off more than code-phase ones?

Design-phase work is where you catch **flaws** — architectural weaknesses — as opposed to **bugs** — implementation mistakes. The distinction matters because they have very different economics and different tooling.

- **Bugs** (a missing output-encoding call, a string-concatenated query) are *local* and *mechanical*. Tools catch them: SAST, code review, linters. Cheap to find in code, cheap to fix.
- **Flaws** (no authorization model, trusting the client, a bad trust boundary, missing tenant isolation) are *systemic*. No scanner finds "you designed the auth model wrong." They're only caught cheaply by **threat modeling in design**, and if they escape to production they're the *most expensive* incidents to remediate because fixing them means re-architecting.

Roughly half of real-world security problems are design flaws, not coding bugs — which is exactly why "Insecure Design" is its own category in the OWASP Top 10. So design-phase activities (threat modeling, abuse cases, secure-by-design review) pay off precisely on the class of problems that automation *cannot* catch and that costs the most late. Code-phase automation handles the mechanical majority; design-phase thinking handles the expensive minority.

### Q15. How would you bootstrap an SSDLC in an org that currently has none, without a big security team?

Prioritize by leverage, automate everything you can, and lean on culture over headcount.

**Phase 1 — visibility and cheap wins.** Turn on the automated, high-signal gates first: **secret scanning** (stop credential leaks), **SCA** (flag critical CVEs in dependencies). These are low-effort, high-value, and need no security experts to run.

**Phase 2 — shift left cheaply.** Introduce lightweight **threat modeling** for new features (a whiteboard template), **abuse cases** in tickets, and **secure coding standards** enforced by **SAST in PRs**. Establish **security champions** — one interested dev per team — to scale context without hiring.

**Phase 3 — paved roads.** Invest platform effort in **secure-by-default** templates and libraries so the whole org inherits good defaults (Q9). This is the force multiplier — fix once, everyone benefits.

**Phase 4 — validate and operate.** Add external **pentests / a bug bounty** as validation, and **logging/monitoring + an IR runbook** for the operate stage.

Throughout: measure recurring vuln classes and target effort there, keep gates fast and low-false-positive so teams trust them, and frame security as *enabling* speed (paved roads) rather than blocking it. Start with automation and culture; specialists come later.

## Application Security Testing

### Summary

**What this topic covers**

The toolbox for *finding* security defects — how the major techniques work, what each is good and bad at, and how to compose them into a pipeline that shifts security left without drowning teams in noise. The core comparison is **SAST vs DAST vs IAST**: static analysis of source code, dynamic analysis of a running app, and interactive analysis instrumented from inside the runtime. Around that sit **SCA / dependency scanning** (finding known CVEs in third-party components), **secret scanning** (catching leaked credentials in repos and CI), **fuzzing** (throwing malformed input to trigger crashes and edge cases), **penetration testing** and **red teaming** (human adversarial testing), and **bug bounties** / responsible disclosure (crowdsourced external testing). The cross-cutting realities are **false positives and triage**, where each technique fits in the pipeline, and — crucially — the **limits** of every tool (none of them find business-logic flaws or prove absence of bugs). The 15 questions run from "what's the difference between SAST and DAST" to "design a testing pipeline that shifts security left." This is the tooling counterpart to the SSDLC topic's process.

**Mental model**

Think of AppSec testing as **complementary lenses on the same system, each blind where the others see**. SAST reads the *code* without running it — full source visibility, early in the pipeline, but no runtime context, so it's noisy (high false positives). DAST attacks the *running app* from the outside like a real attacker — real behavior, low false positives, but no idea *where* in the code the bug is and only reaches what it can crawl (late in the pipeline, needs a deployment). IAST sits *inside* the running app instrumented, marrying code-level location with runtime truth. SCA looks *outward* at your dependencies for publicly-known CVEs. Secret scanning looks for the specific pattern of leaked credentials. Fuzzing hammers *inputs*. Pentest and red team add the *human* who chains findings and reasons about logic. No single tool is sufficient — the discipline is **defense in depth for testing**: layer techniques so each covers the others' blind spots, place them where they're cheap and fast, and triage relentlessly because a tool nobody trusts (too many false positives) is worse than no tool.

**Key terms**

- **SAST** — Static Application Security Testing: analyzes source/bytecode without executing it; early, code-level, noisy.
- **DAST** — Dynamic Application Security Testing: attacks the running app from outside; runtime-true, low false positives, late.
- **IAST** — Interactive AST: instruments the running app to observe from inside; combines code location with runtime accuracy.
- **SCA** — Software Composition Analysis: inventories dependencies and flags known CVEs (and license issues).
- **Secret scanning** — detects credentials/keys/tokens committed to code or CI.
- **Fuzzing** — feeds malformed/random/mutated input to trigger crashes, hangs, memory bugs.
- **Penetration testing** — time-boxed human-led simulated attack against a defined scope.
- **Red teaming** — goal-oriented, stealthy, broad adversary simulation testing detection/response too.
- **Bug bounty** — pay external researchers for validly-reported vulnerabilities under a defined program.
- **Responsible / coordinated disclosure** — reporting a vuln privately with time to fix before public disclosure.
- **False positive** — a reported "vulnerability" that isn't actually exploitable; the enemy of tool trust.
- **Triage** — the process of validating, prioritizing, and routing findings.

**Why interviewers ask this**

Because knowing tool *names* is table stakes, but knowing what each tool *can't* do is the senior signal. Junior candidates say "run SAST and DAST." Senior candidates explain *why* SAST is noisy (no runtime context), *why* DAST misses code location and unreachable paths, that neither finds **business-logic flaws** or **IDOR** reliably, and that all of them together still don't prove absence of vulnerabilities — which is why you *also* need human pentesting and a bug bounty. Interviewers probe how you'd **compose a pipeline** (what runs in the PR vs nightly vs pre-release) and how you'd handle the false-positive problem that sinks most real programs — because a scanner spewing thousands of unvalidated findings that developers learn to ignore is a common, expensive failure. This is a judgment question: do you understand these as a *portfolio* with tradeoffs, or as a checklist?

**Common confusions**

- "SAST and DAST find the same bugs, one's just better" — they find *different* classes. SAST sees code (finds hardcoded secrets, injection sinks); DAST sees behavior (finds config issues, auth problems visible only at runtime).
- "A clean scan means the app is secure" — no tool proves absence of vulnerabilities; scanners find *known patterns*, not logic flaws or novel bugs.
- "SCA scans my code" — SCA scans your *dependencies* for *publicly-known* CVEs; it says nothing about your own code's bugs.
- "Pentest and vulnerability scan are the same" — a scan is automated pattern-matching; a pentest is a human chaining findings and reasoning about logic and context.
- "Fuzzing is only for C/C++ memory bugs" — fuzzing also finds crashes, hangs, and logic edge cases in memory-safe languages (parsers, deserializers, protocol handlers).
- "Bug bounty replaces internal testing" — it's a *complement* that finds what your process missed, not a substitute for shifting left.

**What follows from this topic**

These tools are the automation that plugs into the **SSDLC** topic's security gates — SAST/SCA/secret-scanning are what run in the CI gates described there. **SCA and secret scanning** connect to the Secrets & Supply-Chain material (dependency CVEs, leaked keys, SBOMs). **Fuzzing** connects to the Memory-Safety topic (buffer overflows, use-after-free) and links to the OS primer. **Pentesting and bug bounties** feed **Incident Response** and responsible disclosure. And the whole "each tool has blind spots, especially logic flaws" theme points back to why **threat modeling** and **secure design** — which tools can't automate — remain essential. Testing finds implementation bugs; it doesn't replace designing securely.

### Q1. Compare SAST, DAST, and IAST.

Three vantage points on the same app:

| | SAST (static) | DAST (dynamic) | IAST (interactive) |
|---|---|---|---|
| What it analyzes | Source/bytecode, not running | Running app from outside | Running app, instrumented inside |
| Needs running app? | No | Yes (deployed) | Yes (with agent) |
| Pipeline stage | Early (commit/PR) | Late (staging/QA) | During functional tests |
| Sees code location? | Yes (line-level) | No (black box) | Yes |
| False positives | High (no runtime context) | Low (observed behavior) | Low–medium |
| Finds | Injection sinks, hardcoded secrets, insecure APIs | Config issues, auth flaws, runtime-only bugs | Both, with data-flow context |
| Blind to | Runtime/config, reachability | Code internals, unreached paths | Uninstrumented paths |

**SAST** reads code before it runs — earliest and cheapest to fix, but noisy because it can't tell if a "vulnerable" path is actually reachable. **DAST** behaves like an attacker hitting the deployed app — what it reports is real (low false positives) but it can't tell you *where* in the code the bug is and only tests what it can reach/crawl. **IAST** instruments the running app so it watches actual data flow from inside — combining SAST's code-level pinpointing with DAST's runtime truth, at the cost of setup and runtime overhead. Use them together; they cover each other's blind spots.

### Q2. Why does SAST produce so many false positives, and how do you manage them?

SAST reasons about code *without running it*, so it lacks the runtime context needed to know whether a suspicious pattern is actually exploitable. It sees "untrusted input flows into a SQL string" but often can't tell that the path is unreachable, that a sanitizer it doesn't recognize runs first, or that the input is actually trusted in context. When in doubt it flags — favoring recall over precision — which yields noise.

Why it matters: a scanner that cries wolf gets ignored. The single biggest failure mode of AppSec programs is drowning developers in thousands of unvalidated findings until they route around the gate.

Managing it:

- **Tune and baseline** — configure rules for your stack, suppress known-safe patterns with documented justifications, and baseline existing findings so only *new* ones gate.
- **Only fail the build on high-confidence, high-severity** findings; report the rest.
- **Scan the diff, not the whole repo** each PR, to keep it fast and focused.
- **Triage into the workflow** — route validated findings as tickets, mark false positives so they don't recur, and feed patterns back into rule tuning.

The goal is a high-signal gate developers *trust*, not maximal coverage.

### Q3. What is SCA / dependency scanning and why is it essential?

**Software Composition Analysis** inventories your third-party and open-source dependencies (direct and transitive) and flags those with **known CVEs** — and often license-compliance issues too.

Why it's essential: modern apps are mostly *other people's code* — frameworks, libraries, transitive dependencies — often 80–90% of the shipped bytes. "Vulnerable and Outdated Components" is its own OWASP Top 10 category precisely because a critical CVE in a popular library (Log4Shell being the canonical example) instantly exposes everyone using it. Your own code can be flawless and you're still breached through a dependency.

```
Your code (10%)         ← SAST/DAST/review focus here
Dependencies (90%)      ← SCA focuses here (known CVEs)
```

How to use it well: run it **in CI on every build** and gate on critical/high CVEs in *direct* dependencies; monitor continuously (a new CVE can be disclosed against a dependency you already shipped, so re-scan even without code changes); pin versions with lockfiles for reproducibility; and prioritize by *reachability and severity*, not raw count — a critical CVE in a code path you never call is lower priority than a high one you do. SCA is distinct from SAST: SCA looks *outward* at dependencies for *publicly-known* issues; SAST looks *inward* at your own code for *novel* ones.

### Q4. How does secret scanning work and where do you deploy it?

**Secret scanning** detects credentials — API keys, tokens, private keys, passwords, connection strings — that have been committed to source, config, or CI logs. It works by pattern-matching known credential formats (regexes for e.g. cloud-provider key prefixes), entropy analysis (high-randomness strings that look like keys), and provider-specific signatures; better tools also verify whether a found key is *live*.

Deploy it in layers (defense in depth):

- **Pre-commit hook** — catch the secret *before* it ever enters git history (cheapest place to fix; nothing to rotate).
- **CI / push scan** — a gate that fails the build if a secret is detected in the diff.
- **Repository history scan** — periodic full-history scan, because a secret committed once *stays in git history* even after you delete it in a later commit.

Critical nuance: **once a secret hits a shared repo, treat it as compromised and rotate it** — removing it from the latest commit doesn't remove it from history or from anywhere it was already cloned/cached. So secret scanning is really two jobs: *prevent* new leaks (pre-commit/CI) and *detect + trigger rotation* for ones that got through. Pair it with proper secrets management (Vault/cloud secret manager) so secrets aren't in the code to leak in the first place.

### Q5. What is fuzzing and what kinds of bugs does it find?

**Fuzzing** automatically feeds a program large volumes of malformed, random, or mutated inputs and watches for crashes, hangs, assertion failures, memory errors, or unexpected behavior. Modern **coverage-guided** fuzzers (AFL, libFuzzer) instrument the target and evolve inputs to maximize code coverage, efficiently reaching deep edge cases a human would never hand-write.

```
Seed inputs → mutate → feed to target → watch for crash/hang/sanitizer trip
     ↑___________ evolve toward new code coverage ___________|
```

What it finds:

- **Memory-safety bugs** in C/C++ — buffer overflows, use-after-free, out-of-bounds reads (especially paired with sanitizers like ASan). Links to the memory-safety topic.
- **Crashes and DoS** — inputs that hang, exhaust memory, or throw unhandled exceptions.
- **Parser/deserializer/protocol bugs** — anywhere untrusted, structured input is processed, in *any* language (not just C/C++).

Where it fits: fuzz the high-risk **input-parsing boundaries** — file format parsers, network protocol handlers, deserializers. It's excellent at the class of bugs that come from *unexpected input*, and continuous fuzzing (running it perpetually on evolving corpora) has found enormous numbers of real CVEs. Its limit: it finds crashes and edge cases, not authorization or business-logic flaws.

### Q6. How does penetration testing differ from an automated vulnerability scan?

A **vulnerability scan** is automated pattern-matching — a tool (SCA, DAST, network scanner) checks for known issues and misconfigurations at scale. A **penetration test** is a *human* expert simulating a real attacker against a defined scope, over a time box.

The decisive difference is **chaining and context**. A scanner reports isolated findings ("this parameter reflects input," "this endpoint lacks a header"). A pentester *combines* them — uses a low-severity info leak to find a valid user, an IDOR to reach another tenant, a logic flaw to escalate — reasoning about how findings compose into a real breach. Crucially, pentesters find **business-logic and authorization flaws** that scanners structurally cannot: "you can skip the payment step by reordering requests," "you can approve your own expense report." No tool understands your business rules.

```
Scanner:  breadth, automated, finds known patterns, isolated findings
Pentest:  depth, human, chains findings, finds logic/authz flaws
```

Use both: scanners for continuous broad coverage (cheap, frequent), pentests for periodic deep validation (expensive, targeted). A scan is a spell-checker; a pentest is an editor. Neither replaces the other, and neither proves the absence of vulnerabilities.

### Q7. What's the difference between penetration testing and red teaming?

Both are human adversarial testing, but with different goals and scope:

| | Penetration test | Red team |
|---|---|---|
| Goal | Find as many vulns as possible in scope | Achieve a specific objective ("exfiltrate the customer DB") |
| Scope | Defined, often narrow (an app, a range) | Broad — people, process, physical, and tech |
| Stealth | Usually overt; defenders may know | Covert; tests whether defenders *detect* |
| Tests | The system's vulnerabilities | The whole org's *detection and response* (blue team) |
| Duration | Days–weeks, time-boxed | Weeks–months, campaign-style |

A **pentest** answers "what's exploitable in this scope?" — breadth of findings. A **red team** answers "if a determined adversary targeted us with a goal, could they succeed *and would we notice*?" — it deliberately tests the **blue team's** detection and response, often including social engineering and physical access, staying stealthy. Red teaming is a maturity step above pentesting: you do it once your defenses are good enough that testing *detection* is worthwhile. The exercise where red and blue collaborate openly to improve both is called **purple teaming**. For most orgs, regular pentests come first; red teaming is for those with a mature security operations capability.

### Q8. How do bug bounties and responsible disclosure fit into a security program?

A **bug bounty** program pays external security researchers for validly-reported vulnerabilities under defined scope and rules. **Responsible (coordinated) disclosure** is the broader norm: a researcher reports a vulnerability *privately* and gives you reasonable time to fix it before any public disclosure.

Where they fit: bug bounties are **crowdsourced, continuous, incentive-aligned external testing** — thousands of diverse researchers probing your production system, finding what your internal process and scheduled pentests missed. You pay only for *valid, novel* findings (results-based), and the diversity of skills catches creative bugs a single pentest team wouldn't.

They *complement*, not replace, internal testing:

- You still shift left — a bounty finding is a bug that escaped to production, the most expensive place to catch one.
- You need a mature process first: a clear scope, a `security.txt` / disclosure policy, a triage team to handle reports (including the flood of duplicates and false positives), and a working remediation pipeline. Running a bounty with no capacity to triage and fix is counterproductive.
- Provide a **safe harbor** so good-faith researchers can report without legal risk, and always have a *coordinated disclosure* channel even if you don't pay bounties — otherwise researchers may go public (full disclosure) with a live bug.

The mental model: internal testing prevents; bug bounties catch the residual with the world's testing capacity.

### Q9. Design an AppSec testing pipeline that shifts security left.

Layer the techniques by *speed and stage*, fast/cheap early and deep/slow later, gating only on high-signal findings.

```
Developer / pre-commit:  secret scanning (pre-commit hook), IDE SAST hints
Pull request (fast):     incremental SAST on the diff, SCA on dependencies,
                         secret scan  → gate on high-confidence, high-severity
CI build:                artifact signing, IaC/config scanning
Nightly / staging:       full SAST, DAST against a deployed build, IAST during
                         integration tests, continuous fuzzing on parsers
Pre-release / periodic:  penetration test (human, logic + chaining)
Production / continuous: bug bounty, runtime monitoring, continuous SCA
                         (re-scan for newly-disclosed CVEs in shipped deps)
```

Design principles:

- **Fast checks in the PR, slow checks out-of-band.** Anything over a couple of minutes gets disabled; run full DAST/fuzzing nightly.
- **Gate on high-signal only.** Fail the build for leaked secrets and critical direct-dependency CVEs; *report* lower-confidence SAST rather than block, so the gate stays trusted (Q2).
- **Cover the blind spots deliberately.** Automated tools miss logic/authz flaws → add human pentest + bug bounty. Design flaws → add threat modeling upstream (SSDLC topic).
- **Triage into the dev workflow** — findings become tickets with severity and a fix; false positives are suppressed with justification and fed back into tuning.
- **Continuous, not point-in-time** — dependencies and threats change after release, so keep scanning production.

The theme: a *portfolio* of complementary techniques, placed where each is cheap, tuned so teams trust the gates.

### Q10. What are the limits of automated security testing?

Every technique has a hard ceiling, and stating them is the senior signal:

- **No tool proves absence of vulnerabilities.** Scanners match *known patterns*; a clean run means "found no known patterns," not "secure."
- **Business-logic flaws are invisible to tools.** "You can approve your own refund," "reorder the checkout steps to skip payment" — no scanner knows your business rules. Only humans (pentest) find these.
- **Authorization / IDOR is largely missed.** Tools can't tell that *this* user shouldn't access *that* object without understanding your access model.
- **SAST is noisy** (no runtime context → false positives); **DAST is shallow** (only reaches what it crawls, misses code location); **SCA only knows *published* CVEs** (nothing about zero-days or your own code); **fuzzing finds crashes, not logic.**
- **Design flaws are out of scope entirely** — an insecure architecture passes every scanner. Those need threat modeling in design (Q links to SSDLC).
- **Novel / chained attacks** require the human reasoning tools lack.

The conclusion: automation is *necessary and excellent* at the mechanical, high-volume classes (injection sinks, known CVEs, leaked secrets) — it scales in a way humans can't. But it must be *layered with* human pentesting, bug bounties, and, upstream, secure design and threat modeling. Automation catches the many; humans catch the subtle and the systemic.

### Q11. Your SAST tool reports 3,000 findings. Walk me through triage.

Three thousand raw findings is a signal problem, not a security posture — most will be false positives or noise, and the team will ignore the tool unless you make it trustworthy. Triage:

1. **Deduplicate and group** by rule and by root cause — 3,000 findings are often a few hundred underlying issues repeated.
2. **Prioritize by severity × confidence × reachability.** Start with high-severity, high-confidence findings on *reachable*, internet-facing code. Deprioritize low-severity or unreachable paths.
3. **Validate the top tier** — confirm a sample are genuinely exploitable (SAST over-reports). Confirmed criticals become tickets with an owner and a fix.
4. **Mark false positives** with documented justification so they're *suppressed and don't recur* — this is what keeps the tool credible.
5. **Baseline the backlog.** Accept existing findings into a managed backlog and configure the gate so only **new** findings introduced by a change can fail the build — you stop the bleeding without blocking all delivery.
6. **Feed back into tuning** — adjust/suppress noisy rules for your stack so the next scan is cleaner.

The governing principle from Q2: a scanner is only valuable if developers trust it. Triage is really *trust engineering* — convert a wall of noise into a small stream of validated, actionable, non-recurring findings.

### Q12. When would you choose IAST over running SAST and DAST separately?

**IAST** instruments the running application (an agent inside the runtime) and observes actual data flow during functional/integration tests — so it sees both the *code location* (like SAST) and the *real runtime behavior* (like DAST) simultaneously.

Choose/add IAST when:

- **You want SAST's precision without SAST's noise.** Because IAST observes *actual* execution and data flow, it confirms a vulnerable path is genuinely reached — dramatically fewer false positives than SAST, while still pointing at the exact line.
- **You already have good functional/integration test coverage.** IAST piggybacks on tests exercising the app — the more your tests hit, the more IAST covers. Its coverage is bounded by what your tests exercise (its main limit).
- **You want continuous, in-CI dynamic insight** without standing up and crawling a separate DAST target.

Tradeoffs: it requires **instrumentation** (an agent, runtime overhead) and is language/runtime-specific, and coverage is only as good as your test suite — code your tests never execute is invisible to it. So IAST doesn't fully *replace* the others in practice: many programs run SAST for breadth of code coverage, IAST for accurate runtime findings during testing, and DAST/pentest for the black-box external view. Reach for IAST when false-positive fatigue from SAST is hurting adoption and you have the test coverage to feed it.

### Q13. How would you test a file-upload feature for security?

File upload is a dense attack surface, so combine techniques against a threat-modeled list of what can go wrong:

**Threat-model first** (design): malicious file content (malware, web shells), type/extension spoofing, path traversal in the filename, oversized files (DoS), files served back and executed, XXE/zip-bombs in structured formats, SSRF if the server fetches by URL.

**Then test each:**

- **Type/extension bypass** — upload a `.php`/`.jsp` disguised as `.jpg`, mismatched `Content-Type` vs magic bytes. *Defense to verify:* validate by content (magic bytes), allowlist types, don't trust the extension.
- **Path traversal** — filenames like `../../etc/...`. *Defense:* generate server-side random names, never use the client filename for the storage path.
- **Executable upload** — can an uploaded file be served and *executed*? *Defense:* store outside the web root, serve from a separate no-exec domain with `Content-Disposition: attachment`, no execute permissions.
- **Content attacks** — XXE in uploaded XML/SVG, zip bombs, embedded scripts in SVG (stored XSS). *Defense:* disable external entities, sanitize/rasterize SVG, size/decompression limits.
- **DoS** — huge files, many files. *Defense:* size limits, rate limiting, async scanning.
- **Malware** — *Defense:* AV/malware scan on ingest.

**Techniques applied:** DAST/manual pentest for the bypass attempts, fuzzing the parser if you process file contents, SAST to spot the filename reaching a filesystem path, and design review for the "served from web root / executed" flaw a scanner won't catch. This shows the portfolio in action — no single tool covers it.

### Q14. How do you handle a vulnerability report that comes in through your disclosure channel?

Treat it as a mini incident-response with a coordination obligation to the reporter:

1. **Acknowledge quickly.** Confirm receipt within a stated SLA. Researchers who feel ignored go public; a prompt human reply buys goodwill and time.
2. **Triage and validate.** Reproduce it, assess severity (CVSS + business context), and de-duplicate against known issues. Distinguish real exploitable bugs from false positives — but err toward taking reports seriously.
3. **Remediate on a timeline proportional to severity.** Critical, actively-exploitable → emergency fix; lower severity → scheduled. Keep the reporter updated on progress; coordinated disclosure works because you communicate.
4. **Coordinate disclosure.** Agree a timeline for public disclosure *after* the fix ships; credit the researcher; pay the bounty if applicable.
5. **Close the loop internally.** Root-cause it, check for the same class elsewhere (a variant hunt — where there's one, there are often more), and add a regression test / SAST rule so it can't recur.

Underneath: have a published policy (`security.txt`, safe harbor for good-faith research), a triage owner, and a working remediation pipeline *before* reports arrive. The failure mode is receiving a valid report with no process — leading to a slow fix, an angry researcher, and a full public disclosure of a live bug. Responsible disclosure is a two-way contract: they give you time, you give them responsiveness and credit.

### Q15. If every scan passes, is the application secure? Explain.

No — and understanding why is the point. "All scans green" means "the tools found none of the *known patterns* they look for," which is a much weaker statement than "secure."

What passing scans do *not* tell you:

- **Business-logic flaws** — no scanner knows you can approve your own refund or skip the payment step.
- **Authorization / IDOR** — tools rarely understand your access model well enough to know user A shouldn't reach user B's object.
- **Design flaws** — an insecure architecture (bad trust boundary, missing tenant isolation) passes every scanner; those are caught by threat modeling, not testing.
- **Zero-days and novel bugs** — SCA only knows *published* CVEs; SAST/DAST match *known* patterns. Tomorrow's disclosed CVE in a dependency you shipped today was "clean" this morning.
- **Chained attacks** — individually-benign findings that compose into a breach need human reasoning.

Testing can prove *presence* of vulnerabilities, never their *absence* (Dijkstra's point, applied to security). So a truly defensible answer: green scans are necessary hygiene — they clear the mechanical, high-volume classes efficiently — but security is a *property built in* (secure design, threat modeling, least privilege) and *validated by layered testing* (automated tools + human pentest + bug bounty + continuous monitoring), not a checkbox a scanner ticks. Confidence comes from defense in depth across the whole SSDLC, not from a single passing run.
## Secrets Management & Supply-Chain Security

### Summary

**What this topic covers**

Two intertwined disciplines that both answer the question "can I trust the things my code depends on?" — the **secrets** it needs to run, and the **third-party code** it's built from. Secrets management covers where credentials, API keys, database passwords, and signing keys live (spoiler: never in git, never in a committed `.env`), how they're injected at runtime, how they rotate, and the shift from long-lived static secrets to short-lived **dynamic** ones. Supply-chain security covers the risk that comes from the hundreds of transitive dependencies in a modern build: **typosquatting** and **dependency confusion**, compromised maintainer accounts, malicious package updates (the SolarWinds and xz-utils incidents as the canonical cautionary tales), plus the defensive stack that has grown up in response — **SBOMs**, artifact **signing** (Sigstore/cosign), **SLSA** provenance, lockfiles and version pinning, and build-integrity guarantees. The 16 questions here move from "where do I put an API key" to "walk me through securing a build pipeline end to end."

**Mental model**

Two mantras. For secrets: **a secret in your source tree is already leaked** — git history is forever, repos get cloned, forked, and mirrored, and `.env` files end up in Docker images and CI logs. Treat the secret store (Vault, AWS Secrets Manager, GCP Secret Manager) as the single source of truth and inject at runtime; treat every secret as if it will one day leak, which makes **rotation** and short TTLs your real safety net. For supply chain: **you are running code from strangers on every `npm install`.** Your actual attack surface isn't your code, it's the closure of everything you import plus the pipeline that assembles it. The defensive frame is **provenance** — for every artifact you ship, can you prove *what source* built it, *on what builder*, *from what inputs*? Signing plus SLSA provenance turns "I hope this tarball is legit" into "I can verify this tarball came from our CI building our tagged commit."

**Key terms**

- **Secret** — any credential granting access: password, API key, token, private key, connection string.
- **Secrets manager** — a system (Vault, AWS/GCP/Azure secret managers) that stores, access-controls, audits, and rotates secrets.
- **Dynamic secret** — a credential generated on demand with a short TTL (e.g. Vault mints a DB user valid for 1 hour), vs a static long-lived one.
- **Rotation** — periodically replacing a secret so a leaked one has a bounded useful life.
- **SBOM (Software Bill of Materials)** — a machine-readable inventory of every component/dependency in an artifact (CycloneDX, SPDX formats).
- **Typosquatting** — publishing a malicious package with a name close to a popular one (`reqiests`, `crossenv`) hoping for a typo.
- **Dependency confusion** — tricking a build into pulling a public package that shadows an internal private one by the same name.
- **Lockfile** — a file (`package-lock.json`, `Cargo.lock`, `poetry.lock`) pinning exact resolved versions + hashes for reproducible installs.
- **Artifact signing** — cryptographically signing a build output so consumers can verify authenticity (Sigstore/cosign).
- **SLSA** — Supply-chain Levels for Software Artifacts; a framework of provenance/build-integrity requirements at increasing levels.
- **Provenance** — verifiable metadata about how an artifact was built (source, builder, inputs).

**Why interviewers ask this**

This topic separates engineers who've operated real systems from those who've only written features. A junior says "put the API key in an environment variable" and stops; a senior says "inject it from a secret manager, scope it to the workload identity, rotate it on a schedule, and alert on the day it's checked into git anyway." On supply chain, the junior treats dependencies as free and trusted; the senior can articulate *why* the ecosystem shipped SBOMs and Sigstore and can reason about dependency confusion as a concrete attack. Post-SolarWinds and post-xz, supply-chain literacy has become a baseline expectation for platform, DevOps, and security-adjacent roles. It also probes judgment: over-rotating breaks things, over-pinning stalls patching — interviewers want to see you balance.

**Common confusions**

- "Environment variables are secure storage" — they're an *injection mechanism*, not a store; env vars leak via crash dumps, `/proc`, child processes, and CI logs.
- "Encrypting the `.env` file in the repo is fine" — the decryption key has to live somewhere; you've just moved the problem, and history still holds old plaintext.
- "An SBOM makes me secure" — an SBOM makes you *knowable*; it tells you what you have so you can react fast when a CVE drops. It prevents nothing on its own.
- "Signing proves the code is safe" — signing proves *who* produced it and that it wasn't tampered with in transit. A signed malicious package is still malicious; provenance is authenticity, not benevolence.
- "Lockfiles are just for reproducibility" — they also pin hashes, which defends against a registry serving swapped content for a known version.
- "Rotating secrets is optional if they're strong" — strength limits guessing; rotation limits the *blast radius of a leak*, which is the more common failure.

**What follows from this topic**

Secrets and supply chain sit at the join of AppSec and infrastructure. Rotation and dynamic secrets connect directly to **cloud IAM** and the metadata-service identity model in the Network & Cloud topic. Signing and provenance reappear in **container image** security in the Container & Kubernetes topic, where the artifacts being signed are OCI images. Dependency scanning (SCA) is the AppSec-testing counterpart to the SBOM discussed here. And the whole topic is an instance of the OWASP category **Software & Data Integrity Failures** — trusting code, updates, and CI/CD pipelines without verifying integrity.

### Q1. Why is it dangerous to commit secrets to a git repository, even a private one?

**git history is permanent and distributed.** Deleting the secret in a later commit does nothing — it's still reachable in history, and every clone, fork, and CI checkout carries the full history. A private repo can become public, get mirrored, or be accessed by a compromised contributor account. Bots continuously scrape public git hosts for keys and often exploit them within minutes.

**The fix is layered:**
- Keep secrets out entirely — inject from a secret manager at runtime.
- Add a **secret scanner** (gitleaks, trufflehog, GitHub push protection) as a pre-commit hook and a CI gate so a leak is blocked before it lands.
- If one is already committed, **rotate it immediately** — treat it as compromised. Rewriting history (`git filter-repo`) removes it going forward but you must assume it was already harvested.

The mental rule: a secret that has ever touched your source tree is a secret you must rotate, not a secret you can un-leak.

### Q2. What's the difference between a secrets manager and just using environment variables?

They solve different halves of the problem, and the confusion is common.

| | Environment variable | Secrets manager |
|---|---|---|
| Role | Injection mechanism | Storage + access control + audit |
| Access control | Whoever can read the process env | Per-identity policy, fine-grained |
| Audit | None | Every access logged |
| Rotation | Manual redeploy | Automated, sometimes dynamic |
| Leak surface | crash dumps, `/proc`, child procs, CI logs | Centralised, revocable |

Environment variables are a fine *last hop* — the secret manager hands the value to the workload, which reads it from env or a mounted file. What you must avoid is treating env vars (or a committed `.env`) as the source of truth. The manager (Vault, AWS/GCP/Azure secret managers) owns the secret; the env var is a transient courier. Even then, prefer file-mounts or SDK fetches over env where you can, since env is broadly readable within a process tree.

### Q3. What are dynamic secrets and why are they better than static ones?

A **static secret** is a long-lived credential (a DB password) that you store, distribute, and hope never leaks. A **dynamic secret** is generated on demand for a specific consumer with a short TTL, then automatically revoked. Vault's database engine, for example, creates a unique DB user valid for one hour when a service starts, and drops it at expiry.

**Why it's stronger:**
- **Bounded blast radius** — a leaked credential is useless within the hour.
- **Attribution** — each consumer gets its own credential, so an audit log points at exactly who did what.
- **No rotation ceremony** — expiry *is* rotation; there's no fleet-wide password change to coordinate.

The tradeoff is operational complexity: you need the secret broker in the request path and your app must handle re-fetching on expiry. For high-value credentials (databases, cloud roles) it's well worth it; for a rarely-used third-party API key, static-with-rotation may be enough. This is the same "short-lived credential" principle behind cloud IAM role assumption and IMDSv2 tokens.

### Q4. Walk me through rotating a database credential with zero downtime.

The trap is that a naive rotation invalidates the old password while services are still using it. The standard pattern is **dual credentials / overlap**:

1. Provision a **second** credential (user B) alongside the current one (user A), both valid.
2. Update the secret store to serve B. Services pick up B on their next fetch (or restart), draining off A.
3. Once telemetry confirms no one is authenticating as A, **revoke** A.
4. Next cycle, the roles swap.

Dynamic secrets sidestep this entirely — each instance already has its own short-lived credential, so "rotation" is just expiry. For static secrets, the overlap window is the key idea: **never have a moment where the only valid credential is one nobody has yet.** Automate the whole thing; manual rotation is skipped rotation.

### Q5. What is dependency confusion and how do you defend against it?

**Dependency confusion** exploits how package managers resolve names across public and private registries. If your build references an internal package `@acme/auth` that lives only in a private registry, an attacker publishes a package named `@acme/auth` to the *public* registry with a higher version number. A misconfigured resolver, seeing "newer," pulls the public malicious one — which runs an install script on your build machine.

**Defenses:**
- **Scope/namespace** internal packages and reserve that scope on the public registry so no one else can claim it.
- Configure the package manager to fetch scoped names **only** from the private registry (scoped registry mapping), never falling back to public.
- **Pin exact versions and hashes** via lockfiles so an unexpected "newer" version can't silently win.
- Verify with tooling that no internal package name is resolvable publicly.

The root cause is implicit trust in name resolution; the fix is making the source of each name explicit and pinned.

### Q6. Explain typosquatting in package ecosystems and its mitigations.

**Typosquatting** is publishing a malicious package under a name one keystroke away from a popular one — `python-dateutil` vs `python-dateutils`, `lodash` vs `lodahs`, `crossenv` vs `cross-env`. A developer fat-fingers the install command or copies a bad tutorial, and the squatted package's install/postinstall script runs with their credentials.

**Mitigations:**
- **Pin dependencies in a lockfile** and review additions in code review — a new dependency line is a security-relevant diff.
- Use an **allowlist / internal proxy registry** so only vetted packages are installable.
- Run **SCA and malware scanning** that flags known-bad and newly-published low-reputation packages.
- Disable or sandbox **install scripts** where the ecosystem allows (`npm ci --ignore-scripts` for builds that don't need them).

The broad lesson: `add dependency` is a trust decision, and the moment of adding is the cheapest place to catch a bad name. Automate the check so a human typo doesn't become a compromise.

### Q7. What is an SBOM and what does it actually buy you?

An **SBOM (Software Bill of Materials)** is a machine-readable manifest of every component in an artifact — direct and transitive dependencies, versions, licenses, hashes — in a standard format (CycloneDX or SPDX).

What it buys you is **speed of response, not prevention.** When a critical CVE lands (think Log4Shell), the org-wide question is "are we affected, and where?" Without SBOMs that's a frantic manual audit across every service. With SBOMs it's a query: grep your inventory for the vulnerable component and version range, and you have your exposure list in minutes.

```text
CVE drops  ->  query SBOM inventory  ->  "services X, Y ship log4j 2.14"  ->  patch those
```

Generate an SBOM at build time (it reflects what actually shipped, not what the manifest claimed), store it as a build artifact, and feed it into a continuous vulnerability scanner so new CVEs against old builds surface automatically. An SBOM you generate once and file away is far less useful than one wired into monitoring.

### Q8. How does artifact signing (Sigstore/cosign) improve supply-chain security?

Signing lets a consumer **verify who produced an artifact and that it hasn't been tampered with** since. You sign a build output (container image, package, binary) with a private key; consumers verify with the public key before trusting it.

**Sigstore** made this practical by removing the hardest part — key management. Instead of long-lived signing keys you have to protect, cosign uses **keyless signing**: it authenticates the signer via an OIDC identity (e.g. the CI workflow's identity), gets a short-lived certificate from the Fulcio CA, signs, and records the signature in the **Rekor** public transparency log. Verification checks the signature, the certificate's identity, and the transparency-log entry.

```bash
# sign an image with the CI workflow identity (keyless)
cosign sign $IMAGE
# consumer verifies signer identity before deploy
cosign verify --certificate-identity=... --certificate-oidc-issuer=... $IMAGE
```

Crucially, **signing proves authenticity, not safety.** A signed image built from compromised source is still compromised — but you at least know it genuinely came from your pipeline, and admission control can *reject anything unsigned.*

### Q9. What is SLSA and what problem does provenance solve?

**SLSA (Supply-chain Levels for Software Artifacts)** is a framework describing increasing guarantees about *how* an artifact was built, expressed as levels. The core deliverable is **provenance**: signed, verifiable metadata stating "this artifact was built from *this* source commit, by *this* builder, using *these* inputs."

The problem it solves is the SolarWinds-class attack: the source was clean, but the **build system** was compromised and injected malicious code during compilation. Reviewing source or signing the output doesn't catch that — the malicious bits were added between source and artifact. Provenance closes the gap by making the build itself attestable:

- Higher SLSA levels require a **hardened, isolated builder**, **non-falsifiable provenance**, and that the build be **reproducible/scripted** rather than run on a developer's laptop.
- Consumers verify provenance before deploying — "was this built by our trusted CI from our tagged commit?" If not, reject.

The mental shift: trust the **process**, not just the artifact. SLSA gives you a ladder to climb rather than an all-or-nothing target.

### Q10. Why are lockfiles and version pinning a security control, not just a reproducibility feature?

A lockfile records the **exact resolved version and content hash** of every dependency. That has two security effects beyond "my teammate gets the same versions":

1. **Prevents silent substitution.** With a floating range like `^1.2.0`, a compromised `1.2.7` published tomorrow gets pulled on the next CI run with no diff and no review. A pinned lockfile means version changes are explicit commits that go through code review.
2. **Detects tampering.** The recorded hash is verified on install (`npm ci`, `pip install --require-hashes`). If a registry serves swapped content for a known version, the hash mismatch fails the build.

The tension is with **patching**: aggressive pinning can leave you on vulnerable versions if you never update. The resolution is *pin + automate updates* — pin for reproducibility and review, and run an automated dependency updater (Dependabot/Renovate) that opens reviewable PRs so security patches flow in deliberately rather than automatically or never.

### Q11. Conceptually, what happened in the SolarWinds and xz-utils incidents, and what defenses address that class?

Both are **build/maintainer supply-chain compromises**, not vulnerabilities in the victims' own code.

- **SolarWinds (conceptually):** attackers compromised the *build pipeline* and injected a backdoor into the software during the build, so customers received a **validly signed** update carrying malicious code. Source review wouldn't catch it; the artifact was tampered with after source.
- **xz-utils (conceptually):** a long-game **social-engineering** compromise of an open-source project's maintainership introduced a hidden backdoor into a widely-used compression library over time, buried in test/build artifacts to evade casual review.

**Defenses for this class:**
- **Build integrity / SLSA provenance** — attest and verify how artifacts were built, catching the SolarWinds-style injection.
- **Reproducible builds** — independent rebuilds produce identical output, so a tampered build is detectable.
- **Reduce and vet dependencies**, watch for suspicious maintainer changes, and scan build artifacts (not just source).
- **Least privilege in CI** — a compromised build step shouldn't hold broad signing/deploy power.

The unifying lesson: the source, the maintainer, and the builder are all trust boundaries, and each needs verification.

### Q12. How would you secure a CI/CD pipeline against supply-chain attacks?

The pipeline is a high-value target: it has credentials, signs artifacts, and pushes to production. Harden it in layers.

- **Least-privilege, short-lived credentials.** No long-lived cloud keys in CI; use OIDC-federated, workload-scoped identities that mint short-lived tokens per job. A build job that only reads shouldn't hold deploy rights.
- **Pin everything the pipeline consumes** — base images by digest, third-party CI actions/plugins by commit SHA (not a floating tag an attacker can move), dependencies by lockfile hash.
- **Isolate builds** — ephemeral runners, no shared mutable state between jobs, no network egress beyond what's needed (blocks exfiltration and dependency-confusion pulls).
- **Sign artifacts and generate provenance** (cosign + SLSA) at build time; **verify** them at deploy time via admission control.
- **Scan in-pipeline** — SCA for known-vulnerable deps, secret scanning, SBOM generation.
- **Protect the pipeline definition** — the workflow YAML is code; require review, protect the branch, and audit who can edit it.

The frame: treat CI as production. Its compromise is more dangerous than a single app's, because it can poison *every* artifact.

### Q13. A teammate proposes storing the production API key in a Kubernetes ConfigMap so all pods can read it. What's wrong and what's the fix?

**ConfigMaps are not secrets.** They're stored and displayed as plaintext, readable by anyone with `get configmap` in the namespace, and routinely dumped into logs and `kubectl describe` output. Putting a credential there is barely better than committing it.

**The fix, in order of preference:**
1. **External secret manager + injection** — keep the key in Vault/cloud secret manager and inject it via a CSI driver or an operator (External Secrets Operator) that syncs it in at runtime. The cluster never permanently stores the plaintext.
2. **Kubernetes Secrets with encryption at rest enabled** — a real minimum; note that base64 is *encoding, not encryption*, so you must enable etcd encryption-at-rest and lock down RBAC on secret access.
3. **Workload identity** — better still, avoid the static key entirely: give the pod a cloud identity so it authenticates to the API without a stored credential.

Then scope RBAC tightly, don't mount secrets the pod doesn't need, and prefer file-mounts over env to reduce accidental logging. This connects directly to the secrets-in-containers question in the Kubernetes topic.

### Q14. How do you reduce third-party dependency risk without freezing your stack?

The goal is fewer, better-understood, verifiable dependencies — while still patching. A practical program:

- **Minimize surface.** Every dependency is trust you've extended. Prefer the standard library or a small vetted set over pulling a package for a one-line utility. Audit and prune periodically.
- **Vet on entry.** New dependencies go through review: maintenance health, download reputation, maintainer count, whether it runs install scripts. Adding a dep is a security decision.
- **Pin + automate updates.** Lockfile-pin for reproducibility, and run Dependabot/Renovate so patches arrive as reviewable PRs — you get currency *and* control.
- **Continuous SCA.** Scan the dependency tree against CVE databases in CI and continuously against your SBOM, so newly-disclosed vulns in already-shipped versions surface.
- **Proxy/allowlist registry.** Pull through an internal proxy that caches vetted versions and blocks unknown packages — this also kills dependency confusion and typosquatting.

The balance point: don't chase zero dependencies (impractical) or blind auto-merge of every update (its own supply-chain risk) — vet on entry, pin, and patch deliberately.

### Q15. What should never be logged, and how does that intersect with secrets management?

Logs are widely readable, long-retained, shipped to third-party aggregators, and rarely access-controlled as tightly as the secret store — so anything sensitive in a log has effectively escaped your careful secrets handling.

**Never log:** passwords or password hashes, API keys/tokens, session tokens and cookies, private keys, full card numbers (PCI), and personal data beyond what's necessary (ties to the privacy/PII topic). Also beware logging *entire request/response objects* or exception contexts that embed auth headers or credential-bearing URLs.

**Controls:**
- **Redaction/scrubbing** at the logging layer — filter known-sensitive keys (`authorization`, `password`, `token`) before write.
- **Never interpolate secrets into error messages or URLs** (`https://user:pass@host` leaks on any log of the URL).
- **Log the fact, not the value** — "auth failed for user alice," never the credential tried.
- **Secret scanning on log pipelines** and short retention for anything that might catch a stray value.

It's the same principle as keeping secrets out of git: a secret is only as protected as the *most* exposed place it lands, and logs are usually that place.

### Q16. Threat-model the flow of a secret from creation to use. Where are the exposure points?

Trace the lifecycle and put a control at each boundary:

```text
create -> store -> distribute -> use -> rotate -> revoke
  |         |          |          |        |         |
 weak     plaintext  in transit  in mem  stale     lingering
 gen      / no ACL    / logged   / dumps  secret    access
```

- **Creation** — use strong randomness (a CSPRNG); a predictable secret is broken before it's stored.
- **Storage** — the secret manager, access-controlled and audited; never a repo, ConfigMap, or plaintext file. Encrypt at rest.
- **Distribution** — inject over TLS/mTLS at runtime; the risk is leaking in CI logs, env dumps, or crash reports. Prefer file-mount or SDK fetch over broadly-readable env.
- **Use** — in application memory; risks are memory dumps, logging the value, and over-broad process access. Minimize lifetime in memory, never log it.
- **Rotation** — short TTLs / dynamic secrets bound the damage of any leak along the path.
- **Revocation** — ensure a rotated or offboarded secret is actually invalidated; a "rotated" secret that still works is not rotated.

The through-line: every hop is a trust boundary, the biggest real-world leaks are at *distribution* (logs, CI, env), and **rotation is the compensating control** for the leaks you didn't prevent. This is defense-in-depth applied to a single credential's life.

## Network, Transport & Cloud Security

### Summary

**What this topic covers**

How data is protected **in transit** and how infrastructure is secured at the **network and cloud** layers. On the transport side: **TLS/mTLS**, how the handshake establishes an encrypted authenticated channel, **certificate validation**, certificate **pinning** and its tradeoffs, and **HSTS**. On the network side: firewalls, **network segmentation**, the shift from perimeter/VPN thinking to **zero trust** ("never trust, always verify"), and DDoS basics. On the cloud side — where most modern breaches actually happen — **IAM least privilege**, **cloud misconfiguration** (public storage buckets, over-permissive roles), the **shared responsibility model**, security groups, the instance **metadata service** and its link to **SSRF** (IMDSv2 as the fix), and the tooling that keeps it honest: **CSPM** and **IaC scanning**. The 16 questions run from "how does TLS work" to "audit this cloud account for the misconfigurations that cause breaches."

**Mental model**

Two shifts. First, **transport security is about a channel with three properties**: confidentiality (encryption), integrity (tamper-detection), and *authentication* (you're talking to who you think). People fixate on encryption and forget the third — an encrypted channel to an attacker is useless, which is why **certificate validation is the load-bearing part** of TLS, not the cipher. Second, **the network perimeter is dead.** The old model was a hard shell (firewall/VPN) around a soft trusted interior; once you're "inside," you're trusted. Cloud, mobile, and microservices dissolved the inside/outside line, and attackers who breach one host move laterally through the trusting interior. **Zero trust** replaces "trusted network location" with "verify identity and authorization on every request, everywhere." In cloud specifically, the mental model is **identity is the new perimeter** — IAM misconfiguration, not a firewall hole, is the modern breach vector, and most cloud breaches are *your* misconfiguration, not the provider's flaw.

**Key terms**

- **TLS** — Transport Layer Security; encrypts and authenticates a channel (the S in HTTPS).
- **mTLS** — mutual TLS; both client and server present certificates, so each authenticates the other.
- **Certificate validation** — verifying a presented cert chains to a trusted CA, matches the hostname, and isn't expired/revoked.
- **Certificate pinning** — hardcoding an expected cert/key so only that exact one is accepted, even if another CA would vouch for a different one.
- **HSTS** — HTTP Strict Transport Security; a header telling browsers to only ever connect over HTTPS.
- **Network segmentation** — dividing a network into isolated zones so a breach in one can't reach the others.
- **Zero trust** — an architecture that trusts no network location and verifies identity + authorization per request.
- **IAM** — Identity and Access Management; who (principals) can do what (permissions) on which resources.
- **Least privilege** — granting the minimum permissions needed, nothing more.
- **Shared responsibility model** — the split of security duties between cloud provider (of the cloud) and customer (in the cloud).
- **Security group** — a virtual stateful firewall around a cloud instance/resource.
- **IMDS** — Instance Metadata Service; a link-local endpoint giving a VM its identity/credentials (IMDSv2 is the hardened version).
- **CSPM** — Cloud Security Posture Management; continuous scanning for cloud misconfiguration.

**Why interviewers ask this**

"Walk me through the TLS handshake" is a classic depth probe: anyone can say "it's encrypted," but explaining key exchange, certificate authentication, and forward secrecy shows real understanding. The cloud questions have become the highest-signal part of a modern security interview because **the majority of real breaches now trace to cloud misconfiguration** — a public S3 bucket, an over-permissive role, an SSRF that stole IMDS credentials. A senior candidate reasons about least privilege, the shared responsibility split (and how often people misunderstand which side they're on), and defense in depth across network + identity. Zero trust probes whether you understand *why* the perimeter model failed, not just the buzzword. Interviewers are checking you can secure systems, not just apps.

**Common confusions**

- "HTTPS means the site is safe/trustworthy" — it means the *channel* is encrypted and authenticated to a domain; a phishing site can have a valid cert. TLS secures transport, not intent.
- "TLS is about the cipher" — the encryption is rarely the weak point; **certificate validation** is. Disabling cert verification "to make it work" reopens the whole channel to interception.
- "A VPN is zero trust" — a VPN is perimeter thinking (get inside, then trust). Zero trust verifies every request regardless of network location.
- "The cloud provider secures my data" — under shared responsibility they secure the infrastructure; *you* secure your configuration, IAM, and data. A public bucket is your fault, not theirs.
- "IAM roles are safer than keys so I can be generous" — over-permissive roles are the number-one cloud misconfig; a role is only safe if it's least-privilege.
- "SSRF is just a web bug" — in cloud it's catastrophic because it can reach the metadata service and steal instance credentials (which is exactly what IMDSv2 defends against).

**What follows from this topic**

This is the infrastructure counterpart to the app-layer topics. **SSRF** appears here in its most dangerous form (metadata credential theft) — the web-layer mechanics live in the request-attacks topic. IAM least privilege is the cloud instantiation of the **authorization** principles from the access-control topic. mTLS and workload identity connect to **service-to-service auth** and to the **secrets** topic (short-lived credentials over long-lived keys). And container/Kubernetes security in the next topic sits *on top* of this cloud-network foundation — network policies are segmentation, pod identity is IAM.

### Q1. Walk me through the TLS handshake. What does it actually accomplish?

TLS establishes a channel that is **confidential, integrity-protected, and authenticated**. Simplified (TLS 1.3):

```text
Client                                    Server
  | ---- ClientHello (ciphers, key share) --> |
  | <-- ServerHello (chosen cipher, key share)|
  | <-- Certificate (+ signature) ----------- |
  |  [both derive shared secret via ECDHE]    |
  | <-- Finished ---------------------------- |
  | ---- Finished --------------------------> |
  |  === encrypted application data ========= |
```

Three things happen:
1. **Key exchange** — both sides do an ephemeral Diffie-Hellman (ECDHE) to derive a shared symmetric key *without ever sending it*. Ephemeral keys give **forward secrecy**: capturing today's traffic and stealing the server key later still can't decrypt it.
2. **Authentication** — the server sends a **certificate**; the client verifies it chains to a trusted CA, matches the hostname, and is unexpired. This is the part that stops you talking to an impostor. The server proves it holds the matching private key.
3. **Symmetric encryption** — the derived key encrypts application data with an AEAD cipher (AES-GCM), which provides both confidentiality and integrity.

TLS 1.3 cut the handshake to one round trip and removed legacy weak options. The critical insight: encryption is the easy part; **the certificate validation is what makes it secure**.

### Q2. What's the difference between TLS and mTLS, and when do you use each?

In standard **TLS**, only the *server* authenticates with a certificate; the client verifies the server but the server identifies the client some other way (password, token). In **mutual TLS (mTLS)**, *both* sides present certificates, so each cryptographically authenticates the other.

| | TLS | mTLS |
|---|---|---|
| Server auth | Yes | Yes |
| Client auth | No (separate mechanism) | Yes, via client cert |
| Typical use | Public web (browsers) | Service-to-service, internal APIs |

**Use plain TLS** for public-facing endpoints — you can't provision certs to every browser, so clients authenticate with credentials over the TLS channel. **Use mTLS** for machine-to-machine trust: microservice-to-microservice calls, service meshes (Istio/Linkerd issue and rotate workload certs automatically), and zero-trust internal networks where you want cryptographic identity on both ends rather than trusting network location. mTLS is a core building block of zero trust — every service proves who it is on every connection.

### Q3. Why is certificate validation so important, and what goes wrong when developers disable it?

Certificate validation is the step that guarantees you're talking to the *real* server and not a machine-in-the-middle. Without it, an attacker on the path presents their own certificate, the client accepts it, and the "encrypted" channel is encrypted *to the attacker*, who reads and modifies everything before forwarding.

The classic anti-pattern is disabling verification to silence an error in dev:

```python
# VULNERABLE - accepts any certificate, enables MITM
requests.get("https://api.acme.com", verify=False)

# FIXED - validate against trusted CAs (default)
requests.get("https://api.acme.com")  # verify=True by default
```

`verify=False` (or `rejectUnauthorized: false`, or a no-op `TrustManager` in Java) turns TLS into "encryption to whoever answers" — it defeats the entire authentication purpose while *looking* secure because the URL still says `https`. If a cert genuinely fails, fix the root cause (install the CA, fix the hostname, renew the cert). Never ship code that disables validation; it's one of the most common real-world TLS vulnerabilities.

### Q4. What is certificate pinning and what are its tradeoffs?

**Pinning** hardcodes the specific certificate or public key your client expects, so it rejects *any* other cert — even one a valid CA would vouch for. Normal validation trusts ~hundreds of CAs; pinning narrows that to exactly the key(s) you chose.

**Benefit:** it defeats a compromised or coerced CA. Even if an attacker gets a *validly-issued* cert for your domain from some CA, a pinned client won't accept it. Valuable for mobile apps talking to their own backend, where you control both ends.

**Tradeoffs — and why it's often avoided:**
- **Operational fragility.** Rotate or renew the cert without shipping an updated pin and every client breaks. This has caused real outages.
- **Update coupling.** For mobile you must push an app update to change pins — slow and incomplete (users on old versions).
- **Bricking risk.** A bad pin can lock every user out with no server-side fix.

Mitigate by **pinning the public key** (survives cert renewal if the key is reused) and **pinning a backup key**. Modern guidance is cautious: use it for high-value mobile-to-own-backend links, generally avoid it for web (where HSTS + normal PKI + CT logs cover most of the threat), and never pin without a rotation plan.

### Q5. What does HSTS do and what attack does it prevent?

**HSTS (HTTP Strict Transport Security)** is a response header that tells the browser "for the next N seconds, only ever connect to this domain over HTTPS — never plain HTTP, and don't let the user click through cert warnings."

```http
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

It defends against **SSL-stripping** and downgrade attacks. Without HSTS, a user typing `acme.com` first hits `http://`, and an on-path attacker can intercept that plaintext request and keep the whole session on HTTP (or a lookalike), stripping the redirect to HTTPS. With HSTS remembered, the browser upgrades to HTTPS *before* sending anything, so there's no plaintext request to hijack.

The gap is the *very first* visit before the header is seen. The **preload list** closes it — domains on the browser-baked-in HSTS preload list are HTTPS-only from the first byte, even on a fresh browser. Set a long `max-age`, include subdomains carefully, and preload for high-value domains.

### Q6. Explain network segmentation and why it matters even inside a "trusted" network.

**Segmentation** divides a network into isolated zones with controlled traffic between them, so compromising one zone doesn't grant reach to the rest. Classic example: put the database in a private subnet that only the app tier can reach, never the public internet or the web tier directly.

Why it matters even internally: attacks rarely stop at the first host. An attacker who phishes a laptop or pops one service wants to **move laterally** to higher-value targets. A flat network lets them reach everything; a segmented one forces them to breach each boundary, generating detectable signal and buying defenders time.

```text
Internet -> [WAF] -> Web tier -> [seg] -> App tier -> [seg] -> DB (private)
                        no direct Internet->DB or Web->DB path
```

This is **defense in depth** and **least privilege** applied to the network: each zone reaches only what it must. It's also the on-prem ancestor of cloud **security groups** and Kubernetes **network policies** — same idea at different layers. Microsegmentation (per-workload policy) pushes this to its zero-trust conclusion.

### Q7. What is zero trust, and how is it different from a VPN/perimeter model?

**Zero trust** is an architecture whose motto is **"never trust, always verify."** It assumes no network location is inherently trustworthy — not even "inside the corporate network" — and enforces authentication and authorization on *every* request, based on identity and context, not on where the request came from.

The **perimeter/VPN** model is the opposite: a hard boundary (firewall, VPN) separates a trusted inside from an untrusted outside. Get past the perimeter (VPN in, or breach one host) and you're on the trusted network with broad implicit access.

| | Perimeter / VPN | Zero trust |
|---|---|---|
| Trust basis | Network location ("inside") | Verified identity per request |
| After breach | Lateral movement is easy | Every hop re-verified |
| Enforcement | At the boundary | Everywhere, continuously |

Why perimeter failed: cloud, remote work, mobile, and microservices erased the clean inside/outside line, and flat trusted interiors let one breach become total compromise. Zero trust rebuilds security around **identity + least privilege + continuous verification** — mTLS between services, per-request authorization, device posture checks, and no standing implicit trust. A VPN can be *part* of a zero-trust setup, but a VPN alone is still perimeter thinking.

### Q8. Explain the cloud shared responsibility model. Who secures what?

The provider secures the cloud; you secure what you put in it. The line moves with the service type.

- **Provider ("security *of* the cloud")** — physical data centers, hardware, hypervisor, the managed-service control plane, and the underlying network fabric.
- **Customer ("security *in* the cloud")** — your data, IAM configuration, network/firewall rules, OS and patching (for IaaS), application code, and encryption choices.

```text
IaaS (VM):     you patch OS, app, data, IAM, network   | provider: hardware/hypervisor
PaaS (managed  you handle data, IAM, app config         | provider: OS + runtime
  DB/queue):
SaaS:          you handle data + access config           | provider: nearly everything else
```

The higher up the stack (IaaS -> PaaS -> SaaS) the more the provider handles, but **you never fully offload — data and access control are always yours.** The most common and costly misunderstanding is assuming the provider secures your *configuration*: a public S3 bucket or an over-permissive role is entirely the customer's responsibility. Most cloud breaches are customer-side misconfigurations, not provider failures. Knowing exactly where the line sits for each service you use is the practical skill.

### Q9. What are the most common cloud misconfigurations that lead to breaches, and how do you prevent them?

A short list causes a large share of real cloud breaches:

- **Public storage buckets** — object storage left world-readable/writable, exposing data dumps. *Prevent:* enable account-level "block public access," default to private, audit continuously with CSPM.
- **Over-permissive IAM** — roles/users with wildcard permissions (`*:*`) far beyond need. *Prevent:* least privilege, scope policies to specific actions/resources, use access analyzers to flag unused/excess grants.
- **Open security groups** — inbound `0.0.0.0/0` on admin ports (SSH/RDP/database). *Prevent:* restrict source ranges, no direct internet on data stores, use bastions/SSM.
- **Unencrypted data at rest** — buckets/volumes/snapshots without encryption. *Prevent:* enforce default encryption via policy.
- **Exposed metadata / IMDSv1** — SSRF-reachable instance credentials. *Prevent:* enforce IMDSv2.
- **Hardcoded/long-lived keys** — static access keys in code or CI. *Prevent:* short-lived role assumption, workload identity.

The umbrella prevention is **guardrails, not vigilance**: policy-as-code (SCPs/org policies) that make the insecure state *impossible*, plus **CSPM** for continuous detection and **IaC scanning** to catch misconfig before it's ever deployed. Humans forget; policy doesn't.

### Q10. What is the instance metadata service (IMDS) and how does it connect to SSRF?

The **instance metadata service** is a link-local endpoint (a well-known non-routable address) that a cloud VM queries to learn about itself — including, critically, **temporary credentials for its attached IAM role**. Legitimate SDKs use it so code doesn't need hardcoded keys.

The danger is its combination with **SSRF (Server-Side Request Forgery)**. If your app can be tricked into fetching an attacker-supplied URL, the attacker points it at the metadata endpoint, and the app dutifully retrieves the instance's IAM credentials and hands them back:

```text
attacker -> your app: "fetch http://<metadata-ip>/.../security-credentials/role"
your app -> metadata service -> returns temp creds
your app -> attacker: (creds)   ==> attacker now acts as the instance's role
```

This is exactly how several major cloud breaches happened.

**Defenses (layered):**
- **IMDSv2** — requires a session token obtained via a PUT with a hop-limit, which a simple SSRF GET can't perform; enforce it and disable IMDSv1.
- **Fix the SSRF** — allowlist outbound destinations, block link-local/metadata ranges, don't let user input drive server-side fetch targets.
- **Least privilege on the instance role** — so stolen credentials are worth as little as possible.

It's the sharpest example of why SSRF is far more dangerous in cloud than the "just an internal request" framing suggests.

### Q11. How do IAM least privilege and role assumption reduce blast radius?

**Least privilege** means every principal (user, service, workload) holds only the permissions it actually needs. Its purpose is **blast-radius reduction**: when — not if — a credential leaks or a service is compromised, the attacker inherits exactly that principal's permissions and no more. A tightly-scoped role that can read one bucket is a contained incident; an admin role is a company-ending one.

**Role assumption** strengthens this with **short-lived, on-demand credentials**. Instead of long-lived access keys, a workload *assumes a role* and gets temporary credentials that expire in minutes/hours. Combined with **workload identity** (the pod/VM authenticates by its platform identity, no stored key at all), you get:

- No static secret to leak.
- Automatic expiry — a stolen credential dies quickly.
- Clear attribution in audit logs.

Practically: scope policies to specific actions and resource ARNs (never `*:*`), separate roles per service, use permission boundaries and access analyzers to catch over-grants, and prefer assumed roles / federated identity over static keys. This is the cloud instantiation of the same least-privilege principle from application authorization — and it pairs with the dynamic-secrets idea from the supply-chain topic.

### Q12. What is CSPM and how does IaC scanning complement it?

**CSPM (Cloud Security Posture Management)** continuously scans your *running* cloud environment against a baseline of best practices and compliance rules, flagging misconfigurations — public buckets, open security groups, unencrypted volumes, over-permissive roles, IMDSv1 enabled. It answers "what's wrong right now?" across accounts you may not even remember creating.

**IaC scanning** shifts that check **left**, into the pipeline. Since infrastructure is defined as code (Terraform, CloudFormation), you scan the *definition* before it's applied — catching a `public-read` bucket or a `0.0.0.0/0` rule in the pull request, before it ever exists.

```text
IaC scan (pre-deploy, in CI)  ->  infra applied  ->  CSPM (post-deploy, continuous)
   catches misconfig in code                          catches drift + out-of-band changes
```

They're complementary because neither alone is sufficient: IaC scanning misses **drift** (someone clicks a change in the console) and resources created outside IaC; CSPM catches those but only *after* they're live and exposed. Together they give you prevention (IaC scan) plus detection (CSPM) — shift-left plus continuous monitoring, the same defense-in-depth pattern as SAST-plus-DAST in AppSec testing.

### Q13. How would you protect a service against DDoS at a high level?

A **DDoS (Distributed Denial of Service)** attack overwhelms a service with traffic from many sources to exhaust its capacity. You can't out-provision a large botnet on your own, so the strategy is **absorb, filter, and scale** using layered defenses — mostly upstream of your origin.

- **Volumetric (L3/L4) floods** — massive raw traffic. *Defense:* upstream scrubbing via a CDN / cloud DDoS-protection / anycast network that absorbs and disperses it across a huge edge, keeping it far from your origin. Don't expose origin IPs directly.
- **Protocol attacks** (SYN floods, etc.) — *Defense:* SYN cookies, stateful firewalls, provider-level mitigation.
- **Application-layer (L7) attacks** — fewer requests but expensive ones (costly queries, login endpoints). *Defense:* **WAF** rules, **rate limiting** per IP/identity, CAPTCHAs on abuse-prone endpoints, caching to keep load off origin, and autoscaling to ride out spikes.

Round it out with **rate limiting and quotas** as standing defense, graceful degradation / load shedding so the whole service doesn't collapse, and an **incident runbook** (who to call, how to enable "attack mode"). The unifying idea: push mitigation to the edge, keep expensive work behind caches and limits, and design to degrade rather than fall over.

### Q14. Spot the security problem: an internal microservice is reachable directly from the public internet on `0.0.0.0/0`. Walk me through fixing it.

The problem is **exposed attack surface** — an internal service that should only receive traffic from other internal services is listening to the entire internet. Every vulnerability it has (an unauthenticated admin endpoint, an old CVE, an injection bug) is now globally reachable, and it likely wasn't hardened for hostile exposure because "it's internal."

**Fix, defense in depth:**
1. **Network layer** — change the security group to allow inbound *only* from the specific source (the app tier's security group or CIDR), not `0.0.0.0/0`. Better, move it into a **private subnet** with no internet route at all; front any legitimate external access with a load balancer/API gateway.
2. **Identity layer** — don't rely on network position alone (zero trust). Require **mTLS or authenticated tokens** between services so even an on-network caller must prove identity.
3. **Detection** — audit how it got exposed (IaC scan should have caught it; add the rule), and check logs for whether it was already probed/abused.
4. **Prevent recurrence** — a guardrail policy that blocks `0.0.0.0/0` on internal-tier security groups, enforced in CI via IaC scanning and continuously via CSPM.

The lesson ties segmentation and zero trust together: fix the network exposure *and* remove the implicit "internal = trusted" assumption.

### Q15. Compare security groups, NACLs, and network policies — where does each fit?

They're firewalls at different layers, and interviewers like to see you place each correctly.

| | Security group | NACL | Network policy (K8s) |
|---|---|---|---|
| Scope | Per instance/resource | Per subnet | Per pod (by label) |
| State | Stateful (return traffic auto-allowed) | Stateless (must allow both directions) | Stateful |
| Rules | Allow-only | Allow + explicit deny | Allow-only (default-deny once applied) |
| Layer | Cloud VM/ENI | Cloud subnet boundary | Kubernetes overlay network |

- **Security groups** are your primary instance-level control — stateful and allow-only, attach one per role (web SG, app SG, db SG) and reference SGs as sources for clean tiering.
- **NACLs** are a coarse subnet-wide backstop, stateless, and support explicit *deny* (useful for blocking a bad IP range across a whole subnet). Defense-in-depth beneath security groups.
- **Network policies** move the same segmentation idea *inside* Kubernetes, controlling pod-to-pod traffic by label — covered more in the container topic.

All three implement the same principle — **segmentation and least-privilege network access** — but at instance, subnet, and pod granularity respectively. Layering them is defense in depth; the key gotcha to state is stateful-vs-stateless (NACLs need explicit return rules, security groups don't).

### Q16. Threat-model a public API endpoint exposed through a cloud load balancer. What are the trust boundaries and controls?

Trace the path and place a control at each boundary:

```text
Internet | Edge/CDN+WAF | Load balancer(TLS) | App tier | Data tier(private)
   T1          T2              T3                T4          T5
```

- **T1 Internet -> edge** — hostile by default. Controls: DDoS protection, WAF (injection/bot rules), rate limiting, don't expose origin IPs.
- **T2 edge -> LB (TLS termination)** — the encryption boundary. Controls: TLS 1.2+/1.3 only, valid cert, HSTS, strong ciphers; consider re-encrypting to the origin (TLS end-to-end), not just edge-to-user.
- **T3 LB -> app tier** — network boundary. Controls: app tier in a private subnet reachable only from the LB's security group; **authenticate every request** (don't trust that it came via the LB) — zero trust.
- **T4 app authorization** — the request now has an identity; enforce **authZ server-side** (least privilege, object-level checks to stop IDOR), validate/parameterize all input, and **block SSRF** (allowlist outbound, deny metadata/link-local) since this tier holds the IAM role.
- **T5 app -> data** — data tier in an isolated private subnet, no internet route, reachable only from the app SG; encryption in transit (TLS/mTLS) and at rest; the app's IAM role scoped to just the data it needs.

Cross-cutting: least-privilege IAM on every component, centralized logging/monitoring (without logging secrets or PII), and secrets injected from a manager, not baked in. The exercise demonstrates the whole topic — transport security at the edge, segmentation between tiers, zero-trust identity per hop, and cloud least privilege throughout.

## Container & Kubernetes Security

### Summary

**What this topic covers**

Securing containerized workloads across the two phases where they're attacked: the **image** (build-time) and the **runtime** (the running container and its orchestration). Build-time: **image scanning** for known vulnerabilities, **minimal/distroless base images** to shrink attack surface, and **image provenance/signing** so you only run artifacts you produced. Runtime: **non-root / rootless** containers and dropped Linux **capabilities**, safe **secrets** handling (never baked into images or plain env), Kubernetes **network policies** (default-deny), **Pod Security Standards** and admission control, and **runtime security / anomaly detection**. Plus the conceptual crux every interviewer probes: **the container-vs-VM isolation boundary** — containers share the host kernel, so isolation is weaker than a VM's, which shapes every other decision. The 15 questions run from "what's in a secure image" to "harden this cluster and explain the isolation boundary."

**Mental model**

Two ideas do most of the work. First, **a container is a process, not a machine.** It's a host process wrapped in Linux namespaces and cgroups, sharing the host **kernel**. That's the whole security story in one sentence: isolation is *kernel-enforced process isolation*, not the hardware-level isolation a VM gets from a hypervisor. So a kernel vulnerability or an over-privileged container (root, extra capabilities, host mounts) can lead to **container escape** — breaking out to the host and every other container on it. Everything else follows: run as non-root, drop capabilities, keep the kernel patched, and don't hand containers host access. Second, **shift the security left into the image.** A container is immutable and rebuilt, not patched in place — so the image *is* the unit of security. A minimal, scanned, signed image with no shell, no package manager, and no secrets baked in removes most of what an attacker would use. You secure containers by securing what goes into them and by constraining what they can do once running.

**Key terms**

- **Image scanning** — analyzing a container image for known-vulnerable OS/app packages (CVEs) and often for secrets/misconfig.
- **Distroless / minimal base image** — an image containing only the app and its runtime deps — no shell, package manager, or general OS tooling.
- **Non-root container** — a container whose process runs as an unprivileged UID, not `root` (UID 0).
- **Rootless container** — the container *runtime itself* runs without root on the host, shrinking the escape blast radius further.
- **Linux capabilities** — fine-grained slices of root's power (e.g. `NET_ADMIN`); drop all, add back only what's needed.
- **Container escape** — breaking out of a container to the host kernel/other containers.
- **Network policy** — Kubernetes resource controlling pod-to-pod/egress traffic; enables default-deny segmentation.
- **Pod Security Standards** — Kubernetes' baseline/restricted policy profiles for pod security settings.
- **Admission controller** — a hook that validates/mutates/rejects resources at create time (enforces policy).
- **Image provenance / signing** — cryptographic proof of who built an image, verified before it runs (cosign/Sigstore).
- **Runtime security** — detecting anomalous behavior in running containers (unexpected exec, network, file access).
- **Secrets in containers** — credentials injected at runtime (mounted/managed), never baked into image layers or plain env.

**Why interviewers ask this**

Containers and Kubernetes are how modern software ships, and misconfiguration here is a top breach vector. The signal question is **container-vs-VM isolation** — a candidate who says "containers are like lightweight VMs" reveals they don't understand the shared-kernel boundary that dictates the entire threat model, while one who explains namespaces, the shared kernel, and escape risk gets it. Interviewers also probe whether you default to secure settings (non-root, dropped caps, read-only filesystem, default-deny networking) or leave everything at the permissive defaults that ship out of the box. It's a strong seniority discriminator: juniors get the container running; seniors get it running with least privilege, a scanned/signed minimal image, no baked-in secrets, and admission control that *stops* insecure pods from ever scheduling.

**Common confusions**

- "Containers are lightweight VMs" — no; VMs have a hypervisor and separate kernels, containers share the host kernel. Isolation is weaker, which is the crux of container security.
- "Root in a container is contained" — by default container-root maps to real host-root capabilities; combined with an escape it's host-root. Run non-root.
- "Scanning at build is enough" — new CVEs are disclosed against images already running; you need *continuous* re-scanning plus runtime detection.
- "Secrets in an env var / build ARG are fine" — build args and layers persist in image history; env is broadly readable. Inject secrets at runtime from a manager.
- "Kubernetes networking is locked down by default" — the opposite; by default **all pods can talk to all pods**. You must add a default-deny NetworkPolicy.
- "A signed image is a safe image" — signing proves origin/integrity, not that the contents are vulnerability-free. You still scan.

**What follows from this topic**

This is where the whole primer converges on the deployment layer. The **isolation boundary** ties directly to the OS primer's process/kernel and privilege concepts. **Image signing and provenance** are the OCI-image instantiation of the SBOM/SLSA/Sigstore machinery from the supply-chain topic — the artifacts being signed here are images. **Network policies** are Kubernetes-layer **segmentation** and **zero trust**, continuing the network topic. **Secrets handling** extends the secrets-management topic into the pod. And non-root / dropped capabilities are **least privilege** applied to a running process — the same principle as IAM least privilege, one layer down.

### Q1. How is a container's isolation different from a VM's, and why does it matter for security?

A **VM** runs its own full **kernel** on top of a **hypervisor**, which enforces isolation at the hardware-virtualization level. A **container** is a host process isolated by Linux **namespaces** (separate views of PIDs, filesystem, network) and limited by **cgroups** — but it **shares the host kernel** with every other container.

```text
VM:         [app][guest kernel] | [app][guest kernel]   <- hypervisor boundary (strong)
Container:  [app] | [app] | [app]  ->  shared host kernel <- namespace boundary (weaker)
```

Why it matters: the container's security boundary is only as strong as the **kernel** and its configuration. A kernel vulnerability, or a container granted too much power (root, extra capabilities, host mounts, privileged mode), can lead to **container escape** — breaking out to the host and compromising every co-located container. A VM escape requires breaking the hypervisor, a much harder boundary.

The practical consequence: because isolation is weaker, containers demand **defense in depth** — non-root, dropped capabilities, seccomp/AppArmor profiles, no host mounts, a patched kernel. And for genuinely hostile/multi-tenant workloads, add a stronger boundary: sandboxed runtimes (gVisor, Kata Containers, Firecracker microVMs) that put a real isolation layer back between the workload and the host kernel.

### Q2. What makes a container image "secure"? Walk me through building a hardened one.

A secure image is **minimal, scanned, non-root, secret-free, and signed.** The attacker's toolkit inside a container is whatever you shipped, so ship as little as possible.

```dockerfile
# multi-stage: build tools stay out of the final image
FROM golang:1.22 AS build
WORKDIR /src
COPY . .
RUN CGO_ENABLED=0 go build -o /app ./cmd/server

# distroless: no shell, no package manager, tiny attack surface
FROM gcr.io/distroless/static:nonroot
COPY --from=build /app /app
USER nonroot:nonroot          # do not run as root
ENTRYPOINT ["/app"]
```

The principles on display:
- **Multi-stage build** — compilers and dev tooling never reach the runtime image.
- **Minimal/distroless base** — no shell or package manager means an attacker who gets code execution has almost nothing to pivot with.
- **Non-root user** — process runs unprivileged.
- **No secrets** — nothing sensitive in `COPY`, `ENV`, or build `ARG`s (they persist in image history).
- **Pin the base image by digest**, not a floating tag, so the base can't change under you.

Then **scan** the image for CVEs in CI (fail the build on criticals), **sign** it (cosign), and **generate an SBOM**. Secure image = small surface + verified contents + verified origin.

### Q3. Why use distroless or minimal base images?

**Attack surface reduction.** A full OS base image (`ubuntu`, `debian`) ships a shell, package manager, coreutils, and dozens of libraries your app never uses — every one of which is potential CVE exposure and, more importantly, **tooling for an attacker.** If someone achieves code execution in your container, a shell and `curl`/`wget`/`apt` let them explore, pull down more payloads, and pivot. A **distroless** image (just your app + its runtime libraries, no shell, no package manager) leaves them with almost nothing to work with.

Concrete benefits:
- **Fewer CVEs to patch** — less installed software means less that scanners flag and less you must rebuild for.
- **Smaller blast radius on RCE** — no shell means many exploit techniques and post-exploitation steps simply don't work.
- **Smaller/faster images** — a secondary but real operational win.

The tradeoff is **debuggability** — you can't `kubectl exec` a shell into a distroless pod. The answer is ephemeral debug containers (attach a temporary tooling container to the pod's namespaces) rather than shipping the tools permanently. Same trend applies to "scratch" images for static binaries. Minimalism is the cheapest, highest-leverage container hardening you can do.

### Q4. Why should containers run as non-root, and how do you enforce it?

By default a container process runs as **root (UID 0)**, and that root maps to real capabilities on the **shared host kernel**. Chain that with a container escape or a host mount and you have **root on the host** — total compromise of the node and every pod on it. Running as an unprivileged user means even a breakout starts with limited power.

**Enforce it in layers:**
- **In the image** — `USER nonroot` in the Dockerfile; build the app to run unprivileged.
- **In the pod spec** — a `securityContext` that mandates it:

```yaml
securityContext:
  runAsNonRoot: true          # refuse to start if the image runs as root
  runAsUser: 10001
  allowPrivilegeEscalation: false
  readOnlyRootFilesystem: true
  capabilities:
    drop: ["ALL"]             # drop all Linux capabilities, add back only if needed
```

- **At the cluster** — a **Pod Security Standard (restricted)** or admission policy that *rejects* any pod trying to run as root or privileged, so a single bad manifest can't slip through.

This is **least privilege** applied to the container process. Pair it with `readOnlyRootFilesystem`, `allowPrivilegeEscalation: false`, and dropped capabilities for defense in depth.

### Q5. What are Linux capabilities and why drop them in containers?

Historically a process was either root (all power) or not. **Capabilities** break root's omnipotence into ~40 discrete privileges — `NET_ADMIN` (configure networking), `SYS_ADMIN` (broad admin), `NET_BIND_SERVICE` (bind ports < 1024), `SYS_PTRACE` (trace processes), etc. — so you can grant a slice instead of everything.

Container runtimes grant a **default set** of capabilities that most apps never need, and each one is a potential escape or privilege-escalation primitive (`SYS_ADMIN` especially is close to full root). The hardening move is **drop everything, add back only what's provably required:**

```yaml
securityContext:
  capabilities:
    drop: ["ALL"]
    add: ["NET_BIND_SERVICE"]   # only if the app must bind a privileged port
```

Most application containers need *zero* added capabilities — they just serve traffic on a high port. Dropping all capabilities is one of the highest-value, lowest-effort container hardening steps: it directly shrinks what an attacker who compromises the process can do, and it's least privilege at the kernel-syscall level. Combine with a **seccomp** profile (restrict which syscalls are even callable) for a further reduction.

### Q6. How should secrets be handled in containers and Kubernetes — and what should you never do?

**Never bake secrets into the image.** Anything in `COPY`, `ENV`, or a build `ARG` persists in the image layers and history — anyone who pulls the image can extract it. And **avoid plain environment variables** for secrets where you can: env is readable by every process in the container, leaks into crash dumps and logs, and is visible via the orchestration API.

**Better, in order:**
1. **External secret manager + runtime injection** — keep secrets in Vault / a cloud secret manager and inject at runtime via a CSI Secrets Store driver or an operator (External Secrets Operator). The plaintext never lives in the image or, ideally, in etcd.
2. **Kubernetes Secrets, hardened** — usable, but note they're **base64-encoded, not encrypted**; you must enable **etcd encryption at rest** and lock down **RBAC** so only the intended workloads can read them. Mount as files, not env, and mount only into pods that need them.
3. **Workload identity** — best of all, eliminate the stored secret: give the pod a cloud/service identity so it authenticates to downstream services without any credential to leak.

Also: short-lived/rotating credentials over long-lived ones, and never log secret values. This is the secrets-management topic pushed down into the pod — same principle, container-specific mechanics.

### Q7. What are Kubernetes network policies and why is default-deny important?

By default, **Kubernetes networking is wide open** — every pod can reach every other pod across namespaces. That means a single compromised pod can freely scan and attack the entire cluster: lateral movement with no friction.

A **NetworkPolicy** is a Kubernetes resource that restricts pod traffic by label selector. The essential first move is a **default-deny** policy per namespace, then explicitly allow only the flows you need:

```yaml
# deny all ingress in the namespace, then whitelist specific flows separately
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: { name: default-deny-ingress }
spec:
  podSelector: {}            # all pods
  policyTypes: ["Ingress"]   # with no ingress rules -> deny all inbound
```

Then add targeted allow policies (e.g. "the `api` pods may receive traffic only from the `web` pods on port 8080"). This is **network segmentation and zero trust inside the cluster** — the pod equivalent of security groups. Without it, network security stops at the cluster edge and the interior is a flat trusted zone, exactly the perimeter-model failure. Note NetworkPolicies require a CNI plugin that enforces them (Calico, Cilium) — applying one with a non-enforcing CNI silently does nothing.

### Q8. What are Pod Security Standards and how does admission control enforce them?

**Pod Security Standards** are Kubernetes' predefined security profiles for pod configuration, in three levels:
- **Privileged** — unrestricted (no guardrails).
- **Baseline** — blocks known-dangerous settings (host namespaces, privileged mode).
- **Restricted** — hardened best practice: non-root, drop-all capabilities, no privilege escalation, read-only root fs, seccomp on.

They matter because the *default* pod settings are permissive — insecure by default. **Admission control** is the enforcement mechanism: an **admission controller** intercepts every resource at create/update time, *before* it's persisted or scheduled, and can validate, mutate, or **reject** it.

```text
kubectl apply -> API server -> [admission controllers] -> etcd -> scheduler
                                 reject non-compliant pod here
```

Built-in **Pod Security Admission** enforces a chosen standard per namespace (label a namespace `restricted` and it rejects any pod that violates it). For richer policy, **policy engines** like OPA/Gatekeeper or Kyverno let you write custom rules ("images must come from our registry and be signed," "no `latest` tags," "resource limits required"). The key idea: admission control makes insecure configurations **impossible to deploy** rather than something you hope to catch in review — guardrails over vigilance, the same philosophy as cloud policy-as-code.

### Q9. What is runtime container security and why isn't build-time scanning enough?

**Build-time scanning** finds *known* vulnerabilities in the image at build. It can't catch: CVEs disclosed *after* the image shipped, zero-days, misconfigurations exploited at runtime, compromised dependencies behaving maliciously, or an attacker who's already achieved code execution. Static analysis of an artifact says nothing about what that artifact *does* once running.

**Runtime security** watches running containers for **anomalous behavior** and is the detective control that complements the preventive ones:
- A container that suddenly spawns a **shell**, when it never should.
- Unexpected **outbound network** connections (possible C2 or exfiltration).
- Writes to unexpected **filesystem** paths, or attempts to read `/etc/shadow` or the service-account token.
- Unusual **syscalls** or privilege-escalation attempts.

Tools (Falco is the well-known open example) hook kernel events/eBPF and alert or block on policy violations. It closes the gap the same way **DAST/runtime monitoring** complements **SAST** in AppSec: you need both *shift-left prevention* (scan, sign, harden the image) and *runtime detection* (catch what got through or emerged later). Also re-scan running images continuously against new CVE data, since "vulnerable" is a moving target.

### Q10. How do image provenance and signing apply to containers?

Same machinery as the supply-chain topic, with **OCI images** as the artifact. The risk: an attacker (or a compromised registry/CI) substitutes a malicious image for the one you intended to run. **Signing** lets you verify an image genuinely came from your pipeline and wasn't tampered with; **provenance** attests *how and from what* it was built.

```bash
cosign sign $REGISTRY/app@sha256:...        # sign at build (keyless via CI identity)
cosign verify --certificate-identity=... $REGISTRY/app@sha256:...   # verify before run
```

Then **enforce verification at admission**: a policy controller (Kyverno, OPA/Gatekeeper, or Sigstore's policy-controller) rejects any pod whose image isn't signed by a trusted identity, so unsigned or third-party images can't schedule. Pin images by **digest** (`@sha256:...`), never by mutable tag like `latest`, so "the image you verified" and "the image that runs" are provably identical.

Two caveats worth stating: signing proves **origin and integrity, not safety** — a signed image with a vulnerable dependency is still vulnerable, so you still scan. And provenance (SLSA) additionally guards against a compromised *builder* injecting badness between source and image. Provenance + signing + digest-pinning + admission enforcement is the container supply-chain chain of custody.

### Q11. Spot the vulnerabilities in this pod spec and fix them.

```yaml
# VULNERABLE
spec:
  containers:
  - name: app
    image: acme/app:latest          # mutable tag
    securityContext:
      privileged: true              # full host access
    env:
    - name: DB_PASSWORD
      value: "hunter2"              # secret in plaintext
    volumeMounts:
    - name: host
      mountPath: /host
  volumes:
  - name: host
    hostPath: { path: / }           # entire host filesystem mounted
```

Four serious problems:
1. **`privileged: true`** — grants nearly all host capabilities; combined with the escape surface this is effectively root on the node. Remove it; drop all capabilities.
2. **`hostPath: /`** — mounts the whole host filesystem into the container, a direct escape/tamper path. Remove it; mount only a specific, minimal path if truly needed.
3. **Plaintext secret in `env`** — visible in the pod spec, API, and logs. Inject from a secret manager / mounted Secret instead.
4. **`:latest` tag** — mutable and unverifiable. Pin by digest.

```yaml
# FIXED
spec:
  containers:
  - name: app
    image: acme/app@sha256:<digest>   # pinned + signed, verified at admission
    securityContext:
      runAsNonRoot: true
      allowPrivilegeEscalation: false
      readOnlyRootFilesystem: true
      capabilities: { drop: ["ALL"] }
    envFrom:
    - secretRef: { name: app-db }     # secret injected, not inlined
```

The theme: strip host access, run least-privilege/non-root, inject secrets, pin+verify the image — and enforce all of it with a **restricted Pod Security Standard** so this manifest is *rejected* rather than merely reviewed.

### Q12. How do you secure the container image supply chain end to end?

Build a verifiable chain of custody from source to running pod — the same defense-in-depth as the general supply-chain topic, specialized to images:

1. **Trusted base images** — pull from a curated internal registry, pinned by digest, ideally minimal/distroless. No arbitrary public `latest` bases.
2. **Scan in CI** — image scanning for CVEs and secret scanning; fail the build on criticals.
3. **Generate an SBOM** at build so you can answer "which images ship the newly-vulnerable component?" instantly.
4. **Sign + provenance** — cosign-sign the image and attach SLSA provenance attesting it was built by your CI from a specific commit.
5. **Store in a private registry** with access control, immutability (no tag overwrites), and continuous re-scanning of stored images against new CVEs.
6. **Verify at admission** — the cluster rejects any image not signed by a trusted identity and not from the approved registry (Kyverno/OPA/Sigstore policy-controller).
7. **Least-privilege CI** — the build pipeline holds only the credentials it needs, so a compromised step can't poison everything.

```text
source -> CI (scan+SBOM+build) -> sign+provenance -> private registry -> admission verify -> run
```

The through-line: every stage adds verification, and **admission control is the gate** that ensures only images that passed the whole chain ever run. It's SBOM + Sigstore + SLSA from the supply-chain topic, made concrete for Kubernetes.

### Q13. When is a container's isolation not enough, and what stronger boundaries exist?

Because containers share the host kernel, standard container isolation is inadequate when you're running **genuinely untrusted or hostile code** on shared infrastructure — multi-tenant SaaS running customer code, CI running arbitrary PRs, AI agents executing generated code, or malware analysis. A kernel exploit from inside any container threatens the host and every co-tenant.

**Stronger boundaries, roughly increasing isolation:**
- **Sandboxed runtimes (gVisor)** — intercept the container's syscalls in a user-space kernel, so the workload rarely touches the real host kernel directly. Reduced escape surface with modest overhead.
- **Lightweight VMs per workload (Kata Containers, Firecracker microVMs)** — run each container (or pod) inside its own minimal VM with its *own kernel* behind a hypervisor, restoring VM-grade isolation while keeping container-like ergonomics. This is what serverless/sandbox platforms use to run untrusted code.
- **Separate nodes / clusters** — schedule untrusted workloads onto dedicated nodes (taints/affinity) or entirely separate clusters so a breakout can't reach trusted workloads.

The decision is **threat-driven**: for your own first-party services, well-hardened standard containers (non-root, dropped caps, seccomp, network policy) are appropriate. For hostile multi-tenant code, add a real hypervisor boundary — don't rely on namespaces alone. Naming this tradeoff is exactly the seniority signal from the container-vs-VM question.

### Q14. How would you threat-model a Kubernetes cluster? What are the main trust boundaries?

Map the boundaries and the top threat at each:

```text
[images/registry] -> [API server/etcd] -> [nodes/kubelet] -> [pods] -> [pod<->pod net] -> [cloud IAM]
```

- **Supply chain (images)** — malicious or vulnerable images. *Controls:* scan, sign, verify at admission, trusted registry only.
- **Control plane (API server + etcd)** — the crown jewels; etcd holds all secrets. *Controls:* RBAC least privilege, authn on the API, **encrypt etcd at rest**, restrict/audit control-plane access, no anonymous access.
- **Nodes / kubelet** — a compromised node exposes all its pods and its cloud identity. *Controls:* harden and patch the host, restrict kubelet API, limit the node's cloud IAM role.
- **Pods / workloads** — compromised or misconfigured containers. *Controls:* Pod Security Standards (restricted), non-root, drop caps, read-only fs, seccomp; **escape leads to node compromise** so this boundary is critical.
- **Pod-to-pod network** — lateral movement. *Controls:* default-deny NetworkPolicies, mTLS via a service mesh (zero trust between services).
- **Cloud IAM boundary** — pods inheriting node/cloud credentials (the IMDS/SSRF link). *Controls:* workload identity per pod scoped to least privilege, enforce IMDSv2, don't hand pods the node role.

Cross-cutting: audit logging on the API server, runtime anomaly detection, and secrets from an external manager. The exercise pulls the whole primer together — supply chain, least privilege, segmentation, zero trust, cloud IAM, and the isolation boundary — applied to one system.

### Q15. What are the highest-impact defaults to change when hardening a fresh Kubernetes deployment?

Fresh clusters and pods ship **insecure-by-default**; a prioritized list of the changes that remove the most risk for the least effort:

1. **Enforce a restricted Pod Security Standard** cluster-wide via admission — instantly bans root, privileged, host namespaces, and privilege escalation across every namespace.
2. **Default-deny NetworkPolicies** per namespace — closes the wide-open pod network and stops trivial lateral movement (verify your CNI enforces them).
3. **Run non-root + drop all capabilities + read-only root fs** in every pod's `securityContext` — least privilege on the process.
4. **Lock down RBAC** — no cluster-admin for workloads, no default service-account token auto-mounting where unused, scope permissions per workload.
5. **Encrypt etcd at rest** and move real secrets to an external manager / workload identity — so a control-plane read isn't a full credential dump.
6. **Enforce image signing + trusted-registry-only + digest pins** at admission — only vetted, verified images run.
7. **Turn on audit logging + runtime anomaly detection** — you can't respond to what you can't see.

The unifying principle is **secure defaults enforced by policy, not by convention** — an admission controller that *rejects* insecure resources beats a wiki page asking people to be careful. That's the same guardrails-over-vigilance philosophy as cloud CSPM/IaC scanning and CI security gates, applied at the cluster. Start restrictive and loosen deliberately, rather than starting open and hoping to tighten.
## Memory Safety & Low-Level Vulnerabilities

### Summary

**What this topic covers**

Memory-safety bugs are the oldest and, by CVE count, still the most damaging class of software vulnerability. This topic covers the conceptual mechanics of the classic low-level flaws — **stack and heap buffer overflows**, **use-after-free (UAF)**, **integer overflow**, and **format-string** bugs — and, more importantly for a defensive interview, the layered mitigations that neutralise them: **ASLR**, **DEP/NX**, **stack canaries**, safe unlinking, and **CFI (Control-Flow Integrity)**. It closes with the systemic answer — **memory-safe languages** (Rust, Go, and managed runtimes like the JVM/CLR) that make whole bug classes unrepresentable. The 16 questions here stay conceptual and defensive: enough to reason about *why* a vulnerability exists and *how* the defence works, without weaponised exploit code. This topic overlaps deliberately with the Operating Systems primer's OS-security topic (which covers ASLR/DEP/rings from the kernel's angle) — cross-reference it rather than re-deriving the page-table details here.

**Mental model**

Memory-safety bugs all share one root cause: **the program trusts a size, index, pointer, or lifetime that an attacker can influence.** C and C++ hand you raw pointers and manual lifetimes with no runtime bounds or use-after-free checks — so a length field read off the wire, an off-by-one loop, or a pointer used after `free()` lets attacker-controlled data land somewhere it shouldn't. The exploit chain is almost always the same shape: **corrupt memory → hijack control flow (or data flow) → execute attacker intent.** Defences map onto that chain in layers. Some make corruption *detectable* (stack canaries, ASan in test). Some make the *payload* non-executable (DEP/NX). Some make the *target* unpredictable (ASLR). Some make hijacked control flow *invalid* (CFI). And memory-safe languages remove the *first* link — no corruption, no chain. Think in terms of "which link in the chain does this defence break, and can the attacker route around it?" Every mitigation is bypassable in isolation (ROP defeats NX, info-leaks defeat ASLR); defence-in-depth is what makes exploitation expensive.

**Key terms**

- **Buffer overflow** — writing past the bounds of a fixed-size buffer, corrupting adjacent memory (stack: return addresses/saved registers; heap: allocator metadata and neighbouring objects).
- **Use-after-free (UAF)** — dereferencing a pointer after its memory was freed; if the block is reallocated with attacker data, the stale pointer reads/writes attacker-controlled bytes.
- **Integer overflow/underflow** — arithmetic wrapping past the type's range, typically producing an undersized allocation that a later copy overflows.
- **Format-string bug** — passing attacker input as the format argument (`printf(user)`), letting `%x`/`%n` leak or write memory.
- **ASLR** — Address Space Layout Randomisation; randomises base addresses so absolute targets aren't predictable.
- **DEP/NX** — Data Execution Prevention / No-eXecute bit; marks writable pages non-executable so injected data can't run as code.
- **Stack canary** — a random guard value placed before the return address; a smashed canary aborts the process before return.
- **CFI** — Control-Flow Integrity; verifies indirect calls/returns target only legitimate destinations.
- **ROP** — Return-Oriented Programming; chains existing code "gadgets" to bypass NX without injecting code.
- **Memory-safe language** — a language whose runtime or type system prevents out-of-bounds and use-after-free access (Rust's borrow checker, Go/Java/C# GC + bounds checks).

**Why interviewers ask this**

Even if you write in a memory-safe language, this class underpins a huge share of critical CVEs — the OS kernel, browser, TLS library, and container runtime under your app are almost all C/C++. Interviewers want to see whether you understand *why* memory safety matters at a systems level, not just that "overflows are bad." A junior recites "buffer overflow = writing too much data." A senior explains the exploit chain, names which mitigation breaks which link, acknowledges that each is individually bypassable, and — crucially — frames memory-safe languages as the *systemic* fix rather than piling on more runtime band-aids. The senior signal is treating memory safety as an architecture decision (language choice, `unsafe` audits, fuzzing the C boundary) rather than a coding-discipline hope.

**Common confusions**

- "ASLR stops buffer overflows" — no. ASLR makes *targets* hard to locate; the overflow still happens. An info-leak defeats it.
- "NX/DEP means no more code execution exploits" — no. ROP/JOP reuse existing executable code to bypass NX entirely.
- "Managed languages are immune to memory bugs" — mostly true for pure code, but `unsafe`/JNI/native interop, and logic bugs (integer overflow in a size check) can still bite; and their runtimes are C/C++.
- "Use-after-free is just a null-pointer crash" — no. A reallocated block makes the stale pointer alias attacker data; it's exploitable, not just a crash.
- "Integer overflow is only a correctness bug" — it's a security bug when the wrapped value sizes an allocation or bounds a copy.
- "Rust has no memory bugs ever" — safe Rust is memory-safe; `unsafe` blocks and FFI are audited exceptions, not magic.

**What follows from this topic**

Memory safety connects downward to the OS primer (ASLR/DEP live in the kernel and loader) and upward to the Common Vulnerabilities topic that follows — insecure deserialization and integer-overflow-driven allocation bugs are the managed-language cousins of these low-level flaws. The "prevent the class, don't patch the instance" mindset here is the same one behind parameterized queries (kills SQL injection) and output encoding (kills XSS) in the injection topics. And the fact that most exploited CVEs are memory-safety bugs feeds directly into the Incident Response topic — it's *why* dependency patching and SCA scanning are non-negotiable.

### Q1. What is a buffer overflow, and how does it lead to code execution?

A buffer overflow is writing more data into a fixed-size buffer than it can hold, so the excess corrupts **adjacent memory**. The classic case is a stack buffer: local arrays sit below the function's saved **return address**, so overflowing the array overwrites where the function returns to.

```c
// Vulnerable: no bounds check, gets() writes unbounded input
char buf[64];
gets(buf);              // attacker supplies > 64 bytes → return address overwritten

// Fixed: bound the copy to the buffer size
char buf[64];
fgets(buf, sizeof(buf), stdin);
```

The exploit chain: overflow the buffer → overwrite the saved return address → when the function returns, control jumps to an attacker-chosen address (injected shellcode historically, or a chain of existing-code "gadgets" today). The systemic fix is a **memory-safe language** that bounds-checks every array access; the defence-in-depth fixes (canaries, NX, ASLR) make the C version harder to exploit but don't remove the bug.

### Q2. Stack overflow vs heap overflow — what's the difference in impact?

Both are out-of-bounds writes; they differ in *what sits next to the buffer*.

| | Stack overflow | Heap overflow |
|---|---|---|
| Adjacent target | Saved return address, saved registers, other locals | Allocator metadata, neighbouring heap objects |
| Classic result | Overwrite return address → hijack control flow | Corrupt chunk headers / object vtables → hijack on next alloc/free/call |
| Primary mitigation | Stack canaries + NX + ASLR | Safe unlinking, heap hardening, allocator integrity checks |
| Determinism | Fairly deterministic layout | Layout depends on allocation order ("heap grooming/feng shui") |

Stack overflows are the textbook case because the return address is right there. Heap overflows are subtler: the attacker corrupts allocator bookkeeping or an adjacent object's function pointer, and the hijack fires later when that metadata or object is used. Modern allocators add integrity checks (safe unlinking) precisely to catch heap metadata corruption.

### Q3. What is a use-after-free, and why is it exploitable rather than just a crash?

A use-after-free dereferences a pointer whose memory has already been `free()`d. It's not merely a crash because the freed block usually gets **reallocated** — and if the attacker can trigger an allocation of the same size in between, they control what the stale pointer now points at.

```c
Object *p = malloc(sizeof(Object));
free(p);
// ... attacker causes a same-size allocation that reuses p's memory ...
p->handler();   // stale pointer now calls into attacker-controlled data
```

The danger is when the freed object had a **function pointer or vtable**: the reallocated attacker data supplies a fake pointer, and the next virtual call jumps wherever they want. Defences: null the pointer after free (`p = NULL`), use smart pointers / RAII (C++), and — systemically — a language with automatic lifetimes. **Rust's borrow checker** makes UAF a compile error; garbage-collected languages never free a still-referenced object.

### Q4. How does an integer overflow become a security vulnerability?

On its own, integer overflow is a wrap-around (`UINT_MAX + 1 == 0`). It becomes a *security* bug when the wrapped value is used to **size an allocation or bound a copy** — you allocate a tiny buffer but then copy a large amount into it.

```c
// Vulnerable: len * size can wrap to a small value
void *buf = malloc(count * size);   // count*size overflows → tiny allocation
memcpy(buf, src, count * size);     // ...but this copies the real (huge) length → heap overflow

// Fixed: use overflow-checked allocation / explicit check
if (count != 0 && size > SIZE_MAX / count) return ERR;  // would overflow
void *buf = calloc(count, size);    // calloc checks the multiplication
```

The fix is overflow-aware arithmetic: `calloc` (checks the multiply), compiler builtins (`__builtin_mul_overflow`), or explicit range checks before the operation. In memory-safe languages the copy would be bounds-checked regardless, and many will panic/throw on overflow in debug or with checked arithmetic.

### Q5. What is a format-string vulnerability?

It happens when attacker-controlled input is passed as the **format string** argument instead of as data.

```c
printf(user_input);            // VULNERABLE: input is the format string
printf("%s", user_input);      // FIXED: input is a data argument
```

If the input contains format specifiers, the attacker gains a read/write primitive: `%x`/`%p` leak stack memory (defeating ASLR by exposing addresses), and the rarely-known `%n` *writes* the number of bytes printed to a pointed-at address — a targeted memory write. The fix is trivial and absolute: never pass untrusted data as a format string; always use a constant format with the data as an argument. Compilers with `-Wformat-security` flag the mistake, and it simply doesn't exist in languages without C-style varargs formatting.

### Q6. Walk me through the common mitigations: ASLR, DEP/NX, and stack canaries. What does each defend against?

These are the three pillars of exploit mitigation, each breaking a different link in the chain:

- **Stack canary (stack protector)** — a random guard value the compiler places between local buffers and the saved return address. On function return the value is checked; if a linear overflow smashed it, the mismatch aborts the process *before* the corrupted return address is used. Defends against straightforward stack smashing; bypassed by info-leaks (read the canary) or writes that skip over it.
- **DEP/NX** — marks writable memory pages (stack, heap) as **non-executable**. Injected shellcode sitting in a data buffer can't run. Bypassed by **ROP**, which executes existing code rather than injecting new code.
- **ASLR** — randomises the base addresses of the stack, heap, libraries, and executable, so an attacker can't hard-code target addresses. Bypassed by an **info-leak** that reveals a real address, from which they compute the rest.

The point of an interview answer: state clearly that **each is individually bypassable**, so they're deployed *together* (plus **CFI** and modern heap hardening). Defence-in-depth turns "one bug = instant exploit" into "one bug + an info-leak + a gadget chain = maybe an exploit."

### Q7. If NX makes the stack non-executable, how do attackers still run code? (ROP)

Via **Return-Oriented Programming**. Since NX stops *injected* code from executing, attackers instead reuse **code that's already executable** — small snippets ("gadgets") ending in `ret`, scattered through the program and its libraries. By overflowing the stack with a sequence of gadget addresses, each gadget does a tiny operation and "returns" into the next, chaining into arbitrary computation — all using legitimately executable memory, so NX never triggers.

ROP is why NX alone isn't enough. The counter-mitigations: **ASLR** (you can't chain gadgets whose addresses you don't know — hence ROP usually needs an info-leak first) and **CFI** (a `ret` or indirect jump into the middle of a function is not a valid control-flow target, so the chain is rejected). It's an arms race, which is the real lesson: mitigations raise cost, memory-safe languages remove the game.

### Q8. What is Control-Flow Integrity (CFI) and what does it add over canaries/NX/ASLR?

CFI enforces that the program's **indirect control transfers** — indirect calls, virtual dispatch, and returns — only ever land on **legitimate targets** derived from the program's control-flow graph. An indirect call through a corrupted function pointer, or a `ret` into the middle of a function (as ROP requires), is not a valid edge, so CFI aborts.

It complements the others by attacking a link the earlier mitigations don't fully cover: canaries protect one specific location (the return address on a linear overflow), NX protects *what* executes, ASLR protects *where* things are — CFI protects *where control is allowed to go*. Variants include forward-edge CFI (indirect calls/vtables), backward-edge protection like **shadow stacks / Intel CET** (return addresses), and compiler CFI (Clang/`-fsanitize=cfi`, Windows CFG). It significantly raises the bar for ROP/JOP but, like the others, is one layer — not a guarantee.

### Q9. Why are memory-safe languages considered a systemic fix rather than just another mitigation?

Because mitigations attack the *exploit chain* while the bug remains; memory-safe languages remove the *bug class* entirely. Canaries, NX, ASLR, and CFI all assume corruption *will* happen and try to make it non-exploitable — an arms race the defender periodically loses (each has documented bypasses). A memory-safe language makes out-of-bounds access and use-after-free **unrepresentable in safe code**:

- **Rust** — the borrow checker enforces ownership and lifetimes at *compile time*, so use-after-free and data races are compile errors, with bounds-checked slices at runtime. Zero-cost: no GC.
- **Go / Java / C# / managed runtimes** — garbage collection removes manual free (no UAF/double-free), and array accesses are bounds-checked (no overflow).

Industry data (Microsoft, Google, the Android project) attributes roughly **70% of their critical CVEs** to memory-safety bugs — and adopting memory-safe languages for new code drops that class toward zero. That's why national cybersecurity guidance now explicitly recommends memory-safe languages. The honest caveat: `unsafe`/FFI/native interop are audited escape hatches, and logic bugs remain — but the *systemic* win is real.

### Q10. Spot the vulnerability and fix it.

```c
void copy_name(char *dst, const char *src) {
    strcpy(dst, src);   // ??
}
```

**Vulnerability:** `strcpy` copies until it hits a NUL terminator with **no regard for the destination's size**. If `src` is longer than `dst`'s buffer, it overflows — a classic stack or heap overflow depending on where `dst` lives. The caller's buffer size isn't even visible here, which is the deeper design smell.

```c
// Fixed: pass and respect the destination size, always NUL-terminate
void copy_name(char *dst, size_t dst_size, const char *src) {
    if (dst_size == 0) return;
    strncpy(dst, src, dst_size - 1);
    dst[dst_size - 1] = '\0';        // strncpy may not NUL-terminate on truncation
}
```

Better still, use `snprintf`, `strlcpy` (BSD), or a bounded string type. The senior point: the *real* fix is not to write bounds-unaware C string handling — this whole function is a foot-gun that a `std::string`/`String` type or a memory-safe language eliminates.

### Q11. What is a double-free, and why is it dangerous?

A double-free calls `free()` twice on the same pointer. It's dangerous because it **corrupts the allocator's internal free-list**: the second free re-inserts an already-freed chunk, and a carefully-timed sequence of allocations can then hand the attacker two live pointers to the same memory, or trick the allocator into returning an attacker-controlled address from a later `malloc` — a write-what-where primitive.

Defences: null the pointer immediately after freeing (`free(p); p = NULL;` — freeing NULL is a no-op), use RAII/smart pointers so ownership is unambiguous, and rely on hardened allocators that detect double-frees (glibc's tcache/fastbin checks, hardened_malloc). Systemically, ownership-based languages make it a compile error (Rust won't let you move-then-free twice) and GC languages have no manual free at all. It's really a symptom of unclear ownership — the same root cause as use-after-free.

### Q12. Why do most critical CVEs still trace back to memory safety, decades after these bugs were first documented?

Three reasons. **First, the install base**: the world runs on C and C++ at the foundational layers — kernels, hypervisors, browsers, TLS/crypto libraries, codecs, container runtimes, network stacks. That code is enormous, old, performance-critical, and expensive to rewrite. **Second, the bug class is easy to introduce and hard to eliminate by discipline**: a single missing bounds check, off-by-one, or lifetime mistake among millions of lines is enough, and no amount of code review reliably catches all of them. **Third, mitigations don't remove the bugs** — they raise exploitation cost, but a determined attacker with an info-leak still gets through.

Empirically, Microsoft and Google independently reported that ~70% of their severe vulnerabilities are memory-safety issues. That statistic is the entire argument for the industry shift toward memory-safe languages for new and rewritten code, plus aggressive **fuzzing** of the remaining C/C++ attack surface. For an interview, this is the "why should I care" framing — even a pure-Python or pure-Java shop depends on a C substrate riddled with this bug class.

### Q13. How do fuzzing and sanitizers help find memory-safety bugs before shipping?

They attack the problem from the *testing* side, complementing (not replacing) memory-safe languages.

- **Fuzzing** — feed the program massive volumes of malformed/random/mutated input and watch for crashes or sanitizer trips. Coverage-guided fuzzers (AFL++, libFuzzer) evolve inputs to reach new code paths, so they find the deep parser and boundary bugs manual tests miss. It's the standard way to harden C/C++ attack surfaces (file parsers, protocol decoders).
- **Sanitizers** — compiler instrumentation that turns silent corruption into a loud, immediate abort with a stack trace: **AddressSanitizer (ASan)** catches overflows and use-after-free; **UBSan** catches undefined behaviour including integer overflow; **MSan** catches uninitialised reads; **TSan** catches data races.

The winning combination is **fuzzing built with sanitizers on**: the fuzzer generates the crashing input, the sanitizer pinpoints the exact bug. Running this continuously in CI (e.g. OSS-Fuzz-style) is how mature C/C++ projects stay ahead of attackers. It fits the AppSec-testing pipeline alongside SAST/DAST.

### Q14. Are managed/garbage-collected languages completely immune to memory-related vulnerabilities?

No — the guarantee is narrower than "immune." Pure code in Java, C#, Go, Python, or JS is safe from classic overflows and use-after-free because the runtime bounds-checks arrays and GC handles lifetimes. But the exceptions matter:

- **Native interop** — JNI, `cgo`, P/Invoke, Python C extensions, and Node native addons drop into C/C++, reintroducing the whole bug class at the boundary.
- **The runtime itself** — the JVM, CLR, V8, and CPython are written in C/C++, so a bug in the GC or JIT is a memory-safety bug under your "safe" app (JIT bugs are a favourite browser-exploit target).
- **Logic bugs survive** — an integer overflow in a size calculation, or unbounded allocation from attacker input (a memory-exhaustion DoS), doesn't require a memory-corruption primitive.

So GC languages eliminate the *dominant* memory-corruption classes — a huge win — but the answer an interviewer wants is nuanced: "immune to spatial and temporal memory-safety bugs in safe code; still exposed via native interop, the runtime, and logic-level resource bugs."

### Q15. Threat-model a C service that parses untrusted network input. Where do the memory-safety risks concentrate, and how do you defend?

The trust boundary is the network socket: **everything past the `recv()` is attacker-controlled** — lengths, offsets, counts, nested structures. Risks concentrate wherever that input drives memory operations:

- **Length/size fields** → integer overflow → undersized allocation → overflow. *Defend:* validate every length against a sane max and available buffer; use overflow-checked arithmetic.
- **Variable-length copies** (`memcpy` with an attacker length) → buffer overflow. *Defend:* bound every copy to the destination size; prefer length-carrying types.
- **Object lifetimes across async/error paths** → use-after-free/double-free. *Defend:* clear ownership, null after free, RAII.
- **Recursion/nesting depth** → stack exhaustion DoS. *Defend:* cap depth.

Layered defence: compile with **all mitigations on** (canaries, NX, full ASLR/PIE, CFI, fortify-source), run the parser under **ASan in CI** and **continuous fuzzing**, apply **least privilege** (drop capabilities, sandbox/seccomp so a compromise is contained — see the OS primer), and validate strictly with fail-secure defaults. The strongest structural move: **rewrite the parser in a memory-safe language** (Rust is common for exactly this), or isolate it in a sandboxed process. Parsers of untrusted input are the single highest-value place to spend a rewrite.

### Q16. Your dependency has a critical memory-safety CVE but you can't upgrade immediately. What's your defensive playbook?

Treat it as risk reduction across the exploit chain while the patch is pending:

1. **Assess exposure** — is the vulnerable code path actually reachable with attacker-controlled input in your deployment? A CVE in an unused code path is lower urgency (this is where **CVSS environmental scoring** and reachability analysis earn their keep — see the next topic).
2. **Reduce attack surface** — disable the affected feature/parser if optional; put a validating proxy or WAF rule in front to filter the triggering input shape; restrict who can reach the endpoint (network segmentation, auth).
3. **Contain blast radius** — run the component with **least privilege** (non-root, dropped capabilities, seccomp/AppArmor, a sandbox or separate low-trust process) so successful exploitation yields little. Ensure mitigations (ASLR/NX/CFI) are actually enabled.
4. **Detect** — add monitoring/alerting for crash signatures or anomalous behaviour from that component (feeds the Incident Response topic), and increase logging around it.
5. **Prioritise the real fix** — schedule the upgrade/backported patch; track it so the temporary mitigations don't become permanent. Update your **SBOM** and SCA baseline so you know every service that ships the vulnerable version.

The framing to convey: mitigations buy *time and containment*, not safety — the patch is the fix, and defence-in-depth is what keeps you alive until it lands.

## Common Vulnerabilities & Exploitation Concepts

### Summary

**What this topic covers**

This is the "catalogue" topic — the vulnerability classes that don't fit neatly under injection, XSS, or memory safety but show up constantly in real assessments and interviews. It covers how the industry *names and scores* vulnerabilities (**CVE** identifiers, **CVSS** severity) and how to triage them; then a tour of high-frequency web/app flaws each paired with its defensive fix: **path/directory traversal**, **insecure deserialization**, **XXE (XML external entity)**, **race conditions / TOCTOU**, **business-logic flaws**, **mass assignment / over-posting**, and **SSTI (server-side template injection)**. The through-line — the 16 questions all reinforce it — is a *method*: given any vulnerability, work from the **observable symptom → the root cause → the systemic mitigation**, and prefer fixes that kill the whole class over patches that plug one instance. This complements the injection and access-control topics elsewhere in the primer rather than repeating them.

**Mental model**

Think of every vulnerability as a **broken assumption at a trust boundary**. Traversal: "this filename stays inside my directory." Deserialization: "this byte stream is just data, not instructions." XXE: "this XML is inert." TOCTOU: "nothing changed between my check and my use." Business logic: "users follow the intended workflow." Mass assignment: "the client only sends the fields I meant to expose." SSTI: "user input in a template is just a value, not code." In each case the attacker violates the assumption the developer didn't know they were making. The defensive discipline is therefore: **make the assumption explicit, then enforce it structurally.** Don't validate your way to safety with blocklists (attackers find the encoding you forgot); instead remove the dangerous capability (disable external entities, disallow arbitrary type instantiation, canonicalise-then-verify paths, bind only allow-listed fields). The best fixes change the *shape* of the code so the vulnerability can't be expressed, mirroring the "parameterize, don't sanitize" lesson from injection.

**Key terms**

- **CVE** — Common Vulnerabilities and Exposures; a unique public identifier (e.g. CVE-2021-XXXXX) for a specific known vulnerability.
- **CVSS** — Common Vulnerability Scoring System; a 0–10 severity score from Base (intrinsic), Temporal (exploit maturity), and Environmental (your context) metric groups.
- **Path/directory traversal** — using `../` or absolute paths to escape an intended directory and read/write arbitrary files.
- **Insecure deserialization** — reconstructing objects from untrusted serialized data, letting an attacker instantiate dangerous types or trigger gadget chains → RCE.
- **XXE** — XML External Entity; abusing an XML parser's entity feature to read local files, perform SSRF, or DoS.
- **Race condition / TOCTOU** — Time-Of-Check to Time-Of-Use; a window between validating a resource and using it during which an attacker changes it.
- **Business-logic flaw** — an abuse of legitimate functionality (skipped steps, negative quantities, replayed coupons) that violates intended rules without any technical "bug."
- **Mass assignment / over-posting** — automatically binding client-supplied fields to internal objects, letting attackers set fields they shouldn't (e.g. `isAdmin`).
- **SSTI** — Server-Side Template Injection; user input evaluated by a template engine, often escalating to RCE.
- **Root-cause vs symptom** — the systemic reason a class of bug exists vs the specific observable instance.

**Why interviewers ask this**

These bugs separate candidates who memorised OWASP acronyms from those who can *reason about an unfamiliar vulnerability*. A junior can define XSS; a senior, shown a novel flaw, derives its root cause and proposes a class-killing mitigation. Interviewers also probe **triage judgement**: given fifty CVEs from a dependency scan, which do you fix first? The strong answer isn't "sort by CVSS Base score" — it's reasoning about **reachability and environmental context** (is the vulnerable path exposed to untrusted input? what's the blast radius?). Business-logic and mass-assignment questions specifically test whether you think like an attacker about *your own* features — the flaws no scanner finds because nothing is technically "broken." That security-mindset signal — seeing the abuse case in normal functionality — is exactly what senior AppSec roles need.

**Common confusions**

- "High CVSS = fix first" — Base CVSS ignores your context. A 9.8 in an unreachable code path may rank below a 6.5 on your internet-facing auth flow. Use Environmental metrics and reachability.
- "Input validation fixes deserialization" — no. Never deserialize untrusted data into arbitrary types; use safe formats and allow-lists. Validation of an object graph is too late.
- "XXE is an injection bug in my code" — it's a *parser configuration* bug; the fix is disabling external entities/DTDs, not sanitising XML.
- "A race condition is just a concurrency bug" — TOCTOU is a *security* bug when the gap lets an attacker swap the resource (file, balance, permission) between check and use.
- "Business-logic flaws are edge cases" — they're often the highest-impact, lowest-detectability bugs; scanners can't find them because the code works as written.
- "Mass assignment is the framework's fault" — the fix is yours: bind to explicit DTOs/allow-lists, never the raw model.

**What follows from this topic**

The triage method here (CVE/CVSS, reachability) feeds directly into the Incident Response topic — when a new CVE drops, this is how you decide whether it's a 3am page or a next-sprint ticket. The root-cause discipline connects back to the injection and memory-safety topics (parameterize / use safe types / disable the dangerous feature — same pattern each time), and forward to secure SDLC: business-logic and mass-assignment flaws are caught by **threat modeling and secure design review**, not by SAST/DAST, which is why "shift left" matters. SSRF, referenced in several answers here, gets its full treatment in the request-attacks topic.

### Q1. What are CVE and CVSS, and how do you actually use them to triage?

**CVE** is the *identity*: a globally unique ID (e.g. CVE-2021-44228) for one specific vulnerability in a specific product, so everyone refers to the same issue. **CVSS** is the *severity*: a 0–10 score built from three metric groups — **Base** (intrinsic: attack vector, complexity, privileges required, impact to CIA), **Temporal** (is a working exploit public? is there a patch?), and **Environmental** (how it applies *in your deployment*).

The triage mistake juniors make is sorting a scan report by **Base score** and working top-down. That ignores context. Real triage weighs:

- **Reachability** — is the vulnerable code path actually invoked, with attacker-controllable input, in your build? An unused transitive dependency's 9.8 may be irrelevant.
- **Exposure** — internet-facing and unauthenticated beats internal and authenticated.
- **Exploit maturity** — is it being actively exploited in the wild (check CISA KEV)? That trumps a theoretical higher score.
- **Blast radius** — what does compromise of this component reach?

So the honest answer: CVSS Base is a *starting filter*, not a work order. Use Environmental scoring and reachability analysis to produce a risk-ranked list that reflects *your* system, and prioritise known-exploited CVEs regardless of nominal score.

### Q2. What is path/directory traversal, and how do you prevent it?

Traversal abuses a file path built from user input to escape the intended directory using `../` sequences (or absolute paths, or encoded variants like `%2e%2e%2f`).

```python
# Vulnerable: user controls the path, ../ escapes the base dir
path = os.path.join(BASE_DIR, request.args["file"])   # file = "../../etc/passwd"
return open(path).read()

# Fixed: canonicalize, then verify it's still inside BASE_DIR
requested = os.path.realpath(os.path.join(BASE_DIR, request.args["file"]))
if os.path.commonpath([requested, os.path.realpath(BASE_DIR)]) != os.path.realpath(BASE_DIR):
    abort(403)
return open(requested).read()
```

The robust pattern is **canonicalise then verify containment**: resolve the path fully (`realpath` resolves `..` and symlinks), then confirm the result is still under the allowed base. Blocklisting `../` fails against encoding tricks and absolute paths. Even better, don't expose filenames at all — map an **opaque ID to a known file** via an allow-list, so user input never touches the filesystem path. Defence-in-depth: run the process with least privilege so even a successful traversal reads little.

### Q3. What is insecure deserialization and why is it so dangerous?

Deserialization reconstructs an object from a byte stream. It's *insecure* when the stream is **untrusted**, because many serializers will instantiate arbitrary types and invoke their lifecycle methods during reconstruction. An attacker crafts a payload that chains together classes already on your classpath ("gadget chains") to reach code execution — often full **RCE** without ever touching your own logic.

```java
// Vulnerable: native deserialization of attacker bytes → gadget-chain RCE
ObjectInputStream in = new ObjectInputStream(request.getInputStream());
Object obj = in.readObject();   // arbitrary types instantiated

// Fixed: use a data-only format with no type resolution
MyDto dto = objectMapper.readValue(json, MyDto.class);  // binds to one known type
```

The fixes, in order of preference: **don't deserialize untrusted data with type-resolving serializers** (Java native serialization, Python `pickle`, PHP `unserialize`, .NET `BinaryFormatter`) at all; use **data-only formats** (JSON/Protobuf) that produce plain data you then validate; if you must, restrict to an **allow-list of expected types** and add integrity protection (sign the payload so it can't be tampered). Input validation *after* deserialization is too late — the damage happens *during* reconstruction. This is OWASP's "Software & Data Integrity Failures."

### Q4. What is an XXE attack and how do you stop it?

XXE (XML External Entity) abuses an XML parser's DTD/entity feature. XML lets a document define entities that reference **external resources**; if the parser resolves them on untrusted input, an attacker can read local files, make the server issue requests (SSRF, e.g. to a cloud metadata endpoint), or trigger a DoS.

```xml
<!-- Attacker payload: entity points at a local file -->
<!DOCTYPE r [ <!ENTITY x SYSTEM "file:///etc/passwd"> ]>
<r>&x;</r>   <!-- parser inlines the file contents into the response -->
```

The fix is **parser configuration, not input sanitisation**: disable DTD processing and external entity resolution entirely.

```java
// Fixed: harden the parser
factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
```

Because it's a config bug, the systemic answer is to ship **secure-by-default parser settings** across the codebase (a hardened factory everyone uses), and prefer less dangerous formats (JSON) where XML isn't required. Note the SSRF overlap — XXE is a common *vector* for SSRF against internal services.

### Q5. What is a TOCTOU race condition, and can you give a concrete example?

TOCTOU — Time-Of-Check to Time-Of-Use — is a race where a resource is **validated at one moment and used at a later moment**, and an attacker changes it in the gap. The check passes, but the thing used is no longer the thing checked.

Classic filesystem example: check that a file isn't a symlink, then open it — an attacker swaps in a symlink to a sensitive file between the two calls.

```python
# Vulnerable: check-then-use race
if os.access(path, os.W_OK):     # TIME OF CHECK
    with open(path, "w") as f:    # TIME OF USE — attacker swapped the file in between
        f.write(data)

# Fixed: operate atomically on a handle, drop the separate check
fd = os.open(path, os.O_WRONLY | os.O_NOFOLLOW)  # atomic; refuses symlinks
```

The systemic fix is to **eliminate the gap**: perform the check and use as one **atomic operation** (open with the right flags and check the resulting handle; use `O_NOFOLLOW`), or hold a lock across the window. In application logic the same pattern appears as double-spend / balance races — the fix there is a database transaction with appropriate isolation, `SELECT ... FOR UPDATE`, or an atomic conditional update, not "read balance, check, then write."

### Q6. What is a business-logic vulnerability, and why can't scanners find them?

A business-logic flaw is an abuse of **functionality working exactly as coded**, where the *rules of the business* are violated even though nothing is technically broken. Examples: applying a single-use coupon a thousand times, ordering a **negative quantity** to get a refund, skipping the payment step by jumping straight to the confirmation endpoint, or exploiting a rounding rule to mint money.

Scanners can't find them because there's no injectable sink, no crash, no malformed input — the request is well-formed and the code returns success. The vulnerability lives in the **gap between intended workflow and enforced constraints**, which only a human who understands the business can see.

Prevention is a *design-time* activity: **threat model** each feature ("how would someone abuse this?"), enumerate **abuse cases** alongside use cases, enforce invariants **server-side** (never trust the client to sequence a workflow), validate state transitions (you can't confirm an unpaid order), and put limits on quantities/values/rates. This is why "shift left" and secure design review matter — no amount of SAST/DAST substitutes for an engineer asking "what's the incentive to cheat here, and what stops them?"

### Q7. What is mass assignment / over-posting, and how do you prevent it?

Mass assignment happens when a framework **auto-binds every field in the request body** to your internal object. If the object has sensitive fields the client shouldn't control, the attacker simply *includes them* and the framework sets them.

```javascript
// Vulnerable: whole body bound to the user model
user = User.update(req.body);      // attacker sends {"name":"x","isAdmin":true}

// Fixed: bind only explicitly allowed fields (DTO / allow-list)
const { name, email } = req.body;  // pick permitted fields only
user = User.update({ name, email });
```

The fix is an **allow-list**: bind to an explicit DTO / view model containing only the fields the client may set, never the raw domain model. Frameworks provide the mechanism (Rails `strong_parameters`, Spring `@JsonIgnore`/dedicated request DTOs, .NET binding include lists) — the discipline is to always define what's *permitted* rather than what's *forbidden* (a denylist misses the field you didn't think of). Also enforce authorization separately: even a correctly-bound field like `ownerId` needs a server-side check that the caller is allowed to set it.

### Q8. What is server-side template injection (SSTI)?

SSTI occurs when user input is **embedded into a template that the server then evaluates**, so the input is interpreted as template code rather than data. Template engines are effectively small programming languages, so this frequently escalates to **RCE**.

```python
# Vulnerable: user input becomes part of the template source
template = "Hello " + request.args["name"]     # name = "{{7*7}}" → renders "Hello 49"
return render_template_string(template)          # ...and {{config}} / object traversal → RCE

# Fixed: user input is passed as data to a static template
return render_template("hello.html", name=request.args["name"])  # {{ name }} is escaped data
```

The tell in a test is that an arithmetic payload like `{{7*7}}` renders as `49` — the engine evaluated it. The fix: **never build templates from user input.** Pass user data as **context variables** to a *static, pre-defined* template, where the engine treats it as an inert value (and auto-escapes it for the output context, which also handles XSS). If users genuinely need to supply templates, use a **sandboxed engine** with a locked-down feature set — but the safe default is that templates are code you write, and user input is data you pass in.

### Q9. Given a dependency scan with 200 findings, walk me through your triage.

The goal is a *risk-ranked* list reflecting your system, not a top-down march through CVSS scores.

1. **Dedupe and group** by component/version — 200 findings are often a handful of vulnerable packages.
2. **Filter by reachability** — is the vulnerable function/code path actually called from your app, with attacker-influenced input? Modern SCA tools do reachability analysis; a vulnerability in an unreachable path drops sharply in priority.
3. **Weight by exposure and exploitability** — internet-facing + unauthenticated + **known-exploited (CISA KEV)** + public exploit → top of the list, even at moderate CVSS. Internal, authenticated, theoretical → lower.
4. **Assess blast radius** — what does this component touch (secrets, PII, control plane)?
5. **Decide the action per item** — patch/upgrade (default), apply a compensating control (WAF rule, disable feature, network restriction) if no patch, or accept-with-justification if genuinely not applicable — and record the decision.
6. **Fix systemically** — bump shared base images/lockfiles once to clear many findings; add the version to your SBOM baseline.

The senior signal is refusing to treat the scanner's raw severity as the priority order, and reasoning explicitly about *reachability and your environment* — the same CVSS-Environmental thinking from Q1.

### Q10. Spot the vulnerability and fix it.

```python
@app.route("/download")
def download():
    filename = request.args.get("filename")
    return send_file("/var/app/files/" + filename)
```

**Vulnerability: path traversal.** `filename` is concatenated straight into the path, so `?filename=../../../../etc/passwd` escapes `/var/app/files/` and serves arbitrary files. Bonus smell: no authorization check on who may download what.

```python
@app.route("/download")
def download():
    filename = request.args.get("filename", "")
    base = os.path.realpath("/var/app/files")
    target = os.path.realpath(os.path.join(base, filename))
    if os.path.commonpath([base, target]) != base:
        abort(403)                       # escaped the base dir
    if not user_may_access(current_user, target):
        abort(403)                       # authz, not just containment
    return send_file(target)
```

Best practice beyond the patch: reference files by an **opaque ID mapped to a known path** so user input never forms the filesystem path at all, and run with least-privilege file permissions. The instance-fix is the containment check; the class-fix is not letting user input construct paths.

### Q11. How do you reason about an unfamiliar vulnerability class you've never seen before?

Use a repeatable method rather than pattern-matching to memorised bugs:

1. **Identify the trust boundary** — where does attacker-controlled data cross into a context that trusts it? (Untrusted input reaching a parser, an interpreter, the filesystem, a template, an object graph.)
2. **Name the violated assumption** — what did the developer implicitly assume that the attacker can break? ("This string is a filename, not a path." "This blob is data, not code.")
3. **Find the root cause, not the symptom** — the symptom is *file disclosed / code executed*; the root cause is *user input treated as a trusted instruction/path/type*.
4. **Pick a class-killing mitigation** — remove the dangerous capability (disable external entities), separate code from data (parameterize, pass data as context), or enforce the assumption structurally (canonicalise-and-verify, allow-list types/fields).
5. **Add defence-in-depth** — least privilege, input validation as a secondary layer, monitoring.

This is why the injection, deserialization, XXE, SSTI, and traversal fixes all *rhyme*: the winning move is nearly always **"stop conflating attacker data with trusted instructions, and remove the capability rather than filtering for it."** Demonstrating that transferable reasoning beats reciting a hundred specific fixes.

### Q12. Why is "input validation" not the primary fix for most of these vulnerabilities?

Because input validation is a **blocklist mindset applied at the wrong layer**, and blocklists lose. You'd be trying to enumerate every dangerous input — every `../` encoding, every gadget-chain payload, every template metacharacter — and attackers only need the one variant you missed (double-encoding, Unicode normalisation, a new gadget).

The durable fixes instead **separate data from code/commands at the boundary of the dangerous operation**, so the input's content stops mattering:

- SQL injection → **parameterized queries** (data can't become SQL).
- XSS → **context-aware output encoding** (data can't become markup).
- Deserialization → **data-only formats / type allow-lists** (data can't become arbitrary objects).
- SSTI → **user data as template context** (data can't become template code).
- Traversal → **canonicalise-and-verify / opaque IDs** (data can't form the path).

Input validation still earns its place as **defence-in-depth** — reject obviously malformed input early, enforce business constraints (length, type, range) — but it's the *second* line, not the primary control. The interview red flag is proposing "sanitise the input" as *the* fix for injection-family bugs; the strong answer names the structural, class-killing control first.

### Q13. What's the difference between a vulnerability, an exploit, and a payload?

Precise vocabulary signals seniority:

- **Vulnerability** — the *weakness itself*: the flaw in code, config, or design (e.g. an unauthenticated deserialization endpoint). It exists whether or not anyone attacks it.
- **Exploit** — the *technique or code that takes advantage* of the vulnerability to violate a security property (the crafted request + method that turns the flaw into actual RCE).
- **Payload** — the *attacker's intended action* delivered by the exploit (the command run, the shellcode, the data exfiltrated). The exploit is the delivery mechanism; the payload is what gets delivered.

Related terms worth distinguishing: a **PoC** (proof-of-concept) demonstrates the vulnerability is real without necessarily weaponising it; a **zero-day** is a vulnerability with no available patch (often being exploited before the vendor knows); the **attack surface** is the sum of all points where an attacker could attempt exploitation. From a defender's view you reduce the **vulnerability** count (fix the flaw), raise **exploitation cost** (mitigations, hardening), and limit **payload impact** (least privilege, segmentation) — three independent levers, which is the useful takeaway.

### Q14. How would you defend against business-logic abuse in a promo-code / checkout flow?

You can't scan your way there; you design against the incentive. Work through the **abuse cases**:

- **Replay / reuse** — coupon used many times, or across accounts. *Defend:* enforce single-use server-side (atomic "mark redeemed" in the same transaction as applying it), bind to account, cap per-user redemptions.
- **Value manipulation** — negative quantity, negative price, quantity overflow, stacking non-stackable discounts. *Defend:* validate ranges server-side, reject non-positive quantities, enforce mutual-exclusion rules on the server.
- **Workflow skipping** — jumping to order-confirmation without payment, or re-ordering steps. *Defend:* enforce a server-side state machine; an order can't reach "confirmed" from "unpaid."
- **Race conditions** — redeeming the last unit twice concurrently, or the same coupon in parallel requests. *Defend:* atomic conditional updates / row locks (the TOCTOU fix from Q5).
- **Automation** — scripted mass redemption. *Defend:* rate limiting, anomaly detection, CAPTCHA on abuse signals.

The unifying principle: **never trust the client to enforce rules or sequence, put every invariant on the server, and make redemption atomic.** And bake this in via threat modeling at design time — enumerate "how do I cheat this?" before the code ships, because these are the flaws with high impact and near-zero scanner detectability.

### Q15. A user reports they can see another user's invoice by changing the ID in the URL. What's the vulnerability and the fix?

That's **IDOR (Insecure Direct Object Reference)** — more formally **Broken Object-Level Authorization (BOLA)** — OWASP's #1 category. The endpoint uses a client-supplied object ID to fetch a record but **doesn't verify the caller is authorized for that specific object**; it authenticates *who you are* but not *what you may access*.

```python
# Vulnerable: fetches by ID with no ownership check
invoice = Invoice.get(request.args["id"])   # any id → any invoice
return render(invoice)

# Fixed: scope the lookup to the authenticated caller / check ownership
invoice = Invoice.get(request.args["id"])
if invoice.owner_id != current_user.id and not current_user.is_admin:
    abort(404)                               # 404 not 403 — don't confirm existence
return render(invoice)
```

The fix is a **server-side object-level authorization check on every access** — verify the current principal owns or is permitted the requested object, ideally by scoping the query itself (`WHERE owner_id = :me`). Additional hardening: use **unguessable identifiers** (UUIDs, not sequential integers) as defence-in-depth (not a substitute — enumeration isn't the root cause), and return **404 rather than 403** so you don't leak that the object exists. The systemic answer is a consistent authorization layer/policy enforced centrally, because IDOR recurs anywhere a developer forgets the check. This ties to the access-control topic elsewhere in the primer.

### Q16. Root cause, symptom, systemic mitigation — apply that lens to three different vulnerabilities.

This is the transferable framework the whole topic is teaching. Same lens, three classes:

| Vulnerability | Symptom (what you observe) | Root cause (the real reason) | Systemic mitigation (class-killer) |
|---|---|---|---|
| **SQL injection** | Attacker input alters query results / dumps the DB | User data concatenated into query *as code* | Parameterized queries — data can never become SQL |
| **Insecure deserialization** | Crafted blob yields RCE | Untrusted bytes reconstructed into *arbitrary types* | Data-only formats + type allow-list; don't deserialize untrusted input |
| **IDOR / BOLA** | Changing an ID exposes others' data | Object fetched by client ID *without* per-object authz | Central, server-side object-level authorization on every access |

The pattern that emerges: the **symptom** is always some undesired capability the attacker gained; the **root cause** is almost always *attacker-controlled data being trusted as instruction, identity, or authority*; and the **systemic mitigation** removes the dangerous conflation structurally rather than filtering for bad instances. Contrast that with the *instance* fix (patch this one query, sanitise this one field), which leaves the class alive elsewhere. In an interview, always name the systemic mitigation — it shows you fix classes of bugs, and it's the same discipline behind memory-safe languages and secure-by-default design in the neighbouring topics.

## Incident Response & Security Monitoring

### Summary

**What this topic covers**

Prevention fails eventually — this topic is what you do about that. It covers **detection engineering** (turning security events into meaningful signal), **security logging** (what to log and, critically, what to *never* log — secrets and PII), **SIEM** platforms, the end-to-end **incident response (IR) lifecycle** (prepare → detect → contain → eradicate → recover → lessons-learned), **digital forensics basics** and **chain of custody**, **blue-team** operations and **threat hunting**, the **alerting-vs-noise** problem, **breach disclosure** and communications, the metrics that measure a program (**MTTD/MTTR**), and **tabletop exercises**. The 16 questions treat detection and response as a **complement to prevention**, not a substitute — you build IR precisely because defence-in-depth has gaps and determined attackers get through. This is the operational, "the alarm just went off" counterpart to the design-time topics (threat modeling, secure SDLC) elsewhere in the primer.

**Mental model**

Adopt an **"assume breach"** posture: stop asking only "how do I keep attackers out?" and also ask "when one gets in, how fast do I *know*, how do I *stop* them, and how do I *recover*?" Security operations is a control loop — **collect telemetry → detect anomalies → respond → learn → feed improvements back into prevention**. Two numbers drive it: **MTTD** (mean time to *detect*) and **MTTR** (mean time to *respond/recover*). The whole discipline exists to shrink the window between compromise and containment, because impact scales with dwell time. The hardest part isn't collecting data — it's the **signal-to-noise problem**: too many alerts and analysts tune them out (alert fatigue), too few well-tuned ones and real attacks slip past. Good detection engineering is therefore about *high-fidelity* alerts mapped to real attacker behaviour (e.g. ATT&CK techniques), not maximum coverage. And IR is 80% **preparation** — the runbooks, access, and practice you build *before* the incident determine how the actual incident goes.

**Key terms**

- **SIEM** — Security Information and Event Management; centralises logs/events, correlates them, and raises alerts (Splunk, Elastic, Sentinel).
- **Detection engineering** — writing and tuning the rules/analytics that turn raw events into meaningful, actionable alerts.
- **IR lifecycle** — prepare → detect & analyse → contain → eradicate → recover → post-incident (lessons learned). (NIST/SANS phrasing.)
- **MTTD / MTTR** — mean time to detect / mean time to respond (or recover); the core speed metrics.
- **Containment** — limiting an active incident's spread (isolate hosts, revoke creds) *before* full remediation.
- **Eradication** — removing the attacker's foothold (malware, backdoors, persistence) so they can't return.
- **Chain of custody** — the documented, unbroken record of who handled evidence and when, so it's trustworthy/admissible.
- **Threat hunting** — proactively searching for attackers who evaded automated detection, based on hypotheses.
- **Blue team** — the defenders (detection, response, hardening); vs red team (offense), purple (collaboration).
- **IOC / TTP** — Indicators of Compromise (hashes, IPs, domains) vs Tactics, Techniques & Procedures (attacker behaviour); TTPs are more durable.
- **Tabletop exercise** — a discussion-based rehearsal of an incident scenario to test the plan and the people.

**Why interviewers ask this**

Because mature engineers know prevention is *necessary but insufficient*, and interviewers want to see whether you think past the perimeter. A junior focuses entirely on stopping attacks; a senior designs for detection and recovery too, and can articulate the IR lifecycle without notes. Logging questions are a favourite trap: candidates enthusiastically say "log everything" — and the strong answer immediately flags that logging passwords, tokens, full card numbers, or PII *creates* a breach (your logs become the target). Interviewers also probe **judgement under pressure**: containment-vs-evidence tradeoffs, when to disclose, how you'd run the first hour. And they look for the **feedback loop** — do you treat a post-mortem as blameless learning that hardens the system, or as a box to tick? That "learn and improve" instinct is the difference between a program that gets safer over time and one that keeps re-fighting the same incident.

**Common confusions**

- "Log everything" — no. Logging secrets/PII turns your log store into a high-value breach target and can violate GDPR/PCI. Log *security-relevant events*, redact sensitive fields.
- "Containment = eradication" — different phases. Contain *first* (stop the bleeding), then eradicate the root cause; rushing to wipe can destroy evidence and miss persistence.
- "More alerts = better security" — the opposite past a point; alert fatigue means real signals get ignored. Fidelity beats volume.
- "SIEM is detection" — a SIEM is a platform; detection quality comes from the *rules/analytics* you engineer and tune.
- "IOCs are enough" — hashes and IPs change trivially; hunting on **TTPs/behaviour** catches attackers who rotate infrastructure.
- "The post-mortem is about finding who to blame" — blameless post-mortems find *systemic* causes; blame suppresses the reporting you need.

**What follows from this topic**

IR closes the loop opened by every other topic: the memory-safety and common-vuln CVEs are *what* you detect and respond to; the triage method from the vulnerabilities topic decides *which* alerts and CVEs are urgent; secure logging connects to the privacy/compliance topic (breach-notification law, PII handling); and the lessons-learned phase feeds fixes back into secure SDLC and threat modeling. Detection is the explicit *complement* to prevention — the acknowledgement that defence-in-depth has gaps, so you invest in seeing and surviving the intrusion, not just preventing it.

### Q1. Walk me through the incident response lifecycle.

The standard NIST/SANS lifecycle has six phases, and the interview answer should stress that they're a *loop*, weighted toward the ends:

1. **Prepare** — the unglamorous 80%: IR plan and runbooks, roles and on-call, communication channels, logging/monitoring in place, access and tooling ready, and *practice* (tabletops). How well you prepared determines how the incident actually goes.
2. **Detect & analyse** — identify that something happened (from SIEM alerts, hunting, a report, an external tip), triage severity, and scope it: what's affected, how bad, is it ongoing?
3. **Contain** — stop the spread *now*: isolate compromised hosts, revoke credentials/sessions, block C2 — short-term containment to halt damage while you plan proper remediation (and while preserving evidence).
4. **Eradicate** — remove the attacker's foothold entirely: malware, backdoors, persistence mechanisms, and the **root cause** (the exploited vulnerability). Half-eradication means they walk back in.
5. **Recover** — restore systems to known-good, verify integrity, monitor closely for re-compromise, and return to normal operations deliberately.
6. **Post-incident / lessons learned** — a **blameless post-mortem**: timeline, root cause, what worked, what didn't, and concrete action items that feed back into prevention.

The key framing: it's cyclical — lessons learned harden preparation for next time — and **containment precedes eradication** (stop the bleeding before you operate).

### Q2. What should you log for security, and what must you never log?

**Log the security-relevant events** — the things you'd need to detect an attack and reconstruct an incident:

- Authentication events (logins, *especially failures*, MFA challenges, lockouts), and logouts.
- Authorization decisions, especially **denials** and privilege changes.
- Access to sensitive resources/data, admin actions, config and permission changes.
- Input-validation failures / security exceptions, and anomalies (rate-limit trips).
- Enough context to be useful: timestamp (synced clocks), source IP, **user/actor ID**, action, resource, outcome, and a correlation/request ID.

**Never log:**

- **Credentials** — passwords (even hashed), API keys, tokens, session IDs, secrets.
- **Full sensitive PII / financial data** — full card numbers (PCI forbids it), CVV, SSNs, health data; **redact or mask** (last-4 only).
- Full request/response bodies that carry the above.

The reason is sharp: **logs are widely read, retained, shipped to third-party SIEMs, and rarely as protected as the primary datastore** — so anything sensitive in them multiplies your attack surface and can itself constitute a breach (and violate GDPR/PCI). The discipline: log *events and identifiers*, not *secrets and raw sensitive data*; enforce redaction at the logging layer so it can't be bypassed by a careless log line. This is OWASP's "Security Logging & Monitoring Failures" — both *too little* (can't detect) and *too much* (leaks) are failures.

### Q3. What is a SIEM and what role does detection engineering play?

A **SIEM** (Security Information and Event Management) is the platform that **aggregates logs and events from across the estate** — endpoints, servers, network gear, cloud, applications — into one place, then **correlates** them and raises alerts. Its value is correlation across sources: a failed-login spike on the VPN *plus* a new admin account *plus* an outbound connection to an unusual host tells a story no single log does.

But a SIEM is just the engine. The security actually comes from **detection engineering** — the discipline of *writing, testing, and tuning the detection rules/analytics* that turn raw events into high-fidelity alerts. Good detection engineering:

- Maps detections to real attacker behaviour (e.g. **MITRE ATT&CK** techniques) rather than arbitrary thresholds.
- Optimises for **signal, not coverage** — fewer, higher-confidence alerts an analyst will actually act on.
- Continuously tunes to cut false positives (alert fatigue) and false negatives (missed attacks), treating detections as code (version-controlled, tested).

The interview point: buying a SIEM doesn't give you detection; *engineering and maintaining the rules* does. An untuned SIEM is an expensive noise generator.

### Q4. Explain MTTD and MTTR. Why do they matter?

**MTTD (Mean Time To Detect)** is the average time from when a compromise *occurs* to when you *become aware* of it. **MTTR (Mean Time To Respond / Recover)** is the average time from detection to containment/remediation. Together they define the **dwell time** — how long an attacker operates in your environment.

They matter because **impact scales with dwell time.** An attacker detected and contained in an hour steals or damages far less than one who lives undetected for months (the industry-average dwell time has historically been *weeks to months*, which is the scary part). The entire security-operations investment — logging, SIEM, detection engineering, hunting, runbooks, automation — is ultimately about **driving these two numbers down.**

Using them well: track the trend, not a vanity snapshot; break MTTR into phases (time to triage, contain, eradicate, recover) to find the bottleneck; and pair them with quality metrics (false-positive rate, % of incidents found by *your* detection vs reported externally). If most breaches are discovered by an outside party rather than your own tooling, your MTTD is effectively broken regardless of the number.

### Q5. How do you deal with alert fatigue and the signal-to-noise problem?

Alert fatigue is when analysts face so many low-value alerts that they start ignoring, auto-closing, or missing the real ones — a genuine security failure, because a true positive buried in noise is functionally undetected. The problem is *fidelity*, not volume, so the fixes optimise for signal:

- **Tune aggressively** — every alert that fires must be *actionable*. If an alert is routinely a false positive, fix or retire it; measure and drive down false-positive rate.
- **Map detections to attacker behaviour** (ATT&CK TTPs) rather than noisy generic thresholds, so alerts correspond to things that actually matter.
- **Risk-based alerting / correlation** — don't alert on each weak signal; escalate when *several* correlate into a high-confidence story (failed logins + new device + data access).
- **Enrich and prioritise** — auto-add context (asset criticality, user role, threat intel) so analysts triage fast, and rank by risk.
- **Automate the rote** (SOAR) — auto-enrich, auto-contain low-risk cases, and reserve human attention for genuine judgement calls.
- **Suppress/deduplicate** — group related alerts into one incident.

The mindset: **a detection you can't respond to is worse than no detection**, because it costs attention and trains people to ignore alarms. Quality over quantity, always.

### Q6. What's the difference between IOCs and TTPs, and why does it matter for detection?

**IOCs (Indicators of Compromise)** are *atomic artifacts* of a known attack: file hashes, malicious IPs/domains, URLs, registry keys. **TTPs (Tactics, Techniques, and Procedures)** describe attacker *behaviour*: how they gain access, escalate, move laterally, and exfiltrate (e.g. "credential dumping," "living-off-the-land via signed binaries").

The distinction drives detection strategy via the **"Pyramid of Pain"**: IOCs are trivial for an attacker to change — rotate an IP, recompile to change a hash — so detections built purely on IOCs are brittle and always a step behind. TTPs are **expensive for the attacker to change** because they reflect *how they operate*; detecting the behaviour ("a service account suddenly enumerating the domain") catches them even when they've swapped all their infrastructure.

So mature detection engineering leans toward **behaviour-based detection mapped to TTPs (MITRE ATT&CK)**, using IOCs as a fast, cheap first layer (block known-bad) but never the whole strategy. Threat hunting (Q9) is almost entirely TTP-driven for the same reason: you're looking for the *behaviour* of an adversary who has, by definition, evaded your IOC-based tooling.

### Q7. What are the basics of digital forensics and chain of custody?

**Digital forensics** is the disciplined collection, preservation, and analysis of evidence to reconstruct *what happened* — which systems, what the attacker did, what data was touched. Two foundational principles:

- **Order of volatility** — capture the most ephemeral evidence first: memory (RAM), running processes and network connections, then disk, then logs/backups. Reboot or careless handling destroys volatile evidence.
- **Preserve, don't alter** — work on **forensic images / copies**, never the live original; verify integrity with **cryptographic hashes** so you can prove the evidence wasn't modified. Analysis happens on the copy.

**Chain of custody** is the documented, **unbroken record of who collected, handled, transferred, and stored each piece of evidence, when, and how it was protected.** It exists so the evidence is *trustworthy* and, if it ever reaches litigation or law enforcement, *admissible* — any unexplained gap lets the evidence be challenged. In practice: timestamp and hash on collection, log every handoff, restrict and record access, store securely.

The interview nuance is the **containment-vs-forensics tension** (see Q8): pulling the plug stops the attacker but wipes volatile evidence. For serious incidents (legal exposure, regulated data, potential prosecution) you capture memory/state *before* remediating, and you loop in legal early.

### Q8. During active containment, how do you balance stopping the attacker against preserving evidence?

This is a real tension and the answer is *it depends on the stakes*, decided deliberately rather than by reflex:

- **Contain fast when** ongoing damage is severe and escalating — active data exfiltration, ransomware encrypting live, spreading laterally. Stopping the bleeding wins; some evidence loss is acceptable.
- **Preserve first when** the incident may involve legal action, regulated data, insider threat, or nation-state activity, *and* the immediate damage is bounded. Here you **capture volatile evidence before remediating** — memory image, live network/process state — because a reboot or reimage destroys it forever.

Practical way to get both: prefer containment actions that **isolate without destroying state** — network-quarantine the host (block its traffic) rather than powering it off, disable/rotate the compromised credentials, and snapshot VMs — so the attacker is cut off *but* memory and disk are preserved for imaging. Involve **legal and leadership early** for anything with disclosure or litigation implications, so the collect-vs-contain call is made with the right context, not by a lone responder at 3am.

The senior signal: naming the tradeoff explicitly, defaulting to *isolate-then-image* rather than *power-off*, and knowing that the right answer changes with the incident's legal and business stakes.

### Q9. What is threat hunting and how does it differ from automated detection?

**Threat hunting is proactive, hypothesis-driven searching for attackers who have already evaded your automated defences.** Automated detection is *reactive* — it waits for a known-bad pattern to fire an alert. Hunting starts from the **assume-breach premise** ("a sophisticated attacker is already in — where would they be and what would they be doing?") and goes looking, *without* waiting for an alert.

A hunt cycle: form a **hypothesis** grounded in attacker TTPs or threat intel ("if an attacker compromised a service account, we'd see it authenticating from unusual hosts or enumerating the directory") → **query** the telemetry (SIEM, EDR, logs) for evidence → **investigate** findings → and, crucially, **feed results back** — a hunt that finds a real technique becomes a *new automated detection* so you never have to hunt for that manually again.

So the two are complementary: automation handles the **known** at scale and frees humans; hunting finds the **unknown** and the evasive, then converts discoveries into automation. Hunting is inherently **TTP/behaviour-focused** (Q6) because IOC-based tooling has, by definition, already missed anything a hunt would find. It's a hallmark of a mature blue team — you're not just waiting for alarms, you're actively assuming they missed something.

### Q10. Define the security team colours — red, blue, and purple.

- **Red team** — *offense*. They emulate real adversaries against your live environment (often stealthily, goal-oriented — "can we reach the crown-jewel data?") to test whether the blue team can prevent, detect, and respond. Broader/goal-driven than a scoped penetration test.
- **Blue team** — *defense*. The defenders who build and run detection, monitoring, and incident response, and harden systems. This entire topic is blue-team work: SIEM, detection engineering, hunting, IR.
- **Purple team** — *collaboration*, not a standing team so much as a mode: red and blue work **together**, red executing techniques while blue watches whether their detections fire, tuning in real time. It turns an adversarial test into a **feedback loop** that measurably improves detection coverage.

The point of red/blue exercises is *validating detection and response*, not just finding vulnerabilities — a red team that gets to the goal undetected has proven a *detection* gap, which is exactly the MTTD problem. Purple teaming closes that gap fastest because the two sides share findings immediately instead of at the end-of-engagement report. (Related: **bug bounties** and **pen tests** are covered in the AppSec-testing topic; these colour teams are the operational defence/offense pairing.)

### Q11. Talk me through your first hour responding to a suspected breach.

Structured calm beats heroics. Roughly:

1. **Verify and triage** — is this a true positive? Confirm the alert/report, and assess scope and severity fast: what systems, what data, is it *ongoing*? Avoid tunnel vision on the first symptom.
2. **Activate the plan** — declare an incident, pull in the IR team and an **incident commander**, open the pre-agreed comms channel, and start a **timeline log** (every action, timestamped — you'll need it for the post-mortem and possibly legal).
3. **Contain without destroying evidence** — isolate affected hosts (network-quarantine, not power-off), revoke/rotate compromised credentials and sessions, block known-bad C2. Snapshot/capture volatile state if forensics matters.
4. **Communicate** — notify the right internal stakeholders (leadership, legal) per the plan; *don't* prematurely go external. Keep sensitive incident discussion off potentially-compromised channels.
5. **Preserve evidence** — collect logs and images per chain-of-custody, so eradication doesn't erase the story.

Throughout: **follow the runbook, don't improvise from scratch** — which is why preparation is the real work. State clearly that you *contain before eradicating* and that you're logging everything for the lessons-learned phase. The maturity signal is calm process, clear roles, and evidence-awareness rather than reflexively wiping the box.

### Q12. When and how should you disclose a breach?

Disclosure is driven by **legal obligation, ethics, and trust**, and it's a decision for legal/leadership — but engineers must understand the shape:

- **When** — many regulations impose **hard deadlines**: **GDPR** requires notifying the supervisory authority within **72 hours** of becoming aware of a personal-data breach (and affected individuals if high risk); US state laws, HIPAA, PCI-DSS, and sector rules add their own triggers and timelines. So the clock often starts at *awareness*, not at full understanding — you disclose based on what you reasonably know, and update.
- **To whom** — regulators/authorities, affected individuals/customers, sometimes payment brands, partners, and (for public companies) potentially investors. Coordinated **responsible disclosure** with law enforcement may apply.
- **How** — clear, honest, and timely: what happened, what data was affected, what the risk is to the individual, what you're doing about it, and what they should do (reset passwords, watch accounts). **Don't over-promise, don't speculate, don't downplay** — trust is lost more by a botched, evasive disclosure than by the breach itself.

The anti-patterns interviewers listen for: hiding or delaying disclosure (illegal and reputationally fatal), or paying to cover it up. The right instinct: **involve legal early, meet the statutory clocks, communicate transparently.** This connects directly to the privacy/compliance topic (breach-notification law).

### Q13. What is a tabletop exercise and why run one?

A **tabletop exercise** is a **discussion-based rehearsal** of an incident: the team gathers (no real systems touched) and walks through a realistic scenario a facilitator narrates — "an employee reports ransomware on a finance server; it's now spreading" — with each participant explaining what they'd do, in role, as the scenario escalates.

You run them because **an incident is the worst time to discover your plan is broken.** Tabletops surface gaps cheaply and safely:

- **Process gaps** — undefined decision authority ("who can shut down production?"), missing runbooks, unclear escalation.
- **People gaps** — who's actually on call, do they know their role, are contacts current?
- **Communication gaps** — how do we coordinate if the primary channel (email/Slack) is compromised? Who talks to legal, press, customers?
- **Tooling/access gaps** — do responders have the access and logs they'd need, *before* the real event?

They also build the **muscle memory** so the real response is calm and coordinated rather than improvised. They ladder up in fidelity: tabletops (talk) → functional drills → full **red-team/purple-team** exercises (live). The through-line to the whole topic: this is the **"prepare"** phase in action — the cheapest, highest-leverage investment in a good response, precisely because it happens *before* MTTD/MTTR are on the line.

### Q14. Why is detection a necessary complement to prevention, not a replacement for it?

Because **prevention is imperfect and will eventually fail** — new zero-days, misconfigurations, phished credentials, insider threats, and the reality (from the memory-safety and vulnerability topics) that a huge fraction of software carries exploitable flaws. If your *entire* strategy is keeping attackers out, then the first successful intrusion gives them unlimited, unobserved dwell time — and impact scales with dwell time.

Detection and response are the **assume-breach** answer: layered so that *when* prevention fails, you still **see** the intruder, **stop** them quickly, and **recover** — shrinking MTTD/MTTR so a breach is contained instead of catastrophic. It's the same defence-in-depth logic applied to time: prevention reduces the *probability* of compromise; detection/response reduces the *impact and duration* of the compromises that get through.

The relationship is a **loop**, not a substitution: detection tells you *where prevention failed*, and the lessons-learned phase feeds those failures back into hardening (patch the vuln, fix the config, add the control). A program that only prevents is brittle and blind; one that only detects is perpetually cleaning up. You need both, and the mark of maturity is investing in *seeing and surviving* intrusions, not just wishing them away. This is the framing that ties this topic back to every prevention-focused topic in the primer.

### Q15. What metrics tell you whether your security operations program is actually working?

Beyond MTTD/MTTR (Q4), a balanced set — and, importantly, ones that resist gaming:

- **Detection source ratio** — what fraction of incidents *your own* tooling caught vs those reported by an outside party (customer, researcher, law enforcement). A high "found externally" rate means your MTTD is broken no matter what the dashboard says.
- **Coverage** — detection coverage across the MITRE ATT&CK matrix: which attacker techniques could you *actually* detect? Gaps are your blind spots.
- **Alert quality** — false-positive rate and true-positive rate; the ratio of alerts investigated vs auto-closed/ignored (a proxy for alert fatigue).
- **MTTR broken into phases** — time to triage / contain / eradicate / recover, to locate the bottleneck.
- **Dwell time** trend — are attackers being caught earlier over time?
- **Post-incident action-item completion** — are lessons-learned fixes actually shipped, or do the same incidents recur?

The caution: **avoid vanity/gameable metrics** like raw "number of alerts handled" (rewards noise) or "vulnerabilities closed" without risk-weighting. And be wary of metrics that incentivise *hiding* incidents (if reporting an incident hurts a team's numbers, they'll stop reporting). Good metrics drive the behaviour you want — faster detection, higher-fidelity alerts, closed feedback loops — and are read as *trends*, not single snapshots.

### Q16. How does the lessons-learned / post-mortem phase feed back into prevention?

This is where an incident *pays for itself* — the loop that makes the whole program get safer over time instead of re-fighting the same fire. After recovery, the team runs a **blameless post-mortem**:

- **Reconstruct the timeline** — from initial compromise to full recovery, using the logged actions and forensic evidence.
- **Find the root cause(s)** — not just the proximate malware, but *why* it succeeded: the unpatched CVE, the missing MFA, the over-permissive IAM role, the log that wasn't collected, the alert that fired but nobody saw.
- **Assess the response itself** — what detection worked, what was too slow, where the runbook fell short (MTTD/MTTR gaps).
- **Produce concrete, owned action items** — and this is the crucial part: they must feed **back into the earlier topics** — patch and add SCA gates (vulnerability mgmt), fix the design flaw via **threat modeling / secure SDLC**, tighten **least privilege**, close the **logging gap**, and write a **new detection** so next time it's caught automatically. Then *track them to completion*.

**Blameless** is load-bearing: the goal is *systemic* fixes, and blame culture makes people hide incidents and details, starving you of the very information you need. The interview signal is treating a post-mortem as a learning-and-hardening engine with tracked outcomes — closing the loop from "we got hit" to "we're measurably harder to hit the same way" — which is exactly why detection and response *strengthen* prevention rather than replacing it.
## Privacy, Compliance & Governance

### Summary

**What this topic covers**

This topic is the "the code is secure, but is it *allowed*?" layer — the legal, regulatory, and organisational scaffolding that turns ad-hoc security into a program. It sits on top of every technical control in the rest of this primer. Three concern areas live here: (1) **data governance** — knowing what data you hold, classifying it (public / internal / confidential / restricted), minimising it, and retiring it (retention & deletion); (2) **regulatory frameworks** — GDPR and CCPA for privacy, PCI-DSS for card data, plus the assurance regimes SOC 2 and ISO 27001 that customers demand before they'll trust you; and (3) **the human program** — security policies, security-by-design, a security culture with champions, and responsible/coordinated vulnerability disclosure. The 16 questions here cover PII classification, data minimisation, the GDPR data-subject rights, breach-notification clocks, what PCI-DSS actually mandates, how SOC 2 differs from ISO 27001, encryption/pseudonymisation/anonymisation as compliance tools, and how you build a security culture rather than a compliance checkbox. Interviewers use this topic to find out whether you can talk to a lawyer, an auditor, and a CISO — not just a compiler.

**Mental model**

Compliance is *risk transfer and evidence*, not security itself. Security is "can an attacker get in"; compliance is "can you *prove* to a regulator, auditor, or customer that you took reasonable care." The two overlap heavily but are not the same — you can be compliant and insecure (checkbox theatre) or secure and non-compliant (great controls, no evidence). The senior mental move is to treat data as a **liability, not just an asset**: every field of PII you store is something you must protect, disclose, delete on request, and report if breached. So the cheapest control is *not collecting it*. Then think in terms of the data lifecycle — collect → classify → store → use → share → retain → delete — and apply a control at each stage (minimisation at collect, encryption at store, least-privilege at use, DPAs at share, retention limits at retain, verifiable deletion at delete). Frameworks (GDPR, PCI, SOC 2) are just structured checklists over that lifecycle. Design the lifecycle right and compliance mostly falls out.

**Key terms**

- **PII** — personally identifiable information; data that identifies a person (name, email, SSN) directly or in combination. **Sensitive PII / special-category data** (health, biometrics, race, religion) gets stricter treatment.
- **Data minimisation** — collect and keep only what you actually need, for only as long as you need it. A GDPR principle and the single best privacy control.
- **Data classification** — labelling data (public / internal / confidential / restricted) so controls scale to sensitivity.
- **GDPR** — EU regulation; lawful basis, data-subject rights (access, erasure, portability), 72-hour breach notification, fines up to 4% of global revenue.
- **CCPA/CPRA** — California's analogue; right to know, delete, and opt out of "sale" of personal data.
- **Right to erasure** ("right to be forgotten") — data subjects can demand deletion; you must be able to actually find and delete their data.
- **PCI-DSS** — contractual standard for anyone handling payment cards; the biggest win is *never storing the PAN* (tokenise / outsource to a processor).
- **SOC 2** — AICSPA audit report on controls against the Trust Services Criteria (security, availability, confidentiality, processing integrity, privacy). Type I = design at a point in time; Type II = operating effectiveness over a window.
- **ISO 27001** — international certifiable standard for an Information Security Management System (ISMS).
- **Pseudonymisation vs anonymisation** — pseudonymised data can be re-linked with a key (still personal data under GDPR); anonymised data cannot be re-identified (out of scope).
- **DPA / DPIA** — Data Processing Agreement (contract with a processor) / Data Protection Impact Assessment (risk assessment for high-risk processing).
- **Responsible disclosure / VDP** — a published policy inviting researchers to report vulnerabilities safely and legally.

**Why interviewers ask this**

A junior engineer treats compliance as someone else's problem ("legal handles GDPR"). A senior engineer knows that *the architecture* determines whether compliance is cheap or impossible — you can't bolt on "right to erasure" if you've fanned PII into fifteen denormalised caches and a data lake with no lineage. The signal interviewers want: can you make design decisions that keep the company out of regulatory trouble *before* the lawyers get involved? Can you explain the 72-hour breach clock, why you tokenise cards instead of storing them, and why "we hashed the emails" doesn't make them anonymous? At senior/staff level they're also probing whether you can drive a security *culture* — champions, threat modeling in design review, secure defaults — rather than nagging people after the fact. Getting the pseudonymisation-vs-anonymisation distinction right is a classic senior tell.

**Common confusions**

- "We encrypted it, so GDPR doesn't apply" — encrypted personal data is still personal data; encryption reduces breach-notification obligations but doesn't take you out of scope.
- "Hashing emails anonymises them" — no. A hash is a deterministic pseudonym; the same email always hashes the same, so it's re-identifiable/linkable. That's pseudonymisation, not anonymisation.
- "PCI-DSS means we must encrypt card numbers" — the *better* answer is don't store them at all; use a processor's token so the PAN never touches your systems (shrinks your PCI scope dramatically).
- "SOC 2 and ISO 27001 are the same" — SOC 2 is an attestation *report* (US-centric, auditor's opinion); ISO 27001 is a *certification* of a management system (international). Customers ask for one or the other by region.
- "Compliance means we're secure" — compliance is a floor and a snapshot; attackers don't care about your audit window.
- "Retention forever is safe" — data you keep past its purpose is pure liability: more to breach, more to disclose, more to delete on request, and often a GDPR violation.

**What follows from this topic**

Governance is the frame around every technical topic: encryption at-rest/in-transit (Cryptography), access control and least privilege (Authorization), secure logging that excludes PII (Incident Response & Monitoring), and secure-by-design (which is both an OWASP category and the subject of the next topic, Secure Design Patterns & Defense in Depth). Breach notification connects directly to the incident-response lifecycle. And building a security culture / champions program is what makes the *Secure SDLC* actually happen instead of being a document nobody reads.

### Q1. What is PII, and how do you classify and handle different sensitivity levels?

**PII (personally identifiable information)** is any data that identifies a person, alone or in combination with other data. It comes in tiers:

- **Direct identifiers** — name, email, phone, SSN/national ID, passport number.
- **Indirect / quasi-identifiers** — DOB, postcode, gender; individually weak, but combinable to re-identify (the classic result: DOB + gender + ZIP identifies ~87% of Americans).
- **Sensitive / special-category data** — health, biometrics, genetics, race, religion, sexual orientation, political views. GDPR gives these extra protection and usually requires explicit consent.

**Handle by classification, not case-by-case.** Adopt a small label set — e.g. `public / internal / confidential / restricted` — and attach controls to the label:

| Class | Example | Controls |
|---|---|---|
| Public | Marketing copy | None |
| Internal | Internal wiki | AuthN required |
| Confidential | Customer email, orders | Encrypt at rest, access-logged, least-privilege |
| Restricted | SSN, card data, health | Encrypt + tokenise, strict RBAC, DLP, audit every access |

Tag data at the schema/column level so pipelines and access controls can enforce automatically. The classification drives everything downstream: what you encrypt, who can query it, how long you keep it, and whether a breach is notifiable.

### Q2. What is data minimisation and why is it the strongest privacy control?

**Data minimisation** = collect only what you need, keep it only as long as you need it, and grant access only to those who need it. It's a GDPR principle and, pragmatically, the cheapest security control you have: **data you don't hold can't be breached, subpoenaed, or mistakenly exposed.**

Concretely:
- **At collection** — don't ask for DOB if you only need "over 18"; store a boolean, not the birthday. Don't log full request bodies containing PII.
- **In storage** — don't copy PII into every microservice, cache, and analytics table. Each copy multiplies your erasure, breach, and audit surface.
- **Over time** — set retention limits and actually enforce deletion (see Q3).

The senior framing: every field of PII is a *liability with carrying cost* — protection, disclosure obligations, deletion machinery, breach exposure. Minimisation lowers all of them at once. It's also the antidote to "data lake sprawl," where nobody knows what personal data lives where, which makes "right to erasure" and breach scoping nearly impossible.

### Q3. How do you implement data retention and the right to erasure?

**Retention**: define, per data category, *why* you hold it and *how long*, then enforce automatic deletion. Implement as scheduled jobs / TTLs, not manual cleanup. "We keep everything forever" is both a GDPR violation (storage-limitation principle) and a growing liability.

**Right to erasure** (GDPR Art. 17 / CCPA delete) is an *architecture problem*, not a feature you bolt on:

- **You must be able to find every copy** of a person's data — primary DB, replicas, caches, search indexes, data warehouse, backups, logs, third-party processors. This requires **data lineage / a data map**. If PII fanned out uncontrolled, you can't comply.
- **Backups** are the classic snag: you generally can't surgically delete one record from an immutable backup. Accepted approach: document that erasure applies to live systems immediately and to backups on their rotation cycle, and ensure restored backups re-apply pending deletions.
- **Crypto-shredding** is a powerful pattern: encrypt each user's data with a per-user key; to "delete," destroy the key. The ciphertext becomes unrecoverable everywhere at once — including backups.

Design tip: centralise PII behind a service so erasure and access requests have one authoritative place to act, rather than chasing fifteen denormalised copies.

### Q4. Explain the core principles of GDPR that an engineer must design for.

GDPR is broad, but the engineering-relevant pillars are:

- **Lawful basis** — you need a legal reason to process personal data (consent, contract, legitimate interest, legal obligation, etc.). Consent must be freely given, specific, and revocable — no pre-ticked boxes.
- **Purpose limitation & minimisation** — collect for a stated purpose; don't repurpose; keep only what's needed (Q2).
- **Data-subject rights** — access (give me my data), rectification (fix it), **erasure** (delete it), portability (export it in a machine-readable form), and objection/opt-out. Your system must be able to *fulfil these programmatically*.
- **Breach notification** — notify the supervisory authority within **72 hours** of becoming aware of a personal-data breach; notify affected individuals if high risk (see Q5).
- **Privacy by design and by default** (Art. 25) — bake protection in from the start; default to the most privacy-protective setting.
- **Accountability** — you must be able to *demonstrate* compliance (records of processing, DPIAs for high-risk work, DPAs with processors).

Penalties are real: up to €20M or **4% of global annual turnover**, whichever is higher. And GDPR is extraterritorial — it applies if you process EU residents' data regardless of where you're based. CCPA/CPRA is the roughly analogous California regime (right to know/delete/opt-out of sale).

### Q5. What are your breach-notification obligations, and what makes a breach notifiable?

A **personal-data breach** is any security incident leading to accidental or unlawful destruction, loss, alteration, or unauthorised disclosure of/access to personal data — not just "hacker exfiltrated data." A lost laptop or a misconfigured public bucket counts.

Key clocks and thresholds:
- **GDPR** — notify the supervisory authority **within 72 hours** of *becoming aware*, unless the breach is "unlikely to result in a risk to rights and freedoms." Notify affected **individuals without undue delay** if the risk is *high*.
- **PCI-DSS / card schemes and many US state laws** — separate, often faster, notification duties to card networks and consumers.

**What reduces the obligation**: if the data was **strongly encrypted and the keys weren't compromised**, individual notification may not be required, because the data is unintelligible to the attacker. This is a concrete reason encryption-at-rest earns its keep beyond just "best practice."

Engineering implications: you need **detection and logging good enough to know a breach happened and what was in scope** (which records, which fields) — you can't meet a 72-hour clock if it takes you three weeks to figure out what was taken. This ties governance directly to your logging/monitoring and incident-response capability.

### Q6. What is PCI-DSS and what's the single most important thing it drives you to do?

**PCI-DSS** (Payment Card Industry Data Security Standard) is a contractual standard imposed by the card brands on anyone who stores, processes, or transmits cardholder data. It has 12 requirement areas (network security, encryption, access control, monitoring, testing, policy).

The single most important design move: **don't store cardholder data at all — especially never the full PAN, and never the CVV after authorisation (storing CVV is flatly prohibited).** Instead:

- Send card details **directly to a PCI-compliant processor** (Stripe, Adyen, Braintree) via their hosted fields / iframe so the raw PAN never touches your servers.
- Store only the processor's **token** plus non-sensitive metadata (last 4 digits, card brand, expiry) for display.

This **shrinks your PCI scope** enormously — from "full DSS audit of every system that could touch a card" to a much narrower SAQ. If you *do* store card data, requirements escalate hard: encryption with proper key management, network segmentation, strict access control, quarterly scans, penetration testing, and an annual assessment. The whole discipline of PCI is "reduce the systems in scope," and outsourcing the PAN is how you do it.

### Q7. Compare SOC 2 and ISO 27001. When do you care about each?

Both are ways to *prove* to customers you take security seriously; they differ in form and geography.

| | SOC 2 | ISO 27001 |
|---|---|---|
| What it is | An **audit report** (attestation) against the Trust Services Criteria | A **certification** of an Information Security Management System (ISMS) |
| Issued by | A CPA firm's opinion | An accredited certification body |
| Geography | US-centric (customers there ask for it) | International |
| Output | A confidential report you share under NDA | A public certificate |
| Type/flavour | **Type I** = controls designed at a point in time; **Type II** = controls *operating effectively* over 6–12 months | Certification + surveillance audits, 3-year cycle |
| Trust criteria | Security (required) + availability, confidentiality, processing integrity, privacy (optional) | Annex A controls across the ISMS |

**When you care**: enterprise customers won't sign until you can hand them one of these. US SaaS buyers usually ask for **SOC 2 Type II**; European and global enterprises often ask for **ISO 27001**. Practically, the underlying controls overlap ~80% (access control, change management, logging, vendor management, incident response), so teams frequently pursue both off one control set. For an engineer, the day-to-day impact is: access reviews, change tickets, code review gates, logging/monitoring, and evidence collection all become *auditable* — you'll be asked to show that they consistently happen, which is why Type II ("operating effectiveness over time") is harder than Type I.

### Q8. Distinguish encryption, pseudonymisation, and anonymisation — and their compliance implications.

These are three different privacy tools, and mixing them up is a classic mistake.

- **Encryption** — reversible with a key; protects confidentiality of data at rest/in transit. The data is *still personal data* under GDPR (you hold the key), but strong encryption reduces breach-notification obligations if keys aren't compromised.
- **Pseudonymisation** — replace identifiers with a pseudonym (token, or a keyed hash) while keeping a mapping that can re-link. GDPR *encourages* it and treats it as a strong safeguard, but pseudonymised data is **still personal data and in scope** — because it can be re-identified with the extra info. Note: a plain hash of an email is pseudonymisation, not anonymisation, because it's deterministic and linkable.
- **Anonymisation** — irreversibly stripped so no one can be re-identified, even by combining with other data. Truly anonymised data falls **outside GDPR**. But real anonymisation is *hard* — you must defend against re-identification via quasi-identifiers (k-anonymity, l-diversity, differential privacy). Naive "delete the name column" is not anonymisation.

Practical rule of thumb: if there exists *any* key, mapping, or dataset that could re-link the record to a person, it's pseudonymised (in scope), not anonymised. Use pseudonymisation to reduce risk in production; reserve claims of anonymisation for data you've genuinely made non-re-identifiable, and be sceptical of that claim.

### Q9. How do you build a security culture and a security champions program?

Security fails when it's a gate the security team enforces *against* engineers; it works when engineers own it. The goal is to move security "left" and make it *everyone's* job.

**Security champions** are the core mechanism: embed one interested engineer per team as the local security point of contact. They get extra training, sit in on threat-modeling and design reviews, triage findings, and act as a two-way bridge to the central security team. This scales security expertise without hiring a security engineer per squad.

What actually builds culture:
- **Make the secure path the easy path** — paved-road libraries, secure-by-default frameworks, templates with auth/logging/rate-limiting already wired in. If the safe way is also the low-effort way, people take it.
- **Blameless post-mortems** — treat incidents as system failures, not people to punish; otherwise people hide problems.
- **Positive reinforcement, not fear** — celebrate someone who reports a vuln or writes a threat model; gamify (CTFs, secure-coding challenges).
- **Training with context** — role-relevant, hands-on, not annual click-through compliance videos.
- **Shift-left tooling** — SAST/SCA in the IDE and CI so feedback is immediate and educational, not a scary report at the end.

Interview signal: junior candidates say "run security training"; senior candidates talk about *incentives and defaults* — making insecure code harder to write than secure code, and creating champions who scale the culture peer-to-peer.

### Q10. What is a responsible / coordinated vulnerability disclosure policy, and why publish one?

A **vulnerability disclosure policy (VDP)** is a public document telling security researchers: here's how to report a vulnerability to us, here's what's in scope, and here's our promise not to pursue legal action if you act in good faith. It's often surfaced at `/.well-known/security.txt`.

Why you want one:
- **Researchers will find bugs whether you invite them or not.** A VDP gives them a *safe, legal channel* to tell you instead of dropping a 0-day publicly or selling it. No policy → good-faith researchers stay silent for fear of lawsuits, and you lose free security testing.
- **Coordinated disclosure** — you agree a timeline (commonly ~90 days) to fix before public details are released, so users are protected during the patch window.
- **Bug bounty** is the paid extension — cash rewards scaled to severity — which increases participation but needs a mature triage pipeline first.

Contrast with **full disclosure** (researcher publishes immediately, pressuring vendors but exposing users) and **non-disclosure** (vendor buries it, leaving users exposed indefinitely). Coordinated disclosure is the accepted middle ground. Key operational point: you need the internal capability to *receive, triage, and fix* reports quickly — a VDP with no one answering the inbox is worse than none. This connects to the incident-response lifecycle: an inbound report often *is* the start of an incident.

### Q11. What is privacy-by-design, and how does it show up in an architecture?

**Privacy-by-design** (and by default) means privacy is a first-class design constraint from day one, not a compliance patch at the end. GDPR Art. 25 makes it a legal requirement. Concretely, it shows up as:

- **Minimise at the schema** — don't create a column you don't need. Prefer derived flags (`is_adult`) over raw sensitive data (`date_of_birth`).
- **Privacy-protective defaults** — new features default to the *least* data sharing; opt-in, not opt-out, for anything sensitive. A user who changes nothing should be in the safe state.
- **Centralise PII** — put personal data behind a dedicated service/store so access control, audit logging, erasure, and export have one authoritative place to act.
- **Pseudonymise early** — analytics and non-production environments should get pseudonymised or synthetic data, never raw prod PII.
- **Design the data lifecycle** — retention/deletion is designed in (TTLs, crypto-shredding), not retrofitted (Q3).
- **DPIA for high-risk features** — assess privacy impact before building anything involving sensitive data, profiling, or large-scale monitoring.

The senior insight: retrofitting privacy is expensive-to-impossible (you can't easily un-sprawl PII), so the leverage is entirely in the design phase. This is the privacy sibling of "secure by design" — which is exactly where the next topic, Secure Design Patterns & Defense in Depth, picks up.

### Q12. A team wants to store users' full date of birth "for analytics." How do you push back?

Walk through it as a data-minimisation negotiation, not a flat "no":

1. **Ask what decision the data drives.** Analytics almost never needs the exact birthday; it needs *age bands* ("18–24", "25–34") or a boolean ("over 18"). If so, compute the derived value at collection and never store the raw DOB. That's minimisation (Q2) and it dodges the whole problem.
2. **If they genuinely need finer granularity**, store *age at a point in time* or a coarse bucket, not the full date. DOB is a strong quasi-identifier (DOB + ZIP + gender re-identifies most people) — treating it as ordinary analytics data raises your re-identification risk.
3. **If the raw DOB is truly required** (say, regulatory KYC), then classify it as confidential/restricted: encrypt at rest, restrict access via RBAC, log access, set retention, and keep it *out* of the analytics warehouse — send only the derived band downstream.

The framing to voice in an interview: "Every field of PII we store is a liability we have to protect, disclose, and delete on request. Before we store the birthday, let's prove we can't answer the question with an age band." That single instinct — challenge collection before designing storage — is what senior signal looks like here.

### Q13. What should you log for compliance and monitoring — and what must you never log?

Logging is a compliance requirement (SOC 2, PCI, ISO 27001 all mandate audit trails) *and* an incident-response necessity, but logs are also a top source of PII leaks.

**Do log** (security-relevant events):
- Authentication events — logins, logouts, failures, MFA challenges, password changes.
- Authorisation decisions — access denials, privilege changes, admin actions.
- Access to sensitive data — who read/exported which restricted records.
- Security-relevant config changes and use of admin/break-glass accounts.
- Enough context to reconstruct "who did what, when, from where" (user id, timestamp, source IP, action, result).

**Never log**:
- Passwords, API keys, tokens, session IDs, private keys — a leaked secret in a log is a live credential.
- Full card numbers (PAN) or CVV — PCI explicitly forbids CVV storage; logs count as storage.
- Unnecessary PII / special-category data — health, full SSNs. Mask or tokenise (`****-**-1234`).
- Full request/response bodies that may contain any of the above.

**Operational rules**: logs are themselves sensitive — protect them with access control, make them **tamper-evident/append-only** (an attacker's first move is deleting logs), retain per policy (long enough for forensics, not so long they become a liability), and centralise them (SIEM) so you can actually detect and investigate. "Security logging & monitoring failures" is its own OWASP Top 10 category precisely because teams under-log the useful events and over-log the dangerous ones.

### Q14. What's the difference between a data controller and a data processor, and why does it matter to your architecture?

Under GDPR:
- The **controller** decides *why* and *how* personal data is processed — that's usually your company for your users' data.
- The **processor** processes data *on the controller's behalf and instructions* — e.g. your cloud provider, your email-sending vendor, your analytics SaaS.

Why an engineer cares:
- **Every third party you send PII to is a processor**, and you (the controller) remain accountable for their handling. You need a **Data Processing Agreement (DPA)** with each, and you must vet their security (this is vendor risk management, which SOC 2/ISO also require).
- **Sub-processors matter** — the SaaS you use may pass data to *its* vendors. You need visibility into that chain because a breach anywhere in it can be *your* notifiable breach.
- **Data residency / transfers** — sending EU personal data outside the EEA needs a legal transfer mechanism (SCCs, adequacy). Where your processors physically store data is an architectural decision with legal weight.

Design implication: minimise the number of third parties that touch raw PII, prefer processors with strong compliance postures (SOC 2/ISO), and keep an inventory of who has what. Every integration that ships PII outward expands your compliance surface and your breach-notification exposure.

### Q15. How do security policies and standards differ, and how do they connect to engineering work?

There's a hierarchy, and conflating the levels is a common mistake:

- **Policy** — high-level *what and why*, mandated by leadership. "All customer data must be encrypted at rest." Rarely changes.
- **Standard** — the specific *what*, measurable and mandatory. "Use AES-256-GCM; TLS 1.2+." Enforceable and auditable.
- **Procedure / guideline** — the *how*, step-by-step. "To rotate a KMS key, do X, Y, Z." Changes often.

Why it matters to engineers:
- Policies/standards are what auditors check you against (SOC 2, ISO 27001). Your CI gates, IaC scanners, and code-review checklists are the *enforcement mechanisms* that turn a written standard into reality — e.g. a policy "no secrets in code" becomes a **secret-scanning gate** in CI.
- Good standards are **automatable**. If a standard can only be enforced by humans remembering, it won't hold. Encode it: linters, policy-as-code (OPA), IaC scanning (block a public S3 bucket at deploy time), dependency-scanning gates.
- The senior move is closing the loop: don't write a policy nobody can follow; write standards that map to paved-road defaults and automated checks, so compliance is a byproduct of using the platform correctly rather than a separate chore.

### Q16. Your company is expanding to the EU and to enterprise US customers. What compliance work lands on engineering?

Sequence it by what unblocks revenue and what's legally mandatory:

**GDPR (legal, non-negotiable for EU users):**
- Build **data-subject-request machinery** — programmatic access, export (portability), and *erasure* across all data stores (Q3). This is the biggest architectural lift; if PII is sprawled, start with a data map.
- Establish **lawful basis + consent management** — granular, revocable consent capture, and honour opt-outs downstream.
- Ensure **breach detection + a 72-hour notification runbook** (Q5) — which requires decent logging/monitoring.
- Sort **data residency / transfer** mechanisms and **DPAs** with every processor (Q14).

**SOC 2 Type II (unblocks enterprise US sales):**
- Formalise and *evidence* controls that likely already half-exist: access reviews, change management (PR + review gates), logging/monitoring, incident response, vendor management, encryption. Type II means proving they operate *consistently over 6–12 months* — so instrument them to produce evidence automatically.

**Cross-cutting foundations that serve both:**
- Encryption at rest and in transit everywhere; centralised secrets management with rotation.
- A **data inventory / classification** so you know what you hold and where (prerequisite for both erasure and audit scoping).
- Automated policy enforcement — secret scanning, IaC scanning, dependency scanning in CI.

The framing: GDPR and SOC 2 overlap heavily on the underlying controls, so build *one* solid control set (encryption, access control, logging, data lineage, vendor management) and let both frameworks draw from it, rather than running two parallel compliance projects.

## Secure Design Patterns & Defense in Depth

### Summary

**What this topic covers**

This is the *constructive* half of security — not "here's a vuln class," but "here are the reusable design moves that prevent whole categories of vulns before they exist." Where the vuln-specific topics teach you to recognise SQL injection or XSS, this topic teaches the underlying principles that, applied consistently, make those vulns hard to write in the first place. It covers the classic **secure design principles** — least privilege, complete mediation, fail closed/secure, secure defaults, separation of duties, economy of mechanism, least astonishment — and the concrete **defensive patterns** that implement them: allowlist input validation at trust boundaries, context-aware output encoding, parameterising *everything*, keeping secrets out of code, rate limiting/throttling, and the HTTP security headers (CSP, HSTS, X-Frame-Options). The unifying idea is **defense in depth** — layering independent controls so that any single failure isn't catastrophic. The 16 questions here move from "what is least privilege" to "layer controls for a payment endpoint" — teaching you to *design* security rather than *test* for its absence.

**Mental model**

Think like an attacker to design like a defender, then assume every one of your controls will eventually fail. **Defense in depth** is the load-bearing idea: never rely on a single control, because single controls fail — a WAF gets bypassed, a validation regex has a gap, a developer forgets a check. Layer *independent* controls (network + auth + input validation + parameterisation + least-privilege DB user + monitoring) so an attacker must defeat all of them, and a single mistake isn't fatal. The second core move is **trust boundaries**: draw the line where data crosses from a less-trusted zone to a more-trusted one (internet → your app, app → DB, service → service). At every boundary, *validate coming in and encode going out*. The third is **secure by default and fail closed**: the state you get when someone forgets to configure something, or when a check errors out, must be the *safe* state — access denied, feature off, connection refused. Security you have to remember to turn on is security that's off. Together these say: don't secure the happy path; secure the failure modes.

**Key terms**

- **Defense in depth** — multiple independent, layered controls so no single failure is catastrophic.
- **Least privilege** — every user, service, and process gets the minimum access needed, and no more. The single most broadly useful principle.
- **Complete mediation** — check authorisation on *every* access to a protected resource, every time — no caching a "yes" and skipping later checks.
- **Fail closed / fail secure** — on error or ambiguity, deny. Contrast fail-open (allow on error), which is how outages become breaches.
- **Secure defaults** — the out-of-the-box configuration is the safe one; you opt *into* risk, never *out of* safety.
- **Separation of duties** — split a sensitive action across two parties so no single person (or compromised account) can complete it alone.
- **Trust boundary** — the line where data moves between zones of differing trust; where validation and encoding must happen.
- **Input validation (allowlist)** — accept only known-good input (define what's allowed, reject the rest), rather than denylisting known-bad.
- **Output encoding** — transform data for the specific context it's rendered in (HTML, JS, URL, SQL) so it's treated as data, not code.
- **Economy of mechanism** — keep security-critical design simple; complexity hides bugs.
- **Least astonishment (for security)** — the secure behaviour should also be the *expected*, obvious behaviour; surprising security semantics get bypassed.
- **Security headers** — CSP, HSTS, X-Frame-Options, etc.; browser-enforced defense-in-depth layers.

**Why interviewers ask this**

Anyone can memorise "SQL injection → use parameterised queries." What separates a senior engineer is deriving that fix from a principle ("never mix code and data across a trust boundary") and applying the *same* principle to command injection, XSS, and template injection — all instances of one idea. Interviewers ask about design patterns and principles to see whether your security knowledge is a *checklist* (brittle, misses novel cases) or a *model* (generative, handles cases you've never seen). The other big signal is defense-in-depth thinking: a junior says "we validate input, so we're safe"; a senior says "validation is one layer — we *also* parameterise the query, run the DB user with least privilege, and monitor for anomalies, because validation will eventually have a gap." When you can layer controls and reason about what happens when each one fails, you're designing security, not bolting it on.

**Common confusions**

- "Input validation prevents SQL injection" — it's *defense in depth*, not the fix. Parameterised queries are the fix; validation is a valuable extra layer. Relying on validation alone is fragile.
- "Denylist the bad characters" — denylists are always incomplete; attackers find the encoding you forgot. **Allowlist** known-good instead.
- "Sanitise input for XSS" — the primary fix is context-aware *output encoding* at render time, not scrubbing input on the way in. The same string is safe in one context and dangerous in another.
- "Fail open so we don't block users during an outage" — that turns your auth service outage into an authorisation bypass. Security-critical checks fail *closed*.
- "We have a WAF, so we're covered" — a WAF is one layer that can be bypassed; it's a supplement to secure code, never a substitute.
- "More security controls = more secure" — not if they're the *same kind*. Depth means *independent* layers; ten input filters and no least-privilege is shallow.

**What follows from this topic**

These principles are the *why* behind every specific mitigation in the primer: parameterisation (Injection), output encoding + CSP (XSS), least privilege (Authorization, Cloud/IAM), fail-closed (Authentication, Access Control), secure defaults (Security Misconfiguration in OWASP Top 10), secrets-never-in-code (Secrets & Supply Chain). And they're what you *apply* in the final topic — Security Scenario & Interview Playbooks — where "how would you secure X" is really "which of these layers apply to X, and what happens when each fails."

### Q1. What is defense in depth, and why can't you rely on a single control?

**Defense in depth** means layering multiple *independent* security controls so that compromising one doesn't compromise the system. The premise is humility: every control eventually fails — a validation regex has a gap, a WAF rule gets bypassed, a developer forgets an auth check, a library has a 0-day. If your security is one line of defence, one failure is a breach. If it's five independent layers, an attacker has to defeat all five and you have time to detect them trying.

Concrete example — protecting a database from injection, in layers:

```
Attacker
   │
   ▼
[ WAF / rate limiting ]        ← may be bypassed
   │
[ Input validation (allowlist)]← may have a gap
   │
[ Parameterised query ]        ← the real fix — separates code from data
   │
[ Least-privilege DB user ]    ← even if injected, can't DROP TABLE or read other schemas
   │
[ Monitoring / anomaly alerts ]← detects the attempt regardless
   │
   ▼
Database
```

Notice each layer is a *different kind* of control (network, application, query, account, detection) — that's what makes them independent. Ten input filters would not be depth; they all fail to the same class of bypass. The senior instinct: when asked "how do you prevent X," never give one answer — give the layers, and say what happens when each fails.

### Q2. Explain least privilege and give three places you'd apply it.

**Least privilege**: grant every user, service, process, and credential the *minimum* access required to do its job — nothing more — and grant it for the *minimum time*. It's the highest-leverage principle in security because it shrinks the blast radius of *every* compromise: if an attacker takes over a component, they inherit only that component's (minimal) rights.

Three applications:
1. **Database users** — the web app connects with an account that can `SELECT/INSERT/UPDATE` only the tables it needs, not a superuser. Then even a successful SQL injection can't `DROP TABLE`, read other schemas, or escalate. (This is why least privilege is a defense-in-depth layer behind parameterisation.)
2. **Cloud IAM roles** — a service gets a scoped role (read *this* bucket, write *this* queue), not `AdministratorAccess`. Over-permissive roles are the #1 cloud breach amplifier — one leaked key with broad rights owns the account.
3. **Process/container** — run as a non-root user, drop Linux capabilities, mount filesystems read-only where possible. A compromised process that isn't root can't do nearly as much.

Also applies to people (JIT/temporary elevation instead of standing admin), API tokens (scoped, short-lived), and feature flags. The test question to ask of any grant: "what's the worst this identity could do if fully compromised?" — then shrink it.

### Q3. What is the difference between fail-open and fail-closed, and which do you want?

- **Fail-closed / fail-secure**: when something errors, times out, or is ambiguous, **deny access**. This is what you want for security-critical decisions.
- **Fail-open**: when something errors, **allow access**. This turns an availability problem into a security breach.

The canonical trap: an authorisation check that calls an external policy service.

```javascript
// Fail-open — DANGEROUS
async function canAccess(user, resource) {
  try {
    return await authService.check(user, resource);
  } catch (err) {
    return true; // "don't block users if auth is down" — now an outage = bypass
  }
}

// Fail-closed — CORRECT
async function canAccess(user, resource) {
  try {
    return await authService.check(user, resource);
  } catch (err) {
    log.error('authz check failed', err);
    return false; // deny on error; degraded availability beats a breach
  }
}
```

The nuance: fail-closed is right for *security* decisions (authz, authentication, integrity checks). For pure *availability* concerns you sometimes deliberately fail open (e.g. a CDN serving stale content when origin is down) — but never for a control that's protecting a resource. The tell in an interview: if someone says "we let it through so we don't block users," ask what an attacker does when they can *cause* the error condition on demand. Firewalls, TLS validation, licence checks, and rate limiters should all fail closed.

### Q4. Why is allowlist validation preferred over denylist, and where does validation belong?

**Allowlist** = define exactly what's *permitted* and reject everything else. **Denylist** = enumerate what's *forbidden* and allow everything else. Allowlist wins because **the set of bad inputs is infinite and evolving, but the set of good inputs is usually small and knowable.**

Example — validating a username:

```javascript
// Denylist — leaky: attacker uses an encoding/char you didn't think of
if (username.includes("'") || username.includes(";") || username.includes("--")) reject();

// Allowlist — tight: only these chars, this length, full-string anchored
if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) reject();
```

The denylist forgets Unicode homoglyphs, null bytes, alternate encodings, and next year's payload. The allowlist rejects them all by construction.

**Where validation belongs**: at **trust boundaries** — the moment untrusted data enters a more-trusted zone (HTTP request → app, message → consumer, file upload → processor). Validate *type, length, format, and range*. Crucially, validation is **defense in depth, not the primary fix** for injection/XSS — you still parameterise queries and encode output, because validation's job is "reject obviously-wrong input early," not "make dangerous sinks safe." Validate on the **server** always; client-side validation is UX, trivially bypassed. And validate for *business* correctness too (a quantity can't be negative), which catches logic abuse that character filters never would.

### Q5. What is output encoding, and why does context matter?

**Output encoding** transforms data so that when it's placed into a specific output context, it's interpreted as *data*, never as *code*. It's the primary defence against XSS, and the key insight is that **the correct encoding depends entirely on where the data lands** — the same value is safe in one context and an exploit in another.

```
User-supplied value: </script><script>steal()</script>

In HTML body   → HTML-entity encode:  &lt;/script&gt;...   (renders as text)
In an attribute → attribute encode + quote
In JavaScript  → JS-string / JSON encode
In a URL param → URL/percent encode
In CSS         → CSS encode
```

Get the context wrong and you're still vulnerable — HTML-encoding a value that gets inserted into a `<script>` block doesn't help, because the JS parser has different metacharacters.

Practical guidance:
- **Use the framework's context-aware auto-escaping** (React JSX, Angular, modern template engines) and *don't defeat it* — `dangerouslySetInnerHTML`, `v-html`, `bypassSecurityTrust*` reintroduce the risk.
- **Encode at the point of output**, not on input — because you don't know the output context at input time, and the same stored value may be rendered in multiple contexts.
- For rich-text you must render as HTML, **sanitise** with a vetted library (DOMPurify) rather than hand-rolling.
- Layer with **CSP** (Q9) so that even an encoding miss doesn't automatically execute injected script.

This is the "never mix data and code across a boundary" principle again — encoding is how you keep user data on the *data* side of the HTML/JS boundary.

### Q6. "Parameterise everything" — what does that mean beyond SQL?

The deep principle behind parameterised queries is **separate code from data**: send the *structure* of a command through a trusted channel and the *user data* through a separate channel that can never be reinterpreted as structure. That principle generalises far past SQL.

```python
# SQL — vulnerable vs parameterised
cursor.execute("SELECT * FROM users WHERE name = '" + name + "'")   # injection
cursor.execute("SELECT * FROM users WHERE name = %s", (name,))       # data stays data
```

The same move applies to every place you'd otherwise build a command by string concatenation:
- **OS commands** — don't build a shell string; pass an **argument array** to `execFile`/`subprocess.run([...])` with `shell=False`, so user input can't inject shell metacharacters.
- **LDAP / XPath / NoSQL** — use the driver's parameter binding / query-builder rather than concatenating filters.
- **HTML templating** — auto-escaping template engines *parameterise* the HTML: static template = code, interpolated values = data (Q5).
- **Log messages** — structured logging with fields, not string interpolation, avoids log injection/forging.

Whenever you catch yourself building a string that mixes a fixed command with variable user input, that's the smell. The fix is almost always "find the API that takes the data as a separate, typed parameter." If no parameterised API exists, then and only then fall back to strict allowlist validation plus context-appropriate escaping — but treat that as a last resort, not the default.

### Q7. What is complete mediation, and how is it violated in real apps?

**Complete mediation** means *every* access to a protected resource is checked for authorisation, *every* time — you never cache an "allowed" decision and then skip the check on subsequent or alternate paths.

The most common violation is **broken object-level authorisation (IDOR/BOLA)** — the app checks you're *logged in* but not that *this* object is yours:

```javascript
// Violation: authenticated, but no per-object ownership check
app.get('/api/invoices/:id', requireLogin, (req, res) => {
  res.json(db.invoices.find(req.params.id)); // any logged-in user reads any invoice
});

// Complete mediation: check ownership on THIS access
app.get('/api/invoices/:id', requireLogin, (req, res) => {
  const inv = db.invoices.find(req.params.id);
  if (!inv || inv.ownerId !== req.user.id) return res.sendStatus(404);
  res.json(inv);
});
```

Other violations:
- **Checking at the UI but not the API** — hiding a button isn't a control; the endpoint must enforce it. (Trusting the client.)
- **Checking on the "front door" route but not an alternate route** — a GraphQL resolver, a batch endpoint, or an admin API that reaches the same data without the guard.
- **Time-of-check/time-of-use gaps** — permission verified, then the operation runs later under changed conditions.

The design fix is to **enforce authorisation centrally and unavoidably** — a middleware/policy layer every request funnels through, ideally checking ownership as part of the data query itself (`WHERE owner_id = :currentUser`) so there's no path that skips it. If authz is scattered per-handler, someone eventually forgets one.

### Q8. Why are secure defaults important, and what does an insecure default look like?

**Secure defaults** = the out-of-the-box, do-nothing-special configuration is already the safe one. It matters because *defaults are what actually ships* — most systems run on them, most developers don't change them, and "you have to remember to turn on security" means security is off in production. This is the design fix for the entire OWASP "Security Misconfiguration" category.

Insecure defaults you'll recognise:
- Databases/caches (older Redis, Mongo, Elasticsearch) that historically **bound to all interfaces with no auth** — plug it in and it's exposed to the internet.
- Cloud storage buckets or admin consoles that default to **public** or ship with **default credentials** (`admin/admin`).
- Frameworks with **debug mode / verbose stack traces / directory listing** on by default.
- Permissive **CORS** (`Access-Control-Allow-Origin: *`) or cookies without `Secure`/`HttpOnly`/`SameSite`.
- New user accounts created with broad permissions rather than none.

The design principle in practice:
- **Deny by default** — access, network, and features start *off*; you opt *into* exposure explicitly.
- **New objects inherit the safe state** — a new S3 bucket is private; a new user has no roles; a new endpoint requires auth.
- **Make the risky option loud** — turning something insecure on should be an explicit, reviewable, greppable action, not an omission.

The senior framing: you can't rely on every developer configuring everything correctly, so bake the safe choice into the platform/paved road. Least astonishment applies — the obvious, do-nothing path should also be the secure one.

### Q9. Walk through the key HTTP security headers and what each defends against.

Security headers are browser-enforced defense-in-depth layers — cheap to add, and they backstop application bugs. The important ones:

| Header | Defends against | What it does |
|---|---|---|
| **Content-Security-Policy (CSP)** | XSS, data injection | Allowlists where scripts/styles/etc. may load from; blocks inline script by default. A well-tuned CSP turns "XSS bug" into "XSS bug that can't execute." |
| **Strict-Transport-Security (HSTS)** | SSL-strip / downgrade, MITM | Forces HTTPS for a max-age; browser refuses plaintext to your domain even if a user types `http://`. |
| **X-Frame-Options / CSP frame-ancestors** | Clickjacking | Stops your pages being iframed by attacker sites. `frame-ancestors` is the modern CSP form. |
| **X-Content-Type-Options: nosniff** | MIME-sniffing attacks | Browser honours the declared Content-Type instead of guessing (which could turn an upload into executable script). |
| **Referrer-Policy** | Info leak | Limits how much of your URL (which may contain tokens/IDs) leaks to other sites. |
| **Set-Cookie flags** (Secure/HttpOnly/SameSite) | Session theft, CSRF | `HttpOnly` hides the cookie from JS (XSS can't steal it), `Secure` restricts to HTTPS, `SameSite` blocks cross-site sends (CSRF). |

Two points that earn senior marks:
- **These are backstops, not fixes.** CSP is a second line for XSS *behind* output encoding; HSTS supplements — doesn't replace — proper TLS. Defense in depth again.
- **CSP is the highest-value and hardest to deploy** — start in `report-only` mode, collect violations, tighten iteratively, and avoid `unsafe-inline`/`unsafe-eval` which gut its protection.

### Q10. What is separation of duties, and how does it apply in software systems?

**Separation of duties (SoD)** splits a sensitive action so that no single person — or single compromised account — can complete it alone. It's an anti-fraud and anti-single-point-of-compromise control: collusion (or compromising *two* independent identities) becomes necessary to do damage.

In organisations it's classic finance control — the person who *requests* a payment can't be the person who *approves* it. In software systems it shows up as:
- **Production deploys require review** — the author of a change can't merge/deploy it unilaterally; a second engineer approves (this is also why "the author can approve their own PR" is a red flag).
- **Break-glass / dual control for sensitive ops** — deleting production data, rotating root keys, or accessing customer PII requires two approvers or a co-signed action. KMS and CI/CD systems support required multi-party approval.
- **Splitting powerful roles** — the person who can *write* code isn't automatically the person who can *sign* release artifacts; the person who manages IAM isn't the person who audits it.
- **Segregating environments and duties** — devs don't have standing prod access; SRE grants time-boxed elevation.

The security payoff via least-privilege lens: even if an attacker fully compromises one engineer's account, they can't push malicious code to production alone, because a second independent approval is required. It converts "compromise one credential → game over" into "compromise two independent credentials," which is dramatically harder. The cost is friction, so apply it to genuinely high-impact actions, not everything.

### Q11. Why should secrets never live in code, and how do you manage them instead?

A secret (API key, DB password, private key, token) hardcoded in source is a secret you've *published* — to everyone with repo access, every fork, every CI cache, and, once committed, **forever in git history** even after you delete it. Leaked secrets in public repos are one of the most reliably exploited vulnerabilities; bots scan GitHub for them within seconds of a push.

```javascript
const db = connect({ password: "S3cr3t!" });          // in git history forever
const db = connect({ password: process.env.DB_PASS }); // injected at runtime
```

Better practices, in order of maturity:
- **Environment variables / injected config** — keep secrets out of the artifact; supply at runtime. Baseline, but env vars can leak via logs, error dumps, and child processes.
- **A dedicated secrets manager** — HashiCorp Vault, AWS/GCP/Azure secret managers. Centralised, access-controlled, audited, and supports **rotation** and short-lived/dynamic credentials (Vault can mint a DB credential that expires in an hour).
- **Cloud workload identity** — best of all where available: the workload authenticates *as itself* (IAM role, OIDC) and gets short-lived tokens with no long-lived secret to leak.

Supporting controls: **secret scanning in CI and pre-commit** (block the push before it lands), **rotation** on a schedule and immediately on suspected leak, and **least privilege** on each secret so a leak is contained. And critically — if a secret ever hits a repo, **rotate it**; scrubbing history is necessary but the secret must be assumed compromised the moment it was committed.

### Q12. When and how do you apply rate limiting and throttling as a security control?

Rate limiting caps how often an action can be performed per identity/IP/token in a time window. It's a defense-in-depth control against *abuse of otherwise-legitimate endpoints* — the attacks that don't exploit a bug but exploit *volume*.

Where it's essential:
- **Authentication** — throttle login attempts to blunt **credential stuffing and brute force**; pair with account lockout/backoff and breached-password checks. Rate-limit password-reset and MFA endpoints too (or attackers brute-force OTPs).
- **Expensive / scraping-prone endpoints** — search, export, report generation, and anything that fans out to third parties.
- **Account creation / messaging** — throttle to limit spam, fake accounts, and enumeration.
- **API tiers** — quotas per API key both for fairness and to contain a compromised key's blast radius.

Design considerations:
- **Key it correctly** — per-user for authenticated calls, per-IP for anonymous (but beware shared NATs/proxies and IPv6). Layer both.
- **Algorithm** — token bucket / sliding window; return **HTTP 429** with `Retry-After`.
- **Fail closed under doubt** for sensitive actions, but don't let the limiter itself become a DoS lever (e.g. an attacker locking out a victim by hammering *their* username — prefer slowdowns/CAPTCHA over hard lockout keyed on victim-controlled input).
- It's a **layer, not a fix** — it reduces the *rate* of attack, buying time and raising cost, but doesn't fix a weak password policy or an injectable endpoint. Combine with the real fixes.

### Q13. What is the principle of least astonishment applied to security, and why does it matter?

**Least astonishment** says a system should behave the way its users and developers *expect*. Applied to security: **the secure behaviour should also be the obvious, unsurprising one** — because surprising security semantics get misused, misconfigured, or bypassed, usually by well-meaning people.

Where astonishment causes vulnerabilities:
- **Confusing API defaults** — a function called `escape()` that only escapes *some* contexts, or a "sanitise" option that's off by default, invites misuse. Developers assume the safe thing is happening when it isn't.
- **Subtle, order-dependent config** — security that depends on remembering to call things in the right order, or on a non-obvious flag, will be gotten wrong.
- **Ambiguous permission models** — if it's not obvious what a role can do, admins over-grant "to be safe," violating least privilege.
- **Silent failure** — a validation or signature check that fails *quietly* and continues is astonishing in the worst way; fail loudly and closed.

The design consequences:
- **Make the secure path the easy, default, obvious path** (ties to secure defaults, Q8) — so the natural way to use your API is also the safe way.
- **Name things honestly** — `renderTrustedHtml` warns; `render` that silently allows script astonishes.
- **Keep security-critical mechanisms simple** (economy of mechanism) — complexity *is* astonishment; the fewer surprising interactions, the fewer places bugs hide.

The senior insight: humans are part of the system. A control that's technically correct but easy to misunderstand will be misused into a vulnerability. Designing for *comprehensibility* is designing for security.

### Q14. Spot the security design flaws: a service that validates input, then trusts it everywhere downstream.

The flaw is **validating once at the edge and treating data as "clean" forever after** — a single-layer model masquerading as security. Consider:

```
[Client] → [API gateway: validates input] → [Service A] → [Service B] → [DB]
                                                trusts A      trusts B
```

Problems:
1. **No defense in depth.** If the edge validation has a gap, or a *new* path reaches Service B that doesn't go through the gateway (internal caller, message queue, batch job), the "trusted" data is now attacker-controlled with no further checks. Validation at one boundary doesn't make a value safe at a *different* boundary.
2. **Validation ≠ safe sink.** Even perfectly validated data must still be **parameterised** at the DB and **encoded** at the HTML output — because "valid" (right type/length) isn't the same as "safe to concatenate into SQL/HTML." A valid name can still contain a quote.
3. **Trust boundaries between services ignored.** Service B trusting Service A assumes A is uncompromised and always calls correctly. In a zero-trust design, B validates its own inputs and authenticates A.

The fix, in principle:
- **Validate at every trust boundary**, not just the outer edge — each service validates its own inputs.
- **Apply the sink-specific defence at each sink** — parameterise at the DB, encode at the view — regardless of upstream validation.
- **Authenticate service-to-service calls** (mTLS / signed tokens) so "internal" doesn't mean "trusted."

The lesson: data doesn't have a permanent "clean" attribute. Safety is a property of *how you use it at each boundary*, so controls must be re-applied at each layer.

### Q15. How do you layer controls so that a single failure isn't catastrophic? Design it for a login flow.

Take a login endpoint and stack *independent* layers so no single failure yields account takeover:

```
                    LOGIN REQUEST
                         │
 [1 Transport ] TLS + HSTS ......... stops MITM/credential sniffing
                         │
 [2 Edge      ] Rate limit + bot/CAPTCHA on repeated failures
                         │           ... blunts credential stuffing/brute force
 [3 Input     ] Validate shape of username/password (allowlist)
                         │
 [4 AuthN     ] Verify password vs Argon2/bcrypt hash (salted)
                         │           ... DB leak ≠ plaintext passwords
 [5 Breach    ] Check password against known-breached list; block reuse
                         │
 [6 MFA       ] Second factor (TOTP/WebAuthn) — password alone insufficient
                         │           ... stolen password ≠ access
 [7 Session   ] Issue new session id (anti-fixation), HttpOnly+Secure+SameSite cookie
                         │
 [8 Monitor   ] Log + alert on anomalies (new geo/device, spray patterns)
                         │
                    AUTHENTICATED
```

Now trace failures:
- Password DB leaks? Layer 4 (hashing) means attackers still can't log in easily; layer 6 (MFA) blocks them even with the plaintext.
- Password guessed/stuffed? Layer 2 slows it, layer 5 blocks known-breached ones, layer 6 stops the ones that get through.
- Network tapped? Layer 1 prevents sniffing.
- Session token stolen via XSS? Layer 7's `HttpOnly` keeps JS away from it.
- All controls imperfect? Layer 8 detects the attempt so you respond.

Each layer is a *different kind* of control and covers a different failure mode. No single miss is fatal — that's defense in depth as a design output, not a slogan. The senior move is to narrate exactly this "what breaks if layer N fails" walkthrough.

### Q16. How do you decide how much security is "enough" — reasoning about security tradeoffs?

Security is never free — every control costs latency, developer friction, complexity, or money — so "maximum security" is the wrong goal. The right frame is **risk-based**: match the strength of controls to the value of what you're protecting and the credible threats against it.

The reasoning I'd voice:
1. **Risk = likelihood × impact.** Rank what you're protecting by impact (a payment/PII endpoint vs a public marketing page) and by how attractive/exposed it is. Spend your control budget where risk is highest.
2. **Identify the threat model.** Defending against opportunistic bots is different from defending against a determined, funded adversary. Don't buy nation-state defences for a low-value internal tool — but *do* for the crown jewels.
3. **Prefer controls that eliminate whole classes cheaply.** Parameterised queries, memory-safe languages, secure-by-default frameworks, and not-collecting-data (minimisation) remove risk at near-zero ongoing cost — always worth it. These beat expensive detective controls bolted on later.
4. **Diminishing returns and usability cost.** Past a point, extra controls add friction that pushes users/devs to work *around* security (shadow IT, disabled MFA, copy-pasted secrets), making you *less* safe. Least astonishment and paved roads keep the secure path cheap.
5. **Defense in depth is the hedge for uncertainty** — because you *can't* perfectly predict which control fails, layer a few independent ones rather than over-investing in a single "perfect" one.

The senior signal is refusing the false binary of "secure vs insecure" and instead reasoning out loud about *proportionality*: what's the asset, who's the adversary, what's the cheapest control that meaningfully reduces the risk, and what does it cost the humans who have to live with it.

## Security Scenario & Interview Playbooks

### Summary

**What this topic covers**

This is the *applied* topic — no new concepts, just the reusable playbooks for the open-ended questions that dominate senior security interviews: "threat-model this feature," "how would you secure X," "here's some code, find the bug," "design secure authentication," "we've been breached — what do you do," and "run a security design review." Everything in the rest of the primer (crypto, authN/authZ, injection, XSS, OWASP, defense in depth) is *inventory*; this topic is the *method* for deploying it under interview pressure. The 15 questions give you repeatable frameworks — a STRIDE-based threat-modeling script, a layered "how to secure any system" checklist, a spot-the-vuln reading method, an end-to-end secure-auth design, an incident-response walkthrough, and a design-review rubric — plus the meta-skill of *reasoning about security tradeoffs out loud*. The goal: when handed a vague prompt, you produce a *structured*, prioritised, tradeoff-aware answer instead of an unordered pile of buzzwords.

**Mental model**

Security interviews reward *structure over trivia*. A junior answer to "secure this API" is a scattershot list ("use HTTPS, validate input, uh, JWTs"). A senior answer is a *repeatable method*: identify the assets and trust boundaries, enumerate threats systematically (STRIDE), map each to a control, layer the controls (defense in depth), and state the tradeoffs and priorities out loud. So the core mental move is **always start with a framework, then instantiate it for the specific prompt.** Two frameworks carry most of the load: **STRIDE** for threat-modeling anything (Spoofing, Tampering, Repudiation, Information disclosure, Denial of service, Elevation of privilege — a checklist that guarantees you consider each attack category), and **the CIA-triad + defense-in-depth layering** for "how would you secure X." The second mental move is **think like an attacker, design like a defender**: before proposing controls, spend ten seconds asking "how would I break this?" — the attack surface reveals which controls matter. And always **prioritise and justify** — interviewers want to see you distinguish the critical control from the nice-to-have.

**Key terms**

- **STRIDE** — Microsoft's threat taxonomy: Spoofing, Tampering, Repudiation, Information disclosure, Denial of service, Elevation of privilege. Maps 1:1 to defensive controls.
- **DFD (data-flow diagram)** — boxes (processes/stores), arrows (data flows), and **trust boundaries**; the artifact you threat-model over.
- **Trust boundary** — where data crosses between zones of differing trust; where the interesting threats and controls live.
- **Attack surface** — the sum of points where an attacker can interact with the system; you reduce it and defend what remains.
- **Attack tree** — goal at the root, attacker steps as branches; a way to reason about paths to a specific compromise.
- **Abuse case** — the inverse of a use case: how a malicious actor misuses the feature. Written alongside requirements.
- **Incident-response lifecycle** — Prepare → Detect → Contain → Eradicate → Recover → Lessons-learned.
- **Blast radius** — how much an attacker can reach once they compromise one component; least privilege shrinks it.
- **Spot-the-vuln** — the code-reading drill: trace untrusted input to a dangerous sink and check the boundary defences.
- **Security design review** — structured evaluation of a design against threats and secure-design principles before it ships.
- **Tradeoff reasoning** — proportioning controls to risk (likelihood × impact) and cost, out loud.
- **Security mindset** — the habit of asking "how would this be abused?" of every feature.

**Why interviewers ask this**

Scenario questions are the highest-signal part of a security interview because they can't be crammed. Anyone can memorise "SQL injection uses parameterised queries"; only someone who *thinks* in security can be handed "here's a file-upload feature, threat-model it" and produce a structured, prioritised analysis on the spot. Interviewers are watching for: (1) **method** — do you have a framework, or do you free-associate? (2) **coverage** — does STRIDE/your checklist make you consider spoofing *and* elevation of privilege, not just the one vuln you know best? (3) **prioritisation** — do you lead with the critical control and flag the rest, or treat everything as equally important? (4) **tradeoff awareness** — do you acknowledge cost, usability, and "how much is enough," or reach for maximum-security-everything? (5) **communication** — can you reason out loud, ask clarifying questions, and adjust? These are exactly the skills of a real security engineer, which is why the scenario is the interview.

**Common confusions**

- "Threat modeling is a document" — it's a *thinking method*; the artifact is a byproduct. In an interview it's a live conversation, not a deliverable.
- "List every possible control" — un-prioritised completeness reads as *junior*. Lead with what matters most for *this* system and say why.
- "Spot-the-vuln means eyeball for scary functions" — better: trace *untrusted input → dangerous sink* and check what happens at each trust boundary.
- "Secure design = add security features" — often it's *removing* attack surface, tightening defaults, and applying least privilege, not bolting on more.
- "Respond to a breach = find and fix the bug" — first **contain** to stop the bleeding; premature eradication can tip off the attacker or destroy forensic evidence. Order matters.
- "There's one right answer" — interviewers want your *reasoning and tradeoffs*, not a memorised checklist recited back.

**What follows from this topic**

This topic is where the whole primer converges: threat-modeling pulls in STRIDE and trust boundaries; "secure this API" pulls in authN/authZ, injection, rate limiting, and OWASP; secure-auth design pulls in password hashing, MFA, sessions/JWTs; breach response pulls in incident-response, logging, and disclosure/compliance. Treat the other topics as the *content* and this one as the *delivery* — the practised ability to structure that content into a confident, prioritised, tradeoff-aware answer under interview pressure.

### Q1. Threat-model a file-upload feature using STRIDE.

**First, clarify and draw the flow.** "A user uploads a profile picture; it's stored and later served to other users." Trust boundary: untrusted file crossing from the internet into our storage and then back out to other users' browsers.

Now walk **STRIDE**, mapping each threat to a control:

- **S — Spoofing**: is the uploader who they claim? → Require authentication; tie the upload to the session identity.
- **T — Tampering**: malicious file content — a polyglot that's a valid image *and* executable/HTML; a file that overwrites another user's. → Validate content by magic bytes not just extension; store under a server-generated random name (never the user's filename → path traversal); re-encode/normalise images to strip embedded payloads.
- **R — Repudiation**: user denies uploading something abusive. → Log uploads with who/when/hash.
- **I — Information disclosure**: predictable URLs let others enumerate private uploads; EXIF metadata leaks GPS. → Random unguessable object keys + authz on retrieval; strip metadata.
- **D — Denial of service**: huge files or zip-bombs exhaust disk/CPU. → Enforce size limits *before* reading fully, restrict dimensions, rate-limit, offload to object storage.
- **E — Elevation of privilege**: upload lands in a web-servable dir and gets executed (`.php`/`.jsp`), or the image parser has a memory-safety CVE. → **Serve uploads from a separate domain/bucket with no execution**, `Content-Disposition: attachment` / `Content-Type` locked, run parsing in a sandboxed/patched service.

Then **layer and prioritise**: the two must-haves are *don't trust the filename/type* and *serve from a non-executing, separate origin* — those kill the highest-impact (RCE/stored-XSS) paths. STRIDE guarantees I didn't tunnel-vision on "is it really a JPEG" and forget DoS or IDOR. That structured sweep — clarify, diagram, STRIDE, map controls, prioritise — is the whole point.

### Q2. How would you secure a public REST API?

I'd answer in layers, leading with the highest-impact controls, and I'd note this overlaps the API-Design primer's API-security topic — here's the AppSec framing:

- **Transport** — TLS everywhere + HSTS; no plaintext. Non-negotiable baseline.
- **Authentication** — every non-public endpoint authenticates (OAuth2/OIDC bearer tokens or API keys). Short-lived tokens, validated signature *and* claims (issuer, audience, expiry).
- **Authorization (the #1 risk)** — enforce **object-level** authz on every request (`WHERE owner_id = :caller`), server-side, always. This is where APIs bleed (BOLA/IDOR) — a logged-in user must not reach another's objects. Complete mediation, no UI-only checks.
- **Input handling** — validate shape at the boundary (allowlist), **parameterise** all queries, encode output. Reject oversized/malformed payloads.
- **Rate limiting & quotas** — per key/user, to blunt brute force, scraping, and DoS; return 429.
- **Reduce surface** — no verbose errors/stack traces, disable unused methods/endpoints, tight CORS (specific origins, not `*`), no sensitive data in URLs (they hit logs).
- **Monitoring** — log auth failures and anomalies; alert on abuse.

Then I'd **prioritise out loud**: for an API, broken authorization and injection are the top real-world killers, so I'd make sure object-level authz and parameterised queries are rock-solid before polishing headers. And I'd apply **defense in depth** — TLS + authN + authZ + validation + rate limiting are independent layers, so one gap isn't fatal. Finally I'd ask about the data sensitivity to right-size effort (a payments API earns far more than a public read-only catalog).

### Q3. Here's a login endpoint — spot the vulnerabilities and fix them.

```javascript
app.post('/login', (req, res) => {
  const { user, pass } = req.body;
  const q = `SELECT * FROM users WHERE name='${user}' AND password='${pass}'`;
  const row = db.query(q);
  if (row) {
    res.cookie('session', user);           // identity in a plain cookie
    res.json({ ok: true });
  } else {
    res.status(401).json({ error: `no user named ${user}` });
  }
});
```

My method: trace untrusted input (`user`, `pass`) to each sink. Findings:

1. **SQL injection** — user/pass concatenated into the query. `' OR '1'='1' --` bypasses auth entirely. → **Parameterise**: `db.query('SELECT ... WHERE name=$1', [user])`.
2. **Plaintext passwords** — comparing `password='...'` means passwords are stored in plaintext. → Store **Argon2/bcrypt** salted hashes; fetch by username, then `verify(hash, pass)`.
3. **Forgeable session** — the cookie *is* the username, so a client sets `session=admin` and they're admin. → Issue a **random, server-side session id** (or a signed token); never trust client-set identity.
4. **Missing cookie flags** — no `HttpOnly`/`Secure`/`SameSite`. → Add all three so XSS can't read it and it's HTTPS/CSRF-hardened.
5. **User enumeration** — the error reveals whether the username exists. → Return a **generic** "invalid credentials"; use constant-time comparison to avoid timing leaks.
6. **No rate limiting** — unlimited guesses. → Throttle + backoff/lockout; consider breached-password checks and MFA.

Fixed shape: parameterised lookup by username → verify hashed password (constant-time) → issue random session id → set `HttpOnly; Secure; SameSite` cookie → generic errors → rate-limited. The *skill* being tested is the systematic trace (input → sink, then check each boundary), not spotting one bug.

### Q4. Design secure authentication end-to-end.

I'd walk the whole lifecycle, control by control:

**Registration**
- Password policy per **NIST 800-63**: enforce *length* (min ~8–12), allow long passphrases, screen against **breached-password lists**, drop forced periodic rotation and silly composition rules (they backfire).
- Store with **Argon2id** (or bcrypt/scrypt), unique per-user **salt**, tuned work factor; optionally a **pepper** in a secret store. Never plain/SHA hashes.

**Login**
- Parameterised lookup, constant-time verify, **generic errors** (no enumeration), **rate limiting** + backoff, and **MFA** (TOTP or, better, **WebAuthn/passkeys** which are phishing-resistant).

**Session management**
- On success, issue a **new random session id** (rotate to prevent fixation). Store server-side (or a signed, short-lived token). Cookie flags: `HttpOnly` + `Secure` + `SameSite=Lax/Strict`.
- Idle + absolute **timeouts**; allow logout/"revoke all sessions."

**Account recovery** (the favourite bypass)
- Reset via a **single-use, short-expiry, random token** emailed out; rate-limit; don't reveal whether the account exists; invalidate existing sessions on password change. Recovery must be *as strong* as login, or it becomes the weak link.

**Cross-cutting**
- Log auth events, alert on anomalies (impossible travel, spray). Consider SSO/OIDC to centralise. Prefer **passkeys** long-term to kill phishing and password reuse entirely.

The framing I'd voice: authentication is a *system*, and attackers hit the weakest part — usually recovery, session handling, or the lack of MFA — not the password hash. So I secure the whole chain, not just the login form.

### Q5. Walk me through how you'd respond to a suspected breach.

I'd follow the **incident-response lifecycle** and stress that *order matters*:

1. **Prepare** (before anything) — this is done in peacetime: an IR plan, defined roles/on-call, runbooks, good logging, and practised drills. If you're improvising the process during the incident, you've already lost time.
2. **Detect & analyse** — confirm it's real (not a false positive), determine scope: what systems, what data, entry vector, is it ongoing? Preserve evidence and timeline. Don't tip your hand yet.
3. **Contain** — *stop the bleeding first*, before eradicating. Short-term: isolate affected hosts, revoke compromised credentials/tokens, block the attacker's access — **without** destroying forensic evidence and, ideally, without alerting them prematurely. Contain before you clean, or the attacker adapts.
4. **Eradicate** — remove the root cause: patch the exploited vuln, remove malware/backdoors, close the misconfiguration, rotate *all* potentially exposed secrets.
5. **Recover** — restore from known-good backups, rebuild rather than trust compromised hosts, monitor closely for re-entry, then return to normal operations deliberately.
6. **Lessons learned** — a **blameless** post-mortem: timeline, what worked, what didn't, and concrete fixes so it can't recur.

Cross-cutting, in parallel: **notify the right people** — legal/compliance early, because **breach-notification clocks** (GDPR's 72 hours, PCI, state laws) start ticking, and PR/customers per policy. The senior signals here: containment *before* eradication, preserving evidence, rotating secrets broadly, and treating notification as a legal obligation with a deadline, not an afterthought. Ties directly to the Privacy/Compliance topic's breach rules.

### Q6. How would you secure a misconfigured public S3 bucket (or any cloud storage)?

First, **triage the exposure**, then fix root cause, then prevent recurrence:

1. **Contain** — if it holds sensitive data and is world-readable, lock it down *now*: remove public ACLs/policy, enable "block public access" at the account and bucket level. Then assess what may already have been accessed (access logs) — an exposed bucket may be a *breach*, triggering the IR/notification process (Q5).
2. **Root-cause the access** — replace "public" with **least-privilege IAM**: only the specific principals/roles that need it, scoped to the specific prefixes/actions. If it must serve content publicly (e.g. static assets), front it with a CDN and keep the bucket itself private (origin access identity).
3. **Encrypt** — enable server-side encryption at rest (KMS), enforce TLS in transit via bucket policy (`aws:SecureTransport`).
4. **Prevent recurrence** — this is the real fix:
   - **Secure defaults**: org-level "block public access" so buckets *can't* be made public by default; new buckets are private.
   - **IaC scanning** in CI (checkov/tfsec) to catch a public bucket *before* deploy.
   - **CSPM** to continuously detect drift and misconfig across the account.
   - **Least-privilege on who can even change bucket policy** (separation of duties).

The framing: a public bucket is the poster child for **Security Misconfiguration** (OWASP) and the **shared responsibility model** — the cloud secures the infrastructure, *you* secure the configuration. So I don't just close this one bucket; I make "public" impossible-by-default and add automated detection, because there will be a next bucket.

### Q7. How would you secure a CI/CD pipeline and the software supply chain?

CI/CD is a high-value target — it has credentials to prod and it *builds the artifacts users run*, so compromising it (SolarWinds-style) poisons everything downstream. Layered defence:

**Protect the pipeline itself**
- **Least privilege** for pipeline credentials; prefer short-lived **OIDC workload identity** over long-lived stored secrets. Scope deploy creds tightly.
- **Secrets** in a manager/CI secret store, never in the repo or logs; secret-scanning gate on every push.
- **Separation of duties**: require PR review before merge/deploy; the author can't unilaterally ship (protects against both mistakes and a compromised account).
- Harden runners (ephemeral, isolated), and be careful with untrusted PRs running with secrets.

**Protect the supply chain (what you build with)**
- **Pin dependencies** with lockfiles + integrity hashes; use **SCA/dependency scanning** to flag known CVEs. Beware **typosquatting / dependency confusion** (internal package names resolving to a public malicious one → use scoped registries and pin the source).
- **Generate an SBOM** so you know what's in your artifacts (crucial when the next Log4Shell drops).
- **Sign artifacts** (Sigstore/cosign) and verify signatures before deploy; adopt **SLSA** provenance so you can prove *how* an artifact was built.

**Gate quality in the pipeline**
- SAST, SCA, secret scanning, and IaC scanning as CI gates — shift left, fail the build on high-severity findings.

The framing: the pipeline is both an *asset to protect* (least privilege, SoD, secrets) and a *control point* (where you enforce scanning and signing). Attackers increasingly target build systems because it's the highest-leverage way in — so provenance and integrity (signing, SLSA, pinning) matter as much as scanning.

### Q8. Run a security design review on a proposed feature — what's your process?

A design review is threat-modeling plus a secure-design-principles checklist, done *before* code ships. My process:

1. **Understand the design** — get the data-flow: components, data stores, external integrations, and especially the **trust boundaries**. Draw the DFD if there isn't one.
2. **Identify the assets & data sensitivity** — what's worth protecting here (PII? money? credentials?)? This sets how much rigor is warranted (tradeoff reasoning).
3. **Enumerate threats with STRIDE** across each trust boundary — systematically, so I cover spoofing through elevation-of-privilege, not just my favourite vuln.
4. **Check against secure-design principles** — is authz enforced server-side and per-object (complete mediation)? Least privilege on every credential/role? Fail-closed on errors? Secure defaults? Secrets out of code? Input validated at boundaries, output encoded, queries parameterised? Sensitive data encrypted and minimised?
5. **Review authN/authZ, crypto, and third-party dependencies** specifically — these are the usual weak spots.
6. **Map findings to controls, then prioritise** by risk (likelihood × impact) — flag the must-fix-before-ship items vs the nice-to-haves, and note tradeoffs.
7. **Write abuse cases** and, ideally, feed them to the test suite.

I'd deliver it as a prioritised list with rationale, not a flat dump. The mindset I'd bring: *think like an attacker* ("how would I abuse this?") while checking *like an auditor* (against the principle checklist). And I'd right-size — a review of an internal reporting tool is lighter than a payment flow. The value of doing it at *design* time is that fixing a security flaw on a whiteboard costs orders of magnitude less than fixing it in production (shift left).

### Q9. Threat-model a payment flow.

**Clarify the flow**: user enters card → our frontend → payment processor → confirmation → our backend records the order. Assets: card data (highest sensitivity), money, order integrity.

**First design decision that changes everything**: **don't let the PAN touch our servers** — use the processor's hosted fields/iframe so we only ever handle a **token**. This slashes PCI scope and removes the biggest asset from our trust boundary. That single move is the headline.

Now **STRIDE**:
- **S — Spoofing**: attacker impersonates the user or a fake payment page. → Strong authN, TLS + HSTS, verify processor webhooks via signatures.
- **T — Tampering**: client tampers with the *amount* ("pay $0.01"). → **Never trust client-supplied price/amount** — compute the charge server-side from server-side data; verify the processor's reported amount matches. Idempotency keys to prevent double-charge/replay.
- **R — Repudiation**: "I never authorised this." → Immutable audit log of transactions; rely on processor's signed records.
- **I — Information disclosure**: card/PII leakage. → Tokenise (no PAN stored), never log card data/CVV, encrypt PII, TLS in transit.
- **D — Denial of service / abuse**: carding attacks (testing stolen cards), payment brute force. → Rate limit, velocity checks, CAPTCHA, fraud signals.
- **E — Elevation of privilege**: manipulate order/authz to get goods without paying, or replay a webhook to mark unpaid orders paid. → Verify webhook signatures + idempotency; enforce server-side that fulfilment only follows a *verified* processor confirmation.

**Prioritise**: (1) tokenise so card data never lands here, (2) server-authoritative amounts + verified webhooks (the classic business-logic bugs), (3) fraud/rate limiting. Ties to PCI-DSS (Privacy/Compliance topic).

### Q10. What is the "security mindset," and how do you demonstrate it in an interview?

The **security mindset** is the reflex to ask, of *every* feature, "how could this be abused?" — to see the system the way an attacker does: not "what's it supposed to do," but "what *else* can I make it do." It's the difference between a developer who builds the happy path and an engineer who instinctively probes the edges and failure modes.

Concretely, thinking like an attacker means asking:
- What untrusted input reaches this, and what's the worst thing I can put there?
- What happens at the *boundaries* — errors, timeouts, huge inputs, concurrent requests, out-of-order steps?
- What does the client control that the server *trusts* but shouldn't (price, user id, role, redirect URL)?
- If I compromise *this* component, what else can I reach (blast radius)?
- What's the *unintended* path to the goal — the alternate endpoint, the recovery flow, the race condition?

How to demonstrate it: when given any scenario, *voice* this probing before jumping to controls. Say "let me think about how I'd attack this first" — enumerate the abuse cases, *then* map defences. Ask clarifying questions (trust boundaries, data sensitivity, threat actors). Reason out loud and prioritise. Crucially, always pair attack with defence — you're demonstrating you understand offense *in order to* defend, which is exactly the defensive framing this whole discipline is about. Interviewers hire the mindset because it generalises to threats you've never seen; memorised vuln lists don't.

### Q11. Spot the vulnerability: this endpoint fetches a URL supplied by the user.

```python
@app.route('/fetch')
def fetch():
    url = request.args.get('url')
    return requests.get(url).text   # fetches whatever URL the user gives
```

This is **SSRF (Server-Side Request Forgery)**. The server makes a request to a user-controlled URL, so an attacker points it at *internal* resources the server can reach but they can't:
- `http://169.254.169.254/latest/meta-data/...` — the **cloud metadata endpoint**, to steal IAM credentials (the classic cloud escalation).
- `http://localhost:6379/`, internal admin panels, `http://10.0.0.5/` — internal services behind the firewall.
- `file://` — local file read; other schemes for further abuse.

**Fixes (defense in depth — one isn't enough):**
- **Allowlist** the destinations: only permit the specific hosts/domains the feature legitimately needs. Denylisting internal ranges alone is bypassable (DNS rebinding, redirects, IPv6, octal/decimal IP encodings).
- **Resolve the hostname and validate the *resolved* IP** against private/link-local ranges *before* connecting, and re-check after redirects (or disable redirects). This defeats DNS-rebinding tricks.
- **Block the metadata endpoint** specifically and enforce **IMDSv2** (which requires a token, breaking naive SSRF).
- **Network egress controls** — the service's security group/egress rules should forbid it reaching internal ranges or the metadata IP at all (defense in depth at the network layer).
- Disable unneeded URL schemes; time out and cap response size.

SSRF is OWASP Top 10 in its own right, and it's the poster child for "validate at the boundary *and* enforce least privilege at the network layer" — because the app-layer allowlist and the network egress rule are independent controls.

### Q12. How would you secure a web application handling sensitive user data? (broad prompt)

For a deliberately broad prompt, I'd impose structure with **OWASP Top 10 + the CIA triad + defense-in-depth**, and prioritise by what actually gets exploited:

- **Broken Access Control (#1 real-world risk)** — enforce authz server-side, per object, on every request; deny by default. This is the most exploited category, so I lead here.
- **Authentication** — strong password storage (Argon2/bcrypt + salt), MFA, secure sessions (HttpOnly/Secure/SameSite, rotation), rate-limited login and recovery.
- **Injection** — parameterise all queries; encode all output (context-aware) to kill XSS; validate at boundaries as a layer.
- **Cryptographic failures** — TLS + HSTS in transit, encryption at rest for sensitive data, no home-rolled crypto, proper key management.
- **Security misconfiguration** — secure defaults, security headers (CSP, HSTS, X-Frame-Options), disable debug, tighten CORS.
- **Vulnerable components** — SCA/dependency scanning, patch promptly, SBOM.
- **Logging & monitoring** — log security events (not secrets/PII), alert on anomalies, so I can detect and respond.
- **Data protection / privacy** — minimise what I collect, classify sensitive data, and honour privacy obligations (ties to the compliance topic).

Then I'd **prioritise out loud**: access control + injection + auth are where real breaches happen, so those are load-bearing; headers and hardening are important backstops. I'd apply **defense in depth** throughout (no single control is the whole answer) and **right-size to the data sensitivity** — "handling sensitive user data" means I'd push harder on encryption, access control, and monitoring than I would for a public brochure site. Finally I'd ask clarifying questions about the threat model and data types to focus the effort.

### Q13. How do you reason about a security tradeoff out loud when there's no perfect answer?

Interviewers deliberately pose no-clean-answer tradeoffs (cert pinning? strict CSP? force MFA on everyone?) to see *how you think*, not to hear a memorised verdict. My out-loud method:

1. **State the goal and the threat** — "the point of X is to defend against threat Y." Anchors the discussion in risk, not preference.
2. **Lay out the options with their costs** — security benefit *and* the price: latency, dev friction, user friction, operational complexity, failure modes. E.g. cert pinning stops MITM via rogue CAs but risks bricking the app on cert rotation and adds ops burden.
3. **Weigh by risk = likelihood × impact and by context** — a banking app vs an internal dashboard warrants different answers. Who's the adversary? What's the asset worth?
4. **Watch for the control that backfires** — over-strict controls push users/devs to bypass them (disabled MFA, copy-pasted secrets, shadow IT), making you *less* safe. Usability *is* a security property.
5. **Give a recommendation with conditions** — "for this context I'd do X, and I'd revisit if Z changes." Decisiveness *plus* the reasoning, not a shrug.

Worked example (force MFA on all users?): goal = stop account takeover from stolen/reused passwords (high likelihood, high impact) → strongly favours MFA; cost = user friction and support load → mitigate by preferring low-friction **passkeys/WebAuthn** and risk-based step-up (MFA only on new device/sensitive action). Recommendation: yes, MFA, but choose the *least astonishing, lowest-friction* factor so people don't disable or route around it. The senior signal is exactly this — proportionality, cost-awareness, and a clear call rather than "it depends."

### Q14. Threat-model service-to-service communication in a microservices system.

**The core shift**: don't treat "internal" as "trusted." The old model — hard perimeter, soft interior — means one compromised service can freely reach everything (huge blast radius). The answer is **zero trust**: *never trust, always verify*, regardless of network location.

**Trust boundaries** are now *every* service-to-service hop, not just the edge. STRIDE across that boundary:
- **S — Spoofing**: service A impersonated, or a compromised pod calls service B pretending to be A. → **mTLS** — each service has an identity (cert), both ends authenticate. Or signed service tokens (SPIFFE/JWT). B verifies *who* is calling.
- **T — Tampering**: in-transit modification. → mTLS provides integrity + confidentiality on the wire.
- **R — Repudiation**: which service did what? → Propagate identity + correlation/trace IDs; log per-hop.
- **I — Information disclosure**: sniffing internal traffic. → Encrypt *internal* traffic (mTLS), don't rely on "it's behind the firewall."
- **D — Denial of service**: one service overwhelms another. → Rate limiting, circuit breakers, timeouts, bulkheads between services.
- **E — Elevation of privilege**: compromised low-value service reaches a high-value one. → **Least privilege + network policies** — service B only accepts calls from services that *need* it (Kubernetes NetworkPolicies / service-mesh authz), and each service's credentials are scoped minimally. Shrinks blast radius.

**Prioritise**: mTLS for identity+encryption on every hop, and network policies / authz to enforce least-privilege connectivity — those two convert "compromise one service → reach everything" into "compromise one service → reach only its explicit dependencies." A **service mesh** (Istio/Linkerd) is how this is usually implemented at scale. Ties to container/K8s security and zero-trust networking.

### Q15. What's your general playbook for any "how would you secure X" question?

A single reusable structure I apply to *anything* — API, upload, auth, bucket, pipeline:

1. **Clarify first.** What is X, what data/assets does it handle, who are the users, what's the threat model, what's the sensitivity? Two questions here signal seniority and stop me solving the wrong problem.
2. **Identify assets and trust boundaries.** What's worth protecting, and where does untrusted data cross into trusted zones? The boundaries are where the controls go.
3. **Think like an attacker (briefly).** "How would I break this?" — enumerate the abuse cases / attack surface. Use **STRIDE** if it's a threat-modeling prompt to guarantee coverage.
4. **Map threats to layered controls (defense in depth).** For each threat, name a control, and organise them as independent layers: network/transport → authN → authZ → input/output handling → data protection → monitoring. Anchor completeness with **OWASP Top 10** and the **CIA triad**.
5. **Prioritise and justify.** Lead with the highest-impact controls (usually access control, injection defence, auth, and *not collecting* sensitive data), flag the rest as hardening. Never dump an un-ranked list.
6. **State tradeoffs and right-size.** Acknowledge cost/usability and match rigor to risk — a payment flow earns more than an internal tool.
7. **Add detection + response.** Note logging/monitoring and what happens *when* a control fails — because they do (fail closed, contain, recover).

The meta-point: interviewers are testing *method*, not recall. Every specific answer in this topic is this same skeleton instantiated. If I lead with structure — clarify, boundaries, attacker view, layered controls, priorities, tradeoffs, detection — I'll give a senior answer even to a scenario I've never seen, which is exactly the security engineer's job.
