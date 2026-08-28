import type { Diagram } from "./types";

export const NOTIFICATION_SYSTEM: Diagram = {
  id: "notification-system",
  title: "Notification System",
  question: "Design a Notification System",
  sourceId: "patterns",
  itemId: 7,
  overview: {
    shape:
      "One front door that can refuse a send, then one durable queue per channel below it, each with its own worker pool paced to a provider nobody here controls.",
    beats: [
      "Whether to notify was already decided by the caller, so this system does three things only: fan-out, delivery, and restraint. One ingestion service is the only front door. It validates, checks the caller's idempotency key, and expands one logical send into one message per user, channel and device, an average fan-out of about 1.6 and 15M push targets if the target is the whole base.",
      "The per-user gate sits above the queues, and its placement is the design rather than a detail. Preferences, quiet hours in the recipient's timezone and a bucket of five notifications an hour decide whether the send happens at all, because once a message is sitting in a channel queue the only question left is when to send it, not whether to.",
      "The write is a transactional outbox: the notification rows and an unpublished outbox row commit together, and a publisher moves them onto the channel topics only after the broker acknowledges. That closes the gap between the database accepting a send and the queue receiving it, and it introduces the one failure that queue-depth alerting cannot see.",
      "Below the outbox there is one topic per channel and one worker pool per provider. Push, email and SMS have different published ceilings, different error vocabularies and independent outages, so a shared backlog would mean an APNs bad hour stops email too. Each worker classifies the response rather than treating failure as a boolean, and after four attempts the message dead-letters instead of retrying forever.",
      "The guarantee is at-least-once with duplicate suppression at four hops: the caller's idempotency key, the outbox, a recently-sent set inside the worker, and the provider's own dedup id. That is observably exactly-once and is a different sentence from exactly-once, because hop three leaks in the milliseconds around a crash and hop five, provider to handset, is not yours at all.",
      "Tracking runs alongside all of it. Every state transition is persisted against the notif_id so a worker restart resumes from durable state rather than inferring it from queue position, and terminal states arrive minutes later by webhook. Every number the status store can report is an acceptance rate wearing a delivery label.",
    ],
    crux:
      "A notification is user-visible and cannot be recalled, and the final hop belongs to somebody else. So the honest design is at-least-once with a dedup key at every hop you own, never exactly-once, and the restraint that decides whether the product works has to sit above the queues rather than in the delivery tier.",
    numbers: [
      "10M sends/day = ~120/s, ~220/s daytime",
      "15M push targets; a broadcast smeared to 4,200/s under a ~10k/s ceiling",
      "4 attempts at 30s, 5min and 1h, then the DLQ",
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
        why: "Preferences, quiet hours and a provider rate limit that every team shares can only be enforced in one place. Spread across a client library, each service reimplements restraint, one team forgets, and each backs off independently against a limit they hold in common. The stages are stages rather than services because a request passes through all four or none: they deploy together, they fail together, and splitting them would buy independent scaling of a path that runs at 120 a second.",
        numbers: [
          "~6M accepted requests/day, ~120 sends/s after fan-out",
          "~220/s daytime, 80% of traffic in a 10-hour window",
          "idempotency_key is required, never defaulted",
        ],
        breaks:
          "A segment-wide broadcast accepted synchronously puts 15M messages on the queues in seconds, which is why segment targets are rejected at the front and routed to the batch path instead.",
        choice: {
          pick: "One accepting service in front of durable per-channel queues",
          instead:
            "A shared client library that each calling service sends with directly.",
          decider:
            "Roughly a hundred sends a second or three channels is where the library stops winning, and this system is at 120/s across four channels. Past that line there is no common place to apply preferences and every service throttles independently against one shared provider limit.",
          flips:
            "Ten services and a few thousand sends a day, where the extra hop, the persistence tier and the on-call surface buy nothing you cannot get from a function call.",
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
          "~6M accepted requests/day, ~220/s daytime",
          "idempotency cache 24h TTL, ~1.2 GB resident",
          "idempotency_key is required, never defaulted",
        ],
        breaks:
          "Read-then-write loses the race between two parallel retries: both miss the cache and both create a notification. The check has to be a conditional insert, and the loser has to wait for the winner's notif_id.",
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
        what: "The only stage that can refuse or delay a send: preferences, quiet hours in the recipient's timezone, and a token bucket of five notifications per user per hour, with anything over the cap held and collapsed into one digest.",
        why: "Throughput was never at risk here, so human tolerance is the scarce resource. A system that delivers every notification reliably and then gets muted in settings has failed at exactly the thing it was built for, and no retry policy recovers a user who has turned notifications off. It runs above the queues because once a message is in a channel queue the only question left is when to send it, not whether to.",
        numbers: [
          "5 per user per hour at normal priority",
          "average user 0.6 notifications/day, p99 user above 40",
          "above ~20% bypass traffic the gate has stopped working",
        ],
        breaks:
          "Bypass inflation. Every team believes its notification is transactional, so unless the bypass list is centrally owned and audited it grows until the cap protects nobody.",
        choice: {
          pick: "A per-user token bucket in front of the channel queues, digesting the overflow",
          instead:
            "Send everything immediately and give users granular per-category toggles instead.",
          decider:
            "The top of the distribution rather than the average. The average user gets 0.6 notifications a day, so a cap of five an hour is invisible to almost everyone; the p99 user above 40 a day is the entire reason the limiter exists, and every user who disables notifications comes from that tail.",
          flips:
            "When every notification is individually actionable and time-critical. A two-factor code, a trade fill or an on-call page in a digest is worse than no notification, so a paging product keeps the preference and quiet-hours checks and drops the limiter.",
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
        why: "Retry and dedup have to be independent per target: a user's stale iPad token must not block the phone that still works, and a bounced email address must not fail the push. Expansion here rather than in the workers means the per-message state exists before anything is queued, so a redelivery has something durable to resume from.",
        numbers: [
          "~1.5 registered push tokens per user, ~15M push targets",
          "fan-out ~1.6 messages per accepted request",
          "a full-base broadcast is 15M rows, 1.5x a normal day",
        ],
        breaks:
          "The gate ran on the logical send, before this expansion, so the cap counts logical notifications rather than the interruptions a user with two devices and two channels actually feels.",
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
        why: "Two writes to two systems with no shared transaction. Publish first and a crash before the commit produces a notification nobody can look up; commit first and a crash before the publish loses it silently, which is worse, because the API already told the caller it was accepted. The table is the second of the four dedup hops.",
        numbers: [
          "one row per fanned-out message, ~1.6 per accepted request",
          "rows marked published only after the broker acknowledges",
          "published rows reaped on a schedule, not left to accumulate",
        ],
        breaks:
          "Nothing reaps published rows and the table grows without bound behind a workload that never reads it; and because rows are claimed in batches, ordering across a user's channels is not preserved here and must not be relied on downstream.",
        choice: {
          pick: "Transactional outbox with a separate publisher process",
          instead: "Publishing to Kafka directly from the request handler.",
          decider:
            "Which failure ordering you can live with. A direct publish loses the message on any crash between commit and publish, after the API already returned accepted, and at 6M accepted requests a day a rare crash is a steady trickle of silent misses nobody can find.",
          flips:
            "A best-effort channel such as an in-app badge that the client reconciles on its next fetch, where an outbox row per badge update costs more than the notification it is protecting.",
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
        why: "This is what makes the outbox worth having. Committing the row and publishing it are separated in time on purpose, so a crash anywhere in between leaves an unpublished row that the next pass picks up rather than a message that was accepted and then quietly lost.",
        numbers: [
          "~190 rows/s at daytime steady, ~4,400/s during a broadcast",
          "publisher lag and outbox depth are first-class metrics",
          "re-publish on an unacknowledged write, hence at-least-once",
        ],
        breaks:
          "A stalled publisher presents as an empty queue and idle workers while rows pile up in a table nobody graphs, so outbox depth and publisher lag have to be alerted on directly rather than inferred from queue depth. Every queue-based signal reports this failure as healthy.",
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
        why: "All three are read before anything is written and all three are disposable once their TTL expires, so paying a durable-store round trip for them on every accepted request is the wrong trade. Preference writes invalidate by pub/sub, so a normal opt-out propagates in under a second.",
        numbers: [
          "idempotency cache ~1.2 GB at 24h TTL",
          "rate-limiter state ~500 MB across 10M users",
          "prefs 1-minute TTL, pub/sub invalidation on write",
        ],
        breaks:
          "The dedup write has to be a conditional insert rather than a read followed by a write, or two retries arriving in parallel both miss the cache and both create a notification.",
        choice: {
          pick: "Redis for dedup keys, preferences and buckets in one tier",
          instead:
            "Reading the preferences database directly on every accepted request.",
          decider:
            "1.2 GB of dedup keys plus 500 MB of bucket state, every byte of it read on the accept path at 120/s and every byte of it worthless after 24 hours. That is cache-shaped state, and a durable store gives you nothing back for the latency.",
          flips:
            "When the preference check has to be authoritative for GDPR or CCPA, where the TTL drops to 10 seconds at the worker tier or the read goes to the source of truth and you accept the extra load.",
        },
      },
    },
    {
      id: "lanes",
      label: "Per-channel delivery lanes",
      kind: "zone",
      detail: {
        what: "One backlog and one worker pool per channel, each sized and retried against its own provider.",
        why: "Providers fail independently and publish different ceilings, so the only thing that keeps a bad hour on push from becoming a product-wide outage is that email and SMS never share its queue. Isolation here is what turns a system-wide outage into a channel outage.",
        numbers: [
          "push ~10k/s, SES ~10k/s, SMS ~200/s",
          "4 attempts on push and email, 1 on SMS",
        ],
        breaks:
          "Operational sprawl: one notification system is really several channel systems behind a shared front door, each with its own credentials, its own sending reputation and its own way of telling you it is unhappy.",
        choice: {
          pick: "One queue and one worker pool per channel",
          instead: "A single shared queue with a channel field on the message.",
          decider:
            "What a 30-minute APNs outage costs. With one queue, 15M backed-up push messages sit in front of every password reset going out by email; with a queue per channel the other channels drain at their normal 120/s throughout.",
          flips:
            "A single channel, or volumes low enough that a provider outage is absorbed by one worker pool anyway, where three brokers' worth of operational surface buys nothing.",
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
        why: "This is the topic a broadcast lands on, so it is the one that has to absorb 1.5 days of normal traffic in one event without pushing it at the provider as fast as the pool allows. Retention exists so a worker rebuild or a same-week audit can replay rather than lose.",
        numbers: [
          "~4,200/s during a 60-minute broadcast smear",
          "~2 KB per message: template_id, params, routing keys",
          "7-day retention, ~300 GB used, 500 GB provisioned",
        ],
        breaks:
          "A 30-minute APNs outage fills this topic while the others drain normally, and the risk is the recovery: without jitter, every message queued during the outage retries in the same instant and re-throttles the provider you were waiting for.",
        choice: {
          pick: "A Kafka topic per channel with a consumer group per channel",
          instead:
            "One shared queue with a channel field, or a managed work queue such as SQS.",
          decider:
            "Isolation plus replay. 7 days of retention costs about 300 GB and covers a worker rebuild and an audit, and a per-channel topic means a provider down for 30 minutes backs up one channel rather than all of them.",
          flips:
            "One channel and no replay requirement, where a managed work queue is far less to operate and the retention window is never used.",
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
          "SES ~10k/s with a warm sending reputation",
          "daytime steady ~440 KB/s across all channel topics",
          "carries broadcast traffic, unlike SMS",
        ],
        breaks:
          "Cross-channel fallback doubles a user's notification count unless the fallback consumes the same rate-limit budget, so an outage turns into an over-notification incident.",
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
          "~200 msg/s per account, carrier-throttled",
          "15M / 200 per second = 20.8 hours for a full-base send",
          "~$0.0075 per message",
        ],
        breaks:
          "Anything that routes bulk traffic here silently converts a marketing send into a day-long backlog sitting in front of the one-time codes that actually need this channel.",
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
        why: "The provider's response class is the state machine, not a detail below it: 5xx and 429 requeue, 410 Gone or UNREGISTERED prunes the token, 400 or 413 is a code bug worth alerting on, 403 pages because a certificate has expired and every send on the channel is now failing. Treating the response as a boolean gets both halves wrong.",
        numbers: [
          "~1k msg/s per HTTP/2 connection x ~10 connections = ~10k/s",
          "4 attempts at 30s, 5min and 1h",
          "FCM batch endpoint takes up to 500 tokens per call",
        ],
        breaks:
          "The worker can die between the provider returning 200 and the sent:{notif_id} key being written, so this hop narrows the duplicate window to a few milliseconds around a crash rather than closing it.",
        choice: {
          pick: "A sent:{notif_id} check before the call, plus apns-id passed to the provider",
          instead: "Relying on the queue's own delivery semantics alone.",
          decider:
            "Where the crash lands. An uncommitted offset redelivers every message in flight; the local check removes all but the millisecond window between the 200 and the key write, and apns-id lets Apple discard what still slips through. Note apns-collapse-id is display coalescing, a different feature entirely.",
          flips:
            "An in-app or badge channel whose client reconciles state on its next fetch, where a duplicate is invisible and two extra round trips per send are not worth paying for.",
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
        why: "Rendering localised content per notification costs 10 to 50ms, which is invisible at 120/s and is 4,200 concurrent renders during a broadcast, so the static shell is rendered when the template is published and only the per-user slots are substituted here.",
        numbers: [
          "SES ~10k/s with a warm reputation",
          "a second integration is roughly 4 engineer-weeks",
          "a few percent of live traffic permanently routed to the standby",
        ],
        breaks:
          "An account-level send pause from a bounce rate you caused follows the sender, not the provider, so a second integration buys nothing against the failure that actually happens most often.",
        choice: {
          pick: "Two email providers behind one adapter, both kept warm",
          instead:
            "One provider, and treat an outage as an outage on the status page.",
          decider:
            "99.9% published availability is 8.8 hours of downtime a year, so a single-provider channel cannot support a 99.95% per-channel SLO on paper regardless of how well you build it. Against that, four engineer-weeks and a few percent of live traffic on the standby.",
          flips:
            "A 99.9% SLO, or when the same content is in the app anyway and the queue replays when the provider returns, which is most products.",
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
        why: "This is the one channel where a duplicate is clearly worse than a miss. An SMS costs about $0.0075, arrives as an interruption the recipient cannot dismiss without reading it, and at a 1% duplicate rate over 1M messages a month that is $75 and roughly ten thousand annoyed people.",
        numbers: [
          "1 attempt here, versus 4 on push and email",
          "~200 msg/s per account, carrier-throttled",
          "terminal state arrives by webhook minutes later",
        ],
        breaks:
          "Retrying a 5xx from the provider may deliver twice, since the accept is not the delivery and there is nothing on that hop to tell you which it was.",
        choice: {
          pick: "A retry budget of one for SMS, four for push, email and in-app",
          instead: "The same four-attempt budget on every channel.",
          decider:
            "Whether a duplicate is worse than a miss, which has a different answer per channel. $0.0075 a message at a 1% duplicate rate over 1M a month is $75 and ten thousand interruptions; a duplicate in-app badge costs nothing and nobody notices.",
          flips:
            "A provider that accepts a dedup identifier on the send call the way APNs does with apns-id, which closes the fourth hop and makes a retry safe to make.",
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
        why: "This is where the guarantee stops by construction. A call to APNs is an HTTP request with no transaction to enrol in, and the hop after it, provider to device, is not yours: a 200 means Apple accepted the message, not that it reached a phone or that a person saw it.",
        numbers: [
          "push ~10k/s, SES ~10k/s, SMS ~200/s",
          "every delivery number here is really an acceptance number",
          "each provider publishes 99.9% availability, 8.8 hours a year",
        ],
        breaks:
          "The device may be off for two days and the notification expires silently, or the user may have muted the app at OS level, which is indistinguishable from a successful delivery from where we stand.",
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
        what: "One record per notification keyed by notif_id, carrying every attempt and the current state: queued, attempting, delivered, bounced, failed.",
        why: "State is persisted on every transition so a worker restart resumes from durable state rather than inferring it from queue position, which breaks the moment a message is redelivered. It is also the only place that catches two services deciding to notify about the same event with different idempotency keys.",
        numbers: [
          "~1 KB per record: 10 GB/day logical, 30 GB/day at RF 3",
          "7 days hot, then columnar archive at ~730 GB/yr",
          "up to 4 attempt writes per message",
        ],
        breaks:
          "Write-heavy and read almost never, so attempt writes have to be batched per worker poll rather than one round trip per attempt, or the store costs more than the sending does.",
        choice: {
          pick: "A wide-column store partitioned by user_id, 7 days hot then archived",
          instead: "The same relational database that holds preferences.",
          decider:
            "10 GB a day logical and 30 GB replicated, almost entirely blind writes against reads that hardly ever happen. Dictionary-encoded columnar files compress about 5x, so a year of history is ~730 GB and retention is never the constraint.",
          flips:
            "Volumes low enough that the status table fits beside preferences, where one database is less to operate and you get real queries for freshness analysis for free.",
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
        numbers: ["24h TTL, far longer than a caller's ten-second retry"],
        breaks:
          "Read-then-write loses the race between two parallel retries: both miss, both create. It has to be a conditional insert, and the loser has to wait for the winner's notif_id rather than proceeding on its own.",
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
        why: "Validation and restraint are separate jobs even inside one service. By this point the request is known to be well formed and not a retry, so the only remaining question is whether this person wants this notification right now, which is a different question with a different owner.",
        breaks:
          "The gate runs on the logical send, before expansion, so its cap counts logical notifications rather than the interruptions a user with two devices and two channels actually feels.",
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
        numbers: ["prefs 1-minute TTL", "bucket window 1 hour, ~50B per user"],
        breaks:
          "A preference change landing after the message is queued is not caught here at all, which is why the worker re-checks at dequeue as a second gate at the cost of one cache read per send.",
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
        breaks:
          "What was held rather than sent has to go somewhere. Over-cap messages land in a digest buffer for the next allowed slot, and a digest buffer nobody drains is a silent miss with extra steps.",
      },
    },
    {
      id: "e5",
      from: "fanout",
      to: "outbox",
      tier: "hot",
      label: "rows + outbox row, one txn",
      detail: {
        what: "The fanned-out message rows and their unpublished outbox rows committed together in a single database transaction.",
        why: "This is the whole point of the outbox: the message and the record that it still has to be published either both exist or neither does. There is no window in which the API has returned accepted and nothing durable says so.",
        numbers: ["~1.6 rows per accepted request", "one outbox row per message"],
        breaks:
          "Any code path that writes the notification and publishes to Kafka in the same handler bypasses this transaction and reintroduces exactly the gap it exists to close.",
      },
    },
    {
      id: "e6",
      from: "outbox",
      to: "publisher",
      tier: "hot",
      label: "unpublished rows",
      detail: {
        what: "The publisher claiming a batch of rows that are committed but not yet on a topic.",
        why: "Reading the table rather than being told about the write is what makes this crash-safe. A publisher that restarts finds the same unpublished rows waiting, so the recovery path and the normal path are the same code.",
        numbers: ["~190 rows/s daytime steady", "~4,400/s during a broadcast"],
        breaks:
          "Claiming without a lease means two publisher instances publish the same row twice, which is survivable because the guarantee is at-least-once, but it doubles provider traffic during exactly the incident where you have least headroom.",
      },
    },
    {
      id: "e7",
      from: "publisher",
      to: "push-topic",
      tier: "hot",
      label: "one message per device",
      detail: {
        what: "The publisher moving per-device push messages onto notif.push, one per registered token.",
        why: "Each message carries its own notif_id so retry and dedup are independent per device: a user's stale iPad token must not block the phone that still works.",
        numbers: ["~1.5 tokens per user, ~15M push targets"],
        breaks:
          "This is the arrow that goes quiet when the publisher stalls, and the symptom is an empty queue with idle workers, which every depth-based alert reports as healthy.",
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
        why: "Email fans out far less than push, one message per address rather than per device, but it goes through the identical outbox path because the guarantee has to be the same on every channel a human actually reads.",
        breaks:
          "The queued payload carries template_id and params rather than a rendered body, so a template deleted or changed between enqueue and send renders something different from what was approved.",
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
        why: "Routing SMS through the same publisher is what lets its retry budget differ from the others: the guarantee machinery is shared, the retry policy is per channel, and those are separate decisions.",
        numbers: ["~$0.0075 per message"],
        breaks:
          "Nothing on this arrow stops a bulk send from being routed here; that has to be refused at accept, because 15M messages at 200/s is 20.8 hours of backlog.",
      },
    },
    {
      id: "e10",
      from: "push-topic",
      to: "push-workers",
      tier: "hot",
      label: "consumer group",
      detail: {
        what: "Push workers draining their own topic at whatever rate the provider will accept.",
        why: "The pool is sized to the provider's published ceiling rather than to the queue depth, because the queue is allowed to be deep and the provider is not allowed to be overrun. Backpressure lives in the topic, which is exactly what a durable log is for.",
        numbers: ["~10k/s ceiling", "4,200/s during a broadcast smear"],
        breaks:
          "When a circuit breaker trips, the worker stops consuming entirely so the backlog builds safely rather than burning the retry budget against a provider that is already down.",
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
        why: "This is the arrow that proves the isolation claim: during a 30-minute APNs outage this one keeps moving at its normal rate, which is why a push problem is a channel outage rather than a product outage.",
        breaks:
          "If high-priority push traffic falls back to email during an outage, this lane inherits the push load without inheriting its headroom.",
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
        numbers: ["~200 msg/s per account"],
        breaks:
          "The worker re-checks preferences at dequeue here as elsewhere, and on this channel that second check is often the legally authoritative one.",
      },
    },
    {
      id: "e13",
      from: "push-workers",
      to: "providers",
      tier: "hot",
      label: "HTTP/2 + apns-id",
      detail: {
        what: "The actual push call, carrying notif_id as the provider's own dedup identifier.",
        why: "This is the only hop where somebody else does the duplicate suppression for you, which is worth using precisely because the hop before it leaks around a crash. It is also the hop where 200 stops meaning delivered.",
        numbers: ["~1k msg/s per connection", "429 obeys Retry-After, not our curve"],
        breaks:
          "Honouring your own backoff over Retry-After extends the throttle, and an unjittered curve synchronises the whole backlog into one instant when the provider returns.",
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
        numbers: ["SES ~10k/s warm", "99.9% = 8.8 hours a year"],
        breaks:
          "Failing over to a cold standby gives you worse deliverability than the outage did, because reputation is earned by sending and cannot be provisioned at the moment of need.",
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
        numbers: ["~$0.0075 per message", "1 attempt"],
        breaks:
          "The real state of this send is not known on this arrow at all; it arrives minutes later on a webhook, so anything that treats the 202 as terminal is reporting a guess.",
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
        why: "Persisting on every transition is what lets a worker restart resume from durable state instead of inferring it from queue position, and it is the only record of which tokens are dying and how fast.",
        numbers: ["up to 4 attempt writes per message", "~1 KB per record"],
        breaks:
          "One round trip per attempt is a write per send against a store nobody reads, so these have to be batched per worker poll or the bookkeeping outcosts the sending.",
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
        why: "This is the only inbound signal from outside the system, and it drives both the Delivered to Confirmed transition and the token pruning that keeps the next broadcast from paying for devices that no longer exist.",
        numbers: ["a few percent of 15M tokens is hundreds of thousands of wasted sends"],
        breaks:
          "It still says nothing about display. A confirmation means the message reached an inbox or a handset, not that a human saw it, so acceptance rate and open rate have to be published as two numbers rather than multiplied into one.",
      },
    },
  ],
};
