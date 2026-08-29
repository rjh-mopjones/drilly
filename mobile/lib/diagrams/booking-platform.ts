import type { Diagram } from "./types";

export const BOOKING_PLATFORM: Diagram = {
  id: "booking-platform",
  title: "Booking Platform",
  question: "Design Airbnb (Booking Platform)",
  sourceId: "patterns",
  itemId: 30,
  overview: {
    shape:
      "A discovery side ranking 10M listings from a deliberately stale index, and a supply side where a booking, a host's edits and a rival's poll all mutate one calendar row.",
    forces: [
      {
        constraint: "100M searches/day against 1M bookings/day is a 100:1 look-to-book ratio, ~12k QPS peak against ~120 commits/s",
        decision: "Search service reads a deliberately stale search index rather than the live calendar, keeping the two paths independent",
        lights: ["search-svc", "search-index", "calendar", "e2"],
      },
      {
        constraint: "checking three specific nights against 10M calendars is not a query a system can answer at 12k QPS",
        decision: "Each search index document carries a precomputed availability summary instead of a live join to the calendar",
        lights: ["search-index", "e2"],
      },
      {
        constraint: "one listing-night cannot be split the way one of a hotel's many identical rooms can",
        decision: "Calendar rows are one row per (listing_id, date), locked and re-validated at commit rather than trusted from search",
        lights: ["calendar", "booking-orch", "e8"],
      },
      {
        constraint: "~2M listings, roughly a fifth of the catalogue, are also sold on a rival site we only learn about on a 15-to-60-minute poll",
        decision: "Channel sync may only ever block a night, never release one, so a stale partner feed cannot resell a night already sold",
        lights: ["channel-sync", "calendar", "e14"],
      },
      {
        constraint: "card authorisation against the payment processor runs ~1-2s p99, the largest single term against a p99 2s SLO",
        decision: "The Booking orchestrator takes a 2ms transactional hold first, then authorises the card outside that hold",
        lights: ["booking-orch", "e8", "e7"],
      },
    ],
    naive: {
      text: "Keep one authoritative count of available nights per listing, the same model a hotel's fungible-room inventory uses, and let search read it directly. A single listing-night cannot be split the way a hotel room type can. There is no compensation that repairs a guest locked out of a night sold twice. At 10M calendars and 12k search QPS, joining every query against live calendar rows would need far more reads than a single-writer-per-shard calendar can serve. The design instead denormalises a precomputed availability summary into the search index, and checks the real calendar rows only once, at the commit.",
      lights: ["search-index", "calendar"],
    },
    beats: [
      {
        text: "The traffic is discovery, not booking. 100M searches a day against 1M bookings is a 100:1 look-to-book ratio, so ~12k QPS at peak sits against ~120 commits/s. The two paths share nothing but the listing id, which is what lets search run on an index that is allowed to be 60 seconds wrong.",
        lights: ["guest", "search-svc", "booking-orch", "e1", "e7"],
      },
      {
        text: "A search is a geo bounding box plus facets plus dates, answered in one query: city or viewport, guests >= 2, price under €200 a night, those specific nights free. The last clause is the awkward one; it is a per-listing calendar question. So the document carries a precomputed availability summary rather than the calendar itself.",
        lights: ["search-svc", "search-index", "e2"],
      },
      {
        text: "Ranking is where the marketplace shows through. The document also carries ranking features, and the signals are host-behaviour signals: review scores weighted by reviewer reputation and verified stay, a host's channel-conflict rate, and last-minute releases suppressed. A night that goes free at short notice is genuinely lower quality inventory.",
        lights: ["search-index", "reviews", "e17"],
      },
      {
        text: "Price is per host and per night, not a rate card. Host rules resolve into a price_override on each calendar row, and the listing page quotes the exact nights. The number is snapshotted onto the booking, so a host rule change between quote and commit cannot move what the guest agreed to pay.",
        lights: ["host-app", "listing-svc", "calendar", "e12", "e4"],
      },
      {
        text: "The commit itself spends almost all of its latency budget on one call it does not control. The 2ms transactional hold takes the nights; card authorisation against the payment processor runs outside that hold and costs ~1-2s p99. That term actually decides whether the whole saga lands inside the p99 2s SLO, and confirm follows once both have succeeded.",
        lights: ["booking-orch", "e7", "e8"],
      },
      {
        text: "The calendar is the supply record and it has three writers. The guest's booking takes the nights under the short transactional hold above, which is the same class of problem as a fungible-inventory hotel reservation, not what makes this one hard. The host edits ranges directly to block nights and set minimum stays. Channel-sync ingestion writes what a rival site already sold, and may only ever block, never release.",
        lights: ["calendar", "host-app", "channel-sync", "e8", "e11", "e14"],
      },
      {
        text: "CDC closes the loop back to discovery: a change-data-capture pipeline reads the database's own write log and streams it to an indexer. That is ~120 calendar mutations a second average and ~1,200 at peak, refreshing the availability summary within 60 seconds. That lag is the entire availability-lost budget, and at 0.1 bookings per listing per day it costs almost nothing.",
        lights: ["cdc", "search-index", "e9", "e10"],
      },
    ],
    crux: {
      problem:
        "The inventory is not ours. Search has to filter and rank over 10M calendars owned by third parties who change them out of band.",
      handled:
        "An exact index would mean reading calendar rows for millions of listings per query, and a fresher one buys nothing measurable. Discovery is therefore a suggestion, and the commit is the only truth. For 5 to 60 minutes at a time even the commit can be wrong, because a host sold the night somewhere else before channel sync caught up.",
    },
    numbers: [
      {
        value: "100M searches/day vs 1M bookings/day",
        explain: "The look-to-book ratio the whole read side is sized against; almost all traffic is browsing, not committing.",
      },
      {
        value: "~12k search QPS peak vs ~120 commits/s",
        explain: "Roughly a 100x gap between the two paths, which is why search runs on a stateless tier over a derived index rather than touching the calendar.",
      },
      {
        value: "60s CDC freshness, ~120 calendar events/s",
        explain: "How stale the search index is allowed to be, and the steady rate of calendar mutations the CDC pipeline carries back into it.",
      },
      {
        value: "0.1 bookings per listing per day",
        explain: "How rarely any single listing is actually contested, which is what makes a 60-second-stale index cost almost nothing in lost bookings.",
      },
    ],
  },
  nodes: [
    {
      id: "supply-zone",
      label: "Supply we do not own",
      kind: "zone",
      detail: {
        what: "The two boxes that write availability on somebody else's behalf: the host's own tools, and the channel-sync ingester polling rival sites.",
        why: "Every other part of the system is one we control end to end. Here the authority is a human or a partner API. The design question is not how to lock a row, but what to believe and how late we are allowed to find out.",
        numbers: [
          { value: "~2M listings also sold elsewhere", explain: "The scale of the catalogue where our calendar can be wrong because a rival site sold a night first." },
          { value: "5 to 60 min exposure window", explain: "How long a sale on a rival site can go unseen before the polling cycle catches up, depending on the partner's integration." },
        ],
        breaks: {
          failure: "A host sells a night on a rival site and we confirm a booking for it before the next poll.",
          handled: "Nothing in the commit path can see that in time. To the guest it looks exactly like our bug, which is why the messaging path exists to hand it to a human host to resolve.",
        },
      },
    },
    {
      id: "guest",
      label: "Guest client",
      sub: "map viewport, dates, filters",
      kind: "external",
      col: 0,
      row: 0,
      detail: {
        what: "The browser or app that pans a map, sets dates and guest count, opens listings and eventually posts a booking with an idempotency key.",
        why: "It is drawn because it generates almost all the load and none of the value. A hundred searches happen for every booking, and the client also retries a POST after a dropped connection. The key it sends is what makes the commit safe to repeat.",
        numbers: [
          { value: "100M searches/day", explain: "The daily read volume the whole discovery side is sized against." },
          { value: "100:1 look-to-book", explain: "The ratio between browsing and committing, the reason the two paths are built to different economics." },
          { value: "1M bookings/day", explain: "The daily commit volume, two orders of magnitude below the search volume." },
        ],
        breaks: {
          failure: "A guest who picks a result the index still believes is free gets AVAILABILITY_LOST after committing to a checkout flow.",
          handled: "That is friction the client has to absorb gracefully rather than a correctness failure, since the commit itself never lets a double booking through.",
        },
      },
    },
    {
      id: "search-svc",
      label: "Search service",
      sub: "geo bbox + facets + ranking",
      kind: "service",
      col: 1,
      row: 0,
      detail: {
        what: "Turns a viewport, a date range, a guest count and a filter set into one index query, then ranks the hits before returning them.",
        why: "This is the whole read side of the marketplace and it runs four orders of magnitude above the booking rate, so it scales on stateless instances against a derived index. It never consults the calendar, because asking 10M listings whether three specific nights are free is not a query you can serve at 12k QPS.",
        numbers: [
          { value: "~1,160 QPS average, ~12k peak", explain: "The read load this stateless tier is provisioned for, dominated by peak-hour browsing." },
          { value: "~47 results for a typical city query", explain: "The typical result-set size a query returns after ranking, small enough to render on one page." },
          { value: "5 min cache on popular (city, date range)", explain: "How long a hot query's results are cached, trading a little freshness for a lot less index load." },
        ],
        breaks: {
          failure: "It answers 'plausibly available', never 'available'. Every stale hit it returns is one AVAILABILITY_LOST at the commit.",
          handled: "That rate rising above roughly 2% means index drift or a channel-sync problem, so it is monitored as a health signal rather than accepted as background noise.",
        },
        choice: {
          pick: "Rank from the index, cache popular (city, date range) pairs for 5 minutes",
          instead: "Join against the calendar rows at query time so results are exact.",
          decider:
            "The fan-out. An exact answer means reading per-night calendar rows for every matching listing in a city, at ~12k QPS against a calendar built for a single writer per shard. The stale answer costs one AVAILABILITY_LOST per bad hit, and at 0.1 bookings per listing per day that is a rounding error.",
          flips: "A catalogue small enough that availability fits in memory, say a few thousand properties, where the join is cheap and a post-checkout 'gone' is the more expensive failure.",
        },
      },
    },
    {
      id: "listing-svc",
      label: "Listing service",
      kind: "service",
      sub: "detail page, calendar, price rules",
      col: 1,
      row: 1,
      detail: {
        what: "Serves the listing page: ~10 KB of metadata, photos from the CDN, and the real per-night calendar for the months the guest is looking at.",
        why: "This is the handover from approximate to specific. Search returned 47 matches from a summary. The detail page shows one listing's actual nights and its actual price, the last chance to correct a stale search hit before checkout.",
        numbers: [
          { value: "10M x 10 KB = ~100 GB metadata", explain: "Two orders of magnitude below the 60TB of photos; metadata fits a fast KV store, media is what actually needs the CDN." },
          { value: "~30 photos, ~6 MB/listing, ~60 TB total", explain: "Media dominates storage by two orders of magnitude over metadata, which is why it lives on the CDN rather than beside the listing row." },
          { value: "CDN hit rate ~95%", explain: "How rarely a photo request reaches origin storage at all, the number that keeps media cost and latency low." },
        ],
        breaks: {
          failure: "Its calendar read is a replica read and is allowed to be stale, so the page can still show a night that has just gone.",
          handled: "Making this read authoritative would put listing-page traffic on the home-region primary the booking path depends on, so the commit alone is what corrects a stale display.",
        },
        choice: {
          pick: "Replica read for the displayed calendar, media from the CDN",
          instead: "Read the calendar from the home-region primary so the page is exact.",
          decider:
            "Traffic ratio and blast radius. Listing views run roughly an order of magnitude above bookings, and the primary exists to serve ~120 commits/s with a 2ms transaction. A stale display costs one rejected commit; a browsing load on the primary costs the commit path itself.",
          flips: "A single hot listing during an event window, where the display is worth making exact with synchronous invalidation for that small flagged set.",
        },
      },
    },
    {
      id: "booking-orch",
      label: "Booking orchestrator",
      sub: "hold, authorise, confirm",
      kind: "service",
      col: 2,
      row: 2,
      detail: {
        what: "The saga that turns an approximate search result into an exact commit: idempotency record, a 2ms transactional hold on the nights, card authorisation outside that hold, then confirm.",
        why: "It is the boundary where the system stops being allowed to be wrong. The lock discipline is the same class of problem as a fungible-inventory hotel reservation. What is interesting is that this is the only component that ever tells a guest the index was lying. The hold is cheap. The card authorisation call is the term that actually spends the latency budget. It runs after the hold succeeds, rather than holding the row open while a third party responds.",
        numbers: [
          { value: "~12 commits/s average, ~120 peak", explain: "The commit rate this orchestrator handles, the traffic level the whole design is sized to protect." },
          { value: "~2ms hold transaction", explain: "The only strictly ordered, latency-critical piece of the saga; everything else can run outside it." },
          { value: "card authorisation ~1-2s p99, the largest term in the commit", explain: "The dominant cost of the whole saga, a third-party call the orchestrator does not control and cannot speed up." },
        ],
        breaks: {
          failure: "It owns AVAILABILITY_LOST. The re-check rejects a stale search hit correctly, but only after the guest has chosen dates, entered a card and read a cancellation policy.",
          handled: "That rejection is unavoidable given a deliberately stale index, so the design accepts one wasted retry rather than the alternative of a double booking that cannot be repaired.",
        },
        choice: {
          pick: "Re-validate at commit and reject with AVAILABILITY_LOST",
          instead: "Trust the search result and reconcile the conflict afterwards.",
          decider:
            "There is nothing to reconcile with. A listing-night is unique, so the loser cannot be handed an equivalent unit, and a refund does not repair a guest outside a locked door. Rejecting costs one retry out of 1M bookings a day; accepting twice costs a night nobody can fix.",
          flips: "Fungible inventory, where a count and a compensation policy are legitimate, exactly the hotel model with its 5 to 10 percent deliberate oversell.",
        },
      },
    },
    {
      id: "messaging",
      label: "Messaging + notify",
      sub: "guest to host threads, async",
      kind: "service",
      col: 3,
      row: 3,
      detail: {
        what: "Threaded conversation between guest and host, plus the transactional fan-out: confirmations, request-to-book approvals, and the host alert raised when channel sync finds a conflict.",
        why: "A two-sided marketplace needs a channel to the counterparty because half the decisions are not automatable. Request-to-book is a host saying yes within 24 hours, and a channel conflict resolves in favour of the existing guest but still needs a human host told about it.",
        numbers: [
          { value: "24h request-to-book approval window", explain: "How long a host has to answer before an instant-book alternative would apply instead." },
          { value: "fan-out fires after the p99 2s commit, never inside it", explain: "The point at which notifications are triggered, always after the booking is already durable." },
        ],
        breaks: {
          failure: "Nothing here is on the commit path, so a stalled queue is invisible to the booking success rate.",
          handled: "A host can silently never learn their calendar conflicted or their approval is pending. Queue lag here is monitored on its own dashboard, not inferred from booking metrics.",
        },
        choice: {
          pick: "Asynchronous fan-out after the booking commits",
          instead: "Send confirmations synchronously inside the booking saga.",
          decider:
            "The commit budget is p99 under 2s, already dominated by a card authorisation near that limit. Email, push and host delivery are third-party calls with no comparable SLA, so putting them inline makes booking availability the product of every notification provider's uptime.",
          flips: "Request-to-book, where the host's answer genuinely gates the outcome. Even then the hold is committed first with a 24 hour expiry, so the wait happens against durable state.",
        },
      },
    },
    {
      id: "reviews",
      label: "Review service",
      sub: "dual-blind, 14 day deadline",
      kind: "service",
      col: 3,
      row: 2,
      detail: {
        what: "Two-way reviews tied to a completed booking, held unpublished until both sides submit or the 14 day deadline passes, then released together.",
        why: "The host is being rated too, which no hotel system models. Reviews are the only durable quality signal the platform has about supply it does not own, and they feed ranking. Their integrity is therefore a search problem, not a product nicety.",
        numbers: [
          { value: "14 day submission deadline", explain: "The window either party has to submit before the review closes without them." },
          { value: "released on 2nd submission or at 14 days", explain: "The trigger for publication, whichever comes first." },
          { value: "1 review pair per booking_id", explain: "Reviews are anchored to a specific stay, not to an account, so only someone who actually stayed can rate." },
        ],
        breaks: {
          failure: "Dual-blind stops naive retaliation and nothing else. Post-release flooding of a guest's profile and coordinated rings still work.",
          handled: "Every counter to those is detection after the fact, run against the released text and pattern of submissions rather than prevented up front.",
        },
        choice: {
          pick: "Dual-blind release, both texts held until the second submits or 14 days",
          instead: "Publish each review the moment it is written.",
          decider:
            "Whether a review can be a reply. Immediate publication makes the second review a response to the first, so a critical guest expects retaliation and self-censors. Holding both for up to 14 days costs freshness on a signal already averaged over a host's history.",
          flips: "One-sided review systems where only the buyer rates, and there is no counterparty with an incentive to retaliate.",
        },
      },
    },
    {
      id: "search-index",
      label: "Search index",
      sub: "Elasticsearch, avail. summary",
      kind: "database",
      col: 2,
      row: 0,
      detail: {
        what: "10M denormalised listing documents carrying geo, filters, price, ranking features and a precomputed availability summary.",
        why: "It exists so a date-and-place question never touches the calendar. Denormalising the availability summary into the document turns 'are these three nights free' into one more filter clause. That is the only way the query runs at 12k QPS.",
        numbers: [
          { value: "10M docs x ~5 KB = ~50 GB raw", explain: "The base size of the index before replication, small enough to serve entirely from memory." },
          { value: "x3 replicas = ~150 GB", explain: "The replicated footprint that gives the read tier its availability." },
          { value: "refreshed within 60s", explain: "The freshness bound the whole discovery side is allowed to lag the true calendar by." },
        ],
        breaks: {
          failure: "It is stale by construction and can be staler than advertised if the CDC consumer lags.",
          handled: "The failure is silent: search keeps answering happily while it recommends nights sold minutes ago. Consumer lag is watched directly as a health signal rather than inferred from search quality.",
        },
        choice: {
          pick: "Elasticsearch with a per-listing availability bitmap in the document",
          instead: "Query the transactional calendar, or keep availability out of the index entirely and filter after retrieval.",
          decider:
            "Filtering after retrieval means fetching far more listings than you show. A city query returns ~47 results but would have to pull every listing matching geo and price first, then check each one's calendar. The bitmap makes flexible-date search a bit operation inside one query.",
          flips: "When staleness is unacceptable to the business, for example inventory published to a regulator, where being approximately right is not a category the system is allowed to have.",
        },
      },
    },
    {
      id: "cdc",
      label: "CDC pipeline",
      sub: "Debezium to Kafka to indexer",
      kind: "queue",
      col: 3,
      row: 1,
      detail: {
        what: "Committed calendar changes streamed off the write-ahead log into Kafka and applied to the search documents.",
        why: "It is the only arrow between the reservation side and the discovery side, and it points away from the truth. Nothing on the search side is ever consulted to decide whether a night is free, so this stream can lag without threatening correctness.",
        numbers: [
          { value: "~120 events/s average, ~1,200 peak", explain: "The steady flow of calendar mutations this pipeline carries from the transactional side to the index." },
          { value: "~10 calendar mutations per booking", explain: "One booking touches every night in its date range, so a multi-night stay fans out into several row changes." },
          { value: "60s target, page at 5 min", explain: "The freshness SLO for the index, and the lag threshold past which the pipeline is treated as degraded." },
        ],
        breaks: {
          failure: "A stalled connector task produces no errors on either side. Search stays fast and the calendar stays correct while the gap between them widens.",
          handled: "The alert has to be on consumer lag rather than on anything user-visible, since neither side of the pipeline shows a symptom on its own.",
        },
        choice: {
          pick: "CDC off the WAL, 60 second freshness target",
          instead: "Dual writes from the booking path, or a 5 second refresh target.",
          decider:
            "Dual writes fail independently and drift with no repair path. At 0.1 bookings per listing per day, a 60 second window costs a negligible availability-lost rate. Tightening it uniformly to 5s multiplies re-index cost for no measurable gain.",
          flips: "Listings flagged hot for an event weekend, where the document is invalidated synchronously on commit rather than waiting for the cycle.",
        },
      },
    },
    {
      id: "calendar",
      label: "Calendar rows",
      sub: "(listing_id, date) PK, sharded",
      kind: "database",
      col: 2,
      row: 1,
      detail: {
        what: "One row per listing per night: status in available, held, booked or blocked, plus hold_id, hold_expires_at and price_override.",
        why: "It is the supply record, not just an inventory counter, and it has three separate writers: the booking hold, the host's own edits, and channel-sync ingestion. Making a night a row rather than a count removes every oversell trick. Carrying price_override on the same row makes per-host pricing a property of a night rather than a rate card.",
        numbers: [
          { value: "~70 B/row, 10M x 365 = ~250 GB", explain: "250GB / 64 shards ≈ 4GB each, matching the sibling figure — the shard count was chosen for per-shard size, not just write load." },
          { value: "64 shards, ~4 GB each", explain: "How the calendar is partitioned by listing_id, keeping each shard's write load and size manageable." },
          { value: "rows pre-materialised 500 days ahead", explain: "How far in advance a night already exists as a row, so a booking never has to insert one under lock." },
        ],
        breaks: {
          failure: "One home-region primary per shard, so a shard failover is about 10 minutes of RTO and bookings for it fail closed.",
          handled: "Rows must already exist for that reason. An insert inside the hold path would reintroduce a race that row locking does not cover, so pre-materialisation keeps the hold a pure update.",
        },
        choice: {
          pick: "A row per (listing_id, date), sharded by listing_id with one home region per shard",
          instead: "A count per (unit_group, date), the hotel model, or a globally quorum-replicated calendar.",
          decider:
            "A night cannot be split, so the per-region allocation slice that makes fungible inventory active-active has no analogue here. A home-primary commit is 5 to 10ms against 60 to 100ms at cross-region quorum, and at ~120 commits/s neither is a throughput limit.",
          flips: "A host with six genuinely identical studios, where a count per unit group is strictly easier, and 100x our booking rate, where consensus replication earns its latency.",
        },
      },
    },
    {
      id: "host-app",
      label: "Host tools",
      sub: "block nights, rules, replies",
      kind: "service",
      col: 1,
      row: 2,
      parent: "supply-zone",
      detail: {
        what: "Where a host edits their own calendar: blocking date ranges, setting minimum stays and instant-book on or off, changing pricing rules and answering guests.",
        why: "Supply is user-generated and irregular. A host blocks a fortnight because their family is visiting, and that is not a booking, which is why blocked is a distinct status rather than a fake reservation. Every host edit is also a calendar mutation that has to reach the index.",
        numbers: [
          { value: "1 edit can span the full 500-day materialised window", explain: "A single host action can touch every pre-materialised row for a listing at once." },
          { value: "1 boolean flag per listing: instant book vs request-to-book", explain: "The single toggle that decides whether a booking commits immediately or waits on host approval." },
        ],
        breaks: {
          failure: "A host cannot block a night that already carries a confirmed booking, and no amount of tooling makes a confirmed booking binding on the host.",
          handled: "They can simply cancel, and from the guest's side that is indistinguishable from a double booking, which is a policy problem the platform handles outside this service.",
        },
        choice: {
          pick: "Host edits write the same calendar rows the booking path uses, with blocked as a first-class status",
          instead: "A separate host-availability table that the booking path consults alongside inventory.",
          decider:
            "Two stores that both describe whether a night is sellable have to agree, and the classic failure is that they briefly do not. One row with four statuses makes it one atomic decision in the store that already owns the truth, at the same ~250 GB either way.",
          flips: "Availability rules complex enough that they cannot be materialised per night, for instance rolling minimum-stay logic that depends on the requested range.",
        },
      },
    },
    {
      id: "channel-sync",
      label: "Channel sync",
      sub: "polls rival sites, block-only",
      kind: "service",
      col: 1,
      row: 3,
      parent: "supply-zone",
      detail: {
        what: "Polls rival booking sites and the channel managers hosts use to sit on several of them at once, and writes the nights they report as blocked.",
        why: "Roughly a fifth of listings are also on a rival site, so a host can sell a night we still show as free. This path exists to shrink that window, not to close it, and it is asymmetric on purpose: it may block a night, never release one that carries our confirmed booking.",
        numbers: [
          { value: "~2M listings polled, ~2,000 integrations", explain: "The scale of the polling fleet, one integration per partner site or channel manager." },
          { value: "uniform 15 min poll = ~2,200 req/s", explain: "What a naive fixed-interval poll of the whole catalogue would cost, which is why the real interval adapts per listing." },
          { value: "partners rate-limit to roughly 10-50 req/s", explain: "The ceiling most partner APIs impose, well below what a uniform 15-minute poll would need." },
        ],
        breaks: {
          failure: "A night sold on a rival site is invisible to us for 5 to 60 minutes depending on the adaptive interval.",
          handled: "A partner returning a stale or empty calendar could release nights we have sold. The guard is the ratio of released to blocked nights per poll, with a quarantine once that ratio crosses a threshold.",
        },
        choice: {
          pick: "Adaptive polling, block-only ingestion, per-account backoff on 429",
          instead: "Call the partner synchronously at commit time and treat their answer as authoritative.",
          decider:
            "Composite availability. Partner integrations run on a 15 to 60 minute iCal cycle, or a REST call at 500ms to 5s p99 with no SLA. That is against a commit that must be p99 under 2s and 99.99% available. With ~2,000 integrations at even 99.5% each, the product is not a number you would publish.",
          flips: "Being a distribution channel over inventory you do not own, with tens of suppliers under contractual SLAs, where a synchronous check against one well-run API is feasible.",
        },
      },
    },
  ],
  edges: [
    {
      id: "e1",
      from: "guest",
      to: "search-svc",
      tier: "hot",
      step: 1,
      label: "map bbox, dates, filters",
      detail: {
        what: "A search request: a viewport or city, check-in and check-out, guest count, and a filter set such as price ceiling and amenities.",
        why: "This is the dominant traffic in the whole system by two orders of magnitude. That is why it is served by a stateless tier over a derived index rather than by anything that knows what a booking is.",
        numbers: [{ value: "~1,160 QPS average, ~12k peak", explain: "The load this edge carries into the read side, peaking far above its daily average." }],
        breaks: {
          failure: "A flexible-date query multiplies the work, because the dates stop being one range and become many.",
          handled: "That fan-out is exactly what the per-listing availability bitmap exists to absorb cheaply as a bit operation rather than many separate lookups.",
        },
      },
    },
    {
      id: "e2",
      from: "search-svc",
      to: "search-index",
      tier: "hot",
      step: 2,
      label: "geo + facets + availability",
      detail: {
        what: "One Elasticsearch query combining a geo bounding box, the facet filters and the precomputed availability summary for the requested nights.",
        why: "Every clause has to be answerable from the document, because the alternative is fanning out to calendar rows for every matching listing in a city at 12k QPS.",
        numbers: [
          { value: "~47 results for a typical city query", explain: "The typical result count returned to the guest after this single query." },
          { value: "5 min cache on popular (city, date range)", explain: "How long a hot query's results are reused before the index is queried again." },
        ],
        breaks: {
          failure: "The availability clause is the stale one.",
          handled: "Geo and price are as fresh as the last index write, but the nights may have been sold up to 60 seconds ago, a gap only the commit can catch.",
        },
      },
    },
    {
      id: "e3",
      from: "guest",
      to: "listing-svc",
      tier: "hot",
      step: 3,
      label: "open listing + calendar",
      detail: {
        what: "The guest picks one of the results and loads the listing page: metadata, photos from the CDN, and the calendar for the months around their dates.",
        why: "It is the step where an approximate result becomes a specific listing on specific nights. The guest sees the real per-night price rather than the summarised one used for ranking.",
        numbers: [
          { value: "~10 KB metadata", explain: "600x smaller than the ~6MB of thumbnails alongside it; this is the only part of the page that has to come from the origin service itself." },
          { value: "~6 MB of thumbnails per listing", explain: "The media payload per listing, served almost entirely from the CDN rather than origin." },
          { value: "CDN hit rate ~95%", explain: "How rarely this view has to fetch media from origin storage." },
        ],
        breaks: {
          failure: "This read comes off a replica, so the page can still show a night that has just gone.",
          handled: "The correction happens at the commit, not here, because routing this display read to the primary would put browsing traffic on the booking path's own database.",
        },
      },
    },
    {
      id: "e4",
      from: "listing-svc",
      to: "calendar",
      tier: "data",
      label: "replica read, display only",
      detail: {
        what: "Reading the per-night rows for the displayed months to draw the calendar widget and price the visible nights.",
        why: "Display needs the actual rows rather than the search summary, but it does not need to be authoritative. It is deliberately routed to a replica and never to the home-region primary.",
        numbers: [{ value: "listing views run ~10x booking volume", explain: "The traffic ratio that rules out pointing this read at the primary the booking path depends on." }],
        breaks: {
          failure: "Replica lag means the widget can show a night as free milliseconds after it was held.",
          handled: "Pointing this read at the primary instead would put browsing traffic on the one component that cannot be made active-active, so the small display error is the accepted trade.",
        },
      },
    },
    {
      id: "e7",
      from: "guest",
      to: "booking-orch",
      tier: "hot",
      step: 4,
      label: "POST /booking + key",
      detail: {
        what: "The booking request, carrying the listing, the dates, the payment method and a client-generated idempotency key.",
        why: "This is the moment the system switches from approximate to exact. Everything before it was allowed to be a suggestion. From here the answer is either a booking or an explicit rejection.",
        numbers: [
          { value: "~12 commits/s average, ~120 peak", explain: "~1,000x below the ~12k QPS search read rate; that gap is why search can stay approximate while this path must be exact." },
          { value: "p99 under 2s including authorisation", explain: "The end-to-end SLO this request is held to, dominated by the card authorisation call." },
        ],
        breaks: {
          failure: "A client that generates a fresh key per retry defeats the deduplication entirely.",
          handled: "A double-tapped Book button then becomes two sagas and two card authorisations, which is why the client is required to reuse the same key on every retry of one attempt.",
        },
      },
    },
    {
      id: "e8",
      from: "booking-orch",
      to: "calendar",
      tier: "hot",
      step: 5,
      label: "hold 15 min, then confirm",
      detail: {
        what: "The short transaction that takes the nights in the range, verifies each reads available, and flips them to held with an expiry, followed later by the flip to booked.",
        why: "It is the only strictly ordered thing in the system and the only place the index is checked against reality. What is specific here is that the row being locked may have been mutated by a host or a rival channel since the search ran.",
        numbers: [
          { value: "~2ms transaction", explain: "0.1% of the 2s p99 budget; the strictly-serialised part of the saga is nearly free, card authorisation is what the SLO is actually about." },
          { value: "15 min hold expiry", explain: "How long a held night is reserved for this attempt before it is released back to available." },
          { value: "held rows released by a 60s reaper", explain: "The background process that reclaims expired holds so an abandoned checkout does not permanently lock a night." },
        ],
        breaks: {
          failure: "Any row not reading available ends the attempt with AVAILABILITY_LOST.",
          handled: "That is the visible cost of everything upstream being deliberately stale, and it is treated as a normal, monitored outcome rather than an error to eliminate.",
        },
      },
    },
    {
      id: "e9",
      from: "calendar",
      to: "cdc",
      tier: "hot",
      step: 6,
      label: "WAL stream",
      detail: {
        what: "Committed calendar mutations streamed off the write-ahead log: bookings, holds, host blocks and channel-sync writes alike.",
        why: "The indexer must not care which of the three writers made the change, so it reads the log rather than being called by any of them. That is also what stops a dual-write path drifting with no repair.",
        numbers: [
          { value: "~10 calendar mutations per booking", explain: "One booking touches every night in its range, so this edge carries several row changes per commit." },
          { value: "~120 events/s average, ~1,200 peak", explain: "The steady stream volume flowing out of the calendar toward the indexer." },
        ],
        breaks: {
          failure: "Every writer that bypasses the rows, for example a cache someone adds in front of the calendar, is invisible to this stream.",
          handled: "That change silently never reaches search, which is why the calendar rows are treated as the only legitimate write path and nothing is allowed to shortcut them.",
        },
      },
    },
    {
      id: "e10",
      from: "cdc",
      to: "search-index",
      tier: "hot",
      step: 7,
      label: "availability summary, 60s",
      detail: {
        what: "Applying the change to the affected listing document, refreshing its availability summary and any derived price fields.",
        why: "This is the only arrow from the reservation side back to the discovery side, and it points away from the truth. Search is downstream of the calendar and never the other way round.",
        numbers: [
          { value: "60s freshness target", explain: "The bound on how far the index is allowed to lag the true calendar." },
          { value: "page at 5 min lag", explain: "The threshold at which lag stops being normal staleness and becomes an incident." },
        ],
        breaks: {
          failure: "Consumer lag is the failure and it is silent on both sides.",
          handled: "The mitigation is that the commit re-validates regardless, so a stale hit costs exactly one AVAILABILITY_LOST rather than a double booking.",
        },
      },
    },
    {
      id: "e11",
      from: "host-app",
      to: "calendar",
      tier: "data",
      label: "block nights, min stay",
      detail: {
        what: "A host writing their own availability: blocking a range, changing a minimum stay, toggling instant book.",
        why: "Supply is user-generated, so the availability calendar is irregular in a way a hotel's is not. A blocked fortnight is a host's personal decision, not a sale, and it has to be distinguishable from a booking in the same row.",
        numbers: [{ value: "one edit touches a whole date range", explain: "A single host action can mutate many rows at once, unlike the booking path's tight per-attempt hold." }],
        breaks: {
          failure: "A host trying to block a night that already carries a confirmed booking has to be refused.",
          handled: "That refusal is a product conversation rather than an error code, since a host cannot unilaterally undo a guest's confirmed reservation through this path.",
        },
      },
    },
    {
      id: "e12",
      to: "listing-svc",
      from: "host-app",
      tier: "control",
      label: "host rules, Smart Pricing",
      detail: {
        what: "Host-set pricing rules: base nightly rate, weekend and seasonal multipliers, length-of-stay discounts, or an opt-in to platform-suggested pricing.",
        why: "Ten million independent owners set their own prices, so pricing is configuration supplied by users rather than a rate card we control. The service exists to turn that configuration into one number per night.",
        numbers: [{ value: "1 price_override resolved per (listing, night)", explain: "The final output of this edge: a single number written onto each calendar row." }],
        breaks: {
          failure: "A rule change repriced across 500 days of pre-materialised rows is a large write for a small edit.",
          handled: "It has to be applied incrementally rather than as one sweep per host, so a pricing change does not spike write load across the whole calendar shard.",
        },
      },
    },
    {
      id: "e14",
      from: "channel-sync",
      to: "calendar",
      tier: "control",
      label: "block only, never release",
      detail: {
        what: "Writing partner-reported nights as blocked, and explicitly refusing to release any night carrying one of our confirmed bookings.",
        why: "The asymmetry is the entire safety property of this path. Trusting a partner to say a night is free means a stale feed can resell a night already sold. Trusting them to say it is taken costs at most some lost inventory.",
        breaks: {
          failure: "The conflict still happened, so someone has to be told.",
          handled: "The resolution raises a host-facing alert, and a host's channel-conflict rate becomes a ranking signal rather than something only the support desk ever sees.",
        },
      },
    },
    {
      id: "e15",
      from: "booking-orch",
      to: "messaging",
      tier: "data",
      label: "thread + notify on confirm",
      detail: {
        what: "Opening the guest-host thread and emitting the confirmation fan-out once the booking commits, or the approval request if the listing is request-to-book.",
        why: "It is deliberately outside the commit so that email, push and host delivery latency never enter a path budgeted at p99 under 2s. A failing provider degrades notifications rather than bookings.",
        numbers: [{ value: "24h approval window for request-to-book", explain: "How long a host has to answer before the outstanding hold expires." }],
        breaks: {
          failure: "A stalled queue is invisible in booking metrics.",
          handled: "A host can be sitting on an approval request they were never told about while every booking dashboard reads green, which is why this queue has its own lag alert.",
        },
      },
    },
    {
      id: "e16",
      from: "booking-orch",
      to: "reviews",
      tier: "control",
      label: "review invite after stay",
      detail: {
        what: "The completed booking opening a review window for both parties once the stay ends.",
        why: "Reviews are anchored to a booking rather than to an account, which is what makes verified-stay weighting possible. Only someone who actually stayed can rate, and only the host who actually hosted can rate back.",
        numbers: [{ value: "14 day deadline from checkout", explain: "The window during which either party can still submit before the review closes." }],
        breaks: {
          failure: "Cancelled and no-show bookings must not open a window.",
          handled: "Guarding on completed stays only is what stops the review system becoming reachable without ever having actually paid for a stay.",
        },
      },
    },
    {
      id: "e17",
      from: "reviews",
      to: "search-index",
      tier: "control",
      label: "rating into ranking",
      detail: {
        what: "Released review scores, weighted by reviewer reputation and verified-stay status, written into the listing document as ranking features.",
        why: "It closes the marketplace loop. The only durable quality signal about supply we do not own is what previous guests said, so reviews are ultimately a search input, not a page decoration.",
        numbers: [{ value: "ranking features sit in the ~5 KB document", explain: "Where these scores end up, alongside geo and availability, in the same per-listing document search reads." }],
        breaks: {
          failure: "Coordinated review rings move ranking directly.",
          handled: "The weighting and anomaly detection here are load-bearing for search quality, not just for fairness on a profile page, so they are tuned against ranking drift, not only against complaints.",
        },
      },
    },
    {
      id: "e18",
      from: "messaging",
      to: "host-app",
      tier: "control",
      label: "host reply, 24h approval",
      detail: {
        what: "Delivering guest enquiries, request-to-book approvals and channel-conflict alerts to the host, and carrying their answer back.",
        why: "Half the decisions in a two-sided marketplace are made by a human who is not logged in when you need them. The design holds a durable state while it waits, rather than blocking anything.",
        numbers: [{ value: "hold committed with a 24h expiry while waiting", explain: "The mechanism that lets a host's answer be awaited without an open transaction anywhere in the system." }],
        breaks: {
          failure: "The outstanding hold blocks instant-book attempts on those nights for the full window.",
          handled: "That is correct behaviour, since the nights are genuinely spoken for pending an answer, but it is also the main complaint hosts have about the request-to-book mode.",
        },
      },
    },
  ],
  figures: {
    "lock-order": {
      title: "Ascending lock order turns overlap into a queue, not a cycle",
      nodes: [
        { id: "reqa", label: "Guest A: Jun 14–16", kind: "client", col: 0, row: 0 },
        { id: "reqb", label: "Guest B: Jun 15–17", kind: "client", col: 1, row: 0 },
        {
          id: "shared",
          label: "Jun 15–16 rows",
          sub: "locked ascending by both",
          kind: "database",
          col: 0,
          row: 1,
          detail: {
            what: "The two nights both ranges need, the only rows either transaction can collide on.",
            why: "Every transaction acquires its rows in the same ascending order, so whichever reaches these rows second simply waits instead of forming a cycle with the first.",
          },
        },
        { id: "queue", label: "B waits for A", sub: "clean queue, not a deadlock", kind: "service", col: 1, row: 1 },
      ],
      edges: [
        { id: "e1", from: "reqa", to: "shared", tier: "hot", step: 1, label: "locks ascending, wins" },
        { id: "e2", from: "reqb", to: "shared", tier: "hot", step: 2, label: "locks ascending, waits" },
        { id: "e3", from: "shared", to: "queue", tier: "data", label: "no cycle possible" },
      ],
    },
  },
};
