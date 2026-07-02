---
type: interview-prep
---

# Observability Interview Primer — 332 Questions

Comprehensive Q+A primer for senior Observability / SRE / DevOps interviews. Third entry in the DevOps track — sister note to the [[Linux Interview Primer]] and [[Kubernetes Interview Primer]]. The discipline of knowing what your systems are doing: the three pillars (metrics, logs, traces), Prometheus & PromQL, instrumentation, SLOs & error budgets, alerting on burn rate, OpenTelemetry, dashboards, incident response, profiling, and cost/cardinality control.

Each answer is interview-shaped: opinionated, concrete, real PromQL and config, failure modes, and production tradeoffs. Concept-first and vendor-neutral, with tools named where they matter (Prometheus, Grafana, Loki, Tempo, OpenTelemetry, Alertmanager, Datadog).

1. [[#Observability Fundamentals & the Three Pillars]]
2. [[#Metrics & Time-Series Fundamentals]]
3. [[#Prometheus Architecture]]
4. [[#PromQL]]
5. [[#Instrumentation & Exporters]]
6. [[#Metrics at Scale & Long-Term Storage]]
7. [[#Logging Fundamentals & Structured Logging]]
8. [[#Log Aggregation & Pipelines]]
9. [[#Distributed Tracing]]
10. [[#OpenTelemetry]]
11. [[#Correlating the Pillars & APM]]
12. [[#SLIs, SLOs & Error Budgets]]
13. [[#Alerting on SLOs & Burn Rate]]
14. [[#Alertmanager & Alert Management]]
15. [[#Grafana & Dashboard Design]]
16. [[#Kubernetes & Cloud-Native Monitoring]]
17. [[#Incident Response & On-Call]]
18. [[#Profiling & Continuous Profiling]]
19. [[#Frontend, Synthetic & Real-User Monitoring]]
20. [[#Cost, Cardinality & Retention Management]]
21. [[#Scenario & Troubleshooting Playbooks]]

---

## Observability Fundamentals & the Three Pillars

### Summary

**What this topic covers**

The vocabulary and mental frame the rest of the primer builds on: what observability actually *is* (and how it differs from plain monitoring), the three pillars of telemetry (metrics, logs, traces) and when each earns its cost, and the method frameworks interviewers expect you to name on demand — the Four Golden Signals, RED, and USE. It also covers the strategic layer: white-box vs black-box monitoring, the control-loop view of a running system, why cardinality is the cost driver that quietly connects every later topic, and the operational metrics (MTTD, MTTR) that justify the whole investment to a budget-holder. The 16 questions here move from warm-ups ("what are the three pillars?") to strategy ("design an observability strategy for a new platform team"). If you can frame *why* you instrument, the tool-specific topics that follow (Prometheus, PromQL, SLOs, OpenTelemetry) become implementation detail rather than trivia.

**Mental model**

Think of a production system as a black box you cannot pause, attach a debugger to, or reproduce locally. Observability is the property that lets you **infer the box's internal state purely from the outputs it emits** — its telemetry. Monitoring is the *act* of watching known signals for known failure modes ("is CPU above 90%?"); observability is the *capability* to ask questions you didn't predict in advance ("why are only Android users in one region seeing p99 latency spikes on checkout, but only after 6pm?"). Monitoring answers known-unknowns; observability lets you chase unknown-unknowns. The shift that matters: with modern distributed systems, you can no longer enumerate every failure mode ahead of time, so you stop trying to pre-build a dashboard for every question and instead emit rich, high-dimensional telemetry you can slice arbitrarily at query time. The three pillars are the raw materials — metrics for cheap aggregate trends, logs for detailed discrete events, traces for causal request flow — and a good practitioner reaches for the cheapest signal that answers the question.

**Key terms**

- **Observability** — the ability to infer a system's internal state from its external outputs (telemetry); measures how well you can debug novel problems.
- **Monitoring** — collecting and alerting on a predefined set of signals for anticipated failure modes; a subset of what observability enables.
- **Telemetry** — the raw data a system emits about itself: metrics, logs, traces (and increasingly, continuous profiles).
- **Known-unknowns** — problems you anticipated and built dashboards/alerts for; monitoring's domain.
- **Unknown-unknowns** — failure modes you never predicted; observability's reason to exist.
- **The three pillars** — metrics, logs, traces: the classic (if incomplete) taxonomy of telemetry signals.
- **Four Golden Signals** — Latency, Traffic, Errors, Saturation (from Google's SRE book).
- **RED** — Rate, Errors, Duration; a request/service-centric method.
- **USE** — Utilization, Saturation, Errors; a resource-centric method (Brendan Gregg).
- **White-box vs black-box** — monitoring from inside the app (instrumented internals) vs from the outside (probes that only see what a user would).
- **Cardinality** — the number of unique label/dimension combinations; the dominant cost and performance driver across all pillars.
- **MTTD / MTTR** — Mean Time To Detect / Mean Time To Recovery; the operational outcomes observability is funded to improve.
- **Symptom-based alerting** — paging on user-visible impact (an SLO breach) rather than on every internal cause.

**Why interviewers ask this**

This topic is the tell for whether a candidate has *operated* systems or only read about them. Junior candidates recite "metrics, logs, and traces" and stop; senior candidates explain the cost and latency tradeoffs of each, know when a trace beats a log, and can name RED vs USE and say *which* they'd apply to a stateless API versus a database node. The strongest signal is economic maturity: understanding that observability is not free, that cardinality and log volume drive the bill, and that the goal is not "collect everything" but "collect the cheapest telemetry that lets you answer the questions that matter, and reduce MTTR." Interviewers also probe strategy — "you're the first SRE at a startup, what do you instrument first?" — to see whether you start from user-facing symptoms (golden signals, SLOs) or get lost instrumenting internals nobody will look at.

**Common confusions**

- "Observability is just the three pillars / just having the right tools" — the pillars are inputs; observability is the *outcome* (can you answer new questions?). You can have all three pillars and poor observability.
- "Monitoring and observability are synonyms" — monitoring is watching known signals; observability is the broader capability to investigate the unforeseen. Monitoring is a subset.
- "More telemetry = better observability" — beyond a point, more data means higher cost, noisier signal, and worse query performance. Signal quality and dimensionality beat raw volume.
- "The golden signals and RED are different, competing things" — RED is essentially the golden signals minus saturation, framed for request-driven services; they overlap heavily.
- "Traces replace logs" / "metrics replace traces" — they answer different questions at different costs; you need all three because each has a blind spot.
- "Cardinality only matters for Prometheus" — it drives cost and performance for logs (Loki labels), traces (attribute explosion), and every vendor's bill.

**What follows from this topic**

Everything downstream is a specialization of what you frame here. Metrics & Prometheus turn "the metrics pillar" into a concrete pull-based TSDB. PromQL turns "aggregate trends" into `rate()` and `histogram_quantile()`. The SLO topic turns "symptom-based alerting" and MTTR into error budgets and multi-burn-rate alerts. Logs & traces expand the other two pillars, and OpenTelemetry unifies all three under one vendor-neutral pipeline. Cardinality — introduced here as the cross-cutting cost driver — reappears as the number-one footgun in almost every later topic. Get the framing right and the rest is implementation.

### Q1. What is observability, and how is it different from monitoring?

**Monitoring** is watching a predefined set of signals for failure modes you anticipated — dashboards and alerts for *known-unknowns*. You decide in advance "CPU over 90% is bad" and wire an alert.

**Observability** is a property of the system: how well you can **infer its internal state from the telemetry it emits**, including for problems you never predicted — *unknown-unknowns*. It's the difference between "is the thing I'm watching broken?" and "something is broken and I have no dashboard for it — can I still figure out why?"

The practical distinction:

- Monitoring answers **"is it working?"** — a yes/no against thresholds you set ahead of time.
- Observability answers **"why isn't it working?"** — arbitrary questions asked at investigation time, sliced by dimensions you didn't pre-aggregate.

Monitoring is a subset of what a well-instrumented, observable system lets you do. You build monitoring *on top of* observable telemetry. A system can be heavily monitored (100 dashboards) yet have poor observability (every novel incident is a mystery) if the telemetry can't be sliced by the dimension that actually matters.

### Q2. What are the three pillars of observability, and what is each good and bad at?

Metrics, logs, and traces. Each is strong exactly where the others are weak:

| Pillar | What it is | Strengths | Weaknesses / cost |
|---|---|---|---|
| **Metrics** | Numeric measurements over time (time series) | Cheap to store, fast to query, aggregatable, ideal for alerting and trends/dashboards | No per-event detail; high cardinality (many label combos) blows up cost |
| **Logs** | Timestamped discrete event records (text or structured) | Rich detail, arbitrary context per event, great for forensic "what exactly happened" | Expensive at volume; hard to aggregate; noisy; index cost |
| **Traces** | Causally linked spans of one request across services | Shows *where* time goes and *which* service failed in a distributed call | Needs propagation + sampling; storage heavy; incomplete without full instrumentation |

Rule of thumb: reach for the **cheapest** signal that answers the question. Alert on **metrics** (cheap, aggregatable). When an alert fires, use **traces** to localize *which* service/hop is slow or erroring. Then read the **logs** of that specific service to see the exact error/context. Metrics tell you *that* something is wrong and roughly where; traces tell you *where* in the request path; logs tell you *what* exactly.

### Q3. Why do you need all three pillars? Can't logs alone do everything?

Logs alone *feel* sufficient until you scale, and then each blind spot bites:

- **Aggregation/alerting**: computing "p99 latency over the last 5 minutes across 200 pods" from raw logs is slow and expensive. A histogram metric answers it in milliseconds. You want to **alert on metrics**, not scrape logs.
- **Cost at volume**: logging every request at full detail is often the single largest observability line item. Metrics compress millions of events into a few time series.
- **Distributed causality**: in a request that touches 8 services, logs are scattered across 8 systems with no inherent link. A **trace** stitches them into one causal timeline with per-hop timing — something no single service's logs can show.

They complement rather than substitute: **metrics** are the cheap always-on layer for detection and trends; **traces** localize *where* in a distributed path a problem lives; **logs** give the high-fidelity detail once you know where to look. Drop one and you either can't afford full coverage (logs-only), can't detect fast (traces-only), or can't explain the "why" (metrics-only). Modern practice (OpenTelemetry) links all three — exemplars connect a metric spike to a trace, and trace IDs appear in logs.

### Q4. What are the Four Golden Signals?

From Google's SRE book — if you can only instrument four things for a user-facing service, instrument these:

- **Latency** — how long requests take. Crucially, **separate successful from failed** latency; a fast error is still an error, and slow errors distort your success percentiles.
- **Traffic** — demand on the system: requests/sec, transactions/sec, or a domain equivalent.
- **Errors** — rate of failed requests (explicit 5xx, plus implicit failures like wrong content or policy violations).
- **Saturation** — how "full" the system is; the resource nearest its limit (CPU, memory, I/O, queue depth). Often the leading indicator of imminent latency/error problems.

They give a compact health picture and map cleanly onto SLIs. The first three (latency, traffic, errors) are request-centric and overlap with RED; saturation is the resource-centric one that warns you *before* the others degrade.

### Q5. RED vs USE — what's the difference and when do you use each?

Two complementary methods for choosing what to measure:

| | RED | USE |
|---|---|---|
| Stands for | **R**ate, **E**rrors, **D**uration | **U**tilization, **S**aturation, **E**rrors |
| Focus | **Request-driven services** | **Resources** (CPU, memory, disk, NIC, queues) |
| Origin | Tom Wilkie | Brendan Gregg |
| Answers | "Is my service healthy from the caller's view?" | "Is this resource the bottleneck?" |
| Per | Each service / endpoint | Each resource |

**RED** — for anything that serves requests (an API, a web front end). Rate = requests/sec, Errors = failed requests/sec, Duration = latency distribution. It's essentially the golden signals minus saturation, applied per service.

**USE** — for resources you might be exhausting. Utilization = % time busy, Saturation = queued/waiting work (the part that can't be serviced *right now*), Errors = error events (e.g. NIC drops, disk errors).

In practice you use both: **RED** on your services to see user-facing symptoms, **USE** on the underlying resources to explain *why* (a saturated disk explains the elevated Duration). RED for the "what's broken," USE for the "why."

### Q6. What is the difference between white-box and black-box monitoring?

**White-box** — monitoring based on internals the system exposes: metrics from instrumented code, `/metrics` endpoints, logs, traces. You see *why* — queue depths, GC pauses, cache hit rates, per-endpoint latency. It's rich but reflects what the *system thinks* is happening.

**Black-box** — monitoring from the outside, as a user experiences it: synthetic probes, health checks, HTTP pings, DNS/TLS checks (e.g. Prometheus blackbox_exporter). It tells you *symptoms* — "the login page returns 500 from outside the cluster" — without knowing the cause.

You need both. **Black-box** is symptom-oriented and catches things white-box misses: the load balancer is misconfigured, DNS is broken, a whole region is unreachable — cases where your internal metrics look fine because requests never arrive. It's also great for alerting because it correlates with actual user pain. **White-box** is what you use to *diagnose* once black-box (or an SLO) tells you something's wrong. Classic pairing: page on black-box/symptom signals, debug with white-box.

### Q7. Explain the control-loop / feedback view of observability. Why does it matter?

A production system plus its operators forms a **feedback control loop**: the system emits telemetry (the sensor reading), humans or automation compare it to a desired state (SLOs, thresholds), and act to correct drift (scale up, roll back, page an engineer, trip a circuit breaker). Observability is the **sensing** half of that loop — without good outputs, you're steering blind.

Why it matters in an interview: it reframes observability from "collect data" to "close the loop." Telemetry that nobody acts on is waste. The framing drives concrete decisions:

- Instrument what you'd actually *act* on. If no action follows a metric, question whether to collect it.
- Latency of the loop is MTTD + decision time + MTTR. Observability's job is to shrink each.
- Automation can close fast loops (autoscaling on saturation, automated rollback on error-rate spikes); humans close slow ones (incident response). Good telemetry feeds both.

It also explains **alert fatigue**: too many low-quality signals desensitize the operator, breaking the loop just as surely as having no signal. The goal is a *high signal-to-noise* control loop, not maximal data.

### Q8. Why is cardinality the cross-cutting cost driver in observability?

**Cardinality** is the number of unique combinations of a metric's name and its label values (or, for logs/traces, the number of distinct attribute combinations). Each unique combination is a separate time series / index entry that must be stored, kept in memory, and scanned at query time.

It's cross-cutting because it drives cost and performance in *every* pillar:

- **Metrics**: each label-value combo is its own time series. Add a `user_id` label with 1M users and one metric becomes 1M series — memory and storage explode, queries slow to a crawl. This is the number-one way to melt a Prometheus.
- **Logs (Loki)**: Loki indexes *labels*, not full text — high-cardinality labels destroy its index just like Prometheus.
- **Traces**: unbounded span attributes bloat storage and indexes.
- **Vendor bills**: most SaaS observability pricing is effectively a function of cardinality and volume.

The footgun: labels multiply *combinatorially*. `method` (5) × `status` (6) × `endpoint` (50) = 1,500 series — fine. Add `user_id` (unbounded) and it's unbounded. The rule: labels must be **bounded and low-cardinality**. Put high-cardinality data (user IDs, request IDs, emails) in *logs or trace attributes* — never metric labels. This single concept resurfaces in nearly every later topic.

### Q9. What's the difference between telemetry and observability?

**Telemetry** is the *data* a system emits about itself — the metrics, logs, traces (and profiles) flowing out. It's the raw material.

**Observability** is the *capability* that telemetry (plus tooling and instrumentation quality) gives you: how well you can answer arbitrary questions about the system's internal state, especially unforeseen ones.

The distinction matters because they're often conflated in vendor pitches. You can emit *terabytes* of telemetry and still have *poor* observability if it's the wrong dimensions, un-queryable, or not correlated. Conversely, a small volume of well-chosen, high-dimensional, correlated telemetry can yield excellent observability. Telemetry is necessary but not sufficient: observability = telemetry + the ability to slice, correlate, and explore it to answer questions you didn't pre-plan. When someone says "we bought observability," push back — they bought a telemetry pipeline; observability is the outcome they have to earn with good instrumentation.

### Q10. What are MTTD and MTTR, and how does observability reduce them?

- **MTTD (Mean Time To Detect)** — average time from an issue starting to someone/something noticing it.
- **MTTR (Mean Time To Recovery/Repair)** — average time from detection to service restored. (Sometimes split further: acknowledge, diagnose, mitigate, resolve.)

They're the operational KPIs that justify observability spend, because incident cost ≈ impact × duration, and duration = MTTD + MTTR.

Observability attacks both:

- **MTTD**: symptom-based alerting on SLOs/golden signals catches user impact fast; you detect from the outputs rather than waiting for a customer to complain.
- **MTTR**: the biggest chunk is usually *diagnosis*, and that's exactly what the three pillars accelerate — metrics narrow the blast radius, traces localize the failing hop, logs give the exact error, and correlation (exemplars, trace IDs in logs) removes the manual stitching. Good runbooks tied to alerts shrink it further.

In interviews, always connect a proposed instrumentation to one of these: "adding per-dependency RED metrics cuts MTTR because we stop guessing which downstream is slow." That's the language that gets observability funded.

### Q11. Design a high-level observability strategy for a new platform team. Where do you start?

Start from **user-facing symptoms and work inward** — don't begin by instrumenting internals nobody queries.

1. **Define SLIs/SLOs first.** Pick a handful of user journeys (checkout, login) and define what "good" means as SLIs (availability, latency). This anchors everything: it decides what to alert on and what to prioritize.
2. **Instrument the golden signals / RED** on every service — latency (success vs error separated), traffic, errors, saturation. This is the cheap, high-value baseline.
3. **Symptom-based alerting only.** Page on SLO breaches / user impact, not on every CPU spike. Route everything else to dashboards/tickets. Aggressively prevent alert fatigue.
4. **Structured logging with correlation IDs**, sampled and volume-controlled, so forensic detail exists without bankrupting you.
5. **Distributed tracing** on the critical paths (OpenTelemetry) so you can localize latency across services.
6. **Standardize the pipeline** — one instrumentation standard (OTel), consistent labels/naming, so telemetry is consistent and portable across vendors.
7. **Guardrails on cost**: cardinality limits, sampling, retention tiers.

The throughline: instrument what you'll *act on*, prefer the cheapest signal, and measure success by MTTD/MTTR and alert quality — not by how much data you collect. Golden signals give 80% of the value; resist the urge to boil the ocean.

### Q12. What is observability-driven development?

**Observability-driven development (ODD)** is treating telemetry as a first-class part of building a feature, not an afterthought bolted on before launch. You decide *how you'll know this feature is healthy in production* while you're writing it — emitting the metrics, structured logs, and trace spans that let you answer "is this working, and if not, why?" from day one.

Concretely:

- Instrument new code paths with RED metrics and meaningful span attributes as you write them.
- Add the SLI/SLO for the feature before it ships, so "done" includes "observable."
- Use telemetry to validate rollouts (feature-flag or canary): watch the golden signals for the new cohort, not just "does it compile."
- Ask "what question would I want to answer at 3am about this code?" and make sure the telemetry answers it.

It parallels test-driven development: TDD asks "how will I know this is correct?", ODD asks "how will I know this is *healthy in production*?" The payoff is dramatically lower MTTR, because the telemetry you need already exists when the incident starts — you're not adding logging in the middle of an outage.

### Q13. Describe a common observability maturity model.

Most models describe a progression roughly like this (names vary by vendor, the shape is consistent):

1. **Reactive / firefighting** — little instrumentation; you learn about outages from customers. Ad-hoc logs, SSH into boxes, `grep`. MTTD is "whenever someone complains."
2. **Proactive monitoring** — dashboards and threshold alerts on infrastructure (CPU, memory, disk). Known-unknowns covered, but alerts are cause-based and noisy; still blind to novel issues.
3. **The three pillars in place** — metrics + centralized logs + tracing exist; golden signals/RED on services. You can investigate, but signals aren't correlated and alerting isn't yet tied to user impact.
4. **SLO-driven / symptom-based** — SLIs/SLOs defined, error budgets drive priorities, alerting is on user-facing symptoms with multi-burn-rate. Correlated telemetry (trace IDs in logs, exemplars). Alert fatigue actively managed.
5. **Observability as culture / data-driven** — observability-driven development, standardized pipeline (OpenTelemetry), telemetry feeds automated control loops (autoscaling, auto-rollback), continuous cost/cardinality governance, and telemetry informs product/business decisions.

Interview use: place an org honestly, then name the *next* concrete step. A team drowning in cause-based alerts (level 2–3) shouldn't buy more dashboards; it should define SLOs and move to symptom-based alerting (level 4). Maturity is about signal quality and closing the loop, not tool count.

### Q14. Walk me through how you'd debug an "everything is slow" report using the three pillars.

I move from cheap-and-broad to expensive-and-narrow:

1. **Metrics first (is it real, and where?)** — check the golden signals / RED dashboards. Is latency actually up, on which service, which endpoints, since when? Correlate with traffic (a spike?) and saturation (CPU/memory/queue depth near limits?). Check the deploy timeline — did a release line up with the onset? This scopes the blast radius in seconds without touching a log.
2. **Traces next (where in the path?)** — pull traces for slow requests on the affected endpoint. The waterfall shows *which hop* eats the time: is it our service's own compute, a slow downstream dependency, a database call, or lock/queue wait? Compare a slow trace against a fast baseline. This is what stops the "blame the database" guessing game.
3. **Logs last (what exactly?)** — now that traces have pointed at, say, the payments dependency, read *that* service's logs for the affected window (filtered by the trace ID) to see the concrete error, timeout, or slow query.

Throughout: use exemplars/trace IDs to jump between pillars instead of manually correlating timestamps. The discipline is not "grep all the logs" — it's use metrics to scope, traces to localize, logs to explain. Doing it in that order is the difference between a 5-minute and a 2-hour MTTR.

### Q15. When would you deliberately *not* add a metric, log, or trace? Isn't more data always safer?

No — more data has real, compounding costs, and a senior answer shows you weigh them:

- **Cost**: high-cardinality metrics, verbose logs, and un-sampled traces are often the biggest line items. Every series/log/span is stored, indexed, and queried forever (until retention).
- **Performance**: high cardinality slows queries and can OOM a Prometheus; log volume slows ingestion and search.
- **Signal-to-noise**: noise buries the useful signal and fuels alert fatigue, which *increases* MTTR.
- **Privacy/compliance**: logging PII (emails, tokens, card numbers) is a liability, not an asset.

So I *don't* add telemetry when:

- It's high-cardinality as a **metric label** (user_id, request_id) — that belongs in logs/traces, not a metric dimension.
- No action would ever follow it (nobody would alert or investigate on it) — it fails the control-loop test.
- It duplicates a cheaper existing signal.
- It captures sensitive data without a scrubbing/redaction path.

The principle: instrument for the questions you'll actually ask and the actions you'll actually take, and pick the cheapest signal that answers them. "Collect everything" is how you get a huge bill *and* worse observability.

### Q16. A team says "we have 300 dashboards and 500 alerts, so we're very observable." What's your reaction?

That's a monitoring *volume* metric, and it may actually indicate the opposite of good observability. Red flags:

- **300 dashboards** usually means nobody knows which one to open during an incident — and each is a pre-baked answer to a *known* question. Observability is about answering *unforeseen* questions, which no pre-built dashboard covers.
- **500 alerts** almost guarantees **alert fatigue**. If most are cause-based (CPU, disk) rather than symptom-based (SLO breach), on-call is drowning in noise, ignoring pages, and MTTD is *worse* despite the count.

The questions I'd ask to assess *real* observability:

- Are you alerting on **user-facing symptoms/SLOs**, or on internal causes? What's your alert-to-incident ratio and page-acknowledgement rate?
- When a *novel* problem hits — one with no existing dashboard — can you slice your telemetry by an arbitrary dimension to find it? Or are you blind outside the pre-built views?
- Are the three pillars **correlated** (jump from a metric spike to a trace to the log)?
- What are your MTTD/MTTR trends? That's the outcome that matters, not dashboard count.

The reframe: dashboards and alerts are outputs, not outcomes. I'd rather have 20 dashboards, symptom-based alerting on a handful of SLOs, and high-dimensional queryable telemetry than 300 dashboards and 500 noisy alerts.

## Metrics & Time-Series Fundamentals

### Summary

**What this topic covers**

The metrics pillar in depth: what a time series actually is, the four Prometheus metric types (counter, gauge, histogram, summary) and when each is correct, how labels create dimensions and how those dimensions multiply into cardinality, and the statistics that trip people up — why you compute `rate()` over counters, why averages lie, and why you can't average percentiles. It also covers histograms vs summaries (the aggregatability tradeoff, and native/exponential histograms), naming and unit conventions, push vs pull, and the sampling/resolution/staleness concerns that decide how much a metric actually tells you. The 16 questions run from "what's a counter" to "our metrics bill is exploding — diagnose it." This is the numeric foundation the Prometheus and PromQL topics operationalize; if the difference between a counter and a gauge, or between a histogram and a summary, is fuzzy, every PromQL query you write later will be subtly wrong.

**Mental model**

A metric is not a number — it's a **named stream of (timestamp, value) samples**, and the name plus a set of key-value **labels** uniquely identifies one such stream (one *time series*). `http_requests_total{method="GET", status="200", job="api"}` and `http_requests_total{method="GET", status="500", job="api"}` are *two different series* that happen to share a name. The database (a TSDB) stores each series as a compact, append-only sequence of samples. From that one idea, everything follows: adding a label doesn't add a column, it *forks* the metric into more series (cardinality); a counter only makes sense if you look at its *rate of change*, not its raw value; a histogram is just a clever family of counters (one per bucket) that lets you reconstruct percentiles at query time. The second mental shift: metrics are **aggregates, not events** — they deliberately throw away per-request detail to be cheap and fast. That's their strength (alerting, trends) and their limit (no "what happened to *this* request" — that's logs/traces).

**Key terms**

- **Time series** — a stream of timestamped numeric samples identified by a metric name + label set.
- **Sample** — a single (timestamp, value) data point in a series.
- **Label / dimension** — a key-value pair that, combined with the metric name, identifies a distinct series.
- **Counter** — a monotonically increasing value (resets to 0 on restart); query with `rate()`/`increase()`, never read raw.
- **Gauge** — a value that goes up and down (temperature, queue depth, memory in use); read directly.
- **Histogram** — samples observations into cumulative **buckets** (`_bucket`), plus `_sum` and `_count`; quantiles computed *server-side* via `histogram_quantile()`; aggregatable across instances.
- **Summary** — computes selected **quantiles client-side** (plus `_sum`/`_count`); cheap to read but its quantiles **cannot be aggregated** across instances.
- **Cardinality** — number of unique label combinations = number of series; the dominant cost driver.
- **Rate** — per-second average change of a counter over a range vector; the standard way to make counters meaningful.
- **Quantile / percentile** — the value below which p% of observations fall (p50/p95/p99); percentiles **can't be averaged**.
- **Native (exponential) histogram** — newer Prometheus histogram with automatically-sized exponential buckets; high resolution at far lower series cost than classic buckets.
- **Staleness** — how Prometheus marks a series as no longer present when scrapes stop returning it.

**Why interviewers ask this**

Metrics fluency is the fastest way to sort candidates. Everyone knows "counter goes up"; the signal is in the edges. Do you reach for `rate()` because counters reset on restart and raw counter values are meaningless? Can you explain *why* you can't just average p99s from ten pods (and what to do instead — aggregate the histogram buckets)? Do you know a summary's quantiles are un-aggregatable, which is exactly why histograms usually win in a distributed system? And the money question: can you look at an exploding metrics bill and immediately suspect **cardinality** — a high-cardinality label like `user_id` or `request_id` — rather than raw traffic? These distinctions separate people who've operated Prometheus at scale from people who've only added a `Counter` to a demo app. Getting the histogram-vs-summary and cardinality answers right signals real production time.

**Common confusions**

- "A counter can go down" — no; a counter is monotonic and *resets* to 0 on process restart. That reset is exactly why you use `rate()`/`increase()`, which handle resets.
- "Read the counter value directly to see requests" — the raw value is meaningless (it's cumulative since process start and resets); you almost always want its rate.
- "Averages are a fine summary of latency" — averages hide the tail; one slow p99 that hurts users is invisible in a mean. Use percentiles.
- "I'll average the p99 from each pod to get the overall p99" — mathematically invalid. Aggregate the underlying histogram buckets, *then* compute the quantile.
- "Histograms and summaries are interchangeable" — summaries give exact client-side quantiles but can't be aggregated across instances; histograms give approximate, *aggregatable* quantiles. In distributed systems, histograms usually win.
- "More labels = better metrics" — labels multiply into series; unbounded labels (user_id) are the classic cardinality bomb.
- "Metrics can tell me what happened to a specific request" — no; metrics are aggregates. Per-request detail is logs/traces.

**What follows from this topic**

These primitives are what Prometheus stores and PromQL queries. The counter/gauge/histogram/summary distinction dictates which PromQL function is valid (`rate()` needs a counter; `histogram_quantile()` needs histogram buckets). Cardinality, introduced here, is the thing the Prometheus Architecture topic must engineer around (memory, TSDB limits) and the number-one cause of the "why is our bill exploding" incident. Histograms feed the SLI/SLO topic directly — latency SLOs are computed from histogram buckets. And the aggregatability property is exactly why OpenTelemetry and long-term-storage systems care so much about histogram (especially native histogram) support.

### Q1. What is a time series?

A **time series** is a stream of timestamped numeric samples, uniquely identified by a **metric name plus a set of labels**. Formally: `metric_name{label1="a", label2="b"} → [(t0, v0), (t1, v1), (t2, v2), ...]`.

The key insight that trips people up: the labels are *part of the identity*. These are **two distinct time series**, not one metric with sub-values:

```promql
http_requests_total{method="GET", status="200"}   # series A
http_requests_total{method="GET", status="500"}   # series B
```

A time-series database (TSDB) stores each series as a compact, append-only sequence of (timestamp, value) samples, heavily compressed because consecutive timestamps and values tend to be regular. Prometheus, for instance, samples each series at a fixed **scrape interval** (say every 15s), producing one sample per interval per series.

Two consequences flow from this definition. First, **cardinality**: the number of series equals the number of unique label combinations, so adding labels multiplies your storage. Second, metrics are **aggregates over time**, not an event log — a series tells you the value *at each sample point*, deliberately discarding the individual events between samples. That's what makes metrics cheap and fast, and also why they can't answer "what happened to *this specific* request."

### Q2. What are the four Prometheus metric types, and when do you use each?

| Type | Behavior | Read with | Use for |
|---|---|---|---|
| **Counter** | Monotonically increases; resets to 0 on restart | `rate()`, `increase()` | Counts of events: requests, errors, bytes sent |
| **Gauge** | Goes up and down | Read directly; `avg`, `max`, `delta` | Current state: temperature, memory in use, queue depth, in-flight requests |
| **Histogram** | Buckets observations; exposes `_bucket`, `_sum`, `_count` | `histogram_quantile()` on bucket rates | Distributions where you need percentiles: request latency, response size |
| **Summary** | Client-computed quantiles + `_sum`, `_count` | Read quantile series directly | Percentiles when you *can't* aggregate across instances and want exactness locally |

Quick decision guide:

- Counting things that only ever go up → **counter** (and remember to `rate()` it).
- A value that can rise and fall right now → **gauge**.
- You need latency percentiles across many instances → **histogram** (aggregatable server-side quantiles).
- You need exact local quantiles on a single instance and won't aggregate → **summary** (but see the histogram-vs-summary tradeoff — histograms usually win in distributed systems).

### Q3. Why do you use `rate()` on a counter instead of reading its value? What happens on restart?

A counter's raw value is **cumulative since the process started** and is essentially meaningless on its own — `http_requests_total` being `4,238,911` tells you nothing actionable. What you care about is *how fast it's increasing*: requests per second. `rate(http_requests_total[5m])` gives the per-second average increase over the last 5 minutes.

The restart problem makes this mandatory, not just convenient. When a process restarts, its counters **reset to 0**. If you naively did `current - previous`, a restart would produce a huge *negative* number (e.g. from 4.2M back to 500). `rate()` and `increase()` are **counter-reset-aware**: they detect the drop, treat it as a reset, and correct for it, so a restart doesn't corrupt your rate. That's the whole reason Prometheus distinguishes counters from gauges — the type tells PromQL "this can reset; handle it."

```promql
# per-second request rate over 5m, correct across restarts
rate(http_requests_total[5m])

# total requests in the last hour (also reset-aware)
increase(http_requests_total[1h])
```

Rule: **never** alert or graph a raw counter; always wrap it in `rate()`/`increase()`. Use `irate()` only for fast-moving graphs, not alerts (it's too spiky).

### Q4. What are labels/dimensions, and how do they turn one metric into many series?

**Labels** are key-value pairs attached to a metric that add dimensions you can filter and aggregate by. `http_requests_total{method="POST", status="500", endpoint="/checkout"}` lets you later ask "error rate for POST /checkout" via PromQL.

The crucial mechanical fact: **each unique combination of label values is a separate time series.** Labels don't add columns to one series — they *fork* the metric into the Cartesian product of their values:

```
method:   GET, POST, PUT, DELETE, PATCH        (5)
status:   200, 201, 400, 404, 500, 503         (6)
endpoint: /a, /b, ... (50 endpoints)           (50)
--------------------------------------------------
series = 5 × 6 × 50 = 1,500 time series for ONE metric name
```

That multiplication is why labels are powerful *and* dangerous. Bounded, low-cardinality labels (HTTP method, status class, service name) give you rich slice-and-dice for cheap. But add one **unbounded** label — `user_id`, `request_id`, `email`, `full URL with query string` — and the series count explodes without limit, which is the classic way to melt a Prometheus. The design rule: labels must be **bounded and known-in-advance**; put anything high-cardinality into logs or trace attributes instead.

### Q5. What is cardinality, and why is putting `user_id` or `request_id` in a label a disaster?

**Cardinality** is the number of unique time series a metric produces — i.e. the number of distinct label-value combinations. Each series costs memory (Prometheus holds active series in RAM), storage, and query time.

`user_id` / `request_id` / `email` as labels are catastrophic because they're **unbounded and high-cardinality**:

- A `request_id` is unique *per request* — so every single request creates a **brand-new time series** that gets exactly one sample and is never seen again. This is the worst case: infinite series, zero aggregation value.
- A `user_id` with 5 million users multiplies *every* metric carrying it by up to 5 million.

The failure mode is severe: active-series count drives Prometheus memory, so unbounded labels cause **OOM kills**, slow queries, and blown-up storage/bills. And it defeats the *purpose* of metrics — metrics exist to aggregate; a label that's unique per event can't be aggregated over, so it's pure cost with no benefit.

The fix: **never** put per-entity identifiers in metric labels. If you need to trace an individual user or request, that's what **logs and traces** are for (put `user_id` in structured log fields / span attributes). Metrics answer "how many / how fast / how slow, sliced by *bounded* categories." If you must know cardinality per label, that's the first thing to audit when a bill spikes.

### Q6. What are the basics of aggregation across series (sum, avg, max)?

Because a metric is usually many series (one per instance/label combo), you constantly need to collapse them into a meaningful total or summary. Prometheus does this with **aggregation operators** plus a `by`/`without` clause that controls the grouping:

```promql
# total request rate across ALL instances and endpoints
sum(rate(http_requests_total[5m]))

# request rate grouped by status code (keep only the status dimension)
sum by (status) (rate(http_requests_total[5m]))

# same, expressed as "drop the instance dimension"
sum without (instance) (rate(http_requests_total[5m]))

# highest current memory usage among pods
max by (pod) (process_resident_memory_bytes)

# average queue depth across workers
avg(worker_queue_depth)
```

Key rules:

- **`sum`** is right for *rates and counts* (total throughput, total errors) — they're additive.
- **`avg`/`max`/`min`** suit *gauges* (mean/peak memory, max queue depth).
- **`by (labels)`** keeps only the listed labels (groups by them); **`without (labels)`** keeps everything except the listed ones. `by` is usually clearer for "I want this broken down by X."
- **Never `avg` a percentile.** Averaging p99 across instances is invalid (see the percentile question) — aggregate histogram *buckets* first, then compute the quantile.

Getting the additive-vs-non-additive distinction right (sum rates, avg/max gauges) is a common interview check.

### Q7. Histograms vs summaries — what's the tradeoff?

Both capture a *distribution* (e.g. request latency) so you can get percentiles, but they differ fundamentally in *where* the quantile is computed:

| | Histogram | Summary |
|---|---|---|
| Quantiles computed | **Server-side** at query time, from buckets | **Client-side** in the app, at scrape time |
| Exposes | `_bucket{le=...}`, `_sum`, `_count` | `{quantile="0.99"}`, `_sum`, `_count` |
| **Aggregatable across instances** | **Yes** — sum the buckets, then quantile | **No** — can't combine quantiles |
| Accuracy | Approximate (depends on bucket boundaries) | Exact for the configured quantiles (per instance) |
| Query cost | Compute quantile at query time | Cheap read (precomputed) |
| Flexibility | Any quantile at query time | Only the quantiles pre-chosen in code |

The decisive property is **aggregatability**. In a distributed system with N instances, you want the *overall* p99, and you **cannot** get it from N per-instance summary quantiles (you can't average p99s). With histograms you `sum` the bucket counts across all instances *then* run `histogram_quantile()` — mathematically valid. So **histograms usually win** in microservice/Kubernetes environments.

Summaries' edges: exact quantiles on a single instance and no bucket-choice needed — fine for a singleton or when you truly never aggregate. The cost of classic histograms is choosing bucket boundaries and the series-per-bucket cardinality — which is exactly what **native/exponential histograms** fix (next question).

### Q8. What are native (exponential) histograms and why do they matter?

Classic Prometheus histograms have two pain points: you must **hand-pick bucket boundaries** (`le` values) up front — too few and your percentiles are inaccurate, too many and you pay a *series per bucket per label combo* in cardinality — and you can't change them without re-instrumenting.

**Native histograms** (also called exponential histograms; OpenTelemetry has an equivalent) solve both. Instead of fixed operator-chosen buckets, they use **automatically-sized, exponentially-spaced buckets** defined by a resolution factor. Consequences:

- **High resolution at low cost**: a single native histogram is stored as *one* series with a compact bucket structure, rather than one series per `le` bucket. You get fine-grained, wide-range accuracy (microseconds to minutes) without the cardinality blow-up.
- **No bucket guessing**: the exponential layout auto-adapts to the data's range, so you don't have to predict your latency distribution in advance.
- **Better aggregation/merging** across instances, since the bucket scheme is consistent.

They matter because bucket cardinality is a real operational cost of classic histograms at scale, and native histograms let teams keep accurate percentiles without paying it. As of recent Prometheus/OTel versions they're production-usable (still stabilizing), and they're the direction the ecosystem is heading — worth naming in a senior interview as the modern answer to "histograms are expensive."

### Q9. Why do averages lie, and why do we use percentiles instead?

An **average collapses a distribution to a single number**, which hides exactly the part that hurts users — the tail. If 99 requests take 10ms and 1 takes 5,000ms, the mean is ~60ms, which looks *great*, while 1% of users are having a terrible time. Averages are dominated by the bulk and blind to outliers.

**Percentiles** describe the shape:

- **p50 (median)** — the typical experience; half of requests are faster.
- **p95 / p99** — the tail; 1% of requests are slower than p99. This is where timeouts, angry users, and SLO breaches live.
- **p99.9** — the very worst-case, relevant at high request volumes (at 1M req/s, 0.1% is 1,000 users/sec).

Two reasons percentiles win for latency:

1. **User experience is a distribution, not a mean.** SLOs are almost always stated as percentiles ("p99 < 300ms") because that's what users feel.
2. **Averages mask regressions.** A tail that doubles from p99=200ms to p99=400ms can leave the average nearly unchanged.

Practical note: also separate **success vs error latency** — a flood of fast errors can *lower* your average and even your percentiles, masking a real problem. Graph the percentiles, alert on the tail, and never let a mean be your only latency signal.

### Q10. Why can't you average percentiles across instances, and what do you do instead?

You can't average percentiles because a percentile is a **non-linear function of the underlying distribution** — it's not additive. Consider two pods:

- Pod A: p99 = 100ms. Pod B: p99 = 100ms.
- Naive average: (100 + 100) / 2 = 100ms.

But if Pod A serves 1 request/sec and Pod B serves 10,000/sec, the *true* combined p99 is dominated by Pod B's distribution and could be wildly different from 100ms. The average of the two p99s has no statistical meaning — you're averaging summary statistics of different-sized, differently-shaped datasets.

The correct approach is to **aggregate the raw distribution first, then compute the percentile once** — which is exactly what histograms enable:

```promql
# WRONG: averaging per-instance quantiles (meaningless)
avg(http_request_duration_seconds{quantile="0.99"})

# RIGHT: sum histogram buckets across instances, THEN take the quantile
histogram_quantile(
  0.99,
  sum by (le) (rate(http_request_duration_seconds_bucket[5m]))
)
```

The `sum by (le)` merges every instance's buckets into one combined distribution, and `histogram_quantile` computes a single, valid overall p99. This is *the* reason histograms beat summaries in distributed systems (summary quantiles are pre-computed per instance and can't be re-merged). If an interviewer hears "just average the p99s," that's an instant junior tell.

### Q11. What are the naming and unit conventions for metrics, and why do they matter?

Prometheus has strong conventions that tooling and humans rely on:

- **Base units, always.** Seconds (not milliseconds), bytes (not KB/MB), ratios 0–1 (not percentages). Consistency lets you compare and math across metrics without unit juggling.
- **Suffix encodes the unit/semantics.** `_seconds`, `_bytes`, `_total` for counters, `_ratio` for 0–1 values. Example: `http_request_duration_seconds`, `node_memory_usage_bytes`, `http_requests_total`.
- **`_total` suffix for counters** — signals monotonic; `rate()` expects it.
- **Histograms/summaries auto-generate suffixed series** — a histogram named `http_request_duration_seconds` produces `_bucket`, `_sum`, `_count`. Don't collide with those.
- **`namespace_subsystem_name` structure** — prefix with the app/exporter (`process_`, `node_`, `myapp_`) so metrics are self-describing and don't clash.
- **snake_case**, lowercase.

Why it matters: conventions make metrics **self-documenting and composable**. When everyone uses base units and `_total`/`_seconds`, dashboards, recording rules, and alerts port across services, and a reader knows `_seconds` means seconds without checking docs. Violations cause real bugs — a metric secretly in milliseconds silently breaks any `histogram_quantile` threshold or cross-metric comparison. Interviewers ask because consistent naming is a marker of someone who's maintained a metrics platform, not just emitted a few counters.

### Q12. Push vs pull for metrics — what's the difference and what are the tradeoffs?

**Pull** (Prometheus default): the monitoring server periodically **scrapes** an HTTP `/metrics` endpoint on each target. **Push**: the application/agent **sends** metrics *to* the collector (StatsD, Graphite, InfluxDB, OTLP push, Prometheus Pushgateway).

| | Pull (scrape) | Push |
|---|---|---|
| Who initiates | Monitoring server | The target |
| Target discovery | Service discovery + scrape config | Targets must know the collector address |
| Health signal | **Free** — a failed scrape means the target is down (`up=0`) | Absence is ambiguous (down? or just quiet?) |
| Short-lived/batch jobs | Awkward (job may exit before scrape) → Pushgateway | Natural fit |
| Firewall/network | Server must reach targets | Targets must reach collector (better for egress-only / serverless) |
| Overload control | Server controls scrape rate | Client can flood the collector |

Prometheus favors **pull** for good reasons: you get **target health for free** (if the scrape fails, you know the instance is down — no separate liveness check), the server controls load and interval centrally, and service discovery keeps the target list current. Pull's weakness is **short-lived jobs** that vanish before a scrape — handled by the Pushgateway (for batch jobs only) — and reaching targets behind NAT/firewalls or ephemeral serverless functions, where push (or an OTLP/agent-based push) fits better. Many real setups are hybrid: pull for long-lived services, push for batch/edge/serverless.

### Q13. What is the scrape/sample interval, and how does it affect resolution?

The **scrape interval** (Prometheus) is how often the server pulls each target — commonly 15s or 30s. It sets the **resolution** of every series: one sample per interval, so a 15s interval means you literally cannot see anything shorter than ~15s in the data.

Tradeoffs:

- **Shorter interval (higher resolution)** → catches brief spikes, faster detection, smoother graphs — but **more samples = more storage, memory, and ingest load**, multiplied across every series. Halving the interval doubles sample volume.
- **Longer interval (lower resolution)** → cheaper, but you *miss* sub-interval events (a 5s latency spike is invisible at a 30s interval) and detection is slower.

It also interacts with `rate()`: your **range vector must span at least a few scrape intervals** — the rule of thumb is the range should be *at least 4× the scrape interval* (e.g. `rate(...[1m])` with a 15s scrape gives ~4 samples) so you have enough points for a stable rate and tolerance for a missed scrape. Too short a range relative to the interval yields empty or jumpy results.

Choose per signal: fast-moving, alert-critical metrics may warrant 15s; slow infra trends are fine at 60s. Don't globally crank resolution up "to be safe" — it's a multiplier on cost across your entire series count.

### Q14. What is staleness in a metrics system?

**Staleness** is how the system handles a series that *stops being reported*. When a target disappears (pod deleted, target de-scheduled) or simply stops exposing a particular series, Prometheus doesn't keep returning the last value forever — after a scrape where the series is absent, Prometheus inserts a **staleness marker**, and queries then treat that series as **no longer existing** (returning no data) rather than as flatlining at the old value.

Why it matters:

- **Correctness of alerts and graphs.** Without staleness handling, a crashed instance's metric would appear to hold steady at its last value indefinitely, hiding the outage and potentially silencing alerts that fire on high values (the value just freezes). Staleness makes "gone" look like "gone."
- **Target churn** in Kubernetes: pods come and go constantly; staleness ensures old pods' series drop out of results promptly (Prometheus default: a series is marked stale ~5 minutes after its last successful sample, or immediately on an explicit staleness marker).
- **`up` metric pairing**: `up == 0` tells you the *target* failed to scrape; staleness governs what happens to the *series* it used to produce.

Practically: if you graph "current active pods" and see ghosts, or an alert won't clear after a pod dies, staleness handling (or a query that assumes continuity) is usually the culprit. It's a small concept that causes surprising "why is this stale value still here" bugs.

### Q15. Our metrics bill just tripled but traffic is flat. Walk me through diagnosing it.

Flat traffic + exploding cost is the signature of a **cardinality explosion**, not a volume increase. Traffic drives *sample* volume per series; cost tripling without traffic means the **number of series** grew. My steps:

1. **Confirm it's cardinality.** Check active-series count / ingestion series over time (in Prometheus: `prometheus_tsdb_head_series`, or `count({__name__=~".+"})`). If series count tripled while request rate is flat, it's cardinality.
2. **Find the offending metric.** Identify the metrics with the most series:
   ```promql
   topk(10, count by (__name__)({__name__=~".+"}))
   ```
   One or two metric names usually dominate.
3. **Find the offending label.** For the top metric, find which label has runaway values — typically a newly-added dimension. Look for labels like `user_id`, `request_id`, `session_id`, `email`, full `url`/`path` with IDs or query strings, `pod`/`container_id` in a high-churn cluster, error `message` strings, or timestamps embedded in labels.
4. **Correlate with a recent change.** A deploy almost certainly added a label or started templating a high-cardinality value into an existing one (e.g. `path="/user/12345"` instead of `path="/user/:id"`).

**The fix:** remove the high-cardinality label from the metric and move that data to **logs or trace attributes**; normalize path templates (`:id` not the literal id); use `metric_relabel_configs` to drop the bad label at scrape time as an immediate stop-gap; add cardinality limits/guardrails so it can't recur. The lesson to state out loud: metric cost scales with *series*, and unbounded labels are the near-universal cause — traffic is rarely the culprit when it's flat.

### Q16. Design the metrics for a new payment service. What types and labels do you choose?

I'd instrument the **RED / golden signals** with correct types and **bounded** labels, and deliberately keep high-cardinality data out of metrics.

**Metrics:**

```
# Rate + Errors: one counter, sliced by bounded dimensions
payment_requests_total{method="charge", status="success|declined|error", provider="acme"}   # counter

# Duration: histogram so we can get aggregatable percentiles + SLOs
payment_request_duration_seconds_bucket{method="charge", provider="acme"}                    # histogram
payment_request_duration_seconds_sum / _count

# Saturation / state: gauges
payment_inflight_requests{provider="acme"}          # gauge
payment_provider_circuit_state{provider="acme"}     # gauge (0/1/2 = closed/open/half-open)

# Business/health counters (bounded categories)
payment_amount_cents_sum{currency="usd", provider="acme"}   # (or histogram if you want distribution)
```

**Type choices:** counters for anything monotonic (requests, errors, retries) — always consumed via `rate()`; a **histogram** for latency so I can compute a *valid, aggregatable* p99 across instances and drive a latency SLO; gauges for in-flight count and circuit-breaker state.

**Label discipline (the part that matters):**

- **Include**, because bounded: `method` (charge/refund/…), `status` (success/declined/error — a small enum, ideally split expected declines from real errors), `provider` (payment processor), `currency`.
- **Exclude from metrics**, because unbounded/PII: `user_id`, `transaction_id`, `card_number`, `email`, exact `amount`, full failure `message`. These go into **structured logs and trace attributes** (with PII redaction), where per-transaction investigation belongs.

**Extras:** separate success vs error *latency* (fast declines shouldn't flatter the p99), name in base units (`_seconds`, `_total`), and add per-**provider** RED so I can tell *which* processor is degrading. This gives alerting-grade metrics that stay cheap, plus logs/traces for the "what happened to transaction X" questions metrics deliberately can't answer.

## Prometheus Architecture

### Summary

**What this topic covers**

How Prometheus is actually built and operated: the pull/scrape model and why it's designed that way, the server's internal components (retrieval, TSDB, HTTP API) and the separate Alertmanager, how targets are found (static config, service discovery, and relabeling), the exporter pattern for systems you can't instrument directly, the Pushgateway and why it's an anti-pattern for anything but batch jobs, the TSDB internals (head block, WAL, 2-hour blocks, compaction, retention, local-storage limits), the labels Prometheus attaches (`job`, `instance`) and `honor_labels`, how you run Prometheus in HA (two replicas, no clustering), where a single Prometheus tops out and what that implies, federation basics, and the `up` metric for target health. The 17 questions run from "how does a scrape work" to "we've outgrown one Prometheus — what now." This is the operational counterpart to the Metrics topic: metrics theory becomes a concrete, single-binary system with sharp edges around cardinality, storage, and scaling that every SRE is expected to know.

**Mental model**

Picture Prometheus as **one binary that pulls, stores locally, and answers queries** — deliberately simple and self-contained. On a timer, its *retrieval* component fetches `/metrics` from every configured target (an HTTP GET returning a text exposition of current values), appends the samples to a local *TSDB*, and serves PromQL through an *HTTP API*. That's the whole loop. Two design choices define everything else. First, **pull**: Prometheus decides who to scrape and when, so it gets target health for free (a failed scrape = target down) and controls its own load. Second, **local storage, no clustering**: each Prometheus is an island that owns its data on local disk; there's no built-in replication or sharding. That single fact explains HA (you don't cluster — you run two identical replicas scraping the same targets and dedupe downstream), the scaling ceiling (one node's RAM and disk bound how many active series you can hold), and why "we outgrew Prometheus" leads to federation, sharding, or a remote-write long-term-storage system (Thanos/Mimir/Cortex). Alerting is deliberately split out: Prometheus *evaluates* alert rules; a separate **Alertmanager** dedupes, groups, silences, and routes them.

**Key terms**

- **Pull model / scrape** — Prometheus periodically HTTP-GETs each target's `/metrics` endpoint and ingests the exposition.
- **Target** — an endpoint Prometheus scrapes (usually `host:port/metrics`).
- **Retrieval** — the Prometheus component that performs scrapes.
- **TSDB** — Prometheus's local time-series database (head block + WAL + persistent blocks).
- **Head block** — the in-memory (plus WAL) window of the most recent ~2h of samples before they're flushed to a persistent block.
- **WAL (write-ahead log)** — on-disk log of incoming samples so the in-memory head can be recovered after a crash.
- **Block / compaction** — immutable ~2h on-disk chunks of samples; compaction merges them into larger blocks over time.
- **Retention** — how long local blocks are kept (`--storage.tsdb.retention.time`), after which they're deleted.
- **Service discovery (SD)** — dynamic target discovery (`kubernetes_sd`, `file_sd`, `consul_sd`, etc.).
- **Relabeling** — rewriting labels/targets: `relabel_configs` (before scrape, on target metadata) vs `metric_relabel_configs` (after scrape, on ingested samples).
- **Exporter** — a sidecar/agent that translates a third-party system's metrics into Prometheus format (node_exporter, blackbox_exporter).
- **Pushgateway** — a component that holds pushed metrics for scraping; intended only for short-lived/batch jobs.
- **`job` / `instance`** — labels Prometheus adds automatically (`job` = scrape job name, `instance` = target host:port).
- **`up`** — a synthetic metric per target: `1` if the last scrape succeeded, `0` if it failed.
- **Federation** — one Prometheus scraping selected aggregated series from another via `/federate`.

**Why interviewers ask this**

Prometheus is the de-facto metrics backbone, so operating it is core SRE knowledge, and the architecture questions separate users from operators. Juniors can add a scrape target; seniors know *why* it's pull, that Prometheus has no clustering, and therefore how HA and scaling actually work (two replicas + dedupe; federate or remote-write when you outgrow one node). The highest-signal answers are about the sharp edges: cardinality's relationship to head-block **memory** (the OOM story), why the Pushgateway is an **anti-pattern** for long-lived services (it breaks the free health signal and persists stale metrics), the difference between `relabel_configs` and `metric_relabel_configs` (target-time vs sample-time), and knowing the single-node ceiling well enough to name Thanos/Mimir/Cortex as the next step. These reveal whether you've been paged for a Prometheus running out of memory at 3am, or only read the docs.

**Common confusions**

- "Prometheus can be clustered for HA" — it can't; there's no native clustering/sharding. HA = run two identical replicas and dedupe at the Alertmanager / query layer.
- "Use the Pushgateway so my service can push metrics" — the Pushgateway is for short-lived **batch** jobs only; using it for services breaks health detection and leaves stale metrics forever.
- "Alertmanager evaluates the alerts" — no; **Prometheus** evaluates alert rules and *sends* firing alerts to Alertmanager, which only dedupes/groups/routes/silences them.
- "`relabel_configs` and `metric_relabel_configs` are the same" — the first acts on **targets before scraping** (drop targets, rewrite the target list); the second acts on **samples after scraping** (drop/rename metrics and labels). Different phases.
- "Prometheus stores everything forever / is a long-term store" — local storage is retention-limited and single-node; long-term/global needs remote-write to Thanos/Mimir/Cortex.
- "A failed scrape means my alert rule broke" — a failed scrape sets `up=0`; that's target health, distinct from rule evaluation.
- "More retention just needs more disk" — retention and cardinality also drive **memory** (active series live in the head block); you can OOM long before you fill the disk.

**What follows from this topic**

This is the substrate for the query and alerting topics. `scrape_interval` vs `evaluation_interval` (introduced here) sets the cadence PromQL rate windows and alert `for:` durations must respect. The `up` metric and target labels (`job`, `instance`) are what you'll write availability alerts against. The single-node scaling ceiling motivates the later "scaling & long-term storage" topic (federation, remote-write, Thanos/Mimir/Cortex). Cardinality — first met as a metrics-design concern — reappears here as a concrete memory/TSDB constraint that caps how big one Prometheus can grow. And the pull/exporter/relabeling machinery is exactly what OpenTelemetry's Collector and the broader pipeline topics generalize.

### Q1. Explain Prometheus's pull model. Why pull instead of push?

Prometheus **pulls**: on a timer (the scrape interval) its retrieval component sends an HTTP GET to each target's `/metrics` endpoint, which returns the target's current metric values in a simple text format. Prometheus ingests those samples into its TSDB. The target is passive — it just exposes its current state; it never initiates a connection to Prometheus.

Why pull is the default:

- **Target health for free.** If the scrape fails, Prometheus knows the target is down and sets `up=0`. No separate liveness check needed — health is a *side effect* of the same mechanism that collects metrics.
- **The server controls load and cadence.** Prometheus decides how often and how many targets to scrape, so a misbehaving app can't flood the monitoring system. Scrape intervals are managed centrally.
- **Service discovery fits naturally.** Prometheus maintains the target list from SD and scrapes whatever currently exists — you don't have to configure every app with the monitoring endpoint.
- **Easier to run/debug.** You can `curl` a target's `/metrics` by hand to see exactly what Prometheus sees.

Pull's weaknesses are real but bounded: **short-lived/batch jobs** may exit before a scrape (handled by the Pushgateway) and targets behind NAT/firewalls or ephemeral serverless functions are hard to reach (handled by push/OTLP/agents). But for long-lived services, pull's free health signal and central load control are why Prometheus chose it.

### Q2. What are the main components of a Prometheus deployment?

Prometheus is deliberately a **single binary** with a few internal parts, plus a couple of separate companion services:

- **Prometheus server** (one process) containing:
  - **Retrieval** — performs scrapes against discovered targets.
  - **TSDB (local storage)** — stores samples on local disk (head block + WAL + persistent blocks).
  - **Rule evaluation** — periodically evaluates recording rules (precompute series) and alerting rules.
  - **HTTP server / PromQL API** — serves queries (for Grafana, the built-in UI, the API).
- **Alertmanager** (separate process) — receives firing alerts *from* Prometheus and handles **deduplication, grouping, silencing, inhibition, and routing** to receivers (email, Slack, PagerDuty). Prometheus evaluates the rules; Alertmanager manages the resulting notifications.
- **Exporters** (separate processes) — translate third-party systems into Prometheus metrics (node_exporter for host metrics, blackbox_exporter for probes, DB exporters, etc.).
- **Pushgateway** (optional, separate) — holds metrics pushed by short-lived batch jobs so Prometheus can scrape them.
- **Service discovery** (config, not a process for k8s/consul/file SD) — feeds the current target list to retrieval.

Grafana is the usual visualization front end on top. The key architectural point for interviews: **alerting is split** — Prometheus decides *when* an alert fires; Alertmanager decides *how/whether it's delivered*. And storage is **local to each server**, which shapes HA and scaling.

### Q3. What does a scrape config look like, and what is a target?

A **target** is a single endpoint Prometheus scrapes — typically `host:port` with a `/metrics` path. A **scrape config** (a `job`) defines a group of targets plus how to scrape them. Minimal static example:

```yaml
scrape_configs:
  - job_name: "api"                # becomes the `job` label
    scrape_interval: 15s           # optional per-job override
    metrics_path: /metrics         # default
    scheme: http
    static_configs:
      - targets:
          - "10.0.0.1:8080"        # each becomes an `instance`
          - "10.0.0.2:8080"
```

Each entry in `targets` becomes a target Prometheus GETs on the interval. Prometheus automatically attaches `job="api"` and `instance="10.0.0.1:8080"` to every series from that target (see the labels question). Real deployments rarely list targets statically — they use **service discovery** (`kubernetes_sd_configs`, `consul_sd_configs`, `file_sd_configs`) to populate `targets` dynamically, then use `relabel_configs` to filter and shape them. A job can also carry `params`, `basic_auth`/`authorization`, `tls_config`, `scrape_timeout`, and relabeling rules. The mental model: a scrape config says *what set of endpoints* forms this job and *how* to fetch them; a target is one concrete endpoint within it.

### Q4. How does service discovery work, and what is relabeling?

**Service discovery (SD)** keeps the target list current automatically instead of you hand-editing IPs. Prometheus supports many SD mechanisms:

- **`kubernetes_sd`** — discovers pods, services, endpoints, nodes, ingresses from the k8s API. The standard in a cluster.
- **`file_sd`** — reads targets from JSON/YAML files that another system writes (a generic escape hatch).
- **`consul_sd`**, EC2, Azure, GCE, DNS SD, etc.

SD hands Prometheus a raw list of candidate targets, each decorated with **meta-labels** (e.g. `__meta_kubernetes_pod_label_app`, `__meta_kubernetes_namespace`). Almost none of those should end up on your metrics as-is — that's where **relabeling** comes in.

**Relabeling** rewrites labels/targets through ordered rules. In SD context (`relabel_configs`) it decides **which targets to keep and how to label them**:

```yaml
relabel_configs:
  # only scrape pods that opted in via annotation
  - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
    action: keep
    regex: "true"
  # copy the pod's app label to a clean `app` label
  - source_labels: [__meta_kubernetes_pod_label_app]
    target_label: app
  # set the namespace as a label
  - source_labels: [__meta_kubernetes_namespace]
    target_label: namespace
```

Common actions: `keep`/`drop` (filter targets), `replace` (rewrite a label), `labelmap`, `hashmod` (for sharding). Relabeling is how you turn messy SD metadata into clean, low-cardinality labels and control exactly what gets scraped.

### Q5. What's the difference between `relabel_configs` and `metric_relabel_configs`?

They run at **different phases** of the scrape and act on **different things**:

| | `relabel_configs` | `metric_relabel_configs` |
|---|---|---|
| When | **Before** the scrape | **After** the scrape, before ingestion |
| Acts on | **Targets** (SD meta-labels, address) | **Individual metric samples** (their names/labels) |
| Typical use | Keep/drop *targets*; set `job`/`instance`/`app`; sharding | Drop noisy *metrics*; strip high-cardinality *labels*; rename |
| Affects | Whether/how a target is scraped at all | Which samples survive and how they're labeled |

```yaml
scrape_configs:
  - job_name: "api"
    kubernetes_sd_configs: [ ... ]
    relabel_configs:
      # target-level: only scrape opted-in pods
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
        action: keep
        regex: "true"
    metric_relabel_configs:
      # sample-level: drop a noisy high-cardinality metric entirely
      - source_labels: [__name__]
        action: drop
        regex: "expensive_debug_metric_.*"
      # sample-level: strip a runaway label to control cardinality
      - action: labeldrop
        regex: "request_id"
```

Rule of thumb: **`relabel_configs` = "should I scrape this target and what target labels does it get?"** (runs on the *target list*). **`metric_relabel_configs` = "of the samples I just scraped, which do I keep and how are they labeled?"** (runs on the *data*). The classic use of `metric_relabel_configs` is emergency cardinality control — dropping a bad metric or label at ingestion without redeploying the app.

### Q6. What is an exporter, and when do you write one?

An **exporter** is a small process that sits next to a system you can't (or don't want to) instrument directly, reads that system's stats through its native interface, and **exposes them on a `/metrics` endpoint in Prometheus format** so Prometheus can scrape it like any other target.

You use/write an exporter when the thing you want to monitor isn't Prometheus-native:

- **`node_exporter`** — host-level metrics (CPU, memory, disk, network, filesystem) from the OS.
- **`blackbox_exporter`** — probes endpoints from the outside (HTTP, TCP, ICMP, DNS, TLS-cert expiry) — i.e. black-box monitoring.
- **Database/middleware exporters** — `mysqld_exporter`, `postgres_exporter`, `redis_exporter`, `kafka_exporter` translate each system's native stats.
- **Custom exporter** — you write one when you have a legacy app, a closed-source system, or a device (SNMP gear) that exposes metrics in *some* form (an API, a log, SNMP) but not Prometheus format. Your exporter fetches from that source on scrape and renders `/metrics`.

The pattern matters because Prometheus's pull model needs a `/metrics` HTTP endpoint. The exporter is the **adapter** that gives non-Prometheus systems one. Guidance: prefer **direct instrumentation** (a client library in your own code) when you own the code; reach for an exporter for third-party/closed systems you can't modify. Keep exporters stateless translators — they should reflect *current* state at scrape time, not accumulate their own history.

### Q7. What is the Pushgateway, and why is it an anti-pattern for services?

The **Pushgateway** is a component that **holds pushed metrics in memory so Prometheus can scrape *it*.** A short-lived job pushes its final metrics to the Pushgateway before exiting; Prometheus scrapes the Pushgateway on its normal interval and picks them up.

It exists to solve exactly **one** problem: **short-lived / batch jobs** that start, do work, and *exit before Prometheus could ever scrape them* — a nightly cron, a CI job, a one-off migration. For those it's the right tool (push the result on completion).

It's an **anti-pattern for long-lived services** because:

- **It breaks the free health signal.** Prometheus scrapes the *Pushgateway*, not your service, so `up` reflects the gateway's health, not your instances'. A dead service that already pushed still looks "present." You lose pull's best feature.
- **Metrics go stale and persist forever.** The Pushgateway holds the last pushed value indefinitely (until explicitly deleted) — a crashed job's metrics linger, misleading dashboards and alerts.
- **It's a single point of failure and a bottleneck** — a shared, stateful chokepoint for many pushers.
- **No per-instance timing** and easy label collisions across pushers.

For services, the right pattern is the opposite: let the service **expose `/metrics`** and let Prometheus **pull** it, so you get health detection and per-instance freshness. If you find yourself pushing service metrics through the gateway, you've inverted the model.

### Q8. How does the Prometheus TSDB store data — head block, WAL, blocks, compaction?

Prometheus's local TSDB is layered for both crash-safety and query efficiency:

- **Head block (in-memory + WAL).** The most recent ~2 hours of samples live in memory in the **head block** for fast ingest and query. Every incoming sample is *also* appended to the **write-ahead log (WAL)** on disk first, so if the process crashes the head can be **replayed from the WAL** on restart — nothing is lost.
- **Persistent blocks (~2h).** Periodically the head is flushed to an **immutable on-disk block** covering a ~2-hour window. Each block is a self-contained directory of chunks + an index + metadata, and once written is never modified.
- **Compaction.** A background process **merges adjacent small blocks into larger ones** (e.g. several 2h blocks into a day block), which reduces the number of blocks/index overhead and improves query and retention efficiency.
- **Retention & deletion.** Blocks older than the retention window (`--storage.tsdb.retention.time`, or a size limit) are **deleted whole** — retention is enforced at block granularity, which is why it's coarse.

Two consequences worth stating: (1) **memory is driven by active series in the head**, not disk — high cardinality can OOM the head long before disk fills; (2) because blocks are immutable and local, there's **no in-place update and no clustering** — each Prometheus owns its blocks on local disk, which is the root of the HA and scaling story.

### Q9. What labels does Prometheus add automatically, and what is `honor_labels`?

When Prometheus scrapes a target, it automatically attaches two identifying labels to **every** series from that scrape:

- **`job`** — the `job_name` from the scrape config (e.g. `job="api"`). Identifies *what kind* of thing this is.
- **`instance`** — the target's `host:port` (e.g. `instance="10.0.0.2:8080"`). Identifies *which* specific target produced the series.

Together `job` + `instance` uniquely identify a scrape source, which is why availability queries key off them (`up{job="api"}`).

**`honor_labels`** controls what happens when the *scraped data already contains* a label that Prometheus would otherwise attach (like `job` or `instance`) — a collision:

- **`honor_labels: false`** (default) — Prometheus **wins**: it overwrites any conflicting label from the target with its own scrape-time value (and moves the original to `exported_job`, etc.). This is what you want for normal direct scraping — you trust Prometheus's identity labels.
- **`honor_labels: true`** — the **target's** labels win; Prometheus does *not* overwrite them. This is essential when scraping something that legitimately carries labels *about other sources* — most importantly the **Pushgateway** and **federation** (`/federate`), where the metrics represent many original jobs/instances and you must preserve their real `job`/`instance` rather than stamping them all with the gateway's identity.

Rule of thumb: leave it `false` for normal targets; set `true` when scraping a *proxy* of other metrics (Pushgateway, federation).

### Q10. How do you run Prometheus in high availability? Does it cluster?

**Prometheus does not cluster.** There is no built-in replication, sharding, or consensus — each Prometheus is an independent node that scrapes and stores locally. So HA is achieved not by clustering but by **redundancy plus deduplication**:

- **Run two (or more) identical Prometheus replicas** with the *same* scrape config, both scraping the *same* targets independently. Now the failure of one replica doesn't blind you — the other has the data.
- **Deduplicate downstream.** The replicas' data isn't automatically merged, so you dedupe where it's consumed:
  - **Alerting:** point both replicas at the **same Alertmanager(s)**. Alertmanager **deduplicates identical alerts**, so two replicas firing the same alert produce one notification. (Run Alertmanager itself as a small gossip cluster for its own HA.)
  - **Querying:** put a dedup-aware layer in front — **Thanos Querier** or **Grafana Mimir/Cortex** — which merges the replicas' series and removes duplicate samples so dashboards see one coherent view.

Points to make in an interview: the replicas are *not* consistent with each other (each scrapes on its own schedule, so samples differ slightly) — dedup tolerates this. And this same "no clustering / local storage" fact is why you can't scale a single Prometheus by adding nodes to a cluster; horizontal scale requires **functional sharding** (splitting scrape targets across separate Prometheis) or a **remote-write** long-term store. HA and scaling both flow from the single design fact: each Prometheus is an island.

### Q11. Where does a single Prometheus top out, and what do you do about it?

A single Prometheus is bounded by **one machine's resources**, and the binding constraint is almost always **memory driven by active series (cardinality)** — the head block holds all active series in RAM. Practical ceilings (rough, version/hardware-dependent): millions of active series and low-single-digit-million samples/sec ingest before RAM, WAL replay time, and query latency become painful; local disk and retention bound how much history you can keep; and it's a **single point of failure** with **no global view** across regions/clusters.

Symptoms you've outgrown it: OOM kills, long WAL-replay restarts, slow queries, disk-retention pressure, or needing to see many clusters in one place.

What you do, in escalating order:

1. **Reduce load first.** Cut cardinality (drop high-cardinality labels/metrics via `metric_relabel_configs`), lengthen scrape intervals for cheap signals, and use **recording rules** to precompute expensive aggregations.
2. **Functionally shard.** Run multiple Prometheis, each scraping a subset of targets (by team/service/region). Simple, no new tech — but now you have many silos.
3. **Add HA replicas** (two per shard) for resilience (previous question).
4. **Adopt a scalable long-term/global system.** Use **remote_write** to ship samples to **Thanos, Grafana Mimir, or Cortex**, which provide horizontally scalable storage, long retention (object storage), and a **global query view** across all your Prometheis/shards. Thanos can alternatively aggregate via sidecars reading each Prometheus's blocks.

The one-liner: you don't scale Prometheus *up* by clustering it — you scale *out* by sharding and/or pushing to a purpose-built scalable backend (covered in the scaling topic).

### Q12. What's the relationship between cardinality and Prometheus memory?

Direct and often fatal: **active series live in the head block in memory**, so **memory usage scales with the number of active time series** — i.e. with cardinality — far more than with sample *volume* or retention. Each unique metric-name + label-value combination is a series with its own in-memory index entry and chunk; more unique combinations = more RAM, period.

This is *the* Prometheus operational footgun:

- A single high-cardinality label (a `user_id`, `request_id`, unbounded `path`, or churny `pod` label in a high-turnover cluster) can multiply your series count by orders of magnitude.
- Because it's memory-bound on the **head** (last ~2h of active series), the blow-up is fast — a bad deploy that adds an unbounded label can **OOM-kill Prometheus within a scrape interval or two**, not gradually over days.
- It also slows WAL replay (longer restarts) and query performance (more series to scan).

Because retention is on *disk* but active series are in *RAM*, you can OOM long before the disk is full — a common surprise.

Mitigations: enforce **bounded labels** at instrumentation time; use `metric_relabel_configs`/`labeldrop` to strip runaway labels at ingestion as an emergency brake; set **cardinality/series limits** (sample-limit per scrape, label limits); monitor `prometheus_tsdb_head_series` and alert on abnormal growth. In interviews, tie it back: cardinality is the metrics-design concern from the previous topic *and* the concrete thing that caps how big one Prometheus can grow.

### Q13. What is federation, and when would you use it?

**Federation** lets one Prometheus scrape **selected time series from another Prometheus** via a special `/federate` endpoint. The "parent" (usually global/aggregation-level) Prometheus is configured with a scrape job pointing at the `/federate` endpoint of one or more "child" Prometheis, using match params to pull only the series it wants:

```yaml
scrape_configs:
  - job_name: "federate"
    honor_labels: true            # preserve the child's job/instance labels
    metrics_path: "/federate"
    params:
      "match[]":
        - '{__name__=~"job:.*"}'   # pull only pre-aggregated recording-rule series
    static_configs:
      - targets:
          - "child-prom-1:9090"
          - "child-prom-2:9090"
```

Typical uses:

- **Hierarchical / cross-datacenter aggregation.** Each cluster/region runs its own Prometheus scraping local targets at full detail; a global Prometheus federates just the **aggregated** series (via recording rules) up for a cross-cluster view and global dashboards/alerts.
- **Pulling a curated subset** across teams without shipping every raw series.

Key caveats interviewers want: **federate aggregates, not raw data** — you should pull recording-rule outputs, *not* all series (federating everything just recreates the cardinality problem on the parent, plus the child becomes a bottleneck). Set `honor_labels: true` so the child's `job`/`instance` are preserved. Federation is fine for modest hierarchical aggregation, but for true global scale/long-term storage the modern answer is **remote_write to Thanos/Mimir/Cortex**, which handle dedup, long retention, and a global query layer more robustly than federation chains.

### Q14. What is the `up` metric and how do you use it for target health?

`up` is a **synthetic metric Prometheus generates itself for every target on every scrape** — you don't emit it. It's `1` if the most recent scrape of that target **succeeded** and `0` if it **failed** (connection refused, timeout, non-2xx, etc.). It carries the target's identifying labels (`job`, `instance`), so you get one `up` series per target.

This is the payoff of the pull model: **health is a free side effect of scraping.** You didn't build a liveness check — the act of collecting metrics *is* the check.

Uses:

```promql
# which targets are currently down
up == 0

# alert if any api instance is down
# (as an alerting rule, with a `for:` to avoid flapping on one bad scrape)
up{job="api"} == 0

# fraction of api targets that are healthy
avg(up{job="api"})

# whole job is down (all instances failed)
sum(up{job="api"}) == 0
```

Practical notes: always add a `for: 2m` (or similar) to `up == 0` alerts so a single transient failed scrape doesn't page you; a *sudden drop in the number of `up` series* can indicate a service-discovery/config problem (targets vanished) rather than instances crashing; and complement `up` (which only says "did the scrape connect") with **black-box probes** (blackbox_exporter) for "can a *user* actually reach it," since a target can be `up=1` yet broken behind the load balancer.

### Q15. What's the difference between `scrape_interval` and `evaluation_interval`?

They control two different clocks in Prometheus:

- **`scrape_interval`** — how often Prometheus **pulls `/metrics` from targets**, i.e. how often *new samples* are ingested. It sets the raw data resolution (commonly 15s or 30s).
- **`evaluation_interval`** — how often Prometheus **runs its rules** — recording rules (precompute series) and alerting rules (check alert conditions). It's the cadence at which alerts can fire and recording-rule series get new points.

```yaml
global:
  scrape_interval: 15s        # ingest samples every 15s
  evaluation_interval: 15s    # evaluate recording/alert rules every 15s
```

Why the distinction matters:

- **Alert latency** is governed by `evaluation_interval` (plus the alert's `for:` duration), not scrape interval. If you evaluate every 60s, an alert can't fire faster than ~that.
- They interact: evaluating rules **more often than you scrape** is wasteful (no new data between scrapes) and can produce jitter; evaluating **much less often** delays detection. They're usually set equal or close.
- **`rate()` ranges** depend on `scrape_interval` (range should be ≥ ~4× scrape), while an alert's responsiveness depends on `evaluation_interval` — mixing these up is a common source of "why is my alert slow / empty" confusion.

One-liner: `scrape_interval` = how fast you *collect*; `evaluation_interval` = how fast you *react*.

### Q16. Walk me through what happens, step by step, when Prometheus scrapes a target.

End to end for a single target on one scrape cycle:

1. **Target selection.** Service discovery (or static config) produces the candidate target list; `relabel_configs` runs on each target's meta-labels to **keep/drop** targets and set target labels (`job`, `instance`, `app`, etc.). Survivors become the active target set.
2. **Scrape fires on the timer.** At each `scrape_interval`, the retrieval component sends an **HTTP GET** to the target's `metrics_path` (default `/metrics`), with `scrape_timeout` enforced.
3. **Target responds** with the current metric values in the text exposition format (or exits/errs/timeouts).
4. **Health recorded.** Prometheus writes the synthetic **`up`** series: `1` on success, `0` on failure — plus `scrape_duration_seconds`, `scrape_samples_scraped`, etc.
5. **Parse & label.** Prometheus parses the samples and **attaches `job`/`instance`** (respecting `honor_labels` on collisions).
6. **`metric_relabel_configs` runs** on the parsed samples — **drop noisy metrics, strip high-cardinality labels, rename** — before ingestion. Per-scrape limits (sample-limit, label limits) are enforced here.
7. **Ingest into the TSDB.** Surviving samples are appended to the **WAL** (crash safety) and to the in-memory **head block**; new label combinations create new active series in the head index.
8. **Availability & queries.** The samples are immediately queryable via PromQL. Separately, on the **`evaluation_interval`**, recording/alerting rules run against ingested data; firing alerts are sent to **Alertmanager**.
9. **Background lifecycle.** Every ~2h the head flushes to an immutable block; compaction merges blocks; retention deletes old blocks.

The two relabel phases (step 1 target-time, step 6 sample-time) and the free `up` health signal (step 4) are the details that show you understand the pipeline, not just "it scrapes /metrics."

### Q17. Design the Prometheus monitoring architecture for a company running three Kubernetes clusters in three regions.

I'd use **per-cluster Prometheus for collection** and a **global layer for the cross-region view**, because Prometheus doesn't cluster and local scraping should stay local (low latency, no cross-region scrape traffic, blast-radius isolation).

**Per cluster (×3):**

- **Two HA Prometheus replicas** deployed via the Prometheus Operator, each using **`kubernetes_sd`** + `relabel_configs` to discover and label pods/services (opt-in via annotations), scraping **node_exporter** (USE metrics), **kube-state-metrics**, and app `/metrics` (RED/golden signals). Two replicas = resilience with no clustering.
- **Recording rules** precompute the aggregates the global layer and dashboards need (so we federate/query cheap, low-cardinality series, not raw).
- **Cardinality guardrails**: `metric_relabel_configs` to drop known-bad labels, sample-limits, and alerting on `prometheus_tsdb_head_series` growth.
- **Alerting**: each replica sends to a **regional Alertmanager cluster** (gossip-clustered for its own HA); Alertmanager dedupes the two replicas' identical alerts into one notification. Alerts are **symptom/SLO-based**.

**Global / long-term layer:**

- **Remote-write (or Thanos sidecars) into Thanos or Grafana Mimir/Cortex.** This gives (a) a **single global query view** across all three regions for Grafana, (b) **deduplication** of the HA replicas, and (c) **long-term retention in object storage** (S3/GCS) so local Prometheus retention can stay short (cheap RAM/disk). I'd prefer this over long **federation chains**, which get brittle and re-introduce cardinality on the parent — federation is fine only for pulling a small set of pre-aggregated series.
- **Global Alertmanager** (or a top-level routing tier) for cross-region/business-level alerts computed on the global store.

**Rationale to state:** collection is local (each cluster owns its scraping and can survive global-layer outages), HA is redundancy-not-clustering (two replicas + dedupe), scale-out is sharding-per-cluster plus a remote-write backend for the global/long-term needs, and cost is controlled by recording-rule aggregation + short local retention + cardinality limits. This mirrors how real multi-cluster Prometheus is run, and every choice traces back to the single design fact that each Prometheus is a local, unclustered island.
## PromQL

### Summary

**What this topic covers**

PromQL is the query language that turns Prometheus's time-series database into something you can alert, graph, and reason about. This topic's 18 questions cover the full working vocabulary an SRE needs: the **data model** (instant vectors, range vectors, scalars, strings), **selectors and label matchers**, the **rate family** (`rate`, `irate`, `increase`) and why it only makes sense over counters, **aggregation operators** with `by`/`without`, **`histogram_quantile`** for latency percentiles, the canonical **error-rate ratio**, **vector matching** (`on`/`ignoring`, `group_left`/`group_right`), the `offset` and `@` **modifiers**, **subqueries**, **recording rules**, **alerting rules** with the `for:` clause, `absent()` for dead-target detection, and `predict_linear` for capacity. The through-line: PromQL is a functional language over labelled time series, and almost every real bug is a units error, a cardinality explosion, or a misunderstanding of what `rate()` actually does to a counter.

**Mental model**

Think of Prometheus as a table where each *row* is a unique time series — identified by a metric name plus a set of key/value labels — and each series is an append-only stream of `(timestamp, float)` samples. PromQL is a language whose expressions evaluate, at a single instant, to one of four types. An **instant vector** is "the value of every matching series right now" (one number per series). A **range vector** is "the last N samples of every matching series over a window `[5m]`" — a little slice of history per series, and it is *not* directly graphable; it exists to be fed into functions like `rate()`. A **scalar** is a single number with no labels. Reads that look like SQL `GROUP BY` are actually PromQL aggregation operators that collapse the label set. The mental unlock is that you are always transforming *sets of labelled series*, and the labels are the join keys. Get the label arithmetic right and PromQL is easy; get it wrong and you get "no data" with no error.

**Key terms**

- **Instant vector** — a set of series each with a single sample at the eval timestamp; the default expression type.
- **Range vector** — a set of series each with a range of samples over a duration selector like `[5m]`; only valid as input to range functions.
- **Scalar / string** — a single number / text literal, no labels.
- **Selector** — `metric{label="v"}`; the `{}` holds label matchers.
- **Label matchers** — `=` equals, `!=` not-equals, `=~` regex-match, `!~` regex-not-match. Regex is anchored automatically.
- **`rate()`** — per-second average increase of a counter over a range vector, reset-aware and extrapolated to the window edges.
- **`irate()`** — instantaneous rate from the last two samples; good for fast-moving graphs, bad for alerting.
- **`increase()`** — total counter increase over the window = `rate() × window_seconds`.
- **Aggregation operator** — `sum`, `avg`, `min`, `max`, `count`, `topk`, `quantile`, etc., with `by(...)` / `without(...)` to control grouping.
- **`histogram_quantile()`** — estimates a percentile from bucket counts; operates on `rate(_bucket[5m])`.
- **Vector matching** — how two vectors' series are paired: one-to-one by default, `on`/`ignoring` to pick join labels, `group_left`/`group_right` for many-to-one.
- **Recording rule** — a precomputed query stored as a new series, named `level:metric:operation`.
- **Cardinality** — number of distinct series; the dominant cost and the usual cause of slow queries.

**Why interviewers ask this**

PromQL fluency is the single fastest way to tell whether someone has actually operated Prometheus or just read the docs. The junior signal is memorising `rate(http_requests_total[5m])` without being able to explain *why* the `[5m]` is there or *why* it must be a counter. The senior signal is reasoning about correctness under failure: what `rate()` does across a counter reset, why `histogram_quantile` over-reports when buckets are coarse, why `avg` of per-instance percentiles is meaningless, and why a `group by (user_id)` will melt the query engine. Interviewers also probe *operational judgement* — recording rules vs ad-hoc queries, `for:` durations that balance flappiness against detection latency, and whether you alert on symptoms (error ratio) or causes (one instance down). Being able to write the error-rate ratio and a latency-percentile query from memory, and then critique a bad alert, is close to table stakes for an SRE role.

**Common confusions**

- **Taking `rate()` of a gauge.** `rate` assumes monotonic-with-resets counter semantics; on a gauge it produces garbage. Use `deriv()` or `delta()` for gauges.
- **`irate` for alerting.** `irate` uses only the last two samples, so it's spiky and can miss or exaggerate; use `rate` for alerts, `irate` only for high-resolution graphs.
- **Averaging percentiles.** `avg(p99_per_instance)` is not the p99 of the fleet. Aggregate the *buckets*, then apply `histogram_quantile`.
- **Comparing counters directly.** `http_requests_total > 100` compares lifetime totals since process start — meaningless. Rate first.
- **`by` vs `without` confusion.** `by(job)` keeps only `job`; `without(instance)` keeps everything except `instance`. Mixing them up silently changes cardinality.
- **Regex matchers are anchored.** `=~"api"` matches only the exact string `api`; you need `=~".*api.*"` for a substring.
- **Range vectors are not graphable.** `http_requests_total[5m]` alone errors in a graph panel — it must be wrapped in a range function.

**What follows from this topic**

PromQL is the lever that every other observability topic pulls. The **Instrumentation & Exporters** topic decides *what* series exist and — critically — their cardinality, which is what makes or breaks the queries here. The **SLO/alerting** material builds directly on the error-rate ratio and `histogram_quantile` patterns, wrapping them in multi-burn-rate windows. And **Metrics at Scale** exists largely because the naive PromQL patterns in this topic get expensive: recording rules, downsampling, and query sharding are all responses to PromQL cost. If the queries here feel shaky, the alerting topics will feel like magic incantations rather than engineering.

### Q1. What are the four expression types in PromQL, and how do they differ?

PromQL expressions always evaluate, at the query's eval timestamp, to one of four types:

- **Instant vector** — a set of time series, each with exactly one sample at the eval instant. `http_requests_total` returns one value per matching series. This is what you graph.
- **Range vector** — a set of time series, each with a *range* of samples over a lookback window, selected with `[duration]`: `http_requests_total[5m]`. You cannot graph this directly; it exists to feed functions like `rate()`.
- **Scalar** — a single floating-point value with no labels, e.g. the literal `0.95` or `scalar(...)`.
- **String** — a literal string, used only in a few functions like `label_replace`; rarely seen standalone.

The key exam trap: a range vector is not a value you can plot or alert on. `http_requests_total[5m] > 0` is a type error. You must reduce the range vector to an instant vector first — that's exactly what `rate`, `increase`, `avg_over_time`, etc. do.

### Q2. Explain label matchers. What's the difference between `=`, `!=`, `=~`, and `!~`?

Selectors filter series by labels inside `{}`:

```promql
http_requests_total{job="api", code=~"5..", handler!="/health"}
```

- `=` — exact equality. `job="api"`.
- `!=` — exact inequality. `env!="test"`.
- `=~` — regex match (RE2, **fully anchored**). `code=~"5.."` matches `500`, `503`.
- `!~` — regex non-match. `path!~"/internal/.*"`.

Two things bite people. First, regex is anchored on both ends, so `handler=~"api"` matches *only* the literal string `api`, not `/api/users`; you need `=~".*api.*"`. Second, an empty-string matcher `{label=""}` matches series that either don't have the label at all or have it empty — useful for "the ones without this dimension". You can also match on the metric name itself via the special `__name__` label: `{__name__=~"node_.*"}`.

### Q3. Why does `rate()` require a range vector, and what does it actually compute?

`rate()` computes the **per-second average rate of increase** of a counter over the range you give it. It needs a range vector because it needs at least two samples to compute a slope — a single instant value tells you nothing about rate of change.

```promql
rate(http_requests_total[5m])
```

Under the hood, over the `[5m]` window it takes the first and last samples, divides the increase by the time between them, and does two important things: (1) it is **reset-aware** — if the counter drops (a process restart resets it to 0), `rate` treats that as a reset and adds the pre-reset value rather than reporting a huge negative spike; (2) it **extrapolates** to the exact window boundaries, because samples rarely land precisely on the edges, which is why `rate` can return slightly non-integer results even for integer counters.

Rule of thumb for the window: make it at least **4× your scrape interval** so you always have enough samples to survive a missed scrape. A `[1m]` window on a 30s scrape has only ~2 samples and goes to "no data" the moment one scrape is missed.

### Q4. Compare `rate()`, `irate()`, and `increase()`. When do you use each?

| Function | Computes | Uses | Best for |
|---|---|---|---|
| `rate(c[5m])` | per-second avg over window | all samples in window | alerting, dashboards, smoothing |
| `irate(c[5m])` | per-second instantaneous rate | last **two** samples only | high-resolution graphs of volatile signals |
| `increase(c[5m])` | total increase over window | first/last, extrapolated | "how many events in the last N minutes" |

All three are for **counters** and all three are reset-aware. `increase(c[w])` is exactly `rate(c[w]) × w_seconds`, so it's just a rescaling.

Use `rate` almost always — it averages out scrape jitter. Use `increase` when you want a human-readable count ("47 errors in 5 minutes") rather than a per-second figure. Avoid `irate` for alerting: because it only looks at the last two samples, a single fast scrape pair can produce a huge spike that trips an alert, or a slow pair can mask a real surge. `irate` is a graphing tool for signals that move faster than your window would otherwise show.

### Q5. Explain aggregation operators and the difference between `by()` and `without()`.

Aggregation operators collapse a vector across its label dimensions: `sum`, `avg`, `min`, `max`, `count`, `stddev`, `topk`, `bottomk`, `quantile`, `count_values`. By default they aggregate away *all* labels, returning a single series:

```promql
sum(rate(http_requests_total[5m]))          # one number: total req/s
```

To keep dimensions, use `by` (whitelist — keep only these) or `without` (blacklist — keep everything except these):

```promql
sum by (job, code)  (rate(http_requests_total[5m]))     # per job+code
sum without (instance) (rate(http_requests_total[5m]))  # collapse instances
```

`by(job)` keeps only `job`; `without(instance)` keeps every label *except* `instance`. In practice `without(instance, pod)` is often safer than `by(...)` because it survives when someone adds a new meaningful label — you don't silently drop it. `topk(3, ...)` and `quantile(0.9, ...)` take a parameter before the vector. The classic gotcha: forgetting to group means you sum unrelated series together (e.g. adding `2xx` and `5xx` rates into one meaningless line).

### Q6. How do you compute a latency percentile from a histogram? Explain `histogram_quantile`.

Prometheus histograms expose cumulative bucket counters named `<metric>_bucket` with a `le` ("less than or equal") label. To get the p99 request latency:

```promql
histogram_quantile(
  0.99,
  sum by (le) (rate(http_request_duration_seconds_bucket[5m]))
)
```

Read it inside-out: `rate(..._bucket[5m])` gives the per-second rate into each bucket, `sum by (le)` aggregates buckets across instances (you must keep `le`!), and `histogram_quantile(0.99, ...)` interpolates the 99th percentile from the bucket boundaries.

Caveats that interviewers want to hear: the result is only as accurate as your **bucket boundaries**. `histogram_quantile` assumes values are *linearly distributed within a bucket*, which is rarely true, so a coarse bucket layout (e.g. jumping from 1s to 10s) yields a wildly interpolated p99. If your p99 falls in the `+Inf` bucket, you get the last finite boundary back — a sign your buckets are too small. And you must aggregate the **buckets**, never the per-instance quantiles (see Q7).

### Q7. Why is `avg(p99)` across instances wrong, and what should you do instead?

Percentiles are not linearly combinable. The p99 of the whole fleet is not the average (or max) of each instance's p99. Consider one instance serving 1 req/s at 10s and another serving 10,000 req/s at 10ms — averaging their p99s tells you nothing about the actual tail a user experiences.

The correct approach is to aggregate the underlying **histogram buckets** and then compute the quantile once over the combined distribution:

```promql
# WRONG
avg(histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m])))

# RIGHT
histogram_quantile(
  0.99,
  sum by (le) (rate(http_request_duration_seconds_bucket[5m]))
)
```

This is why you must ship latency as a **histogram** and not as a pre-aggregated summary if you ever need fleet-wide or per-route percentiles — summaries compute quantiles per-instance and cannot be merged.

### Q8. Write the canonical error-rate query. What are the pitfalls?

The standard "fraction of requests that are errors" query is a ratio of two rates:

```promql
sum(rate(http_requests_total{code=~"5.."}[5m]))
/
sum(rate(http_requests_total[5m]))
```

Pitfalls:

- **Grouping must match on both sides.** If you add `by (job)` to the numerator, add it to the denominator too, or vector matching fails and you get "no data".
- **Divide by zero.** When traffic drops to zero the denominator is 0 and you get `NaN`. For an SLI you often want to guard this or accept that no-traffic means no error signal.
- **Define "valid" carefully.** Should `4xx` count as errors? Usually client errors are excluded from availability SLIs; only count what *you* are responsible for. Filtering `code=~"5.."` bakes that decision in.
- **Same metric, same labels.** Numerator and denominator must come from the same counter so the label sets line up for matching.

### Q9. Explain vector matching: one-to-one vs many-to-one, and `on`/`ignoring`.

When you combine two vectors with an operator (`/`, `+`, `and`, etc.), Prometheus pairs series by their **full label sets** by default — one-to-one. A pair matches only if all labels are identical on both sides.

To match on a *subset* of labels, use `on(...)` (match only these) or `ignoring(...)` (match on all but these):

```promql
rate(errors_total[5m])
/ ignoring(code)
rate(requests_total[5m])
```

When one side has multiple series matching a single series on the other (many-to-one), you must declare which side is the "many" with `group_left` or `group_right`:

```promql
# join per-pod metric to a per-pod info/metadata series
rate(http_requests_total[5m])
* on(pod) group_left(version)
kube_pod_info
```

`group_left(version)` says "the left side is the many side, and additionally copy the `version` label from the right". This info-metric join pattern is extremely common for decorating metrics with metadata (owner, version, region) without embedding those labels in the raw metric.

### Q10. What do the `offset` and `@` modifiers do?

Both let a query reference a point in time other than the eval instant.

`offset` shifts the lookback backward by a fixed duration — useful for "compare now to an hour ago":

```promql
rate(http_requests_total[5m])
/
rate(http_requests_total[5m] offset 1h)
```

`@` pins evaluation to an **absolute** Unix timestamp (or the special `start()`/`end()` of a range query), which is handy for anchoring to a fixed reference point regardless of when the query runs:

```promql
http_requests_total @ 1609459200
max_over_time(rate(http_requests_total[5m])[1h:] @ end())
```

Use `offset` for relative comparisons (week-over-week, hour-over-hour) and `@` when you need a stable, absolute anchor — e.g. comparing every point in a range against a single fixed baseline.

### Q11. What is a subquery and when do you need one?

A subquery evaluates an instant-vector expression over a range, producing a range vector you can then feed into a range function — effectively a range vector *of a computed expression* rather than a raw metric. Syntax: `<expr>[<range>:<resolution>]`.

```promql
max_over_time( rate(http_requests_total[5m])[1h:1m] )
```

This computes `rate(...[5m])` at 1-minute steps over the past hour, then takes the max — "the highest 5-minute request rate seen in the last hour". Without subqueries you'd have to precompute the inner `rate` as a recording rule first.

Subqueries are powerful but **expensive**: the engine runs the inner query at every resolution step. For anything queried frequently (dashboards, alerts), promote the inner expression to a recording rule and query that instead. Use subqueries for ad-hoc exploration, not hot paths.

### Q12. What are recording rules and how should you name them?

A recording rule precomputes a PromQL expression on a schedule and stores the result as a **new time series**. This trades a little storage for large query-time savings on expensive or frequently-run queries (dashboards, alert expressions).

```yaml
groups:
  - name: api_slis
    interval: 30s
    rules:
      - record: job:http_request_errors:rate5m
        expr: sum by (job) (rate(http_requests_total{code=~"5.."}[5m]))
      - record: job:http_requests:rate5m
        expr: sum by (job) (rate(http_requests_total[5m]))
```

The naming convention is `level:metric:operations` — the **aggregation level** (the labels you kept, e.g. `job`), the metric name, and the **operations applied** (e.g. `rate5m`, `sum`). So `job:http_request_errors:rate5m` reads as "errors, aggregated to job level, as a 5-minute rate". Good naming makes rules self-documenting and prevents you from accidentally re-aggregating an already-aggregated series (which would double-count).

### Q13. Explain alerting rules and the `for:` clause. Why does `for:` matter?

An alerting rule fires when its PromQL expression returns a non-empty vector; each returned series becomes an alert instance. The `for:` clause requires the condition to stay true for a sustained duration before the alert transitions from `pending` to `firing`:

```yaml
groups:
  - name: availability
    rules:
      - alert: HighErrorRate
        expr: |
          sum by (job) (rate(http_requests_total{code=~"5.."}[5m]))
          / sum by (job) (rate(http_requests_total[5m])) > 0.05
        for: 10m
        labels:
          severity: page
        annotations:
          summary: "{{ $labels.job }} error rate above 5% for 10m"
```

`for:` is your primary defence against **flapping**. Without it, a single momentary spike pages someone at 3am. With `for: 10m`, the condition must hold for ten continuous minutes. The trade-off is detection latency vs noise: too long and you're slow to react; too short and you get alert fatigue. This is exactly the tension that multi-window multi-burn-rate SLO alerts formalise — fast burn uses a short window, slow burn a long one.

### Q14. How do you detect that a target has stopped reporting a metric entirely?

If a series disappears (target down, job removed, metric renamed), a normal threshold alert on it simply returns nothing and **never fires** — the classic "our alert was green because the exporter was dead" failure. Use `absent()` or `absent_over_time()`:

```promql
absent(up{job="api"})                          # fires if no `up` series for job=api
absent_over_time(http_requests_total{job="api"}[10m])
```

`absent()` returns a `1`-valued series *only when its argument has no results*, so you can alert on the absence itself. `absent_over_time([10m])` is stricter — it fires only if the series has been missing for the whole window, avoiding false alarms on a single missed scrape. The most robust dead-man's-switch is a separate always-firing alert routed to a watchdog that pages if it ever *stops* arriving — that catches Prometheus itself being down, which `absent()` inside that same Prometheus cannot.

### Q15. Walk me through debugging a PromQL query that returns "no data".

"No data" almost always means a **label or type mismatch**, not a Prometheus outage. My checklist:

1. **Strip it down.** Query just the bare metric name — `http_requests_total` — in the expression browser. If that's empty, the metric isn't being scraped (check `up{job=...}` and the target's `/metrics`).
2. **Add matchers back one at a time.** A single wrong label value (`code="500"` when it's actually `code="500 "` or the metric uses `status`) drops everything.
3. **Check regex anchoring.** `=~"api"` matches only `api`; you probably want `=~".*api.*"`.
4. **Check vector matching.** In a division or `and`, mismatched label sets between the two sides produce empty results. Run each side alone, then compare label sets; add `on()`/`ignoring()` to fix the join.
5. **Check types.** A raw range vector (`metric[5m]`) in a graph panel errors; wrap it in `rate`/`avg_over_time`.
6. **Check staleness/time range.** If the target only started reporting recently, widen the graph range.

The discipline is *bisection* — reduce to the smallest expression that returns data, then add complexity back until it breaks.

### Q16. Why is a high-cardinality `group by` dangerous, and how do you spot it?

Every unique combination of the labels you `by()` on becomes an output series, and Prometheus must hold them all in memory during evaluation. `sum by (user_id) (...)` on a service with a million users tries to produce a million series — the query slows to a crawl or OOMs the server, and if it's a *recording rule* it permanently writes that cardinality to disk.

Spot it by asking "how many distinct values can this label take?" Any unbounded dimension — `user_id`, `request_id`, `email`, full URL path, session token — is a red flag. Use `count(count by (label) (metric))` to measure a label's cardinality directly. The fix is to aggregate on **bounded** dimensions only (`job`, `route` after normalisation, `code`, `region`) and push high-cardinality investigation to logs or traces, where per-request detail belongs. Cardinality is the number-one driver of both query cost and storage bills.

### Q17. How would you use `predict_linear` for capacity planning?

`predict_linear(v[range], t)` fits a simple linear regression over the range vector and extrapolates `t` seconds into the future. The classic use is "will the disk fill up before someone can act?":

```promql
predict_linear(node_filesystem_avail_bytes{mountpoint="/"}[6h], 4 * 3600) < 0
```

This reads: based on the last 6 hours of free-space trend, will free bytes be below zero (i.e. full) in 4 hours? If so, fire. Alerting on a *predicted* exhaustion rather than a static "90% full" threshold gives you lead time proportional to how fast it's actually filling — a slow leak and a runaway log get different warning windows automatically.

Caveats: it's a *linear* fit, so it's poor for bursty or sawtooth signals, and the range window should be long enough to smooth noise but short enough to reflect the current trend. It's ideal for slowly-trending gauges: disk, memory growth, certificate expiry runway.

### Q18. What's wrong with `http_requests_total > 100` as an alert?

Several things, and they're instructive:

- **It's a counter total, not a rate.** `http_requests_total` is cumulative since the process started, so it only ever grows. `> 100` will be true within seconds of startup and stay true forever — it's not measuring "current load" at all. You want `rate(http_requests_total[5m]) > 100` for req/s.
- **No aggregation.** Without `sum`, this fires per-series, so you may get one alert per instance/handler/code combination — a storm.
- **It alerts on a cause, not a symptom.** High request volume isn't inherently bad; users care about errors and latency. Prefer symptom-based alerts (error ratio, p99 latency, SLO burn) over raw traffic.
- **No `for:`.** Even corrected to a rate, a momentary spike would page. Add `for: 5m`.

A defensible version: `sum(rate(http_requests_total[5m])) > 100 for: 10m` — and even then, only if request volume is genuinely a capacity signal you care about.

## Instrumentation & Exporters

### Summary

**What this topic covers**

Where metrics come from. This topic's 15 questions cover **direct instrumentation** (adding counters, gauges, and histograms to your own code with the Go/Java/Python client libraries and exposing `/metrics`), **what to instrument** (RED for request-driven services, USE for resources, the four golden signals), **labels** — the single most consequential and most dangerous design decision — the **exporter pattern** (translating a third-party system's stats into Prometheus format: `node_exporter`, `mysqld_exporter`, `blackbox_exporter` for probing), **OpenMetrics** as the standardised exposition format, **histograms vs summaries** and bucket selection (including native histograms), **cardinality control** (route normalisation, no unbounded labels), the **pushgateway** for batch jobs, **exemplars** linking a metric bucket to a trace, instrumenting frameworks via middleware, testing instrumentation, and the real cost of over-instrumenting. The recurring theme: instrumentation decisions made in five minutes of code determine your metrics bill and query performance for years.

**Mental model**

Prometheus is fundamentally **pull-based**: your job as an instrumenter is to expose a plain-text `/metrics` endpoint that Prometheus scrapes on a schedule. Two ways to fill that endpoint. **Direct instrumentation** — you import a client library, declare metric objects (a counter for events, a gauge for levels, a histogram for distributions), and mutate them inline in your code; the library serialises them on scrape. **Exporters** — for systems you can't modify (a database, the kernel, a network device), a small sidecar process queries that system's native stats and *translates* them into Prometheus metrics on its own `/metrics`. Either way, every metric is `name{labels} value`, and the label set is a Cartesian product: each unique combination is a separate stored series. So the mental discipline is: pick the *smallest* set of *bounded* labels that lets you slice the signal usefully, and never let a request-scoped identifier become a label. Instrument the golden signals first; add detail only when a real question demands it.

**Key terms**

- **Direct instrumentation** — adding metric objects to your own source via a client library.
- **Exporter** — a process that translates a third-party system's metrics into Prometheus format.
- **Client library** — official SDK (Go, Java, Python, Rust, etc.) that manages metric state and exposition.
- **Counter** — monotonically increasing value (requests, errors, bytes); reset only on restart. Query with `rate()`.
- **Gauge** — value that goes up and down (temperature, queue depth, in-flight requests).
- **Histogram** — samples observations into cumulative buckets + `_sum` + `_count`; aggregatable, enables `histogram_quantile`.
- **Summary** — computes quantiles client-side; cheaper per-series but **not aggregatable** across instances.
- **Native/exponential histogram** — newer histogram with automatic, high-resolution exponential buckets and far lower storage cost.
- **RED** — Rate, Errors, Duration; the per-endpoint request signals.
- **USE** — Utilization, Saturation, Errors; the per-resource signals.
- **Cardinality** — count of unique label-value combinations; the dominant cost driver.
- **Exemplar** — a sampled trace ID attached to a metric observation, linking a bucket to an example request.
- **Pushgateway** — a component batch jobs push to, so short-lived jobs can be scraped after they exit.

**Why interviewers ask this**

Instrumentation separates people who *consume* dashboards from people who *build* the observability that makes dashboards possible. The junior answer instruments everything with rich labels "to be safe" — and ships a cardinality bomb. The senior answer starts from the *questions* they need to answer (what's the error rate per route? what's tail latency?), chooses the four golden signals, and is ruthless about keeping labels bounded — normalising `/users/42` to `/users/:id` before it ever becomes a label. Interviewers also probe judgement calls: histogram vs summary (aggregatability), direct instrumentation vs exporter (can you modify the source?), counter vs gauge (does it only go up?), and when a pushgateway is appropriate (batch jobs — and its pitfalls). And they want to hear cost-awareness: over-instrumenting is a real, expensive failure mode, not a harmless excess.

**Common confusions**

- **"More labels = more insight."** More labels = multiplicative cardinality = cost and slow queries. Labels are precious.
- **Summary vs histogram.** Summaries compute quantiles per-instance and *cannot be aggregated*; histograms store buckets and *can*. Prefer histograms for anything fleet-wide.
- **Counter vs gauge.** If it can decrease, it's a gauge. Rate-ing a gauge is meaningless; a counter you compare directly is meaningless.
- **"Exporters scrape apps."** Exporters *expose* metrics for Prometheus to scrape; Prometheus does the scraping. The exporter translates.
- **Pushgateway as a general push endpoint.** It's for **batch jobs** only; using it as a metrics buffer for services breaks Prometheus's up/down semantics and creates stale series.
- **Unbounded labels are fine "for now."** A `user_id` or full-path label is a permanent liability; it's much harder to remove a label later than to never add it.

**What follows from this topic**

Everything queried in **PromQL** exists because it was instrumented here — and the cardinality decisions in this topic are precisely what make those queries fast or ruinous. The histogram choices here are what make the `histogram_quantile` percentile queries possible; the RED signals here are what the **SLO/alerting** layer turns into error budgets. Exemplars are the bridge to **tracing**, and the exporter pattern connects to **Metrics at Scale**, where the volume of all this exposed data forces federation and long-term storage. Instrument thoughtfully and the rest of the stack is tractable; instrument carelessly and every downstream topic inherits the mess.

### Q1. How do you instrument an application from scratch? Walk through the steps.

Pick the official **client library** for your language, declare metric objects, mutate them in the hot path, and expose a `/metrics` endpoint for Prometheus to scrape. A minimal Python example:

```python
from prometheus_client import Counter, Histogram, start_http_server

REQS = Counter("http_requests_total", "Total HTTP requests", ["method", "route", "code"])
LAT  = Histogram("http_request_duration_seconds", "Request latency", ["method", "route"])

def handle(request):
    with LAT.labels(request.method, request.route).time():
        code = process(request)
        REQS.labels(request.method, request.route, str(code)).inc()

start_http_server(8000)   # exposes /metrics
```

Steps in order: (1) import the client library; (2) declare metrics at module scope with a clear name, help text, and a *small, bounded* label set; (3) instrument the golden signals first — a request counter and a latency histogram covers Rate, Errors (via the `code` label), and Duration; (4) expose `/metrics`, either with the library's built-in server or your framework's middleware; (5) add a scrape config so Prometheus discovers the target. Start minimal; you can add metrics later, but you can't cheaply un-ship a bad label.

### Q2. Explain counter, gauge, histogram, and summary. When do you use each?

| Type | Behaviour | Example | Query with |
|---|---|---|---|
| Counter | only increases (resets on restart) | requests, errors, bytes sent | `rate()`, `increase()` |
| Gauge | up and down | in-flight requests, queue depth, temp | direct value, `delta()`, `deriv()` |
| Histogram | buckets an observation distribution | latency, response size | `histogram_quantile()` over `_bucket` |
| Summary | client-computed quantiles + sum/count | latency (single instance) | read `{quantile="0.99"}` directly |

**Counter** for anything monotonic — the value only means something as a rate. **Gauge** for a current level. **Histogram** for distributions you'll want percentiles or aggregation on. **Summary** rarely: it computes quantiles inside the client, which is cheaper and needs no bucket choice, but the quantiles **cannot be aggregated across instances** and you can't change the quantile after the fact. Rule: latency → histogram, unless you have exactly one instance and fixed quantiles.

### Q3. What should you instrument first? Explain RED, USE, and the four golden signals.

Don't instrument everything; instrument the frameworks that answer "is it broken and why":

- **RED** — for every **request-driven** service/endpoint: **R**ate (requests/sec), **E**rrors (failed requests/sec), **D**uration (latency distribution). This is the user-facing view.
- **USE** — for every **resource** (CPU, memory, disk, network, connection pool): **U**tilization (% busy), **S**aturation (queued/backlogged work), **E**rrors. This is the cause-side view.
- **Four Golden Signals** (Google SRE) — **Latency, Traffic, Errors, Saturation.** Essentially RED plus Saturation; the canonical starting set for any service.

The practical recipe: expose RED on every endpoint (a labelled request counter + a latency histogram gives you all three), USE on every resource you own, and you can debug the vast majority of incidents. RED tells you *that* users are hurting; USE tells you *why*. Add bespoke business metrics only after the golden signals are solid.

### Q4. Where should labels go, and when are they dangerous?

Labels are how you slice a metric — `code`, `method`, `route`, `region`, `job`. The rule is simple and absolute: **label values must be bounded and low-cardinality.** Each unique combination is a separately stored, separately queried series, and the cost is *multiplicative* across labels.

Safe labels have a small, stable set of values: HTTP method (~7), status code (a few dozen), normalised route (tens), region (a handful). Dangerous labels are unbounded or per-request: `user_id`, `email`, `request_id`, `session_id`, full URL path with IDs, raw SQL query, timestamp. A single unbounded label can create millions of series and make Prometheus OOM.

```python
# DANGER: unbounded label
REQS.labels(user_id=req.user_id).inc()          # millions of series

# SAFE: bounded, normalised
REQS.labels(route="/users/:id", code="200").inc()
```

If you need per-user detail, that belongs in **logs or traces**, not metric labels. When in doubt, ask "how many distinct values can this take, ever?" If the answer is unbounded, it's not a label.

### Q5. Explain the exporter pattern. Give examples.

You can't add Prometheus client code to the Linux kernel, MySQL, or a third-party appliance. An **exporter** is a small adapter process that queries the target system's native stats interface and *re-exposes* them as Prometheus metrics on its own `/metrics`, which Prometheus then scrapes.

- **`node_exporter`** — reads `/proc` and `/sys`, exposes host metrics (CPU, memory, disk, filesystem, network) — the USE signals for a machine.
- **`mysqld_exporter`** — connects to MySQL, runs `SHOW STATUS`/`SHOW VARIABLES`, exposes connections, query rates, replication lag, buffer pool stats.
- **`blackbox_exporter`** — **probes** endpoints from the outside: HTTP/HTTPS status and latency, TCP connect, ICMP, DNS resolution, and **TLS certificate expiry**. Prometheus scrapes it with a `target` param and it performs the probe.

The pattern's shape is always the same: *translate* a system's existing metrics into the Prometheus data model without modifying that system. Use direct instrumentation when you own the code; reach for (or write) an exporter when you don't.

### Q6. How does `blackbox_exporter` differ from other exporters, and what's it for?

Most exporters expose the *internal* state of a system you run (`node_exporter` reads the local host, `mysqld_exporter` reads a DB you operate). `blackbox_exporter` is different: it performs **active probes from the outside**, measuring what a client would experience. Prometheus tells it *what* to probe via a URL parameter, and it reports whether the probe succeeded and how long it took.

```yaml
# Prometheus scrape config for blackbox HTTP probing
- job_name: blackbox-http
  metrics_path: /probe
  params:
    module: [http_2xx]
  static_configs:
    - targets: ["https://my-service.example.com/health"]
  relabel_configs:
    - source_labels: [__address__]
      target_label: __param_target
    - source_labels: [__param_target]
      target_label: instance
    - target_label: __address__
      replacement: blackbox-exporter:9115
```

It's ideal for **synthetic/black-box monitoring**: is the public endpoint reachable, is DNS resolving, is the TLS cert about to expire (`probe_ssl_earliest_cert_expiry`), is the response within SLA. It complements white-box instrumentation — the app can be "healthy" internally while the load balancer or cert is broken from the user's side.

### Q7. What is OpenMetrics and why does it matter?

OpenMetrics is the **standardised, vendor-neutral exposition format** derived from Prometheus's text format and now the basis of the ecosystem's wire format. It specifies exactly how metrics are serialised on `/metrics`: metric names, `# HELP` and `# TYPE` metadata, label syntax, and value formatting.

```text
# HELP http_requests_total Total HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",code="200"} 1027
```

Why it matters: it decouples *producers* (any client library or exporter in any language) from *consumers* (Prometheus, but also Grafana Agent, OpenTelemetry Collector, VictoriaMetrics, etc.). Because everyone agrees on the format, an exporter written for Prometheus works with any OpenMetrics-compatible scraper. OpenMetrics also standardised first-class support for **exemplars** (trace links) and richer type metadata, which the original text format lacked. Practically, you rarely write it by hand — the client library emits it — but knowing it's the contract explains why the ecosystem interoperates.

### Q8. How do you choose histogram buckets? What are native histograms?

Classic Prometheus histograms use **fixed, predefined buckets**, and your choice directly determines percentile accuracy. Buckets should straddle your SLO and cluster where the distribution actually lives:

```python
# For an endpoint with a 300ms SLO, buckets around it:
Histogram("http_request_duration_seconds", "...",
          buckets=[.005, .01, .025, .05, .1, .25, .5, 1, 2.5, 5, 10])
```

Pick buckets so your target percentile (say p99) falls *between* boundaries, not in a huge gap or the `+Inf` bucket — coarse buckets make `histogram_quantile` interpolate wildly (see the PromQL topic). But every bucket is a stored series per label combination, so more buckets = more cardinality.

**Native (exponential) histograms** solve the trade-off: instead of fixed buckets you configure a resolution, and the histogram automatically creates exponentially-spaced buckets covering the whole range, stored far more compactly. You get high-resolution percentiles across many orders of magnitude without pre-guessing boundaries or paying per-bucket series cost. Where supported end-to-end, native histograms are the modern default for latency.

### Q9. How do you avoid cardinality bombs when instrumenting?

Cardinality is set at instrumentation time, and the fixes are all about the label set:

- **Never label with request-scoped IDs.** No `user_id`, `request_id`, `session`, `trace_id` as labels. That detail goes in traces/logs.
- **Normalise routes before labelling.** Turn `/users/42/orders/99` into `/users/:id/orders/:id`. Do this with the framework's route template, *not* the raw path — the raw path with IDs is unbounded.
- **Cap error/message labels.** Don't label with raw exception messages or free-text; map to a bounded set of error *types*.
- **Watch multiplicative growth.** Cardinality is the product of each label's value count: `method(7) × route(50) × code(15) = 5,250` per instance — fine. Add a `user_id` and it's millions.
- **Measure it.** `count(count by (route) (http_requests_total))` tells you a label's real cardinality; audit before shipping.

The asymmetry to remember: adding a bad label is a one-line change; removing it later after dashboards, alerts, and recording rules depend on it is painful. Default to fewer, bounded labels.

### Q10. What is the pushgateway and when should you use it — and not use it?

Prometheus scrapes targets that are up long enough to be scraped. A **batch job** that runs for 20 seconds and exits would never be scraped. The **pushgateway** solves exactly this: the job *pushes* its final metrics to the gateway before exiting, and Prometheus scrapes the gateway, so the last values persist.

```bash
echo "batch_job_last_success_timestamp_seconds $(date +%s)" \
  | curl --data-binary @- http://pushgateway:9091/metrics/job/nightly_etl
```

Use it **only for service-level batch/cron jobs** where you can't be scraped while alive. Do **not** use it as a general push endpoint for long-running services, because:

- It **breaks up/down semantics** — the gateway is always "up", so you lose the target-down signal.
- Values are **sticky** — a pushed metric persists until overwritten or deleted, so a dead job's stale values linger and can mislead.
- It's a **single point of aggregation**, not a buffer for high-volume metrics.

For services, stick to pull-based scraping. For batch jobs, push a `last_success_timestamp` and alert if it goes stale.

### Q11. What are exemplars and why are they useful?

An **exemplar** is a sampled example attached to a metric observation — typically a **trace ID** — that links an aggregate metric bucket back to a concrete request. So when a latency histogram shows your p99 bucket lit up, an exemplar lets you jump straight from "the slow bucket" to "*this specific trace* that landed in it".

```text
# OpenMetrics exposition with an exemplar (trace_id) on a bucket
http_request_duration_seconds_bucket{le="0.5"} 1234 # {trace_id="abc123"} 0.42 1609459200
```

This is the practical bridge between the **metrics** pillar (cheap, aggregate, tells you *that* it's slow) and the **traces** pillar (detailed, per-request, tells you *why*). Without exemplars, seeing a latency spike on a dashboard leaves you hunting for a matching trace by hand; with them, Grafana renders clickable dots on the histogram that deep-link into the trace. Client libraries attach exemplars when a trace context is active, and OpenMetrics standardises their exposition.

### Q12. How do you instrument a web framework without touching every handler?

Use **middleware** — a single wrapper in the request pipeline that records the golden signals for every route automatically, so individual handlers stay clean:

```python
# Flask/WSGI-style middleware sketch
def metrics_middleware(app):
    def wrapped(environ, start_response):
        start = time.time()
        route = normalise_route(environ["PATH_INFO"])   # /users/:id, not /users/42
        def capture(status, headers):
            REQS.labels("GET", route, status.split()[0]).inc()
            LAT.labels("GET", route).observe(time.time() - start)
            return start_response(status, headers)
        return app(environ, capture)
    return wrapped
```

Most frameworks and client libraries ship an official middleware/interceptor (Express, Flask, Spring Boot Actuator + Micrometer, gRPC interceptors) that does this for you. The one thing you *must* get right is **route normalisation**: label with the route *template* the framework matched (`/users/:id`), never the raw path, or you reintroduce the cardinality bomb. Middleware gives you consistent RED coverage across every endpoint with zero per-handler code.

### Q13. How do you test instrumentation?

Instrumentation is code, so test it — but test the *behaviour*, not the internals. The client libraries expose a registry you can read in tests to assert a metric moved the way you expect:

```python
from prometheus_client import REGISTRY

def test_error_increments_counter():
    before = REGISTRY.get_sample_value(
        "http_requests_total", {"route": "/x", "code": "500"}) or 0
    handle(make_request("/x", fail=True))
    after = REGISTRY.get_sample_value(
        "http_requests_total", {"route": "/x", "code": "500"})
    assert after == before + 1
```

What to assert: the right metric exists, increments on the right events, carries the expected (bounded) labels, and — importantly — does **not** carry a high-cardinality label (you can assert the label set). Also validate that `/metrics` parses as valid OpenMetrics (a promtool check or a scrape in CI). And test route normalisation directly, since that's the usual source of accidental cardinality. Treat "we shipped a `user_id` label" as a bug that a test should have caught.

### Q14. What is the cost of over-instrumenting, and how do you avoid it?

Over-instrumenting is a real, expensive failure mode, not harmless thoroughness. Costs:

- **Storage and money.** Every series consumes memory (active series bound Prometheus's RAM) and long-term storage. A cardinality explosion can multiply your bill 10–100×.
- **Query performance.** More series means slower evaluations, slower dashboards, and heavier recording rules.
- **Operational fragility.** High cardinality is the top cause of Prometheus OOMs and the number-one "why is our metrics bill exploding" incident.
- **Noise.** Hundreds of rarely-read metrics bury the golden signals that actually matter during an incident.

Avoid it by instrumenting *from questions, not from instinct*: start with the four golden signals, add a metric only when there's a concrete question it answers, keep labels bounded, and periodically audit with `topk` on series count per metric to find and prune the offenders. "Instrument everything just in case" is how you get a metrics bill nobody can explain.

### Q15. Direct instrumentation vs an exporter — how do you decide?

The deciding question is simple: **do you control the source code?**

- **You own the code → direct instrumentation.** Import the client library, declare metrics inline, expose `/metrics`. You get exactly the signals you want, with the semantics you choose, close to the logic.
- **You don't own it (a database, the kernel, a SaaS, a network device) → exporter.** Run (or write) an adapter that reads the system's native stats and translates them to Prometheus format.

Secondary considerations: an exporter is also the right call when many teams need the *same* metrics from a shared system (run one `mysqld_exporter`, not instrumentation in every app), or when you need **black-box** probing of something you can't instrument at all (`blackbox_exporter`). Direct instrumentation is richer and cheaper to query but only possible where you can change the code. In a real stack you use both: your services are directly instrumented; your infrastructure is covered by exporters.

## Metrics at Scale & Long-Term Storage

### Summary

**What this topic covers**

What happens when one Prometheus is no longer enough. This topic's 15 questions cover **why a single Prometheus doesn't scale forever** (memory bound by active series/cardinality, local disk, single region, limited retention), the **horizontal scaling patterns** — functional sharding and hierarchical federation — the **`remote_write`** protocol for shipping samples to a long-term backend, and the big long-term/HA systems: **Thanos** (sidecar + object storage + querier + compactor, global view, downsampling), **Cortex/Grafana Mimir** (horizontally scalable, multi-tenant, `remote_write` ingest), and **VictoriaMetrics** (single-binary alternative). It also covers **downsampling and retention tiers** (raw → 5m → 1h), **global query view and dedup** across HA replicas, **multi-tenancy**, **object storage** (S3/GCS) as cheap long-term, cardinality as the cost driver at scale, **highly-available alerting**, **query performance** (recording rules, query sharding), and when to just buy a **managed service** (Grafana Cloud, Amazon Managed Prometheus, Datadog).

**Mental model**

A single Prometheus is a beautifully simple, self-contained box: it scrapes, stores locally on one disk, and answers queries — all in one process, no dependencies. That simplicity is also its ceiling. It's bound by the RAM needed to hold all **active series** (a function of cardinality), by one machine's local disk (so retention is weeks, not years), and by living in one place (no cross-region global view, and if it dies you're blind). Scaling is about relaxing each constraint without throwing away the model. You **shard** to spread the series/scrape load across multiple Prometheis. You run **HA pairs** (two identical Prometheis) so one dying doesn't blind you. And you offload old data to cheap, effectively-infinite **object storage** behind a system (Thanos/Mimir/VictoriaMetrics) that presents a **single global query view** across all shards, both replicas (deduplicated), and all history — with **downsampling** so year-long queries don't scan raw data. The recurring cost driver, at every layer, is still **cardinality**.

**Key terms**

- **Active series** — distinct series currently being ingested; the primary RAM constraint on a Prometheus.
- **Functional sharding** — splitting scrape targets across independent Prometheis (by team/region/service).
- **Federation** — a parent Prometheus scrapes *aggregated* series from child Prometheis (hierarchical roll-up).
- **`remote_write`** — protocol that streams samples from Prometheus to a remote long-term backend.
- **`remote_read`** — protocol to query samples back from a remote backend.
- **Thanos** — sidecar-based system adding object storage, global query, dedup, and downsampling to existing Prometheis.
- **Cortex / Grafana Mimir** — horizontally scalable, multi-tenant TSDB ingesting via `remote_write`.
- **VictoriaMetrics** — high-performance, resource-efficient TSDB, available as a single binary or clustered.
- **Downsampling** — precomputing lower-resolution series (5m, 1h) for fast long-range queries.
- **Retention tiers** — raw for recent, 5m and 1h aggregates for older data.
- **Global query view** — one query endpoint spanning all shards, replicas, and history.
- **Deduplication** — merging results from redundant HA replicas so you see one clean series.
- **Multi-tenancy** — isolating metrics/queries per team or customer within one cluster.

**Why interviewers ask this**

This is the topic that reveals whether someone has run monitoring at real scale or only in a demo. The junior instinct is "just give Prometheus a bigger disk"; the senior understands that the binding constraint is **active series in RAM**, that local storage caps retention, and that a single node has no HA or global view — so the answer is sharding + HA + object-storage-backed long-term storage, not a bigger box. Interviewers probe the trade-offs between **federation** (simple, but you lose granularity and it doesn't fix HA) and **`remote_write`** (full-fidelity to a scalable backend), and whether you can compare **Thanos vs Mimir vs VictoriaMetrics** on their real axes (bolt-on-to-existing-Prometheus vs purpose-built cluster vs efficiency/simplicity). They also want cost-awareness: at scale, the bill is driven by cardinality and retention, and the mature answer often includes "and here's when I'd just pay for a managed service instead of operating this myself".

**Common confusions**

- **"Add more disk to scale."** The hard limit is RAM for active series (cardinality), not disk. Disk caps retention, not ingest capacity.
- **Federation = long-term storage.** No — federation rolls up *aggregates* and loses raw granularity; it's for hierarchy, not history or HA. Use `remote_write` for long-term.
- **HA replicas give you double the capacity.** They give you *redundancy*, not more capacity — both scrape the *same* targets; you dedup at query time.
- **Thanos and Mimir are the same shape.** Thanos bolts onto existing Prometheis via sidecars; Mimir/Cortex ingests via `remote_write` into a purpose-built cluster.
- **Downsampling loses your data.** Raw is retained per policy; downsampled tiers are *additional* low-res copies for fast long-range queries — you can still query raw within its window.
- **Multi-tenancy is just dashboards.** True multi-tenancy isolates ingest, storage, and query per tenant, with per-tenant limits — it's an ingest/storage property, not a UI one.

**What follows from this topic**

This topic is where the whole primer's cost story comes home. Everything the **Instrumentation** topic exposed and everything **PromQL** queries has to physically live somewhere and be paid for — and the **cardinality** discipline preached earlier is exactly what determines whether your scale-out is affordable or ruinous. The recording rules and query-sharding techniques here are the same PromQL performance tools, applied at fleet scale. And the "when to buy vs build" judgement connects to the broader SRE theme of spending engineering effort where it differentiates: operating a global metrics platform is a serious commitment, and knowing when a managed service is the right call is itself a senior signal.

### Q1. Why doesn't a single Prometheus scale forever? What are the limits?

A single Prometheus is deliberately simple — one process, local disk, no clustering — and that's exactly why it hits walls:

- **Memory is bound by active series (cardinality).** Prometheus holds the head block and per-series metadata in RAM. Ingest capacity is limited by how many distinct series you're scraping, not by CPU or disk. A cardinality explosion OOMs the process.
- **Local storage caps retention.** Data lives on one local TSDB. You can retain weeks comfortably, but years of high-resolution data won't fit on one disk — and local disk isn't durable or infinitely growable.
- **Single region, single point of failure.** One Prometheus lives in one place. If it (or its host/AZ) dies, you're blind. There's no built-in cross-region or global view.
- **No horizontal query scale.** One node answers all queries; a heavy dashboard or long-range query competes with ingestion.

So "scaling Prometheus" means addressing each: shard to spread series, run HA pairs for durability, and offload to object storage behind a global-query layer for long retention.

### Q2. What is functional sharding and how does it differ from federation?

Both spread load across multiple Prometheis, but they solve different problems.

**Functional sharding** splits the **scrape targets** across independent Prometheus instances so no single one has to hold all the series. You partition by team, region, service, or a hash of targets:

```yaml
# shard 0 scrapes ~half the targets, shard 1 the other half
relabel_configs:
  - source_labels: [__address__]
    modulus: 2
    target_label: __tmp_shard
    action: hashmod
  - source_labels: [__tmp_shard]
    regex: "0"        # this instance keeps only shard 0
    action: keep
```

Each shard is a full Prometheus owning a slice of the fleet. This directly relieves the **active-series/RAM** constraint.

**Federation** is hierarchical roll-up: a parent Prometheus scrapes *pre-aggregated* series from child Prometheis (see Q3). Sharding is about *dividing ingest*; federation is about *aggregating up*. They're often combined — shard at the bottom, federate summaries to a global view — but federation alone doesn't reduce per-shard cardinality and isn't a long-term-storage solution.

### Q3. Explain hierarchical federation and its limitations.

Federation lets one Prometheus scrape a curated set of series from another Prometheus via the `/federate` endpoint. The typical pattern: per-datacentre Prometheis hold full-resolution data, and a global Prometheus federates only **aggregated, recording-rule** series up for a cross-DC view:

```yaml
- job_name: federate
  metrics_path: /federate
  params:
    match[]:
      - '{__name__=~"job:.*"}'        # only pull pre-aggregated recording rules
  static_configs:
    - targets: ["dc1-prom:9090", "dc2-prom:9090"]
```

Limitations, and why federation is not a scaling silver bullet:

- **You lose granularity** — you should only federate aggregates (recording rules), not raw series, or the parent inherits the same cardinality problem.
- **It's not long-term storage** — the parent still has the same local-disk retention limits.
- **It doesn't provide HA** — if a child dies, its data is simply missing from the parent.
- **It's pull-on-pull**, so gaps and scrape timing add up.

Federation is good for a hierarchical global *dashboard* of aggregates; for full-fidelity long-term storage and HA, use `remote_write` into a purpose-built backend.

### Q4. What is the `remote_write` protocol and why is it the foundation of scale-out?

`remote_write` streams every sample Prometheus ingests to a remote endpoint, in near-real-time, over HTTP (Snappy-compressed protobuf). It turns Prometheus into a *scraper and buffer* while a separate, horizontally-scalable system owns durable long-term storage:

```yaml
remote_write:
  - url: https://mimir.internal/api/v1/push
    queue_config:
      max_samples_per_send: 2000
      capacity: 10000
      max_shards: 200
```

Why it's foundational: unlike federation, it ships **full-resolution** data (not just aggregates) to a backend built to scale — Mimir/Cortex, VictoriaMetrics, Grafana Cloud, Amazon Managed Prometheus. That backend handles clustering, replication, multi-tenancy, and long retention on object storage. Prometheus keeps a **write-ahead-log-backed queue** so a backend hiccup doesn't drop data, and `max_shards` lets it parallelise sends under load. `remote_read` is the counterpart that lets queries reach back into the remote store. This push model is the basis of essentially every managed and self-hosted long-term Prometheus platform.

### Q5. Explain Thanos and its main components.

Thanos adds global view, unlimited retention, and HA **to your existing Prometheus servers** rather than replacing them. Its components:

- **Sidecar** — runs next to each Prometheus, uploads completed TSDB blocks to **object storage** (S3/GCS), and serves the Prometheus's recent data to the Querier.
- **Object storage** — the durable, cheap, effectively-infinite backend (S3/GCS/Azure) where historical blocks live.
- **Querier** — a stateless component that fans out a PromQL query across all sidecars *and* the store gateway, merges results, and **deduplicates** HA replicas — giving one **global query view**.
- **Store Gateway** — makes historical blocks in object storage queryable.
- **Compactor** — compacts blocks in object storage and performs **downsampling** (5m and 1h resolutions) for fast long-range queries, and enforces retention.
- **Ruler** — evaluates recording/alerting rules against the global view.

The appeal: it's a **bolt-on**. You keep your Prometheis, add sidecars, point them at a bucket, and get global querying, dedup across HA replicas, downsampling, and years of retention without re-architecting ingestion.

### Q6. Explain Cortex/Grafana Mimir and how it differs from Thanos.

Cortex — and its more actively-developed successor **Grafana Mimir** — is a **purpose-built, horizontally scalable, multi-tenant** Prometheus backend. Instead of bolting onto existing Prometheis, it *ingests* their data via **`remote_write`** into a clustered set of microservices (distributor, ingester, querier, store-gateway, compactor) backed by object storage.

The core difference from Thanos is the **ingestion model and topology**:

| | Thanos | Mimir / Cortex |
|---|---|---|
| Integration | sidecar on existing Prometheis | `remote_write` into a cluster |
| Prometheus role | still stores locally, ships blocks | thin scraper/forwarder |
| Shape | bolt-on to what you have | dedicated, sharded cluster |
| Multi-tenancy | limited | first-class, per-tenant limits |
| Best when | you already run many Prometheis | you want one scalable central platform |

Mimir is built for very high cardinality and strict **multi-tenancy** with per-tenant series/query limits, and it shards both ingestion and queries across replicas. Choose Thanos when you want to keep and federate existing Prometheus servers; choose Mimir when you want a single, centrally-operated, multi-tenant platform that Prometheus just writes into.

### Q7. Where does VictoriaMetrics fit, and why choose it?

VictoriaMetrics is a **high-performance, resource-efficient** Prometheus-compatible TSDB that positions itself as the *operationally simple* alternative to Thanos/Mimir. It comes in two forms: a **single binary** (`victoria-metrics`) that many teams run for the entire stack, and a **clustered** version (vminsert/vmselect/vmstorage) for horizontal scale.

Reasons teams pick it:

- **Efficiency** — notably lower RAM and disk usage per series than vanilla Prometheus or the alternatives, which directly cuts the cost of high cardinality.
- **Operational simplicity** — the single-binary mode replaces a whole Thanos/Mimir topology; far fewer moving parts to run.
- **Drop-in ingest** — accepts Prometheus `remote_write` (and many other protocols: InfluxDB, Graphite, OpenTSDB), and speaks PromQL via **MetricsQL** (a compatible superset).
- **Long-term storage** built in, with its own downsampling and retention.

The trade-off versus Mimir is maturity of multi-tenancy and ecosystem, and versus Thanos it's a *replacement* rather than a bolt-on. It's a strong default when you want long-term storage and scale without operating a large distributed system.

### Q8. Explain downsampling and retention tiers.

At scale, keeping raw high-resolution samples forever is wasteful and makes long-range queries slow — a one-year graph would scan billions of raw points. **Downsampling** precomputes lower-resolution aggregates so long queries read far fewer samples, while **retention tiers** define how long each resolution is kept:

- **Raw** (e.g. 15s scrapes) — kept for recent windows (days–weeks) where you need full detail for debugging.
- **5-minute** downsampled — kept longer (weeks–months) for medium-range dashboards.
- **1-hour** downsampled — kept longest (months–years) for capacity trends and year-over-year views.

Systems like Thanos (via the Compactor) and VictoriaMetrics generate these tiers automatically, storing min/max/sum/count so aggregations remain correct. The key point interviewers want: **downsampling doesn't delete your raw data within its retention window** — the low-res tiers are *additional* copies. A query planner picks the coarsest resolution that satisfies the query's step, so a 1-year graph reads hourly points (fast) while a 1-hour graph reads raw (detailed).

### Q9. What is a global query view, and how does dedup across HA replicas work?

A **global query view** is a single query endpoint that transparently spans all your shards, both HA replicas, and all history (recent local data plus downsampled data in object storage) — so an engineer writes one PromQL query and gets fleet-wide results without knowing which Prometheus holds what. Thanos Querier and Mimir's query path both provide this.

For HA, you run **two identical Prometheis** scraping the *same* targets (replicas `a` and `b`), so losing one loses no data. But now every series exists twice, with a distinguishing external label (`replica="a"` / `replica="b"`). **Deduplication** at query time merges these: the querier is told which label identifies replicas, and for each logical series it picks one replica's samples, filling gaps from the other:

```bash
thanos query --query.replica-label=replica ...
```

The result is a single, clean, gap-free series even though two Prometheis produced it. Without dedup you'd see doubled counts and two overlapping lines on every graph. This is why HA gives *redundancy*, not extra capacity — both replicas do the same work, and you collapse them at read time.

### Q10. What is multi-tenancy and why does it matter at scale?

Multi-tenancy is isolating metrics, queries, and limits **per tenant** (team, environment, or customer) within one shared metrics platform. It's a first-class feature of Mimir/Cortex and available in VictoriaMetrics; each tenant's data is tagged and segregated at **ingest, storage, and query** time, and every request carries a tenant ID.

Why it matters:

- **Isolation** — one team's cardinality explosion or expensive query shouldn't degrade everyone else. Per-tenant **limits** (max active series, max samples, query concurrency) contain blast radius.
- **Cost attribution** — you can measure and charge each tenant for its series/query load, which is essential once metrics are a shared platform with a real bill.
- **Access control** — tenants only see their own data.

The distinction interviewers probe: real multi-tenancy is an *ingest/storage* property with enforced quotas, not just separate Grafana folders. Running a shared platform without per-tenant limits means the noisiest tenant sets everyone's reliability.

### Q11. Why is object storage central to long-term metrics storage?

Object storage (S3, GCS, Azure Blob) is the enabler that makes years of metrics affordable. Local disk on a Prometheus is finite, expensive per GB, not independently durable, and coupled to the compute node. Object storage is the opposite: **effectively infinite, cheap per GB, highly durable (multi-AZ replication), and decoupled from compute**.

Every scale-out system leans on it: Thanos sidecars upload TSDB blocks to a bucket; Mimir and VictoriaMetrics store their long-term blocks there; the compactor downsamples and compacts blocks *in* the bucket. Compute (queriers, store gateways) is then **stateless** and can scale independently of storage — you add query capacity without moving data.

The trade-off is **latency**: object storage is slower to read than local SSD, so these systems cache index and chunk data and rely on downsampling so long-range queries touch fewer, coarser blocks. But for the economics of retaining months-to-years of metrics, cheap durable object storage is the only viable substrate.

### Q12. What actually drives cost at metrics scale, and how do you control it?

The dominant cost driver is **cardinality** — the total number of unique active series — followed by **retention** (how long × what resolution). Sample *frequency* matters less than the sheer number of series, because each series carries fixed per-series overhead in memory and index.

```promql
# find your worst offenders: series count per metric name
topk(10, count by (__name__) ({__name__=~".+"}))
```

Controls, in order of leverage:

- **Kill unbounded labels at the source** (see Instrumentation) — this is the single biggest lever; a `user_id` label can 1000× your bill.
- **Drop/relabel at ingest** — use `metric_relabel_configs` or `remote_write` `write_relabel_configs` to drop noisy metrics/labels before they're stored.
- **Aggregate with recording rules** and store the rolled-up series instead of raw high-cardinality ones.
- **Downsample and tier retention** — don't keep raw forever.
- **Per-tenant limits** — cap max active series so one team can't blow the budget.

The senior framing: "why is our metrics bill exploding" is almost always a cardinality question, and it's cheaper to prevent at instrumentation time than to clean up in storage.

### Q13. How do you make alerting highly available?

Alerting has two independent pieces that each need HA. First, **rule evaluation**: run **redundant Prometheus (or Ruler) instances** evaluating the same alerting rules, so one dying doesn't stop evaluation. Both will fire the same alerts. Second, **notification**: run **Alertmanager as a cluster** (typically 3 instances) that **gossip** with each other and **deduplicate** — so even though multiple Prometheis send the same alert, and multiple Alertmanagers receive them, each notification is sent **once**:

```yaml
# each Prometheus points at all Alertmanagers; the AM cluster dedups
alerting:
  alertmanagers:
    - static_configs:
        - targets: ["am-0:9093", "am-1:9093", "am-2:9093"]
```

Two more essentials: (1) a **dead-man's-switch / watchdog** — an always-firing alert routed to an external service that pages you if it ever *stops* arriving, which is the only way to detect that the whole monitoring stack (or Prometheus itself) is down; and (2) ensure Alertmanager's clustering handles **silences and inhibitions** consistently across the cluster. The goal: no single node's failure either drops a page or double-pages the on-call.

### Q14. How do you keep query performance acceptable at scale?

Long-range and high-cardinality queries are the enemy of a responsive dashboard. The main levers:

- **Recording rules** — precompute expensive/frequently-run expressions (the error-rate ratio, per-service percentile inputs) so dashboards and alerts read a single cheap series instead of re-aggregating thousands. This is the highest-leverage fix.
- **Downsampling** — let long-range queries read coarse (5m/1h) data instead of scanning raw samples (Thanos/VM do this automatically).
- **Query sharding / parallelism** — Mimir and Thanos split a single query across multiple queriers by time or series shard and merge results, so a heavy query uses many cores.
- **Query-front-end caching** — cache results of repeated range queries (dashboards refresh the same query constantly) and split them by interval.
- **Limit cardinality up front** — the fastest query is one over few series; controlling cardinality (Q12) is also a performance strategy.

The pattern: precompute what's hot (recording rules), read coarse for long ranges (downsampling), parallelise what's left (sharding), and cache repeats.

### Q15. When should you just buy a managed metrics service instead of building this?

Operating a global, HA, long-term metrics platform (Thanos/Mimir/VictoriaMetrics + object storage + Alertmanager clustering + capacity planning) is a serious, ongoing engineering commitment. Buy instead of build when:

- **Metrics aren't your differentiator** and the team is small — engineering time is better spent on the product than on running a distributed TSDB.
- **You'd need on-call for the monitoring stack itself** — someone has to keep the thing that watches everything alive; a managed service moves that burden to the vendor.
- **Your scale is spiky or uncertain** — managed services absorb bursts without you pre-provisioning.

Options span **Prometheus-compatible** (Grafana Cloud, Amazon Managed Service for Prometheus/AMP — both are hosted Mimir/Cortex-style backends you `remote_write` to, keeping your PromQL and dashboards) through to **full platforms** (Datadog, New Relic) that replace the stack entirely.

The trade-offs to name: managed services cost more per unit at high volume and can bill aggressively on **cardinality/custom metrics** (so the discipline from earlier topics still pays off), and full platforms create lock-in away from PromQL. The mature answer is a build-vs-buy judgement: buy early to move fast, and only invest in self-hosting once your scale makes the economics — and the need for control — clearly favour it.
## Logging Fundamentals & Structured Logging

### Summary

**What this topic covers**

Logs are the oldest of the three pillars and the one engineers reach for by reflex — which is exactly why they get misused. This topic frames what logs are genuinely good at (high-cardinality, per-event forensic detail: the "why" behind a metric spike, the exact input that tripped a bug, the audit trail of who did what) and what they are bad at (they are expensive at volume, awkward to aggregate, and alerting on log patterns is usually a smell that a metric should exist instead). The 15 questions cover structured logging (JSON / key-value vs unstructured text and why structure is the thing that turns a log line into queryable data), log levels used with intent, correlation and trace IDs that stitch a log line back to its request and its trace, the cost problem (log volume is the silent budget killer), the "wide events" / canonical-log-line philosophy, PII and secret hygiene, timestamps in UTC/ISO8601, and signal-to-noise. The throughline: emit logs deliberately, with structure, and never log what should have been a metric.

**Mental model**

Think of a log as an immutable, timestamped record of a discrete event, emitted at the moment it happened, carrying arbitrary context. The single most important upgrade you can make is to stop thinking of logs as *human-readable sentences* and start thinking of them as *machine-queryable events*. `log.info("user alice failed login from 10.0.0.1")` is a string you can only grep; `log.info("login_failed", user="alice", src_ip="10.0.0.1", reason="bad_password")` is a structured event you can filter, count, and group by field. Once logs are structured, the "wide event" philosophy follows naturally: instead of scattering ten thin log lines through a request handler, emit **one wide canonical log line per request** carrying every dimension you might later want to slice by (route, status, latency, user tier, cache hit, feature flags). That one wide event is cheap to store, trivial to query, and answers questions you didn't know you'd ask. Logs are where *unbounded cardinality is fine* — the opposite of metrics — so lean into detail here, and let metrics handle the cheap aggregate view.

**Key terms**

- **Structured logging** — emitting logs as key-value / JSON records rather than freeform text, so fields are queryable.
- **Log level** — severity classification (DEBUG / INFO / WARN / ERROR / FATAL) used to filter volume and route attention.
- **Dynamic log level** — changing verbosity at runtime (per-package or per-request) without a redeploy.
- **Correlation ID / request ID** — a unique ID generated per request and attached to every log line for that request.
- **trace_id** — the distributed-trace identifier; putting it in logs links a log line to its span and full trace.
- **Canonical / wide log line** — one rich event emitted per unit of work carrying all its context.
- **Cardinality (in logs)** — number of distinct field-value combinations; unbounded cardinality is acceptable in logs (unlike metrics).
- **Structured redaction** — stripping or masking sensitive fields (tokens, PII) before the log leaves the process.
- **Sampling** — keeping a fraction of high-volume logs (e.g. 1% of successful requests) to control cost.
- **Signal-to-noise** — the ratio of actionable log lines to reflexive chatter; low ratios cause alert/log fatigue.
- **ISO 8601 / UTC** — the timestamp format and timezone every log should use to be sortable and correlatable.

**Why interviewers ask this**

Logging separates people who have *operated* a system at scale from people who have only written one. A junior answer is "add a log line, grep it in prod." A senior answer knows the second-order effects: that a `log.debug` inside a hot loop can 10x your ingest bill, that unstructured logs can't be aggregated so you can't answer "how many users hit this," that alerting on a log substring breaks silently the day someone rewords the message, and that a stray `log.info(user)` can dump PII into a third-party log store and create a compliance incident. Interviewers use logging to probe cost awareness (do you know logs are usually the biggest observability line item?), correctness of the metrics-vs-logs decision (do you reach for a counter when you should?), and operational maturity (correlation IDs, redaction, UTC). It's also a cheap proxy for whether you've been on call — anyone who has drowned in log noise at 3am has strong opinions here.

**Common confusions**

- "More logging is safer" — no; volume is cost and noise. Log deliberately, sample the boring paths, drop DEBUG in prod.
- "Logs and metrics are interchangeable" — logging a counter you then have to parse and sum is slow and expensive; emit a metric.
- "Structured logging is just JSON" — the format matters less than *consistent field names*; JSON with random keys is barely better than text.
- "ERROR means log a stack trace and move on" — a logged-and-swallowed error is a lie; ERROR should mean something needs attention.
- "High cardinality is bad" — that's the *metrics* rule. In logs, high-cardinality fields (user_id, request_id) are exactly the value.
- "Timezones don't matter, the server knows" — logs from different regions in local time are impossible to correlate; always UTC + ISO 8601.

**What follows from this topic**

Structured logs are the input to everything downstream: **Log Aggregation & Pipelines** is about collecting, parsing, storing, and querying the events you emit here, and Loki's label-cardinality trap only makes sense once you understand that log *content* can be high-cardinality but log *labels* can't. The correlation/trace_id discipline here is what makes **Distributed Tracing** able to jump from a slow span to the exact log lines it produced. And the "don't log what should be a metric" rule points straight back at the metrics and RED/USE topics — the three pillars are a division of labour, not three copies of the same data.

### Q1. What are logs good for, and what are they bad at?

**Good for:** high-cardinality, per-event detail. The exact request that failed, the input that tripped an assertion, the full stack trace, the audit trail of who changed what, the "why" behind a metric spike. When you already know *something* is wrong (a metric alerted) and need to understand the specific cause, logs are where the ground truth lives. They're also where unbounded cardinality is fine — you can log a `user_id` per line without blowing anything up.

**Bad at:** cheap aggregation and alerting. Answering "what's my error rate over the last hour" by scanning logs is slow and expensive compared to incrementing a counter. Log volume is typically the single biggest observability cost, and it grows with traffic. Alerting directly on log patterns is usually a smell — it's brittle (breaks when someone rewords a message), laggy, and expensive versus emitting a metric and alerting on that.

Rule of thumb: **metrics tell you *that* something is wrong; logs tell you *why*.** Reach for logs for forensics, not for the dashboard or the pager.

### Q2. What is structured logging and why does it matter?

Structured logging emits each log as a set of typed key-value pairs (usually JSON) instead of a human sentence:

```json
{"ts":"2026-07-02T14:03:12.482Z","level":"warn","event":"login_failed","user":"alice","src_ip":"10.0.0.1","reason":"bad_password","trace_id":"a1b2c3"}
```

versus the unstructured equivalent:

```text
2026-07-02 14:03:12 WARN user alice failed login from 10.0.0.1: bad password
```

Both are readable. Only the first is *queryable*. With structure you can ask your backend "count `login_failed` grouped by `src_ip` where `reason=bad_password`" and get an answer in one query. With the string you're writing fragile regex and you still can't aggregate reliably. Structure turns logs from a text file you grep into a dataset you analyse. The critical discipline is **consistent field names** across services — `user` here and `username` there defeats the point.

### Q3. How should you use log levels meaningfully?

Levels are a volume-and-attention filter, not decoration. A workable convention:

- **DEBUG** — developer detail, high volume, useful when actively debugging. **Off in prod by default.**
- **INFO** — normal significant events (service started, request completed, job ran). The default prod floor.
- **WARN** — something unexpected but handled (retry succeeded, fell back to cache, deprecated path hit). Worth noticing, not paging.
- **ERROR** — an operation failed and needs attention; something a human should eventually look at.
- **FATAL/PANIC** — the process is going down.

The failure modes: logging everything at INFO (so levels are useless as a filter), logging-and-swallowing at ERROR (an error that's handled isn't an error — use WARN or don't log it), and DEBUG left on in prod (a silent cost and noise disaster). If ERROR fires constantly and nobody acts, you've trained everyone to ignore ERROR.

### Q4. What is dynamic log level control and why is it useful?

Dynamic log levels let you change verbosity at runtime — for a specific package, service, or even a single request — without a redeploy. You ship with INFO as the floor, and when you're debugging a live incident you flip the auth module to DEBUG for ten minutes, capture the detail, then flip it back.

This solves the core tension: DEBUG logging is invaluable during an incident but ruinously expensive and noisy as a permanent default. Common implementations: an admin endpoint that adjusts the logger level, a config value watched at runtime, or **per-request debug** — a header or flag on one request turns on verbose logging for just that request's trace, so you get deep detail for the one user reproducing the bug without 10x-ing everyone's logs.

### Q5. What are correlation IDs and trace IDs in logs, and why do they matter?

A **correlation ID** (or request ID) is a unique identifier generated when a request enters the system and attached to every log line emitted while handling it. A **trace_id** is the distributed-tracing identifier for that request as it crosses service boundaries. Ideally they're the same value or the log carries both.

Without them, a single user request scattered across five services produces logs interleaved with thousands of other requests — impossible to reconstruct. With a trace_id on every line, you filter `trace_id="a1b2c3"` and see the entire request's journey in order, across every service.

```json
{"ts":"...","level":"error","event":"db_timeout","service":"orders","trace_id":"a1b2c3","span_id":"9f8e"}
```

Putting `trace_id` in logs is also the glue between pillars: from a slow span in your tracing UI you jump straight to the exact log lines that span produced. This is the single highest-leverage logging practice in a microservices system.

### Q6. Why is log volume such a big cost problem, and how do you control it?

Logs are usually the **largest observability line item** because cost scales with traffic *and* verbosity: double your requests or add one chatty DEBUG line in a hot path and ingest/storage cost jumps. Unlike metrics (fixed cost per series regardless of traffic), logs are effectively priced per event.

Controls, roughly in order of leverage:

- **Drop DEBUG in prod** — the single biggest win; it's often the bulk of volume.
- **Sample the boring paths** — keep 100% of errors, but 1–5% of successful requests. You rarely need every 200 OK.
- **Consolidate to wide events** — one canonical log line per request instead of ten thin ones cuts volume and improves queryability at once.
- **Don't log what should be a metric** — a per-request "processed item" line that you only ever count should be a counter.
- **Set retention and tier** — hot-search recent logs, archive older ones to cheap object storage.

The senior instinct: treat log volume as a budget you actively manage, not an accident of how many `log.info` calls got merged.

### Q7. When should you emit a log versus a metric versus a trace?

| Signal | Emit when you need… | Cost profile | Example |
|---|---|---|---|
| **Metric** | Cheap aggregate trends & alerting | Cheap, fixed per series, low-cardinality | request rate, error ratio, p99 latency |
| **Log** | Per-event forensic detail, the "why" | Expensive at volume, high-cardinality OK | the exact failing request + stack trace |
| **Trace** | Causal flow of one request across services | Expensive, usually sampled | which of 8 services made the request slow |

The classic mistake is **logging what should be a metric**: emitting a log line per request so you can later grep-and-count the error rate. That's slow, expensive, and fragile — increment a counter instead and alert on it. Conversely, don't try to cram forensic detail into metric labels (that's the cardinality explosion). Use the pillar that's priced for the job: metrics to *detect*, traces to *localise*, logs to *explain*.

### Q8. What is a canonical (wide) log line and why is the "wide events" philosophy better?

A canonical log line is **one rich event emitted per unit of work** (per request, per job) that carries every dimension you might later want to slice by, instead of scattering many thin lines through the code:

```json
{"event":"http_request","route":"/checkout","method":"POST","status":500,
 "duration_ms":842,"user_tier":"pro","cache_hit":false,"db_calls":3,
 "region":"eu-west","trace_id":"a1b2c3","error":"payment_timeout"}
```

Why it wins: (1) **queryability** — every field is a filter/group-by dimension, so you can answer "p99 latency for pro users on /checkout in eu-west" from logs; (2) **cost** — one wide event is far cheaper than ten thin ones; (3) **debuggability** — everything about the request is in one place, no stitching. This is the "wide events" / observability-2.0 philosophy: prefer a few wide, high-cardinality events over many narrow ones. It also naturally supports deriving metrics after the fact, because the dimensions you'd aggregate on are all present.

### Q9. What should never appear in logs, and how do you prevent it?

Never log: **credentials** (passwords, API keys, tokens, session cookies), **PII** beyond what you're compliant to store (full card numbers, government IDs, health data), and **secrets** of any kind. A logged token is a leaked token — logs are copied to third-party stores, indexed, cached, and read by people who'd never get production DB access.

Prevention, in layers:

- **Structured redaction** — mark sensitive fields and have the logging layer mask them (`card="****1234"`) before serialisation.
- **Allowlist, not blocklist** — log an explicit set of safe fields rather than dumping whole objects (`log(user)` will happily serialise the password hash).
- **Never log raw request/response bodies** on auth or payment endpoints.
- **Scan in CI / at ingest** — detectors for token-shaped strings as a backstop.

Treat it as a security control, not a style preference: leaked secrets in logs are a real and common breach vector.

### Q10. How should timestamps and timezones be handled in logs?

**Always UTC, always ISO 8601** (`2026-07-02T14:03:12.482Z`). Logs from services in different regions written in local time are effectively impossible to correlate — you can't sort a London log against a New York log without timezone gymnastics, and DST makes it worse. UTC gives you a single monotonic timeline.

Include millisecond (or finer) precision — request latencies are often sub-second, and ordering two events one millisecond apart matters when reconstructing a race. Emit the timestamp as a real field in structured logs, not just a text prefix, so the backend can index and range-query on it. Let the platform (or a synced clock) set the time; don't trust wall-clock skew across hosts for precise ordering — that's partly what trace spans with explicit start/end are for.

### Q11. Is high cardinality a problem in logs the way it is in metrics?

No — and this is a crucial distinction. In **metrics**, every unique label-value combination is a separate time series that costs memory and money forever, so putting `user_id` or `request_id` in a metric label is a cardinality bomb. In **logs**, each line is just an event; adding a high-cardinality field like `user_id`, `request_id`, or `trace_id` costs you one field on one event, not a permanent new series. That's exactly the data you want for forensics.

So the guidance inverts: **push high-cardinality detail into logs, keep it out of metrics.** When someone says "I want to break my error rate down by user," the answer isn't a per-user metric label — it's a structured log field you can filter/group on at query time. The one caveat (next topic): in **Loki** specifically, log *labels* behave like metric labels and must stay low-cardinality — but the log *content* can carry all the high-cardinality fields you like.

### Q12. How do you improve signal-to-noise in logs?

Noisy logs are as dangerous as no logs — if every request emits five INFO lines nobody reads them, and the one ERROR that matters is buried. Tactics:

- **Raise the floor** — INFO as the prod default, DEBUG off. Most "helpful" logs are DEBUG.
- **One wide event per request** instead of a running commentary of thin lines.
- **Delete "reached here" logs** — logs added during development to trace control flow should not survive the PR.
- **Don't log expected conditions at WARN/ERROR** — a 404 for a missing page is normal; logging it as ERROR trains people to ignore ERROR.
- **Rate-limit / dedupe repetitive lines** — a failing dependency shouldn't emit 10k identical errors a second.

The test: can an on-call engineer look at ERROR-level logs during an incident and see only things that plausibly matter? If ERROR is full of handled, expected noise, the level has lost its meaning.

### Q13. Walk me through debugging a production error using logs, starting from a metric alert.

1. **Alert fires** — error-rate metric for `checkout` breached its SLO. The metric tells me *that* something's wrong and roughly when, but not why.
2. **Scope it** — pivot to the log backend, filter `service="checkout" level="error"` over the alert window. Group by `error` field to see which failure dominates — say `payment_timeout` jumped from 0 to 60%.
3. **Correlate** — grab a `trace_id` from one of those error logs and filter on it to see every log line across every service for that one request. I find the `payments` service logged `db_timeout` just before checkout timed out.
4. **Localise** — filter `service="payments" level="error"` and notice they all share `db_host="replica-2"`. The failure is one bad replica, not the whole DB.
5. **Confirm & act** — cross-check the DB's own metrics/logs for replica-2, pull it from rotation, watch the error-rate metric recover.

The pattern: **metric to detect, trace_id to stitch the request together, structured log fields to localise the cause.** Structured logging and trace correlation are what make steps 2–4 minutes instead of hours.

### Q14. Why is alerting directly on logs usually a smell?

Because it's brittle, laggy, and expensive relative to the alternative. Brittle: an alert matching the substring `"connection refused"` silently stops firing the day someone rewords the message or a library changes its error text. Laggy: log-based alerts often depend on ingest and indexing latency, which can be seconds to minutes behind. Expensive: continuously evaluating queries over a high-volume log stream costs real money.

The better pattern is almost always: **emit a metric at the point you'd log, and alert on the metric.** Instead of alerting when `"payment failed"` appears N times, increment a `payments_failed_total` counter and alert on its `rate()`. Metrics are cheap to evaluate, cardinality-bounded, and don't break when log wording changes.

There are legitimate exceptions — security/audit alerting on specific log events, or a rare condition you can't easily instrument as a metric — but they're the exception. If your alerting strategy is mostly log queries, you probably have missing metrics.

### Q15. Whose responsibility is log rotation, shipping, and retention — the app's or the platform's?

Modern answer: **the app just writes structured logs to stdout/stderr and forgets about files.** In a containerised/Kubernetes world the app shouldn't manage log files, rotation, or shipping at all — that's the platform's job. The runtime captures stdout/stderr, a node-level agent (DaemonSet) reads it, and the pipeline handles buffering, shipping, and retention.

The classic anti-pattern is the app writing to its own log file inside a container and doing its own rotation: the file is invisible outside the container, competes for the pod's disk, and duplicates work the platform already does. (The historical exception is a traditional VM/bare-metal deployment where the app writes files and something like `logrotate` truncates them — but even there, shipping and retention belong to the platform.)

So the division of labour: **app** decides *what* to log and *how* (structure, levels, redaction); **platform** decides *where it goes, how long it's kept, and how it's rotated.* This clean split is exactly what the next topic, log aggregation pipelines, is built around.

## Log Aggregation & Pipelines

### Summary

**What this topic covers**

A single log stream on one host is easy; the problem is a thousand ephemeral containers each emitting structured events that you need to search in one place, in seconds, without going bankrupt. This topic covers the log pipeline end to end — **collect → parse/enrich → buffer → store → query** — and the real engineering decisions inside it. The 16 questions cover collectors and agents (Fluentd vs the lightweight Fluent Bit, Vector, Logstash, Promtail/Grafana Alloy), the two competing storage philosophies (full-text index à la Elasticsearch/OpenSearch versus label-index à la Grafana Loki — "Prometheus for logs"), the ELK/Elastic stack, Loki's label-cardinality trap, where and how to parse (grok, JSON, regex), buffering/backpressure/at-least-once delivery, multiline stack traces, shipping logs out of Kubernetes, retention and tiering to object storage, query languages (LogQL vs Lucene/KQL), and deriving metrics from logs. The recurring theme is cost: full-text indexing is powerful but expensive, and most pipeline design is a negotiation between search power and the ingest bill.

**Mental model**

Picture a conveyor belt with five stations. **Collect**: a lightweight agent on every node tails log sources (container stdout, files, journald). **Parse/enrich**: raw lines become structured records and get decorated with metadata (pod, namespace, node, labels). **Buffer**: a queue absorbs bursts and backpressure so a slow backend doesn't drop logs or crash the agent. **Store**: the events land in a backend whose *indexing strategy* is the single biggest cost/performance lever. **Query**: engineers search via LogQL, Lucene/KQL, or SQL. The one idea that explains most of the design space is the **indexing trade-off**: you can index the *full text* of every log (Elasticsearch — search anything instantly, pay a lot in storage and RAM) or index only a small set of *labels* and store the raw log lines compressed (Loki — cheap, but content search means scanning, not an index lookup). Everything else — where you parse, what you put in labels, how you tier storage — flows from which side of that trade-off you're on and how hard you're fighting the cost.

**Key terms**

- **Collector / agent** — process that tails logs at the source and ships them (Fluent Bit, Fluentd, Vector, Promtail, Alloy).
- **Full-text index** — indexing the content of every log so any term is instantly searchable (Elasticsearch/OpenSearch).
- **Label index** — indexing only a small set of labels; log bodies stored compressed and scanned at query time (Loki).
- **ELK / Elastic stack** — Elasticsearch + Logstash + Kibana (+ Beats); the classic full-text logging stack.
- **Grafana Loki** — label-indexed, "like Prometheus for logs," cheap, queried with LogQL.
- **Grok** — pattern language for parsing unstructured text into fields (heavy in Logstash).
- **Buffering / backpressure** — queuing logs so bursts and slow backends don't cause loss.
- **At-least-once delivery** — guaranteeing no log is lost, accepting possible duplicates.
- **DaemonSet collector** — one agent pod per Kubernetes node, reading all containers' logs from the node.
- **LogQL** — Loki's query language: label selectors plus content filters, with metric queries over logs.
- **Retention & tiering** — expiring old logs / moving them to cheap object storage.

**Why interviewers ask this**

This topic is where cost-engineering maturity shows. Anyone can stand up ELK from a tutorial; the senior signal is knowing *why* your Elasticsearch bill is five figures a month and what to do about it — that full-text indexing every field is the reason, that Loki trades search power for an order-of-magnitude cost drop, that putting a high-cardinality field in a Loki label recreates the exact cardinality explosion you were trying to escape. Interviewers also probe reliability (do you understand buffering, backpressure, and at-least-once delivery, or will your pipeline silently drop logs under load?), Kubernetes fluency (how do logs actually get out of a pod?), and the parse-placement decision (parse at the agent and pay CPU on every node, or parse centrally and create an ingest bottleneck?). It's a good discriminator between "I've used a logging tool" and "I've owned a logging platform's SLO and budget."

**Common confusions**

- "Loki indexes your logs like Elasticsearch" — it doesn't; it indexes *labels* only and scans content. That's the whole cost story.
- "Put everything useful in Loki labels" — high-cardinality labels blow up Loki exactly like metrics; use content filters instead.
- "The pipeline can't lose logs" — it can, at every stage; without buffering and backpressure, bursts and slow backends drop data.
- "Fluentd and Fluent Bit are the same" — Fluent Bit is the lightweight edge agent; Fluentd is the heavier aggregator. Different jobs.
- "Parse everything at ingest" — central parsing is a bottleneck and a single point of failure; often better to parse at the agent or emit JSON.
- "Full-text search is always better" — it's more powerful and far more expensive; for label-scoped grep-style search, Loki is cheaper and enough.

**What follows from this topic**

This topic is the operational home of the structured events from **Logging Fundamentals** — the "keep labels low-cardinality but log content high-cardinality" rule from there is *why* Loki works. The label-cardinality trap here is the same principle as metric cardinality in the Prometheus topics — one mental model, two systems. And "deriving metrics from logs" is the seam back to metrics: you *can* count log events into a metric, but native instrumentation is cheaper and more reliable. The trace_id you put in every log line is what lets the query stage jump straight into **Distributed Tracing**.

### Q1. Walk me through the stages of a log aggregation pipeline.

Five stages, conveyor-belt style:

1. **Collect** — a lightweight agent at the source tails logs: container stdout/stderr, files, systemd journald. In Kubernetes this is usually a DaemonSet (one agent per node).
2. **Parse / enrich** — turn raw lines into structured records (extract fields) and attach metadata: pod name, namespace, node, labels, environment. If the app already emits JSON, parsing is trivial.
3. **Buffer** — queue the records (in memory and/or on disk, or via Kafka) so traffic bursts and slow/unavailable backends don't cause loss. This is where backpressure lives.
4. **Store** — write to the backend. The backend's indexing strategy (full-text vs label) is the dominant cost/performance decision.
5. **Query** — engineers search via LogQL, Lucene/KQL, or SQL, and dashboards/alerts read from here.

The art is in the seams: where you parse (edge vs central), how much you buffer (loss vs memory), and what you index (cost vs search power).

### Q2. Compare the common log collectors: Fluentd, Fluent Bit, Vector, Logstash, Promtail/Alloy.

| Collector | Niche | Notes |
|---|---|---|
| **Fluent Bit** | Lightweight edge agent | Tiny footprint, C, ideal as a per-node DaemonSet. The default modern edge shipper. |
| **Fluentd** | Heavier aggregator | Ruby, big plugin ecosystem; often the central aggregation tier behind Fluent Bit. |
| **Vector** | High-performance router | Rust, fast, strong transform language (VRL); increasingly the one-tool choice. |
| **Logstash** | Elastic's processor | Powerful (grok, filters) but JVM-heavy and resource-hungry; the "L" in ELK. |
| **Promtail / Grafana Alloy** | Loki's shipper | Promtail ships to Loki with label discovery; Alloy is the newer unified OTel-capable agent superseding it. |

Common pattern: a light agent (**Fluent Bit / Promtail / Alloy**) on every node for collection, optionally feeding a heavier aggregator (**Fluentd / Vector / Logstash**) that does expensive parsing and fan-out before storage. Pick the light agent for the edge and reserve heavy processing for a central tier so you're not burning CPU on every node.

### Q3. Explain the two storage philosophies: full-text index vs label index.

**Full-text index (Elasticsearch / OpenSearch):** index the *content* of every log — every term becomes searchable via an inverted index. You can query for any word instantly, do fuzzy/relevance search, and slice arbitrarily. The cost: the index is often as large as or larger than the raw data, it's RAM-hungry, and ingest is expensive. Powerful, pricey.

**Label index (Grafana Loki):** index only a small set of **labels** (like Prometheus), and store the raw log *bodies* compressed in object storage. Queries first narrow by labels (cheap index lookup), then **scan** the matching compressed chunks for your content filter. No inverted index over content means dramatically cheaper storage and ingest, at the price of content search being a scan (slower for needle-in-haystack over huge label sets) rather than an instant index hit.

The decision: if you genuinely need instant arbitrary full-text search and relevance ranking, pay for Elasticsearch. If your access pattern is "narrow by service/namespace/level, then grep the content" — which is most operational debugging — Loki gives you an order-of-magnitude cost reduction. Many orgs run Loki and are happier for it.

### Q4. What is the ELK / Elastic stack and what does each component do?

**ELK** is the classic full-text logging stack:

- **Elasticsearch** — the distributed full-text search and storage engine; holds and indexes the logs.
- **Logstash** — the processing pipeline: ingest, parse (grok), transform, enrich, route. Powerful but JVM-heavy.
- **Kibana** — the UI: search (Lucene/KQL), dashboards, visualisations.
- **Beats** (the "B" that makes it the Elastic Stack) — lightweight shippers (Filebeat for logs, Metricbeat, etc.) that replace heavy Logstash agents at the edge.

Typical topology: **Filebeat** (edge) → **Logstash** (central parse/enrich) → **Elasticsearch** (store/index) → **Kibana** (query). It's mature, feature-rich, and excellent when you truly need full-text search and analytics — but it's operationally heavy (managing Elasticsearch clusters, shards, RAM) and expensive at volume, which is exactly the gap Loki emerged to fill. OpenSearch is the open-source fork of Elasticsearch/Kibana after the licence change.

### Q5. What is Loki's label-cardinality trap and how do you avoid it?

Loki indexes **labels**, and each unique combination of label values creates a separate **stream**. That's exactly the Prometheus cardinality model — so the exact same footgun applies: **never put high-cardinality values in labels.** Putting `user_id`, `request_id`, `trace_id`, or `path` (with IDs) into a Loki label multiplies streams into the millions, wrecking ingest performance and cost — the same explosion you'd get from a bad Prometheus label.

The fix is Loki's core design point: keep **labels low-cardinality and bounded** (namespace, app, level, env), and push everything high-cardinality into the **log content**, then filter it at query time with LogQL:

```logql
{app="orders", level="error"}        # cheap: label index lookup
  |= "payment_timeout"                # content filter: scans the narrowed stream
  | json | user_id="alice"            # parse + filter high-cardinality field at query time
```

So `user_id` lives in the line, not the label. The mental shortcut: **labels are for narrowing which streams to read; filters are for searching inside them.** This is the same low-cardinality-labels rule as metrics, applied to logs.

### Q6. Where should you parse logs — at the agent or centrally at ingest?

It's a genuine trade-off:

- **Parse at the agent (edge):** distributes CPU across every node, so no central bottleneck, and the record is already structured before it hits the network. Downside: parsing logic is now deployed everywhere, and heavy grok on every node costs node CPU.
- **Parse centrally (aggregator/ingest):** one place to manage parsing rules, easy to update. Downside: it's a bottleneck and a single point of failure — a bad regex or a traffic spike can back up the whole pipeline; grok is CPU-expensive and doesn't scale as gracefully centrally.

The best answer usually **sidesteps parsing entirely: have the app emit structured JSON** so there's nothing to grok — the agent just forwards fields. When you can't change the app (legacy, third-party), parse as early and as cheaply as possible, prefer JSON/regex over heavy grok, and keep the central tier for enrichment and routing rather than expensive text extraction.

### Q7. How do grok, JSON, and regex parsing differ, and when do you use each?

- **JSON** — the app already emits structured JSON; the parser just decodes it into fields. Cheapest and most reliable. **Always prefer this** — it means you never guess at structure.
- **Regex** — extract specific named fields from semi-structured text with your own pattern. Flexible, moderately fast, but brittle if the format drifts.
- **Grok** — a library of named regex patterns (`%{IP:client} %{WORD:method} %{NUMBER:status}`) built for parsing common unstructured formats (Apache/nginx logs, syslog). Very expressive for messy legacy text, but CPU-expensive and the classic cause of Logstash pipeline stalls.

Rule: if you control the app, emit JSON and skip parsing. If you're stuck with unstructured legacy output, use grok/regex — but treat it as debt, keep patterns anchored and specific (unanchored `.*` grok is a performance killer), and parse as close to the source as is affordable.

### Q8. How do buffering, backpressure, and at-least-once delivery work in a log pipeline?

**Buffering** holds records between stages so a burst or a temporarily slow/unavailable backend doesn't cause loss. Buffers can be in-memory (fast, lost on crash), on-disk (survives restarts, slower), or an external queue like **Kafka** (durable, decouples producers from the store entirely).

**Backpressure** is what happens when the buffer fills: the pipeline must decide to *slow down / block* the source, *spill to disk*, or *drop* logs. A pipeline with no backpressure strategy just OOMs the agent or silently drops data under load — the failure mode that bites in the exact incident when you most need the logs.

**At-least-once delivery** means the pipeline retries until the store acknowledges, guaranteeing no log is lost but accepting possible **duplicates** (so consumers/queries should tolerate dupes). The alternative, at-most-once, is cheaper but drops on failure. For logs, at-least-once is the usual choice: a duplicate line is annoying; a missing line during an outage is what makes the incident unsolvable. Kafka in front of the store is the common pattern for durable buffering at scale.

### Q9. How do you handle multiline logs like stack traces?

A Java or Python stack trace is one logical event spread over many physical lines, and a naive tailer treats each line as a separate log — so you get one "error" record and twenty orphaned "at com.acme..." records, which is useless.

The fix is **multiline parsing** at the collector: configure a rule that recognises the *start* of a new event (e.g. a line beginning with a timestamp or log level) and appends any following lines that *don't* match that pattern to the current event until the next start line appears.

```ini
# Fluent Bit multiline: a new event starts with an ISO timestamp;
# continuation lines (indented, "at ...", "Caused by:") fold into it.
[INPUT]
    multiline.parser  java, python
```

The most robust answer, again, is **structured logging**: have the app serialise the exception (message + stack) into a single JSON field so it's inherently one event and the collector never has to guess boundaries. Multiline stitching is the fallback for text logs you can't restructure.

### Q10. How do logs get shipped out of Kubernetes?

The standard pattern is a **DaemonSet log collector**: one agent pod (Fluent Bit, Promtail, Alloy) per node. Containers write to **stdout/stderr**, the container runtime writes those streams to log files on the node (under `/var/log/containers/`), and the DaemonSet agent — mounting the node's log directory — tails those files, enriches each line with Kubernetes metadata (pod, namespace, labels, node) via the API, and ships to the backend.

Why this shape: it's efficient (one agent per node, not a sidecar per pod), it requires nothing from the app beyond "log to stdout," and it captures everything the runtime sees. The main alternative is a **sidecar** container per pod — used when an app insists on writing to a file inside the container or needs isolated processing — but it's heavier (a collector per pod) and generally reserved for special cases.

The app's contract is simply: **write structured logs to stdout/stderr and let the platform do the rest** — exactly the app-vs-platform split from the logging-fundamentals topic.

### Q11. How do you manage log retention and control storage cost over time?

Logs are the biggest cost line, so retention is a first-class design decision, not an afterthought. Levers:

- **Tiered storage** — keep recent logs (hours–days) on fast, searchable hot storage; move older logs to cheap **object storage** (S3/GCS). Loki does this natively (chunks live in object storage); Elasticsearch uses hot/warm/cold/frozen tiers with ILM (index lifecycle management).
- **Retention policies** — delete logs past their useful/compliance window automatically. Different classes get different windows: debug logs days, audit/security logs years.
- **Sampling & drop rules at ingest** — drop DEBUG in prod, sample successful requests, drop known-noise lines before they ever hit storage.
- **Downsampling / summarising** — for long-term, keep derived metrics or aggregates rather than every raw line.

The instinct: match retention to the *value and legal requirement* of each log class, and get cold data onto object storage fast. Indexing and hot-storing everything forever is how observability bills reach absurd numbers.

### Q12. Compare the query languages: LogQL vs Lucene/KQL.

**LogQL (Loki)** is deliberately Prometheus-shaped: start with a label selector, then pipe content filters and parsers, and optionally wrap in a metric aggregation.

```logql
sum by (status) (
  rate({app="api", level="error"} | json | __error__="" [5m])
)
```

That first selects error logs from the `api` app, parses JSON, and computes a per-status error rate over 5m — logs *becoming* metrics.

**Lucene / KQL (Elasticsearch/Kibana)** query a full-text index directly — free-text terms, boolean operators, field queries, ranges, wildcards, relevance ranking:

```text
service:api AND level:error AND status:500 AND message:"payment timeout"
```

The difference reflects the storage model: LogQL *must* start by narrowing to a label stream then scan (because content isn't indexed), while Lucene/KQL can hit any indexed term instantly and rank by relevance. LogQL feels natural if you already think in PromQL and want log-derived metrics; Lucene/KQL feels natural for arbitrary full-text investigation. Neither is "better" — they match their backend's cost model.

### Q13. Centralised vs decentralised logging — what are the trade-offs?

**Centralised** (one platform all logs flow into) is the default and near-universal choice: single place to search across services, correlate a request's journey, set org-wide retention and access control, and build shared dashboards/alerts. The cost is that it's a critical, high-throughput system you must scale and pay for, and it's a blast-radius concern (if the logging platform is down, everyone's blind).

**Decentralised** (logs stay local to each service/team, or per-team stacks) reduces central blast radius and lets teams tune their own retention, but it makes cross-service debugging painful — you can't follow a `trace_id` across five services if their logs live in five disconnected systems — and it fragments governance.

In practice: **centralise the store and query layer** (so correlation works) while keeping the *collection* decentralised and resilient (per-node agents with local buffering, so a central outage buffers rather than drops). Pure decentralisation defeats the point of aggregation in a microservices world where the whole value is stitching a request across services.

### Q14. How do you handle security and audit logs differently from application logs?

Audit/security logs (auth events, privilege changes, data access, admin actions) have different requirements from app debug logs and should be treated as a distinct class:

- **Integrity & immutability** — they may be evidence, so they need tamper-resistant, append-only (often WORM) storage; you don't want them in the same freely-editable index as app logs.
- **Longer, compliance-driven retention** — often years (PCI, SOC2, HIPAA, GDPR), versus days for debug logs.
- **Stricter access control** — who can read them is itself sensitive; access should be limited and its own reads audited.
- **Separate pipeline / destination** — routing them to a dedicated, hardened store means a noisy app-log outage or a broad retention purge can't take out your audit trail, and vice versa.
- **Guaranteed (at-least-once) delivery** — dropping an audit event is a compliance failure, not just a gap.

The senior move is recognising early that "logs" isn't one thing: security/audit is a governed data class with its own SLO, retention, and access model, and it should be split out at the pipeline's routing stage.

### Q15. Can you derive metrics from logs, and should you?

**Can you:** yes. Both Loki (`rate(...)` over a LogQL selector) and Elasticsearch (aggregations) let you count/aggregate log events into metric-like time series, and many pipelines emit a metric per matched log pattern. It's genuinely useful when you can't change the app — you can build an error-rate graph from legacy logs without instrumenting the code.

**Should you (as the primary source):** usually no. Native metrics are cheaper (a counter is a fixed-cost series; deriving the same number means ingesting, storing, and repeatedly scanning high-volume logs), lower-latency (no ingest/index lag), and more reliable (not broken by a reworded log message). Log-derived metrics also inherit the log pipeline's sampling and loss, so the numbers can be subtly wrong.

Use log-derived metrics as a **bridge** — for systems you can't instrument, or to bootstrap a dashboard fast — but the moment a number matters for alerting or SLOs, emit it as a real metric at the source. It's the "don't log what should be a metric" rule seen from the pipeline side.

### Q16. Design a cost-effective logging pipeline for a 200-service Kubernetes platform.

I'd anchor every decision on cost and correlation.

1. **App contract:** every service emits **structured JSON to stdout**, with `trace_id`, `service`, `level`, and one wide canonical line per request. No app-side files or rotation.
2. **Collection:** a **Fluent Bit / Alloy DaemonSet** per node tails container stdout, enriches with Kubernetes metadata, does multiline stitching for any legacy text logs. Local disk buffer for resilience.
3. **Reduce at the edge:** drop DEBUG in prod, sample successful requests (keep 100% of errors), drop known-noise lines — cut volume before it costs anything downstream.
4. **Buffer:** Kafka (or disk buffers) in front of the store for durable, at-least-once delivery and backpressure absorption during store slowdowns.
5. **Store:** **Loki** as the default backend — label-indexed, cheap, chunks in object storage — with low-cardinality labels (`service`, `namespace`, `level`, `env`) and all high-cardinality fields (`trace_id`, `user_id`) in the content, filtered via LogQL. Reserve a smaller **Elasticsearch/OpenSearch** cluster only for the subset (e.g. security/audit or a team that genuinely needs full-text) that justifies its cost.
6. **Retention & tiering:** short hot retention, auto-tier to object storage, class-based policies (audit years, debug days).
7. **Correlation:** `trace_id` in every line so we jump logs ↔ traces ↔ the metric that alerted.

The through-line: **push cardinality into content not labels, cut volume early, default to cheap label-indexed storage, and pay for full-text only where it's earned.**

## Distributed Tracing

### Summary

**What this topic covers**

Metrics tell you *that* checkout is slow; logs tell you *what* one service logged; neither tells you *which of the eight services in the request path caused it* or *in what causal order*. Distributed tracing is the pillar that reconstructs the end-to-end journey of a single request as it fans out across services, so you can see the whole call tree and find the slow or failing hop. The 16 questions cover the data model (a trace as a tree/DAG of spans; a span as one timed operation with a parent, attributes, events, and status), **trace context propagation** (the W3C `traceparent` header carrying `trace_id`/`span_id` across service boundaries — the thing that silently breaks a trace when a service forgets to forward it), instrumentation (auto via OpenTelemetry/agents vs manual spans), sampling (head-based vs tail-based, and *why* you sample at all), the backends (Jaeger, Grafana Tempo, Zipkin, cloud APM), semantic conventions, the service/dependency map, critical-path analysis, linking traces to logs and metrics (exemplars, `trace_id` in logs), propagation across async/queue boundaries, common pitfalls, and RED metrics derived from spans.

**Mental model**

Think of a trace as a **timeline flame graph of one request**. The request enters at the edge, creating a **root span**; every downstream call — an RPC to another service, a DB query, a cache lookup — creates a **child span** nested under its caller, with its own start and end time. Lay all spans on a shared time axis and you get a waterfall: you can literally *see* which span is the widest bar (the bottleneck) and which is red (the failure). The magic that makes this possible across process boundaries is **context propagation**: when service A calls service B, it injects the `trace_id` and its current `span_id` into the request headers (W3C `traceparent`); B reads them, makes its spans children of A's, and forwards them onward. Break that header-passing anywhere and the trace splits into disconnected fragments. So a trace is: a shared `trace_id` binding many spans + parent/child links reconstructing the call tree + timing on each span revealing where the latency went.

**Key terms**

- **Trace** — the full record of one request's journey; a tree/DAG of spans sharing a `trace_id`.
- **Span** — one timed operation (an RPC, a query) with start/end, a `span_id`, a parent, attributes, events, and a status.
- **trace_id / span_id** — the IDs binding spans into a trace and identifying each span; propagated across boundaries.
- **Context propagation** — passing trace context (via **W3C `traceparent`** header) so downstream spans join the same trace.
- **Instrumentation** — code that creates spans: **auto** (OTel/agents wrap frameworks) or **manual** (you start/end spans).
- **Head-based sampling** — decide keep/drop at trace start; simple, cheap, may miss rare errors.
- **Tail-based sampling** — decide after the whole trace is seen; keeps all errors/slow traces; needs a buffering collector.
- **OpenTelemetry (OTel)** — vendor-neutral API/SDK/Collector and the OTLP protocol for all three signals.
- **Semantic conventions** — standard attribute names (`http.method`, `db.system`) so backends interpret spans consistently.
- **Service map** — dependency graph auto-derived from parent/child span relationships across services.
- **Exemplar** — a sampled `trace_id` attached to a metric data point, jumping from a spike to an example trace.
- **Critical path** — the chain of spans that actually determines total latency (vs parallel work that overlaps).

**Why interviewers ask this**

Tracing is the pillar that most cleanly separates people who've *debugged distributed systems* from people who've only debugged monoliths. The core senior insight — that context propagation is a chain only as strong as its weakest service, and one un-instrumented hop shatters the trace — is something you only internalise after a broken trace has cost you an outage's worth of debugging. Interviewers probe the sampling trade-off hard because it's where cost meets correctness: head-based is cheap but can throw away the rare error trace you needed; tail-based keeps the errors but requires buffering infrastructure. They also test whether you understand tracing's *place*: it's for localising *where* in a request the problem is, complementing metrics (detect) and logs (explain), not replacing them. And OpenTelemetry fluency signals you're current — it's the industry standard that unified a previously fragmented space.

**Common confusions**

- "Tracing replaces logs and metrics" — no; it localises *where* the problem is. You still need metrics to detect and logs to explain.
- "Turn on tracing and it just works" — only if every service propagates context; one service dropping `traceparent` breaks the chain.
- "Sample more to be safe" — over-sampling explodes cost; the point of sampling is that you *can't* keep everything.
- "Head-based sampling is fine" — it's cheap but decides before seeing the outcome, so it drops rare errors you most wanted.
- "A span per function call" — too many spans is noise and cost; instrument service boundaries and significant operations, not every method.
- "The service map is configured" — it's *derived* from span parent/child relationships; it's an output of tracing, not an input.

**What follows from this topic**

Tracing closes the three-pillars loop: the **`trace_id` you put in every structured log** (logging fundamentals) is what lets you jump from a slow span straight to its logs, and **exemplars** link a metric spike to an example trace — so this topic is where metrics, logs, and traces finally stitch together into one workflow. **RED metrics derived from spans** connect back to the RED/golden-signals topics: rate, errors, and duration all fall out of span data. And **OpenTelemetry** here is the same OTel that ships metrics and logs — one SDK and Collector for all three signals, which is why modern observability is increasingly built around it.

### Q1. What problem does distributed tracing solve that metrics and logs can't?

Metrics and logs both hit a wall in a microservices architecture. **Metrics** are aggregates — "checkout p99 is 900ms" — but they can't tell you *which* of the eight services in the request path contributed that latency, or in what order. **Logs** are per-service and per-event — you can read what `payments` logged — but stitching a single request's logs across eight services by hand (even with a correlation ID) doesn't give you *timing* or the *causal tree*.

**Distributed tracing** reconstructs the full journey of *one request* as it fans out across services, as a timed call tree. It answers the questions the other two can't: *which service/operation is the bottleneck, in what order did calls happen, which hop failed, and what was happening in parallel vs sequentially.* On a trace waterfall you literally see the widest bar (slow span) and the red bar (failed span).

The clean division: **metrics detect** a problem, **traces localise** where in the request it lives, **logs explain** the specifics. Tracing is the "where" pillar.

### Q2. Describe the tracing data model: traces and spans.

A **trace** is the record of one request's end-to-end journey — a **tree (really a DAG) of spans** that all share a single `trace_id`.

A **span** is one timed unit of work — an incoming request handled, an RPC made, a DB query, a cache call. Each span carries:

- **span_id** — its own unique ID, and a **parent span_id** — linking it to the operation that caused it (null parent = root span).
- **start & end timestamps** — hence a duration; this is what builds the waterfall.
- **name** — the operation (`GET /checkout`, `SELECT orders`).
- **attributes / tags** — key-value context (`http.status_code=500`, `db.system=postgres`, `user.tier=pro`).
- **events** — timestamped points within the span (e.g. "cache miss," an exception).
- **status** — OK / error.

The **root span** is the entry point (edge request); its children are the calls it made, their children the calls *those* made, and so on. Reassemble spans by `trace_id` and parent links and you get the call tree; lay them on a time axis and you get the latency flame graph.

### Q3. How does trace context propagation work, and what breaks it?

Context propagation is how spans in *different processes* get linked into one trace. When service A calls service B, A **injects** its trace context — `trace_id` and A's current `span_id` (as the parent) — into the outgoing request headers. B **extracts** it, creates its spans as children of A's span in the same `trace_id`, and injects *its* context when it calls C. The chain continues to the leaves.

The standard carrier is the **W3C `traceparent` header**:

```text
traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01
             │  └─ trace_id (16 bytes) ────────┘ └─ parent span_id ┘ └ flags
             └ version
```

(plus `tracestate` for vendor data). B24-headers (Zipkin) are the older style.

**What breaks it:** any service that doesn't forward the header. A proxy that strips it, a service using an un-instrumented HTTP client, a message queue that doesn't carry it — any one of these severs the chain, and the trace splits into disconnected fragments (B and everything downstream start a *new* root, orphaned from A). This is *the* most common tracing failure: a broken trace almost always means a propagation gap at exactly the hop that dropped the header.

### Q4. Auto-instrumentation vs manual instrumentation — when do you use each?

**Auto-instrumentation** uses agents or OpenTelemetry libraries that hook into common frameworks (HTTP servers/clients, gRPC, DB drivers, message queues) and create spans automatically, without you editing business code. It's how you get 80% of the value with near-zero effort: install the OTel agent/SDK, and every inbound request and outbound call is traced with context propagated for you. Start here.

**Manual instrumentation** is code you write to create spans (or add attributes/events) around things auto-instrumentation can't see: a meaningful in-process operation, a specific business step, a batch stage, custom attributes like `user.tier` or `order.value` that make traces searchable and meaningful.

```python
with tracer.start_as_current_span("validate_order") as span:
    span.set_attribute("order.items", len(items))
    validate(items)   # a business step auto-instrumentation wouldn't span
```

The practical pattern: **auto-instrument the boundaries** (get the cross-service call tree for free), then **manually add** the handful of business-level spans and attributes that make traces diagnostic rather than just structural. Don't manually span every function — that's noise.

### Q5. Explain head-based vs tail-based sampling and their trade-offs.

Both decide *which* traces to keep (you can't afford all of them), but at different times:

| | Head-based | Tail-based |
|---|---|---|
| **When decided** | At trace *start* (root) | *After* the full trace is collected |
| **Info available** | None about outcome | Whole trace: latency, errors, status |
| **Keeps rare errors?** | No — may drop them | Yes — keep all errors/slow traces |
| **Infra needed** | Minimal (propagate a flag) | A collector **buffering** all spans per trace |
| **Cost/complexity** | Cheap, simple | Expensive (must hold spans in memory to decide) |

**Head-based**: flip a coin at the root (say keep 1%), propagate that "sampled" decision in `traceparent` flags so the whole trace is consistently kept or dropped. Simple and cheap, but it decides *before knowing the outcome* — so a rare error or a 5-second outlier has the same 1% chance of survival, and you routinely lose the exact traces you'd have wanted.

**Tail-based**: buffer all spans of a trace in a collector until the trace completes, then apply rules — **keep 100% of error traces and slow traces, sample a small % of normal ones.** You get the interesting traces reliably. The price: the collector must hold every in-flight trace's spans in memory and reassemble them, which is real infrastructure and cost. Most mature setups want tail-based precisely so errors are never dropped.

### Q6. Why do you sample traces at all?

Because tracing every request at full fidelity is **prohibitively expensive** and mostly redundant. A high-traffic service does millions of requests an hour; each request generates many spans, each span carries attributes — storing and indexing all of that would dwarf your metrics and often your logs bill, and the ingest/network overhead can affect the app itself.

And you don't *need* all of it: the thousandth identical successful `GET /home` trace tells you nothing new. The information value is concentrated in the **errors, the slow outliers, and a representative baseline** of normal traffic. Sampling keeps the signal (all errors/slow traces via tail-based, plus a small % of normal for baseline) and drops the redundant bulk.

So sampling isn't a compromise you'd skip if you could — it's the deliberate acknowledgement that trace data has steep diminishing returns per additional identical trace, and the budget is far better spent guaranteeing you keep every *interesting* trace than storing the millionth boring one.

### Q7. Compare the common tracing backends: Jaeger, Tempo, Zipkin, cloud APM.

| Backend | Character |
|---|---|
| **Jaeger** | CNCF, the de-facto open-source standard; rich UI, flexible storage (Cassandra/Elasticsearch/OpenSearch). Powerful but the indexed storage costs. |
| **Grafana Tempo** | Trace-id-lookup-first design: stores traces cheaply in **object storage** with *no* heavy index, so it's very cheap at scale. You find traces via `trace_id` (from logs/exemplars) rather than deep attribute search. |
| **Zipkin** | The original (Twitter); simpler, mature, smaller feature set; B3 propagation headers. |
| **Cloud APM** | Datadog, Honeycomb, AWS X-Ray, GCP Cloud Trace, Grafana Cloud — managed, integrate the three pillars, no ops burden, but priced per-span/host and can get very expensive. |

The parallel to logs is exact: **Tempo is to Jaeger what Loki is to Elasticsearch** — drop the expensive full index, store cheaply in object storage, and rely on narrowing by `trace_id` (which you get from a log line or a metric exemplar) instead of arbitrary search. If your workflow is "metric alerts → find the exemplar trace_id → look it up," Tempo is dramatically cheaper. If you need to *search* traces by arbitrary attributes, an indexed backend like Jaeger earns its cost. All of them speak **OTLP**, so OpenTelemetry decouples your instrumentation from the backend choice.

### Q8. What are span attributes and semantic conventions, and why do they matter?

**Span attributes** are key-value pairs attached to a span that describe it — `http.method=POST`, `http.status_code=500`, `db.system=postgresql`, `db.statement=SELECT...`, plus business context like `user.tier=pro`, `order.value=42.00`. They're what turn a bare timing bar into a *searchable, diagnostic* record: "show me all error spans on `/checkout` for `user.tier=pro`."

**Semantic conventions** are OpenTelemetry's **standardised attribute names** for common concepts — everyone uses `http.request.method`, `db.system`, `messaging.destination` rather than each team inventing `httpMethod` / `method` / `verb`. This matters because backends and tools rely on those names: the service map, latency-by-endpoint views, DB dashboards, and error detection all key off the standard attributes. If you name things ad-hoc, the backend can't auto-build those views and you lose cross-service consistency.

The guidance: **follow OTel semantic conventions for standard concepts**, add well-named custom attributes for your domain, and keep high-cardinality-but-useful identifiers (like `user_id`) as attributes — spans, like logs, tolerate high cardinality (subject to your sampling and backend), unlike metric labels.

### Q9. What is a service map and how is it generated?

A **service map** (or dependency graph) is a topology diagram of your architecture — nodes are services, edges are the calls between them, usually annotated with request rate, error rate, and latency per edge. It answers "what talks to what, and where is it unhealthy."

The key point interviewers look for: **it's derived, not configured.** Because every span records its service and its parent span (which belongs to the *calling* service), the backend can walk the parent/child relationships across all traces and mechanically reconstruct "service A calls service B calls C." Add up the spans on each edge and you get its RED metrics. Nobody draws the map; it *falls out* of trace data.

That's a genuinely powerful property: as your architecture changes, the map updates itself, revealing dependencies (including surprising or accidental ones) that no one documented. It's also a fast triage tool in an incident — a red edge on the map points you at the failing dependency immediately. And it only works if propagation is intact: a broken trace means missing edges, so a suspiciously disconnected map is itself a propagation-gap signal.

### Q10. What is critical-path analysis and how do you find the slow span?

The **critical path** is the chain of spans that actually determines the request's total latency — as opposed to work that happens *in parallel* and overlaps, which doesn't add to the total even if individual spans are slow.

This distinction is why you read the *waterfall*, not just a list of durations. If a request makes three downstream calls concurrently and the total is 500ms, the critical path is the *single longest* of those three (say 480ms) — speeding up the other two does nothing. But if the calls are *sequential*, they sum, and every one is on the critical path. A naive "which span has the biggest duration" can mislead when spans overlap.

To find the real bottleneck: open the trace waterfall, look for the widest bar **that isn't overlapped by its siblings** — the span whose duration isn't hidden behind concurrent work. Follow it down: a wide parent whose time is *not* accounted for by its children means the time is being spent *in that service itself* (CPU, GC, a lock), whereas a wide parent explained by one wide child means "look downstream." That "unaccounted gap" reading is the core skill of trace debugging.

### Q11. How do you link traces to logs and metrics?

This linkage is what turns three separate tools into one workflow:

- **Traces ↔ Logs:** put the **`trace_id` (and `span_id`) in every structured log line**. Then from a slow or failed span you jump to the exact logs that span produced, and from a log line you jump to the full trace. This is the single highest-value correlation and the reason the logging topic pushes trace_id so hard.
- **Metrics ↔ Traces (exemplars):** an **exemplar** is a sampled `trace_id` attached to a specific metric data point — e.g. a histogram bucket records "here's a trace_id of a request that landed in the 900ms+ bucket." So when a latency metric spikes on a dashboard, you click the point and land on an *example trace* of a slow request, instead of guessing.
- **Traces ↔ Metrics (RED):** rate/error/duration metrics can be computed from spans (next question), so the aggregate and the exemplars come from the same source.

The end-to-end loop: **a metric alerts → an exemplar takes you to a representative slow/failed trace → the trace localises the bad span → the span's `trace_id` takes you to that span's logs → the logs explain the specific cause.** Detect, localise, explain — the three pillars wired together.

### Q12. How does context propagation work across async boundaries like message queues?

Synchronous HTTP/RPC propagation is the easy case — the `traceparent` header rides along with the request. **Async boundaries are where propagation quietly breaks**, because the "call" is decoupled: a producer puts a message on a queue now, a consumer picks it up seconds later in a different process.

The fix is to **propagate context through the message itself**: the producer injects `trace_id`/`span_id` into the **message headers/metadata** (Kafka headers, SQS message attributes, AMQP headers), and the consumer extracts them when it processes the message, continuing the trace. OpenTelemetry's messaging instrumentation and semantic conventions handle this for supported brokers.

Two modelling wrinkles: (1) the consumer's work happens *after* and *detached in time* from the producer, so it's often modelled as a **span link** (a causal reference to the producing span) rather than a strict parent/child, especially for batch/fan-out where one consume relates to many produces. (2) A queue that *doesn't* carry the headers is a classic broken-trace culprit — the trace ends at "message published" and a brand-new orphan trace begins at "message consumed." Anywhere a request crosses a queue, a thread pool, or a scheduled job, propagation needs deliberate handling.

### Q13. What are the most common distributed-tracing pitfalls?

- **Broken traces from missing propagation** — the #1 issue: one service (or proxy, or queue, or async hop) doesn't forward `traceparent`, so the trace fragments into orphans. Symptom: disconnected traces, missing service-map edges.
- **Over-sampling** — keeping too high a fraction blows up cost and can pressure the app; sampling exists because you *can't* keep it all.
- **Under-sampling / head-only sampling** — dropping the rare error/slow traces you most needed because you decided at the head without seeing the outcome.
- **Too many spans** — instrumenting every function makes traces unreadable and expensive; instrument boundaries and significant operations.
- **Too few spans** — a giant opaque span with no children tells you *that* a service was slow but not *where*; you need enough granularity to localise.
- **Missing/ad-hoc attributes** — no semantic conventions means no service map, no by-endpoint views, and traces you can't search.
- **High-cardinality mistakes in derived metrics** — turning span attributes into metric labels reintroduces the cardinality bomb.

The meta-pitfall: treating tracing as fire-and-forget. It needs consistent propagation across *every* hop and a sane span-granularity and sampling policy to be worth the cost.

### Q14. How do you derive RED metrics from spans?

**RED** — Rate, Errors, Duration — is exactly the data a span already carries, so you can compute request-level RED metrics directly from trace data:

- **Rate** — count spans per operation per unit time (spans are timed events, so counting them gives throughput).
- **Errors** — count spans whose `status = error` (or `http.status_code >= 500`), divided by rate, for the error ratio.
- **Duration** — each span *is* a start/end interval, so aggregating span durations gives you the latency distribution (p50/p95/p99) per operation.

Many backends and the OTel Collector do this automatically (e.g. a "spanmetrics" processor that emits RED metrics from spans), giving you per-service and per-endpoint RED dashboards for free from your tracing data.

The important caveat: **if your spans are sampled, span-derived metrics are computed on the sampled subset and can be biased** (tail-based sampling over-keeps errors, so a naive error rate from kept spans is wildly wrong). So the mature pattern is to compute RED metrics *before* sampling (at the Collector, on the full stream) or to emit native RED metrics separately for accuracy, and use the *traces* for the exemplars and drill-down. Span-derived RED is a great convenience, but know where in the pipeline the numbers are counted.

### Q15. Walk me through debugging a latency spike end-to-end using all three pillars.

1. **Detect (metrics):** the SLO burn-rate alert fires — `checkout` p99 jumped from 300ms to 1.2s. The metric tells me *that* and *when*, not *where*.
2. **Get an example (exemplar):** on the latency histogram, I click a data point in the slow bucket; its **exemplar** gives me a `trace_id` of an actual slow request — no guessing which request to look at.
3. **Localise (trace):** I open that trace's waterfall. Eight spans; the `checkout → payments → SELECT authorizations` span is the widest bar at 900ms and it's *not* overlapped by siblings, so it's on the critical path. The time isn't explained by any child — it's spent inside the DB call.
4. **Explain (logs):** I take the `trace_id`/`span_id` from that span and filter logs on it. The `payments` service logged `db_slow_query db_host=replica-2 lock_wait=850ms` for that exact request.
5. **Confirm scope (back to metrics):** I check whether this is one trace or systemic — group span durations or logs by `db_host` and see `replica-2` is slow across many traces. It's a bad replica, not a code regression.
6. **Act & verify:** pull replica-2 from rotation, watch the p99 metric and error budget recover.

The whole flow is the three pillars wired together: **metric detects, exemplar hands off to a trace, trace localises the span, span's trace_id opens the logs that explain it, metric confirms the fix.** No single pillar gets you there alone.

### Q16. If tracing is so powerful, why not rely on it alone and drop metrics and logs?

Because each pillar is priced and shaped for a different job, and tracing is the wrong tool for two of the three.

- **You can't cheaply detect/alert on sampled traces.** Tracing is sampled (you can't afford not to), so it's a *biased, partial* view — fine for investigating a representative request, useless as the source of truth for "what's my exact error rate right now." Alerting needs complete, cheap, low-cardinality **metrics**. Deriving your alerting SLIs from sampled spans gives you wrong numbers.
- **Traces don't carry full forensic detail.** A span has attributes and a few events, but not the verbose, high-cardinality per-event record — the full stack trace, the exact payload, the audit trail — that **logs** hold. When you've localised the bad span, you still jump to logs to *explain* it.
- **Cost and completeness.** Metrics are cheap and complete; traces are expensive and sampled. Trying to reconstruct trends from traces means either sampling less (huge cost) or accepting bias.

The right framing is the division of labour: **metrics detect (cheap, complete, alertable), traces localise (where in the request), logs explain (the specific why).** Tracing is the connective pillar that makes the other two navigable — not a replacement for them. A mature observability strategy uses all three, wired together by `trace_id` and exemplars, each doing what it's priced for.
## OpenTelemetry

### Summary

**What this topic covers**

OpenTelemetry (OTel) is the industry's answer to a decade of vendor lock-in in observability tooling. This topic — 16 questions — covers what OTel is and why it exists, its API/SDK/Collector architecture, the three signals (traces, metrics, logs) unified under one project, the OTLP wire protocol and exporters, the Collector's receiver→processor→exporter pipeline (agent vs gateway topology), auto- vs manual instrumentation, semantic conventions, W3C context propagation, resource attributes, sampling, and the practical work of migrating a polyglot fleet off vendor SDKs (Datadog, Jaeger, New Relic) onto a neutral standard. The through-line: **instrument once against an open API, decide your backend later — and switch backends without re-instrumenting a single service.** That portability is the entire value proposition, and it's the thing an interviewer wants you to articulate.

**Mental model**

Think of OTel as three cleanly separated layers. (1) The **API** — a thin, stable interface your application code calls to create spans, record metrics, and emit logs. It has a no-op default, so a library can depend on it and do nothing until an SDK is present. (2) The **SDK** — the runtime implementation you wire in at process start: it samples, batches, and hands telemetry to exporters. Swapping backends means swapping SDK config, not app code. (3) The **Collector** — an optional but recommended standalone binary that receives telemetry (usually over OTLP), processes it (batch, filter, redact, tail-sample, transform), and exports it to one or more backends. The mental unlock is that **instrumentation and destination are decoupled**. Your code talks to the API; the API is backed by the SDK; the SDK exports OTLP to a Collector; the Collector fans out to Prometheus, Tempo, Loki, Datadog, whatever. Change any layer without touching the others. That's why "no re-instrumentation to switch vendors" is true rather than marketing.

**Key terms**

- **OpenTelemetry (OTel)** — CNCF project, the 2019 merger of OpenTracing (API) and OpenCensus (SDK+Collector); now the vendor-neutral standard for telemetry.
- **API vs SDK** — the API is what you instrument against (stable, no-op by default); the SDK is the pluggable runtime implementation.
- **Signal** — a telemetry type: traces, metrics, or logs. OTel covers all three under one project and one context.
- **OTLP** — OpenTelemetry Protocol, the standard gRPC/HTTP wire format for shipping any signal between SDKs, Collectors, and backends.
- **Collector** — standalone service running a receivers → processors → exporters pipeline; the "swiss army knife" of telemetry plumbing.
- **Exporter** — component that serializes telemetry to a backend's format (OTLP, Prometheus remote-write, Jaeger, Datadog).
- **Receiver / Processor / Exporter** — the three Collector pipeline stages: ingest, transform, emit.
- **Auto-instrumentation** — agent/bytecode injection that produces spans and metrics with no code changes (Java agent, Python/Node monkey-patching).
- **Semantic conventions** — standardized attribute names (`http.request.method`, `db.system`, `service.name`) so backends interpret data uniformly.
- **Context propagation** — passing trace context across service boundaries; OTel defaults to W3C TraceContext (`traceparent` header) plus Baggage.
- **Resource attributes** — key/values describing the entity producing telemetry (`service.name`, `service.version`, `k8s.pod.name`), attached to every signal.
- **Baggage** — arbitrary key/value pairs propagated alongside trace context for cross-service correlation.

**Why interviewers ask this**

OTel is now the default assumption on greenfield observability work, so knowing it signals current experience. The junior answer is "OTel is a tracing library." The senior answer explains the **API/SDK split and why it matters** (portability, library instrumentation without forcing a backend), knows the **Collector** is where real operational leverage lives (tail sampling, redaction, cost control, format translation), and can reason about a **migration** from a vendor SDK without a big-bang rewrite. Interviewers also probe whether you understand the maturity gradient — traces are mature, metrics stable, logs newest — because a candidate who claims OTel logs are a drop-in replacement for a mature logging pipeline hasn't run it in anger. The strongest signal is being able to state the value proposition to a skeptical stakeholder: instrument once, avoid re-instrumentation tax, keep negotiating leverage over vendors.

**Common confusions**

- "OTel is a backend / a replacement for Prometheus or Jaeger" — no. OTel is instrumentation + transport + a Collector. You still need a backend (Tempo, Jaeger, Prometheus, a vendor) to store and query.
- "The Collector is mandatory" — it isn't; SDKs can export OTLP directly to a backend. The Collector earns its place when you want batching, tail sampling, redaction, or fan-out.
- "Auto-instrumentation means you never write spans" — auto gives you framework/library spans (HTTP, DB, gRPC); business-meaningful spans still need manual instrumentation.
- "All three signals are equally mature" — traces are most mature, metrics stable, logs the newest and least settled; plan accordingly.
- "OTLP is a storage format" — it's a wire protocol for moving telemetry, not a TSDB or index.
- "Adopting OTel locks you into the CNCF stack" — the opposite; its point is to keep you free to move between any OTLP-speaking backend, commercial or open-source.

**What follows from this topic**

OTel is the plumbing that makes the rest of observability portable. It feeds the metrics that power [[SLIs, SLOs & Error Budgets]] and the traces/logs you stitch together in [[Correlating the Pillars & APM]] — semantic conventions and shared resource attributes are precisely what let you pivot metric → trace → log. Its sampling knobs connect back to the cost and cardinality themes running through the whole primer. If you understand OTel's decoupling, the "build vs buy" and "single pane of glass" debates in the APM topic become concrete rather than abstract.

### Q1. What is OpenTelemetry and what problem does it solve?

OpenTelemetry is a **vendor-neutral, open standard for generating and shipping telemetry** — traces, metrics, and logs — under one CNCF project. It's the 2019 merger of two earlier efforts: OpenTracing (a tracing API) and OpenCensus (Google's SDK + Collector).

The problem it solves is **per-vendor agent lock-in**. Before OTel, adopting Datadog meant Datadog's agent and SDK across your fleet; switching to New Relic meant ripping all that out and re-instrumenting everything. Every vendor had its own incompatible instrumentation. That's expensive and it hands the vendor pricing power because migration is prohibitive.

OTel breaks that by standardizing the instrumentation and the wire format (OTLP). You instrument once against the OTel API; the backend becomes a runtime/config choice. Switching vendors is a Collector exporter change, not a code change across hundreds of services.

### Q2. Explain the API vs SDK separation and why it matters.

OTel deliberately splits **the interface you instrument against (API)** from **the runtime that implements it (SDK)**.

- **API** — stable, minimal, and **no-op by default**. Your application code (and third-party libraries) call it to start spans, record measurements, emit logs. With no SDK installed, those calls do nothing and cost almost nothing.
- **SDK** — the pluggable implementation you wire in at process startup. It handles sampling, batching, resource detection, and exporting.

Why it matters: a **library author can instrument against the OTel API without forcing any backend on their users.** The application owner decides at deploy time whether to install an SDK and where to send data. And because destination lives in SDK/exporter config, **switching backends never touches instrumented code**. The API is the stable contract; everything volatile (sampling, exporters, backends) sits behind it.

### Q3. What are the three signals, and what's their relative maturity?

| Signal | What it captures | Maturity |
|---|---|---|
| Traces | Request flow across services (spans + context) | Most mature — OTel's origin |
| Metrics | Aggregated numeric measurements over time | Stable |
| Logs | Timestamped event records | Newest, least settled |

The unifying win is that all three share **one context and one set of resource attributes**, so a `trace_id` on a span can appear on a metric exemplar and in a structured log — that shared identity is what makes correlation work.

Practically: adopt traces and metrics with confidence. For logs, OTel's approach is often to **bridge an existing logging framework** into the OTel pipeline rather than replace a mature logging stack wholesale. Don't tell an interviewer OTel logs are a finished drop-in — say they're the newest signal and you'd migrate incrementally.

### Q4. What is OTLP and why does a standard wire protocol matter?

**OTLP (OpenTelemetry Protocol)** is the standard wire format for shipping telemetry between SDKs, Collectors, and backends. It runs over gRPC or HTTP and carries all three signals.

Why a single protocol matters: it's the interoperability contract. Any SDK can talk to any Collector, and any Collector can talk to any OTLP-speaking backend, without bespoke integration code. Before OTLP you had a mesh of incompatible formats (Jaeger Thrift, Zipkin JSON, Prometheus exposition, vendor blobs). OTLP collapses that into one.

That's the mechanism behind vendor portability: your services emit OTLP; changing where it lands is a config change. Most modern backends now ingest OTLP natively, and the Collector can translate OTLP into legacy formats for backends that don't.

### Q5. Describe the OpenTelemetry Collector's architecture.

The Collector is a standalone binary running one or more **pipelines**, each with three stages:

```yaml
receivers:
  otlp:
    protocols:
      grpc:
processors:
  batch: {}
  attributes:
    actions:
      - key: user.email
        action: delete   # redact PII before export
exporters:
  otlphttp:
    endpoint: https://backend.acme.internal:4318
service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [batch, attributes]
      exporters: [otlphttp]
```

- **Receivers** ingest telemetry (OTLP, Prometheus scrape, Jaeger, Zipkin, host metrics).
- **Processors** transform it in flight: batch, filter, tail-sample, redact attributes, add/rename fields, translate formats.
- **Exporters** serialize and ship to one or more backends.

It's called the "swiss army knife" because it centralizes all this plumbing outside your apps — you change telemetry handling by editing Collector config, not by redeploying every service.

### Q6. Agent mode vs gateway mode — when do you use each?

Two Collector deployment topologies, and you commonly run both:

- **Agent mode** — a Collector next to each application, typically a **DaemonSet** (one per node) or a sidecar. It does local collection, adds host/pod resource attributes, and does cheap per-node work. Low latency, no cross-node hop for the app.
- **Gateway mode** — a **centralized Collector cluster** (a Deployment behind a service) that all agents forward to. It does fleet-wide work that needs a global view: tail sampling (you must see all spans of a trace to decide), aggregation, quota enforcement, and fan-out to backends.

Typical pattern: **apps → node agents → gateway cluster → backends.** Agents handle enrichment and offload the app quickly; the gateway centralizes policy, sampling, and vendor credentials so individual services never hold backend secrets.

### Q7. Auto-instrumentation vs manual instrumentation — what's the tradeoff?

**Auto-instrumentation** injects telemetry with zero code changes — a Java agent attaches via bytecode manipulation; Python and Node monkey-patch common libraries at startup. You get spans for HTTP servers/clients, DB drivers, message queues, and gRPC essentially for free. It's the fastest path to coverage across a fleet.

**Manual instrumentation** is you writing spans and metrics in application code for business-meaningful operations auto can't see — "validate order", "run pricing model", a custom attribute like `tenant.tier`.

The tradeoff: auto gives breadth cheaply but is generic (framework-level, no domain semantics) and adds some overhead you don't control precisely. Manual gives depth and business context but costs engineering time. The pragmatic answer: **start with auto for baseline coverage, then add manual spans and attributes on the critical paths that matter to your SLOs.** They compose — manual spans nest inside auto-generated ones under the same trace.

### Q8. What are semantic conventions and why do they matter?

Semantic conventions are **OTel's standardized names for attributes** — `http.request.method`, `http.response.status_code`, `db.system`, `service.name`, `k8s.pod.name`, and so on. They define both the key names and their expected values.

They matter because **correlation and portability only work if everyone names things the same way.** If service A tags `http.method` and service B tags `httpMethod` and the vendor expects `http.request.method`, dashboards, alerts, and backend auto-detection break. Standard names mean a backend can build a service map, a latency-by-endpoint view, or a DB dashboard automatically, regardless of which language or team produced the data.

For a polyglot system this is the glue: semantic conventions plus shared resource attributes are exactly what let you pivot from a metric to a trace to a log across services written in different stacks.

### Q9. How does context propagation work in OpenTelemetry?

Context propagation is how a trace stays connected as a request crosses service boundaries. OTel defaults to the **W3C TraceContext** standard: the caller injects a `traceparent` header (carrying trace ID, parent span ID, and flags) into the outbound request; the callee extracts it and continues the same trace.

```
traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01
             │  │                                │                │
          version  trace-id                    parent-span-id   flags
```

Alongside it, **Baggage** (the `baggage` header) propagates arbitrary key/value pairs — e.g. `tenant.id` or `deployment.color` — so downstream services can attach that context to their own spans and logs.

Using the W3C standard rather than a vendor-specific header (like the old `x-datadog-*` or `uber-trace-id`) means services from different teams and even different vendors interoperate. Propagators are pluggable, so you can also emit B3 or legacy formats during a migration.

### Q10. Walk me through migrating a fleet from a vendor SDK (say Datadog or Jaeger) to OpenTelemetry.

Do it incrementally, never big-bang:

1. **Stand up the destination path first.** Deploy an OTel Collector configured to export to your *existing* backend (Datadog has an OTLP intake; Jaeger ingests OTLP). Prove OTel data lands in the tool your team already uses. No app changes yet.
2. **Dual-run at the edges.** Use the Collector to receive both formats, or run propagators that understand both the vendor header and W3C TraceContext, so traces don't fragment while some services are migrated and others aren't.
3. **Migrate service by service.** Swap the vendor SDK for the OTel SDK (often just auto-instrumentation) per service, exporting OTLP to the Collector. Because the Collector still points at the old backend, dashboards and alerts keep working.
4. **Verify semantic parity.** Map old attribute names to OTel semantic conventions so existing dashboards/alerts still match.
5. **Flip the backend last.** Once services emit OTLP through the Collector, changing vendor is a Collector exporter change — the payoff of the whole exercise.

The key message: OTel's decoupling is what makes a **safe, reversible, service-at-a-time migration** possible instead of a risky rewrite.

### Q11. Why run a Collector instead of exporting directly from the SDK to a backend?

Direct SDK-to-backend export is simplest and fine for small setups. You run a Collector when you want to move operational concerns out of your apps:

- **Batching and buffering** — smooth spikes, retry on backend outages without app-side complexity.
- **Tail sampling** — decide which traces to keep after seeing the whole trace (impossible in a single service's SDK).
- **Redaction / PII scrubbing** — strip sensitive attributes centrally, once, before anything leaves your perimeter.
- **Format translation and fan-out** — send the same telemetry to multiple backends, or translate OTLP to a legacy format.
- **Credential isolation** — apps ship OTLP to the Collector; only the Collector holds backend API keys.
- **Config without redeploys** — change sampling, routing, or destinations by editing Collector config instead of redeploying every service.

The rule of thumb: if you have more than a handful of services or any of the above needs, the Collector pays for itself.

### Q12. What are resource attributes and why are they important?

Resource attributes describe **the entity producing telemetry** — not a single request, but the source: `service.name`, `service.version`, `service.namespace`, `deployment.environment`, `k8s.pod.name`, `host.name`, `cloud.region`. They're attached to *every* span, metric, and log the process emits.

They matter for two reasons. First, **navigation and correlation**: consistent `service.name` and environment labels across all three signals are what let you jump from a service's metric dashboard to its traces to its logs — the backend groups them by the same resource identity. Second, **triage**: when something breaks you immediately know which version, which pod, which region emitted the bad data, which is often half the debugging battle (e.g. spotting that only `service.version=1.4.2` in `region=eu-west` is erroring).

Get `service.name` wrong or inconsistent and your service map fragments and cross-signal correlation quietly stops working.

### Q13. How does sampling work in OpenTelemetry, and where should it happen?

Two broad strategies, and OTel supports both:

- **Head sampling** — decide at the start of a trace (in the SDK) whether to keep it, before you know how it ends. Cheap and simple; the common form is a parent-based, ratio sampler ("keep 10%"). Downside: it's blind to outcome, so you'll drop 90% of traces including slow or failed ones you'd most want.
- **Tail sampling** — decide after the trace completes, in a **Collector** that has buffered all the spans. Now you can keep 100% of errors and slow traces and sample the boring successful ones. Far more useful, but requires a gateway Collector that sees every span of a trace (so all spans of a trace must route to the same Collector instance).

Guidance: head-sample lightly at the SDK to control raw volume, then **tail-sample in the gateway** to keep what's diagnostically valuable. Metrics, by contrast, are aggregated not sampled — don't sample metrics the way you sample traces.

### Q14. How do you instrument a polyglot system consistently with OTel?

The whole reason OTel exists is that "polyglot" stops being a problem. The consistency comes from shared standards, not shared code:

- **One API surface per language, same concepts.** Each language has its own OTel SDK, but they implement the same spec — spans, context, metrics — so mental model and data shape match across Go, Java, Python, Node.
- **Semantic conventions** ensure a Go service and a Python service both emit `http.request.method` and `service.name`, so the backend treats them uniformly.
- **W3C TraceContext propagation** means a trace flows unbroken from the Node front end through the Java service to the Go worker.
- **A shared Collector layer** centralizes sampling, redaction, and routing so per-language config stays thin.

Enforce it with a small internal bootstrap/library per language that sets resource attributes, propagators, and exporter endpoints consistently, so teams can't drift. Result: uniform telemetry from a heterogeneous fleet.

### Q15. How do you sell OpenTelemetry to a skeptical interviewer or stakeholder?

Lead with the economics and the leverage, not the technology:

- **Instrument once, switch backends freely.** Adoption means you never pay the re-instrumentation tax again. Changing vendor becomes a Collector config change, which restores your negotiating leverage on price.
- **No lock-in.** You're not betting the fleet on one vendor's agent; if a vendor raises prices or a better tool appears, you move.
- **One standard across a polyglot fleet** — consistent traces/metrics/logs regardless of language, with correlation built in via shared context.
- **Library instrumentation for free** — as the ecosystem standardizes on the OTel API, frameworks ship instrumentation you inherit.
- **Future-proof and community-owned** — it's a CNCF standard with broad vendor buy-in, so you're aligning with where the industry is going, not a proprietary dead end.

The one-liner: *"OTel decouples how you instrument from where your telemetry goes, so you never re-instrument to change vendors."*

### Q16. What are the current gaps or maturity limits of OpenTelemetry?

Be honest — a candidate who claims OTel is finished loses credibility:

- **Logs are the least mature signal.** The tracing and metrics specs are stable; logging is newer, and most teams bridge an existing logging framework into OTel rather than replacing a mature log pipeline outright.
- **Overhead and footprint.** Running agent + gateway Collectors is real infrastructure to operate, monitor, and scale — it's not free.
- **Auto-instrumentation coverage varies by language.** Java's agent is very strong; some ecosystems have thinner library coverage, so you fall back to manual spans sooner.
- **Semantic conventions have churned.** Attribute names have changed as the spec stabilized (e.g. HTTP conventions were reorganized), so older instrumentation and dashboards can mismatch and need reconciliation.
- **Config complexity.** The Collector is powerful but its pipeline config is a genuine surface area to learn and get wrong.

Net: traces and metrics are production-ready and the standard to adopt; treat logs and some auto-instrumentation as maturing, and budget for operating the Collector.

## Correlating the Pillars & APM

### Summary

**What this topic covers**

Metrics, logs, and traces are only powerful when you can move *between* them. This topic — 15 questions — is about **correlation**: turning three separate data silos into one investigative workflow where a dashboard spike leads you to an example slow trace, which leads you to the exact logs for that request. It covers exemplars (linking a Prometheus histogram sample to a `trace_id`), `trace_id` in structured logs, consistent resource/service labels as the connective tissue, the "single pane of glass" goal, the APM landscape (Datadog, New Relic, Dynatrace, Honeycomb, and the Grafana LGTM stack — Loki/Grafana/Tempo/Mimir), build-vs-buy tradeoffs, the high-cardinality "wide events / observability 2.0" argument, service maps, the cross-pillar debugging workflow, and the very real cost traps of managed APM. The recurring interview question this topic prepares you for: *"walk me through debugging a latency regression."*

**Mental model**

Picture the three pillars as three views of the *same events*, joined by shared keys. **Metrics** tell you *that* something is wrong and roughly where — cheap, aggregated, good for alerting and trends. **Traces** tell you *where in the request path* the time or errors went — the causal structure across services. **Logs** tell you *exactly what happened* for one request — the fine detail. The magic is the joins: an **exemplar** links a metric bucket to a representative `trace_id`; that `trace_id` appears in the **structured logs** of every service that handled the request; consistent **`service.name`/resource labels** let the tool navigate between all three. So the ideal workflow is a funnel: *metric spike → click the exemplar → open the trace → find the slow span → read that span's logs.* You start broad and cheap, and drill to narrow and detailed only for the specific request that's misbehaving. A tool (or stack) that can't perform those joins forces you to grep three systems by hand and correlate timestamps manually — which is what "no observability" actually feels like at 3am.

**Key terms**

- **Correlation** — the ability to pivot from one signal to another for the same request/service via shared identifiers.
- **Exemplar** — a sample attached to a Prometheus histogram bucket carrying a `trace_id`, linking a latency spike to an example trace.
- **trace_id in logs** — including the trace/span ID in structured log lines so you can fetch all logs for one traced request.
- **Single pane of glass** — one UI where metrics, traces, and logs are queryable and cross-linked, instead of three disjoint tools.
- **APM (Application Performance Monitoring)** — tooling that bundles auto-instrumentation, correlation, service maps, and dashboards (Datadog, New Relic, Dynatrace, etc.).
- **LGTM stack** — Grafana's open-source suite: **L**oki (logs), **G**rafana (visualization), **T**empo (traces), **M**imir (metrics).
- **Service map** — an auto-generated dependency graph of services derived from trace spans.
- **Wide events** — arbitrarily high-cardinality structured events (many attributes per event), the basis of Honeycomb's "observability 2.0" argument.
- **High cardinality** — many distinct values for a dimension (user_id, request_id); expensive for metrics, but the whole point of wide events.
- **Build vs buy** — running OSS (Prometheus/Grafana/Loki/Tempo) yourself vs paying a managed APM.
- **RUM (Real User Monitoring)** — client-side telemetry from actual browsers/apps, correlated with backend traces.
- **Cardinality billing** — APM pricing that charges by custom metrics/hosts/ingested GB, where high cardinality silently explodes cost.

**Why interviewers ask this**

This separates people who *have* observability tools from people who can *use* them under pressure. Junior candidates describe the three pillars as a list. Senior candidates describe the **investigative workflow that connects them** — and know the mechanics that make it possible (exemplars, `trace_id` in logs, consistent labels). Interviewers use "walk me through debugging a latency regression" as the flagship question precisely because it forces you to demonstrate the funnel: symptom in a metric, drill to a trace, read the logs, form a hypothesis. They also probe **build-vs-buy** and **cost** judgment, because in the real world observability bills are enormous and cardinality is the usual culprit. Being able to reason about Honeycomb's wide-events thesis vs the classic metrics/logs/traces split shows you understand where the field is heading, not just what a dashboard looks like.

**Common confusions**

- "The three pillars are the goal" — the pillars are the raw material; **correlation** is the goal. Three unlinked silos barely help.
- "Exemplars are just another metric label" — they're a *sample* carrying a trace reference, deliberately outside the aggregation, so a spike links to a real example trace.
- "A single pane of glass means one vendor" — it means the signals are cross-linked and navigable; you can build that from OSS components too.
- "High cardinality is always bad" — it's bad for pre-aggregated *metrics*; it's the entire value of *wide events* and traces, where you *want* rich per-request dimensions.
- "APM is plug-and-play and cheap" — auto-instrumentation is easy to start, but custom metrics, high host counts, and ingest volume make APM bills notorious.
- "Build (OSS) is always cheaper than buy" — OSS shifts cost from license to engineering time and on-call for the observability stack itself.

**What follows from this topic**

Correlation is what makes the earlier pillars worth collecting and what makes [[OpenTelemetry]] valuable — OTel's shared context and semantic conventions are precisely the keys these joins rely on. The debugging workflow here is the payoff of good instrumentation, and it feeds directly into incident response: faster pivoting means lower MTTR. The cost and cardinality themes connect to metrics design throughout the primer, and the "symptom-based" instinct — start from user-facing impact and drill down — sets up [[SLIs, SLOs & Error Budgets]], where the symptom you alert on *is* the SLO breach.

### Q1. Why are the three pillars only useful when correlated?

Because a symptom in one pillar rarely gives you the answer — you need to move to the others. A latency graph tells you *that* p99 doubled; it can't tell you *why*. To find out you need the trace of a slow request (where did the time go?) and the logs for that request (what actually happened?).

If the three are unlinked silos, you're reduced to **manual timestamp correlation across three tools**: eyeball the spike time, grep logs around that window, hope you find the right request, guess which trace matches. That's slow and error-prone at 3am.

Correlation collapses that into clicks: from the spiking metric, jump to an example trace via an exemplar, then to that request's logs via `trace_id`. The pillars are the raw material; **the joins between them are where the value is.** An interviewer wants you to say that, not recite "metrics, logs, traces."

### Q2. What is an exemplar and what problem does it solve?

An **exemplar** is a sample attached to a metric — classically a **Prometheus histogram bucket** — that carries a `trace_id` (and timestamp/value) for one representative observation in that bucket.

The problem it solves: a histogram is aggregated, so when p99 latency spikes you see *that* it happened but have no path to an actual slow request. The exemplar is the bridge — it says "here's the `trace_id` of one request that landed in this slow bucket." Click it and you're in the trace for a genuinely slow request, not a random one.

```promql
# latency spike visible here...
histogram_quantile(0.99, sum by (le) (rate(http_request_duration_seconds_bucket[5m])))
# ...and the bucket's exemplar carries a trace_id -> jump straight to a slow trace
```

So exemplars are the concrete mechanism that connects the *metrics* pillar to the *traces* pillar. Without them, "drill from a dashboard into a trace" is manual guesswork.

### Q3. How do you correlate logs with traces?

Put the **`trace_id` (and usually `span_id`) into your structured logs.** Once every log line for a request carries the trace ID, you can pivot in both directions: from a trace, fetch *all logs across all services* for that request; from a suspicious log line, jump to the full trace to see where it sits in the request flow.

```json
{
  "ts": "2026-07-02T10:15:22Z",
  "level": "error",
  "service": "checkout",
  "trace_id": "4bf92f3577b34da6a3ce929d0e0e4736",
  "span_id": "00f067aa0ba902b7",
  "msg": "payment gateway timeout",
  "tenant": "acme"
}
```

The prerequisites are **structured logs** (JSON or key/value, not free text) and **trace context propagation** so the ID flows through every service. With OTel this is largely automatic — the SDK injects the active trace context, and log appenders pick it up. The result: one request's story across every service, reconstructable from either end.

### Q4. What role do consistent labels play in correlation?

They're the connective tissue that lets a tool navigate between signals at all. If a service's metrics are tagged `service="checkout"`, its traces carry `service.name="checkout"`, and its logs include `service: checkout`, the backend can group all three and offer "show me the traces / logs for this service" from a metric panel.

Break that consistency — `checkout` in metrics, `checkout-svc` in traces, `co` in logs — and the joins silently fail. You'll have all the data and no way to move between it without manual translation.

This is why **resource attributes and semantic conventions** (from the OTel topic) matter so much: `service.name`, `deployment.environment`, and version labels applied uniformly across all three signals are exactly what make cross-pillar navigation work. Correlation is a labeling discipline as much as a tooling feature.

### Q5. What does "single pane of glass" mean and is it realistic?

It means **one interface where metrics, traces, and logs are all queryable and cross-linked**, so an engineer investigates in one place rather than tab-hopping between three disjoint tools and correlating by hand.

Is it realistic? Yes — two ways. Commercial APMs (Datadog, New Relic, Dynatrace) deliver it as a bundled product. Or you assemble it from OSS: **Grafana** as the single UI over **Mimir** (metrics), **Tempo** (traces), and **Loki** (logs), with exemplars and `trace_id` links wiring the pillars together.

The nuance to raise: "single pane of glass" is about **navigability, not a single vendor.** The real test isn't whether it's one product — it's whether you can click from a metric to a trace to a log without leaving the flow. A single vendor that doesn't correlate well is a worse single pane than a well-integrated OSS stack.

### Q6. What do APM tools actually bundle, and name the major players.

An APM (Application Performance Monitoring) tool packages the whole observability pipeline into a product:

- **Auto-instrumentation** — drop in an agent, get traces/metrics for common frameworks with little code.
- **Correlation** — pillars pre-linked (metrics ↔ traces ↔ logs) out of the box.
- **Service maps** — auto-generated dependency graphs from trace data.
- **Dashboards, alerting, and storage** — managed, so you don't run a TSDB.

Major players: **Datadog** (broad, dominant, famously pricey), **New Relic**, **Dynatrace** (strong auto-discovery/AI angle), **Honeycomb** (high-cardinality wide-events approach), and Grafana's open-source **LGTM stack** — **L**oki, **G**rafana, **T**empo, **M**imir — which you self-host or buy as Grafana Cloud.

The pitch is time-to-value: you get correlated observability without building and operating the plumbing. The cost is money and lock-in.

### Q7. Build vs buy for observability — how do you decide?

Frame it as **shifting cost, not eliminating it.**

| | Build (OSS: Prometheus/Grafana/Loki/Tempo) | Buy (managed APM) |
|---|---|---|
| Upfront $ | Low (no license) | High, usage-based |
| Eng effort | High — you run/scale/on-call the stack | Low — vendor operates it |
| Control | Full — data stays in-house, tune freely | Limited to product features |
| Correlation | You wire exemplars/trace links yourself | Built in |
| Cost risk | Infra + engineer time | Cardinality/ingest bill shocks |

Decide on: team size and whether you *want* engineers running an observability platform; data-residency/compliance needs (favor build); scale and the resulting bill (huge volume can make buy eye-watering — or make build the only affordable option); and speed-to-value (buy wins early). Common trajectory: **buy early to move fast, revisit when the bill or lock-in hurts.** There's no universal answer — the interviewer wants to see you weigh effort vs money vs control, not pick a side dogmatically.

### Q8. Explain Honeycomb's high-cardinality "wide events" argument.

The classic model pre-aggregates: you decide *in advance* which dimensions to keep as metric labels, because high cardinality (user_id, request_id) blows up a TSDB. That means when a novel problem appears — "only requests from `tenant=acme` on `build=1.4.2` in `region=eu` are slow" — you can't slice by dimensions you didn't pre-plan.

Honeycomb's argument ("observability 2.0") is to instead emit **arbitrarily wide structured events** — one rich event per request with dozens or hundreds of attributes, *all* high-cardinality dimensions included — and store them in a columnar system built for ad-hoc slicing. Now you can group by *any* attribute after the fact and find that `tenant=acme`+`build=1.4.2` needle without having predicted it.

The trade: it inverts the cost model. **High cardinality is a feature here, not a footgun** — you pay for storing wide events instead of paying in blindness. It's aimed squarely at debugging **unknown-unknowns**, which pre-aggregated metrics fundamentally can't do.

### Q9. What is a service map and how is it generated?

A service map is an **auto-generated dependency graph of your system** — nodes are services, edges are the calls between them, usually annotated with request rate, error rate, and latency.

It's generated from **trace data**: every span records its service and its parent, so aggregating spans across many traces reconstructs "checkout calls payments calls the ledger." Nothing is hand-drawn; the map falls out of context propagation.

Why it's useful: it shows real runtime topology (often surprising versus the architecture diagram), reveals unexpected dependencies, and in an incident lets you see *which edge* is red — is checkout slow itself, or slow because payments is slow? That turns "the system is slow" into "this specific dependency is the problem," which is most of triage. It depends entirely on consistent trace propagation and `service.name` labeling.

### Q10. Walk me through debugging a latency regression across the pillars.

This is the flagship question — narrate the funnel:

1. **Symptom (metrics).** An alert or dashboard shows p99 latency on `checkout` jumped after the 10:00 deploy. Metrics tell me *that* it's wrong and roughly *when*.
2. **Localize (metrics + service map).** I check the service map / RED metrics per dependency: is checkout itself slow, or is a downstream (payments, ledger) slow? Say the map shows the payments edge is red.
3. **Drill to a trace (exemplar).** From the latency histogram I click an **exemplar** in a slow bucket, landing in a genuinely slow trace. I read the span breakdown and see one span — `payments.authorize` — eating 800ms.
4. **Read the logs (`trace_id`).** I pivot from that span to its logs via `trace_id` and find "payment gateway timeout, retrying" repeated — a retry storm.
5. **Form the hypothesis.** The 10:00 deploy changed a timeout/retry config on the payments client; correlate with the deploy marker and, if confirmed, roll back.

The point to land: I moved **metric → trace → log**, broad-and-cheap to narrow-and-detailed, using exemplars and `trace_id` as the joins — not by grepping three systems by hand.

### Q11. What is unified query and why does it matter?

Unified query means being able to **ask questions across signals from one query surface** rather than learning and stitching together three query languages in three tools. In practice it ranges from a shared UI (Grafana over Loki/Tempo/Mimir with cross-links) to genuinely joined queries and, increasingly, correlated wide-event querying.

Why it matters: investigation speed. If jumping from "p99 by endpoint" (metrics) to "traces for that endpoint" (traces) to "error logs in those traces" (logs) requires three separate mental contexts and manual copy-pasting of IDs and timestamps, MTTR suffers and mistakes creep in. A unified query layer keeps you in one flow, using the same labels and time range, following links instead of rebuilding context. It's the query-side expression of the "single pane of glass" — the goal is to *reason continuously*, not to re-orient every time you switch data type.

### Q12. How do you correlate front-end (RUM) with backend traces?

**RUM (Real User Monitoring)** captures client-side telemetry from actual browsers/mobile apps — page load, interaction latency, JS errors, the timing users truly experience. On its own it tells you the front end is slow but not why.

You correlate it with the backend by **propagating trace context from the client into backend requests.** The browser starts a trace (or span) for a user action and injects the `traceparent` header on its API calls; the backend continues that same trace. Now one trace spans the click, the network, and every backend service.

That end-to-end view answers questions neither side can alone: is a slow checkout the user's network, the front-end render, or a slow backend dependency? You see the whole path in one trace. The prerequisites are the same correlation primitives — W3C context propagation and consistent IDs — extended out to the client. It closes the last gap between "what the user felt" and "what the servers did."

### Q13. Why do APM bills explode, and how do you control cost?

APMs typically bill on some mix of **per-host, ingested GB (logs/traces), and custom metrics — and custom metrics are billed per unique time series (i.e. per cardinality).** That last one is the classic blow-up: add one high-cardinality label (user_id, request_id, full URL) to a custom metric and you can multiply your time-series count — and your bill — by orders of magnitude overnight.

Controls:

- **Kill high-cardinality metric labels.** Never put unbounded IDs on metrics; keep them on traces/wide events instead.
- **Sample traces** (tail-sample to keep errors/slow, drop boring successes) to cut ingest volume.
- **Cut log volume** — drop debug logs in prod, sample high-frequency lines, route detail to cheaper storage.
- **Audit custom metrics** — teams accumulate unused ones; prune them.
- **Set quotas/alerts on ingest** so a bad deploy that spams metrics doesn't produce a surprise invoice.

The interview signal: you know **cardinality is the usual culprit** and you treat observability spend as something to actively engineer, not a fixed cost.

### Q14. Walk me through the general cross-pillar debugging workflow.

Generalize the funnel beyond latency:

1. **Start at the symptom in a dashboard/alert** — a metric that's user-facing (error rate, latency, an SLO burn). Metrics are cheap and aggregated, so they're where you *notice*.
2. **Narrow the blast radius with metric dimensions and the service map** — which service, which endpoint, which version/region, which dependency is red.
3. **Drill to an exemplar trace** for an actual affected request and read the span breakdown to find *where* — which span, which downstream call — the errors or time concentrate.
4. **Read that request's logs** via `trace_id` for the *what* — the exact error, arguments, retries.
5. **Correlate with change events** — deploys, config flips, feature flags — to find the *cause*, then mitigate (roll back / disable flag) before doing the full root-cause.

The shape is always **broad and aggregated → narrow and detailed**, using exemplars and `trace_id` as the joins. Naming that shape — and the joins — is what marks a senior answer.

### Q15. Someone asks "why can't we just use logs for everything?" — how do you respond?

You *can* answer many questions from logs, but it's the wrong tool for two jobs and it doesn't scale:

- **Alerting and trends need metrics.** You don't want to compute "p99 latency over 5 minutes" by scanning terabytes of logs on every alert evaluation — it's slow and expensive. Metrics are pre-aggregated, cheap, and built for that.
- **Request flow across services needs traces.** Logs are per-service events; reconstructing "this request went front-end → checkout → payments → ledger and stalled at payments" from scattered log lines is painful. Traces give you that causal structure natively.
- **Logs at volume are the most expensive pillar.** High-detail per-event data is exactly what you *don't* want to keep unsampled at scale.

The right framing: **each pillar has a job.** Metrics for cheap detection and trends, traces for request-path structure, logs for fine-grained per-request detail — and correlation to move between them. "Logs for everything" gives you huge bills, slow alerts, and no request-level structure.

## SLIs, SLOs & Error Budgets

### Summary

**What this topic covers**

This is the reliability-as-engineering core of SRE: how to define what "reliable enough" *means* numerically and then use that number to run the team. The 17 questions cover the definitions (SLI, SLO, SLA, error budget), how to choose *good* SLIs (user-centric, request-based, measured at the right boundary), setting the SLO target and window (the nines table, rolling vs calendar), the **error budget** as a feature-velocity control that aligns dev and ops, why 100% is the wrong target, latency SLOs (threshold + percentile), the subtleties of the "valid events" denominator, where you measure availability (LB vs server vs client), multi-SLI and user-journey SLOs, aggregation, reporting, common mistakes, and — the payoff — how SLOs actually change team behavior. This topic sets up SLO-based alerting (burn rates), which the next topic covers.

**Mental model**

Reframe reliability from a vague virtue into a **budget you spend.** An SLI is a measurement — almost always a ratio, `good_events / valid_events` (e.g. fraction of requests served fast and successfully). An SLO is a *target* for that ratio over a window: "99.9% of requests succeed over 28 days." The complement, `1 − SLO`, is your **error budget** — the amount of unreliability you're *allowed*. That reframing is the whole point. 99.9% doesn't mean "try not to fail"; it means you have a concrete allowance of failures (about 43 minutes a month) to *spend* — on risky deploys, experiments, migrations. If you have budget left, ship faster and take risks. If you've burned it, stop shipping and stabilize. Reliability stops being an argument between dev ("ship features") and ops ("keep it up") and becomes a shared number both sides manage. And because 100% is impossible and prohibitively expensive — and users can't tell 100% from 99.99% behind their own flaky networks — the *right* target is deliberately below perfect, chosen to match what users actually need.

**Key terms**

- **SLI (Service Level Indicator)** — a quantitative measure of a service level, usually a ratio `good_events / valid_events`.
- **SLO (Service Level Objective)** — an internal target for an SLI over a time window (e.g. 99.9% over 28 days).
- **SLA (Service Level Agreement)** — the contractual, customer-facing version with financial/legal penalties; usually looser than the internal SLO.
- **Error budget** — `1 − SLO`; the permitted quantity of failure over the window.
- **Burn rate** — how fast you're consuming the error budget relative to the sustainable pace (previews the alerting topic).
- **Availability SLI** — fraction of valid requests served successfully.
- **Latency SLI** — fraction of valid requests faster than a threshold, always paired with a percentile ("95% under 300ms").
- **The nines** — 99% ≈ 7.2h/month, 99.9% ≈ 43m/month, 99.99% ≈ 4.3m/month of allowed downtime.
- **Window** — the period the SLO is measured over; **rolling** (trailing 28 days) vs **calendar** (this month).
- **Valid events** — the denominator; which events "count" toward the SLI (e.g. exclude health checks, define what a "failure" is).
- **Critical user journey (CUJ)** — a key end-to-end user flow (e.g. checkout) that an SLO is defined around, rather than a single endpoint.
- **Error budget policy** — the pre-agreed rule for what happens when the budget is exhausted (e.g. feature freeze).

**Why interviewers ask this**

SLIs/SLOs are the vocabulary of modern SRE, so fluency signals you've operated services the way Google's SRE book prescribes. The junior answer confuses SLA and SLO and picks a vanity target ("we want 99.99%!") with no cost reasoning. The senior answer explains **why 100% is wrong**, chooses an SLI that reflects *user* experience at the *right boundary*, reasons about the **denominator** (valid events) and percentiles, and — crucially — treats the **error budget as a decision-making tool** that aligns dev and ops rather than a vanity metric. Interviewers love this area because it reveals whether you think about reliability *economically* (budgets, trade-offs, velocity) or just aspirationally ("more nines good"). It's also a proxy for organizational maturity: can you describe how an SLO actually changes what a team ships and when it freezes?

**Common confusions**

- "SLA and SLO are the same" — the SLA is the *contractual* promise with penalties; the SLO is your *internal* target and is set tighter so you breach the SLO (and react) well before the SLA.
- "Higher is always better; aim for 100%" — 100% is impossible, exponentially costly, and invisible to users behind their own networks. The right target is the *lowest* number users don't notice.
- "The error budget is a failure count to minimize" — it's an allowance to *spend* on velocity; leaving it unused means you're being too conservative.
- "Average latency is a fine SLI" — averages hide the tail; latency SLOs must use a **percentile** (p95/p99), because the slow tail is what users feel.
- "Availability is availability, wherever you measure it" — where you measure (client vs LB vs server) changes the number and what it means; server-side success can coexist with users seeing failures.
- "An SLI can be any metric" — a good SLI is a *user-centric ratio*; CPU% is a useful signal but a bad SLI because users don't experience CPU.

**What follows from this topic**

SLOs are the foundation the next topic builds on: once you have an SLO and an error budget, you alert on the **burn rate** (multi-window, multi-burn-rate) rather than on every cause — symptom-based paging on user-facing impact. This connects straight back to the "start from the symptom" instinct in [[Correlating the Pillars & APM]]: the symptom you page on *is* the SLO breach, and you drill from there. The SLIs themselves come from the metrics and traces produced via [[OpenTelemetry]] — good instrumentation is the prerequisite for measuring `good/valid` at the right boundary.

### Q1. Define SLI, SLO, SLA, and error budget.

- **SLI (Service Level Indicator)** — a *measurement* of how well the service is doing, almost always a ratio: `good_events / valid_events`. E.g. successful requests ÷ valid requests.
- **SLO (Service Level Objective)** — an *internal target* for that SLI over a window. E.g. "99.9% of requests succeed over 28 days."
- **SLA (Service Level Agreement)** — the *contractual, customer-facing* version, with penalties (refunds, credits) if breached. Deliberately looser than the SLO.
- **Error budget** — `1 − SLO`. If the SLO is 99.9%, the budget is 0.1% of events allowed to fail in the window.

The relationship to nail: **SLI is the number, SLO is the target for that number, SLA is the promise with money attached, error budget is the room between perfect and the SLO.** Set the SLO tighter than the SLA so you notice and react before you owe customers anything.

### Q2. What makes a good SLI versus a bad one?

A good SLI is **user-centric, a ratio of good to valid events, and measured where it reflects the user's experience.**

- **User-centric** — it measures something users actually feel: did their request succeed, was it fast? A *bad* SLI measures internal state users don't experience directly — CPU utilization, memory, queue depth. Those are useful *signals* but terrible SLIs because a service can be at 90% CPU and perfectly happy, or idle and broken.
- **A ratio** — `good/valid` normalizes across traffic volume, so it means the same thing at 10 req/s or 10,000.
- **Measured at the right boundary** — as close to the user as practical (see the "where do you measure availability" question).

The test: "if this number is good, is the user happy? If it's bad, is the user unhappy?" A good SLI answers yes to both. CPU% fails that test; "fraction of requests served successfully and under 300ms" passes it.

### Q3. Explain the "nines" and the downtime they allow.

The "nines" are shorthand for availability targets, and each nine cuts allowed downtime by ~10×:

| SLO | Allowed downtime / month | / year |
|---|---|---|
| 99% ("two nines") | ~7.2 hours | ~3.65 days |
| 99.9% ("three nines") | ~43 minutes | ~8.76 hours |
| 99.99% ("four nines") | ~4.3 minutes | ~52 minutes |
| 99.999% ("five nines") | ~26 seconds | ~5.26 minutes |

The point isn't to memorize the table (though 99.9% ≈ 43 min/month is worth knowing) — it's to internalize that **each extra nine is exponentially harder and more expensive.** Going from three to four nines can mean redundant everything, multi-region, and near-zero-downtime deploys. So the number isn't a bragging target; it's a cost decision. You pick the fewest nines your users actually require, because each additional one buys diminishing user-visible benefit at rapidly rising cost.

### Q4. What is an error budget and how do you use it operationally?

The error budget is `1 − SLO` — the quantity of failure you're *allowed* over the window. At 99.9% over 28 days, roughly 43 minutes of "down" (or the equivalent fraction of failed requests) is your budget.

Operationally it's a **feature-velocity control**:

- **Budget remaining → ship.** You have room to take risks — deploy the big change, run the migration, do the risky experiment. Unreliability you cause stays within budget.
- **Budget exhausted → freeze.** Stop shipping features; redirect effort to reliability (fix the bugs, add resilience) until the budget recovers.

This is the genius of the mechanism: it turns "how much risk should we take this week?" into an objective, data-driven answer instead of a political fight. Both dev and ops look at the same gauge. Spending the budget is *expected* and healthy — an untouched budget means you're shipping too cautiously. It converts reliability from a vibe into a resource you allocate.

### Q5. Why is 100% the wrong reliability target?

Three reasons, and a senior answer gives all three:

1. **It's effectively impossible.** Every dependency, network, and deploy has some failure probability; driving the product of all of them to exactly 1.0 is unattainable.
2. **The cost is exponential.** Each nine roughly 10×'s the effort — redundancy, multi-region, elaborate rollout safety. Chasing 100% spends unbounded money for vanishing returns.
3. **Users can't perceive it.** Between the user and your service sits their flaky WiFi, their ISP, their device. A user on a 99% mobile connection literally cannot tell whether your backend is 99.9% or 100%. Reliability beyond what the user's own environment permits is invisible.

So the right target is the **lowest reliability at which users don't notice or complain** — enough to keep them happy, no more. Aiming higher than that burns money and, worse, leaves you **no error budget to spend on velocity.** Deliberately-below-perfect is the *correct* engineering choice, not a compromise.

### Q6. How do you set the SLO target and the time window?

**Target** — work backward from users, not up from current performance. Ask what reliability keeps users happy and the business safe, then set the SLO just above the pain threshold — and comfortably tighter than any SLA so you react before penalties trigger. Don't just enshrine last quarter's number; and don't pick a vanity target you can't afford.

**Window** — the period the SLO is measured over, and it's a real choice:

- **Rolling window** (e.g. trailing 28 days) — always "the last 28 days." Smooth, no artificial reset, better reflects continuous user experience. Most common for error budgets.
- **Calendar window** (e.g. this month) — aligns with reporting/business cycles and contractual SLAs, but the budget resets abruptly on the 1st, which can encourage gaming near month-end.

28 days is a popular rolling choice because it covers four full weekly traffic cycles without month-length variation. The window length also sets how twitchy the budget is: short windows react fast but are noisy; long windows are stable but forgive incidents slowly.

### Q7. How do you define a latency SLO?

Never as an average — always as a **threshold plus a percentile**: *"95% of valid requests complete in under 300ms over 28 days."*

Two parameters:

- **Threshold** — the latency users consider acceptable (e.g. 300ms). Below it = "good."
- **Percentile** — what fraction must beat the threshold (p95, p99). This is the SLI ratio: `requests_under_threshold / valid_requests`.

Why a percentile and not the mean: **averages hide the tail.** A service with a great average can still deliver a miserable p99, and the slow tail is exactly what users notice and complain about. Percentiles put a bound on the tail directly.

You often set **multiple latency SLOs** — e.g. p95 < 300ms *and* p99 < 1s — to bound both typical and worst-case experience. Measured in Prometheus, this comes from histogram buckets:

```promql
# fraction of requests under 300ms over the last 28 days
sum(rate(http_request_duration_seconds_bucket{le="0.3"}[28d]))
  /
sum(rate(http_request_duration_seconds_count[28d]))
```

### Q8. What are "valid events" and why is the denominator subtle?

The SLI is `good_events / valid_events`, and getting the **denominator** right is where the real judgment lives. "Valid events" defines *which events count* toward the SLO.

Subtleties:

- **Exclusions** — health checks, synthetic monitoring, and internal probes usually shouldn't count as user traffic; including them distorts the ratio.
- **What's a failure?** A 500 is clearly bad. But is a 404 a failure (broken link) or expected (user typo)? Is a 429 rate-limit your fault or the client's? Are 4xx client errors "valid but bad" or "invalid, exclude"? You must decide explicitly.
- **Whose fault?** A request that fails because the *client* disconnected or sent garbage arguably shouldn't burn *your* budget.

Why it matters: a lenient denominator (excluding too much) flatters the SLI and hides real pain; a naive one (counting every 4xx as a failure) makes you page on user typos. **The denominator encodes your definition of "a request we're responsible for serving correctly."** Interviewers probe here because sloppy denominators are the most common way SLOs end up measuring the wrong thing.

### Q9. Where should you measure availability — client, load balancer, or server?

It's a spectrum, and *where* you measure changes both the number and its meaning:

- **Server-side** — easiest (you own the logs/metrics), but blind to anything that fails *before* reaching your server: LB errors, DNS, dropped connections. Your server can report 100% success while users get errors.
- **Load balancer** — captures more of the real edge (includes requests that never reached a healthy backend) and is still infrastructure you control. Often the **sweet spot**.
- **Client-side (RUM)** — closest to true user experience, catches CDN/network/JS failures, but noisy (includes the user's own flaky network, which you can't fix) and harder to collect.

Guidance: **measure as close to the user as you can while still measuring things you're responsible for.** The load balancer is frequently the best trade-off — it sees failures the server misses without drowning in client-network noise. The key insight to state: "server-side success ≠ user success," so a server-only availability SLI can look green while users are unhappy.

### Q10. What is an error budget policy?

An error budget policy is the **pre-agreed, written rule for what happens when the budget runs out** — decided *before* an incident, when everyone's calm, so it's not renegotiated under pressure.

A typical policy:

- **Budget healthy** — normal feature development, take reasonable risks.
- **Budget low (e.g. <25% left)** — heightened caution, extra review on risky changes.
- **Budget exhausted** — **feature freeze**: no new features ship; the team works only on reliability (bugfixes, hardening) until the budget recovers.

It also specifies who can grant exceptions and how (e.g. a critical security fix can ship during a freeze). The value is that it's **agreed in advance and applies to everyone**, including product and leadership — so "we're frozen, we ship reliability work now" is policy, not a per-incident argument. Without the policy, the error budget is just a number nobody's obligated to act on; *with* it, the budget actually governs behavior.

### Q11. How do SLOs actually change team behavior?

This is the "so what" — SLOs are worthless if they're just a dashboard. When they *work*, they change behavior in concrete ways:

- **They align dev and ops** on a shared number, ending the perennial "ship faster" vs "keep it stable" standoff — both sides read the same error-budget gauge.
- **They gate releases via the budget** — velocity is high when there's budget, and a freeze is automatic when it's gone. Risk-taking becomes data-driven.
- **They redirect effort automatically** — burning budget fast is the signal to invest in reliability *now*, before a bigger outage.
- **They make reliability a product decision** — choosing the target is a business trade-off (cost vs user happiness vs velocity), so product owns it too.
- **They prioritize by user impact** — you page and invest on user-facing SLO breaches, not on every internal blip, which cuts alert fatigue.

The one-liner: **SLOs turn reliability from an opinion into a budget the whole org manages together**, which is why they're the backbone of SRE practice.

### Q12. Availability SLO vs latency SLO — do you need both?

Usually yes, because they catch different failures and a service can pass one while failing the other.

- **Availability SLO** — `successful / valid` requests. Catches outright errors: 500s, timeouts, unreachable service.
- **Latency SLO** — `requests_under_threshold / valid` at a percentile. Catches "technically working but painfully slow" — which availability alone happily reports as 100% success.

A service returning 200s in 8 seconds is *available* and *unusable*. Conversely a fast-failing service has great latency on its (few) successes and terrible availability. Each SLO bounds one axis of "good."

Many teams add more (e.g. correctness/freshness SLOs for data pipelines), but **availability + latency is the standard baseline for a request-driven service** — it's essentially the RED signals (Rate is context, Errors → availability, Duration → latency) turned into objectives. Only measuring one leaves a whole class of user pain invisible.

### Q13. What is a critical user journey SLO and why prefer it over per-endpoint SLOs?

A **critical user journey (CUJ)** SLO is defined around a **key end-to-end user flow** — "a user can complete checkout" — rather than around a single technical endpoint like `POST /api/v3/payment`.

Why prefer it: users don't experience endpoints, they experience *journeys*. A checkout might touch cart, inventory, payment, and confirmation services; every individual endpoint can sit at 99.9% while the *compounded* journey success is meaningfully lower (reliability multiplies across steps). A per-endpoint SLO can look green while users routinely fail to check out.

CUJ SLOs also **focus effort on what matters** — you set tight objectives on the handful of journeys that drive the business (checkout, login, search) and looser ones elsewhere, rather than treating every endpoint as equally important. The trade-off is they're harder to measure (you must instrument the whole flow, often via traces). But they answer the question that actually matters: *"can users do the thing they came to do?"* — which no single-endpoint metric can.

### Q14. How do you aggregate SLOs across multiple services or dependencies?

Two related problems:

**Journey composed of dependencies.** If a user flow depends on services in series, their reliabilities **multiply**: three independent 99.9% services chained give ~99.7% for the journey (0.999³), not 99.9%. So a journey SLO must account for the compounding, and each service's individual SLO has to be *tighter* than the journey target you want. This is why "every service is 99.9%" doesn't yield a 99.9% product.

**Rolling up many services for reporting.** For a dashboard across a fleet you generally **don't average the percentages** — that hides the failing service. Better to report per-service SLO status and error-budget burn, and/or weight by traffic/importance. Averaging "one service at 100% and one at 98%" to "99%" obscures a real fire.

The senior point: **reliability composes multiplicatively down a dependency chain**, so set component SLOs with the end-to-end journey budget in mind, and report rollups in a way that surfaces the weakest link rather than smoothing it away.

### Q15. What are the most common mistakes teams make with SLOs?

The greatest hits:

- **Measuring the wrong thing** — an SLI on internal state (CPU, queue depth) instead of user experience. Green dashboard, unhappy users.
- **Using averages instead of percentiles** for latency — hides the tail users actually feel.
- **Too-lenient SLI/denominator** — excluding real failures or setting a target so loose it never triggers; the SLO becomes decorative.
- **Vanity targets** — picking 99.99% because it sounds good, then having no error budget and freezing constantly (or ignoring the SLO).
- **Confusing SLA and SLO** — setting the internal SLO equal to the contractual SLA, so you breach the customer promise the moment you breach internally, with no buffer.
- **No error budget policy** — a budget nobody's obligated to act on changes nothing.
- **Too many SLOs** — an SLO on every endpoint dilutes focus; concentrate on critical journeys.
- **Set and forgotten** — never revisiting targets as the product and user expectations change.

The meta-mistake: treating SLOs as a **reporting ritual** rather than a **decision-making tool.** If your SLO never changes what you ship or when you freeze, it isn't doing its job.

### Q16. How do you report on SLOs and error budgets?

The goal is to make the **error budget legible and actionable**, not to produce a pretty chart nobody acts on. Effective SLO reporting shows:

- **Current SLI vs SLO** — are we meeting the target right now, over the window.
- **Error budget remaining** — the headline number: "we have 40% of this window's budget left." This is what drives ship/freeze decisions, so it's front and center.
- **Burn rate / trend** — how fast the budget is being consumed; a steep line means trouble even if budget remains (previews burn-rate alerting).
- **Budget consumption by cause** — which incidents/deploys spent the budget, so you know where to invest.

Audience matters: engineers want burn rate and per-service detail; leadership/product want "are we healthy and can we keep shipping?" Keep both views. And tie the report to the **error budget policy** — the report is what triggers the freeze, so it has to be trusted and timely. A good SLO dashboard is one a team *checks before deciding what to do next*, not one they glance at in a monthly review.

### Q17. Give a concrete worked example of an availability SLO end to end.

Take an API service `job="api"`:

- **SLI:** `good = requests with status < 500`, `valid = all requests except health checks`. So the ratio is non-5xx responses over valid requests.
- **SLO:** 99.9% over a rolling 28-day window.
- **Error budget:** 0.1% of valid requests may fail — at, say, 100M requests/28d, that's 100,000 failed requests allowed.

Measured in Prometheus:

```promql
# 28-day availability SLI
sum(rate(http_requests_total{job="api", code!~"5.."}[28d]))
  /
sum(rate(http_requests_total{job="api"}[28d]))
```

- **Operating it:** if a bad deploy causes 30,000 failed requests in an hour, we've burned 30% of the month's budget in one incident — that's a signal to slow down and probably a burn-rate alert fires. If after three weeks we've used only 10% of the budget, we have room for a risky migration.
- **Policy:** budget exhausted → feature freeze until it recovers; SLO (99.9%) sits tighter than the customer SLA (say 99.5%) so we react well before owing credits.

That's the full loop: measurable SLI, targeted SLO, quantified budget, and a policy that turns the number into decisions.
## Alerting on SLOs & Burn Rate

### Summary

**What this topic covers**

How to build an alerting strategy that pages humans for the right reasons and stays quiet otherwise. This topic is about the philosophy shift from **cause-based** alerting ("CPU is at 90%", "a disk is filling") to **symptom-based** alerting ("users are seeing errors", "we are breaching our SLO"), and the concrete math that makes symptom-based paging precise: the **error budget** (`1 − SLO`) and the **burn rate** (how fast that budget is being consumed). The 16 questions here cover why naive threshold alerts are simultaneously too noisy and too slow, the Google SRE workbook's **multi-window, multi-burn-rate** approach, how to express burn-rate conditions in PromQL, the page-vs-ticket-vs-nothing decision, the properties of a good alert, alerting on missing data, and the operational discipline of deleting alerts that don't earn their place. If you can only get one thing right in an on-call setup, it's this: **page on symptoms, size the alert by burn rate.**

**Mental model**

An error budget is money. If your SLO is 99.9% availability over 30 days, you are *allowed* to be bad 0.1% of the time — that's your budget, about 43 minutes a month. Burn rate is your spending velocity. A burn rate of **1** means you're spending the budget exactly on pace to hit zero at the end of the window — sustainable, not an emergency. A burn rate of **14.4** means you'd exhaust an entire month's budget in about two days (30 days ÷ 14.4 ≈ 2 days) — that is a fire, page someone now. The alert threshold is therefore not "error rate > X%" but "you are burning budget fast enough that, left unchecked, you'll blow the SLO." You combine a **long window** (confirms the burn is real, not a blip) with a **short window** (so the alert resets quickly once the incident is over). Fast, big burns page; slow, grinding burns open a ticket. Everything else stays silent.

**Key terms**

- **SLI** — a Service Level Indicator: a ratio of good events to valid events (e.g. `non-5xx requests / total requests`).
- **SLO** — a Service Level Objective: a target for an SLI over a window (e.g. 99.9% over 30 days).
- **Error budget** — `1 − SLO`; the allowed amount of "bad" (0.1% = ~43m/30d for three nines).
- **Burn rate** — the multiple of the sustainable error rate you're currently running at; burn rate 1 exhausts the budget exactly at window end.
- **Symptom-based alerting** — page on user-facing impact (errors, latency), not on internal causes (CPU, memory).
- **Cause-based alerting** — page on a specific internal condition; useful as a *dashboard* signal, dangerous as a *pager* trigger.
- **Multi-window multi-burn-rate** — pairing a short and long window at several burn-rate thresholds to trade off precision and reset speed.
- **Page** — wake a human now; reserved for urgent, actionable, user-impacting problems.
- **Ticket** — non-urgent, needs attention in hours/days (slow burn).
- **`for` duration** — Prometheus clause requiring a condition to hold N minutes before firing; kills transient flapping.
- **`absent()`** — PromQL function that fires when an expected series stops existing (alert on missing data).
- **Alert fatigue** — desensitisation from too many low-value pages; the failure mode good alerting prevents.

**Why interviewers ask this**

This is the single strongest senior/junior discriminator in an SRE interview. Juniors alert on causes — every CPU spike, every restarted pod, every queue depth — and end up with a pager that cries wolf until nobody trusts it. Seniors alert on symptoms tied to an SLO and can defend *why* each page is worth waking a human. The burn-rate question specifically tests whether you understand that alerting is an **economics** problem (spending a budget), not a threshold problem. Interviewers also probe the "what's wrong with this alert" reflex: given `error_rate > 1%`, can you explain that it's both too noisy (fires on a 30-second blip) and too slow (a sustained 0.5% error rate silently eats your whole budget without ever tripping it)? The ability to reason about false-positive vs false-negative trade-offs, and to say "delete that alert, it isn't actionable," is what the interview is really measuring.

**Common confusions**

- "Burn rate 1 is bad" — no, burn rate 1 is *sustainable*; you'll finish the window with exactly zero budget left. Emergencies are high multiples.
- "Alert on high CPU" — CPU is a cause, not a symptom. High CPU with healthy latency and no errors is not a customer problem; don't page on it.
- "A single threshold is enough" — one static threshold is either too sensitive (flaps) or too dull (misses slow burns). You need multiple windows/rates.
- "More alerts = safer" — the opposite. Every non-actionable alert erodes trust in the pager and hides the real one.
- "The long window makes it slow" — that's why you *pair* it with a short window; the short window both confirms and resets fast.
- "Latency and availability share one budget" — they're usually separate SLIs with separate budgets and separate alerts.

**What follows from this topic**

Firing the right alert is only half the job — the other half is routing, grouping, de-duplicating and silencing it so the page lands on the right human without a storm. That's the next topic, **Alertmanager & Alert Management**. The dashboards you link from an alert (symptom on the pager, causes on the dashboard) are covered in **Grafana & Dashboard Design**. And the SLIs/SLOs that this whole topic depends on come from the metrics pipeline — `rate()` over counters and `histogram_quantile()` over latency buckets — covered in the Prometheus and PromQL topics.

### Q1. What is the difference between cause-based and symptom-based alerting, and which should page?

**Cause-based** alerts fire on internal conditions: CPU > 90%, disk 80% full, a pod restarted, replication lag high. **Symptom-based** alerts fire on user-facing impact: requests are failing, latency is over budget, the SLO is burning.

Page on **symptoms**. The reason is that there are a hundred possible causes for any given symptom, and most causes don't actually hurt users. A box can sit at 95% CPU all day while serving every request in 50ms — paging on that just trains people to ignore the pager. Conversely, users can be getting 500s for a reason you never wrote a cause-alert for.

The rule: **page on what the user feels, use causes as diagnostics.** Cause metrics belong on dashboards and in runbooks — the things you look at *after* a symptom alert wakes you — not on the pager themselves. A useful heuristic: "if this fired and users were completely fine, would I be annoyed to be woken?" If yes, it shouldn't page.

### Q2. What is an error budget and how do you compute it?

An error budget is the amount of unreliability you're *allowed* before you've missed your SLO. It's simply `1 − SLO`.

```text
SLO = 99.9% availability over 30 days
Error budget = 1 − 0.999 = 0.001 = 0.1%

Total time in 30 days ≈ 43,200 minutes
Budget = 0.1% × 43,200 ≈ 43.2 minutes of "bad" per 30 days
```

For a request-based SLI it's expressed in requests, not minutes: if you serve 100M requests in the window, a 99.9% SLO gives you a budget of 100,000 failed requests.

The budget is powerful because it's a shared currency. It turns "is reliability good enough?" into "how much budget is left?" — which is a number both engineering and product can reason about. It also reframes reliability as something you *spend*: shipping fast, running risky experiments, and taking planned maintenance all draw down the same budget as incidents do.

### Q3. Define burn rate. What does a burn rate of 1 mean versus 14.4?

**Burn rate** is how fast you're consuming the error budget, expressed as a multiple of the "sustainable" rate.

- **Burn rate 1** — you're spending the budget exactly on pace to exhaust it precisely at the end of the SLO window. Sustainable. Not an emergency.
- **Burn rate 2** — you'll exhaust the whole window's budget in half the window.
- **Burn rate 14.4** — the classic Google SRE number. `30 days / 14.4 ≈ 2 days`, so at this rate you burn an entire month's budget in about two days. That's a fast-burn emergency: page now.

The formula: `burn rate = (observed error rate) / (error budget as a fraction)`. If your SLO is 99.9% (budget 0.1%) and you're currently erroring at 1.44%, your burn rate is `0.0144 / 0.001 = 14.4`.

The elegance is that burn rate normalises across SLO targets. "Burn rate 14.4" means the same urgency whether your SLO is 99% or 99.99% — the raw error percentage differs, but the *speed at which you're heading for a breach* is the same.

### Q4. What's wrong with a simple threshold alert like `error_rate > 1%`?

It fails in both directions at once.

**Too noisy**: a single bad deploy, a 20-second network blip, or one flaky dependency can push error rate over 1% for a moment. With no duration requirement, that fires a page for something already self-healed by the time you open your laptop.

**Too slow / too blind**: a *sustained* 0.9% error rate never trips the 1% threshold, yet if your budget is 0.1% you're burning it at 9× and will blow the SLO in days. The static threshold is completely silent while you slowly bleed out.

It's also **untethered from the SLO**. Why 1%? Why not 0.5% or 2%? A raw threshold is an arbitrary number with no relationship to how much budget you actually have or how fast you're spending it. Burn-rate alerting fixes all three: it fires on *velocity relative to the budget*, uses windows to filter blips, and catches slow burns that thresholds miss.

### Q5. Explain the multi-window, multi-burn-rate alerting approach from the Google SRE workbook.

The idea is to combine **multiple burn-rate thresholds** (each mapped to a severity) with **paired long and short windows** (to balance precision against reset speed).

**Multi-burn-rate**: you define several tiers. A very fast burn (e.g. 14.4× over a short window) pages immediately — you'll be out of budget in ~2 days. A slower burn (e.g. 1× over a long window) opens a ticket — real, but not tonight's problem.

**Multi-window**: for each tier you require *both* a long window and a short window to be over threshold. The **long window** gives precision — it confirms the burn is genuinely sustained, not a spike, which suppresses false positives. The **short window** gives fast **reset** — once the incident is fixed, the short window drops below threshold quickly and the alert clears, instead of the long window keeping it firing for another hour.

A common configuration:

| Severity | Long window | Short window | Burn rate | Budget consumed |
|---|---|---|---|---|
| Page (fast) | 1h | 5m | 14.4 | ~2% in 1h |
| Page (medium) | 6h | 30m | 6 | ~5% in 6h |
| Ticket (slow) | 3d | 6h | 1 | ~10% over 3d |

The short window is typically 1/12th of the long window. You alert only when both are hot, which is what gives you "sensitive to real burns, immune to blips, fast to reset."

### Q6. Write a PromQL burn-rate alert.

Assume an SLI recording rule that yields the error ratio over a window. First, express the error ratio at two windows, then require both to exceed the burn-rate threshold.

```yaml
groups:
  - name: slo-burn
    rules:
      - alert: MyServiceErrorBudgetFastBurn
        expr: |
          (
            job:slo_errors:ratio_rate1h{job="api"} > (14.4 * 0.001)
            and
            job:slo_errors:ratio_rate5m{job="api"} > (14.4 * 0.001)
          )
        for: 2m
        labels:
          severity: page
        annotations:
          summary: "Fast error-budget burn on api (14.4x)"
          runbook: "https://runbooks.acme/api-slo"
```

Here `0.001` is the error budget (1 − 99.9%) and `14.4` is the burn-rate threshold, so the alert fires when the observed error ratio exceeds `0.0144` (1.44%) on **both** the 1h and 5m windows. The recording rules feeding it:

```yaml
      - record: job:slo_errors:ratio_rate5m
        expr: |
          sum by (job) (rate(http_requests_total{code=~"5.."}[5m]))
            /
          sum by (job) (rate(http_requests_total[5m]))
```

Recording rules matter here: computing multi-window ratios inline in every alert is expensive, so precompute `ratio_rate5m`, `ratio_rate1h`, `ratio_rate6h`, `ratio_rate3d` once and reference them.

### Q7. How do you decide between page, ticket, and no alert?

Map it to burn severity and urgency:

| Response | When | Example |
|---|---|---|
| **Page** | Fast burn, user impact now, needs a human *immediately* | 14.4× burn over 1h/5m |
| **Ticket** | Slow burn or degradation that needs attention in hours/days | 1× burn over 3d/6h |
| **No alert** | Not actionable, no user impact, or self-healing | single pod restart, transient CPU spike |

The gate for **page** is strict: it must be urgent, actionable, and user-impacting. If a human can't do anything useful right now, it's at most a ticket. If it self-heals or doesn't touch users, it's a dashboard line, not an alert at all.

A good discipline: default new conditions to *no alert*, promote to *ticket* only when you've been bitten, and promote to *page* only when you can name the customer harm and the human action. Demote aggressively in the other direction whenever an alert fires and the answer was "nothing to do."

### Q8. What are the properties of a good alert?

Three non-negotiables:

- **Actionable** — there is a clear, human action to take. If the response is "acknowledge and go back to sleep," it's not an alert, it's noise.
- **Urgent** — it needs handling *now*, not in the morning. Non-urgent things are tickets.
- **User-impacting (symptom-based)** — it reflects something a customer feels, not an internal curiosity.

Supporting properties: it should **link to a runbook** and the relevant cause dashboards; it should have a clear **owner/team**; and it should be **rare** — a pager that fires ten times a night is a broken pager regardless of how correct each alert is.

The litmus test I use in interviews: for any proposed alert, ask "what does the on-call person *do* when this fires, and would they be angry to be woken for it?" If you can't answer the first or the answer to the second is "yes," don't make it page.

### Q9. How do you reduce false positives and flapping?

**`for` duration** is the primary tool: require the condition to hold continuously for N minutes before the alert fires. A 20-second blip never trips a `for: 5m` alert.

```yaml
      - alert: HighLatency
        expr: histogram_quantile(0.99, sum by (le) (rate(http_request_duration_seconds_bucket{job="api"}[5m]))) > 0.5
        for: 10m
```

**Longer evaluation windows** smooth out spikes — `rate(...[5m])` is far less jittery than `rate(...[1m])`.

**Hysteresis** — fire at one threshold, clear at a lower one — prevents a metric hovering on the boundary from firing/clearing/firing repeatedly. The multi-window approach gives you a form of this naturally (long window to fire, short window to clear).

**Aggregation** — alert on `sum by (service)` rather than per-pod, so one bad pod in a fleet of fifty doesn't page you.

And the blunt instrument: if an alert flaps despite all this and isn't actionable, **delete it**. A flapping alert that nobody acts on is worse than no alert.

### Q10. Why alert on the symptom but link to the cause?

Because symptoms are stable and finite, while causes are unbounded. There's essentially one symptom that matters ("users are getting errors / slow responses"), but dozens of possible causes (bad deploy, dependency outage, DB saturation, cache stampede, DNS). If you try to write a cause-alert for every failure mode, you'll never cover them all *and* you'll drown in noise for the causes that don't actually hurt anyone.

So the pattern is: **the alert fires on the symptom; its annotations link to the cause dashboards and the runbook.** The page says "api p99 latency is over budget"; the linked dashboard shows CPU, DB connections, upstream latency, recent deploys — everything the responder needs to *find* the cause. This keeps the pager small and trustworthy while still giving fast diagnosis.

```yaml
        annotations:
          summary: "api availability SLO burning fast"
          dashboard: "https://grafana.acme/d/api-red"
          runbook: "https://runbooks.acme/api-slo-burn"
```

### Q11. How do you alert on missing data?

A metric that stops arriving is often *worse* than a bad value — it usually means the exporter died, the scrape broke, or the whole service is down and no longer emitting. A threshold alert like `error_rate > 0.01` will never fire on missing data because there's no series to evaluate.

Use **`absent()`**:

```yaml
      - alert: ApiMetricsMissing
        expr: absent(up{job="api"} == 1)
        for: 5m
        labels:
          severity: page
        annotations:
          summary: "No healthy api targets are reporting — scrape or service down"
```

`absent()` returns a value only when its argument has *no* matching series, so it fires exactly when the data disappears. `absent_over_time(...[10m])` is the range-vector variant for "hasn't reported in the last 10 minutes."

This pairs with the **dead-man's-switch / watchdog** pattern (covered in the Alertmanager topic): an always-firing alert whose *absence* downstream tells you the whole pipeline is broken.

### Q12. Should latency and availability share an error budget?

Usually no — they're separate SLIs with separate budgets and separate alerts. Availability answers "did the request succeed?" (ratio of non-5xx to total). Latency answers "was it fast enough?" (ratio of requests served under some threshold, e.g. under 300ms).

They fail independently and require different responses. A service can be 100% available while being unusably slow, or fast while returning errors. Bundling them into one budget hides which dimension is degrading and muddies the burn-rate math.

The standard approach is a **latency SLI as a ratio**, not as a raw percentile: "99% of requests complete in under 300ms over 30 days." That gives you a good/valid ratio you can compute a budget and burn rate on, exactly like availability:

```promql
sum(rate(http_request_duration_seconds_bucket{le="0.3",job="api"}[30m]))
  /
sum(rate(http_request_duration_seconds_count{job="api"}[30m]))
```

Each SLO then gets its own multi-burn-rate alerts.

### Q13. Why don't you alert on every log line or every error?

Because volume without impact is noise. A single error log means almost nothing — every healthy service emits errors continuously (retried timeouts, one bad client, a 404 from a scanner). Paging on individual errors guarantees a pager that fires constantly and gets ignored.

What matters is the **rate and ratio** of errors relative to a budget, aggregated across the fleet. That's why you alert on `sum(rate(errors))/sum(rate(total))` crossing a burn-rate threshold, not on the existence of an error. One error in a million requests is healthy; the same error at 2% of requests is an incident — and only the burn-rate framing distinguishes them.

Logs are for *investigation after* a symptom alert fires, not for triggering pages. If you find yourself wanting to alert on a specific log string, ask whether it should instead be a counter metric with a threshold, or whether it belongs on a dashboard.

### Q14. Walk me through debugging a service that's paging on a fast SLO burn.

**1. Confirm the symptom.** Open the RED dashboard for the service. Is it errors, latency, or both? Check the burn is real and still active (the short window should still be hot) versus already recovering.

**2. Scope it.** Is it all traffic or a subset? Slice by endpoint, region, version/deploy label, and downstream dependency. A burn concentrated on `version="v2.3.1"` screams bad deploy; one concentrated on one dependency screams upstream outage.

**3. Correlate with change.** Check deploy annotations on the graph (covered in Grafana). Most incidents correlate with a recent change — a deploy, a config push, a feature flag. If the burn started at 14:32 and there's a deploy annotation at 14:31, you have your lead.

**4. Follow the cause links.** From the alert's linked dashboards, walk the golden signals of dependencies: DB connections/latency, cache hit rate, queue depth, upstream error rates.

**5. Mitigate before you fix.** Roll back the deploy, shift traffic, or shed load to stop the burn — restore the budget first, root-cause after.

**6. Confirm recovery.** Watch the short-window burn drop below threshold; the alert should auto-clear. Then write the postmortem.

### Q15. When and how do you delete a bad alert?

Aggressively, and as a routine hygiene practice. An alert earns deletion when it repeatedly fires and the responder's action is "nothing" — it's not actionable, so by definition it shouldn't page.

Signals an alert should go:
- It fires often and gets acknowledged-and-ignored every time.
- Nobody can point to the runbook or the action.
- It's cause-based and the cause routinely occurs without user impact.
- It duplicates another alert that already catches the same symptom.

Process: review pager volume regularly (per-alert fire counts, ack-without-action rate). For each noisy alert, either **fix** it (add `for:`, raise the threshold, move to symptom-based, aggregate), **demote** it (page → ticket → dashboard), or **delete** it. Track alert count as a metric — a growing alert count with a flat incident count means you're accreting noise. Deleting a bad alert is not a failure; keeping one that trains people to ignore the pager is.

### Q16. What does "every alert must be actionable" mean in practice, and how do you enforce it?

It means: **if the on-call engineer can't do anything useful in response, it must not page.** Every page should map to a concrete action — roll back, scale up, fail over, investigate a specific dependency, follow a runbook.

In practice this is enforced structurally:

- **Runbook required.** No alert ships to the pager without a linked runbook describing the action. If you can't write the runbook, you don't understand the alert well enough to page on it.
- **Postmortem review.** Every incident review asks "was the page actionable? did we do the right thing? should this stay a page?"
- **Regular alert audits.** Periodically walk every paging alert and re-justify it against actionable + urgent + user-impacting.
- **Demotion path.** Anything failing the test moves to ticket or dashboard rather than lingering as noise.

The cultural point: the pager is a shared trust resource. Every non-actionable page spends that trust, so the real cost of a bad alert isn't the one interruption — it's that the *next*, genuine page is more likely to be ignored.

## Alertmanager & Alert Management

### Summary

**What this topic covers**

Once Prometheus decides an alert should fire, something has to turn that firing alert into the *right notification to the right human without a storm*. That's **Alertmanager**. This topic covers the clean separation of concerns (Prometheus evaluates rules and fires; Alertmanager routes, groups, deduplicates, inhibits, silences and delivers), the **routing tree**, **grouping** (`group_by`, `group_wait`, `group_interval`, `repeat_interval`), **inhibition**, **silences**, **deduplication across HA Prometheus replicas**, **receivers/integrations** (PagerDuty, Opsgenie, Slack, email, webhook), notification **templating**, Alertmanager's own **high availability** via gossip clustering, **on-call & escalation**, the **dead-man's-switch / watchdog** pattern, routing by team/severity, maintenance windows, and testing. The 15 questions run from "what does Alertmanager even do that Prometheus doesn't" to designing an HA routing setup that survives a partial outage without either flooding or dropping pages.

**Mental model**

Think of two machines with one job each. **Prometheus** is the *decision engine*: it evaluates alerting rules against the TSDB and, for each firing rule, pushes an alert to Alertmanager on every evaluation. **Alertmanager** is the *delivery engine*: it takes the raw stream of firing alerts and shapes it into humane notifications. It groups related alerts into one message (so a rack failure sends one page, not fifty), deduplicates identical alerts arriving from redundant Prometheus replicas, suppresses alerts made redundant by a bigger one (inhibition — "cluster down" mutes every per-service alert underneath it), honours maintenance silences, and routes each alert down a tree to the receiver for the owning team at the right severity. The mental split to hold: **Prometheus decides *whether*, Alertmanager decides *who, how, and how often*.**

**Key terms**

- **Alertmanager** — the component that routes, groups, dedups, inhibits, silences and delivers alerts fired by Prometheus.
- **Routing tree** — a tree of `route` nodes matching on labels; an alert walks it to find its receiver(s).
- **Receiver** — a named notification target (PagerDuty, Slack, email, webhook, etc.).
- **Grouping** (`group_by`) — batching alerts sharing label values into a single notification.
- **`group_wait`** — how long to wait before sending the first notification for a new group (lets related alerts arrive together).
- **`group_interval`** — minimum time before sending an *updated* notification for an existing group.
- **`repeat_interval`** — how long before re-notifying about an alert that's still firing.
- **Inhibition** — suppressing lower-priority alerts while a higher-priority one fires.
- **Silence** — a temporary mute by label matcher, e.g. during maintenance.
- **Deduplication** — collapsing identical alerts from HA Prometheus replicas into one notification.
- **Gossip/mesh clustering** — how HA Alertmanager instances coordinate so only one notification is sent.
- **Watchdog / dead-man's switch** — an always-firing alert whose *absence* proves the pipeline is broken.

**Why interviewers ask this**

Firing correct alerts (previous topic) is worthless if the delivery is broken — a common real-world failure is a perfectly good alert that pages the wrong team, or a rack outage that sends 200 simultaneous pages and buries the one that matters. Interviewers use this topic to test whether you understand that **alert *management* is a distinct discipline** from alert *definition*. Juniors think "Prometheus sends the Slack message"; seniors know Prometheus never talks to Slack — Alertmanager does, and they can explain the grouping timers, inhibition rules, and HA dedup that stand between a firing rule and a human's phone. The strongest signal is the ability to design a routing tree and grouping strategy that survives a large correlated failure gracefully, plus knowing the watchdog pattern that catches the scariest failure of all: the monitoring pipeline silently dying.

**Common confusions**

- "Prometheus sends the Slack/PagerDuty notification" — no, Prometheus only pushes firing alerts to Alertmanager; Alertmanager owns all delivery.
- "Silences and inhibition are the same" — silences are manual/time-bound mutes by matcher; inhibition is automatic suppression driven by *another firing alert*.
- "`repeat_interval` controls the first notification" — that's `group_wait`; `repeat_interval` controls re-notification of a still-firing alert.
- "Run one Alertmanager" — you run several in a gossip cluster for HA; they dedup so you still get one notification.
- "HA Prometheus means duplicate pages" — only if you don't point both replicas at the same Alertmanager cluster, which dedups them.
- "Everyone should get every alert" — the anti-pattern; route by team and severity so people see only what they own.

**What follows from this topic**

This is the delivery half of the alerting story whose decision half is **Alerting on SLOs & Burn Rate** — the burn-rate rules there fire the alerts that this topic routes. The `severity: page` / `severity: ticket` labels set on those rules are exactly what the routing tree here matches on. And when responders act on a page, they jump to the **Grafana** dashboards linked in the alert annotations. Together these three topics form the operational loop: metrics → SLO burn alert → routed page → dashboard → mitigation.

### Q1. What is the separation of concerns between Prometheus and Alertmanager?

**Prometheus** evaluates alerting rules on a schedule. When a rule's expression is true (for its `for:` duration), Prometheus marks the alert **firing** and sends it — on every evaluation cycle, repeatedly — to its configured Alertmanager(s) over HTTP. That's the entire extent of Prometheus's job: *decide which alerts are firing and forward them.*

**Alertmanager** receives that stream of firing alerts and does everything else: it **groups** related alerts, **deduplicates** identical ones (crucial with HA Prometheus), applies **inhibition** and **silences**, walks the **routing tree** to pick receivers, and finally **delivers** notifications to PagerDuty/Slack/email/etc. with rate limiting via the grouping timers.

Why split them? Because delivery logic (who to page, how to batch, how to dedup across replicas, quiet hours) changes far more often and lives at a different layer than metric evaluation. Keeping delivery in a separate, clusterable component means you can run redundant Prometheis and redundant Alertmanagers independently, and change routing without touching your metric rules.

### Q2. Explain the Alertmanager routing tree.

The routing tree is a tree of `route` nodes. Every incoming alert enters at the **root route** and walks down, matching child routes by label. The first matching branch (or branches, with `continue: true`) determines the **receiver** and grouping behaviour. Child routes inherit the parent's settings unless they override them.

```yaml
route:
  receiver: default-slack        # fallback
  group_by: [alertname, cluster]
  routes:
    - matchers: [ severity="page" ]
      receiver: pagerduty
      routes:
        - matchers: [ team="payments" ]
          receiver: pagerduty-payments
    - matchers: [ severity="ticket" ]
      receiver: jira
    - matchers: [ team="data" ]
      receiver: data-slack
```

Key mechanics:
- **Matching** is on labels (`severity`, `team`, `job`, etc.) set on the alert.
- **Nesting** lets you route broadly (all pages → PagerDuty) then narrow (payments pages → the payments PD service).
- **`continue: false`** (the default) stops at the first matching sibling; **`continue: true`** lets an alert also match later siblings — useful to send one alert to both the owning team *and* a central Slack channel.
- The root receiver is the catch-all so nothing is ever silently dropped.

### Q3. How does grouping work, and what do the three timers do?

**Grouping** batches alerts that share the labels in `group_by` into a single notification. If a rack fails and 50 pods on it start alerting, `group_by: [cluster, rack]` collapses them into *one* page listing 50 alerts instead of 50 separate pages.

The three timers control the cadence:

- **`group_wait`** (e.g. 30s) — when a *new* group first appears, wait this long before sending the initial notification. This lets other alerts that are about to fire join the same batch, so the first page already contains the whole storm.
- **`group_interval`** (e.g. 5m) — once a group has notified, wait at least this long before sending an *updated* notification when the group's membership changes (new alerts added / some resolved).
- **`repeat_interval`** (e.g. 4h) — for an alert that's *still firing* with no change, how long before re-notifying as a reminder.

```yaml
route:
  group_by: [alertname, cluster]
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 4h
```

Tuning: short `group_wait` for fast first-page, generous `repeat_interval` to avoid nagging on a known-ongoing incident.

### Q4. What is inhibition and when do you use it?

**Inhibition** suppresses notifications for lower-priority alerts while a related higher-priority alert is firing. It prevents a big failure from also paging you for all its downstream symptoms.

Classic example: a whole cluster goes down. That fires one `ClusterDown` alert *and* a `ServiceUnreachable` alert for every service in it. You want the one `ClusterDown` page, not 80 service pages. An inhibition rule says "while `ClusterDown` fires for a cluster, suppress `ServiceUnreachable` alerts sharing that `cluster` label."

```yaml
inhibit_rules:
  - source_matchers: [ alertname="ClusterDown" ]
    target_matchers: [ alertname="ServiceUnreachable" ]
    equal: [ cluster ]
```

`source` is the higher-priority alert; `target` is what gets muted; `equal` lists labels that must match between them so you only suppress the *related* ones (same cluster), not every service everywhere. Another common use: a `severity="critical"` alert inhibits the `severity="warning"` version of the same condition. Inhibition is automatic and driven by other alerts — unlike silences, which are manual.

### Q5. What are silences and how do they differ from inhibition?

A **silence** is a manual, time-bounded mute defined by label **matchers**. You create one when you *know* an alert is about to fire and don't want to be paged — most often during planned maintenance, a known deploy, or while actively working an incident.

```bash
# Silence all alerts for the payments service for a 2h maintenance window
amtool silence add service="payments" \
  --duration="2h" \
  --comment="DB migration maintenance - JIRA-1234" \
  --author="alice"
```

Difference from inhibition:

| | Silence | Inhibition |
|---|---|---|
| Trigger | Manual, human-created | Automatic, driven by another firing alert |
| Scope | Matchers you specify | source→target rule with `equal` labels |
| Duration | Fixed time window | As long as the source alert fires |
| Use case | Planned maintenance, known noise | Suppress downstream symptoms of a bigger failure |

Silences should always carry an author and a comment (ticket link) so it's auditable *why* something was muted — an unexplained silence is how a real outage gets missed.

### Q6. How does Alertmanager deduplicate alerts from HA Prometheus replicas?

You run Prometheus in HA by having two (or more) identical replicas scraping the same targets and evaluating the same rules. Both will independently fire the *same* alert and send it to Alertmanager. Without dedup you'd get double pages.

Alertmanager deduplicates based on the alert's **label set (its fingerprint)**. Two alerts with identical labels are considered the same alert regardless of which Prometheus sent them, so Alertmanager collapses them and notifies once. The key requirement: **both Prometheus replicas must point at the same Alertmanager cluster**, and their alerts must carry identical labels (don't add a per-replica label like `replica="a"` to alerts, or they'll look distinct and both notify).

```yaml
# In each Prometheus, point at the whole Alertmanager cluster:
alerting:
  alertmanagers:
    - static_configs:
        - targets: [alertmanager-0:9093, alertmanager-1:9093, alertmanager-2:9093]
```

This is why external labels used for replica identification are typically *stripped* from alerts or handled so the fingerprints match.

### Q7. What receivers and integrations does Alertmanager support?

Alertmanager ships native integrations plus a generic webhook for everything else:

- **PagerDuty / Opsgenie / VictorOps** — incident management with escalation and on-call rotations; the usual target for `severity="page"`.
- **Slack / Microsoft Teams** (via webhook) — chat notifications for `severity="ticket"` or team channels.
- **Email** — simple, good for low-urgency or as a fallback.
- **Webhook** — POSTs the alert JSON to any HTTP endpoint; the escape hatch for custom systems, ChatOps bots, or ticketing (Jira) via a small adapter.

```yaml
receivers:
  - name: pagerduty-payments
    pagerduty_configs:
      - service_key: <redacted>
        severity: '{{ .CommonLabels.severity }}'
  - name: team-slack
    slack_configs:
      - api_url: <webhook-url>
        channel: '#payments-alerts'
        title: '{{ .CommonAnnotations.summary }}'
```

Routing decides *which* receiver: pages go to PagerDuty (which handles the phone call and escalation), while informational alerts go to Slack or email. The same alert can hit multiple receivers using `continue: true` in the route.

### Q8. How do you template notifications?

Alertmanager uses Go templates to format notification content from the alert's labels and annotations. Templating turns a raw alert into a readable, actionable message with the summary, affected instances, and links to runbook and dashboard.

```yaml
receivers:
  - name: team-slack
    slack_configs:
      - channel: '#alerts'
        title: '[{{ .Status | toUpper }}] {{ .CommonLabels.alertname }}'
        text: >-
          {{ range .Alerts }}
          *{{ .Annotations.summary }}*
          Severity: {{ .Labels.severity }} | Service: {{ .Labels.job }}
          <{{ .Annotations.runbook }}|Runbook> · <{{ .Annotations.dashboard }}|Dashboard>
          {{ end }}
```

Key template data: `.Alerts` (the grouped alerts), `.CommonLabels` / `.CommonAnnotations` (labels shared across the group), `.Status` (firing/resolved), and per-alert `.Labels` / `.Annotations`. Best practice is to define named templates once in a shared file and reuse them across receivers so every notification has consistent structure — summary, severity, and the runbook/dashboard links the responder needs.

### Q9. How do you make Alertmanager itself highly available?

You run **multiple Alertmanager instances in a cluster** that coordinate over a **gossip (mesh) protocol**. They share notification state — which alerts have been notified, which are silenced — so that even though all your Prometheus replicas send alerts to *all* Alertmanager instances, only **one notification** is sent per alert.

```bash
alertmanager \
  --cluster.listen-address=0.0.0.0:9094 \
  --cluster.peer=alertmanager-1:9094 \
  --cluster.peer=alertmanager-2:9094
```

How it stays single-notification: the cluster uses gossip to agree on who sends. There's a small dedup/notification delay so peers can learn a notification is already going out. If one Alertmanager dies, the others still hold the shared state and keep delivering — no single point of failure between a firing alert and the pager.

The combined HA picture: **N Prometheus replicas** (redundant evaluation) all pointing at **M Alertmanager instances** (redundant delivery, gossip-deduped). Losing any single node in either tier drops neither alerts nor produces duplicate pages.

### Q10. How do on-call rotations and escalation fit in?

Alertmanager routes to a receiver like PagerDuty/Opsgenie; **the escalation logic lives in that tool, not in Alertmanager**. This is a deliberate separation: Alertmanager decides *which team/service* gets the alert; the incident-management tool decides *which human on that team, right now, and what happens if they don't ack.*

- **Rotation** — PagerDuty/Opsgenie holds the on-call schedule (who's primary this week). Alertmanager just targets the *service*; the tool resolves it to the current on-call person.
- **Escalation policy** — if the primary doesn't acknowledge within N minutes, the tool escalates to the secondary, then the manager. Again, this is the incident tool's job.

So the flow is: Prometheus fires → Alertmanager routes `team="payments", severity="page"` to the payments PagerDuty service → PagerDuty looks up who's on-call and phones them → if no ack, PagerDuty escalates. Keeping rotation/escalation out of Alertmanager means you change on-call schedules in one place without touching monitoring config.

### Q11. What is a dead-man's switch / watchdog alert and why do you need one?

A **watchdog** (dead-man's switch) is an alert that is deliberately configured to **always be firing**. Its purpose is inverse to normal alerts: you don't care when it fires — you care when it *stops*.

```yaml
      - alert: Watchdog
        expr: vector(1)          # always true
        labels:
          severity: none
        annotations:
          summary: "This alert is always firing to verify the pipeline works."
```

It's routed to an external service that expects to *keep receiving* it (a heartbeat endpoint / dead-man's-switch service). If that service stops getting the Watchdog notification, it alerts *you* through a separate channel — because the silence means the monitoring pipeline itself is broken: Prometheus is down, Alertmanager is down, or notification delivery has failed.

This catches the scariest failure mode in all of observability: **the monitoring system dies silently and you have no alerts because the thing that sends alerts is dead.** Every normal alert assumes the pipeline works; the watchdog is the one alert that verifies that assumption.

### Q12. How do you route alerts by team and severity?

Set `team` and `severity` labels on the alerting rules, then match them in the routing tree. Severity picks the *channel and urgency*; team picks the *owner*.

```yaml
route:
  group_by: [alertname]
  receiver: fallback
  routes:
    - matchers: [ severity="page" ]
      receiver: pagerduty
      group_wait: 30s
      routes:
        - matchers: [ team="payments" ]
          receiver: pd-payments
        - matchers: [ team="search" ]
          receiver: pd-search
    - matchers: [ severity="ticket" ]
      receiver: slack-tickets
      routes:
        - matchers: [ team="payments" ]
          receiver: slack-payments
```

The rules carry the labels:

```yaml
      - alert: PaymentsSLOFastBurn
        expr: ...
        labels:
          severity: page
          team: payments
```

This two-axis routing (severity × team) is the backbone of a sane setup: urgency determines *how loud* (phone call vs Slack), ownership determines *whose problem*. Keep team ownership in the alert labels so a service moving teams is a one-line change.

### Q13. How do you handle maintenance windows?

Two approaches, and you generally use both:

**Silences (reactive/ad-hoc)** — before a known maintenance, create a silence matching the affected labels for the window's duration, with an author and ticket comment. When maintenance ends (or the silence expires), alerts flow again.

```bash
amtool silence add service="payments" cluster="prod-eu" \
  --duration="90m" --author="bob" --comment="Scheduled DB upgrade JIRA-4567"
```

**Scheduled/automated** — for recurring windows, drive silences via the Alertmanager API from your maintenance automation (CI job, change-management system) so nobody forgets to mute or, worse, forgets to un-mute. Some teams model maintenance as a metric and use inhibition (`maintenance_active{service="x"} == 1` inhibits that service's alerts).

Rules: always time-box (never open-ended), always attach author + reason, and prefer the narrowest matcher that covers the work so you don't accidentally mute unrelated services. An un-scoped or never-expiring silence is how a genuine outage during maintenance goes unnoticed.

### Q14. How do you test alert routing without waiting for a real incident?

**`amtool`** is the primary tool. It can validate config and simulate how a given alert's labels would route:

```bash
# Validate config syntax
amtool check-config alertmanager.yml

# Show which receiver a labelled alert would hit
amtool config routes test \
  --config.file=alertmanager.yml \
  severity=page team=payments

# See the full routing tree
amtool config routes --config.file=alertmanager.yml
```

Beyond that:
- **Fire a synthetic alert** directly at the Alertmanager API (`POST /api/v2/alerts`) with test labels and confirm it lands in the right channel — ideally a test receiver, not real PagerDuty.
- **Unit-test the routing** in CI: run `amtool config routes test` for a matrix of label sets and assert the expected receiver, so a routing change that would misroute pages fails the build.
- **The watchdog** continuously proves end-to-end delivery works in production.

Testing routing matters because the failure is invisible until a real page goes to the wrong team at 3am — you want to catch misrouting in CI, not in an incident.

### Q15. What's the anti-pattern of "everyone gets every alert" and how do you fix it?

The anti-pattern: a single receiver (one big Slack channel or one giant distribution list) that receives *every* alert from *every* service. It feels simple and "nothing gets missed," but it's how alert fatigue is born.

Why it fails:
- **Diffusion of responsibility** — when everyone is notified, no one owns it; each person assumes someone else will act.
- **Noise drowns signal** — the payments team scrolls past 400 alerts about services they don't own to find the one that's theirs, and eventually stops looking.
- **No urgency differentiation** — critical pages and informational tickets land in the same undifferentiated stream.

The fix is the routing tree from Q12: route by **team ownership** (you only see alerts for services you own) and **severity** (pages phone you, tickets go to Slack, info goes to a dashboard). Add grouping and inhibition so correlated failures collapse into one notification. The goal is that when your phone buzzes, it's *yours*, it's *urgent*, and it's *actionable* — which is exactly the standard from the SLO-alerting topic, now enforced at the delivery layer.

## Grafana & Dashboard Design

### Summary

**What this topic covers**

Grafana is where humans actually *look* at observability data — the visualization layer that sits on top of Prometheus, Loki, Tempo, SQL databases and cloud metrics. This topic covers what Grafana is and how it relates to (and differs from) the data stores underneath it, **datasources** and mixing them, **panel types** and choosing the right one, **template variables**, **dashboard design principles**, the reusable **RED** and **USE** dashboard patterns, handling **high-cardinality** data, **annotations**, **Grafana unified alerting** versus Prometheus/Alertmanager, **dashboards-as-code**, **exemplars** (jumping from a metric spike to a trace), thresholds and drill-down **links**, and the common mistakes that make dashboards actively misleading. The 15 questions span from "what is Grafana" to "design a reusable per-service dashboard from a template" and "why is this dashboard slow / lying to me."

**Mental model**

Grafana is a *lens*, not a *store*. It holds no metrics of its own — it queries datasources at render time and draws the results. So a "good dashboard" is really two things: good queries (efficient, correct aggregation) and good *visual communication* (the right panel, the right layout, the right defaults). The design mindset is journalistic: every panel should answer a question a responder actually asks, most-important-at-the-top, signal over decoration. The killer reusable idea is the **templated dashboard**: parameterise env/service/instance as dropdown variables, build the panels once against `$service`, and get one dashboard that works for every service instead of a hand-crafted dashboard per service that drifts and rots. And because click-ops dashboards drift, the senior move is **dashboards-as-code** — the JSON model in version control, generated from a template, reviewed in PRs.

**Key terms**

- **Datasource** — a backend Grafana queries (Prometheus, Loki, Tempo, Postgres, CloudWatch); a dashboard can mix several.
- **Panel** — a single visualization (time series, stat, gauge, table, heatmap, logs).
- **Template variable** — a `$variable` dropdown (env, service, instance) injected into queries; can repeat panels/rows.
- **RED dashboard** — Rate, Errors, Duration per service; the standard request-service view.
- **USE dashboard** — Utilization, Saturation, Errors per resource; the standard infrastructure view.
- **Annotation** — a marker on the time axis (deploy, incident) to correlate events with metric changes.
- **Exemplar** — a sampled trace ID attached to a metric bucket, letting you jump from a latency spike to the exact trace.
- **Unified alerting** — Grafana's own alerting engine that can alert across any datasource, separate from Prometheus/Alertmanager.
- **Dashboards-as-code** — defining dashboards in JSON/Grafonnet/Terraform under version control instead of clicking.
- **Threshold** — a value that changes a panel's colour (green/amber/red) to encode health at a glance.
- **High cardinality** — too many unique series; rendering thousands of lines is unreadable and slow.

**Why interviewers ask this**

Dashboards are where most engineers *touch* observability daily, so how you build them reveals your maturity fast. Juniors build vanity dashboards — dozens of panels, every metric they could find, no hierarchy, misleading axes — that look impressive and help nobody during an incident. Seniors build *sparse, purposeful* dashboards from reusable templates, know RED/USE cold, and can explain why a dashboard is slow (rendering 10k series) or lying (auto-ranged Y-axis, wrong aggregation hiding a per-instance problem). The dashboards-as-code question is a strong seniority signal: it shows you've felt the pain of click-ops drift and treat dashboards as reviewable, versioned artifacts. Interviewers also probe the boundary — "does Grafana store metrics?" (no) and "Grafana alerting vs Alertmanager?" — to check you understand Grafana is a lens over datasources, not a database.

**Common confusions**

- "Grafana stores the metrics" — no. Grafana queries datasources at render time; Prometheus/Loki/etc. hold the data.
- "One dashboard per service" — hand-built per-service dashboards drift and rot; build one templated dashboard driven by a `$service` variable.
- "More panels = better observability" — sparser is better; too many panels hide the signal.
- "Grafana alerting replaces Alertmanager" — Grafana unified alerting is an alternative engine; many shops still fire from Prometheus rules through Alertmanager. Know both.
- "A gauge/stat panel for a trend" — use time series for trends; stat/gauge for a single current value.
- "Auto Y-axis is fine" — auto-ranging can make a tiny wiggle look like a cliff; fix axes or start at zero when it matters.

**What follows from this topic**

Grafana is the human end of the loop the other two topics build: the **RED dashboard** here is exactly what you link from a burn-rate alert (Alerting on SLOs & Burn Rate) and jump to from a routed page (Alertmanager & Alert Management). Annotations correlate incidents with the deploys that caused them; exemplars connect the metrics pillar to the traces pillar. Dashboards-as-code connects to the same GitOps discipline you'd apply to alerting rules. Master this and you close the operational loop: metric → alert → page → dashboard → trace → fix.

### Q1. What is Grafana and how does it relate to Prometheus?

Grafana is an open-source **visualization and dashboarding** platform. It is *not* a time-series database — it stores no metrics itself. It connects to **datasources** and queries them at render time, then draws the results as panels.

Prometheus is one such datasource (a very common one): Prometheus scrapes and stores the metrics, and Grafana runs PromQL against it to draw graphs. The division of labour: **Prometheus = collect + store + query; Grafana = query + visualize.** Prometheus does ship a basic built-in expression browser, but it's bare; Grafana is the rich, shareable UI most teams actually use.

The important consequence of "Grafana is a lens": its performance and correctness depend entirely on the queries you write and the datasource's speed. A slow dashboard is usually a slow/expensive query, not a Grafana problem. And because it holds no data, Grafana is cheap to run redundantly and easy to reprovision — the dashboards are just JSON pointed at datasources.

### Q2. How do datasources work, and can you mix them on one dashboard?

A **datasource** is a configured connection to a backend: Prometheus, Loki (logs), Tempo (traces), a SQL database, CloudWatch/Azure/GCP metrics, Elasticsearch, and many more. Each has its own query editor (PromQL for Prometheus, LogQL for Loki, etc.).

Yes — you can **mix datasources on a single dashboard**, and even set a panel's datasource to "Mixed" to combine queries from *different* backends in one panel. This is powerful for correlation: on one dashboard you can show request rate (Prometheus metrics), the error logs behind a spike (Loki), and a slow trace (Tempo) side by side, all sharing the same time range.

```text
Panel A (Prometheus): sum(rate(http_requests_total{service="$service"}[5m]))
Panel B (Loki):       {service="$service"} |= "error"
Panel C (Tempo):      traces for service="$service"
```

The three pillars come together in the dashboard. Best practice is to set a sensible **default datasource** and use template variables so the same dashboard can point at, say, prod vs staging Prometheus by switching a dropdown.

### Q3. What panel types exist and how do you choose the right one?

| Panel | Best for | Example |
|---|---|---|
| **Time series** | Trends over time | request rate, latency, CPU over the last 6h |
| **Stat** | A single current value (big number) | current error rate, uptime % |
| **Gauge** | A value against a range/threshold | SLO budget remaining, disk % full |
| **Table** | Discrete rows / top-N | top 10 slowest endpoints, per-pod status |
| **Heatmap** | Distribution over time | latency histogram buckets over time |
| **Logs** | Raw log lines (Loki) | error logs for the selected service |

The rule: **match the panel to the question.** "How is this changing?" → time series. "What is it *right now*?" → stat or gauge. "Which are the worst?" → table. "How is the distribution shaped?" → heatmap (far better than plotting p50/p90/p99 as three lines when you want to *see* the spread). A very common junior mistake is using a gauge or stat for something inherently temporal — you lose all the trend information that makes a metric useful during an incident.

### Q4. What are template variables and why are they powerful?

Template variables are **dashboard-level dropdowns** — `$env`, `$service`, `$instance` — whose values are injected into panel queries. Instead of hardcoding `service="api"` in every panel, you write `service="$service"` and pick the service from a dropdown.

```promql
# Variable $service defined as a query:
label_values(http_requests_total, service)

# Panel query uses it:
sum(rate(http_requests_total{service="$service", env="$env"}[5m]))
```

Why they're powerful:
- **One dashboard, every service.** A single templated dashboard replaces dozens of near-identical hand-built ones.
- **Chained variables.** `$instance` can be scoped to the chosen `$service`, so the second dropdown only shows relevant options.
- **Repeating panels/rows.** A panel or whole row can *repeat* per selected value — pick three services and get three copies of the RED row, one each.
- **Ad-hoc filters.** A special variable type that lets responders add arbitrary label filters on the fly.

This is the mechanism behind the "dashboard per service from a template" pattern (Q13) — the single highest-leverage habit in dashboard building.

### Q5. What are the principles of good dashboard design?

- **Signal over noise.** Every panel earns its place by answering a real question. If nobody looks at it during an incident, delete it. Sparse beats comprehensive.
- **Most-important-at-the-top.** The golden signals / SLO health go top-left where the eye lands first; drill-down detail goes below. A responder should get the "is it broken?" answer in the top row.
- **Consistent time range.** All panels share the dashboard time range so events line up across panels — a spike in one panel aligns with the log burst in another.
- **Hierarchy.** Overview dashboard → per-service dashboard → deep-dive. Don't cram everything onto one wall of graphs.
- **Avoid dashboard sprawl.** Hundreds of overlapping, half-maintained dashboards are worse than a few good ones; prefer templated, reusable dashboards over bespoke copies.
- **Honest visualization.** Sensible axes, correct aggregation, units labelled, thresholds coloured. A dashboard that misleads under pressure is worse than none.

The test: during a real incident at 3am, does the top of this dashboard answer "what's broken and how bad?" in ten seconds? If not, redesign it.

### Q6. Describe the RED dashboard pattern.

**RED** = **Rate, Errors, Duration**, per service. It's the standard reusable dashboard for any request-driven service, and it maps directly to the user experience.

- **Rate** — requests per second the service is handling.
- **Errors** — the rate (or ratio) of failing requests.
- **Duration** — latency distribution, usually p50/p90/p99 or a heatmap.

```promql
# Rate
sum(rate(http_requests_total{service="$service"}[5m]))
# Errors
sum(rate(http_requests_total{service="$service",code=~"5.."}[5m]))
# Duration (p99)
histogram_quantile(0.99, sum by (le) (rate(http_request_duration_seconds_bucket{service="$service"}[5m])))
```

Why RED is the go-to: those three signals tell you almost everything about whether a service is healthy from the user's perspective — is it getting traffic, is that traffic succeeding, and is it fast? Combined with template variables you build **one RED dashboard** that works for every service via `$service`, and it's exactly the dashboard you link from an SLO burn-rate alert. RED is for *services*; its infrastructure counterpart is USE (next question).

### Q7. Describe the USE dashboard pattern and how it differs from RED.

**USE** = **Utilization, Saturation, Errors**, per *resource*. Where RED describes request-driven services, USE describes infrastructure resources: CPU, memory, disk, network, a queue, a connection pool.

- **Utilization** — how busy the resource is (CPU %, memory used).
- **Saturation** — how much extra work is queued/waiting (run-queue length, swap, connection-pool wait). This is the leading indicator of trouble.
- **Errors** — error events for that resource (disk errors, dropped packets).

| | RED | USE |
|---|---|---|
| Applies to | Request-driven services | Resources (CPU, disk, queue) |
| Signals | Rate, Errors, Duration | Utilization, Saturation, Errors |
| Question | "Are users being served well?" | "Is this resource healthy / overloaded?" |
| Perspective | Demand / user-facing | Supply / infrastructure |

They're complementary: RED tells you *users are seeing slow requests*; USE tells you *the DB connection pool is saturated*, which is *why*. In an incident you page on RED symptoms and diagnose with USE resources — the same symptom-vs-cause split from the alerting topic. Saturation is the star of USE because a resource can look only 70% utilized while its queue is exploding.

### Q8. How do you handle high-cardinality data in dashboards?

High cardinality — thousands of unique series (per-user, per-request-id, per-pod at scale) — breaks dashboards two ways: it's **unreadable** (nobody can parse 10,000 overlapping lines) and it's **slow/expensive** (the datasource has to fetch and Grafana has to render them all).

Fixes:
- **Aggregate in the query.** Use `sum by (service)` / `topk(10, ...)` so you plot 10 meaningful series, not 10,000. Never render an un-aggregated high-cardinality metric.
- **`topk` / `bottomk`.** Show only the worst N (`topk(10, rate(...))`) — the outliers are what you care about anyway.
- **Tables over graphs** for per-entity detail: a table of the top 20 slow endpoints is readable; 20,000 lines are not.
- **Fix it upstream.** If a label is unbounded (user_id, request_id), it usually shouldn't be a Prometheus label at all — that's the cardinality footgun. Push per-request detail into traces/logs, keep metrics low-cardinality.

The mindset: a dashboard should show *aggregates and outliers*, not every individual series. If a panel is slow, the first suspect is an un-aggregated high-cardinality query.

### Q9. What are annotations and why are they useful?

**Annotations** are markers drawn on the time axis of panels — a vertical line at a point in time with a label. The killer use is marking **deploys and incidents** so you can correlate them with metric changes.

When p99 latency jumps at 14:32 and there's a deploy annotation at 14:31, you've found your cause in one glance — no cross-referencing a separate deploy log. That single visual correlation is one of the fastest MTTR wins available.

Annotations come from:
- **Automated feeds** — your CI/CD posts a deploy annotation to Grafana on every release; incident tooling posts incident start/end.
- **Datasource annotations** — query a datasource for events (e.g. a Prometheus `deploy_timestamp` metric) and render them.
- **Manual** — a responder Ctrl-clicks to mark "started rollback here."

Best practice: automate deploy annotations across all dashboards. "Did a deploy cause this?" is the first question in most incidents, and annotations answer it instantly instead of forcing a hunt through release history.

### Q10. Grafana alerting versus Prometheus + Alertmanager — when do you use which?

There are two alerting worlds and you should know both:

**Prometheus rules + Alertmanager** — alerts are defined as PromQL rules in Prometheus, fired to Alertmanager for routing. This is the classic, GitOps-friendly, Prometheus-native path. Rules live in version control; Alertmanager owns routing/grouping/dedup (the previous topic).

**Grafana unified alerting** — Grafana has its own alerting engine that can evaluate rules across *any* datasource (Prometheus, Loki, SQL, CloudWatch), not just Prometheus. It has its own UI for defining alerts, contact points, and notification policies (its analog of Alertmanager routing), and it can even use an Alertmanager under the hood.

| | Prometheus + Alertmanager | Grafana unified alerting |
|---|---|---|
| Rule definition | PromQL in Prometheus config | Grafana UI or provisioned YAML |
| Datasources | Prometheus (and compatible) | Any datasource, mixed |
| Best fit | Prometheus-centric, GitOps rules | Multi-datasource, teams living in Grafana |

Use Prometheus+Alertmanager when you're Prometheus-centric and want alerting-as-code alongside your metrics rules; use Grafana alerting when you need to alert across heterogeneous datasources or want alerts co-located with dashboards. Many orgs run both. Either way, **provision the rules as code** rather than clicking them.

### Q11. What are exemplars and how do they connect metrics to traces?

An **exemplar** is a sampled **trace ID attached to a specific metric data point** (typically a histogram bucket). It's the bridge from the *aggregate* (metrics) to the *specific example* (a trace).

The problem it solves: your p99 latency panel shows a spike, but a percentile is an aggregate — it can't tell you *which* request was slow or *why*. Exemplars fix that. Prometheus/OpenTelemetry can record, alongside `http_request_duration_seconds_bucket`, the trace ID of an actual request that landed in each bucket. Grafana renders those as clickable dots on the graph.

So the workflow becomes: see the latency spike → click the exemplar dot on the spike → jump straight into Tempo/Jaeger to the exact slow trace → see which downstream call ate the time. That's metrics-to-traces navigation in two clicks, collapsing "something is slow" into "this specific DB call in this service is slow."

```text
Panel: histogram_quantile(0.99, ...)  ← enable "Exemplars" toggle
Dots on the line = sampled trace IDs → click → open trace in Tempo
```

Exemplars are the concrete link between the metrics pillar and the traces pillar.

### Q12. How do thresholds, colours, and links improve a dashboard?

**Thresholds and colour** encode health so you read a panel *pre-attentively* — no reading numbers, the colour tells you. A stat panel green under budget, amber approaching, red over: a responder scanning a wall of panels spots the red one instantly.

```text
Thresholds on an error-rate stat:
  green  < 0.1%
  amber  0.1% – 1%
  red    > 1%
```

Use colour meaningfully and consistently (red = bad, everywhere) and don't rely on colour alone (accessibility — pair with position/value).

**Links / drill-down** turn a dashboard into a navigable hierarchy:
- **Panel/data links** — click a series to jump to a more detailed dashboard, pre-filled with that series' labels (`$service` carried through).
- **Dashboard links** — a menu at the top linking to related dashboards (overview → per-service → logs).

The pattern is **overview → drill-down**: a high-level dashboard shows all services green/red; clicking the red one opens its RED dashboard scoped via variables; from there an exemplar opens the trace. Thresholds get you to the right panel fast; links get you from there to the root cause.

### Q13. Design a reusable "dashboard per service from a template" setup.

The goal: one dashboard definition that works for *every* service, instead of a hand-built dashboard per service that drifts.

**1. Template variables.** Define `$env` and `$service` as query variables so they populate from live data:

```promql
$env      = label_values(up, env)
$service  = label_values(up{env="$env"}, service)
```

**2. Build panels once against the variables** — a RED row using `service="$service"`:

```promql
sum(rate(http_requests_total{env="$env",service="$service"}[5m]))                       # Rate
sum(rate(http_requests_total{env="$env",service="$service",code=~"5.."}[5m]))            # Errors
histogram_quantile(0.99, sum by(le)(rate(http_request_duration_seconds_bucket{env="$env",service="$service"}[5m])))  # Duration
```

**3. Add USE rows** for the service's key resources, deploy annotations, and drill-down links to logs/traces scoped by `$service`.

**4. Store it as code** (next question) so it's versioned and provisioned, not clicked.

Now onboarding a new service costs *nothing* — it appears in the `$service` dropdown automatically because the variable is query-driven. One reviewed artifact, consistent across the whole fleet, zero per-service drift. This is the single highest-leverage dashboard habit.

### Q14. What is dashboards-as-code and why does it matter?

Dashboards-as-code means defining dashboards as **version-controlled definitions** (the Grafana JSON model, or higher-level tools like **Grafonnet** (Jsonnet), **Terraform** provider, or Grafana's file-based provisioning) instead of building them by clicking in the UI.

Why it matters:
- **No click-ops drift.** UI-built dashboards get hand-edited in place, diverge across environments, and nobody knows the canonical version. Code has one source of truth.
- **Reviewable.** Dashboard changes go through PRs like any code — you can diff, review, and catch a broken query before it ships.
- **Reproducible & templated.** Generate N per-service dashboards from one Grafonnet template; recreate an entire Grafana from git after a rebuild.
- **Auditable history.** Git blame tells you who changed that panel and why.

```jsonnet
// Grafonnet sketch — one function, many dashboards
local redRow(service) = ...;
dashboard.new('service-red')
  + dashboard.withPanels([ redRow('$service') ]);
```

The senior framing: dashboards are operational artifacts, and like alerting rules and infra, they belong in git. Click-ops is fine for exploration; anything you depend on during an incident should be code.

### Q15. What are the most common dashboard mistakes and how do you avoid them?

- **Vanity metrics.** Panels that look impressive (total requests ever, giant counters) but drive no decision. Fix: every panel answers "what would I *do* differently based on this?"
- **Too many panels.** A wall of 60 graphs where the important one is lost. Fix: sparse, hierarchical, most-important-at-top; delete unused panels.
- **Wrong aggregation.** `avg` hiding a bad instance, or averaging percentiles (which is mathematically meaningless). Fix: `sum`/`topk` appropriately; compute quantiles with `histogram_quantile`, never average pre-computed percentiles.
- **Misleading Y-axes.** Auto-ranging turns a 0.1% wiggle into a visual cliff; a non-zero baseline exaggerates change. Fix: set sensible min/max, start at zero when magnitude matters, label units.
- **High-cardinality rendering.** 10k series that are slow and unreadable (Q8). Fix: aggregate / `topk`.
- **No thresholds or context.** Numbers with no sense of good/bad. Fix: colour thresholds, sensible units, annotations for deploys.
- **Heavy/slow dashboards.** Dozens of expensive queries over long ranges hammering the datasource on every load. Fix: use recording rules for expensive queries, limit default time range, avoid un-aggregated queries, and lazy-load rows.

The through-line: a dashboard's job is *fast, honest decision support during an incident*. Anything that doesn't serve that — decoration, vanity, misleading axes, slowness — is a bug.
## Kubernetes & Cloud-Native Monitoring

### Summary

**What this topic covers**

Monitoring a Kubernetes cluster is a different problem from monitoring a fixed fleet of VMs, and this topic covers why. Kubernetes is a dynamic, declarative system: pods are created and destroyed constantly, IPs are ephemeral, workloads move between nodes, and the platform itself (the control plane) is something you have to watch. The 16 questions here cover the cloud-native monitoring stack (Prometheus and its ecosystem, the de-facto standard because Prometheus and Kubernetes are both CNCF projects designed to work together), the **kube-prometheus-stack** / **Prometheus Operator** and its CRDs (`ServiceMonitor`, `PodMonitor`, `PrometheusRule`), the layers of what to monitor (nodes via node-exporter, containers via cAdvisor, cluster object state via kube-state-metrics, the control plane, and your own apps), how service discovery finds targets in a churning cluster, applying USE/RED and the four golden signals to a cluster, common Kubernetes alerts, the metrics-server-vs-Prometheus distinction, managed offerings, and the cardinality problem that pod churn creates. If you run anything on Kubernetes, this is the observability that keeps you out of a 3am incident with no signal.

**Mental model**

Think in **layers of a stack, each with its own exporter**. Bottom to top: (1) **the node** — CPU, memory, disk, network of the physical/virtual machine, exported by **node-exporter** (a DaemonSet, one per node). (2) **the container/pod** — per-container CPU and memory actually consumed, exported by **cAdvisor**, which is built into the kubelet, so you scrape the kubelet. (3) **cluster object state** — the desired-vs-actual view of Kubernetes objects (is this Deployment's replica count met? is this pod Pending?), exported by **kube-state-metrics**, which just watches the API server and turns object state into metrics. (4) **the control plane** — apiserver, etcd, scheduler, controller-manager, each exposing `/metrics`. (5) **your application** — you instrument it and tell Prometheus where to scrape via a `ServiceMonitor` or pod annotations. The Prometheus **pull model** fits Kubernetes perfectly: Prometheus uses `kubernetes_sd` service discovery to ask the API server "what pods/endpoints exist right now?", then relabels and scrapes their IPs. Nothing pushes; targets appearing and disappearing is normal.

**Key terms**

- **Prometheus Operator** — a controller that manages Prometheus/Alertmanager instances and generates their scrape config from CRDs, so you never hand-edit `prometheus.yml`.
- **kube-prometheus-stack** — the popular Helm chart bundling Prometheus Operator, Prometheus, Alertmanager, Grafana, node-exporter, and kube-state-metrics.
- **ServiceMonitor** — CRD selecting a Kubernetes Service (by label) and declaring how to scrape its endpoints.
- **PodMonitor** — CRD selecting pods directly (for workloads with no Service).
- **PrometheusRule** — CRD defining recording rules and alerting rules declaratively.
- **node-exporter** — DaemonSet exporting node/host metrics (USE-style resource metrics).
- **cAdvisor** — per-container resource usage, built into the kubelet.
- **kube-state-metrics (KSM)** — exposes Kubernetes object state (desired vs ready replicas, pod phase, job status); NOT resource usage.
- **metrics-server** — lightweight, in-memory, short-window CPU/mem for `kubectl top` and the HPA only; not a monitoring backend.
- **kubernetes_sd + relabeling** — service discovery that queries the API server, then `relabel_configs` filter/rewrite which targets to keep and how to label them.
- **Cardinality churn** — pod restarts create new `pod`/`instance` label values, inflating time-series count.

**Why interviewers ask this**

Kubernetes monitoring separates people who deployed a Helm chart from people who understand what it does. A junior says "I installed kube-prometheus-stack and got dashboards." A senior can explain the difference between cAdvisor and kube-state-metrics without hesitating (resource usage vs object state — a very common interview trap), knows that metrics-server is not a monitoring system, understands that the pull model works because of API-driven service discovery, and can reason about why pod churn is a cardinality problem specific to Kubernetes. The signal is whether you can debug "no metrics from my new service" (relabeling, ServiceMonitor label selector, port name) and whether you understand the control plane is a first-class monitoring target, not just your workloads. SRE interviews lean heavily here because most production incidents on Kubernetes are visible first in these metrics.

**Common confusions**

- "cAdvisor and kube-state-metrics do the same thing." No — cAdvisor is *resource consumption* (this pod is using 1.5 cores); KSM is *object state* (this Deployment wants 3 replicas, has 2 ready). You need both.
- "metrics-server can back my dashboards and alerts." No — it holds only a short rolling window in memory for autoscaling and `kubectl top`; it has no storage, no history, no alerting.
- "Prometheus can't do pull in a dynamic cluster." It's the opposite — service discovery makes pull ideal; you never configure targets by hand.
- "I annotated my pod but it's a `ServiceMonitor` cluster." Annotation-based scraping and Operator CRDs are two different mechanisms; mixing them silently drops targets.
- "More labels = better dashboards." Pod churn plus high-cardinality labels is the fastest way to OOM your Prometheus.

**What follows from this topic**

This topic is where the abstract primitives — metrics, PromQL, cardinality, RED/USE, SLOs — meet a real dynamic platform. The cardinality churn problem connects directly to cost and cardinality control; the control-plane and workload alerts feed straight into Incident Response & On-Call; and continuous profiling (the next area) increasingly ships as another eBPF DaemonSet in exactly this stack. If you can monitor Kubernetes well, you can monitor almost anything.

### Q1. What does the cloud-native monitoring stack look like, and why is Prometheus the default?

The de-facto stack is **Prometheus** (scraping + TSDB + PromQL) → **Alertmanager** (routing/deduping alerts) → **Grafana** (dashboards), fed by exporters (**node-exporter**, **cAdvisor** via the kubelet, **kube-state-metrics**) and increasingly wired up by the **Prometheus Operator**. Longer-term storage and horizontal scale come from **Thanos**, **Cortex**, or **Grafana Mimir**.

Prometheus is the default for three reasons: (1) **shared lineage** — both Prometheus and Kubernetes are CNCF projects; Prometheus's pull model and `kubernetes_sd` service discovery were built for exactly this dynamic environment. (2) **pull + service discovery** fits ephemeral pods — Prometheus asks the API server what exists rather than requiring every pod to know where to push. (3) **ecosystem** — nearly every cloud-native component exposes a Prometheus `/metrics` endpoint out of the box.

The mental default: install **kube-prometheus-stack** and you get all of the above pre-wired.

### Q2. Explain the Prometheus Operator and its CRDs.

The **Prometheus Operator** is a Kubernetes controller that manages Prometheus the Kubernetes way: declaratively, via Custom Resources, instead of hand-editing `prometheus.yml`.

The key CRDs:

- **`Prometheus`** — declares a Prometheus server instance (replicas, retention, resources).
- **`ServiceMonitor`** — selects a Service by label and says "scrape its endpoints on this port/path."
- **`PodMonitor`** — selects pods directly (for workloads without a Service).
- **`PrometheusRule`** — recording and alerting rules.
- **`Alertmanager`** / **`AlertmanagerConfig`** — Alertmanager instances and routing.

The Operator **watches these CRDs and reconciles the actual Prometheus scrape config** to match — regenerating config and hot-reloading Prometheus whenever you add a ServiceMonitor. This is the big win: app teams ship a ServiceMonitor next to their Deployment and get scraped automatically; nobody edits a central config file.

```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: my-service
  labels:
    release: kube-prometheus-stack   # must match the Prometheus's serviceMonitorSelector
spec:
  selector:
    matchLabels:
      app: my-service                # selects the Service
  endpoints:
    - port: metrics                  # named port on the Service
      interval: 30s
      path: /metrics
```

### Q3. What are the layers of things you need to monitor in a Kubernetes cluster?

Five layers, each with a source:

| Layer | What | Source |
|---|---|---|
| Node / host | CPU, mem, disk, network of the machine | **node-exporter** (DaemonSet) |
| Container / pod | Actual CPU & memory used per container | **cAdvisor** (in the kubelet) |
| Object state | Desired vs ready replicas, pod phase, job status | **kube-state-metrics** |
| Control plane | apiserver, etcd, scheduler, controller-manager | each component's `/metrics` |
| Application | Your RED metrics, business metrics | your instrumentation + ServiceMonitor |

If you only watch your app, you miss node pressure, throttling, failed schedules, and control-plane degradation. Full cluster observability means all five.

### Q4. What is the difference between cAdvisor and kube-state-metrics?

This is the classic trap. They answer different questions:

- **cAdvisor** = **resource consumption**. Built into the kubelet, it reports what each container is *actually using*: `container_cpu_usage_seconds_total`, `container_memory_working_set_bytes`. Use it for "is this pod being CPU-throttled or near its memory limit?"
- **kube-state-metrics** = **object state**. It watches the API server and turns the *declared/observed state of Kubernetes objects* into metrics: `kube_deployment_status_replicas_ready` vs `kube_deployment_spec_replicas`, `kube_pod_status_phase`, `kube_job_status_failed`. Use it for "does this Deployment have all its replicas? Is a pod stuck Pending?"

You need both. A pod can be perfectly healthy on resources (cAdvisor happy) while the Deployment is degraded because two replicas won't schedule (KSM tells you). Confusing them in an interview is a junior tell.

### Q5. How does Prometheus discover pods to scrape in a dynamic cluster?

Via **`kubernetes_sd_config`** — Prometheus queries the Kubernetes API server for objects (roles: `node`, `pod`, `endpoints`, `service`, `endpointslice`, `ingress`) and gets a live, auto-updating list of targets with metadata attached as `__meta_kubernetes_*` labels.

Then **relabeling** (`relabel_configs`) does the real work: keep only targets with a scrape annotation/label, rewrite the address to the right port, and promote metadata (namespace, pod, node) into real labels.

```yaml
relabel_configs:
  # only scrape pods with prometheus.io/scrape: "true"
  - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
    action: keep
    regex: "true"
  # use the pod's declared metrics port
  - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_port, __address__]
    action: replace
    regex: (\d+);(.+):\d+
    target_label: __address__
    replacement: $2:$1
  - source_labels: [__meta_kubernetes_namespace]
    target_label: namespace
```

Pods appear and vanish; Prometheus reconciles the target list automatically. That's why pull works here.

### Q6. What's the difference between annotation-based scraping and ServiceMonitor/PodMonitor?

Two ways to tell Prometheus what to scrape:

- **Annotation-based** — you add `prometheus.io/scrape: "true"`, `prometheus.io/port`, `prometheus.io/path` to pods, and a global scrape job with relabeling picks them up. Simple, no CRDs, but the discovery logic lives in one central config.
- **ServiceMonitor / PodMonitor (Operator)** — declarative CRDs the Operator turns into scrape config. App teams own their scrape definition next to their workload; no central file edits.

The gotcha: in an Operator-managed cluster, pod annotations alone do **nothing** unless there's a legacy annotation-scrape job — the Operator only knows about ServiceMonitors/PodMonitors. And a ServiceMonitor won't be picked up unless its labels match the Prometheus's `serviceMonitorSelector` (and it targets a **named** port). Most "my new service has no metrics" incidents are one of these two mismatches.

### Q7. How do the USE method and RED method apply in Kubernetes?

- **USE (Utilization, Saturation, Errors)** → apply to **resources**: nodes, and pod resource limits. For a node: CPU utilization, memory saturation (is it swapping / near eviction?), disk errors. For a pod: is it being CPU-throttled (`container_cpu_cfs_throttled_periods_total`), near its memory limit (working set / limit)?
- **RED (Rate, Errors, Duration)** → apply to **services**: request rate, error rate, and latency of each workload handling requests.

The pairing is deliberate: USE tells you a resource is under pressure; RED tells you users are feeling it. On Kubernetes you watch USE on nodes and pod limits (are we saturated / throttled?) and RED on the Services in front of your Deployments (are requests failing or slow?). Alert primarily on RED symptoms; use USE to diagnose the cause.

### Q8. What are the four golden signals for a cluster, and how do you measure them?

Latency, Traffic, Errors, Saturation — applied at the cluster level:

- **Latency** — request duration of workloads (from app histograms or the ingress controller), plus control-plane latency (`apiserver_request_duration_seconds`).
- **Traffic** — request rate per service; also API server request rate.
- **Errors** — HTTP 5xx rate from ingress/app; also apiserver error rate, failed pods, restart counts.
- **Saturation** — node CPU/memory saturation, pod throttling, disk/PVC fullness, and how close you are to resource limits (the "how full is the system" signal — often the leading indicator).

Golden signals are symptom-oriented: they tell you users are affected. Node/container exporters then let you drill into *why*.

### Q9. What are the most common Kubernetes alerts you'd set up?

The staples (most ship in kube-prometheus-stack):

- **Pod crash-looping** — `rate(kube_pod_container_status_restarts_total[15m]) > 0` sustained, or `kube_pod_container_status_waiting_reason{reason="CrashLoopBackOff"}`.
- **Node not ready** — `kube_node_status_condition{condition="Ready",status="true"} == 0`.
- **PVC almost full** — `kubelet_volume_stats_available_bytes / kubelet_volume_stats_capacity_bytes < 0.10`.
- **HPA maxed out** — `kube_horizontalpodautoscaler_status_current_replicas == kube_horizontalpodautoscaler_spec_max_replicas` (can't scale further).
- **Pods pending / unschedulable** — `kube_pod_status_phase{phase="Pending"}` sustained.
- **Container OOMKilled** — restart reason `OOMKilled`.
- **Certificate expiry** — cert expiring within N days.
- **Deployment mismatch** — `kube_deployment_status_replicas_available < kube_deployment_spec_replicas` sustained.
- **Control-plane** — API server high error/latency, etcd running low on space or leader flapping.

Every one of these should link to a runbook.

### Q10. metrics-server vs Prometheus — what's the difference and when do you use each?

They are not competitors; they solve different problems.

| | metrics-server | Prometheus |
|---|---|---|
| Purpose | Feed HPA + `kubectl top` | Monitoring, alerting, dashboards |
| Data | Current CPU/mem, in-memory | Full metric set, on-disk TSDB |
| History | None (short rolling window) | Configurable retention |
| Alerting | No | Yes (Alertmanager) |
| Query | Metrics API only | PromQL |

**metrics-server** is a lightweight cluster add-on that scrapes the kubelet and exposes the Kubernetes Metrics API purely so the Horizontal/Vertical Pod Autoscaler and `kubectl top` work. It stores nothing durable. **Prometheus** is your actual observability system. A very common wrong answer is "use metrics-server for monitoring" — it can't; it has no storage and no history. (For custom/external metrics autoscaling you bridge Prometheus to the HPA via the **prometheus-adapter**.)

### Q11. What managed options exist so you don't run Prometheus yourself?

The realistic menu:

- **Cloud-managed Prometheus** — **Amazon Managed Service for Prometheus (AMP)**, **Google Cloud Managed Service for Prometheus**, **Azure Monitor managed Prometheus**. You keep PromQL and exporters; the provider runs the storage/query layer at scale.
- **Grafana Cloud** — hosted Prometheus-compatible (Mimir) + Loki + Tempo + Pyroscope.
- **Datadog / New Relic / Dynatrace** — agent-based (a DaemonSet), all-in-one metrics+logs+traces+APM, less PromQL, more turnkey but pricier and proprietary.
- **Self-hosted-but-scalable** — Thanos / Cortex / Mimir on top of your own Prometheus for long retention and global query.

The tradeoff is the usual one: managed reduces operational toil and paging on your monitoring system itself, at higher cost and some lock-in. Keeping PromQL/OTLP-compatible preserves your exit.

### Q12. How do you monitor autoscaling behaviour?

You want to see whether the autoscalers are keeping up and whether they're stuck:

- **HPA** — current vs desired vs min/max replicas (`kube_horizontalpodautoscaler_status_current_replicas`, `..._status_desired_replicas`, `..._spec_max_replicas`), and the metric it scales on. Alert when current == max for a sustained period (demand exceeds capacity) or when desired keeps exceeding current (can't schedule).
- **Cluster Autoscaler / Karpenter** — pending pods that can't schedule, node provisioning latency, scale-up failures, and nodes stuck being drained.
- **VPA** — recommended vs actual requests.

The key symptom is **"pods Pending because HPA scaled up but the cluster can't add nodes"** — you see it as rising Pending pods plus HPA at desired > current. Correlate HPA replica count with node count and Pending pods on one dashboard.

### Q13. Why does pod churn create a cardinality problem, and how do you control it?

Every time a pod restarts or a Deployment rolls, Kubernetes creates a **new pod name** (and often a new `instance`/IP). If those flow into metric labels — `pod`, `instance`, `pod_hash`, `container_id` — each restart mints a **brand-new set of time series**. The old series don't disappear immediately; they linger for the retention window. A workload that redeploys 50× a day, or a CronJob that spawns hundreds of short-lived pods, silently multiplies your active series count. This "churn" is the Kubernetes-specific flavour of the cardinality footgun, and it OOMs Prometheus and inflates bills.

Controls:
- **Drop churny labels** with `metric_relabel_configs` — you rarely need per-pod-hash series; aggregate to the Deployment/Service.
- **Avoid unbounded labels** (`container_id`, ephemeral IDs, request IDs) entirely.
- **Aggregate short-lived jobs** — don't label CronJob metrics with the per-run pod name.
- **Recording rules** to pre-aggregate away the high-cardinality dimension.
- **Watch `prometheus_tsdb_head_series`** and per-metric cardinality; alert on growth.

### Q14. What is the OpenTelemetry Operator and where does it fit?

The **OpenTelemetry Operator** is a Kubernetes controller (analogous to the Prometheus Operator) that manages OpenTelemetry components via CRDs:

- **`OpenTelemetryCollector`** CRD — deploys and configures the Collector (as a Deployment, DaemonSet, or Sidecar) declaratively.
- **`Instrumentation`** CRD — enables **auto-instrumentation**: it injects language-specific OTel agents into your pods (Java, Node, Python, .NET, Go) via an annotation, so you get traces/metrics with no code changes.

Where it fits: it's the vendor-neutral path to unifying the three signals in Kubernetes. Instead of a proprietary agent, you run OTel Collectors that receive OTLP, process (batch, tail-sample, redact), and export to whatever backend (Prometheus/Tempo/Loki, or a vendor). It complements the Prometheus Operator — Prometheus for the pull-based cluster metrics, OTel Collector for push-based app traces/metrics/logs — and increasingly is the single ingestion layer for everything.

### Q15. Walk me through debugging "my new service isn't showing up in Prometheus."

Work down the discovery chain:

1. **Is the app exposing metrics?** `kubectl port-forward` to the pod and `curl localhost:PORT/metrics`. No output → instrumentation/port problem, stop here.
2. **Does the ServiceMonitor exist and match?** Its `selector.matchLabels` must match the **Service's** labels, and `endpoints.port` must be the **named** port on the Service (a number won't match a named port). PodMonitor targets pods directly.
3. **Does Prometheus own this ServiceMonitor?** The ServiceMonitor's labels must satisfy the Prometheus CR's `serviceMonitorSelector` (often `release: <helm-release>`), and namespace must be allowed by `serviceMonitorNamespaceSelector`.
4. **Check Prometheus's Targets page / Service Discovery UI** — is the target listed? "Dropped" means relabeling removed it; look at the relabel rules. Not listed at all → SD/selector problem.
5. **Is the endpoint healthy?** A target present but "down" with a connection refused → wrong port or network policy blocking Prometheus.

Nine times out of ten it's a **label selector mismatch or an unnamed port**.

### Q16. Design monitoring for a new microservice being deployed to Kubernetes.

I'd cover all five layers and make the app self-service:

1. **Instrument the app** for **RED** — request rate, error rate, and a latency **histogram** (`http_request_duration_seconds_bucket`) so I can compute quantiles and SLOs. Expose `/metrics`.
2. **Ship a ServiceMonitor** next to the Deployment (named `metrics` port) so the Operator scrapes it automatically — no central config edit.
3. **Rely on the platform layers already present** — node-exporter, cAdvisor, kube-state-metrics — for node pressure, pod throttling/OOM, and replica health. I don't re-invent these.
4. **Define SLIs/SLOs** — availability = good/total requests, latency SLO from the histogram — and encode **multi-window multi-burn-rate** alerts in a `PrometheusRule`. Page on SLO burn (symptom), not on every CPU spike.
5. **Add targeted alerts** — CrashLoopBackOff, OOMKilled, replicas available < desired, HPA maxed — each **linked to a runbook**.
6. **Dashboard** — one Grafana board with the four golden signals up top, RED per-endpoint, and resource/limit saturation below for drill-down.
7. **Control cardinality** — no `user_id`/`request_id`/`pod_hash` labels; keep the histogram buckets sane.

The theme: app owns RED + SLOs, the platform provides the resource/state layers, alerts are symptom-based and runbook-linked.

## Incident Response & On-Call

### Summary

**What this topic covers**

Observability exists to shorten incidents — this topic is the human and process side that turns a signal into a resolved outage and a lesson learned. The 16 questions cover the **incident lifecycle** (detect → triage → mitigate → resolve → learn), **severity levels** (SEV1–4 and how to classify by impact), the metrics that measure your response (**MTTD, MTTA, MTTR**) and how observability drives them down, **on-call practices** (rotations, primary/secondary, follow-the-sun, sustainability, compensation), the **incident commander** role and incident coordination, **runbooks** and why every page needs one, the **mitigate-before-diagnose** principle, **communication** during incidents, **blameless postmortems** and the culture behind them, **root cause analysis** (5 whys, why "human error" is never a root cause), the **error-budget** tie-in, **alert fatigue** as an incident risk, **chaos engineering / game days**, learning from near-misses, **toil reduction**, and **SRE culture** generally. This is where SRE stops being about tools and starts being about how a team behaves under pressure.

**Mental model**

An incident has two goals in strict priority order: **stop the bleeding, then find out why.** Under pressure the instinct is to diagnose root cause first; the discipline is to **mitigate first** — roll back, fail over, scale out, shed load — because users don't care why they're broken, only that they are. Structure beats heroics: one person is the **Incident Commander** who coordinates and decides, not the person with hands on the keyboard. Everything is **blameless** — you assume competent people made reasonable decisions given the information and incentives they had, so a "root cause" of "human error" is a failure of analysis, not an answer; the system let a human mistake become an outage. The whole loop feeds a learning system: every incident produces a postmortem with **action items that have owners and due dates**, and error budgets convert "we had incidents" into a concrete signal about whether to slow down and invest in reliability. The measures — MTTD, MTTA, MTTR — tell you where the loop is slow.

**Key terms**

- **Incident lifecycle** — detect → triage → mitigate → resolve → learn.
- **Severity (SEV1–4)** — impact-based classification driving urgency, escalation, and comms.
- **MTTD** — mean time to detect (signal quality).
- **MTTA** — mean time to acknowledge (alerting/on-call responsiveness).
- **MTTR** — mean time to resolve/mitigate/recover (whole response).
- **Incident Commander (IC)** — coordinates the response and owns decisions; doesn't fix directly.
- **Runbook / playbook** — step-by-step guide to diagnose and mitigate a specific alert.
- **Mitigate before diagnose** — restore service before investigating cause.
- **Blameless postmortem** — retrospective focused on systemic factors, not blame.
- **5 Whys** — iterative root-cause technique; "human error" is a starting point, never the end.
- **Error budget** — 1 − SLO; a policy for when to stop shipping and fix reliability.
- **Alert fatigue** — desensitisation from too many/noisy alerts; a real incident risk.
- **Toil** — manual, repetitive, automatable operational work; SRE aims to reduce it.
- **Game day / chaos engineering** — deliberately injecting failure to test response.

**Why interviewers ask this**

Anyone can describe a green dashboard; interviewers want to know how you behave when it's red at 3am. The junior-vs-senior signal is sharp here. A junior jumps straight to the debugger and starts changing things on the box. A senior **declares an incident, assigns an IC, communicates, mitigates first, and only then diagnoses** — and afterwards runs a blameless postmortem instead of asking "who broke it?" Saying "human error was the root cause" is a red flag; saying "the system allowed a routine human mistake to cause an outage, so the fix is a guardrail" is the answer they want. They're probing for calm under pressure, structured coordination, a bias to restore service, and a genuine learning culture rather than blame. For any SRE/senior role this often matters more than PromQL fluency.

**Common confusions**

- "The root cause was human error." Never — humans operate inside systems; the real cause is the missing guardrail, unclear runbook, or fragile design that let the mistake land.
- "MTTR is one number." It's a family — you can decompose into detect (MTTD), acknowledge (MTTA), and repair; each has a different fix.
- "The Incident Commander fixes the problem." No — the IC coordinates; the subject-matter experts fix. Combining the roles is how incidents go chaotic.
- "Postmortems are about accountability." They're about *learning*; the moment they're about punishment, people stop reporting and you lose the data.
- "Diagnose the root cause, then fix." Under an active outage, mitigate first. Root cause is for the postmortem.

**What follows from this topic**

This is where the whole primer pays off. The alerts you design (SLOs, burn-rate, symptom-based) are only useful if the on-call human can act on them — which is why every alert needs a runbook. Error budgets, from the SLO topic, become the policy lever discussed here. Alert fatigue links back to alerting hygiene, and profiling (the next topic) is often the tool an on-call engineer reaches for when a service is "using 100% CPU" mid-incident. Good observability plus good incident response is the whole SRE value proposition: lower MTTD and MTTR, and learn every time.

### Q1. Walk me through the incident lifecycle.

Five phases:

1. **Detect** — something alerts (ideally a symptom-based SLO alert) or a user reports it. Goal: low **MTTD**. Good observability detects it before customers do.
2. **Triage** — assess impact and assign **severity**; decide whether to declare a formal incident, page others, and appoint an **Incident Commander**.
3. **Mitigate** — **stop the bleeding first**: roll back, fail over, scale, feature-flag off, drain a bad node. Restore service to users; don't chase root cause yet.
4. **Resolve** — service is healthy and stable; close the incident, stand down responders, update the status page.
5. **Learn** — a **blameless postmortem**: timeline, contributing factors, and action items with owners and dates.

The two hard disciplines are declaring early (don't be a hero solo) and mitigating before diagnosing.

### Q2. How do severity levels work and how do you classify an incident?

Severity is driven by **impact**, not by how interesting the bug is. A common scheme:

| Sev | Impact | Response |
|---|---|---|
| SEV1 | Major outage / data loss; core function down for many users | All-hands, IC, exec comms, status page, 24/7 |
| SEV2 | Significant degradation; important feature down or subset of users badly affected | Paged response, IC, status page |
| SEV3 | Minor / partial degradation; workaround exists | Business-hours, tracked |
| SEV4 | Negligible/cosmetic | Backlog |

Classify by asking: **how many users, how core the function, is there a workaround, is data at risk, is it getting worse?** Err on the side of *over*-classifying initially — you can downgrade a SEV2 to SEV3, but a SEV3 that was really a SEV1 means you under-responded. Severity drives who gets paged, whether you appoint an IC, and how often you communicate.

### Q3. Explain MTTD, MTTA, and MTTR and how observability improves them.

- **MTTD (Mean Time To Detect)** — from failure start to something noticing. Driven by **signal quality**: good symptom-based SLO alerts and coverage catch it fast; gaps mean customers detect it for you.
- **MTTA (Mean Time To Acknowledge)** — from alert fired to a human acknowledging. Driven by **alerting hygiene and on-call setup**: actionable pages, sane escalation, no fatigue.
- **MTTR (Mean Time To Resolve/Recover)** — from detection (or start) to service restored. Driven by **fast diagnosis and easy mitigation**: good dashboards/traces, runbooks, and safe rollback/failover.

Observability attacks all three: better instrumentation lowers MTTD; less noise lowers MTTA; correlated metrics/logs/traces plus runbooks lower MTTR. Decomposing MTTR this way tells you *where* your response is slow — if MTTD is fine but MTTR is high, the problem is diagnosis/mitigation tooling, not detection.

### Q4. What are good on-call practices, and how do you keep on-call sustainable?

Practices:
- **Primary + secondary** rotation — secondary backs up a missed page and helps on big incidents.
- **Follow-the-sun** where you have the geography — hand off to the next timezone so nobody covers nights.
- **Reasonable rotation length** (e.g. weekly) and **enough people** that any one person is on call infrequently.
- **Every page is actionable and has a runbook** — if it isn't, fix or delete the alert.

Sustainability (avoiding burnout):
- **Cap paging load** — a widely used guideline is no more than ~2 actionable pages per on-call shift; more than that means you fix the alerts or the system, not the human.
- **Compensate on-call** — pay or time-off; it's real work.
- **Protect off-hours** — no non-urgent pages; use tickets for anything that can wait.
- **Track alert volume** as a health metric and run an **onboarding/shadowing** period before someone goes solo.

Burned-out on-call is itself an incident risk: tired, desensitised responders detect and mitigate slower.

### Q5. What is the Incident Commander role, and what other roles exist?

The **Incident Commander (IC)** **coordinates**; they do **not** put hands on the keyboard. The IC owns the incident: maintains the shared picture, decides on mitigations, delegates investigation, controls escalation, and keeps everyone unblocked. Crucially, being IC frees the experts to focus on fixing while one person holds the whole state.

Common supporting roles (from ICS-style incident frameworks):
- **Operations / Subject-Matter Expert(s)** — the people actually diagnosing and applying fixes.
- **Communications Lead** — owns external/internal updates (status page, stakeholders, execs) so responders aren't interrupted.
- **Scribe** — records the timeline: what happened, what we tried, when — invaluable for the postmortem.
- **Liaison** — interfaces with other teams/vendors.

For small incidents one person wears several hats; the point is that **coordination is a distinct job from fixing.** Merging IC and hands-on-keyboard is how incidents descend into chaos.

### Q6. Why does every alert need a runbook, and what's in one?

A **runbook** links an alert to the actions for handling it. If a page fires at 3am and the responder has to reverse-engineer what it means and what to do, MTTR balloons and stress spikes. **Rule: if you can't write a runbook for an alert, the alert probably shouldn't page.**

A good runbook contains:
- **What this alert means** — the SLI/threshold and what's actually degraded for users.
- **Severity / impact** — how bad, who's affected.
- **First diagnostics** — the specific dashboards, queries, and traces to check.
- **Mitigations** — concrete "stop the bleeding" steps: roll back, fail over, scale, disable feature flag, drain node.
- **Escalation** — who to pull in if mitigation doesn't work.
- **Links** — dashboards, related runbooks.

Runbooks turn tribal knowledge into something a tired secondary can execute, which is exactly what lowers MTTR and spreads on-call load.

### Q7. Explain "mitigate before diagnose" and why it matters.

Under an active outage, your first job is to **restore service, not understand it**. Users are affected *now*; every minute spent on root cause is a minute of downtime. So you reach for fast, reversible mitigations first:

- **Roll back** the recent deploy (most incidents follow a change).
- **Fail over** to a healthy region/replica.
- **Scale out** or **shed load** if it's saturation.
- **Disable the feature** via flag.
- **Drain** a bad node/instance.

Only once the bleeding stops do you diagnose — calmly, with the system stable, ideally in the postmortem. This is counterintuitive to engineers who want to *understand* before acting, but the priority order is unambiguous: **stop the impact, then learn.** The corollary is you must design for cheap mitigation — fast rollbacks, feature flags, multi-region — so mitigation is always available.

### Q8. How do you communicate during an incident?

Communication is a first-class workstream, ideally owned by a **Communications Lead** so responders aren't distracted:

- **Internally** — a single incident channel as the source of truth; the scribe keeps a running timeline; regular updates ("still investigating, next update in 15 min") even when there's no news, because silence breeds side-channel chaos.
- **Externally** — a **status page** with honest, non-technical, timely updates; acknowledge, don't speculate on cause, give an ETA for the next update rather than for resolution.
- **Stakeholders/execs** — impact-focused summaries (who's affected, what we're doing, when we'll update), not raw technical detail.

Principles: **be honest, be timely, set the next-update expectation, and don't blame** in public comms. Poor communication turns a technical incident into a trust incident; good communication buys you room to fix it properly.

### Q9. What is a blameless postmortem and why is blamelessness essential?

A **blameless postmortem** is the after-incident review that focuses on **systemic factors** — what conditions allowed the failure — rather than **who** made a mistake. The premise: people acted reasonably given the information, tools, and incentives they had, so if a routine action caused an outage, the *system* is at fault (missing guardrail, misleading UI, unclear runbook).

Blamelessness is essential for one practical reason: **psychological safety produces honest data.** If people fear punishment, they hide details, under-report, and you never learn the real chain of events — so the same class of incident recurs. Blameless culture makes engineers volunteer "here's exactly what I did and why it seemed right," which is where the actionable fixes come from. It is *not* "no accountability" — teams are still accountable for shipping the action items — it's that the analysis targets systems, not scapegoats. This is a cornerstone of SRE culture and a strong senior signal in interviews.

### Q10. What goes into a postmortem document?

A solid postmortem has:

- **Summary** — one-paragraph what happened and impact.
- **Impact** — duration, users/requests affected, SLO/error-budget burned, revenue if relevant.
- **Timeline** — timestamped sequence: when it started, when detected (MTTD), acknowledged (MTTA), mitigated, resolved (MTTR) — from the scribe's notes.
- **Root cause & contributing factors** — the chain of conditions, not a single scapegoat.
- **Detection** — how we found out; could we have found out sooner?
- **What went well / what went badly / where we got lucky** — the honest retrospective.
- **Action items** — concrete fixes, each with an **owner and a due date**, tracked to completion.

The action items are the whole point — a postmortem with no owned, tracked follow-ups is theatre. "Where we got lucky" is underrated: it surfaces the near-miss that will bite next time.

### Q11. How do you do root cause analysis, and why is "human error" never a root cause?

I use techniques like **5 Whys** — keep asking "why did that happen?" past the first plausible answer to expose the systemic layer:

> Site down → deploy pushed bad config → config wasn't validated → no validation step in the pipeline → *the pipeline permits unvalidated config to reach production.*

The last "why" is a **systemic, fixable** cause; the first is just the trigger.

"**Human error**" is never the root cause because humans are a permanent, expected part of the system — they will make mistakes. If a single routine human action can take production down, the real cause is the **missing guardrail**: no validation, no canary, no rollback, an easy-to-misuse tool. Blaming the human fixes nothing (the next human will do the same) and destroys the trust that produces honest postmortems. The correct output is a *system* change — add the validation, the canary, the confirmation, the automation. I'll also note most real incidents have **multiple contributing factors**, not one root cause.

### Q12. How do error budgets connect to incident response?

An **error budget** (1 − SLO) makes reliability a shared, quantified decision instead of an argument. It ties into incidents two ways:

- **During/after incidents** — every incident **burns budget**. The postmortem quantifies how much, turning "we had a rough week" into "we spent 60% of the quarter's budget in one incident."
- **As a policy** — a **postmortem-triggered / error-budget policy** says what happens when the budget is exhausted: e.g. **freeze feature releases and redirect effort to reliability** until you're back within budget. This aligns product and SRE — shipping fast is fine *while there's budget*; blow it and reliability work takes priority automatically.

So error budgets convert incident pain into an objective control: they justify the reliability investment (fixing the action items) and remove the emotional "should we slow down?" debate by pre-agreeing the rule.

### Q13. Why is alert fatigue an incident risk, and how do you fight it?

**Alert fatigue** is desensitisation from too many, too noisy, or non-actionable alerts. It's a direct incident risk: when everything pages, responders start ignoring or muting pages — and the one page that mattered gets missed or acknowledged slowly (worse MTTA/MTTD). It also burns people out, which slows every future response.

Fight it by making alerts **few, actionable, and symptom-based**:
- **Page on symptoms** (user-facing SLO breach), not on every cause — one burn-rate alert instead of twenty cause alerts.
- **Every page must be actionable** and have a runbook; if a human can't do anything, it's a ticket or a dashboard, not a page.
- **Multi-window multi-burn-rate** SLO alerts to cut false positives.
- **Tune or delete** noisy alerts; review alert volume as an SRE metric.
- **Route by urgency** — page for now, ticket for later.

The goal: when your phone buzzes, you *trust* it's real. That trust is what keeps MTTA low.

### Q14. What are chaos engineering and game days, and how do they help?

**Chaos engineering** is **deliberately injecting failure** into a (often production-like or production) system to verify it degrades gracefully and that your detection and response actually work — killing pods, adding latency, cutting a dependency, failing a zone. **Game days** are scheduled exercises where the team runs a simulated incident end-to-end.

They help incident response in ways passive monitoring can't:
- **Validate observability** — did the alert actually fire? Was the dashboard useful? (You find blind spots *before* a real outage.)
- **Test runbooks and rollback/failover** — do the mitigations work as documented?
- **Rehearse the humans** — practise the IC role, comms, and coordination so the real 3am isn't the first time.
- **Build confidence** in resilience assumptions (retries, timeouts, circuit breakers) instead of hoping.

The philosophy: you don't know your system is resilient until you've broken it on purpose. Game days turn incident response into a practised skill rather than an improvised panic.

### Q15. What is toil, and why do SREs care about reducing it?

**Toil** is operational work that is **manual, repetitive, automatable, tactical, and scales linearly with the service** — restarting a stuck service by hand, manually clearing a queue, copy-pasting the same mitigation every week. It's not "work I dislike"; it's specifically the automatable, no-lasting-value grind.

SREs care because toil is corrosive: it consumes the time that should go into engineering reliability, it scales with growth (so it caps how much you can run), and it burns people out — which degrades incident response. The classic SRE target is to **keep toil below ~50% of an SRE's time**, protecting the rest for automation and engineering. In incident terms, recurring manual mitigations are a signal: if you keep hand-fixing the same thing, that's a postmortem action item to automate (self-healing, auto-remediation, better guardrails). Reducing toil directly lowers MTTR (the fix becomes a button or automatic) and keeps responders fresh.

### Q16. Describe good SRE culture and what a healthy on-call handoff looks like.

**SRE culture** in a sentence: **treat operations as a software problem, be blameless, and use data (SLOs, error budgets, toil) to make reliability decisions.** Concretely: symptom-based alerting, error budgets that gate risk, blameless postmortems with tracked action items, relentless toil reduction, shared ownership of reliability between dev and ops, and sustainable, compensated on-call. Reliability is a feature, and unreliability is quantified rather than argued about.

A healthy **on-call handoff** transfers context so nothing falls through the cracks:
- **Ongoing incidents / degradations** and their current state.
- **Recent changes** — deploys, migrations, config changes that might still bite.
- **Known-flaky alerts** and what to do about them.
- **Anything being watched** (a slow leak, an experiment, a risky deploy planned).
- **Open action items** from recent incidents.

Do it as a brief synchronous handoff (or a written summary in the incident channel), so the incoming on-call starts informed rather than cold. A good handoff is a small investment that prevents the "nobody told me we were mid-migration" incident.

## Profiling & Continuous Profiling

### Summary

**What this topic covers**

Metrics, logs, and traces tell you *that* a service is slow or hungry and *where* in the request path — profiling tells you **why inside the process**: which line of code is burning the CPU or allocating the memory. The 15 questions here cover what profiling adds beyond the three pillars, the **profile types** (CPU, heap/allocation, goroutine/thread, mutex/block, off-CPU), how to read **flame graphs** (and their variants — icicle and differential), **pprof** (Go's profiler and the `/debug/pprof` endpoints, though the model generalises), **sampling vs instrumenting** profilers and their overhead, **continuous profiling** (always-on, low-overhead, in production — Grafana Pyroscope, Parca, Polar Signals, Google Cloud Profiler), **eBPF-based** whole-system profiling (no code changes, no redeploy — the big recent shift), when to profile vs trace vs metric, hunting **memory leaks** with heap profiles, the **cost/overhead** question, **span-to-profile** integration linking traces to profiles, language support, and the canonical incident flow: "the service is at 100% CPU / OOMing — find the cause." Profiling is increasingly called the **fourth pillar** of observability.

**Mental model**

The three pillars stop at the process boundary. A trace says "the `checkout` service span took 800ms" — but *inside* those 800ms, what was the CPU doing? Which function allocated the gigabyte that triggered the OOM? Profiling answers that by **sampling the call stack** many times per second and aggregating: functions that appear in more samples were consuming more of the resource. The output is a **flame graph** — stacked bars where **width = proportion of the resource** (CPU time, bytes allocated) and the y-axis is call depth. Read it top-down by width: the widest boxes are your hotspots. The historical objection — "profiling is too expensive for production" — has collapsed. **Sampling** profilers (grab a stack N times/sec) have overhead in the low single-digit percent, and **eBPF** lets the kernel sample stacks across the whole machine with no code changes and no redeploy. So profiling moved from a one-off "attach in dev when something's slow" tool to **continuous, always-on** production telemetry you can diff across deploys.

**Key terms**

- **Profiling** — attributing resource consumption (CPU, memory, etc.) to code (functions/lines).
- **CPU profile** — where CPU time is spent (which functions are on-CPU).
- **Heap / allocation profile** — where memory is allocated / what's retained.
- **Goroutine / thread profile** — how many, and where they're stuck.
- **Mutex / block profile** — time lost to lock contention / blocking.
- **Off-CPU profile** — time spent *waiting* (I/O, locks, sleep), not running.
- **Flame graph** — stacked call-stack visualisation; width = resource share, x-axis is NOT time.
- **Icicle graph** — flame graph drawn top-down (root at top).
- **Differential flame graph** — colour-coded diff between two profiles (e.g. before/after a deploy).
- **pprof** — Go's profiling format/tooling (`/debug/pprof`, `go tool pprof`); the format is now cross-language.
- **Sampling profiler** — periodically samples stacks; low, tunable overhead.
- **Continuous profiling** — always-on, low-overhead profiling in production, stored over time.
- **eBPF profiling** — kernel-level, whole-system sampling with no app changes.
- **Span-to-profile** — linking a trace span to the profile captured during it.

**Why interviewers ask this**

Profiling separates engineers who can say "the service is slow" from engineers who can say "the service is slow *because* `json.Marshal` in the hot path is 40% of CPU, here's the flame graph." The junior-vs-senior signal: can you **read a flame graph** (width = resource, x-axis is not time-ordered — a classic gotcha), do you know **which profile type** answers which question (CPU profile for a CPU-bound hotspot, heap profile for a leak), and do you understand that **continuous profiling in prod is now cheap and normal** rather than a dev-only luxury? Senior candidates connect it to the rest of observability — profiling picks up where tracing hands off (trace localises the slow service, profile explains the slow code) — and can walk the "100% CPU / OOMing, find the cause" flow confidently. For performance-sensitive or cost-conscious teams, this is a high-value, differentiating skill.

**Common confusions**

- "The flame graph x-axis is time." No — width is *proportion of the resource*, and bars are sorted alphabetically/for merging, **not** chronologically. A flame graph is not a timeline (that's a trace/flame *chart*).
- "Profiling is too expensive for production." Not anymore — sampling and eBPF profilers run continuously at low single-digit overhead.
- "A CPU profile shows memory problems." No — pick the profile type for the resource: heap/allocation for memory, CPU for compute, block/mutex for contention, off-CPU for waiting.
- "Profiling replaces tracing." They compose — tracing tells you *which* service/span; profiling tells you *which code inside it*.
- "High CPU in the profile = the bug." Sometimes the cost is *off-CPU* (blocked on I/O or a lock); an on-CPU profile alone can mislead — use off-CPU/block profiles too.

**What follows from this topic**

Profiling closes the loop the other pillars leave open. Distributed tracing narrows a latency problem to one service and one span; the profile — ideally linked via **span-to-profile** — tells you the exact function to fix. In Kubernetes, continuous profilers ship as another low-overhead **eBPF DaemonSet** right alongside node-exporter, so this slots directly into the cloud-native stack from that topic. And in an incident, when a service is pinned at 100% CPU or getting OOMKilled, a continuous profiler is often the fastest path from symptom to root cause — turning a long diagnosis into a glance at a differential flame graph across the last deploy.

### Q1. What does profiling add beyond metrics, logs, and traces?

The three pillars stop at the **process boundary**. Metrics say "CPU is at 95%." Logs say "requests are slow." A trace says "the `checkout` service span took 800ms." None of them tell you **which function** inside that process is burning the CPU or allocating the memory. That gap is what profiling fills: **code-level resource attribution** — mapping CPU time or memory allocation to specific functions and lines.

The canonical handoff: a trace localises the problem to a service and a span ("this 800ms is in `checkout`"), and profiling explains it ("...because `serialize()` is 40% of CPU"). Metrics and traces tell you *where* and *that*; profiling tells you *why, in the code*. That's why it's increasingly called the **fourth pillar** of observability — it's the level of detail below a span.

### Q2. What are the main types of profiles, and what does each tell you?

Pick the profile type for the resource you're chasing:

| Profile | Answers | Use when |
|---|---|---|
| **CPU** | Which functions are *on-CPU* (burning compute) | Service is CPU-bound / high CPU |
| **Heap / allocation** | Where memory is allocated and what's retained | High memory, OOMs, leaks |
| **Goroutine / thread** | How many, and where they're parked | Goroutine/thread leak, everything stuck |
| **Mutex / block** | Time lost to lock contention | Low CPU but slow — contention |
| **Off-CPU** | Time spent *waiting* (I/O, lock, sleep) | Slow but not CPU-bound |

The key insight: **on-CPU and off-CPU are different questions.** A request can be slow because code is computing hard (CPU profile) *or* because it's blocked waiting on I/O or a lock (off-CPU / block profile). Choosing the wrong profile type is the most common way to chase the wrong thing.

### Q3. How do you read a flame graph?

A **flame graph** aggregates thousands of sampled call stacks into stacked bars:

- **Each box is a function**; a box sits **on top of** the function that called it. The bottom is the root (e.g. `main`), the top is the leaf where the resource was actually being spent.
- **Width = share of the resource** — CPU time or bytes allocated. A box twice as wide consumed twice as much.
- **The x-axis is NOT time.** Boxes are sorted (usually alphabetically) to merge identical stacks; left-to-right means nothing chronological. This is the number-one gotcha — a flame graph is not a timeline.

How to read it: **scan for the widest boxes**, then look at what's *on top of* them (the leaf frames) — that's where the resource is actually spent. Wide plateaus at the top are your hotspots. A tall thin spike is a deep call chain that's cheap; a wide flat top is expensive code.

**Icicle graphs** are the same thing flipped (root at top). **Flame charts** (different!) *do* use the x-axis as time — don't confuse the two.

### Q4. What is a differential flame graph and when is it useful?

A **differential flame graph** overlays two profiles and **colour-codes the difference** — typically red for frames that got *more* expensive and blue for *less* (or vice versa). Instead of eyeballing two separate graphs, you see exactly what changed.

It's the killer feature of continuous profiling. The classic use: **compare a service before and after a deploy.** CPU jumped 30% after last night's release — pull the differential flame graph between the two versions and the regression lights up in red on the exact function that got slower. Same for a memory allocation regression, or comparing a fast host to a slow one, or peak vs off-peak. It turns "something got slower somewhere" into "*this function* got slower, here," which is the difference between an afternoon of bisecting and a ten-second glance.

### Q5. Explain pprof and how you'd collect a profile from a Go service.

**pprof** is Go's built-in profiling system (and now a cross-language *format*). You expose it by importing `net/http/pprof`, which registers handlers under `/debug/pprof/`:

```go
import _ "net/http/pprof"   // registers /debug/pprof/* on the default mux
// ... run an HTTP server
```

Then collect and analyse:

```bash
# 30-second CPU profile, opens interactive/web view
go tool pprof http://localhost:6060/debug/pprof/profile?seconds=30

# heap (memory) profile
go tool pprof http://localhost:6060/debug/pprof/heap

# goroutine dump (great for "everything is stuck")
curl http://localhost:6060/debug/pprof/goroutine?debug=2
```

Inside `go tool pprof` you use `top` (heaviest functions), `list <func>` (line-level cost), and `web` (a flame/graph view). Endpoints exist for `profile` (CPU), `heap`, `goroutine`, `mutex`, `block`, and `allocs`. The `.pprof` format is now consumed by Pyroscope, Parca, and others, so the same tooling generalises well beyond Go.

### Q6. What's the difference between a sampling profiler and an instrumenting profiler?

- **Sampling profiler** — periodically (e.g. 100×/sec) interrupts and records the current call stack. Cost is proportional to the sample rate, not to how much code runs, so overhead is **low and tunable** (typically low single-digit percent). It's statistical: rare fast functions may be under-sampled, but hotspots show up clearly. This is what you run in production.
- **Instrumenting profiler** — injects hooks at every function entry/exit to measure exact call counts and durations. **Precise**, but the overhead can be large (every call pays a tax), and it can distort the very timings you're measuring. Fine in a controlled dev/benchmark run; usually too heavy for prod.

Rule of thumb: **sampling for production and continuous profiling; instrumenting for targeted, offline deep-dives.** Continuous profiling is viable precisely *because* sampling overhead is small enough to leave on all the time.

### Q7. What is continuous profiling and why is it now practical in production?

**Continuous profiling** means running a **low-overhead sampling profiler always-on in production** and storing the profiles over time, so you can query "what was the CPU doing at 2am yesterday?" or diff across deploys — rather than scrambling to attach a profiler *after* an incident starts.

It's practical now for two reasons: (1) **sampling overhead is small** (low single-digit percent), and (2) **eBPF** can sample stacks system-wide with no code changes. Tools: **Grafana Pyroscope**, **Parca** / **Polar Signals**, **Google Cloud Profiler**, Datadog/others.

Why it matters: profiling used to be reactive — *reproduce* the problem, then attach a profiler, and hope it still happens. Continuous profiling makes it **retrospective and comparative**: the data is already there for the incident window, and you can **diff any two time ranges or deploys** with a differential flame graph. It shrinks the "the service is slow, let me try to reproduce it" loop to "let me look at the profile from when it was slow."

### Q8. What is eBPF-based profiling and why is it a big shift?

**eBPF** lets you run sandboxed programs in the Linux kernel. For profiling, an eBPF profiler samples the call stacks of **every process on the machine** from the kernel — **no code changes, no libraries, no redeploy, no restart.** You drop one agent (often a Kubernetes DaemonSet) on a node and instantly profile everything running on it, in any language, including code you didn't write.

Why it's a shift: traditionally, profiling meant instrumenting *your* app (import a library, expose an endpoint, redeploy). eBPF makes profiling a **property of the infrastructure**, not the application. Whole-system visibility, zero instrumentation, negligible overhead — you can profile a third-party binary or a legacy service you can't modify. **Parca**, **Pyroscope**, and **Polar Signals** all offer eBPF profilers. The main caveat is symbolization — you need symbols/debug info to turn kernel-sampled addresses into function names, which is easier for some runtimes than others. But the "just deploy the agent and see every process's flame graph" experience is why eBPF profiling took off.

### Q9. When should you reach for profiling versus a trace versus a metric?

They form a drill-down hierarchy:

- **Metric** — *is there a problem, and what's the trend?* "CPU is at 95%, error rate up." Cheap, aggregate, for alerting and dashboards. Start here.
- **Trace** — *where in the request path?* "The latency is in the `checkout → payment` span, not the DB." Localises across services.
- **Profile** — *why inside that process?* "`checkout` is CPU-bound in `serialize()`, which is 40% of samples." Code-level.

So: metrics detect and alert, traces localise to a service/span, profiles explain the code. For a **CPU or memory hotspot inside a single process**, profiling is the right and only tool — a trace can't see inside the 800ms span, and a metric only tells you the total. Conversely, don't reach for a profile to answer "which downstream service is slow" — that's a trace. Use each where its resolution fits.

### Q10. How do you hunt a memory leak with heap profiles?

A leak means memory grows and isn't reclaimed. The heap-profile workflow:

1. **Confirm it's a leak, not just load** — watch RSS / working-set over time; a true leak trends up without coming back down even as traffic dips.
2. **Capture heap profiles over time** — snapshot the heap at intervals (or use continuous profiling's stored heap profiles). In Go: `go tool pprof http://.../debug/pprof/heap`.
3. **Diff two snapshots** — a differential heap profile between an early and a later snapshot shows which allocation sites *grew*. The frame that keeps climbing is your leak.
4. **Look at inuse_space, not alloc_space** — `inuse_space`/`inuse_objects` show what's **still retained** (the leak), whereas `alloc_space` shows total ever allocated (churn, which the GC may have reclaimed).
5. **Follow to the retaining reference** — the growing allocation site plus the code shows what's holding the objects alive (an unbounded cache, a slice that only appends, goroutines that never exit holding references).

Continuous profiling makes step 3 trivial: diff "now" vs "an hour ago" and read the red frames.

### Q11. What's the real cost/overhead of profiling, and how do you keep it acceptable?

Modern **sampling** and **eBPF** profilers run at **low single-digit percent CPU overhead** — small enough to leave on continuously in production. That's the headline that makes continuous profiling viable. But the answer isn't "zero," so you manage it:

- **Tune the sample rate** — 100Hz is plenty; higher rates cost more for diminishing insight.
- **Prefer sampling / eBPF over instrumenting** in prod — instrumenting profilers can add serious overhead and distort timings.
- **Mind the storage/cardinality cost** — continuous profiling generates a lot of data; retention and per-label cardinality drive the *bill* more than CPU does. Keep labels bounded, like with metrics.
- **Symbolization cost** — do it offline/at query time, not in the hot path.

The honest framing in an interview: overhead used to be the reason profiling stayed in dev; it isn't anymore, but you still make a deliberate rate/retention tradeoff rather than assuming it's free.

### Q12. How does span-to-profile integration work, and why is it valuable?

**Span-to-profile** links a **trace span** to the **profile captured while that span was executing.** When a profiler and tracer share context (e.g. via OpenTelemetry), the profiler tags its samples with the active trace/span ID. Then in your tracing UI you click a slow span and jump straight to a flame graph of *what the CPU was doing during exactly that span.*

Why it's valuable: it stitches the two levels of the drill-down into one click. Normally a trace tells you *which* span is slow and you then go hunt for the code separately; span-to-profile collapses that — **slow span → the exact functions burning time inside it.** It's the tightest possible loop from "this request was slow" to "here's the line of code." Grafana (Tempo traces ↔ Pyroscope profiles) and other stacks implement this, and it's a big reason profiling is converging into the unified OpenTelemetry-based observability stack rather than living as a separate tool.

### Q13. What language and runtime support looks like for profiling.

Support varies by how the runtime exposes stacks:

- **Go** — best-in-class; `pprof` is built in, CPU/heap/goroutine/mutex/block all first-class.
- **JVM (Java/Kotlin/Scala)** — mature via async-profiler / JFR (Java Flight Recorder); low-overhead sampling.
- **Python, Ruby, Node.js** — supported via language profilers (e.g. py-spy, rbspy, and V8's profiler), though interpreted/GC'd runtimes have quirks.
- **Native (C/C++/Rust)** — profile with perf and symbolize with debug info; often the cleanest for eBPF.
- **eBPF profilers** — language-agnostic in principle (they sample kernel-side), but **symbolization** is the catch: turning addresses into function names needs symbols/debug info or runtime-specific unwinders, which is easy for Go/native and harder for JIT'd runtimes.

The trend is **OpenTelemetry profiling** standardising a cross-language profile signal, so the "which language is supported" answer keeps improving. The practical takeaway: Go and JVM are excellent, native is clean, dynamic languages work but with more caveats, and eBPF broadens coverage at the cost of symbolization effort.

### Q14. A service is pinned at 100% CPU in production. Walk me through finding the cause.

1. **Confirm and scope with metrics** — is it one instance or all? Correlate with a recent **deploy** or a traffic change (most regressions follow a release).
2. **Grab a CPU profile** — if continuous profiling is running, just open the flame graph for the affected instance over the spike window; otherwise capture one now (`go tool pprof .../profile?seconds=30` or the eBPF agent's view).
3. **Read the flame graph by width** — the widest top frames are where CPU is going. Look for an unexpected hotspot: a hot serialization path, a regex compiled in a loop, an inefficient retry, a busy-loop.
4. **Diff against a good baseline** — a **differential flame graph** vs the previous version or a healthy host shows exactly what got more expensive since the last deploy. This usually nails it immediately.
5. **Mitigate first** — if it's a bad deploy, **roll back**; if it's load, scale out. (Stop the bleeding before deep analysis.)
6. **Fix the code** — `list` the hot function for line-level cost, fix, and verify with another profile.

The whole point: continuous profiling turns this from "reproduce it and attach a profiler" into "look at the flame graph from when it happened."

### Q15. A service is getting OOMKilled repeatedly. How do you find the cause with profiling?

OOMKilled means the container exceeded its memory limit. Profiling pinpoints *what* allocated the memory:

1. **Characterise the growth** — is memory climbing steadily (a **leak** or unbounded structure) or spiking on certain requests (a **burst** — a huge response, an unbounded batch)? Watch working-set vs the limit over time.
2. **Capture heap profiles** — snapshot the heap (or use continuous profiling's stored heap profiles) at intervals as memory climbs.
3. **Focus on retained memory** — look at **`inuse_space`/`inuse_objects`** (what's still held), not just total allocations. The allocation site that keeps growing is the culprit.
4. **Diff snapshots** — a differential heap profile between early and near-OOM shows the frames that grew; that's your leak or your unbounded buffer.
5. **Trace to the retaining reference** — the growing site plus code reveals the cause: an ever-growing cache with no eviction, a slice/map that only appends, goroutines/threads that never exit holding references, or reading a whole huge payload into memory.
6. **Mitigate then fix** — short term, **raise the limit or roll back** the offending deploy to stop the kills; then fix (bound the cache, stream instead of buffering, close the leak) and confirm with a fresh heap profile.

The heap profile is the difference between "we're out of memory somewhere" and "*this* map has no eviction policy."
## Frontend, Synthetic & Real-User Monitoring

### Summary

**What this topic covers**

Observability stops being abstract the moment a real user on a mid-range Android phone in a spotty-network region loads your page and it feels broken — even though every backend dashboard is green. This topic covers the two halves of user-facing monitoring: **synthetic monitoring** (you script a fake user and probe from the outside on a schedule) and **Real User Monitoring / RUM** (you instrument the actual browser or mobile app and capture what real users experience). It threads through black-box vs white-box monitoring, **Core Web Vitals** (LCP, INP, CLS), frontend performance metrics (TTFB, FCP), frontend error tracking (Sentry, source maps, release tracking), extending distributed tracing into the browser, session replay, mobile crash and ANR reporting, the sampling/privacy problems unique to the frontend, and alerting on user-facing SLOs derived from RUM. The 15 questions move from "what's the difference between synthetic and RUM" to "design an alert on a user-facing SLO from RUM data."

**Mental model**

Think of it as **outside-in vs inside-out**. Synthetic monitoring is a robot pretending to be a user, running a fixed script from known locations on a fixed cadence — it answers "is the critical journey working *right now*, from *there*?" deterministically, even at 3am with zero real traffic. RUM is the opposite: it rides along with real sessions and answers "what are actual humans, on their real devices and networks, actually experiencing?" — but only where you have traffic and only as well as your sampling allows. Neither is optional. Synthetics catch outages before users do and validate pre-launch; RUM captures the long tail of device/network/geography diversity that no script can enumerate. The senior instinct is to **treat the frontend as just another set of services in your trace**: a browser span (LCP, a slow fetch) should connect to the backend spans it triggered, so a "the page is slow" complaint resolves to a specific downstream service, not a shrug.

**Key terms**

- **Black-box monitoring** — probing a system from the outside as a user would, no internal knowledge (is the endpoint up? does the login flow work?).
- **White-box monitoring** — instrumentation from *inside* the system, exposing internal state (queue depth, GC pauses, request internals). You need both.
- **Synthetic monitoring** — scripted, scheduled checks (uptime probes, critical-journey scripts) run from multiple locations. Tools: blackbox_exporter, Pingdom, Grafana Synthetic Monitoring, Checkly.
- **RUM (Real User Monitoring)** — instrumenting the real client to capture real sessions: performance, geography, device, network, errors.
- **LCP (Largest Contentful Paint)** — time until the largest visible element renders; a loading-speed proxy. Good ≤ 2.5s.
- **INP (Interaction to Next Paint)** — responsiveness across the whole session (replaced FID in 2024). Good ≤ 200ms.
- **CLS (Cumulative Layout Shift)** — visual stability; how much content jumps around. Good ≤ 0.1.
- **TTFB (Time To First Byte)** — server + network latency before any content; feeds into LCP.
- **FCP (First Contentful Paint)** — first pixel of content painted.
- **Source maps** — mapping from minified production JS back to original source so stack traces are readable.
- **Session replay** — a reconstructed video-like playback of a user's session (DOM mutations, not real pixels) for debugging.
- **ANR (Application Not Responding)** — mobile: the UI thread blocked long enough that the OS flags it.

**Why interviewers ask this**

Backend-heavy engineers often stop observability at the load balancer and declare victory — "all my services return 200." An SRE who owns user experience knows that a 200 with a 6-second LCP is a failed request from the user's point of view, and that your p99 backend latency says nothing about a render-blocking third-party script. The signal they're probing: do you understand that **the SLO that matters is measured where the user is**, not where your servers are? Senior answers connect RUM to SLOs ("we page on the 28-day LCP-good ratio dropping below target"), reason about the sampling and cardinality problems that make frontend telemetry uniquely hard, and know that synthetics and RUM are complementary, not competing. Junior answers treat "monitoring" as server metrics and forget the client exists.

**Common confusions**

- "Synthetic monitoring replaces RUM" — no. Synthetics are deterministic but blind to real-user diversity; RUM is real but needs traffic and sampling. Use both.
- "Core Web Vitals are just SEO fluff" — they're a genuine UX proxy *and* a Google ranking factor; ignoring them costs both users and rankings.
- "FID is the responsiveness metric" — FID was replaced by **INP** in March 2024. Saying FID in 2026 dates you.
- "TTFB is a frontend metric" — TTFB is mostly *backend* + network; it's the floor LCP builds on. A slow TTFB is a backend problem surfacing in frontend numbers.
- "RUM performance data is one number" — it's a *distribution*. Report p75/p95 by device and geography; the average hides the users who are suffering.
- "Session replay records the screen" — it reconstructs from DOM mutations and events, which is exactly why PII masking is both possible and mandatory.

**What follows from this topic**

Frontend telemetry is high-volume and high-cardinality by nature (every user, device, URL, and session is a dimension), so it flows directly into **Cost, Cardinality & Retention Management** — RUM is one of the fastest ways to blow up a bill. The SLO-from-RUM thread connects back to SLIs/SLOs and error budgets, and the "connect a browser trace to backend spans" thread is distributed tracing extended to the edge. When a scenario in the **Scenario & Troubleshooting Playbooks** topic says "users say it's slow but dashboards are green," this is the topic that explains why — and where to look.

### Q1. What's the difference between black-box and white-box monitoring, and why do you need both?

**Black-box** monitoring observes the system from the *outside*, as a user experiences it, with no knowledge of internals: "Does `https://acme.example/login` return 200 in under 500ms? Does the checkout journey complete?" It's symptom-oriented — it tells you something is broken the way a user would notice.

**White-box** monitoring exposes *internal* state: queue depth, GC pause time, cache hit ratio, per-handler latency, connection-pool saturation. It's cause-oriented — it tells you *why*.

You need both because they answer different questions. Black-box catches the failures white-box misses (a broken CDN edge, an expired TLS cert, a DNS problem — none of which your app metrics see) and validates the *whole* path end-to-end. White-box gives you the internal signals to diagnose *why* the black-box probe failed. A classic mapping: **page (alert) on black-box symptoms** (user-facing SLO breach), **debug with white-box** internals. Synthetic monitoring is the canonical black-box tool; Prometheus app metrics are white-box.

### Q2. What is synthetic monitoring and when is it the right tool?

Synthetic monitoring runs **scripted, scheduled checks** against your system from one or more locations — from a simple HTTP uptime probe to a full scripted browser journey (log in, add to cart, check out). Tools: `blackbox_exporter` (Prometheus-native HTTP/TCP/ICMP/TLS probing), Pingdom, Grafana Synthetic Monitoring, Checkly (Playwright-based journeys), Datadog Synthetics.

It's the right tool when you need **determinism and coverage independent of real traffic**:

- **Pre-launch / low-traffic**: RUM has nothing to measure if nobody's there yet. Synthetics test before and regardless of users.
- **Critical user journeys**: assert the money-path (login → cart → pay) works, continuously, from the user's perspective.
- **Uptime & SLA reporting**: a steady heartbeat you can compute availability from.
- **Infrastructure edges RUM can't see**: TLS/cert expiry, DNS resolution, redirect chains, from multiple geographies.
- **Catch it before users do**: a probe every 30s notices the outage before the first user complaint.

```yaml
# blackbox_exporter module: probe an HTTPS endpoint, assert 2xx + cert validity
modules:
  http_2xx:
    prober: http
    timeout: 5s
    http:
      valid_status_codes: [200]
      fail_if_ssl: false
      fail_if_not_ssl: true
      preferred_ip_protocol: ip4
```

```yaml
# Prometheus scrape that probes targets THROUGH blackbox_exporter
scrape_configs:
  - job_name: blackbox-http
    metrics_path: /probe
    params: { module: [http_2xx] }
    static_configs:
      - targets: ['https://acme.example/health', 'https://acme.example/login']
    relabel_configs:
      - source_labels: [__address__]
        target_label: __param_target
      - source_labels: [__param_target]
        target_label: instance
      - target_label: __address__
        replacement: blackbox-exporter:9115
```

Then `probe_success == 0` alerts on down, and `probe_ssl_earliest_cert_expiry - time() < 7*24*3600` catches certs expiring within a week.

### Q3. What are the pros and cons of synthetic monitoring versus RUM?

| | Synthetic | RUM |
|---|---|---|
| Data source | Scripted robot | Real user sessions |
| Traffic needed | None | Yes (and enough for stats) |
| Determinism | High — same script, same path | Low — real-world variety |
| Pre-launch | ✅ Works | ❌ Nothing to measure |
| Device/network diversity | ❌ Only what you script | ✅ Whatever users actually have |
| Consistency for regression detection | ✅ Controlled baseline | ❌ Noisy |
| Reflects real UX | ⚠️ Approximation | ✅ Ground truth |
| Cost driver | Probe frequency × locations | Traffic volume × cardinality |

**Synthetic pro**: deterministic, works with zero traffic, great for regression detection and SLA baselines because the variables are controlled. **Synthetic con**: it can't reflect the real diversity of users — you only test the devices, networks, and paths you thought to script, so it misses the long tail (that one Samsung browser, that one 3G region).

**RUM pro**: it *is* real user experience — every device, network, geography, and journey your users actually take. **RUM con**: needs traffic, is statistically noisy, and won't tell you about a broken flow nobody exercised in the sample window.

The senior answer: they're complementary. Synthetics are your continuous, controlled smoke test; RUM is your ground-truth distribution. Alert on synthetics for availability, alert on RUM for real user-experience SLOs.

### Q4. Explain the Core Web Vitals — what each measures and why they matter.

Google's **Core Web Vitals** are three field metrics capturing loading, interactivity, and visual stability:

| Vital | Measures | "Good" | "Poor" |
|---|---|---|---|
| **LCP** — Largest Contentful Paint | Loading: time until the largest visible element (hero image, headline) renders | ≤ 2.5s | > 4.0s |
| **INP** — Interaction to Next Paint | Responsiveness: worst-ish interaction latency across the whole visit (clicks, taps, keypresses) | ≤ 200ms | > 500ms |
| **CLS** — Cumulative Layout Shift | Visual stability: how much content unexpectedly jumps during load | ≤ 0.1 | > 0.25 |

**LCP** proxies "how fast did the useful content appear." Dominated by TTFB, render-blocking resources, and image load. **INP** (which replaced FID in March 2024) measures the latency from a user interaction to the next frame painted — it captures *ongoing* responsiveness, not just the first input, so a janky app scores badly. **CLS** captures the infuriating "I went to tap the button and an ad pushed it down" — measured as impact fraction × distance fraction of unexpected shifts.

They're evaluated at the **p75** across real users (that's the field standard), so you're optimizing the experience of your slower quartile, not the median. They matter for two reasons: (1) they're a validated UX proxy — worse vitals correlate with bounce and lost conversion; (2) Google uses them as a **search ranking signal**, so they hit both UX and SEO. Improve LCP by fixing TTFB, preloading the LCP image, and cutting render-blocking JS/CSS; improve INP by breaking up long tasks and yielding to the main thread; improve CLS by reserving space (width/height on images, `min-height` on ad slots).

### Q5. How do you do frontend error tracking, and what role do source maps play?

Frontend error tracking captures **client-side exceptions** — uncaught JS errors, unhandled promise rejections, framework error boundaries, failed resource loads — and ships them to a service (Sentry is the canonical choice; also Bugsnag, Rollbar, Datadog RUM) with the context needed to debug: browser, OS, URL, breadcrumbs (the user actions leading up to the error), and the release version.

The core problem: production JS is **minified and bundled**, so a raw stack trace reads `t.default @ main.a1b2.js:1:48213` — useless. **Source maps** solve this: at build time you generate a `.map` file that maps minified positions back to original source (file, line, column, symbol names). You upload source maps to the error tracker (privately — never serve them publicly; that leaks source) so incoming errors get *symbolicated* into readable traces pointing at `src/checkout/PaymentForm.tsx:42`.

**Release tracking** ties it together: tag every error with the deploy version (and associate the source maps with that version). Now you can see "these errors started with release `v2.4.0`," compute crash-free-session rates per release, and cut a release short if error rate spikes. The senior workflow: error tracker → group by fingerprint → sort by frequency × affected users → see it started at a specific release → correlate with the deploy → roll back or fix.

```javascript
Sentry.init({
  dsn: "https://examplePublicKey@o0.ingest.sentry.io/0",
  release: "acme-web@2.4.0",       // ties errors to a deploy + its source maps
  environment: "production",
  tracesSampleRate: 0.1,           // 10% of transactions traced
  replaysOnErrorSampleRate: 1.0,   // capture session replay when an error fires
});
```

### Q6. How do you extend distributed tracing into the frontend?

You instrument the browser with **OpenTelemetry's web SDK** (or a vendor's browser agent) so that page loads, user interactions, and outbound `fetch`/`XHR` calls become **spans** — and, critically, so those spans **propagate trace context** to the backend.

The mechanism: the OTel `fetch`/`xhr` instrumentation injects the W3C **`traceparent`** header into outbound requests. The backend's OTel instrumentation reads that header and continues the *same* trace. Result: a single trace spans **browser → API gateway → services → database**, so a "this button is slow" report resolves to a waterfall showing the browser did a 40ms render, then waited 1.8s on `GET /api/cart`, which spent 1.6s in a downstream inventory service.

```javascript
import { WebTracerProvider } from '@opentelemetry/sdk-trace-web';
import { getWebAutoInstrumentations } from '@opentelemetry/auto-instrumentations-web';
import { registerInstrumentations } from '@opentelemetry/instrumentation';

const provider = new WebTracerProvider();
provider.register();
registerInstrumentations({
  instrumentations: [getWebAutoInstrumentations({
    // propagate trace context to your own API, not third parties
    '@opentelemetry/instrumentation-fetch': {
      propagateTraceHeaderCorsUrls: [/https:\/\/api\.acme\.example\/.*/],
    },
  })],
});
```

Two caveats: (1) only propagate to **your own** backends (the `propagateTraceHeaderCorsUrls` allowlist) — spraying `traceparent` at third parties leaks nothing sensitive but triggers CORS and is noise; and (2) frontend traces are **high volume**, so sample aggressively (head-sample at the browser or tail-sample at a collector) — see the cost topic.

### Q7. What is Real User Monitoring (RUM) and what dimensions does it capture?

RUM instruments the **actual client** — browser or mobile app — to capture what real users experience, then ships it to a backend for aggregation. Unlike synthetics, it's ground truth: the data comes from real sessions on real devices over real networks.

What it captures, and the dimensions that make it powerful:

- **Performance**: Core Web Vitals (LCP/INP/CLS), TTFB, FCP, resource timings, page-load and route-change durations — as *distributions*, not averages.
- **Geography**: country/region — so you can see APAC users get 2× the LCP of EU users.
- **Device**: model, CPU class, memory, screen — the low-end Android tail that dominates real-world p75.
- **Network**: connection type (4G/wifi/slow-2G), effective bandwidth, so you separate "our app is slow" from "their network is slow."
- **Browser/OS**: version breakdowns that surface "only broken on Safari 16."
- **Errors & crashes**: JS exceptions (browser), crashes/ANRs (mobile), tied to sessions.
- **Business context**: which route, which user segment, converted or not.

The reason to capture all these dimensions is **segmentation**: the aggregate LCP might look fine while your slow-network, low-end-device users in one region are having a terrible time. RUM lets you slice to find them. The cost of all those dimensions is **cardinality** — which is exactly why RUM needs careful sampling and why it flows into the cost topic.

### Q8. What frontend performance metrics beyond Core Web Vitals do you track, and why?

Core Web Vitals are the headline, but they don't fully explain *why* a page is slow. The supporting cast:

- **TTFB (Time To First Byte)** — server processing + network latency before any byte arrives. It's the **floor** for LCP: if TTFB is 1.5s, LCP can't beat 1.5s. A bad TTFB is usually a *backend* problem (slow origin, cold cache, no CDN) surfacing in frontend numbers.
- **FCP (First Contentful Paint)** — first pixel of *any* content. The gap between FCP and LCP tells you whether the hero content specifically is slow.
- **DOMContentLoaded / Load** — classic milestones; still useful for SPAs' initial shell.
- **Long tasks / Total Blocking Time (TBT)** — main-thread blocks > 50ms; the lab proxy for INP problems. If TBT is high, your JS is janking interactions.
- **Resource timing** — per-asset load times (that 900KB render-blocking font, the slow third-party analytics script).
- **JS error rate / crash-free sessions** — a fast page that throws is still broken.
- **Route-change / SPA navigation timing** — for single-page apps, the "click a link" latency the browser's built-in Navigation Timing doesn't capture.

Why track them: Core Web Vitals tell you *that* it's bad; these tell you *where* — is it the server (TTFB), the bundle (TBT/long tasks), a specific asset (resource timing), or code (error rate)? That's the difference between an alert and a fix.

### Q9. What is session replay and when is it worth the cost and risk?

**Session replay** reconstructs a user's session as a video-like playback — but it does *not* record real pixels or screen video. It captures **DOM mutations, input events, network events, and console logs**, then re-renders the DOM to reproduce what the user saw and did. Tools: Sentry Replay, FullStory, LogRocket, Datadog RUM, Hotjar.

**When it's worth it**: reproducing hard-to-describe bugs ("it broke but I don't know what I clicked"), understanding rage-clicks and dead-clicks, seeing the exact interaction that preceded an error (pair it with error tracking so a replay attaches to each crash), and UX research on confusing flows. It turns "can't reproduce" into "watch exactly what happened."

**Cost and risk**: it's **high volume** (every DOM change per session) — so you sample (e.g. 10% of sessions plus 100% of error sessions) and it drives storage cost. The bigger issue is **privacy**: because it captures the DOM, it will capture whatever's on screen — names, emails, card numbers, health data. You *must* mask PII aggressively: block/mask input fields by default, redact sensitive selectors, and scrub before it leaves the client. The senior stance: enable it selectively (error sessions, sampled sessions), mask by default rather than allow-listing what to hide, and treat replay data as sensitive PII with matching retention and access controls.

### Q10. How do you monitor a mobile app — what's different from web?

Mobile shares RUM concepts (performance, errors, real-user distributions) but adds constraints and metrics the web doesn't have:

- **Crash reporting** is the headline metric: **crash-free session rate** and **crash-free user rate** are the core mobile SLIs. Tools: Firebase Crashlytics, Sentry, Bugsnag. Native crashes need **symbolication** with dSYMs (iOS) / ProGuard/R8 mapping files (Android) — the mobile analog of source maps.
- **ANRs (Application Not Responding)** — the UI thread blocked long enough (~5s Android) that the OS offers to kill the app. A distinct, critical signal with no web equivalent.
- **App start time** — cold vs warm start; a key UX metric users feel immediately.
- **Battery, memory, and network usage** — mobile-specific resource pressure; a leak or chatty network kills reviews.
- **Release adoption & versioning** — unlike web (everyone's on the latest deploy instantly), mobile has **many app versions live at once** because users update slowly. You must track metrics *per app version* and manage staged rollouts (roll out to 5% and watch crash-free rate before going 100%).
- **Offline & flaky networks** — mobile spends real time offline; you monitor sync failures and retry behavior.

The mental shift: on web you control the runtime (one deploy). On mobile you ship a binary to a fragmented fleet you can't instantly update, so **per-version, staged, crash-first** monitoring with the ability to halt a rollout is the game.

### Q11. Why is frontend observability uniquely hard?

Three structural reasons, all of which push you toward sampling and careful cardinality control:

1. **Enormous device/network/browser variety.** The backend runs on hardware you chose and can profile. The frontend runs on thousands of device models, dozens of browser versions, and every network condition from fiber to congested 3G. Your p75 is dominated by a long tail you don't own and can't reproduce. This is why RUM reports *distributions by segment*, not averages.

2. **You don't control the runtime.** You can't attach a profiler to a stranger's phone. You get only what you instrumented and what the browser's APIs (`PerformanceObserver`, `web-vitals`) expose. Blind spots are the default; you have to instrument deliberately.

3. **Volume and cardinality explode.** Every user, session, device, browser version, geography, and URL is a dimension. Naively, "LCP by full URL by device by country" is millions of series or an unbounded event stream. Third-party scripts, ad blockers, and beacon loss add noise and gaps. This forces **sampling** (you can't collect 100% of everything) and **cardinality discipline** (normalize URLs to route templates, bucket devices into classes), which in turn means your numbers are statistical estimates, not exact counts.

The senior framing: frontend observability is a *sampling and segmentation* problem on top of the usual three pillars — you're inferring the experience of a fleet you don't control from a sampled, lossy, high-cardinality stream.

### Q12. How do you define and alert on a user-facing SLO using RUM data?

The point of RUM is to let you set SLOs **where the user is**, not where your servers are. The recipe:

**1. Pick an SLI that's a ratio of good events over valid events**, measured client-side. For loading: `LCP-good ratio = (page views with LCP ≤ 2.5s) / (total page views)`. For responsiveness: INP ≤ 200ms ratio. For reliability: crash-free / error-free session ratio.

**2. Set the SLO target over a window** — e.g. "95% of page views have good LCP over 28 days." (28 days matches the Core Web Vitals field window.)

**3. Alert on error-budget burn, not raw dips.** Compute the burn rate of the budget (`1 − 0.95 = 5%` budget) and use **multi-window, multi-burn-rate** alerting so you page on fast burns and ticket on slow ones — same discipline as backend SLOs.

**4. Segment before you alert.** Because RUM aggregates hide suffering subgroups, alert on the segments that matter (e.g. LCP-good ratio for your top revenue geographies) or at least dashboard them, so a regional CDN problem isn't averaged away.

```promql
# LCP "good" ratio over the trailing window, from RUM metrics exported to Prometheus
sum(rate(rum_lcp_seconds_bucket{le="2.5"}[28d]))
/
sum(rate(rum_lcp_seconds_count[28d]))
# page when this drops below the SLO (0.95) with a multi-burn-rate alert
```

The key move senior candidates make: the SLO is defined on the *client-observed* experience, the alert is symptom-based (users are having a bad time), and diagnosis then drops into backend metrics/traces to find the cause.

### Q13. How do you correlate a frontend problem to its backend cause?

The whole design goal is to make "the page is slow/broken" resolve to a specific backend culprit instead of a shrug. Three connective mechanisms:

1. **Trace context propagation (the strongest link).** With OTel browser instrumentation injecting `traceparent` into your API calls, a slow browser span links to the exact backend trace. You see the browser waited 1.8s on `GET /api/cart`, click into the trace, and land on the downstream service and DB query responsible. One trace, browser to database.

2. **Shared correlation IDs / context.** Even without full tracing, stamp requests with a request ID and include the **release version**, route, and user segment on both frontend and backend telemetry. Now you can join "frontend errors spiked on route X in region Y after release Z" to "backend p99 on `/api/x` rose at the same time."

3. **Time + deploy correlation.** Overlay frontend RUM metrics and backend metrics on the same dashboard with deploy markers. A simultaneous frontend LCP regression and backend TTFB rise at a deploy boundary points straight at that release.

The debugging flow in practice: RUM/synthetic says users are slow on a route → find a representative slow session/trace → follow the propagated trace into the backend → identify the slow span (service, query, downstream) → confirm with that service's white-box metrics/logs. Without propagation you're guessing; with it, the frontend symptom and backend cause are two ends of the same trace.

### Q14. What privacy considerations apply to RUM and session replay?

Frontend telemetry runs *inside the user's client*, so it can trivially capture PII — and often does by accident. The obligations:

- **Session replay is the biggest risk.** It reconstructs the DOM, so it captures whatever's rendered: names, emails, card numbers, addresses, health info. **Mask by default** — block/redact all input fields and known-sensitive selectors, and prefer an allow-list of what to *show* over a block-list of what to hide (fail closed). Scrub client-side before data leaves the device.
- **URLs and query strings** frequently smuggle PII (`?email=`, tokens, IDs). Strip or hash query params and normalize URLs to route templates before ingest — this helps cardinality too.
- **Error payloads** — stack traces, breadcrumbs, and local variables can contain user data. Configure `beforeSend` scrubbing; don't attach raw request bodies.
- **IP and geolocation** — treat IP as PII (GDPR does); truncate/anonymize, derive coarse geography, don't store raw.
- **Consent & regulation** — GDPR/CCPA may require consent before RUM/replay; honor Do-Not-Track and cookie/consent choices, and gate collection accordingly.
- **Retention & access** — apply short retention to replay/RUM PII and lock down who can view replays; it's sensitive data, not ops telemetry.

The interview signal: you proactively treat frontend telemetry as PII-bearing and design masking/scrubbing/consent in from the start, rather than discovering card numbers in your replay tool after a breach.

### Q15. How do you monitor third-party API and endpoint uptime, and set SLAs?

Two angles: monitoring the endpoints **you expose** (your uptime/SLA to customers) and the third parties **you depend on** (which can break your app even when your code is fine).

**For your own endpoints (SLA reporting):** run **synthetic probes** (blackbox_exporter, Checkly, Pingdom) from **multiple geographic locations** at a fixed cadence against your critical endpoints and journeys, plus RUM/server-side success ratios for real traffic. Compute availability as `successful probes / total probes` and latency percentiles over the SLA window. Probe from multiple regions so a single failing edge doesn't silently break users while your one probe stays green — and so you can *prove* availability per region for contractual SLAs. Alert on `probe_success == 0` and on latency SLO burn.

**For third-party dependencies:** instrument every outbound call to a third party with its own **client-side SLIs** — success rate, latency, timeout/error counts, per provider — because their outage becomes *your* incident. Add synthetic checks against their status/health where possible, wire up circuit-breaker and fallback metrics, and dashboard "are our dependencies healthy" separately so you can immediately answer "is it us or them?"

**On SLAs vs SLOs:** the **SLA** is the contractual promise to customers (with penalties); your internal **SLO** should be *stricter* than the SLA so you get paged and fix things with budget to spare before you breach the contract. Measure the SLA from the user's vantage point (multi-region synthetics + RUM), not from inside your datacenter where everything always looks up.

## Cost, Cardinality & Retention Management

### Summary

**What this topic covers**

At scale, observability stops being a technical problem and becomes an *economic* one: it's routine for the monitoring bill to rival — or exceed — the infrastructure it monitors. This topic covers why that happens and how to control it: the mechanics of **cardinality** (why one bad label turns thousands of series into millions), how to **detect** cardinality problems (Prometheus TSDB stats, `/api/v1/status/tsdb`, `count by (__name__)`), how to **control** metric cardinality (`metric_relabel_configs`, route normalization, bounded label sets, aggregation at ingest), **log cost control** (sampling, dropping DEBUG, tiered retention, don't-log-what-should-be-a-metric), **trace cost control** (head vs tail sampling), **retention tiers and downsampling** (Thanos/Mimir compactor, object storage for cheap cold data), **recording rules** to pre-aggregate, **per-tenant cardinality limits/quotas**, the **build-vs-buy** cost calculus, spend attribution/showback, and the "our bill 10×'d — investigate" scenario. The 15 questions run from "why does cardinality cost money" to a full cost-investigation playbook.

**Mental model**

Every observability signal has a **cost function**, and your job is to keep the signal you need while cutting the volume you don't. For **metrics**, cost ≈ number of active time series, and series count = the product of every label's distinct values — so cost is *multiplicative* in cardinality, and one unbounded label (user_id, request_id, raw URL) is a bomb. For **logs**, cost ≈ bytes ingested + bytes indexed + retention duration; the levers are volume (sampling, dropping) and how long/how indexed you keep them. For **traces**, cost ≈ spans stored, controlled by sampling rate and *where* you sample. The unifying discipline is **tiered retention + downsampling**: keep high-resolution data briefly and hot, roll it up to coarse resolution for the long term on cheap object storage, and pre-aggregate the expensive queries with recording rules. The senior instinct: treat telemetry like a budget you allocate deliberately, put guardrails (quotas, relabel drops) *before* ingest, and know that the single fastest way to 10× your bill is an accidental high-cardinality label.

**Key terms**

- **Cardinality** — the number of unique label-value combinations for a metric; equals the number of time series it produces.
- **Time series** — a unique metric name + label set; the atomic unit of metric storage and cost.
- **High-cardinality label** — a label with many/unbounded distinct values (user_id, request_id, email, full URL, session_id). The #1 cost and performance killer.
- **`metric_relabel_configs`** — Prometheus scrape-time rules to drop/keep/rewrite metrics and labels *before* storage.
- **Head sampling** — decide to keep/drop a trace at the start, before knowing its outcome (cheap, blind).
- **Tail sampling** — decide after the whole trace is complete, so you can keep errors/slow ones (smart, needs a stateful collector).
- **Downsampling** — reducing time resolution for older data (5m/1h rollups) to shrink long-term storage.
- **Retention tier** — a storage class defined by age: hot high-res short-term vs cold downsampled long-term.
- **Recording rule** — a Prometheus rule that precomputes an expensive/aggregated query into a new series on a schedule.
- **Showback / chargeback** — attributing observability spend back to the team/service that generated it (visibility vs actual billing).
- **Quota / cardinality limit** — a per-tenant cap on series/samples (Mimir/Cortex) that rejects overflow instead of letting one tenant blow up the cluster.
- **Custom metric** — in managed vendors (Datadog), a billed unit; each unique tag combination is often a separate billed custom metric.

**Why interviewers ask this**

Anyone can `pip install` an exporter and scrape everything. The senior signal is knowing that **"collect everything forever" is a business-ending default** and being able to make deliberate cost/signal tradeoffs. Interviewers want to see that you understand cardinality *mechanically* (not just "it's bad" but "it's the product of label values, and it's multiplicative"), that you can *find* the offending metric with real commands, and that you have a toolkit of *bounded* controls (relabel drops, route normalization, quotas, sampling, downsampling) rather than just "log less." They're also probing whether you grasp the managed-vendor billing traps (Datadog custom metrics and per-host pricing) versus the operational burden of self-hosting. This is the topic that separates engineers who've only *used* observability from those who've *owned the budget* for it.

**Common confusions**

- "More labels = better observability" — more *unbounded* labels = an outage and a bill. Labels must be bounded sets; put high-cardinality identifiers in traces/logs, not metric labels.
- "Cardinality is about the number of metrics" — it's about the number of *series*: one metric with a user_id label can be millions of series.
- "Sampling loses the errors I care about" — head sampling might; **tail** sampling keeps 100% of errors/slow traces and drops boring successes.
- "We'll just keep everything at full resolution forever" — that's the expensive default; downsample old data and tier it to object storage.
- "Recording rules are just convenience" — they *reduce query cost and load* by precomputing; they're a cost control, not just ergonomics.
- "Managed means no cost work" — managed shifts the cost from ops effort to a billing meter that punishes cardinality and hosts; the cardinality discipline is identical.

**What follows from this topic**

Cost discipline touches everything upstream. **Frontend/RUM** is a top cardinality source (every user/device/URL is a dimension). The **metrics** topic's counter/gauge/histogram and PromQL knowledge is what you use to detect and control cardinality. **Recording rules and downsampling** connect to long-term storage (Thanos/Mimir/Cortex). And the "**our bill exploded / Prometheus is OOMing**" scenarios reappear as concrete debugging exercises in the **Scenario & Troubleshooting Playbooks** topic — cardinality hunting is one of the most common senior interview scenarios.

### Q1. Why does observability cost explode at scale, and how big does it get?

Observability cost grows *faster* than the system it monitors because each pillar has a volume driver that scales with a *cross-product*, not linearly:

- **Metrics** scale with **cardinality** — series count is the product of every label's distinct values. Add one high-cardinality label and series (and storage, and query cost) multiply.
- **Logs** scale with **request volume × verbosity × retention** — a chatty DEBUG line on a hot path is gigabytes/day, and you pay to ingest, index, *and* store it for the retention window.
- **Traces** scale with **request volume × spans/request** — a microservices request touching 20 services is 20+ spans, at 100% sampling.

On top of that, **vendor billing models** amplify it: per-host pricing (Datadog charges per monitored host, per container), per-custom-metric pricing (each unique tag combination can be a billed custom metric — so cardinality is *literally* your bill), and per-GB ingest/retention for logs. These meters turn an innocent label change into a step-change in cost.

The result, routinely cited by teams and vendors alike: the observability bill **rivals or exceeds the production infrastructure bill**. It's common for monitoring to be a top-3 line item. That's why senior SREs treat telemetry as a budgeted resource with guardrails, not a free byproduct of running services.

### Q2. Explain cardinality in depth — why is it the number-one cost and performance killer?

**Cardinality = the number of unique label-value combinations for a metric = the number of time series it creates.** In a dimensional TSDB (Prometheus), each distinct combination of `metric_name{label1=v1, label2=v2, ...}` is a **separate time series** with its own in-memory index entry, its own chunk on disk, and its own contribution to every query.

The killer property is that it's **multiplicative**. Suppose `http_requests_total` has labels `method` (5 values), `status` (6), `handler` (20): that's 5 × 6 × 20 = **600 series** — fine. Now someone adds `user_id`:

```
http_requests_total{method, status, handler, user_id}
= 5 × 6 × 20 × (number of users)
= 600 × 1,000,000 users
= 600,000,000 series   # cluster death
```

A single **unbounded** label — `user_id`, `request_id`, `session_id`, `email`, full `url`/`path` with IDs in it, error message strings — turns thousands of series into millions or billions. That's why it's #1:

- **Memory**: Prometheus holds the series index and recent samples in RAM; high cardinality → OOM.
- **Storage & cost**: more series = more chunks = more disk = (in managed vendors) more billed custom metrics.
- **Query performance**: every aggregation scans matching series; millions of them make queries slow or impossible.

The rule that falls out: **metric labels must be bounded, low-cardinality sets** (enumerable: method, status code, region, service). Anything unbounded or per-request belongs in **traces or logs**, where high cardinality is the *point* and the storage model expects it — not in metric labels.

### Q3. How do you detect a cardinality problem in Prometheus?

Prometheus ships the tools to find it; you don't have to guess.

**1. The TSDB status page / API** — the fastest overview. `GET /api/v1/status/tsdb` (or the "TSDB Status" UI page) returns the top offenders:

```bash
curl -s http://prometheus:9090/api/v1/status/tsdb | jq '.data | {
  seriesCountByMetricName: .seriesCountByMetricName[0:10],
  labelValueCountByLabelName: .labelValueCountByLabelName[0:10],
  seriesCountByLabelValuePair: .seriesCountByLabelValuePair[0:10]
}'
```

This directly names the metrics with the most series, the labels with the most distinct values, and the worst label=value pairs — usually the culprit is obvious here.

**2. Total and per-metric series counts via PromQL:**

```promql
# Total active series (the headline number, watch it trend)
prometheus_tsdb_head_series

# Top 10 metrics by series count
topk(10, count by (__name__)({__name__=~".+"}))

# For a suspect metric, which label is exploding it?
count(count by (user_id)(http_requests_total))   # distinct user_id values
```

**3. Trend and rate of growth** — alert on `prometheus_tsdb_head_series` climbing, and on scrape-level series counts. A metric that suddenly jumps 100× after a deploy is your smoking gun; correlate the jump with the deploy that introduced a new label.

The workflow: TSDB status → identify the metric with runaway series → `count by (<suspect_label>)` to confirm which label is unbounded → fix with relabeling (next question).

### Q4. How do you control metric cardinality?

You bound it **before ingest** with a toolkit — dropping, normalizing, and aggregating:

**1. Drop high-cardinality labels/metrics at scrape time** with `metric_relabel_configs` (runs *before* storage):

```yaml
scrape_configs:
  - job_name: api
    metric_relabel_configs:
      # Drop a whole noisy metric
      - source_labels: [__name__]
        regex: 'go_gc_duration_seconds.*'
        action: drop
      # Strip an unbounded label off an otherwise-useful metric
      - regex: 'user_id|request_id|session_id'
        action: labeldrop
```

**2. Normalize unbounded label *values* into bounded ones.** The classic offender is a raw URL path with IDs in it (`/orders/91823/items/55`). Rewrite it to a **route template** (`/orders/:id/items/:id`) at instrumentation time or via relabeling, collapsing millions of paths into a handful of routes. Same for error strings → error *classes*.

**3. Design bounded label sets from the start.** Only enumerable dimensions become labels: method, status class, region, service, route template. Per-request identifiers go to **exemplars/traces/logs**, never metric labels.

**4. Aggregate at ingest / drop unused dimensions.** If you never query by `pod`, don't keep per-pod series — aggregate to the service level. Recording rules (Q10) precompute the aggregates you actually query so you can drop the raw high-cardinality series or shorten their retention.

**5. Enforce limits** — `sample_limit` / `label_limit` / `target_limit` on scrapes reject targets that emit too many series, so a bad deploy fails loudly instead of OOMing the server. In Mimir/Cortex, per-tenant `max_global_series_per_user` caps it centrally (Q11).

The principle: **make cardinality a bounded, deliberate design choice**, enforced by guardrails at ingest, not something you discover after the OOM.

### Q5. How do you control logging cost?

Logs are the easiest pillar to overspend on because verbosity feels free at dev time and is ruinous at production volume. The levers:

- **Drop DEBUG (and often INFO) in production.** Ship WARN/ERROR by default and make verbosity dynamically raisable for a specific service during an incident. A single DEBUG line on a hot path is gigabytes/day.
- **Sample high-volume, low-value logs.** Keep 100% of errors, sample the successful/repetitive lines (e.g. 1-in-100 access logs). Head-sample by trace so a kept trace keeps its logs.
- **Don't log what should be a metric.** "Request completed in 42ms" logged per request is a metric wearing a log's clothes — it's a histogram. Counting log lines to get a rate is the anti-pattern; emit a counter/histogram and delete the line. This is the single biggest structural saving.
- **Tiered retention.** Keep hot, indexed logs for days (fast incident search), then roll to cheap object storage for weeks/months at lower index granularity, then expire. Match retention to actual need (compliance vs debugging).
- **Index less, store more.** In Loki-style systems you pay mostly for **labels/index**, not raw content — so keep labels low-cardinality (labels are for streams, not for searchable fields) and grep the content at query time. Don't index every field.
- **Structured logs** so you can sample/drop/route precisely and don't store redundant text.

The framing: decide *per log stream* what it's for. Compliance/audit → keep, cheap-tier, long. Debug spew → sample hard or convert to a metric. Errors → keep and index.

### Q6. Head sampling vs tail sampling for traces — when do you use each?

Sampling is how you keep tracing affordable, because 100% of spans at scale is enormous. The two strategies:

| | Head sampling | Tail sampling |
|---|---|---|
| **When decided** | At trace start, before outcome known | After the full trace completes |
| **Info available** | None (just the trace start) | Whole trace: latency, errors, status |
| **State needed** | Stateless, cheap | Stateful collector buffering whole traces |
| **Keeps errors/slow?** | Only by luck (probabilistic) | Yes — that's the point |
| **Cost profile** | Predictable, low overhead | Higher (buffering, memory) but smarter |
| **Where** | SDK/client | Collector that sees all spans of a trace |

**Head sampling** decides up front — "keep 10% of traces" — propagating the decision so the whole trace is consistently kept or dropped. It's cheap and predictable but *blind*: it can't preferentially keep the traces you actually want (errors, slow requests), so at 10% you drop 90% of your errors too.

**Tail sampling** buffers all spans of a trace in a stateful collector and decides *after* it's complete, so you can encode policies like "keep 100% of traces with an error, 100% over 1s, and 1% of the fast successful ones." You get the interesting traces at a fraction of the cost — but it requires a collector that sees **all** spans of a given trace (routing/consistent-hashing by trace ID across collector instances) and enough memory to buffer.

**Rule of thumb:** start with head sampling for simplicity/cost predictability; move to **tail sampling** when you need to guarantee you keep errors and outliers (which you usually do) and can run the stateful collector tier.

### Q7. How do retention tiers and downsampling reduce cost?

You almost never need full-resolution data forever, so you **tier by age** and **reduce resolution** as data gets older:

- **Hot / high-resolution / short-term**: raw samples (e.g. 15s scrape interval) kept for days to a couple weeks, on fast storage, for incident debugging and dashboards. Expensive per GB, small window.
- **Cold / downsampled / long-term**: **downsampled** rollups (5m and 1h aggregates) kept for months/years on cheap object storage (S3/GCS), for trends, capacity planning, and SLO history. You don't need 15s granularity to see last quarter's growth curve.

**Downsampling** computes, for each series, aggregated points over larger windows (min/max/sum/count/avg per 5m and 1h) so a year of data is a fraction of the raw size while preserving the shape. In the Prometheus ecosystem the **Thanos** and **Mimir/Cortex compactor** do exactly this — the compactor merges blocks, deduplicates, and produces 5m/1h downsampled resolutions on object storage, and retention is configured per resolution:

```yaml
# Thanos compactor: keep raw 30d, 5m-downsampled 90d, 1h-downsampled 1y
--retention.resolution-raw=30d
--retention.resolution-5m=90d
--retention.resolution-1h=1y
```

The cost win is large: raw retention is short (small × expensive), long retention is downsampled (large window × tiny per-point × cheap object storage). Queries automatically pick the right resolution for the time range. Same idea applies to logs (hot indexed → cold object storage) and traces (short full retention). The principle: **resolution and storage class should decay with age.**

### Q8. What role does object storage play in observability cost?

**Object storage (S3, GCS, Azure Blob) is the enabler of cheap, effectively-unlimited long-term retention** — it's the reason modern observability stacks can keep months of data without a linear cost explosion. It changed the architecture from "everything lives in expensive local SSD attached to the TSDB" to "recent data is hot local, everything else is durable object storage."

Why it matters for cost:

- **Cheap per GB** — an order of magnitude cheaper than block/SSD, with 11-nines durability and no capacity you have to provision. Long-term, downsampled data lives here for a fraction of hot-storage cost.
- **Decoupled storage from compute** — Thanos, Mimir, Cortex, and Loki all ship blocks/chunks to object storage and run stateless query/store components against it. You scale storage (cheap) independently of query capacity (elastic), instead of buying ever-bigger Prometheus nodes.
- **Enables tiering and downsampling** — the compactor writes downsampled blocks to object storage; the store-gateway serves historical queries from it. Hot local, cold object.
- **Operational simplicity** — no giant local disks to manage, snapshot, or lose; durability is the provider's problem.

The tradeoff is **query latency** — object storage is slower than local SSD, so historical queries are slower and you rely on caching (index caches, chunk caches) and the store-gateway. That's an acceptable trade: you want *fast* queries on recent hot data and *cheap* queries on old cold data. The senior point: object storage is what makes "keep a year of metrics" a line item you can afford rather than a budget catastrophe.

### Q9. Your Prometheus is OOMing. Walk through diagnosing and fixing it.

Prometheus memory is dominated by the **head block** — the in-memory index and recent samples of all *active series* — so OOM is almost always a **cardinality** problem. The playbook:

**1. Confirm it's cardinality (not just under-provisioning).** Check `prometheus_tsdb_head_series` — is it high and *climbing*? A step-jump correlated with a deploy is the tell.

```promql
prometheus_tsdb_head_series                 # total active series, trending up?
rate(prometheus_tsdb_head_samples_appended_total[5m])  # ingest rate
```

**2. Find the offender** via `/api/v1/status/tsdb` (top metrics by series, top labels by distinct values) and:

```promql
topk(10, count by (__name__)({__name__=~".+"}))   # which metric owns the series
count(count by (user_id)(suspect_metric))           # confirm the unbounded label
```

You're looking for a metric whose series count exploded and the specific label doing it (user_id, request_id, a raw URL/path, an error string, a pod that churns).

**3. Fix at the source, then at the scrape.**
- Best: stop emitting the unbounded label in the instrumentation (normalize path → route template, move the identifier to a trace/log).
- Fast mitigation: drop it at ingest — `metric_relabel_configs` `labeldrop`/`drop`, and set `sample_limit`/`label_limit` so a bad target is rejected instead of OOMing you.

**4. Then relieve pressure structurally.** Add recording rules for the aggregates you actually query and shorten retention on the raw high-cardinality series; shard/scale Prometheus by service; and if you need long retention/HA, move to Thanos/Mimir so the local head stays small.

**5. Add a guardrail so it can't recur** — per-target `sample_limit`, and (in Mimir/Cortex) a per-tenant series quota that rejects overflow. The lesson to state in the interview: OOM is a *symptom*; the disease is an unbounded label, and the durable fix is bounding it at the source plus a quota so the next bad deploy fails loudly instead of taking down monitoring.

### Q10. How do recording rules reduce cost, and when should you use them?

A **recording rule** precomputes a PromQL expression on a schedule and stores the result as a **new, smaller time series**, so expensive queries run against the pre-aggregated series instead of scanning raw data every time.

Two cost benefits:

1. **Query cost / load reduction.** A dashboard or alert that aggregates over thousands of series (`histogram_quantile(0.99, sum by (le, service)(rate(http_request_duration_seconds_bucket[5m])))`) is expensive to evaluate repeatedly across many panels and alert evaluations. Compute it *once* per interval as a recording rule; every dashboard/alert then reads one cheap series. This slashes CPU and query latency, especially against object-storage-backed historical data.

2. **Storage/cardinality reduction via aggregation.** Precompute the aggregated view you actually query (per-service, per-route) and you can **drop or shorten retention on the raw high-cardinality series** — keep the rolled-up series long-term, expire the raw quickly.

```yaml
groups:
  - name: slo-recording
    interval: 30s
    rules:
      - record: service:http_request_duration_seconds:p99
        expr: histogram_quantile(0.99,
                sum by (le, service)(rate(http_request_duration_seconds_bucket[5m])))
      - record: service:http_requests:error_ratio5m
        expr: sum by (service)(rate(http_requests_total{status=~"5.."}[5m]))
              / sum by (service)(rate(http_requests_total[5m]))
```

**When to use:** any expression that's expensive *and* queried repeatedly — SLO/error-budget numerators and denominators, p99 latencies on dashboards, alert expressions, and anything you query over long time ranges. **When not to:** one-off exploratory queries (not worth a persistent series) and anything you'd need at arbitrary un-pre-aggregated granularity. Standard practice: back your **SLO burn-rate alerts** with recording rules so alert evaluation is cheap and consistent.

### Q11. How do per-tenant cardinality limits and quotas work in multi-tenant systems?

In a shared, multi-tenant metrics backend (**Mimir, Cortex**, or a managed vendor), one team's runaway cardinality can OOM the cluster and degrade *everyone*. **Per-tenant limits and quotas** are the guardrail: hard caps, enforced at ingest, that reject a tenant's overflow instead of letting it consume shared capacity.

The key limits (Mimir/Cortex `limits` config, overridable per tenant):

```yaml
limits:
  max_global_series_per_user: 1500000      # total active series for the tenant
  max_global_series_per_metric: 200000     # cap a single metric's series
  max_label_names_per_series: 30
  ingestion_rate: 250000                    # samples/sec
  ingestion_burst_size: 500000
```

How it behaves and why it's good:

- **Fail the noisy tenant, protect the neighbors.** When a tenant exceeds its series quota, *its* new series are rejected (with a clear error) while everyone else is unaffected — blast-radius containment. A bad deploy that adds a `user_id` label hits its own quota and gets a loud 4xx instead of silently drowning the cluster.
- **Per-tenant overrides** let you give large teams more headroom while keeping defaults tight.
- **Forces accountability** — the rejection error lands on the team that caused it, turning cardinality into *their* problem to fix, which is exactly the right incentive.
- **Pairs with rate limits** — `ingestion_rate`/`burst` cap samples/sec so a runaway exporter can't overwhelm ingesters.

The senior framing: quotas convert cardinality from a *shared, invisible* failure mode into a *per-tenant, visible, self-inflicted* one — you make the cost boundary explicit and enforced, and you pair it with showback (Q13) so teams see both the limit and the bill.

### Q12. Walk through the build-vs-buy cost calculus for observability.

There's no universal answer; you're trading **operational effort** against **billing exposure**, and the crossover depends on scale and team.

**Self-host (build) — e.g. Prometheus + Mimir/Thanos + Loki + Tempo + Grafana:**
- *Pros:* no per-host/per-metric meter — cost is your infrastructure (compute + cheap object storage), which scales *sub-linearly* with good cardinality discipline; full control over retention, cardinality, and data locality; no data-egress or PII-leaving-your-VPC concerns.
- *Cons:* real engineering cost to run — you own scaling, upgrades, HA, storage, and being on-call for your monitoring. At small scale that people-cost dwarfs any vendor bill. You need the expertise the previous questions describe.

**Managed / SaaS (buy) — e.g. Datadog, Grafana Cloud, New Relic, Honeycomb:**
- *Pros:* fast time-to-value, no ops burden, integrated pillars, someone else is on-call for the platform. Right when engineering time is your scarcest resource.
- *Cons:* **billing traps** that punish exactly the things you can't always control — **per-host/per-container** pricing (a big autoscaling fleet is expensive), **per-custom-metric** pricing where *each unique tag combination is a billed metric* (so cardinality is *literally* your invoice), per-GB log ingest/retention, and per-span trace costs. Bills can 10× from an innocent label and are hard to predict.

**The calculus:** at small/medium scale, **buy** — your engineers are more valuable building product than running Mimir. At large scale with cardinality-heavy workloads, the SaaS meter can exceed the salary cost of a small platform team, and **self-hosting on object storage** wins — *provided* you have the cardinality discipline to keep it cheap. Many end up **hybrid**: self-host high-volume metrics/logs, buy for tracing or frontend RUM. Whatever you pick, the cardinality/retention discipline from this topic is required either way — managed just turns a technical failure into a billing one.

### Q13. How do you attribute and show back observability spend?

You can't control what you can't attribute. **Showback** (visibility) and **chargeback** (actual internal billing) tie observability spend back to the team/service that generated it, which is what turns cost from a central platform headache into each team's own incentive.

**How to attribute:**

- **Tag/label everything with an ownership dimension** — a bounded `team`/`service`/`namespace` label on metrics, logs, and traces (bounded, so it doesn't itself cause cardinality). In Kubernetes, derive it from namespace/labels.
- **Measure each team's footprint**: active series per team (`count by (team)({__name__=~".+"})` or Mimir per-tenant metrics), log GB ingested per service, spans per service, and (for SaaS) custom-metrics/hosts per team from the vendor's usage API.
- **Multiply by unit cost** — cost per series / per GB / per host — to produce a per-team spend figure.

**How to act on it:**

- **Dashboards + regular reports** ("your team generates 40% of metric series and 3M of them come from one metric") make the biggest offenders visible and self-evident.
- **Per-tenant quotas** (Q11) make the limit enforceable, not just informational.
- **Governance/budgets** (Q15) set expectations; chargeback (actually billing the cost to the team's budget) creates the strongest incentive because now it's *their* money.

The point interviewers want: attribution changes behavior. When a team can see that one careless `user_id` label is 60% of their observability bill, they fix it — far more effectively than a central platform team policing everyone. Showback aligns the person who *creates* the cost with the person who can *reduce* it.

### Q14. Your monitoring bill just 10×'d month-over-month. How do you investigate?

Treat it like an incident with a cost SLO. The bill has a small number of drivers, so find *which pillar* jumped, then *what* in it.

**1. Which pillar / line item spiked?** Pull the vendor usage/billing breakdown (or your storage metrics if self-hosted) and split by metrics vs logs vs traces vs hosts. One line item usually dominates the delta. That instantly narrows it.

**2. If metrics — it's almost always cardinality.** Find the new series:
```promql
topk(10, count by (__name__)({__name__=~".+"}))   # which metric grew
# then, on the suspect: which label is unbounded?
count(count by (suspect_label)(suspect_metric))
```
Check `/api/v1/status/tsdb`, and correlate the series jump timestamp with **deploys/releases** — a new label (user_id, request_id, a new dimension, a URL with IDs) shipped in a specific deploy is the usual cause. In a managed vendor, look at **custom-metrics count by tag** — a new high-cardinality tag multiplies billed custom metrics.

**3. If logs — volume or retention changed.** Look for a new DEBUG line on a hot path, a log-loop/error storm, a retention/index config change, or a traffic increase. Break down GB ingested by service; the offender stands out.

**4. If traces — sampling changed** (someone set sampling to 100%, or a new high-traffic service was onboarded at full rate) or span count per request grew.

**5. If hosts/containers (per-host vendor billing)** — an autoscaling event or new cluster added monitored hosts.

**6. Fix + prevent.** Fix the source (drop/normalize the label, restore sampling, cut DEBUG), then add a **guardrail so it can't silently recur**: per-tenant series quotas, `sample_limit` on scrapes, a **cardinality/cost alert** on `prometheus_tsdb_head_series` growth and on billing usage, and deploy-time review of new labels. The senior habit: end every cost incident by adding the alert that would have caught it on day one instead of at the invoice.

### Q15. How do you govern observability spend with budgets and policy?

Governance is what keeps the previous fourteen questions from being a recurring firefight — it makes cost discipline a *default*, not a reaction to a scary invoice.

**Guardrails (technical, enforced):**
- **Per-tenant quotas / cardinality limits** (Mimir/Cortex `max_global_series_per_user`, `sample_limit` on scrapes) — hard caps that reject overflow so no single team can blow the budget.
- **Cost/cardinality alerts** — alert on `prometheus_tsdb_head_series` growth, per-tenant series counts, log GB/day, and vendor usage APIs *before* the bill lands. A cardinality spike should page like any other regression.
- **Retention/sampling policy as config** — default retention tiers, default trace sampling, default log levels codified so "keep everything forever at DEBUG" isn't the path of least resistance.

**Process (people):**
- **Showback/chargeback** (Q13) — regular per-team spend visibility, ideally billed to team budgets, so the cost lands on whoever can fix it.
- **Budgets per team/tenant** — an agreed series/GB/host allocation; exceeding it is a conversation, not a surprise.
- **Review new labels/metrics at deploy time** — a lightweight check (lint, PR review, or automated cardinality diff) that catches an unbounded label *before* it ships, since that's the #1 cause of blowups.
- **Ownership** — a platform/observability team owns the shared cost, sets defaults, and provides the tooling, while product teams own their own footprint within quota.

The framing to leave the interviewer with: observability spend is governed the same way you govern reliability — with **SLOs/budgets, alerts, guardrails, and clear ownership**. You make the cheap thing the default, make the expensive thing require a deliberate decision, attribute cost to the team that creates it, and alert on cost regressions so the invoice is never the first time you find out.

## Scenario & Troubleshooting Playbooks

### Summary

**What this topic covers**

This is the capstone: the "**design this**" and "**debug this**" questions that pull together everything from the previous topics. It's split into two modes. **Design scenarios** ask you to architect observability for a given system — a microservices platform, a legacy monolith with nothing, a checkout service needing SLOs, a from-scratch service, a serverless/Lambda app, a multi-region estate, and an on-a-budget open-source stack — each answered with a *reference architecture* naming concrete tools (Prometheus/Mimir + Loki + Tempo + Grafana + OTel Collector + Alertmanager) and *why*. **Debug scenarios** hand you a symptom — a p99 spike at 2am, an error spike after a deploy, constant paging (alert fatigue), an OOMing Prometheus / exploding bill, "slow but dashboards are green," broken traces, an outage with no alert — and expect a *methodical pillar-by-pillar walk-through* with concrete queries, commands, and decision trees. The 17 questions mix both. The throughline: start from **user impact and SLOs**, pick the **right pillar** for each step, mind **cardinality and cost**, and **correlate** across signals to get from symptom to cause fast.

**Mental model**

For **design**, work outside-in: *what does the user experience, what are the SLIs/SLOs, what must I alert on (symptoms), then what instrumentation produces those signals* — three pillars via **OpenTelemetry** so you're vendor-neutral, metrics for alerting/trends, traces for request flow, logs for detail, all feeding dashboards and symptom-based alerts. Name tools and justify each. For **debug**, follow the funnel: **alert/SLO → dashboard (which service/endpoint) → narrow the dimension (RED/USE) → exemplar trace of a bad request → logs of that request → profile/deploy-diff for root cause.** Metrics tell you *what and where*, traces tell you *which hop*, logs tell you *why*. The senior tell is refusing to random-walk: you always know which pillar answers the current question and you move deliberately from symptom (user impact) to cause, checking the cheap high-signal things first (recent deploys, error rate, saturation) before deep dives.

**Key terms**

- **Reference architecture** — a named, justified stack for a scenario (e.g. Prometheus + Loki + Tempo + Grafana + OTel Collector).
- **Symptom-based alerting** — page on user-facing SLO breaches, not on every internal cause.
- **RED method** — Rate, Errors, Duration — the per-service dashboard cut for request-driven systems.
- **USE method** — Utilization, Saturation, Errors — the resource cut for hosts/queues/pools.
- **Exemplar** — a trace ID attached to a metric bucket, letting you jump from a spiking p99 to an example slow trace.
- **Context propagation** — passing trace context (W3C `traceparent`) across services so a trace stays connected.
- **Dead-man's switch** — an alert that fires when *expected* telemetry stops, catching monitoring blind spots and outages that silence signals.
- **Multi-burn-rate alert** — SLO alert combining fast and slow burn windows to balance sensitivity and noise.
- **OTel Collector** — vendor-neutral pipeline (receive → process → export) for metrics/logs/traces; central place for sampling, relabeling, routing.
- **Alert fatigue** — too many low-value alerts, causing responders to ignore them (including real ones).
- **Coverage gap** — a failure mode with no alert; the reason "we had an outage but nothing fired."

**Why interviewers ask this**

These questions are the whole interview compressed: they can't be answered with definitions, only with judgment. Design scenarios reveal whether you can make *opinionated tool choices with tradeoffs* ("Tempo not Jaeger here because object-storage cost and Grafana integration") instead of listing products. Debug scenarios reveal whether you have an *actual method* — do you start from user impact and move pillar-by-pillar, or do you flail between dashboards? Interviewers are watching for the senior instincts threaded through every prior topic: symptom-based alerting, SLOs and error budgets, cardinality/cost awareness, correlation via exemplars and trace context, and knowing MTTD/MTTR is the goal. A candidate who says "first, what's the user-facing SLO and did a deploy just happen" has already signaled seniority before touching a query.

**Common confusions**

- "Design = list every tool" — no; design = a *justified* architecture with tradeoffs and a clear alerting/SLO story.
- "Debugging is checking dashboards until something looks off" — it's a directed funnel from symptom to cause, pillar by pillar.
- "Green dashboards mean healthy" — they can mean *missing instrumentation, wrong SLI, or a sampling gap*; green is not proof of health.
- "No alert fired, so nothing broke" — a coverage gap or a dead signal is itself the bug; you need dead-man's switches.
- "More alerts = safer" — more *noise* = alert fatigue = missed real pages. Fewer, symptom-based alerts are safer.
- "Traces broken = the tracing tool is broken" — it's almost always **context propagation** (a hop that drops/doesn't forward headers).

**What follows from this topic**

Nothing follows — this is where it lands. Every prior topic shows up here as a tool in the kit: the three pillars, RED/USE/golden signals, Prometheus/PromQL, SLOs and multi-burn-rate alerting, OpenTelemetry and the Collector, sampling, cardinality and cost control, frontend/RUM, and long-term storage. If you can drive these scenarios — name a justified stack for a design prompt and run a clean pillar-by-pillar funnel for a debug prompt — you've demonstrated the whole primer. Treat these as the rehearsal for the real thing.

### Q1. Design an observability stack for a microservices platform.

State assumptions first (dozens of services, Kubernetes, want vendor-neutral and cost-controlled), then give a **reference architecture** and justify each choice.

**Instrumentation — OpenTelemetry everywhere.** Instrument services with the **OTel SDKs** for metrics, traces, and logs, so you're vendor-neutral and can swap backends later. Auto-instrument the common frameworks; add spans on business-critical paths.

**Collection — OTel Collector (agent + gateway).** A Collector **agent** DaemonSet per node receives OTLP, and a **gateway** tier does tail sampling, relabeling (cardinality control), and routing. This is the single choke point for sampling and cost policy.

**Metrics — Prometheus + Mimir.** Prometheus (or the OTel Collector's prometheus receiver) scrapes/receives metrics; **Mimir** provides long-term, horizontally scalable, multi-tenant storage on object storage with per-tenant quotas. Alerting via **Alertmanager** (dedup, routing, silences).

**Logs — Loki.** Cheap, label-indexed logs on object storage; keep labels low-cardinality, grep content at query time.

**Traces — Tempo.** Object-storage-backed tracing, tightly integrated with Grafana; cheap because it doesn't index spans, you pivot in from metrics exemplars / logs.

**Visualization — Grafana**, unifying all three with **exemplars** (metric → trace) and trace↔log correlation.

**Alerting philosophy:** symptom-based, on per-service **RED** SLOs, multi-burn-rate, routed by Alertmanager.

Why this stack: it's fully **OTLP/vendor-neutral**, every backend uses cheap **object storage**, it scales multi-tenant, and Grafana ties the pillars together for fast correlation. The Collector gives you one place to enforce sampling and cardinality/cost policy — the two things that kill microservices observability at scale.

### Q2. Add observability to a legacy monolith that has none. Where do you start?

Don't boil the ocean — start from **user impact** and add signal in order of value.

**1. Black-box first (fastest signal, zero code change).** Put a **synthetic probe** (blackbox_exporter/Checkly) on the critical user journeys and the health endpoint, and scrape the load balancer / reverse proxy for **RED** metrics (request rate, error rate, latency) it already emits. Within an hour you have "is it up and how slow," with no app changes.

**2. Structured logging + a request ID.** The monolith already logs; convert to **structured** logs, add a **request/correlation ID** at the entry point and thread it through, and ship to Loki. Now you can trace a request through the logs even before real tracing.

**3. White-box metrics on the hot paths.** Add a metrics client (Prometheus) and instrument the golden signals at the boundaries — request duration histogram, error counter, plus **USE** on the resources it strains (DB pool saturation, CPU). Prioritize the endpoints that carry user pain.

**4. Tracing via auto-instrumentation.** Add the **OTel agent/auto-instrumentation** (many runtimes support zero-code bytecode/monkey-patch instrumentation) to get spans for HTTP handlers and DB calls without rewriting the monolith. Sample lightly.

**5. SLOs + symptom alerts.** Define one or two SLOs on the money-path (availability, latency) and alert on those — not on internals.

The sequencing principle: **outside-in, user-impact-first**, cheapest-highest-signal instrumentation before deep code changes. You get useful monitoring on day one and deepen it incrementally, exactly the Tidy-First "small safe steps" approach.

### Q3. Design SLOs and alerting for a checkout service.

Checkout is money-path, so this is about protecting the user-facing experience with tight, symptom-based SLOs.

**Pick SLIs that reflect user success** (ratios of good/valid events):
- **Availability**: `successful checkout requests / valid checkout requests` (2xx+intended 4xx over all non-client-fault).
- **Latency**: `requests faster than threshold / total` — e.g. 99% of `POST /checkout` ≤ 800ms.
- **Correctness (if measurable)**: payment-confirmation success ratio.

**Set SLOs and error budgets:** e.g. 99.9% availability and 99% latency over 28 days. Error budget = 1 − SLO; the budget is what you spend on risk and what governs paging.

**Alert with multi-window, multi-burn-rate** (the key senior move) so you page on fast burns and ticket on slow ones, avoiding both slow detection and false alarms:

```yaml
# Page: burning 28d budget fast — 2% in 1h (14.4x) AND confirmed over 5m
- alert: CheckoutErrorBudgetFastBurn
  expr: |
    (checkout:error_ratio5m  > (14.4 * 0.001))
    and
    (checkout:error_ratio1h  > (14.4 * 0.001))
  for: 2m
  labels: { severity: page }
# Ticket: slow burn — 10% in 6h
- alert: CheckoutErrorBudgetSlowBurn
  expr: |
    (checkout:error_ratio30m > (6 * 0.001))
    and
    (checkout:error_ratio6h  > (6 * 0.001))
  for: 15m
  labels: { severity: ticket }
```

Back the ratios with **recording rules** (cheap, consistent). **Page only on the symptom** (SLO burn), route cause-alerts (a dependency down, queue saturating) to tickets/dashboards. Add a **dead-man's switch** so silence on the checkout SLI itself pages. Tie it to a runbook: on page, check deploys → dependency health → traces of failing checkouts.

### Q4. Instrument a brand-new service from scratch — what do you add on day one?

Build observability in as a first-class feature, not an afterthought. Day-one checklist, using **OpenTelemetry** so it's vendor-neutral:

- **The four golden signals / RED at the boundary**: a request-**duration histogram** (gives you latency percentiles *and* rate via `_count`), an **error counter** by status class, and **traffic** falls out of the histogram count. Saturation for any bounded resource it owns (worker pool, queue).
- **Distributed tracing with context propagation.** OTel tracing on inbound and outbound calls, propagating W3C `traceparent`, so this service is a connected node in every trace that touches it — not a black hole. Add spans on meaningful internal operations.
- **Structured logs with the trace/request ID** so logs, traces, and metrics correlate. Sensible levels; errors logged with context, not spew.
- **Exemplars** on the latency histogram so a p99 spike links straight to an example slow trace.
- **A `/metrics` endpoint and health/readiness probes** for Prometheus scraping and orchestration.
- **At least one SLO + symptom alert** before launch (availability and/or latency), with a runbook link.
- **Bounded, low-cardinality labels** from the start — route templates not raw paths, no user_id in metric labels — so you don't seed a cardinality bomb.
- **A dashboard** (RED + USE) and a **dead-man's switch**.

The framing: observability is part of "done." A service that ships without golden-signal metrics, connected traces, correlated logs, and an SLO isn't finished — you'll be flying blind the first incident.

### Q5. Design monitoring for a serverless / Lambda application.

Serverless breaks the pull-based, long-lived-process assumptions of classic Prometheus, so the architecture flips to **push, structured, and provider-integrated**.

**Metrics — push, don't scrape.** Functions are ephemeral; there's nothing to scrape. Emit metrics via the **OTel Collector (push/OTLP)** or the provider's mechanism (CloudWatch **EMF — Embedded Metric Format**, which extracts metrics from structured logs), or a push gateway. Watch the serverless-specific signals: **cold starts**, **duration** (you're billed by it), **concurrency/throttles**, **error/timeout rate**, and **invocation count**.

**Logs — structured, provider-native.** Functions log to the platform (CloudWatch Logs); emit **structured JSON** with a request/correlation ID, and ship/subscribe those logs to your store (Loki/OpenSearch) if you want them centralized. Logs are especially load-bearing here because you can't attach a debugger to a dead function.

**Traces — provider tracing + OTel.** Use **AWS X-Ray** (or OTel with the Lambda layer/extension) to trace across API Gateway → Lambda → DynamoDB/SQS, propagating context through async hops (SQS/SNS/EventBridge), which is the hard part of serverless tracing.

**Delivery — the Lambda OTel extension / Collector layer** batches and ships telemetry without blocking the function, so you don't pay latency to export.

**SLOs & alerts:** on user-facing symptoms (API latency/error SLOs), plus serverless-specific alerts on throttles and cold-start-driven latency.

The key differences to name: **no process to scrape → push**; **billed by duration → duration/cold-starts are first-class**; **ephemeral → structured logs + correlation IDs carry the weight**; **async event hops → context propagation is the tracing challenge.**

### Q6. Design a multi-region / multi-cluster global observability view.

The tension: you want a **single pane of glass** globally, but you don't want cross-region query latency, egress cost, or a single point of failure. The answer is **collect locally, aggregate globally, query federated.**

**Per region/cluster:** run a **local Prometheus** (or OTel Collector) that scrapes in-region — collection stays local (low latency, survives a region partition, no cross-region scrape). Local **Alertmanager** so alerting keeps working even if the global tier is unreachable.

**Global aggregation:** ship region data to a **globally-scoped, object-storage-backed store** — **Thanos** (sidecar per Prometheus + query layer + object storage) or **Mimir** (remote_write into a central multi-tenant cluster). This gives one query surface across all regions with **downsampled long-term** retention on cheap object storage. Add region as a (bounded) label for slicing.

**Global view:** one **Grafana** querying the global tier (Thanos Querier / Mimir), with dashboards that can show global rollups and drill into a single region.

**Design points to raise:**
- **Local-first for resilience:** a region losing connectivity to the global tier must keep collecting and alerting locally — no global SPOF.
- **Dedup:** Thanos/Mimir dedupe HA Prometheus pairs so you don't double-count.
- **Cost:** downsample old data and keep it on object storage; be mindful of cross-region **egress** — aggregate/ship compactly, don't cross-region-scrape.
- **Cardinality:** `region`/`cluster` are bounded labels; don't let per-region multiply an already-high-cardinality metric unchecked.

Reference stack: per-region Prometheus + Alertmanager → Thanos/Mimir on object storage → single Grafana. Global visibility, regional autonomy.

### Q7. On-a-budget open-source stack vs a managed vendor — how do you choose and what would you build?

Frame it as **engineering-time vs billing-exposure**, then commit.

**When to go managed (Datadog, Grafana Cloud, New Relic, Honeycomb):** small/medium scale or a small team where **engineers are the scarce resource**. You get integrated pillars and no platform on-call immediately. The cost: billing meters that punish **per-host**, **per-custom-metric** (cardinality = invoice), and per-GB logs — bills that can 10× from one label and are hard to predict.

**When to self-host (build):** large scale and/or cardinality-heavy workloads where the SaaS meter would exceed a small platform team's cost — *and* you have the cardinality discipline to keep it cheap.

**The budget open-source reference stack (the "LGTM"-style stack):**
- **Metrics:** Prometheus → **Mimir/Thanos** for scale + long-term on object storage.
- **Logs:** **Loki** (label-indexed, cheap, object storage).
- **Traces:** **Tempo** (object-storage-backed, no expensive span indexing).
- **Collection:** **OTel Collector** (vendor-neutral pipeline; the sampling/cardinality choke point).
- **Dashboards/alerting:** **Grafana** + **Alertmanager**.

Why it's cheap: everything sits on **object storage** (sub-linear cost), it's OTLP/vendor-neutral (no lock-in), and the Collector lets you enforce sampling and cardinality control centrally. The honest tradeoff you must state: self-hosting costs **engineering time** (scaling, upgrades, being on-call for your monitoring), so it only wins past the crossover point.

**Common answer:** hybrid — self-host the high-volume metrics/logs where the meter would hurt, buy for tracing or frontend RUM where the ops burden isn't worth it. Whatever you pick, cardinality/retention discipline is required either way.

### Q8. p99 latency spiked at 2am. Walk me through debugging it.

Run the **funnel** — symptom → where → which request → why — out loud, pillar by pillar:

**1. Confirm scope and user impact (metrics).** Is an SLO burning? Is it one service or system-wide, one endpoint or all? Check the RED dashboard: is it p99 only (tail — a subset of requests) or p50 too (everything)? Tail-only points at a specific slow path, GC, a slow dependency, or lock contention.

```promql
histogram_quantile(0.99,
  sum by (le, route)(rate(http_request_duration_seconds_bucket[5m])))
```
Group by route to find **which endpoint** spiked.

**2. Correlate with events.** What happened at 2am? A **deploy**? A **cron/batch job**? Traffic spike? Autoscaling event? Overlay deploy markers and check `USE` on resources (CPU/mem saturation, DB connection pool, disk). 2am specifically screams *scheduled job / backup / batch contention*.

**3. Get an exemplar trace of a slow request.** Click the exemplar on the spiking p99 bucket (or query Tempo for traces on that route with `duration > 1s`). The **trace waterfall** shows *which hop* is slow — the DB query, a downstream service, an external API, or lock/queue wait.

```bash
# find slow traces for the route in Tempo
{ resource.service.name="checkout" && name="POST /checkout" && duration > 1s }
```

**4. Logs of that request.** Pivot from the trace ID to the logs for the slow span — the actual error, slow query, retry storm, or timeout.

**5. Root cause + confirm.** Typical 2am culprits: a batch job saturating the DB, a downstream degraded, a cache expiry/cold cache, connection-pool exhaustion, or a GC/leak reaching a threshold. Confirm with the resource metric, mitigate (throttle the job, scale, roll back), and add an alert if none fired.

The discipline to demonstrate: **metrics locate (what/where), traces isolate (which hop), logs explain (why)** — and always check "what changed" early.

### Q9. Error rate jumped right after a deploy. What do you do?

A deploy-correlated error spike has a strong prior — the deploy — so act fast and confirm in parallel.

**1. Mitigate first if user-facing (bias to rollback).** If an SLO is burning and the timing lines up with the deploy, **roll back / disable the release** *now* and investigate after. Error budget is for spending on real risk, not on debugging in prod. Fast MTTR beats root-causing live.

**2. Confirm the correlation.** Overlay the error-rate metric with the deploy marker — did it start *exactly* at the rollout? Is it isolated to the new version (if canary/rolling, compare error rate `by (version)`)?

```promql
sum by (version)(rate(http_requests_total{status=~"5..",service="checkout"}[5m]))
/ sum by (version)(rate(http_requests_total{service="checkout"}[5m]))
```
If the new version's ratio is elevated and the old isn't, that's conclusive.

**3. Find the actual error.** Pull an **exemplar trace** of a failing request → see which span errors → pivot to its **logs** for the exception/stack trace. Or go straight to the **error tracker** (Sentry), which will show the new error grouped and tagged with the **release** — often the fastest path ("this exception is new in v2.4.0, 3k occurrences").

**4. Root cause and prevent.** Common post-deploy causes: a bad migration, a config/secret change, an incompatible API contract, a null/edge case, a bad feature flag. Fix forward or stay rolled back. Then **prevent recurrence**: canary/progressive rollout with automated SLO-based rollback, better pre-prod coverage, and release health monitoring so the *next* one auto-halts.

The senior signal: **rollback is a first-class debugging tool**, deploy markers and per-version metrics make correlation instant, and the error tracker's release tagging short-circuits the hunt.

### Q10. Your team is getting paged constantly — alert fatigue. How do you fix it?

Alert fatigue is dangerous because responders start ignoring pages — including the real one. Fix it systematically; the north star is **every page is urgent, actionable, and requires human intervention.**

**1. Measure it.** Pull alert history: which alerts fire most, how many are **auto-resolved without action**, what's the false-positive rate, and how many pages per on-call shift. You're hunting the noisy top offenders — usually a handful of alerts cause most of the pain.

**2. Convert cause-alerts to symptom-alerts.** The root problem is usually **paging on causes** (CPU 80%, one pod down, disk 70%) instead of **symptoms** (the user-facing SLO). High CPU that doesn't breach an SLO isn't a page. Delete or downgrade cause-alerts to dashboards/tickets; **page only on user-facing SLO burn.**

**3. Use multi-window, multi-burn-rate SLO alerts.** Replace static-threshold alerts (which flap) with burn-rate alerts that fire fast on real fast burns and slow on slow burns — far fewer false pages.

**4. Tune the noisy ones.** Add `for:` durations to kill transient blips, fix thresholds set too tight, and use **Alertmanager grouping/inhibition** so one incident is one page (inhibit downstream alerts when the upstream cause is already firing), plus dedup and sensible routing.

**5. Enforce actionability.** Every alert needs a **runbook** and a clear action. If a page has no runbook or the action is "acknowledge and ignore," delete it. Establish a rule: an alert that fired and required no action gets tuned or removed in the postmortem.

**6. Route by severity.** Page for "wake a human now," ticket/Slack for "look tomorrow," dashboard for "context." Not everything is a page.

The framing: fewer, symptom-based, actionable, well-grouped alerts. Alert quantity is not safety — **signal-to-noise is safety.**

### Q11. Prometheus is OOMing / the metrics bill is exploding — hunt it down.

Both symptoms have the same root cause: **cardinality**. Prometheus memory tracks *active series*; the managed bill often tracks *custom metrics* (per tag combination). Same hunt.

**1. Confirm it's cardinality and is it growing?**
```promql
prometheus_tsdb_head_series          # total active series — high and climbing?
```
A step-jump correlated with a deploy is the smoking gun.

**2. Find the offending metric and label** via `/api/v1/status/tsdb` (top metrics by series, top labels by distinct values) and:
```promql
topk(10, count by (__name__)({__name__=~".+"}))    # which metric owns the series
count(count by (user_id)(suspect_metric))            # confirm the unbounded label
```
The culprit is almost always an **unbounded label**: `user_id`, `request_id`, `session_id`, an error-message string, or a raw URL/path with IDs baked in.

**3. Fix at the source, mitigate at the scrape.**
- Best: stop emitting it — normalize the path to a **route template**, move the identifier into a **trace/log** (where high cardinality belongs).
- Fast: drop it at ingest with `metric_relabel_configs` (`labeldrop`/`drop`), and set `sample_limit`/`label_limit` so a bad target is rejected instead of OOMing you.

**4. Relieve structurally:** recording rules for the aggregates you actually query (then shorten raw-series retention), shard Prometheus, or move to Mimir/Thanos with **per-tenant quotas** so the head stays small.

**5. Add a guardrail so it can't recur:** per-target `sample_limit`, per-tenant `max_global_series_per_user`, and a **cardinality alert** on `prometheus_tsdb_head_series` growth. For the managed-bill version, break down **custom metrics by tag** in the vendor usage view — a new high-cardinality tag multiplies billed metrics identically.

The one-liner: **OOM and the bill are both cardinality symptoms; the disease is an unbounded label, the cure is bounding it at the source plus a quota.**

### Q12. A service is slow but every dashboard looks green. What's going on?

Green dashboards are *not* proof of health — they can mean you're **measuring the wrong thing or not measuring at all.** Work through the ways green lies:

**1. Missing instrumentation (the most common).** The slow part isn't measured. A downstream call, a third-party API, a DB query, or an internal step has **no span/metric**, so it's invisible — the dashboard is green because the slow hop isn't on it. *Check:* does the trace waterfall account for the full request duration, or is there a big **unexplained gap** between spans? That gap is uninstrumented work. Fix by instrumenting it.

**2. Wrong SLI / averages hiding the tail.** The dashboard shows **average** latency (looks fine) while **p99** is terrible — a subset of users suffer, the mean hides them. Or the SLI is measured server-side and misses queue/network time the user feels. *Check:* look at percentiles (p95/p99) and per-segment breakdowns, not averages. Add RUM to measure the *client-observed* latency.

**3. Sampling gap.** Traces are **head-sampled** and the slow/error traces got dropped, so the tail is statistically invisible in your sample. *Check:* switch the relevant path to **tail sampling** (keep slow/error traces) so outliers survive.

**4. Aggregation hiding a segment.** Global metrics are green but one **region/tenant/endpoint** is on fire, averaged away. *Check:* slice by route/region/version.

**5. Wrong vantage point.** You measure inside the datacenter; the slowness is CDN, DNS, TLS, or client network — invisible to backend metrics. *Check:* synthetic probes from user locations + RUM.

The senior framing: "green" often means a **coverage/measurement gap**, not health. Trust the user's report, look for **unaccounted time in traces**, check **percentiles not averages**, verify **sampling** isn't dropping the tail, and measure **where the user is**. Then fix the instrumentation so it can't hide next time.

### Q13. Traces are broken or incomplete — spans are missing or disconnected. Diagnose it.

Broken traces are almost always **context propagation**, not a broken tracing backend. A trace stays connected only if every hop **reads the incoming trace context and forwards it** on outgoing calls. Where that chain breaks, the trace fragments.

**Decision tree:**

**1. Are traces *disconnected* (each service starts a new trace) or *incomplete* (a service is missing)?**
- **Disconnected** → **propagation is dropped between services.** Some hop isn't extracting the incoming `traceparent` and/or isn't injecting it downstream. Common causes: a service not instrumented, a **mismatched propagation format** (W3C `traceparent` vs B3 vs proprietary — both ends must agree), a proxy/gateway or message queue stripping headers, or a manual HTTP client that doesn't inject context. *Fix:* standardize on **W3C Trace Context**, ensure every hop uses OTel propagators, and verify the gateway/broker forwards trace headers.

**2. Async hops (queues/events)** are the classic gap — SQS/Kafka/EventBridge don't carry HTTP headers, so you must **inject trace context into the message** and extract it on the consumer. Missing that breaks producer→consumer linkage.

**3. Incomplete but connected (spans missing)?** Look at **sampling** (head sampling dropped children, or inconsistent sampling decisions across services keeping some spans and not others — the decision must propagate so a trace is wholly kept or dropped) and **dropped spans** (collector overloaded/backpressure, export failures, batch timeouts, span limits). Check the Collector's `otelcol_exporter_send_failed_spans` and receiver/queue metrics.

**4. Clock skew** across hosts can make waterfalls look wrong (negative/overlapping spans) even when propagation works — check NTP.

**Verify:** take one trace ID, follow it hop by hop, and find the exact edge where it breaks — that hop is misconfigured. The takeaway: **broken traces = follow the propagation chain to the hop that drops it; standardize the format; handle async explicitly; keep sampling decisions consistent across the trace.**

### Q14. You had an outage but no alert fired. How do you investigate and prevent recurrence?

This is a **coverage gap** — the scariest failure mode, because your monitoring lied by omission. Treat it as a first-class bug and run a blameless postmortem on the *monitoring*, not just the outage.

**Investigate — why did nothing fire?** Enumerate the reasons an alert can be silent:

1. **No alert exists for this failure mode** — the condition was never covered. Most common.
2. **Threshold set wrong** — the alert exists but its threshold/`for:` was too lax, so it never tripped.
3. **The signal itself died** — the exporter/service/scrape was down, so the metric went stale/absent and a threshold alert (which needs data) silently never evaluated. An alert that requires the very thing that broke can't fire.
4. **Alert fired but delivery failed** — Alertmanager misconfig, silence left on, routing/paging integration broken. Check Alertmanager and notification logs.
5. **Wrong SLI** — you measured something that stayed green while users suffered (see Q12).

**Prevent recurrence:**
- **Add the missing alert**, ideally as a **symptom/SLO-based** alert so it covers a *class* of failures, not just this one cause.
- **Dead-man's switch** — an alert that fires when *expected* telemetry **stops** (`absent()` / no data / a heartbeat that must always be present). This catches "the signal died" and "monitoring is down" — the exact gap here. Watch the watchers.
- **Alert on staleness/absence**, not just thresholds (`absent(up{job="checkout"})`), so a dead scrape pages.
- **Test the alerting path** — periodically fire a synthetic alert end-to-end to confirm delivery/paging works.
- **Coverage review** — for the failure modes you care about, ask "what would have paged?" and close gaps proactively.

```promql
# Dead-man's switch: the target/signal disappeared entirely
absent(up{job="checkout"}) == 1
# ...or SLI traffic dropped to zero unexpectedly
absent(rate(http_requests_total{service="checkout"}[5m]))
```

The senior instinct: an outage with no alert is a **monitoring incident**. Fix the specific gap, but more importantly add **dead-man's switches and absence alerts** and make "what would have caught this" a standing postmortem question.

### Q15. Design a dashboard for a service on-call engineer. What goes on it and in what order?

A good on-call dashboard answers, top-to-bottom, "**is it healthy, if not where, and what changed**" in seconds — it's a triage tool, not a data dump.

**Top: SLO / user-facing health (the "should I care" row).** Current **SLO status and error-budget burn** for the service, and the **golden signals / RED** summary — request **rate**, **error** ratio, **duration** (p50/p95/p99). This row answers "is the user affected right now." If it's green and the SLO isn't burning, on-call can breathe.

**Middle: RED broken down by dimension (the "where" row).** The same rate/errors/duration split **by route/endpoint** and **by version/instance**, so a spike immediately localizes to an endpoint or a bad deploy. Include **top errors** by type.

**Below: USE for the service's resources (the "why — saturation" row).** **Utilization, Saturation, Errors** for what the service depends on: CPU/memory, **connection-pool saturation**, queue depth, GC, disk, downstream-dependency latency/error rates. This is where you see the cause (pool exhausted, downstream degraded).

**Context: change and correlation.** **Deploy markers** overlaid on the graphs (so "what changed" is visible), links to **traces** (exemplars from the latency panels) and **logs** for the service, and dependency health.

**Design principles to state:**
- **Ordered by triage flow** — symptom (SLO) → localization (RED by route) → cause (USE) → context (deploys/traces/logs).
- **Percentiles, not averages**; **rates, not raw counts**.
- **Bounded, readable** — a handful of high-signal panels, not 60. The 3am on-call shouldn't hunt.
- **Actionable links** to runbooks, traces, and logs so the dashboard is the launchpad for the funnel, not a dead end.

The throughline: the dashboard mirrors the **debugging funnel** — is the user hurt, where, why, what changed — so an engineer flows from page to root cause without leaving it.

### Q16. Reduce MTTD and MTTR for your service — what levers do you pull?

MTTD (mean time to *detect*) and MTTR (mean time to *resolve*) are the numbers observability exists to lower. Attack each with specific levers.

**Lower MTTD (detect faster):**
- **Symptom-based SLO alerting** with **multi-burn-rate** — you're paged on user impact quickly (fast-burn window) without waiting for a threshold to obviously breach.
- **Coverage + dead-man's switches** so failures don't slip through silent gaps (Q14).
- **Synthetic monitoring** on critical journeys catches outages before users report them.
- **Good SLIs measured where the user is** (RUM/synthetics), so detection reflects real impact, not just server health.

**Lower MTTR (resolve faster):**
- **Correlation is the biggest lever** — exemplars (metric→trace), trace↔log linkage, shared request IDs, so you go symptom→cause in clicks, not hours.
- **A triage-ordered dashboard + runbooks** so on-call follows a known funnel instead of improvising (Q15).
- **"What changed" visibility** — deploy markers, per-version metrics, and **fast rollback** so the most common cause (a deploy) is diagnosed and mitigated in minutes.
- **Actionable, low-noise alerts** — no fatigue means the real page gets fast attention, and the alert points at the affected SLO/service.
- **Distributed tracing with clean propagation** so a request's slow hop is immediately visible across services.

**Process levers around the tooling:** blameless postmortems that produce *concrete* observability improvements (the missing alert, the missing span, the missing runbook), and progressive delivery (canary + auto-rollback) that shrinks the impact window.

The framing: **MTTD is an alerting/coverage problem; MTTR is a correlation/runbook/rollback problem.** Every prior topic maps onto one of these — SLOs and dead-man's switches cut MTTD; exemplars, trace/log correlation, dashboards, and rollback cut MTTR.

### Q17. Walk through a complete incident using observability end to end — from page to postmortem.

Tie the whole primer together as one narrative, hitting each pillar in order.

**1. Detect (MTTD).** A **multi-burn-rate SLO alert** pages: checkout availability is burning error budget fast. It fired on the **symptom** (users failing checkout), not a cause — so we know it's real and user-facing immediately. On-call acknowledges; the alert links to the dashboard and runbook.

**2. Triage — is it real, how bad, where?** Open the **on-call dashboard**: SLO burning, **RED** shows `POST /checkout` error ratio spiking on one **version**, other routes fine. Scope: one endpoint, correlated with a **deploy marker** 10 minutes ago.

**3. Mitigate first.** Given the deploy correlation and user impact, **roll back** the release now — MTTR beats root-causing live. Error rate recovers; budget stops burning. Declare mitigated.

**4. Diagnose (the funnel).** Now find *why*. From the spiking latency/error panel, click an **exemplar** to a **failing trace**: the waterfall shows the checkout span erroring on a call to the payments service. Pivot from the **trace ID to logs**: a `NullPointerException` / failed DB write from a bad migration in the new release. The **error tracker** (Sentry) confirms — new exception, tagged to `v2.4.0`, thousands of occurrences.

**5. Root cause.** The deploy shipped a schema change incompatible with in-flight requests. Confirmed by trace + logs + release tag agreeing.

**6. Fix forward + verify.** Ship the corrected migration, watch the SLO recover and error budget stabilize on the dashboard, confirm traces are clean.

**7. Postmortem (blameless, observability-improving).** Ask the standing questions: Did we detect fast enough? (Yes — burn-rate alert worked.) Could we have caught it pre-prod? (Add a migration-compat test + canary with **auto-rollback on SLO burn**.) Was anything invisible? (If a span was missing, instrument it.) Would a **dead-man's switch** or extra coverage have helped? Capture action items: canary rollout, migration test, a runbook tweak. Feed the learnings back so **next time MTTD/MTTR are even lower.**

The throughline to state: **detect on symptom → triage on RED → mitigate by rollback → diagnose via exemplar→trace→logs→error-tracker → fix → blameless postmortem that hardens the observability itself.** That loop, powered by correlated three-pillar telemetry and SLO-based alerting, is the entire discipline in one incident.
