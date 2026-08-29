import type { Diagram } from "./types";

export const NOTIFICATION_SYSTEM: Diagram = {
  id: "notification-system",
  title: "Notification System",
  question: "Design a Notification System",
  sourceId: "patterns",
  itemId: 7,
  overview: {
    shape:
      "One front door that can refuse a send, then one durable queue per channel below it, each paced to a provider nobody here controls.",
    forces: [
      {
        constraint: "restraint (prefs, quiet hours, a shared provider rate limit) can only be enforced in one place, not per caller",
        decision: "One ingestion service is the only front door; a per-user gate sits above the queues",
        lights: ["notif-svc", "gate"],
      },
      {
        constraint: "10M requests/day retry after a timeout with no way to know if the original was accepted",
        decision: "Accept + dedupe requires an idempotency key and returns the original notif_id on a repeat",
        lights: ["accept", "cache"],
      },
      {
        constraint: "committing a notification and publishing it are two writes to two systems with no shared transaction",
        decision: "use a transactional outbox: rows commit together, a publisher marks them published only after the broker acks",
        lights: ["outbox", "publisher"],
      },
      {
        constraint: "push, email and SMS have different provider ceilings (~10k/s, ~10k/s, ~200/s) and fail independently",
        decision: "one topic and one worker pool per channel, so a push outage cannot stop email",
        lights: ["lanes", "push-topic", "sms-topic"],
      },
      {
        constraint: "each provider publishes only 99.9% availability, 8.8 hours a year, on a hop we cannot observe",
        decision: "publish acceptance rate, never a delivery rate, and suppress duplicates only at hops the system owns",
        lights: ["providers", "status-store"],
      },
    ],
    naive: {
      text: "A reader defaults to calling the provider directly from whichever service wants to notify someone: no queue, no gate, just an API call to APNs or SES inline. That breaks the moment two services decide to notify the same user, or a provider has a bad hour and nobody upstream can tell. The Notification service replaces this with one front door: an outbox and per-channel queues absorb provider outages, and a per-user gate is the one place restraint can be enforced.",
      lights: ["notif-svc", "gate", "outbox"],
    },
    beats: [
      {
        text: "Whether to notify was already decided by the caller, so this system does three things only: fan-out, delivery, and restraint. One ingestion service is the only front door. It validates, checks the caller's idempotency key, and expands one logical send into one message per user, channel and device. The average fan-out is about 1.6, or 15M push targets if the target is the whole base.",
        lights: ["notif-svc", "accept", "fanout"],
      },
      {
        text: "The per-user gate sits above the queues, and its placement is the design rather than a detail. Preferences, quiet hours in the recipient's timezone, and a bucket of five notifications an hour decide whether the send happens at all. Once a message is sitting in a channel queue, the only question left is when to send it, not whether to.",
        lights: ["gate", "e3", "e4"],
      },
      {
        text: "The write is a transactional outbox: the notification rows and an unpublished outbox row commit together, and a publisher moves them onto the channel topics only after the broker acknowledges. That closes the gap between the database accepting a send and the queue receiving it, and it introduces the one failure that queue-depth alerting cannot see.",
        lights: ["outbox", "publisher", "e5", "e6"],
      },
      {
        text: "Below the outbox there is one topic per channel and one worker pool per provider. Push, email and SMS have different published ceilings, different error vocabularies and independent outages, so a shared backlog would mean an APNs bad hour stops email too. Each worker classifies the response rather than treating failure as a boolean, and after four attempts the message is recorded dead-lettered instead of retrying forever.",
        lights: ["lanes", "push-topic", "email-topic", "sms-topic", "push-workers", "email-workers", "sms-workers"],
      },
      {
        text: "The guarantee is at-least-once, meaning a message may arrive more than once but never zero times. Duplicate suppression runs at four hops: the caller's idempotency key, the commit-time table separating write from publish, a recently-sent set inside the worker, and the provider's own dedup id. That is observably exactly-once in practice, not the same guarantee. The worker's own check leaks in the milliseconds around a crash, and the final hop, provider to handset, is not yours at all.",
        lights: ["accept", "outbox", "push-workers", "providers", "e1", "e13"],
      },
      {
        text: "Tracking runs alongside all of it. Every state transition is persisted against the notif_id, so a worker restart resumes from durable state rather than inferring it from queue position. Terminal states arrive minutes later by webhook. Every number the status store can report is an acceptance rate wearing a delivery label.",
        lights: ["status-store", "e16", "e19"],
      },
    ],
    crux: {
      problem: "A notification is user-visible and cannot be recalled, and the final hop belongs to somebody else.",
      handled:
        "The honest design is at-least-once with a dedup key at every hop the system owns, never exactly-once. The restraint that decides whether the product works has to sit above the queues rather than in the delivery tier.",
    },
    numbers: [
      {
        value: "10M accepted requests/day = ~120/s avg, ~220/s daytime",
        explain: "The volume the accept path and outbox are provisioned for, concentrated into a roughly 10-hour daytime window.",
      },
      {
        value: "15M push targets; a broadcast smeared to 4,200/s under a ~10k/s ceiling",
        explain: "A full-base broadcast fans out to every registered push token; smearing it over an hour keeps the provider's ceiling from being overrun.",
      },
      {
        value: "4 attempts at 30s, 5min and 1h, then dead-lettered",
        explain: "The retry schedule for push and email; a message still failing after the fourth attempt is dead-lettered rather than retried forever.",
      },
    ],
  },
  nodes: [
    {
      id: "notif-svc",
      label: "Notification service",
      kind: "serviceGroup",
      sub: "accept · gate · fan-out",
      col: 0,
      row: 0,
      detail: {
        what: "One deployable service, four stages of one request path: accept and dedupe, gate, fan out, publish. It decides nothing about whether to notify and everything about how, and it delivers nothing itself.",
        why: "Preferences, quiet hours and a provider rate limit that every team shares can only be enforced in one place. Spread across a client library, each service reimplements restraint, one team forgets, and each backs off independently against a limit they hold in common. The stages are stages rather than services because a request passes through all four or none: they deploy together, and they fail together. Splitting them would buy independent scaling of a path that runs at only 120 a second.",
        numbers: [
          { value: "~10M accepted requests/day, ~120/s average", explain: "The steady-state load the accept path is provisioned for." },
          { value: "~220/s daytime, 80% of traffic in a 10-hour window", explain: "Traffic concentrates heavily during waking hours, which is what the daytime peak figure is sized against." },
          { value: "1 idempotency_key required per request, never defaulted", explain: "Every caller must supply its own key, so a duplicate can always be traced to a specific retry." },
        ],
        breaks: {
          failure: "A segment-wide broadcast accepted synchronously puts 15M messages on the queues in seconds.",
          handled: "Segment targets are rejected at the front and routed to the batch path instead, which smears the fan-out over time rather than accepting it all at once.",
        },
        choice: {
          pick: "One accepting service in front of durable per-channel queues",
          instead: "A shared client library that each calling service sends with directly.",
          decider:
            "Roughly a hundred sends a second or three channels is where the library stops winning, and this system is at 120/s across four channels. Past that line there is no common place to apply preferences and every service throttles independently against one shared provider limit.",
          flips: "Ten services and a few thousand sends a day, where the extra hop, the persistence tier and the on-call surface buy nothing you cannot get from a function call.",
        },
      },
    },
    {
      id: "accept",
      label: "Accept + dedupe",
      sub: "validate · idempotency key",
      kind: "process",
      col: 0,
      row: 0,
      parent: "notif-svc",
      detail: {
        what: "The only front door. Validates the request, requires a caller-supplied idempotency key, and returns the original notif_id if this (caller_id, key) pair has been seen in the last 24 hours.",
        why: "The caller retried because our response timed out, and it has no way to know whether the original was accepted. Suppressing that retry here is the first of the four dedup hops, and it is the cheapest one: everything downstream of this point is already committed to happening.",
        numbers: [
          { value: "~10M accepted requests/day, ~220/s daytime peak", explain: "The load this stage is sized for, the same figure the whole accept path is provisioned against." },
          { value: "idempotency cache 24h TTL, ~1.2 GB resident", explain: "24 hours comfortably covers any caller's retry window; the resident size is what a day of keys at this volume costs in memory." },
          { value: "1 idempotency_key required per request, never defaulted", explain: "Every duplicate check depends on the caller supplying this key; there is no fallback identity to dedupe against." },
        ],
        breaks: {
          failure: "Read-then-write loses the race between two parallel retries: both miss the cache and both create a notification.",
          handled: "The check has to be a conditional insert instead, and the loser has to wait for the winner's notif_id rather than proceeding on its own.",
        },
      },
    },
    {
      id: "gate",
      label: "Per-user gate",
      sub: "prefs · quiet hours · 5/hr · digest",
      kind: "process",
      col: 0,
      row: 1,
      parent: "notif-svc",
      detail: {
        what: "The only stage that can refuse or delay a send: preferences, quiet hours in the recipient's timezone, and a token bucket of five notifications per user per hour. Anything over the cap is held and collapsed into one digest.",
        why: "Throughput was never at risk here, so human tolerance is the scarce resource. A system that delivers every notification reliably and then gets muted in settings has failed at exactly the thing it was built for. No retry policy recovers a user who has turned notifications off. It runs above the queues because once a message is in a channel queue the only question left is when to send it, not whether to.",
        numbers: [
          { value: "5 per user per hour at normal priority", explain: "The token bucket size; anything over this in an hour is held and collapsed into a digest instead of sent immediately." },
          { value: "average user 0.6 notifications/day, p99 user above 40", explain: "The cap is invisible to almost everyone; it exists entirely for the small tail of users who would otherwise be over-notified." },
          { value: "above ~20% bypass traffic the gate has stopped working", explain: "If a fifth of traffic routes around the cap via a bypass flag, the limiter is no longer actually limiting anything." },
        ],
        breaks: {
          failure: "Bypass inflation. Every team believes its notification is transactional.",
          handled: "Unless the bypass list is centrally owned and audited, it grows until the cap protects nobody; a periodic audit of bypass flags is what keeps the list honest.",
        },
        choice: {
          pick: "A per-user token bucket in front of the channel queues, digesting the overflow",
          instead: "Send everything immediately and give users granular per-category toggles instead.",
          decider:
            "The top of the distribution rather than the average. The average user gets 0.6 notifications a day, so a cap of five an hour is invisible to almost everyone. The p99 user above 40 a day is the entire reason the limiter exists. Every user who disables notifications comes from that tail.",
          flips:
            "When every notification is individually actionable and time-critical. A two-factor code, a trade fill or an on-call page in a digest is worse than no notification. A paging product keeps the preference and quiet-hours checks, and drops the limiter.",
        },
      },
    },
    {
      id: "fanout",
      label: "Fan-out",
      sub: "one row per user · channel · device",
      kind: "process",
      col: 0,
      row: 2,
      parent: "notif-svc",
      detail: {
        what: "Expands one approved logical send into one message row per user, per enabled channel and per registered device, each carrying its own notif_id.",
        why: "Retry and dedup have to be independent per target. A user's stale iPad token must not block the phone that still works, and a bounced email address must not fail the push. Expansion here, rather than in the workers, means the per-message state exists before anything is queued. A redelivery therefore has something durable to resume from.",
        numbers: [
          { value: "~1.5 registered push tokens per user, ~15M push targets", explain: "Multiple devices per user is what turns a 10M-user base into 15M push targets." },
          { value: "fan-out ~1.6 messages per accepted request", explain: "The average number of per-target rows one logical send expands into, across all channels and devices combined." },
          { value: "a full-base broadcast is 15M rows, 1.5x a normal day", explain: "A single broadcast to everyone produces as many rows as one and a half ordinary days of traffic, why broadcasts are smeared rather than accepted all at once." },
        ],
        breaks: {
          failure: "The gate ran on the logical send, before this expansion.",
          handled: "The cap counts logical notifications rather than the interruptions a user with two devices and two channels actually feels. This is accepted as the cost of gating before fan-out rather than after.",
        },
      },
    },
    {
      id: "outbox",
      label: "Outbox table",
      sub: "unpublished rows, same transaction",
      kind: "database",
      col: 0,
      row: 1,
      detail: {
        what: "A holding table. The notification rows and one unpublished outbox row per message commit in the same transaction as the fan-out, and a row is marked published only after the broker acknowledges it.",
        why: "Two writes to two systems with no shared transaction. Publish first and a crash before the commit produces a notification nobody can look up. Commit first and a crash before the publish loses it silently, which is worse, because the API already told the caller it was accepted. The table is the second of the four dedup hops.",
        numbers: [
          { value: "one row per fanned-out message, ~1.6 per accepted request", explain: "Matches the fan-out ratio exactly, since every fanned-out message gets its own outbox row." },
          { value: "0 rows marked published before the broker acknowledges", explain: "The defining property of the table: a row's published flag is trustworthy evidence the broker actually has the message." },
          { value: "reaped once a day, not left to accumulate", explain: "Published rows are cleared on a schedule rather than kept forever, since nothing downstream ever reads them again." },
        ],
        breaks: {
          failure: "Nothing reaps published rows and the table grows without bound behind a workload that never reads it.",
          handled: "A daily reap job clears published rows; separately, because rows are claimed in batches, ordering across a user's channels is not preserved here and must not be relied on downstream.",
        },
        choice: {
          pick: "Transactional outbox with a separate publisher process",
          instead: "Publishing to Kafka directly from the request handler.",
          decider:
            "Which failure ordering you can live with. A direct publish loses the message on any crash between commit and publish, after the API already returned accepted. At 6M accepted requests a day, a rare crash becomes a steady trickle of silent misses nobody can find.",
          flips: "A best-effort channel such as an in-app badge that the client reconciles on its next fetch. There, an outbox row per badge update costs more than the notification it is protecting.",
        },
      },
    },
    {
      id: "publisher",
      kind: "service",
      col: 0,
      row: 2,
      label: "Outbox publisher",
      sub: "marks published on broker ack",
      detail: {
        what: "The loop that claims unpublished outbox rows, writes them to the channel topic, and marks them published only once the broker has acknowledged the write.",
        why: "This is what makes the outbox worth having. Committing the row and publishing it are separated in time on purpose. A crash anywhere in between leaves an unpublished row that the next pass picks up, rather than a message that was accepted and then quietly lost.",
        numbers: [
          { value: "~190 rows/s average, ~350/s at daytime peak, ~4,400/s during a broadcast", explain: "The claim-and-publish rate this loop sustains, scaling from steady state up to the smeared broadcast rate." },
          { value: "2 first-class metrics: publisher lag and outbox depth", explain: "These are alerted on directly, since a stalled publisher looks identical to a healthy, empty queue from every other signal." },
          { value: "re-publish on an unacknowledged write, hence at-least-once", explain: "A write the broker did not confirm is retried rather than assumed lost, which is what makes the path at-least-once rather than best-effort." },
        ],
        breaks: {
          failure: "A stalled publisher presents as an empty queue and idle workers, while rows pile up in a table nobody graphs.",
          handled: "Outbox depth and publisher lag have to be alerted on directly rather than inferred from queue depth, since every queue-based signal reports this failure as healthy.",
        },
        choice: {
          pick: "A dedicated polling publisher process, separate from the request handler",
          instead: "Publish to the channel topics directly from the request handler, right after the outbox commit.",
          decider:
            "Who retries after a crash. A separate poller picks up an unpublished row on its next pass, with nobody waiting on it. Publishing inline from the request handler means a crash between commit and publish leaves nothing to retry it. At ~190 rows/s average, that gap becomes a steady trickle of stuck rows.",
          flips: "A low-volume, synchronous channel where the caller can afford to wait for the publish and retry it itself. At that point a separate polling process is one more thing to operate for no benefit.",
        },
      },
    },
    {
      id: "cache",
      label: "Redis cache tier",
      sub: "dedup keys · prefs · token buckets",
      kind: "cache",
      col: 1,
      row: 0,
      detail: {
        what: "One Redis tier holding three accept-path structures: (caller_id, idempotency_key) to notif_id at 24h TTL, the preference cache at 1-minute TTL, and a per-user token bucket per hour.",
        why: "All three are read before anything is written, and all three are disposable once their TTL expires. Paying a durable-store round trip for them on every accepted request would be the wrong trade. Preference writes invalidate by pub/sub, so a normal opt-out propagates in under a second.",
        numbers: [
          { value: "idempotency cache ~1.2 GB at 24h TTL", explain: "The dedup key population resident at any time, sized by 24 hours of accepted requests." },
          { value: "rate-limiter state ~500 MB across 10M users", explain: "The per-user token bucket state, small enough to keep entirely in memory for the whole user base." },
          { value: "prefs 1-minute TTL, pub/sub invalidation on write", explain: "A short TTL bounds staleness even without invalidation; pub/sub makes an opt-out visible almost immediately in practice." },
        ],
        breaks: {
          failure: "The dedup write has to be a conditional insert rather than a read followed by a write.",
          handled: "Otherwise two retries arriving in parallel both miss the cache and both create a notification; the conditional insert makes exactly one of them win.",
        },
        choice: {
          pick: "Redis for dedup keys, preferences and buckets in one tier",
          instead: "Reading the preferences database directly on every accepted request.",
          decider:
            "1.2 GB of dedup keys plus 500 MB of bucket state, every byte read on the accept path at 120/s, and every byte worthless after 24 hours. That is cache-shaped state, and a durable store gives nothing back for the latency.",
          flips: "When the preference check has to be authoritative for GDPR or CCPA. There the TTL drops to 10 seconds at the worker tier, or the read goes to the source of truth and accepts the extra load.",
        },
      },
    },
    {
      id: "lanes",
      label: "Per-channel delivery lanes",
      kind: "zone",
      detail: {
        what: "One backlog and one worker pool per channel, each sized and retried against its own provider.",
        why: "Providers fail independently and publish different ceilings. The only thing that keeps a bad hour on push from becoming a product-wide outage is that email and SMS never share its queue. Isolation here is what turns a system-wide outage into a channel outage.",
        numbers: [
          { value: "push ~10k/s, SES ~10k/s, SMS ~200/s", explain: "The provider ceilings each lane is paced against; SMS is two orders of magnitude narrower than the other two." },
          { value: "4 attempts on push and email, 1 on SMS", explain: "The retry budget differs per channel because the cost of a duplicate differs per channel." },
        ],
        breaks: {
          failure: "Operational sprawl: one notification system is really several channel systems behind a shared front door.",
          handled: "Each channel carries its own credentials, its own sending reputation and its own way of telling you it is unhappy, which the design accepts as the cost of isolating outages.",
        },
        choice: {
          pick: "One queue and one worker pool per channel",
          instead: "A single shared queue with a channel field on the message.",
          decider:
            "What a 30-minute APNs outage costs. With one queue, 15M backed-up push messages sit in front of every password reset going out by email. With a queue per channel, the other channels drain at their normal 120/s throughout.",
          flips: "A single channel, or volumes low enough that a provider outage is absorbed by one worker pool anyway, where three brokers' worth of operational surface buys nothing.",
        },
      },
    },
    {
      id: "push-topic",
      label: "Push topic",
      sub: "notif.push, 7-day retention",
      kind: "queue",
      col: 1,
      row: 1,
      parent: "lanes",
      detail: {
        what: "The durable backlog for push, drained by its own consumer group.",
        why: "This is the topic a broadcast lands on, so it has to absorb 1.5 days of normal traffic in one event. It does this without pushing at the provider faster than the pool allows. Retention exists so a worker rebuild or a same-week audit can replay rather than lose.",
        numbers: [
          { value: "~4,200/s during a 60-minute broadcast smear", explain: "The rate a full-base broadcast is spread over when smeared across an hour, safely under the ~10k/s provider ceiling." },
          { value: "~2 KB per message: template_id, params, routing keys", explain: "The queued payload size; the message carries references to render, not a rendered body." },
          { value: "7-day retention, ~300 GB used, 500 GB provisioned", explain: "Enough retention to cover a worker rebuild or a same-week audit without running out of headroom." },
        ],
        breaks: {
          failure: "A 30-minute APNs outage fills this topic while the others drain normally.",
          handled: "The risk is the recovery: without jitter, every message queued during the outage retries in the same instant. That re-throttles the provider you were waiting for, so retries on resumption are jittered instead.",
        },
        choice: {
          pick: "A Kafka topic per channel with a consumer group per channel",
          instead: "One shared queue with a channel field, or a managed work queue such as SQS.",
          decider:
            "Isolation plus replay. 7 days of retention costs about 300 GB and covers a worker rebuild and an audit. A per-channel topic also means a provider down for 30 minutes backs up one channel rather than all of them.",
          flips: "One channel and no replay requirement, where a managed work queue is far less to operate and the retention window is never used.",
        },
      },
    },
    {
      id: "email-topic",
      label: "Email topic",
      sub: "notif.email",
      kind: "queue",
      col: 1,
      row: 2,
      parent: "lanes",
      detail: {
        what: "The durable backlog for email, drained by the SES worker pool at its own pace.",
        why: "Email is the channel that keeps working while push is throttled, and that is only true because it has its own backlog. It is also the fallback path for high-priority traffic when push fails, so it must have spare headroom precisely when the push topic does not.",
        numbers: [
          { value: "SES ~10k/s with a warm sending reputation", explain: "The provider ceiling this lane paces against, contingent on the sending reputation staying warm." },
          { value: "daytime steady ~440 KB/s across all channel topics", explain: "The combined write throughput across every channel topic during normal daytime traffic." },
        ],
        breaks: {
          failure: "Cross-channel fallback doubles a user's notification count unless the fallback consumes the same rate-limit budget.",
          handled: "An outage turns into an over-notification incident unless fallback sends are charged against the same per-user bucket the original channel would have used.",
        },
        choice: {
          pick: "Its own Kafka topic (notif.email), separate from push and SMS",
          instead: "A single shared topic with a channel field that every worker pool filters on.",
          decider:
            "What a push outage costs email. On a shared topic, 15M backed-up push messages would sit in front of every password-reset email behind them. A dedicated topic lets email keep draining at its own ~10k/s ceiling regardless of what push is doing.",
          flips: "Volumes low enough that all three channels combined never approach one provider's ceiling, where a shared topic with a channel field is one broker to operate instead of three.",
        },
      },
    },
    {
      id: "sms-topic",
      label: "SMS topic",
      sub: "notif.sms, transactional only",
      kind: "queue",
      col: 1,
      row: 3,
      parent: "lanes",
      detail: {
        what: "The durable backlog for SMS, deliberately the narrowest lane in the system.",
        why: "The carrier ceiling, not our capacity, sets what this channel can carry, and it is two orders of magnitude below the others. A full-base broadcast down this lane is 20.8 hours of sending, so broadcasts are push and email only and that is arithmetic rather than policy.",
        numbers: [
          { value: "~200 msg/s per account, carrier-throttled", explain: "The ceiling this lane is paced against; set by the carrier, not by anything this system controls." },
          { value: "15M / 200 per second = 20.8 hours for a full-base send", explain: "Why a full broadcast down this lane is arithmetically impossible to do quickly, which is what keeps SMS restricted to transactional traffic." },
          { value: "~$0.0075 per message", explain: "The per-message cost that makes a duplicate here an actual line item, not just an annoyance." },
        ],
        breaks: {
          failure: "Anything that routes bulk traffic here silently converts a marketing send into a day-long backlog.",
          handled: "That backlog sits in front of the one-time codes that actually need this channel, which is why bulk traffic is refused at accept rather than filtered here.",
        },
        choice: {
          pick: "Its own topic, deliberately the narrowest lane, fed only transactional traffic",
          instead: "Let SMS share the same topic as push and email, filtered by a channel field on the message.",
          decider:
            "The carrier ceiling is two orders of magnitude below the others, ~200/s against ~10k/s. On a shared topic a push or email burst would either starve SMS behind it, or SMS's slow drain would back up the other channels. A dedicated topic keeps its 200/s pace independent of either.",
          flips: "A product with no SMS channel at all, where the topic and its worker pool are pure operational cost for a channel nobody uses.",
        },
      },
    },
    {
      id: "push-workers",
      label: "Push workers",
      sub: "APNs / FCM, apns-id dedup",
      kind: "service",
      col: 2,
      row: 1,
      parent: "lanes",
      detail: {
        what: "The pool that drains notif.push, calls APNs over HTTP/2 or FCM, classifies the response, prunes dead tokens and records the attempt.",
        why: "The provider's response class is the state machine, not a detail below it. 5xx and 429 requeue; 410 Gone or UNREGISTERED prunes the token. 400 or 413 is a code bug worth alerting on; 403 pages because a certificate has expired and every send on the channel is now failing. Treating the response as a boolean gets both halves wrong.",
        numbers: [
          { value: "~1k msg/s per HTTP/2 connection x ~10 connections = ~10k/s", explain: "How the pool reaches its ~10k/s ceiling: many connections each individually capped." },
          { value: "4 attempts at 30s, 5min and 1h", explain: "The retry schedule for a message that fails; a fourth failure is dead-lettered rather than retried again." },
          { value: "FCM batch endpoint takes up to 500 tokens per call", explain: "Android sends batch multiple tokens into one call, so the Android side of this pool needs far fewer outbound calls per message than the iOS side." },
        ],
        breaks: {
          failure: "The worker can die between the provider returning 200 and the sent:{notif_id} key being written.",
          handled: "This hop narrows the duplicate window to a few milliseconds around a crash, rather than closing it entirely; apns-id lets Apple discard whatever still slips through.",
        },
        choice: {
          pick: "A sent:{notif_id} check before the call, plus apns-id passed to the provider",
          instead: "Relying on the queue's own delivery semantics alone.",
          decider:
            "Where the crash lands. An uncommitted offset redelivers every message in flight. The local check removes all but the millisecond window between the 200 and the key write, and apns-id lets Apple discard what still slips through. Note apns-collapse-id is display coalescing, a different feature entirely.",
          flips: "An in-app or badge channel whose client reconciles state on its next fetch, where a duplicate is invisible and two extra round trips per send are not worth paying for.",
        },
      },
    },
    {
      id: "email-workers",
      label: "Email workers",
      sub: "SES + a warm standby provider",
      kind: "service",
      col: 2,
      row: 2,
      parent: "lanes",
      detail: {
        what: "Drains notif.email, substitutes the per-user slots into the pre-rendered locale shell, and hands the message to SES behind an adapter that a second provider also sits behind.",
        why: "Rendering localised content per notification costs 10 to 50ms, invisible at 120/s but 4,200 concurrent renders during a broadcast. So the static shell is rendered when the template is published, and only the per-user slots are substituted here.",
        numbers: [
          { value: "SES ~10k/s with a warm reputation", explain: "The provider ceiling, contingent on reputation staying warm through continuous use." },
          { value: "a second integration is roughly 4 engineer-weeks", explain: "The one-time cost of adding the standby provider behind the same adapter." },
          { value: "~3% of live traffic permanently routed to the standby", explain: "A small constant slice keeps the standby's sending reputation warm, so it is ready the moment a failover is needed." },
        ],
        breaks: {
          failure: "An account-level send pause from a bounce rate you caused follows the sender, not the provider.",
          handled: "A second integration buys nothing against that failure, since the pause is tied to the account's reputation rather than which provider is used. Keeping bounce rates low is the actual defence.",
        },
        choice: {
          pick: "Two email providers behind one adapter, both kept warm",
          instead: "One provider, and treat an outage as an outage on the status page.",
          decider:
            "99.9% published availability is 8.8 hours of downtime a year, so a single-provider channel cannot support a 99.95% per-channel SLO on paper regardless of how well you build it. Against that, four engineer-weeks and a few percent of live traffic on the standby.",
          flips: "A 99.9% SLO, or when the same content is in the app anyway and the queue replays when the provider returns, which is most products.",
        },
      },
    },
    {
      id: "sms-workers",
      label: "SMS workers",
      sub: "Twilio, one attempt only",
      kind: "service",
      col: 2,
      row: 3,
      parent: "lanes",
      detail: {
        what: "Drains notif.sms at roughly 200 messages a second and sends once, because the provider's synchronous accept is not the delivery and the final state arrives by webhook minutes later.",
        why: "This is the one channel where a duplicate is clearly worse than a miss. An SMS costs about $0.0075, and arrives as an interruption the recipient cannot dismiss without reading it. At a 1% duplicate rate over 1M messages a month, that is $75 and roughly ten thousand annoyed people.",
        numbers: [
          { value: "1 attempt here, versus 4 on push and email", explain: "The retry budget is deliberately one, since a duplicate SMS costs money and cannot be dismissed unread." },
          { value: "~200 msg/s per account, carrier-throttled", explain: "The ceiling this pool paces against, set by the carrier rather than by this system." },
          { value: "terminal state arrives by webhook 2 to 10 minutes later", explain: "The provider's synchronous accept is not the delivery; the actual outcome is only known once the webhook lands." },
        ],
        breaks: {
          failure: "Retrying a 5xx from the provider may deliver twice, since the accept is not the delivery.",
          handled: "There is nothing on that hop to tell you which outcome occurred, so the retry budget is set to one rather than risking a paid duplicate.",
        },
        choice: {
          pick: "A retry budget of one for SMS, four for push, email and in-app",
          instead: "The same four-attempt budget on every channel.",
          decider:
            "Whether a duplicate is worse than a miss has a different answer per channel. At $0.0075 a message, a 1% duplicate rate over 1M a month is $75 and ten thousand interruptions. A duplicate in-app badge costs nothing and nobody notices.",
          flips: "A provider that accepts a dedup identifier on the send call the way APNs does with apns-id, which closes the fourth hop and makes a retry safe to make.",
        },
      },
    },
    {
      id: "providers",
      label: "Providers and devices",
      sub: "APNs · FCM · SES · Twilio",
      kind: "external",
      col: 3,
      row: 1,
      detail: {
        what: "Everyone else's infrastructure, and behind it the handset or inbox you have no visibility into at all.",
        why: "This is where the guarantee stops by construction. A call to APNs is an HTTP request with no transaction to enrol in. The hop after it, provider to device, is not yours: a 200 means Apple accepted the message, not that it reached a phone or that a person saw it. Every number reported from this box is therefore an acceptance rate, never a delivery rate.",
        numbers: [
          { value: "push ~10k/s, SES ~10k/s, SMS ~200/s", explain: "The three ceilings every worker pool in the system is paced against; none of them are set by us." },
          { value: "4 providers integrated: APNs, FCM, SES, Twilio", explain: "The full set of external systems this design has no visibility or control inside." },
          { value: "each provider publishes 99.9% availability, 8.8 hours a year", explain: "The published SLA baseline; it is why email runs two providers to reach a tighter internal target." },
        ],
        breaks: {
          failure: "The device may be off for two days and the notification expires silently, or the user may have muted the app at OS level.",
          handled: "Both are indistinguishable from a successful delivery from where we stand, which is exactly why every reported number here is an acceptance rate, never a delivery rate.",
        },
      },
    },
    {
      id: "status-store",
      label: "Status store",
      sub: "wide-column, 7 days hot",
      kind: "database",
      col: 3,
      row: 0,
      detail: {
        what: "One record per notification keyed by notif_id, carrying every attempt and the current state: queued, attempting, delivered, bounced, dead-lettered.",
        why: "State is persisted on every transition so a worker restart resumes from durable state rather than inferring it from queue position, which breaks the moment a message is redelivered. It is also the only place that catches two services deciding to notify about the same event with different idempotency keys.",
        numbers: [
          { value: "~1 KB per record: 10 GB/day logical, 30 GB/day at RF 3", explain: "The daily write volume before and after replication, at this record's per-notification size." },
          { value: "7 days hot, then columnar archive at ~730 GB/yr", explain: "The rolling hot window, after which records move to compressed columnar storage for long-term retention." },
          { value: "up to 4 attempt writes per message", explain: "One write per retry attempt, matching the channel's own retry budget." },
        ],
        breaks: {
          failure: "Write-heavy and read almost never.",
          handled: "Attempt writes have to be batched per worker poll rather than one round trip per attempt, or the store would cost more than the sending itself.",
        },
        choice: {
          pick: "A wide-column store partitioned by user_id, 7 days hot then archived",
          instead: "The same relational database that holds preferences.",
          decider:
            "10 GB a day logical and 30 GB replicated, almost entirely blind writes against reads that hardly ever happen. Dictionary-encoded columnar files compress about 5x, so a year of history is ~730 GB and retention is never the constraint.",
          flips: "Volumes low enough that the status table fits beside preferences, where one database is less to operate and you get real queries for freshness analysis for free.",
        },
      },
    },
  ],
  edges: [
    {
      id: "e1",
      from: "accept",
      to: "cache",
      tier: "control",
      label: "idempotency key check",
      detail: {
        what: "The first duplicate check: has (caller_id, idempotency_key) been seen in the last 24 hours?",
        why: "The caller retried because our response timed out and it has no way to know whether the original was accepted. Returning the original notif_id rather than creating a second notification is the only thing standing between a flaky network and a duplicate the user sees.",
        numbers: [{ value: "24h TTL, far longer than a caller's ten-second retry", explain: "The TTL is set with wide margin over any realistic retry window, so a legitimate retry is never mistaken for a new request." }],
        breaks: {
          failure: "Read-then-write loses the race between two parallel retries: both miss, both create.",
          handled: "It has to be a conditional insert instead, and the loser has to wait for the winner's notif_id rather than proceeding on its own.",
        },
      },
    },
    {
      id: "e2",
      from: "accept",
      to: "gate",
      tier: "data",
      label: "one logical send",
      detail: {
        what: "A validated, deduplicated notification request handed to the stage that decides whether it happens at all.",
        why: "Validation and restraint are separate jobs even inside one service. By this point the request is known to be well formed and not a retry. The only remaining question is whether this person wants this notification right now, a different question with a different owner.",
        breaks: {
          failure: "The gate runs on the logical send, before expansion.",
          handled: "Its cap counts logical notifications rather than the interruptions a user with two devices and two channels actually feels, which the design accepts rather than gating after fan-out.",
        },
      },
    },
    {
      id: "e3",
      from: "gate",
      to: "cache",
      tier: "control",
      label: "prefs, quiet hours, bucket",
      detail: {
        what: "Three reads and one write: channel preferences, quiet hours in the recipient's timezone, and a token taken from that user's hourly bucket.",
        why: "These are the reads that let the system refuse, and they have to be cheap enough to sit on the accept path for every request. Preference writes invalidate the cache by pub/sub, so a normal opt-out is visible here in under a second.",
        numbers: [
          { value: "prefs 1-minute TTL", explain: "Short enough that a preference change becomes visible on the accept path within a minute even without the pub/sub invalidation." },
          { value: "bucket window 1 hour, ~50B per user", explain: "The token bucket's window and per-user footprint; small enough to hold the whole user base's state cheaply." },
        ],
        breaks: {
          failure: "A preference change landing after the message is queued is not caught here at all.",
          handled: "The worker re-checks at dequeue as a second gate, at the cost of one extra cache read per send, which is what catches a change that arrived too late.",
        },
      },
    },
    {
      id: "e4",
      from: "gate",
      to: "fanout",
      tier: "data",
      label: "allowed sends only",
      detail: {
        what: "The sends that survived preferences, quiet hours and the cap, on their way to be expanded per device and channel.",
        why: "Everything that can refuse a send has now run. This is the boundary the design is built around: below it the only remaining question is when to send, so nothing downstream needs to know what a preference is.",
        breaks: {
          failure: "What was held rather than sent has to go somewhere.",
          handled: "Over-cap messages land in a digest buffer for the next allowed slot, and that buffer is monitored, since a digest buffer nobody drains is a silent miss with extra steps.",
        },
      },
    },
    {
      id: "e5",
      from: "fanout",
      to: "outbox",
      tier: "hot",
      step: 1,
      label: "rows + outbox row, one txn",
      detail: {
        what: "The fanned-out message rows and their unpublished outbox rows committed together in a single database transaction.",
        why: "This is the whole point of the outbox: the message and the record that it still has to be published either both exist or neither does. There is no window in which the API has returned accepted and nothing durable says so.",
        numbers: [
          { value: "~1.6 rows per accepted request", explain: "Matches the fan-out ratio; each accepted request produces this many message rows on average." },
          { value: "one outbox row per message", explain: "Every fanned-out message gets its own outbox row, so publication is tracked at message granularity, not request granularity." },
        ],
        breaks: {
          failure: "Any code path that writes the notification and publishes to Kafka in the same handler bypasses this transaction.",
          handled: "That reintroduces exactly the gap the outbox exists to close, so publishing is only ever done by the dedicated publisher process reading committed rows.",
        },
      },
    },
    {
      id: "e6",
      from: "outbox",
      to: "publisher",
      tier: "hot",
      step: 2,
      label: "unpublished rows",
      detail: {
        what: "The publisher claiming a batch of rows that are committed but not yet on a topic.",
        why: "Reading the table rather than being told about the write is what makes this crash-safe. A publisher that restarts finds the same unpublished rows waiting, so the recovery path and the normal path are the same code.",
        numbers: [
          { value: "~190 rows/s average, ~350/s at daytime peak", explain: "The claim rate under normal load, tracking the accept path's own traffic curve." },
          { value: "~4,400/s during a broadcast", explain: "The rate this loop has to sustain when a full-base broadcast is being drained." },
        ],
        breaks: {
          failure: "Claiming without a lease means two publisher instances can publish the same row twice.",
          handled: "This is survivable because the guarantee is at-least-once, but it doubles provider traffic during exactly the incident where headroom is already lowest, so claims are leased in practice.",
        },
      },
    },
    {
      id: "e7",
      from: "publisher",
      to: "push-topic",
      tier: "hot",
      step: 3,
      label: "one message per device",
      detail: {
        what: "The publisher moving per-device push messages onto notif.push, one per registered token.",
        why: "Each message carries its own notif_id so retry and dedup are independent per device: a user's stale iPad token must not block the phone that still works.",
        numbers: [{ value: "~1.5 tokens per user, ~15M push targets", explain: "Multiple devices per user is what turns the accepted-request volume into this many individual push targets." }],
        breaks: {
          failure: "This is the arrow that goes quiet when the publisher stalls.",
          handled: "The symptom is an empty queue with idle workers, which every depth-based alert reports as healthy, so publisher lag is monitored directly rather than inferred from this arrow.",
        },
      },
    },
    {
      id: "e8",
      from: "publisher",
      to: "email-topic",
      tier: "data",
      label: "one message per address",
      detail: {
        what: "The same publisher, moving email messages onto notif.email.",
        why: "Email fans out far less than push: one message per address rather than per device. It still goes through the identical outbox path, because the guarantee has to be the same on every channel a human actually reads.",
        breaks: {
          failure: "The queued payload carries template_id and params rather than a rendered body.",
          handled: "A template deleted or changed between enqueue and send renders something different from what was approved, so template changes are versioned and old versions kept until their queue has drained.",
        },
      },
    },
    {
      id: "e9",
      from: "publisher",
      to: "sms-topic",
      tier: "data",
      label: "one message per number",
      detail: {
        what: "SMS messages moving onto notif.sms, the narrowest lane and the only one with a per-message cost.",
        why: "Routing SMS through the same publisher is what lets its retry budget differ from the others. The guarantee machinery is shared, but the retry policy is per channel, and those are separate decisions.",
        numbers: [{ value: "~$0.0075 per message", explain: "The per-message cost that makes routing bulk traffic down this lane an actual budget line, not just a backlog." }],
        breaks: {
          failure: "Nothing on this arrow stops a bulk send from being routed here.",
          handled: "That has to be refused at accept instead, because 15M messages at 200/s is 20.8 hours of backlog, far too slow to catch downstream.",
        },
      },
    },
    {
      id: "e10",
      from: "push-topic",
      to: "push-workers",
      tier: "hot",
      step: 4,
      label: "consumer group",
      detail: {
        what: "Push workers draining their own topic at whatever rate the provider will accept.",
        why: "The pool is sized to the provider's published ceiling rather than to the queue depth. The queue is allowed to be deep; the provider is not allowed to be overrun. Backpressure lives in the topic, exactly what a durable log is for.",
        numbers: [
          { value: "~10k/s ceiling", explain: "The provider ceiling this consumer group paces itself against, not the queue's own depth." },
          { value: "4,200/s during a broadcast smear", explain: "4,200 ÷ 10,000 ≈ 42% of the provider ceiling — a smeared broadcast, the system's worst case, still leaves comfortable headroom before backpressure kicks in." },
        ],
        breaks: {
          failure: "When a circuit breaker trips, the worker stops consuming entirely.",
          handled: "The backlog then builds safely in the topic rather than burning the retry budget against a provider that is already down, exactly what a durable log is for.",
        },
      },
    },
    {
      id: "e11",
      from: "email-topic",
      to: "email-workers",
      tier: "data",
      label: "consumer group",
      detail: {
        what: "Email workers draining notif.email independently of whatever is happening on push.",
        why: "This is the arrow that proves the isolation claim. During a 30-minute APNs outage, this one keeps moving at its normal rate. That is why a push problem is a channel outage rather than a product outage.",
        breaks: {
          failure: "If high-priority push traffic falls back to email during an outage, this lane inherits the push load.",
          handled: "It inherits that load without inheriting push's headroom, so a fallback has to be rate-limited against the same per-user budget rather than sent unconditionally.",
        },
      },
    },
    {
      id: "e12",
      from: "sms-topic",
      to: "sms-workers",
      tier: "data",
      label: "consumer group",
      detail: {
        what: "SMS workers draining notif.sms, paced hard against the carrier limit.",
        why: "The pool is small on purpose. There is no benefit to consuming faster than roughly 200 messages a second, and consuming faster only converts a queue you can see into provider errors you have to classify.",
        numbers: [{ value: "~200 msg/s per account", explain: "The pace this consumer group is deliberately held to, matching the carrier's own ceiling." }],
        breaks: {
          failure: "The worker re-checks preferences at dequeue here as elsewhere.",
          handled: "On this channel that second check is often the legally authoritative one, since SMS opt-out rules are frequently stricter than general notification preferences.",
        },
      },
    },
    {
      id: "e13",
      from: "push-workers",
      to: "providers",
      tier: "hot",
      step: 5,
      label: "HTTP/2 + apns-id",
      detail: {
        what: "The actual push call, carrying notif_id as the provider's own dedup identifier.",
        why: "This is the only hop where somebody else does the duplicate suppression for you, which is worth using precisely because the hop before it leaks around a crash. It is also the hop where 200 stops meaning delivered.",
        numbers: [
          { value: "~1k msg/s per connection", explain: "The per-connection throughput that, multiplied across roughly ten connections, reaches the pool's ~10k/s ceiling." },
          { value: "429 obeys Retry-After, not our curve", explain: "A provider-supplied backoff header overrides whatever retry schedule the worker would otherwise use." },
        ],
        breaks: {
          failure: "Honouring your own backoff over Retry-After extends the throttle.",
          handled: "An unjittered curve also synchronises the whole backlog into one instant when the provider returns, so the worker obeys Retry-After exactly and jitters its own retries.",
        },
      },
    },
    {
      id: "e14",
      from: "email-workers",
      to: "providers",
      tier: "data",
      label: "SMTP, warm standby",
      detail: {
        what: "The send to SES, with a second provider behind the same adapter and health-based routing between them.",
        why: "Two providers exist because 99.9% published availability is 8.8 hours a year and a single-provider channel cannot back a 99.95% SLO. The standby carries a few percent of live traffic permanently so its sending reputation is warm when it is needed.",
        numbers: [
          { value: "SES ~10k/s warm", explain: "The provider ceiling this send is paced against, contingent on a warm sending reputation." },
          { value: "99.9% = 8.8 hours a year", explain: "The published availability baseline for a single provider, the gap a second provider exists to close." },
        ],
        breaks: {
          failure: "Failing over to a cold standby gives you worse deliverability than the outage did.",
          handled: "Reputation is earned by sending and cannot be provisioned at the moment of need, which is why the standby carries a small constant share of live traffic to stay warm.",
        },
      },
    },
    {
      id: "e15",
      from: "sms-workers",
      to: "providers",
      tier: "data",
      label: "HTTPS, single attempt",
      detail: {
        what: "One HTTPS call per message to the SMS provider, with no retry behind it.",
        why: "The provider's accept is not the delivery, so a retried 5xx here can deliver twice. On the channel where a duplicate costs money and arrives as an unavoidable interruption, the safer failure is the miss.",
        numbers: [
          { value: "~$0.0075 per message", explain: "The per-message cost behind the decision to send once rather than retry." },
          { value: "1 attempt", explain: "The retry budget for this channel, deliberately the smallest in the system." },
        ],
        breaks: {
          failure: "The real state of this send is not known on this arrow at all.",
          handled: "It arrives minutes later on a webhook, so anything that treats the 202 as terminal is reporting a guess. The status store waits for the webhook before recording a terminal state.",
        },
      },
    },
    {
      id: "e16",
      to: "status-store",
      tier: "control",
      label: "attempt log, every lane",
      from: "lanes",
      detail: {
        what: "Every push attempt and its resulting state written against the notif_id, including the 410s that prune a dead token.",
        why: "Persisting on every transition is what lets a worker restart resume from durable state instead of inferring it from queue position. It is also the only record of which tokens are dying and how fast.",
        numbers: [
          { value: "up to 4 attempt writes per message", explain: "One write per retry attempt, matching the channel's own retry budget." },
          { value: "~1 KB per record", explain: "1KB × up to 4 attempts per message means one send can cost 4KB of bookkeeping — why unbatched per-attempt writes would outweigh the send itself." },
        ],
        breaks: {
          failure: "One round trip per attempt is a write per send against a store nobody reads.",
          handled: "Workers accumulate attempt records in memory across a poll cycle and flush them as one bulk write, rather than a synchronous round trip per attempt, or bookkeeping outcosts the send.",
        },
      },
    },
    {
      id: "e19",
      from: "providers",
      to: "status-store",
      tier: "control",
      label: "delivery / bounce webhooks",
      detail: {
        what: "Terminal states posted back minutes later: confirmed, bounced, or a recipient that no longer exists.",
        why: "This is the only inbound signal from outside the system. It drives both the Delivered to Confirmed transition and the token pruning that keeps the next broadcast from paying for devices that no longer exist.",
        numbers: [{ value: "a few percent of 15M tokens is hundreds of thousands of wasted sends", explain: "The scale of stale-token waste this feedback loop exists to prevent, even at a small percentage of the push target population." }],
        breaks: {
          failure: "It still says nothing about display.",
          handled: "A confirmation means the message reached an inbox or a handset, not that a human saw it. Acceptance rate and open rate are published as two separate numbers, never multiplied into one.",
        },
      },
    },
  ],
  figures: {
    "dedup-hops": {
      title: "Four hops, four suppression mechanisms, one gap",
      nodes: [
        { id: "hop1", label: "Caller retry", sub: "idempotency key", kind: "service", col: 0, row: 0 },
        { id: "hop2", label: "DB → queue", sub: "outbox, one txn", kind: "service", col: 0, row: 1 },
        { id: "hop3", label: "Worker redelivery", sub: "sent:{notif_id}", kind: "service", col: 0, row: 2 },
        { id: "hop4", label: "Provider retry", sub: "apns-id dedup", kind: "service", col: 0, row: 3 },
        {
          id: "device",
          label: "Provider → device",
          sub: "no ack: gap remains",
          kind: "client",
          col: 0,
          row: 4,
          detail: {
            what: "The one hop with no suppression mechanism, because there is nothing to acknowledge past it.",
            why: "A 200 from a provider means it was accepted, not that a handset received it or a person saw it. Every earlier hop narrows a duplicate window; this one cannot, by construction.",
          },
        },
      ],
      edges: [
        { id: "e1", from: "hop1", to: "hop2", tier: "hot", step: 1, label: "conditional insert" },
        { id: "e2", from: "hop2", to: "hop3", tier: "hot", step: 2, label: "committed, then published" },
        { id: "e3", from: "hop3", to: "hop4", tier: "hot", step: 3, label: "sent-key narrows window" },
        { id: "e4", from: "hop4", to: "device", tier: "hot", step: 4, label: "accepted, not delivered" },
      ],
    },
  },
};
