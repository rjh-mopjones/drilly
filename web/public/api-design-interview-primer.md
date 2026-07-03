---
type: interview-prep
---

# API Design Interview Primer — 334 Questions

Comprehensive Q+A primer for API-design interviews. A System Fundamentals companion to the System Design and Networking primers — focused on **designing good web/service APIs**: the contract, the shapes, and the tradeoffs, not network protocols or distributed-systems architecture. Covers REST & resource modeling, HTTP semantics, request/response & error design, pagination, versioning & evolution, auth (OAuth/OIDC/JWT), rate limiting, idempotency, GraphQL, gRPC, async & event-driven APIs, gateways, OpenAPI contracts, API security (OWASP API Top 10), caching, webhooks, style selection, governance/DX, and design playbooks.

Each answer is interview-shaped: opinionated, concrete, with real HTTP request/response examples, JSON payloads, OpenAPI/GraphQL/protobuf snippets, sequence diagrams, and good-vs-bad endpoint comparisons. Comparison tables throughout (REST vs GraphQL vs gRPC, PUT vs PATCH vs POST, offset vs cursor pagination, API-key vs OAuth vs JWT, rate-limit algorithms). Warm-up ("what makes a good REST API", "which status code") to senior ("design an idempotent payment API", "version a public API without breaking clients", "design a webhook delivery system").

1. [[#API Design Fundamentals & Principles]]
2. [[#REST & Resource Modeling]]
3. [[#HTTP Semantics for APIs]]
4. [[#Request & Response Design]]
5. [[#Error Handling & Status Codes]]
6. [[#Pagination, Filtering & Sorting]]
7. [[#API Versioning & Evolution]]
8. [[#Authentication & Authorization]]
9. [[#Rate Limiting & Throttling]]
10. [[#Idempotency & Reliability]]
11. [[#GraphQL]]
12. [[#gRPC & RPC APIs]]
13. [[#Async & Event-Driven APIs]]
14. [[#API Gateways & Management]]
15. [[#API Documentation & Contracts]]
16. [[#API Security]]
17. [[#Performance & Caching]]
18. [[#Webhooks & Callbacks]]
19. [[#API Styles Compared & When to Use]]
20. [[#API Governance, Lifecycle & DX]]
21. [[#Scenario & Design Playbooks]]

## API Design Fundamentals & Principles

### Summary

**What this topic covers**

This is the "why before the how" of API design. Before you argue REST vs GraphQL or debate status codes, you need a mental frame for what an API actually *is* and who you're serving. Three concern areas live here: (1) the **API as a contract** — a promise about shapes, behaviours, and stability that other people's code depends on, plus the **API as a product** whose users are developers; (2) the **quality attributes** that make an API good — developer experience (DX), consistency, the principle of least astonishment, right-sized abstraction, and loose coupling that hides your internal models; and (3) the **evolution mindset** — designing for change from day one via Postel's law, tolerant readers, and API-first workflows so you can grow without breaking the clients you already have. The 16 questions here are foundational: everything in the REST, HTTP, versioning, errors, and security topics is a concrete application of these principles. Get these right and the rest is detail; get them wrong and no amount of clever endpoint naming saves you.

**Mental model**

Think of an API as a **contract between two teams who never meet**. On one side is you, the producer, free to rewrite your internals whenever you like. On the other side is a developer — maybe in your company, maybe a stranger — who wrote code against the shapes you published and went home. The contract is the set of guarantees that lets their code keep working while your code changes underneath. That framing forces three habits. First, **treat the API surface as separate from your implementation**: your database tables, your class names, your enum values are yours; the API is a deliberate projection you chose, not a leak of internals. Second, **optimize for the reader, not the writer**: an API is used far more than it is written, so consistency and predictability beat cleverness — a developer should be able to guess the next endpoint from the last one (least astonishment). Third, **assume you are wrong about the future**: requirements will change, so design so that additive change is cheap and breaking change is rare. The senior instinct is to see every design choice as a promise you'll have to keep for years.

**Key terms**

- **Contract** — the stable set of guarantees (endpoints, shapes, semantics, errors) clients depend on; changing it silently breaks them.
- **Developer experience (DX)** — how fast and painlessly a developer can go from docs to a working integration; the real product metric of an API.
- **Least astonishment** — the API behaves the way a reasonable developer would predict; surprises are bugs even when documented.
- **Consistency** — same concepts named, shaped, paginated, and errored the same way everywhere; local surprises cost global trust.
- **Abstraction** — exposing intent (`POST /v1/orders`) rather than mechanism (which table, which service); the right altitude hides churn.
- **Coupling** — how much a client must know about your internals; low coupling lets you change freely.
- **Internal model leakage** — exposing DB columns, ORM entities, or enum ints directly, so refactors become breaking changes.
- **Postel's law** — "be conservative in what you send, liberal in what you accept"; underpins tolerant readers and forward compatibility.
- **Tolerant reader** — a client that ignores unknown fields and doesn't over-validate, so producers can add fields safely.
- **Public vs partner vs internal API** — audiences with very different stability, auth, and support obligations.
- **Evolvability** — the property that you can grow the API without breaking existing clients.
- **API-first** — design and agree the contract (e.g. OpenAPI) before writing implementation code.

**Why interviewers ask this**

These questions separate people who *implement* endpoints from people who *design systems other people build on*. A junior answer describes mechanics ("an API is a URL you call"). A senior answer talks about the API as a durable contract and a product, weighs DX against implementation convenience, and instinctively reaches for "how will this change in two years?" Interviewers probe whether you understand that the hardest part of API design is not the first version — it's the tenth version that must still serve the first version's clients. They also listen for audience awareness: a candidate who designs a public API the same way they'd design an internal one hasn't internalized that a public contract is nearly un-retractable. The tell for seniority is talking about coupling, evolvability, and least astonishment unprompted, and treating internal-model leakage as a design smell rather than a shortcut.

**Common confusions**

- "The API is just my database over HTTP" — that couples every schema change to every client. The API is a *deliberate projection*, designed for consumers, not a dump of your tables.
- "Consistency is cosmetic" — inconsistency is a real cost: every surprise forces the developer back to the docs and erodes trust in the whole surface.
- "Postel's law means accept anything" — be *tolerant* of unknown fields and lenient input, but still validate what you actually use; blindly accepting garbage causes silent corruption. Modern practice tempers Postel's law with strict-enough validation on security-critical fields.
- "Good docs fix a bad API" — docs are a patch over surprises. A well-designed API needs fewer docs because it's predictable.
- "Public, partner, and internal APIs are the same job" — they differ hugely in stability guarantees, auth, versioning discipline, and how freely you can break them.
- "API-first slows us down" — agreeing the contract first parallelizes client and server work and prevents expensive rework; it usually speeds delivery.

**What follows from this topic**

Everything downstream is these principles made concrete. "The API is a contract" becomes the versioning-and-evolution topic (breaking vs non-breaking changes, deprecation, `Sunset`). "Least astonishment and consistency" become REST resource modeling and HTTP semantics — predictable nouns, predictable methods, predictable status codes. "Hide internal models" becomes request/response design (DTOs, envelopes, avoiding mass-assignment) and the OWASP API security topic (excessive data exposure). "DX as the product" becomes the docs/OpenAPI, errors, and SDK topics. Treat this topic as the value system the later topics operationalize.

### Q1. What makes an API "good"? Name the qualities you'd optimize for.

A good API is **predictable, consistent, well-documented, hard to misuse, and evolvable**. In priority order I optimize for:

- **Consistency / least astonishment** — same patterns for naming, pagination, errors, and auth everywhere, so a developer can guess the next call from the last one.
- **Developer experience** — time-to-first-successful-call is short; the happy path is obvious; errors tell you how to fix them.
- **Right abstraction** — endpoints express intent (`POST /v1/refunds`), not implementation (`/v1/run_refund_job`), and don't leak internal models.
- **Evolvability** — additive change is cheap; existing clients don't break when you add capability.
- **Robustness** — clear errors, idempotency where retries happen, sensible defaults, secure by default.

The unifying idea: an API is used far more than it's written, so I optimize for the *reader* and for *the version I'll ship in two years*, not for whatever is easiest to implement today.

### Q2. What do people mean by "an API is a contract"? Why does it matter?

A contract is a **promise about behaviour that other people's code depends on**. When you publish `GET /v1/orders/{id}` returning a JSON object with `id`, `status`, `total_cents`, some developer wrote code that reads those fields and shipped it. That code is now coupled to your promise.

It matters because it constrains what you can change unilaterally:

- **Non-breaking** (safe): add a new optional field, add a new endpoint, add a new enum value clients are told to tolerate.
- **Breaking** (needs a new version / migration): rename or remove a field, change a type (`total_cents` int → `total` string), tighten validation, change status-code semantics, change default behaviour.

The practical consequence: **you cannot un-ship a contract.** For a public API, a field you added in a hurry is now a promise you must honour for years. That's why senior engineers design the surface deliberately and separate it from internals — so implementation can churn while the contract holds. The contract is also why versioning, deprecation policy, and tolerant readers exist: they're the mechanisms for changing a promise without betraying the people who relied on it.

### Q3. What is "developer experience" (DX) and how do you design for it?

DX is **how fast and painlessly a developer goes from your docs to working, correct code** — and how rarely your API surprises them afterward. It's the actual product quality of an API, because your users are developers.

Concrete levers:

- **Fast time-to-first-call** — copy-pasteable examples, a working curl in the quickstart, sane defaults so the minimal request works.
- **Predictability** — consistent naming, pagination, and error shapes so learning one endpoint teaches all of them.
- **Great errors** — machine-readable codes plus human messages that say *what* was wrong and *how to fix it* (see the errors topic / RFC 7807), not a bare `400`.
- **Hard to misuse** — required fields validated up front, idempotency keys for unsafe retries, clear 4xx vs 5xx so clients know whether to retry.
- **Discoverability & docs** — OpenAPI-generated reference, examples, changelogs, and SDKs.

The mindset shift: treat every confusing field name, inconsistent plural, or opaque error as a *bug in the product*, not a documentation gap. If your support inbox keeps asking the same question, that's a DX defect.

### Q4. What is the principle of least astonishment in API design? Give an example.

It means the API should **behave the way a competent developer would predict** before reading the docs. Surprises are defects even when they're documented, because every surprise forces a trip back to the reference and chips away at trust in the whole surface.

Bad (astonishing):

```http
DELETE /v1/orders/123     → 200 OK, but actually only soft-flags the order,
                            and a later GET still returns it as active
```

Good (predictable):

```http
DELETE /v1/orders/123     → 204 No Content, and GET /v1/orders/123 → 404
POST   /v1/orders/123/cancellation   → 200, order.status = "cancelled"  (if you mean cancel, say cancel)
```

Other common astonishments to avoid: one endpoint paginates with `?page=`, another with `?cursor=`; `POST` sometimes returns the created object and sometimes just an id; the same concept is `userId` in one payload and `user_id` in another; an error returns `200` with an `error` field in the body. Consistency is how you deliver least astonishment at scale — pick a convention and never deviate without a reason the caller can see.

### Q5. What does "hiding internal models" mean, and why shouldn't the API mirror your database?

Hiding internal models means the API exposes a **deliberately designed shape (a DTO / resource representation)**, not your ORM entities, table columns, or internal enums. The API is a projection you choose, decoupled from storage.

Why it matters:

- **Refactors stay internal.** If clients read your table columns, renaming a column or splitting a table becomes a breaking API change. A DTO layer absorbs that churn.
- **Security.** Serializing the entity directly leaks fields you never meant to expose — `password_hash`, `internal_risk_score`, `is_admin` — this is OWASP API's *excessive data exposure*. Accepting the entity directly enables *mass assignment* (a client sets `is_admin: true`).
- **Clarity.** Internal names (`usr_flag_7`, integer status codes) are meaningless to consumers; a DTO uses intention-revealing names and string enums.

Bad:

```json
{ "usr_id": 42, "pwd_hash": "…", "flag7": 1, "created_ts": 1719792000 }
```

Good:

```json
{ "id": "usr_42", "email": "alice@example.com", "status": "active",
  "created_at": "2026-07-01T00:00:00Z" }
```

The rule: **an explicit mapping between internal model and API representation is a feature, not overhead.** It's the seam that lets the two evolve independently.

### Q6. What is Postel's law (the robustness principle) and how does it apply to APIs? Does it still hold?

Postel's law: **"Be conservative in what you send, be liberal in what you accept."** For APIs it means: as a producer, emit clean, well-formed, spec-compliant responses; as a consumer, don't fall over on unexpected-but-harmless input — ignore unknown fields, tolerate new enum values, don't over-validate.

Applied:

- **Producers** keep responses stable and add fields additively.
- **Consumers** are **tolerant readers**: they parse the fields they need and ignore the rest, so when you add `loyalty_tier` to the order response, old clients don't break.

The tolerant-reader half is what makes additive evolution possible and is the practical heart of forward compatibility.

The caveat — and interviewers love this nuance — is that **strict Postel's law has fallen out of favour for security- and correctness-critical input.** Being too liberal in what you accept causes ambiguity, interop bugs, and injection/smuggling attacks (two servers "helpfully" interpreting malformed input differently). Modern guidance: **be a tolerant reader for forward compatibility (ignore unknown fields), but validate strictly the fields you actually act on.** Liberal about additions, strict about correctness.

### Q7. How do public, partner, and internal APIs differ in how you design them?

The audience changes your stability, auth, and support obligations dramatically.

| Aspect | Internal | Partner | Public |
|---|---|---|---|
| Consumers | Your own teams | A known, contracted set | Anyone |
| Breaking changes | Cheap — coordinate + redeploy | Negotiated, scheduled | Nearly impossible; long deprecation |
| Auth | mTLS / service tokens | API keys + scoped OAuth, IP allowlists | OAuth/keys, strict rate limits |
| Versioning discipline | Light | Moderate | Rigorous, long-lived |
| Docs / support | README / tribal | Onboarding + SLA | Full portal, SDKs, changelog |
| Data exposure | Can be looser | Scoped per partner | Minimal, carefully reviewed |

The key insight: **the more anonymous and numerous your consumers, the less you can ever change and the more the contract is set in stone.** An internal API can be refactored on a Slack message; a public API field is a decade-long promise. Many teams also expose the *same* capability through different surfaces (a chatty internal gRPC service behind a curated public REST API via a gateway/BFF), precisely because the design constraints differ.

### Q8. What does "designing for evolvability" mean in practice?

It means shaping the first version so that **the changes you can't predict will be additive, not breaking**. You bake in room to grow.

Concrete techniques:

- **Additive-by-default shapes** — objects/envelopes you can add fields to, not fixed positional arrays. `{ "data": {…} }` can grow; a bare top-level array or scalar can't hold metadata later.
- **Tolerant-reader contract** — document that clients must ignore unknown fields and unrecognized enum values, so you can add both safely.
- **Extensible enums** — treat enums as open; tell clients to handle an unknown value gracefully rather than crash.
- **Envelope pagination from day one** — `{ "data": [...], "next_cursor": "..." }` even when there's one page, so you don't break clients when data grows.
- **Version namespace** — ship under `/v1` so a genuinely breaking redesign has somewhere to live.
- **Avoid over-committing** — don't expose fields, statuses, or behaviours you're not sure you'll keep; every exposed detail is a promise.

The mental test for any change: *"Would a client written against the previous version still work unchanged?"* If yes, it's evolvable growth. If no, it needs a version or a migration. Designing for evolvability is designing so the answer is "yes" as often as possible.

### Q9. What is API-first design and why do teams adopt it?

API-first means you **design and agree the contract before writing implementation** — typically by authoring an OpenAPI (or GraphQL SDL / protobuf) spec, reviewing it with consumers, and only then building server and clients against it.

Why teams do it:

- **Parallel work** — once the contract is frozen, frontend/mobile/partner teams build against a mock server while the backend implements; nobody waits.
- **Better design** — writing the spec first forces you to think about the consumer's experience before implementation convenience biases you.
- **Single source of truth** — the spec generates docs, server stubs, client SDKs, mock servers, and contract tests, keeping them all in sync.
- **Fewer expensive reworks** — design disagreements surface in a cheap spec review, not after both sides have shipped incompatible code.

Contrast with **code-first**, where you write handlers and generate the spec from annotations afterward. Code-first is lower-friction for internal APIs and keeps the spec honest to the implementation, but tends to leak internal models and produce inconsistent surfaces because the API shape is a byproduct rather than a decision. For public and partner APIs, API-first (or "design-first") is the default because the contract is the product.

### Q10. Design a bad endpoint and then fix it. What principles did you apply?

Here's an endpoint that violates several principles at once:

```http
GET /v1/getUserOrdersByStatus?uid=42&s=1&admin=true
→ 200 OK
{ "err": 0, "usr_flag": 7, "pwd_hash": "…", "orders": [...] }
```

Problems: RPC-ish verb in the path (`getUserOrders...`), abbreviations (`uid`, `s`), a magic integer status, a client-supplied `admin=true` (mass-assignment / broken authz), errors signaled with `200` + `err:0`, and internal fields leaked (`usr_flag`, `pwd_hash`).

Fixed:

```http
GET /v1/users/usr_42/orders?status=paid
Authorization: Bearer <token>
→ 200 OK
{
  "data": [ { "id": "ord_9", "status": "paid", "total_cents": 4200 } ],
  "next_cursor": null
}
```

Principles applied: **resources as nouns** (`/users/{id}/orders`), **HTTP method as the verb** (`GET`, not `getX`), **least astonishment** (plural collection, string enum, envelope with pagination), **authz from the token, not a query param**, **hide internal models** (no `pwd_hash`/flags), and **errors via status codes**, not a body flag. Each fix maps to a fundamental: consistency, DX, security, and evolvability.

### Q11. How do abstraction and coupling shape where you draw the API boundary?

The boundary decision is: **how much should a client have to know about your internals to use the API?** Less is better — that's low coupling — and abstraction is the tool that buys it.

Draw the boundary at **intent, not mechanism**. `POST /v1/payments` says what the caller wants; it hides whether you use Stripe or Adyen, one table or three, sync or a queued job. If instead you expose `POST /v1/insert_payment_row` or force the client to first call `/reserve`, then `/charge`, then `/commit`, you've coupled them to your implementation and every internal change ripples outward.

Two failure modes:

- **Too low-level (leaky):** the API mirrors internal steps/tables; clients orchestrate your workflow; you can't refactor.
- **Too high-level (lossy):** one god-endpoint that hides so much the client can't express what it needs, forcing query-param sprawl.

Right-sized abstraction exposes the **domain concepts the consumer thinks in** (orders, refunds, subscriptions) at a granularity that lets them accomplish real tasks without knowing your plumbing. The test: *can I completely rewrite the implementation behind this endpoint without any client noticing?* If yes, the abstraction is at the right altitude and coupling is low.

### Q12. Why treat an API as a product, and what changes when you do?

Treating an API as a product means its **users are developers, its value is measured by their success, and it needs the lifecycle a product gets** — onboarding, versioning, deprecation, support, and metrics — not just a code endpoint you shipped once.

What changes:

- **You measure adoption and friction** — time-to-first-call, integration success rate, top support questions, error rates by endpoint — and treat bad numbers as product defects.
- **You invest in onboarding** — quickstarts, SDKs, sandboxes, sample apps — because activation matters.
- **You have a lifecycle** — a public changelog, a deprecation policy with `Sunset` headers and timelines, and backward-compatibility guarantees.
- **You do design review and governance** — style guides, linting (e.g. Spectral), and an API review board so the surface stays consistent as many teams add to it.
- **You listen to users** — the DX of the *tenth* endpoint should match the first because someone owns consistency.

The contrast is the "internal plumbing" mindset where an API is a side effect of building a service. Product thinking is what makes an API something developers *choose* to build on rather than tolerate.

### Q13. A client complains your API is "inconsistent." How do you diagnose and fix that?

Inconsistency is death-by-a-thous-cuts for DX: each small deviation forces the developer back to the docs. I'd audit the surface along the dimensions where consistency compounds:

- **Naming** — `userId` vs `user_id` vs `uid`; pick one case convention (snake_case or camelCase) and apply it everywhere.
- **Pluralization** — `/user/{id}` vs `/orders`; collections are always plural.
- **Pagination** — some endpoints `?page=`, others `?cursor=`; standardize one strategy and one envelope (`data` + `next_cursor`).
- **Error shape** — every error uses the same schema (RFC 7807-style code + message), never `200`-with-error-body in some places and `400` in others.
- **Date/ID/enum formats** — all timestamps ISO-8601 UTC, all IDs prefixed strings, all enums lowercase strings.
- **Verbs** — methods carry the action; no `/getX` or `/doY` in paths.

The fix at scale isn't just patching endpoints — it's **governance**: a written style guide, an automated linter (Spectral against the OpenAPI spec) in CI, and an API review step so new endpoints can't merge if they deviate. For the endpoints already inconsistent and in use, you can't just rename them (that's breaking) — you add the consistent version and deprecate the old one with a timeline. Consistency is cheaper to enforce from day one than to retrofit, which is the real lesson.

### Q14. When is it acceptable to break the contract, and how do you do it responsibly?

Sometimes you must break it — a security flaw in the shape, a legally required change, a design that's actively harmful. The goal isn't "never break," it's **never break clients silently or abruptly.**

Responsible breaking, in order:

1. **Prefer additive change** — can you achieve the goal by adding a new field/endpoint and leaving the old one working? Usually yes.
2. **If truly breaking, version it** — introduce `/v2` (or a new media type) and keep `/v1` running. Don't mutate `/v1` semantics under existing clients.
3. **Announce and instrument** — publish a changelog and migration guide, and measure who's still on the old path so you know the blast radius.
4. **Signal deprecation in-band** — `Deprecation: true` and a `Sunset: <date>` header on the old responses so clients (and their monitoring) see it.
5. **Give a real timeline** — public APIs get months to years; partner APIs get negotiated windows; internal APIs can be days with coordination.
6. **Only then remove**, ideally returning `410 Gone` for the retired resource so it's unambiguous.

The anti-pattern is the silent break: quietly changing a field's type or an endpoint's behaviour in place. It passes your tests and detonates in production for every client who trusted the contract. Break loudly, slowly, and with an escape hatch, or don't break at all.

### Q15. How do you decide the right granularity for resources and endpoints?

Granularity is a coupling/chattiness tradeoff. Too **fine-grained** (many tiny endpoints, or forcing several calls per task) makes clients chatty, slow over the network, and coupled to your workflow steps. Too **coarse-grained** (one mega-endpoint with dozens of flags) is hard to cache, hard to authorize, and astonishing to use.

Heuristics I use:

- **Model the consumer's tasks, not your tables.** Design endpoints around what a client is trying to *accomplish* (place an order, issue a refund), so a real task is one or few calls.
- **One resource, one concept.** A resource should map to a noun the consumer reasons about, with a stable identity.
- **Push field-shaping into the representation, not new endpoints.** Instead of `/orders_summary` and `/orders_full`, use one `/orders` with sparse fieldsets/expansions (`?fields=`, `?expand=customer`).
- **Watch the round-trip count.** If a common screen needs five sequential calls, that's a granularity smell — consider a coarser resource, an expansion, or a BFF/aggregation layer.
- **Let audience decide.** Internal service-to-service can be finer-grained and chatty (cheap network); public/mobile APIs favour coarser, fewer round-trips.

The judgment call is balancing evolvability (fine-grained resources are easier to change independently) against DX and performance (coarse-grained is fewer, simpler calls). When in doubt, model the domain nouns and use field selection and expansions to serve different needs from the same resource.

### Q16. Two engineers disagree: one wants the API to exactly mirror the domain model, the other wants it shaped purely for the client. How do you resolve it?

Both are half right, and the answer is to **name the two forces and pick per-surface rather than dogmatically**.

- **Domain-mirroring** gives you a clean, coherent, general-purpose surface that many clients can share and that maps naturally to your services. Its risk is chattiness and leaking internal structure to consumers who don't care about it.
- **Client-shaping** gives great DX for a specific consumer (one screen, one call, exactly the fields it needs). Its risk is a bespoke, un-reusable surface that couples the API to one UI and multiplies as clients multiply.

Resolution: **keep a clean, domain-oriented, resource-based core API — and add client-shaped surfaces as a separate layer when a specific consumer needs it.** That layer is the **Backend-for-Frontend (BFF)** or a gateway that aggregates/reshapes the core resources for, say, the mobile app. The core stays reusable and evolvable; the BFF absorbs client-specific optimization and can change with the UI without polluting the shared contract.

The meta-point for the interviewer: don't resolve it by winning the argument, resolve it by recognizing they're optimizing different variables (reusability/evolvability vs per-client DX) and giving each its own layer. That's the same abstraction/coupling reasoning from the boundary question applied to team disagreement.

## REST & Resource Modeling

### Summary

**What this topic covers**

REST is the default architectural style for web APIs, and this topic is about using it *well* — not just slapping HTTP verbs on database rows. Three concern areas: (1) the **REST constraints themselves** — client-server, statelessness, cacheability, uniform interface, layered system — and what they actually buy you; (2) **resource modeling** — the core discipline of REST: identifying the right nouns, giving them URIs, using HTTP methods as the verbs, and expressing relationships as nested resources or links rather than as RPC-style actions; and (3) **the maturity spectrum** — the Richardson Maturity Model from level 0 (RPC-over-HTTP) through 3 (HATEOAS), why most real APIs sit at a pragmatic level 2, and when REST is the wrong tool entirely. The 16 questions here move from "what makes a URL RESTful" to "model this domain as resources" to "why is HATEOAS rarely fully implemented." This is where the fundamentals topic's principles (nouns, least astonishment, evolvability) become concrete URI and method choices.

**Mental model**

Stop thinking in *functions you're exposing* and start thinking in *nouns you're making addressable*. In RPC you'd write `getOrder`, `cancelOrder`, `refundOrder` — verbs. In REST you expose the **order** as a resource with a stable URI (`/v1/orders/ord_9`), and the HTTP methods supply the verbs: `GET` to read it, `DELETE` to remove it, `PATCH` to change it, and a sub-resource like `POST /v1/orders/ord_9/refunds` for actions that create something. The whole style is a **uniform interface**: a small fixed set of verbs (the HTTP methods) applied to an unbounded set of nouns (your resources), so clients already know *how* to act on any resource once they know its URI. The second pillar is **statelessness** — each request carries everything needed to process it (auth, parameters); the server keeps no per-client session between calls. That's what lets any server instance handle any request and makes horizontal scaling and caching tractable. Model the nouns, let HTTP be the verbs, keep the server stateless, and most "how should this endpoint look?" questions answer themselves.

**Key terms**

- **Resource** — any thing worth naming and addressing (an order, a user, a collection of orders); the noun REST is built around.
- **URI** — the stable identifier/address of a resource (`/v1/orders/ord_9`); it names the thing, not the action.
- **Uniform interface** — REST's constraint that a fixed, standard set of methods (HTTP verbs) applies to all resources.
- **Statelessness** — no server-side per-client session between requests; each request is self-contained (auth + params).
- **Collection vs singleton resource** — a set (`/orders`) vs a single instance (`/orders/ord_9`) or a per-owner singleton (`/users/me/settings`).
- **Nested / sub-resource** — a resource expressed under its parent to show a relationship (`/users/usr_42/orders`).
- **Richardson Maturity Model (RMM)** — a 0–3 ladder: L0 single endpoint/RPC, L1 resources, L2 HTTP verbs + status codes, L3 hypermedia (HATEOAS).
- **HATEOAS** — Hypermedia As The Engine Of Application State: responses include links telling the client what it can do next.
- **Cacheability** — the constraint that responses declare whether/how they can be cached (`GET` + `Cache-Control`/`ETag`).
- **Idempotent method** — repeating it has the same effect as doing it once (`GET`, `PUT`, `DELETE`); central to safe retries.
- **RPC-in-a-path** — the anti-pattern of putting verbs in URIs (`/createOrder`, `/orders/9/doCancel`).
- **Layered system** — clients can't tell if they're talking to the origin server or an intermediary (gateway, CDN, proxy).

**Why interviewers ask this**

REST modeling is the fastest way to tell whether a candidate designs APIs or just wraps functions in HTTP. Juniors produce verb-in-path endpoints (`/getUser`, `/order/cancel`), treat `POST` as the do-everything method, and can't explain statelessness beyond "no sessions." Seniors reach for nouns, know exactly which method and status code fits, model relationships as nested resources or links, and — crucially — know the *limits* of REST: they can articulate why HATEOAS is rarely fully built and when they'd choose gRPC or GraphQL instead. Interviewers also use "model an API for X" as a live design exercise: it reveals whether you can identify resources, choose collection-vs-singleton, handle actions that don't fit CRUD (cancel, refund, publish), and keep the surface consistent and evolvable. The Richardson Maturity Model question specifically probes whether you understand REST as a spectrum rather than a binary badge.

**Common confusions**

- "REST means JSON over HTTP" — no. Plenty of JSON-over-HTTP APIs are RPC (verbs in paths, one endpoint). REST is about resources, a uniform interface, and statelessness; the format is incidental.
- "Statelessness means the server stores nothing" — it stores *resource state* (your database) fine; what it doesn't keep is *per-client session/conversation state* between requests. Each request must be self-contained.
- "Every action must be pure CRUD" — some actions (cancel, publish, refund) don't map cleanly to a verb+noun. Model them as sub-resources (`POST /orders/9/cancellation`) or state transitions, not as `/doCancel`.
- "HATEOAS is required to be RESTful" — by Fielding's definition L3 hypermedia is the true bar, but almost no one implements it fully; pragmatic "REST" means L2. Know the gap and why.
- "Nesting resources arbitrarily deep is good" — deep nesting (`/a/1/b/2/c/3/d/4`) gets unusable; nest one level to show ownership, then link or use top-level resources with filters.
- "POST is only for creating" — POST is the catch-all non-idempotent method; it's also the right choice for actions and for creates where the server assigns the id. PUT (idempotent, client-known id / full replace) is different.

**What follows from this topic**

Resource modeling sets up the HTTP semantics topic directly: once you've chosen nouns, the next question is exactly which method (`GET`/`POST`/`PUT`/`PATCH`/`DELETE`) and which status code each operation returns, and whether it's safe/idempotent. Collections lead into the pagination/filtering/sorting topic (how you page and filter `/orders`). The "actions that don't fit CRUD" problem leads into request/response design and into async/long-running operations (`202` + status resource). The "when is REST wrong" thread leads into the GraphQL and gRPC topics. And statelessness underpins the auth topic (tokens carry identity per-request) and rate limiting. Treat REST as the backbone the rest of the primer hangs method-level detail onto.

### Q1. What is REST and what are its architectural constraints?

REST (Representational State Transfer) is an **architectural style** — a set of constraints Roy Fielding described — for building networked APIs, most commonly over HTTP. It's not a protocol or a standard; it's a way of using HTTP as intended. The constraints:

- **Client-server** — separate the UI/consumer from data storage/logic so they evolve independently.
- **Statelessness** — each request contains everything needed to process it; the server keeps no per-client session between requests.
- **Cacheability** — responses declare whether they're cacheable (`GET` + `Cache-Control`/`ETag`), so intermediaries and clients can reuse them.
- **Uniform interface** — a standard, fixed set of methods (HTTP verbs) applied to resources identified by URIs, with self-descriptive messages. This is the defining constraint.
- **Layered system** — a client can't tell whether it's talking to the origin or an intermediary (gateway, CDN, load balancer), enabling scaling and security layers.
- **Code-on-demand** (optional) — servers can send executable code (e.g. JS); rarely relevant for data APIs.

The practical payoff: because the interface is uniform and stateless, REST APIs scale horizontally, cache well, and are easy to reason about — any client that knows HTTP already knows how to talk to any RESTful resource.

### Q2. Why is statelessness a REST constraint, and what does it actually buy you?

Statelessness means **the server keeps no per-client session state between requests** — each request carries its own auth and context, so the server can process it without remembering the last one. Note it does *not* mean the server is stateless overall; your database (resource state) is fine. What's forbidden is conversational/session state on the server tied to a specific client across calls.

What it buys you:

- **Horizontal scalability** — any server instance can handle any request, because none of them hold client-specific memory. You can add/remove nodes and load-balance freely without sticky sessions.
- **Resilience** — if a node dies mid-traffic, the next request just goes elsewhere; there's no lost session to recover.
- **Cacheability** — a self-contained request/response is far easier for intermediaries to cache.
- **Simplicity** — no session expiry/replication logic across the fleet.

The cost is that each request re-sends context — auth token, parameters — which is why REST APIs carry credentials on every call (`Authorization: Bearer …`) rather than logging in once and relying on server memory. That's the trade: a little redundancy per request for enormous scaling and reliability gains.

### Q3. In REST, how do resources, URIs, and HTTP methods relate?

They're the three pieces of REST's uniform interface, and keeping their roles distinct is the whole discipline:

- **Resources are the nouns** — the things your API is about: orders, users, refunds, a collection of orders.
- **URIs identify (address) those resources** — `/v1/orders` is the collection, `/v1/orders/ord_9` is one order. The URI names the *thing*, never the *action*.
- **HTTP methods are the verbs** — the action you take on a resource comes from the method, not the path:

```http
GET    /v1/orders          # list orders
POST   /v1/orders          # create an order
GET    /v1/orders/ord_9    # read that order
PUT    /v1/orders/ord_9    # replace it
PATCH  /v1/orders/ord_9    # partially update it
DELETE /v1/orders/ord_9    # remove it
```

The elegance: a small fixed set of verbs applies to an unlimited set of nouns, so once a client understands HTTP, it understands how to act on *any* resource you expose. The anti-pattern is smuggling verbs into the path — `POST /v1/createOrder`, `GET /v1/getOrder?id=9`, `POST /v1/orders/9/doCancel` — which throws away the uniform interface and reduces REST to RPC. If you find yourself putting a verb in a URI, the fix is almost always "make the noun a resource and let the method be the verb."

### Q4. What is the Richardson Maturity Model? Walk through the levels.

The RMM is a **0–3 ladder describing how fully an API uses REST's mechanisms** — a useful diagnostic, not a compliance score.

- **Level 0 — The Swamp of POX (Plain Old XML/JSON).** One endpoint, one method; everything is `POST /api` with the action in the body. This is RPC tunneled over HTTP (SOAP-style). No resources, no HTTP semantics.
- **Level 1 — Resources.** You break the surface into multiple resources with their own URIs (`/orders/9`, `/users/42`) instead of one endpoint — but you still `POST` everything. You've adopted nouns.
- **Level 2 — HTTP verbs + status codes.** You use `GET`/`POST`/`PUT`/`PATCH`/`DELETE` with their proper semantics and return meaningful status codes (`201`, `404`, `409`). **This is where the vast majority of good "REST" APIs live** — Stripe, GitHub, etc., are essentially L2.
- **Level 3 — Hypermedia controls (HATEOAS).** Responses include links describing what the client can do next (`_links: { cancel: { href: "…" } }`), so the client navigates state transitions via server-provided links rather than hardcoded URLs.

The point of the model isn't "always reach L3." It's to have vocabulary for *how* RESTful something is. Most teams deliberately stop at L2 because L3's cost rarely pays off (next question).

### Q5. What is HATEOAS, and why is it rarely fully implemented?

HATEOAS (Hypermedia As The Engine Of Application State) is REST level 3: **responses embed links that tell the client which actions/transitions are available next**, so clients discover the API by following links rather than hardcoding URL templates.

```json
{
  "id": "ord_9",
  "status": "paid",
  "total_cents": 4200,
  "_links": {
    "self":   { "href": "/v1/orders/ord_9" },
    "refund": { "href": "/v1/orders/ord_9/refunds" },
    "cancel": { "href": "/v1/orders/ord_9/cancellation" }
  }
}
```

The theoretical appeal is real: clients become loosely coupled to URL structure (the server can move endpoints), and available actions are state-driven (a shipped order simply wouldn't include a `cancel` link).

Why almost nobody fully implements it:

- **Clients don't consume it that way.** Most SDKs and frontends hardcode URLs from docs and ignore embedded links, so the decoupling benefit never materializes.
- **No universal hypermedia standard** — HAL, JSON:API, Siren all compete; tooling is thin.
- **Added payload and complexity** for a benefit that requires a *generic* hypermedia client to realize, which is rare in practice.
- **Docs/OpenAPI already solve discovery** for how real teams build clients.

So most "REST" APIs are pragmatically L2, and this is an accepted, defensible choice. The senior answer isn't "HATEOAS is bad" — it's "HATEOAS is theoretically the true REST bar but rarely worth its cost given how clients are actually built; I'd use it selectively, e.g. for state-transition links or paging links, not as a whole-API mandate."

### Q6. Collections vs singleton resources — how do you model each?

A **collection** is a set of resources; a **singleton** (or item) is one. The conventions:

- **Collection:** plural noun, no id — `GET /v1/orders` (list), `POST /v1/orders` (create one, server assigns id). Supports pagination, filtering, sorting.
- **Item within a collection:** collection + id — `GET /v1/orders/ord_9`, `PUT`/`PATCH`/`DELETE` on the same URI.
- **Singleton resource:** a resource that has exactly one instance per context, so it needs no id — `GET /v1/users/usr_42/settings`, `PUT /v1/users/usr_42/settings`, or `GET /v1/users/me` for "the current user." There's no collection of settings under a user; there's just the one.

```http
GET    /v1/orders                 # collection
POST   /v1/orders                 # create item in collection
GET    /v1/orders/ord_9           # item
PATCH  /v1/users/usr_42/profile   # singleton sub-resource (one profile per user)
```

The decision rule: **is there naturally more than one under the parent?** More than one → collection with ids. Exactly one → singleton, no id. A common mistake is forcing an id onto something singular (`/users/42/settings/1`) or, conversely, treating a genuine collection as a singleton and cramming multiplicity into query flags. Pick the shape that matches the cardinality of the domain.

### Q7. How do you model relationships and nested resources? When should you NOT nest?

Relationships are expressed either by **nesting** (path hierarchy) or by **linking/referencing** (ids or URLs in the body). Nesting shows ownership/containment:

```http
GET  /v1/users/usr_42/orders          # orders belonging to a user
POST /v1/users/usr_42/orders          # create an order for that user
GET  /v1/orders/ord_9/line_items      # items within an order
```

Nesting is right when the child **belongs to** the parent and you rarely need it outside that context (an order's line items). But nesting has limits — **don't nest deeply** and don't force nesting when the child has its own identity:

- **Cap nesting at ~one level.** `/users/42/orders/9/items/3/refunds/2` is unusable and couples clients to the whole hierarchy. Once past one level, expose the child as a top-level resource: `GET /v1/orders/ord_9` directly, or `GET /v1/refunds/ref_2`.
- **If the child is independently addressable, give it a top-level collection** and reference the parent by id or filter: `GET /v1/orders?user_id=usr_42` instead of (or alongside) `/users/42/orders`.
- **Many-to-many** relationships are usually better as a top-level resource or a link, not nesting.

Rule of thumb: **nest to express clear ownership one level deep; link (by id/URL) or filter for everything else.** This keeps URIs short, resources independently retrievable, and the API evolvable — a resource with its own top-level URI can change owners without breaking its address.

### Q8. Why plural nouns for collections, and what naming conventions matter?

**Plural** because a collection *is* plural — `/orders` reads naturally as "the orders," and `/orders/ord_9` as "order ord_9 within orders." Mixing `/order/9` and `/orders` on the same API is an inconsistency that violates least astonishment; pick plural for all collections and never deviate.

The broader naming conventions that matter for a predictable surface:

- **Plural collections:** `/users`, `/orders`, `/payments` — always.
- **Nouns, never verbs:** `/orders`, not `/getOrders` or `/createOrder`. The method is the verb.
- **Lowercase, hyphenated multi-word paths:** `/shipping-addresses`, not `/shippingAddresses` or `/shipping_addresses` (kebab-case is the common web convention for URIs; be consistent).
- **Consistent casing in JSON bodies:** pick `snake_case` or `camelCase` for field names and apply everywhere.
- **No file extensions or actions in paths:** no `/orders.json`, no `/orders/9/cancel` (prefer a sub-resource or state change).
- **Stable IDs, ideally opaque and prefixed:** `ord_9`, `usr_42` — self-describing and non-guessable-in-meaning.
- **Version prefix:** `/v1/...`.

None of these are cosmetic — each one removed is a small surprise the developer has to remember. Consistency across all of them is what makes an API feel like one coherent product rather than several teams' endpoints stapled together.

### Q9. Model a REST API for a simple blogging platform (posts, comments, authors).

I'd identify the resources (nouns) first, then map operations to methods:

```http
# Authors
GET    /v1/authors                      # list
POST   /v1/authors                      # create
GET    /v1/authors/aut_7                # read one
PATCH  /v1/authors/aut_7                # partial update

# Posts (a top-level collection; author referenced by id)
GET    /v1/posts?author_id=aut_7&status=published   # list + filter
POST   /v1/posts                        # create (server assigns post id)
GET    /v1/posts/pst_12                 # read
PUT    /v1/posts/pst_12                 # full replace
PATCH  /v1/posts/pst_12                 # partial (e.g. edit body)
DELETE /v1/posts/pst_12                 # delete

# Comments (belong to a post — nest one level)
GET    /v1/posts/pst_12/comments        # comments on a post
POST   /v1/posts/pst_12/comments        # add a comment
DELETE /v1/comments/cmt_3               # comment is independently addressable too

# A state transition that isn't plain CRUD
POST   /v1/posts/pst_12/publication     # publish the post (creates a publication)
```

Design choices I'd explain: **posts are top-level** (they're queried across authors, so nesting under authors would be limiting — I reference `author_id` instead and offer a filter). **Comments nest one level** under their post because they belong to it, but I *also* expose `/comments/{id}` for direct addressing (delete/edit) so I'm not forced through the parent. **Publishing is a state change**, not CRUD, so I model it as a sub-resource (`POST .../publication`) rather than `POST /posts/12/publish` with a verb in the path. Pagination and filtering live on the collections. This shows resource identification, collection-vs-nested judgment, and how to handle non-CRUD actions.

### Q10. How do you handle actions that don't map to CRUD — like "cancel," "publish," or "send email"?

This is the classic REST friction point: real domains have operations that aren't create/read/update/delete. Three legitimate approaches, in rough order of preference:

- **Model the outcome as a resource (sub-resource / event).** A cancel *creates a cancellation*; a publish *creates a publication*; sending creates a *delivery*. So `POST /v1/orders/ord_9/cancellation` or `POST /v1/emails/eml_3/deliveries`. This keeps the noun-based style and gives you a record of the action.

```http
POST /v1/orders/ord_9/refunds
{ "amount_cents": 4200, "reason": "customer_request" }
→ 201 Created   { "id": "ref_5", "status": "pending" }
```

- **Model it as a state transition via PATCH on the resource.** If "cancel" just sets a status, `PATCH /v1/orders/ord_9 { "status": "cancelled" }` is clean and idempotent — provided the server enforces valid transitions.
- **A controller/action sub-path as a last resort.** When it genuinely isn't a resource or a state change (e.g. `POST /v1/orders/ord_9/actions/recalculate`). Pragmatic APIs do use a bounded set of these; the key is keeping them rare and consistent, not littering verbs everywhere.

What I avoid is `POST /v1/doCancelOrder?id=9` — a free-floating RPC that abandons the resource model. The principle: **prefer to name the noun the action produces (a refund, a cancellation) or the state it moves to; fall back to an explicit action sub-resource only when neither fits.**

### Q11. What's the difference between a REST API and an RPC-style API? Give examples.

**RPC (Remote Procedure Call)** exposes *functions*: the client calls a named procedure with arguments. **REST** exposes *resources*: the client acts on nouns with standard HTTP verbs. The difference shows up immediately in the URLs:

| | RPC style | REST style |
|---|---|---|
| Create order | `POST /createOrder` | `POST /v1/orders` |
| Get order | `POST /getOrder {id:9}` or `GET /getOrder?id=9` | `GET /v1/orders/ord_9` |
| Cancel order | `POST /cancelOrder {id:9}` | `POST /v1/orders/ord_9/cancellation` |
| Endpoints | one per function, verbs in path | one per resource, verbs = methods |
| Semantics | in the function name/body | in HTTP method + status code |

RPC isn't wrong — it's a different model, and it's the right one in some places. **gRPC** is explicitly RPC (you call `CreateOrder(request)`), and it shines for internal service-to-service calls where you want strong typing, codegen, and performance. REST's advantage is a *uniform* interface (any client that knows HTTP knows how to use it), natural cacheability of `GET`, and evolvability.

The tell that a "REST" API is secretly RPC: verbs in the paths (`/getX`, `/doY`), everything is `POST`, and status codes are ignored (always `200`, with success/failure in the body). That's Richardson Level 0–1 dressed as REST. If you're going to do RPC, do it deliberately (gRPC) rather than accidentally.

### Q12. When is REST NOT the right choice? What would you use instead?

REST is a great default but a poor fit in several cases, and knowing the boundaries is a senior signal:

- **Highly variable client data needs (over/under-fetching).** When many different clients need different slices of a rich, connected graph, REST's fixed representations force either over-fetching or many round-trips. **GraphQL** lets clients ask for exactly the fields/relations they need in one query. Good for aggregating dashboards, mobile screens with tight payload budgets, and public APIs with diverse consumers.
- **Internal service-to-service with performance/typing demands.** For east-west traffic where you control both ends and want low latency, a strict contract, codegen, and streaming, **gRPC** (protobuf over HTTP/2) beats REST/JSON.
- **Streaming / real-time.** REST is request-response. For server push or continuous streams, use **WebSockets**, **Server-Sent Events**, or **gRPC streaming**; for high-throughput event flows, a message queue / pub-sub.
- **Fire-and-forget / event-driven integration.** For "tell me when X happens" across systems, **webhooks** or an event bus (async) fit better than polling a REST endpoint.
- **Complex transactions / actions that aren't resources.** A workflow-heavy, action-oriented domain can be more honestly modeled as RPC than contorted into fake resources.

The framing I'd give: REST optimizes for a uniform, cacheable, evolvable resource interface over a network you don't control (public/partner). When your constraints are *diverse client shapes* (→ GraphQL), *internal performance + typing* (→ gRPC), or *real-time/async* (→ streaming/webhooks/queues), pick the style that matches. Often the answer is "both": REST at the public edge, gRPC internally, webhooks for async events.

### Q13. What does "resources should be nouns" mean, and how do you spot the anti-pattern?

It means every URI should name a **thing** (a resource), and the *action* on that thing should come from the HTTP method — never from a verb baked into the path. `/v1/orders/ord_9` names an order; `GET`/`PATCH`/`DELETE` say what you're doing to it.

Spot the anti-pattern by looking for **verbs in the path**:

```http
POST /v1/createOrder              # verb → should be POST /v1/orders
GET  /v1/getUserById?id=42        # verb → should be GET  /v1/users/usr_42
POST /v1/orders/9/doCancel        # verb → POST /v1/orders/ord_9/cancellation
POST /v1/updateUserEmail          # verb → PATCH /v1/users/usr_42
GET  /v1/fetchAllActivePosts      # verb → GET /v1/posts?status=active
```

Each left-hand version is an RPC call wearing REST clothes: it re-invents an operation the HTTP method already provides, forces a new endpoint per action, and makes the surface unpredictable (you can't guess the next call). The fix is mechanical: **extract the noun, make it a resource, move the action into the method** — and for actions that aren't CRUD, name the resulting resource (a `cancellation`, a `refund`) as covered earlier. When the URI reads as a clause with a verb in it, that's the smell.

### Q14. Is REST inherently stateless — and where do people accidentally introduce state?

REST *requires* statelessness as a constraint, but plenty of "REST" APIs violate it by accident. The rule: **the server must not rely on per-client session state stored between requests; each request carries its own context.**

Where teams accidentally introduce server-side state:

- **Server-side sessions/cookies as the source of truth.** Logging in once and having the server "remember" you in a session that's required for subsequent calls is stateful. The stateless version puts identity in a **token sent on every request** (`Authorization: Bearer …`), which any node can validate independently.
- **Multi-step wizards holding progress on the server.** "Start checkout" → server stashes step 1 in memory → "next step" assumes that node still has it. This breaks under load balancing. Instead, make the client carry the accumulated state (or persist it as a real resource, e.g. a `checkout_session` resource with an id the client references).
- **Cursor/pagination state kept server-side per client** instead of encoding it in an opaque cursor the client returns.
- **Sticky sessions** required for correctness — a sign state leaked onto a node.

The subtle distinction interviewers want: **resource state (in your database) is fine and expected**; it's *conversational* state tied to a specific client across calls that's forbidden. If any request's correctness depends on a *previous* request having hit the *same* server's memory, you've broken statelessness — and lost the horizontal-scaling and resilience benefits it exists to provide. The fix is always the same: move that state into the request (tokens, cursors) or into a real, addressable resource.

### Q15. How do you design filtering, sorting, and search on a REST collection?

These are operations *on a collection resource*, so they belong in the **query string** of a `GET` on the collection — the resource stays a noun, the query refines which representations you get back:

```http
GET /v1/orders?status=paid&created_after=2026-06-01&sort=-created_at&limit=50
GET /v1/products?category=books&min_price=1000&sort=price
GET /v1/users?q=alice          # free-text search
```

Conventions I'd apply for consistency and evolvability:

- **Filtering:** `field=value` query params (`status=paid`), with documented operators for ranges (`min_price`, `created_after`, or a scheme like `price[gte]=1000`). Keep the scheme consistent across all collections.
- **Sorting:** a `sort` param with a sign convention for direction — `sort=-created_at` (desc) — and allow multiple keys (`sort=status,-created_at`).
- **Search:** a dedicated `q` param for free-text; keep it separate from exact-match filters.
- **Pagination alongside:** `limit` + a cursor/`page` (see the pagination topic) in the same envelope.
- **Whitelist filterable/sortable fields** — don't blindly pass query params to the database (injection / performance / exposing internals). Only documented fields are honoured.

What I avoid: encoding filters in the *path* (`/orders/status/paid/sorted/date`) — that invents pseudo-resources and combinatorially explodes URIs. Filtering/sorting/search are refinements of *the same* collection resource, so they're query parameters. This keeps one canonical URI per collection, plays well with caching, and evolves cleanly as you add new filters (additive, non-breaking).

### Q16. Someone says "we're fully RESTful." What follow-up questions expose whether that's true?

"Fully RESTful" is often a badge people claim for any JSON-over-HTTP API. I'd probe where they actually sit on the Richardson ladder and whether they respect the core constraints:

- **"Are your URLs nouns or verbs?"** If I see `/getUser`, `/createOrder`, `/doCancel`, they're at RPC (L0–L1), not REST.
- **"Do you use the full range of HTTP methods and status codes?"** If everything is `POST` and always returns `200` with success/failure in the body, that's not L2 REST regardless of what they call it.
- **"Is it stateless — does any endpoint depend on server-side session memory from a previous call?"** Server-side login sessions required for subsequent calls, or sticky-session dependence, breaks the statelessness constraint.
- **"Do you implement HATEOAS / hypermedia links?"** Almost no one does fully — so if they claim "fully RESTful" (which by Fielding's definition means L3), the honest answer is usually "we're pragmatically L2," and I'd respect that far more than a false L3 claim.
- **"Do GETs cache — do you send ETags/Cache-Control, and are GETs truly safe (no side effects)?"** A `GET` that mutates state violates safety and kills cacheability.
- **"How consistent is the surface — pagination, errors, naming across endpoints?"**

The point isn't to catch them out — it's that "RESTful" is a spectrum, and a senior engineer describes *where* on it their API sits and *why* (usually "L2 by choice, we skip HATEOAS deliberately") rather than claiming a purity they don't have. The best answer to "are you fully RESTful?" is often "no, and here's the pragmatic level we chose and the tradeoff."

## HTTP Semantics for APIs

### Summary

**What this topic covers**

This topic is HTTP as an **API-design tool** — using methods, status codes, headers, and caching so the protocol itself carries meaning, so clients can behave correctly without reading your prose docs. Three concern areas: (1) **methods and their guarantees** — `GET`/`POST`/`PUT`/`PATCH`/`DELETE` and the two properties that govern retry and caching behaviour, **safety** and **idempotency**; (2) **status codes as a contract** — the 2xx/3xx/**4xx client-error** vs **5xx server-error** families and the specific codes worth knowing (200/201/202/204/301/304/400/401/403/404/409/410/422/429/500/503), because the code tells a client whether to retry, re-auth, fix input, or give up; and (3) **headers and HTTP's built-in machinery** — content negotiation (`Accept`/`Content-Type`), conditional requests (`ETag`/`If-None-Match`/`If-Match`) for caching and optimistic concurrency, and `Cache-Control` basics. This is the Networking primer's HTTP mechanics viewed from the *how do I design a clean, correct API* angle. The 17 questions here turn "which method/status/header" into deliberate design decisions, not defaults.

**Mental model**

Think of HTTP as **a contract language you already share with every client** — if you use it correctly, the protocol communicates intent so you don't have to. Two properties do most of the work. **Safety**: does the request change server state? `GET`, `HEAD`, `OPTIONS` are safe (read-only) — which is why they're cacheable and why a `GET` must never have side effects. **Idempotency**: does doing it N times equal doing it once? `GET`, `PUT`, `DELETE` (and `HEAD`) are idempotent; `POST` and `PATCH` generally are not. These two properties determine the two questions clients constantly ask: *can I cache this?* (safe) and *can I safely retry this after a timeout?* (idempotent). The other half of the model is **the status code is a machine-readable instruction**: the *family* tells the client what class of thing happened (2xx worked, 3xx go elsewhere, 4xx you're wrong, 5xx we're wrong), and 4xx-vs-5xx specifically tells them *whose fault it is and whether retrying could help*. Pick methods and codes so a client that has never read your docs still does the right thing.

**Key terms**

- **Safe method** — read-only, no state change (`GET`, `HEAD`, `OPTIONS`); cacheable and freely retriable.
- **Idempotent method** — repeating it yields the same result as once (`GET`, `PUT`, `DELETE`, `HEAD`); enables safe retries.
- **`POST`** — create/process, non-idempotent (two POSTs = two resources unless you add an idempotency key).
- **`PUT` vs `PATCH`** — full replace (idempotent) vs partial update (often not idempotent).
- **Status family** — 1xx info, 2xx success, 3xx redirect, 4xx client error, 5xx server error.
- **4xx vs 5xx** — client's fault (don't blind-retry, fix the request) vs server's fault (retry with backoff may help).
- **Content negotiation** — client's `Accept` + server's `Content-Type` agree on representation/format.
- **`ETag`** — an opaque version tag for a representation, used for caching and concurrency.
- **Conditional request** — `If-None-Match` (return `304` if unchanged) / `If-Match` (proceed only if unchanged → `412` else).
- **`304 Not Modified`** — cache-validation response: your copy is still fresh, no body sent.
- **`409 Conflict` / `422 Unprocessable`** — state conflict (e.g. version mismatch, duplicate) vs semantically invalid but well-formed input.
- **`Cache-Control`** — directives (`max-age`, `no-store`, `private`) telling caches how/whether to store a response.

**Why interviewers ask this**

Status codes and idempotency are the fastest correctness probes in an API interview. A junior returns `200` for everything (with a `success: false` in the body), can't say whether `PUT` is idempotent, and blind-retries a `POST` after a timeout — double-charging a customer. A senior picks the code that *instructs* the client (`201` + `Location` on create, `409` on conflict, `422` on validation, `429` + `Retry-After` on rate limit, `503` for overload), knows exactly which methods are safe/idempotent and why that governs retries and caching, and reaches for conditional requests to solve lost-update problems. These questions also reveal whether you understand HTTP as a *shared contract* rather than a dumb transport: someone who leans on the protocol writes APIs that need fewer docs and fail more predictably. The 4xx-vs-5xx distinction in particular tests whether you think about *who retries what*, which is the seam between API design and reliability.

**Common confusions**

- "`PUT` and `POST` are interchangeable for creating" — no. `PUT` is idempotent and used when the client sets the id / does a full replace; `POST` creates with a server-assigned id and is not idempotent. Repeated `POST` = duplicate resources.
- "Idempotent means it returns the same status code every time" — no. It means the same *effect* on server state. `DELETE` twice is idempotent even if the second returns `404` (state is identically "gone").
- "`PATCH` is always idempotent" — usually it isn't. `PATCH {op:"increment"}` or JSON-Patch `add` to an array changes state each call. A field-replacement `PATCH` can be idempotent, but don't assume it.
- "Any error is a 400" — `400` is malformed/unparseable; `422` is well-formed but semantically invalid; `401` is unauthenticated; `403` is authenticated-but-forbidden; `404` not found; `409` conflict. Collapsing them all to `400` throws away signal.
- "`401` means forbidden" — `401 Unauthorized` actually means *unauthenticated* (who are you?); `403 Forbidden` means authenticated but not allowed (I know you, no).
- "5xx for bad user input" — a client sending garbage is a 4xx; 5xx means *your* server failed and implies the client can retry. Mislabeling one as the other misleads every client's retry logic.
- "GET can have a body / side effects" — a `GET` must be safe; giving it side effects breaks caching, prefetching, and crawler safety.

**What follows from this topic**

HTTP semantics are the substrate for several later topics. Idempotency and safe-retry lead straight into the **idempotency & reliability** topic (idempotency keys for `POST`, `202` + status resource for long-running work, retries with backoff). The status-code families feed the **errors** topic (RFC 7807 problem+json bodies attached to 4xx/5xx, machine-readable codes). `429` + `Retry-After` + `RateLimit-*` headers set up the **rate limiting** topic. `ETag`/`Cache-Control` set up the **performance/caching** topic (CDNs, conditional GETs) and the **concurrency** angle (`If-Match` optimistic locking). `Accept`/`Content-Type` versioning connects to the **versioning & evolution** topic (media-type versioning). Master this topic and the later ones are largely "apply these primitives to a specific problem."

### Q1. Explain safety and idempotency. Which HTTP methods have each, and why does it matter?

**Safety** = the method doesn't change server state (it's read-only). **Idempotency** = making the same request N times has the same effect on server state as making it once.

| Method | Safe? | Idempotent? |
|---|---|---|
| GET | ✅ | ✅ |
| HEAD | ✅ | ✅ |
| OPTIONS | ✅ | ✅ |
| PUT | ❌ | ✅ |
| DELETE | ❌ | ✅ |
| POST | ❌ | ❌ |
| PATCH | ❌ | ❌ (usually) |

Why it matters — these two properties answer the two questions every client and intermediary asks:

- **Can I cache/prefetch this?** Only safe methods. A `GET` must have no side effects, or caches, browsers, and crawlers that prefetch it will silently trigger state changes.
- **Can I safely retry this after a timeout?** Only idempotent methods. If a `PUT` or `DELETE` times out (you don't know if it landed), just resend — the end state is the same. If a `POST` times out, resending risks a duplicate (a second order, a double charge), which is exactly why `POST` needs **idempotency keys** to be retry-safe.

So safety governs caching and idempotency governs retries — get the method right and the client's caching/retry behaviour is correct by construction.

### Q2. Walk through GET, POST, PUT, PATCH, DELETE and when to use each.

- **GET** — read a resource or collection. Safe, idempotent, cacheable. No request body semantics. `GET /v1/orders/ord_9`.
- **POST** — create a resource (server assigns id) or trigger processing/an action. Not safe, not idempotent. Returns `201 Created` + `Location` for creates. `POST /v1/orders`.
- **PUT** — full replace of a resource at a known URI, or create-at-a-client-chosen-id. Idempotent: sending the same full representation twice ends in the same state. Use when the *client* controls the identity or you're replacing the whole thing. `PUT /v1/users/usr_42/settings`.
- **PATCH** — partial update: send just the fields to change. Not guaranteed idempotent (depends on the patch semantics). Use for "edit these two fields." `PATCH /v1/orders/ord_9 { "status": "shipped" }`.
- **DELETE** — remove a resource. Idempotent: deleting twice leaves it identically gone (second call may return `404` or `204`). `DELETE /v1/orders/ord_9`.

```http
POST  /v1/orders            → 201 Created, Location: /v1/orders/ord_9   (create, server id)
PUT   /v1/orders/ord_9      → 200/204   (replace the whole order)
PATCH /v1/orders/ord_9      → 200       (change some fields)
DELETE /v1/orders/ord_9     → 204       (remove)
```

The decision flow: reading → `GET`; creating with a server id or doing an action → `POST`; full replace / client-set id → `PUT`; partial edit → `PATCH`; removing → `DELETE`.

### Q3. PUT vs PATCH vs POST — how do you choose, and what are the idempotency implications?

| | POST | PUT | PATCH |
|---|---|---|---|
| Intent | create / action | full replace (or create-at-id) | partial update |
| Idempotent | No | Yes | Usually no |
| Body | new resource / command | the *entire* resource | just the changed fields |
| Retry-safe? | only with idempotency key | yes | depends |

**POST** when the server assigns the identity (`POST /v1/orders` → `201` + `Location`), or for non-CRUD actions. Two POSTs create two resources — so any retry needs an idempotency key.

**PUT** when the client knows the target URI and is sending the *complete* representation, replacing whatever's there. Because it's a full replace to a fixed URI, doing it twice is identical — idempotent. A gotcha: if a client omits a field in a `PUT`, that field should be cleared/defaulted (full replace), not left untouched — that's the difference from `PATCH`.

**PATCH** when you're changing part of a resource and don't want to send (or race on) the rest. Idempotency depends on the operation: replacing `status` to a fixed value is idempotent; an `increment` or array-`append` patch is not. Use JSON Merge Patch (`application/merge-patch+json`) or JSON Patch (`application/json-patch+json`) and be explicit about semantics.

The practical rule I give: **PUT if the client provides the whole thing and the id; PATCH if you're nudging a few fields; POST if the server creates the id or it's an action.** And never rely on `PATCH` being idempotent — design retries as if it isn't.

### Q4. What are the HTTP status code families, and what does each tell a client?

The **first digit is the family**, and it's a machine-readable instruction about what class of thing happened:

- **1xx Informational** — interim (`100 Continue`, `101 Switching Protocols`); rarely surfaced in API design.
- **2xx Success** — the request worked. `200 OK`, `201 Created`, `202 Accepted`, `204 No Content`.
- **3xx Redirection** — the resource is elsewhere or unchanged; go/act accordingly. `301 Moved Permanently`, `304 Not Modified`.
- **4xx Client Error** — *the request is wrong*; the client must change something before retrying. `400`, `401`, `403`, `404`, `409`, `410`, `422`, `429`. Blind-retrying the identical request won't help (except `429`, which says "retry later").
- **5xx Server Error** — *the server failed* through no fault of the request; retrying the same request later may succeed. `500`, `502`, `503`, `504`.

The single most useful line to draw is **4xx vs 5xx = whose fault + should you retry.** 4xx: your input; fix it (mostly don't auto-retry). 5xx: our problem; a retry with backoff might work. Clients build their retry logic on exactly this split, which is why mislabeling (returning `500` for bad input, or `200` for a failure) is a real bug — it sends every client's error-handling down the wrong branch.

### Q5. What's the difference between 400, 401, 403, 404, 409, and 422? Give a scenario for each.

These are the workhorse 4xx codes, and collapsing them into "just use 400" throws away signal the client needs:

- **400 Bad Request** — the request is *malformed / unparseable*: broken JSON, missing required parameter, wrong type. The client literally sent something the server can't process as a request. `POST /v1/orders` with `{ "total": }`.
- **401 Unauthorized** — *unauthenticated*: no or invalid credentials. "I don't know who you are." Client should authenticate (or refresh the token). Missing/expired `Authorization` header.
- **403 Forbidden** — *authenticated but not allowed*: "I know who you are, and you can't do this." Re-auth won't help. A viewer trying `DELETE /v1/orders/ord_9` they don't own.
- **404 Not Found** — the resource doesn't exist (or you're deliberately hiding its existence from an unauthorized caller). `GET /v1/orders/ord_999`.
- **409 Conflict** — the request conflicts with *current state*: a version mismatch (optimistic lock), a duplicate unique key, deleting something with dependents. `POST /v1/users` with an email that already exists, or a `PUT` whose `If-Match` version is stale.
- **422 Unprocessable Entity** — the request is *well-formed and parseable but semantically invalid*: fails business validation. Syntax fine, meaning wrong. `POST /v1/orders { "quantity": -3 }` — valid JSON, invalid value.

The `400` vs `422` line trips people up: **`400` = I couldn't parse it; `422` = I parsed it fine but the values are invalid.** And `401` vs `403`: **`401` = who are you; `403` = I know you, no.** Using the precise code lets the client branch correctly — re-auth on `401`, give up/escalate on `403`, fix-and-resend on `400`/`422`, resolve state on `409` — without parsing your prose.

### Q6. Which status code do you return when creating a resource, and what else should the response include?

**`201 Created`**, and the response should include a **`Location` header pointing at the new resource** plus (conventionally) the created representation in the body:

```http
POST /v1/orders
Content-Type: application/json

{ "customer_id": "usr_42", "total_cents": 4200 }

→ 201 Created
Location: /v1/orders/ord_9
Content-Type: application/json

{ "id": "ord_9", "status": "pending", "total_cents": 4200,
  "created_at": "2026-07-01T12:00:00Z" }
```

Why each part: **`201`** (not `200`) tells the client a new resource came into existence; **`Location`** gives its canonical URI so the client can immediately `GET`/`PATCH` it without guessing; **the body** returns the server-populated fields (`id`, `status`, `created_at`, computed values) so the client doesn't need a follow-up round-trip.

Variations worth knowing:
- If creation is **asynchronous** (queued job), return **`202 Accepted`** with a `Location` pointing at a status resource the client polls (covered in the async topic), not `201`.
- If the create is a `PUT` to a client-chosen id and it *replaced* an existing resource, return `200`/`204`; if it *created*, `201`.
- On a **duplicate** (unique constraint), return `409 Conflict`, not `201`.

Returning `200` with no `Location` for a create is a common junior tell — it works, but it's less informative and less predictable than the semantics HTTP already gives you.

### Q7. When do you use 202, 204, and 304?

Three often-underused codes that make an API cleaner:

- **`202 Accepted`** — "I've accepted the request for **asynchronous** processing; it isn't done yet." Use for long-running operations you queue rather than complete inline. Return a `Location` (or body) pointing at a **status resource** the client polls:

```http
POST /v1/videos/vid_3/transcode  → 202 Accepted
Location: /v1/videos/vid_3/transcode-jobs/job_7
# client later: GET /v1/.../job_7 → { "status": "processing" | "done" }
```

- **`204 No Content`** — "Success, and there's deliberately **no body** to return." Ideal for a `DELETE` that succeeded (`DELETE /v1/orders/ord_9 → 204`), or a `PUT`/`PATCH` where the client doesn't need the updated representation back. The client should send/expect no response body. (Don't use `204` if you *do* want to return the updated object — use `200` + body then.)

- **`304 Not Modified`** — a **cache-validation** response to a conditional `GET`. The client sent `If-None-Match: "<etag>"`; the resource is unchanged, so the server returns `304` with **no body**, and the client reuses its cached copy. This saves bandwidth on unchanged resources (covered in the conditional-requests questions):

```http
GET /v1/orders/ord_9
If-None-Match: "v3"
→ 304 Not Modified          (empty body; use your cached copy)
```

The theme: these codes let you express "accepted-but-not-done," "done-nothing-to-say," and "nothing-changed" precisely, instead of overloading `200` with a body flag for each case.

### Q8. What's the difference between 4xx and 5xx, and why does it matter for retries and reliability?

**4xx = the client's request is wrong. 5xx = the server failed.** That single distinction drives how every well-behaved client and gateway treats the response:

- **4xx → don't blind-retry; fix the request.** Re-sending the identical `400`/`401`/`403`/`404`/`422` will fail identically, so auto-retrying wastes calls and can trip rate limits. The client must *change* something — fix the payload (`400`/`422`), refresh the token (`401`), stop (`403`/`404`). The one exception is **`429 Too Many Requests`**, a 4xx that explicitly says "retry later" (with `Retry-After`).
- **5xx → retry with backoff may succeed.** A `500`/`502`/`503`/`504` means the request was fine but the server (or an upstream) failed transiently, so retrying the *same* request after a delay is often the right move.

Why it matters for reliability: retry logic, circuit breakers, and gateways all branch on this. If you mislabel a bad user input as `500`, clients will hammer you retrying something that can never succeed. If you mislabel a transient outage as `400`, clients give up on something that would've worked on retry. So the rule is strict: **only return 5xx when *your* side genuinely failed; anything caused by the client's input is a 4xx.** And 5xx responses should be safe to retry — which loops back to idempotency (retriable operations must be idempotent or protected by idempotency keys, so a retried 5xx doesn't double-execute).

### Q9. What status code for a rate-limited request, and what headers should accompany it?

**`429 Too Many Requests`** — a 4xx that uniquely means "your request was fine, but you've sent too many; back off and retry later." It should come with headers that tell the client *when* and *how much*:

```http
GET /v1/orders
→ 429 Too Many Requests
Retry-After: 30
RateLimit-Limit: 100
RateLimit-Remaining: 0
RateLimit-Reset: 30
Content-Type: application/problem+json

{ "type": "https://api.example.com/errors/rate-limited",
  "title": "Rate limit exceeded", "status": 429,
  "detail": "Limit is 100 requests per minute." }
```

- **`Retry-After`** — how long to wait (seconds, or an HTTP date). This is the key one: it turns a blind retry storm into a coordinated back-off.
- **`RateLimit-Limit` / `RateLimit-Remaining` / `RateLimit-Reset`** — the standardized (IETF `RateLimit` header fields) quota, remaining calls, and reset window, so well-behaved clients can *pace themselves before* hitting the limit.

Why `429` and not `503`: `429` says "*you* exceeded a quota" (client-specific, deterministic), whereas `503 Service Unavailable` says "the *server* is overloaded/down for everyone." They imply different client behaviour. Pairing `429` with `Retry-After` is what makes rate limiting cooperative rather than a wall — the client knows exactly when it's welcome back. This connects directly to the rate-limiting topic (token bucket, sliding window, per-key quotas).

### Q10. What is content negotiation, and how do Accept and Content-Type differ?

Content negotiation is how client and server **agree on the representation** of a resource — format, and sometimes language or version — using headers, so the same URI can serve JSON, CSV, or a specific media type depending on who's asking.

The two headers play different roles and point in opposite directions:

- **`Content-Type`** describes the body **actually in this message**. On a request it says "here's what I'm *sending*" (`POST` with `Content-Type: application/json`). On a response it says "here's what I'm *returning*" (`Content-Type: application/json`).
- **`Accept`** is a *request-only* header saying what the client is **willing to receive**: `Accept: application/json` or `Accept: text/csv`. The server picks the best match and echoes it in the response's `Content-Type` (or returns `406 Not Acceptable` if it can't satisfy any).

```http
POST /v1/orders
Content-Type: application/json      # the body I'm sending is JSON
Accept: application/json            # please respond in JSON

→ 200 OK
Content-Type: application/json      # here's your JSON
```

Mnemonic: **`Content-Type` = "what this message *is*"; `Accept` = "what I *want back*."** Content negotiation also underpins **media-type versioning** (`Accept: application/vnd.example.v2+json`) and returning alternate formats (CSV export vs JSON) from one endpoint — a clean way to serve varied clients without new URIs.

### Q11. How do ETags and conditional requests work, and what problems do they solve?

An **`ETag`** is an opaque version tag the server attaches to a representation — think a hash or version number of the resource's current state. The client stores it and sends it back on later requests to ask a conditional question. Two headers, two problems:

**1. Caching / bandwidth — `If-None-Match` (conditional GET):**

```http
# First fetch
GET /v1/orders/ord_9        → 200 OK, ETag: "v3", { …order… }
# Later, revalidate
GET /v1/orders/ord_9
If-None-Match: "v3"
→ 304 Not Modified          # unchanged: no body, client reuses its cache
# or, if changed:
→ 200 OK, ETag: "v4", { …new order… }
```

This saves transferring the body when nothing changed — the server only re-sends if the ETag no longer matches.

**2. Optimistic concurrency (lost-update prevention) — `If-Match`:**

```http
PATCH /v1/orders/ord_9
If-Match: "v3"
{ "status": "shipped" }
→ 200 OK, ETag: "v4"        # applied, because "v3" was still current
# but if someone else changed it first:
→ 412 Precondition Failed   # your "v3" is stale; re-fetch and retry
```

Here the ETag prevents two clients from clobbering each other: the update proceeds *only if* the resource is still at the version the client last saw (`If-Match`), otherwise `412` tells them to re-read and reconcile. So conditional requests give you two things HTTP already knows how to do — **cheap cache revalidation** and **compare-and-swap concurrency control** — without inventing your own version-check protocol.

### Q12. How would you prevent two clients from overwriting each other's changes (the lost-update problem)?

The clean HTTP-native answer is **optimistic concurrency control with ETags and `If-Match`**. Every representation carries an `ETag` (its current version); an update must declare which version it's based on, and the server rejects it if the resource has moved on:

```http
# Both clients read the same order
GET /v1/orders/ord_9   → 200, ETag: "v3"

# Client A updates first — succeeds, version bumps to v4
PUT /v1/orders/ord_9
If-Match: "v3"
{ …full order… }       → 200, ETag: "v4"

# Client B, still holding "v3", tries to update
PUT /v1/orders/ord_9
If-Match: "v3"
{ …full order… }       → 412 Precondition Failed
```

Client B gets `412`, re-fetches (`v4`), reapplies its change on top, and retries. No update is silently lost — the second writer is forced to reconcile with the first.

Why this over alternatives: **pessimistic locking** (client acquires a lock resource before editing) is heavier, requires lock lifecycle/timeout handling, and doesn't fit stateless REST well. `If-Match`/ETag is stateless, standard, and cache-friendly. The essentials to get right: the ETag must actually change whenever the resource changes (derive it from a version column or content hash), and you return `412 Precondition Failed` (or `428 Precondition Required` if you want to *mandate* clients send `If-Match`). This is the same ETag machinery as caching, reused for concurrency — one more example of leaning on HTTP semantics instead of hand-rolling a protocol.

### Q13. What are the basics of Cache-Control for an API, and when should responses be cacheable?

`Cache-Control` is the header that tells caches (the client, CDNs, proxies) **whether and how long** they may store and reuse a response. The directives you actually reach for:

- **`no-store`** — never cache (sensitive/personalized data: auth responses, payment details).
- **`no-cache`** — may store, but must revalidate with the origin (via ETag) before reuse. Good for data that changes unpredictably but where a `304` saves bandwidth.
- **`private`** — cacheable only by the end client (browser), not shared caches/CDNs. Use for user-specific responses.
- **`public`** — any cache may store it (shared, non-user-specific data).
- **`max-age=<seconds>`** — how long the response is considered fresh (`max-age=300` = 5 min).

```http
GET /v1/products/prod_5
→ 200 OK
Cache-Control: public, max-age=300
ETag: "v7"
```

When to make responses cacheable: **safe, `GET`-able, non-personalized, slowly-changing data** — product catalogs, reference data, public config. Cache those aggressively (`public, max-age=…`) and put a CDN in front. **Don't cache** (`no-store` or `private, no-cache`) for user-specific, sensitive, or rapidly-changing resources, and never cache non-safe methods.

The design mindset: caching is a first-class API feature, not an afterthought. Combining `Cache-Control: max-age` (freshness — skip the request entirely while fresh) with `ETag` + `If-None-Match` (validation — cheap `304` once stale) gives you both fewer requests and smaller responses. This sets up the performance/caching topic (CDN, compression, avoiding chatty APIs).

### Q14. Should a GET ever have side effects or a request body? Why does it matter?

**No — a `GET` must be safe (no state change) and, by convention, carries no meaningful request body.** This isn't pedantry; a surprising amount of infrastructure assumes it:

- **Caches and CDNs** freely store and serve `GET` responses. If a `GET` mutated state, a cached hit would skip the mutation — behaviour would depend on cache state, which is chaos.
- **Browsers, crawlers, and prefetchers** issue `GET`s speculatively (link prefetch, search-engine crawl, "preview" fetches). A side-effecting `GET` means a crawler could delete data or trigger actions just by following links — a real historical class of bugs (the classic "Googlebot deleted our records because delete was a `GET`").
- **Retries/proxies** may replay `GET`s safely precisely because they're safe; give them side effects and replays cause duplicate effects.

So if an operation changes state, it must be `POST`/`PUT`/`PATCH`/`DELETE`, never `GET` — even something like "increment view count" should be a `POST` (or an accepted, deliberate exception you understand).

On **bodies**: the HTTP spec doesn't strictly forbid a `GET` body, but its semantics are undefined and much tooling (proxies, caches, some servers/clients) ignores or drops it. So don't rely on it. If a read genuinely needs a large/complex query payload (a search with a big filter object), the pragmatic options are: put it in query parameters, or use `POST /v1/searches` (treating the search as a resource) and accept that it's not cacheable via URL. Bottom line: **keep `GET` safe and query-in-the-URL; move anything with a body or a side effect to a non-safe method.**

### Q15. When do you use 301 vs 302/307 vs 410, and how do redirects affect API clients?

These codes tell a client a resource has *moved* or *gone* — and the exact code changes client and cache behaviour, which matters more for APIs than for browsers because API clients are automated.

- **`301 Moved Permanently`** — the resource has a new canonical URI, permanently. Caches and clients should update their bookmarks/records to the `Location`. Use when you've genuinely relocated a resource or restructured URIs and want clients to migrate. `301` is cacheable and can be aggressively remembered, so only use it when it's truly permanent.
- **`302 Found` / `307 Temporary Redirect`** — the resource is temporarily elsewhere; don't update stored URIs. Prefer **`307`** for APIs because it *preserves the method and body* (a `302` historically caused clients to switch a `POST` to a `GET` on redirect, which is a footgun for non-safe requests). `308 Permanent Redirect` is the method-preserving permanent version.
- **`410 Gone`** — the resource *existed and has been intentionally removed*, permanently, and won't come back. Stronger and more informative than `404 Not Found` (which just says "not here," maybe never was). Use `410` to tell clients "stop asking — this is retired," e.g. a sunset endpoint after a deprecation window.

For API design specifically: automated clients don't "see" a redirect the way a user does, so redirects must be handled deliberately — many HTTP libraries follow `3xx` automatically, but not always preserving auth headers or method. So if you redirect API traffic, prefer method-preserving codes (`307`/`308`), and for a removed/deprecated endpoint, returning `410 Gone` (with a `Sunset`/deprecation note) is a cleaner, more honest signal than a bare `404`. This ties into the versioning/deprecation topic: `301`/`308` for "we moved it," `410` for "we retired it."

### Q16. Design the request/response for updating a user's email, choosing methods, codes, and headers deliberately.

I'd model it as a partial update to the user resource, protected against races and duplicates, and I'd narrate each HTTP choice:

```http
PATCH /v1/users/usr_42
Authorization: Bearer <token>
Content-Type: application/merge-patch+json
If-Match: "v9"

{ "email": "alice.new@example.com" }
```

Method/header choices:
- **`PATCH`**, not `PUT` — I'm changing one field, not replacing the whole user; I don't want to force the client to send (and race on) every other field.
- **`If-Match: "v9"`** — optimistic concurrency so a concurrent update doesn't get silently clobbered; if the user changed since the client read it, we reject.
- **`Content-Type: application/merge-patch+json`** — explicit patch semantics so "email present, other fields absent" unambiguously means "change only email."
- **`Authorization`** — identity per request (stateless), and the server checks that the caller may edit *this* user (object-level authz — guards against IDOR).

Responses, by case:
```http
200 OK   ETag: "v10"   { "id":"usr_42", "email":"alice.new@example.com", … }   # success
401 Unauthorized      # missing/expired token
403 Forbidden         # authenticated but not allowed to edit usr_42
404 Not Found         # no such user (or hidden from this caller)
409 Conflict          # email already in use by another account
412 Precondition Failed   # If-Match stale — re-fetch and retry
422 Unprocessable Entity  # well-formed but invalid, e.g. "not-an-email"
```

Each code is deliberate: `200`+new `ETag` on success (so the client's next `If-Match` is current), `422` (not `400`) for a syntactically-fine-but-invalid email, `409` for the duplicate-email *state conflict*, `412` for the version race, and the `401`/`403`/`404` trio distinguishing "who are you / not allowed / doesn't exist." That's HTTP carrying the whole contract — the client can branch correctly without reading a word of prose docs.

### Q17. A client POSTs to create an order, times out, and retries — and gets charged twice. What went wrong and how do you fix it with HTTP semantics?

**What went wrong:** `POST` is **not idempotent**. The first request actually succeeded server-side (order created, card charged), but the response was lost to the timeout, so the client — correctly not knowing the outcome — retried the same `POST`, and the server dutifully created a *second* order and charged again. The bug isn't the retry (retrying on a timeout is right); it's that the create operation had no way to recognize the retry as a duplicate.

**The fix: idempotency keys.** The client generates a unique key per logical operation and sends it as a header; the server records the key with the result of the first execution and *replays that stored result* for any repeat of the same key instead of re-executing:

```http
POST /v1/orders
Idempotency-Key: 6f1c...9ab      # unique per logical create; same on retry
Content-Type: application/json
{ "customer_id": "usr_42", "total_cents": 4200 }

# First attempt: executes, stores result under the key
→ 201 Created, Location: /v1/orders/ord_9, { "id":"ord_9", … }

# Retry after timeout: SAME key → server returns the SAME result, no new charge
→ 201 Created, Location: /v1/orders/ord_9, { "id":"ord_9", … }
```

Server-side mechanics: on receiving a request, look up the `Idempotency-Key`; if unseen, process and persist `(key → response)` atomically; if seen, return the stored response (or `409` if a request with that key is still in flight). Keys are scoped per endpoint/account and expire after a window (e.g. 24h).

The broader lesson connects safety/idempotency to reliability: **any non-idempotent operation that clients will retry (payments, order creation) needs an idempotency key to make retries safe.** This is exactly why `PUT`/`DELETE` don't need one (already idempotent) but `POST` does. "Exactly once" over an unreliable network is really "at-least-once delivery + server-side dedup by key" — and that's the topic this sets up (idempotency & reliability).
## Request & Response Design

### Summary

**What this topic covers**

Once you've decided on your resources and verbs, the next design decision is the *shape of the bytes on the wire* — the payload. This topic is about the request and response bodies themselves: how you name fields, which data types and formats you pick for dates/money/IDs, whether a field is required/optional/nullable, whether you wrap responses in an envelope or return them bare, how clients ask for less data (partial responses, sparse fieldsets) or more data (expansion/embedding), and how you keep your public payloads decoupled from your internal database rows via DTOs. The 16 questions in this topic move from warm-ups (snake vs camel, what a good payload looks like) to senior scenarios (design the payload for a resource, spot the mass-assignment bug, choose an envelope strategy for a public API). Payload design is where "least astonishment" and developer experience are won or lost — a clean, predictable body shape is the single biggest DX lever after good URIs.

**Mental model**

Treat the payload as a **published contract**, not a serialization of your objects. The moment a client parses your JSON, its field names, types, and nesting become promises you have to keep — renaming `userId` to `user_id` is a breaking change even though the value is identical. So design the payload *outward-in*: what does the consumer need, in what shape is it easiest to consume, and what can never change without a new version. Two forces pull on every payload. First, **consistency beats local optimality** — one naming convention, one date format, one ID scheme across every endpoint matters more than any individual "better" choice. Second, **the payload is a projection, not a mirror** — it exposes a deliberately chosen view (a DTO), never your ORM entity. That decoupling is what lets you refactor the database without breaking clients, and what stops internal fields (`password_hash`, `internal_risk_score`, soft-delete flags) leaking out. Everything else — envelopes, expansion, sparse fieldsets — is negotiating the tension between "give me exactly what I need" and "keep the contract stable and cacheable."

**Key terms**

- **DTO (Data Transfer Object)** — the shape you serialize to the wire, distinct from your internal domain/persistence model.
- **Envelope** — a wrapper object (`{ "data": ..., "meta": ... }`) around the actual resource, versus a **bare** response that returns the resource at the top level.
- **Field naming convention** — `snake_case` vs `camelCase` vs `PascalCase`; pick one and apply it to every field on every endpoint.
- **Nullability** — whether a field may be `null`; distinct from whether it may be **absent** (omitted) or **required**.
- **Sparse fieldset / partial response** — client asks for a subset of fields (`?fields=id,name`) to shrink the payload.
- **Expansion / embedding** — client asks for related resources inlined (`?expand=customer`) instead of a bare ID/link, trading round-trips for payload size.
- **Mass assignment** — blindly binding an incoming payload onto your model so a client can set fields it shouldn't (`is_admin`, `balance`).
- **Excessive data exposure** — returning more fields than the client needs and letting the client filter, leaking sensitive data.
- **Money as minor units** — representing amounts as integer cents (`1099`) or a decimal string, never a binary float.
- **Tolerant reader** — a client that ignores unknown fields, so the server can add fields without breaking it (Postel's law).

**Why interviewers ask this**

Payload design is where interviewers separate people who've *consumed* messy APIs from people who've only drawn boxes. A junior answer picks types ad hoc — floats for money, epoch millis sometimes and ISO strings other times, `null` and missing used interchangeably. A senior answer treats the body as a versioned contract: consistent naming, ISO-8601 with timezone, money as minor units or decimal strings, explicit stances on null-vs-absent, and DTOs that never leak the schema. The tell is whether you volunteer the *evolution* angle unprompted — "I'd make clients tolerant readers so I can add fields additively" — and the *security* angle — "I'd whitelist bindable fields to prevent mass assignment, and project outbound fields to prevent excessive data exposure." Those two are OWASP API Top 10 items, and naming them here signals you design payloads defensively, not just prettily.

**Common confusions**

- "`null` and missing are the same." They're not: `null` means "this field exists and its value is empty"; absent means "no assertion." In `PATCH`, the difference decides whether you clear a field or leave it untouched.
- "Return everything; clients can pick what they need." That's excessive data exposure — the client can't filter what it never should have received. Project outbound.
- "Money can be a float if I round." IEEE-754 can't represent `0.10` exactly; use integer minor units or a decimal string.
- "Envelopes are always better." Envelopes add consistency and room for metadata but cost ergonomics and break naive HTTP caching of the raw resource; it's a real tradeoff, not a default.
- "camelCase vs snake_case is bikeshedding." The *choice* is; the *inconsistency* isn't — mixing them across endpoints is a genuine DX defect.
- "Expansion is free." Inlining related resources multiplies payload size and couples cache lifetimes; make it opt-in, not the default.

**What follows from this topic**

Payload shape sets up everything downstream. Nullability and required/optional feed directly into **Error Handling** (validation errors describe which field failed and why). Envelopes and `next`-link placement are the seam into **Pagination, Filtering & Sorting** — a paged list is just an envelope with collection metadata. The "additive changes are safe, renames are breaking" rule is the core of **Versioning & Evolution**. And the DTO/mass-assignment discipline here is the same muscle you use in **API Security** (BOLA, excessive data exposure, mass assignment are three of the OWASP API Top 10). Get the body shape right and consistent, and half the rest of API design is bookkeeping.

### Q1. What makes a good request/response payload? Give the properties you'd optimize for.

A good payload is **predictable, self-consistent, minimal, and evolvable**. Concretely:

- **Consistent naming** across every endpoint — one case convention, one pluralization rule, the same field name for the same concept everywhere (`created_at`, never `createdAt` on one endpoint and `creation_date` on another).
- **Explicit, unambiguous types** — strings for IDs, ISO-8601 for timestamps, integer minor units or decimal strings for money, booleans that are actually booleans (not `"true"`/`0`/`"Y"`).
- **Only what the consumer needs** — no internal fields, no debug junk, no "just in case" data.
- **Additive-friendly** — clients are tolerant readers, so you can add fields without a new version.
- **Flat where it can be, nested where it must be** — deep nesting is hard to consume and version.

Good:

```json
{
  "id": "ord_123",
  "status": "shipped",
  "total_amount": { "currency": "USD", "minor_units": 4999 },
  "created_at": "2026-07-01T09:12:44Z",
  "customer_id": "usr_456"
}
```

Bad — mixed casing, float money, ambiguous date, leaked internals:

```json
{
  "ID": 123,
  "Status": 2,
  "total": 49.99,
  "created": 1719824764,
  "customerID": 456,
  "internal_fraud_score": 0.83,
  "_dbShardKey": "shard-7"
}
```

### Q2. snake_case or camelCase for JSON fields — how do you decide, and does it actually matter?

The *specific* choice matters far less than **being consistent**. Pick one and enforce it in your style guide and linter (Spectral can fail a build on a mismatched field).

Rules of thumb: `snake_case` reads well in JSON and matches many backend ecosystems (Python, Ruby, Postgres); `camelCase` matches JavaScript/TypeScript clients so they don't have to remap. If your primary consumer is a browser SPA, `camelCase` saves the client a transformation layer; if you're a polyglot public API, `snake_case` is the common convention (Stripe, GitHub). Never mix — `PascalCase` in .NET-flavored APIs is fine if consistent, but exposing your framework's default casing accidentally is the real crime.

The one hard rule: **the same concept has the same field name everywhere.** `customer_id` in one response and `buyer` in another for the same entity is the defect that erodes trust in an API.

### Q3. How do you represent dates, times, money, and IDs in a payload?

**Dates/times** — ISO-8601 / RFC 3339 strings, always with an explicit offset, prefer UTC: `"2026-07-01T09:12:44Z"`. Avoid epoch integers (ambiguous seconds vs millis, unreadable in logs) and *never* local time without an offset. For a date with no time, use `"2026-07-01"`.

**Money** — never a binary float. Two accepted options:

```json
{ "currency": "USD", "minor_units": 4999 }
```
or a decimal string with currency: `{ "currency": "USD", "amount": "49.99" }`. Minor units (integer cents) avoid rounding entirely; decimal strings stay human-readable. Always carry the currency — a bare number is a bug waiting for a multi-currency requirement.

**IDs** — prefer **opaque strings**, not raw auto-increment integers. Prefixed IDs (`usr_123`, `ord_456`, Stripe-style) are self-describing in logs and prevent clients from doing arithmetic on them. Exposing sequential integer IDs also leaks volume ("we have 12 customers") and invites enumeration/BOLA probing. UUIDs or ULIDs work too; the key is that the client treats the ID as an opaque token.

### Q4. What's the difference between a field being null, absent, and required — and why does it matter?

Three distinct states, and conflating them causes real bugs:

- **Required** — the request is invalid without it; a `POST /v1/orders` with no `customer_id` is a `422`.
- **Optional but present as null** — the field exists and its value is explicitly empty (`"middle_name": null`).
- **Absent** — the key isn't in the object at all; "no assertion made."

The distinction is load-bearing in `PATCH`. Consider:

```json
{ "nickname": null }   // clear the nickname
{}                     // leave nickname untouched
```

If you can't distinguish `null` from absent (many naive deserializers can't), you can't support "clear this field" vs "don't touch it." Document your stance per field, and be explicit in your schema (`nullable: true` in OpenAPI is separate from `required`).

For responses, decide a house rule: either always include optional fields as `null`, or omit them — but be consistent so clients can rely on it.

### Q5. Envelope or bare response — `{ "data": {...} }` vs returning the resource directly? What's the tradeoff?

| | Bare | Envelope |
|---|---|---|
| Single resource | `{ "id": "ord_1", ... }` | `{ "data": { "id": "ord_1", ... } }` |
| Room for metadata | No (must use headers) | Yes (`meta`, `links`, `errors`) |
| Consistency across single/list | Uneven | Uniform wrapper everywhere |
| HTTP caching of raw entity | Natural | Wrapped, less natural |
| Client ergonomics | `resp.id` | `resp.data.id` |

**Recommendation:** use a bare object for a single resource, and an envelope for **collections** (where you genuinely need pagination metadata and `links`). Some APIs (JSON:API) envelope everything for uniformity; that's defensible for large public APIs where consistency and top-level `meta`/`errors` slots pay off. The anti-pattern is *inconsistency* — enveloping some endpoints and not others.

Collection envelope:

```json
{
  "data": [ { "id": "ord_1" }, { "id": "ord_2" } ],
  "meta": { "total": 128 },
  "links": { "next": "/v1/orders?cursor=eyJpZCI6Im9yZF8yIn0" }
}
```

### Q6. How would you let clients request only the fields they need (sparse fieldsets / partial responses)?

Offer a `fields` query parameter so clients can shrink the payload and cut over-fetching:

```http
GET /v1/orders/ord_123?fields=id,status,total_amount HTTP/1.1
```
```json
{ "id": "ord_123", "status": "shipped", "total_amount": { "currency": "USD", "minor_units": 4999 } }
```

Design notes:

- **Whitelist** the selectable fields; don't blindly reflect arbitrary paths, or you invite injection and expose internals.
- Decide behavior for **nested** selection — `fields=customer.name` is powerful but complicates caching and validation; many APIs keep it top-level only.
- Sparse fieldsets interact with **caching**: each distinct field set is a distinct cache key. Keep it opt-in so the default (full resource) stays cacheable.
- This is a lighter-weight answer than GraphQL to the over-fetching problem — good enough when clients mostly want the full resource but occasionally need a slim version (mobile, list views).

### Q7. A client wants the customer object inline instead of just a `customer_id`. How do you design expansion/embedding?

Make it **opt-in** via an `expand` parameter so the default response stays small and cacheable, and clients trade round-trips for payload size only when they want to:

```http
GET /v1/orders/ord_123?expand=customer HTTP/1.1
```

Default (bare reference):
```json
{ "id": "ord_123", "customer_id": "usr_456" }
```

Expanded:
```json
{
  "id": "ord_123",
  "customer": { "id": "usr_456", "name": "alice", "email": "alice@acme.example.com" }
}
```

Design rules: cap expansion **depth** (one level, or an explicit allow-list like `expand=customer,customer.address`) to avoid unbounded fan-out and N+1 on your backend; keep the un-expanded form's field name predictable (`customer_id` → `customer`); and remember expansion couples cache lifetimes — the embedded customer may be staler or fresher than the order. For heavy aggregation across many relations, this is exactly where GraphQL starts to earn its keep.

### Q8. What's a DTO and why shouldn't you serialize your database entity straight to the client?

A **DTO** is a dedicated object representing the *wire shape*, deliberately separate from your persistence entity. Serializing the ORM entity directly couples two things that must evolve independently:

- **Evolution** — rename a column, add an index-only field, split a table, and your public contract shifts underneath clients. A DTO is a stable façade over a changing schema.
- **Security** — entities carry fields clients must never see (`password_hash`, `internal_notes`, soft-delete flags). Auto-serializing them is **excessive data exposure** (OWASP API3). A DTO exposes an explicit allow-list.
- **Shape** — the storage shape (normalized rows, foreign keys) is rarely the ideal API shape (nested, denormalized for the consumer).

```text
DB Entity (OrderRow)        DTO (OrderResponse)
------------------          -------------------
id, customer_fk,      -->   id, customer_id,
status_enum_int,            status (string),
fraud_score,   [drop]       total_amount {currency, minor_units}
shard_key,     [drop]
password_hash  [drop]
```

The mapping layer (manual, MapStruct, a serializer view) is cheap insurance. The cost of skipping it shows up the first time you refactor the DB and break every client — or leak a field you didn't know was there.

### Q9. What is a mass assignment vulnerability and how does payload design prevent it?

**Mass assignment** happens when you bind an incoming payload directly onto your model, letting a client set fields it was never meant to control:

```http
PATCH /v1/users/usr_456 HTTP/1.1
Content-Type: application/json

{ "name": "alice", "role": "admin", "account_balance": 1000000 }
```

If your handler does `user.update(request.body)`, the attacker just promoted themselves and topped up their balance. This is OWASP API6 (Mass Assignment / BOLA-adjacent).

**Fix:** never bind the raw body. Use an **input DTO with an explicit allow-list** of bindable fields:

```text
UpdateUserRequest { name?: string }   // role, balance are NOT bindable
```

Only `name` is deserialized and applied; `role` and `account_balance` are ignored or rejected. Frameworks that "helpfully" auto-bind everything (some ActiveRecord/Spring setups) are where this bites. The general rule: **inbound and outbound payloads are both explicit projections** — whitelist what a client can send, and whitelist what a client can receive.

### Q10. Design the response payload for a `GET /v1/orders/{id}` endpoint. Walk me through your choices.

```json
{
  "id": "ord_123",
  "object": "order",
  "status": "shipped",
  "line_items": [
    { "sku": "widget-a", "quantity": 2, "unit_amount": { "currency": "USD", "minor_units": 1500 } }
  ],
  "total_amount": { "currency": "USD", "minor_units": 3000 },
  "customer_id": "usr_456",
  "shipping_address": {
    "line1": "1 Market St", "city": "Springfield", "country": "US", "postal_code": "00001"
  },
  "created_at": "2026-07-01T09:12:44Z",
  "updated_at": "2026-07-01T11:03:10Z"
}
```

Choices I'd defend:

- **Opaque prefixed ID** and an `"object": "order"` type discriminator (Stripe-style) — self-describing in logs and polymorphic lists.
- **`status` as a string enum**, not an integer — readable, and I can add values additively.
- **Money as `{currency, minor_units}`** everywhere — line items and total use the identical shape.
- **`customer_id` as a bare reference**, expandable via `?expand=customer` — keeps the default lean.
- **ISO-8601 timestamps** with `created_at`/`updated_at` for caching and change tracking.
- **No internal fields** (fraud score, shard key) — the DTO is an explicit projection.

I'd return it **bare** (single resource) with an `ETag` header for conditional GETs, and reserve the envelope for the collection endpoint.

### Q11. How do you keep payloads consistent across a large API with many teams?

Consistency at scale is a **governance** problem, not a per-endpoint one:

- **A written style guide** — casing, date/money/ID formats, envelope rules, error shape, pagination shape. One document, enforced.
- **Automated linting** — Spectral rules on your OpenAPI spec fail CI when a field breaks convention (wrong casing, missing `description`, disallowed type).
- **Shared schema components** — define `Money`, `Address`, `Pagination`, `Error` once in OpenAPI `components` and `$ref` them everywhere, so every team uses the identical `Money` shape.
- **Design review** — a lightweight API review before an endpoint ships, catching the things a linter can't (semantics, resource modeling).

The failure mode without this is exactly the mixed-casing, three-different-money-formats API that erodes DX. Treat the style guide + linter as the "spellcheck" for your API surface.

### Q12. When should you nest data vs keep the payload flat?

Default to **flat**; nest only for genuine composition. Deep nesting hurts on three axes: it's harder to consume (long access paths), harder to version (changing nested structure ripples), and harder to page/filter.

Nest when the child is **owned by and only meaningful within** the parent — `order.line_items`, `order.shipping_address`. Don't nest independent resources that have their own identity and lifecycle — a full `customer` object doesn't belong permanently inside every order; use `customer_id` + opt-in expansion instead.

Rule of thumb: if a nested object has its own `id` and its own endpoint, it's a **reference** (link it, expand on demand); if it has no independent existence, it's a **value** (inline it). This keeps payloads shallow by default and lets clients pull depth only when they ask.

### Q13. Should a client be able to send fields your server doesn't recognize? How do you handle unknown fields?

Two philosophies, and you should pick deliberately:

- **Tolerant / lenient (Postel's law)** — ignore unknown request fields silently. Maximizes forward-compatibility; an older server tolerates a newer client. Risk: a client typos `quantiy` and gets no feedback that it was dropped.
- **Strict** — reject unknown fields with `400`/`422`. Catches typos and mass-assignment attempts early; costs you the ability to accept-and-ignore future fields.

A common pragmatic stance: **strict on inbound** (reject unknown fields so typos and injected fields surface immediately — this doubles as mass-assignment defense), **tolerant on outbound** (clients must ignore unknown *response* fields so you can add them additively). Document which you do. The outbound-tolerant-reader expectation is what makes additive evolution safe — state it in your developer docs so clients don't hard-fail on a new field.

### Q14. How do you design a payload that's easy to evolve without breaking clients?

Design for **additive change** from day one:

- **Clients are tolerant readers** — publish that they must ignore unknown fields. Now adding a field is non-breaking.
- **Prefer optional over required** for new fields — a new required field breaks every existing client immediately.
- **Use string enums, not integers or booleans, for anything that might grow** — `status: "shipped"` can gain `"returned"` additively; a boolean `is_shipped` can't represent a third state without a breaking change.
- **Objects over primitives at extension points** — return `total_amount: { currency, minor_units }` rather than a bare number, so you can add `formatted` later without a breaking type change. Wrapping a value in an object early is cheap insurance.
- **Never repurpose a field's meaning** — changing what `status: "active"` means is a silent breaking change worse than a rename.

Breaking changes (rename, remove, tighten a type, make optional→required) go behind a new version. Everything additive ships in place.

### Q15. Spot the problems in this endpoint's response and fix it.

Bad:
```json
{
  "userId": 4021,
  "Name": "alice",
  "balance": 199.99,
  "created": 1719824764,
  "passwordHash": "$2b$10$abc...",
  "is_deleted": false,
  "roles": "admin,user"
}
```

Problems: (1) mixed casing (`userId`, `Name`, `balance`); (2) integer ID leaks volume and invites enumeration; (3) float money; (4) ambiguous epoch timestamp; (5) **`passwordHash` leaked** — excessive data exposure; (6) internal `is_deleted` soft-delete flag leaked; (7) `roles` as a CSV string instead of an array.

Fixed:
```json
{
  "id": "usr_4021",
  "name": "alice",
  "balance": { "currency": "USD", "minor_units": 19999 },
  "created_at": "2026-07-01T09:12:44Z",
  "roles": ["admin", "user"]
}
```

Consistent snake_case, opaque prefixed ID, money as minor units with currency, ISO-8601 timestamp, no leaked secrets/internals (the DTO drops `password_hash` and `is_deleted`), and `roles` as a proper array so clients don't string-split.

### Q16. How do request payloads for POST vs PUT vs PATCH differ in shape?

The verb dictates what the body means, which shapes the payload:

| Method | Body semantics | Shape |
|---|---|---|
| `POST` (create) | The fields to create; server assigns ID/timestamps | Full resource *minus* server-owned fields |
| `PUT` (full replace) | The **complete** new representation | Every writable field; omitted field = set to default/null |
| `PATCH` (partial) | Only the fields to change | Sparse — present keys are changed, absent keys untouched |

The subtle one is `PUT` vs `PATCH` semantics around omission. `PUT` is a **replace** — if a client omits `nickname`, a strict `PUT` should treat it as cleared (that's what makes `PUT` idempotent). `PATCH` is a **merge** — an omitted `nickname` means "leave it alone," and `null` means "clear it." That's exactly why the null-vs-absent distinction (Q4) matters most in `PATCH`.

```http
PATCH /v1/users/usr_456 HTTP/1.1
Content-Type: application/json

{ "nickname": "al" }
```
changes only `nickname`. A `PUT` to the same URL must send the entire user representation, or unspecified fields get reset. For structured partial updates, JSON Merge Patch (RFC 7396) or JSON Patch (RFC 6902) formalize this; JSON Merge Patch matches the intuitive "send the changed fields" model.

## Error Handling & Status Codes

### Summary

**What this topic covers**

Errors are half your API surface and the half clients spend the most frustrated hours on — yet they're the most neglected part of most designs. This topic covers how to return failures *well*: a single consistent error model used by every endpoint, the **RFC 7807 `application/problem+json`** standard for that model, the split between machine-readable error **codes** and human-readable **messages**, how to return **arrays** of validation errors instead of one-at-a-time, choosing the right **status code** (4xx client vs 5xx server, and the sharp 400-vs-422-vs-409 distinctions), signaling **retryability**, and the security discipline of not leaking stack traces or internals in error bodies. The 16 questions run from warm-ups (which status code for X, 4xx vs 5xx) to senior scenarios (design an error contract clients can program against, localize errors, make failures actionable). Good error design is a top-tier DX signal — it's the difference between a client that self-serves and one that opens a support ticket.

**Mental model**

Every error response has **two audiences**, and a good design serves both without confusing them. The **machine** (client code) needs a stable, enumerated `type`/`code` it can branch on — `card_declined`, `rate_limited`, `validation_failed` — plus the HTTP status for coarse routing. The **human** (a developer reading logs, or an end user) needs a clear message explaining what went wrong and, ideally, how to fix it. Keep these strictly separate: **never make clients parse the human message** to decide behavior, because you'll want to reword or localize it and you'll break them. The second axis is **whose fault and can-it-be-retried**: 4xx means "you (the client) did something wrong — don't retry unchanged"; 5xx means "we failed — retrying the same request may work." Every error you design should answer three questions for the client: *what category* (status), *what specifically* (code), and *what now* (retry? fix a field? re-authenticate?). If your error body doesn't let a client answer "what do I do next" from data alone, it's underdesigned.

**Key terms**

- **RFC 7807 / `problem+json`** — a standard error body with `type`, `title`, `status`, `detail`, `instance`, plus custom extension members.
- **Error code** — a stable, machine-readable string (`insufficient_funds`) clients branch on; distinct from the HTTP status.
- **Human message** — a readable `detail` string for developers/users; may be reworded or localized, so never load-bearing for logic.
- **Validation error array** — a list of field-level problems (`{field, code, message}`) returned together, not one at a time.
- **4xx (client error)** — the request was wrong; retrying it unchanged won't help.
- **5xx (server error)** — the server failed; the request may be valid and retryable.
- **400 Bad Request** — malformed/unparseable request (bad JSON, wrong types).
- **422 Unprocessable Entity** — syntactically valid but semantically invalid (failed business/validation rules).
- **409 Conflict** — the request conflicts with current resource state (version conflict, duplicate, concurrent update).
- **Retryable** — whether the client should retry, often signaled with `Retry-After` and idempotency guidance.
- **Idempotency key** — lets a client safely retry a non-idempotent request without duplicate side effects.

**Why interviewers ask this**

Error design instantly separates people who've operated a public API from people who've only built the happy path. Junior answers return `500` for everything, put the reason in a bare string, and leak the exception. Senior answers reach for a **consistent, documented error contract**: one shape everywhere, stable codes clients program against, a validation *array* so a form shows every bad field at once, correct status codes (they know `400` is "I can't parse this" and `422` is "I parsed it but it's invalid"), explicit retryability, and *no* stack traces on the wire. The strongest signal is talking about errors as a **product for the client developer** — "the client should be able to render a useful message and decide next steps from the response body alone, without scraping prose." That framing, plus naming the security angle (leaking stack traces is information disclosure, an OWASP concern), is what "senior" sounds like here.

**Common confusions**

- "Return `200` with an `error` field in the body." This breaks HTTP semantics, defeats caching/monitoring, and forces every client to double-check success. Use real status codes.
- "`400` for all client errors." `400` is for malformed requests; use `422` for valid-but-invalid, `401`/`403` for auth, `404`/`409`/`429` for their specific cases.
- "The message is the contract." It isn't — the **code** is. Messages get reworded and localized; clients must branch on codes.
- "`401` and `403` are interchangeable." `401` = not authenticated (who are you?); `403` = authenticated but not allowed (I know who you are, no).
- "5xx means retry, always." Only retry 5xx on **idempotent** operations or with an idempotency key; blindly retrying a non-idempotent `POST` can double-charge.
- "More detail is always better." Leaking stack traces, SQL, and internal hostnames is an information-disclosure vulnerability, not helpfulness.

**What follows from this topic**

The error contract is the backbone that other topics plug into. **Rate limiting** returns a `429` with `Retry-After` — an error with explicit retryability. **Idempotency & reliability** depends on the 4xx/5xx-and-retry framing to decide when a retry is safe. **Validation** errors are the flip side of the required/optional/nullable rules from **Request & Response Design**. **Auth** produces the `401`/`403` distinction. And the "don't leak internals" rule is a direct **API Security** concern (information disclosure). A consistent, documented error model is also a **versioning** commitment — the error shape is part of your contract, so evolve it as carefully as your success payloads.

### Q1. Design a consistent error model for an API. What does the body look like?

I'd standardize on **RFC 7807 `application/problem+json`** with a couple of extension members, used by *every* endpoint:

```http
HTTP/1.1 422 Unprocessable Entity
Content-Type: application/problem+json

{
  "type": "https://api.example.com/problems/validation-error",
  "title": "Your request parameters didn't validate.",
  "status": 422,
  "detail": "The 'email' field must be a valid email address.",
  "instance": "/v1/users",
  "code": "validation_failed",
  "request_id": "req_abc123",
  "errors": [
    { "field": "email", "code": "invalid_format", "message": "Must be a valid email address." }
  ]
}
```

The load-bearing parts: a **stable `code`** the client branches on; a human `detail`/`title` for display; the **HTTP status** for coarse handling; a `request_id` so a developer can quote it to support and I can find it in logs; and an **`errors` array** for field-level detail. Every endpoint returns this exact shape for every failure — that consistency is the whole point. A client writes one error handler, not one per endpoint.

### Q2. What is RFC 7807 (problem+json) and why use it instead of a homegrown format?

RFC 7807 (updated by RFC 9457) defines a **standard problem-details media type**, `application/problem+json`, with agreed-on fields so clients and tools don't have to learn your bespoke shape:

- **`type`** — a URI identifying the problem class (also a link to docs).
- **`title`** — short, human-readable summary of the problem type.
- **`status`** — the HTTP status code, duplicated in the body.
- **`detail`** — human-readable explanation specific to this occurrence.
- **`instance`** — a URI for this specific occurrence.
- Plus **extension members** — add your own (`code`, `errors`, `request_id`).

Why use it over rolling your own: it's a **published standard**, so SDKs, gateways, and developers recognize it; the `type` URI doubles as self-documentation; and it gives you a place for both machine (`type`/`code`) and human (`title`/`detail`) info without you re-inventing the structure. You still add a stable `code` extension for branching (the `type` URI works too, but a short `code` is friendlier). The point isn't the exact fields — it's that "use the standard" beats "invent a new error shape every team argues about."

### Q3. Why separate a machine-readable error code from the human-readable message?

Because they have **different audiences and different lifecycles**. The message is prose for a human — it gets reworded for clarity, localized into other languages, and A/B-tested. The code is an API for a machine — the client `switch`es on it to decide behavior. If clients branch on the message text, then the moment you fix a typo or translate it, their code breaks:

```text
// Fragile — breaks when you reword the message
if (error.message == "Insufficient funds") { promptTopUp() }

// Robust — branches on the stable code
if (error.code == "insufficient_funds") { promptTopUp() }
```

So: **codes are a versioned contract** (stable, enumerated, documented); **messages are UI** (mutable, localizable, human-facing). Publish the full list of codes per endpoint in your docs so clients know what to handle. This separation is also what makes localization clean — the code stays constant while the message varies by `Accept-Language`.

### Q4. How do you return validation errors for a form with multiple bad fields?

Return **all** the field errors at once in an array, not the first one you hit. A user filling a form should see every problem in one round-trip, not fix-submit-discover-next-error five times:

```http
HTTP/1.1 422 Unprocessable Entity
Content-Type: application/problem+json

{
  "type": "https://api.example.com/problems/validation-error",
  "title": "Validation failed",
  "status": 422,
  "code": "validation_failed",
  "errors": [
    { "field": "email", "code": "invalid_format", "message": "Must be a valid email." },
    { "field": "age", "code": "out_of_range", "message": "Must be between 18 and 120." },
    { "field": "password", "code": "too_short", "message": "Must be at least 8 characters." }
  ]
}
```

Each entry has a **`field`** (so the client can attach the message to the right input — support dotted paths like `address.postal_code` for nested fields), a **`code`** (machine-branchable), and a **`message`** (display). Validate the whole payload and collect all failures before responding. This is a small design choice with an outsized DX and UX payoff.

### Q5. When do you return 4xx vs 5xx? Why does the boundary matter?

**4xx = the client's request was wrong**; retrying it unchanged won't help — fix the request. **5xx = the server failed**; the request may be perfectly valid and worth retrying.

The boundary matters for three reasons:

- **Retry behavior** — clients and SDKs retry 5xx (with backoff), not 4xx. Mislabel a bad request as `500` and clients hammer you retrying something that will never succeed.
- **Alerting** — you page on-call for a 5xx spike (your fault), not a 4xx spike (clients sending bad input). Return `500` for validation failures and you'll wake up the on-call for user typos.
- **Responsibility signaling** — it tells the developer where to look: their code (4xx) or yours (5xx).

Concretely: bad input, missing auth, not found, conflict, rate limit → 4xx. Unhandled exception, downstream timeout, DB down → 5xx. A common bug is catching an exception and returning `400` when the real cause was a server fault (or vice versa) — get the attribution right or you corrupt both your metrics and your clients' retry logic.

### Q6. 400 vs 422 vs 409 — walk me through when each applies.

All three are 4xx, but they mean different things:

| Status | Meaning | Example |
|---|---|---|
| **400 Bad Request** | Malformed — the server can't even parse/understand it | Invalid JSON, wrong content-type, a string where a number is required |
| **422 Unprocessable Entity** | Well-formed but **semantically invalid** — parsed fine, failed business/validation rules | Valid JSON, but `age: -5`, or `email` isn't a valid email |
| **409 Conflict** | The request conflicts with the **current state** of the resource | Optimistic-lock version mismatch, duplicate unique key, editing something already deleted |

The 400/422 line is "can I parse it?" — if the JSON is broken or a field has the wrong *type*, that's `400`; if it parses but breaks a *rule*, that's `422`. (Note: some APIs use `400` for both and reserve nothing for `422`; that's defensible, but `422` gives clients a cleaner signal that "your data structure is fine, your values aren't.")

`409` is about **state**, not the payload: two clients update the same record concurrently (return `409` with the current version), or a client tries to create a resource that already exists. `409` often pairs with an `ETag`/`If-Match` optimistic-concurrency scheme.

### Q7. How do you signal to a client that an error is retryable?

Make retryability **explicit in the response**, don't make clients guess from the status alone:

- **Use the right status** — 5xx and `429` are the retryable family; most 4xx are not.
- **Send `Retry-After`** on `429` and `503` — a delay in seconds or an HTTP date telling the client *when* to retry:
  ```http
  HTTP/1.1 503 Service Unavailable
  Retry-After: 5
  ```
- **Add a machine field** in the body for clarity — e.g. `"retryable": true` or a `code` whose retry semantics are documented.
- **Guide safe retries** — document exponential backoff **with jitter**, and require an **idempotency key** for non-idempotent operations so a retry can't double-charge.

The anti-pattern is a client that retries everything (hammering you on permanent 4xx failures) or nothing (giving up on transient blips). A well-designed error tells the client exactly which of those to do. For non-idempotent `POST`s, retryability is only safe *with* an idempotency key — link the two in your docs.

### Q8. Why is leaking a stack trace in an error response a problem, and what do you return instead?

A stack trace on the wire is an **information-disclosure vulnerability**. It reveals your framework and versions (fuel for known-CVE attacks), internal class/file paths and hostnames, SQL fragments and table names (aiding injection), and business logic structure. It's noise to the legitimate client and a map to an attacker.

Instead, return a **clean, generic** problem+json body and put the detail server-side:

```http
HTTP/1.1 500 Internal Server Error
Content-Type: application/problem+json

{
  "type": "https://api.example.com/problems/internal-error",
  "title": "Something went wrong on our end.",
  "status": 500,
  "code": "internal_error",
  "request_id": "req_abc123"
}
```

The **`request_id`** is the trick: the client can quote it to support, and you correlate it to the full stack trace, SQL, and context in your logs — where that detail belongs. So the developer still gets everything they need to debug, just not over the public wire. Configure your framework to *never* return debug error pages in production (a common misconfiguration — OWASP API8, Security Misconfiguration).

### Q9. How would you localize error messages while keeping the API stable?

Keep the **code stable and translate only the message**. The code is the contract; the message is presentation:

- Client sends `Accept-Language: fr-FR`.
- Server keeps `code: "insufficient_funds"` constant and returns the `detail`/`message` in French.

```http
GET /v1/orders HTTP/1.1
Accept-Language: fr-FR
```
```json
{
  "code": "insufficient_funds",
  "detail": "Fonds insuffisants pour effectuer cette transaction."
}
```

Two viable patterns: (1) the server localizes the message from a resource bundle keyed by the code + locale; or (2) the server returns only stable **codes plus structured parameters** (`{ "code": "out_of_range", "params": { "min": 18, "max": 120 } }`) and the **client** renders the localized string from its own message catalog. Pattern (2) is cleaner for public APIs — you don't ship translations, and the client controls its own UX copy — but requires clients to maintain a code→message map. Either way, **branching logic keys off the code, never the localized text**, so translation never breaks a client.

### Q10. What makes an error "actionable" — how do you design errors a client can actually respond to?

An actionable error lets the client decide *what to do next* from the response **data alone**, without a human reading prose. Design for the client's decision tree:

- **A stable `code`** to branch on (`card_declined` vs `rate_limited` vs `validation_failed`).
- **The specific field** for validation errors (`errors[].field`), so the client highlights the right input.
- **A retry signal** (`Retry-After`, `retryable`) so the client knows whether to back off or give up.
- **A next-step hint** where it helps — a `type` URL to docs, or structured params (which field, what limit, what the current state is).

Contrast:

```json
// Not actionable — client can only show the string and shrug
{ "error": "Payment failed" }

// Actionable — client can route: prompt re-auth? retry? show field error?
{ "code": "card_declined", "decline_reason": "insufficient_funds",
  "detail": "The card was declined.", "retryable": false }
```

The test: could a client write a `switch` on this error and do the right thing for each case? If the only reasonable client response is "display the message," the error is underdesigned.

### Q11. Which status code for each: unauthenticated, unauthorized, not found, rate limited, gone?

| Situation | Status | Notes |
|---|---|---|
| No/invalid credentials | **401 Unauthorized** | "Who are you?" — send `WWW-Authenticate`. Misnamed: it's about *authentication*. |
| Authenticated but not permitted | **403 Forbidden** | "I know you, you can't." Don't retry with same creds. |
| Resource doesn't exist | **404 Not Found** | Also used to *hide* existence of a resource the caller can't see (see Q14). |
| Too many requests | **429 Too Many Requests** | Pair with `Retry-After` + `RateLimit-*` headers. |
| Resource permanently removed | **410 Gone** | Stronger than 404: "existed, deliberately removed, stop asking." Useful for deprecated/sunset resources. |

The sharpest distinction is **401 vs 403**: `401` means you haven't proven who you are (authentication missing/invalid — fix your credentials); `403` means you're authenticated fine but lack permission (authorization — fixing credentials won't help). Getting these backwards confuses clients about whether re-authenticating will help. `410` vs `404` is a subtler but useful signal: `410` tells clients (and crawlers) to permanently stop requesting, which is handy when you retire an endpoint or resource.

### Q12. A client sends valid JSON but violates a business rule (e.g. order total exceeds credit limit). What do you return?

This is a **`422 Unprocessable Entity`** — the request parsed perfectly, it just violates a domain rule. Not `400` (nothing's malformed), not `500` (nothing failed on our side — the client did something the business logic disallows):

```http
HTTP/1.1 422 Unprocessable Entity
Content-Type: application/problem+json

{
  "type": "https://api.example.com/problems/credit-limit-exceeded",
  "title": "Order exceeds available credit.",
  "status": 422,
  "code": "credit_limit_exceeded",
  "detail": "Order total of 5000.00 USD exceeds available credit of 3200.00 USD.",
  "available_credit": { "currency": "USD", "minor_units": 320000 },
  "requested_amount": { "currency": "USD", "minor_units": 500000 }
}
```

Note the **structured extension members** (`available_credit`, `requested_amount`) — they make the error actionable: the client can show the shortfall and offer a partial order without parsing the prose. A stable `code` lets the client branch specifically on this business failure. This is the difference between an error that just says "no" and one that says "no, here's exactly why, and here's the data to help the user fix it."

### Q13. Should you ever return 200 OK with an error inside the body? Why or why not?

**No** — for a genuine failure, return the real status code. Returning `200` with `{ "success": false, "error": ... }` breaks the ecosystem in several ways:

- **Every client must double-check** — they can't trust the status line, so they parse the body on every response, defeating the point of status codes.
- **Infrastructure lies** — load balancers, CDNs, monitoring, and retry libraries all key off the status code. A `200` "error" shows up as success in your dashboards, hiding real failure rates.
- **Caching misbehaves** — a `200` may get cached; an error shouldn't be.

The one legitimate gray area is **partial success** in aggregate/batch or GraphQL responses, where *some* operations succeed and some fail. GraphQL famously returns `200` with a top-level `errors` array because a single response can carry partial data. Even there, transport-level failures still use HTTP status codes; the `200`+`errors` is only for per-field partial results. Outside that batch/GraphQL case, map failures to their proper 4xx/5xx status — don't smuggle errors through `200`.

### Q14. How do you design errors so they don't leak whether a resource exists (BOLA/enumeration)?

The risk: if `GET /v1/orders/ord_999` returns `403` when the order exists-but-isn't-yours and `404` when it doesn't exist, an attacker can **enumerate** valid IDs by watching which status comes back — a form of BOLA/IDOR reconnaissance (OWASP API1).

Mitigations:

- **Return `404` for both** "doesn't exist" and "exists but you can't see it" — from the caller's perspective, a resource they can't access effectively doesn't exist. This hides existence.
- **Use opaque, non-sequential IDs** (`ord_a1b2c3`, UUID/ULID) so IDs can't be guessed or walked incrementally in the first place.
- **Keep error bodies identical** across the two cases — same `code`, same message, same timing where feasible, so nothing distinguishes them.
- **Rate-limit** to blunt bulk enumeration.

The tension: `403` is more *honest* and can be better DX for internal APIs where the caller legitimately should know "this exists but you lack permission." For **public or multi-tenant** APIs handling sensitive resources, prefer the `404`-for-everything approach — the small DX cost buys real protection against object enumeration. Decide per sensitivity, and document it.

### Q15. How do you keep error handling consistent across dozens of endpoints and teams?

Centralize it so no endpoint hand-rolls its own errors:

- **One shared error schema** — define the problem+json shape once in OpenAPI `components` and `$ref` it from every endpoint's error responses. Every team returns the identical structure.
- **A global exception handler / middleware** — a single layer maps exceptions to problem+json (Spring `@ControllerAdvice`, Express error middleware, an ASP.NET exception filter). Individual handlers throw typed exceptions; the middleware formats them. This guarantees no raw stack trace ever escapes.
- **A published catalog of error codes** — a documented registry of every `code`, its status, meaning, and whether it's retryable, so clients know what to handle and teams don't invent overlapping codes.
- **Contract tests + linting** — Spectral rules assert every endpoint documents `4xx`/`5xx` with the shared schema; contract tests assert real responses match.

The failure mode without this is exactly what clients hate: `{"error": "..."}` on one endpoint, `{"message": "..."}` on another, a raw stack trace on a third. Consistency here is the difference between one client-side error handler and fifty.

### Q16. How does the error contract interact with API versioning?

The error shape is **part of your contract**, so the same evolution rules apply as to success payloads. Concretely:

- **Adding a new error `code`** is a **breaking-ish** change to watch — a client that only handles known codes may not have a case for it. Design clients to have a **default/fallback** branch for unrecognized codes (treat unknown 4xx as "client fix needed," unknown 5xx as "retryable"), and document that expectation. Then adding codes stays safe.
- **Changing the error *structure*** (renaming `code`, moving `errors`) is a **breaking change** — it belongs in a new API version, exactly like renaming a success field.
- **Changing a code's *meaning*** or the status a condition returns (e.g. flipping a `422` to `409`) is a silent breaking change — clients branch on these. Avoid it; if unavoidable, version it.
- **Removing a code** breaks clients that handle it — deprecate first.

So: additive new codes are fine **if** clients are built to tolerate unknown codes (state this in your docs, the error-handling equivalent of the tolerant-reader rule). Structural changes to the error body go behind a version bump. Treat problem+json fields with the same care as any other published response schema.

## Pagination, Filtering & Sorting

### Summary

**What this topic covers**

Any endpoint returning a collection has to answer: how does a client get page 2, filter the results, and sort them — without you dumping ten million rows or letting the list shift under their feet? This topic covers the three big pagination strategies (**offset/limit**, **cursor/keyset**, and opaque **page tokens**) and their sharp tradeoffs around deep-page cost and result **drift/stability**; whether and how to return **total counts**; consistent list **envelopes** with `next` links/tokens; **filtering** syntax; **sorting**; **search**; and the special problem of paging large, high-churn collections. The 16 questions span warm-ups (design a paginated endpoint, offset vs cursor) to senior scenarios (page a feed that's being written to constantly, why deep offset pages are slow, design a filtering DSL that doesn't become SQL injection). Collection endpoints are among the most-hit in any API, so getting pagination right is both a correctness issue (no dupes, no skips) and a performance issue (deep pages must stay cheap).

**Mental model**

Pagination is fundamentally about **where you keep the "where was I" bookmark** and **how stable that bookmark is as data changes**. Offset pagination bookmarks by *position* — "skip 40, take 20" — which is intuitive but has two flaws: the database must scan and discard all skipped rows (deep pages get linearly slower), and if rows are inserted/deleted before your position, page 3 either repeats or skips items (drift). Cursor/keyset pagination bookmarks by *value* — "give me the 20 rows after the one with `(created_at, id) = (X, Y)`" — which stays O(page size) at any depth and is stable against inserts/deletes elsewhere, at the cost of no random access to "page 500" and requiring a stable sort key. The mental unlock: **offset answers "which page number," cursor answers "what comes after this specific row."** For anything large, real-time, or public, you want the cursor model. Filtering and sorting layer on top — but every sort key you expose must be part of the pagination key, and every filter must be an allow-listed, parameterized operation, never string-concatenated into a query.

**Key terms**

- **Offset/limit** — `?offset=40&limit=20` (or `page=3`); skip N, take M. Simple, supports jumping to a page, but slow deep and drifts.
- **Cursor/keyset pagination** — page by a stable key value (`?after=<cursor>`); O(page) at any depth, stable, but no random page access.
- **Page token** — an **opaque** cursor (base64-encoded state) the client passes back verbatim; hides implementation and lets you change it server-side.
- **Deep-page cost** — offset's linear slowdown: the DB scans and discards all skipped rows to reach a high offset.
- **Drift / instability** — pages repeat or skip items because the collection changed (inserts/deletes) between requests.
- **Total count** — the full number of matching items; often expensive to compute and frequently omitted or estimated in cursor schemes.
- **`next` link / token** — a server-provided pointer to the next page, so clients don't construct pagination themselves.
- **Filtering** — narrowing results by field predicates (`?status=shipped&created_after=...`).
- **Sorting** — ordering results (`?sort=-created_at`); the sort key must be stable and, for cursors, part of the key.
- **Keyset tie-breaker** — a unique second sort key (usually the ID) appended so the cursor is unambiguous when the primary key has ties.

**Why interviewers ask this**

This is one of the fastest senior/junior filters in API design. A junior reaches for `?page=2&limit=20` and stops — no thought about what happens at page 50,000 or when the underlying data is changing. A senior immediately raises the two failure modes — **deep-page performance** and **drift** — and reaches for **keyset/cursor** pagination for large or live datasets, explaining the tradeoff (loses random page access, needs a stable ordered key + tie-breaker). Interviewers also probe the details that reveal real experience: do you know exact total counts are expensive at scale (and often replaced with "has more" or estimates)? Do you return **opaque tokens** so you can change the implementation without breaking clients? Do you parameterize filters instead of building a string-concatenated query (an injection vector)? Talking fluently about cursor-vs-offset tradeoffs, with concrete request/response examples, is a strong signal you've operated a real list endpoint at scale.

**Common confusions**

- "Cursor pagination is just prettier offset." No — it changes the *query*: cursors use a `WHERE key > ?` seek (index range scan), not `OFFSET N` (scan-and-discard). That's the whole performance point.
- "Always return a total count." Exact counts are expensive on large filtered sets and often meaningless on live data; many APIs return "has more," an estimate, or nothing.
- "Cursors let you jump to any page." They don't — you can only go next (and sometimes prev). If you need "jump to page 500," you need offset (and accept its cost).
- "Filtering is just appending to the WHERE clause." Only if parameterized and allow-listed — naive concatenation is SQL injection, and unbounded filters are a performance and abuse risk.
- "Offset drift is rare." On any actively written collection (feeds, logs, orders), inserts/deletes during paging routinely cause duplicates or gaps.
- "The client should build the next-page URL." Prefer the server hand it a `next` link/token so you can evolve the scheme without breaking clients.

**What follows from this topic**

Pagination cements the **envelope** decision from Request & Response Design — a paged list is an envelope with `data`, `meta`, and `links`. The **opaque token** idea is the same tolerant-evolution discipline from Versioning: hide the cursor's internals so you can change them freely. Filter and sort inputs are validated inputs, so they connect to **Error Handling** (a bad `sort` field is a `400`/`422` with a clear code) and to **API Security** (unbounded or injectable filters are an abuse and injection surface — OWASP). Cursor pagination also shows up again in **GraphQL** (the Relay Connections spec is cursor pagination formalized) and interacts with **caching** (offset pages cache poorly on live data; stable cursors cache better). Get the collection contract right and every list endpoint in your API inherits it.

### Q1. Design a paginated endpoint for `GET /v1/orders`. What does the request and response look like?

For a public, potentially large collection I default to **cursor pagination** with an opaque token and a consistent envelope:

```http
GET /v1/orders?limit=20&status=shipped&sort=-created_at HTTP/1.1
```
```json
{
  "data": [
    { "id": "ord_501", "status": "shipped", "created_at": "2026-07-01T10:00:00Z" },
    { "id": "ord_487", "status": "shipped", "created_at": "2026-07-01T09:41:00Z" }
  ],
  "meta": { "limit": 20, "has_more": true },
  "links": {
    "next": "/v1/orders?limit=20&status=shipped&sort=-created_at&after=eyJjcmVhdGVkX2F0IjoiMjAyNi0wNy0wMVQwOTo0MTowMFoiLCJpZCI6Im9yZF80ODcifQ"
  }
}
```

The client just follows `links.next` until it's absent (or `has_more` is false); it never constructs the cursor. Choices I'd defend: a **default and max `limit`** (say default 20, cap 100) so a client can't request a million rows; a **`has_more`** boolean rather than an expensive exact total; the **filter and sort echoed into `next`** so paging stays consistent; and an **opaque `after` token** so I can change the underlying keyset without breaking clients. For a small, admin-only list where jump-to-page matters, I'd instead offer offset — but I'd say so explicitly and note the tradeoff.

### Q2. Offset/limit vs cursor/keyset pagination — compare them.

| | Offset/limit | Cursor/keyset |
|---|---|---|
| Request | `?offset=40&limit=20` | `?after=<cursor>&limit=20` |
| Query | `... ORDER BY k LIMIT 20 OFFSET 40` | `... WHERE k > ? ORDER BY k LIMIT 20` |
| Deep-page cost | O(offset) — scans + discards skipped rows | O(limit) — index seek, constant at any depth |
| Stability under writes | Drifts — inserts/deletes shift positions (dupes/skips) | Stable — bookmark is a value, not a position |
| Random access | Yes — jump to any page number | No — only next (and maybe prev) |
| Total count | Easy to bolt on | Awkward/expensive; usually "has_more" instead |
| Implementation | Trivial | Needs a stable, unique ordered key |

**Bottom line:** offset is fine for **small, mostly-static, admin/internal** lists where "go to page 7" matters. Cursor is the right default for **large, live, or public** collections — it's fast at any depth and doesn't duplicate or skip items when the data changes. The classic bug offset hides: on an actively written feed, by the time a user reaches page 3, new inserts at the top have pushed everything down, so they see item #40 again. Cursor pagination is immune because it says "after *this specific row*," not "skip 40 positions."

### Q3. Why are deep offset pages slow, and how does keyset pagination fix it?

`OFFSET 100000 LIMIT 20` doesn't magically jump to row 100,000 — the database must **generate and discard the first 100,000 rows** in sort order to find where to start, then return the next 20. Cost grows linearly with the offset, so page 5,000 is dramatically slower than page 1 even though both return 20 rows. On a big table this turns into multi-second queries and table/index scans.

**Keyset (seek) pagination** replaces "skip N" with "seek past a value":

```sql
-- Offset: scans and throws away 100,000 rows
SELECT * FROM orders ORDER BY created_at DESC, id DESC LIMIT 20 OFFSET 100000;

-- Keyset: index seek straight to the position, reads only 20 rows
SELECT * FROM orders
WHERE (created_at, id) < ('2026-07-01T09:41:00Z', 'ord_487')
ORDER BY created_at DESC, id DESC
LIMIT 20;
```

With an index on `(created_at, id)`, the keyset query is an **index range scan** that reads only the 20 rows it returns — **O(page size) regardless of depth**. The cursor encodes the last row's `(created_at, id)`. The catch is you can only move forward/backward from a known row, not jump to an arbitrary page number — which is exactly the tradeoff you accept to make deep pages cheap.

### Q4. What is a page token / opaque cursor and why encode it instead of exposing raw values?

A **page token** is an opaque, usually base64-encoded blob that carries the pagination state — the keyset values, sort, and filters — which the client passes back verbatim without interpreting it:

```text
Decoded cursor:  {"created_at":"2026-07-01T09:41:00Z","id":"ord_487","sort":"-created_at"}
Encoded token:   eyJjcmVhdGVkX2F0IjoiMjAyNi0wNy0wMVQwOTo0MTowMFoiLCJpZCI6Im9yZF80ODcifQ
```

Why make it opaque rather than exposing `?after_created_at=...&after_id=...`:

- **Freedom to evolve** — because the client treats it as a black box, you can change the internal keyset (add a tie-breaker, switch sort columns) without breaking anyone. This is the same tolerant-evolution discipline as versioning.
- **Encapsulation** — clients can't construct or tamper with cursors, so they can't request internally inconsistent states (mismatched sort + cursor).
- **Integrity** — you can sign or HMAC the token so a client can't forge one to probe arbitrary keyset positions.

The rule: the client's only valid operation on a token is "pass it back." Document it as opaque so nobody parses it and then complains when you change the format. Google's AIP and the Relay Connections spec both formalize this pattern.

### Q5. Should you return a total count? What are the costs?

Not always — and often you shouldn't. An **exact** total (`COUNT(*)` over the filtered set) is expensive at scale: on a large table with a filter, it can require scanning a large index or the table itself, and it competes with the actual page query. On a live collection the count is also **stale the instant you return it**.

Options, cheapest to most expensive:

- **`has_more: true/false`** — fetch `limit + 1` rows; if you got an extra, there's a next page. Nearly free, and usually all a "Load more" UI needs.
- **Estimated count** — use table statistics / an approximate count for a rough "~12,000 results." Good for search UIs.
- **Exact count** — only when the product genuinely needs it (e.g. "page 7 of 340") and the dataset/filter makes it affordable, possibly cached.

For cursor pagination, exact totals are especially awkward (you're deliberately not scanning the whole set), so `has_more` is the norm. My default: return `has_more`, offer an estimate for search, and compute exact totals only when a real requirement justifies the cost. Don't reflexively bolt a `total` onto every list — it's often the most expensive field in the response.

### Q6. How do you keep pagination stable when the underlying collection is changing constantly (e.g. an activity feed)?

Use **cursor/keyset pagination** — it's the direct fix for drift. Because the cursor bookmarks a specific row's value ("give me items created before `ord_487`"), inserts at the top of the feed don't shift the client's position: they simply appear on the *previous* boundary, and the client's "next page" still correctly continues after the last row it saw. No duplicates, no skips.

```http
GET /v1/feed?limit=20&after=eyJpZCI6Iml0ZW1fNDg3In0 HTTP/1.1
```

Contrast with offset: if 5 new items are inserted while the user reads page 1, then `OFFSET 20` on page 2 now points 5 rows too early, so they re-see 5 items they already saw. On a busy feed this happens constantly.

Additional techniques for live collections:

- **Immutable sort key** — sort by something that doesn't change for a row (creation time + ID), so a row can't jump pages because a mutable field changed.
- **Snapshot/anchor cursors** — encode a "paginate as of time T" anchor so the whole traversal reflects a consistent view, ignoring items added after the traversal began (good for exports).
- **Tie-breaker** — always append a unique key (`id`) so rows with identical timestamps have a deterministic, unambiguous order.

### Q7. Design a filtering syntax for a collection endpoint. How do you keep it safe and consistent?

Start with the **simplest thing that works** — flat query params with an implicit `AND` and an allow-listed set of filterable fields:

```http
GET /v1/orders?status=shipped&created_after=2026-06-01T00:00:00Z&min_total=1000 HTTP/1.1
```

When you need operators, adopt a **consistent, documented convention** rather than ad hoc params — e.g. bracket operators or field-suffixes:

```http
GET /v1/orders?created_at[gte]=2026-06-01&total[lt]=5000&status[in]=shipped,delivered HTTP/1.1
```

Safety and consistency rules that matter more than the exact syntax:

- **Allow-list filterable fields and operators** — reject anything not explicitly permitted (a `400`/`422` with a clear code). This bounds both abuse and the query planner's exposure.
- **Always parameterize** — map filters to bound query parameters, never string-concatenate into SQL. Unvalidated filter input is a classic injection vector (OWASP).
- **Bound cost** — require an index behind each filterable field, or cap combinations, so a client can't force a full table scan.
- **Be consistent** — same operator syntax on every endpoint; document it once.

Resist inventing a full query DSL (RSQL, OData `$filter`) unless clients truly need it — it's powerful but a large surface to secure, validate, and support. Match the syntax complexity to real client needs.

### Q8. How do you design sorting, and what's the gotcha with sorting plus pagination?

Expose sorting with a consistent, allow-listed `sort` parameter. A common convention uses a `-` prefix for descending and allows a comma list for multi-key sorts:

```http
GET /v1/orders?sort=-created_at,id HTTP/1.1
```

Design rules: **allow-list the sortable fields** (each should be indexed; reject others with a `400`), pick a sensible **default sort** so results are deterministic even without a `sort` param, and document the direction convention.

The gotcha with pagination: **your sort key must be unique, or your cursor is ambiguous.** If you sort only by `created_at` and two orders share a timestamp, a keyset cursor can't tell which one you stopped at — you'll skip or duplicate rows at the boundary. Fix it with a **tie-breaker**: append a guaranteed-unique key (usually the primary `id`) to the sort and the cursor:

```sql
ORDER BY created_at DESC, id DESC   -- id breaks ties, makes the cursor unambiguous
```

Also, **the sort must match the cursor** — you can't change `sort` mid-traversal, which is another reason to encode the sort inside the opaque cursor so a client can't mix an old cursor with a new sort order.

### Q9. How does search differ from filtering, and how do you design a search endpoint?

**Filtering** is exact, structured predicate matching on known fields (`status = shipped`, `created_at >= X`) — deterministic, index-backed, boolean. **Search** is relevance-ranked, fuzzy, full-text matching over unstructured content (`q=blue running shoes`) — it returns a *scored, ordered* set, not a strict boolean subset, and is typically backed by a search engine (Elasticsearch/OpenSearch) rather than the primary DB.

Design implications:

```http
GET /v1/products/search?q=running+shoes&filter[brand]=acme&sort=relevance&limit=20 HTTP/1.1
```

- **Combine search with filters** — free-text `q` for relevance, structured `filter[...]` to constrain (faceted search).
- **Pagination is different** — results are relevance-ordered and the score set can shift between requests, so deep pagination is unstable; many search APIs **cap depth** (e.g. first 1,000 results) and nudge users to refine rather than page forever. Cursor pagination is harder because relevance ordering isn't a stable keyset.
- **Return relevance metadata** where useful (score, highlights) and **facet counts** for filter UIs.
- **Estimated totals** — search totals are usually approximate by design.

So filtering and search often live on the *same* collection but answer different questions; a mature product API offers structured filters on the list endpoint and a separate relevance-ranked search endpoint (or a `q` param that switches the endpoint into search mode).

### Q10. When is offset pagination actually the right choice?

Offset isn't always wrong — it's the right tool when its weaknesses don't bite:

- **Small, bounded datasets** — an admin table of a few hundred rows never reaches a deep, slow offset.
- **Mostly-static data** — a settings list or catalog that rarely changes won't drift meaningfully between page loads.
- **Random page access is a real requirement** — "jump to page 12 of 40," classic numbered pagination UIs, or a report where a human wants "page 200." Cursors can't do this; offset can.
- **Internal/back-office tools** — where the operational simplicity and familiar UX outweigh scale concerns.

Offset's virtues are real: trivial to implement, supports jump-to-page, and pairs naturally with an exact total count for "page X of Y." The failure cases are specifically **large collections** (deep-page cost) and **actively-written collections** (drift). If your endpoint is neither, offset is a perfectly good, simpler choice — and reaching for cursors there is over-engineering. The senior answer isn't "always cursor"; it's "cursor for large/live/public, offset for small/static/admin, and I can articulate why."

### Q11. Show a cursor-paginated request/response, then the follow-up request for the next page.

First page:

```http
GET /v1/orders?limit=3&sort=-created_at HTTP/1.1
```
```json
{
  "data": [
    { "id": "ord_501", "created_at": "2026-07-01T10:00:00Z" },
    { "id": "ord_495", "created_at": "2026-07-01T09:55:00Z" },
    { "id": "ord_487", "created_at": "2026-07-01T09:41:00Z" }
  ],
  "meta": { "limit": 3, "has_more": true },
  "links": {
    "next": "/v1/orders?limit=3&sort=-created_at&after=eyJjcmVhdGVkX2F0IjoiMjAyNi0wNy0wMVQwOTo0MTowMFoiLCJpZCI6Im9yZF80ODcifQ"
  }
}
```

The client follows `links.next` verbatim:

```http
GET /v1/orders?limit=3&sort=-created_at&after=eyJjcmVhdGVkX2F0IjoiMjAyNi0wNy0wMVQwOTo0MTowMFoiLCJpZCI6Im9yZF80ODcifQ HTTP/1.1
```
```json
{
  "data": [
    { "id": "ord_480", "created_at": "2026-07-01T09:30:00Z" },
    { "id": "ord_479", "created_at": "2026-07-01T09:28:00Z" }
  ],
  "meta": { "limit": 3, "has_more": false },
  "links": { "next": null }
}
```

The server decoded the cursor to `(created_at=09:41:00, id=ord_487)` and ran `WHERE (created_at, id) < (...) ORDER BY created_at DESC, id DESC LIMIT 3`. When `has_more` is false and `next` is `null`, the client stops. The client never parsed or built the cursor — it just followed the link — which is exactly what lets me change the cursor internals later.

### Q12. How do you prevent clients from abusing pagination (huge limits, expensive filters, deep scans)?

Treat pagination inputs as an **abuse and cost surface**, and bound every dimension:

- **Cap `limit`** — enforce a max (e.g. 100) and a sensible default (e.g. 20); clamp or reject `limit=1000000` rather than honoring it.
- **Prefer cursors over deep offset** — if you must allow offset, cap the maximum offset or degrade to "refine your query," so nobody triggers a `OFFSET 5000000` table scan.
- **Allow-list filter/sort fields, require indexes** — reject filters on unindexed fields so a client can't force a full scan; disallow arbitrary field combinations that the planner can't serve efficiently.
- **Bound query complexity** — limit the number of simultaneous filters and the depth/expansion, so one request can't fan out into an enormous join.
- **Rate-limit and paginate** — combine with `429`/rate limits so bulk scraping is throttled; consider a separate bulk-export path for legitimate large pulls.
- **Timeouts** — put a statement timeout on the query so a pathological page fails fast rather than pinning the DB.

The theme: never let a single client request translate into unbounded server work. Every limit, offset, filter, and sort should have a defined, enforced ceiling — this is both a performance and a security (denial-of-service) concern.

### Q13. Where do you put the "next page" pointer — in the body, a `Link` header, or both?

There are three common placements, and they're not mutually exclusive:

- **In the body envelope** (`links.next`) — most ergonomic for JSON/browser clients; the pointer travels with the data and is easy to follow. This is my default for typical JSON APIs.
  ```json
  { "data": [ ... ], "links": { "next": "/v1/orders?after=..." } }
  ```
- **In a `Link` header** (RFC 8288 / GitHub-style) — keeps the body a clean bare array and is standardized; nice for HATEOAS-flavored or hypermedia APIs.
  ```http
  Link: </v1/orders?after=abc>; rel="next", </v1/orders?after=xyz>; rel="prev"
  ```
- **Both** — some APIs (GitHub) provide the `Link` header *and* body pagination for flexibility.

The important design principles regardless of placement: (1) the server provides the next-page pointer — clients follow it rather than constructing pagination themselves, so you can evolve the scheme; (2) be **consistent** across every collection endpoint; and (3) absence of `next` (null link, or no `rel="next"`) is the unambiguous end-of-collection signal. Pick one primary placement and use it everywhere; for a typical JSON product API, the body envelope is the friendliest choice.

### Q14. Can you combine cursor pagination with jump-to-page UI? How do you handle "page 500"?

Not directly — that's the fundamental limitation of cursor pagination. A cursor only knows "what comes *after this specific row*"; it has no concept of "row number 10,000," so it **can't jump to an arbitrary page number**. You get next/prev, not random access.

If the product genuinely needs numbered jump-to-page, you have a few options:

- **Accept offset for that surface** and its costs — cap max offset/page so the deep-page scan stays bounded, or only offer numbered pages up to a limit ("showing first 100 pages").
- **Hybrid** — cursors for the common "load more"/infinite-scroll path, offset only for an admin report that needs "page X of Y."
- **Redesign the UX** — most consumer UIs don't actually need page 500; infinite scroll or "load more" (pure cursor) is usually better UX anyway, and search/filter refinement replaces deep paging. Push users to narrow their query rather than walk 500 pages.
- **Precomputed page boundaries** — for a rarely-changing dataset, you can precompute cursors for each page number and store them, giving pseudo-random access, but this is complex and only worth it for special cases.

The honest interview answer: cursor and jump-to-page are in tension by design. Decide which the product needs — for large/live data prefer cursor + "load more" and eliminate the jump-to-page requirement if you can; if it's non-negotiable, use bounded offset for that specific view and accept the deep-page cost.

### Q15. Design pagination for a public API where you may need to change the backing store later.

The key is **maximum encapsulation** so today's implementation isn't baked into the contract:

- **Opaque page tokens only** — expose `?page_token=<opaque>` and a `next_page_token` in the response; never expose `offset`, raw keyset columns, or DB-specific values. The client's contract is "pass the token back," nothing more. This is what lets me swap Postgres offset today for a keyset scan, or a search-engine cursor, or a distributed store's continuation token tomorrow — all behind the same token.
  ```json
  { "items": [ ... ], "next_page_token": "eyJ2IjoxLCJrIjoib3JkXzQ4NyJ9" }
  ```
- **Version the token internally** — encode a version byte inside the token so old tokens still decode after I change the scheme (or fail gracefully with a clear "cursor expired, restart pagination" error).
- **Sign/HMAC the token** — so clients can't forge or tamper with it, and I can trust its contents.
- **Document it as opaque and short-lived** — clients must not persist or parse tokens; a token may expire (say, after the sort/data shifts materially), and the API returns a clean error telling them to restart. Publishing "tokens are opaque and may expire" up front prevents clients from building brittle assumptions.
- **Server-provided `next` link** — hand clients the whole next URL so even the parameter names aren't part of what they construct.

This is exactly Google AIP-158's design: opaque `page_token` + `next_page_token`, no exposed offsets. It costs clients the ability to jump to arbitrary pages, but it buys you total freedom to change the backing store and pagination algorithm without ever shipping a breaking change. For a long-lived public API, that evolvability is worth far more than jump-to-page.

### Q16. Compare the three pagination strategies in one table, with when to use each.

| | Offset/limit | Cursor/keyset | Opaque page token |
|---|---|---|---|
| Request | `?offset=40&limit=20` | `?after=<key>&limit=20` | `?page_token=<opaque>` |
| Client sees | Position numbers | Keyset values (or opaque) | Nothing (black box) |
| Deep-page cost | O(offset), slow | O(limit), constant | O(limit), constant |
| Stability under writes | Drifts (dupes/skips) | Stable | Stable |
| Random / jump-to-page | Yes | No | No |
| Total count | Easy | Awkward | Awkward |
| Evolvability | Locked (offset is exposed) | Semi (keys exposed) | Maximum (opaque) |
| Complexity | Lowest | Medium | Medium–high |

**When to use each:**

- **Offset/limit** — small, static, or internal/admin lists; when numbered jump-to-page is a hard requirement and the dataset is bounded.
- **Cursor/keyset** — large, live, or public collections; feeds, logs, time-ordered data; anywhere deep pages must stay fast and results must not drift.
- **Opaque page token** — public APIs where you want cursor benefits *and* freedom to change the backing store/algorithm later without breaking clients (Google AIP / Relay Connections style). It's cursor pagination with the implementation hidden behind a token.

My default heuristic: reach for **opaque cursor tokens** on any public, large, or evolving API; use **offset** only when the list is small/static or the product truly needs numbered pages. The strongest answer names the two forces driving the choice — **deep-page cost** and **drift** — and picks accordingly rather than dogmatically.
## API Versioning & Evolution

### Summary

**What this topic covers**

An API is a **contract**, and the moment it has a second user you no longer own it outright — every published field, status code, and error shape is a promise. This topic is about keeping that promise while still changing the API: how to **version** (URI vs header vs media-type), how to tell a **breaking change from a non-breaking one**, how to evolve *additively* so old clients keep working, and how to retire the old surface gracefully via **deprecation** and the `Sunset` header. The 16 questions here range from "where do you put `/v1`" through "evolve a public API used by thousands of clients you can't contact" and "what does semantic versioning even mean for an HTTP API." The through-line: **you cannot force clients to upgrade**, so evolvability is a design property you bake in from day one, not a migration you run later.

**Mental model**

Think of two clocks running at different speeds. Your service redeploys many times a day; a mobile app pinned to your API sits in an app store for months and on users' phones for years. A partner's batch job might not be touched for a decade. Versioning exists to decouple those clocks. The default posture is **additive, backward-compatible evolution**: never remove or repurpose what you've shipped, only add optional things alongside it. A new *major version* is the expensive escape hatch you reach for only when a change genuinely can't be made additively — because every version you keep alive is code, tests, and support you carry forever. Design so that the **tolerant reader** on the client side (ignore unknown fields, don't over-validate) meets the **conservative writer** on the server side (change only additively). When those two habits meet, most "changes" never need a version bump at all. A version number is not a feature — it's a debt marker.

**Key terms**

- **Breaking change** — any change that can make a previously-valid client request fail or a previously-correct response misparse: removing/renaming a field, tightening validation, changing a type, adding a required request param, changing status-code semantics.
- **Non-breaking (additive) change** — adding an *optional* request field, adding a response field, adding a new endpoint, adding a new optional enum value (with caveats).
- **URI versioning** — the version lives in the path: `/v1/orders`. Most visible, most common, coarse-grained.
- **Header versioning** — version in a custom or `Accept` header: `Accept: application/vnd.acme.v2+json`. Cleaner URIs, less discoverable.
- **Media-type / content negotiation versioning** — version encoded in the media type; the "RESTful" purist option.
- **Tolerant reader** — a client that ignores fields it doesn't recognise and doesn't fail on additive changes (Postel's law applied to clients).
- **Deprecation** — signalling that a field/endpoint/version is going away but still works, giving clients a migration window.
- **`Sunset` header (RFC 8594)** — an HTTP response header announcing the date after which a resource will stop responding.
- **Semantic versioning (SemVer)** — `MAJOR.MINOR.PATCH`; for APIs, MAJOR = breaking, MINOR = additive, PATCH = fixes. Maps cleanly to SDKs, awkwardly to URL versions.
- **API surface / contract** — the totality of what clients can observe and depend on, including accidental behaviour (Hyrum's law).

**Why interviewers ask this**

Evolution is where junior and senior API thinking separate most sharply. A junior answer treats versioning as "add `/v2` when you change something." A senior answer starts from "which changes actually *need* a version at all?" and shows they know the vast majority of changes can be made additively without a bump. Interviewers probe whether you understand that you **cannot recall a deployed client**, so a public API is closer to a database schema than to internal code — migrations must be online and backward-compatible. They're listening for: a crisp breaking/non-breaking taxonomy, awareness of **Hyrum's law** (clients depend on observable behaviour you never promised), a real deprecation process (not "we'll email them"), and the maturity to say "I'd avoid `/v2` as long as possible." Getting this right signals you've operated an API in production and felt the pain of a client you couldn't reach.

**Common confusions**

- "Every change needs a new version" — false. Adding an optional field or a new endpoint breaks nothing. Versioning is for changes you *can't* make additively.
- "Adding a field is always safe" — mostly, but adding a *required request* field is breaking, and adding an enum value can break clients that exhaustively switch on it.
- "URI versioning is the RESTful way" — purists argue the opposite (a URI should identify a resource, not a representation version); pragmatically URI versioning wins on operability. Both are defensible.
- "Deprecated means removed" — deprecated means *still works, but stop using it*. Removal is a separate, later, announced event.
- "SemVer maps directly onto REST URLs" — not really; you don't put `/v1.4.2/` in a path. SemVer fits SDKs and schemas; URLs usually carry only the MAJOR.
- "We'll just tell clients to update" — for a public API you often can't; you must assume clients never upgrade and design accordingly.

**What follows from this topic**

Versioning touches everything else in API design. Clean **error models** and **pagination** envelopes are easier to evolve when they were designed with additive change in mind. **Authentication** schemes get versioned and deprecated on the same lifecycle (retiring an old token format is a breaking change). **Webhooks** need event-schema versioning too — the same tolerant-reader discipline applies to event consumers. And **OpenAPI/contract testing** is what lets you *detect* a breaking change in CI before it ships, turning "did we break someone?" from a production incident into a failed build.

### Q1. What's the difference between a breaking and a non-breaking change? Give examples.

A **breaking change** can make a previously-valid client stop working — either its request is now rejected, or it can no longer parse your response. A **non-breaking (additive)** change leaves every existing client working unchanged.

| Change | Breaking? | Why |
|---|---|---|
| Add optional request field | No | Old clients omit it; server has a default |
| Add response field | No | Tolerant readers ignore unknown fields |
| Add a new endpoint | No | Nobody was calling it |
| Remove or rename a field | **Yes** | Clients reading it get `null`/parse errors |
| Make an optional request field required | **Yes** | Old requests now fail validation |
| Change a field's type (`string`→`number`) | **Yes** | Deserialisation breaks |
| Tighten validation (max length 100→50) | **Yes** | Previously-valid input now rejected |
| Change a `200` to a `202`, or a 4xx code | **Yes** | Clients branch on status codes |
| Add a new value to a response enum | **Maybe** | Breaks clients that exhaustively switch |

The rule of thumb: **you may add optional things; you may not remove, rename, retype, or tighten existing things.** Everything else follows from that.

### Q2. Where should the version go — URI, header, or media type? What are the tradeoffs?

Three mainstream options:

| Approach | Example | Pros | Cons |
|---|---|---|---|
| **URI path** | `GET /v1/orders` | Obvious, easy to route/cache/curl, discoverable | Not "pure" REST; version pollutes every URL; coarse (whole-API) |
| **Custom/`Accept` header** | `Accept: application/vnd.acme.v2+json` | Clean stable URIs; per-resource granularity | Invisible in a browser/log; easy to forget; harder to test |
| **Query param** | `GET /orders?version=2` | Simple | Muddies caching; easy to omit; discouraged |

```http
GET /v1/orders/ord_123 HTTP/1.1
Host: api.example.com
```

versus header-based:

```http
GET /orders/ord_123 HTTP/1.1
Host: api.example.com
Accept: application/vnd.acme.v2+json
```

**My default: URI versioning with a single major segment (`/v1`).** It's the most operable — trivially routable at the gateway, cacheable, greppable in logs, and any developer can hit it with `curl`. The purist objection (a URL should name a resource, not a representation) is real but rarely worth the operational cost. Reserve header/media-type versioning for cases where you truly need per-resource version negotiation. Whatever you pick, **only encode the MAJOR version** in the URL — minor/additive changes shouldn't move the URL.

### Q3. How do you evolve a PUBLIC API used by thousands of clients you can't contact, without breaking them?

You assume **no client will ever upgrade** and design every change to be invisible to old clients.

1. **Additive-only by default.** New capability = new optional field or new endpoint, never a change to existing behaviour.
2. **Tolerant reader / conservative writer.** Document that clients must ignore unknown fields; on the server, never remove or repurpose a shipped field.
3. **Never repurpose a field.** If `status` used to mean one thing, a new meaning is breaking even though the field name is unchanged (Hyrum's law: clients depend on observed behaviour).
4. **Default new required behaviour off.** If you need stricter validation, apply it only to new clients (e.g. gated by a version or feature header), not retroactively.
5. **When you truly can't be additive, mint a new major version** (`/v2`) and run `/v1` and `/v2` side by side, with `/v1` in deprecation.

```http
HTTP/1.1 200 OK
Content-Type: application/json

{ "id": "ord_123", "total": 4200, "currency": "USD", "tax": 350 }
```

Adding `"tax"` above breaks nobody. Renaming `"total"` to `"amount"` would break everyone — so instead you *add* `"amount"` and keep `"total"` populated for as long as any client might read it.

### Q4. What does semantic versioning mean for an API, and where does it fit?

**SemVer** is `MAJOR.MINOR.PATCH`:

- **MAJOR** — incompatible/breaking changes (`2.0.0`).
- **MINOR** — backward-compatible additions (`1.3.0`).
- **PATCH** — backward-compatible fixes (`1.3.1`).

For HTTP APIs the mapping is partial. The **MAJOR** is what usually appears in the URL (`/v1`), because it's the only part clients must react to. **MINOR** and **PATCH** changes are additive/fixes and by definition *don't* need clients to do anything, so they don't belong in the URL — you ship them continuously behind `/v1`. SemVer fits far more naturally on **SDKs and schema documents** (your OpenAPI file, your generated client library) than on URLs, where it gives you a precise changelog vocabulary: a MINOR bump on the SDK signals "new features, safe to upgrade," a MAJOR bump signals "read the migration guide."

### Q5. What is a "tolerant reader" and why does it matter for evolution?

A **tolerant reader** is a client that reads only the fields it needs and **silently ignores everything it doesn't recognise** — it doesn't fail when the server adds a field, reorders JSON keys, or returns an enum value it hasn't seen.

It matters because it's the client-side half of what makes additive evolution possible. If clients are tolerant readers, the server can add response fields freely forever. If clients instead use *strict* deserialisation that rejects unknown fields (some strongly-typed serialisers do this by default), then even adding a field becomes a breaking change — and you've lost your cheapest evolution lever.

```json
// Server now returns an extra "loyalty_tier" field
{ "id": "usr_123", "name": "alice", "loyalty_tier": "gold" }
```

A tolerant reader that only reads `id` and `name` doesn't even notice. It's Postel's law ("be conservative in what you send, liberal in what you accept") applied to API consumers, and good SDKs default to it.

### Q6. Walk through deprecating an endpoint. What headers and process do you use?

Deprecation is a **process with a timeline**, not a flip of a switch:

1. **Announce** in the changelog and docs, with a replacement and a removal date.
2. **Signal in responses** so even clients who never read your docs find out. Emit the `Deprecation` header (RFC 8594's companion) and a `Sunset` date:

```http
HTTP/1.1 200 OK
Deprecation: true
Sunset: Wed, 31 Dec 2026 23:59:59 GMT
Link: <https://api.example.com/v2/orders>; rel="successor-version"
Warning: 299 - "This endpoint is deprecated; migrate to /v2/orders by 2026-12-31"
```

3. **Measure** usage per client/key so you know who still calls it and can reach out.
4. **Give a real window** — for a public API, months to a year, not weeks.
5. **Brown-outs (optional)** — near the sunset date, briefly return errors for short windows to flush out clients who ignored every signal.
6. **Remove**, returning `410 Gone` (not `404`) so callers get an unambiguous "this existed and is intentionally gone."

The key discipline: keep it working the entire time. Deprecated means "please stop," not "it stopped."

### Q7. What is the `Sunset` header and how does it differ from `Deprecation`?

Both are response headers that communicate lifecycle to clients programmatically:

- **`Deprecation`** — says "this is deprecated *now*." Value is `true` or an HTTP-date of when it became deprecated.
- **`Sunset`** (RFC 8594) — says "this will stop responding *after this date*." Value is an HTTP-date in the future.

```http
Deprecation: Tue, 01 Jul 2026 00:00:00 GMT
Sunset: Wed, 31 Dec 2026 23:59:59 GMT
Link: <https://developer.example.com/migrations/v2>; rel="deprecation"
```

`Deprecation` marks the *start* of the retirement window; `Sunset` marks the *end*. Pair them with a `Link` header pointing at the migration guide or successor version. The value is that a well-built client can log or alert on these automatically, so migration doesn't depend on a human reading a blog post.

### Q8. A client complains that your "backward-compatible" change broke them. What likely happened? (Hyrum's law)

**Hyrum's law**: *with enough users, every observable behaviour of your API — even ones you never documented — will be depended on by someone.* You probably changed something you didn't consider part of the contract:

- **Field ordering** in JSON (someone parsed positionally, or diffed raw bytes).
- **Adding an enum value** — a client had an exhaustive `switch` that threw on the default case.
- **Error message wording** — someone string-matched on `"insufficient funds"`.
- **A newly-populated optional field** that was always `null` before — a client asserted it was null.
- **Response timing or pagination page size** they'd hard-coded.
- **Tightened but "surely nobody sends that" input** that some client did in fact send.

The lesson isn't "you can never change anything" — it's that the *real* contract is larger than the documented one, and additive changes to responses (new enum values especially) still carry risk. Mitigations: document that clients must tolerate unknown fields and enum values, keep error *codes* stable (don't match on prose), and roll changes out behind flags with monitoring so you catch breakage before it's universal.

### Q9. How do you version request and response payloads independently of the endpoint?

Sometimes you want to evolve the *representation* without minting a whole new URL tree. Options:

- **Media-type versioning** via content negotiation — the client asks for a representation version and the server honours it:

```http
GET /orders/ord_123 HTTP/1.1
Accept: application/vnd.acme.order.v2+json
```

- **Field-level additive evolution** — keep one representation but add fields; old clients read old fields, new clients read new ones. This is the cheapest and covers most cases.
- **Expansion / field selection** — let clients opt into richer representations (`?fields=id,total` or `?expand=customer`), so you can add heavy new data without inflating the default payload for everyone.

The main tradeoff of media-type versioning is discoverability and caching complexity (now the cache key must include `Accept`). For most teams, **additive field evolution plus a single URL major version** covers the ground without the operational overhead of per-resource content negotiation.

### Q10. When is it acceptable to make a breaking change, and how do you roll out `/v2`?

Breaking is justified when a change **genuinely cannot be made additively** — a fundamentally different resource model, a security fix that must reject formerly-valid input, or accumulated cruft that additive layering can no longer paper over.

Rollout pattern:

1. **Stand up `/v2` alongside `/v1`.** Never mutate `/v1` in place.
2. **Implement `/v1` as a thin adapter over `/v2`'s internals** where possible, so you don't maintain two full stacks — one code path, two representations.
3. **Publish a migration guide** with a field-by-field diff and code samples.
4. **Deprecate `/v1`** with `Deprecation`/`Sunset` headers and a generous window.
5. **Track per-client `/v1` usage**; proactively contact the heavy holdouts.
6. **Sunset `/v1`**, returning `410 Gone` after the announced date.

The cost you're signing up for is running two surfaces in parallel for months to years — which is exactly why you avoid `/v2` until additive evolution truly runs out.

### Q11. Is adding a new value to an enum a breaking change?

**In responses: potentially breaking. In requests: not.**

- **Response enums** — if a client does an *exhaustive* match (`switch` with no default, or a strict deserialiser that rejects unknown enum members), a new value throws. So a new response enum value can break strict clients even though it's "just an addition."
- **Request enums** — adding an accepted value is safe; you're only *widening* what you accept, and no existing request stops working.

Design defence: from day one, **document that clients must handle unknown enum values gracefully** (map to an `"unknown"`/default bucket rather than crashing), and prefer open string enums over closed ones in wire formats where feasible. This is a classic Hyrum's-law trap — technically additive, practically risky — so treat new response enum values with the same care as a schema change, not as a free addition.

### Q12. How do you version a gRPC or protobuf-based API compared to REST?

Protobuf was built for evolution, and its rules are stricter and clearer than JSON's:

- **Never reuse or renumber a field tag.** The wire format keys on the tag number, not the name — renaming a field is safe on the wire, renumbering is catastrophic.
- **Only add new fields with new tag numbers.** New fields are optional by construction; old clients ignore unknown tags (the tolerant-reader property is built into the format).
- **Reserve removed fields** (`reserved 4;` / `reserved "old_name";`) so nobody accidentally reuses the tag later.
- **Don't change a field's type** — that's breaking just like in REST.

```protobuf
message Order {
  string id = 1;
  int64 total = 2;
  reserved 3;              // removed 'legacy_status', tag retired
  string currency = 4;     // added later, safe
}
```

For a *major* break, gRPC convention is to version the **package/namespace** (`package acme.orders.v2;`) — the analogue of `/v2` in REST. So: additive field evolution mirrors REST's additive rules, and package versioning mirrors URL major versioning, but protobuf's tag-number discipline makes the "don't break the wire" rules mechanical rather than aspirational.

### Q13. Should you version by date, integer, or SemVer in the URL? 

For the URL, **integer major versions (`/v1`, `/v2`) are the mainstream default** — simple, memorable, and they map to "breaking boundary." Two alternatives:

- **Date-based versions** (`/2026-07-01/`, or a `Acme-Version: 2026-07-01` header) — used by Stripe-style APIs. Each dated version pins a *complete snapshot* of behaviour; new clients get the latest, existing clients stay on the date they integrated against. Excellent for continuous additive evolution with occasional pinned breaks, but heavier to operate (many live snapshots).
- **Full SemVer in the URL** (`/v1.2.3/`) — almost always wrong; it forces URL churn on non-breaking changes, defeating the point.

Guidance: **integer major in the URL** for most APIs; consider **date-based version headers** if you're a high-volume public API that changes constantly and wants to pin behaviour precisely per client. Keep SemVer for your SDKs and schema docs, not your paths.

### Q14. How do you detect breaking changes before they ship?

Make "did we break the contract?" a **build-time check**, not a production incident:

- **Contract as source of truth** — keep an OpenAPI (or protobuf) spec in the repo and diff it in CI.
- **Automated breaking-change linters** — tools like `oasdiff` (OpenAPI) or `buf breaking` (protobuf) compare the PR's schema against the deployed baseline and fail the build on removals, retypes, or tightened constraints.
- **Contract/consumer tests** — recorded expectations from known consumers (e.g. Pact) run against the new build.
- **Backward-compat test suite** — replay a corpus of real historical requests against the new version and assert responses still parse.

```text
CI pipeline:
  build → oasdiff base=main/openapi.yaml head=PR/openapi.yaml
        → FAIL if any breaking change and no version bump
```

The cultural win is that breaking changes become *intentional and reviewed* — you can only merge one by explicitly bumping the major version, so nobody breaks a client by accident in a routine PR.

### Q15. Design an evolution strategy: you need to split a `name` field into `first_name` and `last_name`.

This is the canonical "can't be done in place" schema change; do it additively over time:

**Phase 1 — add, don't remove.** Introduce `first_name` and `last_name` alongside `name`. Populate all three on write (derive the pair by splitting, or `name` by joining). Reads keep working for everyone.

```json
{ "id": "usr_123", "name": "alice smith",
  "first_name": "alice", "last_name": "smith" }
```

**Phase 2 — migrate writers.** Accept both shapes on input; if a client sends the new fields, use them; if it sends `name`, split it. Update your own SDKs/docs to prefer the new fields.

**Phase 3 — deprecate `name`.** Mark it deprecated in the schema, emit `Deprecation` signalling, track who still reads/writes it.

**Phase 4 — remove (major version only).** `name` disappears **only in `/v2`**; `/v1` keeps returning it until `/v1` itself sunsets.

The point: a change that looks inherently breaking becomes a sequence of additive steps, and the actual removal is deferred to a real major-version boundary — nobody breaks along the way.

### Q16. How do you communicate and govern API changes across many teams?

Evolution at scale is an organisational problem as much as a technical one:

- **A written backward-compatibility policy** — what counts as breaking, what notice period clients get, how deprecations work. This makes "is this allowed?" answerable without debate.
- **A machine-checked spec** — OpenAPI/protobuf in version control, linted (e.g. Spectral) for style and diffed for breaking changes in CI, so the policy is *enforced*, not just documented.
- **A public changelog** — every additive change and every deprecation, dated, with migration notes.
- **An API review / design-guild step** — a lightweight review before a new endpoint or breaking change ships, catching inconsistency and accidental breaks early.
- **Usage telemetry per client/key** — you can't deprecate safely if you can't see who's still on the old path.

The senior signal here is treating the API as a **product with a lifecycle and a support contract**, not a code artifact. Governance is what lets you evolve confidently: clear rules, automated enforcement, and the visibility to know who a change will affect before you make it.

## Authentication & Authorization

### Summary

**What this topic covers**

Who is calling (**authentication**), and what they're allowed to do (**authorization**) — the two questions every non-trivial API must answer on every request. This topic covers the credential types (**API keys**, **OAuth 2.0** grants, **OIDC**, **JWTs**, opaque tokens, sessions, **mTLS**), how they're carried (`Authorization: Bearer`), and how you make access decisions once you know the caller (**scopes**, **RBAC/ABAC**, and *where* to enforce them). The 16 questions run from "what's the difference between authn and authz" and "how do API keys differ from OAuth" through the sharp senior material: the **JWT revocation problem**, JWT-vs-opaque-token tradeoffs, and why the single most common API vulnerability (**BOLA/IDOR**) is an *authorization* failure, not an authentication one. Auth is where API security breaches actually happen, so getting the vocabulary and the enforcement model right matters more here than almost anywhere else.

**Mental model**

Separate the two words and never conflate them. **Authentication** establishes identity: "prove you are `usr_123` / app `acme-web`." **Authorization** is a decision made *after* identity is known: "may `usr_123` read order `ord_999`?" A request can be perfectly authenticated and still must be rejected — a logged-in user asking for *someone else's* order is authenticated but not authorized. The second mental shift: **tokens are bearer instruments** — like cash, whoever holds one can spend it, so they must travel only over TLS, be short-lived, and be scoped to the minimum they need. The third: **authorization must be enforced on the server for every request, per object.** The client UI hiding a button is not enforcement. And the enforcement can't stop at "is this a valid token" (authentication) or even "does this token have the `orders:read` scope" (coarse authorization) — it must also check that *this caller* owns *this specific resource* (object-level authorization). Skip that last check and you've built the #1 API vulnerability.

**Key terms**

- **Authentication (authn)** — verifying identity (who is calling).
- **Authorization (authz)** — deciding what an authenticated caller may do.
- **API key** — a long-lived secret string identifying an *application/project*, not an end user. Coarse, simple.
- **OAuth 2.0** — a delegation *framework*: lets a user grant an app scoped access to their resources without sharing their password. It's about authorization delegation, not login.
- **OIDC (OpenID Connect)** — a thin identity layer on top of OAuth 2.0 that adds an **ID token** so you can actually authenticate a *user* (login).
- **JWT** — a signed, self-contained token carrying claims (`sub`, `exp`, `scope`); stateless — verifiable without a DB lookup.
- **Opaque token** — a random reference string with no embedded meaning; must be looked up (introspected) server-side.
- **Scope** — a coarse permission label on a token (`orders:read`, `payments:write`) bounding what it may do.
- **Bearer token** — any token where possession = authorization; carried in `Authorization: Bearer <token>`.
- **mTLS** — mutual TLS; both sides present certificates, giving strong cryptographic identity for service-to-service auth.
- **RBAC** — access by **role** (admin/editor/viewer).
- **ABAC** — access by **attributes** (owner, department, resource tags) evaluated per request.
- **BOLA / IDOR** — Broken Object-Level Authorization; the authz check that verifies the caller owns the specific object. Its absence is OWASP API Security #1.

**Why interviewers ask this**

Auth is the highest-stakes area of API design — it's where the actual breaches are — so interviewers use it to sort people who've *shipped secure APIs* from people who've only read about tokens. The classic tells: conflating authentication and authorization ("we use JWT for authorization" — no, JWT authenticates, scopes/claims *inform* authorization); not knowing what problem OAuth actually solves (delegation, not login — that's OIDC); and, most revealing, not spontaneously mentioning **object-level authorization / BOLA** when asked to secure an endpoint. Senior candidates reach for it immediately: "check the token, check the scope, *and* check that this user owns this object." Interviewers also probe the **JWT revocation problem** — a candidate who thinks stateless JWTs are strictly better hasn't operated one and hit "how do I log this user out *right now*?" Fluency here signals you can be trusted with the parts of an API that, done wrong, make the news.

**Common confusions**

- "Authentication and authorization are the same" — no. Authn = who you are; authz = what you may do. Most API breaches are authz failures on authenticated requests.
- "OAuth logs users in" — OAuth *delegates authorization*; **OIDC** is the login layer. Using raw OAuth for authentication is a known anti-pattern.
- "JWTs are always better than opaque tokens" — JWTs trade revocability and size for statelessness; opaque tokens are trivially revocable. It's a tradeoff, not an upgrade.
- "A valid signature means the request is authorized" — signature validity is *authentication*; you still must check scopes and object ownership.
- "API keys authenticate users" — API keys identify *applications*, and are coarse; they're not a substitute for user auth.
- "We check permissions in the UI" — the UI is not a security boundary; every check must be re-done server-side.
- "Scopes give you fine-grained authorization" — scopes are coarse (`orders:read`); they don't answer "does this user own *this* order." That needs per-object ABAC.

**What follows from this topic**

Auth underpins the rest of API security. **Rate limiting** keys off identity (per-key, per-user) — you can't limit fairly until you know who's calling. **Versioning** and **deprecation** apply to auth schemes too (retiring an old token format is a breaking change on a lifecycle). **Webhook** delivery has its own auth direction — *you* authenticate to the client's endpoint via HMAC signatures, the inverse of inbound auth. And object-level authorization (BOLA) connects straight to the broader **OWASP API Top 10** — most of that list is authz, data-exposure, and mass-assignment failures, all downstream of the identity-and-permission model you establish here.

### Q1. What's the difference between authentication and authorization?

**Authentication (authn)** answers *who are you?* — verifying identity via a credential (password, API key, token, certificate). **Authorization (authz)** answers *what are you allowed to do?* — a decision made *after* identity is established.

They run in that order and are independent. A request can be authenticated but unauthorized: `usr_123` logs in successfully (authn passes) and then requests `usr_456`'s bank statement (authz must fail). Conversely you can't meaningfully authorize an anonymous caller — you need identity first.

```text
Request → [Authentication]  who is this?      → usr_123, valid token
        → [Authorization]   may they do this? → does usr_123 own ord_999?
        → allow / 401 (not authenticated) / 403 (authenticated, forbidden)
```

Interview shorthand: **401 = we don't know who you are; 403 = we know, and you can't.** Most real API breaches are authz failures on properly authenticated requests — which is why "check the token" is necessary but never sufficient.

### Q2. API keys vs OAuth vs sessions — when do you use each?

| | Identifies | Lifetime | Use case |
|---|---|---|---|
| **API key** | An *application/project* | Long-lived | Server-to-server, simple partner access, machine callers |
| **Session cookie** | A logged-in *user* (server-side state) | Until logout/expiry | Traditional web apps, same-origin browser |
| **OAuth 2.0 token** | A user delegating to a *third-party app* | Short-lived (+ refresh) | "Log in with…", third-party API access, scoped delegation |

- **API keys** — a single opaque secret in a header (`Authorization: Bearer sk_live_...` or `X-API-Key`). Great for identifying *which app* is calling; coarse (no per-user identity, no granular scopes unless you build them). Simple to issue and rotate.
- **Sessions** — the server holds state and hands the browser a cookie; trivially revocable (delete the session), but requires sticky/shared session storage and is browser-centric.
- **OAuth 2.0** — for when a *third party* needs scoped access to a user's data without the user's password.

Rule of thumb: **API key for machine-to-machine, session for your own web app, OAuth for third-party/delegated user access.**

### Q3. What problem does OAuth 2.0 actually solve, and what are the main grant types?

OAuth 2.0 solves **delegated authorization**: letting a user grant a *third-party application* scoped, revocable access to their resources **without sharing their password.** The classic example: an app wants to read your calendar — instead of you giving it your Google password, Google issues the app a scoped access token you can revoke anytime.

Main grant types (flows):

- **Authorization Code (+ PKCE)** — the default for user-facing apps (web, mobile, SPA). User authenticates at the provider, app gets a short code, exchanges it server-side for tokens. **PKCE** protects public clients that can't keep a secret.
- **Client Credentials** — no user involved; a service authenticates *as itself* to call another service. This is machine-to-machine.
- **Refresh Token** — exchanges a long-lived refresh token for new short-lived access tokens without re-prompting the user.
- **(Legacy) Implicit / Resource Owner Password** — deprecated; don't use them in new designs.

The thing interviewers want you to say: **OAuth is about authorization delegation, not login.** For login you layer OIDC on top (next question).

### Q4. What's the difference between OAuth 2.0 and OIDC?

**OAuth 2.0 authorizes; OIDC authenticates.** OAuth gives an app an **access token** to *call APIs* on a user's behalf — but it deliberately says nothing standard about *who the user is*. Using an access token to "log a user in" is an anti-pattern (the token proves the app may call an API, not the identity of the human).

**OpenID Connect (OIDC)** is a thin standard layer on top of OAuth that adds an **ID token** — a JWT with verified identity claims (`sub`, `email`, `name`, issuer, audience) — so you can actually authenticate the user.

```text
OAuth 2.0:  → access_token   → "this app may call /calendar with scope read"
OIDC adds:  → id_token (JWT) → "the user is sub=usr_123, email verified"
```

So "Sign in with Google/Apple/Okta" is **OIDC**; "let this app read my Drive files" is **OAuth**. Same underlying flow (Authorization Code + PKCE), but OIDC's ID token is the piece that answers *who logged in*. Interview one-liner: **OAuth = valet key to your API; OIDC = the ID card.**

### Q5. Explain JWTs — structure, and the pros of stateless tokens.

A **JWT** is a signed, self-contained token in three base64url parts separated by dots: `header.payload.signature`.

```text
eyJhbGciOiJIUzI1NiJ9 . eyJzdWIiOiJ1c3JfMTIzIiwiZXhwIjoxNzUx...} . <signature>
     header                    payload (claims)                    signature
```

```json
// decoded payload (claims)
{ "sub": "usr_123", "scope": "orders:read", "exp": 1751500000, "iss": "https://auth.example.com" }
```

- **Header** — algorithm + type (`{"alg":"RS256","typ":"JWT"}`).
- **Payload** — **claims**: `sub` (subject/user), `exp` (expiry), `iat`, `iss` (issuer), `aud` (audience), plus custom claims like `scope` or `role`.
- **Signature** — HMAC or RSA/ECDSA signature over header+payload, so the server can verify integrity without a database.

**The stateless win**: any service holding the signing key (or the issuer's public key for RS256) can **verify the token and read the claims locally** — no round-trip to an auth server or session store per request. That makes JWTs great for horizontally-scaled and microservice systems: no shared session state, low latency, easy fan-out. The cost of that statelessness is the revocation problem (next question).

### Q6. What's the JWT revocation problem, and how do you deal with it?

The problem: a JWT is **valid until it expires** because verification is purely cryptographic and local. There's no lookup, so there's no natural place to say "this specific token is now dead." If a user logs out, you disable an account, or a token leaks, the token **keeps working until `exp`** — the very statelessness that makes JWTs fast makes them hard to *un*-issue.

Mitigations, in rough order of preference:

- **Short expiry + refresh tokens** — access tokens live minutes, not days; revocation happens by refusing to mint a new one at refresh time. Bounds the damage window.
- **Revocation/blocklist** — keep a (small, fast, e.g. Redis) set of revoked token IDs (`jti`) or user IDs and check it on each request. This reintroduces a lookup — you've partially given up statelessness for correctness.
- **Token versioning** — store a `token_version` per user; bump it to invalidate all their tokens at once (still needs a lookup).
- **Rotate signing keys** for a mass invalidation event.

The honest interview answer: **pure statelessness and instant revocation are in tension.** Most real systems use short-lived JWTs plus a blocklist for the "log me out *now*" cases — accepting a lookup for the rare revocation to keep the common path stateless.

### Q7. JWT vs opaque tokens — how do you choose?

| | JWT (self-contained) | Opaque token (reference) |
|---|---|---|
| Contents | Signed claims, readable | Random string, meaningless |
| Validation | Local, cryptographic (no lookup) | Server-side introspection/DB lookup |
| Revocation | Hard (valid until `exp`) | Trivial (delete the record) |
| Size | Larger (carries claims) | Small |
| Leakage risk | Claims visible (base64, not encrypted) | Nothing leaks; it's opaque |
| Best for | Scaled/microservice reads, low-latency | When revocation/control matters most |

**JWT** trades revocability and size for **statelessness and speed** — no per-request auth-server call. **Opaque tokens** trade a lookup for **full server-side control** — revoke instantly, change permissions instantly, leak nothing.

Common hybrid: opaque tokens at the public edge (revocable, small, safe to hand to browsers) that the **gateway exchanges/introspects into a short-lived JWT** for internal service-to-service calls. You get edge control *and* internal statelessness. Choose JWT when you're optimising for scale and latency and can live with short-lived tokens; choose opaque when instant revocation and minimal token exposure dominate.

### Q8. What are scopes and how do they relate to authorization?

A **scope** is a coarse permission label attached to a token that **bounds what the token may do** — e.g. `orders:read`, `orders:write`, `payments:write`. When a client requests a token (or a user consents to an OAuth grant), it asks for specific scopes; the token then carries them as a claim, and the API rejects any call outside the granted set.

```http
GET /v1/orders HTTP/1.1
Authorization: Bearer <token with scope="orders:read profile:read">
```

Scopes are **necessary but not sufficient** for authorization. They answer "may this token touch the orders API at all?" — a *capability* check. They do **not** answer "may this caller read *this specific* order?" — an *object-level* check. A token with `orders:read` can read the orders *it's allowed to*, not every order in the system. Conflating the two is exactly how BOLA/IDOR bugs happen: the code checks the scope, sees `orders:read`, and forgets to check that `usr_123` owns `ord_999`. So: **scopes gate the operation; per-object authz gates the instance.** You need both.

### Q9. Spot the security flaw: `GET /v1/orders/{id}` returns any order to any authenticated user.

The flaw is **BOLA / IDOR — Broken Object-Level Authorization** — the #1 item on the OWASP API Security Top 10. The endpoint authenticates the caller but never checks that the caller is *allowed to see this specific object*.

```http
# alice is authenticated, but ord_999 belongs to bob:
GET /v1/orders/ord_999 HTTP/1.1
Authorization: Bearer <alice's valid token>

HTTP/1.1 200 OK          # BUG: alice just read bob's order
```

Any authenticated user can enumerate IDs (`ord_998`, `ord_999`, `ord_1000`) and harvest everyone's data. The token is valid, the scope may even be correct — but ownership was never verified.

**Fix — always scope the lookup to the caller:**

```sql
-- not: SELECT * FROM orders WHERE id = :id
SELECT * FROM orders WHERE id = :id AND owner_id = :caller_id
```

Return **404** (not 403) for objects the caller can't access, so you don't even confirm the ID exists (avoids enumeration). Additional hardening: use **non-guessable IDs** (UUIDs, not sequential integers) as defence in depth — but the real fix is the per-object ownership check on every access, never the ID scheme alone.

### Q10. RBAC vs ABAC — how do you enforce authorization at the API layer?

Two models for the "may they do this?" decision:

- **RBAC (Role-Based)** — permissions attach to **roles**, users get roles: `admin`, `editor`, `viewer`. Simple, auditable, coarse. "Editors may POST to `/articles`." Great until you hit "editors may edit *their own* articles but not others'" — RBAC alone can't express that.
- **ABAC (Attribute-Based)** — decisions evaluate **attributes** of the subject, the resource, and the context at request time: `resource.owner_id == subject.id`, `resource.department == subject.department`, `time < resource.embargo`. Expressive enough for per-object and contextual rules.

```text
RBAC:  role == "editor"                         → may hit the endpoint
ABAC:  subject.id == resource.owner_id          → may act on THIS object
                    AND action ∈ role's allowed
```

In practice you **combine them**: RBAC for coarse operation-level gating (does this role reach this endpoint), ABAC for the object-level ownership/attribute check (does this caller own this resource). Enforce **server-side, on every request**, ideally through a central policy layer (e.g. a policy engine like OPA) so authz logic isn't scattered and inconsistently applied across handlers. The object-level ABAC check is precisely the one whose absence causes BOLA.

### Q11. Where should authorization be enforced — gateway, service, or both?

**Split by what each layer can know.** A gateway sees the request and the token; it does **not** know your domain objects' ownership. So:

- **At the gateway/edge** — do **authentication** (validate the token/signature, reject anonymous) and **coarse authorization** (is the token valid, unexpired, and does it carry the required *scope* for this route). This offloads the cheap, universal checks and stops bad traffic early.
- **In the service** — do **object-level authorization** (does *this caller* own/have-rights-to *this specific resource*), because only the service knows the data model. This is the BOLA-preventing check and it **cannot** be delegated to a gateway that has no idea `ord_999` belongs to bob.

```text
Client → Gateway:  authn + scope check   (401/403 fast)
       → Service:  object-level authz     (owns this resource? else 404/403)
```

The failure mode to call out: teams that do *all* authz at the gateway feel secure but have no per-object check, so they ship BOLA. **Authenticate at the edge, authorize objects at the source.** Both layers, different jobs.

### Q12. How do you authenticate service-to-service calls?

For internal machine-to-machine traffic you don't have a user, so use **workload identity**, not user tokens:

- **mTLS (mutual TLS)** — both client and server present X.509 certificates; each cryptographically verifies the other. Strong, standard, and it's identity *and* transport encryption in one. Common in service meshes (Istio/Linkerd) where sidecars handle cert issuance and rotation automatically.
- **OAuth Client Credentials** — the calling service authenticates *as itself* to an auth server and gets a scoped access token (often a short-lived JWT) to present to the callee. Good when you want scopes and a central issuer.
- **Signed requests / mutual API keys** — simpler, lower-assurance; each service holds a key. Fine internally, weaker than mTLS.

```text
Service A --mTLS handshake--> Service B
  A presents cert (CN=service-a)   B verifies against internal CA
  B presents cert (CN=service-b)   A verifies against internal CA
  → both identified, channel encrypted
```

**mTLS is the strong default** for zero-trust internal networks (identity is bound to the transport, hard to steal a bearer token when there isn't one). Use **client-credentials JWTs** when you want scoped, centrally-issued, auditable tokens. Either way: **never reuse end-user tokens for service-to-service** — a downstream service shouldn't be acting with a user's token beyond its intended audience.

### Q13. How should tokens be transmitted and stored? What are the common mistakes?

**Transmit** bearer tokens in the `Authorization` header over TLS only:

```http
Authorization: Bearer eyJhbGciOiJSUzI1NiJ9...
```

Common mistakes and the rules that prevent them:

- **Tokens/keys in the URL** — `?api_key=sk_live_...` leaks into server logs, browser history, referer headers, and proxies. **Never** put secrets in query strings; use headers.
- **Long-lived access tokens** — minimise blast radius with short `exp` plus refresh tokens.
- **Logging tokens** — scrub `Authorization` headers from logs and traces.
- **Browser storage** — `localStorage` is readable by any XSS; prefer **`HttpOnly`, `Secure`, `SameSite` cookies** for browser sessions so JavaScript can't exfiltrate the token.
- **No TLS** — a bearer token on plaintext HTTP is a credential anyone on the path can copy. TLS is non-negotiable.
- **Overly broad scopes** — request the minimum scopes needed.

The unifying idea: a bearer token is **cash** — anyone holding it can spend it. So keep it off the URL, out of the logs, short-lived, minimally-scoped, and only ever on an encrypted channel.

### Q14. Design authentication for a public API that partners integrate with.

A practical layered design:

**Credentials.** Issue each partner a **client ID + secret** (or an API key per environment: `sk_test_...`, `sk_live_...`). For partners acting on behalf of *their* users, support **OAuth 2.0 Client Credentials** (partner-as-itself) and **Authorization Code + PKCE** (partner app acting for an end user).

**Token model.** Partners exchange credentials for **short-lived access tokens** (JWT or opaque) carrying **scopes** you defined (`orders:read`, `payments:write`). Present as `Authorization: Bearer`.

**Controls.**
- **Scopes** so partners get least-privilege access, consented per integration.
- **Key rotation** — let partners have two active keys so they can rotate with zero downtime; support revocation.
- **Per-key rate limits & quotas** keyed off the authenticated client (ties into rate limiting).
- **Object-level authz** — a partner token can only reach the resources that partner owns.
- **mTLS** as an optional stronger tier for high-value partners.

**DX.** Clear docs, a sandbox environment with test keys, obvious 401 vs 403 errors, and self-service key management in a developer portal.

```http
POST /oauth/token          → { "access_token": "...", "expires_in": 900, "scope": "orders:read" }
GET  /v1/orders  Authorization: Bearer <that token>
```

The senior framing: **short-lived scoped tokens, rotatable long-lived credentials to obtain them, per-object authorization, and per-key limits** — secure, revocable, and pleasant to integrate against.

### Q15. Why is "we check permissions in the frontend" wrong, and what's the correct model?

Because the **frontend is not a security boundary** — it runs entirely on the attacker's machine. Hiding a delete button, greying out an admin tab, or checking a role in JavaScript stops nothing: an attacker skips your UI entirely and calls the API directly with `curl` or Postman.

```http
# UI hid the button, but the endpoint is wide open:
DELETE /v1/users/usr_456 HTTP/1.1
Authorization: Bearer <alice's ordinary-user token>

HTTP/1.1 204 No Content     # BUG: no server-side authz — alice deleted another user
```

**The correct model: the server authorizes every request, independently, assuming the client is hostile.** The frontend check is purely a UX nicety (don't show users buttons that will 403). The real decision — is this authenticated caller permitted to perform this action on this object — lives in the API handler or a central policy layer, re-evaluated on every call. Client-side checks are decoration; **server-side checks are the fence.** Any endpoint that trusts the client to have "already checked" is one crafted request away from compromise.

### Q16. Someone leaks an API key publicly (e.g. commits it to GitHub). What's your response and prevention?

**Response — assume compromise, act fast:**

1. **Revoke immediately.** Invalidate the leaked key so it stops working now — this is exactly why keys must be independently revocable.
2. **Rotate.** Issue a replacement and update the legitimate integration.
3. **Audit.** Check logs for use of that key from unexpected IPs/times; assess what data/actions it could reach (its scopes bound the blast radius).
4. **Notify** the affected owner if there's any sign of misuse.

**Prevention — design so a leak is survivable:**

- **Least privilege** — scope keys narrowly so a leak exposes little.
- **Short-lived tokens over long-lived keys** where possible; refresh instead of one eternal secret.
- **Automated secret scanning** on repos (GitHub push protection, pre-commit hooks) to catch keys before they land.
- **Never in URLs or client-side code** — keys belong in server-side config/secret managers, sent in headers.
- **Rotation as routine**, with dual-key support so rotating is painless (and thus actually done).
- **Per-key rate limits and anomaly alerting** so abnormal use of a key trips an alarm quickly.

The mindset: **secrets leak eventually**, so design for containment (narrow scopes, short life, instant revocation, monitoring) rather than assuming they never will.

## Rate Limiting & Throttling

### Summary

**What this topic covers**

How an API protects itself and shares itself fairly: **rate limiting** (capping request rate per caller) and **throttling** (slowing or shedding load under pressure). This topic covers *why* you limit at all, the core **algorithms** (**token bucket**, **leaky bucket**, **fixed window**, **sliding window** — how each actually works and how they differ), how you express limits to clients (**`429 Too Many Requests`**, **`Retry-After`**, **`RateLimit-*` headers**), how you *scope* limits (per-key vs per-IP vs per-user), how you enforce them consistently across many servers (**distributed rate limiting**), and how you keep the system usable under stress (**fairness, burst tolerance, graceful degradation, backpressure**). The 16 questions run from "why rate limit" and "which status code" through "design limits for a public API" and "implement a distributed limiter that's correct across 50 servers." Rate limiting sits at the intersection of API design, reliability, and abuse prevention — a well-designed limit is both a shield and a documented part of your contract.

**Mental model**

A rate limit is a **budget over time**, and every algorithm is a different way of accounting for that budget. Two questions define the design: *how much* can a caller do (the steady rate + how much burst you tolerate), and *how do you measure it* (fixed buckets of time vs a smoothly-moving window vs a refilling reservoir). Think of **token bucket** as a wallet that refills at a steady rate and lets you spend a lump when you've saved up (allows bursts); **leaky bucket** as a fixed-rate drain that smooths bursts into a steady outflow; **fixed window** as "N per calendar minute" (simple but bursty at edges); **sliding window** as fixed-window's smoother cousin that avoids the edge burst. The second mental shift: rate limiting is part of your **API contract**, not a hidden defence — a good limit is *communicated* (headers tell clients their budget), *predictable* (clients can pace themselves), and *recoverable* (`Retry-After` tells them exactly when to come back). And at scale it's a **distributed counting problem**: the limit is global but enforced across many nodes, so where you keep the counter (shared store vs local approximation) is the central design tension.

**Key terms**

- **Rate limit** — a cap on requests per caller per unit time (e.g. 100 req/min).
- **Throttling** — slowing/delaying/shedding requests when a limit or capacity is hit (broader than a hard cap).
- **Quota** — a longer-horizon allowance (e.g. 1M requests/month), often tied to a plan/tier.
- **Token bucket** — tokens refill at a fixed rate into a capped bucket; each request spends one; empty = reject. Allows bursts up to bucket size.
- **Leaky bucket** — requests queue and drain at a fixed rate; smooths bursts into steady output; overflow = reject.
- **Fixed window** — count requests per fixed calendar interval; reset each interval. Simple; suffers edge bursts.
- **Sliding window** — a moving time window (log or weighted-counter) that avoids fixed-window's boundary burst.
- **`429 Too Many Requests`** — the HTTP status meaning "you exceeded your rate limit."
- **`Retry-After`** — response header telling the client how long to wait before retrying.
- **`RateLimit-*` headers** — advertise remaining budget (`RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`).
- **Backpressure** — signalling upstream to slow down when a system is overwhelmed, rather than accepting work it can't handle.
- **Graceful degradation** — shedding or reducing service quality under load instead of failing catastrophically.

**Why interviewers ask this**

Rate limiting reveals whether a candidate thinks about an API as a *shared, operated system* rather than a happy-path CRUD app. The junior answer is "return 429 when they call too much." The senior answer covers: *which algorithm and why* (and can explain the fixed-window boundary-burst bug that makes people reach for sliding window), *how you communicate limits* so clients can self-pace (headers, `Retry-After`), *how you scope* limits to avoid punishing the innocent (a shared NAT IP vs a per-key limit), and — the real depth question — *how you make it correct across many servers* without a shared counter becoming a bottleneck or a consistency problem. Interviewers also probe the reliability angle: rate limiting is your first line of defence against traffic spikes and abuse, and it connects to **backpressure** and **graceful degradation** — a candidate who links "reject early with 429" to "protect the database from collapse" is thinking like an operator, not just an API author.

**Common confusions**

- "Rate limiting and throttling are the same" — related but distinct; rate limiting is a *policy cap*, throttling is the *mechanism* of slowing/shedding, and quotas are the *long-horizon* allowance.
- "Just use fixed window, it's simplest" — fixed window allows up to **2× the limit** across a window boundary; that burst can be exactly what takes you down.
- "429 means the client did something wrong" — it's a 4xx, but it's often about *shared capacity*, not client error; the client should back off and retry, not treat it as fatal.
- "Rate limit by IP" — IPs are shared (corporate NAT, mobile carriers) and spoofable/rotatable; prefer per-key/per-user where you have identity.
- "The client can retry immediately" — hammering after a 429 makes it worse; clients must honour `Retry-After` and use backoff + jitter.
- "A local per-server counter enforces a global limit" — with N servers each allowing the limit, you actually permit N× the intended rate.
- "Token bucket and leaky bucket are the same" — token bucket *permits* bursts; leaky bucket *smooths them away*. Opposite burst behaviour.

**What follows from this topic**

Rate limiting ties the API-design topics together operationally. It **keys off authentication** — you can't do per-user or per-key limits until you know the caller, so the auth model determines what you can fairly limit. It's a **versioned, documented part of the contract** — limits and their headers appear in your OpenAPI spec and changing them (tightening) is a breaking change on a deprecation lifecycle. It shapes **error design** — `429` needs the same consistent, machine-readable error body as your other 4xx responses, plus `Retry-After`. And it's the front line of **API security and reliability** (OWASP API #4 is "unrestricted resource consumption"): the same mechanism that shares capacity fairly also blunts brute-force, scraping, and DoS — which is why rate limiting, backpressure, and graceful degradation are really one story about keeping an API alive and fair under load.

### Q1. Why rate limit an API at all?

Four reasons, roughly in order of how often they come up:

- **Protect capacity / prevent overload.** A single misbehaving client (a runaway loop, a bad retry storm) can otherwise saturate your database or CPU and take the API down *for everyone*. Rate limiting caps the blast radius.
- **Fairness / multi-tenancy.** On a shared API, one greedy caller shouldn't starve the rest. Per-caller limits give everyone a predictable slice.
- **Abuse & security.** Limits blunt brute-force credential attacks, scraping, and application-layer DoS. It's OWASP API Security #4 ("Unrestricted Resource Consumption") — *missing* rate limiting is itself a vulnerability.
- **Cost control & monetisation.** Requests cost money (compute, third-party calls); limits and quotas cap spend and let you sell tiers (free = 100/min, pro = 10k/min).

The framing interviewers like: rate limiting is simultaneously a **reliability control** (self-protection), a **fairness control** (sharing), a **security control** (abuse), and a **product lever** (plans). A good limit does all four at once.

### Q2. Explain the token bucket algorithm.

A **token bucket** holds up to `B` tokens and refills at `R` tokens/second. Each request removes one token; if the bucket is empty, the request is rejected (or queued). Because tokens *accumulate* up to `B` while you're idle, the bucket **allows bursts** up to `B` requests, then settles to the steady rate `R`.

```text
capacity B=10, refill R=2/sec
bucket: [##########]  10 tokens (idle, saved up)
burst of 10 requests → all allowed, bucket empties
[          ] 0 tokens
next requests → rejected until refill: +2 tokens/sec
after 1s: [##] → 2 more allowed
```

- **Steady rate** = refill rate `R`.
- **Burst tolerance** = bucket capacity `B`.

This is the most popular general-purpose algorithm (used by AWS, Stripe-style APIs, and NGINX) because it's cheap (store just `tokens` + `last_refill_timestamp`, compute lazily on each request) and its two knobs map directly to intuitive product decisions: "sustained rate" and "how big a burst do we forgive." Contrast with leaky bucket, which does the opposite on bursts.

### Q3. Token bucket vs leaky bucket — what's the difference?

They look similar but behave *oppositely on bursts*:

| | Token bucket | Leaky bucket |
|---|---|---|
| Metaphor | Tokens refill; spend to send | Requests queue; drain at fixed rate |
| Bursts | **Allowed** (up to bucket size) | **Smoothed away** (steady outflow) |
| Output | Bursty-but-capped | Perfectly steady |
| Rejects when | No tokens available | Queue is full (overflow) |
| Good for | APIs that want to forgive bursts | Protecting a downstream that needs steady input |

```text
Token bucket:  idle → save tokens → allow a burst, then throttle
Leaky bucket:  burst arrives → queued → released at constant rate (drip)
```

**Token bucket permits a saved-up burst**; **leaky bucket enforces a constant output rate** no matter how bursty the input, buffering the excess in a queue and dropping on overflow. Pick token bucket when clients legitimately burst (a UI that fires several calls on page load) and you want to allow it. Pick leaky bucket when the thing you're protecting downstream *must* receive a smooth, constant rate (e.g. a fragile legacy system or a rate-limited third-party you call). Most public API rate limiters use token bucket; leaky bucket shows up more in traffic-shaping/queueing.

### Q4. Fixed window vs sliding window — and what's the boundary problem?

**Fixed window**: count requests per fixed calendar interval (e.g. per clock-minute); reset the counter each interval. Dead simple — one counter per caller per window.

The **boundary problem**: a client can send the full limit at the *end* of one window and the full limit again at the *start* of the next, concentrating **2× the limit** in a short span straddling the boundary.

```text
limit = 100/min
12:00:59  → 100 requests (fills window 12:00)
12:01:00  → 100 requests (fresh window 12:01)
= 200 requests in ~1 second across the boundary
```

**Sliding window** fixes this by measuring over a *moving* window:

- **Sliding window log** — store timestamps of recent requests; count those within the last 60s exactly. Accurate but memory-heavy.
- **Sliding window counter** — approximate by weighting the previous window's count by how far into the current window you are. Cheap and smooth; the common production choice.

```text
Sliding counter at 12:01:15 (25% into current minute):
  estimate = current_count + previous_count * (1 - 0.25)
```

Trade: fixed window is cheapest but bursty at edges; sliding window costs a bit more state/compute but removes the 2× boundary burst. Most serious APIs use a sliding-window counter as the sweet spot.

### Q5. What status code and headers do you return when a client is rate-limited?

**`429 Too Many Requests`**, with headers that tell the client exactly what happened and when to retry:

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 30
RateLimit-Limit: 100
RateLimit-Remaining: 0
RateLimit-Reset: 30
Content-Type: application/json

{ "type": "https://api.example.com/errors/rate-limited",
  "title": "Rate limit exceeded",
  "detail": "You have exceeded 100 requests per minute. Retry in 30s.",
  "status": 429 }
```

- **`429`** — the correct status (a 4xx: the client should slow down). Not `503` (that's server overload, though the two blur under load).
- **`Retry-After`** — seconds to wait (or an HTTP-date). The single most important header — it tells a well-behaved client exactly when to come back.
- **`RateLimit-Limit` / `-Remaining` / `-Reset`** — advertise the budget so clients can self-pace *before* hitting the wall (these are increasingly standardised via the IETF `RateLimit` header fields).

Best practice: send the `RateLimit-*` headers on **every** response (not just 429s) so clients can throttle themselves proactively, and always include a machine-readable body consistent with your other errors. The combination turns rate limiting from a mysterious wall into a documented, self-serviceable contract.

### Q6. Per-key vs per-IP vs per-user rate limiting — how do you choose?

You limit on whatever *identity* best isolates the actor you're trying to constrain:

| Scope | Isolates | Weakness |
|---|---|---|
| **Per API key / client** | An application/integration | Multiple users behind one key share the budget |
| **Per user** | An end user | Needs authenticated identity |
| **Per IP** | A network origin | **Shared** (corporate NAT, mobile carriers) and rotatable |

- **Per-key** is the default for a public API — you issued the key, it maps to a plan/tier, and it's not spoofable. Best for fairness and monetisation.
- **Per-user** matters when one key fronts many users (a SaaS integration) and you don't want one user to exhaust a shared key's budget.
- **Per-IP** is the fallback for *unauthenticated* traffic (login endpoints, signup, anonymous reads) — but IPs are shared (thousands of users behind one corporate/carrier NAT) and easily rotated by attackers, so it both over-blocks innocents and under-blocks abusers.

Real systems **layer** them: per-IP on anonymous/auth endpoints, per-key/per-user once identified, and sometimes a global limit as a backstop. The guiding rule: **limit on the most specific identity you can trust** — falling back to IP only when you have nothing better.

### Q7. How do you implement rate limiting across many servers? (distributed rate limiting)

The problem: if each of N servers keeps a *local* counter and each allows the full limit, you actually permit **N× the intended rate**. You need a *global* view. Options, trading accuracy vs latency:

- **Centralised store (Redis).** All servers increment a shared counter/token bucket in Redis (often via an atomic Lua script so check-and-decrement is race-free). Accurate and simple; the cost is a network hop per request and Redis becoming a hot dependency. This is the most common production approach.
- **Local buckets + approximation.** Each server enforces `limit / N` locally, or uses a local bucket synced periodically. No per-request hop (fast), but only approximately correct and unfair if load is uneven across servers.
- **Gateway-level enforcement.** Push the limit to the API gateway / load balancer tier (many gateways do distributed rate limiting natively), so individual services don't each solve it.

```text
Server A ┐
Server B ├──► Redis: INCR key:usr_123:window  (atomic, TTL = window)
Server C ┘         → if count > limit: 429
```

The core tradeoff: **shared-store = accurate but adds latency and a bottleneck; local approximation = fast but loose.** For most APIs, a Redis-backed sliding-window counter at the gateway is the pragmatic sweet spot — correct enough, fast enough, and centralised so services stay simple.

### Q8. What are quotas and tiers, and how do they differ from rate limits?

They operate on **different time horizons** and serve different purposes:

- **Rate limit** — short-horizon *smoothing*: "100 requests per **minute**." Protects capacity and shapes burst behaviour moment-to-moment.
- **Quota** — long-horizon *allowance*: "1,000,000 requests per **month**." A billing/consumption cap tied to a plan, not an overload control.

**Tiers/plans** bundle both into a product:

```text
Free:  60 req/min,   10k req/month
Pro:   1000 req/min, 5M req/month
Enterprise: custom + burst allowances
```

You typically enforce them together: a request can pass the monthly quota but still be rejected by the per-minute rate limit (or vice versa). Communicate both — separate headers or error codes so a client knows *which* it hit ("you're going too fast right now" vs "you've used your month"). The distinction matters in an interview because it shows you see rate limiting as both an **operational control** (per-minute, protects the system) and a **product/monetisation lever** (per-month, defines the plan) — different mechanisms even though both end in a 429.

### Q9. A client hits a 429. What should it do, and what's the wrong thing to do?

**Right behaviour: back off, don't hammer.**

1. **Honour `Retry-After`.** If the server says wait 30s, wait 30s — it's telling you exactly when capacity returns.
2. **Exponential backoff + jitter** if no `Retry-After`: wait 1s, 2s, 4s, 8s… with random jitter added to each. Jitter is essential — without it, all rate-limited clients retry *in lockstep* and re-collide (the "thundering herd").
3. **Watch `RateLimit-Remaining`** on normal responses and *self-throttle before* hitting zero.
4. **Cap retries** and surface a real error rather than retrying forever.

**Wrong behaviour: immediate/tight-loop retries.** Retrying instantly after a 429 makes the overload worse, wastes the client's own resources, and can get it flagged as abusive. Synchronised retries (no jitter) from many clients recreate the exact spike the limit was defending against.

```text
429 → wait Retry-After (or 2^n sec + random jitter) → retry → cap at N attempts → fail cleanly
```

The senior point: a 429 is a *cooperative* signal, not a wall to beat against. Well-behaved clients treat it as flow control; the server's headers exist precisely so clients can be well-behaved.

### Q10. How do you handle bursts while staying fair?

The tension: legitimate clients *do* burst (a dashboard firing several calls on load), but you can't let bursts starve others or overwhelm the backend. Techniques:

- **Token bucket with a sensible bucket size.** The bucket capacity *is* your burst allowance — a steady rate of 10/s with a bucket of 50 forgives a 50-request spike, then settles. This is the primary lever: separate "sustained rate" from "burst tolerance."
- **Per-caller isolation.** Fairness comes from limiting *each* caller independently so one client's burst spends only its own budget, never the shared pool.
- **Burst allowances in tiers.** Explicitly sell/grant a burst multiple ("1000/min sustained, up to 2000 in any 10s") so bursts are a documented feature, not an accident.
- **Weighted / priority fairness.** Under contention, give paying/critical callers a larger share; degrade the cheap/anonymous traffic first.

```text
sustained: 10/s   burst bucket: 50
idle 5s → 50 tokens saved → allow a 50-req spike → then back to 10/s
```

The design principle: **decouple the average from the peak.** Token bucket does this natively — tune the rate for backend safety and the bucket for user experience. Fairness then falls out of enforcing that per-caller, so nobody's burst is subsidised by everyone else's budget.

### Q11. What's the difference between rate limiting, throttling, and backpressure?

Three related but distinct concepts:

- **Rate limiting** — a *policy*: a predefined cap ("100/min per key"). Proactive and per-caller; rejects with 429 when exceeded. It's part of your published contract.
- **Throttling** — a *mechanism*: actively slowing or shedding requests. Can be the enforcement of a rate limit (reject/delay), or a reactive response to load (start dropping low-priority work). Broader than a fixed cap.
- **Backpressure** — a *feedback signal*: when a component is overwhelmed, it tells its *upstream* to slow down rather than silently accepting work it can't handle. It propagates load information back through the system so producers match consumer capacity.

```text
Rate limit:  "you may do 100/min"          (policy, per client)
Throttle:    "you're over — slowing you"   (mechanism, reject/delay)
Backpressure:"I'm full — upstream, ease off"(signal, protects the chain)
```

The relationship: a rate limit is a *fixed* boundary you set in advance; backpressure is a *dynamic* signal driven by real-time capacity; throttling is what you actually *do* in both cases. A mature system uses all three — published per-caller limits for fairness, backpressure so overload propagates instead of collapsing a single node, and throttling/load-shedding as the acting mechanism.

### Q12. What is graceful degradation under load, and how does it relate to rate limiting?

**Graceful degradation** means that when a system is overwhelmed, it **reduces service quality deliberately instead of failing catastrophically** — better to serve everyone a slightly worse experience than to crash and serve no one.

Rate limiting is the *first* line of this: by rejecting excess requests early with a cheap `429` (before they touch the database), you **shed load at the edge** and keep the core healthy for everyone within budget. It's controlled sacrifice — you drop the marginal request to protect the whole.

Beyond hard limits, degradation techniques stack:

- **Load shedding** — under extreme load, drop low-priority/anonymous traffic first, keep critical paths alive.
- **Serving stale cache** instead of hitting an overloaded backend.
- **Disabling expensive features** (rich recommendations, heavy aggregations) while keeping the core API responding.
- **Reducing response fidelity** (smaller pages, fewer expansions).

```text
overload → rate-limit edge (429 cheap) → shed low-priority → serve stale cache → last resort: 503 + Retry-After
```

The point interviewers want: rate limiting isn't only about fairness and abuse — it's a **reliability tool**. Rejecting a request with a 1ms `429` is vastly cheaper than letting it queue behind a saturated database and time out, taking healthy requests down with it. Degrade on purpose, at the edge, early.

### Q13. Where should rate limiting be enforced — gateway or service?

**Prefer the gateway/edge as the primary point, with service-level limits as a secondary defence.**

- **At the gateway** — the natural home. It sees all traffic before it reaches your services, already handles auth (so it knows the caller identity to key on), and can reject with a cheap `429` *before* the request consumes any backend resources. Centralising here means you don't reimplement limiting in every service, and the counters/store are shared. This stops the load at the outermost, cheapest layer.
- **At the service** — still valuable for *fine-grained, resource-specific* limits the gateway can't know about (e.g. "this one expensive report endpoint: 5/min" or protecting a specific fragile downstream). Also a defence-in-depth backstop if traffic reaches the service another way.

```text
Client → Gateway [authn + global rate limit → 429 early]
                 → Service [endpoint-specific limit for expensive ops]
                 → DB
```

The principle mirrors authorization: **coarse, identity-based limiting at the edge** (cheap, centralised, protects everything behind it) and **specific limiting at the service** for the cases only the service understands. Doing it *only* in services means every service re-solves it and load already reached them; doing it *only* at the gateway misses per-endpoint nuance. Both, different granularities.

### Q14. Design rate limiting for a public API. Walk through the decisions.

A concrete design covering the axes an interviewer wants:

**1. Algorithm** — **token bucket** (or sliding-window counter) per caller: steady rate + a burst bucket, so legitimate bursts are forgiven and the average protects the backend.

**2. Scope/identity** — **per API key** primarily (maps to plan, not spoofable); **per-IP** on unauthenticated endpoints (login/signup) to blunt brute force; a global backstop limit.

**3. Tiers** — limits tied to plans, so it's a product lever:

```text
Free:  60/min,   10k/month
Pro:   1000/min, 5M/month,  burst 2000/10s
```

**4. Communication** — `RateLimit-Limit/Remaining/Reset` on **every** response so clients self-pace; on breach, `429` + `Retry-After` + a consistent problem+json body.

**5. Distribution** — Redis-backed counters at the **gateway** (atomic Lua script) so the limit is global across all servers and enforced before requests hit services.

**6. Fairness & degradation** — per-caller isolation so one client can't starve others; under extreme load, shed anonymous/free traffic first (graceful degradation).

**7. DX** — document limits in the OpenAPI spec and developer portal, provide a sandbox, and make tightening a limit a **deprecation-lifecycle** change (it's a breaking change to the contract), never a silent tightening.

The narrative to deliver: token bucket per key, tiered by plan, enforced globally at the gateway via Redis, communicated through standard headers, degrading fairly under stress, and documented as part of the contract. That hits reliability, fairness, security, monetisation, and DX in one design.

### Q15. How do you rate limit unauthenticated endpoints like login or signup?

These are the hardest to limit because you have **no trusted identity** yet — and they're exactly the endpoints attackers hammer (credential stuffing, brute force, signup spam). You layer imperfect signals:

- **Per-IP limiting** — the primary lever, since it's all you have pre-auth. Accept that it's blunt (shared NATs over-block, attackers rotate IPs) and set it generously enough not to lock out a corporate office but tight enough to slow a single attacker.
- **Per-account/per-identifier limiting** — rate-limit attempts *against a given username/email* regardless of source IP. This catches distributed credential stuffing that IP limits miss ("5 failed logins for `alice@` per 15 min, from anywhere").
- **Progressive/adaptive throttling** — increase delay or difficulty after each failure (exponential backoff on the *server* side), and escalate to a **CAPTCHA** or step-up challenge after a threshold.
- **Fingerprinting + anomaly detection** as a supplement (device/TLS fingerprints), and a global cap as a backstop.

```text
Login abuse defence (layered):
  per-IP:        20 attempts / 15 min
  per-account:   5 failed / 15 min  (catches distributed stuffing)
  after N fails: CAPTCHA / exponential delay
```

The key insight: **for authenticated APIs you limit per-key; for the unauthenticated front door you must combine per-IP *and* per-target-account limits**, because each alone has a gap — IP limits miss distributed attacks, account limits miss IP-level flooding. Together with progressive challenges, they make brute force expensive without locking out legitimate users.

### Q16. Should exceeding a rate limit return 429 or 503? And what about a hard quota?

**Distinguish the reason:**

- **`429 Too Many Requests`** — *this caller* exceeded *their* allotted rate. It's caller-specific and expected; the client should back off per `Retry-After`. This is the right code for normal per-key/per-user rate limiting.
- **`503 Service Unavailable`** — the *server* is overloaded or down for everyone; it's a server-side (5xx) condition, not the specific caller's fault. Use it when you're shedding load globally because the system itself is saturated, ideally also with `Retry-After`.

The nuance: they blur under stress. A 429 says "you specifically are going too fast"; a 503 says "we as a whole can't serve right now." Return **429** for policy limits, **503** for genuine capacity exhaustion / load shedding.

**Hard quota (monthly plan exhausted)** is a third case — it's not "too fast," it's "out of allowance." **429 is still the common choice** but with a body/error code that clearly says *quota* not *rate*, so the client knows retrying later today won't help (they must wait for reset or upgrade the plan):

```http
HTTP/1.1 429 Too Many Requests
RateLimit-Reset: 1209600
{ "type": "https://api.example.com/errors/quota-exceeded",
  "title": "Monthly quota exhausted",
  "detail": "5,000,000 request plan limit reached. Resets 2026-08-01 or upgrade your plan." }
```

The distinction matters: same status, different meaning, and the *body* must disambiguate "slow down" (retry soon) from "you're out" (retry next cycle / upgrade). Some APIs use a distinct code or a `403` for hard quota, but 429-with-a-clear-error-body is the pragmatic mainstream.
## Idempotency & Reliability

### Summary

**What this topic covers**

The design discipline that lets an API survive an unreliable network without corrupting data. Networks drop responses, clients time out and retry, load balancers replay requests — and yet a customer must never be charged twice. This topic is about designing your API's *write* semantics so that "did my request actually happen?" always has a safe answer. Three concern areas: (1) **HTTP-level guarantees** — which methods are *safe* (no side effects) and which are *idempotent* (same result no matter how many times you call them), and why `GET`/`PUT`/`DELETE` differ from `POST`; (2) **idempotency keys** — the client-supplied token that makes a non-idempotent `POST` safe to retry, the mechanism Stripe/PayPal-style payment APIs live on; and (3) **reliability patterns** — at-least-once delivery, dedup, retries with exponential backoff + jitter, optimistic concurrency with ETags, and modelling long-running work as `202 Accepted` + a status resource. The 16 questions here go from "which methods are idempotent" to "design an idempotent payment API." This is the topic that separates people who've *operated* an API from people who've only drawn one.

**Mental model**

Assume every response can be lost. The client sends `POST /v1/charges`, the server creates the charge, and the `201` is dropped by a flaky connection. The client has no way to distinguish "server never got it" from "server did it but I lost the reply" — so a correct client *must* retry, and a correct server *must* make that retry safe. The whole topic falls out of that one asymmetry. Two properties do the work. **Safety**: the request has no observable side effect (`GET`, `HEAD`) — retry freely. **Idempotency**: N identical requests leave the server in the same state as one (`PUT x=5` is still `x=5`; `DELETE` twice is still deleted) — the *result* to the client may differ (second `DELETE` returns `404`) but the *state* converges. `POST` is neither safe nor idempotent by default, so you *add* idempotency with a key: the server records "I've seen key `k`, here's the response I gave" and replays it instead of re-executing. "Exactly once" delivery is a myth over an unreliable channel; what you actually build is **at-least-once delivery + idempotent processing = effectively once**.

**Key terms**

- **Safe method** — no server-side side effect; `GET`, `HEAD`, `OPTIONS`. Cacheable and prefetchable.
- **Idempotent method** — N calls ≡ 1 call in server state; `GET`, `PUT`, `DELETE`, `HEAD`, `OPTIONS`. `POST`/`PATCH` are not (by default).
- **Idempotency key** — client-generated unique token (e.g. `Idempotency-Key: uuid`) that lets the server dedup a retried `POST`.
- **At-least-once delivery** — the message/request is guaranteed to arrive, possibly more than once; the receiver must dedup.
- **Deduplication (dedup)** — dropping a duplicate by recognising a key/ID already processed.
- **Exponential backoff** — wait 1s, 2s, 4s, 8s… between retries to avoid hammering a struggling server.
- **Jitter** — randomised delay added to backoff so retrying clients don't synchronise into a thundering herd.
- **Optimistic concurrency** — detect conflicting concurrent writes via a version/`ETag` rather than locking; loser gets `409`/`412`.
- **`202 Accepted`** — "I've accepted the work but haven't finished it"; pair with a status/polling resource for long-running ops.
- **Idempotency window** — how long the server remembers a key (e.g. 24h) before it may be reused.

**Why interviewers ask this**

This is the fastest way to tell a junior from a senior API designer. A junior designs the happy path: `POST /charges` returns `201`, done. A senior immediately asks "what happens when the client times out and retries?" and reaches for an idempotency key without being prompted. The signal is *whether you assume the network is reliable*. Interviewers push on the exact boundary: "is `PUT` idempotent? is `DELETE`? why not `POST`?" — mixing up safety and idempotency is an instant tell. The senior move is naming the tradeoffs: idempotency keys need storage and a TTL; backoff needs jitter or you build a thundering herd; "exactly once" needs to be reframed as at-least-once + dedup. Payment APIs make this concrete, which is why "design an idempotent payment endpoint" is a near-universal question at fintechs.

**Common confusions**

- "Safe and idempotent are the same thing" — no. `DELETE` is idempotent (state converges) but *not* safe (it has a side effect). `GET` is both.
- "`PUT` and `POST` both create, so both are idempotent" — `PUT /users/alice` with the same body twice is idempotent (you addressed the resource); `POST /users` twice creates two users.
- "Idempotent means I get the same response code every time" — no, it means the same *server state*. A second `DELETE` legitimately returns `404`/`410`; the resource is still gone.
- "Idempotency keys make the operation idempotent" — they make *retries* safe by dedup; the underlying operation is still logically a create. Two *different* charges need two *different* keys.
- "We use a message queue, so we get exactly-once" — queues give at-least-once (or at-most-once); exactly-once end-to-end requires idempotent consumers doing dedup.
- "Just retry on any error" — retrying a non-idempotent `POST` with no key can double-charge; retrying a `4xx` (client error) is pointless. Retry `5xx`/timeouts on idempotent (or keyed) requests only.

**What follows from this topic**

Idempotency underpins nearly everything async. Webhooks are the mirror image — *you* deliver at-least-once, so *your consumer* must dedup on event ID. Rate limiting interacts with retries: backoff must respect `Retry-After` from a `429` or your retries make the overload worse. The `202 Accepted` + status-resource pattern is the REST-native way to model the long-running operations that gRPC handles with streaming. And optimistic concurrency with `ETag`/`If-Match` is the same conditional-request machinery you'll use for HTTP caching. If you internalise "assume the response can be lost," the rest of reliable API design is mechanical.

### Q1. What's the difference between a safe method and an idempotent method?

They're two different properties, and mixing them up is the classic tell.

**Safe** = no observable side effect on the server. You could send it a thousand times or prefetch it speculatively and nothing changes. `GET`, `HEAD`, `OPTIONS`.

**Idempotent** = making the same request N times leaves the server in the same *state* as making it once. The *response* may differ, but the state converges. `GET`, `HEAD`, `OPTIONS`, `PUT`, `DELETE`.

Every safe method is idempotent, but not every idempotent method is safe: `DELETE /v1/orders/123` has a side effect (the order is gone) so it's not safe, but calling it twice leaves the same state (still gone) so it *is* idempotent.

| Method | Safe | Idempotent |
|---|---|---|
| GET | Yes | Yes |
| HEAD | Yes | Yes |
| PUT | No | Yes |
| DELETE | No | Yes |
| POST | No | No |
| PATCH | No | No (usually) |

The practical payoff: safe methods can be cached and retried blindly; idempotent methods can be *retried* blindly (even if not cached); `POST`/`PATCH` need extra machinery (an idempotency key) before a retry is safe.

### Q2. Which HTTP methods are idempotent and why does it matter operationally?

`GET`, `HEAD`, `OPTIONS`, `PUT`, and `DELETE` are idempotent. `POST` and `PATCH` are not (by default).

- **`PUT`** replaces the resource with the supplied representation. `PUT /v1/users/alice {"name":"Alice"}` twice ⇒ same final state. Idempotent.
- **`DELETE`** removes the resource. Second call finds nothing to delete; state is unchanged (still gone). Idempotent — even though the response may switch from `204` to `404`.
- **`POST`** typically *creates a new subordinate resource*. `POST /v1/orders` twice ⇒ two orders. Not idempotent.
- **`PATCH`** is idempotent only if the patch is absolute. `PATCH {"status":"shipped"}` is idempotent; `PATCH {"op":"increment","field":"views"}` is not.

Why it matters: this is what tells your infrastructure and clients what's safe to **automatically retry**. HTTP libraries, service meshes, and load balancers will retry idempotent requests on a connection failure. If you make an endpoint that *mutates* respond to `GET`, or you use `POST` for a natural upsert, you've broken the contract every layer of the stack relies on — a proxy may replay it and cause damage.

### Q3. Design an idempotent payment API. Walk me through it.

The requirement: a client can safely retry "charge alice $50" after a timeout without ever double-charging. Use a client-supplied **idempotency key**.

```http
POST /v1/charges HTTP/1.1
Host: api.example.com
Authorization: Bearer sk_...
Idempotency-Key: 7b3f9c2e-1a4d-4e88-9f2a-0c5b1d2e3f4a
Content-Type: application/json

{ "amount": 5000, "currency": "usd", "source": "card_abc", "customer": "cus_123" }
```

Server logic:

1. Look up the key in an `idempotency_records` table (unique index on `(key, endpoint)`).
2. **Not seen** → insert a row `status=in_progress`, execute the charge inside a transaction, store the full response body + status code against the key, return `201`.
3. **Seen and completed** → *replay the stored response* verbatim (same `201`, same charge ID). Do not re-charge.
4. **Seen but still in_progress** → the original is racing; return `409 Conflict` (client should retry after backoff) rather than risk a double execution.
5. **Seen with a different request body** → return `422` — the key was reused for a different operation, which is a client bug.

```text
Client            Server                    DB
  | POST + key K --->|                        |
  |                  |-- INSERT K (in_prog) -->|  (unique index guards races)
  |                  |-- charge processor -----|
  |                  |-- UPDATE K = response ->|
  |<--- 201 --------|                         |
  |  (timeout, retry same K)                   |
  | POST + key K --->|                         |
  |                  |-- SELECT K -> completed |
  |<--- 201 (replayed, no re-charge) ----------|
```

Details that separate a good answer: keys have a **TTL** (e.g. 24h — after that the key may be reused); the key must be **client-generated** (a UUID) so it's stable across the client's own retries; and the record must be written **atomically with the charge** (same transaction, or the charge's own ID *is* the dedup key at the processor).

### Q4. What does "at-least-once delivery" mean and what does it demand of the receiver?

At-least-once means the transport guarantees your message/request arrives, but it may arrive **more than once** — because the sender retries when it doesn't get an ack, and the ack itself can be lost after the message was already processed.

It's the default for most reliable messaging systems (SQS, Kafka with retries, webhook deliverers) because the alternative — at-most-once — drops messages on failure, which is usually worse.

The demand it places on the receiver: **be idempotent**. Since you'll occasionally see the same message twice, you must dedup. The standard technique is a unique message/event ID plus a "have I processed this ID?" check:

```text
on message(msg):
  if seen_ids.contains(msg.id):   # dedup
      ack(msg); return            # already handled — just ack again
  process(msg)                    # do the real work
  seen_ids.add(msg.id)            # remember it (with a TTL)
  ack(msg)
```

The subtlety: `process` and `seen_ids.add` should be atomic (one transaction), or a crash between them re-processes on redelivery. Get this right and at-least-once delivery + idempotent processing gives you **effectively-once** semantics — the only honest form of "exactly once."

### Q5. How should a client retry safely? Explain exponential backoff and jitter.

Naive retry — "on failure, retry immediately in a tight loop" — turns a brief blip into an outage: thousands of clients hammer a recovering server in lockstep (a thundering herd) and knock it back down.

**Exponential backoff**: wait longer after each failure — 1s, 2s, 4s, 8s, capped at some max (e.g. 30s). This gives the server room to recover.

**Jitter**: add randomness so clients don't all retry at the same instant. Without jitter, backoff just synchronises the herd onto the same schedule.

```text
base = 1s ; cap = 30s
for attempt in 0..max:
  do_request()
  # "full jitter": random between 0 and the exponential ceiling
  delay = random(0, min(cap, base * 2**attempt))
  sleep(delay)
```

Rules that make it correct:

- Only retry **idempotent or idempotency-keyed** requests. Never blind-retry a `POST` without a key.
- Only retry **transient** failures: timeouts, connection resets, `429`, `503`, `502`. Do **not** retry `400`/`401`/`404`/`422` — the request is wrong; retrying wastes calls.
- **Respect `Retry-After`** when the server sends it (on `429`/`503`) — that overrides your own backoff.
- Cap total attempts and total time; give up and surface the error rather than retrying forever.

### Q6. Is PUT always idempotent? Is POST ever idempotent?

**`PUT` is idempotent by design.** It's a full replacement addressed at a specific URI: `PUT /v1/users/alice` with the same body twice yields the same resource state. The one caveat is *server-side non-determinism* — if your `PUT` handler does something like set `updated_at = now()` or increments a counter as a side effect, the observable state drifts between calls. Keep `PUT` a pure replacement and it stays idempotent.

**`POST` is not idempotent by default** — `POST /v1/orders` twice creates two orders. But you can *make a specific `POST` idempotent* two ways:

1. **Idempotency key** — the client sends `Idempotency-Key`, the server dedups. This is how you make "create a charge" retry-safe.
2. **Natural idempotency** — the operation happens to converge. `POST /v1/users/alice/verify-email` that just sets `verified=true` is naturally idempotent even though it's a `POST`.

So the honest framing: idempotency is a property of the *operation's effect*, and HTTP methods carry a *default expectation* about that effect. `PUT` promises idempotency; `POST` doesn't, but you can layer it on.

### Q7. A client sends the same request twice with the same idempotency key but a different body. What do you return?

Return `422 Unprocessable Entity` (some APIs use `400`). This is a client bug: an idempotency key identifies *one specific operation*, so reusing it for a different payload is a contradiction the server must reject rather than guess about.

The check: when you record a key, also store a fingerprint of the request (e.g. a hash of the canonicalised body). On a repeat:

```text
if key exists:
   if stored_body_hash == incoming_body_hash:
        replay stored response   # legit retry
   else:
        return 422 "Idempotency-Key reused with a different request body"
```

If you *didn't* do this and just replayed the first response, the client would think its *second, different* charge succeeded when it never happened — a silent data-loss bug. If you instead *executed* the second body under the same key, you'd defeat the whole point and double-charge. Rejecting is the only safe option.

### Q8. Why is "exactly-once delivery" considered a myth, and what do you build instead?

Exactly-once *delivery* is impossible over an unreliable network by the same argument as the Two Generals problem: the sender can't distinguish "message lost" from "message delivered but ack lost," so it must either risk re-sending (→ at-least-once) or risk never sending (→ at-most-once). There's no third option at the delivery layer.

What people *mean* when they say "exactly once" is exactly-once **processing / effect**, and you build it as:

**at-least-once delivery + idempotent consumer (dedup) = effectively-once**

The delivery layer over-delivers; the consumer collapses duplicates using a stable ID. Frameworks that advertise "exactly-once" (Kafka transactions, for instance) achieve it precisely this way under the hood — transactional writes plus offset commits that dedup — within a bounded scope, not as magic across arbitrary systems.

So in an interview: never claim you'll get exactly-once delivery. Say you'll do at-least-once delivery and make the receiving side idempotent, and name the dedup key you'd use.

### Q9. How do you design an API for a long-running operation that can't finish within one request?

Don't block the connection for 30 seconds. Use the **`202 Accepted` + status resource** pattern: accept the work, return a handle, let the client poll (or get a webhook) for completion.

```http
POST /v1/video-exports HTTP/1.1
Content-Type: application/json

{ "source": "vid_123", "format": "mp4" }
```
```http
HTTP/1.1 202 Accepted
Location: /v1/video-exports/exp_789
Content-Type: application/json

{ "id": "exp_789", "status": "processing" }
```

The client then polls the status resource:

```http
GET /v1/video-exports/exp_789
```
```http
HTTP/1.1 200 OK
{ "id": "exp_789", "status": "completed", "result_url": "https://.../out.mp4" }
```

Design notes:

- `202` means "accepted, not done" — distinct from `201` ("created and here it is").
- The `Location`/status resource models the async job as a first-class REST resource with its own lifecycle (`processing` → `completed`/`failed`).
- Support `Retry-After` on the status endpoint to tell the client how often to poll, or offer a **webhook** so the client doesn't poll at all.
- Make the initial `POST` idempotency-key-protected so a retried submit doesn't kick off two exports.

This is the REST-native answer; gRPC would model the same thing with a server-streaming call or a long-running-operations API.

### Q10. How do you prevent two concurrent updates from clobbering each other? Explain optimistic concurrency with ETags.

Use **optimistic concurrency control**: don't lock, but detect conflicts using a version token (`ETag`). The client must prove it's updating the version it last saw.

Read returns an `ETag`:

```http
GET /v1/documents/doc_1
```
```http
HTTP/1.1 200 OK
ETag: "v3"

{ "title": "Draft", "body": "..." }
```

Write is *conditional* on that version via `If-Match`:

```http
PUT /v1/documents/doc_1
If-Match: "v3"

{ "title": "Draft", "body": "edited" }
```

- If the server's current version is still `"v3"` → apply, bump to `"v4"`, return `200`.
- If someone else already wrote `"v4"` → return **`412 Precondition Failed`** (or `409 Conflict`). The client must re-fetch, rebase its change, and retry.

```text
Alice GET -> ETag v3        Bob GET -> ETag v3
Alice PUT If-Match v3 -> 200 (now v4)
Bob   PUT If-Match v3 -> 412 (stale) -> re-fetch v4, retry
```

This is "last writer must have seen the latest" instead of "last writer wins silently." It costs the client a retry on conflict but needs no locks, scales, and never loses an update without the client knowing. Use `409` when the conflict is semantic and `412` when it's specifically a failed precondition — many APIs standardise on one.

### Q11. Which status code do you return for a duplicate request caught by an idempotency key?

Two acceptable designs, and you should be able to defend your pick:

**Option A — replay the original response (most common).** Return exactly what the first successful call returned: `201 Created` with the same resource body and ID. The client can't tell (and shouldn't need to tell) that it was a duplicate — from its perspective the operation succeeded, which is true. Stripe does this. Optionally signal it with a header like `Idempotent-Replayed: true`.

**Option B — `409 Conflict` while the original is still in flight.** If the first request is still processing when the retry arrives (an in-progress key), return `409` so the client backs off and retries rather than triggering a parallel execution.

What you should *not* do: return `200`/`201` for the duplicate while actually executing it again, or return a generic `400` that gives the client no way to know its operation is safely done. The principle: a duplicate of a *succeeded* operation should look like success (replay); a duplicate of an *in-flight* operation should look like "try again shortly" (`409` + backoff).

### Q12. Spot the reliability bug: a mobile client POSTs an order, times out, retries, and the user is charged twice. Fix it.

The bug is a non-idempotent `POST` with no dedup. The first `POST /v1/orders` succeeded on the server, but the `201` was lost to the timeout; the client, correctly, retried — and the server, having no way to recognise the retry, created a second order and a second charge.

The fix is an idempotency key generated **once per logical order on the client** and reused across that order's retries:

```http
POST /v1/orders
Idempotency-Key: order-attempt-6f1c...   # same across retries of THIS order
```

Server dedups on the key (see Q3). Common ways teams get this wrong:

- **Generating the key on the server** — useless; the whole point is the client's two attempts share one key.
- **Regenerating the key on each retry** — now the two attempts have different keys and both execute. The key must be minted before the *first* attempt and cached by the client.
- **Not persisting the key record atomically with the order** — a crash between "create order" and "save key" lets the retry slip through.

Second-line defence: a unique constraint at the data layer (e.g. one active order per `(customer, cart_hash)` window) so even a key failure can't produce two charges.

### Q13. When is it safe to retry a failed request, and when is it not?

Decide on two axes: **is the method retry-safe** and **is the failure transient**.

Retry-safe means idempotent (`GET`, `PUT`, `DELETE`) *or* a `POST`/`PATCH` carrying an idempotency key. Anything else, a retry can double-apply.

Transient means the failure might succeed if you try again:

| Signal | Retry? | Why |
|---|---|---|
| Timeout / connection reset | Yes (if retry-safe) | Server state unknown; keyed request dedups |
| `429 Too Many Requests` | Yes, after `Retry-After` | Explicitly "back off and retry" |
| `503 Service Unavailable` | Yes, with backoff | Temporary overload/maintenance |
| `502` / `504` gateway errors | Yes, with backoff | Upstream blip |
| `500` | Cautiously | Might be transient; might not — cap attempts |
| `400` / `422` | No | Request is malformed; it'll fail identically |
| `401` / `403` | No | Auth won't fix itself by retrying |
| `404` | No | Resource isn't there |
| `409` | Sometimes | Only after resolving the conflict (re-fetch, rebase) |

The trap: retrying a bare `POST` on a timeout. The request may have *succeeded* server-side — you just lost the reply — so a blind retry double-writes. Only retry it if it's keyed.

### Q14. How long should a server remember an idempotency key, and why not forever?

Pick a bounded window — commonly **24 hours** — and document it. Storing keys forever is unnecessary and expensive: legitimate retries happen within seconds to minutes of the original, so a day is generous cover for even a client that queued the request offline.

The tradeoffs:

- **Too short** (e.g. 1 min) — a client that retries after a long network partition or an offline queue flush gets its operation executed twice because the key already expired.
- **Too long / forever** — unbounded storage growth, and you can never let a client legitimately reuse a key value for a genuinely new operation.
- **Just right** — cover the maximum realistic retry horizon (offline mobile clients, background jobs) plus margin.

Operational details: store keys with a TTL so they auto-expire (a TTL index in the datastore, or a periodic sweep). Make the window explicit in your docs so clients know that reusing a key *after* it expires is a new operation, not a replay. And scope the key to the endpoint/account so key collisions across tenants are impossible.

### Q15. Your webhook consumer occasionally processes the same event twice. How do you make it idempotent?

This is at-least-once delivery (Q4) from the *receiving* side. Webhook senders retry on non-2xx or timeout, so you *will* see duplicates — the fix is dedup on the provider's **event ID**, not building "exactly once" delivery.

```http
POST /webhooks/payments HTTP/1.1
X-Event-Id: evt_9f2a
X-Signature: sha256=...

{ "type": "charge.succeeded", "data": { "charge": "ch_123", "amount": 5000 } }
```

Consumer:

```text
verify_hmac_signature(req)            # reject forgeries first
if processed_events.contains(evt_id): # dedup
    return 200                        # ack again so sender stops retrying
process_event(payload)                # in one transaction with the insert below
processed_events.insert(evt_id)
return 200
```

Key points:

- Dedup on the **sender's event ID**, which is stable across the sender's retries — not on your own receipt time.
- `process_event` and `processed_events.insert` must be **atomic** (same DB transaction), or a crash between them re-processes on redelivery.
- **Always ack a recognised duplicate with `200`** — if you return an error, the sender keeps retrying forever.
- Verify the signature *before* dedup so you don't populate your dedup table from forged events.

### Q16. Compare optimistic vs pessimistic concurrency control for an API. When would you pick each?

| | Optimistic (ETag / version) | Pessimistic (locks) |
|---|---|---|
| Mechanism | Detect conflict at write via `If-Match`/version | Acquire a lock before read/write |
| Conflict cost | Loser gets `409`/`412`, retries | Waiters block until lock frees |
| Contention fit | Low contention (conflicts rare) | High contention (conflicts common) |
| Scalability | Excellent — no shared lock state | Worse — lock coordination, deadlock risk |
| Client complexity | Must handle retry-on-conflict | Simpler client, but can hang/timeout |
| Statelessness | Fits stateless HTTP naturally | Awkward — who holds the lock across requests? |

**Pick optimistic** for almost all web APIs: conflicts on a given resource are rare (two people editing the *same* document at the *same* instant is unusual), and it keeps the API stateless and horizontally scalable. Return `412`/`409` and let the client re-fetch and retry. This is the default.

**Pick pessimistic** only when conflicts are frequent *and* a retry loop would be wasteful or a partial update is intolerable — e.g. decrementing scarce inventory under a flash sale, where dozens of requests contend for the last unit. Even then, prefer a short-lived database-level lock (a transactional `SELECT ... FOR UPDATE`) over an application-held lock across HTTP requests, which strands the lock if the client disappears.

## GraphQL

### Summary

**What this topic covers**

GraphQL as an *API design choice*: a query language and type system where the client asks for exactly the fields it wants in a single request against a strongly-typed schema, instead of hitting a fixed set of REST endpoints. This topic is about when that model earns its keep and what it costs you. Three concern areas: (1) **the schema and execution model** — SDL types, the three root operations (`query`, `mutation`, `subscription`), and resolvers as the functions that fetch each field; (2) **the problems it solves** — over-fetching (REST hands you fields you didn't want) and under-fetching (REST makes you call three endpoints to build one screen), both collapsed into one round trip; and (3) **the problems it *creates*** — the N+1 resolver explosion (solved with DataLoader batching), caching that's far harder than REST's URL-based HTTP caching, auth that must live in resolvers, and error handling where a response can be *partially* successful. The 16 questions run from "what is a resolver" to "why is GraphQL caching hard" to "when would you pick REST or gRPC instead." The senior framing throughout: GraphQL is not "better than REST," it's a different set of tradeoffs that pays off for flexible clients and aggregation and punishes you on caching and operational simplicity.

**Mental model**

Think of your backend as a **graph of typed nodes** — a `User` has `posts`, a `Post` has an `author` and `comments`, a `Comment` has an `author`. GraphQL exposes that graph and lets the client describe a *traversal* — "give me this user, their last 3 posts, and each post's comment count" — as a single declarative query. The server walks the query field by field; **every field is backed by a resolver function** that knows how to fetch just that field's data. The schema is a strict contract: the client can only ask for fields the schema declares, and the response shape mirrors the query shape exactly. That's the whole magic — the client controls the response shape, not the server. The corollary, and the thing juniors miss, is that this field-by-field resolution is *also* GraphQL's biggest operational liability: fetch 50 posts and naively resolve each post's `author` and you fire 50 separate author lookups (N+1). And because every query is a `POST` to a single `/graphql` URL with the query in the body, you lose the free HTTP caching that REST gets from cacheable `GET` URLs. GraphQL trades *server-side simplicity and free caching* for *client-side flexibility and one round trip*.

**Key terms**

- **Schema / SDL** — the typed contract written in Schema Definition Language (`type User { id: ID! name: String! }`); `!` means non-null.
- **Query** — a read operation; the client specifies exactly which fields to return.
- **Mutation** — a write operation (create/update/delete); runs sequentially, returns the affected data.
- **Subscription** — a long-lived operation pushing real-time updates to the client (usually over WebSockets).
- **Resolver** — a function that returns the value for one field; `(parent, args, context, info) => value`.
- **Over-fetching** — an endpoint returns more fields than the client needs; GraphQL fixes this by asking for only what you want.
- **Under-fetching** — one endpoint isn't enough, forcing multiple round trips; GraphQL fixes it by traversing the graph in one query.
- **N+1 problem** — resolving a list of N items each triggers 1 extra query for a nested field; 1 + N queries.
- **DataLoader** — a per-request batching + caching utility that collapses N nested lookups into one batched query.
- **Connection / cursor pagination** — the Relay convention: `edges { node cursor } pageInfo { hasNextPage endCursor }` for stable pagination.
- **Partial data** — a GraphQL response can carry both `data` (the fields that resolved) and `errors` (the fields that failed) simultaneously.

**Why interviewers ask this**

GraphQL questions separate people who've *run* it in production from people who've read the marketing. Any junior can recite "no over-fetching, one request." The senior signal is knowing the bill: the first serious follow-up is almost always the **N+1 problem** — if you can't explain how naive resolvers explode into N queries and how DataLoader batches them, you haven't shipped GraphQL. The second is **caching** — "why can't you just put a CDN in front of it like REST?" tests whether you understand that a single `POST /graphql` URL defeats HTTP caching. The third is **judgement**: "when would you *not* use GraphQL?" — a candidate who answers "always use GraphQL" fails; the right answer names public APIs, simple CRUD, file uploads, and service-to-service RPC as places REST or gRPC win. Interviewers want to see you treat it as a tradeoff, not a religion.

**Common confusions**

- "GraphQL replaces REST" — it's an alternative for certain shapes (flexible/aggregating clients), not a universal upgrade. Many systems run both.
- "GraphQL is a database / you query the DB directly" — no, resolvers sit in front of *whatever* data sources you have (DBs, REST services, gRPC); the graph is a facade.
- "GraphQL always means fewer queries" — from the *client's* view, yes (one round trip); from the *server's* view it can mean *more* backend queries (N+1) unless you batch.
- "You don't need pagination, just ask for the list" — an unbounded list field is a footgun; you need connections/cursors and query depth/complexity limits or a client can request the whole graph.
- "GraphQL is cacheable like REST" — HTTP caching mostly doesn't apply (`POST`, single URL); you cache at the client (normalised store) or per-resolver instead.
- "One error means the whole request failed" — GraphQL can return partial `data` alongside `errors`; a `200` can contain field-level failures.
- "Versioning: just make `/v2/graphql`" — GraphQL's model is *no versioning*: evolve the schema additively and deprecate fields with `@deprecated`.

**What follows from this topic**

The concerns here feed directly into the neighbouring topics: the N+1/batching discussion mirrors the reliability and performance concerns elsewhere in this primer, subscriptions are the push-based cousin of webhooks and gRPC streaming, and GraphQL's "no versioning, evolve additively" is the same tolerant-reader philosophy that Versioning & Evolution covers for REST. If GraphQL's caching story frustrates you, that frustration is exactly why gRPC and REST still own large parts of the API landscape — the next topic makes the gRPC case.

### Q1. What is GraphQL and what problem does it solve versus REST?

GraphQL is a query language and runtime for APIs where the **client specifies exactly which fields it wants** against a strongly-typed schema, and the server returns a response shaped precisely like the query — all through a single endpoint (`POST /graphql`).

It targets two REST pain points:

- **Over-fetching** — a REST `GET /v1/users/alice` returns the whole user object (address, preferences, timestamps) even when your screen needs only `name` and `avatar`. GraphQL asks for just those two.
- **Under-fetching (the N+1 round-trip problem for clients)** — building a "profile" screen in REST might take `GET /users/alice`, then `GET /users/alice/posts`, then a call per post for comments. GraphQL fetches the whole tree in one request.

```graphql
query {
  user(id: "alice") {
    name
    avatar
    posts(last: 3) { title commentCount }
  }
}
```

The client controls the response shape, which is powerful when you have many client types (web, iOS, Android) with different data needs and you don't want to ship a new endpoint for each. The cost — caching, N+1 on the server, operational complexity — is the rest of this topic.

### Q2. Explain the three root operation types.

GraphQL has exactly three entry points, declared as special root types in the schema:

- **`Query`** — reads. Side-effect free, and the engine may resolve fields in parallel. This is your `GET` equivalent.

```graphql
query { order(id: "ord_1") { status total } }
```

- **`Mutation`** — writes (create/update/delete). Top-level mutation fields run **sequentially** (so one mutation can depend on the previous), unlike query fields. Convention: return the mutated object so the client can update its cache without a refetch.

```graphql
mutation { cancelOrder(id: "ord_1") { id status } }
```

- **`Subscription`** — a long-lived stream that pushes updates to the client as events happen, typically over WebSockets. This is your real-time channel (order status changed, new message).

```graphql
subscription { orderUpdated(id: "ord_1") { status } }
```

The schema wires them up:

```graphql
type Query    { order(id: ID!): Order }
type Mutation { cancelOrder(id: ID!): Order }
type Subscription { orderUpdated(id: ID!): Order }
```

### Q3. What is a resolver, and how does the execution model work?

A **resolver** is a function that produces the value for a single field. Its signature is `(parent, args, context, info)`:

- `parent` — the value resolved by the parent field (the object this field hangs off).
- `args` — arguments passed to the field (`id: "alice"`).
- `context` — per-request shared state: the authenticated user, DataLoaders, DB handles.
- `info` — the AST/execution details (rarely needed).

Execution is a **tree walk**. The engine resolves the root field, then for each field in the selection set calls that field's resolver with the parent's result, recursing down:

```graphql
query { user(id: "alice") { name posts { title } } }
```

resolves as: `Query.user("alice")` → returns a user → `User.name(user)` and `User.posts(user)` → `posts` returns a list → `Post.title(post)` for each post.

```text
Query.user ─► User ─┬─ User.name  ─► "Alice"
                    └─ User.posts ─► [Post] ─► Post.title (per post)
```

If a field has no explicit resolver, the engine uses a **default**: read the property of the same name off `parent`. This field-by-field model is exactly why the N+1 problem exists — `User.posts` returning N posts means `Post.author` (if requested) fires N times.

### Q4. Explain the N+1 problem in GraphQL and how DataLoader solves it.

The N+1 problem is the signature GraphQL performance trap. Consider:

```graphql
query { posts(last: 50) { title author { name } } }
```

`Query.posts` runs **1** query to fetch 50 posts. Then, because resolution is per-field-per-item, `Post.author` runs **once per post** — **50** separate `SELECT * FROM users WHERE id = ?` queries. That's 1 + N = 51 queries to render one screen. Scale the list and it's catastrophic.

**DataLoader** fixes it with **batching + per-request caching**. Instead of each `Post.author` querying immediately, it registers the author ID with a loader; DataLoader collects all IDs requested in the same tick and fires **one** batched query:

```text
without: SELECT user WHERE id=1; ...WHERE id=2; ... (50 queries)
with:    SELECT user WHERE id IN (1,2,...,50)        (1 query)
```

```javascript
const userLoader = new DataLoader(ids =>
  db.users.whereIn('id', ids).then(rows => ids.map(id => rows.find(r => r.id === id)))
);
// resolver:
Post.author = (post, _args, ctx) => ctx.userLoader.load(post.authorId);
```

Two properties matter: it **batches** (collapses N loads into one `IN` query) and it **dedups within a request** (asking for author `7` twice hits the DB once). DataLoaders live on the per-request `context` so caching never leaks across requests/users. "How do you avoid N+1?" is the most common GraphQL follow-up — the answer is always DataLoader or an equivalent batching layer.

### Q5. How do you paginate in GraphQL? Explain the connections/cursor pattern.

The idiomatic answer is **cursor-based pagination** using the Relay **Connections** spec, not offset/limit. A list field returns a `Connection` with `edges` (each wrapping a `node` and its `cursor`) and a `pageInfo`:

```graphql
type PostConnection {
  edges: [PostEdge!]!
  pageInfo: PageInfo!
}
type PostEdge { node: Post! cursor: String! }
type PageInfo { hasNextPage: Boolean! endCursor: String }

type Query { posts(first: Int!, after: String): PostConnection! }
```

Query and response:

```graphql
query { posts(first: 2, after: "Y3Vyc29yOjEw") {
  edges { node { title } cursor }
  pageInfo { hasNextPage endCursor }
}}
```
```json
{ "data": { "posts": {
  "edges": [
    { "node": { "title": "A" }, "cursor": "Y3Vyc29yOjEx" },
    { "node": { "title": "B" }, "cursor": "Y3Vyc29yOjEy" }
  ],
  "pageInfo": { "hasNextPage": true, "endCursor": "Y3Vyc29yOjEy" }
}}}
```

The client fetches the next page with `after: endCursor`. Why cursors over offset: they're **stable under insertion** (a new row at the top doesn't shift or duplicate results the way `offset` does) and they **scale to deep pages** (no `OFFSET 100000` full scan). The `cursor` is an opaque token (often a base64 of the sort key) — clients must treat it as a black box, never parse it.

### Q6. How does error handling work when part of a query fails?

GraphQL responses can be **partially successful**. Unlike REST — where a request is either a `2xx` success or a `4xx`/`5xx` failure — a GraphQL response (usually HTTP `200`) can contain *both* a `data` object with the fields that resolved and an `errors` array for the fields that didn't:

```json
{
  "data": { "user": { "name": "Alice", "posts": null } },
  "errors": [
    { "message": "Failed to load posts",
      "path": ["user", "posts"],
      "extensions": { "code": "DOWNSTREAM_TIMEOUT" } }
  ]
}
```

Here `user.name` resolved fine but `user.posts` failed; the failed field is `null` and the `errors` array explains where (via `path`) and why (via `extensions.code`). Null propagation: if a *non-null* (`!`) field errors, the null bubbles up to the nearest nullable parent, which can null out a larger subtree — a reason to think carefully about where you put `!`.

Design guidance: put **machine-readable codes** in `extensions.code` (like an error-code field in REST's RFC 7807) so clients can branch on `UNAUTHENTICATED`/`NOT_FOUND` rather than string-matching messages. Many teams also model *expected business errors* (validation, "insufficient funds") as part of the schema — a union or a `userErrors` field on the mutation payload — reserving the top-level `errors` array for *unexpected* failures.

### Q7. Why is caching harder in GraphQL than in REST?

REST gets caching almost for free: every resource is a cacheable `GET` URL, so browsers, CDNs, and reverse proxies cache by URL and validate with `ETag`/`Cache-Control`. GraphQL breaks all three assumptions:

- **One URL, all `POST`.** Every query hits `POST /graphql` with the query in the body. HTTP caches key on method+URL and don't cache `POST`, so the entire HTTP caching layer sits idle.
- **Responses are query-shaped, not resource-shaped.** Two different queries can overlap on the same underlying `User` yet produce different response bodies, so you can't cache "the response" as a unit and reuse it.
- **No natural cache key.** There's no `/v1/users/alice` URL to key on; the "identity" of the data is buried inside a nested response.

So you cache at different layers:

- **Client-side normalised cache** — Apollo/Relay dedupe entities by `__typename` + `id` into a flat store, so overlapping queries share cached objects. This is where most GraphQL caching happens.
- **Per-resolver / data-source caching** — DataLoader (per request) plus a shared cache (Redis) behind resolvers.
- **Persisted queries + `GET`** — register queries server-side and send a hash via `GET`, restoring CDN/HTTP caching for those specific queries (Automatic Persisted Queries).

The honest interview point: you *give up* HTTP's free caching and *buy it back* with more machinery. That's a real cost when choosing GraphQL for a cache-friendly, read-heavy public API.

### Q8. How do you handle authentication and authorization in GraphQL?

**Authentication** (who are you) happens *outside* the GraphQL layer, exactly as in REST: validate the `Authorization: Bearer <token>` header in HTTP middleware, resolve it to a user, and put that user on the per-request `context`.

```javascript
context: ({ req }) => ({ user: verifyJwt(req.headers.authorization), loaders: makeLoaders() })
```

**Authorization** (what may you do) is the harder part, because there are no per-endpoint choke points — a single query can traverse many types and fields. You enforce it *inside resolvers* (or via directives/field middleware):

```javascript
Query.adminReport = (_p, _a, ctx) => {
  if (!ctx.user?.roles.includes('admin')) throw new ForbiddenError('nope');
  return loadReport();
};
Post.author = (post, _a, ctx) => ctx.userLoader.load(post.authorId); // still must check visibility
```

Critical pitfalls specific to GraphQL:

- **Object-level authz (BOLA/IDOR)** must be checked at the *node* level, not just the root. `query { order(id: "someone_elses") { total } }` must verify the caller owns that order in the resolver — the graph makes it easy to walk to objects you shouldn't see.
- **Query depth/complexity limits** — without them, a malicious `user { posts { author { posts { author ... }}}}` can DoS you. Cap depth and assign field costs.
- **Field-level exposure** — a sensitive field (`user.ssn`) needs its own resolver-level check; don't rely on the client "just not asking."

Prefer a declarative approach (schema directives like `@auth(requires: ADMIN)` or a policy layer) so authorization isn't scattered and forgotten across hundreds of resolvers.

### Q9. How do you evolve a GraphQL schema without versioning?

GraphQL's design philosophy is **no versioning** — no `/v2/graphql`. You evolve the *single* schema additively and use `@deprecated` to retire fields gracefully.

**Safe (non-breaking) changes:**
- Add a new type, field, or optional argument.
- Add a value to an enum (with care — clients must handle unknown values).
- Make a non-null output field nullable... actually that's breaking; see below.

**Breaking changes to avoid:**
- Removing or renaming a field/type.
- Changing a field's type.
- Making a nullable argument required, or a non-null output field nullable.

To retire a field, **deprecate rather than delete**:

```graphql
type User {
  fullName: String!
  name: String! @deprecated(reason: "Use fullName")
}
```

Then instrument field-level usage (most GraphQL servers can report which fields each client uses), wait until the deprecated field's traffic drops to zero, and only *then* remove it. Because clients ask for exactly the fields they want, adding fields never affects existing clients — that's the whole reason GraphQL can skip versioning that REST can't. This is the same tolerant, additive-evolution discipline REST versioning uses, just enforced by the type system and the query-your-own-fields model.

### Q10. When should you prefer GraphQL, and when is REST or gRPC the better choice?

Pick GraphQL when its flexibility earns its complexity:

**GraphQL shines:**
- **Many diverse clients** (web, iOS, Android) with different data needs — one schema serves all, no per-client endpoints.
- **Aggregation / graph-shaped data** — one query stitches data from several services/tables (a natural fit for a BFF).
- **Rapidly evolving frontends** — product teams add fields without waiting on backend endpoint changes.
- **Mobile** — bandwidth matters, so fetching exactly the needed fields in one round trip is a real win.

**REST is better for:**
- **Public APIs** where HTTP caching, CDN-ability, and simplicity matter, and you don't control the clients.
- **Simple CRUD** — the ceremony of a schema + resolvers + DataLoaders is overkill.
- **File uploads/downloads, and anything that leans on HTTP semantics** (conditional requests, range requests).

**gRPC is better for:**
- **Internal service-to-service** calls where you want strong typing, codegen, and raw performance over HTTP/2, and human-readable/browser-friendly isn't a requirement.

The senior framing: GraphQL optimises the *client developer's* experience and flexibility at the cost of *server* caching and operational simplicity. If your bottleneck is "clients need flexible, aggregated reads," pick it. If it's "cache a read-heavy public API" or "fast typed internal RPC," don't.

### Q11. Show a small schema and the query/response it produces.

Schema (SDL):

```graphql
type Query {
  user(id: ID!): User
}
type User {
  id: ID!
  name: String!
  email: String
  posts(first: Int = 10): [Post!]!
}
type Post {
  id: ID!
  title: String!
  published: Boolean!
}
```

The `!` marks non-null (`name` is guaranteed present; `email` may be null). `posts` takes an optional `first` argument defaulting to 10.

Query — the client asks for only three fields, skipping `email` and `post.published`:

```graphql
query {
  user(id: "alice") {
    name
    posts(first: 2) { title }
  }
}
```

Response — shaped exactly like the query:

```json
{
  "data": {
    "user": {
      "name": "Alice",
      "posts": [
        { "title": "Hello" },
        { "title": "GraphQL notes" }
      ]
    }
  }
}
```

Note there's no over-fetching (no `email`, no `id`, no `published`) and no under-fetching (user + posts in one round trip). The response mirrors the request's structure — that isomorphism is the core of GraphQL's ergonomics.

### Q12. What is over-fetching and under-fetching, and how exactly does GraphQL eliminate them?

**Over-fetching** — an endpoint returns more than the caller needs. `GET /v1/users/alice` returns the full user (address, billing, timestamps, preferences) when the header bar needs only `name` and `avatarUrl`. Wasted bandwidth, especially painful on mobile.

**Under-fetching** — one endpoint isn't enough, forcing several sequential round trips. To render a profile you call `GET /users/alice`, then `GET /users/alice/posts`, then per-post `GET /posts/{id}/comments`. Latency stacks up (the client's own N+1).

GraphQL kills over-fetching because the **client names the exact fields**; the server returns nothing more. It kills under-fetching because the client **traverses the graph in one query**:

```graphql
query {
  user(id: "alice") {
    name
    avatarUrl
    posts(last: 3) {
      title
      comments(last: 2) { text }
    }
  }
}
```

One request, exactly the fields needed, three levels deep. In REST you'd either make several calls (under-fetch) or build a custom "profile" endpoint that returns a fat blob (over-fetch for other callers). GraphQL lets each client pick its own shape without the server predicting it — that's the win. The catch: this pushes the multiplexing cost onto the *server*, which is where the N+1 problem (Q4) shows up.

### Q13. What are subscriptions and when would you use them over webhooks or polling?

**Subscriptions** are GraphQL's real-time primitive: a long-lived operation (usually over WebSockets) where the server *pushes* data to the client whenever a subscribed event fires.

```graphql
subscription { messageAdded(channel: "general") { id text author { name } } }
```

The client opens the subscription once; the server streams a payload each time a matching event occurs — and, notably, the pushed payload is **shaped by the subscription's selection set**, just like a query.

When to use each:

| Mechanism | Direction | Best for |
|---|---|---|
| Polling | client pulls repeatedly | simple, low-frequency updates; no infra |
| Subscriptions | server → client (WebSocket) | live UI: chat, presence, dashboards, in-app notifications |
| Webhooks | server → *another server* (HTTP) | server-to-server integration events (payment succeeded) |

Use **subscriptions** for pushing live updates into a *connected client UI* — the browser/app is open and wants sub-second updates. Use **webhooks** for *backend-to-backend* eventing where the recipient is another *server* with a stable URL. Use **polling** when updates are infrequent and the operational cost of WebSockets isn't justified. Subscriptions are the heaviest operationally (stateful connections, scaling the pub/sub fan-out), so don't reach for them when polling would do.

### Q14. Compare REST and GraphQL directly.

| Dimension | REST | GraphQL |
|---|---|---|
| Endpoints | Many, resource-based (`/users`, `/posts`) | One (`/graphql`) |
| Data fetching | Server defines response shape | Client defines response shape |
| Over/under-fetch | Common | Eliminated |
| Round trips | Often several for related data | One traversal |
| HTTP caching | Free (cacheable `GET` URLs, `ETag`) | Hard (single `POST` URL) — cache client-side |
| Typing/schema | Optional (OpenAPI) | Mandatory, introspectable schema |
| Versioning | `/v1`, `/v2` common | Additive evolution + `@deprecated`, no versions |
| Error model | HTTP status codes | `200` + `errors` array, partial data |
| Server complexity | Lower | Higher (resolvers, N+1, DataLoader) |
| Best fit | Public APIs, CRUD, cache-heavy reads | Flexible clients, aggregation, mobile |

The one-liner: REST optimises for **HTTP-native simplicity and caching**; GraphQL optimises for **client flexibility and fetch efficiency**. Neither is strictly better — the table is a decision aid, not a scoreboard. In practice large organisations run both: REST (or gRPC) between internal services, GraphQL as a client-facing aggregation layer (a BFF) in front of them.

### Q15. A client complains one GraphQL query occasionally hammers your database with hundreds of queries. Diagnose and fix.

This is almost certainly **N+1 resolution** (Q4), possibly compounded by unbounded nesting. Diagnose in three steps:

1. **Log queries per request.** Turn on DB query logging or an APM trace for one GraphQL request. You'll see the tell: 1 query for the list, then N near-identical single-row lookups for a nested field (`SELECT * FROM users WHERE id = ?` fired 200 times).
2. **Find the offending resolver.** Trace which field spawns the fan-out — typically a nested association like `Post.author` or `Order.lineItems` resolved per parent.
3. **Check query shape.** A deeply nested query (`posts { author { posts { comments ... }}}`) multiplies the fan-out at each level.

Fixes, in order:

- **DataLoader** on the offending field to batch the N lookups into one `IN` query and dedupe within the request. This is the primary fix.
- **Query complexity / depth limits** so a pathological query can't nest forever; assign each field a cost and reject queries over a budget.
- **Pagination** — cap list sizes (`first`) so `posts` can't return 10,000 rows that each trigger nested resolution.
- Optionally **projection**: only fetch DB columns the query actually selected.

The root cause to name in the interview: GraphQL's per-field resolution makes N+1 the *default* failure mode; production GraphQL requires batching (DataLoader) plus complexity limits as table stakes, not optional extras.

### Q16. Design the GraphQL API for a blog: users, posts, comments. Show schema and a representative mutation.

Model the domain as a graph with the relationships as fields, connections for lists, and a mutation-payload pattern for writes.

```graphql
type Query {
  post(id: ID!): Post
  posts(first: Int!, after: String): PostConnection!
}

type Mutation {
  addComment(input: AddCommentInput!): AddCommentPayload!
}

type User {
  id: ID!
  name: String!
  posts(first: Int!, after: String): PostConnection!
}

type Post {
  id: ID!
  title: String!
  body: String!
  author: User!
  comments(first: Int!, after: String): CommentConnection!
}

type Comment {
  id: ID!
  text: String!
  author: User!
  post: Post!
}

input AddCommentInput { postId: ID! text: String! }
type AddCommentPayload {
  comment: Comment
  userErrors: [UserError!]!
}
type UserError { field: String message: String! }
```

The `addComment` mutation and its response:

```graphql
mutation {
  addComment(input: { postId: "post_1", text: "Great post" }) {
    comment { id text author { name } }
    userErrors { field message }
  }
}
```

Design choices worth defending: (1) relationships (`Post.author`, `Post.comments`) are **fields**, not separate endpoints — that's what lets a client fetch a post with its author and comments in one query; (2) list fields use **connections** for cursor pagination (Q5); (3) the mutation takes a single **`input` object** (easy to evolve additively) and returns a **payload** carrying both the created `comment` and a `userErrors` array — so *expected* business/validation errors are modelled in the schema rather than thrown into the top-level `errors` array reserved for unexpected failures. And every nested resolver (`Post.author`, `Comment.author`) would use a **DataLoader** to avoid N+1.

## gRPC & RPC APIs

### Summary

**What this topic covers**

gRPC as the high-performance, strongly-typed choice for API design — and RPC (remote procedure call) style more broadly, where you call a *method* (`GetUser(id)`) rather than manipulate a *resource* (`GET /users/id`). This topic is about when a typed binary contract over HTTP/2 beats human-readable REST/GraphQL, and where it falls down. Three concern areas: (1) **the contract and codegen** — Protocol Buffers (protobuf) as the IDL that defines services and messages, from which you *generate* client and server code in any language; (2) **the transport and call types** — HTTP/2 as the substrate, enabling not just unary (request/response) calls but **streaming** in three flavours (server, client, bidirectional); and (3) **the operational envelope** — deadlines/timeouts, gRPC status codes, protobuf schema evolution via field numbers, and the hard limitation that gRPC is a poor fit for public/browser-facing APIs (hence gRPC-web). The 15 questions run from "what is protobuf" to "design the streaming API" to "when do you pick gRPC over REST." The recurring senior theme: gRPC is *the* default for **internal service-to-service** communication in a polyglot microservices estate — fast, typed, codegen'd — but its binary framing and HTTP/2 requirements make it the wrong tool the moment a browser or an untrusted third-party developer is on the other end.

**Mental model**

Stop thinking "URLs and resources" and start thinking "typed function calls across the network." You define a *service* as a set of methods with typed request and response messages in a `.proto` file; the protobuf compiler generates a **client stub** that looks like a local object and a **server skeleton** you implement. Calling `client.GetUser(GetUserRequest{id: "alice"})` feels like a local method call but marshals a compact binary message over HTTP/2 to the server. Two things make this fast: **protobuf** serialises to a tight binary format (no field names on the wire, just field numbers) that's far smaller and faster to parse than JSON; and **HTTP/2** multiplexes many concurrent calls over one connection and enables streaming. The contract is the `.proto` file — it's the *single source of truth*, checked in and shared, and both sides generate from it, so a type mismatch is a compile error, not a 3am production surprise. The cost of all this typing and binary efficiency is that the wire format isn't human-readable, browsers can't speak raw gRPC, and you can't just `curl` an endpoint. That trade — *machine efficiency and type safety over human accessibility* — is the whole gRPC value proposition and its whole limitation.

**Key terms**

- **RPC** — remote procedure call; invoke a *method* on a remote service as if it were local, vs REST's resource manipulation.
- **Protocol Buffers (protobuf)** — the IDL + binary serialisation format; defines `service` and `message` types in a `.proto` file.
- **IDL** — Interface Definition Language; the language-neutral contract you generate code from.
- **Codegen / stub** — generated client (**stub**) and server code from the `.proto`; gives you typed calls in Go, Java, Python, etc.
- **HTTP/2** — the transport: multiplexed streams over one connection, binary framing, header compression — enables streaming.
- **Unary RPC** — one request → one response; the ordinary function-call shape.
- **Server streaming** — one request → a stream of responses (e.g. a live feed).
- **Client streaming** — a stream of requests → one response (e.g. upload chunks).
- **Bidirectional streaming** — both sides stream independently over one connection (e.g. chat).
- **Deadline / timeout** — a per-call time budget propagated across service hops; the call fails with `DEADLINE_EXCEEDED` when it elapses.
- **Field number** — the integer tag on each protobuf field; the real identity on the wire, central to schema evolution.
- **gRPC-web** — a proxy-mediated variant so browsers (which can't speak raw gRPC) can call gRPC services.

**Why interviewers ask this**

gRPC questions probe whether you understand *fit* — whether you reach for the right protocol for the situation instead of using REST for everything. The junior answer is "gRPC is faster than REST"; the senior answer explains *why* (binary protobuf + HTTP/2 multiplexing) *and* names the sharp constraint: it's for **internal** service-to-service traffic, not public or browser-facing APIs. The most revealing follow-ups: "why can't a browser call gRPC directly?" (tests HTTP/2 framing understanding and gRPC-web), "how do you evolve a protobuf message safely?" (field numbers and `reserved` — the same breaking-vs-non-breaking discipline as REST versioning), and "when would you *not* use gRPC?" (public APIs, browser clients, human debuggability, simple CRUD). A candidate who can place gRPC, REST, and GraphQL on a decision matrix — internal-typed-fast vs public-cacheable vs flexible-aggregation — is demonstrating exactly the architectural judgement the question exists to find.

**Common confusions**

- "gRPC is just REST but faster" — it's a different paradigm (method calls vs resources), a different wire format (binary vs JSON), and a different transport dependency (mandates HTTP/2).
- "Browsers can call gRPC" — they can't call *raw* gRPC (no access to HTTP/2 trailers/framing from JS); you need **gRPC-web** and a proxy.
- "Streaming is the same as WebSockets" — gRPC streaming is typed, multiplexed over HTTP/2, and comes in three directional flavours; it's a first-class part of the contract, not a bolt-on.
- "Protobuf field *names* matter on the wire" — they don't; **field numbers** are the identity. Rename freely, but never reuse or change a number.
- "You can freely delete protobuf fields" — deleting is fine, but you must **`reserved`** the old field number/name so it's never reused, or a future field silently inherits old data.
- "gRPC status is HTTP status" — gRPC has its own status code set (`OK`, `NOT_FOUND`, `DEADLINE_EXCEEDED`, `UNAVAILABLE`…) carried in trailers, distinct from HTTP status codes.
- "gRPC needs no schema management" — the `.proto` is a contract like any other; evolve it with the same additive/reserved discipline you'd use for a public API.

**What follows from this topic**

gRPC completes the REST/GraphQL/gRPC trio: you should now be able to defend a protocol choice per boundary — gRPC between internal microservices, REST or GraphQL at the edge for external and browser clients, with a gateway or BFF translating between them. Its deadline propagation is the reliability discipline from the Idempotency topic applied to synchronous RPC; its streaming call types are the typed cousin of GraphQL subscriptions and webhook push; and its protobuf field-number evolution rules are the exact breaking-vs-non-breaking logic that Versioning & Evolution covers for HTTP APIs. Master the three-way tradeoff and you can architect the API surface of a whole system, not just one endpoint.

### Q1. What is gRPC and how does it differ from REST?

gRPC is a high-performance RPC framework: you define *services* and *methods* in a Protocol Buffers `.proto` file, generate client and server code, and call remote methods as if they were local functions — over HTTP/2, with compact binary messages.

The core differences from REST:

| | REST | gRPC |
|---|---|---|
| Paradigm | Resources + HTTP verbs | Method calls (RPC) |
| Payload | JSON (text, human-readable) | Protobuf (binary, compact) |
| Contract | Optional (OpenAPI) | Mandatory `.proto` IDL |
| Transport | HTTP/1.1 or 2 | HTTP/2 required |
| Streaming | Awkward (SSE/WebSocket bolt-ons) | First-class (4 call types) |
| Browser | Native | Needs gRPC-web + proxy |
| Codegen | Optional | Built-in, multi-language |

The mental shift: REST says "`GET /v1/users/alice`" (manipulate a resource); gRPC says "`GetUser(GetUserRequest{id: 'alice'})`" (call a method). gRPC trades REST's human readability, `curl`-ability, and free HTTP caching for **type safety, speed, and streaming** — which is why it dominates *internal* service-to-service traffic and stays out of *public* APIs.

### Q2. What is Protocol Buffers and why use it over JSON?

Protocol Buffers (protobuf) is gRPC's IDL and binary serialisation format. You declare messages and services in a `.proto` file:

```protobuf
syntax = "proto3";
package example.v1;

message GetUserRequest { string id = 1; }
message User {
  string id = 1;
  string name = 2;
  string email = 3;
}
service UserService {
  rpc GetUser(GetUserRequest) returns (User);
}
```

Why protobuf over JSON:

- **Smaller and faster.** The wire format carries field *numbers* (`1`, `2`, `3`) and packed binary values — no repeated field-name strings, no text parsing. Payloads are typically a fraction of the JSON size and parse much faster.
- **Strongly typed contract.** The `.proto` is the single source of truth. Both sides generate code from it, so a type mismatch is a **compile error**, not a runtime surprise. JSON is stringly-typed and validated (if at all) at runtime.
- **Codegen in every language.** One `.proto` generates idiomatic Go, Java, Python, TypeScript, etc. — clients and servers stay in lockstep automatically.
- **Built-in evolution rules.** Field numbers give a disciplined, backward-compatible way to evolve the schema (Q9).

The cost: it's **not human-readable** — you can't eyeball it on the wire or `curl` it — and you need the `.proto` to decode a message. That's an acceptable trade internally, a dealbreaker for a public debuggable API.

### Q3. Why does gRPC use HTTP/2, and what does that buy you?

gRPC mandates **HTTP/2** because HTTP/2's features are exactly what a fast, streaming RPC system needs — features HTTP/1.1 lacks:

- **Multiplexing** — many concurrent RPC calls share **one TCP connection** as independent streams, with no head-of-line blocking at the HTTP layer. HTTP/1.1 needs a connection per in-flight request (or serialises them), so gRPC over one connection handles high call concurrency cheaply.
- **Bidirectional streaming** — HTTP/2 streams are full-duplex, which is what makes gRPC's server/client/bidi streaming (Q4) possible as a first-class feature rather than a hack.
- **Binary framing** — HTTP/2 is already a binary protocol with framed messages, a natural fit for protobuf's binary payloads.
- **Header compression (HPACK)** — repeated metadata (auth tokens, tracing headers) is compressed across requests, cutting overhead on chatty internal traffic.
- **Long-lived connections** — one persistent connection avoids repeated TCP+TLS handshakes, lowering per-call latency.

The flip side is the constraint that shapes gRPC's whole niche: because it leans on HTTP/2 framing and *trailers* (status is sent in HTTP/2 trailers after the body), it can't run over environments that only expose HTTP/1.1 semantics — including browser `fetch`/XHR, which don't give JavaScript access to trailers. That's precisely why browsers need **gRPC-web** and a translating proxy (Q7).

### Q4. Explain the four call types, especially streaming.

gRPC supports four call shapes, declared right in the `.proto` with the `stream` keyword:

```protobuf
service ChatService {
  rpc GetUser(GetUserRequest) returns (User);                        // unary
  rpc ListEvents(Query) returns (stream Event);                      // server streaming
  rpc UploadChunks(stream Chunk) returns (UploadResult);             // client streaming
  rpc Chat(stream Message) returns (stream Message);                 // bidirectional
}
```

- **Unary** — one request → one response. The ordinary function call; 95% of RPCs. `GetUser(id) → User`.
- **Server streaming** — one request → a *stream* of responses. The client asks once; the server pushes many messages until done. Great for live feeds, large result sets you want to page as they're ready, progress updates. `ListEvents(query) → Event, Event, Event…`
- **Client streaming** — a *stream* of requests → one response. The client pushes many messages, the server replies once at the end. Great for uploads, aggregation, telemetry ingestion. `UploadChunks(chunk, chunk…) → UploadResult`.
- **Bidirectional streaming** — both sides stream independently over the *same* HTTP/2 connection, in any interleaving. Great for chat, real-time collaboration, interactive protocols. `Chat(msg…) ↔ msg…`.

```text
Unary:   C --req--> S ; C <--resp-- S
Server:  C --req--> S ; C <--r1,r2,r3-- S
Client:  C --c1,c2,c3--> S ; C <--resp-- S
Bidi:    C <==msgs==> S   (both directions, concurrent)
```

Streaming is a genuine differentiator: it's typed, multiplexed over one connection, and part of the contract — not a bolt-on like SSE or a raw WebSocket. It's the gRPC answer to the same needs GraphQL subscriptions and webhooks address, but for internal typed traffic.

### Q5. How do deadlines and timeouts work in gRPC, and why do they matter?

Every gRPC call should carry a **deadline** — an absolute time by which the call must complete. The client sets it; gRPC propagates it across the wire, and if the deadline passes the call fails with `DEADLINE_EXCEEDED`.

```go
ctx, cancel := context.WithTimeout(context.Background(), 300*time.Millisecond)
defer cancel()
resp, err := client.GetUser(ctx, &pb.GetUserRequest{Id: "alice"})
```

What makes gRPC deadlines special — and interview-worthy — is **propagation across hops**. If service A calls B with a 300ms deadline and B calls C, the *remaining* budget travels with the call. C knows it has, say, 180ms left, not a fresh 300ms. This prevents the classic distributed failure where a slow leaf service holds work for every caller up the chain long after the top-level client has already given up.

Why it matters:

- **Resource protection** — without deadlines, a hung downstream call ties up a thread/goroutine and connection indefinitely; enough of them and the service exhausts its capacity (cascading failure).
- **Fail fast** — better to return `DEADLINE_EXCEEDED` at 300ms and let the caller retry/degrade than to hang for 30 seconds.
- **Honest budgets** — deadline propagation makes the whole call tree respect one time budget.

Best practice: always set a deadline (never call without one), size it to the operation, and on the server *check* whether the deadline is already blown before doing expensive work. It's the synchronous-RPC counterpart to the retry/backoff reliability discipline elsewhere in this primer.

### Q6. What are gRPC status codes and how do they differ from HTTP status codes?

gRPC has its **own** set of status codes, carried in the HTTP/2 *trailers* (not the HTTP status line). Every call returns one — `OK` on success, or an error code plus a message. They're distinct from HTTP status codes, though they map roughly.

Common ones:

| gRPC code | Meaning | Rough HTTP analogue |
|---|---|---|
| `OK` | Success | 200 |
| `INVALID_ARGUMENT` | Bad request data | 400 |
| `UNAUTHENTICATED` | No/invalid credentials | 401 |
| `PERMISSION_DENIED` | Authenticated but not allowed | 403 |
| `NOT_FOUND` | Resource missing | 404 |
| `ALREADY_EXISTS` | Duplicate | 409 |
| `RESOURCE_EXHAUSTED` | Quota/rate limit | 429 |
| `FAILED_PRECONDITION` | State not valid for op | 412/422 |
| `DEADLINE_EXCEEDED` | Call ran past its deadline | 504 |
| `UNAVAILABLE` | Service down/unreachable (retryable) | 503 |
| `INTERNAL` | Server bug | 500 |

The important distinctions from HTTP: (1) gRPC codes are a *fixed, smaller* enumerated set designed for RPC semantics, so there's less ambiguity than HTTP's sprawling status list; (2) `UNAVAILABLE` and `DEADLINE_EXCEEDED` are explicitly **retryable** signals, which client middleware uses to drive automatic retry with backoff; and (3) the status rides in **trailers** after the (possibly streamed) response body — one of the reasons browsers can't consume raw gRPC. When mapping gRPC to REST at a gateway, you translate these codes to HTTP statuses.

### Q7. Why is gRPC a poor fit for public and browser-facing APIs?

Two hard reasons, plus a soft one.

**1. Browsers can't speak raw gRPC.** gRPC depends on low-level HTTP/2 framing and puts the call status in HTTP/2 **trailers**. Browser JavaScript (`fetch`/XHR) gives you no access to trailers or to the raw framing, so a browser physically cannot make a standard gRPC call. The workaround is **gRPC-web**: a slightly different protocol plus a proxy (Envoy or similar) that translates between the browser and the real gRPC backend.

```text
Browser --(gRPC-web over HTTP/1.1/2)--> Envoy proxy --(native gRPC)--> Service
```

**2. It's not human-debuggable or `curl`-able.** Binary protobuf can't be eyeballed on the wire or hand-crafted in a terminal; a third-party developer can't just `curl` your endpoint and read JSON. For a *public* API where you don't control the clients and DX/discoverability matter, that's a serious adoption barrier.

**3. Ecosystem friction for outside consumers.** Public API consumers expect REST/JSON (or GraphQL), OpenAPI docs, browser tooling, and caching. gRPC needs shared `.proto` files, codegen toolchains, and HTTP/2-capable infrastructure end to end (many proxies/CDNs handle it imperfectly).

So the rule of thumb: gRPC **inside** the perimeter (service-to-service), REST/GraphQL **at the edge** (public + browser). A common pattern is a gateway/BFF that exposes REST or GraphQL to the outside and translates to gRPC internally.

### Q8. When should you pick gRPC over REST or GraphQL?

Pick gRPC when the boundary is **internal, performance-sensitive, and typed**, and there's no browser or untrusted third party on the other side.

**gRPC wins when:**
- **Internal service-to-service** communication in a microservices estate — the canonical use case.
- **Polyglot services** — one `.proto` generates typed clients/servers in Go, Java, Python, Rust, etc., keeping them in lockstep.
- **High throughput / low latency** matters — binary protobuf + HTTP/2 multiplexing beats JSON/HTTP1.
- **Streaming** is needed — server/client/bidi streaming is first-class.
- **Strong contracts** are valued — you want compile-time breakage on mismatches, not runtime surprises.

**Prefer REST when:**
- The API is **public** or **browser-facing**, needs to be `curl`-able, cache-friendly, and consumed by developers you don't control.
- Simple CRUD over resources; HTTP semantics (caching, conditional requests) are useful.

**Prefer GraphQL when:**
- **Client-driven flexible reads / aggregation** across many sources for diverse frontends (web/mobile), where clients pick their own field shapes.

The senior soundbite: **gRPC for east-west (internal) traffic, REST/GraphQL for north-south (edge) traffic.** Many real systems use all three, with a gateway translating the public REST/GraphQL surface down to internal gRPC calls.

### Q9. How do you evolve a protobuf schema without breaking existing clients?

The golden rule: **field numbers are the identity on the wire — never change or reuse them.** Field *names* are cosmetic (you can rename freely); the integer tags are what encode/decode against. Get this right and protobuf gives you clean backward/forward compatibility.

**Safe (non-breaking) changes:**
- **Add a new field** with a *new* number. Old clients ignore unknown fields; new fields on old messages read as defaults.
- **Rename a field** (the number is unchanged, so the wire format is identical).
- **Delete a field** — *but you must reserve its number* (see below).

**Breaking changes to avoid:**
- **Changing a field's number** — reassigns the data.
- **Changing a field's type** in an incompatible way.
- **Reusing a deleted field's number** for a new field — old messages carrying the old data would be misread as the new field. This is the classic subtle bug.

When you remove a field, **`reserved`** its number (and name) so nobody can reuse it:

```protobuf
message User {
  reserved 3;              // old 'email' field number, retired forever
  reserved "email";
  string id = 1;
  string name = 2;
  string primary_email = 4; // new field, NEW number
}
```

This is the exact **breaking-vs-non-breaking / additive-evolution** discipline the Versioning topic covers for REST — protobuf just enforces it structurally through field numbers and `reserved`, and (like GraphQL) generally avoids explicit versioning in favour of evolving the one schema. Put the version in the package (`example.v1`) for genuinely incompatible redesigns.

### Q10. Give a direct comparison of gRPC vs REST vs GraphQL.

| Dimension | REST | GraphQL | gRPC |
|---|---|---|---|
| Style | Resources + HTTP verbs | Query a typed graph | Method calls (RPC) |
| Payload | JSON (text) | JSON (text) | Protobuf (binary) |
| Transport | HTTP/1.1 or 2 | HTTP (single `POST`) | HTTP/2 (required) |
| Contract | Optional (OpenAPI) | Mandatory schema | Mandatory `.proto` |
| Typing | Weak (runtime) | Strong (schema) | Strong (compile-time) |
| Streaming | Bolt-on (SSE/WS) | Subscriptions (WS) | First-class (4 types) |
| Browser | Native | Native | Needs gRPC-web + proxy |
| Caching | Free (HTTP/URLs) | Hard | N/A (not the point) |
| Performance | Good | Good | Best (binary + HTTP/2) |
| Human-readable | Yes (`curl`-able) | Yes | No (binary) |
| Best fit | Public APIs, CRUD | Flexible clients, aggregation | Internal service-to-service |

The one-paragraph synthesis: **REST** optimises for HTTP-native simplicity, caching, and ubiquity — the default public API. **GraphQL** optimises for client flexibility and aggregation — great for diverse frontends over a graph of data. **gRPC** optimises for typed, streaming, low-latency internal RPC — the default *inside* a microservices system. They're not competitors so much as tools for different boundaries; a mature architecture typically runs gRPC internally and exposes REST or GraphQL at the edge via a gateway.

### Q11. What does an RPC-style API look like, and how does it differ from resource-style?

**RPC style** models the API as **actions/methods**: you name a verb and call it. **Resource (REST) style** models the API as **nouns** you manipulate with a fixed set of HTTP verbs.

RPC (gRPC):

```protobuf
service AccountService {
  rpc TransferFunds(TransferRequest) returns (TransferResult);
  rpc FreezeAccount(FreezeRequest) returns (Account);
  rpc GetBalance(BalanceRequest) returns (Balance);
}
```

The equivalent REST would strain to express these as resources:

```http
POST /v1/transfers            # a "transfer" resource, created
POST /v1/accounts/123/freeze  # RPC-ish verb leaking into a REST URL
GET  /v1/accounts/123/balance
```

The key differences:

- **Verbs vs nouns.** RPC says `TransferFunds(...)`; REST prefers "create a `transfer` resource." Actions that aren't naturally CRUD (`freeze`, `retry`, `send`) are *awkward* in pure REST and *natural* in RPC.
- **Method-centric contract.** RPC's surface is a list of methods; REST's is a set of resources + standard verbs. RPC is more expressive for behaviour; REST is more uniform and cache-friendly.
- **Discoverability.** REST leans on HTTP conventions and (at L3) HATEOAS; RPC leans on the shared IDL and generated stubs.

The practical takeaway: when your domain is fundamentally about *operations* between services (payments, orchestration, commands), RPC/gRPC fits cleanly; when it's about *entities* clients read and mutate, REST fits. GraphQL sits closer to resource-style for reads but with client-defined shapes.

### Q12. Design the API for a real-time telemetry ingestion service. Which gRPC call type and why?

Requirement: thousands of devices push a continuous stream of metric samples; the server ingests them and periodically (or at end) acknowledges. This is the textbook case for **client streaming** — many messages in, one response out.

```protobuf
message Sample {
  string device_id = 1;
  int64 timestamp_ms = 2;
  double value = 3;
}
message IngestSummary {
  int64 accepted = 1;
  int64 rejected = 2;
}
service Telemetry {
  rpc Ingest(stream Sample) returns (IngestSummary);
}
```

The device opens one `Ingest` call and streams `Sample` messages over the single HTTP/2 stream; the server processes them as they arrive and returns one `IngestSummary` when the stream closes.

Why client streaming beats the alternatives here:

- **Vs unary-per-sample:** one RPC per sample means a request/response round trip and framing overhead for every data point — enormous overhead at high frequency. Streaming amortises the connection over the whole session.
- **Vs bidirectional:** you don't need per-sample server-to-client messages; a single terminal summary suffices, so client streaming is simpler.
- **Vs REST:** you'd be POSTing batches over HTTP/1.1 with connection churn; gRPC keeps one HTTP/2 stream open with tiny binary frames.

Refinements worth mentioning: set a **deadline** on the call so a stuck device stream doesn't hold resources forever; make ingestion **idempotent** on `(device_id, timestamp)` so a reconnect-and-replay after a dropped stream doesn't double-count (the reliability discipline from the Idempotency topic); and if you *also* want the server to push back (e.g. "slow down / drop these"), upgrade to **bidirectional** streaming.

### Q13. How does authentication work in gRPC?

gRPC authentication operates at two layers.

**1. Channel-level (transport) — TLS / mTLS.** gRPC runs over TLS by default. For internal service-to-service, **mutual TLS (mTLS)** is common: both client and server present certificates, so each verifies the other's identity cryptographically. This is often the *whole* auth story inside a service mesh — the mesh (e.g. via sidecars) handles mTLS transparently, and services trust the verified peer identity.

**2. Call-level (credentials) — metadata tokens.** For per-call user/app identity, you attach credentials as gRPC **metadata** (the HTTP/2 header equivalent), typically a bearer token:

```text
metadata: { "authorization": "Bearer <jwt>" }
```

Server-side interceptors (gRPC's middleware) validate the token, resolve the caller, and enforce authorization before the method runs — the same role interceptors play that middleware plays in REST or context does in GraphQL.

```go
func authInterceptor(ctx, req, info, handler) {
    md, _ := metadata.FromIncomingContext(ctx)
    if !validToken(md["authorization"]) { return status.Error(codes.Unauthenticated, "bad token") }
    return handler(ctx, req)
}
```

Key points to hit: **mTLS for service identity** (who is the calling *service*), **token metadata for user/app identity** (who is the calling *user*), **interceptors as the enforcement choke point**, and returning the proper gRPC status (`UNAUTHENTICATED` vs `PERMISSION_DENIED`) rather than a generic error. This mirrors REST's TLS + `Authorization: Bearer` model, just with gRPC's metadata/interceptor mechanics.

### Q14. Spot the problem: a team exposes their gRPC service directly to a web frontend and it doesn't work. What's wrong and how do you fix it?

The problem is fundamental, not a config bug: **browsers can't call raw gRPC.** gRPC relies on HTTP/2 framing and puts its status in HTTP/2 **trailers**, and browser JavaScript (`fetch`/XHR) exposes neither the raw framing nor trailers. So a standard gRPC client simply can't run in the page — the calls fail regardless of CORS or TLS tweaks.

The fix is **gRPC-web** plus a translating proxy:

```text
Browser  --(gRPC-web)-->  Envoy / gRPC-web proxy  --(native gRPC)-->  Service
```

1. Generate a **gRPC-web** client stub for the frontend (a browser-compatible variant of the protocol).
2. Put a proxy that speaks gRPC-web (Envoy with the gRPC-web filter, or a framework equivalent) in front of the service; it translates gRPC-web requests into native gRPC and translates responses/trailers back.
3. Note the limitation: gRPC-web has **restricted streaming** — server streaming works, but client and bidirectional streaming are limited or unsupported depending on the transport.

The better architectural fix, if the frontend needs a rich API anyway, is to **not expose gRPC to the edge at all**: put a **gateway or BFF** that presents REST or GraphQL to the browser and calls the gRPC services internally. That keeps gRPC where it belongs (east-west, internal) and gives the browser the JSON/HTTP surface it expects — the same north-south vs east-west split from Q8.

### Q15. Design a `.proto` for a user service with a unary lookup and a server-streaming search. Walk through the choices.

```protobuf
syntax = "proto3";
package example.user.v1;

message GetUserRequest { string id = 1; }

message User {
  string id = 1;
  string name = 2;
  string email = 3;
  int64 created_at_ms = 4;
}

message SearchRequest {
  string query = 1;
  int32 page_size = 2;
}

service UserService {
  rpc GetUser(GetUserRequest) returns (User);
  rpc SearchUsers(SearchRequest) returns (stream User);
}
```

Design choices worth explaining:

- **Versioned package** (`example.user.v1`) — genuinely incompatible future redesigns become `v2` while `v1` keeps serving; day-to-day evolution stays additive within `v1`.
- **Request wrapper messages** (`GetUserRequest` rather than a bare `string`) — even for a single argument, wrapping means you can **add fields later without breaking the signature** (e.g. add `bool include_deleted = 2;`). This is a standard protobuf discipline.
- **Deliberate field numbers** — `1,2,3,4`, never to be reused; a removed field would be `reserved` (Q9).
- **Unary for `GetUser`** — a single lookup is one request → one response; no need for streaming.
- **Server streaming for `SearchUsers`** — a search may match many users; streaming lets the server push results as they're found rather than buffering the whole set, and the client can start rendering immediately. If the result set were small and bounded, a unary call returning `repeated User` would be simpler — the choice depends on cardinality and whether you want incremental delivery.

Follow-ups you should anticipate: adding a **deadline** on the client call, mapping errors to gRPC **status codes** (`NOT_FOUND` when the id doesn't exist), and how you'd expose this to a browser (gRPC-web/gateway, Q14).
## Async & Event-Driven APIs

### Summary

**What this topic covers**

Everything that happens when the request/response model stops fitting. Most API design starts with synchronous HTTP: client calls, blocks, gets an answer. But a huge slice of real systems are **asynchronous** — the work takes seconds or minutes (video encoding, credit checks, batch imports), or the *server* needs to tell the *client* about something that happened later (a payment settled, an order shipped). This topic covers the async toolbox: **webhooks** (server→client HTTP callbacks), **polling**, **push** channels (SSE, WebSockets), the **async request-reply** pattern, **message queues and pub/sub** treated as an API surface, **long-running operations** modelled with `202 Accepted` + a status resource, **AsyncAPI** for documenting event-driven contracts, **event schema design** (thin/ID-only vs fat events), and the hard parts: **ordering and delivery guarantees**. The 16 questions here range from "when should an API be async at all" to "design a webhook delivery system that survives a flaky consumer." The unifying skill is knowing that async trades immediate certainty for scalability and decoupling — and being able to name exactly what you gave up.

**Mental model**

Draw a 2×2. One axis: who initiates — client-pull vs server-push. The other: sync (answer inline) vs async (answer later). Synchronous request-reply is client-pull + sync. **Polling** is client-pull + async (client keeps asking "done yet?"). **Webhooks/SSE/WebSockets** are server-push. Once you leave the top-left cell you inherit distributed-systems realities you didn't have before: the network between producer and consumer can drop, reorder, or duplicate messages, and the consumer can be down when the event fires. So every async design answers three questions: (1) **How does the receiver find out?** (push vs pull). (2) **What happens if delivery fails?** (retries, backoff, dead-letter, replay). (3) **What are the guarantees?** (at-least-once is the practical default; exactly-once is a dedup illusion built on idempotency). If you can't answer all three, you haven't designed the API — you've drawn a happy path. Async is not "REST but faster"; it's a different contract where the message *is* the interface.

**Key terms**

- **Webhook** — server→client HTTP POST callback; the client registers a URL, the server calls it when an event occurs. "Reverse API."
- **Polling** — client repeatedly requests status; simple, wasteful, latency-bounded by poll interval.
- **Long polling** — client request that the server holds open until data is ready or a timeout hits; cheaper than tight polling.
- **SSE (Server-Sent Events)** — one-way server→client stream over a single long-lived HTTP response (`text/event-stream`).
- **WebSocket** — full-duplex persistent TCP connection after an HTTP upgrade; both sides send anytime.
- **Async request-reply** — client submits work, gets an ID/`202`, and collects the result later via callback or status resource.
- **Message queue** — point-to-point buffer; one consumer processes each message (work distribution).
- **Pub/sub** — one event fans out to many independent subscribers (broadcast/decoupling).
- **AsyncAPI** — the OpenAPI-equivalent spec for documenting event-driven APIs (channels, messages, schemas).
- **Thin (ID-only) event** vs **fat event** — notification carrying just an ID + type vs one carrying the full changed payload.
- **Delivery guarantee** — at-most-once / at-least-once / exactly-once; the contract for duplicates and drops.
- **Dead-letter queue (DLQ)** — where messages go after exhausting retries, for later inspection/replay.

**Why interviewers ask this**

Async separates people who've only built CRUD from people who've operated systems under load. A junior reaches for synchronous calls everywhere and blocks a request thread on a 40-second job; a senior recognises the long-running-operation shape and returns `202` with a status URL. The webhook question is a favourite because it forces you to reason about *the consumer's* failure modes, not just your own — signature verification, retries with backoff, idempotent handlers, ordering-not-guaranteed. Interviewers also probe delivery guarantees to see if you'll naively promise "exactly once" (a red flag) or correctly explain that you get at-least-once + idempotent consumers and *call that* exactly-once processing. Strong signal: you volunteer the tradeoff you're accepting (eventual consistency, out-of-order arrival) before being asked.

**Common confusions**

- "Webhooks and WebSockets are the same" — no. Webhooks are stateless one-off HTTP POSTs to a registered URL; WebSockets are a persistent bidirectional connection. Different lifetimes, different failure modes.
- "Async means faster" — async usually means *higher latency to a final answer* but better throughput, decoupling, and resilience. You trade immediacy for scale.
- "The queue guarantees exactly-once" — practically no. Design for at-least-once and make consumers idempotent; "exactly-once" is dedup on top of at-least-once.
- "Events arrive in order" — not across partitions/consumers unless you specifically design for it (ordering keys, single partition). Assume reordering.
- "A fat event saves the consumer a call, so always send fat events" — fat events leak your model, bloat the bus, and go stale; thin events force a fetch but stay authoritative. It's a real tradeoff, not a default.
- "SSE and WebSockets are interchangeable" — SSE is one-way and rides plain HTTP (proxies/CDNs friendly, auto-reconnect built in); WebSockets are two-way but heavier and need upgrade support.

**What follows from this topic**

Async design leans hard on ideas from elsewhere in this primer. Webhook reliability is [idempotency] with a different hat on — the consumer needs idempotency keys and dedup exactly like a POST endpoint. Documenting these contracts is where **AsyncAPI** meets OpenAPI in the Documentation & Contracts topic. And the moment you put a gateway or broker between producer and consumer, you're in API Gateways & Management territory — rate limiting webhook deliveries, transforming payloads, and offloading auth. Async is also where API design touches the System Design primers (queues, brokers, partitioning); here we stay on the *contract* — event shape, delivery semantics, the developer's mental model — not the broker internals.

### Q1. When should an API be asynchronous instead of synchronous?

Go async when **any** of these is true:

- **The work is slow.** If completing the request takes longer than a client (or a load balancer, or a mobile radio) will happily wait — roughly anything over a few seconds — blocking a connection is wasteful and fragile. Video transcoding, PDF generation, KYC checks, bulk imports.
- **The work is unreliable or external.** Calling a third party that might be down, or doing something that must survive a crash mid-way. A queue lets you retry without the caller re-submitting.
- **You need decoupling.** Many independent consumers care about "order placed" (email, analytics, inventory, fraud). Sync coupling makes the order endpoint's latency the sum of all of them; pub/sub lets each react on its own clock.
- **You need to smooth load.** A queue absorbs spikes so downstream can process at a steady rate instead of falling over.

Stay **synchronous** when the client genuinely needs the answer to proceed (reading data to render a screen, validating a login), when the operation is fast and cheap, or when the added complexity (status endpoints, callbacks, dedup) isn't worth it. Rule of thumb: sync for **queries and fast commands**, async for **slow, unreliable, or fan-out commands**. And don't go async *just* for perceived speed — you're adding eventual consistency and a whole new set of failure modes.

### Q2. What is a webhook, and how does it differ from polling?

A **webhook** is a server→client HTTP callback. The client registers a URL once; when an event happens, *your* server makes a `POST` to that URL. It's push-based — the consumer finds out immediately with zero wasted requests.

**Polling** inverts that: the client repeatedly asks "anything new?" on an interval.

```http
GET /v1/jobs/job_123 HTTP/1.1
Host: api.example.com

HTTP/1.1 200 OK
{ "id": "job_123", "status": "processing" }
```

| | Webhook (push) | Polling (pull) |
|---|---|---|
| Latency | Near-instant | Bounded by poll interval |
| Wasted requests | ~None | Many (most return "nothing new") |
| Who needs infra | Consumer needs a public HTTPS endpoint | Neither — just call the API |
| Failure handling | Sender must retry; consumer may be down | Client just retries next tick |
| Firewall/local dev | Hard (needs public URL, tunnels) | Trivial |
| Ordering | Not guaranteed | Client controls |

Use **webhooks** for real-time, event-driven integrations at scale (Stripe, GitHub). Use **polling** when the consumer can't expose a public endpoint, when events are rare, or for simple internal tooling. Many mature platforms offer **both** and let the integrator choose. A common hybrid: a thin webhook fires ("something changed on order_123"), and the consumer polls the REST API to fetch the authoritative current state.

### Q3. Design a webhook delivery system. What does a reliable webhook need?

A production webhook system has to assume the consumer's endpoint is flaky. The must-haves:

**Delivery + retries with backoff.** POST the event; if you don't get a `2xx` within a timeout, retry with **exponential backoff + jitter** (e.g. 1s, 10s, 1m, 10m, 1h up to ~24h). Cap attempts, then send to a **dead-letter** store the integrator can inspect and replay.

**Signature verification.** Sign the raw body with an HMAC using a per-endpoint secret so the consumer can verify authenticity and integrity (see Q7).

**Idempotency / dedup.** Because you retry, the same event *will* be delivered more than once. Include a stable `id` so consumers can dedup. Delivery is at-least-once, never assume once.

**Ordering caveat.** Don't promise ordered delivery — retries and parallelism reorder events. Put a monotonic `sequence` or `created_at` in the payload so consumers can reason about staleness.

**Timeouts + fast ack.** Require the consumer to respond quickly (e.g. within 5s) and process asynchronously on their side; a slow handler shouldn't tie up your delivery workers.

```text
event occurs → enqueue delivery → worker POSTs to consumer URL
                                     │
                       2xx? ── yes ─→ mark delivered
                        │
                        no → schedule retry (backoff+jitter)
                                     │
                    attempts exhausted → dead-letter (manual replay)
```

Round it out with a **dashboard** (delivery logs, response codes), **manual replay**, endpoint **health disabling** (auto-pause an endpoint that's been failing for hours), and a way to **test** deliveries (send a ping event). The whole design is "at-least-once delivery to an unreliable consumer" — everything follows from that.

### Q4. Polling vs SSE vs WebSockets vs webhooks — how do you choose a real-time mechanism?

Four different answers to "how does the client learn about server-side changes":

| Mechanism | Direction | Connection | Best for |
|---|---|---|---|
| Polling | Client pull | New request each time | Rare events, no public endpoint, simplicity |
| Long polling | Client pull (held) | Held open until data/timeout | Near-real-time without WS support |
| SSE | Server → client | One long-lived HTTP response | Live feeds, notifications, streaming tokens |
| WebSocket | Bidirectional | Persistent duplex socket | Chat, collaboration, games, live trading |
| Webhook | Server → client (server-to-server) | One-off HTTP POST | Backend integrations, no browser |

Decision guide:

- **Server-to-server, event-driven** → **webhooks**. The consumer is a backend that can host a URL.
- **Browser needs a live stream, one-way** (notifications, live scores, LLM token streaming) → **SSE**. It's plain HTTP, auto-reconnects, works through most proxies, and is far simpler than WebSockets.
- **Browser needs low-latency two-way** (chat, multiplayer, collaborative editing) → **WebSockets**.
- **Anything simple, or the client can't hold connections / expose endpoints** → **polling**. Never underestimate how far a 30-second poll gets you.

The senior move is to *not* default to WebSockets. They're operationally heavier (stateful connections, scaling, reconnection logic). If the data flows one way, SSE or webhooks are usually the right, cheaper answer.

### Q5. What is the async request-reply pattern, and how do you model a long-running operation over HTTP?

When a command takes too long to answer inline, don't hold the connection — acknowledge the work and hand back a way to track it. That's **async request-reply**, and over HTTP the idiom is `202 Accepted` + a **status resource**.

```http
POST /v1/reports HTTP/1.1
Content-Type: application/json

{ "type": "annual", "year": 2025 }

HTTP/1.1 202 Accepted
Location: /v1/reports/rep_789
{ "id": "rep_789", "status": "pending" }
```

The client then **polls the status resource** (or gets a webhook when it's done):

```http
GET /v1/reports/rep_789 HTTP/1.1

HTTP/1.1 200 OK
{
  "id": "rep_789",
  "status": "completed",
  "result_url": "/v1/reports/rep_789/download"
}
```

Key design points: return `202` (not `200` — the work isn't done), put the tracking URL in `Location`, expose a real resource with a `status` field (`pending` → `processing` → `completed`/`failed`), and give completed operations a link to the actual result. Offer a webhook so clients don't *have* to poll. Include a `Retry-After` hint on the status endpoint to guide poll frequency. This pattern turns a fragile 60-second blocking call into a robust, resumable, crash-tolerant flow — and it composes with everything else (the status resource is just REST).

### Q6. How do message queues and pub/sub differ, and when is each the right API model?

Both decouple producers from consumers via a broker, but the delivery semantics differ:

**Message queue (point-to-point):** each message is consumed by **exactly one** worker. Used for **work distribution** — spread tasks across a pool. Think "process this payment," "resize this image." Competing consumers pull from the same queue; scaling out means adding workers.

**Pub/sub (publish-subscribe):** each event is delivered to **every** subscriber independently. Used for **broadcast/decoupling** — one "OrderPlaced" event fans out to email, analytics, inventory, and fraud, each with its own subscription. Adding a new consumer doesn't touch the producer.

```text
QUEUE (1 message → 1 of N workers):
producer → [ msg msg msg ] → worker A
                           → worker B   (each msg to ONE worker)

PUB/SUB (1 event → all subscribers):
publisher → topic → sub: email
                  → sub: analytics   (each event to EVERY sub)
                  → sub: inventory
```

Choose a **queue** when work must be done once and you're load-balancing. Choose **pub/sub** when multiple independent systems react to the same fact and you want them decoupled from the producer. Many brokers do both (Kafka consumer groups = queue semantics within a group, pub/sub across groups). From an *API* perspective, the event schema and the topic/channel names *are* your public contract — version and document them as carefully as any REST endpoint.

### Q7. How do you secure a webhook so the consumer can trust it? (Signature verification)

The consumer's webhook URL is public, so anyone can POST fake events to it. Fix that with an **HMAC signature** over the raw request body using a shared secret.

Sender computes and sends:

```http
POST /webhooks/example HTTP/1.1
X-Webhook-Signature: t=1720000000,v1=5257a869e7ec...
X-Webhook-Id: evt_abc123
Content-Type: application/json

{"type":"payment.succeeded","data":{"id":"pay_1"}}
```

Consumer verifies:

1. Read the raw body **before** JSON parsing (re-serializing changes bytes and breaks the signature).
2. Compute `HMAC-SHA256(secret, timestamp + "." + body)`.
3. **Constant-time compare** against the `v1` value.
4. Check the **timestamp** is recent (e.g. within 5 minutes) to block replay attacks.
5. Dedup on `X-Webhook-Id` because delivery is at-least-once.

```text
if hmac(secret, ts + "." + rawBody) != sig  → 401, drop
if now - ts > 5min                          → 401, drop (replay)
if seen(webhook_id)                         → 200, ignore (dup)
else process, record webhook_id
```

Why HMAC and not just a static bearer token in a header? The signature also guarantees **integrity** (the body wasn't tampered with) and, with the timestamp, **replay protection**. Never put the secret in the URL, always use HTTPS, and rotate secrets by supporting two valid secrets during rollover. This is the same idempotency + dedup discipline as any POST endpoint, applied on the receiving side.

### Q8. What guarantees can you make about message delivery and ordering?

Three delivery guarantees, in increasing difficulty and cost:

- **At-most-once** — fire and forget; messages may be lost, never duplicated. Fine for metrics/telemetry where a dropped sample doesn't matter.
- **At-least-once** — retried until acknowledged; never lost, but **may duplicate**. The pragmatic default for anything important.
- **Exactly-once** — no loss, no duplicates. Genuinely hard end-to-end; usually a *marketing* term for "at-least-once delivery + idempotent processing + dedup."

The senior answer: **design for at-least-once and make consumers idempotent.** Attach a stable message ID; the consumer records processed IDs and ignores repeats. That gives you *effectively* exactly-once *processing* without pretending the network is reliable.

**Ordering** is separate and equally slippery. Across parallel consumers or partitions, messages arrive out of order. If you need order, you pay for it: route related messages to the **same partition via an ordering key** (e.g. all events for `order_123` on one partition), accept reduced parallelism, and even then only get per-key ordering, not global. Better still, make handlers **order-independent** — carry a version/sequence number and let the consumer discard stale updates.

The interview trap is confidently promising "exactly once, in order." Don't. State the guarantee you actually provide (at-least-once, per-key ordering) and how the consumer compensates (idempotency, sequence numbers).

### Q9. What is AsyncAPI and why can't you just use OpenAPI for event-driven APIs?

**AsyncAPI** is the OpenAPI-equivalent specification for **event-driven and message-based** APIs. OpenAPI describes request/response HTTP: paths, methods, status codes. That vocabulary doesn't fit a system where you *publish* and *subscribe* to messages on channels — there's no "GET /path returning 200." AsyncAPI models the right concepts: **channels** (topics/queues), **operations** (publish/subscribe), **messages** with payload **schemas**, and the **server/protocol** bindings (Kafka, AMQP, MQTT, WebSocket).

```yaml
asyncapi: 3.0.0
info:
  title: Orders Events
  version: 1.0.0
channels:
  orderPlaced:
    address: orders.placed
    messages:
      OrderPlaced:
        payload:
          type: object
          properties:
            id: { type: string }
            amount: { type: integer }
operations:
  onOrderPlaced:
    action: receive
    channel:
      $ref: '#/channels/orderPlaced'
```

Why it matters: it makes your **event schema a documented, machine-readable contract** — the same benefits OpenAPI brings to REST. You can generate docs, validate payloads, do contract testing between producer and consumer, and scaffold consumer code. Without it, event schemas live in tribal knowledge and a wiki page, and producers silently break consumers by changing a field. If your organisation ships events as a product, AsyncAPI is how you keep that product honest. It deliberately mirrors OpenAPI's structure so teams can reuse the same schema components and tooling mindset.

### Q10. How should you design event payloads — thin (ID-only) or fat events?

Two schools, and it's a genuine tradeoff:

**Thin / ID-only event** — carry just enough to say *what changed*:

```json
{ "type": "order.updated", "id": "evt_1", "order_id": "order_123", "occurred_at": "2026-07-01T10:00:00Z" }
```

The consumer then calls the API to fetch current state. **Pros:** small, doesn't leak your internal model, always fetches authoritative/fresh data, no stale payloads. **Cons:** every event triggers a callback (chattier), and there's a race — by the time the consumer fetches, the resource may have changed again.

**Fat event** — carry the full (or full changed) state:

```json
{ "type": "order.updated", "id": "evt_1",
  "data": { "order_id": "order_123", "status": "shipped", "total": 4200, "items": [ ... ] } }
```

**Pros:** consumer needs no follow-up call (great for decoupling and offline consumers), and the event is a self-contained record you can replay. **Cons:** couples consumers to your schema, bloats the bus, and the payload can be **stale** by the time it's processed.

Guidance: default to **thin events + a fetch** when consumers need guaranteed-fresh data and you want loose coupling to your model. Prefer **fat events** when consumers are external, you want to minimise round-trips, or you're doing event-sourcing/audit where the event *is* the record. A common middle ground is a **fat event carrying the changed fields plus a version**, so consumers can act directly but detect staleness. Whatever you pick, version the schema and document it (AsyncAPI).

### Q11. A client submits a job and needs the result. Show the full async API design.

Model it as a resource with a lifecycle, offer both polling and a webhook, and never block.

**1. Submit — return `202` + a status URL:**

```http
POST /v1/imports HTTP/1.1
Idempotency-Key: imp-req-9f2
Content-Type: application/json

{ "source_url": "https://files.example.com/data.csv", "callback_url": "https://acme.com/hooks" }

HTTP/1.1 202 Accepted
Location: /v1/imports/imp_555
Retry-After: 5
{ "id": "imp_555", "status": "pending" }
```

**2. Poll the status resource (or wait for the webhook):**

```http
GET /v1/imports/imp_555 HTTP/1.1

HTTP/1.1 200 OK
{ "id": "imp_555", "status": "processing", "progress": 0.6 }
```

**3. On completion, POST a webhook and expose the result:**

```json
{ "type": "import.completed", "id": "evt_88",
  "data": { "import_id": "imp_555", "status": "completed", "rows": 10000, "result_url": "/v1/imports/imp_555/result" } }
```

Design notes: the submit is **idempotent** (an `Idempotency-Key` prevents a retried submit from creating two jobs). `status` moves `pending → processing → completed | failed`, with a machine-readable error on failure. `Retry-After` guides polling. The `callback_url` makes webhooks opt-in per request. Failed imports still return `200` on the status resource with `status: "failed"` and an error object — the *fetch* succeeded, the *job* didn't. This one shape (`202` + status resource + optional webhook + idempotent submit) covers the vast majority of long-running-operation APIs.

### Q12. How do you handle failures and retries on the consumer side of an event system?

The consumer owns three responsibilities: **ack correctly, retry safely, and quarantine poison messages.**

**Acknowledge only after successful processing.** If you ack on receipt and then crash, the message is lost. Ack *after* the work commits so an unacked message is redelivered.

**Make processing idempotent.** Because delivery is at-least-once, you *will* see duplicates. Record processed message IDs (or design the operation to be naturally idempotent — upserts, set-to-value) so reprocessing is harmless.

**Retry with backoff, then dead-letter.** Transient failures (downstream timeout) should retry with exponential backoff + jitter. But a **poison message** (malformed, or one that always throws) will retry forever and block the queue. After N attempts, move it to a **dead-letter queue** for inspection and manual replay.

```text
receive → process
   ├─ success → ack
   ├─ transient error → nack → redeliver (backoff)
   └─ after N failures → move to DLQ (alert, inspect, replay)
```

**Watch head-of-line blocking.** With strict ordering, one stuck message halts everything behind it. Either allow out-of-order processing for independent messages or use per-key partitions so one bad key doesn't freeze the rest.

The mental model: the broker guarantees delivery, but *correct processing under duplicates and failures is the consumer's job*. This is the same idempotency discipline as a POST idempotency key — the failure surface just moved from the client to the subscriber.

### Q13. When would you expose a public event/streaming API instead of a request/response one?

Expose events as a first-class API when your consumers need to **react to things as they happen** rather than ask repeatedly. Concretely:

- **Real-time integrations at scale.** Payments, source control, and messaging platforms (Stripe, GitHub, Slack) publish webhooks/events because thousands of integrators can't efficiently poll for every state change. The event API *is* the product surface.
- **Decoupling many consumers.** When lots of downstream systems care about the same facts and you don't want to know who they are, publish events and let them subscribe.
- **Streaming data.** Live metrics, market data, log tails, LLM token streams — anything where a continuous flow beats discrete pulls (SSE/WebSocket).

Keep it **request/response** when consumers need to *ask specific questions on demand* (fetch this order, search these products), when the data is queried far more than it changes, or when the added contract complexity (delivery guarantees, schema evolution, replay) isn't justified. The best platforms offer **both**: a synchronous REST/GraphQL API to query current state *and* an event stream (webhooks/AsyncAPI) to react to changes. They complement each other — thin events tell you *something changed*, the REST API tells you *what it is now*.

### Q14. What are the tradeoffs of choosing async over sync? What do you give up?

Async buys **throughput, decoupling, resilience, and load-smoothing** — and it charges you in complexity. Be able to name the bill:

**You give up immediate consistency.** The caller no longer has the answer in hand. The system is now eventually consistent, and your UX/API has to represent "in progress" states and handle the window where the result doesn't exist yet.

**You give up simple error handling.** In sync, an error comes back on the same call. In async, failures happen *later*, out of band — so you need status resources, error events, dead-letter queues, and a way for the client to discover that something failed.

**You give up ordering and once-only delivery for free.** You now design for at-least-once + reordering, which means idempotent consumers and sometimes sequence numbers.

**You add operational surface.** Brokers/queues to run, monitor, and scale; delivery dashboards; replay tooling; more moving parts to debug across.

**Debugging gets harder.** A request no longer has one linear trace; you need correlation IDs and distributed tracing to follow a flow across producers, brokers, and consumers.

The senior framing: async is the right call when the *problem* is inherently slow, unreliable, or fan-out — then the complexity is buying you something real. Reaching for async on a fast, simple, single-consumer operation just imports all those costs for no benefit. Default sync; go async deliberately.

### Q15. How do you version and evolve an event schema without breaking consumers?

Same principle as REST versioning — **additive, backward-compatible change** — but the blast radius is bigger because you often don't know all your subscribers.

**Safe (non-breaking) changes:** adding a new **optional** field, adding a new **event type**, adding a new enum value *only if* consumers are tolerant. Consumers should follow the **tolerant reader** rule: ignore unknown fields, don't choke on extras.

**Breaking changes:** removing/renaming a field, changing a type, tightening validation, changing the meaning of a value. These need a new version.

Strategies:

- **Version the event, not just the endpoint.** Put a `schema_version` or `type` like `order.placed.v2` in the payload, or carry a version in message metadata/headers so consumers can branch.
- **Run versions in parallel.** Publish both `v1` and `v2` events (or a superset) during a deprecation window; let consumers migrate on their own schedule, then retire `v1` with a communicated **sunset** date.
- **Use a schema registry.** Enforce compatibility (backward/forward) at publish time so a producer literally can't ship a breaking change.
- **Document with AsyncAPI + a changelog.** Consumers need to see what changed and when.

```json
{ "type": "order.placed", "schema_version": 2,
  "data": { "order_id": "order_123", "currency": "USD", "amount": 4200 } }
```

Golden rule, unchanged from REST: **never break existing consumers silently.** Add, don't mutate; deprecate loudly; retire on a schedule.

### Q16. Design the API for order status notifications. Walk through sync vs async decisions.

Requirement: clients (merchant backends and a mobile app) must know when an order changes status (`placed → paid → shipped → delivered`).

**Query current state — synchronous REST.** The mobile app rendering an order screen just needs the current status now:

```http
GET /v1/orders/order_123 HTTP/1.1

HTTP/1.1 200 OK
{ "id": "order_123", "status": "shipped", "updated_at": "2026-07-01T09:00:00Z" }
```

**React to changes — async, and the mechanism depends on the consumer:**

- **Merchant backends → webhooks.** They can host a URL and want to trigger their own workflows (send email, update ERP). Register `order.status_changed` webhooks, sign with HMAC, retry with backoff, dedup on event ID.

```json
{ "type": "order.status_changed", "id": "evt_9", "order_id": "order_123",
  "old_status": "paid", "new_status": "shipped", "occurred_at": "2026-07-01T09:00:00Z" }
```

- **Mobile app → push notification / SSE, or just poll.** A phone can't reliably host a webhook. Use a push-notification channel for user-facing alerts, or let the app poll `GET /v1/orders/order_123` when it's foregrounded.

**Design decisions to defend:**

- Use a **thin-ish event** (status + IDs), and let consumers hit the REST API for full order detail — keeps the event stable and avoids leaking the whole order model.
- Don't promise ordered delivery; include `occurred_at` and `old_status`/`new_status` so a consumer can detect and drop a stale/out-of-order event.
- Offer **both** webhooks and polling so integrators without public endpoints aren't locked out.
- Document the webhook contract with **AsyncAPI** and version the event.

The through-line: **sync to read current state, async to be notified of change, mechanism chosen per consumer's capabilities.** That combination — not one or the other — is the mature answer.

## API Gateways & Management

### Summary

**What this topic covers**

The layer that sits *in front of* your services and handles everything that isn't business logic. An **API gateway** is a reverse proxy on steroids: it terminates TLS, routes requests to backends, offloads authentication and authorization, enforces rate limits and quotas, transforms requests/responses, aggregates multiple backend calls, caches, and emits observability data — so each service doesn't reimplement all of that. This topic covers what a gateway does and doesn't do, the **BFF (Backend-for-Frontend)** pattern (a gateway tailored to one client type), **edge concerns** (TLS termination, CORS, compression), the difference between a **gateway** and a **service mesh** (north-south vs east-west traffic), where **cross-cutting concerns** should actually live, **managed API platforms** (Apigee, AWS API Gateway, Kong), **caching at the gateway**, and **observability/analytics** as a first-class gateway feature. The 15 questions here run from "what is an API gateway and why not just call services directly" to "design the edge layer for a public API with three client types." The core idea: a gateway centralises the concerns that every request needs, keeping services focused on domain logic.

**Mental model**

Picture two kinds of traffic in a system. **North-south** is traffic entering from the outside world — clients hitting your API. **East-west** is traffic between your own services. An **API gateway** governs north-south: it's the single front door where you concentrate edge concerns (auth, rate limiting, TLS, routing) so clients see one clean, stable surface instead of a mesh of internal services. A **service mesh** governs east-west: sidecar proxies handling service-to-service mTLS, retries, and traffic shifting. They're complementary, not competitors. The second mental shift: a gateway is where **cross-cutting concerns** belong *when they're the same for every service* — you don't want twelve services each parsing JWTs and counting requests differently. But push *business logic* into the gateway and you've built a distributed monolith with a smart-pipe problem. The gateway should be **dumb about domain, smart about plumbing.** A **BFF** is the deliberate exception: when one client (mobile) needs aggregation and shaping so different from another (web) that a shared gateway would be a mess, you give each client its own gateway.

**Key terms**

- **API gateway** — a managed entry point that routes, secures, rate-limits, transforms, and observes API traffic; one front door for many backends.
- **Reverse proxy** — a server that forwards client requests to backends; a gateway is a reverse proxy plus API-aware policy.
- **BFF (Backend-for-Frontend)** — a dedicated gateway/backend per client type, shaping and aggregating data for that specific UI.
- **Cross-cutting concern** — a capability every request needs (auth, logging, rate limiting) that's orthogonal to business logic.
- **Service mesh** — infrastructure (sidecars) managing east-west service-to-service traffic (mTLS, retries, observability).
- **North-south vs east-west** — external client↔system traffic vs internal service↔service traffic.
- **TLS termination** — decrypting HTTPS at the edge so backends can speak plain HTTP internally.
- **Aggregation/composition** — one client call fanned out to several backends and merged into one response.
- **Rate limiting / quota** — throttling requests per key/tier to protect backends and enforce plans.
- **Request/response transformation** — rewriting headers, bodies, or formats between client and backend.
- **Managed API platform** — a product (Apigee, Kong, AWS API Gateway) providing gateway + developer portal + analytics + lifecycle.
- **Developer portal** — the self-service front door for consumers: docs, keys, plans, try-it consoles.

**Why interviewers ask this**

Gateway questions reveal whether you understand where responsibilities belong in a distributed system. A junior wires clients straight to services and re-implements auth in each one; a senior recognises the cross-cutting concerns and centralises them at the edge — while knowing *not* to smuggle business logic into the gateway. The BFF question tests whether you can spot when a one-size-fits-all API is hurting clients and when a per-client backend is worth the extra deployables. Gateway-vs-mesh probes whether you know north-south from east-west — a surprisingly common confusion. Interviewers also want to hear you weigh the gateway's risks: it's a single point of failure, a latency hop, and an org bottleneck if one team owns it. The strong signal is judgment about *placement* — "this belongs at the edge, that belongs in the service, this belongs in the mesh."

**Common confusions**

- "A gateway and a load balancer are the same" — a load balancer distributes traffic across instances (L4/L7); a gateway adds API-aware policy: auth, rate limiting, transformation, routing by path/version. Gateways often sit behind an LB.
- "A gateway and a service mesh do the same job" — gateway = north-south (edge); mesh = east-west (internal service-to-service). Complementary.
- "Put all logic in the gateway to keep services thin" — that recreates the ESB/smart-pipe anti-pattern. Keep domain logic in services; the gateway does plumbing.
- "A BFF is just a gateway" — a BFF is client-specific and *does* shape/aggregate data for one UI; a general gateway is client-agnostic. Different intent.
- "The gateway makes services secure, so services can trust anything from it" — defence in depth still matters; a compromised gateway or internal caller shouldn't get a free pass (zero-trust).
- "Caching at the gateway is always a win" — only for cacheable, non-personalised responses; caching authenticated/user-specific data at a shared edge risks leaking one user's data to another.

**What follows from this topic**

The gateway is where many other topics in this primer get *enforced*. Rate limiting, API-key/OAuth validation, and the OWASP API security controls are policies you often configure at the gateway rather than in each service. Response caching with `ETag`/`Cache-Control` frequently lives here. The developer portal ties directly into Documentation & Contracts — OpenAPI specs power the gateway's routing *and* the portal's interactive docs. And gateways are where async meets sync: many platforms can turn a webhook or a message into an HTTP call and back. Think of the gateway as the operational home for the cross-cutting decisions you make everywhere else in API design.

### Q1. What does an API gateway do, and why not let clients call services directly?

An **API gateway** is a single managed entry point in front of your backend services. Its core jobs:

- **Routing** — map an external path/host to the right backend (`/v1/orders` → orders-service, `/v1/users` → users-service).
- **Auth offload** — validate API keys / JWTs / OAuth tokens once at the edge so services don't each re-implement it.
- **Rate limiting & quotas** — throttle per key/tier to protect backends.
- **Transformation** — rewrite headers, versions, or payload formats between client and backend.
- **Aggregation/composition** — fan one client call out to several services and merge the result.
- **TLS termination, CORS, compression** — edge concerns handled in one place.
- **Observability** — centralised logging, metrics, tracing, and analytics.

Why not call services directly? Because then **every client must know your internal topology** (which service owns what, where it lives), and **every service must re-implement** auth, rate limiting, and logging. Move a service, split it, or rename it, and all clients break. The gateway gives clients **one stable façade** decoupled from internal structure, and gives you **one place** to enforce cross-cutting policy.

The trade: it's a **single point of failure** (must be HA), an extra **latency hop**, and can become an **org bottleneck** if one team gatekeeps every change. So keep it dumb about domain logic and smart about plumbing — routing and policy, not business rules.

### Q2. What is the BFF (Backend-for-Frontend) pattern and when do you use it?

A **BFF** is a dedicated backend/gateway **per client type**, whose job is to shape and aggregate data exactly for that client's UI. Instead of one general-purpose API serving web, mobile, and third parties alike, you build a **mobile BFF**, a **web BFF**, etc.

```text
                 ┌── Web BFF ──┐
Web app ─────────┤             ├──→ orders, users, catalog services
                 └─────────────┘
                 ┌── Mobile BFF ┐
Mobile app ──────┤              ├──→ orders, users, catalog services
                 └──────────────┘
```

Why: different clients have genuinely different needs. A **mobile** client wants few round-trips, tiny payloads, and screen-shaped responses (battery/bandwidth constrained). A **web** SPA can make more calls and wants richer data. A one-size API forces both into a compromise — mobile over-fetches, web is under-served — and every UI tweak requires negotiating a change to the shared API.

Use a BFF when:

- Client needs **diverge significantly** (payload shape, aggregation, chattiness).
- You want the **frontend team to own** their backend-for-UI and iterate fast without cross-team coordination.
- You're aggregating **many** downstream services into screen-specific responses.

Costs: **more deployables**, potential **duplicated logic** across BFFs, and the risk of business logic leaking into them (keep them thin — orchestration and shaping, not domain rules). GraphQL is sometimes an alternative to BFFs (clients shape their own responses), but a BFF gives you server-controlled aggregation and per-client optimisation. Don't build BFFs when one API serves all clients fine — it's overhead you don't need.

### Q3. Which cross-cutting concerns belong at the gateway, and which belong in the service?

The dividing line: **generic edge/plumbing concerns → gateway; domain-aware concerns → service.**

**Belongs at the gateway** (same for every service, no business knowledge needed):

- TLS termination, CORS, compression
- Authentication (validate the token/key is legit) and coarse authorization (does this key have the `orders:read` scope)
- Rate limiting, quotas, throttling
- Routing, request/response transformation, protocol translation
- Coarse caching, request logging, metrics, tracing injection

**Belongs in the service** (needs domain context):

- **Fine-grained authorization** — "can *this* user access *this specific* order" (object-level / BOLA checks). The gateway can't know your ownership model; only the service can.
- **Business validation** — is this a valid state transition, does inventory exist.
- **Domain logic** — obviously.

The trap is either extreme. Push object-level authz to the gateway and it needs to understand your entire domain (brittle, and it *can't* really). Push token validation into every service and you get twelve inconsistent implementations. The clean split: **gateway answers "is this a valid, authenticated, in-quota request for a route this key may use?"; the service answers "given *who* this is, may they do *this* to *that* resource?"** Auth at the gateway, but **defence in depth** — the service still validates (zero-trust; don't blindly trust internal traffic).

### Q4. How does an API gateway differ from a service mesh?

They govern **different traffic**:

| | API gateway | Service mesh |
|---|---|---|
| Traffic | North-south (client ↔ system) | East-west (service ↔ service) |
| Position | Edge / front door | Between internal services (sidecars) |
| Primary concerns | Auth, rate limiting, routing, transformation, aggregation | mTLS, retries, timeouts, traffic shifting, service discovery |
| Audience | External/partner clients | Internal services |
| Config unit | API/route/consumer | Service-to-service policy |

An **API gateway** is the single external entry point: it authenticates clients, rate-limits, and routes external requests to backends. A **service mesh** (Istio, Linkerd) is infrastructure that sits *between your own services* — typically as sidecar proxies — handling encryption (mTLS), retries, circuit breaking, load balancing, and observability for internal calls, transparently, without app code.

They're **complementary**. A request from a mobile app enters through the **gateway** (north-south: authenticate, rate-limit, route), and once inside, the resulting service-to-service calls are managed by the **mesh** (east-west: mTLS, retry, trace).

```text
mobile → [API GATEWAY] → order-svc ⇄ [mesh] ⇄ payment-svc ⇄ [mesh] ⇄ ledger-svc
         (north-south)              (east-west, sidecar-managed)
```

The confusion comes because both are "proxies that do routing and observability." The distinction is **whose traffic**: the gateway faces outward at the edge; the mesh faces inward between services. Many organisations run both.

### Q5. What is API aggregation/composition, and what are its risks?

**Aggregation** (a.k.a. composition or the gateway aggregation pattern) is when a single client request is fanned out to **multiple backend services** and their responses are **merged into one**. Instead of the client making five calls, it makes one; the gateway (or a BFF) does the fan-out.

```text
GET /v1/dashboard
        │
     [gateway] ──→ profile-service     ─┐
              ──→ orders-service        ├─ merge → single response
              ──→ recommendations-svc   ─┘
```

Why: it **reduces client round-trips** (huge for mobile/high-latency clients), hides internal service decomposition, and lets you assemble a screen-shaped response server-side where the network is fast.

Risks to name in an interview:

- **Coupling & fragility** — the aggregator now depends on N services; one slow or failing dependency can degrade or block the whole response. Mitigate with **timeouts, partial responses** (return what you have, mark the rest failed), and circuit breakers.
- **Latency = slowest dependency** — parallelise the fan-out, don't chain calls; the response is only as fast as the slowest branch.
- **Business logic creep** — aggregation is orchestration, not domain logic. Keep merge/shape logic thin or it becomes a hidden monolith.
- **Error semantics** — if one of five backends fails, is it a `200` with partial data, a `207`, or a `502`? Decide and document.

Aggregation is best done in a **BFF** (client-specific) or a purpose-built composition layer rather than bloating a generic gateway. GraphQL is a schema-driven alternative to hand-rolled aggregation.

### Q6. How and when should you cache at the gateway?

Caching at the gateway stores backend responses at the edge so repeat requests are served without hitting the service — cutting latency and backend load.

**When it's a clear win:** **public, cacheable, non-personalised** responses. Product catalogs, reference data, public content, anything the same for every caller. Respect the origin's `Cache-Control`/`ETag` and let the gateway serve from cache within the TTL.

```http
GET /v1/products/prod_1 HTTP/1.1

HTTP/1.1 200 OK
Cache-Control: public, max-age=300
ETag: "v7"
```

The gateway caches for 300s; subsequent requests are served from the edge, and it can revalidate with `If-None-Match` for a cheap `304`.

**When it's dangerous:** **authenticated, user-specific data.** Caching `GET /v1/me` at a *shared* edge can serve alice's data to bob if the cache key ignores identity. Rules:

- **Never cache without keying on the auth/identity dimension** for personalised responses (and prefer `private` cache-control so shared caches don't store it at all).
- **Never cache** responses to unsafe methods, or anything with `Cache-Control: no-store`.
- **Vary correctly** — include `Authorization`, `Accept`, and version in the cache key where they change the response.

Also decide **invalidation**: TTL-based expiry is simple but can serve stale data; event/tag-based purging is fresher but more complex. The gateway is the right place for *shared, public* caching; per-user caching usually belongs closer to the client (HTTP `private` caches) or not at all. The classic incident here is a mis-keyed edge cache leaking one user's response to another — treat personalised caching as a security decision, not just a performance one.

### Q7. Where should authentication and authorization happen — gateway or service?

Split them: **authentication and coarse authorization at the gateway; fine-grained authorization in the service.**

**At the gateway (authentication + coarse authz):**

- Validate the credential — is the API key real, is the JWT signature valid and unexpired, is the OAuth token active.
- Check **coarse scopes/roles** — does this token carry `orders:read`? Reject early if not.
- Inject a trusted identity context (e.g. a verified `X-User-Id` header or forwarded claims) for downstream services.

Doing this once at the edge means services don't each re-implement token parsing, and a bad token never reaches a backend.

**In the service (fine-grained / object-level authz):**

- "May *this* user read *this specific* order?" This is the **BOLA/IDOR** check — the #1 API security risk — and the gateway **cannot** do it, because it doesn't know your ownership model. The service that owns the resource must verify `order.owner_id == caller.id`.

```text
gateway: JWT valid? scope=orders:read? → yes → forward with verified user_id
service: does order_123.owner == user_id? → no → 404/403
```

**Defence in depth:** even though the gateway authenticated the caller, the service **re-validates** rather than blindly trusting an internal header — a leaked internal path or a compromised gateway shouldn't grant free access (zero-trust). So: gateway proves *who you are* and *broadly what you may do*; the service decides *whether you may touch this exact thing*.

### Q8. What edge concerns (TLS, CORS, compression) does a gateway handle?

The gateway is the natural home for concerns that apply to *all* inbound traffic regardless of which backend serves it:

**TLS termination.** The gateway holds the certificates and terminates HTTPS at the edge, so internal traffic can be plain HTTP (or re-encrypted mTLS via a mesh). Centralising cert management here means one place to rotate certs, enforce TLS versions, and set cipher policy — instead of every service managing its own.

**CORS.** Browsers enforce the same-origin policy; a browser calling `api.example.com` from `app.example.com` triggers CORS preflight (`OPTIONS`) checks. The gateway answers preflights and sets `Access-Control-Allow-Origin/-Methods/-Headers` consistently, so services don't each implement CORS (and implement it *differently*, which is a common bug source). Note CORS is a browser-enforced access rule, not a security boundary — it doesn't replace auth.

**Compression.** The gateway can gzip/brotli responses based on `Accept-Encoding`, shrinking payloads without each service handling it.

Other edge concerns that belong here: **request size limits**, **basic input/schema validation** (reject malformed requests before they hit a backend), **IP allow/deny lists**, and **header normalisation**. The theme: these are **generic, request-level** policies with no domain knowledge — exactly what a gateway should own. Anything requiring business context (which user owns this order) stays in the service.

### Q9. What does a managed API platform give you beyond a raw gateway?

A raw reverse proxy routes and maybe rate-limits. A **managed API platform** (Apigee, AWS API Gateway, Kong, Azure API Management) wraps the gateway in a full **API lifecycle product**:

- **Developer portal** — self-service docs (from your OpenAPI spec), interactive "try it" consoles, and **API key / credential self-provisioning** so consumers onboard without emailing you.
- **Plans, tiers & quotas** — define Free/Pro/Enterprise tiers with different rate limits and monetisation, enforced automatically.
- **Analytics & monetisation** — per-consumer usage dashboards, top endpoints, error rates, latency, and billing hooks.
- **Lifecycle & versioning** — publish, deprecate, and sunset API versions with governance.
- **Policy without code** — apply auth, rate limiting, transformation, and caching via configuration.
- **Security & governance** — spec linting, threat protection, key rotation, org-wide standards.

The value is turning your API into a **product with a front door**: a place consumers discover it, get keys, read docs, and see their usage — plus a place *you* govern versions, enforce policy, and measure adoption. Building all of that in-house (portal, key management, analytics, quota enforcement, docs) is a large project; a platform gives it to you configured.

The tradeoffs: **cost**, **vendor lock-in**, and another dependency in the request path. For a small internal API, a lightweight gateway (or none) is fine. For a **public/partner API** where DX and governance are the product, a managed platform usually pays for itself. This directly connects to Documentation & Contracts — the portal *is* your docs delivered as a DX product.

### Q10. Design the edge layer for a public API serving web, mobile, and third-party clients.

Three consumer types with different needs → layered edge, not one flat gateway.

```text
web SPA ───┐
           ├─→ [ CDN / TLS / WAF ] ─→ [ API GATEWAY ] ─→ services
mobile ────┤        (edge)          (auth, rate-limit,
           │                         routing, quotas)
3rd party ─┘
                    ↑ BFFs where client needs diverge
```

**Shared edge (all clients):** CDN + TLS termination + WAF/DDoS protection out front. Then a **gateway** doing authentication (validate keys/JWTs), coarse authz (scopes), rate limiting per key/tier, routing, CORS, and observability.

**Auth per client type:**

- **Web SPA** — OAuth/OIDC with short-lived tokens; the gateway validates JWTs; CORS configured for the app origin.
- **Mobile** — OAuth with refresh tokens; consider a **mobile BFF** to aggregate screen data and minimise round-trips.
- **Third parties** — **API keys** or OAuth client-credentials, with **tiered quotas** and a **developer portal** for self-service keys and docs.

**Rate limiting & quotas:** per-key limits with plan tiers (free vs partner), `429 + Retry-After + RateLimit-*` headers, and per-consumer analytics so you can see and bill usage.

**Shaping:** general clients hit the versioned REST API directly; where web and mobile needs genuinely diverge, add **BFFs** for aggregation and payload shaping. Keep the gateway domain-dumb — object-level authz stays in the services.

**Governance:** OpenAPI-driven routing and portal, spec linting, versioned endpoints (`/v1`), documented deprecation with `Sunset` headers. The through-line: **one hardened front door for cross-cutting concerns, client-specific BFFs only where needs diverge, business logic always in the services.**

### Q11. What observability and analytics should live at the gateway?

The gateway sees **every** request, which makes it the ideal place to capture cross-cutting telemetry — and the reason "analytics" is a headline feature of managed platforms.

**Operational observability (are we healthy?):**

- **Metrics** — request rate, error rate (by status class), and latency percentiles (p50/p95/p99) per route and per consumer. This is your golden-signals dashboard.
- **Structured logs** — one record per request: method, path, status, latency, consumer/key ID, correlation ID.
- **Distributed tracing** — the gateway **injects a trace/correlation ID** (`traceparent`) so a request can be followed across all downstream services. Without this originating at the edge, traces fragment.

**Business/product analytics (how is the API used?):**

- **Per-consumer usage** — who calls what, how often; drives quotas, tiering, and billing.
- **Top endpoints, adoption, error hotspots** — which features get used, which versions are still live (informs deprecation), where clients hit errors.

Why the gateway specifically: it's the **one choke point** that sees all traffic with consumer identity attached, *before* it fans out to services. Capturing it here gives consistent, per-consumer, cross-service visibility that you'd otherwise have to stitch together from each service's logs.

Watch-outs: **don't log sensitive data** (tokens, PII, full bodies) at the edge; **sample** high-volume traces to control cost; and remember the gateway sees the *edge* view — you still need per-service instrumentation for internal (east-west) behaviour.

### Q12. Is the API gateway a single point of failure? How do you mitigate the risks?

Yes — by design, all north-south traffic flows through it, so if it's down, your whole API is down. Its risks and mitigations:

**Availability (SPOF):** run the gateway **highly available** — multiple instances across zones behind a load balancer, health checks, and autoscaling. It must be at least as available as the services behind it. Managed platforms handle much of this; self-hosted gateways need real HA engineering.

**Latency (extra hop):** every request pays a gateway hop. Keep gateway logic **lightweight** (routing + policy, not heavy computation), enable keep-alive/HTTP-2 to backends, and cache where safe. Measure the added p99, not just the average.

**Org bottleneck:** if one team must approve every route change, the gateway throttles delivery. Mitigate with **self-service config** (teams manage their own routes via declarative config/CI), spec-driven onboarding, and clear guardrails instead of manual gatekeeping.

**Blast radius / bad config:** a bad gateway config can break *every* API at once. Mitigate with **staged rollouts, canary configs, versioned declarative config in git, and instant rollback.**

**Security concentration:** it's a high-value target holding certs and validating all auth. Harden it, and keep **defence in depth** — services still validate rather than blindly trusting gateway-forwarded identity.

The honest interview answer: the gateway centralises real benefits (consistent policy, one front door) but concentrates risk. You accept it by making the gateway **HA, lightweight, self-service, and safely reconfigurable** — never by pretending the SPOF isn't there.

### Q13. Can a gateway translate protocols (REST↔gRPC, sync↔async)? Should it?

Yes, protocol/format translation is a standard gateway capability, and it's often the *point*.

**REST ↔ gRPC.** Internal services frequently speak **gRPC** (fast, typed, HTTP/2) but browsers and many public clients can't easily consume it. A gateway exposes a **REST/JSON** facade externally and translates to gRPC internally — clients get familiar JSON, services keep gRPC's performance. (gRPC-web and gRPC transcoding do exactly this.)

```text
browser ──REST/JSON──→ [gateway] ──gRPC/HTTP2──→ internal services
```

**Sync ↔ async.** A gateway can accept a synchronous HTTP request and drop a message onto a **queue** (turning a client call into an async job), or the reverse — expose an HTTP endpoint that internal event producers hit. This lets external clients speak plain request/response while the backend is event-driven.

**Format/version translation.** Rewrite between an old client format and a new backend schema during a migration, so old clients keep working while backends evolve.

**Should you?** For **edge/impedance-matching** — yes. Translating protocol and format so external clients get a clean, stable, standard interface over heterogeneous or high-performance internal services is exactly what a gateway is for. **But** keep it mechanical: header/format/protocol mapping, not business transformation. The moment translation starts encoding domain rules ("if amount > 1000, also call the fraud service"), you're leaking logic into the pipe — that belongs in a service or an explicit orchestration/BFF layer, not buried in gateway config.

### Q14. How do you do rate limiting and quota enforcement at the gateway?

The gateway is the natural enforcement point because it sees every request with a consumer identity attached. Two related controls:

**Rate limiting** — short-window throttling to protect backends (e.g. 100 req/s per key). **Quotas** — longer-window plan limits (e.g. 1M req/month on the Pro tier). Managed platforms enforce both per consumer.

**Key by identity, not just IP.** For authenticated APIs, limit **per API key / OAuth client / user**, so one heavy consumer can't exhaust the budget and NAT'd users don't share a bucket. IP-based limiting is a fallback for unauthenticated traffic.

**Tie limits to tiers.** Free = 60 req/min, Pro = 1000 req/min, Enterprise = custom. The gateway looks up the consumer's plan and applies the matching bucket.

**Respond correctly** (this is a design contract, see the Rate Limiting topic):

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 30
RateLimit-Limit: 1000
RateLimit-Remaining: 0
RateLimit-Reset: 30
```

Return **`429`**, a **`Retry-After`**, and **`RateLimit-*`** headers so well-behaved clients back off and self-throttle *before* hitting the wall.

**Algorithm** — gateways typically use **token bucket** (allows bursts up to a cap, refills steadily) or **sliding window** (smoother than fixed window, avoids the boundary-spike problem). In a multi-instance gateway, the counter must be **shared** (e.g. in Redis) so limits are global, not per-instance.

Doing this at the gateway means **consistent, centralised** enforcement and per-consumer usage analytics for free — versus every service counting requests differently and inconsistently.

### Q15. What are the anti-patterns of API gateways — when do they go wrong?

The gateway is powerful, which is exactly why it's easy to misuse. The failure modes:

**Business logic in the gateway.** The big one. Encoding domain rules, orchestration with conditionals, or data transformation that depends on meaning turns the gateway into a **distributed monolith / smart pipe** (the old ESB anti-pattern). It becomes a shared chokepoint every team must edit, hard to test, and a single blast-radius for bugs. Keep the gateway domain-dumb: routing and policy, not rules.

**The god gateway / org bottleneck.** One team owns one giant gateway config that every other team must go through to ship. Delivery grinds. Fix with **self-service, declarative, git-versioned** config per team.

**Object-level authz at the gateway.** Pushing "can this user access this order" to the edge either fails (the gateway can't know) or drags domain knowledge into the edge. Keep fine-grained authz in services.

**Caching personalised data at a shared edge.** Mis-keyed caches leak one user's response to another — a real security incident, not just a bug.

**Ignoring the SPOF/latency cost.** Treating the gateway as free. It's an extra hop and a single failure domain; if it's not HA and lightweight, it caps your whole API's availability and latency.

**Over-adopting for tiny systems.** A single internal service behind a heavyweight managed gateway is complexity for no benefit.

The unifying principle: **the gateway should be smart about plumbing and dumb about domain.** Every anti-pattern above is some flavour of violating that line — either smuggling business logic in, or forgetting it's a shared, latency-adding, single point of failure.

## API Documentation & Contracts

### Summary

**What this topic covers**

How an API describes itself, and how you keep that description honest. At the centre is the idea that an API is a **contract**, and the most valuable form of that contract is **machine-readable**: **OpenAPI/Swagger** for REST (and its cousins — protobuf for gRPC, AsyncAPI for events). This topic covers **schema-first vs code-first** authoring, why a machine-readable spec is worth having at all, **contract testing** (consumer-driven contracts, Pact) to stop producer and consumer drifting apart, **mocking and stub servers** generated from the spec, **SDK/client code generation**, **interactive docs and developer portals**, the role of **examples and changelogs**, **treating documentation as a DX product**, **linting the spec** (Spectral) to enforce standards, and the perennial hard problem: **keeping docs and implementation in sync**. The 15 questions here span "what is OpenAPI and why does it matter" to "design a workflow that guarantees your docs never lie." The core belief: great docs aren't an afterthought written once and rotting — they're generated from, and tested against, a single source-of-truth contract.

**Mental model**

Think of the API spec as the **single source of truth** that everything else hangs off. One OpenAPI document can drive: the **docs** (rendered as an interactive portal), the **mock server** (so frontend can build before backend exists), the **client SDKs** (generated in six languages), the **contract tests** (validating the real API matches the spec), the **linting** (enforcing your style guide), and even the **gateway routing**. When the spec is the hub, the whole ecosystem stays coherent — change the spec, and docs, mocks, and SDKs regenerate. The opposite world — docs hand-written in a wiki, drifting from the code — is where "the docs lie" comes from, and lying docs are worse than no docs because they destroy trust. The second mental shift: **documentation is a product, and its users are developers.** DX (developer experience) is a feature. Good docs with runnable examples, clear errors, and honest changelogs are the difference between an API developers adopt and one they abandon. The engineering goal is a pipeline where **the contract can't silently diverge from reality** — you either generate from it or test against it.

**Key terms**

- **OpenAPI (Swagger)** — the standard machine-readable specification format for describing REST APIs (paths, schemas, params, responses).
- **Schema-first (design-first)** — write the OpenAPI spec first, then implement to match it.
- **Code-first** — write the code (with annotations), generate the spec from it.
- **Contract** — the agreed interface between producer and consumer; the spec is its written form.
- **Contract testing** — automated tests verifying producer and consumer agree on the contract, without full integration.
- **Consumer-driven contract (CDC)** — the consumer defines its expectations; the provider is tested against them (Pact).
- **Mock/stub server** — a fake API generated from the spec that returns example responses, for parallel development.
- **SDK/client codegen** — auto-generating typed client libraries from the spec (OpenAPI Generator).
- **Interactive docs / portal** — rendered, try-it-in-browser documentation (Swagger UI, Redoc, Stoplight).
- **Spectral** — a linter that enforces style/consistency rules on an OpenAPI spec.
- **Changelog** — a human-readable record of what changed between API versions, including breaking changes.
- **Drift** — the gap that opens when docs/spec and the real implementation stop matching.

**Why interviewers ask this**

Documentation questions separate people who ship endpoints from people who ship *products*. A junior thinks docs are a chore you write afterwards; a senior treats the spec as the contract that drives tooling, testing, and DX. The schema-first vs code-first question probes whether you understand the tradeoff between design discipline and developer convenience. Contract testing is a strong senior signal — it shows you've felt the pain of producer/consumer drift in a microservices world and know a lighter-weight fix than full end-to-end integration. Interviewers also want to hear you connect docs to **evolvability**: a machine-readable contract is what lets you generate SDKs, mock, and detect breaking changes automatically. The clearest signal is when you frame the whole thing around **keeping docs and reality in sync** — because everyone has been burned by docs that lie, and knowing how to prevent that is real experience.

**Common confusions**

- "OpenAPI and Swagger are different things" — Swagger *was* the name; OpenAPI is the spec (3.x), Swagger is now Smartbear's tooling (Swagger UI, Editor). People use them interchangeably for the spec.
- "Code-first is always easier so it's better" — code-first is convenient but the spec becomes a *side effect* of the code, so it drifts and design gets no upfront thought. Schema-first forces design and enables parallel work, at the cost of discipline.
- "Contract tests are just integration tests" — no. Contract tests verify the *interface agreement* in isolation (provider against consumer expectations) without spinning up the whole system. Faster, targeted, and they pinpoint who broke the contract.
- "If the code compiles, the docs are right" — only if docs are generated from or tested against the code. Hand-written docs drift regardless of compilation.
- "The spec is documentation" — it's more: it's a machine-readable contract that also generates SDKs, mocks, tests, and routing. Docs are one output.
- "More docs = better docs" — DX is about the *right* docs: runnable examples, honest errors, clear changelogs — not exhaustive prose nobody reads.

**Why this topic closes the primer**

Documentation and contracts are where every other API design decision becomes *legible* to the people who consume your API. Your versioning policy, error model, pagination scheme, auth flows, and rate limits are only as good as your ability to communicate and enforce them — and the machine-readable contract is how you do both. It ties back to versioning (the spec is where you detect breaking changes), to gateways (the portal and routing come from the spec), and to async (AsyncAPI is the event-driven sibling of OpenAPI). A well-run API treats its contract as the product's spine: designed first, linted for consistency, tested against reality, and rendered as docs developers actually enjoy using.

### Q1. What is OpenAPI/Swagger and why does a machine-readable contract matter?

**OpenAPI** (formerly **Swagger**) is the standard, language-agnostic, **machine-readable specification** for describing a REST API — its paths, operations, parameters, request/response schemas, auth, and examples — in a single YAML/JSON document.

```yaml
paths:
  /v1/orders/{id}:
    get:
      summary: Fetch an order
      parameters:
        - name: id
          in: path
          required: true
          schema: { type: string }
      responses:
        '200':
          description: The order
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Order'
        '404':
          description: Not found
```

Why machine-readable matters — because **one spec drives an entire ecosystem**:

- **Interactive docs** render straight from it (Swagger UI, Redoc).
- **SDKs** in many languages are generated from it (typed clients, no hand-rolling).
- **Mock servers** spin up from it so frontends build before the backend exists.
- **Contract tests** validate the real API matches it.
- **Linting** (Spectral) enforces your standards on it.
- **Gateways** can route and validate from it.

A prose-only doc gives you none of that and rots the moment code changes. The machine-readable contract turns your API description from a document nobody trusts into the **single source of truth** that tooling generates from and tests against. On "Swagger vs OpenAPI": OpenAPI is the specification (3.x); Swagger is now the tooling brand — people say Swagger loosely to mean the spec.

### Q2. Schema-first vs code-first — which do you choose and why?

Two ways to get an OpenAPI spec:

| | Schema-first (design-first) | Code-first |
|---|---|---|
| Order | Write spec → implement to match | Write code (annotations) → generate spec |
| Design | Deliberate, upfront | Emergent from code |
| Parallel work | Yes — frontend/mocks from spec day 1 | No — spec exists only after code |
| Drift risk | Spec can drift from impl unless tested | Spec reflects code, but *is* the code's shape |
| Best for | Public/partner APIs, multiple teams | Internal APIs, small teams, speed |

**Schema-first**: you author the OpenAPI document first, review it, agree the contract, then implement. Benefits: design gets real thought *before* code locks it in; frontend, mock servers, and SDKs can be generated **immediately** so teams work in parallel; the contract is a genuine agreement, not an accident. Cost: discipline, and you must **test that the implementation actually matches the spec** or it drifts.

**Code-first**: you annotate your handlers/models and generate the spec from the running code. Benefits: convenient, the spec always reflects what the code *does*, less to maintain by hand. Cost: **design is an afterthought** (the API shape emerges from implementation convenience, not consumer needs), the spec is a byproduct rather than a contract, and it's easy to ship an inconsistent, un-designed API.

Recommendation: **schema-first for public, partner, or multi-team APIs** where the contract is a product and parallel work matters. **Code-first is defensible for internal, fast-moving, single-team** services where the API is an implementation detail. Whichever you pick, close the loop with **contract testing or request/response validation** so the spec and reality can't silently diverge.

### Q3. What is contract testing, and how does it differ from integration testing?

**Contract testing** verifies that a producer and a consumer **agree on the interface** — the shapes, fields, and status codes they exchange — *without* standing up the whole system.

The difference from integration testing:

| | Contract test | Integration test |
|---|---|---|
| Scope | The interface agreement only | Real end-to-end interaction |
| Dependencies | None spun up (mocked to the contract) | Real services/DBs running |
| Speed | Fast | Slow |
| Pinpoints failure | Yes — which side broke the contract | "Something in the flow broke" |
| Runs in | Each side's own CI, independently | A shared integration environment |

In microservices you have dozens of producer/consumer pairs. Full integration testing every combination is slow, flaky, and expensive, and when it fails it's hard to tell *who* broke *what*. Contract testing splits it: the **consumer** records exactly what it expects ("when I `GET /v1/orders/order_1`, I need a `200` with `id` and `status` strings"), and the **provider** is independently verified against that expectation. If a provider removes the `status` field, the provider's contract test **fails in the provider's own CI, before deploy** — pinpointing the breakage without any shared environment.

You still want *some* integration/E2E tests for genuine wiring and behaviour. But contract testing catches the most common and most damaging microservices failure — **a provider changing its API and silently breaking consumers** — cheaply and early. It's the automated enforcement of the contract that the OpenAPI spec merely describes.

### Q4. What is a consumer-driven contract (Pact) and when is it the right tool?

A **consumer-driven contract (CDC)** flips who defines the interface: the **consumer** declares exactly what it needs from the provider, and the provider is tested against the union of all its consumers' expectations. **Pact** is the popular tool.

How it works:

1. In the **consumer's** tests, you write expectations against a Pact mock: "when I call `GET /v1/users/usr_1`, I expect `200` with `{ id, email }`." Running these produces a **pact file** (the contract).
2. The pact file is published to a **broker**.
3. In the **provider's** CI, Pact replays those expectations against the real provider and verifies it satisfies **every consumer's** contract.

```text
consumer test → generates pact → [broker] → provider verifies against pact
   "I need id + email"                          "do I still return id + email?" ✓/✗
```

Why "consumer-driven": the contract represents **what's actually used**. If no consumer needs a field, the provider is free to change it; if a consumer depends on it, removing it fails the provider's build. This kills the guesswork of "is anyone using this?" — the contracts *are* the answer.

When it's the right tool: **internal microservices with a known, finite set of consumers** you control, where you want each side to test independently in its own CI and catch breaking changes before deploy. When it's **not**: **public APIs with unknown/unbounded consumers** — you can't collect contracts from strangers, so you fall back to schema-based contract testing (validate against the OpenAPI spec) and strict versioning. CDC shines for internal service meshes; provider-driven/spec-based testing shines for public surfaces.

### Q5. How do you generate a mock/stub server from a spec, and why bother?

Because the OpenAPI spec is machine-readable and includes schemas and examples, tools (Prism, Stoplight, WireMock, Swagger's mock features) can **spin up a fake server** that serves responses matching the spec — no backend implementation required.

```yaml
responses:
  '200':
    content:
      application/json:
        example: { "id": "order_1", "status": "shipped", "total": 4200 }
```

Point the mock at this spec and `GET /v1/orders/order_1` returns that example (or a schema-conformant generated one).

Why bother:

- **Parallel development.** Frontend and consumer teams build against the mock **on day one**, before the real backend exists. This is the single biggest reason and the killer argument for schema-first.
- **Contract validation for consumers.** Consumers develop against the *agreed* contract, so when the real API ships, integration is smooth — they were never coding against guesses.
- **Testing edge cases.** The mock can return `404`, `429`, `500`, and malformed cases on demand, letting consumers test error handling that's hard to trigger against a real backend.
- **Demos & prototyping.** Show the API's shape to stakeholders before writing a line of business logic.
- **Provider design feedback.** Building the mock and having consumers use it surfaces bad design (awkward payloads, missing fields) *before* you've implemented them.

The catch: a mock only proves the *shape* is right, not the *behaviour*. It returns canned data; it doesn't enforce business rules or real state. So mocks accelerate development and de-risk integration, but they don't replace testing against the real implementation. Combined with contract testing, mocks close the loop: consumers build against the mock, and contract tests verify the real provider matches the same spec.

### Q6. What is SDK/client codegen and what are its benefits and pitfalls?

**SDK codegen** generates typed client libraries directly from your OpenAPI (or protobuf/GraphQL) spec — so instead of every consumer hand-writing HTTP calls, they get a ready-made, typed client in their language.

```text
openapi.yaml ──(OpenAPI Generator)──→ typescript-client/
                                       python-client/
                                       java-client/
```

```typescript
// generated, typed:
const order = await client.orders.get({ id: "order_1" });
// order.status is a typed string, not `any`
```

Benefits:

- **Better DX** — consumers `import` a client instead of reading docs and wiring `fetch` calls; types catch mistakes at compile time.
- **Consistency** — every language client behaves the same because they're generated from one spec; no drift between the Python and Go clients.
- **Speed** — regenerate on every spec change; no manual client maintenance across N languages.
- **Fewer bugs** — typed request/response shapes prevent whole classes of "wrong field name" errors.

Pitfalls to name:

- **Generated code can be ugly/un-idiomatic** — raw generator output often doesn't feel like hand-written code in that language; may need templates/customisation.
- **Only as good as the spec** — a sloppy or inaccurate spec generates a sloppy or misleading SDK. Garbage in, garbage out.
- **Versioning the SDKs** — you now maintain and publish client packages; a spec change means re-releasing clients, and consumers must upgrade.
- **Over-abstraction** — generated clients can hide useful HTTP details (headers, status nuance) consumers sometimes need.

The senior take: codegen is a **DX multiplier for public/partner APIs** where you'd otherwise support many languages — but it depends entirely on a clean, well-designed spec, and you own the resulting client-library lifecycle. For a small internal API with one consumer language, hand-written or lightly-generated clients may be simpler.

### Q7. How do you keep documentation in sync with the implementation? (The drift problem)

**Drift** — docs saying one thing while the API does another — is the core failure of API documentation, and lying docs are worse than none because they destroy trust. You beat drift by making the docs **not independent** of the implementation. Three strategies, best to worst:

**1. Generate one from the other.** Either generate docs from the code (code-first, annotations → spec → rendered docs), or generate the implementation's validation from the spec (schema-first + request/response validation middleware that rejects anything off-contract). Either way, docs and code share a single source; they can't drift because they're the same artifact.

**2. Test the implementation against the spec.** Keep a schema-first spec and run **contract tests** (Q3/Q4) or **spec-validation tests** in CI: replay the spec's operations against the real API and fail the build if responses don't match. Now a divergence breaks CI *before* it ships.

**3. Governance in the pipeline.** Make the spec part of the PR: **lint it** (Spectral), **diff it** for breaking changes (fail CI on an unapproved breaking change), require spec updates alongside code changes, and regenerate docs/SDKs/mocks automatically on merge.

```text
PR → lint spec (Spectral) → breaking-change diff → contract tests vs impl
   → on merge: regenerate docs + SDKs + mocks (single source of truth)
```

The anti-pattern is **hand-written docs in a wiki**, updated manually and out-of-band — they *always* drift because nothing forces them to match. The principle: **docs must be generated from, or automatically tested against, the real contract.** Anything a human has to remember to update by hand will eventually be wrong. Wire the sync into CI so drift becomes a build failure, not a customer bug report.

### Q8. What makes API documentation good? (Docs as a DX product)

Good docs treat **developers as users** and DX as a feature — not a wall of auto-generated reference nobody can act on. What separates great docs:

**Runnable, realistic examples.** Every endpoint shows a concrete request *and* response with real-looking data — ideally copy-pasteable curl and a "try it" console. Developers learn by example far faster than by prose. A schema without an example is half-documented.

**A getting-started path.** Authentication, a first successful call, and a working end-to-end flow in minutes. The time-to-first-successful-call is *the* DX metric.

**Honest error documentation.** Every error code, what triggers it, and how to fix it. Under-documented errors are where integrators get stuck and give up.

**Interactive exploration.** Swagger UI / Redoc / a portal where developers can authenticate and fire real requests in the browser (see Q9).

**Conceptual guides, not just reference.** Reference docs (generated from the spec) list *what exists*; guides explain *how to accomplish a task* ("how to handle pagination," "how to verify a webhook"). You need both.

**A clear changelog** (Q10) so consumers can see what changed and plan migrations.

**Consistency & searchability** — consistent naming, structure, and a good search box; developers scan, they don't read linearly.

The framing that impresses in an interview: **your docs are the primary product surface for a developer-facing API.** Adoption, support load, and integration success are all downstream of doc quality. A brilliant API with poor docs loses to a mediocre one with great docs. So you invest in docs like a product — with examples, guides, honest errors, and an interactive portal — and you measure DX (time-to-first-call, support ticket volume) like you'd measure any product.

### Q9. What is an interactive developer portal and what should it include?

A **developer portal** is the self-service front door where consumers discover, learn, and start using your API — docs delivered as a product rather than a static PDF. For public/partner APIs it *is* the primary UX.

What a good portal includes:

- **Interactive reference docs** rendered from the OpenAPI spec (Swagger UI, Redoc, Stoplight), with a **"try it" console** — authenticate and fire real requests **in the browser**, see live responses. This turns reading into doing.
- **Getting-started guides & tutorials** — the fastest path from zero to a first successful call, plus task-oriented how-tos.
- **Self-service API keys / credentials** — sign up, create an app, get a key without emailing anyone. Removing onboarding friction is a huge DX win.
- **Authentication docs** — exactly how OAuth/keys work, with worked examples.
- **Code samples & SDKs** — snippets in multiple languages and links to generated client libraries.
- **Changelog & versioning info** — what changed, what's deprecated, sunset dates.
- **Usage dashboards** — per-consumer analytics (calls, errors, quota remaining), often tied to plans/tiers.
- **Status & support** — API status page, error reference, and a way to get help.

```text
[Developer Portal]
  ├─ Interactive docs (try-it console)   ← OpenAPI spec
  ├─ Guides & tutorials
  ├─ Self-service keys + plans
  ├─ SDKs / code samples                 ← codegen
  ├─ Changelog / deprecations
  └─ Usage analytics + status
```

Managed API platforms (Apigee, Kong, AWS API Gateway) provide portals out of the box, wired to the same spec that drives routing — which is why the spec being the single source of truth pays off again here. The portal is where documentation-as-a-product becomes literal: it's a UI whose job is to make developers successful, fast.

### Q10. Why do examples and changelogs matter, and how should you handle breaking-change communication?

**Examples** and **changelogs** are the two most under-invested, highest-leverage pieces of API docs.

**Examples** turn abstract schemas into something developers can act on immediately. A field named `status: string` tells you almost nothing; an example showing `"status": "shipped"` alongside the enum values tells you everything. Every endpoint should show a **realistic request and response** with representative data (using safe placeholders — `alice`, `order_123`, `api.example.com`). Examples are how developers actually learn an API; they scan for the example first and read the prose only when stuck. Good examples also feed mock servers and tests.

**Changelogs** are how consumers track evolution and plan migrations. A public API without a changelog forces integrators to discover changes by breaking. A good changelog:

- Records what changed per version, **clearly flagging breaking vs non-breaking**.
- Gives **migration guidance** for breaking changes ("`total` moved from cents to a `{ amount, currency }` object; here's how to migrate").
- States **deprecation timelines and sunset dates**.

**Communicating breaking changes** — the discipline that keeps trust:

1. **Announce early**, with a generous window, via changelog + email/portal notification.
2. **Signal in-band** with HTTP headers on deprecated endpoints:

```http
HTTP/1.1 200 OK
Deprecation: true
Sunset: Wed, 31 Dec 2026 23:59:59 GMT
Link: <https://docs.example.com/migrate-v2>; rel="deprecation"
```

3. **Run old and new in parallel** (versioning) so nobody is forced to migrate overnight.
4. **Never break silently** — the cardinal sin. A field that changes meaning without warning is worse than one that's removed loudly.

This ties directly to the versioning topic: the changelog and `Deprecation`/`Sunset` headers are how your versioning *policy* becomes *communication*. Examples reduce support load and speed adoption; changelogs preserve trust across change. Both are DX features, not paperwork.

### Q11. What is spec linting (Spectral) and what rules would you enforce?

**Spectral** is a linter for OpenAPI/AsyncAPI specs — it checks your spec against a **ruleset** and fails CI when the API violates your organisation's design standards. It's how you enforce **consistency and governance** automatically instead of hoping every reviewer remembers the style guide.

Why it matters: in any organisation with multiple teams writing APIs, they drift — one team uses `snake_case`, another `camelCase`; one paginates with `offset`, another with `page`; one returns bare arrays, another envelopes. Inconsistency is a DX tax on every consumer. Linting the spec catches these **before merge**, mechanically.

Rules worth enforcing:

- **Naming consistency** — all fields `snake_case` (or all `camelCase`), plural collection nouns (`/orders` not `/order`), no verbs in resource paths.
- **Every operation documented** — `summary`/`description` required, and an `example` on every schema.
- **Standard error shape** — error responses must conform to your problem+json schema.
- **Required responses** — every operation declares the relevant `4xx`/`5xx` responses, not just `200`.
- **Security defined** — every operation references a security scheme (no accidentally-public endpoints).
- **Versioning & structure** — paths carry the version prefix; no unversioned endpoints.
- **No breaking patterns** — flag things like removing an enum value or a field (paired with a diff tool).

```yaml
rules:
  snake-case-fields:
    given: "$.components.schemas.*.properties.*~"
    then: { function: casing, functionOptions: { type: snake } }
  operation-needs-example:
    given: "$.paths.*.*.responses.*.content.*"
    then: { field: example, function: truthy }
```

Wire Spectral into **CI and the PR pipeline** so a spec that violates the guidelines can't merge. Combined with a **breaking-change diff** (fail on unapproved breaking changes) and **contract tests** (fail on drift), linting completes the automated governance triad — style, compatibility, and accuracy all enforced by the build, not by human vigilance.

### Q12. Design a workflow that guarantees your docs never lie.

The goal: make it **structurally impossible** for shipped code to diverge from the published contract. A schema-first, CI-enforced pipeline:

**1. Spec is the source of truth (design-first).** The OpenAPI spec lives in the repo and is authored/reviewed *before* implementation. It's the contract, not a byproduct.

**2. Lint the spec (Spectral) in CI.** Every PR that touches the spec runs the ruleset — naming, error shape, examples, security. A spec violating standards can't merge.

**3. Diff for breaking changes.** A tool (e.g. oasdiff) compares the new spec against the last released one and **fails the build on an unapproved breaking change**, forcing a version bump or an explicit override.

**4. Validate the implementation against the spec.** Either request/response **validation middleware** rejects off-contract traffic at runtime, or **contract/spec tests** in CI replay the spec against the real API and fail if responses don't match. This is the anti-drift core — reality is tested against the contract.

**5. Generate everything downstream from the spec on merge.** Docs (portal), SDKs (codegen), and mock servers all regenerate automatically. Nothing is hand-maintained, so nothing can drift.

```text
PR ─┬─→ Spectral lint ──────────────┐
    ├─→ breaking-change diff ────────┤ all must pass
    └─→ contract tests (impl vs spec)┘
            │ merge
            ▼
   auto-regenerate: docs + SDKs + mocks   (single source of truth)
```

**6. Communicate change** — changelog and `Deprecation`/`Sunset` headers generated/updated as part of the release.

The guarantees this gives you: docs are **generated** from the spec (can't drift from *it*), and the implementation is **tested** against the spec (can't drift from *reality*) — so docs, spec, and behaviour are provably aligned, enforced by the build rather than human discipline. The one thing to keep honest: examples and prose guides that humans still write need review, but the machine-readable core is locked.

### Q13. Should the OpenAPI spec live with the code, in a central registry, or both?

Both, with a clear source of truth and a publishing step. The tension is between **proximity to code** (so it stays accurate) and **central discoverability** (so consumers and governance can find it).

**Spec lives with the code (source of truth).** Keep the OpenAPI spec **in the service's repo**, versioned alongside the implementation. This is essential for accuracy: the spec changes in the *same PR* as the code, gets reviewed together, and CI tests the code against it. A spec that lives far from the code drifts because updating it is someone else's separate job.

**Published to a central registry/catalog (discovery + governance).** On merge/release, **publish** the spec to a central **API catalog** (or the developer portal, or a schema registry). This gives the organisation one place to discover all APIs, run cross-cutting governance (org-wide linting, breaking-change policy), power the portal and SDK generation, and let consumers find contracts without cloning repos.

```text
service-repo/openapi.yaml  ──(CI on merge)──→  central API catalog / portal
  (source of truth,                              (discovery, governance,
   reviewed with code)                            portal, SDK/mock generation)
```

The rule: **the repo is the source of truth; the registry is a published, read-through copy.** Author and review the spec next to the code (accuracy), then publish it centrally (discoverability). Avoid the inverse — a central spec that engineers edit *away* from the code — because it decouples the contract from the implementation and reintroduces drift, the exact problem you're trying to kill. This mirrors the general principle: keep the contract close enough to the code that it can't lie, but visible enough that the whole organisation can build on it.

### Q14. How do you document authentication, errors, and rate limits so integrators don't get stuck?

These three are where integrators get stuck most, and where thin docs generate the most support tickets. Document each concretely:

**Authentication** — the first thing every integrator does, so make it frictionless. Show: which scheme (API key / OAuth2 / OIDC), exactly **where** the credential goes, how to obtain it (self-service portal link), token lifetime and refresh, and **required scopes per endpoint**. Include a working example:

```http
GET /v1/orders HTTP/1.1
Authorization: Bearer eyJhbGciOi...   (scope: orders:read)
```

For OAuth, document the full flow (redirect, token exchange) with a diagram. The metric is time-to-first-authenticated-call.

**Errors** — document your consistent error model (ideally RFC 7807 problem+json), and for **every** error code: what triggers it, whether it's retryable, and how to fix it.

```json
{ "type": "https://docs.example.com/errors/insufficient-funds",
  "title": "Insufficient funds", "status": 402,
  "code": "insufficient_funds", "detail": "Balance 500 < amount 4200" }
```

A table of `400/401/403/404/409/422/429/500` with "cause → fix" saves enormous integrator pain. Under-documented errors are the #1 place people give up.

**Rate limits** — document the limits per tier, the headers you return, and the expected client behaviour:

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 30
RateLimit-Limit: 1000
RateLimit-Remaining: 0
```

Tell integrators to **read `RateLimit-*` and back off on `429` with `Retry-After`** — and ideally show a retry-with-backoff snippet. Documenting limits *proactively* stops clients from hammering blindly and hitting walls.

The pattern across all three: **be concrete, show real request/response examples, and tell the integrator exactly what to do** (which scope, which fix, when to retry). These directly connect to the auth, errors, and rate-limiting design topics — good docs are how those designs actually reach the developer.

### Q15. How does the contract enable safe API evolution and breaking-change detection?

A machine-readable contract turns "did we break someone?" from a nervous guess into an **automated check** — which is the whole reason evolvability and contracts are the same conversation.

**The spec makes changes diffable.** Because the API is described in a structured document, a tool (oasdiff, openapi-diff) can **compare two versions** and mechanically classify every change:

- **Non-breaking (safe):** adding an optional field, a new endpoint, a new enum value (for tolerant readers), a new optional parameter. Additive.
- **Breaking:** removing/renaming a field, changing a type, making an optional field required, tightening validation, removing an endpoint or enum value, changing status codes.

Wire that diff into **CI**: a PR that introduces a breaking change **fails the build** unless it's explicitly acknowledged (with a version bump or override). Now breaking changes can't ship by accident — the contract catches them before deploy.

```text
old-spec.yaml  ┐
               ├─→ oasdiff → BREAKING: field 'total' type changed → CI fails
new-spec.yaml  ┘            (bump to /v2 or revert)
```

**The contract also enables the safe-evolution toolkit:**

- **Contract tests** (with consumers) tell you what's *actually used*, so you know a change is safe if no consumer's contract depends on the field.
- **Generated docs/SDKs/changelog** propagate the change consistently to consumers.
- **`Deprecation`/`Sunset` headers** and versioning let old and new run in parallel.

The senior framing: **evolvability is a property you get from treating the contract as a testable, diffable artifact.** Additive change + tolerant readers is the *policy*; the machine-readable spec + automated breaking-change detection is the *enforcement*. Together they let you evolve a public API confidently without the recurring nightmare of silently breaking clients — closing the loop between documentation, contracts, and every versioning decision in this primer.
## API Security

### Summary

**What this topic covers**

API security is where most real breaches actually happen — not in exotic cryptographic flaws but in boring authorization mistakes. This topic is organized around the **OWASP API Security Top 10**, the industry consensus list of how APIs get owned. Three concern areas live here: (1) **authorization** — who is allowed to touch which object and which function, covering BOLA/IDOR (the #1 risk), broken function-level authorization, and broken authentication; (2) **data handling** — excessive data exposure, mass assignment, input validation, and injection, i.e. what you leak out and what you let in; and (3) **configuration & transport** — security misconfiguration, CORS, TLS everywhere, secrets in URLs, security headers, and missing rate limiting as a security control. The 16 questions here lean hard on "spot the vulnerability in this endpoint" scenarios, because that is exactly how the interview (and the pentest) probes whether you think about security by default or bolt it on afterward. This is about designing the API so the insecure path is the hard path.

**Mental model**

Assume every request is hostile and every client is an attacker holding a valid token. The single most important shift is: **authentication is not authorization**. Authentication answers "who are you" (a valid login); authorization answers "are you allowed to do *this* to *this specific object*". BOLA happens because developers check the first and forget the second — they trust an ID in the URL because the caller is logged in. So for every endpoint, ask two questions on every object reference: is this caller authenticated, and does this caller *own or have a grant to* the object identified by `usr_123`/`order_456`? Enforce that check server-side, on the object, on every request — never trust the client to only send IDs it should see. The second mental habit is **default-deny and explicit allowlists**: allowlist which fields a client can set (mass assignment), which origins can call you (CORS), which fields you serialize out (data exposure). Denylists always miss a case; allowlists fail closed.

**Key terms**

- **BOLA / IDOR** — Broken Object-Level Authorization (a.k.a. Insecure Direct Object Reference): accessing another user's object by changing an ID. OWASP API #1.
- **BFLA** — Broken Function-Level Authorization: a regular user calling an admin-only operation (e.g. `DELETE /v1/users/{id}`) that was never authz-checked.
- **Excessive data exposure** — returning full internal objects and relying on the client to hide fields; the API leaks `password_hash`, `ssn`, internal flags.
- **Mass assignment** — binding a request body straight onto a model so a client can set fields it shouldn't (`is_admin`, `balance`).
- **Injection** — untrusted input interpreted as code/query (SQL, NoSQL, OS command, LDAP).
- **Security misconfiguration** — verbose stack traces, default creds, open cloud buckets, missing headers, debug endpoints in prod.
- **CORS** — browser mechanism controlling which web origins may read cross-origin API responses; a same-origin-policy relaxation, not an authz mechanism.
- **CSRF** — forcing an authenticated browser to make a state-changing request; relevant to cookie-auth APIs, not bearer-token APIs.
- **Idempotency of authz** — every request re-checks authorization; there is no "trusted session" that skips the check.
- **Secrets in URLs** — API keys/tokens in query strings leak into logs, proxies, browser history, and `Referer` headers.

**Why interviewers ask this**

Security separates the engineer who ships features from the engineer you can trust with a public API. The junior tell is conflating auth-n with auth-z: "the user is logged in, so they can see the order." The senior signal is reflexively asking "whose order?" and describing the server-side ownership check. Interviewers also probe whether you know that the most common, most damaging API bugs are *authorization* bugs, not injection or crypto — BOLA tops the OWASP list because it is everywhere and trivially exploitable. A strong candidate reaches for allowlists over denylists, treats rate limiting as a security control (credential stuffing, enumeration, scraping), knows CORS does not protect your API from non-browser clients, and can look at a concrete endpoint and name the flaw. Weak candidates recite "use HTTPS and validate input" and stop.

**Common confusions**

- "If it's authenticated, it's secure" — no. BOLA/BFLA are authorization failures on authenticated requests. A valid token is the *start* of the check, not the end.
- "CORS protects my API" — CORS is a browser policy that governs what *browser JS* can read cross-origin. It does nothing against `curl`, Postman, or a mobile app. It is not an authorization mechanism.
- "UUIDs fix IDOR" — unguessable IDs are defense-in-depth, not authorization. If the endpoint doesn't check ownership, leaked/enumerated UUIDs still grant access.
- "Rate limiting is a performance concern" — it is also a security control against brute force, credential stuffing, and enumeration.
- "We validate on the client" — client validation is UX; the server must revalidate everything. The client is attacker-controlled.
- "HTTPS means we're encrypted so we're safe" — TLS protects data in transit only; it says nothing about authz, injection, or data exposure.

**What follows from this topic**

Security threads through every other API topic. Rate limiting appears here as a security control and in its own right for fairness/capacity. Auth (OAuth/JWT/scopes) is the machinery BOLA/BFLA depend on. Webhooks bring their own security surface — signature verification and SSRF — covered in Webhooks & Callbacks. Error design intersects here: leak too much in an error body and you hand attackers a map. Treat this topic as the lens you re-read every other design decision through.

### Q1. What is BOLA/IDOR and why is it the #1 API security risk? Show a concrete example and fix.

BOLA (Broken Object-Level Authorization), historically called IDOR (Insecure Direct Object Reference), is when an API exposes an object identifier and fails to check that the *caller is allowed to access that specific object*. The request is authenticated — the attacker has a valid token — but the server never verifies ownership.

It tops the OWASP API list because it is ubiquitous and trivial to exploit: change a number in a URL.

```http
GET /v1/orders/1001 HTTP/1.1
Authorization: Bearer <alice's valid token>
```

```javascript
// BAD — authenticated but not authorized. Alice can read Bob's order.
app.get('/v1/orders/:id', requireAuth, async (req, res) => {
  const order = await db.orders.findById(req.params.id);
  res.json(order);
});
```

Alice changes `1001` to `1002` and reads Bob's order. The fix is a server-side ownership check on every request:

```javascript
// GOOD — scope the lookup to the authenticated principal.
app.get('/v1/orders/:id', requireAuth, async (req, res) => {
  const order = await db.orders.findOne({ id: req.params.id, ownerId: req.user.id });
  if (!order) return res.sendStatus(404); // 404, not 403 — don't confirm existence
  res.json(order);
});
```

Key points: scope the query by owner (or check an explicit grant/ACL), do it on *every* object-touching endpoint including nested ones (`/v1/orders/1001/items/5`), and return `404` rather than `403` so you don't leak that the object exists. Unguessable IDs help but are not a substitute for the check.

### Q2. What is the difference between authentication and authorization, and why does the distinction matter for API security?

**Authentication** establishes *who the caller is* — validating a token, key, or credential. **Authorization** establishes *what that caller may do* — to which functions and which specific objects.

The distinction is the single most important idea in API security because the most common breaches (BOLA, BFLA) are authorization failures on *authenticated* requests. A valid bearer token proves identity; it says nothing about whether that identity owns `order_456` or may call `DELETE /v1/users/{id}`.

Design implication: authentication is typically one gate at the edge (middleware verifies the token). Authorization is *many* checks, deep in the handler, on every object and every privileged function. You cannot centralize object-level authz in edge middleware because the middleware doesn't know which object the request targets. Junior candidates check the token and stop; senior candidates ask "authenticated as whom, and authorized to touch *this* object?"

### Q3. What is excessive data exposure and how do you prevent it?

Excessive data exposure is returning the full internal object and trusting the *client* to filter out sensitive fields. The classic pattern: a user endpoint serializes the whole DB row.

```json
{
  "id": "usr_123",
  "name": "alice",
  "email": "alice@example.com",
  "password_hash": "$2b$...",
  "is_admin": false,
  "internal_risk_score": 87,
  "reset_token": "a1b2c3"
}
```

The mobile UI only shows name and email, so nobody noticed — but the data is on the wire and any client can read it.

Fix: never serialize models directly. Define an explicit **response DTO / schema allowlist** — you opt fields *in*, not out.

```javascript
// GOOD — explicit output shape; new DB columns never auto-leak.
function toPublicUser(u) {
  return { id: u.id, name: u.name, email: u.email };
}
```

Allowlisting (opt-in) beats denylisting (opt-out) because when someone adds a `password_reset_token` column next quarter, an allowlist doesn't leak it by default. Enforce it with response schemas (OpenAPI + serializer), and consider linting to ban returning raw ORM objects.

### Q4. What is mass assignment and how do you defend against it?

Mass assignment is binding a request body directly onto a model, letting a client set fields it should never control.

```http
PATCH /v1/users/usr_123 HTTP/1.1
Content-Type: application/json

{ "name": "alice", "is_admin": true, "account_balance": 999999 }
```

```javascript
// BAD — blindly merges attacker-controlled fields onto the record.
await db.users.update(req.params.id, req.body);
```

The user upgrades themselves to admin. The fix is an **input allowlist**: bind only the fields this operation is permitted to change.

```javascript
// GOOD — pick permitted fields explicitly.
const { name, email } = req.body;
await db.users.update({ id: req.params.id, ownerId: req.user.id }, { name, email });
```

Never spread `req.body` into a model. Use a strict input schema (`additionalProperties: false` in JSON Schema / OpenAPI) so unexpected fields are rejected, and keep privileged fields (`is_admin`, `balance`, `owner_id`, `verified`) off the writable path entirely — those change through dedicated, separately-authorized endpoints.

### Q5. How do you prevent injection vulnerabilities in an API?

Injection happens when untrusted input is interpreted as code — SQL, NoSQL, OS command, LDAP. Even in 2026 it stays on the OWASP list.

The rule is **never build a query by string concatenation**. Use parameterized queries / prepared statements so data can never be parsed as code.

```javascript
// BAD — SQL injection: input "'; DROP TABLE orders; --"
db.query(`SELECT * FROM orders WHERE status = '${req.query.status}'`);

// GOOD — parameterized; the driver binds the value, never parses it as SQL.
db.query('SELECT * FROM orders WHERE status = $1', [req.query.status]);
```

Beyond SQL: for NoSQL, reject query operators in user input (a JSON body `{ "$gt": "" }` can bypass filters); for OS commands, avoid shelling out — use library APIs, and if you must, pass args as an array, never a shell string. Layer defense: strict input validation (types, enums, lengths), least-privilege DB accounts, and output encoding where relevant. Parameterization is the primary control; validation is defense-in-depth.

### Q6. What is broken function-level authorization (BFLA) and how does it differ from BOLA?

BOLA is about *objects* — accessing someone else's `order_456`. BFLA is about *functions/operations* — a regular user invoking an operation reserved for admins or another role.

```http
# A normal user calls an admin-only endpoint that was never role-checked:
DELETE /v1/users/usr_999 HTTP/1.1
Authorization: Bearer <regular user token>
```

It often shows up when admin routes are "hidden" in the UI but not protected on the server, or when a `POST` is guarded but the parallel `DELETE`/`PUT` on the same resource is forgotten. Attackers enumerate HTTP methods and admin paths.

Fix: enforce role/scope checks server-side on every privileged operation, default-deny, and prefer a declarative policy (RBAC/ABAC, or scopes on the token) checked in middleware per-route rather than ad-hoc `if (user.isAdmin)` scattered around. Test the matrix: for each role, which methods on which routes are allowed. Never rely on UI hiding.

### Q7. Spot the vulnerabilities in this endpoint.

```javascript
app.post('/v1/users/:id/profile', (req, res) => {
  const user = db.users.findById(req.params.id);
  Object.assign(user, req.body);
  db.users.save(user);
  res.json(user);
});
```

Multiple flaws stacked in six lines:

1. **No authentication** — no token check at all; anyone can call it.
2. **BOLA** — even with auth, `:id` isn't scoped to the caller; you can edit any user.
3. **Mass assignment** — `Object.assign(user, req.body)` lets the caller set `is_admin`, `password_hash`, anything.
4. **Excessive data exposure** — it returns the full `user`, including sensitive fields.
5. **No input validation** — arbitrary body, arbitrary types.

Fixed version:

```javascript
app.post('/v1/users/:id/profile', requireAuth, validate(profileSchema), (req, res) => {
  if (req.params.id !== req.user.id) return res.sendStatus(404); // ownership
  const { displayName, bio } = req.body;                         // input allowlist
  const user = db.users.update(req.user.id, { displayName, bio });
  res.json(toPublicUser(user));                                  // output allowlist
});
```

Naming all five flaws — and that they are independent — is the signal the interviewer wants.

### Q8. How should CORS be configured, and what does it actually protect?

CORS (Cross-Origin Resource Sharing) is a **browser** mechanism: it tells the browser which web origins are allowed to *read* cross-origin responses from your API. It is not an authorization mechanism and does nothing against non-browser clients (`curl`, mobile, server-to-server).

Do it right — reflect from an allowlist, don't wildcard-with-credentials:

```javascript
// GOOD — explicit origin allowlist; credentials only for trusted origins.
const allowed = new Set(['https://app.example.com', 'https://admin.example.com']);
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (allowed.has(origin)) {
    res.set('Access-Control-Allow-Origin', origin);      // echo the specific origin
    res.set('Access-Control-Allow-Credentials', 'true');
    res.set('Vary', 'Origin');                            // don't poison the cache
  }
  next();
});
```

Anti-patterns: `Access-Control-Allow-Origin: *` combined with `Allow-Credentials: true` (browsers forbid it, and reflecting *any* origin with credentials is a serious hole); reflecting `req.headers.origin` unconditionally. Remember: a permissive CORS policy is a risk for *browser* users, but a *restrictive* one is not a security boundary for your data — the server-side authz checks are.

### Q9. What security-relevant HTTP headers should an API set?

For a JSON API the header story is smaller than for a web page, but several matter:

- **`Strict-Transport-Security`** (HSTS) — force HTTPS, prevent downgrade: `max-age=63072000; includeSubDomains`.
- **`Content-Type: application/json`** on responses, and reject unexpected request content types — helps prevent content sniffing and some injection vectors.
- **`X-Content-Type-Options: nosniff`** — stop MIME sniffing.
- **`Cache-Control: no-store`** on responses containing sensitive/authenticated data so tokens/PII aren't cached by proxies or the browser.
- **CORS headers** — as above, from an allowlist.

For any endpoint that returns HTML or is embeddable, add `Content-Security-Policy` and `X-Frame-Options: DENY`. What you should *not* send: verbose `Server`/`X-Powered-By` version banners (information disclosure) or stack traces in error bodies. The senior point: headers are defense-in-depth; they don't replace authz and validation.

### Q10. Why should secrets never appear in URLs, and what should you do instead?

Query strings and path segments leak. A URL like `GET /v1/orders?api_key=sk_live_abc123` ends up in server access logs, proxy logs, CDN logs, browser history, and — worst — the `Referer` header sent to third-party sites when the page loads external resources. TLS does *not* help: the URL is logged at both ends and by intermediaries that terminate TLS.

Put secrets in the **`Authorization` header** instead:

```http
GET /v1/orders HTTP/1.1
Authorization: Bearer sk_live_abc123
```

Headers aren't logged by default, aren't in history, and aren't sent in `Referer`. Same rule for tokens in webhooks and reset links — prefer a short-lived, single-use token in the body or a header over a long-lived secret in a URL. If a secret does hit a URL, treat it as compromised and rotate it. This is a small design choice with a large blast radius.

### Q11. Why is TLS "everywhere" non-negotiable, and what does it not cover?

TLS (HTTPS) encrypts data in transit, authenticates the server, and prevents tampering and passive interception. "Everywhere" means: no plaintext fallback, HSTS to prevent downgrade, TLS on *internal* service-to-service hops too (not just the edge), and modern versions only (TLS 1.2+/1.3, no SSLv3/TLS 1.0). Redirect HTTP→HTTPS but still send HSTS so the first request is protected next time.

What TLS does **not** do: it says nothing about authorization (BOLA is a TLS-encrypted request), nothing about injection, nothing about excessive data exposure, and nothing about a stolen token — a valid token over TLS is still valid for the thief. The confusion "we're on HTTPS so we're secure" is exactly the trap. TLS is table stakes for *transport*; the application-layer controls are separate and equally required.

### Q12. How does rate limiting function as a security control?

Beyond fairness and capacity, rate limiting blunts a whole class of attacks:

- **Credential stuffing / brute force** — cap login attempts per account and per IP; add exponential backoff and lockout.
- **Enumeration** — cap requests that probe object existence (`GET /v1/users/{id}`), so attackers can't sweep the ID space; combine with returning `404` uniformly.
- **Scraping / data harvesting** — per-key quotas on list endpoints.
- **Resource-exhaustion DoS** — cap expensive operations (report generation, search).

Return `429 Too Many Requests` with `Retry-After`, and apply limits per authenticated principal (per key) *and* per IP, since one attacker can rotate accounts or IPs. OWASP lists "unrestricted resource consumption" precisely because a missing limit turns one endpoint into a DoS or enumeration vector. Also bound request *size* and pagination `limit` — an attacker asking for `?limit=10000000` is a resource attack.

### Q13. What is security misconfiguration and what are the common cases in APIs?

Security misconfiguration is the catch-all for insecure defaults and operational sloppiness. Common API cases:

- **Verbose errors** — stack traces, SQL errors, framework versions returned to clients. Map to generic messages; log details server-side.
- **Debug/admin endpoints in prod** — `/debug`, `/actuator`, GraphQL introspection or a playground left enabled publicly.
- **Default credentials** — unchanged admin passwords, default API keys.
- **Overly permissive CORS** — reflecting any origin.
- **Missing headers** — no HSTS, no `nosniff`.
- **Open cloud resources** — public S3 buckets holding API data, unauthenticated internal services exposed.
- **Unpatched dependencies** — known-CVE libraries.

The fix is a hardened, repeatable configuration baseline (infrastructure-as-code), a "prod ≠ dev" checklist (disable introspection, debug, verbose errors), automated config/dependency scanning, and least privilege everywhere. It's boring and it's how most real incidents start.

### Q14. Why is client-side validation never sufficient, and how should server validation work?

Client validation is a UX affordance — fast feedback, fewer round-trips. It provides **zero** security because the client is fully attacker-controlled: anyone can bypass the browser and hit the API directly with any payload.

The server must **revalidate everything**, treating input as hostile:

- **Type and shape** — enforce a schema (JSON Schema / OpenAPI request validation), reject unknown fields (`additionalProperties: false`, which also blocks mass assignment).
- **Bounds** — string lengths, numeric ranges, array sizes, pagination limits.
- **Domain rules** — enums, formats (email, UUID), referential checks.
- **Canonicalize then validate** — normalize encoding before checking, so `%2e%2e` tricks fail.

```javascript
app.post('/v1/orders', validate(orderSchema), handler); // reject before business logic
```

Fail fast with a `400`/`422` and a structured error. The senior framing: validation is both a correctness control and a security control (it feeds injection and mass-assignment defenses), and it must live at the trust boundary — the server — not the client.

### Q15. Design the authentication and authorization for a public API. What would you use and why?

For a public API I'd separate the concerns:

**Authentication (who):** issue **API keys** for server-to-server identification (simple, revocable, scoped per key), and **OAuth 2.0 + OIDC** where a user delegates access to a third-party app (authorization code flow with PKCE for user-facing clients). Access tokens as short-lived JWTs or opaque tokens; refresh tokens for renewal. Always `Authorization: Bearer`, never secrets in URLs.

**Authorization (what):** attach **scopes** to tokens (`orders:read`, `orders:write`) checked per-endpoint (prevents BFLA), plus **object-level ownership checks** in every handler (prevents BOLA). Scopes gate the *function*; ownership gates the *object* — you need both.

**Supporting controls:** per-key **rate limits and quotas** by tier; **TLS everywhere** + HSTS; **rotation and revocation** for keys and tokens (JWT's revocation weakness is why I keep access-token lifetimes short and back them with a revocation/introspection check for high-value operations); **audit logging** of privileged actions.

The design principle throughout: default-deny, least-privilege scopes, and never conflate "authenticated" with "authorized."

### Q16. Design a secure "reset password" flow and name the pitfalls it must avoid.

A reset flow is a magnet for security bugs; the design has to fail closed at each step.

```text
1. POST /v1/password-reset { email }
     -> ALWAYS respond 202 "if the account exists, we've sent a link"
        (no account-enumeration signal)
     -> generate a high-entropy, single-use token; store only its HASH + short TTL
2. Email a link with the token (in the body/path of a one-time URL, treated as a secret)
3. POST /v1/password-reset/confirm { token, new_password }
     -> look up by hashed token, check TTL + unused, then rotate
     -> invalidate the token (single use) and all existing sessions
```

Pitfalls to avoid: **account enumeration** (step 1 must respond identically whether or not the email exists); **storing raw tokens** (store a hash so a DB leak doesn't grant resets); **long-lived or reusable tokens** (short TTL, single use); **weak entropy** (use a CSPRNG); **not invalidating sessions** after reset (a thief with an active session stays in); **rate limiting** the request endpoint (else it's a spam/enumeration vector); and **no secrets beyond the one-time token** in logs. This one flow exercises injection-free storage, enumeration defense, secret handling, and rate limiting at once — which is why interviewers like it.

## Performance & Caching

### Summary

**What this topic covers**

This topic is about making APIs fast and cheap without breaking correctness — from the *API design* angle, not the network-plumbing angle (Networking owns TCP/TLS/HTTP-2 mechanics; System Design owns CDNs-as-infrastructure and datastore scaling). The 16 questions cluster into three concerns: (1) **HTTP caching as a contract** — `Cache-Control`, `ETag`/conditional requests, `304 Not Modified`, and where the cache lives (client, CDN/edge, server); (2) **payload efficiency** — compression (gzip/brotli), field selection / sparse fieldsets, response minimization, and avoiding over-fetching; and (3) **interaction efficiency** — batching, eliminating chatty/N+1 API call patterns, connection reuse (HTTP/2, keep-alive), and reasoning about latency budgets. Running through all of it is one senior skill: knowing *when not to cache*. Caching is the classic source of "impossible" bugs — stale data, cache poisoning, users seeing each other's private responses — so the design must be as deliberate about correctness as about speed.

**Mental model**

Think of every response as carrying **freshness metadata** that tells caches how to behave. Two questions define the caching story for an endpoint: *how long is this fresh* (freshness — `Cache-Control: max-age`) and *how do I cheaply check if my copy is still good* (validation — `ETag` + `If-None-Match` → `304`). Freshness avoids the round-trip entirely; validation avoids re-sending the *body* when nothing changed. Layer that across a hierarchy of caches — browser/client, then a shared CDN/edge, then server-side (application cache, Redis) — each closer layer being faster and cheaper but harder to invalidate. The other mental model is the **latency budget**: a user-facing request has a time budget (say 200ms), and every hop, DB call, and serialized byte spends it. The two biggest wins are usually structural, not micro-optimizations: (1) don't make N calls where 1 would do (batching, avoiding N+1), and (2) don't send bytes the client doesn't need (compression + field selection). Measure first — cache the hot, expensive, cacheable paths; leave the rest alone.

**Key terms**

- **`Cache-Control`** — the primary caching directive: `max-age`, `s-maxage` (shared caches), `public`/`private`, `no-cache` (revalidate before use), `no-store` (never cache), `must-revalidate`.
- **`ETag`** — an opaque version identifier for a representation; strong vs weak (`W/"..."`).
- **Conditional request** — `If-None-Match: <etag>` (GET) or `If-Match` (writes); lets the server answer `304`/`412` instead of re-sending.
- **`304 Not Modified`** — "your cached copy is still valid"; no body, saves bandwidth.
- **`Vary`** — which request headers change the response (e.g. `Accept-Encoding`, `Authorization`); prevents serving the wrong cached variant.
- **CDN / edge cache** — a shared cache near the user; keyed by URL (+`Vary`), great for public, cacheable responses.
- **Field selection / sparse fieldset** — client asks for a subset (`?fields=id,name`) to shrink payloads.
- **N+1 / chatty API** — one call that forces N follow-up calls; the top cause of client-perceived slowness.
- **Compression** — `gzip`/`brotli`, negotiated via `Accept-Encoding`; big win on text/JSON.
- **Cache invalidation** — expiring or purging stale entries; "one of the two hard things."

**Why interviewers ask this**

Performance questions reveal whether you understand the HTTP caching model or just sprinkle Redis on things. The junior answer to "make this API faster" is "add a cache"; the senior answer starts with "measure where the time goes, then decide *what* to cache, *where*, and *how it gets invalidated* — and confirm the data is safe to cache at all." Interviewers watch for the correctness instinct: does the candidate flag that caching an authenticated, per-user response in a shared CDN leaks data across users? Do they distinguish freshness (skip the request) from validation (skip the body)? Can they spot an N+1 pattern and fix it with batching or an expansion parameter rather than more caching? The strongest signal is treating caching as a *contract* with defined invalidation, plus knowing the endpoints where caching is the wrong tool.

**Common confusions**

- "Caching always makes things faster" — a poorly-invalidated cache makes things *wrong*, and caching uncacheable (rapidly-changing, per-user, or write-heavy) data adds complexity for no gain.
- "`no-cache` means don't cache" — `no-cache` means *cache but revalidate before use*; `no-store` means don't store at all.
- "`ETag` and `Cache-Control` do the same job" — `Cache-Control` controls *freshness* (whether to ask at all); `ETag` controls *validation* (a cheap "is my copy still good"). They compose.
- "A CDN can cache anything" — only responses safe for *shared* caching. Anything keyed on `Authorization` must be `private`/`no-store` or you leak data.
- "Compression is automatic" — it must be negotiated and enabled; and don't compress already-compressed payloads or you waste CPU.
- "More caching fixes chatty APIs" — the real fix is fewer, coarser calls (batching, expansions), not caching each of the many.

**What follows from this topic**

Caching leans on HTTP semantics and versioning (an `ETag` is a representation version; a `/v2` is a contract version). Conditional requests reappear as an optimistic-concurrency tool (`If-Match` on writes) and connect to idempotency. Field selection overlaps with GraphQL's over/under-fetching story and REST sparse fieldsets. `Cache-Control: no-store` is also a security control for sensitive responses, tying back to API Security. And "measure before optimizing" is the governance thread — you can't tune what you don't observe.

### Q1. How does HTTP caching work for an API, and what are the key `Cache-Control` directives?

HTTP caching answers two independent questions: **is my copy fresh** (freshness) and, if not, **is it still valid** (validation). `Cache-Control` drives freshness.

Key directives:

- **`public`** — any cache (including CDNs) may store it.
- **`private`** — only the end client (browser) may cache; shared caches must not. Use for per-user responses.
- **`max-age=<s>`** — fresh for N seconds; serve from cache without asking.
- **`s-maxage=<s>`** — overrides `max-age` for *shared* caches (CDN) specifically.
- **`no-cache`** — may store, but must revalidate with the origin before serving.
- **`no-store`** — never store anywhere (sensitive data).
- **`must-revalidate`** — once stale, don't serve without revalidating.

```http
HTTP/1.1 200 OK
Cache-Control: public, max-age=300, s-maxage=3600
ETag: "v42"
```

This says: clients cache 5 min, CDNs cache 1 hour, and after that revalidate against the `ETag`. For a per-user endpoint you'd instead send `Cache-Control: private, no-cache` (or `no-store` if sensitive). Getting `public` vs `private` right is a correctness/security decision, not just perf.

### Q2. Explain ETags and conditional requests. What problem does `304 Not Modified` solve?

An **ETag** is an opaque version tag the server attaches to a representation. On the next request the client sends it back in `If-None-Match`; if the resource hasn't changed, the server replies `304` with *no body*.

```http
# First response:
HTTP/1.1 200 OK
ETag: "abc123"
Cache-Control: no-cache

{ "id": "order_1", "status": "shipped", ... }

# Client revalidates later:
GET /v1/orders/order_1 HTTP/1.1
If-None-Match: "abc123"

# Nothing changed:
HTTP/1.1 304 Not Modified
ETag: "abc123"
```

The win: freshness (`max-age`) skips the request entirely, but when you *must* check (`no-cache`), validation lets you skip re-sending the *body* — you pay one round-trip and a tiny header exchange instead of transferring a large JSON payload. `304` saves bandwidth and serialization, not the round-trip.

Strong ETags mean byte-identical; weak (`W/"abc"`) means semantically equivalent. The same ETag mechanism, via `If-Match` on writes, gives you optimistic concurrency (`412 Precondition Failed` on conflict).

### Q3. Where can API responses be cached, and what are the tradeoffs of each layer?

Three layers, from far to near the client:

| Layer | Speed | Invalidation | Good for |
|---|---|---|---|
| **Server-side** (Redis/app cache) | Fast, one hop away | You control it — easy | Expensive computations, DB query results, shared across users |
| **CDN / edge** | Very fast, near user | Hard — purge APIs, TTLs | Public, cacheable, high-read responses |
| **Client** (browser/app) | Instant, no network | Hardest — you can't reach it | Per-user data, offline, reducing requests |

Tradeoff: the closer to the user, the faster and cheaper the hit, but the harder to invalidate — you can purge your Redis instantly, but you can't reach a value already in a user's browser (you can only set short TTLs / use revalidation). So put *volatile* data in server-side caches where you can evict, and use short `max-age` + `ETag` revalidation for client/edge layers. Never put per-user/authenticated data in a *shared* (CDN) cache without `private`/`Vary: Authorization`, or users see each other's data.

### Q4. Cache invalidation is famously hard. What strategies do you use?

The two workable strategies are **TTL (expiry)** and **explicit invalidation**, usually combined.

- **TTL / `max-age`** — data auto-expires after N seconds. Simple, self-healing, but serves stale data within the window. Pick the TTL from the data's tolerance for staleness (a product catalog: minutes; a stock price: seconds or don't cache).
- **Explicit purge** — on write, evict/update the affected keys (write-through or purge the CDN via its API). Precise, but you must know every key a change affects, and distributed purges have lag.
- **Versioned keys / cache-busting** — bake a version into the key or URL so a new version is a new entry and the old one just ages out. Avoids the invalidation problem by never mutating a key.
- **ETag revalidation** — don't prevent staleness; make checking cheap, so a stale entry costs one `304` to refresh.

In practice: short TTL as a safety net, explicit purge for correctness on writes, and `ETag` so revalidation is cheap. Accept that "instantly consistent everywhere" and "cached" are in tension — choose the staleness the domain tolerates.

### Q5. How and when should you compress API responses?

Compress text payloads (JSON, XML, HTML, CSV) — they shrink 60–80%, directly cutting transfer time. It's negotiated: the client advertises `Accept-Encoding: gzip, br`, the server picks one and marks it.

```http
# Request
Accept-Encoding: br, gzip

# Response
Content-Encoding: br
Vary: Accept-Encoding
```

**gzip** is universal and cheap; **brotli (`br`)** compresses better (esp. for text) at similar cost and is well-supported — prefer `br`, fall back to `gzip`. Set `Vary: Accept-Encoding` so caches don't serve a brotli body to a client that only speaks gzip.

When *not* to compress: already-compressed payloads (images, video, PDFs, `.zip`) — you burn CPU for no gain. Also be aware compressing sensitive, attacker-influenced responses over TLS has a theoretical side-channel (BREACH-style) — usually mitigated at other layers, worth knowing. And very small payloads (< ~1KB) may not be worth the overhead. Often compression is handled at the gateway/CDN rather than the app.

### Q6. What is field selection / sparse fieldsets and why does it matter for performance?

Field selection lets clients request only the fields they need, shrinking payloads and server work.

```http
# Full object is 30 fields; the list view needs 3:
GET /v1/users?fields=id,name,avatar_url HTTP/1.1
```

```json
{ "data": [ { "id": "usr_1", "name": "alice", "avatar_url": "..." } ] }
```

Why it matters: mobile clients on slow networks pay for every byte, and a list of 100 users returning 30 fields each is mostly waste. Sparse fieldsets cut transfer size, serialization cost, and sometimes DB columns fetched. It's REST's answer to over-fetching — the same problem GraphQL solves by design (the client's query *is* the field selection).

Design notes: define a sensible default field set (don't force clients to always list fields), validate requested fields against an allowlist (an unbounded `fields` param is both a footgun and a mild injection/enumeration surface), and pair it with **expansions** (`?expand=account`) so clients can pull related resources in one call instead of N follow-ups — which leads into batching.

### Q7. What is a chatty API / N+1 problem at the API layer, and how do you fix it?

A chatty API forces the client to make many small calls to assemble one view. The classic **N+1**: fetch a list (1 call), then fetch each item's detail (N calls).

```text
GET /v1/orders            -> [order_1 ... order_20]   (1 call)
GET /v1/orders/order_1    -> {...}                     (call 2)
GET /v1/orders/order_2    -> {...}                     (call 3)
...                                                     (21 calls total)
```

Each call pays full latency (DNS/TLS amortized, but round-trip + auth + serialization every time). On a 100ms-latency link, 21 sequential calls ≈ 2.1s.

Fixes, in order of preference:
- **Return enough in the list** — include the fields the next view needs so the follow-ups vanish.
- **Expansions / embedding** — `GET /v1/orders?expand=customer,items` returns related data in one response.
- **Batch endpoints** — `POST /v1/orders/batch-get { ids: [...] }` fetches many by ID in one call.
- **GraphQL** — the client asks for the whole graph in one query (server resolves N+1 internally with DataLoader).

The principle: design endpoints around *client use cases / views*, not around raw entities, so common screens are one round-trip.

### Q8. How do you design a batch endpoint, and what are the pitfalls?

A batch endpoint collapses many operations into one request to kill round-trips.

```http
POST /v1/products/batch-get HTTP/1.1
Content-Type: application/json

{ "ids": ["prd_1", "prd_2", "prd_3"] }
```

```json
{
  "results": [
    { "id": "prd_1", "status": 200, "data": { "name": "Widget" } },
    { "id": "prd_2", "status": 404, "error": "not_found" },
    { "id": "prd_3", "status": 200, "data": { "name": "Gadget" } }
  ]
}
```

Design decisions and pitfalls:
- **Partial failure** — return per-item status; don't fail the whole batch because one item 404s. The overall HTTP status is usually `200` (or `207 Multi-Status`) with per-item results.
- **Ordering & correlation** — echo the id/index so the client can map results back.
- **Bounds** — cap batch size (e.g. 100) to prevent a resource-exhaustion attack (`?ids=[10000 items]`).
- **Idempotency & method** — batch-*read* is fine as POST-with-a-body; batch-*write* needs idempotency keys and clear semantics (all-or-nothing vs best-effort).
- **Auth** — authorize each item individually (batch is a common BOLA hiding spot — don't skip per-object checks).

Batching trades a little API-shape ugliness (POST for a read) for a large latency win.

### Q9. How do HTTP/2 and connection reuse (keep-alive) affect API performance?

Under HTTP/1.1 each connection handles one request at a time, and opening a connection costs a TCP handshake + TLS negotiation (multiple round-trips). **Keep-alive** reuses one connection for many sequential requests, amortizing that setup — essential; never open a fresh connection per call.

**HTTP/2** goes further with **multiplexing**: many concurrent requests share one connection, interleaved as independent streams, eliminating HTTP/1.1's head-of-line blocking at the app layer and the need for domain sharding / connection pools. It also adds header compression (HPACK) and server push (largely deprecated now). For a chatty client, HTTP/2 makes the N parallel calls far cheaper — though it does *not* remove the server-side N+1 work; it just removes the connection overhead.

Practical takeaways: enable keep-alive and HTTP/2 at the edge; on the client, reuse a connection pool / HTTP client rather than creating one per request; and know that HTTP/2 reduces the *penalty* of chatty APIs but batching/expansions still win because they cut server work and total bytes, not just connection cost.

### Q10. What is a latency budget and how do you reason about it?

A latency budget is the total time a user-facing request is allowed to take (say a 200ms p95 target), which you *decompose* across everything that spends it:

```text
200ms budget for GET /v1/dashboard:
  network round-trip        ~40ms
  gateway/auth              ~10ms
  service logic             ~20ms
  DB query (x2)             ~60ms
  downstream API call       ~50ms
  serialization + gzip      ~10ms
  --------------------------------
  ~190ms  (10ms headroom)
```

Reasoning this way tells you *where* to optimize: the DB and the downstream call dominate, so caching the downstream result or parallelizing the two DB queries buys the most; shaving serialization does little. It also exposes **fan-out risk** — if the request makes N sequential downstream calls, the budget is the *sum*; parallelize independent calls so it's the *max* instead. Track it with tail latency (p95/p99), not averages, because averages hide the slow requests users actually complain about. Budgets turn "make it fast" into a measurable, allocatable engineering problem — measure first, then spend effort where the milliseconds are.

### Q11. Server-side caching vs client caching — when do you use each?

They solve different problems:

**Server-side caching** (Redis, in-process, or the DB's own): caches *expensive-to-produce* data — a slow aggregation, a heavy DB query, a downstream API result — and shares it across *all* users. You fully control invalidation, so it's safe for volatile data. Use it to protect your backend from load and to hit latency budgets.

**Client caching** (HTTP `Cache-Control`/`ETag` in the browser or app): eliminates the *request itself*, saving network latency and server load. You *can't* invalidate it directly (you can only set TTLs and offer cheap revalidation), so use it for data that tolerates staleness or per-user data you don't want on a shared cache.

They compose: server-side cache to make the response cheap to produce, HTTP caching to avoid asking for it again. A common stack: Redis behind the service (invalidatable), `Cache-Control: private, max-age=60` + `ETag` toward the client (revalidatable), and a CDN with `s-maxage` for the genuinely public, high-read endpoints. Match the tool to whether you need *shareability*, *invalidation control*, or *request elimination*.

### Q12. When should you NOT cache an API response?

Caching is the wrong tool when it adds risk or complexity without payoff:

- **Highly volatile data** — if it changes every request (real-time price, live inventory), any cache is stale on arrival. `no-store`.
- **Per-user / authenticated responses in *shared* caches** — caching a response keyed on `Authorization` in a CDN leaks one user's data to another. Either `private`, or `Vary: Authorization` (which usually kills the shared-cache benefit anyway).
- **Sensitive data** — tokens, PII, financial details: `Cache-Control: no-store` so it isn't written to disk by proxies/browsers (a security requirement, not just perf).
- **Write responses / non-idempotent results** — `POST` results, one-time confirmations.
- **Low-traffic endpoints** — if a path is hit rarely, the cache is cold more often than warm; you pay complexity for near-zero hit rate.
- **Strong-consistency requirements** — if a stale read causes a correctness bug (bank balance before a transfer), don't cache, or cache with explicit purge-on-write.

The senior instinct is to *justify* a cache (what's the hit rate, staleness tolerance, invalidation plan, and is the data shareable) rather than reach for one reflexively.

### Q13. How do you make a response cacheable at the CDN/edge safely?

To let a CDN cache a response you must make it **safe for shared caching** and give it clear freshness:

```http
HTTP/1.1 200 OK
Cache-Control: public, s-maxage=600, max-age=60
ETag: "cat-v88"
Vary: Accept-Encoding
```

Requirements:
- **`public`** and no dependence on `Authorization` — the response must be identical for all users, or you'll serve one user's data to another. If it varies by user, don't edge-cache it.
- **`s-maxage`** to control the shared-cache TTL independently of the browser.
- **`Vary`** on every request header that changes the body (`Accept-Encoding`, `Accept` for content negotiation) — but *avoid* `Vary: Authorization` at the edge, since that fragments the cache per user and defeats the point.
- **Purge strategy** — use the CDN's purge API on writes for correctness, backed by a short `s-maxage`.
- **Idempotent + `GET`** — only cache safe methods.

Great edge-cache candidates: public catalogs, reference data, config, published content. Anything user-specific belongs in `private` client caches or an invalidatable server-side cache instead.

### Q14. Spot the caching bug in this response.

```http
GET /v1/me/account HTTP/1.1
Authorization: Bearer <alice's token>

HTTP/1.1 200 OK
Cache-Control: public, max-age=3600
Content-Type: application/json

{ "user": "alice", "balance": 4200, "email": "alice@example.com" }
```

The bug: a **per-user, authenticated, sensitive** response is marked `public, max-age=3600`. That means a shared cache (CDN or corporate proxy) may store Alice's account and serve it to *the next user* who requests `/v1/me/account` — a serious data leak across users. It also caches PII/financial data on disk in intermediaries.

Fix:

```http
HTTP/1.1 200 OK
Cache-Control: private, no-store
Content-Type: application/json
```

`private` keeps it out of shared caches; `no-store` prevents writing sensitive data anywhere (stronger than `private, no-cache`). If you wanted *some* client caching you could use `private, max-age=0, no-cache` with an `ETag` for revalidation, but for balances/PII, `no-store` is the safe default. The lesson: `public` is a security-relevant flag, not a performance knob — never set it on anything keyed by identity.

### Q15. How do you minimize API payload size beyond compression?

Compression is one lever; the response *shape* is the other:

- **Field selection / sparse fieldsets** — let clients request only needed fields (Q6); don't send 30 fields for a list that shows 3.
- **Pagination** — never return unbounded collections; cap `limit` and paginate, so payloads stay small and predictable.
- **Trim nulls and defaults** — optionally omit null/empty fields (be careful: consistency vs size; document it).
- **Sensible types** — send timestamps as ISO strings or epoch ints, not verbose nested objects; avoid deeply nested envelopes when a flat shape works.
- **Reference vs embed** — for large related data, return an ID/URL and let the client fetch on demand (but watch the N+1 tradeoff — embed when the client always needs it, reference when rarely).
- **Avoid chatty over-fetching** — the reverse of embedding: don't inline huge sub-objects clients discard.
- **Efficient encodings for internal paths** — protobuf/gRPC for service-to-service where JSON's verbosity costs.

The recurring tension: minimize bytes (small, referenced payloads) vs minimize round-trips (embed everything). Resolve it per use case by looking at what the common client screen actually needs — design for the view.

### Q16. Design a caching strategy for a read-heavy product catalog API.

A public catalog (`GET /v1/products`, `GET /v1/products/{id}`) is the ideal caching case: read-heavy, mostly-public, tolerant of seconds-to-minutes staleness. I'd layer it:

```text
Client  --Cache-Control: public, max-age=60, ETag--> revalidate cheaply
   |
Edge/CDN  --s-maxage=600, purge-on-write--> absorbs the bulk of read traffic
   |
Service  --Redis cache of rendered product JSON, TTL 5m + purge on update-->
   |
   DB (only hit on cache miss)
```

- **Edge/CDN** does the heavy lifting: `public, s-maxage=600`, keyed by URL (+`Vary: Accept-Encoding`). Most reads never reach the origin.
- **`ETag` + `max-age=60`** at the client so browsers/apps revalidate cheaply (`304`) rather than refetch.
- **Server-side Redis** caches the assembled product payload so cache-miss requests don't hit the DB; TTL as a safety net.
- **Invalidation on write**: when a product changes, update/evict its Redis key *and* purge its CDN path, backed by short `s-maxage` so any missed purge self-heals within minutes.
- **Compression** (`br`/`gzip`) everywhere; **field selection** for list views.
- **What stays uncached**: per-user data (cart, recommendations personalized by identity) → `private`/`no-store`; live inventory counts → short TTL or a separate real-time endpoint.

The design matches each data type's staleness tolerance to a cache layer, and defines invalidation explicitly rather than hoping TTLs are enough.

## Webhooks & Callbacks

### Summary

**What this topic covers**

Webhooks are how APIs push events to consumers instead of making them poll — a server-to-client HTTP callback ("something happened, here's what"). This topic covers designing a webhook system that is *reliable* and *trustworthy* across an unreliable network, from the *API design* angle. The 16 questions cluster into three concerns: (1) **delivery reliability** — the at-least-once model, retries with exponential backoff, dead-letter queues, replay, and catch-up; (2) **trust and correctness on the consumer side** — HMAC signature verification so consumers can trust events came from you, idempotency/dedup via event IDs, and the fact that *ordering is not guaranteed*; and (3) **design and security** — event payload design (thin vs fat events), subscription management, testing webhooks, and the security surface on both ends (SSRF from the sender, verifying the receiver). The through-line: webhooks are a *distributed messaging* problem wearing an HTTP-callback costume, so the hard parts are the messaging guarantees — delivery, ordering, dedup — not the HTTP.

**Mental model**

A webhook is you (the provider) making an HTTP `POST` to a URL the consumer registered, carrying an event. The mental shift from a normal API is that **you are now the client and the network is against you** — the consumer's endpoint will be down, slow, or flaky, so you must assume delivery *fails* and design for **at-least-once** delivery: keep retrying until you get a `2xx`, which means the same event may arrive *more than once* and *out of order*. That single fact drives the whole consumer contract: every event carries a stable **event ID** so the consumer can **dedup** (idempotency), and consumers must **not assume ordering** (sort by an event timestamp/sequence if they care). Trust is the second axis: the consumer is receiving an unauthenticated inbound POST from the internet, so you **sign** each payload with an HMAC over a shared secret, and the consumer verifies the signature before acting — otherwise anyone can forge events. Think "durable event queue with HTTP delivery + retries + signatures," not "fire-and-forget callback."

**Key terms**

- **Webhook** — a provider-initiated HTTP `POST` to a consumer-registered URL, delivering an event.
- **At-least-once delivery** — the provider retries until acknowledged, so duplicates are possible; "exactly once" is a dedup illusion.
- **Exponential backoff (+ jitter)** — retry after growing, randomized delays (1s, 2s, 4s, …) to avoid hammering a recovering consumer.
- **Dead-letter queue (DLQ)** — where events go after exhausting retries, for inspection/manual replay.
- **HMAC signature** — a keyed hash (e.g. HMAC-SHA256) over the payload proving authenticity + integrity; sent in a header like `X-Signature`.
- **Idempotency / dedup** — the consumer uses the event ID to process each event exactly once despite duplicates.
- **Event ID** — a unique, stable identifier per event (`evt_123`), the key for dedup.
- **Thin vs fat event** — thin = "id changed, go fetch it"; fat = full object embedded in the payload.
- **Replay / catch-up** — re-sending past events (after an outage) or letting consumers backfill via an events API.
- **Acknowledgement** — the consumer returns `2xx` quickly to confirm receipt; anything else triggers retry.
- **SSRF** — Server-Side Request Forgery: the provider POSTing to attacker-controlled internal URLs registered as webhooks.

**Why interviewers ask this**

Webhooks are a compact way to test whether a candidate understands distributed-systems reality, not just request/response. The junior answer treats a webhook as a reliable function call — POST it once, assume it arrives, in order, exactly once. The senior signal is immediately naming the three hard truths: delivery is at-least-once (so *dedup*), ordering is not guaranteed (so *don't rely on it*), and the payload is spoofable (so *sign it*). Interviewers also probe the operational maturity: what happens when the consumer is down for an hour (retries + DLQ + catch-up), how a consumer safely reprocesses duplicates (idempotency keyed on event ID), and the security surface most people forget (SSRF from the sender validating webhook URLs, and the receiver verifying signatures + using constant-time comparison). "Design a webhook delivery system" is a favorite senior question because it forces reliability, security, and API design together.

**Common confusions**

- "Webhooks are delivered exactly once, in order" — no. At-least-once means duplicates; the network means out-of-order. Design the consumer for both.
- "If I got a 200, ordering is fine" — a `200` acks *that* delivery; it says nothing about the order relative to other events.
- "Signature verification is optional / IP allowlisting is enough" — IPs change and can be spoofed at some layers; HMAC signature verification is the real trust mechanism.
- "The consumer should do the work before responding" — no; ack fast (`2xx`) and process async, or the provider times out and retries, multiplying load.
- "Fat events are always better" — fat events are convenient but leak more data, can be stale, and bloat payloads; thin events force a fetch but stay small and current.
- "Retrying forever is fine" — no; cap retries, then dead-letter, or a permanently-dead consumer blocks the queue.

**What follows from this topic**

Webhooks are the push side of async/event-driven APIs (AsyncAPI, pub/sub, message queues) and the alternative to polling and long-running-operation status endpoints. Idempotency here is the same idempotency-key concept from reliable POST design, applied on the *consumer*. Signature verification and SSRF tie directly back to API Security. Retries-with-backoff-and-jitter is the same resilience pattern clients use against your synchronous API. And the thin-vs-fat event choice mirrors the payload-design and over/under-fetching tradeoffs from performance and REST design.

### Q1. What is a webhook and when would you use one instead of polling?

A webhook is a **provider-initiated HTTP callback**: instead of the consumer repeatedly asking "anything new?", the provider `POST`s an event to a URL the consumer registered the moment something happens.

```http
POST https://consumer.example.com/webhooks/orders HTTP/1.1
Content-Type: application/json
X-Webhook-Id: evt_abc123
X-Signature: sha256=...

{ "id": "evt_abc123", "type": "order.shipped", "created": 1719792000,
  "data": { "order_id": "order_456" } }
```

Use webhooks when consumers need **timely** notification of events they can't predict — payment succeeded, order shipped, build finished. The alternative, **polling**, has the consumer call `GET /v1/orders?since=...` on a timer.

Tradeoffs: webhooks give near-real-time delivery and eliminate wasteful empty polls, at the cost of the consumer running a public endpoint and you building reliable delivery (retries, signing). Polling is simpler for the consumer and needs no inbound endpoint, but is laggy (bounded by poll interval) and wasteful (most polls return nothing). Rule of thumb: push (webhooks) for infrequent, unpredictable, time-sensitive events; poll for frequent or batch-tolerant syncs. Many mature APIs offer both, plus an events API for catch-up.

### Q2. Why is webhook delivery "at-least-once," and what does that force consumers to do?

Because the network is unreliable, the provider can't know whether a failure happened *before* the consumer processed the event or *after* (e.g. the consumer processed it but its `200` response was lost). To guarantee the event is *not missed*, the provider **retries on any non-`2xx`/timeout** — which means a successfully-processed event can be delivered *again*. That's at-least-once: never lost, possibly duplicated.

You cannot get true exactly-once over an unreliable network; "exactly-once" in practice is at-least-once delivery + consumer-side **deduplication**.

This forces two things on the consumer:
1. **Idempotent processing** — keyed on the event's stable **ID** (`evt_abc123`). Record processed IDs; if one arrives again, ack it (`200`) and skip the side effect.
2. **No ordering assumptions** — retries and parallel delivery mean events can arrive out of order; use an event timestamp/sequence if order matters.

The provider's job is reliable delivery; the consumer's job is to make repeated delivery *safe*. Designing the event with a stable ID is what makes consumer idempotency possible — so it's a shared contract.

### Q3. Design a retry strategy for webhook delivery.

Retries must recover transient failures without hammering a struggling consumer or retrying forever.

```text
attempt 1: immediate
attempt 2: +~5s     }
attempt 3: +~30s    }  exponential backoff
attempt 4: +~2m     }  with random jitter
attempt 5: +~10m    }
attempt 6: +~1h
...cap total window (e.g. 24h / N attempts) -> dead-letter
```

Key elements:
- **Retry on** timeouts, connection errors, and `5xx`/`429`. **Don't retry** on `4xx` (except `429`) — a `400`/`410` means the request is malformed or the endpoint is gone; retrying won't help.
- **Exponential backoff** so delays grow (avoid tight retry loops), plus **jitter** (randomization) so many failed events for one consumer don't all retry in sync and stampede it when it recovers.
- **A cap** — after N attempts / a max window, stop and **dead-letter** the event. Retrying a permanently-dead endpoint forever wastes resources and can head-of-line-block the queue.
- **Respect `Retry-After`** if the consumer sends it on a `429`/`503`.
- **Auto-disable** a subscription after prolonged 100% failure, and notify the owner.

Also: process delivery *asynchronously* on your side (a durable queue), so a slow consumer doesn't block your API.

### Q4. Why and how should webhooks be signed with HMAC? Show verification.

The consumer receives an unauthenticated inbound `POST` from the public internet — without proof of origin, anyone who learns the URL can forge events. **HMAC signing** solves this: you and the consumer share a secret; you compute an HMAC over the raw payload (and often a timestamp) and send it in a header. The consumer recomputes it and compares.

```http
POST /webhooks HTTP/1.1
X-Webhook-Timestamp: 1719792000
X-Signature: sha256=3a7bd3e2360a...
Content-Type: application/json

{ "id": "evt_abc123", "type": "order.shipped", ... }
```

```javascript
// Consumer verification
const crypto = require('crypto');
function verify(rawBody, header, timestamp, secret) {
  const signed = `${timestamp}.${rawBody}`;                 // bind the timestamp
  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret).update(signed).digest('hex');
  // constant-time compare to avoid timing attacks
  const ok = crypto.timingSafeEqual(Buffer.from(header), Buffer.from(expected));
  const fresh = Math.abs(Date.now()/1000 - timestamp) < 300; // reject old (replay)
  return ok && fresh;
}
```

Critical details: sign the **raw** body (not the re-serialized JSON — key order changes the bytes); use **constant-time comparison** (`timingSafeEqual`), not `===`; include and check a **timestamp** to bound replay; support **secret rotation** (accept two secrets during rollover). HMAC beats IP allowlisting because it proves authenticity + integrity and survives IP changes. Consumers should also reject unsigned requests outright.

### Q5. How does a consumer safely handle duplicate webhook deliveries?

Since delivery is at-least-once, the consumer must make processing **idempotent**, keyed on the event's stable ID.

```javascript
async function handleWebhook(event) {
  // Atomic insert; unique constraint on event_id makes this a natural dedup.
  const inserted = await db.processedEvents.insertIfAbsent(event.id);
  if (!inserted) return ack(200);          // already handled — ack and skip
  await applySideEffect(event);            // e.g. mark order shipped
  return ack(200);
}
```

The pattern: record each processed **event ID** in a store with a uniqueness guarantee; on arrival, check-and-insert atomically. If the ID is already present, the event is a duplicate — return `2xx` and do nothing (so the provider stops retrying) but don't re-run the side effect.

Subtleties:
- **Atomicity** — the dedup check and the side effect should be in one transaction (or the side effect must itself be idempotent), else a crash between them causes a miss or a double.
- **Retention** — keep processed IDs long enough to cover the provider's max retry window (e.g. 24–72h), then expire them.
- **Idempotent side effects** — "set status = shipped" is naturally idempotent; "increment counter" is not — design the effect to be replay-safe.

This is the same idempotency-key discipline used for safe POST retries, applied on the receiving side.

### Q6. Why is webhook ordering not guaranteed, and how should consumers cope?

Ordering breaks for several reasons: retries (a failed `order.created` retries while `order.updated` sails through first), parallel delivery workers, and network variance. So even though you emitted `created` then `updated`, the consumer may receive `updated` first.

Consumers must **not assume receipt order equals event order**. Strategies:

- **Include a sequence/timestamp** in every event (`created` field or a monotonic `sequence` per resource). The consumer orders by that, not by arrival.
- **Make handlers order-tolerant** — process each event against current state (upsert by resource ID) so a late `created` after an `updated` doesn't clobber newer data. Use last-writer-wins by event timestamp, or ignore events older than the resource's current version.
- **Fetch-current on thin events** — if the event just says "order_456 changed," the consumer `GET`s the latest state, sidestepping ordering entirely.
- **Per-key ordering (provider side)** — some providers offer best-effort ordering *per resource* by serializing delivery per key, but consumers should still be defensive.

The senior framing: don't try to force global ordering over an at-least-once channel; design consumers to converge to correct state regardless of arrival order.

### Q7. What happens when a consumer is down for an hour? Design catch-up/replay.

Two mechanisms cover an outage: **retries** (short-term) and **replay/catch-up** (long-term).

- **Retries with backoff** handle brief outages — the event keeps retrying over the retry window (say 24h), so a one-hour outage self-heals; events queued during the outage deliver once the endpoint recovers.
- **Dead-letter + manual replay** — events that exhaust retries land in a DLQ. Provide a dashboard/API to **replay** them once the consumer is fixed.
- **Events API (pull-based catch-up)** — the robust design: expose `GET /v1/events?since=<cursor>` so a consumer that was down (or lost data) can **backfill** at its own pace. This decouples recovery from your retry policy and is the reliable answer for long outages.

```http
GET /v1/events?since=evt_abc123&limit=100 HTTP/1.1
-> { "data": [ ...events... ], "next_cursor": "evt_xyz789" }
```

Combined story: webhooks for the fast path, retries for blips, DLQ+replay for operational recovery, and a cursor-paginated events API as the durable source of truth for catch-up. Consumers reconcile using event IDs (dedup) so replayed events they already processed are safely ignored.

### Q8. Thin vs fat webhook events — how do you choose the payload design?

A **thin** event carries just identifiers ("order_456 changed, type=order.shipped"); the consumer fetches details via the API. A **fat** event embeds the full object in the payload.

| | Thin event | Fat event |
|---|---|---|
| Payload | Small (IDs + type) | Large (full object) |
| Freshness | Always current (consumer fetches latest) | Can be stale (snapshot at emit time) |
| Consumer calls | Requires a follow-up `GET` | Self-contained, no fetch |
| Data exposure | Minimal on the wire | More sensitive data in transit/logs |
| Ordering | Sidesteps it (fetch current state) | Vulnerable to stale-overwrite |

```json
// Thin
{ "id": "evt_1", "type": "order.shipped", "data": { "order_id": "order_456" } }

// Fat
{ "id": "evt_1", "type": "order.shipped",
  "data": { "order_id": "order_456", "status": "shipped", "items": [...], "total": 4200 } }
```

Choose **thin** when data is sensitive, changes fast, or ordering matters (fetch-current dodges staleness) — at the cost of an extra round-trip and load on your API. Choose **fat** when consumers overwhelmingly need the data immediately and the extra fetch would be wasteful (reduces chattiness). A common hybrid: fat *enough* for the common case (key fields) plus IDs to fetch the rest. Whatever you pick, include the event ID, type, and timestamp.

### Q9. How do you design webhook subscription management?

Consumers need a self-service way to register, configure, and manage where events go.

```http
POST /v1/webhook-endpoints HTTP/1.1
{
  "url": "https://consumer.example.com/hooks",
  "events": ["order.shipped", "order.refunded"],   // event-type filtering
  "description": "prod order sync"
}
-> 201 Created
{ "id": "whe_123", "secret": "whsec_...", "status": "enabled" }
```

Design elements:
- **CRUD on endpoints** — create/list/update/delete, plus enable/disable.
- **Event-type filtering** — subscribers pick which event types they want, so you don't spam them (and don't over-expose data).
- **Per-endpoint signing secret** — returned once on creation; support rotation.
- **Status & health** — expose recent delivery attempts, success/failure counts, and last error, so consumers can debug; auto-disable persistently-failing endpoints and notify the owner.
- **Validation on registration** — verify URL ownership (send a challenge the consumer must echo) and enforce HTTPS-only; validate the URL against SSRF (no internal/loopback ranges).
- **Multiple endpoints** — allow several per account (e.g. separate prod/staging).

Good subscription management is a big part of webhook DX — consumers should be able to self-serve, test, and observe deliveries without contacting support.

### Q10. How should a webhook consumer's endpoint be designed to respond?

The cardinal rule: **acknowledge fast, process asynchronously.**

```javascript
app.post('/webhooks', (req, res) => {
  if (!verifySignature(req)) return res.sendStatus(401); // verify first
  await queue.enqueue(req.body);   // hand off to a durable queue
  res.sendStatus(200);             // ack immediately (<~5s)
  // heavy processing happens off the request path, idempotently
});
```

Why: the provider has a delivery timeout (often a few seconds). If your handler does the full work synchronously — DB writes, downstream calls — and exceeds it, the provider records a failure and **retries**, so slow processing turns into *duplicate* processing and pile-ups. Instead: verify the signature, enqueue the event to a durable buffer, return `2xx` right away, and let a worker process it (idempotently, via event ID) out of band.

Response semantics: `2xx` = "received, stop retrying"; `4xx` (non-`429`) = "don't retry, it's bad"; `5xx`/`429`/timeout = "retry later." Don't return `2xx` before you've *durably* accepted the event (enqueued/persisted) — acking then losing it means the event is gone (the provider won't retry). Ack after durable receipt, not after full processing.

### Q11. What is the SSRF risk in webhooks and how do you mitigate it (sender side)?

When you (the provider) let users register an arbitrary webhook URL and then `POST` to it from your servers, you've built a request-forgery primitive: an attacker registers a URL pointing at your *internal* network and uses your server as a proxy to reach things they can't.

```text
Attacker registers webhook url = http://169.254.169.254/latest/meta-data/   (cloud metadata!)
   or http://localhost:6379   (internal Redis)
   or http://10.0.0.5/admin   (internal service)
-> your server dutifully POSTs to it -> data exfiltration / internal access
```

Mitigations (sender side):
- **Validate the URL on registration and on every delivery** — resolve the hostname and **block private/reserved ranges**: loopback (`127.0.0.0/8`, `::1`), RFC1918 (`10/8`, `172.16/12`, `192.168/16`), link-local (`169.254.0.0/16`, incl. cloud metadata), and `0.0.0.0`.
- **Re-check after DNS resolution** (guard against DNS-rebinding — resolve, pin the IP, connect to that IP).
- **HTTPS-only**, no redirects to internal targets (don't blindly follow `3xx`).
- **Egress controls** — send webhook traffic through a locked-down proxy/egress network that physically can't reach internal services.
- **Timeouts and response-size caps** — don't buffer huge responses; you only need the status code.

SSRF is the most-forgotten webhook vulnerability precisely because the dangerous request originates from *your* trusted infrastructure.

### Q12. How do consumers verify they're receiving legitimate events (receiver side)?

The receiver treats every inbound POST as untrusted until proven otherwise. Layered checks:

1. **HMAC signature verification (primary)** — recompute the HMAC over the raw body + timestamp with the shared secret and compare in constant time. Reject on mismatch. This is the real trust boundary.
2. **Timestamp / freshness check** — reject events with an old timestamp to prevent replay of captured requests (combined with dedup by event ID).
3. **HTTPS + valid cert** on the receiving endpoint so the payload/secret aren't exposed in transit.
4. **IP allowlisting (secondary, optional)** — if the provider publishes stable egress IPs, allowlist them as defense-in-depth — but never as the *only* control (IPs change; some can be spoofed upstream).
5. **Schema validation** — validate the event shape/type before acting; reject unknown or malformed payloads.
6. **Reject unsigned requests** — fail closed if the signature header is missing.

```javascript
if (!hasSignature(req)) return res.sendStatus(401);
if (!verifyHmac(req)) return res.sendStatus(401);
if (isStale(req)) return res.sendStatus(401);
```

The key point for the interview: **signature verification, not source IP, is how a consumer trusts a webhook** — HMAC proves both authenticity (it's from the provider) and integrity (the payload wasn't tampered with).

### Q13. How do you test and debug webhooks during development?

Webhooks are awkward to test because they require a public, provider-reachable endpoint. Tooling and design address this:

- **Tunneling** — expose your local server via a tunnel (ngrok-style) so the provider can reach `localhost` during development.
- **Provider test tools** — a dashboard "send test event" button, a CLI that forwards live events to localhost, and a **delivery log** showing each attempt's request, response, and status so you can inspect failures.
- **Replay** — re-send a past event from the dashboard to reproduce a bug without waiting for it to happen naturally.
- **Signature test vectors** — the provider documents the signing scheme with a worked example so consumers can validate their verification code.
- **Idempotency testing** — deliberately deliver the same event twice and assert the side effect happened once.
- **Mock/sandbox mode** — a sandbox that emits synthetic events on demand.

On the consumer side: log the raw body + headers (redacting secrets), verify signatures in a unit test with known vectors, and build a `/webhooks/health` view. Good webhook DX — inspectable delivery logs, easy replay, test events — is a major differentiator; opaque "it just POSTs and hopes" systems are miserable to integrate.

### Q14. Design a complete webhook delivery system (senior/system question).

I'd build it as a durable, async pipeline — never inline with the event source.

```text
event occurs -> write Event(id, type, payload, ts) to durable store  (source of truth)
             -> enqueue delivery jobs (one per matching subscription)
                        |
             +----------v-----------+
             |  Delivery workers     |  sign (HMAC) -> POST -> await 2xx
             +----------+-----------+
                        | non-2xx / timeout
                        v
             backoff+jitter retry (cap N/24h)
                        | exhausted
                        v
                  Dead-Letter Queue --(manual/auto replay)-->
   Consumers also backfill via  GET /v1/events?since=<cursor>  (catch-up)
```

Components and decisions:
- **Durable event log** — persist every event first; it's the source of truth and powers the catch-up API. Delivery is a *separate* concern from event creation.
- **Fan-out** — for each event, enqueue a delivery per matching, enabled subscription (filtered by event type).
- **Workers** — pull jobs, HMAC-sign, POST with a short timeout, expect `2xx`.
- **Retries** — exponential backoff + jitter, retry on `5xx`/`429`/timeout, cap attempts, then DLQ; auto-disable chronically-failing endpoints.
- **Guarantees** — at-least-once (so events carry stable IDs for consumer dedup); no ordering promise (events carry timestamps/sequence).
- **Security** — HMAC signing + timestamp; SSRF-guard on target URLs; HTTPS-only.
- **Observability** — per-delivery logs, success/failure metrics, replay UI.
- **Catch-up** — cursor-paginated events API for consumers to backfill after outages.

The framing that scores: this is a *messaging system* (durable queue + retries + DLQ + dedup) that happens to deliver over HTTP — get the reliability and security right, and the HTTP part is easy.

### Q15. Webhooks vs polling vs pub/sub vs WebSockets — when do you pick each?

They're all ways to move events; the right one depends on who initiates, who's connected, and the traffic shape.

| Mechanism | Direction | Best for | Cost |
|---|---|---|---|
| **Polling** | Consumer pulls on a timer | Simple integrations, no public endpoint, batch-tolerant | Laggy, wasteful empty polls |
| **Webhooks** | Provider pushes HTTP POST | Server-to-server, timely, infrequent events (payment, shipment) | Consumer needs a public endpoint; provider builds reliable delivery |
| **Pub/Sub / message queue** | Broker delivers to subscribers | High-volume internal event streams, decoupling, buffering | Needs a broker (Kafka/SNS/SQS); internal, not public web |
| **WebSockets / SSE** | Persistent bidirectional/stream | Live UI updates (chat, dashboards, prices) to *browsers* | Stateful connections, scaling connections is work |

Guidance: **webhooks** for server-to-server integration where a third party wants to be notified of your events over the public web. **Pub/sub** when it's your *own* internal services consuming a high-volume stream (webhooks don't scale to millions of internal events; a broker does). **WebSockets/SSE** when a *browser/app UI* needs live, low-latency updates on an open connection. **Polling** as the simplest fallback when the consumer can't host an endpoint or can tolerate lag. Many platforms offer webhooks *plus* an events API (polling for catch-up) — the two complement rather than compete.

### Q16. Spot the problems in this webhook consumer.

```javascript
app.post('/webhooks', async (req, res) => {
  const event = req.body;
  await chargeCustomer(event.data);          // heavy work, no idempotency
  await sendEmail(event.data.email);
  res.sendStatus(200);
});
```

Several serious problems:

1. **No signature verification** — anyone who finds the URL can forge a `charge` event. Must HMAC-verify before doing anything.
2. **No idempotency / dedup** — at-least-once delivery means this event can arrive twice, so the customer gets **charged twice** and emailed twice. Must dedup on `event.id`.
3. **Synchronous heavy work before acking** — charging + emailing inline can exceed the provider's timeout, triggering a *retry* while the first attempt is still running: duplicate charges and pile-ups. Ack fast, process async.
4. **No ordering tolerance** — assumes this event reflects current state; a stale/out-of-order event could act on old data.
5. **No error isolation** — if `sendEmail` throws after `chargeCustomer` succeeds, the whole handler 500s, the provider retries, and the customer is charged again.

Fixed shape:

```javascript
app.post('/webhooks', async (req, res) => {
  if (!verifyHmac(req)) return res.sendStatus(401);        // 1. trust
  const inserted = await db.events.insertIfAbsent(req.body.id); // 2. dedup
  if (!inserted) return res.sendStatus(200);
  await queue.enqueue(req.body);                            // 3. async
  res.sendStatus(200);                                      // ack fast
});
// worker: idempotent charge (idempotency key = event.id), then email; retry-safe
```

Naming all five — signing, dedup, async-ack, ordering, error isolation — is the senior signal.
## API Styles Compared & When to Use

### Summary

**What this topic covers**

This topic is the decision layer: given a system to build, which API *style* do you reach for, and why? It compares the five that actually show up in production — **REST**, **GraphQL**, **gRPC**, **webhooks / async messaging**, and **SOAP** (mostly legacy, but still in banking and enterprise SOA). The point is not to crown a winner; it is to reason about fit. A style is a set of tradeoffs across audience (public vs internal vs partner), transport, client diversity, performance, streaming, caching, and tooling. Senior engineers pick per-boundary, not per-company, and healthy architectures are usually **hybrid** — REST or GraphQL at the public/browser edge, gRPC between internal services, webhooks or a message bus for events. The 16 questions here cover the axes you compare on, a concrete decision matrix, worked selection scenarios, and the wrong choices interviewers love to probe (gRPC exposed to browsers, GraphQL for a two-endpoint internal service, REST polling where a webhook belongs).

**Mental model**

Think of an API style as a *contract shape plus a delivery model*. Two questions settle 80% of the decision. First: **who is the client, and how much do you control it?** A public API consumed by thousands of unknown developers optimizes for stability, discoverability, and HTTP-native tooling — that pulls you toward REST. An internal service you own on both ends optimizes for latency, type safety, and codegen — that pulls you toward gRPC. Second: **is the interaction request-driven or event-driven?** If the client asks and waits, it is synchronous (REST/GraphQL/gRPC). If something happens and interested parties must be told, it is asynchronous (webhooks, pub/sub, queues) — and forcing that into polling is the classic mismatch. Layer on client diversity (do many screens need different field subsets? GraphQL earns its complexity) and performance envelope (high-throughput, low-latency, streaming? gRPC). Everything else — caching, tooling, org familiarity — breaks ties. Resist "we'll standardize on one style everywhere"; that is optimizing for uniformity over fit.

**Key terms**

- **REST** — resource-oriented HTTP API; nouns as URIs, HTTP methods as verbs; stateless, cache-friendly, ubiquitous tooling.
- **GraphQL** — single-endpoint query language; client specifies exactly the fields it wants; solves over/under-fetching, harder to cache.
- **gRPC** — contract-first RPC over HTTP/2 with protobuf; binary, fast, supports streaming; ideal internal, weak for browsers.
- **Webhook** — server-to-client HTTP callback; push notification of an event to a registered URL.
- **Async messaging / pub-sub** — events flow through a broker (Kafka, SQS, RabbitMQ); decouples producers from consumers in time.
- **SOAP** — XML-based RPC protocol with WSDL contracts and WS-* standards; verbose, still present in legacy enterprise/finance.
- **BFF (Backend-for-Frontend)** — a per-client API layer that aggregates downstream services for one frontend.
- **Over-fetching / under-fetching** — REST endpoints return too much or too little for a given screen; the core problem GraphQL targets.
- **Streaming** — long-lived bidirectional or server-push data flow; native in gRPC, awkward in REST.
- **Hybrid architecture** — deliberately mixing styles per boundary (public REST + internal gRPC + event webhooks).

**Why interviewers ask this**

Style selection is the fastest way to separate a candidate who has *shipped* APIs from one who has read about them. Juniors answer "REST, because that's the standard" or, worse, "GraphQL, because it's modern" — style as fashion. Seniors answer with a question: *who's calling it, from where, how often, and do you control the client?* The signal they want is that you reason from constraints to a choice and can name what you'd give up. They also probe for the anti-patterns — exposing gRPC to a browser, or adding a GraphQL server in front of a single downstream service — because recognizing a wrong choice is harder than reciting a right one. Strongest answers volunteer a hybrid: "REST for the public API, gRPC internally, webhooks for events," which shows you think per-boundary rather than dogmatically.

**Common confusions**

- "GraphQL replaces REST" — it targets a specific problem (many clients needing different field subsets from many resources). For a simple CRUD service it is pure overhead.
- "gRPC is just faster REST" — it is a different contract model (protobuf/HTTP/2) that browsers can't call natively without a proxy; the speed comes with public-facing and debugging costs.
- "Webhooks are a different protocol" — they're ordinary HTTP POSTs; what's different is the *direction* (server calls you) and the reliability engineering (retries, signing, dedup).
- "REST means CRUD over HTTP" — REST is a set of constraints (statelessness, uniform interface, resources); most "REST" APIs are pragmatic HTTP/JSON and that's fine.
- "SOAP is dead" — it's legacy, not absent; regulated finance and old enterprise SOA still run it, and WS-Security had features REST reinvented later.
- "Pick one style for the whole company" — real systems are hybrid; the boundary determines the style.

**What follows from this topic**

Once you've chosen a style, the rest of the primer fills in the *how*. REST choices flow into resource modeling, HTTP semantics, status codes, versioning, and pagination. GraphQL choices raise the N+1 problem and schema evolution. gRPC raises protobuf compatibility and deadlines. The async/webhook choice opens delivery guarantees, retries, and HMAC signing. And every style shares the cross-cutting concerns — auth, rate limiting, idempotency, error models, gateways, and the governance and DX questions in the next topic, which is where a *chosen* style becomes a *managed product*.

### Q1. What are the main API styles and when would you reach for each?

Five styles cover essentially everything you'll meet:

| Style | Transport / format | Best for | Weak for |
|---|---|---|---|
| **REST** | HTTP/JSON | Public APIs, CRUD, browser & mobile clients, cache-heavy reads | Complex nested fetches, real-time streaming |
| **GraphQL** | HTTP/JSON, single endpoint | Many clients needing different field subsets, aggregating many sources | Simple services, HTTP caching, file uploads |
| **gRPC** | HTTP/2 + protobuf (binary) | Internal service-to-service, low latency, streaming, polyglot codegen | Public/browser clients, human debuggability |
| **Webhooks / async** | HTTP POST callbacks / message broker | Event notifications, long-running work, decoupling | Request-response where caller needs an immediate answer |
| **SOAP** | XML + WSDL, WS-* | Legacy enterprise/finance, formal contracts, WS-Security | Anything greenfield; verbose, heavyweight |

The one-line heuristic: **REST for public, gRPC for internal, webhooks for events, GraphQL when client field-needs diverge, SOAP only if you're forced.** Everything after this is defending that choice against the specifics of the system.

### Q2. REST vs GraphQL vs gRPC — give me the full comparison.

```text
                REST            GraphQL          gRPC
Contract        OpenAPI         SDL schema       protobuf (.proto)
Transport       HTTP/1.1+       HTTP (1 endpoint) HTTP/2
Payload         JSON (text)     JSON (text)      protobuf (binary)
Endpoints       many (/orders)  one (/graphql)   many RPC methods
Fetch shape     fixed per route client-specified  fixed per method
Over-fetching   common          solved           n/a (typed)
HTTP caching    excellent (GET) hard (POST)      n/a (needs custom)
Streaming       awkward (SSE)   subscriptions    native (bidi)
Browser-native  yes             yes              no (needs gRPC-web)
Codegen         optional        typed clients    first-class
Debuggability   curl-friendly   query tooling    needs tooling
Best fit        public/CRUD     flexible clients internal svc-to-svc
```

The framing that lands in an interview: REST optimizes for **ubiquity and caching**, GraphQL for **client flexibility**, gRPC for **performance and type safety between services you own**. Match the optimization to your actual constraint.

### Q3. When is GraphQL the right choice, and when is it overkill?

GraphQL earns its keep when **many diverse clients need different slices of a rich, interconnected graph**. The canonical case: a mobile app, a web app, and a smartwatch all hit the same backend, and each needs a different subset of user + orders + recommendations. With REST you'd either over-fetch, build custom endpoints per screen, or chain requests (under-fetching). GraphQL lets each client ask for exactly its fields in one round trip:

```graphql
query {
  user(id: "usr_123") {
    name
    orders(last: 3) { id total status }
  }
}
```

It's **overkill** when: you have one client, or a simple CRUD service, or a handful of endpoints. You'd be adding a schema layer, resolver plumbing, the N+1 problem, and worse HTTP caching to solve a problem you don't have. Rule of thumb: if you can't name at least two clients with genuinely different data needs, GraphQL is complexity you're buying on spec. It also shines as an **aggregation layer** in front of many microservices — but that's a BFF pattern, and a plain BFF in REST may be simpler.

### Q4. When would you pick gRPC over REST?

Pick gRPC for **internal, high-volume, service-to-service traffic where you control both ends**. Concretely, you want it when:

- **Latency and throughput matter** — binary protobuf over HTTP/2 multiplexing beats JSON/HTTP/1.1 for east-west traffic.
- **You need streaming** — server-push, client-stream, or bidirectional (chat, telemetry, live updates). REST forces SSE/long-polling hacks.
- **Strong typing and codegen** across languages — one `.proto` generates typed clients in Go, Java, Python, etc., so the contract is enforced at compile time.
- **A polyglot microservice mesh** — the schema is the coordination point.

Avoid gRPC when the client is a **browser** (no native support; needs a gRPC-web proxy), when you need **human-debuggable** traffic (binary payloads aren't curl-able), or when you want **HTTP caching and a huge public tooling ecosystem**. The classic move: gRPC internally, a REST or GraphQL gateway at the public edge that translates.

```protobuf
service Orders {
  rpc GetOrder(GetOrderRequest) returns (Order);
  rpc WatchOrders(WatchRequest) returns (stream OrderEvent); // server streaming
}
```

### Q5. When do you use webhooks or async messaging instead of a synchronous API?

Use async whenever the **producer of information isn't the party asking for it**, or the work takes longer than a caller should wait. Two triggers:

**Event notification** — something happened (payment settled, shipment dispatched) and other systems need to know. Making them poll `GET /v1/payments?status=settled` every few seconds is wasteful and laggy. A **webhook** pushes the event the moment it occurs:

```http
POST /webhooks/payments HTTP/1.1
Host: client.example.com
X-Signature: sha256=...
Content-Type: application/json

{ "type": "payment.settled", "data": { "id": "pay_123", "amount": 4200 } }
```

**Long-running work** — a synchronous call that would block for minutes (video transcode, bulk export). Return `202 Accepted` with a status resource, and notify via webhook or let the client poll the status URL.

Webhooks suit **partner/public integrations** (you push to their URL); an internal **message broker** (Kafka/SQS) suits **service decoupling** at scale (many consumers, replay, buffering). The tradeoff you accept: no immediate response, at-least-once delivery, out-of-order arrival, and the reliability engineering that follows (retries, signing, dedup).

### Q6. Give me a decision matrix for choosing an API style.

Walk these axes; the answer usually falls out of the first two rows:

| Question | Points toward |
|---|---|
| Public/unknown clients? | REST (or GraphQL if fields vary) |
| Internal, you own both ends? | gRPC |
| Browser or mobile calling directly? | REST / GraphQL (not raw gRPC) |
| Clients need very different field subsets? | GraphQL |
| Event-driven / fire-and-forget? | Webhooks / message bus |
| Streaming / real-time bidirectional? | gRPC (or WebSocket/SSE) |
| Heavy cacheable reads? | REST (HTTP caching) |
| Ultra-low latency, high throughput? | gRPC |
| Rich third-party tooling / easy debugging? | REST |
| Regulated legacy / WS-Security shop? | SOAP (if mandated) |

The senior move is to say the matrix rarely returns one answer for a whole system — you apply it *per boundary* and end up hybrid.

### Q7. What does a healthy hybrid architecture look like?

Most mature systems mix styles deliberately, one per boundary:

```text
 Browser / Mobile
        │  REST or GraphQL (public, cacheable, tooling)
        ▼
   API Gateway / BFF
        │  gRPC (internal, fast, typed)
        ▼
 ┌──────┴───────┐
 Orders svc   Payments svc
        │  publishes events
        ▼
  Message bus (Kafka)
        │  webhook delivery
        ▼
  Partner / customer endpoints
```

REST or GraphQL faces the public because it's browser-native, cacheable, and universally tooled. Internally, services speak **gRPC** for speed and typed contracts. **Events** flow through a broker, and a webhook service delivers them to external subscribers. Nobody exposes gRPC to a browser; nobody makes internal services poll REST when an event bus fits. The interview point: "one style everywhere" is a smell; matching style to boundary is the mark of experience.

### Q8. What are the most common wrong style choices, and why are they wrong?

- **gRPC exposed directly to browsers** — browsers can't speak gRPC natively; you need a gRPC-web proxy and lose caching and debuggability. Use REST/GraphQL at the edge, translate to gRPC behind it.
- **GraphQL in front of a single service with two endpoints** — you've added a schema, resolvers, the N+1 problem, and harder caching to solve over-fetching you didn't have.
- **REST polling where a webhook belongs** — clients hammering `GET` every 2s for a status change: wasteful, laggy, and it doesn't scale. Push the event.
- **Synchronous REST for a 5-minute job** — the caller times out or holds a connection forever. Use `202 Accepted` + status resource or async completion.
- **SOAP for a greenfield public API** — verbosity and WS-* complexity with no upside outside a mandated enterprise context.
- **Chatty REST for internal high-throughput paths** — N sequential JSON round-trips where a single gRPC streaming call or a batch endpoint would do.

Each is a mismatch between the style's optimization and the actual constraint.

### Q9. Is SOAP ever the right answer in 2026?

Rarely by choice, but it's not a trick question. SOAP still makes sense when you're **integrating with an existing SOAP ecosystem** — legacy banking, insurance, telecom, government SOA, or enterprise middleware (BizTalk, TIBCO) where the contracts, WSDL tooling, and **WS-Security** are already the standard. Its genuine strengths: a **formal machine-readable contract (WSDL)**, built-in standards for message-level security, signing, and transactions (WS-Security, WS-AtomicTransaction), and transport independence.

For anything greenfield, you'd choose REST or gRPC — SOAP's XML verbosity, envelope overhead, and steep tooling curve are pure cost with no modern upside. The honest interview answer: "I wouldn't start a new API in SOAP, but if I'm integrating with a bank's existing WSDL, I'll speak SOAP at that boundary and expose REST to my own clients."

### Q10. How do caching considerations affect style choice?

Caching is one of REST's quiet superpowers and a real GraphQL/gRPC weakness. REST rides HTTP's native caching: `GET` requests are cacheable by browsers, CDNs, and reverse proxies using `Cache-Control`, `ETag`, and conditional requests — no custom code.

```http
GET /v1/products/42 HTTP/1.1

HTTP/1.1 200 OK
Cache-Control: public, max-age=3600
ETag: "a1b2c3"
```

**GraphQL** typically sends everything as `POST /graphql`, which HTTP caches ignore, and each query shape is unique — so you cache at the resolver/field level (persisted queries, DataLoader, application caches) instead of at the HTTP layer. **gRPC** has no HTTP caching semantics at all; you build caching into the service.

So if your workload is **read-heavy with cacheable resources served to many clients** (product catalog, content, public reference data), REST's free CDN caching is a strong reason to pick it. If reads are highly personalized or query shapes vary per client, the caching advantage shrinks and other axes decide.

### Q11. How do tooling and ecosystem maturity factor into the decision?

Tooling is a legitimate tiebreaker, not an afterthought. **REST** has the deepest ecosystem: OpenAPI/Swagger for docs and codegen, Postman, curl, browser devtools, every language's HTTP client, API gateways, and universal developer familiarity. That lowers integration friction for *public* APIs, where you can't train your consumers. **gRPC** has excellent codegen and typed clients but assumes engineers comfortable with protobuf and gRPC tooling — fine internally, friction externally. **GraphQL** has strong dev tooling (GraphiQL, Apollo, schema introspection) but a smaller ops/gateway ecosystem and caching story.

The rule: the **less you control your clients, the more tooling ubiquity matters**. For a public API, REST's "any developer can curl it in 30 seconds" is worth real money in adoption. For an internal mesh, your team's expertise and codegen quality dominate, and gRPC's tooling is a plus. Never pick a style whose tooling your consumers can't or won't adopt.

### Q12. "Design an API for a real-time chat app" — which style?

Chat is **streaming and bidirectional**, so a request-response style alone is a poor fit. The decision:

- **Message delivery (real-time push)** — you need server→client push. Options: **gRPC bidirectional streaming** (if clients are apps you control), **WebSockets** (browser-native), or **SSE** (server→client only). For a browser-facing chat, WebSockets or GraphQL subscriptions; for a mobile/desktop app you control, gRPC streaming is excellent.
- **History, profiles, room lists** — plain **REST** (`GET /v1/rooms/42/messages?before=cursor`), cacheable and paginated.
- **Fan-out at scale** — a **message bus** behind the streaming layer to distribute messages across server instances.

So it's hybrid: REST for the CRUD-ish surface, a streaming transport (WebSocket/gRPC/subscriptions) for live messages, and pub/sub internally. The wrong answer is "REST with the client polling every second" — that's the polling-vs-push anti-pattern, laggy and expensive. Naming the streaming requirement first is what signals seniority.

### Q13. "Design an API for an internal payments microservice mesh" — which style?

Internal, service-to-service, latency-sensitive, and you own every client — this is **gRPC's home turf**. Reasons: protobuf gives a strongly-typed, versioned contract enforced at compile time across a polyglot mesh; HTTP/2 multiplexing keeps east-west latency low; codegen means no hand-written clients; **deadlines** propagate cancellation cleanly.

```protobuf
service Payments {
  rpc Authorize(AuthorizeRequest) returns (AuthorizeResponse);
  rpc StreamSettlements(SettlementQuery) returns (stream Settlement);
}
```

Layer in **async messaging** (Kafka/SQS) for the events other services react to (`payment.authorized`, `payment.settled`) so you decouple the payment path from downstream consumers (ledger, notifications, fraud).

At the **public/partner edge**, you'd still put a **REST** API in front (browsers and third parties can't call gRPC natively), plus **webhooks** to notify merchants. So: gRPC core, event bus for decoupling, REST + webhooks at the boundary. Answering "REST everywhere" here misses the internal performance and typing wins gRPC gives you.

### Q14. How does client control change the calculus?

Client control is arguably the single most decisive axis. **When you control the client** (internal services, your own mobile app shipped from your codegen), you can afford tightly-coupled, efficient contracts: gRPC's binary protobuf, breaking changes coordinated in a deploy, custom transports. You optimize for performance and type safety because you can update both ends together.

**When you don't control the client** (a public API used by thousands of unknown developers, or third-party integrators), stability and least astonishment dominate. You choose REST/JSON for ubiquity, you *never* break the contract without versioning and long deprecation windows, you document exhaustively, and you accept less efficiency in exchange for adoptability. A breaking change here isn't a coordinated deploy — it's an outage for people you can't even contact.

So the same underlying service might warrant gRPC internally and REST externally. The question "do I control the client?" front-loads the whole decision: it sets your tolerance for coupling, your evolution strategy, and your tooling floor.

### Q15. REST vs webhooks — aren't they solving different problems?

Yes — and that's exactly the point interviewers want you to articulate. They're **complementary directions of the same HTTP relationship**, not competitors. REST is **client-pull**: the client initiates, asks a question, gets an answer synchronously. Webhooks are **server-push**: the server initiates when an event occurs and calls a URL the client registered.

You typically use both in one API. REST to create and query resources and to *register* a webhook subscription; webhooks to notify the client asynchronously when those resources change:

```text
Client ──POST /v1/subscriptions {url, events}──▶ Server   (REST: register)
                                                    │
                              (later, event fires)  │
Client ◀──POST /webhook {event}────────────────────┘        (Webhook: notify)
```

The alternative to a webhook isn't "a different REST design," it's **polling** — the client repeatedly `GET`-ing to check for changes, which is wasteful and laggy. So the real comparison is *webhook (push) vs polling (pull)* for staying informed, and REST is how you manage the resources and subscriptions around it.

### Q16. How do you reason out loud when an interviewer asks "which API style for X?"

Narrate the axes in priority order — this is what they're grading, more than the final pick:

1. **Clarify the client and the interaction.** "Who calls this — a browser, a partner, an internal service? Is it request-response or event-driven? Do I control the client?" Ask before you answer.
2. **State the dominant constraint.** "This is public and read-heavy, so caching and ubiquity dominate → REST." Or "internal, latency-critical, streaming → gRPC."
3. **Name what you'd trade away.** "gRPC costs me browser support and easy debugging; I accept that internally and put REST at the edge."
4. **Volunteer the hybrid.** Real systems mix styles; showing you'd use REST publicly, gRPC internally, and webhooks for events signals experience.
5. **Call out the anti-pattern you're avoiding.** "I won't make clients poll for status — I'll push a webhook."

The failure mode is leading with a style ("GraphQL, because it's modern"). Lead with constraints, arrive at the style, and own the tradeoff.

## API Governance, Lifecycle & DX

### Summary

**What this topic covers**

This topic is about treating an API as a **product with a lifecycle**, not a one-off deliverable — the concerns that dominate once you have more than one API and more than one team. It spans **design governance** (org-wide style guides for naming, errors, and pagination so every API feels like it came from one company), **automated enforcement** (linting with tools like Spectral, plus design review), **backward-compatibility policy and the deprecation-to-retirement lifecycle**, and **developer experience (DX)** — the onboarding path from "developer discovers your API" to "developer makes a successful call": keys, sandboxes, quickstarts, SDKs, and reference docs. It closes with the product framing: **changelogs and communication, monetization and plans, and measuring API success**. The 16 questions cover how large organizations keep hundreds of endpoints consistent, how you evolve and eventually retire APIs without burning consumer trust, and why the best APIs win on DX, not features.

**Mental model**

Two lenses. First, **an API is a UI for developers.** Every rough edge — an inconsistent error shape, a confusing auth flow, a missing code sample — is friction that costs adoption, exactly like a bad button costs conversions. DX is the product, and the metric is time-to-first-successful-call. Second, **an API is a promise you have to keep for years.** Once someone integrates, you're on the hook for backward compatibility; the interesting engineering is *evolving* the contract without breaking the promise. That reframes governance from bureaucracy into the machinery that keeps the promise at scale: style guides so consistency doesn't depend on individual heroics, linting so the guide is enforced in CI rather than in code review, a compatibility policy so "breaking" is defined objectively, and a deprecation lifecycle so retiring anything is a scheduled, communicated process rather than a surprise. The mature org thinks in **portfolio and lifecycle**: many APIs, each moving through design → publish → deprecate → retire, all held to one consistent standard.

**Key terms**

- **API style guide** — org-wide rules for naming, error format, pagination, versioning, so all APIs are consistent.
- **Spectral** — a popular open-source linter that enforces OpenAPI/style-guide rules automatically in CI.
- **Design review** — human review of an API design (usually against the style guide) before it ships.
- **Backward-compatible (non-breaking) change** — adding optional fields/endpoints; existing clients keep working.
- **Breaking change** — removing/renaming fields, tightening validation, changing types; requires a new version.
- **Deprecation** — marking an API/field as "still works, but will be removed"; signaled via `Deprecation`/`Sunset` headers and docs.
- **Sunset / retirement** — the scheduled date an API stops working, after a deprecation window.
- **Developer experience (DX)** — how easy it is to discover, understand, and successfully use the API.
- **Sandbox** — an isolated test environment with fake data and keys, so developers integrate without touching production.
- **SDK / client library** — a generated or hand-written wrapper that makes the API idiomatic in a given language.
- **API as a product** — treating the API as something with users, a roadmap, metrics, and possibly pricing.
- **Time-to-first-call (TTFC)** — how long from signup to a developer's first successful API request; a key DX metric.

**Why interviewers ask this**

These questions separate someone who can build *an* API from someone who can run an API *program*. Juniors focus on the single endpoint; seniors and staff engineers are expected to think about the fifty endpoints, the ten teams shipping them, and the thousands of external developers depending on them. Interviewers probe governance to see if you can make consistency scale without becoming a bottleneck (the answer is automation + guidelines, not a review committee gating everything). They probe lifecycle and deprecation to see if you understand that the hard part of a public API is *changing* it responsibly — that trust, once broken by a surprise breaking change, is expensive to rebuild. And they probe DX because the modern truth is that developer-facing companies (Stripe, Twilio) win on how their API *feels*, not on a feature checklist. Strong answers show empathy for the consumer and a systems view of the whole program.

**Common confusions**

- "Governance means a committee reviews every API" — that doesn't scale; mature governance is automated linting + published guidelines, with human review reserved for genuinely new patterns.
- "Deprecation means turning it off" — deprecation is the *announcement*; the API keeps working through a communicated window until the scheduled sunset.
- "Deprecating fast is fine" — for public APIs, aggressive deprecation destroys trust; windows are months to years and communicated repeatedly.
- "Good docs = complete docs" — completeness isn't enough; DX is about the *guided path* (quickstart, working sample, sandbox) to a first success, not an exhaustive reference nobody reads first.
- "SDKs are optional nice-to-haves" — for many consumers the SDK *is* the API; a bad SDK sinks a good API.
- "Versioning is the compatibility strategy" — versioning is the escape hatch for breaking changes; the *primary* strategy is additive, backward-compatible evolution so you rarely need a new version.

**What follows from this topic**

Governance and lifecycle tie the whole primer together: the style guide encodes the decisions from the resource-design, error-model, pagination, and versioning topics into enforceable rules; the compatibility policy operationalizes the breaking-vs-non-breaking distinction from versioning; the DX section depends on the OpenAPI contracts, auth flows, and consistent errors covered elsewhere. The next topic, Scenario & Design Playbooks, is where you apply all of it under interview pressure — designing concrete APIs that are consistent, evolvable, and pleasant to consume, which is exactly what good governance and DX produce.

### Q1. What is an API style guide and why does an organization need one?

An **API style guide** is a documented set of org-wide conventions every API must follow: resource naming (plural nouns, `snake_case` vs `camelCase` — pick one), the standard error envelope, pagination style, versioning scheme, date/time formats, standard headers, and status-code usage. Think of it as the API equivalent of a code style guide.

The need is **consistency at scale**. Without one, ten teams ship ten dialects: one returns `{ "error": "..." }`, another `{ "message": "..." }`, one paginates with `?page=`, another with `?cursor=`, one uses `userId`, another `user_id`. A developer integrating with three of your APIs has to relearn the rules each time — friction that compounds across your whole surface. A style guide makes the *nth* API feel like the *first*: least astonishment across the portfolio.

The classic example is Google's API Design Guide or Stripe's remarkably uniform surface — every endpoint feels the same because the conventions are fixed. The guide is only useful if it's **enforced** (see Spectral), otherwise it's a wiki page nobody reads.

### Q2. How do you enforce API design consistency automatically?

You move enforcement from human review into CI with a **linter** — most commonly **Spectral**, which lints OpenAPI specs against a ruleset. You codify your style guide as rules, run it on every PR that changes an API spec, and fail the build on violations. That turns "please use plural nouns" from a comment a reviewer might forget into an automated gate.

```yaml
# .spectral.yaml
extends: spectral:oas
rules:
  paths-kebab-case:
    given: $.paths[*]~
    then: { function: pattern, functionOptions: { match: "^(/[a-z0-9-]+)+$" } }
  operation-has-error-response:
    given: $.paths[*][*].responses
    then: { field: "400", function: truthy }
```

The pattern: **automate the mechanical rules** (naming, required error responses, missing descriptions, versioning format) so linting catches 90% of issues instantly and consistently, and **reserve human design review** for the judgment calls a linter can't make — is this the right resource model? does this abstraction leak internals? is this genuinely a new pattern? This keeps review fast and focused, and consistency doesn't depend on any individual reviewer's diligence.

### Q3. What's the difference between a breaking and a non-breaking change?

A **non-breaking (backward-compatible)** change is one an existing client won't even notice. A **breaking** change forces existing clients to update or they'll fail.

| Non-breaking (safe) | Breaking (needs new version) |
|---|---|
| Adding a new optional field to a response | Removing or renaming a field |
| Adding a new endpoint | Removing an endpoint |
| Adding an optional request parameter | Making an optional param required |
| Adding a new enum value (if clients tolerate it) | Changing a field's type |
| Loosening validation | Tightening validation |
| | Changing status codes / error format |
| | Changing default behavior |

The governing principle is the **tolerant reader / additive evolution**: clients should ignore unknown fields, so you can *add* freely but never *remove or change*. The subtle trap is that "adding an enum value" is only safe if clients don't exhaustively switch on the enum and blow up on unknowns — which is why good API docs tell consumers to tolerate new values. Getting this taxonomy right is the foundation of both your versioning strategy and your compatibility policy.

### Q4. What should a backward-compatibility policy contain?

A written compatibility policy tells consumers exactly what they can rely on, so they can build with confidence and you can evolve with clarity. It should state:

- **What counts as breaking vs non-breaking** — the concrete list (renaming a field is breaking; adding one isn't), so there's no ambiguity.
- **The compatibility guarantee per version** — e.g. "within `v1`, we only make additive changes; breaking changes ship as `v2`."
- **The tolerant-reader expectation on clients** — "ignore unknown fields; don't hard-fail on new enum values" — so you *can* add safely.
- **Deprecation windows** — minimum notice before anything is removed (e.g. 12 months for public APIs).
- **Communication channels** — changelog, email, dashboard warnings, response headers.
- **Beta/experimental labeling** — endpoints explicitly outside the guarantee so you can iterate before committing.

The point is to make evolvability a *contract*, not a hope. Stripe's public commitment — "we never make breaking changes without a new dated version" — is the gold standard: consumers know their integration won't break under them, which is precisely why they trust the platform.

### Q5. Walk me through an API's lifecycle from design to retirement.

Four stages, each with its own gates:

```text
DESIGN ──▶ PUBLISH ──▶ DEPRECATE ──▶ RETIRE (sunset)
```

- **Design** — model resources, write the OpenAPI spec, run it through the linter and design review against the style guide, prototype/mock, gather feedback. Cheapest place to fix mistakes.
- **Publish** — release with docs, SDKs, sandbox, and versioning in place. Now you own a backward-compatibility promise; changes must be additive.
- **Deprecate** — the API/version still works, but you've announced it's going away. Signal via `Deprecation` and `Sunset` headers, changelog, email, and docs banners. This is a *communication* phase, not an outage; it may last many months.
- **Retire (sunset)** — on the announced date, the API stops serving (typically returning `410 Gone`). Ideally you've monitored usage down to near-zero before flipping it off.

The mature org runs many APIs across these stages simultaneously and treats each transition as a planned, communicated event. The failure mode is skipping straight from Publish to Retire — pulling something without deprecation — which breaks integrations and torches trust.

### Q6. How do you deprecate an API endpoint without breaking clients?

Deprecation is a *process*, not a delete. The sequence:

1. **Announce early and everywhere** — changelog, email to registered developers, docs banner, and a migration guide to the replacement.
2. **Signal in-band** on every response so even clients who don't read email find out:

```http
HTTP/1.1 200 OK
Deprecation: true
Sunset: Sat, 31 Jan 2026 23:59:59 GMT
Link: <https://api.example.com/v2/orders>; rel="successor-version"
```

3. **Give a generous window** — public APIs: 6–24 months. The `Sunset` header (RFC 8594) carries the retirement date machine-readably.
4. **Monitor usage** — track calls to the deprecated endpoint per consumer; you want it trending to zero before you flip it off.
5. **Reach out to stragglers** — near the deadline, contact the remaining high-volume callers directly.
6. **Retire** — return `410 Gone` (not `404`) so it's clear the resource intentionally no longer exists.

The whole point is *no surprises*: by sunset day, everyone was told, in-band and out-of-band, with time and a migration path. Yanking an endpoint with a `404` and no notice is how you lose developers permanently.

### Q7. What makes for great developer experience (DX) in an API?

DX is how the API *feels* to the developer trying to use it, and the single best proxy is **time-to-first-successful-call**. Great DX means a developer can go from "just found this" to "got a 200 back" in minutes. The ingredients:

- **Frictionless onboarding** — self-serve signup, instant API key, no sales call to start.
- **A quickstart that works** — a copy-pasteable curl or SDK snippet that returns a real response on the first try.
- **A sandbox** — test keys and fake data so they can integrate without touching production or spending money.
- **Consistent, predictable design** — once they learn one endpoint, the rest behave the same (this is where the style guide pays off).
- **Excellent errors** — messages that say what's wrong *and how to fix it*, with a machine-readable code.
- **SDKs** in the languages they use, plus great reference docs with real examples.
- **Interactive docs** — try-it-in-the-browser, so they see a response before writing any code.

Stripe and Twilio are the canonical examples: their APIs win not on unique features but on how effortless they are to adopt. The interview point: DX is a *product* concern, and friction directly costs adoption.

### Q8. What goes into a good developer onboarding flow?

The goal is the shortest possible path from landing on the docs to a successful call. A strong flow:

1. **Instant, self-serve credentials** — sign up, get a **test API key** immediately, no approval queue.
2. **A quickstart, not a reference dump** — one page: "here's a working request, run it now." A copy-pasteable snippet that succeeds:

```bash
curl https://api.example.com/v1/charges \
  -H "Authorization: Bearer sk_test_123" \
  -d amount=2000 -d currency=usd
```

3. **A sandbox by default** — the test key hits fake data, so they can't break anything or get billed while learning.
4. **Progressive disclosure** — quickstart → guides for common use cases → full reference → advanced topics. Don't front-load the OpenAPI spec.
5. **SDKs and a copy button** — reduce the work to paste-and-run.
6. **A clear path to production** — how to get live keys, what the rate limits and pricing are, how to go live safely.

The metric to optimize is **time-to-first-call**: if a developer can't get a `200` in five minutes, many leave. Every step above exists to shorten that.

### Q9. Why do sandboxes and test environments matter, and how do you design one?

A **sandbox** lets developers integrate and test against realistic behavior **without touching production, real data, or real money**. It matters because it removes the two biggest fears during integration: breaking something live, and incurring real costs/side effects (charging a card, sending a real SMS). Lower fear means faster, more confident adoption.

Design principles:

- **Separate credentials** — test keys (`sk_test_...`) that are visibly distinct from live keys (`sk_live_...`), routed to the sandbox automatically.
- **Realistic but fake data** — seeded fixtures and the ability to create test resources that behave like production.
- **Deterministic test triggers** — magic values that force specific outcomes (e.g. card `4000...0002` always declines, a test amount that triggers a specific error) so developers can exercise edge cases and error handling on demand.
- **Full feature parity** — including webhooks: the sandbox should deliver test webhook events so integrators can build and verify their handlers.
- **No real side effects** — no real charges, emails, or shipments.

The mark of a great sandbox is that a developer can test the *unhappy paths* (declines, rate limits, validation errors) as easily as the happy path — that's what makes their production integration robust.

### Q10. Should you provide SDKs, and how do you keep them in sync with the API?

Yes — for most consumers the **SDK *is* the API**. A good SDK makes the API idiomatic (typed objects, native error handling, auth and retries handled for you) and dramatically lowers time-to-first-call. A missing or clunky SDK pushes that work onto every consumer and hurts adoption, especially in typed languages where hand-rolling HTTP is tedious.

Keeping them in sync is the operational challenge, and the answer is **generate, don't hand-write**. Maintain a single source of truth — your **OpenAPI spec** (or protobuf for gRPC) — and generate the SDKs from it (OpenAPI Generator, or a tool like Stripe's/Speakeasy's). Then:

- Every API change flows from the spec → regenerated SDKs, so drift can't accumulate.
- **Version the SDKs** independently but map them to API versions clearly.
- Automate the release: spec change → CI regenerates and publishes SDKs across languages.
- Hand-tune only the ergonomic layer (helper methods, pagination iterators), keeping the generated core untouched.

The anti-pattern is hand-maintaining five language SDKs against a hand-maintained API — they *will* drift, and consumers hit bugs the docs say shouldn't exist. Spec-driven generation is what makes multi-language SDKs sustainable.

### Q11. How should you communicate API changes to consumers?

Assume your consumers won't notice anything you don't actively tell them — so communicate through multiple channels, matched to the change's severity:

- **A changelog** — the canonical, dated, public record of every change (additions, deprecations, fixes). Developers should be able to subscribe (RSS/email).
- **In-band signals** — `Deprecation`/`Sunset` headers and warning fields in responses, so even non-readers get told programmatically.
- **Email to registered developers** — for anything requiring action (deprecations, breaking changes in a new version, incidents). Target by *who actually uses the affected endpoint*.
- **Docs banners and migration guides** — visible where they'll be reading, with concrete "old → new" steps.
- **Dashboard warnings** — flag deprecated-endpoint usage right in their developer console.
- **Advance notice proportional to impact** — a new optional field needs a changelog line; a deprecation needs months of repeated, multi-channel warning.

The principle: **no consumer should ever be surprised.** Breaking someone's integration is bad; breaking it *without warning* is what loses them for good. Over-communicate deprecations and breaking changes; a changelog line is enough for additive ones.

### Q12. What does "treat your API as a product" actually mean?

It means the API has **users, a roadmap, metrics, support, and often a price** — and you manage it accordingly, not as a byproduct of some other system. Concretely:

- **Users, not just callers** — you know who your developers are, what they're building, and where they struggle. You do developer research the way a product team does user research.
- **A roadmap** — the API has a plan: new capabilities, deprecations, DX improvements — communicated publicly.
- **Metrics of success** — adoption, active integrations, time-to-first-call, error rates, endpoint usage (see the measurement question).
- **Support and community** — docs, forums, support channels, developer relations.
- **A lifecycle** — deliberate design → publish → deprecate → retire, not ad hoc.
- **Sometimes a business model** — pricing, plans, quotas (see monetization).

The mindset shift is from "an interface bolted onto a service" to "a product whose customers happen to be developers." Companies like Stripe, Twilio, and Plaid *are* their APIs — the API is the product being sold — and that framing is why they invest so heavily in DX, stability, and docs.

### Q13. How do API monetization and pricing plans work?

When the API *is* the product, you need a model that ties usage to revenue and shapes behavior. Common structures:

- **Free / tiered plans** — a free tier (low quota) for adoption and evaluation, paid tiers (higher quotas, more features, better support/SLAs) as usage grows. Classic freemium funnel: TTFC-friendly free tier → conversion.
- **Pay-as-you-go / usage-based** — per-call or per-unit pricing (per SMS, per API request, per GB). Scales cost with value delivered.
- **Rate limits and quotas as the enforcement layer** — plans are enforced technically through per-key **rate limits** and monthly quotas; exceeding them returns `429` or requires an upgrade.
- **Feature gating** — some endpoints/capabilities only on higher tiers.
- **Enterprise/custom** — negotiated pricing, dedicated SLAs, higher limits.

The mechanics tie directly back to auth (the API key identifies the plan), rate limiting (enforces the tier), and metering (tracks usage for billing). The design tension: make the free tier generous enough to drive adoption and time-to-first-call, but structure limits so heavy/commercial users convert. Pricing also signals intended use — a low free quota with clear upgrade paths guides developers to the right plan.

### Q14. How do you measure whether an API is successful?

You measure it like a product, across adoption, reliability, and DX:

- **Adoption** — number of active integrations / registered developers, and growth over time. Are people actually building on it?
- **Time-to-first-call (TTFC)** — median time from signup to first successful request. The headline DX metric; a rising TTFC signals onboarding friction.
- **Usage** — calls per endpoint, per consumer, over time. Reveals what's actually valuable (and what to deprecate — low-usage endpoints).
- **Reliability** — availability/uptime, latency (p50/p95/p99), and error rates, ideally split by 4xx (client/DX problems) vs 5xx (your problems).
- **Error-rate patterns** — a high 4xx rate on a specific endpoint often means confusing design or bad docs, not bad clients — a DX signal.
- **Retention / churn** — do integrations stay active, or do developers try it and leave?
- **Support load** — volume and themes of support tickets; recurring questions point at docs/DX gaps.

The nuance interviewers want: don't just measure *your* health (uptime, latency) — measure the *developer's* success (TTFC, 4xx patterns, retention). A perfectly reliable API that nobody can figure out how to call is a failed product. Metrics should feed back into DX and roadmap decisions.

### Q15. A team wants to skip design review to ship faster. How do you respond?

I'd reframe the tradeoff rather than defend a gate. The cost of skipping review isn't zero — it's *deferred and amplified*, because once an API is published and consumers integrate, mistakes are frozen in by the backward-compatibility promise. A bad field name or inconsistent error shape caught in review costs an edit; caught after launch it costs a `v2`, a migration, and consumer trust. "Fast now" often means "slow forever."

Then I'd make review *cheap* so speed and quality aren't in tension:

- **Automate the mechanical checks** with Spectral in CI, so 90% of "review" is instant and human review only handles genuinely new design decisions.
- **Provide a style guide and reusable components** so teams get consistency by default and have less to review.
- **Right-size review by blast radius** — a new *public* API gets real scrutiny; an internal, versionable, low-consumer endpoint gets a lightweight check.
- **Make review a fast collaboration, not a committee** — hours, not weeks.

The goal is governance that's a paved road, not a toll booth. If review is slow, fix the review process — don't remove the safeguard that prevents permanent, consumer-facing mistakes.

### Q16. How do you keep hundreds of APIs consistent across many teams without becoming a bottleneck?

The scaling answer is **automation and enablement over gatekeeping** — you can't manually review your way to consistency across dozens of teams. The playbook:

- **A published style guide** as the single source of truth for conventions (naming, errors, pagination, versioning).
- **Automated linting (Spectral) in every pipeline** so the guide is enforced in CI, not in people's heads. Consistency becomes a build step.
- **Shared, reusable building blocks** — a standard error schema, pagination component, auth patterns, and OpenAPI templates teams import rather than reinvent. The paved road makes the consistent choice the *easy* choice.
- **A lightweight central API platform team** that owns the guide, the linter rules, the gateway, and the shared components — enabling teams, not approving every endpoint.
- **Human review only for new patterns** — when someone needs something the guide doesn't cover, that's a design-review conversation that may *update* the guide.
- **Golden-path examples and generators** — scaffold new APIs pre-wired to the standards.

The organizing principle: make the consistent path the path of least resistance, enforce the mechanical rules automatically, and reserve scarce human attention for genuine novelty. That's how large API programs stay coherent without a central team becoming the bottleneck every API waits on.

## Scenario & Design Playbooks

### Summary

**What this topic covers**

This is the applied topic — no new theory, just the design scenarios that dominate real API interviews, worked end to end. You'll design a **REST API for a concrete domain** (orders/e-commerce), a **paginated feed**, an **idempotent payment API with idempotency keys**, a **versioning strategy that evolves a public API without breaking clients**, a **webhook delivery system**, a **tiered rate-limiting scheme**, and a **file-upload API**. You'll also handle the meta-questions: **"REST, GraphQL, or gRPC for this system?"**, **"review this bad API and fix it,"** and **"how do you reason out loud in an API-design interview?"** Every earlier topic — resources, HTTP semantics, errors, pagination, versioning, auth, rate limiting, idempotency, webhooks, security — converges here. The 16 questions are a rehearsal: given a prompt, produce a clean, evolvable, secure contract and *narrate the tradeoffs*, which is exactly what the interviewer is grading.

**Mental model**

An API-design interview is not a quiz with a right answer; it's a **structured conversation where your process is the product**. The mental model is a repeatable loop: **clarify → model → design the happy path → handle the hard parts → state tradeoffs.** Clarify scope and constraints before drawing anything (who calls this? public or internal? scale? consistency needs?). Model the **resources** (nouns) and their relationships before the endpoints. Design the happy-path CRUD with correct HTTP methods and status codes. Then — this is where senior candidates separate — attack the **hard parts** the prompt is really testing: pagination that scales, idempotency for money, versioning that won't break clients, auth and the object-level authorization (BOLA) check, rate limiting, error shapes. Throughout, **think out loud and name what you'd trade**. A slightly imperfect design narrated with clear reasoning beats a perfect design produced in silence. The interviewer is hiring the person who'll make these calls on their team next quarter, so show the calls, not just the conclusion.

**Key terms**

- **Resource modeling** — identifying the nouns (orders, users, feeds) and their relationships before designing endpoints.
- **Idempotency key** — a client-supplied unique token that lets a `POST` be safely retried without double-effect.
- **Cursor pagination** — opaque-token, keyset-based paging that stays stable and cheap as data grows; the right default for feeds.
- **Webhook delivery system** — the infrastructure that reliably pushes events to subscriber URLs (queue, retries, signing, dead-letter).
- **HMAC signature** — a keyed hash on a webhook payload that lets the receiver verify authenticity and integrity.
- **Rate-limit tier** — a quota bound to an API key's plan (free/pro/enterprise), enforced with `429` + `Retry-After`.
- **Presigned URL** — a time-limited, signed URL that lets a client upload/download directly to object storage, bypassing your API server.
- **BOLA / IDOR** — broken object-level authorization; the #1 API security flaw — checking *is this user allowed this object*, not just *is this user logged in*.
- **Envelope** — a consistent response wrapper (`data`, `pagination`, `error`) applied uniformly across endpoints.
- **RFC 7807 problem+json** — a standard machine-readable error body (`type`, `title`, `status`, `detail`).

**Why interviewers ask this**

Scenario questions are the whole ballgame in an API-design interview because they test *synthesis under ambiguity*, not recall. Anyone can define idempotency; the question is whether you can design a payment endpoint that's actually safe to retry, spot that the naive version double-charges, and reach for idempotency keys unprompted. Interviewers watch for: do you **clarify before coding**, or dive into endpoints assuming requirements? Do you **model resources cleanly** or produce RPC-verb soup? Do you catch the **hard parts unprompted** — that a feed needs cursor pagination, that a public API needs a versioning story, that every object fetch needs an authorization check? And crucially, do you **reason out loud and own tradeoffs**? The scenario is a proxy for real work: they're simulating a design discussion you'll have on their team. The best candidates turn a one-line prompt into a guided tour of their thinking, surfacing the tensions and defending their calls.

**Common confusions**

- "There's a single correct design" — there isn't; there are defensible designs with different tradeoffs. The interviewer grades reasoning, not matching a hidden key.
- "Design the endpoints first" — model the *resources and relationships* first; endpoints fall out of a good resource model.
- "Idempotency is automatic for POST" — it's not; `POST` is non-idempotent by default. You engineer it with idempotency keys and a dedup store.
- "Offset pagination is fine for a feed" — it drifts and gets expensive deep in the list; feeds need cursor/keyset pagination.
- "Auth = check they're logged in" — authentication is necessary but not sufficient; the omitted **object-level** check (BOLA) is the #1 real-world API breach.
- "Versioning solves compatibility" — versioning is the escape hatch; the primary strategy is additive, non-breaking evolution so you rarely cut a new version.
- "Reviewing a bad API means listing every nit" — prioritize: lead with the security and correctness flaws, then consistency, then polish.

**What follows from this topic**

This topic is the capstone — it consumes everything the primer taught. The orders API exercises resource modeling, HTTP semantics, and errors; the feed exercises pagination; the payment API exercises idempotency and reliability; the versioning and webhook playbooks exercise evolution and async delivery; the rate-limiting and file-upload scenarios exercise quotas and security (BOLA, presigned URLs); the "which style" and "fix this API" questions exercise judgment. What follows this topic is the interview itself: the same loop — clarify, model, design, harden, narrate — applied live. If you can run that loop out loud on any prompt, you're ready.

### Q1. Design a REST API for an e-commerce orders system. Walk me through it.

I'd start by **clarifying**: public or internal? who places orders (authenticated customers)? scale? For a standard customer-facing store, I model the **resources** first: `customers`, `products`, `carts`, `orders`, and `orders/{id}/items` as a sub-resource. Nouns, plural, no verbs in URIs.

Then the happy-path endpoints with correct methods and codes:

```http
GET    /v1/products?category=books&limit=20    -> 200 (list, paginated)
GET    /v1/products/{id}                        -> 200 / 404
POST   /v1/orders                               -> 201 + Location (create)
GET    /v1/orders/{id}                           -> 200 / 403 / 404
GET    /v1/customers/{id}/orders?status=shipped  -> 200 (nested, filtered)
PATCH  /v1/orders/{id}                            -> 200 (partial update, e.g. cancel)
```

Order creation returns `201` with the new resource and a `Location` header. Cancellation is a `PATCH` to `status` (or a dedicated `POST /v1/orders/{id}/cancellation` if it's a real state machine), not a `DELETE` — you rarely hard-delete an order.

Then I'd surface the **hard parts** unprompted: creating an order should be **idempotent** (idempotency key, so a retried checkout doesn't double-order); every `GET /orders/{id}` needs an **object-level auth check** (does this customer own this order? — BOLA is the #1 flaw); a **consistent error envelope**; and **pagination** on the collections. I'd note the tradeoff: keep the payload a clean DTO, not the internal DB row, so I can evolve storage without breaking the contract.

### Q2. Design a paginated feed API (e.g. a social feed).

The key decision is **cursor pagination, not offset** — a feed is large, constantly changing, and read deep, which is exactly where offset breaks (items shift as new posts arrive, so `?page=3` skips or repeats items, and deep offsets get slow). Cursor/keyset pagination is stable and O(1)-ish.

```http
GET /v1/feed?limit=20 HTTP/1.1
Authorization: Bearer <token>

HTTP/1.1 200 OK
{
  "data": [ { "id": "post_991", "author": "alice", "text": "..." } ],
  "pagination": {
    "next_cursor": "eyJpZCI6InBvc3RfOTcyIn0",
    "has_more": true
  }
}
```

The client fetches the next page with `GET /v1/feed?limit=20&cursor=eyJ...`. The cursor is an **opaque, base64 token** encoding the keyset (e.g. `(created_at, id)` of the last item) — opaque so I can change its internals later without breaking clients. `next_cursor: null` / `has_more: false` signals the end.

Hard parts I'd raise: **stability** (new posts arriving mid-scroll shouldn't duplicate — keyset on an immutable sort handles this); **ranking** (a ranked feed complicates cursors — you may cache a materialized ordering per user); and **no total count** (feeds usually omit it — counting is expensive and pointless for infinite scroll). I'd explicitly reject offset here and explain why.

### Q3. Design an idempotent payment API. How do you prevent double-charges?

Payments are the canonical idempotency problem: the client `POST`s a charge, the network drops the response, the client retries — and without protection you've charged twice. The fix is a client-supplied **idempotency key**:

```http
POST /v1/charges HTTP/1.1
Authorization: Bearer <token>
Idempotency-Key: 9f8a7b6c-uuid-per-attempt
Content-Type: application/json

{ "amount": 4200, "currency": "usd", "source": "card_123" }
```

Server logic:

1. On receipt, look up the `Idempotency-Key` in a store (keyed per account).
2. **First time** — process the charge, then persist `{ key -> (response, status) }` before replying `201`.
3. **Retry (same key seen)** — *don't* re-charge; return the **stored original response**, so the retry is a safe no-op that looks identical to success.
4. Handle the **in-flight race** — if a second request with the same key arrives while the first is still processing, return `409 Conflict` (or block until the first completes) so concurrent retries don't both charge.

Key design points: the client generates the key (a UUID per logical attempt, *reused* across retries of that same attempt); keys expire after a window (e.g. 24h); and the stored result includes the exact response body so retries are byte-identical. I'd note the honest caveat: this gives **effectively-once** semantics via dedup — true "exactly once" across a network doesn't exist; you get at-least-once delivery made safe by idempotency.

### Q4. How do you version a public API to evolve it without breaking clients?

The strategy is **additive evolution first, versioning as the escape hatch**. Day to day, I make only **non-breaking changes** — add optional fields, add endpoints, add optional params — and rely on clients being tolerant readers (ignore unknown fields, don't hard-fail on new enum values). That way most evolution needs *no* version bump.

When a genuinely **breaking** change is unavoidable (removing/renaming a field, changing a type, tightening validation), I cut a new version. My default is **URI versioning** (`/v1/`, `/v2/`) — it's explicit, cache-friendly, and trivially debuggable, which matters most for public APIs:

| Approach | Example | Note |
|---|---|---|
| URI | `/v2/orders` | Explicit, visible, easy to route/cache — my default for public |
| Header | `Accept-Version: 2` | Cleaner URIs, but invisible and easy to forget |
| Media type | `Accept: application/vnd.example.v2+json` | "Correct" REST, but poor DX |

Critically, versioning is paired with a **lifecycle**: `v1` keeps working after `v2` ships; I **deprecate** `v1` with `Deprecation`/`Sunset` headers and a migration guide, give a long window (often 12+ months), monitor usage down, then retire it with `410 Gone`. The whole point: existing integrations never break under the client — they migrate on a schedule they can plan for.

### Q5. Design a webhook delivery system.

The system must reliably push events to subscriber URLs despite failures, and let subscribers trust and dedup what they receive. Architecture:

```text
Event occurs -> enqueue -> Delivery workers -> POST to subscriber URL
                  |                                  |
             (durable queue)                  success? mark delivered
                                              fail? retry w/ backoff
                                              exhausted? dead-letter
```

Design elements:

- **Async via a durable queue** — never deliver inline with the triggering request; enqueue and let workers handle it, so a slow subscriber can't back-pressure your core flow.
- **Retries with exponential backoff + jitter** — subscribers go down; retry on non-2xx (e.g. after 1s, 10s, 1m, 10m, 1h) up to a cap, then **dead-letter** for manual replay.
- **Signing (HMAC)** so the receiver can verify authenticity — sign the payload with a shared secret:

```http
POST /webhooks HTTP/1.1
X-Signature: sha256=3a7bd3e...
X-Event-Id: evt_123
X-Timestamp: 1712345678

{ "type": "order.shipped", "data": { "id": "ord_991" } }
```

The receiver recomputes `HMAC-SHA256(secret, timestamp + body)` and compares; the timestamp guards against replay.

- **Idempotency for the receiver** — deliveries are **at-least-once**, so include a stable `X-Event-Id`; tell subscribers to dedup on it.
- **Ordering not guaranteed** — say so explicitly; if order matters, subscribers sort on a sequence/timestamp in the payload.
- **Observability & self-service** — a dashboard of recent deliveries, response codes, and a **manual replay** button; let subscribers register/verify endpoint URLs.

Hard parts I'd flag: thundering-herd on a recovering subscriber (backoff + jitter), and thin-vs-fat events (send an ID and let them fetch, vs embed the data — I'd lean thin for sensitive data, fat to save round-trips).

### Q6. Design rate limiting for a public API with tiered plans.

Rate limits are bound to the **API key's plan**, enforced per key, and communicated clearly so good clients can self-regulate. I'd use a **token bucket** per key (allows short bursts while capping sustained rate) with limits set by tier:

| Tier | Limit | Burst |
|---|---|---|
| Free | 60 req/min | 100 |
| Pro | 1,000 req/min | 2,000 |
| Enterprise | custom / negotiated | custom |

On every response I return the state so clients don't have to guess:

```http
HTTP/1.1 200 OK
RateLimit-Limit: 1000
RateLimit-Remaining: 998
RateLimit-Reset: 30
```

When the bucket is empty, reject with the right code and a retry hint:

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 12
RateLimit-Remaining: 0
```

Design points: **per-key, not per-IP**, for authenticated APIs (IP is for unauthenticated/abuse cases and NAT'd clients share IPs); the counter lives in a **shared store (Redis)** so limits hold across all API servers; and I'd apply limits at the **gateway** so services don't each reimplement it. Tradeoffs to name: token bucket vs sliding window (token bucket allows bursts, simpler; sliding window is smoother but heavier), and **graceful behavior** — `429` with `Retry-After` and a clear error body beats a silent drop, and separate stricter limits protect expensive endpoints. Limits also double as the enforcement layer for the pricing tiers.

### Q7. Design an API for large file uploads.

The key insight: **don't stream large files through your API server** — proxying gigabytes wastes your compute, memory, and bandwidth. Use **presigned URLs** so the client uploads directly to object storage (S3/GCS), and your API only brokers permission and metadata.

Flow:

```text
1. Client -> POST /v1/uploads {filename, size, content_type}
2. API    -> 201 { upload_id, presigned_url, expires_in: 900 }
3. Client -> PUT <presigned_url> (bytes go straight to object storage)
4. Client -> POST /v1/uploads/{id}/complete
5. API    -> 200 { file_id, url }   (verifies, records metadata)
```

```http
POST /v1/uploads HTTP/1.1
{ "filename": "video.mp4", "size": 524288000, "content_type": "video/mp4" }

HTTP/1.1 201 Created
{ "upload_id": "up_123",
  "presigned_url": "https://storage.example.com/...&X-Signature=...&expires=...",
  "expires_in": 900 }
```

Design considerations I'd raise: **validate up front** — check size/type limits and the caller's quota *before* issuing the URL, and scope the presigned URL tightly (one object, short TTL, size cap). For very large files, use **multipart/resumable upload** (chunks with part numbers, so a dropped connection resumes instead of restarting). Return **`202 Accepted`** if post-processing (virus scan, transcode) is async, with a status resource the client polls or a webhook on completion. Security: the presigned URL is a capability — short expiry, single-use intent, and never log it. This keeps your API servers thin and lets storage do what it's good at.

### Q8. "Review this bad API and fix it." How do you approach it?

I prioritize: **security and correctness first, then consistency, then polish** — not a flat list of nits. Take this endpoint:

```http
GET /getUserData?id=123&admin=true      -> 200 { ...everything... }
```

Problems, in order of severity:

- **BOLA (critical)** — `id=123` with no ownership check lets any caller read any user by guessing IDs. The #1 API flaw. Fix: derive the user from the auth token, or authorize the object (`does the caller own/permission this id?`).
- **Privilege via parameter (critical)** — `admin=true` in the query string is client-controlled authorization. Never trust the client for authz; derive roles server-side from the token.
- **RPC verb in URI** — `getUserData` isn't RESTful. Fix: `GET /v1/users/{id}` (noun, method as verb).
- **Excessive data exposure** — returning the whole record risks leaking fields (password hashes, internal flags). Return an explicit DTO.
- **No versioning** — add `/v1/`.
- **Secrets/PII in URL** — query params land in logs and browser history; sensitive inputs belong in headers/body.

Fixed:

```http
GET /v1/users/{id} HTTP/1.1
Authorization: Bearer <token>        # identity + role come from here, not query
-> 200 { "id": "usr_123", "name": "alice", "email": "..." }   # explicit DTO
-> 403 if caller not authorized for this object
```

Leading with the two security flaws (BOLA, client-controlled admin) is what signals seniority; the naming/versioning fixes are table stakes.

### Q9. "REST, GraphQL, or gRPC for this system?" How do you decide in the moment?

I refuse to answer until I've asked the two questions that settle it: **who's the client, and is it request-response or event-driven?** Then I map constraints to a style out loud:

- **Public API, browser/mobile/third-party, cacheable reads** → **REST**. Ubiquitous tooling, HTTP caching, stable contract for clients I don't control.
- **Many clients needing different field subsets from a rich graph** → **GraphQL**. It solves over/under-fetching; but I'll note the cost (N+1, harder caching) and only pick it if I can name ≥2 clients with genuinely different needs.
- **Internal, service-to-service, latency-sensitive, streaming, I own both ends** → **gRPC**. Protobuf typing, HTTP/2, codegen — but not browser-facing.
- **Event notification / fire-and-forget / long-running** → **webhooks or a message bus**, not synchronous polling.

Then the senior move: **it's usually hybrid.** "REST at the public edge, gRPC between internal services, webhooks for events." I'd name what I'm trading (gRPC's speed for its lack of browser support and debuggability) and the anti-pattern I'm avoiding (exposing gRPC to browsers, or GraphQL over a single trivial service). The interviewer is grading whether I reason from constraints to a choice — so I make the constraints explicit before naming a style.

### Q10. How do you reason out loud in an API-design interview?

Run a visible loop; the process *is* the answer:

1. **Clarify first.** Never draw an endpoint before asking: public or internal? who authenticates? scale/throughput? consistency needs? read- or write-heavy? This alone signals seniority — juniors dive in on assumptions.
2. **Model resources before endpoints.** Say the nouns and relationships out loud (`orders`, `orders/{id}/items`, `customers`). Endpoints fall out of a clean model.
3. **Design the happy path** with correct methods and status codes, narrating choices ("`POST` returns `201` + `Location`").
4. **Attack the hard parts unprompted** — the ones the prompt is really testing: pagination (cursor for feeds), idempotency (keys for payments), versioning (for public), auth *and the object-level check* (BOLA), rate limiting, a consistent error envelope.
5. **State tradeoffs and alternatives.** "I chose cursor over offset because the feed drifts; offset would be simpler but breaks deep-paging." Owning the tradeoff beats pretending there isn't one.
6. **Invite feedback.** "Want me to go deeper on the webhook retries or the auth model?"

The meta-point: a slightly imperfect design narrated with clear reasoning beats a perfect one produced in silence. They're hiring the person who'll make these calls on their team — so show the calls.

### Q11. Design the error responses for your API. What does a good error look like?

A good error is **consistent, machine-readable, and actionable** — the same shape everywhere, a stable code for programs, a message for humans, and enough detail to fix the problem. I'd standardize on RFC 7807 `problem+json` (or a close cousin):

```http
HTTP/1.1 422 Unprocessable Entity
Content-Type: application/problem+json

{
  "type": "https://api.example.com/errors/validation",
  "title": "Validation failed",
  "status": 422,
  "code": "invalid_field",
  "detail": "amount must be a positive integer",
  "errors": [
    { "field": "amount", "issue": "must be > 0" },
    { "field": "currency", "issue": "unsupported: 'xyz'" }
  ],
  "request_id": "req_abc"
}
```

Principles I'd state: a **stable machine code** (`invalid_field`) that clients switch on — never make them parse the human `detail`; a **validation array** so the client sees *all* problems at once, not one at a time; a **`request_id`** so support can trace it; and correct status-code selection — **4xx for client faults** (400 malformed, 401 unauthenticated, 403 unauthorized, 404 missing, 409 conflict, 422 semantic validation, 429 rate-limited) vs **5xx for server faults**. I'd also signal **retryability** — a 429/503 says "retry with backoff," a 400 says "don't bother, fix the request." Consistency is the whole point: one error shape across every endpoint means clients write error handling once.

### Q12. Design an API for a URL shortener. Walk through the resources and the tricky parts.

Clarify first: public? custom aliases allowed? analytics needed? Assume a public service with optional custom aliases and click stats. **Resources**: `links` (the short URLs) and `links/{code}/stats`.

```http
POST /v1/links HTTP/1.1
Idempotency-Key: <uuid>
{ "url": "https://example.com/very/long/path", "alias": "promo" }   # alias optional

HTTP/1.1 201 Created
Location: /v1/links/promo
{ "code": "promo", "short_url": "https://sho.rt/promo",
  "url": "https://example.com/...", "created_at": "..." }

GET  /v1/links/{code}         -> 200 (metadata) / 404
GET  /v1/links/{code}/stats   -> 200 { "clicks": 421, "last_7d": [...] }
DELETE /v1/links/{code}       -> 204
```

The **redirect** itself lives outside the JSON API — hitting `GET https://sho.rt/{code}` returns `301`/`302` to the target (I'd use `302` if I want to count clicks reliably and keep control; `301` caches better but bypasses my counter).

Tricky parts I'd raise: **idempotent creation** (retry shouldn't mint two codes — idempotency key, or dedup by URL); **alias collisions** → `409 Conflict` with a clear code; **validation** of the target URL (reject non-http, guard against SSRF/open-redirect abuse); **rate limiting** creation to stop spam; and **the redirect's cache tradeoff** (301 is cacheable and fast but you lose per-click tracking; 302 keeps the counter honest). Stats are eventually consistent — clicks aggregate async, so I wouldn't promise real-time counts.

### Q13. How would you evolve an existing v1 API when the business needs a breaking change?

I'd exhaust non-breaking options before ever cutting a version, because a new version is a migration cost for every consumer. The decision tree:

1. **Can I make it additive?** If the change is "support a new field/behavior," add it as **optional** alongside the old one — no version bump. Most "breaking" requests aren't actually breaking if reframed additively.
2. **Can I use an expand/opt-in flag?** New behavior behind a request parameter or header, defaulting to old behavior, lets clients opt in on their schedule.
3. **If it's truly breaking** (removing a field, changing a type, restructuring a response), then `v2`:
   - Ship `v2` alongside a **fully-running `v1`** — never migrate anyone forcibly.
   - Publish a **migration guide** with concrete old→new mappings.
   - **Deprecate `v1`** in-band and out-of-band: `Deprecation: true` + `Sunset: <date>` headers, changelog, email to affected consumers.
   - Give a **long window** (12+ months for public), **monitor `v1` usage** trending toward zero, and reach out to stragglers before the deadline.
   - Retire `v1` with `410 Gone`.

The principle I'd emphasize: existing clients must **never break under them** — they migrate on a schedule they can plan. And I'd internally run `v1` as an adapter over the new implementation where possible, so I'm not maintaining two full stacks.

### Q14. Design a "search" endpoint. What are the design decisions?

Search looks simple and hides several decisions. First: **GET or POST?** I default to `GET /v1/search?q=...` because it's cacheable, bookmarkable, and idempotent — but if the query gets complex (nested filters, facets, long payloads that blow past URL limits), I'll offer `POST /v1/search` with a JSON body, accepting the loss of HTTP caching. I'd state that tradeoff explicitly.

```http
GET /v1/search?q=laptop&category=electronics&sort=price&limit=20 HTTP/1.1

HTTP/1.1 200 OK
{
  "data": [ { "id": "prod_1", "name": "..." } ],
  "facets": { "brand": { "acme": 12, "globex": 5 } },
  "pagination": { "next_cursor": "eyJ...", "has_more": true }
}
```

Decisions I'd walk through: **pagination** — cursor over offset, since results are large and can shift (and deep-paging search offsets is slow); **filtering/sorting** as query params with a documented allowlist (don't let clients sort by arbitrary fields — it's a DoS and index problem); **facets/aggregations** in the response for filtered navigation; **relevance** is opaque to the client (I own ranking); **partial matching/typo tolerance** is a backend concern, not a contract change; and **rate limiting** since search is expensive. I'd also cap `limit` server-side and return `400` on unknown filter fields rather than silently ignoring them, so clients get honest feedback.

### Q15. Design a webhook *subscription* management API (the consumer-facing side).

Distinct from the delivery system (Q5), this is how consumers **register and manage** which events get pushed where. Resources: `webhook_endpoints`, each with a URL, a subscribed event list, and a signing secret.

```http
POST /v1/webhook_endpoints HTTP/1.1
{ "url": "https://client.example.com/hooks",
  "events": ["order.shipped", "order.cancelled"] }

HTTP/1.1 201 Created
{ "id": "we_123", "url": "...", "events": [...],
  "secret": "whsec_abc",          # shown once, for HMAC verification
  "status": "enabled" }

GET    /v1/webhook_endpoints            -> 200 (list)
PATCH  /v1/webhook_endpoints/{id}       -> 200 (change URL/events/disable)
DELETE /v1/webhook_endpoints/{id}       -> 204
POST   /v1/webhook_endpoints/{id}/test  -> 202 (send a test event)
```

Design points I'd raise: the **signing secret is returned once on creation** (like an API key) so the consumer can verify HMAC signatures — never retrievable again, only rotatable. **Endpoint verification** — on registration, send a challenge/test event and require a valid response before enabling, so people can't register URLs they don't control (and to prevent using your system to DoS a third party). **A `test` action** so integrators can trigger a sample delivery while building their handler. **Delivery observability** — expose `GET /v1/webhook_endpoints/{id}/deliveries` with recent attempts, response codes, and a **replay** action for failed ones. And **auto-disable** endpoints that fail persistently (with notification), so a dead consumer URL doesn't burn your retry budget forever. This is the DX layer that makes the delivery system usable.

### Q16. An interviewer gives you a vague prompt: "Design an API for a ride-sharing app." How do you scope it?

A deliberately broad prompt is testing whether I **scope before designing** — the worst move is to start listing endpoints for the entire app. I'd narrow it out loud:

1. **Clarify the actors and pick a slice.** "Ride-sharing has riders, drivers, and internal dispatch — three very different API surfaces. Should I focus on the rider-facing API, the driver app, or the internal matching service? I'll assume the **rider-facing ride-request flow** unless you'd rather I cover another." Naming the slices shows I see the whole system; picking one shows I can prioritize.
2. **State the constraints that drive design.** Rider-facing → public-ish, mobile client, real-time (location updates, ride status). That immediately implies **REST for the CRUD** (`POST /v1/rides`, `GET /v1/rides/{id}`) plus a **streaming/push** channel for live driver location and status (WebSocket or SSE — not polling).
3. **Model the core resources.** `rides` (the request→matched→in-progress→completed state machine), `drivers` (location, availability), maybe `quotes` (fare estimates).
4. **Design the happy path**, then **surface the hard parts**: **idempotent ride creation** (a retried request-ride tap mustn't book two cars — idempotency key); **the real-time problem** (push, not poll); **object-level auth** (a rider can only see their own ride — BOLA); **state transitions** modeled explicitly; and **payment idempotency** at trip end.
5. **Check in.** "Want me to go deeper on the matching/dispatch internals, or the real-time location channel?"

The signal I'm sending: I turn ambiguity into a scoped, defensible design, and I drive the conversation rather than waiting to be told what to build.
