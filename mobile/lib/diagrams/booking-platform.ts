import type { Diagram } from "./types";

export const BOOKING_PLATFORM: Diagram = {
  id: "booking-platform",
  title: "Booking Platform",
  question: "Design Airbnb (Booking Platform)",
  sourceId: "patterns",
  itemId: 30,
  overview: {
    shape:
      "A discovery side that ranks 10M host-owned listings out of a deliberately stale index, and a supply side where three different writers, the guest's booking, the host's own edits and a rival channel's poll, all mutate the same per-night calendar row.",
    beats: [
      "The traffic is discovery, not booking. 100M searches a day against 1M bookings is a 100:1 look-to-book ratio, so ~12k QPS at peak sits against ~120 commits/s. The two paths share nothing but the listing id, which is what lets search run on an index that is allowed to be 60 seconds wrong.",
      "A search is a geo bounding box plus facets plus dates, answered in one query: city or viewport, guests >= 2, price under EUR 200 a night, and those specific nights free. The last clause is the awkward one, because it is a per-listing calendar question, so the document carries a precomputed availability summary rather than the calendar itself.",
      "Ranking is where the marketplace shows through. The document also carries ranking features, and the signals are host-behaviour signals: review scores weighted by reviewer reputation and verified stay, a host's channel-conflict rate, and last-minute releases suppressed because a night that goes free at short notice is genuinely lower quality inventory.",
      "Price is per host and per night, not a rate card. A pricing service resolves host rules into a price_override on each calendar row, the listing page quotes the exact nights, and the number is snapshotted onto the booking so a host rule change between quote and commit cannot move what the guest agreed to pay.",
      "The calendar is the supply record and it has three writers. The guest's booking takes the nights under a short transactional hold, which is the same class of problem as the hotel question (#19) and is not what makes this one hard. The host edits ranges directly to block nights and set minimum stays. Channel-sync ingestion writes what a rival site already sold, and may only ever block, never release.",
      "CDC closes the loop back to discovery: Debezium to Kafka to an indexer, ~120 calendar mutations a second average and ~1,200 at peak, refreshing the availability summary within 60 seconds. That lag is the entire availability-lost budget, and at 0.1 bookings per listing per day it costs almost nothing.",
    ],
    crux:
      "The inventory is not ours. Search has to filter and rank over 10M calendars owned by third parties who change them out of band, so an exact index would mean reading calendar rows for millions of listings per query and a fresher one buys nothing measurable. Discovery is therefore a suggestion, the commit is the only truth, and for 5 to 60 minutes at a time even the commit is wrong because a host sold the night somewhere else.",
    numbers: [
      "100M searches/day vs 1M bookings/day",
      "~12k search QPS peak vs ~120 commits/s",
      "60s CDC freshness, ~120 calendar events/s",
      "0.1 bookings per listing per day",
    ],
  },
  nodes: [
    {
      id: "supply-zone",
      label: "Supply we do not own",
      kind: "zone",
      detail: {
        what: "The three boxes that write availability on somebody else's behalf: the host's own tools, the channel-sync ingester and the rival channels it polls.",
        why: "Every other part of this diagram is a system we control end to end. Here the authority is a human or a partner API, and the design question is not how to lock a row but what to believe and how late we are allowed to find out.",
        numbers: ["~2M listings also sold elsewhere", "5 to 60 min exposure window"],
        breaks:
          "A host sells a night on a rival site and we confirm a booking for it before the next poll. Nothing in the commit path can see that, and to the guest it looks exactly like our bug.",
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
        why: "It is drawn because it generates almost all the load and none of the value. A hundred searches happen for every booking, and the client is also the thing that retries a POST after a dropped connection, so the key it sends is what makes the commit safe to repeat.",
        numbers: ["100M searches/day", "100:1 look-to-book", "1M bookings/day"],
        breaks:
          "A guest who picks a result the index still believes is free gets AVAILABILITY_LOST after committing to a checkout flow, which is friction the client has to absorb gracefully rather than a correctness failure.",
      },
    },
    {
      id: "search-svc",
      label: "Search service",
      sub: "geo bbox + facets + ranking",
      kind: "service",
      col: 0,
      row: 1,
      detail: {
        what: "Turns a viewport, a date range, a guest count and a filter set into one index query, then ranks the hits before returning them.",
        why: "This is the whole read side of the marketplace and it is four orders of magnitude above the booking rate, so it has to scale on stateless instances against a derived index. It never consults the calendar, because asking 10M listings whether three specific nights are free is not a query you can serve at 12k QPS.",
        numbers: ["~1,160 QPS average, ~12k peak", "~47 results for a typical city query", "5 min cache on popular (city, date range)"],
        breaks:
          "It answers 'plausibly available', never 'available'. Every stale hit it returns is one AVAILABILITY_LOST at the commit, and that rate above about 2% means index drift or a channel-sync problem.",
        choice: {
          pick: "Rank from the index, cache popular (city, date range) pairs for 5 minutes",
          instead: "Join against the calendar rows at query time so results are exact.",
          decider:
            "The fan-out. An exact answer means reading per-night calendar rows for every candidate listing in a city, at ~12k QPS against a 250 GB calendar whose whole point is a single writer per shard. The stale answer costs one AVAILABILITY_LOST per bad hit, and at 0.1 bookings per listing per day that is a rounding error.",
          flips:
            "A catalogue small enough that availability fits in memory, say a few thousand properties, where the join is cheap and telling a guest 'gone' after checkout is the more expensive failure.",
        },
      },
    },
    {
      id: "listing-svc",
      label: "Listing service",
      sub: "detail page + exact calendar",
      kind: "service",
      col: 0,
      row: 2,
      detail: {
        what: "Serves the listing page: ~10 KB of metadata, photos from the CDN, and the real per-night calendar for the months the guest is looking at.",
        why: "This is the handover from approximate to specific. Search returned 47 candidates from a summary; the detail page shows one listing's actual nights and its actual price, which is the last chance to correct a stale search hit before the guest commits to a checkout.",
        numbers: ["10M x 10 KB = ~100 GB metadata", "~30 photos, ~6 MB/listing, ~60 TB total", "CDN hit rate ~95%"],
        breaks:
          "Its calendar read is a replica read and is allowed to be stale, so the page can still show a night that has just gone. Making this read authoritative would put listing-page traffic on the home-region primary that the booking path depends on.",
        choice: {
          pick: "Replica read for the displayed calendar, media from the CDN",
          instead: "Read the calendar from the home-region primary so the page is exact.",
          decider:
            "Traffic ratio and blast radius. Listing views run roughly an order of magnitude above bookings, and the primary exists to serve ~120 commits/s with a 2ms transaction. A stale display costs one rejected commit; a browsing load on the primary costs the commit path itself.",
          flips:
            "A single hot listing during an event window, where the question already argues for synchronous invalidation rather than waiting on the 60s cycle, so the display is worth making exact for that small flagged set.",
        },
      },
    },
    {
      id: "booking-orch",
      label: "Booking orchestrator",
      sub: "hold, authorise, confirm",
      kind: "service",
      col: 0,
      row: 3,
      detail: {
        what: "The saga that turns an approximate search result into an exact commit: idempotency record, a 2ms transactional hold on the nights, card authorisation outside it, then confirm.",
        why: "It is the boundary where the system stops being allowed to be wrong. The lock discipline itself is the same class of problem as the hotel reservation question (#19), so the interesting part here is not the transaction but that this is the only component that ever tells a guest the index was lying.",
        numbers: ["~12 commits/s average, ~120 peak", "~2ms hold transaction", "15 min hold expiry"],
        breaks:
          "It owns AVAILABILITY_LOST. The re-check rejects a stale search hit correctly, but the guest has already chosen dates, entered a card and read a cancellation policy before finding out.",
        choice: {
          pick: "Re-validate at commit and reject with AVAILABILITY_LOST",
          instead: "Trust the search result and reconcile the conflict afterwards.",
          decider:
            "There is nothing to reconcile with. A listing-night is unique, so the loser cannot be handed an equivalent unit and a refund does not repair a guest outside a locked door. Rejecting costs one retry out of the 1M bookings a day; accepting twice costs a night nobody can fix.",
          flips:
            "Fungible inventory, where a count and a compensation policy are legitimate, which is exactly the hotel model and its 5 to 10 percent deliberate oversell.",
        },
      },
    },
    {
      id: "messaging",
      label: "Messaging + notify",
      sub: "guest to host threads, async",
      kind: "service",
      col: 0,
      row: 4,
      detail: {
        what: "Threaded conversation between guest and host, plus the transactional fan-out: confirmations, request-to-book approvals, and the host alert raised when channel sync finds a conflict.",
        why: "A two-sided marketplace needs a channel to the counterparty because half the decisions are not automatable. Request-to-book is a host saying yes within 24 hours, and a channel conflict resolves in favour of the existing guest but still needs a human host told about it.",
        numbers: ["24h request-to-book approval window", "notification fan-out is outside the commit"],
        breaks:
          "Nothing here is on the commit path, so a stalled queue is invisible to the booking success rate while a host silently never learns their calendar conflicted or their approval is pending.",
        choice: {
          pick: "Asynchronous fan-out after the booking commits",
          instead: "Send confirmations synchronously inside the booking saga.",
          decider:
            "The commit budget is p99 under 2s including a card authorisation that is already ~2s at p99. Email, push and host delivery are third-party calls with no comparable SLA, so putting them inline makes booking availability the product of every notification provider's.",
          flips:
            "Request-to-book, where the host's answer genuinely gates the outcome. Even then the hold is committed first with a 24 hour expiry, so the wait happens against a durable state rather than an open transaction.",
        },
      },
    },
    {
      id: "reviews",
      label: "Review service",
      sub: "dual-blind, 14 day deadline",
      kind: "service",
      col: 0,
      row: 5,
      detail: {
        what: "Two-way reviews tied to a completed booking, held unpublished until both sides submit or the 14 day deadline passes, then released together.",
        why: "The host is being rated too, which no hotel system models. Reviews are the only durable quality signal the platform has about supply it does not own, and they feed ranking, so their integrity is a search problem rather than a product nicety.",
        numbers: ["14 day submission deadline", "released on second submit or deadline", "reviews keyed to booking_id"],
        breaks:
          "Dual-blind stops naive retaliation and nothing else. Post-release flooding of a guest's profile and coordinated rings still work, and every counter to those is detection after the fact.",
        choice: {
          pick: "Dual-blind release, both texts held until the second submits or 14 days",
          instead: "Publish each review the moment it is written.",
          decider:
            "Whether a review can be a reply. Immediate publication makes the second review a response to the first, so a critical guest expects retaliation and self-censors. Holding both for up to 14 days costs freshness on a signal that is already averaged over a host's history.",
          flips:
            "One-sided review systems where only the buyer rates, and there is no counterparty with an incentive to retaliate.",
        },
      },
    },
    {
      id: "search-index",
      label: "Search index",
      sub: "Elasticsearch, availability summary",
      kind: "database",
      col: 1,
      row: 0,
      detail: {
        what: "10M denormalised listing documents carrying geo, filters, price, ranking features and a precomputed availability summary.",
        why: "It exists so a date-and-place question never touches the calendar. Denormalising the availability summary into the document turns 'are these three nights free' from a per-listing join into one more filter clause, which is the only way the query runs at 12k QPS.",
        numbers: ["10M docs x ~5 KB = ~50 GB raw", "x3 replicas = ~150 GB", "refreshed within 60s"],
        breaks:
          "It is stale by construction and can be staler than advertised if the CDC consumer lags. The failure is silent: search keeps answering happily while it recommends nights that were sold minutes ago.",
        choice: {
          pick: "Elasticsearch with a per-listing availability bitmap in the document",
          instead: "Query the transactional calendar, or keep availability out of the index entirely and filter after retrieval.",
          decider:
            "Filtering after retrieval means fetching far more candidates than you show. A city query returns ~47 results but would have to pull every listing matching geo and price first, then check calendars for each. The bitmap makes flexible-date search a bit operation and keeps the whole thing inside one query.",
          flips:
            "When staleness is unacceptable to the business, for example inventory published to a regulator, where being approximately right is not a category the system is allowed to have.",
        },
      },
    },
    {
      id: "cdc",
      label: "CDC pipeline",
      sub: "Debezium to Kafka to indexer",
      kind: "queue",
      col: 1,
      row: 1,
      detail: {
        what: "Committed calendar changes streamed off the write-ahead log into Kafka and applied to the search documents.",
        why: "It is the only arrow between the reservation side and the discovery side, and it points away from the truth. Nothing on the search side is ever consulted to decide whether a night is free, so this stream is allowed to lag without threatening correctness.",
        numbers: ["~120 events/s average, ~1,200 peak", "~10 calendar mutations per booking", "60s target, page at 5 min"],
        breaks:
          "A stalled connector task produces no errors on either side. Search stays fast and the calendar stays correct while the gap between them widens, so the alert has to be on consumer lag rather than on anything user-visible.",
        choice: {
          pick: "CDC off the WAL, 60 second freshness target",
          instead: "Dual writes from the booking path, or a 5 second refresh target.",
          decider:
            "Dual writes fail independently and drift with no repair path. On the target: at 0.1 bookings per listing per day the cost of a 60 second window is a negligible availability-lost rate, and tightening it uniformly to 5s multiplies re-index cost for no measurable gain.",
          flips:
            "Listings flagged hot for an event weekend, where the document is invalidated synchronously on commit rather than waiting for the cycle, because 200 attempts in 60 seconds all land inside one window.",
        },
      },
    },
    {
      id: "calendar",
      label: "Calendar rows",
      sub: "(listing_id, date) PK, sharded",
      kind: "database",
      col: 1,
      row: 2,
      detail: {
        what: "One row per listing per night: status in available, held, booked or blocked, plus hold_id, hold_expires_at and price_override.",
        why: "It is the supply record, not just an inventory counter, and it has three separate writers: the booking hold, the host's own edits, and channel-sync ingestion. Making a night a row rather than a count is what removes every oversell trick, and carrying price_override on the same row is what makes per-host pricing a property of a night rather than a rate card.",
        numbers: ["~70 B/row, 10M x 365 = ~250 GB", "64 shards, ~4 GB each", "rows pre-materialised 500 days ahead"],
        breaks:
          "One home-region primary per shard, so a shard failover is about 10 minutes of RTO and bookings for it fail closed. Rows must already exist, because an insert inside the hold path reintroduces a race that row locking does not cover.",
        choice: {
          pick: "A row per (listing_id, date), sharded by listing_id with one home region per shard",
          instead: "A count per (unit_group, date), the hotel model, or a globally quorum-replicated calendar.",
          decider:
            "A night cannot be split, so the per-region allocation slice that makes fungible inventory active-active has no analogue here. A home-primary commit is 5 to 10ms against 60 to 100ms at cross-region quorum, and at ~120 commits/s neither is a throughput limit, so the trade is 10ms commits against a 10 minute failover costing ~2,400 attempts.",
          flips:
            "A host with six genuinely identical studios, where a count per unit group is strictly easier, and 100x our booking rate, where the same failover costs 240,000 attempts and consensus replication earns its latency.",
        },
      },
    },
    {
      id: "pricing-svc",
      label: "Pricing service",
      sub: "per-night price_override",
      kind: "service",
      col: 1,
      row: 3,
      detail: {
        what: "Resolves each host's pricing rules, seasonality, weekend and length-of-stay adjustments into a concrete price_override per listing-night, and quotes a stay on request.",
        why: "Price here is set by 10M independent owners rather than by us, so there is no rate card to look up. The quote also has to be frozen: the price the guest agreed is snapshotted onto the booking so a host rule change between the quote and the commit cannot silently move it.",
        numbers: ["price_override is a column on the calendar row", "price snapshot stored on the booking"],
        breaks:
          "It writes to the same rows the booking path locks, so a bulk repricing job across a host's whole calendar competes with commits on those listings and has to be batched and ordered rather than fired as one sweep.",
        choice: {
          pick: "Materialise the resolved price onto the calendar row",
          instead: "Compute the price at read time from the host's rules on every search hit and page view.",
          decider:
            "Read amplification. Price is a filter and a ranking input on ~12k searches/s, so computing it per candidate per query is rule evaluation on the hot path; materialising it makes price one indexed field, at the cost of a rewrite whenever a rule changes.",
          flips:
            "Heavily personalised or auction-style pricing, where the price genuinely depends on the requester and cannot be precomputed per night at all.",
        },
      },
    },
    {
      id: "host-app",
      label: "Host tools",
      sub: "block nights, rules, replies",
      kind: "service",
      col: 1,
      row: 4,
      parent: "supply-zone",
      detail: {
        what: "Where a host edits their own calendar: blocking date ranges, setting minimum stays and instant-book on or off, changing pricing rules and answering guests.",
        why: "Supply is user-generated and irregular. A host blocks a fortnight because their family is visiting, and that is not a booking, which is why blocked is a distinct status rather than a fake reservation. Every host edit is also a calendar mutation that has to reach the index.",
        numbers: ["a host edit touches a whole range", "instant book vs request-to-book is a per-listing flag"],
        breaks:
          "A host cannot block a night that already carries a confirmed booking, and no amount of tooling makes a confirmed booking binding on the host. They can simply cancel, and from the guest's side that is indistinguishable from a double booking.",
        choice: {
          pick: "Host edits write the same calendar rows the booking path uses, with blocked as a first-class status",
          instead: "A separate host-availability table that the booking path consults alongside inventory.",
          decider:
            "Two stores that both describe whether a night is sellable have to agree, and the classic failure is that they briefly do not. One row with four statuses makes it one atomic decision in the store that already owns the truth, and it is the same ~250 GB either way.",
          flips:
            "Availability rules complex enough that they cannot be materialised per night, for instance rolling minimum-stay logic that depends on the requested range, which belongs beside the rows rather than in them.",
        },
      },
    },
    {
      id: "channel-sync",
      label: "Channel sync",
      sub: "adaptive poll, block-only",
      kind: "service",
      col: 1,
      row: 5,
      parent: "supply-zone",
      detail: {
        what: "Polls partner channel managers and iCal feeds for listings sold elsewhere, and writes the nights they report as blocked.",
        why: "Roughly a fifth of listings are also on a rival site, so a host can sell a night we still show as free. This path exists to shrink that window, not to close it, and it is asymmetric on purpose: it may block a night, never release one that carries our confirmed booking.",
        numbers: ["~2M listings polled", "uniform 15 min poll = ~2,200 req/s", "partners rate-limit in the tens/s"],
        breaks:
          "A partner returning a stale or empty calendar would release nights we have sold, so the guard is the ratio of released to blocked nights per poll and a quarantine when the diff exceeds a threshold.",
        choice: {
          pick: "Adaptive polling, block-only ingestion, per-account backoff on 429",
          instead: "Call the partner synchronously at commit time and treat their answer as authoritative.",
          decider:
            "Composite availability. Partner integrations are iCal on a 15 to 60 minute cycle or REST at 500ms to 5s p99 with no SLA at all, against a commit that must be p99 under 2s and 99.99% available. With ~2,000 integrations at even 99.5% each, the product is not a number you would publish.",
          flips:
            "Being a distribution channel over inventory you do not own, with tens of suppliers under contractual SLAs, where a synchronous check against one well-run API is feasible and being wrong is the supplier's liability.",
        },
      },
    },
    {
      id: "partners",
      label: "Rival channels",
      sub: "iCal / REST, no availability SLA",
      kind: "external",
      col: 1,
      row: 6,
      parent: "supply-zone",
      detail: {
        what: "Other booking sites and the channel managers hosts use to sit on several of them at once. The only box here whose behaviour we cannot specify.",
        why: "It is drawn because it is the source of the residual this design consciously refuses to close. The host's real calendar lives partly here, and our database is a claim about someone else's property that can be out of date without anyone doing anything wrong.",
        numbers: ["iCal poll cycles of 15 to 60 min", "REST 500ms to 5s p99", "~2,000 integrations"],
        breaks:
          "A night sold there is invisible to us for 5 to 60 minutes depending on the adaptive interval, and in that window we will happily confirm a booking for a night that no longer exists.",
      },
    },
  ],
  edges: [
    {
      id: "e1",
      from: "guest",
      to: "search-svc",
      label: "map bbox, dates, filters",
      animated: true,
      detail: {
        what: "A search request: a viewport or city, check-in and check-out, guest count, and a filter set such as price ceiling and amenities.",
        why: "This is the dominant traffic in the whole system by two orders of magnitude, which is why it is served by a stateless tier over a derived index rather than by anything that knows what a booking is.",
        numbers: ["~1,160 QPS average, ~12k peak"],
        breaks:
          "A flexible-date query multiplies the work, because the dates stop being one range and become many, which is what the per-listing availability bitmap exists to absorb.",
      },
    },
    {
      id: "e2",
      from: "search-svc",
      to: "search-index",
      label: "geo + facets + availability",
      animated: true,
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "One Elasticsearch query combining a geo bounding box, the facet filters and the precomputed availability summary for the requested nights.",
        why: "Every clause has to be answerable from the document, because the alternative is fanning out to calendar rows for every candidate listing in a city at 12k QPS.",
        numbers: ["~47 results for a typical city query", "5 min cache on popular (city, date range)"],
        breaks:
          "The availability clause is the stale one. Geo and price are as fresh as the last index write; the nights may have been sold up to 60 seconds ago.",
      },
    },
    {
      id: "e3",
      from: "guest",
      to: "listing-svc",
      label: "open listing + calendar",
      detail: {
        what: "The guest picks one of the results and loads the listing page: metadata, photos from the CDN, and the calendar for the months around their dates.",
        why: "It is the step where an approximate result becomes a specific listing on specific nights, and where the guest sees the real per-night price rather than the summarised one used for ranking.",
        numbers: ["~10 KB metadata", "~6 MB of thumbnails per listing", "CDN hit rate ~95%"],
        breaks:
          "This read comes off a replica, so the page can still show a night that has just gone. The correction happens at the commit, not here.",
      },
    },
    {
      id: "e4",
      from: "listing-svc",
      to: "calendar",
      label: "replica read, display only",
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "Reading the per-night rows for the displayed months to draw the calendar widget and price the visible nights.",
        why: "Display needs the actual rows rather than the search summary, but it does not need to be authoritative, so it is deliberately routed to a replica and never to the home-region primary.",
        numbers: ["listing views run ~10x booking volume"],
        breaks:
          "Replica lag means the widget can show a night as free milliseconds after it was held. Pointing this read at the primary would put browsing traffic on the one component that cannot be made active-active.",
      },
    },
    {
      id: "e5",
      from: "listing-svc",
      to: "pricing-svc",
      label: "quote nights, price rules",
      detail: {
        what: "Asking for the exact total for the selected nights: per-night overrides, length-of-stay and weekend adjustments, fees.",
        why: "Ranking used an approximate nightly price; the page has to show the number the guest will actually be charged, and that number is then snapshotted onto the booking so it cannot move underneath them.",
        numbers: ["price snapshot frozen on the booking"],
        breaks:
          "If the quote and the snapshot are computed twice rather than once and carried forward, a host rule change between the two produces a charge the guest never agreed to.",
      },
    },
    {
      id: "e6",
      from: "pricing-svc",
      to: "calendar",
      label: "price_override per night",
      dashed: true,
      fromSide: "top",
      toSide: "bottom",
      detail: {
        what: "Writing the resolved nightly price back onto the calendar row as price_override.",
        why: "Materialising the price where the night already lives makes it one indexed field for search and one column read for a quote, instead of rule evaluation on every search hit.",
        numbers: ["price_override is 4 B on a ~70 B row"],
        breaks:
          "A bulk repricing sweep across a host's whole calendar writes the same rows the booking path locks, so it has to be batched rather than fired as one statement over 500 days of rows.",
      },
    },
    {
      id: "e7",
      from: "guest",
      to: "booking-orch",
      label: "POST /booking + key",
      animated: true,
      offset: 90,
      fromSide: "left",
      toSide: "left",
      detail: {
        what: "The booking request, carrying the listing, the dates, the payment method and a client-generated idempotency key.",
        why: "This is the moment the system switches from approximate to exact. Everything before it was allowed to be a suggestion; from here the answer is either a booking or an explicit rejection.",
        numbers: ["~12 commits/s average, ~120 peak", "p99 under 2s including authorisation"],
        breaks:
          "A client that generates a fresh key per retry defeats the deduplication entirely, and a double-tapped Book button becomes two sagas and two card authorisations.",
      },
    },
    {
      id: "e8",
      from: "booking-orch",
      to: "calendar",
      label: "hold 15 min, then confirm",
      animated: true,
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "The short transaction that takes the nights in the range, verifies each reads available, and flips them to held with an expiry, followed later by the flip to booked.",
        why: "It is the only strictly ordered thing in the system and the only place the index is checked against reality. The lock mechanics are the same class of problem as the hotel reservation question; what is specific here is that the row being locked may have been mutated by a host or a rival channel since the search ran.",
        numbers: ["~2ms transaction", "15 min hold expiry", "held rows released by a 60s reaper"],
        breaks:
          "Any row not reading available ends the attempt with AVAILABILITY_LOST, which is the visible cost of everything upstream being deliberately stale.",
      },
    },
    {
      id: "e9",
      from: "calendar",
      to: "cdc",
      label: "WAL stream",
      fromSide: "top",
      toSide: "bottom",
      detail: {
        what: "Committed calendar mutations streamed off the write-ahead log: bookings, holds, host blocks and channel-sync writes alike.",
        why: "The indexer must not care which of the three writers made the change, so it reads the log rather than being called by any of them. That is also what stops a dual-write path drifting with no repair.",
        numbers: ["~10 calendar mutations per booking", "~120 events/s average, ~1,200 peak"],
        breaks:
          "Every writer that bypasses the rows, for example a cache someone adds in front of the calendar, is invisible to this stream and silently never reaches search.",
      },
    },
    {
      id: "e10",
      from: "cdc",
      to: "search-index",
      label: "availability summary, 60s",
      detail: {
        what: "Applying the change to the affected listing document, refreshing its availability summary and any derived price fields.",
        why: "This is the only arrow from the reservation side back to the discovery side, and it points away from the truth. Search is downstream of the calendar and never the other way round.",
        numbers: ["60s freshness target", "page at 5 min lag"],
        breaks:
          "Consumer lag is the failure and it is silent on both sides. The mitigation is that the commit re-validates, so a stale hit costs exactly one AVAILABILITY_LOST rather than a double booking.",
      },
    },
    {
      id: "e11",
      from: "host-app",
      to: "calendar",
      label: "block nights, min stay",
      fromSide: "top",
      toSide: "bottom",
      detail: {
        what: "A host writing their own availability: blocking a range, changing a minimum stay, toggling instant book.",
        why: "Supply is user-generated, so the availability calendar is irregular in a way a hotel's is not. A blocked fortnight is a host's personal decision, not a sale, and it has to be distinguishable from a booking in the same row.",
        numbers: ["one edit touches a whole date range"],
        breaks:
          "A host trying to block a night that already carries a confirmed booking has to be refused, and that refusal is a product conversation rather than an error code.",
      },
    },
    {
      id: "e12",
      from: "host-app",
      to: "pricing-svc",
      label: "host rules, Smart Pricing",
      dashed: true,
      fromSide: "top",
      toSide: "bottom",
      detail: {
        what: "Host-set pricing rules: base nightly rate, weekend and seasonal multipliers, length-of-stay discounts, or an opt-in to platform-suggested pricing.",
        why: "Ten million independent owners set their own prices, so pricing is configuration supplied by users rather than a rate card we control, and the service exists to turn that configuration into one number per night.",
        numbers: ["rules resolve to price_override per night"],
        breaks:
          "A rule change repriced across 500 days of pre-materialised rows is a large write for a small edit, so it has to be applied incrementally rather than as one sweep per host.",
      },
    },
    {
      id: "e13",
      from: "partners",
      to: "channel-sync",
      label: "iCal poll, 5 to 60 min",
      fromSide: "top",
      toSide: "bottom",
      detail: {
        what: "Availability pulled from a partner: an iCal feed or a channel-manager REST call, on an interval that varies with how near-term the listing's demand is.",
        why: "The interval is adaptive because uniform polling does not fit inside partner rate limits, and because a listing with a booking next week is worth checking far more often than one with no near-term demand.",
        numbers: ["~2M listings polled", "uniform 15 min = ~2,200 req/s", "partners rate-limit in the tens/s"],
        breaks:
          "Back off per partner account rather than globally on a 429, or one badly behaved integration throttles every other partner's sync.",
      },
    },
    {
      id: "e14",
      from: "channel-sync",
      to: "calendar",
      label: "block only, never release",
      dashed: true,
      fromSide: "left",
      toSide: "left",
      offset: 60,
      detail: {
        what: "Writing partner-reported nights as blocked, and explicitly refusing to release any night carrying one of our confirmed bookings.",
        why: "The asymmetry is the entire safety property of this path. Trusting a partner to say a night is free means a stale feed can resell a night we have already sold; trusting them to say it is taken costs at most some lost inventory.",
        numbers: ["conflict resolves in favour of the existing booking"],
        breaks:
          "The conflict still happened, so the resolution has to raise a host-facing alert, and a host's channel-conflict rate becomes a ranking signal rather than something only the support desk sees.",
      },
    },
    {
      id: "e15",
      from: "booking-orch",
      to: "messaging",
      label: "thread + notify on confirm",
      detail: {
        what: "Opening the guest-host thread and emitting the confirmation fan-out once the booking commits, or the approval request if the listing is request-to-book.",
        why: "It is deliberately outside the commit so that email, push and host delivery latency never enter a path budgeted at p99 under 2s, and a failing provider degrades notifications rather than bookings.",
        numbers: ["24h approval window for request-to-book"],
        breaks:
          "A stalled queue is invisible in booking metrics, so a host can be sitting on an approval request they were never told about while every dashboard reads green.",
      },
    },
    {
      id: "e16",
      from: "booking-orch",
      to: "reviews",
      label: "review invite after stay",
      dashed: true,
      offset: 70,
      fromSide: "left",
      toSide: "left",
      detail: {
        what: "The completed booking opening a review window for both parties once the stay ends.",
        why: "Reviews are anchored to a booking rather than to an account, which is what makes verified-stay weighting possible: only someone who actually stayed can rate, and only the host who actually hosted can rate back.",
        numbers: ["14 day deadline from checkout"],
        breaks:
          "Cancelled and no-show bookings must not open a window, or the review system becomes reachable without ever having paid for a stay.",
      },
    },
    {
      id: "e17",
      from: "reviews",
      to: "search-index",
      label: "rating into ranking",
      dashed: true,
      fromSide: "right",
      toSide: "bottom",
      detail: {
        what: "Released review scores, weighted by reviewer reputation and verified-stay status, written into the listing document as ranking features.",
        why: "It closes the marketplace loop: the only durable quality signal about supply we do not own is what previous guests said, so reviews are ultimately a search input rather than a page decoration.",
        numbers: ["ranking features sit in the ~5 KB document"],
        breaks:
          "Coordinated review rings move ranking directly, so the weighting and anomaly detection are load-bearing for search quality, not just for fairness on a profile page.",
      },
    },
    {
      id: "e18",
      from: "messaging",
      to: "host-app",
      label: "host reply, 24h approval",
      dashed: true,
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "Delivering guest enquiries, request-to-book approvals and channel-conflict alerts to the host, and carrying their answer back.",
        why: "Half the decisions in a two-sided marketplace are made by a human who is not logged in when you need them, so the design has to hold a durable state while it waits rather than block anything.",
        numbers: ["hold committed with a 24h expiry while waiting"],
        breaks:
          "The outstanding hold blocks instant-book attempts on those nights for the full window, which is correct and is also the main complaint hosts have about the mode.",
      },
    },
  ],
};
