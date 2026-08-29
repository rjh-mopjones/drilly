import type { Diagram } from "./types";

export const AUTH_SERVICE: Diagram = {
  id: "auth-service",
  title: "Auth Service (SSO)",
  question: "Design an Authentication & Authorization Service (SSO)",
  sourceId: "patterns",
  itemId: 52,
  overview: {
    shape:
      "Two paths with a 100x gap between them: a slow, stateful login path that is allowed to cost 170ms, and a stateless verification path that runs 500k times a second in-process with no call back to the issuer.",
    beats: [
      {
        text: "Derive the asymmetry first. 50M DAU at ~1.5 authentications a day is ~5k logins/s at peak; the same users making ~200 authenticated API calls a day is ~500k verifications/s. Any design that puts a network call on the verification path converts a 5k/s service into a 500k/s one and makes it a synchronous dependency of every request on the platform.",
        lights: ["auth-service", "resource-services", "e1", "e9"],
      },
      {
        text: "So the login path is deliberately expensive. Authorization-code with PKCE, an identity lookup by email_hash, then an isolated argon2id pool that costs 75ms and 64MB on purpose, then a second factor, then a one-time code redeemed on the back channel for three artefacts: a ~10 minute access JWT, an OIDC id_token, and an opaque rotating refresh token.",
        lights: ["auth-service", "identity-db", "hashing-pool", "mfa", "token-mint", "e2", "e3", "e4", "e5", "e8"],
      },
      {
        text: "The verification path never leaves the process. A resource service reads the kid from the token header, finds the matching public key in its JWKS cache refreshed every 5 minutes, verifies an Ed25519 signature in ~40µs, checks exp, iss and aud, and calls nobody. That is ~20 cores spread across the entire fleet, against ~250 extra auth instances if it introspected instead.",
        lights: ["verify-zone", "resource-services", "jwks", "e13"],
      },
      {
        text: "The price is the whole question. A self-contained signed token is verifiable everywhere with zero network calls, which is precisely why it is popular and precisely why you cannot revoke it. Buy revocation back in cheap pieces rather than reintroducing a lookup: a short TTL bounds the worst case, a rotating refresh token is checked on every use at ~2k/s instead of 500k/s, and a denylist of revoked jti values plus a per-user tokens_valid_after timestamp is pushed to verifiers rather than polled by them.",
        lights: ["token-mint", "session-store", "revocation-feed", "resource-services", "e7", "e11", "e12", "e14"],
      },
      {
        text: "Authorization stays out of the token. The token proves who; the resource service decides what, against a policy engine holding roles and permissions. Coarse role claims only, because a permission list in the token is both stale the moment a role changes and ~3.2 Gbps of Authorization header at 500k/s.",
        lights: ["resource-services", "policy-engine", "e15"],
      },
      {
        text: "The residual left over is the actual SLO. Revocation lands in under a second when the pub/sub feed is healthy and degrades to the 10 minute access-token TTL when it is not, and the feed fails open, so the guarantee lapses silently and only a per-verifier lag gauge notices.",
        lights: ["revocation-feed", "resource-services", "e14"],
      }
    ],
    crux:
      "Revocation is what breaks the elegant stateless story. The token is the authority and nothing consults you again until it expires, so every fix reintroduces exactly the shared, network-visible state that statelessness existed to remove. There is no clean escape, only a deliberate position on the spectrum and an honest number for the staleness it leaves.",
    numbers: [
      "~500k verifications/s against ~5k logins/s, a 100x ratio",
      "argon2id 75ms and 64MB per hash, ~375 cores at peak",
      "~350 live denylist entries, ~14KB, pushed not polled",
      "Ed25519 verify ~40µs, ~20 cores across the whole fleet"
    ],
  },
  nodes: [
    {
      id: "verify-zone",
      label: "Verification path · 500k/s · zero RPC",
      kind: "zone",
      detail: {
        what: "The stateless half of the system: every resource service verifying tokens in-process and resolving permissions locally, with no synchronous call to the auth service.",
        why: "Verification runs 100x more often than authentication, so it has to be local or the auth service inherits the whole platform's traffic and the whole platform inherits the auth service's availability. Everything inside this box is reachable without a round trip.",
        numbers: ["~500k verifications/s", "p99 < 1ms with zero network calls"],
        breaks:
          "Anything that quietly reintroduces an RPC here, an introspection call or a denylist GET, multiplies by 500k/s and turns a contained auth outage into a total platform outage.",
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
        why: "It is drawn explicitly because it is the copy of the credential we can never reach. Revocation propagates to our verifiers over a feed we own; it does not propagate to the attacker's machine, which is the copy we would most like back.",
        numbers: ["~1M concurrent sessions", "~3 devices per daily active user"],
        breaks:
          "A bearer token is still a bearer token. An XSS payload or an adversary-in-the-middle proxy yields a string that works from any machine on earth, and httpOnly cookies reduce exfiltration without defeating script that acts as the user in place.",
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
        what: "The only component that can mint tokens: authorization-code with PKCE, consent, MFA orchestration and revocation endpoints. Every outcome is also appended to a Kafka-backed audit trail, tiered to columnar storage after 90 days.",
        why: "Request handling is stateless and all state lives in the identity DB and session store, so it scales horizontally with logins rather than with verifications. Kept small and boring because it is a single point of compromise for the entire platform. The audit trail exists because this event volume would swamp the transactional store logins depend on, and it is how a lost denylist shard gets rebuilt, by replaying the last TTL window.",
        numbers: [
          "~5k logins/s peak",
          "~170ms p50, ~500ms p99 machine time",
          "~300k unredeemed codes in flight",
          "~300M audit events/day, ~75GB/day raw, 90d hot"
        ],
        breaks:
          "Naive per-account lockout turns into its own denial of service: five failures and an hour freeze lets an attacker lock any user out for the cost of six requests a minute. The audit trail is also only eventually consistent with the decisions it records, so a gap is invisible without a monotonic per-user sequence number.",
        choice: {
          pick: "Authorization-code with PKCE for every client type, including confidential ones",
          instead: "The implicit flow, which returns the access token directly in the URL fragment.",
          decider:
            "Where a live credential ends up. Implicit puts a working token into browser history, referrer headers and any logging in the path, with no client authentication and no refresh token, which forced long access-token lifetimes. PKCE gives a public client the same protection a client_secret gives a confidential one for the cost of one SHA-256, and the code is single-use with a 60s TTL.",
          flips:
            "Never, for browser and mobile clients. Pure machine-to-machine callers use client-credentials instead, since there is no user and no redirect to protect.",
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
        why: "One cheap HTTP request buys 75ms of CPU and 64MB of RAM, roughly a 1000x amplification, so the hash cannot share a thread pool with anything else and rate limiting has to sit in front of it rather than behind it.",
        numbers: ["~75-100ms and 64MB per hash", "5k/s x 75ms = ~375 cores at peak", "32 concurrent x 64MB = ~2GB RAM per host"],
        breaks:
          "A login flood saturates the workers, the queue grows and login p99 blows past 500ms. The pool sheds load with fast rejection rather than degrading everything, and the queue depth has to be tuned so a legitimate morning spike is not mistaken for an attack.",
        choice: {
          pick: "argon2id at 64MB, t=3, p=1, with a 16-byte per-user salt in a PHC string",
          instead: "Salted SHA-256, or bcrypt.",
          decider:
            "What a full exfiltration is worth to the attacker. A consumer GPU does ~20 GH/s of SHA-256, so 36^8 ≈ 2.8x10^12 eight-character passwords fall in ~140 seconds against every row at once. Argon2id is bounded by memory, so a 24GB card fits ~375 concurrent 64MB lanes at ~75ms, about 5k guesses/s, and the same space takes ~18 years. A 4-million-fold difference bought with 75ms per login.",
          flips:
            "bcrypt is the acceptable older option where argon2id is unavailable, with its 72-byte input truncation as a real gotcha. Plain SHA-256, even salted, is not acceptable at any scale.",
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
        numbers: ["~200ms of browser ceremony for WebAuthn", "~30% of users enrolled, ~1.3 factors each"],
        breaks:
          "TOTP is a shared secret in a 30 second window, so a real-time proxy phishing page relays the six digits and completes the login. The user did everything right and the attacker still gets a session.",
        choice: {
          pick: "WebAuthn as the strong tier, TOTP secrets stored encrypted under a KMS key",
          instead: "TOTP or SMS codes alone.",
          decider:
            "Phishing resistance, which TOTP does not have. WebAuthn signs a challenge bound to the origin, so a signature produced for a lookalike domain is worthless at the real one and there is no secret for the user to hand over. Track the phishing-resistant share of ~1.3 factors per enrolled user as a security metric, because moving users off TOTP is the single largest risk reduction available.",
          flips:
            "TOTP stays as the fallback tier for users without an authenticator, and recovery codes exist for both. Recovery codes are passwords again, so hash them with the same KDF and burn each on use.",
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
        why: "This is where the long-lived authority is moved off the request path. Every use of a refresh token invalidates it and issues a successor in the same family, so a second presentation of a superseded token proves two parties hold the lineage and the safe response is to kill the whole family.",
        numbers: ["~25ms, dominated by two signatures", "~1.7k/s average refreshes, ~5k/s peak", "~450B per Ed25519 token on the wire"],
        breaks:
          "Honest clients on flaky networks look exactly like theft: the response is lost, the client retries the same token, and naive reuse detection logs out an innocent user. A ~10s idempotent grace window returning the same rotated pair is the fix.",
        choice: {
          pick: "Ed25519 (EdDSA) access tokens with a 10 minute TTL and a rotating opaque refresh token",
          instead: "RS256 tokens, or a long-lived access token with no refresh at all.",
          decider:
            "Header bytes and the revocation window together. At 500k/s an RS256 JWT is ~800B and ~3.2 Gbps of pure Authorization header; Ed25519 cuts the signature from 256B to 64B and the token to ~450B, about ~1.8 Gbps. The 10 minute TTL turns 500k/s of revocation checking into ~1.7k/s of refresh lookups, a 300x reduction, and bounds staleness at 10 minutes.",
          flips:
            "Drop to a 60 second TTL when the business will not tolerate 10 minutes and you would rather have no pushed denylist at all. Refresh writes go from ~1.7k/s to ~17k/s average and ~50k/s peak, which an in-memory store absorbs, and you lose a distributed-state dependency in exchange.",
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
        numbers: ["~500M identities, ~600B each, ~300GB", "~900GB at RF=3", "~24GB unique index on email_hash"],
        breaks:
          "Primary failure stops registration, password change and MFA enrolment. Reads keep serving from replicas so logins and refreshes are unaffected, which means the outage is invisible on the busy path and easy to under-alert.",
        choice: {
          pick: "PostgreSQL with read-local replicas and write-global to the home region",
          instead: "A wide-column store such as Cassandra or DynamoDB.",
          decider:
            "Write rate against constraint enforcement. 500M rows at ~300GB is one machine's worth of data and the writes are ~5k/s of reads with a trickle of registrations, so nothing here needs horizontal write scaling. What it does need is a unique index on email_hash and referential integrity to MFA factors, which a wide-column store makes the application's problem.",
          flips:
            "When identity records genuinely outgrow one primary, or when per-region residency rules force partitioning by jurisdiction rather than replication, at which point the sharding is a legal constraint rather than a capacity one.",
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
        numbers: ["~150M live sessions, ~200B each, ~30GB", "~10k writes/s peak counting rotations", "~350 live denylist entries ≈ 14KB"],
        breaks:
          "A shard loss drops refresh tokens and denylist entries for that key range. Users on that shard re-authenticate, which is degraded rather than broken, and the denylist is rebuilt by replaying the last TTL window from the audit log.",
        choice: {
          pick: "Redis Cluster, sharded by user_id, with tokens stored as SHA-256 hashes",
          instead: "Refresh tokens in the identity database, or self-contained signed refresh tokens.",
          decider:
            "Write rate and access shape. ~10k writes/s of rotation against ~150M keys with TTLs is a workload a relational primary would carry badly and an in-memory store handles as its native case. SHA-256 rather than argon2id is correct here because these are 256-bit random values, not guessable secrets, so the KDF argument does not apply and the 75ms cost would be pure waste.",
          flips:
            "A deployment small enough that session count fits comfortably in the identity database, where one fewer stateful system to operate is worth more than the write headroom you are not using.",
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
        numbers: ["rotation every 90 days", "~1 hour overlap window per rotation"],
        breaks:
          "Rotation needs an overlap in both directions: publish K2 and wait a full JWKS cache TTL plus margin before signing with it, and keep K1 published for at least one access-token lifetime after. Emergency rotation collapses that window deliberately and eats a wave of 401s.",
        choice: {
          pick: "AWS KMS or a CloudHSM holding the private key, with the service requesting signatures",
          instead: "Signing keys in application config or a secrets manager, loaded into process memory.",
          decider:
            "What a host compromise yields. A key in process memory is exfiltrated with the host, and it mints valid tokens for all 500M identities at every service until the kid is retired, which is the one failure with unbounded blast radius. Hardware custody caps the loss at the signing rate the attacker can drive through an audited API, ~5k/s, and leaves a log.",
          flips:
            "Development and small deployments where the operational cost and per-signature latency of a KMS round trip outweigh a threat model that does not include host compromise.",
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
        numbers: ["refreshed every 5 minutes, jittered", "retired keys kept published ≥ 10 min (one token lifetime)"],
        breaks:
          "A region restarting after a deploy sends thousands of simultaneous fetches, and a cold cache with an unreachable endpoint means 401 everywhere. Never expire the cache hard, serve stale, and bake a bootstrap key set into the image.",
        choice: {
          pick: "CDN with long stale-while-revalidate, jittered 5 minute refresh, bootstrap keys in the image",
          instead: "Serving JWKS directly from the auth service with a plain TTL cache.",
          decider:
            "Behaviour on a cold cache, which fails closed by construction. Keys are a few hundred bytes and change every 90 days, so the request is perfectly cacheable, and thousands of instances restarting together would otherwise stampede the one service the platform cannot lose. Serving stale is always safe because a retired key's tokens have already expired.",
          flips:
            "Nothing sensible flips this at scale. A single-service deployment can read the key from local config, at which point there is no distribution problem to solve.",
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
        why: "This is revocation bought as a push rather than a lookup. It is the only mechanism that closes the window between a revocation and the access token's expiry, and it exists precisely because the alternative costs a network call on all 500k verifications a second.",
        numbers: ["~0.6 revocations/s, ~350 live entries, ~14KB", "propagation p99 < 1s, hard alert above 60s"],
        breaks:
          "It fails open by design, so a partitioned verifier keeps honouring revoked tokens against a stale set and nothing in the request path notices. The one mechanism for cases that cannot wait for the TTL is the mechanism that stops working first, and only a per-verifier lag gauge sees it.",
        choice: {
          pick: "Push ~14KB of denylist into every verifier's memory over pub/sub",
          instead: "Have each verifier look the jti up in Redis on every request.",
          decider:
            "The arithmetic settles it decisively for identical correctness. An entry only has to outlive an unexpired access token, so at ~0.6 revocations/s and a 600s TTL the live set is ~350 entries and ~14KB. As a lookup it is 500k GETs/s, ~5 shards at ~100k ops/s, ~15 nodes at RF=3, and ~0.5ms added to every request on the platform.",
          flips:
            "Drop the feed entirely and run TTL-only when you can afford a 60 second access token instead. TTL and denylist are substitutes, not complements, and TTL-only has one fewer distributed dependency and one fewer silent failure mode.",
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
        why: "The verification path has no miss. Unlike a CDN edge, there is no origin to fall back to, because the fallback would be exactly the 500k/s call the design exists to avoid, so everything it needs must already be in memory.",
        numbers: ["~500k/s, ~40µs per verify", "~20 cores across the whole fleet", "p99 < 1ms with zero network calls"],
        breaks:
          "Library-level algorithm confusion: a token claiming alg none, or an HS256 token signed with your published RSA public key. The verifier must pin the algorithm and reject unknown kids rather than trusting the header.",
        choice: {
          pick: "Local in-process verification against a cached JWKS key",
          instead: "Opaque tokens with a synchronous /introspect call to the auth service on every request.",
          decider:
            "The 100x ratio, 500k verifications/s against 5k logins/s. Local verify is ~40µs and ~20 cores fleet-wide. Introspection at 500k/s is ~250 additional auth instances at ~2k rps each, ~1ms on every API call, and a hard synchronous dependency of everything on a service that previously handled 1% of that traffic. It is not wrong on correctness, it is unaffordable at this ratio.",
          flips:
            "When verification sits within ~10x of login volume rather than 100x, which describes an internal admin platform or a B2B API at a few thousand rps. It also wins per audience regardless of scale: opaque tokens with introspection for third-party clients, where you want a real kill switch and per-client quotas anyway.",
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
        why: "The token proves who and the resource service decides what. Baking permissions into the token makes a role downgrade invisible until expiry and inflates every request, so the token carries at most one or two coarse role claims and the real decision happens here.",
        numbers: ["~1µs against a cached role set", "~3.2 Gbps of headers avoided by not embedding permissions"],
        breaks:
          "A contractor downgraded from admin to viewer mid-session keeps the old claim if you embedded it. With the check here the downgrade takes effect on the next request, which is the whole reason it lives here.",
        choice: {
          pick: "RBAC behind a policy interface so the evaluator can be swapped",
          instead: "Relationship-based authorization in the Zanzibar shape, with tuples such as doc:42#viewer@user:alice.",
          decider:
            "Whether you can enumerate the permission set at the moment a role is assigned. If one user sharing a document with another mints a new permission edge, you cannot, and RBAC degenerates into dynamically created roles that never terminate. Cost difference: an RBAC check is sub-microsecond against a cached set; a relationship check is 3 to 5 hops and ~5 to 20ms uncached, and a page listing 50 objects becomes 50 checks unless batched.",
          flips:
            "When permission genuinely lives in a graph: document sharing, folder inheritance, org hierarchies. It is the right answer there rather than a luxury, but it brings a denormalised reverse index, a consistency token so a user who just shared does not see a stale denial, and an operational surface roughly the size of this auth service.",
        },
      },
    }
  ],
  edges: [
    {
      id: "e1",
      from: "client",
      to: "auth-service",
      tier: "hot",
      label: "1. login (5k/s)",
      detail: {
        what: "The browser redirected to /authorize with client_id, redirect_uri, scope, state, nonce and a code_challenge, followed by the credential POST.",
        why: "The front channel carries only the challenge, never the verifier, so an attacker who steals the code off the redirect cannot redeem it. state is a separate defence for a separate attack, login-CSRF, and nonce a third, id_token replay.",
        numbers: ["~5k/s peak", "/authorize ~15ms, credential POST ~120ms"],
        breaks:
          "A malicious app can register the same custom URL scheme on a phone and codes leak through referrer headers, which is exactly why the redirect is not allowed to carry anything redeemable on its own.",
      },
    },
    {
      id: "e2",
      from: "auth-service",
      to: "identity-db",
      tier: "hot",
      label: "email_hash lookup",
      detail: {
        what: "Resolving the identity row by a hash of the normalised email, reading the stored credential hash, kdf_params, status and tokens_valid_after.",
        why: "The lookup is indexed on email_hash rather than the email itself so the hot index stays fixed-width and the plaintext address is not the join key. Everything the login decision needs comes back in one read.",
        numbers: ["~2ms", "~24GB unique index over 500M rows"],
        breaks:
          "Skipping the hash when the email does not exist leaks account existence through response time, which is why the argon2id comparison runs against a dummy hash regardless.",
      },
    },
    {
      id: "e3",
      from: "auth-service",
      to: "hashing-pool",
      tier: "hot",
      label: "argon2id 75ms / 64MB",
      detail: {
        what: "The submitted password handed to the isolated pool for a memory-hard comparison against the stored hash.",
        why: "This is where the login path spends almost all of its machine time and all of its CPU budget, deliberately. The cost is the feature: it is what removes the GPU's advantage against a stolen dump.",
        numbers: ["~75-100ms of the ~120ms credential POST", "~375 cores at 5k logins/s"],
        breaks:
          "Rate limiting must sit before this arrow, not after it. 200k stuffing attempts at 75ms each is ~4 CPU-hours you are being made to spend, which is the amplification the pool exists to contain.",
      },
    },
    {
      id: "e4",
      from: "hashing-pool",
      to: "mfa",
      tier: "hot",
      label: "password verified",
      detail: {
        what: "A successful credential comparison escalating to the second factor rather than issuing anything.",
        why: "The password is treated as breached until a second factor says otherwise, so this hop always happens for enrolled users and happens on device mismatch even when the password is correct.",
        numbers: ["~200ms of WebAuthn ceremony", "human TOTP entry (~15s) excluded from the SLO"],
        breaks:
          "A user with no factor enrolled skips straight through, so the enrolled share, currently ~30%, is the real ceiling on what this step protects.",
      },
    },
    {
      id: "e5",
      from: "mfa",
      to: "token-mint",
      tier: "hot",
      label: "one-time code, 60s TTL",
      detail: {
        what: "A one-time authorization code stored with the code_challenge, then redeemed on the back channel with the raw code_verifier.",
        why: "The split between front channel and back channel is the whole point of the flow. The code travels somewhere observable; the verifier that makes it redeemable does not.",
        numbers: ["60s TTL", "~300k unredeemed codes in flight at peak"],
        breaks:
          "A second presentation of the same code must fail and should revoke everything issued from it, because a replay means the code leaked.",
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
        why: "Two signatures dominate the ~25ms token exchange, and this is the one operation in the system whose compromise cannot be detected downstream, so the key stays in hardware custody with an access log.",
        numbers: ["~25ms for the exchange, dominated by two signatures", "~5k signings/s at peak"],
        breaks:
          "An anomalous issuance rate here is the only early signal of key misuse, because a token signed with the real key is indistinguishable from a legitimate one at every verifier.",
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
        why: "This is the one lookup the design keeps: once per session per 10 minutes rather than once per request, which is ~1.7k/s instead of ~500k/s. Rotation is what makes reuse detectable at all.",
        numbers: ["~1.7k/s average, ~5k/s peak", "~10k writes/s counting both paths", "SHA-256, not argon2id"],
        breaks:
          "Every refresh is a write, so halving the access-token TTL doubles this rate. That dial is the explicit trade between revocation latency and store load.",
      },
    },
    {
      id: "e8",
      from: "token-mint",
      to: "client",
      fromSide: "left",
      toSide: "left",
      tier: "hot",
      label: "access + id + refresh",
      offset: 90,
      detail: {
        what: "Three artefacts returned on the back channel: a ~10 minute access JWT, an OIDC id_token for the client, and an opaque rotating refresh token.",
        why: "They are separate because they answer separate questions. The access token is a cached authorization decision copied everywhere, the id_token is an identity assertion for the client, and the refresh token is the only recallable thing in the set.",
        numbers: ["expires_in: 600", "~450B per Ed25519 access token"],
        breaks:
          "Where the client puts them decides the blast radius of one XSS. localStorage is readable by any injected script and is a permanent exfiltration; an httpOnly Secure SameSite cookie stops the token walking away, without stopping script acting as the user in place.",
      },
    },
    {
      id: "e9",
      from: "client",
      to: "resource-services",
      tier: "hot",
      label: "2. bearer (500k/s)",
      detail: {
        what: "Every authenticated API call on the platform, carrying Authorization: Bearer and nothing else the verifier needs.",
        why: "This is the arrow the whole design is sized for. It is 100x the login arrow and it terminates locally, which is the only reason the auth service can be a 5k/s service instead of a 500k/s one.",
        numbers: ["~500k/s peak", "~40µs verify, zero network calls", "~1.8 Gbps of Authorization header"],
        breaks:
          "It carries a bearer credential, so anyone holding the string is the user from any machine on earth. Sender-constraining with DPoP or mTLS is the real fix and is not in the baseline, because it needs client-side key handling in every SDK.",
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
        numbers: ["90 day rotation cadence", "~1 hour total overlap window"],
        breaks:
          "Retiring a kid too early makes every in-flight token signed with it unverifiable, so a key stays published for at least one full access-token lifetime after its last signature.",
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
        numbers: ["~0.6 revocations/s", "p99 propagation < 1s"],
        breaks:
          "If the publish is not tied to the write, a revocation can be durably stored and never delivered, which reads as success everywhere and is a silent security failure.",
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
        why: "It kills every token a user holds with one 8-byte write, which is what log-out-everywhere actually needs. A jti denylist can only name tokens you know about; this names all of them.",
        numbers: ["8 bytes per user", "default 0, cached aggressively at the verifier"],
        breaks:
          "It is a per-user lookup on the hot path unless it is cached, and a cache miss on a user with no bump is the common case, so the default has to be free rather than a fetch.",
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
        numbers: ["refreshed every 5 minutes"],
        breaks:
          "This path fails closed. A verifier that cannot resolve a kid rejects every request, which is why the cache serves stale indefinitely and a bootstrap set ships in the image.",
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
        numbers: ["~14KB replicated everywhere", "~15 store nodes avoided", "~0.5ms saved on every request"],
        breaks:
          "This path fails open, deliberately, because failing closed turns a feed partition into a total platform outage. The cost is that the revocation guarantee lapses silently and degrades to the 10 minute TTL.",
      },
    },
    {
      id: "e15",
      from: "resource-services",
      to: "policy-engine",
      tier: "hot",
      label: "may subject do action?",
      detail: {
        what: "The authorization check itself, run at the resource service against a cached role and permission set once the token has been verified.",
        why: "Authentication and authorization are separated on purpose: the token is a cached identity claim minted minutes ago, while permissions change during a session and must be read fresh enough to notice.",
        numbers: ["~1µs against a cached role set", "at most 1 to 2 coarse role claims in the token"],
        breaks:
          "Bounded staleness is fine for reading a dashboard and not fine for a wire transfer. High-consequence boundaries need a synchronous check that does not inherit the feed's fail-open default, and sorting actions between the two paths is done by hand.",
      },
    }
  ],
};
