import type { Diagram } from "./types";

export const GAMING_LEADERBOARD: Diagram = {
  id: "gaming-leaderboard",
  title: "Gaming Leaderboard",
  question: "Design a Real-Time Gaming Leaderboard",
  sourceId: "patterns",
  itemId: 22,
  overview: {
    shape:
      "A durable log of server-computed scores feeding one ordered in-memory index per board, where the index is chosen entirely because it can answer an arbitrary player's position without counting everyone above them.",
    beats: [
      "Ingestion never trusts the client. The client sends match facts, the leaderboard service computes the score, and the result is appended to a partitioned durable log before anything touches a board. That log is the system of record, which is what makes an in-memory board acceptable: it is a derived index, not a database.",
      "The board is one Redis sorted set per logical board key. A sorted set is a skip list plus a hash table, and every forward pointer in the skip list carries a span, the number of nodes it jumps. Rank therefore accumulates during the descent the lookup was doing anyway, so ZREVRANK is O(log N) and lands in roughly 50 microseconds.",
      "Writes are batched into 50ms windows because span maintenance is the expensive half. Every rank-changing ZADD rewrites spans up the whole tower, and at the 60k/s contest burst that is a real share of one event loop. One round trip carrying 500 ZADDs pays the syscall once and still meets the 5s visibility budget.",
      "The read path is the burst that defines the system. 600k concurrent players polling every 2s is around 300k rank reads per second, and unlike top-N those cannot be shared between users, so no cache collapses them. They go to 6 to 8 read replicas at roughly 100k ops/s each, which is a different scaling axis from write sharding.",
      "Below the head, exactness stops being worth anything. Exact rank for player 50,000,000 costs the same as rank 1 and no player can tell 4,812,004 from 4,812,051, so the top 10,000 get an exact ZREVRANK and everyone below gets a percentile bucket from quantile snapshots refreshed every 60s.",
      "Lifecycle is naming rather than migration. Daily, weekly, all-time and regional boards are separate keys with TTLs, so a reset is a key expiring, and tomorrow's key is pre-created five minutes before midnight so the first write after the boundary does not race every other service instance into existence.",
    ],
    crux:
      "An arbitrary player's rank is a counting question, not a lookup. Top-N falls out of any index on score; position 4,812,004 does not, and that single requirement picks the data structure, decides whether you can shard, and decides whether approximation is allowed.",
    numbers: [
      "60k ZADD/s burst on one key",
      "~300k rank reads/s at contest close",
      "100M players x ~90B = ~9GB all-time board",
    ],
  },
  nodes: [
    {
      id: "redis-group",
      label: "Redis: one ZSET per board key",
      kind: "zone",
      detail: {
        what: "The in-memory tier: a primary sorted set per logical board, plus the read replicas that serve rank and top-N off it.",
        why: "Every board is the same object with a different key, so capacity is planned as one number rather than per feature. Seven daily boards, four weekly, all-time and the regional set add up to roughly 35GB of primaries, and replication takes the whole tier to about 125GB.",
        numbers: [
          "~35GB of primaries",
          "~125GB with replicas",
          "8 nodes x 32GB with room",
        ],
        breaks:
          "Board sprawl: a per-room or per-match key means millions of near-empty sorted sets where per-key overhead dominates the data, so small boards belong in a shared key with a composite member.",
      },
    },
    {
      id: "clients",
      label: "Game clients",
      sub: "match facts in, rank out",
      kind: "external",
      col: 0,
      row: 0,
      detail: {
        what: "Players finishing matches and then polling for where they stand, typically every couple of seconds during a contest.",
        why: "It is drawn because it sets both hard constraints: the client is untrusted, so it may never assert a score, and its polling behaviour is what produces the read burst the whole read tier is sized for.",
        numbers: [
          "600k concurrent at prime time",
          "poll every 2s during a contest",
          "~40 rank or board views per session",
        ],
        breaks:
          "A client-trusted score reaches the board, or every client polls on the same 2s cadence and the burst arrives as one synchronised wave rather than spread out.",
      },
    },
    {
      id: "leaderboard-svc",
      label: "Leaderboard Service",
      sub: "server-authoritative scoring",
      kind: "service",
      col: 0,
      row: 1,
      detail: {
        what: "Computes the score from submitted event facts, resolves a logical board id to a concrete key, and decides whether a rank read is answered exactly or as a bucket.",
        why: "Scoring has to happen somewhere the player cannot reach, and the exact-versus-bucketed fork has to happen somewhere that knows the player's approximate position. Putting both here keeps the storage tier a dumb ordered index with no policy in it.",
        numbers: [
          "rank read p99 under 100ms",
          "exact above rank 10,000, bucketed below",
          "match visible in under 5s",
        ],
        breaks:
          "It owns the 'exact' flag in the API contract; get that wrong and a client renders a bucketed guess as a precise number, which is worse than showing a band.",
        choice: {
          pick: "Server-authoritative scoring from event facts, with a 202 on submission",
          instead: "Accepting a score the client computed, validated by plausibility rules.",
          decider:
            "Whether a forged number can enter a board that 100M players compare themselves against. Validation catches implausible jumps but nothing stops a client asserting a legal-looking score, and the write path is asynchronous anyway with a 5s visibility budget, so there is no latency argument for trusting the client.",
          flips:
            "A single-player or cosmetic board with no payout and no competitive meaning, where the cost of server-side simulation exceeds the cost of the occasional fake score.",
        },
      },
    },
    {
      id: "event-log",
      label: "Match event log",
      sub: "partitioned, durable, replayable",
      kind: "queue",
      col: 0,
      row: 2,
      detail: {
        what: "The durable partitioned log every scored match completion lands on before any board is written.",
        why: "This is what demotes the sorted set to an index. A crash then costs the last second of writes plus a rebuild rather than the game's history, and anything that pays out money can be computed from a sequence boundary in the log rather than read off a board.",
        numbers: [
          "50M match completions/day",
          "250M board writes/day across 5 boards",
          "~2.9k writes/s average, ~12k/s peak hour",
        ],
        breaks:
          "One match writes five board keys with no transaction spanning them, so a player can be rank 12 on the daily board and briefly absent from the regional one, and the boards are never simultaneously correct.",
        choice: {
          pick: "A partitioned durable log as the system of record, boards derived from it",
          instead: "Writing the sorted set directly from the request and treating Redis as the record.",
          decider:
            "What a primary loss costs. AOF everysec bounds loss to about 1s of writes, and with the log those writes are replayable by sequence number instead of gone. Without it the in-memory board is the only copy of 250M writes/day and an eviction or a failed failover is unrecoverable data loss.",
          flips:
            "A board that is genuinely disposable, such as a per-match scoreboard for 20 players, where losing it means recomputing something trivial and the log is pure operational cost.",
        },
      },
    },
    {
      id: "board-writer",
      label: "Board writer",
      sub: "50ms batch windows",
      kind: "service",
      col: 0,
      row: 3,
      detail: {
        what: "Consumes the log and applies score updates to the board keys as pipelined batches of ZADDs.",
        why: "The write cost on a sorted set is span maintenance up the skip-list tower, and that is paid per entry no matter what. Batching removes the other half, the syscall and round trip per update, which is what turns a 60k/s burst into something one primary absorbs.",
        numbers: [
          "50 to 100ms batch windows",
          "~500 ZADDs per round trip",
          "one primary ceiling ~100k ops/s",
        ],
        breaks:
          "Delivery is at-least-once, so a replayed batch re-applies a ZADD. That is idempotent for an absolute score and wrong for an increment, which is why scores are written as values rather than deltas.",
        choice: {
          pick: "Batched writes in 50ms windows off the log",
          instead: "Write-through: one ZADD per match completion, synchronously on the request path.",
          decider:
            "The freshness budget against the event-loop cost. Visibility only has to be under 5s, so a 50ms window is invisible to the product, and amortising the syscall lifts the effective ceiling from roughly 100k ops/s to a few hundred thousand. The 60k/s contest burst is 60% of one primary unbatched.",
          flips:
            "A board with a sub-second visibility requirement, or write rates low enough that the ceiling never binds, where batching only adds latency and a consumer to operate.",
        },
      },
    },
    {
      id: "zset-primary",
      label: "Sorted set primary",
      sub: "ZADD / ZREVRANK / ZREVRANGE",
      kind: "database",
      col: 0,
      row: 4,
      parent: "redis-group",
      detail: {
        what: "One Redis sorted set per board: a skip list ordered by score, paired with a hash table from member to score.",
        why: "Every forward pointer in the skip list carries a span, the count of nodes it jumps, so rank is accumulated during the descent rather than by counting entries above the player. That one field is the entire reason this structure is chosen over any other sorted container.",
        numbers: [
          "ZREVRANK ~50 microseconds",
          "~90B per entry, 9GB for 100M players",
          "packed = points * 2^31 + (2^31 - 1 - t)",
        ],
        breaks:
          "Ties are undefined unless you define them: equal scores order by member bytes, which is arbitrary and permanently stable, so the same player wins every tie forever until the tiebreaker is packed into the score itself.",
        choice: {
          pick: "Redis sorted set: ZADD to write, ZREVRANK for position, ZREVRANGE for top-N",
          instead: "Postgres with a B-tree on (board_id, score DESC), top-N via ORDER BY LIMIT and rank via COUNT(*) WHERE score > mine, or a rank column recomputed by a periodic ROW_NUMBER() pass.",
          decider:
            "Arbitrary rank, not top-N. The B-tree matches Redis on top-100 and loses badly on rank: the index stores no rank, so COUNT(*) walks every entry above the player, 50M index tuples for a median player on a 100M board, hundreds of milliseconds against a 100ms budget. The batch alternative replaces that with an O(100M) pass per refresh, and at 60k writes/s the order moves faster than a 60s job can republish it.",
          flips:
            "Rank is only ever served for the top few hundred, or the board moves on a human cadence: a 200k-row company board recomputed hourly is a materialised view and a cron job. It also flips when standings must be transactionally consistent with a prize ledger, because the sorted set gives you no transaction with the money.",
        },
      },
    },
    {
      id: "read-replicas",
      label: "Read replicas",
      sub: "6 to 8 on the contest board",
      kind: "database",
      col: 0,
      row: 5,
      parent: "redis-group",
      detail: {
        what: "Async replicas of each board primary, serving every rank and top-N read.",
        why: "Rank and top-N are read-only, so read volume scales on replicas while write rate scales on shards, and conflating the two is the classic mistake here. Sharding a board with a read problem multiplies round trips per read and adds no read capacity at all.",
        numbers: [
          "~100k ops/s per instance",
          "300k rank reads/s / 100k = 3 minimum, 6 to 8 for headroom",
          "route reads away above 500ms lag",
        ],
        breaks:
          "Replication lag spikes during a snapshot fork on the primary, and a lagging replica serves a confidently wrong rank rather than an error, so reads have to be routed away on the lag metric.",
        choice: {
          pick: "Read replicas sized from read volume, not data size",
          instead: "More write shards, or a per-user response cache in front of the API.",
          decider:
            "Whether the reads can be shared. 300k/s of rank reads are per-player and therefore uncacheable across users, so a 1 to 2s response cache barely helps a client polling every 2s. Top-N is the opposite, one shared object where an edge cache collapses any read rate to about 1 backend read/s.",
          flips:
            "When the burst is push-shaped rather than poll-shaped: publishing rank changes over the WebSocket the client already holds removes most of the 300k/s instead of serving it, and then the replica count falls out.",
        },
      },
    },
    {
      id: "board-keys",
      label: "Board key registry",
      sub: "lb:daily / weekly / alltime / region",
      kind: "service",
      col: 1,
      row: 1,
      detail: {
        what: "Maps a logical board plus date and region to a concrete key, sets its TTL, and pre-creates the next period's key before the boundary.",
        why: "Making the period part of the key turns a daily reset into a key expiring rather than a migration or a mass delete, and makes rollover a naming event. The pre-creation exists because lazy creation races every service instance at exactly midnight.",
        numbers: [
          "lb:daily:{YYYY-MM-DD} TTL 7d",
          "lb:weekly:{YYYY-WW} TTL 30d",
          "next key created 5 minutes early",
        ],
        breaks:
          "At 00:00 UTC the new key must already accept writes; created lazily it is empty for the first reads, which return rank nil to a thundering herd at the worst possible moment.",
        choice: {
          pick: "One key per (scope, period) with a TTL, next period pre-created with a sentinel member",
          instead: "A single board with a period column, reset by deleting or rewriting entries at the boundary.",
          decider:
            "What happens at the tick. Thousands of writes per second are in flight in the five minutes either side of midnight, and a delete-and-rewrite of a 900MB daily board is a stop-the-world operation on a serving primary. Expiry costs nothing and the old key keeps serving historical reads until its 7 day TTL runs out.",
          flips:
            "Boards whose period is not known in advance, such as a tournament that ends when a condition is met rather than at a wall-clock time, where the key cannot be named ahead of the boundary.",
        },
      },
    },
    {
      id: "score-history",
      label: "Score history store",
      sub: "relational, authoritative",
      kind: "database",
      col: 1,
      row: 2,
      detail: {
        what: "The durable relational record of players and their score history, written from the same log that feeds the boards.",
        why: "The board holds a current value per player and nothing else: no history, no joins, no transactions. Anything that pays out, audits a result or reverses a cheater needs a store that can answer those questions, and it is deliberately off the hot path.",
        numbers: [
          "100M registered players",
          "AOF alone is ~25GB/day, ~190GB for 30 days cold",
          "payouts computed at a log sequence boundary",
        ],
        breaks:
          "Rebuilding the all-time board from here means replaying roughly 250M writes at maybe 100k/s, which is tens of minutes with no reads served, and it needs retention covering the board's whole life rather than 24 hours.",
        choice: {
          pick: "A relational store plus the event log as the record, with the board as a derived index",
          instead: "Treating Redis as the system of record, backed only by AOF and snapshots.",
          decider:
            "What you can answer after the fact. AOF bounds loss to about 1s but stores commands, not history, so a retroactive cheat removal or a payout dispute has nothing to query. It also means an in-memory board of 9GB is the only copy of the data, which no one signs off on.",
          flips:
            "Ephemeral boards with no payout, no audit and no history requirement, where the log retention alone covers rebuild and a second store earns nothing.",
        },
      },
    },
    {
      id: "aof-snapshots",
      label: "AOF + hourly snapshots",
      sub: "fork on a non-serving replica",
      kind: "database",
      col: 1,
      row: 4,
      detail: {
        what: "Append-only file on the primary plus periodic RDB snapshots shipped to a blob store.",
        why: "Neither is the durability story, the event log is. These exist to bound the two recovery numbers: AOF everysec bounds the recovery point to about a second, and the snapshot bounds cold-start time so a rebuild does not have to replay the board's whole lifetime.",
        numbers: [
          "AOF everysec, ~1s recovery point",
          "hourly snapshots",
          "~30s replica promotion vs tens of minutes for a full rebuild",
        ],
        breaks:
          "An RDB snapshot forks the process, and copy-on-write faults stall the event loop for hundreds of milliseconds on a 9GB board while replication backs up behind it, which is why the fork happens on a replica serving no traffic.",
        choice: {
          pick: "AOF everysec on the primary, RDB snapshots taken from a dedicated non-serving replica",
          instead: "AOF fsync always, or snapshotting directly from the serving primary.",
          decider:
            "The cost of each guarantee against what the log already covers. fsync always makes every ZADD a disk write and destroys the ~100k ops/s ceiling to save 1s of loss the log can replay anyway. Snapshotting on the primary trades hundreds of milliseconds of event-loop stall for a file you could have taken elsewhere for free.",
          flips:
            "No event log in front, where AOF is the only durability and every-second loss is unacceptable, at which point you pay the fsync and accept a much lower write ceiling.",
        },
      },
    },
    {
      id: "quantile-snapshots",
      label: "Quantile snapshots",
      sub: "bucketed percentile, refreshed 60s",
      kind: "database",
      col: 1,
      row: 5,
      detail: {
        what: "A small periodic summary of the score distribution, held as a bucket array in the API process, answering 'top 3%' for players too deep for a number to mean anything.",
        why: "Exact rank for player 50,000,000 costs exactly what rank 1 costs and conveys nothing, because 4,812,004 and 4,812,051 are 47 places apart out of 100M and no player can tell them apart. This is the product concession that keeps the deep tail off the exact path.",
        numbers: [
          "refreshed every 60s",
          "exact above rank 10,000, bucketed below",
          "one lookup in a ~200 entry array",
        ],
        breaks:
          "It lags the board by design, so it must never serve the head: at 60k writes/s and 200ms of lag up to 12,000 uncounted entries would rewrite the podium, while at rank 4.2M they are invisible.",
        choice: {
          pick: "Exact rank for roughly the top 10,000, percentile buckets below it",
          instead: "Exact rank for every player on every read, paying whatever fan-out that costs.",
          decider:
            "What exactness costs once the board is sharded, plus what a player can perceive. On one unsharded primary exact rank is a single O(log N) call and this fork does not exist. Across 8 shards it is 1 rank call plus 7 counts, so 300k reads/s becomes 2.4M ops/s to answer a question whose bucketed form is one array lookup already in process.",
          flips:
            "Rank carries money or status at every position, such as a tournament paying down to rank 50,000 or a ladder feeding matchmaking. Then a bucket is not a simplification, it is a wrong answer, and you pay for the round trips.",
        },
      },
    },
    {
      id: "score-shards",
      label: "Score-band shards",
      sub: "quantile-cut bands + Fenwick counters",
      kind: "database",
      col: 0,
      row: 6,
      detail: {
        what: "The scale-out path, not the starting point: each board split into score bands on separate primaries, with a coarse bucket histogram so rank stays two operations instead of one per shard.",
        why: "Sharding is what you do when one board's sustained write rate passes the single-thread ceiling, and the shard key must be the score. Hashing by player id scatters sorted order across every shard and turns top-100 into a fan-out to all of them.",
        numbers: [
          "needed above ~200k writes/s sustained",
          "4,096 buckets, 12 Fenwick steps",
          "rank becomes 1 rank call + S-1 counts without the counter layer",
        ],
        breaks:
          "A score increase can cross a band boundary, which is a ZREM on one shard plus a ZADD on another with no transaction across them. Add first and remove second so a crash double-counts a player rather than making them vanish, and let a reconciler sweep the duplicates.",
        choice: {
          pick: "Score-range bands cut on observed quantiles, with a Fenwick counter layer over 4,096 buckets",
          instead: "Hashing by player id, or equal-width score bands, or no sharding at all.",
          decider:
            "Peak write rate on the busiest single board against roughly 100k ZADD/s per primary. The 60k/s contest burst is 60% of one primary and batching lifts the ceiling further, so at this size sharding buys nothing but merge logic. Memory is explicitly not the decider: 9GB fits on any box. Equal-width bands fail separately, because a power-law score distribution puts 90% of players in the bottom band.",
          flips:
            "Sustained writes on one board above roughly 200k/s even batched, or recovery time rather than throughput: a 9GB board reloads from AOF in tens of minutes single-threaded, where eight 1.1GB shards reload in parallel and only an eighth is unavailable at once.",
        },
      },
    },
  ],
  edges: [
    {
      id: "e1",
      from: "clients",
      to: "leaderboard-svc",
      label: "match facts / rank read",
      animated: true,
      detail: {
        what: "Two request shapes on one connection: POST /score carrying event facts, and GET /rank asking where this player sits.",
        why: "They are drawn as one arrow because the client cannot tell them apart, but they load completely different halves of the system: one is 2.9k/s of writes, the other is the 300k/s burst that sizes the read tier.",
        numbers: ["~300k rank reads/s at contest close", "POST /score returns 202"],
        breaks:
          "Polling is the failure. A client asking every 2s sends the same request whether or not its rank moved, and the fix is pushing rank changes over the WebSocket that already exists rather than serving the polls.",
      },
    },
    {
      id: "e2",
      from: "leaderboard-svc",
      to: "event-log",
      label: "scored match events",
      animated: true,
      detail: {
        what: "The server-computed score appended to the durable log, keyed so a player's updates stay ordered.",
        why: "Nothing writes a board before this append succeeds, which is what makes the board a derived index. The acknowledgement to the client is a 202 against this write, not against the board.",
        numbers: ["50M completions/day", "5 board writes per completion"],
        breaks:
          "One completion fans out to five board keys with no transaction spanning them, so at-least-once retries leave the boards briefly disagreeing with each other.",
      },
    },
    {
      id: "e3",
      from: "event-log",
      to: "board-writer",
      label: "batched 50ms windows",
      animated: true,
      detail: {
        what: "The writer consuming the log and accumulating updates into a batch before touching Redis.",
        why: "The 5s visibility budget buys the batching window, and the window is what pays the syscall once for hundreds of updates instead of once each. It is also the natural place to feed the counter layer from the same batch.",
        numbers: ["50 to 100ms windows", "~500 ZADDs per round trip"],
        breaks:
          "Consumer lag turns straight into staleness, and it is invisible from the board itself: rank reads keep answering fast, they just answer from a board that stopped moving.",
      },
    },
    {
      id: "e4",
      from: "board-writer",
      to: "zset-primary",
      label: "ZADD packed score",
      animated: true,
      detail: {
        what: "The pipelined ZADDs themselves, each carrying the packed score that encodes points and the inverted timestamp together.",
        why: "The tiebreaker rides inside the score rather than beside it, because the sorted set orders by exactly one number and anything else would need a second lookup to break ties deterministically.",
        numbers: ["packed = points * 2^31 + (2^31 - 1 - t)", "51 bits inside a double's 53"],
        breaks:
          "Past 53 bits the encoding rounds silently, ties come back, and they show up as ranks that flap rather than as an error anyone can see.",
      },
    },
    {
      id: "e5",
      from: "zset-primary",
      to: "read-replicas",
      label: "async replication",
      dashed: true,
      detail: {
        what: "The replication stream carrying every accepted write from the primary out to the read replicas.",
        why: "It is async because rank reads tolerate sub-second staleness against a 5s visibility budget, and synchronous replication would put replica acknowledgement on the write path that is already the tightest resource.",
        numbers: ["sub-second lag in steady state", "route reads away above 500ms"],
        breaks:
          "Lag spikes behind a snapshot fork, and a lagging replica answers confidently rather than failing, so the lag metric has to gate routing.",
      },
    },
    {
      id: "e6",
      from: "leaderboard-svc",
      to: "read-replicas",
      label: "ZREVRANK, exact head",
      animated: true,
      fromSide: "left",
      toSide: "left",
      offset: 110,
      detail: {
        what: "The exact rank read: one ZREVRANK against a replica for a player inside the top 10,000, plus ZREVRANGE for the top-N slice.",
        why: "This is the query the whole design exists for. It goes to a replica rather than the primary because it is read-only and because the primary's budget is spent on span maintenance under the write burst.",
        numbers: ["~50 microseconds server-side", "round trip under 5ms", "p99 budget 100ms"],
        breaks:
          "Per-player rank cannot be shared between users, so there is nothing to cache and the only lever is more replicas or fewer requests.",
      },
    },
    {
      id: "e7",
      from: "read-replicas",
      to: "quantile-snapshots",
      label: "score distribution, 60s",
      dashed: true,
      detail: {
        what: "A periodic pass over the board that produces the bucket boundaries and counts making up the quantile summary.",
        why: "It is built from a replica rather than the primary so a full-board summarisation never competes with the write path, and it is periodic because the shape of a 100M-player distribution does not move meaningfully inside a minute.",
        numbers: ["refreshed every 60s", "~200 buckets held in the API process"],
        breaks:
          "The summary drifts from the board between refreshes, which is fine in the tail and fatal in the head, so this feed may never be the source for a top-N answer.",
      },
    },
    {
      id: "e8",
      from: "quantile-snapshots",
      to: "leaderboard-svc",
      label: "bucket for deep ranks",
      fromSide: "right",
      toSide: "right",
      offset: 140,
      detail: {
        what: "The fallback answer for a player outside the top 10,000: a percentile band such as 'top 3%, about 4.2M' rather than an exact position.",
        why: "It collapses the most expensive read shape into an array lookup already resident in the API process, and the API contract carries an explicit exact flag so the client renders a band rather than a number it would otherwise trust.",
        numbers: ["one in-process lookup", "exact: false in the response"],
        breaks:
          "If the client ignores the exact flag it renders an approximate figure as a precise rank, which is a worse lie than showing a band.",
      },
    },
    {
      id: "e9",
      from: "leaderboard-svc",
      to: "board-keys",
      label: "resolve board key + TTL",
      dashed: true,
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "Turning a logical board request into a concrete key: scope, period and region resolved to lb:daily:2026-04-27 or lb:region:{country}.",
        why: "Keeping the resolution in one place is what makes the midnight rollover a naming decision rather than a distributed state change, and it is where the UTC definition of 'daily' is enforced for every caller.",
        numbers: ["5 boards written per match completion", "next key created 5 minutes early"],
        breaks:
          "Defining the day in the player's local timezone instead of UTC puts a player in Auckland and one in Los Angeles on different boards, and the two can then never be compared.",
      },
    },
    {
      id: "e10",
      from: "event-log",
      to: "score-history",
      label: "authoritative history",
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "The same log consumed a second time, into the durable relational record of scores and their provenance.",
        why: "Two consumers off one log rather than a write from the board, so the durable copy does not depend on the in-memory one being correct, and a payout can be computed at a sequence boundary rather than read off a board that is only eventually right.",
        numbers: ["payouts computed at a log sequence boundary"],
        breaks:
          "This consumer can lag independently of the board writer, so for a window the visible standings and the payable record disagree, and only the record is allowed to settle the difference.",
      },
    },
    {
      id: "e11",
      from: "zset-primary",
      to: "aof-snapshots",
      label: "AOF everysec + RDB",
      dashed: true,
      fromSide: "right",
      toSide: "left",
      detail: {
        what: "Every accepted command appended to the AOF, with a full RDB snapshot taken hourly from a non-serving replica.",
        why: "It bounds the recovery point to about a second and the cold-start time to an hour of replay, which is the difference between a promotion taking 30s and a rebuild taking tens of minutes.",
        numbers: ["~25GB/day of AOF", "~190GB for 30 days compressed", "~1s recovery point"],
        breaks:
          "If fsync fails on a full disk the correct behaviour is to stop acknowledging writes rather than acknowledge writes that are not durable, and that has to be alerted on rather than discovered later.",
      },
    },
    {
      id: "e12",
      from: "aof-snapshots",
      to: "zset-primary",
      label: "restore on cold start",
      dashed: true,
      fromSide: "top",
      toSide: "right",
      detail: {
        what: "Loading the most recent snapshot back into a primary, then replaying the AOF tail on top of it.",
        why: "The snapshot is what keeps a cold start bounded, and this arrow is why it is quietly load-bearing despite the design calling it optional: without it the honest recovery time for the all-time board is hours rather than minutes.",
        numbers: ["hourly snapshot bounds the replay", "9GB board, single-threaded load"],
        breaks:
          "Snapshot loading is single-threaded, so a 9GB board is tens of minutes of unavailability and that number is nowhere near the 30s replica promotion everyone quotes.",
      },
    },
    {
      id: "e13",
      from: "score-history",
      to: "board-writer",
      label: "replay to rebuild board",
      dashed: true,
      fromSide: "top",
      toSide: "right",
      detail: {
        what: "The rebuild path: replaying history through the same writer that serves live traffic, to reconstruct a board from scratch.",
        why: "It goes through the writer rather than around it so the rebuild uses exactly the same batching and packing logic as the live path, which is the only way a rebuilt board is guaranteed to order identically to the one it replaces.",
        numbers: ["~250M writes for the all-time board", "~100k/s replay, tens of minutes"],
        breaks:
          "The rebuild is slower than anyone has agreed to and needs retention covering the board's whole lifetime, which is why the snapshot ends up carrying the recovery story in practice.",
      },
    },
    {
      id: "e14",
      from: "zset-primary",
      to: "score-shards",
      label: "split at ~200k writes/s",
      dashed: true,
      detail: {
        what: "The escape hatch: splitting one board's sorted set into score bands across several primaries once the single-thread write ceiling is genuinely in reach.",
        why: "It is drawn dashed because it is the scale-out path rather than the starting point. At 60k/s on the busiest key, one primary is at 60% and sharding would buy nothing but merge logic and a band-boundary failure mode.",
        numbers: ["one primary ceiling ~100k ops/s", "shard above ~200k/s sustained"],
        breaks:
          "The shard key must be the score. Hashing by player id spreads writes evenly and destroys global order, which turns top-100 into a fan-out to every shard followed by a merge.",
      },
    },
    {
      id: "e15",
      from: "score-shards",
      to: "leaderboard-svc",
      label: "sum counts + local rank",
      dashed: true,
      fromSide: "left",
      toSide: "left",
      offset: 170,
      detail: {
        what: "What a rank read becomes once sharded: the counts in every band above the player summed, plus one exact ZREVRANK inside their own band.",
        why: "This is the asymmetry worth saying out loud. Top-N gets cheaper under score-range sharding because it is always one band, while rank gets linear in the shard count at exactly the read rate that hurts, until the counter layer collapses it back to two operations.",
        numbers: ["S round trips without the counter layer", "8 shards x 300k reads/s = 2.4M ops/s"],
        breaks:
          "The counter layer is fed asynchronously, so at 60k/s and 200ms of lag up to 12,000 entries are uncounted, which is invisible at rank 4.2M and fatal in the top 100.",
      },
    },
  ],
};
