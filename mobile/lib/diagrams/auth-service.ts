import type { Diagram } from "./types";

export const AUTH_SERVICE: Diagram = {
  id: "auth-service",
  title: "Auth Service (SSO)",
  question: "Design an Authentication & Authorization Service (SSO)",
  sourceId: "patterns",
  itemId: 52,
  overview: {
    shape:
      "Two paths, 100x apart: a slow, stateful login path allowed to cost 170ms, and a stateless verification path running 500k times a second with no call back to the issuer.",
    forces: [
      {
        constraint: "50M DAU x ~1.5 logins/day is ~5k logins/s, but ~200 API calls/day each is ~500k verifications/s",
        decision: "Resource services verify tokens entirely in-process against a cached JWKS key, with zero synchronous call back to the Auth Service",
        lights: ["resource-services", "jwks", "auth-service", "e9", "e13"],
      },
      {
        constraint: "one cheap credential POST can buy 75ms of CPU and 64MB of RAM per hash, roughly a 1000x amplification",
        decision: "Password hashing runs in an isolated argon2id hashing pool, sized and rate-limited apart from the rest of the login path",
        lights: ["hashing-pool", "e3"],
      },
      {
        constraint: "TOTP is a shared secret a real-time phishing proxy can relay in the same 30 second window",
        decision: "The MFA step defaults to WebAuthn, a factor bound to the origin, with TOTP kept only as a fallback",
        lights: ["mfa", "e4"],
      },
      {
        constraint: "a self-contained signed token cannot be revoked, and checking one at 500k/s would need ~250 extra auth instances",
        decision: "Revocation is bought back cheaply: a 10-minute TTL, a rotating refresh token, and a denylist pushed through the revocation feed",
        lights: ["token-mint", "revocation-feed", "e7", "e14"],
      },
      {
        constraint: "a permission list embedded in the token is stale the instant a role changes, and costs ~3.2 Gbps of headers at 500k/s",
        decision: "Authorization stays out of the token: the Policy engine decides what a subject may do, against a role set read fresh",
        lights: ["policy-engine", "e15"],
      },
    ],
    naive: {
      text: "Verify every request by asking the auth service whether the bearer token is still valid, an /introspect call on each API request. At 500k/s that turns a 5k/s login service into a 500k/s synchronous dependency of every request on the platform. It would need roughly 250 extra auth instances just to answer. The design instead signs a self-contained token through the Token mint + rotation stage. Every resource service verifies it locally against a cached public key, in about 40 microseconds, with zero network calls.",
      lights: ["token-mint", "resource-services"],
    },
    beats: [
      {
        text: "Derive the asymmetry first. 50M DAU at ~1.5 authentications a day is ~5k logins/s at peak; the same users making ~200 authenticated API calls a day is ~500k verifications/s. Any design that puts a network call on the verification path converts a 5k/s service into a 500k/s one. It becomes a synchronous dependency of every request on the platform.",
        lights: ["auth-service", "resource-services", "e1", "e9"],
      },
      {
        text: "So the login path is deliberately expensive. It runs authorization-code with PKCE, a proof that only the original requester can redeem the code, then an identity lookup by email_hash. Next comes an isolated argon2id pool that costs 75ms and 64MB on purpose, then a second factor, then a one-time code. That code is redeemed on the back channel for three artefacts: a ~10 minute access JWT, a signed identity token for the client, and an opaque rotating refresh token.",
        lights: ["auth-service", "identity-db", "hashing-pool", "mfa", "token-mint", "e2", "e3", "e4", "e5", "e8"],
      },
      {
        text: "The verification path never leaves the process. A resource service reads the kid from the token header and finds the matching public key in its JWKS cache, refreshed every 5 minutes. It verifies an Ed25519 signature in ~40µs, checks exp, iss and aud, and calls nobody. That is ~20 cores spread across the entire fleet, against ~250 extra auth instances if it introspected instead.",
        lights: ["verify-zone", "resource-services", "jwks", "e13"],
      },
      {
        text: "The price is the whole question. A self-contained signed token is verifiable everywhere with zero network calls, which is precisely why it is popular and precisely why you cannot revoke it. Revocation is bought back in cheap pieces instead of reintroducing a lookup. A short TTL bounds the worst case, and a rotating refresh token is checked on every use at ~2k/s instead of 500k/s. A denylist of revoked jti values, plus a per-user tokens_valid_after timestamp, is pushed to verifiers rather than polled by them.",
        lights: ["token-mint", "session-store", "revocation-feed", "resource-services", "e7", "e11", "e12", "e14"],
      },
      {
        text: "Authorization stays out of the token. The token proves who; the resource service decides what, against a policy engine holding roles and permissions. It carries only coarse role claims, because a permission list in the token is both stale the moment a role changes and ~3.2 Gbps of Authorization header at 500k/s.",
        lights: ["resource-services", "policy-engine", "e15"],
      },
      {
        text: "The residual left over is the actual SLO. Revocation lands in under a second when the pub/sub feed is healthy, and degrades to the 10 minute access-token TTL when it is not. The feed fails open, so the guarantee lapses silently, and only a per-verifier lag gauge notices.",
        lights: ["revocation-feed", "resource-services", "e14"],
      },
    ],
    crux: {
      problem:
        "Revocation is what breaks the elegant stateless story. The token is the authority, and nothing consults anyone again until it expires.",
      handled:
        "Every fix reintroduces exactly the shared, network-visible state that statelessness existed to remove. There is no clean escape, only a deliberate position on the spectrum. A 10-minute TTL bounds the worst case, and the revocation feed pushes a tiny denylist rather than being polled. What remains is an honest published number for the staleness it leaves.",
    },
    numbers: [
      {
        value: "~500k verifications/s against ~5k logins/s, a 100x ratio",
        explain: "50M DAU x ~200 calls/day gives the verification rate; the same DAU x ~1.5 logins/day gives the login rate. The ratio is why the two paths are built to different economics.",
      },
      {
        value: "argon2id 75ms and 64MB per hash, ~375 cores at peak",
        explain: "5k logins/s x 75ms of CPU per hash is ~375 cores held continuously, the deliberate cost of making a stolen dump expensive to crack.",
      },
      {
        value: "~350 live denylist entries, ~14KB, pushed not polled",
        explain: "At ~0.6 revocations/s and a 600s TTL, an entry only lives as long as the token it invalidates. The live set never grows past a few hundred.",
      },
      {
        value: "Ed25519 verify ~40µs, ~20 cores across the whole fleet",
        explain: "500k verifications/s x ~40µs of CPU each is ~20 cores fleet-wide, against roughly 250 extra auth instances an introspection call would need.",
      },
    ],
  },
  nodes: [
    {
      id: "verify-zone",
      label: "Verification path · 500k/s · zero RPC",
      kind: "zone",
      detail: {
        what: "The stateless half of the system: every resource service verifying tokens in-process and resolving permissions locally, with no synchronous call to the auth service.",
        why: "Verification runs 100x more often than authentication, so it has to be local. Otherwise the auth service inherits the whole platform's traffic, and the platform inherits the auth service's availability. Everything inside this box is reachable without a round trip.",
        numbers: [
          { value: "~500k verifications/s", explain: "The peak rate every resource service in the fleet handles locally, with nothing calling back into this box." },
          { value: "p99 < 1ms with zero network calls", explain: "The latency budget verification adds to any request, achievable only because nothing here leaves the process." },
        ],
        breaks: {
          failure: "Anything that quietly reintroduces an RPC here, an introspection call or a denylist GET, multiplies by 500k/s.",
          handled:
            "That single mistake turns a contained auth outage into a total platform outage. The boundary is enforced by code review, and the load-testing harness rejects any new synchronous call inside this zone.",
        },
      },
    },
    {
      id: "client",
      label: "Client app",
      sub: "SPA, mobile, third-party OAuth",
      kind: "external",
      col: 0,
      row: 0,
      detail: {
        what: "The public client that holds the tokens: a browser SPA, a native app, or a third-party OAuth client we do not control.",
        why: "It is drawn explicitly because it is the copy of the credential we can never reach. Revocation propagates to our verifiers over a feed we own. It does not propagate to the attacker's machine, the copy we would most like back.",
        numbers: [
          { value: "~1M concurrent sessions", explain: "The scale of live refresh-token families the session store and revocation feed are sized to carry." },
          { value: "~3 devices per daily active user", explain: "Why a token family, not a single token, is the unit of revocation: one compromised device should not force logout everywhere." },
        ],
        breaks: {
          failure: "A bearer token is still a bearer token. An XSS payload or an adversary-in-the-middle proxy yields a string that works from any machine on earth.",
          handled:
            "httpOnly cookies reduce exfiltration without defeating script that acts as the user in place. Sender-constraining schemes like DPoP are the real fix, but they are not in this baseline.",
        },
      },
    },
    {
      id: "auth-service",
      label: "Auth Service",
      sub: "/authorize · /token · /revoke",
      kind: "service",
      col: 1,
      row: 0,
      detail: {
        what: "The only component that can mint tokens: authorization-code with PKCE, consent, MFA orchestration and revocation endpoints.",
        why: "Request handling is stateless and all state lives in the identity DB and session store, so it scales horizontally with logins rather than with verifications. It is kept small and boring because it is a single point of compromise for the entire platform. Every outcome is also appended to a Kafka-backed audit trail, because this event volume would swamp the transactional store logins depend on.",
        numbers: [
          { value: "~5k logins/s peak", explain: "The rate this service is horizontally scaled against, two orders of magnitude below the verification path." },
          { value: "~170ms p50, ~500ms p99 machine time", explain: "Most of that time is the deliberately expensive argon2id hash, not the service's own logic." },
          { value: "~300k unredeemed codes in flight", explain: "The number of one-time authorization codes live at any moment, within their 60s TTL." },
          { value: "~300M audit events/day, ~75GB/day raw, 90d hot", explain: "The audit stream's daily volume, tiered to columnar storage after 90 days of hot retention." },
        ],
        breaks: {
          failure: "Naive per-account lockout turns into its own denial of service. Five failures and an hour freeze lets an attacker lock any user out for six requests a minute.",
          handled:
            "The audit trail is also only eventually consistent with the decisions it records, so a gap is invisible without a monotonic per-user sequence number that flags missing entries.",
        },
        choice: {
          pick: "Authorization-code with PKCE for every client type, including confidential ones",
          instead: "The implicit flow, which returns the access token directly in the URL fragment.",
          decider:
            "Where a live credential ends up. Implicit puts a working token into browser history, referrer headers and any logging in the path, with no client authentication and no refresh token. PKCE gives a public client the same protection a client_secret gives a confidential one, for the cost of one SHA-256.",
          flips: "Never, for browser and mobile clients. Pure machine-to-machine callers use client-credentials instead, since there is no user and no redirect to protect.",
        },
      },
    },
    {
      id: "hashing-pool",
      label: "argon2id hashing pool",
      sub: "64MB, t=3, p=1, isolated cores",
      kind: "service",
      col: 1,
      row: 1,
      detail: {
        what: "An isolated worker pool with bounded concurrency that does nothing but memory-hard password hashing.",
        why: "One cheap HTTP request buys 75ms of CPU and 64MB of RAM, roughly a 1000x amplification. The hash cannot share a thread pool with anything else, and rate limiting has to sit in front of it rather than behind it.",
        numbers: [
          { value: "~75-100ms and 64MB per hash", explain: "The deliberate per-request cost, tuned as high as the login SLO tolerates to make stolen hashes expensive to crack." },
          { value: "5k/s x 75ms = ~375 cores at peak", explain: "The steady-state CPU budget this pool holds continuously at peak login rate." },
          { value: "32 concurrent x 64MB = ~2GB RAM per host", explain: "The memory footprint per host at the pool's configured concurrency limit." },
        ],
        breaks: {
          failure: "A login flood saturates the workers, the queue grows, and login p99 blows past 500ms.",
          handled:
            "The pool sheds load with fast rejection rather than degrading everything, and the queue depth is tuned so a legitimate morning spike is not mistaken for an attack.",
        },
        choice: {
          pick: "argon2id at 64MB, t=3, p=1, with a 16-byte per-user salt in a PHC string",
          instead: "Salted SHA-256, or bcrypt.",
          decider:
            "What a full exfiltration is worth to the attacker. A consumer GPU does ~20 GH/s of SHA-256, so 36^8 eight-character passwords fall in ~140 seconds against every row at once. Argon2id is bounded by memory instead, so a 24GB card fits only ~375 concurrent 64MB lanes, about 5k guesses/s, and the same space takes ~18 years.",
          flips: "bcrypt is the acceptable older option where argon2id is unavailable, with its 72-byte input truncation as a real gotcha. Plain SHA-256, even salted, is not acceptable at any scale.",
        },
      },
    },
    {
      id: "mfa",
      label: "MFA step",
      sub: "WebAuthn strong, TOTP fallback",
      kind: "service",
      col: 1,
      row: 2,
      detail: {
        what: "The second factor: a WebAuthn assertion or a TOTP code, with step-up required on login from an unrecognised device even when the password is correct.",
        why: "The password is assumed breached. Step-up on device mismatch, rather than the failure counter, is the real defence against credential stuffing, because an attack spread over 10,000 IPs barely engages per-pair throttling.",
        numbers: [
          { value: "~200ms of browser ceremony for WebAuthn", explain: "The added latency of a WebAuthn assertion, well inside the login path's expensive-by-design budget." },
          { value: "~30% of users enrolled, ~1.3 factors each", explain: "Current enrolment, the real ceiling on how many logins this step actually protects." },
        ],
        breaks: {
          failure: "TOTP is a shared secret in a 30 second window, so a real-time proxy phishing page relays the six digits and completes the login.",
          handled:
            "The user did everything right and the attacker still gets a session. WebAuthn is pushed as the strong tier, and the phishing-resistant enrolment share is tracked as a security metric.",
        },
        choice: {
          pick: "WebAuthn as the strong tier, TOTP secrets stored encrypted under a KMS key",
          instead: "TOTP or SMS codes alone.",
          decider:
            "Phishing resistance, which TOTP does not have. WebAuthn signs a challenge bound to the origin, so a signature produced for a lookalike domain is worthless at the real one. There is no secret for the user to hand over.",
          flips: "TOTP stays as the fallback tier for users without an authenticator, and recovery codes exist for both. Recovery codes are passwords again, so they are hashed with the same KDF and burned on use.",
        },
      },
    },
    {
      id: "token-mint",
      label: "Token mint + rotation",
      sub: "10min JWT, id_token, refresh",
      kind: "service",
      col: 1,
      row: 3,
      detail: {
        what: "The /token exchange: verifies SHA-256(code_verifier) against the stored challenge, burns the code, and signs a short-lived access JWT, an OIDC id_token and an opaque rotating refresh token.",
        why: "This is where the long-lived authority is moved off the request path. Every use of a refresh token invalidates it and issues a successor in the same family. A second presentation of a superseded token proves two parties hold the lineage, and the safe response is to kill the whole family.",
        numbers: [
          { value: "~25ms, dominated by two signatures", explain: "Signing the access JWT and the id_token accounts for nearly all of the token exchange's latency." },
          { value: "~1.7k/s average refreshes, ~5k/s peak", explain: "The write rate the session store sees from refresh rotation, roughly 300x lighter than the verification path." },
          { value: "~450B per Ed25519 token on the wire", explain: "The access-token size, kept small since it rides in an Authorization header on every one of 500k requests/s." },
        ],
        breaks: {
          failure: "Honest clients on flaky networks look exactly like theft: the response is lost, the client retries the same token, and naive reuse detection logs out an innocent user.",
          handled: "A ~10s idempotent grace window returning the same rotated pair is the fix, distinguishing a network retry from a genuine second presentation.",
        },
        choice: {
          pick: "Ed25519 (EdDSA) access tokens with a 10 minute TTL and a rotating opaque refresh token",
          instead: "RS256 tokens, or a long-lived access token with no refresh at all.",
          decider:
            "Header bytes and the revocation window together. At 500k/s an RS256 JWT is ~3.2 Gbps of pure Authorization header; Ed25519 cuts the signature from 256B to 64B, about 1.8 Gbps. The 10 minute TTL turns 500k/s of revocation checking into ~1.7k/s of refresh lookups.",
          flips:
            "Drop to a 60 second TTL when the business will not tolerate 10 minutes and you would rather have no pushed denylist at all. Refresh writes go from ~1.7k/s to ~17k/s average, which an in-memory store absorbs.",
        },
      },
    },
    {
      id: "identity-db",
      label: "Identity DB",
      sub: "PostgreSQL · users, MFA, roles",
      kind: "database",
      col: 2,
      row: 0,
      detail: {
        what: "Users, credential hashes, kdf_params, MFA enrolments, account status and the per-user tokens_valid_after timestamp.",
        why: "The constraints matter more than the throughput: a unique index on email_hash, foreign keys to MFA factors, and a transactional password change. The write rate is trivially small, so the interesting property is correctness rather than scale.",
        numbers: [
          { value: "~500M identities, ~600B each, ~300GB", explain: "The base table size, small enough to fit comfortably on one primary." },
          { value: "~900GB at RF=3", explain: "The replicated footprint once three copies are kept for durability." },
          { value: "~24GB unique index on email_hash", explain: "The index every login path lookup hits, fixed-width because it indexes a hash rather than the raw address." },
        ],
        breaks: {
          failure: "Primary failure stops registration, password change and MFA enrolment.",
          handled:
            "Reads keep serving from replicas, so logins and refreshes are unaffected. The outage is invisible on the busy path, which means it is easy to under-alert without a dedicated write-path check.",
        },
        choice: {
          pick: "PostgreSQL with read-local replicas and write-global to the home region",
          instead: "A wide-column store such as Cassandra or DynamoDB.",
          decider:
            "Write rate against constraint enforcement. 500M rows at ~300GB is one machine's worth of data, and the writes are a trickle of registrations against ~5k/s of reads, so nothing here needs horizontal write scaling.",
          flips: "When identity records genuinely outgrow one primary, or when per-region residency rules force partitioning by jurisdiction rather than replication.",
        },
      },
    },
    {
      id: "session-store",
      label: "Session + denylist",
      sub: "Redis: refresh hash + denylist",
      kind: "database",
      col: 2,
      row: 3,
      detail: {
        what: "Hashed refresh tokens keyed by family with a rotation counter and device fingerprint, the 60s authorization codes, and the revoked-jti denylist.",
        why: "Every access pattern here is a point lookup with a TTL, which is exactly what an in-memory store is good at. The denylist entry only has to outlive an unexpired access token, so the whole set stays tiny and disposable.",
        numbers: [
          { value: "~150M live sessions, ~200B each, ~30GB", explain: "The steady-state footprint of every active refresh-token family across the fleet." },
          { value: "~10k writes/s peak counting rotations", explain: "The write load from refresh rotation at peak, an order of magnitude below what verification would need if it hit this store." },
          { value: "~350 live denylist entries ≈ 14KB", explain: "The revocation set stays this small because an entry expires as soon as the access token it invalidates would have." },
        ],
        breaks: {
          failure: "A shard loss drops refresh tokens and denylist entries for that key range.",
          handled:
            "Users on that shard re-authenticate, which is degraded rather than broken, and the denylist is rebuilt by replaying the last TTL window from the audit log.",
        },
        choice: {
          pick: "Redis Cluster, sharded by user_id, with tokens stored as SHA-256 hashes",
          instead: "Refresh tokens in the identity database, or self-contained signed refresh tokens.",
          decider:
            "Write rate and access shape. ~10k writes/s of rotation against ~150M keys with TTLs is a workload a relational primary would carry badly and an in-memory store handles as its native case.",
          flips: "A deployment small enough that session count fits comfortably in the identity database, where one fewer stateful system to operate is worth more than unused write headroom.",
        },
      },
    },
    {
      id: "kms",
      label: "KMS / HSM",
      sub: "signing keys, 90-day rotation",
      kind: "database",
      col: 1,
      row: 4,
      detail: {
        what: "The custody boundary for the signing keys. The auth service asks the KMS to sign, or holds a short-lived unwrapped key in memory; the private half never lands on a disk we operate.",
        why: "A stolen signing key mints valid tokens for any user at any service and nothing on the verification path can tell. That is the only single compromise in this design with unbounded blast radius, so it gets hardware custody and an access log.",
        numbers: [
          { value: "rotation every 90 days", explain: "The scheduled cadence signing keys are replaced, bounding how long a slow-burning compromise stays undetected." },
          { value: "~1 hour overlap window per rotation", explain: "The margin held between publishing a new key and retiring the old one, so no in-flight token is ever left unverifiable." },
        ],
        breaks: {
          failure: "Rotation needs an overlap in both directions: publish the new key and wait a full JWKS cache TTL plus margin before signing with it.",
          handled:
            "The old key stays published for at least one access-token lifetime after its last signature. Emergency rotation collapses that window deliberately and accepts a wave of 401s as the cost.",
        },
        choice: {
          pick: "AWS KMS or a CloudHSM holding the private key, with the service requesting signatures",
          instead: "Signing keys in application config or a secrets manager, loaded into process memory.",
          decider:
            "What a host compromise yields. A key in process memory is exfiltrated with the host, and it mints valid tokens for all 500M identities until the kid is retired. Hardware custody caps the loss at the signing rate an attacker can drive through an audited API, ~5k/s.",
          flips: "Development and small deployments where the operational cost and per-signature latency of a KMS round trip outweigh a threat model that does not include host compromise.",
        },
      },
    },
    {
      id: "jwks",
      label: "JWKS endpoint",
      sub: "CDN, kid → public key, 5 min TTL",
      kind: "database",
      col: 2,
      row: 4,
      detail: {
        what: "The public halves of the signing keys, indexed by kid, served from a CDN and cached in-process by every verifier.",
        why: "This is what makes local verification possible at all: the verifier holds the key rather than asking for a decision. It is also the hidden single point of failure for the whole platform, because a verifier that cannot resolve a kid rejects every request.",
        numbers: [
          { value: "refreshed every 5 minutes, jittered", explain: "The pull cadence every verifier uses, jittered so instances do not stampede the endpoint at the same instant." },
          { value: "retired keys kept published ≥ 10 min (one token lifetime)", explain: "The minimum a retired key stays visible, so no still-valid token ever fails to find its verification key." },
        ],
        breaks: {
          failure: "A region restarting after a deploy sends thousands of simultaneous fetches, and a cold cache with an unreachable endpoint means 401 everywhere.",
          handled: "The cache is never hard-expired, serves stale, and a bootstrap key set is baked into the image so a cold start never depends on this endpoint being reachable.",
        },
        choice: {
          pick: "CDN with long stale-while-revalidate, jittered 5 minute refresh, bootstrap keys in the image",
          instead: "Serving JWKS directly from the auth service with a plain TTL cache.",
          decider:
            "Behaviour on a cold cache, which fails closed by construction. Keys are a few hundred bytes and change every 90 days, so the request is perfectly cacheable, and thousands of instances restarting together would otherwise stampede this endpoint.",
          flips: "Nothing sensible flips this at scale. A single-service deployment can read the key from local config, at which point there is no distribution problem to solve.",
        },
      },
    },
    {
      id: "revocation-feed",
      label: "Revocation feed",
      sub: "pub/sub, jti + valid_after",
      kind: "queue",
      col: 2,
      row: 1,
      detail: {
        what: "A pub/sub topic carrying revoked jti values and per-user tokens_valid_after bumps into every verifier's in-process set.",
        why: "This is revocation bought as a push rather than a lookup. It is the only mechanism that closes the window between a revocation and the access token's expiry. It exists because the alternative costs a network call on all 500k verifications a second.",
        numbers: [
          { value: "~0.6 revocations/s, ~350 live entries, ~14KB", explain: "The steady revocation rate keeps the pushed set tiny, since an entry lives only as long as the token it invalidates." },
          { value: "propagation p99 < 1s, hard alert above 60s", explain: "The freshness target for a revocation to reach every verifier, and the threshold past which the feed is treated as degraded." },
        ],
        breaks: {
          failure: "It fails open by design, so a partitioned verifier keeps honouring revoked tokens against a stale set and nothing in the request path notices.",
          handled:
            "The one mechanism for cases that cannot wait for the TTL is the mechanism that stops working first. Only a per-verifier lag gauge sees it, which is why that gauge is a paged alert.",
        },
        choice: {
          pick: "Push ~14KB of denylist into every verifier's memory over pub/sub",
          instead: "Have each verifier look the jti up in Redis on every request.",
          decider:
            "The arithmetic settles it decisively for identical correctness. At ~0.6 revocations/s and a 600s TTL the live set is ~350 entries, ~14KB. As a lookup it would be 500k GETs/s, roughly 15 store nodes at RF=3, and ~0.5ms added to every request on the platform.",
          flips: "Drop the feed entirely and run TTL-only when you can afford a 60 second access token instead, trading one fewer distributed dependency for a shorter cache window.",
        },
      },
    },
    {
      id: "resource-services",
      label: "Resource services",
      sub: "verify in-process, ~40µs, no RPC",
      kind: "service",
      col: 3,
      row: 1,
      parent: "verify-zone",
      detail: {
        what: "Every service on the platform, verifying the bearer token locally: signature by cached public key, then exp, iss, aud, jti against the pushed denylist and iat against tokens_valid_after.",
        why: "The verification path has no miss. Unlike a CDN edge, there is no origin to fall back to, because the fallback would be exactly the 500k/s call the design exists to avoid. Everything it needs must already be in memory.",
        numbers: [
          { value: "~500k/s, ~40µs per verify", explain: "The peak rate and per-request cost this stage runs at across every service on the platform." },
          { value: "~20 cores across the whole fleet", explain: "The total CPU verification costs the platform, roughly 12x cheaper than the ~250 instances an introspection call would need." },
          { value: "p99 < 1ms with zero network calls", explain: "The latency this stage adds to any request, achievable only because it never leaves the process." },
        ],
        breaks: {
          failure: "Library-level algorithm confusion: a token claiming alg none, or an HS256 token signed with your published RSA public key.",
          handled: "The verifier pins the expected algorithm and rejects unknown kids rather than trusting the header, closing off both classes of confusion attack.",
        },
        choice: {
          pick: "Local in-process verification against a cached JWKS key",
          instead: "Opaque tokens with a synchronous /introspect call to the auth service on every request.",
          decider:
            "The 100x ratio, 500k verifications/s against 5k logins/s. Local verify is ~40µs and ~20 cores fleet-wide. Introspection at 500k/s is ~250 additional auth instances and a hard synchronous dependency on a service previously handling 1% of that traffic.",
          flips: "When verification sits within ~10x of login volume rather than 100x, which describes an internal admin platform or a B2B API at a few thousand rps.",
        },
      },
    },
    {
      id: "policy-engine",
      label: "Policy engine",
      sub: "RBAC now, OPA or Cedar later",
      kind: "service",
      col: 3,
      row: 2,
      parent: "verify-zone",
      detail: {
        what: "Evaluates whether this subject may perform this action on this resource, at the resource service, against a cached role and permission set.",
        why: "The token proves who and the resource service decides what. Baking permissions into the token makes a role downgrade invisible until expiry, and inflates every request. So the token carries at most one or two coarse role claims, and the real decision happens here.",
        numbers: [
          { value: "~1µs against a cached role set", explain: "Roughly 10,000x cheaper than a relationship check's 5-20ms uncached; that gap is what makes checking every request affordable." },
          { value: "~3.2 Gbps of headers avoided by not embedding permissions", explain: "The Authorization-header cost the design avoids at 500k/s by keeping permissions out of the token itself." },
        ],
        breaks: {
          failure: "A contractor downgraded from admin to viewer mid-session keeps the old claim if you embedded it.",
          handled: "With the check performed here instead, the downgrade takes effect on the very next request, which is the whole reason this decision lives outside the token.",
        },
        choice: {
          pick: "RBAC behind a policy interface so the evaluator can be swapped",
          instead: "Relationship-based authorization in the Zanzibar shape, with tuples such as doc:42#viewer@user:alice.",
          decider:
            "Whether you can enumerate the permission set at the moment a role is assigned. If sharing a document mints a new permission edge, you cannot, and RBAC degenerates into roles that never terminate. An RBAC check is sub-microsecond; a relationship check is 3 to 5 hops and ~5 to 20ms uncached.",
          flips: "When permission genuinely lives in a graph: document sharing, folder inheritance, org hierarchies. It brings a denormalised reverse index and a consistency token so a fresh share is never seen as a stale denial.",
        },
      },
    },
  ],
  edges: [
    {
      id: "e1",
      from: "client",
      to: "auth-service",
      tier: "hot",
      step: 1,
      label: "1. login (5k/s)",
      detail: {
        what: "The browser redirected to /authorize with client_id, redirect_uri, scope, state, nonce and a code_challenge, followed by the credential POST.",
        why: "The front channel carries only the challenge, never the verifier. An attacker who steals the code off the redirect cannot redeem it. state defends against a separate attack, login-CSRF. nonce defends against a third, id_token replay.",
        numbers: [
          { value: "~5k/s peak", explain: "The login rate this front-channel hop is provisioned for at peak." },
          { value: "/authorize ~15ms, credential POST ~120ms", explain: "The two legs of the login request; the credential POST dominates because it triggers the password hash." },
        ],
        breaks: {
          failure: "A malicious app can register the same custom URL scheme on a phone, and codes can leak through referrer headers.",
          handled: "That is exactly why the redirect is not allowed to carry anything redeemable on its own; the code_verifier travels only on the back channel, never here.",
        },
      },
    },
    {
      id: "e2",
      from: "auth-service",
      to: "identity-db",
      tier: "hot",
      step: 2,
      label: "email_hash lookup",
      detail: {
        what: "Resolving the identity row by a hash of the normalised email, reading the stored credential hash, kdf_params, status and tokens_valid_after.",
        why: "The lookup is indexed on email_hash rather than the email itself, so the hot index stays fixed-width and the plaintext address is not the join key. Everything the login decision needs comes back in one read.",
        numbers: [
          { value: "~2ms", explain: "The typical latency of this indexed lookup, a small fraction of the overall login budget." },
          { value: "~24GB unique index over 500M rows", explain: "48 bytes/row, small enough to stay warm in the buffer pool, which is why this lookup holds ~2ms at full user-base scale." },
        ],
        breaks: {
          failure: "Skipping the hash comparison when the email does not exist leaks account existence through response time.",
          handled: "The argon2id comparison runs against a dummy hash regardless of whether the account exists, so the timing is identical either way.",
        },
      },
    },
    {
      id: "e3",
      from: "auth-service",
      to: "hashing-pool",
      tier: "hot",
      step: 3,
      label: "argon2id 75ms / 64MB",
      detail: {
        what: "The submitted password handed to the isolated pool for a memory-hard comparison against the stored hash.",
        why: "This is where the login path spends almost all of its machine time and all of its CPU budget, deliberately. The cost is the feature: it removes the GPU's advantage against a stolen dump.",
        numbers: [
          { value: "~75-100ms of the ~120ms credential POST", explain: "Almost the entire credential-check latency is spent here, by design." },
          { value: "~375 cores at 5k logins/s", explain: "The steady CPU cost of the hash at peak login rate, held apart from the rest of the fleet." },
        ],
        breaks: {
          failure: "Rate limiting must sit before this arrow, not after it.",
          handled: "200k stuffing attempts at 75ms each is ~4 CPU-hours an attacker can make you spend. That amplification is what the pool exists to contain, so requests are throttled before they reach the hash.",
        },
      },
    },
    {
      id: "e4",
      from: "hashing-pool",
      to: "mfa",
      tier: "hot",
      step: 4,
      label: "password verified",
      detail: {
        what: "A successful credential comparison escalating to the second factor rather than issuing anything.",
        why: "The password is treated as breached until a second factor says otherwise. This hop always happens for enrolled users, and it happens on device mismatch even when the password is correct.",
        numbers: [
          { value: "~200ms of WebAuthn ceremony", explain: "The added latency this hop introduces for a user with a strong second factor enrolled." },
          { value: "human TOTP entry (~15s) excluded from the SLO", explain: "The time a person spends typing a code is not counted against the machine-time login budget." },
        ],
        breaks: {
          failure: "A user with no factor enrolled skips straight through.",
          handled: "The enrolled share, currently ~30%, is the real ceiling on what this step protects, which is why raising WebAuthn enrolment is tracked as a security metric rather than assumed complete.",
        },
      },
    },
    {
      id: "e5",
      from: "mfa",
      to: "token-mint",
      tier: "hot",
      step: 5,
      label: "one-time code, 60s TTL",
      detail: {
        what: "A one-time authorization code stored with the code_challenge, then redeemed on the back channel with the raw code_verifier.",
        why: "The split between front channel and back channel is the whole point of the flow. The code travels somewhere observable; the verifier that makes it redeemable does not.",
        numbers: [
          { value: "60s TTL", explain: "How long an unredeemed code stays valid before it expires unused." },
          { value: "~300k unredeemed codes in flight at peak", explain: "The number of codes live at any moment at peak login volume, all within their 60s window." },
        ],
        breaks: {
          failure: "A second presentation of the same code means the code leaked.",
          handled: "That second presentation must fail, and it revokes everything already issued from that code, on the assumption that the leak is ongoing rather than a one-off.",
        },
      },
    },
    {
      id: "e6",
      from: "token-mint",
      to: "kms",
      tier: "control",
      label: "sign, key never exported",
      detail: {
        what: "The signing request for the access token and the id_token, made against a key the service can use but cannot read.",
        why: "Two signatures dominate the ~25ms token exchange. This is the one operation in the system whose compromise cannot be detected downstream, so the key stays in hardware custody with an access log.",
        numbers: [
          { value: "~25ms for the exchange, dominated by two signatures", explain: "Signing the access token and id_token accounts for nearly all of the token exchange's latency." },
          { value: "~5k signings/s at peak", explain: "The signing rate the KMS is provisioned to sustain, matching the peak login rate." },
        ],
        breaks: {
          failure: "An anomalous issuance rate here is the only early signal of key misuse.",
          handled: "A token signed with the real key is indistinguishable from a legitimate one at every verifier, so an unusual signing rate is monitored and alerted on directly.",
        },
      },
    },
    {
      id: "e7",
      from: "token-mint",
      to: "session-store",
      tier: "data",
      label: "hashed refresh family",
      detail: {
        what: "Writing the hashed refresh token with its family_id, rotation counter and device fingerprint, and invalidating the predecessor in the same write.",
        why: "This is the one lookup the design keeps: once per session per 10 minutes rather than once per request, ~1.7k/s instead of ~500k/s. Rotation is what makes reuse detectable at all.",
        numbers: [
          { value: "~1.7k/s average, ~5k/s peak", explain: "The write rate refresh rotation drives, roughly 300x lighter than the verification path it stands in for." },
          { value: "~10k writes/s counting both paths", explain: "The store's total write load once authorization-code writes are counted alongside refresh rotation." },
        ],
        breaks: {
          failure: "Every refresh is a write, so halving the access-token TTL doubles this rate.",
          handled: "That dial is the explicit trade between revocation latency and store load, tuned deliberately rather than left as an accident of the TTL choice.",
        },
      },
    },
    {
      id: "e8",
      from: "token-mint",
      to: "client",
      fromSide: "left",
      toSide: "left",
      tier: "hot",
      step: 6,
      label: "access + id + refresh",
      offset: 90,
      detail: {
        what: "Three artefacts returned on the back channel: a ~10 minute access JWT, an OIDC id_token for the client, and an opaque rotating refresh token.",
        why: "They are separate because they answer separate questions. The access token is a cached authorization decision copied everywhere, and the id_token is an identity assertion for the client. The refresh token is the only recallable thing in the set.",
        numbers: [
          { value: "expires_in: 600", explain: "The access token's lifetime in seconds, the bound on how stale a revocation can ever be." },
          { value: "~450B per Ed25519 access token", explain: "The wire size of the access token, kept small because it rides every one of 500k requests/s." },
        ],
        breaks: {
          failure: "Where the client puts them decides the blast radius of one XSS.",
          handled:
            "localStorage is readable by any injected script and is a permanent exfiltration. An httpOnly Secure SameSite cookie stops the token walking away, though not script acting as the user in place.",
        },
      },
    },
    {
      id: "e9",
      from: "client",
      to: "resource-services",
      tier: "hot",
      step: 7,
      label: "2. bearer (500k/s)",
      detail: {
        what: "Every authenticated API call on the platform, carrying Authorization: Bearer and nothing else the verifier needs.",
        why: "This is the arrow the whole design is sized for. It is 100x the login arrow and it terminates locally, which is the only reason the auth service can be a 5k/s service instead of a 500k/s one.",
        numbers: [
          { value: "~500k/s peak", explain: "The peak rate of authenticated calls across the entire platform." },
          { value: "~40µs verify, zero network calls", explain: "The per-request cost each resource service pays, entirely local." },
          { value: "~1.8 Gbps of Authorization header", explain: "The aggregate header bandwidth this hot path carries at peak, with Ed25519 keeping the token small." },
        ],
        breaks: {
          failure: "It carries a bearer credential, so anyone holding the string is the user from any machine on earth.",
          handled: "Sender-constraining with DPoP or mTLS is the real fix and is not in the baseline, because it needs client-side key handling in every SDK.",
        },
      },
    },
    {
      id: "e10",
      from: "kms",
      to: "jwks",
      tier: "control",
      label: "publish public halves",
      detail: {
        what: "The public half of each signing key published under its kid, with retired keys kept in the set well after they stop signing.",
        why: "Verifiers need the key, not a decision, and this is the only thing they ever fetch from us on a schedule. Publishing early and retiring late is what makes rotation invisible to them.",
        numbers: [
          { value: "90 day rotation cadence", explain: "How often a fresh signing key is introduced and an old one begins its retirement countdown." },
          { value: "~1 hour total overlap window", explain: "The margin held before a new key starts signing and after an old key stops, so nothing is ever briefly unverifiable." },
        ],
        breaks: {
          failure: "Retiring a kid too early makes every in-flight token signed with it unverifiable.",
          handled: "A key stays published for at least one full access-token lifetime after its last signature, so no valid token can ever outlive its own verification key.",
        },
      },
    },
    {
      id: "e11",
      from: "session-store",
      to: "revocation-feed",
      tier: "control",
      label: "revocations fan out",
      detail: {
        what: "Revoked jti values and killed token families published onto the feed the moment they are written.",
        why: "The store is the source of truth but nothing on the verification path reads it, so a revocation is only real once it has been pushed. Publishing on write is what keeps propagation inside the 1s SLO.",
        numbers: [
          { value: "~0.6 revocations/s", explain: "The steady rate of revocations flowing out onto the feed." },
          { value: "p99 propagation < 1s", explain: "The freshness target this fan-out is held to before a revocation reaches every verifier." },
        ],
        breaks: {
          failure: "If the publish is not tied atomically to the write, a revocation can be durably stored and never delivered.",
          handled: "That reads as success everywhere and is a silent security failure, which is why the write and the publish happen in the same transaction rather than as a separate step.",
        },
      },
    },
    {
      id: "e12",
      from: "identity-db",
      to: "revocation-feed",
      tier: "control",
      label: "tokens_valid_after bump",
      offset: 90,
      detail: {
        what: "A per-user timestamp bumped on logout-everywhere, admin disable or password change, pushed out and compared against each token's iat.",
        why: "It kills every token a user holds with one 8-byte write, what log-out-everywhere actually needs. A jti denylist can only name tokens you know about; this names all of them at once.",
        numbers: [
          { value: "8 bytes per user", explain: "Replaces an unbounded jti denylist entry per revoked token; one write kills every token a user holds, cheap enough to replicate fleet-wide." },
          { value: "default 0, cached aggressively at the verifier", explain: "The common case, a user who has never triggered a bump, must be free to check rather than a fetch." },
        ],
        breaks: {
          failure: "It is a per-user lookup on the hot path unless it is cached, and a cache miss on a user with no bump is the common case.",
          handled: "The default has to be free rather than a fetch, so the verifier treats an absent entry as zero locally instead of querying for it.",
        },
      },
    },
    {
      id: "e13",
      from: "jwks",
      to: "resource-services",
      tier: "control",
      label: "public keys by kid",
      detail: {
        what: "Each verifier pulling the key set on a jittered 5 minute schedule and holding it in process.",
        why: "It is a pull rather than a push because keys change every 90 days and staleness is harmless: a retired key's tokens have already expired. The verifier never asks about a specific token, only for the keys.",
        numbers: [{ value: "refreshed every 5 minutes", explain: "The polling interval every verifier uses to keep its local key cache current." }],
        breaks: {
          failure: "This path fails closed. A verifier that cannot resolve a kid rejects every request.",
          handled: "The cache serves stale indefinitely rather than expiring hard, and a bootstrap key set ships in the image, so a fresh instance never depends on this endpoint being reachable.",
        },
      },
    },
    {
      id: "e14",
      from: "revocation-feed",
      to: "resource-services",
      tier: "control",
      label: "revoked jti, pushed",
      detail: {
        what: "The in-memory revoked set kept current at each verifier by subscription rather than by lookup.",
        why: "It is the only wire between the two halves of the system that carries anything per-token, and it carries kilobytes rather than requests. Push is what stops revocation costing 500k GETs/s.",
        numbers: [
          { value: "~14KB replicated everywhere", explain: "Small enough to sit entirely in memory, turning a revocation check into a local hash-set lookup — the ~0.5ms/request this push saves." },
          { value: "~0.5ms saved on every request", explain: "The per-request cost this push avoids compared to a synchronous lookup at 500k/s." },
        ],
        breaks: {
          failure: "This path fails open, deliberately, because failing closed turns a feed partition into a total platform outage.",
          handled: "The cost is that the revocation guarantee lapses silently and degrades to the 10 minute TTL, watched by a per-verifier lag gauge that pages when it exceeds 60s.",
        },
      },
    },
    {
      id: "e15",
      from: "resource-services",
      to: "policy-engine",
      tier: "hot",
      step: 8,
      label: "may subject do action?",
      detail: {
        what: "The authorization check itself, run at the resource service against a cached role and permission set once the token has been verified.",
        why: "Authentication and authorization are separated on purpose. The token is a cached identity claim minted minutes ago, while permissions can change during a session and must be read fresh enough to notice.",
        numbers: [
          { value: "~1µs against a cached role set", explain: "At 500k requests/s, 1µs each is under a full core fleet-wide — cheap enough to run synchronously instead of trusting a token claim." },
          { value: "at most 1 to 2 coarse role claims in the token", explain: "The only permission-adjacent data the token itself carries; everything finer is decided here instead." },
        ],
        breaks: {
          failure: "Bounded staleness is fine for reading a dashboard and not fine for a wire transfer.",
          handled: "High-consequence boundaries need a synchronous check that does not inherit the feed's fail-open default. Sorting actions between the two paths is done by hand, not by a blanket rule.",
        },
      },
    },
  ],
};
