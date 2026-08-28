import type { Diagram } from "./types";

export const ONLINE_AUCTION: Diagram = {
  id: "online-auction",
  title: "Online Auction",
  question: "Design an Online Auction System",
  sourceId: "patterns",
  itemId: 55,
  overview: {
    shape:
      "One mutable row per item with an ordered stream of events against it: bids route by hash(auction_id) to a single owning writer, the deadline arrives as a CLOSE event in that same stream rather than as a clock reading, and a separate broadcast tier carries the price to fifty watchers per bidder.",
    beats: [
      "The write path is deliberately narrow. A bid carries max_amount in minor units, an idempotency key and the price the client last rendered. The stateless API validates auth, currency, tick and that the bidder is not the seller in about 2ms, so garbage never reaches the ordered path at all.",
      "Everything for one item then lands on one writer, keyed by hash(auction_id). That routing is the performance mechanism, not the correctness mechanism: the version-fenced conditional write is already correct with no routing at all, and the routing exists so that write almost never fails. Above a 0.1% zero-rows rate your routing is broken, not your database.",
      "Proxy resolution happens once, in memory, and commits in a single write. alice's max of 40 against bob's 30 gives a displayed price of 31 with alice still leading and bob outbid in the response to his own bid. Writing the counter-bid as a second transaction would let an observer read an intermediate price nobody authorised.",
      "The deadline is not a clock comparison and this is the whole design. end_ts is one value in the database and N slightly different values across the fleet, because ordinary NTP skew is 1 to 10ms while bids arrive milliseconds apart. The close scheduler does not close the auction; it enqueues a CLOSE event onto the same partition stream as the bids.",
      "Auto-extension then flattens the endgame: an accepted bid inside the final 120s pushes end_ts to bid_ts + 120s under the same conditional write as the price, capped at 30 extensions or original_end + 1h. It costs a rewrite of the close-timer entry on every extension, arriving exactly when 485 closes/s are already firing.",
      "The read path is a different shape entirely. Fifty watchers per bidder hold a WebSocket, receive a coalesced snapshot at most four times a second, and render the countdown client-side from a server-supplied end_ts. The bus delivers once per gateway node rather than per connection, so a 15,000-watcher item costs it 48 deliveries.",
    ],
    crux:
      "A published deadline is not an instant. If each API node decides whether a bid was in time by comparing its local clock to end_ts, a node drifted by 40ms accepts what an adjacent node rejects, and one of those two users has a legal claim on the item. Acceptance has to stop being a comparison and become a position: a CLOSE event ordered into the item's own stream, or a fenced conditional write where the store's serialisation order is the order.",
    numbers: [
      "~10M live auctions, ~485 closes/s at Sunday peak",
      "~40 bids/s on one row, a ~5,000x per-key spike",
      "1 to 10ms NTP skew against bids milliseconds apart",
    ],
  },
  nodes: [
    {
      id: "ordered-zone",
      label: "Ordered per auction_id",
      kind: "group",
      x: 24,
      y: 214,
      w: 312,
      h: 214,
      detail: {
        what: "The only part of the system where order is a correctness property: one owning writer per auction, resolving proxy maxima and committing under a version fence.",
        why: "There is exactly one unit for sale and no substitute, so contention cannot be spread across replicas or shards. One item is one key by construction, and the price row is the thing every bid and the close must agree on.",
        numbers: ["one writer per auction_id", "~3ms per resolve-and-commit"],
        breaks:
          "The ceiling is one writer's serial throughput per auction. At ~40 bids/s and ~3ms each you have ~10x headroom, and there is no sharding your way past it if a lot goes hotter than that.",
        choice: {
          pick: "Keyed single writer plus a version-fenced conditional write",
          instead: "Any API node writing the row, relying on the conditional write alone.",
          decider:
            "Peak accepted bids per second on the hottest single item. Below roughly 5 bids/s per item the plain conditional write never notices the contention; at ~40 bids/s with ~3ms per commit, uncoordinated writers collide often enough that a retry storm lands on the most valuable lot at the worst possible moment.",
          flips:
            "When your store gives cheap serialisable single-row transactions and your p99 item stays under ~5 bids/s, or when you cannot afford the operational surface of leases, ownership handover and split-brain.",
        },
      },
    },
    {
      id: "bidder",
      label: "Bidder app",
      sub: "max_amount, idempotency key",
      kind: "external",
      x: 40,
      y: 0,
      w: 280,
      detail: {
        what: "A phone submitting a maximum it is willing to pay, with a per-tap idempotency key and the price it last rendered.",
        why: "The client is on a cell network with a p50 of 80ms and a p99 of 900ms, which is two orders of magnitude worse than anything on the server side. Every design decision at the deadline exists because this hop is slow and variable.",
        numbers: ["mobile RTT p50 ~80ms, p99 ~900ms", "~120ms of the 250ms budget is network"],
        breaks:
          "A timed-out request that actually succeeded. Without the idempotency key the client retries and submits a second, higher maximum the user never authorised.",
      },
    },
    {
      id: "bid-api",
      label: "Bid API tier",
      sub: "stateless, autoscaled, validate + dedupe",
      kind: "compute",
      x: 40,
      y: 110,
      w: 280,
      detail: {
        what: "Stateless tier doing auth, currency and tick validation, seller self-bid rejection and idempotency-key dedupe before anything reaches the ordered path.",
        why: "Rejecting cheaply here keeps the single writer for each auction spending its serial budget on real bids. On a hot lot ~40 submissions/s arrive and ~35/s survive validation, so roughly an eighth of the load never touches the contended row.",
        numbers: ["~2ms to validate", "40/s in, ~35/s out on a hot lot", "~1.7k submissions/s globally"],
        breaks:
          "It must never decide whether a bid was in time. If this tier compares its own clock to end_ts, a node with 40ms of drift accepts what its neighbour rejects and two identically timed users get different outcomes.",
        choice: {
          pick: "Idempotency key scoped to (bidder_id, auction_id, max_amount)",
          instead: "A bare request ID, or no dedupe and rely on the user not retrying.",
          decider:
            "The p99 mobile RTT of 900ms against a 250ms server budget guarantees clients time out on requests that actually succeeded. Scoping the key too broadly is worse than the bug it fixes: a stale key reused across auctions returns the wrong outcome, so it expires when the auction closes.",
          flips:
            "A desk-bound client on a reliable network where the retry rate is negligible, or an explicit bid-per-tap product with no proxy maxima, where a duplicate is merely a rejected bid rather than an unauthorised raise.",
        },
      },
    },
    {
      id: "partition",
      label: "Auction partition",
      sub: "single writer per auction_id",
      kind: "compute",
      x: 40,
      y: 230,
      w: 280,
      detail: {
        what: "A keyed executor: every event for one item, bids and the CLOSE alike, lands on the one process that owns it and is handled one at a time.",
        why: "Contention on the price row becomes structural rather than incidental, and the CLOSE gets somewhere to be ordered against bids. The same pattern as the per-instrument matching core in #42, for the opposite reason: there it buys microsecond determinism, here it buys a contended row that almost never actually contends.",
        numbers: ["~1ms cross-network route", "~1ms to sequence", "alert if CAS zero-rows > 0.1%"],
        breaks:
          "The owner dies mid-bid and ownership moves while bids are in flight. The new owner has to read the row's version and the tail of the bid log before accepting writes; in-flight bids fail closed and clients retry with the same idempotency key.",
        choice: {
          pick: "Route by hash(auction_id) to one owning process, leased",
          instead: "Stateless writers everywhere, letting the conditional write arbitrate.",
          decider:
            "The retry cost at the per-key spike. A top-1% lot goes from 0.008 bids/s over its lifetime to ~40 bids/s in its final ten seconds, a ~5,000x spike on one partition key. The fleet is fine at ~5k writes/s; the row is not.",
          flips:
            "A catalogue with no hot lots, where 90% of auctions take about 8 bids across three days and the conditional write never fails. Then leases and handover are pure operational cost for nothing.",
        },
      },
    },
    {
      id: "resolver",
      label: "Proxy resolve + CAS",
      sub: "one in-memory cascade, one write",
      kind: "compute",
      x: 40,
      y: 350,
      w: 280,
      detail: {
        what: "Compares the challenger's maximum against the secret high_max, computes the new displayed price and leader, and commits price, leader, maximum, bid count and end_ts in one version-fenced update.",
        why: "The cascade must be a single commit or an observer reads an intermediate price and a crash leaves the auction in a state no bidder authorised. It also makes this approximately a second price auction, where the winner pays one increment above the runner-up's maximum, which holds only while the maxima stay secret.",
        numbers: [
          "~3ms serial per resolution",
          "retries bounded at 3",
          "two history rows per accepted bid",
        ],
        breaks:
          "A retry that silently raises the user's maximum. If their max no longer clears the new minimum the answer is OUTBID, because auto-raising spends money they did not authorise and that is a regulatory conversation rather than a bug report.",
        choice: {
          pick: "Resolve the whole cascade server-side, commit once",
          instead: "Append bids to a log and fold them into a price lazily, on read or on a schedule.",
          decider:
            "How many people read the price and how stale it may be. At 50 watchers per bidder, roughly 1,500 on a typical live lot and ~15,000 on a hot one, the price is read four orders of magnitude more often than it is written, so paying at write time is the cheap side.",
          flips:
            "When nobody is watching. Sealed-bid tenders that reveal only at close, or B2B auctions with a handful of invited bidders, where folding at close is simpler and the secret-maximum machinery disappears entirely.",
        },
      },
    },
    {
      id: "bus",
      label: "Price tick bus",
      sub: "NATS JetStream, topic per auction",
      kind: "bus",
      x: 40,
      y: 480,
      w: 280,
      detail: {
        what: "A topic per auction carrying coalesced snapshots of price, bid count and end time, at most four a second no matter how fast bids arrive.",
        why: "Broadcast is where the volume is: the read path carries ~50x the write path, and a naive per-bid broadcast from one hot item would be 40 bids/s times 15,000 watchers, or 600k msgs/s from a single lot.",
        numbers: [
          "<= 4 ticks/s per auction",
          "~85k msgs/s baseline, ~17MB/s",
          "coalescing cuts a hot item 10x",
        ],
        breaks:
          "A bus partition leaves watchers with a frozen price under a running countdown, which looks alive. Clients need a staleness heartbeat and a 2s poll fallback, and the UI must say reconnecting rather than render a stale number as live.",
        choice: {
          pick: "Coalesced pub/sub, one delivery per gateway node",
          instead: "Publish every accepted bid, one message per subscribed connection.",
          decider:
            "Fan-out arithmetic on a hot lot: 4 ticks/s across 48 gateway nodes is ~192 deliveries/s, against 600k msgs/s if you fan out per connection. The cost is that the displayed price can lag by ~250ms, which matters to snipers and to nobody else.",
          flips:
            "A live streamed auction with seconds-long lots, where a 250ms coalescing window is a large share of the whole lot and the latency regime is closer to #33 than to this design.",
        },
      },
    },
    {
      id: "ws-gateway",
      label: "WebSocket gateway",
      sub: "~48 Go nodes, ~150k conns each",
      kind: "compute",
      x: 40,
      y: 590,
      w: 280,
      detail: {
        what: "The connection tier: holds the watcher sockets, subscribes once per node per auction topic, and fans a tick out to its own local connections.",
        why: "Fan-out has to scale with gateway nodes rather than with viewers. A 15,000-watcher item costs the bus 48 deliveries and each node then writes to its local ~310 connections, which is why the bill tracks the fleet and not the audience.",
        numbers: [
          "~5M concurrent connections at peak",
          "~10KB per connection, ~50GB across the tier",
          "~40M subscriptions, ~8 per connection",
        ],
        breaks:
          "Losing a node drops ~150k connections that all reconnect together. Reconnect needs a jittered 0 to 30s spread and a snapshot fetch rather than a stream replay, or the herd lands on the API tier during an endgame.",
        choice: {
          pick: "Persistent WebSockets with a client-rendered countdown",
          instead: "Clients polling GET /auctions/{id} every second or two.",
          decider:
            "5M concurrent watchers at 1Hz would be 5M req/s of mostly unchanged JSON. Seconds are never streamed either: the countdown is rendered locally from end_ts plus a one-time clock-offset handshake, so a drifting client clock degrades only the display.",
          flips:
            "As the degraded mode it already falls back to. When the bus is partitioned or the socket goes quiet for two keepalive intervals, a 2s poll is correct and visibly stale beats silently stale.",
        },
      },
    },
    {
      id: "settlement",
      label: "Settlement + notifications",
      sub: "see #23 and #7",
      kind: "compute",
      x: 40,
      y: 700,
      w: 280,
      detail: {
        what: "Everything downstream of the close: winner determination against the reserve, order creation, charge, and outbid, won and second-chance messaging.",
        why: "The winning bid is a binding contract and the payment can fail two days later, so this is a recovery flow rather than a rollback. Keeping it asynchronous also means the close itself stays one conditional write while 485 of them fire in the same evening window.",
        numbers: [
          "485 closes/s x ~50 recipients = ~24k notifications/s",
          "48h payment window before a strike",
          "win-to-capture SLO > 97%",
        ],
        breaks:
          "Second-chance offers are an abuse vector. A seller with a colluding account can win, not pay, then second-chance the real underbidder at their revealed maximum, so the platform initiates the offer, never the seller, and the price is capped at the underbidder's stored max.",
        choice: {
          pick: "Asynchronous settlement off a queue, charge after close",
          instead: "Pre-authorise the card at bid time and capture at the close.",
          decider:
            "Authorisation churn against dispute cost. A hot lot takes ~2,000 bids, most of which lose, so pre-auth means thousands of holds placed and released per item. The trade is that ~3% of wins fail to capture within 48h and need strikes, reminders and a relist path.",
          flips:
            "High-value lots where a non-paying winner is expensive enough to justify escrow or a deposit, and the seller cannot absorb the delay of an unpaid-item cycle.",
        },
      },
    },
    {
      id: "close-scheduler",
      label: "Close scheduler",
      sub: "timer wheel, emits CLOSE",
      kind: "compute",
      x: 440,
      y: 110,
      w: 280,
      detail: {
        what: "A sharded timer over 10M pending deadlines. At end_ts it does not close the auction; it enqueues a CLOSE event onto the same partition stream as the bids.",
        why: "That distinction is the whole design. If the scheduler mutated state directly it would be one more clock comparison racing the bids, and the boundary would again depend on whose clock was right.",
        numbers: [
          "~3.3M closes/day, ~39/s average",
          "~485/s in the Sunday evening window, ~12x",
          "overdue-closes alert past 5s",
        ],
        breaks:
          "A stalled shard lets auctions blow past end_ts and keep taking bids, which is a legal problem rather than a latency one. An independent sweeper scans state='OPEN' AND end_ts < now - 5s, and the close is idempotent under WHERE state='OPEN' so a double fire is harmless.",
        choice: {
          pick: "Enqueue CLOSE into the auction's own stream, sharded and jittered",
          instead: "A cron sweep that flips state where end_ts has passed, or per-node clock checks at bid time.",
          decider:
            "NTP skew of 1 to 10ms against bids arriving milliseconds apart on money with a legal owner. Sharding by hash(auction_id) with plus or minus 2s of jitter spreads the 485/s burst; everything downstream of CLOSE is asynchronous, so a won email landing seconds late costs nothing.",
          flips:
            "Auctions with no meaningful last-second traffic, such as B2B tenders with a handful of invited bidders, where a sweep every few seconds is indistinguishable from a sequenced close.",
        },
      },
    },
    {
      id: "close-timers",
      label: "Close timers",
      sub: "Redis sorted set, score = end_ts",
      kind: "store",
      x: 440,
      y: 230,
      w: 280,
      detail: {
        what: "The pending-deadline index: a sorted set sharded by hash(auction_id) with end_ts as the score, rewritten on every auto-extension.",
        why: "10M live deadlines need an O(log n) 'what is due next' answer and an equally cheap reschedule, because auto-extension makes end_ts mutable state rather than a fixed property of the listing.",
        numbers: ["10M pending deadlines", "O(log n) rewrite per extension", "capped at 30 extensions"],
        breaks:
          "Timer-set churn under auto-extension. A 30-extension bidding war across 33k hot lots is a burst of index writes arriving exactly while 485 closes/s are also firing, which is the wrong moment for the index to be busy.",
        choice: {
          pick: "Sharded Redis sorted set keyed on end_ts (see #36)",
          instead: "A relational table scanned by a polling query, or one timer object per auction.",
          decider:
            "10M rows scanned repeatedly against an O(log n) range read, with a reschedule on every late bid. The cap matters as much as the structure: 30 extensions or original_end + 1h, whichever comes first, or a war has no bound at all.",
          flips:
            "Small catalogues where a WHERE end_ts < now query over a few thousand rows every second is simpler and one fewer system to operate.",
        },
      },
    },
    {
      id: "auctions",
      label: "Auctions row",
      sub: "price, high_max, end_ts, version",
      kind: "store",
      x: 440,
      y: 350,
      w: 280,
      detail: {
        what: "One mutable row per item holding current_price, high_bidder, the secret high_max, end_ts, extensions_used and version, updated by conditional write only.",
        why: "This row is the single source of truth for who leads and what the next bid must clear, and its version column is what makes acceptance a position rather than a clock reading. high_max is never returned by any external endpoint.",
        numbers: [
          "~1KB per row, ~10GB live working set",
          "zero-rows-affected SLO < 0.1%",
          "closed archive ~11TB at RF=3 over 3 years",
        ],
        breaks:
          "Read-modify-write in application code. alice and bob both read 100, both compute 105, the second write silently erases the first, and one of them has already been told they are leading.",
        choice: {
          pick: "PostgreSQL or DynamoDB, conditional write on version AND state='OPEN'",
          instead: "Read the price, compute the next one in the application, write it back inside a transaction.",
          decider:
            "The fence carries the close for free: because every bid requires state='OPEN' and the close sets it CLOSED, the store's own serialisation order is the sequencer and no node compares a clock to end_ts. A 10GB working set sits in a RAM tier, so the compare-and-set costs microseconds.",
          flips:
            "Never for the price itself. If the CAS-failure rate spikes because routing has broken, fall back to full serialisable isolation on the row, slower but correct, and never relax to read-then-write.",
        },
      },
    },
    {
      id: "bid-log",
      label: "Bid log",
      sub: "Cassandra, append-only by auction_id",
      kind: "store",
      x: 440,
      y: 470,
      w: 280,
      detail: {
        what: "Every submission with provenance, accepted, proxy-generated or rejected, clustered by seq within the auction partition.",
        why: "Fraud remediation means recomputing the price from surviving bids, which you cannot do if a bid was a mutation of a field. It is also the audit trail a chargeback argues from, and the tail the new partition owner reads on failover.",
        numbers: [
          "~120B per bid record",
          "~130M rows/day, ~16GB raw, ~47GB at RF=3",
          "~50TB for 3-year retention",
        ],
        breaks:
          "Replay only repairs the accounting. Cancelling a shill ring's bids and recomputing the honest price recovers the delta and the final-value fee, but the buyer already paid and every other bidder valued their own bids against a price signal that was a lie.",
        choice: {
          pick: "Append-only wide-column log partitioned by auction_id",
          instead: "A bids table with the current price maintained as an updatable column.",
          decider:
            "Whether you can answer 'what would the price have been without these bids' a week after close. At ~2,000 bids on a hot lot the replay is trivial to compute and impossible without provenance, and RF=3 at ~47GB/day is a cheap price for it.",
          flips:
            "Never for the log itself, but the retention is negotiable: 3 years is an audit choice, and a shorter window shrinks the ~50TB accordingly.",
        },
      },
    },
    {
      id: "watchers",
      label: "Watcher clients",
      sub: "~50 per bidder, countdown local",
      kind: "external",
      x: 440,
      y: 590,
      w: 280,
      detail: {
        what: "The audience: people holding a socket on a countdown they are not bidding on, roughly fifty for every one bidder.",
        why: "Watching is free and abundant, so the read path sizes the fleet rather than bid throughput does. They receive snapshots, not events, so a dropped message costs nothing and the next snapshot repairs it.",
        numbers: ["50:1 watchers to bidders", "~1,500 on a typical live lot, ~15,000 on a hot one", "tick lag p99 SLO < 500ms"],
        breaks:
          "A socket that has been silently dead for 90 seconds shows a frozen price under a ticking countdown, the worst possible failure because it looks alive. Two missed keepalives must flip the UI to reconnecting and fall back to polling.",
      },
    },
  ],
  edges: [
    {
      id: "e1",
      from: "bidder",
      to: "bid-api",
      label: "bid + idempotency key",
      animated: true,
      detail: {
        what: "POST /auctions/{id}/bids carrying max_amount in minor units, an idempotency key and the price the client last rendered.",
        why: "The maximum goes to the server rather than being played out by the client, because proxy bidding only works if the ceiling is secret. Sending the last-rendered price lets the server tell the user they were bidding against a number that had already moved.",
        numbers: ["~120ms wall clock on a cell network"],
        breaks:
          "A response lost on the return trip. The client retries, and without the idempotency key that becomes a second bid at a higher maximum the user never authorised.",
      },
    },
    {
      id: "e2",
      from: "bid-api",
      to: "partition",
      label: "route hash(auction_id)",
      animated: true,
      detail: {
        what: "The validated bid crossing the network to the one partition that owns this auction.",
        why: "Every bid for one item has to reach the same writer, so the routing key is the auction rather than the bidder or the request. This hop is the price of serialising a single item, and it is about 1ms.",
        numbers: ["~1ms cross-network", "~35 of 40 submissions/s survive validation"],
        breaks:
          "Broken routing sends two writers at one auction. The bids are still correct because of the version fence, but the CAS-failure rate climbs above 0.1% and the retry storm lands on the most valuable lot at its busiest moment.",
      },
    },
    {
      id: "e3",
      from: "partition",
      to: "resolver",
      label: "serialised, one at a time",
      animated: true,
      detail: {
        what: "The owning writer handing a single bid to proxy resolution, one event at a time, in the order the partition sequenced them.",
        why: "Serialising here is what makes the price monotonic and the leader unique. It is also what gives the CLOSE event a defined position relative to bids, which is the only reason the deadline is decidable at all.",
        numbers: ["~3ms per resolve-and-commit", "~105ms of wall time per second at 35 bids/s"],
        breaks:
          "This is a single-threaded budget. At ~40 bids/s and ~3ms each there is roughly 10x headroom, and a lot hotter than that has nowhere to go, because one price cannot be sharded.",
      },
    },
    {
      id: "e4",
      from: "resolver",
      to: "auctions",
      label: "CAS on version + OPEN",
      animated: true,
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "One UPDATE setting price, leader, high_max, end_ts and bid_count, gated on WHERE state='OPEN' AND version = :v.",
        why: "Zero rows affected means exactly one of two things: someone else moved the price, or the auction closed. Both are handled by re-reading and re-resolving, which is why the boundary needs no clock anywhere in the fleet.",
        numbers: ["retries bounded at 3", "zero-rows SLO < 0.1%"],
        breaks:
          "Retrying by silently raising the user's maximum. If their max no longer clears the new minimum the correct answer is OUTBID, and anything else spends money they did not authorise.",
      },
    },
    {
      id: "e5",
      from: "resolver",
      to: "bid-log",
      label: "append MANUAL + PROXY",
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "Two history rows per accepted bid: the challenger's submission and the incumbent's proxy auto-bid, both with provenance.",
        why: "The log is quorum-committed before the client is told LEADING, which is what makes in-region RPO zero. It is also the only thing that lets a shill ring's bids be cancelled and the honest price recomputed a week later.",
        numbers: ["~130M rows/day", "~120B per record", "kind is MANUAL, PROXY_AUTO or REJECTED"],
        breaks:
          "Acknowledging the bid before the log commit would mean a crash could lose a bid the user was already told they had won with, which is the one failure the design refuses to have.",
      },
    },
    {
      id: "e6",
      from: "close-scheduler",
      to: "partition",
      label: "CLOSE event",
      dashed: true,
      fromSide: "left",
      toSide: "right",
      detail: {
        what: "The deadline arriving as an event on the same stream as the bids, rather than as a state change made from outside.",
        why: "This single arrow is the answer to the whole question. Everything ordered before it is in and everything after is out, decided once by one writer, so no node ever compares its local clock to end_ts to judge whether a bid was in time.",
        numbers: ["1 to 10ms of ordinary NTP skew", "per-node offset alert above 25ms"],
        breaks:
          "If this were a direct state mutation instead of a sequenced event it would race the bids, and a bid 3ms before the deadline could land either side depending on which machine was asked.",
      },
    },
    {
      id: "e7",
      from: "close-scheduler",
      to: "close-timers",
      label: "due end_ts, sharded",
      dashed: true,
      detail: {
        what: "The scheduler reading the head of its shard's sorted set to find deadlines that are now due.",
        why: "Ten million pending deadlines need a cheap 'what is next' answer, and sharding by hash(auction_id) lets scheduler shards fail over independently of the data tier, so a stalled scheduler never blocks bidding.",
        numbers: ["10M pending timers", "~485 closes/s at peak", "jittered by plus or minus 2s"],
        breaks:
          "A stalled shard is invisible from the bid path: auctions keep accepting bids past their published end_ts. The overdue-closes gauge is the only thing that catches it, alerting past 5s.",
      },
    },
    {
      id: "e8",
      from: "resolver",
      to: "close-timers",
      label: "auto-extend rewrite",
      dashed: true,
      fromSide: "right",
      toSide: "bottom",
      offset: 48,
      detail: {
        what: "A bid accepted inside the final 120s pushing end_ts to bid_ts + 120s and rewriting this auction's entry in the sorted set.",
        why: "Latency stops deciding the winner because there is always another two minutes, and the spike at a published timestamp flattens into a decaying tail. end_ts becomes mutable state under the same conditional write as the price.",
        numbers: ["W = 120s quiet window", "cap of 30 extensions or original_end + 1h"],
        breaks:
          "The cap recreates a hard close at the worst possible moment, with more money on the table than at the original deadline. Show remaining extensions in the UI so the endgame is legible rather than letting the cap arrive as a surprise.",
      },
    },
    {
      id: "e9",
      from: "resolver",
      to: "bus",
      label: "price tick, 4/s max",
      animated: true,
      detail: {
        what: "A coalesced snapshot of price, bid count and end time published once per auction per quarter second, plus a unicast OUTBID to the bidder who just lost the lead.",
        why: "Bidding is a low-volume, high-consequence ordered write and watching is a high-volume, lossy broadcast. They are separated here so neither makes the other expensive, and the broadcast carries snapshots so a dropped message repairs itself.",
        numbers: ["~5ms to publish", "40 bids/s collapses to 4 ticks/s"],
        breaks:
          "Publishing before the CAS commits would broadcast a price that never existed. The tick has to follow the write, never accompany it.",
      },
    },
    {
      id: "e10",
      from: "bus",
      to: "ws-gateway",
      label: "one msg per gateway node",
      animated: true,
      detail: {
        what: "Each gateway node subscribing once to an auction's topic and receiving one delivery per tick regardless of how many of its connections care.",
        why: "This is what makes the fan-out bill scale with the fleet rather than the audience. A 15,000-watcher lot costs the bus 48 deliveries; the node then writes to its own ~310 local connections.",
        numbers: ["4 ticks/s x 48 nodes = ~192 deliveries/s", "~310 local connections per node per hot auction"],
        breaks:
          "Skew, when one node ends up holding a disproportionate share of a hot auction's watchers. Shed the topic by refusing new subscriptions on hot nodes at subscribe time rather than by dropping connections.",
      },
    },
    {
      id: "e11",
      from: "ws-gateway",
      to: "watchers",
      label: "coalesced snapshot",
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "The snapshot written to each subscribed socket: price, bid count, end_ts and whether the auction just extended.",
        why: "Seconds are never streamed. The countdown is rendered client-side from end_ts plus a one-time clock-offset handshake, so the connection carries state changes only and a drifting client clock degrades the display and nothing else.",
        numbers: ["~200B framed", "<= 4 per second", "tick lag p99 SLO < 500ms"],
        breaks:
          "A silently dead socket. The price freezes while the local countdown keeps running, so the client must detect two missed keepalives and mark the price reconnecting rather than render a stale number as live.",
      },
    },
    {
      id: "e12",
      from: "resolver",
      to: "settlement",
      label: "winner, order, notify",
      fromSide: "left",
      toSide: "left",
      offset: 56,
      detail: {
        what: "The outcome of the CLOSE resolution: reserve check, winner determination, then order creation and messaging off a queue.",
        why: "Everything downstream of CLOSE is asynchronous so the close itself stays one conditional write while 485 of them fire in the same window. If the reserve was not met nothing is created, the auction simply ends unsold.",
        numbers: ["~485 closes/s at peak", "~24k notifications/s", "48h to pay before a strike"],
        breaks:
          "An early close caught after the winner was notified. It has to be detected at settlement, by comparing the closed sequence position against end_ts, and reopened before any message goes out.",
      },
    },
    {
      id: "e13",
      from: "bid-api",
      to: "auctions",
      label: "GET price, min_next_bid",
      dashed: true,
      fromSide: "right",
      toSide: "left",
      offset: 40,
      detail: {
        what: "GET /auctions/{id} serving current_price, bid_count, min_next_bid, end_ts and the masked high bidder from a replica.",
        why: "min_next_bid is derived from the displayed price, so this read is what every client bids against. It is also the degraded path: when the bus is partitioned, watchers poll this at 2s rather than sit on a frozen socket.",
        numbers: ["poll fallback every 2s", "high_max never appears in any response"],
        breaks:
          "It must never leak high_max or an outbid delta. A bidder who can read how far they lost by can binary-search the leader's ceiling within one increment in four bids.",
      },
    },
  ],
};
